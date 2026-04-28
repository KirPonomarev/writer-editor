const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'main-sync-c02-mergeability-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'MAIN_SYNC_C02_MERGEABILITY_STATUS_V1.json');
const SUMMARY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'MAIN_SYNC_C02', 'TICKET_01', 'mergeability-summary.json');
const PRE_PR_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EVIDENCE', 'MAIN_SYNC_C02', 'TICKET_01', 'pre-pr-verification.json');

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

test('main sync c02 mergeability: status metadata and report agree on exact unrelated-histories blocker', async () => {
  const { evaluateMainSyncC02MergeabilityState, TOKEN_NAME } = await loadModule();
  const packet = readJson(STATUS_PATH);
  const summary = readJson(SUMMARY_PATH);
  const prePr = readJson(PRE_PR_PATH);
  const state = evaluateMainSyncC02MergeabilityState({ repoRoot: REPO_ROOT });

  assert.equal(packet.version, 1);
  assert.equal(packet.status, 'FAILED');
  assert.equal(packet.token, TOKEN_NAME);
  assert.equal(state.ok, false);
  assert.equal(state[TOKEN_NAME], 0);
  assert.equal(state.failReason, 'BLOCKING_UNRELATED_HISTORIES');
  assert.equal(state.boundRefs.mainSha, '0d6955c1bd8ccbae425510b0c07e2b0edf445130');
  assert.equal(state.boundRefs.rootSha, '33e9c027ea24fbd01c0eaf4519fa2a7c2ec530d6');
  assert.equal(state.checks.c01StatusActive, true);
  assert.equal(state.checks.c01SummaryOk, true);
  assert.equal(state.checks.c01RootAncestor, true);
  assert.equal(state.checks.localHeadDescendsFromBoundRoot, true);
  assert.equal(state.probe.mergeBaseFound, false);
  assert.equal(state.probe.mergeabilityClass, 'BLOCKING_UNRELATED_HISTORIES');
  assert.equal(state.probe.conflictCount, 0);
  assert.match(state.probe.mergeStderr, /unrelated histories/u);
  assert.equal(state.probe.cleanupOk, true);

  assert.equal(summary.ok, false);
  assert.equal(summary.failReason, 'BLOCKING_UNRELATED_HISTORIES');
  assert.equal(summary.probe.mergeabilityClass, 'BLOCKING_UNRELATED_HISTORIES');
  assert.equal(prePr.ok, true);
  assert.equal(prePr.commandCount, 5);
  assert.deepEqual(prePr.failingChecks, []);
});

test('main sync c02 mergeability: invalid root sha fails machine checks', async () => {
  const { evaluateMainSyncC02MergeabilityState, TOKEN_NAME } = await loadModule();
  const state = evaluateMainSyncC02MergeabilityState({
    repoRoot: REPO_ROOT,
    rootSha: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  });

  assert.equal(state.ok, false);
  assert.equal(state[TOKEN_NAME], 0);
  assert.equal(state.failSignalCode, 'E_MAIN_SYNC_C02_MERGEABILITY_RED');
  assert.ok(state.issues.some((entry) => entry.code === 'ROOT_SHA_UNREADABLE'));
});

test('main sync c02 mergeability: repeatability is stable across three runs on comparable blocker facts', async () => {
  const { evaluateMainSyncC02MergeabilityState } = await loadModule();

  const runs = [];
  for (let i = 0; i < 3; i += 1) {
    const state = evaluateMainSyncC02MergeabilityState({ repoRoot: REPO_ROOT });
    runs.push({
      ok: state.ok,
      failReason: state.failReason,
      checks: state.checks,
      c01Rebind: state.c01Rebind,
      probe: {
        mergeBaseFound: state.probe.mergeBaseFound,
        mergeabilityClass: state.probe.mergeabilityClass,
        conflictCount: state.probe.conflictCount,
        cleanupOk: state.probe.cleanupOk,
        mergeStderr: state.probe.mergeStderr,
      },
    });
  }

  assert.deepEqual(runs[0], runs[1]);
  assert.deepEqual(runs[1], runs[2]);
  assert.equal(runs[0].ok, false);
  assert.equal(runs[0].probe.mergeabilityClass, 'BLOCKING_UNRELATED_HISTORIES');
});
