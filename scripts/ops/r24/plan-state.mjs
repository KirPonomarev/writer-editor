#!/usr/bin/env node
// R2.4 E0 — PlanExecutionState: durable atomic CAS store, formal transition
// engine, idempotency journal and total crash classification.
// Law source: sealed package machine/AUTONOMY_CONTROL_PLANE_R2_4.json
// (MissionState.expectedRevisionRequired, DURABLE_ATOMIC_CAS) and the
// delivery-law state machine. No blind overwrite, no silent transition.
import {
  readJsonBounded,
  writeJsonAtomic,
  classifyWriteArtifacts,
  canonicalDigest,
  R24Error,
  HEX40_RE,
} from './canonical-json.mjs';
import fs from 'node:fs';

export const PLAN_STATE_SCHEMA_VERSION = 'yalken.plan-state.r24.v2';
export const PLAN_STATE_REPLAY_BASELINE_VERSION = 'PlanStateReplayBaselineV1';
export const PLAN_STATE_TRANSITION_RECEIPT_VERSION = 'PlanStateTransitionReceiptV1';
export const PLAN_STATE_TYPED_DELIVERY_WAIT_EVIDENCE_VERSION = 'PlanStateTypedDeliveryWaitEvidenceV1';
export const PLAN_STATE_TYPED_DELIVERY_RESUME_EVIDENCE_VERSION = 'PlanStateTypedDeliveryResumeEvidenceV1';
export const PLAN_STATE_TYPED_DELIVERY_REVOKE_EVIDENCE_VERSION = 'PlanStateTypedDeliveryRevokeEvidenceV1';
const CONTOUR_MUTATION_TOKEN = Symbol('R24_CONTOUR_TRANSITION_ENGINE');
const UNCERTAIN_DELIVERY_KIND = 'UNCERTAIN_DELIVERY';

// Ported from sealed machine/EXECUTABLE_PROGRAM_R2_4.json lifecycle states
// and transition law, with the RCV00F guarded DELIVERED->BLOCKED_TYPED
// corrective edge enforced by typed delivery evidence below.
export const DEFAULT_TRANSITION_LAW = Object.freeze({
  lifecycleStates: Object.freeze([
    'PENDING', 'ELIGIBLE', 'RUNNING', 'WAIT_OWNER', 'BLOCKED_TYPED', 'FAILED',
    'DELIVERED', 'POSTMERGE_VERIFIED', 'DONE', 'CANCELLED', 'INELIGIBLE_OPTIONAL',
  ]),
  stateTransitions: Object.freeze({
    PENDING: Object.freeze(['ELIGIBLE', 'WAIT_OWNER', 'BLOCKED_TYPED', 'CANCELLED', 'INELIGIBLE_OPTIONAL']),
    ELIGIBLE: Object.freeze(['RUNNING', 'WAIT_OWNER', 'BLOCKED_TYPED', 'CANCELLED']),
    RUNNING: Object.freeze(['FAILED', 'DELIVERED', 'WAIT_OWNER', 'BLOCKED_TYPED', 'CANCELLED']),
    FAILED: Object.freeze(['ELIGIBLE', 'WAIT_OWNER', 'CANCELLED']),
    DELIVERED: Object.freeze(['POSTMERGE_VERIFIED', 'FAILED', 'BLOCKED_TYPED']),
    POSTMERGE_VERIFIED: Object.freeze(['DONE', 'FAILED']),
    WAIT_OWNER: Object.freeze(['ELIGIBLE', 'CANCELLED']),
    BLOCKED_TYPED: Object.freeze(['ELIGIBLE', 'CANCELLED']),
    DONE: Object.freeze([]),
    CANCELLED: Object.freeze([]),
    INELIGIBLE_OPTIONAL: Object.freeze([]),
  }),
});

export function createTransitionValidator(law = DEFAULT_TRANSITION_LAW) {
  const states = new Set(law.lifecycleStates);
  const transitions = law.stateTransitions;
  return function assertTransition(from, to) {
    if (!states.has(from)) throw new R24Error('E_TRANSITION_UNKNOWN_STATE', `from=${String(from)}`);
    if (!states.has(to)) throw new R24Error('E_TRANSITION_UNKNOWN_STATE', `to=${String(to)}`);
    const allowed = transitions[from];
    if (!Array.isArray(allowed)) throw new R24Error('E_TRANSITION_LAW_MISSING', `from=${from}`);
    if (allowed.length === 0) throw new R24Error('E_TERMINAL_STATE_HAS_NO_OUTGOING', from);
    if (!allowed.includes(to)) throw new R24Error('E_ILLEGAL_TRANSITION', `${from} -> ${to}`);
    return true;
  };
}

const contourStates = (contours) => Object.fromEntries(
  Object.entries(contours).map(([id, row]) => [id, row?.state]),
);

const isPlainObject = (value) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

function requireEvidenceString(value, code, field) {
  if (typeof value !== 'string' || value.length === 0) throw new R24Error(code, field);
  return value;
}

function assertEvidenceClock(value, now, code) {
  requireEvidenceString(value, code, 'observedAt');
  const observedMs = Date.parse(value);
  const nowMs = Date.parse(now);
  if (!Number.isFinite(observedMs) || !Number.isFinite(nowMs) || observedMs > nowMs) throw new R24Error(code, value);
}

function assertNoDeliveryVerificationClaim(evidence) {
  if (
    evidence.status === 'VERIFIED'
    || evidence.verifiedDelivery !== undefined
    || evidence.verifiedState !== undefined
    || evidence.transitionReceiptDigest !== undefined
  ) {
    throw new R24Error('E_TYPED_DELIVERY_FAKE_VERIFICATION');
  }
}

function buildTypedDeliveryEvidence({
  schemaVersion,
  action,
  status,
  contourId,
  writerId,
  fencingToken,
  fromState,
  toState,
  idempotencyKey,
  headSha,
  externalOperationId,
  effectIdempotencyKey,
  observedAt,
  reasonCode,
  waitEvidenceDigest = null,
}) {
  return {
    schemaVersion,
    kind: UNCERTAIN_DELIVERY_KIND,
    action,
    status,
    contourId,
    writerId,
    fencingToken,
    fromState,
    toState,
    idempotencyKey,
    headSha,
    externalOperationId,
    effectIdempotencyKey,
    observedAt,
    reasonCode,
    waitEvidenceDigest,
  };
}

export function buildTypedDeliveryWaitEvidence(input = {}) {
  return buildTypedDeliveryEvidence({
    ...input,
    schemaVersion: PLAN_STATE_TYPED_DELIVERY_WAIT_EVIDENCE_VERSION,
    action: 'ENTER_TYPED_WAIT',
    status: 'UNCERTAIN',
    fromState: 'DELIVERED',
    toState: 'BLOCKED_TYPED',
  });
}

export function buildTypedDeliveryResumeEvidence(input = {}) {
  return buildTypedDeliveryEvidence({
    ...input,
    schemaVersion: PLAN_STATE_TYPED_DELIVERY_RESUME_EVIDENCE_VERSION,
    action: 'RESUME_FROM_TYPED_WAIT',
    status: 'RECONCILED_FOR_RETRY',
    fromState: 'BLOCKED_TYPED',
    toState: 'ELIGIBLE',
  });
}

export function buildTypedDeliveryRevokeEvidence(input = {}) {
  return buildTypedDeliveryEvidence({
    ...input,
    schemaVersion: PLAN_STATE_TYPED_DELIVERY_REVOKE_EVIDENCE_VERSION,
    action: 'REVOKE_TYPED_WAIT',
    status: 'REVOKED',
    fromState: 'BLOCKED_TYPED',
    toState: 'CANCELLED',
  });
}

function normalizeTypedDeliveryEvidence(evidence, {
  schemaVersion,
  action,
  status,
  contourId,
  writerId,
  fencingToken,
  from,
  to,
  idempotencyKey,
  headSha,
  now,
  currentTypedWait = null,
}) {
  if (!isPlainObject(evidence)) throw new R24Error('E_TYPED_DELIVERY_EVIDENCE_REQUIRED', `${from} -> ${to}`);
  if (evidence.schemaVersion !== schemaVersion) throw new R24Error('E_TYPED_DELIVERY_EVIDENCE_SCHEMA', `${from} -> ${to}`);
  if (evidence.kind !== UNCERTAIN_DELIVERY_KIND) throw new R24Error('E_TYPED_DELIVERY_EVIDENCE_KIND', `${from} -> ${to}`);
  if (evidence.action !== action) throw new R24Error('E_TYPED_DELIVERY_EVIDENCE_ACTION', `${from} -> ${to}`);
  if (evidence.status !== status) throw new R24Error('E_TYPED_DELIVERY_EVIDENCE_STATUS', `${from} -> ${to}`);
  assertNoDeliveryVerificationClaim(evidence);
  for (const [field, expected] of [
    ['contourId', contourId],
    ['writerId', writerId],
    ['fromState', from],
    ['toState', to],
    ['idempotencyKey', idempotencyKey],
  ]) {
    if (evidence[field] !== expected) throw new R24Error('E_TYPED_DELIVERY_EVIDENCE_BINDING', field);
  }
  if (evidence.fencingToken !== fencingToken) throw new R24Error('E_TYPED_DELIVERY_EVIDENCE_FENCE');
  if (evidence.headSha !== headSha) throw new R24Error('E_TYPED_DELIVERY_EVIDENCE_HEAD');
  requireEvidenceString(evidence.externalOperationId, 'E_TYPED_DELIVERY_EXTERNAL_ID', 'externalOperationId');
  requireEvidenceString(evidence.effectIdempotencyKey, 'E_TYPED_DELIVERY_EFFECT_IDEMPOTENCY_KEY', 'effectIdempotencyKey');
  requireEvidenceString(evidence.reasonCode, 'E_TYPED_DELIVERY_REASON', 'reasonCode');
  assertEvidenceClock(evidence.observedAt, now, 'E_TYPED_DELIVERY_EVIDENCE_CLOCK');
  if (currentTypedWait !== null) {
    if (evidence.waitEvidenceDigest !== currentTypedWait.evidenceDigest) throw new R24Error('E_TYPED_DELIVERY_WAIT_DIGEST_MISMATCH');
    if (evidence.externalOperationId !== currentTypedWait.externalOperationId) throw new R24Error('E_TYPED_DELIVERY_EXTERNAL_ID_MISMATCH');
    if (evidence.effectIdempotencyKey !== currentTypedWait.effectIdempotencyKey) throw new R24Error('E_TYPED_DELIVERY_EFFECT_IDEMPOTENCY_MISMATCH');
  } else if (evidence.waitEvidenceDigest !== null) {
    throw new R24Error('E_TYPED_DELIVERY_WAIT_DIGEST_UNEXPECTED');
  }
  return {
    schemaVersion: evidence.schemaVersion,
    kind: evidence.kind,
    action: evidence.action,
    status: evidence.status,
    contourId: evidence.contourId,
    writerId: evidence.writerId,
    fencingToken: evidence.fencingToken,
    fromState: evidence.fromState,
    toState: evidence.toState,
    idempotencyKey: evidence.idempotencyKey,
    headSha: evidence.headSha,
    externalOperationId: evidence.externalOperationId,
    effectIdempotencyKey: evidence.effectIdempotencyKey,
    observedAt: evidence.observedAt,
    reasonCode: evidence.reasonCode,
    waitEvidenceDigest: evidence.waitEvidenceDigest,
  };
}

function assertTypedDeliveryTransitionRecord(record, filePath) {
  if (record.typedDeliveryReconciliation === undefined) return;
  const typed = record.typedDeliveryReconciliation;
  if (!isPlainObject(typed)) throw new R24Error('E_TYPED_DELIVERY_RECORD_SHAPE', filePath);
  if (typed.kind !== UNCERTAIN_DELIVERY_KIND) throw new R24Error('E_TYPED_DELIVERY_RECORD_KIND', filePath);
  if (!['ENTER_TYPED_WAIT', 'RESUME_FROM_TYPED_WAIT', 'REVOKE_TYPED_WAIT'].includes(typed.action)) {
    throw new R24Error('E_TYPED_DELIVERY_RECORD_ACTION', filePath);
  }
  if (!['UNCERTAIN', 'RECONCILED_FOR_RETRY', 'REVOKED'].includes(typed.status)) {
    throw new R24Error('E_TYPED_DELIVERY_RECORD_STATUS', filePath);
  }
  for (const field of ['action', 'status', 'evidenceDigest', 'externalOperationId', 'effectIdempotencyKey']) {
    if (typeof typed[field] !== 'string' || typed[field].length === 0) throw new R24Error('E_TYPED_DELIVERY_RECORD_FIELD', `${filePath}:${field}`);
  }
  if (!/^[0-9a-f]{64}$/.test(typed.evidenceDigest)) throw new R24Error('E_TYPED_DELIVERY_RECORD_DIGEST', filePath);
  if (typed.waitEvidenceDigest !== null && !/^[0-9a-f]{64}$/.test(String(typed.waitEvidenceDigest))) {
    throw new R24Error('E_TYPED_DELIVERY_RECORD_WAIT_DIGEST', filePath);
  }
}

function resolveTypedDeliveryTransition({
  current,
  from,
  to,
  contourId,
  writerId,
  fencingToken,
  idempotencyKey,
  headSha,
  now,
  typedDeliveryWaitEvidence,
  typedDeliveryResumeEvidence,
  typedDeliveryRevokeEvidence,
}) {
  const provided = [typedDeliveryWaitEvidence, typedDeliveryResumeEvidence, typedDeliveryRevokeEvidence]
    .filter((item) => item !== null && item !== undefined);
  const currentTypedWait = current?.typedWait?.kind === UNCERTAIN_DELIVERY_KIND ? current.typedWait : null;
  const context = { contourId, writerId, fencingToken, idempotencyKey, headSha, now };
  if (from === 'DELIVERED' && to === 'BLOCKED_TYPED') {
    if (provided.length !== 1 || typedDeliveryWaitEvidence === null || typedDeliveryWaitEvidence === undefined) {
      throw new R24Error('E_TYPED_DELIVERY_WAIT_EVIDENCE_REQUIRED');
    }
    const evidence = normalizeTypedDeliveryEvidence(typedDeliveryWaitEvidence, {
      ...context,
      schemaVersion: PLAN_STATE_TYPED_DELIVERY_WAIT_EVIDENCE_VERSION,
      action: 'ENTER_TYPED_WAIT',
      status: 'UNCERTAIN',
      from,
      to,
    });
    const evidenceDigest = canonicalDigest(evidence);
    return {
      record: {
        kind: evidence.kind,
        action: evidence.action,
        status: evidence.status,
        evidenceDigest,
        externalOperationId: evidence.externalOperationId,
        effectIdempotencyKey: evidence.effectIdempotencyKey,
        waitEvidenceDigest: null,
      },
      rowTypedWait: {
        kind: evidence.kind,
        evidenceDigest,
        externalOperationId: evidence.externalOperationId,
        effectIdempotencyKey: evidence.effectIdempotencyKey,
        reasonCode: evidence.reasonCode,
        enteredAt: now,
        fromState: from,
      },
    };
  }
  if (currentTypedWait !== null && from === 'BLOCKED_TYPED' && to === 'ELIGIBLE') {
    if (provided.length !== 1 || typedDeliveryResumeEvidence === null || typedDeliveryResumeEvidence === undefined) {
      throw new R24Error('E_TYPED_DELIVERY_RESUME_EVIDENCE_REQUIRED');
    }
    const evidence = normalizeTypedDeliveryEvidence(typedDeliveryResumeEvidence, {
      ...context,
      schemaVersion: PLAN_STATE_TYPED_DELIVERY_RESUME_EVIDENCE_VERSION,
      action: 'RESUME_FROM_TYPED_WAIT',
      status: 'RECONCILED_FOR_RETRY',
      from,
      to,
      currentTypedWait,
    });
    const evidenceDigest = canonicalDigest(evidence);
    return {
      record: {
        kind: evidence.kind,
        action: evidence.action,
        status: evidence.status,
        evidenceDigest,
        externalOperationId: evidence.externalOperationId,
        effectIdempotencyKey: evidence.effectIdempotencyKey,
        waitEvidenceDigest: evidence.waitEvidenceDigest,
      },
      rowTypedWaitResolution: {
        kind: evidence.kind,
        action: evidence.action,
        evidenceDigest,
        waitEvidenceDigest: evidence.waitEvidenceDigest,
        resolvedAt: now,
        toState: to,
      },
    };
  }
  if (currentTypedWait !== null && from === 'BLOCKED_TYPED' && to === 'CANCELLED') {
    if (provided.length !== 1 || typedDeliveryRevokeEvidence === null || typedDeliveryRevokeEvidence === undefined) {
      throw new R24Error('E_TYPED_DELIVERY_REVOKE_EVIDENCE_REQUIRED');
    }
    const evidence = normalizeTypedDeliveryEvidence(typedDeliveryRevokeEvidence, {
      ...context,
      schemaVersion: PLAN_STATE_TYPED_DELIVERY_REVOKE_EVIDENCE_VERSION,
      action: 'REVOKE_TYPED_WAIT',
      status: 'REVOKED',
      from,
      to,
      currentTypedWait,
    });
    const evidenceDigest = canonicalDigest(evidence);
    return {
      record: {
        kind: evidence.kind,
        action: evidence.action,
        status: evidence.status,
        evidenceDigest,
        externalOperationId: evidence.externalOperationId,
        effectIdempotencyKey: evidence.effectIdempotencyKey,
        waitEvidenceDigest: evidence.waitEvidenceDigest,
      },
      rowTypedWaitResolution: {
        kind: evidence.kind,
        action: evidence.action,
        evidenceDigest,
        waitEvidenceDigest: evidence.waitEvidenceDigest,
        resolvedAt: now,
        toState: to,
      },
    };
  }
  if (provided.length > 0) throw new R24Error('E_TYPED_DELIVERY_EVIDENCE_NOT_APPLICABLE', `${from} -> ${to}`);
  return { record: null, rowTypedWait: null, rowTypedWaitResolution: null };
}

function assertLegacyPlanStateShape(state, filePath) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new R24Error('E_PLAN_STATE_SHAPE', filePath);
  if (state.schemaVersion !== 'yalken.plan-state.r24.v1') throw new R24Error('E_PLAN_STATE_LEGACY_SCHEMA_VERSION', filePath);
  if (!Number.isInteger(state.revision) || state.revision < 0) throw new R24Error('E_PLAN_STATE_REVISION_SHAPE', filePath);
  if (!Number.isInteger(state.fencingCounter) || state.fencingCounter < 0) throw new R24Error('E_PLAN_STATE_FENCING_SHAPE', filePath);
  for (const key of ['contours', 'leases', 'idempotency']) {
    if (!state[key] || typeof state[key] !== 'object' || Array.isArray(state[key])) throw new R24Error('E_PLAN_STATE_SECTION_SHAPE', `${filePath}:${key}`);
  }
}

function assertReplayBaseline(baseline, filePath) {
  if (!baseline || typeof baseline !== 'object' || Array.isArray(baseline)) throw new R24Error('E_REPLAY_BASELINE_SHAPE', filePath);
  if (baseline.schemaVersion !== PLAN_STATE_REPLAY_BASELINE_VERSION) throw new R24Error('E_REPLAY_BASELINE_VERSION', filePath);
  if (!Number.isInteger(baseline.revision) || baseline.revision < 0) throw new R24Error('E_REPLAY_BASELINE_REVISION', filePath);
  if (!Number.isInteger(baseline.fencingCounter) || baseline.fencingCounter < 0) throw new R24Error('E_REPLAY_BASELINE_FENCING', filePath);
  if (typeof baseline.contourStatesDigest !== 'string' || !/^[0-9a-f]{64}$/.test(baseline.contourStatesDigest)) {
    throw new R24Error('E_REPLAY_BASELINE_DIGEST', filePath);
  }
  if (!['GENESIS', 'ADOPTED_PRE_V2_UNREPLAYABLE_HISTORY'].includes(baseline.classification)) {
    throw new R24Error('E_REPLAY_BASELINE_CLASSIFICATION', filePath);
  }
  if (!Array.isArray(baseline.unreplayableContourIds) || new Set(baseline.unreplayableContourIds).size !== baseline.unreplayableContourIds.length) {
    throw new R24Error('E_REPLAY_BASELINE_UNREPLAYABLE_IDS', filePath);
  }
  if (baseline.classification === 'GENESIS' && baseline.unreplayableContourIds.length !== 0) {
    throw new R24Error('E_REPLAY_GENESIS_HAS_UNREPLAYABLE_HISTORY', filePath);
  }
  if (baseline.classification !== 'GENESIS') {
    if (typeof baseline.authority !== 'string' || baseline.authority.length === 0) throw new R24Error('E_REPLAY_BASELINE_AUTHORITY', filePath);
    if (typeof baseline.adoptedAt !== 'string' || !Number.isFinite(Date.parse(baseline.adoptedAt))) throw new R24Error('E_REPLAY_BASELINE_CLOCK', filePath);
    if (typeof baseline.sourceHeadSha !== 'string' || !HEX40_RE.test(baseline.sourceHeadSha)) throw new R24Error('E_REPLAY_BASELINE_HEAD', filePath);
  }
}

function assertTransitionRecord(record, filePath) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new R24Error('E_TRANSITION_RECORD_SHAPE', filePath);
  for (const key of ['transitionId', 'contourId', 'from', 'to', 'attemptId', 'writerId', 'idempotencyKey', 'requestDigest', 'appliedAt']) {
    if (typeof record[key] !== 'string' || record[key].length === 0) throw new R24Error('E_TRANSITION_RECORD_FIELD', `${filePath}:${key}`);
  }
  if (!/^[0-9a-f]{64}$/.test(record.transitionId) || !/^[0-9a-f]{64}$/.test(record.requestDigest)) {
    throw new R24Error('E_TRANSITION_RECORD_DIGEST', filePath);
  }
  if (!Number.isInteger(record.fromRevision) || !Number.isInteger(record.toRevision) || record.toRevision !== record.fromRevision + 1) {
    throw new R24Error('E_TRANSITION_RECORD_REVISION', filePath);
  }
  if (!Number.isInteger(record.fencingToken) || record.fencingToken < 1) throw new R24Error('E_TRANSITION_RECORD_FENCE', filePath);
  if (typeof record.baselinePresent !== 'boolean') throw new R24Error('E_TRANSITION_RECORD_BASELINE_PRESENCE', filePath);
  if (record.headSha !== null && !HEX40_RE.test(String(record.headSha))) throw new R24Error('E_TRANSITION_RECORD_HEAD', filePath);
  if (!Number.isFinite(Date.parse(record.appliedAt))) throw new R24Error('E_TRANSITION_RECORD_CLOCK', filePath);
  assertTypedDeliveryTransitionRecord(record, filePath);
}

export function validateTransitionReplay(state, filePath = '<memory>') {
  assertReplayBaseline(state.replayBaseline, filePath);
  if (!Array.isArray(state.transitionHistory)) throw new R24Error('E_TRANSITION_HISTORY_SHAPE', filePath);
  const validate = createTransitionValidator();
  const reconstructed = contourStates(state.contours);
  const seenIds = new Set();
  const seenKeys = new Set();
  let nextUpperRevision = state.revision + 1;
  for (let index = state.transitionHistory.length - 1; index >= 0; index -= 1) {
    const record = state.transitionHistory[index];
    assertTransitionRecord(record, `${filePath}:transitionHistory[${index}]`);
    if (record.toRevision >= nextUpperRevision) throw new R24Error('E_TRANSITION_HISTORY_ORDER', `${record.toRevision} >= ${nextUpperRevision}`);
    nextUpperRevision = record.toRevision;
    if (reconstructed[record.contourId] !== record.to) {
      throw new R24Error('E_TRANSITION_REPLAY_FINAL_STATE', `${record.contourId}:${String(reconstructed[record.contourId])} != ${record.to}`);
    }
    if (record.baselinePresent) reconstructed[record.contourId] = record.from;
    else delete reconstructed[record.contourId];
  }
  if (canonicalDigest(reconstructed) !== state.replayBaseline.contourStatesDigest) {
    throw new R24Error('E_TRANSITION_REPLAY_BASELINE_DIGEST', filePath);
  }
  const lastByContour = new Map();
  let priorRevision = state.replayBaseline.revision;
  for (let index = 0; index < state.transitionHistory.length; index += 1) {
    const record = state.transitionHistory[index];
    validate(record.from, record.to);
    if (record.fromRevision < priorRevision) throw new R24Error('E_TRANSITION_HISTORY_ORDER', `${record.fromRevision} < ${priorRevision}`);
    priorRevision = record.toRevision;
    if (record.fencingToken < state.replayBaseline.fencingCounter) throw new R24Error('E_TRANSITION_HISTORY_STALE_FENCE', record.contourId);
    if (seenIds.has(record.transitionId)) throw new R24Error('E_TRANSITION_ID_DUPLICATE', record.transitionId);
    if (seenKeys.has(record.idempotencyKey)) throw new R24Error('E_TRANSITION_IDEMPOTENCY_DUPLICATE', record.idempotencyKey);
    seenIds.add(record.transitionId);
    seenKeys.add(record.idempotencyKey);
    const journal = state.idempotency[record.idempotencyKey];
    if (!journal || journal.requestDigest !== record.requestDigest || journal.receipt?.transitionId !== record.transitionId) {
      throw new R24Error('E_TRANSITION_IDEMPOTENCY_UNBOUND', record.idempotencyKey);
    }
    lastByContour.set(record.contourId, record);
  }
  for (const [id, record] of lastByContour) {
    const row = state.contours[id];
    if (!row || row.state !== record.to || row.previousState !== record.from || row.attemptId !== record.attemptId || row.headSha !== record.headSha) {
      throw new R24Error('E_TRANSITION_REPLAY_ROW_MISMATCH', id);
    }
    if (row.typedWait && row.typedWait.evidenceDigest !== record.typedDeliveryReconciliation?.evidenceDigest) {
      throw new R24Error('E_TYPED_DELIVERY_WAIT_ROW_MISMATCH', id);
    }
    if (row.typedWaitResolution && row.typedWaitResolution.evidenceDigest !== record.typedDeliveryReconciliation?.evidenceDigest) {
      throw new R24Error('E_TYPED_DELIVERY_RESOLUTION_ROW_MISMATCH', id);
    }
  }
  if (state.transitionHistory.length > 0 && priorRevision > state.revision) throw new R24Error('E_TRANSITION_HISTORY_FUTURE_REVISION', filePath);
  return {
    verdict: 'PASS',
    baselineClassification: state.replayBaseline.classification,
    baselineRevision: state.replayBaseline.revision,
    replayedTransitions: state.transitionHistory.length,
    finalRevision: state.revision,
  };
}

const assertPlanStateShape = (state, filePath) => {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new R24Error('E_PLAN_STATE_SHAPE', filePath);
  if (state.schemaVersion !== PLAN_STATE_SCHEMA_VERSION) throw new R24Error('E_PLAN_STATE_SCHEMA_VERSION', filePath);
  if (!Number.isInteger(state.revision) || state.revision < 0) throw new R24Error('E_PLAN_STATE_REVISION_SHAPE', filePath);
  if (!Number.isInteger(state.fencingCounter) || state.fencingCounter < 0) throw new R24Error('E_PLAN_STATE_FENCING_SHAPE', filePath);
  for (const key of ['contours', 'leases', 'idempotency']) {
    if (!state[key] || typeof state[key] !== 'object' || Array.isArray(state[key])) throw new R24Error('E_PLAN_STATE_SECTION_SHAPE', `${filePath}:${key}`);
  }
  validateTransitionReplay(state, filePath);
};

export function adoptPlanStateReplayBaseline(legacyState, {
  sourceHeadSha,
  adoptedAt,
  authority,
  unreplayableContourIds,
}) {
  assertLegacyPlanStateShape(legacyState, '<legacy-plan-state>');
  if (Object.keys(legacyState.leases).length !== 0) throw new R24Error('E_REPLAY_BASELINE_ACTIVE_LEASES');
  if (!HEX40_RE.test(String(sourceHeadSha))) throw new R24Error('E_REPLAY_BASELINE_HEAD');
  if (!Number.isFinite(Date.parse(adoptedAt))) throw new R24Error('E_REPLAY_BASELINE_CLOCK');
  if (typeof authority !== 'string' || authority.length === 0) throw new R24Error('E_REPLAY_BASELINE_AUTHORITY');
  if (!Array.isArray(unreplayableContourIds) || unreplayableContourIds.length === 0) throw new R24Error('E_REPLAY_BASELINE_UNREPLAYABLE_IDS');
  const state = structuredClone(legacyState);
  state.schemaVersion = PLAN_STATE_SCHEMA_VERSION;
  state.replayBaseline = {
    schemaVersion: PLAN_STATE_REPLAY_BASELINE_VERSION,
    revision: state.revision,
    fencingCounter: state.fencingCounter,
    contourStatesDigest: canonicalDigest(contourStates(state.contours)),
    classification: 'ADOPTED_PRE_V2_UNREPLAYABLE_HISTORY',
    sourceHeadSha,
    adoptedAt,
    authority,
    unreplayableContourIds: [...new Set(unreplayableContourIds)].sort(),
  };
  state.transitionHistory = [];
  assertPlanStateShape(state, '<adopted-plan-state>');
  return state;
}

export function initPlanState(filePath) {
  if (fs.existsSync(filePath)) return readPlanState(filePath);
  const initial = {
    schemaVersion: PLAN_STATE_SCHEMA_VERSION,
    revision: 0,
    fencingCounter: 0,
    contours: {},
    leases: {},
    idempotency: {},
    replayBaseline: {
      schemaVersion: PLAN_STATE_REPLAY_BASELINE_VERSION,
      revision: 0,
      fencingCounter: 0,
      contourStatesDigest: canonicalDigest({}),
      classification: 'GENESIS',
      sourceHeadSha: null,
      adoptedAt: null,
      authority: 'PLAN_STATE_GENESIS',
      unreplayableContourIds: [],
    },
    transitionHistory: [],
  };
  writeJsonAtomic(filePath, initial);
  return initial;
}

export function readPlanState(filePath) {
  const state = readJsonBounded(filePath);
  assertPlanStateShape(state, filePath);
  return state;
}

// Compare-and-swap mutation. expectedRevision mismatch aborts before any
// mutation function runs; an already-applied idempotencyKey suppresses the
// duplicate effect and returns the stored receipt instead of writing again.
export function casUpdate(filePath, {
  expectedRevision,
  expectedFencingCounter = null,
  idempotencyKey = null,
  idempotencyPayload = null,
  mutate,
  _contourMutationToken = null,
}) {
  if (!Number.isInteger(expectedRevision)) throw new R24Error('E_CAS_REVISION_SHAPE');
  if (typeof mutate !== 'function') throw new R24Error('E_CAS_MUTATE_REQUIRED');
  const state = readPlanState(filePath);
  let requestDigest = null;
  if (idempotencyKey !== null) {
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length === 0) throw new R24Error('E_IDEMPOTENCY_KEY_SHAPE');
    if (!idempotencyPayload || typeof idempotencyPayload !== 'object' || Array.isArray(idempotencyPayload)) throw new R24Error('E_IDEMPOTENCY_PAYLOAD_REQUIRED');
    requestDigest = canonicalDigest(idempotencyPayload);
    const prior = state.idempotency[idempotencyKey];
    if (prior) {
      if (typeof prior.requestDigest !== 'string') throw new R24Error('E_IDEMPOTENCY_LEGACY_UNVERIFIABLE', idempotencyKey);
      if (prior.requestDigest !== requestDigest) throw new R24Error('E_IDEMPOTENCY_KEY_REUSE', idempotencyKey);
      return { applied: false, duplicate: true, revision: state.revision, receipt: prior.receipt ?? null };
    }
  }
  if (state.revision !== expectedRevision) {
    throw new R24Error('E_CAS_REVISION_CONFLICT', `expected=${expectedRevision} actual=${state.revision}`);
  }
  if (expectedFencingCounter !== null) {
    if (!Number.isInteger(expectedFencingCounter) || expectedFencingCounter < 0) throw new R24Error('E_CAS_FENCING_SHAPE');
    if (state.fencingCounter !== expectedFencingCounter) {
      throw new R24Error('E_CAS_FENCING_CONFLICT', `expected=${expectedFencingCounter} actual=${state.fencingCounter}`);
    }
  }
  const draft = structuredClone(state);
  const beforeTransitionControlDigest = canonicalDigest({
    contours: draft.contours,
    replayBaseline: draft.replayBaseline,
    transitionHistory: draft.transitionHistory,
    idempotency: draft.idempotency,
  });
  const result = mutate(draft) || {};
  const afterTransitionControlDigest = canonicalDigest({
    contours: draft.contours,
    replayBaseline: draft.replayBaseline,
    transitionHistory: draft.transitionHistory,
    idempotency: draft.idempotency,
  });
  if (afterTransitionControlDigest !== beforeTransitionControlDigest && _contourMutationToken !== CONTOUR_MUTATION_TOKEN) {
    throw new R24Error('E_CONTOUR_MUTATION_REQUIRES_TRANSITION_ENGINE');
  }
  draft.revision = state.revision + 1;
  if (idempotencyKey !== null) {
    draft.idempotency[idempotencyKey] = { revision: draft.revision, requestDigest, receipt: result.receipt ?? null };
  }
  assertPlanStateShape(draft, filePath);
  const write = writeJsonAtomic(filePath, draft);
  return { applied: true, duplicate: false, revision: draft.revision, result, write };
}

export function transitionContour(filePath, {
  contourId,
  to,
  expectedRevision,
  attemptId,
  writerId,
  fencingToken,
  idempotencyKey,
  now,
  headSha = null,
  law = DEFAULT_TRANSITION_LAW,
  typedDeliveryWaitEvidence = null,
  typedDeliveryResumeEvidence = null,
  typedDeliveryRevokeEvidence = null,
}) {
  if (typeof contourId !== 'string' || contourId.length === 0) throw new R24Error('E_CONTOUR_ID_REQUIRED');
  if (typeof attemptId !== 'string' || attemptId.length === 0) throw new R24Error('E_ATTEMPT_ID_REQUIRED');
  if (typeof writerId !== 'string' || writerId.length === 0) throw new R24Error('E_WRITER_ID_REQUIRED');
  if (!Number.isInteger(fencingToken) || fencingToken < 1) throw new R24Error('E_FENCE_STALE');
  if (typeof idempotencyKey !== 'string' || idempotencyKey.length === 0) throw new R24Error('E_IDEMPOTENCY_KEY_REQUIRED');
  if (typeof now !== 'string' || now.length === 0) throw new R24Error('E_CLOCK_REQUIRED');
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs)) throw new R24Error('E_CLOCK_INVALID', now);
  if (headSha !== null && !HEX40_RE.test(String(headSha))) throw new R24Error('E_TRANSITION_HEAD_SHAPE');
  const assertTransition = createTransitionValidator(law);
  const idempotencyPayload = {
    operation: 'TRANSITION_CONTOUR',
    contourId,
    to,
    expectedRevision,
    attemptId,
    writerId,
    fencingToken,
    now,
    headSha,
  };
  if (typedDeliveryWaitEvidence != null) idempotencyPayload.typedDeliveryWaitEvidence = typedDeliveryWaitEvidence;
  if (typedDeliveryResumeEvidence != null) idempotencyPayload.typedDeliveryResumeEvidence = typedDeliveryResumeEvidence;
  if (typedDeliveryRevokeEvidence != null) idempotencyPayload.typedDeliveryRevokeEvidence = typedDeliveryRevokeEvidence;
  const requestDigest = canonicalDigest(idempotencyPayload);
  const transitionId = canonicalDigest({ idempotencyKey, requestDigest });
  return casUpdate(filePath, {
    expectedRevision,
    expectedFencingCounter: fencingToken,
    idempotencyKey,
    idempotencyPayload,
    _contourMutationToken: CONTOUR_MUTATION_TOKEN,
    mutate: (draft) => {
      const current = draft.contours[contourId] || null;
      const from = current ? current.state : 'PENDING';
      assertTransition(from, to);
      const lease = draft.leases[contourId];
      if (!lease) throw new R24Error('E_TRANSITION_LEASE_REQUIRED', contourId);
      if (lease.writerId !== writerId) throw new R24Error('E_LEASE_WRITER_MISMATCH', contourId);
      if (lease.fencingToken !== fencingToken) throw new R24Error('E_FENCE_STALE', contourId);
      if (nowMs >= Date.parse(lease.expiresAt)) throw new R24Error('E_LEASE_EXPIRED', contourId);
      const typedDelivery = resolveTypedDeliveryTransition({
        current,
        from,
        to,
        contourId,
        writerId,
        fencingToken,
        idempotencyKey,
        headSha,
        now,
        typedDeliveryWaitEvidence,
        typedDeliveryResumeEvidence,
        typedDeliveryRevokeEvidence,
      });
      const receipt = {
        schemaVersion: PLAN_STATE_TRANSITION_RECEIPT_VERSION,
        transitionId,
        contourId,
        from,
        to,
        fromRevision: expectedRevision,
        toRevision: expectedRevision + 1,
        attemptId,
        writerId,
        fencingToken,
        idempotencyKey,
        requestDigest,
        headSha,
        appliedAt: now,
      };
      if (typedDelivery.record) receipt.typedDeliveryReconciliation = typedDelivery.record;
      const nextRow = {
        state: to,
        previousState: from,
        attemptId,
        updatedAt: now,
        headSha,
      };
      if (typedDelivery.rowTypedWait) nextRow.typedWait = typedDelivery.rowTypedWait;
      if (typedDelivery.rowTypedWaitResolution) nextRow.typedWaitResolution = typedDelivery.rowTypedWaitResolution;
      draft.contours[contourId] = nextRow;
      draft.transitionHistory.push({ ...receipt, baselinePresent: current !== null });
      return { transition: { contourId, from, to }, receipt };
    },
  });
}

export function classifyPlanStateAfterCrash(filePath, options = {}) {
  if (!fs.existsSync(filePath)) {
    return { classification: 'ROLLBACK_REQUIRED', reason: 'PLAN_STATE_MISSING' };
  }
  return classifyWriteArtifacts(filePath, options);
}
