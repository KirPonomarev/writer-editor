#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';

const TOKEN_NAME = 'FULL_CROSS_PLATFORM_PARITY_EXPANSION_OK';
const FAIL_SIGNAL_CODE = 'E_FULL_CROSS_PLATFORM_PARITY_EXPANSION';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const REQUIRED_PLATFORMS = Object.freeze(['web', 'windows', 'linux', 'android', 'ios']);
const REQUIRED_RELEASE_CRITICAL_PATHS = Object.freeze([
  'open',
  'edit',
  'save',
  'reopen',
  'recover',
  'export_docx',
  'export_markdown',
  'roundtrip_e2e',
]);

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
    failsignalRegistryPath: '',
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
    }
  }

  return out;
}

function buildDefaultFixtureDoc() {
  const criticalPaths = Object.fromEntries(REQUIRED_RELEASE_CRITICAL_PATHS.map((key) => [key, 'PASS']));
  const fixturesByPlatform = {};
  for (const platform of REQUIRED_PLATFORMS) {
    fixturesByPlatform[platform] = {
      platform,
      deterministicFixtureSetId: `xplat-${platform}-fixtures-v1`,
      fixturesTotal: REQUIRED_RELEASE_CRITICAL_PATHS.length + 4,
      releaseCriticalPaths: { ...criticalPaths },
      nonCriticalPaths: {
        import_txt: 'PASS',
        import_md: 'PASS',
        export_txt: 'PASS',
        search_replace: 'PASS',
      },
    };
  }
  return {
    schemaVersion: 'xplat-parity-fixtures.v1',
    platforms: [...REQUIRED_PLATFORMS],
    releaseCriticalPaths: [...REQUIRED_RELEASE_CRITICAL_PATHS],
    fixturesByPlatform,
  };
}

function evaluatePlatformParityMatrixComplete(fixtureDoc) {
  const platforms = Array.isArray(fixtureDoc?.platforms)
    ? fixtureDoc.platforms.map((entry) => normalizeString(entry).toLowerCase()).filter(Boolean)
    : [];
  const fixturesByPlatform = isObjectRecord(fixtureDoc?.fixturesByPlatform) ? fixtureDoc.fixturesByPlatform : {};

  const missingPlatforms = REQUIRED_PLATFORMS.filter((platform) => !platforms.includes(platform));
  const unexpectedPlatforms = platforms.filter((platform) => !REQUIRED_PLATFORMS.includes(platform));
  const incompletePaths = [];
  const matrix = [];

  for (const platform of REQUIRED_PLATFORMS) {
    const platformRow = fixturesByPlatform[platform];
    const criticalPaths = isObjectRecord(platformRow?.releaseCriticalPaths) ? platformRow.releaseCriticalPaths : {};
    const pathStatuses = {};
    for (const criticalPath of REQUIRED_RELEASE_CRITICAL_PATHS) {
      const status = normalizeString(criticalPaths[criticalPath]).toUpperCase();
      pathStatuses[criticalPath] = status || 'MISSING';
      if (!status) {
        incompletePaths.push({
          platform,
          criticalPath,
          reason: 'MISSING_PATH_STATUS',
        });
      }
    }
    matrix.push({
      platform,
      deterministicFixtureSetId: normalizeString(platformRow?.deterministicFixtureSetId),
      fixturesTotal: Number.isFinite(Number(platformRow?.fixturesTotal)) ? Number(platformRow.fixturesTotal) : 0,
      releaseCriticalPaths: pathStatuses,
    });
  }

  return {
    ok: missingPlatforms.length === 0 && unexpectedPlatforms.length === 0 && incompletePaths.length === 0,
    requiredPlatforms: [...REQUIRED_PLATFORMS],
    releaseCriticalPaths: [...REQUIRED_RELEASE_CRITICAL_PATHS],
    missingPlatforms,
    unexpectedPlatforms,
    incompletePaths,
    matrix,
  };
}

function evaluateReleaseCriticalPathsParity(matrixState) {
  const mismatches = [];
  const perPathStatus = {};
  for (const criticalPath of REQUIRED_RELEASE_CRITICAL_PATHS) {
    const statuses = matrixState.matrix.map((row) => ({
      platform: row.platform,
      status: normalizeString(row.releaseCriticalPaths?.[criticalPath]).toUpperCase() || 'MISSING',
    }));
    const uniqueStatuses = [...new Set(statuses.map((entry) => entry.status))];
    perPathStatus[criticalPath] = statuses;
    if (uniqueStatuses.length !== 1 || uniqueStatuses[0] !== 'PASS') {
      mismatches.push({
        criticalPath,
        statuses,
        reason: uniqueStatuses.length === 1 ? 'NOT_PASS' : 'STATUS_MISMATCH',
      });
    }
  }

  return {
    ok: mismatches.length === 0,
    mismatches,
    perPathStatus,
  };
}

function evaluateCrossPlatformGapReport(matrixState, parityState) {
  const platformGaps = matrixState.matrix.map((row) => {
    const missingPathCount = REQUIRED_RELEASE_CRITICAL_PATHS
      .filter((criticalPath) => normalizeString(row.releaseCriticalPaths?.[criticalPath]).toUpperCase() === 'MISSING')
      .length;
    const failingPathCount = REQUIRED_RELEASE_CRITICAL_PATHS
      .filter((criticalPath) => normalizeString(row.releaseCriticalPaths?.[criticalPath]).toUpperCase() !== 'PASS')
      .length;
    return {
      platform: row.platform,
      missingPathCount,
      failingPathCount,
      deterministicFixtureSetId: row.deterministicFixtureSetId,
      fixturesTotal: row.fixturesTotal,
    };
  });

  const totalMissingPaths = platformGaps.reduce((acc, row) => acc + row.missingPathCount, 0);
  const totalFailingPaths = platformGaps.reduce((acc, row) => acc + row.failingPathCount, 0);
  const parityMismatchCount = parityState.mismatches.length;

  return {
    ok: totalMissingPaths === 0 && totalFailingPaths === 0 && parityMismatchCount === 0,
    totalMissingPaths,
    totalFailingPaths,
    parityMismatchCount,
    platformGaps,
  };
}

function runNegativeMutations(fixtureDoc) {
  const negativeCases = [];

  {
    const mutated = JSON.parse(JSON.stringify(fixtureDoc));
    mutated.platforms = ['web', 'windows', 'linux', 'android'];
    const matrixState = evaluatePlatformParityMatrixComplete(mutated);
    negativeCases.push({
      caseId: 'missing_platform_ios_rejected',
      pass: matrixState.ok === false && matrixState.missingPlatforms.includes('ios'),
      observed: {
        matrixOk: matrixState.ok,
        missingPlatforms: matrixState.missingPlatforms,
      },
    });
  }

  {
    const mutated = JSON.parse(JSON.stringify(fixtureDoc));
    mutated.fixturesByPlatform.android.releaseCriticalPaths.export_docx = 'FAIL';
    const matrixState = evaluatePlatformParityMatrixComplete(mutated);
    const parityState = evaluateReleaseCriticalPathsParity(matrixState);
    const gapState = evaluateCrossPlatformGapReport(matrixState, parityState);
    negativeCases.push({
      caseId: 'release_critical_mismatch_rejected',
      pass: matrixState.ok && parityState.ok === false && gapState.ok === false,
      observed: {
        matrixOk: matrixState.ok,
        parityOk: parityState.ok,
        gapOk: gapState.ok,
      },
    });
  }

  {
    const mutated = JSON.parse(JSON.stringify(fixtureDoc));
    delete mutated.fixturesByPlatform.web.releaseCriticalPaths.recover;
    const matrixState = evaluatePlatformParityMatrixComplete(mutated);
    negativeCases.push({
      caseId: 'missing_release_critical_path_status_rejected',
      pass: matrixState.ok === false && matrixState.incompletePaths.some((row) => row.platform === 'web' && row.criticalPath === 'recover'),
      observed: {
        matrixOk: matrixState.ok,
        incompletePaths: matrixState.incompletePaths,
      },
    });
  }

  return {
    ok: negativeCases.every((entry) => entry.pass),
    cases: negativeCases,
  };
}

function evaluateSingleBlockingAuthority(repoRoot) {
  const verdict = evaluateModeMatrixVerdict({
    repoRoot,
    mode: 'pr',
    failSignalCode: 'E_REMOTE_UNAVAILABLE',
  });

  return {
    ok: verdict.ok && verdict.evaluatorId === CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    evaluatorIdObserved: verdict.evaluatorId,
    evaluatorIdExpected: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    issues: verdict.issues || [],
  };
}

function evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc) {
  const modePairs = [
    { mode: 'pr', key: 'prCore' },
    { mode: 'release', key: 'release' },
    { mode: 'promotion', key: 'promotion' },
  ];

  const failSignals = Array.isArray(failsignalRegistryDoc?.failSignals) ? failsignalRegistryDoc.failSignals : [];
  const driftCases = [];
  const issues = [];

  for (const row of failSignals) {
    if (!isObjectRecord(row)) continue;
    const failSignalCode = normalizeString(row.code);
    if (!failSignalCode) continue;

    for (const pair of modePairs) {
      const expectedDisposition = normalizeString((row.modeMatrix || {})[pair.key]).toLowerCase();
      if (expectedDisposition !== 'advisory') continue;

      const verdict = evaluateModeMatrixVerdict({
        repoRoot,
        mode: pair.mode,
        failSignalCode,
      });

      if (!verdict.ok) {
        issues.push({
          code: 'MODE_EVALUATOR_ERROR',
          failSignalCode,
          mode: pair.mode,
          evaluatorIssues: verdict.issues || [],
        });
        continue;
      }

      if (verdict.shouldBlock) {
        driftCases.push({
          failSignalCode,
          mode: pair.mode,
          expectedDisposition,
          actualDisposition: verdict.modeDisposition,
          actualShouldBlock: verdict.shouldBlock,
          reason: 'ADVISORY_TO_BLOCKING_DRIFT',
        });
      }
    }
  }

  return {
    ok: issues.length === 0,
    advisoryToBlockingDriftCount: driftCases.length,
    driftCases,
    issues,
  };
}

export function evaluateFullCrossPlatformParityState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const failsignalRegistryPath = path.resolve(
    repoRoot,
    normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
  );

  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);
  const fixtureDoc = isObjectRecord(input.fixtureDoc) ? input.fixtureDoc : buildDefaultFixtureDoc();

  const issues = [];
  if (!failsignalRegistryDoc || !Array.isArray(failsignalRegistryDoc.failSignals)) {
    issues.push({ code: 'FAILSIGNAL_REGISTRY_UNREADABLE' });
  }

  const matrixState = evaluatePlatformParityMatrixComplete(fixtureDoc);
  const parityState = evaluateReleaseCriticalPathsParity(matrixState);
  const gapState = evaluateCrossPlatformGapReport(matrixState, parityState);
  const negativeState = runNegativeMutations(fixtureDoc);

  const singleBlockingAuthority = evaluateSingleBlockingAuthority(repoRoot);
  const driftState = failsignalRegistryDoc
    ? evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc)
    : {
        ok: false,
        advisoryToBlockingDriftCount: -1,
        driftCases: [],
        issues: [{ code: 'FAILSIGNAL_REGISTRY_UNREADABLE' }],
      };
  const advisoryToBlockingDriftCountZero = driftState.advisoryToBlockingDriftCount === 0;

  issues.push(...(singleBlockingAuthority.issues || []), ...(driftState.issues || []));

  const ok = issues.length === 0
    && matrixState.ok
    && parityState.ok
    && negativeState.ok
    && gapState.ok
    && advisoryToBlockingDriftCountZero
    && singleBlockingAuthority.ok;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignalCode: ok ? '' : FAIL_SIGNAL_CODE,
    failReason: ok ? '' : (
      !matrixState.ok
        ? 'E_PLATFORM_PARITY_MATRIX_INCOMPLETE'
        : !parityState.ok
          ? 'E_RELEASE_CRITICAL_PARITY_FAIL'
          : !negativeState.ok
            ? 'E_CROSS_PLATFORM_NEGATIVE_CASES_FAIL'
            : !gapState.ok
              ? 'E_CROSS_PLATFORM_GAP_NONZERO'
              : !advisoryToBlockingDriftCountZero
                ? 'ADVISORY_TO_BLOCKING_DRIFT'
                : 'E_POLICY_OR_SECURITY_CONFLICT'
    ),
    fixtureDoc,
    matrixState,
    parityState,
    gapState,
    negativeState,
    singleBlockingAuthority,
    advisoryToBlockingDriftCount: driftState.advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero,
    driftCases: driftState.driftCases,
    failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),
    issues,
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`P2_05_PLATFORM_PARITY_MATRIX_COMPLETE_OK=${state.matrixState.ok ? 1 : 0}`);
  console.log(`P2_05_RELEASE_CRITICAL_PATHS_PARITY_OK=${state.parityState.ok ? 1 : 0}`);
  console.log(`P2_05_CROSS_PLATFORM_NEGATIVE_CASES_OK=${state.negativeState.ok ? 1 : 0}`);
  console.log(`P2_05_GAP_REPORT_ZERO_FOR_RELEASE_CRITICAL_OK=${state.gapState.ok ? 1 : 0}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.advisoryToBlockingDriftCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateFullCrossPlatformParityState({
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
  TOKEN_NAME,
  FAIL_SIGNAL_CODE,
  REQUIRED_PLATFORMS,
  REQUIRED_RELEASE_CRITICAL_PATHS,
};
