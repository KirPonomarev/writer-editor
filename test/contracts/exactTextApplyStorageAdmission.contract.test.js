const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'reviewIrKernel.mjs';
const TASK_BASENAME = 'EXACT_TEXT_APPLY_STORAGE_ADMISSION_GATE_001G.md';

async function loadKernel() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

function gitLines(args) {
  return execFileSync('git', args, { cwd: process.cwd(), encoding: 'utf8' })
    .split(/\r?\n/u)
    .filter(Boolean);
}

function changedBasenamesForCurrentContour() {
  const dirty = [
    ...gitLines(['diff', '--name-only', 'HEAD']),
    ...gitLines(['diff', '--cached', '--name-only']),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ];
  if (dirty.length > 0) {
    return Array.from(new Set(dirty.map((filePath) => path.basename(filePath)))).sort();
  }
  return Array.from(new Set(gitLines(['diff', '--name-only', 'HEAD~1', 'HEAD'])
    .map((filePath) => path.basename(filePath)))).sort();
}

function exactTextDecision(overrides = {}) {
  const item = {
    id: 'decision-1',
    kind: 'TEXT_REPLACE',
    targetScope: { sceneId: 'scene-1', blockId: 'block-1' },
    blockVersionHash: 'block-v1',
    selectors: [
      {
        selectorKind: 'TEXT_QUOTE',
        selectorEvidence: { exact: 'old text', prefix: 'before', suffix: 'after' },
      },
    ],
    evidence: [{ exactText: 'old text', prefix: 'before', suffix: 'after' }],
    expectedText: 'old text',
    replacementText: 'new text',
    ...(overrides.item || {}),
  };
  return {
    projectId: 'project-1',
    artifactHash: 'artifact-a',
    contextHash: 'baseline-a',
    sourceViewState: {
      revisionToken: 'rev-1',
      viewMode: 'inline',
      normalizationPolicy: 'TEXT_V1',
      newlinePolicy: 'LF',
      unicodePolicy: 'NFC',
      artifactCompletenessClass: 'TEXT_ONLY',
    },
    items: [item],
    ...overrides.surface,
  };
}

function acceptedEnvironment(overrides = {}) {
  return {
    projectId: 'project-1',
    currentBaselineHash: 'baseline-a',
    sessionOpen: true,
    sceneId: 'scene-1',
    currentBlockVersions: { 'block-1': 'block-v1' },
    currentTextByBlock: { 'block-1': 'old text' },
    ...overrides,
  };
}

function acceptedStoragePortCapabilities(overrides = {}) {
  return {
    canBackupBeforeWrite: true,
    canAtomicWriteSceneText: true,
    canCreateReadableRecoverySnapshot: true,
    canReportBeforeHash: true,
    canReportAfterHash: true,
    deterministicObservationIds: true,
    productPathAccess: false,
    ...overrides,
  };
}

function acceptedFixtureCapabilities(overrides = {}) {
  return {
    canObserveBackup: true,
    canObserveAtomicWrite: true,
    canObserveRecoverySnapshot: true,
    canProduceFixtureReceiptContract: true,
    deterministicObservationIds: true,
    realIoAvailable: false,
    productPathAccess: false,
    ...overrides,
  };
}

function acceptedAdmissionPolicy(overrides = {}) {
  return {
    ownerAdmissionApproved: true,
    realStorageAdmissionRequested: true,
    exactTextOnly: true,
    singleSceneOnly: true,
    sourceScope: {
      sceneCount: 1,
      operationKind: 'EXACT_TEXT_REPLACE',
      structural: false,
      multiScene: false,
    },
    ...overrides,
  };
}

function acceptedAdmissionCapabilities(overrides = {}) {
  return {
    canBackupBeforeWrite: true,
    canAtomicWriteSceneText: true,
    canCreateReadableRecoverySnapshot: true,
    canPersistReceipt: true,
    productPathAccess: false,
    publicSurfaceAvailable: false,
    ...overrides,
  };
}

async function buildStoragePortFixtureResult(overrides = {}) {
  const {
    buildReviewPatchSet,
    compileExactTextApplyOps,
    compileExactTextApplyEffectPreviews,
    compileExactTextWritePlanReceiptContract,
    compileExactTextStorageAdapterCallPlan,
    compileExactTextInMemoryStoragePortFixture,
  } = await loadKernel();
  const applyResult = compileExactTextApplyOps(
    buildReviewPatchSet(exactTextDecision(overrides.decision || {})),
    acceptedEnvironment(overrides.environment || {}),
  );
  const effectPreviewPlan = compileExactTextApplyEffectPreviews(applyResult);
  const writePlanReceiptResult = compileExactTextWritePlanReceiptContract({ applyResult, effectPreviewPlan });
  const storageAdapterCallPlanResult = compileExactTextStorageAdapterCallPlan({
    writePlanReceiptResult,
    storagePortCapabilities: acceptedStoragePortCapabilities(overrides.storagePortCapabilities || {}),
  });
  return compileExactTextInMemoryStoragePortFixture({
    storageAdapterCallPlanResult,
    fixtureCapabilities: acceptedFixtureCapabilities(overrides.fixtureCapabilities || {}),
  });
}

test('storage admission gate is deterministic and blocked by default', async () => {
  const { compileExactTextStorageAdmissionGate, REASON_CODES } = await loadKernel();
  const fixtureResult = await buildStoragePortFixtureResult();
  const first = compileExactTextStorageAdmissionGate({ storagePortFixtureResult: fixtureResult });
  const second = compileExactTextStorageAdmissionGate({ storagePortFixtureResult: fixtureResult });

  assert.deepEqual(first, second);
  assert.equal(first.resultKind, 'EXACT_TEXT_STORAGE_ADMISSION_GATE_RESULT');
  assert.equal(first.contractOnly, true);
  assert.equal(first.admissionGateOnly, true);
  assert.equal(first.runtimeStorageAdmitted, false);
  assert.equal(first.productWritePerformed, false);
  assert.equal(first.productWriteClaimed, false);
  assert.equal(first.publicSurfaceClaimed, false);
  assert.deepEqual(first.admissionDecisions, []);
  assert.equal(first.blockedReasons.includes(REASON_CODES.OWNER_ADMISSION_MISSING), true);
});

test('explicit owner admission creates one contract gate decision without product write', async () => {
  const { compileExactTextStorageAdmissionGate, canonicalHash } = await loadKernel();
  const fixtureResult = await buildStoragePortFixtureResult();
  const result = compileExactTextStorageAdmissionGate({
    storagePortFixtureResult: fixtureResult,
    storageAdmissionPolicy: acceptedAdmissionPolicy(),
    storageAdmissionCapabilities: acceptedAdmissionCapabilities(),
  });
  const decision = result.admissionDecisions[0];
  const execution = fixtureResult.fixtureExecutions[0];

  assert.deepEqual(result.blockedReasons, []);
  assert.equal(result.runtimeStorageAdmitted, true);
  assert.equal(result.filesystemWritePerformed, false);
  assert.equal(result.fsMutationPerformed, false);
  assert.equal(result.tempDirUsed, false);
  assert.equal(result.tempFixtureWritePerformed, false);
  assert.equal(result.productWritePerformed, false);
  assert.equal(result.productWriteClaimed, false);
  assert.equal(result.durableReceiptClaimed, false);
  assert.equal(result.productStorageSafetyClaimed, false);
  assert.equal(result.crashRecoveryClaimed, false);
  assert.equal(result.applyTxnClaimed, false);
  assert.equal(result.publicSurfaceClaimed, false);
  assert.equal(result.docxImportClaimed, false);
  assert.equal(result.releaseClaimed, false);
  assert.equal(result.storageImportsAdded, false);
  assert.equal(result.storagePrimitiveChanged, false);
  assert.equal(result.admissionDecisions.length, 1);

  assert.equal(decision.admissionDecisionKind, 'EXACT_TEXT_STORAGE_ADMISSION_DECISION');
  assert.equal(decision.admissionMode, 'PURE_DATA_GATE_ONLY');
  assert.equal(decision.runtimeStorageAdmitted, true);
  assert.equal(decision.admittedForNextContourOnly, true);
  assert.equal(decision.productWritePerformed, false);
  assert.equal(decision.filesystemWritePerformed, false);
  assert.equal(decision.tempFixtureWritePerformed, false);
  assert.equal(decision.sourceFixtureExecutionHash, execution.canonicalHash);
  assert.equal(decision.sourceCallPlanHash, execution.sourceCallPlanHash);
  assert.equal(decision.sourceWritePlanHash, execution.sourceWritePlanHash);
  assert.equal(decision.sourceReceiptContractHash, execution.sourceReceiptContractHash);
  assert.equal(result.canonicalHash, canonicalHash({
    resultKind: result.resultKind,
    contractOnly: result.contractOnly,
    admissionGateOnly: result.admissionGateOnly,
    runtimeStorageAdmitted: result.runtimeStorageAdmitted,
    filesystemWritePerformed: result.filesystemWritePerformed,
    fsMutationPerformed: result.fsMutationPerformed,
    tempDirUsed: result.tempDirUsed,
    tempFixtureWritePerformed: result.tempFixtureWritePerformed,
    productWritePerformed: result.productWritePerformed,
    productWriteClaimed: result.productWriteClaimed,
    durableReceiptClaimed: result.durableReceiptClaimed,
    productStorageSafetyClaimed: result.productStorageSafetyClaimed,
    crashRecoveryClaimed: result.crashRecoveryClaimed,
    applyTxnClaimed: result.applyTxnClaimed,
    publicSurfaceClaimed: result.publicSurfaceClaimed,
    docxImportClaimed: result.docxImportClaimed,
    uiChanged: result.uiChanged,
    releaseClaimed: result.releaseClaimed,
    storageImportsAdded: result.storageImportsAdded,
    storagePrimitiveChanged: result.storagePrimitiveChanged,
    admissionDecisions: result.admissionDecisions,
    blockedReasons: result.blockedReasons,
  }));
});

test('missing storage admission capabilities and forbidden surfaces block admission', async () => {
  const { compileExactTextStorageAdmissionGate, REASON_CODES } = await loadKernel();
  const fixtureResult = await buildStoragePortFixtureResult();
  const cases = [
    [REASON_CODES.BACKUP_CAPABILITY_MISSING, { canBackupBeforeWrite: false }],
    [REASON_CODES.ATOMIC_WRITE_CAPABILITY_MISSING, { canAtomicWriteSceneText: false }],
    [REASON_CODES.RECOVERY_SNAPSHOT_CAPABILITY_MISSING, { canCreateReadableRecoverySnapshot: false }],
    [REASON_CODES.RECEIPT_CAPABILITY_MISSING, { canPersistReceipt: false }],
    [REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR, { productPathAccess: true }],
    [REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR, { publicSurfaceAvailable: true }],
  ];

  for (const [reasonCode, capabilityPatch] of cases) {
    const result = compileExactTextStorageAdmissionGate({
      storagePortFixtureResult: fixtureResult,
      storageAdmissionPolicy: acceptedAdmissionPolicy(),
      storageAdmissionCapabilities: acceptedAdmissionCapabilities(capabilityPatch),
    });
    assert.equal(result.runtimeStorageAdmitted, false, reasonCode);
    assert.deepEqual(result.admissionDecisions, [], reasonCode);
    assert.equal(result.productWritePerformed, false, reasonCode);
    assert.equal(result.publicSurfaceClaimed, false, reasonCode);
    assert.equal(result.blockedReasons.includes(reasonCode), true, reasonCode);
  }
});

test('multi-scope and structural storage scopes remain blocked', async () => {
  const { compileExactTextStorageAdmissionGate, REASON_CODES } = await loadKernel();
  const fixtureResult = await buildStoragePortFixtureResult();
  const cases = [
    [
      REASON_CODES.MULTI_SCOPE_STORAGE_WRITE_BLOCKED,
      acceptedAdmissionPolicy({ sourceScope: { sceneCount: 2, multiScene: true, operationKind: 'EXACT_TEXT_REPLACE' } }),
    ],
    [
      REASON_CODES.STRUCTURAL_STORAGE_WRITE_BLOCKED,
      acceptedAdmissionPolicy({ sourceScope: { sceneCount: 1, operationKind: 'MOVE', structural: true } }),
    ],
    [
      REASON_CODES.STRUCTURAL_STORAGE_WRITE_BLOCKED,
      acceptedAdmissionPolicy({ exactTextOnly: false }),
    ],
  ];

  for (const [reasonCode, storageAdmissionPolicy] of cases) {
    const result = compileExactTextStorageAdmissionGate({
      storagePortFixtureResult: fixtureResult,
      storageAdmissionPolicy,
      storageAdmissionCapabilities: acceptedAdmissionCapabilities(),
    });
    assert.equal(result.runtimeStorageAdmitted, false, reasonCode);
    assert.deepEqual(result.admissionDecisions, [], reasonCode);
    assert.equal(result.blockedReasons.includes(reasonCode), true, reasonCode);
  }
});

test('stale wrong closed and structural inherited blockers survive admission gate', async () => {
  const { compileExactTextStorageAdmissionGate, REASON_CODES } = await loadKernel();
  const cases = [
    [
      REASON_CODES.STALE_BASELINE,
      { environment: { currentBaselineHash: 'baseline-b' } },
    ],
    [
      REASON_CODES.WRONG_PROJECT,
      { environment: { projectId: 'project-2' } },
    ],
    [
      REASON_CODES.CLOSED_SESSION,
      { environment: { sessionOpen: false } },
    ],
    [
      REASON_CODES.STRUCTURAL_MANUAL_ONLY,
      { decision: { item: { kind: 'MOVE' } } },
    ],
  ];

  for (const [reasonCode, overrides] of cases) {
    const fixtureResult = await buildStoragePortFixtureResult(overrides);
    const result = compileExactTextStorageAdmissionGate({
      storagePortFixtureResult: fixtureResult,
      storageAdmissionPolicy: acceptedAdmissionPolicy(),
      storageAdmissionCapabilities: acceptedAdmissionCapabilities(),
    });
    assert.equal(result.runtimeStorageAdmitted, false, reasonCode);
    assert.deepEqual(result.admissionDecisions, [], reasonCode);
    assert.equal(result.productWritePerformed, false, reasonCode);
    assert.equal(result.blockedReasons.includes(reasonCode), true, reasonCode);
  }
});

test('001G task record pins storage admission false-green flags', () => {
  const taskText = fs.readFileSync(
    path.join(process.cwd(), 'docs', 'tasks', TASK_BASENAME),
    'utf8',
  );
  const requiredFalseFlags = [
    'FILESYSTEM_WRITE_PERFORMED',
    'FS_MUTATION_PERFORMED',
    'TEMP_DIR_USED',
    'TEMP_FIXTURE_WRITE_PERFORMED',
    'PRODUCT_WRITE_PERFORMED',
    'PRODUCT_WRITE_CLAIMED',
    'DURABLE_RECEIPT_CLAIMED',
    'PRODUCT_STORAGE_SAFETY_CLAIMED',
    'CRASH_RECOVERY_CLAIMED',
    'APPLYTXN_CLAIMED',
    'PUBLIC_SURFACE_CLAIMED',
    'DOCX_IMPORT_CLAIMED',
    'RELEASE_CLAIMED',
    'STORAGE_IMPORTS_ADDED',
    'STORAGE_PRIMITIVE_CHANGED',
  ];

  assert.match(taskText, /STATUS: IMPLEMENTED_VERIFIED_CONTRACT_ONLY_STORAGE_ADMISSION_GATE_NO_PRODUCT_WRITE/u);
  assert.match(taskText, /CONTRACT_ONLY: true/u);
  assert.match(taskText, /ADMISSION_GATE_ONLY: true/u);
  for (const flag of requiredFalseFlags) {
    assert.match(taskText, new RegExp(`${flag}: false`, 'u'), flag);
    assert.doesNotMatch(taskText, new RegExp(`${flag}: true`, 'u'), flag);
  }
  assert.doesNotMatch(taskText, /product saved|committed to disk|filesystem mutation|public API exposed|DOCX runtime/iu);
});

test('001G change scope stays inside allowlist and outside public or storage implementation files', () => {
  const changedBasenames = changedBasenamesForCurrentContour();
  const allowlist = new Set([
    'reviewIrKernel.mjs',
    'exactTextApplyStorageAdmission.contract.test.js',
    'exactTextApplyStoragePortFixture.contract.test.js',
    TASK_BASENAME,
  ]);
  const denylist = new Set([
    'main.js',
    'preload.js',
    'editor.js',
    'index.html',
    'styles.css',
    'package.json',
    'package-lock.json',
    'command-catalog.v1.mjs',
    'projectCommands.mjs',
    'fileManager.js',
    'backupManager.js',
    'atomicWriteFile.mjs',
    'hostilePackageGate.mjs',
  ]);

  assert.notDeepEqual(changedBasenames, [], '001G must have a detectable changed scope');
  for (const basename of changedBasenames) {
    assert.equal(allowlist.has(basename), true, `unexpected 001G changed basename: ${basename}`);
    assert.equal(denylist.has(basename), false, `denylisted 001G changed basename: ${basename}`);
  }
});

test('storage admission gate adds no fs storage implementation public surface or nondeterminism', () => {
  const moduleText = fs.readFileSync(
    path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME),
    'utf8',
  );
  const testText = fs.readFileSync(__filename, 'utf8');
  const forbiddenModulePatterns = [
    /from\s+['"]node:fs(?:\/promises)?['"]/u,
    /\brequire\s*\(/u,
    /\bimport\s*\(/u,
    /from\s+['"]node:child_process['"]/u,
    /from\s+['"]node:http['"]/u,
    /from\s+['"]node:https['"]/u,
    /from\s+['"]node:net['"]/u,
    /from\s+['"]node:dns['"]/u,
    /from\s+['"]electron['"]/u,
    /from\s+['"][^'"]*(?:storage|main|preload|editor|command-catalog|projectCommands|fileManager|backupManager|atomicWrite)[^'"]*['"]/u,
    /\bFileSystemPort\b/u,
    /\bcreatePortsAdapterBase\b/u,
    /\bdesktopPortsAdapter\b/u,
    /from\s+['"][^'"]*(?:ports|adapter|persistence)[^'"]*['"]/u,
    /\bfetch\s*\(/u,
    /\bXMLHttpRequest\b/u,
    /\bwriteFile(?:Atomic)?\b/u,
    /\bappendFile\b/u,
    /\bmkdir\b/u,
    /\bmkdtemp\b/u,
    /\brename\b/u,
    /\bunlink\b/u,
    /\brm\b/u,
    /\bcreateWriteStream\b/u,
    /\bDate\.now\s*\(/u,
    /\bMath\.random\s*\(/u,
    /\bApplyTxn\b/u,
    /\bipc(?:Main|Renderer)\b/u,
  ];
  const forbiddenTestPatterns = [
    /\bwriteFile(?:Atomic)?\s*\(/u,
    /\bappendFile\s*\(/u,
    /\bmkdir\s*\(/u,
    /\bmkdtemp\s*\(/u,
    /\brename\s*\(/u,
    /\bunlink\s*\(/u,
    /\brm\s*\(/u,
    /\bcreateWriteStream\s*\(/u,
  ];

  for (const pattern of forbiddenModulePatterns) {
    assert.equal(pattern.test(moduleText), false, `forbidden admission module pattern: ${pattern.source}`);
  }
  for (const pattern of forbiddenTestPatterns) {
    assert.equal(pattern.test(testText), false, `forbidden admission test mutation helper: ${pattern.source}`);
  }
});
