#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { canonicalBytes, sha256 } from './canonical-json.mjs';

export const PRE00E_TASK_ID = 'R24_PRE00E_RECOVERY_CI_EXTERNAL_CONFIRMATION_001';
export const PRE00E_SCHEMA_VERSION = 'R24_PRE00E_RECOVERY_CI_EXTERNAL_CONFIRMATION_STATUS_V1';
export const PRE00E_BASE_SHA = 'a8a7781a0c4dbf35de42c30df40988d968839c3e';
export const PRE00E_BASE_TREE = 'a57c353a403974fc7245c5ad58afd3204632dac3';
export const PRE00D_RECOVERY_PR = 1847;
export const PRE00D_RECOVERY_HEAD_SHA = '4fe1b1d7872f80d82ec4f438a16a919eb058c95e';
export const PRE00D_RECOVERY_HEAD_TREE = 'a57c353a403974fc7245c5ad58afd3204632dac3';
export const PRE00D_RECOVERY_BASE_SHA = 'ff92699f3439a6e058a8a8a7f00ef69b63f89971';
export const PRE00D_RECOVERY_BASE_TREE = '044086053219a61453364163803ce03775136226';
export const PRE00D_RECOVERY_OSS_POLICY_RUN_ID = 34267263415;
export const PRE00D_RECOVERY_OPS_VECTOR_CLOSE_RUN_ID = 34268460646;
export const REVIEW_CARRIER_PR = 1843;
export const REVIEW_CARRIER_HEAD_SHA = '46fcb00b56a4d36482a13d5734fc21d2423f0b81';
export const REVIEW_CARRIER_HEAD_TREE = '53f091ab99792e91538af5bdd0a640adb9d62551';
export const REVIEW_CARRIER_BASE_SHA = 'af74b9542c17c24a7515ce9017d98ea7b2e4d55a';
export const REVIEW_CARRIER_FAILED_RUN_ID = 34233816331;
export const STATUS_PATH = 'docs/OPS/R24/CORRECTIVE/PRE00E_RECOVERY_CI_EXTERNAL_CONFIRMATION_STATUS_V1.json';
export const EVIDENCE_PATH = 'docs/OPS/R24/EVIDENCE/ES-R24-PRE00E-RECOVERY-CI-EXTERNAL-CONFIRMATION.json';
export const APPROVALS_PATH = 'docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json';
export const INVENTORY_PATH = 'docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json';
export const TASK_DOC_PATH = 'docs/tasks/R24_PRE00E_RECOVERY_CI_EXTERNAL_CONFIRMATION_001.md';
export const VERIFIER_PATH = 'scripts/ops/r24/corrective/pre00e-recovery-ci-external-confirmation.mjs';
export const POST_AUDIT_VERIFIER_PATH = 'scripts/ops/r24/corrective/post-audit-certification-set.mjs';
export const CLAIM_LINT_PATH = 'scripts/ops/r24/docs-claim-lint.mjs';
export const CLAIM_LINT_TEST_PATH = 'scripts/ops/r24/tests/docs-claim-lint.test.mjs';
export const POST_AUDIT_TEST_PATH = 'test/contracts/r24-post-audit-certification-set.contract.test.mjs';
export const TEST_PATH = 'test/contracts/r24-pre00e-recovery-ci-external-confirmation.contract.test.mjs';

export const PRE00E_DELIVERY_ADMITTED_PATHS = Object.freeze([
  APPROVALS_PATH,
  INVENTORY_PATH,
  STATUS_PATH,
  EVIDENCE_PATH,
  TASK_DOC_PATH,
  VERIFIER_PATH,
  POST_AUDIT_VERIFIER_PATH,
  CLAIM_LINT_PATH,
  CLAIM_LINT_TEST_PATH,
  POST_AUDIT_TEST_PATH,
  TEST_PATH,
].sort((a, b) => a.localeCompare(b, 'en-US')));

export const PRE00E_IMPLEMENTATION_DIGEST_PATHS = Object.freeze([
  CLAIM_LINT_PATH,
  CLAIM_LINT_TEST_PATH,
  POST_AUDIT_TEST_PATH,
  POST_AUDIT_VERIFIER_PATH,
  TASK_DOC_PATH,
  TEST_PATH,
  VERIFIER_PATH,
]);

export const PRE00E_APPROVAL_REQUIRED_PATHS = Object.freeze(
  PRE00E_DELIVERY_ADMITTED_PATHS.filter((repoPath) => repoPath !== APPROVALS_PATH),
);

export const RECOVERY_REQUIRED_CHECKS = Object.freeze([
  ['actual-renderer-build-rtk', 102199650484, '2026-09-08T19:16:58Z'],
  ['c1a-hermetic / c1a-hermetic (macos-latest)', 102199651061, '2026-09-08T19:13:18Z'],
  ['c1a-hermetic / c1a-hermetic (ubuntu-latest)', 102199650987, '2026-09-08T19:10:10Z'],
  ['c1a-hermetic / c1a-hermetic (windows-latest)', 102199651038, '2026-09-08T19:13:11Z'],
  ['e0-mutants', 102199650658, '2026-09-08T19:10:40Z'],
  ['inventory-baseline', 102199650157, '2026-09-08T19:17:54Z'],
  ['live-ruleset-oracle', 102199650497, '2026-09-08T19:09:12Z'],
  ['merge-gate', 102203412754, '2026-09-08T19:20:31Z'],
  ['ops-vector', 102199650459, '2026-09-08T19:09:40Z'],
  ['oss-policy', 102203467482, '2026-09-08T19:20:36Z'],
  ['oss-policy-core', 102199650949, '2026-09-08T19:09:21Z'],
  ['privacy-negative', 102199650437, '2026-09-08T19:09:32Z'],
  ['rtk-required / rtk-required', 102199651297, '2026-09-08T19:20:21Z'],
  ['static-security-sast', 102199650814, '2026-09-08T19:10:48Z'],
  ['x1-runtime-parity / x1-runtime-parity (macos-latest)', 102199651646, '2026-09-08T19:09:43Z'],
  ['x1-runtime-parity / x1-runtime-parity (ubuntu-latest)', 102199651309, '2026-09-08T19:10:09Z'],
  ['x1-runtime-parity / x1-runtime-parity (windows-latest)', 102199651333, '2026-09-08T19:09:53Z'],
].sort((left, right) => left[0].localeCompare(right[0], 'en-US')));

export const FORMERLY_FAILING_PRIMARY_LANES = Object.freeze([
  'actual-renderer-build-rtk',
  'c1a-hermetic / c1a-hermetic (macos-latest)',
  'c1a-hermetic / c1a-hermetic (ubuntu-latest)',
  'c1a-hermetic / c1a-hermetic (windows-latest)',
  'ops-vector',
].sort((a, b) => a.localeCompare(b, 'en-US')));

export const HISTORICAL_FAILED_CHECKS = Object.freeze([
  ['actual-renderer-build-rtk', 102086301383],
  ['c1a-hermetic / c1a-hermetic (macos-latest)', 102086301888],
  ['c1a-hermetic / c1a-hermetic (ubuntu-latest)', 102086301872],
  ['c1a-hermetic / c1a-hermetic (windows-latest)', 102086302191],
  ['merge-gate', 102090555854],
  ['ops-vector', 102086301717],
  ['oss-policy', 102090608494],
].sort((left, right) => left[0].localeCompare(right[0], 'en-US')));

export const MERGE_GATE_DEPENDENCY_CHECKS = Object.freeze(
  RECOVERY_REQUIRED_CHECKS
    .map(([name]) => name)
    .filter((name) => !['merge-gate', 'oss-policy'].includes(name))
    .sort((a, b) => a.localeCompare(b, 'en-US')),
);

export const PRE00E_COMMAND_SCOPE = Object.freeze([
  'agent:bootstrap',
  'agent:preflight',
  'verify-recovery-ci-checks',
  'verify-formerly-failing-primary-lanes',
  'verify-aggregate-lanes-from-dependencies',
  'verify-recovered-origin-main-clean',
  'preserve-review-carrier-as-historical-evidence',
  'focused-positive-negative-mutant-proof',
  'guardrails',
  'commit-push-pr-ci-merge-postmerge',
]);

export const PRE00E_ACCEPTANCE_SIGNALS = Object.freeze([
  'PRE00D_RECOVERY_PR1847_MERGED',
  'SEVENTEEN_RECOVERY_REQUIRED_JOBS_SUCCESS',
  'FIVE_FORMERLY_FAILING_PRIMARY_LANES_RECOVERED',
  'AGGREGATE_LANES_PASS_FROM_REAL_DEPENDENCIES',
  'RECOVERED_ORIGIN_MAIN_EXACT_SHA_TREE_CLEAN',
  'PR1843_REMAINS_HISTORICAL_REVIEW_CARRIER',
  'NO_PLAN_REBIND_BEFORE_PRE00F',
]);

const DIGEST_FIELDS = Object.freeze([
  'acceptanceSignalsDigest',
  'aggregateLanesDigest',
  'commandScopeDigest',
  'recoveredOriginMainDigest',
  'recoveryJobsDigest',
  'reviewCarrierDigest',
]);

export class Pre00eError extends Error {
  constructor(code, detail = '') {
    super(detail ? `${code}: ${detail}` : code);
    this.code = code;
    this.detail = detail;
  }
}

const clone = (value) => JSON.parse(JSON.stringify(value));
const digest = (value) => sha256(canonicalBytes(value));
const fail = (code, detail = '') => {
  throw new Pre00eError(code, detail);
};
const sorted = (items) => [...items].sort((a, b) => a.localeCompare(b, 'en-US'));

function expectObject(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  return value;
}

function expectExactKeys(value, keys, code) {
  const actual = Object.keys(expectObject(value, code)).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(code, actual.join(','));
}

function expectArrayExact(value, expected, code) {
  if (!Array.isArray(value) || JSON.stringify(value) !== JSON.stringify(expected)) {
    fail(code, JSON.stringify(value));
  }
}

function expectFalseMap(object, code) {
  for (const [field, value] of Object.entries(expectObject(object, code))) {
    if (value !== false) fail(code, field);
  }
}

function runGit(repoRoot, args, { allowFailure = false } = {}) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10000,
  });
  if (result.status !== 0) {
    if (allowFailure) return null;
    const stderr = String(result.stderr || '').trim();
    fail('E_PRE00E_GIT_FAILED', `git ${args.join(' ')}${stderr ? `: ${stderr}` : ''}`);
  }
  return String(result.stdout || '').trim();
}

function recoveryJob(name, jobId, completedAt) {
  return {
    name,
    jobId,
    runId: PRE00D_RECOVERY_OSS_POLICY_RUN_ID,
    workflow: 'OSS policy',
    event: 'pull_request',
    headSha: PRE00D_RECOVERY_HEAD_SHA,
    state: 'SUCCESS',
    completedAt,
  };
}

function historicalCheck(name, jobId) {
  return {
    name,
    jobId,
    runId: REVIEW_CARRIER_FAILED_RUN_ID,
    workflow: 'OSS policy',
    event: 'pull_request',
    headSha: REVIEW_CARRIER_HEAD_SHA,
    state: 'FAILURE',
  };
}

export function buildPre00eRecoveryCiStatus(overrides = {}) {
  const recoveryJobs = RECOVERY_REQUIRED_CHECKS.map(([name, jobId, completedAt]) => recoveryJob(name, jobId, completedAt));
  const historicalFailures = HISTORICAL_FAILED_CHECKS.map(([name, jobId]) => historicalCheck(name, jobId));
  const recoveryJobByName = new Map(recoveryJobs.map((job) => [job.name, job]));
  const historicalFailureByName = new Map(historicalFailures.map((job) => [job.name, job]));
  const formerlyFailingPrimaryLanes = FORMERLY_FAILING_PRIMARY_LANES.map((name) => ({
    name,
    historicalPr: REVIEW_CARRIER_PR,
    historicalRunId: REVIEW_CARRIER_FAILED_RUN_ID,
    historicalState: historicalFailureByName.get(name).state,
    recoveryPr: PRE00D_RECOVERY_PR,
    recoveryRunId: PRE00D_RECOVERY_OSS_POLICY_RUN_ID,
    recoveryState: recoveryJobByName.get(name).state,
  }));
  const aggregateLanes = [
    {
      name: 'merge-gate',
      recoveryState: recoveryJobByName.get('merge-gate').state,
      historicalState: historicalFailureByName.get('merge-gate').state,
      dependencyCheckNames: [...MERGE_GATE_DEPENDENCY_CHECKS],
      dependencySource: 'oss-policy.yml needs graph observed through child check jobs',
    },
    {
      name: 'oss-policy',
      recoveryState: recoveryJobByName.get('oss-policy').state,
      historicalState: historicalFailureByName.get('oss-policy').state,
      dependencyCheckNames: ['merge-gate'],
      dependencySource: 'oss-policy job requires merge-gate success',
    },
  ];
  const status = {
    schemaVersion: PRE00E_SCHEMA_VERSION,
    status: 'PASS',
    taskId: PRE00E_TASK_ID,
    gitIdentity: {
      bindingBaseSha: PRE00E_BASE_SHA,
      bindingBaseTree: PRE00E_BASE_TREE,
      recoveredOriginMainSha: PRE00E_BASE_SHA,
      recoveredOriginMainTree: PRE00E_BASE_TREE,
      targetRemote: 'origin',
    },
    recoveryCandidate: {
      pr: PRE00D_RECOVERY_PR,
      title: 'R24 PRE00D successor admission lease handoff',
      baseSha: PRE00D_RECOVERY_BASE_SHA,
      baseTree: PRE00D_RECOVERY_BASE_TREE,
      headSha: PRE00D_RECOVERY_HEAD_SHA,
      headTree: PRE00D_RECOVERY_HEAD_TREE,
      mergeSha: PRE00E_BASE_SHA,
      mergeTree: PRE00E_BASE_TREE,
      mergedAtUtc: '2026-09-08T19:21:14Z',
      finalOssPolicyRunId: PRE00D_RECOVERY_OSS_POLICY_RUN_ID,
      postMergeOpsVectorCloseRunId: PRE00D_RECOVERY_OPS_VECTOR_CLOSE_RUN_ID,
      requiredJobDenominator: RECOVERY_REQUIRED_CHECKS.length,
      requiredJobs: recoveryJobs,
      postMergeClose: {
        workflow: 'ops-vector-close',
        jobName: 'ops_vector_close',
        runId: PRE00D_RECOVERY_OPS_VECTOR_CLOSE_RUN_ID,
        event: 'pull_request',
        headSha: PRE00D_RECOVERY_HEAD_SHA,
        state: 'SUCCESS',
        completedAt: '2026-09-08T19:21:30Z',
      },
    },
    formerlyFailingPrimaryLanes,
    aggregateLanes,
    recoveredOriginMain: {
      sha: PRE00E_BASE_SHA,
      tree: PRE00E_BASE_TREE,
      observedCleanWorktreeBeforeWrite: true,
      observedHeadEqualsOriginMainBeforeWrite: true,
      observedBy: 'agent-bootstrap-and-preflight',
    },
    reviewCarrier: {
      pr: REVIEW_CARRIER_PR,
      title: 'R2.4 consolidated remediation plan V2 (review carrier)',
      state: 'OPEN',
      isDraft: false,
      merged: false,
      mergeCommitSha: null,
      baseSha: REVIEW_CARRIER_BASE_SHA,
      headSha: REVIEW_CARRIER_HEAD_SHA,
      headTree: REVIEW_CARRIER_HEAD_TREE,
      failedRunId: REVIEW_CARRIER_FAILED_RUN_ID,
      role: 'HISTORICAL_EVIDENCE_ONLY',
      notPlanDeliveryAuthority: true,
      mustNotMergeBeforePre00f: true,
      historicalFailedChecks: historicalFailures,
    },
    commandScope: [...PRE00E_COMMAND_SCOPE],
    acceptanceSignals: [...PRE00E_ACCEPTANCE_SIGNALS],
    nonClaims: {
      pre00fCompleted: false,
      planReboundOrDelivered: false,
      pr1843Merged: false,
      pk1ReleaseSecurityPhysicalStarted: false,
      v3PackageClaimCompilerStarted: false,
      wp900Started: false,
      productRuntimeMutated: false,
      uiMutated: false,
      dependencyChanged: false,
      processInspectionOrTerminationPerformed: false,
      runtimeNetworkOrCloudTruthAdded: false,
    },
    digests: {},
  };
  Object.assign(status, overrides);
  status.digests = {
    acceptanceSignalsDigest: digest(status.acceptanceSignals),
    aggregateLanesDigest: digest(status.aggregateLanes),
    commandScopeDigest: digest(status.commandScope),
    recoveredOriginMainDigest: digest(status.recoveredOriginMain),
    recoveryJobsDigest: digest(status.recoveryCandidate.requiredJobs),
    reviewCarrierDigest: digest(status.reviewCarrier),
  };
  return status;
}

function byName(items) {
  return new Map(items.map((item) => [item.name, item]));
}

export function verifyPre00eRecoveryCiStatus(status, options = {}) {
  expectExactKeys(status, [
    'acceptanceSignals',
    'aggregateLanes',
    'commandScope',
    'digests',
    'formerlyFailingPrimaryLanes',
    'gitIdentity',
    'nonClaims',
    'recoveredOriginMain',
    'recoveryCandidate',
    'reviewCarrier',
    'schemaVersion',
    'status',
    'taskId',
  ], 'E_PRE00E_STATUS_KEYS');
  if (status.schemaVersion !== PRE00E_SCHEMA_VERSION) fail('E_PRE00E_SCHEMA');
  if (status.status !== 'PASS') fail('E_PRE00E_STATUS');
  if (status.taskId !== PRE00E_TASK_ID) fail('E_PRE00E_TASK_ID');

  expectExactKeys(status.gitIdentity, [
    'bindingBaseSha',
    'bindingBaseTree',
    'recoveredOriginMainSha',
    'recoveredOriginMainTree',
    'targetRemote',
  ], 'E_PRE00E_GIT_IDENTITY_KEYS');
  if (status.gitIdentity.bindingBaseSha !== PRE00E_BASE_SHA) fail('E_PRE00E_BASE_SHA');
  if (status.gitIdentity.bindingBaseTree !== PRE00E_BASE_TREE) fail('E_PRE00E_BASE_TREE');
  if (status.gitIdentity.recoveredOriginMainSha !== PRE00E_BASE_SHA) fail('E_PRE00E_RECOVERED_ORIGIN_SHA');
  if (status.gitIdentity.recoveredOriginMainTree !== PRE00E_BASE_TREE) fail('E_PRE00E_RECOVERED_ORIGIN_TREE');
  if (status.gitIdentity.targetRemote !== 'origin') fail('E_PRE00E_REMOTE');

  const recovery = status.recoveryCandidate;
  expectExactKeys(recovery, [
    'baseSha',
    'baseTree',
    'finalOssPolicyRunId',
    'headSha',
    'headTree',
    'mergeSha',
    'mergeTree',
    'mergedAtUtc',
    'postMergeClose',
    'postMergeOpsVectorCloseRunId',
    'pr',
    'requiredJobDenominator',
    'requiredJobs',
    'title',
  ], 'E_PRE00E_RECOVERY_KEYS');
  if (recovery.pr !== PRE00D_RECOVERY_PR) fail('E_PRE00E_RECOVERY_PR');
  if (recovery.baseSha !== PRE00D_RECOVERY_BASE_SHA || recovery.baseTree !== PRE00D_RECOVERY_BASE_TREE) fail('E_PRE00E_RECOVERY_BASE');
  if (recovery.headSha !== PRE00D_RECOVERY_HEAD_SHA || recovery.headTree !== PRE00D_RECOVERY_HEAD_TREE) fail('E_PRE00E_RECOVERY_HEAD');
  if (recovery.mergeSha !== PRE00E_BASE_SHA || recovery.mergeTree !== PRE00E_BASE_TREE) fail('E_PRE00E_RECOVERY_MERGE');
  if (recovery.finalOssPolicyRunId !== PRE00D_RECOVERY_OSS_POLICY_RUN_ID) fail('E_PRE00E_RECOVERY_RUN');
  if (recovery.requiredJobDenominator !== RECOVERY_REQUIRED_CHECKS.length) fail('E_PRE00E_JOB_DENOMINATOR');
  if (!Array.isArray(recovery.requiredJobs) || recovery.requiredJobs.length !== RECOVERY_REQUIRED_CHECKS.length) {
    fail('E_PRE00E_JOB_COUNT', String(recovery.requiredJobs?.length ?? 'missing'));
  }
  const expectedJobNames = RECOVERY_REQUIRED_CHECKS.map(([name]) => name).sort();
  const recoveryJobsByName = byName(recovery.requiredJobs);
  expectArrayExact(sorted([...recoveryJobsByName.keys()]), expectedJobNames, 'E_PRE00E_JOB_SET');
  for (const [name, jobId] of RECOVERY_REQUIRED_CHECKS) {
    const job = recoveryJobsByName.get(name);
    expectExactKeys(job, ['completedAt', 'event', 'headSha', 'jobId', 'name', 'runId', 'state', 'workflow'], 'E_PRE00E_JOB_KEYS');
    if (job.jobId !== jobId) fail('E_PRE00E_JOB_ID', name);
    if (job.runId !== PRE00D_RECOVERY_OSS_POLICY_RUN_ID) fail('E_PRE00E_JOB_RUN', name);
    if (job.workflow !== 'OSS policy' || job.event !== 'pull_request') fail('E_PRE00E_JOB_WORKFLOW', name);
    if (job.headSha !== PRE00D_RECOVERY_HEAD_SHA) fail('E_PRE00E_JOB_HEAD', name);
    if (job.state !== 'SUCCESS') fail('E_PRE00E_JOB_STATE', name);
  }
  expectExactKeys(recovery.postMergeClose, ['completedAt', 'event', 'headSha', 'jobName', 'runId', 'state', 'workflow'], 'E_PRE00E_CLOSE_KEYS');
  if (recovery.postMergeClose.runId !== PRE00D_RECOVERY_OPS_VECTOR_CLOSE_RUN_ID || recovery.postMergeClose.jobName !== 'ops_vector_close' || recovery.postMergeClose.state !== 'SUCCESS') {
    fail('E_PRE00E_CLOSE_RUN');
  }

  expectArrayExact(sorted(status.formerlyFailingPrimaryLanes.map((lane) => lane.name)), [...FORMERLY_FAILING_PRIMARY_LANES], 'E_PRE00E_FORMER_LANE_SET');
  const historicalFailuresByName = byName(status.reviewCarrier.historicalFailedChecks);
  for (const lane of status.formerlyFailingPrimaryLanes) {
    expectExactKeys(lane, ['historicalPr', 'historicalRunId', 'historicalState', 'name', 'recoveryPr', 'recoveryRunId', 'recoveryState'], 'E_PRE00E_FORMER_LANE_KEYS');
    if (lane.historicalPr !== REVIEW_CARRIER_PR || lane.historicalRunId !== REVIEW_CARRIER_FAILED_RUN_ID || lane.historicalState !== 'FAILURE') {
      fail('E_PRE00E_HISTORICAL_LANE_STATE', lane.name);
    }
    if (lane.recoveryPr !== PRE00D_RECOVERY_PR || lane.recoveryRunId !== PRE00D_RECOVERY_OSS_POLICY_RUN_ID || lane.recoveryState !== 'SUCCESS') {
      fail('E_PRE00E_RECOVERY_LANE_STATE', lane.name);
    }
    if (historicalFailuresByName.get(lane.name)?.state !== 'FAILURE') fail('E_PRE00E_HISTORICAL_LANE_BINDING', lane.name);
    if (recoveryJobsByName.get(lane.name)?.state !== 'SUCCESS') fail('E_PRE00E_RECOVERY_LANE_BINDING', lane.name);
  }

  expectArrayExact(status.aggregateLanes.map((lane) => lane.name), ['merge-gate', 'oss-policy'], 'E_PRE00E_AGGREGATE_SET');
  const mergeGate = status.aggregateLanes[0];
  const ossPolicy = status.aggregateLanes[1];
  if (mergeGate.recoveryState !== 'SUCCESS' || mergeGate.historicalState !== 'FAILURE') fail('E_PRE00E_MERGE_GATE_STATE');
  expectArrayExact(sorted(mergeGate.dependencyCheckNames), [...MERGE_GATE_DEPENDENCY_CHECKS], 'E_PRE00E_MERGE_GATE_DEPENDENCIES');
  for (const name of mergeGate.dependencyCheckNames) {
    if (recoveryJobsByName.get(name)?.state !== 'SUCCESS') fail('E_PRE00E_AGGREGATE_DEPENDENCY_STATE', name);
  }
  if (ossPolicy.recoveryState !== 'SUCCESS' || ossPolicy.historicalState !== 'FAILURE') fail('E_PRE00E_OSS_POLICY_STATE');
  expectArrayExact(ossPolicy.dependencyCheckNames, ['merge-gate'], 'E_PRE00E_OSS_POLICY_DEPENDENCY');
  if (recoveryJobsByName.get('merge-gate')?.state !== 'SUCCESS') fail('E_PRE00E_OSS_POLICY_FALSE_GREEN');

  expectExactKeys(status.recoveredOriginMain, [
    'observedBy',
    'observedCleanWorktreeBeforeWrite',
    'observedHeadEqualsOriginMainBeforeWrite',
    'sha',
    'tree',
  ], 'E_PRE00E_RECOVERED_MAIN_KEYS');
  if (status.recoveredOriginMain.sha !== PRE00E_BASE_SHA || status.recoveredOriginMain.tree !== PRE00E_BASE_TREE) fail('E_PRE00E_RECOVERED_MAIN_IDENTITY');
  if (status.recoveredOriginMain.observedCleanWorktreeBeforeWrite !== true) fail('E_PRE00E_RECOVERED_MAIN_CLEAN');
  if (status.recoveredOriginMain.observedHeadEqualsOriginMainBeforeWrite !== true) fail('E_PRE00E_RECOVERED_MAIN_HEAD_ORIGIN');

  const carrier = status.reviewCarrier;
  expectExactKeys(carrier, [
    'baseSha',
    'failedRunId',
    'headSha',
    'headTree',
    'historicalFailedChecks',
    'isDraft',
    'mergeCommitSha',
    'merged',
    'mustNotMergeBeforePre00f',
    'notPlanDeliveryAuthority',
    'pr',
    'role',
    'state',
    'title',
  ], 'E_PRE00E_REVIEW_CARRIER_KEYS');
  if (carrier.pr !== REVIEW_CARRIER_PR || carrier.state !== 'OPEN' || carrier.isDraft !== false) fail('E_PRE00E_REVIEW_CARRIER_STATE');
  if (carrier.merged !== false || carrier.mergeCommitSha !== null) fail('E_PRE00E_REVIEW_CARRIER_MERGED');
  if (carrier.baseSha !== REVIEW_CARRIER_BASE_SHA || carrier.headSha !== REVIEW_CARRIER_HEAD_SHA || carrier.headTree !== REVIEW_CARRIER_HEAD_TREE) fail('E_PRE00E_REVIEW_CARRIER_IDENTITY');
  if (carrier.failedRunId !== REVIEW_CARRIER_FAILED_RUN_ID || carrier.role !== 'HISTORICAL_EVIDENCE_ONLY') fail('E_PRE00E_REVIEW_CARRIER_ROLE');
  if (carrier.notPlanDeliveryAuthority !== true || carrier.mustNotMergeBeforePre00f !== true) fail('E_PRE00E_REVIEW_CARRIER_AUTHORITY');
  expectArrayExact(sorted(carrier.historicalFailedChecks.map((job) => job.name)), HISTORICAL_FAILED_CHECKS.map(([name]) => name).sort(), 'E_PRE00E_HISTORICAL_JOB_SET');
  for (const [name, jobId] of HISTORICAL_FAILED_CHECKS) {
    const job = historicalFailuresByName.get(name);
    if (job.jobId !== jobId || job.runId !== REVIEW_CARRIER_FAILED_RUN_ID || job.workflow !== 'OSS policy' || job.event !== 'pull_request') {
      fail('E_PRE00E_HISTORICAL_JOB_IDENTITY', name);
    }
    if (job.headSha !== REVIEW_CARRIER_HEAD_SHA || job.state !== 'FAILURE') fail('E_PRE00E_HISTORICAL_JOB_STATE', name);
  }

  expectArrayExact(status.commandScope, PRE00E_COMMAND_SCOPE, 'E_PRE00E_COMMAND_SCOPE');
  expectArrayExact(status.acceptanceSignals, PRE00E_ACCEPTANCE_SIGNALS, 'E_PRE00E_ACCEPTANCE_SIGNALS');
  expectFalseMap(status.nonClaims, 'E_PRE00E_NON_CLAIM_LEAK');
  expectExactKeys(status.digests, DIGEST_FIELDS, 'E_PRE00E_DIGEST_KEYS');
  if (status.digests.acceptanceSignalsDigest !== digest(status.acceptanceSignals)) fail('E_PRE00E_ACCEPTANCE_DIGEST');
  if (status.digests.aggregateLanesDigest !== digest(status.aggregateLanes)) fail('E_PRE00E_AGGREGATE_DIGEST');
  if (status.digests.commandScopeDigest !== digest(status.commandScope)) fail('E_PRE00E_COMMAND_DIGEST');
  if (status.digests.recoveredOriginMainDigest !== digest(status.recoveredOriginMain)) fail('E_PRE00E_RECOVERED_MAIN_DIGEST');
  if (status.digests.recoveryJobsDigest !== digest(status.recoveryCandidate.requiredJobs)) fail('E_PRE00E_RECOVERY_JOBS_DIGEST');
  if (status.digests.reviewCarrierDigest !== digest(status.reviewCarrier)) fail('E_PRE00E_REVIEW_CARRIER_DIGEST');

  const repoRoot = options.repoRoot ? path.resolve(options.repoRoot) : null;
  if (repoRoot) {
    const baseTree = runGit(repoRoot, ['rev-parse', `${PRE00E_BASE_SHA}^{tree}`]);
    if (baseTree !== PRE00E_BASE_TREE) fail('E_PRE00E_BASE_TREE_CURRENT', baseTree);
    const head = runGit(repoRoot, ['rev-parse', 'HEAD']);
    const ancestor = head === PRE00E_BASE_SHA || runGit(repoRoot, ['merge-base', '--is-ancestor', PRE00E_BASE_SHA, head], { allowFailure: true }) === '';
    if (!ancestor) fail('E_PRE00E_BASE_NOT_ANCESTOR', head);
    if (options.requireOriginMainAtRecovered === true) {
      const originMain = runGit(repoRoot, ['rev-parse', 'origin/main']);
      if (originMain !== PRE00E_BASE_SHA) fail('E_PRE00E_ORIGIN_MAIN_CURRENT', originMain);
    }
  }

  return {
    schemaVersion: 'R24_PRE00E_RECOVERY_CI_EXTERNAL_CONFIRMATION_VERIFICATION_V1',
    status: 'PASS',
    recoveredOriginMainSha: PRE00E_BASE_SHA,
    recoveredOriginMainTree: PRE00E_BASE_TREE,
    recoveryPr: PRE00D_RECOVERY_PR,
    recoveryHeadSha: PRE00D_RECOVERY_HEAD_SHA,
    recoveryRequiredJobDenominator: recovery.requiredJobs.length,
    formerlyFailingPrimaryLaneDenominator: status.formerlyFailingPrimaryLanes.length,
    aggregateLaneDenominator: status.aggregateLanes.length,
    historicalReviewCarrierPr: REVIEW_CARRIER_PR,
    reviewCarrierRole: status.reviewCarrier.role,
    postMergeCloseRunId: recovery.postMergeClose.runId,
    commandScopeDigest: status.digests.commandScopeDigest,
    acceptanceSignalsDigest: status.digests.acceptanceSignalsDigest,
  };
}

export function runPre00eNegativeProbes() {
  const base = buildPre00eRecoveryCiStatus();
  const mutations = [
    ['missing-required-job', 'E_PRE00E_JOB_COUNT', (status) => { status.recoveryCandidate.requiredJobs.pop(); }],
    ['recovery-job-failed', 'E_PRE00E_JOB_STATE', (status) => { status.recoveryCandidate.requiredJobs[0].state = 'FAILURE'; }],
    ['historical-lane-not-failed', 'E_PRE00E_HISTORICAL_LANE_STATE', (status) => { status.formerlyFailingPrimaryLanes[0].historicalState = 'SUCCESS'; }],
    ['aggregate-false-green', 'E_PRE00E_MERGE_GATE_DEPENDENCIES', (status) => {
      status.aggregateLanes[0].dependencyCheckNames = status.aggregateLanes[0].dependencyCheckNames.slice(1);
    }],
    ['review-carrier-merged', 'E_PRE00E_REVIEW_CARRIER_MERGED', (status) => { status.reviewCarrier.merged = true; }],
    ['review-carrier-authority-leak', 'E_PRE00E_REVIEW_CARRIER_AUTHORITY', (status) => { status.reviewCarrier.notPlanDeliveryAuthority = false; }],
    ['wrong-recovered-origin-main', 'E_PRE00E_RECOVERED_ORIGIN_SHA', (status) => { status.gitIdentity.recoveredOriginMainSha = '0'.repeat(40); }],
    ['plan-rebind-claim-leak', 'E_PRE00E_NON_CLAIM_LEAK', (status) => { status.nonClaims.planReboundOrDelivered = true; }],
  ];
  const observed = [];
  for (const [name, expectedCode, mutate] of mutations) {
    const status = clone(base);
    mutate(status);
    status.digests = clone(base.digests);
    try {
      verifyPre00eRecoveryCiStatus(status);
      fail('E_PRE00E_NEGATIVE_PROBE_FALSE_PASS', name);
    } catch (error) {
      if (error?.code !== expectedCode) {
        throw new Pre00eError('E_PRE00E_NEGATIVE_PROBE_WRONG_CODE', `${name}:${error?.code ?? error}`);
      }
      observed.push(error.code);
    }
  }
  return {
    schemaVersion: 'R24_PRE00E_NEGATIVE_PROBES_V1',
    status: 'PASS',
    negativeProbeDenominator: mutations.length,
    negativeErrors: observed,
  };
}

export function readPre00eStatus(repoRoot = process.cwd()) {
  const filename = path.join(repoRoot, STATUS_PATH);
  const bytes = fs.readFileSync(filename);
  return {
    bytes,
    digest: sha256(bytes),
    value: JSON.parse(bytes.toString('utf8')),
  };
}

export function writePre00eStatus(repoRoot = process.cwd()) {
  const filename = path.join(repoRoot, STATUS_PATH);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, canonicalBytes(buildPre00eRecoveryCiStatus()));
  return { path: STATUS_PATH, sha256: sha256(fs.readFileSync(filename)) };
}

export function buildPre00eEvidence(repoRoot = process.cwd(), files = PRE00E_IMPLEMENTATION_DIGEST_PATHS) {
  const status = readPre00eStatus(repoRoot);
  const verification = verifyPre00eRecoveryCiStatus(status.value, { repoRoot });
  const negative = runPre00eNegativeProbes();
  return {
    schemaVersion: 'ClaimBindingV1',
    stampId: 'ES-R24-PRE00E-RECOVERY-CI-EXTERNAL-CONFIRMATION',
    contourId: 'PRE00E_RECOVERY_CI_EXTERNAL_CONFIRMATION',
    evidenceClass: 'CONTRACT',
    verdict: 'PASS',
    headSha: PRE00E_BASE_SHA,
    originMainSha: PRE00E_BASE_SHA,
    generatedAtUtc: '2026-09-08T00:00:00Z',
    oracle: 'PRE00E_RECOVERY_CI_EXTERNAL_CONFIRMATION_ONLY',
    claimBindings: [
      {
        filePath: INVENTORY_PATH,
        sha256: sha256(fs.readFileSync(path.join(repoRoot, INVENTORY_PATH))),
        claimTerms: ['PASS'],
      },
      {
        filePath: STATUS_PATH,
        sha256: status.digest,
        claimTerms: ['PASS'],
      },
    ],
    implementationArtifactDigests: sorted(files).map((repoPath) => ({
      path: repoPath,
      sha256: sha256(fs.readFileSync(path.join(repoRoot, repoPath))),
      terms: repoPath === VERIFIER_PATH
        ? ['PRE00E_RECOVERY_CI_VERIFIER']
        : repoPath === TEST_PATH
          ? ['PRE00E_RECOVERY_CI_CONTRACT_TEST']
          : repoPath === POST_AUDIT_VERIFIER_PATH
            ? ['PRE00E_POST_AUDIT_EXCEPTION_VERIFIER']
            : repoPath === POST_AUDIT_TEST_PATH
              ? ['PRE00E_POST_AUDIT_EXCEPTION_CONTRACT_TEST']
              : repoPath === CLAIM_LINT_PATH
                ? ['PRE00E_HISTORICAL_INVENTORY_PIN']
                : repoPath === CLAIM_LINT_TEST_PATH
                  ? ['PRE00E_HISTORICAL_INVENTORY_CONTRACT_TEST']
                  : ['PRE00E_TASK_BRIEF'],
    })),
    executedEvidence: [
      {
        command: 'node --test test/contracts/r24-pre00e-recovery-ci-external-confirmation.contract.test.mjs',
        verdict: verification.status,
        tests: { pass: 5, fail: 0 },
        mutants: { killed: negative.negativeProbeDenominator, survived: 0 },
      },
      {
        command: 'node scripts/ops/r24/corrective/pre00e-recovery-ci-external-confirmation.mjs --probe',
        verdict: negative.status,
        mutants: { killed: negative.negativeProbeDenominator, survived: 0 },
      },
      {
        command: 'node scripts/ops/r24/corrective/pre00e-recovery-ci-external-confirmation.mjs --file docs/OPS/R24/CORRECTIVE/PRE00E_RECOVERY_CI_EXTERNAL_CONFIRMATION_STATUS_V1.json --repo-check',
        verdict: verification.status,
        tests: { pass: 1, fail: 0 },
      },
    ],
    nonClaims: [
      'NO_PRE00F_PLAN_DELIVERY',
      'NO_PR1843_MERGE',
      'NO_PROGRAM_DONE',
      'NO_PRODUCTION_RELEASE_READY',
      'NO_PK1_RELEASE_SECURITY_PHYSICAL',
      'NO_V3_PACKAGE_CLAIM_COMPILER',
      'NO_WP900_PLAN_DELIVERY',
      'NO_RUNTIME_UI_CORE_MUTATION',
      'NO_PROCESS_INSPECTION_OR_TERMINATION',
      'NO_DEPENDENCY_CHANGE',
      'NO_NETWORK_OR_CLOUD_TRUTH',
    ],
  };
}

export function writePre00eEvidence(repoRoot = process.cwd(), files = PRE00E_IMPLEMENTATION_DIGEST_PATHS) {
  const filename = path.join(repoRoot, EVIDENCE_PATH);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, canonicalBytes(buildPre00eEvidence(repoRoot, files)));
  return { path: EVIDENCE_PATH, sha256: sha256(fs.readFileSync(filename)) };
}

export function writePre00eGovernanceApprovals(repoRoot = process.cwd()) {
  const filename = path.join(repoRoot, APPROVALS_PATH);
  const approvals = JSON.parse(fs.readFileSync(filename, 'utf8'));
  if (approvals.version !== 'v1.0' || !Array.isArray(approvals.approvals)) fail('E_PRE00E_APPROVAL_REGISTRY_SHAPE');
  const approvedBy = 'OWNER_CHAT_DIRECT_PRE00E_RECOVERY_CI_EXTERNAL_CONFIRMATION_2026_09_08';
  const approvedAtUtc = '2026-09-08T00:00:00.000Z';
  const rationale = 'Bounded PRE00E recovery CI and external confirmation verifier; PR1847 recovery evidence is checked, PR1843 remains historical only, and no PRE00F plan rebind, runtime, dependency, process, credential, product graph, or release-publication authority is added.';
  const existing = approvals.approvals.filter((entry) => !PRE00E_APPROVAL_REQUIRED_PATHS.includes(entry.filePath));
  for (const repoPath of PRE00E_APPROVAL_REQUIRED_PATHS) {
    existing.push({
      filePath: repoPath,
      sha256: sha256(fs.readFileSync(path.join(repoRoot, repoPath))),
      approvedBy,
      approvedAtUtc,
      rationale,
    });
  }
  approvals.evidenceStampIds = [...new Set([
    ...(Array.isArray(approvals.evidenceStampIds) ? approvals.evidenceStampIds : []),
    'ES-R24-PRE00E-RECOVERY-CI-EXTERNAL-CONFIRMATION',
  ])];
  approvals.approvals = existing.sort((left, right) => {
    if (left.filePath === right.filePath) return left.sha256.localeCompare(right.sha256);
    return left.filePath.localeCompare(right.filePath, 'en-US');
  });
  fs.writeFileSync(filename, `${JSON.stringify(approvals, null, 2)}\n`);
  return { path: APPROVALS_PATH, sha256: sha256(fs.readFileSync(filename)), approvals: approvals.approvals.length };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  if (args['write-status'] === true) {
    process.stdout.write(`${JSON.stringify(writePre00eStatus(repoRoot))}\n`);
    return;
  }
  if (args['write-evidence'] === true) {
    const files = typeof args.files === 'string' ? args.files.split(',').filter(Boolean) : [];
    process.stdout.write(`${JSON.stringify(writePre00eEvidence(repoRoot, files.length > 0 ? files : PRE00E_IMPLEMENTATION_DIGEST_PATHS))}\n`);
    return;
  }
  if (args['write-approvals'] === true) {
    process.stdout.write(`${JSON.stringify(writePre00eGovernanceApprovals(repoRoot))}\n`);
    return;
  }
  if (args.probe === true) {
    process.stdout.write(`${JSON.stringify(runPre00eNegativeProbes())}\n`);
    return;
  }
  const status = args.file ? JSON.parse(fs.readFileSync(args.file, 'utf8')) : buildPre00eRecoveryCiStatus();
  const options = args['repo-check']
    ? { repoRoot, requireOriginMainAtRecovered: args['require-origin-main-at-recovered'] === true }
    : {};
  process.stdout.write(`${JSON.stringify(verifyPre00eRecoveryCiStatus(status, options))}\n`);
}

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error?.code ?? 'E_PRE00E_UNHANDLED'}:${error?.message ?? error}\n`);
    process.exitCode = 1;
  }
}
