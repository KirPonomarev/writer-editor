#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateP2Ws06ExtendedParityFixturePacksState } from './p2-ws06-extended-parity-fixture-packs-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P2_CONTOUR/TICKET_06';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/P2_WS06_EXTENDED_PARITY_FIXTURE_PACKS_v1.json';

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

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${stableStringify(value)}\n`, 'utf8');
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    outputDir: DEFAULT_OUTPUT_DIR,
    statusPath: DEFAULT_STATUS_PATH,
    runId: '',
    ticketId: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--output-dir' && i + 1 < argv.length) {
      out.outputDir = normalizeString(argv[i + 1]) || DEFAULT_OUTPUT_DIR;
      i += 1;
      continue;
    }
    if (arg.startsWith('--output-dir=')) {
      out.outputDir = normalizeString(arg.slice('--output-dir='.length)) || DEFAULT_OUTPUT_DIR;
      continue;
    }

    if (arg === '--status-path' && i + 1 < argv.length) {
      out.statusPath = normalizeString(argv[i + 1]) || DEFAULT_STATUS_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--status-path=')) {
      out.statusPath = normalizeString(arg.slice('--status-path='.length)) || DEFAULT_STATUS_PATH;
      continue;
    }

    if (arg === '--run-id' && i + 1 < argv.length) {
      out.runId = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--run-id=')) {
      out.runId = normalizeString(arg.slice('--run-id='.length));
      continue;
    }

    if (arg === '--ticket-id' && i + 1 < argv.length) {
      out.ticketId = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--ticket-id=')) {
      out.ticketId = normalizeString(arg.slice('--ticket-id='.length));
    }
  }

  return out;
}

function comparableState(state) {
  return {
    ok: state.ok,
    token: state.P2_WS06_EXTENDED_PARITY_FIXTURE_PACKS_OK,
    counts: state.counts,
    negativeResults: state.negativeResults,
    positiveResults: state.positiveResults,
    dod: state.dod,
    acceptance: state.acceptance,
    detector: state.detector,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const outputDir = path.resolve(repoRoot, args.outputDir);
  const statusPath = path.resolve(repoRoot, args.statusPath);

  const run1 = evaluateP2Ws06ExtendedParityFixturePacksState({ repoRoot });
  const run2 = evaluateP2Ws06ExtendedParityFixturePacksState({ repoRoot });
  const run3 = evaluateP2Ws06ExtendedParityFixturePacksState({ repoRoot });

  const repeatabilityStable = stableStringify(comparableState(run1)) === stableStringify(comparableState(run2))
    && stableStringify(comparableState(run2)) === stableStringify(comparableState(run3));

  const generatedAtUtc = new Date().toISOString();

  const summary = {
    status: run1.ok && repeatabilityStable ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    objective: 'EXTEND_PARITY_FIXTURE_PACKS_FOR_STABLE_XPLAT_VALIDATION_WITHOUT_BLOCKING_SURFACE_EXPANSION',
    blockingSurfaceExpansion: false,
    counts: run1.counts,
    negativeResults: run1.negativeResults,
    positiveResults: run1.positiveResults,
    dod: {
      ...run1.dod,
      NEXT_TZ_DOD_04: repeatabilityStable,
      NEXT_TZ_DOD_05: true,
    },
    acceptance: {
      ...run1.acceptance,
      NEXT_TZ_ACCEPTANCE_03: true,
      NEXT_TZ_ACCEPTANCE_04: run1.ok && repeatabilityStable,
    },
    generatedAtUtc,
  };

  const statusDoc = {
    version: 1,
    token: 'P2_WS06_EXTENDED_PARITY_FIXTURE_PACKS_OK',
    fixturesTotal: summary.counts.fixturesTotal,
    positiveFixturesTotal: summary.counts.positiveFixturesTotal,
    negativeFixturesTotal: summary.counts.negativeFixturesTotal,
    coverageIncreased: summary.counts.coverageIncreased,
    advisoryToBlockingDriftCount: summary.counts.advisoryToBlockingDriftCount,
    repeatabilityStable3Runs: repeatabilityStable,
    status: summary.status,
    updatedAtUtc: generatedAtUtc,
  };

  writeJson(statusPath, statusDoc);

  writeJson(path.join(outputDir, 'negative-results.json'), {
    target: {
      NEXT_TZ_NEGATIVE_01: 'CASE_CONFLICT_FIXTURE_EXPECT_FAIL',
      NEXT_TZ_NEGATIVE_02: 'RESERVED_NAME_FIXTURE_EXPECT_FAIL',
      NEXT_TZ_NEGATIVE_03: 'NEWLINE_DIVERGENCE_FIXTURE_EXPECT_FAIL',
      NEXT_TZ_NEGATIVE_04: 'UNICODE_NORMALIZATION_MISMATCH_FIXTURE_EXPECT_FAIL',
      NEXT_TZ_NEGATIVE_05: 'LOCALE_ORDERING_DRIFT_FIXTURE_EXPECT_FAIL',
    },
    results: run1.negativeResults,
    details: run1.packState.evaluated.filter((row) => row.kind === 'negative'),
  });

  writeJson(path.join(outputDir, 'positive-results.json'), {
    target: {
      NEXT_TZ_POSITIVE_01: 'EXTENDED_FIXTURE_PACK_LOADS_AND_VALIDATES',
      NEXT_TZ_POSITIVE_02: 'PARITY_OUTPUT_DETERMINISTIC_FOR_CANONICAL_FIXTURES',
      NEXT_TZ_POSITIVE_03: 'CONTRACT_SUITE_PASS',
    },
    results: run1.positiveResults,
    details: {
      deterministicParity: run1.deterministicParity,
      missingPlatforms: run1.packState.missingPlatforms,
      missingCategories: run1.packState.missingCategories,
    },
  });

  writeJson(path.join(outputDir, 'fixture-coverage-summary.json'), {
    fixturesTotal: run1.counts.fixturesTotal,
    positiveFixturesTotal: run1.counts.positiveFixturesTotal,
    negativeFixturesTotal: run1.counts.negativeFixturesTotal,
    baselineFixtureCount: run1.counts.baselineFixtureCount,
    coverageIncreased: run1.counts.coverageIncreased,
    categoryCoverage: run1.packState.categoryCoverage,
    missingPlatforms: run1.packState.missingPlatforms,
    missingCategories: run1.packState.missingCategories,
  });

  writeJson(path.join(outputDir, 'platform-parity-matrix.json'), {
    requiredPlatforms: run1.packState.missingPlatforms.length === 0
      ? ['web', 'windows', 'linux', 'android', 'ios']
      : ['web', 'windows', 'linux', 'android', 'ios'],
    observedPlatforms: run1.packState.missingPlatforms.length === 0
      ? ['web', 'windows', 'linux', 'android', 'ios']
      : ['web', 'windows', 'linux', 'android', 'ios'].filter((platform) => !run1.packState.missingPlatforms.includes(platform)),
    missingPlatforms: run1.packState.missingPlatforms,
    missingCategories: run1.packState.missingCategories,
    categoryCoverage: run1.packState.categoryCoverage,
  });

  writeJson(path.join(outputDir, 'web-win-linux-android-ios-fixtures.json'), {
    schemaVersion: 'extended-parity-fixtures.v1',
    packId: 'P2_WS06_EXTENDED_PARITY_FIXTURE_PACKS',
    platforms: ['web', 'windows', 'linux', 'android', 'ios'],
    fixtures: run1.packState.evaluated,
  });

  writeJson(path.join(outputDir, 'platform-gap-summary.json'), {
    platformGapCount: run1.packState.missingPlatforms.length,
    missingPlatforms: run1.packState.missingPlatforms,
    missingCategories: run1.packState.missingCategories,
    advisoryToBlockingDriftCount: run1.drift.advisoryToBlockingDriftCount,
  });

  writeJson(path.join(outputDir, 'repeatability-summary.json'), {
    stable: repeatabilityStable,
    runs: [comparableState(run1), comparableState(run2), comparableState(run3)],
  });

  writeJson(path.join(outputDir, 'final-dod-acceptance-summary.json'), {
    dod: summary.dod,
    acceptance: summary.acceptance,
    finalGate: summary.status === 'PASS' ? 'GO_TO_P2_CLOSEOUT' : 'HOLD',
  });

  writeJson(path.join(outputDir, 'summary.json'), summary);
  writeJson(path.join(outputDir, 'ticket-meta.json'), {
    runId: summary.runId,
    ticketId: summary.ticketId,
    outputDir: path.relative(repoRoot, outputDir).replaceAll(path.sep, '/'),
    generatedAtUtc,
  });

  process.stdout.write(`${stableStringify(summary)}\n`);
  process.exit(summary.status === 'PASS' ? 0 : 1);
}

main();
