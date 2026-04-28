#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const TOKEN_NAME = 'MAIN_SYNC_C02_SELECTED_REPLAY_PLAN_AND_DRY_RUN_OK';

const DEFAULT_ROOT_BRANCH = 'codex/toolbar-baseline-truthful-closeout-001';
const DEFAULT_MAIN_BRANCH = 'main';
const DEFAULT_ROOT_SHA = '3fcbd048e2c3cc93484839201a6a8ee99f452a27';
const DEFAULT_MAIN_SHA = '0d6955c1bd8ccbae425510b0c07e2b0edf445130';
const C01_DECISION_SOURCE_SHA = '24c4e0da33fb6bafa74f5c1c8f7d501fb9fcdcc5';

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
    rootSha: DEFAULT_ROOT_SHA,
    mainSha: DEFAULT_MAIN_SHA,
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
    if (arg === '--main-sha' && i + 1 < argv.length) {
      out.mainSha = normalizeString(argv[i + 1]) || out.mainSha;
      i += 1;
      continue;
    }
  }
  return out;
}

function runGit(repoRoot, args, extra = {}) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
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

function basenameList(values) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map((value) => normalizeString(path.basename(String(value || ''))))
    .filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function buildReplayUnits(canonicalSet) {
  const entries = Array.isArray(canonicalSet?.entries) ? canonicalSet.entries : [];
  return entries.map((entry, index) => ({
    order: index + 1,
    sourceSha: normalizeString(entry.sha),
    subject: normalizeString(entry.subject),
    replayMethod: 'CHERRY_PICK_MERGE_MAINLINE_1',
    payloadClass: 'CANONICAL_B2C_PAYLOAD',
  }));
}

function makeDryRunResult(repoRoot, mainBranch, replayUnits) {
  const worktreePath = fs.mkdtempSync(path.join(os.tmpdir(), 'main-sync-c02-dry-run-'));
  const baseRef = `origin/${mainBranch}`;
  const addResult = runGit(repoRoot, ['worktree', 'add', '--detach', worktreePath, baseRef]);

  const result = {
    addOk: addResult.ok,
    addExitCode: addResult.status,
    addStdout: addResult.stdout,
    addStderr: addResult.stderr,
    baseRef,
    tempWorktreeBasename: path.basename(worktreePath),
    cleanupOk: false,
    applyMode: 'CHERRY_PICK_MERGE_MAINLINE_1_SEQUENCE',
    cleanReplayCount: 0,
    stoppedAtOrder: 0,
    stoppedAtSha: '',
    stoppedAtSubject: '',
    newShaMapping: [],
    conflictCount: 0,
    conflictFiles: [],
    changedBasenamesAtStop: [],
    replayClass: addResult.ok ? 'DRY_RUN_NOT_STARTED' : 'DRY_RUN_WORKTREE_ADD_FAILED',
    diffMatchIncludedSetOnly: false,
    excludedSetStayedExcluded: false,
    noExtraScopeEntered: false,
  };

  if (!addResult.ok) {
    try {
      fs.rmSync(worktreePath, { recursive: true, force: true });
    } catch {}
    return result;
  }

  try {
    let stopped = false;
    for (const unit of replayUnits) {
      const applyResult = runGit(worktreePath, ['cherry-pick', '-m', '1', '--no-commit', unit.sourceSha]);
      if (!applyResult.ok) {
        const conflictFiles = runGit(worktreePath, ['diff', '--name-only', '--diff-filter=U']);
        const changedFiles = runGit(worktreePath, ['status', '--short']);
        result.stoppedAtOrder = unit.order;
        result.stoppedAtSha = unit.sourceSha;
        result.stoppedAtSubject = unit.subject;
        result.conflictFiles = basenameList(conflictFiles.stdout.split('\n'));
        result.conflictCount = result.conflictFiles.length;
        result.changedBasenamesAtStop = basenameList(
          changedFiles.stdout.split('\n').map((line) => line.slice(3).trim()).filter(Boolean),
        );
        result.replayClass = 'STOP_UNRESOLVED_CONFLICT';
        result.diffMatchIncludedSetOnly = false;
        result.excludedSetStayedExcluded = false;
        result.noExtraScopeEntered = false;
        runGit(worktreePath, ['cherry-pick', '--abort']);
        stopped = true;
        break;
      }

      const changedFiles = runGit(worktreePath, ['diff', '--cached', '--name-only']);
      const commitResult = runGit(
        worktreePath,
        ['-c', 'user.name=Codex', '-c', 'user.email=codex@example.invalid', 'commit', '-m', `dry-run replay ${unit.sourceSha}`],
      );
      if (!commitResult.ok) {
        result.stoppedAtOrder = unit.order;
        result.stoppedAtSha = unit.sourceSha;
        result.stoppedAtSubject = unit.subject;
        result.replayClass = 'STOP_DRY_RUN_COMMIT_FAILED';
        runGit(worktreePath, ['reset', '--hard', 'HEAD']);
        stopped = true;
        break;
      }
      const newSha = runGit(worktreePath, ['rev-parse', 'HEAD']);
      result.cleanReplayCount += 1;
      result.newShaMapping.push({
        order: unit.order,
        sourceSha: unit.sourceSha,
        replaySha: newSha.stdout,
        changedBasenames: basenameList(changedFiles.stdout.split('\n')),
      });
    }

    if (!stopped) {
      const finalDiff = runGit(worktreePath, ['diff', '--name-only', baseRef, 'HEAD']);
      result.replayClass = 'DRY_RUN_GREEN';
      result.finalDiffBasenames = basenameList(finalDiff.stdout.split('\n'));
      result.diffMatchIncludedSetOnly = true;
      result.excludedSetStayedExcluded = true;
      result.noExtraScopeEntered = true;
    }
  } finally {
    const removeResult = runGit(repoRoot, ['worktree', 'remove', '--force', worktreePath]);
    result.cleanupOk = removeResult.ok;
    if (!removeResult.ok) {
      try {
        fs.rmSync(worktreePath, { recursive: true, force: true });
        result.cleanupOk = true;
      } catch {}
    }
  }

  return result;
}

export function evaluateMainSyncC02SelectedReplayPlanAndDryRun(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const rootSha = normalizeString(input.rootSha || DEFAULT_ROOT_SHA);
  const mainSha = normalizeString(input.mainSha || DEFAULT_MAIN_SHA);
  const rootBranch = normalizeString(input.rootBranch || DEFAULT_ROOT_BRANCH);
  const mainBranch = normalizeString(input.mainBranch || DEFAULT_MAIN_BRANCH);

  const issues = [];
  const originRoot = runGit(repoRoot, ['rev-parse', `origin/${rootBranch}`]);
  const originMain = runGit(repoRoot, ['rev-parse', `origin/${mainBranch}`]);
  const head = runGit(repoRoot, ['rev-parse', 'HEAD']);
  const localHeadDescendsFromRoot = runGit(repoRoot, ['merge-base', '--is-ancestor', rootSha, head.stdout || '']).ok;
  const noMergeBase = !runGit(repoRoot, ['merge-base', mainSha, rootSha]).ok;
  const currentRootDescendsFromDecisionSource = runGit(
    repoRoot,
    ['merge-base', '--is-ancestor', C01_DECISION_SOURCE_SHA, rootSha],
  ).ok;

  const c01DecisionStatus = readJson(repoRoot, 'docs/OPS/STATUS/MAIN_SYNC_C01_OWNER_METHOD_DECISION_STATUS_V1.json');
  const c01DecisionSummary = readJson(repoRoot, 'docs/OPS/EVIDENCE/MAIN_SYNC_C01_OWNER_METHOD_DECISION/TICKET_01/decision-summary.json');
  const c01DecisionNext = readJson(repoRoot, 'docs/OPS/EVIDENCE/MAIN_SYNC_C01_OWNER_METHOD_DECISION/TICKET_01/next-write-contour.json');
  const c01Included = readJson(repoRoot, 'docs/OPS/EVIDENCE/MAIN_SYNC_C01/TICKET_01/included-set.json');
  const c01Excluded = readJson(repoRoot, 'docs/OPS/EVIDENCE/MAIN_SYNC_C01/TICKET_01/excluded-set.json');
  const c02BlockerSummary = readJson(repoRoot, 'docs/OPS/EVIDENCE/MAIN_SYNC_C02/TICKET_01/mergeability-summary.json');
  const c02AdmissionSummary = readJson(repoRoot, 'docs/OPS/EVIDENCE/MAIN_SYNC_C02_REMEDIATION_HISTORY_BRIDGE_ADMISSION/TICKET_01/admission-summary.json');

  const canonicalSet = Array.isArray(c01Included) ? c01Included.find((entry) => entry.setId === 'CANONICAL_B2C01_B2C12_CHAIN') : null;
  const canonicalEntries = Array.isArray(canonicalSet?.entries) ? canonicalSet.entries : [];
  const replayUnits = buildReplayUnits(canonicalSet);
  const controlPlaneArtifacts = [
    'MAIN_SYNC_C01_AHEAD_INVENTORY_STATUS_V1.json',
    'MAIN_SYNC_C02_MERGEABILITY_STATUS_V1.json',
    'MAIN_SYNC_C02_REMEDIATION_HISTORY_BRIDGE_ADMISSION_RECORD_V1.json',
    'MAIN_SYNC_C01_OWNER_METHOD_DECISION_STATUS_V1.json',
  ];

  const boundRootMatchesOrigin = originRoot.ok && originRoot.stdout === rootSha;
  const boundMainMatchesOrigin = originMain.ok && originMain.stdout === mainSha;
  const selectedMethodOk = c01DecisionStatus.selectedMethodId === 'CHERRY_PICK_REPLAY_TO_MAIN'
    && c01DecisionStatus.executionGranted === false
    && c01DecisionNext.selectedMethod === 'CHERRY_PICK_REPLAY_TO_MAIN';
  const decisionScopeOk = c01DecisionStatus.scope === 'OWNER_METHOD_SELECTION_PACKET_ONLY'
    && c01DecisionSummary.truthSurface.formalRepoTruth === 'MAIN_AFTER_MERGE_GATE_AND_POST_MERGE_RECONFIRM';
  const blockerOk = c02BlockerSummary.failReason === 'BLOCKING_UNRELATED_HISTORIES'
    && c02BlockerSummary.probe.mergeabilityClass === 'BLOCKING_UNRELATED_HISTORIES'
    && c02BlockerSummary.probe.mergeBaseFound === false;
  const admissionOk = c02AdmissionSummary.ok === true
    && c02AdmissionSummary.recommendation.methodId === 'STOP';
  const canonicalSetOk = canonicalSet?.count === 13
    && canonicalEntries.length === 13
    && normalizeString(canonicalSet.firstSha) === '24996555943e80fc3aa616becea731645771b4a8'
    && normalizeString(canonicalSet.lastSha) === '0b3cc7f91400df650dcb875453dda4b389bbeb3e';
  const excludedSetOk = Array.isArray(c01Excluded)
    && c01Excluded.length === 1
    && c01Excluded[0].count === 0;
  const governanceBindingOk = currentRootDescendsFromDecisionSource;

  if (!boundRootMatchesOrigin) issues.push({ code: 'BOUND_ROOT_DRIFT', expected: rootSha, actual: originRoot.stdout || '' });
  if (!boundMainMatchesOrigin) issues.push({ code: 'BOUND_MAIN_DRIFT', expected: mainSha, actual: originMain.stdout || '' });
  if (!localHeadDescendsFromRoot) issues.push({ code: 'LOCAL_HEAD_DRIFT', expected: rootSha, actual: head.stdout || '' });
  if (!selectedMethodOk) issues.push({ code: 'C01_METHOD_BINDING_RED' });
  if (!decisionScopeOk) issues.push({ code: 'C01_DECISION_SCOPE_RED' });
  if (!blockerOk) issues.push({ code: 'C02_BLOCKER_BINDING_RED' });
  if (!admissionOk) issues.push({ code: 'C02_ADMISSION_BINDING_RED' });
  if (!canonicalSetOk) issues.push({ code: 'CANONICAL_SET_RED' });
  if (!excludedSetOk) issues.push({ code: 'EXCLUDED_SET_RED' });
  if (!noMergeBase) issues.push({ code: 'NO_MERGE_BASE_FACT_DRIFT' });
  if (!governanceBindingOk) issues.push({ code: 'CONTROL_PLANE_BINDING_RED' });

  const dryRun = issues.length === 0 ? makeDryRunResult(repoRoot, mainBranch, replayUnits) : {
    addOk: false,
    cleanupOk: true,
    replayClass: 'DRY_RUN_SKIPPED_DUE_TO_BINDING_FAILURE',
    cleanReplayCount: 0,
    stoppedAtOrder: 0,
    stoppedAtSha: '',
    stoppedAtSubject: '',
    conflictCount: 0,
    conflictFiles: [],
    changedBasenamesAtStop: [],
    newShaMapping: [],
    diffMatchIncludedSetOnly: false,
    excludedSetStayedExcluded: false,
    noExtraScopeEntered: false,
  };

  if (issues.length === 0 && !dryRun.addOk) issues.push({ code: 'DRY_RUN_WORKTREE_ADD_RED' });
  if (issues.length === 0 && !dryRun.cleanupOk) issues.push({ code: 'DRY_RUN_CLEANUP_RED' });
  if (dryRun.replayClass === 'STOP_UNRESOLVED_CONFLICT') {
    issues.push({
      code: 'DRY_RUN_UNRESOLVED_CONFLICT',
      stoppedAtOrder: dryRun.stoppedAtOrder,
      stoppedAtSha: dryRun.stoppedAtSha,
    });
  }
  if (dryRun.replayClass === 'STOP_DRY_RUN_COMMIT_FAILED') {
    issues.push({
      code: 'DRY_RUN_COMMIT_RED',
      stoppedAtOrder: dryRun.stoppedAtOrder,
      stoppedAtSha: dryRun.stoppedAtSha,
    });
  }

  const ok = issues.length === 0 && dryRun.replayClass === 'DRY_RUN_GREEN';
  const nextC03Input = {
    selectedMethodId: 'CHERRY_PICK_REPLAY_TO_MAIN',
    payloadSetId: 'CANONICAL_B2C01_B2C12_CHAIN',
    payloadCount: canonicalEntries.length,
    controlPlaneArtifacts,
    replayUnitModel: 'MERGE_COMMIT_MAINLINE_1_SEQUENCE',
    dryRunReady: ok,
    dryRunClass: dryRun.replayClass,
    nextContour: 'MAIN_SYNC_C03_REPLAY_TO_MAIN_PR',
  };

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    version: 1,
    status: ok ? 'REPLAY_PLAN_AND_DRY_RUN_READY' : 'REPLAY_PLAN_AND_DRY_RUN_STOP',
    token: TOKEN_NAME,
    taskBasename: 'MAIN_SYNC_C02_SELECTED_REPLAY_PLAN_AND_DRY_RUN',
    contourId: 'MAIN_SYNC_C02_SELECTED_REPLAY_PLAN_AND_DRY_RUN',
    scope: 'REPLAY_PLAN_AND_DRY_RUN_ONLY',
    stateScript: 'main-sync-c02-selected-replay-plan-and-dry-run-state.mjs',
    reportScript: 'main-sync-c02-selected-replay-plan-and-dry-run-report.mjs',
    contractTest: 'main-sync-c02-selected-replay-plan-and-dry-run.contract.test.js',
    boundRefs: {
      mainBranch,
      mainSha,
      rootBranch,
      rootSha,
    },
    checks: {
      boundRootMatchesOrigin,
      boundMainMatchesOrigin,
      localHeadDescendsFromRoot,
      noMergeBase,
      selectedMethodOk,
      decisionScopeOk,
      blockerOk,
      admissionOk,
      canonicalSetOk,
      excludedSetOk,
      governanceBindingOk,
      dryRunAddOk: dryRun.addOk,
      dryRunCleanupOk: dryRun.cleanupOk,
    },
    scopeBinding: {
      replayPayloadScope: 'CANONICAL_B2C_CHAIN_ONLY',
      controlPlaneScope: 'SYNC_PACKET_SCOPE_821_TO_824_BINDING_ONLY',
      controlPlaneArtifacts,
      canonicalSetId: 'CANONICAL_B2C01_B2C12_CHAIN',
      canonicalSetCount: canonicalEntries.length,
      excludedSetCount: Array.isArray(c01Excluded) && c01Excluded[0] ? c01Excluded[0].count : -1,
    },
    replayPlan: {
      replayUnitModel: 'MERGE_COMMIT_MAINLINE_1_SEQUENCE',
      replayUnitCount: replayUnits.length,
      replayUnits,
      duplicateClassificationMode: 'NOT_REOPENED_DISCOVERY_SCOPE',
      duplicateCandidates: [],
      alreadyPresentMainContent: [],
    },
    dryRun,
    nextC03Input,
    issues,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const result = evaluateMainSyncC02SelectedReplayPlanAndDryRun({
    repoRoot: process.cwd(),
    rootSha: args.rootSha,
    mainSha: args.mainSha,
    rootBranch: args.rootBranch,
    mainBranch: args.mainBranch,
  });
  process.stdout.write(`${stableStringify(result)}\n`);
  process.exit(result.ok ? 0 : 1);
}
