const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'gate-graph-check-v1-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'CIRCULAR_DEPENDENCY_BREAK_v3.json');
const PHASE_SWITCH_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'PHASE_SWITCH_V1.json');
const DECLARATION_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'GATE_DEPENDENCY_DECLARATION_V1.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function evaluateWithDefaults(evaluateGateGraphCheckV1State, overrides = {}) {
  return evaluateGateGraphCheckV1State({
    statusPath: STATUS_PATH,
    phaseSwitchPath: overrides.phaseSwitchPath || PHASE_SWITCH_PATH,
    declarationPath: overrides.declarationPath || DECLARATION_PATH,
    mode: overrides.mode || 'release',
    skipCycleCheck: Boolean(overrides.skipCycleCheck),
  });
}

function createCyclicDeclarationFixture() {
  const doc = JSON.parse(fs.readFileSync(DECLARATION_PATH, 'utf8'));
  const rowA = doc.checks.find((row) => row && row.machineCheckId === 'p0_05_cycle_detection_scc_check');
  const rowB = doc.checks.find((row) => row && row.machineCheckId === 'p0_05_cycle_component_size_threshold_check');
  assert.ok(rowA, 'missing p0_05_cycle_detection_scc_check in declaration');
  assert.ok(rowB, 'missing p0_05_cycle_component_size_threshold_check in declaration');

  rowA.dependsOn = ['p0_05_cycle_component_size_threshold_check'];
  rowB.dependsOn = ['p0_05_cycle_detection_scc_check'];

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contract-cycle-declaration-'));
  const mutatedPath = path.join(tmpDir, 'GATE_DEPENDENCY_DECLARATION_V1.mutated.json');
  fs.writeFileSync(mutatedPath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  return { tmpDir, mutatedPath };
}

function createPhaseSwitchFixture(activePhase) {
  const doc = JSON.parse(fs.readFileSync(PHASE_SWITCH_PATH, 'utf8'));
  doc.activePhase = activePhase;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `contract-phase-switch-${activePhase}-`));
  const mutatedPath = path.join(tmpDir, 'PHASE_SWITCH_V1.mutated.json');
  fs.writeFileSync(mutatedPath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  return { tmpDir, mutatedPath };
}

test('circular dependency break: SCC size greater than one returns CIRCULAR_GATE_DEPENDENCY', async () => {
  const { evaluateGateGraphCheckV1State } = await loadModule();
  const fixture = createCyclicDeclarationFixture();

  try {
    const state = evaluateWithDefaults(evaluateGateGraphCheckV1State, {
      declarationPath: fixture.mutatedPath,
      mode: 'release',
    });

    assert.equal(state.declarationValid, true);
    assert.equal(state.cycleDetected, true);
    assert.ok(state.maxCycleComponentSize > 1);
    assert.equal(state.stopCode, 'CIRCULAR_GATE_DEPENDENCY');
  } finally {
    fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
  }
});

test('circular dependency break: acyclic declaration returns pass', async () => {
  const { evaluateGateGraphCheckV1State } = await loadModule();
  const state = evaluateWithDefaults(evaluateGateGraphCheckV1State, {
    mode: 'release',
  });

  assert.equal(state.declarationValid, true);
  assert.equal(state.cycleDetected, false);
  assert.equal(state.productVerdict, 'PASS');
  assert.equal(state.CIRCULAR_DEPENDENCY_BREAK_OK, 1);
});

test('circular dependency break: skip flag cannot suppress cycle failure in release and promotion', async () => {
  const { evaluateGateGraphCheckV1State } = await loadModule();
  const fixture = createCyclicDeclarationFixture();

  try {
    const releaseState = evaluateWithDefaults(evaluateGateGraphCheckV1State, {
      declarationPath: fixture.mutatedPath,
      mode: 'release',
      skipCycleCheck: true,
    });
    const promotionState = evaluateWithDefaults(evaluateGateGraphCheckV1State, {
      declarationPath: fixture.mutatedPath,
      mode: 'promotion',
      skipCycleCheck: true,
    });

    assert.equal(releaseState.skipSuppressionAttempted, true);
    assert.equal(releaseState.skipSuppressionPrevented, true);
    assert.notEqual(releaseState.deliveryVerdict, 'PASS');

    assert.equal(promotionState.skipSuppressionAttempted, true);
    assert.equal(promotionState.skipSuppressionPrevented, true);
    assert.notEqual(promotionState.deliveryVerdict, 'PASS');
  } finally {
    fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
  }
});

test('circular dependency break: phase behavior signal warn hard matches phase switch', async () => {
  const { evaluateGateGraphCheckV1State } = await loadModule();
  const cycleFixture = createCyclicDeclarationFixture();

  try {
    const phase1 = createPhaseSwitchFixture('PHASE_1_SHADOW');
    const phase2 = createPhaseSwitchFixture('PHASE_2_WARN');
    const phase3 = createPhaseSwitchFixture('PHASE_3_HARD');

    try {
      const state1 = evaluateWithDefaults(evaluateGateGraphCheckV1State, {
        declarationPath: cycleFixture.mutatedPath,
        phaseSwitchPath: phase1.mutatedPath,
        mode: 'release',
      });
      const state2 = evaluateWithDefaults(evaluateGateGraphCheckV1State, {
        declarationPath: cycleFixture.mutatedPath,
        phaseSwitchPath: phase2.mutatedPath,
        mode: 'release',
      });
      const state3 = evaluateWithDefaults(evaluateGateGraphCheckV1State, {
        declarationPath: cycleFixture.mutatedPath,
        phaseSwitchPath: phase3.mutatedPath,
        mode: 'release',
      });

      assert.equal(state1.deliveryVerdict, 'WARN');
      assert.equal(state2.deliveryVerdict, 'WARN');
      assert.equal(state3.deliveryVerdict, 'BLOCK');
      assert.equal(state1.productVerdict, 'FAIL');
      assert.equal(state2.productVerdict, 'FAIL');
      assert.equal(state3.productVerdict, 'FAIL');
    } finally {
      fs.rmSync(phase1.tmpDir, { recursive: true, force: true });
      fs.rmSync(phase2.tmpDir, { recursive: true, force: true });
      fs.rmSync(phase3.tmpDir, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(cycleFixture.tmpDir, { recursive: true, force: true });
  }
});
