const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-donor-confidence-utils.contract.test.js';
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

test('RB-20 exports donor confidence helpers', async () => {
  const bridge = await loadBridge();

  assert.equal(typeof bridge.normalizeRevisionBridgeConfidenceLevel, 'function');
  assert.equal(typeof bridge.summarizeRevisionBridgeConfidenceLevels, 'function');
  assert.equal(typeof bridge.resolveRevisionBridgeOverallConfidence, 'function');
  assert.equal(typeof bridge.makeRevisionBridgeDiagnostic, 'function');
  assert.equal(typeof bridge.formatRevisionBridgeDiagnosticsAsText, 'function');
});

test('RB-20 normalizes donor aliases and canonical values', async () => {
  const bridge = await loadBridge();
  const cases = [
    ['exact', 'exact'],
    ['strongHigh', 'strongHigh'],
    ['strong-high', 'strongHigh'],
    ['strong_high', 'strongHigh'],
    ['strong high', 'strongHigh'],
    ['high', 'strongHigh'],
    ['weakHigh', 'weakHigh'],
    ['weak-high', 'weakHigh'],
    ['weak_high', 'weakHigh'],
    ['weak high', 'weakHigh'],
    ['approximate', 'approximate'],
    ['unresolved', 'unresolved'],
    ['unknown', 'unresolved'],
    ['', 'unresolved'],
  ];

  for (const [input, expected] of cases) {
    assert.equal(bridge.normalizeRevisionBridgeConfidenceLevel(input), expected);
  }
});

test('RB-20 summarizes mixed confidence payloads deterministically', async () => {
  const bridge = await loadBridge();
  const input = [
    { confidence: 'exact' },
    { confidence: 'strong-high' },
    { confidence: 'weak_high' },
    { confidence: 'approximate' },
    { confidence: 'unknown' },
    'high',
    'weakHigh',
  ];

  const first = bridge.summarizeRevisionBridgeConfidenceLevels(input);
  const second = bridge.summarizeRevisionBridgeConfidenceLevels(input);

  assert.deepEqual(first, second);
  assert.deepEqual(first, {
    exact: 1,
    strongHigh: 2,
    weakHigh: 2,
    high: 4,
    approximate: 1,
    unresolved: 1,
  });
});

test('RB-20 resolves overall confidence by strict severity precedence', async () => {
  const bridge = await loadBridge();

  assert.equal(bridge.resolveRevisionBridgeOverallConfidence({ unresolved: 1 }), 'unresolved');
  assert.equal(bridge.resolveRevisionBridgeOverallConfidence({ approximate: 1 }), 'approximate');
  assert.equal(bridge.resolveRevisionBridgeOverallConfidence({ weakHigh: 1 }), 'weakHigh');
  assert.equal(bridge.resolveRevisionBridgeOverallConfidence({ strongHigh: 1 }), 'strongHigh');
  assert.equal(bridge.resolveRevisionBridgeOverallConfidence({ high: 1 }), 'strongHigh');
  assert.equal(bridge.resolveRevisionBridgeOverallConfidence({}), 'exact');
});

test('RB-20 helper inputs are not mutated', async () => {
  const bridge = await loadBridge();
  const list = [{ confidence: 'strong-high' }];
  const counts = { weakHigh: 2 };
  const beforeList = deepClone(list);
  const beforeCounts = deepClone(counts);

  bridge.summarizeRevisionBridgeConfidenceLevels(list);
  bridge.resolveRevisionBridgeOverallConfidence(counts);

  assert.deepEqual(list, beforeList);
  assert.deepEqual(counts, beforeCounts);
});

test('RB-20 diagnostic helper normalizes fallback values', async () => {
  const bridge = await loadBridge();
  const result = bridge.makeRevisionBridgeDiagnostic('', null, [], 77);

  assert.deepEqual(result, {
    code: 'RB_UNKNOWN',
    message: 'Unknown Revision Bridge diagnostic',
    severity: 'warn',
    details: {},
  });
});

test('RB-20 diagnostics formatter is deterministic and donor-compatible', async () => {
  const bridge = await loadBridge();
  const bundle = {
    manifest: {
      id: 'session-1',
      exportSessionId: 'export-1',
      status: 'diagnosed',
      overallConfidence: 'weakHigh',
      sourceFilename: 'draft.docx',
      baselineHash: 'baseline-1',
      projectId: 'project-1',
    },
    diagnostics: [
      { code: 'RB_CODE', message: 'Issue detected' },
    ],
    unresolvedItems: [
      { id: 'u-1', kind: 'comment', message: 'Manual placement required' },
    ],
    structuralChanges: [
      { id: 's-1', operation: 'split-scene', policy: 'manualOnly' },
    ],
    commentPlacements: [
      { id: 'p-1', anchorType: 'span-anchor', confidence: 'weak-high' },
    ],
  };
  const before = deepClone(bundle);

  const first = bridge.formatRevisionBridgeDiagnosticsAsText(bundle);
  const second = bridge.formatRevisionBridgeDiagnosticsAsText(bundle);

  assert.deepEqual(first, second);
  assert.deepEqual(bundle, before);
  assert.equal(first, [
    'revisionSessionId=session-1',
    'exportSessionId=export-1',
    'status=diagnosed',
    'overallConfidence=weakHigh',
    'sourceFilename=draft.docx',
    'baselineHash=baseline-1',
    'projectId=project-1',
    '',
    '[diagnostics]',
    '- RB_CODE :: Issue detected',
    '',
    '[unresolved]',
    '- u-1 :: comment :: Manual placement required',
    '',
    '[structural]',
    '- s-1 :: split-scene :: manualOnly',
    '',
    '[comments]',
    '- p-1 :: span-anchor :: high',
    '',
  ].join('\n'));
});

test('RB-20 source section has no forbidden side-effect tokens', () => {
  const source = fs.readFileSync(path.join(process.cwd(), MODULE_PATH), 'utf8');
  const start = source.indexOf('// RB_20_DONOR_CONFIDENCE_UTILS_START');
  const end = source.indexOf('// RB_20_DONOR_CONFIDENCE_UTILS_END');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const section = source.slice(start, end);
  const forbiddenTokens = [
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
    assert.equal(section.includes(token), false, `${token} must not appear in RB-20 section`);
  }
});

test('RB-20 changed files stay allowlisted and package manifests are untouched', () => {
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
