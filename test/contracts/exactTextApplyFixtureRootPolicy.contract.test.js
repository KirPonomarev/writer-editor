const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'reviewIrKernel.mjs';
const TASK_BASENAME = 'EXACT_TEXT_APPLY_STORAGE_FIXTURE_ROOT_AND_PATH_POLICY_001H.md';

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

function acceptedFixtureRootPolicy(overrides = {}) {
  return {
    fixtureRootId: 'fixture-root-001H',
    productRootId: 'product-root',
    rootKind: 'FIXTURE',
    isolatedRoot: true,
    isolatedMarker: 'EXACT_TEXT_FIXTURE_ROOT_ISOLATED',
    relativePath: 'scenes/scene-1.txt',
    relativePathSegments: ['scenes', 'scene-1.txt'],
    symlinkPolicy: 'BLOCK',
    caseCollisionPolicy: 'DETECT_AND_BLOCK',
    reservedNamePolicy: 'DETECT_AND_BLOCK',
    longPathPolicy: 'DECLARE_AND_BLOCK_UNSUPPORTED',
    hashPolicy: {
      normalizationPolicy: 'TEXT_V1',
      newlinePolicy: 'LF',
      unicodePolicy: 'NFC',
    },
    ...overrides,
  };
}

async function acceptedStorageAdmissionGateResult(overrides = {}) {
  const {
    buildReviewPatchSet,
    compileExactTextApplyOps,
    compileExactTextApplyEffectPreviews,
    compileExactTextWritePlanReceiptContract,
    compileExactTextStorageAdapterCallPlan,
    compileExactTextInMemoryStoragePortFixture,
    compileExactTextStorageAdmissionGate,
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
  const storagePortFixtureResult = compileExactTextInMemoryStoragePortFixture({
    storageAdapterCallPlanResult,
    fixtureCapabilities: acceptedFixtureCapabilities(overrides.fixtureCapabilities || {}),
  });
  return compileExactTextStorageAdmissionGate({
    storagePortFixtureResult,
    storageAdmissionPolicy: acceptedAdmissionPolicy(overrides.storageAdmissionPolicy || {}),
    storageAdmissionCapabilities: acceptedAdmissionCapabilities(overrides.storageAdmissionCapabilities || {}),
  });
}

test('accepted storage admission feeds deterministic fixture root path policy without filesystem write', async () => {
  const { compileExactTextFixtureRootPathPolicy, canonicalHash } = await loadKernel();
  const storageAdmissionGateResult = await acceptedStorageAdmissionGateResult();
  const first = compileExactTextFixtureRootPathPolicy({
    storageAdmissionGateResult,
    fixtureRootPolicy: acceptedFixtureRootPolicy(),
  });
  const second = compileExactTextFixtureRootPathPolicy({
    storageAdmissionGateResult,
    fixtureRootPolicy: acceptedFixtureRootPolicy(),
  });

  assert.deepEqual(first, second);
  assert.equal(first.contractOnly, true);
  assert.equal(first.pathPolicyOnly, true);
  assert.equal(first.fixturePathPolicyAdmitted, true);
  assert.equal(first.filesystemWritePerformed, false);
  assert.equal(first.fsMutationPerformed, false);
  assert.equal(first.tempDirUsed, false);
  assert.equal(first.tempFixtureWritePerformed, false);
  assert.equal(first.productWritePerformed, false);
  assert.equal(first.productWriteClaimed, false);
  assert.equal(first.fixtureBackupCreated, false);
  assert.equal(first.fixtureAtomicWriteExecuted, false);
  assert.equal(first.fixtureRecoverySnapshotCreated, false);
  assert.equal(first.fixtureReceiptPersisted, false);
  assert.equal(first.durableReceiptClaimed, false);
  assert.equal(first.productStorageSafetyClaimed, false);
  assert.equal(first.publicSurfaceClaimed, false);
  assert.equal(first.docxImportClaimed, false);
  assert.equal(first.uiChanged, false);
  assert.equal(first.applyTxnClaimed, false);
  assert.equal(first.crashRecoveryClaimed, false);
  assert.equal(first.releaseClaimed, false);
  assert.equal(first.storageImportsAdded, false);
  assert.equal(first.storagePrimitiveChanged, false);
  assert.deepEqual(first.blockedReasons, []);
  assert.equal(first.fixtureRootPolicyDecisions.length, 1);

  const admissionDecision = storageAdmissionGateResult.admissionDecisions[0];
  const decision = first.fixtureRootPolicyDecisions[0];
  assert.equal(decision.fixtureRootPolicyDecisionKind, 'EXACT_TEXT_FIXTURE_ROOT_PATH_POLICY_DECISION');
  assert.equal(decision.decisionMode, 'PURE_PATH_POLICY_ONLY');
  assert.equal(decision.sourceStorageAdmissionResultHash, storageAdmissionGateResult.canonicalHash);
  assert.equal(decision.sourceStorageAdmissionDecisionHash, admissionDecision.canonicalHash);
  assert.equal(decision.sourceFixtureExecutionHash, admissionDecision.sourceFixtureExecutionHash);
  assert.equal(decision.sourceCallPlanHash, admissionDecision.sourceCallPlanHash);
  assert.equal(decision.sourceWritePlanHash, admissionDecision.sourceWritePlanHash);
  assert.equal(decision.sourceReceiptContractHash, admissionDecision.sourceReceiptContractHash);
  assert.equal(decision.fixtureRootPolicySnapshot.isolatedMarker, 'EXACT_TEXT_FIXTURE_ROOT_ISOLATED');
  assert.equal(decision.fixtureRootPolicySnapshot.hashPolicy.newlinePolicy, 'LF');
  assert.equal(decision.fixtureRootPolicySnapshot.hashPolicy.unicodePolicy, 'NFC');
  assert.equal(first.canonicalHash, canonicalHash({
    resultKind: first.resultKind,
    contractOnly: first.contractOnly,
    pathPolicyOnly: first.pathPolicyOnly,
    fixturePathPolicyAdmitted: first.fixturePathPolicyAdmitted,
    filesystemWritePerformed: first.filesystemWritePerformed,
    fsMutationPerformed: first.fsMutationPerformed,
    tempDirUsed: first.tempDirUsed,
    tempFixtureWritePerformed: first.tempFixtureWritePerformed,
    productWritePerformed: first.productWritePerformed,
    productWriteClaimed: first.productWriteClaimed,
    fixtureBackupCreated: first.fixtureBackupCreated,
    fixtureAtomicWriteExecuted: first.fixtureAtomicWriteExecuted,
    fixtureRecoverySnapshotCreated: first.fixtureRecoverySnapshotCreated,
    fixtureReceiptPersisted: first.fixtureReceiptPersisted,
    durableReceiptClaimed: first.durableReceiptClaimed,
    productStorageSafetyClaimed: first.productStorageSafetyClaimed,
    publicSurfaceClaimed: first.publicSurfaceClaimed,
    docxImportClaimed: first.docxImportClaimed,
    uiChanged: first.uiChanged,
    applyTxnClaimed: first.applyTxnClaimed,
    crashRecoveryClaimed: first.crashRecoveryClaimed,
    releaseClaimed: first.releaseClaimed,
    storageImportsAdded: first.storageImportsAdded,
    storagePrimitiveChanged: first.storagePrimitiveChanged,
    fixtureRootPolicyDecisions: first.fixtureRootPolicyDecisions,
    blockedReasons: first.blockedReasons,
  }));
});

test('fixture root path policy is blocked by default without explicit policy', async () => {
  const { compileExactTextFixtureRootPathPolicy, REASON_CODES } = await loadKernel();
  const storageAdmissionGateResult = await acceptedStorageAdmissionGateResult();
  const result = compileExactTextFixtureRootPathPolicy({ storageAdmissionGateResult });

  assert.equal(result.fixturePathPolicyAdmitted, false);
  assert.deepEqual(result.fixtureRootPolicyDecisions, []);
  assert.equal(result.filesystemWritePerformed, false);
  assert.equal(result.tempDirUsed, false);
  assert.equal(result.productWritePerformed, false);
  assert.equal(result.blockedReasons.includes(REASON_CODES.FIXTURE_ROOT_POLICY_REQUIRED), true);
  assert.equal(result.blockedReasons.includes(REASON_CODES.FIXTURE_ROOT_NOT_ISOLATED), true);
  assert.equal(result.blockedReasons.includes(REASON_CODES.SYMLINK_POLICY_UNSAFE), true);
});

test('fixture root path policy hash changes with admission hash and path policy', async () => {
  const { compileExactTextFixtureRootPathPolicy } = await loadKernel();
  const storageAdmissionGateResult = await acceptedStorageAdmissionGateResult();
  const base = compileExactTextFixtureRootPathPolicy({
    storageAdmissionGateResult,
    fixtureRootPolicy: acceptedFixtureRootPolicy(),
  });
  const changedAdmission = compileExactTextFixtureRootPathPolicy({
    storageAdmissionGateResult: {
      ...storageAdmissionGateResult,
      canonicalHash: 'changed-admission-result-hash',
    },
    fixtureRootPolicy: acceptedFixtureRootPolicy(),
  });
  const changedPolicy = compileExactTextFixtureRootPathPolicy({
    storageAdmissionGateResult,
    fixtureRootPolicy: acceptedFixtureRootPolicy({ relativePath: 'scenes/scene-2.txt', relativePathSegments: ['scenes', 'scene-2.txt'] }),
  });

  assert.notEqual(base.canonicalHash, changedAdmission.canonicalHash);
  assert.notEqual(base.canonicalHash, changedPolicy.canonicalHash);
});

test('product root product path traversal absolute path and unsafe symlink policies are blocked', async () => {
  const { compileExactTextFixtureRootPathPolicy, REASON_CODES } = await loadKernel();
  const storageAdmissionGateResult = await acceptedStorageAdmissionGateResult();
  const cases = [
    [REASON_CODES.PRODUCT_ROOT_FORBIDDEN, acceptedFixtureRootPolicy({ rootKind: 'PRODUCT' })],
    [REASON_CODES.PRODUCT_ROOT_FORBIDDEN, acceptedFixtureRootPolicy({ fixtureRootId: 'product-root' })],
    [REASON_CODES.PRODUCT_PATH_FORBIDDEN, acceptedFixtureRootPolicy({ productPath: true })],
    [REASON_CODES.PATH_TRAVERSAL_FORBIDDEN, acceptedFixtureRootPolicy({ relativePath: '../scene.txt', relativePathSegments: ['..', 'scene.txt'] })],
    [REASON_CODES.ABSOLUTE_PATH_ESCAPE_FORBIDDEN, acceptedFixtureRootPolicy({ relativePath: '/tmp/scene.txt' })],
    [REASON_CODES.ABSOLUTE_PATH_ESCAPE_FORBIDDEN, acceptedFixtureRootPolicy({ relativePath: 'C:\\tmp\\scene.txt' })],
    [REASON_CODES.SYMLINK_POLICY_UNSAFE, acceptedFixtureRootPolicy({ symlinkPolicy: 'ALLOW' })],
  ];

  for (const [reasonCode, fixtureRootPolicy] of cases) {
    const result = compileExactTextFixtureRootPathPolicy({ storageAdmissionGateResult, fixtureRootPolicy });
    assert.equal(result.fixturePathPolicyAdmitted, false, reasonCode);
    assert.deepEqual(result.fixtureRootPolicyDecisions, [], reasonCode);
    assert.equal(result.filesystemWritePerformed, false, reasonCode);
    assert.equal(result.productWritePerformed, false, reasonCode);
    assert.equal(result.blockedReasons.includes(reasonCode), true, reasonCode);
  }
});

test('xplat policy declarations and hash policy are required before any fixture root is admitted', async () => {
  const { compileExactTextFixtureRootPathPolicy, REASON_CODES } = await loadKernel();
  const storageAdmissionGateResult = await acceptedStorageAdmissionGateResult();
  const cases = [
    [REASON_CODES.CASE_COLLISION_POLICY_MISSING, acceptedFixtureRootPolicy({ caseCollisionPolicy: '' })],
    [REASON_CODES.RESERVED_NAME_POLICY_MISSING, acceptedFixtureRootPolicy({ reservedNamePolicy: '' })],
    [REASON_CODES.LONG_PATH_POLICY_MISSING, acceptedFixtureRootPolicy({ longPathPolicy: '' })],
    [REASON_CODES.FIXTURE_ROOT_POLICY_REQUIRED, acceptedFixtureRootPolicy({ isolatedMarker: '' })],
    [REASON_CODES.MISSING_PRECONDITION, acceptedFixtureRootPolicy({ hashPolicy: { newlinePolicy: 'LF', unicodePolicy: 'NFC' } })],
  ];

  for (const [reasonCode, fixtureRootPolicy] of cases) {
    const result = compileExactTextFixtureRootPathPolicy({ storageAdmissionGateResult, fixtureRootPolicy });
    assert.equal(result.fixturePathPolicyAdmitted, false, reasonCode);
    assert.equal(result.blockedReasons.includes(reasonCode), true, reasonCode);
  }
});

test('storage admission blockers and write requests block fixture root path policy', async () => {
  const { compileExactTextFixtureRootPathPolicy, REASON_CODES } = await loadKernel();
  const blockedAdmission = await acceptedStorageAdmissionGateResult({
    storageAdmissionPolicy: { ownerAdmissionApproved: false },
  });
  const acceptedAdmission = await acceptedStorageAdmissionGateResult();
  const cases = [
    [REASON_CODES.OWNER_ADMISSION_MISSING, { storageAdmissionGateResult: blockedAdmission }],
    [REASON_CODES.STORAGE_ADMISSION_REQUIRED, { storageAdmissionGateResult: { ...acceptedAdmission, runtimeStorageAdmitted: false } }],
    [REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR, { storageAdmissionGateResult: acceptedAdmission, productWrite: true }],
    [REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR, { storageAdmissionGateResult: acceptedAdmission, fsMutationRequested: true }],
    [REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR, { storageAdmissionGateResult: acceptedAdmission, tempDirRequested: true }],
    [REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR, { storageAdmissionGateResult: acceptedAdmission, tempFixtureWriteRequested: true }],
    [REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR, { storageAdmissionGateResult: acceptedAdmission, publicSurfaceRequested: true }],
  ];

  for (const [reasonCode, input] of cases) {
    const result = compileExactTextFixtureRootPathPolicy({
      storageAdmissionGateResult: input.storageAdmissionGateResult,
      fixtureRootPolicy: acceptedFixtureRootPolicy(),
      productWrite: input.productWrite,
      fsMutationRequested: input.fsMutationRequested,
      tempDirRequested: input.tempDirRequested,
      tempFixtureWriteRequested: input.tempFixtureWriteRequested,
      publicSurfaceRequested: input.publicSurfaceRequested,
    });
    assert.equal(result.fixturePathPolicyAdmitted, false, reasonCode);
    assert.deepEqual(result.fixtureRootPolicyDecisions, [], reasonCode);
    assert.equal(result.filesystemWritePerformed, false, reasonCode);
    assert.equal(result.tempDirUsed, false, reasonCode);
    assert.equal(result.productWritePerformed, false, reasonCode);
    assert.equal(result.blockedReasons.includes(reasonCode), true, reasonCode);
  }
});

test('001H task record pins path policy false-green flags', () => {
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
    'FIXTURE_BACKUP_CREATED',
    'FIXTURE_ATOMIC_WRITE_EXECUTED',
    'FIXTURE_RECOVERY_SNAPSHOT_CREATED',
    'FIXTURE_RECEIPT_PERSISTED',
    'DURABLE_RECEIPT_CLAIMED',
    'PRODUCT_STORAGE_SAFETY_CLAIMED',
    'PUBLIC_SURFACE_CLAIMED',
    'DOCX_IMPORT_CLAIMED',
    'UI_CHANGED',
    'APPLYTXN_CLAIMED',
    'CRASH_RECOVERY_CLAIMED',
    'RELEASE_CLAIMED',
    'STORAGE_IMPORTS_ADDED',
    'STORAGE_PRIMITIVE_CHANGED',
  ];

  assert.match(taskText, /STATUS: IMPLEMENTED_VERIFIED_CONTRACT_ONLY_PATH_POLICY_NO_FS_WRITE/u);
  assert.match(taskText, /CONTRACT_ONLY: true/u);
  assert.match(taskText, /PATH_POLICY_ONLY: true/u);
  for (const flag of requiredFalseFlags) {
    assert.match(taskText, new RegExp(`${flag}: false`, 'u'), flag);
    assert.doesNotMatch(taskText, new RegExp(`${flag}: true`, 'u'), flag);
  }
  assert.doesNotMatch(taskText, /created fixture root|wrote fixture|committed to disk|product saved|public API exposed|DOCX runtime enabled/iu);
});

test('001H change scope stays inside allowlist and outside storage runtime surfaces', () => {
  const changedBasenames = changedBasenamesForCurrentContour();
  const allowlist = new Set([
    'reviewIrKernel.mjs',
    'exactTextApplyFixtureRootPolicy.contract.test.js',
    'exactTextApplyStorageAdmission.contract.test.js',
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

  assert.notDeepEqual(changedBasenames, [], '001H must have a detectable changed scope');
  for (const basename of changedBasenames) {
    assert.equal(allowlist.has(basename), true, `unexpected 001H changed basename: ${basename}`);
    assert.equal(denylist.has(basename), false, `denylisted 001H changed basename: ${basename}`);
  }
});

test('fixture root path policy adds no filesystem public surface UI DOCX dependency or nondeterminism', () => {
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
    assert.equal(pattern.test(moduleText), false, `forbidden fixture root policy module pattern: ${pattern.source}`);
  }
  for (const pattern of forbiddenTestPatterns) {
    assert.equal(pattern.test(testText), false, `forbidden fixture root policy test mutation helper: ${pattern.source}`);
  }
});
