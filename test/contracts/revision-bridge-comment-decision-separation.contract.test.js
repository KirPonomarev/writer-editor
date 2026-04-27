const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-comment-decision-separation.contract.test.js';
const STATE_PATH = 'docs/OPS/STATUS/RB_V21_AUTOCYCLE_STATE_V1.json';
const ALLOWLIST = [MODULE_PATH, TEST_PATH, STATE_PATH];

async function loadBridge() {
  return import(pathToFileURL(path.join(process.cwd(), MODULE_PATH)).href);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function changedFilesFromGitStatus(statusText) {
  return statusText
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => line.slice(3).replace(/^"|"$/gu, ''));
}

function placement(overrides = {}) {
  return {
    placementId: 'placement-1',
    threadId: 'thread-1',
    targetScope: {
      type: 'scene',
      id: 'scene-1',
    },
    anchor: {
      kind: 'text',
      value: 'anchor-1',
    },
    range: {
      from: 1,
      to: 4,
    },
    quote: 'abc',
    prefix: '',
    suffix: '',
    confidence: 1,
    policy: 'exact',
    selector: {
      type: 'text-position',
      start: 1,
      end: 4,
    },
    resolvedState: 'open',
    acceptedState: 'pending',
    createdAt: '2026-04-27T12:30:00.000Z',
    ...overrides,
  };
}

test('RB-29 exports comment decision separation schema and evaluator', async () => {
  const bridge = await loadBridge();

  assert.equal(
    bridge.REVISION_BRIDGE_COMMENT_DECISION_SEPARATION_SCHEMA,
    'revision-bridge.comment-decision-separation.v1',
  );
  assert.equal(typeof bridge.evaluateRevisionBridgeCommentDecisionSeparation, 'function');
});

test('RB-29 keeps resolved and accepted states orthogonal in evaluation matrix', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeCommentDecisionSeparation({
    commentPlacements: [
      placement({
        placementId: 'placement-1',
        resolvedState: 'resolved',
        acceptedState: 'pending',
      }),
      placement({
        placementId: 'placement-2',
        threadId: 'thread-2',
        resolvedState: 'open',
        acceptedState: 'accepted',
      }),
      placement({
        placementId: 'placement-3',
        threadId: 'thread-3',
        resolvedState: 'resolved',
        acceptedState: 'rejected',
      }),
    ],
  });

  assert.equal(result.status, 'evaluated');
  assert.equal(result.code, 'REVISION_BRIDGE_REVIEWGRAPH_VALID');
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.countsByResolvedState, { open: 1, resolved: 2 });
  assert.deepEqual(result.countsByAcceptedState, {
    pending: 1,
    accepted: 1,
    rejected: 1,
    deferred: 0,
  });
  assert.equal(result.matrix['resolved::pending'], 1);
  assert.equal(result.matrix['open::accepted'], 1);
  assert.equal(result.matrix['resolved::rejected'], 1);
});

test('RB-29 returns invalid diagnostics for malformed placement entries', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeCommentDecisionSeparation({
    commentPlacements: [null, 'bad'],
  });

  assert.equal(result.status, 'invalid');
  assert.equal(result.code, 'E_REVISION_BRIDGE_REVIEWGRAPH_INVALID');
  assert.equal(result.diagnostics.length >= 1, true);
  assert.equal(result.diagnostics.some((item) => item.field === 'commentPlacements.0'), true);
});

test('RB-29 evaluator is deterministic and does not mutate input', async () => {
  const bridge = await loadBridge();
  const input = {
    commentPlacements: [
      placement({ placementId: 'placement-1', resolvedState: 'open', acceptedState: 'accepted' }),
      placement({ placementId: 'placement-2', threadId: 'thread-2', resolvedState: 'resolved', acceptedState: 'pending' }),
    ],
  };
  const before = deepClone(input);
  const first = bridge.evaluateRevisionBridgeCommentDecisionSeparation(input);
  const second = bridge.evaluateRevisionBridgeCommentDecisionSeparation(input);

  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
});

test('RB-29 source section has no forbidden side-effect tokens', () => {
  const source = fs.readFileSync(path.join(process.cwd(), MODULE_PATH), 'utf8');
  const start = source.indexOf('// RB_29_COMMENT_DECISION_SEPARATION_CONTRACTS_START');
  const end = source.indexOf('// RB_29_COMMENT_DECISION_SEPARATION_CONTRACTS_END');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const section = source.slice(start, end);
  const forbiddenTokens = [
    'import',
    'require(',
    'fs',
    'child_process',
    'fetch',
    'XMLHttpRequest',
    'WebSocket',
    'electron',
    'ipcMain',
    'ipcRenderer',
    'Date.now',
    'Math.random',
    'setTimeout',
    'setInterval',
  ];

  for (const token of forbiddenTokens) {
    assert.equal(section.includes(token), false, `${token} must not appear in RB-29 section`);
  }
});

test('RB-29 changed files stay allowlisted and package manifests are untouched', () => {
  const changedFiles = changedFilesFromGitStatus(
    execFileSync('git', ['status', '--porcelain', '-uall'], { encoding: 'utf8' }),
  );
  const outsideAllowlist = changedFiles.filter((filePath) => !ALLOWLIST.includes(filePath));
  const packageManifestDiff = changedFiles.filter((filePath) => filePath === 'package.json' || filePath === 'package-lock.json');

  assert.equal(changedFiles.includes(MODULE_PATH), true);
  assert.equal(changedFiles.includes(TEST_PATH), true);
  assert.deepEqual(outsideAllowlist, []);
  assert.deepEqual(packageManifestDiff, []);
});
