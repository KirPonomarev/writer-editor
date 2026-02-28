const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'ops',
  'x23-ws02-release-tag-prep-and-pr-packet-state.mjs',
);

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function evaluateBaseline(evaluateX23Ws02ReleaseTagPrepAndPrPacketState) {
  return evaluateX23Ws02ReleaseTagPrepAndPrPacketState({ repoRoot: REPO_ROOT });
}

test('x23 ws02 baseline: release tag prep and pr packet pass', async () => {
  const { evaluateX23Ws02ReleaseTagPrepAndPrPacketState } = await loadModule();
  const state = evaluateBaseline(evaluateX23Ws02ReleaseTagPrepAndPrPacketState);

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.X23_WS02_RELEASE_TAG_PREP_AND_PR_PACKET_OK, 1);
  assert.equal(state.counts.requiredInputRefCount, 7);
  assert.equal(state.counts.missingRequiredInputCount, 0);
  assert.equal(state.counts.requiredReleaseBlockingTokenCount, 14);
  assert.equal(state.counts.releaseBindingMissingTokenCount, 0);
  assert.equal(state.counts.releaseBindingMissingRecordCount, 0);
  assert.equal(state.counts.releaseBindingMissingFieldCount, 0);
  assert.equal(state.counts.releaseBindingFailSignalMissingCount, 0);
  assert.equal(state.counts.releaseBindingFailSignalMismatchCount, 0);
  assert.equal(state.counts.modeCheckMissingCount, 0);
  assert.equal(state.counts.modeDispositionDriftCount, 0);
  assert.equal(state.counts.modeEvaluatorIssueCount, 0);
  assert.equal(state.counts.attestationIssueCount, 0);
  assert.equal(state.counts.attestationChainBreakCount, 0);
  assert.equal(state.counts.requiredEvidenceRefCount, 5);
  assert.equal(state.counts.missingEvidenceLinkCount, 0);
  assert.equal(state.counts.ws01ExpectedCommitCount, 86);
  assert.equal(state.counts.ws01ObservedCommitCount, 86);
  assert.equal(state.counts.ws01CommitCountMismatchCount, 0);
  assert.equal(state.counts.ws01HeadMismatchCount, 0);
  assert.equal(state.counts.prPacketHeadMismatchCount, 0);
  assert.equal(state.counts.advisoryToBlockingDriftCount, 0);

  for (const [key, value] of Object.entries(state.negativeResults)) {
    assert.equal(value, true, `negative scenario must pass: ${key}`);
  }
  for (const [key, value] of Object.entries(state.positiveResults)) {
    assert.equal(value, true, `positive scenario must pass: ${key}`);
  }

  assert.equal(state.dod.NEXT_TZ_DOD_01, true);
  assert.equal(state.dod.NEXT_TZ_DOD_02, true);
  assert.equal(state.dod.NEXT_TZ_DOD_03, true);
  assert.equal(state.dod.NEXT_TZ_DOD_05, true);
  assert.equal(state.dod.NEXT_TZ_DOD_06, true);
  assert.equal(state.acceptance.NEXT_TZ_ACCEPTANCE_01, true);
  assert.equal(state.acceptance.NEXT_TZ_ACCEPTANCE_02, true);
});

test('x23 ws02 negative 01: missing required input is rejected', async () => {
  const { evaluateX23Ws02ReleaseTagPrepAndPrPacketState } = await loadModule();
  const state = evaluateBaseline(evaluateX23Ws02ReleaseTagPrepAndPrPacketState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_01, true);
});

test('x23 ws02 negative 02: mode disposition drift is rejected', async () => {
  const { evaluateX23Ws02ReleaseTagPrepAndPrPacketState } = await loadModule();
  const state = evaluateBaseline(evaluateX23Ws02ReleaseTagPrepAndPrPacketState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_02, true);
});

test('x23 ws02 negative 03: offline attestation chain break is rejected', async () => {
  const { evaluateX23Ws02ReleaseTagPrepAndPrPacketState } = await loadModule();
  const state = evaluateBaseline(evaluateX23Ws02ReleaseTagPrepAndPrPacketState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_03, true);
});

test('x23 ws02 negative 04: pr packet head mismatch is rejected', async () => {
  const { evaluateX23Ws02ReleaseTagPrepAndPrPacketState } = await loadModule();
  const state = evaluateBaseline(evaluateX23Ws02ReleaseTagPrepAndPrPacketState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_04, true);
});

test('x23 ws02 negative 05: non deterministic release packet hash is rejected', async () => {
  const { evaluateX23Ws02ReleaseTagPrepAndPrPacketState } = await loadModule();
  const state = evaluateBaseline(evaluateX23Ws02ReleaseTagPrepAndPrPacketState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_05, true);
});

test('x23 ws02 repeatability: three runs are stable', async () => {
  const { evaluateX23Ws02ReleaseTagPrepAndPrPacketState } = await loadModule();

  const runs = [
    evaluateBaseline(evaluateX23Ws02ReleaseTagPrepAndPrPacketState),
    evaluateBaseline(evaluateX23Ws02ReleaseTagPrepAndPrPacketState),
    evaluateBaseline(evaluateX23Ws02ReleaseTagPrepAndPrPacketState),
  ].map((state) => ({
    ok: state.ok,
    token: state.X23_WS02_RELEASE_TAG_PREP_AND_PR_PACKET_OK,
    counts: state.counts,
    negativeResults: state.negativeResults,
    positiveResults: state.positiveResults,
    dod: state.dod,
    acceptance: state.acceptance,
    detector: state.detector,
    hashes: {
      releasePacketHash: state.baseline.releasePacketHash,
      prPacketHash: state.baseline.prPacketHash,
    },
  }));

  assert.deepEqual(runs[0], runs[1]);
  assert.deepEqual(runs[1], runs[2]);
  assert.equal(runs[0].ok, true);
});
