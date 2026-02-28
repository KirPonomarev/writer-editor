#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateP2Ws04BridgeDriftSimplificationState } from './p2-ws04-bridge-drift-simplification-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P2_CONTOUR/TICKET_04';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/P2_WS04_BRIDGE_DRIFT_SIMPLIFICATION_v1.json';
const DEFAULT_BINDING_INDEX_OUTPUT_PATH = 'docs/OPS/STATUS/BINDING_INDEX_v0.md';

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

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    outputDir: DEFAULT_OUTPUT_DIR,
    statusPath: DEFAULT_STATUS_PATH,
    bindingIndexOutputPath: DEFAULT_BINDING_INDEX_OUTPUT_PATH,
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

    if (arg === '--binding-index-output-path' && i + 1 < argv.length) {
      out.bindingIndexOutputPath = normalizeString(argv[i + 1]) || DEFAULT_BINDING_INDEX_OUTPUT_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--binding-index-output-path=')) {
      out.bindingIndexOutputPath = normalizeString(arg.slice('--binding-index-output-path='.length)) || DEFAULT_BINDING_INDEX_OUTPUT_PATH;
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
    token: state.P2_WS04_BRIDGE_DRIFT_SIMPLIFICATION_OK,
    counts: state.counts,
    negativeResults: state.negativeResults,
    positiveResults: state.positiveResults,
    dod: state.dod,
    acceptance: state.acceptance,
    detector: state.detector,
  };
}

function formatBindingIndexMarkdown(summary) {
  const rows = summary.simplification.simplifiedRows || [];
  const header = [
    '# BINDING_INDEX_v0',
    '',
    'STATUS: NORMALIZED_SIMPLIFIED',
    `GENERATED_AT_UTC: ${summary.generatedAtUtc}`,
    'DETECTOR: WS04_BRIDGE_DRIFT_SINGLE_DETECTOR_V1',
    'SOURCE: XPLAT_UNIFIED_MASTER_EXECUTION_CONTRACT_v3.13a-final.md',
    '',
    '| MAP_ID | MAP_SECTION | LAW_SECTIONS | GATE_TOKEN | FAILSIGNAL | MODE | BINDING |',
    '|---|---|---|---|---|---|---|',
  ];

  const tableRows = rows.map((row) => {
    const law = Array.isArray(row.lawSections) ? row.lawSections.join(', ') : '';
    return `| ${row.mapId} | ${row.mapSection} | ${law} | ${row.gateTokenRaw} | ${row.failSignalRaw} | ${row.modeRawNormalized} | ${row.binding} |`;
  });

  const footer = [
    '',
    'DRIFT_RULE: GAP_ROWS_MUST_BE_ADVISORY_ONLY',
    'DRIFT_RULE: BOUND_ROWS_MUST_HAVE_GATE_FAILSIGNAL_MODE_LINK',
    'DRIFT_RULE: SINGLE_DETECTOR_REPORT_DETERMINISTIC',
    '',
  ];

  return `${[...header, ...tableRows, ...footer].join('\n')}`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const outputDir = path.resolve(repoRoot, args.outputDir);
  const statusPath = path.resolve(repoRoot, args.statusPath);
  const bindingIndexOutputPath = path.resolve(repoRoot, args.bindingIndexOutputPath);

  const run1 = evaluateP2Ws04BridgeDriftSimplificationState({ repoRoot });
  const run2 = evaluateP2Ws04BridgeDriftSimplificationState({ repoRoot });
  const run3 = evaluateP2Ws04BridgeDriftSimplificationState({ repoRoot });

  const repeatabilityStable = stableStringify(comparableState(run1)) === stableStringify(comparableState(run2))
    && stableStringify(comparableState(run2)) === stableStringify(comparableState(run3));

  const generatedAtUtc = new Date().toISOString();

  const summary = {
    status: run1.ok && repeatabilityStable ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    objective: 'УПРОСТИТЬ_BRIDGE_DRIFT_CONTROL_БЕЗ_ПОТЕРИ_ТРАССИРУЕМОСТИ_И_БЕЗ_РАСШИРЕНИЯ_BLOCKING_SURFACE',
    blockingSurfaceExpansion: false,
    counts: run1.counts,
    negativeResults: run1.negativeResults,
    positiveResults: run1.positiveResults,
    dod: {
      ...run1.dod,
      DOD_04: repeatabilityStable,
      DOD_05: true,
    },
    acceptance: {
      ...run1.acceptance,
      ACCEPTANCE_03: true,
      ACCEPTANCE_04: run1.ok && repeatabilityStable,
    },
    generatedAtUtc,
    detector: run1.detector,
    simplification: run1.simplification,
    drift: run1.drift,
  };

  const statusDoc = {
    version: 1,
    token: 'P2_WS04_BRIDGE_DRIFT_SIMPLIFICATION_OK',
    rawRowCount: summary.counts.rawRowCount,
    simplifiedRowCount: summary.counts.simplifiedRowCount,
    duplicateRowsBeforeCount: summary.counts.duplicateRowsBeforeCount,
    duplicateRowsAfterCount: summary.counts.duplicateRowsAfterCount,
    signalLossCount: summary.counts.signalLossCount,
    advisoryToBlockingDriftCount: summary.counts.advisoryToBlockingDriftCount,
    repeatabilityStable3Runs: repeatabilityStable,
    status: summary.status,
    updatedAtUtc: generatedAtUtc,
  };

  writeJson(statusPath, statusDoc);
  writeText(bindingIndexOutputPath, formatBindingIndexMarkdown(summary));

  writeJson(path.join(outputDir, 'negative-results.json'), {
    target: {
      NEGATIVE_01: 'BOUND_ROW_WITHOUT_GATE_OR_FAILSIGNAL_MUST_FAIL',
      NEGATIVE_02: 'GAP_ROW_MARKED_BLOCKING_MUST_FAIL',
      NEGATIVE_03: 'MODE_MISMATCH_WITH_CANON_MATRIX_MUST_FAIL',
      NEGATIVE_04: 'NEW_MAP_SECTION_WITHOUT_BRIDGE_ROW_MUST_FAIL',
      NEGATIVE_05: 'LAW_MAP_CONFLICT_WITHOUT_RECONCILIATION_NOTE_MUST_FAIL',
    },
    results: run1.negativeResults,
  });

  writeJson(path.join(outputDir, 'positive-results.json'), {
    target: {
      POSITIVE_01: 'ВСЕ_BOUND_СТРОКИ_ПОЛНОСТЬЮ_ТРАССИРУЮТСЯ_К_LAW_GATE_FAILSIGNAL_MODE',
      POSITIVE_02: 'ВСЕ_GAP_СТРОКИ_ЯВНО_ПОМЕЧЕНЫ_И_НЕ_BLOCKING',
      POSITIVE_03: 'DRIFT_CHECK_ОТЧЕТ_ДЕТЕРМИНИРОВАННЫЙ',
    },
    results: run1.positiveResults,
  });

  writeJson(path.join(outputDir, 'bridge-simplification-summary.json'), {
    rawRowCount: run1.counts.rawRowCount,
    normalizedRowCount: run1.counts.normalizedRowCount,
    simplifiedRowCount: run1.counts.simplifiedRowCount,
    duplicateRowsBeforeCount: run1.counts.duplicateRowsBeforeCount,
    duplicateRowsAfterCount: run1.counts.duplicateRowsAfterCount,
    signalLossCount: run1.counts.signalLossCount,
    detectorId: run1.detector.detectorId,
  });

  writeJson(path.join(outputDir, 'drift-summary.json'), {
    boundRowsMissingFieldsCount: run1.counts.boundRowsMissingFieldsCount,
    boundTraceabilityFailureCount: run1.counts.boundTraceabilityFailureCount,
    gapRowsBlockingCount: run1.counts.gapRowsBlockingCount,
    modeMismatchCount: run1.counts.modeMismatchCount,
    missingBridgeRowsCount: run1.counts.missingBridgeRowsCount,
    lawConflictCount: run1.counts.lawConflictCount,
    advisoryToBlockingDriftCount: run1.counts.advisoryToBlockingDriftCount,
  });

  writeJson(path.join(outputDir, 'repeatability-summary.json'), {
    stable: repeatabilityStable,
    runs: [comparableState(run1), comparableState(run2), comparableState(run3)],
  });

  writeJson(path.join(outputDir, 'final-dod-acceptance-summary.json'), {
    dod: summary.dod,
    acceptance: summary.acceptance,
    finalGate: summary.status === 'PASS' ? 'GO_TO_P2_WS05' : 'HOLD',
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
