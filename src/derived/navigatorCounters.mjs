import { createHash } from 'node:crypto';

const TEXT_UNIT_KINDS = new Set(['chapter-file', 'scene']);

function stableHash(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

export function countNavigatorWords(text) {
  const normalized = String(text || '').trim();
  if (!normalized) return 0;
  return normalized.split(/\s+/u).filter(Boolean).length;
}

function emptyCounters() {
  return {
    wordCount: 0,
    sceneCount: 0,
    completedSceneCount: 0,
    progressPercent: 0,
  };
}

function normalizeNodeId(node) {
  return typeof node?.nodeId === 'string' ? node.nodeId.trim() : '';
}

function normalizeKind(node) {
  return typeof node?.kind === 'string' ? node.kind.trim() : '';
}

function normalizePreviousSnapshot(snapshot) {
  const leafHashes = snapshot && snapshot.leafHashes && typeof snapshot.leafHashes === 'object'
    ? snapshot.leafHashes
    : {};
  const previousLeafHashes = {};
  for (const [nodeId, hash] of Object.entries(leafHashes)) {
    if (/^tree-node-[a-f0-9]{32}$/u.test(nodeId) && typeof hash === 'string' && hash.length === 64) {
      previousLeafHashes[nodeId] = hash;
    }
  }
  return { leafHashes: previousLeafHashes };
}

async function readTextForNode(node, readText) {
  if (typeof readText !== 'function') return '';
  const value = await readText(node);
  return typeof value === 'string' ? value : '';
}

async function annotateNode(node, context) {
  const nodeId = normalizeNodeId(node);
  const kind = normalizeKind(node);
  const children = Array.isArray(node?.children) ? node.children : [];
  const counters = emptyCounters();
  const descendantTextUnitIds = [];
  const changedDescendantIds = [];

  for (const child of children) {
    const childResult = await annotateNode(child, context);
    counters.wordCount += childResult.counters.wordCount;
    counters.sceneCount += childResult.counters.sceneCount;
    counters.completedSceneCount += childResult.counters.completedSceneCount;
    descendantTextUnitIds.push(...childResult.descendantTextUnitIds);
    changedDescendantIds.push(...childResult.changedTextUnitIds);
  }

  if (nodeId && TEXT_UNIT_KINDS.has(kind)) {
    const text = await readTextForNode(node, context.readText);
    const textHash = stableHash(text);
    const wordCount = countNavigatorWords(text);
    counters.wordCount += wordCount;
    counters.sceneCount += 1;
    counters.completedSceneCount += wordCount > 0 ? 1 : 0;
    descendantTextUnitIds.push(nodeId);
    context.nextLeafHashes[nodeId] = textHash;
    if (context.previous.leafHashes[nodeId] !== textHash) {
      changedDescendantIds.push(nodeId);
    }
  }

  counters.progressPercent = counters.sceneCount > 0
    ? Math.round((counters.completedSceneCount / counters.sceneCount) * 100)
    : 0;

  const changedSet = new Set(changedDescendantIds);
  const affected = Boolean(nodeId && changedSet.size > 0);
  node.derivedCounters = {
    ...counters,
    affectedByChangedSceneIds: affected ? Array.from(changedSet).sort() : [],
    textUnitIds: descendantTextUnitIds.slice().sort(),
  };
  if (affected) context.affectedNodeIds.add(nodeId);

  return {
    counters,
    descendantTextUnitIds,
    changedTextUnitIds: Array.from(changedSet),
  };
}

export async function annotateNavigatorDerivedCounters(root, options = {}) {
  if (!root || typeof root !== 'object' || Array.isArray(root)) {
    return {
      root,
      snapshot: { leafHashes: {} },
      changedSceneIds: [],
      affectedNodeIds: [],
    };
  }

  const context = {
    readText: options.readText,
    previous: normalizePreviousSnapshot(options.previousSnapshot),
    nextLeafHashes: {},
    affectedNodeIds: new Set(),
  };

  const result = await annotateNode(root, context);
  const changedSceneIds = Array.from(new Set(result.changedTextUnitIds)).sort();
  return {
    root,
    snapshot: { leafHashes: context.nextLeafHashes },
    changedSceneIds,
    affectedNodeIds: Array.from(context.affectedNodeIds).sort(),
  };
}

