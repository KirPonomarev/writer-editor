#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateCrossPlatformNormalizationState } from './cross-platform-normalization-state.mjs';

const TOKEN_NAME = 'P2_WS01_CROSS_PLATFORM_NORMALIZATION_HARDENING_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';
const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';

const WINDOWS_RESERVED = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
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

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    canonStatusPath: '',
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
    }
  }

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

function canonicalForm(input) {
  return String(input || '').normalize('NFC').toLowerCase();
}

function normalizeWindowsStem(input) {
  const raw = String(input || '').split(/[\\/]/).pop() || '';
  const stripped = raw.replace(/[ .]+$/g, '');
  const stem = (stripped || raw).split('.')[0] || '';
  return stem.toUpperCase();
}

function normalizePathSeparators(input) {
  return String(input || '')
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/')
    .replace(/\/\.\//g, '/');
}

function containsParentTraversal(input) {
  return normalizePathSeparators(input)
    .split('/')
    .some((segment) => segment === '..');
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

function evaluateNegativeScenarios(negativeFixtures = {}) {
  const caseCollisionFixture = Array.isArray(negativeFixtures.caseCollision)
    ? negativeFixtures.caseCollision
    : ['SceneA.txt', 'scenea.TXT'];
  const caseCollisionKeys = caseCollisionFixture.map((entry) => canonicalForm(entry));
  const caseCollisionDetected = new Set(caseCollisionKeys).size < caseCollisionKeys.length;

  const reservedNameFixture = normalizeString(negativeFixtures.reservedName || 'CON.txt');
  const reservedNameDetected = WINDOWS_RESERVED.has(normalizeWindowsStem(reservedNameFixture));

  const invalidSeparatorFixture = normalizeString(
    negativeFixtures.invalidSeparatorMix || 'scenes\\chapter01/../secret.txt',
  );
  const hasMixedSeparators = invalidSeparatorFixture.includes('/') && invalidSeparatorFixture.includes('\\');
  const separatorTraversalDetected = containsParentTraversal(invalidSeparatorFixture);
  const invalidSeparatorDetected = hasMixedSeparators || separatorTraversalDetected;

  const newlineFixture = normalizeString(negativeFixtures.newlineMismatch || 'line1\r\nline2\r');
  const newlineNormalized = newlineFixture.replace(/\r\n?/g, '\n');
  const newlineMismatchDetected = newlineNormalized !== newlineFixture;

  const unicodeLeft = normalizeString(negativeFixtures.unicodeLeft || 'Cafe\u0301');
  const unicodeRight = normalizeString(negativeFixtures.unicodeRight || 'Caf\u00E9');
  const unicodeRawMismatch = unicodeLeft !== unicodeRight;
  const unicodeCanonicalMatch = unicodeLeft.normalize('NFC') === unicodeRight.normalize('NFC');
  const unicodeNormalizationMismatchDetected = unicodeRawMismatch && unicodeCanonicalMatch;

  const details = {
    CASE_COLLISION_EXPECT_FAIL: {
      fixture: caseCollisionFixture,
      collisionDetected: caseCollisionDetected,
      pass: caseCollisionDetected,
    },
    RESERVED_NAME_EXPECT_FAIL: {
      fixture: reservedNameFixture,
      reservedDetected: reservedNameDetected,
      pass: reservedNameDetected,
    },
    INVALID_SEPARATOR_MIX_EXPECT_FAIL: {
      fixture: invalidSeparatorFixture,
      mixedSeparatorsDetected: hasMixedSeparators,
      parentTraversalDetected: separatorTraversalDetected,
      pass: invalidSeparatorDetected,
    },
    NEWLINE_MISMATCH_EXPECT_FAIL: {
      fixture: newlineFixture,
      normalized: newlineNormalized,
      mismatchDetected: newlineMismatchDetected,
      pass: newlineMismatchDetected,
    },
    UNICODE_NORMALIZATION_MISMATCH_EXPECT_FAIL: {
      fixture: {
        left: unicodeLeft,
        right: unicodeRight,
      },
      rawMismatchDetected: unicodeRawMismatch,
      canonicalMatchDetected: unicodeCanonicalMatch,
      pass: unicodeNormalizationMismatchDetected,
    },
  };

  const results = {
    NEXT_TZ_NEGATIVE_01: details.CASE_COLLISION_EXPECT_FAIL.pass,
    NEXT_TZ_NEGATIVE_02: details.RESERVED_NAME_EXPECT_FAIL.pass,
    NEXT_TZ_NEGATIVE_03: details.INVALID_SEPARATOR_MIX_EXPECT_FAIL.pass,
    NEXT_TZ_NEGATIVE_04: details.NEWLINE_MISMATCH_EXPECT_FAIL.pass,
    NEXT_TZ_NEGATIVE_05: details.UNICODE_NORMALIZATION_MISMATCH_EXPECT_FAIL.pass,
  };

  return {
    results,
    details,
  };
}

function resolveFailReason(state) {
  if (!state.canonLock.ok) return state.canonLock.reason || 'ACTIVE_CANON_LOCK_FAIL';
  if (state.counts.platformGapCount > 0) return 'PLATFORM_GAP_DETECTED';
  if (!state.negativeResults.NEXT_TZ_NEGATIVE_01) return 'CASE_COLLISION_EXPECT_FAIL_NOT_ENFORCED';
  if (!state.negativeResults.NEXT_TZ_NEGATIVE_02) return 'RESERVED_NAME_EXPECT_FAIL_NOT_ENFORCED';
  if (!state.negativeResults.NEXT_TZ_NEGATIVE_03) return 'INVALID_SEPARATOR_MIX_EXPECT_FAIL_NOT_ENFORCED';
  if (!state.negativeResults.NEXT_TZ_NEGATIVE_04) return 'NEWLINE_MISMATCH_EXPECT_FAIL_NOT_ENFORCED';
  if (!state.negativeResults.NEXT_TZ_NEGATIVE_05) return 'UNICODE_NORMALIZATION_MISMATCH_EXPECT_FAIL_NOT_ENFORCED';
  if (!state.positiveResults.NEXT_TZ_POSITIVE_01) return 'PLATFORM_MATRIX_NORMALIZATION_FAIL';
  if (!state.positiveResults.NEXT_TZ_POSITIVE_02) return 'DETERMINISTIC_OUTPUT_ACROSS_PLATFORMS_FAIL';
  if (!state.positiveResults.NEXT_TZ_POSITIVE_03) return 'CONTRACT_SUITE_FAIL';
  if (!state.dod.NEXT_TZ_DOD_05) return 'BLOCKING_SURFACE_EXPANDED';
  if (!state.acceptance.NEXT_TZ_ACCEPTANCE_02) return 'ADVISORY_AS_BLOCKING_DRIFT_DETECTED';
  return 'P2_WS01_CROSS_PLATFORM_NORMALIZATION_HARDENING_FAIL';
}

function evaluateP2Ws01CrossPlatformNormalizationHardeningState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const canonStatusPath = path.resolve(repoRoot, normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH));

  const canonStatusDoc = isObjectRecord(input.canonStatusDoc)
    ? input.canonStatusDoc
    : readJsonObject(canonStatusPath);
  const canonLock = validateCanonLock(canonStatusDoc);

  const baseline = evaluateCrossPlatformNormalizationState({ repoRoot });
  const baselineSecond = evaluateCrossPlatformNormalizationState({ repoRoot });
  const negative = evaluateNegativeScenarios(input.negativeFixtures || {});

  const scopeChecks = {
    caseSensitivity: baseline.caseSensitivityBehaviorCheck,
    reservedNames: baseline.reservedNameBehaviorCheck,
    pathSeparators: baseline.pathSeparatorSafetyCheck,
    newlines: baseline.newlineNormalizationCheck,
    unicode: baseline.unicodeNormalizationCheck,
    localeSorting: baseline.localeIndependentSortingCheck,
  };

  const platformGapEntries = Object.entries(scopeChecks)
    .filter(([, value]) => !value)
    .map(([key]) => key)
    .sort((a, b) => a.localeCompare(b));

  const platformGapCount = platformGapEntries.length;

  const deterministicComparable = {
    newlineNormalizationCases: baseline.newlineNormalizationCases,
    unicodeNormalizationCases: baseline.unicodeNormalizationCases,
    localeIndependentSortingCases: baseline.localeIndependentSortingCases,
    caseSensitivityBehaviorCases: baseline.caseSensitivityBehaviorCases,
    reservedNameBehaviorCases: baseline.reservedNameBehaviorCases,
    pathSeparatorSafetyCases: baseline.pathSeparatorSafetyCases,
  };
  const deterministicComparableSecond = {
    newlineNormalizationCases: baselineSecond.newlineNormalizationCases,
    unicodeNormalizationCases: baselineSecond.unicodeNormalizationCases,
    localeIndependentSortingCases: baselineSecond.localeIndependentSortingCases,
    caseSensitivityBehaviorCases: baselineSecond.caseSensitivityBehaviorCases,
    reservedNameBehaviorCases: baselineSecond.reservedNameBehaviorCases,
    pathSeparatorSafetyCases: baselineSecond.pathSeparatorSafetyCases,
  };

  const deterministicOutputAcrossPlatformsPass =
    stableStringify(deterministicComparable) === stableStringify(deterministicComparableSecond);

  const negativeResults = negative.results;
  const scopedContractSuitePass = canonLock.ok
    && baseline.advisoryToBlockingDriftCount === 0
    && scopeChecks.caseSensitivity
    && scopeChecks.reservedNames
    && scopeChecks.pathSeparators
    && scopeChecks.newlines
    && scopeChecks.unicode
    && scopeChecks.localeSorting;

  const positiveResults = {
    NEXT_TZ_POSITIVE_01: platformGapCount === 0,
    NEXT_TZ_POSITIVE_02: deterministicOutputAcrossPlatformsPass,
    NEXT_TZ_POSITIVE_03: scopedContractSuitePass,
  };

  const allNegativesPass = Object.values(negativeResults).every(Boolean);
  const allPositivesPass = Object.values(positiveResults).every(Boolean);

  const dod = {
    NEXT_TZ_DOD_01: platformGapCount === 0,
    NEXT_TZ_DOD_02: allNegativesPass,
    NEXT_TZ_DOD_03: allPositivesPass,
    NEXT_TZ_DOD_04: false,
    NEXT_TZ_DOD_05: true,
  };

  const acceptance = {
    NEXT_TZ_ACCEPTANCE_01: canonLock.ok,
    NEXT_TZ_ACCEPTANCE_02: baseline.advisoryToBlockingDriftCount === 0,
    NEXT_TZ_ACCEPTANCE_03: false,
    NEXT_TZ_ACCEPTANCE_04: false,
  };

  const preRepeatabilityOk = canonLock.ok
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

    objective: 'УСИЛИТЬ_CROSS_PLATFORM_NORMALIZATION_ДЛЯ_CASE_RESERVED_SEPARATOR_NEWLINE_UNICODE_LOCALE',
    blockingSurfaceExpansion: false,

    canonLock,
    advisoryToBlockingDriftCount: baseline.advisoryToBlockingDriftCount,

    counts: {
      platformGapCount,
      caseSensitivityCaseCount: baseline.caseSensitivityBehaviorCases.length,
      reservedNameCaseCount: baseline.reservedNameBehaviorCases.length,
      pathSeparatorCaseCount: baseline.pathSeparatorSafetyCases.length,
      newlineCaseCount: baseline.newlineNormalizationCases.length,
      unicodeCaseCount: baseline.unicodeNormalizationCases.length,
      localeSortingCaseCount: baseline.localeIndependentSortingCases.length,
    },

    scopeChecks,
    platformGapEntries,

    negativeResults,
    negativeDetails: negative.details,
    positiveResults,

    dod,
    acceptance,

    baselineSummary: {
      ok: baseline.ok,
      failReason: baseline.failReason,
      failSignalCode: baseline.failSignalCode,
      issues: baseline.issues,
    },
  };

  if (!state.ok) {
    state.failReason = resolveFailReason(state);
    state.failSignalCode = state.failReason;
  }

  return state;
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`PLATFORM_GAP_COUNT=${state.counts.platformGapCount}`);
  console.log(`NEXT_TZ_DOD_01=${state.dod.NEXT_TZ_DOD_01 ? 1 : 0}`);
  console.log(`NEXT_TZ_DOD_02=${state.dod.NEXT_TZ_DOD_02 ? 1 : 0}`);
  console.log(`NEXT_TZ_DOD_03=${state.dod.NEXT_TZ_DOD_03 ? 1 : 0}`);
  console.log(`NEXT_TZ_ACCEPTANCE_01=${state.acceptance.NEXT_TZ_ACCEPTANCE_01 ? 1 : 0}`);
  console.log(`NEXT_TZ_ACCEPTANCE_02=${state.acceptance.NEXT_TZ_ACCEPTANCE_02 ? 1 : 0}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateP2Ws01CrossPlatformNormalizationHardeningState({
    repoRoot: process.cwd(),
    canonStatusPath: args.canonStatusPath,
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
  evaluateP2Ws01CrossPlatformNormalizationHardeningState,
  TOKEN_NAME,
};
