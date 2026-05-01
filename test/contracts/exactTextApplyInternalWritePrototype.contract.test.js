const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'exactTextApplyInternalWritePrototype.mjs';
const KERNEL_BASENAME = 'reviewIrKernel.mjs';
const TASK_BASENAME = 'EXACT_TEXT_APPLY_INTERNAL_WRITE_PATH_PROTOTYPE_001R.md';

async function loadPrototype() {
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

function sceneTextHash(canonicalHash, text) {
  return canonicalHash({
    hashKind: 'EXACT_TEXT_INTERNAL_WRITE_SCENE_TEXT_HASH_V1',
    text,
  });
}

function accepted001QResult(canonicalHash, overrides = {}) {
  const decisionCore = {
    productApplyAdmissionGateDecisionKind: 'EXACT_TEXT_PRODUCT_APPLY_ADMISSION_GATE_DECISION',
    outputDecision: 'OWNER_MAY_OPEN_EXACT_TEXT_PRODUCT_WRITE_IMPLEMENTATION_001R',
    nextContourAfterPass: 'EXACT_TEXT_APPLY_PRODUCT_WRITE_IMPLEMENTATION_001R',
    productWriteImplementationAllowedIn001Q: false,
    productWritePerformed: false,
    productWriteClaimed: false,
    publicSurfaceClaimed: false,
    applyReceiptImplemented: false,
    applyTxnClaimed: false,
  };
  const decision = { ...decisionCore, canonicalHash: canonicalHash(decisionCore) };
  const resultCore = {
    resultKind: 'EXACT_TEXT_PRODUCT_APPLY_ADMISSION_GATE_RESULT',
    productApplyAdmissionPlanningGateCompleted: true,
    productApplyAdmissionToOpen001RAllowed: true,
    outputDecision: 'OWNER_MAY_OPEN_EXACT_TEXT_PRODUCT_WRITE_IMPLEMENTATION_001R',
    nextContourAfterPass: 'EXACT_TEXT_APPLY_PRODUCT_WRITE_IMPLEMENTATION_001R',
    productWriteImplementationAllowedIn001Q: false,
    productWritePerformed: false,
    productWriteClaimed: false,
    publicSurfaceClaimed: false,
    durableReceiptClaimed: false,
    applyReceiptImplemented: false,
    applyTxnClaimed: false,
    blockedReasons: [],
    productApplyAdmissionGateDecisions: [decision],
    ...overrides,
  };
  return { ...resultCore, canonicalHash: canonicalHash(resultCore) };
}

function baseInput(canonicalHash, fixtureProjectRoot, overrides = {}) {
  const exactBeforeText = 'before exact text';
  const exactAfterText = 'after exact text';
  const blockVersionHash = canonicalHash({ block: 'scene-001-block-version-v1' });
  const admission = accepted001QResult(canonicalHash);
  return {
    productApplyAdmissionGateResult001Q: admission,
    source001QDecisionHash: admission.productApplyAdmissionGateDecisions[0].canonicalHash,
    sourceApplyOpHash: canonicalHash({ source: '001r-apply-op' }),
    sourceEffectPreviewHash: canonicalHash({ source: '001r-effect-preview' }),
    fixtureProjectRoot,
    osTempFixtureRootOnly: true,
    fixtureProjectRootInsideTempRoot: true,
    fixtureProjectRootIsProductRoot: false,
    userProjectPathAllowedIn001R: false,
    internalFixtureWritePrototypeAllowedIn001R: true,
    userProjectRootAccess: false,
    productRootAccess: false,
    repoRootAccess: false,
    projectId: 'fixture-project-001',
    expectedProjectId: 'fixture-project-001',
    sceneId: 'scene-001',
    expectedSceneId: 'scene-001',
    sceneFileBasename: 'scene-001.txt',
    exactBeforeText,
    exactAfterText,
    expectedBaselineHash: sceneTextHash(canonicalHash, exactBeforeText),
    expectedAfterSceneHash: sceneTextHash(canonicalHash, exactAfterText),
    currentBlockVersionHash: blockVersionHash,
    expectedBlockVersionHash: blockVersionHash,
    sessionOpen: true,
    operationKind: 'EXACT_TEXT_REPLACE',
    singleSceneScope: true,
    lowRiskExactTextOnly: true,
    commentApplyClaimed: false,
    commentOperation: false,
    structuralApplyClaimed: false,
    structuralOperation: false,
    multiSceneApplyClaimed: false,
    ...overrides,
  };
}

async function withFixture(callback) {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'exact-text-001r-'));
  try {
    await fsp.writeFile(path.join(root, 'scene-001.txt'), 'before exact text', 'utf8');
    return await callback(root);
  } finally {
    await fsp.rm(root, { recursive: true, force: true });
  }
}

async function withElectronDocumentsStub(documentsPath, callback) {
  const originalLoad = Module._load;
  const fileManagerPath = path.join(process.cwd(), 'src', 'utils', 'fileManager.js');
  const backupManagerPath = path.join(process.cwd(), 'src', 'utils', 'backupManager.js');
  delete require.cache[require.resolve(fileManagerPath)];
  delete require.cache[require.resolve(backupManagerPath)];
  Module._load = function load(request, parent, isMain) {
    if (request === 'electron') {
      return {
        app: {
          getPath(name) {
            assert.equal(name, 'documents');
            return documentsPath;
          },
        },
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const fileManager = require(fileManagerPath);
    const backupManager = require(backupManagerPath);
    return await callback({ fileManager, backupManager });
  } finally {
    Module._load = originalLoad;
    delete require.cache[require.resolve(fileManagerPath)];
    delete require.cache[require.resolve(backupManagerPath)];
  }
}

async function countBackupPayloads(root) {
  const backupsRoot = path.join(root, 'backups');
  const entries = [];
  async function walk(current) {
    const children = await fsp.readdir(current, { withFileTypes: true }).catch(() => []);
    for (const child of children) {
      const childPath = path.join(current, child.name);
      if (child.isDirectory()) {
        await walk(childPath);
      } else if (child.name !== 'meta.json') {
        entries.push(childPath);
      }
    }
  }
  await walk(backupsRoot);
  return entries;
}

test('001R executes fixture-only backup plus atomic write through existing primitives and emits draft receipt', async () => {
  const { canonicalHash } = await loadKernel();
  const { runExactTextApplyInternalWritePrototype } = await loadPrototype();

  await withFixture(async (root) => withElectronDocumentsStub(root, async ({ fileManager, backupManager }) => {
    const calls = [];
    const result = await runExactTextApplyInternalWritePrototype(baseInput(canonicalHash, root, {
      storagePorts: {
        async createBackup(...args) {
          calls.push('createBackup');
          return backupManager.createBackup(...args);
        },
        async writeFileAtomic(...args) {
          calls.push('writeFileAtomic');
          return fileManager.writeFileAtomic(...args);
        },
      },
    }));

    assert.equal(result.outputDecision, 'INTERNAL_FIXTURE_WRITE_PATH_PROTOTYPE_OBSERVED');
    assert.equal(result.internalFixtureWritePrototypeObserved, true);
    assert.equal(result.fixtureWritePerformed, true);
    assert.equal(result.fixtureBackupCreated, true);
    assert.equal(result.fixtureAtomicWriteExecuted, true);
    assert.equal(result.productWritePerformed, false);
    assert.equal(result.productWriteClaimed, false);
    assert.equal(result.applyReceiptImplemented, false);
    assert.equal(result.durableReceiptClaimed, false);
    assert.equal(result.applyTxnClaimed, false);
    assert.deepEqual(calls, ['createBackup', 'writeFileAtomic']);
    assert.equal(await fsp.readFile(path.join(root, 'scene-001.txt'), 'utf8'), 'after exact text');

    const backupPayloads = await countBackupPayloads(root);
    assert.equal(backupPayloads.length, 1);
    assert.equal(await fsp.readFile(backupPayloads[0], 'utf8'), 'before exact text');
    assert.equal(result.receiptDraft.receiptDraftKind, 'EXACT_TEXT_INTERNAL_WRITE_RECEIPT_DRAFT_001R');
    assert.equal(result.receiptDraft.receiptDraftOnly, true);
    assert.equal(result.receiptDraft.durableReceiptClaimed, false);
  }));
});

test('001R stale baseline blocks before backup and write', async () => {
  const { canonicalHash } = await loadKernel();
  const { runExactTextApplyInternalWritePrototype, INTERNAL_WRITE_PROTOTYPE_REASON_CODES } = await loadPrototype();
  await withFixture(async (root) => {
    const calls = [];
    const result = await runExactTextApplyInternalWritePrototype(baseInput(canonicalHash, root, {
      expectedBaselineHash: canonicalHash({ wrong: 'baseline' }),
      storagePorts: {
        async createBackup() {
          calls.push('createBackup');
          return { success: true };
        },
        async writeFileAtomic() {
          calls.push('writeFileAtomic');
          return { success: true };
        },
      },
    }));
    assert.equal(result.outputDecision, 'INTERNAL_WRITE_PATH_REMAINS_BLOCKED');
    assert.equal(result.blockedReasons.includes(INTERNAL_WRITE_PROTOTYPE_REASON_CODES.STALE_BASELINE), true);
    assert.deepEqual(calls, []);
    assert.equal(await fsp.readFile(path.join(root, 'scene-001.txt'), 'utf8'), 'before exact text');
  });
});

test('001R exact text mismatch blocks before backup and write', async () => {
  const { canonicalHash } = await loadKernel();
  const { runExactTextApplyInternalWritePrototype, INTERNAL_WRITE_PROTOTYPE_REASON_CODES } = await loadPrototype();
  await withFixture(async (root) => {
    const result = await runExactTextApplyInternalWritePrototype(baseInput(canonicalHash, root, {
      exactBeforeText: 'different source text',
      storagePorts: {
        async createBackup() {
          throw new Error('backup must not run');
        },
        async writeFileAtomic() {
          throw new Error('write must not run');
        },
      },
    }));
    assert.equal(result.outputDecision, 'INTERNAL_WRITE_PATH_REMAINS_BLOCKED');
    assert.equal(result.blockedReasons.includes(INTERNAL_WRITE_PROTOTYPE_REASON_CODES.EXACT_TEXT_MISMATCH), true);
    assert.equal(await fsp.readFile(path.join(root, 'scene-001.txt'), 'utf8'), 'before exact text');
  });
});

test('001R missing source binding hashes block before backup and write', async () => {
  const { canonicalHash } = await loadKernel();
  const { runExactTextApplyInternalWritePrototype, INTERNAL_WRITE_PROTOTYPE_REASON_CODES } = await loadPrototype();
  await withFixture(async (root) => {
    const calls = [];
    const result = await runExactTextApplyInternalWritePrototype(baseInput(canonicalHash, root, {
      sourceApplyOpHash: '',
      sourceEffectPreviewHash: '',
      storagePorts: {
        async createBackup() {
          calls.push('createBackup');
          return { success: true };
        },
        async writeFileAtomic() {
          calls.push('writeFileAtomic');
          return { success: true };
        },
      },
    }));
    assert.equal(result.outputDecision, 'INTERNAL_WRITE_PATH_REMAINS_BLOCKED');
    assert.equal(result.blockedReasons.includes(
      INTERNAL_WRITE_PROTOTYPE_REASON_CODES.SOURCE_BINDING_REQUIRED,
    ), true);
    assert.deepEqual(calls, []);
    assert.equal(await fsp.readFile(path.join(root, 'scene-001.txt'), 'utf8'), 'before exact text');
  });
});

test('001R mismatched 001Q source binding hashes block before backup and write', async () => {
  const { canonicalHash } = await loadKernel();
  const { runExactTextApplyInternalWritePrototype, INTERNAL_WRITE_PROTOTYPE_REASON_CODES } = await loadPrototype();
  await withFixture(async (root) => {
    const contaminatedAdmission = accepted001QResult(canonicalHash);
    contaminatedAdmission.productApplyAdmissionGateDecisions[0] = {
      ...contaminatedAdmission.productApplyAdmissionGateDecisions[0],
      canonicalHash: 'tampered-decision-hash',
    };
    const calls = [];
    const result = await runExactTextApplyInternalWritePrototype(baseInput(canonicalHash, root, {
      productApplyAdmissionGateResult001Q: contaminatedAdmission,
      source001QDecisionHash: 'different-decision-hash',
      storagePorts: {
        async createBackup() {
          calls.push('createBackup');
          return { success: true };
        },
        async writeFileAtomic() {
          calls.push('writeFileAtomic');
          return { success: true };
        },
      },
    }));
    assert.equal(result.outputDecision, 'INTERNAL_WRITE_PATH_REMAINS_BLOCKED');
    assert.equal(result.blockedReasons.includes(
      INTERNAL_WRITE_PROTOTYPE_REASON_CODES.SOURCE_BINDING_MISMATCH,
    ), true);
    assert.deepEqual(calls, []);
    assert.equal(await fsp.readFile(path.join(root, 'scene-001.txt'), 'utf8'), 'before exact text');
  });
});

test('001R unsafe scene path and symlink target are rejected before write', async () => {
  const { canonicalHash } = await loadKernel();
  const { runExactTextApplyInternalWritePrototype, INTERNAL_WRITE_PROTOTYPE_REASON_CODES } = await loadPrototype();
  await withFixture(async (root) => {
    const pathTraversal = await runExactTextApplyInternalWritePrototype(baseInput(canonicalHash, root, {
      sceneFileBasename: '../scene-001.txt',
      storagePorts: {
        async createBackup() {
          throw new Error('backup must not run');
        },
        async writeFileAtomic() {
          throw new Error('write must not run');
        },
      },
    }));
    assert.equal(pathTraversal.blockedReasons.includes(
      INTERNAL_WRITE_PROTOTYPE_REASON_CODES.SCENE_FILE_BASENAME_REQUIRED,
    ), true);

    const outside = path.join(os.tmpdir(), `exact-text-001r-outside-${Date.now()}.txt`);
    await fsp.writeFile(outside, 'before exact text', 'utf8');
    await fsp.symlink(outside, path.join(root, 'linked.txt'));
    const symlinkResult = await runExactTextApplyInternalWritePrototype(baseInput(canonicalHash, root, {
      sceneFileBasename: 'linked.txt',
      storagePorts: {
        async createBackup() {
          throw new Error('backup must not run');
        },
        async writeFileAtomic() {
          throw new Error('write must not run');
        },
      },
    }));
    assert.equal(symlinkResult.blockedReasons.includes(
      INTERNAL_WRITE_PROTOTYPE_REASON_CODES.PATH_BOUNDARY_VIOLATION,
    ), true);
    assert.equal(symlinkResult.blockedReasons.includes(
      INTERNAL_WRITE_PROTOTYPE_REASON_CODES.SCENE_FILE_SYMLINK_FORBIDDEN,
    ), true);
    await fsp.rm(outside, { force: true });
  });
});

test('001R malformed 001Q admission result blocks write', async () => {
  const { canonicalHash } = await loadKernel();
  const { runExactTextApplyInternalWritePrototype, INTERNAL_WRITE_PROTOTYPE_REASON_CODES } = await loadPrototype();
  await withFixture(async (root) => {
    const result = await runExactTextApplyInternalWritePrototype(baseInput(canonicalHash, root, {
      productApplyAdmissionGateResult001Q: accepted001QResult(canonicalHash, {
        productWritePerformed: true,
      }),
      storagePorts: {
        async createBackup() {
          throw new Error('backup must not run');
        },
        async writeFileAtomic() {
          throw new Error('write must not run');
        },
      },
    }));
    assert.equal(result.blockedReasons.includes(
      INTERNAL_WRITE_PROTOTYPE_REASON_CODES.PRODUCT_WRITE_STILL_FORBIDDEN,
    ), true);
    assert.equal(await fsp.readFile(path.join(root, 'scene-001.txt'), 'utf8'), 'before exact text');
  });
});

test('001R atomic write failure reports no product claim and keeps original when port fails before mutation', async () => {
  const { canonicalHash } = await loadKernel();
  const { runExactTextApplyInternalWritePrototype, INTERNAL_WRITE_PROTOTYPE_REASON_CODES } = await loadPrototype();
  await withFixture(async (root) => {
    const result = await runExactTextApplyInternalWritePrototype(baseInput(canonicalHash, root, {
      storagePorts: {
        async createBackup() {
          return { success: true };
        },
        async writeFileAtomic() {
          return { success: false, error: 'simulated write failure' };
        },
      },
    }));
    assert.equal(result.blockedReasons.includes(INTERNAL_WRITE_PROTOTYPE_REASON_CODES.ATOMIC_WRITE_FAILED), true);
    assert.equal(result.productWritePerformed, false);
    assert.equal(result.productWriteClaimed, false);
    assert.equal(await fsp.readFile(path.join(root, 'scene-001.txt'), 'utf8'), 'before exact text');
  });
});

test('001R task record preserves fixture-only boundary', () => {
  const taskText = sourceText('docs', 'tasks', TASK_BASENAME);
  assert.match(taskText, /STATUS: IMPLEMENTED_LOCALLY_PENDING_DELIVERY_VERIFICATION/u);
  assert.match(taskText, /INTERNAL_FIXTURE_WRITE_PROTOTYPE_ALLOWED_IN_001R: true/u);
  assert.match(taskText, /USER_PROJECT_PATH_ALLOWED_IN_001R: false/u);
  assert.match(taskText, /PRODUCT_WRITE_PERFORMED: false/u);
  assert.match(taskText, /APPLYRECEIPT_IMPLEMENTED: false/u);
  assert.match(taskText, /APPLYTXN_IMPLEMENTED: false/u);
  assert.match(taskText, /PUBLIC_SURFACE_CLAIMED: false/u);
  assert.match(taskText, /UI_SCREENSHOT_CHECK: NOT_APPLICABLE_NO_UI_CHANGE/u);
  assert.match(taskText, /NEXT_CONTOUR_AFTER_PASS: EXACT_TEXT_APPLY_DURABLE_RECEIPT_AND_FAILURE_RECEIPT_001S/u);
  assert.match(taskText, /COMMIT_SHA: pending/u);
  assert.match(taskText, /PUSH_RESULT: pending/u);
  assert.match(taskText, /PR_RESULT: pending/u);
  assert.match(taskText, /MERGE_RESULT: pending/u);
  assert.doesNotMatch(taskText, /public apply|DOCX runtime|release green|ApplyTxn implemented|durable ApplyReceipt/iu);
});

test('001R changed scope stays allowlisted and storage imports stay out of pure kernel', () => {
  const changedBasenames = changedBasenamesForCurrentContour();
  const allowlist = new Set([
    MODULE_BASENAME,
    'exactTextApplyFixtureDurableReceiptPrototype.mjs',
    'exactTextApplyPrivateProductApplyReceiptAdmission.mjs',
    'exactTextApplyPrivateProductApplyReceipt.mjs',
    'exactTextApplyWithReceiptAdmission.mjs',
    'exactTextApplyWithReceiptExecution.mjs',
    'exactTextApplyWithReceiptCloseout.mjs',
    'exactTextApplyWithReceiptNextAdmission.mjs',
    KERNEL_BASENAME,
    'exactTextApplyInternalWritePrototype.contract.test.js',
    'exactTextApplyFixtureDurableReceiptPrototype.contract.test.js',
    'exactTextApplyPrivateProductApplyReceiptAdmission.contract.test.js',
    'exactTextApplyPrivateProductApplyReceipt.contract.test.js',
    'exactTextApplyWithReceiptAdmission.contract.test.js',
    'exactTextApplyWithReceiptExecution.contract.test.js',
    'exactTextApplyWithReceiptCloseout.contract.test.js',
    'exactTextApplyWithReceiptNextAdmission.contract.test.js',
    'EXACT_TEXT_APPLY_FIXTURE_DURABLE_RECEIPT_AND_FAILURE_RECEIPT_001S.md',
    'PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_001T.md',
    'PRIVATE_PRODUCT_APPLY_RECEIPT_IMPLEMENTATION_001U.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_001V.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_001W.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_001X.md',
    'PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_ADMISSION_001Y.md',
    'exactTextApplyProductApplyAdmissionGate.contract.test.js',
    'exactTextApplyProductApplyReadinessReview.contract.test.js',
    'exactTextApplyProductStoragePrimitiveEvidence.contract.test.js',
    'exactTextApplyTestFixtureReceiptFile.contract.test.js',
    'exactTextApplyTestOnlyProductShapedStorageDryRun.contract.test.js',
    'exactTextApplyTestOnlyStoragePrimitiveExecutionHarness.contract.test.js',
    'revision-bridge-pre-stage-00-admission-guard-state.mjs',
    'EXACT_TEXT_APPLY_PRODUCT_APPLY_ADMISSION_GATE_001Q.md',
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
    'TOKEN_CATALOG.json',
    'CRITICAL_CLAIM_MATRIX.json',
    'REQUIRED_TOKEN_SET.json',
    'FAILSIGNAL_REGISTRY.json',
  ]);
  assert.notDeepEqual(changedBasenames, [], '001R must have detectable changed scope');
  for (const basename of changedBasenames) {
    assert.equal(allowlist.has(basename), true, `unexpected 001R changed basename: ${basename}`);
    assert.equal(denylist.has(basename), false, `denylisted 001R changed basename: ${basename}`);
  }

  const kernelText = sourceText('src', 'revisionBridge', KERNEL_BASENAME);
  const prototypeText = sourceText('src', 'revisionBridge', MODULE_BASENAME);
  const forbiddenPureKernelPatterns = [
    /from\s+['"][^'"]*backupManager[^'"]*['"]/u,
    /from\s+['"][^'"]*fileManager[^'"]*['"]/u,
    /require\s*\(\s*['"][^'"]*backupManager[^'"]*['"]\s*\)/u,
    /require\s*\(\s*['"][^'"]*fileManager[^'"]*['"]\s*\)/u,
    /from\s+['"]electron['"]/u,
    /require\s*\(\s*['"]electron['"]\s*\)/u,
  ];
  for (const pattern of forbiddenPureKernelPatterns) {
    assert.equal(pattern.test(kernelText), false, `forbidden pure kernel import pattern: ${pattern.source}`);
  }
  assert.equal(/from\s+['"]electron['"]/u.test(prototypeText), false);
  assert.equal(/require\s*\(\s*['"]electron['"]\s*\)/u.test(prototypeText), false);
  assert.equal(/from\s+['"][^'"]*(?:main|preload|editor|command-catalog|projectCommands)[^'"]*['"]/u.test(prototypeText), false);
});
