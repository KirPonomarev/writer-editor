const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'exactTextApplyWithReceiptProductShapedFixtureImplementation.mjs';
const SOURCE_002F_MODULE_BASENAME = 'exactTextApplyWithReceiptProductPathImplementationOpeningAdmission.mjs';
const SOURCE_002F_TEST_BASENAME = 'exactTextApplyWithReceiptProductPathImplementationOpeningAdmission.contract.test.js';
const TASK_BASENAME = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_002G.md';
const KERNEL_BASENAME = 'reviewIrKernel.mjs';

async function loadModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

async function load002FModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', SOURCE_002F_MODULE_BASENAME)).href);
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
    hashKind: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_SCENE_TEXT_HASH_V1_002G',
    text,
  });
}

function load002FTestHelpers() {
  const filename = path.join(process.cwd(), 'test', 'contracts', SOURCE_002F_TEST_BASENAME);
  const testSource = fs.readFileSync(filename, 'utf8');
  const factory = new Function(
    'require',
    'process',
    'console',
    '__dirname',
    '__filename',
    `${testSource}\nreturn { acceptedInput, ownerPacket002F };`,
  );
  return factory(
    (specifier) => (specifier === 'node:test' ? () => undefined : require(specifier)),
    process,
    console,
    path.dirname(filename),
    filename,
  );
}

function ownerPacket002G(source002FBindingHash, overrides = {}) {
  return {
    packetKind: 'PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_OWNER_PACKET_002G',
    targetContour: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_002G',
    source002FBindingHash,
    ownerApprovesProductShapedFixtureImplementation002G: true,
    ownerUnderstandsProductShapedFixtureIsProofOnly: true,
    ownerUnderstandsNoRealProductWrite: true,
    ownerUnderstandsNoProductStorageAdmission: true,
    ownerUnderstandsNoProductApplyReceiptClaim: true,
    ownerUnderstandsNoApplyTxnRecoveryRelease: true,
    ownerUnderstandsNoPublicRuntimeOrSurface: true,
    ownerUnderstandsNoUiDocxNetworkDependency: true,
    ...overrides,
  };
}

function fixturePort(canonicalHash, request, overrides = {}) {
  return {
    privateProductShapedFixtureOnly: true,
    canReadScene: true,
    canWriteFixtureBackup: true,
    canAtomicWriteFixtureScene: true,
    canWritePrivateFixtureReceipt: true,
    canReadBackFixtureScene: true,
    canReadBackPrivateFixtureReceipt: true,
    canObserveFixtureCleanup: true,
    canReportFailureWithoutPartialSuccess: true,
    scene: {
      readSuccess: !overrides.readFails,
      projectId: overrides.projectId ?? request.projectId,
      sceneId: overrides.sceneId ?? request.sceneId,
      baselineHash: overrides.baselineHash ?? request.baselineHash,
      blockVersionHash: overrides.blockVersionHash ?? request.expectedBlockVersionHash,
      closedSession: overrides.closedSession === true,
      text: overrides.initialText ?? `alpha ${request.exactBeforeText} gamma`,
    },
    fixtureReceiptStore: {
      privateOnly: true,
    },
    fixtureBackupAccepted: !overrides.backupFails,
    fixtureAtomicWriteAccepted: !overrides.atomicFails,
    privateFixtureReceiptAccepted: !overrides.receiptFails,
    fixtureReadbackAccepted: true,
    fixtureReadbackText: overrides.readbackText,
    privateFixtureReceiptReadbackAccepted: !overrides.receiptReadbackFails,
    privateFixtureReceiptReadbackReceipt: overrides.receiptReadbackReceipt,
    fixtureCleanupObserved: overrides.cleanupObserved ?? true,
    ...overrides.portFields,
  };
}

async function acceptedInput(patch = {}, portOverrides = {}) {
  const helpers = load002FTestHelpers();
  const source002FInput = await helpers.acceptedInput();
  const { runExactTextApplyWithReceiptProductPathImplementationOpeningAdmission } = await load002FModule();
  const source002FResult = runExactTextApplyWithReceiptProductPathImplementationOpeningAdmission(source002FInput);
  const { canonicalHash } = await loadKernel();
  const source002FBinding = {
    bindingKind: 'SOURCE_002F_IMMUTABLE_MODULE_BINDING_V1_002G',
    sourceContour: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_IMPLEMENTATION_OPENING_ADMISSION_002F',
    moduleBasename: SOURCE_002F_MODULE_BASENAME,
    moduleTextHash: 'be27c62ee475933a89141ae92aa9a91efdfa5989422f5afb69df9ec6750263e8',
    recomputedModuleTextHash: canonicalHash({
      artifactKind: 'SOURCE_002F_MODULE_TEXT_HASH_002G',
      text: sourceText('src', 'revisionBridge', SOURCE_002F_MODULE_BASENAME),
    }),
    contractTestBasename: SOURCE_002F_TEST_BASENAME,
    contractTextHash: '4abee4b28a97f7e45c06a60aa86b785afac39ec20d8b8bc66be6c30d8d30a2ad',
    recomputedContractTextHash: canonicalHash({
      artifactKind: 'SOURCE_002F_CONTRACT_TEXT_HASH_002G',
      text: sourceText('test', 'contracts', SOURCE_002F_TEST_BASENAME),
    }),
    bindingHeadSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: process.cwd(), encoding: 'utf8' }).trim(),
    sourceLocked: true,
  };
  assert.equal(source002FBinding.moduleTextHash, source002FBinding.recomputedModuleTextHash);
  assert.equal(source002FBinding.contractTextHash, source002FBinding.recomputedContractTextHash);
  delete source002FBinding.recomputedModuleTextHash;
  delete source002FBinding.recomputedContractTextHash;
  const source002FBindingHash = canonicalHash(source002FBinding);
  const exactBeforeText = 'beta';
  const replacementText = 'delta';
  const beforeText = `alpha ${exactBeforeText} gamma`;
  const exactAfterText = `alpha ${replacementText} gamma`;
  const exactTextApplyRequest = {
    projectId: 'project-002g',
    sceneId: 'scene-002g',
    baselineHash: canonicalHash({ baseline: 'fresh-002g' }),
    beforeSceneHash: sceneTextHash(canonicalHash, beforeText),
    expectedBlockVersionHash: canonicalHash({ block: 'version-002g' }),
    exactBeforeText,
    exactAfterText,
    replacementText,
    receiptNonce: 'receipt-nonce-002g',
    requestedAt: '2026-05-01T00:00:00.000Z',
    noStructuralScope: true,
    noCommentScope: true,
    singleSceneOnly: true,
  };
  const base = {
    source002FResult,
    source002FResultHash: source002FResult.canonicalHash,
    source002FDecisionHash: source002FResult.decisions[0].canonicalHash,
    source002EReceiptHashFrom002F: source002FResult.source002DReceiptHashFrom002E,
    source002FRevalidationInput: await helpers.acceptedInput(),
    source002FBinding,
    source002FBindingHash,
    ownerProductShapedFixtureImplementationPacket002G: ownerPacket002G(source002FBindingHash),
    exactTextApplyRequest,
  };
  return {
    ...base,
    injectedPrivateProductShapedFixturePort: fixturePort(canonicalHash, exactTextApplyRequest, portOverrides),
    ...patch,
  };
}

test('002G executes private product-shaped fixture only after accepted 002F chain and owner packet', async () => {
  const { runExactTextApplyWithReceiptProductShapedFixtureImplementation } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const input = await acceptedInput();
  const result = runExactTextApplyWithReceiptProductShapedFixtureImplementation(input);

  assert.equal(result.resultKind, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_RESULT_002G');
  assert.equal(result.outputDecision, 'PRIVATE_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_EXECUTED_NO_PUBLIC_RUNTIME');
  assert.equal(result.source002FAccepted, true);
  assert.equal(result.source002FRevalidated, true);
  assert.equal(result.source002FRevalidationMatched, true);
  assert.equal(result.ownerPacketAccepted, true);
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
  assert.equal(result.realUserProjectMutated, false);
  assert.equal(result.userProjectMutated, false);
  assert.equal(result.productWritePerformed, false);
  assert.equal(result.productStorageAdmitted, false);
  assert.equal(result.productStorageAdmission, false);
  assert.equal(result.productApplyReceiptImplemented, false);
  assert.equal(result.productApplyReceiptClaimed, false);
  assert.equal(result.applyTxnImplemented, false);
  assert.equal(result.recoveryClaimed, false);
  assert.equal(result.releaseClaimed, false);
  assert.equal(result.publicRuntimeAdmitted, false);
  assert.equal(result.productPathPubliclyAdmitted, false);
  assert.equal(result.receipt.receiptKind, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_RECEIPT_V1_002G');
  assert.equal(result.receipt.receiptCanonicalHash, canonicalHash(withoutHash(result.receipt, 'receiptCanonicalHash')));
  assert.equal(result.decisions[0].decisionKind, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_DECISION_002G');
  assert.equal(result.decisions[0].outputDecision, 'PRIVATE_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_EXECUTED_NO_PUBLIC_RUNTIME');
  assert.equal(result.decisions[0].productWriteCount, 0);
  assert.equal(result.decisions[0].fixtureWriteCount, 1);
  assert.equal(result.decisions[0].fixtureReceiptCount, 1);
  assert.deepEqual(result.blockedReasons, []);
  assert.equal(result.nextFixtureScene.text, input.exactTextApplyRequest.exactAfterText);
  assert.equal(result.privateFixtureReceiptWrite.receiptCanonicalHash, result.receipt.receiptCanonicalHash);
  assert.equal(result.canonicalHash, canonicalHash(withoutHash(result)));
});

test('002G blocks missing mismatched synthetic and forged 002F evidence', async () => {
  const {
    runExactTextApplyWithReceiptProductShapedFixtureImplementation,
    EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES,
  } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const base = await acceptedInput();
  const blocked002F = withCanonicalHash(canonicalHash, {
    ...withoutHash(base.source002FResult),
    outputDecision: 'PRODUCT_PATH_IMPLEMENTATION_REMAINS_BLOCKED',
    blockedReasons: ['BLOCKED'],
    decisions: [],
  });
  const synthetic002F = withCanonicalHash(canonicalHash, {
    ...withoutHash(base.source002FResult),
    source002ERevalidated: false,
    source002ERevalidationMatched: false,
    exitPacket: {
      ...base.source002FResult.exitPacket,
      source002ERevalidated: false,
      source002ERevalidationMatched: false,
    },
  });
  const forged002F = withCanonicalHash(canonicalHash, {
    ...withoutHash(base.source002FResult),
    source002DReceiptHashFrom002E: canonicalHash({ forged: '002e-receipt-hash' }),
  });
  const cases = [
    { patch: { source002FResult: null }, code: 'SOURCE_002F_RESULT_REQUIRED' },
    { patch: { source002FResultHash: canonicalHash({ wrong: '002f-result' }) }, code: 'SOURCE_002F_RESULT_HASH_MISMATCH' },
    { patch: { source002FDecisionHash: canonicalHash({ wrong: '002f-decision' }) }, code: 'SOURCE_002F_DECISION_HASH_MISMATCH' },
    { patch: { source002EReceiptHashFrom002F: canonicalHash({ wrong: '002e-receipt' }) }, code: 'SOURCE_002F_CHAIN_HASH_MISMATCH' },
    { patch: { source002FResult: blocked002F, source002FResultHash: blocked002F.canonicalHash, source002FDecisionHash: '' }, code: 'SOURCE_002F_BLOCKED' },
    { patch: { source002FRevalidationInput: null }, code: 'SOURCE_002F_REVALIDATION_INPUT_REQUIRED' },
    { patch: { source002FBinding: null }, code: 'SOURCE_002F_BINDING_REQUIRED' },
    { patch: { source002FBindingHash: canonicalHash({ wrong: '002f-binding' }) }, code: 'SOURCE_002F_BINDING_HASH_MISMATCH' },
    {
      patch: {
        source002FBinding: {
          ...base.source002FBinding,
          moduleTextHash: canonicalHash({ fake: 'module' }),
          contractTextHash: canonicalHash({ fake: 'contract' }),
        },
      },
      code: 'SOURCE_002F_BINDING_HASH_MISMATCH',
    },
    { patch: { source002FResult: synthetic002F, source002FResultHash: synthetic002F.canonicalHash }, code: 'SYNTHETIC_002F_WITHOUT_CHAIN' },
    {
      patch: {
        source002FResult: forged002F,
        source002FResultHash: forged002F.canonicalHash,
        source002EReceiptHashFrom002F: forged002F.source002DReceiptHashFrom002E,
      },
      code: 'FORGED_SELF_CONSISTENT_002F_FORBIDDEN',
    },
  ];

  for (const item of cases) {
    const result = runExactTextApplyWithReceiptProductShapedFixtureImplementation({ ...base, ...item.patch });
    assert.equal(result.outputDecision, 'PRIVATE_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_BLOCKED');
    assert.equal(result.fixtureWriteCount, 0);
    assert.equal(result.fixtureReceiptCount, 0);
    assert.equal(result.productWriteCount, 0);
    assert.equal(result.productPathPubliclyAdmitted, false);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES[item.code]), true, item.code);
  }
});

test('002G owner request and direct claims reject unsafe path callables and product/public overclaims', async () => {
  const {
    runExactTextApplyWithReceiptProductShapedFixtureImplementation,
    EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES,
  } = await loadModule();
  const base = await acceptedInput();
  const cases = [
    { patch: { ownerProductShapedFixtureImplementationPacket002G: null }, code: 'OWNER_PACKET_REQUIRED' },
    { patch: { ownerProductShapedFixtureImplementationPacket002G: ownerPacket002G(base.source002FBindingHash, { packetKind: 'WRONG_PACKET' }) }, code: 'OWNER_PACKET_INVALID' },
    { patch: { ownerProductShapedFixtureImplementationPacket002G: ownerPacket002G(base.source002FBindingHash, { targetContour: 'WRONG_TARGET' }) }, code: 'OWNER_PACKET_TARGET_MISMATCH' },
    { patch: { ownerProductShapedFixtureImplementationPacket002G: ownerPacket002G('wrong-binding-hash') }, code: 'SOURCE_002F_BINDING_HASH_MISMATCH' },
    { patch: { ownerProductShapedFixtureImplementationPacket002G: ownerPacket002G(base.source002FBindingHash, { ownerUnderstandsNoRealProductWrite: false }) }, code: 'OWNER_POLICY_MISSING' },
    { patch: { ownerProductShapedFixtureImplementationPacket002G: ownerPacket002G(base.source002FBindingHash, { surpriseField: true }) }, code: 'OWNER_PACKET_UNKNOWN_FIELD_FORBIDDEN' },
    { patch: { ownerProductShapedFixtureImplementationPacket002G: ownerPacket002G(base.source002FBindingHash, { callable: () => null }) }, code: 'CALLABLE_FIELD_FORBIDDEN' },
    { patch: { ownerProductShapedFixtureImplementationPacket002G: ownerPacket002G(base.source002FBindingHash, { userProjectPath: '/tmp/user' }) }, code: 'USER_PROJECT_PATH_FORBIDDEN' },
    { patch: { productStorageAdmitted: true }, code: 'PRODUCT_STORAGE_ADMISSION_FORBIDDEN' },
    { patch: { productApplyReceiptClaimed: true }, code: 'PRODUCT_APPLYRECEIPT_CLAIM_FORBIDDEN' },
    { patch: { publicRuntimeAdmitted: true }, code: 'PUBLIC_RUNTIME_FORBIDDEN' },
    { patch: { uiChanged: true }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { docxImportClaimed: true }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { networkUsed: true }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { dependencyChanged: true }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { applyTxnImplemented: true }, code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { patch: { recoveryClaimed: true }, code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { patch: { releaseClaimed: true }, code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { patch: { userProjectPath: '/tmp/user' }, code: 'USER_PROJECT_PATH_FORBIDDEN' },
    { patch: { callNow: () => null }, code: 'CALLABLE_FIELD_FORBIDDEN' },
    { patch: { productWritePerformed: true }, code: 'PRODUCT_WRITE_FORBIDDEN' },
  ];

  for (const item of cases) {
    const result = runExactTextApplyWithReceiptProductShapedFixtureImplementation({ ...base, ...item.patch });
    assert.equal(result.outputDecision, 'PRIVATE_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_BLOCKED');
    assert.equal(result.fixtureWriteCount, 0);
    assert.equal(result.productWriteCount, 0);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES[item.code]), true, item.code);
  }
});

test('002G blocks wrong project scene stale closed exact guard duplicate structural and comment scope failures', async () => {
  const {
    runExactTextApplyWithReceiptProductShapedFixtureImplementation,
    EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES,
  } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const base = await acceptedInput();
  const cases = [
    { port: { projectId: 'wrong-project' }, code: 'WRONG_PROJECT' },
    { port: { sceneId: 'wrong-scene' }, code: 'WRONG_SCENE' },
    { port: { baselineHash: canonicalHash({ stale: true }) }, code: 'STALE_BASELINE' },
    { port: { closedSession: true }, code: 'CLOSED_SESSION' },
    { port: { blockVersionHash: canonicalHash({ block: 'wrong' }) }, code: 'BLOCK_VERSION_HASH_MISMATCH' },
    { port: { initialText: 'alpha xxx gamma' }, code: 'EXACT_TEXT_NOT_FOUND' },
    { port: { initialText: 'alpha beta gamma beta' }, code: 'EXACT_TEXT_NOT_UNIQUE' },
    { request: { noStructuralScope: false }, code: 'UNSUPPORTED_SCOPE_FORBIDDEN' },
    { request: { noCommentScope: false }, code: 'UNSUPPORTED_SCOPE_FORBIDDEN' },
    { request: { singleSceneOnly: false }, code: 'UNSUPPORTED_SCOPE_FORBIDDEN' },
    { request: { exactAfterText: 'alpha zeta gamma' }, code: 'EXACT_TEXT_GUARD_FAILED' },
  ];

  for (const item of cases) {
    const input = await acceptedInput(
      item.request ? { exactTextApplyRequest: { ...base.exactTextApplyRequest, ...item.request } } : {},
      item.port || {},
    );
    const result = runExactTextApplyWithReceiptProductShapedFixtureImplementation(input);
    assert.equal(result.outputDecision, 'PRIVATE_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_BLOCKED');
    assert.equal(result.fixtureWriteCount, 0);
    assert.equal(result.fixtureReceiptCount, 0);
    assert.equal(result.productWriteCount, 0);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES[item.code]), true, item.code);
  }
});

test('002G blocks injected fixture port failures before claiming success', async () => {
  const {
    runExactTextApplyWithReceiptProductShapedFixtureImplementation,
    EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES,
  } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const base = await acceptedInput();
  const cases = [
    { patch: { injectedPrivateProductShapedFixturePort: null }, code: 'INJECTED_PRIVATE_PRODUCT_SHAPED_FIXTURE_PORT_REQUIRED' },
    { patch: { injectedPrivateProductShapedFixturePort: { privateProductShapedFixtureOnly: true } }, code: 'INJECTED_PRIVATE_PRODUCT_SHAPED_FIXTURE_PORT_REQUIRED' },
    {
      port: { portFields: { productRoot: '/tmp/user' } },
      code: 'USER_PROJECT_PATH_FORBIDDEN',
    },
    {
      port: { portFields: { scenePath: '/tmp/user-scene' } },
      code: 'USER_PROJECT_PATH_FORBIDDEN',
    },
    {
      port: { portFields: { filePath: '/tmp/user-file' } },
      code: 'USER_PROJECT_PATH_FORBIDDEN',
    },
    {
      port: { portFields: { scene: { ...base.injectedPrivateProductShapedFixturePort.scene, userProjectRoot: '/tmp/user-root' } } },
      code: 'USER_PROJECT_PATH_FORBIDDEN',
    },
    {
      port: { portFields: { fixtureReceiptStore: { privateOnly: true, repoRoot: '/tmp/repo' } } },
      code: 'USER_PROJECT_PATH_FORBIDDEN',
    },
    {
      port: { portFields: { atomicWriteFixtureScene: () => null } },
      code: 'CALLABLE_FIELD_FORBIDDEN',
    },
    {
      port: { portFields: { publicRuntimeAdmitted: true } },
      code: 'PUBLIC_RUNTIME_FORBIDDEN',
    },
    { port: { readFails: true }, code: 'SCENE_READ_FAILED' },
    { port: { backupFails: true }, code: 'FIXTURE_BACKUP_WRITE_FAILED' },
    { port: { atomicFails: true }, code: 'FIXTURE_ATOMIC_WRITE_FAILED' },
    { port: { receiptFails: true }, code: 'PRIVATE_FIXTURE_RECEIPT_WRITE_FAILED' },
    { port: { readbackText: 'corrupted' }, code: 'READBACK_MISMATCH' },
    {
      port: { receiptReadbackReceipt: { receiptKind: 'BROKEN', receiptCanonicalHash: canonicalHash({ broken: true }) } },
      code: 'READBACK_MISMATCH',
    },
    { port: { cleanupObserved: false }, code: 'FIXTURE_CLEANUP_NOT_OBSERVED' },
  ];

  for (const item of cases) {
    const input = item.patch
      ? await acceptedInput(item.patch)
      : await acceptedInput({}, item.port || {});
    const result = runExactTextApplyWithReceiptProductShapedFixtureImplementation(input);
    assert.equal(result.outputDecision, 'PRIVATE_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_BLOCKED');
    assert.equal(result.fixtureWriteCount, 0);
    assert.equal(result.fixtureReceiptCount, 0);
    assert.equal(result.productWriteCount, 0);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_REASON_CODES[item.code]), true, item.code);
  }
});

test('002G task record preserves private product-shaped fixture proof-only boundary', () => {
  const taskText = sourceText('docs', 'tasks', TASK_BASENAME);
  assert.match(taskText, /TASK_ID: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_002G/u);
  assert.match(taskText, /CONTOUR_TYPE: PRIVATE_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_PROOF_ONLY/u);
  assert.match(taskText, /PREVIOUS_CONTOUR: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_IMPLEMENTATION_OPENING_ADMISSION_002F/u);
  assert.match(taskText, /SUCCESS_DECISION: PRIVATE_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_EXECUTED_NO_PUBLIC_RUNTIME/u);
  assert.match(taskText, /REAL_USER_PROJECT_MUTATED_FALSE/u);
  assert.match(taskText, /PRODUCT_WRITE_PERFORMED_FALSE/u);
  assert.match(taskText, /PRODUCT_STORAGE_ADMISSION_FALSE/u);
  assert.match(taskText, /PUBLIC_RUNTIME_ADMITTED_FALSE/u);
  assert.match(taskText, /FIXTURE_WRITE_COUNT_ONE/u);
  assert.match(taskText, /FIXTURE_RECEIPT_COUNT_ONE/u);
  assert.doesNotMatch(taskText, /public runtime admitted true|product write ready|release green/iu);
});

test('002G changed scope stays allowlisted and module has no direct storage runtime or UI imports', () => {
  const changedPaths = [
    ...gitLines(['diff', '--name-only', 'HEAD']),
    ...gitLines(['diff', '--cached', '--name-only']),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ].sort();
  const changedBasenames = changedBasenamesForCurrentContour();
  const allowedPaths = new Set([
    'docs/tasks/PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_SHAPED_FIXTURE_IMPLEMENTATION_002G.md',
    'scripts/ops/revision-bridge-pre-stage-00-admission-guard-state.mjs',
    'src/revisionBridge/exactTextApplyWithReceiptProductShapedFixtureImplementation.mjs',
    'test/contracts/exactTextApplyWithReceiptProductShapedFixtureImplementation.contract.test.js',
  ]);
  const allowlist = new Set(Array.from(allowedPaths, (allowedPath) => path.basename(allowedPath)));
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
  assert.notDeepEqual(changedBasenames, [], '002G must have detectable changed scope');
  for (const changedPath of changedPaths) {
    assert.equal(allowedPaths.has(changedPath), true, `unexpected 002G changed path: ${changedPath}`);
  }
  for (const basename of changedBasenames) {
    assert.equal(allowlist.has(basename), true, `unexpected 002G changed basename: ${basename}`);
    assert.equal(denylist.has(basename), false, `denylisted 002G changed basename: ${basename}`);
  }

  const moduleText = sourceText('src', 'revisionBridge', MODULE_BASENAME);
  const importLines = moduleText.split(/\r?\n/u).filter((line) => line.startsWith('import '));
  assert.deepEqual(importLines, [
    "import { canonicalHash } from './reviewIrKernel.mjs';",
    "import { runExactTextApplyWithReceiptProductPathImplementationOpeningAdmission } from './exactTextApplyWithReceiptProductPathImplementationOpeningAdmission.mjs';",
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
    /require\s*\(\s*['"][^'"]*atomicWriteFile[^'"]*['"]\s*\)/u,
    /import\s*\(\s*['"][^'"]*(?:backupManager|fileManager|atomicWriteFile|electron)[^'"]*['"]\s*\)/u,
    /from\s+['"]electron['"]/u,
    /from\s+['"][^'"]*(?:main|preload|editor|command-catalog|projectCommands|runtimeBridge)[^'"]*['"]/u,
  ];
  for (const pattern of forbiddenPatterns) {
    assert.equal(pattern.test(moduleText), false, `forbidden 002G import pattern: ${pattern.source}`);
  }
});
