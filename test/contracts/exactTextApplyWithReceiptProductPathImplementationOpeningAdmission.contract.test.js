const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'exactTextApplyWithReceiptProductPathImplementationOpeningAdmission.mjs';
const SOURCE_002E_MODULE_BASENAME = 'exactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission.mjs';
const SOURCE_002E_TEST_BASENAME = 'exactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission.contract.test.js';
const TASK_BASENAME = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_IMPLEMENTATION_OPENING_ADMISSION_002F.md';
const KERNEL_BASENAME = 'reviewIrKernel.mjs';

async function loadModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

async function load002EModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', SOURCE_002E_MODULE_BASENAME)).href);
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

function load002ETestHelpers() {
  const filename = path.join(process.cwd(), 'test', 'contracts', SOURCE_002E_TEST_BASENAME);
  const testSource = fs.readFileSync(filename, 'utf8');
  const factory = new Function(
    'require',
    'process',
    'console',
    '__dirname',
    '__filename',
    `${testSource}\nreturn { acceptedInput, ownerPacket002E };`,
  );
  return factory(
    (specifier) => (specifier === 'node:test' ? () => undefined : require(specifier)),
    process,
    console,
    path.dirname(filename),
    filename,
  );
}

function ownerPacket002F(overrides = {}) {
  return {
    packetKind: 'PRODUCT_PATH_IMPLEMENTATION_OPENING_OWNER_PACKET_002F',
    targetContour: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_IMPLEMENTATION_OPENING_ADMISSION_002F',
    nextContourTarget: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_IMPLEMENTATION_002G',
    ownerApproves002FCloseout: true,
    ownerApprovesOpening002G: true,
    ownerUnderstands002FIsPermissionOnly: true,
    ownerUnderstandsProductWriteNotAllowedIn002F: true,
    ownerUnderstandsProductPathExecutionNotAllowedIn002F: true,
    ownerUnderstandsStorageAdmissionNotAllowedIn002F: true,
    ownerUnderstandsApplyTxnNotAllowedIn002F: true,
    ownerUnderstandsRecoveryAndReleaseNotClaimed: true,
    ...overrides,
  };
}

async function acceptedInput(patch = {}, sourcePatch = {}) {
  const helpers = load002ETestHelpers();
  const { runExactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission } = await load002EModule();
  const source002EInput = await helpers.acceptedInput(sourcePatch);
  const source002EResult = runExactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission(source002EInput);
  const source002ERevalidationInput = await helpers.acceptedInput(sourcePatch);
  return {
    source002EResult,
    source002EResultHash: source002EResult.canonicalHash,
    source002EDecisionHash: source002EResult.decisions[0].canonicalHash,
    source002DReceiptHashFrom002E: source002EResult.source002DReceiptHash,
    source002ERevalidationInput,
    ownerProductPathImplementationOpeningPacket002F: ownerPacket002F(),
    ...patch,
  };
}

test('002F admits only opening 002G and does not admit product path execution', async () => {
  const { runExactTextApplyWithReceiptProductPathImplementationOpeningAdmission } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const input = await acceptedInput();
  const result = runExactTextApplyWithReceiptProductPathImplementationOpeningAdmission(input);

  assert.equal(result.resultKind, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_IMPLEMENTATION_OPENING_ADMISSION_RESULT_002F');
  assert.equal(result.outputDecision, 'OWNER_MAY_OPEN_PRODUCT_PATH_IMPLEMENTATION_002G_ONLY');
  assert.equal(result.nextContourRecommendation, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_IMPLEMENTATION_002G');
  assert.equal(result.source002EAccepted, true);
  assert.equal(result.source002ERehashed, true);
  assert.equal(result.source002EDecisionRehashed, true);
  assert.equal(result.source002EChainHashReconfirmed, true);
  assert.equal(result.source002ERevalidated, true);
  assert.equal(result.source002ERevalidationMatched, true);
  assert.equal(result.ownerPacketAccepted, true);
  assert.equal(result.ownerMayOpen002G, true);
  assert.equal(result.productPathImplementationMayOpen, true);
  assert.equal(result.productPathAdmitted, false);
  assert.equal(result.productPathExecuted, false);
  assert.equal(result.productPathExecutionAdmitted, false);
  assert.equal(result.productWriteAdmitted, false);
  assert.equal(result.productWritePerformed, false);
  assert.equal(result.productStorageAdmitted, false);
  assert.equal(result.productStorageAdmission, false);
  assert.equal(result.productApplyReceiptImplemented, false);
  assert.equal(result.applyTxnImplemented, false);
  assert.equal(result.recoveryClaimed, false);
  assert.equal(result.releaseClaimed, false);
  assert.equal(result.publicRuntimeAdmitted, false);
  assert.equal(result.userProjectMutated, false);
  assert.equal(result.productWriteCount, 0);
  assert.equal(result.publicSurfaceCount, 0);
  assert.equal(result.writeEffectsCount, 0);
  assert.deepEqual(result.blockedReasons, []);
  assert.equal(result.decisions[0].decisionKind, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_IMPLEMENTATION_OPENING_ADMISSION_DECISION_002F');
  assert.equal(result.decisions[0].productPathImplementationMayOpen, true);
  assert.equal(result.decisions[0].productPathAdmitted, false);
  assert.equal(result.exitPacket.ownerMayOpen002G, true);
  assert.equal(result.exitPacket.source002ERevalidated, true);
  assert.equal(result.exitPacket.source002ERevalidationMatched, true);
  assert.equal(result.exitPacket.productPathAdmitted, false);
  assert.equal(result.canonicalHash, canonicalHash(withoutHash(result)));
});

test('002F blocks missing mismatched synthetic and contaminated 002E source evidence', async () => {
  const {
    runExactTextApplyWithReceiptProductPathImplementationOpeningAdmission,
    EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES,
  } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const base = await acceptedInput();
  const blocked002E = withCanonicalHash(canonicalHash, {
    ...withoutHash(base.source002EResult),
    outputDecision: 'PRODUCT_PATH_IMPLEMENTATION_REMAINS_BLOCKED',
    blockedReasons: ['BLOCKED'],
    decisions: [],
  });
  const tamperedDecision = withCanonicalHash(canonicalHash, {
    ...withoutHash(base.source002EResult.decisions[0]),
    productPathAdmitted: true,
  });
  const sourceWithTamperedDecision = withCanonicalHash(canonicalHash, {
    ...withoutHash(base.source002EResult),
    decisions: [tamperedDecision],
  });
  const forgedSource002E = withCanonicalHash(canonicalHash, {
    ...withoutHash(base.source002EResult),
    source002DResultHash: canonicalHash({ forged: '002d-result' }),
    source002DDecisionHash: canonicalHash({ forged: '002d-decision' }),
    source002DReceiptHash: canonicalHash({ forged: '002d-receipt' }),
  });
  const synthetic002E = withCanonicalHash(canonicalHash, {
    ...withoutHash(base.source002EResult),
    source002DRevalidated: false,
    source002DFixtureReceiptVerified: false,
    source002DReceiptHash: '',
    exitPacket: {
      ...base.source002EResult.exitPacket,
      source002DRevalidated: false,
      source002DReceiptRehashed: false,
    },
  });
  const cases = [
    { patch: { source002EResult: null }, code: 'SOURCE_002E_RESULT_REQUIRED' },
    { patch: { source002EResultHash: canonicalHash({ wrong: '002e-result' }) }, code: 'SOURCE_002E_RESULT_HASH_MISMATCH' },
    { patch: { source002EDecisionHash: canonicalHash({ wrong: '002e-decision' }) }, code: 'SOURCE_002E_DECISION_HASH_MISMATCH' },
    { patch: { source002DReceiptHashFrom002E: canonicalHash({ wrong: '002d-receipt' }) }, code: 'SOURCE_002E_CHAIN_HASH_MISMATCH' },
    { patch: { source002EResult: blocked002E, source002EResultHash: blocked002E.canonicalHash, source002EDecisionHash: '' }, code: 'SOURCE_002E_BLOCKED' },
    { patch: { source002EResult: sourceWithTamperedDecision, source002EResultHash: sourceWithTamperedDecision.canonicalHash, source002EDecisionHash: tamperedDecision.canonicalHash }, code: 'PRODUCT_PATH_ADMISSION_CLAIM_FORBIDDEN' },
    { patch: { source002ERevalidationInput: null }, code: 'SOURCE_002E_REVALIDATION_INPUT_REQUIRED' },
    {
      patch: {
        source002EResult: forgedSource002E,
        source002EResultHash: forgedSource002E.canonicalHash,
        source002DReceiptHashFrom002E: forgedSource002E.source002DReceiptHash,
      },
      code: 'SOURCE_002E_REVALIDATION_FAILED',
    },
    { patch: { source002EResult: synthetic002E, source002EResultHash: synthetic002E.canonicalHash, source002DReceiptHashFrom002E: '' }, code: 'SYNTHETIC_002E_WITHOUT_CHAIN' },
  ];

  for (const item of cases) {
    const result = runExactTextApplyWithReceiptProductPathImplementationOpeningAdmission({ ...base, ...item.patch });
    assert.equal(result.outputDecision, 'PRODUCT_PATH_IMPLEMENTATION_REMAINS_BLOCKED');
    assert.equal(result.ownerMayOpen002G, false);
    assert.equal(result.productPathImplementationMayOpen, false);
    assert.equal(result.productPathAdmitted, false);
    assert.equal(result.productWriteCount, 0);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES[item.code]), true, item.code);
  }
});

test('002F owner packet rejects overclaims public paths callables and runtime surfaces', async () => {
  const {
    runExactTextApplyWithReceiptProductPathImplementationOpeningAdmission,
    EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES,
  } = await loadModule();
  const base = await acceptedInput();
  const cases = [
    { patch: { ownerProductPathImplementationOpeningPacket002F: null }, code: 'OWNER_PACKET_REQUIRED' },
    { patch: { ownerProductPathImplementationOpeningPacket002F: ownerPacket002F({ packetKind: 'WRONG_PACKET' }) }, code: 'OWNER_PACKET_INVALID' },
    { patch: { ownerProductPathImplementationOpeningPacket002F: ownerPacket002F({ targetContour: 'WRONG_TARGET' }) }, code: 'OWNER_PACKET_TARGET_MISMATCH' },
    { patch: { ownerProductPathImplementationOpeningPacket002F: ownerPacket002F({ nextContourTarget: 'WRONG_NEXT' }) }, code: 'OWNER_NEXT_CONTOUR_TARGET_MISMATCH' },
    { patch: { ownerProductPathImplementationOpeningPacket002F: ownerPacket002F({ ownerUnderstands002FIsPermissionOnly: false }) }, code: 'OWNER_POLICY_MISSING' },
    { patch: { ownerProductPathImplementationOpeningPacket002F: ownerPacket002F({ surpriseField: true }) }, code: 'OWNER_PACKET_UNKNOWN_FIELD_FORBIDDEN' },
    { patch: { ownerProductPathImplementationOpeningPacket002F: ownerPacket002F({ openNext: () => null }) }, code: 'CALLABLE_FIELD_FORBIDDEN' },
    { patch: { ownerProductPathImplementationOpeningPacket002F: ownerPacket002F({ userProjectPath: 'forbidden' }) }, code: 'USER_PROJECT_PATH_FORBIDDEN' },
    { patch: { ownerProductPathImplementationOpeningPacket002F: ownerPacket002F({ productPathAdmitted: true }) }, code: 'PRODUCT_PATH_ADMISSION_CLAIM_FORBIDDEN' },
    { patch: { ownerProductPathImplementationOpeningPacket002F: ownerPacket002F({ productPathExecuted: true }) }, code: 'PRODUCT_PATH_EXECUTION_FORBIDDEN' },
    { patch: { ownerProductPathImplementationOpeningPacket002F: ownerPacket002F({ productWritePerformed: true }) }, code: 'PRODUCT_WRITE_FORBIDDEN' },
    { patch: { ownerProductPathImplementationOpeningPacket002F: ownerPacket002F({ productStorageAdmission: true }) }, code: 'PRODUCT_STORAGE_ADMISSION_FORBIDDEN' },
    { patch: { ownerProductPathImplementationOpeningPacket002F: ownerPacket002F({ productApplyReceiptImplemented: true }) }, code: 'PRODUCT_APPLYRECEIPT_CLAIM_FORBIDDEN' },
    { patch: { ownerProductPathImplementationOpeningPacket002F: ownerPacket002F({ publicRuntimeAdmitted: true }) }, code: 'PUBLIC_RUNTIME_FORBIDDEN' },
    { patch: { ownerProductPathImplementationOpeningPacket002F: ownerPacket002F({ publicSurfaceClaimed: true }) }, code: 'PUBLIC_COMMAND_SURFACE_FORBIDDEN' },
    { patch: { ownerProductPathImplementationOpeningPacket002F: ownerPacket002F({ uiChanged: true }) }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { ownerProductPathImplementationOpeningPacket002F: ownerPacket002F({ docxImportClaimed: true }) }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { ownerProductPathImplementationOpeningPacket002F: ownerPacket002F({ networkUsed: true }) }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { ownerProductPathImplementationOpeningPacket002F: ownerPacket002F({ dependencyChanged: true }) }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { ownerProductPathImplementationOpeningPacket002F: ownerPacket002F({ applyTxnImplemented: true }) }, code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { patch: { ownerProductPathImplementationOpeningPacket002F: ownerPacket002F({ recoveryClaimed: true }) }, code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { patch: { ownerProductPathImplementationOpeningPacket002F: ownerPacket002F({ releaseClaimed: true }) }, code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
  ];

  for (const item of cases) {
    const result = runExactTextApplyWithReceiptProductPathImplementationOpeningAdmission({ ...base, ...item.patch });
    assert.equal(result.outputDecision, 'PRODUCT_PATH_IMPLEMENTATION_REMAINS_BLOCKED');
    assert.equal(result.ownerMayOpen002G, false);
    assert.equal(result.productPathImplementationMayOpen, false);
    assert.equal(result.productPathAdmitted, false);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES[item.code]), true, item.code);
  }
});

test('002F rejects direct input claims for product write storage UI docx network dependency and release', async () => {
  const {
    runExactTextApplyWithReceiptProductPathImplementationOpeningAdmission,
    EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES,
  } = await loadModule();
  const base = await acceptedInput();
  const cases = [
    { patch: { productPathAdmitted: true }, code: 'PRODUCT_PATH_ADMISSION_CLAIM_FORBIDDEN' },
    { patch: { productPathExecuted: true }, code: 'PRODUCT_PATH_EXECUTION_FORBIDDEN' },
    { patch: { productWritePerformed: true }, code: 'PRODUCT_WRITE_FORBIDDEN' },
    { patch: { userProjectPath: 'forbidden' }, code: 'USER_PROJECT_PATH_FORBIDDEN' },
    { patch: { productStorageAdmission: true }, code: 'PRODUCT_STORAGE_ADMISSION_FORBIDDEN' },
    { patch: { productApplyReceiptClaimed: true }, code: 'PRODUCT_APPLYRECEIPT_CLAIM_FORBIDDEN' },
    { patch: { publicRuntimeAdmitted: true }, code: 'PUBLIC_RUNTIME_FORBIDDEN' },
    { patch: { docxImportClaimed: true }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { networkUsed: true }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { dependencyChanged: true }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { releaseClaimed: true }, code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
  ];

  for (const item of cases) {
    const result = runExactTextApplyWithReceiptProductPathImplementationOpeningAdmission({ ...base, ...item.patch });
    assert.equal(result.outputDecision, 'PRODUCT_PATH_IMPLEMENTATION_REMAINS_BLOCKED');
    assert.equal(result.ownerMayOpen002G, false);
    assert.equal(result.productPathAdmitted, false);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_OPENING_ADMISSION_REASON_CODES[item.code]), true, item.code);
  }
});

test('002F task record preserves admission only boundary', () => {
  const taskText = sourceText('docs', 'tasks', TASK_BASENAME);
  assert.match(taskText, /TASK_ID: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_IMPLEMENTATION_OPENING_ADMISSION_002F/u);
  assert.match(taskText, /CONTOUR_TYPE: PRODUCT_PATH_IMPLEMENTATION_OPENING_ADMISSION_ONLY/u);
  assert.match(taskText, /PREVIOUS_CONTOUR: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_AND_NEXT_CONTOUR_PERMISSION_002E/u);
  assert.match(taskText, /NEXT_CONTOUR_IF_PASS: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_IMPLEMENTATION_002G/u);
  assert.match(taskText, /SUCCESS_DECISION: OWNER_MAY_OPEN_PRODUCT_PATH_IMPLEMENTATION_002G_ONLY/u);
  assert.match(taskText, /PRODUCT_PATH_ADMITTED_FALSE/u);
  assert.match(taskText, /PRODUCT_WRITE_PERFORMED_FALSE/u);
  assert.match(taskText, /STORAGE_ADMISSION_FALSE/u);
  assert.match(taskText, /RELEASE_CLAIMED_FALSE/u);
  assert.doesNotMatch(taskText, /release green|product write ready|product path admitted true/iu);
});

test('002F changed scope stays allowlisted and module has no direct storage runtime or UI imports', () => {
  const changedPaths = [
    ...gitLines(['diff', '--name-only', 'HEAD']),
    ...gitLines(['diff', '--cached', '--name-only']),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ].sort();
  const changedBasenames = changedBasenamesForCurrentContour();
  const allowedPaths = new Set([
    'docs/tasks/PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_IMPLEMENTATION_OPENING_ADMISSION_002F.md',
    'scripts/ops/revision-bridge-pre-stage-00-admission-guard-state.mjs',
    'src/revisionBridge/exactTextApplyWithReceiptProductPathImplementationOpeningAdmission.mjs',
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
    'test/contracts/exactTextApplyWithReceiptProductPathImplementationOpeningAdmission.contract.test.js',
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
  assert.notDeepEqual(changedBasenames, [], '002F must have detectable changed scope');
  for (const changedPath of changedPaths) {
    assert.equal(allowedPaths.has(changedPath), true, `unexpected 002F changed path: ${changedPath}`);
  }
  for (const basename of changedBasenames) {
    assert.equal(allowlist.has(basename), true, `unexpected 002F changed basename: ${basename}`);
    assert.equal(denylist.has(basename), false, `denylisted 002F changed basename: ${basename}`);
  }

  const moduleText = sourceText('src', 'revisionBridge', MODULE_BASENAME);
  const importLines = moduleText.split(/\r?\n/u).filter((line) => line.startsWith('import '));
  assert.deepEqual(importLines, [
    "import { canonicalHash } from './reviewIrKernel.mjs';",
    "import { runExactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission } from './exactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission.mjs';",
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
    assert.equal(pattern.test(moduleText), false, `forbidden 002F import pattern: ${pattern.source}`);
  }
});
