const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-revision-session-version-tags.contract.test.js';
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

test('RB-22 exports version tags helper and defaults', async () => {
  const bridge = await loadBridge();

  assert.deepEqual(bridge.REVISION_BRIDGE_REVISION_SESSION_VERSION_TAGS, {
    parserVersion: 'revision-bridge.parser.v1',
    matcherVersion: 'revision-bridge.matcher.v1',
    policyVersion: 'revision-bridge.policy.v1',
    receiptVersion: 'revision-bridge.receipt.v1',
  });
  assert.equal(typeof bridge.normalizeRevisionSessionVersionTags, 'function');
});

test('RB-22 applies default version tags when fields are omitted', async () => {
  const bridge = await loadBridge();
  const session = bridge.createRevisionSession(validRevisionSession());

  assert.equal(session.parserVersion, 'revision-bridge.parser.v1');
  assert.equal(session.matcherVersion, 'revision-bridge.matcher.v1');
  assert.equal(session.policyVersion, 'revision-bridge.policy.v1');
  assert.equal(session.receiptVersion, 'revision-bridge.receipt.v1');
});

test('RB-22 preserves explicit version tags and validates non-string payloads', async () => {
  const bridge = await loadBridge();
  const custom = bridge.createRevisionSession(validRevisionSession({
    parserVersion: 'parser.custom.v3',
    matcherVersion: 'matcher.custom.v4',
    policyVersion: 'policy.custom.v2',
    receiptVersion: 'receipt.custom.v5',
  }));
  const invalid = bridge.validateRevisionSession(validRevisionSession({
    parserVersion: 7,
    matcherVersion: {},
  }));

  assert.equal(custom.parserVersion, 'parser.custom.v3');
  assert.equal(custom.matcherVersion, 'matcher.custom.v4');
  assert.equal(custom.policyVersion, 'policy.custom.v2');
  assert.equal(custom.receiptVersion, 'receipt.custom.v5');
  assert.equal(invalid.ok, false);
  assert.equal(invalid.reasons.some((reason) => reason.field === 'revisionSession.parserVersion'), true);
  assert.equal(invalid.reasons.some((reason) => reason.field === 'revisionSession.matcherVersion'), true);
});

test('RB-22 version helpers are deterministic and do not mutate inputs', async () => {
  const bridge = await loadBridge();
  const input = validRevisionSession({
    parserVersion: 'parser.custom.v3',
    matcherVersion: 'matcher.custom.v4',
    policyVersion: 'policy.custom.v2',
    receiptVersion: 'receipt.custom.v5',
  });
  const before = deepClone(input);
  const first = bridge.createRevisionSession(input);
  const second = bridge.createRevisionSession(input);

  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
});

test('RB-22 source section has no forbidden side effect tokens', () => {
  const source = fs.readFileSync(path.join(process.cwd(), MODULE_PATH), 'utf8');
  const start = source.indexOf('// RB_22_REVISION_SESSION_VERSION_TAGS_CONTRACTS_START');
  const end = source.indexOf('// RB_22_REVISION_SESSION_VERSION_TAGS_CONTRACTS_END');
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
    assert.equal(section.includes(token), false, `${token} must not appear in RB-22 section`);
  }
});

test('RB-22 changed files stay allowlisted and package manifests are untouched', () => {
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
