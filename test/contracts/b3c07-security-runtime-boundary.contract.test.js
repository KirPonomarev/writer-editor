const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const {
  FAIL_SIGNAL,
  HELPER_ROLE,
  SECURITY_NEGATIVE_ROUTES,
  evaluateSecurityRuntimeBoundarySources,
  runSecurityBoundaryNegativeMatrix,
} = require('../../src/security/security-runtime-boundary.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b3c07-security-runtime-boundary-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B3C07_SECURITY_RUNTIME_BOUNDARY_STATUS_V1.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) modulePromise = import(pathToFileURL(MODULE_PATH).href);
  return modulePromise;
}

function readJson(targetPath) {
  return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
}

test('b3c07 security runtime boundary: state artifact equals executable state', async () => {
  const { evaluateB3C07SecurityRuntimeBoundaryState, TOKEN_NAME } = await loadModule();
  const state = await evaluateB3C07SecurityRuntimeBoundaryState({ repoRoot: REPO_ROOT });
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

test('b3c07 security runtime boundary: CLI status remains worktree independent outside repo cwd', () => {
  const result = spawnSync(process.execPath, [MODULE_PATH, '--json'], {
    cwd: os.tmpdir(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);

  const state = JSON.parse(result.stdout);
  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.B3C07_SECURITY_RUNTIME_BOUNDARY_OK, 1);
  assert.deepEqual(state.failRows, []);
  assert.equal(state.repo.repoRootBinding, 'WORKTREE_INDEPENDENT');
});

test('b3c07 security runtime boundary: product sources bind CSP navigation remote code and IPC rows', () => {
  const mainText = fs.readFileSync(path.join(REPO_ROOT, 'src', 'main.js'), 'utf8');
  const preloadText = fs.readFileSync(path.join(REPO_ROOT, 'src', 'preload.js'), 'utf8');
  const boundary = evaluateSecurityRuntimeBoundarySources({ mainText, preloadText });

  assert.equal(boundary.helperRole, HELPER_ROLE);
  assert.equal(boundary.failSignal, FAIL_SIGNAL);
  assert.equal(boundary.cspRows.every((row) => row.passed === true), true, JSON.stringify(boundary.cspRows, null, 2));
  assert.equal(boundary.navigationRows.every((row) => row.passed === true), true, JSON.stringify(boundary.navigationRows, null, 2));
  assert.equal(boundary.remoteCodeRows.every((row) => row.passed === true), true, JSON.stringify(boundary.remoteCodeRows, null, 2));
  assert.equal(boundary.ipcRows.every((row) => row.passed === true), true, JSON.stringify(boundary.ipcRows, null, 2));
  assert.deepEqual(boundary.failedRows, []);
});

test('b3c07 security runtime boundary: navigation remote code IPC and command injection negatives are denied', () => {
  const rows = runSecurityBoundaryNegativeMatrix();
  const byRoute = new Map(rows.map((row) => [row.route, row]));

  for (const route of [
    SECURITY_NEGATIVE_ROUTES.NAVIGATION_HTTP,
    SECURITY_NEGATIVE_ROUTES.NEW_WINDOW,
    SECURITY_NEGATIVE_ROUTES.REMOTE_CODE_EXECUTE_JAVASCRIPT,
    SECURITY_NEGATIVE_ROUTES.REMOTE_CODE_EVAL,
    SECURITY_NEGATIVE_ROUTES.IPC_UNKNOWN_COMMAND,
    SECURITY_NEGATIVE_ROUTES.IPC_INVALID_PAYLOAD,
    SECURITY_NEGATIVE_ROUTES.IPC_PATH_ESCAPE,
    SECURITY_NEGATIVE_ROUTES.IPC_COMMAND_INJECTION,
  ]) {
    assert.equal(byRoute.get(route)?.denied, true, `route must be denied: ${route}`);
  }
});

test('b3c07 security runtime boundary: state binds B3C05 and B3C06 inputs', async () => {
  const { evaluateB3C07SecurityRuntimeBoundaryState } = await loadModule();
  const state = await evaluateB3C07SecurityRuntimeBoundaryState({ repoRoot: REPO_ROOT });

  assert.equal(state.proof.b3c05InputBound, true);
  assert.equal(state.proof.b3c06InputBound, true);
  assert.equal(state.proof.invalidPayloadPathEscapeAndCommandInjectionDenied, true);
  assert.equal(state.proof.noMainPreloadIpcRewrite, true);
  assert.equal(state.proof.noPermissionManifestRewrite, true);
  assert.equal(state.proof.noNetworkDenyMonitorRewrite, true);
});

test('b3c07 security runtime boundary: scope flags reject B3C08 release storage export and UI claims', async () => {
  const { evaluateB3C07SecurityRuntimeBoundaryState } = await loadModule();
  const state = await evaluateB3C07SecurityRuntimeBoundaryState({ repoRoot: REPO_ROOT });

  assert.equal(state.scope.proofHelperOnly, true);
  assert.equal(state.scope.securityRuntimeBoundaryOnly, true);
  assert.equal(state.scope.cspWidened, false);
  assert.equal(state.scope.navigationPolicyWidened, false);
  assert.equal(state.scope.ipcAllowlistWidened, false);
  assert.equal(state.scope.mainPreloadRuntimeChanged, false);
  assert.equal(state.scope.permissionScopeRewritten, false);
  assert.equal(state.scope.networkRuntimeMonitorRewritten, false);
  assert.equal(state.scope.storageMutated, false);
  assert.equal(state.scope.exportPipelineRewritten, false);
  assert.equal(state.scope.b3c08SupportBundlePrivacyClaim, false);
  assert.equal(state.scope.uiTouched, false);
  assert.equal(state.scope.releaseClaim, false);
});
