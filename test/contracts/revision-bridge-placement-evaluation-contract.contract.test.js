const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-placement-evaluation-contract.contract.test.js';
const ALLOWLIST = [MODULE_PATH, TEST_PATH];

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

function validContext(text = 'Alpha beta gamma.') {
  return {
    blockMap: {
      'block-1': {
        lineageId: 'lineage-1',
        text,
      },
    },
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
    'placement',
    'validation',
    'matchProof',
    'confidenceEvaluation',
    'reasonCodes',
    'diagnostics',
  ]);
}

function collectKeys(value) {
  const keys = [];
  const seen = new Set();
  function visit(candidate) {
    if (!candidate || typeof candidate !== 'object' || seen.has(candidate)) return;
    seen.add(candidate);
    for (const [key, nested] of Object.entries(candidate)) {
      keys.push(key);
      visit(nested);
    }
  }
  visit(value);
  return keys;
}

test('RB-13 exports exact placement evaluation schema function and frozen reason catalog', async () => {
  const bridge = await loadBridge();

  assert.equal(
    bridge.REVISION_BRIDGE_PLACEMENT_EVALUATION_SCHEMA,
    'revision-bridge.comment-anchor-placement-evaluation.v1',
  );
  assert.equal(typeof bridge.evaluateCommentAnchorPlacementProof, 'function');
  assert.equal(Object.isFrozen(bridge.REVISION_BRIDGE_PLACEMENT_EVALUATION_REASON_CODES), true);
  assert.deepEqual(bridge.REVISION_BRIDGE_PLACEMENT_EVALUATION_REASON_CODES, [
    'REVISION_BRIDGE_PLACEMENT_EVALUATION_EVALUATED',
    'REVISION_BRIDGE_PLACEMENT_EVALUATION_VALIDATION_FAILED',
    'REVISION_BRIDGE_PLACEMENT_EVALUATION_DIAGNOSTICS',
    'REVISION_BRIDGE_PLACEMENT_EVALUATION_UNRESOLVED',
    'REVISION_BRIDGE_PLACEMENT_EVALUATION_HARD_FAIL',
  ]);
});

test('RB-13 exact valid placement returns evaluated envelope with matched proof and exact confidence', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateCommentAnchorPlacementProof(validPlacement(), validContext());

  assertReturnShape(result);
  assert.equal(result.schemaVersion, 'revision-bridge.comment-anchor-placement-evaluation.v1');
  assert.equal(result.type, 'revisionBridge.commentAnchorPlacement.evaluation');
  assert.equal(result.status, 'evaluated');
  assert.equal(result.code, 'REVISION_BRIDGE_PLACEMENT_EVALUATION_EVALUATED');
  assert.equal(result.validation.ok, true);
  assert.equal(result.matchProof.status, 'matched');
  assert.equal(result.confidenceEvaluation.status, 'evaluated');
  assert.equal(result.confidenceEvaluation.confidence, 'exact');
  assert.deepEqual(result.reasonCodes, [
    'REVISION_BRIDGE_PLACEMENT_EVALUATION_EVALUATED',
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_EXACT_RANGE',
  ]);
  assert.deepEqual(Object.keys(result.placement), [
    'schemaVersion',
    'placementId',
    'threadId',
    'targetScope',
    'inlineRange',
    'resolvedState',
    'acceptedState',
    'diagnosticsOnly',
  ]);
  assert.equal(Object.hasOwn(result.placement.inlineRange, 'automationPolicy'), false);
});

test('RB-13 invalid placement returns non-throwing validation diagnostics with placement fields', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateCommentAnchorPlacementProof(validPlacement({
    threadId: '',
    body: 'duplicated content',
  }), validContext());

  assert.equal(['diagnostics', 'unresolved', 'hardFail'].includes(result.status), true);
  assert.equal(result.validation.ok, false);
  assert.equal(result.code, 'REVISION_BRIDGE_PLACEMENT_EVALUATION_VALIDATION_FAILED');
  assert.equal(result.reasonCodes[0], 'REVISION_BRIDGE_PLACEMENT_EVALUATION_VALIDATION_FAILED');
  assert.equal(
    result.validation.reasons.every((reason) => reason.field.startsWith('commentAnchorPlacement')),
    true,
  );
  assert.equal(
    result.diagnostics.some((diagnostic) => (
      diagnostic.code === 'REVISION_BRIDGE_PLACEMENT_EVALUATION_VALIDATION_FAILED'
      && diagnostic.field === 'commentAnchorPlacement.threadId'
    )),
    true,
  );
  assert.doesNotThrow(() => bridge.evaluateCommentAnchorPlacementProof(null, validContext()));
});

test('RB-13 carries existing evaluator reasons deterministically', async () => {
  const bridge = await loadBridge();
  const cases = [
    [
      'missing block',
      validPlacement(),
      { blocks: [] },
      'unresolved',
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_MISSING_BLOCK',
    ],
    [
      'stale quote',
      validPlacement({ inlineRange: validInlineRange({ to: 13, quote: 'Missing quote' }) }),
      validContext(),
      'unresolved',
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_STALE_QUOTE',
    ],
    [
      'quote elsewhere',
      validPlacement({ inlineRange: validInlineRange({ from: 6, to: 10, quote: 'Alpha' }) }),
      validContext('Alpha beta Alpha.'),
      'diagnostics',
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_QUOTE_ELSEWHERE',
    ],
    [
      'orphan',
      validPlacement({
        inlineRange: validInlineRange({
          kind: 'orphan',
          blockId: '',
          lineageId: '',
          from: 0,
          to: 0,
          quote: '',
          confidence: 'unresolved',
          automationPolicy: 'diagnosticsOnly',
        }),
      }),
      validContext(),
      'unresolved',
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_ORPHAN',
    ],
    [
      'deleted target',
      validPlacement({
        inlineRange: validInlineRange({
          kind: 'deleted',
          from: 5,
          to: 5,
          quote: '',
          deletedTarget: true,
        }),
      }),
      validContext(),
      'unresolved',
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_DELETED_TARGET',
    ],
    [
      'prefix mismatch',
      validPlacement({
        inlineRange: validInlineRange({
          from: 6,
          to: 10,
          quote: 'beta',
          prefix: 'wrong',
        }),
      }),
      validContext(),
      'diagnostics',
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_PREFIX_MISMATCH',
    ],
    [
      'suffix mismatch',
      validPlacement({
        inlineRange: validInlineRange({
          quote: 'Alpha',
          suffix: 'wrong',
        }),
      }),
      validContext(),
      'diagnostics',
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_SUFFIX_MISMATCH',
    ],
  ];

  for (const [, placement, context, status, reasonCode] of cases) {
    const first = bridge.evaluateCommentAnchorPlacementProof(placement, context);
    const second = bridge.evaluateCommentAnchorPlacementProof(placement, context);

    assert.equal(first.status, status);
    assert.equal(first.reasonCodes.includes(reasonCode), true);
    assert.equal(first.diagnostics.some((diagnostic) => diagnostic.code === reasonCode), true);
    assert.deepEqual(first, second);
  }
});

test('RB-13 output excludes comment content fields and app intent fields', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateCommentAnchorPlacementProof(validPlacement({
    body: 'duplicate',
    text: 'duplicate',
    messages: [{ body: 'duplicate' }],
    commentText: 'duplicate',
  }), validContext());
  const keys = collectKeys(result).map((key) => key.toLowerCase());
  const forbiddenKeys = [
    'body',
    'text',
    'messages',
    'commenttext',
    'parser',
    'storage',
    'network',
    'ui',
    'apply',
    'patch',
    'command',
    'ipc',
  ];

  for (const forbiddenKey of forbiddenKeys) {
    assert.equal(keys.includes(forbiddenKey), false, `${forbiddenKey} must not be present`);
  }
  for (const diagnostic of result.diagnostics) {
    assert.equal(diagnostic.field.includes('automation'), false);
  }
});

test('RB-13 input placement and context are not mutated', async () => {
  const bridge = await loadBridge();
  const placement = validPlacement({ inlineRange: validInlineRange({ reasonCodes: ['fixture'] }) });
  const context = validContext();
  const beforePlacement = deepClone(placement);
  const beforeContext = deepClone(context);

  bridge.evaluateCommentAnchorPlacementProof(placement, context);

  assert.deepEqual(placement, beforePlacement);
  assert.deepEqual(context, beforeContext);
});

test('RB-13 preserves RB-10 RB-11 and RB-12 public return shapes', async () => {
  const bridge = await loadBridge();
  const validation = bridge.validateCommentAnchorPlacement(validPlacement(), validContext());
  const confidence = bridge.evaluateInlineRangeAnchorConfidence(validInlineRange(), validContext());
  const proof = bridge.buildInlineRangeMatchProof(validInlineRange(), validContext());

  assert.deepEqual(Object.keys(validation), ['ok', 'type', 'code', 'reason', 'reasons', 'value']);
  assert.deepEqual(Object.keys(confidence), [
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
  assert.deepEqual(Object.keys(proof), [
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
});

test('RB-13 source section has no forbidden side effect or dependency tokens', () => {
  const source = fs.readFileSync(path.join(process.cwd(), MODULE_PATH), 'utf8');
  const start = source.indexOf('// RB_13_PLACEMENT_EVALUATION_CONTRACTS_START');
  const end = source.indexOf('// RB_13_PLACEMENT_EVALUATION_CONTRACTS_END');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const section = source.slice(start, end);
  const forbiddenTokens = [
    'parser',
    'storage',
    'network',
    'UI',
    'apply',
    'patch',
    'command',
    'dependency',
    'write',
    'save',
    'import',
    'export',
    'ipc',
    'electron',
    'fetch',
    'Date.now',
    'Math.random',
    'setTimeout',
    'setInterval',
    'fs',
    'child_process',
    'require',
  ];

  for (const token of forbiddenTokens) {
    assert.equal(section.includes(token), false, `${token} must not appear in RB-13 section`);
  }
});

test('RB-13 changed files stay allowlisted and package manifests are untouched', () => {
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
