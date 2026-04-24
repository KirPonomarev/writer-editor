const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-placement-batch-diagnostics-contract.contract.test.js';
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

function assertBatchReturnShape(result) {
  assert.deepEqual(Object.keys(result), [
    'schemaVersion',
    'type',
    'status',
    'code',
    'reason',
    'total',
    'countsByStatus',
    'countsByReasonCode',
    'evaluations',
    'diagnostics',
    'diagnosticSummary',
  ]);
}

function assertPlacementEvaluationReturnShape(result) {
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

function changedFilesFromGitStatus(statusText) {
  return statusText
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => line.slice(3).replace(/^"|"$/gu, ''));
}

function changedFilesFromGitDiff(diffText) {
  return diffText
    .split('\n')
    .filter((line) => line !== '');
}

function packageManifestFiles(filePaths) {
  return filePaths.filter((filePath) => (
    filePath === 'package.json'
    || filePath === 'package-lock.json'
    || filePath === 'npm-shrinkwrap.json'
  ));
}

test('RB-14 exports exact schema function and frozen reason catalog', async () => {
  const bridge = await loadBridge();

  assert.equal(
    bridge.REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_SCHEMA,
    'revision-bridge.comment-anchor-placement-batch-diagnostics.v1',
  );
  assert.equal(typeof bridge.evaluateCommentAnchorPlacementBatchDiagnostics, 'function');
  assert.equal(Object.isFrozen(bridge.REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_REASON_CODES), true);
  assert.deepEqual(bridge.REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_REASON_CODES, [
    'REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_EVALUATED',
    'REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_VALIDATION_FAILED',
    'REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_DIAGNOSTICS',
    'REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_UNRESOLVED',
    'REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_HARD_FAIL',
    'REVISION_BRIDGE_PLACEMENT_EVALUATION_EVALUATED',
    'REVISION_BRIDGE_PLACEMENT_EVALUATION_VALIDATION_FAILED',
    'REVISION_BRIDGE_PLACEMENT_EVALUATION_DIAGNOSTICS',
    'REVISION_BRIDGE_PLACEMENT_EVALUATION_UNRESOLVED',
    'REVISION_BRIDGE_PLACEMENT_EVALUATION_HARD_FAIL',
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

test('RB-14 empty valid batch returns evaluated zero-count envelope', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateCommentAnchorPlacementBatchDiagnostics({
    placements: [],
    context: {},
  });

  assertBatchReturnShape(result);
  assert.equal(result.schemaVersion, 'revision-bridge.comment-anchor-placement-batch-diagnostics.v1');
  assert.equal(result.type, 'revisionBridge.commentAnchorPlacement.batchDiagnostics');
  assert.equal(result.status, 'evaluated');
  assert.equal(result.code, 'REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_EVALUATED');
  assert.equal(result.reason, 'REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_EVALUATED');
  assert.equal(result.total, 0);
  assert.deepEqual(result.countsByStatus, {
    evaluated: 0,
    diagnostics: 0,
    unresolved: 0,
    hardFail: 0,
  });
  assert.deepEqual(result.evaluations, []);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.diagnosticSummary, {
    schemaVersion: 'revision-bridge.comment-anchor-placement-batch-diagnostics.v1',
    sortOrder: ['hardFail', 'unresolved', 'diagnostics', 'evaluated'],
    total: 0,
    items: [],
  });
  assert.equal(Object.values(result.countsByReasonCode).every((count) => count === 0), true);
});

test('RB-14 mixed batch returns deterministic total counts and delegated reason counts', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateCommentAnchorPlacementBatchDiagnostics({
    placements: [
      validPlacement({ placementId: 'placement-1' }),
      validPlacement({
        placementId: 'placement-2',
        inlineRange: validInlineRange({ from: 6, to: 10, quote: 'Alpha' }),
      }),
      validPlacement({
        placementId: 'placement-3',
        inlineRange: validInlineRange({ to: 13, quote: 'Missing quote' }),
      }),
      validPlacement({
        placementId: 'placement-4',
        inlineRange: validInlineRange({ from: 6, to: 10, quote: 'beta', prefix: 'wrong' }),
      }),
    ],
    context: validContext('Alpha beta Alpha.'),
  });

  assertBatchReturnShape(result);
  assert.equal(result.status, 'unresolved');
  assert.equal(result.code, 'REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_UNRESOLVED');
  assert.equal(result.total, 4);
  assert.deepEqual(result.countsByStatus, {
    evaluated: 1,
    diagnostics: 2,
    unresolved: 1,
    hardFail: 0,
  });
  assert.equal(result.countsByReasonCode.REVISION_BRIDGE_PLACEMENT_EVALUATION_EVALUATED, 1);
  assert.equal(result.countsByReasonCode.REVISION_BRIDGE_PLACEMENT_EVALUATION_DIAGNOSTICS, 2);
  assert.equal(result.countsByReasonCode.REVISION_BRIDGE_PLACEMENT_EVALUATION_UNRESOLVED, 1);
  assert.equal(result.countsByReasonCode.REVISION_BRIDGE_ANCHOR_CONFIDENCE_EXACT_RANGE, 1);
  assert.equal(result.countsByReasonCode.REVISION_BRIDGE_ANCHOR_CONFIDENCE_QUOTE_ELSEWHERE, 1);
  assert.equal(result.countsByReasonCode.REVISION_BRIDGE_ANCHOR_CONFIDENCE_STALE_QUOTE, 1);
  assert.equal(result.countsByReasonCode.REVISION_BRIDGE_ANCHOR_CONFIDENCE_PREFIX_MISMATCH, 1);
  assert.deepEqual(result.evaluations.map((item) => item.index), [0, 1, 2, 3]);
  assert.deepEqual(result.diagnosticSummary, {
    schemaVersion: 'revision-bridge.comment-anchor-placement-batch-diagnostics.v1',
    sortOrder: ['hardFail', 'unresolved', 'diagnostics', 'evaluated'],
    total: 7,
    items: [
      {
        severity: 'unresolved',
        code: 'REVISION_BRIDGE_ANCHOR_CONFIDENCE_STALE_QUOTE',
        count: 1,
        indexes: [2],
      },
      {
        severity: 'unresolved',
        code: 'REVISION_BRIDGE_PLACEMENT_EVALUATION_UNRESOLVED',
        count: 1,
        indexes: [2],
      },
      {
        severity: 'diagnostics',
        code: 'REVISION_BRIDGE_PLACEMENT_EVALUATION_DIAGNOSTICS',
        count: 2,
        indexes: [1, 3],
      },
      {
        severity: 'diagnostics',
        code: 'REVISION_BRIDGE_ANCHOR_CONFIDENCE_PREFIX_MISMATCH',
        count: 1,
        indexes: [3],
      },
      {
        severity: 'diagnostics',
        code: 'REVISION_BRIDGE_ANCHOR_CONFIDENCE_QUOTE_ELSEWHERE',
        count: 1,
        indexes: [1],
      },
      {
        severity: 'evaluated',
        code: 'REVISION_BRIDGE_ANCHOR_CONFIDENCE_EXACT_RANGE',
        count: 1,
        indexes: [0],
      },
      {
        severity: 'evaluated',
        code: 'REVISION_BRIDGE_PLACEMENT_EVALUATION_EVALUATED',
        count: 1,
        indexes: [0],
      },
    ],
  });
});

test('RB-14 delegated anchor evidence remains visible in counts and per-item diagnostics', async () => {
  const bridge = await loadBridge();
  const cases = [
    [
      validPlacement({
        placementId: 'orphan',
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
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_ORPHAN',
    ],
    [
      validPlacement({
        placementId: 'deleted',
        inlineRange: validInlineRange({
          kind: 'deleted',
          from: 5,
          to: 5,
          quote: '',
          deletedTarget: true,
        }),
      }),
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_DELETED_TARGET',
    ],
    [
      validPlacement({
        placementId: 'stale',
        inlineRange: validInlineRange({ to: 13, quote: 'Missing quote' }),
      }),
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_STALE_QUOTE',
    ],
    [
      validPlacement({
        placementId: 'elsewhere',
        inlineRange: validInlineRange({ from: 6, to: 10, quote: 'Alpha' }),
      }),
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_QUOTE_ELSEWHERE',
    ],
    [
      validPlacement({
        placementId: 'prefix',
        inlineRange: validInlineRange({ from: 6, to: 10, quote: 'beta', prefix: 'wrong' }),
      }),
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_PREFIX_MISMATCH',
    ],
    [
      validPlacement({
        placementId: 'suffix',
        inlineRange: validInlineRange({ quote: 'Alpha', suffix: 'wrong' }),
      }),
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_SUFFIX_MISMATCH',
    ],
  ];
  const result = bridge.evaluateCommentAnchorPlacementBatchDiagnostics({
    placements: cases.map(([placement]) => placement),
    context: validContext('Alpha beta Alpha.'),
  });

  for (let index = 0; index < cases.length; index += 1) {
    const reasonCode = cases[index][1];
    assert.equal(result.countsByReasonCode[reasonCode], 1);
    assert.equal(
      result.evaluations[index].evaluation.diagnostics.some((diagnostic) => diagnostic.code === reasonCode),
      true,
    );
    assert.equal(
      result.diagnostics.some((diagnostic) => diagnostic.index === index && diagnostic.code === reasonCode),
      true,
    );
  }
});

test('RB-14 invalid batch input returns hardFail envelope without throwing', async () => {
  const bridge = await loadBridge();

  assert.doesNotThrow(() => bridge.evaluateCommentAnchorPlacementBatchDiagnostics([]));
  const result = bridge.evaluateCommentAnchorPlacementBatchDiagnostics([]);

  assertBatchReturnShape(result);
  assert.equal(result.status, 'hardFail');
  assert.equal(result.code, 'REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_VALIDATION_FAILED');
  assert.equal(result.total, 0);
  assert.deepEqual(result.countsByStatus, {
    evaluated: 0,
    diagnostics: 0,
    unresolved: 0,
    hardFail: 0,
  });
  assert.equal(
    result.countsByReasonCode.REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_VALIDATION_FAILED,
    1,
  );
  assert.deepEqual(result.evaluations, []);
  assert.deepEqual(result.diagnostics, [{
    code: 'REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_VALIDATION_FAILED',
    field: 'input',
    message: 'input must be a plain object',
  }]);
  assert.deepEqual(result.diagnosticSummary, {
    schemaVersion: 'revision-bridge.comment-anchor-placement-batch-diagnostics.v1',
    sortOrder: ['hardFail', 'unresolved', 'diagnostics', 'evaluated'],
    total: 1,
    items: [{
      severity: 'hardFail',
      code: 'REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_VALIDATION_FAILED',
      count: 1,
      indexes: [],
    }],
  });
});

test('RB-14 invalid individual placement is delegated to RB-13 and counted from evaluation result', async () => {
  const bridge = await loadBridge();
  const placement = validPlacement({
    threadId: '',
    body: 'COMMENT_SECRET_BODY',
  });
  const context = validContext();
  const directEvaluation = bridge.evaluateCommentAnchorPlacementProof(placement, context);
  const result = bridge.evaluateCommentAnchorPlacementBatchDiagnostics({
    placements: [placement],
    context,
  });

  assert.equal(result.total, 1);
  assert.deepEqual(result.evaluations, [{ index: 0, evaluation: directEvaluation }]);
  assert.equal(result.countsByStatus[directEvaluation.status], 1);
  for (const reasonCode of directEvaluation.reasonCodes) {
    assert.equal(result.countsByReasonCode[reasonCode], 1);
  }
  assert.deepEqual(result.diagnosticSummary, {
    schemaVersion: 'revision-bridge.comment-anchor-placement-batch-diagnostics.v1',
    sortOrder: ['hardFail', 'unresolved', 'diagnostics', 'evaluated'],
    total: 2,
    items: [
      {
        severity: 'hardFail',
        code: 'REVISION_BRIDGE_ANCHOR_CONFIDENCE_EXACT_RANGE',
        count: 1,
        indexes: [0],
      },
      {
        severity: 'hardFail',
        code: 'REVISION_BRIDGE_PLACEMENT_EVALUATION_VALIDATION_FAILED',
        count: 1,
        indexes: [0],
      },
    ],
  });
});

test('RB-15 evaluated-only batch includes evaluated reason codes with placement indexes', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateCommentAnchorPlacementBatchDiagnostics({
    placements: [validPlacement({ placementId: 'evaluated-only' })],
    context: validContext(),
  });

  assert.deepEqual(result.diagnosticSummary, {
    schemaVersion: 'revision-bridge.comment-anchor-placement-batch-diagnostics.v1',
    sortOrder: ['hardFail', 'unresolved', 'diagnostics', 'evaluated'],
    total: 2,
    items: [
      {
        severity: 'evaluated',
        code: 'REVISION_BRIDGE_ANCHOR_CONFIDENCE_EXACT_RANGE',
        count: 1,
        indexes: [0],
      },
      {
        severity: 'evaluated',
        code: 'REVISION_BRIDGE_PLACEMENT_EVALUATION_EVALUATED',
        count: 1,
        indexes: [0],
      },
    ],
  });
});

test('RB-14 evaluation wrappers preserve index and full RB-13 evaluation envelope', async () => {
  const bridge = await loadBridge();
  const placements = [
    validPlacement({ placementId: 'placement-1' }),
    validPlacement({
      placementId: 'placement-2',
      inlineRange: validInlineRange({ from: 6, to: 10, quote: 'Alpha' }),
    }),
  ];
  const context = validContext('Alpha beta Alpha.');
  const result = bridge.evaluateCommentAnchorPlacementBatchDiagnostics({ placements, context });

  assert.deepEqual(result.evaluations, [
    { index: 0, evaluation: bridge.evaluateCommentAnchorPlacementProof(placements[0], context) },
    { index: 1, evaluation: bridge.evaluateCommentAnchorPlacementProof(placements[1], context) },
  ]);
  for (const item of result.evaluations) {
    assertPlacementEvaluationReturnShape(item.evaluation);
  }
});

test('RB-14 output excludes comment content and app intent fields recursively', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateCommentAnchorPlacementBatchDiagnostics({
    placements: [
      validPlacement({
        body: 'COMMENT_SECRET_BODY',
        text: 'COMMENT_SECRET_TEXT',
        messages: [{ body: 'COMMENT_SECRET_MESSAGE' }],
        commentText: 'COMMENT_SECRET_COMMENT_TEXT',
        parser: true,
        storage: true,
        network: true,
        ui: true,
        ipc: true,
        command: true,
        apply: true,
        patch: true,
      }),
    ],
    context: validContext(),
  });
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
    'ipc',
    'command',
    'apply',
    'patch',
  ];
  const serialized = JSON.stringify(result);

  for (const forbiddenKey of forbiddenKeys) {
    assert.equal(keys.includes(forbiddenKey), false, `${forbiddenKey} must not be present`);
  }
  assert.equal(serialized.includes('COMMENT_SECRET'), false);
});

test('RB-14 input placements and context are not mutated', async () => {
  const bridge = await loadBridge();
  const placements = [
    validPlacement({ inlineRange: validInlineRange({ reasonCodes: ['fixture'] }) }),
    validPlacement({
      placementId: 'placement-2',
      inlineRange: validInlineRange({ from: 6, to: 10, quote: 'Alpha' }),
    }),
  ];
  const context = validContext('Alpha beta Alpha.');
  const beforePlacements = deepClone(placements);
  const beforeContext = deepClone(context);

  bridge.evaluateCommentAnchorPlacementBatchDiagnostics({ placements, context });

  assert.deepEqual(placements, beforePlacements);
  assert.deepEqual(context, beforeContext);
});

test('RB-14 keeps RB-13 public return shape unchanged', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateCommentAnchorPlacementProof(validPlacement(), validContext());

  assertPlacementEvaluationReturnShape(result);
});

test('RB-14 source section has no forbidden side effect or dependency tokens', () => {
  const source = fs.readFileSync(path.join(process.cwd(), MODULE_PATH), 'utf8');
  const start = source.indexOf('// RB_14_PLACEMENT_BATCH_DIAGNOSTICS_CONTRACTS_START');
  const end = source.indexOf('// RB_14_PLACEMENT_BATCH_DIAGNOSTICS_CONTRACTS_END');
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
    assert.equal(section.includes(token), false, `${token} must not appear in RB-14 section`);
  }
});

test('RB-14 changed files stay allowlisted and package manifests are untouched', () => {
  const statusText = execFileSync('git', ['status', '--short', '-uall'], { encoding: 'utf8' });
  const diffText = execFileSync('git', ['diff', '--name-only', 'HEAD~1..HEAD'], { encoding: 'utf8' });
  const worktreeFiles = changedFilesFromGitStatus(statusText);
  const committedFiles = changedFilesFromGitDiff(diffText);
  const outsideAllowlist = [...worktreeFiles, ...committedFiles]
    .filter((filePath) => !ALLOWLIST.includes(filePath));
  const packageManifestDiff = [
    ...packageManifestFiles(worktreeFiles),
    ...packageManifestFiles(committedFiles),
  ];

  assert.deepEqual(outsideAllowlist, []);
  assert.deepEqual(packageManifestDiff, []);
});
