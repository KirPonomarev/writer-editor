const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-apply-receipt-contract.contract.test.js';
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

function validApplyReceipt() {
  return {
    schemaVersion: 'revision-bridge.apply-receipt.v1',
    receiptId: 'receipt-1',
    applyTxnId: 'txn-1',
    projectId: 'project-1',
    revisionSessionId: 'session-1',
    baselineHash: 'baseline-hash-1',
    targetScope: {
      type: 'scene',
      id: 'scene-1',
      sceneIds: ['scene-1'],
    },
    status: 'applied',
    decisionSummary: {
      total: 2,
      accepted: 1,
      rejected: 1,
      deferred: 0,
    },
    writes: [
      {
        entityKind: 'scene',
        entityId: 'scene-1',
        beforeHash: 'before-hash-1',
        afterHash: 'after-hash-1',
      },
    ],
    runtimeMode: 'contractOnly',
    createdAt: '2026-04-27T12:00:00.000Z',
  };
}

test('RB-26 exports ApplyReceipt schemas and functions', async () => {
  const bridge = await loadBridge();

  assert.equal(bridge.REVISION_BRIDGE_APPLY_RECEIPT_SCHEMA, 'revision-bridge.apply-receipt.v1');
  assert.equal(bridge.REVISION_BRIDGE_APPLY_RECEIPT_PREVIEW_SCHEMA, 'revision-bridge.apply-receipt-preview.v1');
  assert.equal(typeof bridge.validateRevisionBridgeApplyReceipt, 'function');
  assert.equal(typeof bridge.previewRevisionBridgeApplyReceipt, 'function');
});

test('RB-26 validates deterministic valid ApplyReceipt candidate', async () => {
  const bridge = await loadBridge();
  const receipt = validApplyReceipt();
  const first = bridge.validateRevisionBridgeApplyReceipt(receipt);
  const second = bridge.validateRevisionBridgeApplyReceipt(receipt);

  assert.deepEqual(first, second);
  assert.equal(first.ok, true);
  assert.equal(first.type, 'revisionBridge.applyReceiptValidation');
  assert.equal(first.code, 'REVISION_BRIDGE_APPLY_RECEIPT_VALID');
  assert.equal(first.reason, 'REVISION_BRIDGE_APPLY_RECEIPT_VALID');
  assert.deepEqual(first.reasons, []);
  assert.equal(first.applyReceipt.schemaVersion, 'revision-bridge.apply-receipt.v1');
});

test('RB-26 rejects missing mandatory fields and invalid write set for applied status', async () => {
  const bridge = await loadBridge();
  const receipt = validApplyReceipt();
  receipt.targetScope = { type: 'scene' };
  receipt.writes = [];

  const result = bridge.validateRevisionBridgeApplyReceipt(receipt);
  const reasonFields = result.reasons.map((reason) => reason.field);
  const reasonCodes = result.reasons.map((reason) => reason.code);

  assert.equal(result.ok, false);
  assert.equal(reasonFields.includes('targetScope.id'), true);
  assert.equal(reasonFields.includes('writes'), true);
  assert.equal(reasonCodes.includes('REVISION_BRIDGE_APPLY_RECEIPT_WRITE_SET_EMPTY'), true);
});

test('RB-26 preview is blocked even for valid input in contract-only mode', async () => {
  const bridge = await loadBridge();
  const preview = bridge.previewRevisionBridgeApplyReceipt(validApplyReceipt());

  assert.equal(preview.schemaVersion, 'revision-bridge.apply-receipt-preview.v1');
  assert.equal(preview.type, 'revisionBridge.applyReceiptPreview');
  assert.equal(preview.status, 'blocked');
  assert.equal(preview.code, 'E_REVISION_BRIDGE_APPLY_RECEIPT_BLOCKED');
  assert.equal(preview.canPersist, false);
  assert.equal(preview.reason, 'REVISION_BRIDGE_APPLY_RECEIPT_RUNTIME_NOT_ENABLED');
  assert.equal(Array.isArray(preview.reasons), true);
  assert.equal(preview.reasons[0].code, 'REVISION_BRIDGE_APPLY_RECEIPT_RUNTIME_NOT_ENABLED');
});

test('RB-26 functions do not mutate input payloads', async () => {
  const bridge = await loadBridge();
  const payload = validApplyReceipt();
  const before = deepClone(payload);

  bridge.validateRevisionBridgeApplyReceipt(payload);
  bridge.previewRevisionBridgeApplyReceipt(payload);

  assert.deepEqual(payload, before);
});

test('RB-26 source section has no forbidden side-effect tokens', () => {
  const source = fs.readFileSync(path.join(process.cwd(), MODULE_PATH), 'utf8');
  const start = source.indexOf('// RB_26_APPLY_RECEIPT_CONTRACTS_START');
  const end = source.indexOf('// RB_26_APPLY_RECEIPT_CONTRACTS_END');
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
    assert.equal(section.includes(token), false, `${token} must not appear in RB-26 section`);
  }
});

test('RB-26 changed files stay allowlisted and package manifests are untouched', () => {
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
