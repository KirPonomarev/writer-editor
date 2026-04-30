const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'reviewIrKernel.mjs';
const TASK_BASENAME = 'EXACT_TEXT_APPLY_WRITE_PLAN_AND_RECEIPT_CONTRACT_001D.md';

async function loadKernel() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

function exactTextDecision(overrides = {}) {
  const item = {
    id: 'decision-1',
    kind: 'TEXT_REPLACE',
    targetScope: { sceneId: 'scene-1', blockId: 'block-1' },
    blockVersionHash: 'block-v1',
    selectors: [
      {
        selectorKind: 'TEXT_QUOTE',
        selectorEvidence: { exact: 'old text', prefix: 'before', suffix: 'after' },
      },
    ],
    evidence: [{ exactText: 'old text', prefix: 'before', suffix: 'after' }],
    expectedText: 'old text',
    replacementText: 'new text',
    ...(overrides.item || {}),
  };
  return {
    projectId: 'project-1',
    artifactHash: 'artifact-a',
    contextHash: 'baseline-a',
    sourceViewState: {
      revisionToken: 'rev-1',
      viewMode: 'inline',
      normalizationPolicy: 'TEXT_V1',
      newlinePolicy: 'LF',
      unicodePolicy: 'NFC',
      artifactCompletenessClass: 'TEXT_ONLY',
    },
    items: [item],
    ...overrides.surface,
  };
}

function acceptedEnvironment(overrides = {}) {
  return {
    projectId: 'project-1',
    currentBaselineHash: 'baseline-a',
    sessionOpen: true,
    sceneId: 'scene-1',
    currentBlockVersions: { 'block-1': 'block-v1' },
    currentTextByBlock: { 'block-1': 'old text' },
    ...overrides,
  };
}

async function acceptedInputs(overrides = {}) {
  const {
    buildReviewPatchSet,
    compileExactTextApplyOps,
    compileExactTextApplyEffectPreviews,
  } = await loadKernel();
  const applyResult = compileExactTextApplyOps(
    buildReviewPatchSet(exactTextDecision(overrides.decision || {})),
    acceptedEnvironment(overrides.environment || {}),
  );
  const effectPreviewPlan = compileExactTextApplyEffectPreviews(applyResult);
  return { applyResult, effectPreviewPlan };
}

test('accepted exact text contract compiles one write plan and one in-memory receipt contract', async () => {
  const { compileExactTextWritePlanReceiptContract, canonicalHash } = await loadKernel();
  const input = await acceptedInputs();
  const first = compileExactTextWritePlanReceiptContract(input);
  const second = compileExactTextWritePlanReceiptContract(input);

  assert.deepEqual(first, second);
  assert.equal(first.contractOnly, true);
  assert.equal(first.productWrite, false);
  assert.equal(first.durableReceipt, false);
  assert.equal(first.storageSafetyClaimed, false);
  assert.equal(first.crashRecoveryClaimed, false);
  assert.equal(first.applyTxnClaimed, false);
  assert.equal(first.publicSurfaceClaimed, false);
  assert.equal(first.docxImportClaimed, false);
  assert.equal(first.releaseClaimed, false);
  assert.equal(first.runtimeWritable, false);
  assert.deepEqual(first.blockedReasons, []);
  assert.equal(first.writePlans.length, 1);
  assert.equal(first.receiptContracts.length, 1);

  const applyOp = input.applyResult.applyOps[0];
  const effectPreview = input.effectPreviewPlan.effectPreviews[0];
  const writePlan = first.writePlans[0];
  assert.deepEqual(Object.keys(writePlan).sort(), [
    'afterHashExpected',
    'baselineHash',
    'beforeHash',
    'blockVersionHash',
    'canonicalHash',
    'durableWrite',
    'effectPreviewHash',
    'effectPreviewId',
    'exactTextAfter',
    'exactTextBefore',
    'productWrite',
    'projectId',
    'requiresAtomicSceneWrite',
    'requiresBackupBeforeWrite',
    'requiresReadableRecoverySnapshot',
    'runtimeWritable',
    'sceneId',
    'sourceApplyOpHash',
    'sourceApplyOpId',
    'writePlanId',
    'writePlanKind',
  ].sort());
  assert.equal(writePlan.writePlanKind, 'EXACT_TEXT_REPLACE_WRITE_PLAN_CONTRACT');
  assert.equal(writePlan.productWrite, false);
  assert.equal(writePlan.durableWrite, false);
  assert.equal(writePlan.runtimeWritable, false);
  assert.equal(writePlan.sourceApplyOpId, applyOp.opId);
  assert.equal(writePlan.sourceApplyOpHash, applyOp.canonicalHash);
  assert.equal(writePlan.effectPreviewId, effectPreview.effectPreviewId);
  assert.equal(writePlan.effectPreviewHash, effectPreview.canonicalHash);
  assert.equal(writePlan.projectId, 'project-1');
  assert.equal(writePlan.sceneId, 'scene-1');
  assert.equal(writePlan.baselineHash, 'baseline-a');
  assert.equal(writePlan.blockVersionHash, 'block-v1');
  assert.equal(writePlan.exactTextBefore, 'old text');
  assert.equal(writePlan.exactTextAfter, 'new text');
  assert.equal(writePlan.beforeHash, effectPreview.beforeHash);
  assert.equal(writePlan.afterHashExpected, effectPreview.afterHashPreview);
  assert.equal(writePlan.requiresBackupBeforeWrite, true);
  assert.equal(writePlan.requiresAtomicSceneWrite, true);
  assert.equal(writePlan.requiresReadableRecoverySnapshot, true);
  assert.equal(writePlan.canonicalHash, canonicalHash({
    writePlanId: writePlan.writePlanId,
    writePlanKind: writePlan.writePlanKind,
    productWrite: writePlan.productWrite,
    durableWrite: writePlan.durableWrite,
    runtimeWritable: writePlan.runtimeWritable,
    sourceApplyOpId: writePlan.sourceApplyOpId,
    sourceApplyOpHash: writePlan.sourceApplyOpHash,
    effectPreviewId: writePlan.effectPreviewId,
    effectPreviewHash: writePlan.effectPreviewHash,
    projectId: writePlan.projectId,
    sceneId: writePlan.sceneId,
    baselineHash: writePlan.baselineHash,
    blockVersionHash: writePlan.blockVersionHash,
    exactTextBefore: writePlan.exactTextBefore,
    exactTextAfter: writePlan.exactTextAfter,
    beforeHash: writePlan.beforeHash,
    afterHashExpected: writePlan.afterHashExpected,
    requiresBackupBeforeWrite: writePlan.requiresBackupBeforeWrite,
    requiresAtomicSceneWrite: writePlan.requiresAtomicSceneWrite,
    requiresReadableRecoverySnapshot: writePlan.requiresReadableRecoverySnapshot,
  }));

  const receipt = first.receiptContracts[0];
  assert.deepEqual(Object.keys(receipt).sort(), [
    'afterHash',
    'atomicSceneWriteRequired',
    'backupRequired',
    'beforeHash',
    'canonicalHash',
    'durableReceipt',
    'effectPreviewHash',
    'effectPreviewId',
    'productWrite',
    'projectId',
    'readableRecoverySnapshotRequired',
    'reasonCodes',
    'receiptContractId',
    'receiptKind',
    'resultStatus',
    'runtimeWritable',
    'sceneId',
    'sourceApplyOpHash',
    'sourceApplyOpId',
    'writePlanHash',
    'writePlanId',
  ].sort());
  assert.equal(receipt.receiptKind, 'EXACT_TEXT_REPLACE_RECEIPT_CONTRACT');
  assert.equal(receipt.productWrite, false);
  assert.equal(receipt.durableReceipt, false);
  assert.equal(receipt.runtimeWritable, false);
  assert.equal(receipt.resultStatus, 'PLANNED_NOT_EXECUTED');
  assert.deepEqual(receipt.reasonCodes, []);
  assert.equal(receipt.writePlanId, writePlan.writePlanId);
  assert.equal(receipt.writePlanHash, writePlan.canonicalHash);
  assert.equal(receipt.beforeHash, writePlan.beforeHash);
  assert.equal(receipt.afterHash, writePlan.afterHashExpected);
  assert.equal(receipt.backupRequired, true);
  assert.equal(receipt.atomicSceneWriteRequired, true);
  assert.equal(receipt.readableRecoverySnapshotRequired, true);
});

test('write plan and receipt contract hash changes with source hashes and text hashes', async () => {
  const { compileExactTextWritePlanReceiptContract } = await loadKernel();
  const baseInput = await acceptedInputs();
  const base = compileExactTextWritePlanReceiptContract(baseInput);
  const changedApplyOpHash = compileExactTextWritePlanReceiptContract({
    ...baseInput,
    applyResult: {
      ...baseInput.applyResult,
      applyOps: [{ ...baseInput.applyResult.applyOps[0], canonicalHash: 'changed-apply-hash' }],
    },
  });
  const changedPreviewHash = compileExactTextWritePlanReceiptContract({
    ...baseInput,
    effectPreviewPlan: {
      ...baseInput.effectPreviewPlan,
      effectPreviews: [{ ...baseInput.effectPreviewPlan.effectPreviews[0], canonicalHash: 'changed-preview-hash' }],
    },
  });
  const changedTextInput = await acceptedInputs({
    decision: { item: { replacementText: 'changed text' } },
  });
  const changedText = compileExactTextWritePlanReceiptContract(changedTextInput);

  assert.notEqual(base.canonicalHash, changedApplyOpHash.canonicalHash);
  assert.notEqual(base.canonicalHash, changedPreviewHash.canonicalHash);
  assert.notEqual(base.canonicalHash, changedText.canonicalHash);
  assert.notEqual(base.receiptContracts[0].canonicalHash, changedText.receiptContracts[0].canonicalHash);
});

test('blocked apply results and preview mismatch produce zero write plans', async () => {
  const { buildReviewPatchSet, compileExactTextApplyOps, compileExactTextApplyEffectPreviews, compileExactTextWritePlanReceiptContract, REASON_CODES } = await loadKernel();
  const blockedApplyResult = compileExactTextApplyOps(
    buildReviewPatchSet(exactTextDecision()),
    acceptedEnvironment({ currentBaselineHash: 'baseline-b' }),
  );
  const blockedPreviewPlan = compileExactTextApplyEffectPreviews(blockedApplyResult);
  const blocked = compileExactTextWritePlanReceiptContract({
    applyResult: blockedApplyResult,
    effectPreviewPlan: blockedPreviewPlan,
  });
  const accepted = await acceptedInputs();
  const mismatch = compileExactTextWritePlanReceiptContract({
    ...accepted,
    effectPreviewPlan: {
      ...accepted.effectPreviewPlan,
      effectPreviews: [{ ...accepted.effectPreviewPlan.effectPreviews[0], sourceApplyOpHash: 'wrong-hash' }],
    },
  });

  assert.deepEqual(blocked.writePlans, []);
  assert.deepEqual(blocked.receiptContracts, []);
  assert.equal(blocked.blockedReasons.includes(REASON_CODES.STALE_BASELINE), true);
  assert.deepEqual(mismatch.writePlans, []);
  assert.deepEqual(mismatch.receiptContracts, []);
  assert.equal(mismatch.blockedReasons.includes(REASON_CODES.EFFECT_PREVIEW_MISMATCH), true);
});

test('product write request and non-contract inputs are blocked without claims', async () => {
  const { compileExactTextWritePlanReceiptContract, REASON_CODES } = await loadKernel();
  const input = await acceptedInputs();
  const cases = [
    [
      REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR,
      { ...input, productWrite: true },
    ],
    [
      REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR,
      { ...input, runtimeWritable: true },
    ],
    [
      REASON_CODES.NON_CONTRACT_APPLYOP_FORBIDDEN,
      { ...input, applyResult: { ...input.applyResult, contractOnly: false } },
    ],
    [
      REASON_CODES.RUNTIME_WRITE_FORBIDDEN_IN_CONTOUR,
      { ...input, effectPreviewPlan: { ...input.effectPreviewPlan, runtimeWritable: true } },
    ],
  ];

  for (const [reasonCode, candidate] of cases) {
    const result = compileExactTextWritePlanReceiptContract(candidate);
    assert.deepEqual(result.writePlans, [], reasonCode);
    assert.deepEqual(result.receiptContracts, [], reasonCode);
    assert.equal(result.productWrite, false, reasonCode);
    assert.equal(result.durableReceipt, false, reasonCode);
    assert.equal(result.storageSafetyClaimed, false, reasonCode);
    assert.equal(result.crashRecoveryClaimed, false, reasonCode);
    assert.equal(result.applyTxnClaimed, false, reasonCode);
    assert.equal(result.publicSurfaceClaimed, false, reasonCode);
    assert.equal(result.docxImportClaimed, false, reasonCode);
    assert.equal(result.releaseClaimed, false, reasonCode);
    assert.equal(result.runtimeWritable, false, reasonCode);
    assert.equal(result.blockedReasons.includes(reasonCode), true, reasonCode);
  }
});

test('missing preview identity fields and stale source inputs produce zero write plans', async () => {
  const { buildReviewPatchSet, compileExactTextApplyOps, compileExactTextApplyEffectPreviews, compileExactTextWritePlanReceiptContract, REASON_CODES } = await loadKernel();
  const accepted = await acceptedInputs();
  const cases = [
    [
      REASON_CODES.EFFECT_PRECONDITION_MISSING,
      {
        ...accepted,
        effectPreviewPlan: {
          ...accepted.effectPreviewPlan,
          effectPreviews: [{ ...accepted.effectPreviewPlan.effectPreviews[0], canonicalHash: '' }],
        },
      },
    ],
    [
      REASON_CODES.EFFECT_PREVIEW_MISMATCH,
      {
        ...accepted,
        effectPreviewPlan: {
          ...accepted.effectPreviewPlan,
          effectPreviews: [{ ...accepted.effectPreviewPlan.effectPreviews[0], beforeHash: 'wrong-before-hash' }],
        },
      },
    ],
    [
      REASON_CODES.EFFECT_PREVIEW_MISMATCH,
      {
        ...accepted,
        effectPreviewPlan: {
          ...accepted.effectPreviewPlan,
          effectPreviews: [{ ...accepted.effectPreviewPlan.effectPreviews[0], afterHashPreview: 'wrong-after-hash' }],
        },
      },
    ],
    [
      REASON_CODES.WRONG_PROJECT,
      {
        applyResult: compileExactTextApplyOps(
          buildReviewPatchSet(exactTextDecision()),
          acceptedEnvironment({ projectId: 'project-2' }),
        ),
        effectPreviewPlan: compileExactTextApplyEffectPreviews(compileExactTextApplyOps(
          buildReviewPatchSet(exactTextDecision()),
          acceptedEnvironment({ projectId: 'project-2' }),
        )),
      },
    ],
    [
      REASON_CODES.STALE_BASELINE,
      {
        applyResult: compileExactTextApplyOps(
          buildReviewPatchSet(exactTextDecision()),
          acceptedEnvironment({ currentBaselineHash: 'baseline-b' }),
        ),
        effectPreviewPlan: compileExactTextApplyEffectPreviews(compileExactTextApplyOps(
          buildReviewPatchSet(exactTextDecision()),
          acceptedEnvironment({ currentBaselineHash: 'baseline-b' }),
        )),
      },
    ],
  ];

  for (const [reasonCode, input] of cases) {
    const result = compileExactTextWritePlanReceiptContract(input);
    assert.deepEqual(result.writePlans, [], reasonCode);
    assert.deepEqual(result.receiptContracts, [], reasonCode);
    assert.equal(result.blockedReasons.includes(reasonCode), true, reasonCode);
  }
});

test('001D task record pins contract-only false-green flags', () => {
  const taskText = fs.readFileSync(
    path.join(process.cwd(), 'docs', 'tasks', TASK_BASENAME),
    'utf8',
  );
  const requiredFalseFlags = [
    'PRODUCT_WRITE_CLAIMED',
    'DURABLE_RECEIPT_CLAIMED',
    'STORAGE_SAFETY_CLAIMED',
    'CRASH_RECOVERY_CLAIMED',
    'APPLYTXN_CLAIMED',
    'PUBLIC_SURFACE_CLAIMED',
    'DOCX_IMPORT_CLAIMED',
    'RELEASE_CLAIMED',
  ];

  assert.match(taskText, /STATUS: IMPLEMENTED_VERIFIED_CONTRACT_ONLY_NO_PRODUCTION_WRITE/u);
  assert.match(taskText, /CONTRACT_ONLY: true/u);
  assert.match(taskText, /IN_MEMORY_ONLY: true/u);
  assert.match(taskText, /PRODUCTION_WRITE_PERFORMED: false/u);
  assert.match(taskText, /STORAGE_MUTATION_PERFORMED: false/u);
  for (const flag of requiredFalseFlags) {
    assert.match(taskText, new RegExp(`${flag}: false`, 'u'), flag);
    assert.doesNotMatch(taskText, new RegExp(`${flag}: true`, 'u'), flag);
  }
  assert.doesNotMatch(taskText, /emitted receipt|persisted receipt|durable receipt|committed receipt|applied receipt/iu);
  assert.doesNotMatch(taskText, /applied to scene|committed to disk/iu);
});

test('write plan receipt contract adds no storage IO public surface or durable runtime claim', () => {
  const moduleText = fs.readFileSync(
    path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME),
    'utf8',
  );
  const forbidden = [
    /from\s+['"]node:fs(?:\/promises)?['"]/u,
    /from\s+['"]node:child_process['"]/u,
    /from\s+['"]node:http['"]/u,
    /from\s+['"]node:https['"]/u,
    /from\s+['"]node:net['"]/u,
    /from\s+['"]node:dns['"]/u,
    /from\s+['"]electron['"]/u,
    /from\s+['"][^'"]*(?:storage|main|preload|editor|command-catalog|projectCommands)[^'"]*['"]/u,
    /\bfetch\s*\(/u,
    /\bXMLHttpRequest\b/u,
    /\bwriteFile(?:Atomic)?\b/u,
    /\bmkdir\b/u,
    /\bApplyReceipt\b/u,
    /\bApplyTxn\b/u,
    /\bipc(?:Main|Renderer)\b/u,
  ];

  for (const pattern of forbidden) {
    assert.equal(pattern.test(moduleText), false, `forbidden write plan pattern: ${pattern.source}`);
  }
});
