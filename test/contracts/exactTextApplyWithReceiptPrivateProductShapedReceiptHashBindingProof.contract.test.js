const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'exactTextApplyWithReceiptPrivateProductShapedReceiptHashBindingProof.mjs';
const SOURCE_002J_MODULE_BASENAME = 'exactTextApplyWithReceiptPrivateControlledStorageFixturePortProof.mjs';
const SOURCE_002J_TEST_BASENAME = 'exactTextApplyWithReceiptPrivateControlledStorageFixturePortProof.contract.test.js';
const TASK_BASENAME = 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_ONLY_002M.md';
const KERNEL_BASENAME = 'reviewIrKernel.mjs';

async function loadModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

async function load002JModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', SOURCE_002J_MODULE_BASENAME)).href);
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

function load002JTestHelpers() {
  const filename = path.join(process.cwd(), 'test', 'contracts', SOURCE_002J_TEST_BASENAME);
  const testSource = fs.readFileSync(filename, 'utf8');
  const factory = new Function(
    'require',
    'process',
    'console',
    '__dirname',
    '__filename',
    `${testSource}\nreturn { acceptedInput };`,
  );
  return factory(
    (specifier) => (specifier === 'node:test' ? () => undefined : require(specifier)),
    process,
    console,
    path.dirname(filename),
    filename,
  );
}

async function acceptedSource002J() {
  const helpers = load002JTestHelpers();
  const { runExactTextApplyWithReceiptPrivateControlledStorageFixturePortProof } = await load002JModule();
  const source002JInputForResult = await helpers.acceptedInput();
  const source002JResult = runExactTextApplyWithReceiptPrivateControlledStorageFixturePortProof(source002JInputForResult);
  const source002JRevalidationInput = await helpers.acceptedInput();
  return {
    source002JResult,
    source002JResultHash: source002JResult.canonicalHash,
    source002JDecisionHash: source002JResult.decisions[0].canonicalHash,
    source002JReceiptHash: source002JResult.receipt.receiptCanonicalHash,
    source002JRevalidationInput,
  };
}

async function acceptedInput(patch = {}) {
  const source002J = await acceptedSource002J();
  const receipt = source002J.source002JResult.receipt;
  const base = {
    ...source002J,
    projectId: receipt.projectId,
    sceneId: receipt.sceneId,
    operationKind: 'EXACT_TEXT_REPLACE',
    exactTextScope: true,
    singleSceneOnly: true,
    noStructuralScope: true,
    noCommentScope: true,
    multiSceneScope: false,
    baselineStatus: 'FRESH',
    expectedBlockVersionHash: receipt.blockVersionHash,
    changedBasenames: [
      MODULE_BASENAME,
      'exactTextApplyWithReceiptPrivateProductShapedReceiptHashBindingProof.contract.test.js',
      TASK_BASENAME,
    ],
  };
  return {
    ...base,
    ...patch,
  };
}

async function acceptedInputWithPatched002J(patch002J = {}, patchInput = {}) {
  const { canonicalHash } = await loadKernel();
  const base = await acceptedInput();
  const patchedReceipt = patch002J.receipt
    ? { ...base.source002JResult.receipt, ...patch002J.receipt }
    : base.source002JResult.receipt;
  const patchedDecision = patch002J.decision
    ? { ...base.source002JResult.decisions[0], ...patch002J.decision }
    : base.source002JResult.decisions[0];
  const patchedSourceCore = {
    ...withoutHash(base.source002JResult),
    ...patch002J.source,
    decisions: [withCanonicalHash(canonicalHash, withoutHash(patchedDecision))],
    receipt: patchedReceipt,
  };
  const source002JResult = withCanonicalHash(canonicalHash, patchedSourceCore);
  return {
    ...base,
    source002JResult,
    source002JResultHash: source002JResult.canonicalHash,
    source002JDecisionHash: source002JResult.decisions[0].canonicalHash,
    source002JReceiptHash: source002JResult.receipt.receiptCanonicalHash,
    ...patchInput,
  };
}

test('002M compiles pure private product-shaped receipt hash binding proof from valid 002J evidence', async () => {
  const { runExactTextApplyWithReceiptPrivateProductShapedReceiptHashBindingProof } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const input = await acceptedInput();
  const result = runExactTextApplyWithReceiptPrivateProductShapedReceiptHashBindingProof(input);

  assert.equal(result.resultKind, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_RESULT_002M');
  assert.equal(result.outputDecision, 'PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROVED_NO_RUNTIME_ADMISSION');
  assert.equal(result.source002JAccepted, true);
  assert.equal(result.source002JRevalidated, true);
  assert.equal(result.receiptHashBindingCompiled, true);
  assert.equal(result.productWriteCount, 0);
  assert.equal(result.publicSurfaceCount, 0);
  assert.equal(result.publicRuntimeAdmitted, false);
  assert.equal(result.productWritePerformed, false);
  assert.equal(result.userProjectMutated, false);
  assert.equal(result.applyTxnImplemented, false);
  assert.equal(result.recoveryReady, false);
  assert.equal(result.releaseGreen, false);
  assert.equal(result.source002JResultHash, input.source002JResultHash);
  assert.equal(result.source002JDecisionHash, input.source002JDecisionHash);
  assert.equal(result.source002JReceiptHash, input.source002JReceiptHash);

  const receipt = result.receipt;
  assert.equal(receipt.receiptKind, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_RECEIPT_V1_002M');
  assert.equal(receipt.receiptSchemaVersion, 'PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_RECEIPT_SCHEMA_V1_002M');
  assert.equal(receipt.contourId, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_ONLY_002M');
  assert.equal(receipt.projectId, input.projectId);
  assert.equal(receipt.sceneId, input.sceneId);
  assert.equal(receipt.operationKind, input.operationKind);
  assert.equal(receipt.beforeSceneHash, input.source002JResult.receipt.beforeSceneHash);
  assert.equal(receipt.afterSceneHash, input.source002JResult.receipt.afterSceneHash);
  assert.equal(receipt.blockVersionHash, input.source002JResult.receipt.blockVersionHash);
  assert.equal(receipt.backupObservationHash, input.source002JResult.receipt.backupObservationHash);
  assert.equal(receipt.atomicWriteObservationHash, input.source002JResult.receipt.atomicWriteObservationHash);
  assert.equal(receipt.source002JResultHash, input.source002JResultHash);
  assert.equal(receipt.source002JDecisionHash, input.source002JDecisionHash);
  assert.equal(receipt.source002JReceiptHash, input.source002JReceiptHash);
  assert.equal(receipt.operationKind, 'EXACT_TEXT_REPLACE');
  assert.equal(receipt.exactTextScope, true);
  assert.equal(receipt.singleSceneOnly, true);
  assert.equal(receipt.publicRuntimeAdmitted, false);
  assert.equal(receipt.productWritePerformed, false);
  assert.equal(receipt.userProjectMutated, false);
  assert.equal(receipt.applyTxnImplemented, false);
  assert.equal(receipt.recoveryReady, false);
  assert.equal(receipt.releaseGreen, false);
  assert.equal(receipt.receiptCanonicalHash, canonicalHash(withoutHash(receipt, 'receiptCanonicalHash')));
  assert.equal(
    receipt.privateEvidenceReceiptHash,
    canonicalHash({
      evidenceKind: 'PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_EVIDENCE_V1_002M',
      contourId: 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_ONLY_002M',
      operationKind: 'EXACT_TEXT_REPLACE',
      source002JResultHash: input.source002JResultHash,
      source002JDecisionHash: input.source002JDecisionHash,
      source002JReceiptHash: input.source002JReceiptHash,
      backupObservationHash: input.source002JResult.receipt.backupObservationHash,
      atomicWriteObservationHash: input.source002JResult.receipt.atomicWriteObservationHash,
      beforeSceneHash: input.source002JResult.receipt.beforeSceneHash,
      afterSceneHash: input.source002JResult.receipt.afterSceneHash,
      blockVersionHash: input.source002JResult.receipt.blockVersionHash,
    }),
  );

  assert.equal(result.privateEvidenceReceiptHash, receipt.privateEvidenceReceiptHash);
  assert.equal(result.decisions[0].decisionKind, 'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_DECISION_002M');
  assert.equal(result.blockedReasons.length, 0);
});

test('002M blocks missing and mismatched 002J evidence hashes and stale/tampered source receipt binding', async () => {
  const {
    runExactTextApplyWithReceiptPrivateProductShapedReceiptHashBindingProof,
    EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES,
  } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const base = await acceptedInput();
  const tamperedSource = await acceptedInputWithPatched002J({
    receipt: {
      beforeSceneHash: canonicalHash({ tampered: 'before' }),
    },
  });
  tamperedSource.source002JResult.receipt.receiptCanonicalHash = base.source002JResult.receipt.receiptCanonicalHash;
  tamperedSource.source002JResult = withCanonicalHash(canonicalHash, {
    ...withoutHash(tamperedSource.source002JResult),
    receipt: tamperedSource.source002JResult.receipt,
  });
  tamperedSource.source002JResultHash = tamperedSource.source002JResult.canonicalHash;
  tamperedSource.source002JDecisionHash = tamperedSource.source002JResult.decisions[0].canonicalHash;
  tamperedSource.source002JReceiptHash = tamperedSource.source002JResult.receipt.receiptCanonicalHash;
  const missingReceipt = withCanonicalHash(canonicalHash, {
    ...withoutHash(base.source002JResult),
    receipt: null,
  });
  const nonObjectReceipt = withCanonicalHash(canonicalHash, {
    ...withoutHash(base.source002JResult),
    receipt: 'invalid-receipt-shape',
  });

  const cases = [
    { patch: { source002JResult: null }, code: 'SOURCE_002J_RESULT_REQUIRED' },
    { patch: { source002JResultHash: canonicalHash({ wrong: '002j-result' }) }, code: 'SOURCE_002J_RESULT_HASH_MISMATCH' },
    { patch: { source002JDecisionHash: canonicalHash({ wrong: '002j-decision' }) }, code: 'SOURCE_002J_DECISION_HASH_MISMATCH' },
    { patch: { source002JReceiptHash: canonicalHash({ wrong: '002j-receipt' }) }, code: 'SOURCE_002J_RECEIPT_HASH_MISMATCH' },
    { patch: { source002JResult: missingReceipt, source002JResultHash: missingReceipt.canonicalHash }, code: 'SOURCE_002J_BLOCKED' },
    { patch: { source002JResult: nonObjectReceipt, source002JResultHash: nonObjectReceipt.canonicalHash }, code: 'SOURCE_002J_BLOCKED' },
    { patch: tamperedSource, code: 'TAMPERED_RECEIPT_HASH' },
    { patch: { baselineStatus: 'STALE' }, code: 'STALE_BASELINE' },
    { patch: { expectedBlockVersionHash: canonicalHash({ wrong: 'block-version' }) }, code: 'BLOCK_VERSION_HASH_MISMATCH' },
    { patch: { operationKind: 'ARBITRARY_MISMATCHED_OPERATION' }, code: 'OPERATION_KIND_MISMATCH' },
  ];
  for (const item of cases) {
    const result = runExactTextApplyWithReceiptPrivateProductShapedReceiptHashBindingProof({ ...base, ...item.patch });
    assert.equal(result.outputDecision, 'PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_BLOCKED');
    assert.equal(result.productWriteCount, 0);
    assert.equal(result.blockedReasons.includes(
      EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES[item.code],
    ), true, item.code);
  }
});

test('002M blocks missing backup and atomic observation hashes in 002J receipt and failed 002J revalidation', async () => {
  const {
    runExactTextApplyWithReceiptPrivateProductShapedReceiptHashBindingProof,
    EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES,
  } = await loadModule();
  const { canonicalHash } = await loadKernel();
  const base = await acceptedInput();
  const missingBackup = await acceptedInputWithPatched002J({
    receipt: { backupObservationHash: '' },
  });
  missingBackup.source002JResult.receipt.receiptCanonicalHash = canonicalHash(withoutHash(missingBackup.source002JResult.receipt, 'receiptCanonicalHash'));
  missingBackup.source002JResult = withCanonicalHash(canonicalHash, {
    ...withoutHash(missingBackup.source002JResult),
    receipt: missingBackup.source002JResult.receipt,
  });
  missingBackup.source002JResultHash = missingBackup.source002JResult.canonicalHash;
  missingBackup.source002JDecisionHash = missingBackup.source002JResult.decisions[0].canonicalHash;
  missingBackup.source002JReceiptHash = missingBackup.source002JResult.receipt.receiptCanonicalHash;

  const missingAtomic = await acceptedInputWithPatched002J({
    receipt: { atomicWriteObservationHash: '' },
  });
  missingAtomic.source002JResult.receipt.receiptCanonicalHash = canonicalHash(withoutHash(missingAtomic.source002JResult.receipt, 'receiptCanonicalHash'));
  missingAtomic.source002JResult = withCanonicalHash(canonicalHash, {
    ...withoutHash(missingAtomic.source002JResult),
    receipt: missingAtomic.source002JResult.receipt,
  });
  missingAtomic.source002JResultHash = missingAtomic.source002JResult.canonicalHash;
  missingAtomic.source002JDecisionHash = missingAtomic.source002JResult.decisions[0].canonicalHash;
  missingAtomic.source002JReceiptHash = missingAtomic.source002JResult.receipt.receiptCanonicalHash;

  const revalidationFailure = runExactTextApplyWithReceiptPrivateProductShapedReceiptHashBindingProof({
    ...base,
    source002JRevalidationInput: null,
  });
  assert.equal(revalidationFailure.blockedReasons.includes(
    EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES.SOURCE_002J_REVALIDATION_INPUT_REQUIRED,
  ), true);

  const backupBlocked = runExactTextApplyWithReceiptPrivateProductShapedReceiptHashBindingProof(missingBackup);
  assert.equal(backupBlocked.blockedReasons.includes(
    EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES.MISSING_BACKUP_OBSERVATION_HASH,
  ), true);

  const atomicBlocked = runExactTextApplyWithReceiptPrivateProductShapedReceiptHashBindingProof(missingAtomic);
  assert.equal(atomicBlocked.blockedReasons.includes(
    EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES.MISSING_ATOMIC_WRITE_OBSERVATION_HASH,
  ), true);
});

test('002M blocks forbidden product runtime public scope command and governance claims', async () => {
  const {
    runExactTextApplyWithReceiptPrivateProductShapedReceiptHashBindingProof,
    EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES,
  } = await loadModule();
  const base = await acceptedInput();
  const cases = [
    { patch: { productWriteRequested: true }, code: 'PRODUCT_WRITE_REQUEST_FORBIDDEN' },
    { patch: { publicRuntimeRequested: true }, code: 'PUBLIC_RUNTIME_REQUEST_FORBIDDEN' },
    { patch: { ipcSurfaceClaimed: true }, code: 'IPC_PRELOAD_MENU_COMMAND_REQUEST_FORBIDDEN' },
    { patch: { preloadExportClaimed: true }, code: 'IPC_PRELOAD_MENU_COMMAND_REQUEST_FORBIDDEN' },
    { patch: { menuSurfaceClaimed: true }, code: 'IPC_PRELOAD_MENU_COMMAND_REQUEST_FORBIDDEN' },
    { patch: { commandSurfaceClaimed: true }, code: 'IPC_PRELOAD_MENU_COMMAND_REQUEST_FORBIDDEN' },
    { patch: { applyTxnImplemented: true }, code: 'APPLYTXN_RECOVERY_RELEASE_CLAIM_FORBIDDEN' },
    { patch: { recoveryReady: true }, code: 'APPLYTXN_RECOVERY_RELEASE_CLAIM_FORBIDDEN' },
    { patch: { releaseGreen: true }, code: 'APPLYTXN_RECOVERY_RELEASE_CLAIM_FORBIDDEN' },
    { patch: { noStructuralScope: false }, code: 'UNSUPPORTED_SCOPE_FORBIDDEN' },
    { patch: { noCommentScope: false }, code: 'UNSUPPORTED_SCOPE_FORBIDDEN' },
    { patch: { multiSceneScope: true }, code: 'UNSUPPORTED_SCOPE_FORBIDDEN' },
    { patch: { uiChanged: true }, code: 'UI_DOCX_NETWORK_DEPENDENCY_REQUEST_FORBIDDEN' },
    { patch: { docxImportClaimed: true }, code: 'UI_DOCX_NETWORK_DEPENDENCY_REQUEST_FORBIDDEN' },
    { patch: { networkUsed: true }, code: 'UI_DOCX_NETWORK_DEPENDENCY_REQUEST_FORBIDDEN' },
    { patch: { dependencyChanged: true }, code: 'UI_DOCX_NETWORK_DEPENDENCY_REQUEST_FORBIDDEN' },
    { patch: { changedBasenames: ['main.js'] }, code: 'FORBIDDEN_BASENAME_CHANGE' },
    { patch: { source001UActiveRuntimePrecedent: true }, code: 'SOURCE_001U_ACTIVE_RUNTIME_PRECEDENT_FORBIDDEN' },
    { patch: { governanceArtifactAsFeatureProof: true }, code: 'GOVERNANCE_ARTIFACT_FEATURE_PROOF_FORBIDDEN' },
  ];
  for (const item of cases) {
    const result = runExactTextApplyWithReceiptPrivateProductShapedReceiptHashBindingProof({ ...base, ...item.patch });
    assert.equal(result.outputDecision, 'PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_BLOCKED');
    assert.equal(result.blockedReasons.includes(
      EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_REASON_CODES[item.code],
    ), true, item.code);
  }
});

test('002M task record preserves proof-only receipt hash binding boundary', () => {
  const taskText = sourceText('docs', 'tasks', TASK_BASENAME);
  assert.match(taskText, /TASK_ID: PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_ONLY_002M/u);
  assert.match(taskText, /CONTOUR_TYPE: PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_ONLY/u);
  assert.match(taskText, /SOURCE_002J_RECHECK_REQUIRED: true/u);
  assert.match(taskText, /PRIVATE_EVIDENCE_RECEIPT_HASH_BOUND: true/u);
  assert.match(taskText, /PUBLIC_RUNTIME_ADMITTED: false/u);
  assert.match(taskText, /PRODUCT_WRITE_PERFORMED: false/u);
  assert.match(taskText, /APPLYTXN_IMPLEMENTED: false/u);
  assert.match(taskText, /RECOVERY_READY: false/u);
  assert.match(taskText, /RELEASE_GREEN: false/u);
  assert.doesNotMatch(taskText, /public runtime admitted true|product write performed true|release green true/iu);
});

test('002M changed scope stays allowlisted and module has no direct fs runtime or command surface imports', () => {
  const changedPaths = [
    ...gitLines(['diff', '--name-only', 'HEAD']),
    ...gitLines(['diff', '--cached', '--name-only']),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ].sort();
  const changedBasenames = changedBasenamesForCurrentContour();
  const allowedPaths = new Set([
    'docs/tasks/PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PRODUCT_SHAPED_RECEIPT_HASH_BINDING_PROOF_ONLY_002M.md',
    'src/revisionBridge/exactTextApplyWithReceiptPrivateProductShapedReceiptHashBindingProof.mjs',
    'test/contracts/exactTextApplyWithReceiptPrivateProductShapedReceiptHashBindingProof.contract.test.js',
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
  assert.notDeepEqual(changedBasenames, [], '002M must have detectable changed scope');
  for (const changedPath of changedPaths) {
    assert.equal(allowedPaths.has(changedPath), true, `unexpected 002M changed path: ${changedPath}`);
  }
  for (const basename of changedBasenames) {
    assert.equal(allowlist.has(basename), true, `unexpected 002M changed basename: ${basename}`);
    assert.equal(denylist.has(basename), false, `denylisted 002M changed basename: ${basename}`);
  }

  const moduleText = sourceText('src', 'revisionBridge', MODULE_BASENAME);
  const importLines = moduleText.split(/\r?\n/u).filter((line) => line.startsWith('import '));
  assert.deepEqual(importLines, [
    "import { canonicalHash } from './reviewIrKernel.mjs';",
    "import { runExactTextApplyWithReceiptPrivateControlledStorageFixturePortProof } from './exactTextApplyWithReceiptPrivateControlledStorageFixturePortProof.mjs';",
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
    assert.equal(pattern.test(moduleText), false, `forbidden 002M import pattern: ${pattern.source}`);
  }
});
