const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'reviewIrKernel.mjs';
const TASK_BASENAME = 'EXACT_TEXT_APPLY_TEST_FIXTURE_TEMP_RENAME_OBSERVATION_001K.md';

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

function exactTextDecision() {
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
    items: [{
      id: 'decision-1',
      kind: 'TEXT_REPLACE',
      targetScope: { sceneId: 'scene-1', blockId: 'block-1' },
      blockVersionHash: 'block-v1',
      selectors: [{
        selectorKind: 'TEXT_QUOTE',
        selectorEvidence: { exact: 'old text', prefix: 'before', suffix: 'after' },
      }],
      evidence: [{ exactText: 'old text', prefix: 'before', suffix: 'after' }],
      expectedText: 'old text',
      replacementText: 'new text',
    }],
  };
}

function acceptedEnvironment() {
  return {
    projectId: 'project-1',
    currentBaselineHash: 'baseline-a',
    sessionOpen: true,
    sceneId: 'scene-1',
    currentBlockVersions: { 'block-1': 'block-v1' },
    currentTextByBlock: { 'block-1': 'old text' },
  };
}

function acceptedFixtureRootPolicy(overrides = {}) {
  return {
    fixtureRootId: 'fixture-root-001K',
    productRootId: 'product-root',
    rootKind: 'FIXTURE',
    isolatedRoot: true,
    isolatedMarker: 'EXACT_TEXT_FIXTURE_ROOT_ISOLATED',
    relativePath: 'scene-1.txt',
    relativePathSegments: ['scene-1.txt'],
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

function acceptedFixtureRootCreationPolicy() {
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
  };
}

function acceptedFixtureTextWritePolicy() {
  return {
    ownerFixtureTextWriteApproved: true,
    fixtureTextWriteRequested: true,
    writeMode: 'TEST_TEMP_FILE_ONLY',
    realIoScope: 'FILE_ONLY',
    baseLocationKind: 'OS_TEMP',
    hashObservationOnly: true,
    cleanupRequired: true,
    repoRootAccess: false,
    productRootAccess: false,
    productPathAccess: false,
    rootInsideProject: false,
    relativePath: 'scene-1.txt',
    relativePathSegments: ['scene-1.txt'],
    beforeText: 'old text',
    afterText: 'new text',
    hashPolicy: {
      normalizationPolicy: 'TEXT_V1',
      newlinePolicy: 'LF',
      unicodePolicy: 'NFC',
    },
  };
}

function acceptedFixtureTempRenamePolicy(overrides = {}) {
  return {
    ownerFixtureTempRenameApproved: true,
    fixtureTempRenameRequested: true,
    renameMode: 'TEST_TEMP_RENAME_ONLY',
    realIoScope: 'TEMP_FILE_RENAME_ONLY',
    baseLocationKind: 'OS_TEMP',
    sameRootRename: true,
    hashObservationOnly: true,
    cleanupRequired: true,
    repoRootAccess: false,
    productRootAccess: false,
    productPathAccess: false,
    rootInsideProject: false,
    tempRelativePath: 'scene-1.tmp',
    tempRelativePathSegments: ['scene-1.tmp'],
    targetRelativePath: 'scene-1.txt',
    targetRelativePathSegments: ['scene-1.txt'],
    beforeText: 'old text',
    afterText: 'new text',
    hashPolicy: {
      normalizationPolicy: 'TEXT_V1',
      newlinePolicy: 'LF',
      unicodePolicy: 'NFC',
    },
    ...overrides,
  };
}

async function acceptedFixtureTextWritePlanResult() {
  const {
    buildReviewPatchSet,
    compileExactTextApplyOps,
    compileExactTextApplyEffectPreviews,
    compileExactTextWritePlanReceiptContract,
    compileExactTextStorageAdapterCallPlan,
    compileExactTextInMemoryStoragePortFixture,
    compileExactTextStorageAdmissionGate,
    compileExactTextFixtureRootPathPolicy,
    compileExactTextRealFixtureRootCreationPlan,
    compileExactTextTestFixtureTextWritePlan,
  } = await loadKernel();
  const applyResult = compileExactTextApplyOps(
    buildReviewPatchSet(exactTextDecision()),
    acceptedEnvironment(),
  );
  const effectPreviewPlan = compileExactTextApplyEffectPreviews(applyResult);
  const writePlanReceiptResult = compileExactTextWritePlanReceiptContract({ applyResult, effectPreviewPlan });
  const storageAdapterCallPlanResult = compileExactTextStorageAdapterCallPlan({
    writePlanReceiptResult,
    storagePortCapabilities: {
      canBackupBeforeWrite: true,
      canAtomicWriteSceneText: true,
      canCreateReadableRecoverySnapshot: true,
      canReportBeforeHash: true,
      canReportAfterHash: true,
      deterministicObservationIds: true,
      productPathAccess: false,
    },
  });
  const storagePortFixtureResult = compileExactTextInMemoryStoragePortFixture({
    storageAdapterCallPlanResult,
    fixtureCapabilities: {
      canObserveBackup: true,
      canObserveAtomicWrite: true,
      canObserveRecoverySnapshot: true,
      canProduceFixtureReceiptContract: true,
      deterministicObservationIds: true,
      realIoAvailable: false,
      productPathAccess: false,
    },
  });
  const storageAdmissionGateResult = compileExactTextStorageAdmissionGate({
    storagePortFixtureResult,
    storageAdmissionPolicy: {
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
    },
    storageAdmissionCapabilities: {
      canBackupBeforeWrite: true,
      canAtomicWriteSceneText: true,
      canCreateReadableRecoverySnapshot: true,
      canPersistReceipt: true,
      productPathAccess: false,
      publicSurfaceAvailable: false,
    },
  });
  const fixtureRootPathPolicyResult = compileExactTextFixtureRootPathPolicy({
    storageAdmissionGateResult,
    fixtureRootPolicy: acceptedFixtureRootPolicy(),
  });
  const fixtureRootCreationPlanResult = compileExactTextRealFixtureRootCreationPlan({
    fixtureRootPathPolicyResult,
    fixtureRootCreationPolicy: acceptedFixtureRootCreationPolicy(),
  });
  return compileExactTextTestFixtureTextWritePlan({
    fixtureRootCreationPlanResult,
    fixtureTextWritePolicy: acceptedFixtureTextWritePolicy(),
  });
}

test('accepted plan admits deterministic temp rename observation without product atomicity claim', async () => {
  const { compileExactTextTestFixtureTempRenameObservationPlan, canonicalHash } = await loadKernel();
  const fixtureTextWritePlanResult = await acceptedFixtureTextWritePlanResult();
  const first = compileExactTextTestFixtureTempRenameObservationPlan({
    fixtureTextWritePlanResult,
    fixtureTempRenamePolicy: acceptedFixtureTempRenamePolicy(),
  });
  const second = compileExactTextTestFixtureTempRenameObservationPlan({
    fixtureTextWritePlanResult,
    fixtureTempRenamePolicy: acceptedFixtureTempRenamePolicy(),
  });

  assert.deepEqual(first, second);
  assert.equal(first.contractOnly, true);
  assert.equal(first.testFixtureTempRenameObservationPlanOnly, true);
  assert.equal(first.testFixtureTempRenameAdmitted, true);
  assert.equal(first.testFixtureTempRenameObservationOnly, true);
  assert.equal(first.hashObservationOnly, true);
  assert.equal(first.xplatAtomicityNotProven, true);
  assert.equal(first.productAtomicWriteNotProven, true);
  assert.equal(first.tempRenameNotRecovery, true);
  assert.equal(first.filesystemWritePerformed, false);
  assert.equal(first.fsMutationPerformed, false);
  assert.equal(first.productWritePerformed, false);
  assert.equal(first.productWriteClaimed, false);
  assert.equal(first.productAtomicityClaimed, false);
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
  assert.equal(first.fixtureTempRenameDecisions.length, 1);

  const decision = first.fixtureTempRenameDecisions[0];
  assert.equal(decision.fixtureTempRenameDecisionKind, 'EXACT_TEXT_TEST_FIXTURE_TEMP_RENAME_OBSERVATION_DECISION');
  assert.equal(decision.decisionMode, 'TEST_TEMP_RENAME_HASH_OBSERVATION_ONLY');
  assert.equal(decision.tempRelativePath, 'scene-1.tmp');
  assert.equal(decision.targetRelativePath, 'scene-1.txt');
  assert.equal(decision.sourceFixtureTextWriteResultHash, fixtureTextWritePlanResult.canonicalHash);
  assert.equal(decision.sourceFixtureTextWriteDecisionHash, fixtureTextWritePlanResult.fixtureTextWriteDecisions[0].canonicalHash);
  assert.equal(decision.afterHashObservation.textHash, canonicalHash({
    text: 'new text',
    normalizationPolicy: 'TEXT_V1',
    newlinePolicy: 'LF',
    unicodePolicy: 'NFC',
  }));
});

test('temp rename observation writes temp file renames to target and leaves no temp file', async () => {
  const { compileExactTextTestFixtureTempRenameObservationPlan, canonicalHash } = await loadKernel();
  const result = compileExactTextTestFixtureTempRenameObservationPlan({
    fixtureTextWritePlanResult: await acceptedFixtureTextWritePlanResult(),
    fixtureTempRenamePolicy: acceptedFixtureTempRenamePolicy(),
  });
  const decision = result.fixtureTempRenameDecisions[0];
  let tempRoot = '';
  try {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'exact-text-001k-'));
    const repoRoot = fs.realpathSync(process.cwd());
    const realTempRoot = fs.realpathSync(tempRoot);
    const tempPath = path.join(realTempRoot, decision.tempRelativePath);
    const targetPath = path.join(realTempRoot, decision.targetRelativePath);
    assert.equal(realTempRoot === repoRoot || realTempRoot.startsWith(`${repoRoot}${path.sep}`), false);
    assert.equal(path.dirname(tempPath), realTempRoot);
    assert.equal(path.dirname(targetPath), realTempRoot);
    fs.writeFileSync(targetPath, 'old text', 'utf8');
    fs.writeFileSync(tempPath, 'new text', 'utf8');
    fs.renameSync(tempPath, targetPath);
    assert.equal(fs.existsSync(tempPath), false);
    assert.equal(fs.readFileSync(targetPath, 'utf8'), 'new text');
    assert.equal(canonicalHash({
      text: fs.readFileSync(targetPath, 'utf8'),
      normalizationPolicy: 'TEXT_V1',
      newlinePolicy: 'LF',
      unicodePolicy: 'NFC',
    }), decision.afterHashObservation.textHash);
  } finally {
    if (tempRoot) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
      assert.equal(fs.existsSync(tempRoot), false);
    }
  }
});

test('missing contaminated or unsafe 001J result blocks temp rename observation', async () => {
  const { compileExactTextTestFixtureTempRenameObservationPlan, REASON_CODES } = await loadKernel();
  const fixtureTextWritePlanResult = await acceptedFixtureTextWritePlanResult();
  const contaminated = [
    {},
    { ...fixtureTextWritePlanResult, testFixtureTextWriteAdmitted: false },
    { ...fixtureTextWritePlanResult, productWriteClaimed: true },
    { ...fixtureTextWritePlanResult, fixtureAtomicWriteExecuted: true },
    { ...fixtureTextWritePlanResult, fixtureRecoverySnapshotCreated: true },
    { ...fixtureTextWritePlanResult, fixtureReceiptPersisted: true },
    { ...fixtureTextWritePlanResult, productStorageSafetyClaimed: true },
    { ...fixtureTextWritePlanResult, storagePrimitiveChanged: true },
  ];

  for (const fixtureTextWritePlanResultInput of contaminated) {
    const result = compileExactTextTestFixtureTempRenameObservationPlan({
      fixtureTextWritePlanResult: fixtureTextWritePlanResultInput,
      fixtureTempRenamePolicy: acceptedFixtureTempRenamePolicy(),
    });
    assert.equal(result.testFixtureTempRenameAdmitted, false);
    assert.deepEqual(result.fixtureTempRenameDecisions, []);
    assert.equal(result.blockedReasons.includes(REASON_CODES.FIXTURE_TEXT_WRITE_PLAN_REQUIRED), true);
  }
});

test('product path public storage primitive and unsafe temp paths block temp rename observation', async () => {
  const { compileExactTextTestFixtureTempRenameObservationPlan, REASON_CODES } = await loadKernel();
  const fixtureTextWritePlanResult = await acceptedFixtureTextWritePlanResult();
  const cases = [
    [REASON_CODES.FIXTURE_TEMP_RENAME_OWNER_MISSING, { fixtureTempRenamePolicy: acceptedFixtureTempRenamePolicy({ ownerFixtureTempRenameApproved: false }) }],
    [REASON_CODES.FIXTURE_TEMP_RENAME_POLICY_REQUIRED, { fixtureTempRenamePolicy: acceptedFixtureTempRenamePolicy({ sameRootRename: false }) }],
    [REASON_CODES.FIXTURE_TEMP_RENAME_SCOPE_UNSAFE, { fixtureTempRenamePolicy: acceptedFixtureTempRenamePolicy({ repoRootAccess: true }) }],
    [REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR, { productWrite: true }],
    [REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR, { productPathRequested: true }],
    [REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR, { productAtomicityClaimed: true }],
    [REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR, { publicSurfaceRequested: true }],
    [REASON_CODES.FS_MUTATION_FORBIDDEN_IN_CONTOUR, { storagePrimitiveRequested: true }],
    [REASON_CODES.ABSOLUTE_PATH_ESCAPE_FORBIDDEN, { fixtureTempRenamePolicy: acceptedFixtureTempRenamePolicy({ tempRelativePath: '/tmp/scene.tmp' }) }],
    [REASON_CODES.PATH_TRAVERSAL_FORBIDDEN, { fixtureTempRenamePolicy: acceptedFixtureTempRenamePolicy({ tempRelativePath: '../scene.tmp', tempRelativePathSegments: ['..', 'scene.tmp'] }) }],
    [REASON_CODES.FIXTURE_TEMP_RENAME_POLICY_REQUIRED, { fixtureTempRenamePolicy: acceptedFixtureTempRenamePolicy({ tempRelativePath: 'nested/scene.tmp', tempRelativePathSegments: ['scene.tmp'] }) }],
  ];

  for (const [reasonCode, input] of cases) {
    const result = compileExactTextTestFixtureTempRenameObservationPlan({
      fixtureTextWritePlanResult,
      fixtureTempRenamePolicy: input.fixtureTempRenamePolicy || acceptedFixtureTempRenamePolicy(),
      productWrite: input.productWrite,
      productPathRequested: input.productPathRequested,
      productAtomicityClaimed: input.productAtomicityClaimed,
      publicSurfaceRequested: input.publicSurfaceRequested,
      storagePrimitiveRequested: input.storagePrimitiveRequested,
    });
    assert.equal(result.testFixtureTempRenameAdmitted, false, reasonCode);
    assert.deepEqual(result.fixtureTempRenameDecisions, [], reasonCode);
    assert.equal(result.blockedReasons.includes(reasonCode), true, reasonCode);
  }
});

test('hash mismatch leftover temp and rename mismatch block observed success', async () => {
  const { compileExactTextTestFixtureTempRenameObservationPlan, REASON_CODES } = await loadKernel();
  const fixtureTextWritePlanResult = await acceptedFixtureTextWritePlanResult();
  const cases = [
    [REASON_CODES.HASH_OBSERVATION_MISMATCH, {
      fixtureTempRenamePolicy: acceptedFixtureTempRenamePolicy({ expectedAfterHash: 'not-the-after-hash' }),
    }],
    [REASON_CODES.TEMP_RENAME_OBSERVATION_MISMATCH, { leftoverTempFileObserved: true }],
    [REASON_CODES.TEMP_RENAME_OBSERVATION_MISMATCH, { renameObservationMismatch: true }],
  ];

  for (const [reasonCode, input] of cases) {
    const result = compileExactTextTestFixtureTempRenameObservationPlan({
      fixtureTextWritePlanResult,
      fixtureTempRenamePolicy: input.fixtureTempRenamePolicy || acceptedFixtureTempRenamePolicy(),
      leftoverTempFileObserved: input.leftoverTempFileObserved,
      renameObservationMismatch: input.renameObservationMismatch,
    });
    assert.equal(result.testFixtureTempRenameAdmitted, false, reasonCode);
    assert.deepEqual(result.fixtureTempRenameDecisions, [], reasonCode);
    assert.equal(result.blockedReasons.includes(reasonCode), true, reasonCode);
  }
});

test('001K task record pins temp rename as observation only and not product atomicity', () => {
  const taskText = fs.readFileSync(path.join(process.cwd(), 'docs', 'tasks', TASK_BASENAME), 'utf8');
  const requiredFalseFlags = [
    'PRODUCT_WRITE_PERFORMED',
    'PRODUCT_WRITE_CLAIMED',
    'PRODUCT_ATOMICITY_CLAIMED',
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
    'STORAGE_PRIMITIVE_CHANGED',
  ];
  assert.match(taskText, /STATUS: IMPLEMENTED_LOCALLY_PENDING_DELIVERY_VERIFICATION/u);
  assert.match(taskText, /STOP_RULE: without owner approved PR target and merge target final status remains STOP_NOT_DONE/u);
  assert.match(taskText, /TEST_FIXTURE_TEMP_RENAME_OBSERVED: true/u);
  assert.match(taskText, /FIXTURE_TEMP_RENAME_OBSERVATION_NOT_PRODUCT_ATOMICITY: true/u);
  assert.match(taskText, /XPLAT_ATOMICITY_NOT_PROVEN: true/u);
  assert.match(taskText, /PRODUCT_ATOMIC_WRITE_NOT_PROVEN: true/u);
  assert.match(taskText, /TEMP_RENAME_NOT_RECOVERY: true/u);
  assert.match(taskText, /NO_ATOMIC_WRITE_FILE_IMPORT: true/u);
  for (const flag of requiredFalseFlags) {
    assert.match(taskText, new RegExp(`${flag}: false`, 'u'), flag);
    assert.doesNotMatch(taskText, new RegExp(`${flag}: true`, 'u'), flag);
  }
  assert.doesNotMatch(taskText, /product saved|public API exposed|DOCX runtime enabled|receipt persisted|backup executed|atomic write proven|product atomicity proven|xplat atomicity proven|crash recovery proven/iu);
});

test('001K change scope stays inside allowlist and outside product runtime surfaces', () => {
  const changedBasenames = changedBasenamesForCurrentContour();
  const allowlist = new Set([
    'reviewIrKernel.mjs',
    'exactTextApplyTestFixtureTextWrite.contract.test.js',
    'exactTextApplyTestFixtureTempRename.contract.test.js',
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
  assert.notDeepEqual(changedBasenames, [], '001K must have a detectable changed scope');
  for (const basename of changedBasenames) {
    assert.equal(allowlist.has(basename), true, `unexpected 001K changed basename: ${basename}`);
    assert.equal(denylist.has(basename), false, `denylisted 001K changed basename: ${basename}`);
  }
});

test('temp rename observation keeps production kernel pure and limits test mutation helpers', () => {
  const moduleText = fs.readFileSync(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME), 'utf8');
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
    /\bunlink\s*\(/u,
    /\bcreateWriteStream\s*\(/u,
  ];
  for (const pattern of forbiddenModulePatterns) {
    assert.equal(pattern.test(moduleText), false, `forbidden test fixture temp rename module pattern: ${pattern.source}`);
  }
  for (const pattern of forbiddenTestPatterns) {
    assert.equal(pattern.test(testText), false, `forbidden test fixture temp rename helper: ${pattern.source}`);
  }
  assert.equal(/\bmkdtempSync\s*\(/u.test(testText), true);
  assert.equal(/\bwriteFileSync\s*\(/u.test(testText), true);
  assert.equal(/\brenameSync\s*\(/u.test(testText), true);
  assert.equal(/\brmSync\s*\(/u.test(testText), true);
});
