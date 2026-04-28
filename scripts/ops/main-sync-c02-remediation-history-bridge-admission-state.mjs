#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const TOKEN_NAME = 'MAIN_SYNC_C02_HISTORY_BRIDGE_ADMISSION_COMPLETE_OK';

const DEFAULT_ROOT_BRANCH = 'codex/toolbar-baseline-truthful-closeout-001';
const DEFAULT_MAIN_BRANCH = 'main';
const DEFAULT_ROOT_SHA = '15611164c07d6b6a98e7d2c0617e9e8fa99ac887';
const DEFAULT_MAIN_SHA = '0d6955c1bd8ccbae425510b0c07e2b0edf445130';

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

function runGit(repoRoot, args) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
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

function firstLine(text) {
  return normalizeString(String(text).split('\n')[0] || '');
}

export function evaluateMainSyncC02RemediationHistoryBridgeAdmission(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const rootSha = normalizeString(input.rootSha || DEFAULT_ROOT_SHA);
  const mainSha = normalizeString(input.mainSha || DEFAULT_MAIN_SHA);
  const rootBranch = normalizeString(input.rootBranch || DEFAULT_ROOT_BRANCH);
  const mainBranch = normalizeString(input.mainBranch || DEFAULT_MAIN_BRANCH);

  const issues = [];
  const originRoot = runGit(repoRoot, ['rev-parse', `origin/${rootBranch}`]);
  const originMain = runGit(repoRoot, ['rev-parse', `origin/${mainBranch}`]);
  const head = runGit(repoRoot, ['rev-parse', 'HEAD']);
  const mergeBase = runGit(repoRoot, ['merge-base', mainSha, rootSha]);
  const rootRoot = runGit(repoRoot, ['rev-list', '--max-parents=0', rootSha]);
  const mainRoot = runGit(repoRoot, ['rev-list', '--max-parents=0', mainSha]);

  const c02Status = readJson(repoRoot, 'docs/OPS/STATUS/MAIN_SYNC_C02_MERGEABILITY_STATUS_V1.json');
  const c02Summary = readJson(repoRoot, 'docs/OPS/EVIDENCE/MAIN_SYNC_C02/TICKET_01/mergeability-summary.json');
  const c02Conflict = readJson(repoRoot, 'docs/OPS/EVIDENCE/MAIN_SYNC_C02/TICKET_01/conflict-set.json');
  const c02PrePr = readJson(repoRoot, 'docs/OPS/EVIDENCE/MAIN_SYNC_C02/TICKET_01/pre-pr-verification.json');

  const boundRootMatchesOrigin = originRoot.ok && originRoot.stdout === rootSha;
  const boundMainMatchesOrigin = originMain.ok && originMain.stdout === mainSha;
  const localHeadMatchesRoot = head.ok && head.stdout === rootSha;
  const localHeadDescendsFromRoot = runGit(repoRoot, ['merge-base', '--is-ancestor', rootSha, head.stdout || '']).ok;
  const noMergeBase = !mergeBase.ok;
  const blockerMatchesArtifacts = c02Status.status === 'FAILED'
    && c02Summary.failReason === 'BLOCKING_UNRELATED_HISTORIES'
    && c02Summary.probe.mergeabilityClass === 'BLOCKING_UNRELATED_HISTORIES'
    && c02Summary.probe.mergeExitCode === 128
    && c02Conflict.conflictCount === 0
    && c02PrePr.ok === true;

  if (!boundRootMatchesOrigin) issues.push({ code: 'BOUND_ROOT_DRIFT', expected: rootSha, actual: originRoot.stdout || '' });
  if (!boundMainMatchesOrigin) issues.push({ code: 'BOUND_MAIN_DRIFT', expected: mainSha, actual: originMain.stdout || '' });
  if (!localHeadDescendsFromRoot) issues.push({ code: 'LOCAL_HEAD_DRIFT', expected: rootSha, actual: head.stdout || '' });
  if (!noMergeBase) issues.push({ code: 'MERGE_BASE_EXISTS' });
  if (!blockerMatchesArtifacts) issues.push({ code: 'C02_BLOCKER_ARTIFACT_MISMATCH' });

  const allowedMethodMatrix = [
    {
      methodId: 'EXPLICIT_ALLOW_UNRELATED_HISTORIES_MERGE',
      classification: 'FORBIDDEN',
      reason: 'No canon allowance exists and the recorded blocker packet rejects the path before any PR promotion.',
    },
    {
      methodId: 'CHERRY_PICK_REPLAY',
      classification: 'ESCALATION_ONLY',
      reason: 'Could preserve PR-only delivery shape but requires owner-level governance decision and explicit scope/rollback definition.',
    },
    {
      methodId: 'DEFAULT_BRANCH_SWITCH',
      classification: 'ESCALATION_ONLY',
      reason: 'Would require canon-level truth-surface cutover rather than local remediation.',
    },
  ];

  const forbiddenMethodMatrix = [
    {
      methodId: 'REBASE_REWRITE',
      classification: 'FORBIDDEN',
      reason: 'Silent rebase and history rewrite are forbidden by active canon and delivery rules.',
    },
    {
      methodId: 'SILENT_HISTORY_REINTERPRETATION',
      classification: 'FORBIDDEN',
      reason: 'Cannot reinterpret unrelated histories as mergeable without a new owner-approved method decision.',
    },
  ];

  const rankedMethodMatrix = [
    {
      rank: 1,
      methodId: 'STOP',
      classification: 'RECOMMENDED',
      reason: 'Current canon allows no automatic bridge method from the recorded blocker packet.',
    },
    {
      rank: 2,
      methodId: 'CHERRY_PICK_REPLAY',
      classification: 'ESCALATION_ONLY',
      reason: 'Only candidate that avoids rewrite, but still needs explicit owner approval and a new write contour.',
    },
    {
      rank: 3,
      methodId: 'DEFAULT_BRANCH_SWITCH',
      classification: 'ESCALATION_ONLY',
      reason: 'Governance-scale move, not a local remediation shortcut.',
    },
  ];

  const riskRows = [
    {
      riskId: 'NO_MERGE_BASE_PERSISTS',
      severity: 'HIGH',
      detail: 'Current root and main still have unrelated histories, so C03 remains blocked.',
    },
    {
      riskId: 'CHERRY_PICK_SCOPE_WIDENING',
      severity: 'HIGH',
      detail: 'Any replay path could widen scope unless the exact commit allowlist and rollback are declared first.',
    },
    {
      riskId: 'DEFAULT_BRANCH_TRUTH_BREAK',
      severity: 'HIGH',
      detail: 'Default branch truth cannot be switched locally without canon-level cutover.',
    },
  ];

  const rollbackRows = [
    {
      rollbackId: 'KEEP_C03_BLOCKED',
      trigger: 'No owner-approved history bridge method exists.',
      action: 'Maintain STOP state and do not open any root-to-main PR contour.',
    },
    {
      rollbackId: 'REJECT_REWRITE_METHODS',
      trigger: 'Any proposed fix implies rebase or hidden history rewrite.',
      action: 'Reject method and return to exact STOP with unchanged blocker packet.',
    },
  ];

  const recommendation = {
    methodId: 'STOP',
    classification: 'RECOMMENDED',
    exactNextWriteContour: 'NONE_OWNER_DECISION_REQUIRED',
    reason: 'Current canon and recorded blocker packet do not admit any automatic history-bridge write method.',
  };

  return {
    ok: issues.length === 0,
    [TOKEN_NAME]: issues.length === 0 ? 1 : 0,
    version: 1,
    status: issues.length === 0 ? 'ADMISSION_COMPLETE_STOP_REMAINS' : 'ADMISSION_FACT_DRIFT',
    token: TOKEN_NAME,
    taskBasename: 'MAIN_SYNC_C02_REMEDIATION_HISTORY_BRIDGE_ADMISSION',
    scope: 'REPORT_ONLY_ADMISSION_AFTER_C02_STOP',
    contourId: 'MAIN_SYNC_C02_REMEDIATION_HISTORY_BRIDGE_ADMISSION',
    stateScript: 'main-sync-c02-remediation-history-bridge-admission-state.mjs',
    reportScript: 'main-sync-c02-remediation-history-bridge-admission-report.mjs',
    contractTest: 'main-sync-c02-remediation-history-bridge-admission.contract.test.js',
    boundRefs: {
      mainBranch,
      mainSha,
      rootBranch,
      rootSha,
    },
    checks: {
      boundRootMatchesOrigin,
      boundMainMatchesOrigin,
      localHeadMatchesRoot,
      localHeadDescendsFromRoot,
      noMergeBase,
      blockerMatchesArtifacts,
    },
    localGitFacts: {
      rootRootSha: firstLine(rootRoot.stdout),
      mainRootSha: firstLine(mainRoot.stdout),
      mergeBaseExists: mergeBase.ok,
      mergeBaseSha: mergeBase.ok ? mergeBase.stdout : '',
    },
    c02BlockerFacts: {
      c02Status: c02Status.status,
      c02FailReason: c02Summary.failReason,
      c02MergeabilityClass: c02Summary.probe.mergeabilityClass,
      c02MergeExitCode: c02Summary.probe.mergeExitCode,
      c02ConflictCount: c02Conflict.conflictCount,
      c02PrePrGreen: c02PrePr.ok,
    },
    allowedMethodMatrix,
    forbiddenMethodMatrix,
    rankedMethodMatrix,
    recommendation,
    riskRows,
    rollbackRows,
    issues,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateMainSyncC02RemediationHistoryBridgeAdmission({
    repoRoot: process.cwd(),
    rootSha: args.rootSha,
    mainSha: args.mainSha,
    rootBranch: args.rootBranch,
    mainBranch: args.mainBranch,
  });
  process.stdout.write(`${stableStringify(state)}\n`);
  process.exit(state.ok ? 0 : 1);
}
