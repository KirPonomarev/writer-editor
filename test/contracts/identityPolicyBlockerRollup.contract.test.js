const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'identityPolicyBlockerRollup.mjs';
const TEST_BASENAME = 'identityPolicyBlockerRollup.contract.test.js';
const TASK_BASENAME = 'STAGE05K_IDENTITY_POLICY_BLOCKER_ROLLUP_001.md';

async function loadModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

function allowedChangedBasenames() {
  return [MODULE_BASENAME, TEST_BASENAME, TASK_BASENAME];
}

function baseInput(overrides = {}) {
  return {
    changedBasenames: allowedChangedBasenames(),
    stage05dSourceRefHash: 'stage05d-source-hash-001',
    stage05eEvidenceRefHash: 'stage05e-evidence-hash-001',
    stage05fExitGuardRefHash: 'stage05f-exit-guard-hash-001',
    stage05iPolicyRefHash: 'stage05i-policy-hash-001',
    stage05jPolicyRefHash: 'stage05j-policy-hash-001',
    ...overrides,
  };
}

test('stage05k module stays pure deterministic in-memory blocker rollup', () => {
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

test('same input returns same blocker rollup and canonical hash', async () => {
  const { compileIdentityPolicyBlockerRollup } = await loadModule();
  const first = compileIdentityPolicyBlockerRollup(baseInput());
  const second = compileIdentityPolicyBlockerRollup(baseInput());

  assert.deepEqual(first, second);
  assert.equal(first.canonicalHash, second.canonicalHash);
});

test('complete refs still stop at owner policy required and never ready', async () => {
  const { compileIdentityPolicyBlockerRollup } = await loadModule();
  const result = compileIdentityPolicyBlockerRollup(baseInput());

  assert.equal(result.outputDecision, 'IDENTITY_POLICY_BLOCKER_ROLLUP_COMPILED');
  assert.equal(result.identityPolicyState, 'STOP_OWNER_POLICY_REQUIRED');
  assert.equal(result.readyStatusAllowed, false);
  assert.equal(result.stage05ExitReady, false);
  assert.equal(result.stage06AdmissionGranted, false);
  assert.equal(result.applyTxnPermissionGranted, false);
  assert.equal(result.ownerPolicyDecisionRequired, true);
});

test('missing changedBasenames blocks rollup', async () => {
  const { compileIdentityPolicyBlockerRollup, IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyBlockerRollup({
    stage05eEvidenceRefHash: 'stage05e',
    stage05fExitGuardRefHash: 'stage05f',
    stage05iPolicyRefHash: 'stage05i',
    stage05jPolicyRefHash: 'stage05j',
  });

  assert.equal(result.identityPolicyState, 'IDENTITY_POLICY_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE),
    true,
  );
});

test('outside changed basename blocks rollup', async () => {
  const { compileIdentityPolicyBlockerRollup, IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyBlockerRollup(baseInput({
    changedBasenames: [...allowedChangedBasenames(), 'package.json'],
  }));

  assert.equal(result.identityPolicyState, 'IDENTITY_POLICY_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.FORBIDDEN_BASENAME_CHANGE),
    true,
  );
});

test('missing Stage05I or Stage05J ref blocks rollup', async () => {
  const { compileIdentityPolicyBlockerRollup, IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES } = await loadModule();
  const missingI = compileIdentityPolicyBlockerRollup(baseInput({ stage05iPolicyRefHash: '' }));
  const missingJ = compileIdentityPolicyBlockerRollup(baseInput({ stage05jPolicyRefHash: '' }));

  assert.equal(missingI.identityPolicyState, 'IDENTITY_POLICY_BLOCKED');
  assert.equal(missingJ.identityPolicyState, 'IDENTITY_POLICY_BLOCKED');
  assert.equal(
    missingI.blockedReasons.includes(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.MISSING_STAGE05I_POLICY_REF),
    true,
  );
  assert.equal(
    missingJ.blockedReasons.includes(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.MISSING_STAGE05J_POLICY_REF),
    true,
  );
});

test('missing Stage05E or Stage05F ref blocks rollup', async () => {
  const { compileIdentityPolicyBlockerRollup, IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES } = await loadModule();
  const missingE = compileIdentityPolicyBlockerRollup(baseInput({ stage05eEvidenceRefHash: '' }));
  const missingF = compileIdentityPolicyBlockerRollup(baseInput({ stage05fExitGuardRefHash: '' }));

  assert.equal(missingE.identityPolicyState, 'IDENTITY_POLICY_BLOCKED');
  assert.equal(missingF.identityPolicyState, 'IDENTITY_POLICY_BLOCKED');
  assert.equal(
    missingE.blockedReasons.includes(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.MISSING_STAGE05E_EVIDENCE_REF),
    true,
  );
  assert.equal(
    missingF.blockedReasons.includes(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.MISSING_STAGE05F_EXIT_GUARD_REF),
    true,
  );
});

test('stale Stage05I or Stage05J refs block rollup', async () => {
  const { compileIdentityPolicyBlockerRollup, IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES } = await loadModule();
  const staleI = compileIdentityPolicyBlockerRollup(baseInput({
    stage05iPolicyRefHash: 'actual-stage05i',
    stage05iPolicyRefHashExpected: 'expected-stage05i',
  }));
  const staleJ = compileIdentityPolicyBlockerRollup(baseInput({
    stage05jPolicyRefHash: 'actual-stage05j',
    stage05jPolicyRefHashExpected: 'expected-stage05j',
  }));

  assert.equal(staleI.identityPolicyState, 'IDENTITY_POLICY_BLOCKED');
  assert.equal(staleJ.identityPolicyState, 'IDENTITY_POLICY_BLOCKED');
  assert.equal(staleI.blockedReasons.includes(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.STALE_STAGE05_EVIDENCE_REF), true);
  assert.equal(staleJ.blockedReasons.includes(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.STALE_STAGE05_EVIDENCE_REF), true);
});

test('Stage05D source ref remains optional trace not policy pass', async () => {
  const { compileIdentityPolicyBlockerRollup, IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyBlockerRollup(baseInput({ stage05dSourceRefHash: '' }));

  assert.equal(result.identityPolicyState, 'STOP_OWNER_POLICY_REQUIRED');
  assert.equal(result.policyAcceptedAsProjectTruth, false);
  assert.equal(
    result.reviewBom.rollupItemReasonCodes.includes(
      IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.MISSING_STAGE05D_SOURCE_REF,
    ),
    true,
  );
});

test('stale Stage05D source ref remains optional trace not policy blocker', async () => {
  const { compileIdentityPolicyBlockerRollup, IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyBlockerRollup(baseInput({
    stage05dSourceRefHash: 'actual-stage05d',
    stage05dSourceRefHashExpected: 'expected-stage05d',
  }));

  assert.equal(result.identityPolicyState, 'STOP_OWNER_POLICY_REQUIRED');
  assert.equal(result.policyAcceptedAsProjectTruth, false);
  assert.equal(result.blockedReasons.includes(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.STALE_STAGE05_EVIDENCE_REF), false);
  assert.equal(
    result.reviewBom.rollupItemReasonCodes.includes(
      IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.STALE_STAGE05D_SOURCE_REF_TRACE_ONLY_NOT_POLICY_PASS,
    ),
    true,
  );
});

test('Stage05I and Stage05J refs are guards not policy acceptance', async () => {
  const { compileIdentityPolicyBlockerRollup, IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyBlockerRollup(baseInput());

  assert.equal(result.policyAcceptedAsProjectTruth, false);
  assert.equal(result.projectTruthPolicyAccepted, false);
  assert.equal(
    result.reviewBom.rollupItemReasonCodes.includes(
      IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.STAGE05I_REF_GUARD_ONLY_NOT_POLICY_ACCEPTANCE,
    ),
    true,
  );
  assert.equal(
    result.reviewBom.rollupItemReasonCodes.includes(
      IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.STAGE05J_REF_GUARD_ONLY_NOT_POLICY_ACCEPTANCE,
    ),
    true,
  );
});

test('ready status claim blocks output', async () => {
  const { compileIdentityPolicyBlockerRollup, IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyBlockerRollup(baseInput({ readyStatusClaimed: true }));

  assert.equal(result.identityPolicyState, 'IDENTITY_POLICY_BLOCKED');
  assert.equal(result.stage05ExitReady, false);
  assert.equal(result.blockedReasons.includes(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.FORBIDDEN_READY_STATUS_CLAIM), true);
});

test('stage05 exit ready claim blocks output', async () => {
  const { compileIdentityPolicyBlockerRollup, IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyBlockerRollup(baseInput({ stage05ExitReadyClaimed: true }));

  assert.equal(result.identityPolicyState, 'IDENTITY_POLICY_BLOCKED');
  assert.equal(result.stage05ExitReady, false);
  assert.equal(result.blockedReasons.includes(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.FORBIDDEN_STAGE05_EXIT_READY_CLAIM), true);
});

test('Stage06 pre-admission claim blocks output and preview remains preview only', async () => {
  const { compileIdentityPolicyBlockerRollup, IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyBlockerRollup(baseInput({ stage06PreAdmittedClaimed: true }));

  assert.equal(result.identityPolicyState, 'IDENTITY_POLICY_BLOCKED');
  assert.equal(result.stage06PreAdmitted, false);
  assert.equal(result.stage06BlockersPreview.previewOnly, true);
  assert.equal(result.stage06BlockersPreview.preAdmission, false);
  assert.equal(
    result.blockedReasons.includes(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.FORBIDDEN_STAGE06_PRE_ADMISSION_CLAIM),
    true,
  );
});

test('Stage06 permission claim blocks output', async () => {
  const { compileIdentityPolicyBlockerRollup, IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyBlockerRollup(baseInput({ stage06PermissionClaimed: true }));

  assert.equal(result.identityPolicyState, 'IDENTITY_POLICY_BLOCKED');
  assert.equal(result.stage06AdmissionGranted, false);
  assert.equal(
    result.blockedReasons.includes(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.FORBIDDEN_STAGE06_PERMISSION_CLAIM),
    true,
  );
});

test('ApplyTxn claim blocks output', async () => {
  const { compileIdentityPolicyBlockerRollup, IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyBlockerRollup(baseInput({ applyTxnPermissionClaimed: true }));

  assert.equal(result.identityPolicyState, 'IDENTITY_POLICY_BLOCKED');
  assert.equal(result.applyTxnPermissionGranted, false);
  assert.equal(result.blockedReasons.includes(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.FORBIDDEN_APPLYTXN_CLAIM), true);
});

test('storage mutation and stable id creation claims block output', async () => {
  const { compileIdentityPolicyBlockerRollup, IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES } = await loadModule();
  const storage = compileIdentityPolicyBlockerRollup(baseInput({ storageMutationClaimed: true }));
  const stableId = compileIdentityPolicyBlockerRollup(baseInput({ stableBlockInstanceIdCreatedClaimed: true }));

  assert.equal(storage.identityPolicyState, 'IDENTITY_POLICY_BLOCKED');
  assert.equal(stableId.identityPolicyState, 'IDENTITY_POLICY_BLOCKED');
  assert.equal(storage.storageMutationPerformed, false);
  assert.equal(stableId.stableBlockInstanceIdCreated, false);
  assert.equal(
    storage.blockedReasons.includes(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.FORBIDDEN_STORAGE_MUTATION_CLAIM),
    true,
  );
  assert.equal(
    stableId.blockedReasons.includes(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.FORBIDDEN_STABLE_ID_CREATION_CLAIM),
    true,
  );
});

test('policy acceptance and lineage creation claims block output', async () => {
  const { compileIdentityPolicyBlockerRollup, IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES } = await loadModule();
  const policy = compileIdentityPolicyBlockerRollup(baseInput({ policyAcceptanceClaimed: true }));
  const lineage = compileIdentityPolicyBlockerRollup(baseInput({ blockLineageCreatedClaimed: true }));

  assert.equal(policy.identityPolicyState, 'IDENTITY_POLICY_BLOCKED');
  assert.equal(lineage.identityPolicyState, 'IDENTITY_POLICY_BLOCKED');
  assert.equal(policy.policyAcceptedAsProjectTruth, false);
  assert.equal(lineage.blockLineageCreated, false);
  assert.equal(
    policy.blockedReasons.includes(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.FORBIDDEN_POLICY_ACCEPTANCE_CLAIM),
    true,
  );
  assert.equal(
    lineage.blockedReasons.includes(IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.FORBIDDEN_LINEAGE_CREATION_CLAIM),
    true,
  );
});

test('review bom lists remaining policy blockers', async () => {
  const { compileIdentityPolicyBlockerRollup, IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyBlockerRollup(baseInput());

  assert.equal(result.reviewBom.ownerPolicyDecisionRequired, true);
  assert.equal(result.reviewBom.acceptedProjectTruthCount, 0);
  assert.equal(result.reviewBom.readyStatusCount, 0);
  assert.equal(result.reviewBom.stage06AdmissionCount, 0);
  assert.equal(result.reviewBom.applyTxnPermissionCount, 0);
  assert.equal(
    result.reviewBom.rollupItemReasonCodes.includes(
      IDENTITY_POLICY_BLOCKER_ROLLUP_REASON_CODES.OWNER_POLICY_DECISION_REQUIRED,
    ),
    true,
  );
});

test('output exposes zero write apply storage and no ready flags', async () => {
  const { compileIdentityPolicyBlockerRollup } = await loadModule();
  const result = compileIdentityPolicyBlockerRollup(baseInput());

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
  assert.equal(result.stableIdCreated, false);
  assert.equal(result.stableBlockInstanceIdCreated, false);
  assert.equal(result.blockLineageCreated, false);
  assert.equal(result.blockLineagePersisted, false);
  assert.equal(result.policyAcceptedAsProjectTruth, false);
  assert.equal(result.stage05ExitReady, false);
  assert.equal(result.stage06PreAdmitted, false);
  assert.equal(result.stage06AdmissionGranted, false);
  assert.equal(result.applyTxnPermissionGranted, false);
});
