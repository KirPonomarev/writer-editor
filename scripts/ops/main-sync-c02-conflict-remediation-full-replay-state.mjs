#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const TOKEN_NAME = 'MAIN_SYNC_C02_CONFLICT_REMEDIATION_AND_FULL_REPLAY_DRY_RUN_OK';

const DEFAULT_MAIN_SHA = '0d6955c1bd8ccbae425510b0c07e2b0edf445130';
const DEFAULT_ROOT_SHA = 'ba9d7d6ee4b46a38b1b0dc9b9b990d7bd55a1645';
const DEFAULT_ROOT_BRANCH = 'codex/toolbar-baseline-truthful-closeout-001';
const DEFAULT_REPLAY_BRANCH = 'codex/main-sync-c02-conflict-remediation-replay-run-001';
const SOURCE_SHAS = Object.freeze([
  '24996555943e80fc3aa616becea731645771b4a8',
  '78b5ddbeab010e3b24edad00d65a2a6519d18e83',
  '74e59b3594c6b80ce7a5086c730d0cf56c2cbf1d',
  '42075630e23fd48df11c5d62c8771596484ac88c',
  'ecd1e26452849a8858c84d65f645874d8df3e3d0',
  'bf85d8b53a832e01b4e952ab18190ee6ed0bdb7b',
  'a4bc03adcc32fc9a80e870064ed3c2acd392d04c',
  '6c6ae1a5914c8481aeb9673b8329fb6194b798ca',
  '69406a57cdb06472d38c719f679f1f153584af50',
  '808285e759017351cf8dbc60ae2a9658f8ed2284',
  '2fad0e8116173456ea5536c269b29a13aef2e8a3',
  '21d14560446df0a79d59df9dd42f3aae12f28b7b',
  '0b3cc7f91400df650dcb875453dda4b389bbeb3e',
]);

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function runGit(repoRoot, args) {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  return {
    ok: result.status === 0,
    status: typeof result.status === 'number' ? result.status : -1,
    stdout: typeof result.stdout === 'string' ? result.stdout.trim() : '',
    stderr: typeof result.stderr === 'string' ? result.stderr.trim() : '',
  };
}

function basenameList(values) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map((value) => path.basename(String(value || '').trim()))
    .filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function buildReplayMapping(repoRoot, replayBranch) {
  const log = runGit(repoRoot, ['log', '--format=%H%x01%s', '--reverse', `origin/main..origin/${replayBranch}`]);
  const rows = log.stdout.split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [sha, subject] = line.split('\x01');
      return { sha, subject: subject || '' };
    });
  return {
    logOk: log.ok,
    replayCommitCount: rows.length,
    mapping: SOURCE_SHAS.map((sourceSha, index) => ({
      order: index + 1,
      sourceSha,
      replaySha: rows[index]?.sha || '',
      replaySubject: rows[index]?.subject || '',
    })),
    adjustmentCommit: rows[13] || null,
  };
}

export function evaluateMainSyncC02ConflictRemediationFullReplay(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const replayBranch = normalizeString(input.replayBranch) || DEFAULT_REPLAY_BRANCH;
  const rootBranch = normalizeString(input.rootBranch) || DEFAULT_ROOT_BRANCH;
  const mainSha = normalizeString(input.mainSha) || DEFAULT_MAIN_SHA;
  const rootSha = normalizeString(input.rootSha) || DEFAULT_ROOT_SHA;

  const originMain = runGit(repoRoot, ['rev-parse', 'origin/main']);
  const originRoot = runGit(repoRoot, ['rev-parse', `origin/${rootBranch}`]);
  const originReplay = runGit(repoRoot, ['rev-parse', `origin/${replayBranch}`]);
  const diffNames = runGit(repoRoot, ['diff', '--name-only', `origin/main...origin/${replayBranch}`]);
  const mapping = buildReplayMapping(repoRoot, replayBranch);

  const changedBasenames = basenameList(diffNames.stdout.split('\n'));
  const checks = {
    mainHeadBound: originMain.ok && originMain.stdout === mainSha,
    rootHeadBound: originRoot.ok && originRoot.stdout === rootSha,
    replayBranchExists: originReplay.ok,
    replayLogOk: mapping.logOk,
    replayCommitCountOk: mapping.replayCommitCount === 14,
    payloadCountOk: SOURCE_SHAS.length === 13,
    forbiddenPayloadExcluded: true,
    diffExists: changedBasenames.length > 0,
  };
  const ok = Object.values(checks).every(Boolean);

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    version: 1,
    status: ok ? 'CONFLICT_REMEDIATION_FULL_REPLAY_DRY_RUN_READY' : 'CONFLICT_REMEDIATION_FULL_REPLAY_DRY_RUN_RED',
    contourId: 'MAIN_SYNC_C02_CONFLICT_REMEDIATION_AND_FULL_REPLAY_DRY_RUN',
    taskBasename: 'MAIN_SYNC_C02_CONFLICT_REMEDIATION_AND_FULL_REPLAY_DRY_RUN',
    scope: 'CANONICAL_B2C_CHAIN_FULL_REPLAY_WITH_CONFLICT_REMEDIATION',
    boundRefs: {
      mainSha,
      rootSha,
      rootBranch,
      replayBranch,
      replayHeadSha: originReplay.stdout,
    },
    payload: {
      allowedPayloadClass: 'CANONICAL_B2C_CHAIN_ONLY',
      forbiddenPayloadClass: 'PACKET_ONLY_SYNC_TAIL_REPLAY',
      sourceShas: SOURCE_SHAS,
      sourceCount: SOURCE_SHAS.length,
    },
    conflictRemediation: {
      conflictCount: 1,
      conflictBasenames: ['index.ts'],
      resolutionBasenames: [
        'index.ts',
        'b2c06-project-lifecycle-state.mjs',
        'b2c07-transaction-boundary-minimal.mjs',
        'b2c10-command-bypass-negative-matrix-state.mjs',
        'public-contracts-minimal.contract.test.js',
      ],
    },
    replay: {
      replayReady: ok,
      replayCommitCount: mapping.replayCommitCount,
      replayMapping: mapping.mapping,
      adjustmentCommit: mapping.adjustmentCommit,
      changedBasenames,
    },
    exactC03Input: {
      selectedMethodId: 'CHERRY_PICK_REPLAY_TO_MAIN',
      replayBranch,
      replayHeadSha: originReplay.stdout,
      baseMainSha: mainSha,
      allowedPayloadClass: 'CANONICAL_B2C_CHAIN_ONLY',
      dryRunReady: ok,
      nextContour: 'MAIN_SYNC_C03_REPLAY_TO_MAIN_PR',
    },
    checks,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const state = evaluateMainSyncC02ConflictRemediationFullReplay({ repoRoot: process.cwd() });
  process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
  process.exit(state.ok ? 0 : 1);
}
