const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'stableBlockInstanceIdPolicyKernel.mjs';
const TEST_BASENAME = 'stableBlockInstanceIdPolicyKernel.contract.test.js';
const TASK_BASENAME = 'STAGE05I_STABLE_BLOCK_INSTANCE_ID_POLICY_KERNEL_001.md';

async function loadModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

function allowedChangedBasenames() {
  return [MODULE_BASENAME, TEST_BASENAME, TASK_BASENAME];
}

function baseCandidate(overrides = {}) {
  return {
    candidateId: 'candidate-001',
    externalBlockInstanceProof: 'block-instance-proof-001',
    blockLineageProof: '',
    blockVersionHash: 'block-version-hash-001',
    targetBlockRef: 'review-target-block-ref-001',
    structuralChangeKind: 'NONE',
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    changedBasenames: allowedChangedBasenames(),
    stage05eEvidenceRefHash: 'stage05e-evidence-hash-001',
    stage05fExitGuardRefHash: 'stage05f-exit-guard-hash-001',
    ownerDecisionEvidenceHash: 'owner-option-02-evidence-hash-001',
    candidates: [baseCandidate()],
    ...overrides,
  };
}

function firstClassification(result) {
  return result.classifications[0];
}

test('stage05i module stays pure deterministic in-memory policy kernel', () => {
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

test('same input returns same policy packet and canonical hash', async () => {
  const { compileStableBlockInstanceIdPolicyKernel } = await loadModule();
  const first = compileStableBlockInstanceIdPolicyKernel(baseInput());
  const second = compileStableBlockInstanceIdPolicyKernel(baseInput());

  assert.deepEqual(first, second);
  assert.equal(first.canonicalHash, second.canonicalHash);
  assert.equal(firstClassification(first).policyEvidenceHash, firstClassification(second).policyEvidenceHash);
});

test('missing changedBasenames blocks output', async () => {
  const { compileStableBlockInstanceIdPolicyKernel, STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES } = await loadModule();
  const result = compileStableBlockInstanceIdPolicyKernel({
    stage05eEvidenceRefHash: 'stage05e',
    stage05fExitGuardRefHash: 'stage05f',
    candidates: [baseCandidate()],
  });

  assert.equal(result.outputDecision, 'STABLE_BLOCK_INSTANCE_ID_POLICY_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(
      STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE,
    ),
    true,
  );
});

test('outside changed basename blocks output', async () => {
  const { compileStableBlockInstanceIdPolicyKernel, STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES } = await loadModule();
  const result = compileStableBlockInstanceIdPolicyKernel(baseInput({
    changedBasenames: [...allowedChangedBasenames(), 'package.json'],
  }));

  assert.equal(result.outputDecision, 'STABLE_BLOCK_INSTANCE_ID_POLICY_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.FORBIDDEN_BASENAME_CHANGE),
    true,
  );
});

test('Stage05E evidence ref is required and not permission', async () => {
  const { compileStableBlockInstanceIdPolicyKernel, STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES } = await loadModule();
  const result = compileStableBlockInstanceIdPolicyKernel(baseInput({ stage05eEvidenceRefHash: '' }));

  assert.equal(result.stage06AdmissionGranted, false);
  assert.equal(result.applyTxnPermissionGranted, false);
  assert.equal(
    result.blockedReasons.includes(STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.MISSING_STAGE05E_EVIDENCE_REF),
    true,
  );
});

test('Stage05F exit guard ref is required and not Stage06 permission', async () => {
  const { compileStableBlockInstanceIdPolicyKernel, STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES } = await loadModule();
  const result = compileStableBlockInstanceIdPolicyKernel(baseInput({ stage05fExitGuardRefHash: '' }));

  assert.equal(result.stage06AdmissionGranted, false);
  assert.equal(result.applyTxnPermissionGranted, false);
  assert.equal(
    result.blockedReasons.includes(STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.MISSING_STAGE05F_EXIT_GUARD_REF),
    true,
  );
});

test('stale Stage05 evidence ref blocks output', async () => {
  const { compileStableBlockInstanceIdPolicyKernel, STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES } = await loadModule();
  const result = compileStableBlockInstanceIdPolicyKernel(baseInput({
    stage05eEvidenceRefHash: 'actual-stage05e-hash',
    stage05eEvidenceRefHashExpected: 'expected-stage05e-hash',
  }));

  assert.equal(result.outputDecision, 'STABLE_BLOCK_INSTANCE_ID_POLICY_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.STALE_STAGE05_EVIDENCE_REF),
    true,
  );
});

test('owner decision evidence hash is not policy acceptance', async () => {
  const { compileStableBlockInstanceIdPolicyKernel, STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES } = await loadModule();
  const result = compileStableBlockInstanceIdPolicyKernel(baseInput());

  assert.equal(result.ownerDecisionEvidenceIsPolicyAcceptance, false);
  assert.equal(result.policyAcceptedAsProjectTruth, false);
  assert.equal(firstClassification(result).ownerDecisionEvidenceIsPolicyAcceptance, false);
  assert.equal(
    firstClassification(result).reasonCodes.includes(
      STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.OWNER_DECISION_EVIDENCE_REF_ONLY_NOT_POLICY_ACCEPTANCE,
    ),
    true,
  );
});

test('block instance proof is advisory only and does not create stable id', async () => {
  const { compileStableBlockInstanceIdPolicyKernel, STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES } = await loadModule();
  const result = compileStableBlockInstanceIdPolicyKernel(baseInput({
    candidates: [baseCandidate({ externalBlockInstanceProof: 'instance-proof' })],
  }));

  assert.equal(firstClassification(result).classification, 'EVIDENCE_REFERENCE_ONLY');
  assert.equal(firstClassification(result).stableBlockInstanceIdCreated, false);
  assert.equal(result.stableBlockInstanceIdCreated, false);
  assert.equal(
    firstClassification(result).reasonCodes.includes(
      STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.BLOCK_INSTANCE_PROOF_ADVISORY_ONLY,
    ),
    true,
  );
});

test('block lineage proof is advisory only and does not create stable id', async () => {
  const { compileStableBlockInstanceIdPolicyKernel, STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES } = await loadModule();
  const result = compileStableBlockInstanceIdPolicyKernel(baseInput({
    candidates: [baseCandidate({ blockLineageProof: 'lineage-proof' })],
  }));

  assert.equal(firstClassification(result).stableBlockInstanceIdCreated, false);
  assert.equal(
    firstClassification(result).reasonCodes.includes(
      STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.BLOCK_LINEAGE_PROOF_ADVISORY_ONLY,
    ),
    true,
  );
});

test('block version hash remains guard only', async () => {
  const { compileStableBlockInstanceIdPolicyKernel, STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES } = await loadModule();
  const result = compileStableBlockInstanceIdPolicyKernel(baseInput({
    candidates: [baseCandidate({ blockVersionHash: 'block-version' })],
  }));

  assert.equal(firstClassification(result).stableBlockInstanceIdProjectTruthClaimed, false);
  assert.equal(
    firstClassification(result).reasonCodes.includes(
      STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.BLOCK_VERSION_HASH_GUARD_ONLY,
    ),
    true,
  );
});

test('target block ref remains review reference not project truth', async () => {
  const { compileStableBlockInstanceIdPolicyKernel, STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES } = await loadModule();
  const result = compileStableBlockInstanceIdPolicyKernel(baseInput({
    candidates: [baseCandidate({ targetBlockRef: 'target-ref' })],
  }));

  assert.equal(firstClassification(result).stableBlockInstanceIdProjectTruthClaimed, false);
  assert.equal(
    firstClassification(result).reasonCodes.includes(
      STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.TARGET_BLOCK_REF_NOT_PROJECT_TRUTH,
    ),
    true,
  );
});

test('explicit stable block instance id creation claim blocks output', async () => {
  const { compileStableBlockInstanceIdPolicyKernel, STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES } = await loadModule();
  const candidateLevel = compileStableBlockInstanceIdPolicyKernel(baseInput({
    candidates: [baseCandidate({ createStableBlockInstanceIdClaimed: true })],
  }));
  const topLevelWithoutCandidates = compileStableBlockInstanceIdPolicyKernel(baseInput({
    createStableBlockInstanceIdClaimed: true,
    candidates: [],
  }));

  assert.equal(candidateLevel.outputDecision, 'STABLE_BLOCK_INSTANCE_ID_POLICY_BLOCKED');
  assert.equal(topLevelWithoutCandidates.outputDecision, 'STABLE_BLOCK_INSTANCE_ID_POLICY_BLOCKED');
  assert.equal(candidateLevel.stableBlockInstanceIdCreated, false);
  assert.equal(topLevelWithoutCandidates.stableBlockInstanceIdCreated, false);
  assert.equal(
    candidateLevel.blockedReasons.includes(
      STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.FORBIDDEN_STABLE_BLOCK_INSTANCE_ID_CREATION_CLAIM,
    ),
    true,
  );
  assert.equal(
    topLevelWithoutCandidates.blockedReasons.includes(
      STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.FORBIDDEN_STABLE_BLOCK_INSTANCE_ID_CREATION_CLAIM,
    ),
    true,
  );
});

test('explicit policy acceptance claim blocks output', async () => {
  const { compileStableBlockInstanceIdPolicyKernel, STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES } = await loadModule();
  const result = compileStableBlockInstanceIdPolicyKernel(baseInput({
    policyAcceptanceClaimed: true,
    candidates: [],
  }));

  assert.equal(result.outputDecision, 'STABLE_BLOCK_INSTANCE_ID_POLICY_BLOCKED');
  assert.equal(result.policyAcceptedAsProjectTruth, false);
  assert.equal(
    result.blockedReasons.includes(STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.FORBIDDEN_POLICY_ACCEPTANCE_CLAIM),
    true,
  );
});

test('explicit Stage06 permission claim blocks output', async () => {
  const { compileStableBlockInstanceIdPolicyKernel, STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES } = await loadModule();
  const candidateLevel = compileStableBlockInstanceIdPolicyKernel(baseInput({
    candidates: [baseCandidate({ stage06PermissionClaimed: true })],
  }));
  const topLevelWithoutCandidates = compileStableBlockInstanceIdPolicyKernel(baseInput({
    stage06PermissionClaimed: true,
    candidates: [],
  }));

  assert.equal(candidateLevel.outputDecision, 'STABLE_BLOCK_INSTANCE_ID_POLICY_BLOCKED');
  assert.equal(topLevelWithoutCandidates.outputDecision, 'STABLE_BLOCK_INSTANCE_ID_POLICY_BLOCKED');
  assert.equal(candidateLevel.stage06AdmissionGranted, false);
  assert.equal(topLevelWithoutCandidates.stage06AdmissionGranted, false);
  assert.equal(
    candidateLevel.blockedReasons.includes(STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.FORBIDDEN_STAGE06_PERMISSION_CLAIM),
    true,
  );
  assert.equal(
    topLevelWithoutCandidates.blockedReasons.includes(
      STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.FORBIDDEN_STAGE06_PERMISSION_CLAIM,
    ),
    true,
  );
});

test('explicit ApplyTxn claim blocks output', async () => {
  const { compileStableBlockInstanceIdPolicyKernel, STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES } = await loadModule();
  const candidateLevel = compileStableBlockInstanceIdPolicyKernel(baseInput({
    candidates: [baseCandidate({ applyTxnPermissionClaimed: true })],
  }));
  const topLevelWithoutCandidates = compileStableBlockInstanceIdPolicyKernel(baseInput({
    applyTxnPermissionClaimed: true,
    candidates: [],
  }));

  assert.equal(candidateLevel.outputDecision, 'STABLE_BLOCK_INSTANCE_ID_POLICY_BLOCKED');
  assert.equal(topLevelWithoutCandidates.outputDecision, 'STABLE_BLOCK_INSTANCE_ID_POLICY_BLOCKED');
  assert.equal(candidateLevel.applyTxnPermissionGranted, false);
  assert.equal(topLevelWithoutCandidates.applyTxnPermissionGranted, false);
  assert.equal(
    candidateLevel.blockedReasons.includes(STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.FORBIDDEN_APPLYTXN_CLAIM),
    true,
  );
  assert.equal(
    topLevelWithoutCandidates.blockedReasons.includes(STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.FORBIDDEN_APPLYTXN_CLAIM),
    true,
  );
});

test('structural move split merge is manual only', async () => {
  const { compileStableBlockInstanceIdPolicyKernel, STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES } = await loadModule();

  for (const kind of ['MOVE', 'SPLIT', 'MERGE']) {
    const result = compileStableBlockInstanceIdPolicyKernel(baseInput({
      candidates: [baseCandidate({ structuralChangeKind: kind })],
    }));
    assert.equal(result.structuralPolicyManualOnly, true, kind);
    assert.equal(
      firstClassification(result).reasonCodes.includes(
        STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.STRUCTURAL_POLICY_MANUAL_ONLY,
      ),
      true,
      kind,
    );
  }
});

test('exact text consumer claim is future consumer only', async () => {
  const { compileStableBlockInstanceIdPolicyKernel, STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES } = await loadModule();
  const result = compileStableBlockInstanceIdPolicyKernel(baseInput({
    candidates: [baseCandidate({ consumerKind: 'EXACT_TEXT' })],
  }));

  assert.equal(result.exactTextCurrentApplyPath, false);
  assert.equal(
    firstClassification(result).reasonCodes.includes(
      STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.EXACT_TEXT_FUTURE_CONSUMER_ONLY,
    ),
    true,
  );
});

test('review bom lists policy blockers and advisory items', async () => {
  const { compileStableBlockInstanceIdPolicyKernel, STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES } = await loadModule();
  const result = compileStableBlockInstanceIdPolicyKernel(baseInput({
    applyTxnPermissionClaimed: true,
    candidates: [baseCandidate({ externalBlockInstanceProof: 'instance-proof' })],
  }));

  assert.equal(result.reviewBom.blockerCount > 0, true);
  assert.equal(result.reviewBom.stableBlockInstanceIdCreatedCount, 0);
  assert.equal(
    result.reviewBom.blockerCodes.includes(STABLE_BLOCK_INSTANCE_ID_POLICY_REASON_CODES.FORBIDDEN_APPLYTXN_CLAIM),
    true,
  );
  assert.equal(result.stage06BlockersPreview.previewOnly, true);
  assert.equal(result.stage06BlockersPreview.stage06AdmissionGranted, false);
  assert.equal(result.stage06BlockersPreview.applyTxnPermissionGranted, false);
});

test('output exposes zero write apply storage Stage06 flags', async () => {
  const { compileStableBlockInstanceIdPolicyKernel } = await loadModule();
  const result = compileStableBlockInstanceIdPolicyKernel(baseInput());

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
  assert.equal(result.stableBlockInstanceIdCreated, false);
  assert.equal(result.stableBlockInstanceIdPersisted, false);
  assert.equal(result.policyAcceptedAsProjectTruth, false);
  assert.equal(result.stage06AdmissionGranted, false);
  assert.equal(result.applyTxnPermissionGranted, false);
});
