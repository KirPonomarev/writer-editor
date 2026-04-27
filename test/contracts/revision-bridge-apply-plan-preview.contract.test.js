const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-apply-plan-preview.contract.test.js';
const STATE_PATH = 'docs/OPS/STATUS/RB_V21_AUTOCYCLE_STATE_V1.json';
const ALLOWLIST = [MODULE_PATH, TEST_PATH, STATE_PATH];

async function loadBridge() {
  return import(pathToFileURL(path.join(process.cwd(), MODULE_PATH)).href);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validApplyTxn(overrides = {}) {
  return {
    schemaVersion: 'revision-bridge.apply-txn.v1',
    projectId: 'project-1',
    revisionSessionId: 'revision-session-1',
    baselineHash: 'baseline-hash-1',
    targetScope: {
      type: 'project',
      id: 'project-1',
      sceneIds: ['scene-1', 'scene-2'],
    },
    decisionSet: {
      decisions: [
        {
          decisionId: 'decision-accepted',
          status: 'accepted',
          matchKind: 'exact',
          applyMode: 'manual',
        },
        {
          decisionId: 'decision-rejected',
          status: 'rejected',
          matchKind: 'exact',
          applyMode: 'manual',
        },
      ],
    },
    ...overrides,
  };
}

function changedFilesFromGitStatus(statusText) {
  return statusText
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => line.slice(3).replace(/^"|"$/gu, ''));
}

test('RB-32 exports apply plan schema and preview function', async () => {
  const bridge = await loadBridge();

  assert.equal(
    bridge.REVISION_BRIDGE_APPLY_PLAN_SCHEMA,
    'revision-bridge.apply-plan.v1',
  );
  assert.equal(typeof bridge.previewRevisionBridgeApplyPlan, 'function');
});

test('RB-32 builds blocked contract-only apply plan preview with accepted decision buckets', async () => {
  const bridge = await loadBridge();
  const result = bridge.previewRevisionBridgeApplyPlan(validApplyTxn());

  assert.equal(result.schemaVersion, 'revision-bridge.apply-plan.v1');
  assert.equal(result.type, 'revisionBridge.applyPlanPreview');
  assert.equal(result.status, 'blocked');
  assert.equal(result.code, 'E_REVISION_BRIDGE_APPLY_TXN_BLOCKED');
  assert.equal(result.reason, 'REVISION_BRIDGE_APPLY_TXN_RUNTIME_NOT_ENABLED');
  assert.equal(result.canApply, false);
  assert.deepEqual(result.applyPlan.acceptedDecisionIds, ['decision-accepted']);
  assert.equal(result.applyPlan.decisionSummary.total, 2);
  assert.equal(result.applyPlan.decisionSummary.accepted, 1);
  assert.equal(result.applyPlan.sceneBuckets.length, 2);
  assert.equal(result.applyPlan.sceneBuckets[0].sceneId, 'scene-1');
  assert.equal(result.applyPlan.sceneBuckets[0].decisionCount, 1);
  assert.equal(result.applyPlan.runtimeMode, 'contractOnly');
});

test('RB-32 returns explicit reason when no accepted decisions exist', async () => {
  const bridge = await loadBridge();
  const result = bridge.previewRevisionBridgeApplyPlan(validApplyTxn({
    decisionSet: {
      decisions: [
        {
          decisionId: 'decision-rejected',
          status: 'rejected',
          matchKind: 'exact',
          applyMode: 'manual',
        },
      ],
    },
  }));

  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_APPLY_PLAN_NO_ACCEPTED_DECISIONS');
  assert.deepEqual(result.applyPlan.acceptedDecisionIds, []);
  assert.equal(result.applyPlan.decisionSummary.accepted, 0);
});

test('RB-32 keeps apply plan preview bounded for invalid ApplyTxn payloads', async () => {
  const bridge = await loadBridge();
  const result = bridge.previewRevisionBridgeApplyPlan({
    schemaVersion: 'revision-bridge.apply-txn.v1',
    projectId: 'project-1',
    decisionSet: {
      decisions: [],
    },
  });

  assert.equal(result.status, 'blocked');
  assert.equal(result.code, 'E_REVISION_BRIDGE_APPLY_TXN_BLOCKED');
  assert.equal(result.reasons.some((item) => item.field === 'revisionSessionId'), true);
  assert.equal(result.reasons.some((item) => item.field === 'targetScope'), true);
});

test('RB-32 apply plan preview is deterministic and does not mutate input', async () => {
  const bridge = await loadBridge();
  const input = validApplyTxn();
  const before = deepClone(input);
  const first = bridge.previewRevisionBridgeApplyPlan(input);
  const second = bridge.previewRevisionBridgeApplyPlan(input);

  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
});

test('RB-32 source section has no forbidden side-effect tokens', () => {
  const source = fs.readFileSync(path.join(process.cwd(), MODULE_PATH), 'utf8');
  const start = source.indexOf('// RB_32_APPLY_PLAN_PREVIEW_CONTRACTS_START');
  const end = source.indexOf('// RB_32_APPLY_PLAN_PREVIEW_CONTRACTS_END');
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
    assert.equal(section.includes(token), false, `${token} must not appear in RB-32 section`);
  }
});

test('RB-32 changed files stay allowlisted and package manifests are untouched', () => {
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
