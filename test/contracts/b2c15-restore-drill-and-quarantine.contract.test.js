const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b2c15-restore-drill-and-quarantine-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B2C15_RESTORE_DRILL_AND_QUARANTINE_STATUS_V1.json');
const EVIDENCE_DIR = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'B2C15_RESTORE_DRILL_AND_QUARANTINE', 'TICKET_01');

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

test('b2c15 restore drill and quarantine: deterministic state stays green and committed status matches executable state', async () => {
  const { evaluateB2C15RestoreDrillAndQuarantineState, TOKEN_NAME } = await loadModule();
  const executedState = await evaluateB2C15RestoreDrillAndQuarantineState({ repoRoot: REPO_ROOT });
  const committedState = readJson(STATUS_PATH);

  assert.deepEqual(committedState, executedState);
  assert.equal(executedState.ok, true, JSON.stringify(executedState, null, 2));
  assert.equal(executedState[TOKEN_NAME], 1);
  assert.deepEqual(executedState.failRows, []);
  assert.equal(executedState.proof.deterministicFixtureReplayOnly, true);
  assert.equal(executedState.proof.singleSceneRestoreOk, true);
  assert.equal(executedState.proof.multiSceneRestoreOk, true);
  assert.equal(executedState.proof.textHashEqualityOk, true);
  assert.equal(executedState.proof.sceneOrderEqualityOk, true);
  assert.equal(executedState.proof.blockOrderEqualityOk, true);
  assert.equal(executedState.proof.corruptSceneQuarantinedOk, true);
  assert.equal(executedState.proof.hashMismatchStoppedOk, true);
  assert.equal(executedState.proof.unknownVersionNotCleanOk, true);
  assert.equal(executedState.proof.missingBlockStoppedOk, true);
  assert.equal(executedState.proof.staleSnapshotRejectedOk, true);
  assert.equal(executedState.proof.silentMergeRejectedOk, true);
  assert.equal(executedState.proof.machineWrittenReadableArtifactOk, true);
});

test('b2c15 restore drill and quarantine: evidence, donor mapping, and quarantine artifact fields stay aligned', async () => {
  const { evaluateB2C15RestoreDrillAndQuarantineState } = await loadModule();
  const state = await evaluateB2C15RestoreDrillAndQuarantineState({ repoRoot: REPO_ROOT });

  const restoreProof = readJson(path.join(EVIDENCE_DIR, 'restore-drill-proof.json'));
  const quarantineProof = readJson(path.join(EVIDENCE_DIR, 'quarantine-proof.json'));
  const donorMapping = readJson(path.join(EVIDENCE_DIR, 'donor-mapping.json'));
  const commandResults = readJson(path.join(EVIDENCE_DIR, 'command-results.json'));

  assert.equal(restoreProof.proof.singleSceneRestoreOk, state.proof.singleSceneRestoreOk);
  assert.equal(restoreProof.proof.multiSceneRestoreOk, state.proof.multiSceneRestoreOk);
  assert.equal(restoreProof.proof.textHashEqualityOk, state.proof.textHashEqualityOk);
  assert.equal(restoreProof.proof.sceneOrderEqualityOk, state.proof.sceneOrderEqualityOk);
  assert.equal(restoreProof.proof.blockOrderEqualityOk, state.proof.blockOrderEqualityOk);
  assert.equal(restoreProof.proof.hashMismatchStoppedOk, state.proof.hashMismatchStoppedOk);
  assert.equal(restoreProof.proof.unknownVersionNotCleanOk, state.proof.unknownVersionNotCleanOk);
  assert.equal(restoreProof.proof.missingBlockStoppedOk, state.proof.missingBlockStoppedOk);
  assert.equal(restoreProof.proof.staleSnapshotRejectedOk, state.proof.staleSnapshotRejectedOk);
  assert.equal(restoreProof.proof.silentMergeRejectedOk, state.proof.silentMergeRejectedOk);
  assert.deepEqual(restoreProof.runtime.fixtures, state.runtime.fixtures);
  assert.deepEqual(restoreProof.runtime.positiveCases, state.runtime.positiveCases);
  assert.deepEqual(restoreProof.runtime.negativeCases, state.runtime.negativeCases);

  assert.equal(quarantineProof.proof.corruptSceneQuarantinedOk, state.proof.corruptSceneQuarantinedOk);
  assert.equal(quarantineProof.proof.machineWrittenReadableArtifactOk, state.proof.machineWrittenReadableArtifactOk);
  assert.deepEqual(quarantineProof.artifact, state.runtime.quarantineArtifact);
  assert.deepEqual(quarantineProof.runtime.quarantineCase, state.runtime.quarantineCase);
  assert.deepEqual(quarantineProof.runtime.quarantineArtifactValidation, state.runtime.quarantineArtifactValidation);
  assert.equal(quarantineProof.artifact.artifactType, 'b2c15.quarantine.artifact.v1');
  assert.equal(typeof quarantineProof.artifact.sceneId, 'string');
  assert.equal(typeof quarantineProof.artifact.reason, 'string');
  assert.equal(typeof quarantineProof.artifact.readableSummary, 'string');
  assert.equal(typeof quarantineProof.artifact.originalTextHash, 'string');
  assert.equal(typeof quarantineProof.artifact.quarantineHash, 'string');
  assert.equal(quarantineProof.artifact.uiFlow, false);
  assert.equal(quarantineProof.artifact.supportBundle, false);

  assert.equal(donorMapping.donor.primaryBasename, 'writer-editor-longform-v5_1-block2-trusted-kernel-pack-v1.zip');
  assert.deepEqual(donorMapping.consultedEntries, [
    'recovery-pack.js',
    'recovery-readable-quarantine.test.js',
  ]);
  assert.equal(donorMapping.mappedContour, 'B2C15_RESTORE_DRILL_AND_QUARANTINE');

  assert.equal(commandResults.taskId, 'B2C15_RESTORE_DRILL_AND_QUARANTINE');
  assert.equal(Array.isArray(commandResults.commands), true);
  assert.equal(commandResults.commands.length, 7);
});

test('b2c15 restore drill and quarantine: false claims stay exact and runtime cases remain explicit', async () => {
  const { evaluateB2C15RestoreDrillAndQuarantineState } = await loadModule();
  const state = await evaluateB2C15RestoreDrillAndQuarantineState({ repoRoot: REPO_ROOT });

  assert.equal(state.scope.b2c16MigrationClaim, false);
  assert.equal(state.scope.b2c17KillpointClaim, false);
  assert.equal(state.scope.b2c18PerfClaim, false);
  assert.equal(state.scope.block2ExitClaim, false);
  assert.equal(state.scope.uiTouched, false);
  assert.equal(state.scope.dependencyChanged, false);
  assert.equal(state.scope.exportChanged, false);
  assert.equal(state.scope.networkOrCloud, false);
  assert.equal(state.scope.schemaChanged, false);
  assert.equal(state.scope.storageFormatChanged, false);
  assert.equal(state.scope.generalImportExportClaim, false);

  assert.equal(state.runtime.positiveCases.length, 2);
  assert.equal(state.runtime.negativeCases.length, 5);
  assert.equal(state.runtime.negativeCases.every((entry) => entry.ok === true), true);
  assert.equal(state.runtime.quarantineCase.ok, true);
  assert.equal(state.runtime.quarantineArtifactValidation.ok, true);
});
