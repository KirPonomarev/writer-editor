const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'domain-negative-test-enforcement-state.mjs');
const FAILSIGNAL_REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json');
const TOKEN_CATALOG_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'TOKENS', 'TOKEN_CATALOG.json');
const REQUIRED_SET_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'REQUIRED_SET_PHASE_3_V1.json');

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

test('domain negative test enforcement full: domain-critical tokens are mapped to domain negatives', async () => {
  const { evaluateDomainNegativeTestEnforcement } = await loadModule();

  const state = evaluateDomainNegativeTestEnforcement({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    tokenCatalogPath: TOKEN_CATALOG_PATH,
    requiredSetPath: REQUIRED_SET_PATH,
  });

  assert.equal(state.ok, true);
  assert.equal(state.DOMAIN_NEGATIVE_TEST_ENFORCEMENT_OK, 1);
  assert.ok(state.domainCriticalTokenCount > 0);
  assert.equal(state.domainCriticalTokenCount, state.mappedDomainCriticalTokenCount);
  assert.equal(state.domainNegativeCoveragePct, 100);
  assert.equal(state.domainCriticalTokensHaveDomainNegativeCheck, true);
  assert.equal(state.domainNegativeCoverageCompletenessCheck, true);
});

test('domain negative test enforcement full: generic schema negative reuse is rejected for domain-critical token', async () => {
  const {
    evaluateDomainNegativeTestEnforcement,
    GENERIC_SCHEMA_NEGATIVE_TEST_REF,
  } = await loadModule();

  const tokenCatalogDoc = readJson(TOKEN_CATALOG_PATH);
  const baselineState = evaluateDomainNegativeTestEnforcement({
    repoRoot: REPO_ROOT,
    tokenCatalogDoc,
  });

  assert.ok(baselineState.domainTokenMap.length > 0, 'domain critical token target must exist');
  const targetTokenId = baselineState.domainTokenMap[0].tokenId;

  const mutatedTokenCatalogDoc = cloneJson(tokenCatalogDoc);
  const tokens = Array.isArray(mutatedTokenCatalogDoc.tokens) ? mutatedTokenCatalogDoc.tokens : [];
  for (const row of tokens) {
    if (row && typeof row === 'object' && String(row.tokenId || '').trim() === targetTokenId) {
      row.negativeContractRef = GENERIC_SCHEMA_NEGATIVE_TEST_REF;
      break;
    }
  }

  const state = evaluateDomainNegativeTestEnforcement({
    repoRoot: REPO_ROOT,
    tokenCatalogDoc: mutatedTokenCatalogDoc,
  });

  assert.equal(state.ok, false);
  assert.equal(state.DOMAIN_NEGATIVE_TEST_ENFORCEMENT_OK, 0);
  assert.equal(state.genericSchemaNegativeReuseForbiddenCheck, false);
  assert.equal(state.failReason, 'E_GENERIC_NEGATIVE_REUSE_FORBIDDEN');
  assert.ok(
    state.genericNegativeReuseViolations.some((entry) => String(entry.tokenId || '').trim() === targetTokenId),
    'mutated domain-critical token must be reported as generic negative reuse violation',
  );
});

test('domain negative test enforcement full: missing domain negative for release-required token fails', async () => {
  const { evaluateDomainNegativeTestEnforcement } = await loadModule();

  const tokenCatalogDoc = readJson(TOKEN_CATALOG_PATH);
  const baselineState = evaluateDomainNegativeTestEnforcement({
    repoRoot: REPO_ROOT,
    tokenCatalogDoc,
  });

  assert.ok(baselineState.domainTokenMap.length > 0, 'domain critical token target must exist');
  const targetTokenId = baselineState.domainTokenMap[0].tokenId;

  const mutatedTokenCatalogDoc = cloneJson(tokenCatalogDoc);
  const tokens = Array.isArray(mutatedTokenCatalogDoc.tokens) ? mutatedTokenCatalogDoc.tokens : [];
  for (const row of tokens) {
    if (row && typeof row === 'object' && String(row.tokenId || '').trim() === targetTokenId) {
      row.negativeContractRef = '';
      break;
    }
  }

  const state = evaluateDomainNegativeTestEnforcement({
    repoRoot: REPO_ROOT,
    tokenCatalogDoc: mutatedTokenCatalogDoc,
    effectiveRequiredTokenIds: [targetTokenId],
  });

  assert.equal(state.ok, false);
  assert.equal(state.DOMAIN_NEGATIVE_TEST_ENFORCEMENT_OK, 0);
  assert.equal(state.releaseRequiredDomainNegativeMissingCheck, false);
  assert.equal(state.failReason, 'E_DOMAIN_NEGATIVE_MISSING');
  assert.ok(
    state.releaseRequiredDomainNegativeMissing.some((entry) => String(entry.tokenId || '').trim() === targetTokenId),
    'mutated release-required domain token must be reported as missing domain negative',
  );
});

test('domain negative test enforcement full: advisory signals remain non-blocking and evaluator stays canonical', async () => {
  const { evaluateDomainNegativeTestEnforcement } = await loadModule();

  const state = evaluateDomainNegativeTestEnforcement({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    tokenCatalogPath: TOKEN_CATALOG_PATH,
    requiredSetPath: REQUIRED_SET_PATH,
  });

  assert.equal(state.advisoryToBlockingDriftCount, 0);
  assert.equal(state.advisoryToBlockingDriftCountZero, true);
  assert.equal(state.singleBlockingAuthority.ok, true);
});
