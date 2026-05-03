const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'stage06FalseGreenExitGuard.mjs';
const TEST_BASENAME = 'stage06FalseGreenExitGuard.contract.test.js';
const TASK_BASENAME = 'STAGE05F_STAGE06_FALSE_GREEN_EXIT_GUARD_001.md';

async function loadModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

function allowedChangedBasenames() {
  return [MODULE_BASENAME, TEST_BASENAME, TASK_BASENAME];
}

function baseCandidate(overrides = {}) {
  return {
    candidateId: 'candidate-001',
    structuralChangeKind: 'NONE',
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    changedBasenames: allowedChangedBasenames(),
    stage05eEvidenceRefHash: 'stage05e-evidence-hash-001',
    ownerDecisionEvidenceHash: 'owner-decision-evidence-hash-001',
    candidates: [baseCandidate()],
    ...overrides,
  };
}

function firstClassification(result) {
  return result.classifications[0];
}

test('stage05f module stays pure deterministic in-memory exit guard', () => {
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

test('same input returns same exit guard packet and hash', async () => {
  const { compileStage06FalseGreenExitGuard } = await loadModule();
  const first = compileStage06FalseGreenExitGuard(baseInput());
  const second = compileStage06FalseGreenExitGuard(baseInput());

  assert.deepEqual(first, second);
  assert.equal(first.canonicalHash, second.canonicalHash);
  assert.equal(firstClassification(first).falseGreenEvidenceHash, firstClassification(second).falseGreenEvidenceHash);
});

test('missing owner decision evidence blocks Stage06 permission claim', async () => {
  const {
    compileStage06FalseGreenExitGuard,
    STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES,
  } = await loadModule();
  const result = compileStage06FalseGreenExitGuard(baseInput({
    ownerDecisionEvidenceHash: '',
    stage06PermissionClaimed: true,
  }));

  assert.equal(result.outputDecision, 'STAGE06_FALSE_GREEN_EXIT_GUARD_BLOCKED');
  assert.equal(result.stage06PermissionGranted, false);
  assert.equal(
    result.blockedReasons.includes(STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.OWNER_DECISION_EVIDENCE_NOT_PRESENT),
    true,
  );
  assert.equal(
    result.blockedReasons.includes(STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.FORBIDDEN_STAGE06_PERMISSION_CLAIM),
    true,
  );
});

test('owner decision present with hash is not policy acceptance', async () => {
  const { compileStage06FalseGreenExitGuard, OWNER_DECISION_EVIDENCE_STATUS } = await loadModule();
  const result = compileStage06FalseGreenExitGuard(baseInput());

  assert.equal(result.ownerDecisionEvidenceStatus, OWNER_DECISION_EVIDENCE_STATUS.PRESENT_WITH_HASH);
  assert.equal(result.ownerDecisionEvidenceIsPolicyAcceptance, false);
  assert.equal(result.policyAcceptedAsProjectTruth, false);
  assert.equal(result.stage06PermissionGranted, false);
});

test('Stage05E classifier output is evidence ref not permission', async () => {
  const {
    compileStage06FalseGreenExitGuard,
    STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES,
  } = await loadModule();
  const result = compileStage06FalseGreenExitGuard(baseInput({
    stage05eClassifierOutput: {
      canonicalHash: 'stage05e-canonical-hash-001',
      stage06AdmissionGranted: false,
      applyTxnPermissionGranted: false,
    },
  }));

  assert.equal(result.stage05eEvidenceRefIsPermission, false);
  assert.equal(firstClassification(result).stage05eEvidenceRefIsPermission, false);
  assert.equal(
    firstClassification(result).reasonCodes.includes(
      STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.STAGE05E_EVIDENCE_REF_ONLY_NOT_PERMISSION,
    ),
    true,
  );
});

test('advisory block instance proof does not unblock Stage06', async () => {
  const {
    compileStage06FalseGreenExitGuard,
    STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES,
  } = await loadModule();
  const result = compileStage06FalseGreenExitGuard(baseInput({
    candidates: [baseCandidate({ externalBlockInstanceProof: 'advisory-instance-proof' })],
  }));

  assert.equal(result.stage06PermissionGranted, false);
  assert.equal(firstClassification(result).blockInstanceProofProjectTruthClaimed, false);
  assert.equal(
    result.blockedReasons.includes(STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.BLOCK_INSTANCE_POLICY_NOT_ACCEPTED),
    true,
  );
  assert.equal(
    firstClassification(result).reasonCodes.includes(
      STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.STAGE05E_ADVISORY_ONLY_PROOFS_NOT_PERMISSION,
    ),
    true,
  );
});

test('advisory block lineage proof does not unblock Stage06', async () => {
  const {
    compileStage06FalseGreenExitGuard,
    STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES,
  } = await loadModule();
  const result = compileStage06FalseGreenExitGuard(baseInput({
    candidates: [baseCandidate({ blockLineageProof: 'advisory-lineage-proof' })],
  }));

  assert.equal(result.stage06PermissionGranted, false);
  assert.equal(firstClassification(result).blockLineageProofProjectTruthClaimed, false);
  assert.equal(
    result.blockedReasons.includes(STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.BLOCK_LINEAGE_POLICY_NOT_ACCEPTED),
    true,
  );
});

test('explicit Stage06 permission claim blocks output', async () => {
  const {
    compileStage06FalseGreenExitGuard,
    STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES,
  } = await loadModule();
  const packetLevel = compileStage06FalseGreenExitGuard(baseInput({
    candidates: [baseCandidate({ stage06PermissionClaimed: true })],
  }));
  const topLevel = compileStage06FalseGreenExitGuard(baseInput({ stage06AdmissionClaimed: true }));

  assert.equal(packetLevel.outputDecision, 'STAGE06_FALSE_GREEN_EXIT_GUARD_BLOCKED');
  assert.equal(topLevel.outputDecision, 'STAGE06_FALSE_GREEN_EXIT_GUARD_BLOCKED');
  assert.equal(
    packetLevel.blockedReasons.includes(STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.FORBIDDEN_STAGE06_PERMISSION_CLAIM),
    true,
  );
  assert.equal(
    topLevel.blockedReasons.includes(STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.FORBIDDEN_STAGE06_PERMISSION_CLAIM),
    true,
  );
});

test('explicit ApplyTxn claim blocks output', async () => {
  const {
    compileStage06FalseGreenExitGuard,
    STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES,
  } = await loadModule();
  const result = compileStage06FalseGreenExitGuard(baseInput({
    candidates: [baseCandidate({ applyTxnPermissionClaimed: true })],
  }));

  assert.equal(result.outputDecision, 'STAGE06_FALSE_GREEN_EXIT_GUARD_BLOCKED');
  assert.equal(result.applyTxnPermissionGranted, false);
  assert.equal(
    result.blockedReasons.includes(STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.FORBIDDEN_APPLYTXN_CLAIM),
    true,
  );
});

test('explicit policy acceptance claim without owner decision hash blocks output', async () => {
  const {
    compileStage06FalseGreenExitGuard,
    STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES,
  } = await loadModule();
  const result = compileStage06FalseGreenExitGuard(baseInput({
    ownerDecisionEvidenceHash: '',
    policyAcceptanceClaimed: true,
  }));

  assert.equal(result.outputDecision, 'STAGE06_FALSE_GREEN_EXIT_GUARD_BLOCKED');
  assert.equal(result.policyAcceptedAsProjectTruth, false);
  assert.equal(
    result.blockedReasons.includes(STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.FORBIDDEN_POLICY_ACCEPTANCE_CLAIM),
    true,
  );
  assert.equal(
    result.blockedReasons.includes(STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.OWNER_DECISION_EVIDENCE_NOT_PRESENT),
    true,
  );
});

test('explicit Stage06 API or model creation claim blocks output', async () => {
  const {
    compileStage06FalseGreenExitGuard,
    STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES,
  } = await loadModule();
  const result = compileStage06FalseGreenExitGuard(baseInput({
    candidates: [baseCandidate({ stage06ModelCreatedClaimed: true })],
  }));

  assert.equal(result.outputDecision, 'STAGE06_FALSE_GREEN_EXIT_GUARD_BLOCKED');
  assert.equal(result.stage06ApiCreated, false);
  assert.equal(result.stage06ModelCreated, false);
  assert.equal(result.stage06SemanticsCreated, false);
  assert.equal(
    result.blockedReasons.includes(
      STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.FORBIDDEN_STAGE06_API_MODEL_CREATION_CLAIM,
    ),
    true,
  );
});

test('missing Stage05E evidence ref blocks output', async () => {
  const {
    compileStage06FalseGreenExitGuard,
    STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES,
  } = await loadModule();
  const result = compileStage06FalseGreenExitGuard(baseInput({ stage05eEvidenceRefHash: '' }));

  assert.equal(result.outputDecision, 'STAGE06_FALSE_GREEN_EXIT_GUARD_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.MISSING_STAGE05E_EVIDENCE_REF),
    true,
  );
});

test('stale Stage05 evidence ref blocks output', async () => {
  const {
    compileStage06FalseGreenExitGuard,
    STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES,
  } = await loadModule();
  const result = compileStage06FalseGreenExitGuard(baseInput({
    stage05eEvidenceRefHash: 'actual-stage05e-hash',
    stage05eExpectedEvidenceHash: 'expected-stage05e-hash',
  }));

  assert.equal(result.outputDecision, 'STAGE06_FALSE_GREEN_EXIT_GUARD_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.STALE_STAGE05_EVIDENCE_REF),
    true,
  );
});

test('structural policy remains manual only', async () => {
  const {
    compileStage06FalseGreenExitGuard,
    STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES,
  } = await loadModule();

  for (const kind of ['MOVE', 'SPLIT', 'MERGE']) {
    const result = compileStage06FalseGreenExitGuard(baseInput({
      candidates: [baseCandidate({ structuralChangeKind: kind })],
    }));
    assert.equal(result.structuralPolicyManualOnly, true, kind);
    assert.equal(
      firstClassification(result).reasonCodes.includes(
        STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.STRUCTURAL_POLICY_MANUAL_ONLY,
      ),
      true,
      kind,
    );
  }
});

test('ReviewBOM lists false Stage06 green blockers', async () => {
  const {
    compileStage06FalseGreenExitGuard,
    STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES,
  } = await loadModule();
  const result = compileStage06FalseGreenExitGuard(baseInput({
    ownerDecisionEvidenceHash: '',
    stage06PermissionClaimed: true,
    applyTxnPermissionClaimed: true,
    candidates: [baseCandidate({ externalBlockInstanceProof: 'instance-proof' })],
  }));

  assert.equal(result.reviewBom.falseGreenBlockerCount > 0, true);
  assert.equal(
    result.reviewBom.falseGreenBlockerCodes.includes(
      STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.FORBIDDEN_STAGE06_PERMISSION_CLAIM,
    ),
    true,
  );
  assert.equal(
    result.reviewBom.falseGreenBlockerCodes.includes(
      STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.FORBIDDEN_APPLYTXN_CLAIM,
    ),
    true,
  );
});

test('missing changedBasenames blocks output and outside basename blocks output', async () => {
  const {
    compileStage06FalseGreenExitGuard,
    STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES,
  } = await loadModule();
  const missing = compileStage06FalseGreenExitGuard({
    stage05eEvidenceRefHash: 'stage05e-hash',
    ownerDecisionEvidenceHash: 'owner-hash',
    candidates: [baseCandidate()],
  });
  const outside = compileStage06FalseGreenExitGuard({
    changedBasenames: [...allowedChangedBasenames(), 'package.json'],
    stage05eEvidenceRefHash: 'stage05e-hash',
    ownerDecisionEvidenceHash: 'owner-hash',
    candidates: [baseCandidate()],
  });

  assert.equal(missing.outputDecision, 'STAGE06_FALSE_GREEN_EXIT_GUARD_BLOCKED');
  assert.equal(
    missing.blockedReasons.includes(
      STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE,
    ),
    true,
  );
  assert.equal(outside.outputDecision, 'STAGE06_FALSE_GREEN_EXIT_GUARD_BLOCKED');
  assert.equal(
    outside.blockedReasons.includes(STAGE06_FALSE_GREEN_EXIT_GUARD_REASON_CODES.FORBIDDEN_BASENAME_CHANGE),
    true,
  );
});

test('module exposes zero write apply storage Stage06 API and model flags', async () => {
  const { compileStage06FalseGreenExitGuard } = await loadModule();
  const result = compileStage06FalseGreenExitGuard(baseInput());

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
  assert.equal(result.stage06ApiCreated, false);
  assert.equal(result.stage06ModelCreated, false);
  assert.equal(result.stage06SemanticsCreated, false);
});
