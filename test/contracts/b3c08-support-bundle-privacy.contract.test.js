const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const {
  DEFAULT_ALLOWED_FIELDS,
  FORBIDDEN_DEFAULT_FIELDS,
  HELPER_ROLE,
  REDACTION_TOKEN,
  REQUIRED_NETWORK_UPLOAD_DENY_ROUTES,
  createDefaultSupportBundle,
  createFixtureProject,
  findForbiddenStrings,
  runSupportBundlePrivacyMatrix,
  runSupportBundlePrivacyMatrixWithNetwork,
} = require('../../src/security/support-bundle-privacy.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b3c08-support-bundle-privacy-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B3C08_SUPPORT_BUNDLE_PRIVACY_STATUS_V1.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) modulePromise = import(pathToFileURL(MODULE_PATH).href);
  return modulePromise;
}

function readJson(targetPath) {
  return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
}

test('b3c08 support bundle privacy: state artifact equals executable state', async () => {
  const { evaluateB3C08SupportBundlePrivacyState, TOKEN_NAME } = await loadModule();
  const state = await evaluateB3C08SupportBundlePrivacyState({ repoRoot: REPO_ROOT });
  const committedState = readJson(STATUS_PATH);

  assert.deepEqual(committedState, state);
  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.status, 'PASS');
  assert.equal(state[TOKEN_NAME], 1);
  assert.deepEqual(state.failRows, []);
  assert.equal(state.repo.repoRootBinding, 'WORKTREE_INDEPENDENT');
  assert.equal(state.runtime.commandResults.status, 'DECLARED_FOR_EXTERNAL_RUNNER');
  assert.equal(state.runtime.commandResults.selfExecuted, false);
  assert.equal(state.runtime.commandResults.allPassed, null);
});

test('b3c08 support bundle privacy: CLI status remains worktree independent outside repo cwd', () => {
  const result = spawnSync(process.execPath, [MODULE_PATH, '--json'], {
    cwd: os.tmpdir(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);

  const state = JSON.parse(result.stdout);
  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.B3C08_SUPPORT_BUNDLE_PRIVACY_OK, 1);
  assert.deepEqual(state.failRows, []);
  assert.equal(state.repo.repoRootBinding, 'WORKTREE_INDEPENDENT');
});

test('b3c08 support bundle privacy: default bundle has allowlisted fields and no forbidden field names', () => {
  const proof = createDefaultSupportBundle({ project: createFixtureProject() });
  const keys = Object.keys(proof.bundle);

  assert.equal(keys.every((key) => DEFAULT_ALLOWED_FIELDS.includes(key)), true, keys.join(','));
  for (const forbidden of FORBIDDEN_DEFAULT_FIELDS) {
    assert.equal(proof.snapshot.includes(`"${forbidden}"`), false, `${forbidden} must not appear`);
  }
  assert.equal(proof.bundle.privacy.helperRole, HELPER_ROLE);
  assert.equal(proof.bundle.privacy.proofHelperOnly, true);
});

test('b3c08 support bundle privacy: forbidden body title path asset and raw error strings are absent', () => {
  const project = createFixtureProject();
  const proof = createDefaultSupportBundle({ project });
  const hits = findForbiddenStrings(proof.snapshot, proof.forbiddenStrings);

  assert.deepEqual(hits, []);
  assert.equal(proof.snapshot.includes(project.manuscriptBody), false);
  assert.equal(proof.snapshot.includes(project.sceneTitle), false);
  assert.equal(proof.snapshot.includes(project.privatePath), false);
  assert.equal(proof.snapshot.includes(project.assetBinary.toString('base64')), false);
  assert.equal(proof.snapshot.includes(project.errorText), false);
  assert.equal(proof.snapshot.includes(REDACTION_TOKEN), true);
});

test('b3c08 support bundle privacy: private path is boundary rejected and represented only as redacted basename', () => {
  const project = createFixtureProject();
  const proof = createDefaultSupportBundle({ project });

  assert.equal(proof.privatePath.acceptedAsRelativePublicPath, false);
  assert.equal(proof.privatePath.boundaryFailSignal, 'E_PATH_BOUNDARY_VIOLATION');
  assert.equal(proof.privatePath.sourceValueStored, false);
  assert.equal(Object.hasOwn(proof.privatePath, 'rawPath'), false);
  assert.equal(proof.snapshot.includes(proof.privatePath.redactedPath), true);
  assert.equal(proof.snapshot.includes(project.privatePath), false);
});

test('b3c08 support bundle privacy: matrix denies leaks and release attestation claims', () => {
  const networkRows = REQUIRED_NETWORK_UPLOAD_DENY_ROUTES.map((route) => ({
    route,
    denied: true,
    failSignal: 'E_B3C06_NETWORK_ATTEMPT',
  }));
  const matrix = runSupportBundlePrivacyMatrix({ project: createFixtureProject(), networkRows });
  const byId = new Map(matrix.rows.map((row) => [row.id, row]));

  for (const id of [
    'BODY_LEAK_DENIED',
    'SCENE_TITLE_LEAK_DENIED',
    'PRIVATE_PATH_LEAK_DENIED',
    'ASSET_BINARY_LEAK_DENIED',
    'UNREDACTED_ERROR_DENIED',
    'RELEASE_DOSSIER_CLAIM_ABSENT',
    'ATTESTATION_CLAIM_ABSENT',
    'REDACTION_OUTPUT_SNAPSHOT_BOUND',
    'FORBIDDEN_STRING_SCAN_BOUND',
    'PRIVATE_PATH_NORMALIZATION_CHECK_BOUND',
    'DEFAULT_BUNDLE_FIELD_ALLOWLIST_BOUND',
  ]) {
    assert.equal(byId.get(id)?.passed, true, `${id} must pass`);
  }
  assert.deepEqual(matrix.failedRows, []);
});

test('b3c08 support bundle privacy: network upload absence is bound to B3C06 negative matrix', async () => {
  const matrixWithoutNetworkRows = runSupportBundlePrivacyMatrix({ project: createFixtureProject() });
  const unboundNetworkRow = matrixWithoutNetworkRows.rows.find((row) => row.id === 'NETWORK_UPLOAD_ABSENT');

  assert.equal(unboundNetworkRow?.passed, false);
  assert.equal(unboundNetworkRow?.failSignal, 'E_B3C08_SUPPORT_BUNDLE_PRIVACY_NOT_OK');

  const matrix = await runSupportBundlePrivacyMatrixWithNetwork();
  const networkRow = matrix.rows.find((row) => row.id === 'NETWORK_UPLOAD_ABSENT');

  assert.equal(networkRow?.passed, true);
  assert.equal(networkRow?.reason, 'B3C06_NETWORK_DENY_MATRIX_BOUND');
  assert.deepEqual(networkRow?.details.requiredRoutes, [...REQUIRED_NETWORK_UPLOAD_DENY_ROUTES]);
  assert.deepEqual(
    [...networkRow.details.observedRoutes].sort((a, b) => a.localeCompare(b)),
    [...REQUIRED_NETWORK_UPLOAD_DENY_ROUTES].sort((a, b) => a.localeCompare(b)),
  );
});

test('b3c08 support bundle privacy: state binds B3C05 B3C06 and B3C07 inputs', async () => {
  const { evaluateB3C08SupportBundlePrivacyState } = await loadModule();
  const state = await evaluateB3C08SupportBundlePrivacyState({ repoRoot: REPO_ROOT });

  assert.equal(state.proof.b3c05InputBound, true);
  assert.equal(state.proof.b3c06InputBound, true);
  assert.equal(state.proof.b3c07InputBound, true);
  assert.equal(state.proof.noProductSupportBundleClaim, true);
  assert.equal(state.proof.noReleaseDossierClaim, true);
  assert.equal(state.proof.noAttestationClaim, true);
  assert.equal(Object.hasOwn(state.runtime.privatePathNormalization, 'rawPath'), false);
  assert.equal(state.runtime.privatePathNormalization.sourceValueStored, false);
});

test('b3c08 support bundle privacy: scope flags reject UI IPC storage export release and B3C09 claims', async () => {
  const { evaluateB3C08SupportBundlePrivacyState } = await loadModule();
  const state = await evaluateB3C08SupportBundlePrivacyState({ repoRoot: REPO_ROOT });

  assert.equal(state.scope.proofHelperOnly, true);
  assert.equal(state.scope.supportBundlePrivacyOnly, true);
  assert.equal(state.scope.productSupportBundleFeatureClaim, false);
  assert.equal(state.scope.supportBundleUiCreated, false);
  assert.equal(state.scope.ipcChanged, false);
  assert.equal(state.scope.storageMutated, false);
  assert.equal(state.scope.exportPipelineRewritten, false);
  assert.equal(state.scope.performanceBaselineClaim, false);
  assert.equal(state.scope.releaseDossierClaim, false);
  assert.equal(state.scope.attestationClaim, false);
  assert.equal(state.scope.uiTouched, false);
  assert.equal(state.scope.releaseClaim, false);
});
