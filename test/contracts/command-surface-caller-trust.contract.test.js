const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'command-surface-caller-trust-state.mjs');
const FAILSIGNAL_REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

test('command surface caller trust: mandatory bypass scenarios have executable negative tests', async () => {
  const { evaluateCommandSurfaceCallerTrustPhase2State, MANDATORY_BYPASS_SCENARIOS } = await loadModule();

  const state = evaluateCommandSurfaceCallerTrustPhase2State({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.COMMAND_SURFACE_CALLER_TRUST_PHASE_2_OK, 1);
  assert.equal(state.mandatoryBypassScenariosCheck, true);
  assert.equal(state.mandatoryBypassScenarios.requiredScenarioCount, MANDATORY_BYPASS_SCENARIOS.length);
  assert.equal(state.mandatoryBypassScenarios.passingScenarioCount, MANDATORY_BYPASS_SCENARIOS.length);
});

test('command surface caller trust: caller identity and payload contract are required', async () => {
  const { evaluateCommandEntryAttempt } = await loadModule();

  const missingCaller = evaluateCommandEntryAttempt({
    route: 'command.bus',
    callerIdentity: { callerId: '', identityProof: '', channel: '' },
    payload: {
      commandId: 'cmd.project.open',
      requestId: 'req-missing-caller',
      payloadSchemaVersion: 'v1',
      args: {},
    },
    markerPresent: true,
    runtimeAssertion: true,
    fastPathCacheEnabled: true,
  });

  assert.equal(missingCaller.ok, false);
  assert.equal(missingCaller.stopCode, 'E_CALLER_IDENTITY_VALIDATION_MISSING');

  const missingPayload = evaluateCommandEntryAttempt({
    route: 'command.bus',
    callerIdentity: { callerId: 'menu', identityProof: 'proof:menu:v1', channel: 'channel:menu' },
    payload: {
      commandId: 'cmd.project.open',
      requestId: '',
      payloadSchemaVersion: 'v1',
      args: {},
    },
    markerPresent: true,
    runtimeAssertion: true,
    fastPathCacheEnabled: true,
  });

  assert.equal(missingPayload.ok, false);
  assert.equal(missingPayload.stopCode, 'E_PAYLOAD_CONTRACT_VALIDATION_MISSING');
});

test('command surface caller trust: alias and dynamic path bypass attempts return fail', async () => {
  const { evaluateCommandEntryAttempt } = await loadModule();

  const dynamicAlias = evaluateCommandEntryAttempt({
    route: 'command.bus',
    callerIdentity: { callerId: 'menu', identityProof: 'proof:menu:v1', channel: 'channel:menu' },
    payload: {
      commandId: 'dynamic:cmd.project.open',
      requestId: 'req-dynamic',
      payloadSchemaVersion: 'v1',
      args: {},
    },
    markerPresent: true,
    runtimeAssertion: true,
    fastPathCacheEnabled: true,
  });

  assert.equal(dynamicAlias.ok, false);
  assert.equal(dynamicAlias.stopCode, 'E_ALIAS_INDIRECTION_BYPASS');

  const unknownAlias = evaluateCommandEntryAttempt({
    route: 'command.bus',
    callerIdentity: { callerId: 'menu', identityProof: 'proof:menu:v1', channel: 'channel:menu' },
    payload: {
      commandId: 'launchByAlias',
      requestId: 'req-alias',
      payloadSchemaVersion: 'v1',
      args: {},
    },
    markerPresent: true,
    runtimeAssertion: true,
    fastPathCacheEnabled: true,
  });

  assert.equal(unknownAlias.ok, false);
  assert.equal(unknownAlias.stopCode, 'E_ALIAS_INDIRECTION_BYPASS');
});

test('command surface caller trust: fast path cache has safety guard and no interactive regression', async () => {
  const { evaluateFastPathCacheSafety } = await loadModule();

  const proof = evaluateFastPathCacheSafety();

  assert.equal(proof.ok, true, JSON.stringify(proof, null, 2));
  assert.equal(proof.first.ok, true);
  assert.equal(proof.first.cacheHit, false);
  assert.equal(proof.second.ok, true);
  assert.equal(proof.second.cacheHit, true);
  assert.equal(proof.interactiveReplay.ok, false);
  assert.equal(proof.interactiveReplay.stopCode, 'E_FAST_PATH_CACHE_SAFETY_VIOLATION');
  assert.equal(proof.schemaVersionChanged.ok, true);
  assert.equal(proof.schemaVersionChanged.cacheHit, false);
});

test('command surface caller trust: advisory signals cannot escalate to blocking outside canonical evaluator', async () => {
  const { evaluateCommandSurfaceCallerTrustPhase2State } = await loadModule();

  const state = evaluateCommandSurfaceCallerTrustPhase2State({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  assert.equal(state.advisoryToBlockingDriftCount, 0);
  assert.equal(state.advisoryToBlockingDriftCountZero, true);
  assert.equal(state.singleBlockingAuthority.ok, true);
});
