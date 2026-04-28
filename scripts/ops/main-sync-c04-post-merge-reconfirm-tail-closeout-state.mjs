#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const TOKEN_NAME = 'MAIN_SYNC_C04_POST_MERGE_RECONFIRM_AND_TAIL_CLOSEOUT_OK';

const EXPECTED_MAIN_SHA = '34773f5d84323bdd58399faa3284ca932f9f08cf';
const PROMOTION_BRANCH = 'codex/main-sync-c02-conflict-remediation-replay-run-001';
const REQUIRED_BASENAMES = Object.freeze([
  'B2C05_FORMAL_KERNEL_MINIMAL_STATUS_V1.json',
  'B2C06_PROJECT_LIFECYCLE_STATE_MACHINE_V1.json',
  'B2C07_TRANSACTION_BOUNDARY_MINIMAL_V1.json',
  'B2C08_RECOVERY_BOUNDARY_MINIMAL_V1.json',
  'B2C09_COMMAND_SURFACE_KERNEL_V1.json',
  'B2C10_MIGRATION_SAFETY_PROOF_V1.json',
  'B2C10_COMMAND_BYPASS_NEGATIVE_MATRIX_STATUS_V1.json',
  'B2C11_COMMAND_EFFECT_MODEL_STATUS_V1.json',
  'B2C12_PERSIST_EFFECTS_ATOMIC_WRITE_STATUS_V1.json',
  'scene-document.contract.ts',
  'scene-block.contract.ts',
  'scene-inline-range.contract.ts',
  'flowSceneBatchAtomic.js',
]);

function runGit(repoRoot, args) {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  return {
    ok: result.status === 0,
    stdout: typeof result.stdout === 'string' ? result.stdout.trim() : '',
    stderr: typeof result.stderr === 'string' ? result.stderr.trim() : '',
  };
}

function walk(repoRoot, dirRel, basenames = new Set()) {
  const dir = path.resolve(repoRoot, dirRel);
  if (!fs.existsSync(dir)) return basenames;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(repoRoot, path.relative(repoRoot, full), basenames);
      continue;
    }
    basenames.add(entry.name);
  }
  return basenames;
}

export function evaluateMainSyncC04PostMergeReconfirmTailCloseout(input = {}) {
  const repoRoot = path.resolve(input.repoRoot || process.cwd());
  const originMain = runGit(repoRoot, ['rev-parse', 'origin/main']);
  const head = runGit(repoRoot, ['rev-parse', 'HEAD']);
  const promotionRef = runGit(repoRoot, ['rev-parse', `origin/${PROMOTION_BRANCH}`]);
  const mergedPr = runGit(repoRoot, ['branch', '-r', '--contains', '286c082a1ea86dd5b2fd0caa143fccf9dd065eaf']);
  const basenames = walk(repoRoot, '.');
  const missingBasenames = REQUIRED_BASENAMES.filter((basename) => !basenames.has(basename));

  const checks = {
    originMainBound: originMain.ok && originMain.stdout === EXPECTED_MAIN_SHA,
    headDescendsFromMain: head.ok && runGit(repoRoot, ['merge-base', '--is-ancestor', EXPECTED_MAIN_SHA, head.stdout]).ok,
    requiredContentPresent: missingBasenames.length === 0,
    promotionBranchDeleted: !promotionRef.ok,
    mergeCommitReachableFromMain: mergedPr.stdout.split('\n').some((line) => line.trim() === 'origin/main' || line.trim() === 'origin/HEAD -> origin/main'),
  };
  const ok = Object.values(checks).every(Boolean);

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    version: 1,
    status: ok ? 'MAIN_SYNC_TAIL_CLOSED' : 'MAIN_SYNC_TAIL_CLOSEOUT_RED',
    contourId: 'MAIN_SYNC_C04_POST_MERGE_RECONFIRM_AND_TAIL_CLOSEOUT',
    taskBasename: 'MAIN_SYNC_C04_POST_MERGE_RECONFIRM_AND_TAIL_CLOSEOUT',
    formalRepoTruth: 'MAIN_AFTER_MERGE_GATE_AND_POST_MERGE_RECONFIRM',
    boundMainSha: EXPECTED_MAIN_SHA,
    promotionPrNumber: 829,
    promotionMergeSha: EXPECTED_MAIN_SHA,
    requiredBasenames: REQUIRED_BASENAMES,
    missingBasenames,
    remoteTail: {
      promotionBranch: PROMOTION_BRANCH,
      promotionBranchDeleted: !promotionRef.ok,
    },
    localRootClassification: {
      localRootDirtyObservedBeforeCloseout: true,
      dirtyRootTouched: false,
      localHygieneRequiredForMainTruth: false,
      note: 'LOCAL_ROOT_DIRTY_STATE_IS_USER_WORK_OR_SEPARATE_PRODUCT_TAIL_NOT_REQUIRED_FOR_MAIN_SYNC_TRUTH',
    },
    checks,
    nextStep: 'STOP_AND_RETURN_TO_BLOCK2',
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const state = evaluateMainSyncC04PostMergeReconfirmTailCloseout({ repoRoot: process.cwd() });
  process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
  process.exit(state.ok ? 0 : 1);
}
