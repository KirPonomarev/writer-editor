const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-revision-session-skeleton-admission.contract.test.js';
const RB16_TEST_PATH = 'test/contracts/revision-bridge-placement-batch-diagnostics-contract.contract.test.js';
const BINDING_BASE_SHA = '27b7bca0d0c1e2106b07a5247bea46576ef723a3';
const ALLOWLIST = [MODULE_PATH, TEST_PATH, RB16_TEST_PATH];

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

function validInput(placementAdmissionPreview, overrides = {}) {
  return {
    projectId: 'project-1',
    revisionSessionId: 'revision-session-1',
    exportId: 'export-1',
    baselineHash: 'baseline-hash-1',
    placementAdmissionPreview,
    ...overrides,
  };
}

function assertSkeletonReturnShape(result) {
  assert.deepEqual(Object.keys(result), [
    'schemaVersion',
    'type',
    'status',
    'code',
    'reason',
    'canAdmit',
    'projectId',
    'revisionSessionId',
    'exportId',
    'baselineHash',
    'candidateSession',
    'placementAdmissionPreview',
    'reasons',
  ]);
}

function expectedEmptyReviewGraph() {
  return {
    commentThreads: [],
    commentPlacements: [],
    textChanges: [],
    structuralChanges: [],
    diagnosticItems: [],
    decisionStates: [],
  };
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

async function admitPlacementPreview() {
  const bridge = await loadBridge();
  const batchDiagnostics = bridge.evaluateCommentAnchorPlacementBatchDiagnostics({
    placements: [validPlacement()],
    context: validContext(),
  });
  return bridge.previewRevisionSessionPlacementAdmission({ batchDiagnostics });
}

async function blockPlacementPreview() {
  const bridge = await loadBridge();
  const batchDiagnostics = bridge.evaluateCommentAnchorPlacementBatchDiagnostics({
    placements: [
      validPlacement({
        placementId: 'unresolved',
        inlineRange: validInlineRange({ to: 13, quote: 'Missing quote' }),
      }),
    ],
    context: validContext(),
  });
  return bridge.previewRevisionSessionPlacementAdmission({ batchDiagnostics });
}

test('RB-17 exports schema constant and helper', async () => {
  const bridge = await loadBridge();

  assert.equal(
    bridge.REVISION_BRIDGE_REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_SCHEMA,
    'revision-bridge.revision-session-skeleton-admission-preview.v1',
  );
  assert.equal(typeof bridge.previewRevisionSessionSkeletonAdmission, 'function');
  assert.deepEqual(Object.keys(bridge).filter((key) => /filter/iu.test(key)), []);
});

test('RB-17 admit return shape includes candidate session skeleton', async () => {
  const bridge = await loadBridge();
  const placementAdmissionPreview = await admitPlacementPreview();
  const result = bridge.previewRevisionSessionSkeletonAdmission(validInput(placementAdmissionPreview));

  assertSkeletonReturnShape(result);
  assert.equal(result.schemaVersion, 'revision-bridge.revision-session-skeleton-admission-preview.v1');
  assert.equal(result.type, 'revisionBridge.revisionSession.skeletonAdmissionPreview');
  assert.equal(result.status, 'admit');
  assert.equal(result.code, 'REVISION_BRIDGE_REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_ADMIT');
  assert.equal(result.reason, 'REVISION_BRIDGE_REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_ADMIT');
  assert.equal(result.canAdmit, true);
  assert.equal(result.projectId, 'project-1');
  assert.equal(result.revisionSessionId, 'revision-session-1');
  assert.equal(result.exportId, 'export-1');
  assert.equal(result.baselineHash, 'baseline-hash-1');
  assert.deepEqual(result.candidateSession, {
    schemaVersion: 'revision-bridge.revision-session.v1',
    sessionId: 'revision-session-1',
    projectId: 'project-1',
    baselineHash: 'baseline-hash-1',
    createdAt: '',
    updatedAt: '',
    reviewGraph: expectedEmptyReviewGraph(),
  });
  assert.deepEqual(result.reasons, []);
  assert.notEqual(result.placementAdmissionPreview, placementAdmissionPreview);
  assert.deepEqual(result.placementAdmissionPreview, placementAdmissionPreview);
});

test('RB-17 block return shape preserves cloned placement preview evidence', async () => {
  const bridge = await loadBridge();
  const placementAdmissionPreview = await blockPlacementPreview();
  const result = bridge.previewRevisionSessionSkeletonAdmission(validInput(placementAdmissionPreview));

  assertSkeletonReturnShape(result);
  assert.equal(result.status, 'block');
  assert.equal(result.code, 'REVISION_BRIDGE_REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_BLOCK');
  assert.equal(result.reason, 'REVISION_BRIDGE_REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_BLOCK');
  assert.equal(result.canAdmit, false);
  assert.equal(result.candidateSession, null);
  assert.deepEqual(result.reasons, [{
    code: 'REVISION_BRIDGE_REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_BLOCK',
    field: 'placementAdmissionPreview.canAdmit',
    message: 'placementAdmissionPreview cannot admit',
  }]);
  assert.notEqual(result.placementAdmissionPreview, placementAdmissionPreview);
  assert.notEqual(result.placementAdmissionPreview.blockingEvaluations, placementAdmissionPreview.blockingEvaluations);
  assert.deepEqual(result.placementAdmissionPreview, placementAdmissionPreview);
});

test('RB-17 malformed placement preview hardFails without throwing', async () => {
  const bridge = await loadBridge();
  const cases = [
    null,
    {},
    { type: 'revisionBridge.revisionSession.placementAdmissionPreview' },
    { ...(await admitPlacementPreview()), canAdmit: 'yes' },
    { ...(await admitPlacementPreview()), sourceTotal: 1.5 },
    { ...(await admitPlacementPreview()), blockingStatuses: {} },
    { ...(await admitPlacementPreview()), countsByStatus: undefined },
    { ...(await admitPlacementPreview()), countsByReasonCode: undefined },
    { ...(await admitPlacementPreview()), diagnosticSummary: null },
  ];

  for (const placementAdmissionPreview of cases) {
    assert.doesNotThrow(() => bridge.previewRevisionSessionSkeletonAdmission(validInput(placementAdmissionPreview)));
    const result = bridge.previewRevisionSessionSkeletonAdmission(validInput(placementAdmissionPreview));

    assertSkeletonReturnShape(result);
    assert.equal(result.status, 'hardFail');
    assert.equal(result.code, 'E_REVISION_BRIDGE_REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_INVALID');
    assert.equal(result.reason, 'E_REVISION_BRIDGE_REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_INVALID');
    assert.equal(result.canAdmit, false);
    assert.equal(result.candidateSession, null);
    assert.equal(result.placementAdmissionPreview, null);
    assert.equal(result.reasons.length > 0, true);
    assert.equal(result.reasons[0].field.startsWith('placementAdmissionPreview'), true);
  }
});

test('RB-17 delegated count maps are required, bounded, and public-key only', async () => {
  const bridge = await loadBridge();
  const validPreview = await admitPlacementPreview();
  const cases = [
    [
      { ...validPreview, countsByStatus: undefined },
      'placementAdmissionPreview.countsByStatus',
    ],
    [
      { ...validPreview, countsByReasonCode: undefined },
      'placementAdmissionPreview.countsByReasonCode',
    ],
    [
      { ...validPreview, countsByStatus: { ...validPreview.countsByStatus, path: 1 } },
      'placementAdmissionPreview.countsByStatus',
    ],
    [
      { ...validPreview, countsByStatus: { ...validPreview.countsByStatus, evaluated: -1 } },
      'placementAdmissionPreview.countsByStatus.evaluated',
    ],
    [
      { ...validPreview, countsByReasonCode: { ...validPreview.countsByReasonCode, PRIVATE_REASON: 1 } },
      'placementAdmissionPreview.countsByReasonCode',
    ],
    [
      {
        ...validPreview,
        countsByReasonCode: {
          ...validPreview.countsByReasonCode,
          REVISION_BRIDGE_PLACEMENT_EVALUATION_EVALUATED: 1.5,
        },
      },
      'placementAdmissionPreview.countsByReasonCode.REVISION_BRIDGE_PLACEMENT_EVALUATION_EVALUATED',
    ],
  ];

  for (const [placementAdmissionPreview, field] of cases) {
    const result = bridge.previewRevisionSessionSkeletonAdmission(validInput(placementAdmissionPreview));

    assertSkeletonReturnShape(result);
    assert.equal(result.status, 'hardFail');
    assert.equal(result.canAdmit, false);
    assert.equal(result.candidateSession, null);
    assert.equal(result.placementAdmissionPreview, null);
    assert.equal(result.reasons.some((reason) => reason.field === field), true);
  }
});

test('RB-17 hostile nested delegated preview keys fail closed and never leak', async () => {
  const bridge = await loadBridge();
  const validPreview = await admitPlacementPreview();
  const cases = [
    {
      ...validPreview,
      countsByStatus: { ...validPreview.countsByStatus, path: 1 },
    },
    {
      ...validPreview,
      diagnosticSummary: {
        ...validPreview.diagnosticSummary,
        items: [{ apply: true, code: 'hostile' }],
      },
    },
    {
      ...validPreview,
      blockingEvaluations: [{ index: 0, evaluation: { storage: true } }],
    },
  ];
  const forbiddenKeys = [
    'path',
    'apply',
    'storage',
    'parser',
    'ui',
    'ipc',
    'network',
    'command',
    'write',
    'save',
  ];

  for (const placementAdmissionPreview of cases) {
    const result = bridge.previewRevisionSessionSkeletonAdmission(validInput(placementAdmissionPreview));
    const keys = collectKeys(result).map((key) => key.toLowerCase());
    const serialized = JSON.stringify(result).toLowerCase();

    assertSkeletonReturnShape(result);
    assert.equal(result.status, 'hardFail');
    assert.equal(result.placementAdmissionPreview, null);
    for (const forbiddenKey of forbiddenKeys) {
      assert.equal(keys.includes(forbiddenKey), false, `${forbiddenKey} must not leak`);
      assert.equal(serialized.includes(forbiddenKey), false, `${forbiddenKey} must not leak as a value`);
    }
  }
});

test('RB-17 missing identifiers hardFail with required fields', async () => {
  const bridge = await loadBridge();
  const placementAdmissionPreview = await admitPlacementPreview();
  const cases = [
    ['projectId', 'revisionSession.projectId'],
    ['revisionSessionId', 'revisionSession.revisionSessionId'],
    ['exportId', 'revisionSession.exportId'],
    ['baselineHash', 'revisionSession.baselineHash'],
  ];

  for (const [key, field] of cases) {
    const input = validInput(placementAdmissionPreview, { [key]: '   ' });
    const result = bridge.previewRevisionSessionSkeletonAdmission(input);

    assertSkeletonReturnShape(result);
    assert.equal(result.status, 'hardFail');
    assert.equal(result.code, 'E_REVISION_BRIDGE_REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_INVALID');
    assert.equal(result.reason, 'E_REVISION_BRIDGE_REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_INVALID');
    assert.equal(result.canAdmit, false);
    assert.equal(result.candidateSession, null);
    assert.equal(result.reasons.some((reason) => reason.field === field), true);
  }
});

test('RB-17 documentId and sourceLabel do not satisfy canonical identifiers', async () => {
  const bridge = await loadBridge();
  const placementAdmissionPreview = await admitPlacementPreview();
  const result = bridge.previewRevisionSessionSkeletonAdmission({
    documentId: 'project-1',
    sourceLabel: 'export-1',
    revisionSessionId: 'revision-session-1',
    baselineHash: 'baseline-hash-1',
    placementAdmissionPreview,
  });

  assert.equal(result.status, 'hardFail');
  assert.equal(result.candidateSession, null);
  assert.equal(result.reasons.some((reason) => reason.field === 'revisionSession.projectId'), true);
  assert.equal(result.reasons.some((reason) => reason.field === 'revisionSession.exportId'), true);
});

test('RB-17 input and delegated preview are not mutated', async () => {
  const bridge = await loadBridge();
  const placementAdmissionPreview = await blockPlacementPreview();
  const input = validInput(placementAdmissionPreview);
  const beforeInput = deepClone(input);
  const beforePreview = deepClone(placementAdmissionPreview);

  const result = bridge.previewRevisionSessionSkeletonAdmission(input);

  assert.deepEqual(input, beforeInput);
  assert.deepEqual(placementAdmissionPreview, beforePreview);
  assert.notEqual(result.placementAdmissionPreview, placementAdmissionPreview);
  assert.notEqual(result.placementAdmissionPreview.blockingDiagnostics, placementAdmissionPreview.blockingDiagnostics);
});

test('RB-17 output recursively excludes app runtime keys', async () => {
  const bridge = await loadBridge();
  const placementAdmissionPreview = await admitPlacementPreview();
  const result = bridge.previewRevisionSessionSkeletonAdmission(validInput({
    ...placementAdmissionPreview,
    import: true,
    storage: true,
    apply: true,
    ipc: true,
    parser: true,
    ui: true,
    network: true,
    command: true,
    path: true,
    write: true,
    save: true,
  }));
  const keys = collectKeys(result).map((key) => key.toLowerCase());
  const forbiddenKeys = [
    'import',
    'storage',
    'apply',
    'ipc',
    'parser',
    'ui',
    'network',
    'command',
    'path',
    'write',
    'save',
  ];

  for (const forbiddenKey of forbiddenKeys) {
    assert.equal(keys.includes(forbiddenKey), false, `${forbiddenKey} must not be present`);
  }
});

test('RB-17 source section has no forbidden side effect tokens', () => {
  const source = fs.readFileSync(path.join(process.cwd(), MODULE_PATH), 'utf8');
  const start = source.indexOf('// RB_17_REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_CONTRACTS_START');
  const end = source.indexOf('// RB_17_REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_CONTRACTS_END');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const section = source.slice(start, end);
  const forbiddenTokens = [
    'filesystem',
    'Date.now',
    'Math.random',
    'setTimeout',
    'setInterval',
    'timer',
    'write',
    'save',
    'apply',
    'patch',
    'import',
    'export',
    'parser',
    'storage',
    'UI',
    'ui',
    'ipc',
    'network',
    'command',
    'path',
    'fs',
    'child_process',
    'require',
  ];

  for (const token of forbiddenTokens) {
    assert.equal(section.includes(token), false, `${token} must not appear in RB-17 section`);
  }
});

test('RB-17 changed files stay allowlisted from worktree and binding-base branch diff', () => {
  const statusText = execFileSync('git', ['status', '--short', '-uall'], { encoding: 'utf8' });
  const diffText = execFileSync('git', ['diff', '--name-only', `${BINDING_BASE_SHA}..HEAD`], { encoding: 'utf8' });
  const worktreeFiles = changedFilesFromGitStatus(statusText);
  const committedFiles = changedFilesFromGitDiff(diffText);
  const changedSet = [...new Set([...worktreeFiles, ...committedFiles])].sort();
  const outsideAllowlist = [...worktreeFiles, ...committedFiles]
    .filter((filePath) => !ALLOWLIST.includes(filePath));
  const packageManifestDiff = [
    ...packageManifestFiles(worktreeFiles),
    ...packageManifestFiles(committedFiles),
  ];

  assert.deepEqual(changedSet, [...ALLOWLIST].sort());
  assert.deepEqual(outsideAllowlist, []);
  assert.deepEqual(packageManifestDiff, []);
});
