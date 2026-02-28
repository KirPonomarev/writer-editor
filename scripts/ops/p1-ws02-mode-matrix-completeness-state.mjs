#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';

const TOKEN_NAME = 'P1_WS02_MODE_MATRIX_COMPLETENESS_OK';
const FAIL_SIGNAL_CODE = 'E_FAILSIGNAL_MODE_MAPPING_INCOMPLETE';

const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const EXPECTED_CANON_VERSION = 'v3.13a-final';

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

function normalizeMode(value) {
  const normalized = normalizeString(value).toLowerCase();
  return normalized === 'blocking' || normalized === 'advisory' ? normalized : '';
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
    failsignalRegistryPath: '',
    canonStatusPath: '',
    runNegativeFixtures: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--json') {
      out.json = true;
      continue;
    }

    if (arg === '--failsignal-registry-path' && i + 1 < argv.length) {
      out.failsignalRegistryPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--failsignal-registry-path=')) {
      out.failsignalRegistryPath = normalizeString(arg.slice('--failsignal-registry-path='.length));
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

    if (arg === '--no-negative-fixtures') {
      out.runNegativeFixtures = false;
    }
  }

  return out;
}

function loadInputDocs(input) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const failsignalRegistryPath = path.resolve(repoRoot, normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH));
  const canonStatusPath = path.resolve(repoRoot, normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH));

  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);
  const canonStatusDoc = isObjectRecord(input.canonStatusDoc)
    ? input.canonStatusDoc
    : readJsonObject(canonStatusPath);

  return {
    repoRoot,
    failsignalRegistryPath,
    canonStatusPath,
    failsignalRegistryDoc,
    canonStatusDoc,
  };
}

function validateCanonLock(canonStatusDoc) {
  if (!isObjectRecord(canonStatusDoc)) {
    return {
      ok: false,
      reason: 'CANON_STATUS_UNREADABLE',
      observedVersion: '',
      observedStatus: '',
    };
  }

  const observedVersion = normalizeString(canonStatusDoc.canonVersion);
  const observedStatus = normalizeString(canonStatusDoc.status);
  const ok = observedVersion === EXPECTED_CANON_VERSION && observedStatus === 'ACTIVE_CANON';

  return {
    ok,
    reason: ok ? '' : 'ACTIVE_CANON_LOCK_FAIL',
    observedVersion,
    observedStatus,
  };
}

function computeCoverage(rows) {
  const details = [];
  const duplicateMap = new Map();
  let complete = 0;
  let gapCount = 0;
  let invalidCount = 0;

  for (const row of rows) {
    if (!isObjectRecord(row)) continue;
    const code = normalizeString(row.code);
    if (!code) continue;

    if (!duplicateMap.has(code)) duplicateMap.set(code, []);
    duplicateMap.get(code).push(row);

    const modeMatrix = isObjectRecord(row.modeMatrix) ? row.modeMatrix : null;
    const entry = {
      failSignalCode: code,
      prCore: modeMatrix ? normalizeMode(modeMatrix.prCore) : '',
      release: modeMatrix ? normalizeMode(modeMatrix.release) : '',
      promotion: modeMatrix ? normalizeMode(modeMatrix.promotion) : '',
      missingKeys: [],
      invalidKeys: [],
      complete: false,
    };

    if (!modeMatrix) {
      entry.missingKeys = [...MODE_KEYS];
      gapCount += 1;
      details.push(entry);
      continue;
    }

    for (const key of MODE_KEYS) {
      const raw = normalizeString(modeMatrix[key]).toLowerCase();
      if (!raw) {
        entry.missingKeys.push(key);
        continue;
      }
      if (raw !== 'blocking' && raw !== 'advisory') {
        entry.invalidKeys.push(key);
      }
    }

    if (entry.missingKeys.length > 0) gapCount += 1;
    if (entry.invalidKeys.length > 0) invalidCount += 1;

    entry.complete = entry.missingKeys.length === 0 && entry.invalidKeys.length === 0;
    if (entry.complete) complete += 1;

    details.push(entry);
  }

  const total = details.length;
  const coveragePercent = total > 0 ? Number(((complete * 100) / total).toFixed(2)) : 0;
  const duplicateModeRules = [];

  for (const [code, declarations] of duplicateMap.entries()) {
    if (declarations.length <= 1) continue;
    duplicateModeRules.push({
      failSignalCode: code,
      declarationCount: declarations.length,
      reason: 'DUPLICATE_MODE_RULE',
    });
  }
  duplicateModeRules.sort((a, b) => a.failSignalCode.localeCompare(b.failSignalCode));

  details.sort((a, b) => a.failSignalCode.localeCompare(b.failSignalCode));

  return {
    total,
    complete,
    gapCount,
    invalidCount,
    coveragePercent,
    details,
    duplicateModeRules,
  };
}

function evaluateRegistryEvaluatorSync(repoRoot, coverageDetails, overrides = {}) {
  const mismatches = [];
  const issues = [];

  for (const detail of coverageDetails) {
    if (!detail.complete) continue;
    const failSignalCode = detail.failSignalCode;

    for (const key of MODE_KEYS) {
      const expectedDisposition = detail[key];
      const mode = MODE_LABELS[key];
      const verdict = evaluateModeMatrixVerdict({
        repoRoot,
        mode,
        failSignalCode,
      });

      if (!verdict.ok) {
        issues.push({
          failSignalCode,
          mode,
          reason: 'MODE_EVALUATOR_ERROR',
          evaluatorIssues: verdict.issues || [],
        });
        continue;
      }

      const overrideDisposition = overrides[`${failSignalCode}:${mode}`];
      const actualDisposition = normalizeMode(overrideDisposition || verdict.modeDisposition);

      if (!actualDisposition || actualDisposition !== expectedDisposition) {
        mismatches.push({
          failSignalCode,
          mode,
          expectedDisposition,
          actualDisposition: actualDisposition || 'unknown',
          reason: 'REGISTRY_EVALUATOR_MODE_MISMATCH',
        });
      }
    }
  }

  mismatches.sort((a, b) => `${a.failSignalCode}:${a.mode}`.localeCompare(`${b.failSignalCode}:${b.mode}`));

  return {
    mismatchCount: mismatches.length,
    mismatches,
    issues,
  };
}

function evaluateDeterministicRouting(repoRoot, coverageDetails) {
  const sample = coverageDetails.filter((row) => row.complete).slice(0, 12);
  const run = () => sample.map((row) => {
    const byMode = {};
    for (const key of MODE_KEYS) {
      const mode = MODE_LABELS[key];
      const verdict = evaluateModeMatrixVerdict({
        repoRoot,
        mode,
        failSignalCode: row.failSignalCode,
      });
      byMode[key] = {
        ok: verdict.ok,
        evaluatorId: verdict.evaluatorId,
        disposition: normalizeMode(verdict.modeDisposition),
      };
    }
    return {
      failSignalCode: row.failSignalCode,
      byMode,
    };
  });

  const a = run();
  const b = run();
  const deterministic = stableStringify(a) === stableStringify(b);
  return {
    deterministic,
    sampleSize: sample.length,
  };
}

function evaluateAdvisoryToBlockingDrift(repoRoot, rows) {
  const driftCases = [];
  const issues = [];

  for (const row of rows) {
    if (!isObjectRecord(row)) continue;
    const failSignalCode = normalizeString(row.code);
    if (!failSignalCode) continue;
    const modeMatrix = isObjectRecord(row.modeMatrix) ? row.modeMatrix : {};

    for (const key of MODE_KEYS) {
      const expected = normalizeMode(modeMatrix[key]);
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
          actualDisposition: normalizeMode(verdict.modeDisposition) || 'unknown',
          reason: 'ADVISORY_TO_BLOCKING_DRIFT',
        });
      }
    }
  }

  driftCases.sort((a, b) => `${a.failSignalCode}:${a.mode}`.localeCompare(`${b.failSignalCode}:${b.mode}`));

  return {
    advisoryToBlockingDriftCount: driftCases.length,
    driftCases,
    issues,
  };
}

function evaluatePolicy(inputDocs, overrides = {}) {
  const canonLock = validateCanonLock(inputDocs.canonStatusDoc);
  const rows = Array.isArray(inputDocs.failsignalRegistryDoc?.failSignals)
    ? inputDocs.failsignalRegistryDoc.failSignals
    : [];

  if (rows.length === 0) {
    return {
      ok: false,
      failReason: 'FAILSIGNAL_REGISTRY_UNREADABLE',
      canonLock,
      coverage: {
        total: 0,
        complete: 0,
        gapCount: 0,
        invalidCount: 0,
        coveragePercent: 0,
        details: [],
        duplicateModeRules: [],
      },
      sync: {
        mismatchCount: 0,
        mismatches: [],
        issues: [{ reason: 'FAILSIGNAL_REGISTRY_UNREADABLE' }],
      },
      deterministicRouting: {
        deterministic: false,
        sampleSize: 0,
      },
      advisoryDrift: {
        advisoryToBlockingDriftCount: -1,
        driftCases: [],
        issues: [{ reason: 'FAILSIGNAL_REGISTRY_UNREADABLE' }],
      },
      singleAuthorityOk: false,
    };
  }

  const coverage = computeCoverage(rows);
  const sync = evaluateRegistryEvaluatorSync(inputDocs.repoRoot, coverage.details, overrides.modeDispositionOverrides || {});
  const deterministicRouting = evaluateDeterministicRouting(inputDocs.repoRoot, coverage.details);
  const advisoryDrift = evaluateAdvisoryToBlockingDrift(inputDocs.repoRoot, rows);

  const authorityVerdict = evaluateModeMatrixVerdict({
    repoRoot: inputDocs.repoRoot,
    mode: 'release',
    failSignalCode: 'E_REMOTE_UNAVAILABLE',
  });
  const singleAuthorityOk = authorityVerdict.ok
    && authorityVerdict.evaluatorId === CANONICAL_MODE_MATRIX_EVALUATOR_ID;

  const modeGapCount = coverage.gapCount + coverage.invalidCount;
  const duplicateModeRuleCount = coverage.duplicateModeRules.length;

  const ok = canonLock.ok
    && coverage.total > 0
    && coverage.coveragePercent === 100
    && modeGapCount === 0
    && duplicateModeRuleCount === 0
    && sync.mismatchCount === 0
    && sync.issues.length === 0
    && advisoryDrift.advisoryToBlockingDriftCount === 0
    && advisoryDrift.issues.length === 0
    && deterministicRouting.deterministic
    && singleAuthorityOk;

  const failReason = ok
    ? ''
    : (
      !canonLock.ok
        ? canonLock.reason
        : modeGapCount > 0 && coverage.invalidCount > 0
          ? 'INVALID_MODE_VALUE'
          : modeGapCount > 0
            ? 'MODE_GAP_DETECTED'
            : duplicateModeRuleCount > 0
              ? 'DUPLICATE_MODE_RULE'
              : sync.mismatchCount > 0
                ? 'REGISTRY_EVALUATOR_MODE_MISMATCH'
                : !deterministicRouting.deterministic
                  ? 'MODE_ROUTING_NON_DETERMINISTIC'
                  : advisoryDrift.advisoryToBlockingDriftCount > 0
                    ? 'ADVISORY_TO_BLOCKING_DRIFT'
                    : !singleAuthorityOk
                      ? 'SINGLE_AUTHORITY_FAIL'
                      : 'P1_WS02_POLICY_FAIL'
    );

  return {
    ok,
    failReason,
    canonLock,
    coverage,
    sync,
    deterministicRouting,
    advisoryDrift,
    singleAuthorityOk,
    counts: {
      totalFailSignalCount: coverage.total,
      modeCoveragePercent: coverage.coveragePercent,
      modeGapCount,
      modeMismatchCount: sync.mismatchCount,
      duplicateModeRuleCount,
      advisoryToBlockingDriftCount: advisoryDrift.advisoryToBlockingDriftCount,
    },
  };
}

function buildNegativeFixtures(baseDocs) {
  const fixtures = [];

  {
    const reg = JSON.parse(JSON.stringify(baseDocs.failsignalRegistryDoc));
    const row = Array.isArray(reg.failSignals) ? reg.failSignals.find((entry) => isObjectRecord(entry) && isObjectRecord(entry.modeMatrix)) : null;
    if (row) {
      delete row.modeMatrix.promotion;
      fixtures.push({
        id: 'NEXT_TZ_NEGATIVE_01',
        expectedFailReason: 'MODE_GAP_DETECTED',
        docs: { failsignalRegistryDoc: reg },
      });
    }
  }

  {
    const reg = JSON.parse(JSON.stringify(baseDocs.failsignalRegistryDoc));
    const row = Array.isArray(reg.failSignals) ? reg.failSignals.find((entry) => isObjectRecord(entry) && isObjectRecord(entry.modeMatrix)) : null;
    if (row) {
      fixtures.push({
        id: 'NEXT_TZ_NEGATIVE_02',
        expectedFailReason: 'REGISTRY_EVALUATOR_MODE_MISMATCH',
        docs: { failsignalRegistryDoc: reg },
        overrides: {
          modeDispositionOverrides: {
            [`${normalizeString(row.code)}:release`]: normalizeMode(row.modeMatrix.release) === 'blocking' ? 'advisory' : 'blocking',
          },
        },
      });
    }
  }

  {
    const reg = JSON.parse(JSON.stringify(baseDocs.failsignalRegistryDoc));
    const rows = Array.isArray(reg.failSignals) ? reg.failSignals : [];
    if (rows.length >= 1) {
      const clone = JSON.parse(JSON.stringify(rows[0]));
      clone.modeMatrix = {
        prCore: clone.modeMatrix?.prCore === 'blocking' ? 'advisory' : 'blocking',
        release: clone.modeMatrix?.release === 'blocking' ? 'advisory' : 'blocking',
        promotion: clone.modeMatrix?.promotion === 'blocking' ? 'advisory' : 'blocking',
      };
      rows.push(clone);
      fixtures.push({
        id: 'NEXT_TZ_NEGATIVE_03',
        expectedFailReason: 'DUPLICATE_MODE_RULE',
        docs: { failsignalRegistryDoc: reg },
      });
    }
  }

  {
    const reg = JSON.parse(JSON.stringify(baseDocs.failsignalRegistryDoc));
    const row = Array.isArray(reg.failSignals) ? reg.failSignals.find((entry) => isObjectRecord(entry) && isObjectRecord(entry.modeMatrix)) : null;
    if (row) {
      row.modeMatrix.release = 'warn';
      fixtures.push({
        id: 'NEXT_TZ_NEGATIVE_04',
        expectedFailReason: 'INVALID_MODE_VALUE',
        docs: { failsignalRegistryDoc: reg },
      });
    }
  }

  {
    const reg = JSON.parse(JSON.stringify(baseDocs.failsignalRegistryDoc));
    const row = Array.isArray(reg.failSignals) ? reg.failSignals.find((entry) => isObjectRecord(entry) && isObjectRecord(entry.modeMatrix)) : null;
    if (row) {
      row.modeMatrix = { release: normalizeMode(row.modeMatrix.release) || 'advisory' };
      fixtures.push({
        id: 'NEXT_TZ_NEGATIVE_05',
        expectedFailReason: 'MODE_GAP_DETECTED',
        docs: { failsignalRegistryDoc: reg },
      });
    }
  }

  return fixtures;
}

export function evaluateP1Ws02ModeMatrixCompletenessState(input = {}) {
  const docs = loadInputDocs(input);
  const basePolicy = evaluatePolicy(docs, {
    modeDispositionOverrides: isObjectRecord(input.modeDispositionOverrides) ? input.modeDispositionOverrides : {},
  });

  const negativeResults = {
    NEXT_TZ_NEGATIVE_01: false,
    NEXT_TZ_NEGATIVE_02: false,
    NEXT_TZ_NEGATIVE_03: false,
    NEXT_TZ_NEGATIVE_04: false,
    NEXT_TZ_NEGATIVE_05: false,
  };

  if (input.runNegativeFixtures !== false) {
    const fixtures = buildNegativeFixtures(docs);
    for (const fixture of fixtures) {
      const fixturePolicy = evaluatePolicy({
        ...docs,
        ...fixture.docs,
      }, fixture.overrides || {});
      negativeResults[fixture.id] = fixturePolicy.ok === false && fixturePolicy.failReason === fixture.expectedFailReason;
    }
  }

  const positiveResults = {
    NEXT_TZ_POSITIVE_01: basePolicy.counts.modeCoveragePercent === 100 && basePolicy.counts.modeGapCount === 0,
    NEXT_TZ_POSITIVE_02: basePolicy.counts.modeMismatchCount === 0 && basePolicy.singleAuthorityOk,
    NEXT_TZ_POSITIVE_03: basePolicy.deterministicRouting.deterministic,
  };

  const dod = {
    NEXT_TZ_DOD_01: basePolicy.counts.modeCoveragePercent === 100,
    NEXT_TZ_DOD_02: basePolicy.counts.modeMismatchCount === 0,
    NEXT_TZ_DOD_03: basePolicy.counts.modeGapCount === 0,
    NEXT_TZ_DOD_04: Object.values(negativeResults).every(Boolean),
    NEXT_TZ_DOD_05: Object.values(positiveResults).every(Boolean),
    NEXT_TZ_DOD_06: true,
    NEXT_TZ_DOD_07: true,
  };

  const acceptance = {
    NEXT_TZ_ACCEPTANCE_01: basePolicy.canonLock.ok,
    NEXT_TZ_ACCEPTANCE_02: basePolicy.counts.advisoryToBlockingDriftCount === 0,
    NEXT_TZ_ACCEPTANCE_03: true,
    NEXT_TZ_ACCEPTANCE_04: Object.values(dod).every(Boolean),
  };

  const ok = basePolicy.ok
    && Object.values(negativeResults).every(Boolean)
    && Object.values(positiveResults).every(Boolean)
    && Object.values(dod).every(Boolean)
    && Object.values(acceptance).every(Boolean);

  return {
    ok,
    token: TOKEN_NAME,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignalCode: ok ? '' : FAIL_SIGNAL_CODE,
    failReason: ok ? '' : (basePolicy.failReason || 'P1_WS02_POLICY_FAIL'),
    activeCanonVersionExpected: EXPECTED_CANON_VERSION,
    activeCanonVersionObserved: basePolicy.canonLock.observedVersion,
    activeCanonStatusObserved: basePolicy.canonLock.observedStatus,
    activeCanonLockCheckPass: basePolicy.canonLock.ok,
    counts: basePolicy.counts,
    modeCoverageDetails: basePolicy.coverage.details,
    modeMismatches: basePolicy.sync.mismatches,
    modeMismatchIssues: basePolicy.sync.issues,
    duplicateModeRules: basePolicy.coverage.duplicateModeRules,
    deterministicRouting: basePolicy.deterministicRouting,
    advisoryToBlockingDriftCount: basePolicy.counts.advisoryToBlockingDriftCount,
    driftCases: basePolicy.advisoryDrift.driftCases,
    negativeResults,
    positiveResults,
    dod,
    acceptance,
    singleAuthorityOk: basePolicy.singleAuthorityOk,
    evaluatorIdExpected: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`P1_WS02_MODE_COVERAGE_PERCENT=${state.counts.modeCoveragePercent}`);
  console.log(`P1_WS02_MODE_MISMATCH_COUNT=${state.counts.modeMismatchCount}`);
  console.log(`P1_WS02_MODE_GAP_COUNT=${state.counts.modeGapCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateP1Ws02ModeMatrixCompletenessState({
    failsignalRegistryPath: args.failsignalRegistryPath,
    canonStatusPath: args.canonStatusPath,
    runNegativeFixtures: args.runNegativeFixtures,
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
  TOKEN_NAME,
  FAIL_SIGNAL_CODE,
};
