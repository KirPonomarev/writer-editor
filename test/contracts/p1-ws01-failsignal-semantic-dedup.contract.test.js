const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'p1-ws01-failsignal-semantic-dedup-state.mjs');
const FAILSIGNAL_REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json');
const TOKEN_CATALOG_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'TOKENS', 'TOKEN_CATALOG.json');
const CLAIM_MATRIX_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'CLAIMS', 'CRITICAL_CLAIM_MATRIX.json');
const MIGRATION_MAP_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'FAILSIGNAL_SEMANTIC_MIGRATION_MAP_v1.json');
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
    tokenCatalogDoc: readJson(TOKEN_CATALOG_PATH),
    claimMatrixDoc: readJson(CLAIM_MATRIX_PATH),
    migrationMapDoc: readJson(MIGRATION_MAP_PATH),
    canonStatusDoc: readJson(CANON_STATUS_PATH),
    runNegativeFixtures: false,
  };
}

function normalizeComparable(state) {
  return {
    ok: state.ok,
    token: state.P1_WS01_FAILSIGNAL_SEMANTIC_DEDUP_OK,
    counts: state.counts,
    negativeResults: state.negativeResults,
    positiveResults: state.positiveResults,
    dod: state.dod,
    acceptance: state.acceptance,
  };
}

test('p1 ws01 baseline: all DoD and acceptance pass', async () => {
  const { evaluateP1Ws01FailsignalSemanticDedupState } = await loadModule();
  const state = evaluateP1Ws01FailsignalSemanticDedupState({ repoRoot: REPO_ROOT });

  assert.equal(state.ok, true);
  assert.equal(state.P1_WS01_FAILSIGNAL_SEMANTIC_DEDUP_OK, 1);
  assert.equal(state.counts.semanticCollisionCount, 0);
  assert.equal(state.counts.tokenFailsignalAmbiguityCount, 0);
  assert.equal(state.counts.claimModeConflictCount, 0);
  assert.equal(state.counts.registryDeclarationMismatchCount, 0);

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

test('p1 ws01 negative 01: duplicate failsignal meaning is rejected', async () => {
  const { evaluateP1Ws01FailsignalSemanticDedupState } = await loadModule();
  const input = baseInput();
  const mutated = cloneJson(input.failsignalRegistryDoc);
  const rows = mutated.failSignals;

  rows.push({
    ...cloneJson(rows[0]),
    tier: rows[0].tier === 'release' ? 'core' : 'release',
  });

  const state = evaluateP1Ws01FailsignalSemanticDedupState({
    ...input,
    failsignalRegistryDoc: mutated,
  });

  assert.equal(state.ok, false);
  assert.equal(state.failReason, 'DUPLICATE_FAILSIGNAL_MEANING_DETECTED');
  assert.ok(state.counts.semanticCollisionCount > 0);
});

test('p1 ws01 negative 02: token pointing to ambiguous failsignal is rejected', async () => {
  const { evaluateP1Ws01FailsignalSemanticDedupState } = await loadModule();
  const input = baseInput();
  const reg = cloneJson(input.failsignalRegistryDoc);
  const tok = cloneJson(input.tokenCatalogDoc);
  const token = tok.tokens.find((row) => row && row.failSignalCode);
  const signal = token.failSignalCode;
  const declaration = reg.failSignals.find((row) => row && row.code === signal);
  reg.failSignals.push(cloneJson(declaration));

  const state = evaluateP1Ws01FailsignalSemanticDedupState({
    ...input,
    failsignalRegistryDoc: reg,
    tokenCatalogDoc: tok,
  });

  assert.equal(state.ok, false);
  assert.equal(state.failReason, 'TOKEN_FAILSIGNAL_AMBIGUITY_DETECTED');
  assert.ok(state.counts.tokenFailsignalAmbiguityCount > 0);
});

test('p1 ws01 negative 03: claim mode conflict without migration override is rejected', async () => {
  const { evaluateP1Ws01FailsignalSemanticDedupState } = await loadModule();
  const input = baseInput();
  const claims = cloneJson(input.claimMatrixDoc);
  const migration = cloneJson(input.migrationMapDoc);

  const claim = claims.claims.find((row) => row && row.claimId === 'PROOFHOOK_INTEGRITY');
  assert.ok(claim);
  migration.claimModeOverrides = migration.claimModeOverrides.filter((row) => row.claimId !== 'PROOFHOOK_INTEGRITY');

  const state = evaluateP1Ws01FailsignalSemanticDedupState({
    ...input,
    claimMatrixDoc: claims,
    migrationMapDoc: migration,
  });

  assert.equal(state.ok, false);
  assert.equal(state.failReason, 'CLAIM_MODE_DISPOSITION_CONFLICT');
  assert.ok(state.counts.claimModeConflictCount > 0);
});

test('p1 ws01 negative 04: semantic alias without migration map is rejected', async () => {
  const { evaluateP1Ws01FailsignalSemanticDedupState } = await loadModule();
  const input = baseInput();
  const reg = cloneJson(input.failsignalRegistryDoc);
  reg.failSignals[1].semanticAliasOf = reg.failSignals[0].code;

  const state = evaluateP1Ws01FailsignalSemanticDedupState({
    ...input,
    failsignalRegistryDoc: reg,
  });

  assert.equal(state.ok, false);
  assert.equal(state.failReason, 'SEMANTIC_ALIAS_WITHOUT_MIGRATION_MAP');
  assert.ok(state.counts.semanticAliasWithoutMigrationCount > 0);
});

test('p1 ws01 negative 05: registry declaration mismatch is rejected', async () => {
  const { evaluateP1Ws01FailsignalSemanticDedupState } = await loadModule();
  const input = baseInput();
  const tok = cloneJson(input.tokenCatalogDoc);
  const token = tok.tokens.find((row) => row && row.failSignalCode);
  token.failSignalCode = 'E_UNKNOWN_SIGNAL_FOR_NEGATIVE_05';

  const state = evaluateP1Ws01FailsignalSemanticDedupState({
    ...input,
    tokenCatalogDoc: tok,
  });

  assert.equal(state.ok, false);
  assert.equal(state.failReason, 'REGISTRY_DECLARATION_MISMATCH');
  assert.ok(state.counts.registryDeclarationMismatchCount > 0);
});

test('p1 ws01 repeatability: three runs are stable', async () => {
  const { evaluateP1Ws01FailsignalSemanticDedupState } = await loadModule();

  const runs = [
    evaluateP1Ws01FailsignalSemanticDedupState({ repoRoot: REPO_ROOT }),
    evaluateP1Ws01FailsignalSemanticDedupState({ repoRoot: REPO_ROOT }),
    evaluateP1Ws01FailsignalSemanticDedupState({ repoRoot: REPO_ROOT }),
  ].map((entry) => normalizeComparable(entry));

  assert.deepEqual(runs[0], runs[1]);
  assert.deepEqual(runs[1], runs[2]);
  assert.equal(runs[0].ok, true);
});
