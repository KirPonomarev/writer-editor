#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';

const TOKEN_NAME = 'CROSS_PLATFORM_NORMALIZATION_HARDENING_OK';
const DEFAULT_REQUIRED_SET_PATH = 'docs/OPS/STATUS/REQUIRED_SET_PHASE_3_V1.json';
const DEFAULT_PHASE_SWITCH_PATH = 'docs/OPS/STATUS/PHASE_SWITCH_V1.json';
const DEFAULT_TOKEN_CATALOG_PATH = 'docs/OPS/TOKENS/TOKEN_CATALOG.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';

const RESERVED_WINDOWS_BASENAMES = new Set([
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
    requiredSetPath: '',
    phaseSwitchPath: '',
    tokenCatalogPath: '',
    failsignalRegistryPath: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--json') {
      out.json = true;
      continue;
    }

    if (arg === '--required-set-path' && i + 1 < argv.length) {
      out.requiredSetPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--required-set-path=')) {
      out.requiredSetPath = normalizeString(arg.slice('--required-set-path='.length));
      continue;
    }

    if (arg === '--phase-switch-path' && i + 1 < argv.length) {
      out.phaseSwitchPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--phase-switch-path=')) {
      out.phaseSwitchPath = normalizeString(arg.slice('--phase-switch-path='.length));
      continue;
    }

    if (arg === '--token-catalog-path' && i + 1 < argv.length) {
      out.tokenCatalogPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--token-catalog-path=')) {
      out.tokenCatalogPath = normalizeString(arg.slice('--token-catalog-path='.length));
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

function normalizeNewline(input) {
  return String(input || '').replace(/\r\n?/g, '\n');
}

function normalizeUnicodeNfc(input) {
  return String(input || '').normalize('NFC');
}

function localeIndependentSort(values) {
  const collator = new Intl.Collator('en-US', {
    usage: 'sort',
    sensitivity: 'base',
    numeric: true,
  });
  return [...values].sort((left, right) => {
    const primary = collator.compare(left, right);
    if (primary !== 0) return primary;
    return left.localeCompare(right, 'en-US', { sensitivity: 'variant' });
  });
}

function normalizeCaseKey(input) {
  return normalizeUnicodeNfc(input).toLowerCase();
}

function basenameWithoutTrailings(name) {
  const raw = String(name || '').split(/[\\/]/).pop() || '';
  const withoutTrailingDotSpace = raw.replace(/[ .]+$/g, '');
  return withoutTrailingDotSpace || raw;
}

function isReservedWindowsName(name) {
  const base = basenameWithoutTrailings(name);
  if (!base) return false;
  const stem = base.split('.')[0].toUpperCase();
  return RESERVED_WINDOWS_BASENAMES.has(stem);
}

function normalizePathSeparators(input) {
  const unified = String(input || '').replace(/\\/g, '/');
  const collapsed = unified.replace(/\/+/g, '/');
  return collapsed.replace(/\/\.\//g, '/');
}

function containsParentTraversal(input) {
  const normalized = normalizePathSeparators(input);
  return normalized.split('/').some((segment) => segment === '..');
}

function evaluateNewlineNormalization() {
  const rows = [
    { caseId: 'lf-only', input: 'line1\nline2', expected: 'line1\nline2' },
    { caseId: 'crlf', input: 'line1\r\nline2\r\n', expected: 'line1\nline2\n' },
    { caseId: 'cr-only', input: 'line1\rline2\r', expected: 'line1\nline2\n' },
    { caseId: 'mixed', input: 'line1\r\nline2\rline3\n', expected: 'line1\nline2\nline3\n' },
  ];

  const cases = rows.map((row) => {
    const actual = normalizeNewline(row.input);
    return {
      ...row,
      actual,
      pass: actual === row.expected,
    };
  });

  return {
    ok: cases.every((row) => row.pass),
    cases,
  };
}

function evaluateUnicodeNormalization() {
  const rows = [
    { caseId: 'e-acute', left: 'Cafe\u0301', right: 'Caf\u00E9' },
    { caseId: 'yo-cyrillic', left: '\u0415\u0308лка', right: '\u0401лка' },
    { caseId: 'latin-a-ring', left: '\u212B', right: '\u00C5' },
  ];

  const cases = rows.map((row) => {
    const normalizedLeft = normalizeUnicodeNfc(row.left);
    const normalizedRight = normalizeUnicodeNfc(row.right);
    return {
      ...row,
      normalizedLeft,
      normalizedRight,
      pass: normalizedLeft === normalizedRight,
    };
  });

  return {
    ok: cases.every((row) => row.pass),
    cases,
  };
}

function evaluateLocaleIndependentSorting() {
  const input = ['item2', 'item10', 'item1', 'Alpha', 'beta'];
  const expected = ['Alpha', 'beta', 'item1', 'item2', 'item10'];
  const sorted = localeIndependentSort(input);
  const secondPass = localeIndependentSort(input);

  return {
    ok: JSON.stringify(sorted) === JSON.stringify(expected)
      && JSON.stringify(sorted) === JSON.stringify(secondPass),
    cases: [
      {
        caseId: 'stable-numeric-alpha',
        input,
        expected,
        actual: sorted,
        secondPass,
        pass: JSON.stringify(sorted) === JSON.stringify(expected)
          && JSON.stringify(sorted) === JSON.stringify(secondPass),
      },
    ],
  };
}

function evaluateCaseSensitivityBehavior() {
  const rows = [
    { caseId: 'same-ignore-case', left: 'Readme.md', right: 'README.md', expectedSame: true },
    { caseId: 'different-name', left: 'DraftA.txt', right: 'DraftB.txt', expectedSame: false },
    { caseId: 'unicode-case', left: 'Сцена.TXT', right: 'сцена.txt', expectedSame: true },
  ];

  const cases = rows.map((row) => {
    const same = normalizeCaseKey(row.left) === normalizeCaseKey(row.right);
    return {
      ...row,
      actualSame: same,
      pass: same === row.expectedSame,
    };
  });

  return {
    ok: cases.every((row) => row.pass),
    cases,
  };
}

function evaluateReservedNameBehavior() {
  const rows = [
    { caseId: 'reserved-con', input: 'CON', expectedReserved: true },
    { caseId: 'reserved-com1-txt', input: 'com1.txt', expectedReserved: true },
    { caseId: 'reserved-nul-dot', input: 'nul.', expectedReserved: true },
    { caseId: 'non-reserved-regular', input: 'chapter-01.txt', expectedReserved: false },
  ];

  const cases = rows.map((row) => {
    const actualReserved = isReservedWindowsName(row.input);
    return {
      ...row,
      actualReserved,
      pass: actualReserved === row.expectedReserved,
    };
  });

  return {
    ok: cases.every((row) => row.pass),
    cases,
  };
}

function evaluatePathSeparatorSafety() {
  const rows = [
    {
      caseId: 'win-path',
      input: 'scenes\\chapter01\\scene01.json',
      expectedNormalized: 'scenes/chapter01/scene01.json',
      expectedSafe: true,
    },
    {
      caseId: 'mixed-double-separators',
      input: 'assets\\\\images//cover.png',
      expectedNormalized: 'assets/images/cover.png',
      expectedSafe: true,
    },
    {
      caseId: 'parent-traversal',
      input: 'scenes/../secrets.txt',
      expectedNormalized: 'scenes/../secrets.txt',
      expectedSafe: false,
    },
  ];

  const cases = rows.map((row) => {
    const normalized = normalizePathSeparators(row.input);
    const safe = !containsParentTraversal(row.input);
    return {
      ...row,
      actualNormalized: normalized,
      actualSafe: safe,
      pass: normalized === row.expectedNormalized && safe === row.expectedSafe,
    };
  });

  return {
    ok: cases.every((row) => row.pass),
    cases,
  };
}

function uniqueSortedStrings(values) {
  if (!Array.isArray(values)) return [];
  const out = new Set();
  for (const raw of values) {
    const normalized = normalizeString(String(raw || ''));
    if (normalized) out.add(normalized);
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

function buildTokenCatalogMap(tokenCatalogDoc) {
  const rows = Array.isArray(tokenCatalogDoc?.tokens) ? tokenCatalogDoc.tokens : [];
  const map = new Map();
  for (const row of rows) {
    if (!isObjectRecord(row)) continue;
    const tokenId = normalizeString(row.tokenId);
    if (!tokenId) continue;
    map.set(tokenId, row);
  }
  return map;
}

function evaluateReleaseCriticalPathsNoAdvisorySubsetParity(repoRoot, requiredSetDoc, tokenCatalogDoc, phaseEnforcement) {
  const requiredTokenIds = uniqueSortedStrings(requiredSetDoc?.effectiveRequiredTokenIds);
  const tokenCatalog = buildTokenCatalogMap(tokenCatalogDoc);
  const issues = [];
  const cases = [];

  for (const tokenId of requiredTokenIds) {
    const tokenRow = tokenCatalog.get(tokenId);
    const failSignalCode = normalizeString(tokenRow?.failSignalCode);
    if (!failSignalCode) {
      issues.push({
        tokenId,
        failSignalCode: '',
        reason: 'TOKEN_FAILSIGNAL_MISSING',
      });
      continue;
    }

    const verdict = evaluateModeMatrixVerdict({
      repoRoot,
      mode: 'release',
      failSignalCode,
    });

    const pass = verdict.ok && verdict.shouldBlock === true;
    cases.push({
      tokenId,
      failSignalCode,
      verdictOk: verdict.ok,
      modeDisposition: verdict.modeDisposition,
      shouldBlock: verdict.shouldBlock,
      evaluatorId: verdict.evaluatorId,
      pass,
    });

    if (!pass) {
      issues.push({
        tokenId,
        failSignalCode,
        reason: verdict.ok ? 'RELEASE_MODE_NOT_BLOCKING' : 'MODE_EVALUATOR_ERROR',
        evaluatorIssues: verdict.issues || [],
      });
    }
  }

  const hardEnforcementActive = Boolean(phaseEnforcement?.shouldBlock);

  return {
    ok: hardEnforcementActive ? (issues.length === 0 && requiredTokenIds.length > 0) : true,
    hardEnforcementActive,
    requiredTokenIds,
    cases: cases.sort((a, b) => a.tokenId.localeCompare(b.tokenId)),
    issues,
  };
}

function resolvePhaseEnforcement(phaseSwitchDoc) {
  const activePhase = normalizeString(phaseSwitchDoc?.activePhase || 'PHASE_1_SHADOW');
  const matrix = isObjectRecord(phaseSwitchDoc?.phasePrecedence) ? phaseSwitchDoc.phasePrecedence : {};
  const entry = isObjectRecord(matrix[activePhase]) ? matrix[activePhase] : null;
  const shouldBlock = Boolean(entry?.shouldBlock);
  const mode = normalizeString(entry?.newV1Enforcement || (shouldBlock ? 'HARD_BLOCK' : 'WARN_ONLY'));
  return {
    activePhase,
    newV1Enforcement: mode || (shouldBlock ? 'HARD_BLOCK' : 'WARN_ONLY'),
    shouldBlock,
  };
}

function evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc) {
  const failSignals = Array.isArray(failsignalRegistryDoc?.failSignals)
    ? failsignalRegistryDoc.failSignals
    : [];

  const modePairs = [
    { mode: 'pr', key: 'prCore' },
    { mode: 'release', key: 'release' },
    { mode: 'promotion', key: 'promotion' },
  ];

  const driftCases = [];
  const issues = [];

  for (const row of failSignals) {
    if (!isObjectRecord(row)) continue;
    const failSignalCode = normalizeString(row.code);
    if (!failSignalCode) continue;

    for (const pair of modePairs) {
      const expectedDisposition = normalizeString((row.modeMatrix || {})[pair.key]).toLowerCase();
      if (expectedDisposition !== 'advisory') continue;

      const verdict = evaluateModeMatrixVerdict({ repoRoot, mode: pair.mode, failSignalCode });
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

function evaluateSingleBlockingAuthority(repoRoot) {
  const verdict = evaluateModeMatrixVerdict({ repoRoot, mode: 'pr', failSignalCode: 'E_REMOTE_UNAVAILABLE' });
  return {
    ok: verdict.ok && verdict.evaluatorId === CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    evaluatorIdObserved: verdict.evaluatorId,
    evaluatorIdExpected: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    issues: verdict.issues || [],
  };
}

function resolveFailReason(state) {
  if (!state.newlineNormalizationCheck) return 'E_NEWLINE_NORMALIZATION_MISSING';
  if (!state.unicodeNormalizationCheck) return 'E_UNICODE_NORMALIZATION_MISSING';
  if (!state.localeIndependentSortingCheck) return 'E_LOCALE_SORTING_NONDETERMINISTIC';
  if (!state.caseSensitivityBehaviorCheck || !state.reservedNameBehaviorCheck) return 'E_CASE_RESERVED_NAME_PARITY_FAIL';
  if (!state.pathSeparatorSafetyCheck) return 'E_PATH_SEPARATOR_SAFETY_FAIL';
  if (!state.releaseCriticalPathsNoAdvisorySubsetParityCheck) return 'ADVISORY_TO_BLOCKING_DRIFT';
  if (!state.advisoryToBlockingDriftCountZero) return 'ADVISORY_TO_BLOCKING_DRIFT';
  if (!state.singleBlockingAuthority.ok) return 'E_BLOCKING_EVALUATOR_NOT_CANONICAL';
  return 'CROSS_PLATFORM_NORMALIZATION_HARDENING_FAIL';
}

function evaluateCrossPlatformNormalizationState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());

  const requiredSetPath = path.resolve(repoRoot, normalizeString(input.requiredSetPath || DEFAULT_REQUIRED_SET_PATH));
  const phaseSwitchPath = path.resolve(repoRoot, normalizeString(input.phaseSwitchPath || DEFAULT_PHASE_SWITCH_PATH));
  const tokenCatalogPath = path.resolve(repoRoot, normalizeString(input.tokenCatalogPath || DEFAULT_TOKEN_CATALOG_PATH));
  const failsignalRegistryPath = path.resolve(repoRoot, normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH));

  const requiredSetDoc = isObjectRecord(input.requiredSetDoc) ? input.requiredSetDoc : readJsonObject(requiredSetPath);
  const phaseSwitchDoc = isObjectRecord(input.phaseSwitchDoc) ? input.phaseSwitchDoc : readJsonObject(phaseSwitchPath);
  const tokenCatalogDoc = isObjectRecord(input.tokenCatalogDoc) ? input.tokenCatalogDoc : readJsonObject(tokenCatalogPath);
  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc) ? input.failsignalRegistryDoc : readJsonObject(failsignalRegistryPath);

  const newlineResult = evaluateNewlineNormalization();
  const unicodeResult = evaluateUnicodeNormalization();
  const localeResult = evaluateLocaleIndependentSorting();
  const caseResult = evaluateCaseSensitivityBehavior();
  const reservedResult = evaluateReservedNameBehavior();
  const pathResult = evaluatePathSeparatorSafety();
  const phaseEnforcement = resolvePhaseEnforcement(phaseSwitchDoc);
  const releaseCriticalParityResult = evaluateReleaseCriticalPathsNoAdvisorySubsetParity(
    repoRoot,
    requiredSetDoc,
    tokenCatalogDoc,
    phaseEnforcement,
  );

  const driftState = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc);
  const advisoryToBlockingDriftCount = driftState.advisoryToBlockingDriftCount;
  const advisoryToBlockingDriftCountZero = advisoryToBlockingDriftCount === 0;

  const singleBlockingAuthority = evaluateSingleBlockingAuthority(repoRoot);

  const issues = [
    ...driftState.issues,
    ...singleBlockingAuthority.issues,
    ...(releaseCriticalParityResult.hardEnforcementActive ? releaseCriticalParityResult.issues : []),
  ];

  const ok = newlineResult.ok
    && unicodeResult.ok
    && localeResult.ok
    && caseResult.ok
    && reservedResult.ok
    && pathResult.ok
    && releaseCriticalParityResult.ok
    && advisoryToBlockingDriftCountZero
    && singleBlockingAuthority.ok
    && issues.length === 0;

  const failReason = ok ? '' : resolveFailReason({
    newlineNormalizationCheck: newlineResult.ok,
    unicodeNormalizationCheck: unicodeResult.ok,
    localeIndependentSortingCheck: localeResult.ok,
    caseSensitivityBehaviorCheck: caseResult.ok,
    reservedNameBehaviorCheck: reservedResult.ok,
    pathSeparatorSafetyCheck: pathResult.ok,
    releaseCriticalPathsNoAdvisorySubsetParityCheck: releaseCriticalParityResult.ok,
    advisoryToBlockingDriftCountZero,
    singleBlockingAuthority,
  });

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failReason,
    failSignalCode: failReason,

    requiredSetPath: path.relative(repoRoot, requiredSetPath).replaceAll(path.sep, '/'),
    phaseSwitchPath: path.relative(repoRoot, phaseSwitchPath).replaceAll(path.sep, '/'),
    tokenCatalogPath: path.relative(repoRoot, tokenCatalogPath).replaceAll(path.sep, '/'),

    newlineNormalizationCheck: newlineResult.ok,
    unicodeNormalizationCheck: unicodeResult.ok,
    localeIndependentSortingCheck: localeResult.ok,
    caseSensitivityBehaviorCheck: caseResult.ok,
    reservedNameBehaviorCheck: reservedResult.ok,
    pathSeparatorSafetyCheck: pathResult.ok,
    releaseCriticalPathsNoAdvisorySubsetParityCheck: releaseCriticalParityResult.ok,

    newlineNormalizationCases: newlineResult.cases,
    unicodeNormalizationCases: unicodeResult.cases,
    localeIndependentSortingCases: localeResult.cases,
    caseSensitivityBehaviorCases: caseResult.cases,
    reservedNameBehaviorCases: reservedResult.cases,
    pathSeparatorSafetyCases: pathResult.cases,
    releaseCriticalPathParity: releaseCriticalParityResult,

    phaseEnforcement,
    advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero,
    driftCases: driftState.driftCases,
    singleBlockingAuthority,
    issues,
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`P1_08_NEWLINE_NORMALIZATION_CHECK=${state.newlineNormalizationCheck ? 1 : 0}`);
  console.log(`P1_08_UNICODE_NORMALIZATION_CHECK=${state.unicodeNormalizationCheck ? 1 : 0}`);
  console.log(`P1_08_LOCALE_INDEPENDENT_SORTING_CHECK=${state.localeIndependentSortingCheck ? 1 : 0}`);
  console.log(`P1_08_CASE_SENSITIVITY_BEHAVIOR_CHECK=${state.caseSensitivityBehaviorCheck ? 1 : 0}`);
  console.log(`P1_08_RESERVED_NAME_BEHAVIOR_CHECK=${state.reservedNameBehaviorCheck ? 1 : 0}`);
  console.log(`P1_08_PATH_SEPARATOR_SAFETY_CHECK=${state.pathSeparatorSafetyCheck ? 1 : 0}`);
  console.log(`P1_08_RELEASE_CRITICAL_PATHS_NO_ADVISORY_SUBSET_PARITY_CHECK=${state.releaseCriticalPathsNoAdvisorySubsetParityCheck ? 1 : 0}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.advisoryToBlockingDriftCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateCrossPlatformNormalizationState({
    repoRoot: process.cwd(),
    requiredSetPath: args.requiredSetPath,
    phaseSwitchPath: args.phaseSwitchPath,
    tokenCatalogPath: args.tokenCatalogPath,
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
  evaluateCrossPlatformNormalizationState,
  TOKEN_NAME,
};
