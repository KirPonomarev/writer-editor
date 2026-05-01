const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'exactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission.mjs';
const SOURCE_002D_MODULE_BASENAME = 'exactTextApplyWithReceiptPrivatePortImplementation.mjs';
const SOURCE_002D_TEST_BASENAME = 'exactTextApplyWithReceiptPrivatePortImplementation.contract.test.js';
const TASK_BASENAME = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_AND_NEXT_CONTOUR_PERMISSION_002E.md';
const KERNEL_BASENAME = 'reviewIrKernel.mjs';
const BINDING_HEAD_SHA = 'fbe8245c874a19bc7a10360fae23d9e140c7e480';

async function loadModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

async function load002DModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', SOURCE_002D_MODULE_BASENAME)).href);
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
    receiptCanonicalHash: canonicalHash(withoutHash(value, 'receiptCanonicalHash')),
  };
}

function load002DTestHelpers() {
  const filename = path.join(process.cwd(), 'test', 'contracts', SOURCE_002D_TEST_BASENAME);
  const testSource = fs.readFileSync(filename, 'utf8');
  const factory = new Function(
    'require',
    'process',
    'console',
    '__dirname',
    '__filename',
    `${testSource}\nreturn { acceptedInput, ownerPacket002D };`,
  );
  return factory(
    (specifier) => (specifier === 'node:test' ? () => undefined : require(specifier)),
    process,
    console,
    path.dirname(filename),
    filename,
  );
}

function ownerPacket002E(overrides = {}) {
  return {
    packetKind: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_AND_NEXT_CONTOUR_PERMISSION_OWNER_PACKET_002E',
    targetContour: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_AND_NEXT_CONTOUR_PERMISSION_002E',
    bindingHeadSha: BINDING_HEAD_SHA,
    nextContourTarget: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_ADMISSION_002F',
    ownerApproved002ECloseout: true,
    ownerUnderstandsCloseoutOnly: true,
    ownerUnderstandsPermissionOnly: true,
    ownerUnderstandsOwnerPacketNecessaryButInsufficient: true,
    ownerUnderstandsFixtureReceiptIsNotProductReceipt: true,
    ownerUnderstandsProductPathNotAdmitted: true,
    ownerUnderstandsProductPathExecutionForbidden: true,
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
    ownerPacketAuthorizesOnlyOpening002F: true,
    ...overrides,
  };
}

async function acceptedInput(patch = {}, sourcePatch = {}, revalidationPatch = {}) {
  const helpers = load002DTestHelpers();
  const { runExactTextApplyWithReceiptPrivatePortImplementation } = await load002DModule();
  const source002DInput = await helpers.acceptedInput(sourcePatch);
  const source002DResult = runExactTextApplyWithReceiptPrivatePortImplementation(source002DInput);
  const source002DRevalidationInput = await helpers.acceptedInput(revalidationPatch);
  return {
    source002DResult,
    source002DResultHash: source002DResult.canonicalHash,
    source002DDecisionHash: source002DResult.decisions[0].canonicalHash,
    source002DReceiptHash: source002DResult.receipt.receiptCanonicalHash,
    source002DRevalidationInput,
    ownerCloseoutPermissionPacket002E: ownerPacket002E(),
    ...patch,
  };
}

test('002E closes 002D and permits only opening 002F without product path admission', async () => {
  const { runExactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const input = await acceptedInput();
  const result = runExactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission(input);

  assert.equal(result.resultKind, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_AND_NEXT_CONTOUR_PERMISSION_RESULT_002E');
  assert.equal(result.outputDecision, 'OWNER_MAY_OPEN_002F_ONLY_NO_PRODUCT_PATH_ADMITTED');
  assert.equal(result.nextContourRecommendation, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_ADMISSION_002F');
  assert.equal(result.ownerMayOpenNextContour, true);
  assert.equal(result.source002DAccepted, true);
  assert.equal(result.source002DRevalidated, true);
  assert.equal(result.ownerPermissionPacketAccepted, true);
  assert.equal(result.source002DFixtureReceiptVerified, true);
  assert.equal(result.productPathAdmitted, false);
  assert.equal(result.productPathExecuted, false);
  assert.equal(result.productPathExecutionAdmitted, false);
  assert.equal(result.productWriteAdmitted, false);
  assert.equal(result.productWritePerformed, false);
  assert.equal(result.productStorageAdmission, false);
  assert.equal(result.productStorageSafetyClaimed, false);
  assert.equal(result.productApplyReceiptClaimed, false);
  assert.equal(result.fixtureReceiptIsNotProductApplyReceipt, true);
  assert.equal(result.publicRuntimeAdmitted, false);
  assert.equal(result.userProjectMutated, false);
  assert.equal(result.applyTxnImplemented, false);
  assert.equal(result.recoveryClaimed, false);
  assert.equal(result.releaseClaimed, false);
  assert.equal(result.productWriteCount, 0);
  assert.equal(result.publicSurfaceCount, 0);
  assert.equal(result.writeEffectsCount, 0);
  assert.deepEqual(result.blockedReasons, []);
  assert.equal(result.decisions[0].decisionKind, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_AND_NEXT_CONTOUR_PERMISSION_DECISION_002E');
  assert.equal(result.decisions[0].productPathAdmitted, false);
  assert.equal(result.decisions[0].ownerMayOpenNextContour, true);
  assert.equal(result.exitPacket.ownerMayOpenNextContour, true);
  assert.equal(result.exitPacket.productPathAdmitted, false);
  assert.equal(result.canonicalHash, canonicalHash(withoutHash(result)));
});

test('002E blocks missing mismatched blocked synthetic and malformed 002D source evidence', async () => {
  const { runExactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission, EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const base = await acceptedInput();
  const blocked002D = withCanonicalHash(canonicalHash, {
    ...withoutHash(base.source002DResult),
    outputDecision: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_002D_BLOCKED',
    blockedReasons: ['BLOCKED'],
    decisions: [],
    receipt: null,
  });
  const tamperedDecision = withCanonicalHash(canonicalHash, {
    ...withoutHash(base.source002DResult.decisions[0]),
    productWriteCount: 1,
  });
  const tamperedReceipt = withReceiptHash(canonicalHash, {
    ...withoutHash(base.source002DResult.receipt, 'receiptCanonicalHash'),
    productApplyReceiptClaimed: true,
  });
  const sourceWithTamperedDecision = withCanonicalHash(canonicalHash, {
    ...withoutHash(base.source002DResult),
    decisions: [tamperedDecision],
  });
  const sourceWithTamperedReceipt = withCanonicalHash(canonicalHash, {
    ...withoutHash(base.source002DResult),
    receipt: tamperedReceipt,
  });
  const cases = [
    { patch: { source002DResult: null }, code: 'SOURCE_002D_RESULT_REQUIRED' },
    { patch: { source002DResultHash: canonicalHash({ wrong: '002d-result' }) }, code: 'SOURCE_002D_RESULT_HASH_MISMATCH' },
    { patch: { source002DDecisionHash: canonicalHash({ wrong: '002d-decision' }) }, code: 'SOURCE_002D_DECISION_HASH_MISMATCH' },
    { patch: { source002DReceiptHash: canonicalHash({ wrong: '002d-receipt' }) }, code: 'SOURCE_002D_RECEIPT_HASH_MISMATCH' },
    { patch: { source002DResult: blocked002D, source002DResultHash: blocked002D.canonicalHash, source002DDecisionHash: '', source002DReceiptHash: '' }, code: 'SOURCE_002D_BLOCKED' },
    { patch: { source002DResult: sourceWithTamperedDecision, source002DResultHash: sourceWithTamperedDecision.canonicalHash, source002DDecisionHash: tamperedDecision.canonicalHash }, code: 'SOURCE_002D_BLOCKED' },
    { patch: { source002DResult: sourceWithTamperedReceipt, source002DResultHash: sourceWithTamperedReceipt.canonicalHash, source002DReceiptHash: tamperedReceipt.receiptCanonicalHash }, code: 'PRODUCT_APPLYRECEIPT_CLAIM_FORBIDDEN' },
    { patch: { source002DRevalidationInput: null }, code: 'SOURCE_002D_REVALIDATION_INPUT_REQUIRED' },
  ];

  for (const item of cases) {
    const result = runExactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission({ ...base, ...item.patch });
    assert.equal(result.outputDecision, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_AND_NEXT_CONTOUR_PERMISSION_002E_BLOCKED');
    assert.equal(result.ownerMayOpenNextContour, false);
    assert.equal(result.productPathAdmitted, false);
    assert.equal(result.productWriteCount, 0);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES[item.code]), true, item.code);
  }

  const synthetic = await acceptedInput({}, {}, { source002AResult: null });
  const syntheticResult = runExactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission(synthetic);
  assert.equal(syntheticResult.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES.SOURCE_002D_REVALIDATION_FAILED), true);
});

test('002E owner packet rejects product path execution public runtime paths callables and overclaims', async () => {
  const { runExactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission, EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES } = await loadModule();
  const base = await acceptedInput();
  const cases = [
    { patch: { ownerCloseoutPermissionPacket002E: null }, code: 'OWNER_PACKET_REQUIRED' },
    { patch: { ownerCloseoutPermissionPacket002E: ownerPacket002E({ packetKind: 'WRONG_PACKET' }) }, code: 'OWNER_PACKET_INVALID' },
    { patch: { ownerCloseoutPermissionPacket002E: ownerPacket002E({ targetContour: 'WRONG_TARGET' }) }, code: 'OWNER_PACKET_TARGET_MISMATCH' },
    { patch: { ownerCloseoutPermissionPacket002E: ownerPacket002E({ bindingHeadSha: 'wrong-sha' }) }, code: 'OWNER_PACKET_BINDING_MISMATCH' },
    { patch: { ownerCloseoutPermissionPacket002E: ownerPacket002E({ nextContourTarget: 'WRONG_NEXT' }) }, code: 'OWNER_NEXT_CONTOUR_TARGET_MISMATCH' },
    { patch: { ownerCloseoutPermissionPacket002E: ownerPacket002E({ ownerUnderstandsPermissionOnly: false }) }, code: 'OWNER_POLICY_MISSING' },
    { patch: { ownerCloseoutPermissionPacket002E: ownerPacket002E({ surpriseField: true }) }, code: 'OWNER_PACKET_UNKNOWN_FIELD_FORBIDDEN' },
    { patch: { ownerCloseoutPermissionPacket002E: ownerPacket002E({ openNext: () => null }) }, code: 'CALLABLE_FIELD_FORBIDDEN' },
    { patch: { ownerCloseoutPermissionPacket002E: ownerPacket002E({ userProjectPath: 'forbidden' }) }, code: 'USER_PROJECT_PATH_FORBIDDEN' },
    { patch: { ownerCloseoutPermissionPacket002E: ownerPacket002E({ productPathExecuted: true }) }, code: 'PRODUCT_PATH_EXECUTION_FORBIDDEN' },
    { patch: { ownerCloseoutPermissionPacket002E: ownerPacket002E({ productPathAdmitted: true }) }, code: 'PRODUCT_PATH_EXECUTION_FORBIDDEN' },
    { patch: { ownerCloseoutPermissionPacket002E: ownerPacket002E({ productWritePerformed: true }) }, code: 'PRODUCT_WRITE_FORBIDDEN' },
    { patch: { ownerCloseoutPermissionPacket002E: ownerPacket002E({ productStorageAdmission: true }) }, code: 'PRODUCT_STORAGE_ADMISSION_FORBIDDEN' },
    { patch: { ownerCloseoutPermissionPacket002E: ownerPacket002E({ productApplyReceiptClaimed: true }) }, code: 'PRODUCT_APPLYRECEIPT_CLAIM_FORBIDDEN' },
    { patch: { ownerCloseoutPermissionPacket002E: ownerPacket002E({ publicRuntimeAdmitted: true }) }, code: 'PUBLIC_RUNTIME_FORBIDDEN' },
    { patch: { ownerCloseoutPermissionPacket002E: ownerPacket002E({ publicSurfaceClaimed: true }) }, code: 'PUBLIC_COMMAND_SURFACE_FORBIDDEN' },
    { patch: { ownerCloseoutPermissionPacket002E: ownerPacket002E({ uiChanged: true }) }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { ownerCloseoutPermissionPacket002E: ownerPacket002E({ docxImportClaimed: true }) }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { ownerCloseoutPermissionPacket002E: ownerPacket002E({ networkUsed: true }) }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { ownerCloseoutPermissionPacket002E: ownerPacket002E({ dependencyChanged: true }) }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { ownerCloseoutPermissionPacket002E: ownerPacket002E({ applyTxnImplemented: true }) }, code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { patch: { ownerCloseoutPermissionPacket002E: ownerPacket002E({ recoveryClaimed: true }) }, code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { patch: { ownerCloseoutPermissionPacket002E: ownerPacket002E({ releaseClaimed: true }) }, code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
  ];

  for (const item of cases) {
    const result = runExactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission({ ...base, ...item.patch });
    assert.equal(result.outputDecision, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_AND_NEXT_CONTOUR_PERMISSION_002E_BLOCKED');
    assert.equal(result.ownerMayOpenNextContour, false);
    assert.equal(result.productPathAdmitted, false);
    assert.equal(result.productWriteCount, 0);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES[item.code]), true, item.code);
  }
});

test('002E blocks fixture receipt rebrand and direct product admission claims on input', async () => {
  const { runExactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission, EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const base = await acceptedInput();
  const rebrandedReceipt = withReceiptHash(canonicalHash, {
    ...withoutHash(base.source002DResult.receipt, 'receiptCanonicalHash'),
    fixtureReceiptOnlyNotProductApplyReceipt: false,
  });
  const rebrandedSource = withCanonicalHash(canonicalHash, {
    ...withoutHash(base.source002DResult),
    fixtureReceiptOnlyNotProductApplyReceipt: false,
    receipt: rebrandedReceipt,
  });
  const cases = [
    { patch: { productPathAdmitted: true }, code: 'PRODUCT_PATH_EXECUTION_FORBIDDEN' },
    { patch: { productPathExecuted: true }, code: 'PRODUCT_PATH_EXECUTION_FORBIDDEN' },
    { patch: { productWritePerformed: true }, code: 'PRODUCT_WRITE_FORBIDDEN' },
    { patch: { productStorageAdmission: true }, code: 'PRODUCT_STORAGE_ADMISSION_FORBIDDEN' },
    { patch: { productApplyReceiptClaimed: true }, code: 'PRODUCT_APPLYRECEIPT_CLAIM_FORBIDDEN' },
    { patch: { publicRuntimeAdmitted: true }, code: 'PUBLIC_RUNTIME_FORBIDDEN' },
    {
      patch: {
        source002DResult: rebrandedSource,
        source002DResultHash: rebrandedSource.canonicalHash,
        source002DReceiptHash: rebrandedReceipt.receiptCanonicalHash,
      },
      code: 'FIXTURE_RECEIPT_REBRAND_FORBIDDEN',
    },
  ];

  for (const item of cases) {
    const result = runExactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission({ ...base, ...item.patch });
    assert.equal(result.outputDecision, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_AND_NEXT_CONTOUR_PERMISSION_002E_BLOCKED');
    assert.equal(result.ownerMayOpenNextContour, false);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_NEXT_CONTOUR_PERMISSION_REASON_CODES[item.code]), true, item.code);
  }
});

test('002E task record preserves closeout only next contour permission boundary', () => {
  const taskText = sourceText('docs', 'tasks', TASK_BASENAME);
  assert.match(taskText, /TASK_ID: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_AND_NEXT_CONTOUR_PERMISSION_002E/u);
  assert.match(taskText, /CONTOUR_TYPE: PRIVATE_PORT_CLOSEOUT_AND_NEXT_CONTOUR_PERMISSION_ONLY/u);
  assert.match(taskText, /PREVIOUS_CONTOUR: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_002D/u);
  assert.match(taskText, /NEXT_CONTOUR_IF_PASS: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_ADMISSION_002F/u);
  assert.match(taskText, /SUCCESS_DECISION: OWNER_MAY_OPEN_002F_ONLY_NO_PRODUCT_PATH_ADMITTED/u);
  assert.match(taskText, /PRODUCT_PATH_ADMITTED_FALSE/u);
  assert.match(taskText, /FIXTURE_RECEIPT_IS_NOT_PRODUCT_APPLYRECEIPT_TRUE/u);
  assert.match(taskText, /DELIVERY_POLICY: COMMIT_REQUIRED_PUSH_REQUIRED/u);
  assert.doesNotMatch(taskText, /product path admitted|product write admitted|public runtime admitted|release green/iu);
});

test('002E changed scope stays allowlisted and new module has no direct storage runtime or UI imports', () => {
  const changedPaths = [
    ...gitLines(['diff', '--name-only', 'HEAD']),
    ...gitLines(['diff', '--cached', '--name-only']),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ].sort();
  const changedBasenames = changedBasenamesForCurrentContour();
  const allowedPaths = new Set([
    'docs/tasks/PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_AND_NEXT_CONTOUR_PERMISSION_002E.md',
    'scripts/ops/revision-bridge-pre-stage-00-admission-guard-state.mjs',
    'src/revisionBridge/exactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission.mjs',
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
    'test/contracts/exactTextApplyWithReceiptPrivatePortImplementation.contract.test.js',
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
  assert.notDeepEqual(changedBasenames, [], '002E must have detectable changed scope');
  for (const changedPath of changedPaths) {
    assert.equal(allowedPaths.has(changedPath), true, `unexpected 002E changed path: ${changedPath}`);
  }
  for (const basename of changedBasenames) {
    assert.equal(allowlist.has(basename), true, `unexpected 002E changed basename: ${basename}`);
    assert.equal(denylist.has(basename), false, `denylisted 002E changed basename: ${basename}`);
  }

  const moduleText = sourceText('src', 'revisionBridge', MODULE_BASENAME);
  const importLines = moduleText.split(/\r?\n/u).filter((line) => line.startsWith('import '));
  assert.deepEqual(importLines, [
    "import { canonicalHash } from './reviewIrKernel.mjs';",
    "import { runExactTextApplyWithReceiptPrivatePortImplementation } from './exactTextApplyWithReceiptPrivatePortImplementation.mjs';",
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
    assert.equal(pattern.test(moduleText), false, `forbidden 002E import pattern: ${pattern.source}`);
  }
});
