import { createHash } from 'node:crypto';

const DEFAULT_NORMALIZATION_POLICY = Object.freeze({
  newlinePolicy: 'LF',
  unicodePolicy: 'NFC',
});

const BLOCKING_SELECTOR_KINDS = new Map([
  ['TEXT_POSITION', 'TEXT_POSITION_ONLY'],
  ['HEADING', 'HEADING_ONLY'],
  ['ORDINAL', 'ORDINAL_ONLY'],
]);

const STRUCTURAL_KINDS = new Set(['MOVE', 'SPLIT', 'MERGE', 'STRUCTURAL']);

export const AUTOMATION_POLICY = Object.freeze({
  AUTO_ELIGIBLE: 'AUTO_ELIGIBLE',
  MANUAL_ONLY: 'MANUAL_ONLY',
  BLOCKED: 'BLOCKED',
});

export const RISK_CLASS = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
});

export const MATCH_PROOF_STATUS = Object.freeze({
  EXACT: 'EXACT',
  AMBIGUOUS: 'AMBIGUOUS',
  NO_MATCH: 'NO_MATCH',
});

export const REASON_CODES = Object.freeze({
  STALE_BASELINE: 'STALE_BASELINE',
  WRONG_PROJECT: 'WRONG_PROJECT',
  MISSING_PROJECT_BINDING: 'MISSING_PROJECT_BINDING',
  MULTI_MATCH: 'MULTI_MATCH',
  LOW_SELECTOR_CONFIDENCE: 'LOW_SELECTOR_CONFIDENCE',
  TEXT_POSITION_ONLY: 'TEXT_POSITION_ONLY',
  HEADING_ONLY: 'HEADING_ONLY',
  ORDINAL_ONLY: 'ORDINAL_ONLY',
  UNSUPPORTED_SURFACE: 'UNSUPPORTED_SURFACE',
  STRUCTURAL_RISK: 'STRUCTURAL_RISK',
  VIEWMODE_MISMATCH: 'VIEWMODE_MISMATCH',
  REVISION_MISMATCH: 'REVISION_MISMATCH',
});

export function normalizeText(value, policy = DEFAULT_NORMALIZATION_POLICY) {
  const normalizedNewlines = String(value ?? '').replace(/\r\n?/gu, '\n');
  if (policy.unicodePolicy === 'NONE') {
    return normalizedNewlines;
  }
  return normalizedNewlines.normalize(policy.unicodePolicy || 'NFC');
}

function canonicalize(value, seen = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('canonicalJson rejects non-finite numbers');
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item, seen));
  }
  if (typeof value === 'object') {
    if (seen.has(value)) {
      throw new TypeError('canonicalJson rejects cyclic values');
    }
    seen.add(value);
    const output = {};
    for (const key of Object.keys(value).sort()) {
      output[key] = canonicalize(value[key], seen);
    }
    seen.delete(value);
    return output;
  }
  throw new TypeError(`canonicalJson rejects ${typeof value}`);
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function canonicalHash(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function createSourceViewState(input = {}) {
  const normalizationPolicy = input.normalizationPolicy || 'TEXT_V1';
  const newlinePolicy = input.newlinePolicy || DEFAULT_NORMALIZATION_POLICY.newlinePolicy;
  const unicodePolicy = input.unicodePolicy || DEFAULT_NORMALIZATION_POLICY.unicodePolicy;
  const packetSeed = {
    artifactCompletenessClass: input.artifactCompletenessClass || 'TEXT_ONLY',
    normalizationPolicy,
    revisionToken: input.revisionToken || 'LOCAL_SYNTHETIC_REVISION',
    unicodePolicy,
    viewMode: input.viewMode || 'LOCAL_SYNTHETIC_VIEW',
    newlinePolicy,
  };
  return {
    revisionToken: packetSeed.revisionToken,
    viewMode: packetSeed.viewMode,
    normalizationPolicy,
    newlinePolicy,
    unicodePolicy,
    packetHash: input.packetHash || canonicalHash(packetSeed),
    artifactCompletenessClass: packetSeed.artifactCompletenessClass,
  };
}

export function createSelectorStack(selectors = [], sourceState = {}) {
  return selectors.map((selector, index) => ({
    selectorKind: selector.selectorKind || selector.kind || 'TEXT_QUOTE',
    normalizationPolicy: selector.normalizationPolicy || sourceState.normalizationPolicy || 'TEXT_V1',
    selectorEvidence: selector.selectorEvidence || selector.evidence || {},
    ambiguityReason: selector.ambiguityReason || '',
    sourceState: {
      revisionToken: sourceState.revisionToken || 'LOCAL_SYNTHETIC_REVISION',
      viewMode: sourceState.viewMode || 'LOCAL_SYNTHETIC_VIEW',
    },
    order: index,
  }));
}

export function createEvidenceRef(input = {}) {
  const evidence = {
    evidenceId: input.evidenceId || '',
    sourcePart: input.sourcePart || 'synthetic',
    exactText: normalizeText(input.exactText || ''),
    prefix: normalizeText(input.prefix || ''),
    suffix: normalizeText(input.suffix || ''),
    quotedSegment: normalizeText(input.quotedSegment || input.exactText || ''),
  };
  return {
    ...evidence,
    evidenceHash: input.evidenceHash || canonicalHash(evidence),
  };
}

function selectorReasonCodes(selectors) {
  if (selectors.length === 0) {
    return [REASON_CODES.LOW_SELECTOR_CONFIDENCE];
  }
  if (selectors.length === 1) {
    const selectorKind = selectors[0].selectorKind;
    return BLOCKING_SELECTOR_KINDS.has(selectorKind)
      ? [BLOCKING_SELECTOR_KINDS.get(selectorKind)]
      : [];
  }
  if (selectors.some((selector) => selector.ambiguityReason === 'MULTI_MATCH')) {
    return [REASON_CODES.MULTI_MATCH];
  }
  return [];
}

function uniqueStrings(items) {
  return Array.from(new Set(items.filter(Boolean))).sort();
}

function toNonNegativeInteger(value, fallback) {
  const candidate = value ?? fallback;
  if (!Number.isInteger(candidate) || candidate < 0) {
    throw new TypeError('expected non-negative integer');
  }
  return candidate;
}

function expectedMatchStatusForCandidateCount(candidateCount) {
  if (candidateCount === 0) {
    return MATCH_PROOF_STATUS.NO_MATCH;
  }
  if (candidateCount === 1) {
    return MATCH_PROOF_STATUS.EXACT;
  }
  return MATCH_PROOF_STATUS.AMBIGUOUS;
}

function deriveMatchStatus({ candidateCount, matchStatus }) {
  const expectedMatchStatus = expectedMatchStatusForCandidateCount(candidateCount);
  if (!matchStatus) {
    return expectedMatchStatus;
  }
  if (!Object.values(MATCH_PROOF_STATUS).includes(matchStatus)) {
    throw new TypeError('unknown match proof status');
  }
  if (matchStatus !== expectedMatchStatus) {
    throw new TypeError('match proof status conflicts with candidate count');
  }
  return matchStatus;
}

export function createMatchProof(input = {}) {
  const sourceViewState = createSourceViewState(input.sourceViewState || {});
  const selectorStack = createSelectorStack(input.selectorStack || input.selectors || [], sourceViewState);
  const evidenceRefs = (input.evidenceRefs || input.evidence || []).map(createEvidenceRef);
  const candidateCount = toNonNegativeInteger(
    input.candidateCount,
    Array.isArray(input.candidates) ? input.candidates.length : 0,
  );
  const matchStatus = deriveMatchStatus({ candidateCount, matchStatus: input.matchStatus });
  const proofCore = {
    proofKind: input.proofKind || 'STATIC_MATCH_PROOF',
    itemId: input.itemId || input.id || '',
    targetScope: input.targetScope || { sceneId: input.sceneId || 'synthetic-scene' },
    selectorStack,
    evidenceRefs,
    candidateCount,
    matchStatus,
    reasonCodes: uniqueStrings([
      ...(input.reasonCodes || []),
      ...(matchStatus === MATCH_PROOF_STATUS.NO_MATCH ? [REASON_CODES.LOW_SELECTOR_CONFIDENCE] : []),
      ...(matchStatus === MATCH_PROOF_STATUS.AMBIGUOUS ? [REASON_CODES.MULTI_MATCH] : []),
      ...(selectorReasonCodes(selectorStack)),
    ]),
    sourceViewState,
  };
  return {
    ...proofCore,
    proofHash: canonicalHash(proofCore),
  };
}

export function createParsedSurfaceRecord(input = {}) {
  const sourceViewState = createSourceViewState(input.sourceViewState || {});
  const items = (input.items || []).map((item, index) => ({
    itemId: item.itemId || item.id || `item-${index}`,
    supported: item.supported !== false,
    kind: item.kind || item.opKind || item.surfaceKind || 'TEXT_REPLACE',
    targetScope: item.targetScope || { sceneId: item.sceneId || 'synthetic-scene' },
    selectorStack: createSelectorStack(item.selectorStack || item.selectors || [], sourceViewState),
    evidenceRefs: (item.evidenceRefs || item.evidence || []).map(createEvidenceRef),
    order: index,
  }));
  const recordCore = {
    recordKind: input.recordKind || 'STATIC_PARSED_SURFACE_RECORD',
    projectId: input.projectId || '',
    artifactHash: input.artifactHash || '',
    contextHash: input.contextHash || '',
    sourceViewState,
    items,
  };
  return {
    parsedSurfaceRecordId: `psr_${canonicalHash(recordCore).slice(0, 16)}`,
    ...recordCore,
    recordHash: canonicalHash(recordCore),
  };
}

function deriveAutomation({ item, selectors, unsupported, matchProof }) {
  const reasons = [];
  if (unsupported) {
    reasons.push(REASON_CODES.UNSUPPORTED_SURFACE);
  }
  reasons.push(...(item.reasonCodes || []));
  reasons.push(...(matchProof?.reasonCodes || []));
  if (item.duplicateText === true || item.ambiguous === true) {
    reasons.push(REASON_CODES.MULTI_MATCH);
  }
  if (STRUCTURAL_KINDS.has(item.opKind || item.kind)) {
    reasons.push(REASON_CODES.STRUCTURAL_RISK);
  }
  reasons.push(...selectorReasonCodes(selectors));
  const reasonCodes = uniqueStrings(reasons);
  const riskClass = reasonCodes.includes(REASON_CODES.STRUCTURAL_RISK)
    ? RISK_CLASS.HIGH
    : (reasonCodes.length > 0 ? RISK_CLASS.MEDIUM : RISK_CLASS.LOW);
  const automationPolicy = reasonCodes.length > 0
    ? AUTOMATION_POLICY.MANUAL_ONLY
    : AUTOMATION_POLICY.AUTO_ELIGIBLE;
  return { reasonCodes, riskClass, automationPolicy };
}

export function createUnsupportedObservation(item, sourceViewState) {
  const evidenceRefs = (item.evidenceRefs || item.evidence || []).map(createEvidenceRef);
  const observationCore = {
    itemId: item.itemId || item.id || '',
    surfaceKind: item.surfaceKind || item.kind || 'UNSUPPORTED',
    reasonCodes: uniqueStrings([
      REASON_CODES.UNSUPPORTED_SURFACE,
      ...(item.reasonCodes || []),
    ]),
    evidenceRefs,
    sourceViewState,
  };
  return {
    ...observationCore,
    observationHash: canonicalHash(observationCore),
  };
}

export function createReviewOp(item, sourceViewState, context) {
  const selectorStack = createSelectorStack(item.selectors || item.selectorStack || [], sourceViewState);
  const evidenceRefs = (item.evidenceRefs || item.evidence || []).map(createEvidenceRef);
  const matchProof = item.matchProof
    ? createMatchProof({
      ...item.matchProof,
      itemId: item.matchProof.itemId || item.itemId || item.id || '',
      targetScope: item.matchProof.targetScope || item.targetScope || { sceneId: item.sceneId || 'synthetic-scene' },
      sourceViewState: item.matchProof.sourceViewState || sourceViewState,
    })
    : null;
  const { reasonCodes, riskClass, automationPolicy } = deriveAutomation({
    item,
    selectors: selectorStack,
    unsupported: false,
    matchProof,
  });
  const opCore = {
    opKind: item.opKind || item.kind || 'TEXT_REPLACE',
    targetScope: item.targetScope || { sceneId: item.sceneId || 'synthetic-scene' },
    selectorStack,
    evidenceRefs,
    riskClass,
    automationPolicy,
    preconditions: {
      projectId: context.projectId,
      contextHash: context.contextHash,
      baselineHash: context.expectedBaselineHash || context.contextHash,
    },
    reasonCodes,
    ...(matchProof ? { matchProof } : {}),
  };
  const opId = `op_${canonicalHash({
    artifactHash: context.artifactHash,
    itemId: item.itemId || item.id || '',
    opCore,
  }).slice(0, 16)}`;
  const opWithId = { opId, ...opCore };
  return {
    ...opWithId,
    canonicalHash: canonicalHash(opWithId),
  };
}

export function createMinimalReviewBom({ reviewOps, unsupportedObservations }) {
  const reasonCodeCounts = {};
  for (const reasonCode of [
    ...reviewOps.flatMap((op) => op.reasonCodes),
    ...unsupportedObservations.flatMap((observation) => observation.reasonCodes),
  ]) {
    reasonCodeCounts[reasonCode] = (reasonCodeCounts[reasonCode] || 0) + 1;
  }
  return {
    supportedSurfaceCount: reviewOps.length,
    unsupportedSurfaceCount: unsupportedObservations.length,
    blockedOpCount: reviewOps.filter((op) => op.automationPolicy !== AUTOMATION_POLICY.AUTO_ELIGIBLE).length,
    autoEligibleOpCount: reviewOps.filter((op) => op.automationPolicy === AUTOMATION_POLICY.AUTO_ELIGIBLE).length,
    reasonCodeCounts: Object.fromEntries(Object.entries(reasonCodeCounts).sort()),
    evidenceRefCount: reviewOps.reduce((count, op) => count + op.evidenceRefs.length, 0)
      + unsupportedObservations.reduce((count, observation) => count + observation.evidenceRefs.length, 0),
  };
}

export function buildReviewPatchSet(input = {}) {
  const sourceViewState = createSourceViewState(input.sourceViewState || {});
  const context = {
    projectId: input.projectId || '',
    artifactHash: input.artifactHash || '',
    contextHash: input.contextHash || '',
    expectedBaselineHash: input.expectedBaselineHash || input.contextHash || '',
  };
  const supportedItems = (input.items || []).filter((item) => item.supported !== false);
  const unsupportedItems = (input.items || []).filter((item) => item.supported === false);
  const reviewOps = supportedItems.map((item) => createReviewOp(item, sourceViewState, context));
  const unsupportedObservations = unsupportedItems.map((item) => createUnsupportedObservation(item, sourceViewState));
  const reviewBom = createMinimalReviewBom({ reviewOps, unsupportedObservations });
  const patchSetCore = {
    projectId: context.projectId,
    artifactHash: context.artifactHash,
    contextHash: context.contextHash,
    sourceViewState,
    reviewOps,
    unsupportedObservations,
    reviewBom,
    blockedReasons: [],
  };
  return {
    patchSetId: `ps_${canonicalHash({
      artifactHash: context.artifactHash,
      contextHash: context.contextHash,
      projectId: context.projectId,
    }).slice(0, 16)}`,
    ...patchSetCore,
  };
}

export function previewApplyBlockers(patchSet, environment = {}) {
  const blockedReasons = [];
  if (!patchSet?.projectId) {
    blockedReasons.push(REASON_CODES.MISSING_PROJECT_BINDING);
  }
  if (environment.projectId && patchSet?.projectId && environment.projectId !== patchSet.projectId) {
    blockedReasons.push(REASON_CODES.WRONG_PROJECT);
  }
  if (
    environment.currentBaselineHash
    && patchSet?.contextHash
    && environment.currentBaselineHash !== patchSet.contextHash
  ) {
    blockedReasons.push(REASON_CODES.STALE_BASELINE);
  }
  for (const op of patchSet?.reviewOps || []) {
    blockedReasons.push(...op.reasonCodes);
  }
  return {
    applyOps: [],
    blockedReasons: uniqueStrings(blockedReasons),
  };
}
