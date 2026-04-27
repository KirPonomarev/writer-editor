const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-supported-surface-v1.contract.test.js';
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

test('RB-27 exports SupportedSurfaceV1 schema and functions', async () => {
  const bridge = await loadBridge();

  assert.equal(bridge.REVISION_BRIDGE_SUPPORTED_SURFACE_V1_SCHEMA, 'revision-bridge.supported-surface.v1');
  assert.equal(typeof bridge.getRevisionBridgeSupportedSurfaceV1, 'function');
  assert.equal(typeof bridge.classifyRevisionBridgeSurfaceItem, 'function');
  assert.equal(typeof bridge.evaluateRevisionBridgeSupportedSurface, 'function');
});

test('RB-27 returns canonical SupportedSurfaceV1 declaration', async () => {
  const bridge = await loadBridge();
  const surface = bridge.getRevisionBridgeSupportedSurfaceV1();

  assert.equal(surface.schemaVersion, 'revision-bridge.supported-surface.v1');
  assert.equal(surface.supported.includes('mainDocumentStory'), true);
  assert.equal(surface.supported.includes('paragraph'), true);
  assert.equal(surface.supported.includes('heading'), true);
  assert.equal(surface.manualOnly.includes('sceneSplit'), true);
  assert.equal(surface.manualOnly.includes('blockMove'), true);
  assert.equal(surface.diagnosticsOnly.includes('table'), true);
  assert.equal(surface.diagnosticsOnly.includes('header'), true);
  assert.equal(surface.policy.outsideSupportedSurface, 'diagnosticsOnlyOrManualOnly');
});

test('RB-27 classifies supported, manual only, diagnostics only and unknown items', async () => {
  const bridge = await loadBridge();

  assert.deepEqual(bridge.classifyRevisionBridgeSurfaceItem('paragraph'), {
    item: 'paragraph',
    tier: 'supported',
    code: 'REVISION_BRIDGE_SUPPORTED_SURFACE_SUPPORTED',
  });
  assert.deepEqual(bridge.classifyRevisionBridgeSurfaceItem('sceneSplit'), {
    item: 'sceneSplit',
    tier: 'manualOnly',
    code: 'REVISION_BRIDGE_SUPPORTED_SURFACE_MANUAL_ONLY',
  });
  assert.deepEqual(bridge.classifyRevisionBridgeSurfaceItem('table'), {
    item: 'table',
    tier: 'diagnosticsOnly',
    code: 'REVISION_BRIDGE_SUPPORTED_SURFACE_DIAGNOSTICS_ONLY',
  });
  assert.deepEqual(bridge.classifyRevisionBridgeSurfaceItem('customWidget'), {
    item: 'customWidget',
    tier: 'unsupported',
    code: 'REVISION_BRIDGE_SUPPORTED_SURFACE_UNKNOWN',
  });
});

test('RB-27 evaluates item batches deterministically and does not mutate inputs', async () => {
  const bridge = await loadBridge();
  const input = {
    items: ['paragraph', 'sceneSplit', 'table', 'customWidget', 'heading'],
  };
  const before = deepClone(input);

  const first = bridge.evaluateRevisionBridgeSupportedSurface(input);
  const second = bridge.evaluateRevisionBridgeSupportedSurface(input);

  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
  assert.deepEqual(first.counts, {
    supported: 2,
    manualOnly: 1,
    diagnosticsOnly: 1,
    unsupported: 1,
  });
});

test('RB-27 source section has no forbidden side-effect tokens', () => {
  const source = fs.readFileSync(path.join(process.cwd(), MODULE_PATH), 'utf8');
  const start = source.indexOf('// RB_27_SUPPORTED_SURFACE_V1_CONTRACTS_START');
  const end = source.indexOf('// RB_27_SUPPORTED_SURFACE_V1_CONTRACTS_END');
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
    assert.equal(section.includes(token), false, `${token} must not appear in RB-27 section`);
  }
});

test('RB-27 changed files stay allowlisted and package manifests are untouched', () => {
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
