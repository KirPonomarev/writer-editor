const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'declared-stage-vs-effective-stage-clarity-state.mjs');
const PLAN_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'XPLAT_ROLLOUT_PLAN_v3_12.json');
const STAGE_METRICS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'XPLAT_STAGE_METRICS_v3_12.json');
const PARITY_BASELINE_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'XPLAT_PARITY_BASELINE_v3_12.json');
const FAILSIGNAL_REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

test('declared vs effective stage clarity: alignment is complete for active scope', async () => {
  const { evaluateDeclaredStageVsEffectiveStageClarityState } = await loadModule();
  const state = evaluateDeclaredStageVsEffectiveStageClarityState({
    repoRoot: REPO_ROOT,
    planPath: PLAN_PATH,
    stageMetricsPath: STAGE_METRICS_PATH,
    parityBaselinePath: PARITY_BASELINE_PATH,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  assert.equal(state.ok, true);
  assert.equal(state.DECLARED_STAGE_EFFECTIVE_STAGE_CLARITY_OK, 1);
  assert.equal(state.declaredStageDefinedCheck.activeStageKnown, true);
  assert.equal(state.effectiveStageMappingCheck.stageMappingComplete, true);
  assert.equal(state.declaredVsEffectiveStageAlignmentCheck.alignmentOk, true);
  assert.equal(state.stageDriftCount, 0);
});

test('declared vs effective stage clarity: removing active stage evidence fails mapping', async () => {
  const { evaluateDeclaredStageVsEffectiveStageClarityState } = await loadModule();

  const planDoc = JSON.parse(fs.readFileSync(PLAN_PATH, 'utf8'));
  const metricsDoc = JSON.parse(fs.readFileSync(STAGE_METRICS_PATH, 'utf8'));
  const parityBaselineDoc = JSON.parse(fs.readFileSync(PARITY_BASELINE_PATH, 'utf8'));

  const activeStageId = String(planDoc.activeStageId || '').trim();
  assert.notEqual(activeStageId.length, 0);

  if (metricsDoc.stageEvidence && Object.prototype.hasOwnProperty.call(metricsDoc.stageEvidence, activeStageId)) {
    delete metricsDoc.stageEvidence[activeStageId];
  }

  const negativeState = evaluateDeclaredStageVsEffectiveStageClarityState({
    repoRoot: REPO_ROOT,
    planDoc,
    stageMetricsDoc: metricsDoc,
    parityBaselineDoc,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  assert.equal(negativeState.effectiveStageMappingCheck.stageMappingComplete, false);
  assert.equal(negativeState.ok, false);
  assert.ok(negativeState.stageDriftCount >= 1);
  assert.ok(
    negativeState.failReason === 'STAGE_MAPPING_INCOMPLETE'
      || negativeState.failReason === 'DECLARED_EFFECTIVE_STAGE_DRIFT',
  );
});

test('declared vs effective stage clarity: advisory drift count remains zero and authority is canonical', async () => {
  const { evaluateDeclaredStageVsEffectiveStageClarityState } = await loadModule();
  const state = evaluateDeclaredStageVsEffectiveStageClarityState({
    repoRoot: REPO_ROOT,
    planPath: PLAN_PATH,
    stageMetricsPath: STAGE_METRICS_PATH,
    parityBaselinePath: PARITY_BASELINE_PATH,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  assert.equal(state.singleBlockingAuthority.ok, true);
  assert.equal(state.advisoryToBlockingDriftCount, 0);
  assert.equal(state.advisoryToBlockingDriftCountZero, true);
});
