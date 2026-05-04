const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'exactTextApplyWithReceiptPrivatePortAdmission.mjs';
const SOURCE_002B_MODULE_BASENAME = 'exactTextApplyWithReceiptPrivateContractShape.mjs';
const SOURCE_002B_TEST_BASENAME = 'exactTextApplyWithReceiptPrivateContractShape.contract.test.js';
const TASK_BASENAME = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_002C.md';
const SOURCE_002B_TASK_BASENAME = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_002B.md';
const KERNEL_BASENAME = 'reviewIrKernel.mjs';
const BINDING_HEAD_SHA = 'be80bd7bdf02030db6b56f2eeaf40dd470b4ab19';

async function loadModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

async function load002BModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', SOURCE_002B_MODULE_BASENAME)).href);
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

function load002BTestHelpers() {
  const filename = path.join(process.cwd(), 'test', 'contracts', SOURCE_002B_TEST_BASENAME);
  const testSource = fs.readFileSync(filename, 'utf8');
  const factory = new Function(
    'require',
    'process',
    'console',
    '__dirname',
    '__filename',
    `${testSource}\nreturn { acceptedInput, ownerPacket002B };`,
  );
  return factory(
    (specifier) => (specifier === 'node:test' ? () => undefined : require(specifier)),
    process,
    console,
    path.dirname(filename),
    filename,
  );
}

function ownerPacket002C(overrides = {}) {
  return {
    packetKind: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_OWNER_PACKET_002C',
    targetContour: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_002D',
    bindingHeadSha: BINDING_HEAD_SHA,
    ownerApprovedPrivatePortAdmission: true,
    ownerUnderstandsAdmissionOnly: true,
    ownerUnderstandsOwnerPacketNecessaryButInsufficient: true,
    ownerUnderstandsNoPortImplementation: true,
    ownerUnderstandsNoStorageWrite: true,
    ownerUnderstandsNoPublicRuntime: true,
    ownerUnderstandsNoCommandSurface: true,
    ownerUnderstandsNoUi: true,
    ownerUnderstandsNoDocxParser: true,
    ownerUnderstandsNoNetwork: true,
    ownerUnderstandsNoDependencyChange: true,
    ownerUnderstandsNoUserProjectPath: true,
    ownerUnderstandsNoReleaseClaim: true,
    ownerUnderstands002DWillNeedSeparateDelivery: true,
    ownerPacketAuthorizesOnlyOpening002D: true,
    ...overrides,
  };
}

async function acceptedInput(patch = {}) {
  const helpers = load002BTestHelpers();
  const source002BInput = await helpers.acceptedInput();
  const { runExactTextApplyWithReceiptPrivateContractShape } = await load002BModule();
  const source002BResult = runExactTextApplyWithReceiptPrivateContractShape(source002BInput);
  return {
    ...source002BInput,
    source002BResult,
    source002BResultHash: source002BResult.canonicalHash,
    source002BDecisionHash: source002BResult.decisions[0].canonicalHash,
    source002BContractShapeHash: source002BResult.contractShape.canonicalHash,
    ownerPortAdmissionPacket002C: ownerPacket002C(),
    ...patch,
  };
}

test('002C accepts private port admission only after delivered 002B contract shape rehash and inherited chain revalidation', async () => {
  const { runExactTextApplyWithReceiptPrivatePortAdmission } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const input = await acceptedInput();
  const result = runExactTextApplyWithReceiptPrivatePortAdmission(input);

  assert.equal(result.resultKind, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_RESULT_002C');
  assert.equal(result.outputDecision, 'OWNER_MAY_OPEN_PRIVATE_PORT_IMPLEMENTATION_002D_NO_PUBLIC_RUNTIME_ADMITTED');
  assert.equal(result.nextContourRecommendation, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_002D');
  assert.equal(result.ownerMayOpen002D, true);
  assert.equal(result.source002BAccepted, true);
  assert.equal(result.ownerPortAdmissionAccepted, true);
  assert.equal(result.privatePortAdmissionOnly, true);
  assert.equal(result.noPortImplementation, true);
  assert.equal(result.noStoragePort, true);
  assert.equal(result.noWritePort, true);
  assert.equal(result.portImplementationAdmitted, false);
  assert.equal(result.storagePortAdmitted, false);
  assert.equal(result.writePortAdmitted, false);
  assert.equal(result.publicRuntimeAdmitted, false);
  assert.equal(result.productApplyRuntimeAdmitted, false);
  assert.equal(result.runtimeWiringAdmitted, false);
  assert.equal(result.applyExecutionImplemented, false);
  assert.equal(result.userProjectMutated, false);
  assert.equal(result.writeEffectsCount, 0);
  assert.equal(result.exitPacket.inheritedChainVerified, true);
  assert.equal(result.exitPacket.source002BRehashed, true);
  assert.equal(result.exitPacket.source002BDecisionRehashed, true);
  assert.equal(result.exitPacket.source002BContractShapeRehashed, true);
  assert.equal(result.exitPacket.writeEffectsCount, 0);
  assert.deepEqual(result.blockedReasons, []);
  assert.equal(result.decisions[0].decisionKind, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_DECISION_002C');
  assert.equal(result.decisions[0].portImplementationAdmitted, false);
  assert.equal(result.decisions[0].storagePortAdmitted, false);
  assert.equal(result.decisions[0].writePortAdmitted, false);
  assert.equal(result.canonicalHash, canonicalHash(withoutHash(result)));
});

test('002C blocks missing mismatched synthetic and tampered 002B inputs', async () => {
  const { runExactTextApplyWithReceiptPrivatePortAdmission, EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const base = await acceptedInput();
  const tamperedShape = withCanonicalHash(canonicalHash, {
    ...withoutHash(base.source002BResult.contractShape),
    noWritePort: false,
  });
  const tamperedShapeResult = withCanonicalHash(canonicalHash, {
    ...withoutHash(base.source002BResult),
    contractShape: tamperedShape,
    contractShapeHash: tamperedShape.canonicalHash,
  });
  const synthetic002B = withCanonicalHash(canonicalHash, {
    ...withoutHash(base.source002BResult),
    source002AResultHash: canonicalHash({ synthetic: '002a-result' }),
  });
  const cases = [
    { patch: { source002BResult: null }, code: 'SOURCE_002B_RESULT_REQUIRED' },
    { patch: { source002BResultHash: canonicalHash({ wrong: '002b-result' }) }, code: 'SOURCE_002B_RESULT_MISMATCH' },
    { patch: { source002BDecisionHash: canonicalHash({ wrong: '002b-decision' }) }, code: 'SOURCE_002B_DECISION_MISMATCH' },
    { patch: { source002BContractShapeHash: canonicalHash({ wrong: '002b-shape' }) }, code: 'SOURCE_002B_CONTRACT_SHAPE_MISMATCH' },
    {
      patch: {
        source002BResult: tamperedShapeResult,
        source002BResultHash: tamperedShapeResult.canonicalHash,
        source002BContractShapeHash: tamperedShape.canonicalHash,
      },
      code: 'INHERITED_CHAIN_REVALIDATION_FAILED',
    },
    { patch: { source002BResult: synthetic002B, source002BResultHash: synthetic002B.canonicalHash }, code: 'INHERITED_CHAIN_REVALIDATION_FAILED' },
  ];

  for (const item of cases) {
    const result = runExactTextApplyWithReceiptPrivatePortAdmission({ ...base, ...item.patch });
    assert.equal(result.outputDecision, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_002C_BLOCKED');
    assert.equal(result.ownerMayOpen002D, false);
    assert.equal(result.nextContourRecommendation, null);
    assert.equal(result.writeEffectsCount, 0);
    assert.equal(result.userProjectMutated, false);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES[item.code]), true, item.code);
  }
});

test('002C blocks missing inherited chain and owner packet necessary but insufficient', async () => {
  const { runExactTextApplyWithReceiptPrivatePortAdmission, EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const base = await acceptedInput();
  const blocked002B = withCanonicalHash(canonicalHash, {
    ...withoutHash(base.source002BResult),
    outputDecision: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_002B_BLOCKED',
    ownerMayOpen002C: false,
    blockedReasons: ['BLOCKED'],
    decisions: [],
  });
  const cases = [
    { patch: { source002AResult: null }, code: 'INHERITED_CHAIN_REVALIDATION_FAILED' },
    { patch: { source001ZResult: null }, code: 'INHERITED_CHAIN_REVALIDATION_FAILED' },
    { patch: { source001YResult: null }, code: 'INHERITED_CHAIN_REVALIDATION_FAILED' },
    { patch: { source002BResult: blocked002B, source002BResultHash: blocked002B.canonicalHash, source002BDecisionHash: '' }, code: 'SOURCE_002B_BLOCKED' },
    { patch: { source002BResultHash: canonicalHash({ owner: 'packet-is-insufficient' }) }, code: 'SOURCE_002B_RESULT_MISMATCH' },
  ];

  for (const item of cases) {
    const result = runExactTextApplyWithReceiptPrivatePortAdmission({ ...base, ...item.patch });
    assert.equal(result.ownerMayOpen002D, false);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES[item.code]), true, item.code);
  }
});

test('002C owner packet rejects unknown fields forbidden claims callables user paths wrong target and binding', async () => {
  const { runExactTextApplyWithReceiptPrivatePortAdmission, EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES } = await loadModule();
  const base = await acceptedInput();
  const cases = [
    { patch: { ownerPortAdmissionPacket002C: null }, code: 'OWNER_PACKET_REQUIRED' },
    { patch: { ownerPortAdmissionPacket002C: ownerPacket002C({ packetKind: 'WRONG_PACKET' }) }, code: 'OWNER_PACKET_INVALID' },
    { patch: { ownerPortAdmissionPacket002C: ownerPacket002C({ targetContour: 'WRONG_TARGET' }) }, code: 'OWNER_PACKET_TARGET_MISMATCH' },
    { patch: { ownerPortAdmissionPacket002C: ownerPacket002C({ bindingHeadSha: 'wrong-sha' }) }, code: 'OWNER_PACKET_BINDING_MISMATCH' },
    { patch: { ownerPortAdmissionPacket002C: ownerPacket002C({ ownerApprovedPrivatePortAdmission: false }) }, code: 'OWNER_PORT_ADMISSION_POLICY_MISSING' },
    { patch: { ownerPortAdmissionPacket002C: ownerPacket002C({ lowerDeliveryRecordClosureClaimed: true }) }, code: 'OWNER_PACKET_UNKNOWN_FIELD_FORBIDDEN' },
    { patch: { ownerPortAdmissionPacket002C: ownerPacket002C({ noPortImplementation: false }) }, code: 'PORT_IMPLEMENTATION_FORBIDDEN' },
    { patch: { ownerPortAdmissionPacket002C: ownerPacket002C({ portImplementationAdmitted: true }) }, code: 'PORT_IMPLEMENTATION_FORBIDDEN' },
    { patch: { ownerPortAdmissionPacket002C: ownerPacket002C({ publicRuntimeAdmitted: true }) }, code: 'PRODUCT_RUNTIME_FORBIDDEN' },
    { patch: { ownerPortAdmissionPacket002C: ownerPacket002C({ productApplyRuntimeAdmitted: true }) }, code: 'PRODUCT_RUNTIME_FORBIDDEN' },
    { patch: { ownerPortAdmissionPacket002C: ownerPacket002C({ publicAdapterImplementationAdmitted: true }) }, code: 'PUBLIC_ADAPTER_IMPLEMENTATION_FORBIDDEN' },
    { patch: { ownerPortAdmissionPacket002C: ownerPacket002C({ runtimeWiringAdmitted: true }) }, code: 'RUNTIME_WIRING_FORBIDDEN' },
    { patch: { ownerPortAdmissionPacket002C: ownerPacket002C({ applyExecutionImplemented: true }) }, code: 'APPLY_EXECUTION_FORBIDDEN' },
    { patch: { ownerPortAdmissionPacket002C: ownerPacket002C({ commandSurfaceClaimed: true }) }, code: 'PUBLIC_COMMAND_SURFACE_FORBIDDEN' },
    { patch: { ownerPortAdmissionPacket002C: ownerPacket002C({ docxImportClaimed: true }) }, code: 'UI_DOCX_NETWORK_DEPENDENCY_FORBIDDEN' },
    { patch: { ownerPortAdmissionPacket002C: ownerPacket002C({ applyTxnImplemented: true }) }, code: 'APPLYTXN_RECOVERY_RELEASE_FORBIDDEN' },
    { patch: { ownerPortAdmissionPacket002C: ownerPacket002C({ userProjectMutated: true }) }, code: 'USER_PROJECT_MUTATION_FORBIDDEN' },
    { patch: { ownerPortAdmissionPacket002C: ownerPacket002C({ openPort: () => null }) }, code: 'CALLABLE_FIELD_FORBIDDEN' },
    { patch: { ownerPortAdmissionPacket002C: ownerPacket002C({ userProjectPath: '/tmp/user-project' }) }, code: 'USER_PROJECT_PATH_FORBIDDEN' },
  ];

  for (const item of cases) {
    const result = runExactTextApplyWithReceiptPrivatePortAdmission({ ...base, ...item.patch });
    assert.equal(result.ownerMayOpen002D, false);
    assert.equal(result.blockedReasons.includes(EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_REASON_CODES[item.code]), true, item.code);
  }
});

test('002C task record preserves private port admission boundary and no-write policy', () => {
  const taskText = sourceText('docs', 'tasks', TASK_BASENAME);
  assert.match(taskText, /TASK_ID: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_002C/u);
  assert.match(taskText, /CONTOUR_TYPE: PRIVATE_PORT_ADMISSION_ONLY/u);
  assert.match(taskText, /PREVIOUS_CONTOUR: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_002B/u);
  assert.match(taskText, /NEXT_CONTOUR_IF_PASS: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_002D/u);
  assert.match(taskText, /OWNER_PACKET_KIND: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_OWNER_PACKET_002C/u);
  assert.match(taskText, /OWNER_PACKET_TARGET: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_002D/u);
  assert.match(taskText, /SUCCESS_DECISION: OWNER_MAY_OPEN_PRIVATE_PORT_IMPLEMENTATION_002D_NO_PUBLIC_RUNTIME_ADMITTED/u);
  assert.match(taskText, /BLOCKED_DECISION: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_002C_BLOCKED/u);
  assert.match(taskText, /MODULE_CONTRACT: PURE_PRIVATE_PORT_ADMISSION_ONLY/u);
  assert.match(taskText, /NO_PORT_IMPLEMENTATION: true/u);
  assert.match(taskText, /PORT_IMPLEMENTATION_ADMITTED: false/u);
  assert.match(taskText, /STORAGE_PORT_ADMITTED: false/u);
  assert.match(taskText, /WRITE_PORT_ADMITTED: false/u);
  assert.match(taskText, /PUBLIC_RUNTIME_ADMITTED: false/u);
  assert.match(taskText, /RUNTIME_WIRING_ADMITTED: false/u);
  assert.match(taskText, /APPLY_EXECUTION_IMPLEMENTED: false/u);
  assert.match(taskText, /USER_PROJECT_PATH_ACCEPTED: false/u);
  assert.match(taskText, /DELIVERY_POLICY: COMMIT_REQUIRED_PUSH_REQUIRED/u);
  assert.match(taskText, /STATUS: DONE/u);
  assert.match(taskText, /COMMIT_SHA: df1d079e98c0839799a0663a1766d5460217142e/u);
  assert.match(taskText, /PUSH_RESULT: pushed/u);
  assert.doesNotMatch(taskText, /storage adapter implemented|write port implemented|public apply|DOCX runtime/iu);

  const sourceTaskText = sourceText('docs', 'tasks', SOURCE_002B_TASK_BASENAME);
  assert.match(sourceTaskText, /STATUS: DONE/u);
  assert.match(sourceTaskText, /COMMIT_SHA: 9e2ca9f15f6774991f8d1ac2914edd6d8401dad3/u);
});

test('002C changed scope stays exact-path allowlisted and module stays pure', () => {
  const changedPaths = [
    ...gitLines(['diff', '--name-only', 'HEAD']),
    ...gitLines(['diff', '--cached', '--name-only']),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ].sort();
  const changedBasenames = changedBasenamesForCurrentContour();
  const allowedPaths = new Set([
    'docs/tasks/PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_002C.md',
    'docs/tasks/PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_002D.md',
    'docs/tasks/PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_CLOSEOUT_AND_NEXT_CONTOUR_PERMISSION_002E.md',
    'docs/tasks/PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRODUCT_PATH_IMPLEMENTATION_OPENING_ADMISSION_002F.md',
    'scripts/ops/revision-bridge-pre-stage-00-admission-guard-state.mjs',
    'src/revisionBridge/exactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission.mjs',
    'src/revisionBridge/exactTextApplyWithReceiptProductPathImplementationOpeningAdmission.mjs',
    'src/revisionBridge/exactTextApplyWithReceiptPrivatePortAdmission.mjs',
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
    'exactTextApplyWithReceiptPrivatePortImplementation.mjs',
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
    'exactTextApplyWithReceiptPrivatePortAdmission.contract.test.js',
    'exactTextApplyWithReceiptPrivatePortCloseoutNextContourPermission.contract.test.js',
    'exactTextApplyWithReceiptProductPathImplementationOpeningAdmission.contract.test.js',
    'exactTextApplyWithReceiptPrivatePortImplementation.contract.test.js',
    TASK_BASENAME,
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_002D.md',
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
    'command-catalog.v1.mjs',
    'projectCommands.mjs',
    'hostilePackageGate.mjs',
  ]);
  assert.notDeepEqual(changedBasenames, [], '002C must have detectable changed scope');
  for (const changedPath of changedPaths) {
    assert.equal(allowedPaths.has(changedPath), true, `unexpected 002C changed path: ${changedPath}`);
  }
  for (const basename of changedBasenames) {
    assert.equal(allowlist.has(basename), true, `unexpected 002C changed basename: ${basename}`);
    assert.equal(denylist.has(basename), false, `denylisted 002C changed basename: ${basename}`);
  }

  const moduleText = sourceText('src', 'revisionBridge', MODULE_BASENAME);
  const importLines = moduleText.split(/\r?\n/u).filter((line) => line.startsWith('import '));
  assert.deepEqual(importLines, [
    "import { canonicalHash } from './reviewIrKernel.mjs';",
    "import { runExactTextApplyWithReceiptPrivateContractShape } from './exactTextApplyWithReceiptPrivateContractShape.mjs';",
  ]);
  const forbiddenPatterns = [
    /from\s+['"]node:fs/u,
    /from\s+['"]node:path/u,
    /from\s+['"]node:os/u,
    /from\s+['"][^'"]*backupManager[^'"]*['"]/u,
    /from\s+['"][^'"]*fileManager[^'"]*['"]/u,
    /from\s+['"]electron['"]/u,
    /import\s*\(\s*['"]electron['"]\s*\)/u,
    /import\s*\(\s*['"]node:fs['"]\s*\)/u,
    /require\s*\(\s*['"]electron['"]\s*\)/u,
    /from\s+['"][^'"]*(?:main|preload|editor|command-catalog|projectCommands|runtimeBridge)[^'"]*['"]/u,
  ];
  for (const pattern of forbiddenPatterns) {
    assert.equal(pattern.test(moduleText), false, `forbidden 002C import pattern: ${pattern.source}`);
  }
});
