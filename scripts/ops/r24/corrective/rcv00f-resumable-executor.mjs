import { lstatSync, realpathSync, statSync } from 'node:fs';
import { canonicalDigest, R24Error } from '../canonical-json.mjs';
import { readPlanState, casUpdate, transitionContour } from '../plan-state.mjs';
import { assertLeaseCurrent } from '../lease.mjs';
import { selectNext } from '../scheduler.mjs';

export const RUN_SCHEMA = 'R24_RCV00F_RUN_V1';
export const OBSERVER_SCHEMA = 'R24_RCV00F_OBSERVER_V1';
export const OBSERVER_INTERVAL_MS = 600_000;
const MAX_STEPS = 32;
const active = new Set();
const fail = (code) => { throw new R24Error(`E_RCV00F_${code}`); };
const require = (condition, code) => { if (!condition) fail(code); };
const digestPattern = /^[a-f0-9]{64}$/;
const shaPattern = /^[a-f0-9]{40}$/;
const idPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;

function withStateExecutor(filePath, drive) {
  require(typeof filePath === 'string' && filePath.length > 0, 'STATE_PATH');
  // Atomic persistence replaces the inode. Lock its stable physical path,
  // normalize directory aliases, and reject non-regular or hard-linked files.
  const entry = lstatSync(filePath);
  require(entry.isFile() && !entry.isSymbolicLink() && entry.nlink === 1, 'STATE_FILE');
  const key = realpathSync(filePath);
  const physical = statSync(key);
  require(physical.isFile() && physical.nlink === 1 && physical.dev === entry.dev && physical.ino === entry.ino, 'STATE_FILE');
  require(!active.has(key), 'REENTRANT_EXECUTOR');
  active.add(key);
  try { return drive(key); } finally { active.delete(key); }
}

function data(value, depth = 0) {
  require(depth <= 8, 'DATA_DEPTH');
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') { require(value.length <= 4096, 'DATA_BOUND'); return value; }
  if (typeof value === 'number') { require(Number.isSafeInteger(value), 'DATA_NUMBER'); return value; }
  require(value && typeof value === 'object', 'DATA_SHAPE');
  require(Array.isArray(value) || [Object.prototype, null].includes(Object.getPrototypeOf(value)), 'DATA_PROTOTYPE');
  const keys = Reflect.ownKeys(value);
  require(keys.length <= 128 && keys.every((key) => typeof key === 'string'), 'DATA_KEYS');
  if (Array.isArray(value)) require(keys.length === value.length + 1
    && Array.from({ length: value.length }, (_, index) => Object.hasOwn(value, String(index))).every(Boolean), 'DATA_ARRAY_DENSE');
  const copy = Array.isArray(value) ? [] : Object.create(null);
  for (const key of keys) {
    if (Array.isArray(value) && key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    require(descriptor.enumerable && Object.hasOwn(descriptor, 'value'), 'DATA_ACCESSOR');
    require(!['__proto__', 'constructor', 'prototype'].includes(key), 'DATA_KEY');
    copy[key] = data(descriptor.value, depth + 1);
  }
  return copy;
}

function exact(value, keys, code) {
  require(value && !Array.isArray(value) && canonicalDigest(Object.keys(value).sort()) === canonicalDigest([...keys].sort()), code);
}

function freeze(value) {
  for (const item of Object.values(value)) if (item && typeof item === 'object') freeze(item);
  return Object.freeze(value);
}

function clock(now) {
  require(typeof now === 'string' && Number.isFinite(Date.parse(now)), 'CLOCK');
  return Date.parse(now);
}

function bindingFor(identity, steps) {
  exact(identity, ['runId', 'contourId', 'attemptId', 'writerId', 'fencingToken', 'headSha', 'treeSha', 'admissionDigest'], 'IDENTITY_KEYS');
  for (const key of ['runId', 'contourId', 'attemptId', 'writerId']) require(typeof identity[key] === 'string' && idPattern.test(identity[key]), 'IDENTITY_ID');
  require(Number.isSafeInteger(identity.fencingToken) && identity.fencingToken > 0, 'IDENTITY_FENCE');
  require(typeof identity.headSha === 'string' && typeof identity.treeSha === 'string'
    && shaPattern.test(identity.headSha) && shaPattern.test(identity.treeSha), 'IDENTITY_SHA');
  require(typeof identity.admissionDigest === 'string' && digestPattern.test(identity.admissionDigest), 'IDENTITY_ADMISSION');
  require(Array.isArray(steps) && steps.length > 0 && steps.length <= MAX_STEPS, 'STEP_BOUND');
  require(steps.every((step) => typeof step === 'string' && idPattern.test(step)) && new Set(steps).size === steps.length, 'STEP_IDS');
  return canonicalDigest({ identity, steps });
}

function readRun(state, bindingDigest) {
  const run = state.rcv00fRun ?? null;
  if (run === null) return null;
  exact(run, ['schemaVersion', 'identity', 'steps', 'bindingDigest', 'cursor', 'phase', 'reservation', 'reservationOutcome', 'pendingControl', 'receipts', 'reasonCode', 'updatedAt'], 'RUN_KEYS');
  require(run.schemaVersion === RUN_SCHEMA, 'RUN_SCHEMA');
  require(run.bindingDigest === bindingDigest && bindingFor(run.identity, run.steps) === bindingDigest, 'RUN_BINDING');
  require(Number.isSafeInteger(run.cursor) && run.cursor >= 0 && run.cursor <= run.steps.length, 'RUN_CURSOR');
  require(['READY', 'RESERVED', 'WAIT_OWNER', 'BLOCKED_TYPED', 'STOPPED', 'REVOKED', 'DONE'].includes(run.phase), 'RUN_PHASE');
  require(Array.isArray(run.receipts) && run.receipts.length === run.cursor, 'RUN_RECEIPTS');
  for (let index = 0; index < run.receipts.length; index += 1) {
    const receipt = run.receipts[index];
    require(receipt.stepId === run.steps[index] && receipt.bindingDigest === bindingDigest && receipt.status === 'APPLIED', 'RUN_RECEIPT_BINDING');
    require(receipt.effectIdempotencyKey === effectKey(bindingDigest, index) && digestPattern.test(receipt.evidenceDigest), 'RUN_RECEIPT_DIGEST');
  }
  if (run.reservation !== null) {
    exact(run.reservation, ['stepId', 'effectIdempotencyKey'], 'RUN_RESERVATION_KEYS');
    require(run.cursor < run.steps.length && run.reservation.stepId === run.steps[run.cursor], 'RUN_RESERVATION');
    require(run.reservation.effectIdempotencyKey === effectKey(bindingDigest, run.cursor), 'RUN_RESERVATION_KEY');
  }
  require(run.phase !== 'RESERVED' || run.reservation !== null, 'RUN_RESERVED_MISSING');
  require(run.phase !== 'DONE' || run.cursor === run.steps.length, 'RUN_DONE');
  require(run.cursor !== run.steps.length || ['DONE', 'STOPPED', 'REVOKED'].includes(run.phase), 'RUN_FINISHED_PHASE');
  require([null, 'STOP', 'REVOKE'].includes(run.pendingControl), 'RUN_PENDING_CONTROL');
  return run;
}

const effectKey = (bindingDigest, cursor) => canonicalDigest({ bindingDigest, cursor });

function requestFor(state, identity, bindingDigest, action, now, reservation = null) {
  return freeze({ schemaVersion: 'R24_RCV00F_REQUEST_V1', identity: structuredClone(identity), bindingDigest,
    action, now, revision: state.revision, stateDigest: canonicalDigest(state), reservation });
}

function admitted(port, request) {
  const result = data(port.revalidate(request));
  exact(result, ['status', 'requestDigest'], 'ADMISSION_KEYS');
  require(result.requestDigest === canonicalDigest(request), 'ADMISSION_STALE');
  require(['ADMITTED', 'WAIT_OWNER', 'WAIT_EXTERNAL', 'REVOKED'].includes(result.status), 'ADMISSION_STATUS');
  return result.status;
}

function assertCurrent(filePath, state, identity, now, starting = false) {
  const current = readPlanState(filePath);
  require(canonicalDigest(current) === canonicalDigest(state), 'STALE_PUBLICATION');
  require(current.fencingCounter === identity.fencingToken, 'GLOBAL_FENCE');
  assertLeaseCurrent(current, { ...identity, now });
  const row = current.contours[identity.contourId];
  if (starting && !row) return current;
  require(row && (starting ? ['PENDING', 'ELIGIBLE', 'RUNNING'].includes(row.state) : row.state === 'RUNNING')
    && row.attemptId === identity.attemptId && row.headSha === identity.headSha, 'CONTOUR_NOT_RUNNING');
  return current;
}

function checkpoint(filePath, state, run, identity, now) {
  assertCurrent(filePath, state, identity, now);
  return casUpdate(filePath, { expectedRevision: state.revision, expectedFencingCounter: identity.fencingToken,
    mutate: (draft) => { draft.rcv00fRun = run; return { receipt: { bindingDigest: run.bindingDigest, phase: run.phase, cursor: run.cursor } }; } });
}

function verifyReceipt(port, raw, request, reconcile) {
  const receipt = data(raw);
  exact(receipt, ['status', 'bindingDigest', 'stepId', 'effectIdempotencyKey', 'evidenceDigest', 'reasonCode'], 'RECEIPT_KEYS');
  require(receipt.bindingDigest === request.bindingDigest && receipt.stepId === request.reservation.stepId
    && receipt.effectIdempotencyKey === request.reservation.effectIdempotencyKey, 'RECEIPT_BINDING');
  require((reconcile ? ['APPLIED', 'NOT_APPLIED_FINAL', 'WAIT_OWNER', 'WAIT_EXTERNAL'] : ['APPLIED', 'WAIT_OWNER', 'WAIT_EXTERNAL']).includes(receipt.status), 'RECEIPT_STATUS');
  require(digestPattern.test(receipt.evidenceDigest) && idPattern.test(receipt.reasonCode), 'RECEIPT_EVIDENCE');
  require(port.verify(freeze(structuredClone(receipt)), request) === true, 'RECEIPT_ORACLE');
  return receipt;
}

// Finite host call, never a scheduler. Ports are trusted host code and cannot
// be obtained from a serialized plan. Every uncertain reservation is reconciled.
export function runAdmittedContour(options) {
  return withStateExecutor(options.filePath, (filePath) => driveAdmittedContour({ ...options, filePath }));
}

function driveAdmittedContour({ filePath, identity: rawIdentity, steps: rawSteps, admissionPort, effectPort, receiptPort,
  controlPort, now, resumeStopped = false }) {
  clock(now);
  const identity = data(rawIdentity);
  const steps = data(rawSteps);
  const bindingDigest = bindingFor(identity, steps);
  require(typeof filePath === 'string' && filePath.length > 0, 'STATE_PATH');
  require(admissionPort && typeof admissionPort.revalidate === 'function', 'ADMISSION_PORT');
  require(effectPort && ['execute', 'reconcile'].every((key) => typeof effectPort[key] === 'function'), 'EFFECT_PORT');
  require(receiptPort && receiptPort !== effectPort && typeof receiptPort.verify === 'function', 'INDEPENDENT_RECEIPT_PORT');
  require(controlPort && typeof controlPort.read === 'function', 'CONTROL_PORT');
  require(typeof resumeStopped === 'boolean', 'RESUME_FLAG');
    for (let iteration = 0; iteration < MAX_STEPS * 3 + 3; iteration += 1) {
      let state = readPlanState(filePath);
      let run = readRun(state, bindingDigest);
      for (const receipt of run?.receipts ?? []) {
        const request = requestFor(state, identity, bindingDigest, 'VERIFY_DURABLE_RECEIPT', now,
          { stepId: receipt.stepId, effectIdempotencyKey: receipt.effectIdempotencyKey });
        verifyReceipt(receiptPort, receipt, request, false);
      }
      if (run?.reservationOutcome) verifyReceipt(receiptPort, run.reservationOutcome,
        requestFor(state, identity, bindingDigest, 'VERIFY_DURABLE_ABSENCE', now, structuredClone(run.reservation)), true);
      if (run?.phase === 'DONE' || run?.phase === 'REVOKED') return freeze(structuredClone(run));
      if (run?.phase === 'STOPPED' && !resumeStopped) return freeze(structuredClone(run));
      const control = run?.pendingControl ?? controlPort.read();
      require(['CONTINUE', 'STOP', 'REVOKE'].includes(control), 'CONTROL');
      const action = control === 'CONTINUE' ? (run?.phase === 'STOPPED' ? 'RESUME_STOPPED' : 'DRIVE') : control;
      const request = requestFor(state, identity, bindingDigest, action, now);
      const authority = admitted(admissionPort, request);
      if (authority !== 'ADMITTED') return denied(bindingDigest, authority);
      assertCurrent(filePath, state, identity, now);
      run = run ? structuredClone(run) : { schemaVersion: RUN_SCHEMA, identity: structuredClone(identity), steps: [...steps],
        bindingDigest, cursor: 0, phase: 'READY', reservation: null, reservationOutcome: null, pendingControl: null,
        receipts: [], reasonCode: 'ADMITTED', updatedAt: now };
      if (control !== 'CONTINUE') {
        if (run.reservation !== null) {
          run.pendingControl = control;
          run.phase = 'BLOCKED_TYPED';
          run.reasonCode = 'CONTROL_PENDING_RECONCILIATION';
          checkpoint(filePath, state, run, identity, now);
          state = readPlanState(filePath);
          const reconcileRequest = requestFor(state, identity, bindingDigest, 'RECONCILE_BEFORE_CONTROL', now, structuredClone(run.reservation));
          const permission = admitted(admissionPort, reconcileRequest);
          if (permission !== 'ADMITTED') return denied(bindingDigest, permission);
          assertCurrent(filePath, state, identity, now);
          const receipt = verifyReceipt(receiptPort, effectPort.reconcile(reconcileRequest), reconcileRequest, true);
          const publication = requestFor(state, identity, bindingDigest, 'PUBLISH_CONTROL_RECONCILIATION', now, structuredClone(run.reservation));
          const publishPermission = admitted(admissionPort, publication);
          if (publishPermission !== 'ADMITTED') return denied(bindingDigest, publishPermission);
          assertCurrent(filePath, state, identity, now);
          if (receipt.status.startsWith('WAIT_')) {
            run.phase = receipt.status === 'WAIT_OWNER' ? 'WAIT_OWNER' : 'BLOCKED_TYPED';
            run.reasonCode = 'CONTROL_OUTCOME_UNCERTAIN';
            run.updatedAt = now;
            checkpoint(filePath, state, run, identity, now);
            return freeze(run);
          }
          if (receipt.status === 'APPLIED') {
            run.receipts.push(receipt);
            run.cursor += 1;
            run.reservation = null;
            run.reservationOutcome = null;
          } else run.reservationOutcome = receipt;
        }
        run.phase = control === 'STOP' ? 'STOPPED' : 'REVOKED';
        run.pendingControl = control === 'REVOKE' ? control : null;
        run.reasonCode = control;
        run.updatedAt = now;
        checkpoint(filePath, state, run, identity, now);
        return freeze(run);
      }
      if (run.cursor === steps.length) {
        run.phase = 'DONE';
        run.reasonCode = 'RESUMED_COMPLETED_WORK';
        checkpoint(filePath, state, run, identity, now);
        return freeze(run);
      }
      const recovering = run.reservation !== null;
      if (!recovering) {
        run.reservation = { stepId: steps[run.cursor], effectIdempotencyKey: effectKey(bindingDigest, run.cursor) };
        run.phase = 'RESERVED';
        run.reasonCode = 'RESERVED_BEFORE_EFFECT';
        run.updatedAt = now;
        checkpoint(filePath, state, run, identity, now);
        state = readPlanState(filePath);
      }
      let effectRequest = requestFor(state, identity, bindingDigest, recovering ? 'RECONCILE' : 'EXECUTE', now, structuredClone(run.reservation));
      let permission = admitted(admissionPort, effectRequest);
      if (permission !== 'ADMITTED') return denied(bindingDigest, permission);
      assertCurrent(filePath, state, identity, now);
      if (controlPort.read() !== 'CONTINUE') continue;
      let receipt = verifyReceipt(receiptPort, recovering ? effectPort.reconcile(effectRequest) : effectPort.execute(effectRequest), effectRequest, recovering);
      assertCurrent(filePath, state, identity, now);
      if (receipt.status === 'NOT_APPLIED_FINAL') {
        effectRequest = requestFor(state, identity, bindingDigest, 'EXECUTE_AFTER_FINAL_ABSENCE', now, structuredClone(run.reservation));
        permission = admitted(admissionPort, effectRequest);
        if (permission !== 'ADMITTED') return denied(bindingDigest, permission);
        assertCurrent(filePath, state, identity, now);
        if (controlPort.read() !== 'CONTINUE') continue;
        receipt = verifyReceipt(receiptPort, effectPort.execute(effectRequest), effectRequest, false);
      }
      const publication = requestFor(state, identity, bindingDigest, 'PUBLISH_VERIFIED_RECEIPT', now, structuredClone(run.reservation));
      permission = admitted(admissionPort, publication);
      if (permission !== 'ADMITTED') return freeze({ ...denied(bindingDigest, 'WAIT_EXTERNAL'), reasonCode: 'PUBLICATION_AUTHORITY_UNAVAILABLE', pendingReconciliation: true });
      assertCurrent(filePath, state, identity, now);
      const postControl = controlPort.read();
      require(['CONTINUE', 'STOP', 'REVOKE'].includes(postControl), 'CONTROL');
      run.pendingControl = postControl === 'CONTINUE' ? null : postControl;
      if (receipt.status !== 'APPLIED') {
        run.phase = receipt.status === 'WAIT_EXTERNAL' ? 'BLOCKED_TYPED' : receipt.status;
        run.reasonCode = receipt.reasonCode;
        run.updatedAt = now;
        checkpoint(filePath, state, run, identity, now);
        return freeze(run);
      }
      run.receipts.push(receipt);
      run.cursor += 1;
      run.reservation = null;
      run.reservationOutcome = null;
      run.phase = postControl === 'REVOKE' ? 'REVOKED' : postControl === 'STOP' ? 'STOPPED' : run.cursor === steps.length ? 'DONE' : 'READY';
      if (postControl === 'STOP') run.pendingControl = null;
      run.reasonCode = 'STEP_RECEIPT_VERIFIED';
      run.updatedAt = now;
      checkpoint(filePath, state, run, identity, now);
    }
    fail('ITERATION_BOUND');
}

function denied(bindingDigest, phase) {
  return freeze({ schemaVersion: RUN_SCHEMA, bindingDigest,
    phase: phase === 'WAIT_EXTERNAL' ? 'BLOCKED_TYPED' : phase, mutationAllowed: false });
}

// Selection is made once by the existing scheduler over the actual durable
// pre-start state. Restart validates that saved decision, never selects a second
// contour, and still revalidates current host authority for every effect.
export function runScheduledContour(options) {
  return withStateExecutor(options.filePath, (filePath) => driveScheduledContour({ ...options, filePath }));
}

function driveScheduledContour({ program, mission, ...options }) {
  const { filePath, admissionPort, now } = options;
  const identity = data(options.identity);
  const steps = data(options.steps);
  const bindingDigest = bindingFor(identity, steps);
  clock(now);
  require(admissionPort && typeof admissionPort.revalidate === 'function', 'ADMISSION_PORT');
  let state = readPlanState(filePath);
  let saved = state.rcv00fSelection ?? null;
  const policy = ({ missionId, missionDigest, policyEpoch, policyDigest, selectedProfiles, ownerGateApprovals = {}, autonomyEnabled, approved }) =>
    ({ missionId, missionDigest, policyEpoch, policyDigest, selectedProfiles, ownerGateApprovals, autonomyEnabled, approved });
  if (saved === null) {
    const contourStates = Object.fromEntries(Object.entries(state.contours).map(([id, row]) => [id, row.state]));
    require(mission.stateRevision === state.revision && mission.fencingCounter === state.fencingCounter
      && mission.stateDigest === canonicalDigest(state), 'SCHEDULER_STATE');
    const input = { program: structuredClone(program), mission: structuredClone(mission), contourStates, now };
    const selection = selectNext(input);
    if (selection.verdict !== 'SELECTED') return denied(bindingDigest, selection.verdict === 'WAIT_OWNER_DIGEST_APPROVAL' ? 'WAIT_OWNER' : 'BLOCKED_TYPED');
    require(selection.mode === 'AUTONOMOUS' && selection.selectedId === identity.contourId, 'SCHEDULER_SELECTION');
    require(mission.identityRoles.evaluationHeadSha === identity.headSha && mission.identityRoles.evaluationTreeSha === identity.treeSha, 'SCHEDULER_IDENTITY');
    const request = freeze({ ...requestFor(state, identity, bindingDigest, 'START_SELECTED_CONTOUR', now), selection });
    const authority = admitted(admissionPort, request);
    if (authority !== 'ADMITTED') return denied(bindingDigest, authority);
    assertCurrent(filePath, state, identity, now, true);
    saved = { bindingDigest, input, selection };
    casUpdate(filePath, { expectedRevision: state.revision, expectedFencingCounter: identity.fencingToken,
      mutate: (draft) => { draft.rcv00fSelection = saved; } });
  } else {
    require(saved.bindingDigest === bindingDigest && saved.selection.selectedId === identity.contourId, 'SCHEDULER_RESUME_BINDING');
    require(canonicalDigest(saved.input.program) === canonicalDigest(program)
      && canonicalDigest(policy(saved.input.mission)) === canonicalDigest(policy(mission)), 'SCHEDULER_POLICY_DRIFT');
    require(canonicalDigest(selectNext(saved.input)) === canonicalDigest(saved.selection), 'SCHEDULER_RECEIPT');
  }
  state = readPlanState(filePath);
  for (const [from, to] of [['PENDING', 'ELIGIBLE'], ['ELIGIBLE', 'RUNNING']]) {
    if ((state.contours[identity.contourId]?.state ?? 'PENDING') !== from) continue;
    const request = requestFor(state, identity, bindingDigest, `START_${to}`, now);
    const authority = admitted(admissionPort, request);
    if (authority !== 'ADMITTED') return denied(bindingDigest, authority);
    assertCurrent(filePath, state, identity, now, true);
    transitionContour(filePath, { ...identity, to, expectedRevision: state.revision,
      idempotencyKey: `rcv00f:${bindingDigest}:${to}`, now });
    state = readPlanState(filePath);
  }
  return driveAdmittedContour(options);
}

// Invoked by the existing host on its cadence. No timer, port call, CAS or
// file write is reachable from this query; heartbeat-only changes stay quiet.
export function observeAdmittedContour(filePath, { now, previous = null }) {
  const nowMs = clock(now);
  const state = readPlanState(filePath);
  const raw = state.rcv00fRun;
  require(raw, 'OBSERVER_RUN_REQUIRED');
  const run = readRun(state, bindingFor(raw.identity, raw.steps));
  const projection = { schemaVersion: OBSERVER_SCHEMA, bindingDigest: run.bindingDigest, phase: run.phase,
    cursor: run.cursor, total: run.steps.length, reasonCode: run.reasonCode, headSha: run.identity.headSha,
    treeSha: run.identity.treeSha, pendingStep: run.reservation?.stepId ?? null };
  const digest = canonicalDigest(projection);
  if (previous !== null) {
    previous = data(previous);
    exact(previous, ['schemaVersion', 'bindingDigest', 'digest', 'observedAt', 'nextDueAt'], 'OBSERVER_CURSOR');
    require(previous.schemaVersion === OBSERVER_SCHEMA && previous.bindingDigest === run.bindingDigest
      && digestPattern.test(previous.digest), 'OBSERVER_BINDING');
    const observedMs = clock(previous.observedAt);
    require(clock(previous.nextDueAt) === observedMs + OBSERVER_INTERVAL_MS && nowMs >= observedMs, 'OBSERVER_CLOCK');
    if (nowMs < Date.parse(previous.nextDueAt)) return freeze({ due: false, notify: false, projection, cursor: previous });
  }
  return freeze({ due: true, notify: previous === null || previous.digest !== digest, projection,
    cursor: { schemaVersion: OBSERVER_SCHEMA, bindingDigest: run.bindingDigest, digest,
      observedAt: now, nextDueAt: new Date(nowMs + OBSERVER_INTERVAL_MS).toISOString() } });
}
