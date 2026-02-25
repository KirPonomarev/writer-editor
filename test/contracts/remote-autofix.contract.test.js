const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'remote-autofix-state.mjs');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function failingProbes() {
  return {
    gitLsRemote: { ok: false, stderr: 'Could not resolve host: github.com', stdout: '', exitCode: 128 },
    ghRateLimit: { ok: false, stderr: 'error connecting to api.github.com', stdout: '', exitCode: 1 },
    dnsProbeGithubHost: { ok: false, stderr: 'server cant find github.com', stdout: '', exitCode: 1 },
    httpsProbeApiGithub: { ok: false, stderr: 'curl: (6) Could not resolve host: api.github.com', stdout: '', exitCode: 6 },
  };
}

function passingProbes() {
  return {
    gitLsRemote: { ok: true, stderr: '', stdout: 'ok', exitCode: 0 },
    ghRateLimit: { ok: true, stderr: '', stdout: 'ok', exitCode: 0 },
    dnsProbeGithubHost: { ok: true, stderr: '', stdout: 'ok', exitCode: 0 },
    httpsProbeApiGithub: { ok: true, stderr: '', stdout: 'ok', exitCode: 0 },
  };
}

function noopRepair() {
  return {
    actionsDone: [
      { action: 'dns_cache_refresh', ok: true, exitCode: 0 },
      { action: 'resolver_refresh', ok: true, exitCode: 0 },
      { action: 'proxy_env_normalize', ok: true, exitCode: 0 },
      { action: 'gh_auth_refresh_if_allowed', ok: true, exitCode: 0 },
    ],
  };
}

test('remote autofix: failed probes enforce classify repair reprobe and wait mode after retry budget', async () => {
  const { evaluateRemoteAutofixState } = await loadModule();
  const state = evaluateRemoteAutofixState({
    repoRoot: REPO_ROOT,
    retryIndex: 2,
    maxAutofixCycles: 3,
    backoffSchedule: [2, 5, 15],
    probesInitial: failingProbes(),
    probesAfterRepair: failingProbes(),
    repairRunner: noopRepair,
    baseSha: '30fc112',
    originUrl: 'origin',
  });

  assert.equal(state.loopDecision, 'WAIT_MODE');
  assert.equal(state.retryIndex, 3);
  assert.equal(state.sequence.join('>'), 'probe>classify>repair>reprobe');
  assert.equal(Boolean(state.nextAutoProbeAt), true);
  assert.equal(state.checks.retry_budget_enforced_max_3, true);
  assert.equal(state.checks.wait_mode_entry_rule_enforced, true);
});

test('remote autofix: remote pass triggers auto resume', async () => {
  const { evaluateRemoteAutofixState } = await loadModule();
  const state = evaluateRemoteAutofixState({
    repoRoot: REPO_ROOT,
    retryIndex: 1,
    maxAutofixCycles: 3,
    backoffSchedule: [2, 5, 15],
    probesInitial: passingProbes(),
    repairRunner: noopRepair,
    baseSha: '30fc112',
    originUrl: 'origin',
  });

  assert.equal(state.stopCode, 'NONE');
  assert.equal(state.loopDecision, 'CONTINUE');
  assert.equal(state.autoResumeAfterRemotePass, true);
  assert.equal(state.resumeCondition.includes('remote_available=PASS'), true);
});

test('remote autofix: loop breaker forbids same stop same fingerprint with state delta none', async () => {
  const { evaluateRemoteAutofixState } = await loadModule();
  const baseline = evaluateRemoteAutofixState({
    repoRoot: REPO_ROOT,
    retryIndex: 1,
    maxAutofixCycles: 3,
    backoffSchedule: [2, 5, 15],
    probesInitial: failingProbes(),
    probesAfterRepair: failingProbes(),
    repairRunner: noopRepair,
    baseSha: '30fc112',
    originUrl: 'origin',
  });

  const state = evaluateRemoteAutofixState({
    repoRoot: REPO_ROOT,
    retryIndex: 1,
    maxAutofixCycles: 3,
    backoffSchedule: [2, 5, 15],
    previousStopCode: 'DNS_OR_TLS_FAILURE',
    previousStateFingerprintHash: baseline.stateFingerprintHash,
    previousStateDelta: 'NONE',
    stateDelta: 'NONE',
    probesInitial: failingProbes(),
    probesAfterRepair: failingProbes(),
    repairRunner: noopRepair,
    baseSha: '30fc112',
    originUrl: 'origin',
  });

  assert.equal(state.stopCode, 'E_ROUTE_MATRIX_VIOLATION');
  assert.equal(state.loopBreaker.forbidden, true);
});
