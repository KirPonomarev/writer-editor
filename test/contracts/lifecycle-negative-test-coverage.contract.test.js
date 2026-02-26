const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'lifecycle-negative-test-coverage-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'LIFECYCLE_NEGATIVE_TEST_COVERAGE_v3.json');
const PHASE_SWITCH_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'PHASE_SWITCH_V1.json');
const NEGATIVE_CASES_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'P0_CONTOUR', 'TICKET_06', 'merge-flow-negative-cases.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function runNode(args) {
  return spawnSync(process.execPath, [MODULE_PATH, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
}

function ensureNegativeCasesFixture() {
  const statusDoc = JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
  const requiredMergeFlowGates = Array.isArray(statusDoc.requiredMergeFlowGates)
    ? statusDoc.requiredMergeFlowGates.map((value) => String(value || '').trim()).filter(Boolean)
    : [];

  const cases = requiredMergeFlowGates.map((gateId) => ({
    caseId: `${gateId}__negative_path`,
    gateId,
    executable: true,
    expectedFailSignal: gateId,
    modeCoverage: ['release', 'promotion'],
    rationale: 'Executable negative case required for merge-flow blocking gates.',
  }));

  const doc = {
    version: 3,
    generatedBy: 'lifecycle-negative-test-coverage.contract.test.js',
    requiredMergeFlowGateCount: requiredMergeFlowGates.length,
    cases,
  };

  fs.mkdirSync(path.dirname(NEGATIVE_CASES_PATH), { recursive: true });
  fs.writeFileSync(NEGATIVE_CASES_PATH, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
}

function createNegativeCoverageFailureFixture() {
  const doc = JSON.parse(fs.readFileSync(NEGATIVE_CASES_PATH, 'utf8'));
  const gateId = String(doc.cases?.[0]?.gateId || '').trim();
  assert.ok(gateId, 'missing gateId in negative cases');

  const mutated = {
    ...doc,
    cases: doc.cases.map((row) => (row.gateId === gateId ? { ...row, executable: false } : row)),
  };

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contract-lifecycle-negative-'));
  const mutatedPath = path.join(tmpDir, 'merge-flow-negative-cases.mutated.json');
  fs.writeFileSync(mutatedPath, `${JSON.stringify(mutated, null, 2)}\n`, 'utf8');
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

test('lifecycle negative coverage: each blocking merge-flow gate has executable negative case', async () => {
  ensureNegativeCasesFixture();
  const { evaluateLifecycleNegativeTestCoverageState } = await loadModule();

  const state = evaluateLifecycleNegativeTestCoverageState({
    statusPath: STATUS_PATH,
    phaseSwitchPath: PHASE_SWITCH_PATH,
    negativeCasesPath: NEGATIVE_CASES_PATH,
    mode: 'release',
  });

  assert.equal(state.negativeCoverageOk, true);
  assert.equal(state.missingMergeFlowGateCount, 0);
  assert.equal(state.requiredMergeFlowGateCount > 0, true);
  assert.equal(state.ok, true);
});

test('lifecycle negative coverage: negative case fail returns nonzero exit', async () => {
  ensureNegativeCasesFixture();
  const fixture = createNegativeCoverageFailureFixture();

  try {
    const releaseRun = runNode([
      '--mode',
      'release',
      '--status-path',
      STATUS_PATH,
      '--phase-switch-path',
      PHASE_SWITCH_PATH,
      '--negative-cases-path',
      fixture.mutatedPath,
    ]);

    assert.notEqual(releaseRun.status, 0);
  } finally {
    fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
  }
});

test('lifecycle negative coverage: skip flags cannot suppress failure in release or promotion', async () => {
  ensureNegativeCasesFixture();
  const fixture = createNegativeCoverageFailureFixture();

  try {
    const releaseRun = runNode([
      '--json',
      '--mode',
      'release',
      '--skip-negative-checks',
      '--status-path',
      STATUS_PATH,
      '--phase-switch-path',
      PHASE_SWITCH_PATH,
      '--negative-cases-path',
      fixture.mutatedPath,
    ]);

    const promotionRun = runNode([
      '--json',
      '--mode',
      'promotion',
      '--skip-negative-checks',
      '--status-path',
      STATUS_PATH,
      '--phase-switch-path',
      PHASE_SWITCH_PATH,
      '--negative-cases-path',
      fixture.mutatedPath,
    ]);

    assert.notEqual(releaseRun.status, 0);
    assert.notEqual(promotionRun.status, 0);

    const releaseState = JSON.parse(releaseRun.stdout || '{}');
    const promotionState = JSON.parse(promotionRun.stdout || '{}');

    assert.equal(releaseState.skipSuppressionAttempted, true);
    assert.equal(releaseState.skipSuppressionPrevented, true);
    assert.equal(releaseState.failReason, 'E_SKIP_FLAG_BYPASS');

    assert.equal(promotionState.skipSuppressionAttempted, true);
    assert.equal(promotionState.skipSuppressionPrevented, true);
    assert.equal(promotionState.failReason, 'E_SKIP_FLAG_BYPASS');
  } finally {
    fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
  }
});

test('lifecycle negative coverage: phase precedence behavior signal warn hard matches active phase', async () => {
  ensureNegativeCasesFixture();
  const { evaluateLifecycleNegativeTestCoverageState } = await loadModule();
  const fixture = createNegativeCoverageFailureFixture();

  try {
    const phase1 = createPhaseSwitchFixture('PHASE_1_SHADOW');
    const phase2 = createPhaseSwitchFixture('PHASE_2_WARN');
    const phase3 = createPhaseSwitchFixture('PHASE_3_HARD');

    try {
      const state1 = evaluateLifecycleNegativeTestCoverageState({
        statusPath: STATUS_PATH,
        phaseSwitchPath: phase1.mutatedPath,
        negativeCasesPath: fixture.mutatedPath,
        mode: 'release',
      });
      const state2 = evaluateLifecycleNegativeTestCoverageState({
        statusPath: STATUS_PATH,
        phaseSwitchPath: phase2.mutatedPath,
        negativeCasesPath: fixture.mutatedPath,
        mode: 'release',
      });
      const state3 = evaluateLifecycleNegativeTestCoverageState({
        statusPath: STATUS_PATH,
        phaseSwitchPath: phase3.mutatedPath,
        negativeCasesPath: fixture.mutatedPath,
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
    fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
  }
});
