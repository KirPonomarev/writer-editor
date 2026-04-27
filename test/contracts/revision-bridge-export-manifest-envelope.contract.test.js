const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-export-manifest-envelope.contract.test.js';
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
    profileId: 'profile-1',
    baselineHash: 'baseline-1',
    docFingerprintPlan: 'doc-fingerprint-1',
    sourceVersion: 'source-v1',
    sceneOrder: ['scene-1', 'scene-2'],
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

function validManifestInput() {
  return {
    id: 'export-1',
    createdAt: '2026-04-27T10:00:00.000Z',
    sourceVersion: 'source-v2',
  };
}

test('RB-24 exports manifest and envelope schemas and functions', async () => {
  const bridge = await loadBridge();

  assert.equal(bridge.REVISION_BRIDGE_EXPORT_MANIFEST_SCHEMA, 'revision-bridge.export-manifest.v1');
  assert.equal(bridge.REVISION_BRIDGE_TRANSPORT_ENVELOPE_SCHEMA, 'revision-bridge.transport-envelope.v1');
  assert.equal(bridge.REVISION_BRIDGE_DOCX_REVIEW_PROFILE_ID, 'revision-bridge-docx-review-profile-v1');
  assert.equal(typeof bridge.buildRevisionBridgeExportManifest, 'function');
  assert.equal(typeof bridge.buildRevisionBridgeTransportEnvelope, 'function');
});

test('RB-24 builds deterministic export manifest from snapshot and manifest inputs', async () => {
  const bridge = await loadBridge();
  const snapshot = validSnapshot();
  const manifestInput = validManifestInput();
  const beforeSnapshot = deepClone(snapshot);
  const beforeManifestInput = deepClone(manifestInput);

  const first = bridge.buildRevisionBridgeExportManifest(snapshot, manifestInput);
  const second = bridge.buildRevisionBridgeExportManifest(snapshot, manifestInput);

  assert.deepEqual(first, second);
  assert.deepEqual(snapshot, beforeSnapshot);
  assert.deepEqual(manifestInput, beforeManifestInput);
  assert.equal(first.schemaVersion, 'revision-bridge.export-manifest.v1');
  assert.equal(first.kind, 'ExportManifest');
  assert.equal(first.id, 'export-1');
  assert.equal(first.projectId, 'project-1');
  assert.equal(first.profileId, 'profile-1');
  assert.equal(first.createdAt, '2026-04-27T10:00:00.000Z');
  assert.equal(first.baselineHash, 'baseline-1');
  assert.equal(first.docFingerprint, 'doc-fingerprint-1');
  assert.equal(first.sourceVersion, 'source-v2');
  assert.deepEqual(first.sceneOrder, ['scene-1', 'scene-2']);
  assert.equal(first.scenes.length, 1);
  assert.equal(first.blocks.length, 1);
  assert.equal(first.trust.localCanonical, true);
  assert.equal(first.trust.embeddedTransportIsAdvisory, true);
});

test('RB-24 builds advisory transport envelope from manifest deterministically', async () => {
  const bridge = await loadBridge();
  const manifest = bridge.buildRevisionBridgeExportManifest(validSnapshot(), validManifestInput());
  const before = deepClone(manifest);

  const first = bridge.buildRevisionBridgeTransportEnvelope(manifest);
  const second = bridge.buildRevisionBridgeTransportEnvelope(manifest);

  assert.deepEqual(first, second);
  assert.deepEqual(manifest, before);
  assert.equal(first.schemaVersion, 'revision-bridge.transport-envelope.v1');
  assert.equal(first.kind, 'TransportEnvelope');
  assert.equal(first.advisory, true);
  assert.equal(first.exportId, 'export-1');
  assert.equal(first.projectId, 'project-1');
  assert.equal(first.baselineHash, 'baseline-1');
  assert.equal(first.docFingerprint, 'doc-fingerprint-1');
  assert.equal(first.sceneCount, 2);
  assert.deepEqual(first.sceneOrder, ['scene-1', 'scene-2']);
});

test('RB-24 source section has no forbidden side effect tokens', () => {
  const source = fs.readFileSync(path.join(process.cwd(), MODULE_PATH), 'utf8');
  const start = source.indexOf('// RB_24_EXPORT_MANIFEST_TRANSPORT_ENVELOPE_CONTRACTS_START');
  const end = source.indexOf('// RB_24_EXPORT_MANIFEST_TRANSPORT_ENVELOPE_CONTRACTS_END');
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
    assert.equal(section.includes(token), false, `${token} must not appear in RB-24 section`);
  }
});

test('RB-24 changed files stay allowlisted and package manifests are untouched', () => {
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
