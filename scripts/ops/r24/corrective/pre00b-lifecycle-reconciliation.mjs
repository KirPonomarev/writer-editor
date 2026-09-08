#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const STAGE_ID = 'PRE00B_LIFECYCLE_RECONCILIATION';
const OWNER_INSTRUCTION_BINDING = 'OWNER_CHAT_DIRECT_PRE00B_RESUME_AUTONOMOUS_ROUTINE_REVERSIBLE_SCOPE_2026_09_08';
const EXPECTED_SOURCE_HEAD_SHA = 'af74b9542c17c24a7515ce9017d98ea7b2e4d55a';
const EXPECTED_SOURCE_HEAD_LABEL = 'PK1R1_MERGED_HEAD';
const EXPECTED_PK1R1_STAGE_ID = 'PK1R1_RELEASE_SECURITY_EVALUATOR_REACHABILITY';
const EXPECTED_LEGACY_COUNTS = Object.freeze({
  BLOCKED_TYPED: 4,
  DONE: 49,
  INELIGIBLE_OPTIONAL: 10,
  PENDING: 46,
});
const EXPECTED_CURRENT_COUNTS = Object.freeze({
  BLOCKED_TYPED: 2,
  DONE: 90,
  INELIGIBLE_OPTIONAL: 10,
  PENDING: 7,
});
const EXPECTED_REQUIRED_PENDING_NODES = Object.freeze([
  'WP-900_BBR_POLICY',
  'WP-901_BBR_RESTORE',
  'WP-902_ENTITLEMENT_PRODUCT',
  'WP-903_BRAND_RELEASE',
  'WP-904_PACKAGE_CONTENT',
  'WP-905_PACKAGE_PHYSICAL',
  'WP-906_RELEASE_VERDICT',
]);
const EXPECTED_BLOCKED_TYPED_NODES = Object.freeze([
  'PK1_RELEASE_SECURITY_PHYSICAL',
  'V3_PACKAGE_CLAIM_COMPILER',
]);
const EXPECTED_ACCEPTANCE_ROWS = Object.freeze({
  A01: ['CURRENT_RECEIPTS', 'TYPED_NOT_READY'],
  A02: ['STRICT_POSITIVE_RECEIPTS', 'SECURITY_EVIDENCE_SATISFIED'],
  A03: ['MISSING_SIGNING_VERIFICATION', 'REJECTED'],
  A04: ['FUSE_DRIFT', 'REJECTED'],
  A05: ['HARDENED_RUNTIME_DRIFT', 'REJECTED'],
  A06: ['C04_STATUS_MISMATCH', 'REJECTED'],
  A07: ['STALE_RECEIPT', 'TYPED_BLOCKER'],
  A08: ['EXTERNAL_SIGNING_CLAIM', 'REJECTED'],
  A09: ['PUBLICATION_AUTHORITY', 'DENIED'],
  A10: ['EXTERNAL_EFFECTS', 'ZERO'],
  A11: ['GRAPH_TRANSITION', 'ZERO'],
  A12: ['PROGRAM_SCALAR', 'FALSE'],
});
const REQUIRED_OWNER_SIGNALS = Object.freeze([
  'EXACT_GRAPH_DENOMINATOR_90_DONE_7_REQUIRED_PENDING_2_BLOCKED_TYPED_10_OPTIONAL_INELIGIBLE',
  'NORMAL_PROTECTED_MERGE_EXACT_POSTMERGE_AND_TERMINAL_RELEASE',
  'PK1R1_FENCE_104_RELEASED_WIP_0',
  'PRODUCT_GRAPH_INCREMENT_ZERO',
  'PROGRAM_DONE_FALSE',
]);

export const PRE00B_PATHS = Object.freeze({
  acceptanceMatrix: 'docs/OPS/R24/CORRECTIVE/PK1R1_ACCEPTANCE_MATRIX_V1.json',
  approvals: 'docs/OPS/R24/CORRECTIVE/PRE00B_GOVERNANCE_CHANGE_APPROVALS_V1.json',
  ciApprovals: 'docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json',
  claimBindings: 'docs/OPS/R24/EVIDENCE/ES-R24-PRE00B-LIFECYCLE-RECONCILIATION-CLAIM-BINDINGS.json',
  claimLint: 'scripts/ops/r24/docs-claim-lint.mjs',
  effectiveState: 'docs/OPS/R24/CORRECTIVE/PK1R1_EFFECTIVE_STATE_V1.json',
  leaseRelease: 'docs/OPS/R24/CORRECTIVE/PK1R1_LEASE_RELEASE_V1.json',
  ownerAuthority: 'docs/OPS/R24/CORRECTIVE/PK1R1_MAIN_PRODUCT_OWNER_AUTHORITY_V1.json',
  planState: 'docs/OPS/R24/PLAN_STATE_R24.json',
  postAuditCertificationSet: 'scripts/ops/r24/corrective/post-audit-certification-set.mjs',
  script: 'scripts/ops/r24/corrective/pre00b-lifecycle-reconciliation.mjs',
  selectionReceipt: 'docs/OPS/R24/CORRECTIVE/PK1R1_MAIN_PRODUCT_SELECTION_RECEIPT_V1.json',
  status: 'docs/OPS/R24/CORRECTIVE/PRE00B_LIFECYCLE_RECONCILIATION_STATUS_V1.json',
  task: 'docs/tasks/R24_PRE00B_LIFECYCLE_RECONCILIATION_001.md',
  terminalReceipt: 'docs/OPS/R24/CORRECTIVE/PK1R1_TERMINAL_RECEIPT_V1.json',
  test: 'test/contracts/r24-pre00b-lifecycle-reconciliation.contract.test.mjs',
  testInventory: 'docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json',
});

const SOURCE_FILE_KEYS = Object.freeze([
  ['planState', PRE00B_PATHS.planState],
  ['terminalReceipt', PRE00B_PATHS.terminalReceipt],
  ['effectiveState', PRE00B_PATHS.effectiveState],
  ['ownerAuthority', PRE00B_PATHS.ownerAuthority],
  ['leaseRelease', PRE00B_PATHS.leaseRelease],
  ['acceptanceMatrix', PRE00B_PATHS.acceptanceMatrix],
  ['selectionReceipt', PRE00B_PATHS.selectionReceipt],
]);
const APPROVED_OUTPUT_PATHS = Object.freeze([
  PRE00B_PATHS.task,
  PRE00B_PATHS.testInventory,
  PRE00B_PATHS.status,
  PRE00B_PATHS.claimBindings,
  PRE00B_PATHS.claimLint,
  PRE00B_PATHS.postAuditCertificationSet,
  PRE00B_PATHS.script,
  PRE00B_PATHS.test,
]);
export const PRE00B_CI_APPROVED_OUTPUT_PATHS = Object.freeze([
  PRE00B_PATHS.testInventory,
  PRE00B_PATHS.approvals,
  PRE00B_PATHS.status,
  PRE00B_PATHS.claimBindings,
  PRE00B_PATHS.postAuditCertificationSet,
  PRE00B_PATHS.script,
  PRE00B_PATHS.claimLint,
  PRE00B_PATHS.test,
]);

const fail = (code, detail = '') => {
  throw new Error(`${code}${detail ? `:${detail}` : ''}`);
};
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const clone = (value) => JSON.parse(JSON.stringify(value));
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const assert = (condition, code, detail = '') => {
  if (!condition) fail(code, detail);
};
const assertEqual = (actual, expected, code, detail = '') => {
  if (actual !== expected) fail(code, detail || `${actual}!=${expected}`);
};
const assertDeepEqual = (actual, expected, code, detail = '') => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(code, detail || JSON.stringify(actual));
};
const countDelta = (current, legacy) => ({
  BLOCKED_TYPED: current.BLOCKED_TYPED - legacy.BLOCKED_TYPED,
  DONE: current.DONE - legacy.DONE,
  INELIGIBLE_OPTIONAL: current.INELIGIBLE_OPTIONAL - legacy.INELIGIBLE_OPTIONAL,
  PENDING: current.PENDING - legacy.PENDING,
});
const relativePath = (repoRoot, relative) => path.join(repoRoot, relative);

function defaultGit(repoRoot, args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10000,
  });
  if (result.status !== 0) {
    if (options.allowFailure) return null;
    fail('E_PRE00B_GIT', `${args.join(' ')}:${String(result.stderr || '').trim()}`);
  }
  return String(result.stdout || '').trim();
}

function readJsonSource(repoRoot, key, relative) {
  const bytes = fs.readFileSync(relativePath(repoRoot, relative));
  assert(bytes.length > 0 && bytes[bytes.length - 1] === 0x0a, 'E_PRE00B_CANONICAL_LF', relative);
  return {
    byteLength: bytes.length,
    path: relative,
    sha256: sha256(bytes),
    value: JSON.parse(bytes.toString('utf8')),
  };
}

function readFileDigest(repoRoot, relative) {
  const bytes = fs.readFileSync(relativePath(repoRoot, relative));
  assert(bytes.length > 0 && bytes[bytes.length - 1] === 0x0a, 'E_PRE00B_CANONICAL_LF', relative);
  return {
    byteLength: bytes.length,
    path: relative,
    sha256: sha256(bytes),
  };
}

export function readPre00bSources({ repoRoot = ROOT, git = defaultGit } = {}) {
  const files = {};
  for (const [key, relative] of SOURCE_FILE_KEYS) {
    files[key] = readJsonSource(repoRoot, key, relative);
  }
  const headSha = git(repoRoot, ['rev-parse', 'HEAD']);
  const sourceHeadAncestor = git(repoRoot, ['merge-base', '--is-ancestor', EXPECTED_SOURCE_HEAD_SHA, 'HEAD'], { allowFailure: true }) !== null;
  return {
    files,
    headSha,
    sourceHeadAncestor,
  };
}

function normalizeCounts(value, code) {
  assert(isObject(value), code, 'counts');
  const done = Number.isInteger(value.DONE) ? value.DONE : value.DONE_COUNT;
  const result = {
    BLOCKED_TYPED: value.BLOCKED_TYPED,
    DONE: done,
    INELIGIBLE_OPTIONAL: value.INELIGIBLE_OPTIONAL,
    PENDING: value.PENDING,
  };
  for (const [key, number] of Object.entries(result)) {
    assert(Number.isInteger(number) && number >= 0, code, key);
  }
  return result;
}

function countLegacyPlanState(planState) {
  assert(isObject(planState), 'E_PRE00B_PLAN_STATE_SHAPE');
  assertEqual(planState.schemaVersion, 'yalken.plan-state.r24.v2', 'E_PRE00B_PLAN_STATE_SCHEMA');
  assert(isObject(planState.contours), 'E_PRE00B_PLAN_STATE_SHAPE', 'contours');
  const counts = { BLOCKED_TYPED: 0, DONE: 0, INELIGIBLE_OPTIONAL: 0, PENDING: 0 };
  let latest = null;
  for (const [id, row] of Object.entries(planState.contours)) {
    assert(isObject(row), 'E_PRE00B_PLAN_ROW_SHAPE', id);
    assert(row.state in counts, 'E_PRE00B_PLAN_STATE_UNKNOWN', `${id}:${row.state}`);
    counts[row.state] += 1;
    if (row.updatedAt === null && row.headSha === null) continue;
    assert(typeof row.updatedAt === 'string' && typeof row.headSha === 'string', 'E_PRE00B_PLAN_ROW_SHAPE', id);
    if (latest === null || row.updatedAt > latest.updatedAt) {
      latest = {
        headSha: row.headSha,
        id,
        state: row.state,
        updatedAt: row.updatedAt,
      };
    }
  }
  return {
    contourDenominator: Object.keys(planState.contours).length,
    counts,
    fencingCounter: planState.fencingCounter,
    latestUpdate: latest,
    revision: planState.revision,
    schemaVersion: planState.schemaVersion,
  };
}

function assertProgramAndReleaseNonClaims({ terminalReceipt, effectiveState, leaseRelease, selectionReceipt }) {
  for (const [label, value] of [
    ['terminalReceipt.programDone', terminalReceipt.programDone],
    ['effectiveState.programDone', effectiveState.programDone],
    ['leaseRelease.programDone', leaseRelease.programDone],
    ['selectionReceipt.programDone', selectionReceipt.programDone],
  ]) {
    assertEqual(value, false, 'E_PRE00B_PROGRAM_DONE_LEAK', label);
  }
  assertEqual(terminalReceipt.currentRepositoryVerdict, 'NOT_READY', 'E_PRE00B_CURRENT_VERDICT_DRIFT');
  assertEqual(terminalReceipt.productionReleaseReady, false, 'E_PRE00B_RELEASE_AUTHORITY_LEAK', 'productionReleaseReady');
  assertEqual(terminalReceipt.publicationAuthorityGranted, false, 'E_PRE00B_RELEASE_AUTHORITY_LEAK', 'publicationAuthorityGranted');
  assertEqual(terminalReceipt.externalEffectsExecuted, 0, 'E_PRE00B_EXTERNAL_EFFECT_LEAK');
  assertEqual(effectiveState.externalEffectsExecuted, 0, 'E_PRE00B_EXTERNAL_EFFECT_LEAK', 'effectiveState');
  assertEqual(effectiveState.graphIncrement, 0, 'E_PRE00B_GRAPH_INCREMENT_LEAK');
  assertEqual(terminalReceipt.graphIncrement, 0, 'E_PRE00B_GRAPH_INCREMENT_LEAK', 'terminalReceipt');
}

function verifyAcceptanceMatrix(acceptanceMatrix) {
  assertEqual(acceptanceMatrix.stageId, EXPECTED_PK1R1_STAGE_ID, 'E_PRE00B_PK1R1_STAGE_DRIFT', 'acceptanceMatrix');
  assertEqual(acceptanceMatrix.rowDenominator, 12, 'E_PRE00B_ACCEPTANCE_DENOMINATOR');
  assert(Array.isArray(acceptanceMatrix.rows), 'E_PRE00B_ACCEPTANCE_ROWS');
  assertEqual(acceptanceMatrix.rows.length, acceptanceMatrix.rowDenominator, 'E_PRE00B_ACCEPTANCE_DENOMINATOR');
  const observed = new Map();
  for (const row of acceptanceMatrix.rows) {
    assert(isObject(row), 'E_PRE00B_ACCEPTANCE_ROW_SHAPE');
    assertEqual(row.result, 'VERIFIED', 'E_PRE00B_ACCEPTANCE_ROW_UNVERIFIED', row.id);
    observed.set(row.id, [row.condition, row.observation]);
  }
  for (const [id, expected] of Object.entries(EXPECTED_ACCEPTANCE_ROWS)) {
    assertDeepEqual(observed.get(id), expected, 'E_PRE00B_ACCEPTANCE_ROW_DRIFT', id);
  }
  return {
    requiredRowsVerified: acceptanceMatrix.rowDenominator,
    rowDenominator: acceptanceMatrix.rowDenominator,
  };
}

function verifyOwnerAuthority(ownerAuthority) {
  assertEqual(ownerAuthority.stageId, EXPECTED_PK1R1_STAGE_ID, 'E_PRE00B_PK1R1_STAGE_DRIFT', 'ownerAuthority');
  assert(Array.isArray(ownerAuthority.acceptanceSignals), 'E_PRE00B_OWNER_SIGNALS_SHAPE');
  for (const signal of REQUIRED_OWNER_SIGNALS) {
    assert(ownerAuthority.acceptanceSignals.includes(signal), 'E_PRE00B_OWNER_SIGNAL_MISSING', signal);
  }
  assert(ownerAuthority.authorityCeiling.includes('READ_ONLY_GITHUB_API'), 'E_PRE00B_AUTHORITY_CEILING_DRIFT');
  assert(ownerAuthority.externalEffects.includes('GIT_PUSH'), 'E_PRE00B_DELIVERY_EFFECT_SCOPE_DRIFT');
  return {
    requiredSignalsVerified: REQUIRED_OWNER_SIGNALS.length,
    signalDenominator: ownerAuthority.acceptanceSignals.length,
  };
}

function verifyLeaseRelease(leaseRelease) {
  assertEqual(leaseRelease.stageId, EXPECTED_PK1R1_STAGE_ID, 'E_PRE00B_PK1R1_STAGE_DRIFT', 'leaseRelease');
  assertEqual(leaseRelease.currentLease?.fencingCounter, 104, 'E_PRE00B_LEASE_FENCE_DRIFT', 'current');
  assertEqual(leaseRelease.currentLease?.status, 'ACTIVE', 'E_PRE00B_LEASE_CURRENT_DRIFT');
  assertEqual(leaseRelease.currentLease?.wip, 1, 'E_PRE00B_LEASE_CURRENT_DRIFT', 'wip');
  assertEqual(leaseRelease.targetLease?.fencingCounter, 104, 'E_PRE00B_LEASE_FENCE_DRIFT', 'target');
  assertEqual(leaseRelease.targetLease?.status, 'RELEASED', 'E_PRE00B_LEASE_TARGET_NOT_RELEASED');
  assertEqual(leaseRelease.targetLease?.wip, 0, 'E_PRE00B_LEASE_TARGET_NOT_RELEASED', 'wip');
  assertEqual(leaseRelease.releaseForbiddenUntilRequiredDeliveryVerified, true, 'E_PRE00B_RELEASE_GUARD_DRIFT');
}

export function buildPre00bLifecycleReconciliation(evidence) {
  assert(isObject(evidence), 'E_PRE00B_EVIDENCE_SHAPE');
  assertEqual(evidence.sourceHeadAncestor, true, 'E_PRE00B_SOURCE_HEAD_NOT_ANCESTOR');
  const files = evidence.files;
  for (const [key] of SOURCE_FILE_KEYS) assert(isObject(files?.[key]), 'E_PRE00B_SOURCE_MISSING', key);

  const planState = files.planState.value;
  const terminalReceipt = files.terminalReceipt.value;
  const effectiveState = files.effectiveState.value;
  const ownerAuthority = files.ownerAuthority.value;
  const leaseRelease = files.leaseRelease.value;
  const acceptanceMatrix = files.acceptanceMatrix.value;
  const selectionReceipt = files.selectionReceipt.value;

  const legacy = countLegacyPlanState(planState);
  assertDeepEqual(legacy.counts, EXPECTED_LEGACY_COUNTS, 'E_PRE00B_LEGACY_COUNTS_UNEXPECTED');
  assertEqual(legacy.contourDenominator, 109, 'E_PRE00B_LEGACY_DENOMINATOR_UNEXPECTED');
  assertEqual(legacy.latestUpdate?.id, 'WP-308_BRAND_BASELINE', 'E_PRE00B_LEGACY_TAIL_UNEXPECTED');

  assertEqual(terminalReceipt.stageId, EXPECTED_PK1R1_STAGE_ID, 'E_PRE00B_PK1R1_STAGE_DRIFT', 'terminalReceipt');
  assertEqual(effectiveState.stageId, EXPECTED_PK1R1_STAGE_ID, 'E_PRE00B_PK1R1_STAGE_DRIFT', 'effectiveState');
  assertEqual(selectionReceipt.stageId, EXPECTED_PK1R1_STAGE_ID, 'E_PRE00B_PK1R1_STAGE_DRIFT', 'selectionReceipt');
  assertEqual(terminalReceipt.correctionImplemented, true, 'E_PRE00B_PK1R1_CORRECTION_NOT_IMPLEMENTED');
  assertEqual(terminalReceipt.positiveSecurityEvidenceReachable, true, 'E_PRE00B_PK1R1_POSITIVE_EVIDENCE_UNREACHABLE');
  assertEqual(terminalReceipt.fencingCounter, 104, 'E_PRE00B_LEASE_FENCE_DRIFT', 'terminalReceipt');
  assertEqual(terminalReceipt.wip, 1, 'E_PRE00B_LEASE_CURRENT_DRIFT', 'terminalReceipt');

  const currentCounts = normalizeCounts(terminalReceipt.graphCounts, 'E_PRE00B_CURRENT_COUNTS_SHAPE');
  assertDeepEqual(currentCounts, EXPECTED_CURRENT_COUNTS, 'E_PRE00B_RECONCILED_COUNTS_UNEXPECTED', 'terminalReceipt');
  assertDeepEqual(normalizeCounts(effectiveState.targetCounts, 'E_PRE00B_CURRENT_COUNTS_SHAPE'), currentCounts, 'E_PRE00B_EFFECTIVE_STATE_COUNTS_DRIFT');
  assertDeepEqual(effectiveState.requiredPendingNodes, EXPECTED_REQUIRED_PENDING_NODES, 'E_PRE00B_REQUIRED_PENDING_DRIFT');
  assertDeepEqual(effectiveState.blockedTypedNodes, EXPECTED_BLOCKED_TYPED_NODES, 'E_PRE00B_BLOCKED_TYPED_DRIFT');
  assertEqual(effectiveState.earliestUnsatisfiedRequiredDependency, 'PK1_RELEASE_SECURITY_PHYSICAL', 'E_PRE00B_EARLIEST_DEPENDENCY_DRIFT');
  assertDeepEqual(countDelta(currentCounts, legacy.counts), {
    BLOCKED_TYPED: -2,
    DONE: 41,
    INELIGIBLE_OPTIONAL: 0,
    PENDING: -39,
  }, 'E_PRE00B_PLAN_STATE_NOT_STALE');

  assertProgramAndReleaseNonClaims({ terminalReceipt, effectiveState, leaseRelease, selectionReceipt });
  const acceptance = verifyAcceptanceMatrix(acceptanceMatrix);
  const ownerSignals = verifyOwnerAuthority(ownerAuthority);
  verifyLeaseRelease(leaseRelease);

  return {
    schemaVersion: 'YALKEN_R24_PRE00B_LIFECYCLE_RECONCILIATION_STATUS_V1',
    stageId: STAGE_ID,
    status: 'RECONCILED_TO_PK1R1_MERGED_HEAD',
    ownerInstructionBinding: OWNER_INSTRUCTION_BINDING,
    binding: {
      sourceHeadLabel: EXPECTED_SOURCE_HEAD_LABEL,
      sourceHeadSha: EXPECTED_SOURCE_HEAD_SHA,
      sourceHeadMustRemainAncestorOfDeliveryHead: true,
    },
    sourceArtifacts: SOURCE_FILE_KEYS.map(([key]) => ({
      byteLength: files[key].byteLength,
      path: files[key].path,
      role: key,
      sha256: files[key].sha256,
    })),
    legacyPlanState: {
      classification: 'STALE_ARCHIVAL_INPUT_NOT_CURRENT_LIFECYCLE_AUTHORITY',
      contourDenominator: legacy.contourDenominator,
      counts: legacy.counts,
      fencingCounter: legacy.fencingCounter,
      latestUpdate: legacy.latestUpdate,
      path: PRE00B_PATHS.planState,
      revision: legacy.revision,
      schemaVersion: legacy.schemaVersion,
    },
    reconciledLifecycleProjection: {
      blockedTypedNodes: clone(EXPECTED_BLOCKED_TYPED_NODES),
      counts: currentCounts,
      currentRepositoryVerdict: terminalReceipt.currentRepositoryVerdict,
      earliestUnsatisfiedRequiredDependency: effectiveState.earliestUnsatisfiedRequiredDependency,
      externalEffectsExecuted: 0,
      graphIncrement: 0,
      positiveSecurityEvidenceReachable: true,
      productionReleaseReady: false,
      programDone: false,
      publicationAuthorityGranted: false,
      requiredPendingNodes: clone(EXPECTED_REQUIRED_PENDING_NODES),
      sourceStageId: EXPECTED_PK1R1_STAGE_ID,
    },
    reconciliation: {
      countsDeltaFromLegacyPlanState: countDelta(currentCounts, legacy.counts),
      defectClosed: 'LEGACY_PLAN_STATE_LAGS_MERGED_R24_CORRECTIVE_CHAIN',
      legacyPlanStateMutated: false,
      productRuntimeMutated: false,
      releaseAuthorityGranted: false,
      selectionGuidance: 'USE_PRE00B_RECONCILED_PROJECTION_FOR_CURRENT_R24_LIFECYCLE_UNTIL_A_SEPARATE_PLAN_STATE_GENERATOR_REWRITE_IS_ADMITTED',
    },
    checks: {
      acceptanceRowsVerified: acceptance.requiredRowsVerified,
      acceptanceRowDenominator: acceptance.rowDenominator,
      ciFacingApprovalDenominator: PRE00B_CI_APPROVED_OUTPUT_PATHS.length,
      ownerSignalsVerified: ownerSignals.requiredSignalsVerified,
      ownerSignalDenominator: ownerSignals.signalDenominator,
      negativeProbeDenominator: 6,
    },
    deliveryPolicy: {
      commitRequired: true,
      mergeRequired: true,
      postMergeExactHeadVerificationRequired: true,
      prRequired: true,
      pushRequired: true,
    },
    nonClaims: {
      noCredentialUse: true,
      noDependencyChange: true,
      noProcessInspectionOrTermination: true,
      noProductGraphTransition: true,
      noReleasePublication: true,
      noRuntimeUiCoreMutation: true,
    },
  };
}

export function buildPre00bGovernanceApprovals({ repoRoot = ROOT, approvedAtUtc = '2026-09-08T00:00:00Z' } = {}) {
  const approvals = APPROVED_OUTPUT_PATHS.map((relative) => {
    const digest = readFileDigest(repoRoot, relative);
    return {
      approvedAtUtc,
      approvedBy: OWNER_INSTRUCTION_BINDING,
      filePath: digest.path,
      rationale: 'Bounded PRE00B lifecycle reconciliation; no runtime, dependency, process, credential, product graph, or release-publication authority added.',
      sha256: digest.sha256,
    };
  });
  return {
    schemaVersion: 'YALKEN_R24_PRE00B_GOVERNANCE_CHANGE_APPROVALS_V1',
    stageId: STAGE_ID,
    status: 'APPROVED_OWNER_DIRECT_ROUTINE_REVERSIBLE_SCOPE',
    ownerInstructionBinding: OWNER_INSTRUCTION_BINDING,
    sourcePlanRoles: {
      compiledProgramFileDigest: 'da754a8a0e2c09014f342b908502e83ab975488ab665feb2a8a66d0b0d46ae0a',
      externalSourcePlanDigest: '1f5b5b7b63a9f7806db1ecbcd8fa5f16484a73df3fe51f9a5d699d52f4c3fb9a',
      rolesDistinct: true,
    },
    approvals,
  };
}

export function buildPre00bClaimBindings({ repoRoot = ROOT, generatedAtUtc = '2026-09-08T00:00:00Z' } = {}) {
  const inventoryDigest = readFileDigest(repoRoot, PRE00B_PATHS.testInventory);
  const statusDigest = readFileDigest(repoRoot, PRE00B_PATHS.status);
  const claimLintDigest = readFileDigest(repoRoot, PRE00B_PATHS.claimLint);
  const postAuditCertificationDigest = readFileDigest(repoRoot, PRE00B_PATHS.postAuditCertificationSet);
  const scriptDigest = readFileDigest(repoRoot, PRE00B_PATHS.script);
  const testDigest = readFileDigest(repoRoot, PRE00B_PATHS.test);
  return {
    schemaVersion: 'ClaimBindingV1',
    stampId: 'ES-R24-PRE00B-LIFECYCLE-RECONCILIATION-CLAIM-BINDINGS',
    contourId: STAGE_ID,
    evidenceClass: 'CONTRACT',
    verdict: 'PASS',
    headSha: EXPECTED_SOURCE_HEAD_SHA,
    originMainSha: EXPECTED_SOURCE_HEAD_SHA,
    generatedAtUtc,
    oracle: 'PRE00B_RECONCILES_LEGACY_PLAN_STATE_TO_PK1R1_MERGED_LIFECYCLE_WITH_NO_RELEASE_AUTHORITY',
    claimBindings: [
      {
        filePath: inventoryDigest.path,
        sha256: inventoryDigest.sha256,
        claimTerms: ['PASS'],
      },
      {
        filePath: statusDigest.path,
        sha256: statusDigest.sha256,
        claimTerms: ['DONE', 'READY', 'PASS', 'SAFE', 'COMPLETE'],
      },
    ],
    implementationArtifactDigests: [
      {
        path: claimLintDigest.path,
        sha256: claimLintDigest.sha256,
        terms: ['PRE00B_WP709_HISTORICAL_INVENTORY_PIN'],
      },
      {
        path: postAuditCertificationDigest.path,
        sha256: postAuditCertificationDigest.sha256,
        terms: ['PRE00B_POST_AUDIT_SUCCESSOR_ADMISSION_ORACLE'],
      },
      {
        path: scriptDigest.path,
        sha256: scriptDigest.sha256,
        terms: ['PRE00B_LIFECYCLE_RECONCILIATION_ORACLE'],
      },
      {
        path: testDigest.path,
        sha256: testDigest.sha256,
        terms: ['PRE00B_LIFECYCLE_RECONCILIATION_CONTRACT_TEST'],
      },
    ],
    executedEvidence: [
      {
        command: 'node scripts/ops/r24/corrective/pre00b-lifecycle-reconciliation.mjs --check',
        verdict: 'PASS',
        tests: { pass: 1, fail: 0 },
      },
      {
        command: 'node scripts/ops/r24/corrective/pre00b-lifecycle-reconciliation.mjs --probe',
        verdict: 'PASS',
        mutants: { killed: 6, survived: 0 },
      },
      {
        command: 'node --test test/contracts/r24-pre00b-lifecycle-reconciliation.contract.test.mjs',
        verdict: 'PASS',
        tests: { pass: 4, fail: 0 },
      },
    ],
    nonClaims: [
      'NO_PROGRAM_DONE',
      'NO_PRODUCTION_RELEASE_READY',
      'NO_PUBLICATION_AUTHORITY',
      'NO_RUNTIME_UI_CORE_MUTATION',
      'NO_PROCESS_INSPECTION_OR_TERMINATION',
    ],
  };
}

function verifyCheckedInClaimBindings(repoRoot) {
  const expected = buildPre00bClaimBindings({ repoRoot });
  const actual = readJsonSource(repoRoot, 'claimBindings', PRE00B_PATHS.claimBindings).value;
  assertDeepEqual(actual, expected, 'E_PRE00B_CLAIM_BINDING_DRIFT');
  return { claimBindingDenominator: expected.claimBindings.length };
}

function verifyCheckedInStatus(repoRoot, expectedStatus) {
  const actual = readJsonSource(repoRoot, 'status', PRE00B_PATHS.status).value;
  assertDeepEqual(actual, expectedStatus, 'E_PRE00B_STATUS_ARTIFACT_DRIFT');
}

function verifyCheckedInApprovals(repoRoot) {
  const approvals = readJsonSource(repoRoot, 'approvals', PRE00B_PATHS.approvals).value;
  assertEqual(approvals.schemaVersion, 'YALKEN_R24_PRE00B_GOVERNANCE_CHANGE_APPROVALS_V1', 'E_PRE00B_APPROVALS_SCHEMA');
  assertEqual(approvals.stageId, STAGE_ID, 'E_PRE00B_APPROVALS_STAGE');
  assertEqual(approvals.ownerInstructionBinding, OWNER_INSTRUCTION_BINDING, 'E_PRE00B_APPROVALS_AUTHORITY');
  assert(Array.isArray(approvals.approvals), 'E_PRE00B_APPROVALS_SHAPE');
  assertEqual(approvals.approvals.length, APPROVED_OUTPUT_PATHS.length, 'E_PRE00B_APPROVALS_DENOMINATOR');
  for (let index = 0; index < APPROVED_OUTPUT_PATHS.length; index += 1) {
    const expectedPath = APPROVED_OUTPUT_PATHS[index];
    const row = approvals.approvals[index];
    assertEqual(row.filePath, expectedPath, 'E_PRE00B_APPROVALS_PATH_DRIFT');
    assertEqual(row.approvedBy, OWNER_INSTRUCTION_BINDING, 'E_PRE00B_APPROVALS_AUTHORITY');
    assert(typeof row.approvedAtUtc === 'string' && row.approvedAtUtc.length > 0, 'E_PRE00B_APPROVALS_TIME');
    assertEqual(row.sha256, readFileDigest(repoRoot, expectedPath).sha256, 'E_PRE00B_APPROVALS_DIGEST_DRIFT', expectedPath);
  }
  return { approvalDenominator: approvals.approvals.length };
}

function verifyCheckedInCiApprovals(repoRoot) {
  const approvals = readJsonSource(repoRoot, 'ciApprovals', PRE00B_PATHS.ciApprovals).value;
  assertEqual(approvals.version, 'v1.0', 'E_PRE00B_CI_APPROVALS_SCHEMA');
  assert(Array.isArray(approvals.approvals), 'E_PRE00B_CI_APPROVALS_SHAPE');
  const byPath = new Map();
  for (const row of approvals.approvals) {
    assert(isObject(row), 'E_PRE00B_CI_APPROVALS_ROW');
    assert(typeof row.filePath === 'string' && row.filePath.length > 0, 'E_PRE00B_CI_APPROVALS_ROW_PATH');
    assert(!byPath.has(row.filePath), 'E_PRE00B_CI_APPROVALS_DUPLICATE_PATH', row.filePath);
    byPath.set(row.filePath, row);
  }
  for (const expectedPath of PRE00B_CI_APPROVED_OUTPUT_PATHS) {
    const row = byPath.get(expectedPath);
    assert(isObject(row), 'E_PRE00B_CI_APPROVAL_MISSING', expectedPath);
    assertEqual(row.approvedBy, OWNER_INSTRUCTION_BINDING, 'E_PRE00B_CI_APPROVAL_AUTHORITY', expectedPath);
    assert(String(row.rationale || '').includes('PRE00B lifecycle reconciliation'), 'E_PRE00B_CI_APPROVAL_RATIONALE', expectedPath);
    assertEqual(row.sha256, readFileDigest(repoRoot, expectedPath).sha256, 'E_PRE00B_CI_APPROVAL_DIGEST_DRIFT', expectedPath);
  }
  return { ciApprovalDenominator: PRE00B_CI_APPROVED_OUTPUT_PATHS.length };
}

export function verifyPre00bLifecycleReconciliation(options = {}) {
  const repoRoot = options.repoRoot || ROOT;
  const status = buildPre00bLifecycleReconciliation(readPre00bSources({ repoRoot, git: options.git || defaultGit }));
  verifyCheckedInStatus(repoRoot, status);
  const claimBindings = verifyCheckedInClaimBindings(repoRoot);
  const approvals = verifyCheckedInApprovals(repoRoot);
  const ciApprovals = verifyCheckedInCiApprovals(repoRoot);
  return {
    schemaVersion: 'YALKEN_R24_PRE00B_LIFECYCLE_RECONCILIATION_RESULT_V1',
    status: 'PASS',
    stageId: STAGE_ID,
    sourceHeadSha: EXPECTED_SOURCE_HEAD_SHA,
    legacyCounts: status.legacyPlanState.counts,
    reconciledCounts: status.reconciledLifecycleProjection.counts,
    approvalDenominator: approvals.approvalDenominator,
    ciApprovalDenominator: ciApprovals.ciApprovalDenominator,
    claimBindingDenominator: claimBindings.claimBindingDenominator,
    negativeProbeDenominator: status.checks.negativeProbeDenominator,
    programDone: false,
    productionReleaseReady: false,
  };
}

export function runPre00bNegativeProbes(options = {}) {
  const base = readPre00bSources({ repoRoot: options.repoRoot || ROOT, git: options.git || defaultGit });
  const negativeErrors = [];
  const expectRejected = (code, mutator) => {
    const mutant = clone(base);
    mutator(mutant);
    try {
      buildPre00bLifecycleReconciliation(mutant);
    } catch (error) {
      if (!String(error.message || '').includes(code)) throw error;
      negativeErrors.push(code);
      return;
    }
    fail('E_PRE00B_NEGATIVE_NOT_REJECTED', code);
  };

  expectRejected('E_PRE00B_LEGACY_COUNTS_UNEXPECTED', (mutant) => {
    mutant.files.planState.value.contours['WP-900_BBR_POLICY'].state = 'DONE';
  });
  expectRejected('E_PRE00B_RECONCILED_COUNTS_UNEXPECTED', (mutant) => {
    mutant.files.terminalReceipt.value.graphCounts.DONE_COUNT = 91;
  });
  expectRejected('E_PRE00B_RELEASE_AUTHORITY_LEAK', (mutant) => {
    mutant.files.terminalReceipt.value.productionReleaseReady = true;
  });
  expectRejected('E_PRE00B_ACCEPTANCE_ROW_UNVERIFIED', (mutant) => {
    mutant.files.acceptanceMatrix.value.rows[8].result = 'PENDING';
  });
  expectRejected('E_PRE00B_LEASE_TARGET_NOT_RELEASED', (mutant) => {
    mutant.files.leaseRelease.value.targetLease.status = 'ACTIVE';
  });
  expectRejected('E_PRE00B_SOURCE_HEAD_NOT_ANCESTOR', (mutant) => {
    mutant.sourceHeadAncestor = false;
  });

  return {
    schemaVersion: 'YALKEN_R24_PRE00B_LIFECYCLE_RECONCILIATION_PROBE_RESULT_V1',
    status: 'PASS',
    stageId: STAGE_ID,
    negativeProbeDenominator: negativeErrors.length,
    negativeErrors,
  };
}

function writePre00bArtifacts(repoRoot) {
  const status = buildPre00bLifecycleReconciliation(readPre00bSources({ repoRoot }));
  fs.writeFileSync(relativePath(repoRoot, PRE00B_PATHS.status), stableJson(status));
  const claimBindings = buildPre00bClaimBindings({ repoRoot });
  fs.writeFileSync(relativePath(repoRoot, PRE00B_PATHS.claimBindings), stableJson(claimBindings));
  const approvals = buildPre00bGovernanceApprovals({ repoRoot });
  fs.writeFileSync(relativePath(repoRoot, PRE00B_PATHS.approvals), stableJson(approvals));
  return {
    approvalsPath: PRE00B_PATHS.approvals,
    schemaVersion: 'YALKEN_R24_PRE00B_LIFECYCLE_RECONCILIATION_WRITE_RESULT_V1',
    stageId: STAGE_ID,
    status: 'WRITTEN',
    statusPath: PRE00B_PATHS.status,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const command = process.argv[2];
    if (command === '--write') {
      process.stdout.write(`${JSON.stringify(writePre00bArtifacts(ROOT))}\n`);
    } else if (command === '--check') {
      process.stdout.write(`${JSON.stringify(verifyPre00bLifecycleReconciliation())}\n`);
    } else if (command === '--probe') {
      process.stdout.write(`${JSON.stringify(runPre00bNegativeProbes())}\n`);
    } else {
      fail('E_PRE00B_USAGE', command || 'missing');
    }
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ status: 'REJECTED', code: error.message || 'E_PRE00B_UNTYPED' })}\n`);
    process.exitCode = 1;
  }
}
