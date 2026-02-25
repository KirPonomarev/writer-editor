const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'domain-negative-test-enforcement-state.mjs');
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

function isDomainFailSignal(row) {
  const code = String(row?.code || '').trim();
  const sourceBinding = String(row?.sourceBinding || '').trim();
  if (!code) return false;
  if (code.startsWith('E_FAILSIGNAL_')) return false;
  if (sourceBinding === 'reconcile_p0_02') return false;
  return true;
}

test('domain negative test enforcement: mapping coverage is 100 percent', async () => {
  const { evaluateDomainNegativeTestEnforcement } = await loadModule();
  const state = evaluateDomainNegativeTestEnforcement({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  assert.equal(state.ok, true);
  assert.equal(state.DOMAIN_NEGATIVE_TEST_ENFORCEMENT_OK, 1);
  assert.equal(state.domainMappingCoveragePct, 100);
  assert.equal(state.domainMappingCoverageOk, true);
  assert.equal(state.domainFailSignalsCount, state.mappedDomainFailSignalsCount);
});

test('domain negative test enforcement: generic schema-only negative tests cannot close domain failSignals', async () => {
  const {
    evaluateDomainNegativeTestEnforcement,
    GENERIC_SCHEMA_NEGATIVE_TEST_REF,
  } = await loadModule();

  const registryDoc = readJson(FAILSIGNAL_REGISTRY_PATH);
  const failSignals = Array.isArray(registryDoc.failSignals) ? registryDoc.failSignals : [];
  const target = failSignals.find((row) => row && typeof row === 'object' && isDomainFailSignal(row));

  assert.ok(target, 'domain failSignal target must exist');

  const targetCode = String(target.code || '').trim();
  target.negativeTestRef = GENERIC_SCHEMA_NEGATIVE_TEST_REF;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'domain-negative-test-rejection-'));
  const mutatedRegistryPath = path.join(tmpDir, 'FAILSIGNAL_REGISTRY.mutated.json');
  fs.writeFileSync(mutatedRegistryPath, `${JSON.stringify(registryDoc, null, 2)}\n`, 'utf8');

  try {
    const state = evaluateDomainNegativeTestEnforcement({
      repoRoot: REPO_ROOT,
      failsignalRegistryPath: mutatedRegistryPath,
    });

    assert.equal(state.ok, false);
    assert.equal(state.DOMAIN_NEGATIVE_TEST_ENFORCEMENT_OK, 0);
    assert.equal(state.failSignalCode, 'E_FAILSIGNAL_NEGATIVE_TEST_MISSING');
    assert.equal(state.genericSchemaRejectionOk, false);
    assert.ok(
      state.genericSchemaRejectionCases.some((entry) => String(entry.failSignalCode || '').trim() === targetCode),
      'mutated domain failSignal must be rejected as generic schema negative reference',
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('domain negative test enforcement: registry and contract tests are consistent', async () => {
  const { evaluateDomainNegativeTestEnforcement } = await loadModule();
  const state = evaluateDomainNegativeTestEnforcement({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  assert.equal(state.consistencyOk, true);
  assert.equal(state.genericSchemaRejectionOk, true);
  assert.deepEqual(state.mappingIssues, []);
});
