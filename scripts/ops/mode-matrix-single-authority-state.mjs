#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';

const FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const CLAIM_MATRIX_PATH = 'docs/OPS/CLAIMS/CRITICAL_CLAIM_MATRIX.json';
const PHASE_SWITCH_PATH = 'docs/OPS/STATUS/PHASE_SWITCH_V1.json';
const ALLOWED_PHASES = new Set(['PHASE_1_SHADOW', 'PHASE_2_WARN', 'PHASE_3_HARD']);

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  const normalized = normalizeString(value).toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function readJson(repoRoot, relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(repoRoot, relativePath), 'utf8'));
}

function resolvePhaseBehavior(phase) {
  if (phase === 'PHASE_1_SHADOW') {
    return {
      phase,
      newV1Enforcement: 'SIGNAL_ONLY',
      shouldBlock: false,
    };
  }
  if (phase === 'PHASE_2_WARN') {
    return {
      phase,
      newV1Enforcement: 'WARN_WITH_TICKETED_REMEDIATION',
      shouldBlock: false,
    };
  }
  return {
    phase: 'PHASE_3_HARD',
    newV1Enforcement: 'HARD_BLOCK',
    shouldBlock: true,
  };
}

function evaluatePhaseSwitch(repoRoot, phaseSwitchPath = PHASE_SWITCH_PATH) {
  const phaseDoc = readJson(repoRoot, phaseSwitchPath);
  const activePhase = normalizeString(phaseDoc.activePhase || phaseDoc.ACTIVE_PHASE);
  const precedenceEnabled = parseBoolean(phaseDoc.precedenceEnabled ?? phaseDoc.PRECEDENCE_ENABLED_TRUE);
  const approvedBy = normalizeString(phaseDoc.approvedBy || phaseDoc.APPROVED_BY_OWNER);
  const updatedAtUtc = normalizeString(phaseDoc.updatedAtUtc || phaseDoc.UPDATED_AT_UTC);
  const phaseKnown = ALLOWED_PHASES.has(activePhase);

  const issues = [];
  if (!phaseKnown) issues.push('ACTIVE_PHASE_INVALID');
  if (!precedenceEnabled) issues.push('PRECEDENCE_DISABLED');
  if (!approvedBy) issues.push('APPROVED_BY_MISSING');
  if (!updatedAtUtc) issues.push('UPDATED_AT_UTC_MISSING');

  const behavior = resolvePhaseBehavior(phaseKnown ? activePhase : 'PHASE_3_HARD');
  return {
    ok: issues.length === 0,
    activePhase: phaseKnown ? activePhase : '',
    precedenceEnabled,
    approvedBy,
    updatedAtUtc,
    issues,
    behavior,
  };
}

function evaluateDualAuthorityAndDrift(repoRoot, failRegistryDoc) {
  const modePairs = [
    { mode: 'pr', modeKey: 'prCore' },
    { mode: 'release', modeKey: 'release' },
    { mode: 'promotion', modeKey: 'promotion' },
  ];

  const mismatches = [];
  const driftCases = [];

  for (const row of failRegistryDoc.failSignals || []) {
    if (!row || typeof row.code !== 'string' || !row.code.trim()) continue;
    for (const modePair of modePairs) {
      const expectedDisposition = normalizeString((row.modeMatrix || {})[modePair.modeKey]).toLowerCase();
      if (expectedDisposition !== 'advisory' && expectedDisposition !== 'blocking') continue;

      const expectedShouldBlock = expectedDisposition === 'blocking';
      const actual = evaluateModeMatrixVerdict({
        repoRoot,
        mode: modePair.mode,
        failSignalCode: row.code,
      });

      const mismatch = (
        !actual.ok
        || actual.modeDisposition !== expectedDisposition
        || actual.shouldBlock !== expectedShouldBlock
      );

      if (mismatch) {
        mismatches.push({
          failSignalCode: row.code,
          mode: modePair.mode,
          expectedDisposition,
          expectedShouldBlock,
          actualDisposition: actual.modeDisposition,
          actualShouldBlock: actual.shouldBlock,
          actualOk: actual.ok,
          actualIssues: actual.issues,
        });
      }

      if (expectedDisposition === 'advisory' && actual.shouldBlock) {
        driftCases.push({
          failSignalCode: row.code,
          mode: modePair.mode,
          expectedDisposition,
          actualDisposition: actual.modeDisposition,
          reason: 'ADVISORY_TO_BLOCKING_DRIFT',
        });
      }
    }
  }

  return {
    mismatchCount: mismatches.length,
    mismatches,
    advisoryToBlockingDriftCount: driftCases.length,
    driftCases,
  };
}

function evaluateClaimModeConflicts(repoRoot, claimMatrixDoc) {
  const modePairs = [
    { mode: 'pr', modeKey: 'prCore' },
    { mode: 'release', modeKey: 'release' },
    { mode: 'promotion', modeKey: 'promotion' },
  ];

  const claimModeDispositionConflicts = [];
  const claimOverrideViolations = [];
  const evaluationIssues = [];

  for (const claim of claimMatrixDoc.claims || []) {
    if (!isObjectRecord(claim)) continue;
    const claimId = normalizeString(claim.claimId);
    const failSignalCode = normalizeString(claim.failSignalCode || claim.failSignal);
    if (!claimId || !failSignalCode) continue;
    const claimBlocking = Boolean(claim.blocking);

    for (const modePair of modePairs) {
      const decision = evaluateModeMatrixVerdict({
        repoRoot,
        mode: modePair.mode,
        failSignalCode,
      });

      if (!decision.ok) {
        evaluationIssues.push({
          claimId,
          failSignalCode,
          mode: modePair.mode,
          reason: 'EVALUATOR_NOT_OK',
          issues: decision.issues,
        });
        continue;
      }

      const canonicalShouldBlock = decision.shouldBlock;
      if (claimBlocking !== canonicalShouldBlock) {
        claimModeDispositionConflicts.push({
          claimId,
          failSignalCode,
          mode: modePair.mode,
          claimBlocking,
          canonicalDisposition: decision.modeDisposition,
          canonicalShouldBlock,
          evaluatorId: decision.evaluatorId,
        });
      }

      if (decision.modeDisposition === 'advisory' && decision.shouldBlock) {
        claimOverrideViolations.push({
          claimId,
          failSignalCode,
          mode: modePair.mode,
          claimBlocking,
          canonicalDisposition: decision.modeDisposition,
          canonicalShouldBlock: decision.shouldBlock,
          reason: 'CLAIM_OVERRIDE_CONFLICT',
        });
      }
    }
  }

  return {
    claimModeDispositionConflictCount: claimModeDispositionConflicts.length,
    claimModeDispositionConflicts,
    claimOverrideViolationCount: claimOverrideViolations.length,
    claimOverrideViolations,
    evaluationIssueCount: evaluationIssues.length,
    evaluationIssues,
  };
}

function evaluatePhasePrecedence(phaseSwitchState) {
  const samplePhases = ['PHASE_1_SHADOW', 'PHASE_2_WARN', 'PHASE_3_HARD'];
  const samples = samplePhases.map((phase) => resolvePhaseBehavior(phase));

  const baseRuleOk = (
    samples[0].shouldBlock === false
    && samples[1].shouldBlock === false
    && samples[2].shouldBlock === true
  );

  const activeRuleOk = phaseSwitchState.ok
    ? (phaseSwitchState.behavior.phase !== 'PHASE_3_HARD'
      ? phaseSwitchState.behavior.shouldBlock === false
      : phaseSwitchState.behavior.shouldBlock === true)
    : false;

  return {
    ok: baseRuleOk && activeRuleOk,
    baseRuleOk,
    activeRuleOk,
    samples,
    activePhase: phaseSwitchState.activePhase,
    activePhaseBehavior: phaseSwitchState.behavior,
  };
}

function resolveStatus(gates) {
  return Object.values(gates).every((value) => value === 'PASS') ? 'PASS' : 'FAIL';
}

export function evaluateModeMatrixSingleAuthorityState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const failRegistryPath = normalizeString(input.failRegistryPath) || FAILSIGNAL_REGISTRY_PATH;
  const claimMatrixPath = normalizeString(input.claimMatrixPath) || CLAIM_MATRIX_PATH;
  const phaseSwitchPath = normalizeString(input.phaseSwitchPath) || PHASE_SWITCH_PATH;

  const failRegistryDoc = readJson(repoRoot, failRegistryPath);
  const claimMatrixDoc = readJson(repoRoot, claimMatrixPath);
  const phaseSwitchState = evaluatePhaseSwitch(repoRoot, phaseSwitchPath);
  const authorityState = evaluateDualAuthorityAndDrift(repoRoot, failRegistryDoc);
  const claimState = evaluateClaimModeConflicts(repoRoot, claimMatrixDoc);
  const phasePrecedenceState = evaluatePhasePrecedence(phaseSwitchState);

  const gates = {
    mc_phase_switch_valid: phaseSwitchState.ok ? 'PASS' : 'FAIL',
    mc_blocking_evaluator_single_authority: authorityState.mismatchCount === 0 ? 'PASS' : 'FAIL',
    mc_mode_matrix_consistency: authorityState.mismatchCount === 0 ? 'PASS' : 'FAIL',
    mc_advisory_blocking_drift_zero: authorityState.advisoryToBlockingDriftCount === 0 ? 'PASS' : 'FAIL',
    mc_claim_level_blocking_cannot_override_mode_disposition: claimState.claimOverrideViolationCount === 0 ? 'PASS' : 'FAIL',
    mc_phase_precedence_applied_before_new_v1_verdicts: phasePrecedenceState.ok ? 'PASS' : 'FAIL',
  };

  const status = resolveStatus(gates);
  return {
    ok: status === 'PASS',
    status,
    evaluatorId: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    gates,
    secondaryEvaluatorMismatchCount: authorityState.mismatchCount,
    advisoryToBlockingDriftCount: authorityState.advisoryToBlockingDriftCount,
    claimOverrideViolationCount: claimState.claimOverrideViolationCount,
    claimModeDispositionConflictCount: claimState.claimModeDispositionConflictCount,
    details: {
      authorityState,
      claimState,
      phaseSwitchState,
      phasePrecedenceState,
    },
  };
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    repoRoot: '',
    failRegistryPath: '',
    claimMatrixPath: '',
    phaseSwitchPath: '',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;
    if (arg === '--json') out.json = true;
    if (arg === '--repo-root' && i + 1 < argv.length) {
      out.repoRoot = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--fail-registry-path' && i + 1 < argv.length) {
      out.failRegistryPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--claim-matrix-path' && i + 1 < argv.length) {
      out.claimMatrixPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--phase-switch-path' && i + 1 < argv.length) {
      out.phaseSwitchPath = normalizeString(argv[i + 1]);
      i += 1;
    }
  }
  return out;
}

function printState(state, asJson) {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
    return;
  }
  process.stdout.write(`MODE_MATRIX_SINGLE_AUTHORITY_STATUS=${state.status}\n`);
  process.stdout.write(`MODE_MATRIX_SINGLE_AUTHORITY_OK=${state.ok ? 1 : 0}\n`);
  process.stdout.write(`SECONDARY_EVALUATOR_MISMATCH_COUNT=${state.secondaryEvaluatorMismatchCount}\n`);
  process.stdout.write(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.advisoryToBlockingDriftCount}\n`);
  process.stdout.write(`CLAIM_OVERRIDE_VIOLATION_COUNT=${state.claimOverrideViolationCount}\n`);
  process.stdout.write(`CLAIM_MODE_DISPOSITION_CONFLICT_COUNT=${state.claimModeDispositionConflictCount}\n`);
  process.stdout.write(`CANONICAL_MODE_MATRIX_EVALUATOR_ID=${state.evaluatorId}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateModeMatrixSingleAuthorityState(args);
  printState(state, args.json);
  process.exit(state.ok ? 0 : 1);
}
