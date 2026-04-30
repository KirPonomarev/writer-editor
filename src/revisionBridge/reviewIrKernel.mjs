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
const EXACT_TEXT_OP_KINDS = new Set(['TEXT_REPLACE', 'EXACT_TEXT_REPLACE']);
const COMMENT_OP_KINDS = new Set(['COMMENT', 'COMMENT_CREATE', 'COMMENT_REPLY', 'COMMENT_RESOLVE']);

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
  STRUCTURAL_MANUAL_ONLY: 'STRUCTURAL_MANUAL_ONLY',
  CLOSED_SESSION: 'CLOSED_SESSION',
  SCENE_MISMATCH: 'SCENE_MISMATCH',
  BLOCK_VERSION_MISMATCH: 'BLOCK_VERSION_MISMATCH',
  EXACT_TEXT_MISMATCH: 'EXACT_TEXT_MISMATCH',
  COMMENT_APPLY_OUT_OF_SCOPE: 'COMMENT_APPLY_OUT_OF_SCOPE',
  MISSING_PRECONDITION: 'MISSING_PRECONDITION',
  UNSUPPORTED_OP_KIND: 'UNSUPPORTED_OP_KIND',
  EFFECT_PRECONDITION_MISSING: 'EFFECT_PRECONDITION_MISSING',
  EFFECT_PREVIEW_MISMATCH: 'EFFECT_PREVIEW_MISMATCH',
  NON_CONTRACT_APPLYOP_FORBIDDEN: 'NON_CONTRACT_APPLYOP_FORBIDDEN',
  RUNTIME_WRITE_FORBIDDEN_IN_CONTOUR: 'RUNTIME_WRITE_FORBIDDEN_IN_CONTOUR',
  PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR: 'PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR',
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

function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
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
      ...(hasValue(item.blockVersionHash) ? { blockVersionHash: item.blockVersionHash } : {}),
      ...(hasValue(item.preconditions?.blockVersionHash)
        ? { blockVersionHash: item.preconditions.blockVersionHash }
        : {}),
    },
    reasonCodes,
    ...(matchProof ? { matchProof } : {}),
    ...(hasValue(item.replacementText) || hasValue(item.newText) || hasValue(item.expectedText)
      ? {
        textPatch: {
          expectedText: normalizeText(item.expectedText || item.evidenceRefs?.[0]?.exactText || item.evidence?.[0]?.exactText || ''),
          replacementText: normalizeText(item.replacementText || item.newText || ''),
        },
      }
      : {}),
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

function textFromEvidence(op) {
  return normalizeText(
    op?.textPatch?.expectedText
      || op?.evidenceRefs?.[0]?.exactText
      || op?.evidenceRefs?.[0]?.quotedSegment
      || '',
  );
}

function replacementTextFromOp(op) {
  return normalizeText(op?.textPatch?.replacementText || '');
}

function currentTextForOp(op, environment) {
  const blockId = op?.targetScope?.blockId;
  if (blockId && environment.currentTextByBlock && hasValue(environment.currentTextByBlock[blockId])) {
    return normalizeText(environment.currentTextByBlock[blockId]);
  }
  if (blockId && environment.exactTextByBlock && hasValue(environment.exactTextByBlock[blockId])) {
    return normalizeText(environment.exactTextByBlock[blockId]);
  }
  if (hasValue(environment.currentExactText)) {
    return normalizeText(environment.currentExactText);
  }
  if (hasValue(environment.currentText)) {
    return normalizeText(environment.currentText);
  }
  if (hasValue(environment.selectedText)) {
    return normalizeText(environment.selectedText);
  }
  return null;
}

function currentBlockVersionForOp(op, environment) {
  const blockId = op?.targetScope?.blockId;
  if (blockId && environment.currentBlockVersions && hasValue(environment.currentBlockVersions[blockId])) {
    return environment.currentBlockVersions[blockId];
  }
  if (hasValue(environment.currentBlockVersionHash)) {
    return environment.currentBlockVersionHash;
  }
  if (hasValue(environment.blockVersionHash)) {
    return environment.blockVersionHash;
  }
  return null;
}

function reasonCodesForApplyOp(op) {
  const reasons = [];
  for (const reasonCode of op?.reasonCodes || []) {
    reasons.push(
      reasonCode === REASON_CODES.STRUCTURAL_RISK
        ? REASON_CODES.STRUCTURAL_MANUAL_ONLY
        : reasonCode,
    );
  }
  if (STRUCTURAL_KINDS.has(op?.opKind)) {
    reasons.push(REASON_CODES.STRUCTURAL_MANUAL_ONLY);
  }
  if (COMMENT_OP_KINDS.has(op?.opKind)) {
    reasons.push(REASON_CODES.COMMENT_APPLY_OUT_OF_SCOPE);
  }
  if (!EXACT_TEXT_OP_KINDS.has(op?.opKind) && !STRUCTURAL_KINDS.has(op?.opKind) && !COMMENT_OP_KINDS.has(op?.opKind)) {
    reasons.push(REASON_CODES.UNSUPPORTED_OP_KIND);
  }
  return uniqueStrings(reasons);
}

function validateExactTextApplyOp(op, patchSet, environment) {
  const reasons = reasonCodesForApplyOp(op);
  const expectedSceneId = op?.targetScope?.sceneId;
  if (!hasValue(expectedSceneId) || !hasValue(environment.sceneId)) {
    reasons.push(REASON_CODES.MISSING_PRECONDITION);
  } else if (expectedSceneId !== environment.sceneId) {
    reasons.push(REASON_CODES.SCENE_MISMATCH);
  }
  if (!hasValue(environment.sessionOpen) && !hasValue(environment.sessionStatus)) {
    reasons.push(REASON_CODES.MISSING_PRECONDITION);
  }

  const expectedBlockVersion = op?.preconditions?.blockVersionHash || op?.targetScope?.blockVersionHash;
  const currentBlockVersion = currentBlockVersionForOp(op, environment);
  if (!hasValue(expectedBlockVersion) || !hasValue(currentBlockVersion)) {
    reasons.push(REASON_CODES.MISSING_PRECONDITION);
  } else if (expectedBlockVersion !== currentBlockVersion) {
    reasons.push(REASON_CODES.BLOCK_VERSION_MISMATCH);
  }

  const expectedText = textFromEvidence(op);
  const replacementText = replacementTextFromOp(op);
  const currentText = currentTextForOp(op, environment);
  if (!hasValue(expectedText) || !hasValue(replacementText) || currentText === null) {
    reasons.push(REASON_CODES.MISSING_PRECONDITION);
  } else if (currentText !== expectedText) {
    reasons.push(REASON_CODES.EXACT_TEXT_MISMATCH);
  }

  if (!hasValue(patchSet?.projectId) || !hasValue(patchSet?.contextHash) || !hasValue(op?.opId)) {
    reasons.push(REASON_CODES.MISSING_PRECONDITION);
  }
  return uniqueStrings(reasons);
}

function createContractOnlyApplyOp(op, patchSet) {
  const target = {
    sceneId: op.targetScope.sceneId,
    blockId: op.targetScope.blockId,
  };
  const patch = {
    expectedText: textFromEvidence(op),
    replacementText: replacementTextFromOp(op),
  };
  const tests = {
    projectIdEquals: patchSet.projectId,
    sceneIdEquals: op.targetScope.sceneId,
    baselineHashEquals: patchSet.contextHash,
    blockVersionHashEquals: op.preconditions.blockVersionHash || op.targetScope.blockVersionHash,
    exactTextEquals: textFromEvidence(op),
    sessionStatusOpen: true,
    selectorStatusExact: true,
  };
  const applyOpCore = {
    opId: `apply_${canonicalHash({
      sourceReviewOpId: op.opId,
      sourceReviewOpHash: op.canonicalHash,
      target,
      tests,
      patch,
    }).slice(0, 16)}`,
    opKind: 'EXACT_TEXT_REPLACE',
    target,
    tests,
    patch,
    riskClass: op.riskClass,
    automationPolicy: op.automationPolicy,
    evidenceRefs: op.evidenceRefs,
    runtimeWritable: false,
    reasonCodes: [],
    contractOnly: true,
    sourceReviewOpId: op.opId,
    sourceReviewOpHash: op.canonicalHash,
  };
  return {
    ...applyOpCore,
    canonicalHash: canonicalHash(applyOpCore),
  };
}

export function compileExactTextApplyOps(patchSet, environment = {}) {
  const blockedReasons = [];
  if (!hasValue(patchSet?.projectId) || !hasValue(environment.projectId)) {
    blockedReasons.push(REASON_CODES.MISSING_PRECONDITION);
  } else if (patchSet.projectId !== environment.projectId) {
    blockedReasons.push(REASON_CODES.WRONG_PROJECT);
  }
  if (!hasValue(patchSet?.contextHash) || !hasValue(environment.currentBaselineHash)) {
    blockedReasons.push(REASON_CODES.MISSING_PRECONDITION);
  } else if (patchSet.contextHash !== environment.currentBaselineHash) {
    blockedReasons.push(REASON_CODES.STALE_BASELINE);
  }
  if (environment.sessionOpen === false || environment.sessionStatus === 'CLOSED') {
    blockedReasons.push(REASON_CODES.CLOSED_SESSION);
  }
  for (const observation of patchSet?.unsupportedObservations || []) {
    blockedReasons.push(...observation.reasonCodes);
  }
  for (const op of patchSet?.reviewOps || []) {
    blockedReasons.push(...validateExactTextApplyOp(op, patchSet, environment));
  }

  const uniqueBlockedReasons = uniqueStrings(blockedReasons);
  return {
    contractOnly: true,
    runtimeWritable: false,
    applyOps: uniqueBlockedReasons.length === 0
      ? (patchSet?.reviewOps || []).map((op) => createContractOnlyApplyOp(op, patchSet))
      : [],
    blockedReasons: uniqueBlockedReasons,
  };
}

function validateExactTextApplyEffectPreviewInput(applyOp) {
  const reasons = [];
  if (applyOp?.contractOnly !== true) {
    reasons.push(REASON_CODES.NON_CONTRACT_APPLYOP_FORBIDDEN);
  }
  if (applyOp?.runtimeWritable !== false) {
    reasons.push(REASON_CODES.RUNTIME_WRITE_FORBIDDEN_IN_CONTOUR);
  }
  if (applyOp?.opKind !== 'EXACT_TEXT_REPLACE') {
    reasons.push(REASON_CODES.EFFECT_PRECONDITION_MISSING);
  }
  if (
    !hasValue(applyOp?.opId)
    || !hasValue(applyOp?.canonicalHash)
    || !hasValue(applyOp?.target?.sceneId)
    || !hasValue(applyOp?.tests?.projectIdEquals)
    || !hasValue(applyOp?.tests?.baselineHashEquals)
    || !hasValue(applyOp?.tests?.blockVersionHashEquals)
    || !hasValue(applyOp?.patch?.expectedText)
    || !hasValue(applyOp?.patch?.replacementText)
  ) {
    reasons.push(REASON_CODES.EFFECT_PRECONDITION_MISSING);
  }
  reasons.push(...(applyOp?.reasonCodes || []));
  return uniqueStrings(reasons);
}

function createExactTextApplyEffectPreview(applyOp) {
  const exactTextBefore = normalizeText(applyOp.patch.expectedText);
  const exactTextAfter = normalizeText(applyOp.patch.replacementText);
  const beforeHash = canonicalHash({
    effectPreviewTextKind: 'EXACT_TEXT_BEFORE',
    text: exactTextBefore,
  });
  const afterHashPreview = canonicalHash({
    effectPreviewTextKind: 'EXACT_TEXT_AFTER_PREVIEW',
    text: exactTextAfter,
  });
  const previewCore = {
    effectPreviewKind: 'EXACT_TEXT_REPLACE_EFFECT_PREVIEW',
    sourceApplyOpId: applyOp.opId,
    sourceApplyOpHash: applyOp.canonicalHash,
    projectId: applyOp.tests.projectIdEquals,
    sceneId: applyOp.target.sceneId,
    baselineHash: applyOp.tests.baselineHashEquals,
    blockVersionHash: applyOp.tests.blockVersionHashEquals,
    exactTextBefore,
    exactTextAfter,
    beforeHash,
    afterHashPreview,
    inversePatchPreview: {
      expectedText: exactTextAfter,
      replacementText: exactTextBefore,
    },
    runtimeWritable: false,
  };
  const previewWithId = {
    effectPreviewId: `effect_preview_${canonicalHash(previewCore).slice(0, 16)}`,
    ...previewCore,
  };
  return {
    ...previewWithId,
    canonicalHash: canonicalHash(previewWithId),
  };
}

export function compileExactTextApplyEffectPreviews(applyResult = {}) {
  const blockedReasons = [
    ...(applyResult?.blockedReasons || []),
  ];
  if (applyResult?.contractOnly !== true) {
    blockedReasons.push(REASON_CODES.NON_CONTRACT_APPLYOP_FORBIDDEN);
  }
  if (applyResult?.runtimeWritable !== false) {
    blockedReasons.push(REASON_CODES.RUNTIME_WRITE_FORBIDDEN_IN_CONTOUR);
  }
  if (!Array.isArray(applyResult?.applyOps)) {
    blockedReasons.push(REASON_CODES.EFFECT_PRECONDITION_MISSING);
  }
  for (const applyOp of applyResult?.applyOps || []) {
    blockedReasons.push(...validateExactTextApplyEffectPreviewInput(applyOp));
  }

  const uniqueBlockedReasons = uniqueStrings(blockedReasons);
  const effectPreviews = uniqueBlockedReasons.length === 0
    ? (applyResult.applyOps || []).map(createExactTextApplyEffectPreview)
    : [];
  const planCore = {
    planKind: 'EXACT_TEXT_APPLY_EFFECT_PREVIEW_PLAN',
    contractOnly: true,
    runtimeWritable: false,
    effectPreviews,
    blockedReasons: uniqueBlockedReasons,
  };
  const planWithId = {
    planId: `effect_plan_${canonicalHash(planCore).slice(0, 16)}`,
    ...planCore,
  };
  return {
    ...planWithId,
    canonicalHash: canonicalHash(planWithId),
  };
}

function validateWritePlanApplyOpInput(applyOp) {
  const reasons = validateExactTextApplyEffectPreviewInput(applyOp);
  if (!hasValue(applyOp?.tests?.sceneIdEquals) || !hasValue(applyOp?.tests?.exactTextEquals)) {
    reasons.push(REASON_CODES.EFFECT_PRECONDITION_MISSING);
  }
  return uniqueStrings(reasons);
}

function validateWritePlanPreviewInput(effectPreview, applyOp) {
  const reasons = [];
  if (
    !hasValue(effectPreview?.effectPreviewId)
    || !hasValue(effectPreview?.canonicalHash)
    || effectPreview?.effectPreviewKind !== 'EXACT_TEXT_REPLACE_EFFECT_PREVIEW'
    || effectPreview?.runtimeWritable !== false
  ) {
    reasons.push(REASON_CODES.EFFECT_PRECONDITION_MISSING);
  }
  const expected = {
    sourceApplyOpId: applyOp?.opId,
    sourceApplyOpHash: applyOp?.canonicalHash,
    projectId: applyOp?.tests?.projectIdEquals,
    sceneId: applyOp?.tests?.sceneIdEquals || applyOp?.target?.sceneId,
    baselineHash: applyOp?.tests?.baselineHashEquals,
    blockVersionHash: applyOp?.tests?.blockVersionHashEquals,
    exactTextBefore: normalizeText(applyOp?.patch?.expectedText || ''),
    exactTextAfter: normalizeText(applyOp?.patch?.replacementText || ''),
  };
  for (const [key, value] of Object.entries(expected)) {
    if (!hasValue(value) || effectPreview?.[key] !== value) {
      reasons.push(REASON_CODES.EFFECT_PREVIEW_MISMATCH);
    }
  }
  const expectedBeforeHash = canonicalHash({
    effectPreviewTextKind: 'EXACT_TEXT_BEFORE',
    text: expected.exactTextBefore,
  });
  const expectedAfterHash = canonicalHash({
    effectPreviewTextKind: 'EXACT_TEXT_AFTER_PREVIEW',
    text: expected.exactTextAfter,
  });
  if (effectPreview?.beforeHash !== expectedBeforeHash || effectPreview?.afterHashPreview !== expectedAfterHash) {
    reasons.push(REASON_CODES.EFFECT_PREVIEW_MISMATCH);
  }
  return uniqueStrings(reasons);
}

function createExactTextWritePlanContract(applyOp, effectPreview) {
  const planCore = {
    writePlanKind: 'EXACT_TEXT_REPLACE_WRITE_PLAN_CONTRACT',
    productWrite: false,
    durableWrite: false,
    runtimeWritable: false,
    sourceApplyOpId: applyOp.opId,
    sourceApplyOpHash: applyOp.canonicalHash,
    effectPreviewId: effectPreview.effectPreviewId,
    effectPreviewHash: effectPreview.canonicalHash,
    projectId: applyOp.tests.projectIdEquals,
    sceneId: applyOp.tests.sceneIdEquals,
    baselineHash: applyOp.tests.baselineHashEquals,
    blockVersionHash: applyOp.tests.blockVersionHashEquals,
    exactTextBefore: normalizeText(applyOp.patch.expectedText),
    exactTextAfter: normalizeText(applyOp.patch.replacementText),
    beforeHash: effectPreview.beforeHash,
    afterHashExpected: effectPreview.afterHashPreview,
    requiresBackupBeforeWrite: true,
    requiresAtomicSceneWrite: true,
    requiresReadableRecoverySnapshot: true,
  };
  const planWithId = {
    writePlanId: `write_plan_${canonicalHash(planCore).slice(0, 16)}`,
    ...planCore,
  };
  return {
    ...planWithId,
    canonicalHash: canonicalHash(planWithId),
  };
}

function createExactTextReceiptContract(writePlan, input = {}) {
  const receiptCore = {
    receiptKind: 'EXACT_TEXT_REPLACE_RECEIPT_CONTRACT',
    productWrite: false,
    durableReceipt: false,
    runtimeWritable: false,
    resultStatus: input.resultStatus || 'PLANNED_NOT_EXECUTED',
    reasonCodes: uniqueStrings(input.reasonCodes || []),
    writePlanId: writePlan.writePlanId,
    writePlanHash: writePlan.canonicalHash,
    projectId: writePlan.projectId,
    sceneId: writePlan.sceneId,
    sourceApplyOpId: writePlan.sourceApplyOpId,
    sourceApplyOpHash: writePlan.sourceApplyOpHash,
    effectPreviewId: writePlan.effectPreviewId,
    effectPreviewHash: writePlan.effectPreviewHash,
    beforeHash: writePlan.beforeHash,
    afterHash: writePlan.afterHashExpected,
    backupRequired: writePlan.requiresBackupBeforeWrite,
    atomicSceneWriteRequired: writePlan.requiresAtomicSceneWrite,
    readableRecoverySnapshotRequired: writePlan.requiresReadableRecoverySnapshot,
  };
  const receiptWithId = {
    receiptContractId: `receipt_contract_${canonicalHash(receiptCore).slice(0, 16)}`,
    ...receiptCore,
  };
  return {
    ...receiptWithId,
    canonicalHash: canonicalHash(receiptWithId),
  };
}

export function compileExactTextWritePlanReceiptContract(input = {}) {
  const applyOps = input?.applyResult?.applyOps || [];
  const effectPreviews = input?.effectPreviewPlan?.effectPreviews || [];
  const blockedReasons = [
    ...(input?.applyResult?.blockedReasons || []),
    ...(input?.effectPreviewPlan?.blockedReasons || []),
  ];
  if (input?.applyResult?.contractOnly !== true || input?.effectPreviewPlan?.contractOnly !== true) {
    blockedReasons.push(REASON_CODES.NON_CONTRACT_APPLYOP_FORBIDDEN);
  }
  if (input?.applyResult?.runtimeWritable !== false || input?.effectPreviewPlan?.runtimeWritable !== false) {
    blockedReasons.push(REASON_CODES.RUNTIME_WRITE_FORBIDDEN_IN_CONTOUR);
  }
  if (input?.productWrite === true || input?.runtimeWritable === true) {
    blockedReasons.push(REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR);
  }
  if (applyOps.length !== 1 || effectPreviews.length !== 1) {
    blockedReasons.push(REASON_CODES.EFFECT_PRECONDITION_MISSING);
  }

  const applyOp = applyOps[0];
  const effectPreview = effectPreviews[0];
  if (applyOp) {
    blockedReasons.push(...validateWritePlanApplyOpInput(applyOp));
  }
  if (applyOp && effectPreview) {
    blockedReasons.push(...validateWritePlanPreviewInput(effectPreview, applyOp));
  } else if (effectPreview) {
    blockedReasons.push(REASON_CODES.EFFECT_PRECONDITION_MISSING);
  }

  const uniqueBlockedReasons = uniqueStrings(blockedReasons);
  const writePlans = uniqueBlockedReasons.length === 0
    ? [createExactTextWritePlanContract(applyOp, effectPreview)]
    : [];
  const receiptContracts = writePlans.map((writePlan) => createExactTextReceiptContract(writePlan));
  const resultCore = {
    resultKind: 'EXACT_TEXT_WRITE_PLAN_RECEIPT_CONTRACT_RESULT',
    contractOnly: true,
    productWrite: false,
    durableReceipt: false,
    storageSafetyClaimed: false,
    crashRecoveryClaimed: false,
    applyTxnClaimed: false,
    publicSurfaceClaimed: false,
    docxImportClaimed: false,
    releaseClaimed: false,
    runtimeWritable: false,
    writePlans,
    receiptContracts,
    blockedReasons: uniqueBlockedReasons,
  };
  return {
    ...resultCore,
    canonicalHash: canonicalHash(resultCore),
  };
}
