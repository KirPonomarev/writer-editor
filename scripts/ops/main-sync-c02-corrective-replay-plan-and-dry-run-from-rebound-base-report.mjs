#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluateMainSyncC02CorrectiveReplayPlanAndDryRunFromReboundBase } from './main-sync-c02-corrective-replay-plan-and-dry-run-from-rebound-base-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/MAIN_SYNC_C02_CORRECTIVE_REPLAY_PLAN_AND_DRY_RUN_FROM_REBOUND_BASE/TICKET_01';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/MAIN_SYNC_C02_CORRECTIVE_REPLAY_PLAN_AND_DRY_RUN_FROM_REBOUND_BASE_STATUS_V1.json';
const DEFAULT_RUN_ID = 'TZ_MAIN_SYNC_C02_CORRECTIVE_REPLAY_PLAN_AND_DRY_RUN_FROM_REBOUND_BASE_001';

const VERIFICATION_COMMANDS = Object.freeze([
  {
    checkId: 'MAIN_SYNC_C02_CORRECTIVE_REPLAY_CONTRACT',
    cmd: ['node', '--test', 'test/contracts/main-sync-c02-corrective-replay-plan-and-dry-run-from-rebound-base.contract.test.js'],
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
    if (arg === '--status-path' && i + 1 < argv.length) {
      out.statusPath = normalizeString(argv[i + 1]) || out.statusPath;
      i += 1;
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
  const state = evaluateMainSyncC02CorrectiveReplayPlanAndDryRunFromReboundBase({ repoRoot });
  const generatedAtUtc = new Date().toISOString();
  const outputDir = path.resolve(repoRoot, args.outputDir);
  const statusPath = path.resolve(repoRoot, args.statusPath);

  writeJson(statusPath, {
    version: state.version,
    status: state.ok ? 'ACTIVE' : 'FAILED',
    token: state.token,
    taskBasename: state.taskBasename,
    contourId: state.contourId,
    scope: state.scope,
    stateScript: state.stateScript,
    reportScript: state.reportScript,
    contractTest: state.contractTest,
    nextStep: state.exactC03Input.nextContour,
    allowedReplayPayloadClass: state.scopeBinding.allowedReplayPayloadClass,
    forbiddenReplayPayloadClass: state.scopeBinding.forbiddenReplayPayloadClass,
    boundRootSha: state.boundRefs.rootSha,
    boundMainSha: state.boundRefs.mainSha,
    dryRunClass: state.dryRun.replayClass,
    recordedAtUtc: generatedAtUtc,
  });

  writeJson(path.join(outputDir, 'corrected-replay-plan.json'), {
    generatedAtUtc,
    runId: args.runId,
    ticketId: args.ticketId,
    ok: state.correctedReplayPlan.replayUnitCount > 0,
    correctedReplayPlan: state.correctedReplayPlan,
  });
  writeJson(path.join(outputDir, 'corrected-dry-run.json'), {
    generatedAtUtc,
    runId: args.runId,
    ticketId: args.ticketId,
    ok: state.ok,
    replayClass: state.dryRun.replayClass,
    cleanReplayCount: state.dryRun.cleanReplayCount,
    stoppedAtOrder: state.dryRun.stoppedAtOrder,
    stoppedAtSha: state.dryRun.stoppedAtSha,
    stoppedAtSubject: state.dryRun.stoppedAtSubject,
    conflictCount: state.dryRun.conflictCount,
    conflictFiles: state.dryRun.conflictFiles,
    changedBasenamesAtStop: state.dryRun.changedBasenamesAtStop,
    cleanupOk: state.dryRun.cleanupOk,
  });
  writeJson(path.join(outputDir, 'conflict-classification.json'), {
    replayClass: state.dryRun.replayClass,
    classification: state.dryRun.conflictCount > 0 ? 'BLOCKING_UNRESOLVED_CONFLICT' : 'NO_CONFLICT',
    conflictCount: state.dryRun.conflictCount,
    conflictFiles: state.dryRun.conflictFiles,
    stoppedAtOrder: state.dryRun.stoppedAtOrder,
    stoppedAtSha: state.dryRun.stoppedAtSha,
  });
  writeJson(path.join(outputDir, 'sha-mapping.json'), {
    mappingCount: state.dryRun.newShaMapping.length,
    mapping: state.dryRun.newShaMapping,
  });
  writeJson(path.join(outputDir, 'scope-audit.json'), {
    ok: state.checks.allowedScopeOk !== false
      && state.scopeBinding.allowedReplayPayloadClass === 'CANONICAL_B2C_CHAIN_ONLY'
      && state.scopeBinding.forbiddenReplayPayloadClass === 'PACKET_ONLY_SYNC_TAIL_REPLAY',
    allowedReplayPayloadClass: state.scopeBinding.allowedReplayPayloadClass,
    forbiddenReplayPayloadClass: state.scopeBinding.forbiddenReplayPayloadClass,
    controlPlaneScopeClass: state.scopeBinding.controlPlaneScopeClass,
    payloadCount: state.scopeBinding.canonicalPayloadCount,
  });
  writeJson(path.join(outputDir, 'fact-check.json'), {
    ok: state.dryRun.replayClass === 'DRY_RUN_GREEN' || state.dryRun.replayClass === 'STOP_UNRESOLVED_CONFLICT',
    dryRunClass: state.dryRun.replayClass,
    firstStoppedSha: state.dryRun.stoppedAtSha,
    firstStoppedOrder: state.dryRun.stoppedAtOrder,
    conflictFiles: state.dryRun.conflictFiles,
    cleanupOk: state.dryRun.cleanupOk,
  });
  writeJson(path.join(outputDir, 'exact-c03-input.json'), {
    ok: state.ok,
    exactC03Input: state.exactC03Input,
  });
  writeJson(path.join(outputDir, 'command-results.json'), []);

  const commandResults = VERIFICATION_COMMANDS.map((entry) => runCheck(repoRoot, entry));
  const verificationOk = commandResults.every((entry) => entry.ok);
  const overallOk = state.ok && verificationOk;

  writeJson(statusPath, {
    version: state.version,
    status: overallOk ? 'ACTIVE' : 'FAILED',
    token: state.token,
    taskBasename: state.taskBasename,
    contourId: state.contourId,
    scope: state.scope,
    stateScript: state.stateScript,
    reportScript: state.reportScript,
    contractTest: state.contractTest,
    nextStep: state.exactC03Input.nextContour,
    allowedReplayPayloadClass: state.scopeBinding.allowedReplayPayloadClass,
    forbiddenReplayPayloadClass: state.scopeBinding.forbiddenReplayPayloadClass,
    boundRootSha: state.boundRefs.rootSha,
    boundMainSha: state.boundRefs.mainSha,
    dryRunClass: state.dryRun.replayClass,
    recordedAtUtc: generatedAtUtc,
  });
  writeJson(path.join(outputDir, 'test-results.json'), {
    generatedAtUtc,
    runId: args.runId,
    ticketId: args.ticketId,
    ok: verificationOk,
    commandCount: commandResults.length,
    failingChecks: commandResults.filter((entry) => !entry.ok).map((entry) => entry.checkId),
    gateType: 'READINESS_ONLY_NOT_MAIN_APPROVAL',
  });
  writeJson(path.join(outputDir, 'command-results.json'), commandResults);

  process.stdout.write(`${stableStringify({
    generatedAtUtc,
    runId: args.runId,
    ticketId: args.ticketId,
    ok: overallOk,
    verificationOk,
    replayReady: state.ok,
    dryRunClass: state.dryRun.replayClass,
    cleanReplayCount: state.dryRun.cleanReplayCount,
    stoppedAtSha: state.dryRun.stoppedAtSha,
    conflictCount: state.dryRun.conflictCount,
  })}\n`);
  process.exit(overallOk ? 0 : 1);
}

main();
