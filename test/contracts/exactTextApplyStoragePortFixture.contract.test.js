const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'reviewIrKernel.mjs';
const TASK_BASENAME = 'EXACT_TEXT_APPLY_IN_MEMORY_STORAGE_PORT_FIXTURE_CONTRACT_001F.md';

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

function isCurrentContourFor(taskBasename, changedBasenames) {
  return changedBasenames.includes(taskBasename);
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

function acceptedPortCapabilities(overrides = {}) {
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

async function acceptedStorageAdapterCallPlanResult(overrides = {}) {
  const {
    buildReviewPatchSet,
    compileExactTextApplyOps,
    compileExactTextApplyEffectPreviews,
    compileExactTextWritePlanReceiptContract,
    compileExactTextStorageAdapterCallPlan,
  } = await loadKernel();
  const applyResult = compileExactTextApplyOps(
    buildReviewPatchSet(exactTextDecision(overrides.decision || {})),
    acceptedEnvironment(overrides.environment || {}),
  );
  const effectPreviewPlan = compileExactTextApplyEffectPreviews(applyResult);
  const writePlanReceiptResult = compileExactTextWritePlanReceiptContract({ applyResult, effectPreviewPlan });
  return compileExactTextStorageAdapterCallPlan({
    writePlanReceiptResult,
    storagePortCapabilities: acceptedPortCapabilities(overrides.storagePortCapabilities || {}),
  });
}

test('accepted storage adapter call plan produces one deterministic in-memory fixture result', async () => {
  const { compileExactTextInMemoryStoragePortFixture, canonicalHash } = await loadKernel();
  const storageAdapterCallPlanResult = await acceptedStorageAdapterCallPlanResult();
  const first = compileExactTextInMemoryStoragePortFixture({
    storageAdapterCallPlanResult,
    fixtureCapabilities: acceptedFixtureCapabilities(),
  });
  const second = compileExactTextInMemoryStoragePortFixture({
    storageAdapterCallPlanResult,
    fixtureCapabilities: acceptedFixtureCapabilities(),
  });

  assert.deepEqual(first, second);
  assert.equal(first.contractOnly, true);
  assert.equal(first.inMemoryOnly, true);
  assert.equal(first.filesystemWritePerformed, false);
  assert.equal(first.fsMutationPerformed, false);
  assert.equal(first.tempDirUsed, false);
  assert.equal(first.tempFixtureWritePerformed, false);
  assert.equal(first.productWritePerformed, false);
  assert.equal(first.productWriteClaimed, false);
  assert.equal(first.productStorageSafetyClaimed, false);
  assert.equal(first.durableReceiptClaimed, false);
  assert.equal(first.crashRecoveryClaimed, false);
  assert.equal(first.applyTxnClaimed, false);
  assert.equal(first.publicSurfaceClaimed, false);
  assert.equal(first.docxImportClaimed, false);
  assert.equal(first.releaseClaimed, false);
  assert.equal(first.storageImportsAdded, false);
  assert.equal(first.storagePrimitiveChanged, false);
  assert.deepEqual(first.blockedReasons, []);
  assert.equal(first.fixtureExecutions.length, 1);

  const callPlan = storageAdapterCallPlanResult.callPlans[0];
  const execution = first.fixtureExecutions[0];
  assert.deepEqual(Object.keys(execution).sort(), [
    'atomicWriteObservation',
    'backupObservation',
    'canonicalHash',
    'contractOnly',
    'filesystemWritePerformed',
    'fixtureExecutionId',
    'fixtureExecutionKind',
    'fixtureReceiptContract',
    'inMemoryOnly',
    'productWritePerformed',
    'recoverySnapshotObservation',
    'sourceCallPlanHash',
    'sourceCallPlanId',
    'sourceReceiptContractHash',
    'sourceReceiptContractId',
    'sourceWritePlanHash',
    'sourceWritePlanId',
    'tempFixtureWritePerformed',
  ].sort());
  assert.equal(execution.fixtureExecutionKind, 'EXACT_TEXT_IN_MEMORY_STORAGE_PORT_FIXTURE_EXECUTION');
  assert.equal(execution.sourceCallPlanId, callPlan.callPlanId);
  assert.equal(execution.sourceCallPlanHash, callPlan.canonicalHash);
  assert.equal(execution.sourceWritePlanHash, callPlan.sourceWritePlanHash);
  assert.equal(execution.sourceReceiptContractHash, callPlan.sourceReceiptContractHash);
  assert.equal(execution.backupObservation.executedIo, false);
  assert.equal(execution.atomicWriteObservation.executedIo, false);
  assert.equal(execution.recoverySnapshotObservation.executedIo, false);
  assert.equal(execution.fixtureReceiptContract.durableReceipt, false);
  assert.equal(execution.fixtureReceiptContract.executedIo, false);
  assert.equal(execution.fixtureReceiptContract.sourceCallPlanHash, callPlan.canonicalHash);
  assert.equal(execution.canonicalHash, canonicalHash({
    fixtureExecutionId: execution.fixtureExecutionId,
    fixtureExecutionKind: execution.fixtureExecutionKind,
    contractOnly: execution.contractOnly,
    inMemoryOnly: execution.inMemoryOnly,
    filesystemWritePerformed: execution.filesystemWritePerformed,
    tempFixtureWritePerformed: execution.tempFixtureWritePerformed,
    productWritePerformed: execution.productWritePerformed,
    sourceCallPlanId: execution.sourceCallPlanId,
    sourceCallPlanHash: execution.sourceCallPlanHash,
    sourceWritePlanId: execution.sourceWritePlanId,
    sourceWritePlanHash: execution.sourceWritePlanHash,
    sourceReceiptContractId: execution.sourceReceiptContractId,
    sourceReceiptContractHash: execution.sourceReceiptContractHash,
    backupObservation: execution.backupObservation,
    atomicWriteObservation: execution.atomicWriteObservation,
    recoverySnapshotObservation: execution.recoverySnapshotObservation,
    fixtureReceiptContract: execution.fixtureReceiptContract,
  }));
});

test('fixture result hash changes with call plan, write plan, and receipt contract hashes', async () => {
  const { compileExactTextInMemoryStoragePortFixture } = await loadKernel();
  const baseResult = await acceptedStorageAdapterCallPlanResult();
  const base = compileExactTextInMemoryStoragePortFixture({
    storageAdapterCallPlanResult: baseResult,
    fixtureCapabilities: acceptedFixtureCapabilities(),
  });
  const changedCallPlan = compileExactTextInMemoryStoragePortFixture({
    storageAdapterCallPlanResult: {
      ...baseResult,
      callPlans: [{ ...baseResult.callPlans[0], canonicalHash: 'changed-call-plan-hash' }],
    },
    fixtureCapabilities: acceptedFixtureCapabilities(),
  });
  const changedWritePlan = compileExactTextInMemoryStoragePortFixture({
    storageAdapterCallPlanResult: {
      ...baseResult,
      callPlans: [{ ...baseResult.callPlans[0], sourceWritePlanHash: 'changed-write-plan-hash' }],
    },
    fixtureCapabilities: acceptedFixtureCapabilities(),
  });
  const changedReceiptContract = compileExactTextInMemoryStoragePortFixture({
    storageAdapterCallPlanResult: {
      ...baseResult,
      callPlans: [{ ...baseResult.callPlans[0], sourceReceiptContractHash: 'changed-receipt-contract-hash' }],
    },
    fixtureCapabilities: acceptedFixtureCapabilities(),
  });

  assert.notEqual(base.canonicalHash, changedCallPlan.canonicalHash);
  assert.notEqual(base.canonicalHash, changedWritePlan.canonicalHash);
  assert.notEqual(base.canonicalHash, changedReceiptContract.canonicalHash);
});

test('blocked call plans and fixture capability failures produce zero fixture executions', async () => {
  const { compileExactTextInMemoryStoragePortFixture, REASON_CODES } = await loadKernel();
  const accepted = await acceptedStorageAdapterCallPlanResult();
  const blockedCallPlanResult = await acceptedStorageAdapterCallPlanResult({
    storagePortCapabilities: { canBackupBeforeWrite: false },
  });
  const cases = [
    [
      REASON_CODES.BACKUP_CAPABILITY_MISSING,
      { storageAdapterCallPlanResult: blockedCallPlanResult, fixtureCapabilities: acceptedFixtureCapabilities() },
    ],
    [
      REASON_CODES.BACKUP_CAPABILITY_MISSING,
      { storageAdapterCallPlanResult: accepted, fixtureCapabilities: acceptedFixtureCapabilities({ canObserveBackup: false }) },
    ],
    [
      REASON_CODES.ATOMIC_WRITE_CAPABILITY_MISSING,
      { storageAdapterCallPlanResult: accepted, fixtureCapabilities: acceptedFixtureCapabilities({ canObserveAtomicWrite: false }) },
    ],
    [
      REASON_CODES.RECOVERY_SNAPSHOT_CAPABILITY_MISSING,
      { storageAdapterCallPlanResult: accepted, fixtureCapabilities: acceptedFixtureCapabilities({ canObserveRecoverySnapshot: false }) },
    ],
    [
      REASON_CODES.PORT_FIXTURE_CAPABILITY_MISSING,
      { storageAdapterCallPlanResult: accepted, fixtureCapabilities: acceptedFixtureCapabilities({ canProduceFixtureReceiptContract: false }) },
    ],
    [
      REASON_CODES.NON_DETERMINISTIC_STORAGE_PORT,
      { storageAdapterCallPlanResult: accepted, fixtureCapabilities: acceptedFixtureCapabilities({ deterministicObservationIds: false }) },
    ],
    [
      REASON_CODES.FS_MUTATION_FORBIDDEN_IN_CONTOUR,
      { storageAdapterCallPlanResult: accepted, fixtureCapabilities: acceptedFixtureCapabilities(), realIoRequested: true },
    ],
    [
      REASON_CODES.FS_MUTATION_FORBIDDEN_IN_CONTOUR,
      { storageAdapterCallPlanResult: accepted, fixtureCapabilities: acceptedFixtureCapabilities(), fsMutationRequested: true },
    ],
    [
      REASON_CODES.FS_MUTATION_FORBIDDEN_IN_CONTOUR,
      { storageAdapterCallPlanResult: accepted, fixtureCapabilities: acceptedFixtureCapabilities(), tempDirRequested: true },
    ],
    [
      REASON_CODES.FS_MUTATION_FORBIDDEN_IN_CONTOUR,
      { storageAdapterCallPlanResult: accepted, fixtureCapabilities: acceptedFixtureCapabilities(), productWrite: true },
    ],
    [
      REASON_CODES.FS_MUTATION_FORBIDDEN_IN_CONTOUR,
      { storageAdapterCallPlanResult: accepted, fixtureCapabilities: acceptedFixtureCapabilities(), runtimeWritable: true },
    ],
    [
      REASON_CODES.FS_MUTATION_FORBIDDEN_IN_CONTOUR,
      { storageAdapterCallPlanResult: accepted, fixtureCapabilities: acceptedFixtureCapabilities({ realIoAvailable: true }) },
    ],
    [
      REASON_CODES.FS_MUTATION_FORBIDDEN_IN_CONTOUR,
      { storageAdapterCallPlanResult: accepted, fixtureCapabilities: acceptedFixtureCapabilities({ productPathAccess: true }) },
    ],
  ];

  for (const [reasonCode, input] of cases) {
    const result = compileExactTextInMemoryStoragePortFixture(input);
    assert.deepEqual(result.fixtureExecutions, [], reasonCode);
    assert.equal(result.filesystemWritePerformed, false, reasonCode);
    assert.equal(result.fsMutationPerformed, false, reasonCode);
    assert.equal(result.tempDirUsed, false, reasonCode);
    assert.equal(result.tempFixtureWritePerformed, false, reasonCode);
    assert.equal(result.productWritePerformed, false, reasonCode);
    assert.equal(result.storageImportsAdded, false, reasonCode);
    assert.equal(result.storagePrimitiveChanged, false, reasonCode);
    assert.equal(result.blockedReasons.includes(reasonCode), true, reasonCode);
  }
});

test('001F task record pins in-memory fixture false-green flags', () => {
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
    'PRODUCT_STORAGE_SAFETY_CLAIMED',
    'DURABLE_RECEIPT_CLAIMED',
    'CRASH_RECOVERY_CLAIMED',
    'APPLYTXN_CLAIMED',
    'PUBLIC_SURFACE_CLAIMED',
    'DOCX_IMPORT_CLAIMED',
    'RELEASE_CLAIMED',
    'STORAGE_IMPORTS_ADDED',
    'STORAGE_PRIMITIVE_CHANGED',
  ];

  assert.match(taskText, /STATUS: IMPLEMENTED_VERIFIED_CONTRACT_ONLY_IN_MEMORY_NO_FS_WRITE/u);
  assert.match(taskText, /CONTRACT_ONLY: true/u);
  assert.match(taskText, /IN_MEMORY_ONLY: true/u);
  for (const flag of requiredFalseFlags) {
    assert.match(taskText, new RegExp(`${flag}: false`, 'u'), flag);
    assert.doesNotMatch(taskText, new RegExp(`${flag}: true`, 'u'), flag);
  }
  assert.doesNotMatch(taskText, /persisted receipt|committed receipt|applied receipt|committed to disk|crash recovered|recovery executed|product saved|public API exposed/iu);
});

test('001F change scope stays inside allowlist and outside public or storage implementation files', () => {
  const changedBasenames = changedBasenamesForCurrentContour();
  if (!isCurrentContourFor(TASK_BASENAME, changedBasenames)) {
    assert.equal(changedBasenames.includes(TASK_BASENAME), false);
    return;
  }
  const allowlist = new Set([
    'reviewIrKernel.mjs',
    'exactTextApplyStorageAdapter.contract.test.js',
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

  assert.notDeepEqual(changedBasenames, [], '001F must have a detectable changed scope');
  for (const basename of changedBasenames) {
    assert.equal(allowlist.has(basename), true, `unexpected 001F changed basename: ${basename}`);
    assert.equal(denylist.has(basename), false, `denylisted 001F changed basename: ${basename}`);
  }
});

test('001F contract test does not introduce fixture write helpers', () => {
  const testText = fs.readFileSync(__filename, 'utf8');
  const forbidden = [
    /\bwriteFile(?:Atomic)?\s*\(/u,
    /\bappendFile\s*\(/u,
    /\bmkdir\s*\(/u,
    /\bmkdtemp\s*\(/u,
    /\brename\s*\(/u,
    /\bunlink\s*\(/u,
    /\brm\s*\(/u,
    /\bcreateWriteStream\s*\(/u,
  ];

  for (const pattern of forbidden) {
    assert.equal(pattern.test(testText), false, `forbidden fixture mutation helper call: ${pattern.source}`);
  }
});

test('in-memory storage port fixture adds no fs storage implementation public surface or nondeterminism', () => {
  const moduleText = fs.readFileSync(
    path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME),
    'utf8',
  );
  const forbidden = [
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

  for (const pattern of forbidden) {
    assert.equal(pattern.test(moduleText), false, `forbidden in-memory fixture pattern: ${pattern.source}`);
  }
});
