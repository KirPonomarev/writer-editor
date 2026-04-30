const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'reviewIrKernel.mjs';
const TASK_BASENAME = 'EXACT_TEXT_APPLY_REAL_FIXTURE_ROOT_CREATION_001I.md';

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
    fixtureRootId: 'fixture-root-001I',
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

function acceptedFixtureRootCreationPolicy(overrides = {}) {
  return {
    ownerFixtureRootCreationApproved: true,
    fixtureRootCreationRequested: true,
    creationMode: 'TEST_TEMP_ROOT_ONLY',
    realIoScope: 'DIRECTORY_ONLY',
    baseLocationKind: 'OS_TEMP',
    cleanupRequired: true,
    repoRootAccess: false,
    productRootAccess: false,
    productPathAccess: false,
    rootInsideProject: false,
    ...overrides,
  };
}

async function acceptedFixtureRootPathPolicyResult(overrides = {}) {
  const {
    buildReviewPatchSet,
    compileExactTextApplyOps,
    compileExactTextApplyEffectPreviews,
    compileExactTextWritePlanReceiptContract,
    compileExactTextStorageAdapterCallPlan,
    compileExactTextInMemoryStoragePortFixture,
    compileExactTextStorageAdmissionGate,
    compileExactTextFixtureRootPathPolicy,
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
  const storageAdmissionGateResult = compileExactTextStorageAdmissionGate({
    storagePortFixtureResult,
    storageAdmissionPolicy: acceptedAdmissionPolicy(overrides.storageAdmissionPolicy || {}),
    storageAdmissionCapabilities: acceptedAdmissionCapabilities(overrides.storageAdmissionCapabilities || {}),
  });
  return compileExactTextFixtureRootPathPolicy({
    storageAdmissionGateResult,
    fixtureRootPolicy: acceptedFixtureRootPolicy(overrides.fixtureRootPolicy || {}),
  });
}

test('accepted plan admits real temp fixture root creation in test only and cleans it up', async () => {
  const { compileExactTextRealFixtureRootCreationPlan, canonicalHash } = await loadKernel();
  const fixtureRootPathPolicyResult = await acceptedFixtureRootPathPolicyResult();
  const first = compileExactTextRealFixtureRootCreationPlan({
    fixtureRootPathPolicyResult,
    fixtureRootCreationPolicy: acceptedFixtureRootCreationPolicy(),
  });
  const second = compileExactTextRealFixtureRootCreationPlan({
    fixtureRootPathPolicyResult,
    fixtureRootCreationPolicy: acceptedFixtureRootCreationPolicy(),
  });

  assert.deepEqual(first, second);
  assert.equal(first.contractOnly, true);
  assert.equal(first.fixtureRootCreationPlanOnly, true);
  assert.equal(first.realFixtureRootCreationAdmitted, true);
  assert.equal(first.testFixtureDirectoryCreationOnly, true);
  assert.equal(first.filesystemWritePerformed, false);
  assert.equal(first.fsMutationPerformed, false);
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
  assert.equal(first.fixtureRootCreationDecisions.length, 1);

  const decision = first.fixtureRootCreationDecisions[0];
  assert.equal(decision.fixtureRootCreationDecisionKind, 'EXACT_TEXT_REAL_FIXTURE_ROOT_CREATION_DECISION');
  assert.equal(decision.decisionMode, 'TEST_TEMP_ROOT_DIRECTORY_ONLY');
  assert.equal(decision.sourceFixtureRootPolicyResultHash, fixtureRootPathPolicyResult.canonicalHash);
  assert.equal(decision.sourceFixtureRootPolicyDecisionHash, fixtureRootPathPolicyResult.fixtureRootPolicyDecisions[0].canonicalHash);
  assert.equal(decision.creationPolicySnapshot.baseLocationKind, 'OS_TEMP');
  assert.equal(decision.creationPolicySnapshot.repoRootAccess, false);
  assert.equal(decision.creationPolicySnapshot.productRootAccess, false);
  assert.equal(decision.creationPolicySnapshot.productPathAccess, false);
  assert.equal(first.canonicalHash, canonicalHash({
    resultKind: first.resultKind,
    contractOnly: first.contractOnly,
    fixtureRootCreationPlanOnly: first.fixtureRootCreationPlanOnly,
    realFixtureRootCreationAdmitted: first.realFixtureRootCreationAdmitted,
    testFixtureDirectoryCreationOnly: first.testFixtureDirectoryCreationOnly,
    filesystemWritePerformed: first.filesystemWritePerformed,
    fsMutationPerformed: first.fsMutationPerformed,
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
    fixtureRootCreationDecisions: first.fixtureRootCreationDecisions,
    blockedReasons: first.blockedReasons,
  }));

  let tempRoot = '';
  try {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'exact-text-001i-'));
    const repoRoot = fs.realpathSync(process.cwd());
    const realTempRoot = fs.realpathSync(tempRoot);
    assert.equal(fs.statSync(realTempRoot).isDirectory(), true);
    assert.equal(realTempRoot === repoRoot || realTempRoot.startsWith(`${repoRoot}${path.sep}`), false);
  } finally {
    if (tempRoot) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
      assert.equal(fs.existsSync(tempRoot), false);
    }
  }
});

test('real fixture root creation is blocked without owner policy or admitted 001H path policy', async () => {
  const { compileExactTextRealFixtureRootCreationPlan, REASON_CODES } = await loadKernel();
  const fixtureRootPathPolicyResult = await acceptedFixtureRootPathPolicyResult();
  const cases = [
    [REASON_CODES.FIXTURE_ROOT_POLICY_REQUIRED, { fixtureRootPathPolicyResult: {} }],
    [REASON_CODES.FIXTURE_ROOT_POLICY_REQUIRED, { fixtureRootPathPolicyResult: { ...fixtureRootPathPolicyResult, fixturePathPolicyAdmitted: false } }],
    [REASON_CODES.FIXTURE_ROOT_CREATION_POLICY_REQUIRED, {
      fixtureRootPathPolicyResult,
      fixtureRootCreationPolicy: {},
    }],
    [REASON_CODES.FIXTURE_ROOT_CREATION_OWNER_MISSING, {
      fixtureRootPathPolicyResult,
      fixtureRootCreationPolicy: acceptedFixtureRootCreationPolicy({ ownerFixtureRootCreationApproved: false }),
    }],
    [REASON_CODES.FIXTURE_ROOT_CREATION_POLICY_REQUIRED, {
      fixtureRootPathPolicyResult,
      fixtureRootCreationPolicy: acceptedFixtureRootCreationPolicy({ creationMode: 'PRODUCT_ROOT' }),
    }],
  ];

  for (const [reasonCode, input] of cases) {
    const result = compileExactTextRealFixtureRootCreationPlan({
      fixtureRootPathPolicyResult: input.fixtureRootPathPolicyResult,
      fixtureRootCreationPolicy: input.fixtureRootCreationPolicy || acceptedFixtureRootCreationPolicy(),
    });
    assert.equal(result.realFixtureRootCreationAdmitted, false, reasonCode);
    assert.equal(result.testFixtureDirectoryCreationOnly, false, reasonCode);
    assert.deepEqual(result.fixtureRootCreationDecisions, [], reasonCode);
    assert.equal(result.productWritePerformed, false, reasonCode);
    assert.equal(result.blockedReasons.includes(reasonCode), true, reasonCode);
  }
});

test('product repo public and storage primitive requests block real fixture root creation', async () => {
  const { compileExactTextRealFixtureRootCreationPlan, REASON_CODES } = await loadKernel();
  const fixtureRootPathPolicyResult = await acceptedFixtureRootPathPolicyResult();
  const cases = [
    [REASON_CODES.FIXTURE_ROOT_CREATION_SCOPE_UNSAFE, {
      fixtureRootCreationPolicy: acceptedFixtureRootCreationPolicy({ repoRootAccess: true }),
    }],
    [REASON_CODES.FIXTURE_ROOT_CREATION_SCOPE_UNSAFE, {
      fixtureRootCreationPolicy: acceptedFixtureRootCreationPolicy({ productRootAccess: true }),
    }],
    [REASON_CODES.FIXTURE_ROOT_CREATION_SCOPE_UNSAFE, {
      fixtureRootCreationPolicy: acceptedFixtureRootCreationPolicy({ rootInsideProject: true }),
    }],
    [REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR, { productRootRequested: true }],
    [REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR, { productPathRequested: true }],
    [REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR, { productWrite: true }],
    [REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR, { publicSurfaceRequested: true }],
    [REASON_CODES.FS_MUTATION_FORBIDDEN_IN_CONTOUR, { storagePrimitiveRequested: true }],
  ];

  for (const [reasonCode, input] of cases) {
    const result = compileExactTextRealFixtureRootCreationPlan({
      fixtureRootPathPolicyResult,
      fixtureRootCreationPolicy: input.fixtureRootCreationPolicy || acceptedFixtureRootCreationPolicy(),
      productRootRequested: input.productRootRequested,
      productPathRequested: input.productPathRequested,
      productWrite: input.productWrite,
      publicSurfaceRequested: input.publicSurfaceRequested,
      storagePrimitiveRequested: input.storagePrimitiveRequested,
    });
    assert.equal(result.realFixtureRootCreationAdmitted, false, reasonCode);
    assert.deepEqual(result.fixtureRootCreationDecisions, [], reasonCode);
    assert.equal(result.productWritePerformed, false, reasonCode);
    assert.equal(result.publicSurfaceClaimed, false, reasonCode);
    assert.equal(result.storagePrimitiveChanged, false, reasonCode);
    assert.equal(result.blockedReasons.includes(reasonCode), true, reasonCode);
  }
});

test('contaminated 001H upstream false flags block real fixture root creation', async () => {
  const { compileExactTextRealFixtureRootCreationPlan, REASON_CODES } = await loadKernel();
  const fixtureRootPathPolicyResult = await acceptedFixtureRootPathPolicyResult();
  const contaminatedFlags = [
    'fsMutationPerformed',
    'tempFixtureWritePerformed',
    'productWritePerformed',
    'productWriteClaimed',
    'fixtureBackupCreated',
    'fixtureAtomicWriteExecuted',
    'fixtureRecoverySnapshotCreated',
    'fixtureReceiptPersisted',
    'durableReceiptClaimed',
    'productStorageSafetyClaimed',
    'publicSurfaceClaimed',
    'docxImportClaimed',
    'uiChanged',
    'applyTxnClaimed',
    'crashRecoveryClaimed',
    'releaseClaimed',
    'storageImportsAdded',
    'storagePrimitiveChanged',
  ];

  for (const flag of contaminatedFlags) {
    const result = compileExactTextRealFixtureRootCreationPlan({
      fixtureRootPathPolicyResult: {
        ...fixtureRootPathPolicyResult,
        [flag]: true,
      },
      fixtureRootCreationPolicy: acceptedFixtureRootCreationPolicy(),
    });
    assert.equal(result.realFixtureRootCreationAdmitted, false, flag);
    assert.equal(result.testFixtureDirectoryCreationOnly, false, flag);
    assert.deepEqual(result.fixtureRootCreationDecisions, [], flag);
    assert.equal(result.productWritePerformed, false, flag);
    assert.equal(result.blockedReasons.includes(REASON_CODES.FIXTURE_ROOT_POLICY_REQUIRED), true, flag);
  }
});

test('001I task record pins real fixture root creation as test only and no product storage claim', () => {
  const taskText = fs.readFileSync(
    path.join(process.cwd(), 'docs', 'tasks', TASK_BASENAME),
    'utf8',
  );
  const requiredFalseFlags = [
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

  assert.match(taskText, /STATUS: IMPLEMENTED_VERIFIED_REAL_FIXTURE_ROOT_CREATION_TEST_ONLY/u);
  assert.match(taskText, /TEST_FIXTURE_ROOT_CREATED: true/u);
  assert.match(taskText, /KERNEL_FILESYSTEM_WRITE_PERFORMED: false/u);
  assert.match(taskText, /KERNEL_FS_MUTATION_PERFORMED: false/u);
  assert.match(taskText, /TEST_MUTATING_IO_SCOPE: OS_TEMP_DIRECTORY_ONLY/u);
  assert.match(taskText, /TEST_NON_MUTATING_IO_SCOPE: contract reads and git scope inspection allowed/u);
  assert.match(taskText, /TEST_CLEANUP_REQUIRED: true/u);
  for (const flag of requiredFalseFlags) {
    assert.match(taskText, new RegExp(`${flag}: false`, 'u'), flag);
    assert.doesNotMatch(taskText, new RegExp(`${flag}: true`, 'u'), flag);
  }
  assert.doesNotMatch(taskText, /product saved|public API exposed|DOCX runtime enabled|receipt persisted|backup executed|atomic write executed/iu);
});

test('001I change scope stays inside allowlist and outside product runtime surfaces', () => {
  const changedBasenames = changedBasenamesForCurrentContour();
  const allowlist = new Set([
    'reviewIrKernel.mjs',
    'exactTextApplyFixtureRootPolicy.contract.test.js',
    'exactTextApplyRealFixtureRootCreation.contract.test.js',
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

  assert.notDeepEqual(changedBasenames, [], '001I must have a detectable changed scope');
  for (const basename of changedBasenames) {
    assert.equal(allowlist.has(basename), true, `unexpected 001I changed basename: ${basename}`);
    assert.equal(denylist.has(basename), false, `denylisted 001I changed basename: ${basename}`);
  }
});

test('real fixture root creation keeps production kernel pure and adds no file write helper', () => {
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
    /from\s+['"]node:os['"]/u,
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
    /\brename\s*\(/u,
    /\bunlink\s*\(/u,
    /\bcreateWriteStream\s*\(/u,
  ];

  for (const pattern of forbiddenModulePatterns) {
    assert.equal(pattern.test(moduleText), false, `forbidden real fixture root creation module pattern: ${pattern.source}`);
  }
  for (const pattern of forbiddenTestPatterns) {
    assert.equal(pattern.test(testText), false, `forbidden real fixture root creation test write helper: ${pattern.source}`);
  }
  assert.equal(/\bmkdtempSync\s*\(/u.test(testText), true);
  assert.equal(/\brmSync\s*\(/u.test(testText), true);
});
