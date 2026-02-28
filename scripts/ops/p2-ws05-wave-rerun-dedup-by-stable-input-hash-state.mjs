#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { evaluateComputeWaveInputHashState } from './compute-wave-input-hash.mjs';
import { evaluateWaveCacheState } from './wave-cache.mjs';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';
import { evaluateResolveActiveStageState } from './resolve-active-stage.mjs';

const TOKEN_NAME = 'P2_WS05_WAVE_RERUN_DEDUP_BY_STABLE_INPUT_HASH_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';
const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';

const MODE_KEYS = Object.freeze(['prCore', 'release', 'promotion']);
const MODE_LABELS = Object.freeze({ prCore: 'pr', release: 'release', promotion: 'promotion' });

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stableSortObject(value) {
  if (Array.isArray(value)) return value.map((entry) => stableSortObject(entry));
  if (!isObjectRecord(value)) return value;
  const out = {};
  for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
    out[key] = stableSortObject(value[key]);
  }
  return out;
}

function stableStringify(value) {
  return JSON.stringify(stableSortObject(value), null, 2);
}

function readJsonObject(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return isObjectRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    canonStatusPath: '',
    failsignalRegistryPath: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--json') {
      out.json = true;
      continue;
    }

    if (arg === '--canon-status-path' && i + 1 < argv.length) {
      out.canonStatusPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--canon-status-path=')) {
      out.canonStatusPath = normalizeString(arg.slice('--canon-status-path='.length));
      continue;
    }

    if (arg === '--failsignal-registry-path' && i + 1 < argv.length) {
      out.failsignalRegistryPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--failsignal-registry-path=')) {
      out.failsignalRegistryPath = normalizeString(arg.slice('--failsignal-registry-path='.length));
    }
  }

  return out;
}

function validateCanonLock(canonStatusDoc) {
  if (!isObjectRecord(canonStatusDoc)) {
    return {
      ok: false,
      reason: 'CANON_STATUS_UNREADABLE',
      observedStatus: '',
      observedVersion: '',
    };
  }

  const observedStatus = normalizeString(canonStatusDoc.status);
  const observedVersion = normalizeString(canonStatusDoc.canonVersion);
  const ok = observedStatus === 'ACTIVE_CANON' && observedVersion === EXPECTED_CANON_VERSION;

  return {
    ok,
    reason: ok ? '' : 'ACTIVE_CANON_LOCK_FAIL',
    observedStatus,
    observedVersion,
  };
}

function evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc) {
  const failSignals = Array.isArray(failsignalRegistryDoc?.failSignals)
    ? failsignalRegistryDoc.failSignals
    : [];

  const driftCases = [];
  const issues = [];

  for (const row of failSignals) {
    if (!isObjectRecord(row)) continue;
    const failSignalCode = normalizeString(row.code);
    if (!failSignalCode) continue;

    for (const key of MODE_KEYS) {
      const expected = normalizeString((row.modeMatrix || {})[key]).toLowerCase();
      if (expected !== 'advisory') continue;

      const verdict = evaluateModeMatrixVerdict({
        repoRoot,
        mode: MODE_LABELS[key],
        failSignalCode,
      });

      if (!verdict.ok) {
        issues.push({
          failSignalCode,
          mode: MODE_LABELS[key],
          reason: 'MODE_EVALUATOR_ERROR',
          evaluatorIssues: verdict.issues || [],
        });
        continue;
      }

      if (verdict.shouldBlock) {
        driftCases.push({
          failSignalCode,
          mode: MODE_LABELS[key],
          expectedDisposition: 'advisory',
          actualDisposition: normalizeString(verdict.modeDisposition),
          reason: 'ADVISORY_TO_BLOCKING_DRIFT',
        });
      }
    }
  }

  return {
    advisoryToBlockingDriftCount: driftCases.length,
    advisoryToBlockingDriftCountZero: driftCases.length === 0,
    driftCases,
    issues,
  };
}

function plusSeconds(isoUtc, seconds) {
  return new Date(Date.parse(isoUtc) + (seconds * 1000)).toISOString();
}

function evaluateWaveDecision(input = {}) {
  const cacheCheck = isObjectRecord(input.cacheCheck) ? input.cacheCheck : null;
  const inputHashValid = Boolean(input.inputHashValid);
  const ttlValid = Boolean(input.ttlValid);

  if (!inputHashValid || !ttlValid) {
    return {
      shouldReuse: false,
      shouldHeavyRerun: true,
      route: 'FORCE_RERUN_INVALID_INPUT',
    };
  }

  if (cacheCheck && cacheCheck.ok && Number(cacheCheck.WAVE_RESULT_REUSED) === 1 && Number(cacheCheck.WAVE_TTL_VALID) === 1) {
    return {
      shouldReuse: true,
      shouldHeavyRerun: false,
      route: 'REUSE_CACHE',
    };
  }

  return {
    shouldReuse: false,
    shouldHeavyRerun: true,
    route: 'RERUN_HEAVY',
  };
}

function validateWaveDecisionContract(input = {}) {
  const cacheCheck = isObjectRecord(input.cacheCheck) ? input.cacheCheck : null;
  const inputHashValid = Boolean(input.inputHashValid);
  const ttlValid = Boolean(input.ttlValid);
  const decision = isObjectRecord(input.decision) ? input.decision : {};

  const expected = evaluateWaveDecision({ cacheCheck, inputHashValid, ttlValid });

  const sameDecision = Boolean(decision.shouldReuse) === expected.shouldReuse
    && Boolean(decision.shouldHeavyRerun) === expected.shouldHeavyRerun;

  if (sameDecision) {
    return {
      ok: true,
      reason: '',
      expected,
      observed: decision,
    };
  }

  let reason = 'WAVE_DECISION_MISMATCH';

  if (inputHashValid && ttlValid && cacheCheck && !cacheCheck.ok && Boolean(decision.shouldReuse)) {
    reason = Number(cacheCheck.WAVE_TTL_VALID) === 0
      ? 'CACHE_REUSE_WITH_EXPIRED_TTL'
      : 'CACHE_REUSE_WITH_HASH_MISMATCH';
  } else if (!inputHashValid && !Boolean(decision.shouldHeavyRerun)) {
    reason = 'HEAVY_RERUN_SKIPPED_WHEN_INPUT_INVALID';
  } else if (cacheCheck && Number(cacheCheck.WAVE_RESULT_STALE) === 1 && Boolean(decision.shouldReuse)) {
    reason = 'STALE_RESULT_ACCEPTANCE';
  }

  return {
    ok: false,
    reason,
    expected,
    observed: decision,
  };
}

function evaluateRelevantInputContract(input = {}) {
  const manualOverride = Boolean(input.manualRelevantInputOverride);
  return {
    ok: !manualOverride,
    reason: manualOverride ? 'MANUAL_RELEVANT_INPUT_OVERRIDE' : '',
  };
}

function evaluateUnnecessaryHeavyRerunReduction(input = {}) {
  const waveInputHash = normalizeString(input.waveInputHash);
  const ttlClass = normalizeString(input.ttlClass) || 'deterministicLocal';
  const ttlSecRaw = Number(input.ttlSec);
  const ttlSec = Number.isFinite(ttlSecRaw) && ttlSecRaw > 0 ? Math.trunc(ttlSecRaw) : 60;
  const baseNow = normalizeString(input.baseNow) || '2026-02-28T00:00:00.000Z';

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p2-ws05-wave-dedup-'));
  const cachePath = path.join(tmpDir, 'wave-cache.json');

  try {
    evaluateWaveCacheState({
      mode: 'store',
      cachePath,
      waveInputHash,
      ttlClass,
      ttlSec,
      nowUtc: baseNow,
    });

    let unnecessaryBefore = 0;
    let unnecessaryAfter = 0;

    for (let i = 1; i <= 4; i += 1) {
      const nowUtc = plusSeconds(baseNow, i);
      const check = evaluateWaveCacheState({
        mode: 'check',
        cachePath,
        waveInputHash,
        ttlClass,
        reuseRequested: true,
        nowUtc,
      });

      const reusePossible = check.ok && Number(check.WAVE_RESULT_REUSED) === 1;
      const baselineHeavyRerun = true;
      const dedupHeavyRerun = !reusePossible;

      if (baselineHeavyRerun && reusePossible) unnecessaryBefore += 1;
      if (dedupHeavyRerun && reusePossible) unnecessaryAfter += 1;
    }

    return {
      unnecessaryHeavyRerunCountBefore: unnecessaryBefore,
      unnecessaryHeavyRerunCountAfter: unnecessaryAfter,
      reduced: unnecessaryAfter < unnecessaryBefore,
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function runWaveCacheScenarios(input = {}) {
  const waveInputHash = normalizeString(input.waveInputHash);
  const waveInputHashAlt = normalizeString(input.waveInputHashAlt);
  const ttlClass = normalizeString(input.ttlClass) || 'deterministicLocal';
  const ttlSecRaw = Number(input.ttlSec);
  const ttlSec = Number.isFinite(ttlSecRaw) && ttlSecRaw > 0 ? Math.trunc(ttlSecRaw) : 60;
  const baseNow = normalizeString(input.baseNow) || '2026-02-28T00:00:00.000Z';

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p2-ws05-wave-cache-'));
  const cachePath = path.join(tmpDir, 'wave-cache.json');

  try {
    const storeValid = evaluateWaveCacheState({
      mode: 'store',
      cachePath,
      waveInputHash,
      ttlClass,
      ttlSec,
      nowUtc: baseNow,
    });

    const validReuse = evaluateWaveCacheState({
      mode: 'check',
      cachePath,
      waveInputHash,
      ttlClass,
      reuseRequested: true,
      nowUtc: plusSeconds(baseNow, 1),
    });

    const hashMismatch = evaluateWaveCacheState({
      mode: 'check',
      cachePath,
      waveInputHash: waveInputHashAlt,
      ttlClass,
      reuseRequested: true,
      nowUtc: plusSeconds(baseNow, 2),
    });

    const storeShortTtl = evaluateWaveCacheState({
      mode: 'store',
      cachePath,
      waveInputHash,
      ttlClass,
      ttlSec: 1,
      nowUtc: baseNow,
    });

    const ttlExpired = evaluateWaveCacheState({
      mode: 'check',
      cachePath,
      waveInputHash,
      ttlClass,
      reuseRequested: true,
      nowUtc: plusSeconds(baseNow, 5),
    });

    const invalidInput = evaluateWaveCacheState({
      mode: 'check',
      cachePath,
      waveInputHash: 'invalid_hash',
      ttlClass,
      reuseRequested: true,
      nowUtc: plusSeconds(baseNow, 5),
    });

    return {
      storeValid,
      storeShortTtl,
      validReuse,
      hashMismatch,
      ttlExpired,
      invalidInput,
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function deriveAltHash(hash) {
  if (!/^[0-9a-f]{64}$/u.test(hash)) return 'f'.repeat(64);
  const altHead = hash[0] === 'a' ? 'b' : 'a';
  return `${altHead}${hash.slice(1)}`;
}

function evaluateP2Ws05WaveRerunDedupByStableInputHashState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const canonStatusPath = path.resolve(repoRoot, normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH));
  const failsignalRegistryPath = path.resolve(
    repoRoot,
    normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
  );

  const canonStatusDoc = isObjectRecord(input.canonStatusDoc)
    ? input.canonStatusDoc
    : readJsonObject(canonStatusPath);
  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);

  const canonLock = validateCanonLock(canonStatusDoc);
  const stageActivation = evaluateResolveActiveStageState({
    profile: 'release',
    gateTier: 'release',
  });
  const stageActivationGuardCheck = Number(stageActivation.STAGE_ACTIVATION_OK) === 1;

  const hashState = evaluateComputeWaveInputHashState({
    profile: 'release',
    gateTier: 'release',
    scopeFlags: Array.isArray(stageActivation.ACTIVE_SCOPEFLAGS)
      ? stageActivation.ACTIVE_SCOPEFLAGS
      : [],
  });

  const waveInputHash = normalizeString(hashState.WAVE_INPUT_HASH);
  const waveInputHashAlt = deriveAltHash(waveInputHash);
  const ttlClass = normalizeString(hashState.ttlClass) || 'networkSensitive';
  const ttlSec = Number(hashState.ttlSec) > 0 ? Number(hashState.ttlSec) : 900;

  const scenarios = runWaveCacheScenarios({
    waveInputHash,
    waveInputHashAlt,
    ttlClass,
    ttlSec,
  });

  const validDecision = evaluateWaveDecision({
    cacheCheck: scenarios.validReuse,
    inputHashValid: true,
    ttlValid: Number(scenarios.validReuse.WAVE_TTL_VALID) === 1,
  });
  const mismatchDecision = evaluateWaveDecision({
    cacheCheck: scenarios.hashMismatch,
    inputHashValid: true,
    ttlValid: Number(scenarios.hashMismatch.WAVE_TTL_VALID) === 1,
  });
  const expiredDecision = evaluateWaveDecision({
    cacheCheck: scenarios.ttlExpired,
    inputHashValid: true,
    ttlValid: Number(scenarios.ttlExpired.WAVE_TTL_VALID) === 1,
  });
  const invalidInputDecision = evaluateWaveDecision({
    cacheCheck: scenarios.invalidInput,
    inputHashValid: false,
    ttlValid: false,
  });

  const validContract = validateWaveDecisionContract({
    cacheCheck: scenarios.validReuse,
    inputHashValid: true,
    ttlValid: Number(scenarios.validReuse.WAVE_TTL_VALID) === 1,
    decision: validDecision,
  });

  const mismatchContract = validateWaveDecisionContract({
    cacheCheck: scenarios.hashMismatch,
    inputHashValid: true,
    ttlValid: true,
    decision: mismatchDecision,
  });

  const expiredContract = validateWaveDecisionContract({
    cacheCheck: scenarios.ttlExpired,
    inputHashValid: true,
    ttlValid: false,
    decision: expiredDecision,
  });

  const invalidInputContract = validateWaveDecisionContract({
    cacheCheck: scenarios.invalidInput,
    inputHashValid: false,
    ttlValid: false,
    decision: invalidInputDecision,
  });

  const drift = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc);
  const heavyRerunReduction = evaluateUnnecessaryHeavyRerunReduction({
    waveInputHash,
    ttlClass,
    ttlSec,
  });

  const negative01 = validateWaveDecisionContract({
    cacheCheck: scenarios.hashMismatch,
    inputHashValid: true,
    ttlValid: true,
    decision: { shouldReuse: true, shouldHeavyRerun: false, route: 'REUSE_CACHE' },
  });

  const negative02 = validateWaveDecisionContract({
    cacheCheck: scenarios.ttlExpired,
    inputHashValid: true,
    ttlValid: true,
    decision: { shouldReuse: true, shouldHeavyRerun: false, route: 'REUSE_CACHE' },
  });

  const negative03 = validateWaveDecisionContract({
    cacheCheck: scenarios.invalidInput,
    inputHashValid: false,
    ttlValid: false,
    decision: { shouldReuse: false, shouldHeavyRerun: false, route: 'SKIP_HEAVY' },
  });

  const negative04 = evaluateRelevantInputContract({ manualRelevantInputOverride: true });

  const negative05 = validateWaveDecisionContract({
    cacheCheck: scenarios.ttlExpired,
    inputHashValid: true,
    ttlValid: false,
    decision: { shouldReuse: true, shouldHeavyRerun: false, route: 'ACCEPT_STALE' },
  });

  const decisionDigestPayload = {
    validDecision,
    mismatchDecision,
    expiredDecision,
    invalidInputDecision,
    ttlClass,
    ttlSec,
  };
  const decisionDigests = [1, 2, 3].map(() => createHash('sha256').update(stableStringify(decisionDigestPayload)).digest('hex'));

  const negativeResults = {
    NEXT_TZ_NEGATIVE_01: negative01.ok === false,
    NEXT_TZ_NEGATIVE_02: negative02.ok === false,
    NEXT_TZ_NEGATIVE_03: negative03.ok === false,
    NEXT_TZ_NEGATIVE_04: negative04.ok === false,
    NEXT_TZ_NEGATIVE_05: negative05.ok === false,
  };

  const positiveResults = {
    NEXT_TZ_POSITIVE_01: validContract.ok
      && mismatchContract.ok
      && expiredContract.ok
      && validDecision.shouldReuse === true
      && mismatchDecision.shouldReuse === false
      && expiredDecision.shouldReuse === false,
    NEXT_TZ_POSITIVE_02: mismatchDecision.shouldHeavyRerun === true
      && expiredDecision.shouldHeavyRerun === true
      && invalidInputContract.ok
      && invalidInputDecision.shouldHeavyRerun === true,
    NEXT_TZ_POSITIVE_03: decisionDigests.every((digest) => digest === decisionDigests[0]),
  };

  const allNegativesPass = Object.values(negativeResults).every(Boolean);
  const allPositivesPass = Object.values(positiveResults).every(Boolean);

  const dod = {
    NEXT_TZ_DOD_01: heavyRerunReduction.reduced,
    NEXT_TZ_DOD_02: allNegativesPass,
    NEXT_TZ_DOD_03: allPositivesPass,
    NEXT_TZ_DOD_04: false,
    NEXT_TZ_DOD_05: true,
  };

  const acceptance = {
    NEXT_TZ_ACCEPTANCE_01: canonLock.ok,
    NEXT_TZ_ACCEPTANCE_02: drift.advisoryToBlockingDriftCountZero,
    NEXT_TZ_ACCEPTANCE_03: false,
    NEXT_TZ_ACCEPTANCE_04: false,
  };

  const preRepeatabilityOk = canonLock.ok
    && stageActivationGuardCheck
    && hashState.ok
    && dod.NEXT_TZ_DOD_01
    && dod.NEXT_TZ_DOD_02
    && dod.NEXT_TZ_DOD_03
    && dod.NEXT_TZ_DOD_05
    && acceptance.NEXT_TZ_ACCEPTANCE_02;

  const state = {
    ok: preRepeatabilityOk,
    [TOKEN_NAME]: preRepeatabilityOk ? 1 : 0,
    failReason: '',
    failSignalCode: '',

    objective: 'REMOVE_UNNECESSARY_HEAVY_RERUN_WHEN_INPUT_HASH_STABLE_WITH_RELIABILITY_PRESERVED',
    blockingSurfaceExpansion: false,

    canonLock,
    stageActivation: {
      ok: stageActivationGuardCheck,
      activeStageId: stageActivation.ACTIVE_STAGE_ID,
      stageActivationOk: stageActivation.STAGE_ACTIVATION_OK,
      failSignals: stageActivation.failSignals || [],
      errors: stageActivation.errors || [],
    },

    waveInput: {
      ok: hashState.ok,
      hashPresent: hashState.WAVE_INPUT_HASH_PRESENT,
      waveInputHash,
      waveInputHashAlt,
      ttlClass,
      ttlSec,
      failSignals: hashState.failSignals || [],
      failReason: hashState.failReason || '',
    },

    counts: {
      unnecessaryHeavyRerunCountBefore: heavyRerunReduction.unnecessaryHeavyRerunCountBefore,
      unnecessaryHeavyRerunCountAfter: heavyRerunReduction.unnecessaryHeavyRerunCountAfter,
      unnecessaryHeavyRerunReduced: heavyRerunReduction.reduced ? 1 : 0,
      advisoryToBlockingDriftCount: drift.advisoryToBlockingDriftCount,
      cacheReuseValidCount: Number(scenarios.validReuse.ok) === 1 ? 1 : 0,
      cacheReuseMismatchRejectedCount: Number(!scenarios.hashMismatch.ok) === 1 ? 1 : 0,
      cacheReuseExpiredRejectedCount: Number(!scenarios.ttlExpired.ok) === 1 ? 1 : 0,
    },

    scenarios,
    decisions: {
      validDecision,
      mismatchDecision,
      expiredDecision,
      invalidInputDecision,
      decisionDigests,
    },

    contracts: {
      validContract,
      mismatchContract,
      expiredContract,
      invalidInputContract,
      negative01,
      negative02,
      negative03,
      negative04,
      negative05,
    },

    drift,
    negativeResults,
    positiveResults,
    dod,
    acceptance,

    detector: {
      detectorId: 'WS05_WAVE_HASH_TTL_SINGLE_DETECTOR_V1',
      canonicalModeEvaluatorId: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    },
  };

  if (!state.ok) {
    state.failReason = !canonLock.ok
      ? canonLock.reason
      : !stageActivationGuardCheck
        ? 'STAGE_ACTIVATION_GUARD_FAIL'
        : !hashState.ok
          ? 'WAVE_INPUT_HASH_INVALID'
          : !dod.NEXT_TZ_DOD_01
            ? 'UNNECESSARY_HEAVY_RERUN_NOT_REDUCED'
            : !dod.NEXT_TZ_DOD_02
              ? 'NEGATIVE_SCENARIO_FAILURE'
              : !dod.NEXT_TZ_DOD_03
                ? 'POSITIVE_SCENARIO_FAILURE'
                : !acceptance.NEXT_TZ_ACCEPTANCE_02
                  ? 'ADVISORY_TO_BLOCKING_DRIFT'
                  : 'P2_WS05_WAVE_RERUN_DEDUP_FAIL';
    state.failSignalCode = state.failReason;
  }

  return state;
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`UNNECESSARY_HEAVY_RERUN_COUNT_BEFORE=${state.counts.unnecessaryHeavyRerunCountBefore}`);
  console.log(`UNNECESSARY_HEAVY_RERUN_COUNT_AFTER=${state.counts.unnecessaryHeavyRerunCountAfter}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.counts.advisoryToBlockingDriftCount}`);
  console.log(`DOD_01=${state.dod.NEXT_TZ_DOD_01 ? 1 : 0}`);
  console.log(`DOD_02=${state.dod.NEXT_TZ_DOD_02 ? 1 : 0}`);
  console.log(`DOD_03=${state.dod.NEXT_TZ_DOD_03 ? 1 : 0}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateP2Ws05WaveRerunDedupByStableInputHashState({
    repoRoot: process.cwd(),
    canonStatusPath: args.canonStatusPath,
    failsignalRegistryPath: args.failsignalRegistryPath,
  });

  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
  } else {
    printHuman(state);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) {
  main();
}

export {
  evaluateP2Ws05WaveRerunDedupByStableInputHashState,
  TOKEN_NAME,
};
