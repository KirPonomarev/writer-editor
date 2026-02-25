#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';

const TOKEN_NAME = 'MODE_AWARE_EXIT_POLICY_OK';
const FAIL_SIGNAL_CODE = 'E_GOVERNANCE_STRICT_FAIL';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';

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

function parseDisposition(value) {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === 'advisory') return 'advisory';
  if (normalized === 'blocking') return 'blocking';
  return '';
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

function buildModeRoutingCases(registryDoc) {
  const rows = Array.isArray(registryDoc.failSignals) ? registryDoc.failSignals : [];

  function findCase(modeKey, expectedDisposition) {
    return rows.find((row) => {
      if (!isObjectRecord(row)) return false;
      const code = normalizeString(row.code);
      if (!code) return false;
      const modeDisposition = parseDisposition((row.modeMatrix || {})[modeKey]);
      return modeDisposition === expectedDisposition;
    }) || null;
  }

  const cases = [];
  const prAdvisory = findCase('prCore', 'advisory');
  const releaseBlocking = findCase('release', 'blocking');
  const promotionBlocking = findCase('promotion', 'blocking');

  if (prAdvisory) {
    cases.push({
      caseId: 'pr_advisory_case',
      mode: 'pr',
      modeKey: 'prCore',
      failSignalCode: prAdvisory.code,
      expectedDisposition: 'advisory',
      expectedShouldBlock: false,
    });
  }

  if (releaseBlocking) {
    cases.push({
      caseId: 'release_blocking_case',
      mode: 'release',
      modeKey: 'release',
      failSignalCode: releaseBlocking.code,
      expectedDisposition: 'blocking',
      expectedShouldBlock: true,
    });
  }

  if (promotionBlocking) {
    cases.push({
      caseId: 'promotion_blocking_case',
      mode: 'promotion',
      modeKey: 'promotion',
      failSignalCode: promotionBlocking.code,
      expectedDisposition: 'blocking',
      expectedShouldBlock: true,
    });
  }

  return cases;
}

function evaluateModeRouting(repoRoot, cases) {
  const caseResults = [];

  for (const oneCase of cases) {
    const verdict = evaluateModeMatrixVerdict({
      repoRoot,
      mode: oneCase.mode,
      failSignalCode: oneCase.failSignalCode,
    });

    const ok = verdict.ok
      && verdict.evaluatorId === CANONICAL_MODE_MATRIX_EVALUATOR_ID
      && verdict.modeDisposition === oneCase.expectedDisposition
      && verdict.shouldBlock === oneCase.expectedShouldBlock;

    caseResults.push({
      ...oneCase,
      ok,
      actual: {
        evaluatorId: verdict.evaluatorId,
        modeDisposition: verdict.modeDisposition,
        shouldBlock: verdict.shouldBlock,
        verdictOk: verdict.ok,
        issues: verdict.issues || [],
      },
    });
  }

  return {
    ok: caseResults.length >= 3 && caseResults.every((entry) => entry.ok),
    caseResults,
  };
}

function evaluateAdvisoryDrift(repoRoot, registryDoc) {
  const rows = Array.isArray(registryDoc.failSignals) ? registryDoc.failSignals : [];
  const driftCases = [];
  const issues = [];
  const modePairs = [
    { mode: 'pr', key: 'prCore' },
    { mode: 'release', key: 'release' },
    { mode: 'promotion', key: 'promotion' },
  ];

  for (const row of rows) {
    if (!isObjectRecord(row)) continue;
    const failSignalCode = normalizeString(row.code);
    if (!failSignalCode) continue;

    for (const modePair of modePairs) {
      const expectedDisposition = parseDisposition((row.modeMatrix || {})[modePair.key]);
      if (expectedDisposition !== 'advisory') continue;

      const verdict = evaluateModeMatrixVerdict({
        repoRoot,
        mode: modePair.mode,
        failSignalCode,
      });

      if (!verdict.ok) {
        issues.push({
          code: 'MODE_EVALUATOR_ERROR',
          failSignalCode,
          mode: modePair.mode,
          evaluatorIssues: verdict.issues || [],
        });
        continue;
      }

      if (verdict.shouldBlock) {
        driftCases.push({
          failSignalCode,
          mode: modePair.mode,
          expectedDisposition,
          actualDisposition: verdict.modeDisposition,
          actualShouldBlock: verdict.shouldBlock,
          reason: 'ADVISORY_BLOCKING_DRIFT_DETECTED',
        });
      }
    }
  }

  return {
    ok: issues.length === 0 && driftCases.length === 0,
    advisoryToBlockingDriftCount: driftCases.length,
    driftCases,
    issues,
  };
}

function evaluateExitPolicyBeforeAfter(repoRoot, registryDoc) {
  const rows = Array.isArray(registryDoc.failSignals) ? registryDoc.failSignals : [];
  const modePairs = [
    { mode: 'pr', key: 'prCore' },
    { mode: 'release', key: 'release' },
    { mode: 'promotion', key: 'promotion' },
  ];

  const mismatches = [];
  let comparableCount = 0;

  for (const row of rows) {
    if (!isObjectRecord(row)) continue;
    const failSignalCode = normalizeString(row.code);
    if (!failSignalCode) continue;

    for (const modePair of modePairs) {
      const expectedDisposition = parseDisposition((row.modeMatrix || {})[modePair.key]);
      if (!expectedDisposition) continue;
      comparableCount += 1;

      const beforeShouldBlock = expectedDisposition === 'blocking';
      const verdict = evaluateModeMatrixVerdict({
        repoRoot,
        mode: modePair.mode,
        failSignalCode,
      });

      const mismatch = !verdict.ok
        || verdict.modeDisposition !== expectedDisposition
        || verdict.shouldBlock !== beforeShouldBlock;

      if (mismatch) {
        mismatches.push({
          failSignalCode,
          mode: modePair.mode,
          expectedDisposition,
          beforeShouldBlock,
          afterDisposition: verdict.modeDisposition,
          afterShouldBlock: verdict.shouldBlock,
          verdictOk: verdict.ok,
          issues: verdict.issues || [],
        });
      }
    }
  }

  return {
    ok: comparableCount > 0 && mismatches.length === 0,
    comparableCount,
    mismatchCount: mismatches.length,
    mismatches,
  };
}

function evaluateReleasePromotionParity(repoRoot, registryDoc) {
  const rows = Array.isArray(registryDoc.failSignals) ? registryDoc.failSignals : [];
  const mismatches = [];
  let comparableCount = 0;

  for (const row of rows) {
    if (!isObjectRecord(row)) continue;
    const failSignalCode = normalizeString(row.code);
    if (!failSignalCode) continue;

    const releaseDisposition = parseDisposition((row.modeMatrix || {}).release);
    const promotionDisposition = parseDisposition((row.modeMatrix || {}).promotion);
    if (!releaseDisposition || !promotionDisposition || releaseDisposition !== promotionDisposition) continue;

    comparableCount += 1;
    const releaseVerdict = evaluateModeMatrixVerdict({
      repoRoot,
      mode: 'release',
      failSignalCode,
    });
    const promotionVerdict = evaluateModeMatrixVerdict({
      repoRoot,
      mode: 'promotion',
      failSignalCode,
    });

    const mismatch = !releaseVerdict.ok
      || !promotionVerdict.ok
      || releaseVerdict.shouldBlock !== promotionVerdict.shouldBlock;

    if (mismatch) {
      mismatches.push({
        failSignalCode,
        expectedDisposition: releaseDisposition,
        release: {
          modeDisposition: releaseVerdict.modeDisposition,
          shouldBlock: releaseVerdict.shouldBlock,
          ok: releaseVerdict.ok,
        },
        promotion: {
          modeDisposition: promotionVerdict.modeDisposition,
          shouldBlock: promotionVerdict.shouldBlock,
          ok: promotionVerdict.ok,
        },
      });
    }
  }

  return {
    ok: comparableCount > 0 && mismatches.length === 0,
    comparableCount,
    mismatchCount: mismatches.length,
    mismatches,
  };
}

export function evaluateModeAwareExitPolicyState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const failsignalRegistryPath = path.resolve(
    repoRoot,
    normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
  );

  const registryDoc = readJsonObject(failsignalRegistryPath);
  if (!registryDoc || !Array.isArray(registryDoc.failSignals)) {
    return {
      ok: false,
      [TOKEN_NAME]: 0,
      failSignalCode: FAIL_SIGNAL_CODE,
      failReason: 'MODE_ROUTING_REGRESSION',
      advisoryToBlockingDriftCount: -1,
      advisoryToBlockingDriftCountZero: false,
      modeRouting: {
        ok: false,
        caseResults: [],
      },
      exitPolicyBeforeAfter: {
        ok: false,
        comparableCount: 0,
        mismatchCount: 0,
        mismatches: [],
      },
      releasePromotionParity: {
        ok: false,
        comparableCount: 0,
        mismatchCount: 0,
        mismatches: [],
      },
      driftCases: [],
      failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),
      issues: [
        {
          code: 'FAILSIGNAL_REGISTRY_UNREADABLE',
        },
      ],
    };
  }

  const modeRoutingCases = Array.isArray(input.modeRoutingCases)
    ? input.modeRoutingCases
    : buildModeRoutingCases(registryDoc);
  const modeRouting = evaluateModeRouting(repoRoot, modeRoutingCases);
  const drift = evaluateAdvisoryDrift(repoRoot, registryDoc);
  const exitPolicyBeforeAfter = evaluateExitPolicyBeforeAfter(repoRoot, registryDoc);
  const releasePromotionParity = evaluateReleasePromotionParity(repoRoot, registryDoc);
  const issues = [...drift.issues];

  const advisoryToBlockingDriftCount = drift.advisoryToBlockingDriftCount;
  const advisoryToBlockingDriftCountZero = advisoryToBlockingDriftCount === 0;

  const ok = modeRouting.ok
    && drift.ok
    && exitPolicyBeforeAfter.ok
    && releasePromotionParity.ok
    && advisoryToBlockingDriftCountZero
    && issues.length === 0;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignalCode: ok ? '' : FAIL_SIGNAL_CODE,
    failReason: ok ? '' : (
      !modeRouting.ok
        ? 'MODE_ROUTING_REGRESSION'
        : !drift.ok || !advisoryToBlockingDriftCountZero
          ? 'ADVISORY_BLOCKING_DRIFT_DETECTED'
          : !releasePromotionParity.ok
            ? 'EXIT_PARITY_FAIL'
            : 'EXIT_POLICY_BEFORE_AFTER_MISMATCH'
    ),
    evaluatorId: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero,
    modeRouting,
    exitPolicyBeforeAfter,
    releasePromotionParity,
    driftCases: drift.driftCases,
    failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),
    issues,
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`P1_02_MODE_ROUTING_OK=${state.modeRouting.ok ? 1 : 0}`);
  console.log(`P1_02_ADVISORY_DRIFT_COUNT=${state.advisoryToBlockingDriftCount}`);
  console.log(`P1_02_ADVISORY_DRIFT_COUNT_ZERO=${state.advisoryToBlockingDriftCountZero ? 1 : 0}`);
  console.log(`P1_02_EXIT_BEFORE_AFTER_OK=${state.exitPolicyBeforeAfter.ok ? 1 : 0}`);
  console.log(`P1_02_RELEASE_PROMOTION_PARITY_OK=${state.releasePromotionParity.ok ? 1 : 0}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateModeAwareExitPolicyState({
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
};
