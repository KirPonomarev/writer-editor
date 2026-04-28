#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const TOKEN_NAME = 'MAIN_SYNC_C02_CORRECTION_REBIND_AND_SCOPE_RESTORATION_ADMISSION_OK';

const DEFAULT_ROOT_BRANCH = 'codex/toolbar-baseline-truthful-closeout-001';
const DEFAULT_MAIN_BRANCH = 'main';
const DEFAULT_ROOT_SHA = '6f08f94d6866ce3108d6e68d980e35b9e02d71b0';
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

function normalizeBasenames(values) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map((value) => normalizeString(path.basename(String(value || ''))))
    .filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function evaluateMainSyncC02CorrectionRebindAndScopeRestorationAdmission(input = {}) {
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

  const c01InventoryStatus = readJson(repoRoot, 'docs/OPS/STATUS/MAIN_SYNC_C01_AHEAD_INVENTORY_STATUS_V1.json');
  const c01Included = readJson(repoRoot, 'docs/OPS/EVIDENCE/MAIN_SYNC_C01/TICKET_01/included-set.json');
  const c01Excluded = readJson(repoRoot, 'docs/OPS/EVIDENCE/MAIN_SYNC_C01/TICKET_01/excluded-set.json');

  const c01DecisionStatus = readJson(repoRoot, 'docs/OPS/STATUS/MAIN_SYNC_C01_OWNER_METHOD_DECISION_STATUS_V1.json');
  const c01DecisionSummary = readJson(repoRoot, 'docs/OPS/EVIDENCE/MAIN_SYNC_C01_OWNER_METHOD_DECISION/TICKET_01/decision-summary.json');

  const c02MergeabilityStatus = readJson(repoRoot, 'docs/OPS/STATUS/MAIN_SYNC_C02_MERGEABILITY_STATUS_V1.json');
  const c02MergeabilitySummary = readJson(repoRoot, 'docs/OPS/EVIDENCE/MAIN_SYNC_C02/TICKET_01/mergeability-summary.json');

  const c02AdmissionStatus = readJson(repoRoot, 'docs/OPS/STATUS/MAIN_SYNC_C02_REMEDIATION_HISTORY_BRIDGE_ADMISSION_RECORD_V1.json');
  const c02AdmissionSummary = readJson(repoRoot, 'docs/OPS/EVIDENCE/MAIN_SYNC_C02_REMEDIATION_HISTORY_BRIDGE_ADMISSION/TICKET_01/admission-summary.json');

  const c02ReplayStatus = readJson(repoRoot, 'docs/OPS/STATUS/MAIN_SYNC_C02_SELECTED_REPLAY_PLAN_AND_DRY_RUN_STATUS_V1.json');
  const c02ReplayPlan = readJson(repoRoot, 'docs/OPS/EVIDENCE/MAIN_SYNC_C02_SELECTED_REPLAY_PLAN_AND_DRY_RUN/TICKET_01/replay-plan.json');
  const c02DryRun = readJson(repoRoot, 'docs/OPS/EVIDENCE/MAIN_SYNC_C02_SELECTED_REPLAY_PLAN_AND_DRY_RUN/TICKET_01/dry-run.json');
  const c02ReplayNext = readJson(repoRoot, 'docs/OPS/EVIDENCE/MAIN_SYNC_C02_SELECTED_REPLAY_PLAN_AND_DRY_RUN/TICKET_01/next-write-contour.json');

  const canonicalSet = Array.isArray(c01Included) ? c01Included.find((entry) => entry.setId === 'CANONICAL_B2C01_B2C12_CHAIN') : null;
  const canonicalEntries = Array.isArray(canonicalSet?.entries) ? canonicalSet.entries : [];
  const packetReplayCommits = Array.isArray(c02ReplayPlan?.replayPlan?.replayCommits) ? c02ReplayPlan.replayPlan.replayCommits : [];
  const packetReplayBasenames = normalizeBasenames(packetReplayCommits.map((entry) => entry.changedBasenames || []).flat());
  const packetReplaySubjects = packetReplayCommits.map((entry) => normalizeString(entry.subject)).filter(Boolean);
  const packetReplayPurposes = packetReplayCommits.map((entry) => normalizeString(entry.purpose)).filter(Boolean);

  const boundRootMatchesOrigin = originRoot.ok && originRoot.stdout === rootSha;
  const boundMainMatchesOrigin = originMain.ok && originMain.stdout === mainSha;
  const c01InventoryOk = c01InventoryStatus.status === 'ACTIVE';
  const c01ExcludedSetOk = Array.isArray(c01Excluded) && c01Excluded.length === 1 && c01Excluded[0].count === 0;
  const canonicalSetOk = canonicalSet?.count === 13
    && canonicalEntries.length === 13
    && normalizeString(canonicalSet.firstSha) === '24996555943e80fc3aa616becea731645771b4a8'
    && normalizeString(canonicalSet.lastSha) === '0b3cc7f91400df650dcb875453dda4b389bbeb3e';
  const ownerDecisionOk = c01DecisionStatus.selectedMethodId === 'CHERRY_PICK_REPLAY_TO_MAIN'
    && c01DecisionStatus.executionGranted === false
    && c01DecisionSummary.selectedMethod.methodId === 'CHERRY_PICK_REPLAY_TO_MAIN';
  const mergeabilityBlockerOk = c02MergeabilityStatus.status === 'FAILED'
    && c02MergeabilitySummary.failReason === 'BLOCKING_UNRELATED_HISTORIES'
    && c02MergeabilitySummary.probe.mergeabilityClass === 'BLOCKING_UNRELATED_HISTORIES';
  const admissionStopOk = c02AdmissionStatus.promotionDecision === 'STOP'
    && c02AdmissionStatus.runtimeWritesAdmitted === false
    && c02AdmissionSummary.recommendation.methodId === 'STOP';

  const replayStatusOk = c02ReplayStatus.status === 'ACTIVE'
    && c02ReplayStatus.dryRunGreen === true
    && c02ReplayStatus.selectedMethodId === 'CHERRY_PICK_REPLAY_TO_MAIN'
    && c02ReplayStatus.scope === 'REPLAY_PLAN_AND_DRY_RUN_PACKET_ONLY';
  const packetScopeDriftConfirmed = normalizeString(c02ReplayPlan?.replayPlan?.scopeClass) === 'PACKET_ONLY_SYNC_TAIL_AFTER_REBIND_BASE'
    && normalizeString(c02ReplayPlan?.replayPlan?.replayExecutableScopeMode) === 'POST_REBIND_PACKET_CHAIN_ONLY'
    && Number(c02ReplayPlan?.replayPlan?.replayCommitCount || 0) === 7
    && normalizeString(c02ReplayPlan?.replayPlan?.rebindBaseSha) === '0b3cc7f91400df650dcb875453dda4b389bbeb3e';
  const packetScopeEvidenceOk = packetReplayPurposes.includes('MAIN_SYNC_C01_AHEAD_INVENTORY_PACKET')
    && packetReplayPurposes.includes('MAIN_SYNC_C02_MERGEABILITY_PACKET_ADD')
    && packetReplayPurposes.includes('MAIN_SYNC_C02_MERGEABILITY_PACKET_FINALIZE')
    && packetReplayPurposes.includes('MAIN_SYNC_C02_REMEDIATION_ADMISSION_ADD')
    && packetReplayPurposes.includes('MAIN_SYNC_C02_REMEDIATION_ADMISSION_FINALIZE')
    && packetReplayPurposes.includes('MAIN_SYNC_C01_OWNER_METHOD_DECISION_ADD')
    && packetReplayPurposes.includes('MAIN_SYNC_C01_OWNER_METHOD_DECISION_FINALIZE');
  const c03StillBlocked = c02ReplayNext.c03BlockedUntilGreenDryRun === false
    ? false
    : true;

  if (!boundRootMatchesOrigin) issues.push({ code: 'BOUND_ROOT_DRIFT', expected: rootSha, actual: originRoot.stdout || '' });
  if (!boundMainMatchesOrigin) issues.push({ code: 'BOUND_MAIN_DRIFT', expected: mainSha, actual: originMain.stdout || '' });
  if (!localHeadDescendsFromRoot) issues.push({ code: 'LOCAL_HEAD_DRIFT', expected: rootSha, actual: head.stdout || '' });
  if (!c01InventoryOk) issues.push({ code: 'C01_INVENTORY_BINDING_RED' });
  if (!c01ExcludedSetOk) issues.push({ code: 'C01_EXCLUDED_SET_RED' });
  if (!canonicalSetOk) issues.push({ code: 'CANONICAL_B2C_CHAIN_RED' });
  if (!ownerDecisionOk) issues.push({ code: 'C01_OWNER_METHOD_BINDING_RED' });
  if (!mergeabilityBlockerOk) issues.push({ code: 'C02_BLOCKER_BINDING_RED' });
  if (!admissionStopOk) issues.push({ code: 'C02_ADMISSION_BINDING_RED' });
  if (!replayStatusOk) issues.push({ code: 'PR_825_STATUS_BINDING_RED' });
  if (!packetScopeDriftConfirmed) issues.push({ code: 'PR_825_SCOPE_DRIFT_NOT_PROVED' });
  if (!packetScopeEvidenceOk) issues.push({ code: 'PR_825_PACKET_SCOPE_EVIDENCE_RED' });

  const allowedCorrectionDomain = {
    classification: 'CANONICAL_B2C_CHAIN_ONLY',
    payloadSetId: 'CANONICAL_B2C01_B2C12_CHAIN',
    payloadCount: canonicalEntries.length,
    firstPayloadSha: canonicalSet ? canonicalSet.firstSha : '',
    lastPayloadSha: canonicalSet ? canonicalSet.lastSha : '',
    payloadSubjects: canonicalEntries.map((entry) => normalizeString(entry.subject)),
  };

  const controlPlaneBindingOnly = {
    classification: 'SYNC_PACKET_COMMITS_821_TO_825_BINDING_ONLY',
    artifacts: [
      'MAIN_SYNC_C01_AHEAD_INVENTORY_STATUS_V1.json',
      'MAIN_SYNC_C02_MERGEABILITY_STATUS_V1.json',
      'MAIN_SYNC_C02_REMEDIATION_HISTORY_BRIDGE_ADMISSION_RECORD_V1.json',
      'MAIN_SYNC_C01_OWNER_METHOD_DECISION_STATUS_V1.json',
      'MAIN_SYNC_C02_SELECTED_REPLAY_PLAN_AND_DRY_RUN_STATUS_V1.json',
    ],
    packetReplayCommitCount: packetReplayCommits.length,
    packetReplayPurposes,
  };

  const forbiddenCorrectionDomain = {
    classification: 'PACKET_ONLY_SYNC_TAIL_REPLAY',
    reason: 'PR_825 replayed sync control plane packet chain instead of canonical B2C payload.',
    replayCommitCount: packetReplayCommits.length,
    replayBasenames: packetReplayBasenames,
    replaySubjects: packetReplaySubjects,
  };

  const riskRows = [
    {
      riskId: 'PR_825_ACCEPTANCE_DRIFT',
      severity: 'HIGH',
      detail: 'Treating PR 825 as green would legitimize packet-tail replay as payload and break canonical scope control.',
    },
    {
      riskId: 'MOVED_ROOT_BASE',
      severity: 'HIGH',
      detail: 'Any further write must bind to root head 6f08f94d... or stop again under delivery enforcement.',
    },
    {
      riskId: 'CONTROL_PLANE_AS_PAYLOAD',
      severity: 'HIGH',
      detail: 'Sync packet commits 821 through 825 must remain governance bindings only unless owner explicitly expands scope.',
    },
  ];

  const rollbackRows = [
    {
      rollbackId: 'KEEP_C03_BLOCKED',
      trigger: 'No corrected replay-readiness contour exists on the new binding base.',
      action: 'Do not open any main promotion contour and preserve C03 as blocked.',
    },
    {
      rollbackId: 'REJECT_PACKET_TAIL_REPLAY',
      trigger: 'Any new contour proposes packet-only sync tail replay as payload.',
      action: 'Reject the contour and restore canonical B2C chain only as the allowed future payload scope.',
    },
  ];

  const exactNextWriteScopeInput = {
    nextContour: 'MAIN_SYNC_C02_CORRECTIVE_REPLAY_PLAN_AND_DRY_RUN_FROM_REBOUND_BASE',
    bindingBaseRootSha: rootSha,
    bindingBaseMainSha: mainSha,
    allowedReplayPayloadClass: 'CANONICAL_B2C_CHAIN_ONLY',
    forbiddenReplayPayloadClass: 'PACKET_ONLY_SYNC_TAIL_REPLAY',
    executionApproved: false,
    c03StillBlocked: true,
  };

  return {
    ok: issues.length === 0,
    [TOKEN_NAME]: issues.length === 0 ? 1 : 0,
    version: 1,
    status: issues.length === 0 ? 'CORRECTION_REBIND_AND_SCOPE_RESTORATION_READY' : 'CORRECTION_REBIND_FACT_DRIFT',
    token: TOKEN_NAME,
    taskBasename: 'MAIN_SYNC_C02_CORRECTION_REBIND_AND_SCOPE_RESTORATION_ADMISSION',
    contourId: 'MAIN_SYNC_C02_CORRECTION_REBIND_AND_SCOPE_RESTORATION_ADMISSION',
    scope: 'REBIND_AND_SCOPE_RESTORATION_PACKET_ONLY',
    stateScript: 'main-sync-c02-correction-rebind-and-scope-restoration-admission-state.mjs',
    reportScript: 'main-sync-c02-correction-rebind-and-scope-restoration-admission-report.mjs',
    contractTest: 'main-sync-c02-correction-rebind-and-scope-restoration-admission.contract.test.js',
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
      c01InventoryOk,
      c01ExcludedSetOk,
      canonicalSetOk,
      ownerDecisionOk,
      mergeabilityBlockerOk,
      admissionStopOk,
      replayStatusOk,
      packetScopeDriftConfirmed,
      packetScopeEvidenceOk,
      c03StillBlocked,
    },
    truthSurface: {
      formalRepoTruth: 'MAIN_AFTER_MERGE_GATE_AND_POST_MERGE_RECONFIRM',
      rootRole: 'SOURCE_OF_REQUIRED_CONTENT_ONLY',
    },
    pr825Classification: {
      prNumber: 825,
      mergedTargetHeadSha: rootSha,
      deliveryState: 'DELIVERED',
      canonicalAcceptanceState: 'NOT_CANONICALLY_ACCEPTED',
      failureClass: 'SCOPE_DRIFT',
      scopeClassRecordedByPr825: normalizeString(c02ReplayPlan?.replayPlan?.scopeClass),
      dryRunRecordedByPr825: normalizeString(c02ReplayStatus?.dryRunGreen ? 'GREEN' : 'NOT_GREEN'),
    },
    allowedCorrectionDomain,
    controlPlaneBindingOnly,
    forbiddenCorrectionDomain,
    riskRows,
    rollbackRows,
    exactNextWriteScopeInput,
    issues,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const result = evaluateMainSyncC02CorrectionRebindAndScopeRestorationAdmission({
    repoRoot: process.cwd(),
    rootSha: args.rootSha,
    mainSha: args.mainSha,
    rootBranch: args.rootBranch,
    mainBranch: args.mainBranch,
  });
  process.stdout.write(`${stableStringify(result)}\n`);
  process.exit(result.ok ? 0 : 1);
}
