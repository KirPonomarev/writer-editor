import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { canonicalDigest } from '../../scripts/ops/r24/canonical-json.mjs';
import { initPlanState, readPlanState, casUpdate, transitionContour } from '../../scripts/ops/r24/plan-state.mjs';
import { acquireLease } from '../../scripts/ops/r24/lease.mjs';
import { runAdmittedContour, runScheduledContour, observeAdmittedContour } from '../../scripts/ops/r24/corrective/rcv00f-resumable-executor.mjs';
import { prepare, host } from '../fixtures/r24-rcv00f-host.mjs';
import { main } from '../../scripts/ops/r24/executable-program.mjs';

const NOW = '2026-09-12T20:00:00.000Z';
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'r24-rcv00f-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const filePath = path.join(root, 'plan.json');
  initPlanState(filePath);
  const lease = acquireLease(filePath, { contourId: 'F', writerId: 'W', missionId: 'M', ttlMs: 3600000, now: NOW, expectedRevision: 0 });
  const identity = { runId: 'RUN', contourId: 'F', attemptId: 'A', writerId: 'W', fencingToken: lease.result.lease.fencingToken,
    headSha: 'a'.repeat(40), treeSha: 'b'.repeat(40), admissionDigest: 'c'.repeat(64) };
  for (const to of ['ELIGIBLE', 'RUNNING']) transitionContour(filePath, { ...identity, to, expectedRevision: readPlanState(filePath).revision,
    idempotencyKey: to, now: NOW });
  const effects = new Map();
  const calls = [];
  const receipt = (request, status = 'APPLIED') => ({ status, bindingDigest: request.bindingDigest,
    stepId: request.reservation.stepId, effectIdempotencyKey: request.reservation.effectIdempotencyKey,
    evidenceDigest: canonicalDigest({ step: request.reservation.stepId, status }), reasonCode: status });
  const options = { filePath, identity, steps: ['IMPLEMENT', 'PROVE', 'DELIVER'], now: NOW,
    admissionPort: { revalidate: (request) => ({ status: 'ADMITTED', requestDigest: canonicalDigest(request) }) },
    controlPort: { read: () => 'CONTINUE' },
    effectPort: {
      execute(request) { calls.push(['execute', request.reservation.stepId]); const r = receipt(request); effects.set(r.effectIdempotencyKey, r); return r; },
      reconcile(request) { calls.push(['reconcile', request.reservation.stepId]); return effects.get(request.reservation.effectIdempotencyKey) ?? receipt(request, 'NOT_APPLIED_FINAL'); }
    },
    receiptPort: {
      verify(r, request) { calls.push(['verify', r.status]); return canonicalDigest(r) === canonicalDigest(receipt(request, r.status)); }
    }
  };
  return { root, options, effects, calls, receipt };
}

test('F positive drives all routine steps once with immutable requests and durable receipts', (t) => {
  const f = fixture(t);
  const verify = f.options.admissionPort.revalidate;
  f.options.admissionPort.revalidate = (request) => { assert.ok(Object.isFrozen(request)); assert.ok(Object.isFrozen(request.identity)); return verify(request); };
  const run = runAdmittedContour(f.options);
  assert.equal(run.phase, 'DONE');
  assert.equal(run.cursor, 3);
  assert.equal(f.effects.size, 3);
  assert.equal(f.calls.filter(([op]) => op === 'execute').length, 3);
  const bytes = fs.readFileSync(f.options.filePath);
  assert.deepEqual(runAdmittedContour(f.options), run);
  assert.deepEqual(fs.readFileSync(f.options.filePath), bytes);
});

test('F negative no admission rejects before any write or effect', (t) => {
  const f = fixture(t);
  const before = fs.readFileSync(f.options.filePath);
  f.options.admissionPort.revalidate = (r) => ({ status: 'WAIT_OWNER', requestDigest: canonicalDigest(r) });
  assert.equal(runAdmittedContour(f.options).phase, 'WAIT_OWNER');
  assert.equal(f.calls.length, 0);
  assert.deepEqual(fs.readFileSync(f.options.filePath), before);
});

test('F negative stale admission cannot publish or dispatch', (t) => {
  const f = fixture(t);
  const before = fs.readFileSync(f.options.filePath);
  f.options.admissionPort.revalidate = () => ({ status: 'ADMITTED', requestDigest: '0'.repeat(64) });
  assert.throws(() => runAdmittedContour(f.options), { code: 'E_RCV00F_ADMISSION_STALE' });
  assert.equal(f.calls.length, 0);
  assert.deepEqual(fs.readFileSync(f.options.filePath), before);
});

test('F negative failed independent receipt oracle retains reservation and never advances', (t) => {
  const f = fixture(t);
  f.options.receiptPort.verify = () => false;
  assert.throws(() => runAdmittedContour(f.options), { code: 'E_RCV00F_RECEIPT_ORACLE' });
  const run = readPlanState(f.options.filePath).rcv00fRun;
  assert.equal(run.cursor, 0);
  assert.equal(run.phase, 'RESERVED');
  assert.equal(f.effects.size, 1);
});

test('F negative crash after effect resumes through reconciliation without executing it twice', (t) => {
  const f = fixture(t);
  const execute = f.options.effectPort.execute;
  f.options.effectPort.execute = (r) => { execute(r); throw new Error('CRASH_AFTER_EFFECT'); };
  assert.throws(() => runAdmittedContour(f.options), /CRASH_AFTER_EFFECT/);
  assert.equal(readPlanState(f.options.filePath).rcv00fRun.phase, 'RESERVED');
  f.options.effectPort.execute = execute;
  assert.equal(runAdmittedContour(f.options).phase, 'DONE');
  assert.equal(f.calls.filter(([op]) => op === 'execute').length, 3);
  assert.ok(f.calls.some(([op, step]) => op === 'reconcile' && step === 'IMPLEMENT'));
});

test('F observer is read-only and suppresses unchanged state at the ten-minute boundary', (t) => {
  const f = fixture(t);
  runAdmittedContour(f.options);
  const before = fs.readFileSync(f.options.filePath);
  const first = observeAdmittedContour(f.options.filePath, { now: NOW });
  assert.equal(first.notify, true);
  const early = observeAdmittedContour(f.options.filePath, { now: '2026-09-12T20:09:59.999Z', previous: first.cursor });
  assert.equal(early.due, false);
  const due = observeAdmittedContour(f.options.filePath, { now: '2026-09-12T20:10:00.000Z', previous: first.cursor });
  assert.equal(due.due, true);
  assert.equal(due.notify, false);
  assert.deepEqual(fs.readFileSync(f.options.filePath), before);
});

function childFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'r24-rcv00f-child-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const filePath = prepare(root);
  const child = (mode) => spawnSync(process.execPath, [fileURLToPath(new URL('../fixtures/r24-rcv00f-host.mjs', import.meta.url)), root, mode], { encoding: 'utf8', timeout: 15000 });
  return { root, filePath, child };
}

for (const [mode, exitCode, initialCount] of [['BEFORE_EFFECT', 71, 0], ['AFTER_EFFECT', 72, 1]]) {
  test(`F executable entrypoint child crash ${mode} resumes durable scheduler selection exactly once`, (t) => {
    const f = childFixture(t);
    const crashed = f.child(mode);
    assert.equal(crashed.status, exitCode, crashed.stderr);
    assert.equal(crashed.signal, null);
    const state = readPlanState(f.filePath);
    assert.equal(state.rcv00fSelection.selection.selectedId, 'F');
    assert.equal(state.rcv00fSelection.selection.mode, 'AUTONOMOUS');
    assert.equal(state.rcv00fRun.phase, 'RESERVED');
    assert.equal(state.rcv00fRun.cursor, 0);
    assert.equal(fs.readdirSync(path.join(f.root, 'effects')).length, initialCount);
    const resumed = f.child('NORMAL');
    assert.equal(resumed.status, 0, resumed.stderr);
    const done = readPlanState(f.filePath);
    assert.equal(done.rcv00fRun.phase, 'DONE');
    assert.equal(done.rcv00fRun.cursor, 3);
    assert.equal(done.contours.NEXT, undefined);
    const observations = fs.readFileSync(path.join(f.root, 'effects-observed.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.deepEqual(observations.map((r) => r.stepId), ['IMPLEMENT', 'PROVE', 'DELIVER']);
    assert.equal(new Set(observations.map((r) => r.effectIdempotencyKey)).size, 3);
    assert.deepEqual(done.rcv00fRun.receipts.map((r) => r.evidenceDigest), observations.map(canonicalDigest));
    const bytes = fs.readFileSync(f.filePath);
    assert.equal(f.child('NORMAL').status, 0);
    assert.deepEqual(fs.readFileSync(f.filePath), bytes);
  });
}

test('F scheduled entrypoint refuses HANDOFF_ONLY selection without creating a run', (t) => {
  const f = childFixture(t);
  const executor = host(f.root);
  executor.mission.autonomyEnabled = false;
  const before = fs.readFileSync(f.filePath);
  assert.throws(() => main(['--drive-one', '--now', NOW], { executor }), { code: 'E_RCV00F_SCHEDULER_SELECTION' });
  assert.deepEqual(fs.readFileSync(f.filePath), before);
});

test('F entrypoint requires trusted host ports and cannot load them from CLI payload', () => {
  assert.throws(() => main(['--drive-one', '--host', 'payload.mjs']), { code: 'E_RCV00F_TRUSTED_HOST_REQUIRED' });
});

for (const [wait, expectedPhase] of [['WAIT_OWNER', 'WAIT_OWNER'], ['WAIT_EXTERNAL', 'BLOCKED_TYPED']]) {
  test(`F durable ${expectedPhase} resumes only after external fact reconciliation`, (t) => {
    const f = childFixture(t);
    fs.writeFileSync(path.join(f.root, 'control.json'), JSON.stringify({ action: 'CONTINUE', wait }));
    assert.equal(f.child('NORMAL').status, 0);
    assert.equal(readPlanState(f.filePath).rcv00fRun.phase, expectedPhase);
    assert.equal(fs.readdirSync(path.join(f.root, 'effects')).length, 0);
    fs.writeFileSync(path.join(f.root, 'control.json'), JSON.stringify({ action: 'CONTINUE' }));
    const resume = f.child('NORMAL');
    assert.equal(resume.status, 0, resume.stderr);
    assert.equal(readPlanState(f.filePath).rcv00fRun.phase, 'DONE');
  });
}

test('F stop preserves pending reservation and explicit resume reconciles it', (t) => {
  const f = childFixture(t);
  assert.equal(f.child('BEFORE_EFFECT').status, 71);
  const reservation = readPlanState(f.filePath).rcv00fRun.reservation;
  fs.writeFileSync(path.join(f.root, 'control.json'), JSON.stringify({ action: 'STOP' }));
  assert.equal(f.child('NORMAL').status, 0);
  assert.equal(readPlanState(f.filePath).rcv00fRun.phase, 'STOPPED');
  assert.deepEqual(readPlanState(f.filePath).rcv00fRun.reservation, reservation);
  fs.writeFileSync(path.join(f.root, 'control.json'), JSON.stringify({ action: 'CONTINUE' }));
  assert.equal(f.child('NORMAL').status, 0);
  assert.equal(fs.readdirSync(path.join(f.root, 'effects')).length, 0);
  const executor = { ...host(f.root), resumeStopped: true };
  assert.equal(main(['--drive-one', '--now', NOW], { executor }).phase, 'DONE');
});

test('F revoke is terminal and preserves prior effects and pending work', (t) => {
  const f = childFixture(t);
  assert.equal(f.child('AFTER_EFFECT').status, 72);
  fs.writeFileSync(path.join(f.root, 'control.json'), JSON.stringify({ action: 'REVOKE' }));
  assert.equal(f.child('NORMAL').status, 0);
  assert.equal(readPlanState(f.filePath).rcv00fRun.phase, 'REVOKED');
  assert.equal(readPlanState(f.filePath).rcv00fRun.cursor, 1);
  assert.equal(readPlanState(f.filePath).rcv00fRun.receipts[0].status, 'APPLIED');
  assert.equal(readPlanState(f.filePath).rcv00fRun.reservation, null);
  const before = fs.readFileSync(f.filePath);
  fs.writeFileSync(path.join(f.root, 'control.json'), JSON.stringify({ action: 'CONTINUE' }));
  assert.equal(main(['--drive-one', '--now', NOW], { executor: { ...host(f.root), resumeStopped: true } }).phase, 'REVOKED');
  assert.deepEqual(fs.readFileSync(f.filePath), before);
  assert.equal(fs.readdirSync(path.join(f.root, 'effects')).length, 1);
});

test('F child BEFORE_EFFECT then REVOKE verifies final absence and never executes', (t) => {
  const f = childFixture(t);
  assert.equal(f.child('BEFORE_EFFECT').status, 71);
  fs.writeFileSync(path.join(f.root, 'control.json'), JSON.stringify({ action: 'REVOKE' }));
  const revoke = f.child('NORMAL');
  assert.equal(revoke.status, 0, revoke.stderr);
  const run = readPlanState(f.filePath).rcv00fRun;
  assert.equal(run.phase, 'REVOKED');
  assert.equal(run.cursor, 0);
  assert.equal(run.reservationOutcome.status, 'NOT_APPLIED_FINAL');
  assert.equal(fs.readdirSync(path.join(f.root, 'effects')).length, 0);
  assert.equal(fs.existsSync(path.join(f.root, 'effects-observed.jsonl')), false);
});

test('F revoke with uncertain reservation remains durably blocked and latched across restart', (t) => {
  const f = childFixture(t);
  assert.equal(f.child('BEFORE_EFFECT').status, 71);
  fs.writeFileSync(path.join(f.root, 'control.json'), JSON.stringify({ action: 'REVOKE', wait: 'WAIT_EXTERNAL' }));
  const uncertain = f.child('NORMAL');
  assert.equal(uncertain.status, 0, uncertain.stderr);
  let run = readPlanState(f.filePath).rcv00fRun;
  assert.equal(run.phase, 'BLOCKED_TYPED');
  assert.equal(run.pendingControl, 'REVOKE');
  fs.writeFileSync(path.join(f.root, 'control.json'), JSON.stringify({ action: 'CONTINUE' }));
  const settled = f.child('NORMAL');
  assert.equal(settled.status, 0, settled.stderr);
  run = readPlanState(f.filePath).rcv00fRun;
  assert.equal(run.phase, 'REVOKED');
  assert.equal(run.cursor, 0);
  assert.equal(fs.readdirSync(path.join(f.root, 'effects')).length, 0);
});

test('F negative second writer and stale global fence cannot dispatch', (t) => {
  const f = fixture(t);
  const before = fs.readFileSync(f.options.filePath);
  assert.throws(() => runAdmittedContour({ ...f.options, identity: { ...f.options.identity, writerId: 'OTHER' } }), { code: 'E_LEASE_WRITER_MISMATCH' });
  assert.deepEqual(fs.readFileSync(f.options.filePath), before);
  const state = readPlanState(f.options.filePath);
  casUpdate(f.options.filePath, { expectedRevision: state.revision, mutate(draft) { draft.fencingCounter += 1; } });
  assert.throws(() => runAdmittedContour(f.options), { code: 'E_RCV00F_GLOBAL_FENCE' });
  assert.equal(f.calls.length, 0);
});

test('F negative expired holder cannot dispatch', (t) => {
  const f = fixture(t);
  assert.throws(() => runAdmittedContour({ ...f.options, now: '2026-09-12T21:00:00.000Z' }), { code: 'E_LEASE_EXPIRED' });
  assert.equal(f.calls.length, 0);
});

test('F negative state mutation during effect blocks stale receipt publication', (t) => {
  const f = fixture(t);
  const execute = f.options.effectPort.execute;
  f.options.effectPort.execute = (request) => {
    const r = execute(request);
    casUpdate(f.options.filePath, { expectedRevision: readPlanState(f.options.filePath).revision, mutate(draft) { draft.unrelatedMarker = 'preserve'; } });
    return r;
  };
  assert.throws(() => runAdmittedContour(f.options), { code: 'E_RCV00F_STALE_PUBLICATION' });
  assert.equal(readPlanState(f.options.filePath).rcv00fRun.cursor, 0);
  assert.equal(readPlanState(f.options.filePath).unrelatedMarker, 'preserve');
});

test('F negative post-effect admission revocation leaves the durable reservation untouched', (t) => {
  const f = fixture(t);
  f.options.admissionPort.revalidate = (r) => ({ status: r.action === 'PUBLISH_VERIFIED_RECEIPT' ? 'REVOKED' : 'ADMITTED', requestDigest: canonicalDigest(r) });
  assert.equal(runAdmittedContour(f.options).phase, 'BLOCKED_TYPED');
  assert.equal(readPlanState(f.options.filePath).rcv00fRun.phase, 'RESERVED');
  assert.equal(readPlanState(f.options.filePath).rcv00fRun.cursor, 0);
});

test('F observer reports one meaningful transition and ignores unrelated CAS churn', (t) => {
  const f = childFixture(t);
  assert.equal(f.child('BEFORE_EFFECT').status, 71);
  const first = observeAdmittedContour(f.filePath, { now: NOW });
  casUpdate(f.filePath, { expectedRevision: readPlanState(f.filePath).revision, mutate(draft) { draft.heartbeatOnly = 'unchanged-meaning'; } });
  const quiet = observeAdmittedContour(f.filePath, { now: '2026-09-12T20:10:00.000Z', previous: first.cursor });
  assert.equal(quiet.notify, false);
  assert.equal(f.child('NORMAL').status, 0);
  const before = fs.readFileSync(f.filePath);
  const early = main(['--observe-one', '--now', '2026-09-12T20:19:59.999Z'], { executor: { filePath: f.filePath, previous: quiet.cursor } });
  assert.equal(early.notify, false);
  const changed = observeAdmittedContour(f.filePath, { now: '2026-09-12T20:20:00.000Z', previous: quiet.cursor });
  assert.equal(changed.notify, true);
  assert.equal(changed.projection.phase, 'DONE');
  assert.equal(observeAdmittedContour(f.filePath, { now: '2026-09-12T20:30:00.000Z', previous: changed.cursor }).notify, false);
  assert.deepEqual(fs.readFileSync(f.filePath), before);
});

for (const [field, value, code] of [
  ['bindingDigest', '0'.repeat(64), 'RECEIPT_BINDING'],
  ['stepId', 'OTHER', 'RECEIPT_BINDING'],
  ['effectIdempotencyKey', '0'.repeat(64), 'RECEIPT_BINDING'],
  ['status', 'DONE', 'RECEIPT_STATUS'],
  ['evidenceDigest', 'not-a-digest', 'RECEIPT_EVIDENCE'],
  ['reasonCode', '../command', 'RECEIPT_EVIDENCE'],
  ['extra', true, 'RECEIPT_KEYS']
]) {
  test(`F negative receipt ${field} mutation cannot advance durable state`, (t) => {
    const f = fixture(t);
    const execute = f.options.effectPort.execute;
    f.options.effectPort.execute = (r) => ({ ...execute(r), [field]: value });
    assert.throws(() => runAdmittedContour(f.options), { code: `E_RCV00F_${code}` });
    assert.equal(readPlanState(f.options.filePath).rcv00fRun.cursor, 0);
  });
}

for (const field of ['runId', 'contourId', 'writerId', 'headSha', 'treeSha', 'admissionDigest']) {
  test(`F negative restart with different ${field} rejects previous run evidence`, (t) => {
    const f = fixture(t);
    runAdmittedContour(f.options);
    const before = fs.readFileSync(f.options.filePath);
    const current = f.options.identity[field];
    const value = current.length >= 40 ? 'f'.repeat(current.length) : 'OTHER';
    assert.throws(() => runAdmittedContour({ ...f.options, identity: { ...f.options.identity, [field]: value } }), { code: 'E_RCV00F_RUN_BINDING' });
    assert.deepEqual(fs.readFileSync(f.options.filePath), before);
  });
}

test('F negative unbounded steps, numeric identities and accessors reject before mutation', (t) => {
  const f = fixture(t);
  const before = fs.readFileSync(f.options.filePath);
  assert.throws(() => runAdmittedContour({ ...f.options, steps: Array.from({ length: 33 }, (_, i) => `S${i}`) }), { code: 'E_RCV00F_STEP_BOUND' });
  assert.throws(() => runAdmittedContour({ ...f.options, identity: { ...f.options.identity, runId: 123 } }), { code: 'E_RCV00F_IDENTITY_ID' });
  const identity = { ...f.options.identity };
  Object.defineProperty(identity, 'headSha', { enumerable: true, get() { throw new Error('ACCESSOR_MUST_NOT_RUN'); } });
  assert.throws(() => runAdmittedContour({ ...f.options, identity }), { code: 'E_RCV00F_DATA_ACCESSOR' });
  assert.deepEqual(fs.readFileSync(f.options.filePath), before);
});

test('F negative executing port cannot also certify its own receipt', (t) => {
  const f = fixture(t);
  assert.throws(() => runAdmittedContour({ ...f.options, receiptPort: f.options.effectPort }), { code: 'E_RCV00F_INDEPENDENT_RECEIPT_PORT' });
  assert.equal(f.calls.length, 0);
});

test('F negative reentrant executor cannot publish a second effect', (t) => {
  const f = fixture(t);
  const execute = f.options.effectPort.execute;
  f.options.effectPort.execute = (r) => {
    assert.throws(() => runAdmittedContour(f.options), { code: 'E_RCV00F_REENTRANT_EXECUTOR' });
    return execute(r);
  };
  assert.equal(runAdmittedContour(f.options).phase, 'DONE');
  assert.equal(f.effects.size, 3);
});

test('F control received during last effect records it but does not misreport DONE', (t) => {
  const f = fixture(t);
  f.options.steps = ['ONLY'];
  let control = 'CONTINUE';
  const execute = f.options.effectPort.execute;
  f.options.controlPort.read = () => control;
  f.options.effectPort.execute = (r) => { const result = execute(r); control = 'STOP'; return result; };
  const stopped = runAdmittedContour(f.options);
  assert.equal(stopped.phase, 'STOPPED');
  assert.equal(stopped.cursor, 1);
  control = 'CONTINUE';
  assert.equal(runAdmittedContour({ ...f.options, resumeStopped: true }).phase, 'DONE');
  assert.equal(f.calls.filter(([op]) => op === 'execute').length, 1);
});

test('F negative current physical oracle rejects tampered completed effect on restart', (t) => {
  const f = childFixture(t);
  assert.equal(f.child('NORMAL').status, 0);
  const effectFile = path.join(f.root, 'effects', fs.readdirSync(path.join(f.root, 'effects'))[0]);
  const effect = JSON.parse(fs.readFileSync(effectFile));
  effect.stepId = 'WRONG_PHYSICAL_STEP';
  fs.writeFileSync(effectFile, JSON.stringify(effect));
  const before = fs.readFileSync(f.filePath);
  const replay = f.child('NORMAL');
  assert.equal(replay.status, 1);
  assert.match(replay.stderr, /E_RCV00F_RECEIPT_ORACLE/);
  assert.deepEqual(fs.readFileSync(f.filePath), before);
});

test('F negative scheduler resume rejects changed policy instead of selecting another contour', (t) => {
  const f = childFixture(t);
  assert.equal(f.child('BEFORE_EFFECT').status, 71);
  const executor = host(f.root);
  executor.mission.policyEpoch += 1;
  assert.throws(() => main(['--drive-one', '--now', NOW], { executor }), { code: 'E_RCV00F_SCHEDULER_POLICY_DRIFT' });
  assert.equal(fs.readdirSync(path.join(f.root, 'effects')).length, 0);
});

test('F negative observer rejects wrong binding and backwards or shortened interval clocks', (t) => {
  const f = fixture(t);
  runAdmittedContour(f.options);
  const initial = observeAdmittedContour(f.options.filePath, { now: NOW });
  assert.throws(() => observeAdmittedContour(f.options.filePath, { now: NOW, previous: { ...initial.cursor, bindingDigest: 'f'.repeat(64) } }), { code: 'E_RCV00F_OBSERVER_BINDING' });
  assert.throws(() => observeAdmittedContour(f.options.filePath, { now: '2026-09-12T19:59:59.999Z', previous: initial.cursor }), { code: 'E_RCV00F_OBSERVER_CLOCK' });
  assert.throws(() => observeAdmittedContour(f.options.filePath, { now: NOW, previous: { ...initial.cursor, nextDueAt: NOW } }), { code: 'E_RCV00F_OBSERVER_CLOCK' });
});

test('F black-box sparse steps and extra array keys reject before scheduler or any mutation', (t) => {
  const f = childFixture(t);
  const before = fs.readFileSync(f.filePath);
  const sparse = new Array(2);
  sparse[1] = 'PROVE';
  const extra = ['PROVE'];
  extra.untrusted = 'EXECUTE';
  const hidden = ['PROVE'];
  Object.defineProperty(hidden, 'untrusted', { value: 'EXECUTE', enumerable: false });
  for (const steps of [sparse, extra, hidden]) {
    assert.throws(() => main(['--drive-one', '--now', NOW], { executor: { ...host(f.root), steps } }), { code: 'E_RCV00F_DATA_ARRAY_DENSE' });
    assert.deepEqual(fs.readFileSync(f.filePath), before);
    const state = readPlanState(f.filePath);
    assert.equal(state.rcv00fSelection, undefined);
    assert.equal(state.rcv00fRun, undefined);
    assert.equal(fs.readdirSync(path.join(f.root, 'effects')).length, 0);
    assert.equal(fs.existsSync(path.join(f.root, 'effects-observed.jsonl')), false);
  }
});

function stateAlias(f, kind) {
  if (kind === 'double-slash') return `${f.root}//plan.json`;
  if (kind === 'dot') return `${f.root}/./plan.json`;
  if (kind === 'dotdot') {
    fs.mkdirSync(path.join(f.root, 'child'));
    return `${f.root}/child/../plan.json`;
  }
  if (kind === 'relative') return path.relative(process.cwd(), f.filePath);
  if (kind === 'directory-symlink') {
    const link = path.join(f.root, 'alias');
    fs.symlinkSync(f.root, link, process.platform === 'win32' ? 'junction' : 'dir');
    return path.join(link, 'plan.json');
  }
  const link = path.join(f.root, 'alias.json');
  fs.symlinkSync(f.filePath, link, 'file');
  return link;
}

for (const kind of ['double-slash', 'dot', 'dotdot', 'relative', 'directory-symlink', 'file-symlink']) {
  for (const [entrypoint, innerDrive] of [['admitted', runAdmittedContour], ['scheduled', runScheduledContour]]) {
    test(`F black-box ${kind} alias rejects nested ${entrypoint} before any inner port or mutation`, (t) => {
      const f = childFixture(t);
      const alias = stateAlias(f, kind);
      const executor = { ...host(f.root), now: NOW };
      const execute = executor.effectPort.execute;
      let attempts = 0;
      let innerCalls = 0;
      const innerPort = () => { innerCalls += 1; throw new Error('INNER_PORT_REACHED'); };
      executor.effectPort.execute = (request) => {
        const bytes = fs.readFileSync(f.filePath);
        const files = fs.readdirSync(path.join(f.root, 'effects'));
        assert.throws(() => innerDrive({ ...executor, filePath: alias,
          admissionPort: { revalidate: innerPort }, effectPort: { execute: innerPort, reconcile: innerPort },
          receiptPort: { verify: innerPort }, controlPort: { read: innerPort } }),
        { code: kind === 'file-symlink' ? 'E_RCV00F_STATE_FILE' : 'E_RCV00F_REENTRANT_EXECUTOR' });
        attempts += 1;
        assert.equal(innerCalls, 0);
        assert.deepEqual(fs.readFileSync(f.filePath), bytes);
        assert.deepEqual(fs.readdirSync(path.join(f.root, 'effects')), files);
        return execute(request);
      };
      const result = runScheduledContour(executor);
      assert.equal(result.phase, 'DONE');
      assert.equal(result.cursor, 3);
      assert.equal(attempts, 3);
      assert.equal(innerCalls, 0);
      const journal = fs.readFileSync(path.join(f.root, 'effects-observed.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
      assert.deepEqual(journal.map(row => row.stepId), ['IMPLEMENT', 'PROVE', 'DELIVER']);
      assert.equal(new Set(journal.map(row => row.effectIdempotencyKey)).size, 3);
      const bytes = fs.readFileSync(f.filePath);
      assert.equal(runScheduledContour(executor).phase, 'DONE');
      assert.deepEqual(fs.readFileSync(f.filePath), bytes);
    });
  }
}

test('F physical state rejects directory hardlink and file symlink before admission', (t) => {
  const f = childFixture(t);
  const executor = { ...host(f.root), now: NOW };
  const before = fs.readFileSync(f.filePath);
  let calls = 0;
  executor.admissionPort.revalidate = () => { calls += 1; throw new Error('ADMISSION_REACHED'); };
  const symlink = stateAlias(f, 'file-symlink');
  const hardlink = path.join(f.root, 'hard.json');
  fs.linkSync(f.filePath, hardlink);
  for (const filePath of [f.root, symlink, hardlink, f.filePath]) {
    assert.throws(() => runScheduledContour({ ...executor, filePath }), { code: 'E_RCV00F_STATE_FILE' });
    assert.equal(calls, 0);
    assert.deepEqual(fs.readFileSync(f.filePath), before);
  }
});

test('F scheduler holds physical state guard before initial admission callback', (t) => {
  const f = childFixture(t);
  const executor = { ...host(f.root), now: NOW };
  const revalidate = executor.admissionPort.revalidate;
  let attempted = false;
  executor.admissionPort.revalidate = (request) => {
    if (!attempted) {
      attempted = true;
      const before = fs.readFileSync(f.filePath);
      assert.throws(() => runScheduledContour({ ...executor, filePath: `${f.root}//plan.json` }), { code: 'E_RCV00F_REENTRANT_EXECUTOR' });
      assert.deepEqual(fs.readFileSync(f.filePath), before);
    }
    return revalidate(request);
  };
  assert.equal(runScheduledContour(executor).phase, 'DONE');
  assert.equal(attempted, true);
});
