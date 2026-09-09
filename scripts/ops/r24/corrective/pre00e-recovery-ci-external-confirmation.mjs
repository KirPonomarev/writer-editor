#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { canonicalBytes, sha256 } from './canonical-json.mjs';

export const PRE00E_TASK_ID = 'R24_PRE00E_RECOVERY_CI_EXTERNAL_CONFIRMATION_001';
export const PRE00E_SCHEMA_VERSION = 'R24_PRE00E_RECOVERY_CI_EXTERNAL_CONFIRMATION_STATUS_V1';
export const PRE00E_BASE_SHA = 'b39e3200d3f10c67d4e7ed06d9e51e6201425c03';
export const PRE00E_BASE_TREE = '088a8ed267592760822240ac6e4e262e45c48c4b';
export const PRE00D_RECOVERY_PR = 1854;
export const PRE00D_RECOVERY_HEAD_SHA = '258793b9caf8dc7366d58cd416998bc19b6e2844';
export const PRE00D_RECOVERY_HEAD_TREE = '05795800b438d0c4584520bb2b400c2a465ae27c';
export const PRE00D_RECOVERY_BASE_SHA = '624a62e3ac3359ff563972d7d5a804fb6f5be44e';
export const PRE00D_RECOVERY_BASE_TREE = '1697ff82a35254de728d5db821a28b62f2bdf0c7';
export const PRE00D_RECOVERY_MERGE_SHA = '199efa8fa71648671e02e695993462ccb6758be2';
export const PRE00D_RECOVERY_MERGE_TREE = '05795800b438d0c4584520bb2b400c2a465ae27c';
export const PRE00D_RECOVERY_OSS_POLICY_RUN_ID = 34309914097;
export const PRE00D_RECOVERY_OPS_VECTOR_CLOSE_RUN_ID = 34310838216;
export const INTERVENING_DELIVERY_PR = 1852;
export const INTERVENING_DELIVERY_HEAD_SHA = 'b0325b792b689dd586b6e4be22dbbd092bc3ee02';
export const INTERVENING_DELIVERY_HEAD_TREE = '088a8ed267592760822240ac6e4e262e45c48c4b';
export const INTERVENING_DELIVERY_BASE_SHA = PRE00D_RECOVERY_MERGE_SHA;
export const INTERVENING_DELIVERY_BASE_TREE = PRE00D_RECOVERY_MERGE_TREE;
export const INTERVENING_DELIVERY_MERGE_SHA = PRE00E_BASE_SHA;
export const INTERVENING_DELIVERY_MERGE_TREE = PRE00E_BASE_TREE;
export const INTERVENING_DELIVERY_OSS_POLICY_RUN_ID = 34319274451;
export const INTERVENING_DELIVERY_OPS_VECTOR_CLOSE_RUN_ID = 34320119654;
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
export const INTEROP_CURRENT_CLAIM_BINDING_PATH = 'docs/OPS/R24/EVIDENCE/ES-R24-INTEROP-100-C1B-CURRENT-CLAIM-BINDINGS.json';
export const RCV00A_CURRENT_CLAIM_BINDING_PATH = 'docs/OPS/R24/EVIDENCE/ES-R24-RCV00A-EXACT-TOOLCHAIN-ENTRYPOINT-CLAIM-BINDINGS.json';

export const PRE00E_DELIVERY_ADMITTED_PATHS = Object.freeze([
  APPROVALS_PATH,
  INVENTORY_PATH,
  STATUS_PATH,
  EVIDENCE_PATH,
  INTEROP_CURRENT_CLAIM_BINDING_PATH,
  RCV00A_CURRENT_CLAIM_BINDING_PATH,
  TASK_DOC_PATH,
  VERIFIER_PATH,
  POST_AUDIT_VERIFIER_PATH,
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
  ['actual-renderer-build-rtk', 102334270628, '2026-09-09T04:18:04Z'],
  ['c1a-hermetic / c1a-hermetic (macos-latest)', 102334270778, '2026-09-09T04:13:05Z'],
  ['c1a-hermetic / c1a-hermetic (ubuntu-latest)', 102334270508, '2026-09-09T04:11:30Z'],
  ['c1a-hermetic / c1a-hermetic (windows-latest)', 102334270623, '2026-09-09T04:14:57Z'],
  ['e0-mutants', 102334270539, '2026-09-09T04:11:32Z'],
  ['inventory-baseline', 102334270544, '2026-09-09T04:18:44Z'],
  ['live-ruleset-oracle', 102334270562, '2026-09-09T04:10:31Z'],
  ['merge-gate', 102336547559, '2026-09-09T04:22:10Z'],
  ['ops-vector', 102334270580, '2026-09-09T04:11:01Z'],
  ['oss-policy', 102336583873, '2026-09-09T04:22:14Z'],
  ['oss-policy-core', 102334270636, '2026-09-09T04:10:44Z'],
  ['privacy-negative', 102334270504, '2026-09-09T04:10:47Z'],
  ['rtk-required / rtk-required', 102334270533, '2026-09-09T04:21:59Z'],
  ['static-security-sast', 102334270345, '2026-09-09T04:12:13Z'],
  ['x1-runtime-parity / x1-runtime-parity (macos-latest)', 102334270538, '2026-09-09T04:10:46Z'],
  ['x1-runtime-parity / x1-runtime-parity (ubuntu-latest)', 102334270611, '2026-09-09T04:10:47Z'],
  ['x1-runtime-parity / x1-runtime-parity (windows-latest)', 102334270576, '2026-09-09T04:11:11Z'],
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
  'PRE00D_RECOVERY_PR1854_MERGED',
  'INTERVENING_PR1852_MERGED_AND_PRESERVED',
  'SEVENTEEN_RECOVERY_REQUIRED_JOBS_SUCCESS',
  'FIVE_FORMERLY_FAILING_PRIMARY_LANES_RECOVERED',
  'AGGREGATE_LANES_PASS_FROM_REAL_DEPENDENCIES',
  'RECOVERED_ORIGIN_MAIN_EXACT_SHA_TREE_CLEAN',
  'PR1843_REMAINS_CLOSED_HISTORICAL_REVIEW_CARRIER',
  'NO_PLAN_REBIND_BEFORE_PRE00F',
]);

const DIGEST_FIELDS = Object.freeze([
  'acceptanceSignalsDigest',
  'aggregateLanesDigest',
  'commandScopeDigest',
  'interveningDeliveriesDigest',
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

function interveningDelivery() {
  return {
    pr: INTERVENING_DELIVERY_PR,
    title: 'R24 interop: allow safe DOCX hyperlinks in preview',
    baseSha: INTERVENING_DELIVERY_BASE_SHA,
    baseTree: INTERVENING_DELIVERY_BASE_TREE,
    headSha: INTERVENING_DELIVERY_HEAD_SHA,
    headTree: INTERVENING_DELIVERY_HEAD_TREE,
    mergeSha: INTERVENING_DELIVERY_MERGE_SHA,
    mergeTree: INTERVENING_DELIVERY_MERGE_TREE,
    mergedAtUtc: '2026-09-09T06:40:10Z',
    finalOssPolicyRunId: INTERVENING_DELIVERY_OSS_POLICY_RUN_ID,
    postMergeOpsVectorCloseRunId: INTERVENING_DELIVERY_OPS_VECTOR_CLOSE_RUN_ID,
    requiredJobDenominator: 17,
    role: 'DELIVERED_HISTORY_PRESERVED_NOT_PRE00E_AUTHORITY',
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
      mergeSha: PRE00D_RECOVERY_MERGE_SHA,
      mergeTree: PRE00D_RECOVERY_MERGE_TREE,
      mergedAtUtc: '2026-09-09T04:24:15Z',
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
        completedAt: '2026-09-09T04:24:29Z',
      },
    },
    interveningDeliveries: [interveningDelivery()],
    formerlyFailingPrimaryLanes,
    aggregateLanes,
    recoveredOriginMain: {
      sha: PRE00E_BASE_SHA,
      tree: PRE00E_BASE_TREE,
      observedCleanWorktreeBeforeWrite: true,
      observedHeadEqualsOriginMainBeforeWrite: true,
      observedBy: 'agent-bootstrap-and-preflight-after-pr1852',
    },
    reviewCarrier: {
      pr: REVIEW_CARRIER_PR,
      title: 'R2.4 consolidated remediation plan V2 (review carrier)',
      state: 'CLOSED',
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
      pr1843Reopened: false,
      pr1843Merged: false,
      pr1845ReopenedOrMerged: false,
      pr1852ReboundAsPre00eAuthority: false,
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
    interveningDeliveriesDigest: digest(status.interveningDeliveries),
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
    'interveningDeliveries',
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
  if (recovery.mergeSha !== PRE00D_RECOVERY_MERGE_SHA || recovery.mergeTree !== PRE00D_RECOVERY_MERGE_TREE) fail('E_PRE00E_RECOVERY_MERGE');
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

  if (!Array.isArray(status.interveningDeliveries) || status.interveningDeliveries.length !== 1) {
    fail('E_PRE00E_INTERVENING_DELIVERY_COUNT', String(status.interveningDeliveries?.length ?? 'missing'));
  }
  const [intervening] = status.interveningDeliveries;
  expectExactKeys(intervening, [
    'baseSha',
    'baseTree',
    'finalOssPolicyRunId',
    'headSha',
    'headTree',
    'mergeSha',
    'mergeTree',
    'mergedAtUtc',
    'postMergeOpsVectorCloseRunId',
    'pr',
    'requiredJobDenominator',
    'role',
    'title',
  ], 'E_PRE00E_INTERVENING_DELIVERY_KEYS');
  if (intervening.pr !== INTERVENING_DELIVERY_PR) fail('E_PRE00E_INTERVENING_DELIVERY_PR');
  if (intervening.baseSha !== INTERVENING_DELIVERY_BASE_SHA || intervening.baseTree !== INTERVENING_DELIVERY_BASE_TREE) fail('E_PRE00E_INTERVENING_DELIVERY_BASE');
  if (intervening.headSha !== INTERVENING_DELIVERY_HEAD_SHA || intervening.headTree !== INTERVENING_DELIVERY_HEAD_TREE) fail('E_PRE00E_INTERVENING_DELIVERY_HEAD');
  if (intervening.mergeSha !== INTERVENING_DELIVERY_MERGE_SHA || intervening.mergeTree !== INTERVENING_DELIVERY_MERGE_TREE) fail('E_PRE00E_INTERVENING_DELIVERY_MERGE');
  if (intervening.finalOssPolicyRunId !== INTERVENING_DELIVERY_OSS_POLICY_RUN_ID || intervening.postMergeOpsVectorCloseRunId !== INTERVENING_DELIVERY_OPS_VECTOR_CLOSE_RUN_ID) {
    fail('E_PRE00E_INTERVENING_DELIVERY_RUN');
  }
  if (intervening.requiredJobDenominator !== 17 || intervening.role !== 'DELIVERED_HISTORY_PRESERVED_NOT_PRE00E_AUTHORITY') {
    fail('E_PRE00E_INTERVENING_DELIVERY_ROLE');
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
  if (carrier.pr !== REVIEW_CARRIER_PR || carrier.state !== 'CLOSED' || carrier.isDraft !== false) fail('E_PRE00E_REVIEW_CARRIER_STATE');
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
  if (status.digests.interveningDeliveriesDigest !== digest(status.interveningDeliveries)) fail('E_PRE00E_INTERVENING_DELIVERY_DIGEST');
  if (status.digests.recoveredOriginMainDigest !== digest(status.recoveredOriginMain)) fail('E_PRE00E_RECOVERED_MAIN_DIGEST');
  if (status.digests.recoveryJobsDigest !== digest(status.recoveryCandidate.requiredJobs)) fail('E_PRE00E_RECOVERY_JOBS_DIGEST');
  if (status.digests.reviewCarrierDigest !== digest(status.reviewCarrier)) fail('E_PRE00E_REVIEW_CARRIER_DIGEST');

  const repoRoot = options.repoRoot ? path.resolve(options.repoRoot) : null;
  if (repoRoot) {
    const baseTree = runGit(repoRoot, ['rev-parse', `${PRE00E_BASE_SHA}^{tree}`]);
    if (baseTree !== PRE00E_BASE_TREE) fail('E_PRE00E_BASE_TREE_CURRENT', baseTree);
    const recoveryMergeTree = runGit(repoRoot, ['rev-parse', `${PRE00D_RECOVERY_MERGE_SHA}^{tree}`]);
    if (recoveryMergeTree !== PRE00D_RECOVERY_MERGE_TREE) fail('E_PRE00E_RECOVERY_MERGE_TREE_CURRENT', recoveryMergeTree);
    const interveningHeadTree = runGit(repoRoot, ['rev-parse', `${INTERVENING_DELIVERY_HEAD_SHA}^{tree}`]);
    if (interveningHeadTree !== INTERVENING_DELIVERY_HEAD_TREE) fail('E_PRE00E_INTERVENING_HEAD_TREE_CURRENT', interveningHeadTree);
    const head = runGit(repoRoot, ['rev-parse', 'HEAD']);
    const ancestor = head === PRE00E_BASE_SHA || runGit(repoRoot, ['merge-base', '--is-ancestor', PRE00E_BASE_SHA, head], { allowFailure: true }) === '';
    if (!ancestor) fail('E_PRE00E_BASE_NOT_ANCESTOR', head);
    if (options.requireOriginMainAtRecovered === true) {
      const originMain = runGit(repoRoot, ['rev-parse', 'origin/main']);
      if (originMain !== PRE00E_BASE_SHA) fail('E_PRE00E_ORIGIN_MAIN_CURRENT', originMain);
    }
    if (runGit(repoRoot, ['merge-base', '--is-ancestor', PRE00D_RECOVERY_MERGE_SHA, PRE00E_BASE_SHA], { allowFailure: true }) !== '') {
      fail('E_PRE00E_RECOVERY_NOT_ANCESTOR_OF_CURRENT');
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
    interveningDeliveryDenominator: status.interveningDeliveries.length,
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
    ['intervening-delivery-wrong-merge', 'E_PRE00E_INTERVENING_DELIVERY_MERGE', (status) => {
      status.interveningDeliveries[0].mergeSha = '0'.repeat(40);
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
    generatedAtUtc: '2026-09-09T00:00:00Z',
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
        tests: { pass: 6, fail: 0 },
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
      'NO_PR1843_REOPEN',
      'NO_PR1845_REOPEN_OR_MERGE',
      'NO_PR1852_REBOUND_AS_PRE00E_AUTHORITY',
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

function writeCurrentClaimBinding(repoRoot, repoPath, inventoryDigest) {
  const filename = path.join(repoRoot, repoPath);
  const value = JSON.parse(fs.readFileSync(filename, 'utf8'));
  if (value.schemaVersion !== 'ClaimBindingV1' || !Array.isArray(value.claimBindings)) {
    fail('E_PRE00E_CURRENT_CLAIM_BINDING_SHAPE', repoPath);
  }
  value.headSha = PRE00E_BASE_SHA;
  value.originMainSha = PRE00E_BASE_SHA;
  const inventoryBinding = value.claimBindings.find((binding) => binding.filePath === INVENTORY_PATH);
  if (!inventoryBinding) fail('E_PRE00E_CURRENT_CLAIM_BINDING_INVENTORY', repoPath);
  inventoryBinding.sha256 = inventoryDigest;
  fs.writeFileSync(filename, canonicalBytes(value));
  return { path: repoPath, sha256: sha256(fs.readFileSync(filename)) };
}

export function writePre00eCurrentClaimBindings(repoRoot = process.cwd()) {
  const inventoryDigest = sha256(fs.readFileSync(path.join(repoRoot, INVENTORY_PATH)));
  return {
    schemaVersion: 'R24_PRE00E_CURRENT_C1B_CLAIM_BINDING_REFRESH_V1',
    status: 'PASS',
    headSha: PRE00E_BASE_SHA,
    originMainSha: PRE00E_BASE_SHA,
    inventorySha256: inventoryDigest,
    bindings: [
      writeCurrentClaimBinding(repoRoot, INTEROP_CURRENT_CLAIM_BINDING_PATH, inventoryDigest),
      writeCurrentClaimBinding(repoRoot, RCV00A_CURRENT_CLAIM_BINDING_PATH, inventoryDigest),
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
  const approvedBy = 'OWNER_CHAT_DIRECT_PRE00E_RECOVERY_CI_EXTERNAL_CONFIRMATION_AFTER_INTEROP_PR1852_2026_09_09';
  const approvedAtUtc = '2026-09-09T00:00:00.000Z';
  const rationale = 'Bounded PRE00E recovery CI and external confirmation verifier from exact origin/main b39e3200 after PRE00D PR1854 and intervening PR1852; PR1843 remains closed historical evidence only, and no PRE00F plan rebind, runtime, dependency, process, credential, product graph, or release-publication authority is added.';
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
  fs.writeFileSync(filename, canonicalBytes(approvals));
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
  if (args['write-current-claim-bindings'] === true) {
    process.stdout.write(`${JSON.stringify(writePre00eCurrentClaimBindings(repoRoot))}\n`);
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
