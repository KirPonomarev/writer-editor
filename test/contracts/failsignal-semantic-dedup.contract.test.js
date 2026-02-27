const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'failsignal-semantic-dedup-state.mjs');
const FAILSIGNAL_REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json');

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

test('failsignal semantic dedup: duplicate semantics are reduced and unique map is complete', async () => {
  const { evaluateFailsignalSemanticDedupState } = await loadModule();

  const state = evaluateFailsignalSemanticDedupState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  assert.equal(state.ok, true);
  assert.equal(state.FAILSIGNAL_SEMANTIC_DEDUP_OK, 1);
  assert.equal(state.failsignalSemanticsBeforeAfter.duplicateFailsignalSemanticsReductionCheck, true);
  assert.equal(state.uniqueFailsignalProofCheck, true);
  assert.ok(state.uniqueFailsignalMap.length > 0);
  assert.equal(state.advisoryToBlockingDriftCount, 0);
});

test('failsignal semantic dedup: unique failsignal proof catches semantic collisions', async () => {
  const { evaluateFailsignalSemanticDedupState } = await loadModule();

  const registryDoc = readJson(FAILSIGNAL_REGISTRY_PATH);
  const mutated = cloneJson(registryDoc);
  assert.ok(Array.isArray(mutated.failSignals) && mutated.failSignals.length >= 2, 'requires at least two failsignals');

  mutated.failSignals[1].code = mutated.failSignals[0].code;
  mutated.failSignals[1].modeMatrix = {
    prCore: 'blocking',
    release: 'blocking',
    promotion: 'blocking',
  };

  const state = evaluateFailsignalSemanticDedupState({
    repoRoot: REPO_ROOT,
    failsignalRegistryDoc: mutated,
  });

  assert.equal(state.ok, false);
  assert.equal(state.FAILSIGNAL_SEMANTIC_DEDUP_OK, 0);
  assert.equal(state.uniqueFailsignalProofCheck, false);
  assert.ok(state.uniqueFailsignalProof.semanticCollisions.length > 0);
});

test('failsignal semantic dedup: semantic collision negative fixture remains enforced', async () => {
  const { evaluateFailsignalSemanticDedupState } = await loadModule();

  const state = evaluateFailsignalSemanticDedupState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  assert.equal(state.semanticCollisionNegativeCheck, true);
  assert.ok(Array.isArray(state.semanticCollisionNegative.collisionsDetected));
});

test('failsignal semantic dedup: advisory signals do not escalate to blocking outside canonical evaluator', async () => {
  const { evaluateFailsignalSemanticDedupState } = await loadModule();

  const state = evaluateFailsignalSemanticDedupState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  assert.equal(state.advisoryToBlockingDriftCount, 0);
  assert.equal(state.advisoryToBlockingDriftCountZero, true);
  assert.equal(state.singleBlockingAuthority.ok, true);
});
