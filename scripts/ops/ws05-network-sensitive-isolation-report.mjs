#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateWs05NetworkSensitiveIsolationState } from './ws05-network-sensitive-isolation-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P0_CONTOUR/TICKET_05';

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
    token: state.WS05_NETWORK_SENSITIVE_ISOLATION_OK,
    negativeResults: state.negativeResults,
    positiveResults: state.positiveResults,
    dod: {
      NEXT_TZ_DOD_01: state.dod.NEXT_TZ_DOD_01,
      NEXT_TZ_DOD_02: state.dod.NEXT_TZ_DOD_02,
      NEXT_TZ_DOD_03: state.dod.NEXT_TZ_DOD_03,
      NEXT_TZ_DOD_04: state.dod.NEXT_TZ_DOD_04,
      NEXT_TZ_DOD_05: state.dod.NEXT_TZ_DOD_05,
      NEXT_TZ_DOD_07: state.dod.NEXT_TZ_DOD_07,
    },
    acceptance: state.acceptance,
    releaseClass: state.details.releaseClass,
    networkClassification: state.details.networkClassification,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const outputDir = path.resolve(repoRoot, args.outputDir || DEFAULT_OUTPUT_DIR);

  const state = evaluateWs05NetworkSensitiveIsolationState({ repoRoot });
  const runs = [
    evaluateWs05NetworkSensitiveIsolationState({ repoRoot }),
    evaluateWs05NetworkSensitiveIsolationState({ repoRoot }),
    evaluateWs05NetworkSensitiveIsolationState({ repoRoot }),
  ];

  const comparableRuns = runs.map((entry) => normalizeComparable(entry));
  const stable = JSON.stringify(comparableRuns[0]) === JSON.stringify(comparableRuns[1])
    && JSON.stringify(comparableRuns[1]) === JSON.stringify(comparableRuns[2]);

  const dod = {
    ...state.dod,
    NEXT_TZ_DOD_06: stable,
  };

  const acceptance = {
    ...state.acceptance,
    NEXT_TZ_ACCEPTANCE_04: state.acceptance.NEXT_TZ_ACCEPTANCE_04 && stable,
  };

  const summary = {
    status: state.ok && stable ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    generatedAtUtc: new Date().toISOString(),
    failSignalTarget: state.failSignalTarget,
    modeNote: state.modeNote,
    activeCanonLockCheckPass: state.activeCanonLockCheckPass,
    stageActivationGuardCheckPass: state.stageActivationGuardCheckPass,
    advisoryAsBlockingDriftEqualsZeroInWs05Scope: state.advisoryAsBlockingDriftEqualsZeroInWs05Scope,
    dod,
    acceptance,
    repeatabilityStable3Runs: stable,
  };

  writeJson(path.join(outputDir, 'tz-p0-ws05-scenarios.json'), {
    negativeResults: state.negativeResults,
    positiveResults: state.positiveResults,
    negativeDetails: state.details.negativeScenarios,
    positiveDetails: state.details.positiveScenarios,
  });

  writeJson(path.join(outputDir, 'tz-p0-ws05-network-classification-summary.json'), {
    remoteUnavailableStopCode: state.details.networkClassification.remoteUnavailableStopCode,
    degradedStopCode: state.details.networkClassification.degradedStopCode,
    staleRemote: state.details.networkClassification.staleRemote,
    advisoryAsBlockingDriftEqualsZeroInWs05Scope: state.advisoryAsBlockingDriftEqualsZeroInWs05Scope,
  });

  writeJson(path.join(outputDir, 'tz-p0-ws05-release-decision-class-summary.json'), {
    baseline: state.details.releaseClass.baseline,
    remoteUnavailableProbe: state.details.releaseClass.remoteUnavailableProbe,
    mixedOfflineOnline: state.details.releaseClass.mixedOfflineOnline,
    stableClassUnderRemoteUnavailable: state.details.releaseClass.stableClassUnderRemoteUnavailable,
    offlineIntegrityPrecedence: state.details.releaseClass.offlineIntegrityPrecedence,
  });

  writeJson(path.join(outputDir, 'tz-p0-ws05-offline-integrity-summary.json'), {
    effectiveBlockingCase: state.details.releaseClass.effectiveBlockingCase,
    offlineIntegrityPrecedence: state.details.releaseClass.offlineIntegrityPrecedence,
    locallyVerifiable: state.dod.NEXT_TZ_DOD_03,
  });

  writeJson(path.join(outputDir, 'tz-p0-ws05-repeatable-pass-3runs.json'), {
    stable,
    runs: comparableRuns,
  });

  writeJson(path.join(outputDir, 'tz-p0-ws05-summary.json'), summary);

  process.stdout.write(`${stableStringify(summary)}\n`);
  process.exit(summary.status === 'PASS' ? 0 : 1);
}

main();
