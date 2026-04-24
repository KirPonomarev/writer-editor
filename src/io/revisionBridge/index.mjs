const PACKET_VALID_CODE = 'REVISION_BRIDGE_PACKET_VALID';
const PACKET_INVALID_CODE = 'E_REVISION_BRIDGE_PACKET_INVALID';
const APPLY_BLOCKED_CODE = 'E_REVISION_BRIDGE_APPLY_BLOCKED';
const REVIEWGRAPH_VALID_CODE = 'REVISION_BRIDGE_REVIEWGRAPH_VALID';
const REVIEWGRAPH_INVALID_CODE = 'E_REVISION_BRIDGE_REVIEWGRAPH_INVALID';
const REVIEW_PACKET_PREVIEW_READY_CODE = 'REVISION_BRIDGE_REVIEW_PACKET_PREVIEW_READY';
const REVIEW_PACKET_PREVIEW_DIAGNOSTICS_CODE = 'E_REVISION_BRIDGE_REVIEW_PACKET_PREVIEW_DIAGNOSTICS';
const PARSED_REVIEW_SURFACE_ADAPTER_READY_CODE = 'REVISION_BRIDGE_PARSED_REVIEW_SURFACE_ADAPTER_READY';
const PARSED_REVIEW_SURFACE_ADAPTER_DIAGNOSTICS_CODE = 'E_REVISION_BRIDGE_PARSED_REVIEW_SURFACE_ADAPTER_DIAGNOSTICS';

export const REVISION_BRIDGE_P0_PACKET_SCHEMA = 'revision-bridge-p0.packet.v1';
export const REVISION_BRIDGE_REVISION_SESSION_SCHEMA = 'revision-bridge.revision-session.v1';
export const REVISION_BRIDGE_COMMENT_THREAD_SCHEMA = 'revision-bridge.comment-thread.v1';
export const REVISION_BRIDGE_COMMENT_PLACEMENT_SCHEMA = 'revision-bridge.comment-placement.v1';
export const REVISION_BRIDGE_TEXT_CHANGE_SCHEMA = 'revision-bridge.text-change.v1';
export const REVISION_BRIDGE_STRUCTURAL_CHANGE_SCHEMA = 'revision-bridge.structural-change.v1';
export const REVISION_BRIDGE_DIAGNOSTIC_ITEM_SCHEMA = 'revision-bridge.diagnostic-item.v1';
export const REVISION_BRIDGE_DECISION_STATE_SCHEMA = 'revision-bridge.decision-state.v1';
export const REVISION_BRIDGE_REVIEW_PACKET_PREVIEW_SCHEMA = 'revision-bridge.review-packet-preview.v1';

const REVIEWGRAPH_ITEM_KINDS = [
  'commentThread',
  'commentPlacement',
  'textChange',
  'structuralChange',
  'diagnosticItem',
];

const COMMENT_THREAD_FORBIDDEN_PLACEMENT_FIELDS = [
  'targetScope',
  'anchor',
  'range',
  'quote',
  'prefix',
  'suffix',
  'confidence',
  'policy',
  'placement',
  'placementHint',
  'match',
  'selector',
];

const COMMENT_PLACEMENT_FORBIDDEN_THREAD_FIELDS = [
  'body',
  'comment',
  'commentText',
  'message',
  'messageBody',
  'messages',
  'text',
  'threadBody',
];

const STRUCTURAL_CHANGE_FORBIDDEN_AUTO_FIELDS = [
  'apply',
  'applyMode',
  'autoApply',
  'autoApplyEnabled',
  'canApply',
  'canAutoApply',
];

const REVIEW_PACKET_PREVIEW_FORBIDDEN_APPLY_FIELDS = [
  'apply',
  'applyPlan',
  'authorized',
  'canApply',
];

const PARSED_REVIEW_SURFACE_COLLECTIONS = [
  'commentThreads',
  'commentPlacements',
  'textChanges',
  'structuralChanges',
  'diagnosticItems',
  'decisionStates',
];

const PARSED_REVIEW_SURFACE_KEYS = [
  ...PARSED_REVIEW_SURFACE_COLLECTIONS,
  'unsupportedItems',
];

const PARSED_REVIEW_SURFACE_ALIAS_KEYS = [
  'comments',
  'changes',
  'suggestions',
  'docxComments',
  'paragraphs',
  'revisions',
];

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cloneJsonSafe(value) {
  if (value === null) return null;
  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') return value;
  if (Array.isArray(value)) return value.map((item) => cloneJsonSafe(item));
  if (isPlainObject(value)) {
    const clone = {};
    for (const key of Object.keys(value).sort()) {
      const clonedValue = cloneJsonSafe(value[key]);
      if (clonedValue !== undefined) clone[key] = clonedValue;
    }
    return clone;
  }
  return undefined;
}

function normalizeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeBoolean(value) {
  return value === true;
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value.map((item) => normalizeString(item)).filter(Boolean)
    : [];
}

function normalizeStringEnum(value, allowedValues, fallback) {
  const normalized = normalizeString(value);
  return allowedValues.includes(normalized) ? normalized : fallback;
}

function hasOwnField(input, field) {
  return isPlainObject(input) && Object.prototype.hasOwnProperty.call(input, field);
}

function collectForbiddenFieldReasons(input, fields, prefix, message) {
  const reasons = [];
  if (!isPlainObject(input)) return reasons;
  for (const field of fields) {
    if (hasOwnField(input, field)) reasons.push(invalidField(`${prefix}.${field}`, message));
  }
  return reasons;
}

function missingField(field) {
  return {
    code: 'REVISION_BRIDGE_FIELD_REQUIRED',
    field,
    message: `${field} is required`,
  };
}

function invalidField(field, message) {
  return {
    code: 'REVISION_BRIDGE_FIELD_INVALID',
    field,
    message,
  };
}

function reviewGraphValidationFailure(reasons, value = null) {
  return {
    ok: false,
    type: 'revisionBridge.reviewGraph.validation',
    code: REVIEWGRAPH_INVALID_CODE,
    reason: reasons[0]?.code || 'REVISION_BRIDGE_REVIEWGRAPH_INVALID',
    reasons,
    value,
  };
}

function reviewGraphValidationSuccess(value) {
  return {
    ok: true,
    type: 'revisionBridge.reviewGraph.validation',
    code: REVIEWGRAPH_VALID_CODE,
    reason: REVIEWGRAPH_VALID_CODE,
    reasons: [],
    value: cloneJsonSafe(value),
  };
}

function normalizeReviewGraphTargetScope(input) {
  const scope = isPlainObject(input) ? input : {};
  return {
    type: normalizeString(scope.type),
    id: normalizeString(scope.id),
  };
}

function normalizeCommentMessage(input) {
  const message = isPlainObject(input) ? input : {};
  return {
    messageId: normalizeString(message.messageId),
    authorId: normalizeString(message.authorId),
    body: normalizeString(message.body),
    createdAt: normalizeString(message.createdAt),
  };
}

export function normalizeCommentThread(input = {}) {
  const thread = isPlainObject(input) ? input : {};
  return {
    schemaVersion: REVISION_BRIDGE_COMMENT_THREAD_SCHEMA,
    threadId: normalizeString(thread.threadId),
    authorId: normalizeString(thread.authorId),
    status: normalizeStringEnum(thread.status, ['open', 'resolved'], 'open'),
    createdAt: normalizeString(thread.createdAt),
    updatedAt: normalizeString(thread.updatedAt),
    tags: normalizeStringArray(thread.tags),
    messages: Array.isArray(thread.messages)
      ? thread.messages.map((message) => normalizeCommentMessage(message))
      : [],
  };
}

export function createCommentThread(input = {}) {
  return cloneJsonSafe(normalizeCommentThread(input));
}

function collectCommentThreadValidationReasons(input, thread) {
  const reasons = [];
  if (!isPlainObject(input)) {
    reasons.push(invalidField('commentThread', 'commentThread must be an object'));
    return reasons;
  }
  reasons.push(...collectForbiddenFieldReasons(
    input,
    COMMENT_THREAD_FORBIDDEN_PLACEMENT_FIELDS,
    'commentThread',
    'CommentThread must not contain placement payload fields',
  ));
  if (!thread.threadId) reasons.push(missingField('commentThread.threadId'));
  if (!Array.isArray(input.messages)) {
    reasons.push(invalidField('commentThread.messages', 'commentThread.messages must be an array'));
  } else {
    input.messages.forEach((message, index) => {
      if (!isPlainObject(message)) {
        reasons.push(invalidField(`commentThread.messages.${index}`, 'commentThread message must be an object'));
        return;
      }
      const normalizedMessage = thread.messages[index];
      if (!normalizedMessage.messageId) reasons.push(missingField(`commentThread.messages.${index}.messageId`));
      if (!normalizedMessage.body) reasons.push(missingField(`commentThread.messages.${index}.body`));
    });
  }
  return reasons;
}

export function validateCommentThread(input = {}) {
  const thread = normalizeCommentThread(input);
  const reasons = collectCommentThreadValidationReasons(input, thread);
  if (reasons.length > 0) return reviewGraphValidationFailure(reasons);
  return reviewGraphValidationSuccess(thread);
}

export function normalizeCommentPlacement(input = {}) {
  const placement = isPlainObject(input) ? input : {};
  const range = isPlainObject(placement.range) ? placement.range : {};
  const anchor = isPlainObject(placement.anchor) ? placement.anchor : {};
  return {
    schemaVersion: REVISION_BRIDGE_COMMENT_PLACEMENT_SCHEMA,
    placementId: normalizeString(placement.placementId),
    threadId: normalizeString(placement.threadId),
    targetScope: normalizeReviewGraphTargetScope(placement.targetScope),
    anchor: {
      kind: normalizeString(anchor.kind),
      value: normalizeString(anchor.value),
    },
    range: {
      from: normalizeNumber(range.from),
      to: normalizeNumber(range.to),
    },
    quote: normalizeString(placement.quote),
    prefix: normalizeString(placement.prefix),
    suffix: normalizeString(placement.suffix),
    confidence: normalizeNumber(placement.confidence),
    policy: normalizeStringEnum(placement.policy, ['exact', 'fuzzy', 'manual'], 'manual'),
    selector: cloneJsonSafe(placement.selector) || null,
    createdAt: normalizeString(placement.createdAt),
  };
}

export function createCommentPlacement(input = {}) {
  return cloneJsonSafe(normalizeCommentPlacement(input));
}

function collectCommentPlacementValidationReasons(input, placement) {
  const reasons = [];
  if (!isPlainObject(input)) {
    reasons.push(invalidField('commentPlacement', 'commentPlacement must be an object'));
    return reasons;
  }
  reasons.push(...collectForbiddenFieldReasons(
    input,
    COMMENT_PLACEMENT_FORBIDDEN_THREAD_FIELDS,
    'commentPlacement',
    'CommentPlacement must not duplicate comment text or thread message body',
  ));
  if (!placement.placementId) reasons.push(missingField('commentPlacement.placementId'));
  if (!placement.threadId) reasons.push(missingField('commentPlacement.threadId'));
  if (!isPlainObject(input.targetScope)) {
    reasons.push(missingField('commentPlacement.targetScope'));
  } else if (!placement.targetScope.type) {
    reasons.push(missingField('commentPlacement.targetScope.type'));
  }
  if (!isPlainObject(input.anchor)) {
    reasons.push(missingField('commentPlacement.anchor'));
  } else if (!placement.anchor.kind) {
    reasons.push(missingField('commentPlacement.anchor.kind'));
  }
  if (hasOwnField(input, 'confidence') && placement.confidence === null) {
    reasons.push(invalidField('commentPlacement.confidence', 'commentPlacement.confidence must be a finite number'));
  }
  return reasons;
}

export function validateCommentPlacement(input = {}) {
  const placement = normalizeCommentPlacement(input);
  const reasons = collectCommentPlacementValidationReasons(input, placement);
  if (reasons.length > 0) return reviewGraphValidationFailure(reasons);
  return reviewGraphValidationSuccess(placement);
}

export function normalizeTextChange(input = {}) {
  const change = isPlainObject(input) ? input : {};
  const match = isPlainObject(change.match) ? change.match : {};
  return {
    schemaVersion: REVISION_BRIDGE_TEXT_CHANGE_SCHEMA,
    changeId: normalizeString(change.changeId),
    targetScope: normalizeReviewGraphTargetScope(change.targetScope),
    match: {
      kind: normalizeStringEnum(change.matchKind || match.kind, ['exact', 'fuzzy', 'manual'], 'manual'),
      quote: normalizeString(match.quote || change.quote),
      prefix: normalizeString(match.prefix || change.prefix),
      suffix: normalizeString(match.suffix || change.suffix),
    },
    replacementText: normalizeString(change.replacementText),
    createdAt: normalizeString(change.createdAt),
    apply: {
      mode: 'manual',
      authorized: false,
      canApply: false,
    },
  };
}

export function createTextChange(input = {}) {
  return cloneJsonSafe(normalizeTextChange(input));
}

function collectTextChangeValidationReasons(input, change) {
  const reasons = [];
  if (!isPlainObject(input)) {
    reasons.push(invalidField('textChange', 'textChange must be an object'));
    return reasons;
  }
  if (!change.changeId) reasons.push(missingField('textChange.changeId'));
  if (!isPlainObject(input.targetScope)) {
    reasons.push(missingField('textChange.targetScope'));
  } else if (!change.targetScope.type) {
    reasons.push(missingField('textChange.targetScope.type'));
  }
  if (!isPlainObject(input.match) && !hasOwnField(input, 'matchKind')) {
    reasons.push(missingField('textChange.match'));
  }
  if (change.apply.authorized !== false || change.apply.canApply !== false) {
    reasons.push(invalidField('textChange.apply', 'TextChange must not authorize apply'));
  }
  return reasons;
}

export function validateTextChange(input = {}) {
  const change = normalizeTextChange(input);
  const reasons = collectTextChangeValidationReasons(input, change);
  if (reasons.length > 0) return reviewGraphValidationFailure(reasons);
  return reviewGraphValidationSuccess(change);
}

export function normalizeStructuralChange(input = {}) {
  const change = isPlainObject(input) ? input : {};
  return {
    schemaVersion: REVISION_BRIDGE_STRUCTURAL_CHANGE_SCHEMA,
    structuralChangeId: normalizeString(change.structuralChangeId),
    kind: normalizeString(change.kind),
    targetScope: normalizeReviewGraphTargetScope(change.targetScope),
    summary: normalizeString(change.summary),
    diagnosticsOnly: true,
    manualOnly: true,
    createdAt: normalizeString(change.createdAt),
  };
}

export function createStructuralChange(input = {}) {
  return cloneJsonSafe(normalizeStructuralChange(input));
}

function collectStructuralChangeValidationReasons(input, change) {
  const reasons = [];
  if (!isPlainObject(input)) {
    reasons.push(invalidField('structuralChange', 'structuralChange must be an object'));
    return reasons;
  }
  reasons.push(...collectForbiddenFieldReasons(
    input,
    STRUCTURAL_CHANGE_FORBIDDEN_AUTO_FIELDS,
    'structuralChange',
    'StructuralChange must not expose auto apply fields',
  ));
  if (!change.structuralChangeId) reasons.push(missingField('structuralChange.structuralChangeId'));
  if (!change.kind) reasons.push(missingField('structuralChange.kind'));
  return reasons;
}

export function validateStructuralChange(input = {}) {
  const change = normalizeStructuralChange(input);
  const reasons = collectStructuralChangeValidationReasons(input, change);
  if (reasons.length > 0) return reviewGraphValidationFailure(reasons);
  return reviewGraphValidationSuccess(change);
}

export function normalizeDiagnosticItem(input = {}) {
  const item = isPlainObject(input) ? input : {};
  return {
    schemaVersion: REVISION_BRIDGE_DIAGNOSTIC_ITEM_SCHEMA,
    diagnosticId: normalizeString(item.diagnosticId),
    severity: normalizeStringEnum(item.severity, ['info', 'warning', 'error'], 'info'),
    message: normalizeString(item.message),
    targetScope: normalizeReviewGraphTargetScope(item.targetScope),
    relatedItemId: normalizeString(item.relatedItemId),
    createdAt: normalizeString(item.createdAt),
  };
}

export function createDiagnosticItem(input = {}) {
  return cloneJsonSafe(normalizeDiagnosticItem(input));
}

function collectDiagnosticItemValidationReasons(input, item) {
  const reasons = [];
  if (!isPlainObject(input)) {
    reasons.push(invalidField('diagnosticItem', 'diagnosticItem must be an object'));
    return reasons;
  }
  if (!item.diagnosticId) reasons.push(missingField('diagnosticItem.diagnosticId'));
  if (!item.message) reasons.push(missingField('diagnosticItem.message'));
  return reasons;
}

export function validateDiagnosticItem(input = {}) {
  const item = normalizeDiagnosticItem(input);
  const reasons = collectDiagnosticItemValidationReasons(input, item);
  if (reasons.length > 0) return reviewGraphValidationFailure(reasons);
  return reviewGraphValidationSuccess(item);
}

export function normalizeDecisionState(input = {}) {
  const decision = isPlainObject(input) ? input : {};
  return {
    schemaVersion: REVISION_BRIDGE_DECISION_STATE_SCHEMA,
    decisionId: normalizeString(decision.decisionId),
    itemKind: normalizeString(decision.itemKind),
    itemId: normalizeString(decision.itemId),
    status: normalizeStringEnum(decision.status, ['pending', 'accepted', 'rejected', 'deferred'], 'pending'),
    decidedAt: normalizeString(decision.decidedAt),
    reason: normalizeString(decision.reason),
  };
}

export function createDecisionState(input = {}) {
  return cloneJsonSafe(normalizeDecisionState(input));
}

function collectDecisionStateValidationReasons(input, decision, knownItemIds = {}) {
  const reasons = [];
  if (!isPlainObject(input)) {
    reasons.push(invalidField('decisionState', 'decisionState must be an object'));
    return reasons;
  }
  if (!decision.decisionId) reasons.push(missingField('decisionState.decisionId'));
  if (!decision.itemKind) {
    reasons.push(missingField('decisionState.itemKind'));
  } else if (!REVIEWGRAPH_ITEM_KINDS.includes(decision.itemKind)) {
    reasons.push(invalidField('decisionState.itemKind', 'DecisionState itemKind is not supported'));
  }
  if (!decision.itemId) {
    reasons.push(missingField('decisionState.itemId'));
  } else if (
    REVIEWGRAPH_ITEM_KINDS.includes(decision.itemKind)
    && knownItemIds[decision.itemKind]
    && !knownItemIds[decision.itemKind].includes(decision.itemId)
  ) {
    reasons.push(invalidField('decisionState.itemId', 'DecisionState itemId does not reference a known item'));
  }
  return reasons;
}

export function validateDecisionState(input = {}, knownItemIds = {}) {
  const decision = normalizeDecisionState(input);
  const reasons = collectDecisionStateValidationReasons(input, decision, knownItemIds);
  if (reasons.length > 0) return reviewGraphValidationFailure(reasons);
  return reviewGraphValidationSuccess(decision);
}

function normalizeReviewGraph(input = {}) {
  const graph = isPlainObject(input) ? input : {};
  return {
    commentThreads: Array.isArray(graph.commentThreads)
      ? graph.commentThreads.map((thread) => normalizeCommentThread(thread))
      : [],
    commentPlacements: Array.isArray(graph.commentPlacements)
      ? graph.commentPlacements.map((placement) => normalizeCommentPlacement(placement))
      : [],
    textChanges: Array.isArray(graph.textChanges)
      ? graph.textChanges.map((change) => normalizeTextChange(change))
      : [],
    structuralChanges: Array.isArray(graph.structuralChanges)
      ? graph.structuralChanges.map((change) => normalizeStructuralChange(change))
      : [],
    diagnosticItems: Array.isArray(graph.diagnosticItems)
      ? graph.diagnosticItems.map((item) => normalizeDiagnosticItem(item))
      : [],
    decisionStates: Array.isArray(graph.decisionStates)
      ? graph.decisionStates.map((decision) => normalizeDecisionState(decision))
      : [],
  };
}

export function normalizeRevisionSession(input = {}) {
  const session = isPlainObject(input) ? input : {};
  return {
    schemaVersion: REVISION_BRIDGE_REVISION_SESSION_SCHEMA,
    sessionId: normalizeString(session.sessionId),
    projectId: normalizeString(session.projectId),
    baselineHash: normalizeString(session.baselineHash),
    createdAt: normalizeString(session.createdAt),
    updatedAt: normalizeString(session.updatedAt),
    reviewGraph: normalizeReviewGraph(session.reviewGraph),
  };
}

export function createRevisionSession(input = {}) {
  return cloneJsonSafe(normalizeRevisionSession(input));
}

function collectMalformedCollectionReasons(input, collectionName) {
  if (!Array.isArray(input)) {
    return [invalidField(`revisionSession.reviewGraph.${collectionName}`, `${collectionName} must be an array`)];
  }
  const reasons = [];
  input.forEach((item, index) => {
    if (!isPlainObject(item)) {
      reasons.push(invalidField(
        `revisionSession.reviewGraph.${collectionName}.${index}`,
        `${collectionName} entry must be an object`,
      ));
    }
  });
  return reasons;
}

function collectEntityReasons(collection, normalizedCollection, collectReasons, prefix) {
  const reasons = [];
  collection.forEach((item, index) => {
    if (!isPlainObject(item)) return;
    for (const reason of collectReasons(item, normalizedCollection[index])) {
      reasons.push({
        ...reason,
        field: reason.field.replace(/^[^.]+/u, `${prefix}.${index}`),
      });
    }
  });
  return reasons;
}

function collectKnownReviewGraphItemIds(graph) {
  return {
    commentThread: graph.commentThreads.map((thread) => thread.threadId).filter(Boolean),
    commentPlacement: graph.commentPlacements.map((placement) => placement.placementId).filter(Boolean),
    textChange: graph.textChanges.map((change) => change.changeId).filter(Boolean),
    structuralChange: graph.structuralChanges.map((change) => change.structuralChangeId).filter(Boolean),
    diagnosticItem: graph.diagnosticItems.map((item) => item.diagnosticId).filter(Boolean),
  };
}

function collectRevisionSessionValidationReasons(input, session) {
  const reasons = [];
  if (!isPlainObject(input)) {
    reasons.push(invalidField('revisionSession', 'revisionSession must be an object'));
    return reasons;
  }
  if (!session.sessionId) reasons.push(missingField('revisionSession.sessionId'));
  if (!session.projectId) reasons.push(missingField('revisionSession.projectId'));
  if (!session.baselineHash) reasons.push(missingField('revisionSession.baselineHash'));
  if (!isPlainObject(input.reviewGraph)) {
    reasons.push(missingField('revisionSession.reviewGraph'));
    return reasons;
  }

  const graphInput = input.reviewGraph;
  const collectionNames = [
    'commentThreads',
    'commentPlacements',
    'textChanges',
    'structuralChanges',
    'diagnosticItems',
    'decisionStates',
  ];
  for (const collectionName of collectionNames) {
    reasons.push(...collectMalformedCollectionReasons(graphInput[collectionName], collectionName));
  }
  if (reasons.length > 0) return reasons;

  const graph = session.reviewGraph;
  reasons.push(...collectEntityReasons(
    graphInput.commentThreads,
    graph.commentThreads,
    collectCommentThreadValidationReasons,
    'revisionSession.reviewGraph.commentThreads',
  ));
  reasons.push(...collectEntityReasons(
    graphInput.commentPlacements,
    graph.commentPlacements,
    collectCommentPlacementValidationReasons,
    'revisionSession.reviewGraph.commentPlacements',
  ));
  reasons.push(...collectEntityReasons(
    graphInput.textChanges,
    graph.textChanges,
    collectTextChangeValidationReasons,
    'revisionSession.reviewGraph.textChanges',
  ));
  reasons.push(...collectEntityReasons(
    graphInput.structuralChanges,
    graph.structuralChanges,
    collectStructuralChangeValidationReasons,
    'revisionSession.reviewGraph.structuralChanges',
  ));
  reasons.push(...collectEntityReasons(
    graphInput.diagnosticItems,
    graph.diagnosticItems,
    collectDiagnosticItemValidationReasons,
    'revisionSession.reviewGraph.diagnosticItems',
  ));

  const threadIds = graph.commentThreads.map((thread) => thread.threadId).filter(Boolean);
  graph.commentPlacements.forEach((placement, index) => {
    if (placement.threadId && !threadIds.includes(placement.threadId)) {
      reasons.push(invalidField(
        `revisionSession.reviewGraph.commentPlacements.${index}.threadId`,
        'CommentPlacement threadId does not reference a known CommentThread',
      ));
    }
  });

  const knownItemIds = collectKnownReviewGraphItemIds(graph);
  graphInput.decisionStates.forEach((decisionInput, index) => {
    if (!isPlainObject(decisionInput)) return;
    const decisionReasons = collectDecisionStateValidationReasons(
      decisionInput,
      graph.decisionStates[index],
      knownItemIds,
    );
    for (const reason of decisionReasons) {
      reasons.push({
        ...reason,
        field: reason.field.replace(/^decisionState/u, `revisionSession.reviewGraph.decisionStates.${index}`),
      });
    }
  });

  return reasons;
}

export function validateRevisionSession(input = {}) {
  const session = normalizeRevisionSession(input);
  const reasons = collectRevisionSessionValidationReasons(input, session);
  if (reasons.length > 0) return reviewGraphValidationFailure(reasons);
  return reviewGraphValidationSuccess(session);
}

function reviewPacketPreviewDiagnostics(reasons) {
  return {
    ok: false,
    type: 'revisionBridge.reviewPacketPreview',
    status: 'diagnostics',
    code: REVIEW_PACKET_PREVIEW_DIAGNOSTICS_CODE,
    reason: reasons[0]?.code || REVIEW_PACKET_PREVIEW_DIAGNOSTICS_CODE,
    reasons,
    session: null,
  };
}

function reviewPacketPreviewReady(session) {
  return {
    ok: true,
    type: 'revisionBridge.reviewPacketPreview',
    status: 'preview',
    code: REVIEW_PACKET_PREVIEW_READY_CODE,
    reason: REVIEW_PACKET_PREVIEW_READY_CODE,
    reasons: [],
    session,
  };
}

function stripReviewPacketPreviewApplyFields(value) {
  if (Array.isArray(value)) return value.map((item) => stripReviewPacketPreviewApplyFields(item));
  if (!isPlainObject(value)) return value;

  const stripped = {};
  for (const key of Object.keys(value)) {
    if (REVIEW_PACKET_PREVIEW_FORBIDDEN_APPLY_FIELDS.includes(key)) continue;
    stripped[key] = stripReviewPacketPreviewApplyFields(value[key]);
  }
  return stripped;
}

function collectReviewPacketPreviewInputReasons(input) {
  const reasons = [];
  if (!isPlainObject(input)) {
    reasons.push(invalidField('reviewPacketPreview', 'reviewPacketPreview input must be an object'));
    return reasons;
  }
  if (!normalizeString(input.projectId)) reasons.push(missingField('projectId'));
  if (!normalizeString(input.sessionId)) reasons.push(missingField('sessionId'));
  if (!normalizeString(input.baselineHash)) reasons.push(missingField('baselineHash'));
  if (!isPlainObject(input.reviewPacket)) {
    reasons.push(missingField('reviewPacket'));
  }
  if (hasOwnField(input, 'createdAt') && typeof input.createdAt !== 'string') {
    reasons.push(invalidField('createdAt', 'createdAt must be a caller-supplied string'));
  }
  if (hasOwnField(input, 'updatedAt') && typeof input.updatedAt !== 'string') {
    reasons.push(invalidField('updatedAt', 'updatedAt must be a caller-supplied string'));
  }
  return reasons;
}

function buildRevisionPacketPreviewCandidate(input) {
  const reviewPacket = isPlainObject(input.reviewPacket) ? input.reviewPacket : {};
  return {
    sessionId: input.sessionId,
    projectId: input.projectId,
    baselineHash: input.baselineHash,
    createdAt: hasOwnField(input, 'createdAt') ? input.createdAt : '',
    updatedAt: hasOwnField(input, 'updatedAt') ? input.updatedAt : '',
    reviewGraph: {
      commentThreads: reviewPacket.commentThreads,
      commentPlacements: reviewPacket.commentPlacements,
      textChanges: reviewPacket.textChanges,
      structuralChanges: reviewPacket.structuralChanges,
      diagnosticItems: reviewPacket.diagnosticItems,
      decisionStates: reviewPacket.decisionStates,
    },
  };
}

export function buildRevisionPacketPreview(input = {}) {
  const inputReasons = collectReviewPacketPreviewInputReasons(input);
  if (inputReasons.length > 0) return reviewPacketPreviewDiagnostics(inputReasons);

  const validation = validateRevisionSession(buildRevisionPacketPreviewCandidate(input));
  if (!validation.ok) return reviewPacketPreviewDiagnostics(validation.reasons);
  return reviewPacketPreviewReady(stripReviewPacketPreviewApplyFields(validation.value));
}

function parsedReviewSurfaceAdapterDiagnostics(reasons, reviewPacket, previewInput, previewResult) {
  return stripReviewPacketPreviewApplyFields({
    ok: false,
    type: 'revisionBridge.parsedReviewSurfaceAdapter',
    status: 'diagnostics',
    code: PARSED_REVIEW_SURFACE_ADAPTER_DIAGNOSTICS_CODE,
    reason: reasons[0]?.code || PARSED_REVIEW_SURFACE_ADAPTER_DIAGNOSTICS_CODE,
    reasons,
    reviewPacket,
    previewInput,
    revisionBridgePreviewResult: previewResult,
  });
}

function parsedReviewSurfaceAdapterReady(reviewPacket, previewInput, previewResult) {
  return stripReviewPacketPreviewApplyFields({
    ok: true,
    type: 'revisionBridge.parsedReviewSurfaceAdapter',
    status: 'preview',
    code: PARSED_REVIEW_SURFACE_ADAPTER_READY_CODE,
    reason: PARSED_REVIEW_SURFACE_ADAPTER_READY_CODE,
    reasons: [],
    reviewPacket,
    previewInput,
    revisionBridgePreviewResult: previewResult,
  });
}

function collectParsedReviewSurfaceInputReasons(input) {
  const reasons = [];
  if (!isPlainObject(input)) {
    reasons.push(invalidField('parsedReviewSurfaceAdapter', 'parsed review surface adapter input must be an object'));
    return reasons;
  }
  if (!normalizeString(input.projectId)) reasons.push(missingField('projectId'));
  if (!normalizeString(input.sessionId)) reasons.push(missingField('sessionId'));
  if (!normalizeString(input.baselineHash)) reasons.push(missingField('baselineHash'));
  if (hasOwnField(input, 'createdAt') && typeof input.createdAt !== 'string') {
    reasons.push(invalidField('createdAt', 'createdAt must be a caller-supplied string'));
  }
  if (hasOwnField(input, 'updatedAt') && typeof input.updatedAt !== 'string') {
    reasons.push(invalidField('updatedAt', 'updatedAt must be a caller-supplied string'));
  }
  if (!isPlainObject(input.parsedSurface)) {
    reasons.push(missingField('parsedSurface'));
  }
  return reasons;
}

function collectParsedSurfaceKeyReasons(parsedSurface) {
  const reasons = [];
  if (!isPlainObject(parsedSurface)) return reasons;

  for (const key of Object.keys(parsedSurface).sort()) {
    if (PARSED_REVIEW_SURFACE_ALIAS_KEYS.includes(key)) {
      reasons.push(invalidField(
        `parsedSurface.${key}`,
        'parsed review surface alias keys are not accepted',
      ));
      continue;
    }
    if (!PARSED_REVIEW_SURFACE_KEYS.includes(key)) {
      reasons.push(invalidField(
        `parsedSurface.${key}`,
        'parsed review surface key is not supported',
      ));
    }
  }
  return reasons;
}

function readParsedSurfaceCollection(parsedSurface, collectionName, reasons) {
  if (!isPlainObject(parsedSurface) || !hasOwnField(parsedSurface, collectionName)) return [];
  const collection = parsedSurface[collectionName];
  if (!Array.isArray(collection)) {
    reasons.push(invalidField(`parsedSurface.${collectionName}`, `${collectionName} must be an array`));
    return [];
  }
  return collection.map((item) => cloneJsonSafe(item));
}

function normalizeUnsupportedItemDiagnosticCandidate(item, index) {
  return {
    diagnosticId: normalizeString(item.unsupportedId) || `unsupported-item-${index}`,
    severity: item.severity,
    message: item.message,
    targetScope: item.targetScope,
    relatedItemId: item.relatedItemId,
    createdAt: item.createdAt,
  };
}

function readUnsupportedItemDiagnostics(parsedSurface, reasons) {
  if (!isPlainObject(parsedSurface) || !hasOwnField(parsedSurface, 'unsupportedItems')) return [];
  const unsupportedItems = parsedSurface.unsupportedItems;
  if (!Array.isArray(unsupportedItems)) {
    reasons.push(invalidField('parsedSurface.unsupportedItems', 'unsupportedItems must be an array'));
    return [];
  }

  const diagnostics = [];
  unsupportedItems.forEach((item, index) => {
    if (!isPlainObject(item)) {
      reasons.push(invalidField(
        `parsedSurface.unsupportedItems.${index}`,
        'unsupportedItems entry must be an object',
      ));
      return;
    }
    diagnostics.push(normalizeUnsupportedItemDiagnosticCandidate(item, index));
  });
  return diagnostics;
}

function buildParsedReviewSurfaceReviewPacket(input, reasons) {
  const parsedSurface = isPlainObject(input) && isPlainObject(input.parsedSurface) ? input.parsedSurface : {};
  const reviewPacket = {};
  for (const collectionName of PARSED_REVIEW_SURFACE_COLLECTIONS) {
    reviewPacket[collectionName] = readParsedSurfaceCollection(parsedSurface, collectionName, reasons);
  }
  reviewPacket.diagnosticItems = reviewPacket.diagnosticItems.concat(
    readUnsupportedItemDiagnostics(parsedSurface, reasons),
  );
  return reviewPacket;
}

function buildParsedReviewSurfacePreviewInput(input, reviewPacket) {
  const previewInput = {
    projectId: isPlainObject(input) ? input.projectId : undefined,
    sessionId: isPlainObject(input) ? input.sessionId : undefined,
    baselineHash: isPlainObject(input) ? input.baselineHash : undefined,
    reviewPacket,
  };
  if (isPlainObject(input) && hasOwnField(input, 'createdAt')) previewInput.createdAt = input.createdAt;
  if (isPlainObject(input) && hasOwnField(input, 'updatedAt')) previewInput.updatedAt = input.updatedAt;
  return previewInput;
}

export function adaptParsedReviewSurfaceToReviewPacketPreviewInput(input = {}) {
  const reasons = collectParsedReviewSurfaceInputReasons(input);
  if (isPlainObject(input?.parsedSurface)) reasons.push(...collectParsedSurfaceKeyReasons(input.parsedSurface));

  const reviewPacket = buildParsedReviewSurfaceReviewPacket(input, reasons);
  const previewInput = buildParsedReviewSurfacePreviewInput(input, reviewPacket);
  const previewResult = buildRevisionPacketPreview(previewInput);
  const finalReasons = reasons.concat(previewResult.ok ? [] : previewResult.reasons);

  if (finalReasons.length > 0) {
    return parsedReviewSurfaceAdapterDiagnostics(finalReasons, reviewPacket, previewInput, previewResult);
  }
  return parsedReviewSurfaceAdapterReady(reviewPacket, previewInput, previewResult);
}

function normalizeTargetScope(input) {
  const scope = isPlainObject(input) ? input : {};
  return {
    type: normalizeString(scope.type),
    id: normalizeString(scope.id),
  };
}

function normalizeDecision(input, index) {
  const decision = input;
  const match = isPlainObject(decision.match) ? decision.match : {};
  return {
    decisionId: normalizeString(decision.decisionId) || `decision-${index}`,
    status: normalizeString(decision.status),
    matchKind: normalizeString(decision.matchKind || decision.matchMode || match.kind || match.mode),
    applyMode: normalizeString(decision.applyMode),
  };
}

function normalizeDecisionSet(input) {
  const decisionSet = isPlainObject(input) ? input : {};
  const decisions = Array.isArray(decisionSet.decisions)
    ? decisionSet.decisions
      .filter((decision) => isPlainObject(decision))
      .map((decision, index) => normalizeDecision(decision, index))
    : [];
  return {
    decisions,
  };
}

function normalizePacket(input) {
  const packet = isPlainObject(input) ? input : {};
  return {
    schemaVersion: normalizeString(packet.schemaVersion),
    projectId: normalizeString(packet.projectId),
    revisionSessionId: normalizeString(packet.revisionSessionId),
    baselineHash: normalizeString(packet.baselineHash),
    targetScope: normalizeTargetScope(packet.targetScope),
    decisionSet: normalizeDecisionSet(packet.decisionSet),
  };
}

function collectPacketValidationReasons(input, packet) {
  const reasons = [];
  if (!isPlainObject(input)) {
    reasons.push(invalidField('packet', 'packet must be an object'));
    return reasons;
  }
  if (!packet.schemaVersion) {
    reasons.push(missingField('schemaVersion'));
  } else if (packet.schemaVersion !== REVISION_BRIDGE_P0_PACKET_SCHEMA) {
    reasons.push(invalidField('schemaVersion', 'schemaVersion is not supported'));
  }
  if (!packet.projectId) reasons.push(missingField('projectId'));
  if (!packet.revisionSessionId) reasons.push(missingField('revisionSessionId'));
  if (!packet.baselineHash) reasons.push(missingField('baselineHash'));
  if (!isPlainObject(input.targetScope)) {
    reasons.push(missingField('targetScope'));
  } else if (!packet.targetScope.type) {
    reasons.push(missingField('targetScope.type'));
  }
  if (!isPlainObject(input.decisionSet)) {
    reasons.push(missingField('decisionSet'));
  } else if (!Array.isArray(input.decisionSet.decisions)) {
    reasons.push(invalidField('decisionSet.decisions', 'decisionSet.decisions must be an array'));
  } else {
    input.decisionSet.decisions.forEach((decision, index) => {
      if (!isPlainObject(decision)) {
        reasons.push(invalidField(`decisionSet.decisions.${index}`, 'decision entry must be an object'));
      }
    });
  }
  return reasons;
}

function validationFailure(reasons) {
  return {
    ok: false,
    type: 'revisionBridge.validation',
    code: PACKET_INVALID_CODE,
    reason: reasons[0]?.code || 'REVISION_BRIDGE_PACKET_INVALID',
    reasons,
    packet: null,
  };
}

export function validateRevisionBridgePacket(input = {}) {
  const packet = normalizePacket(input);
  const reasons = collectPacketValidationReasons(input, packet);
  if (reasons.length > 0) return validationFailure(reasons);
  return {
    ok: true,
    type: 'revisionBridge.validation',
    code: PACKET_VALID_CODE,
    reason: 'REVISION_BRIDGE_PACKET_VALID',
    reasons: [],
    packet: cloneJsonSafe(packet),
  };
}

function applyMissingReason(field) {
  return {
    code: 'REVISION_BRIDGE_APPLY_FIELD_REQUIRED',
    field,
    message: `${field} is required before apply can be considered`,
  };
}

function collectApplySafetyReasons(packet) {
  const reasons = [];
  if (!packet.projectId) reasons.push(applyMissingReason('projectId'));
  if (!packet.revisionSessionId) reasons.push(applyMissingReason('revisionSessionId'));
  if (!packet.baselineHash) reasons.push(applyMissingReason('baselineHash'));
  if (!packet.targetScope.type) reasons.push(applyMissingReason('targetScope.type'));
  if (!Array.isArray(packet.decisionSet.decisions)) {
    reasons.push(applyMissingReason('decisionSet.decisions'));
    return reasons;
  }
  for (const decision of packet.decisionSet.decisions) {
    if (decision.status !== 'resolved') {
      reasons.push({
        code: 'REVISION_BRIDGE_APPLY_UNRESOLVED_DECISION',
        field: 'decisionSet.decisions.status',
        decisionId: decision.decisionId,
        message: 'only resolved decisions may be considered for apply',
      });
    }
    if (decision.matchKind !== 'exact') {
      reasons.push({
        code: 'REVISION_BRIDGE_APPLY_APPROXIMATE_MATCH_FORBIDDEN',
        field: 'decisionSet.decisions.matchKind',
        decisionId: decision.decisionId,
        message: 'approximate or missing matches are forbidden for apply',
      });
    }
    if (decision.applyMode === 'auto' && (decision.status !== 'resolved' || decision.matchKind !== 'exact')) {
      reasons.push({
        code: 'REVISION_BRIDGE_APPLY_AUTO_UNSAFE_FORBIDDEN',
        field: 'decisionSet.decisions.applyMode',
        decisionId: decision.decisionId,
        message: 'auto-apply is forbidden for unresolved or approximate decisions',
      });
    }
  }
  return reasons;
}

function blockedApplyResult(reasons) {
  return {
    ok: false,
    type: 'revisionBridge.applySafety',
    status: 'blocked',
    code: APPLY_BLOCKED_CODE,
    reason: reasons[0]?.code || 'REVISION_BRIDGE_P0_APPLY_DISABLED',
    reasons,
    canApply: false,
  };
}

export function evaluateRevisionBridgeApplySafety(input = {}) {
  const packet = normalizePacket(input);
  const validation = validateRevisionBridgePacket(input);
  const reasons = validation.ok
    ? collectApplySafetyReasons(packet)
    : validation.reasons.map((reason) => ({
      code: 'REVISION_BRIDGE_APPLY_PACKET_INVALID',
      field: reason.field,
      message: reason.message,
    }));

  if (reasons.length === 0) {
    reasons.push({
      code: 'REVISION_BRIDGE_P0_APPLY_DISABLED',
      field: 'apply',
      message: 'P0 safety kernel does not perform runtime apply',
    });
  }

  return blockedApplyResult(reasons);
}
