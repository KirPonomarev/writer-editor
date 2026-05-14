const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-anchor-confidence-engine-contract.contract.test.js';
const RB10_TEST_PATH = 'test/contracts/revision-bridge-inline-range-anchor-contract.contract.test.js';
const RB19_TEST_PATH = 'test/contracts/revision-bridge-exact-text-apply-plan-no-disk.contract.test.js';
const C04_MODULE_PATH = 'src/io/revisionBridge/exactTextMinSafeWrite.mjs';
const C04_TEST_PATH = 'test/contracts/revision-bridge-exact-text-min-safe-write.contract.test.js';
const C05_TEST_PATH = 'test/contracts/revision-bridge-comment-survival.contract.test.js';
const P0_TEST_PATH = 'test/contracts/revision-bridge-p0-safety-kernel.contract.test.js';
const C06_TEST_PATH = 'test/contracts/revision-bridge-minimal-block-id.contract.test.js';
const C08_TEST_PATH = 'test/contracts/revision-bridge-structural-manual-review.contract.test.js';
const GOVERNANCE_APPROVALS_PATH = 'docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json';
const ALLOWLIST = [MODULE_PATH, TEST_PATH, RB10_TEST_PATH, RB19_TEST_PATH, C04_MODULE_PATH, C04_TEST_PATH, C05_TEST_PATH, P0_TEST_PATH, C06_TEST_PATH, C08_TEST_PATH, GOVERNANCE_APPROVALS_PATH];

async function loadBridge() {
  return import(pathToFileURL(path.join(process.cwd(), MODULE_PATH)).href);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validInlineRange(overrides = {}) {
  return {
    schemaVersion: 'revision-bridge.inline-range.v1',
    kind: 'span',
    blockId: 'block-1',
    lineageId: 'lineage-1',
    from: 0,
    to: 5,
    quote: 'Alpha',
    prefix: '',
    suffix: '',
    confidence: 'exact',
    riskClass: 'low',
    automationPolicy: 'manualOnly',
    deletedTarget: false,
    reasonCodes: [],
    ...overrides,
  };
}

function validContext(text = 'Alpha beta gamma.') {
  return {
    blocks: [
      {
        schemaVersion: 'revision-bridge.block.v1',
        blockId: 'block-1',
        lineageId: 'lineage-1',
        versionHash: 'version-1',
        kind: 'paragraph',
        order: 0,
        text,
        attrs: {},
        source: {},
      },
    ],
  };
}

function changedFilesFromGitStatus(statusText) {
  return statusText
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => line.slice(3).replace(/^"|"$/gu, ''));
}

function assertReturnShape(result) {
  assert.deepEqual(Object.keys(result), [
    'schemaVersion',
    'type',
    'status',
    'code',
    'reason',
    'inlineRange',
    'confidence',
    'riskClass',
    'automationPolicy',
    'reasonCodes',
    'diagnostics',
  ]);
}

test('RB-11 exports exact anchor confidence public API and schema', async () => {
  const bridge = await loadBridge();

  assert.equal(
    bridge.REVISION_BRIDGE_ANCHOR_CONFIDENCE_EVALUATION_SCHEMA,
    'revision-bridge.anchor-confidence-evaluation.v1',
  );
  assert.notEqual(bridge.REVISION_BRIDGE_ANCHOR_CONFIDENCE_REASON_CODES, undefined);
  assert.equal(Object.isFrozen(bridge.REVISION_BRIDGE_ANCHOR_CONFIDENCE_REASON_CODES), true);
  assert.equal(typeof bridge.evaluateInlineRangeAnchorConfidence, 'function');
  assert.equal(
    bridge.REVISION_BRIDGE_ANCHOR_CONFIDENCE_REASON_CODES.includes('REVISION_BRIDGE_ANCHOR_CONFIDENCE_EXACT_RANGE'),
    true,
  );
});

test('RB-11 exact quote at exact range gives exact low risk bounded automation', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateInlineRangeAnchorConfidence(validInlineRange(), validContext());

  assertReturnShape(result);
  assert.equal(result.schemaVersion, 'revision-bridge.anchor-confidence-evaluation.v1');
  assert.equal(result.type, 'revisionBridge.anchorConfidence.evaluation');
  assert.equal(result.status, 'evaluated');
  assert.equal(result.confidence, 'exact');
  assert.equal(result.riskClass, 'low');
  assert.equal(result.automationPolicy, 'manualConfirmRequired');
  assert.notEqual(result.automationPolicy, 'autoEligible');
  assert.deepEqual(result.reasonCodes, ['REVISION_BRIDGE_ANCHOR_CONFIDENCE_EXACT_RANGE']);
});

test('RB-11 stale quote downgrades and reports reason', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateInlineRangeAnchorConfidence(validInlineRange({
    quote: 'Missing quote',
    to: 13,
  }), validContext());

  assert.equal(result.status, 'diagnostics');
  assert.equal(result.confidence, 'unresolved');
  assert.equal(result.automationPolicy, 'diagnosticsOnly');
  assert.equal(result.reasonCodes.includes('REVISION_BRIDGE_ANCHOR_CONFIDENCE_STALE_QUOTE'), true);
});

test('RB-11 quote elsewhere is not exact range', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateInlineRangeAnchorConfidence(validInlineRange({
    from: 6,
    to: 10,
    quote: 'Alpha',
  }), validContext('Alpha beta Alpha.'));

  assert.equal(result.status, 'diagnostics');
  assert.equal(result.confidence, 'approximate');
  assert.equal(result.automationPolicy, 'manualOnly');
  assert.equal(result.reasonCodes.includes('REVISION_BRIDGE_ANCHOR_CONFIDENCE_QUOTE_ELSEWHERE'), true);
  assert.equal(result.reasonCodes.includes('REVISION_BRIDGE_ANCHOR_CONFIDENCE_EXACT_RANGE'), false);
});

test('RB-11 missing block is unresolved diagnostics', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateInlineRangeAnchorConfidence(validInlineRange(), { blocks: [] });

  assert.equal(result.status, 'diagnostics');
  assert.equal(result.confidence, 'unresolved');
  assert.equal(result.riskClass, 'high');
  assert.equal(result.automationPolicy, 'diagnosticsOnly');
  assert.equal(result.reasonCodes.includes('REVISION_BRIDGE_ANCHOR_CONFIDENCE_MISSING_BLOCK'), true);
});

test('RB-11 out-of-bounds range is hard failure or diagnostics only', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateInlineRangeAnchorConfidence(validInlineRange({
    to: 999,
  }), validContext());

  assert.equal(result.confidence, 'unresolved');
  assert.equal(['hardFail', 'diagnosticsOnly'].includes(result.automationPolicy), true);
  assert.notEqual(result.automationPolicy, 'autoEligible');
  assert.equal(result.reasonCodes.includes('REVISION_BRIDGE_ANCHOR_CONFIDENCE_OUT_OF_BOUNDS'), true);
});

test('RB-11 orphan remains unresolved', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateInlineRangeAnchorConfidence(validInlineRange({
    kind: 'orphan',
    blockId: '',
    lineageId: '',
    from: 0,
    to: 0,
    quote: '',
    confidence: 'unresolved',
    automationPolicy: 'diagnosticsOnly',
  }), validContext());

  assert.equal(result.confidence, 'unresolved');
  assert.equal(result.automationPolicy, 'diagnosticsOnly');
  assert.equal(result.reasonCodes.includes('REVISION_BRIDGE_ANCHOR_CONFIDENCE_ORPHAN'), true);
});

test('RB-11 deleted target is never auto eligible', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateInlineRangeAnchorConfidence(validInlineRange({
    kind: 'deleted',
    from: 5,
    to: 5,
    quote: '',
    deletedTarget: true,
  }), validContext());

  assert.equal(result.confidence, 'unresolved');
  assert.equal(result.automationPolicy, 'diagnosticsOnly');
  assert.notEqual(result.automationPolicy, 'autoEligible');
  assert.equal(result.reasonCodes.includes('REVISION_BRIDGE_ANCHOR_CONFIDENCE_DELETED_TARGET'), true);
});

test('RB-11 prefix mismatch and suffix mismatch are diagnosed', async () => {
  const bridge = await loadBridge();
  const prefix = bridge.evaluateInlineRangeAnchorConfidence(validInlineRange({
    from: 6,
    to: 10,
    quote: 'beta',
    prefix: 'wrong',
  }), validContext());
  const suffix = bridge.evaluateInlineRangeAnchorConfidence(validInlineRange({
    quote: 'Alpha',
    suffix: 'wrong',
  }), validContext());

  assert.equal(prefix.reasonCodes.includes('REVISION_BRIDGE_ANCHOR_CONFIDENCE_PREFIX_MISMATCH'), true);
  assert.equal(suffix.reasonCodes.includes('REVISION_BRIDGE_ANCHOR_CONFIDENCE_SUFFIX_MISMATCH'), true);
  assert.equal(prefix.automationPolicy, 'manualOnly');
  assert.equal(suffix.automationPolicy, 'manualOnly');
});

test('RB-11 weak and unresolved anchors are never auto eligible', async () => {
  const bridge = await loadBridge();
  const weak = bridge.evaluateInlineRangeAnchorConfidence(validInlineRange({
    confidence: 'weakHigh',
  }), validContext());
  const approximate = bridge.evaluateInlineRangeAnchorConfidence(validInlineRange({
    confidence: 'approximate',
  }), validContext());
  const unresolved = bridge.evaluateInlineRangeAnchorConfidence(validInlineRange({
    quote: '',
    confidence: 'unresolved',
    automationPolicy: 'diagnosticsOnly',
  }), validContext());

  assert.notEqual(weak.automationPolicy, 'autoEligible');
  assert.notEqual(approximate.automationPolicy, 'autoEligible');
  assert.notEqual(unresolved.automationPolicy, 'autoEligible');
  assert.equal(weak.reasonCodes.includes('REVISION_BRIDGE_ANCHOR_CONFIDENCE_WEAK_ANCHOR'), true);
  assert.equal(approximate.reasonCodes.includes('REVISION_BRIDGE_ANCHOR_CONFIDENCE_WEAK_ANCHOR'), true);
  assert.equal(unresolved.reasonCodes.includes('REVISION_BRIDGE_ANCHOR_CONFIDENCE_UNRESOLVED_ANCHOR'), true);
});

test('RB-11 input and context are not mutated', async () => {
  const bridge = await loadBridge();
  const input = {
    inlineRange: validInlineRange({ reasonCodes: ['fixture'] }),
  };
  const context = {
    blockMap: {
      'block-1': {
        text: 'Alpha beta gamma.',
      },
    },
  };
  const beforeInput = deepClone(input);
  const beforeContext = deepClone(context);

  bridge.evaluateInlineRangeAnchorConfidence(input, context);

  assert.deepEqual(input, beforeInput);
  assert.deepEqual(context, beforeContext);
});

test('RB-11 implementation section has no forbidden parser storage UI network time random or apply tokens', () => {
  const source = fs.readFileSync(path.join(process.cwd(), MODULE_PATH), 'utf8');
  const start = source.indexOf('// RB_11_ANCHOR_CONFIDENCE_ENGINE_CONTRACTS_START');
  const end = source.indexOf('// RB_11_ANCHOR_CONFIDENCE_ENGINE_CONTRACTS_END');
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
    'DOMParser',
    'XMLParser',
    'xmldom',
    'sax',
    'fast-xml-parser',
    'JSZip',
    'yauzl',
    'admzip',
    'unzip',
    'inflate',
    'deflate',
    'readFile',
    'writeFile',
    'crypto',
    'Date.now',
    'new Date',
    'Math.random',
    'setTimeout',
    'setInterval',
    'parser',
    'storage',
    'network',
    'UI',
    'apply',
    'reviewPacket',
    'previewInput',
    'applyPlan',
    'canApply',
  ];

  for (const token of forbiddenTokens) {
    assert.equal(section.includes(token), false, `${token} must not appear in RB-11 section`);
  }
});

test('RB-11 changed files stay allowlisted and package manifests are untouched', () => {
  const statusText = execFileSync('git', ['status', '--short'], { encoding: 'utf8' });
  const changedFiles = changedFilesFromGitStatus(statusText);
  const outsideAllowlist = changedFiles.filter((filePath) => !ALLOWLIST.includes(filePath));
  const packageManifestDiff = changedFiles.filter((filePath) => (
    filePath === 'package.json'
    || filePath === 'package-lock.json'
    || filePath === 'npm-shrinkwrap.json'
  ));

  assert.deepEqual(outsideAllowlist, []);
  assert.deepEqual(packageManifestDiff, []);
});
