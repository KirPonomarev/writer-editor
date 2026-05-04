const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'exactTextApplyWithReceiptPrivatePortImplementation.mjs';
const SOURCE_002C_MODULE_BASENAME = 'exactTextApplyWithReceiptPrivatePortAdmission.mjs';
const SOURCE_002C_TEST_BASENAME = 'exactTextApplyWithReceiptPrivatePortAdmission.contract.test.js';
const TASK_BASENAME = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_002D.md';
const KERNEL_BASENAME = 'reviewIrKernel.mjs';
const BINDING_HEAD_SHA = '0ab82829a3c29aad721ce60172e2250bde6598e9';

async function loadModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

async function load002CModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', SOURCE_002C_MODULE_BASENAME)).href);
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

function load002CTestHelpers() {
  const filename = path.join(process.cwd(), 'test', 'contracts', SOURCE_002C_TEST_BASENAME);
  const testSource = fs.readFileSync(filename, 'utf8');
  const factory = new Function(
    'require',
    'process',
    'console',
    '__dirname',
    '__filename',
    `${testSource}\nreturn { acceptedInput, ownerPacket002C };`,
  );
  return factory(
    (specifier) => (specifier === 'node:test' ? () => undefined : require(specifier)),
    process,
    console,
    path.dirname(filename),
    filename,
  );
}

function ownerPacket002D(overrides = {}) {
  return {
    packetKind: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_OWNER_PACKET_002D',
    targetContour: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_002D',
    bindingHeadSha: BINDING_HEAD_SHA,
    ownerApprovedPrivatePortImplementation: true,
    ownerUnderstandsPrivateFixtureOnly: true,
    ownerUnderstandsInjectedPortOnly: true,
    ownerUnderstandsProductWriteForbidden: true,
    ownerUnderstandsProductStorageAdmissionForbidden: true,
    ownerUnderstandsPublicRuntimeForbidden: true,
    ownerUnderstandsUserProjectPathForbidden: true,
    ownerUnderstandsNoCommandSurface: true,
    ownerUnderstandsNoUi: true,
    ownerUnderstandsNoDocx: true,
    ownerUnderstandsNoNetwork: true,
    ownerUnderstandsNoDependencyChange: true,
    ownerUnderstandsNoApplyTxn: true,
    ownerUnderstandsNoRecoveryClaim: true,
    ownerUnderstandsNoReleaseClaim: true,
    ownerUnderstands002EWillNeedSeparateAdmission: true,
    ownerPacketAuthorizesOnlyPrivateFixturePortImplementation: true,
    ...overrides,
  };
}

function sceneTextHash(canonicalHash, text) {
  return canonicalHash({
    hashKind: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_FIXTURE_SCENE_TEXT_HASH_V1_002D',
    text,
  });
}

function fixturePort(canonicalHash, request, overrides = {}) {
  const state = {
    text: overrides.initialText ?? request.exactBeforeText,
    receipt: null,
    cleanupObserved: overrides.cleanupObserved ?? true,
  };
  return {
    state,
    isolatedFixtureRoot: true,
    canRejectTraversal: true,
    canRejectSymlinkEscape: true,
    canRejectDirectoryTarget: true,
    canReadScene: true,
    canWriteBackup: true,
    canAtomicWriteScene: true,
    canWriteFixtureReceipt: true,
    canReadBackFixtureReceipt: true,
    canObserveCleanup: true,
    canReportFailureWithoutPartialSuccess: true,
    readScene() {
      if (overrides.readFails) {
        return { success: false, error: 'read failed' };
      }
      return {
        success: true,
        projectId: overrides.projectId ?? request.projectId,
        sceneId: overrides.sceneId ?? request.sceneId,
        baselineHash: overrides.baselineHash ?? request.baselineHash,
        blockVersionHash: overrides.blockVersionHash ?? request.expectedBlockVersionHash,
        closedSession: overrides.closedSession === true,
        text: state.text,
      };
    },
    writeBackup() {
      if (overrides.backupFails) {
        return { success: false, error: 'backup failed' };
      }
      return { success: true, observationHash: canonicalHash({ backup: request.beforeSceneHash }) };
    },
    atomicWriteScene(payload) {
      if (overrides.atomicFails) {
        return { success: false, error: 'atomic failed' };
      }
      state.text = payload.nextText;
      return { success: true, observationHash: canonicalHash({ after: sceneTextHash(canonicalHash, payload.nextText) }) };
    },
    writeFixtureReceipt(payload) {
      if (overrides.receiptFails) {
        return { success: false, error: 'receipt failed' };
      }
      state.receipt = payload.receipt;
      return { success: true };
    },
    readBackScene() {
      return {
        success: true,
        text: overrides.readbackText ?? state.text,
      };
    },
    readBackFixtureReceipt() {
      return {
        success: !overrides.receiptReadbackFails,
        receipt: overrides.receiptReadbackReceipt ?? state.receipt,
      };
    },
    observeCleanup() {
      return {
        success: state.cleanupObserved,
        cleanupObserved: state.cleanupObserved,
      };
    },
    ...overrides.portFields,
  };
}

async function acceptedInput(patch = {}, portOverrides = {}) {
  const helpers = load002CTestHelpers();
  const source002CInput = await helpers.acceptedInput();
  const { runExactTextApplyWithReceiptPrivatePortAdmission } = await load002CModule();
  const source002CResult = runExactTextApplyWithReceiptPrivatePortAdmission(source002CInput);
  const { canonicalHash } = await loadKernel();
  const exactBeforeText = 'alpha beta gamma';
  const exactAfterText = 'alpha delta gamma';
  const exactTextApplyRequest = {
    projectId: 'project-alpha',
    sceneId: 'scene-alpha',
    baselineHash: canonicalHash({ baseline: 'fresh' }),
    beforeSceneHash: sceneTextHash(canonicalHash, exactBeforeText),
    expectedBlockVersionHash: canonicalHash({ block: 'version' }),
    exactBeforeText,
    exactAfterText,
    replacementText: 'delta',
    receiptNonce: 'receipt-nonce-002d',
    requestedAt: '2026-04-30T00:00:00.000Z',
    noStructuralScope: true,
    noCommentScope: true,
    singleSceneOnly: true,
  };
  const base = {
    ...source002CInput,
    source002CResult,
    source002CResultHash: source002CResult.canonicalHash,
    source002CDecisionHash: source002CResult.decisions[0].canonicalHash,
    source002BContractShapeHash: source002CResult.contractShapeHash,
    ownerImplementationPacket002D: ownerPacket002D(),
    exactTextApplyRequest,
  };
  return {
    ...base,
    injectedPrivateFixturePort: fixturePort(canonicalHash, exactTextApplyRequest, portOverrides),
    ...patch,
  };
}

test('002D executes private injected fixture port only after accepted 002C and inherited chain revalidation', async () => {
  const { runExactTextApplyWithReceiptPrivatePortImplementation } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const input = await acceptedInput();
  const result = runExactTextApplyWithReceiptPrivatePortImplementation(input);

  assert.equal(result.resultKind, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_RESULT_002D');
  assert.equal(result.outputDecision, 'PRIVATE_FIXTURE_PORT_IMPLEMENTATION_EXECUTED_NO_PRODUCT_RUNTIME_ADMITTED');
  assert.equal(result.nextContourRecommendation, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_AND_PRODUCT_ADMISSION_002E');
  assert.equal(result.source002CAccepted, true);
  assert.equal(result.inheritedChainVerified, true);
  assert.equal(result.injectedFixturePortAccepted, true);
  assert.equal(result.exactTextGuardPassed, true);
  assert.equal(result.fixtureAtomicWriteExecuted, true);
  assert.equal(result.fixtureReceiptWritten, true);
  assert.equal(result.fixtureReadbackMatched, true);
  assert.equal(result.fixtureCleanupObserved, true);
  assert.equal(result.fixtureWriteCount, 1);
  assert.equal(result.fixtureReceiptCount, 1);
  assert.equal(result.productWriteCount, 0);
  assert.equal(result.publicSurfaceCount, 0);
  assert.equal(result.productWritePerformed, false);
  assert.equal(result.productStorageAdmission, false);
  assert.notEqual(result.productStorageSafetyClaimed, true);
  assert.equal(result.productApplyReceiptClaimed, false);
  assert.equal(result.recoveryClaimed, false);
  assert.equal(result.userProjectMutated, false);
  assert.equal(result.publicRuntimeAdmitted, false);
  assert.equal(result.receipt.receiptKind, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_FIXTURE_RECEIPT_V1_002D');
  assert.equal(result.receipt.receiptCanonicalHash, canonicalHash(withoutHash(result.receipt, 'receiptCanonicalHash')));
  assert.equal(result.decisions[0].decisionKind, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_DECISION_002D');
  assert.equal(result.decisions[0].productWriteCount, 0);
  assert.deepEqual(result.blockedReasons, []);
  assert.equal(input.injectedPrivateFixturePort.state.text, input.exactTextApplyRequest.exactAfterText);
  assert.equal(input.injectedPrivateFixturePort.state.receipt.receiptCanonicalHash, result.receipt.receiptCanonicalHash);
  assert.equal(result.canonicalHash, canonicalHash(withoutHash(result)));
});

test('002D blocks missing mismatched blocked synthetic and malformed source chain', async () => {
  const { runExactTextApplyWithReceiptPrivatePortImplementation, EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const base = await acceptedInput();
  const blocked002C = withCanonicalHash(canonicalHash, {
    ...withoutHash(base.source002CResult),
    outputDecision: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_002C_BLOCKED',
    ownerMayOpen002D: false,
    blockedReasons: ['BLOCKED'],
    decisions: [],
  });
  const synthetic002C = withCanonicalHash(canonicalHash, {
    ...withoutHash(base.source002CResult),
    source002BResultHash: canonicalHash({ synthetic: '002b-result' }),
  });
  const cases = [
    { patch: { source002CResult: null }, code: 'SOURCE_002C_RESULT_REQUIRED' },
    { patch: { source002CResultHash: canonicalHash({ wrong: '002c-result' }) }, code: 'SOURCE_002C_RESULT_HASH_MISMATCH' },
    { patch: { source002CDecisionHash: canonicalHash({ wrong: '002c-decision' }) }, code: 'SOURCE_002C_DECISION_HASH_MISMATCH' },
    { patch: { source002BContractShapeHash: canonicalHash({ wrong: '002b-shape' }) }, code: 'SOURCE_002B_CONTRACT_SHAPE_MISMATCH' },
    { patch: { source002CResult: blocked002C, source002CResultHash: blocked002C.canonicalHash, source002CDecisionHash: '' }, code: 'SOURCE_002C_BLOCKED' },
    { patch: { source002CResult: synthetic002C, source002CResultHash: synthetic002C.canonicalHash }, code: 'INHERITED_CHAIN_REVALIDATION_FAILED' },
    { patch: { source002AResult: null }, code: 'INHERITED_CHAIN_REVALIDATION_FAILED' },
  ];

  for (const item of cases) {
    const result = runExactTextApplyWithReceiptPrivatePortImplementation({ ...base, ...item.patch });
    assert.equal(result.outputDecision, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_002D_BLOCKED');
    assert.equal(result.nextContourRecommendation, null);
    assert.equal(result.fixtureWriteCount, 0);
    assert.equal(result.fixtureReceiptCount, 0);
    assert.equal(result.productWriteCount, 0);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES[item.code]), true, item.code);
  }
});

test('002D owner request and injected fixture port reject forbidden claims paths callables and unsafe policy', async () => {
  const { runExactTextApplyWithReceiptPrivatePortImplementation, EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES } = await loadModule();
  const base = await acceptedInput();
  const cases = [
    { patch: { ownerImplementationPacket002D: null }, code: 'OWNER_PACKET_REQUIRED' },
    { patch: { ownerImplementationPacket002D: ownerPacket002D({ packetKind: 'WRONG_PACKET' }) }, code: 'OWNER_PACKET_INVALID' },
    { patch: { ownerImplementationPacket002D: ownerPacket002D({ targetContour: 'WRONG_TARGET' }) }, code: 'OWNER_PACKET_TARGET_MISMATCH' },
    { patch: { ownerImplementationPacket002D: ownerPacket002D({ bindingHeadSha: 'wrong-sha' }) }, code: 'OWNER_PACKET_BINDING_MISMATCH' },
    { patch: { ownerImplementationPacket002D: ownerPacket002D({ ownerUnderstandsInjectedPortOnly: false }) }, code: 'OWNER_POLICY_MISSING' },
    { patch: { ownerImplementationPacket002D: ownerPacket002D({ surpriseField: true }) }, code: 'OWNER_PACKET_UNKNOWN_FIELD_FORBIDDEN' },
    { patch: { ownerImplementationPacket002D: ownerPacket002D({ openPort: () => null }) }, code: 'CALLABLE_FIELD_FORBIDDEN' },
    { patch: { ownerImplementationPacket002D: ownerPacket002D({ userProjectPath: '/tmp/project' }) }, code: 'USER_PROJECT_PATH_FORBIDDEN' },
    { patch: { ownerImplementationPacket002D: ownerPacket002D({ publicRuntimeAdmitted: true }) }, code: 'PUBLIC_RUNTIME_FORBIDDEN' },
    { patch: { ownerImplementationPacket002D: ownerPacket002D({ publicSurfaceClaimed: true }) }, code: 'PUBLIC_COMMAND_SURFACE_FORBIDDEN' },
    { patch: { ownerImplementationPacket002D: ownerPacket002D({ productWritePerformed: true }) }, code: 'PRODUCT_WRITE_FORBIDDEN' },
    { patch: { ownerImplementationPacket002D: ownerPacket002D({ productStorageAdmission: true }) }, code: 'PRODUCT_STORAGE_ADMISSION_FORBIDDEN' },
    { patch: { ownerImplementationPacket002D: ownerPacket002D({ productApplyReceiptClaimed: true }) }, code: 'PRODUCT_APPLYRECEIPT_CLAIM_FORBIDDEN' },
    { patch: { ownerImplementationPacket002D: ownerPacket002D({ recoveryClaimed: true }) }, code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { patch: { ownerImplementationPacket002D: ownerPacket002D({ releaseClaimed: true }) }, code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { patch: { productStorageSafetyClaimed: true }, code: 'PRODUCT_STORAGE_ADMISSION_FORBIDDEN' },
    { patch: { exactTextApplyRequest: { ...base.exactTextApplyRequest, userProjectPath: '/tmp/project' } }, code: 'USER_PROJECT_PATH_FORBIDDEN' },
    { patch: { exactTextApplyRequest: { ...base.exactTextApplyRequest, callback: () => null } }, code: 'CALLABLE_FIELD_FORBIDDEN' },
    { patch: { injectedPrivateFixturePort: null }, code: 'INJECTED_FIXTURE_PORT_REQUIRED' },
    { patch: { injectedPrivateFixturePort: { ...base.injectedPrivateFixturePort, isolatedFixtureRoot: false } }, code: 'INJECTED_FIXTURE_PORT_REQUIRED' },
    { patch: { injectedPrivateFixturePort: { ...base.injectedPrivateFixturePort, fixtureRootUnsafe: true } }, code: 'UNSAFE_FIXTURE_ROOT' },
    { patch: { injectedPrivateFixturePort: { ...base.injectedPrivateFixturePort, traversalAllowed: true } }, code: 'PATH_TRAVERSAL_FORBIDDEN' },
    { patch: { injectedPrivateFixturePort: { ...base.injectedPrivateFixturePort, symlinkEscapeAllowed: true } }, code: 'SYMLINK_ESCAPE_FORBIDDEN' },
    { patch: { injectedPrivateFixturePort: { ...base.injectedPrivateFixturePort, directoryTargetAllowed: true } }, code: 'DIRECTORY_TARGET_FORBIDDEN' },
    { patch: { injectedPrivateFixturePort: { ...base.injectedPrivateFixturePort, productRoot: '/tmp/project' } }, code: 'USER_PROJECT_PATH_FORBIDDEN' },
  ];

  for (const item of cases) {
    const result = runExactTextApplyWithReceiptPrivatePortImplementation({ ...base, ...item.patch });
    assert.equal(result.outputDecision, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_002D_BLOCKED');
    assert.equal(result.fixtureWriteCount, 0);
    assert.equal(result.productWriteCount, 0);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES[item.code]), true, item.code);
  }
});

test('002D blocks stale closed wrong exact structural comment and block precondition failures before fixture write', async () => {
  const { runExactTextApplyWithReceiptPrivatePortImplementation, EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const base = await acceptedInput();
  const cases = [
    { port: { projectId: 'wrong-project' }, code: 'WRONG_PROJECT' },
    { port: { sceneId: 'wrong-scene' }, code: 'WRONG_SCENE' },
    { port: { baselineHash: canonicalHash({ stale: true }) }, code: 'STALE_BASELINE' },
    { port: { closedSession: true }, code: 'CLOSED_SESSION' },
    { port: { initialText: 'wrong text' }, code: 'EXACT_TEXT_GUARD_FAILED' },
    { port: { blockVersionHash: canonicalHash({ block: 'wrong' }) }, code: 'BLOCK_VERSION_HASH_MISMATCH' },
    { request: { noStructuralScope: false }, code: 'UNSUPPORTED_SCOPE_FORBIDDEN' },
    { request: { noCommentScope: false }, code: 'UNSUPPORTED_SCOPE_FORBIDDEN' },
  ];

  for (const item of cases) {
    const input = await acceptedInput(
      item.request ? { exactTextApplyRequest: { ...base.exactTextApplyRequest, ...item.request } } : {},
      item.port || {},
    );
    const result = runExactTextApplyWithReceiptPrivatePortImplementation(input);
    assert.equal(result.outputDecision, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_002D_BLOCKED');
    assert.equal(result.fixtureWriteCount, 0);
    assert.equal(result.fixtureReceiptCount, 0);
    assert.equal(result.productWriteCount, 0);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES[item.code]), true, item.code);
  }
});

test('002D blocks fixture failures and never claims product storage safety on partial fixture failure', async () => {
  const { runExactTextApplyWithReceiptPrivatePortImplementation, EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const cases = [
    { port: { readFails: true }, code: 'SCENE_READ_FAILED' },
    { port: { backupFails: true }, code: 'BACKUP_WRITE_FAILED' },
    { port: { atomicFails: true }, code: 'ATOMIC_WRITE_FAILED' },
    { port: { receiptFails: true }, code: 'FIXTURE_RECEIPT_WRITE_FAILED' },
    { port: { readbackText: 'corrupted' }, code: 'READBACK_MISMATCH' },
    { port: { receiptReadbackFails: true }, code: 'READBACK_MISMATCH' },
    { port: { receiptReadbackReceipt: { receiptCanonicalHash: canonicalHash({ wrong: true }) } }, code: 'READBACK_MISMATCH' },
    { port: { cleanupObserved: false }, code: 'FIXTURE_CLEANUP_NOT_OBSERVED' },
  ];

  for (const item of cases) {
    const input = await acceptedInput({}, item.port);
    const result = runExactTextApplyWithReceiptPrivatePortImplementation(input);
    assert.equal(result.outputDecision, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_002D_BLOCKED');
    assert.equal(result.nextContourRecommendation, null);
    assert.equal(result.productStorageAdmission, false);
    assert.equal(result.productWritePerformed, false);
    assert.equal(result.productWriteCount, 0);
    assert.equal(result.publicSurfaceCount, 0);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_REASON_CODES[item.code]), true, item.code);
  }
});

test('002D task record preserves private injected fixture boundary and no product runtime policy', () => {
  const taskText = sourceText('docs', 'tasks', TASK_BASENAME);
  assert.match(taskText, /TASK_ID: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_002D/u);
  assert.match(taskText, /CONTOUR_TYPE: PRIVATE_INJECTED_FIXTURE_PORT_IMPLEMENTATION/u);
  assert.match(taskText, /PREVIOUS_CONTOUR: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_002C/u);
  assert.match(taskText, /NEXT_CONTOUR_IF_PASS: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_AND_PRODUCT_ADMISSION_002E/u);
  assert.match(taskText, /MODULE_IMPORT_FORBIDDEN_09: fileManager/u);
  assert.match(taskText, /MODULE_IMPORT_FORBIDDEN_10: backupManager/u);
  assert.match(taskText, /MODULE_IMPORT_FORBIDDEN_11: atomicWriteFile/u);
  assert.match(taskText, /LAYER_BOUNDARY_RECEIPT: FIXTURE_RECEIPT_ONLY_NOT_PRODUCT_APPLYRECEIPT/u);
  assert.match(taskText, /PRODUCT_STORAGE_ADMISSION_FORBIDDEN/u);
  assert.match(taskText, /DELIVERY_POLICY: COMMIT_REQUIRED_PUSH_REQUIRED/u);
  assert.doesNotMatch(taskText, /product saved|public API exposed|DOCX runtime enabled|release green/iu);
});

test('002D changed scope stays allowlisted and new module has no direct storage primitive imports', () => {
  const changedPaths = [
    ...gitLines(['diff', '--name-only', 'HEAD']),
    ...gitLines(['diff', '--cached', '--name-only']),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ].sort();
  const changedBasenames = changedBasenamesForCurrentContour();
  const allowedPaths = new Set([
    'docs/tasks/PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_002D.md',
    'docs/tasks/PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_AND_NEXT_CONTOUR_PERMISSION_002E.md',
    'docs/tasks/PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_IMPLEMENTATION_OPENING_ADMISSION_002F.md',
    'scripts/ops/revision-bridge-pre-stage-00-admission-guard-state.mjs',
    'src/revisionBridge/exactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission.mjs',
    'src/revisionBridge/exactTextApplyWithReceiptProductPathImplementationOpeningAdmission.mjs',
    'src/revisionBridge/exactTextApplyWithReceiptPrivatePortImplementation.mjs',
    'test/contracts/exactTextApplyFixtureDurableReceiptPrototype.contract.test.js',
    'test/contracts/exactTextApplyInternalWritePrototype.contract.test.js',
    'test/contracts/exactTextApplyPrivateProductApplyReceipt.contract.test.js',
    'test/contracts/exactTextApplyPrivateProductApplyReceiptAdmission.contract.test.js',
    'test/contracts/exactTextApplyProductApplyAdmissionGate.contract.test.js',
    'test/contracts/exactTextApplyProductApplyReadinessReview.contract.test.js',
    'test/contracts/exactTextApplyProductStoragePrimitiveEvidence.contract.test.js',
    'test/contracts/exactTextApplyTestFixtureReceiptFile.contract.test.js',
    'test/contracts/exactTextApplyTestOnlyProductShapedStorageDryRun.contract.test.js',
    'test/contracts/exactTextApplyTestOnlyStoragePrimitiveExecutionHarness.contract.test.js',
    'test/contracts/exactTextApplyWithReceiptAdmission.contract.test.js',
    'test/contracts/exactTextApplyWithReceiptCloseout.contract.test.js',
    'test/contracts/exactTextApplyWithReceiptExecution.contract.test.js',
    'test/contracts/exactTextApplyWithReceiptNextAdmission.contract.test.js',
    'test/contracts/exactTextApplyWithReceiptNextContourAdmission.contract.test.js',
    'test/contracts/exactTextApplyWithReceiptPrivateContractBrief.contract.test.js',
    'test/contracts/exactTextApplyWithReceiptPrivateContractShape.contract.test.js',
    'test/contracts/exactTextApplyWithReceiptPrivatePortAdmission.contract.test.js',
    'test/contracts/exactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission.contract.test.js',
    'test/contracts/exactTextApplyWithReceiptProductPathImplementationOpeningAdmission.contract.test.js',
    'test/contracts/exactTextApplyWithReceiptPrivatePortImplementation.contract.test.js',
  ]);
  const allowlist = new Set([
    MODULE_BASENAME,
    'exactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission.mjs',
    'exactTextApplyWithReceiptProductPathImplementationOpeningAdmission.mjs',
    'exactTextApplyFixtureDurableReceiptPrototype.contract.test.js',
    'exactTextApplyInternalWritePrototype.contract.test.js',
    'exactTextApplyPrivateProductApplyReceipt.contract.test.js',
    'exactTextApplyPrivateProductApplyReceiptAdmission.contract.test.js',
    'exactTextApplyProductApplyAdmissionGate.contract.test.js',
    'exactTextApplyProductApplyReadinessReview.contract.test.js',
    'exactTextApplyProductStoragePrimitiveEvidence.contract.test.js',
    'exactTextApplyTestFixtureReceiptFile.contract.test.js',
    'exactTextApplyTestOnlyProductShapedStorageDryRun.contract.test.js',
    'exactTextApplyTestOnlyStoragePrimitiveExecutionHarness.contract.test.js',
    'exactTextApplyWithReceiptAdmission.contract.test.js',
    'exactTextApplyWithReceiptCloseout.contract.test.js',
    'exactTextApplyWithReceiptExecution.contract.test.js',
    'exactTextApplyWithReceiptNextAdmission.contract.test.js',
    'exactTextApplyWithReceiptNextContourAdmission.contract.test.js',
    'exactTextApplyWithReceiptPrivateContractBrief.contract.test.js',
    'exactTextApplyWithReceiptPrivateContractShape.contract.test.js',
    'exactTextApplyWithReceiptPrivatePortImplementation.contract.test.js',
    'exactTextApplyWithReceiptPrivatePortAdmission.contract.test.js',
    'exactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission.contract.test.js',
    'exactTextApplyWithReceiptProductPathImplementationOpeningAdmission.contract.test.js',
    TASK_BASENAME,
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_AND_NEXT_CONTOUR_PERMISSION_002E.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_IMPLEMENTATION_OPENING_ADMISSION_002F.md',
    'revision-bridge-pre-stage-00-admission-guard-state.mjs',
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
    'atomicWriteFile.mjs',
    'command-catalog.v1.mjs',
    'projectCommands.mjs',
    'hostilePackageGate.mjs',
  ]);
  assert.notDeepEqual(changedBasenames, [], '002D must have detectable changed scope');
  for (const changedPath of changedPaths) {
    assert.equal(allowedPaths.has(changedPath), true, `unexpected 002D changed path: ${changedPath}`);
  }
  for (const basename of changedBasenames) {
    assert.equal(allowlist.has(basename), true, `unexpected 002D changed basename: ${basename}`);
    assert.equal(denylist.has(basename), false, `denylisted 002D changed basename: ${basename}`);
  }

  const moduleText = sourceText('src', 'revisionBridge', MODULE_BASENAME);
  const importLines = moduleText.split(/\r?\n/u).filter((line) => line.startsWith('import '));
  assert.deepEqual(importLines, [
    "import { canonicalHash } from './reviewIrKernel.mjs';",
    "import { runExactTextApplyWithReceiptPrivatePortAdmission } from './exactTextApplyWithReceiptPrivatePortAdmission.mjs';",
  ]);
  const forbiddenPatterns = [
    /from\s+['"]node:fs/u,
    /from\s+['"]node:path/u,
    /from\s+['"]node:os/u,
    /from\s+['"][^'"]*backupManager[^'"]*['"]/u,
    /from\s+['"][^'"]*fileManager[^'"]*['"]/u,
    /from\s+['"][^'"]*atomicWriteFile[^'"]*['"]/u,
    /require\s*\(\s*['"][^'"]*backupManager[^'"]*['"]\s*\)/u,
    /require\s*\(\s*['"][^'"]*fileManager[^'"]*['"]\s*\)/u,
    /from\s+['"]electron['"]/u,
    /import\s*\(\s*['"]electron['"]\s*\)/u,
    /from\s+['"][^'"]*(?:main|preload|editor|command-catalog|projectCommands|runtimeBridge)[^'"]*['"]/u,
  ];
  for (const pattern of forbiddenPatterns) {
    assert.equal(pattern.test(moduleText), false, `forbidden 002D import pattern: ${pattern.source}`);
  }
});
