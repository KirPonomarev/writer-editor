const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'p1-ws02-mode-matrix-completeness-state.mjs');
const FAILSIGNAL_REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json');
const CANON_STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'CANON_STATUS.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function baseInput() {
  return {
    repoRoot: REPO_ROOT,
    failsignalRegistryDoc: readJson(FAILSIGNAL_REGISTRY_PATH),
    canonStatusDoc: readJson(CANON_STATUS_PATH),
    runNegativeFixtures: false,
  };
}

function normalizeComparable(state) {
  return {
    ok: state.ok,
    token: state.P1_WS02_MODE_MATRIX_COMPLETENESS_OK,
    counts: state.counts,
    negativeResults: state.negativeResults,
    positiveResults: state.positiveResults,
    dod: state.dod,
    acceptance: state.acceptance,
  };
}

test('p1 ws02 baseline: all DoD and acceptance pass', async () => {
  const { evaluateP1Ws02ModeMatrixCompletenessState } = await loadModule();
  const state = evaluateP1Ws02ModeMatrixCompletenessState({ repoRoot: REPO_ROOT });

  assert.equal(state.ok, true);
  assert.equal(state.P1_WS02_MODE_MATRIX_COMPLETENESS_OK, 1);
  assert.equal(state.counts.modeCoveragePercent, 100);
  assert.equal(state.counts.modeMismatchCount, 0);
  assert.equal(state.counts.modeGapCount, 0);

  for (const [key, value] of Object.entries(state.negativeResults)) {
    assert.equal(value, true, `negative scenario should pass: ${key}`);
  }
  for (const [key, value] of Object.entries(state.positiveResults)) {
    assert.equal(value, true, `positive scenario should pass: ${key}`);
  }
  for (const [key, value] of Object.entries(state.dod)) {
    assert.equal(value, true, `dod should pass: ${key}`);
  }
  for (const [key, value] of Object.entries(state.acceptance)) {
    assert.equal(value, true, `acceptance should pass: ${key}`);
  }
});

test('p1 ws02 negative 01: missing mode disposition is rejected', async () => {
  const { evaluateP1Ws02ModeMatrixCompletenessState } = await loadModule();
  const input = baseInput();
  const reg = cloneJson(input.failsignalRegistryDoc);
  const row = reg.failSignals.find((entry) => entry && entry.modeMatrix);
  delete row.modeMatrix.promotion;

  const state = evaluateP1Ws02ModeMatrixCompletenessState({
    ...input,
    failsignalRegistryDoc: reg,
  });

  assert.equal(state.ok, false);
  assert.equal(state.failReason, 'MODE_GAP_DETECTED');
  assert.ok(state.counts.modeGapCount > 0);
});

test('p1 ws02 negative 02: registry evaluator mismatch is rejected', async () => {
  const { evaluateP1Ws02ModeMatrixCompletenessState } = await loadModule();
  const input = baseInput();
  const reg = cloneJson(input.failsignalRegistryDoc);
  const row = reg.failSignals.find((entry) => entry && entry.modeMatrix);

  const state = evaluateP1Ws02ModeMatrixCompletenessState({
    ...input,
    failsignalRegistryDoc: reg,
    runNegativeFixtures: false,
    modeDispositionOverrides: {
      [`${row.code}:release`]: row.modeMatrix.release === 'blocking' ? 'advisory' : 'blocking',
    },
  });

  assert.equal(state.ok, false);
  assert.equal(state.failReason, 'REGISTRY_EVALUATOR_MODE_MISMATCH');
  assert.ok(state.counts.modeMismatchCount > 0);
});

test('p1 ws02 negative 03: duplicate mode rule for same failsignal is rejected', async () => {
  const { evaluateP1Ws02ModeMatrixCompletenessState } = await loadModule();
  const input = baseInput();
  const reg = cloneJson(input.failsignalRegistryDoc);
  const clone = cloneJson(reg.failSignals[0]);
  clone.modeMatrix = {
    prCore: clone.modeMatrix.prCore === 'blocking' ? 'advisory' : 'blocking',
    release: clone.modeMatrix.release === 'blocking' ? 'advisory' : 'blocking',
    promotion: clone.modeMatrix.promotion === 'blocking' ? 'advisory' : 'blocking',
  };
  reg.failSignals.push(clone);

  const state = evaluateP1Ws02ModeMatrixCompletenessState({
    ...input,
    failsignalRegistryDoc: reg,
  });

  assert.equal(state.ok, false);
  assert.equal(state.failReason, 'DUPLICATE_MODE_RULE');
  assert.ok(state.counts.duplicateModeRuleCount > 0);
});

test('p1 ws02 negative 04: invalid mode value is rejected', async () => {
  const { evaluateP1Ws02ModeMatrixCompletenessState } = await loadModule();
  const input = baseInput();
  const reg = cloneJson(input.failsignalRegistryDoc);
  const row = reg.failSignals.find((entry) => entry && entry.modeMatrix);
  row.modeMatrix.release = 'warn';

  const state = evaluateP1Ws02ModeMatrixCompletenessState({
    ...input,
    failsignalRegistryDoc: reg,
  });

  assert.equal(state.ok, false);
  assert.equal(state.failReason, 'INVALID_MODE_VALUE');
  assert.ok(state.counts.modeGapCount > 0);
});

test('p1 ws02 negative 05: partial matrix coverage is rejected', async () => {
  const { evaluateP1Ws02ModeMatrixCompletenessState } = await loadModule();
  const input = baseInput();
  const reg = cloneJson(input.failsignalRegistryDoc);
  const row = reg.failSignals.find((entry) => entry && entry.modeMatrix);
  row.modeMatrix = { release: row.modeMatrix.release };

  const state = evaluateP1Ws02ModeMatrixCompletenessState({
    ...input,
    failsignalRegistryDoc: reg,
  });

  assert.equal(state.ok, false);
  assert.equal(state.failReason, 'MODE_GAP_DETECTED');
  assert.ok(state.counts.modeGapCount > 0);
});

test('p1 ws02 repeatability: three runs are stable', async () => {
  const { evaluateP1Ws02ModeMatrixCompletenessState } = await loadModule();

  const runs = [
    evaluateP1Ws02ModeMatrixCompletenessState({ repoRoot: REPO_ROOT }),
    evaluateP1Ws02ModeMatrixCompletenessState({ repoRoot: REPO_ROOT }),
    evaluateP1Ws02ModeMatrixCompletenessState({ repoRoot: REPO_ROOT }),
  ].map((entry) => normalizeComparable(entry));

  assert.deepEqual(runs[0], runs[1]);
  assert.deepEqual(runs[1], runs[2]);
  assert.equal(runs[0].ok, true);
});
