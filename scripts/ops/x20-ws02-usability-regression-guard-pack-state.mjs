#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';
import { evaluateResolveActiveStageState } from './resolve-active-stage.mjs';

const TOKEN_NAME = 'X20_WS02_USABILITY_REGRESSION_GUARD_PACK_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';
const DRIFT_PROBE_FAILSIGNAL = 'E_REMOTE_UNAVAILABLE';

const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_GUARD_PACK_DOC_PATH = 'docs/OPS/STATUS/X20_USABILITY_REGRESSION_GUARD_PACK_v1.json';

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

function toUniqueStrings(value, { sort = true } = {}) {
  const source = Array.isArray(value) ? value : [];
  const out = [];
  const seen = new Set();
  for (const raw of source) {
    const normalized = normalizeString(String(raw || ''));
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  if (sort) out.sort((a, b) => a.localeCompare(b));
  return out;
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
  const out = { json: false, canonStatusPath: '', failsignalRegistryPath: '' };
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
    return { ok: false, reason: 'CANON_STATUS_UNREADABLE', observedStatus: '', observedVersion: '' };
  }
  const observedStatus = normalizeString(canonStatusDoc.status);
  const observedVersion = normalizeString(canonStatusDoc.canonVersion);
  const ok = observedStatus === 'ACTIVE_CANON' && observedVersion.toLowerCase() === EXPECTED_CANON_VERSION;
  return { ok, reason: ok ? '' : 'ACTIVE_CANON_LOCK_FAIL', observedStatus, observedVersion };
}

function normalizeGuardPackDoc(doc) {
  const source = isObjectRecord(doc) ? doc : {};
  const guards = Array.isArray(source.guards) ? source.guards : [];

  return {
    schemaVersion: Number(source.schemaVersion) || 1,
    usabilityGuardPackVersion: normalizeString(source.usabilityGuardPackVersion),
    nonBlockingClassification: normalizeString(source.nonBlockingClassification).toLowerCase(),
    blockingSurfaceExpansion: source.blockingSurfaceExpansion === true,
    expectedChannelCount: Number(source.expectedChannelCount) || 0,
    expectedModeCount: Number(source.expectedModeCount) || 0,
    expectedProfileCount: Number(source.expectedProfileCount) || 0,
    requiredCriticalFlows: toUniqueStrings(source.requiredCriticalFlows),
    guards: guards
      .map((row) => ({
        guardId: normalizeString(row?.guardId),
        flowId: normalizeString(row?.flowId),
        statusRef: normalizeString(row?.statusRef),
        expectedToken: normalizeString(row?.expectedToken),
        requiredStatus: normalizeString(row?.requiredStatus),
        requiredZeroCountKeys: toUniqueStrings(row?.requiredZeroCountKeys),
        requiredPositiveCountKeys: toUniqueStrings(row?.requiredPositiveCountKeys),
      }))
      .filter((row) => row.guardId && row.flowId && row.statusRef),
  };
}

function uniqueIssueRows(rows, keyFn) {
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    const key = keyFn(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function readGuardStatusDoc(repoRoot, statusRef) {
  const absPath = path.resolve(repoRoot, statusRef);
  const doc = readJsonObject(absPath);
  return { absPath, doc };
}

function validateGuardPack({ repoRoot, guardPackDoc }) {
  const duplicateGuardIds = [];
  const duplicateFlowIds = [];
  const missingCriticalFlowGuards = [];
  const staleGuardReferences = [];
  const tokenMismatch = [];
  const statusMismatch = [];
  const modeProfileGuardGaps = [];
  const channelGuardMismatch = [];
  const requiredZeroViolations = [];
  const requiredPositiveViolations = [];

  const guardIdCounts = new Map();
  const flowIdCounts = new Map();
  for (const guard of guardPackDoc.guards) {
    guardIdCounts.set(guard.guardId, (guardIdCounts.get(guard.guardId) || 0) + 1);
    flowIdCounts.set(guard.flowId, (flowIdCounts.get(guard.flowId) || 0) + 1);
  }

  for (const [guardId, count] of guardIdCounts.entries()) {
    if (count > 1) duplicateGuardIds.push({ guardId, count, reason: 'DUPLICATE_GUARD_ID' });
  }
  for (const [flowId, count] of flowIdCounts.entries()) {
    if (count > 1) duplicateFlowIds.push({ flowId, count, reason: 'DUPLICATE_FLOW_GUARD' });
  }

  const flowIdSet = new Set(guardPackDoc.guards.map((guard) => guard.flowId));
  for (const flowId of guardPackDoc.requiredCriticalFlows) {
    if (!flowIdSet.has(flowId)) {
      missingCriticalFlowGuards.push({ flowId, reason: 'MISSING_CRITICAL_FLOW_GUARD' });
    }
  }

  const projectionRows = [];

  for (const guard of guardPackDoc.guards) {
    const { doc: statusDoc } = readGuardStatusDoc(repoRoot, guard.statusRef);
    if (!isObjectRecord(statusDoc)) {
      staleGuardReferences.push({ guardId: guard.guardId, flowId: guard.flowId, statusRef: guard.statusRef, reason: 'STALE_GUARD_REFERENCE' });
      continue;
    }

    if (normalizeString(statusDoc.token) !== guard.expectedToken) {
      tokenMismatch.push({
        guardId: guard.guardId,
        flowId: guard.flowId,
        expectedToken: guard.expectedToken,
        observedToken: normalizeString(statusDoc.token),
        reason: 'TOKEN_MISMATCH',
      });
    }

    if (normalizeString(statusDoc.status) !== guard.requiredStatus) {
      statusMismatch.push({
        guardId: guard.guardId,
        flowId: guard.flowId,
        expectedStatus: guard.requiredStatus,
        observedStatus: normalizeString(statusDoc.status),
        reason: 'STATUS_MISMATCH',
      });
    }

    const modeCount = Number(statusDoc.modeCount || 0);
    const profileCount = Number(statusDoc.profileCount || 0);
    const channelCount = Number(statusDoc.channelCount || 0);

    if (modeCount !== guardPackDoc.expectedModeCount || profileCount !== guardPackDoc.expectedProfileCount) {
      modeProfileGuardGaps.push({
        guardId: guard.guardId,
        flowId: guard.flowId,
        modeCount,
        expectedModeCount: guardPackDoc.expectedModeCount,
        profileCount,
        expectedProfileCount: guardPackDoc.expectedProfileCount,
        reason: 'MODE_PROFILE_GUARD_GAP',
      });
    }

    if (channelCount !== guardPackDoc.expectedChannelCount) {
      channelGuardMismatch.push({
        guardId: guard.guardId,
        flowId: guard.flowId,
        channelCount,
        expectedChannelCount: guardPackDoc.expectedChannelCount,
        reason: 'CHANNEL_GUARD_MISMATCH',
      });
    }

    for (const key of guard.requiredZeroCountKeys) {
      const value = Number(statusDoc[key] || 0);
      if (value !== 0) {
        requiredZeroViolations.push({
          guardId: guard.guardId,
          flowId: guard.flowId,
          countKey: key,
          observed: value,
          expected: 0,
          reason: 'REQUIRED_ZERO_VIOLATION',
        });
      }
    }

    for (const key of guard.requiredPositiveCountKeys) {
      const value = Number(statusDoc[key] || 0);
      if (value <= 0) {
        requiredPositiveViolations.push({
          guardId: guard.guardId,
          flowId: guard.flowId,
          countKey: key,
          observed: value,
          expected: '>0',
          reason: 'REQUIRED_POSITIVE_VIOLATION',
        });
      }
    }

    projectionRows.push({
      guardId: guard.guardId,
      flowId: guard.flowId,
      token: normalizeString(statusDoc.token),
      status: normalizeString(statusDoc.status),
      modeCount,
      profileCount,
      channelCount,
    });
  }

  const projection = projectionRows.sort((a, b) => {
    const left = `${a.guardId}|${a.flowId}|${a.token}`;
    const right = `${b.guardId}|${b.flowId}|${b.token}`;
    return left.localeCompare(right);
  });
  const projectionHash = createHash('sha256').update(stableStringify(projection)).digest('hex');

  const cleaned = {
    duplicateGuardIds: uniqueIssueRows(duplicateGuardIds, (row) => row.guardId),
    duplicateFlowIds: uniqueIssueRows(duplicateFlowIds, (row) => row.flowId),
    missingCriticalFlowGuards: uniqueIssueRows(missingCriticalFlowGuards, (row) => row.flowId),
    staleGuardReferences: uniqueIssueRows(staleGuardReferences, (row) => `${row.guardId}|${row.statusRef}`),
    tokenMismatch: uniqueIssueRows(tokenMismatch, (row) => `${row.guardId}|${row.observedToken}`),
    statusMismatch: uniqueIssueRows(statusMismatch, (row) => `${row.guardId}|${row.observedStatus}`),
    modeProfileGuardGaps: uniqueIssueRows(modeProfileGuardGaps, (row) => `${row.guardId}|${row.modeCount}|${row.profileCount}`),
    channelGuardMismatch: uniqueIssueRows(channelGuardMismatch, (row) => `${row.guardId}|${row.channelCount}`),
    requiredZeroViolations: uniqueIssueRows(requiredZeroViolations, (row) => `${row.guardId}|${row.countKey}|${row.observed}`),
    requiredPositiveViolations: uniqueIssueRows(requiredPositiveViolations, (row) => `${row.guardId}|${row.countKey}|${row.observed}`),
  };

  const ok = !guardPackDoc.blockingSurfaceExpansion
    && guardPackDoc.nonBlockingClassification === 'advisory_until_machine_bound'
    && cleaned.duplicateGuardIds.length === 0
    && cleaned.duplicateFlowIds.length === 0
    && cleaned.missingCriticalFlowGuards.length === 0
    && cleaned.staleGuardReferences.length === 0
    && cleaned.tokenMismatch.length === 0
    && cleaned.statusMismatch.length === 0
    && cleaned.modeProfileGuardGaps.length === 0
    && cleaned.channelGuardMismatch.length === 0
    && cleaned.requiredZeroViolations.length === 0
    && cleaned.requiredPositiveViolations.length === 0;

  return {
    ok,
    projection,
    projectionHash,
    guardCount: guardPackDoc.guards.length,
    requiredCriticalFlowCount: guardPackDoc.requiredCriticalFlows.length,
    ...cleaned,
  };
}

function evaluateDeterminism(validationFn) {
  const runA = validationFn();
  const runB = validationFn();
  const runC = validationFn();
  const deterministic = runA.ok && runB.ok && runC.ok
    && runA.projectionHash === runB.projectionHash
    && runB.projectionHash === runC.projectionHash;
  return { ok: deterministic, hashes: [runA.projectionHash, runB.projectionHash, runC.projectionHash] };
}

function evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc) {
  const failSignals = Array.isArray(failsignalRegistryDoc?.failSignals) ? failsignalRegistryDoc.failSignals : [];
  const driftCases = [];
  const issues = [];

  for (const row of failSignals) {
    if (!isObjectRecord(row)) continue;
    const failSignalCode = normalizeString(row.code);
    if (!failSignalCode || failSignalCode !== DRIFT_PROBE_FAILSIGNAL) continue;

    for (const key of MODE_KEYS) {
      const expected = normalizeString((row.modeMatrix || {})[key]).toLowerCase();
      if (expected !== 'advisory') continue;

      const verdict = evaluateModeMatrixVerdict({ repoRoot, mode: MODE_LABELS[key], failSignalCode });
      if (!verdict.ok) {
        issues.push({ failSignalCode, mode: MODE_LABELS[key], reason: 'MODE_EVALUATOR_ERROR', evaluatorIssues: verdict.issues || [] });
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

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function evaluateX20Ws02UsabilityRegressionGuardPackState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());

  const canonStatusPath = path.resolve(repoRoot, normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH));
  const failsignalRegistryPath = path.resolve(repoRoot, normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH));
  const guardPackPath = path.resolve(repoRoot, DEFAULT_GUARD_PACK_DOC_PATH);

  const canonStatusDoc = isObjectRecord(input.canonStatusDoc) ? input.canonStatusDoc : readJsonObject(canonStatusPath);
  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);
  const guardPackRaw = readJsonObject(guardPackPath);

  const guardPackDoc = normalizeGuardPackDoc(guardPackRaw);

  const canonLock = validateCanonLock(canonStatusDoc);
  const stageActivation = evaluateResolveActiveStageState({ profile: 'release', gateTier: 'release' });
  const stageActivationGuardCheck = Number(stageActivation.STAGE_ACTIVATION_OK) === 1;

  const validateCurrent = () => validateGuardPack({ repoRoot, guardPackDoc });

  const baseline = validateCurrent();
  const determinism = evaluateDeterminism(validateCurrent);

  const negative01Doc = deepClone(guardPackDoc);
  negative01Doc.guards = negative01Doc.guards.filter((row) => row.flowId !== 'error_hints');
  const negative01 = validateGuardPack({ repoRoot, guardPackDoc: negative01Doc });

  const negative02Doc = deepClone(guardPackDoc);
  if (negative02Doc.guards[0]) {
    negative02Doc.guards[0].statusRef = 'docs/OPS/STATUS/DOES_NOT_EXIST.json';
  }
  const negative02 = validateGuardPack({ repoRoot, guardPackDoc: negative02Doc });

  const negative03Doc = deepClone(guardPackDoc);
  negative03Doc.expectedModeCount = guardPackDoc.expectedModeCount + 1;
  const negative03 = validateGuardPack({ repoRoot, guardPackDoc: negative03Doc });

  const negative04Doc = deepClone(guardPackDoc);
  negative04Doc.expectedChannelCount = guardPackDoc.expectedChannelCount + 1;
  const negative04 = validateGuardPack({ repoRoot, guardPackDoc: negative04Doc });

  let nondeterministicRunIndex = 0;
  const negative05Determinism = evaluateDeterminism(() => {
    const result = validateGuardPack({ repoRoot, guardPackDoc });
    nondeterministicRunIndex += 1;
    if (nondeterministicRunIndex === 2) {
      result.projectionHash = createHash('sha256').update(`${result.projectionHash}:non-deterministic`).digest('hex');
    }
    return result;
  });

  const drift = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc);

  const negativeResults = {
    NEXT_TZ_NEGATIVE_01: negative01.missingCriticalFlowGuards.length > 0,
    NEXT_TZ_NEGATIVE_02: negative02.staleGuardReferences.length > 0,
    NEXT_TZ_NEGATIVE_03: negative03.modeProfileGuardGaps.length > 0,
    NEXT_TZ_NEGATIVE_04: negative04.channelGuardMismatch.length > 0,
    NEXT_TZ_NEGATIVE_05: negative05Determinism.ok === false,
  };

  const positiveResults = {
    NEXT_TZ_POSITIVE_01: baseline.missingCriticalFlowGuards.length === 0
      && baseline.staleGuardReferences.length === 0
      && baseline.requiredZeroViolations.length === 0
      && baseline.requiredPositiveViolations.length === 0,
    NEXT_TZ_POSITIVE_02: baseline.tokenMismatch.length === 0
      && baseline.statusMismatch.length === 0
      && baseline.modeProfileGuardGaps.length === 0
      && baseline.channelGuardMismatch.length === 0,
    NEXT_TZ_POSITIVE_03: determinism.ok,
  };

  const allNegativesPass = Object.values(negativeResults).every(Boolean);
  const allPositivesPass = Object.values(positiveResults).every(Boolean);

  const dod = {
    NEXT_TZ_DOD_01: baseline.ok,
    NEXT_TZ_DOD_02: allNegativesPass,
    NEXT_TZ_DOD_03: allPositivesPass,
    NEXT_TZ_DOD_04: determinism.ok,
    NEXT_TZ_DOD_05: guardPackDoc.blockingSurfaceExpansion === false,
    NEXT_TZ_DOD_06: drift.advisoryToBlockingDriftCountZero,
  };

  const acceptance = {
    NEXT_TZ_ACCEPTANCE_01: canonLock.ok,
    NEXT_TZ_ACCEPTANCE_02: stageActivationGuardCheck,
    NEXT_TZ_ACCEPTANCE_03: false,
    NEXT_TZ_ACCEPTANCE_04: false,
  };

  const ok = baseline.ok
    && allNegativesPass
    && allPositivesPass
    && canonLock.ok
    && stageActivationGuardCheck
    && drift.advisoryToBlockingDriftCountZero;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    canonLock,
    stageActivation: {
      ...stageActivation,
      STAGE_ACTIVATION_GUARD_CHECK: stageActivationGuardCheck ? 1 : 0,
    },
    blockingSurfaceExpansion: guardPackDoc.blockingSurfaceExpansion === true,
    baseline,
    determinism,
    counts: {
      guardCount: baseline.guardCount,
      requiredCriticalFlowCount: baseline.requiredCriticalFlowCount,
      missingCriticalFlowGuardCount: baseline.missingCriticalFlowGuards.length,
      staleGuardReferenceCount: baseline.staleGuardReferences.length,
      tokenMismatchCount: baseline.tokenMismatch.length,
      statusMismatchCount: baseline.statusMismatch.length,
      modeProfileGuardGapCount: baseline.modeProfileGuardGaps.length,
      channelGuardMismatchCount: baseline.channelGuardMismatch.length,
      requiredZeroViolationCount: baseline.requiredZeroViolations.length,
      requiredPositiveViolationCount: baseline.requiredPositiveViolations.length,
      duplicateGuardIdCount: baseline.duplicateGuardIds.length,
      duplicateFlowGuardCount: baseline.duplicateFlowIds.length,
      advisoryToBlockingDriftCount: drift.advisoryToBlockingDriftCount,
      expectedChannelCount: guardPackDoc.expectedChannelCount,
      expectedModeCount: guardPackDoc.expectedModeCount,
      expectedProfileCount: guardPackDoc.expectedProfileCount,
    },
    negativeResults,
    positiveResults,
    dod,
    acceptance,
    drift,
    detector: {
      detectorId: 'X20_WS02_USABILITY_GUARD_PACK_SINGLE_DETECTOR_V1',
      canonicalModeEvaluatorId: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
      contentHash: createHash('sha256').update(stableStringify({
        baseline: {
          projectionHash: baseline.projectionHash,
          guardCount: baseline.guardCount,
          requiredCriticalFlowCount: baseline.requiredCriticalFlowCount,
        },
        counts: {
          missingCriticalFlowGuardCount: baseline.missingCriticalFlowGuards.length,
          staleGuardReferenceCount: baseline.staleGuardReferences.length,
          tokenMismatchCount: baseline.tokenMismatch.length,
          statusMismatchCount: baseline.statusMismatch.length,
          modeProfileGuardGapCount: baseline.modeProfileGuardGaps.length,
          channelGuardMismatchCount: baseline.channelGuardMismatch.length,
          requiredZeroViolationCount: baseline.requiredZeroViolations.length,
          requiredPositiveViolationCount: baseline.requiredPositiveViolations.length,
          duplicateGuardIdCount: baseline.duplicateGuardIds.length,
          duplicateFlowGuardCount: baseline.duplicateFlowIds.length,
          advisoryToBlockingDriftCount: drift.advisoryToBlockingDriftCount,
        },
      })).digest('hex'),
    },
    negativeDetails: {
      NEXT_TZ_NEGATIVE_01: negative01,
      NEXT_TZ_NEGATIVE_02: negative02,
      NEXT_TZ_NEGATIVE_03: negative03,
      NEXT_TZ_NEGATIVE_04: negative04,
      NEXT_TZ_NEGATIVE_05: {
        determinism: negative05Determinism,
      },
    },
    sourceBinding: {
      guardPackDocPath: DEFAULT_GUARD_PACK_DOC_PATH,
      canonStatusPath: normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH),
      failsignalRegistryPath: normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateX20Ws02UsabilityRegressionGuardPackState({
    repoRoot: process.cwd(),
    canonStatusPath: args.canonStatusPath,
    failsignalRegistryPath: args.failsignalRegistryPath,
  });

  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
    process.exit(state.ok ? 0 : 1);
  }

  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`CANON_LOCK_CHECK=${state.canonLock.ok ? 'PASS' : 'FAIL'}`);
  console.log(`STAGE_ACTIVATION_GUARD_CHECK=${state.stageActivation.STAGE_ACTIVATION_GUARD_CHECK === 1 ? 'PASS' : 'FAIL'}`);
  console.log(`MISSING_CRITICAL_FLOW_GUARD_COUNT=${state.counts.missingCriticalFlowGuardCount}`);
  console.log(`STALE_GUARD_REFERENCE_COUNT=${state.counts.staleGuardReferenceCount}`);
  console.log(`MODE_PROFILE_GUARD_GAP_COUNT=${state.counts.modeProfileGuardGapCount}`);
  console.log(`CHANNEL_GUARD_MISMATCH_COUNT=${state.counts.channelGuardMismatchCount}`);
  console.log(`NON_DETERMINISTIC_GUARD_SUMMARY_COUNT=${state.negativeResults.NEXT_TZ_NEGATIVE_05 ? 0 : 1}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.counts.advisoryToBlockingDriftCount}`);
  console.log(`REPEATABILITY_HASHES=${state.determinism.hashes.join(',')}`);
  process.exit(state.ok ? 0 : 1);
}

export { evaluateX20Ws02UsabilityRegressionGuardPackState };

const thisFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(thisFilePath)) {
  main();
}
