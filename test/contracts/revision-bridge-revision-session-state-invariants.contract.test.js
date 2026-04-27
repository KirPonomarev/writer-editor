const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-revision-session-state-invariants.contract.test.js';
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

function baseSession(overrides = {}) {
  return {
    sessionId: 'session-1',
    projectId: 'project-1',
    baselineHash: 'baseline-hash-1',
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

function acceptedDecision(id = 'decision-1') {
  return {
    decisionId: id,
    itemKind: 'textChange',
    itemId: 'text-change-1',
    status: 'accepted',
    decidedAt: '2026-04-27T08:00:00.000Z',
    reason: 'approved',
  };
}

function pendingDecision(id = 'decision-pending') {
  return {
    decisionId: id,
    itemKind: 'textChange',
    itemId: 'text-change-1',
    status: 'pending',
    decidedAt: '',
    reason: '',
  };
}

function minimalTextChange() {
  return {
    changeId: 'text-change-1',
    targetScope: {
      type: 'scene',
      id: 'scene-1',
    },
    match: {
      kind: 'exact',
      quote: 'old',
      prefix: '',
      suffix: '',
    },
    replacementText: 'new',
    createdAt: '2026-04-27T08:00:00.000Z',
  };
}

test('RB-23 exports state invariants schema and evaluator', async () => {
  const bridge = await loadBridge();

  assert.equal(
    bridge.REVISION_BRIDGE_REVISION_SESSION_STATE_INVARIANTS_SCHEMA,
    'revision-bridge.revision-session-state-invariants.v1',
  );
  assert.equal(typeof bridge.evaluateRevisionSessionStateInvariants, 'function');
});

test('RB-23 rejects Exported session with non-empty review graph', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateRevisionSessionStateInvariants(baseSession({
    sessionState: 'Exported',
    reviewGraph: {
      commentThreads: [],
      commentPlacements: [],
      textChanges: [minimalTextChange()],
      structuralChanges: [],
      diagnosticItems: [],
      decisionStates: [],
    },
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 'invalid');
  assert.equal(result.reasons.some((reason) => reason.field === 'revisionSession.reviewGraph'), true);
});

test('RB-23 rejects Decisioned session with pending or missing decisions', async () => {
  const bridge = await loadBridge();

  const missingDecisions = bridge.validateRevisionSession(baseSession({
    sessionState: 'Decisioned',
  }));
  const pendingDecisionSession = bridge.validateRevisionSession(baseSession({
    sessionState: 'Decisioned',
    reviewGraph: {
      commentThreads: [],
      commentPlacements: [],
      textChanges: [minimalTextChange()],
      structuralChanges: [],
      diagnosticItems: [],
      decisionStates: [pendingDecision()],
    },
  }));

  assert.equal(missingDecisions.ok, false);
  assert.equal(missingDecisions.reasons.some((reason) => reason.field === 'revisionSession.reviewGraph.decisionStates'), true);
  assert.equal(pendingDecisionSession.ok, false);
  assert.equal(pendingDecisionSession.reasons.some((reason) => reason.field === 'revisionSession.reviewGraph.decisionStates'), true);
});

test('RB-23 requires accepted decisions for Applying and later states', async () => {
  const bridge = await loadBridge();
  const withoutAccepted = bridge.validateRevisionSession(baseSession({
    sessionState: 'Applying',
    previousSessionState: 'Planned',
    stateChangedAt: '2026-04-27T08:10:00.000Z',
    reviewGraph: {
      commentThreads: [],
      commentPlacements: [],
      textChanges: [minimalTextChange()],
      structuralChanges: [],
      diagnosticItems: [],
      decisionStates: [
        {
          ...pendingDecision('decision-2'),
          status: 'rejected',
          decidedAt: '2026-04-27T08:09:00.000Z',
        },
      ],
    },
  }));
  const withAccepted = bridge.validateRevisionSession(baseSession({
    sessionState: 'Applying',
    previousSessionState: 'Planned',
    stateChangedAt: '2026-04-27T08:10:00.000Z',
    reviewGraph: {
      commentThreads: [],
      commentPlacements: [],
      textChanges: [minimalTextChange()],
      structuralChanges: [],
      diagnosticItems: [],
      decisionStates: [acceptedDecision()],
    },
  }));

  assert.equal(withoutAccepted.ok, false);
  assert.equal(withoutAccepted.reasons.some((reason) => reason.field === 'revisionSession.reviewGraph.decisionStates'), true);
  assert.equal(withAccepted.ok, true);
});

test('RB-23 requires diagnostic items for Failed and Quarantined states', async () => {
  const bridge = await loadBridge();
  const failed = bridge.validateRevisionSession(baseSession({
    sessionState: 'Failed',
    previousSessionState: 'Applying',
    stateChangedAt: '2026-04-27T08:10:00.000Z',
  }));
  const quarantined = bridge.validateRevisionSession(baseSession({
    sessionState: 'Quarantined',
    previousSessionState: 'Imported',
    stateChangedAt: '2026-04-27T08:10:00.000Z',
  }));
  const quarantinedWithDiagnostics = bridge.validateRevisionSession(baseSession({
    sessionState: 'Quarantined',
    previousSessionState: 'Imported',
    stateChangedAt: '2026-04-27T08:10:00.000Z',
    reviewGraph: {
      commentThreads: [],
      commentPlacements: [],
      textChanges: [],
      structuralChanges: [],
      diagnosticItems: [
        {
          diagnosticId: 'diag-1',
          severity: 'warning',
          message: 'quarantine marker',
          targetScope: {
            type: 'scene',
            id: 'scene-1',
          },
          relatedItemId: '',
          createdAt: '2026-04-27T08:10:00.000Z',
        },
      ],
      decisionStates: [],
    },
  }));

  assert.equal(failed.ok, false);
  assert.equal(failed.reasons.some((reason) => reason.field === 'revisionSession.reviewGraph.diagnosticItems'), true);
  assert.equal(quarantined.ok, false);
  assert.equal(quarantined.reasons.some((reason) => reason.field === 'revisionSession.reviewGraph.diagnosticItems'), true);
  assert.equal(quarantinedWithDiagnostics.ok, true);
});

test('RB-23 evaluator is deterministic and does not mutate input', async () => {
  const bridge = await loadBridge();
  const input = baseSession({
    sessionState: 'Applying',
    previousSessionState: 'Planned',
    stateChangedAt: '2026-04-27T08:10:00.000Z',
    reviewGraph: {
      commentThreads: [],
      commentPlacements: [],
      textChanges: [minimalTextChange()],
      structuralChanges: [],
      diagnosticItems: [],
      decisionStates: [acceptedDecision()],
    },
  });
  const before = deepClone(input);

  const first = bridge.evaluateRevisionSessionStateInvariants(input);
  const second = bridge.evaluateRevisionSessionStateInvariants(input);

  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
});

test('RB-23 source section has no forbidden side effect tokens', () => {
  const source = fs.readFileSync(path.join(process.cwd(), MODULE_PATH), 'utf8');
  const start = source.indexOf('// RB_23_REVISION_SESSION_STATE_INVARIANTS_CONTRACTS_START');
  const end = source.indexOf('// RB_23_REVISION_SESSION_STATE_INVARIANTS_CONTRACTS_END');
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
    assert.equal(section.includes(token), false, `${token} must not appear in RB-23 section`);
  }
});

test('RB-23 changed files stay allowlisted and package manifests are untouched', () => {
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
