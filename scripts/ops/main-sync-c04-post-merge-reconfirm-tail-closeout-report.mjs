#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluateMainSyncC04PostMergeReconfirmTailCloseout } from './main-sync-c04-post-merge-reconfirm-tail-closeout-state.mjs';

const STATUS_PATH = 'docs/OPS/STATUS/MAIN_SYNC_C04_POST_MERGE_RECONFIRM_AND_TAIL_CLOSEOUT_STATUS_V1.json';
const EVIDENCE_DIR = 'docs/OPS/EVIDENCE/MAIN_SYNC_C04_POST_MERGE_RECONFIRM_AND_TAIL_CLOSEOUT/TICKET_01';
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
  for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) out[key] = stableSortObject(value[key]);
  return out;
}

function writeJson(repoRoot, relPath, value) {
  const absPath = path.resolve(repoRoot, relPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, `${JSON.stringify(stableSortObject(value), null, 2)}\n`, 'utf8');
}

function runCommand(repoRoot, command) {
  const result = spawnSync(command[0], command.slice(1), { cwd: repoRoot, encoding: 'utf8' });
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
  const state = evaluateMainSyncC04PostMergeReconfirmTailCloseout({ repoRoot });
  const commandResults = TEST_COMMANDS.map((command) => runCommand(repoRoot, command));
  const testsOk = commandResults.every((entry) => entry.ok);
  const overallOk = state.ok && testsOk;

  writeJson(repoRoot, STATUS_PATH, {
    version: 1,
    status: overallOk ? 'ACTIVE' : 'FAILED',
    token: 'MAIN_SYNC_C04_POST_MERGE_RECONFIRM_AND_TAIL_CLOSEOUT_OK',
    contourId: state.contourId,
    taskBasename: state.taskBasename,
    formalRepoTruth: state.formalRepoTruth,
    finalMainSha: state.boundMainSha,
    promotionPrNumber: state.promotionPrNumber,
    promotionMergeSha: state.promotionMergeSha,
    syncTailClosed: overallOk,
    nextStep: state.nextStep,
    recordedAtUtc: generatedAtUtc,
  });
  writeJson(repoRoot, `${EVIDENCE_DIR}/post-merge-reconfirm.json`, {
    generatedAtUtc,
    ok: state.ok,
    checks: state.checks,
    requiredBasenames: state.requiredBasenames,
    missingBasenames: state.missingBasenames,
  });
  writeJson(repoRoot, `${EVIDENCE_DIR}/tail-closeout.json`, {
    generatedAtUtc,
    ok: overallOk,
    remoteTail: state.remoteTail,
    localRootClassification: state.localRootClassification,
    nextStep: state.nextStep,
  });
  writeJson(repoRoot, `${EVIDENCE_DIR}/test-results.json`, {
    generatedAtUtc,
    ok: testsOk,
    commandCount: commandResults.length,
    failingCommands: commandResults.filter((entry) => !entry.ok).map((entry) => entry.command),
  });
  writeJson(repoRoot, `${EVIDENCE_DIR}/command-results.json`, commandResults);

  process.stdout.write(`${JSON.stringify({
    ok: overallOk,
    finalMainSha: state.boundMainSha,
    syncTailClosed: overallOk,
    testsOk,
    nextStep: state.nextStep,
  }, null, 2)}\n`);
  process.exit(overallOk ? 0 : 1);
}

main();
