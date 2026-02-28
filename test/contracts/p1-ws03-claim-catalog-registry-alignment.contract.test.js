const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'p1-ws03-claim-catalog-registry-alignment-state.mjs');
const CANON_STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'CANON_STATUS.json');
const REQUIRED_TOKEN_SET_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EXECUTION', 'REQUIRED_TOKEN_SET.json');
const TOKEN_CATALOG_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'TOKENS', 'TOKEN_CATALOG.json');
const CLAIM_MATRIX_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'CLAIMS', 'CRITICAL_CLAIM_MATRIX.json');
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

function baseInput() {
  return {
    repoRoot: REPO_ROOT,
    canonStatusDoc: readJson(CANON_STATUS_PATH),
    requiredTokenSetDoc: readJson(REQUIRED_TOKEN_SET_PATH),
    tokenCatalogDoc: readJson(TOKEN_CATALOG_PATH),
    claimMatrixDoc: readJson(CLAIM_MATRIX_PATH),
    failsignalRegistryDoc: readJson(FAILSIGNAL_REGISTRY_PATH),
    runNegativeFixtures: false,
  };
}

function normalizeComparable(state) {
  return {
    ok: state.ok,
    token: state.P1_WS03_CLAIM_CATALOG_REGISTRY_ALIGNMENT_OK,
    counts: state.counts,
    negativeResults: state.negativeResults,
    positiveResults: state.positiveResults,
    dod: state.dod,
    acceptance: state.acceptance,
  };
}

test('p1 ws03 baseline: all DoD and acceptance pass', async () => {
  const { evaluateP1Ws03ClaimCatalogRegistryAlignmentState } = await loadModule();
  const state = evaluateP1Ws03ClaimCatalogRegistryAlignmentState({ repoRoot: REPO_ROOT });

  assert.equal(state.ok, true);
  assert.equal(state.P1_WS03_CLAIM_CATALOG_REGISTRY_ALIGNMENT_OK, 1);
  assert.equal(state.counts.claimTokenGapCount, 0);
  assert.equal(state.counts.claimFailsignalGapCount, 0);
  assert.equal(state.counts.tokenFailsignalGapCount, 0);

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

test('p1 ws03 negative 01: claim referencing missing token is rejected', async () => {
  const { evaluateP1Ws03ClaimCatalogRegistryAlignmentState } = await loadModule();
  const input = baseInput();
  const tokenDoc = cloneJson(input.tokenCatalogDoc);
  const active = (input.requiredTokenSetDoc.requiredSets || {}).active || [];
  const claim = (input.claimMatrixDoc.claims || []).find((row) => row && active.includes(row.requiredToken));
  const tokenId = claim.requiredToken;
  tokenDoc.tokens = tokenDoc.tokens.filter((row) => row.tokenId !== tokenId);

  const state = evaluateP1Ws03ClaimCatalogRegistryAlignmentState({
    ...input,
    tokenCatalogDoc: tokenDoc,
  });

  assert.equal(state.ok, false);
  assert.equal(state.failReason, 'CLAIM_REFERENCES_MISSING_TOKEN');
  assert.ok(state.counts.claimTokenGapCount > 0);
});

test('p1 ws03 negative 02: claim referencing missing failsignal is rejected', async () => {
  const { evaluateP1Ws03ClaimCatalogRegistryAlignmentState } = await loadModule();
  const input = baseInput();
  const claimDoc = cloneJson(input.claimMatrixDoc);
  const active = (input.requiredTokenSetDoc.requiredSets || {}).active || [];
  const claim = (claimDoc.claims || []).find((row) => row && active.includes(row.requiredToken));
  claim.failSignal = 'E_UNKNOWN_SIGNAL_NEG_02';

  const state = evaluateP1Ws03ClaimCatalogRegistryAlignmentState({
    ...input,
    claimMatrixDoc: claimDoc,
  });

  assert.equal(state.ok, false);
  assert.equal(state.failReason, 'CLAIM_REFERENCES_MISSING_FAILSIGNAL');
  assert.ok(state.counts.claimFailsignalGapCount > 0);
});

test('p1 ws03 negative 03: token referencing missing failsignal is rejected', async () => {
  const { evaluateP1Ws03ClaimCatalogRegistryAlignmentState } = await loadModule();
  const input = baseInput();
  const tokenDoc = cloneJson(input.tokenCatalogDoc);
  const active = (input.requiredTokenSetDoc.requiredSets || {}).active || [];
  const token = (tokenDoc.tokens || []).find((row) => row && active.includes(row.tokenId));
  token.failSignalCode = 'E_UNKNOWN_SIGNAL_NEG_03';

  const state = evaluateP1Ws03ClaimCatalogRegistryAlignmentState({
    ...input,
    tokenCatalogDoc: tokenDoc,
  });

  assert.equal(state.ok, false);
  assert.equal(state.failReason, 'TOKEN_REFERENCES_MISSING_FAILSIGNAL');
  assert.ok(state.counts.tokenFailsignalGapCount > 0);
});

test('p1 ws03 negative 04: required set undeclared entity is rejected', async () => {
  const { evaluateP1Ws03ClaimCatalogRegistryAlignmentState } = await loadModule();
  const input = baseInput();
  const requiredDoc = cloneJson(input.requiredTokenSetDoc);
  if (!requiredDoc.requiredSets) requiredDoc.requiredSets = {};
  if (!Array.isArray(requiredDoc.requiredSets.active)) requiredDoc.requiredSets.active = [];
  requiredDoc.requiredSets.active.push('TOKEN_UNDECLARED_NEG_04');

  const state = evaluateP1Ws03ClaimCatalogRegistryAlignmentState({
    ...input,
    requiredTokenSetDoc: requiredDoc,
  });

  assert.equal(state.ok, false);
  assert.equal(state.failReason, 'REQUIRED_SET_REFERENCES_UNDECLARED_ENTITY');
  assert.ok(state.counts.requiredSetUndeclaredEntityCount > 0);
});

test('p1 ws03 negative 05: active scope alignment mismatch is rejected', async () => {
  const { evaluateP1Ws03ClaimCatalogRegistryAlignmentState } = await loadModule();
  const input = baseInput();
  const tokenDoc = cloneJson(input.tokenCatalogDoc);
  const active = (input.requiredTokenSetDoc.requiredSets || {}).active || [];
  const claim = (input.claimMatrixDoc.claims || []).find((row) => row && active.includes(row.requiredToken));
  const registryCodes = new Set((input.failsignalRegistryDoc.failSignals || []).map((row) => row.code));
  const token = (tokenDoc.tokens || []).find((row) => row && row.tokenId === claim.requiredToken);
  const alt = [...registryCodes].find((code) => code && code !== claim.failSignal);
  token.failSignalCode = alt;

  const state = evaluateP1Ws03ClaimCatalogRegistryAlignmentState({
    ...input,
    tokenCatalogDoc: tokenDoc,
  });

  assert.equal(state.ok, false);
  assert.equal(state.failReason, 'ACTIVE_SCOPE_ALIGNMENT_MISMATCH');
  assert.ok(state.counts.activeScopeAlignmentMismatchCount > 0);
});

test('p1 ws03 repeatability: three runs are stable', async () => {
  const { evaluateP1Ws03ClaimCatalogRegistryAlignmentState } = await loadModule();

  const runs = [
    evaluateP1Ws03ClaimCatalogRegistryAlignmentState({ repoRoot: REPO_ROOT }),
    evaluateP1Ws03ClaimCatalogRegistryAlignmentState({ repoRoot: REPO_ROOT }),
    evaluateP1Ws03ClaimCatalogRegistryAlignmentState({ repoRoot: REPO_ROOT }),
  ].map((entry) => normalizeComparable(entry));

  assert.deepEqual(runs[0], runs[1]);
  assert.deepEqual(runs[1], runs[2]);
  assert.equal(runs[0].ok, true);
});
