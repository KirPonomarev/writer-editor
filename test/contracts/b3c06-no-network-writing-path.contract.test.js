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
  NETWORK_ROUTES,
  runNetworkNegativeMatrix,
  runWithNetworkDenyMonitor,
  runWritingPathReplayUnderDenyMonitor,
} = require('../../src/security/network-deny-monitor.js');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b3c06-no-network-writing-path-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B3C06_NO_NETWORK_WRITING_PATH_STATUS_V1.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) modulePromise = import(pathToFileURL(MODULE_PATH).href);
  return modulePromise;
}

function readJson(targetPath) {
  return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
}

test('b3c06 no network writing path: state artifact equals executable state', async () => {
  const { evaluateB3C06NoNetworkWritingPathState, TOKEN_NAME } = await loadModule();
  const state = await evaluateB3C06NoNetworkWritingPathState({ repoRoot: REPO_ROOT });
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
  assert.equal(state.runtime.writingPathReplay.replayKind, 'BOUNDED_LOCAL_RUNTIME_REPLAY');
  assert.equal(state.runtime.writingPathReplay.openStep, true);
  assert.equal(state.runtime.writingPathReplay.editStep, true);
  assert.equal(state.runtime.writingPathReplay.saveStep, true);
  assert.equal(state.runtime.writingPathReplay.exportStep, true);
  assert.equal(state.runtime.writingPathReplay.storageMutationScope, 'TEMP_FIXTURE_ONLY');
});

test('b3c06 no network writing path: CLI status remains worktree independent outside repo cwd', () => {
  const result = spawnSync(process.execPath, [MODULE_PATH, '--json'], {
    cwd: os.tmpdir(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);

  const state = JSON.parse(result.stdout);
  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.B3C06_NO_NETWORK_WRITING_PATH_OK, 1);
  assert.deepEqual(state.failRows, []);
  assert.equal(state.repo.repoRootBinding, 'WORKTREE_INDEPENDENT');
});

test('b3c06 no network writing path: open edit save export replay records zero outbound attempts', async () => {
  const replay = await runWritingPathReplayUnderDenyMonitor();

  assert.equal(replay.ok, true, JSON.stringify(replay, null, 2));
  assert.equal(replay.artifact.helperRole, HELPER_ROLE);
  assert.equal(replay.artifact.outboundAttemptCount, 0);
  assert.equal(replay.artifact.zeroOutboundAttempts, true);
  assert.deepEqual(replay.result.steps, ['open', 'edit', 'save', 'export']);
  assert.equal(replay.result.storageMutated, false);
  assert.equal(replay.result.exportPipelineRewritten, false);
  assert.equal(replay.result.uiTouched, false);
});

test('b3c06 no network writing path: fetch websocket http https and future routes are denied', async () => {
  const matrix = await runNetworkNegativeMatrix();
  const byRoute = new Map(matrix.map((row) => [row.route, row]));

  for (const route of [
    NETWORK_ROUTES.FETCH,
    NETWORK_ROUTES.WEBSOCKET,
    NETWORK_ROUTES.XML_HTTP_REQUEST,
    NETWORK_ROUTES.HTTP_REQUEST,
    NETWORK_ROUTES.HTTPS_REQUEST,
    NETWORK_ROUTES.HTTP_GET,
    NETWORK_ROUTES.HTTPS_GET,
    NETWORK_ROUTES.REMOTE_IMAGE,
    NETWORK_ROUTES.UPDATE_CHECK,
    NETWORK_ROUTES.ANALYTICS,
    NETWORK_ROUTES.CLOUD_SYNC,
  ]) {
    assert.equal(byRoute.get(route)?.denied, true, `route must be denied: ${route}`);
    assert.equal(byRoute.get(route)?.failSignal, FAIL_SIGNAL);
  }
});

test('b3c06 no network writing path: monitor restores patched globals and node http hooks', async () => {
  const beforeFetch = globalThis.fetch;
  const beforeWebSocket = globalThis.WebSocket;
  const beforeXmlHttpRequest = globalThis.XMLHttpRequest;
  const http = require('node:http');
  const https = require('node:https');
  const beforeHttpRequest = http.request;
  const beforeHttpsRequest = https.request;

  await assert.rejects(
    runWithNetworkDenyMonitor(async () => {
      await globalThis.fetch('https://example.invalid/b3c06-restore');
    }),
    { code: FAIL_SIGNAL },
  );

  assert.equal(globalThis.fetch, beforeFetch);
  assert.equal(globalThis.WebSocket, beforeWebSocket);
  assert.equal(globalThis.XMLHttpRequest, beforeXmlHttpRequest);
  assert.equal(http.request, beforeHttpRequest);
  assert.equal(https.request, beforeHttpsRequest);
});

test('b3c06 no network writing path: scope flags reject release B3C07 storage export and UI claims', async () => {
  const { evaluateB3C06NoNetworkWritingPathState } = await loadModule();
  const state = await evaluateB3C06NoNetworkWritingPathState({ repoRoot: REPO_ROOT });

  assert.equal(state.scope.proofHelperOnly, true);
  assert.equal(state.scope.writingPathNetworkDenialOnly, true);
  assert.equal(state.scope.deliveryNetworkSeparated, true);
  assert.equal(state.scope.storageMutated, false);
  assert.equal(state.scope.storageFormatChanged, false);
  assert.equal(state.scope.exportPipelineRewritten, false);
  assert.equal(state.scope.mainPreloadIpcRewritten, false);
  assert.equal(state.scope.productNetworkStackRewritten, false);
  assert.equal(state.scope.b3c07SecurityRuntimeBoundaryClaim, false);
  assert.equal(state.scope.uiTouched, false);
  assert.equal(state.scope.releaseClaim, false);
});
