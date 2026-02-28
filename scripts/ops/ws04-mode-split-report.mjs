#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateWs04ModeSplitEnforcementState } from './ws04-mode-split-enforcement-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P0_CONTOUR/TICKET_04';

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

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${stableStringify(value)}\n`, 'utf8');
}

function normalizeComparable(state) {
  return {
    ok: state.ok,
    token: state.WS04_MODE_SPLIT_ENFORCEMENT_OK,
    modeMatrixSingleAuthorityStatus: state.modeMatrixSingleAuthorityStatus,
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    negativeResults: state.negativeResults,
    positiveResults: state.positiveResults,
    dod: state.dod,
    acceptance: state.acceptance,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const outputDir = path.resolve(repoRoot, args.outputDir || DEFAULT_OUTPUT_DIR);

  const state = evaluateWs04ModeSplitEnforcementState({ repoRoot });
  const runs = [
    evaluateWs04ModeSplitEnforcementState({ repoRoot }),
    evaluateWs04ModeSplitEnforcementState({ repoRoot }),
    evaluateWs04ModeSplitEnforcementState({ repoRoot }),
  ];

  const comparableRuns = runs.map((entry) => normalizeComparable(entry));
  const stable = JSON.stringify(comparableRuns[0]) === JSON.stringify(comparableRuns[1])
    && JSON.stringify(comparableRuns[1]) === JSON.stringify(comparableRuns[2]);

  const summary = {
    status: state.ok && stable ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    generatedAtUtc: new Date().toISOString(),
    failSignalStatus: state.failSignalStatus,
    modeMatrixSingleAuthorityStatus: state.modeMatrixSingleAuthorityStatus,
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    modeAwareExitPolicyOk: state.modeAwareExitPolicyOk,
    activeCanonLockCheckPass: state.activeCanonLockCheckPass,
    stageActivationGuardCheckPass: state.stageActivationGuardCheckPass,
    noNonCanonAutoblockIntroduced: state.noNonCanonAutoblockIntroduced,
    dod: state.dod,
    acceptance: state.acceptance,
    repeatabilityStable3Runs: stable,
  };

  writeJson(path.join(outputDir, 'tz-p0-ws04-scenarios.json'), {
    negativeResults: state.negativeResults,
    positiveResults: state.positiveResults,
    negativeDetails: state.details.negativeScenarios,
  });

  writeJson(path.join(outputDir, 'tz-p0-ws04-mode-drift-summary.json'), {
    modeMatrixSingleAuthorityStatus: state.modeMatrixSingleAuthorityStatus,
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero: state.advisoryToBlockingDriftCountZero,
    authorityState: state.details.authorityState,
  });

  writeJson(path.join(outputDir, 'tz-p0-ws04-exit-policy-summary.json'), {
    modeAwareExitPolicyOk: state.modeAwareExitPolicyOk,
    exitPolicyState: state.details.exitPolicyState,
    advisoryLocked: state.details.advisoryLocked,
    nonCanonAutoblock: state.details.nonCanonAutoblock,
  });

  writeJson(path.join(outputDir, 'tz-p0-ws04-repeatable-pass-3runs.json'), {
    stable,
    runs: comparableRuns,
  });

  writeJson(path.join(outputDir, 'tz-p0-ws04-summary.json'), summary);

  process.stdout.write(`${stableStringify(summary)}\n`);
  process.exit(summary.status === 'PASS' ? 0 : 1);
}

main();
