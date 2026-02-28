const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const CANON_STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'CANON_STATUS.json');
const TOKEN_CATALOG_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'TOKENS', 'TOKEN_CATALOG.json');
const CLAIM_MATRIX_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'CLAIMS', 'CRITICAL_CLAIM_MATRIX.json');
const FAILSIGNAL_REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json');
const BINDING_SCHEMA_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'BINDING_SCHEMA_V1.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(
      path.join(REPO_ROOT, 'scripts/ops/ws03-blocking-binding-completeness-state.mjs'),
    ).href);
  }
  return modulePromise;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function cloneJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function evaluateWithPaths(evaluateWs03BlockingBindingCompleteness, overrides = {}) {
  return evaluateWs03BlockingBindingCompleteness({
    canonStatusPath: overrides.canonStatusPath || CANON_STATUS_PATH,
    tokenCatalogPath: overrides.tokenCatalogPath || TOKEN_CATALOG_PATH,
    claimMatrixPath: overrides.claimMatrixPath || CLAIM_MATRIX_PATH,
    failsignalRegistryPath: overrides.failsignalRegistryPath || FAILSIGNAL_REGISTRY_PATH,
    bindingSchemaPath: overrides.bindingSchemaPath || BINDING_SCHEMA_PATH,
  });
}

test('ws03 blocking binding completeness: baseline target set has full binding', async () => {
  const { evaluateWs03BlockingBindingCompleteness } = await loadModule();
  const state = evaluateWithPaths(evaluateWs03BlockingBindingCompleteness);
  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.WS03_BLOCKING_BINDING_COMPLETENESS_OK, 1);
  assert.equal(state.alignmentGapCount, 0);
  assert.equal(state.missingBindingFieldsCount, 0);
  assert.equal(state.targetBlockingCount, 14);
  assert.equal(state.targetBlockingCoveredCount, 14);
});

test('ws03 blocking binding completeness negative: missing proofhook fails with E_BLOCKING_TOKEN_UNBOUND', async () => {
  const { evaluateWs03BlockingBindingCompleteness } = await loadModule();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws03-missing-proofhook-'));
  const mutatedSchemaPath = path.join(tmpDir, 'BINDING_SCHEMA_V1.mutated.json');

  const schema = cloneJson(BINDING_SCHEMA_PATH);
  const rec = schema.records.find((row) => row.TOKEN_ID === 'CORE_SOT_EXECUTABLE_OK');
  delete rec.PROOFHOOK_REF;
  writeJson(mutatedSchemaPath, schema);

  try {
    const state = evaluateWithPaths(evaluateWs03BlockingBindingCompleteness, {
      bindingSchemaPath: mutatedSchemaPath,
    });
    assert.equal(state.ok, false);
    assert.equal(state.failSignalCode, 'E_BLOCKING_TOKEN_UNBOUND');
    assert.ok(state.issues.some((row) => row.tokenId === 'CORE_SOT_EXECUTABLE_OK' && row.code === 'BINDING_FIELDS_MISSING'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('ws03 blocking binding completeness negative: missing negative contract fails with E_BLOCKING_TOKEN_UNBOUND', async () => {
  const { evaluateWs03BlockingBindingCompleteness } = await loadModule();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws03-missing-negative-contract-'));
  const mutatedSchemaPath = path.join(tmpDir, 'BINDING_SCHEMA_V1.mutated.json');

  const schema = cloneJson(BINDING_SCHEMA_PATH);
  const rec = schema.records.find((row) => row.TOKEN_ID === 'RECOVERY_IO_OK');
  delete rec.NEGATIVE_CONTRACT_REF;
  writeJson(mutatedSchemaPath, schema);

  try {
    const state = evaluateWithPaths(evaluateWs03BlockingBindingCompleteness, {
      bindingSchemaPath: mutatedSchemaPath,
    });
    assert.equal(state.ok, false);
    assert.equal(state.failSignalCode, 'E_BLOCKING_TOKEN_UNBOUND');
    assert.ok(state.issues.some((row) => row.tokenId === 'RECOVERY_IO_OK' && row.code === 'BINDING_FIELDS_MISSING'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('ws03 blocking binding completeness negative: missing sourcebinding fails with E_BLOCKING_TOKEN_UNBOUND', async () => {
  const { evaluateWs03BlockingBindingCompleteness } = await loadModule();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws03-missing-sourcebinding-'));
  const mutatedSchemaPath = path.join(tmpDir, 'BINDING_SCHEMA_V1.mutated.json');

  const schema = cloneJson(BINDING_SCHEMA_PATH);
  const rec = schema.records.find((row) => row.TOKEN_ID === 'CONFIG_HASH_LOCK_OK');
  delete rec.SOURCE_BINDING_REF;
  writeJson(mutatedSchemaPath, schema);

  try {
    const state = evaluateWithPaths(evaluateWs03BlockingBindingCompleteness, {
      bindingSchemaPath: mutatedSchemaPath,
    });
    assert.equal(state.ok, false);
    assert.equal(state.failSignalCode, 'E_BLOCKING_TOKEN_UNBOUND');
    assert.ok(state.issues.some((row) => row.tokenId === 'CONFIG_HASH_LOCK_OK' && row.code === 'BINDING_FIELDS_MISSING'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('ws03 blocking binding completeness negative: missing rollback fails with E_BLOCKING_TOKEN_UNBOUND', async () => {
  const { evaluateWs03BlockingBindingCompleteness } = await loadModule();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws03-missing-rollback-'));
  const mutatedSchemaPath = path.join(tmpDir, 'BINDING_SCHEMA_V1.mutated.json');

  const schema = cloneJson(BINDING_SCHEMA_PATH);
  const rec = schema.records.find((row) => row.TOKEN_ID === 'VERIFY_ATTESTATION_OK');
  delete rec.ROLLBACK_REF;
  writeJson(mutatedSchemaPath, schema);

  try {
    const state = evaluateWithPaths(evaluateWs03BlockingBindingCompleteness, {
      bindingSchemaPath: mutatedSchemaPath,
    });
    assert.equal(state.ok, false);
    assert.equal(state.failSignalCode, 'E_BLOCKING_TOKEN_UNBOUND');
    assert.ok(state.issues.some((row) => row.tokenId === 'VERIFY_ATTESTATION_OK' && row.code === 'BINDING_FIELDS_MISSING'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('ws03 blocking binding completeness negative: token claim registry mismatch fails with E_BLOCKING_TOKEN_UNBOUND', async () => {
  const { evaluateWs03BlockingBindingCompleteness } = await loadModule();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws03-token-claim-mismatch-'));
  const mutatedClaimsPath = path.join(tmpDir, 'CRITICAL_CLAIM_MATRIX.mutated.json');

  const claims = cloneJson(CLAIM_MATRIX_PATH);
  const rec = claims.claims.find((row) => row.requiredToken === 'PROOFHOOK_INTEGRITY_OK');
  rec.failSignal = 'E_TOKEN_CLAIM_MISMATCH_TEST';
  rec.failSignalCode = 'E_TOKEN_CLAIM_MISMATCH_TEST';
  writeJson(mutatedClaimsPath, claims);

  try {
    const state = evaluateWithPaths(evaluateWs03BlockingBindingCompleteness, {
      claimMatrixPath: mutatedClaimsPath,
    });
    assert.equal(state.ok, false);
    assert.equal(state.failSignalCode, 'E_BLOCKING_TOKEN_UNBOUND');
    assert.ok(state.issues.some((row) => row.tokenId === 'PROOFHOOK_INTEGRITY_OK' && row.code === 'TOKEN_CLAIM_FAILSIGNAL_MISMATCH'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

