const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'e2e-critical-user-path-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'E2E_CRITICAL_USER_PATH_HARD_MIN_v3.json');
const PHASE_SWITCH_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'PHASE_SWITCH_V1.json');
const SCENARIOS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'P0_CONTOUR', 'TICKET_03', 'e2e-critical-user-path-scenarios.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function evaluateWithDefaults(evaluateE2ECriticalUserPathState, overrides = {}) {
  return evaluateE2ECriticalUserPathState({
    statusPath: STATUS_PATH,
    phaseSwitchPath: PHASE_SWITCH_PATH,
    scenariosPath: overrides.scenariosPath || SCENARIOS_PATH,
    mode: overrides.mode || 'release',
  });
}

function runNode(args) {
  return spawnSync(process.execPath, [MODULE_PATH, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
}

test('e2e critical user path: required scenario set returns pass equals one', async () => {
  const { evaluateE2ECriticalUserPathState } = await loadModule();
  const state = evaluateWithDefaults(evaluateE2ECriticalUserPathState);

  assert.equal(state.criticalUserPathPass, true);
  assert.equal(state.E2E_CRITICAL_USER_PATH_OK, 1);
  assert.equal(state.requiredScenarioCount > 0, true);
  assert.equal(state.missingRequiredScenarioCount, 0);
  assert.equal(state.failingRequiredScenarioCount, 0);
});

test('e2e critical user path: remove one required step returns fail', async () => {
  const { evaluateE2ECriticalUserPathState } = await loadModule();
  const scenariosDoc = JSON.parse(fs.readFileSync(SCENARIOS_PATH, 'utf8'));
  const required = scenariosDoc.scenarios.filter((row) => row && row.required === true);
  assert.ok(required.length > 0, 'required scenario set must not be empty');

  const removedScenarioId = required[0].id;
  scenariosDoc.scenarios = scenariosDoc.scenarios.filter((row) => row.id !== removedScenarioId);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-critical-path-negative-'));
  const mutatedScenariosPath = path.join(tmpDir, 'e2e-critical-user-path-scenarios.mutated.json');
  fs.writeFileSync(mutatedScenariosPath, `${JSON.stringify(scenariosDoc, null, 2)}\n`, 'utf8');

  try {
    const state = evaluateWithDefaults(evaluateE2ECriticalUserPathState, {
      scenariosPath: mutatedScenariosPath,
      mode: 'release',
    });

    assert.equal(state.criticalUserPathPass, false);
    assert.equal(state.E2E_CRITICAL_USER_PATH_OK, 0);
    assert.ok(state.missingRequiredScenarioIds.includes(removedScenarioId));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('e2e critical user path: release mode blocks and exits nonzero when missing critical step', async () => {
  const scenariosDoc = JSON.parse(fs.readFileSync(SCENARIOS_PATH, 'utf8'));
  const required = scenariosDoc.scenarios.filter((row) => row && row.required === true);
  assert.ok(required.length > 0, 'required scenario set must not be empty');

  const removedScenarioId = required[0].id;
  scenariosDoc.scenarios = scenariosDoc.scenarios.filter((row) => row.id !== removedScenarioId);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-critical-path-exit-'));
  const mutatedScenariosPath = path.join(tmpDir, 'e2e-critical-user-path-scenarios.mutated.json');
  fs.writeFileSync(mutatedScenariosPath, `${JSON.stringify(scenariosDoc, null, 2)}\n`, 'utf8');

  try {
    const result = runNode([
      '--status-path', STATUS_PATH,
      '--phase-switch-path', PHASE_SWITCH_PATH,
      '--scenarios-path', mutatedScenariosPath,
      '--mode', 'release',
    ]);

    assert.notEqual(result.status, 0, `must return nonzero on missing critical path\n${result.stdout}\n${result.stderr}`);

    const { evaluateE2ECriticalUserPathState } = await loadModule();
    const state = evaluateWithDefaults(evaluateE2ECriticalUserPathState, {
      scenariosPath: mutatedScenariosPath,
      mode: 'release',
    });
    assert.equal(state.deliveryVerdict, 'BLOCK');
    assert.equal(state.missingRequiredScenarioIds.includes(removedScenarioId), true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
