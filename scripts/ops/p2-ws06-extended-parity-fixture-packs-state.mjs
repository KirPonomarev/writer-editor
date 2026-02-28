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

const TOKEN_NAME = 'P2_WS06_EXTENDED_PARITY_FIXTURE_PACKS_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';
const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const REQUIRED_PLATFORMS = Object.freeze(['web', 'windows', 'linux', 'android', 'ios']);
const REQUIRED_CATEGORIES = Object.freeze(['case', 'reserved', 'newline', 'unicode', 'locale']);
const BASELINE_FIXTURE_COUNT = 5;

const WINDOWS_RESERVED = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

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

function normalizePathSeparators(input) {
  return String(input || '').replace(/\\/g, '/').replace(/\/+/g, '/');
}

function normalizeNewline(input) {
  return String(input || '').replace(/\r\n?/g, '\n');
}

function canonicalUnicode(input) {
  return String(input || '').normalize('NFC');
}

function canonicalCaseKey(input) {
  return canonicalUnicode(input).toLowerCase();
}

function isReservedWindowsName(input) {
  const name = String(input || '').split(/[\\/]/).pop() || '';
  const stem = name.replace(/[ .]+$/g, '').split('.')[0].toUpperCase();
  return WINDOWS_RESERVED.has(stem);
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

function buildExtendedFixturePack() {
  return {
    schemaVersion: 'extended-parity-fixtures.v1',
    packId: 'P2_WS06_EXTENDED_PARITY_FIXTURE_PACKS',
    platforms: [...REQUIRED_PLATFORMS],
    categories: [...REQUIRED_CATEGORIES],
    fixtures: [
      {
        fixtureId: 'canonical-case-collision-1',
        kind: 'negative',
        category: 'case',
        expected: 'FAIL',
        payload: { left: 'SceneA.txt', right: 'scenea.TXT' },
      },
      {
        fixtureId: 'canonical-case-pass-1',
        kind: 'positive',
        category: 'case',
        expected: 'PASS',
        payload: { left: 'SceneA.txt', right: 'SceneB.txt' },
      },
      {
        fixtureId: 'reserved-name-neg-1',
        kind: 'negative',
        category: 'reserved',
        expected: 'FAIL',
        payload: { name: 'CON.txt' },
      },
      {
        fixtureId: 'reserved-name-pos-1',
        kind: 'positive',
        category: 'reserved',
        expected: 'PASS',
        payload: { name: 'chapter-01.txt' },
      },
      {
        fixtureId: 'newline-divergence-neg-1',
        kind: 'negative',
        category: 'newline',
        expected: 'FAIL',
        payload: { text: 'line1\r\nline2\rline3\n' },
      },
      {
        fixtureId: 'newline-canonical-pos-1',
        kind: 'positive',
        category: 'newline',
        expected: 'PASS',
        payload: { text: 'line1\nline2\nline3\n' },
      },
      {
        fixtureId: 'unicode-mismatch-neg-1',
        kind: 'negative',
        category: 'unicode',
        expected: 'FAIL',
        payload: { left: 'Cafe\u0301', right: 'Caf\u00E9' },
      },
      {
        fixtureId: 'unicode-canonical-pos-1',
        kind: 'positive',
        category: 'unicode',
        expected: 'PASS',
        payload: { left: 'Caf\u00E9', right: 'Caf\u00E9' },
      },
      {
        fixtureId: 'locale-ordering-drift-neg-1',
        kind: 'negative',
        category: 'locale',
        expected: 'FAIL',
        payload: {
          values: ['item2', 'item10', 'item1', 'Alpha', 'beta'],
          observedOrder: ['beta', 'Alpha', 'item10', 'item2', 'item1'],
        },
      },
      {
        fixtureId: 'locale-ordering-canonical-pos-1',
        kind: 'positive',
        category: 'locale',
        expected: 'PASS',
        payload: {
          values: ['item2', 'item10', 'item1', 'Alpha', 'beta'],
          observedOrder: ['Alpha', 'beta', 'item1', 'item2', 'item10'],
        },
      },
    ],
  };
}

function evaluateFixture(fixture) {
  const category = normalizeString(fixture.category).toLowerCase();
  const expected = normalizeString(fixture.expected).toUpperCase();
  const payload = isObjectRecord(fixture.payload) ? fixture.payload : {};

  if (category === 'case') {
    const left = normalizeString(payload.left);
    const right = normalizeString(payload.right);
    const conflict = canonicalCaseKey(left) === canonicalCaseKey(right);
    const actual = conflict ? 'FAIL' : 'PASS';
    return { pass: actual === expected, actual, detail: { left, right, conflict } };
  }

  if (category === 'reserved') {
    const name = normalizeString(payload.name);
    const reserved = isReservedWindowsName(name);
    const actual = reserved ? 'FAIL' : 'PASS';
    return { pass: actual === expected, actual, detail: { name, reserved } };
  }

  if (category === 'newline') {
    const text = String(payload.text || '');
    const normalized = normalizeNewline(text);
    const divergence = normalized !== text;
    const actual = divergence ? 'FAIL' : 'PASS';
    return { pass: actual === expected, actual, detail: { text, normalized, divergence } };
  }

  if (category === 'unicode') {
    const left = String(payload.left || '');
    const right = String(payload.right || '');
    const rawMismatch = left !== right;
    const canonicalMatch = canonicalUnicode(left) === canonicalUnicode(right);
    const divergence = rawMismatch && canonicalMatch;
    const actual = divergence ? 'FAIL' : 'PASS';
    return { pass: actual === expected, actual, detail: { left, right, rawMismatch, canonicalMatch, divergence } };
  }

  if (category === 'locale') {
    const values = Array.isArray(payload.values) ? payload.values.map((v) => String(v)) : [];
    const observedOrder = Array.isArray(payload.observedOrder)
      ? payload.observedOrder.map((v) => String(v))
      : [];
    const canonicalOrder = localeIndependentSort(values);
    const drift = JSON.stringify(canonicalOrder) !== JSON.stringify(observedOrder);
    const actual = drift ? 'FAIL' : 'PASS';
    return { pass: actual === expected, actual, detail: { values, canonicalOrder, observedOrder, drift } };
  }

  return { pass: false, actual: 'UNKNOWN', detail: { reason: 'UNKNOWN_CATEGORY', category } };
}

function evaluateFixturePack(packDoc) {
  const fixtures = Array.isArray(packDoc?.fixtures) ? packDoc.fixtures : [];
  const platforms = Array.isArray(packDoc?.platforms)
    ? packDoc.platforms.map((p) => normalizeString(p).toLowerCase()).filter(Boolean)
    : [];
  const categories = Array.isArray(packDoc?.categories)
    ? packDoc.categories.map((c) => normalizeString(c).toLowerCase()).filter(Boolean)
    : [];

  const missingPlatforms = REQUIRED_PLATFORMS.filter((platform) => !platforms.includes(platform));
  const missingCategories = REQUIRED_CATEGORIES.filter((category) => !categories.includes(category));

  const evaluated = fixtures.map((fixture) => {
    const result = evaluateFixture(fixture);
    return {
      fixtureId: normalizeString(fixture.fixtureId),
      kind: normalizeString(fixture.kind).toLowerCase(),
      category: normalizeString(fixture.category).toLowerCase(),
      expected: normalizeString(fixture.expected).toUpperCase(),
      actual: result.actual,
      pass: result.pass,
      detail: result.detail,
    };
  });

  const positiveFixtures = evaluated.filter((row) => row.kind === 'positive');
  const negativeFixtures = evaluated.filter((row) => row.kind === 'negative');
  const positivePassCount = positiveFixtures.filter((row) => row.pass).length;
  const negativePassCount = negativeFixtures.filter((row) => row.pass).length;

  const categoryCoverage = Object.fromEntries(
    REQUIRED_CATEGORIES.map((category) => [
      category,
      evaluated.filter((row) => row.category === category).length,
    ]),
  );

  return {
    ok: missingPlatforms.length === 0
      && missingCategories.length === 0
      && evaluated.every((row) => row.pass),
    fixturesTotal: evaluated.length,
    positiveFixturesTotal: positiveFixtures.length,
    negativeFixturesTotal: negativeFixtures.length,
    positivePassCount,
    negativePassCount,
    missingPlatforms,
    missingCategories,
    categoryCoverage,
    evaluated,
  };
}

function runNegativeScenarios(packDoc) {
  const byCategory = (category, kind) => packDoc.fixtures.find((row) => row.category === category && row.kind === kind);

  const caseNeg = evaluateFixture(byCategory('case', 'negative'));
  const reservedNeg = evaluateFixture(byCategory('reserved', 'negative'));
  const newlineNeg = evaluateFixture(byCategory('newline', 'negative'));
  const unicodeNeg = evaluateFixture(byCategory('unicode', 'negative'));
  const localeNeg = evaluateFixture(byCategory('locale', 'negative'));

  return {
    NEXT_TZ_NEGATIVE_01: caseNeg.pass,
    NEXT_TZ_NEGATIVE_02: reservedNeg.pass,
    NEXT_TZ_NEGATIVE_03: newlineNeg.pass,
    NEXT_TZ_NEGATIVE_04: unicodeNeg.pass,
    NEXT_TZ_NEGATIVE_05: localeNeg.pass,
  };
}

function evaluateDeterministicParity(packDoc) {
  const canonicalPositive = packDoc.fixtures.filter((row) => row.kind === 'positive');
  const hashes = [];

  for (let i = 0; i < 3; i += 1) {
    const evaluated = canonicalPositive.map((fixture) => ({
      fixtureId: fixture.fixtureId,
      result: evaluateFixture(fixture),
    }));
    hashes.push(createHash('sha256').update(stableStringify(evaluated)).digest('hex'));
  }

  return {
    ok: hashes.every((hash) => hash === hashes[0]),
    hashes,
  };
}

function evaluateP2Ws06ExtendedParityFixturePacksState(input = {}) {
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

  const packDoc = buildExtendedFixturePack();
  const packState = evaluateFixturePack(packDoc);
  const negativeResults = runNegativeScenarios(packDoc);
  const deterministicParity = evaluateDeterministicParity(packDoc);
  const drift = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc);

  const coverageIncreased = packState.fixturesTotal > BASELINE_FIXTURE_COUNT
    && Object.values(packState.categoryCoverage).every((count) => count >= 2);

  const positiveResults = {
    NEXT_TZ_POSITIVE_01: packState.ok,
    NEXT_TZ_POSITIVE_02: deterministicParity.ok,
    NEXT_TZ_POSITIVE_03: packState.ok && deterministicParity.ok && drift.advisoryToBlockingDriftCountZero,
  };

  const allNegativesPass = Object.values(negativeResults).every(Boolean);
  const allPositivesPass = Object.values(positiveResults).every(Boolean);

  const dod = {
    NEXT_TZ_DOD_01: coverageIncreased,
    NEXT_TZ_DOD_02: allNegativesPass,
    NEXT_TZ_DOD_03: allPositivesPass,
    NEXT_TZ_DOD_04: false,
    NEXT_TZ_DOD_05: true,
    NEXT_TZ_DOD_06: drift.advisoryToBlockingDriftCountZero,
  };

  const acceptance = {
    NEXT_TZ_ACCEPTANCE_01: canonLock.ok,
    NEXT_TZ_ACCEPTANCE_02: stageActivationGuardCheck,
    NEXT_TZ_ACCEPTANCE_03: false,
    NEXT_TZ_ACCEPTANCE_04: false,
  };

  const preRepeatabilityOk = canonLock.ok
    && stageActivationGuardCheck
    && dod.NEXT_TZ_DOD_01
    && dod.NEXT_TZ_DOD_02
    && dod.NEXT_TZ_DOD_03
    && dod.NEXT_TZ_DOD_05
    && dod.NEXT_TZ_DOD_06
    && acceptance.NEXT_TZ_ACCEPTANCE_02;

  const state = {
    ok: preRepeatabilityOk,
    [TOKEN_NAME]: preRepeatabilityOk ? 1 : 0,
    failReason: '',
    failSignalCode: '',

    objective: 'EXTEND_PARITY_FIXTURE_PACKS_FOR_STABLE_XPLAT_VALIDATION_WITHOUT_BLOCKING_SURFACE_EXPANSION',
    blockingSurfaceExpansion: false,

    canonLock,
    stageActivation: {
      ok: stageActivationGuardCheck,
      activeStageId: stageActivation.ACTIVE_STAGE_ID,
      stageActivationOk: stageActivation.STAGE_ACTIVATION_OK,
      failSignals: stageActivation.failSignals || [],
      errors: stageActivation.errors || [],
    },

    counts: {
      fixturesTotal: packState.fixturesTotal,
      positiveFixturesTotal: packState.positiveFixturesTotal,
      negativeFixturesTotal: packState.negativeFixturesTotal,
      positivePassCount: packState.positivePassCount,
      negativePassCount: packState.negativePassCount,
      baselineFixtureCount: BASELINE_FIXTURE_COUNT,
      coverageIncreased: coverageIncreased ? 1 : 0,
      advisoryToBlockingDriftCount: drift.advisoryToBlockingDriftCount,
    },

    packState,
    deterministicParity,
    drift,

    negativeResults,
    positiveResults,
    dod,
    acceptance,

    detector: {
      detectorId: 'WS06_EXTENDED_PARITY_FIXTURE_SINGLE_DETECTOR_V1',
      canonicalModeEvaluatorId: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    },
  };

  if (!state.ok) {
    state.failReason = !canonLock.ok
      ? canonLock.reason
      : !stageActivationGuardCheck
        ? 'STAGE_ACTIVATION_GUARD_FAIL'
        : !dod.NEXT_TZ_DOD_01
          ? 'FIXTURE_COVERAGE_NOT_INCREASED'
          : !dod.NEXT_TZ_DOD_02
            ? 'NEGATIVE_SCENARIO_FAILURE'
            : !dod.NEXT_TZ_DOD_03
              ? 'POSITIVE_SCENARIO_FAILURE'
              : !dod.NEXT_TZ_DOD_06
                ? 'ADVISORY_TO_BLOCKING_DRIFT'
                : !acceptance.NEXT_TZ_ACCEPTANCE_02
                  ? 'STAGE_ACTIVATION_GUARD_FAIL'
                : 'P2_WS06_EXTENDED_PARITY_FIXTURE_PACKS_FAIL';
    state.failSignalCode = state.failReason;
  }

  return state;
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`FIXTURES_TOTAL=${state.counts.fixturesTotal}`);
  console.log(`POSITIVE_FIXTURES_TOTAL=${state.counts.positiveFixturesTotal}`);
  console.log(`NEGATIVE_FIXTURES_TOTAL=${state.counts.negativeFixturesTotal}`);
  console.log(`COVERAGE_INCREASED=${state.counts.coverageIncreased}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.counts.advisoryToBlockingDriftCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateP2Ws06ExtendedParityFixturePacksState({
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
  evaluateP2Ws06ExtendedParityFixturePacksState,
  TOKEN_NAME,
};
