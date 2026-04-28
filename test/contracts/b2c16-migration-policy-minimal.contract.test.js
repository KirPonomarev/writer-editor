const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b2c16-migration-policy-minimal-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B2C16_MIGRATION_POLICY_MINIMAL_STATUS_V1.json');
const EVIDENCE_DIR = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'B2C16_MIGRATION_POLICY_MINIMAL', 'TICKET_01');

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

test('b2c16 migration policy minimal: committed status equals executable state and required policy proofs stay green', async () => {
  const { evaluateB2C16MigrationPolicyMinimalState, TOKEN_NAME } = await loadModule();
  const state = await evaluateB2C16MigrationPolicyMinimalState({ repoRoot: REPO_ROOT });
  const committedState = readJson(STATUS_PATH);

  assert.deepEqual(committedState, state);
  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state[TOKEN_NAME], 1);
  assert.deepEqual(state.failRows, []);
  assert.equal(state.proof.repoBound, true);
  assert.equal(state.proof.deterministicInMemoryPolicyOnly, true);
  assert.equal(state.proof.validSchemaVersionOpensCleanPolicyOk, true);
  assert.equal(state.proof.unknownFutureVersionRestrictedOk, true);
  assert.equal(state.proof.unknownOldVersionStopsOk, true);
  assert.equal(state.proof.migrationRequiredFlagExplicitOk, true);
  assert.equal(state.proof.backupPreconditionOk, true);
  assert.equal(state.proof.recoveryPackPreconditionOk, true);
  assert.equal(state.proof.rollbackPreconditionOk, true);
  assert.equal(state.proof.mixedVersionPolicyStopsOrQuarantinesOk, true);
  assert.equal(state.proof.missingBackupStopsPolicyOk, true);
  assert.equal(state.proof.missingRecoveryPackStopsPolicyOk, true);
  assert.equal(state.proof.missingRollbackStopsPolicyOk, true);
  assert.equal(state.proof.migrationAdvisoryWhenUntouchedOk, true);
  assert.equal(state.proof.unknownFutureNotCleanMutableOk, true);
  assert.equal(state.proof.unknownOldNotSilentlyUpgradedOk, true);
  assert.equal(state.proof.mixedVersionNotAcceptedCleanOk, true);
  assert.equal(state.proof.missingBackupStopsOk, true);
  assert.equal(state.proof.missingRecoveryPackStopsOk, true);
  assert.equal(state.proof.missingRollbackStopsOk, true);
  assert.equal(state.proof.silentDataRewriteRejectedOk, true);
  assert.equal(state.proof.actualMigrationExecutionRejectedOk, true);
});

test('b2c16 migration policy minimal: evidence packets align with executable matrix and negatives remain explicit', async () => {
  const { evaluateB2C16MigrationPolicyMinimalState } = await loadModule();
  const state = await evaluateB2C16MigrationPolicyMinimalState({ repoRoot: REPO_ROOT });
  const proofPacket = readJson(path.join(EVIDENCE_DIR, 'migration-policy-proof.json'));
  const matrixPacket = readJson(path.join(EVIDENCE_DIR, 'version-policy-matrix.json'));
  const donorMapping = readJson(path.join(EVIDENCE_DIR, 'donor-mapping.json'));

  assert.deepEqual(proofPacket.proof, state.proof);
  assert.deepEqual(proofPacket.runtime.positiveCases, state.runtime.positiveCases);
  assert.deepEqual(proofPacket.runtime.negativeCases, state.runtime.negativeCases);
  assert.equal(matrixPacket.currentSchemaVersion, state.runtime.currentSchemaVersion);
  assert.equal(matrixPacket.deterministicInMemoryPolicyOnly, true);
  assert.equal(matrixPacket.versionPolicyMatrixHash, state.proof.versionPolicyMatrixHash);
  assert.deepEqual(matrixPacket.rows, state.runtime.versionPolicyMatrix);

  assert.equal(donorMapping.donor.primaryBasename, 'writer-editor-longform-v5_1-block2-trusted-kernel-pack-v1.zip');
  assert.deepEqual(donorMapping.consultedEntries, [
    'migration-policy.js',
    'migration-policy.test.js',
  ]);
  assert.equal(donorMapping.mappedContour, 'B2C16_MIGRATION_POLICY_MINIMAL');

  assert.equal(state.runtime.positiveCases.length, 5);
  assert.equal(state.runtime.negativeCases.length, 8);
  assert.equal(state.runtime.negativeCases.every((entry) => entry.ok === true), true);
  assert.equal(state.scope.b2c17KillpointClaim, false);
  assert.equal(state.scope.b2c18PerfClaim, false);
  assert.equal(state.scope.block2ExitClaim, false);
  assert.equal(state.scope.uiTouched, false);
  assert.equal(state.scope.dependencyChanged, false);
  assert.equal(state.scope.exportChanged, false);
  assert.equal(state.scope.networkOrCloud, false);
  assert.equal(state.scope.actualDataMigrationClaim, false);
  assert.equal(state.scope.generalImportExportClaim, false);
  assert.equal(state.scope.actualBackupExecutionClaim, false);
  assert.equal(state.scope.rollbackDrillClaim, false);
  assert.equal(state.scope.quarantineRuntimeClaim, false);
  assert.equal(state.scope.schemaChanged, false);
  assert.equal(state.scope.storageFormatChanged, false);
});

test('b2c16 migration policy minimal: command results are fully recorded and contain no pending entries', async () => {
  const commandResults = readJson(path.join(EVIDENCE_DIR, 'command-results.json'));

  assert.equal(commandResults.taskId, 'B2C16_MIGRATION_POLICY_MINIMAL');
  assert.equal(Array.isArray(commandResults.commands), true);
  assert.equal(commandResults.commands.length, 8);
  assert.equal(commandResults.commands.every((entry) => entry.result !== 'PENDING'), true);
  assert.equal(commandResults.commands.every((entry) => typeof entry.summary === 'string'), true);
});
