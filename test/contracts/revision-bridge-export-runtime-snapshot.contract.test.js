const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-export-runtime-snapshot.contract.test.js';
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

function validSnapshot() {
  return {
    projectId: 'project-1',
    baselineHash: 'baseline-1',
    docFingerprintPlan: 'doc-fingerprint-1',
    sourceVersion: 'source-v1',
    profileId: 'profile-1',
    content: 'Scene 1',
    plainText: 'Scene 1',
    bookProfile: { formatId: 'A4' },
    sceneOrder: ['scene-1'],
    sceneBaselines: [
      {
        sceneId: 'scene-1',
        sceneHash: 'scene-hash-1',
        sceneStructuralHash: 'scene-struct-1',
        title: 'Scene 1',
        orderIndex: 0,
        sourcePath: 'scene1.md',
        relativePath: 'scenes/scene1.md',
      },
    ],
    blockBaselines: [
      {
        blockInstanceId: 'block-1',
        blockLineageId: 'lineage-1',
        blockVersionHash: 'version-1',
        blockKind: 'paragraph',
        blockOrder: 0,
        blockHash: 'block-hash-1',
        blockTextHash: 'block-text-1',
        blockStructuralHash: 'block-struct-1',
        sceneId: 'scene-1',
      },
    ],
  };
}

function currentEntrypointShape() {
  return {
    content: 'Scene 1',
    plainText: 'Scene 1',
    bookProfile: { formatId: 'A4' },
  };
}

test('RB-34 exports export runtime snapshot readiness schema and evaluators', async () => {
  const bridge = await loadBridge();

  assert.equal(
    bridge.REVISION_BRIDGE_EXPORT_RUNTIME_SNAPSHOT_SCHEMA,
    'revision-bridge.export-runtime-snapshot-readiness.v1',
  );
  assert.equal(typeof bridge.normalizeRevisionBridgeExportRuntimeSnapshot, 'function');
  assert.equal(typeof bridge.evaluateRevisionBridgeExportRuntimeSnapshot, 'function');
});

test('RB-34 marks current export entrypoint snapshot shape as advisory and transport-incomplete', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeExportRuntimeSnapshot(currentEntrypointShape());

  assert.equal(result.ok, false);
  assert.equal(result.status, 'advisory');
  assert.equal(result.code, 'E_REVISION_BRIDGE_REVIEWGRAPH_INVALID');
  assert.deepEqual(result.requiredFields, [
    'projectId',
    'baselineHash',
    'docFingerprint',
    'sourceVersion',
    'sceneOrder',
    'sceneBaselines',
    'blockBaselines',
  ]);
  assert.deepEqual(
    result.reasons.map((item) => item.field),
    [
      'projectId',
      'baselineHash',
      'docFingerprint',
      'sourceVersion',
      'sceneOrder',
      'sceneBaselines',
      'blockBaselines',
    ],
  );
  assert.equal(result.eligibility.canBuildManifest, false);
  assert.equal(result.eligibility.canBuildTransportEnvelope, false);
  assert.equal(result.eligibility.canBindExportEntrypoint, false);
});

test('RB-34 accepts a transport-ready runtime snapshot deterministically without mutation', async () => {
  const bridge = await loadBridge();
  const input = validSnapshot();
  const before = deepClone(input);

  const first = bridge.evaluateRevisionBridgeExportRuntimeSnapshot(input);
  const second = bridge.evaluateRevisionBridgeExportRuntimeSnapshot(input);

  assert.equal(first.ok, true);
  assert.equal(first.status, 'ready');
  assert.equal(first.code, 'REVISION_BRIDGE_REVIEWGRAPH_VALID');
  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
  assert.deepEqual(first.snapshot.sceneOrder, ['scene-1']);
  assert.equal(first.snapshot.sceneBaselines.length, 1);
  assert.equal(first.snapshot.blockBaselines.length, 1);
  assert.equal(first.eligibility.canBuildManifest, true);
  assert.equal(first.eligibility.canBuildTransportEnvelope, true);
  assert.equal(first.eligibility.canBindExportEntrypoint, true);
});

test('RB-34 rejects empty transport arrays as invalid even when top-level ids exist', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeExportRuntimeSnapshot({
    ...validSnapshot(),
    sceneOrder: [],
    sceneBaselines: [],
    blockBaselines: [],
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'invalid');
  assert.deepEqual(
    result.reasons.map((item) => item.field),
    ['sceneOrder', 'sceneBaselines', 'blockBaselines'],
  );
});

test('RB-34 source section has no forbidden side-effect tokens', () => {
  const source = fs.readFileSync(path.join(process.cwd(), MODULE_PATH), 'utf8');
  const start = source.indexOf('// RB_34_EXPORT_RUNTIME_SNAPSHOT_READINESS_CONTRACTS_START');
  const end = source.indexOf('// RB_34_EXPORT_RUNTIME_SNAPSHOT_READINESS_CONTRACTS_END');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const section = source.slice(start, end);
  const forbiddenTokens = [
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
    'crypto',
  ];

  for (const token of forbiddenTokens) {
    assert.equal(section.includes(token), false, `${token} must not appear in RB-34 section`);
  }
});

test('RB-34 changed files stay allowlisted and package manifests are untouched', () => {
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
