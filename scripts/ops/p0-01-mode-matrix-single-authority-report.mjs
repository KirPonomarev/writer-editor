#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P0_CONTOUR/TICKET_01';
const FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const COMMAND_NAMESPACE_STATIC_CHECK_PATH = 'scripts/ops/check-command-namespace-static.mjs';
const EXECUTION_SEQUENCE_CHECK_PATH = 'scripts/ops/check-execution-sequence.mjs';

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
    outputDir: DEFAULT_OUTPUT_DIR,
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${stableStringify(value)}\n`, 'utf8');
}

function parseJsonOutput(stdout) {
  try {
    return JSON.parse(String(stdout || '{}'));
  } catch {
    return {};
  }
}

function runNodeScript(scriptPath, args = [], cwd = process.cwd()) {
  return spawnSync(process.execPath, [scriptPath, '--json', ...args], {
    cwd,
    encoding: 'utf8',
  });
}

function runBinaryTestA(repoRoot, failRegistry) {
  const modePairs = [
    { mode: 'pr', modeKey: 'prCore' },
    { mode: 'release', modeKey: 'release' },
    { mode: 'promotion', modeKey: 'promotion' },
  ];

  const mismatches = [];
  const driftCases = [];

  for (const row of failRegistry.failSignals || []) {
    if (!row || typeof row.code !== 'string' || !row.code.trim()) continue;
    for (const modePair of modePairs) {
      const expectedDisposition = normalizeString((row.modeMatrix || {})[modePair.modeKey]).toLowerCase();
      if (expectedDisposition !== 'advisory' && expectedDisposition !== 'blocking') continue;
      const expectedShouldBlock = expectedDisposition === 'blocking';

      const actual = evaluateModeMatrixVerdict({
        repoRoot,
        mode: modePair.mode,
        failSignalCode: row.code,
      });

      const mismatch = (
        !actual.ok
        || actual.modeDisposition !== expectedDisposition
        || actual.shouldBlock !== expectedShouldBlock
      );

      if (mismatch) {
        mismatches.push({
          failSignalCode: row.code,
          mode: modePair.mode,
          expectedDisposition,
          expectedShouldBlock,
          actualDisposition: actual.modeDisposition,
          actualShouldBlock: actual.shouldBlock,
          actualOk: actual.ok,
          actualIssues: actual.issues,
        });
      }

      if (expectedDisposition === 'advisory' && actual.shouldBlock) {
        driftCases.push({
          failSignalCode: row.code,
          mode: modePair.mode,
          expectedDisposition,
          actualDisposition: actual.modeDisposition,
          reason: 'ADVISORY_TO_BLOCKING_DRIFT',
        });
      }
    }
  }

  return {
    mismatchCount: mismatches.length,
    driftCount: driftCases.length,
    mismatches,
    driftCases,
  };
}

function runBinaryTestB(repoRoot) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p0-01-binary-b-'));
  const fixturePath = path.join(tmpDir, 'legacy-prefix-fixture.mjs');
  fs.writeFileSync(fixturePath, "export const demo = 'cmd.file.save';\n", 'utf8');

  const check = runNodeScript(
    path.resolve(repoRoot, COMMAND_NAMESPACE_STATIC_CHECK_PATH),
    ['--mode=pr', '--scan-root', tmpDir],
    repoRoot,
  );
  const payload = parseJsonOutput(check.stdout);

  fs.rmSync(tmpDir, { recursive: true, force: true });

  const ok = check.status === 0
    && payload
    && payload.result === 'WARN'
    && payload.failSignalCode === 'E_COMMAND_NAMESPACE_UNKNOWN'
    && payload.modeDecision
    && payload.modeDecision.modeDisposition === 'advisory'
    && payload.modeDecision.shouldBlock === false
    && payload.canonicalModeMatrixEvaluatorId === CANONICAL_MODE_MATRIX_EVALUATOR_ID;

  return {
    ok,
    exitCode: Number.isInteger(check.status) ? check.status : 1,
    result: String(payload.result || ''),
    failSignalCode: String(payload.failSignalCode || ''),
    evaluatorId: String(payload.canonicalModeMatrixEvaluatorId || ''),
    modeDecision: payload.modeDecision || null,
  };
}

function makeFixtureLaw(sequence) {
  const lines = sequence.map((token, index) => (index === 0 ? `\`${token}\`` : `→ \`${token}\``));
  return [
    '# LAW',
    '',
    '### A1) EXECUTION SEQUENCE (BINDING)',
    ...lines,
    '',
    'Fail candidate: `E_SEQUENCE_ORDER_DRIFT`',
    '',
    '#### A1.1) OPS_INTEGRITY_P0 (DEFINITION, BINDING)',
    '`OPS_INTEGRITY_P0`',
  ].join('\n');
}

function makeExecutionSequenceFixtureRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p0-01-repeatable-'));
  const canonRelPath = path.join('docs', 'OPS', 'STATUS', 'EXECUTION_SEQUENCE_CANON_v1.json');
  const lawPathCanonRelPath = path.join('docs', 'OPS', 'STATUS', 'LAW_PATH_CANON.json');
  const lawRelPath = path.join('docs', 'OPS', 'STATUS', 'XPLAT_UNIFIED_MASTER_EXECUTION_CONTRACT_v3.12.md');

  const canonSequence = [
    'CORE_SOT_EXECUTABLE',
    'CAPABILITY_ENFORCEMENT',
    'OPS_INTEGRITY_P0',
    'XPLAT_ARCHITECTURE_CONTRACT',
  ];

  writeJson(path.join(root, canonRelPath), {
    version: 1,
    sequence: canonSequence,
  });
  writeJson(path.join(root, lawPathCanonRelPath), {
    version: 1,
    lawDocPath: lawRelPath.replaceAll(path.sep, '/'),
    lawDocId: 'XPLAT_UNIFIED_MASTER_EXECUTION_CONTRACT',
    status: 'ACTIVE_CANON',
    notes: 'fixture',
  });

  const lawAbsPath = path.join(root, lawRelPath);
  fs.mkdirSync(path.dirname(lawAbsPath), { recursive: true });
  fs.writeFileSync(lawAbsPath, `${makeFixtureLaw(canonSequence)}\n`, 'utf8');

  return { root, canonSequence, lawAbsPath };
}

function runRepeatablePass3(repoRoot) {
  const fixture = makeExecutionSequenceFixtureRepo();
  const runs = [];
  const comparableRuns = [];

  try {
    const driftedLaw = makeFixtureLaw([
      fixture.canonSequence[1],
      fixture.canonSequence[0],
      fixture.canonSequence[2],
      fixture.canonSequence[3],
    ]);
    fs.writeFileSync(fixture.lawAbsPath, `${driftedLaw}\n`, 'utf8');

    for (let i = 0; i < 3; i += 1) {
      const run = runNodeScript(
        path.resolve(repoRoot, EXECUTION_SEQUENCE_CHECK_PATH),
        ['--repo-root', fixture.root, '--mode=release'],
        repoRoot,
      );
      const payload = parseJsonOutput(run.stdout);
      runs.push({
        run: i + 1,
        exitCode: Number.isInteger(run.status) ? run.status : 1,
        result: String(payload.result || ''),
        failSignalCode: String(payload.failSignalCode || ''),
        failReason: String(payload.failReason || ''),
        evaluatorId: String(payload.canonicalModeMatrixEvaluatorId || ''),
        modeDecision: payload.modeDecision || null,
      });
      comparableRuns.push({
        exitCode: Number.isInteger(run.status) ? run.status : 1,
        result: String(payload.result || ''),
        failSignalCode: String(payload.failSignalCode || ''),
        failReason: String(payload.failReason || ''),
        evaluatorId: String(payload.canonicalModeMatrixEvaluatorId || ''),
        modeDecision: payload.modeDecision || null,
      });
    }
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }

  const baseline = JSON.stringify(comparableRuns[0]);
  const identicalVerdicts = comparableRuns.every((entry) => JSON.stringify(entry) === baseline);
  const allBlocking = runs.every((entry) => entry.exitCode !== 0 && entry.result === 'FAIL');

  return {
    ok: identicalVerdicts && allBlocking,
    identicalVerdicts,
    allBlocking,
    runs,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const outputDir = path.resolve(repoRoot, args.outputDir || DEFAULT_OUTPUT_DIR);

  const failRegistry = readJson(path.resolve(repoRoot, FAILSIGNAL_REGISTRY_PATH));
  const binaryA = runBinaryTestA(repoRoot, failRegistry);
  const binaryB = runBinaryTestB(repoRoot);
  const repeatable = runRepeatablePass3(repoRoot);

  const gateMap = {
    p0_01_binary_test_a: binaryA.mismatchCount === 0 ? 'PASS' : 'FAIL',
    p0_01_binary_test_b: binaryB.ok ? 'PASS' : 'FAIL',
    p0_01_repeatable_pass_3runs: repeatable.ok ? 'PASS' : 'FAIL',
    advisory_to_blocking_drift_count_zero: binaryA.driftCount === 0 ? 'PASS' : 'FAIL',
  };

  const summary = {
    status: Object.values(gateMap).every((value) => value === 'PASS') ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    evaluatorId: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    mismatchCount: binaryA.mismatchCount,
    advisoryToBlockingDriftCount: binaryA.driftCount,
    repeatablePass: repeatable.ok,
    gates: gateMap,
    generatedAtUtc: new Date().toISOString(),
  };

  const mainReport = {
    reportId: 'MODE_MATRIX_SINGLE_AUTHORITY_REPORT_V1',
    ...summary,
    details: {
      binaryTestA: {
        mismatchCount: binaryA.mismatchCount,
      },
      binaryTestB: {
        ok: binaryB.ok,
      },
      repeatablePass3Runs: {
        ok: repeatable.ok,
      },
    },
  };

  const ticketMeta = {
    runId: summary.runId,
    ticketId: summary.ticketId,
    outputDir: path.relative(repoRoot, outputDir).replaceAll(path.sep, '/'),
    evaluatorId: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    generatedAtUtc: summary.generatedAtUtc,
  };

  writeJson(path.join(outputDir, 'mode-matrix-single-authority-report.json'), mainReport);
  writeJson(path.join(outputDir, 'evaluator-mismatch-cases.json'), {
    mismatchCount: binaryA.mismatchCount,
    mismatches: binaryA.mismatches,
  });
  writeJson(path.join(outputDir, 'advisory-blocking-drift-cases.json'), {
    advisoryToBlockingDriftCount: binaryA.driftCount,
    driftCases: binaryA.driftCases,
  });
  writeJson(path.join(outputDir, 'repeatable-pass-3runs.json'), repeatable);
  writeJson(path.join(outputDir, 'summary.json'), summary);
  writeJson(path.join(outputDir, 'ticket-meta.json'), ticketMeta);

  process.stdout.write(`${stableStringify(summary)}\n`);
  process.exit(summary.status === 'PASS' ? 0 : 1);
}

main();
