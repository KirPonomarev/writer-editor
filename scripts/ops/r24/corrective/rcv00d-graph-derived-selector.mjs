#!/usr/bin/env node
// R24-RCV-00D: derive the next corrective work item from the effective graph
// state plus the corrective severity policy. This is read-only ops selection;
// it does not create or transition graph nodes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  HEX40_RE,
  HEX64_RE,
  R24Error,
  canonicalDigest,
  readJsonBounded,
  sha256hex,
} from '../canonical-json.mjs';
import {
  buildEffectiveStateProjectionOnFullGraph,
  buildSelectionReceiptOnFullGraph,
} from '../executable-program.mjs';
import {
  RCV00C_REGISTER_PATH,
  validateCorrectiveRegister,
} from './rcv00c-corrective-register.mjs';

export const RCV00D_SCHEMA_VERSION = 'R24_RCV00D_GRAPH_DERIVED_SELECTOR_V1';
export const RCV00D_SELECTOR_ID = 'R24-RCV-00D-GRAPH-DERIVED-SELECTOR';
export const RCV00D_CONTOUR_ID = 'R24_RCV_00D_GRAPH_DERIVED_SELECTOR';
export const RCV00D_PLAN_PATH = 'docs/tasks/2026-09-08--r24-consolidated-remediation-and-completion-plan.md';
export const RCV00D_PLAN_STATE_PATH = 'docs/OPS/R24/PLAN_STATE_R24.json';
export const RCV00D_REGISTER_PATH = RCV00C_REGISTER_PATH;
export const RCV00D_BASE_SHA = '18bff1711dde771d1c5e8548cef1b4735085ccdd';
export const RCV00D_BASE_TREE = 'e195f6c2e88251f845325b1706639d5fb80f88d8';
const RCV00D_HISTORICAL_RECEIPT_DIGESTS = Object.freeze([
  // Exact original delivery 0b2476fc and verifier-binding follow-up 9c85e70b.
  'f432c3683d945466e95df98bbf9d2b82d81e471ce60e1dd01c0ebcb398af706a',
  '85fe2b9ed1cce00367444ad6654e51add80c7ce8484015947b20e7a6b8e9af61',
]);
export const RCV00D_EXPECTED_GRAPH_CANDIDATE = null;
export const RCV00D_EXPECTED_GRAPH_VERDICT = 'NO_ELIGIBLE_NODE';
export const RCV00D_SELECTED_OBSERVATION_ID = 'OBS-EXPORT-DOCX-MIN-COMMAND-BRIDGE-OUTER-FAIL-20260909';
export const RCV00D_SELECTED_CONTOUR = 'R24-RCV-00D';
export const RCV00D_REQUIRED_PROOF = 'SCOPED_CONTRACT_FIX_WITH_FAILURE_AFTER_SIDE_EFFECT_AND_RETRY_COVERAGE';
export const RCV00D_REQUIRED_COVERAGE = Object.freeze([
  'FAILURE_AFTER_SIDE_EFFECT',
  'RETRY_AFTER_OUTER_COMMAND_FAILURE',
]);
export const RCV00D_FORBIDDEN_FIXES = Object.freeze([
  'GLOBAL_TRUTHY_OK_WEAKENING',
  'VISIBLE_USER_ROUTE_CLAIM_WITHOUT_EVIDENCE',
]);
export const RCV00D_DELIVERED_CONTOUR_IDS = Object.freeze([
  'R24-PRE-00C',
  'R24-PRE-00D',
  'R24-PRE-00E',
  'R24-PRE-00F',
  'R24-RCV-00A',
  'R24-RCV-00B',
  'R24-RCV-00C',
]);
export const RCV00D_NON_CLAIMS = Object.freeze([
  'NO_GRAPH_NODE_CREATION',
  'NO_GRAPH_STATE_TRANSITION',
  'NO_PRODUCT_RUNTIME_FEATURE',
  'NO_DOCX_EXPORT_SOURCE_FIX',
  'NO_PROGRAM_DONE',
  'NO_RELEASE_READINESS',
  'NO_NEW_DEPENDENCY',
  'NO_RUNTIME_NETWORK_OR_CLOUD_TRUTH',
  'NO_UI_OR_DESIGN_CONTRACT_CHANGE',
]);

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');
const SEVERITY_RANK = Object.freeze({ BLOCKER: 0, REQUIRED: 1, P1: 2, P2: 3, P3: 4 });
const STATUS_RANK = Object.freeze({ ACTIVE_CONFIRMED: 0, RECORDED_GRAPH_OPEN: 1, REVALIDATE_CURRENT: 2, DEFERRED_DEBT: 3 });
const KIND_RANK = Object.freeze({ CURRENT_OBSERVATION: 0, FINDING: 1, GRAPH_NODE: 2 });

function repoPath(repoRoot, relativePath) {
  const root = path.resolve(repoRoot);
  const absolute = path.resolve(root, relativePath);
  const rel = path.relative(root, absolute);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new R24Error('E_RCV00D_PATH_OUTSIDE_ROOT', relativePath);
  return absolute;
}

function sha256File(repoRoot, relativePath) {
  return sha256hex(fs.readFileSync(repoPath(repoRoot, relativePath)));
}

function gitText(repoRoot, args) {
  return execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' }).trim();
}

function assertArray(value, code, detail = '') {
  if (!Array.isArray(value)) throw new R24Error(code, detail);
  return value;
}

function assertObject(value, code, detail = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new R24Error(code, detail);
  return value;
}

function severityRank(severity) {
  if (!Object.hasOwn(SEVERITY_RANK, severity)) throw new R24Error('E_RCV00D_SEVERITY', String(severity));
  return SEVERITY_RANK[severity];
}

function contourRank(contourId) {
  const match = /^R24-(PRE|RCV)-00([A-Z])$/u.exec(String(contourId));
  if (!match) return 10000;
  const phaseRank = match[1] === 'PRE' ? 0 : 100;
  return phaseRank + match[2].charCodeAt(0) - 'A'.charCodeAt(0);
}

function compareKey(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] < right[index]) return -1;
    if (left[index] > right[index]) return 1;
  }
  return 0;
}

export function parseNarrativeNextStep(planText) {
  const match = /^NEXT_STEP:\s*([A-Z0-9_-]+(?:-[A-Z0-9_]+)*)/mu.exec(String(planText));
  if (!match) throw new R24Error('E_RCV00D_NARRATIVE_NEXT_STEP_MISSING');
  return match[1];
}

function assertExpectedObservationShape(observation) {
  if (observation.observationId !== RCV00D_SELECTED_OBSERVATION_ID) return;
  if (observation.primaryContourId !== RCV00D_SELECTED_CONTOUR) {
    throw new R24Error('E_RCV00D_SELECTED_CONTOUR_BINDING', String(observation.primaryContourId));
  }
  if (observation.requiredProof !== RCV00D_REQUIRED_PROOF) {
    throw new R24Error('E_RCV00D_SELECTED_REQUIRED_PROOF', String(observation.requiredProof));
  }
  const coverage = observation.successorRequirement?.requiredCoverage || [];
  for (const token of RCV00D_REQUIRED_COVERAGE) {
    if (!coverage.includes(token)) throw new R24Error('E_RCV00D_SELECTED_REQUIRED_COVERAGE', token);
  }
  const forbidden = observation.successorRequirement?.forbiddenFixes || [];
  for (const token of RCV00D_FORBIDDEN_FIXES) {
    if (!forbidden.includes(token)) throw new R24Error('E_RCV00D_SELECTED_FORBIDDEN_FIX', token);
  }
}

function selectionKey(candidate) {
  return [
    severityRank(candidate.severity),
    contourRank(candidate.contourId),
    STATUS_RANK[candidate.status] ?? 99,
    KIND_RANK[candidate.kind] ?? 99,
    candidate.id,
  ];
}

function currentObservationCandidate(observation) {
  assertObject(observation, 'E_RCV00D_CURRENT_OBSERVATION_SHAPE');
  if (observation.graphPromotionAllowed !== false || observation.mappedExistingGraphNode !== 'NO_GRAPH_NODE') {
    throw new R24Error('E_RCV00D_CURRENT_OBSERVATION_GRAPH_PROMOTION', String(observation.observationId));
  }
  assertExpectedObservationShape(observation);
  const reasons = [];
  let eligible = true;
  if (observation.status !== 'ACTIVE_CONFIRMED') {
    eligible = false;
    reasons.push('CURRENT_OBSERVATION_NOT_ACTIVE_CONFIRMED');
  }
  return {
    kind: 'CURRENT_OBSERVATION',
    id: observation.observationId,
    severity: observation.severity,
    status: observation.status,
    contourId: observation.primaryContourId,
    mappedExistingGraphNode: observation.mappedExistingGraphNode,
    graphPromotionAllowed: observation.graphPromotionAllowed,
    sourceAuditId: observation.sourceAuditId,
    requiredProof: observation.requiredProof,
    requiredCoverage: [...(observation.successorRequirement?.requiredCoverage || [])],
    forbiddenFixes: [...(observation.successorRequirement?.forbiddenFixes || [])],
    eligible,
    ineligibilityReasons: reasons,
  };
}

function findingCandidate(finding, { readySet, contourStates, deliveredContourIds }) {
  assertObject(finding, 'E_RCV00D_FINDING_SHAPE');
  if (finding.graphPromotionAllowed !== false) throw new R24Error('E_RCV00D_FINDING_GRAPH_PROMOTION', String(finding.findingId));
  const graphNodeState = finding.mappedExistingGraphNode === 'NO_GRAPH_NODE' ? null : contourStates[finding.mappedExistingGraphNode] || null;
  const candidate = {
    kind: 'FINDING',
    id: finding.findingId,
    severity: finding.severity,
    status: finding.status,
    contourId: finding.primaryContourId,
    mappedExistingGraphNode: finding.mappedExistingGraphNode,
    graphPromotionAllowed: finding.graphPromotionAllowed,
    sourceAuditId: finding.sourceAuditId,
    requiredProof: finding.requiredProof,
    graphNodeState,
    eligible: false,
    ineligibilityReasons: [],
  };
  if (deliveredContourIds.has(finding.primaryContourId)) {
    candidate.ineligibilityReasons.push('PRIMARY_CONTOUR_ALREADY_DELIVERED_ON_CURRENT_MAIN');
  } else if (finding.status === 'ACTIVE_CONFIRMED') {
    candidate.eligible = true;
  } else if (finding.status === 'RECORDED_GRAPH_OPEN') {
    if (finding.mappedExistingGraphNode === 'NO_GRAPH_NODE') throw new R24Error('E_RCV00D_RECORDED_GRAPH_OPEN_UNMAPPED', finding.findingId);
    if (readySet.has(finding.mappedExistingGraphNode)) {
      candidate.eligible = true;
    } else {
      candidate.ineligibilityReasons.push('GRAPH_NODE_NOT_READY_OR_BLOCKED');
    }
  } else if (finding.status === 'DEFERRED_DEBT') {
    candidate.eligible = true;
    candidate.ineligibilityReasons.push('DEFERRED_DEBT_LOW_PRIORITY_FALLBACK');
  } else if (finding.status === 'REVALIDATE_CURRENT') {
    candidate.ineligibilityReasons.push('REVALIDATION_REQUIRED_BEFORE_SELECTION');
  } else {
    throw new R24Error('E_RCV00D_STATUS', String(finding.status));
  }
  return candidate;
}

function assertSelectorIdentity(effective, graphReceipt, identity) {
  const expected = assertObject(identity, 'E_RCV00D_EXPECTED_IDENTITY_REQUIRED');
  for (const field of ['headSha', 'originMainSha', 'treeSha']) {
    if (!HEX40_RE.test(String(expected[field]))) throw new R24Error('E_RCV00D_EXPECTED_IDENTITY_SHAPE', field);
  }
  const actual = assertObject(effective.exactIdentity, 'E_RCV00D_EFFECTIVE_IDENTITY_REQUIRED');
  const roles = assertObject(graphReceipt.identityRoles, 'E_RCV00D_GRAPH_IDENTITY_REQUIRED');
  for (const [role, field] of [['evaluationHeadSha', 'headSha'], ['evaluationTreeSha', 'treeSha']]) {
    if (actual[role] !== expected[field] || roles[role] !== expected[field]) {
      throw new R24Error('E_RCV00D_EVALUATION_IDENTITY_BINDING', role);
    }
  }
  if (actual.originMainSha !== expected.originMainSha) throw new R24Error('E_RCV00D_ORIGIN_IDENTITY_BINDING');
  if (!HEX40_RE.test(String(actual.implementationSourceSha)) || roles.implementationSourceSha !== actual.implementationSourceSha) {
    throw new R24Error('E_RCV00D_IMPLEMENTATION_IDENTITY_BINDING');
  }
}

export function selectRcv00dCorrectiveCandidate({
  register,
  effectiveStateProjection,
  graphSelectionReceipt,
  identity,
  deliveredContourIds = RCV00D_DELIVERED_CONTOUR_IDS,
} = {}) {
  const validatedRegister = assertObject(register, 'E_RCV00D_REGISTER_REQUIRED');
  const effective = assertObject(effectiveStateProjection, 'E_RCV00D_EFFECTIVE_STATE_REQUIRED');
  const graphReceipt = assertObject(graphSelectionReceipt, 'E_RCV00D_GRAPH_RECEIPT_REQUIRED');
  if (effective.schemaVersion !== 'R24_EFFECTIVE_STATE_PROJECTION_V1') throw new R24Error('E_RCV00D_EFFECTIVE_STATE_SCHEMA');
  if (graphReceipt.schemaVersion !== 'SelectionReceiptR2_4') throw new R24Error('E_RCV00D_GRAPH_RECEIPT_SCHEMA');
  assertSelectorIdentity(effective, graphReceipt, identity);
  if (!HEX64_RE.test(String(graphReceipt.stateDigest)) || graphReceipt.stateDigest !== effective.schedulerProjection?.stateDigest) {
    throw new R24Error('E_RCV00D_GRAPH_RECEIPT_STATE_BINDING');
  }
  if (!HEX64_RE.test(String(graphReceipt.contourStatesDigest)) || graphReceipt.contourStatesDigest !== effective.schedulerProjection?.contourStatesDigest) {
    throw new R24Error('E_RCV00D_GRAPH_RECEIPT_CONTOUR_BINDING');
  }
  if (
    graphReceipt.selectedKind !== 'NONE'
    || graphReceipt.selectedId !== RCV00D_EXPECTED_GRAPH_CANDIDATE
    || graphReceipt.verdict !== RCV00D_EXPECTED_GRAPH_VERDICT
  ) {
    throw new R24Error('E_RCV00D_GRAPH_CANDIDATE_BINDING', String(graphReceipt.selectedId));
  }

  const readySet = new Set(assertArray(graphReceipt.readySet, 'E_RCV00D_READY_SET'));
  const contourStates = effective.schedulerProjection?.contourStates || {};
  const delivered = new Set(deliveredContourIds);
  const candidates = [
    ...assertArray(validatedRegister.currentObservations, 'E_RCV00D_CURRENT_OBSERVATIONS').map(currentObservationCandidate),
    ...assertArray(validatedRegister.findings, 'E_RCV00D_FINDINGS').map((finding) => findingCandidate(finding, { readySet, contourStates, deliveredContourIds: delivered })),
  ];
  const eligible = candidates
    .filter((candidate) => candidate.eligible)
    .sort((left, right) => compareKey(selectionKey(left), selectionKey(right)));
  if (eligible.length === 0) throw new R24Error('E_RCV00D_NO_ELIGIBLE_CORRECTIVE_ITEM');
  const selected = eligible[0];
  if (selected.kind !== 'CURRENT_OBSERVATION' || selected.id !== RCV00D_SELECTED_OBSERVATION_ID || selected.contourId !== RCV00D_SELECTED_CONTOUR) {
    throw new R24Error('E_RCV00D_SELECTED_ITEM_BINDING', `${selected.kind}:${selected.id}:${selected.contourId}`);
  }
  return {
    selected,
    eligibleCandidates: eligible,
    candidates,
    selectedCount: 1,
    candidateSetDigest: canonicalDigest(candidates),
    eligibleCandidateSetDigest: canonicalDigest(eligible),
  };
}

export function buildRcv00dSelectorContext({
  repoRoot = REPO_ROOT,
  now = '2026-09-09T00:00:00.000Z',
  register = null,
  planText = null,
  planState = null,
} = {}) {
  const root = path.resolve(repoRoot);
  const actualRegister = register || readJsonBounded(repoPath(root, RCV00D_REGISTER_PATH));
  const registerValidation = validateCorrectiveRegister(actualRegister, { repoRoot: root });
  const actualPlanText = planText ?? fs.readFileSync(repoPath(root, RCV00D_PLAN_PATH), 'utf8');
  const actualPlanState = planState || readJsonBounded(repoPath(root, RCV00D_PLAN_STATE_PATH));
  const { effectiveStateProjection } = buildEffectiveStateProjectionOnFullGraph({ now, planState: actualPlanState });
  const graphSelectionReceipt = buildSelectionReceiptOnFullGraph({ now, planState: actualPlanState });
  const currentHeadSha = gitText(root, ['rev-parse', 'HEAD']);
  const originMainSha = gitText(root, ['rev-parse', 'origin/main']);
  const treeSha = gitText(root, ['rev-parse', 'HEAD^{tree}']);
  const historicalTreeSha = gitText(root, ['rev-parse', `${RCV00D_BASE_SHA}^{tree}`]);
  if (!HEX40_RE.test(currentHeadSha) || !HEX40_RE.test(originMainSha) || !HEX40_RE.test(treeSha)) throw new R24Error('E_RCV00D_GIT_IDENTITY');
  try {
    execFileSync('git', ['-C', root, 'merge-base', '--is-ancestor', RCV00D_BASE_SHA, 'HEAD'], { stdio: 'ignore' });
  } catch {
    throw new R24Error('E_RCV00D_BASE_NOT_ANCESTOR');
  }
  if (historicalTreeSha !== RCV00D_BASE_TREE) throw new R24Error('E_RCV00D_BASE_TREE_DRIFT');
  return {
    repoRoot: root,
    now,
    register: actualRegister,
    registerValidation,
    planText: actualPlanText,
    planState: actualPlanState,
    narrativeNextStep: parseNarrativeNextStep(actualPlanText),
    effectiveStateProjection,
    graphSelectionReceipt,
    identity: {
      headSha: currentHeadSha,
      originMainSha,
      treeSha,
    },
    inputDigests: {
      correctiveRegister: canonicalDigest(actualRegister),
      correctiveRegisterFile: sha256File(root, RCV00D_REGISTER_PATH),
      planTextFile: sha256File(root, RCV00D_PLAN_PATH),
      planStateFile: sha256File(root, RCV00D_PLAN_STATE_PATH),
      effectiveStateProjection: canonicalDigest(effectiveStateProjection),
      graphSelectionReceipt: canonicalDigest(graphSelectionReceipt),
    },
  };
}

function deriveRcv00dSelectorReceipt(context) {
  const selection = selectRcv00dCorrectiveCandidate(context);
  const registerValidation = validateCorrectiveRegister(context.register, { repoRoot: context.repoRoot });
  return {
    schemaVersion: RCV00D_SCHEMA_VERSION,
    selectorId: RCV00D_SELECTOR_ID,
    contourId: RCV00D_CONTOUR_ID,
    status: 'PASS',
    generatedAtUtc: context.now,
    identity: context.identity,
    inputDigests: context.inputDigests,
    narrativeNextStep: context.narrativeNextStep,
    narrativeNextStepAuthoritative: false,
    graphSchedulerCandidate: {
      selectedKind: context.graphSelectionReceipt.selectedKind,
      selectedId: context.graphSelectionReceipt.selectedId,
      verdict: context.graphSelectionReceipt.verdict,
      readySet: [...context.graphSelectionReceipt.readySet],
      stateRevision: context.graphSelectionReceipt.stateRevision,
      fencingCounter: context.graphSelectionReceipt.fencingCounter,
      stateDigest: context.graphSelectionReceipt.stateDigest,
      contourStatesDigest: context.graphSelectionReceipt.contourStatesDigest,
    },
    correctiveSelectionPolicy: {
      source: 'R24_CORRECTIVE_REGISTER_V1_PLUS_EFFECTIVE_GRAPH_STATE',
      severityOrder: Object.keys(SEVERITY_RANK).sort((a, b) => SEVERITY_RANK[a] - SEVERITY_RANK[b]),
      statusOrder: Object.keys(STATUS_RANK).sort((a, b) => STATUS_RANK[a] - STATUS_RANK[b]),
      deterministicOrder: [
        'SEVERITY',
        'CONTOUR_ORDER',
        'STATUS',
        'CANDIDATE_KIND',
        'STABLE_ID',
      ],
      deliveredContourIds: [...RCV00D_DELIVERED_CONTOUR_IDS].sort(),
      graphPromotionAllowedForNoGraphNode: false,
      graphNodeCandidateRequiresGraphReadySet: true,
    },
    selected: selection.selected,
    selectedCount: selection.selectedCount,
    eligibleCandidateCount: selection.eligibleCandidates.length,
    candidateCount: selection.candidates.length,
    candidateSetDigest: selection.candidateSetDigest,
    eligibleCandidateSetDigest: selection.eligibleCandidateSetDigest,
    candidates: selection.candidates,
    registerSummary: {
      findingCount: registerValidation.findingCount,
      currentObservationCount: registerValidation.currentObservationCount,
      activeConfirmed: registerValidation.activeConfirmed,
      activeConfirmedCurrentObservations: registerValidation.activeConfirmedCurrentObservations,
      recordedGraphOpen: registerValidation.recordedGraphOpen,
    },
    nonClaims: [...RCV00D_NON_CLAIMS],
    reasons: [
      'CORRECTIVE_SEVERITY_POLICY_OUTRANKS_GRAPH_ONLY_SCHEDULER_CANDIDATE',
      'CURRENT_NO_ELIGIBLE_GRAPH_RECEIPT_REQUIRES_CORRECTIVE_REGISTER_SELECTION',
      'NARRATIVE_NEXT_STEP_RECORDED_AS_NON_AUTHORITY',
      'ACTIVE_P1_CURRENT_OBSERVATION_SELECTED_BEFORE_P3_DEBT',
      'RECORDED_GRAPH_OPEN_NODE_REQUIRES_GRAPH_READY_SET',
      'NO_GRAPH_PROMOTION_FROM_CURRENT_OBSERVATION',
    ],
  };
}

export function buildRcv00dSelectorReceipt(options = {}) {
  const context = buildRcv00dSelectorContext(options);
  const receipt = deriveRcv00dSelectorReceipt(context);
  validateRcv00dSelectorReceipt(receipt, context);
  return receipt;
}

export function validateRcv00dSelectorReceipt(receipt, context = null) {
  const value = assertObject(receipt, 'E_RCV00D_RECEIPT_SHAPE');
  if (value.schemaVersion !== RCV00D_SCHEMA_VERSION || value.selectorId !== RCV00D_SELECTOR_ID || value.contourId !== RCV00D_CONTOUR_ID) {
    throw new R24Error('E_RCV00D_RECEIPT_IDENTITY');
  }
  if (value.status !== 'PASS') throw new R24Error('E_RCV00D_RECEIPT_STATUS', String(value.status));
  if (value.narrativeNextStepAuthoritative !== false) throw new R24Error('E_RCV00D_NARRATIVE_AUTHORITY');
  if (
    value.graphSchedulerCandidate?.selectedId !== RCV00D_EXPECTED_GRAPH_CANDIDATE
    || value.graphSchedulerCandidate?.selectedKind !== 'NONE'
    || value.graphSchedulerCandidate?.verdict !== RCV00D_EXPECTED_GRAPH_VERDICT
  ) {
    throw new R24Error('E_RCV00D_GRAPH_CANDIDATE_BINDING', String(value.graphSchedulerCandidate?.selectedId));
  }
  if (value.selectedCount !== 1) throw new R24Error('E_RCV00D_SELECTED_COUNT', String(value.selectedCount));
  const selected = assertObject(value.selected, 'E_RCV00D_SELECTED_SHAPE');
  if (selected.kind !== 'CURRENT_OBSERVATION' || selected.id !== RCV00D_SELECTED_OBSERVATION_ID || selected.contourId !== RCV00D_SELECTED_CONTOUR) {
    throw new R24Error('E_RCV00D_SELECTED_ITEM_BINDING', `${selected.kind}:${selected.id}:${selected.contourId}`);
  }
  if (selected.graphPromotionAllowed !== false || selected.mappedExistingGraphNode !== 'NO_GRAPH_NODE') {
    throw new R24Error('E_RCV00D_SELECTED_GRAPH_PROMOTION');
  }
  if (selected.severity !== 'P1' || selected.status !== 'ACTIVE_CONFIRMED' || selected.requiredProof !== RCV00D_REQUIRED_PROOF) {
    throw new R24Error('E_RCV00D_SELECTED_SEVERITY_STATUS_PROOF');
  }
  for (const token of RCV00D_REQUIRED_COVERAGE) {
    if (!selected.requiredCoverage?.includes(token)) throw new R24Error('E_RCV00D_SELECTED_REQUIRED_COVERAGE', token);
  }
  for (const token of RCV00D_FORBIDDEN_FIXES) {
    if (!selected.forbiddenFixes?.includes(token)) throw new R24Error('E_RCV00D_SELECTED_FORBIDDEN_FIX', token);
  }
  const candidates = assertArray(value.candidates, 'E_RCV00D_CANDIDATES');
  if (value.candidateSetDigest !== canonicalDigest(candidates)) throw new R24Error('E_RCV00D_CANDIDATE_SET_DIGEST');
  const candidateIds = new Set(candidates.map((candidate) => `${candidate.kind}:${candidate.id}`));
  if (candidateIds.size !== candidates.length) throw new R24Error('E_RCV00D_DUPLICATE_CANDIDATE');
  const pk1 = candidates.find((candidate) => candidate.id === 'REL-01' && candidate.mappedExistingGraphNode === 'PK1_RELEASE_SECURITY_PHYSICAL');
  if (!pk1 || pk1.eligible !== false || !pk1.ineligibilityReasons.includes('GRAPH_NODE_NOT_READY_OR_BLOCKED')) {
    throw new R24Error('E_RCV00D_BLOCKED_GRAPH_NODE_NOT_PRESERVED');
  }
  const nonClaims = new Set(assertArray(value.nonClaims, 'E_RCV00D_NONCLAIMS'));
  for (const token of RCV00D_NON_CLAIMS) {
    if (!nonClaims.has(token)) throw new R24Error('E_RCV00D_NONCLAIM', token);
  }
  const receiptIdentity = assertObject(value.identity, 'E_RCV00D_RECEIPT_IDENTITY_REQUIRED');
  // Without current context, only the pinned historical candidate is admissible.
  const expectedIdentity = context?.identity || {
    headSha: RCV00D_BASE_SHA,
    originMainSha: RCV00D_BASE_SHA,
    treeSha: RCV00D_BASE_TREE,
  };
  for (const field of ['headSha', 'originMainSha', 'treeSha']) {
    if (!HEX40_RE.test(String(receiptIdentity[field])) || receiptIdentity[field] !== expectedIdentity[field]) {
      throw new R24Error('E_RCV00D_RECEIPT_IDENTITY_BINDING', field);
    }
  }
  if (context) {
    const expectedReceipt = deriveRcv00dSelectorReceipt(context);
    if (value.inputDigests?.correctiveRegister !== canonicalDigest(context.register)) throw new R24Error('E_RCV00D_REGISTER_DIGEST_BINDING');
    if (value.inputDigests?.effectiveStateProjection !== canonicalDigest(context.effectiveStateProjection)) throw new R24Error('E_RCV00D_EFFECTIVE_STATE_DIGEST_BINDING');
    if (value.inputDigests?.graphSelectionReceipt !== canonicalDigest(context.graphSelectionReceipt)) throw new R24Error('E_RCV00D_GRAPH_RECEIPT_DIGEST_BINDING');
    if (value.graphSchedulerCandidate.stateDigest !== context.graphSelectionReceipt.stateDigest) throw new R24Error('E_RCV00D_GRAPH_RECEIPT_STATE_BINDING');
    if (value.graphSchedulerCandidate.contourStatesDigest !== context.graphSelectionReceipt.contourStatesDigest) throw new R24Error('E_RCV00D_GRAPH_RECEIPT_CONTOUR_BINDING');
    if (value.narrativeNextStep !== parseNarrativeNextStep(context.planText)) throw new R24Error('E_RCV00D_NARRATIVE_BINDING');
    for (const field of ['correctiveRegisterFile', 'planTextFile', 'planStateFile']) {
      if (!HEX64_RE.test(String(context.inputDigests?.[field])) || value.inputDigests?.[field] !== context.inputDigests[field]) {
        throw new R24Error('E_RCV00D_SOURCE_FILE_DIGEST_BINDING', field);
      }
    }
    for (const field of ['stateRevision', 'fencingCounter', 'readySet']) {
      if (canonicalDigest(value.graphSchedulerCandidate[field]) !== canonicalDigest(context.graphSelectionReceipt[field])) {
        throw new R24Error('E_RCV00D_GRAPH_SNAPSHOT_BINDING', field);
      }
    }
    // A resealed receipt must still match the projection derived from trusted inputs.
    if (canonicalDigest(value) !== canonicalDigest(expectedReceipt)) {
      throw new R24Error('E_RCV00D_CONTEXT_DERIVATION_BINDING');
    }
  } else if (!RCV00D_HISTORICAL_RECEIPT_DIGESTS.includes(canonicalDigest(value))) {
    throw new R24Error('E_RCV00D_HISTORICAL_RECEIPT_BINDING');
  }
  return {
    status: 'PASS',
    selectorId: value.selectorId,
    contourId: value.contourId,
    selectedKind: selected.kind,
    selectedId: selected.id,
    selectedContour: selected.contourId,
    graphSchedulerSelectedId: value.graphSchedulerCandidate.selectedId,
    narrativeNextStep: value.narrativeNextStep,
    selectedCount: value.selectedCount,
    eligibleCandidateCount: value.eligibleCandidateCount,
    candidateCount: value.candidateCount,
    candidateSetDigest: value.candidateSetDigest,
    nonClaimCount: value.nonClaims.length,
    headSha: value.identity?.headSha || null,
    originMainSha: value.identity?.originMainSha || null,
  };
}

export const CURRENT_CORRECTIVE_CLOSURES_PATH = 'docs/OPS/R24/EVIDENCE/RCV00D_CURRENT_CORRECTIVE_CLOSURES_V1.json';
const CURRENT_CLOSURE_CARRIER_DIGEST = '367795f8baa1c5f1f60c0e729bb70147261a738ee78b749767ed2f17d8f1c556';
const ACCEPTED_CLOSURE_RECEIPT_DIGEST = '029adc338ef8b51510eadd82b4405c5dc9ae23e11fc392891c956b2a3322e5ce';

// Preserve the independently accepted terminal bytes. Embedded provenance paths
// are opaque evidence, not filesystem inputs or fresh test-execution claims.
export function loadCurrentCorrectiveClosureStore({ repoRoot = REPO_ROOT } = {}) {
  const file = repoPath(repoRoot, CURRENT_CORRECTIVE_CLOSURES_PATH);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.size > 32768) throw new R24Error('E_CURRENT_CLOSURE_CARRIER_BOUNDS');
  const carrierBytes = fs.readFileSync(file);
  if (sha256hex(carrierBytes) !== CURRENT_CLOSURE_CARRIER_DIGEST) throw new R24Error('E_CURRENT_CLOSURE_CARRIER_DIGEST');
  const carrier = JSON.parse(carrierBytes.toString('utf8'));
  if (carrier.schemaVersion !== 'R24_CURRENT_CORRECTIVE_CLOSURES_V1' || carrier.receipts?.length !== 1) {
    throw new R24Error('E_CURRENT_CLOSURE_CARRIER_SCHEMA');
  }
  const row = carrier.receipts[0];
  if (row.receiptDigest !== ACCEPTED_CLOSURE_RECEIPT_DIGEST || typeof row.rawBase64 !== 'string'
      || !/^[A-Za-z0-9+/]+={0,2}$/u.test(row.rawBase64)) throw new R24Error('E_CURRENT_CLOSURE_CARRIER_ENTRY');
  const bytes = Buffer.from(row.rawBase64, 'base64');
  if (bytes.length > 16384 || bytes.toString('base64') !== row.rawBase64
      || sha256hex(bytes) !== row.receiptDigest) throw new R24Error('E_CURRENT_CLOSURE_DIGEST');
  const receipt = JSON.parse(bytes.toString('utf8'));
  return {
    carrierDigest: sha256hex(carrierBytes),
    closureReferences: [{
      kind: receipt.observationId ? 'CURRENT_OBSERVATION' : 'FINDING',
      id: receipt.observationId || receipt.findingId, contourId: receipt.contourId,
      sourceCommit: receipt.head, mergeSha: receipt.merged, mergeTree: receipt.tree, receiptDigest: row.receiptDigest,
    }],
    readClosureReceipt(digest) {
      if (digest !== row.receiptDigest) throw new R24Error('E_CURRENT_CLOSURE_UNTRUSTED_RECEIPT');
      return Buffer.from(bytes);
    },
  };
}

// Test seams accept resolvers, not status booleans. The native CLI always uses
// the fixed, digest-bound repository carrier and actual Git object identities.
export function verifyCurrentCorrectiveClosures({ context, closureReferences, readClosureReceipt, gitEvidence }) {
  assertArray(closureReferences, 'E_CURRENT_CLOSURE_REFERENCE_SHAPE');
  const candidates = [
    ...context.register.currentObservations.map(row => ({ kind: 'CURRENT_OBSERVATION', id: row.observationId, contourId: row.primaryContourId })),
    ...context.register.findings.map(row => ({ kind: 'FINDING', id: row.findingId, contourId: row.primaryContourId })),
  ];
  const seen = new Set();
  const verified = [];
  for (const ref of closureReferences) {
    if (!ref || !['CURRENT_OBSERVATION', 'FINDING'].includes(ref.kind)
        || typeof ref.id !== 'string' || typeof ref.contourId !== 'string'
        || !HEX40_RE.test(String(ref.sourceCommit)) || !HEX40_RE.test(String(ref.mergeSha))
        || !HEX40_RE.test(String(ref.mergeTree)) || !HEX64_RE.test(String(ref.receiptDigest))) {
      throw new R24Error('E_CURRENT_CLOSURE_REFERENCE_SHAPE');
    }
    const key = `${ref.kind}:${ref.id}`;
    if (seen.has(key)) throw new R24Error('E_CURRENT_CLOSURE_DUPLICATE_OR_CONFLICT', key);
    seen.add(key);
    if (!candidates.some(row => row.kind === ref.kind && row.id === ref.id && row.contourId === ref.contourId)) {
      throw new R24Error('E_CURRENT_CLOSURE_SUBJECT_UNKNOWN', key);
    }
    const bytes = readClosureReceipt(ref.receiptDigest);
    if (sha256hex(bytes) !== ref.receiptDigest) throw new R24Error('E_CURRENT_CLOSURE_DIGEST');
    const receipt = JSON.parse(bytes.toString('utf8'));
    const receiptKind = receipt.observationId ? 'CURRENT_OBSERVATION' : 'FINDING';
    const receiptId = receipt.observationId || receipt.findingId;
    if (receiptKind !== ref.kind || receiptId !== ref.id || receipt.contourId !== ref.contourId) {
      throw new R24Error('E_CURRENT_CLOSURE_SUBJECT_BINDING');
    }
    if (receipt.status !== 'FULL_DELIVERY_CLOSED_EXACT_MERGED_HEAD'
        || receipt.head !== ref.sourceCommit || receipt.merged !== ref.mergeSha || receipt.tree !== ref.mergeTree
        || receipt.pr?.state !== 'MERGED' || receipt.pr?.headRefOid !== ref.sourceCommit
        || receipt.pr?.mergeCommit?.oid !== ref.mergeSha) {
      throw new R24Error('E_CURRENT_CLOSURE_DELIVERY_BINDING');
    }
    if (gitEvidence.tree(ref.mergeSha) !== ref.mergeTree) throw new R24Error('E_CURRENT_CLOSURE_MERGE_TREE');
    if (!gitEvidence.isAncestor(ref.sourceCommit, ref.mergeSha)) throw new R24Error('E_CURRENT_CLOSURE_SOURCE_NOT_ANCESTOR');
    if (!gitEvidence.isAncestor(ref.mergeSha, context.identity.headSha)) throw new R24Error('E_CURRENT_CLOSURE_MERGE_NOT_ANCESTOR');
    verified.push({ ...ref });
  }
  return verified;
}

export function deriveCurrentCorrectiveSelection({ context, closureReferences = [], readClosureReceipt, gitEvidence }) {
  validateCorrectiveRegister(context.register, { repoRoot: context.repoRoot });
  assertSelectorIdentity(context.effectiveStateProjection, context.graphSelectionReceipt, context.identity);
  if (context.graphSelectionReceipt.stateDigest !== context.effectiveStateProjection.schedulerProjection.stateDigest
      || context.graphSelectionReceipt.contourStatesDigest !== context.effectiveStateProjection.schedulerProjection.contourStatesDigest) {
    throw new R24Error('E_CURRENT_SELECTION_GRAPH_BINDING');
  }
  if (context.graphSelectionReceipt.selectedId !== null || context.graphSelectionReceipt.readySet.length !== 0) {
    throw new R24Error('E_CURRENT_SELECTION_REQUIRES_NO_READY_GRAPH_NODE');
  }
  const verifiedClosures = verifyCurrentCorrectiveClosures({ context, closureReferences, readClosureReceipt, gitEvidence });
  const closed = new Set(verifiedClosures.map(ref => `${ref.kind}:${ref.id}`));
  const candidates = [
    ...context.register.currentObservations.map(currentObservationCandidate),
    ...context.register.findings.map(finding => findingCandidate(finding, {
      readySet: new Set(context.graphSelectionReceipt.readySet),
      contourStates: context.effectiveStateProjection.schedulerProjection.contourStates,
      deliveredContourIds: new Set(RCV00D_DELIVERED_CONTOUR_IDS),
    })),
  ].map(candidate => {
    if (!closed.has(`${candidate.kind}:${candidate.id}`)) return candidate;
    return { ...candidate, eligible: false, ineligibilityReasons: [...candidate.ineligibilityReasons, 'VERIFIED_TERMINAL_DELIVERY_CLOSURE'] };
  });
  const eligible = candidates.filter(candidate => candidate.eligible)
    .sort((left, right) => compareKey(selectionKey(left), selectionKey(right)));
  const selected = eligible[0] || null;
  return {
    schemaVersion: 'R24_CURRENT_CORRECTIVE_SELECTION_V1',
    verdict: selected ? 'CORRECTIVE_CANDIDATE_RANKED_NOT_ADMITTED' : 'NO_ELIGIBLE',
    selected, candidates, verifiedClosures,
    identity: { ...context.identity }, graphSchedulerSelectedId: null,
    candidateSetDigest: canonicalDigest(candidates),
    closureSetDigest: canonicalDigest(verifiedClosures),
  };
}

export function buildCurrentCorrectivePlanOutcome(options) {
  const ranked = deriveCurrentCorrectiveSelection(options);
  const { context } = options;
  const committedPlanDigest = sha256hex(execFileSync('git', ['-C', context.repoRoot, 'show', `${context.identity.headSha}:${RCV00D_PLAN_PATH}`]));
  if (sha256hex(Buffer.from(context.planText)) !== context.inputDigests.planTextFile
      || context.inputDigests.planTextFile !== committedPlanDigest) {
    throw new R24Error('E_CURRENT_SELECTION_PLAN_DIGEST');
  }
  const strictPath = context.planText.match(/The strict path is:\s*([\s\S]*?)\n\n/u)?.[1];
  if (!strictPath) throw new R24Error('E_CURRENT_SELECTION_PLAN_PATH_MISSING');
  const phaseZero = strictPath.split('->').map(id => id.trim())
    .filter(id => /^00[A-H]$/u.test(id)).map(id => `R24-RCV-${id}`);
  if (phaseZero.length !== 8 || new Set(phaseZero).size !== 8) throw new R24Error('E_CURRENT_SELECTION_PLAN_PATH_SHAPE');
  const selectedIndex = phaseZero.indexOf(ranked.selected?.contourId);
  // Preserve the existing historical baseline; new closure comes only from
  // verified receipts. No added contour constant may stand in for a receipt.
  const delivered = new Set([...RCV00D_DELIVERED_CONTOUR_IDS, ...ranked.verifiedClosures.map(ref => ref.contourId)]);
  const missing = selectedIndex < 0 ? phaseZero.filter(id => !delivered.has(id))
    : phaseZero.slice(0, selectedIndex).filter(id => !delivered.has(id));
  if (!ranked.selected || missing.length > 0) {
    return { ...ranked, verdict: 'NO_ELIGIBLE', selected: null, rankedCandidateId: ranked.selected?.id || null,
      reason: missing.length ? 'PLAN_PREDECESSOR_CLOSURE_UNRESOLVED' : 'NO_ELIGIBLE_CORRECTIVE_ITEM',
      unresolvedPredecessors: missing, mutationAllowed: false };
  }
  return { ...ranked, verdict: 'NEXT_CORRECTIVE_CANDIDATE', mutationAllowed: false };
}

export function buildCurrentCorrectiveSelectorReceipt({ repoRoot = REPO_ROOT, now = new Date().toISOString() } = {}) {
  const context = buildRcv00dSelectorContext({ repoRoot, now });
  const store = loadCurrentCorrectiveClosureStore({ repoRoot: context.repoRoot });
  const outcome = buildCurrentCorrectivePlanOutcome({ context, ...store, gitEvidence: {
    tree: sha => gitText(context.repoRoot, ['rev-parse', `${sha}^{tree}`]),
    isAncestor(left, right) {
      try {
        execFileSync('git', ['-C', context.repoRoot, 'merge-base', '--is-ancestor', left, right], { stdio: 'ignore' });
        return true;
      } catch (error) {
        if (error.status === 1) return false;
        throw new R24Error('E_CURRENT_CLOSURE_GIT_EVIDENCE');
      }
    },
  } });
  return { ...outcome, generatedAtUtc: now, carrierDigest: store.carrierDigest,
    worktreeDirty: gitText(context.repoRoot, ['status', '--porcelain=v1']) !== '',
    evidenceScope: 'ACCEPTED_CLOSURE_IDENTITY_AND_CURRENT_PLAN_SELECTION_NOT_FRESH_RUNTIME_PROOF',
    historicalV1ReceiptVerificationUnchanged: true, programDone: false, productionReleaseReady: false, graphIncrement: 0 };
}

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      args.set(token, next);
      index += 1;
    } else {
      args.set(token, 'true');
    }
  }
  return args;
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  for (const key of args.keys()) {
    if (!['--repo-root', '--now', '--json', '--historical-v1'].includes(key)) throw new R24Error('E_RCV00D_CLI_ARGUMENT', key);
  }
  const repoRoot = path.resolve(args.get('--repo-root') || process.cwd());
  const options = {
    repoRoot,
    now: args.get('--now') || (args.has('--historical-v1') ? '2026-09-09T00:00:00.000Z' : new Date().toISOString()),
  };
  if (!args.has('--historical-v1')) {
    const receipt = buildCurrentCorrectiveSelectorReceipt(options);
    process.stdout.write(args.has('--json') ? `${JSON.stringify(receipt, null, 2)}\n`
      : `R24_RCV00D_CURRENT_CORRECTIVE_SELECTION=${JSON.stringify(receipt)}\n`);
    return receipt;
  }
  const receipt = buildRcv00dSelectorReceipt(options);
  const result = validateRcv00dSelectorReceipt(receipt, buildRcv00dSelectorContext(options));
  if (args.has('--json')) {
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  } else {
    process.stdout.write(`R24_RCV00D_GRAPH_DERIVED_SELECTOR=${JSON.stringify(result)}\n`);
  }
  return result;
}

const invokedAsScript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) {
  try {
    main();
  } catch (error) {
    const code = error instanceof R24Error ? error.code : 'E_UNKNOWN';
    process.stderr.write(`${code}: ${error.message}\n`);
    process.exit(1);
  }
}
