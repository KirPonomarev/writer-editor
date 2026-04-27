const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-structural-ops-manual-review.contract.test.js';
const STATE_PATH = 'docs/OPS/STATUS/RB_V21_AUTOCYCLE_STATE_V1.json';
const ALLOWLIST = [MODULE_PATH, TEST_PATH, STATE_PATH];

async function loadBridge() {
  return import(pathToFileURL(path.join(process.cwd(), MODULE_PATH)).href);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function structuralChange(overrides = {}) {
  return {
    structuralChangeId: 'structural-change-1',
    kind: 'block-move',
    targetScope: {
      type: 'scene',
      id: 'scene-1',
    },
    summary: 'Move paragraph to later position.',
    createdAt: '2026-04-27T16:00:00.000Z',
    ...overrides,
  };
}

function commentPlacement(overrides = {}) {
  return {
    placementId: 'placement-1',
    threadId: 'thread-1',
    targetScope: {
      type: 'scene',
      id: 'scene-1',
    },
    anchor: {
      kind: 'text',
      value: 'block-1',
    },
    range: {
      from: 0,
      to: 5,
    },
    quote: 'Alpha',
    prefix: '',
    suffix: '',
    confidence: 1,
    policy: 'exact',
    createdAt: '2026-04-27T16:01:00.000Z',
    ...overrides,
  };
}

function changedFilesFromGitStatus(statusText) {
  return statusText
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => line.slice(3).replace(/^"|"$/gu, ''));
}

test('RB-33 exports structural ops manual review schema and preview function', async () => {
  const bridge = await loadBridge();

  assert.equal(
    bridge.REVISION_BRIDGE_STRUCTURAL_OPS_MANUAL_REVIEW_SCHEMA,
    'revision-bridge.structural-ops-manual-review.v1',
  );
  assert.equal(typeof bridge.previewRevisionBridgeStructuralOpsManualReview, 'function');
});

test('RB-33 builds manual review operations with blast radius and affected comment counts', async () => {
  const bridge = await loadBridge();
  const result = bridge.previewRevisionBridgeStructuralOpsManualReview({
    structuralChanges: [
      structuralChange({
        structuralChangeId: 'move-1',
        kind: 'block-move',
      }),
      structuralChange({
        structuralChangeId: 'split-1',
        kind: 'split-scene',
        targetScope: {
          type: 'scene',
          id: 'scene-2',
        },
      }),
    ],
    commentPlacements: [
      commentPlacement(),
      commentPlacement({ placementId: 'placement-2', threadId: 'thread-2' }),
      commentPlacement({
        placementId: 'placement-3',
        threadId: 'thread-3',
        targetScope: { type: 'scene', id: 'scene-2' },
      }),
      commentPlacement({
        placementId: 'placement-4',
        threadId: 'thread-4',
        targetScope: { type: 'block', id: 'scene-1' },
      }),
    ],
  });

  assert.equal(result.status, 'evaluated');
  assert.equal(result.code, 'REVISION_BRIDGE_REVIEWGRAPH_VALID');
  assert.equal(result.canApply, false);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.operations.length, 2);
  assert.equal(result.operations[0].blastRadius, 'high');
  assert.equal(result.operations[0].affectedCommentCount, 2);
  assert.equal(result.operations[0].manualOnly, true);
  assert.equal(result.operations[0].diagnosticsOnly, true);
  assert.equal(result.operations[0].beforeAfterPreviewRequired, true);
  assert.equal(result.operations[1].blastRadius, 'high');
  assert.equal(result.operations[1].affectedCommentCount, 1);
});

test('RB-33 rejects malformed entries and missing target scope fields', async () => {
  const bridge = await loadBridge();
  const result = bridge.previewRevisionBridgeStructuralOpsManualReview({
    structuralChanges: [
      null,
      structuralChange({ structuralChangeId: 'broken-1', targetScope: { type: '', id: '' } }),
      structuralChange({ structuralChangeId: 'broken-2', targetScope: { type: 'scene', id: '' } }),
    ],
  });

  assert.equal(result.status, 'invalid');
  assert.equal(result.code, 'E_REVISION_BRIDGE_REVIEWGRAPH_INVALID');
  assert.equal(result.reasons.some((item) => item.field === 'structuralChanges.0'), true);
  assert.equal(result.reasons.some((item) => item.field === 'structuralChanges.1.targetScope.type'), true);
  assert.equal(result.reasons.some((item) => item.field === 'structuralChanges.2.targetScope.id'), true);
});

test('RB-33 preview is deterministic and does not mutate input', async () => {
  const bridge = await loadBridge();
  const input = {
    structuralChanges: [structuralChange()],
    commentPlacements: [commentPlacement()],
  };
  const before = deepClone(input);
  const first = bridge.previewRevisionBridgeStructuralOpsManualReview(input);
  const second = bridge.previewRevisionBridgeStructuralOpsManualReview(input);

  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
});

test('RB-33 source section has no forbidden side-effect tokens', () => {
  const source = fs.readFileSync(path.join(process.cwd(), MODULE_PATH), 'utf8');
  const start = source.indexOf('// RB_33_STRUCTURAL_OPS_MANUAL_REVIEW_CONTRACTS_START');
  const end = source.indexOf('// RB_33_STRUCTURAL_OPS_MANUAL_REVIEW_CONTRACTS_END');
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
    assert.equal(section.includes(token), false, `${token} must not appear in RB-33 section`);
  }
});

test('RB-33 changed files stay allowlisted and package manifests are untouched', () => {
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
