const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'exactTextApplyWithReceiptCloseout.mjs';
const TASK_BASENAME = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_001X.md';
const KERNEL_BASENAME = 'reviewIrKernel.mjs';

async function loadModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

async function loadKernel() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', KERNEL_BASENAME)).href);
}

function sourceText(...segments) {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');
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

function withoutHash(value, hashKey = 'canonicalHash') {
  const { [hashKey]: _hash, ...rest } = value;
  return rest;
}

function withCanonicalHash(canonicalHash, value) {
  return {
    ...value,
    canonicalHash: canonicalHash(value),
  };
}

function withReceiptHash(canonicalHash, value) {
  return {
    ...value,
    receiptCanonicalHash: canonicalHash(value),
  };
}

function accepted001WResult(canonicalHash, resultOverrides = {}, receiptOverrides = {}, decisionOverrides = {}) {
  const decision = withCanonicalHash(canonicalHash, {
    decisionKind: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_DECISION_001W',
    outputDecision: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTED_NO_PUBLIC_RUNTIME',
    nextContourAfterPass: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_001X',
    privatePortExecutionOnly: true,
    privateExactTextApplyWithReceiptExecuted: true,
    exactTextOnly: true,
    singleSceneOnly: true,
    productApplyRuntimeAdmitted: false,
    publicRuntimeAdmitted: false,
    applyTxnImplemented: false,
    recoveryClaimed: false,
    userProjectMutated: false,
    ...decisionOverrides,
  });
  const receipt = withReceiptHash(canonicalHash, {
    receiptKind: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_V1_001W',
    receiptVersion: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_SCHEMA_V1',
    contourId: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_001W',
    projectId: 'project-alpha',
    sceneId: 'scene-alpha',
    sceneFileBasename: 'scene-alpha.json',
    operationKind: 'EXACT_TEXT_REPLACE',
    exactTextOnly: true,
    singleSceneOnly: true,
    source001VResultHash: canonicalHash({ source: '001v-result' }),
    source001VDecisionHash: canonicalHash({ source: '001v-decision' }),
    source001UResultHash: canonicalHash({ source: '001u-result' }),
    source001UDecisionHash: canonicalHash({ source: '001u-decision' }),
    source001UReceiptHash: canonicalHash({ source: '001u-receipt' }),
    beforeSceneHash: canonicalHash({ scene: 'before' }),
    afterSceneHash: canonicalHash({ scene: 'after' }),
    blockVersionHash: canonicalHash({ block: 'version' }),
    backupObservationHash: canonicalHash({ backup: 'observed' }),
    atomicWriteObservationHash: canonicalHash({ write: 'observed' }),
    receiptIsNotRecovery: true,
    receiptReadbackIsNotStartupRecovery: true,
    atomicSingleFileWriteIsNotApplyTxn: true,
    multiFileConsistencyNotClaimed: true,
    backupSubsystemNotReproven: true,
    productApplyRuntimeAdmittedFalse: true,
    publicRuntimeAdmittedFalse: true,
    applyTxnImplementedFalse: true,
    recoveryClaimedFalse: true,
    userProjectMutatedFalse: true,
    receiptWrittenAt: '2026-04-30T00:00:00.000Z',
    ...receiptOverrides,
  });
  return withCanonicalHash(canonicalHash, {
    resultKind: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_RESULT_001W',
    contourId: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_001W',
    privatePortExecutionOnly: true,
    privateInternalOnly: true,
    exactTextOnly: true,
    singleSceneOnly: true,
    receiptIsNotRecovery: true,
    receiptReadbackIsNotStartupRecovery: true,
    atomicSingleFileWriteIsNotApplyTxn: true,
    multiFileConsistencyNotClaimed: true,
    backupSubsystemNotReproven: true,
    productApplyRuntimeAdmitted: false,
    publicRuntimeAdmitted: false,
    publicSurfaceClaimed: false,
    ipcSurfaceClaimed: false,
    preloadExportClaimed: false,
    menuSurfaceClaimed: false,
    commandSurfaceClaimed: false,
    uiChanged: false,
    docxImportClaimed: false,
    applyTxnImplemented: false,
    recoveryClaimed: false,
    startupRecoveryClaimed: false,
    releaseClaimed: false,
    multiSceneApplyClaimed: false,
    structuralApplyClaimed: false,
    commentApplyClaimed: false,
    networkUsed: false,
    dependencyChanged: false,
    userProjectMutated: false,
    realUserProjectPathTouched: false,
    outputDecision: decision.outputDecision,
    nextContourAfterPass: decision.nextContourAfterPass,
    privateExactTextApplyWithReceiptExecuted: true,
    receiptWritten: true,
    receiptReadbackVerified: true,
    backupAttempted: true,
    sceneWriteAttempted: true,
    receiptWriteAttempted: true,
    source001VResultHash: receipt.source001VResultHash,
    source001VDecisionHash: receipt.source001VDecisionHash,
    beforeSceneHash: receipt.beforeSceneHash,
    afterSceneHash: receipt.afterSceneHash,
    backupObservationHash: receipt.backupObservationHash,
    atomicWriteObservationHash: receipt.atomicWriteObservationHash,
    receiptCanonicalHash: receipt.receiptCanonicalHash,
    blockedReasons: [],
    decisions: [decision],
    receipt,
    ...resultOverrides,
  });
}

async function acceptedInput(patch = {}) {
  const { canonicalHash } = await loadKernel();
  const source001WResult = accepted001WResult(canonicalHash);
  return {
    source001WResult,
    source001WResultHash: source001WResult.canonicalHash,
    source001WDecisionHash: source001WResult.decisions[0].canonicalHash,
    source001WReceiptHash: source001WResult.receipt.receiptCanonicalHash,
    ...patch,
  };
}

test('001X accepts only a verified 001W execution result and does not open 001Y', async () => {
  const { runExactTextApplyWithReceiptCloseout } = await loadModule();
  const input = await acceptedInput();
  const result = runExactTextApplyWithReceiptCloseout(input);

  assert.equal(result.resultKind, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_RESULT_001X');
  assert.equal(result.outputDecision, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_001W_CLOSEOUT_ACCEPTED');
  assert.equal(result.source001WAccepted, true);
  assert.equal(result.nextContourRecommendation, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_001Y');
  assert.equal(result.ownerMayOpen001Y, false);
  assert.equal(result.closeoutOnly, true);
  assert.equal(result.noAdmissionIn001X, true);
  assert.equal(result.noExecutionIn001X, true);
  assert.equal(result.source001WResultHash, input.source001WResultHash);
  assert.equal(result.source001WDecisionHash, input.source001WDecisionHash);
  assert.equal(result.source001WReceiptHash, input.source001WReceiptHash);
  assert.equal(result.source001WReceiptVerified, true);
  assert.deepEqual(result.blockedReasons, []);
  assert.equal(result.decisions[0].decisionKind, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_DECISION_001X');
  assert.equal(result.decisions[0].ownerMayOpen001Y, false);
  assert.equal(result.canonicalHash, (await loadKernel()).canonicalHash(withoutHash(result)));
});

test('001X blocks missing mismatched blocked or receiptless 001W source', async () => {
  const { runExactTextApplyWithReceiptCloseout, EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const accepted = await acceptedInput();
  const cases = [
    {
      patch: { source001WResult: null },
      code: EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.SOURCE_001W_RESULT_REQUIRED,
    },
    {
      patch: { source001WResultHash: canonicalHash({ wrong: 'result' }) },
      code: EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.SOURCE_001W_RESULT_MISMATCH,
    },
    {
      patch: { source001WDecisionHash: canonicalHash({ wrong: 'decision' }) },
      code: EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.SOURCE_001W_DECISION_MISMATCH,
    },
    {
      patch: { source001WReceiptHash: canonicalHash({ wrong: 'receipt' }) },
      code: EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.SOURCE_001W_RECEIPT_MISMATCH,
    },
    {
      patch: { source001WResult: accepted001WResult(canonicalHash, { outputDecision: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_BLOCKED', blockedReasons: ['STALE_BASELINE'] }) },
      code: EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.SOURCE_001W_BLOCKED,
    },
    {
      patch: { source001WResult: accepted001WResult(canonicalHash, { receipt: null }) },
      code: EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.SOURCE_001W_RECEIPT_REQUIRED,
    },
  ];

  for (const item of cases) {
    const result = runExactTextApplyWithReceiptCloseout({ ...accepted, ...item.patch });
    assert.equal(result.outputDecision, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_001W_CLOSEOUT_BLOCKED');
    assert.equal(result.blockedReasons.includes(item.code), true, item.code);
  }
});

test('001X blocks malformed 001W decision and receipt hash chain gaps', async () => {
  const { runExactTextApplyWithReceiptCloseout, EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const base = await acceptedInput();
  const sourceWithTwoDecisions = accepted001WResult(canonicalHash);
  sourceWithTwoDecisions.decisions = [sourceWithTwoDecisions.decisions[0], sourceWithTwoDecisions.decisions[0]];
  sourceWithTwoDecisions.canonicalHash = canonicalHash(withoutHash(sourceWithTwoDecisions));
  const staleReceiptHashSource = accepted001WResult(canonicalHash);
  staleReceiptHashSource.receipt.projectId = 'tampered-project';
  staleReceiptHashSource.canonicalHash = canonicalHash(withoutHash(staleReceiptHashSource));
  const cases = [
    {
      source: accepted001WResult(canonicalHash, {}, {}, { decisionKind: 'WRONG_DECISION' }),
      code: EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.SOURCE_001W_DECISION_MALFORMED,
    },
    {
      source: sourceWithTwoDecisions,
      code: EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.SOURCE_001W_DECISION_MALFORMED,
    },
    {
      source: accepted001WResult(canonicalHash, {}, { receiptKind: 'WRONG_RECEIPT' }),
      code: EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.SOURCE_001W_RECEIPT_MALFORMED,
    },
    {
      source: staleReceiptHashSource,
      code: EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.SOURCE_001W_RECEIPT_MISMATCH,
    },
    {
      source: accepted001WResult(canonicalHash, {}, { source001VResultHash: '' }),
      code: EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.SOURCE_HASH_CHAIN_MISSING,
    },
    {
      source: accepted001WResult(canonicalHash, {}, { source001UReceiptHash: '' }),
      code: EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.SOURCE_HASH_CHAIN_MISSING,
    },
    {
      source: accepted001WResult(canonicalHash, {}, { receiptIsNotRecovery: false }),
      code: EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.SOURCE_001W_RECEIPT_MALFORMED,
    },
    {
      source: accepted001WResult(canonicalHash, {}, { publicRuntimeAdmittedFalse: false }),
      code: EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES.SOURCE_001W_RECEIPT_MALFORMED,
    },
  ];

  for (const item of cases) {
    const result = runExactTextApplyWithReceiptCloseout({
      ...base,
      source001WResult: item.source,
      source001WResultHash: item.source.canonicalHash,
      source001WDecisionHash: item.source.decisions[0].canonicalHash,
      source001WReceiptHash: item.source.receipt.receiptCanonicalHash,
    });
    assert.equal(result.blockedReasons.includes(item.code), true, item.code);
  }
});

test('001X blocks source runtime contamination and boundary loss', async () => {
  const { runExactTextApplyWithReceiptCloseout, EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const base = await acceptedInput();
  const cases = [
    { patch: { publicRuntimeAdmitted: true }, code: 'SOURCE_001W_RUNTIME_FLAG_FORBIDDEN' },
    { patch: { publicSurfaceClaimed: true }, code: 'SOURCE_001W_RUNTIME_FLAG_FORBIDDEN' },
    { patch: { commandSurfaceClaimed: true }, code: 'SOURCE_001W_RUNTIME_FLAG_FORBIDDEN' },
    { patch: { uiChanged: true }, code: 'SOURCE_001W_RUNTIME_FLAG_FORBIDDEN' },
    { patch: { docxImportClaimed: true }, code: 'SOURCE_001W_RUNTIME_FLAG_FORBIDDEN' },
    { patch: { networkUsed: true }, code: 'SOURCE_001W_RUNTIME_FLAG_FORBIDDEN' },
    { patch: { applyTxnImplemented: true }, code: 'SOURCE_001W_RUNTIME_FLAG_FORBIDDEN' },
    { patch: { recoveryClaimed: true }, code: 'SOURCE_001W_RUNTIME_FLAG_FORBIDDEN' },
    { patch: { userProjectMutated: true }, code: 'SOURCE_001W_RUNTIME_FLAG_FORBIDDEN' },
    { patch: { realUserProjectPathTouched: true }, code: 'SOURCE_001W_RUNTIME_FLAG_FORBIDDEN' },
    { patch: { receiptIsNotRecovery: false }, code: 'SOURCE_001W_BOUNDARY_MISSING' },
    { patch: { atomicSingleFileWriteIsNotApplyTxn: false }, code: 'SOURCE_001W_BOUNDARY_MISSING' },
    { patch: { privatePortExecutionOnly: false }, code: 'SOURCE_001W_BOUNDARY_MISSING' },
  ];

  for (const item of cases) {
    const source = accepted001WResult(canonicalHash, item.patch);
    const result = runExactTextApplyWithReceiptCloseout({
      ...base,
      source001WResult: source,
      source001WResultHash: source.canonicalHash,
      source001WDecisionHash: source.decisions[0].canonicalHash,
      source001WReceiptHash: source.receipt.receiptCanonicalHash,
    });
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES[item.code]), true, item.code);
  }
});

test('001X blocks attempts to open admission execute runtime UI DOCX network ApplyTxn or recovery', async () => {
  const { runExactTextApplyWithReceiptCloseout, EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES } = await loadModule();
  const base = await acceptedInput();
  const cases = [
    { patch: { ownerMayOpen001Y: true }, code: 'NEXT_ADMISSION_FORBIDDEN' },
    { patch: { nextAdmissionRequested: true }, code: 'NEXT_ADMISSION_FORBIDDEN' },
    { patch: { openNextContourRequested: true }, code: 'NEXT_ADMISSION_FORBIDDEN' },
    { patch: { ownerPacket: { ownerMayOpen001Y: true } }, code: 'NEXT_ADMISSION_FORBIDDEN' },
    { patch: { applyExecutionRequested: true }, code: 'APPLY_EXECUTION_FORBIDDEN' },
    { patch: { newExecutionRequested: true }, code: 'APPLY_EXECUTION_FORBIDDEN' },
    { patch: { ownerPacket: { newExecutionRequested: true } }, code: 'APPLY_EXECUTION_FORBIDDEN' },
    { patch: { ownerPacket: { privateExactTextApplyWithReceiptExecuted: true } }, code: 'APPLY_EXECUTION_FORBIDDEN' },
    { patch: { productApplyRuntimeAdmitted: true }, code: 'PRODUCT_RUNTIME_FORBIDDEN' },
    { patch: { publicRuntimeAdmitted: true }, code: 'PRODUCT_RUNTIME_FORBIDDEN' },
    { patch: { ownerPacket: { productApplyRuntimeAdmitted: true } }, code: 'PRODUCT_RUNTIME_FORBIDDEN' },
    { patch: { ownerPacket: { publicRuntimeAdmitted: true } }, code: 'PRODUCT_RUNTIME_FORBIDDEN' },
    { patch: { publicSurfaceClaimed: true }, code: 'PUBLIC_COMMAND_SURFACE_FORBIDDEN' },
    { patch: { ipcSurfaceClaimed: true }, code: 'PUBLIC_COMMAND_SURFACE_FORBIDDEN' },
    { patch: { commandSurfaceClaimed: true }, code: 'PUBLIC_COMMAND_SURFACE_FORBIDDEN' },
    { patch: { ownerPacket: { commandSurfaceClaimed: true } }, code: 'PUBLIC_COMMAND_SURFACE_FORBIDDEN' },
    { patch: { uiChanged: true }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { docxImportClaimed: true }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { networkUsed: true }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { dependencyChanged: true }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { ownerPacket: { networkUsed: true } }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { applyTxnImplemented: true }, code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { patch: { recoveryClaimed: true }, code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { patch: { startupRecoveryClaimed: true }, code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { patch: { releaseClaimed: true }, code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { patch: { ownerPacket: { recoveryClaimed: true } }, code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { patch: { userProjectMutated: true }, code: 'USER_PROJECT_MUTATION_FORBIDDEN' },
    { patch: { realUserProjectPathTouched: true }, code: 'USER_PROJECT_MUTATION_FORBIDDEN' },
    { patch: { ownerPacket: { userProjectMutated: true } }, code: 'USER_PROJECT_MUTATION_FORBIDDEN' },
  ];

  for (const item of cases) {
    const result = runExactTextApplyWithReceiptCloseout({ ...base, ...item.patch });
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_REASON_CODES[item.code]), true, item.code);
  }
});

test('001X task record preserves closeout only boundary', () => {
  const taskText = sourceText('docs', 'tasks', TASK_BASENAME);
  assert.match(taskText, /TASK_ID: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_001X/u);
  assert.match(taskText, /CONTOUR_TYPE: CLOSEOUT_ONLY/u);
  assert.match(taskText, /PREVIOUS_CONTOUR: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_001W/u);
  assert.match(taskText, /NEXT_CONTOUR_RECOMMENDATION_ONLY: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_001Y/u);
  assert.match(taskText, /OWNER_MAY_OPEN_001Y: false/u);
  assert.match(taskText, /NO_ADMISSION_IN_001X: true/u);
  assert.match(taskText, /NO_EXECUTION_IN_001X: true/u);
  assert.match(taskText, /PUBLIC_RUNTIME_ADMITTED: false/u);
  assert.match(taskText, /APPLYTXN_IMPLEMENTED: false/u);
  assert.match(taskText, /RECOVERY_CLAIMED: false/u);
  assert.match(taskText, /COMMIT_SHA: pending/u);
  assert.doesNotMatch(taskText, /release green|public apply|DOCX runtime|ApplyTxn implemented|recovery proven/iu);
});

test('001X changed scope stays allowlisted and closeout module stays pure', () => {
  const changedBasenames = changedBasenamesForCurrentContour();
  const allowlist = new Set([
    MODULE_BASENAME,
    'exactTextApplyWithReceiptNextAdmission.mjs',
    'exactTextApplyWithReceiptNextContourAdmission.mjs',
    'exactTextApplyWithReceiptPrivateContractBrief.mjs',
    'exactTextApplyWithReceiptPrivateContractShape.mjs',
    'exactTextApplyWithReceiptCloseout.contract.test.js',
    'exactTextApplyWithReceiptNextAdmission.contract.test.js',
    'exactTextApplyWithReceiptNextContourAdmission.contract.test.js',
    'exactTextApplyWithReceiptPrivateContractBrief.contract.test.js',
    'exactTextApplyWithReceiptPrivateContractShape.contract.test.js',
    TASK_BASENAME,
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_ADMISSION_001Y.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_001Z.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_002A.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_002B.md',
    'revision-bridge-pre-stage-00-admission-guard-state.mjs',
    'exactTextApplyWithReceiptExecution.contract.test.js',
    'exactTextApplyWithReceiptAdmission.contract.test.js',
    'exactTextApplyPrivateProductApplyReceipt.contract.test.js',
    'exactTextApplyPrivateProductApplyReceiptAdmission.contract.test.js',
    'exactTextApplyFixtureDurableReceiptPrototype.contract.test.js',
    'exactTextApplyInternalWritePrototype.contract.test.js',
    'exactTextApplyProductApplyAdmissionGate.contract.test.js',
    'exactTextApplyProductApplyReadinessReview.contract.test.js',
    'exactTextApplyProductStoragePrimitiveEvidence.contract.test.js',
    'exactTextApplyTestFixtureReceiptFile.contract.test.js',
    'exactTextApplyTestOnlyProductShapedStorageDryRun.contract.test.js',
    'exactTextApplyTestOnlyStoragePrimitiveExecutionHarness.contract.test.js',
  ]);
  const denylist = new Set([
    'main.js',
    'preload.js',
    'editor.js',
    'index.html',
    'styles.css',
    'package.json',
    'package-lock.json',
    'fileManager.js',
    'backupManager.js',
    'command-catalog.v1.mjs',
    'projectCommands.mjs',
    'hostilePackageGate.mjs',
  ]);
  assert.notDeepEqual(changedBasenames, [], '001X must have detectable changed scope');
  for (const basename of changedBasenames) {
    assert.equal(allowlist.has(basename), true, `unexpected 001X changed basename: ${basename}`);
    assert.equal(denylist.has(basename), false, `denylisted 001X changed basename: ${basename}`);
  }

  const moduleText = sourceText('src', 'revisionBridge', MODULE_BASENAME);
  const forbiddenPatterns = [
    /from\s+['"]node:fs/u,
    /from\s+['"]node:path/u,
    /from\s+['"]node:os/u,
    /from\s+['"][^'"]*backupManager[^'"]*['"]/u,
    /from\s+['"][^'"]*fileManager[^'"]*['"]/u,
    /from\s+['"]electron['"]/u,
    /require\s*\(\s*['"]electron['"]\s*\)/u,
    /from\s+['"][^'"]*(?:main|preload|editor|command-catalog|projectCommands)[^'"]*['"]/u,
  ];
  for (const pattern of forbiddenPatterns) {
    assert.equal(pattern.test(moduleText), false, `forbidden 001X import pattern: ${pattern.source}`);
  }
});
