const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'identityEvidenceChainReviewBom.mjs';
const TEST_BASENAME = 'identityEvidenceChainReviewBom.contract.test.js';
const TASK_BASENAME = 'STAGE05M_IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_ONLY_001.md';

async function loadModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

function allowedChangedBasenames() {
  return [MODULE_BASENAME, TEST_BASENAME, TASK_BASENAME];
}

function baseInput(overrides = {}) {
  return {
    changedBasenames: allowedChangedBasenames(),
    stage05aTraceRefHash: 'stage05a-trace-hash-001',
    stage05cPreconditionRefHash: 'stage05c-precondition-hash-001',
    stage05dTraceRefHash: 'stage05d-trace-hash-001',
    stage05eGuardRefHash: 'stage05e-guard-hash-001',
    stage05fGuardRefHash: 'stage05f-guard-hash-001',
    stage05iGuardRefHash: 'stage05i-guard-hash-001',
    stage05jGuardRefHash: 'stage05j-guard-hash-001',
    stage05kRollupRefHash: 'stage05k-rollup-hash-001',
    stage05lOwnerPacketValidationRefHash: 'stage05l-validation-hash-001',
    stage05lDecisionRefHash: 'stage05l-decision-hash-001',
    ...overrides,
  };
}

const REQUIRED_REF_HASH_KEYS = [
  'stage05aTraceRefHash',
  'stage05cPreconditionRefHash',
  'stage05dTraceRefHash',
  'stage05eGuardRefHash',
  'stage05fGuardRefHash',
  'stage05iGuardRefHash',
  'stage05jGuardRefHash',
  'stage05kRollupRefHash',
  'stage05lOwnerPacketValidationRefHash',
  'stage05lDecisionRefHash',
];

test('stage05m module stays pure deterministic in-memory evidence chain BOM', () => {
  const moduleText = fs.readFileSync(
    path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME),
    'utf8',
  );
  const forbidden = [
    /from\s+['"]node:fs['"]/u,
    /from\s+['"]fs['"]/u,
    /from\s+['"]node:child_process['"]/u,
    /from\s+['"]node:http['"]/u,
    /from\s+['"]node:https['"]/u,
    /from\s+['"]node:net['"]/u,
    /from\s+['"]electron['"]/u,
    /\bfetch\s*\(/u,
    /\bXMLHttpRequest\b/u,
    /\bipcRenderer\b/u,
    /\bipcMain\b/u,
    /\blocalStorage\b/u,
    /\bsessionStorage\b/u,
    /\bDate\.now\s*\(/u,
    /\bnew Date\s*\(/u,
    /\bMath\.random\s*\(/u,
    /\bwriteFile\b/u,
    /\bmkdir\b/u,
    /\brename\b/u,
  ];

  for (const pattern of forbidden) {
    assert.equal(pattern.test(moduleText), false, `forbidden pure pattern: ${pattern.source}`);
  }

  const importLines = moduleText
    .split('\n')
    .filter((line) => line.trim().startsWith('import '));
  assert.deepEqual(importLines, ["import { canonicalHash } from './reviewIrKernel.mjs';"]);
});

test('same input returns same result and canonical hash', async () => {
  const { compileIdentityEvidenceChainReviewBom } = await loadModule();
  const first = compileIdentityEvidenceChainReviewBom(baseInput());
  const second = compileIdentityEvidenceChainReviewBom(baseInput());

  assert.deepEqual(first, second);
  assert.equal(first.canonicalHash, second.canonicalHash);
});

test('complete refs compile evidence chain review only', async () => {
  const { compileIdentityEvidenceChainReviewBom } = await loadModule();
  const result = compileIdentityEvidenceChainReviewBom(baseInput());

  assert.equal(result.outputDecision, 'EVIDENCE_CHAIN_REVIEW_COMPILED');
  assert.equal(result.evidenceChainReviewCompiled, true);
  assert.equal(result.reviewBom.stage05EvidenceRefCount, 10);
  assert.equal(result.reviewBom.presentRefCount, 10);
  assert.equal(result.reviewBom.missingRefCount, 0);
  assert.equal(result.nextStepPreview.previewOnly, true);
  assert.equal(result.nextStepPreview.nextStepRecommendationOnly, true);
  assert.equal(result.nextStepPreview.ownerDecidesNextIdentityPolicyContour, true);
});

test('complete refs do not make Stage05 exit ready', async () => {
  const { compileIdentityEvidenceChainReviewBom } = await loadModule();
  const result = compileIdentityEvidenceChainReviewBom(baseInput());

  assert.equal(result.stage05ExitReady, false);
  assert.equal(result.reviewBom.stage05ExitReadyCount, 0);
  assert.equal(result.nextStepPreview.stage05ExitReady, false);
});

test('complete refs do not accept policy or project truth', async () => {
  const { compileIdentityEvidenceChainReviewBom } = await loadModule();
  const result = compileIdentityEvidenceChainReviewBom(baseInput());

  assert.equal(result.policyAcceptanceNotEvaluated, true);
  assert.equal(result.ownerPolicyDecisionMade, false);
  assert.equal(result.policyAcceptedAsProjectTruth, false);
  assert.equal(result.projectTruthAccepted, false);
  assert.equal(result.reviewBom.acceptedProjectTruthCount, 0);
});

test('missing changedBasenames blocks review', async () => {
  const { compileIdentityEvidenceChainReviewBom, IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES } = await loadModule();
  const input = baseInput();
  delete input.changedBasenames;
  const result = compileIdentityEvidenceChainReviewBom(input);

  assert.equal(result.outputDecision, 'EVIDENCE_CHAIN_REVIEW_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE),
    true,
  );
});

test('outside changed basename blocks review', async () => {
  const { compileIdentityEvidenceChainReviewBom, IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES } = await loadModule();
  const result = compileIdentityEvidenceChainReviewBom(baseInput({
    changedBasenames: [...allowedChangedBasenames(), 'package.json'],
  }));

  assert.equal(result.outputDecision, 'EVIDENCE_CHAIN_REVIEW_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_BASENAME_CHANGE),
    true,
  );
});

test('missing Stage05A ref blocks review and remains trace only', async () => {
  const { compileIdentityEvidenceChainReviewBom, IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES } = await loadModule();
  const result = compileIdentityEvidenceChainReviewBom(baseInput({ stage05aTraceRefHash: '' }));

  assert.equal(result.outputDecision, 'EVIDENCE_CHAIN_REVIEW_BLOCKED');
  assert.equal(result.refReviews.find((ref) => ref.refId === 'STAGE05A_TRACE_REF').traceOnly, true);
  assert.equal(
    result.blockedReasons.includes(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.MISSING_STAGE05A_TRACE_REF),
    true,
  );
});

test('missing Stage05C ref blocks review and remains precondition only', async () => {
  const { compileIdentityEvidenceChainReviewBom, IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES } = await loadModule();
  const result = compileIdentityEvidenceChainReviewBom(baseInput({ stage05cPreconditionRefHash: '' }));

  assert.equal(result.outputDecision, 'EVIDENCE_CHAIN_REVIEW_BLOCKED');
  assert.equal(result.refReviews.find((ref) => ref.refId === 'STAGE05C_PRECONDITION_REF').preconditionOnly, true);
  assert.equal(
    result.blockedReasons.includes(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.MISSING_STAGE05C_PRECONDITION_REF),
    true,
  );
});

test('missing Stage05D ref blocks review and remains trace only', async () => {
  const { compileIdentityEvidenceChainReviewBom, IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES } = await loadModule();
  const result = compileIdentityEvidenceChainReviewBom(baseInput({ stage05dTraceRefHash: '' }));

  assert.equal(result.outputDecision, 'EVIDENCE_CHAIN_REVIEW_BLOCKED');
  assert.equal(result.refReviews.find((ref) => ref.refId === 'STAGE05D_TRACE_REF').traceOnly, true);
  assert.equal(
    result.blockedReasons.includes(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.MISSING_STAGE05D_TRACE_REF),
    true,
  );
});

test('missing guard refs block review and remain guard only not permission', async () => {
  const { compileIdentityEvidenceChainReviewBom, IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES } = await loadModule();
  const result = compileIdentityEvidenceChainReviewBom(baseInput({
    stage05eGuardRefHash: '',
    stage05fGuardRefHash: '',
    stage05iGuardRefHash: '',
    stage05jGuardRefHash: '',
  }));

  assert.equal(result.outputDecision, 'EVIDENCE_CHAIN_REVIEW_BLOCKED');
  assert.equal(result.refReviews.filter((ref) => ref.guardOnly).length, 4);
  assert.equal(result.reviewBom.guardOnlyRefCount, 4);
  assert.equal(
    result.blockedReasons.includes(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.MISSING_STAGE05E_GUARD_REF),
    true,
  );
  assert.equal(
    result.blockedReasons.includes(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.MISSING_STAGE05F_GUARD_REF),
    true,
  );
  assert.equal(
    result.blockedReasons.includes(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.MISSING_STAGE05I_GUARD_REF),
    true,
  );
  assert.equal(
    result.blockedReasons.includes(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.MISSING_STAGE05J_GUARD_REF),
    true,
  );
});

test('missing Stage05K rollup ref blocks and is not exit ready', async () => {
  const { compileIdentityEvidenceChainReviewBom, IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES } = await loadModule();
  const result = compileIdentityEvidenceChainReviewBom(baseInput({ stage05kRollupRefHash: '' }));

  assert.equal(result.outputDecision, 'EVIDENCE_CHAIN_REVIEW_BLOCKED');
  assert.equal(result.refReviews.find((ref) => ref.refId === 'STAGE05K_ROLLUP_REF').rollupOnly, true);
  assert.equal(result.stage05ExitReady, false);
  assert.equal(
    result.blockedReasons.includes(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.MISSING_STAGE05K_ROLLUP_REF),
    true,
  );
});

test('missing Stage05L validation and decision refs block and stay evidence only', async () => {
  const { compileIdentityEvidenceChainReviewBom, IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES } = await loadModule();
  const result = compileIdentityEvidenceChainReviewBom(baseInput({
    stage05lOwnerPacketValidationRefHash: '',
    stage05lDecisionRefHash: '',
  }));

  assert.equal(result.outputDecision, 'EVIDENCE_CHAIN_REVIEW_BLOCKED');
  assert.equal(result.refReviews.filter((ref) => ref.evidenceOnly).length, 2);
  assert.equal(
    result.blockedReasons.includes(
      IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.MISSING_STAGE05L_OWNER_PACKET_VALIDATION_REF,
    ),
    true,
  );
  assert.equal(
    result.blockedReasons.includes(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.MISSING_STAGE05L_DECISION_REF),
    true,
  );
});

test('stale required refs block review', async () => {
  const { compileIdentityEvidenceChainReviewBom, IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES } = await loadModule();
  const result = compileIdentityEvidenceChainReviewBom(baseInput({
    stage05eGuardRefHash: 'actual-stage05e',
    stage05eGuardRefHashExpected: 'expected-stage05e',
  }));

  assert.equal(result.outputDecision, 'EVIDENCE_CHAIN_REVIEW_BLOCKED');
  assert.equal(result.reviewBom.staleRefCount, 1);
  assert.equal(
    result.blockedReasons.includes(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.STALE_STAGE05_REQUIRED_REF),
    true,
  );
});

test('direct ref evidence hash takes precedence over top-level hash', async () => {
  const { compileIdentityEvidenceChainReviewBom } = await loadModule();
  const result = compileIdentityEvidenceChainReviewBom(baseInput({
    stage05eGuardRef: {
      evidenceHash: 'direct-stage05e-guard-hash',
      expectedEvidenceHash: 'direct-stage05e-guard-hash',
    },
    stage05eGuardRefHash: 'stale-top-level-stage05e-guard-hash',
    stage05eGuardRefHashExpected: 'stale-top-level-stage05e-guard-hash',
  }));

  const stage05eRef = result.refReviews.find((ref) => ref.refId === 'STAGE05E_GUARD_REF');
  assert.equal(stage05eRef.evidenceHash, 'direct-stage05e-guard-hash');
  assert.equal(stage05eRef.expectedEvidenceHash, 'direct-stage05e-guard-hash');
  assert.equal(stage05eRef.stale, false);
  assert.equal(result.outputDecision, 'EVIDENCE_CHAIN_REVIEW_COMPILED');
});

test('stale mismatch blocks every required Stage05 evidence ref pair', async () => {
  const { compileIdentityEvidenceChainReviewBom, IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES } = await loadModule();

  for (const hashKey of REQUIRED_REF_HASH_KEYS) {
    const result = compileIdentityEvidenceChainReviewBom(baseInput({
      [hashKey]: `${hashKey}-actual`,
      [`${hashKey}Expected`]: `${hashKey}-expected`,
    }));

    assert.equal(result.outputDecision, 'EVIDENCE_CHAIN_REVIEW_BLOCKED', hashKey);
    assert.equal(result.reviewBom.staleRefCount, 1, hashKey);
    assert.equal(
      result.blockedReasons.includes(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.STALE_STAGE05_REQUIRED_REF),
      true,
      hashKey,
    );
  }
});

test('permission language in input blocks without creating permission', async () => {
  const { compileIdentityEvidenceChainReviewBom, IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES } = await loadModule();
  const result = compileIdentityEvidenceChainReviewBom(baseInput({
    permissionLanguageClaims: ['stage05 exit ready', 'policy accepted'],
  }));

  assert.equal(result.outputDecision, 'EVIDENCE_CHAIN_REVIEW_BLOCKED');
  assert.equal(result.permissionLanguageFindingCount, 2);
  assert.equal(result.stage05ExitReady, false);
  assert.equal(
    result.blockedReasons.includes(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_PERMISSION_LANGUAGE_FOUND),
    true,
  );
});

test('policy acceptance claim blocks review', async () => {
  const { compileIdentityEvidenceChainReviewBom, IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES } = await loadModule();
  const result = compileIdentityEvidenceChainReviewBom(baseInput({ policyAcceptanceClaimed: 'TRUE' }));

  assert.equal(result.outputDecision, 'EVIDENCE_CHAIN_REVIEW_BLOCKED');
  assert.equal(result.policyAcceptedAsProjectTruth, false);
  assert.equal(
    result.blockedReasons.includes(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_POLICY_ACCEPTANCE_CLAIM),
    true,
  );
});

test('truthy forbidden claim matrix blocks review without admitting policy', async () => {
  const { compileIdentityEvidenceChainReviewBom } = await loadModule();
  const forbiddenClaimKeys = [
    'policyAcceptanceClaimed',
    'policyAcceptedClaimed',
    'ownerPolicyDecisionClaimed',
    'ownerPolicyDecidedClaimed',
    'projectTruthAcceptedClaimed',
    'projectTruthPolicyAcceptedClaimed',
    'stage05ExitReadyClaimed',
    'identityPolicyReadyClaimed',
    'stage06PreAdmittedClaimed',
    'stage06PreAdmissionClaimed',
    'stage06PermissionClaimed',
    'stage06AdmissionClaimed',
    'applyTxnClaimed',
    'applyTxnAllowedClaimed',
    'applyTxnCreatedClaimed',
    'storageMigrationClaimed',
    'storageMutationClaimed',
    'projectWriteClaimed',
    'projectWritePerformedClaimed',
    'stableIdCreationClaimed',
    'stableBlockInstanceIdCreatedClaimed',
    'persistStableBlockInstanceIdClaimed',
    'blockLineageCreatedClaimed',
    'blockLineagePersistedClaimed',
    'createBlockLineageClaimed',
    'reviewAnchorPromotedClaimed',
    'reviewAnchorHandlePromotedClaimed',
    'structuralAutoApplyClaimed',
    'moveSplitMergeAutoApplyClaimed',
    'uiClaimed',
    'docxClaimed',
    'networkClaimed',
    'dependencyChangeClaimed',
  ];

  for (const claimKey of forbiddenClaimKeys) {
    const result = compileIdentityEvidenceChainReviewBom(baseInput({ [claimKey]: 'yes' }));

    assert.equal(result.outputDecision, 'EVIDENCE_CHAIN_REVIEW_BLOCKED', claimKey);
    assert.equal(result.policyAcceptanceNotEvaluated, true, claimKey);
    assert.equal(result.ownerPolicyDecisionMade, false, claimKey);
    assert.equal(result.policyAcceptedAsProjectTruth, false, claimKey);
    assert.equal(result.projectTruthAccepted, false, claimKey);
    assert.equal(result.stage05ExitReady, false, claimKey);
    assert.equal(result.stage06PreAdmitted, false, claimKey);
    assert.equal(result.stage06AdmissionGranted, false, claimKey);
    assert.equal(result.applyTxnAllowed, false, claimKey);
    assert.equal(result.projectWritePerformed, false, claimKey);
    assert.equal(result.storageMigrationPerformed, false, claimKey);
    assert.equal(result.stableBlockInstanceIdCreated, false, claimKey);
    assert.equal(result.blockLineageCreated, false, claimKey);
    assert.equal(result.reviewAnchorHandlePromoted, false, claimKey);
  }
});

test('owner policy decision claim blocks review', async () => {
  const { compileIdentityEvidenceChainReviewBom, IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES } = await loadModule();
  const result = compileIdentityEvidenceChainReviewBom(baseInput({ ownerPolicyDecisionClaimed: 1 }));

  assert.equal(result.outputDecision, 'EVIDENCE_CHAIN_REVIEW_BLOCKED');
  assert.equal(result.ownerPolicyDecisionMade, false);
  assert.equal(
    result.blockedReasons.includes(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_OWNER_POLICY_DECISION_CLAIM),
    true,
  );
});

test('project truth acceptance claim blocks review', async () => {
  const { compileIdentityEvidenceChainReviewBom, IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES } = await loadModule();
  const result = compileIdentityEvidenceChainReviewBom(baseInput({ projectTruthAcceptedClaimed: { claimed: true } }));

  assert.equal(result.outputDecision, 'EVIDENCE_CHAIN_REVIEW_BLOCKED');
  assert.equal(result.projectTruthAccepted, false);
  assert.equal(
    result.blockedReasons.includes(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_PROJECT_TRUTH_ACCEPTANCE_CLAIM),
    true,
  );
});

test('Stage05 exit ready claim blocks review', async () => {
  const { compileIdentityEvidenceChainReviewBom, IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES } = await loadModule();
  const result = compileIdentityEvidenceChainReviewBom(baseInput({ stage05ExitReadyClaimed: true }));

  assert.equal(result.outputDecision, 'EVIDENCE_CHAIN_REVIEW_BLOCKED');
  assert.equal(result.stage05ExitReady, false);
  assert.equal(
    result.blockedReasons.includes(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_STAGE05_EXIT_READY_CLAIM),
    true,
  );
});

test('Stage06 permission or pre-admission claims block review', async () => {
  const { compileIdentityEvidenceChainReviewBom, IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES } = await loadModule();
  const permission = compileIdentityEvidenceChainReviewBom(baseInput({ stage06PermissionClaimed: true }));
  const preAdmission = compileIdentityEvidenceChainReviewBom(baseInput({ stage06PreAdmittedClaimed: true }));

  assert.equal(permission.stage06AdmissionGranted, false);
  assert.equal(preAdmission.stage06PreAdmitted, false);
  assert.equal(
    permission.blockedReasons.includes(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_STAGE06_PERMISSION_CLAIM),
    true,
  );
  assert.equal(
    preAdmission.blockedReasons.includes(
      IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_STAGE06_PRE_ADMISSION_CLAIM,
    ),
    true,
  );
});

test('ApplyTxn claim blocks review', async () => {
  const { compileIdentityEvidenceChainReviewBom, IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES } = await loadModule();
  const result = compileIdentityEvidenceChainReviewBom(baseInput({ applyTxnAllowedClaimed: true }));

  assert.equal(result.outputDecision, 'EVIDENCE_CHAIN_REVIEW_BLOCKED');
  assert.equal(result.applyTxnAllowed, false);
  assert.equal(
    result.blockedReasons.includes(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_APPLYTXN_CLAIM),
    true,
  );
});

test('storage migration or project write claims block review', async () => {
  const { compileIdentityEvidenceChainReviewBom, IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES } = await loadModule();
  const storage = compileIdentityEvidenceChainReviewBom(baseInput({ storageMigrationClaimed: true }));
  const projectWrite = compileIdentityEvidenceChainReviewBom(baseInput({ projectWriteClaimed: true }));

  assert.equal(storage.storageMigrationPerformed, false);
  assert.equal(projectWrite.projectWritePerformed, false);
  assert.equal(
    storage.blockedReasons.includes(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_STORAGE_MIGRATION_CLAIM),
    true,
  );
  assert.equal(
    projectWrite.blockedReasons.includes(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_PROJECT_WRITE_CLAIM),
    true,
  );
});

test('stable id or lineage creation claims block review', async () => {
  const { compileIdentityEvidenceChainReviewBom, IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES } = await loadModule();
  const stableId = compileIdentityEvidenceChainReviewBom(baseInput({ stableBlockInstanceIdCreatedClaimed: true }));
  const lineage = compileIdentityEvidenceChainReviewBom(baseInput({ blockLineageCreatedClaimed: true }));

  assert.equal(stableId.stableBlockInstanceIdCreated, false);
  assert.equal(lineage.blockLineageCreated, false);
  assert.equal(
    stableId.blockedReasons.includes(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_STABLE_ID_CREATION_CLAIM),
    true,
  );
  assert.equal(
    lineage.blockedReasons.includes(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_LINEAGE_CREATION_CLAIM),
    true,
  );
});

test('review anchor promotion claim blocks review', async () => {
  const { compileIdentityEvidenceChainReviewBom, IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES } = await loadModule();
  const result = compileIdentityEvidenceChainReviewBom(baseInput({ reviewAnchorHandlePromotedClaimed: true }));

  assert.equal(result.reviewAnchorHandlePromoted, false);
  assert.equal(
    result.blockedReasons.includes(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_REVIEW_ANCHOR_PROMOTION_CLAIM),
    true,
  );
});

test('structural auto apply claim blocks review', async () => {
  const { compileIdentityEvidenceChainReviewBom, IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES } = await loadModule();
  const result = compileIdentityEvidenceChainReviewBom(baseInput({ structuralAutoApplyClaimed: true }));

  assert.equal(result.outputDecision, 'EVIDENCE_CHAIN_REVIEW_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_STRUCTURAL_AUTO_APPLY_CLAIM),
    true,
  );
});

test('ui docx network dependency claim blocks review', async () => {
  const { compileIdentityEvidenceChainReviewBom, IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES } = await loadModule();
  const result = compileIdentityEvidenceChainReviewBom(baseInput({ uiClaimed: true, networkClaimed: true }));

  assert.equal(result.outputDecision, 'EVIDENCE_CHAIN_REVIEW_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(
      IDENTITY_EVIDENCE_CHAIN_REVIEW_BOM_REASON_CODES.FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM,
    ),
    true,
  );
});

test('output exposes zero write apply storage and no ready flags', async () => {
  const { compileIdentityEvidenceChainReviewBom } = await loadModule();
  const result = compileIdentityEvidenceChainReviewBom(baseInput());

  assert.equal(result.projectWritePerformed, false);
  assert.equal(result.runtimeApplyPerformed, false);
  assert.equal(result.applyOpCreated, false);
  assert.equal(result.applyOpPerformed, false);
  assert.equal(result.storageMutationPerformed, false);
  assert.equal(result.storageMigrationPerformed, false);
  assert.equal(result.stage05ExitReady, false);
  assert.equal(result.stage06PreAdmitted, false);
  assert.equal(result.stage06AdmissionGranted, false);
  assert.equal(result.applyTxnAllowed, false);
  assert.equal(result.applyTxnCreated, false);
  assert.equal(result.applyTxnPerformed, false);
  assert.equal(result.stableBlockInstanceIdCreated, false);
  assert.equal(result.blockLineageCreated, false);
  assert.equal(result.sceneIdentityAccepted, false);
  assert.equal(result.reviewAnchorHandlePromoted, false);
});
