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
  BACKUP_CAPABILITY_MISSING: 'BACKUP_CAPABILITY_MISSING',
  ATOMIC_WRITE_CAPABILITY_MISSING: 'ATOMIC_WRITE_CAPABILITY_MISSING',
  RECOVERY_SNAPSHOT_CAPABILITY_MISSING: 'RECOVERY_SNAPSHOT_CAPABILITY_MISSING',
  HASH_REPORT_CAPABILITY_MISSING: 'HASH_REPORT_CAPABILITY_MISSING',
  PORT_FIXTURE_CAPABILITY_MISSING: 'PORT_FIXTURE_CAPABILITY_MISSING',
  RECEIPT_CONTRACT_MISMATCH: 'RECEIPT_CONTRACT_MISMATCH',
  STORAGE_CALL_PLAN_MISMATCH: 'STORAGE_CALL_PLAN_MISMATCH',
  STORAGE_ADMISSION_REQUIRED: 'STORAGE_ADMISSION_REQUIRED',
  OWNER_ADMISSION_MISSING: 'OWNER_ADMISSION_MISSING',
  MULTI_SCOPE_STORAGE_WRITE_BLOCKED: 'MULTI_SCOPE_STORAGE_WRITE_BLOCKED',
  STRUCTURAL_STORAGE_WRITE_BLOCKED: 'STRUCTURAL_STORAGE_WRITE_BLOCKED',
  RECEIPT_CAPABILITY_MISSING: 'RECEIPT_CAPABILITY_MISSING',
  PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR: 'PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR',
  FIXTURE_ROOT_POLICY_REQUIRED: 'FIXTURE_ROOT_POLICY_REQUIRED',
  FIXTURE_ROOT_CREATION_POLICY_REQUIRED: 'FIXTURE_ROOT_CREATION_POLICY_REQUIRED',
  FIXTURE_ROOT_CREATION_OWNER_MISSING: 'FIXTURE_ROOT_CREATION_OWNER_MISSING',
  FIXTURE_ROOT_CREATION_SCOPE_UNSAFE: 'FIXTURE_ROOT_CREATION_SCOPE_UNSAFE',
  FIXTURE_TEXT_WRITE_POLICY_REQUIRED: 'FIXTURE_TEXT_WRITE_POLICY_REQUIRED',
  FIXTURE_TEXT_WRITE_OWNER_MISSING: 'FIXTURE_TEXT_WRITE_OWNER_MISSING',
  FIXTURE_TEXT_WRITE_SCOPE_UNSAFE: 'FIXTURE_TEXT_WRITE_SCOPE_UNSAFE',
  FIXTURE_ROOT_CREATION_PLAN_REQUIRED: 'FIXTURE_ROOT_CREATION_PLAN_REQUIRED',
  FIXTURE_TEMP_RENAME_POLICY_REQUIRED: 'FIXTURE_TEMP_RENAME_POLICY_REQUIRED',
  FIXTURE_TEMP_RENAME_OWNER_MISSING: 'FIXTURE_TEMP_RENAME_OWNER_MISSING',
  FIXTURE_TEMP_RENAME_SCOPE_UNSAFE: 'FIXTURE_TEMP_RENAME_SCOPE_UNSAFE',
  FIXTURE_TEXT_WRITE_PLAN_REQUIRED: 'FIXTURE_TEXT_WRITE_PLAN_REQUIRED',
  FIXTURE_TEMP_RENAME_PLAN_REQUIRED: 'FIXTURE_TEMP_RENAME_PLAN_REQUIRED',
  FIXTURE_RECEIPT_FILE_POLICY_REQUIRED: 'FIXTURE_RECEIPT_FILE_POLICY_REQUIRED',
  FIXTURE_RECEIPT_FILE_OWNER_MISSING: 'FIXTURE_RECEIPT_FILE_OWNER_MISSING',
  FIXTURE_RECEIPT_FILE_SCOPE_UNSAFE: 'FIXTURE_RECEIPT_FILE_SCOPE_UNSAFE',
  TEMP_RENAME_OBSERVATION_MISMATCH: 'TEMP_RENAME_OBSERVATION_MISMATCH',
  HASH_OBSERVATION_MISMATCH: 'HASH_OBSERVATION_MISMATCH',
  FIXTURE_ROOT_NOT_ISOLATED: 'FIXTURE_ROOT_NOT_ISOLATED',
  PRODUCT_ROOT_FORBIDDEN: 'PRODUCT_ROOT_FORBIDDEN',
  PRODUCT_PATH_FORBIDDEN: 'PRODUCT_PATH_FORBIDDEN',
  PATH_TRAVERSAL_FORBIDDEN: 'PATH_TRAVERSAL_FORBIDDEN',
  ABSOLUTE_PATH_ESCAPE_FORBIDDEN: 'ABSOLUTE_PATH_ESCAPE_FORBIDDEN',
  SYMLINK_POLICY_UNSAFE: 'SYMLINK_POLICY_UNSAFE',
  CASE_COLLISION_POLICY_MISSING: 'CASE_COLLISION_POLICY_MISSING',
  RESERVED_NAME_POLICY_MISSING: 'RESERVED_NAME_POLICY_MISSING',
  LONG_PATH_POLICY_MISSING: 'LONG_PATH_POLICY_MISSING',
  NON_DETERMINISTIC_STORAGE_PORT: 'NON_DETERMINISTIC_STORAGE_PORT',
  FS_MUTATION_FORBIDDEN_IN_CONTOUR: 'FS_MUTATION_FORBIDDEN_IN_CONTOUR',
  PRODUCT_STORAGE_PRIMITIVE_EVIDENCE_MISSING: 'PRODUCT_STORAGE_PRIMITIVE_EVIDENCE_MISSING',
  PRODUCT_STORAGE_PRIMITIVE_TEST_EVIDENCE_MISSING: 'PRODUCT_STORAGE_PRIMITIVE_TEST_EVIDENCE_MISSING',
  DENYLIST_PRIMITIVE_EDITED: 'DENYLIST_PRIMITIVE_EDITED',
  STORAGE_INTEGRATION_FORBIDDEN_IN_CONTOUR: 'STORAGE_INTEGRATION_FORBIDDEN_IN_CONTOUR',
  ATOMICITY_CLAIM_FORBIDDEN_IN_CONTOUR: 'ATOMICITY_CLAIM_FORBIDDEN_IN_CONTOUR',
  RECOVERY_CLAIM_FORBIDDEN_IN_CONTOUR: 'RECOVERY_CLAIM_FORBIDDEN_IN_CONTOUR',
  STRUCTURAL_AUTO_APPLY_FORBIDDEN: 'STRUCTURAL_AUTO_APPLY_FORBIDDEN',
  SEMANTIC_PARSE_FORBIDDEN: 'SEMANTIC_PARSE_FORBIDDEN',
  NETWORK_FORBIDDEN: 'NETWORK_FORBIDDEN',
  DEPENDENCY_FORBIDDEN: 'DEPENDENCY_FORBIDDEN',
  TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_EVIDENCE_MISSING: 'TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_EVIDENCE_MISSING',
  TEST_ONLY_PRODUCT_SHAPED_DRY_RUN_EVIDENCE_MISSING: 'TEST_ONLY_PRODUCT_SHAPED_DRY_RUN_EVIDENCE_MISSING',
  FIXTURE_MANIFEST_TRUTH_ESCALATION_FORBIDDEN: 'FIXTURE_MANIFEST_TRUTH_ESCALATION_FORBIDDEN',
  DRY_RUN_RECEIPT_PATH_OUTSIDE_FIXTURE: 'DRY_RUN_RECEIPT_PATH_OUTSIDE_FIXTURE',
  PRODUCT_APPLY_ADMISSION_FORBIDDEN: 'PRODUCT_APPLY_ADMISSION_FORBIDDEN',
  PRODUCT_APPLY_READINESS_REVIEW_MISSING: 'PRODUCT_APPLY_READINESS_REVIEW_MISSING',
  REQUIREMENTS_MATRIX_MISSING: 'REQUIREMENTS_MATRIX_MISSING',
  RECEIPT_REQUIREMENTS_ESCALATED_TO_IMPLEMENTATION: 'RECEIPT_REQUIREMENTS_ESCALATED_TO_IMPLEMENTATION',
  OWNER_DECISION_PACKET_INVALID: 'OWNER_DECISION_PACKET_INVALID',
  GOVERNANCE_REWRITE_FORBIDDEN_IN_CONTOUR: 'GOVERNANCE_REWRITE_FORBIDDEN_IN_CONTOUR',
  RUNTIME_STORAGE_SCAN_FORBIDDEN_IN_CONTOUR: 'RUNTIME_STORAGE_SCAN_FORBIDDEN_IN_CONTOUR',
  ELECTRON_STUB_REQUIRED: 'ELECTRON_STUB_REQUIRED',
  REAL_DOCUMENTS_PATH_FORBIDDEN: 'REAL_DOCUMENTS_PATH_FORBIDDEN',
  BACKUP_BASE_PATH_REQUIRED: 'BACKUP_BASE_PATH_REQUIRED',
  FIXTURE_CLEANUP_REQUIRED: 'FIXTURE_CLEANUP_REQUIRED',
  PRODUCTION_STORAGE_IMPORT_FORBIDDEN: 'PRODUCTION_STORAGE_IMPORT_FORBIDDEN',
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

function storagePortCapabilityReasons(capabilities = {}, input = {}) {
  const reasons = [];
  if (capabilities.canBackupBeforeWrite !== true) {
    reasons.push(REASON_CODES.BACKUP_CAPABILITY_MISSING);
  }
  if (capabilities.canAtomicWriteSceneText !== true) {
    reasons.push(REASON_CODES.ATOMIC_WRITE_CAPABILITY_MISSING);
  }
  if (capabilities.canCreateReadableRecoverySnapshot !== true) {
    reasons.push(REASON_CODES.RECOVERY_SNAPSHOT_CAPABILITY_MISSING);
  }
  if (capabilities.canReportBeforeHash !== true || capabilities.canReportAfterHash !== true) {
    reasons.push(REASON_CODES.HASH_REPORT_CAPABILITY_MISSING);
  }
  if (capabilities.deterministicObservationIds !== true) {
    reasons.push(REASON_CODES.NON_DETERMINISTIC_STORAGE_PORT);
  }
  if (
    input?.fsMutationRequested === true
    || input?.productWrite === true
    || capabilities.productPathAccess === true
  ) {
    reasons.push(REASON_CODES.FS_MUTATION_FORBIDDEN_IN_CONTOUR);
  }
  return uniqueStrings(reasons);
}

function receiptContractMismatchReasons(writePlan, receiptContract) {
  const reasons = [];
  const expectedPairs = [
    ['writePlanId', writePlan?.writePlanId],
    ['writePlanHash', writePlan?.canonicalHash],
    ['projectId', writePlan?.projectId],
    ['sceneId', writePlan?.sceneId],
    ['beforeHash', writePlan?.beforeHash],
    ['afterHash', writePlan?.afterHashExpected],
  ];
  for (const [key, value] of expectedPairs) {
    if (!hasValue(value) || receiptContract?.[key] !== value) {
      reasons.push(REASON_CODES.RECEIPT_CONTRACT_MISMATCH);
    }
  }
  if (receiptContract?.durableReceipt !== false || receiptContract?.runtimeWritable !== false) {
    reasons.push(REASON_CODES.RECEIPT_CONTRACT_MISMATCH);
  }
  return uniqueStrings(reasons);
}

function createObservationRequest({ requestKind, writePlan, receiptContract, purpose }) {
  const requestCore = {
    requestKind,
    requestMode: 'MOCK_OBSERVATION_REQUEST_ONLY',
    executedIo: false,
    deterministic: true,
    purpose,
    sourceWritePlanId: writePlan.writePlanId,
    sourceWritePlanHash: writePlan.canonicalHash,
    sourceReceiptContractId: receiptContract.receiptContractId,
    sourceReceiptContractHash: receiptContract.canonicalHash,
    projectId: writePlan.projectId,
    sceneId: writePlan.sceneId,
    beforeHash: writePlan.beforeHash,
    afterHashExpected: writePlan.afterHashExpected,
  };
  const requestWithId = {
    requestId: `storage_request_${canonicalHash(requestCore).slice(0, 16)}`,
    ...requestCore,
  };
  return {
    ...requestWithId,
    canonicalHash: canonicalHash(requestWithId),
  };
}

function createStorageAdapterCallPlan(writePlan, receiptContract, capabilities) {
  const requiredCapabilities = [
    'CAN_BACKUP_BEFORE_WRITE',
    'CAN_ATOMIC_WRITE_SCENE_TEXT',
    'CAN_CREATE_READABLE_RECOVERY_SNAPSHOT',
    'CAN_REPORT_BEFORE_HASH',
    'CAN_REPORT_AFTER_HASH',
    'DETERMINISTIC_OBSERVATION_IDS',
    'NO_PRODUCT_PATH_ACCESS_IN_THIS_CONTOUR',
  ];
  const backupObservationRequest = createObservationRequest({
    requestKind: 'BACKUP_BEFORE_WRITE_OBSERVATION_REQUEST',
    writePlan,
    receiptContract,
    purpose: 'BACKUP_BEFORE_WRITE_REQUIRED',
  });
  const atomicWriteObservationRequest = createObservationRequest({
    requestKind: 'ATOMIC_WRITE_OBSERVATION_REQUEST',
    writePlan,
    receiptContract,
    purpose: 'ATOMIC_SCENE_TEXT_WRITE_REQUIRED',
  });
  const recoverySnapshotObservationRequest = createObservationRequest({
    requestKind: 'RECOVERY_SNAPSHOT_OBSERVATION_REQUEST',
    writePlan,
    receiptContract,
    purpose: 'READABLE_RECOVERY_SNAPSHOT_REQUIRED',
  });
  const callPlanCore = {
    callPlanKind: 'EXACT_TEXT_STORAGE_ADAPTER_CALL_PLAN_CONTRACT',
    contractOnly: true,
    fsMutationPerformed: false,
    productWriteClaimed: false,
    sourceWritePlanId: writePlan.writePlanId,
    sourceWritePlanHash: writePlan.canonicalHash,
    sourceReceiptContractId: receiptContract.receiptContractId,
    sourceReceiptContractHash: receiptContract.canonicalHash,
    requiredCapabilities,
    capabilitySnapshot: {
      canBackupBeforeWrite: capabilities.canBackupBeforeWrite === true,
      canAtomicWriteSceneText: capabilities.canAtomicWriteSceneText === true,
      canCreateReadableRecoverySnapshot: capabilities.canCreateReadableRecoverySnapshot === true,
      canReportBeforeHash: capabilities.canReportBeforeHash === true,
      canReportAfterHash: capabilities.canReportAfterHash === true,
      deterministicObservationIds: capabilities.deterministicObservationIds === true,
      productPathAccess: capabilities.productPathAccess === true,
    },
    backupObservationRequest,
    atomicWriteObservationRequest,
    recoverySnapshotObservationRequest,
    blockedReasons: [],
  };
  const callPlanWithId = {
    callPlanId: `storage_call_plan_${canonicalHash(callPlanCore).slice(0, 16)}`,
    ...callPlanCore,
  };
  return {
    ...callPlanWithId,
    canonicalHash: canonicalHash(callPlanWithId),
  };
}

export function compileExactTextStorageAdapterCallPlan(input = {}) {
  const writePlans = input?.writePlanReceiptResult?.writePlans || [];
  const receiptContracts = input?.writePlanReceiptResult?.receiptContracts || [];
  const capabilities = input?.storagePortCapabilities || {};
  const blockedReasons = [
    ...(input?.writePlanReceiptResult?.blockedReasons || []),
    ...storagePortCapabilityReasons(capabilities, input),
  ];
  if (input?.writePlanReceiptResult?.contractOnly !== true) {
    blockedReasons.push(REASON_CODES.NON_CONTRACT_APPLYOP_FORBIDDEN);
  }
  if (input?.writePlanReceiptResult?.runtimeWritable !== false) {
    blockedReasons.push(REASON_CODES.RUNTIME_WRITE_FORBIDDEN_IN_CONTOUR);
  }
  if (
    writePlans.length !== 1
    || receiptContracts.length !== 1
    || !hasValue(writePlans[0]?.canonicalHash)
    || !hasValue(receiptContracts[0]?.canonicalHash)
  ) {
    blockedReasons.push(REASON_CODES.EFFECT_PRECONDITION_MISSING);
  }
  if (writePlans[0] && receiptContracts[0]) {
    blockedReasons.push(...receiptContractMismatchReasons(writePlans[0], receiptContracts[0]));
  }

  const uniqueBlockedReasons = uniqueStrings(blockedReasons);
  const callPlans = uniqueBlockedReasons.length === 0
    ? [createStorageAdapterCallPlan(writePlans[0], receiptContracts[0], capabilities)]
    : [];
  const resultCore = {
    resultKind: 'EXACT_TEXT_STORAGE_ADAPTER_CALL_PLAN_RESULT',
    contractOnly: true,
    fsMutationPerformed: false,
    tempFixtureWritePerformed: false,
    productWriteClaimed: false,
    productManuscriptMutationClaimed: false,
    durableReceiptClaimed: false,
    productStorageSafetyClaimed: false,
    crashRecoveryClaimed: false,
    applyTxnClaimed: false,
    publicSurfaceClaimed: false,
    docxImportClaimed: false,
    releaseClaimed: false,
    storagePrimitiveChanged: false,
    callPlans,
    blockedReasons: uniqueBlockedReasons,
  };
  return {
    ...resultCore,
    canonicalHash: canonicalHash(resultCore),
  };
}

function portFixtureCapabilityReasons(capabilities = {}, input = {}) {
  const reasons = [];
  if (capabilities.canObserveBackup !== true) {
    reasons.push(REASON_CODES.BACKUP_CAPABILITY_MISSING);
  }
  if (capabilities.canObserveAtomicWrite !== true) {
    reasons.push(REASON_CODES.ATOMIC_WRITE_CAPABILITY_MISSING);
  }
  if (capabilities.canObserveRecoverySnapshot !== true) {
    reasons.push(REASON_CODES.RECOVERY_SNAPSHOT_CAPABILITY_MISSING);
  }
  if (capabilities.canProduceFixtureReceiptContract !== true) {
    reasons.push(REASON_CODES.PORT_FIXTURE_CAPABILITY_MISSING);
  }
  if (capabilities.deterministicObservationIds !== true) {
    reasons.push(REASON_CODES.NON_DETERMINISTIC_STORAGE_PORT);
  }
  if (
    input?.realIoRequested === true
    || input?.fsMutationRequested === true
    || input?.tempDirRequested === true
    || input?.productWrite === true
    || input?.runtimeWritable === true
    || capabilities.realIoAvailable === true
    || capabilities.productPathAccess === true
  ) {
    reasons.push(REASON_CODES.FS_MUTATION_FORBIDDEN_IN_CONTOUR);
  }
  return uniqueStrings(reasons);
}

function storageCallPlanMismatchReasons(callPlan) {
  const reasons = [];
  const requests = [
    callPlan?.backupObservationRequest,
    callPlan?.atomicWriteObservationRequest,
    callPlan?.recoverySnapshotObservationRequest,
  ];
  for (const request of requests) {
    if (
      !request
      || request.executedIo !== false
      || request.sourceWritePlanId !== callPlan?.sourceWritePlanId
      || request.sourceWritePlanHash !== callPlan?.sourceWritePlanHash
      || request.sourceReceiptContractId !== callPlan?.sourceReceiptContractId
      || request.sourceReceiptContractHash !== callPlan?.sourceReceiptContractHash
    ) {
      reasons.push(REASON_CODES.STORAGE_CALL_PLAN_MISMATCH);
    }
  }
  if (callPlan?.contractOnly !== true || callPlan?.fsMutationPerformed !== false || callPlan?.productWriteClaimed !== false) {
    reasons.push(REASON_CODES.STORAGE_CALL_PLAN_MISMATCH);
  }
  return uniqueStrings(reasons);
}

function createPortFixtureObservation(request, observationKind) {
  const observationCore = {
    observationKind,
    observationMode: 'IN_MEMORY_PORT_FIXTURE_ONLY',
    executedIo: false,
    deterministic: true,
    sourceRequestId: request.requestId,
    sourceRequestHash: request.canonicalHash,
    sourceWritePlanId: request.sourceWritePlanId,
    sourceWritePlanHash: request.sourceWritePlanHash,
    sourceReceiptContractId: request.sourceReceiptContractId,
    sourceReceiptContractHash: request.sourceReceiptContractHash,
    projectId: request.projectId,
    sceneId: request.sceneId,
    beforeHash: request.beforeHash,
    afterHashExpected: request.afterHashExpected,
  };
  const observationWithId = {
    observationId: `port_fixture_observation_${canonicalHash(observationCore).slice(0, 16)}`,
    ...observationCore,
  };
  return {
    ...observationWithId,
    canonicalHash: canonicalHash(observationWithId),
  };
}

function createPortFixtureReceiptContract(callPlan, observations) {
  const receiptCore = {
    fixtureReceiptKind: 'IN_MEMORY_STORAGE_PORT_FIXTURE_RECEIPT_CONTRACT',
    durableReceipt: false,
    executedIo: false,
    resultStatus: 'IN_MEMORY_FIXTURE_EXECUTED',
    sourceCallPlanId: callPlan.callPlanId,
    sourceCallPlanHash: callPlan.canonicalHash,
    sourceWritePlanId: callPlan.sourceWritePlanId,
    sourceWritePlanHash: callPlan.sourceWritePlanHash,
    sourceReceiptContractId: callPlan.sourceReceiptContractId,
    sourceReceiptContractHash: callPlan.sourceReceiptContractHash,
    backupObservationHash: observations.backupObservation.canonicalHash,
    atomicWriteObservationHash: observations.atomicWriteObservation.canonicalHash,
    recoverySnapshotObservationHash: observations.recoverySnapshotObservation.canonicalHash,
  };
  const receiptWithId = {
    fixtureReceiptContractId: `port_fixture_receipt_${canonicalHash(receiptCore).slice(0, 16)}`,
    ...receiptCore,
  };
  return {
    ...receiptWithId,
    canonicalHash: canonicalHash(receiptWithId),
  };
}

function createPortFixtureExecution(callPlan) {
  const observations = {
    backupObservation: createPortFixtureObservation(
      callPlan.backupObservationRequest,
      'BACKUP_OBSERVATION_IN_MEMORY_FIXTURE',
    ),
    atomicWriteObservation: createPortFixtureObservation(
      callPlan.atomicWriteObservationRequest,
      'ATOMIC_WRITE_OBSERVATION_IN_MEMORY_FIXTURE',
    ),
    recoverySnapshotObservation: createPortFixtureObservation(
      callPlan.recoverySnapshotObservationRequest,
      'RECOVERY_SNAPSHOT_OBSERVATION_IN_MEMORY_FIXTURE',
    ),
  };
  const fixtureReceiptContract = createPortFixtureReceiptContract(callPlan, observations);
  const executionCore = {
    fixtureExecutionKind: 'EXACT_TEXT_IN_MEMORY_STORAGE_PORT_FIXTURE_EXECUTION',
    contractOnly: true,
    inMemoryOnly: true,
    filesystemWritePerformed: false,
    tempFixtureWritePerformed: false,
    productWritePerformed: false,
    sourceCallPlanId: callPlan.callPlanId,
    sourceCallPlanHash: callPlan.canonicalHash,
    sourceWritePlanId: callPlan.sourceWritePlanId,
    sourceWritePlanHash: callPlan.sourceWritePlanHash,
    sourceReceiptContractId: callPlan.sourceReceiptContractId,
    sourceReceiptContractHash: callPlan.sourceReceiptContractHash,
    ...observations,
    fixtureReceiptContract,
  };
  const executionWithId = {
    fixtureExecutionId: `port_fixture_execution_${canonicalHash(executionCore).slice(0, 16)}`,
    ...executionCore,
  };
  return {
    ...executionWithId,
    canonicalHash: canonicalHash(executionWithId),
  };
}

export function compileExactTextInMemoryStoragePortFixture(input = {}) {
  const callPlans = input?.storageAdapterCallPlanResult?.callPlans || [];
  const capabilities = input?.fixtureCapabilities || {};
  const blockedReasons = [
    ...(input?.storageAdapterCallPlanResult?.blockedReasons || []),
    ...portFixtureCapabilityReasons(capabilities, input),
  ];
  if (input?.storageAdapterCallPlanResult?.contractOnly !== true) {
    blockedReasons.push(REASON_CODES.NON_CONTRACT_APPLYOP_FORBIDDEN);
  }
  if (input?.storageAdapterCallPlanResult?.runtimeWritable === true) {
    blockedReasons.push(REASON_CODES.RUNTIME_WRITE_FORBIDDEN_IN_CONTOUR);
  }
  if (
    callPlans.length !== 1
    || !hasValue(callPlans[0]?.canonicalHash)
    || !hasValue(callPlans[0]?.sourceWritePlanHash)
    || !hasValue(callPlans[0]?.sourceReceiptContractHash)
  ) {
    blockedReasons.push(REASON_CODES.EFFECT_PRECONDITION_MISSING);
  }
  if (callPlans[0]) {
    blockedReasons.push(...storageCallPlanMismatchReasons(callPlans[0]));
  }

  const uniqueBlockedReasons = uniqueStrings(blockedReasons);
  const fixtureExecutions = uniqueBlockedReasons.length === 0
    ? [createPortFixtureExecution(callPlans[0])]
    : [];
  const resultCore = {
    resultKind: 'EXACT_TEXT_IN_MEMORY_STORAGE_PORT_FIXTURE_RESULT',
    contractOnly: true,
    inMemoryOnly: true,
    filesystemWritePerformed: false,
    fsMutationPerformed: false,
    tempDirUsed: false,
    tempFixtureWritePerformed: false,
    productWritePerformed: false,
    productWriteClaimed: false,
    productStorageSafetyClaimed: false,
    durableReceiptClaimed: false,
    crashRecoveryClaimed: false,
    applyTxnClaimed: false,
    publicSurfaceClaimed: false,
    docxImportClaimed: false,
    releaseClaimed: false,
    storageImportsAdded: false,
    storagePrimitiveChanged: false,
    fixtureExecutions,
    blockedReasons: uniqueBlockedReasons,
  };
  return {
    ...resultCore,
    canonicalHash: canonicalHash(resultCore),
  };
}

function storageAdmissionCapabilityReasons(capabilities = {}, input = {}) {
  const reasons = [];
  if (capabilities.canBackupBeforeWrite !== true) {
    reasons.push(REASON_CODES.BACKUP_CAPABILITY_MISSING);
  }
  if (capabilities.canAtomicWriteSceneText !== true) {
    reasons.push(REASON_CODES.ATOMIC_WRITE_CAPABILITY_MISSING);
  }
  if (capabilities.canCreateReadableRecoverySnapshot !== true) {
    reasons.push(REASON_CODES.RECOVERY_SNAPSHOT_CAPABILITY_MISSING);
  }
  if (capabilities.canPersistReceipt !== true) {
    reasons.push(REASON_CODES.RECEIPT_CAPABILITY_MISSING);
  }
  if (capabilities.publicSurfaceAvailable === true || input?.publicSurfaceRequested === true) {
    reasons.push(REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR);
  }
  if (
    input?.fsMutationRequested === true
    || input?.tempDirRequested === true
    || input?.productWrite === true
    || input?.runtimeWritable === true
    || capabilities.productPathAccess === true
  ) {
    reasons.push(REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR);
  }
  return uniqueStrings(reasons);
}

function storageAdmissionScopeReasons(policy = {}, fixtureExecution) {
  const reasons = [];
  const sourceScope = policy.sourceScope || {};
  const allowedKinds = new Set(policy.allowedOperationKinds || ['TEXT_REPLACE', 'EXACT_TEXT_REPLACE']);
  if (policy.ownerAdmissionApproved !== true || policy.realStorageAdmissionRequested !== true) {
    reasons.push(REASON_CODES.OWNER_ADMISSION_MISSING);
  }
  if (policy.singleSceneOnly !== true || sourceScope.multiScene === true || sourceScope.sceneCount > 1) {
    reasons.push(REASON_CODES.MULTI_SCOPE_STORAGE_WRITE_BLOCKED);
  }
  if (
    policy.exactTextOnly !== true
    || sourceScope.structural === true
    || sourceScope.operationKind === 'MOVE'
    || sourceScope.operationKind === 'SPLIT'
    || sourceScope.operationKind === 'MERGE'
    || (hasValue(sourceScope.operationKind) && !allowedKinds.has(sourceScope.operationKind))
  ) {
    reasons.push(REASON_CODES.STRUCTURAL_STORAGE_WRITE_BLOCKED);
  }
  if (
    !fixtureExecution
    || fixtureExecution.contractOnly !== true
    || fixtureExecution.inMemoryOnly !== true
    || fixtureExecution.filesystemWritePerformed !== false
    || fixtureExecution.productWritePerformed !== false
    || !hasValue(fixtureExecution.canonicalHash)
    || !hasValue(fixtureExecution.sourceCallPlanHash)
    || !hasValue(fixtureExecution.sourceWritePlanHash)
    || !hasValue(fixtureExecution.sourceReceiptContractHash)
  ) {
    reasons.push(REASON_CODES.STORAGE_ADMISSION_REQUIRED);
  }
  return uniqueStrings(reasons);
}

function createStorageAdmissionDecision(fixtureExecution, policy, capabilities) {
  const decisionCore = {
    admissionDecisionKind: 'EXACT_TEXT_STORAGE_ADMISSION_DECISION',
    admissionMode: 'PURE_DATA_GATE_ONLY',
    runtimeStorageAdmitted: true,
    admittedForNextContourOnly: true,
    productWritePerformed: false,
    filesystemWritePerformed: false,
    tempFixtureWritePerformed: false,
    sourceFixtureExecutionId: fixtureExecution.fixtureExecutionId,
    sourceFixtureExecutionHash: fixtureExecution.canonicalHash,
    sourceCallPlanId: fixtureExecution.sourceCallPlanId,
    sourceCallPlanHash: fixtureExecution.sourceCallPlanHash,
    sourceWritePlanId: fixtureExecution.sourceWritePlanId,
    sourceWritePlanHash: fixtureExecution.sourceWritePlanHash,
    sourceReceiptContractId: fixtureExecution.sourceReceiptContractId,
    sourceReceiptContractHash: fixtureExecution.sourceReceiptContractHash,
    policySnapshot: {
      ownerAdmissionApproved: policy.ownerAdmissionApproved === true,
      realStorageAdmissionRequested: policy.realStorageAdmissionRequested === true,
      exactTextOnly: policy.exactTextOnly === true,
      singleSceneOnly: policy.singleSceneOnly === true,
      sourceScope: policy.sourceScope || {},
    },
    capabilitySnapshot: {
      canBackupBeforeWrite: capabilities.canBackupBeforeWrite === true,
      canAtomicWriteSceneText: capabilities.canAtomicWriteSceneText === true,
      canCreateReadableRecoverySnapshot: capabilities.canCreateReadableRecoverySnapshot === true,
      canPersistReceipt: capabilities.canPersistReceipt === true,
      productPathAccess: capabilities.productPathAccess === true,
      publicSurfaceAvailable: capabilities.publicSurfaceAvailable === true,
    },
  };
  const decisionWithId = {
    admissionDecisionId: `storage_admission_${canonicalHash(decisionCore).slice(0, 16)}`,
    ...decisionCore,
  };
  return {
    ...decisionWithId,
    canonicalHash: canonicalHash(decisionWithId),
  };
}

export function compileExactTextStorageAdmissionGate(input = {}) {
  const fixtureExecutions = input?.storagePortFixtureResult?.fixtureExecutions || [];
  const policy = input?.storageAdmissionPolicy || {};
  const capabilities = input?.storageAdmissionCapabilities || {};
  const fixtureExecution = fixtureExecutions[0];
  const blockedReasons = [
    ...(input?.storagePortFixtureResult?.blockedReasons || []),
    ...storageAdmissionCapabilityReasons(capabilities, input),
    ...storageAdmissionScopeReasons(policy, fixtureExecution),
  ];
  if (input?.storagePortFixtureResult?.contractOnly !== true || input?.storagePortFixtureResult?.inMemoryOnly !== true) {
    blockedReasons.push(REASON_CODES.NON_CONTRACT_APPLYOP_FORBIDDEN);
  }
  if (input?.storagePortFixtureResult?.filesystemWritePerformed !== false || input?.storagePortFixtureResult?.productWritePerformed !== false) {
    blockedReasons.push(REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR);
  }
  if (fixtureExecutions.length !== 1) {
    blockedReasons.push(REASON_CODES.STORAGE_ADMISSION_REQUIRED);
  }

  const uniqueBlockedReasons = uniqueStrings(blockedReasons);
  const admissionDecisions = uniqueBlockedReasons.length === 0
    ? [createStorageAdmissionDecision(fixtureExecution, policy, capabilities)]
    : [];
  const resultCore = {
    resultKind: 'EXACT_TEXT_STORAGE_ADMISSION_GATE_RESULT',
    contractOnly: true,
    admissionGateOnly: true,
    runtimeStorageAdmitted: admissionDecisions.length === 1,
    filesystemWritePerformed: false,
    fsMutationPerformed: false,
    tempDirUsed: false,
    tempFixtureWritePerformed: false,
    productWritePerformed: false,
    productWriteClaimed: false,
    durableReceiptClaimed: false,
    productStorageSafetyClaimed: false,
    crashRecoveryClaimed: false,
    applyTxnClaimed: false,
    publicSurfaceClaimed: false,
    docxImportClaimed: false,
    uiChanged: false,
    releaseClaimed: false,
    storageImportsAdded: false,
    storagePrimitiveChanged: false,
    admissionDecisions,
    blockedReasons: uniqueBlockedReasons,
  };
  return {
    ...resultCore,
    canonicalHash: canonicalHash(resultCore),
  };
}

function looksAbsolutePath(value) {
  const text = String(value ?? '');
  return text.startsWith('/')
    || text.startsWith('\\')
    || /^[A-Za-z]:[\\/]/u.test(text)
    || text.startsWith('\\\\');
}

function pathSegmentsFromPolicy(policy = {}) {
  if (Array.isArray(policy.relativePathSegments)) {
    return policy.relativePathSegments;
  }
  if (hasValue(policy.relativePath)) {
    return String(policy.relativePath).split(/[\\/]+/u).filter(Boolean);
  }
  return [];
}

function fixtureRootPathPolicyReasons(policy = {}, input = {}) {
  const reasons = [];
  const segments = pathSegmentsFromPolicy(policy);
  if (
    !hasValue(policy.fixtureRootId)
    || !hasValue(policy.relativePath)
    || segments.length === 0
    || policy.isolatedMarker !== 'EXACT_TEXT_FIXTURE_ROOT_ISOLATED'
  ) {
    reasons.push(REASON_CODES.FIXTURE_ROOT_POLICY_REQUIRED);
  }
  if (policy.isolatedRoot !== true || policy.rootKind !== 'FIXTURE') {
    reasons.push(REASON_CODES.FIXTURE_ROOT_NOT_ISOLATED);
  }
  if (
    policy.rootKind === 'PRODUCT'
    || policy.productRoot === true
    || policy.fixtureRootId === policy.productRootId
    || input?.productRootRequested === true
  ) {
    reasons.push(REASON_CODES.PRODUCT_ROOT_FORBIDDEN);
  }
  if (policy.productPath === true || input?.productPathRequested === true) {
    reasons.push(REASON_CODES.PRODUCT_PATH_FORBIDDEN);
  }
  if (segments.some((segment) => segment === '..' || segment === '.')) {
    reasons.push(REASON_CODES.PATH_TRAVERSAL_FORBIDDEN);
  }
  if (looksAbsolutePath(policy.relativePath) || looksAbsolutePath(policy.absolutePathProbe)) {
    reasons.push(REASON_CODES.ABSOLUTE_PATH_ESCAPE_FORBIDDEN);
  }
  if (policy.symlinkPolicy !== 'BLOCK') {
    reasons.push(REASON_CODES.SYMLINK_POLICY_UNSAFE);
  }
  if (policy.caseCollisionPolicy !== 'DETECT_AND_BLOCK') {
    reasons.push(REASON_CODES.CASE_COLLISION_POLICY_MISSING);
  }
  if (policy.reservedNamePolicy !== 'DETECT_AND_BLOCK') {
    reasons.push(REASON_CODES.RESERVED_NAME_POLICY_MISSING);
  }
  if (policy.longPathPolicy !== 'DECLARE_AND_BLOCK_UNSUPPORTED') {
    reasons.push(REASON_CODES.LONG_PATH_POLICY_MISSING);
  }
  if (
    !hasValue(policy.hashPolicy?.newlinePolicy)
    || !hasValue(policy.hashPolicy?.unicodePolicy)
    || !hasValue(policy.hashPolicy?.normalizationPolicy)
  ) {
    reasons.push(REASON_CODES.MISSING_PRECONDITION);
  }
  if (
    input?.fsMutationRequested === true
    || input?.tempDirRequested === true
    || input?.tempFixtureWriteRequested === true
    || input?.productWrite === true
    || input?.runtimeWritable === true
  ) {
    reasons.push(REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR);
  }
  if (input?.publicSurfaceRequested === true) {
    reasons.push(REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR);
  }
  return uniqueStrings(reasons);
}

function storageAdmissionBindingReasons(admissionResult = {}) {
  const reasons = [];
  const decisions = admissionResult.admissionDecisions || [];
  if (
    admissionResult.contractOnly !== true
    || admissionResult.admissionGateOnly !== true
    || admissionResult.runtimeStorageAdmitted !== true
    || admissionResult.filesystemWritePerformed !== false
    || admissionResult.productWritePerformed !== false
    || decisions.length !== 1
    || !hasValue(admissionResult.canonicalHash)
    || !hasValue(decisions[0]?.canonicalHash)
  ) {
    reasons.push(REASON_CODES.STORAGE_ADMISSION_REQUIRED);
  }
  return uniqueStrings(reasons);
}

function createFixtureRootPathPolicyDecision(admissionResult, policy) {
  const admissionDecision = admissionResult.admissionDecisions[0];
  const decisionCore = {
    fixtureRootPolicyDecisionKind: 'EXACT_TEXT_FIXTURE_ROOT_PATH_POLICY_DECISION',
    decisionMode: 'PURE_PATH_POLICY_ONLY',
    fixturePathPolicyAdmitted: true,
    filesystemWritePerformed: false,
    tempDirUsed: false,
    tempFixtureWritePerformed: false,
    productWritePerformed: false,
    sourceStorageAdmissionResultHash: admissionResult.canonicalHash,
    sourceStorageAdmissionDecisionHash: admissionDecision.canonicalHash,
    sourceFixtureExecutionHash: admissionDecision.sourceFixtureExecutionHash,
    sourceCallPlanHash: admissionDecision.sourceCallPlanHash,
    sourceWritePlanHash: admissionDecision.sourceWritePlanHash,
    sourceReceiptContractHash: admissionDecision.sourceReceiptContractHash,
    fixtureRootPolicySnapshot: {
      fixtureRootId: policy.fixtureRootId,
      rootKind: policy.rootKind,
      isolatedRoot: policy.isolatedRoot === true,
      isolatedMarker: policy.isolatedMarker,
      relativePath: policy.relativePath,
      relativePathSegments: pathSegmentsFromPolicy(policy),
      symlinkPolicy: policy.symlinkPolicy,
      caseCollisionPolicy: policy.caseCollisionPolicy,
      reservedNamePolicy: policy.reservedNamePolicy,
      longPathPolicy: policy.longPathPolicy,
      hashPolicy: policy.hashPolicy,
    },
  };
  const decisionWithId = {
    fixtureRootPolicyDecisionId: `fixture_root_policy_${canonicalHash(decisionCore).slice(0, 16)}`,
    ...decisionCore,
  };
  return {
    ...decisionWithId,
    canonicalHash: canonicalHash(decisionWithId),
  };
}

export function compileExactTextFixtureRootPathPolicy(input = {}) {
  const admissionResult = input?.storageAdmissionGateResult || {};
  const policy = input?.fixtureRootPolicy || {};
  const blockedReasons = [
    ...(admissionResult.blockedReasons || []),
    ...storageAdmissionBindingReasons(admissionResult),
    ...fixtureRootPathPolicyReasons(policy, input),
  ];

  const uniqueBlockedReasons = uniqueStrings(blockedReasons);
  const fixtureRootPolicyDecisions = uniqueBlockedReasons.length === 0
    ? [createFixtureRootPathPolicyDecision(admissionResult, policy)]
    : [];
  const resultCore = {
    resultKind: 'EXACT_TEXT_FIXTURE_ROOT_PATH_POLICY_RESULT',
    contractOnly: true,
    pathPolicyOnly: true,
    fixturePathPolicyAdmitted: fixtureRootPolicyDecisions.length === 1,
    filesystemWritePerformed: false,
    fsMutationPerformed: false,
    tempDirUsed: false,
    tempFixtureWritePerformed: false,
    productWritePerformed: false,
    productWriteClaimed: false,
    fixtureBackupCreated: false,
    fixtureAtomicWriteExecuted: false,
    fixtureRecoverySnapshotCreated: false,
    fixtureReceiptPersisted: false,
    durableReceiptClaimed: false,
    productStorageSafetyClaimed: false,
    publicSurfaceClaimed: false,
    docxImportClaimed: false,
    uiChanged: false,
    applyTxnClaimed: false,
    crashRecoveryClaimed: false,
    releaseClaimed: false,
    storageImportsAdded: false,
    storagePrimitiveChanged: false,
    fixtureRootPolicyDecisions,
    blockedReasons: uniqueBlockedReasons,
  };
  return {
    ...resultCore,
    canonicalHash: canonicalHash(resultCore),
  };
}

function fixtureRootPathPolicyBindingReasons(pathPolicyResult = {}) {
  const reasons = [];
  const decisions = pathPolicyResult.fixtureRootPolicyDecisions || [];
  if (
    pathPolicyResult.contractOnly !== true
    || pathPolicyResult.pathPolicyOnly !== true
    || pathPolicyResult.fixturePathPolicyAdmitted !== true
    || pathPolicyResult.filesystemWritePerformed !== false
    || pathPolicyResult.fsMutationPerformed !== false
    || pathPolicyResult.tempFixtureWritePerformed !== false
    || pathPolicyResult.productWritePerformed !== false
    || pathPolicyResult.productWriteClaimed !== false
    || pathPolicyResult.fixtureBackupCreated !== false
    || pathPolicyResult.fixtureAtomicWriteExecuted !== false
    || pathPolicyResult.fixtureRecoverySnapshotCreated !== false
    || pathPolicyResult.fixtureReceiptPersisted !== false
    || pathPolicyResult.durableReceiptClaimed !== false
    || pathPolicyResult.productStorageSafetyClaimed !== false
    || pathPolicyResult.publicSurfaceClaimed !== false
    || pathPolicyResult.docxImportClaimed !== false
    || pathPolicyResult.uiChanged !== false
    || pathPolicyResult.applyTxnClaimed !== false
    || pathPolicyResult.crashRecoveryClaimed !== false
    || pathPolicyResult.releaseClaimed !== false
    || pathPolicyResult.storageImportsAdded !== false
    || pathPolicyResult.storagePrimitiveChanged !== false
    || decisions.length !== 1
    || !hasValue(pathPolicyResult.canonicalHash)
    || !hasValue(decisions[0]?.canonicalHash)
  ) {
    reasons.push(REASON_CODES.FIXTURE_ROOT_POLICY_REQUIRED);
  }
  return uniqueStrings(reasons);
}

function fixtureRootCreationPolicyReasons(policy = {}, input = {}) {
  const reasons = [];
  if (policy.ownerFixtureRootCreationApproved !== true) {
    reasons.push(REASON_CODES.FIXTURE_ROOT_CREATION_OWNER_MISSING);
  }
  if (
    policy.fixtureRootCreationRequested !== true
    || policy.creationMode !== 'TEST_TEMP_ROOT_ONLY'
    || policy.realIoScope !== 'DIRECTORY_ONLY'
    || policy.baseLocationKind !== 'OS_TEMP'
    || policy.cleanupRequired !== true
  ) {
    reasons.push(REASON_CODES.FIXTURE_ROOT_CREATION_POLICY_REQUIRED);
  }
  if (
    policy.repoRootAccess === true
    || policy.productRootAccess === true
    || policy.productPathAccess === true
    || policy.rootInsideProject === true
    || input?.repoRootAccessRequested === true
  ) {
    reasons.push(REASON_CODES.FIXTURE_ROOT_CREATION_SCOPE_UNSAFE);
  }
  if (
    input?.productRootRequested === true
    || input?.productPathRequested === true
    || input?.productWrite === true
    || input?.runtimeWritable === true
  ) {
    reasons.push(REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR);
  }
  if (input?.publicSurfaceRequested === true) {
    reasons.push(REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR);
  }
  if (input?.storagePrimitiveRequested === true) {
    reasons.push(REASON_CODES.FS_MUTATION_FORBIDDEN_IN_CONTOUR);
  }
  return uniqueStrings(reasons);
}

function createRealFixtureRootCreationDecision(pathPolicyResult, policy) {
  const pathPolicyDecision = pathPolicyResult.fixtureRootPolicyDecisions[0];
  const decisionCore = {
    fixtureRootCreationDecisionKind: 'EXACT_TEXT_REAL_FIXTURE_ROOT_CREATION_DECISION',
    decisionMode: 'TEST_TEMP_ROOT_DIRECTORY_ONLY',
    realFixtureRootCreationAdmitted: true,
    filesystemWritePerformed: false,
    productWritePerformed: false,
    fixtureBackupCreated: false,
    fixtureAtomicWriteExecuted: false,
    fixtureRecoverySnapshotCreated: false,
    fixtureReceiptPersisted: false,
    sourceFixtureRootPolicyResultHash: pathPolicyResult.canonicalHash,
    sourceFixtureRootPolicyDecisionHash: pathPolicyDecision.canonicalHash,
    sourceStorageAdmissionResultHash: pathPolicyDecision.sourceStorageAdmissionResultHash,
    sourceStorageAdmissionDecisionHash: pathPolicyDecision.sourceStorageAdmissionDecisionHash,
    sourceWritePlanHash: pathPolicyDecision.sourceWritePlanHash,
    sourceReceiptContractHash: pathPolicyDecision.sourceReceiptContractHash,
    fixtureRootPolicySnapshot: pathPolicyDecision.fixtureRootPolicySnapshot,
    creationPolicySnapshot: {
      ownerFixtureRootCreationApproved: policy.ownerFixtureRootCreationApproved === true,
      fixtureRootCreationRequested: policy.fixtureRootCreationRequested === true,
      creationMode: policy.creationMode,
      realIoScope: policy.realIoScope,
      baseLocationKind: policy.baseLocationKind,
      cleanupRequired: policy.cleanupRequired === true,
      repoRootAccess: policy.repoRootAccess === true,
      productRootAccess: policy.productRootAccess === true,
      productPathAccess: policy.productPathAccess === true,
    },
  };
  const decisionWithId = {
    fixtureRootCreationDecisionId: `fixture_root_creation_${canonicalHash(decisionCore).slice(0, 16)}`,
    ...decisionCore,
  };
  return {
    ...decisionWithId,
    canonicalHash: canonicalHash(decisionWithId),
  };
}

export function compileExactTextRealFixtureRootCreationPlan(input = {}) {
  const pathPolicyResult = input?.fixtureRootPathPolicyResult || {};
  const policy = input?.fixtureRootCreationPolicy || {};
  const blockedReasons = [
    ...(pathPolicyResult.blockedReasons || []),
    ...fixtureRootPathPolicyBindingReasons(pathPolicyResult),
    ...fixtureRootCreationPolicyReasons(policy, input),
  ];

  const uniqueBlockedReasons = uniqueStrings(blockedReasons);
  const fixtureRootCreationDecisions = uniqueBlockedReasons.length === 0
    ? [createRealFixtureRootCreationDecision(pathPolicyResult, policy)]
    : [];
  const resultCore = {
    resultKind: 'EXACT_TEXT_REAL_FIXTURE_ROOT_CREATION_PLAN_RESULT',
    contractOnly: true,
    fixtureRootCreationPlanOnly: true,
    realFixtureRootCreationAdmitted: fixtureRootCreationDecisions.length === 1,
    testFixtureDirectoryCreationOnly: fixtureRootCreationDecisions.length === 1,
    filesystemWritePerformed: false,
    fsMutationPerformed: false,
    productWritePerformed: false,
    productWriteClaimed: false,
    fixtureBackupCreated: false,
    fixtureAtomicWriteExecuted: false,
    fixtureRecoverySnapshotCreated: false,
    fixtureReceiptPersisted: false,
    durableReceiptClaimed: false,
    productStorageSafetyClaimed: false,
    publicSurfaceClaimed: false,
    docxImportClaimed: false,
    uiChanged: false,
    applyTxnClaimed: false,
    crashRecoveryClaimed: false,
    releaseClaimed: false,
    storageImportsAdded: false,
    storagePrimitiveChanged: false,
    fixtureRootCreationDecisions,
    blockedReasons: uniqueBlockedReasons,
  };
  return {
    ...resultCore,
    canonicalHash: canonicalHash(resultCore),
  };
}

function fixtureRootCreationPlanBindingReasons(creationPlanResult = {}) {
  const reasons = [];
  const decisions = creationPlanResult.fixtureRootCreationDecisions || [];
  if (
    creationPlanResult.contractOnly !== true
    || creationPlanResult.fixtureRootCreationPlanOnly !== true
    || creationPlanResult.realFixtureRootCreationAdmitted !== true
    || creationPlanResult.testFixtureDirectoryCreationOnly !== true
    || creationPlanResult.filesystemWritePerformed !== false
    || creationPlanResult.fsMutationPerformed !== false
    || creationPlanResult.productWritePerformed !== false
    || creationPlanResult.productWriteClaimed !== false
    || creationPlanResult.fixtureBackupCreated !== false
    || creationPlanResult.fixtureAtomicWriteExecuted !== false
    || creationPlanResult.fixtureRecoverySnapshotCreated !== false
    || creationPlanResult.fixtureReceiptPersisted !== false
    || creationPlanResult.durableReceiptClaimed !== false
    || creationPlanResult.productStorageSafetyClaimed !== false
    || creationPlanResult.publicSurfaceClaimed !== false
    || creationPlanResult.docxImportClaimed !== false
    || creationPlanResult.uiChanged !== false
    || creationPlanResult.applyTxnClaimed !== false
    || creationPlanResult.crashRecoveryClaimed !== false
    || creationPlanResult.releaseClaimed !== false
    || creationPlanResult.storageImportsAdded !== false
    || creationPlanResult.storagePrimitiveChanged !== false
    || decisions.length !== 1
    || !hasValue(creationPlanResult.canonicalHash)
    || !hasValue(decisions[0]?.canonicalHash)
  ) {
    reasons.push(REASON_CODES.FIXTURE_ROOT_CREATION_PLAN_REQUIRED);
  }
  return uniqueStrings(reasons);
}

function createFixtureTextHashObservation(text, hashPolicy = {}) {
  const policy = {
    normalizationPolicy: hashPolicy.normalizationPolicy || 'TEXT_V1',
    newlinePolicy: hashPolicy.newlinePolicy || DEFAULT_NORMALIZATION_POLICY.newlinePolicy,
    unicodePolicy: hashPolicy.unicodePolicy || DEFAULT_NORMALIZATION_POLICY.unicodePolicy,
  };
  const normalizedText = normalizeText(text, policy);
  const observationCore = {
    observationKind: 'EXACT_TEXT_FIXTURE_HASH_OBSERVATION',
    hashObservationOnly: true,
    normalizationPolicy: policy.normalizationPolicy,
    newlinePolicy: policy.newlinePolicy,
    unicodePolicy: policy.unicodePolicy,
    textHash: canonicalHash({
      text: normalizedText,
      normalizationPolicy: policy.normalizationPolicy,
      newlinePolicy: policy.newlinePolicy,
      unicodePolicy: policy.unicodePolicy,
    }),
  };
  return {
    ...observationCore,
    canonicalHash: canonicalHash(observationCore),
  };
}

function fixtureTextWritePolicyReasons(policy = {}, input = {}) {
  const reasons = [];
  const pathSegments = pathSegmentsFromPolicy(policy);
  const relativePathText = String(policy.relativePath ?? '');
  const beforeObservation = createFixtureTextHashObservation(policy.beforeText || '', policy.hashPolicy);
  const afterObservation = createFixtureTextHashObservation(policy.afterText || '', policy.hashPolicy);
  if (policy.ownerFixtureTextWriteApproved !== true) {
    reasons.push(REASON_CODES.FIXTURE_TEXT_WRITE_OWNER_MISSING);
  }
  if (
    policy.fixtureTextWriteRequested !== true
    || policy.writeMode !== 'TEST_TEMP_FILE_ONLY'
    || policy.realIoScope !== 'FILE_ONLY'
    || policy.baseLocationKind !== 'OS_TEMP'
    || policy.hashObservationOnly !== true
    || policy.cleanupRequired !== true
    || !hasValue(policy.relativePath)
    || pathSegments.length !== 1
    || relativePathText !== pathSegments[0]
    || relativePathText.includes('/')
    || relativePathText.includes('\\')
  ) {
    reasons.push(REASON_CODES.FIXTURE_TEXT_WRITE_POLICY_REQUIRED);
  }
  if (
    policy.repoRootAccess === true
    || policy.productRootAccess === true
    || policy.productPathAccess === true
    || policy.rootInsideProject === true
    || input?.repoRootAccessRequested === true
  ) {
    reasons.push(REASON_CODES.FIXTURE_TEXT_WRITE_SCOPE_UNSAFE);
  }
  if (pathSegments.some((segment) => segment === '..' || segment === '.')) {
    reasons.push(REASON_CODES.PATH_TRAVERSAL_FORBIDDEN);
  }
  if (looksAbsolutePath(policy.relativePath) || looksAbsolutePath(policy.absolutePathProbe)) {
    reasons.push(REASON_CODES.ABSOLUTE_PATH_ESCAPE_FORBIDDEN);
  }
  if (
    hasValue(policy.expectedBeforeHash)
    && policy.expectedBeforeHash !== beforeObservation.textHash
  ) {
    reasons.push(REASON_CODES.HASH_OBSERVATION_MISMATCH);
  }
  if (
    hasValue(policy.expectedAfterHash)
    && policy.expectedAfterHash !== afterObservation.textHash
  ) {
    reasons.push(REASON_CODES.HASH_OBSERVATION_MISMATCH);
  }
  if (
    input?.productRootRequested === true
    || input?.productPathRequested === true
    || input?.productWrite === true
    || input?.runtimeWritable === true
  ) {
    reasons.push(REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR);
  }
  if (input?.publicSurfaceRequested === true) {
    reasons.push(REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR);
  }
  if (input?.storagePrimitiveRequested === true) {
    reasons.push(REASON_CODES.FS_MUTATION_FORBIDDEN_IN_CONTOUR);
  }
  return uniqueStrings(reasons);
}

function createTestFixtureTextWriteDecision(creationPlanResult, policy) {
  const creationDecision = creationPlanResult.fixtureRootCreationDecisions[0];
  const beforeObservation = createFixtureTextHashObservation(policy.beforeText || '', policy.hashPolicy);
  const afterObservation = createFixtureTextHashObservation(policy.afterText || '', policy.hashPolicy);
  const decisionCore = {
    fixtureTextWriteDecisionKind: 'EXACT_TEXT_TEST_FIXTURE_TEXT_WRITE_DECISION',
    decisionMode: 'TEST_TEMP_FILE_HASH_OBSERVATION_ONLY',
    testFixtureTextWriteAdmitted: true,
    hashObservationOnly: true,
    cleanupRequired: true,
    filesystemWritePerformed: false,
    productWritePerformed: false,
    fixtureBackupCreated: false,
    fixtureAtomicWriteExecuted: false,
    fixtureRecoverySnapshotCreated: false,
    fixtureReceiptPersisted: false,
    sourceFixtureRootCreationResultHash: creationPlanResult.canonicalHash,
    sourceFixtureRootCreationDecisionHash: creationDecision.canonicalHash,
    sourceFixtureRootPolicyResultHash: creationDecision.sourceFixtureRootPolicyResultHash,
    sourceFixtureRootPolicyDecisionHash: creationDecision.sourceFixtureRootPolicyDecisionHash,
    relativePath: policy.relativePath,
    relativePathSegments: pathSegmentsFromPolicy(policy),
    beforeHashObservation: beforeObservation,
    afterHashObservation: afterObservation,
    writePolicySnapshot: {
      ownerFixtureTextWriteApproved: policy.ownerFixtureTextWriteApproved === true,
      fixtureTextWriteRequested: policy.fixtureTextWriteRequested === true,
      writeMode: policy.writeMode,
      realIoScope: policy.realIoScope,
      baseLocationKind: policy.baseLocationKind,
      hashObservationOnly: policy.hashObservationOnly === true,
      cleanupRequired: policy.cleanupRequired === true,
      repoRootAccess: policy.repoRootAccess === true,
      productRootAccess: policy.productRootAccess === true,
      productPathAccess: policy.productPathAccess === true,
    },
  };
  const decisionWithId = {
    fixtureTextWriteDecisionId: `fixture_text_write_${canonicalHash(decisionCore).slice(0, 16)}`,
    ...decisionCore,
  };
  return {
    ...decisionWithId,
    canonicalHash: canonicalHash(decisionWithId),
  };
}

export function compileExactTextTestFixtureTextWritePlan(input = {}) {
  const creationPlanResult = input?.fixtureRootCreationPlanResult || {};
  const policy = input?.fixtureTextWritePolicy || {};
  const blockedReasons = [
    ...(creationPlanResult.blockedReasons || []),
    ...fixtureRootCreationPlanBindingReasons(creationPlanResult),
    ...fixtureTextWritePolicyReasons(policy, input),
  ];

  const uniqueBlockedReasons = uniqueStrings(blockedReasons);
  const fixtureTextWriteDecisions = uniqueBlockedReasons.length === 0
    ? [createTestFixtureTextWriteDecision(creationPlanResult, policy)]
    : [];
  const resultCore = {
    resultKind: 'EXACT_TEXT_TEST_FIXTURE_TEXT_WRITE_PLAN_RESULT',
    contractOnly: true,
    testFixtureTextWritePlanOnly: true,
    testFixtureTextWriteAdmitted: fixtureTextWriteDecisions.length === 1,
    testFixtureFileWriteOnly: fixtureTextWriteDecisions.length === 1,
    hashObservationOnly: true,
    filesystemWritePerformed: false,
    fsMutationPerformed: false,
    productWritePerformed: false,
    productWriteClaimed: false,
    fixtureBackupCreated: false,
    fixtureAtomicWriteExecuted: false,
    fixtureRecoverySnapshotCreated: false,
    fixtureReceiptPersisted: false,
    durableReceiptClaimed: false,
    productStorageSafetyClaimed: false,
    publicSurfaceClaimed: false,
    docxImportClaimed: false,
    uiChanged: false,
    applyTxnClaimed: false,
    crashRecoveryClaimed: false,
    releaseClaimed: false,
    storageImportsAdded: false,
    storagePrimitiveChanged: false,
    fixtureTextWriteDecisions,
    blockedReasons: uniqueBlockedReasons,
  };
  return {
    ...resultCore,
    canonicalHash: canonicalHash(resultCore),
  };
}

function fixtureTextWritePlanBindingReasons(writePlanResult = {}) {
  const reasons = [];
  const decisions = writePlanResult.fixtureTextWriteDecisions || [];
  if (
    writePlanResult.contractOnly !== true
    || writePlanResult.testFixtureTextWritePlanOnly !== true
    || writePlanResult.testFixtureTextWriteAdmitted !== true
    || writePlanResult.testFixtureFileWriteOnly !== true
    || writePlanResult.hashObservationOnly !== true
    || writePlanResult.filesystemWritePerformed !== false
    || writePlanResult.fsMutationPerformed !== false
    || writePlanResult.productWritePerformed !== false
    || writePlanResult.productWriteClaimed !== false
    || writePlanResult.fixtureBackupCreated !== false
    || writePlanResult.fixtureAtomicWriteExecuted !== false
    || writePlanResult.fixtureRecoverySnapshotCreated !== false
    || writePlanResult.fixtureReceiptPersisted !== false
    || writePlanResult.durableReceiptClaimed !== false
    || writePlanResult.productStorageSafetyClaimed !== false
    || writePlanResult.publicSurfaceClaimed !== false
    || writePlanResult.docxImportClaimed !== false
    || writePlanResult.uiChanged !== false
    || writePlanResult.applyTxnClaimed !== false
    || writePlanResult.crashRecoveryClaimed !== false
    || writePlanResult.releaseClaimed !== false
    || writePlanResult.storageImportsAdded !== false
    || writePlanResult.storagePrimitiveChanged !== false
    || decisions.length !== 1
    || !hasValue(writePlanResult.canonicalHash)
    || !hasValue(decisions[0]?.canonicalHash)
  ) {
    reasons.push(REASON_CODES.FIXTURE_TEXT_WRITE_PLAN_REQUIRED);
  }
  return uniqueStrings(reasons);
}

function fixtureTempRenamePolicyReasons(policy = {}, input = {}) {
  const reasons = [];
  const tempSegments = pathSegmentsFromPolicy({ relativePath: policy.tempRelativePath, relativePathSegments: policy.tempRelativePathSegments });
  const targetSegments = pathSegmentsFromPolicy({ relativePath: policy.targetRelativePath, relativePathSegments: policy.targetRelativePathSegments });
  const tempPathText = String(policy.tempRelativePath ?? '');
  const targetPathText = String(policy.targetRelativePath ?? '');
  const afterObservation = createFixtureTextHashObservation(policy.afterText || '', policy.hashPolicy);
  if (policy.ownerFixtureTempRenameApproved !== true) {
    reasons.push(REASON_CODES.FIXTURE_TEMP_RENAME_OWNER_MISSING);
  }
  if (
    policy.fixtureTempRenameRequested !== true
    || policy.renameMode !== 'TEST_TEMP_RENAME_ONLY'
    || policy.realIoScope !== 'TEMP_FILE_RENAME_ONLY'
    || policy.baseLocationKind !== 'OS_TEMP'
    || policy.sameRootRename !== true
    || policy.hashObservationOnly !== true
    || policy.cleanupRequired !== true
    || !hasValue(policy.tempRelativePath)
    || !hasValue(policy.targetRelativePath)
    || tempSegments.length !== 1
    || targetSegments.length !== 1
    || tempPathText !== tempSegments[0]
    || targetPathText !== targetSegments[0]
    || tempPathText === targetPathText
    || tempPathText.includes('/')
    || tempPathText.includes('\\')
    || targetPathText.includes('/')
    || targetPathText.includes('\\')
  ) {
    reasons.push(REASON_CODES.FIXTURE_TEMP_RENAME_POLICY_REQUIRED);
  }
  if (
    policy.repoRootAccess === true
    || policy.productRootAccess === true
    || policy.productPathAccess === true
    || policy.rootInsideProject === true
    || input?.repoRootAccessRequested === true
  ) {
    reasons.push(REASON_CODES.FIXTURE_TEMP_RENAME_SCOPE_UNSAFE);
  }
  if (
    tempSegments.some((segment) => segment === '..' || segment === '.')
    || targetSegments.some((segment) => segment === '..' || segment === '.')
  ) {
    reasons.push(REASON_CODES.PATH_TRAVERSAL_FORBIDDEN);
  }
  if (
    looksAbsolutePath(policy.tempRelativePath)
    || looksAbsolutePath(policy.targetRelativePath)
    || looksAbsolutePath(policy.absolutePathProbe)
  ) {
    reasons.push(REASON_CODES.ABSOLUTE_PATH_ESCAPE_FORBIDDEN);
  }
  if (
    hasValue(policy.expectedAfterHash)
    && policy.expectedAfterHash !== afterObservation.textHash
  ) {
    reasons.push(REASON_CODES.HASH_OBSERVATION_MISMATCH);
  }
  if (input?.leftoverTempFileObserved === true || input?.renameObservationMismatch === true) {
    reasons.push(REASON_CODES.TEMP_RENAME_OBSERVATION_MISMATCH);
  }
  if (
    input?.productRootRequested === true
    || input?.productPathRequested === true
    || input?.productWrite === true
    || input?.runtimeWritable === true
    || input?.productAtomicityClaimed === true
  ) {
    reasons.push(REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR);
  }
  if (input?.publicSurfaceRequested === true) {
    reasons.push(REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR);
  }
  if (input?.storagePrimitiveRequested === true) {
    reasons.push(REASON_CODES.FS_MUTATION_FORBIDDEN_IN_CONTOUR);
  }
  return uniqueStrings(reasons);
}

function createTestFixtureTempRenameObservationDecision(writePlanResult, policy) {
  const writeDecision = writePlanResult.fixtureTextWriteDecisions[0];
  const afterObservation = createFixtureTextHashObservation(policy.afterText || '', policy.hashPolicy);
  const decisionCore = {
    fixtureTempRenameDecisionKind: 'EXACT_TEXT_TEST_FIXTURE_TEMP_RENAME_OBSERVATION_DECISION',
    decisionMode: 'TEST_TEMP_RENAME_HASH_OBSERVATION_ONLY',
    testFixtureTempRenameAdmitted: true,
    testFixtureTempRenameObservationOnly: true,
    hashObservationOnly: true,
    cleanupRequired: true,
    xplatAtomicityNotProven: true,
    productAtomicWriteNotProven: true,
    tempRenameNotRecovery: true,
    filesystemWritePerformed: false,
    productWritePerformed: false,
    productAtomicityClaimed: false,
    fixtureBackupCreated: false,
    fixtureAtomicWriteExecuted: false,
    fixtureRecoverySnapshotCreated: false,
    fixtureReceiptPersisted: false,
    sourceFixtureTextWriteResultHash: writePlanResult.canonicalHash,
    sourceFixtureTextWriteDecisionHash: writeDecision.canonicalHash,
    sourceFixtureRootCreationResultHash: writeDecision.sourceFixtureRootCreationResultHash,
    sourceFixtureRootCreationDecisionHash: writeDecision.sourceFixtureRootCreationDecisionHash,
    tempRelativePath: policy.tempRelativePath,
    targetRelativePath: policy.targetRelativePath,
    tempRelativePathSegments: pathSegmentsFromPolicy({
      relativePath: policy.tempRelativePath,
      relativePathSegments: policy.tempRelativePathSegments,
    }),
    targetRelativePathSegments: pathSegmentsFromPolicy({
      relativePath: policy.targetRelativePath,
      relativePathSegments: policy.targetRelativePathSegments,
    }),
    afterHashObservation: afterObservation,
    renamePolicySnapshot: {
      ownerFixtureTempRenameApproved: policy.ownerFixtureTempRenameApproved === true,
      fixtureTempRenameRequested: policy.fixtureTempRenameRequested === true,
      renameMode: policy.renameMode,
      realIoScope: policy.realIoScope,
      baseLocationKind: policy.baseLocationKind,
      sameRootRename: policy.sameRootRename === true,
      hashObservationOnly: policy.hashObservationOnly === true,
      cleanupRequired: policy.cleanupRequired === true,
      repoRootAccess: policy.repoRootAccess === true,
      productRootAccess: policy.productRootAccess === true,
      productPathAccess: policy.productPathAccess === true,
    },
  };
  const decisionWithId = {
    fixtureTempRenameDecisionId: `fixture_temp_rename_${canonicalHash(decisionCore).slice(0, 16)}`,
    ...decisionCore,
  };
  return {
    ...decisionWithId,
    canonicalHash: canonicalHash(decisionWithId),
  };
}

export function compileExactTextTestFixtureTempRenameObservationPlan(input = {}) {
  const writePlanResult = input?.fixtureTextWritePlanResult || {};
  const policy = input?.fixtureTempRenamePolicy || {};
  const blockedReasons = [
    ...(writePlanResult.blockedReasons || []),
    ...fixtureTextWritePlanBindingReasons(writePlanResult),
    ...fixtureTempRenamePolicyReasons(policy, input),
  ];

  const uniqueBlockedReasons = uniqueStrings(blockedReasons);
  const fixtureTempRenameDecisions = uniqueBlockedReasons.length === 0
    ? [createTestFixtureTempRenameObservationDecision(writePlanResult, policy)]
    : [];
  const resultCore = {
    resultKind: 'EXACT_TEXT_TEST_FIXTURE_TEMP_RENAME_OBSERVATION_PLAN_RESULT',
    contractOnly: true,
    testFixtureTempRenameObservationPlanOnly: true,
    testFixtureTempRenameAdmitted: fixtureTempRenameDecisions.length === 1,
    testFixtureTempRenameObservationOnly: fixtureTempRenameDecisions.length === 1,
    hashObservationOnly: true,
    xplatAtomicityNotProven: true,
    productAtomicWriteNotProven: true,
    tempRenameNotRecovery: true,
    filesystemWritePerformed: false,
    fsMutationPerformed: false,
    productWritePerformed: false,
    productWriteClaimed: false,
    productAtomicityClaimed: false,
    fixtureBackupCreated: false,
    fixtureAtomicWriteExecuted: false,
    fixtureRecoverySnapshotCreated: false,
    fixtureReceiptPersisted: false,
    durableReceiptClaimed: false,
    productStorageSafetyClaimed: false,
    publicSurfaceClaimed: false,
    docxImportClaimed: false,
    uiChanged: false,
    applyTxnClaimed: false,
    crashRecoveryClaimed: false,
    releaseClaimed: false,
    storageImportsAdded: false,
    storagePrimitiveChanged: false,
    fixtureTempRenameDecisions,
    blockedReasons: uniqueBlockedReasons,
  };
  return {
    ...resultCore,
    canonicalHash: canonicalHash(resultCore),
  };
}

function fixtureTempRenamePlanBindingReasons(renamePlanResult = {}) {
  const reasons = [];
  const decisions = renamePlanResult.fixtureTempRenameDecisions || [];
  const decision = decisions[0] || {};
  if (
    renamePlanResult.contractOnly !== true
    || renamePlanResult.testFixtureTempRenameObservationPlanOnly !== true
    || renamePlanResult.testFixtureTempRenameAdmitted !== true
    || renamePlanResult.testFixtureTempRenameObservationOnly !== true
    || renamePlanResult.hashObservationOnly !== true
    || renamePlanResult.xplatAtomicityNotProven !== true
    || renamePlanResult.productAtomicWriteNotProven !== true
    || renamePlanResult.tempRenameNotRecovery !== true
    || renamePlanResult.filesystemWritePerformed !== false
    || renamePlanResult.fsMutationPerformed !== false
    || renamePlanResult.productWritePerformed !== false
    || renamePlanResult.productWriteClaimed !== false
    || renamePlanResult.productAtomicityClaimed !== false
    || renamePlanResult.fixtureBackupCreated !== false
    || renamePlanResult.fixtureAtomicWriteExecuted !== false
    || renamePlanResult.fixtureRecoverySnapshotCreated !== false
    || renamePlanResult.fixtureReceiptPersisted !== false
    || renamePlanResult.durableReceiptClaimed !== false
    || renamePlanResult.productStorageSafetyClaimed !== false
    || renamePlanResult.publicSurfaceClaimed !== false
    || renamePlanResult.docxImportClaimed !== false
    || renamePlanResult.uiChanged !== false
    || renamePlanResult.applyTxnClaimed !== false
    || renamePlanResult.crashRecoveryClaimed !== false
    || renamePlanResult.releaseClaimed !== false
    || renamePlanResult.storageImportsAdded !== false
    || renamePlanResult.storagePrimitiveChanged !== false
    || decisions.length !== 1
    || !hasValue(renamePlanResult.canonicalHash)
    || !hasValue(decision?.canonicalHash)
    || decision.fixtureTempRenameDecisionKind !== 'EXACT_TEXT_TEST_FIXTURE_TEMP_RENAME_OBSERVATION_DECISION'
    || decision.testFixtureTempRenameAdmitted !== true
    || decision.testFixtureTempRenameObservationOnly !== true
    || decision.hashObservationOnly !== true
    || decision.cleanupRequired !== true
    || decision.xplatAtomicityNotProven !== true
    || decision.productAtomicWriteNotProven !== true
    || decision.tempRenameNotRecovery !== true
    || decision.filesystemWritePerformed !== false
    || decision.productWritePerformed !== false
    || decision.productAtomicityClaimed !== false
    || decision.fixtureBackupCreated !== false
    || decision.fixtureAtomicWriteExecuted !== false
    || decision.fixtureRecoverySnapshotCreated !== false
    || decision.fixtureReceiptPersisted !== false
    || !hasValue(decision.sourceFixtureTextWriteResultHash)
    || !hasValue(decision.sourceFixtureTextWriteDecisionHash)
    || !hasValue(decision.sourceFixtureRootCreationResultHash)
    || !hasValue(decision.sourceFixtureRootCreationDecisionHash)
    || !hasValue(decision.afterHashObservation?.textHash)
  ) {
    reasons.push(REASON_CODES.FIXTURE_TEMP_RENAME_PLAN_REQUIRED);
  }
  return uniqueStrings(reasons);
}

function fixtureReceiptFilePolicyReasons(policy = {}, input = {}) {
  const reasons = [];
  const receiptSegments = pathSegmentsFromPolicy({
    relativePath: policy.receiptRelativePath,
    relativePathSegments: policy.receiptRelativePathSegments,
  });
  const receiptPathText = String(policy.receiptRelativePath ?? '');
  const receiptObservation = createFixtureTextHashObservation(policy.receiptText || '', policy.hashPolicy);
  if (policy.ownerFixtureReceiptFileObservationApproved !== true) {
    reasons.push(REASON_CODES.FIXTURE_RECEIPT_FILE_OWNER_MISSING);
  }
  if (
    policy.fixtureReceiptFileObservationRequested !== true
    || policy.observationMode !== 'TEST_TEMP_RECEIPT_FILE_ONLY'
    || policy.realIoScope !== 'RECEIPT_FILE_WRITE_READBACK_ONLY'
    || policy.baseLocationKind !== 'OS_TEMP'
    || policy.receiptObservationOnly !== true
    || policy.durableReceiptClaimed !== false
    || policy.applyReceiptImplemented !== false
    || policy.cleanupRequired !== true
    || !hasValue(policy.receiptRelativePath)
    || !hasValue(policy.receiptText)
    || receiptSegments.length !== 1
    || receiptPathText !== receiptSegments[0]
    || receiptPathText.includes('/')
    || receiptPathText.includes('\\')
  ) {
    reasons.push(REASON_CODES.FIXTURE_RECEIPT_FILE_POLICY_REQUIRED);
  }
  if (
    policy.repoRootAccess === true
    || policy.productRootAccess === true
    || policy.productPathAccess === true
    || policy.rootInsideProject === true
    || input?.repoRootAccessRequested === true
  ) {
    reasons.push(REASON_CODES.FIXTURE_RECEIPT_FILE_SCOPE_UNSAFE);
  }
  if (receiptSegments.some((segment) => segment === '..' || segment === '.')) {
    reasons.push(REASON_CODES.PATH_TRAVERSAL_FORBIDDEN);
  }
  if (looksAbsolutePath(policy.receiptRelativePath) || looksAbsolutePath(policy.absolutePathProbe)) {
    reasons.push(REASON_CODES.ABSOLUTE_PATH_ESCAPE_FORBIDDEN);
  }
  if (
    hasValue(policy.expectedReceiptHash)
    && policy.expectedReceiptHash !== receiptObservation.textHash
  ) {
    reasons.push(REASON_CODES.HASH_OBSERVATION_MISMATCH);
  }
  if (
    input?.receiptReadbackMismatch === true
    || input?.receiptFileObservationMismatch === true
    || input?.applyReceiptRequested === true
    || input?.productApplyReceiptClaimed === true
    || input?.durableReceiptClaimed === true
    || input?.recoveryClaimed === true
  ) {
    reasons.push(REASON_CODES.RECEIPT_CONTRACT_MISMATCH);
  }
  if (
    input?.productRootRequested === true
    || input?.productPathRequested === true
    || input?.productWrite === true
    || input?.runtimeWritable === true
  ) {
    reasons.push(REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR);
  }
  if (input?.publicSurfaceRequested === true) {
    reasons.push(REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR);
  }
  if (input?.storagePrimitiveRequested === true) {
    reasons.push(REASON_CODES.FS_MUTATION_FORBIDDEN_IN_CONTOUR);
  }
  return uniqueStrings(reasons);
}

function createTestFixtureReceiptFileObservationDecision(renamePlanResult, policy) {
  const renameDecision = renamePlanResult.fixtureTempRenameDecisions[0];
  const receiptObservation = createFixtureTextHashObservation(policy.receiptText || '', policy.hashPolicy);
  const decisionCore = {
    fixtureReceiptFileObservationDecisionKind: 'EXACT_TEXT_TEST_FIXTURE_RECEIPT_FILE_OBSERVATION_DECISION',
    decisionMode: 'TEST_TEMP_RECEIPT_FILE_WRITE_READBACK_OBSERVATION_ONLY',
    testFixtureReceiptFileObservationAdmitted: true,
    testFixtureReceiptFileObservationOnly: true,
    receiptObservationOnly: true,
    hashObservationOnly: true,
    cleanupRequired: true,
    productReceiptNotProven: true,
    durableReceiptNotProven: true,
    productApplyReceiptNotImplemented: true,
    productDurableReceiptNotProven: true,
    testReceiptFileNotRecovery: true,
    fixtureReceiptFileObservationNotProductPersistence: true,
    applyReceiptImplemented: false,
    filesystemWritePerformed: false,
    productWritePerformed: false,
    fixtureBackupCreated: false,
    fixtureAtomicWriteExecuted: false,
    fixtureRecoverySnapshotCreated: false,
    fixtureReceiptPersisted: false,
    durableReceiptClaimed: false,
    productApplyReceiptClaimed: false,
    sourceFixtureTempRenameResultHash: renamePlanResult.canonicalHash,
    sourceFixtureTempRenameDecisionHash: renameDecision.canonicalHash,
    sourceFixtureTextWriteResultHash: renameDecision.sourceFixtureTextWriteResultHash,
    sourceFixtureTextWriteDecisionHash: renameDecision.sourceFixtureTextWriteDecisionHash,
    sourceFixtureRootCreationResultHash: renameDecision.sourceFixtureRootCreationResultHash,
    sourceFixtureRootCreationDecisionHash: renameDecision.sourceFixtureRootCreationDecisionHash,
    receiptRelativePath: policy.receiptRelativePath,
    receiptRelativePathSegments: pathSegmentsFromPolicy({
      relativePath: policy.receiptRelativePath,
      relativePathSegments: policy.receiptRelativePathSegments,
    }),
    receiptText: policy.receiptText,
    receiptHashObservation: receiptObservation,
    receiptPolicySnapshot: {
      ownerFixtureReceiptFileObservationApproved: policy.ownerFixtureReceiptFileObservationApproved === true,
      fixtureReceiptFileObservationRequested: policy.fixtureReceiptFileObservationRequested === true,
      observationMode: policy.observationMode,
      realIoScope: policy.realIoScope,
      baseLocationKind: policy.baseLocationKind,
      receiptObservationOnly: policy.receiptObservationOnly === true,
      durableReceiptClaimed: policy.durableReceiptClaimed === true,
      applyReceiptImplemented: policy.applyReceiptImplemented === true,
      cleanupRequired: policy.cleanupRequired === true,
      repoRootAccess: policy.repoRootAccess === true,
      productRootAccess: policy.productRootAccess === true,
      productPathAccess: policy.productPathAccess === true,
    },
  };
  const decisionWithId = {
    fixtureReceiptFileObservationDecisionId: `fixture_receipt_file_${canonicalHash(decisionCore).slice(0, 16)}`,
    ...decisionCore,
  };
  return {
    ...decisionWithId,
    canonicalHash: canonicalHash(decisionWithId),
  };
}

export function compileExactTextTestFixtureReceiptFileObservationPlan(input = {}) {
  const renamePlanResult = input?.fixtureTempRenamePlanResult || {};
  const policy = input?.fixtureReceiptFilePolicy || {};
  const blockedReasons = [
    ...(renamePlanResult.blockedReasons || []),
    ...fixtureTempRenamePlanBindingReasons(renamePlanResult),
    ...fixtureReceiptFilePolicyReasons(policy, input),
  ];

  const uniqueBlockedReasons = uniqueStrings(blockedReasons);
  const fixtureReceiptFileObservationDecisions = uniqueBlockedReasons.length === 0
    ? [createTestFixtureReceiptFileObservationDecision(renamePlanResult, policy)]
    : [];
  const resultCore = {
    resultKind: 'EXACT_TEXT_TEST_FIXTURE_RECEIPT_FILE_OBSERVATION_PLAN_RESULT',
    contractOnly: true,
    testFixtureReceiptFileObservationPlanOnly: true,
    testFixtureReceiptFileObservationAdmitted: fixtureReceiptFileObservationDecisions.length === 1,
    testFixtureReceiptFileObservationOnly: fixtureReceiptFileObservationDecisions.length === 1,
    receiptObservationOnly: true,
    hashObservationOnly: true,
    productReceiptNotProven: true,
    durableReceiptNotProven: true,
    productApplyReceiptNotImplemented: true,
    productDurableReceiptNotProven: true,
    testReceiptFileNotRecovery: true,
    fixtureReceiptFileObservationNotProductPersistence: true,
    applyReceiptImplemented: false,
    filesystemWritePerformed: false,
    fsMutationPerformed: false,
    productWritePerformed: false,
    productWriteClaimed: false,
    productAtomicityClaimed: false,
    fixtureBackupCreated: false,
    fixtureAtomicWriteExecuted: false,
    fixtureRecoverySnapshotCreated: false,
    fixtureReceiptPersisted: false,
    durableReceiptClaimed: false,
    productApplyReceiptClaimed: false,
    productStorageSafetyClaimed: false,
    publicSurfaceClaimed: false,
    docxImportClaimed: false,
    uiChanged: false,
    applyTxnClaimed: false,
    crashRecoveryClaimed: false,
    releaseClaimed: false,
    storageImportsAdded: false,
    storagePrimitiveChanged: false,
    fixtureReceiptFileObservationDecisions,
    blockedReasons: uniqueBlockedReasons,
  };
  return {
    ...resultCore,
    canonicalHash: canonicalHash(resultCore),
  };
}

const PRODUCT_STORAGE_PRIMITIVE_REQUIRED_EVIDENCE = Object.freeze([
  Object.freeze({
    evidenceKind: 'BACKUP_PRIMITIVE_CANDIDATE',
    allowedBasenames: Object.freeze(['backupManager.js']),
    requiredObservedPatterns: Object.freeze(['createBackup', 'atomic_write_helper']),
  }),
  Object.freeze({
    evidenceKind: 'ATOMIC_WRITE_PRIMITIVE_CANDIDATE',
    allowedBasenames: Object.freeze(['atomicWriteFile.mjs', 'fileManager.js']),
    requiredObservedPatterns: Object.freeze(['atomicWriteFile', 'atomic_rename_helper']),
  }),
  Object.freeze({
    evidenceKind: 'RECOVERY_PRIMITIVE_CANDIDATE',
    allowedBasenames: Object.freeze(['snapshotFile.mjs']),
    requiredObservedPatterns: Object.freeze(['createRecoverySnapshot', 'listRecoverySnapshots']),
  }),
]);

const PRODUCT_STORAGE_PRIMITIVE_REQUIRED_TESTS = Object.freeze([
  'recovery-atomic-write.contract.test.js',
  'recovery-replay.contract.test.js',
  'recovery-snapshot-fallback.contract.test.js',
]);

const PRODUCT_STORAGE_PRIMITIVE_DENYLIST_BASENAMES = new Set([
  'fileManager.js',
  'backupManager.js',
  'atomicWriteFile.mjs',
  'hostilePackageGate.mjs',
]);

function evidenceHashForPrimitiveEvidence(evidence = {}) {
  return canonicalHash({
    evidenceKind: evidence.evidenceKind || '',
    basename: evidence.basename || '',
    sourceHash: evidence.sourceHash || '',
    observedPatterns: uniqueStrings(evidence.observedPatterns || []),
    existingTestBasenames: uniqueStrings(evidence.existingTestBasenames || []),
  });
}

function evidenceHashForExistingTestEvidence(evidence = {}) {
  return canonicalHash({
    testBasename: evidence.testBasename || '',
    sourceHash: evidence.sourceHash || '',
    observedAssertions: uniqueStrings(evidence.observedAssertions || []),
  });
}

function fixtureReceiptFileObservationAcceptedBindingReasons(receiptFileObservationResult = {}) {
  const reasons = [];
  const decisions = receiptFileObservationResult.fixtureReceiptFileObservationDecisions || [];
  const decision = decisions[0] || {};
  if (
    receiptFileObservationResult.contractOnly !== true
    || receiptFileObservationResult.testFixtureReceiptFileObservationPlanOnly !== true
    || receiptFileObservationResult.testFixtureReceiptFileObservationAdmitted !== true
    || receiptFileObservationResult.testFixtureReceiptFileObservationOnly !== true
    || receiptFileObservationResult.receiptObservationOnly !== true
    || receiptFileObservationResult.hashObservationOnly !== true
    || receiptFileObservationResult.productReceiptNotProven !== true
    || receiptFileObservationResult.durableReceiptNotProven !== true
    || receiptFileObservationResult.productApplyReceiptNotImplemented !== true
    || receiptFileObservationResult.productDurableReceiptNotProven !== true
    || receiptFileObservationResult.testReceiptFileNotRecovery !== true
    || receiptFileObservationResult.fixtureReceiptFileObservationNotProductPersistence !== true
    || receiptFileObservationResult.applyReceiptImplemented !== false
    || receiptFileObservationResult.filesystemWritePerformed !== false
    || receiptFileObservationResult.fsMutationPerformed !== false
    || receiptFileObservationResult.productWritePerformed !== false
    || receiptFileObservationResult.productWriteClaimed !== false
    || receiptFileObservationResult.productAtomicityClaimed !== false
    || receiptFileObservationResult.fixtureBackupCreated !== false
    || receiptFileObservationResult.fixtureAtomicWriteExecuted !== false
    || receiptFileObservationResult.fixtureRecoverySnapshotCreated !== false
    || receiptFileObservationResult.fixtureReceiptPersisted !== false
    || receiptFileObservationResult.durableReceiptClaimed !== false
    || receiptFileObservationResult.productApplyReceiptClaimed !== false
    || receiptFileObservationResult.productStorageSafetyClaimed !== false
    || receiptFileObservationResult.publicSurfaceClaimed !== false
    || receiptFileObservationResult.docxImportClaimed !== false
    || receiptFileObservationResult.uiChanged !== false
    || receiptFileObservationResult.applyTxnClaimed !== false
    || receiptFileObservationResult.crashRecoveryClaimed !== false
    || receiptFileObservationResult.releaseClaimed !== false
    || receiptFileObservationResult.storageImportsAdded !== false
    || receiptFileObservationResult.storagePrimitiveChanged !== false
    || decisions.length !== 1
    || !hasValue(receiptFileObservationResult.canonicalHash)
    || !hasValue(decision?.canonicalHash)
    || decision.fixtureReceiptFileObservationDecisionKind !== 'EXACT_TEXT_TEST_FIXTURE_RECEIPT_FILE_OBSERVATION_DECISION'
    || decision.testFixtureReceiptFileObservationAdmitted !== true
    || decision.testFixtureReceiptFileObservationOnly !== true
    || decision.receiptObservationOnly !== true
    || decision.productReceiptNotProven !== true
    || decision.durableReceiptNotProven !== true
    || decision.productApplyReceiptNotImplemented !== true
    || decision.productDurableReceiptNotProven !== true
    || decision.testReceiptFileNotRecovery !== true
    || decision.fixtureReceiptFileObservationNotProductPersistence !== true
    || decision.applyReceiptImplemented !== false
    || decision.filesystemWritePerformed !== false
    || decision.productWritePerformed !== false
    || decision.fixtureBackupCreated !== false
    || decision.fixtureAtomicWriteExecuted !== false
    || decision.fixtureRecoverySnapshotCreated !== false
    || decision.fixtureReceiptPersisted !== false
    || decision.durableReceiptClaimed !== false
    || decision.productApplyReceiptClaimed !== false
  ) {
    reasons.push(REASON_CODES.FIXTURE_RECEIPT_FILE_POLICY_REQUIRED);
  }
  return uniqueStrings(reasons);
}

function productStoragePrimitiveEvidencePacketClaimReasons(packet = {}, input = {}) {
  const reasons = [];
  if (
    packet.productWriteRequested === true
    || packet.productWriteClaimed === true
    || input?.productWriteRequested === true
    || input?.productWrite === true
    || input?.runtimeWritable === true
  ) {
    reasons.push(REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR);
  }
  if (
    packet.productStorageIntegrationClaimed === true
    || packet.productStorageAdapterIntegrated === true
    || packet.productStorageSafetyClaimed === true
    || input?.storageIntegrationClaimed === true
    || input?.productStorageIntegrationClaimed === true
  ) {
    reasons.push(REASON_CODES.STORAGE_INTEGRATION_FORBIDDEN_IN_CONTOUR);
  }
  if (
    packet.productAtomicityClaimed === true
    || packet.atomicWriteExecuted === true
    || packet.fixtureAtomicWriteExecuted === true
    || input?.productAtomicityClaimed === true
    || input?.atomicWriteExecuted === true
  ) {
    reasons.push(REASON_CODES.ATOMICITY_CLAIM_FORBIDDEN_IN_CONTOUR);
  }
  if (
    packet.recoveryClaimed === true
    || packet.crashRecoveryClaimed === true
    || packet.recoverySnapshotCreated === true
    || packet.fixtureRecoverySnapshotCreated === true
    || input?.recoveryClaimed === true
    || input?.crashRecoveryClaimed === true
  ) {
    reasons.push(REASON_CODES.RECOVERY_CLAIM_FORBIDDEN_IN_CONTOUR);
  }
  if (
    packet.durableReceiptClaimed === true
    || packet.applyReceiptImplemented === true
    || packet.productApplyReceiptClaimed === true
    || input?.durableReceiptClaimed === true
    || input?.applyReceiptImplemented === true
    || input?.productApplyReceiptClaimed === true
  ) {
    reasons.push(REASON_CODES.RECEIPT_CONTRACT_MISMATCH);
  }
  if (
    packet.applyTxnClaimed === true
    || input?.applyTxnClaimed === true
  ) {
    reasons.push(REASON_CODES.STRUCTURAL_AUTO_APPLY_FORBIDDEN);
  }
  if (
    packet.publicSurfaceClaimed === true
    || packet.ipcSurfaceClaimed === true
    || packet.commandSurfaceClaimed === true
    || packet.preloadSurfaceClaimed === true
    || input?.publicSurfaceClaimed === true
    || input?.publicSurfaceRequested === true
    || input?.ipcSurfaceClaimed === true
    || input?.commandSurfaceClaimed === true
    || input?.preloadSurfaceClaimed === true
  ) {
    reasons.push(REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR);
  }
  if (
    packet.docxImportClaimed === true
    || packet.docxRuntimeClaimed === true
    || input?.docxImportClaimed === true
    || input?.docxRuntimeClaimed === true
  ) {
    reasons.push(REASON_CODES.SEMANTIC_PARSE_FORBIDDEN);
  }
  if (
    packet.uiChanged === true
    || packet.uiSurfaceClaimed === true
    || input?.uiChanged === true
    || input?.uiSurfaceClaimed === true
  ) {
    reasons.push(REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR);
  }
  if (
    packet.networkUsed === true
    || packet.networkClaimed === true
    || input?.networkUsed === true
    || input?.networkClaimed === true
  ) {
    reasons.push(REASON_CODES.NETWORK_FORBIDDEN);
  }
  if (
    packet.dependencyChanged === true
    || input?.dependencyChanged === true
  ) {
    reasons.push(REASON_CODES.DEPENDENCY_FORBIDDEN);
  }
  if (
    packet.storageImportsAdded === true
    || input?.storageImportsAdded === true
  ) {
    reasons.push(REASON_CODES.FS_MUTATION_FORBIDDEN_IN_CONTOUR);
  }
  return uniqueStrings(reasons);
}

function primitiveEvidenceRequirementReasons(packet = {}) {
  const reasons = [];
  if (packet.packetKind !== 'EXACT_TEXT_PRODUCT_STORAGE_PRIMITIVE_EVIDENCE_PACKET_001M') {
    reasons.push(REASON_CODES.PRODUCT_STORAGE_PRIMITIVE_EVIDENCE_MISSING);
  }

  const staticEvidence = Array.isArray(packet.staticPrimitiveEvidence) ? packet.staticPrimitiveEvidence : [];
  const testEvidence = Array.isArray(packet.existingTestEvidence) ? packet.existingTestEvidence : [];
  const denylistEvidence = Array.isArray(packet.denylistPrimitiveEvidence) ? packet.denylistPrimitiveEvidence : [];
  for (const evidence of [...staticEvidence, ...denylistEvidence]) {
    if (PRODUCT_STORAGE_PRIMITIVE_DENYLIST_BASENAMES.has(evidence?.basename) && evidence?.editedInCurrentContour === true) {
      reasons.push(REASON_CODES.DENYLIST_PRIMITIVE_EDITED);
    }
  }

  const testBasenames = new Set();
  for (const evidence of testEvidence) {
    if (
      !hasValue(evidence?.testBasename)
      || !hasValue(evidence?.sourceHash)
      || !Array.isArray(evidence?.observedAssertions)
      || evidence.observedAssertions.length === 0
      || evidence.evidenceHash !== evidenceHashForExistingTestEvidence(evidence)
    ) {
      reasons.push(REASON_CODES.PRODUCT_STORAGE_PRIMITIVE_TEST_EVIDENCE_MISSING);
      continue;
    }
    testBasenames.add(evidence.testBasename);
  }
  for (const requiredTestBasename of PRODUCT_STORAGE_PRIMITIVE_REQUIRED_TESTS) {
    if (!testBasenames.has(requiredTestBasename)) {
      reasons.push(REASON_CODES.PRODUCT_STORAGE_PRIMITIVE_TEST_EVIDENCE_MISSING);
    }
  }

  for (const requirement of PRODUCT_STORAGE_PRIMITIVE_REQUIRED_EVIDENCE) {
    const matchingEvidence = staticEvidence.find((evidence) => evidence?.evidenceKind === requirement.evidenceKind);
    if (
      !matchingEvidence
      || !requirement.allowedBasenames.includes(matchingEvidence.basename)
      || !hasValue(matchingEvidence.sourceHash)
      || !Array.isArray(matchingEvidence.observedPatterns)
      || !requirement.requiredObservedPatterns.every((pattern) => matchingEvidence.observedPatterns.includes(pattern))
      || matchingEvidence.evidenceHash !== evidenceHashForPrimitiveEvidence(matchingEvidence)
    ) {
      reasons.push(REASON_CODES.PRODUCT_STORAGE_PRIMITIVE_EVIDENCE_MISSING);
      continue;
    }
    const linkedTests = new Set(matchingEvidence.existingTestBasenames || []);
    if (linkedTests.size === 0 || !PRODUCT_STORAGE_PRIMITIVE_REQUIRED_TESTS.some((testBasename) => linkedTests.has(testBasename))) {
      reasons.push(REASON_CODES.PRODUCT_STORAGE_PRIMITIVE_TEST_EVIDENCE_MISSING);
    }
  }

  return uniqueStrings(reasons);
}

function createProductStoragePrimitiveEvidencePlanningDecision(receiptFileObservationResult, packet) {
  const receiptDecision = receiptFileObservationResult.fixtureReceiptFileObservationDecisions[0];
  const staticPrimitiveEvidence = (packet.staticPrimitiveEvidence || []).map((evidence) => ({
    evidenceKind: evidence.evidenceKind,
    basename: evidence.basename,
    sourceHash: evidence.sourceHash,
    evidenceHash: evidence.evidenceHash,
    observedPatterns: uniqueStrings(evidence.observedPatterns || []),
    existingTestBasenames: uniqueStrings(evidence.existingTestBasenames || []),
  }));
  const existingTestEvidence = (packet.existingTestEvidence || []).map((evidence) => ({
    testBasename: evidence.testBasename,
    sourceHash: evidence.sourceHash,
    evidenceHash: evidence.evidenceHash,
    observedAssertions: uniqueStrings(evidence.observedAssertions || []),
  }));
  const decisionCore = {
    productStoragePrimitiveEvidenceDecisionKind: 'EXACT_TEXT_PRODUCT_STORAGE_PRIMITIVE_EVIDENCE_GATE_DECISION',
    decisionMode: 'BINARY_PLANNING_DECISION_ONLY',
    productStoragePrimitiveEvidenceAdmitted: true,
    acceptedBinding: 'EXACT_TEXT_APPLY_TEST_FIXTURE_RECEIPT_FILE_OBSERVATION_001L',
    outputDecision: 'FUTURE_DRY_RUN_CONTOUR_MAY_BE_PLANNED',
    productStorageRuntimeSafetyNotProven: true,
    existingPrimitiveReuseNotIntegration: true,
    productWriteStillRequiresSeparateOwnerApprovedTz: true,
    receiptPersistenceStillRequiresFutureContour: true,
    futureDryRunRequiresOwnerApproval: true,
    backupPrimitiveEvidenceRequired: true,
    atomicWritePrimitiveEvidenceRequired: true,
    recoveryPrimitiveEvidenceRequired: true,
    existingPrimitiveTestsEvidenceRequired: true,
    sourceFixtureReceiptFileObservationResultHash: receiptFileObservationResult.canonicalHash,
    sourceFixtureReceiptFileObservationDecisionHash: receiptDecision.canonicalHash,
    sourceFixtureTempRenameResultHash: receiptDecision.sourceFixtureTempRenameResultHash,
    sourceFixtureTextWriteResultHash: receiptDecision.sourceFixtureTextWriteResultHash,
    productWritePerformed: false,
    productWriteRequested: false,
    productStorageIntegrated: false,
    productStorageIntegrationClaimed: false,
    productStorageSafetyClaimed: false,
    productAtomicityClaimed: false,
    atomicWriteExecuted: false,
    recoveryClaimed: false,
    recoverySnapshotCreated: false,
    durableReceiptClaimed: false,
    applyReceiptImplemented: false,
    productApplyReceiptClaimed: false,
    crashRecoveryClaimed: false,
    applyTxnClaimed: false,
    publicSurfaceClaimed: false,
    docxImportClaimed: false,
    uiChanged: false,
    storagePrimitiveChanged: false,
    staticPrimitiveEvidence,
    existingTestEvidence,
  };
  const decisionWithId = {
    productStoragePrimitiveEvidenceDecisionId: `product_storage_primitive_evidence_${canonicalHash(decisionCore).slice(0, 16)}`,
    ...decisionCore,
  };
  return {
    ...decisionWithId,
    canonicalHash: canonicalHash(decisionWithId),
  };
}

export function compileExactTextProductStoragePrimitiveEvidenceGate(input = {}) {
  const receiptFileObservationResult = input?.fixtureReceiptFileObservationResult || {};
  const evidencePacket = input?.evidencePacket || {};
  const blockedReasons = [
    ...(receiptFileObservationResult.blockedReasons || []),
    ...fixtureReceiptFileObservationAcceptedBindingReasons(receiptFileObservationResult),
    ...primitiveEvidenceRequirementReasons(evidencePacket),
    ...productStoragePrimitiveEvidencePacketClaimReasons(evidencePacket, input),
  ];

  const uniqueBlockedReasons = uniqueStrings(blockedReasons);
  const productStoragePrimitiveEvidenceDecisions = uniqueBlockedReasons.length === 0
    ? [createProductStoragePrimitiveEvidencePlanningDecision(receiptFileObservationResult, evidencePacket)]
    : [];
  const resultCore = {
    resultKind: 'EXACT_TEXT_PRODUCT_STORAGE_PRIMITIVE_EVIDENCE_GATE_RESULT',
    contractOnly: true,
    evidenceGateOnly: true,
    binaryPlanningDecisionOnly: true,
    productStoragePrimitiveEvidenceAdmitted: productStoragePrimitiveEvidenceDecisions.length === 1,
    accepted001LBinding: productStoragePrimitiveEvidenceDecisions.length === 1,
    outputDecision: productStoragePrimitiveEvidenceDecisions.length === 1
      ? 'FUTURE_DRY_RUN_CONTOUR_MAY_BE_PLANNED'
      : 'PRODUCT_WRITE_PATH_REMAINS_BLOCKED',
    productStorageRuntimeSafetyNotProven: true,
    existingPrimitiveReuseNotIntegration: true,
    productWriteStillRequiresSeparateOwnerApprovedTz: true,
    receiptPersistenceStillRequiresFutureContour: true,
    futureDryRunRequiresOwnerApproval: true,
    backupPrimitiveEvidenceRequired: true,
    atomicWritePrimitiveEvidenceRequired: true,
    recoveryPrimitiveEvidenceRequired: true,
    existingPrimitiveTestsEvidenceRequired: true,
    productWritePerformed: false,
    productWriteRequested: false,
    productWriteClaimed: false,
    productStorageIntegrated: false,
    productStorageIntegrationClaimed: false,
    productStorageSafetyClaimed: false,
    productAtomicityClaimed: false,
    atomicWriteExecuted: false,
    recoveryClaimed: false,
    recoverySnapshotCreated: false,
    durableReceiptClaimed: false,
    applyReceiptImplemented: false,
    productApplyReceiptClaimed: false,
    crashRecoveryClaimed: false,
    applyTxnClaimed: false,
    publicSurfaceClaimed: false,
    docxImportClaimed: false,
    uiChanged: false,
    storageImportsAdded: false,
    storagePrimitiveChanged: false,
    productStoragePrimitiveEvidenceDecisions,
    blockedReasons: uniqueBlockedReasons,
  };
  return {
    ...resultCore,
    canonicalHash: canonicalHash(resultCore),
  };
}

function acceptedProductStoragePrimitiveEvidenceGateReasons(result = {}) {
  const reasons = [];
  const decisions = result.productStoragePrimitiveEvidenceDecisions || [];
  const decision = decisions[0] || {};
  if (
    result.resultKind !== 'EXACT_TEXT_PRODUCT_STORAGE_PRIMITIVE_EVIDENCE_GATE_RESULT'
    || result.contractOnly !== true
    || result.evidenceGateOnly !== true
    || result.binaryPlanningDecisionOnly !== true
    || result.productStoragePrimitiveEvidenceAdmitted !== true
    || result.accepted001LBinding !== true
    || result.outputDecision !== 'FUTURE_DRY_RUN_CONTOUR_MAY_BE_PLANNED'
    || result.productStorageRuntimeSafetyNotProven !== true
    || result.existingPrimitiveReuseNotIntegration !== true
    || result.productWriteStillRequiresSeparateOwnerApprovedTz !== true
    || result.receiptPersistenceStillRequiresFutureContour !== true
    || result.futureDryRunRequiresOwnerApproval !== true
    || result.productWritePerformed !== false
    || result.productWriteRequested !== false
    || result.productWriteClaimed !== false
    || result.productStorageIntegrated !== false
    || result.productStorageIntegrationClaimed !== false
    || result.productStorageSafetyClaimed !== false
    || result.productAtomicityClaimed !== false
    || result.atomicWriteExecuted !== false
    || result.recoveryClaimed !== false
    || result.recoverySnapshotCreated !== false
    || result.durableReceiptClaimed !== false
    || result.applyReceiptImplemented !== false
    || result.productApplyReceiptClaimed !== false
    || result.crashRecoveryClaimed !== false
    || result.applyTxnClaimed !== false
    || result.publicSurfaceClaimed !== false
    || result.docxImportClaimed !== false
    || result.uiChanged !== false
    || result.storageImportsAdded !== false
    || result.storagePrimitiveChanged !== false
    || decisions.length !== 1
    || !hasValue(result.canonicalHash)
    || !hasValue(decision?.canonicalHash)
    || decision.productStoragePrimitiveEvidenceDecisionKind !== 'EXACT_TEXT_PRODUCT_STORAGE_PRIMITIVE_EVIDENCE_GATE_DECISION'
    || decision.outputDecision !== 'FUTURE_DRY_RUN_CONTOUR_MAY_BE_PLANNED'
    || decision.productStorageSafetyClaimed !== false
    || decision.productWritePerformed !== false
    || decision.applyReceiptImplemented !== false
    || decision.applyTxnClaimed !== false
  ) {
    reasons.push(REASON_CODES.PRODUCT_STORAGE_PRIMITIVE_EVIDENCE_MISSING);
  }
  return uniqueStrings(reasons);
}

function testOnlyStoragePrimitiveExecutionClaimReasons(packet = {}, input = {}) {
  const reasons = [];
  if (
    packet.productWritePerformed === true
    || packet.productWriteClaimed === true
    || packet.productWriteRequested === true
    || input.productWritePerformed === true
    || input.productWriteClaimed === true
    || input.productWriteRequested === true
    || input.runtimeWritable === true
  ) {
    reasons.push(REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR);
  }
  if (
    packet.productAdmission === true
    || packet.productStorageSafetyClaimed === true
    || packet.productStorageIntegrated === true
    || input.productStorageSafetyClaimed === true
    || input.productStorageIntegrated === true
  ) {
    reasons.push(REASON_CODES.STORAGE_INTEGRATION_FORBIDDEN_IN_CONTOUR);
  }
  if (
    packet.durableReceiptClaimed === true
    || packet.applyReceiptImplemented === true
    || packet.productApplyReceiptClaimed === true
    || input.durableReceiptClaimed === true
    || input.applyReceiptImplemented === true
  ) {
    reasons.push(REASON_CODES.RECEIPT_CONTRACT_MISMATCH);
  }
  if (
    packet.recoveryClaimed === true
    || packet.crashRecoveryClaimed === true
    || input.recoveryClaimed === true
    || input.crashRecoveryClaimed === true
  ) {
    reasons.push(REASON_CODES.RECOVERY_CLAIM_FORBIDDEN_IN_CONTOUR);
  }
  if (
    packet.applyTxnClaimed === true
    || input.applyTxnClaimed === true
  ) {
    reasons.push(REASON_CODES.STRUCTURAL_AUTO_APPLY_FORBIDDEN);
  }
  if (
    packet.publicSurfaceClaimed === true
    || packet.ipcSurfaceClaimed === true
    || packet.commandSurfaceClaimed === true
    || packet.preloadSurfaceClaimed === true
    || input.publicSurfaceClaimed === true
    || input.publicSurfaceRequested === true
  ) {
    reasons.push(REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR);
  }
  if (packet.docxImportClaimed === true || input.docxImportClaimed === true) {
    reasons.push(REASON_CODES.SEMANTIC_PARSE_FORBIDDEN);
  }
  if (packet.uiChanged === true || input.uiChanged === true) {
    reasons.push(REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR);
  }
  if (packet.networkUsed === true || input.networkUsed === true) {
    reasons.push(REASON_CODES.NETWORK_FORBIDDEN);
  }
  if (packet.dependencyChanged === true || input.dependencyChanged === true) {
    reasons.push(REASON_CODES.DEPENDENCY_FORBIDDEN);
  }
  if (
    packet.storagePrimitiveChanged === true
    || packet.storageImportsAdded === true
    || packet.productionStorageImportAdded === true
    || input.storagePrimitiveChanged === true
    || input.storageImportsAdded === true
    || input.productionStorageImportAdded === true
  ) {
    reasons.push(REASON_CODES.PRODUCTION_STORAGE_IMPORT_FORBIDDEN);
  }
  return uniqueStrings(reasons);
}

function testOnlyStoragePrimitiveExecutionRequirementReasons(packet = {}) {
  const reasons = [];
  if (
    packet.packetKind !== 'EXACT_TEXT_TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_PACKET_001N'
    || packet.testOnly !== true
    || packet.evidenceLayerOnly !== true
    || packet.productAdmission !== false
    || packet.testOnlyStoragePrimitiveExecutionObserved !== true
    || packet.backupManagerExecutedInFixture !== true
    || packet.fileManagerAtomicWriteExecutedInFixture !== true
    || packet.backupBasePathExplicit !== true
    || packet.backupBasePathInsideFixtureRoot !== true
    || packet.atomicWriteTargetInsideFixtureRoot !== true
    || packet.allWrittenPathsInsideFixtureRoot !== true
    || packet.hashObservationsMatch !== true
    || packet.backupContentMatches !== true
    || packet.atomicWriteContentMatches !== true
    || packet.fixtureRootCleanupObserved !== true
    || packet.fixtureRootCleanupSucceeded !== true
    || !hasValue(packet.fixtureRootHash)
    || !hasValue(packet.backupObservationHash)
    || !hasValue(packet.atomicWriteObservationHash)
    || !hasValue(packet.cleanupObservationHash)
    || !hasValue(packet.backupManagerSourceHash)
    || !hasValue(packet.fileManagerSourceHash)
  ) {
    reasons.push(REASON_CODES.TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_EVIDENCE_MISSING);
  }
  if (
    packet.testOnlyElectronStubProvided !== true
    || packet.electronStubDocumentsPathKind !== 'OS_TEMP_FIXTURE'
  ) {
    reasons.push(REASON_CODES.ELECTRON_STUB_REQUIRED);
  }
  if (
    packet.electronStubRealDocumentsPath === true
    || packet.documentsPathOutsideFixture === true
  ) {
    reasons.push(REASON_CODES.REAL_DOCUMENTS_PATH_FORBIDDEN);
  }
  if (packet.backupBasePathExplicit !== true || packet.backupBasePathOmitted === true) {
    reasons.push(REASON_CODES.BACKUP_BASE_PATH_REQUIRED);
  }
  if (
    packet.productRootAccess === true
    || packet.productPathAccess === true
  ) {
    reasons.push(REASON_CODES.PRODUCT_ROOT_FORBIDDEN);
  }
  if (packet.repoRootAccess === true) {
    reasons.push(REASON_CODES.PRODUCT_PATH_FORBIDDEN);
  }
  if (packet.absolutePathEscape === true) {
    reasons.push(REASON_CODES.ABSOLUTE_PATH_ESCAPE_FORBIDDEN);
  }
  if (packet.pathTraversal === true) {
    reasons.push(REASON_CODES.PATH_TRAVERSAL_FORBIDDEN);
  }
  if (
    packet.backupContentMatches === false
    || packet.atomicWriteContentMatches === false
    || packet.hashObservationsMatch === false
  ) {
    reasons.push(REASON_CODES.HASH_OBSERVATION_MISMATCH);
  }
  if (packet.fixtureRootCleanupObserved !== true || packet.fixtureRootCleanupSucceeded !== true) {
    reasons.push(REASON_CODES.FIXTURE_CLEANUP_REQUIRED);
  }
  return uniqueStrings(reasons);
}

function createTestOnlyStoragePrimitiveExecutionDecision(primitiveEvidenceGateResult, packet) {
  const sourceDecision = primitiveEvidenceGateResult.productStoragePrimitiveEvidenceDecisions[0];
  const decisionCore = {
    testOnlyStoragePrimitiveExecutionDecisionKind: 'EXACT_TEXT_TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_HARNESS_DECISION',
    outputDecision: 'TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_EVIDENCE_ADMITTED',
    nextDecisionAfterPass: 'OWNER_MAY_PLAN_SEPARATE_PRODUCT_SHAPED_DRY_RUN_CONTOUR',
    acceptedBinding: 'EXACT_TEXT_APPLY_PRODUCT_STORAGE_PRIMITIVE_EVIDENCE_GATE_001M',
    testOnly: true,
    evidenceLayerOnly: true,
    productAdmission: false,
    productStorageDryRunAdmitted: false,
    productDryRunAdmittedByItself: false,
    productStorageDryRunAdmittedByThisContour: false,
    productWritePerformed: false,
    productWriteClaimed: false,
    productStorageSafetyClaimed: false,
    durableReceiptClaimed: false,
    applyReceiptImplemented: false,
    productApplyReceiptClaimed: false,
    recoveryClaimed: false,
    crashRecoveryClaimed: false,
    applyTxnClaimed: false,
    publicSurfaceClaimed: false,
    docxImportClaimed: false,
    uiChanged: false,
    networkUsed: false,
    dependencyChanged: false,
    storageImportsAdded: false,
    storagePrimitiveChanged: false,
    sourcePrimitiveEvidenceGateResultHash: primitiveEvidenceGateResult.canonicalHash,
    sourcePrimitiveEvidenceGateDecisionHash: sourceDecision.canonicalHash,
    fixtureRootHash: packet.fixtureRootHash,
    backupObservationHash: packet.backupObservationHash,
    atomicWriteObservationHash: packet.atomicWriteObservationHash,
    cleanupObservationHash: packet.cleanupObservationHash || '',
    backupManagerSourceHash: packet.backupManagerSourceHash,
    fileManagerSourceHash: packet.fileManagerSourceHash,
  };
  const decisionWithId = {
    testOnlyStoragePrimitiveExecutionDecisionId: `test_only_storage_primitive_execution_${canonicalHash(decisionCore).slice(0, 16)}`,
    ...decisionCore,
  };
  return {
    ...decisionWithId,
    canonicalHash: canonicalHash(decisionWithId),
  };
}

export function compileExactTextTestOnlyStoragePrimitiveExecutionHarness(input = {}) {
  const primitiveEvidenceGateResult = input?.productStoragePrimitiveEvidenceGateResult || {};
  const executionPacket = input?.executionPacket || {};
  const blockedReasons = [
    ...(primitiveEvidenceGateResult.blockedReasons || []),
    ...acceptedProductStoragePrimitiveEvidenceGateReasons(primitiveEvidenceGateResult),
    ...testOnlyStoragePrimitiveExecutionRequirementReasons(executionPacket),
    ...testOnlyStoragePrimitiveExecutionClaimReasons(executionPacket, input),
  ];

  const uniqueBlockedReasons = uniqueStrings(blockedReasons);
  const testOnlyStoragePrimitiveExecutionDecisions = uniqueBlockedReasons.length === 0
    ? [createTestOnlyStoragePrimitiveExecutionDecision(primitiveEvidenceGateResult, executionPacket)]
    : [];
  const resultCore = {
    resultKind: 'EXACT_TEXT_TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_HARNESS_RESULT',
    contractOnly: true,
    testOnly: true,
    evidenceLayerOnly: true,
    productAdmission: false,
    testOnlyStoragePrimitiveExecutionAdmitted: testOnlyStoragePrimitiveExecutionDecisions.length === 1,
    outputDecision: testOnlyStoragePrimitiveExecutionDecisions.length === 1
      ? 'TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_EVIDENCE_ADMITTED'
      : 'PRODUCT_WRITE_PATH_REMAINS_BLOCKED',
    nextDecisionAfterPass: testOnlyStoragePrimitiveExecutionDecisions.length === 1
      ? 'OWNER_MAY_PLAN_SEPARATE_PRODUCT_SHAPED_DRY_RUN_CONTOUR'
      : 'STOP_AND_FIX_TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_GAP',
    productStorageDryRunAdmitted: false,
    productDryRunAdmittedByItself: false,
    productStorageDryRunAdmittedByThisContour: false,
    productWritePerformed: false,
    productWriteClaimed: false,
    productStorageSafetyClaimed: false,
    durableReceiptClaimed: false,
    applyReceiptImplemented: false,
    productApplyReceiptClaimed: false,
    recoveryClaimed: false,
    crashRecoveryClaimed: false,
    applyTxnClaimed: false,
    publicSurfaceClaimed: false,
    docxImportClaimed: false,
    uiChanged: false,
    networkUsed: false,
    dependencyChanged: false,
    storageImportsAdded: false,
    storagePrimitiveChanged: false,
    recoveryTestsRegressionOnly: true,
    hostilePackageTestsRegressionOnly: true,
    admissionGuardScopeOnly: true,
    testOnlyStoragePrimitiveExecutionDecisions,
    blockedReasons: uniqueBlockedReasons,
  };
  return {
    ...resultCore,
    canonicalHash: canonicalHash(resultCore),
  };
}

function acceptedTestOnlyStoragePrimitiveExecutionReasons(result = {}) {
  const reasons = [];
  const decisions = Array.isArray(result.testOnlyStoragePrimitiveExecutionDecisions)
    ? result.testOnlyStoragePrimitiveExecutionDecisions
    : [];
  const decision = decisions[0] || {};
  if (
    result.resultKind !== 'EXACT_TEXT_TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_HARNESS_RESULT'
    || result.contractOnly !== true
    || result.testOnly !== true
    || result.evidenceLayerOnly !== true
    || result.productAdmission !== false
    || result.testOnlyStoragePrimitiveExecutionAdmitted !== true
    || result.outputDecision !== 'TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_EVIDENCE_ADMITTED'
    || result.nextDecisionAfterPass !== 'OWNER_MAY_PLAN_SEPARATE_PRODUCT_SHAPED_DRY_RUN_CONTOUR'
    || result.productStorageDryRunAdmitted !== false
    || result.productDryRunAdmittedByItself !== false
    || result.productStorageDryRunAdmittedByThisContour !== false
    || result.productWritePerformed !== false
    || result.productWriteClaimed !== false
    || result.productStorageSafetyClaimed !== false
    || result.durableReceiptClaimed !== false
    || result.applyReceiptImplemented !== false
    || result.productApplyReceiptClaimed !== false
    || result.recoveryClaimed !== false
    || result.crashRecoveryClaimed !== false
    || result.applyTxnClaimed !== false
    || result.publicSurfaceClaimed !== false
    || result.docxImportClaimed !== false
    || result.uiChanged !== false
    || result.networkUsed !== false
    || result.dependencyChanged !== false
    || result.storageImportsAdded !== false
    || result.storagePrimitiveChanged !== false
    || result.recoveryTestsRegressionOnly !== true
    || result.hostilePackageTestsRegressionOnly !== true
    || result.admissionGuardScopeOnly !== true
    || !hasValue(result.canonicalHash)
    || (result.blockedReasons || []).length !== 0
    || decisions.length !== 1
    || decision.testOnlyStoragePrimitiveExecutionDecisionKind !== 'EXACT_TEXT_TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_HARNESS_DECISION'
    || decision.outputDecision !== 'TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_EVIDENCE_ADMITTED'
    || decision.nextDecisionAfterPass !== 'OWNER_MAY_PLAN_SEPARATE_PRODUCT_SHAPED_DRY_RUN_CONTOUR'
    || decision.acceptedBinding !== 'EXACT_TEXT_APPLY_PRODUCT_STORAGE_PRIMITIVE_EVIDENCE_GATE_001M'
    || decision.testOnly !== true
    || decision.evidenceLayerOnly !== true
    || decision.productAdmission !== false
    || decision.productStorageDryRunAdmitted !== false
    || decision.productDryRunAdmittedByItself !== false
    || decision.productStorageDryRunAdmittedByThisContour !== false
    || decision.productWritePerformed !== false
    || decision.productWriteClaimed !== false
    || decision.productStorageSafetyClaimed !== false
    || decision.durableReceiptClaimed !== false
    || decision.applyReceiptImplemented !== false
    || decision.productApplyReceiptClaimed !== false
    || decision.recoveryClaimed !== false
    || decision.crashRecoveryClaimed !== false
    || decision.applyTxnClaimed !== false
    || decision.publicSurfaceClaimed !== false
    || decision.docxImportClaimed !== false
    || decision.uiChanged !== false
    || decision.networkUsed !== false
    || decision.dependencyChanged !== false
    || decision.storageImportsAdded !== false
    || decision.storagePrimitiveChanged !== false
    || !hasValue(decision.sourcePrimitiveEvidenceGateResultHash)
    || !hasValue(decision.sourcePrimitiveEvidenceGateDecisionHash)
    || !hasValue(decision.fixtureRootHash)
    || !hasValue(decision.backupObservationHash)
    || !hasValue(decision.atomicWriteObservationHash)
    || !hasValue(decision.cleanupObservationHash)
    || !hasValue(decision.backupManagerSourceHash)
    || !hasValue(decision.fileManagerSourceHash)
    || !hasValue(decision.canonicalHash)
  ) {
    reasons.push(REASON_CODES.TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_EVIDENCE_MISSING);
  }
  return uniqueStrings(reasons);
}

function testOnlyProductShapedDryRunClaimReasons(packet = {}, input = {}) {
  const reasons = [];
  if (
    packet.productApplyAdmissionClaimed === true
    || packet.productApplyAdmitted === true
    || packet.productAdmission === true
    || input.productApplyAdmissionClaimed === true
    || input.productApplyAdmitted === true
    || input.productAdmission === true
  ) {
    reasons.push(REASON_CODES.PRODUCT_APPLY_ADMISSION_FORBIDDEN);
  }
  if (
    packet.productWritePerformed === true
    || packet.productWriteClaimed === true
    || packet.manuscriptMutationPerformed === true
    || input.productWritePerformed === true
    || input.productWriteClaimed === true
    || input.manuscriptMutationPerformed === true
    || input.runtimeWritable === true
  ) {
    reasons.push(REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR);
  }
  if (
    packet.productStorageSafetyClaimed === true
    || packet.productStorageIntegrated === true
    || input.productStorageSafetyClaimed === true
    || input.productStorageIntegrated === true
  ) {
    reasons.push(REASON_CODES.STORAGE_INTEGRATION_FORBIDDEN_IN_CONTOUR);
  }
  if (
    packet.durableReceiptClaimed === true
    || packet.applyReceiptImplemented === true
    || packet.productApplyReceiptClaimed === true
    || input.durableReceiptClaimed === true
    || input.applyReceiptImplemented === true
    || input.productApplyReceiptClaimed === true
  ) {
    reasons.push(REASON_CODES.RECEIPT_CONTRACT_MISMATCH);
  }
  if (
    packet.recoveryClaimed === true
    || packet.crashRecoveryClaimed === true
    || input.recoveryClaimed === true
    || input.crashRecoveryClaimed === true
  ) {
    reasons.push(REASON_CODES.RECOVERY_CLAIM_FORBIDDEN_IN_CONTOUR);
  }
  if (packet.applyTxnClaimed === true || input.applyTxnClaimed === true) {
    reasons.push(REASON_CODES.STRUCTURAL_AUTO_APPLY_FORBIDDEN);
  }
  if (
    packet.publicSurfaceClaimed === true
    || packet.ipcSurfaceClaimed === true
    || packet.commandSurfaceClaimed === true
    || packet.preloadSurfaceClaimed === true
    || input.publicSurfaceClaimed === true
  ) {
    reasons.push(REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR);
  }
  if (packet.docxImportClaimed === true || input.docxImportClaimed === true) {
    reasons.push(REASON_CODES.SEMANTIC_PARSE_FORBIDDEN);
  }
  if (packet.uiChanged === true || input.uiChanged === true) {
    reasons.push(REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR);
  }
  if (packet.networkUsed === true || input.networkUsed === true) {
    reasons.push(REASON_CODES.NETWORK_FORBIDDEN);
  }
  if (packet.dependencyChanged === true || input.dependencyChanged === true) {
    reasons.push(REASON_CODES.DEPENDENCY_FORBIDDEN);
  }
  if (
    packet.storagePrimitiveChanged === true
    || packet.storageImportsAdded === true
    || packet.productionStorageImportAdded === true
    || input.storagePrimitiveChanged === true
    || input.storageImportsAdded === true
    || input.productionStorageImportAdded === true
  ) {
    reasons.push(REASON_CODES.PRODUCTION_STORAGE_IMPORT_FORBIDDEN);
  }
  if (packet.commentApplyClaimed === true || input.commentApplyClaimed === true) {
    reasons.push(REASON_CODES.COMMENT_APPLY_OUT_OF_SCOPE);
  }
  if (packet.structuralApplyClaimed === true || input.structuralApplyClaimed === true) {
    reasons.push(REASON_CODES.STRUCTURAL_STORAGE_WRITE_BLOCKED);
  }
  if (packet.multiSceneApplyClaimed === true || input.multiSceneApplyClaimed === true) {
    reasons.push(REASON_CODES.MULTI_SCOPE_STORAGE_WRITE_BLOCKED);
  }
  return uniqueStrings(reasons);
}

function testOnlyProductShapedDryRunRequirementReasons(packet = {}) {
  const reasons = [];
  if (
    packet.packetKind !== 'EXACT_TEXT_TEST_ONLY_PRODUCT_SHAPED_STORAGE_DRY_RUN_PACKET_001O'
    || packet.testOnly !== true
    || packet.productShapedFixtureOnly !== true
    || packet.productShapedStorageDryRunObserved !== true
    || packet.osTempFixtureRootOnly !== true
    || packet.fixtureProjectRootInsideTempRoot !== true
    || packet.fixtureProjectRootIsProductRoot !== false
    || packet.fixtureSceneFileOnly !== true
    || packet.fixtureManifestStubProvided !== true
    || packet.fixtureManifestStubInert !== true
    || packet.projectIdTestPassed !== true
    || packet.sceneIdTestPassed !== true
    || packet.baselineHashTestPassed !== true
    || packet.blockVersionHashTestPassed !== true
    || packet.exactTextGuardPassed !== true
    || packet.sessionOpenTestPassed !== true
    || packet.fixtureBackupObserved !== true
    || packet.fixtureAtomicWriteObserved !== true
    || packet.testOnlyDryRunReceiptObservationEmitted !== true
    || packet.dryRunReceiptPathInsideFixtureRoot !== true
    || packet.allDryRunPathsInsideFixtureRoot !== true
    || packet.afterWriteHashMatches !== true
    || packet.cleanupObserved !== true
    || packet.cleanupSucceeded !== true
    || !hasValue(packet.fixtureProjectRootHash)
    || !hasValue(packet.fixtureSceneFileHash)
    || !hasValue(packet.fixtureManifestStubHash)
    || !hasValue(packet.fixtureBackupObservationHash)
    || !hasValue(packet.fixtureAtomicWriteObservationHash)
    || !hasValue(packet.testOnlyDryRunReceiptObservationHash)
    || !hasValue(packet.cleanupObservationHash)
  ) {
    reasons.push(REASON_CODES.TEST_ONLY_PRODUCT_SHAPED_DRY_RUN_EVIDENCE_MISSING);
  }
  if (packet.fixtureManifestStubPersisted === true || packet.fixtureManifestStubReusedAsProjectTruth === true) {
    reasons.push(REASON_CODES.FIXTURE_MANIFEST_TRUTH_ESCALATION_FORBIDDEN);
  }
  if (packet.projectIdTestPassed === false) {
    reasons.push(REASON_CODES.WRONG_PROJECT);
  }
  if (packet.sceneIdTestPassed === false) {
    reasons.push(REASON_CODES.SCENE_MISMATCH);
  }
  if (packet.baselineHashTestPassed === false) {
    reasons.push(REASON_CODES.STALE_BASELINE);
  }
  if (packet.blockVersionHashTestPassed === false) {
    reasons.push(REASON_CODES.BLOCK_VERSION_MISMATCH);
  }
  if (packet.exactTextGuardPassed === false) {
    reasons.push(REASON_CODES.EXACT_TEXT_MISMATCH);
  }
  if (packet.sessionOpenTestPassed === false) {
    reasons.push(REASON_CODES.CLOSED_SESSION);
  }
  if (
    packet.productRootAccess === true
    || packet.productPathAccess === true
    || packet.fixtureProjectRootIsProductRoot === true
  ) {
    reasons.push(REASON_CODES.PRODUCT_ROOT_FORBIDDEN);
  }
  if (packet.repoRootAccess === true) {
    reasons.push(REASON_CODES.PRODUCT_PATH_FORBIDDEN);
  }
  if (packet.absolutePathEscape === true) {
    reasons.push(REASON_CODES.ABSOLUTE_PATH_ESCAPE_FORBIDDEN);
  }
  if (packet.pathTraversal === true) {
    reasons.push(REASON_CODES.PATH_TRAVERSAL_FORBIDDEN);
  }
  if (packet.dryRunReceiptPathOutsideFixture === true || packet.dryRunReceiptPathInsideFixtureRoot !== true) {
    reasons.push(REASON_CODES.DRY_RUN_RECEIPT_PATH_OUTSIDE_FIXTURE);
  }
  if (packet.afterWriteHashMatches === false) {
    reasons.push(REASON_CODES.HASH_OBSERVATION_MISMATCH);
  }
  if (packet.cleanupObserved !== true || packet.cleanupSucceeded !== true) {
    reasons.push(REASON_CODES.FIXTURE_CLEANUP_REQUIRED);
  }
  return uniqueStrings(reasons);
}

function createTestOnlyProductShapedDryRunDecision(testOnlyStoragePrimitiveExecutionHarnessResult, packet) {
  const sourceDecision = testOnlyStoragePrimitiveExecutionHarnessResult.testOnlyStoragePrimitiveExecutionDecisions[0];
  const decisionCore = {
    testOnlyProductShapedDryRunDecisionKind: 'EXACT_TEXT_TEST_ONLY_PRODUCT_SHAPED_STORAGE_DRY_RUN_DECISION',
    outputDecision: 'TEST_ONLY_PRODUCT_SHAPED_DRY_RUN_EVIDENCE_ADMITTED',
    nextDecisionAfterPass: 'OWNER_MAY_PLAN_PRODUCT_APPLY_READINESS_REVIEW_001P',
    acceptedBinding: 'EXACT_TEXT_APPLY_TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_HARNESS_001N',
    testOnly: true,
    productShapedFixtureOnly: true,
    productAdmission: false,
    productApplyAdmissionClaimed: false,
    productApplyAdmitted: false,
    productStorageDryRunAdmitted: false,
    productStorageDryRunAdmittedByThisContour: false,
    productStorageSafetyClaimed: false,
    productWritePerformed: false,
    productWriteClaimed: false,
    manuscriptMutationPerformed: false,
    durableReceiptClaimed: false,
    applyReceiptImplemented: false,
    productApplyReceiptClaimed: false,
    recoveryClaimed: false,
    crashRecoveryClaimed: false,
    applyTxnClaimed: false,
    publicSurfaceClaimed: false,
    docxImportClaimed: false,
    uiChanged: false,
    networkUsed: false,
    dependencyChanged: false,
    storageImportsAdded: false,
    storagePrimitiveChanged: false,
    commentApplyClaimed: false,
    structuralApplyClaimed: false,
    multiSceneApplyClaimed: false,
    fixtureManifestStubInert: true,
    fixtureManifestStubPersisted: false,
    fixtureManifestStubReusedAsProjectTruth: false,
    sourceTestOnlyStoragePrimitiveExecutionResultHash: testOnlyStoragePrimitiveExecutionHarnessResult.canonicalHash,
    sourceTestOnlyStoragePrimitiveExecutionDecisionHash: sourceDecision.canonicalHash,
    fixtureProjectRootHash: packet.fixtureProjectRootHash,
    fixtureSceneFileHash: packet.fixtureSceneFileHash,
    fixtureManifestStubHash: packet.fixtureManifestStubHash,
    fixtureBackupObservationHash: packet.fixtureBackupObservationHash,
    fixtureAtomicWriteObservationHash: packet.fixtureAtomicWriteObservationHash,
    testOnlyDryRunReceiptObservationHash: packet.testOnlyDryRunReceiptObservationHash,
    cleanupObservationHash: packet.cleanupObservationHash,
  };
  const decisionWithId = {
    testOnlyProductShapedDryRunDecisionId: `test_only_product_shaped_dry_run_${canonicalHash(decisionCore).slice(0, 16)}`,
    ...decisionCore,
  };
  return {
    ...decisionWithId,
    canonicalHash: canonicalHash(decisionWithId),
  };
}

export function compileExactTextTestOnlyProductShapedStorageDryRun(input = {}) {
  const testOnlyStoragePrimitiveExecutionHarnessResult = input?.testOnlyStoragePrimitiveExecutionHarnessResult || {};
  const dryRunPacket = input?.dryRunPacket || {};
  const blockedReasons = [
    ...(testOnlyStoragePrimitiveExecutionHarnessResult.blockedReasons || []),
    ...acceptedTestOnlyStoragePrimitiveExecutionReasons(testOnlyStoragePrimitiveExecutionHarnessResult),
    ...testOnlyProductShapedDryRunRequirementReasons(dryRunPacket),
    ...testOnlyProductShapedDryRunClaimReasons(dryRunPacket, input),
  ];

  const uniqueBlockedReasons = uniqueStrings(blockedReasons);
  const testOnlyProductShapedDryRunDecisions = uniqueBlockedReasons.length === 0
    ? [createTestOnlyProductShapedDryRunDecision(testOnlyStoragePrimitiveExecutionHarnessResult, dryRunPacket)]
    : [];
  const resultCore = {
    resultKind: 'EXACT_TEXT_TEST_ONLY_PRODUCT_SHAPED_STORAGE_DRY_RUN_RESULT',
    contractOnly: true,
    testOnly: true,
    productShapedFixtureOnly: true,
    productAdmission: false,
    testOnlyProductShapedDryRunEvidenceAdmitted: testOnlyProductShapedDryRunDecisions.length === 1,
    outputDecision: testOnlyProductShapedDryRunDecisions.length === 1
      ? 'TEST_ONLY_PRODUCT_SHAPED_DRY_RUN_EVIDENCE_ADMITTED'
      : 'PRODUCT_APPLY_PATH_REMAINS_BLOCKED',
    nextDecisionAfterPass: testOnlyProductShapedDryRunDecisions.length === 1
      ? 'OWNER_MAY_PLAN_PRODUCT_APPLY_READINESS_REVIEW_001P'
      : 'STOP_AND_FIX_TEST_ONLY_PRODUCT_SHAPED_DRY_RUN_GAP',
    productApplyAdmissionClaimed: false,
    productApplyAdmitted: false,
    productStorageDryRunAdmitted: false,
    productStorageDryRunAdmittedByThisContour: false,
    productStorageSafetyClaimed: false,
    productWritePerformed: false,
    productWriteClaimed: false,
    manuscriptMutationPerformed: false,
    durableReceiptClaimed: false,
    applyReceiptImplemented: false,
    productApplyReceiptClaimed: false,
    recoveryClaimed: false,
    crashRecoveryClaimed: false,
    applyTxnClaimed: false,
    publicSurfaceClaimed: false,
    docxImportClaimed: false,
    uiChanged: false,
    networkUsed: false,
    dependencyChanged: false,
    storageImportsAdded: false,
    storagePrimitiveChanged: false,
    commentApplyClaimed: false,
    structuralApplyClaimed: false,
    multiSceneApplyClaimed: false,
    fixtureManifestStubInert: testOnlyProductShapedDryRunDecisions.length === 1,
    fixtureManifestStubPersisted: false,
    fixtureManifestStubReusedAsProjectTruth: false,
    testOnlyProductShapedDryRunDecisions,
    blockedReasons: uniqueBlockedReasons,
  };
  return {
    ...resultCore,
    canonicalHash: canonicalHash(resultCore),
  };
}

function acceptedTestOnlyProductShapedDryRunReasons(result = {}, testOnlyStoragePrimitiveExecutionHarnessResult = {}) {
  const reasons = [];
  const decisions = Array.isArray(result.testOnlyProductShapedDryRunDecisions)
    ? result.testOnlyProductShapedDryRunDecisions
    : [];
  const decision = decisions[0] || {};
  const sourceDecisions = Array.isArray(testOnlyStoragePrimitiveExecutionHarnessResult.testOnlyStoragePrimitiveExecutionDecisions)
    ? testOnlyStoragePrimitiveExecutionHarnessResult.testOnlyStoragePrimitiveExecutionDecisions
    : [];
  const sourceDecision = sourceDecisions[0] || {};
  if (
    result.resultKind !== 'EXACT_TEXT_TEST_ONLY_PRODUCT_SHAPED_STORAGE_DRY_RUN_RESULT'
    || result.contractOnly !== true
    || result.testOnly !== true
    || result.productShapedFixtureOnly !== true
    || result.productAdmission !== false
    || result.testOnlyProductShapedDryRunEvidenceAdmitted !== true
    || result.outputDecision !== 'TEST_ONLY_PRODUCT_SHAPED_DRY_RUN_EVIDENCE_ADMITTED'
    || result.nextDecisionAfterPass !== 'OWNER_MAY_PLAN_PRODUCT_APPLY_READINESS_REVIEW_001P'
    || result.productApplyAdmissionClaimed !== false
    || result.productApplyAdmitted !== false
    || result.productStorageDryRunAdmitted !== false
    || result.productStorageDryRunAdmittedByThisContour !== false
    || result.productStorageSafetyClaimed !== false
    || result.productWritePerformed !== false
    || result.productWriteClaimed !== false
    || result.manuscriptMutationPerformed !== false
    || result.durableReceiptClaimed !== false
    || result.applyReceiptImplemented !== false
    || result.productApplyReceiptClaimed !== false
    || result.recoveryClaimed !== false
    || result.crashRecoveryClaimed !== false
    || result.applyTxnClaimed !== false
    || result.publicSurfaceClaimed !== false
    || result.docxImportClaimed !== false
    || result.uiChanged !== false
    || result.networkUsed !== false
    || result.dependencyChanged !== false
    || result.storageImportsAdded !== false
    || result.storagePrimitiveChanged !== false
    || result.commentApplyClaimed !== false
    || result.structuralApplyClaimed !== false
    || result.multiSceneApplyClaimed !== false
    || result.fixtureManifestStubInert !== true
    || result.fixtureManifestStubPersisted !== false
    || result.fixtureManifestStubReusedAsProjectTruth !== false
    || !hasValue(result.canonicalHash)
    || (result.blockedReasons || []).length !== 0
    || decisions.length !== 1
    || decision.testOnlyProductShapedDryRunDecisionKind !== 'EXACT_TEXT_TEST_ONLY_PRODUCT_SHAPED_STORAGE_DRY_RUN_DECISION'
    || decision.outputDecision !== 'TEST_ONLY_PRODUCT_SHAPED_DRY_RUN_EVIDENCE_ADMITTED'
    || decision.nextDecisionAfterPass !== 'OWNER_MAY_PLAN_PRODUCT_APPLY_READINESS_REVIEW_001P'
    || decision.acceptedBinding !== 'EXACT_TEXT_APPLY_TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_HARNESS_001N'
    || decision.testOnly !== true
    || decision.productShapedFixtureOnly !== true
    || decision.productAdmission !== false
    || decision.productApplyAdmissionClaimed !== false
    || decision.productApplyAdmitted !== false
    || decision.productStorageDryRunAdmitted !== false
    || decision.productStorageDryRunAdmittedByThisContour !== false
    || decision.productStorageSafetyClaimed !== false
    || decision.productWritePerformed !== false
    || decision.productWriteClaimed !== false
    || decision.manuscriptMutationPerformed !== false
    || decision.durableReceiptClaimed !== false
    || decision.applyReceiptImplemented !== false
    || decision.productApplyReceiptClaimed !== false
    || decision.recoveryClaimed !== false
    || decision.crashRecoveryClaimed !== false
    || decision.applyTxnClaimed !== false
    || decision.publicSurfaceClaimed !== false
    || decision.docxImportClaimed !== false
    || decision.uiChanged !== false
    || decision.networkUsed !== false
    || decision.dependencyChanged !== false
    || decision.storageImportsAdded !== false
    || decision.storagePrimitiveChanged !== false
    || decision.commentApplyClaimed !== false
    || decision.structuralApplyClaimed !== false
    || decision.multiSceneApplyClaimed !== false
    || decision.fixtureManifestStubInert !== true
    || decision.fixtureManifestStubPersisted !== false
    || decision.fixtureManifestStubReusedAsProjectTruth !== false
    || acceptedTestOnlyStoragePrimitiveExecutionReasons(testOnlyStoragePrimitiveExecutionHarnessResult).length !== 0
    || decision.sourceTestOnlyStoragePrimitiveExecutionResultHash !== testOnlyStoragePrimitiveExecutionHarnessResult.canonicalHash
    || decision.sourceTestOnlyStoragePrimitiveExecutionDecisionHash !== sourceDecision.canonicalHash
    || !hasValue(decision.sourceTestOnlyStoragePrimitiveExecutionResultHash)
    || !hasValue(decision.sourceTestOnlyStoragePrimitiveExecutionDecisionHash)
    || !hasValue(decision.fixtureProjectRootHash)
    || !hasValue(decision.fixtureSceneFileHash)
    || !hasValue(decision.fixtureManifestStubHash)
    || !hasValue(decision.fixtureBackupObservationHash)
    || !hasValue(decision.fixtureAtomicWriteObservationHash)
    || !hasValue(decision.testOnlyDryRunReceiptObservationHash)
    || !hasValue(decision.cleanupObservationHash)
    || !hasValue(decision.canonicalHash)
  ) {
    reasons.push(REASON_CODES.PRODUCT_APPLY_READINESS_REVIEW_MISSING);
  }
  return uniqueStrings(reasons);
}

const REQUIRED_PRECONDITION_REQUIREMENTS = Object.freeze([
  'PROJECT_ID_TEST',
  'SCENE_ID_TEST',
  'BASELINE_HASH_TEST',
  'BLOCK_VERSION_HASH_TEST',
  'EXACT_TEXT_GUARD',
  'SESSION_OPEN_TEST',
  'LOW_RISK_EXACT_TEXT_ONLY',
  'COMMENT_APPLY_BLOCKED',
  'STRUCTURAL_APPLY_BLOCKED',
  'MULTI_SCENE_APPLY_BLOCKED',
]);

const REQUIRED_STATIC_STORAGE_REQUIREMENTS = Object.freeze([
  'BACKUP_BEFORE_WRITE_REQUIRED',
  'ATOMIC_WRITE_REQUIRED',
  'PRODUCT_SAVE_PATH_OWNER_APPROVAL_REQUIRED',
  'NO_STORAGE_PRIMITIVE_EDIT_REQUIRED',
  'NO_PUBLIC_SURFACE_REQUIRED',
  'NO_RUNTIME_PATH_INPUTS_IN_001P',
]);

const REQUIRED_RECEIPT_REQUIREMENTS = Object.freeze([
  'RECEIPT_KIND',
  'PROJECT_ID',
  'SCENE_ID',
  'APPLY_OP_ID',
  'SOURCE_APPLY_OP_HASH',
  'BEFORE_SCENE_HASH',
  'AFTER_SCENE_HASH',
  'BACKUP_OBSERVATION_HASH',
  'ATOMIC_WRITE_OBSERVATION_HASH',
  'PRECONDITION_RESULTS',
  'BLOCKED_REASONS',
  'RUNTIME_SURFACE_FALSE_FLAGS',
]);

function missingRequiredItems(values, required) {
  const set = new Set(Array.isArray(values) ? values.filter((value) => typeof value === 'string') : []);
  return required.filter((value) => !set.has(value));
}

function productApplyReadinessClaimReasons(input = {}) {
  const reasons = [];
  if (
    input.productApplyAdmissionAllowed === true
    || input.productWriteExecutionAllowed === true
    || input.productApplyAdmitted === true
    || input.productApplyAdmissionClaimed === true
  ) {
    reasons.push(REASON_CODES.PRODUCT_APPLY_ADMISSION_FORBIDDEN);
  }
  if (
    input.productWritePerformed === true
    || input.productWriteClaimed === true
    || input.manuscriptMutationPerformed === true
    || input.runtimeWritable === true
  ) {
    reasons.push(REASON_CODES.PRODUCT_WRITE_FORBIDDEN_IN_CONTOUR);
  }
  if (
    input.receiptRequirementsAreDraftOnly !== true
    || input.receiptRequirementsMarkedImplemented === true
    || input.applyReceiptImplemented === true
    || input.durableReceiptClaimed === true
    || input.productApplyReceiptClaimed === true
  ) {
    reasons.push(REASON_CODES.RECEIPT_REQUIREMENTS_ESCALATED_TO_IMPLEMENTATION);
  }
  if (
    input.productStorageSurfaceRequirementsAreStaticOnly !== true
    || input.staticRequirementsEscalatedToRuntimeStorageScan === true
    || input.runtimeStorageScanRequested === true
  ) {
    reasons.push(REASON_CODES.RUNTIME_STORAGE_SCAN_FORBIDDEN_IN_CONTOUR);
  }
  if (
    input.storagePrimitiveImportOrCall === true
    || input.storagePrimitiveChanged === true
    || input.storageImportsAdded === true
    || input.productionStorageImportAdded === true
    || input.productSavePathCall === true
  ) {
    reasons.push(REASON_CODES.PRODUCTION_STORAGE_IMPORT_FORBIDDEN);
  }
  if (input.recoveryClaimed === true || input.crashRecoveryClaimed === true) {
    reasons.push(REASON_CODES.RECOVERY_CLAIM_FORBIDDEN_IN_CONTOUR);
  }
  if (input.applyTxnClaimed === true || input.applyTxnImplemented === true) {
    reasons.push(REASON_CODES.STRUCTURAL_AUTO_APPLY_FORBIDDEN);
  }
  if (
    input.publicSurfaceClaimed === true
    || input.publicSurfaceChanged === true
    || input.ipcSurfaceClaimed === true
    || input.preloadSurfaceClaimed === true
    || input.commandSurfaceClaimed === true
  ) {
    reasons.push(REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR);
  }
  if (input.docxImportClaimed === true || input.docxParserExpanded === true) {
    reasons.push(REASON_CODES.SEMANTIC_PARSE_FORBIDDEN);
  }
  if (input.uiChanged === true) {
    reasons.push(REASON_CODES.PUBLIC_SURFACE_FORBIDDEN_IN_CONTOUR);
  }
  if (input.networkUsed === true) {
    reasons.push(REASON_CODES.NETWORK_FORBIDDEN);
  }
  if (input.dependencyChanged === true) {
    reasons.push(REASON_CODES.DEPENDENCY_FORBIDDEN);
  }
  if (input.commentApplyClaimed === true) {
    reasons.push(REASON_CODES.COMMENT_APPLY_OUT_OF_SCOPE);
  }
  if (input.structuralApplyClaimed === true) {
    reasons.push(REASON_CODES.STRUCTURAL_STORAGE_WRITE_BLOCKED);
  }
  if (input.multiSceneApplyClaimed === true) {
    reasons.push(REASON_CODES.MULTI_SCOPE_STORAGE_WRITE_BLOCKED);
  }
  if (
    input.preStage00GovernanceRewrite === true
    || input.tokenCatalogRewrite === true
    || input.claimGateRewrite === true
    || input.ownerDecisionPacketMarkedReleaseGate === true
  ) {
    reasons.push(REASON_CODES.GOVERNANCE_REWRITE_FORBIDDEN_IN_CONTOUR);
  }
  return uniqueStrings(reasons);
}

function productApplyReadinessRequirementsReasons(requirements = {}, input = {}) {
  const reasons = [];
  const missingPreconditions = missingRequiredItems(
    requirements.preconditionRequirements,
    REQUIRED_PRECONDITION_REQUIREMENTS,
  );
  const missingStorage = missingRequiredItems(
    requirements.staticProductStorageSurfaceRequirements,
    REQUIRED_STATIC_STORAGE_REQUIREMENTS,
  );
  const missingReceipt = missingRequiredItems(
    requirements.receiptShapeRequirements,
    REQUIRED_RECEIPT_REQUIREMENTS,
  );
  if (
    requirements.requirementsKind !== 'EXACT_TEXT_PRODUCT_APPLY_READINESS_REQUIREMENTS_MATRIX_001P'
    || requirements.staticRequirementsOnly !== true
    || requirements.receiptRequirementsDraftOnly !== true
    || requirements.productApplyAdmissionAllowed !== false
    || requirements.productWriteExecutionAllowed !== false
    || missingPreconditions.length > 0
    || missingStorage.length > 0
    || missingReceipt.length > 0
  ) {
    reasons.push(REASON_CODES.REQUIREMENTS_MATRIX_MISSING);
  }
  if (
    input.missingWrongProjectBlocker === true
    || !Array.isArray(requirements.preconditionRequirements)
    || !requirements.preconditionRequirements.includes('PROJECT_ID_TEST')
  ) {
    reasons.push(REASON_CODES.WRONG_PROJECT);
  }
  if (
    input.missingSceneMismatchBlocker === true
    || !Array.isArray(requirements.preconditionRequirements)
    || !requirements.preconditionRequirements.includes('SCENE_ID_TEST')
  ) {
    reasons.push(REASON_CODES.SCENE_MISMATCH);
  }
  if (
    input.missingStaleBaselineBlocker === true
    || !Array.isArray(requirements.preconditionRequirements)
    || !requirements.preconditionRequirements.includes('BASELINE_HASH_TEST')
  ) {
    reasons.push(REASON_CODES.STALE_BASELINE);
  }
  if (
    input.missingBlockVersionMismatchBlocker === true
    || !Array.isArray(requirements.preconditionRequirements)
    || !requirements.preconditionRequirements.includes('BLOCK_VERSION_HASH_TEST')
  ) {
    reasons.push(REASON_CODES.BLOCK_VERSION_MISMATCH);
  }
  if (
    input.missingExactTextGuard === true
    || !Array.isArray(requirements.preconditionRequirements)
    || !requirements.preconditionRequirements.includes('EXACT_TEXT_GUARD')
  ) {
    reasons.push(REASON_CODES.EXACT_TEXT_MISMATCH);
  }
  if (
    input.missingClosedSessionBlocker === true
    || !Array.isArray(requirements.preconditionRequirements)
    || !requirements.preconditionRequirements.includes('SESSION_OPEN_TEST')
  ) {
    reasons.push(REASON_CODES.CLOSED_SESSION);
  }
  if (
    input.missingCommentStructuralMultiSceneBlockers === true
    || !Array.isArray(requirements.preconditionRequirements)
    || !requirements.preconditionRequirements.includes('COMMENT_APPLY_BLOCKED')
    || !requirements.preconditionRequirements.includes('STRUCTURAL_APPLY_BLOCKED')
    || !requirements.preconditionRequirements.includes('MULTI_SCENE_APPLY_BLOCKED')
  ) {
    reasons.push(REASON_CODES.MISSING_PRECONDITION);
  }
  if (
    input.missingReceiptShapeRequirement === true
    || !Array.isArray(requirements.receiptShapeRequirements)
    || missingReceipt.length > 0
  ) {
    reasons.push(REASON_CODES.RECEIPT_CAPABILITY_MISSING);
  }
  return uniqueStrings(reasons);
}

function productApplyReadinessOwnerDecisionReasons(ownerDecisionPacket = {}) {
  const reasons = [];
  if (
    ownerDecisionPacket.packetKind !== 'EXACT_TEXT_PRODUCT_APPLY_READINESS_OWNER_DECISION_PACKET_001P'
    || ownerDecisionPacket.localContourOnly !== true
    || ownerDecisionPacket.mayPlan001Q !== true
    || ownerDecisionPacket.requiredOwnerApproval !== true
    || ownerDecisionPacket.productWriteStillBlocked !== true
    || ownerDecisionPacket.productApplyAdmissionStillBlockedUntil001Q !== true
    || ownerDecisionPacket.releaseGate !== false
    || ownerDecisionPacket.ownerApproved001QWithoutTarget === true
    || !hasValue(ownerDecisionPacket.requiredTargetBranch)
    || !hasValue(ownerDecisionPacket.requiredBaseSha)
  ) {
    reasons.push(REASON_CODES.OWNER_DECISION_PACKET_INVALID);
  }
  if (ownerDecisionPacket.releaseGate === true) {
    reasons.push(REASON_CODES.GOVERNANCE_REWRITE_FORBIDDEN_IN_CONTOUR);
  }
  return uniqueStrings(reasons);
}

function createProductApplyReadinessReviewDecision(testOnlyProductShapedDryRunResult, requirements, ownerDecisionPacket) {
  const sourceDecision = testOnlyProductShapedDryRunResult.testOnlyProductShapedDryRunDecisions[0];
  const decisionCore = {
    productApplyReadinessReviewDecisionKind: 'EXACT_TEXT_PRODUCT_APPLY_READINESS_REVIEW_DECISION',
    outputDecision: 'OWNER_MAY_PLAN_PRODUCT_APPLY_ADMISSION_001Q',
    acceptedBinding: 'EXACT_TEXT_APPLY_TEST_ONLY_PRODUCT_SHAPED_STORAGE_DRY_RUN_001O',
    nextContourAfterPass: 'EXACT_TEXT_APPLY_PRODUCT_APPLY_ADMISSION_001Q',
    readinessReviewOnly: true,
    productApplyAdmissionAllowed: false,
    productWriteExecutionAllowed: false,
    productApplyAdmissionClaimed: false,
    productApplyAdmitted: false,
    productWritePerformed: false,
    productWriteClaimed: false,
    manuscriptMutationPerformed: false,
    productStorageSafetyClaimed: false,
    receiptRequirementsAreDraftOnly: true,
    receiptRequirementsMarkedImplemented: false,
    applyReceiptImplemented: false,
    durableReceiptClaimed: false,
    productApplyReceiptClaimed: false,
    productStorageSurfaceRequirementsAreStaticOnly: true,
    runtimeStorageScanRequested: false,
    storagePrimitiveImportOrCall: false,
    productSavePathCall: false,
    storagePrimitiveChanged: false,
    storageImportsAdded: false,
    recoveryClaimed: false,
    crashRecoveryClaimed: false,
    applyTxnClaimed: false,
    applyTxnImplemented: false,
    publicSurfaceClaimed: false,
    docxImportClaimed: false,
    uiChanged: false,
    networkUsed: false,
    dependencyChanged: false,
    commentApplyClaimed: false,
    structuralApplyClaimed: false,
    multiSceneApplyClaimed: false,
    ownerDecisionPacketIsLocalContourOnly: true,
    ownerDecisionPacketIsReleaseGate: false,
    sourceTestOnlyProductShapedDryRunResultHash: testOnlyProductShapedDryRunResult.canonicalHash,
    sourceTestOnlyProductShapedDryRunDecisionHash: sourceDecision.canonicalHash,
    requirementsHash: canonicalHash(requirements),
    ownerDecisionPacketHash: canonicalHash(ownerDecisionPacket),
  };
  const decisionWithId = {
    productApplyReadinessReviewDecisionId: `product_apply_readiness_review_${canonicalHash(decisionCore).slice(0, 16)}`,
    ...decisionCore,
  };
  return {
    ...decisionWithId,
    canonicalHash: canonicalHash(decisionWithId),
  };
}

export function compileExactTextProductApplyReadinessReview(input = {}) {
  const testOnlyProductShapedDryRunResult = input?.testOnlyProductShapedDryRunResult || {};
  const testOnlyStoragePrimitiveExecutionHarnessResult = input?.testOnlyStoragePrimitiveExecutionHarnessResult || {};
  const requirements = input?.requirements || {};
  const ownerDecisionPacket = input?.ownerDecisionPacket || {};
  const blockedReasons = [
    ...(testOnlyProductShapedDryRunResult.blockedReasons || []),
    ...acceptedTestOnlyProductShapedDryRunReasons(
      testOnlyProductShapedDryRunResult,
      testOnlyStoragePrimitiveExecutionHarnessResult,
    ),
    ...productApplyReadinessRequirementsReasons(requirements, input),
    ...productApplyReadinessOwnerDecisionReasons(ownerDecisionPacket),
    ...productApplyReadinessClaimReasons(input),
  ];

  const uniqueBlockedReasons = uniqueStrings(blockedReasons);
  const productApplyReadinessReviewDecisions = uniqueBlockedReasons.length === 0
    ? [createProductApplyReadinessReviewDecision(testOnlyProductShapedDryRunResult, requirements, ownerDecisionPacket)]
    : [];
  const resultCore = {
    resultKind: 'EXACT_TEXT_PRODUCT_APPLY_READINESS_REVIEW_RESULT',
    contractOnly: true,
    readinessReviewOnly: true,
    productApplyReadinessReviewCompleted: productApplyReadinessReviewDecisions.length === 1,
    outputDecision: productApplyReadinessReviewDecisions.length === 1
      ? 'OWNER_MAY_PLAN_PRODUCT_APPLY_ADMISSION_001Q'
      : 'PRODUCT_APPLY_PATH_REMAINS_BLOCKED',
    productApplyAdmissionAllowed: false,
    productWriteExecutionAllowed: false,
    productApplyAdmissionClaimed: false,
    productApplyAdmitted: false,
    productWritePerformed: false,
    productWriteClaimed: false,
    manuscriptMutationPerformed: false,
    productStorageSafetyClaimed: false,
    receiptRequirementsAreDraftOnly: true,
    receiptRequirementsMarkedImplemented: false,
    applyReceiptImplemented: false,
    durableReceiptClaimed: false,
    productApplyReceiptClaimed: false,
    productStorageSurfaceRequirementsAreStaticOnly: true,
    runtimeStorageScanRequested: false,
    storagePrimitiveImportOrCall: false,
    productSavePathCall: false,
    storagePrimitiveChanged: false,
    storageImportsAdded: false,
    recoveryClaimed: false,
    crashRecoveryClaimed: false,
    applyTxnClaimed: false,
    applyTxnImplemented: false,
    publicSurfaceClaimed: false,
    docxImportClaimed: false,
    uiChanged: false,
    networkUsed: false,
    dependencyChanged: false,
    commentApplyClaimed: false,
    structuralApplyClaimed: false,
    multiSceneApplyClaimed: false,
    ownerDecisionPacketIsLocalContourOnly: productApplyReadinessReviewDecisions.length === 1,
    ownerDecisionPacketIsReleaseGate: false,
    productApplyReadinessReviewDecisions,
    blockedReasons: uniqueBlockedReasons,
  };
  return {
    ...resultCore,
    canonicalHash: canonicalHash(resultCore),
  };
}
