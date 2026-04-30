const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'reviewIrKernel.mjs';
const TASK_BASENAME = 'EXACT_TEXT_APPLY_STORAGE_ADAPTER_CONTRACT_001E.md';

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

function acceptedCapabilities(overrides = {}) {
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

async function acceptedWritePlanReceiptResult(overrides = {}) {
  const {
    buildReviewPatchSet,
    compileExactTextApplyOps,
    compileExactTextApplyEffectPreviews,
    compileExactTextWritePlanReceiptContract,
  } = await loadKernel();
  const applyResult = compileExactTextApplyOps(
    buildReviewPatchSet(exactTextDecision(overrides.decision || {})),
    acceptedEnvironment(overrides.environment || {}),
  );
  const effectPreviewPlan = compileExactTextApplyEffectPreviews(applyResult);
  return compileExactTextWritePlanReceiptContract({ applyResult, effectPreviewPlan });
}

test('accepted write plan receipt contract compiles one deterministic storage adapter call plan', async () => {
  const { compileExactTextStorageAdapterCallPlan, canonicalHash } = await loadKernel();
  const writePlanReceiptResult = await acceptedWritePlanReceiptResult();
  const first = compileExactTextStorageAdapterCallPlan({
    writePlanReceiptResult,
    storagePortCapabilities: acceptedCapabilities(),
  });
  const second = compileExactTextStorageAdapterCallPlan({
    writePlanReceiptResult,
    storagePortCapabilities: acceptedCapabilities(),
  });

  assert.deepEqual(first, second);
  assert.equal(first.contractOnly, true);
  assert.equal(first.fsMutationPerformed, false);
  assert.equal(first.tempFixtureWritePerformed, false);
  assert.equal(first.productWriteClaimed, false);
  assert.equal(first.productManuscriptMutationClaimed, false);
  assert.equal(first.durableReceiptClaimed, false);
  assert.equal(first.productStorageSafetyClaimed, false);
  assert.equal(first.crashRecoveryClaimed, false);
  assert.equal(first.applyTxnClaimed, false);
  assert.equal(first.publicSurfaceClaimed, false);
  assert.equal(first.docxImportClaimed, false);
  assert.equal(first.releaseClaimed, false);
  assert.equal(first.storagePrimitiveChanged, false);
  assert.deepEqual(first.blockedReasons, []);
  assert.equal(first.callPlans.length, 1);

  const writePlan = writePlanReceiptResult.writePlans[0];
  const receiptContract = writePlanReceiptResult.receiptContracts[0];
  const callPlan = first.callPlans[0];
  assert.deepEqual(Object.keys(callPlan).sort(), [
    'atomicWriteObservationRequest',
    'backupObservationRequest',
    'blockedReasons',
    'callPlanId',
    'callPlanKind',
    'canonicalHash',
    'capabilitySnapshot',
    'contractOnly',
    'fsMutationPerformed',
    'productWriteClaimed',
    'recoverySnapshotObservationRequest',
    'requiredCapabilities',
    'sourceReceiptContractHash',
    'sourceReceiptContractId',
    'sourceWritePlanHash',
    'sourceWritePlanId',
  ].sort());
  assert.equal(callPlan.callPlanKind, 'EXACT_TEXT_STORAGE_ADAPTER_CALL_PLAN_CONTRACT');
  assert.equal(callPlan.contractOnly, true);
  assert.equal(callPlan.fsMutationPerformed, false);
  assert.equal(callPlan.productWriteClaimed, false);
  assert.equal(callPlan.sourceWritePlanId, writePlan.writePlanId);
  assert.equal(callPlan.sourceWritePlanHash, writePlan.canonicalHash);
  assert.equal(callPlan.sourceReceiptContractId, receiptContract.receiptContractId);
  assert.equal(callPlan.sourceReceiptContractHash, receiptContract.canonicalHash);
  assert.deepEqual(callPlan.requiredCapabilities, [
    'CAN_BACKUP_BEFORE_WRITE',
    'CAN_ATOMIC_WRITE_SCENE_TEXT',
    'CAN_CREATE_READABLE_RECOVERY_SNAPSHOT',
    'CAN_REPORT_BEFORE_HASH',
    'CAN_REPORT_AFTER_HASH',
    'DETERMINISTIC_OBSERVATION_IDS',
    'NO_PRODUCT_PATH_ACCESS_IN_THIS_CONTOUR',
  ]);
  assert.equal(callPlan.backupObservationRequest.executedIo, false);
  assert.equal(callPlan.atomicWriteObservationRequest.executedIo, false);
  assert.equal(callPlan.recoverySnapshotObservationRequest.executedIo, false);
  assert.equal(callPlan.backupObservationRequest.sourceWritePlanHash, writePlan.canonicalHash);
  assert.equal(callPlan.atomicWriteObservationRequest.sourceReceiptContractHash, receiptContract.canonicalHash);
  assert.equal(callPlan.recoverySnapshotObservationRequest.afterHashExpected, writePlan.afterHashExpected);
  assert.equal(callPlan.canonicalHash, canonicalHash({
    callPlanId: callPlan.callPlanId,
    callPlanKind: callPlan.callPlanKind,
    contractOnly: callPlan.contractOnly,
    fsMutationPerformed: callPlan.fsMutationPerformed,
    productWriteClaimed: callPlan.productWriteClaimed,
    sourceWritePlanId: callPlan.sourceWritePlanId,
    sourceWritePlanHash: callPlan.sourceWritePlanHash,
    sourceReceiptContractId: callPlan.sourceReceiptContractId,
    sourceReceiptContractHash: callPlan.sourceReceiptContractHash,
    requiredCapabilities: callPlan.requiredCapabilities,
    capabilitySnapshot: callPlan.capabilitySnapshot,
    backupObservationRequest: callPlan.backupObservationRequest,
    atomicWriteObservationRequest: callPlan.atomicWriteObservationRequest,
    recoverySnapshotObservationRequest: callPlan.recoverySnapshotObservationRequest,
    blockedReasons: callPlan.blockedReasons,
  }));
});

test('storage adapter call plan hash changes with write plan and receipt hashes', async () => {
  const { compileExactTextStorageAdapterCallPlan } = await loadKernel();
  const baseResult = await acceptedWritePlanReceiptResult();
  const base = compileExactTextStorageAdapterCallPlan({
    writePlanReceiptResult: baseResult,
    storagePortCapabilities: acceptedCapabilities(),
  });
  const changedWritePlan = compileExactTextStorageAdapterCallPlan({
    writePlanReceiptResult: {
      ...baseResult,
      writePlans: [{ ...baseResult.writePlans[0], canonicalHash: 'changed-write-plan-hash' }],
    },
    storagePortCapabilities: acceptedCapabilities(),
  });
  const changedReceipt = compileExactTextStorageAdapterCallPlan({
    writePlanReceiptResult: {
      ...baseResult,
      receiptContracts: [{ ...baseResult.receiptContracts[0], canonicalHash: 'changed-receipt-hash' }],
    },
    storagePortCapabilities: acceptedCapabilities(),
  });

  assert.notEqual(base.canonicalHash, changedWritePlan.canonicalHash);
  assert.notEqual(base.canonicalHash, changedReceipt.canonicalHash);
});

test('missing storage port capabilities block call plan compilation', async () => {
  const { compileExactTextStorageAdapterCallPlan, REASON_CODES } = await loadKernel();
  const writePlanReceiptResult = await acceptedWritePlanReceiptResult();
  const cases = [
    [
      REASON_CODES.BACKUP_CAPABILITY_MISSING,
      acceptedCapabilities({ canBackupBeforeWrite: false }),
    ],
    [
      REASON_CODES.ATOMIC_WRITE_CAPABILITY_MISSING,
      acceptedCapabilities({ canAtomicWriteSceneText: false }),
    ],
    [
      REASON_CODES.RECOVERY_SNAPSHOT_CAPABILITY_MISSING,
      acceptedCapabilities({ canCreateReadableRecoverySnapshot: false }),
    ],
    [
      REASON_CODES.NON_DETERMINISTIC_STORAGE_PORT,
      acceptedCapabilities({ deterministicObservationIds: false }),
    ],
    [
      REASON_CODES.FS_MUTATION_FORBIDDEN_IN_CONTOUR,
      acceptedCapabilities({ productPathAccess: true }),
    ],
  ];

  for (const [reasonCode, storagePortCapabilities] of cases) {
    const result = compileExactTextStorageAdapterCallPlan({
      writePlanReceiptResult,
      storagePortCapabilities,
    });
    assert.deepEqual(result.callPlans, [], reasonCode);
    assert.equal(result.fsMutationPerformed, false, reasonCode);
    assert.equal(result.tempFixtureWritePerformed, false, reasonCode);
    assert.equal(result.productWriteClaimed, false, reasonCode);
    assert.equal(result.productStorageSafetyClaimed, false, reasonCode);
    assert.equal(result.blockedReasons.includes(reasonCode), true, reasonCode);
  }
});

test('fs mutation request and invalid write plan receipt input are blocked', async () => {
  const { compileExactTextStorageAdapterCallPlan, REASON_CODES } = await loadKernel();
  const writePlanReceiptResult = await acceptedWritePlanReceiptResult();
  const cases = [
    [
      REASON_CODES.FS_MUTATION_FORBIDDEN_IN_CONTOUR,
      { writePlanReceiptResult, storagePortCapabilities: acceptedCapabilities(), fsMutationRequested: true },
    ],
    [
      REASON_CODES.FS_MUTATION_FORBIDDEN_IN_CONTOUR,
      { writePlanReceiptResult, storagePortCapabilities: acceptedCapabilities(), productWrite: true },
    ],
    [
      REASON_CODES.NON_CONTRACT_APPLYOP_FORBIDDEN,
      {
        writePlanReceiptResult: { ...writePlanReceiptResult, contractOnly: false },
        storagePortCapabilities: acceptedCapabilities(),
      },
    ],
    [
      REASON_CODES.EFFECT_PRECONDITION_MISSING,
      {
        writePlanReceiptResult: { ...writePlanReceiptResult, writePlans: [] },
        storagePortCapabilities: acceptedCapabilities(),
      },
    ],
  ];

  for (const [reasonCode, input] of cases) {
    const result = compileExactTextStorageAdapterCallPlan(input);
    assert.deepEqual(result.callPlans, [], reasonCode);
    assert.equal(result.blockedReasons.includes(reasonCode), true, reasonCode);
    assert.equal(result.fsMutationPerformed, false, reasonCode);
    assert.equal(result.storagePrimitiveChanged, false, reasonCode);
    assert.equal(result.publicSurfaceClaimed, false, reasonCode);
    assert.equal(result.docxImportClaimed, false, reasonCode);
    assert.equal(result.releaseClaimed, false, reasonCode);
  }
});

test('001E task record pins storage adapter false-green flags', () => {
  const taskText = fs.readFileSync(
    path.join(process.cwd(), 'docs', 'tasks', TASK_BASENAME),
    'utf8',
  );
  const requiredFalseFlags = [
    'FS_MUTATION_PERFORMED',
    'TEMP_FIXTURE_WRITE_PERFORMED',
    'PRODUCT_WRITE_PERFORMED',
    'PRODUCT_WRITE_CLAIMED',
    'PRODUCT_MANUSCRIPT_MUTATION_CLAIMED',
    'STORAGE_IMPORTS_ADDED',
    'DURABLE_RECEIPT_CLAIMED',
    'PRODUCT_STORAGE_SAFETY_CLAIMED',
    'CRASH_RECOVERY_CLAIMED',
    'APPLYTXN_CLAIMED',
    'PUBLIC_SURFACE_CLAIMED',
    'DOCX_IMPORT_CLAIMED',
    'RELEASE_CLAIMED',
    'STORAGE_PRIMITIVE_CHANGED',
  ];

  assert.match(taskText, /STATUS: IMPLEMENTED_VERIFIED_CONTRACT_ONLY_NO_FS_WRITE/u);
  assert.match(taskText, /CONTRACT_ONLY: true/u);
  assert.match(taskText, /STORAGE_PRIMITIVE_POLICY: NO_IMPORTS_NO_EDITS_NO_FS_MUTATION/u);
  for (const flag of requiredFalseFlags) {
    assert.match(taskText, new RegExp(`${flag}: false`, 'u'), flag);
    assert.doesNotMatch(taskText, new RegExp(`${flag}: true`, 'u'), flag);
  }
});

test('001E change scope stays inside allowlist and outside public or storage implementation files', () => {
  const changedBasenames = changedBasenamesForCurrentContour();
  const allowlist = new Set([
    'reviewIrKernel.mjs',
    'exactTextApplyStorageAdapter.contract.test.js',
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

  assert.notDeepEqual(changedBasenames, [], '001E must have a detectable changed scope');
  for (const basename of changedBasenames) {
    assert.equal(allowlist.has(basename), true, `unexpected 001E changed basename: ${basename}`);
    assert.equal(denylist.has(basename), false, `denylisted 001E changed basename: ${basename}`);
  }
});

test('001E contract test does not introduce fixture write helpers', () => {
  const testText = fs.readFileSync(__filename, 'utf8');
  const forbidden = [
    /\bwriteFile(?:Atomic)?\b/u,
    /\bappendFile\b/u,
    /\bmkdir\b/u,
    /\bmkdtemp\b/u,
    /\brename\b/u,
    /\bunlink\b/u,
    /\brm\s*\(/u,
    /\bcreateWriteStream\b/u,
  ];

  for (const pattern of forbidden) {
    assert.equal(pattern.test(testText), false, `forbidden fixture mutation helper: ${pattern.source}`);
  }
});

test('storage adapter contract adds no fs storage implementation public surface or nondeterminism', () => {
  const moduleText = fs.readFileSync(
    path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME),
    'utf8',
  );
  const forbidden = [
    /from\s+['"]node:fs(?:\/promises)?['"]/u,
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
    assert.equal(pattern.test(moduleText), false, `forbidden storage adapter pattern: ${pattern.source}`);
  }
});
