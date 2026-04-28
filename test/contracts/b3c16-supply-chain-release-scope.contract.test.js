const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b3c16-supply-chain-release-scope-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B3C16_SUPPLY_CHAIN_RELEASE_SCOPE_STATUS_V1.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) modulePromise = import(pathToFileURL(MODULE_PATH).href);
  return modulePromise;
}

function readJson(targetPath) {
  return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
}

function normalizeDynamicState(state) {
  return {
    ...state,
    repo: {
      ...state.repo,
      headSha: 'DYNAMIC_REPO_HEAD',
    },
  };
}

test('b3c16 supply chain: state artifact matches stable executable fields', async () => {
  const {
    evaluateB3C16SupplyChainReleaseScopeState,
    TOKEN_NAME,
    RELEASE_GREEN_TOKEN_NAME,
  } = await loadModule();
  const state = await evaluateB3C16SupplyChainReleaseScopeState({ repoRoot: REPO_ROOT });
  const committedState = readJson(STATUS_PATH);
  const normalizedCommitted = normalizeDynamicState(committedState);
  const normalizedState = normalizeDynamicState(state);

  assert.equal(committedState.artifactId, state.artifactId);
  assert.equal(committedState.contourId, state.contourId);
  assert.equal(committedState.status, state.status);
  assert.equal(committedState[TOKEN_NAME], state[TOKEN_NAME]);
  assert.equal(committedState[RELEASE_GREEN_TOKEN_NAME], state[RELEASE_GREEN_TOKEN_NAME]);
  assert.deepEqual(committedState.failRows, state.failRows);
  assert.deepEqual(committedState.b3c14InputRow, state.b3c14InputRow);
  assert.deepEqual(committedState.b3c15InputRow, state.b3c15InputRow);
  assert.deepEqual(committedState.dependencyRows, state.dependencyRows);
  assert.deepEqual(committedState.packageManifestRows, state.packageManifestRows);
  assert.deepEqual(committedState.auditRows, state.auditRows);
  assert.deepEqual(committedState.releaseRows, state.releaseRows);
  assert.deepEqual(committedState.negativeRows, state.negativeRows);
  assert.deepEqual(committedState.scope, state.scope);
  assert.deepEqual(normalizedCommitted.repo, normalizedState.repo);
  assert.equal(committedState.runtime.changedBasenamesHash, state.runtime.changedBasenamesHash);
  assert.equal(Boolean(state.runtime.statusArtifactHash), true);
  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.status, 'PASS');
  assert.equal(state[TOKEN_NAME], 1);
  assert.equal(state[RELEASE_GREEN_TOKEN_NAME], 0);
  assert.deepEqual(state.failRows, []);
  assert.equal(state.repo.repoRootBinding, 'WORKTREE_INDEPENDENT');
});

test('b3c16 supply chain: CLI status remains worktree independent outside repo cwd', () => {
  const result = spawnSync(process.execPath, [MODULE_PATH], {
    cwd: os.tmpdir(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);

  const stdout = String(result.stdout || '');
  assert.match(stdout, /B3C16_STATUS=PASS/u);
  assert.match(stdout, /B3C16_SUPPLY_CHAIN_RELEASE_SCOPE_OK=1/u);
  assert.match(stdout, /B3C16_RELEASE_GREEN_OK=0/u);
});

test('b3c16 supply chain: binds B3C14 limits and B3C15 attestation input', async () => {
  const { evaluateB3C16SupplyChainReleaseScopeState } = await loadModule();
  const state = await evaluateB3C16SupplyChainReleaseScopeState({ repoRoot: REPO_ROOT });

  assert.equal(state.b3c14InputRow.basename, 'B3C14_RELEASE_DOSSIER_MINIMAL_STATUS_V1.json');
  assert.equal(state.b3c14InputRow.passed, true);
  assert.equal(state.b3c14InputRow.releaseGreen, 0);
  assert.equal(state.b3c14InputRow.carriedForwardLimitRowCount, 7);
  assert.equal(state.b3c15InputRow.basename, 'B3C15_ATTESTATION_CHAIN_STATUS_V1.json');
  assert.equal(state.b3c15InputRow.passed, true);
  assert.equal(state.b3c15InputRow.releaseGreen, 0);
  assert.equal(state.b3c15InputRow.signatureToken, 1);
  assert.equal(state.b3c15InputRow.verifyToken, 1);
  assert.equal(state.proof.b3c14LimitsPreserved, true);
  assert.equal(state.proof.b3c15AttestationBound, true);
});

test('b3c16 supply chain: dependency allowlist and forbidden dependency rows pass', async () => {
  const { evaluateB3C16SupplyChainReleaseScopeState } = await loadModule();
  const state = await evaluateB3C16SupplyChainReleaseScopeState({ repoRoot: REPO_ROOT });
  const byId = new Map(state.dependencyRows.forbiddenRows.map((row) => [row.id, row]));

  assert.equal(state.dependencyRows.productionAllowedRow.status, 'PASS');
  assert.deepEqual(state.dependencyRows.productionAllowedRow.directDependencies, [
    '@tiptap/core',
    '@tiptap/extension-color',
    '@tiptap/extension-highlight',
    '@tiptap/extension-link',
    '@tiptap/extension-text-style',
    '@tiptap/extension-underline',
    '@tiptap/pm',
    '@tiptap/starter-kit',
  ]);
  assert.deepEqual(state.dependencyRows.productionAllowedRow.directDevDependencies, [
    'electron',
    'electron-builder',
    'esbuild',
  ]);
  assert.equal(byId.get('NO_TIPTAP_PRO_DEPENDENCY').status, 'PASS');
  assert.equal(byId.get('NO_TIPTAP_CLOUD_DEPENDENCY').status, 'PASS');
  assert.equal(byId.get('NO_FORBIDDEN_UI_FRAMEWORK').status, 'PASS');
  assert.equal(byId.get('NO_FORBIDDEN_STATE_MANAGER').status, 'PASS');
  assert.equal(state.proof.forbiddenDependencyRowsPass, true);
});

test('b3c16 supply chain: docx library rule is truthful limited with no package build', async () => {
  const { evaluateB3C16SupplyChainReleaseScopeState } = await loadModule();
  const state = await evaluateB3C16SupplyChainReleaseScopeState({ repoRoot: REPO_ROOT });

  assert.equal(state.dependencyRows.docxLibraryRow.status, 'PASS');
  assert.equal(state.dependencyRows.docxLibraryRow.externalDocxLibraryCount, 0);
  assert.deepEqual(state.dependencyRows.docxLibraryRow.directMatches, []);
  assert.equal(state.dependencyRows.docxLibraryRow.currentStatus, 'LIMITED_NONE_EXTERNAL_DOCX_LIB_CURRENTLY_DECLARED');
  assert.equal(state.dependencyRows.docxLibraryRow.noPackageBuildClaim, true);
  assert.equal(state.proof.docxLibrarySingleOrNone, true);
});

test('b3c16 supply chain: package manifests are read-only and release rows deny package claims', async () => {
  const { evaluateB3C16SupplyChainReleaseScopeState } = await loadModule();
  const state = await evaluateB3C16SupplyChainReleaseScopeState({ repoRoot: REPO_ROOT });
  const manifestRow = state.packageManifestRows.find((row) => row.id === 'PACKAGE_MANIFESTS_READ_ONLY');
  const releaseRow = state.releaseRows.find((row) => row.id === 'NO_PACKAGE_BUILD_NO_PACKAGE_HASH_NO_RELEASE_GREEN');

  assert.equal(manifestRow.status, 'PASS');
  assert.deepEqual(manifestRow.changedBasenames, []);
  assert.deepEqual(manifestRow.readOnlyInputs, ['package.json', 'package-lock.json']);
  assert.equal(releaseRow.status, 'PASS');
  assert.equal(releaseRow.packageBuild, false);
  assert.equal(releaseRow.packageHashGeneration, false);
  assert.equal(releaseRow.releaseGreen, false);
  assert.equal(state.proof.packageManifestsReadOnly, true);
  assert.equal(state.proof.noPackageBuildNoPackageHash, true);
});

test('b3c16 supply chain: audit taxonomy records OSS pass and limited npm audit without release green', async () => {
  const { evaluateB3C16SupplyChainReleaseScopeState } = await loadModule();
  const state = await evaluateB3C16SupplyChainReleaseScopeState({ repoRoot: REPO_ROOT });
  const byId = new Map(state.auditRows.map((row) => [row.id, row]));

  assert.equal(byId.get('OSS_POLICY_LOCAL_CHECK_PASS').status, 'PASS');
  assert.equal(byId.get('OSS_POLICY_LOCAL_CHECK_PASS').embeddedCheck, 'NO_TIPTAP_PRO_NO_TIPTAP_CLOUD');
  assert.equal(byId.get('NPM_AUDIT_LOCAL_STATUS_RECORDED').status, 'LIMITED');
  assert.equal(byId.get('NPM_AUDIT_LOCAL_STATUS_RECORDED').taxonomy, 'LIMITED_EXTERNAL_COMMAND_RECORDED_SEPARATELY_NOT_RELEASE_GREEN');
  assert.equal(state.B3C16_RELEASE_GREEN_OK, 0);
  assert.equal(state.proof.ossPolicyLocalCheckBound, true);
  assert.equal(state.proof.npmAuditStatusRecorded, true);
  assert.equal(state.proof.limitedAuditCannotSetReleaseGreen, true);
});

test('b3c16 supply chain: required negative rows pass', async () => {
  const { evaluateB3C16SupplyChainReleaseScopeState } = await loadModule();
  const state = await evaluateB3C16SupplyChainReleaseScopeState({ repoRoot: REPO_ROOT });
  const ids = state.negativeRows.map((row) => row.id).sort();

  assert.deepEqual(ids, [
    'DONOR_DEPENDENCY_CLAIM_NEGATIVE',
    'FORBIDDEN_CLOUD_DEPENDENCY_NEGATIVE',
    'FORBIDDEN_PRO_DEPENDENCY_NEGATIVE',
    'FORBIDDEN_STATE_MANAGER_NEGATIVE',
    'FORBIDDEN_UI_FRAMEWORK_NEGATIVE',
    'MULTIPLE_DOCX_LIB_NEGATIVE',
    'PACKAGE_BUILD_NEGATIVE',
    'PACKAGE_HASH_NEGATIVE',
    'PACKAGE_MANIFEST_CHANGE_NEGATIVE',
    'RELEASE_GREEN_FALSE_NEGATIVE',
  ]);
  assert.equal(state.negativeRows.every((row) => row.status === 'PASS'), true);
  assert.equal(state.proof.negativeRowsComplete, true);
  assert.equal(state.proof.negativeRowsPass, true);
});

test('b3c16 supply chain: donor archives remain context only', async () => {
  const { evaluateB3C16SupplyChainReleaseScopeState } = await loadModule();
  const state = await evaluateB3C16SupplyChainReleaseScopeState({ repoRoot: REPO_ROOT });

  assert.equal(state.proof.donorIntakeContextOnly, true);
  assert.equal(state.donorIntake.class, 'READ_ONLY_CONTEXT_ONLY');
  assert.equal(state.donorIntake.codeImported, false);
  assert.equal(state.donorIntake.dependencyClaimImported, false);
  assert.equal(state.donorIntake.completionClaimImported, false);
  assert.ok(state.donorIntake.archiveRows.length >= 4);
});

test('b3c16 supply chain: forbidden claims fail evaluation', async () => {
  const { evaluateB3C16SupplyChainReleaseScopeState } = await loadModule();
  const cases = [
    'newDependency',
    'packageManifestChange',
    'packageBuild',
    'packageHashGeneration',
    'releaseGreenClaim',
    'proDependency',
    'cloudDependency',
    'uiFramework',
    'stateManager',
  ];

  for (const key of cases) {
    const state = await evaluateB3C16SupplyChainReleaseScopeState({
      repoRoot: REPO_ROOT,
      forceClaims: { [key]: true },
    });
    assert.equal(state.ok, false, key);
    assert.equal(state.B3C16_SUPPLY_CHAIN_RELEASE_SCOPE_OK, 0, key);
    assert.equal(state.B3C16_RELEASE_GREEN_OK, 0, key);
  }
});

test('b3c16 supply chain: blocking audit and docx overclaim cannot pass', async () => {
  const { evaluateB3C16SupplyChainReleaseScopeState } = await loadModule();
  const auditFail = await evaluateB3C16SupplyChainReleaseScopeState({
    repoRoot: REPO_ROOT,
    forceClaims: { npmAuditHighOrCritical: true },
  });
  const docxFail = await evaluateB3C16SupplyChainReleaseScopeState({
    repoRoot: REPO_ROOT,
    forceClaims: { multipleDocxLibs: true },
  });
  const donorFail = await evaluateB3C16SupplyChainReleaseScopeState({
    repoRoot: REPO_ROOT,
    forceClaims: { donorDependencyClaimImported: true },
  });

  assert.equal(auditFail.ok, false);
  assert.equal(auditFail.failRows.includes('AUDIT_ROWS_BLOCKING_FAIL'), true);
  assert.equal(docxFail.ok, false);
  assert.equal(docxFail.failRows.includes('DEPENDENCY_ROWS_FAILED'), true);
  assert.equal(donorFail.ok, false);
  assert.equal(donorFail.failRows.includes('NEGATIVE_ROWS_FAILED'), true);
});

test('b3c16 supply chain: scope flags reject adjacent layer drift', async () => {
  const { evaluateB3C16SupplyChainReleaseScopeState } = await loadModule();
  const state = await evaluateB3C16SupplyChainReleaseScopeState({ repoRoot: REPO_ROOT });

  assert.equal(state.scope.packageManifestChange, false);
  assert.equal(state.scope.newDependency, false);
  assert.equal(state.scope.uiChange, false);
  assert.equal(state.scope.storageChange, false);
  assert.equal(state.scope.exportRewrite, false);
  assert.equal(state.scope.securityRewrite, false);
  assert.equal(state.scope.perfFix, false);
  assert.equal(state.scope.xplatCertification, false);
  assert.equal(state.scope.a11yCertification, false);
  assert.equal(state.scope.packageBuild, false);
  assert.equal(state.scope.packageHashGeneration, false);
  assert.equal(state.scope.releaseGreenClaim, false);
});
