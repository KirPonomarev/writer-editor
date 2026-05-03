const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'exactTextApplyWithReceiptPrivateControlledStorageFixturePortProof.mjs';
const SOURCE_002G_MODULE_BASENAME = 'exactTextApplyWithReceiptProductShapedFixtureImplementation.mjs';
const SOURCE_002G_TEST_BASENAME = 'exactTextApplyWithReceiptProductShapedFixtureImplementation.contract.test.js';
const TASK_BASENAME = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_ONLY_002J.md';
const KERNEL_BASENAME = 'reviewIrKernel.mjs';
const SOURCE_002I_BASE_SHA = 'd29254664a05fdc2943ad37f7ea22b55474e7f17';

async function loadModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

async function load002GModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', SOURCE_002G_MODULE_BASENAME)).href);
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

function load002GTestHelpers() {
  const filename = path.join(process.cwd(), 'test', 'contracts', SOURCE_002G_TEST_BASENAME);
  const testSource = fs.readFileSync(filename, 'utf8');
  const factory = new Function(
    'require',
    'process',
    'console',
    '__dirname',
    '__filename',
    `${testSource}\nreturn { acceptedInput, ownerPacket002G };`,
  );
  return factory(
    (specifier) => (specifier === 'node:test' ? () => undefined : require(specifier)),
    process,
    console,
    path.dirname(filename),
    filename,
  );
}

function sceneTextHash(canonicalHash, text) {
  return canonicalHash({
    hashKind: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_SCENE_TEXT_HASH_V1_002J',
    text,
  });
}

function ownerPacket002J(source002GResultHash, source002IReportBindingHash, overrides = {}) {
  return {
    packetKind: 'PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_OWNER_PACKET_002J',
    targetContour: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_ONLY_002J',
    source002GBindingHash: source002GResultHash,
    source002IReportBindingHash,
    ownerApprovesPrivateControlledStorageFixturePortProof002J: true,
    ownerUnderstandsPrivateReceiptOnly: true,
    ownerUnderstandsNoUserProjectMutation: true,
    ownerUnderstandsNoProductStorageAdmission: true,
    ownerUnderstandsNoProductApplyReceipt: true,
    ownerUnderstandsNoPublicRuntimeOrSurface: true,
    ownerUnderstandsNoUiDocxNetworkDependency: true,
    ownerUnderstandsNoApplyTxnRecoveryRelease: true,
    ...overrides,
  };
}

function fixturePort(request, overrides = {}) {
  const state = {
    text: overrides.initialText ?? `alpha ${request.exactBeforeText} gamma`,
    receipt: null,
  };
  return {
    privateControlledStorageFixtureOnly: true,
    boundedFixtureRoot: true,
    fixtureRootControlledByTest: true,
    insideTempFixtureRoot: true,
    storePrivateOnly: true,
    canReadScene: true,
    canWriteBackup: true,
    canAtomicWriteScene: true,
    canReadBackScene: true,
    canWritePrivateReceipt: true,
    canReadBackPrivateReceipt: true,
    canReportFailureWithoutPartialSuccess: true,
    fixtureRootPolicy: {
      controlledByTest: true,
      insideTempRoot: true,
      boundedFixtureRoot: true,
      userProjectPathAllowed: false,
      absolutePathAllowed: false,
      privateReceiptOnly: true,
    },
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
      return { success: true };
    },
    atomicWriteScene(payload) {
      if (overrides.atomicFails) {
        return { success: false, error: 'atomic write failed' };
      }
      state.text = payload.nextText;
      return { success: true };
    },
    readBackScene() {
      return {
        success: !overrides.readbackFails,
        text: overrides.readbackText ?? state.text,
      };
    },
    writePrivateReceipt(payload) {
      if (overrides.receiptWriteFails) {
        return { success: false, error: 'receipt write failed' };
      }
      state.receipt = payload.receipt;
      return { success: true };
    },
    readBackPrivateReceipt() {
      return {
        success: !overrides.receiptReadbackFails,
        receipt: overrides.receiptReadbackReceipt ?? state.receipt,
      };
    },
    ...overrides.portFields,
  };
}

async function acceptedSource002IReportBinding() {
  const { canonicalHash } = await loadKernel();
  const source002IReportBinding = {
    bindingKind: 'SOURCE_002I_REPORT_BINDING_V1_002J',
    sourceContour: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_STORAGE_PORT_ADMISSION_BRIEF_ONLY_002I',
    sourceMode: 'CHAT_REPORT_ONLY',
    ownerAcceptedChatReport: true,
    selectedBaseSha: SOURCE_002I_BASE_SHA,
    reportDecision: 'OWNER_HAS_SUFFICIENT_REPORT_TO_DECIDE_WHETHER_TO_OPEN_002J',
    storageAdmissionGranted: false,
    productWriteReady: false,
    productApplyReceiptReady: false,
    recoveryReady: false,
    releaseGreen: false,
    nextContourOpened: false,
    source002GMergeCommitSha: SOURCE_002I_BASE_SHA,
  };
  return {
    source002IReportBinding,
    source002IReportBindingHash: canonicalHash(source002IReportBinding),
  };
}

async function acceptedSource002G() {
  const helpers = load002GTestHelpers();
  const { runExactTextApplyWithReceiptProductShapedFixtureImplementation } = await load002GModule();
  const source002GInputForResult = await helpers.acceptedInput();
  const source002GResult = runExactTextApplyWithReceiptProductShapedFixtureImplementation(source002GInputForResult);
  const source002GRevalidationInput = await helpers.acceptedInput();
  return {
    source002GResult,
    source002GResultHash: source002GResult.canonicalHash,
    source002GDecisionHash: source002GResult.decisions[0].canonicalHash,
    source002GRevalidationInput,
  };
}

async function acceptedInput(patch = {}, portOverrides = {}) {
  const { canonicalHash } = await loadKernel();
  const source002G = await acceptedSource002G();
  const source002I = await acceptedSource002IReportBinding();
  const exactBeforeText = 'beta';
  const replacementText = 'delta';
  const beforeText = `alpha ${exactBeforeText} gamma`;
  const exactAfterText = `alpha ${replacementText} gamma`;
  const request = {
    projectId: 'project-002j',
    sceneId: 'scene-002j',
    baselineHash: canonicalHash({ baseline: 'fresh-002j' }),
    beforeSceneHash: sceneTextHash(canonicalHash, beforeText),
    expectedBlockVersionHash: canonicalHash({ block: 'version-002j' }),
    exactBeforeText,
    exactAfterText,
    replacementText,
    receiptNonce: 'receipt-nonce-002j',
    requestedAt: '2026-05-03T00:00:00.000Z',
    noStructuralScope: true,
    noCommentScope: true,
    singleSceneOnly: true,
  };
  const base = {
    ...source002G,
    ...source002I,
    exactTextApplyRequest: request,
  };
  return {
    ...base,
    ownerPrivateControlledStorageFixturePortProofPacket002J: ownerPacket002J(
      base.source002GResultHash,
      base.source002IReportBindingHash,
    ),
    injectedPrivateControlledStorageFixturePort: fixturePort(request, portOverrides),
    ...patch,
  };
}

test('002J executes private controlled storage fixture port proof and emits private receipt', async () => {
  const { runExactTextApplyWithReceiptPrivateControlledStorageFixturePortProof } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const input = await acceptedInput();
  const result = runExactTextApplyWithReceiptPrivateControlledStorageFixturePortProof(input);

  assert.equal(result.resultKind, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_RESULT_002J');
  assert.equal(result.outputDecision, 'PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_EXECUTED');
  assert.equal(result.source002GAccepted, true);
  assert.equal(result.source002GRevalidated, true);
  assert.equal(result.source002IReportBindingAccepted, true);
  assert.equal(result.ownerPacketAccepted, true);
  assert.equal(result.injectedPortAccepted, true);
  assert.equal(result.exactTextGuardPassed, true);
  assert.equal(result.backupWritten, true);
  assert.equal(result.atomicWriteExecuted, true);
  assert.equal(result.readbackMatched, true);
  assert.equal(result.privateReceiptWritten, true);
  assert.equal(result.fixtureWriteCount, 1);
  assert.equal(result.fixtureReceiptCount, 1);
  assert.equal(result.productWriteCount, 0);
  assert.equal(result.publicSurfaceCount, 0);
  assert.equal(result.userProjectMutated, false);
  assert.equal(result.productStorageAdmission, false);
  assert.equal(result.publicRuntimeAdmitted, false);
  assert.equal(result.applyTxnImplemented, false);
  assert.equal(result.recoveryClaimed, false);
  assert.equal(result.recoveryReady, false);
  assert.equal(result.crashRecovery, false);
  assert.equal(result.releaseClaimed, false);
  assert.equal(result.releaseGreen, false);
  assert.equal(result.receipt.receiptKind, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_RECEIPT_V1_002J');
  assert.equal(result.receipt.receiptCanonicalHash, canonicalHash(withoutHash(result.receipt, 'receiptCanonicalHash')));
  assert.equal(result.decisions[0].decisionKind, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_DECISION_002J');
  assert.deepEqual(result.blockedReasons, []);
});

test('002J blocks missing owner packet and missing or forged 002I source binding', async () => {
  const {
    runExactTextApplyWithReceiptPrivateControlledStorageFixturePortProof,
    EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES,
  } = await loadModule();
  const base = await acceptedInput();
  const missingOwner = runExactTextApplyWithReceiptPrivateControlledStorageFixturePortProof({
    ...base,
    ownerPrivateControlledStorageFixturePortProofPacket002J: null,
  });
  assert.equal(missingOwner.outputDecision, 'PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_BLOCKED');
  assert.equal(missingOwner.blockedReasons.includes(
    EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.OWNER_PACKET_REQUIRED,
  ), true);

  const missingSourceBinding = runExactTextApplyWithReceiptPrivateControlledStorageFixturePortProof({
    ...base,
    source002IReportBinding: null,
    source002IReportBindingHash: '',
  });
  assert.equal(missingSourceBinding.outputDecision, 'PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_BLOCKED');
  assert.equal(missingSourceBinding.blockedReasons.includes(
    EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.SOURCE_002I_REPORT_BINDING_REQUIRED,
  ), true);

  const forgedSourceBinding = runExactTextApplyWithReceiptPrivateControlledStorageFixturePortProof({
    ...base,
    source002IReportBinding: {
      ...base.source002IReportBinding,
      source002GMergeCommitSha: 'ffffffffffffffffffffffffffffffffffffffff',
    },
  });
  assert.equal(forgedSourceBinding.outputDecision, 'PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_BLOCKED');
  assert.equal(forgedSourceBinding.blockedReasons.includes(
    EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.SOURCE_002I_REPORT_BINDING_HASH_MISMATCH,
  ) || forgedSourceBinding.blockedReasons.includes(
    EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.SOURCE_002I_REPORT_BINDING_INVALID,
  ), true);
});

test('002J blocks wrong project closed session stale baseline block version exact-not-found and duplicate exact', async () => {
  const {
    runExactTextApplyWithReceiptPrivateControlledStorageFixturePortProof,
    EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES,
  } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const base = await acceptedInput();
  const cases = [
    { port: { projectId: 'wrong-project' }, code: 'WRONG_PROJECT' },
    { port: { closedSession: true }, code: 'CLOSED_SESSION' },
    { port: { baselineHash: canonicalHash({ stale: true }) }, code: 'STALE_BASELINE' },
    { port: { blockVersionHash: canonicalHash({ block: 'wrong' }) }, code: 'BLOCK_VERSION_HASH_MISMATCH' },
    { port: { initialText: 'alpha zeta gamma' }, code: 'EXACT_TEXT_NOT_FOUND' },
    { port: { initialText: 'alpha beta gamma beta' }, code: 'EXACT_TEXT_NOT_UNIQUE' },
  ];
  for (const item of cases) {
    const input = await acceptedInput({}, item.port);
    const result = runExactTextApplyWithReceiptPrivateControlledStorageFixturePortProof(input);
    assert.equal(result.outputDecision, 'PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_BLOCKED');
    assert.equal(result.fixtureWriteCount, 0);
    assert.equal(result.blockedReasons.includes(
      EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES[item.code],
    ), true, item.code);
  }

  const wrongScene = runExactTextApplyWithReceiptPrivateControlledStorageFixturePortProof({
    ...base,
    injectedPrivateControlledStorageFixturePort: fixturePort(base.exactTextApplyRequest, { sceneId: 'wrong-scene' }),
  });
  assert.equal(wrongScene.blockedReasons.includes(
    EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES.WRONG_SCENE,
  ), true);
});

test('002J blocks user paths absolute paths and unvalidated callbacks', async () => {
  const {
    runExactTextApplyWithReceiptPrivateControlledStorageFixturePortProof,
    EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES,
  } = await loadModule();
  const base = await acceptedInput();
  const cases = [
    { patch: { userProjectPath: '/tmp/user' }, code: 'USER_PROJECT_PATH_FORBIDDEN' },
    { patch: { anyAbsolutePath: '/tmp/absolute' }, code: 'ABSOLUTE_PATH_FORBIDDEN' },
    { patch: { callback: () => null }, code: 'UNVALIDATED_CALLBACK_FORBIDDEN' },
    {
      patch: {
        injectedPrivateControlledStorageFixturePort: {
          ...base.injectedPrivateControlledStorageFixturePort,
          portFields: undefined,
          userProjectPath: '/tmp/user',
        },
      },
      code: 'USER_PROJECT_PATH_FORBIDDEN',
    },
  ];
  for (const item of cases) {
    const result = runExactTextApplyWithReceiptPrivateControlledStorageFixturePortProof({ ...base, ...item.patch });
    assert.equal(result.outputDecision, 'PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_BLOCKED');
    assert.equal(result.blockedReasons.includes(
      EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES[item.code],
    ), true, item.code);
  }
});

test('002J blocks runtime storage applytxn recovery release ui docx network dependency and receipt claims', async () => {
  const {
    runExactTextApplyWithReceiptPrivateControlledStorageFixturePortProof,
    EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES,
  } = await loadModule();
  const base = await acceptedInput();
  const cases = [
    { patch: { publicRuntimeAdmitted: true }, code: 'PUBLIC_RUNTIME_FORBIDDEN' },
    { patch: { productStorageAdmission: true }, code: 'PRODUCT_STORAGE_ADMISSION_FORBIDDEN' },
    { patch: { productApplyReceiptClaimed: true }, code: 'PRODUCT_APPLYRECEIPT_CLAIM_FORBIDDEN' },
    { patch: { applyTxnImplemented: true }, code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { patch: { recoveryClaimed: true }, code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { patch: { releaseClaimed: true }, code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { patch: { uiChanged: true }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { docxImportClaimed: true }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { networkUsed: true }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { dependencyChanged: true }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
  ];
  for (const item of cases) {
    const result = runExactTextApplyWithReceiptPrivateControlledStorageFixturePortProof({ ...base, ...item.patch });
    assert.equal(result.outputDecision, 'PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_BLOCKED');
    assert.equal(result.blockedReasons.includes(
      EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES[item.code],
    ), true, item.code);
  }
});

test('002J blocks backup atomic readback and receipt write failures', async () => {
  const {
    runExactTextApplyWithReceiptPrivateControlledStorageFixturePortProof,
    EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES,
  } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const cases = [
    { port: { backupFails: true }, code: 'BACKUP_WRITE_FAILED' },
    { port: { atomicFails: true }, code: 'ATOMIC_WRITE_FAILED' },
    { port: { readbackText: 'wrong text' }, code: 'READBACK_MISMATCH' },
    { port: { receiptWriteFails: true }, code: 'PRIVATE_RECEIPT_WRITE_FAILED' },
    { port: { receiptReadbackReceipt: { receiptCanonicalHash: canonicalHash({ wrong: true }) } }, code: 'READBACK_MISMATCH' },
  ];
  for (const item of cases) {
    const input = await acceptedInput({}, item.port);
    const result = runExactTextApplyWithReceiptPrivateControlledStorageFixturePortProof(input);
    assert.equal(result.outputDecision, 'PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_BLOCKED');
    assert.equal(result.fixtureWriteCount, 0);
    assert.equal(result.fixtureReceiptCount, 0);
    assert.equal(result.blockedReasons.includes(
      EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_REASON_CODES[item.code],
    ), true, item.code);
  }
});

test('002J task record preserves proof-only boundary', () => {
  const taskText = sourceText('docs', 'tasks', TASK_BASENAME);
  assert.match(taskText, /TASK_ID: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_ONLY_002J/u);
  assert.match(taskText, /CONTOUR_TYPE: PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_ONLY/u);
  assert.match(taskText, /SOURCE_002G_RECHECK_REQUIRED: true/u);
  assert.match(taskText, /SOURCE_002I_BINDING_REQUIRED: true/u);
  assert.match(taskText, /SOURCE_002I_SOURCE_MODE: CHAT_REPORT_ONLY/u);
  assert.match(taskText, /PRIVATE_RECEIPT_ONLY: true/u);
  assert.match(taskText, /NO_PRODUCT_STORAGE_ADMISSION: true/u);
  assert.match(taskText, /NO_PUBLIC_RUNTIME: true/u);
  assert.doesNotMatch(taskText, /public runtime admitted true|product storage opened|release green/iu);
});

test('002J changed scope stays allowlisted and module has no direct fs or runtime surface imports', () => {
  const changedPaths = [
    ...gitLines(['diff', '--name-only', 'HEAD']),
    ...gitLines(['diff', '--cached', '--name-only']),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ].sort();
  const changedBasenames = changedBasenamesForCurrentContour();
  const allowedPaths = new Set([
    'docs/tasks/PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTROLLED_STORAGE_FIXTURE_PORT_PROOF_ONLY_002J.md',
    'scripts/ops/revision-bridge-pre-stage-00-admission-guard-state.mjs',
    'src/revisionBridge/exactTextApplyWithReceiptPrivateControlledStorageFixturePortProof.mjs',
    'test/contracts/exactTextApplyWithReceiptPrivateControlledStorageFixturePortProof.contract.test.js',
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
    'command-catalog.v1.mjs',
    'projectCommands.mjs',
    'hostilePackageGate.mjs',
    'fileManager.js',
    'backupManager.js',
    'atomicWriteFile.mjs',
  ]);
  assert.notDeepEqual(changedBasenames, [], '002J must have detectable changed scope');
  for (const changedPath of changedPaths) {
    assert.equal(allowedPaths.has(changedPath), true, `unexpected 002J changed path: ${changedPath}`);
  }
  for (const basename of changedBasenames) {
    assert.equal(allowlist.has(basename), true, `unexpected 002J changed basename: ${basename}`);
    assert.equal(denylist.has(basename), false, `denylisted 002J changed basename: ${basename}`);
  }

  const moduleText = sourceText('src', 'revisionBridge', MODULE_BASENAME);
  const importLines = moduleText.split(/\r?\n/u).filter((line) => line.startsWith('import '));
  assert.deepEqual(importLines, [
    "import { canonicalHash } from './reviewIrKernel.mjs';",
    "import { runExactTextApplyWithReceiptProductShapedFixtureImplementation } from './exactTextApplyWithReceiptProductShapedFixtureImplementation.mjs';",
  ]);
  const forbiddenPatterns = [
    /from\s+['"]node:fs/u,
    /from\s+['"]node:path/u,
    /from\s+['"]node:os/u,
    /from\s+['"]electron['"]/u,
    /from\s+['"][^'"]*(?:main|preload|editor|command-catalog|projectCommands|runtimeBridge)[^'"]*['"]/u,
    /from\s+['"][^'"]*(?:backupManager|fileManager|atomicWriteFile)[^'"]*['"]/u,
  ];
  for (const pattern of forbiddenPatterns) {
    assert.equal(pattern.test(moduleText), false, `forbidden 002J import pattern: ${pattern.source}`);
  }
});
