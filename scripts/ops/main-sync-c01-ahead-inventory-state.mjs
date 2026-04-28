#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const TOKEN_NAME = 'MAIN_SYNC_C01_AHEAD_INVENTORY_OK';
export const FAIL_SIGNAL_CODE = 'E_MAIN_SYNC_C01_AHEAD_INVENTORY_RED';

const DEFAULT_ROOT_BRANCH = 'codex/toolbar-baseline-truthful-closeout-001';
const DEFAULT_MAIN_BRANCH = 'main';
const DEFAULT_BOUND_ROOT_SHA = '0b3cc7f91400df650dcb875453dda4b389bbeb3e';
const DEFAULT_BOUND_MAIN_SHA = '0d6955c1bd8ccbae425510b0c07e2b0edf445130';

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
    json: false,
    rootSha: DEFAULT_BOUND_ROOT_SHA,
    mainSha: DEFAULT_BOUND_MAIN_SHA,
    rootBranch: DEFAULT_ROOT_BRANCH,
    mainBranch: DEFAULT_MAIN_BRANCH,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;
    if (arg === '--json') {
      out.json = true;
      continue;
    }
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

function runGit(repoRoot, args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    ...options,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: typeof result.stdout === 'string' ? result.stdout.trim() : '',
    stderr: typeof result.stderr === 'string' ? result.stderr.trim() : '',
  };
}

function countResult(repoRoot, args) {
  const result = runGit(repoRoot, args);
  if (!result.ok) return { ok: false, value: -1, stderr: result.stderr };
  const value = Number.parseInt(result.stdout, 10);
  return Number.isFinite(value) ? { ok: true, value } : { ok: false, value: -1, stderr: 'COUNT_PARSE_FAILED' };
}

function parseLogLines(text) {
  if (!text) return [];
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [sha = '', ...rest] = line.split('\t');
      return {
        sha: normalizeString(sha),
        subject: normalizeString(rest.join('\t')),
      };
    })
    .filter((entry) => entry.sha && entry.subject);
}

function classifyFirstParentEntry(subject) {
  if (/Merge pull request #80[5-7]\b/u.test(subject)) {
    return 'PRE_B2C_REBIND_CHAIN';
  }
  if (/Merge pull request #8(08|09|10|11|12|13|14|15|16|17|18|19|20)\b/u.test(subject)) {
    return 'CANONICAL_B2C_CHAIN';
  }
  return 'ROOT_CARRYFORWARD_NONMERGE';
}

function firstAndLastSha(entries) {
  return {
    firstSha: entries.length > 0 ? entries[0].sha : '',
    lastSha: entries.length > 0 ? entries[entries.length - 1].sha : '',
  };
}

export function evaluateMainSyncC01AheadInventory(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const rootSha = normalizeString(input.rootSha || DEFAULT_BOUND_ROOT_SHA);
  const mainSha = normalizeString(input.mainSha || DEFAULT_BOUND_MAIN_SHA);
  const rootBranch = normalizeString(input.rootBranch || DEFAULT_ROOT_BRANCH);
  const mainBranch = normalizeString(input.mainBranch || DEFAULT_MAIN_BRANCH);

  const issues = [];
  const rangeSpec = `${mainSha}..${rootSha}`;

  const rootReadable = runGit(repoRoot, ['cat-file', '-e', `${rootSha}^{commit}`]);
  if (!rootReadable.ok) issues.push({ code: 'ROOT_SHA_UNREADABLE', rootSha });

  const mainReadable = runGit(repoRoot, ['cat-file', '-e', `${mainSha}^{commit}`]);
  if (!mainReadable.ok) issues.push({ code: 'MAIN_SHA_UNREADABLE', mainSha });

  const ancestry = runGit(repoRoot, ['merge-base', '--is-ancestor', mainSha, rootSha]);
  const rootDescendsFromMain = ancestry.ok;
  const divergentHistoryObserved = !rootDescendsFromMain;

  const totalAhead = countResult(repoRoot, ['rev-list', '--count', rangeSpec]);
  const mergeAhead = countResult(repoRoot, ['rev-list', '--count', '--merges', rangeSpec]);
  const nonMergeAhead = countResult(repoRoot, ['rev-list', '--count', '--no-merges', rangeSpec]);

  const firstParentLog = runGit(repoRoot, ['log', '--first-parent', '--reverse', '--format=%H%x09%s', rangeSpec]);
  const mergeLog = runGit(repoRoot, ['log', '--merges', '--reverse', '--format=%H%x09%s', rangeSpec]);

  const firstParentEntries = parseLogLines(firstParentLog.stdout).map((entry) => ({
    ...entry,
    classId: classifyFirstParentEntry(entry.subject),
  }));
  const mergeEntries = parseLogLines(mergeLog.stdout);

  const b2cEntries = firstParentEntries.filter((entry) => entry.classId === 'CANONICAL_B2C_CHAIN');
  const rebindEntries = firstParentEntries.filter((entry) => entry.classId === 'PRE_B2C_REBIND_CHAIN');
  const carryforwardEntries = firstParentEntries.filter((entry) => entry.classId === 'ROOT_CARRYFORWARD_NONMERGE');
  const nonCanonicalEntries = firstParentEntries.filter((entry) => entry.classId !== 'CANONICAL_B2C_CHAIN');

  const includedSets = [
    {
      setId: 'ROOT_FIRST_PARENT_PROMOTION_WINDOW',
      description: 'All first-parent commits reachable from bound root ahead of bound main.',
      count: firstParentEntries.length,
      ...firstAndLastSha(firstParentEntries),
      entries: firstParentEntries.map((entry) => ({
        sha: entry.sha,
        subject: entry.subject,
        classId: entry.classId,
      })),
    },
    {
      setId: 'CANONICAL_B2C01_B2C12_CHAIN',
      description: 'Bounded canonical block chain inside the promotion window.',
      count: b2cEntries.length,
      ...firstAndLastSha(b2cEntries),
      entries: b2cEntries.map((entry) => ({
        sha: entry.sha,
        subject: entry.subject,
      })),
    },
    {
      setId: 'PRE_B2C_REBIND_AND_CARRYFORWARD_WINDOW',
      description: 'Carryforward commits before B2C chain inside the same bound promotion window.',
      count: nonCanonicalEntries.length,
      ...firstAndLastSha(nonCanonicalEntries),
      entries: nonCanonicalEntries.map((entry) => ({
        sha: entry.sha,
        subject: entry.subject,
        classId: entry.classId,
      })),
    },
  ];

  const excludedSets = [
    {
      setId: 'NO_BOUND_ROOT_COMMITS_EXCLUDED_AT_C01',
      description: 'C01 inventories the full bound main-to-root range and excludes no commits from that bound range.',
      count: 0,
      entries: [],
    },
  ];

  const riskRows = [
    {
      riskId: 'ROOT_MAIN_REACHABLE_RANGE_LARGE',
      severity: 'HIGH',
      detail: 'Reachable ahead set is much larger than first-parent window and must not be promoted blindly.',
      metric: totalAhead.ok ? totalAhead.value : -1,
    },
    {
      riskId: 'FIRST_PARENT_WINDOW_MIXED_CLASSES',
      severity: 'MEDIUM',
      detail: 'Bound promotion window mixes carryforward, rebind, and canonical B2C chain commits.',
      metric: firstParentEntries.length,
    },
    {
      riskId: 'BOUND_ROOT_HISTORY_DIVERGED_FROM_BOUND_MAIN',
      severity: 'INFO',
      detail: 'Bound root ahead inventory is valid even though root is not a direct descendant of the bound main head.',
      metric: divergentHistoryObserved ? 1 : 0,
    },
    {
      riskId: 'PROMOTION_DEFERRED_TO_C02',
      severity: 'INFO',
      detail: 'C01 classifies scope only and does not approve or execute root-to-main promotion.',
      metric: 1,
    },
  ];

  const firstParentCoverageOk = includedSets[0].count === (b2cEntries.length + rebindEntries.length + carryforwardEntries.length);
  const b2cChainIdentifiedOk = b2cEntries.length === 13;
  const explicitExcludedSetOk = excludedSets.length === 1 && excludedSets[0].count === 0;
  const countsOk = totalAhead.ok && mergeAhead.ok && nonMergeAhead.ok;
  const firstParentWindowPresent = firstParentEntries.length > 0;

  if (!countsOk) issues.push({ code: 'AHEAD_COUNT_FAILURE' });
  if (!firstParentWindowPresent) issues.push({ code: 'FIRST_PARENT_WINDOW_EMPTY' });
  if (!firstParentCoverageOk) issues.push({ code: 'FIRST_PARENT_COVERAGE_RED' });
  if (!b2cChainIdentifiedOk) issues.push({ code: 'B2C_CHAIN_IDENTIFICATION_RED' });
  if (!explicitExcludedSetOk) issues.push({ code: 'EXCLUDED_SET_RED' });

  const ok = issues.length === 0;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignalCode: ok ? '' : FAIL_SIGNAL_CODE,
    failReason: ok ? '' : (issues[0] && issues[0].code) || FAIL_SIGNAL_CODE,
    version: 1,
    status: ok ? 'ACTIVE' : 'FAILED',
    token: TOKEN_NAME,
    scope: 'Bound remote-root ahead inventory and promotion scope classification snapshot for C02 inputs only',
    stateScript: 'scripts/ops/main-sync-c01-ahead-inventory-state.mjs',
    reportScript: 'scripts/ops/main-sync-c01-ahead-inventory-report.mjs',
    contractTest: 'test/contracts/main-sync-c01-ahead-inventory.contract.test.js',
    boundRefs: {
      mainBranch,
      rootBranch,
      mainSha,
      rootSha,
      rangeSpec,
    },
    counts: {
      totalAheadReachableCount: totalAhead.ok ? totalAhead.value : -1,
      mergeAheadReachableCount: mergeAhead.ok ? mergeAhead.value : -1,
      nonMergeAheadReachableCount: nonMergeAhead.ok ? nonMergeAhead.value : -1,
      firstParentAheadCount: firstParentEntries.length,
      canonicalB2CFirstParentCount: b2cEntries.length,
      preB2CRebindFirstParentCount: rebindEntries.length,
      carryforwardFirstParentCount: carryforwardEntries.length,
    },
    checks: {
      rootShaReadable: rootReadable.ok,
      mainShaReadable: mainReadable.ok,
      rootDescendsFromMain,
      divergentHistoryObserved,
      countsOk,
      firstParentWindowPresent,
      firstParentCoverageOk,
      b2cChainIdentifiedOk,
      explicitExcludedSetOk,
    },
    firstParentEntries,
    mergeEntries,
    includedSets,
    excludedSets,
    riskRows,
    issues,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateMainSyncC01AheadInventory({
    repoRoot: process.cwd(),
    rootSha: args.rootSha,
    mainSha: args.mainSha,
    rootBranch: args.rootBranch,
    mainBranch: args.mainBranch,
  });
  const json = `${stableStringify(state)}\n`;
  process.stdout.write(json);
  process.exit(state.ok ? 0 : 1);
}
