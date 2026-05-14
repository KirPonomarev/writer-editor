const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-inline-range-anchor-contract.contract.test.js';
const RB11_TEST_PATH = 'test/contracts/revision-bridge-anchor-confidence-engine-contract.contract.test.js';
const RB19_TEST_PATH = 'test/contracts/revision-bridge-exact-text-apply-plan-no-disk.contract.test.js';
const C04_TEST_PATH = 'test/contracts/revision-bridge-exact-text-min-safe-write.contract.test.js';
const C05_TEST_PATH = 'test/contracts/revision-bridge-comment-survival.contract.test.js';
const P0_TEST_PATH = 'test/contracts/revision-bridge-p0-safety-kernel.contract.test.js';
const C06_TEST_PATH = 'test/contracts/revision-bridge-minimal-block-id.contract.test.js';
const ALLOWLIST = [MODULE_PATH, TEST_PATH, RB11_TEST_PATH, RB19_TEST_PATH, C04_TEST_PATH, C05_TEST_PATH, P0_TEST_PATH, C06_TEST_PATH];

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

function validContext() {
  return {
    blocks: [
      {
        schemaVersion: 'revision-bridge.block.v1',
        blockId: 'block-1',
        lineageId: 'lineage-1',
        versionHash: 'version-1',
        kind: 'paragraph',
        order: 0,
        text: 'Alpha beta gamma.',
        attrs: {},
        source: {},
      },
    ],
  };
}

function validPlacement(overrides = {}) {
  return {
    schemaVersion: 'revision-bridge.comment-anchor-placement.v1',
    placementId: 'placement-1',
    threadId: 'thread-1',
    targetScope: { type: 'scene', id: 'scene-1' },
    inlineRange: validInlineRange(),
    resolvedState: 'open',
    acceptedState: 'pending',
    diagnosticsOnly: false,
    ...overrides,
  };
}

function reasonCodes(result) {
  return result.reasons.map((reason) => reason.code);
}

function reasonFields(result) {
  return result.reasons.map((reason) => reason.field);
}

function changedFilesFromGitStatus(statusText) {
  return statusText
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => line.slice(3).replace(/^"|"$/gu, ''));
}

test('RB-10 exports exact inline range and comment anchor public API', async () => {
  const bridge = await loadBridge();
  const expectedExports = [
    'REVISION_BRIDGE_INLINE_RANGE_SCHEMA',
    'REVISION_BRIDGE_COMMENT_ANCHOR_PLACEMENT_SCHEMA',
    'REVISION_BRIDGE_INLINE_ANCHOR_KINDS',
    'REVISION_BRIDGE_MATCH_CONFIDENCE_LEVELS',
    'REVISION_BRIDGE_RISK_CLASSES',
    'REVISION_BRIDGE_AUTOMATION_POLICIES',
    'isRevisionInlineAnchorKind',
    'isRevisionMatchConfidence',
    'isRevisionRiskClass',
    'isRevisionAutomationPolicy',
    'createInlineRange',
    'validateInlineRange',
    'createCommentAnchorPlacement',
    'validateCommentAnchorPlacement',
  ];

  assert.equal(bridge.REVISION_BRIDGE_INLINE_RANGE_SCHEMA, 'revision-bridge.inline-range.v1');
  assert.equal(bridge.REVISION_BRIDGE_COMMENT_ANCHOR_PLACEMENT_SCHEMA, 'revision-bridge.comment-anchor-placement.v1');
  for (const exportName of expectedExports) {
    assert.notEqual(bridge[exportName], undefined, `${exportName} must be exported`);
  }
});

test('RB-10 inline enums are exact and frozen', async () => {
  const bridge = await loadBridge();

  assert.deepEqual(bridge.REVISION_BRIDGE_INLINE_ANCHOR_KINDS, ['point', 'span', 'deleted', 'orphan']);
  assert.deepEqual(bridge.REVISION_BRIDGE_MATCH_CONFIDENCE_LEVELS, [
    'exact',
    'strongHigh',
    'weakHigh',
    'approximate',
    'unresolved',
  ]);
  assert.deepEqual(bridge.REVISION_BRIDGE_RISK_CLASSES, ['low', 'medium', 'high', 'critical']);
  assert.deepEqual(bridge.REVISION_BRIDGE_AUTOMATION_POLICIES, [
    'autoEligible',
    'manualConfirmRequired',
    'manualOnly',
    'diagnosticsOnly',
    'hardFail',
  ]);
  assert.equal(Object.isFrozen(bridge.REVISION_BRIDGE_INLINE_ANCHOR_KINDS), true);
  assert.equal(Object.isFrozen(bridge.REVISION_BRIDGE_MATCH_CONFIDENCE_LEVELS), true);
  assert.equal(Object.isFrozen(bridge.REVISION_BRIDGE_RISK_CLASSES), true);
  assert.equal(Object.isFrozen(bridge.REVISION_BRIDGE_AUTOMATION_POLICIES), true);
  assert.equal(bridge.isRevisionInlineAnchorKind('span'), true);
  assert.equal(bridge.isRevisionInlineAnchorKind('missing'), false);
  assert.equal(bridge.isRevisionMatchConfidence('weakHigh'), true);
  assert.equal(bridge.isRevisionMatchConfidence('weak'), false);
  assert.equal(bridge.isRevisionRiskClass('critical'), true);
  assert.equal(bridge.isRevisionRiskClass('fatal'), false);
  assert.equal(bridge.isRevisionAutomationPolicy('manualOnly'), true);
  assert.equal(bridge.isRevisionAutomationPolicy('applyNow'), false);
});

test('RB-10 valid point collapsed range validates', async () => {
  const bridge = await loadBridge();
  const result = bridge.validateInlineRange(validInlineRange({
    kind: 'point',
    from: 5,
    to: 5,
    quote: '',
  }), validContext());

  assert.equal(result.ok, true);
  assert.equal(result.value.kind, 'point');
  assert.equal(result.value.from, 5);
  assert.equal(result.value.to, 5);
});

test('RB-10 valid span range validates', async () => {
  const bridge = await loadBridge();
  const result = bridge.validateInlineRange(validInlineRange(), validContext());

  assert.equal(result.ok, true);
  assert.equal(result.value.kind, 'span');
  assert.equal(result.value.quote, 'Alpha');
});

test('RB-10 reversed range is rejected', async () => {
  const bridge = await loadBridge();
  const result = bridge.validateInlineRange(validInlineRange({ from: 8, to: 2 }), validContext());

  assert.equal(result.ok, false);
  assert.equal(reasonFields(result).includes('inlineRange'), true);
});

test('RB-10 out-of-bounds range is rejected when context block text is supplied', async () => {
  const bridge = await loadBridge();
  const result = bridge.validateInlineRange(validInlineRange({ from: 0, to: 999 }), validContext());

  assert.equal(result.ok, false);
  assert.equal(reasonFields(result).includes('inlineRange.to'), true);
});

test('RB-10 deleted range preserves target and cannot be autoEligible', async () => {
  const bridge = await loadBridge();
  const deleted = validInlineRange({
    kind: 'deleted',
    from: 4,
    to: 4,
    quote: '',
    deletedTarget: true,
    automationPolicy: 'manualOnly',
  });
  const validResult = bridge.validateInlineRange(deleted, validContext());
  const invalidResult = bridge.validateInlineRange({
    ...deleted,
    automationPolicy: 'autoEligible',
  }, validContext());

  assert.equal(validResult.ok, true);
  assert.equal(validResult.value.deletedTarget, true);
  assert.equal(invalidResult.ok, false);
  assert.equal(reasonFields(invalidResult).includes('inlineRange.automationPolicy'), true);
});

test('RB-10 orphan placement is unresolved diagnosticsOnly and does not guess block', async () => {
  const bridge = await loadBridge();
  const result = bridge.validateInlineRange(validInlineRange({
    kind: 'orphan',
    blockId: '',
    lineageId: '',
    from: 0,
    to: 0,
    quote: '',
    confidence: 'unresolved',
    automationPolicy: 'diagnosticsOnly',
  }), validContext());

  assert.equal(result.ok, true);
  assert.equal(result.value.blockId, '');
  assert.equal(result.value.confidence, 'unresolved');
  assert.equal(result.value.automationPolicy, 'diagnosticsOnly');
});

test('RB-10 approximate and unresolved ranges are never autoEligible', async () => {
  const bridge = await loadBridge();
  const approximate = bridge.validateInlineRange(validInlineRange({
    confidence: 'approximate',
    quote: '',
    automationPolicy: 'autoEligible',
  }), validContext());
  const unresolved = bridge.validateInlineRange(validInlineRange({
    confidence: 'unresolved',
    quote: '',
    automationPolicy: 'autoEligible',
  }), validContext());

  assert.equal(approximate.ok, false);
  assert.equal(unresolved.ok, false);
  assert.equal(reasonFields(approximate).includes('inlineRange.automationPolicy'), true);
  assert.equal(reasonFields(unresolved).includes('inlineRange.automationPolicy'), true);
});

test('RB-10 exact quote mismatch against context block text is rejected with stale quote reason', async () => {
  const bridge = await loadBridge();
  const result = bridge.validateInlineRange(validInlineRange({
    quote: 'Not in block',
    to: 12,
  }), validContext());

  assert.equal(result.ok, false);
  assert.equal(reasonCodes(result).includes('REVISION_BRIDGE_INLINE_RANGE_STALE_QUOTE'), true);
});

test('RB-10 CommentAnchorPlacement composes InlineRange and rejects duplicated comment content', async () => {
  const bridge = await loadBridge();
  const validResult = bridge.validateCommentAnchorPlacement(validPlacement(), validContext());
  const missingThread = bridge.validateCommentAnchorPlacement(validPlacement({ threadId: '' }), validContext());
  const missingScopeType = bridge.validateCommentAnchorPlacement(validPlacement({
    targetScope: { id: 'scene-1' },
  }), validContext());
  const duplicatedBody = bridge.validateCommentAnchorPlacement(validPlacement({
    body: 'duplicate',
  }), validContext());
  const duplicatedText = bridge.validateCommentAnchorPlacement(validPlacement({
    text: 'duplicate',
  }), validContext());
  const duplicatedMessages = bridge.validateCommentAnchorPlacement(validPlacement({
    messages: [{ body: 'duplicate' }],
  }), validContext());
  const duplicatedCommentText = bridge.validateCommentAnchorPlacement(validPlacement({
    commentText: 'duplicate',
  }), validContext());

  assert.equal(validResult.ok, true);
  assert.equal(validResult.value.inlineRange.schemaVersion, 'revision-bridge.inline-range.v1');
  assert.equal(missingThread.ok, false);
  assert.equal(missingScopeType.ok, false);
  assert.equal(duplicatedBody.ok, false);
  assert.equal(duplicatedText.ok, false);
  assert.equal(duplicatedMessages.ok, false);
  assert.equal(duplicatedCommentText.ok, false);
  assert.equal(reasonFields(missingThread).includes('commentAnchorPlacement.threadId'), true);
  assert.equal(reasonFields(missingScopeType).includes('commentAnchorPlacement.targetScope.type'), true);
});

test('RB-10 functions do not mutate inputs', async () => {
  const bridge = await loadBridge();
  const rangeInput = validInlineRange({ reasonCodes: ['fixture'] });
  const placementInput = validPlacement({
    inlineRange: validInlineRange({ reasonCodes: ['anchor'] }),
  });
  const contextInput = validContext();
  const beforeRange = deepClone(rangeInput);
  const beforePlacement = deepClone(placementInput);
  const beforeContext = deepClone(contextInput);

  bridge.createInlineRange(rangeInput);
  bridge.validateInlineRange(rangeInput, contextInput);
  bridge.createCommentAnchorPlacement(placementInput);
  bridge.validateCommentAnchorPlacement(placementInput, contextInput);

  assert.deepEqual(rangeInput, beforeRange);
  assert.deepEqual(placementInput, beforePlacement);
  assert.deepEqual(contextInput, beforeContext);
});

test('RB-10 implementation section has no forbidden side effect or parser tokens', () => {
  const source = fs.readFileSync(path.join(process.cwd(), MODULE_PATH), 'utf8');
  const start = source.indexOf('// RB_10_INLINE_RANGE_ANCHOR_CONTRACTS_START');
  const end = source.indexOf('// RB_10_INLINE_RANGE_ANCHOR_CONTRACTS_END');
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
    'reviewPacket',
    'previewInput',
    'applyPlan',
    'canApply',
  ];

  for (const token of forbiddenTokens) {
    assert.equal(section.includes(token), false, `${token} must not appear in RB-10 section`);
  }
});

test('RB-10 changed files stay allowlisted and package manifests are untouched', () => {
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
