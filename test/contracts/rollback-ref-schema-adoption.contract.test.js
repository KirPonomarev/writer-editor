const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'rollback-ref-schema-adoption-state.mjs');
const REQUIRED_SET_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'REQUIRED_SET_PHASE_3_V1.json');
const PHASE_SWITCH_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'PHASE_SWITCH_V1.json');
const TOKEN_CATALOG_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'TOKENS', 'TOKEN_CATALOG.json');
const FAILSIGNAL_REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function evaluateBaseline(evaluateRollbackRefSchemaAdoptionState) {
  return evaluateRollbackRefSchemaAdoptionState({
    repoRoot: REPO_ROOT,
    requiredSetPath: REQUIRED_SET_PATH,
    phaseSwitchPath: PHASE_SWITCH_PATH,
    tokenCatalogPath: TOKEN_CATALOG_PATH,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });
}

test('rollback ref adoption: each blocking entity has rollback ref owner deadline evidence', async () => {
  const { evaluateRollbackRefSchemaAdoptionState } = await loadModule();
  const state = evaluateBaseline(evaluateRollbackRefSchemaAdoptionState);

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.ROLLBACK_REF_SCHEMA_ADOPTION_OK, 1);
  assert.equal(state.blockingEntitiesHaveRollbackRefCheck, true);
  assert.equal(state.ownerDeadlineEvidenceRequiredCheck, true);
  assert.equal(state.rollbackRefFormatValidCheck, true);
});

test('rollback ref adoption negative: missing rollback ref returns fail in effective phase', async () => {
  const { evaluateRollbackRefSchemaAdoptionState } = await loadModule();
  const state = evaluateBaseline(evaluateRollbackRefSchemaAdoptionState);

  assert.equal(state.missingRollbackRefNegativeCheck, true);
  assert.equal(state.phaseAwareEnforcementSignalWarnHardCheck, true);
  assert.ok(state.missingRollbackRefNegative.phase3.shouldBlock);
  assert.equal(state.missingRollbackRefNegative.reason, '');
});

test('rollback ref adoption negative: invalid rollback ref format returns fail', async () => {
  const { evaluateRollbackRefSchemaAdoptionState } = await loadModule();
  const baseline = evaluateBaseline(evaluateRollbackRefSchemaAdoptionState);

  const mutatedContracts = baseline.blockingEntityContracts.map((row, index) => (
    index === 0 ? { ...row, rollbackRef: '../bad rollback ref' } : { ...row }
  ));

  const invalid = evaluateRollbackRefSchemaAdoptionState({
    repoRoot: REPO_ROOT,
    requiredSetDoc: { effectiveRequiredTokenIds: mutatedContracts.map((row) => row.entityId) },
    phaseSwitchPath: PHASE_SWITCH_PATH,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    blockingEntityContractsOverride: mutatedContracts,
  });

  assert.equal(invalid.ok, false);
  assert.equal(invalid.rollbackRefFormatValidCheck, false);
  assert.equal(invalid.failReason, 'E_ROLLBACK_REF_FORMAT_INVALID');
  assert.ok(invalid.completeness.invalidRollbackRefCount > 0);
});

test('rollback ref adoption: advisory signals cannot escalate to blocking outside canonical evaluator', async () => {
  const { evaluateRollbackRefSchemaAdoptionState } = await loadModule();
  const state = evaluateBaseline(evaluateRollbackRefSchemaAdoptionState);

  assert.equal(state.advisoryToBlockingDriftCount, 0);
  assert.equal(state.advisoryToBlockingDriftCountZero, true);
  assert.equal(state.singleBlockingAuthority.ok, true);
});
