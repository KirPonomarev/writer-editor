#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const TOKEN_NAME = 'MAIN_SYNC_C02_MERGEABILITY_READY_OK';
export const FAIL_SIGNAL_CODE = 'E_MAIN_SYNC_C02_MERGEABILITY_RED';

const DEFAULT_ROOT_BRANCH = 'codex/toolbar-baseline-truthful-closeout-001';
const DEFAULT_MAIN_BRANCH = 'main';
const DEFAULT_BOUND_ROOT_SHA = '33e9c027ea24fbd01c0eaf4519fa2a7c2ec530d6';
const DEFAULT_BOUND_MAIN_SHA = '0d6955c1bd8ccbae425510b0c07e2b0edf445130';
const C01_BOUND_ROOT_SHA = '0b3cc7f91400df650dcb875453dda4b389bbeb3e';

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
    rootSha: DEFAULT_BOUND_ROOT_SHA,
    mainSha: DEFAULT_BOUND_MAIN_SHA,
    rootBranch: DEFAULT_ROOT_BRANCH,
    mainBranch: DEFAULT_MAIN_BRANCH,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;
    if (arg === '--root-sha' && i + 1 < argv.length) {
      out.rootSha = normalizeString(argv[i + 1]) || out.rootSha;
      i += 1;
      continue;
    }
    if (arg.startsWith('--root-sha=')) {
      out.rootSha = normalizeString(arg.slice('--root-sha='.length)) || out.rootSha;
      continue;
    }
    if (arg === '--main-sha' && i + 1 < argv.length) {
      out.mainSha = normalizeString(argv[i + 1]) || out.mainSha;
      i += 1;
      continue;
    }
    if (arg.startsWith('--main-sha=')) {
      out.mainSha = normalizeString(arg.slice('--main-sha='.length)) || out.mainSha;
      continue;
    }
  }

  return out;
}

function runGit(cwd, args, extra = {}) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    ...extra,
  });
  return {
    ok: result.status === 0,
    status: typeof result.status === 'number' ? result.status : -1,
    stdout: typeof result.stdout === 'string' ? result.stdout.trim() : '',
    stderr: typeof result.stderr === 'string' ? result.stderr.trim() : '',
  };
}

function readJson(repoRoot, relPath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), 'utf8'));
}

function parseLines(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function makeProbeResult(repoRoot, mainSha, rootSha) {
  const mergeBase = runGit(repoRoot, ['merge-base', mainSha, rootSha]);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'main-sync-c02-probe-'));
  const worktreeAdd = runGit(repoRoot, ['worktree', 'add', '--detach', tempDir, mainSha]);

  let merge = {
    ok: false,
    status: -1,
    stdout: '',
    stderr: 'WORKTREE_ADD_FAILED',
  };
  let unmergedFiles = [];
  let mergeHeadPresent = false;
  let abortOk = true;
  let removeOk = true;

  try {
    if (worktreeAdd.ok) {
      merge = runGit(tempDir, ['merge', '--no-commit', '--no-ff', rootSha]);
      const unmerged = runGit(tempDir, ['diff', '--name-only', '--diff-filter=U']);
      unmergedFiles = unmerged.ok ? parseLines(unmerged.stdout) : [];
      mergeHeadPresent = runGit(tempDir, ['rev-parse', '--verify', 'MERGE_HEAD']).ok;
      if (mergeHeadPresent) {
        abortOk = runGit(tempDir, ['merge', '--abort']).ok;
      }
    }
  } finally {
    removeOk = runGit(repoRoot, ['worktree', 'remove', '--force', tempDir]).ok;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  let mergeabilityClass = 'BLOCKING_MERGE_ERROR';
  if (merge.ok) {
    mergeabilityClass = 'MERGEABLE_NO_CONFLICT';
  } else if (/refusing to merge unrelated histories/u.test(merge.stderr)) {
    mergeabilityClass = 'BLOCKING_UNRELATED_HISTORIES';
  } else if (unmergedFiles.length > 0) {
    mergeabilityClass = 'BLOCKING_CONFLICT_SET';
  }

  return {
    mergeBaseFound: mergeBase.ok,
    mergeBaseSha: mergeBase.ok ? mergeBase.stdout : '',
    worktreeAddOk: worktreeAdd.ok,
    mergeExitCode: merge.status,
    mergeStdout: merge.stdout,
    mergeStderr: merge.stderr,
    mergeHeadPresent,
    abortOk,
    removeOk,
    cleanupOk: abortOk && removeOk,
    unmergedFiles,
    conflictCount: unmergedFiles.length,
    mergeabilityClass,
  };
}

export function evaluateMainSyncC02MergeabilityState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const rootSha = normalizeString(input.rootSha || DEFAULT_BOUND_ROOT_SHA);
  const mainSha = normalizeString(input.mainSha || DEFAULT_BOUND_MAIN_SHA);
  const rootBranch = normalizeString(input.rootBranch || DEFAULT_ROOT_BRANCH);
  const mainBranch = normalizeString(input.mainBranch || DEFAULT_MAIN_BRANCH);

  const issues = [];

  const rootReadable = runGit(repoRoot, ['cat-file', '-e', `${rootSha}^{commit}`]);
  if (!rootReadable.ok) issues.push({ code: 'ROOT_SHA_UNREADABLE', rootSha });

  const mainReadable = runGit(repoRoot, ['cat-file', '-e', `${mainSha}^{commit}`]);
  if (!mainReadable.ok) issues.push({ code: 'MAIN_SHA_UNREADABLE', mainSha });

  const currentHead = runGit(repoRoot, ['rev-parse', 'HEAD']);
  const originMainHead = runGit(repoRoot, ['rev-parse', `origin/${mainBranch}`]);
  const originRootHead = runGit(repoRoot, ['rev-parse', `origin/${rootBranch}`]);

  const boundRootMatchesOriginRoot = originRootHead.ok && originRootHead.stdout === rootSha;
  const boundMainMatchesOriginMain = originMainHead.ok && originMainHead.stdout === mainSha;
  const currentHeadMatchesBoundRoot = currentHead.ok && currentHead.stdout === rootSha;

  if (!boundRootMatchesOriginRoot) issues.push({ code: 'BOUND_ROOT_DRIFT', expected: rootSha, actual: originRootHead.stdout || '' });
  if (!boundMainMatchesOriginMain) issues.push({ code: 'BOUND_MAIN_DRIFT', expected: mainSha, actual: originMainHead.stdout || '' });
  if (!currentHeadMatchesBoundRoot) issues.push({ code: 'LOCAL_HEAD_NOT_BOUND_ROOT', expected: rootSha, actual: currentHead.stdout || '' });

  const c01Status = readJson(repoRoot, 'docs/OPS/STATUS/MAIN_SYNC_C01_AHEAD_INVENTORY_STATUS_V1.json');
  const c01Summary = readJson(repoRoot, 'docs/OPS/EVIDENCE/MAIN_SYNC_C01/TICKET_01/summary.json');
  const c01Included = readJson(repoRoot, 'docs/OPS/EVIDENCE/MAIN_SYNC_C01/TICKET_01/included-set.json');

  const c01StatusActive = c01Status.token === 'MAIN_SYNC_C01_AHEAD_INVENTORY_OK' && c01Status.status === 'ACTIVE';
  const c01SummaryOk = c01Summary.ok === true;
  const c01RootAncestor = runGit(repoRoot, ['merge-base', '--is-ancestor', C01_BOUND_ROOT_SHA, rootSha]).ok;
  const c01CanonicalCountOk = Array.isArray(c01Included)
    && c01Included[1]
    && c01Included[1].setId === 'CANONICAL_B2C01_B2C12_CHAIN'
    && c01Included[1].count === 13;

  if (!c01StatusActive) issues.push({ code: 'C01_STATUS_NOT_ACTIVE' });
  if (!c01SummaryOk) issues.push({ code: 'C01_SUMMARY_NOT_GREEN' });
  if (!c01RootAncestor) issues.push({ code: 'C01_ROOT_NOT_ANCESTOR_OF_C02_ROOT' });
  if (!c01CanonicalCountOk) issues.push({ code: 'C01_CANONICAL_COUNT_RED' });

  const probe = makeProbeResult(repoRoot, mainSha, rootSha);

  if (!probe.worktreeAddOk) issues.push({ code: 'PROBE_WORKTREE_ADD_RED' });
  if (!probe.cleanupOk) issues.push({ code: 'PROBE_CLEANUP_RED' });
  if (probe.mergeabilityClass !== 'MERGEABLE_NO_CONFLICT') {
    issues.push({ code: probe.mergeabilityClass });
  }

  const ok = issues.length === 0;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignalCode: ok ? '' : FAIL_SIGNAL_CODE,
    failReason: ok ? '' : (issues[0] && issues[0].code) || FAIL_SIGNAL_CODE,
    version: 1,
    status: ok ? 'ACTIVE' : 'FAILED',
    token: TOKEN_NAME,
    scope: 'Bound root-to-main mergeability probe and pre-PR readiness inputs for C03 only',
    stateScript: 'scripts/ops/main-sync-c02-mergeability-state.mjs',
    reportScript: 'scripts/ops/main-sync-c02-mergeability-report.mjs',
    contractTest: 'test/contracts/main-sync-c02-mergeability.contract.test.js',
    boundRefs: {
      mainBranch,
      rootBranch,
      mainSha,
      rootSha,
    },
    checks: {
      rootShaReadable: rootReadable.ok,
      mainShaReadable: mainReadable.ok,
      currentHeadMatchesBoundRoot,
      boundRootMatchesOriginRoot,
      boundMainMatchesOriginMain,
      c01StatusActive,
      c01SummaryOk,
      c01RootAncestor,
      c01CanonicalCountOk,
      probeCleanupOk: probe.cleanupOk,
    },
    c01Rebind: {
      c01BoundRootSha: C01_BOUND_ROOT_SHA,
      currentRootDescendsFromC01Root: c01RootAncestor,
      canonicalSetCount: c01Included[1] ? c01Included[1].count : -1,
    },
    probe,
    issues,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateMainSyncC02MergeabilityState({
    repoRoot: process.cwd(),
    rootSha: args.rootSha,
    mainSha: args.mainSha,
    rootBranch: args.rootBranch,
    mainBranch: args.mainBranch,
  });
  process.stdout.write(`${stableStringify(state)}\n`);
  process.exit(state.ok ? 0 : 1);
}
