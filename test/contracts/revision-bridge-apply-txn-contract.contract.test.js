const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-apply-txn-contract.contract.test.js';
const ALLOWLIST = [MODULE_PATH, TEST_PATH];

async function loadBridge() {
  return import(pathToFileURL(path.join(process.cwd(), MODULE_PATH)).href);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validApplyTxn() {
  return {
    schemaVersion: 'revision-bridge.apply-txn.v1',
    projectId: 'project-1',
    revisionSessionId: 'session-1',
    baselineHash: 'baseline-hash-1',
    targetScope: {
      type: 'scene',
      id: 'scene-1',
      sceneIds: ['scene-1'],
    },
    decisionSet: {
      decisions: [
        {
          decisionId: 'decision-1',
          status: 'resolved',
          matchKind: 'exact',
          applyMode: 'manual',
        },
      ],
    },
    fromState: 'Prepared',
    toState: 'WritingTemps',
  };
}

test('RB-18 exports ApplyTxn schema, states, and functions', async () => {
  const bridge = await loadBridge();

  assert.equal(typeof bridge.REVISION_BRIDGE_APPLY_TXN_SCHEMA, 'string');
  assert.equal(bridge.REVISION_BRIDGE_APPLY_TXN_SCHEMA, 'revision-bridge.apply-txn.v1');
  assert.equal(typeof bridge.REVISION_BRIDGE_APPLY_TXN_PREVIEW_SCHEMA, 'string');
  assert.equal(bridge.REVISION_BRIDGE_APPLY_TXN_PREVIEW_SCHEMA, 'revision-bridge.apply-txn-preview.v1');
  assert.deepEqual(bridge.REVISION_BRIDGE_APPLY_TXN_STATES, [
    'Prepared',
    'WritingTemps',
    'Committing',
    'Verifying',
    'Applied',
    'Failed',
    'Recovering',
    'Closed',
  ]);
  assert.equal(typeof bridge.validateRevisionBridgeApplyTxn, 'function');
  assert.equal(typeof bridge.previewRevisionBridgeApplyTxn, 'function');
});

test('RB-18 validates a valid ApplyTxn candidate deterministically', async () => {
  const bridge = await loadBridge();
  const applyTxn = validApplyTxn();

  const first = bridge.validateRevisionBridgeApplyTxn(applyTxn);
  const second = bridge.validateRevisionBridgeApplyTxn(applyTxn);

  assert.deepEqual(first, second);
  assert.equal(first.ok, true);
  assert.equal(first.type, 'revisionBridge.applyTxnValidation');
  assert.equal(first.code, 'REVISION_BRIDGE_APPLY_TXN_VALID');
  assert.equal(first.reason, 'REVISION_BRIDGE_APPLY_TXN_VALID');
  assert.deepEqual(first.reasons, []);
  assert.equal(first.applyTxn.schemaVersion, 'revision-bridge.apply-txn.v1');
});

test('RB-18 rejects missing targetScope.id and empty decisionSet', async () => {
  const bridge = await loadBridge();
  const applyTxn = validApplyTxn();
  applyTxn.targetScope = { type: 'scene' };
  applyTxn.decisionSet = { decisions: [] };

  const result = bridge.validateRevisionBridgeApplyTxn(applyTxn);
  const reasonFields = result.reasons.map((reason) => reason.field);
  const reasonCodes = result.reasons.map((reason) => reason.code);

  assert.equal(result.ok, false);
  assert.equal(reasonFields.includes('targetScope.id'), true);
  assert.equal(reasonFields.includes('decisionSet.decisions'), true);
  assert.equal(reasonCodes.includes('REVISION_BRIDGE_APPLY_TXN_DECISION_SET_EMPTY'), true);
});

test('RB-18 rejects invalid transition pairs', async () => {
  const bridge = await loadBridge();
  const applyTxn = validApplyTxn();
  applyTxn.fromState = 'Prepared';
  applyTxn.toState = 'Applied';

  const result = bridge.validateRevisionBridgeApplyTxn(applyTxn);

  assert.equal(result.ok, false);
  assert.equal(result.reasons.some((reason) => (
    reason.code === 'REVISION_BRIDGE_APPLY_TXN_INVALID_TRANSITION'
    && reason.field === 'toState'
  )), true);
});

test('RB-18 requires fromState and toState together when transition intent exists', async () => {
  const bridge = await loadBridge();
  const applyTxn = validApplyTxn();
  delete applyTxn.fromState;
  applyTxn.toState = 'WritingTemps';

  const result = bridge.validateRevisionBridgeApplyTxn(applyTxn);

  assert.equal(result.ok, false);
  assert.equal(result.reasons.some((reason) => reason.code === 'REVISION_BRIDGE_APPLY_TXN_TRANSITION_FIELDS_REQUIRED'), true);
});

test('RB-18 preview is blocked even for valid input in contract-only mode', async () => {
  const bridge = await loadBridge();
  const preview = bridge.previewRevisionBridgeApplyTxn(validApplyTxn());

  assert.equal(preview.schemaVersion, 'revision-bridge.apply-txn-preview.v1');
  assert.equal(preview.type, 'revisionBridge.applyTxnPreview');
  assert.equal(preview.status, 'blocked');
  assert.equal(preview.code, 'E_REVISION_BRIDGE_APPLY_TXN_BLOCKED');
  assert.equal(preview.canOpen, false);
  assert.equal(preview.reason, 'REVISION_BRIDGE_APPLY_TXN_RUNTIME_NOT_ENABLED');
  assert.equal(Array.isArray(preview.reasons), true);
  assert.equal(preview.reasons[0].code, 'REVISION_BRIDGE_APPLY_TXN_RUNTIME_NOT_ENABLED');
  assert.equal(typeof preview.allowedTransitions, 'object');
});

test('RB-18 preview keeps validation reasons for invalid input', async () => {
  const bridge = await loadBridge();
  const preview = bridge.previewRevisionBridgeApplyTxn({
    schemaVersion: 'revision-bridge.apply-txn.v1',
    projectId: '',
    revisionSessionId: '',
    baselineHash: '',
    targetScope: {},
    decisionSet: { decisions: [] },
  });

  const reasonCodes = preview.reasons.map((reason) => reason.code);
  assert.equal(preview.status, 'blocked');
  assert.equal(reasonCodes.includes('REVISION_BRIDGE_FIELD_REQUIRED'), true);
  assert.equal(reasonCodes.includes('REVISION_BRIDGE_APPLY_TXN_DECISION_SET_EMPTY'), true);
});

test('RB-18 functions do not mutate input payloads', async () => {
  const bridge = await loadBridge();
  const payload = validApplyTxn();
  const before = deepClone(payload);

  bridge.validateRevisionBridgeApplyTxn(payload);
  bridge.previewRevisionBridgeApplyTxn(payload);

  assert.deepEqual(payload, before);
});

test('RB-18 source section has no forbidden side-effect tokens', () => {
  const source = fs.readFileSync(path.join(process.cwd(), MODULE_PATH), 'utf8');
  const start = source.indexOf('// RB_18_APPLY_TXN_CONTRACTS_START');
  const end = source.indexOf('// RB_18_APPLY_TXN_CONTRACTS_END');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const section = source.slice(start, end);
  const forbiddenTokens = [
    'import',
    'require',
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
    assert.equal(section.includes(token), false, `${token} must not appear in RB-18 section`);
  }
});

test('RB-18 changed files stay allowlisted and package manifests are untouched', () => {
  const status = execFileSync('git', ['status', '--porcelain', '-uall'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  const changedFiles = status.map((line) => line.slice(3).replace(/^"|"$/gu, ''));
  const packageManifestDiff = changedFiles.filter((filePath) => filePath === 'package.json' || filePath === 'package-lock.json');

  assert.deepEqual(changedFiles.sort(), [...ALLOWLIST].sort());
  assert.deepEqual(packageManifestDiff, []);
});
