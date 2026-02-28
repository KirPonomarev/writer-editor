#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateP2Ws05WaveRerunDedupByStableInputHashState } from './p2-ws05-wave-rerun-dedup-by-stable-input-hash-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P2_CONTOUR/TICKET_05';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/P2_WS05_WAVE_RERUN_DEDUP_BY_STABLE_INPUT_HASH_v1.json';

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
    token: state.P2_WS05_WAVE_RERUN_DEDUP_BY_STABLE_INPUT_HASH_OK,
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

  const run1 = evaluateP2Ws05WaveRerunDedupByStableInputHashState({ repoRoot });
  const run2 = evaluateP2Ws05WaveRerunDedupByStableInputHashState({ repoRoot });
  const run3 = evaluateP2Ws05WaveRerunDedupByStableInputHashState({ repoRoot });

  const repeatabilityStable = stableStringify(comparableState(run1)) === stableStringify(comparableState(run2))
    && stableStringify(comparableState(run2)) === stableStringify(comparableState(run3));

  const generatedAtUtc = new Date().toISOString();

  const summary = {
    status: run1.ok && repeatabilityStable ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    objective: 'REMOVE_UNNECESSARY_HEAVY_RERUN_WHEN_INPUT_HASH_STABLE_WITH_RELIABILITY_PRESERVED',
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
    token: 'P2_WS05_WAVE_RERUN_DEDUP_BY_STABLE_INPUT_HASH_OK',
    unnecessaryHeavyRerunCountBefore: summary.counts.unnecessaryHeavyRerunCountBefore,
    unnecessaryHeavyRerunCountAfter: summary.counts.unnecessaryHeavyRerunCountAfter,
    unnecessaryHeavyRerunReduced: summary.counts.unnecessaryHeavyRerunReduced,
    advisoryToBlockingDriftCount: summary.counts.advisoryToBlockingDriftCount,
    repeatabilityStable3Runs: repeatabilityStable,
    status: summary.status,
    updatedAtUtc: generatedAtUtc,
  };

  writeJson(statusPath, statusDoc);

  writeJson(path.join(outputDir, 'negative-results.json'), {
    target: {
      NEXT_TZ_NEGATIVE_01: 'CACHE_REUSE_WITH_HASH_MISMATCH_EXPECT_FAIL',
      NEXT_TZ_NEGATIVE_02: 'CACHE_REUSE_WITH_EXPIRED_TTL_EXPECT_FAIL',
      NEXT_TZ_NEGATIVE_03: 'HEAVY_RERUN_SKIPPED_WHEN_INVALID_INPUT_EXPECT_FAIL',
      NEXT_TZ_NEGATIVE_04: 'MANUAL_RELEVANT_INPUT_OVERRIDE_EXPECT_FAIL',
      NEXT_TZ_NEGATIVE_05: 'STALE_RESULT_ACCEPTANCE_EXPECT_FAIL',
    },
    results: run1.negativeResults,
    details: run1.contracts,
  });

  writeJson(path.join(outputDir, 'positive-results.json'), {
    target: {
      NEXT_TZ_POSITIVE_01: 'CACHE_REUSE_ONLY_WHEN_HASH_AND_TTL_VALID',
      NEXT_TZ_POSITIVE_02: 'HEAVY_RERUN_TRIGGERED_WHEN_INPUT_INVALID',
      NEXT_TZ_POSITIVE_03: 'WAVE_DECISION_OUTPUT_DETERMINISTIC',
    },
    results: run1.positiveResults,
    details: {
      decisions: run1.decisions,
      contracts: {
        validContract: run1.contracts.validContract,
        mismatchContract: run1.contracts.mismatchContract,
        expiredContract: run1.contracts.expiredContract,
        invalidInputContract: run1.contracts.invalidInputContract,
      },
    },
  });

  writeJson(path.join(outputDir, 'hash-ttl-dedup-summary.json'), {
    waveInputHashPresent: run1.waveInput.hashPresent,
    waveInputHash: run1.waveInput.waveInputHash,
    ttlClass: run1.waveInput.ttlClass,
    ttlSec: run1.waveInput.ttlSec,
    unnecessaryHeavyRerunCountBefore: run1.counts.unnecessaryHeavyRerunCountBefore,
    unnecessaryHeavyRerunCountAfter: run1.counts.unnecessaryHeavyRerunCountAfter,
    unnecessaryHeavyRerunReduced: run1.counts.unnecessaryHeavyRerunReduced,
    stageActivationOk: run1.stageActivation.stageActivationOk,
  });

  writeJson(path.join(outputDir, 'repeatability-summary.json'), {
    stable: repeatabilityStable,
    runs: [comparableState(run1), comparableState(run2), comparableState(run3)],
  });

  writeJson(path.join(outputDir, 'final-dod-acceptance-summary.json'), {
    dod: summary.dod,
    acceptance: summary.acceptance,
    finalGate: summary.status === 'PASS' ? 'GO_TO_P2_WS06' : 'HOLD',
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
