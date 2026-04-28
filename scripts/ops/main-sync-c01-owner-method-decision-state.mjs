#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const TOKEN_NAME = 'MAIN_SYNC_C01_OWNER_METHOD_DECISION_OK';

const DEFAULT_ROOT_BRANCH = 'codex/toolbar-baseline-truthful-closeout-001';
const DEFAULT_MAIN_BRANCH = 'main';
const DEFAULT_ROOT_SHA = '24c4e0da33fb6bafa74f5c1c8f7d501fb9fcdcc5';
const DEFAULT_MAIN_SHA = '0d6955c1bd8ccbae425510b0c07e2b0edf445130';
const SELECTED_METHOD_ID = 'CHERRY_PICK_REPLAY_TO_MAIN';

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

export function evaluateMainSyncC01OwnerMethodDecision(input = {}) {
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

  const c01Status = readJson(repoRoot, 'docs/OPS/STATUS/MAIN_SYNC_C01_AHEAD_INVENTORY_STATUS_V1.json');
  const c01Summary = readJson(repoRoot, 'docs/OPS/EVIDENCE/MAIN_SYNC_C01/TICKET_01/summary.json');
  const c01Included = readJson(repoRoot, 'docs/OPS/EVIDENCE/MAIN_SYNC_C01/TICKET_01/included-set.json');
  const c01Excluded = readJson(repoRoot, 'docs/OPS/EVIDENCE/MAIN_SYNC_C01/TICKET_01/excluded-set.json');

  const c02Status = readJson(repoRoot, 'docs/OPS/STATUS/MAIN_SYNC_C02_MERGEABILITY_STATUS_V1.json');
  const c02Summary = readJson(repoRoot, 'docs/OPS/EVIDENCE/MAIN_SYNC_C02/TICKET_01/mergeability-summary.json');

  const admissionRecord = readJson(repoRoot, 'docs/OPS/STATUS/MAIN_SYNC_C02_REMEDIATION_HISTORY_BRIDGE_ADMISSION_RECORD_V1.json');
  const admissionSummary = readJson(repoRoot, 'docs/OPS/EVIDENCE/MAIN_SYNC_C02_REMEDIATION_HISTORY_BRIDGE_ADMISSION/TICKET_01/admission-summary.json');
  const admissionNext = readJson(repoRoot, 'docs/OPS/EVIDENCE/MAIN_SYNC_C02_REMEDIATION_HISTORY_BRIDGE_ADMISSION/TICKET_01/next-write-contour.json');

  const currentRootDescendsFromC01BoundRoot = runGit(
    repoRoot,
    ['merge-base', '--is-ancestor', c01Summary.boundRefs.rootSha, rootSha],
  ).ok;
  const currentRootDescendsFromAdmissionSource = runGit(
    repoRoot,
    ['merge-base', '--is-ancestor', admissionRecord.sourceHeadCommitSha, rootSha],
  ).ok;

  const boundRootMatchesOrigin = originRoot.ok && originRoot.stdout === rootSha;
  const boundMainMatchesOrigin = originMain.ok && originMain.stdout === mainSha;
  const c01FactsOk = c01Status.status === 'ACTIVE'
    && c01Summary.ok === true
    && c01Summary.checks.explicitExcludedSetOk === true
    && Array.isArray(c01Included)
    && Array.isArray(c01Excluded)
    && c01Excluded.length === 1
    && c01Excluded[0].count === 0
    && currentRootDescendsFromC01BoundRoot;
  const c02FactsOk = c02Status.status === 'FAILED'
    && c02Summary.failReason === 'BLOCKING_UNRELATED_HISTORIES'
    && c02Summary.probe.mergeabilityClass === 'BLOCKING_UNRELATED_HISTORIES'
    && c02Summary.probe.mergeBaseFound === false;
  const admissionFactsOk = admissionRecord.status === 'MAIN_SYNC_C02_REMEDIATION_HISTORY_BRIDGE_RUNTIME_WRITES_NOT_ADMITTED'
    && admissionRecord.promotionDecision === 'STOP'
    && admissionRecord.runtimeWritesAdmitted === false
    && admissionSummary.ok === true
    && admissionSummary.recommendation.methodId === 'STOP'
    && admissionNext.c03Blocked === true
    && admissionNext.ownerAcceptanceRequired === true
    && currentRootDescendsFromAdmissionSource;

  if (!boundRootMatchesOrigin) issues.push({ code: 'BOUND_ROOT_DRIFT', expected: rootSha, actual: originRoot.stdout || '' });
  if (!boundMainMatchesOrigin) issues.push({ code: 'BOUND_MAIN_DRIFT', expected: mainSha, actual: originMain.stdout || '' });
  if (!localHeadDescendsFromRoot) issues.push({ code: 'LOCAL_HEAD_DRIFT', expected: rootSha, actual: head.stdout || '' });
  if (!c01FactsOk) issues.push({ code: 'C01_INPUT_BINDING_MISMATCH' });
  if (!c02FactsOk) issues.push({ code: 'C02_BLOCKER_BINDING_MISMATCH' });
  if (!admissionFactsOk) issues.push({ code: 'ADMISSION_BINDING_MISMATCH' });

  const selectedMethod = {
    methodId: SELECTED_METHOD_ID,
    classification: 'OWNER_APPROVED_METHOD_SELECTION_ONLY',
    executionGranted: false,
    rationale: 'Main remains the formal repo truth surface while required root content is replayed into main through an approved PR path.',
    acceptedCost: 'NEW_SHA_VALUES_ALLOWED',
    nextContour: 'MAIN_SYNC_C02_SELECTED_REPLAY_PLAN_AND_DRY_RUN',
  };

  const rejectedMethods = [
    {
      methodId: 'REBASE_REWRITE',
      classification: 'FORBIDDEN',
      reason: 'Silent rebase and history rewrite remain forbidden by canon and delivery policy.',
    },
    {
      methodId: 'ALLOW_UNRELATED_HISTORIES_MERGE',
      classification: 'NOT_SELECTED',
      reason: 'The selected path preserves main as formal truth without introducing a merge exception.',
    },
    {
      methodId: 'DEFAULT_BRANCH_SWITCH',
      classification: 'NOT_SELECTED',
      reason: 'The selected path does not change the active truth surface away from main.',
    },
  ];

  const riskRows = [
    {
      riskId: 'REPLAY_CREATES_NEW_SHA_VALUES',
      severity: 'MEDIUM',
      detail: 'Replay into main will produce new commit SHAs and must carry explicit mapping and audit in later contours.',
    },
    {
      riskId: 'SCOPE_EXPANSION_VIA_REPLAY',
      severity: 'HIGH',
      detail: 'C02 must keep replay scope bound to the included set only and must not widen to carryforward history by default.',
    },
    {
      riskId: 'FORMAL_TRUTH_DRIFT',
      severity: 'HIGH',
      detail: 'Any attempt to treat root as formal truth before main promotion would recreate split-brain.',
    },
  ];

  const rollbackRows = [
    {
      rollbackId: 'KEEP_METHOD_SELECTION_ONLY',
      trigger: 'Any later contour attempts replay execution without the approved C02 replay plan packet.',
      action: 'Stop and preserve this contour as selection-only with no new execution authority.',
    },
    {
      rollbackId: 'REJECT_TRUTH_SURFACE_CHANGE',
      trigger: 'Any later contour implies default branch switch or root truth promotion.',
      action: 'Reject the contour and keep main as the sole formal truth surface.',
    },
  ];

  const exactC02Inputs = {
    includedSetRef: 'included-set.json',
    excludedSetRef: 'excluded-set.json',
    blockerRef: 'mergeability-summary.json',
    admissionRef: 'admission-summary.json',
    selectedMethodId: SELECTED_METHOD_ID,
    executionGranted: false,
    nextContour: 'MAIN_SYNC_C02_SELECTED_REPLAY_PLAN_AND_DRY_RUN',
  };

  return {
    ok: issues.length === 0,
    [TOKEN_NAME]: issues.length === 0 ? 1 : 0,
    version: 1,
    status: issues.length === 0 ? 'OWNER_METHOD_DECISION_PACKET_READY' : 'OWNER_METHOD_DECISION_FACT_DRIFT',
    token: TOKEN_NAME,
    taskBasename: 'MAIN_SYNC_C01_OWNER_METHOD_DECISION_PACKET',
    contourId: 'MAIN_SYNC_C01_OWNER_METHOD_DECISION_PACKET',
    scope: 'OWNER_METHOD_SELECTION_PACKET_ONLY',
    stateScript: 'main-sync-c01-owner-method-decision-state.mjs',
    reportScript: 'main-sync-c01-owner-method-decision-report.mjs',
    contractTest: 'main-sync-c01-owner-method-decision.contract.test.js',
    boundRefs: {
      mainBranch,
      mainSha,
      rootBranch,
      rootSha,
    },
    truthSurface: {
      formalRepoTruth: 'MAIN_AFTER_MERGE_GATE_AND_POST_MERGE_RECONFIRM',
      rootRole: 'SOURCE_OF_REQUIRED_CONTENT_ONLY',
    },
    checks: {
      boundRootMatchesOrigin,
      boundMainMatchesOrigin,
      localHeadDescendsFromRoot,
      c01FactsOk,
      c02FactsOk,
      admissionFactsOk,
      currentRootDescendsFromC01BoundRoot,
      currentRootDescendsFromAdmissionSource,
    },
    localGitFacts: {
      headSha: head.stdout,
      originMainSha: originMain.stdout,
      originRootSha: originRoot.stdout,
    },
    sourceFacts: {
      c01BoundRootSha: c01Summary.boundRefs.rootSha,
      c01IncludedWindowCount: Array.isArray(c01Included) && c01Included[0] ? c01Included[0].count : 0,
      c01ExcludedWindowCount: Array.isArray(c01Excluded) && c01Excluded[0] ? c01Excluded[0].count : 0,
      c02FailReason: c02Summary.failReason,
      c02MergeabilityClass: c02Summary.probe.mergeabilityClass,
      admissionPromotionDecision: admissionRecord.promotionDecision,
      admissionRuntimeWritesAdmitted: admissionRecord.runtimeWritesAdmitted,
    },
    ownerDecision: {
      ownerAccepted: true,
      selectionRecordedInRepo: true,
      selectedMethod,
      rejectedMethods,
    },
    riskRows,
    rollbackRows,
    exactC02Inputs,
    issues,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const result = evaluateMainSyncC01OwnerMethodDecision({
    repoRoot: process.cwd(),
    rootSha: args.rootSha,
    mainSha: args.mainSha,
    rootBranch: args.rootBranch,
    mainBranch: args.mainBranch,
  });
  process.stdout.write(`${stableStringify(result)}\n`);
  process.exit(result.ok ? 0 : 1);
}
