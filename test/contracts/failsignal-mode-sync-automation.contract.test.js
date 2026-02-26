const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'failsignal-mode-sync-automation-state.mjs');
const FAILSIGNAL_REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json');
const TOKEN_CATALOG_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'TOKENS', 'TOKEN_CATALOG.json');

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

test('failsignal mode sync: each high-impact failsignal has explicit mode disposition', async () => {
  const { evaluateFailsignalModeSyncAutomationState } = await loadModule();

  const state = evaluateFailsignalModeSyncAutomationState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    tokenCatalogPath: TOKEN_CATALOG_PATH,
  });

  assert.equal(state.ok, true);
  assert.equal(state.FAILSIGNAL_MODE_SYNC_AUTOMATION_OK, 1);
  assert.ok(state.highImpactFailSignalCount > 0);
  assert.equal(state.highImpactExplicitDispositionCheck, true);
  assert.equal(state.highImpactMissingDisposition.length, 0);
});

test('failsignal mode sync negative: blocking flag and mode disposition conflict returns fail when sync is disabled', async () => {
  const { evaluateFailsignalModeSyncAutomationState } = await loadModule();

  const registryDoc = readJson(FAILSIGNAL_REGISTRY_PATH);
  const failSignals = Array.isArray(registryDoc.failSignals) ? registryDoc.failSignals : [];
  const target = failSignals.find((row) => row && typeof row === 'object' && row.code);
  assert.ok(target, 'failsignal target must exist');

  const mutatedRegistry = cloneJson(registryDoc);

  const state = evaluateFailsignalModeSyncAutomationState({
    repoRoot: REPO_ROOT,
    failsignalRegistryDoc: mutatedRegistry,
    tokenCatalogPath: TOKEN_CATALOG_PATH,
    syncAutomationEnabled: false,
  });

  assert.equal(state.ok, false);
  assert.equal(state.FAILSIGNAL_MODE_SYNC_AUTOMATION_OK, 0);
  assert.equal(state.highImpactExplicitDispositionCheck, false);
  assert.equal(state.modeSyncAutomationAppliedCheck, false);
  assert.equal(state.failReason, 'E_FAILSIGNAL_MODE_MAPPING_INCOMPLETE');
});

test('failsignal mode sync: outdated mode mapping is auto-synced to canonical shape', async () => {
  const { evaluateFailsignalModeSyncAutomationState } = await loadModule();

  const registryDoc = readJson(FAILSIGNAL_REGISTRY_PATH);
  const mutatedRegistry = cloneJson(registryDoc);
  const target = mutatedRegistry.failSignals.find((row) => row && typeof row === 'object' && row.code);
  assert.ok(target, 'failsignal target must exist');

  target.modeMatrix = {};

  const state = evaluateFailsignalModeSyncAutomationState({
    repoRoot: REPO_ROOT,
    failsignalRegistryDoc: mutatedRegistry,
    tokenCatalogPath: TOKEN_CATALOG_PATH,
  });

  assert.equal(state.modeSyncAutomationAppliedCheck, true);
  assert.ok(state.syncAppliedCount > 0);
  assert.ok(state.failsignalModeSyncMap.some((row) => row.failSignalCode === target.code && row.syncApplied));
});

test('failsignal mode sync: advisory signals cannot escalate to blocking outside canonical evaluator', async () => {
  const { evaluateFailsignalModeSyncAutomationState } = await loadModule();

  const state = evaluateFailsignalModeSyncAutomationState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    tokenCatalogPath: TOKEN_CATALOG_PATH,
  });

  assert.equal(state.advisoryToBlockingDriftCount, 0);
  assert.equal(state.advisoryToBlockingDriftCountZero, true);
  assert.equal(state.singleBlockingAuthority.ok, true);
});
