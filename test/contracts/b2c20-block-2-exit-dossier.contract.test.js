const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b2c20-block-2-exit-dossier-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B2C20_BLOCK_2_EXIT_DOSSIER_STATUS_V1.json');
const EVIDENCE_DIR = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'B2C20_BLOCK_2_EXIT_DOSSIER', 'TICKET_01');

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

test('b2c20 block 2 exit dossier: committed status equals executable state and stays bounded', async () => {
  const { evaluateB2C20Block2ExitDossierState, TOKEN_NAME } = await loadModule();
  const state = await evaluateB2C20Block2ExitDossierState({ repoRoot: REPO_ROOT });
  const committedState = readJson(STATUS_PATH);

  assert.deepEqual(committedState, state);
  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state[TOKEN_NAME], 1);
  assert.deepEqual(state.failRows, []);
  assert.equal(state.proof.b2c19PrimaryInputBound, true);
  assert.equal(state.proof.b2c19Ok, true);
  assert.equal(state.proof.b2c19BlockingFindingsZero, true);
  assert.equal(state.proof.b2c19CommandResultsAllPassed, true);
  assert.equal(state.proof.requiredStatusPacketsPresent, true);
  assert.equal(state.proof.noFullReaudit, true);
  assert.equal(state.proof.noOldContourFixing, true);
});

test('b2c20 block 2 exit dossier: evidence packets align with executable decision', async () => {
  const { evaluateB2C20Block2ExitDossierState } = await loadModule();
  const state = await evaluateB2C20Block2ExitDossierState({ repoRoot: REPO_ROOT });
  const commandResults = readJson(path.join(EVIDENCE_DIR, 'command-results.json'));
  const exitDossier = readJson(path.join(EVIDENCE_DIR, 'exit-dossier-table.json'));
  const greenOrStop = readJson(path.join(EVIDENCE_DIR, 'green-or-stop-decision.json'));
  const advisory = readJson(path.join(EVIDENCE_DIR, 'advisory-gaps-summary.json'));
  const blocking = readJson(path.join(EVIDENCE_DIR, 'blocking-gaps-summary.json'));

  assert.deepEqual(commandResults, state.runtime.commandResults);
  assert.deepEqual(exitDossier.rows, state.runtime.exitDossierTable);
  assert.equal(exitDossier.rowCount, state.runtime.exitDossierTable.length);
  assert.deepEqual(greenOrStop, state.runtime.greenOrStopDecision);
  assert.deepEqual(advisory, state.runtime.advisoryGapsSummary);
  assert.deepEqual(blocking, state.runtime.blockingGapsSummary);
  assert.equal(greenOrStop.decision, 'GREEN');
  assert.equal(greenOrStop.block2Closed, true);
  assert.equal(greenOrStop.greenMeans, 'BLOCK_2_EXIT_RULE_SATISFIED_ONLY');
  assert.equal(greenOrStop.releaseReadyClaim, false);
  assert.equal(greenOrStop.block3StartClaim, false);
});

test('b2c20 block 2 exit dossier: false claims and command results stay explicit', async () => {
  const { evaluateB2C20Block2ExitDossierState } = await loadModule();
  const state = await evaluateB2C20Block2ExitDossierState({ repoRoot: REPO_ROOT });

  assert.equal(state.runtime.commandResults.taskId, 'B2C20_BLOCK_2_EXIT_DOSSIER');
  assert.equal(state.runtime.commandResults.status, 'EXECUTED_AND_RECORDED');
  assert.equal(state.runtime.commandResults.allPassed, true);
  assert.equal(state.runtime.commandResults.noPending, true);
  assert.equal(state.runtime.commandResults.commands.length, 10);
  assert.equal(state.runtime.commandResults.commands.every((entry) => entry.result === 'PASS'), true);
  assert.equal(state.proof.blockingGapCount, 0);
  assert.equal(state.proof.advisoryGapCount, 12);
  assert.equal(state.proof.nonblockingGapCount, 8);
  assert.equal(state.scope.productRuntimeChanged, false);
  assert.equal(state.scope.uiTouched, false);
  assert.equal(state.scope.dependencyChanged, false);
  assert.equal(state.scope.schemaChanged, false);
  assert.equal(state.scope.storageFormatChanged, false);
  assert.equal(state.scope.exportChanged, false);
  assert.equal(state.scope.block3StartClaim, false);
  assert.equal(state.scope.releaseReadyClaim, false);
  assert.equal(state.scope.factualDocCutoverClaim, false);
});
