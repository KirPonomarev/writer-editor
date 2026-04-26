const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-revision-session-state-machine.contract.test.js';
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

function validRevisionSession(overrides = {}) {
  return {
    sessionId: 'session-1',
    projectId: 'project-1',
    baselineHash: 'baseline-hash-1',
    createdAt: '2026-04-26T10:00:00.000Z',
    updatedAt: '2026-04-26T10:01:00.000Z',
    reviewGraph: {
      commentThreads: [],
      commentPlacements: [],
      textChanges: [],
      structuralChanges: [],
      diagnosticItems: [],
      decisionStates: [],
    },
    ...overrides,
  };
}

test('RB-21 exports revision session state machine constants and helpers', async () => {
  const bridge = await loadBridge();

  assert.deepEqual(bridge.REVISION_BRIDGE_REVISION_SESSION_STATES, [
    'Exported',
    'Imported',
    'Diagnosed',
    'Decisioned',
    'Planned',
    'Applying',
    'Applied',
    'Failed',
    'Verified',
    'Closed',
    'Reopened',
    'Quarantined',
  ]);
  assert.equal(typeof bridge.normalizeRevisionSessionState, 'function');
  assert.equal(typeof bridge.isRevisionSessionStateTransitionAllowed, 'function');
});

test('RB-21 normalizes RevisionSession state with default Imported and legacy alias fields', async () => {
  const bridge = await loadBridge();
  const defaultSession = bridge.createRevisionSession(validRevisionSession());
  const aliasedSession = bridge.createRevisionSession(validRevisionSession({
    state: 'Decisioned',
    previousState: 'Diagnosed',
    stateChangedAt: '2026-04-26T10:02:00.000Z',
  }));

  assert.equal(defaultSession.sessionState, 'Imported');
  assert.equal(defaultSession.previousSessionState, '');
  assert.equal(aliasedSession.sessionState, 'Decisioned');
  assert.equal(aliasedSession.previousSessionState, 'Diagnosed');
});

test('RB-21 validates accepted and forbidden transitions with explicit timestamps', async () => {
  const bridge = await loadBridge();
  const validResult = bridge.validateRevisionSession(validRevisionSession({
    sessionState: 'Applying',
    previousSessionState: 'Planned',
    stateChangedAt: '2026-04-26T10:02:00.000Z',
  }));
  const invalidResult = bridge.validateRevisionSession(validRevisionSession({
    sessionState: 'Applied',
    previousSessionState: 'Imported',
    stateChangedAt: '2026-04-26T10:02:00.000Z',
  }));

  assert.equal(validResult.ok, true);
  assert.equal(invalidResult.ok, false);
  assert.equal(invalidResult.reasons.some((reason) => (
    reason.field === 'revisionSession.sessionState'
      && reason.message === 'RevisionSession state transition is not allowed'
  )), true);
});

test('RB-21 rejects malformed state metadata', async () => {
  const bridge = await loadBridge();
  const invalidState = bridge.validateRevisionSession(validRevisionSession({
    sessionState: 'unknown',
  }));
  const missingStateChangedAt = bridge.validateRevisionSession(validRevisionSession({
    sessionState: 'Applying',
    previousSessionState: 'Planned',
  }));
  const orphanStateChangedAt = bridge.validateRevisionSession(validRevisionSession({
    stateChangedAt: '2026-04-26T10:02:00.000Z',
  }));

  assert.equal(invalidState.ok, false);
  assert.equal(invalidState.reasons.some((reason) => reason.field === 'revisionSession.sessionState'), true);
  assert.equal(missingStateChangedAt.ok, false);
  assert.equal(missingStateChangedAt.reasons.some((reason) => reason.field === 'revisionSession.stateChangedAt'), true);
  assert.equal(orphanStateChangedAt.ok, false);
  assert.equal(orphanStateChangedAt.reasons.some((reason) => reason.field === 'revisionSession.stateChangedAt'), true);
});

test('RB-21 helper transition checks are deterministic and bounded', async () => {
  const bridge = await loadBridge();

  assert.equal(bridge.isRevisionSessionStateTransitionAllowed('Exported', 'Imported'), true);
  assert.equal(bridge.isRevisionSessionStateTransitionAllowed('Imported', 'Applied'), false);
  assert.equal(bridge.isRevisionSessionStateTransitionAllowed('Closed', 'Reopened'), true);
  assert.equal(bridge.isRevisionSessionStateTransitionAllowed('Closed', 'Imported'), false);
});

test('RB-21 state machine helpers are deterministic and do not mutate input payloads', async () => {
  const bridge = await loadBridge();
  const input = validRevisionSession({
    sessionState: 'Decisioned',
    previousSessionState: 'Diagnosed',
    stateChangedAt: '2026-04-26T10:02:00.000Z',
  });
  const before = deepClone(input);
  const first = bridge.createRevisionSession(input);
  const second = bridge.createRevisionSession(input);
  const validation = bridge.validateRevisionSession(input);

  assert.deepEqual(first, second);
  assert.equal(validation.ok, true);
  assert.deepEqual(input, before);
});

test('RB-21 source section has no forbidden side effect tokens', () => {
  const source = fs.readFileSync(path.join(process.cwd(), MODULE_PATH), 'utf8');
  const start = source.indexOf('// RB_21_REVISION_SESSION_STATE_MACHINE_CONTRACTS_START');
  const end = source.indexOf('// RB_21_REVISION_SESSION_STATE_MACHINE_CONTRACTS_END');
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
  ];

  for (const token of forbiddenTokens) {
    assert.equal(section.includes(token), false, `${token} must not appear in RB-21 section`);
  }
});

test('RB-21 changed files stay allowlisted and package manifests are untouched', () => {
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
