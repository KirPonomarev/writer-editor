#!/usr/bin/env node

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toIsoUtc(value) {
  const parsed = Date.parse(String(value || ''));
  if (!Number.isFinite(parsed)) return '';
  return new Date(parsed).toISOString();
}

const BACKOFF_MINUTES = Object.freeze([2, 5, 15]);

export function resolveBackoffMinutes(retryIndex = 0, customSchedule = BACKOFF_MINUTES) {
  const schedule = Array.isArray(customSchedule) && customSchedule.length > 0
    ? customSchedule.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)
    : [...BACKOFF_MINUTES];
  if (schedule.length === 0) return 15;

  const idx = Math.max(0, Number(retryIndex || 0) - 1);
  return schedule[Math.min(idx, schedule.length - 1)];
}

export function computeNextAutoProbeAt(input = {}) {
  const nowIso = normalizeString(input.nowIso || new Date().toISOString());
  const nowMs = Date.parse(nowIso);
  const retryIndex = Number(input.retryIndex || 0);
  const backoffMinutes = resolveBackoffMinutes(retryIndex, input.backoffSchedule);
  const baseMs = Number.isFinite(nowMs) ? nowMs : Date.now();
  const nextMs = baseMs + backoffMinutes * 60 * 1000;
  return {
    nowIso: toIsoUtc(baseMs) || new Date(baseMs).toISOString(),
    retryIndex,
    backoffMinutes,
    nextAutoProbeAt: new Date(nextMs).toISOString(),
  };
}

export function evaluateWaitModeEmitRule(input = {}) {
  const previousLoopDecision = normalizeString(input.previousLoopDecision || '').toUpperCase();
  const currentLoopDecision = normalizeString(input.currentLoopDecision || '').toUpperCase();
  const previousFingerprint = normalizeString(input.previousFingerprint || '');
  const currentFingerprint = normalizeString(input.currentFingerprint || '');
  const stateDelta = normalizeString(input.stateDelta || '').toUpperCase();

  const sameWaitContext = previousLoopDecision === 'WAIT_MODE'
    && currentLoopDecision === 'WAIT_MODE'
    && previousFingerprint
    && previousFingerprint === currentFingerprint
    && stateDelta === 'NONE';

  return {
    shouldEmitWaitStatus: !sameWaitContext,
    dedupApplied: sameWaitContext,
  };
}

export function validateWaitModeEnvelope(input = {}) {
  const loopDecision = normalizeString(input.loopDecision || '').toUpperCase();
  const nextAutoProbeAt = normalizeString(input.nextAutoProbeAt || '');
  const needsNextProbe = loopDecision === 'WAIT_MODE';
  const hasNextProbe = !needsNextProbe || Boolean(toIsoUtc(nextAutoProbeAt));

  return {
    ok: hasNextProbe,
    needsNextProbe,
    nextAutoProbeAt: hasNextProbe && nextAutoProbeAt ? toIsoUtc(nextAutoProbeAt) : '',
  };
}

export {
  BACKOFF_MINUTES,
};
