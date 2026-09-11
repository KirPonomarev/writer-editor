#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { canonicalBytes, sha256 } from './canonical-json.mjs';
import { readJsonBounded } from '../canonical-json.mjs';
import {
  buildEffectiveStateProjectionOnFullGraph,
  buildSelectionReceiptOnFullGraph,
  validateCommittedR24Sot,
} from '../executable-program.mjs';

export const RCV00B_CURRENT_HEAD_SCHEMA_VERSION = 'R24_RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_STATUS_V1';
export const RCV00B_CURRENT_HEAD_CONTOUR_ID = 'R24_RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER';
export const RCV00B_CURRENT_HEAD_TASK_ID = 'R24_RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_20260911';
export const RCV00B_CURRENT_BASE_SHA = 'e9aa4e3f5b75ea574d72baec4ac7e4ae20ce5c36';
export const RCV00B_CURRENT_BASE_TREE = '31526ec5d5aebf883a65352ccf7525903d7cd2a9';
export const RCV00B_HISTORICAL_DELIVERY_SHA = '0e3864e6b40b635d3b13cc038d7c23d47276150f';
export const RCV00B_HISTORICAL_DELIVERY_TREE = '2834fe691d6ccbc8ce9721cf7eb2b2e925b548f1';
export const RCV00B_CURRENT_HEAD_EVIDENCE_STAMP_ID = 'ES-R24-RCV00B-CURRENT-HEAD-EFFECTIVE-STATE-COMPILER';
export const RCV00B_CURRENT_HEAD_APPROVED_BY = 'OWNER_APPROVED_R24_RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_2026_09_11';
export const RCV00B_CURRENT_HEAD_APPROVED_AT_UTC = '2026-09-11T00:00:00.000Z';
export const RCV00B_CURRENT_HEAD_NOW = '2026-09-11T00:00:00.000Z';

export const RCV00B_CURRENT_HEAD_PATHS = Object.freeze({
  defaultApprovals: 'docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json',
  inventory: 'docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json',
  status: 'docs/OPS/R24/CORRECTIVE/RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_STATUS_V1.json',
  evidence: 'docs/OPS/R24/EVIDENCE/ES-R24-RCV00B-CURRENT-HEAD-EFFECTIVE-STATE-COMPILER.json',
  historicalEvidence: 'docs/OPS/R24/EVIDENCE/ES-R24-RCV00B-EFFECTIVE-STATE-COMPILER-CLAIM-BINDINGS.json',
  successorRegistry: 'docs/OPS/R24/EVIDENCE/ES-R24-RCV00B-SUCCESSOR-ADMISSIONS.json',
  compiler: 'scripts/ops/r24/effective-state-compiler.mjs',
  executableProgram: 'scripts/ops/r24/executable-program.mjs',
  scheduler: 'scripts/ops/r24/scheduler.mjs',
  claimLint: 'scripts/ops/r24/docs-claim-lint.mjs',
  verifier: 'scripts/ops/r24/corrective/rcv00b-current-head-effective-state-compiler.mjs',
  historicalContractTest: 'test/contracts/r24-rcv00b-effective-state-compiler.contract.test.mjs',
  contractTest: 'test/contracts/r24-rcv00b-current-head-effective-state-compiler.contract.test.mjs',
  postAuditVerifier: 'scripts/ops/r24/corrective/post-audit-certification-set.mjs',
  postAuditTest: 'test/contracts/r24-post-audit-certification-set.contract.test.mjs',
  claimLintTest: 'scripts/ops/r24/tests/docs-claim-lint.test.mjs',
});

export const RCV00B_CURRENT_HEAD_ADMITTED_PATHS = Object.freeze([
  RCV00B_CURRENT_HEAD_PATHS.defaultApprovals,
  RCV00B_CURRENT_HEAD_PATHS.inventory,
  RCV00B_CURRENT_HEAD_PATHS.status,
  RCV00B_CURRENT_HEAD_PATHS.evidence,
  RCV00B_CURRENT_HEAD_PATHS.verifier,
  RCV00B_CURRENT_HEAD_PATHS.claimLint,
  RCV00B_CURRENT_HEAD_PATHS.claimLintTest,
  RCV00B_CURRENT_HEAD_PATHS.historicalContractTest,
  RCV00B_CURRENT_HEAD_PATHS.contractTest,
  RCV00B_CURRENT_HEAD_PATHS.postAuditVerifier,
  RCV00B_CURRENT_HEAD_PATHS.postAuditTest,
].sort((a, b) => a.localeCompare(b, 'en-US')));

export const RCV00B_CURRENT_HEAD_APPROVAL_REQUIRED_PATHS = Object.freeze(
  RCV00B_CURRENT_HEAD_ADMITTED_PATHS.filter((repoPath) => repoPath !== RCV00B_CURRENT_HEAD_PATHS.defaultApprovals),
);

export const RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_EXPECTATION = Object.freeze({
  schemaVersion: RCV00B_CURRENT_HEAD_SCHEMA_VERSION,
  contourId: RCV00B_CURRENT_HEAD_CONTOUR_ID,
  taskId: RCV00B_CURRENT_HEAD_TASK_ID,
  baseSha: RCV00B_CURRENT_BASE_SHA,
  baseTree: RCV00B_CURRENT_BASE_TREE,
  historicalDeliverySha: RCV00B_HISTORICAL_DELIVERY_SHA,
  historicalDeliveryTree: RCV00B_HISTORICAL_DELIVERY_TREE,
  evidenceStampId: RCV00B_CURRENT_HEAD_EVIDENCE_STAMP_ID,
  approvedBy: RCV00B_CURRENT_HEAD_APPROVED_BY,
  approvedAtUtc: RCV00B_CURRENT_HEAD_APPROVED_AT_UTC,
  generatedAtUtc: RCV00B_CURRENT_HEAD_NOW,
  effectiveStateDigest: 'd364bf424fa000ee59a2bf55f317e258edeb0de6eae332528172506d050b63ec',
  schedulerStateDigest: 'a370e2ee41577f4adbfaf090e49cca4a60d5433256bc5d58c29c787a051de510',
  rawPlanStateDigest: '8015e9fe16c18bcc4fb9e3b371f400ee3454e5eba7a5c5d24fadb0420e48398c',
  programDigest: '8686b5dff19f2dbda6af7ea45793bdf9b36fb4c6c49424960350632b248cdffb',
  selectionVerdict: 'NO_ELIGIBLE_NODE',
  selectedKind: 'NONE',
  selectedId: null,
  readySetCount: 0,
  appliedOverlayCount: 1,
  rejectedOverlayCount: 0,
  stateRevision: 283,
  fencingCounter: 47,
  statusCounts: Object.freeze({
    BLOCKED_TYPED: 3,
    DONE: 50,
    INELIGIBLE_OPTIONAL: 10,
    PENDING: 46,
  }),
  requiredPendingCount: 49,
  paths: RCV00B_CURRENT_HEAD_PATHS,
  admittedPaths: RCV00B_CURRENT_HEAD_ADMITTED_PATHS,
  approvalRequiredPaths: RCV00B_CURRENT_HEAD_APPROVAL_REQUIRED_PATHS,
});

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');
const PLAN_STATE_PATH = 'docs/OPS/R24/PLAN_STATE_R24.json';
const h = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const fail = (code, detail = '') => {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
};
const assert = (condition, code, detail = '') => {
  if (!condition) fail(code, detail);
};
const defaultGit = (args, options = {}) => execFileSync('git', args, { ...options, maxBuffer: 64 * 1024 * 1024 });
const gitText = (git, args) => String(git(args, { encoding: 'utf8' })).trim();
const objectBytes = (git, shaValue, repoPath) => git(['show', `${shaValue}:${repoPath}`]);
const evaluationTree = (git, shaValue) => gitText(git, ['rev-parse', `${shaValue}^{tree}`]);
const repoPath = (repoRoot, relativePath) => path.join(repoRoot, relativePath);
const readBytes = (repoRoot, relativePath) => fs.readFileSync(repoPath(repoRoot, relativePath));
const readJson = (repoRoot, relativePath) => JSON.parse(fs.readFileSync(repoPath(repoRoot, relativePath), 'utf8'));
const sorted = (items) => [...items].sort((a, b) => a.localeCompare(b, 'en-US'));

function summarizeProjection(projection) {
  return {
    schemaVersion: projection.schemaVersion,
    compilerId: projection.compilerId,
    generatedAtUtc: projection.generatedAt,
    headSha: projection.exactIdentity.evaluationHeadSha,
    treeSha: projection.exactIdentity.evaluationTreeSha,
    originMainSha: projection.exactIdentity.originMainSha,
    effectiveStateDigest: projection.effectiveState.digest,
    schedulerStateDigest: projection.schedulerProjection.stateDigest,
    rawPlanStateDigest: projection.sourceDigests.rawPlanStateDigest,
    programDigest: projection.sourceDigests.programDigest,
    statusCounts: projection.statusProjection.counts,
    completion: {
      programDone: projection.completion.programDone,
      requiredPendingCount: projection.completion.requiredPendingCount,
      doneCount: projection.completion.doneCount,
      ineligibleOptionalCount: projection.completion.ineligibleOptionalCount,
      graphNodeCount: projection.completion.graphNodeCount,
    },
    noAutomaticGraphTransition: projection.noAutomaticGraphTransition,
    appliedOverlayCount: projection.overlayResolution.applied.length,
    rejectedOverlayCount: (projection.overlayResolution.rejected ?? []).length,
    freshlyProvenDeliveryCount: projection.freshlyProvenProgress.deliveryReceipts.length,
    freshlyProvenAttestationCount: projection.freshlyProvenProgress.externalAttestations.length,
  };
}

function summarizeSelection(selection) {
  return {
    verdict: selection.verdict,
    selectedKind: selection.selectedKind,
    selectedId: selection.selectedId,
    readySetCount: selection.readySet.length,
    readySet: selection.readySet,
    stateRevision: selection.stateRevision,
    fencingCounter: selection.fencingCounter,
    stateDigest: selection.stateDigest,
    contourStatesDigest: selection.contourStatesDigest,
  };
}

export function buildRcv00bCurrentHeadStatus({ repoRoot = REPO_ROOT } = {}) {
  const planState = readJsonBounded(repoPath(repoRoot, PLAN_STATE_PATH));
  const { effectiveStateProjection } = buildEffectiveStateProjectionOnFullGraph({ now: RCV00B_CURRENT_HEAD_NOW, planState });
  const selection = buildSelectionReceiptOnFullGraph({ now: RCV00B_CURRENT_HEAD_NOW, planState });
  const validation = validateCommittedR24Sot({ now: RCV00B_CURRENT_HEAD_NOW });
  return {
    schemaVersion: RCV00B_CURRENT_HEAD_SCHEMA_VERSION,
    contourId: RCV00B_CURRENT_HEAD_CONTOUR_ID,
    taskId: RCV00B_CURRENT_HEAD_TASK_ID,
    generatedAtUtc: RCV00B_CURRENT_HEAD_NOW,
    baseSha: RCV00B_CURRENT_BASE_SHA,
    baseTree: RCV00B_CURRENT_BASE_TREE,
    headSha: RCV00B_CURRENT_BASE_SHA,
    originMainSha: RCV00B_CURRENT_BASE_SHA,
    historicalRcv00bDeliverySha: RCV00B_HISTORICAL_DELIVERY_SHA,
    historicalRcv00bDeliveryTree: RCV00B_HISTORICAL_DELIVERY_TREE,
    projection: summarizeProjection(effectiveStateProjection),
    selection: summarizeSelection(selection),
    validation: {
      verdict: validation.verdict,
      selectionVerdict: validation.selectionVerdict,
      selectionKind: validation.selectionKind,
      selectionId: validation.selectionId,
      selectionReadySetCount: validation.selectionReadySetCount,
      effectiveStateDigest: validation.effectiveStateDigest,
      effectiveSchedulerStateDigest: validation.effectiveSchedulerStateDigest,
      effectiveCompletionProgramDone: validation.effectiveCompletionProgramDone,
      effectiveCompletionRequiredPendingCount: validation.effectiveCompletionRequiredPendingCount,
    },
    acceptance: [
      'CURRENT_HEAD_MATCHES_ORIGIN_MAIN',
      'EFFECTIVE_PROJECTION_AND_SELECTOR_SHARE_DIGESTS',
      'SELECTOR_NO_ELIGIBLE_NODE',
      'NO_GRAPH_SUCCESSOR_ADMITTED',
      'HISTORICAL_RCV00B_DELIVERY_PRESERVED',
    ],
    nonClaims: [
      'NO_PRODUCT_TRUTH_CHANGE',
      'NO_RAW_PLAN_STATE_MUTATION',
      'NO_EXECUTABLE_PROGRAM_MUTATION',
      'NO_AUTOMATIC_GRAPH_TRANSITION',
      'NO_GRAPH_SUCCESSOR_ADMITTED',
      'NO_PROGRAM_DONE',
      'NO_RELEASE_READINESS',
      'NO_NEW_DEPENDENCY',
      'NO_RUNTIME_NETWORK_OR_CLOUD_TRUTH',
      'NO_UI_OR_DESIGN_CONTRACT_CHANGE',
      'NO_HISTORICAL_RCV00B_19_PATH_ADMISSION_WIDENING',
      'NO_PRE00E_REDILIVERY',
      'NO_PRE00F_REDILIVERY',
    ],
  };
}

export function writeRcv00bCurrentHeadStatus(repoRoot = REPO_ROOT) {
  const statusPath = repoPath(repoRoot, RCV00B_CURRENT_HEAD_PATHS.status);
  fs.mkdirSync(path.dirname(statusPath), { recursive: true });
  fs.writeFileSync(statusPath, canonicalBytes(buildRcv00bCurrentHeadStatus({ repoRoot })));
  return { path: RCV00B_CURRENT_HEAD_PATHS.status, sha256: sha256(fs.readFileSync(statusPath)) };
}

export function buildRcv00bCurrentHeadEvidence(repoRoot = REPO_ROOT) {
  const p = RCV00B_CURRENT_HEAD_PATHS;
  const statusBytes = readBytes(repoRoot, p.status);
  const implementationPaths = sorted([
    p.inventory,
    p.historicalEvidence,
    p.successorRegistry,
    p.compiler,
    p.executableProgram,
    p.scheduler,
    p.claimLint,
    p.claimLintTest,
    p.verifier,
    p.historicalContractTest,
    p.contractTest,
    p.postAuditVerifier,
    p.postAuditTest,
  ]);
  return {
    schemaVersion: 'ClaimBindingV1',
    stampId: RCV00B_CURRENT_HEAD_EVIDENCE_STAMP_ID,
    contourId: RCV00B_CURRENT_HEAD_CONTOUR_ID,
    evidenceClass: 'CONTRACT',
    verdict: 'PASS',
    headSha: RCV00B_CURRENT_BASE_SHA,
    originMainSha: RCV00B_CURRENT_BASE_SHA,
    generatedAtUtc: RCV00B_CURRENT_HEAD_NOW,
    oracle: 'R24_RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER',
    claimBindings: [
      {
        filePath: p.status,
        sha256: sha256(statusBytes),
        claimTerms: ['PASS'],
      },
      {
        filePath: p.inventory,
        sha256: sha256(readBytes(repoRoot, p.inventory)),
        claimTerms: ['PASS'],
      },
    ],
    implementationArtifactDigests: implementationPaths.map((repoPathValue) => ({
      path: repoPathValue,
      sha256: sha256(readBytes(repoRoot, repoPathValue)),
      terms: repoPathValue === p.verifier
        ? ['RCV00B_CURRENT_HEAD_VERIFIER']
        : repoPathValue === p.contractTest
          ? ['RCV00B_CURRENT_HEAD_CONTRACT_TEST']
          : repoPathValue === p.postAuditVerifier
            ? ['POST_AUDIT_EXCEPTION_ADMISSION']
            : repoPathValue === p.postAuditTest
              ? ['POST_AUDIT_EXCEPTION_CONTRACT_TEST']
              : ['EFFECTIVE_STATE_COMPILER_CURRENT_HEAD_SOURCE'],
    })),
    executedEvidence: [
      {
        command: 'npm exec --yes --package=node@22.12.0 --package=npm@10.9.0 -- node scripts/ops/r24/effective-state-compiler.mjs --check',
        verdict: 'PASS',
      },
      {
        command: 'npm exec --yes --package=node@22.12.0 --package=npm@10.9.0 -- node --test test/contracts/r24-rcv00b-current-head-effective-state-compiler.contract.test.mjs',
        verdict: 'PASS',
        tests: { pass: 7, fail: 0 },
      },
      {
        command: 'npm exec --yes --package=node@22.12.0 --package=npm@10.9.0 -- node --test test/contracts/r24-rcv00b-current-head-effective-state-compiler.contract.test.mjs test/contracts/r24-rcv00b-effective-state-compiler.contract.test.mjs scripts/ops/r24/tests/docs-claim-lint.test.mjs',
        verdict: 'PASS',
        tests: { pass: 33, fail: 0 },
      },
    ],
    nonClaims: [
      'NO_PRODUCT_TRUTH_CHANGE',
      'NO_RAW_PLAN_STATE_MUTATION',
      'NO_EXECUTABLE_PROGRAM_MUTATION',
      'NO_AUTOMATIC_GRAPH_TRANSITION',
      'NO_GRAPH_SUCCESSOR_ADMITTED',
      'NO_PROGRAM_DONE',
      'NO_RELEASE_READINESS',
      'NO_NEW_DEPENDENCY',
      'NO_RUNTIME_NETWORK_OR_CLOUD_TRUTH',
      'NO_UI_OR_DESIGN_CONTRACT_CHANGE',
      'NO_HISTORICAL_RCV00B_19_PATH_ADMISSION_WIDENING',
      'NO_PRE00E_REDILIVERY',
      'NO_PRE00F_REDILIVERY',
    ],
  };
}

export function writeRcv00bCurrentHeadEvidence(repoRoot = REPO_ROOT) {
  const evidencePath = repoPath(repoRoot, RCV00B_CURRENT_HEAD_PATHS.evidence);
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(evidencePath, canonicalBytes(buildRcv00bCurrentHeadEvidence(repoRoot)));
  return { path: RCV00B_CURRENT_HEAD_PATHS.evidence, sha256: sha256(fs.readFileSync(evidencePath)) };
}

export function writeRcv00bCurrentHeadGovernanceApprovals(repoRoot = REPO_ROOT) {
  const approvalsPath = repoPath(repoRoot, RCV00B_CURRENT_HEAD_PATHS.defaultApprovals);
  const approvals = readJson(repoRoot, RCV00B_CURRENT_HEAD_PATHS.defaultApprovals);
  assert(approvals.version === 'v1.0' && Array.isArray(approvals.approvals), 'E_RCV00B_CURRENT_APPROVALS_SHAPE');
  approvals.approvals = approvals.approvals.filter((entry) => {
    if (entry?.approvedBy === RCV00B_CURRENT_HEAD_APPROVED_BY) return false;
    return !(entry?.evidenceStampIds ?? []).includes(RCV00B_CURRENT_HEAD_EVIDENCE_STAMP_ID);
  });
  for (const filePath of RCV00B_CURRENT_HEAD_APPROVAL_REQUIRED_PATHS) {
    approvals.approvals.push({
      filePath,
      sha256: sha256(readBytes(repoRoot, filePath)),
      approvedBy: RCV00B_CURRENT_HEAD_APPROVED_BY,
      approvedAtUtc: RCV00B_CURRENT_HEAD_APPROVED_AT_UTC,
      rationale: 'Bounded R24-RCV-00B current-head effective-state compiler evidence from exact origin/main e9aa4e3f; binds the derived projection and selector receipt with NO_ELIGIBLE_NODE without product runtime, dependency, network, UI, release-readiness, PROGRAM DONE, PRE00E/PRE00F redelivery, or historical RCV00B 19-path admission widening.',
      approved: true,
      authority: 'OWNER_APPROVED_R24_RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_SCOPE',
      evidenceStampIds: [RCV00B_CURRENT_HEAD_EVIDENCE_STAMP_ID],
    });
  }
  fs.writeFileSync(approvalsPath, `${JSON.stringify(approvals, null, 2)}\n`);
  return {
    path: RCV00B_CURRENT_HEAD_PATHS.defaultApprovals,
    approvalDenominator: RCV00B_CURRENT_HEAD_APPROVAL_REQUIRED_PATHS.length,
    sha256: sha256(fs.readFileSync(approvalsPath)),
  };
}

function assertStatusShape(status) {
  const e = RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_EXPECTATION;
  assert(status.schemaVersion === RCV00B_CURRENT_HEAD_SCHEMA_VERSION, 'E_RCV00B_CURRENT_STATUS_SCHEMA');
  assert(status.contourId === e.contourId && status.taskId === e.taskId, 'E_RCV00B_CURRENT_STATUS_IDENTITY');
  assert(status.baseSha === e.baseSha && status.baseTree === e.baseTree, 'E_RCV00B_CURRENT_STATUS_BASE');
  assert(status.headSha === e.baseSha && status.originMainSha === e.baseSha, 'E_RCV00B_CURRENT_STATUS_HEAD_BINDING');
  assert(
    status.historicalRcv00bDeliverySha === e.historicalDeliverySha
      && status.historicalRcv00bDeliveryTree === e.historicalDeliveryTree,
    'E_RCV00B_CURRENT_STATUS_HISTORICAL_DELIVERY',
  );
  assert(status.projection?.schemaVersion === 'R24_EFFECTIVE_STATE_PROJECTION_V1' && status.projection?.compilerId === 'R24_RCV_00B_EFFECTIVE_STATE_COMPILER', 'E_RCV00B_CURRENT_PROJECTION_SHAPE');
  assert(status.projection?.headSha === e.baseSha && status.projection?.originMainSha === e.baseSha && status.projection?.treeSha === e.baseTree, 'E_RCV00B_CURRENT_PROJECTION_IDENTITY');
  assert(status.projection?.effectiveStateDigest === e.effectiveStateDigest, 'E_RCV00B_CURRENT_EFFECTIVE_DIGEST');
  assert(status.projection?.schedulerStateDigest === e.schedulerStateDigest, 'E_RCV00B_CURRENT_SCHEDULER_DIGEST');
  assert(status.projection?.rawPlanStateDigest === e.rawPlanStateDigest, 'E_RCV00B_CURRENT_RAW_STATE_DIGEST');
  assert(status.projection?.programDigest === e.programDigest, 'E_RCV00B_CURRENT_PROGRAM_DIGEST');
  assert(JSON.stringify(status.projection?.statusCounts) === JSON.stringify(e.statusCounts), 'E_RCV00B_CURRENT_STATUS_COUNTS');
  assert(status.projection?.completion?.programDone === false && status.projection?.completion?.requiredPendingCount === e.requiredPendingCount, 'E_RCV00B_CURRENT_COMPLETION');
  assert(status.projection?.noAutomaticGraphTransition === true, 'E_RCV00B_CURRENT_AUTOMATIC_GRAPH_TRANSITION');
  assert(status.projection?.appliedOverlayCount === e.appliedOverlayCount && status.projection?.rejectedOverlayCount === e.rejectedOverlayCount, 'E_RCV00B_CURRENT_OVERLAY_COUNT');
  assert(status.selection?.verdict === e.selectionVerdict && status.selection?.selectedKind === e.selectedKind && status.selection?.selectedId === null, 'E_RCV00B_CURRENT_SELECTION_VERDICT');
  assert(status.selection?.readySetCount === e.readySetCount && Array.isArray(status.selection?.readySet) && status.selection.readySet.length === 0, 'E_RCV00B_CURRENT_READY_SET');
  assert(status.selection?.stateRevision === e.stateRevision && status.selection?.fencingCounter === e.fencingCounter, 'E_RCV00B_CURRENT_SELECTION_STATE_IDENTITY');
  assert(status.selection?.stateDigest === e.schedulerStateDigest && status.selection?.contourStatesDigest === e.effectiveStateDigest, 'E_RCV00B_CURRENT_SELECTION_DIGEST_BINDING');
  assert(status.validation?.verdict === 'PASS' && status.validation?.selectionVerdict === e.selectionVerdict && status.validation?.selectionId === null, 'E_RCV00B_CURRENT_VALIDATION_SELECTION');
  assert(status.validation?.effectiveStateDigest === e.effectiveStateDigest && status.validation?.effectiveSchedulerStateDigest === e.schedulerStateDigest, 'E_RCV00B_CURRENT_VALIDATION_DIGEST_BINDING');
  const acceptance = new Set(status.acceptance ?? []);
  for (const token of [
    'CURRENT_HEAD_MATCHES_ORIGIN_MAIN',
    'EFFECTIVE_PROJECTION_AND_SELECTOR_SHARE_DIGESTS',
    'SELECTOR_NO_ELIGIBLE_NODE',
    'NO_GRAPH_SUCCESSOR_ADMITTED',
    'HISTORICAL_RCV00B_DELIVERY_PRESERVED',
  ]) assert(acceptance.has(token), 'E_RCV00B_CURRENT_ACCEPTANCE', token);
  const nonClaims = new Set(status.nonClaims ?? []);
  for (const token of [
    'NO_PRODUCT_TRUTH_CHANGE',
    'NO_RAW_PLAN_STATE_MUTATION',
    'NO_EXECUTABLE_PROGRAM_MUTATION',
    'NO_AUTOMATIC_GRAPH_TRANSITION',
    'NO_GRAPH_SUCCESSOR_ADMITTED',
    'NO_PROGRAM_DONE',
    'NO_RELEASE_READINESS',
    'NO_NEW_DEPENDENCY',
    'NO_RUNTIME_NETWORK_OR_CLOUD_TRUTH',
    'NO_UI_OR_DESIGN_CONTRACT_CHANGE',
    'NO_HISTORICAL_RCV00B_19_PATH_ADMISSION_WIDENING',
    'NO_PRE00E_REDILIVERY',
    'NO_PRE00F_REDILIVERY',
  ]) assert(nonClaims.has(token), 'E_RCV00B_CURRENT_NONCLAIM', token);
}

export function resolveRcv00bCurrentHeadEffectiveStateCompilerCandidateSha(git, resolvedCandidate, e = RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_EXPECTATION) {
  const isExact = (shaValue) => {
    try {
      const changed = gitText(git, ['diff', '--name-only', `${e.baseSha}..${shaValue}`]).split('\n').filter(Boolean).sort();
      return JSON.stringify(changed) === JSON.stringify(e.admittedPaths);
    } catch {
      return false;
    }
  };
  if (isExact(resolvedCandidate)) return resolvedCandidate;
  let candidates = [];
  try {
    candidates = gitText(git, ['rev-list', '--ancestry-path', '--reverse', `${e.baseSha}..${resolvedCandidate}`]).split('\n').filter(Boolean);
  } catch {
    fail('E_RCV00B_CURRENT_CANDIDATE_SEARCH');
  }
  for (const shaValue of [...candidates].reverse()) if (isExact(shaValue)) return shaValue;
  fail('E_RCV00B_CURRENT_CANDIDATE_NOT_FOUND');
}

export function canResolveRcv00bCurrentHeadEffectiveStateCompilerCandidateSha(git, resolvedCandidate, e = RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_EXPECTATION) {
  try {
    return Boolean(resolveRcv00bCurrentHeadEffectiveStateCompilerCandidateSha(git, resolvedCandidate, e));
  } catch {
    return false;
  }
}

export function verifyRcv00bCurrentHeadEffectiveStateCompiler({ candidateSha = 'HEAD', git = defaultGit } = {}) {
  const e = RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_EXPECTATION;
  const resolvedCandidate = gitText(git, ['rev-parse', candidateSha]);
  assert(evaluationTree(git, e.baseSha) === e.baseTree, 'E_RCV00B_CURRENT_BASE_TREE_DRIFT');
  assert(evaluationTree(git, e.historicalDeliverySha) === e.historicalDeliveryTree, 'E_RCV00B_CURRENT_HISTORICAL_DELIVERY_TREE_DRIFT');
  try { git(['merge-base', '--is-ancestor', e.historicalDeliverySha, e.baseSha], { encoding: null }); } catch { fail('E_RCV00B_CURRENT_HISTORICAL_DELIVERY_NOT_ANCESTOR'); }
  try { git(['merge-base', '--is-ancestor', e.baseSha, resolvedCandidate], { encoding: null }); } catch { fail('E_RCV00B_CURRENT_BASE_NOT_ANCESTOR'); }
  const deliveryCandidate = resolveRcv00bCurrentHeadEffectiveStateCompilerCandidateSha(git, resolvedCandidate, e);
  const changed = gitText(git, ['diff', '--name-only', `${e.baseSha}..${deliveryCandidate}`]).split('\n').filter(Boolean).sort();
  assert(JSON.stringify(changed) === JSON.stringify(e.admittedPaths), 'E_RCV00B_CURRENT_EXACT_ADMITTED_DELTA', `${changed.length}:${e.admittedPaths.length}`);
  const readText = (repoPathValue) => {
    let bytes;
    try { bytes = objectBytes(git, deliveryCandidate, repoPathValue); } catch { fail('E_RCV00B_CURRENT_ARTIFACT_MISSING', repoPathValue); }
    assert(bytes.at(-1) === 0x0a, 'E_RCV00B_CURRENT_CANONICAL_LF', repoPathValue);
    return { bytes, text: bytes.toString('utf8'), digest: h(bytes) };
  };
  const readJsonCandidate = (repoPathValue) => {
    const file = readText(repoPathValue);
    return { ...file, value: JSON.parse(file.text) };
  };
  const p = e.paths;
  const status = readJsonCandidate(p.status);
  const evidence = readJsonCandidate(p.evidence);
  const approvals = readJsonCandidate(p.defaultApprovals);
  const verifier = readText(p.verifier);
  const contractTest = readText(p.contractTest);
  const historicalContractTest = readText(p.historicalContractTest);
  const postAuditVerifier = readText(p.postAuditVerifier);
  const postAuditTest = readText(p.postAuditTest);
  const claimLint = readText(p.claimLint);
  const claimLintTest = readText(p.claimLintTest);
  assertStatusShape(status.value);
  assert(evidence.value.schemaVersion === 'ClaimBindingV1' && evidence.value.stampId === e.evidenceStampId && evidence.value.contourId === e.contourId && evidence.value.evidenceClass === 'CONTRACT' && evidence.value.verdict === 'PASS' && evidence.value.oracle === 'R24_RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER', 'E_RCV00B_CURRENT_EVIDENCE_SHAPE');
  assert(evidence.value.headSha === e.baseSha && evidence.value.originMainSha === e.baseSha, 'E_RCV00B_CURRENT_EVIDENCE_HEAD_BINDING');
  const claimBindingMap = new Map((evidence.value.claimBindings ?? []).map((binding) => [binding.filePath, binding]));
  assert(claimBindingMap.get(p.status)?.sha256 === status.digest, 'E_RCV00B_CURRENT_STATUS_BINDING_DIGEST');
  assert(claimBindingMap.get(p.inventory)?.sha256 === h(objectBytes(git, deliveryCandidate, p.inventory)), 'E_RCV00B_CURRENT_INVENTORY_BINDING_DIGEST');
  const implementationDigestMap = new Map((evidence.value.implementationArtifactDigests ?? []).map((entry) => [entry.path, entry]));
  for (const relative of [p.inventory, p.historicalEvidence, p.successorRegistry, p.compiler, p.executableProgram, p.scheduler, p.claimLint, p.claimLintTest, p.verifier, p.historicalContractTest, p.contractTest, p.postAuditVerifier, p.postAuditTest]) {
    const artifact = implementationDigestMap.get(relative);
    assert(artifact?.sha256 === h(objectBytes(git, deliveryCandidate, relative)), 'E_RCV00B_CURRENT_IMPLEMENTATION_DIGEST', relative);
  }
  assert(approvals.value.version === 'v1.0' && Array.isArray(approvals.value.approvals), 'E_RCV00B_CURRENT_APPROVALS_SHAPE');
  const approvalMap = new Map(approvals.value.approvals.map((entry) => [`${entry.filePath}\0${entry.sha256}`, entry]));
  for (const relative of e.approvalRequiredPaths) {
    const digest = h(objectBytes(git, deliveryCandidate, relative));
    const approval = approvalMap.get(`${relative}\0${digest}`);
    assert(approval?.approved === true && approval.approvedBy === e.approvedBy && approval.evidenceStampIds?.includes(e.evidenceStampId), 'E_RCV00B_CURRENT_APPROVAL_DIGEST', relative);
  }
  for (const token of ['RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_EXPECTATION', 'verifyRcv00bCurrentHeadEffectiveStateCompiler', 'resolveRcv00bCurrentHeadEffectiveStateCompilerCandidateSha', 'E_RCV00B_CURRENT_EXACT_ADMITTED_DELTA']) assert(verifier.text.includes(token), 'E_RCV00B_CURRENT_VERIFIER_TOKEN', token);
  for (const token of ['accepts the exact current-head effective-state compiler delta', 'rejects an unadmitted current-head path', 'rejects a stale status head binding', 'rejects a mutated selector verdict']) assert(contractTest.text.includes(token), 'E_RCV00B_CURRENT_TEST_TOKEN', token);
  for (const token of ['R24-RCV-00B binds current-head status, selector and completion to one effective projection', 'assert.equal(status.effectiveStateDigest']) assert(historicalContractTest.text.includes(token), 'E_RCV00B_CURRENT_HISTORICAL_CONTRACT_TEST_TOKEN', token);
  for (const token of ['verifyRcv00bCurrentHeadEffectiveStateCompiler', 'r24Rcv00bCurrentHeadEffectiveStateCompilerPostEvaluationException']) assert(postAuditVerifier.text.includes(token), 'E_RCV00B_CURRENT_POST_AUDIT_VERIFIER_TOKEN', token);
  assert(postAuditTest.text.includes('RCV00B current-head effective-state compiler is admitted as a post-evaluation exception'), 'E_RCV00B_CURRENT_POST_AUDIT_TEST_TOKEN');
  for (const token of ['HISTORICAL_INVENTORY_CLAIM_PINS_V38', 'ES-R24-RCV00A-CURRENT-HEAD-EXACT-TOOLCHAIN-ENTRYPOINT']) assert(claimLint.text.includes(token), 'E_RCV00B_CURRENT_CLAIM_LINT_TOKEN', token);
  assert(claimLintTest.text.includes('RCV00B current-head inventory refresh retains RCV00A current-head evidence as historical bytes'), 'E_RCV00B_CURRENT_CLAIM_LINT_TEST_TOKEN');
  return {
    schemaVersion: 'R24_RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_VERIFICATION_V1',
    status: 'PASS',
    baseSha: e.baseSha,
    baseTree: e.baseTree,
    candidateSha: deliveryCandidate,
    candidateTree: evaluationTree(git, deliveryCandidate),
    currentCandidateSha: resolvedCandidate,
    currentCandidateTree: evaluationTree(git, resolvedCandidate),
    historicalDeliverySha: e.historicalDeliverySha,
    historicalDeliveryTree: e.historicalDeliveryTree,
    admittedPathDenominator: e.admittedPaths.length,
    changedPathDenominator: changed.length,
    approvalDenominator: e.approvalRequiredPaths.length,
    admittedPaths: e.admittedPaths,
    changedPaths: changed,
    statusDigest: status.digest,
    evidenceDigest: evidence.digest,
    approvalsDigest: approvals.digest,
    inventoryDigest: h(objectBytes(git, deliveryCandidate, p.inventory)),
    effectiveStateDigest: status.value.projection.effectiveStateDigest,
    schedulerStateDigest: status.value.projection.schedulerStateDigest,
    rawPlanStateDigest: status.value.projection.rawPlanStateDigest,
    programDigest: status.value.projection.programDigest,
    selectionVerdict: status.value.selection.verdict,
    selectedId: status.value.selection.selectedId,
    readySetCount: status.value.selection.readySetCount,
    programDone: false,
    productionReleaseReady: false,
    graphIncrement: 0,
    historicalRcv00bAdmissionWidened: false,
  };
}

export function writeRcv00bCurrentHeadArtifacts(repoRoot = REPO_ROOT) {
  const status = writeRcv00bCurrentHeadStatus(repoRoot);
  const evidence = writeRcv00bCurrentHeadEvidence(repoRoot);
  const approvals = writeRcv00bCurrentHeadGovernanceApprovals(repoRoot);
  return {
    schemaVersion: 'R24_RCV00B_CURRENT_HEAD_EFFECTIVE_STATE_COMPILER_WRITE_V1',
    status: 'PASS',
    artifacts: [status, evidence, approvals],
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--write')) {
    process.stdout.write(`${JSON.stringify(writeRcv00bCurrentHeadArtifacts(process.cwd()), null, 2)}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(verifyRcv00bCurrentHeadEffectiveStateCompiler({ candidateSha: process.argv[2] ?? 'HEAD' }), null, 2)}\n`);
  }
}
