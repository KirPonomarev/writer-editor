#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluateMainSyncC02ConflictRemediationFullReplay } from './main-sync-c02-conflict-remediation-full-replay-state.mjs';

const STATUS_PATH = 'docs/OPS/STATUS/MAIN_SYNC_C02_CONFLICT_REMEDIATION_AND_FULL_REPLAY_DRY_RUN_STATUS_V1.json';
const EVIDENCE_DIR = 'docs/OPS/EVIDENCE/MAIN_SYNC_C02_CONFLICT_REMEDIATION_AND_FULL_REPLAY_DRY_RUN/TICKET_01';
const RUN_ID = 'TZ_MAIN_SYNC_C02_CONFLICT_REMEDIATION_AND_FULL_REPLAY_DRY_RUN_001';
const REPLAY_WORKTREE = '/Volumes/Work/writer-editor-main-sync-c02-conflict-remediation-replay-run-001';
const TEST_COMMANDS = Object.freeze([
  ['node', '--test', 'test/contracts/scene-document-admission.contract.test.js', 'test/contracts/scene-block-admission.contract.test.js', 'test/contracts/scene-inline-range-admission.contract.test.js', 'test/contracts/public-contracts-minimal.contract.test.js', 'test/contracts/longform-public-contracts-remap.contract.test.js', 'test/contracts/b2c05-formal-kernel-minimal.contract.test.js', 'test/contracts/b2c06-project-lifecycle-state.contract.test.js', 'test/contracts/b2c07-transaction-boundary-minimal.contract.test.js', 'test/contracts/b2c08-recovery-boundary-minimal.contract.test.js', 'test/contracts/b2c09-command-surface-kernel.contract.test.js', 'test/contracts/b2c10-migration-safety-proof.contract.test.js', 'test/contracts/b2c10-command-bypass-negative-matrix.contract.test.js', 'test/contracts/b2c11-command-effect-model.contract.test.js', 'test/contracts/b2c12-persist-effects-atomic-write.contract.test.js'],
  ['npm', 'run', 'oss:policy'],
]);

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

function writeJson(repoRoot, relPath, value) {
  const absPath = path.resolve(repoRoot, relPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, `${JSON.stringify(stableSortObject(value), null, 2)}\n`, 'utf8');
}

function runCommand(cwd, command) {
  const result = spawnSync(command[0], command.slice(1), { cwd, encoding: 'utf8' });
  return {
    command: command.join(' '),
    ok: result.status === 0,
    exitCode: typeof result.status === 'number' ? result.status : -1,
    stdout: typeof result.stdout === 'string' ? result.stdout.trim() : '',
    stderr: typeof result.stderr === 'string' ? result.stderr.trim() : '',
  };
}

function main() {
  const repoRoot = process.cwd();
  const generatedAtUtc = new Date().toISOString();
  const state = evaluateMainSyncC02ConflictRemediationFullReplay({ repoRoot });
  const commandResults = TEST_COMMANDS.map((command) => runCommand(REPLAY_WORKTREE, command));
  const testsOk = commandResults.every((entry) => entry.ok);
  const overallOk = state.ok && testsOk;

  writeJson(repoRoot, STATUS_PATH, {
    version: 1,
    status: overallOk ? 'ACTIVE' : 'FAILED',
    token: 'MAIN_SYNC_C02_CONFLICT_REMEDIATION_AND_FULL_REPLAY_DRY_RUN_OK',
    contourId: state.contourId,
    taskBasename: state.taskBasename,
    scope: state.scope,
    boundMainSha: state.boundRefs.mainSha,
    boundRootSha: state.boundRefs.rootSha,
    replayBranch: state.boundRefs.replayBranch,
    replayHeadSha: state.boundRefs.replayHeadSha,
    allowedPayloadClass: state.payload.allowedPayloadClass,
    forbiddenPayloadClass: state.payload.forbiddenPayloadClass,
    replayReady: overallOk,
    nextStep: state.exactC03Input.nextContour,
    recordedAtUtc: generatedAtUtc,
  });
  writeJson(repoRoot, `${EVIDENCE_DIR}/replay-plan.json`, {
    generatedAtUtc,
    runId: RUN_ID,
    ok: state.ok,
    payload: state.payload,
    replay: state.replay,
  });
  writeJson(repoRoot, `${EVIDENCE_DIR}/conflict-remediation.json`, {
    generatedAtUtc,
    runId: RUN_ID,
    ok: true,
    conflictRemediation: state.conflictRemediation,
  });
  writeJson(repoRoot, `${EVIDENCE_DIR}/test-results.json`, {
    generatedAtUtc,
    runId: RUN_ID,
    ok: testsOk,
    commandCount: commandResults.length,
    failingCommands: commandResults.filter((entry) => !entry.ok).map((entry) => entry.command),
  });
  writeJson(repoRoot, `${EVIDENCE_DIR}/command-results.json`, commandResults);
  writeJson(repoRoot, `${EVIDENCE_DIR}/scope-audit.json`, {
    generatedAtUtc,
    runId: RUN_ID,
    ok: state.payload.allowedPayloadClass === 'CANONICAL_B2C_CHAIN_ONLY'
      && state.payload.forbiddenPayloadClass === 'PACKET_ONLY_SYNC_TAIL_REPLAY'
      && state.payload.sourceCount === 13
      && state.replay.replayCommitCount === 14,
    allowedPayloadClass: state.payload.allowedPayloadClass,
    forbiddenPayloadClass: state.payload.forbiddenPayloadClass,
    sourceCount: state.payload.sourceCount,
    replayCommitCount: state.replay.replayCommitCount,
  });
  writeJson(repoRoot, `${EVIDENCE_DIR}/fact-check.json`, {
    generatedAtUtc,
    runId: RUN_ID,
    ok: overallOk,
    mainHeadBound: state.checks.mainHeadBound,
    rootHeadBound: state.checks.rootHeadBound,
    replayBranchExists: state.checks.replayBranchExists,
    testsOk,
  });
  writeJson(repoRoot, `${EVIDENCE_DIR}/exact-c03-input.json`, {
    generatedAtUtc,
    runId: RUN_ID,
    ok: overallOk,
    exactC03Input: {
      ...state.exactC03Input,
      dryRunReady: overallOk,
    },
  });

  process.stdout.write(`${JSON.stringify({
    ok: overallOk,
    replayReady: overallOk,
    replayHeadSha: state.boundRefs.replayHeadSha,
    sourceCount: state.payload.sourceCount,
    replayCommitCount: state.replay.replayCommitCount,
    conflictCount: state.conflictRemediation.conflictCount,
    testsOk,
  }, null, 2)}\n`);
  process.exit(overallOk ? 0 : 1);
}

main();
