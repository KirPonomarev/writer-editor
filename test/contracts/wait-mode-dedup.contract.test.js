const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'remote-passive-probe-scheduler.mjs');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

test('wait mode dedup: repeated wait without state delta is suppressed', async () => {
  const { evaluateWaitModeEmitRule } = await loadModule();
  const state = evaluateWaitModeEmitRule({
    previousLoopDecision: 'WAIT_MODE',
    currentLoopDecision: 'WAIT_MODE',
    previousFingerprint: 'abc123',
    currentFingerprint: 'abc123',
    stateDelta: 'NONE',
  });

  assert.equal(state.shouldEmitWaitStatus, false);
  assert.equal(state.dedupApplied, true);
});

test('wait mode envelope: next auto probe is required in wait mode', async () => {
  const { validateWaitModeEnvelope } = await loadModule();
  const fail = validateWaitModeEnvelope({
    loopDecision: 'WAIT_MODE',
    nextAutoProbeAt: '',
  });
  const pass = validateWaitModeEnvelope({
    loopDecision: 'WAIT_MODE',
    nextAutoProbeAt: '2026-02-25T06:45:00Z',
  });

  assert.equal(fail.ok, false);
  assert.equal(pass.ok, true);
});

test('backoff schedule: retry indexes map to 2 5 15 minutes', async () => {
  const { computeNextAutoProbeAt } = await loadModule();
  const base = '2026-02-25T06:00:00.000Z';
  const r1 = computeNextAutoProbeAt({ nowIso: base, retryIndex: 1, backoffSchedule: [2, 5, 15] });
  const r2 = computeNextAutoProbeAt({ nowIso: base, retryIndex: 2, backoffSchedule: [2, 5, 15] });
  const r3 = computeNextAutoProbeAt({ nowIso: base, retryIndex: 3, backoffSchedule: [2, 5, 15] });

  assert.equal(r1.backoffMinutes, 2);
  assert.equal(r2.backoffMinutes, 5);
  assert.equal(r3.backoffMinutes, 15);
});
