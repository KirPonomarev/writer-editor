const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b2c14-recovery-readable-proof-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B2C14_RECOVERY_READABLE_PROOF_STATUS_V1.json');
const EVIDENCE_DIR = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'B2C14_RECOVERY_READABLE_PROOF', 'TICKET_01');

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

test('b2c14 recovery readable proof: deterministic readable packet stays green and writes committed artifacts', async () => {
  const { evaluateB2C14RecoveryReadableProofState } = await loadModule();
  const executedState = await evaluateB2C14RecoveryReadableProofState({ repoRoot: REPO_ROOT });
  const committedState = readJson(STATUS_PATH);

  assert.deepEqual(committedState, executedState);
  assert.equal(executedState.ok, true, JSON.stringify(executedState, null, 2));
  assert.equal(executedState.B2C14_RECOVERY_READABLE_PROOF_OK, 1);
  assert.deepEqual(executedState.failRows, []);
  assert.equal(executedState.proof.positiveReadablePackOk, true);
  assert.equal(executedState.proof.readableSectionsPresent, true);
  assert.equal(executedState.proof.negativeUnreadablePackRejectOk, true);
  assert.equal(executedState.proof.negativeMissingSceneListRejectOk, true);
  assert.equal(executedState.proof.negativeMissingTextSnapshotRejectOk, true);
  assert.equal(executedState.proof.negativeMissingHashSectionRejectOk, true);
  assert.equal(executedState.proof.negativeStaleHashTimestampBindingRejectOk, true);
  assert.equal(executedState.proof.negativeContentBoundaryViolationRejectOk, true);

  const evidence = readJson(path.join(EVIDENCE_DIR, 'recovery-readable-proof.json'));
  const rubric = readJson(path.join(EVIDENCE_DIR, 'readability-rubric.json'));
  const donorMapping = readJson(path.join(EVIDENCE_DIR, 'donor-mapping.json'));
  const commandResults = readJson(path.join(EVIDENCE_DIR, 'command-results.json'));

  assert.deepEqual(evidence.proof, executedState.proof);
  assert.deepEqual(rubric.requiredSections.sort(), Object.keys(executedState.proof.sections).sort());
  assert.equal(donorMapping.donor.primaryBasename, 'writer-editor-longform-v5_1-block2-trusted-kernel-pack-v1.zip');
  assert.equal(commandResults.taskId, 'B2C14_RECOVERY_READABLE_PROOF');
  assert.equal(Array.isArray(commandResults.commands), true);
  assert.equal(commandResults.commands.length, 6);
  assert.equal(commandResults.commands.every((entry) => typeof entry.command === 'string'), true);
});

test('b2c14 recovery readable proof: required readable sections and false claims stay exact', async () => {
  const { evaluateB2C14RecoveryReadableProofState } = await loadModule();
  const state = await evaluateB2C14RecoveryReadableProofState({ repoRoot: REPO_ROOT });
  const sections = state.proof.sections;

  assert.equal(typeof sections.projectSummary.projectId, 'string');
  assert.equal(Array.isArray(sections.sceneList), true);
  assert.equal(Array.isArray(sections.sceneTextSnapshot), true);
  assert.equal(Array.isArray(sections.blockOrder), true);
  assert.equal(typeof sections.errorSummary.reasonCode, 'string');
  assert.equal(typeof sections.reason, 'string');
  assert.equal(Array.isArray(sections.humanReadableRestoreGuidanceText), true);
  assert.equal(typeof sections.hashSection.manifestHash, 'string');
  assert.equal(typeof sections.timestampSection.generatedAtIso, 'string');
  assert.equal(typeof sections.machineReplayCompanionReference.fileBasename, 'string');
  assert.equal(sections.readableContentBoundary.copyRule, 'COPY_ONLY_TEXT_BELOW_DELIMITER');

  assert.equal(state.scope.restoreDrillClaim, false);
  assert.equal(state.scope.restoredProjectEqualityClaim, false);
  assert.equal(state.scope.quarantineCloseClaim, false);
  assert.equal(state.scope.b2c15Claim, false);
  assert.equal(state.scope.block2ExitClaim, false);
  assert.equal(state.scope.uiTouched, false);
  assert.equal(state.scope.dependencyChanged, false);
  assert.equal(state.scope.networkOrCloud, false);
});

test('b2c14 recovery readable proof: packet validator rejects required negative cases with exact codes', async () => {
  const {
    validateReadableRecoveryProofPacket,
    evaluateB2C14RecoveryReadableProofState,
  } = await loadModule();
  const state = await evaluateB2C14RecoveryReadableProofState({ repoRoot: REPO_ROOT });
  const packet = {
    packetId: 'copy',
    schemaVersion: 1,
    sections: JSON.parse(JSON.stringify(state.proof.sections)),
    scopeClaims: JSON.parse(JSON.stringify(state.proof.scopeClaims)),
  };

  delete packet.sections.sceneList;
  assert.equal(validateReadableRecoveryProofPacket(packet).code, 'E_B2C14_SCENE_LIST_MISSING');

  packet.sections.sceneList = JSON.parse(JSON.stringify(state.proof.sections.sceneList));
  packet.sections.sceneTextSnapshot = [];
  assert.equal(validateReadableRecoveryProofPacket(packet).code, 'E_B2C14_TEXT_SNAPSHOT_MISSING');

  packet.sections.sceneTextSnapshot = JSON.parse(JSON.stringify(state.proof.sections.sceneTextSnapshot));
  delete packet.sections.hashSection;
  assert.equal(validateReadableRecoveryProofPacket(packet).code, 'E_B2C14_HASH_SECTION_MISSING');

  packet.sections.hashSection = JSON.parse(JSON.stringify(state.proof.sections.hashSection));
  packet.sections.timestampSection.bindingHash = 'stale';
  assert.equal(validateReadableRecoveryProofPacket(packet).code, 'E_B2C14_TIMESTAMP_BINDING_STALE');

  packet.sections.timestampSection = JSON.parse(JSON.stringify(state.proof.sections.timestampSection));
  packet.sections.sceneTextSnapshot[0].rawSnapshot = packet.sections.sceneTextSnapshot[0].rawSnapshot.replace(
    '--- RECOVERY CONTENT START ---',
    '--- RECOVERY CONTENT START ---\n--- RECOVERY CONTENT START ---',
  );
  assert.equal(validateReadableRecoveryProofPacket(packet).code, 'E_B2C14_CONTENT_BOUNDARY_VIOLATION');
});
