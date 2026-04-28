const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const {
  DEFAULT_PERMISSION_MANIFEST,
  FAIL_SIGNAL,
  PERMISSION_ACTIONS,
  decidePermissionScope,
} = require('../../src/security/permission-scope.js');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b3c05-permission-scope-enforced-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B3C05_PERMISSION_SCOPE_ENFORCED_STATUS_V1.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) modulePromise = import(pathToFileURL(MODULE_PATH).href);
  return modulePromise;
}

function readJson(targetPath) {
  return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
}

function request(action, channel, requestedPermission, payload) {
  return { action, channel, requestedPermission, payload };
}

test('b3c05 permission scope: state artifact equals executable state', async () => {
  const { evaluateB3C05PermissionScopeEnforcedState, TOKEN_NAME } = await loadModule();
  const state = await evaluateB3C05PermissionScopeEnforcedState({ repoRoot: REPO_ROOT });
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

test('b3c05 permission scope: CLI status remains worktree independent outside repo cwd', () => {
  const result = spawnSync(process.execPath, [MODULE_PATH, '--json'], {
    cwd: os.tmpdir(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);

  const state = JSON.parse(result.stdout);
  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.B3C05_PERMISSION_SCOPE_ENFORCED_OK, 1);
  assert.deepEqual(state.failRows, []);
  assert.equal(state.repo.repoRootBinding, 'WORKTREE_INDEPENDENT');
});

test('b3c05 permission scope: allowed write decisions do not mutate storage or become runtime enforcer', () => {
  const result = decidePermissionScope(request(
    PERMISSION_ACTIONS.EXPORT_WRITE,
    'export:write',
    PERMISSION_ACTIONS.EXPORT_WRITE,
    { outPath: 'exports/book.docx' },
  ));

  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(result.decision.normalizedPayload.outPath, 'exports/book.docx');
  assert.equal(result.decision.proofOnly, true);
  assert.equal(result.decision.storageMutated, false);
  assert.equal(result.decision.runtimeEnforcer, false);
  assert.equal(result.decision.releaseClaim, false);
  assert.equal(DEFAULT_PERMISSION_MANIFEST.role, 'PROOF_HELPER_NOT_RUNTIME_ENFORCER');
});

test('b3c05 permission scope: off-manifest privileged calls fail with deny events', () => {
  const broad = decidePermissionScope(request(
    PERMISSION_ACTIONS.PROJECT_READ,
    'project:read',
    'filesystem.broad',
    { projectPath: 'projects/book', scope: 'all-files' },
  ));
  const shell = decidePermissionScope(request('shell.exec', 'shell:command', 'shell.command', { command: 'rm' }));
  const remote = decidePermissionScope(request('remote.code', 'remote:code', 'remote.code', { url: 'remote.js' }));
  const network = decidePermissionScope(request('network.fetch', 'network:outbound', 'network.outbound', { url: 'remote' }));

  for (const result of [broad, shell, remote, network]) {
    assert.equal(result.ok, false);
    assert.equal(result.failSignal, FAIL_SIGNAL);
    assert.equal(result.reason, 'FORBIDDEN_PERMISSION_SCOPE');
    assert.equal(typeof result.denyEvent.reason, 'string');
  }
});

test('b3c05 permission scope: unknown channel invalid payload and path escape are denied', () => {
  const unknown = decidePermissionScope(request(
    PERMISSION_ACTIONS.PROJECT_READ,
    'project:unknown',
    PERMISSION_ACTIONS.PROJECT_READ,
    { projectPath: 'projects/book' },
  ));
  const invalidPayload = decidePermissionScope(request(
    PERMISSION_ACTIONS.PROJECT_WRITE,
    'project:write',
    PERMISSION_ACTIONS.PROJECT_WRITE,
    null,
  ));
  const pathEscape = decidePermissionScope(request(
    PERMISSION_ACTIONS.EXPORT_WRITE,
    'export:write',
    PERMISSION_ACTIONS.EXPORT_WRITE,
    { outPath: '../book.docx' },
  ));

  assert.equal(unknown.ok, false);
  assert.equal(unknown.reason, 'CHANNEL_NOT_ALLOWED');
  assert.equal(invalidPayload.ok, false);
  assert.equal(invalidPayload.reason, 'PATH_FIELD_MISSING');
  assert.equal(pathEscape.ok, false);
  assert.equal(pathEscape.reason, 'PATH_SCOPE_DENIED');
});

test('b3c05 permission scope: scope flags reject B3C06 B3C07 release and UI claims', async () => {
  const { evaluateB3C05PermissionScopeEnforcedState } = await loadModule();
  const state = await evaluateB3C05PermissionScopeEnforcedState({ repoRoot: REPO_ROOT });

  assert.equal(state.scope.permissionDecisionOnly, true);
  assert.equal(state.scope.mainPreloadIpcRewritten, false);
  assert.equal(state.scope.runtimeSecurityBoundaryClaim, false);
  assert.equal(state.scope.storageMutated, false);
  assert.equal(state.scope.networkRuntimeMonitorClaim, false);
  assert.equal(state.scope.b3c06NetworkClaim, false);
  assert.equal(state.scope.b3c07SecurityGreenClaim, false);
  assert.equal(state.scope.uiTouched, false);
  assert.equal(state.scope.releaseClaim, false);
});
