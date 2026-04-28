const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b2c17-migration-killpoint-proof-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B2C17_MIGRATION_KILLPOINT_PROOF_STATUS_V1.json');
const EVIDENCE_DIR = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'B2C17_MIGRATION_KILLPOINT_PROOF', 'TICKET_01');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function readJson(targetPath) {
  return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
}

test('b2c17 migration killpoint proof: committed status equals executable state and required proofs stay green', async () => {
  const { evaluateB2C17MigrationKillpointProofState, TOKEN_NAME } = await loadModule();
  const state = await evaluateB2C17MigrationKillpointProofState({ repoRoot: REPO_ROOT });
  const committedState = readJson(STATUS_PATH);

  assert.deepEqual(committedState, state);
  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state[TOKEN_NAME], 1);
  assert.deepEqual(state.failRows, []);
  assert.equal(state.proof.repoBound, true);
  assert.equal(state.proof.simulatedDeterministicHarnessOnly, true);
  assert.equal(state.proof.b2c16PolicyBound, true);
  assert.equal(state.proof.everyKillpointHasExplicitInputStateOk, true);
  assert.equal(state.proof.everyKillpointHasExpectedDispositionOk, true);
  assert.equal(state.proof.everyKillpointHasUnsafeFailureCodeOk, true);
  assert.equal(state.proof.everyKillpointEndsRecoverableOrExplicitStopOk, true);
  assert.equal(state.proof.mixedOldNewDataRejectedOk, true);
  assert.equal(state.proof.sceneTextLossRejectedOk, true);
  assert.equal(state.proof.rollbackDecisionAvailableOrStopExplicitOk, true);
  assert.equal(state.proof.backupPreconditionRespectedOk, true);
  assert.equal(state.proof.recoveryPackPreconditionRespectedOk, true);
  assert.equal(state.proof.rollbackPlanPreconditionRespectedOk, true);
  assert.equal(state.proof.noDocOnlyEvidenceOk, true);
  assert.equal(state.proof.realMigrationExecutionRejectedOk, true);
  assert.equal(state.proof.block2ExitClaimFalseOk, true);
});

test('b2c17 migration killpoint proof: evidence packets align, donor mapping is exact, and negatives stay explicit', async () => {
  const { evaluateB2C17MigrationKillpointProofState } = await loadModule();
  const state = await evaluateB2C17MigrationKillpointProofState({ repoRoot: REPO_ROOT });
  const killpointMatrix = readJson(path.join(EVIDENCE_DIR, 'killpoint-matrix.json'));
  const recoveryOutcomeProof = readJson(path.join(EVIDENCE_DIR, 'recovery-outcome-proof.json'));
  const donorMapping = readJson(path.join(EVIDENCE_DIR, 'donor-mapping.json'));

  assert.equal(killpointMatrix.currentSchemaVersion, state.runtime.currentSchemaVersion);
  assert.equal(killpointMatrix.b2c16PolicyBound, true);
  assert.deepEqual(killpointMatrix.requiredKillpoints, [
    'AFTER_INTENT',
    'AFTER_BACKUP',
    'AFTER_RECOVERY_PACK',
    'AFTER_FIRST_DATA_WRITE',
    'AFTER_PARTIAL_RENAME',
    'BEFORE_MANIFEST_WRITE',
    'AFTER_MANIFEST_RENAME',
    'BEFORE_LEDGER',
    'AFTER_LEDGER',
    'BACKUP_ROTATION_FAILURE',
  ]);
  assert.equal(killpointMatrix.killpointMatrixHash, state.proof.killpointMatrixHash);
  assert.deepEqual(killpointMatrix.rows, state.runtime.killpointMatrix);

  assert.deepEqual(recoveryOutcomeProof.runtime.positiveCases, state.runtime.positiveCases);
  assert.deepEqual(recoveryOutcomeProof.runtime.negativeCases, state.runtime.negativeCases);
  assert.deepEqual(recoveryOutcomeProof.runtime.recoveryOutcomes, state.runtime.recoveryOutcomes);
  assert.equal(recoveryOutcomeProof.proof.everyKillpointEndsRecoverableOrExplicitStopOk, true);
  assert.equal(recoveryOutcomeProof.proof.mixedOldNewDataRejectedOk, true);
  assert.equal(recoveryOutcomeProof.proof.sceneTextLossRejectedOk, true);
  assert.equal(recoveryOutcomeProof.proof.rollbackDecisionAvailableOrStopExplicitOk, true);
  assert.equal(recoveryOutcomeProof.proof.noDocOnlyEvidenceOk, true);
  assert.equal(recoveryOutcomeProof.proof.realMigrationExecutionRejectedOk, true);

  assert.equal(donorMapping.donor.primaryBasename, 'writer-editor-longform-v5_1-block2-trusted-kernel-pack-v1.zip');
  assert.deepEqual(donorMapping.consultedEntries, [
    'migration-policy.js',
    'recovery-pack.js',
    'atomic-recovery-killpoint.test.js',
  ]);
  assert.equal(donorMapping.mappedContour, 'B2C17_MIGRATION_KILLPOINT_PROOF');
  assert.equal(donorMapping.acceptedUse, 'KILLPOINT_SEQUENCE_DISPOSITION_CODES_RECOVERY_BOUNDARY_AND_NEGATIVE_CASE_SHAPE_ONLY');
  assert.equal(donorMapping.rejectedUse, 'NO_RUNTIME_IMPORT_NO_REAL_MIGRATION_NO_USER_DATA_ROLLBACK_NO_BACKUP_ROTATION_RUNTIME_NO_SCOPE_REOPEN_NO_BLOCK2_EXIT');

  assert.equal(state.runtime.positiveCases.length, 5);
  assert.equal(state.runtime.negativeCases.length, 5);
  assert.equal(state.runtime.negativeCases.every((entry) => entry.ok === true), true);
});

test('b2c17 migration killpoint proof: command results have no pending rows and false claims stay false', async () => {
  const { evaluateB2C17MigrationKillpointProofState } = await loadModule();
  const state = await evaluateB2C17MigrationKillpointProofState({ repoRoot: REPO_ROOT });
  const commandResults = readJson(path.join(EVIDENCE_DIR, 'command-results.json'));

  assert.equal(commandResults.taskId, 'B2C17_MIGRATION_KILLPOINT_PROOF');
  assert.equal(Array.isArray(commandResults.commands), true);
  assert.equal(commandResults.commands.length, 9);
  assert.equal(commandResults.commands.every((entry) => entry.result !== 'PENDING' && entry.result !== 'NOT_RECORDED'), true);
  assert.equal(commandResults.commands.every((entry) => typeof entry.summary === 'string' && entry.summary.length > 0), true);

  assert.equal(state.scope.uiTouched, false);
  assert.equal(state.scope.dependencyChanged, false);
  assert.equal(state.scope.schemaChanged, false);
  assert.equal(state.scope.storageFormatChanged, false);
  assert.equal(state.scope.realUserDataMigration, false);
  assert.equal(state.scope.productionStorageMigrationRuntime, false);
  assert.equal(state.scope.actualRollbackExecutionOnUserData, false);
  assert.equal(state.scope.backupRotationRuntime, false);
  assert.equal(state.scope.b2c14ScopeReopen, false);
  assert.equal(state.scope.b2c15ScopeReopen, false);
  assert.equal(state.scope.b2c18PerfClaim, false);
  assert.equal(state.scope.b2c19AuditClaim, false);
  assert.equal(state.scope.block2ExitClaim, false);
  assert.equal(state.scope.block3StartClaim, false);
  assert.equal(state.scope.releaseClaim, false);
  assert.equal(state.scope.b2c20ScopeClaim, false);
});
