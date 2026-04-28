#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluateMainSyncC02MergeabilityState } from './main-sync-c02-mergeability-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/MAIN_SYNC_C02/TICKET_01';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/MAIN_SYNC_C02_MERGEABILITY_STATUS_V1.json';
const DEFAULT_RUN_ID = 'TZ_MAIN_SYNC_C02_MERGEABILITY_001';

const VERIFICATION_COMMANDS = Object.freeze([
  {
    checkId: 'MAIN_SYNC_C01_CONTRACT',
    cmd: ['node', '--test', 'test/contracts/main-sync-c01-ahead-inventory.contract.test.js'],
  },
  {
    checkId: 'B2C10_CONTRACT',
    cmd: ['node', '--test', 'test/contracts/b2c10-command-bypass-negative-matrix.contract.test.js'],
  },
  {
    checkId: 'B2C11_CONTRACT',
    cmd: ['node', '--test', 'test/contracts/b2c11-command-effect-model.contract.test.js'],
  },
  {
    checkId: 'B2C12_CONTRACT',
    cmd: ['node', '--test', 'test/contracts/b2c12-persist-effects-atomic-write.contract.test.js'],
  },
  {
    checkId: 'OSS_POLICY',
    cmd: ['npm', 'run', 'oss:policy'],
  },
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

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${stableStringify(value)}\n`, 'utf8');
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    outputDir: DEFAULT_OUTPUT_DIR,
    statusPath: DEFAULT_STATUS_PATH,
    runId: DEFAULT_RUN_ID,
    ticketId: DEFAULT_RUN_ID,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;
    if (arg === '--output-dir' && i + 1 < argv.length) {
      out.outputDir = normalizeString(argv[i + 1]) || out.outputDir;
      i += 1;
      continue;
    }
    if (arg.startsWith('--output-dir=')) {
      out.outputDir = normalizeString(arg.slice('--output-dir='.length)) || out.outputDir;
      continue;
    }
    if (arg === '--status-path' && i + 1 < argv.length) {
      out.statusPath = normalizeString(argv[i + 1]) || out.statusPath;
      i += 1;
      continue;
    }
    if (arg.startsWith('--status-path=')) {
      out.statusPath = normalizeString(arg.slice('--status-path='.length)) || out.statusPath;
      continue;
    }
  }

  return out;
}

function runCheck(repoRoot, entry) {
  const result = spawnSync(entry.cmd[0], entry.cmd.slice(1), {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return {
    checkId: entry.checkId,
    ok: result.status === 0,
    exitCode: typeof result.status === 'number' ? result.status : -1,
    command: entry.cmd.join(' '),
    stdout: typeof result.stdout === 'string' ? result.stdout.trim() : '',
    stderr: typeof result.stderr === 'string' ? result.stderr.trim() : '',
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const state = evaluateMainSyncC02MergeabilityState({ repoRoot });
  const generatedAtUtc = new Date().toISOString();
  const outputDir = path.resolve(repoRoot, args.outputDir);
  const statusPath = path.resolve(repoRoot, args.statusPath);

  const commandResults = VERIFICATION_COMMANDS.map((entry) => runCheck(repoRoot, entry));
  const prePrVerificationOk = commandResults.every((entry) => entry.ok);
  const overallOk = state.ok && prePrVerificationOk;

  writeJson(statusPath, {
    version: state.version,
    status: overallOk ? 'ACTIVE' : 'FAILED',
    token: state.token,
    scope: state.scope,
    stateScript: state.stateScript,
    reportScript: state.reportScript,
    contractTest: state.contractTest,
  });

  writeJson(path.join(outputDir, 'probe-meta.json'), {
    generatedAtUtc,
    runId: args.runId,
    ticketId: args.ticketId,
    boundMainSha: state.boundRefs.mainSha,
    boundRootSha: state.boundRefs.rootSha,
    currentHeadMatchesBoundRoot: state.checks.currentHeadMatchesBoundRoot,
    localHeadDescendsFromBoundRoot: state.checks.localHeadDescendsFromBoundRoot,
  });
  writeJson(path.join(outputDir, 'mergeability-summary.json'), {
    generatedAtUtc,
    runId: args.runId,
    ticketId: args.ticketId,
    ok: state.ok,
    failReason: state.failReason,
    boundRefs: state.boundRefs,
    checks: state.checks,
    c01Rebind: state.c01Rebind,
    probe: {
      mergeBaseFound: state.probe.mergeBaseFound,
      mergeBaseSha: state.probe.mergeBaseSha,
      mergeExitCode: state.probe.mergeExitCode,
      mergeabilityClass: state.probe.mergeabilityClass,
      conflictCount: state.probe.conflictCount,
      cleanupOk: state.probe.cleanupOk,
      mergeStderr: state.probe.mergeStderr,
    },
    issues: state.issues,
  });
  writeJson(path.join(outputDir, 'conflict-set.json'), {
    mergeabilityClass: state.probe.mergeabilityClass,
    conflictCount: state.probe.conflictCount,
    unmergedFiles: state.probe.unmergedFiles,
  });
  writeJson(path.join(outputDir, 'pre-pr-verification.json'), {
    generatedAtUtc,
    runId: args.runId,
    ticketId: args.ticketId,
    ok: prePrVerificationOk,
    commandCount: commandResults.length,
    failingChecks: commandResults.filter((entry) => !entry.ok).map((entry) => entry.checkId),
  });
  writeJson(path.join(outputDir, 'command-results.json'), commandResults);

  process.stdout.write(`${stableStringify({
    generatedAtUtc,
    runId: args.runId,
    ticketId: args.ticketId,
    ok: overallOk,
    mergeabilityOk: state.ok,
    prePrVerificationOk,
    failReason: state.failReason,
    mergeabilityClass: state.probe.mergeabilityClass,
    commandCount: commandResults.length,
  })}\n`);
  process.exit(overallOk ? 0 : 1);
}

main();
