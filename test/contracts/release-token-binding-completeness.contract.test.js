const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'release-token-binding-completeness-state.mjs');
const CATALOG_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'TOKENS', 'TOKEN_CATALOG.json');
const REQUIRED_SET_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EXECUTION', 'REQUIRED_TOKEN_SET.json');

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

test('release token binding completeness: complete set returns completeness ok true', async () => {
  const { evaluateReleaseTokenBindingCompleteness } = await loadModule();
  const state = evaluateReleaseTokenBindingCompleteness({
    catalogPath: CATALOG_PATH,
    requiredSetPath: REQUIRED_SET_PATH,
  });

  assert.equal(state.completenessOk, true);
  assert.equal(state.missingRequiredBindingFieldsCount, 0);
  assert.equal(state.RELEASE_TOKEN_BINDING_COMPLETENESS_OK, 1);
});

test('release token binding completeness: removing one required field returns completeness ok false', async () => {
  const { evaluateReleaseTokenBindingCompleteness } = await loadModule();
  const catalogDoc = readJson(CATALOG_PATH);
  const requiredSet = readJson(REQUIRED_SET_PATH);
  const releaseRequired = ((requiredSet.requiredSets || {}).release || []).map((entry) => String(entry || '').trim()).filter(Boolean);
  assert.ok(releaseRequired.length > 0, 'release required set must not be empty');

  const tokenId = releaseRequired[0];
  const token = (catalogDoc.tokens || []).find((row) => row && row.tokenId === tokenId);
  assert.ok(token, `token must exist in catalog: ${tokenId}`);

  delete token.proofHook;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-token-binding-negative-'));
  const mutatedCatalogPath = path.join(tmpDir, 'TOKEN_CATALOG.mutated.json');
  fs.writeFileSync(mutatedCatalogPath, `${JSON.stringify(catalogDoc, null, 2)}\n`, 'utf8');

  try {
    const state = evaluateReleaseTokenBindingCompleteness({
      catalogPath: mutatedCatalogPath,
      requiredSetPath: REQUIRED_SET_PATH,
    });

    assert.equal(state.completenessOk, false);
    assert.equal(state.RELEASE_TOKEN_BINDING_COMPLETENESS_OK, 0);
    assert.ok(state.missingRequiredBindingFieldsCount > 0);
    assert.ok(
      state.missingRequiredBindingFields.some((entry) => entry.tokenId === tokenId && entry.field === 'proofHook'),
      'removed proofHook must be detected as missing binding field',
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('release token binding completeness: repeatable pass 3 runs keeps missing count zero', async () => {
  const { evaluateReleaseTokenBindingCompleteness } = await loadModule();

  const runs = [];
  for (let i = 0; i < 3; i += 1) {
    const state = evaluateReleaseTokenBindingCompleteness({
      catalogPath: CATALOG_PATH,
      requiredSetPath: REQUIRED_SET_PATH,
    });
    runs.push({
      completenessOk: state.completenessOk,
      missingRequiredBindingFieldsCount: state.missingRequiredBindingFieldsCount,
      releaseRequiredTokensCount: state.releaseRequiredTokensCount,
    });
  }

  assert.deepEqual(runs[0], runs[1]);
  assert.deepEqual(runs[1], runs[2]);
  assert.equal(runs[0].completenessOk, true);
  assert.equal(runs[0].missingRequiredBindingFieldsCount, 0);
});
