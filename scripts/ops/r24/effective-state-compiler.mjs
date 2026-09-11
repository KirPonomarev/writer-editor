#!/usr/bin/env node
// R24-RCV-00B: read-only effective-state compiler.
// It composes immutable raw plan state plus validated append-only evidence
// into a scheduler/status/completion projection without mutating the graph.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  R24Error,
  HEX40_RE,
  HEX64_RE,
  canonicalDigest,
  readJsonBounded,
  sha256hex,
} from './canonical-json.mjs';
import { DEFAULT_TRANSITION_LAW, validateTransitionReplay } from './plan-state.mjs';

export const EFFECTIVE_STATE_SCHEMA_VERSION = 'R24_EFFECTIVE_STATE_PROJECTION_V1';
export const EFFECTIVE_STATE_COMPILER_ID = 'R24_RCV_00B_EFFECTIVE_STATE_COMPILER';
export const EFFECTIVE_SCHEDULER_STATE_SCHEMA_VERSION = 'R24_EFFECTIVE_SCHEDULER_STATE_V1';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(MODULE_DIR, '..', '..', '..');
const R24_DIR = path.join(REPO_ROOT, 'docs', 'OPS', 'R24');
const KNOWN_STATES = new Set(DEFAULT_TRANSITION_LAW.lifecycleStates);
export const W0_CURRENT_HEAD_EFFECTIVE_STATE_OVERLAY_PATH = 'docs/OPS/R24/CORRECTIVE/W0_CURRENT_HEAD_EFFECTIVE_STATE_OVERLAY_V1.json';
export const W0_CURRENT_HEAD_EFFECTIVE_STATE_OVERLAY_SCHEMA_VERSION = 'R24_W0_CURRENT_HEAD_EFFECTIVE_STATE_OVERLAY_V1';
export const W0_WORD_PHYSICAL_RECEIPT_PATH = 'docs/OPS/RTK/YALKEN_R24_W0_WORD_PHYSICAL_RECERTIFICATION_RECEIPT_V1.json';
export const W0_WORD_PHYSICAL_RECEIPT_SHA256 = 'ebf5b193e3e87e68fe4e68ede95318eba8fb8486de301cb560df9efc44a015cf';
const clone = (value) => structuredClone(value);

function assertObject(value, code, detail) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new R24Error(code, detail);
  return value;
}

function assertArray(value, code, detail) {
  if (!Array.isArray(value)) throw new R24Error(code, detail);
  return value;
}

function assertSameSet(actual, expected, code, detail) {
  const a = [...actual].sort();
  const e = [...expected].sort();
  if (a.length !== e.length || a.some((item, index) => item !== e[index])) {
    throw new R24Error(code, `${detail}:${JSON.stringify(a)} != ${JSON.stringify(e)}`);
  }
}

function assertDigest(value, code, detail) {
  if (!HEX64_RE.test(String(value))) throw new R24Error(code, detail);
  return String(value);
}

function assertHead(value, code, detail) {
  if (!HEX40_RE.test(String(value))) throw new R24Error(code, detail);
  return String(value);
}

function assertKnownState(value, code, detail) {
  if (!KNOWN_STATES.has(String(value))) throw new R24Error(code, detail);
  return String(value);
}

function assertClock(value, code, detail) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new R24Error(code, detail);
  return value;
}

function validateGraph(program) {
  assertObject(program, 'E_R24_EFFECTIVE_PROGRAM_SHAPE');
  const nodes = assertArray(program.nodes, 'E_R24_EFFECTIVE_PROGRAM_NODES', 'nodes');
  const ids = new Set();
  for (const node of nodes) {
    assertObject(node, 'E_R24_EFFECTIVE_NODE_SHAPE');
    if (typeof node.id !== 'string' || node.id.length === 0) throw new R24Error('E_R24_EFFECTIVE_NODE_ID');
    if (ids.has(node.id)) throw new R24Error('E_R24_EFFECTIVE_DUPLICATE_NODE', node.id);
    ids.add(node.id);
    assertArray(node.dependsOn, 'E_R24_EFFECTIVE_DEPENDS_ON', node.id);
    assertKnownState(node.state, 'E_R24_EFFECTIVE_NODE_STATE', node.id);
  }
  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new R24Error('E_R24_EFFECTIVE_GRAPH_CYCLE', id);
    const node = nodes.find((candidate) => candidate.id === id);
    if (!node) throw new R24Error('E_R24_EFFECTIVE_MISSING_PREDECESSOR', id);
    visiting.add(id);
    for (const dep of node.dependsOn) {
      if (!ids.has(dep)) throw new R24Error('E_R24_EFFECTIVE_MISSING_PREDECESSOR', `${id}->${dep}`);
      visit(dep);
    }
    visiting.delete(id);
    visited.add(id);
  };
  for (const node of nodes) visit(node.id);
  return { nodes, nodeIds: ids };
}

function validatePlanState(planState, nodeIds) {
  assertObject(planState, 'E_R24_EFFECTIVE_PLAN_STATE_SHAPE');
  validateTransitionReplay(planState, '<effective-state-plan>');
  for (const id of Object.keys(planState.contours || {})) {
    if (!nodeIds.has(id)) throw new R24Error('E_R24_EFFECTIVE_PLAN_UNKNOWN_CONTOUR', id);
  }
  for (const id of Object.keys(planState.leases || {})) {
    if (!nodeIds.has(id)) throw new R24Error('E_R24_EFFECTIVE_LEASE_UNKNOWN_CONTOUR', id);
  }
}

export function buildRawContourStates({ program, planState }) {
  const { nodes, nodeIds } = validateGraph(program);
  validatePlanState(planState, nodeIds);
  const states = {};
  for (const node of nodes) {
    const state = planState.contours?.[node.id]?.state || node.state;
    states[node.id] = assertKnownState(state, 'E_R24_EFFECTIVE_CONTOUR_STATE', node.id);
  }
  return states;
}

export function countStates(states) {
  const counts = {};
  for (const state of Object.values(states)) counts[state] = (counts[state] || 0) + 1;
  return Object.fromEntries(Object.keys(counts).sort().map((key) => [key, counts[key]]));
}

function validateExactIdentity(exactIdentity) {
  const identity = assertObject(exactIdentity, 'E_R24_EFFECTIVE_IDENTITY_REQUIRED');
  const evaluationHeadSha = assertHead(identity.evaluationHeadSha, 'E_R24_EFFECTIVE_EVALUATION_HEAD', 'evaluationHeadSha');
  const evaluationTreeSha = assertHead(identity.evaluationTreeSha, 'E_R24_EFFECTIVE_EVALUATION_TREE', 'evaluationTreeSha');
  const implementationSourceSha = identity.implementationSourceSha === undefined || identity.implementationSourceSha === null
    ? evaluationHeadSha
    : assertHead(identity.implementationSourceSha, 'E_R24_EFFECTIVE_IMPLEMENTATION_SOURCE', 'implementationSourceSha');
  const originMainSha = identity.originMainSha === undefined || identity.originMainSha === null
    ? null
    : assertHead(identity.originMainSha, 'E_R24_EFFECTIVE_ORIGIN_MAIN', 'originMainSha');
  return { implementationSourceSha, evaluationHeadSha, evaluationTreeSha, originMainSha };
}

function validateOverlay(overlay, {
  index,
  previousOverlayId,
  seenOverlayIds,
  seenTransitionIds,
  nodeIds,
  currentStates,
  exactIdentity,
  rawPlanStateDigest,
  programDigest,
}) {
  assertObject(overlay, 'E_R24_EFFECTIVE_OVERLAY_SHAPE', String(index));
  if (overlay.schemaVersion !== 'R24_EFFECTIVE_STATE_OVERLAY_V1') throw new R24Error('E_R24_EFFECTIVE_OVERLAY_SCHEMA', String(overlay.schemaVersion));
  if (typeof overlay.overlayId !== 'string' || overlay.overlayId.length === 0) throw new R24Error('E_R24_EFFECTIVE_OVERLAY_ID', String(index));
  if (seenOverlayIds.has(overlay.overlayId)) throw new R24Error('E_R24_EFFECTIVE_DUPLICATE_OVERLAY', overlay.overlayId);
  if (overlay.sequence !== index) throw new R24Error('E_R24_EFFECTIVE_OVERLAY_APPEND_ONLY', `${overlay.overlayId}:${String(overlay.sequence)}!=${index}`);
  if ((overlay.predecessorOverlayId ?? null) !== previousOverlayId) throw new R24Error('E_R24_EFFECTIVE_MISSING_PREDECESSOR', overlay.overlayId);
  if (overlay.baseHeadSha !== exactIdentity.evaluationHeadSha) throw new R24Error('E_R24_EFFECTIVE_OVERLAY_STALE_SHA', overlay.overlayId);
  if (overlay.basePlanStateDigest !== rawPlanStateDigest) throw new R24Error('E_R24_EFFECTIVE_OVERLAY_STALE_PLAN', overlay.overlayId);
  if (overlay.baseProgramDigest !== programDigest) throw new R24Error('E_R24_EFFECTIVE_OVERLAY_STALE_PROGRAM', overlay.overlayId);
  const targetNodeId = String(overlay.targetNodeId || '');
  if (!nodeIds.has(targetNodeId)) throw new R24Error('E_R24_EFFECTIVE_OVERLAY_UNKNOWN_NODE', targetNodeId);
  const from = assertKnownState(overlay.from, 'E_R24_EFFECTIVE_OVERLAY_STATE', `${overlay.overlayId}:from`);
  const to = assertKnownState(overlay.to, 'E_R24_EFFECTIVE_OVERLAY_STATE', `${overlay.overlayId}:to`);
  if (from === to) throw new R24Error('E_R24_EFFECTIVE_OVERLAY_NOOP', overlay.overlayId);
  if (currentStates[targetNodeId] !== from) {
    throw new R24Error('E_R24_EFFECTIVE_OVERLAY_CONFLICT', `${targetNodeId}:${currentStates[targetNodeId]}!=${from}`);
  }
  const transitionId = assertDigest(overlay.transitionId, 'E_R24_EFFECTIVE_TRANSITION_DIGEST', overlay.overlayId);
  if (seenTransitionIds.has(transitionId)) throw new R24Error('E_R24_EFFECTIVE_DUPLICATE_TRANSITION', transitionId);
  assertDigest(overlay.receiptSha256, 'E_R24_EFFECTIVE_OVERLAY_RECEIPT', overlay.overlayId);
  if (overlay.selfPromotion === true || overlay.proofAuthority === 'SELF' || overlay.source === 'SELF_PROMOTION') {
    throw new R24Error('E_R24_EFFECTIVE_SELF_PROMOTION', overlay.overlayId);
  }
  seenOverlayIds.add(overlay.overlayId);
  seenTransitionIds.add(transitionId);
  currentStates[targetNodeId] = to;
  return {
    overlayId: overlay.overlayId,
    transitionId,
    targetNodeId,
    from,
    to,
    receiptSha256: overlay.receiptSha256,
  };
}

function validateDeliveryReceipt(receipt, { index, nodeIds, exactIdentity }) {
  assertObject(receipt, 'E_R24_EFFECTIVE_DELIVERY_SHAPE', String(index));
  if (receipt.schemaVersion !== 'R24_EFFECTIVE_DELIVERY_RECEIPT_V1') throw new R24Error('E_R24_EFFECTIVE_DELIVERY_SCHEMA', String(receipt.schemaVersion));
  if (typeof receipt.deliveryId !== 'string' || receipt.deliveryId.length === 0) throw new R24Error('E_R24_EFFECTIVE_DELIVERY_ID', String(index));
  if (!nodeIds.has(receipt.nodeId)) throw new R24Error('E_R24_EFFECTIVE_DELIVERY_UNKNOWN_NODE', String(receipt.nodeId));
  if (!['DELIVERED', 'POSTMERGE_VERIFIED', 'DONE'].includes(receipt.status)) throw new R24Error('E_R24_EFFECTIVE_DELIVERY_STATUS', receipt.deliveryId);
  if (receipt.currentHeadSha !== exactIdentity.evaluationHeadSha) throw new R24Error('E_R24_EFFECTIVE_DELIVERY_STALE_SHA', receipt.deliveryId);
  assertHead(receipt.observedSha, 'E_R24_EFFECTIVE_DELIVERY_HEAD', receipt.deliveryId);
  assertDigest(receipt.receiptSha256, 'E_R24_EFFECTIVE_DELIVERY_RECEIPT', receipt.deliveryId);
  if (receipt.selfPromotion === true || receipt.proofAuthority === 'SELF') throw new R24Error('E_R24_EFFECTIVE_SELF_PROMOTION', receipt.deliveryId);
  return {
    deliveryId: receipt.deliveryId,
    nodeId: receipt.nodeId,
    status: receipt.status,
    observedSha: receipt.observedSha,
    receiptSha256: receipt.receiptSha256,
  };
}

function validateExternalAttestation(attestation, { index, nodeIds, exactIdentity }) {
  assertObject(attestation, 'E_R24_EFFECTIVE_ATTESTATION_SHAPE', String(index));
  if (attestation.schemaVersion !== 'R24_EFFECTIVE_EXTERNAL_ATTESTATION_V1') throw new R24Error('E_R24_EFFECTIVE_ATTESTATION_SCHEMA', String(attestation.schemaVersion));
  if (typeof attestation.attestationId !== 'string' || attestation.attestationId.length === 0) throw new R24Error('E_R24_EFFECTIVE_ATTESTATION_ID', String(index));
  if (!nodeIds.has(attestation.nodeId)) throw new R24Error('E_R24_EFFECTIVE_ATTESTATION_UNKNOWN_NODE', String(attestation.nodeId));
  if (!['PASS', 'FAIL'].includes(attestation.result)) throw new R24Error('E_R24_EFFECTIVE_ATTESTATION_RESULT', attestation.attestationId);
  if (attestation.evaluationHeadSha !== exactIdentity.evaluationHeadSha) throw new R24Error('E_R24_EFFECTIVE_ATTESTATION_STALE_SHA', attestation.attestationId);
  assertHead(attestation.evaluationTreeSha, 'E_R24_EFFECTIVE_ATTESTATION_TREE', attestation.attestationId);
  assertDigest(attestation.attestationSha256, 'E_R24_EFFECTIVE_ATTESTATION_DIGEST', attestation.attestationId);
  if (attestation.selfPromotion === true || attestation.proofAuthority === 'SELF' || attestation.issuer === EFFECTIVE_STATE_COMPILER_ID) {
    throw new R24Error('E_R24_EFFECTIVE_SELF_PROMOTION', attestation.attestationId);
  }
  return {
    attestationId: attestation.attestationId,
    nodeId: attestation.nodeId,
    result: attestation.result,
    evaluationHeadSha: attestation.evaluationHeadSha,
    evaluationTreeSha: attestation.evaluationTreeSha,
    attestationSha256: attestation.attestationSha256,
  };
}

function buildCompletion({ program, states }) {
  const requiredPendingNodeIds = program.nodes
    .filter((node) => states[node.id] !== 'DONE' && states[node.id] !== 'INELIGIBLE_OPTIONAL')
    .map((node) => node.id)
    .sort();
  return {
    programDone: requiredPendingNodeIds.length === 0,
    requiredPendingNodeIds,
    requiredPendingCount: requiredPendingNodeIds.length,
    doneCount: Object.values(states).filter((state) => state === 'DONE').length,
    ineligibleOptionalCount: Object.values(states).filter((state) => state === 'INELIGIBLE_OPTIONAL').length,
    graphNodeCount: program.nodes.length,
  };
}

export function compileEffectiveState({
  program,
  planState,
  overlays = [],
  deliveryReceipts = [],
  externalAttestations = [],
  exactIdentity,
  generatedAt,
}) {
  assertClock(generatedAt, 'E_R24_EFFECTIVE_GENERATED_AT', 'generatedAt');
  const identity = validateExactIdentity(exactIdentity);
  const { nodeIds } = validateGraph(program);
  validatePlanState(planState, nodeIds);
  const programDigest = canonicalDigest(program);
  const programNodesDigest = canonicalDigest(program.nodes);
  const rawPlanStateDigest = canonicalDigest(planState);
  const rawStates = buildRawContourStates({ program, planState });
  const rawStatesDigest = canonicalDigest(rawStates);
  const effectiveStates = clone(rawStates);

  const seenOverlayIds = new Set();
  const seenTransitionIds = new Set();
  let previousOverlayId = null;
  const appliedOverlays = assertArray(overlays, 'E_R24_EFFECTIVE_OVERLAYS_SHAPE', 'overlays').map((overlay, index) => {
    const applied = validateOverlay(overlay, {
      index,
      previousOverlayId,
      seenOverlayIds,
      seenTransitionIds,
      nodeIds,
      currentStates: effectiveStates,
      exactIdentity: identity,
      rawPlanStateDigest,
      programDigest,
    });
    previousOverlayId = overlay.overlayId;
    return applied;
  });
  const normalizedDeliveryReceipts = assertArray(deliveryReceipts, 'E_R24_EFFECTIVE_DELIVERIES_SHAPE', 'deliveryReceipts')
    .map((receipt, index) => validateDeliveryReceipt(receipt, { index, nodeIds, exactIdentity: identity }));
  const normalizedAttestations = assertArray(externalAttestations, 'E_R24_EFFECTIVE_ATTESTATIONS_SHAPE', 'externalAttestations')
    .map((attestation, index) => validateExternalAttestation(attestation, { index, nodeIds, exactIdentity: identity }));

  const effectiveStateDigest = canonicalDigest(effectiveStates);
  const recordedProgress = {
    stateSource: 'PLAN_STATE_PLUS_VALIDATED_APPEND_ONLY_OVERLAYS',
    states: clone(effectiveStates),
    counts: countStates(effectiveStates),
    doneIds: Object.entries(effectiveStates).filter(([, state]) => state === 'DONE').map(([id]) => id).sort(),
  };
  const freshlyProvenProgress = {
    stateSource: 'DELIVERY_AND_EXTERNAL_ATTESTATIONS_ONLY_NOT_APPLIED',
    deliveryReceipts: normalizedDeliveryReceipts,
    externalAttestations: normalizedAttestations,
    digest: canonicalDigest({ normalizedDeliveryReceipts, normalizedAttestations }),
  };
  const completion = buildCompletion({ program, states: effectiveStates });
  const schedulerStateSource = {
    schemaVersion: EFFECTIVE_SCHEDULER_STATE_SCHEMA_VERSION,
    compilerId: EFFECTIVE_STATE_COMPILER_ID,
    rawPlanStateDigest,
    rawStatesDigest,
    appliedOverlayDigest: canonicalDigest(appliedOverlays),
    freshlyProvenProgressDigest: freshlyProvenProgress.digest,
    effectiveStateDigest,
    completionDigest: canonicalDigest(completion),
  };

  return {
    schemaVersion: EFFECTIVE_STATE_SCHEMA_VERSION,
    compilerId: EFFECTIVE_STATE_COMPILER_ID,
    generatedAt,
    exactIdentity: identity,
    sourceDigests: {
      programDigest,
      programNodesDigest,
      rawPlanStateDigest,
      rawStatesDigest,
      overlaysDigest: canonicalDigest(overlays),
      deliveryReceiptsDigest: canonicalDigest(deliveryReceipts),
      externalAttestationsDigest: canonicalDigest(externalAttestations),
    },
    rawState: {
      immutable: true,
      schemaVersion: planState.schemaVersion,
      revision: planState.revision,
      fencingCounter: planState.fencingCounter,
      contourStates: rawStates,
      contourStatesDigest: rawStatesDigest,
      activeLeases: clone(planState.leases || {}),
      activeLeaseCount: Object.keys(planState.leases || {}).length,
      transitionHistoryCount: Array.isArray(planState.transitionHistory) ? planState.transitionHistory.length : 0,
      replay: validateTransitionReplay(planState, '<effective-state-plan>'),
    },
    overlayResolution: {
      appendOnly: true,
      applied: appliedOverlays,
      appliedCount: appliedOverlays.length,
      digest: schedulerStateSource.appliedOverlayDigest,
    },
    recordedProgress,
    freshlyProvenProgress,
    effectiveState: {
      states: clone(effectiveStates),
      counts: countStates(effectiveStates),
      digest: effectiveStateDigest,
    },
    schedulerProjection: {
      stateSource: EFFECTIVE_SCHEDULER_STATE_SCHEMA_VERSION,
      contourStates: clone(effectiveStates),
      contourStatesDigest: effectiveStateDigest,
      stateDigestSource: schedulerStateSource,
      stateDigest: canonicalDigest(schedulerStateSource),
    },
    statusProjection: {
      counts: countStates(effectiveStates),
      activeLeaseCount: Object.keys(planState.leases || {}).length,
      appliedOverlayCount: appliedOverlays.length,
      freshlyProvenDeliveryCount: normalizedDeliveryReceipts.length,
      freshlyProvenAttestationCount: normalizedAttestations.length,
    },
    completion,
    noAutomaticGraphTransition: true,
  };
}

function git(args) {
  const result = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.status !== 0) throw new R24Error('E_GIT', `${args.join(' ')}:${String(result.stderr || '').trim()}`);
  return String(result.stdout || '').trim();
}

function sha256File(filePath) {
  return sha256hex(fs.readFileSync(filePath));
}

function assertExactDescendant(candidateHeadSha, evaluationHeadSha) {
  if (candidateHeadSha === evaluationHeadSha) return;
  const result = spawnSync('git', ['merge-base', '--is-ancestor', candidateHeadSha, evaluationHeadSha], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new R24Error('E_R24_W0_OVERLAY_NON_DESCENDANT_HEAD', `${candidateHeadSha}:${evaluationHeadSha}`);
  }
}

function assertW0OverlayField(condition, code, detail) {
  if (!condition) throw new R24Error(code, detail);
}

export function normalizeW0EffectiveStateOverlay(carrier, {
  program,
  planState,
  evaluationHeadSha,
  evaluationTreeSha,
} = {}) {
  assertW0OverlayField(carrier && typeof carrier === 'object' && !Array.isArray(carrier), 'E_R24_W0_OVERLAY_SHAPE');
  assertW0OverlayField(carrier.schemaVersion === W0_CURRENT_HEAD_EFFECTIVE_STATE_OVERLAY_SCHEMA_VERSION, 'E_R24_W0_OVERLAY_SCHEMA', String(carrier.schemaVersion || ''));
  assertW0OverlayField(carrier.overlayId === 'W0_WORD_PHYSICAL_RECERTIFICATION_CURRENT_HEAD_OVERLAY_V1', 'E_R24_W0_OVERLAY_FIELD', 'overlayId');
  assertW0OverlayField(carrier.stageId === 'W0_WORD_PHYSICAL_RECERTIFICATION', 'E_R24_W0_OVERLAY_FIELD', 'stageId');
  assertW0OverlayField(carrier.targetNodeId === 'W0_WORD_PHYSICAL_RECERTIFICATION', 'E_R24_W0_OVERLAY_FIELD', 'targetNodeId');
  assertW0OverlayField(carrier.from === 'BLOCKED_TYPED', 'E_R24_W0_OVERLAY_FIELD', 'from');
  assertW0OverlayField(carrier.to === 'DONE', 'E_R24_W0_OVERLAY_FIELD', 'to');
  assertW0OverlayField(carrier.rawPlanStateMutation === false, 'E_R24_W0_OVERLAY_FIELD', 'rawPlanStateMutation');
  assertW0OverlayField(carrier.programMutation === false, 'E_R24_W0_OVERLAY_FIELD', 'programMutation');
  assertW0OverlayField(carrier.physicalReceiptId === 'YALKEN_R24_W0_WORD_PHYSICAL_RECERTIFICATION_RECEIPT_V1', 'E_R24_W0_OVERLAY_FIELD', 'physicalReceiptId');
  assertW0OverlayField(carrier.physicalReceiptSha256 === W0_WORD_PHYSICAL_RECEIPT_SHA256, 'E_R24_W0_OVERLAY_FIELD', 'physicalReceiptSha256');
  assertW0OverlayField(carrier.proofAuthority === 'OWNER_APPROVED_WORD_PHYSICAL_SESSION_AUTHORITY', 'E_R24_W0_OVERLAY_FIELD', 'proofAuthority');
  assertW0OverlayField(carrier.source === 'W0_PHYSICAL_RECERTIFICATION_VERIFIER_PASS', 'E_R24_W0_OVERLAY_FIELD', 'source');
  assertW0OverlayField(
    carrier.successorHeadPolicy === 'ALLOW_DESCENDANT_HEADS_WITH_IDENTICAL_PROGRAM_AND_PLAN_DIGESTS',
    'E_R24_W0_OVERLAY_FIELD',
    'successorHeadPolicy',
  );
  assertW0OverlayField(HEX40_RE.test(String(carrier.immutableCandidateHeadSha || '')), 'E_R24_W0_OVERLAY_CANDIDATE_HEAD_SHAPE');
  assertW0OverlayField(HEX40_RE.test(String(carrier.immutableCandidateTreeSha || '')), 'E_R24_W0_OVERLAY_CANDIDATE_TREE_SHAPE');
  assertW0OverlayField(HEX40_RE.test(String(evaluationHeadSha || '')), 'E_R24_W0_OVERLAY_EVALUATION_HEAD_SHAPE');
  assertW0OverlayField(HEX40_RE.test(String(evaluationTreeSha || '')), 'E_R24_W0_OVERLAY_EVALUATION_TREE_SHAPE');

  const requiredNonClaims = [
    'NO_RAW_PLAN_STATE_MUTATION',
    'NO_PROGRAM_DONE',
    'NO_WORD_TERMINAL_PASS',
    'NO_C1_ROUTE_PASS',
    'NO_PRODUCT_APPLY_AUTHORITY',
    'NO_SAFE_APPLY_EXPANSION',
    'NO_USER_WORD_DOCUMENT_ACCESS',
    'NO_GOOGLE_DOCS_TRANSFER',
    'NO_RELEASE_READINESS',
    'NO_RUNTIME_NETWORK',
  ];
  assertSameSet(assertArray(carrier.nonClaims, 'E_R24_W0_OVERLAY_NON_CLAIMS', 'nonClaims'), requiredNonClaims, 'E_R24_W0_OVERLAY_NON_CLAIMS', 'nonClaims');

  const planDigest = canonicalDigest(planState);
  const programDigest = canonicalDigest(program);
  assertW0OverlayField(planDigest === carrier.basePlanStateDigest, 'E_R24_W0_OVERLAY_PLAN_DIGEST', `${planDigest} != ${carrier.basePlanStateDigest}`);
  assertW0OverlayField(programDigest === carrier.baseProgramDigest, 'E_R24_W0_OVERLAY_PROGRAM_DIGEST', `${programDigest} != ${carrier.baseProgramDigest}`);
  assertW0OverlayField(sha256File(path.join(REPO_ROOT, W0_WORD_PHYSICAL_RECEIPT_PATH)) === carrier.physicalReceiptSha256, 'E_R24_W0_OVERLAY_FIELD', 'physicalReceiptSha256');

  assertExactDescendant(carrier.immutableCandidateHeadSha, evaluationHeadSha);
  const candidateTreeSha = git(['rev-parse', `${carrier.immutableCandidateHeadSha}^{tree}`]);
  assertW0OverlayField(candidateTreeSha === carrier.immutableCandidateTreeSha, 'E_R24_W0_OVERLAY_CANDIDATE_TREE', `${candidateTreeSha} != ${carrier.immutableCandidateTreeSha}`);
  const candidatePlanState = JSON.parse(git(['show', `${carrier.immutableCandidateHeadSha}:docs/OPS/R24/PLAN_STATE_R24.json`]));
  const candidateProgram = JSON.parse(git(['show', `${carrier.immutableCandidateHeadSha}:docs/OPS/R24/EXECUTABLE_PROGRAM_R2_4.json`]));
  assertW0OverlayField(canonicalDigest(candidatePlanState) === carrier.basePlanStateDigest, 'E_R24_W0_OVERLAY_CANDIDATE_PLAN_DIGEST');
  assertW0OverlayField(canonicalDigest(candidateProgram) === carrier.baseProgramDigest, 'E_R24_W0_OVERLAY_CANDIDATE_PROGRAM_DIGEST');

  return {
    schemaVersion: 'R24_EFFECTIVE_STATE_OVERLAY_V1',
    overlayId: carrier.overlayId,
    sequence: 0,
    predecessorOverlayId: null,
    targetNodeId: carrier.targetNodeId,
    from: carrier.from,
    to: carrier.to,
    baseHeadSha: evaluationHeadSha,
    baseTreeSha: evaluationTreeSha,
    basePlanStateDigest: carrier.basePlanStateDigest,
    baseProgramDigest: carrier.baseProgramDigest,
    receiptId: carrier.physicalReceiptId,
    receiptSha256: carrier.physicalReceiptSha256,
    proofAuthority: carrier.proofAuthority,
    source: carrier.source,
    transitionId: canonicalDigest({
      overlayId: carrier.overlayId,
      targetNodeId: carrier.targetNodeId,
      immutableCandidateHeadSha: carrier.immutableCandidateHeadSha,
      evaluationHeadSha,
      physicalReceiptSha256: carrier.physicalReceiptSha256,
    }),
    selfPromotion: false,
    reason: 'W0_WORD_PHYSICAL_RECERTIFICATION_OWNER_APPROVED_PHYSICAL_RECEIPT_CURRENT_HEAD_CLOSURE',
  };
}

export function loadCommittedEffectiveStateOverlays({
  program,
  planState,
  evaluationHeadSha,
  evaluationTreeSha,
}) {
  const carrier = readJsonBounded(path.join(REPO_ROOT, W0_CURRENT_HEAD_EFFECTIVE_STATE_OVERLAY_PATH));
  return [normalizeW0EffectiveStateOverlay(carrier, {
    program,
    planState,
    evaluationHeadSha,
    evaluationTreeSha,
  })];
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

export function compileCommittedEffectiveState({ now = new Date().toISOString() } = {}) {
  const program = readJsonBounded(path.join(R24_DIR, 'EXECUTABLE_PROGRAM_R2_4.json'));
  const planState = readJsonBounded(path.join(R24_DIR, 'PLAN_STATE_R24.json'));
  const evaluationHeadSha = git(['rev-parse', 'HEAD']);
  const evaluationTreeSha = git(['rev-parse', 'HEAD^{tree}']);
  const originMainSha = git(['rev-parse', 'origin/main']);
  const overlays = loadCommittedEffectiveStateOverlays({
    program,
    planState,
    evaluationHeadSha,
    evaluationTreeSha,
  });
  return compileEffectiveState({
    program,
    planState,
    overlays,
    generatedAt: now,
    exactIdentity: {
      implementationSourceSha: evaluationHeadSha,
      evaluationHeadSha,
      evaluationTreeSha,
      originMainSha,
    },
  });
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const now = args.get('--now') || new Date().toISOString();
  const projection = compileCommittedEffectiveState({ now });
  if (args.has('--json')) {
    process.stdout.write(`${JSON.stringify(projection, null, 2)}\n`);
  } else {
    process.stdout.write(`R24_EFFECTIVE_STATE_PROJECTION=${JSON.stringify({
      schemaVersion: projection.schemaVersion,
      compilerId: projection.compilerId,
      effectiveStateDigest: projection.effectiveState.digest,
      schedulerStateDigest: projection.schedulerProjection.stateDigest,
      rawPlanStateDigest: projection.sourceDigests.rawPlanStateDigest,
      programDigest: projection.sourceDigests.programDigest,
      activeLeaseCount: projection.rawState.activeLeaseCount,
      appliedOverlayCount: projection.overlayResolution.appliedCount,
      freshlyProvenDeliveryCount: projection.statusProjection.freshlyProvenDeliveryCount,
      freshlyProvenAttestationCount: projection.statusProjection.freshlyProvenAttestationCount,
      programDone: projection.completion.programDone,
      generatedAt: projection.generatedAt,
    })}\n`);
  }
  if (args.get('--check') === 'true') {
    const planStatePath = path.join(R24_DIR, 'PLAN_STATE_R24.json');
    const before = sha256File(planStatePath);
    const after = sha256File(planStatePath);
    if (before !== after) throw new R24Error('E_R24_EFFECTIVE_RAW_STATE_MUTATED');
  }
  return projection;
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
