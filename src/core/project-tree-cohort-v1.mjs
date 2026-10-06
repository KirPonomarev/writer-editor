import path from 'node:path';
import { sha256Hex } from './browser-safe-hash.mjs';
import { planProjectTreeIdentityCohort, normalizeProjectTreeIdentity } from './projectTreeIdentity.mjs';
import envelope from './document-content-envelope-v1.cjs';
import bookmarks from './word-user-bookmarks-v1.cjs';
import pending from './word-pending-text-revisions-v1.cjs';
import mixedReturn from './word-pending-comment-return-v1.cjs';
import notesModel from './word-manuscript-notes-v1.cjs';
import commentsModel from './word-comment-authoring-v1.cjs';
import commentAnchors from './word-comment-anchor-save-v1.cjs';
import commentRanges from './word-comment-ranges-v1.cjs';
import mediaModel from './word-media-return-v1.cjs';
import storyModel from './word-stories-v1.cjs';
import mediaData from '../io/documentMedia.js';
import { replayDocumentStoryMutationSteps } from '../io/revisionBridge/reviewTransportStoriesV1.mjs';

export const TREE_COHORT_MODE = 'PROJECT_TREE_COHORT_V1';
export const TREE_COHORT_LIMITS = Object.freeze({ files: 2048, bytes: 32 * 1024 * 1024, scenes: 512 });
const clone = x => JSON.parse(JSON.stringify(x));
const stable = x => Array.isArray(x) ? `[${x.map(stable).join(',')}]` : x && typeof x === 'object'
  ? `{${Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + stable(x[k])).join(',')}}` : JSON.stringify(x);
const sha = x => sha256Hex(x);
const fail = code => { throw Object.assign(Error(code), { code }); };
const need = (ok, code = 'E_TREE_COHORT_INVALID') => { if (!ok) fail(code); };
const text = x => x === null ? null : Buffer.from(x, 'base64').toString('utf8');
const b64 = x => x === null ? null : Buffer.from(x).toString('base64');
const json = x => JSON.stringify(x, null, 2) + '\n';
const same = (a, b) => stable(a) === stable(b);
const frozen = value => { if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); } return value; };
export function treeRelativePath(value) {
  need(typeof value === 'string' && value.length > 0 && value.length <= 2048 && !/[\\\x00-\x1f]/u.test(value)
    && !path.posix.isAbsolute(value) && value.split('/').every(p => p && p !== '.' && p !== '..'), 'E_TREE_COHORT_PATH');
  return value;
}
const matches = (value, base) => value === base || value.startsWith(base + '/');
const NOTE_PATH = 'notes.craftsman.json', COMMENT_PATH = '.yalken/word-review/non-text-return-state.v1.json';
const roles = new Set(['scene', 'sceneCommit', 'recoverySnapshot', 'backupSnapshot', 'backupMetadata', 'directory']);
function validateInventory(input) {
  need(Array.isArray(input) && input.length <= TREE_COHORT_LIMITS.files, 'E_TREE_COHORT_BUDGET');
  const found = new Map(); let size = 0;
  for (const item of input) {
    need(item && Object.keys(item).sort().join(',') === 'contentBase64,relativePath,role');
    const relative = treeRelativePath(item.relativePath);
    need(roles.has(item.role) && !found.has(relative), 'E_TREE_COHORT_INVENTORY');
    if (item.role === 'directory') need(item.contentBase64 === null);
    else {
      need(typeof item.contentBase64 === 'string' && Buffer.from(item.contentBase64, 'base64').toString('base64') === item.contentBase64, 'E_TREE_COHORT_ENCODING');
      const bytes = Buffer.from(item.contentBase64, 'base64');
      need(Buffer.from(bytes.toString('utf8'), 'utf8').equals(bytes), 'E_TREE_COHORT_UTF8');
      size += Buffer.from(item.contentBase64, 'base64').length;
      need(size <= TREE_COHORT_LIMITS.bytes, 'E_TREE_COHORT_BUDGET');
    }
    const basename = path.posix.basename(relative);
    if (item.role === 'scene') need(relative.startsWith('roman/') && /\.(?:txt|md)$/iu.test(relative)
      && (!basename.startsWith('.') || basename === '.index.txt'), 'E_TREE_COHORT_SCENE_PATH');
    if (item.role === 'sceneCommit') need(relative.startsWith('roman/') && /\.(?:txt|md)\.(?:wp201-)?commit\.json$/iu.test(relative), 'E_TREE_COHORT_COMPANION');
    if (item.role === 'recoverySnapshot') need(relative.startsWith('roman/') && /^\..+\.bak\.\d{13}$/u.test(basename), 'E_TREE_COHORT_COMPANION');
    if (item.role === 'backupMetadata') need(/^backups\/[a-f0-9]{64}\/meta\.json$/u.test(relative), 'E_TREE_COHORT_COMPANION');
    if (item.role === 'backupSnapshot') need(/^backups\/[a-f0-9]{64}\/\d{13}_.+$/u.test(relative), 'E_TREE_COHORT_COMPANION');
    if (item.role === 'directory') need(relative === 'roman' || relative.startsWith('roman/') || relative === 'backups' || /^backups\/[a-f0-9]{64}$/u.test(relative), 'E_TREE_COHORT_DIRECTORY');
    found.set(relative, clone(item));
  }
  return found;
}
function parsedScene(raw) {
  const parsed = envelope.parseObservablePayload(raw);
  need(!parsed.issue, 'E_TREE_COHORT_SCENE_INVALID');
  if (parsed.doc) { bookmarks.readRegistry(parsed.doc); pending.readLedger(parsed.doc); }
  return parsed;
}
function newId(prefix, input, original) { return prefix + sha(`${input.projectId}\n${input.operationId}\n${original}`).slice(0, 32); }
function forkScene(raw, input, sceneId, noteIds, occupiedNames, idMap) {
  const parsed = parsedScene(raw);
  if (!parsed.doc) return raw;
  const doc = clone(parsed.doc), registry = bookmarks.readRegistry(doc);
  if (registry) {
    const byId = new Map();
    for (const record of registry.bookmarks) {
      const originalId = record.id;
      record.id = newId('ubm-', input, `${sceneId}:${originalId}`);
      let name = `Copy_${sha(`${input.operationId}:${sceneId}:${originalId}`).slice(0, 32)}`;
      need(!occupiedNames.has(bookmarks.nameKey(name)), 'E_TREE_COHORT_BOOKMARK_COLLISION');
      occupiedNames.add(bookmarks.nameKey(name)); record.name = name;
      byId.set(originalId, record); idMap[originalId] = record.id;
    }
    const visit = node => {
      for (const mark of node.marks || []) if (mark.type === 'link' && mark.attrs?.wordBookmarkId) {
        const record = byId.get(mark.attrs.wordBookmarkId);
        need(record, 'E_TREE_COHORT_BOOKMARK_LINK');
        mark.attrs = { ...mark.attrs, ...bookmarks.linkAttrs(record) };
      }
      for (const child of node.content || []) visit(child);
    };
    doc.attrs.wordUserBookmarks = registry; visit(doc);
    bookmarks.validateRegistry(registry, doc);
    bookmarks.planSave({ beforeDoc: doc, workingDoc: doc });
  }
  const ledger = pending.readLedger(doc);
  if (ledger) {
    const forked = clone(ledger);
    for (const frame of [forked, ...(forked.roundUndo || []), ...(forked.roundRedo || [])]) {
      for (const point of frame.noteSourcePoints || []) {
        need(noteIds[point.noteId], 'E_TREE_COHORT_NOTE_HISTORY_UNKNOWN');
        point.noteId = noteIds[point.noteId];
      }
    }
    pending.validateLedger(forked); doc.attrs.wordPendingRevisions = forked; pending.readLedger(doc);
  }
  return envelope.composeObservablePayload({ ...parsed, doc, metaEnabled: parsed.hasMetaBlock });
}
function noteScene(note) { return note.manuscript?.reference?.sceneId || note.attachment?.sceneId || note.sceneId; }
function rebindNote(note, to, nodeIds, freshId) {
  const out = clone(note);
  if (freshId) out.id = freshId;
  if (out.manuscript) out.manuscript.reference.sceneId = to;
  if (out.sceneId !== undefined) out.sceneId = to;
  if (out.attachment?.sceneId !== undefined) out.attachment.sceneId = to;
  if (out.nodeId && nodeIds[out.nodeId]) out.nodeId = nodeIds[out.nodeId];
  if (out.attachment?.nodeId && nodeIds[out.attachment.nodeId]) out.attachment.nodeId = nodeIds[out.attachment.nodeId];
  return out;
}

// Structural ownership is derived from conserved root blocks, never a text diff.
function prepareTopology(input, files, identities, target, inventory) {
  if (!['split', 'merge'].includes(input.operation)) { need(input.topology === undefined, 'E_TREE_TOPOLOGY_INPUT'); return null; }
  const t = input.topology, split = input.operation === 'split';
  need(t && Object.keys(t).sort().join(',') === (split
    ? 'boundaryRootIndex,newRelativePath,sourceNodeId,sourceRelativePath'
    : 'leftNodeId,leftRelativePath,rightNodeId,rightRelativePath'), 'E_TREE_TOPOLOGY_INPUT');
  const paths = split ? [t.sourceRelativePath] : [t.leftRelativePath, t.rightRelativePath];
  paths.forEach(treeRelativePath);
  need(input.bindings.every(b => b.copy !== true && path.posix.dirname(b.fromRelativePath) === path.posix.dirname(paths[0])
    && path.posix.dirname(b.toRelativePath) === path.posix.dirname(paths[0])
    && (split || b.fromRelativePath !== paths[1])), 'E_TREE_TOPOLOGY_BINDINGS');
  need(paths.every(p => files.get(p)?.role === 'scene' && path.posix.basename(p) !== '.index.txt'), 'E_TREE_TOPOLOGY_SOURCE');
  need(split || path.posix.dirname(paths[0]) === path.posix.dirname(paths[1]), 'E_TREE_TOPOLOGY_PARENT');
  if (!split) {
    const siblings = [...inventory.values()].filter(item => path.posix.dirname(item.relativePath) === path.posix.dirname(paths[0])
      && !path.posix.basename(item.relativePath).startsWith('.') && (item.role === 'directory' || item.role === 'scene' && item.relativePath.endsWith('.txt')));
    const order = item => { const name = path.posix.basename(item.relativePath), prefix = name.match(/^(\d+)_/u);
      return { number: prefix ? Number(prefix[1]) : Number.MAX_SAFE_INTEGER, name: name.replace(/\.txt$/iu, '').replace(/^\d+_/u, '') }; };
    siblings.sort((a,b) => { const x = order(a), y = order(b); return x.number - y.number || x.name.localeCompare(y.name, 'ru'); });
    const index = siblings.findIndex(item => item.relativePath === paths[0]);
    need(index >= 0 && siblings[index + 1]?.relativePath === paths[1], 'E_TREE_TOPOLOGY_NOT_ADJACENT');
  }
  if (split) {
    treeRelativePath(t.newRelativePath);
    need(path.posix.dirname(target(paths[0])) === path.posix.dirname(t.newRelativePath), 'E_TREE_TOPOLOGY_PARENT');
  }
  const sources = paths.map((relativePath, i) => {
    const raw = text(files.get(relativePath).contentBase64), parsed = parsedScene(raw);
    const doc = parsed.doc || envelope.buildParagraphDocumentFromText(parsed.text);
    need(!pending.readLedger(doc), 'E_TREE_TOPOLOGY_PENDING_UNSUPPORTED');
    const leaves = bookmarks.paragraphs(doc), leafTexts = leaves.map(bookmarks.textOf);
    return { relativePath, raw, parsed, doc, leaves, leafTexts, visible: leafTexts.join('\n'),
      nodeId: split ? t.sourceNodeId : i ? t.rightNodeId : t.leftNodeId };
  });
  const left = sources[0], outputs = [], partitions = [];
  const rootLeaves = (doc, from, to) => {
    const result = [];
    const walk = node => { if (['paragraph','heading','codeBlock'].includes(node.type)) result.push(node); else for (const child of node.content || []) walk(child); };
    doc.content.slice(from, to).forEach(walk); return result.length;
  };
  const part = (source, from, to, output, rootOffset, leafOffset) => {
    const leafFrom = rootLeaves(source.doc, 0, from), leafTo = leafFrom + rootLeaves(source.doc, from, to);
    partitions.push({ sourceNodeId: source.nodeId, sourceRelativePath: source.relativePath,
      rootFrom: from, rootTo: to, targetNodeId: output.nodeId, targetRelativePath: output.relativePath,
      targetRootFrom: rootOffset, leafFrom, leafTo, targetLeafFrom: leafOffset });
  };
  if (split) {
    const cut = t.boundaryRootIndex;
    need(Number.isSafeInteger(cut) && cut > 0 && cut < left.doc.content.length
      && ['paragraph','heading'].includes(left.doc.content[cut]?.type), 'E_TREE_TOPOLOGY_BOUNDARY');
    outputs.push({ nodeId: left.nodeId, relativePath: target(left.relativePath), doc: { ...clone(left.doc), content: clone(left.doc.content.slice(0, cut)) }, parsed: left.parsed });
    outputs.push({ nodeId: identities.createdNodeIds[0], relativePath: t.newRelativePath, doc: { ...clone(left.doc), content: clone(left.doc.content.slice(cut)) }, parsed: { meta: envelope.createDefaultDocumentMeta(), cards: [], hasMetaBlock: true } });
    part(left, 0, cut, outputs[0], 0, 0); part(left, cut, left.doc.content.length, outputs[1], 0, 0);
  } else {
    const right = sources[1];
    const attrs = doc => { const a = { ...(doc.attrs || {}) }; delete a.wordUserBookmarks;
      if (a.wordPendingRevisions == null) delete a.wordPendingRevisions; return a; };
    need(same(attrs(left.doc), attrs(right.doc)), 'E_TREE_TOPOLOGY_DOCUMENT_ATTRS');
    const combineMeta = (a, b, defaults) => {
      if (same(a, b) || same(b, defaults)) return clone(a);
      if (same(a, defaults)) return clone(b);
      need(a && b && typeof a === 'object' && typeof b === 'object', 'E_TREE_TOPOLOGY_METADATA_CONFLICT');
      return Object.fromEntries(Object.keys(defaults).map(key => [key, combineMeta(a[key], b[key], defaults[key])]));
    };
    const parsed = { ...left.parsed, hasMetaBlock: left.parsed.hasMetaBlock || right.parsed.hasMetaBlock,
      meta: combineMeta(left.parsed.meta, right.parsed.meta, envelope.createDefaultDocumentMeta()), cards: [...left.parsed.cards, ...right.parsed.cards] };
    outputs.push({ nodeId: left.nodeId, relativePath: target(left.relativePath),
      doc: { ...clone(left.doc), content: clone([...left.doc.content, ...right.doc.content]) }, parsed });
    part(left, 0, left.doc.content.length, outputs[0], 0, 0);
    part(right, 0, right.doc.content.length, outputs[0], left.doc.content.length, left.leaves.length);
  }
  const locate = (relative, leaf) => partitions.find(p => p.sourceRelativePath === relative && leaf >= p.leafFrom && leaf < p.leafTo);
  for (const output of outputs) {
    const records = []; let revision = 0, hasRegistry = false;
    for (const source of sources) {
      const registry = bookmarks.readRegistry(source.doc); if (!registry) continue;
      hasRegistry = true; revision = Math.max(revision, registry.revision);
      for (const record of registry.bookmarks) {
        if (record.state === 'deleted') { if (output === outputs[0]) records.push(clone(record)); continue; }
        const start = locate(source.relativePath, record.start.paragraphIndex), end = locate(source.relativePath, record.end.paragraphIndex);
        need(start && end && start.targetRelativePath === end.targetRelativePath, 'E_TREE_TOPOLOGY_BOOKMARK_CROSSING');
        if (start.targetRelativePath !== output.relativePath) continue;
        const rebound = clone(record);
        for (const edge of ['start','end']) rebound[edge].paragraphIndex += start.targetLeafFrom - start.leafFrom;
        records.push(rebound);
      }
    }
    if (hasRegistry) output.doc.attrs = { ...(output.doc.attrs || {}), wordUserBookmarks: { schemaVersion: bookmarks.SCHEMA, revision, bookmarks: records } };
    const registry = bookmarks.readRegistry(output.doc);
    const walk = node => {
      for (const mark of node.marks || []) if (mark.type === 'link') bookmarks.inspectInternalLink(mark, registry);
      for (const child of node.content || []) walk(child);
    }; walk(output.doc);
    output.raw = envelope.composeObservablePayload({ ...output.parsed, metaEnabled: output.parsed.hasMetaBlock, doc: output.doc });
    validateInventory([{ relativePath: output.relativePath, role: 'scene', contentBase64: b64(output.raw) }]);
    output.leafTexts = bookmarks.paragraphs(output.doc).map(bookmarks.textOf); output.visible = output.leafTexts.join('\n');
  }
  const publication = source => {
    const output = outputs[0];
    return { beforeNodeId: source.nodeId, afterNodeId: output.nodeId, fromRelativePath: source.relativePath,
      toRelativePath: output.relativePath, beforeContent: source.raw, afterContent: output.raw, kind: input.operation };
  };
  return { sources, outputs, partitions, locate, publications: sources.map(publication),
    receipts: outputs.map(output => ({ targetRelativePath: output.relativePath,
      sourceRelativePaths: [...new Set(partitions.filter(p => p.targetRelativePath === output.relativePath).map(p => p.sourceRelativePath))] })) };
}
function topologyNote(note, topology, identityMap) {
  const source = topology.sources.find(s => s.relativePath === noteScene(note)); if (!source) return null;
  let partition = topology.partitions.find(p => p.sourceRelativePath === source.relativePath);
  if (note.manuscript && !note.deleted) {
    const reference = note.manuscript.reference;
    need(reference.sourceTextSha256 === notesModel.sha(source.visible) && notesModel.boundary(source.visible, reference.offsetUtf16), 'E_TREE_COHORT_NOTE_STALE');
    let start = 0, leaf = 0;
    for (; leaf < source.leafTexts.length - 1 && reference.offsetUtf16 > start + source.leafTexts[leaf].length; leaf++) start += source.leafTexts[leaf].length + 1;
    partition = topology.locate(source.relativePath, leaf); need(partition, 'E_TREE_TOPOLOGY_NOTE_OWNER');
  }
  const output = topology.outputs.find(o => o.relativePath === partition.targetRelativePath);
  const out = rebindNote(note, output.relativePath, { ...identityMap, [source.nodeId]: output.nodeId });
  if (note.manuscript && !note.deleted) {
    const prefix = (values, count) => values.slice(0, count).reduce((n, value) => n + value.length + 1, 0);
    out.manuscript.reference.offsetUtf16 += prefix(output.leafTexts, partition.targetLeafFrom) - prefix(source.leafTexts, partition.leafFrom);
    out.manuscript.reference.sourceTextSha256 = notesModel.sha(output.visible);
    need(notesModel.boundary(output.visible, out.manuscript.reference.offsetUtf16), 'E_TREE_TOPOLOGY_NOTE_OWNER');
  }
  return out;
}
function validateTreeCommentAnchor(thread, paragraphs) {
  const anchor = thread.anchor;
  need(anchor?.sceneId === thread.sceneId, 'E_TREE_COHORT_COMMENT_ANCHOR');
  const structuralHistory = thread.anchorEditHistory?.some(entry => entry.schemaVersion === 2);
  if (structuralHistory && thread.status === 'deleted') {
    const snapshot = commentAnchors.currentStructuralHistorySnapshot(thread);
    need(snapshot, 'E_TREE_COHORT_COMMENT_HISTORY_UNSUPPORTED');
    commentAnchors.validateStructuralSnapshot(snapshot, paragraphs);
    return;
  }
  if (anchor.kind === commentRanges.MULTI) {
    // Historical ranges need their own topology proof. Never infer an owner
    // for an old range from the current first leaf or resurrect a tombstone.
    need(thread.status !== 'deleted' && (structuralHistory || !(thread.anchorEditHistory?.length)), 'E_TREE_COHORT_COMMENT_HISTORY_UNSUPPORTED');
    commentRanges.validateCommentAnchor({ sceneId: thread.sceneId, paragraphs, anchor });
    return;
  }
  if (thread.status === 'deleted') return;
  const proof = commentsModel.exactAnchor({ paragraphIndex: anchor.sceneParagraphIndex,
    startUtf16: anchor.startUtf16, selectedText: anchor.selectedText,
    ...(anchor.kind === 'point' ? {kind: 'point', affinity: anchor.affinity} : {}) }, thread.sceneId,
  paragraphs.map(row => typeof row === 'string' ? row : row.text));
  need(proof.selectedTextSha256 === anchor.selectedTextSha256 && proof.blockTextSha256 === anchor.blockTextSha256,
    'E_TREE_COHORT_COMMENT_STALE');
}
function topologyComment(thread, topology) {
  const source = topology.sources.find(s => s.relativePath === thread.sceneId); if (!source) return null;
  const anchor = thread.anchor;
  validateTreeCommentAnchor(thread, commentAnchors.paragraphs(source.raw));
  let partition = topology.partitions.find(p => p.sourceRelativePath === source.relativePath);
  if (thread.status !== 'deleted') {
    partition = topology.locate(source.relativePath, anchor.sceneParagraphIndex); need(partition, 'E_TREE_TOPOLOGY_COMMENT_OWNER');
  }
  if (thread.anchorEditHistory?.some(entry => entry.schemaVersion === 2)) {
    // Retained local history has no historical scene-topology authority. A
    // whole-source zero-offset move leaves every old coordinate meaningful;
    // partitioning or shifting it cannot be inferred from the current anchor.
    need(topology.partitions.filter(p => p.sourceRelativePath === source.relativePath).length === 1
      && partition.leafFrom === 0 && partition.leafTo === source.leafTexts.length
      && partition.targetLeafFrom === 0, 'E_TREE_COHORT_COMMENT_HISTORY_UNSUPPORTED');
  }
  const out = clone(thread); out.sceneId = partition.targetRelativePath; out.anchor.sceneId = out.sceneId;
  if (anchor.kind === commentRanges.MULTI && thread.status !== 'deleted') {
    for (let index = anchor.sceneParagraphIndex; index <= anchor.endSceneParagraphIndex; index++) {
      need(topology.locate(source.relativePath, index) === partition, 'E_TREE_TOPOLOGY_COMMENT_RANGE_CROSSES_SCENES');
    }
    const output = topology.outputs.find(o => o.relativePath === partition.targetRelativePath);
    const delta = partition.targetLeafFrom - partition.leafFrom;
    const proved = commentRanges.deriveCommentAnchor({ sceneId: out.sceneId, paragraphs: commentAnchors.paragraphs(output.raw),
      input: { kind: commentRanges.MULTI, paragraphIndex: anchor.sceneParagraphIndex + delta, startUtf16: anchor.startUtf16,
        endParagraphIndex: anchor.endSceneParagraphIndex + delta, endUtf16: anchor.endUtf16, selectedText: anchor.selectedText } });
    need(proved.coveredParagraphsSha256 === anchor.coveredParagraphsSha256, 'E_TREE_COHORT_COMMENT_STALE');
    out.anchor = { ...out.anchor, ...proved };
  } else if (thread.status !== 'deleted') {
    out.anchor.sceneParagraphIndex += partition.targetLeafFrom - partition.leafFrom;
    out.anchor.paragraphIndex = out.anchor.sceneParagraphIndex;
  }
  return out;
}

// Recovery consumes one removed-copy beforeimage, never a caller-provided graph.
function recoveredCopySource(input) {
  const recovery = input.recoveredCopy;
  if (recovery === undefined) return null;
  const topologyRecovery = recovery && Object.hasOwn(recovery, 'sourceNodeId');
  const afterImage = topologyRecovery && recovery.sourceImage === 'after';
  need(recovery && Object.keys(recovery).sort().join(',') === (topologyRecovery
    ? afterImage ? 'receipt,retainedPacket,sourceImage,sourceNodeId,workingContent' : 'receipt,retainedPacket,sourceNodeId,workingContent'
    : 'receipt,removedNodeId,retainedPacket,workingContent'), 'E_TREE_RECOVERY_INPUT');
  const originNodeId = topologyRecovery ? recovery.sourceNodeId : recovery.removedNodeId;
  const { receipt, retainedPacket: packet } = recovery;
  let retained = packet, depth = 0;
  while (retained?.plan?.input?.recoveredCopy) {
    need(++depth <= 8, 'E_TREE_RECOVERY_CHAIN_BUDGET');
    retained = retained.plan.input.recoveredCopy.retainedPacket;
  }
  need(Buffer.byteLength(stable(packet)) <= TREE_COHORT_LIMITS.bytes, 'E_TREE_COHORT_BUDGET');
  need(input.operation === 'copy' && input.bindings?.length === 1 && (input.bindings[0].copy === undefined || input.bindings[0].copy === true) && ['undo', 'copy', ...(topologyRecovery ? ['split', 'merge'] : [])].includes(receipt?.kind)
    && receipt.projectId === input.projectId && packet?.projectId === input.projectId
    && receipt.treeRevision === input.expectedTreeRevision && packet.transactionId === receipt.transactionId
    && sha(stable(packet)) === receipt.packetDigest && packet.plan?.kind === receipt.kind
    && packet.manifestPath === input.manifestPath, 'E_TREE_RECOVERY_BINDING');
  validateProjectTreeCohort(packet.plan);
  let sourcePath, livePath, graphOriginNodeId = originNodeId;
  if (receipt.kind === 'copy') {
    const previous = packet.plan.input.recoveredCopy, copied = packet.plan.pathBindings.filter(x => x.copy);
    need(previous && Object.hasOwn(previous, 'sourceNodeId') === topologyRecovery
      && (topologyRecovery ? previous.sourceNodeId : previous.removedNodeId) === originNodeId && copied.length === 1
      && copied[0].newNodeId === input.bindings[0].nodeId
      && copied[0].toRelativePath === input.bindings[0].fromRelativePath, 'E_TREE_RECOVERY_SOURCE');
    if (!afterImage) {
      const original = recoveredCopySource({ ...packet.plan.input,
        recoveredCopy: { ...previous, workingContent: recovery.workingContent } });
      return { ...original, livePath: copied[0].toRelativePath };
    }
    sourcePath = livePath = copied[0].toRelativePath; graphOriginNodeId = copied[0].newNodeId;
  } else if (topologyRecovery) {
    need(['split','merge'].includes(receipt.kind) || (receipt.kind === 'undo'
      && ['split','merge'].includes(packet.plan.input.retainedPacket?.plan?.kind)), 'E_TREE_RECOVERY_SOURCE');
    const rows = packet.plan.scenePublications?.filter(row => row.beforeNodeId === originNodeId) || [];
    need(rows.length === 1, 'E_TREE_RECOVERY_SOURCE');
    const row = rows[0];
    need(input.bindings[0].nodeId === row.afterNodeId && input.bindings[0].fromRelativePath === row.toRelativePath, 'E_TREE_RECOVERY_SOURCE');
    sourcePath = afterImage ? row.toRelativePath : row.fromRelativePath; livePath = row.toRelativePath;
    if (afterImage) graphOriginNodeId = row.afterNodeId;
  } else {
    const binding = packet.plan.pathBindings.find(x => x.removedCopy && x.nodeId === originNodeId);
    need(binding && input.bindings[0].nodeId === binding.newNodeId
      && input.bindings[0].fromRelativePath === binding.toRelativePath
      && input.bindings[0].toRelativePath !== binding.fromRelativePath, 'E_TREE_RECOVERY_SOURCE');
    sourcePath = binding.fromRelativePath; livePath = binding.toRelativePath;
  }
  const entry = packet.entries.find(x => x.role === 'scene' && x.relativePath === sourcePath);
  const side = afterImage ? 'afterBase64' : 'beforeBase64';
  need(entry && typeof entry[side] === 'string' && (topologyRecovery || entry.afterBase64 === null), 'E_TREE_RECOVERY_SOURCE');
  validateInventory([{ relativePath: entry.relativePath, role: 'scene', contentBase64: entry[side] }]);
  const raw = text(entry[side]), before = parsedScene(raw);
  need(typeof recovery.workingContent === 'string' && Buffer.byteLength(recovery.workingContent) <= TREE_COHORT_LIMITS.bytes
    && Buffer.from(recovery.workingContent).toString('utf8') === recovery.workingContent, 'E_TREE_RECOVERY_INPUT');
  const working = envelope.parseObservablePayload(recovery.workingContent);
  need(!working.issue, 'E_TREE_COHORT_SCENE_INVALID');
  const beforeDoc = before.doc || envelope.buildParagraphDocumentFromText(before.text);
  const workingDoc = working.doc || envelope.buildParagraphDocumentFromText(working.text);
  const saved = bookmarks.planSave({ beforeDoc, workingDoc });
  need(same(pending.readLedger(beforeDoc), pending.readLedger(saved.doc)), 'E_TREE_RECOVERY_LEDGER_CHANGED');
  need(same(mediaModel.mediaPlacements(beforeDoc), mediaModel.mediaPlacements(saved.doc)), 'E_TREE_RECOVERY_MEDIA_CHANGED');
  const content = envelope.composeObservablePayload({ ...working, metaEnabled: working.hasMetaBlock, doc: saved.doc });
  const retainedText = role => text(packet.entries.find(x => x.role === role)?.[side] ?? null);
  let notesText = retainedText('notes'), commentsText = retainedText('comments');
  const args = { projectId: input.projectId, sceneId: entry.relativePath, beforeContent: raw, afterContent: content };
  if (notesText !== null) notesText = notesModel.planManuscriptNoteAnchorSave({ ...args, beforeText: notesText })?.afterText || notesText;
  if (commentsText !== null) commentsText = commentAnchors.planCommentAnchorSave({ ...args, beforeText: commentsText })?.afterText || commentsText;
  return { relativePath: entry.relativePath, content, originalBase64: entry[side],
    commitBase64: packet.entries.find(x => x.role === 'sceneCommit' && x.relativePath === entry.relativePath + '.wp201-commit.json')?.[side] ?? null,
    notesText, commentsText, livePath, originNodeId: graphOriginNodeId };
}

export function planProjectTreeCohort(input) {
  need(input && typeof input === 'object');
  need(typeof input.projectId === 'string' && input.projectId.length > 0 && input.projectId.length <= 128
    && typeof input.operationId === 'string' && /^[A-Za-z0-9._:-]{1,128}$/u.test(input.operationId), 'E_TREE_COHORT_IDENTITY');
  need(['rename', 'move', 'reorder', 'copy', 'split', 'merge'].includes(input.operation), 'E_TREE_COHORT_OPERATION');
  need(typeof input.manifestPath === 'string' && path.isAbsolute(input.manifestPath) && typeof input.beforeManifestText === 'string');
  need(Number.isSafeInteger(input.expectedTreeRevision ?? 0) && (input.expectedTreeRevision ?? 0) >= 0, 'E_TREE_REVISION_CAS');
  const manifest = JSON.parse(input.beforeManifestText);
  need(manifest.projectId === input.projectId, 'E_TREE_COHORT_PROJECT');
  const registry = normalizeProjectTreeIdentity(manifest.treeIdentity); need(registry.ok, 'E_TREE_COHORT_IDENTITY');
  const recovery = recoveredCopySource(input);
  const inventory = validateInventory(input.inventory), files = new Map([...inventory].filter(([, x]) => x.role !== 'directory'));
  need(Array.isArray(input.bindings), 'E_TREE_COHORT_BINDINGS');
  const bindings = input.bindings.map(binding => {
    treeRelativePath(binding.fromRelativePath); treeRelativePath(binding.toRelativePath);
    need(binding.fromRelativePath.startsWith('roman/') && binding.toRelativePath.startsWith('roman/'), 'E_TREE_COHORT_SCOPE');
    return { ...binding, copy: binding.copy ?? input.operation === 'copy' };
  });
  const identities = planProjectTreeIdentityCohort({ ...input, registry: registry.value, bindings });
  need(identities.ok, identities.error?.code || 'E_TREE_COHORT_IDENTITY');
  const mapped = relative => bindings.find(b => matches(relative, b.fromRelativePath));
  const target = (relative, binding = mapped(relative)) => binding ? binding.toRelativePath + relative.slice(binding.fromRelativePath.length) : relative;
  const topology = prepareTopology(input, files, identities, target, inventory);
  for (const binding of bindings) need(inventory.has(binding.fromRelativePath), 'E_TREE_COHORT_SOURCE_MISSING');
  const scenes = [...files.values()].filter(x => x.role === 'scene');
  need(scenes.length <= TREE_COHORT_LIMITS.scenes, 'E_TREE_COHORT_BUDGET');
  const sceneMap = {}, affectedScenes = [], occupiedNames = new Set();
  for (const scene of scenes) {
    const parsed = parsedScene(text(scene.contentBase64));
    for (const mark of bookmarks.readRegistry(parsed.doc || { type: 'doc', content: [] })?.bookmarks || []) occupiedNames.add(bookmarks.nameKey(mark.name));
    if (topology?.sources.some(s => s.relativePath === scene.relativePath)) continue;
    const binding = mapped(scene.relativePath);
    if (!binding || (!binding.copy && scene.relativePath === target(scene.relativePath))) continue;
    const to = target(scene.relativePath);
    sceneMap[scene.relativePath] = { to, copy: binding.copy };
    affectedScenes.push({ from: scene.relativePath, to, copy: binding.copy });
  }
  const noteIds = {}, bookmarkIds = {}, threadIds = {}, messageIds = {};
  const notesBefore = input.notesText ?? null, commentsBefore = input.commentsText ?? null;
  need(notesBefore === null || typeof notesBefore === 'string'); need(commentsBefore === null || typeof commentsBefore === 'string');
  let notesAfter = notesBefore, commentsAfter = commentsBefore;
  if (notesBefore !== null || recovery?.notesText !== null && recovery?.notesText !== undefined) {
    const notes = notesBefore !== null ? JSON.parse(notesBefore) : { ...JSON.parse(recovery.notesText), notes: [] }; notesModel.validateManuscriptDocument(notes, input.projectId);
    const ids = new Set();
    for (const note of notes.notes) { need(typeof note.id === 'string' && !ids.has(note.id), 'E_TREE_COHORT_NOTE_ID'); ids.add(note.id); }
    const additions = [];
    const sourceNotes = recovery ? (recovery.notesText === null ? [] : notesModel.validateManuscriptDocument(JSON.parse(recovery.notesText), input.projectId).notes.filter(n => noteScene(n) === recovery.relativePath)) : notes.notes;
    const result = sourceNotes.map(note => {
      if (topology) { const rebound = topologyNote(note, topology, identities.identityMap); if (rebound) return rebound; }
      const mapping = sceneMap[recovery ? recovery.livePath : noteScene(note)]; if (!mapping) return note;
      if (note.manuscript && !note.deleted) {
        const sceneContent = recovery ? recovery.content : text(files.get(noteScene(note))?.contentBase64 ?? null);
        need(typeof sceneContent === 'string', 'E_TREE_COHORT_NOTE_OWNER');
        const visible = notesModel.sceneText(sceneContent), reference = note.manuscript.reference;
        need(reference.sourceTextSha256 === notesModel.sha(visible) && notesModel.boundary(visible, reference.offsetUtf16), 'E_TREE_COHORT_NOTE_STALE');
      }
      if (!mapping.copy) return rebindNote(note, mapping.to, identities.identityMap);
      const id = newId('note-', input, note.id); need(!ids.has(id), 'E_TREE_COHORT_NOTE_ID'); ids.add(id); noteIds[note.id] = id;
      additions.push(rebindNote(note, mapping.to, recovery ? { ...identities.identityMap, [recovery.originNodeId]: identities.identityMap[input.bindings[0].nodeId] } : identities.identityMap, id)); return note;
    });
    const next = { ...notes, notes: [...(recovery ? notes.notes : result), ...additions] }; notesModel.validateManuscriptDocument(next, input.projectId);
    if (!same(next, notes)) notesAfter = json(next);
  }
  if (commentsBefore !== null || recovery?.commentsText !== null && recovery?.commentsText !== undefined) {
    const before = commentsBefore !== null ? commentsModel.readState(commentsBefore, input.projectId) : { ...commentsModel.readState(recovery.commentsText, input.projectId), threads: [] };
    const next = clone(before), additions = [];
    const sourceThreads = recovery ? (recovery.commentsText === null ? [] : commentsModel.readState(recovery.commentsText, input.projectId).threads.filter(t => t.sceneId === recovery.relativePath)) : before.threads;
    for (let i = 0; i < sourceThreads.length; i++) {
      const thread = sourceThreads[i];
      if (topology) { const rebound = topologyComment(thread, topology); if (rebound) { next.threads[i] = rebound; continue; } }
      const mapping = sceneMap[recovery ? recovery.livePath : thread.sceneId]; if (!mapping) continue;
      validateTreeCommentAnchor(thread, commentAnchors.paragraphs(recovery ? recovery.content : text(files.get(thread.sceneId).contentBase64)));
      const changed = clone(thread); changed.sceneId = mapping.to; changed.anchor.sceneId = mapping.to;
      if (mapping.copy) {
        changed.threadId = newId('local-comment-', input, thread.threadId); threadIds[thread.threadId] = changed.threadId;
        for (const message of [...changed.messages, ...(changed.deletedMessages || [])]) {
          const old = message.commentId; message.commentId = newId('local-reply-', input, `${thread.threadId}:${old}`); messageIds[old] = message.commentId;
        }
        need(messageIds[thread.rootCommentId], 'E_TREE_COHORT_COMMENT_ROOT'); changed.rootCommentId = messageIds[thread.rootCommentId]; additions.push(changed);
      } else next.threads[i] = changed;
    }
    next.threads.push(...additions);
    if (!same(next, before)) { next.revision++; commentsAfter = json(next); commentsModel.readState(commentsAfter, input.projectId); }
  }
  // Rebind recognized history by owner, not by a global string replacement.
  const ownerOf = item => {
    if (item.role === 'sceneCommit') return item.relativePath.replace(/\.(?:wp201-)?commit\.json$/u, '');
    if (item.role === 'recoverySnapshot') {
      const base = path.posix.basename(item.relativePath).slice(1).replace(/\.bak\.\d{13}$/u, '');
      return path.posix.join(path.posix.dirname(item.relativePath), base);
    }
    if (['backupMetadata', 'backupSnapshot'].includes(item.role)) {
      const metadata = files.get(path.posix.dirname(item.relativePath) + '/meta.json'); need(metadata?.role === 'backupMetadata', 'E_TREE_COHORT_HISTORY_OWNER');
      const value = JSON.parse(text(metadata.contentBase64));
      need(typeof value.originalPath === 'string' && path.isAbsolute(value.originalPath), 'E_TREE_COHORT_HISTORY_OWNER');
      const relative = path.relative(path.dirname(input.manifestPath), value.originalPath).split(path.sep).join('/');
      treeRelativePath(relative); need(files.get(relative)?.role === 'scene'
        && path.posix.dirname(item.relativePath) === `backups/${sha(value.originalPath)}`, 'E_TREE_COHORT_HISTORY_OWNER');
      return relative;
    }
    return item.relativePath;
  };
  const afterFiles = new Map();
  const put = (relative, role, contentBase64) => {
    need(!afterFiles.has(relative), 'E_TREE_COHORT_COLLISION');
    afterFiles.set(relative, { relativePath: relative, role, contentBase64 });
  };
  for (const item of files.values()) {
    const owner = ownerOf(item);
    if (topology?.sources.some(s => s.relativePath === owner)) {
      const kept = topology.outputs.find(o => o.nodeId === topology.sources.find(s => s.relativePath === owner).nodeId);
      if (item.role === 'scene') continue;
      if (!kept) continue; // Beforeimages retain merged-away history for exact Undo.
      // Existing left-side history remains with its owner; content checkpoints are historical.
      if (kept.relativePath === owner) { put(item.relativePath, item.role, item.contentBase64); continue; }
    }
    const topologyOwner = topology?.sources.find(s => s.relativePath === owner);
    const mapping = sceneMap[owner] || (topologyOwner ? { to: topology.outputs.find(o => o.nodeId === topologyOwner.nodeId).relativePath, copy: false } : null), binding = mapped(item.relativePath);
    if (mapping?.copy || (!mapping && !binding)) put(item.relativePath, item.role, item.contentBase64);
    if (mapping?.copy && item.role !== 'scene') continue; // Fork has a fresh checkpoint, never source history.
    if (!mapping && !binding) continue;
    let to = target(item.relativePath), content = item.contentBase64;
    if (mapping) {
      if (item.role === 'scene') { to = mapping.to; if (mapping.copy) content = b64(forkScene(recovery ? recovery.content : text(content), input, recovery ? recovery.relativePath : owner, noteIds, occupiedNames, bookmarkIds)); }
      else if (item.role === 'sceneCommit') to = mapping.to + item.relativePath.slice(owner.length);
      else if (item.role === 'recoverySnapshot') to = path.posix.join(path.posix.dirname(mapping.to), '.' + path.posix.basename(mapping.to) + path.posix.basename(item.relativePath).match(/\.bak\.\d{13}$/u)[0]);
      else {
        const absolute = path.join(path.dirname(input.manifestPath), mapping.to), directory = `backups/${sha(absolute)}`;
        if (item.role === 'backupMetadata') { to = directory + '/meta.json'; content = b64(JSON.stringify({ ...JSON.parse(text(content)), originalPath: absolute, baseName: path.basename(absolute) }, null, 2)); }
        else to = directory + '/' + path.posix.basename(item.relativePath).slice(0, 14) + path.posix.basename(mapping.to);
      }
    }
    put(to, item.role, content);
  }
  if (topology) for (const output of topology.outputs) {
    put(output.relativePath, 'scene', b64(output.raw));
    affectedScenes.push(...topology.sources.filter(s => topology.partitions.some(p => p.sourceRelativePath === s.relativePath && p.targetRelativePath === output.relativePath)).map(s => ({ from: s.relativePath, to: output.relativePath, copy: false })));
  }
  const manifestText = identities.changed ? json({ ...manifest, treeIdentity: identities.value }) : input.beforeManifestText;
  // A destination starts at one current readable checkpoint. Imported Word
  // rounds in its ledger remain inert history, never copied local authority.
  const stamp = String(Date.parse(input.now || '')).padStart(13, '0');
  for (const item of affectedScenes.filter(x => x.copy)) {
    need(/^\d{13}$/u.test(stamp), 'E_TREE_COHORT_TIME');
    put(path.posix.join(path.posix.dirname(item.to), '.' + path.posix.basename(item.to) + '.bak.' + stamp), 'recoverySnapshot', afterFiles.get(item.to).contentBase64);
  }
  const beforeDirs = new Set([...inventory.values()].filter(x => x.role === 'directory').map(x => x.relativePath));
  const afterDirs = new Set();
  for (const relative of beforeDirs) { const binding = mapped(relative); if (!binding || binding.copy) afterDirs.add(relative); if (binding) afterDirs.add(target(relative)); }
  for (const relative of afterFiles.keys()) {
    let dir = path.posix.dirname(relative);
    while (dir !== '.') { afterDirs.add(dir); dir = path.posix.dirname(dir); }
  }
  // Historical backup directories follow the scene, including empty ownership
  // folders; remove only those emptied by this typed plan.
  for (const directory of [...afterDirs]) if (/^backups\/[a-f0-9]{64}$/u.test(directory)
    && ![...afterFiles.keys()].some(x => x.startsWith(directory + '/'))) afterDirs.delete(directory);
  const entries = [...new Set([...files.keys(), ...afterFiles.keys()])].sort().map(relativePath => ({ relativePath,
    role: (afterFiles.get(relativePath) || files.get(relativePath)).role,
    beforeBase64: files.get(relativePath)?.contentBase64 ?? null, afterBase64: afterFiles.get(relativePath)?.contentBase64 ?? null }));
  entries.push({ relativePath: NOTE_PATH, role: 'notes', beforeBase64: b64(notesBefore), afterBase64: b64(notesAfter) },
    { relativePath: COMMENT_PATH, role: 'comments', beforeBase64: b64(commentsBefore), afterBase64: b64(commentsAfter) });
  const changed = manifestText !== input.beforeManifestText || entries.some(x => x.beforeBase64 !== x.afterBase64);
  const plan = { ...(topology ? { scenePartitions: topology.partitions, scenePublications: topology.publications,
    sceneReceiptSources: topology.receipts, createdNodeIds: identities.createdNodeIds, removedNodeIds: identities.removedNodeIds } : {}), mode: TREE_COHORT_MODE, projectId: input.projectId, operationId: input.operationId,
    expectedTreeRevision: input.expectedTreeRevision ?? 0, kind: input.operation, changed,
    code: changed ? 'TREE_COHORT_READY' : 'TREE_COHORT_UNCHANGED', beforeManifestText: input.beforeManifestText, manifestText,
    entries, directories: [...new Set([...beforeDirs, ...afterDirs])].sort().map(relativePath => ({ relativePath, before: beforeDirs.has(relativePath), after: afterDirs.has(relativePath) })),
    ...(recovery ? { recoverySource: { relativePath: recovery.relativePath, originalBase64: recovery.originalBase64, commitBase64: recovery.commitBase64 } } : {}),
    affectedScenes, pathBindings: Object.entries(identities.identityMap).map(([nodeId, newNodeId]) => ({ nodeId, newNodeId,
      fromRelativePath: registry.value.nodes[nodeId].bindingKey.slice(5), toRelativePath: identities.value.nodes[newNodeId].bindingKey.slice(5),
      copy: mapped(registry.value.nodes[nodeId].bindingKey.slice(5))?.copy === true })),
    identityMap: { nodes: identities.identityMap, scenes: sceneMap, notes: noteIds, bookmarks: bookmarkIds, threads: threadIds, messages: messageIds },
    input: clone(input) };
  plan.planDigest = sha(stable(plan));
  need(Buffer.byteLength(stable(plan)) <= TREE_COHORT_LIMITS.bytes, 'E_TREE_COHORT_BUDGET');
  return frozen(plan);
}

// Reuses the existing journal/recovery writer. Story edits do not mutate tree
// identity, manuscript text, annotations, or the manifest.
export function planProjectStoryBodyCohort(input) {
  need(input && input.operation === 'story-bodies', 'E_STORY_COHORT_OPERATION');
  need(typeof input.projectId === 'string' && input.projectId.length > 0 && input.projectId.length <= 128
    && typeof input.operationId === 'string' && /^[A-Za-z0-9._:-]{1,128}$/u.test(input.operationId), 'E_TREE_COHORT_IDENTITY');
  need(typeof input.manifestPath === 'string' && path.isAbsolute(input.manifestPath)
    && typeof input.beforeManifestText === 'string' && JSON.parse(input.beforeManifestText).projectId === input.projectId, 'E_TREE_COHORT_PROJECT');
  need(Number.isSafeInteger(input.expectedTreeRevision) && input.expectedTreeRevision >= 0, 'E_TREE_REVISION_CAS');
  need(Array.isArray(input.changes) && input.changes.length > 0 && input.changes.length <= TREE_COHORT_LIMITS.scenes, 'E_STORY_COHORT_BUDGET');
  const entries = [], affectedScenes = [], seen = new Set(), storyAssets = new Map();
  for (const change of input.changes) {
    const relativePath = treeRelativePath(change.sceneId);
    need(relativePath.startsWith('roman/') && /\.(?:txt|md)$/iu.test(relativePath) && !seen.has(relativePath), 'E_STORY_COHORT_PATH'); seen.add(relativePath);
    need(typeof change.beforeContent === 'string' && typeof change.afterContent === 'string'
      && (change.commitText === null || typeof change.commitText === 'string'), 'E_STORY_COHORT_CONTENT');
    const before = parsedScene(change.beforeContent), after = parsedScene(change.afterContent);
    need((after.doc || change.beforeContent === change.afterContent) && same([before.meta,before.cards,before.hasMetaBlock],[after.meta,after.cards,after.hasMetaBlock]), 'E_STORY_COHORT_CONTENT');
    // Replay against authored plain paragraphs, not normalized display text.
    // Metadata and cards remain outside the manuscript projection.
    const beforeDoc=before.doc || envelope.buildParagraphDocumentFromText(!before.hasMetaBlock && !before.hasCardsBlock ? change.beforeContent : before.text);
    const afterDoc=after.doc || envelope.buildParagraphDocumentFromText(!after.hasMetaBlock && !after.hasCardsBlock ? change.afterContent : after.text);
    if(change.storyMutationReplay)need(same(replayDocumentStoryMutationSteps(beforeDoc,change.storyMutationReplay),afterDoc),'E_STORY_COHORT_INTENT');
    else storyModel.validateSave(beforeDoc, afterDoc);
    for (const asset of mediaData.documentMedia({type:'doc',content:storyModel.read(afterDoc)?.stories.flatMap(story=>story.body.content) || []}).assets) {
      const existing=storyAssets.get(asset.attrs.assetPath);
      need(!existing || existing===asset.attrs.dataBase64,'E_STORY_COHORT_ASSET_CONFLICT');
      storyAssets.set(asset.attrs.assetPath,asset.attrs.dataBase64);
    }
    const restored = clone(afterDoc);
    if(beforeDoc.attrs?.wordStories !== undefined) {restored.attrs={...restored.attrs,wordStories:clone(beforeDoc.attrs.wordStories)};}
    else if(restored.attrs)delete restored.attrs.wordStories;
    if(!change.storyMutationReplay)need(same(restored,beforeDoc), 'E_STORY_COHORT_BODY_ONLY');
    entries.push({relativePath,role:'scene',beforeBase64:b64(change.beforeContent),afterBase64:b64(change.afterContent)},
      {relativePath:relativePath+'.wp201-commit.json',role:'sceneCommit',beforeBase64:b64(change.commitText),afterBase64:b64(change.commitText)});
    if(!same(beforeDoc,afterDoc))affectedScenes.push({from:relativePath,to:relativePath,copy:false});
  }
  for (const [role,relativePath,value] of [['notes',NOTE_PATH,input.notesText],['comments',COMMENT_PATH,input.commentsText]]) {
    need(value === null || typeof value === 'string', 'E_STORY_COHORT_ANNOTATIONS');
    if(value!==null) { if(role==='notes')notesModel.validateManuscriptDocument(JSON.parse(value),input.projectId);else commentsModel.readState(value,input.projectId); }
    entries.push({relativePath,role,beforeBase64:b64(value),afterBase64:b64(value)});
  }
  need(input.mediaResources === undefined || Array.isArray(input.mediaResources),'E_STORY_COHORT_ASSETS');
  const mediaPaths = new Set();
  for (const resource of input.mediaResources || []) {
    need(resource && Object.keys(resource).every(key=>['relativePath','contentBase64'].includes(key))
      && typeof resource.relativePath === 'string' && typeof resource.contentBase64 === 'string'
      && storyAssets.get(resource.relativePath)===resource.contentBase64 && !mediaPaths.has(resource.relativePath),'E_STORY_COHORT_ASSET_BINDING');
    mediaPaths.add(resource.relativePath);
    entries.push({relativePath:treeRelativePath(resource.relativePath),role:'storyMedia',beforeBase64:null,afterBase64:resource.contentBase64});
  }
  need(affectedScenes.length>0,'E_STORY_COHORT_NO_CHANGE');
  const plan = {mode:TREE_COHORT_MODE,projectId:input.projectId,operationId:input.operationId,
    expectedTreeRevision:input.expectedTreeRevision,kind:'story-bodies',changed:true,code:'TREE_COHORT_READY',
    beforeManifestText:input.beforeManifestText,manifestText:input.beforeManifestText,entries,directories:[],
    affectedScenes,pathBindings:[],identityMap:{nodes:{},scenes:{},notes:{},bookmarks:{},threads:{},messages:{}},input:clone(input)};
  plan.planDigest=sha(stable(plan));need(Buffer.byteLength(stable(plan))<=TREE_COHORT_LIMITS.bytes,'E_TREE_COHORT_BUDGET');
  return frozen(plan);
}

// Fixed-topology book return: semantic output is regenerated from the signed
// source and one complete discussion proof, never accepted as caller-written bytes.
export function planProjectMixedWordReturnCohort(input) {
  need(input && Object.keys(input).every(key => ['operation','operationId','projectId','manifestPath','beforeManifestText','expectedTreeRevision','scenes','notesText','commentsText','returnProofJson'].includes(key))
    && input.operation === 'word-mixed-return', 'E_WORD_BOOK_COHORT_OPERATION');
  need(typeof input.projectId === 'string' && input.projectId.length > 0 && input.projectId.length <= 128
    && typeof input.operationId === 'string' && /^[A-Za-z0-9._:-]{1,128}$/u.test(input.operationId), 'E_TREE_COHORT_IDENTITY');
  need(typeof input.manifestPath === 'string' && path.isAbsolute(input.manifestPath)
    && typeof input.beforeManifestText === 'string' && JSON.parse(input.beforeManifestText).projectId === input.projectId, 'E_TREE_COHORT_PROJECT');
  need(Number.isSafeInteger(input.expectedTreeRevision) && input.expectedTreeRevision >= 0, 'E_TREE_REVISION_CAS');
  need(Array.isArray(input.scenes) && input.scenes.length > 1 && input.scenes.length <= TREE_COHORT_LIMITS.scenes, 'E_WORD_BOOK_COHORT_BUDGET');
  let inputBytes=0;
  const count=value=>{need(value===null||typeof value==='string','E_WORD_BOOK_COHORT_SOURCE');if(value!==null)inputBytes+=Buffer.byteLength(value);need(inputBytes<=TREE_COHORT_LIMITS.bytes,'E_TREE_COHORT_BUDGET');};
  [input.beforeManifestText,input.notesText,input.commentsText,input.returnProofJson].forEach(count);
  const seen = new Set();
  for (const scene of input.scenes) {
    need(scene && Object.keys(scene).sort().join(',') === 'beforeContent,commitText,sceneId', 'E_WORD_BOOK_COHORT_SOURCE');
    count(scene.beforeContent);count(scene.commitText);
    const relative = treeRelativePath(scene.sceneId);
    need(relative.startsWith('roman/') && /\.(?:txt|md)$/iu.test(relative) && !seen.has(relative), 'E_WORD_BOOK_COHORT_SOURCE'); seen.add(relative);
    need(typeof scene.beforeContent === 'string' && (scene.commitText === null || typeof scene.commitText === 'string'), 'E_WORD_BOOK_COHORT_SOURCE');
  }
  const semantic = mixedReturn.planMixedBookReturn({beforeText:input.commentsText,projectId:input.projectId,
    scenes:input.scenes.map(({sceneId,beforeContent})=>({sceneId,beforeContent})),returnProofJson:input.returnProofJson,notesText:input.notesText});
  const entries = [], affectedScenes = [];let notesAfter=input.notesText;
  for (const change of semantic.scenes) {
    const scene = input.scenes.find(item=>item.sceneId===change.sceneId);
    entries.push({relativePath:scene.sceneId,role:'scene',beforeBase64:b64(scene.beforeContent),afterBase64:b64(change.content)},
      {relativePath:scene.sceneId+'.wp201-commit.json',role:'sceneCommit',beforeBase64:b64(scene.commitText),afterBase64:b64(scene.commitText)});
    if(change.changed) {
      affectedScenes.push({from:scene.sceneId,to:scene.sceneId,copy:false});
      if(notesAfter!==null) {
        const active=notesModel.validateManuscriptDocument(JSON.parse(notesAfter),input.projectId).notes
          .some(note=>!note.deleted&&note.manuscript?.reference.sceneId===scene.sceneId);
        need(!active||JSON.parse(input.returnProofJson).schemaVersion===4,'PENDING_NOTE_BOOK_CONTEXT_REQUIRED');
        notesAfter=notesModel.planManuscriptNoteAnchorSave({beforeText:notesAfter,projectId:input.projectId,sceneId:scene.sceneId,
          beforeContent:scene.beforeContent,afterContent:change.content})?.afterText||notesAfter;
      }
    }
  }
  need(affectedScenes.length > 0, 'E_WORD_BOOK_COHORT_NO_CHANGE');
  need(input.notesText === null || typeof input.notesText === 'string', 'E_WORD_BOOK_COHORT_ANNOTATIONS');
  if(input.notesText !== null) notesModel.validateManuscriptDocument(JSON.parse(input.notesText),input.projectId);
  entries.push({relativePath:NOTE_PATH,role:'notes',beforeBase64:b64(input.notesText),afterBase64:b64(notesAfter)},
    {relativePath:COMMENT_PATH,role:'comments',beforeBase64:b64(input.commentsText),afterBase64:b64(semantic.afterText)});
  const plan = {mode:TREE_COHORT_MODE,projectId:input.projectId,operationId:input.operationId,
    expectedTreeRevision:input.expectedTreeRevision,kind:'word-mixed-return',changed:true,code:'TREE_COHORT_READY',
    beforeManifestText:input.beforeManifestText,manifestText:input.beforeManifestText,entries,directories:[],
    affectedScenes,pathBindings:[],identityMap:{nodes:{},scenes:{},notes:{},bookmarks:{},threads:{},messages:{}},input:clone(input)};
  plan.planDigest=sha(stable(plan));need(Buffer.byteLength(stable(plan))<=TREE_COHORT_LIMITS.bytes,'E_TREE_COHORT_BUDGET');
  return frozen(plan);
}

export function validateProjectTreeCohort(plan) {
  need(plan?.mode === TREE_COHORT_MODE, 'E_TREE_COHORT_MODE');
  if (plan.kind === 'word-mixed-return') { need(same(planProjectMixedWordReturnCohort(plan.input),plan),'E_TREE_COHORT_PLAN_MISMATCH'); return plan; }
  if (plan.kind === 'story-bodies') { need(same(planProjectStoryBodyCohort(plan.input),plan),'E_TREE_COHORT_PLAN_MISMATCH'); return plan; }
  if (plan.kind === 'undo') {
    const regenerated = planProjectTreeUndo(plan.input); need(same(regenerated, plan), 'E_TREE_COHORT_PLAN_MISMATCH');
  } else need(same(planProjectTreeCohort(plan.input), plan), 'E_TREE_COHORT_PLAN_MISMATCH');
  return plan;
}

export function planProjectTreeUndo(input) {
  const { receipt, retainedPacket: packet } = input;
  need(receipt?.projectId === input.projectId && packet?.projectId === input.projectId
    && receipt.kind !== 'undo' && receipt.kind !== 'word-mixed-return' && receipt.transactionId === input.lastMutation
    && receipt.treeRevision === input.expectedTreeRevision, 'E_TREE_UNDO_UNAVAILABLE');
  need(packet.plan?.kind !== 'undo' && packet.transactionId === receipt.transactionId
    && sha(stable(packet)) === receipt.packetDigest, 'E_TREE_UNDO_PACKET');
  const original = validateProjectTreeCohort(packet.plan);
  need(input.currentManifestText === original.manifestText, 'E_TREE_UNDO_CAS');
  const current = validateInventory(input.currentInventory);
  for (const entry of packet.entries.filter(x => !['notes', 'comments'].includes(x.role))) need((current.get(entry.relativePath)?.contentBase64 ?? null) === entry.afterBase64, 'E_TREE_UNDO_CAS');
  for (const dir of original.directories) need((current.get(dir.relativePath)?.role === 'directory') === dir.after, 'E_TREE_UNDO_CAS');
  const inverse = { mode: TREE_COHORT_MODE, projectId: input.projectId, operationId: input.operationId,
    expectedTreeRevision: input.expectedTreeRevision, kind: 'undo', changed: true, code: 'TREE_COHORT_READY',
    beforeManifestText: original.manifestText, manifestText: original.beforeManifestText,
    entries: packet.entries.map(x => ({ ...x, beforeBase64: x.afterBase64, afterBase64: x.beforeBase64 })),
    directories: original.directories.map(x => ({ ...x, before: x.after, after: x.before })),
    affectedScenes: original.affectedScenes.map(x => ({ from: x.to, to: x.from, copy: false, removedCopy: x.copy })),
    pathBindings: original.pathBindings.map(x => ({ nodeId: x.newNodeId, newNodeId: x.nodeId, fromRelativePath: x.toRelativePath, toRelativePath: x.fromRelativePath, copy: false, removedCopy: x.copy })),
    identityMap: { nodes: Object.fromEntries(Object.entries(original.identityMap.nodes).map(([a,b])=>[b,a])), scenes: {}, notes: {}, bookmarks: {}, threads: {}, messages: {} },
    input: clone(input) };
  if (original.scenePartitions) {
    inverse.scenePartitions = original.scenePartitions.map(p => ({ sourceNodeId: p.targetNodeId,
      sourceRelativePath: p.targetRelativePath, rootFrom: p.targetRootFrom,
      rootTo: p.targetRootFrom + p.rootTo - p.rootFrom, targetNodeId: p.sourceNodeId,
      targetRelativePath: p.sourceRelativePath, targetRootFrom: p.rootFrom,
      leafFrom: p.targetLeafFrom, leafTo: p.targetLeafFrom + p.leafTo - p.leafFrom, targetLeafFrom: p.leafFrom }));
    inverse.scenePublications = [...new Set(original.scenePartitions.map(p => p.targetNodeId))].map(id => {
      const p = inverse.scenePartitions.find(row => row.sourceNodeId === id);
      const before = inverse.entries.find(e => e.role === 'scene' && e.relativePath === p.sourceRelativePath);
      const after = inverse.entries.find(e => e.role === 'scene' && e.relativePath === p.targetRelativePath);
      need(before?.beforeBase64 !== null && after?.afterBase64 !== null, 'E_TREE_UNDO_PACKET');
      return { beforeNodeId: id, afterNodeId: p.targetNodeId, fromRelativePath: p.sourceRelativePath,
        toRelativePath: p.targetRelativePath, beforeContent: text(before.beforeBase64), afterContent: text(after.afterBase64), kind: `undo-${original.kind}` };
    });
    inverse.createdNodeIds = original.removedNodeIds;
    inverse.removedNodeIds = original.createdNodeIds;
    inverse.sceneReceiptSources = []; // Exact original receipts are restored, never regenerated.
  }
  inverse.planDigest = sha(stable(inverse));
  need(Buffer.byteLength(stable(inverse)) <= TREE_COHORT_LIMITS.bytes, 'E_TREE_COHORT_BUDGET');
  return frozen(inverse);
}

export const projectTreeCohortDigest = value => sha(stable(value));
