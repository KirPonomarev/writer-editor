const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-block-identity-risk.contract.test.js';
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

function block(overrides = {}) {
  return {
    schemaVersion: 'revision-bridge.block.v1',
    blockId: 'block-1',
    lineageId: 'lineage-1',
    versionHash: 'version-1',
    kind: 'paragraph',
    order: 0,
    text: 'Alpha paragraph.',
    attrs: {},
    source: {},
    ...overrides,
  };
}

test('RB-28 exports block identity risk schema and evaluator', async () => {
  const bridge = await loadBridge();

  assert.equal(bridge.REVISION_BRIDGE_BLOCK_IDENTITY_RISK_SCHEMA, 'revision-bridge.block-identity-risk.v1');
  assert.equal(typeof bridge.evaluateRevisionBlockIdentityRisks, 'function');
});

test('RB-28 returns no diagnostics for safe block identities', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBlockIdentityRisks({
    blocks: [
      block({ blockId: 'block-A', order: 0, text: 'Alpha paragraph.' }),
      block({ blockId: 'block-B', lineageId: 'lineage-2', versionHash: 'version-2', order: 1, text: 'Beta paragraph.' }),
    ],
  });

  assert.equal(result.schemaVersion, 'revision-bridge.block-identity-risk.v1');
  assert.equal(result.status, 'evaluated');
  assert.equal(result.code, 'REVISION_BRIDGE_BLOCK_IDENTITY_RISK_NONE');
  assert.deepEqual(result.diagnostics, []);
});

test('RB-28 detects blockId equal to order index and visible text', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBlockIdentityRisks({
    blocks: [
      block({ blockId: '0', order: 0, text: 'Plain block text' }),
      block({ blockId: 'Plain block text', lineageId: 'lineage-2', versionHash: 'version-2', order: 1, text: 'Plain block text' }),
    ],
  });
  const codes = result.diagnostics.map((item) => item.code);

  assert.equal(result.code, 'REVISION_BRIDGE_BLOCK_IDENTITY_RISK_FOUND');
  assert.equal(codes.includes('REVISION_BRIDGE_BLOCK_ID_EQUALS_ORDER'), true);
  assert.equal(codes.includes('REVISION_BRIDGE_BLOCK_ID_EQUALS_VISIBLE_TEXT'), true);
  assert.equal(codes.includes('REVISION_BRIDGE_BLOCK_COPY_AMBIGUITY'), true);
});

test('RB-28 detects heading text identity ambiguity explicitly', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionBlockIdentityRisks({
    blocks: [
      block({
        blockId: 'Heading title',
        kind: 'heading',
        text: 'Heading title',
      }),
    ],
  });

  assert.equal(result.diagnostics.some((item) => item.code === 'REVISION_BRIDGE_BLOCK_ID_EQUALS_HEADING_TEXT'), true);
  assert.equal(result.diagnostics.every((item) => item.automationPolicy === 'manualOnly'), true);
});

test('RB-28 evaluator is deterministic and does not mutate input', async () => {
  const bridge = await loadBridge();
  const input = {
    blocks: [
      block({ blockId: 'custom-1', text: 'One' }),
      block({ blockId: 'custom-2', lineageId: 'lineage-2', versionHash: 'version-2', order: 1, text: 'Two' }),
    ],
  };
  const before = deepClone(input);
  const first = bridge.evaluateRevisionBlockIdentityRisks(input);
  const second = bridge.evaluateRevisionBlockIdentityRisks(input);

  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
});

test('RB-28 source section has no forbidden side-effect tokens', () => {
  const source = fs.readFileSync(path.join(process.cwd(), MODULE_PATH), 'utf8');
  const start = source.indexOf('// RB_09_BLOCK_LINEAGE_CONTRACTS_START');
  const end = source.indexOf('// RB_09_BLOCK_LINEAGE_CONTRACTS_END');
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
    assert.equal(section.includes(token), false, `${token} must not appear in RB-09/RB-28 section`);
  }
});

test('RB-28 changed files stay allowlisted and package manifests are untouched', () => {
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
