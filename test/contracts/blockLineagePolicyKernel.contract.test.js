const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'blockLineagePolicyKernel.mjs';
const TEST_BASENAME = 'blockLineagePolicyKernel.contract.test.js';
const TASK_BASENAME = 'STAGE05J_BLOCK_LINEAGE_POLICY_KERNEL_001.md';

async function loadModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

function allowedChangedBasenames() {
  return [MODULE_BASENAME, TEST_BASENAME, TASK_BASENAME];
}

function baseCandidate(overrides = {}) {
  return {
    candidateId: 'candidate-001',
    blockLineageProof: 'block-lineage-proof-001',
    blockInstancePolicyRef: 'stage05i-policy-guard-ref-001',
    blockVersionHash: 'block-version-hash-001',
    targetBlockRef: 'review-target-block-ref-001',
    structuralChangeKind: 'NONE',
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    changedBasenames: allowedChangedBasenames(),
    stage05dSourceRefHash: 'stage05d-source-hash-001',
    stage05eEvidenceRefHash: 'stage05e-evidence-hash-001',
    stage05fExitGuardRefHash: 'stage05f-exit-guard-hash-001',
    stage05iPolicyRefHash: 'stage05i-policy-hash-001',
    ownerDecisionEvidenceHash: 'owner-option-03-evidence-hash-001',
    candidates: [baseCandidate()],
    ...overrides,
  };
}

function firstClassification(result) {
  return result.classifications[0];
}

test('stage05j module stays pure deterministic in-memory policy kernel', () => {
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
});

test('same input returns same lineage policy packet and canonical hash', async () => {
  const { compileBlockLineagePolicyKernel } = await loadModule();
  const first = compileBlockLineagePolicyKernel(baseInput());
  const second = compileBlockLineagePolicyKernel(baseInput());

  assert.deepEqual(first, second);
  assert.equal(first.canonicalHash, second.canonicalHash);
  assert.equal(firstClassification(first).policyEvidenceHash, firstClassification(second).policyEvidenceHash);
});

test('missing changedBasenames blocks output', async () => {
  const { compileBlockLineagePolicyKernel, BLOCK_LINEAGE_POLICY_REASON_CODES } = await loadModule();
  const result = compileBlockLineagePolicyKernel({
    stage05eEvidenceRefHash: 'stage05e',
    stage05fExitGuardRefHash: 'stage05f',
    stage05iPolicyRefHash: 'stage05i',
    candidates: [baseCandidate()],
  });

  assert.equal(result.outputDecision, 'BLOCK_LINEAGE_POLICY_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(BLOCK_LINEAGE_POLICY_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE),
    true,
  );
});

test('outside changed basename blocks output', async () => {
  const { compileBlockLineagePolicyKernel, BLOCK_LINEAGE_POLICY_REASON_CODES } = await loadModule();
  const result = compileBlockLineagePolicyKernel(baseInput({
    changedBasenames: [...allowedChangedBasenames(), 'package.json'],
  }));

  assert.equal(result.outputDecision, 'BLOCK_LINEAGE_POLICY_BLOCKED');
  assert.equal(result.blockedReasons.includes(BLOCK_LINEAGE_POLICY_REASON_CODES.FORBIDDEN_BASENAME_CHANGE), true);
});

test('Stage05E Stage05F and Stage05I refs are required guards not permission', async () => {
  const { compileBlockLineagePolicyKernel, BLOCK_LINEAGE_POLICY_REASON_CODES } = await loadModule();
  const missingStage05e = compileBlockLineagePolicyKernel(baseInput({ stage05eEvidenceRefHash: '' }));
  const missingStage05f = compileBlockLineagePolicyKernel(baseInput({ stage05fExitGuardRefHash: '' }));
  const missingStage05i = compileBlockLineagePolicyKernel(baseInput({ stage05iPolicyRefHash: '' }));

  assert.equal(missingStage05e.stage06AdmissionGranted, false);
  assert.equal(missingStage05f.applyTxnPermissionGranted, false);
  assert.equal(missingStage05i.stableBlockInstancePolicyAccepted, false);
  assert.equal(
    missingStage05e.blockedReasons.includes(BLOCK_LINEAGE_POLICY_REASON_CODES.MISSING_STAGE05E_EVIDENCE_REF),
    true,
  );
  assert.equal(
    missingStage05f.blockedReasons.includes(BLOCK_LINEAGE_POLICY_REASON_CODES.MISSING_STAGE05F_EXIT_GUARD_REF),
    true,
  );
  assert.equal(
    missingStage05i.blockedReasons.includes(BLOCK_LINEAGE_POLICY_REASON_CODES.MISSING_STAGE05I_POLICY_REF),
    true,
  );
});

test('stale Stage05 refs block output', async () => {
  const { compileBlockLineagePolicyKernel, BLOCK_LINEAGE_POLICY_REASON_CODES } = await loadModule();
  const result = compileBlockLineagePolicyKernel(baseInput({
    stage05iPolicyRefHash: 'actual-stage05i-hash',
    stage05iPolicyRefHashExpected: 'expected-stage05i-hash',
  }));

  assert.equal(result.outputDecision, 'BLOCK_LINEAGE_POLICY_BLOCKED');
  assert.equal(result.blockedReasons.includes(BLOCK_LINEAGE_POLICY_REASON_CODES.STALE_STAGE05_EVIDENCE_REF), true);
});

test('Stage05D source ref is optional source trace not policy pass', async () => {
  const { compileBlockLineagePolicyKernel, BLOCK_LINEAGE_POLICY_REASON_CODES } = await loadModule();
  const result = compileBlockLineagePolicyKernel(baseInput({ stage05dSourceRefHash: '' }));

  assert.equal(result.outputDecision, 'BLOCK_LINEAGE_POLICY_COMPILED');
  assert.equal(result.policyAcceptedAsProjectTruth, false);
  assert.equal(
    firstClassification(result).reasonCodes.includes(BLOCK_LINEAGE_POLICY_REASON_CODES.MISSING_STAGE05D_SOURCE_REF),
    true,
  );
});

test('owner decision evidence hash is not policy acceptance', async () => {
  const { compileBlockLineagePolicyKernel, BLOCK_LINEAGE_POLICY_REASON_CODES } = await loadModule();
  const result = compileBlockLineagePolicyKernel(baseInput());

  assert.equal(result.ownerDecisionEvidenceIsPolicyAcceptance, false);
  assert.equal(result.policyAcceptedAsProjectTruth, false);
  assert.equal(firstClassification(result).ownerDecisionEvidenceIsPolicyAcceptance, false);
  assert.equal(
    firstClassification(result).reasonCodes.includes(
      BLOCK_LINEAGE_POLICY_REASON_CODES.OWNER_DECISION_EVIDENCE_REF_ONLY_NOT_POLICY_ACCEPTANCE,
    ),
    true,
  );
});

test('lineage proof is evidence reference only and does not create project truth', async () => {
  const { compileBlockLineagePolicyKernel, BLOCK_LINEAGE_POLICY_REASON_CODES } = await loadModule();
  const result = compileBlockLineagePolicyKernel(baseInput());

  assert.equal(firstClassification(result).classification, 'EVIDENCE_REFERENCE_ONLY');
  assert.equal(firstClassification(result).blockLineageCreated, false);
  assert.equal(firstClassification(result).blockLineagePersisted, false);
  assert.equal(firstClassification(result).blockLineageProjectTruthClaimed, false);
  assert.equal(result.reviewBom.acceptedProjectTruthCount, 0);
  assert.equal(
    firstClassification(result).reasonCodes.includes(
      BLOCK_LINEAGE_POLICY_REASON_CODES.BLOCK_LINEAGE_PROOF_EVIDENCE_REFERENCE_ONLY,
    ),
    true,
  );
});

test('Stage05I policy ref is guard only and not stable id acceptance', async () => {
  const { compileBlockLineagePolicyKernel, BLOCK_LINEAGE_POLICY_REASON_CODES } = await loadModule();
  const result = compileBlockLineagePolicyKernel(baseInput());

  assert.equal(result.stableBlockInstancePolicyAccepted, false);
  assert.equal(firstClassification(result).stableBlockInstancePolicyAccepted, false);
  assert.equal(
    firstClassification(result).reasonCodes.includes(
      BLOCK_LINEAGE_POLICY_REASON_CODES.STAGE05I_POLICY_REF_GUARD_ONLY_NOT_STABLE_ID_ACCEPTANCE,
    ),
    true,
  );
});

test('block version hash remains guard only and target block ref is not project truth', async () => {
  const { compileBlockLineagePolicyKernel, BLOCK_LINEAGE_POLICY_REASON_CODES } = await loadModule();
  const result = compileBlockLineagePolicyKernel(baseInput());

  assert.equal(firstClassification(result).blockLineageProjectTruthClaimed, false);
  assert.equal(
    firstClassification(result).reasonCodes.includes(BLOCK_LINEAGE_POLICY_REASON_CODES.BLOCK_VERSION_HASH_GUARD_ONLY),
    true,
  );
  assert.equal(
    firstClassification(result).reasonCodes.includes(BLOCK_LINEAGE_POLICY_REASON_CODES.TARGET_BLOCK_REF_NOT_PROJECT_TRUTH),
    true,
  );
});

test('empty candidates with no forbidden claims compile to zero acceptance guard packet', async () => {
  const { compileBlockLineagePolicyKernel } = await loadModule();
  const result = compileBlockLineagePolicyKernel(baseInput({ candidates: [] }));

  assert.equal(result.outputDecision, 'BLOCK_LINEAGE_POLICY_COMPILED');
  assert.equal(result.classifications.length, 1);
  assert.equal(firstClassification(result).classification, 'ZERO_ACCEPTANCE_GUARD');
  assert.equal(result.reviewBom.zeroAcceptanceGuardCount, 1);
  assert.equal(result.reviewBom.acceptedProjectTruthCount, 0);
  assert.equal(result.blockLineageCreated, false);
  assert.equal(result.stage06AdmissionGranted, false);
});

test('top-level forbidden lineage creation claim blocks output with empty candidates', async () => {
  const { compileBlockLineagePolicyKernel, BLOCK_LINEAGE_POLICY_REASON_CODES } = await loadModule();
  const result = compileBlockLineagePolicyKernel(baseInput({
    createBlockLineageIdClaimed: true,
    candidates: [],
  }));

  assert.equal(result.outputDecision, 'BLOCK_LINEAGE_POLICY_BLOCKED');
  assert.equal(result.blockLineageCreated, false);
  assert.equal(
    result.blockedReasons.includes(BLOCK_LINEAGE_POLICY_REASON_CODES.FORBIDDEN_BLOCK_LINEAGE_CREATION_CLAIM),
    true,
  );
});

test('top-level forbidden lineage persistence claim blocks output with empty candidates', async () => {
  const { compileBlockLineagePolicyKernel, BLOCK_LINEAGE_POLICY_REASON_CODES } = await loadModule();
  const result = compileBlockLineagePolicyKernel(baseInput({
    persistBlockLineageIdClaimed: true,
    candidates: [],
  }));

  assert.equal(result.outputDecision, 'BLOCK_LINEAGE_POLICY_BLOCKED');
  assert.equal(result.blockLineagePersisted, false);
  assert.equal(
    result.blockedReasons.includes(BLOCK_LINEAGE_POLICY_REASON_CODES.FORBIDDEN_BLOCK_LINEAGE_PERSISTENCE_CLAIM),
    true,
  );
});

test('explicit block lineage project truth claim blocks output with empty candidates', async () => {
  const { compileBlockLineagePolicyKernel, BLOCK_LINEAGE_POLICY_REASON_CODES } = await loadModule();
  const result = compileBlockLineagePolicyKernel(baseInput({
    blockLineageProjectTruthClaimed: true,
    candidates: [],
  }));

  assert.equal(result.outputDecision, 'BLOCK_LINEAGE_POLICY_BLOCKED');
  assert.equal(result.policyAcceptedAsProjectTruth, false);
  assert.equal(
    result.blockedReasons.includes(BLOCK_LINEAGE_POLICY_REASON_CODES.FORBIDDEN_BLOCK_LINEAGE_PROJECT_TRUTH_CLAIM),
    true,
  );
});

test('explicit policy acceptance claim blocks output with empty candidates', async () => {
  const { compileBlockLineagePolicyKernel, BLOCK_LINEAGE_POLICY_REASON_CODES } = await loadModule();
  const result = compileBlockLineagePolicyKernel(baseInput({
    policyAcceptanceClaimed: true,
    candidates: [],
  }));

  assert.equal(result.outputDecision, 'BLOCK_LINEAGE_POLICY_BLOCKED');
  assert.equal(result.policyAcceptedAsProjectTruth, false);
  assert.equal(result.blockedReasons.includes(BLOCK_LINEAGE_POLICY_REASON_CODES.FORBIDDEN_POLICY_ACCEPTANCE_CLAIM), true);
});

test('explicit Stage06 permission claim blocks output with empty candidates', async () => {
  const { compileBlockLineagePolicyKernel, BLOCK_LINEAGE_POLICY_REASON_CODES } = await loadModule();
  const result = compileBlockLineagePolicyKernel(baseInput({
    stage06PermissionClaimed: true,
    candidates: [],
  }));

  assert.equal(result.outputDecision, 'BLOCK_LINEAGE_POLICY_BLOCKED');
  assert.equal(result.stage06AdmissionGranted, false);
  assert.equal(result.blockedReasons.includes(BLOCK_LINEAGE_POLICY_REASON_CODES.FORBIDDEN_STAGE06_PERMISSION_CLAIM), true);
});

test('explicit ApplyTxn claim blocks output with empty candidates', async () => {
  const { compileBlockLineagePolicyKernel, BLOCK_LINEAGE_POLICY_REASON_CODES } = await loadModule();
  const result = compileBlockLineagePolicyKernel(baseInput({
    applyTxnPermissionClaimed: true,
    candidates: [],
  }));

  assert.equal(result.outputDecision, 'BLOCK_LINEAGE_POLICY_BLOCKED');
  assert.equal(result.applyTxnPermissionGranted, false);
  assert.equal(result.blockedReasons.includes(BLOCK_LINEAGE_POLICY_REASON_CODES.FORBIDDEN_APPLYTXN_CLAIM), true);
});

test('structural move split merge is manual only', async () => {
  const { compileBlockLineagePolicyKernel, BLOCK_LINEAGE_POLICY_REASON_CODES } = await loadModule();

  for (const kind of ['MOVE', 'SPLIT', 'MERGE']) {
    const result = compileBlockLineagePolicyKernel(baseInput({
      candidates: [baseCandidate({ structuralChangeKind: kind })],
    }));
    assert.equal(result.structuralPolicyManualOnly, true, kind);
    assert.equal(
      firstClassification(result).reasonCodes.includes(BLOCK_LINEAGE_POLICY_REASON_CODES.STRUCTURAL_POLICY_MANUAL_ONLY),
      true,
      kind,
    );
  }
});

test('exact text consumer claim is future consumer only', async () => {
  const { compileBlockLineagePolicyKernel, BLOCK_LINEAGE_POLICY_REASON_CODES } = await loadModule();
  const result = compileBlockLineagePolicyKernel(baseInput({
    candidates: [baseCandidate({ consumerKind: 'EXACT_TEXT' })],
  }));

  assert.equal(result.exactTextCurrentApplyPath, false);
  assert.equal(
    firstClassification(result).reasonCodes.includes(BLOCK_LINEAGE_POLICY_REASON_CODES.EXACT_TEXT_FUTURE_CONSUMER_ONLY),
    true,
  );
});

test('review bom and Stage06 preview expose blockers without admission', async () => {
  const { compileBlockLineagePolicyKernel, BLOCK_LINEAGE_POLICY_REASON_CODES } = await loadModule();
  const result = compileBlockLineagePolicyKernel(baseInput({
    applyTxnPermissionClaimed: true,
    candidates: [baseCandidate()],
  }));

  assert.equal(result.reviewBom.blockerCount > 0, true);
  assert.equal(result.reviewBom.blockLineageCreatedCount, 0);
  assert.equal(result.reviewBom.acceptedProjectTruthCount, 0);
  assert.equal(
    result.reviewBom.blockerCodes.includes(BLOCK_LINEAGE_POLICY_REASON_CODES.FORBIDDEN_APPLYTXN_CLAIM),
    true,
  );
  assert.equal(result.stage06BlockersPreview.previewOnly, true);
  assert.equal(result.stage06BlockersPreview.stage06AdmissionGranted, false);
  assert.equal(result.stage06BlockersPreview.applyTxnPermissionGranted, false);
});

test('output exposes zero write apply storage Stage06 flags', async () => {
  const { compileBlockLineagePolicyKernel } = await loadModule();
  const result = compileBlockLineagePolicyKernel(baseInput());

  assert.equal(result.projectWritePerformed, false);
  assert.equal(result.runtimeApplyPerformed, false);
  assert.equal(result.applyOpCreated, false);
  assert.equal(result.applyOpPerformed, false);
  assert.equal(result.applyTxnCreated, false);
  assert.equal(result.applyTxnPerformed, false);
  assert.equal(result.storageMutationPerformed, false);
  assert.equal(result.storageMigrationPerformed, false);
  assert.equal(result.atomicWritePerformed, false);
  assert.equal(result.recoveryWritePerformed, false);
  assert.equal(result.blockLineageCreated, false);
  assert.equal(result.blockLineagePersisted, false);
  assert.equal(result.policyAcceptedAsProjectTruth, false);
  assert.equal(result.stage06AdmissionGranted, false);
  assert.equal(result.applyTxnPermissionGranted, false);
});
