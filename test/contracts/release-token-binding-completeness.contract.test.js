const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'release-token-binding-completeness-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'RELEASE_TOKEN_BINDING_COMPLETENESS_v3.json');
const BINDING_SCHEMA_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'BINDING_SCHEMA_V1.json');
const PHASE_SWITCH_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'PHASE_SWITCH_V1.json');
const PHASE_SET_1_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'REQUIRED_SET_PHASE_1_V1.json');
const PHASE_SET_2_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'REQUIRED_SET_PHASE_2_V1.json');
const PHASE_SET_3_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'REQUIRED_SET_PHASE_3_V1.json');
const CATALOG_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'TOKENS', 'TOKEN_CATALOG.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function runNode(args) {
  return spawnSync(process.execPath, [MODULE_PATH, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
}

function evaluateWithDefaults(evaluateReleaseTokenBindingCompleteness, overrides = {}) {
  return evaluateReleaseTokenBindingCompleteness({
    statusPath: STATUS_PATH,
    bindingSchemaPath: overrides.bindingSchemaPath || BINDING_SCHEMA_PATH,
    phaseSwitchPath: PHASE_SWITCH_PATH,
    phaseSet1Path: PHASE_SET_1_PATH,
    phaseSet2Path: PHASE_SET_2_PATH,
    phaseSet3Path: PHASE_SET_3_PATH,
    catalogPath: CATALOG_PATH,
  });
}

test('release token binding completeness: complete effective required set returns completeness ok true', async () => {
  const { evaluateReleaseTokenBindingCompleteness } = await loadModule();
  const state = evaluateWithDefaults(evaluateReleaseTokenBindingCompleteness);

  assert.equal(state.completenessOk, true);
  assert.equal(state.missingRequiredBindingFieldsCount, 0);
  assert.equal(state.missingEffectiveRequiredTokensInCatalogCount, 0);
  assert.equal(state.bindingRecordCoverage.coveragePct, 100);
  assert.equal(state.RELEASE_TOKEN_BINDING_COMPLETENESS_OK, 1);
});

test('release token binding completeness: removing one required field returns completeness ok false', async () => {
  const { evaluateReleaseTokenBindingCompleteness } = await loadModule();
  const schemaDoc = JSON.parse(fs.readFileSync(BINDING_SCHEMA_PATH, 'utf8'));
  const tokenId = schemaDoc.records[0].TOKEN_ID;
  delete schemaDoc.records[0].PROOFHOOK_REF;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-token-binding-negative-'));
  const mutatedSchemaPath = path.join(tmpDir, 'BINDING_SCHEMA_V1.mutated.json');
  fs.writeFileSync(mutatedSchemaPath, `${JSON.stringify(schemaDoc, null, 2)}\n`, 'utf8');

  try {
    const state = evaluateWithDefaults(evaluateReleaseTokenBindingCompleteness, {
      bindingSchemaPath: mutatedSchemaPath,
    });

    assert.equal(state.completenessOk, false);
    assert.equal(state.RELEASE_TOKEN_BINDING_COMPLETENESS_OK, 0);
    assert.ok(state.missingRequiredBindingFieldsCount > 0);
    assert.ok(
      state.missingRequiredBindingFields.some((entry) => entry.tokenId === tokenId && entry.field === 'PROOFHOOK_REF'),
      'removed PROOFHOOK_REF must be detected as missing binding field',
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('release token binding completeness: token fail in effective required set returns nonzero exit', () => {
  const schemaDoc = JSON.parse(fs.readFileSync(BINDING_SCHEMA_PATH, 'utf8'));
  delete schemaDoc.records[0].PROOFHOOK_REF;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-token-binding-exit-'));
  const mutatedSchemaPath = path.join(tmpDir, 'BINDING_SCHEMA_V1.mutated.json');
  fs.writeFileSync(mutatedSchemaPath, `${JSON.stringify(schemaDoc, null, 2)}\n`, 'utf8');

  try {
    const result = runNode([
      '--status-path', STATUS_PATH,
      '--binding-schema-path', mutatedSchemaPath,
      '--phase-switch-path', PHASE_SWITCH_PATH,
      '--phase-set-1-path', PHASE_SET_1_PATH,
      '--phase-set-2-path', PHASE_SET_2_PATH,
      '--phase-set-3-path', PHASE_SET_3_PATH,
      '--catalog-path', CATALOG_PATH,
    ]);
    assert.notEqual(result.status, 0, `must return nonzero on effective required token fail\n${result.stdout}\n${result.stderr}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('release token binding completeness: repeatable pass 3 runs keeps missing count zero', async () => {
  const { evaluateReleaseTokenBindingCompleteness } = await loadModule();

  const runs = [];
  for (let i = 0; i < 3; i += 1) {
    const state = evaluateWithDefaults(evaluateReleaseTokenBindingCompleteness);
    runs.push({
      completenessOk: state.completenessOk,
      missingRequiredBindingFieldsCount: state.missingRequiredBindingFieldsCount,
      coveragePct: state.bindingRecordCoverage.coveragePct,
      activePhase: state.activePhase,
    });
  }

  assert.deepEqual(runs[0], runs[1]);
  assert.deepEqual(runs[1], runs[2]);
  assert.equal(runs[0].completenessOk, true);
  assert.equal(runs[0].missingRequiredBindingFieldsCount, 0);
});
