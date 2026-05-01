const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'exactTextApplyWithReceiptExecution.mjs';
const TASK_BASENAME = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_001W.md';
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

function sceneTextHash(canonicalHash, text) {
  return canonicalHash({
    hashKind: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_SCENE_TEXT_HASH_V1_001W',
    text,
  });
}

function accepted001VResult(canonicalHash, overrides = {}) {
  const decision = withCanonicalHash(canonicalHash, {
    decisionKind: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_DECISION_001V',
    outputDecision: 'OWNER_MAY_OPEN_PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_001W_NO_PUBLIC_RUNTIME',
    nextContourAfterPass: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_001W',
    exactTextApplyWithReceiptAdmissionOnly: true,
    privateExecutionNextContourOnly: true,
    admissionDoesNotImplementApplyExecution: true,
    admissionDoesNotMutateUserProject: true,
    admissionDoesNotAuthorizePublicRuntime: true,
    zeroApplyExecutionEffects: true,
    applyExecutionImplemented: false,
    userProjectMutated: false,
    publicRuntimeAdmitted: false,
    applyTxnImplemented: false,
    recoveryClaimed: false,
  });
  return withCanonicalHash(canonicalHash, {
    resultKind: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_RESULT_001V',
    contourId: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_001V',
    outputDecision: decision.outputDecision,
    nextContourAfterPass: decision.nextContourAfterPass,
    ownerMayOpen001W: true,
    exactTextApplyWithReceiptAdmissionOnly: true,
    privateInternalOnly: true,
    privateExecutionNextContourOnly: true,
    exactTextOnly: true,
    singleSceneOnly: true,
    admissionDoesNotAuthorizePublicRuntime: true,
    admissionDoesNotImplementApplyExecution: true,
    admissionDoesNotMutateUserProject: true,
    receiptImplementationProofRequired: true,
    source001UReceiptWriteIsNotApplyTxn: true,
    source001UReceiptReadbackIsNotRecovery: true,
    zeroApplyExecutionEffects: true,
    applyExecutionEffects: [],
    applyExecutionImplemented: false,
    userProjectMutated: false,
    publicRuntimeAdmitted: false,
    productApplyRuntimeAdmitted: false,
    publicSurfaceClaimed: false,
    ipcSurfaceClaimed: false,
    menuSurfaceClaimed: false,
    commandSurfaceClaimed: false,
    preloadExportClaimed: false,
    uiChanged: false,
    docxImportClaimed: false,
    applyTxnImplemented: false,
    recoveryClaimed: false,
    releaseClaimed: false,
    multiSceneApplyClaimed: false,
    structuralApplyClaimed: false,
    commentApplyClaimed: false,
    networkUsed: false,
    dependencyChanged: false,
    source001UResultHash: canonicalHash({ source: '001u-result' }),
    source001UDecisionHash: canonicalHash({ source: '001u-decision' }),
    source001UReceiptHash: canonicalHash({ source: '001u-receipt' }),
    blockedReasons: [],
    decisions: [decision],
    ...overrides,
  });
}

function privatePaths() {
  const privateExecutionRoot = path.join(os.tmpdir(), 'exact-text-001w-private-root');
  return {
    privateExecutionRoot,
    sceneFileBasename: 'scene-001.txt',
    receiptFileBasename: 'receipt-001w.json',
    sceneFileTarget: path.join(privateExecutionRoot, 'scene-001.txt'),
    receiptFileTarget: path.join(privateExecutionRoot, 'receipt-001w.json'),
  };
}

function createPorts(files, options = {}) {
  const calls = [];
  const storagePorts = {
    resolvePathInfo: async ({ privateExecutionRoot, sceneFileTarget, receiptFileTarget }) => {
      calls.push(['resolvePathInfo', privateExecutionRoot, sceneFileTarget, receiptFileTarget]);
      return {
        success: true,
        privateExecutionRootRealPath: privateExecutionRoot,
        sceneFileRealPath: sceneFileTarget,
        receiptFileRealPath: receiptFileTarget,
        privateExecutionRootInsideTempRoot: true,
        privateExecutionRootIsUserProjectRoot: false,
        sceneTargetSymlinkEscape: false,
        receiptTargetSymlinkEscape: false,
        sceneTargetIsDirectory: false,
        receiptTargetIsDirectory: false,
        ...options.pathInfoPatch,
      };
    },
    readFile: async (target) => {
      calls.push(['readFile', target]);
      if (options.readFileFailureTarget === target) {
        return null;
      }
      return files.get(target);
    },
    createBackup: async (target, text, meta) => {
      calls.push(['createBackup', target, text, meta?.basePath]);
      if (options.backupFailure) {
        return { success: false, error: 'backup failed' };
      }
      return { success: true, backupId: 'backup-001w', targetBasename: path.basename(target) };
    },
    writeFileAtomic: async (target, text) => {
      calls.push(['writeFileAtomic', target, text]);
      if (options.sceneWriteFailure && target.endsWith('scene-001.txt')) {
        return { success: false, error: 'scene write failed' };
      }
      if (options.receiptWriteFailure && target.endsWith('receipt-001w.json')) {
        return { success: false, error: 'receipt write failed' };
      }
      if (options.sceneWriteCorrupts && target.endsWith('scene-001.txt')) {
        files.set(target, 'corrupted after text');
        return { success: true, writeId: 'scene-write-corrupt' };
      }
      if (options.receiptWriteCorrupts && target.endsWith('receipt-001w.json')) {
        files.set(target, '{"receiptCanonicalHash":"tampered"}\n');
        return { success: true, writeId: 'receipt-write-corrupt' };
      }
      files.set(target, text);
      return { success: true, writeId: target.endsWith('receipt-001w.json') ? 'receipt-write-001w' : 'scene-write-001w' };
    },
  };
  return { storagePorts, calls };
}

async function baseInput(overrides = {}, portOptions = {}) {
  const { canonicalHash } = await loadKernel();
  const paths = privatePaths();
  const source001VResult = accepted001VResult(canonicalHash);
  const beforeText = 'before exact text';
  const afterText = 'after exact text';
  const files = new Map([[paths.sceneFileTarget, beforeText]]);
  const { storagePorts, calls } = createPorts(files, portOptions);
  return {
    input: {
      source001VResult,
      source001VResultHash: source001VResult.canonicalHash,
      source001VDecisionHash: source001VResult.decisions[0].canonicalHash,
      privateExecutionRoot: paths.privateExecutionRoot,
      privateExecutionRootInsideTempRoot: true,
      privateExecutionRootIsUserProjectRoot: false,
      userProjectPathAllowed: false,
      productRootAccess: false,
      repoRootAccess: false,
      userProjectRootAccess: false,
      sceneFileTarget: paths.sceneFileTarget,
      sceneFileTargetInsidePrivateExecutionRoot: true,
      sceneFileBasename: paths.sceneFileBasename,
      receiptFileTarget: paths.receiptFileTarget,
      receiptFileTargetInsidePrivateExecutionRoot: true,
      receiptFileBasename: paths.receiptFileBasename,
      projectId: 'project-001w',
      expectedProjectId: 'project-001w',
      sceneId: 'scene-001',
      expectedSceneId: 'scene-001',
      exactBeforeText: beforeText,
      exactAfterText: afterText,
      expectedBaselineHash: sceneTextHash(canonicalHash, beforeText),
      currentBaselineHash: sceneTextHash(canonicalHash, beforeText),
      blockVersionHash: canonicalHash({ block: 'version-001w' }),
      expectedBlockVersionHash: canonicalHash({ block: 'version-001w' }),
      sessionOpen: true,
      operationKind: 'EXACT_TEXT_REPLACE',
      singleSceneOnly: true,
      exactTextOnly: true,
      privateExecutionAllowed: true,
      storagePorts,
      receiptWrittenAt: '2026-05-01T00:00:00.000Z',
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
      ...overrides,
    },
    files,
    calls,
    paths,
    canonicalHash,
  };
}

function countCalls(calls, name) {
  return calls.filter((call) => call[0] === name).length;
}

function countWrites(calls) {
  return countCalls(calls, 'writeFileAtomic');
}

test('001W executes private exact text write plus receipt after accepted 001V proof', async () => {
  const { runExactTextApplyWithReceiptExecution } = await loadModule();
  const { input, files, calls, paths } = await baseInput();
  const result = await runExactTextApplyWithReceiptExecution(input);
  assert.equal(result.outputDecision, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTED_NO_PUBLIC_RUNTIME');
  assert.equal(result.nextContourAfterPass, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_001X');
  assert.equal(result.privateExactTextApplyWithReceiptExecuted, true);
  assert.equal(result.privatePortExecutionOnly, true);
  assert.equal(result.productApplyRuntimeAdmitted, false);
  assert.equal(result.publicRuntimeAdmitted, false);
  assert.equal(result.applyTxnImplemented, false);
  assert.equal(result.recoveryClaimed, false);
  assert.equal(result.startupRecoveryClaimed, false);
  assert.equal(result.userProjectMutated, false);
  assert.equal(result.realUserProjectPathTouched, false);
  assert.equal(result.receiptIsNotRecovery, true);
  assert.equal(result.receiptReadbackIsNotStartupRecovery, true);
  assert.equal(result.atomicSingleFileWriteIsNotApplyTxn, true);
  assert.equal(result.multiFileConsistencyNotClaimed, true);
  assert.equal(result.backupSubsystemNotReproven, true);
  assert.equal(result.receiptReadbackVerified, true);
  assert.equal(files.get(paths.sceneFileTarget), input.exactAfterText);
  assert.equal(JSON.parse(files.get(paths.receiptFileTarget)).receiptCanonicalHash, result.receiptCanonicalHash);
  assert.deepEqual(calls.map((call) => call[0]), [
    'resolvePathInfo',
    'readFile',
    'createBackup',
    'writeFileAtomic',
    'readFile',
    'writeFileAtomic',
    'readFile',
  ]);
});

test('001W blocks missing mismatched blocked or contaminated 001V before writes', async () => {
  const { runExactTextApplyWithReceiptExecution, EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const cases = [];
  const base = await baseInput();
  cases.push({ patch: { source001VResult: null }, code: 'SOURCE_001V_RESULT_REQUIRED' });
  cases.push({ patch: { source001VResultHash: 'bad-result-hash' }, code: 'SOURCE_001V_RESULT_MISMATCH' });
  cases.push({ patch: { source001VDecisionHash: 'bad-decision-hash' }, code: 'SOURCE_001V_DECISION_MISMATCH' });
  const blocked = withCanonicalHash(canonicalHash, {
    ...withoutHash(base.input.source001VResult),
    outputDecision: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_REMAINS_BLOCKED',
    ownerMayOpen001W: false,
    blockedReasons: ['SIMULATED_BLOCK'],
    decisions: [],
  });
  cases.push({
    patch: { source001VResult: blocked, source001VResultHash: blocked.canonicalHash, source001VDecisionHash: '' },
    code: 'SOURCE_001V_BLOCKED',
  });
  const contaminated = withCanonicalHash(canonicalHash, { ...withoutHash(base.input.source001VResult), publicRuntimeAdmitted: true });
  cases.push({
    patch: { source001VResult: contaminated, source001VResultHash: contaminated.canonicalHash },
    code: 'SOURCE_001V_RUNTIME_FLAG_FORBIDDEN',
  });
  const malformedDecision = withCanonicalHash(canonicalHash, {
    ...withoutHash(base.input.source001VResult),
    decisions: [withCanonicalHash(canonicalHash, {
      ...withoutHash(base.input.source001VResult.decisions[0]),
      outputDecision: 'MALFORMED_DECISION',
    })],
  });
  cases.push({
    patch: {
      source001VResult: malformedDecision,
      source001VResultHash: malformedDecision.canonicalHash,
      source001VDecisionHash: malformedDecision.decisions[0].canonicalHash,
    },
    code: 'SOURCE_001V_BLOCKED',
  });
  for (const decisionPatch of [
    { decisionKind: 'MALFORMED_DECISION_KIND' },
    { nextContourAfterPass: 'WRONG_NEXT_CONTOUR' },
    { applyExecutionImplemented: true },
    { userProjectMutated: true },
    { publicRuntimeAdmitted: true },
    { applyTxnImplemented: true },
    { recoveryClaimed: true },
  ]) {
    const malformed = withCanonicalHash(canonicalHash, {
      ...withoutHash(base.input.source001VResult),
      decisions: [withCanonicalHash(canonicalHash, {
        ...withoutHash(base.input.source001VResult.decisions[0]),
        ...decisionPatch,
      })],
    });
    cases.push({
      patch: {
        source001VResult: malformed,
        source001VResultHash: malformed.canonicalHash,
        source001VDecisionHash: malformed.decisions[0].canonicalHash,
      },
      code: 'SOURCE_001V_BLOCKED',
    });
  }
  const missingNested001U = withCanonicalHash(canonicalHash, { ...withoutHash(base.input.source001VResult), source001UReceiptHash: '' });
  cases.push({
    patch: { source001VResult: missingNested001U, source001VResultHash: missingNested001U.canonicalHash },
    code: 'SOURCE_001V_BLOCKED',
  });

  for (const item of cases) {
    const { input, calls } = await baseInput(item.patch);
    const result = await runExactTextApplyWithReceiptExecution(input);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES[item.code]), true);
    assert.equal(countCalls(calls, 'createBackup'), 0);
    assert.equal(countWrites(calls), 0);
  }
});

test('001W path policy blocks unsafe roots targets basenames symlinks and collisions before reads or writes', async () => {
  const { runExactTextApplyWithReceiptExecution, EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES } = await loadModule();
  const cases = [
    { patch: { privateExecutionRootInsideTempRoot: false }, code: 'PRIVATE_ROOT_POLICY_REQUIRED' },
    { patch: { privateExecutionRootIsUserProjectRoot: true }, code: 'PRIVATE_ROOT_POLICY_REQUIRED' },
    { patch: { privateExecutionAllowed: false }, code: 'PRIVATE_ROOT_POLICY_REQUIRED' },
    { patch: { userProjectRootAccess: true }, code: 'USER_PROJECT_PATH_FORBIDDEN' },
    { patch: { sceneFileTargetInsidePrivateExecutionRoot: false }, code: 'SCENE_TARGET_POLICY_REQUIRED' },
    { patch: { receiptFileTargetInsidePrivateExecutionRoot: false }, code: 'RECEIPT_TARGET_POLICY_REQUIRED' },
    { patch: { sceneFileTarget: '../scene-001.txt' }, code: 'PATH_TRAVERSAL_FORBIDDEN' },
    { patch: { receiptFileTarget: '../receipt-001w.json' }, code: 'PATH_TRAVERSAL_FORBIDDEN' },
    { patch: { sceneFileTarget: path.join(os.tmpdir(), 'outside', 'scene-001.txt') }, code: 'PATH_BOUNDARY_VIOLATION' },
    { patch: { receiptFileTarget: path.join(os.tmpdir(), 'outside', 'receipt-001w.json') }, code: 'PATH_BOUNDARY_VIOLATION' },
    { patch: { sceneTargetSymlinkEscape: true }, code: 'SYMLINK_POLICY_UNSAFE' },
    { patch: { receiptTargetSymlinkEscape: true }, code: 'SYMLINK_POLICY_UNSAFE' },
    { patch: { sceneFileBasename: '../scene-001.txt' }, code: 'UNSAFE_BASENAME' },
    { patch: { receiptFileBasename: '../receipt-001w.json' }, code: 'UNSAFE_BASENAME' },
  ];
  const collision = await baseInput();
  cases.push({
    patch: { receiptFileTarget: collision.paths.sceneFileTarget, receiptFileBasename: collision.paths.sceneFileBasename },
    code: 'TARGET_COLLISION_FORBIDDEN',
  });

  for (const item of cases) {
    const { input, calls } = await baseInput(item.patch);
    const result = await runExactTextApplyWithReceiptExecution(input);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES[item.code]), true);
    assert.equal(countCalls(calls, 'readFile'), 0);
    assert.equal(countCalls(calls, 'createBackup'), 0);
    assert.equal(countWrites(calls), 0);
  }

  for (const item of [
    { pathInfoPatch: { success: false }, code: 'RESOLVED_PATH_POLICY_REQUIRED' },
    { pathInfoPatch: { sceneTargetSymlinkEscape: true }, code: 'SYMLINK_POLICY_UNSAFE' },
    { pathInfoPatch: { receiptTargetSymlinkEscape: true }, code: 'SYMLINK_POLICY_UNSAFE' },
    { pathInfoPatch: { sceneTargetIsDirectory: true }, code: 'TARGET_DIRECTORY_FORBIDDEN' },
    { pathInfoPatch: { receiptTargetIsDirectory: true }, code: 'TARGET_DIRECTORY_FORBIDDEN' },
    { pathInfoPatch: { sceneFileRealPath: path.join(os.tmpdir(), 'outside', 'scene-001.txt') }, code: 'PATH_BOUNDARY_VIOLATION' },
    { pathInfoPatch: { receiptFileRealPath: path.join(os.tmpdir(), 'outside', 'receipt-001w.json') }, code: 'PATH_BOUNDARY_VIOLATION' },
  ]) {
    const { input, calls } = await baseInput({}, { pathInfoPatch: item.pathInfoPatch });
    const result = await runExactTextApplyWithReceiptExecution(input);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES[item.code]), true);
    assert.equal(countCalls(calls, 'resolvePathInfo'), 1);
    assert.equal(countCalls(calls, 'readFile'), 0);
    assert.equal(countCalls(calls, 'createBackup'), 0);
    assert.equal(countWrites(calls), 0);
  }
});

test('001W precondition failures block before backup scene write and receipt write', async () => {
  const { runExactTextApplyWithReceiptExecution, EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const cases = [
    { patch: { projectId: 'wrong-project' }, code: 'PROJECT_ID_MISMATCH' },
    { patch: { sceneId: 'wrong-scene' }, code: 'SCENE_ID_MISMATCH' },
    { patch: { sessionOpen: false }, code: 'CLOSED_SESSION' },
    { patch: { currentBaselineHash: 'stale-baseline' }, code: 'STALE_BASELINE' },
    { patch: { exactBeforeText: 'different before text' }, code: 'EXACT_TEXT_MISMATCH' },
    { patch: { blockVersionHash: canonicalHash({ block: 'wrong-version' }) }, code: 'BLOCK_VERSION_MISMATCH' },
    { patch: { operationKind: 'TEXT_INSERT' }, code: 'UNSUPPORTED_OP_KIND' },
    { patch: { singleSceneOnly: false }, code: 'MULTI_SCOPE_WRITE_BLOCKED' },
    { patch: { structuralApplyClaimed: true }, code: 'STRUCTURAL_WRITE_BLOCKED' },
    { patch: { commentApplyClaimed: true }, code: 'COMMENT_WRITE_BLOCKED' },
  ];
  for (const item of cases) {
    const { input, calls } = await baseInput(item.patch);
    const result = await runExactTextApplyWithReceiptExecution(input);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES[item.code]), true);
    assert.equal(countCalls(calls, 'resolvePathInfo'), 1);
    assert.equal(countCalls(calls, 'readFile'), 1);
    assert.equal(countCalls(calls, 'createBackup'), 0);
    assert.equal(countWrites(calls), 0);
  }
});

test('001W storage port and write failures never claim ApplyTxn recovery or public runtime', async () => {
  const { runExactTextApplyWithReceiptExecution, EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES } = await loadModule();
  const missingPorts = await baseInput({ storagePorts: null });
  let result = await runExactTextApplyWithReceiptExecution(missingPorts.input);
  assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.STORAGE_PORTS_REQUIRED), true);
  assert.equal(countWrites(missingPorts.calls), 0);

  const missingReceiptTime = await baseInput({ receiptWrittenAt: '' });
  result = await runExactTextApplyWithReceiptExecution(missingReceiptTime.input);
  assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES.RECEIPT_WRITTEN_AT_REQUIRED), true);
  assert.equal(countWrites(missingReceiptTime.calls), 0);

  for (const item of [
    { options: { backupFailure: true }, code: 'BACKUP_FAILED', writes: 0 },
    { options: { sceneWriteFailure: true }, code: 'ATOMIC_WRITE_FAILED', writes: 1 },
    { options: { sceneWriteCorrupts: true }, code: 'AFTER_WRITE_HASH_MISMATCH', writes: 1 },
    { options: { receiptWriteFailure: true }, code: 'RECEIPT_WRITE_FAILED', writes: 2 },
    { options: { receiptWriteCorrupts: true }, code: 'RECEIPT_READBACK_HASH_MISMATCH', writes: 2 },
  ]) {
    const { input, calls } = await baseInput({}, item.options);
    result = await runExactTextApplyWithReceiptExecution(input);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES[item.code]), true);
    assert.equal(countWrites(calls), item.writes);
    assert.equal(result.productApplyRuntimeAdmitted, false);
    assert.equal(result.publicRuntimeAdmitted, false);
    assert.equal(result.applyTxnImplemented, false);
    assert.equal(result.recoveryClaimed, false);
    assert.equal(result.startupRecoveryClaimed, false);
    assert.equal(result.receiptIsNotRecovery, true);
    assert.equal(result.atomicSingleFileWriteIsNotApplyTxn, true);
  }
});

test('001W public runtime UI DOCX network dependency ApplyTxn recovery and user project requests block before writes', async () => {
  const { runExactTextApplyWithReceiptExecution, EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES } = await loadModule();
  const cases = [
    { patch: { productApplyRuntimeAdmitted: true }, code: 'PRODUCT_RUNTIME_FORBIDDEN' },
    { patch: { publicRuntimeAdmitted: true }, code: 'PRODUCT_RUNTIME_FORBIDDEN' },
    { patch: { publicSurfaceClaimed: true }, code: 'PUBLIC_COMMAND_SURFACE_FORBIDDEN' },
    { patch: { ipcSurfaceClaimed: true }, code: 'PUBLIC_COMMAND_SURFACE_FORBIDDEN' },
    { patch: { preloadExportClaimed: true }, code: 'PUBLIC_COMMAND_SURFACE_FORBIDDEN' },
    { patch: { menuSurfaceClaimed: true }, code: 'PUBLIC_COMMAND_SURFACE_FORBIDDEN' },
    { patch: { commandSurfaceClaimed: true }, code: 'PUBLIC_COMMAND_SURFACE_FORBIDDEN' },
    { patch: { uiChanged: true }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { docxImportClaimed: true }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { networkUsed: true }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { dependencyChanged: true }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { applyTxnImplemented: true }, code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { patch: { recoveryClaimed: true }, code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { patch: { startupRecoveryClaimed: true }, code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { patch: { releaseClaimed: true }, code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { patch: { userProjectMutated: true }, code: 'USER_PROJECT_MUTATION_FORBIDDEN' },
    { patch: { realUserProjectPathTouched: true }, code: 'USER_PROJECT_MUTATION_FORBIDDEN' },
  ];
  for (const item of cases) {
    const { input, calls } = await baseInput(item.patch);
    const result = await runExactTextApplyWithReceiptExecution(input);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_REASON_CODES[item.code]), true);
    assert.equal(countCalls(calls, 'createBackup'), 0);
    assert.equal(countWrites(calls), 0);
  }
});

test('001W task record preserves private execution boundary', () => {
  const taskText = sourceText('docs', 'tasks', TASK_BASENAME);
  assert.match(taskText, /TASK_ID: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_001W/u);
  assert.match(taskText, /CONTOUR_TYPE: PRIVATE_PORT_EXECUTION_ONLY/u);
  assert.match(taskText, /CONTOUR_NOT_PUBLIC_RUNTIME: TRUE/u);
  assert.match(taskText, /CONTOUR_NOT_USER_PROJECT_MUTATION: TRUE/u);
  assert.match(taskText, /APPLYTXN_IMPLEMENTED: false/u);
  assert.match(taskText, /RECOVERY_CLAIMED: false/u);
  assert.match(taskText, /RECEIPT_IS_NOT_RECOVERY: true/u);
  assert.match(taskText, /ATOMIC_SINGLE_FILE_WRITE_IS_NOT_APPLYTXN: true/u);
  assert.match(taskText, /NEXT_CONTOUR_IF_PASS: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_001X/u);
  assert.match(taskText, /COMMIT_SHA: pending/u);
  assert.doesNotMatch(taskText, /release green|public apply|DOCX runtime|ApplyTxn implemented|recovery proven/iu);
});

test('001W changed scope stays allowlisted and execution module stays private-port only', () => {
  const changedBasenames = changedBasenamesForCurrentContour();
  const allowlist = new Set([
    MODULE_BASENAME,
    'exactTextApplyWithReceiptCloseout.mjs',
    'exactTextApplyWithReceiptNextAdmission.mjs',
    'exactTextApplyWithReceiptNextContourAdmission.mjs',
    'exactTextApplyWithReceiptPrivateContractBrief.mjs',
    'exactTextApplyWithReceiptExecution.contract.test.js',
    'exactTextApplyWithReceiptCloseout.contract.test.js',
    'exactTextApplyWithReceiptNextAdmission.contract.test.js',
    'exactTextApplyWithReceiptNextContourAdmission.contract.test.js',
    'exactTextApplyWithReceiptPrivateContractBrief.contract.test.js',
    TASK_BASENAME,
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_001X.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_ADMISSION_001Y.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_001Z.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_002A.md',
    'revision-bridge-pre-stage-00-admission-guard-state.mjs',
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
  assert.notDeepEqual(changedBasenames, [], '001W must have detectable changed scope');
  for (const basename of changedBasenames) {
    assert.equal(allowlist.has(basename), true, `unexpected 001W changed basename: ${basename}`);
    assert.equal(denylist.has(basename), false, `denylisted 001W changed basename: ${basename}`);
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
    assert.equal(pattern.test(moduleText), false, `forbidden 001W import pattern: ${pattern.source}`);
  }
});
