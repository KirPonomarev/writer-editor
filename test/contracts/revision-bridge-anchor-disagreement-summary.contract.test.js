const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-anchor-disagreement-summary.contract.test.js';
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

function inlineRange(overrides = {}) {
  return {
    schemaVersion: 'revision-bridge.inline-range.v1',
    kind: 'span',
    blockId: 'block-1',
    lineageId: 'lineage-1',
    from: 6,
    to: 10,
    quote: 'beta',
    prefix: 'Alpha ',
    suffix: ' ',
    confidence: 'exact',
    riskClass: 'low',
    automationPolicy: 'manualOnly',
    deletedTarget: false,
    reasonCodes: [],
    ...overrides,
  };
}

function context(text = 'Alpha beta gamma.') {
  return {
    blocks: {
      'block-1': {
        text,
      },
    },
  };
}

test('RB-30 exports anchor disagreement summary schema and evaluator', async () => {
  const bridge = await loadBridge();

  assert.equal(
    bridge.REVISION_BRIDGE_ANCHOR_DISAGREEMENT_SUMMARY_SCHEMA,
    'revision-bridge.anchor-disagreement-summary.v1',
  );
  assert.equal(typeof bridge.summarizeRevisionBridgeAnchorDisagreements, 'function');
});

test('RB-30 summarizes disagreement reason codes from anchor confidence evaluations', async () => {
  const bridge = await loadBridge();
  const result = bridge.summarizeRevisionBridgeAnchorDisagreements({
    entries: [
      {
        inlineRange: inlineRange({ quote: 'Alpha' }),
        context: context('Alpha beta Alpha.'),
      },
      {
        inlineRange: inlineRange({ prefix: 'wrong-prefix' }),
        context: context(),
      },
      {
        inlineRange: inlineRange({ suffix: 'wrong-suffix' }),
        context: context(),
      },
      {
        inlineRange: inlineRange({ quote: 'delta' }),
        context: context(),
      },
      {
        inlineRange: inlineRange({ blockId: 'missing-block' }),
        context: context(),
      },
      {
        inlineRange: inlineRange({ to: 100 }),
        context: context(),
      },
    ],
  });

  assert.equal(result.status, 'evaluated');
  assert.equal(result.code, 'REVISION_BRIDGE_REVIEWGRAPH_VALID');
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.totalEvaluated, 6);
  assert.equal(result.totalWithDisagreement, 6);
  assert.equal(result.counts.REVISION_BRIDGE_ANCHOR_CONFIDENCE_QUOTE_ELSEWHERE >= 1, true);
  assert.equal(result.counts.REVISION_BRIDGE_ANCHOR_CONFIDENCE_PREFIX_MISMATCH >= 1, true);
  assert.equal(result.counts.REVISION_BRIDGE_ANCHOR_CONFIDENCE_SUFFIX_MISMATCH >= 1, true);
  assert.equal(result.counts.REVISION_BRIDGE_ANCHOR_CONFIDENCE_STALE_QUOTE >= 1, true);
  assert.equal(result.counts.REVISION_BRIDGE_ANCHOR_CONFIDENCE_MISSING_BLOCK, 1);
  assert.equal(result.counts.REVISION_BRIDGE_ANCHOR_CONFIDENCE_OUT_OF_BOUNDS >= 1, true);
});

test('RB-30 reports invalid diagnostics for malformed disagreement entries', async () => {
  const bridge = await loadBridge();
  const result = bridge.summarizeRevisionBridgeAnchorDisagreements({
    entries: [null, 'bad', { evaluation: {} }],
  });

  assert.equal(result.status, 'invalid');
  assert.equal(result.code, 'E_REVISION_BRIDGE_REVIEWGRAPH_INVALID');
  assert.equal(result.diagnostics.length >= 2, true);
  assert.equal(result.diagnostics.some((item) => item.field === 'entries.0'), true);
});

test('RB-30 summary is deterministic and does not mutate input', async () => {
  const bridge = await loadBridge();
  const input = {
    entries: [
      {
        inlineRange: inlineRange(),
        context: context(),
      },
      {
        inlineRange: inlineRange({ prefix: 'wrong-prefix' }),
        context: context(),
      },
    ],
  };

  const before = deepClone(input);
  const first = bridge.summarizeRevisionBridgeAnchorDisagreements(input);
  const second = bridge.summarizeRevisionBridgeAnchorDisagreements(input);

  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
});

test('RB-30 source section has no forbidden side-effect tokens', () => {
  const source = fs.readFileSync(path.join(process.cwd(), MODULE_PATH), 'utf8');
  const start = source.indexOf('// RB_30_ANCHOR_DISAGREEMENT_SUMMARY_CONTRACTS_START');
  const end = source.indexOf('// RB_30_ANCHOR_DISAGREEMENT_SUMMARY_CONTRACTS_END');
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
    assert.equal(section.includes(token), false, `${token} must not appear in RB-30 section`);
  }
});

test('RB-30 changed files stay allowlisted and package manifests are untouched', () => {
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
