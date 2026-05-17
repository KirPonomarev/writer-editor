const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-match-proof-contract.contract.test.js';
const CORE_INLINE_MODULE_PATH = 'src/core/sceneInlineRangeAdmission.mjs';
const CORE_INLINE_TEST_PATH = 'test/contracts/scene-inline-range-admission.contract.test.js';
const RB10_TEST_PATH = 'test/contracts/revision-bridge-inline-range-anchor-contract.contract.test.js';
const RB11_TEST_PATH = 'test/contracts/revision-bridge-anchor-confidence-engine-contract.contract.test.js';
const ALLOWLIST = [MODULE_PATH, TEST_PATH, CORE_INLINE_MODULE_PATH, CORE_INLINE_TEST_PATH, RB10_TEST_PATH, RB11_TEST_PATH];

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
    'blockRef',
    'comparedRange',
    'expectedQuote',
    'observedQuote',
    'prefixProof',
    'suffixProof',
    'reasonCodes',
    'diagnostics',
  ]);
}

function assertNoAutomationOrPatchFields(value) {
  const seen = new Set();
  function visit(candidate) {
    if (!candidate || typeof candidate !== 'object' || seen.has(candidate)) return;
    seen.add(candidate);
    for (const [key, nested] of Object.entries(candidate)) {
      assert.equal(key.includes('automation'), false, `${key} must not be present`);
      assert.equal(key.toLowerCase().includes('apply'), false, `${key} must not be present`);
      visit(nested);
    }
  }
  visit(value);
}

test('RB-12 exports exact match proof public API and frozen reason catalog', async () => {
  const bridge = await loadBridge();

  assert.equal(bridge.REVISION_BRIDGE_MATCH_PROOF_SCHEMA, 'revision-bridge.match-proof.v1');
  assert.equal(typeof bridge.buildInlineRangeMatchProof, 'function');
  assert.equal(Object.isFrozen(bridge.REVISION_BRIDGE_MATCH_PROOF_REASON_CODES), true);
  assert.deepEqual(bridge.REVISION_BRIDGE_MATCH_PROOF_REASON_CODES, [
    'REVISION_BRIDGE_MATCH_PROOF_BUILT',
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_EXACT_RANGE',
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_VALIDATION_FAILED',
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_MISSING_BLOCK',
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_OUT_OF_BOUNDS',
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_STALE_QUOTE',
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_QUOTE_ELSEWHERE',
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_PREFIX_MISMATCH',
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_SUFFIX_MISMATCH',
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_ORPHAN',
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_DELETED_TARGET',
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_WEAK_ANCHOR',
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_UNRESOLVED_ANCHOR',
  ]);
});

test('RB-12 exact quote at exact range returns matched proof', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildInlineRangeMatchProof(validInlineRange({
    prefix: '',
    suffix: '',
  }), {
    blockMap: {
      'block-1': {
        lineageId: 'lineage-1',
        text: 'Alpha beta gamma.',
      },
    },
  });

  assertReturnShape(result);
  assert.equal(result.schemaVersion, 'revision-bridge.match-proof.v1');
  assert.equal(result.type, 'revisionBridge.matchProof');
  assert.equal(result.status, 'matched');
  assert.equal(result.code, 'REVISION_BRIDGE_MATCH_PROOF_BUILT');
  assert.equal(result.reason, 'REVISION_BRIDGE_ANCHOR_CONFIDENCE_EXACT_RANGE');
  assert.equal(result.expectedQuote, 'Alpha');
  assert.equal(result.observedQuote, 'Alpha');
  assert.deepEqual(result.comparedRange, { from: 0, to: 5, inBounds: true });
  assert.deepEqual(result.prefixProof, { expected: '', observed: '', matched: true });
  assert.deepEqual(result.suffixProof, { expected: '', observed: '', matched: true });
  assert.deepEqual(result.reasonCodes, ['REVISION_BRIDGE_ANCHOR_CONFIDENCE_EXACT_RANGE']);
});

test('RB-12 quote elsewhere returns partial first occurrence proof without exact reason', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildInlineRangeMatchProof(validInlineRange({
    from: 6,
    to: 10,
    quote: 'Alpha',
  }), validContext('Alpha beta Alpha.'));

  assert.equal(result.status, 'partial');
  assert.deepEqual(result.comparedRange, { from: 0, to: 5, inBounds: true });
  assert.equal(result.observedQuote, 'Alpha');
  assert.equal(result.reasonCodes.includes('REVISION_BRIDGE_ANCHOR_CONFIDENCE_QUOTE_ELSEWHERE'), true);
  assert.equal(result.reasonCodes.includes('REVISION_BRIDGE_ANCHOR_CONFIDENCE_EXACT_RANGE'), false);
});

test('RB-12 stale quote returns unresolved proof with stale quote reason', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildInlineRangeMatchProof(validInlineRange({
    to: 13,
    quote: 'Missing quote',
  }), {
    blocks: {
      'block-1': {
        lineageId: 'lineage-1',
        text: 'Alpha beta gamma.',
      },
    },
  });

  assert.equal(result.status, 'unresolved');
  assert.equal(result.reasonCodes.includes('REVISION_BRIDGE_ANCHOR_CONFIDENCE_STALE_QUOTE'), true);
  assert.equal(result.observedQuote, 'Alpha beta ga');
});

test('RB-12 missing block returns unresolved proof with missing block reason', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildInlineRangeMatchProof(validInlineRange(), { blocks: [] });

  assert.equal(result.status, 'unresolved');
  assert.deepEqual(result.blockRef, {
    blockId: 'block-1',
    lineageId: 'lineage-1',
    hasContextBlock: false,
  });
  assert.equal(result.reasonCodes.includes('REVISION_BRIDGE_ANCHOR_CONFIDENCE_MISSING_BLOCK'), true);
  assert.equal(result.observedQuote, '');
});

test('RB-12 out of bounds returns hardFail proof with out of bounds reason', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildInlineRangeMatchProof(validInlineRange({
    to: 999,
  }), validContext());

  assert.equal(result.status, 'hardFail');
  assert.equal(result.code, 'REVISION_BRIDGE_MATCH_PROOF_BUILT');
  assert.deepEqual(result.comparedRange, { from: 0, to: 999, inBounds: false });
  assert.equal(result.observedQuote, '');
  assert.equal(result.reasonCodes.includes('REVISION_BRIDGE_ANCHOR_CONFIDENCE_OUT_OF_BOUNDS'), true);
});

test('RB-12 preserves exact proof for CRLF and LF variants when range and quote stay in the same raw text space', async () => {
  const bridge = await loadBridge();
  const crlf = bridge.buildInlineRangeMatchProof(validInlineRange({
    from: 0,
    to: 9,
    quote: '\r\nAlpha\r\n',
  }), validContext('\r\nAlpha\r\n'));
  const lf = bridge.buildInlineRangeMatchProof(validInlineRange({
    from: 0,
    to: 7,
    quote: '\nAlpha\n',
  }), validContext('\nAlpha\n'));

  assert.equal(crlf.status, 'matched');
  assert.equal(lf.status, 'matched');
  assert.equal(crlf.reasonCodes.includes('REVISION_BRIDGE_ANCHOR_CONFIDENCE_EXACT_RANGE'), true);
  assert.equal(lf.reasonCodes.includes('REVISION_BRIDGE_ANCHOR_CONFIDENCE_EXACT_RANGE'), true);
  assert.deepEqual(crlf.comparedRange, { from: 0, to: 9, inBounds: true });
  assert.deepEqual(lf.comparedRange, { from: 0, to: 7, inBounds: true });
});

test('RB-12 prefix and suffix mismatches produce deterministic proofs and diagnostics', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildInlineRangeMatchProof(validInlineRange({
    from: 4,
    to: 9,
    quote: 'Alpha',
    prefix: 'xxx',
    suffix: 'yyy',
  }), validContext('one Alpha two'));

  assert.equal(result.status, 'partial');
  assert.deepEqual(result.prefixProof, { expected: 'xxx', observed: 'ne ', matched: false });
  assert.deepEqual(result.suffixProof, { expected: 'yyy', observed: ' tw', matched: false });
  assert.equal(result.reasonCodes.includes('REVISION_BRIDGE_ANCHOR_CONFIDENCE_PREFIX_MISMATCH'), true);
  assert.equal(result.reasonCodes.includes('REVISION_BRIDGE_ANCHOR_CONFIDENCE_SUFFIX_MISMATCH'), true);
});

test('RB-12 orphan and deleted target remain unresolved and omit automation or patch fields', async () => {
  const bridge = await loadBridge();
  const orphan = bridge.buildInlineRangeMatchProof(validInlineRange({
    kind: 'orphan',
    blockId: '',
    lineageId: '',
    from: 0,
    to: 0,
    quote: '',
    confidence: 'unresolved',
    automationPolicy: 'diagnosticsOnly',
  }), validContext());
  const deleted = bridge.buildInlineRangeMatchProof(validInlineRange({
    kind: 'deleted',
    from: 5,
    to: 5,
    quote: '',
    deletedTarget: true,
  }), validContext());

  assert.equal(orphan.status, 'unresolved');
  assert.equal(orphan.reasonCodes.includes('REVISION_BRIDGE_ANCHOR_CONFIDENCE_ORPHAN'), true);
  assert.equal(deleted.status, 'unresolved');
  assert.equal(deleted.reasonCodes.includes('REVISION_BRIDGE_ANCHOR_CONFIDENCE_DELETED_TARGET'), true);
  assertNoAutomationOrPatchFields(orphan);
  assertNoAutomationOrPatchFields(deleted);
});

test('RB-12 input and context are not mutated', async () => {
  const bridge = await loadBridge();
  const input = {
    inlineRange: validInlineRange({ reasonCodes: ['fixture'] }),
  };
  const context = validContext();
  const beforeInput = deepClone(input);
  const beforeContext = deepClone(context);

  bridge.buildInlineRangeMatchProof(input, context);

  assert.deepEqual(input, beforeInput);
  assert.deepEqual(context, beforeContext);
});

test('RB-12 preserves RB-11 evaluator return shape and reason catalog', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateInlineRangeAnchorConfidence(validInlineRange(), validContext());

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
  assert.deepEqual(bridge.REVISION_BRIDGE_ANCHOR_CONFIDENCE_REASON_CODES, [
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_EXACT_RANGE',
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_VALIDATION_FAILED',
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_MISSING_BLOCK',
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_OUT_OF_BOUNDS',
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_STALE_QUOTE',
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_QUOTE_ELSEWHERE',
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_PREFIX_MISMATCH',
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_SUFFIX_MISMATCH',
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_ORPHAN',
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_DELETED_TARGET',
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_WEAK_ANCHOR',
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_UNRESOLVED_ANCHOR',
  ]);
});

test('RB-12 source section has no forbidden parser storage UI network time random patch or dependency tokens', () => {
  const source = fs.readFileSync(path.join(process.cwd(), MODULE_PATH), 'utf8');
  const start = source.indexOf('// RB_12_MATCH_PROOF_CONTRACTS_START');
  const end = source.indexOf('// RB_12_MATCH_PROOF_CONTRACTS_END');
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
    'dependency',
  ];

  for (const token of forbiddenTokens) {
    assert.equal(section.includes(token), false, `${token} must not appear in RB-12 section`);
  }
});

test('RB-12 changed files stay allowlisted and package manifests are untouched', () => {
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
