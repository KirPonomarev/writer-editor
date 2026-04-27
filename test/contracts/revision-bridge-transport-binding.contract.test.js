const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-transport-binding.contract.test.js';
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
    sceneOrder: ['scene-1'],
    sceneBaselines: [],
    blockBaselines: [],
  };
}

function validManifestInput() {
  return {
    id: 'export-1',
    createdAt: '2026-04-27T11:00:00.000Z',
  };
}

test('RB-25 exports transport binding schema and evaluator', async () => {
  const bridge = await loadBridge();

  assert.equal(bridge.REVISION_BRIDGE_TRANSPORT_BINDING_SCHEMA, 'revision-bridge.transport-envelope-binding.v1');
  assert.equal(typeof bridge.evaluateRevisionBridgeTransportBinding, 'function');
});

test('RB-25 verifies matching envelope against local manifest', async () => {
  const bridge = await loadBridge();
  const manifest = bridge.buildRevisionBridgeExportManifest(validSnapshot(), validManifestInput());
  const envelope = bridge.buildRevisionBridgeTransportEnvelope(manifest);
  const result = bridge.evaluateRevisionBridgeTransportBinding({
    exportManifest: manifest,
    transportEnvelope: envelope,
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'verified');
  assert.equal(result.code, 'REVISION_BRIDGE_REVIEWGRAPH_VALID');
  assert.deepEqual(result.reasons, []);
});

test('RB-25 marks mismatch when envelope fields diverge from manifest', async () => {
  const bridge = await loadBridge();
  const manifest = bridge.buildRevisionBridgeExportManifest(validSnapshot(), validManifestInput());
  const envelope = bridge.buildRevisionBridgeTransportEnvelope(manifest);
  envelope.projectId = 'other-project';

  const result = bridge.evaluateRevisionBridgeTransportBinding({
    exportManifest: manifest,
    transportEnvelope: envelope,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'mismatch');
  assert.equal(result.reasons.some((reason) => reason.field === 'transportBinding.projectId'), true);
});

test('RB-25 returns advisory status for missing binding inputs', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBridgeTransportBinding({
    exportManifest: {},
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'advisory');
  assert.equal(result.reasons.some((reason) => reason.field === 'transportEnvelope'), true);
});

test('RB-25 evaluator is deterministic and does not mutate input', async () => {
  const bridge = await loadBridge();
  const manifest = bridge.buildRevisionBridgeExportManifest(validSnapshot(), validManifestInput());
  const envelope = bridge.buildRevisionBridgeTransportEnvelope(manifest);
  const input = {
    exportManifest: manifest,
    transportEnvelope: envelope,
  };
  const before = deepClone(input);

  const first = bridge.evaluateRevisionBridgeTransportBinding(input);
  const second = bridge.evaluateRevisionBridgeTransportBinding(input);

  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
});

test('RB-25 source section has no forbidden side effect tokens', () => {
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
    assert.equal(section.includes(token), false, `${token} must not appear in RB-24/RB-25 section`);
  }
});

test('RB-25 changed files stay allowlisted and package manifests are untouched', () => {
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
