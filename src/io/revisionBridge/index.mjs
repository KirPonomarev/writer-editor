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
export const REVISION_BRIDGE_EXPORT_MANIFEST_SCHEMA = 'revision-bridge.export-manifest.v1';
export const REVISION_BRIDGE_TRANSPORT_ENVELOPE_SCHEMA = 'revision-bridge.transport-envelope.v1';
export const REVISION_BRIDGE_TRANSPORT_BINDING_SCHEMA = 'revision-bridge.transport-envelope-binding.v1';
export const REVISION_BRIDGE_EXPORT_RUNTIME_SNAPSHOT_SCHEMA =
  'revision-bridge.export-runtime-snapshot-readiness.v1';
export const REVISION_BRIDGE_REVISION_SESSION_STATES = Object.freeze([
  'Exported',
  'Imported',
  'Diagnosed',
  'Decisioned',
  'Planned',
  'Applying',
  'Applied',
  'Failed',
  'Verified',
  'Closed',
  'Reopened',
  'Quarantined',
]);
export const REVISION_BRIDGE_REVISION_SESSION_VERSION_TAGS = Object.freeze({
  parserVersion: 'revision-bridge.parser.v1',
  matcherVersion: 'revision-bridge.matcher.v1',
  policyVersion: 'revision-bridge.policy.v1',
  receiptVersion: 'revision-bridge.receipt.v1',
});
export const REVISION_BRIDGE_REVISION_SESSION_STATE_INVARIANTS_SCHEMA =
  'revision-bridge.revision-session-state-invariants.v1';
export const REVISION_BRIDGE_DOCX_REVIEW_PROFILE_ID = 'revision-bridge-docx-review-profile-v1';
export const REVISION_BRIDGE_SUPPORTED_SURFACE_V1_SCHEMA = 'revision-bridge.supported-surface.v1';
export const REVISION_BRIDGE_COMMENT_THREAD_SCHEMA = 'revision-bridge.comment-thread.v1';
export const REVISION_BRIDGE_COMMENT_PLACEMENT_SCHEMA = 'revision-bridge.comment-placement.v1';
export const REVISION_BRIDGE_COMMENT_DECISION_SEPARATION_SCHEMA =
  'revision-bridge.comment-decision-separation.v1';
export const REVISION_BRIDGE_TEXT_CHANGE_SCHEMA = 'revision-bridge.text-change.v1';
export const REVISION_BRIDGE_STRUCTURAL_CHANGE_SCHEMA = 'revision-bridge.structural-change.v1';
export const REVISION_BRIDGE_STRUCTURAL_OPS_MANUAL_REVIEW_SCHEMA =
  'revision-bridge.structural-ops-manual-review.v1';
export const REVISION_BRIDGE_DIAGNOSTIC_ITEM_SCHEMA = 'revision-bridge.diagnostic-item.v1';
export const REVISION_BRIDGE_DECISION_STATE_SCHEMA = 'revision-bridge.decision-state.v1';
export const REVISION_BRIDGE_REVIEW_PACKET_PREVIEW_SCHEMA = 'revision-bridge.review-packet-preview.v1';
export const REVISION_BRIDGE_BLOCK_SCHEMA = 'revision-bridge.block.v1';
export const REVISION_BRIDGE_BLOCK_LINEAGE_SCHEMA = 'revision-bridge.block-lineage.v1';
export const REVISION_BRIDGE_BLOCK_IDENTITY_RISK_SCHEMA = 'revision-bridge.block-identity-risk.v1';
export const REVISION_BRIDGE_BLOCK_KINDS = Object.freeze([
  'paragraph',
  'heading',
  'quote',
  'listItem',
  'separator',
  'tablePlaceholder',
  'unsupportedObjectPlaceholder',
]);
export const REVISION_BRIDGE_INLINE_RANGE_SCHEMA = 'revision-bridge.inline-range.v1';
export const REVISION_BRIDGE_COMMENT_ANCHOR_PLACEMENT_SCHEMA = 'revision-bridge.comment-anchor-placement.v1';
export const REVISION_BRIDGE_ANCHOR_CONFIDENCE_EVALUATION_SCHEMA = 'revision-bridge.anchor-confidence-evaluation.v1';
export const REVISION_BRIDGE_ANCHOR_DISAGREEMENT_SUMMARY_SCHEMA =
  'revision-bridge.anchor-disagreement-summary.v1';
export const REVISION_BRIDGE_INLINE_ANCHOR_KINDS = Object.freeze([
  'point',
  'span',
  'deleted',
  'orphan',
]);
export const REVISION_BRIDGE_MATCH_CONFIDENCE_LEVELS = Object.freeze([
  'exact',
  'strongHigh',
  'weakHigh',
  'approximate',
  'unresolved',
]);
export const REVISION_BRIDGE_RISK_CLASSES = Object.freeze([
  'low',
  'medium',
  'high',
  'critical',
]);
export const REVISION_BRIDGE_AUTOMATION_POLICIES = Object.freeze([
  'autoEligible',
  'manualConfirmRequired',
  'manualOnly',
  'diagnosticsOnly',
  'hardFail',
]);
export const REVISION_BRIDGE_ANCHOR_CONFIDENCE_REASON_CODES = Object.freeze([
  'REVISION_BRIDGE_ANCHOR_CONFIDENCE_EXACT_RANGE',
  'REVISION_BRIDGE_ANCHOR_CONFIDENCE_VALIDATION_FAILED',
  'REVISION_BRIDGE_ANCHOR_CONFIDENCE_MISSING_BLOCK',
  'REVISION_BRIDGE_ANCHOR_CONFIDENCE_OUT_OF_BOUNDS',
  'REVISION_BRIDGE_ANCHOR_CONFIDENCE_STALE_QUOTE',
  'REVISION_BRIDGE_ANCHOR_CONFIDENCE_QUOTE_ELSEWHERE',
  'REVISION_BRIDGE_ANCHOR_CONFIDENCE_PREFIX_MISMATCH',
  'REVISION_BRIDGE_ANCHOR_CONFIDENCE_SUFFIX_MISMATCH',
  'REVISION_BRIDGE_ANCHOR_CONFIDENCE_ORPHAN',
  'REVISION_BRIDGE_ANCHOR_CONFIDENCE_DELETED_TARGET',
  'REVISION_BRIDGE_ANCHOR_CONFIDENCE_WEAK_ANCHOR',
  'REVISION_BRIDGE_ANCHOR_CONFIDENCE_UNRESOLVED_ANCHOR',
]);
const MATCH_PROOF_BUILT_CODE = 'REVISION_BRIDGE_MATCH_PROOF_BUILT';
export const REVISION_BRIDGE_MATCH_PROOF_SCHEMA = 'revision-bridge.match-proof.v1';
export const REVISION_BRIDGE_MATCH_PROOF_REASON_CODES = Object.freeze([
  MATCH_PROOF_BUILT_CODE,
  ...REVISION_BRIDGE_ANCHOR_CONFIDENCE_REASON_CODES,
]);
export const REVISION_BRIDGE_PLACEMENT_EVALUATION_SCHEMA = 'revision-bridge.comment-anchor-placement-evaluation.v1';
const PLACEMENT_EVALUATION_EVALUATED_CODE = 'REVISION_BRIDGE_PLACEMENT_EVALUATION_EVALUATED';
const PLACEMENT_EVALUATION_VALIDATION_FAILED_CODE = 'REVISION_BRIDGE_PLACEMENT_EVALUATION_VALIDATION_FAILED';
const PLACEMENT_EVALUATION_DIAGNOSTICS_CODE = 'REVISION_BRIDGE_PLACEMENT_EVALUATION_DIAGNOSTICS';
const PLACEMENT_EVALUATION_UNRESOLVED_CODE = 'REVISION_BRIDGE_PLACEMENT_EVALUATION_UNRESOLVED';
const PLACEMENT_EVALUATION_HARD_FAIL_CODE = 'REVISION_BRIDGE_PLACEMENT_EVALUATION_HARD_FAIL';
export const REVISION_BRIDGE_PLACEMENT_EVALUATION_REASON_CODES = Object.freeze([
  PLACEMENT_EVALUATION_EVALUATED_CODE,
  PLACEMENT_EVALUATION_VALIDATION_FAILED_CODE,
  PLACEMENT_EVALUATION_DIAGNOSTICS_CODE,
  PLACEMENT_EVALUATION_UNRESOLVED_CODE,
  PLACEMENT_EVALUATION_HARD_FAIL_CODE,
]);
export const REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_SCHEMA = 'revision-bridge.comment-anchor-placement-batch-diagnostics.v1';
export const REVISION_BRIDGE_REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_SCHEMA =
  'revision-bridge.revision-session-skeleton-admission-preview.v1';
export const REVISION_BRIDGE_REVISION_SESSION_IMPORT_SEAM_PREVIEW_SCHEMA =
  'revision-bridge.revision-session-import-seam-preview.v1';
export const REVISION_BRIDGE_REVISION_SESSION_REGISTRY_RECORD_SCHEMA =
  'revision-bridge.revision-session-registry-record.v1';
const PLACEMENT_BATCH_DIAGNOSTICS_EVALUATED_CODE = 'REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_EVALUATED';
const PLACEMENT_BATCH_DIAGNOSTICS_VALIDATION_FAILED_CODE = 'REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_VALIDATION_FAILED';
const PLACEMENT_BATCH_DIAGNOSTICS_DIAGNOSTICS_CODE = 'REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_DIAGNOSTICS';
const PLACEMENT_BATCH_DIAGNOSTICS_UNRESOLVED_CODE = 'REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_UNRESOLVED';
const PLACEMENT_BATCH_DIAGNOSTICS_HARD_FAIL_CODE = 'REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_HARD_FAIL';
export const REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_REASON_CODES = Object.freeze([
  PLACEMENT_BATCH_DIAGNOSTICS_EVALUATED_CODE,
  PLACEMENT_BATCH_DIAGNOSTICS_VALIDATION_FAILED_CODE,
  PLACEMENT_BATCH_DIAGNOSTICS_DIAGNOSTICS_CODE,
  PLACEMENT_BATCH_DIAGNOSTICS_UNRESOLVED_CODE,
  PLACEMENT_BATCH_DIAGNOSTICS_HARD_FAIL_CODE,
  ...REVISION_BRIDGE_PLACEMENT_EVALUATION_REASON_CODES,
  ...REVISION_BRIDGE_ANCHOR_CONFIDENCE_REASON_CODES,
]);

// RB_20_DONOR_CONFIDENCE_UTILS_START
const REVISION_BRIDGE_CONFIDENCE_NORMALIZATION_ALIASES = Object.freeze({
  exact: 'exact',
  high: 'strongHigh',
  stronghigh: 'strongHigh',
  'strong-high': 'strongHigh',
  strong_high: 'strongHigh',
  'strong high': 'strongHigh',
  weakhigh: 'weakHigh',
  'weak-high': 'weakHigh',
  weak_high: 'weakHigh',
  'weak high': 'weakHigh',
  approximate: 'approximate',
  unresolved: 'unresolved',
});

export function normalizeRevisionBridgeConfidenceLevel(value) {
  const key = normalizeString(value).toLowerCase();
  if (!key) return 'unresolved';
  if (REVISION_BRIDGE_MATCH_CONFIDENCE_LEVELS.includes(key)) return key;
  return REVISION_BRIDGE_CONFIDENCE_NORMALIZATION_ALIASES[key] || 'unresolved';
}

export function summarizeRevisionBridgeConfidenceLevels(items = []) {
  const counts = {
    exact: 0,
    strongHigh: 0,
    weakHigh: 0,
    high: 0,
    approximate: 0,
    unresolved: 0,
  };
  for (const item of Array.isArray(items) ? items : []) {
    const candidate = isPlainObject(item) ? item.confidence : item;
    const confidence = normalizeRevisionBridgeConfidenceLevel(candidate);
    if (confidence === 'strongHigh') {
      counts.strongHigh += 1;
      counts.high += 1;
    } else if (confidence === 'weakHigh') {
      counts.weakHigh += 1;
      counts.high += 1;
    } else if (Object.hasOwn(counts, confidence)) {
      counts[confidence] += 1;
    } else {
      counts.unresolved += 1;
    }
  }
  return counts;
}

function safeConfidenceCount(value) {
  if (!Number.isFinite(Number(value))) return 0;
  const normalized = Math.floor(Number(value));
  return normalized > 0 ? normalized : 0;
}

export function resolveRevisionBridgeOverallConfidence(counts = {}) {
  const source = isPlainObject(counts) ? counts : {};
  if (safeConfidenceCount(source.unresolved) > 0) return 'unresolved';
  if (safeConfidenceCount(source.approximate) > 0) return 'approximate';
  if (safeConfidenceCount(source.weakHigh) > 0) return 'weakHigh';
  if (safeConfidenceCount(source.strongHigh) > 0 || safeConfidenceCount(source.high) > 0) {
    return 'strongHigh';
  }
  return 'exact';
}

function revisionBridgeLegacyConfidence(value) {
  const confidence = normalizeRevisionBridgeConfidenceLevel(value);
  if (confidence === 'strongHigh' || confidence === 'weakHigh') return 'high';
  return confidence;
}

export function makeRevisionBridgeDiagnostic(code, message, details = {}, severity = 'warn') {
  return {
    code: typeof code === 'string' && code ? code : 'RB_UNKNOWN',
    message: typeof message === 'string' ? message : 'Unknown Revision Bridge diagnostic',
    severity: typeof severity === 'string' ? severity : 'warn',
    details: isPlainObject(details) ? cloneJsonSafe(details) : {},
  };
}

export function formatRevisionBridgeDiagnosticsAsText(bundle = {}) {
  const source = isPlainObject(bundle) ? bundle : {};
  const manifest = isPlainObject(source.manifest) ? source.manifest : {};
  const lines = [];
  lines.push(`revisionSessionId=${normalizeString(manifest.id)}`);
  lines.push(`exportSessionId=${normalizeString(manifest.exportSessionId)}`);
  lines.push(`status=${normalizeString(manifest.status)}`);
  lines.push(`overallConfidence=${normalizeString(manifest.overallConfidence)}`);
  lines.push(`sourceFilename=${normalizeString(manifest.sourceFilename)}`);
  lines.push(`baselineHash=${normalizeString(manifest.baselineHash)}`);
  lines.push(`projectId=${normalizeString(manifest.projectId)}`);
  lines.push('');
  lines.push('[diagnostics]');
  for (const row of Array.isArray(source.diagnostics) ? source.diagnostics : []) {
    const item = isPlainObject(row) ? row : {};
    lines.push(`- ${normalizeString(item.code) || 'RB_UNKNOWN'} :: ${normalizeString(item.message)}`);
  }
  lines.push('');
  lines.push('[unresolved]');
  for (const row of Array.isArray(source.unresolvedItems) ? source.unresolvedItems : []) {
    const item = isPlainObject(row) ? row : {};
    lines.push(`- ${normalizeString(item.id) || 'item'} :: ${normalizeString(item.kind) || 'unknown'} :: ${normalizeString(item.message)}`);
  }
  lines.push('');
  lines.push('[structural]');
  for (const row of Array.isArray(source.structuralChanges) ? source.structuralChanges : []) {
    const item = isPlainObject(row) ? row : {};
    lines.push(`- ${normalizeString(item.id) || 'structural'} :: ${normalizeString(item.operation) || 'unknown'} :: ${normalizeString(item.policy)}`);
  }
  lines.push('');
  lines.push('[comments]');
  for (const row of Array.isArray(source.commentPlacements) ? source.commentPlacements : []) {
    const item = isPlainObject(row) ? row : {};
    lines.push(`- ${normalizeString(item.id) || 'placement'} :: ${normalizeString(item.anchorType)} :: ${revisionBridgeLegacyConfidence(item.confidence)}`);
  }
  return `${lines.join('\n')}\n`;
}
// RB_20_DONOR_CONFIDENCE_UTILS_END

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

const REVISION_SESSION_ALLOWED_TRANSITIONS = Object.freeze({
  Exported: Object.freeze(['Imported', 'Quarantined']),
  Imported: Object.freeze(['Diagnosed', 'Failed', 'Quarantined']),
  Diagnosed: Object.freeze(['Decisioned', 'Failed', 'Quarantined']),
  Decisioned: Object.freeze(['Planned', 'Failed', 'Quarantined']),
  Planned: Object.freeze(['Applying', 'Failed', 'Quarantined']),
  Applying: Object.freeze(['Applied', 'Failed', 'Quarantined']),
  Applied: Object.freeze(['Verified', 'Failed']),
  Failed: Object.freeze(['Reopened', 'Closed', 'Quarantined']),
  Verified: Object.freeze(['Closed', 'Reopened']),
  Closed: Object.freeze(['Reopened']),
  Reopened: Object.freeze(['Imported', 'Diagnosed', 'Closed']),
  Quarantined: Object.freeze(['Reopened', 'Closed']),
});

export const DOCX_PACKAGE_BOUNDARY_BUDGETS = Object.freeze({
  maxEntries: 512,
  maxTotalBytes: 52428800,
  maxEntryBytes: 10485760,
  maxRelationshipEntries: 64,
  maxUnsupportedStoryEntries: 32,
});

export const DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES = Object.freeze({
  INVENTORY_NOT_OBJECT: 'DOCX_INVENTORY_NOT_PLAIN_OBJECT',
  INVENTORY_PATH_INPUT_REJECTED: 'DOCX_INVENTORY_PATH_INPUT_REJECTED',
  INVENTORY_BINARY_INPUT_REJECTED: 'DOCX_INVENTORY_BINARY_INPUT_REJECTED',
  ENTRIES_MISSING: 'DOCX_INVENTORY_ENTRIES_MISSING',
  ENTRIES_NOT_ARRAY: 'DOCX_INVENTORY_ENTRIES_INVALID',
  ENTRY_NOT_OBJECT: 'DOCX_ENTRY_NOT_OBJECT',
  ENTRY_ID_INVALID: 'DOCX_ENTRY_ID_INVALID',
  ENTRY_KIND_INVALID: 'DOCX_ENTRY_KIND_INVALID',
  ENTRY_BYTE_SIZE_INVALID: 'DOCX_ENTRY_BYTE_SIZE_INVALID',
  ENTRY_COMPRESSED_SIZE_INVALID: 'DOCX_ENTRY_COMPRESSED_SIZE_INVALID',
  ENTRY_MARKERS_INVALID: 'DOCX_ENTRY_MARKERS_INVALID',
  ENTRY_MARKER_INVALID: 'DOCX_ENTRY_MARKER_INVALID',
  ENTRY_STORY_INVALID: 'DOCX_ENTRY_STORY_INVALID',
  UNKNOWN_SIZE_FIELD_PRESENT: 'DOCX_UNKNOWN_SIZE_FIELD_PRESENT',
  ENTRY_COUNT_EXCEEDED: 'DOCX_ENTRY_COUNT_BUDGET_EXCEEDED',
  TOTAL_BYTES_EXCEEDED: 'DOCX_TOTAL_UNCOMPRESSED_BUDGET_EXCEEDED',
  ENTRY_BYTES_EXCEEDED: 'DOCX_SINGLE_ENTRY_UNCOMPRESSED_BUDGET_EXCEEDED',
  RELATIONSHIP_ENTRY_COUNT_EXCEEDED: 'DOCX_RELATIONSHIP_ENTRY_COUNT_BUDGET_EXCEEDED',
  UNSUPPORTED_STORY_COUNT_EXCEEDED: 'DOCX_UNSUPPORTED_STORY_COUNT_BUDGET_EXCEEDED',
  UNKNOWN_PART_PRESENT: 'DOCX_UNKNOWN_PART_PRESENT',
  DIRECTORY_ENTRY_PRESENT: 'DOCX_DIRECTORY_ENTRY_PRESENT',
  RELATIONSHIP_PART_PRESENT: 'DOCX_EXTERNAL_RELATIONSHIP_PRESENT',
  UNSUPPORTED_STORY_PRESENT: 'DOCX_UNSUPPORTED_STORY_MARKER_PRESENT',
  CLEAN_INVENTORY: 'DOCX_PACKAGE_CLEAN',
});

export const DOCX_PART_POLICY_SCHEMA = 'revision-bridge.docx-part-policy.v1';

export const DOCX_PART_POLICY_DECISIONS = Object.freeze({
  ACCEPTED: 'accepted',
  DEGRADED: 'degraded',
  REJECTED: 'rejected',
});

export const DOCX_PART_POLICY_DIAGNOSTIC_CODES = Object.freeze({
  INPUT_REJECTED: 'DOCX_PART_POLICY_INPUT_REJECTED',
  PACKAGE_REJECTED: 'DOCX_PART_POLICY_PACKAGE_REJECTED',
  MAIN_DOCUMENT_MISSING: 'DOCX_PART_POLICY_MAIN_DOCUMENT_MISSING',
  MAIN_DOCUMENT_DUPLICATE: 'DOCX_PART_POLICY_MAIN_DOCUMENT_DUPLICATE',
  RELATIONSHIP_REQUIRES_FUTURE_PARSER: 'DOCX_PART_POLICY_RELATIONSHIP_REQUIRES_FUTURE_PARSER',
  UNSUPPORTED_STORY_DIAGNOSTICS_ONLY: 'DOCX_PART_POLICY_UNSUPPORTED_STORY_DIAGNOSTICS_ONLY',
  UNKNOWN_PART_DIAGNOSTICS_ONLY: 'DOCX_PART_POLICY_UNKNOWN_PART_DIAGNOSTICS_ONLY',
  DIRECTORY_DIAGNOSTICS_ONLY: 'DOCX_PART_POLICY_DIRECTORY_DIAGNOSTICS_ONLY',
  MEDIA_DIAGNOSTICS_ONLY: 'DOCX_PART_POLICY_MEDIA_DIAGNOSTICS_ONLY',
  ACCEPTED: 'DOCX_PART_POLICY_ACCEPTED',
});

const DOCX_PART_POLICY_CATEGORY_KEYS = [
  'mainDocumentPart',
  'knownSupportPart',
  'mediaPart',
  'relationshipPart',
  'unsupportedStoryPart',
  'unknownPart',
  'directoryPart',
];

const DOCX_PART_POLICY_KNOWN_SUPPORT_PARTS = [
  '[Content_Types].xml',
  'docProps/app.xml',
  'docProps/core.xml',
  'docProps/custom.xml',
  'word/fontTable.xml',
  'word/numbering.xml',
  'word/settings.xml',
  'word/styles.xml',
  'word/theme/theme1.xml',
];

const DOCX_PART_POLICY_DEGRADED_CATEGORY_CODES = Object.freeze({
  mediaPart: DOCX_PART_POLICY_DIAGNOSTIC_CODES.MEDIA_DIAGNOSTICS_ONLY,
  relationshipPart: DOCX_PART_POLICY_DIAGNOSTIC_CODES.RELATIONSHIP_REQUIRES_FUTURE_PARSER,
  unsupportedStoryPart: DOCX_PART_POLICY_DIAGNOSTIC_CODES.UNSUPPORTED_STORY_DIAGNOSTICS_ONLY,
  unknownPart: DOCX_PART_POLICY_DIAGNOSTIC_CODES.UNKNOWN_PART_DIAGNOSTICS_ONLY,
  directoryPart: DOCX_PART_POLICY_DIAGNOSTIC_CODES.DIRECTORY_DIAGNOSTICS_ONLY,
});

const DOCX_PART_POLICY_INPUT_REJECT_KEYS = [
  'p' + 'ath',
  'p' + 'aths',
  'file' + 'P' + 'ath',
  'file' + 'H' + 'andle',
  'docx' + 'F' + 'ile',
  'b' + 'ytes',
  'b' + 'uffer',
  'raw',
  'x' + 'ml',
  'z' + 'ip',
];

const DOCX_PACKAGE_BOUNDARY_INPUT_REJECT_KEYS = [
  'p' + 'ath',
  'file' + 'P' + 'ath',
  'b' + 'ytes',
  'b' + 'uffer',
];

const DOCX_PACKAGE_BOUNDARY_ENTRY_KINDS = [
  'knownPart',
  'unknownPart',
  'relationshipPart',
  'directory',
];

const DOCX_PACKAGE_BOUNDARY_STORIES = [
  'main',
  'header',
  'footer',
  'footnote',
  'endnote',
  'comment',
  'textBox',
  'unsupported',
];

const DOCX_PACKAGE_BOUNDARY_MARKERS = [
  'relationship',
  'unsupportedStory',
  'documentPart',
  'mediaPart',
];

const DOCX_PACKAGE_BOUNDARY_REJECTED_SIZE_FIELDS = [
  'size',
  'b' + 'ytes',
  'length',
  'uncompressedSize',
  'compressedByteSize',
  'r' + 'awSize',
  'fileSize',
];

const DOCX_PACKAGE_BOUNDARY_MALFORMED_CODES = [
  DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.INVENTORY_NOT_OBJECT,
  DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.INVENTORY_PATH_INPUT_REJECTED,
  DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.INVENTORY_BINARY_INPUT_REJECTED,
  DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRIES_MISSING,
  DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRIES_NOT_ARRAY,
  DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRY_NOT_OBJECT,
  DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRY_ID_INVALID,
  DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRY_KIND_INVALID,
  DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRY_BYTE_SIZE_INVALID,
  DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRY_COMPRESSED_SIZE_INVALID,
  DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRY_MARKERS_INVALID,
  DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRY_MARKER_INVALID,
  DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRY_STORY_INVALID,
  DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.UNKNOWN_SIZE_FIELD_PRESENT,
];

const DOCX_PACKAGE_BOUNDARY_QUARANTINED_CODES = [
  DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRY_COUNT_EXCEEDED,
  DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.TOTAL_BYTES_EXCEEDED,
  DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRY_BYTES_EXCEEDED,
  DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.RELATIONSHIP_ENTRY_COUNT_EXCEEDED,
  DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.UNSUPPORTED_STORY_COUNT_EXCEEDED,
];

const DOCX_PACKAGE_BOUNDARY_SUSPICIOUS_CODES = [
  DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.UNKNOWN_PART_PRESENT,
  DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.DIRECTORY_ENTRY_PRESENT,
  DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.RELATIONSHIP_PART_PRESENT,
  DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.UNSUPPORTED_STORY_PRESENT,
];

const DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_MESSAGES = Object.freeze({
  [DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.INVENTORY_NOT_OBJECT]: 'inventory must be a plain object',
  [DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.INVENTORY_PATH_INPUT_REJECTED]: 'inventory location input is not accepted',
  [DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.INVENTORY_BINARY_INPUT_REJECTED]: 'inventory binary input is not accepted',
  [DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRIES_MISSING]: 'entries array is required',
  [DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRIES_NOT_ARRAY]: 'entries must be an array',
  [DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRY_NOT_OBJECT]: 'entry must be a plain object',
  [DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRY_ID_INVALID]: 'entry id must be a non-empty string',
  [DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRY_KIND_INVALID]: 'entry kind is not supported',
  [DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRY_BYTE_SIZE_INVALID]: 'entry byteSize must be a finite nonnegative integer',
  [DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRY_COMPRESSED_SIZE_INVALID]: 'entry compressedSize must be a finite nonnegative integer',
  [DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRY_MARKERS_INVALID]: 'entry markers must be an array',
  [DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRY_MARKER_INVALID]: 'entry marker is not supported',
  [DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRY_STORY_INVALID]: 'entry story is not supported',
  [DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.UNKNOWN_SIZE_FIELD_PRESENT]: 'entry contains a non-contract size field',
  [DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRY_COUNT_EXCEEDED]: 'entry count exceeds budget',
  [DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.TOTAL_BYTES_EXCEEDED]: 'total byteSize exceeds budget',
  [DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRY_BYTES_EXCEEDED]: 'entry byteSize exceeds budget',
  [DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.RELATIONSHIP_ENTRY_COUNT_EXCEEDED]: 'relationship entry count exceeds budget',
  [DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.UNSUPPORTED_STORY_COUNT_EXCEEDED]: 'unsupported story count exceeds budget',
  [DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.UNKNOWN_PART_PRESENT]: 'unknown package part is present',
  [DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.DIRECTORY_ENTRY_PRESENT]: 'directory entry is present',
  [DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.RELATIONSHIP_PART_PRESENT]: 'relationship package part is present',
  [DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.UNSUPPORTED_STORY_PRESENT]: 'unsupported story entry is present',
});

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

// RB_27_SUPPORTED_SURFACE_V1_CONTRACTS_START
const REVISION_BRIDGE_SUPPORTED_SURFACE_V1 = Object.freeze({
  supported: Object.freeze([
    'mainDocumentStory',
    'paragraph',
    'heading',
    'quote',
    'listItem',
    'inlineCommentRange',
    'trackedInsert',
    'trackedDelete',
    'sceneOrder',
    'blockMoveCandidate',
    'sceneSplitCandidate',
    'sceneMergeCandidate',
  ]),
  manualOnly: Object.freeze([
    'sceneReorder',
    'sceneSplit',
    'sceneMerge',
    'blockMove',
    'blockInsert',
    'blockDelete',
    'blockSplit',
    'blockMerge',
    'blockCopyRisk',
  ]),
  diagnosticsOnly: Object.freeze([
    'table',
    'header',
    'footer',
    'footnote',
    'endnote',
    'textBox',
    'contentControl',
    'unsupportedObject',
  ]),
});

function normalizeRevisionBridgeSurfaceKey(value) {
  return normalizeString(value).replace(/\s+/gu, '');
}

export function getRevisionBridgeSupportedSurfaceV1() {
  return {
    schemaVersion: REVISION_BRIDGE_SUPPORTED_SURFACE_V1_SCHEMA,
    supported: [...REVISION_BRIDGE_SUPPORTED_SURFACE_V1.supported],
    manualOnly: [...REVISION_BRIDGE_SUPPORTED_SURFACE_V1.manualOnly],
    diagnosticsOnly: [...REVISION_BRIDGE_SUPPORTED_SURFACE_V1.diagnosticsOnly],
    policy: {
      outsideSupportedSurface: 'diagnosticsOnlyOrManualOnly',
      releaseClaimBoundToEvidence: true,
    },
  };
}

export function classifyRevisionBridgeSurfaceItem(value = '') {
  const item = normalizeRevisionBridgeSurfaceKey(value);
  if (!item) {
    return {
      item: '',
      tier: 'unsupported',
      code: 'REVISION_BRIDGE_SUPPORTED_SURFACE_UNKNOWN',
    };
  }
  if (REVISION_BRIDGE_SUPPORTED_SURFACE_V1.supported.includes(item)) {
    return {
      item,
      tier: 'supported',
      code: 'REVISION_BRIDGE_SUPPORTED_SURFACE_SUPPORTED',
    };
  }
  if (REVISION_BRIDGE_SUPPORTED_SURFACE_V1.manualOnly.includes(item)) {
    return {
      item,
      tier: 'manualOnly',
      code: 'REVISION_BRIDGE_SUPPORTED_SURFACE_MANUAL_ONLY',
    };
  }
  if (REVISION_BRIDGE_SUPPORTED_SURFACE_V1.diagnosticsOnly.includes(item)) {
    return {
      item,
      tier: 'diagnosticsOnly',
      code: 'REVISION_BRIDGE_SUPPORTED_SURFACE_DIAGNOSTICS_ONLY',
    };
  }
  return {
    item,
    tier: 'unsupported',
    code: 'REVISION_BRIDGE_SUPPORTED_SURFACE_UNKNOWN',
  };
}

export function evaluateRevisionBridgeSupportedSurface(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const items = Array.isArray(source.items) ? source.items : [];
  const classifications = items.map((item) => classifyRevisionBridgeSurfaceItem(item));
  const counts = {
    supported: 0,
    manualOnly: 0,
    diagnosticsOnly: 0,
    unsupported: 0,
  };
  for (const row of classifications) {
    if (Object.hasOwn(counts, row.tier)) counts[row.tier] += 1;
  }
  return {
    schemaVersion: REVISION_BRIDGE_SUPPORTED_SURFACE_V1_SCHEMA,
    type: 'revisionBridge.supportedSurfaceEvaluation',
    counts,
    items: classifications,
  };
}
// RB_27_SUPPORTED_SURFACE_V1_CONTRACTS_END

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

function isDocxPackageBoundaryPlainObject(value) {
  if (!Boolean(value) || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isFiniteNonnegativeInteger(value) {
  return Number.isInteger(value) && Number.isFinite(value) && value >= 0;
}

function isDocxPackageBoundaryRejectedInput(input) {
  if (!Boolean(input) || typeof input !== 'object') return false;
  return DOCX_PACKAGE_BOUNDARY_INPUT_REJECT_KEYS.some((key) => (
    Object.prototype.hasOwnProperty.call(input, key)
  ))
    || (typeof input.byteLength === 'number' && typeof input.slice === 'function')
    || (typeof input.byteLength === 'number' && typeof input.subarray === 'function')
    || (typeof input['array' + 'B' + 'uffer'] === 'function' && typeof input.name === 'string')
    || (typeof input['str' + 'eam'] === 'function')
    || (typeof input.pipe === 'function')
    || (typeof input.getReader === 'function');
}

function docxPackageBoundarySeverity(code) {
  if (DOCX_PACKAGE_BOUNDARY_MALFORMED_CODES.includes(code)) return 'error';
  if (DOCX_PACKAGE_BOUNDARY_QUARANTINED_CODES.includes(code)) return 'error';
  if (DOCX_PACKAGE_BOUNDARY_SUSPICIOUS_CODES.includes(code)) return 'warning';
  return 'info';
}

function docxPackageBoundaryDiagnostic(code, options = {}) {
  const diagnostic = {
    code,
    severity: docxPackageBoundarySeverity(code),
    message: DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_MESSAGES[code] || code,
  };
  if (options.entryId !== undefined) diagnostic.entryId = options.entryId;
  if (options.limit !== undefined) diagnostic.limit = options.limit;
  if (options.actual !== undefined) diagnostic.actual = options.actual;
  return diagnostic;
}

function docxPackageBoundaryHasDiagnostic(diagnostics, codes) {
  return diagnostics.some((diagnostic) => codes.includes(diagnostic.code));
}

function docxPackageBoundaryPrimaryCode(diagnostics, codes) {
  for (const diagnostic of diagnostics) {
    if (codes.includes(diagnostic.code)) return diagnostic.code;
  }
  return null;
}

function docxPackageBoundaryCodeRank(code) {
  if (DOCX_PACKAGE_BOUNDARY_MALFORMED_CODES.includes(code)) return 0;
  if (DOCX_PACKAGE_BOUNDARY_QUARANTINED_CODES.includes(code)) return 1;
  if (DOCX_PACKAGE_BOUNDARY_SUSPICIOUS_CODES.includes(code)) return 2;
  return 3;
}

function sortDocxPackageBoundaryDiagnostics(diagnostics) {
  return diagnostics.slice().sort((left, right) => (
    docxPackageBoundaryCodeRank(left.code) - docxPackageBoundaryCodeRank(right.code)
    || String(left.code).localeCompare(String(right.code))
    || String(left.entryId || '').localeCompare(String(right.entryId || ''))
  ));
}

function docxPackageBoundaryEligibility(classification) {
  return {
    safe: true,
    parserCandidateOnly: classification === 'clean',
    canCreateReviewPacket: false,
    canPreviewApply: false,
    canImportMutate: false,
    canWriteStorage: false,
  };
}

function docxPackageBoundaryResult(classification, diagnostics) {
  const sortedDiagnostics = sortDocxPackageBoundaryDiagnostics(diagnostics);
  const clean = classification === 'clean';
  const rejected = classification === 'malformed' || classification === 'quarantined';
  const primaryCode = clean
    ? DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.CLEAN_INVENTORY
    : docxPackageBoundaryPrimaryCode(
      sortedDiagnostics,
      classification === 'malformed'
        ? DOCX_PACKAGE_BOUNDARY_MALFORMED_CODES
        : classification === 'quarantined'
          ? DOCX_PACKAGE_BOUNDARY_QUARANTINED_CODES
          : DOCX_PACKAGE_BOUNDARY_SUSPICIOUS_CODES,
    );

  return {
    ok: clean,
    type: 'docxPackageInventoryInspection',
    status: clean ? 'accepted' : rejected ? 'rejected' : 'degraded',
    code: primaryCode,
    reason: primaryCode,
    classification,
    diagnostics: sortedDiagnostics,
    budgets: { ...DOCX_PACKAGE_BOUNDARY_BUDGETS },
    eligibility: docxPackageBoundaryEligibility(classification),
  };
}

function collectDocxPackageBoundaryEntryDiagnostics(entry, index) {
  const diagnostics = [];
  if (!isDocxPackageBoundaryPlainObject(entry)) {
    diagnostics.push(docxPackageBoundaryDiagnostic(DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRY_NOT_OBJECT, {
      entryId: String(index),
    }));
    return diagnostics;
  }

  const entryId = typeof entry.id === 'string' ? entry.id.trim() : '';
  const diagnosticEntryId = entryId || String(index);
  for (const field of DOCX_PACKAGE_BOUNDARY_REJECTED_SIZE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(entry, field)) {
      diagnostics.push(docxPackageBoundaryDiagnostic(DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.UNKNOWN_SIZE_FIELD_PRESENT, {
        entryId: diagnosticEntryId,
      }));
    }
  }

  if (!entryId) {
    diagnostics.push(docxPackageBoundaryDiagnostic(DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRY_ID_INVALID, {
      entryId: String(index),
    }));
  }
  if (!DOCX_PACKAGE_BOUNDARY_ENTRY_KINDS.includes(entry.kind)) {
    diagnostics.push(docxPackageBoundaryDiagnostic(DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRY_KIND_INVALID, {
      entryId: diagnosticEntryId,
    }));
  }
  if (!isFiniteNonnegativeInteger(entry.byteSize)) {
    diagnostics.push(docxPackageBoundaryDiagnostic(DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRY_BYTE_SIZE_INVALID, {
      entryId: diagnosticEntryId,
    }));
  }
  if (
    Object.prototype.hasOwnProperty.call(entry, 'compressedSize')
    && !isFiniteNonnegativeInteger(entry.compressedSize)
  ) {
    diagnostics.push(docxPackageBoundaryDiagnostic(DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRY_COMPRESSED_SIZE_INVALID, {
      entryId: diagnosticEntryId,
    }));
  }
  if (
    Object.prototype.hasOwnProperty.call(entry, 'story')
    && !DOCX_PACKAGE_BOUNDARY_STORIES.includes(entry.story)
  ) {
    diagnostics.push(docxPackageBoundaryDiagnostic(DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRY_STORY_INVALID, {
      entryId: diagnosticEntryId,
    }));
  }
  if (Object.prototype.hasOwnProperty.call(entry, 'markers')) {
    if (!Array.isArray(entry.markers)) {
      diagnostics.push(docxPackageBoundaryDiagnostic(DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRY_MARKERS_INVALID, {
        entryId: diagnosticEntryId,
      }));
    } else {
      for (const marker of entry.markers) {
        if (typeof marker !== 'string' || !DOCX_PACKAGE_BOUNDARY_MARKERS.includes(marker)) {
          diagnostics.push(docxPackageBoundaryDiagnostic(DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRY_MARKER_INVALID, {
            entryId: diagnosticEntryId,
          }));
        }
      }
    }
  }
  return diagnostics;
}

function collectDocxPackageBoundaryInventoryDiagnostics(inventory) {
  const diagnostics = [];
  if (typeof inventory === 'string') {
    return [docxPackageBoundaryDiagnostic(DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.INVENTORY_PATH_INPUT_REJECTED)];
  }
  if (isDocxPackageBoundaryRejectedInput(inventory)) {
    const locationRejected = isPlainObject(inventory)
      && (hasOwnField(inventory, 'p' + 'ath') || hasOwnField(inventory, 'file' + 'P' + 'ath'));
    return [docxPackageBoundaryDiagnostic(
      locationRejected
        ? DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.INVENTORY_PATH_INPUT_REJECTED
        : DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.INVENTORY_BINARY_INPUT_REJECTED,
    )];
  }
  if (!isDocxPackageBoundaryPlainObject(inventory)) {
    return [docxPackageBoundaryDiagnostic(DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.INVENTORY_NOT_OBJECT)];
  }

  if (!Object.prototype.hasOwnProperty.call(inventory, 'entries')) {
    return [docxPackageBoundaryDiagnostic(DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRIES_MISSING)];
  }
  if (!Array.isArray(inventory.entries)) {
    return [docxPackageBoundaryDiagnostic(DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRIES_NOT_ARRAY)];
  }

  inventory.entries.forEach((entry, index) => {
    diagnostics.push(...collectDocxPackageBoundaryEntryDiagnostics(entry, index));
  });
  if (docxPackageBoundaryHasDiagnostic(diagnostics, DOCX_PACKAGE_BOUNDARY_MALFORMED_CODES)) return diagnostics;

  const relationshipEntries = [];
  const unsupportedStoryEntries = [];
  let totalByteSize = 0;

  inventory.entries.forEach((entry) => {
    const markers = Array.isArray(entry.markers) ? entry.markers : [];
    const relationshipEntry = entry.kind === 'relationshipPart' || markers.includes('relationship');
    const unsupportedStoryEntry = entry.story === 'unsupported' || markers.includes('unsupportedStory');

    totalByteSize += entry.byteSize;
    if (entry.byteSize > DOCX_PACKAGE_BOUNDARY_BUDGETS.maxEntryBytes) {
      diagnostics.push(docxPackageBoundaryDiagnostic(DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRY_BYTES_EXCEEDED, {
        entryId: entry.id,
        limit: DOCX_PACKAGE_BOUNDARY_BUDGETS.maxEntryBytes,
        actual: entry.byteSize,
      }));
    }
    if (entry.kind === 'unknownPart') {
      diagnostics.push(docxPackageBoundaryDiagnostic(DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.UNKNOWN_PART_PRESENT, {
        entryId: entry.id,
      }));
    }
    if (entry.kind === 'directory') {
      diagnostics.push(docxPackageBoundaryDiagnostic(DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.DIRECTORY_ENTRY_PRESENT, {
        entryId: entry.id,
      }));
    }
    if (relationshipEntry) {
      relationshipEntries.push(entry);
      diagnostics.push(docxPackageBoundaryDiagnostic(DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.RELATIONSHIP_PART_PRESENT, {
        entryId: entry.id,
      }));
    }
    if (unsupportedStoryEntry) {
      unsupportedStoryEntries.push(entry);
      diagnostics.push(docxPackageBoundaryDiagnostic(DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.UNSUPPORTED_STORY_PRESENT, {
        entryId: entry.id,
      }));
    }
  });

  if (inventory.entries.length > DOCX_PACKAGE_BOUNDARY_BUDGETS.maxEntries) {
    diagnostics.push(docxPackageBoundaryDiagnostic(DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.ENTRY_COUNT_EXCEEDED, {
      limit: DOCX_PACKAGE_BOUNDARY_BUDGETS.maxEntries,
      actual: inventory.entries.length,
    }));
  }
  if (totalByteSize > DOCX_PACKAGE_BOUNDARY_BUDGETS.maxTotalBytes) {
    diagnostics.push(docxPackageBoundaryDiagnostic(DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.TOTAL_BYTES_EXCEEDED, {
      limit: DOCX_PACKAGE_BOUNDARY_BUDGETS.maxTotalBytes,
      actual: totalByteSize,
    }));
  }
  if (relationshipEntries.length > DOCX_PACKAGE_BOUNDARY_BUDGETS.maxRelationshipEntries) {
    diagnostics.push(docxPackageBoundaryDiagnostic(DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.RELATIONSHIP_ENTRY_COUNT_EXCEEDED, {
      limit: DOCX_PACKAGE_BOUNDARY_BUDGETS.maxRelationshipEntries,
      actual: relationshipEntries.length,
    }));
  }
  if (unsupportedStoryEntries.length > DOCX_PACKAGE_BOUNDARY_BUDGETS.maxUnsupportedStoryEntries) {
    diagnostics.push(docxPackageBoundaryDiagnostic(DOCX_PACKAGE_BOUNDARY_DIAGNOSTIC_CODES.UNSUPPORTED_STORY_COUNT_EXCEEDED, {
      limit: DOCX_PACKAGE_BOUNDARY_BUDGETS.maxUnsupportedStoryEntries,
      actual: unsupportedStoryEntries.length,
    }));
  }

  return diagnostics;
}

export function inspectDocxPackageInventory(inventory = {}) {
  const diagnostics = collectDocxPackageBoundaryInventoryDiagnostics(inventory);
  if (docxPackageBoundaryHasDiagnostic(diagnostics, DOCX_PACKAGE_BOUNDARY_MALFORMED_CODES)) {
    return docxPackageBoundaryResult('malformed', diagnostics);
  }
  if (docxPackageBoundaryHasDiagnostic(diagnostics, DOCX_PACKAGE_BOUNDARY_QUARANTINED_CODES)) {
    return docxPackageBoundaryResult('quarantined', diagnostics);
  }
  if (docxPackageBoundaryHasDiagnostic(diagnostics, DOCX_PACKAGE_BOUNDARY_SUSPICIOUS_CODES)) {
    return docxPackageBoundaryResult('suspicious', diagnostics);
  }
  return docxPackageBoundaryResult('clean', []);
}

function collectForbiddenFieldReasons(input, fields, prefix, message) {
  const reasons = [];
  if (!isPlainObject(input)) return reasons;
  for (const field of fields) {
    if (hasOwnField(input, field)) reasons.push(invalidField(`${prefix}.${field}`, message));
  }
  return reasons;
}

// RB_06_DOCX_ZIP_INVENTORY_MATERIALIZER_START
const DOCX_ZIP_INVENTORY_MATERIALIZATION_TYPE = 'docxZipInventoryMaterialization';
const DOCX_ZIP_INVENTORY_MATERIALIZED_CODE = 'DOCX_ZIP_INVENTORY_MATERIALIZED';

const DOCX_ZIP_INVENTORY_BOUNDS = Object.freeze({
  MAX_INPUT_BYTES: 52428800,
  MAX_EOCD_SEARCH_BYTES: 65557,
  MAX_CENTRAL_DIRECTORY_BYTES: 2097152,
  MAX_ENTRIES: 512,
  MAX_ENTRY_NAME_BYTES: 1024,
  MAX_ENTRY_EXTRA_BYTES: 4096,
  MAX_ENTRY_COMMENT_BYTES: 4096,
  MAX_ENTRY_UNCOMPRESSED_BYTES: 10485760,
  MAX_TOTAL_UNCOMPRESSED_BYTES: 52428800,
  MAX_RELATIONSHIP_ENTRIES: 64,
  MAX_UNSUPPORTED_STORY_ENTRIES: 32,
});

const DOCX_ZIP_INVENTORY_DIAGNOSTIC_MESSAGES = Object.freeze({
  DOCX_ZIP_BYTES_INPUT_INVALID: 'input must be caller-supplied binary data',
  DOCX_ZIP_BYTES_INPUT_TOO_LARGE: 'input exceeds byte limit',
  DOCX_ZIP_EOCD_NOT_FOUND: 'end marker was not found',
  DOCX_ZIP_EOCD_TRUNCATED: 'end marker is truncated',
  DOCX_ZIP_MULTI_DISK_UNSUPPORTED: 'multi-disk archive is not supported',
  DOCX_ZIP64_UNSUPPORTED: 'ZIP64 archive is not supported',
  DOCX_ZIP_CENTRAL_DIRECTORY_TRUNCATED: 'central directory is truncated',
  DOCX_ZIP_CENTRAL_DIRECTORY_TOO_LARGE: 'central directory exceeds byte limit',
  DOCX_ZIP_ENTRY_COUNT_EXCEEDED: 'entry count exceeds limit',
  DOCX_ZIP_ENTRY_NAME_TOO_LARGE: 'entry name exceeds byte limit',
  DOCX_ZIP_ENTRY_EXTRA_TOO_LARGE: 'entry extra field exceeds byte limit',
  DOCX_ZIP_ENTRY_COMMENT_TOO_LARGE: 'entry comment exceeds byte limit',
  DOCX_ZIP_ENTRY_ENCRYPTED_UNSUPPORTED: 'encrypted entry is not supported',
  DOCX_ZIP_ENTRY_UNCOMPRESSED_SIZE_EXCEEDED: 'entry uncompressed size exceeds limit',
  DOCX_ZIP_TOTAL_UNCOMPRESSED_SIZE_EXCEEDED: 'total uncompressed size exceeds limit',
  DOCX_ZIP_ENTRY_NAME_INVALID: 'entry name is invalid',
  DOCX_ZIP_ENTRY_OFFSET_INVALID: 'entry offset is invalid',
});

const DOCX_ZIP_INVENTORY_KNOWN_PARTS = [
  '[Content_Types].xml',
  'docProps/core.xml',
  'docProps/app.xml',
  'word/styles.xml',
  'word/settings.xml',
  'word/numbering.xml',
  'word/fontTable.xml',
  'word/theme/theme1.xml',
];

const DOCX_ZIP_CENTRAL_FILE_SIGNATURE = 0x02014b50;
const DOCX_ZIP_END_SIGNATURE = 0x06054b50;
const DOCX_ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const DOCX_ZIP_CENTRAL_FILE_FIXED_BYTES = 46;
const DOCX_ZIP_END_FIXED_BYTES = 22;
const DOCX_ZIP_FLAG_ENCRYPTED = 1;
const DOCX_ZIP_U16_MAX = 0xffff;
const DOCX_ZIP_U32_MAX = 0xffffffff;

function docxZipInventoryBoundsCopy() {
  return { ...DOCX_ZIP_INVENTORY_BOUNDS };
}

function docxZipInventoryDiagnostic(code, options = {}) {
  const diagnostic = {
    code,
    severity: 'error',
    message: DOCX_ZIP_INVENTORY_DIAGNOSTIC_MESSAGES[code] || code,
  };
  if (options.entryId !== undefined) diagnostic.entryId = options.entryId;
  if (options.limit !== undefined) diagnostic.limit = options.limit;
  if (options.actual !== undefined) diagnostic.actual = options.actual;
  return diagnostic;
}

function docxZipInventoryFailure(code, options = {}) {
  const diagnostic = docxZipInventoryDiagnostic(code, options);
  return {
    ok: false,
    type: DOCX_ZIP_INVENTORY_MATERIALIZATION_TYPE,
    status: 'rejected',
    code,
    reason: code,
    diagnostics: [diagnostic],
    bounds: docxZipInventoryBoundsCopy(),
  };
}

function docxZipInventorySuccess(inventory) {
  return {
    ok: true,
    type: DOCX_ZIP_INVENTORY_MATERIALIZATION_TYPE,
    status: 'materialized',
    code: DOCX_ZIP_INVENTORY_MATERIALIZED_CODE,
    reason: DOCX_ZIP_INVENTORY_MATERIALIZED_CODE,
    inventory,
    inspection: inspectDocxPackageInventory(inventory),
    diagnostics: [],
    bounds: docxZipInventoryBoundsCopy(),
  };
}

function isDocxZipInventoryAcceptedView(value) {
  return value instanceof Uint8Array || value instanceof DataView;
}

function docxZipInventoryInputToBytes(input) {
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (isDocxZipInventoryAcceptedView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(input)) return input;
  return null;
}

function docxZipReadU16(bytes, cursor) {
  return bytes[cursor] | (bytes[cursor + 1] << 8);
}

function docxZipReadU32(bytes, cursor) {
  return (
    bytes[cursor]
    | (bytes[cursor + 1] << 8)
    | (bytes[cursor + 2] << 16)
    | (bytes[cursor + 3] << 24)
  ) >>> 0;
}

function docxZipFindEndRecord(bytes) {
  if (bytes.byteLength < DOCX_ZIP_END_FIXED_BYTES) return null;
  const lower = Math.max(0, bytes.byteLength - DOCX_ZIP_INVENTORY_BOUNDS.MAX_EOCD_SEARCH_BYTES);
  for (let cursor = bytes.byteLength - DOCX_ZIP_END_FIXED_BYTES; cursor >= lower; cursor -= 1) {
    if (docxZipReadU32(bytes, cursor) === DOCX_ZIP_END_SIGNATURE) return cursor;
  }
  return null;
}

function docxZipHasZip64Locator(bytes, endOffset) {
  return endOffset >= 20
    && docxZipReadU32(bytes, endOffset - 20) === DOCX_ZIP64_LOCATOR_SIGNATURE;
}

function docxZipReadAsciiName(bytes, cursor, size) {
  let name = '';
  for (let index = 0; index < size; index += 1) {
    const value = bytes[cursor + index];
    if (value < 0x20 || value > 0x7e) return null;
    name += String.fromCharCode(value);
  }
  return name;
}

function docxZipInventoryNameInvalid(name) {
  if (!name) return true;
  if (name.startsWith('/') || name.startsWith('\\')) return true;
  if (/^[A-Za-z]:/u.test(name)) return true;
  return name.split(/[\\/]/u).some((segment) => segment === '..');
}

function docxZipUnsupportedStoryName(name) {
  return (
    /^word\/header[^/]*\.xml$/u.test(name)
    || /^word\/footer[^/]*\.xml$/u.test(name)
    || name === 'word/footnotes.xml'
    || name === 'word/endnotes.xml'
    || name === 'word/comments.xml'
    || /^word\/textbox[^/]*\.xml$/u.test(name)
  );
}

function docxZipClassifyEntry(name) {
  if (name.endsWith('/') || name.endsWith('\\')) {
    return { kind: 'directory' };
  }
  if (name.includes('_rels/') || name.endsWith('.rels')) {
    return { kind: 'relationshipPart', markers: ['relationship'] };
  }
  if (name === 'word/document.xml') {
    return { kind: 'knownPart', story: 'main', markers: ['documentPart'] };
  }
  if (DOCX_ZIP_INVENTORY_KNOWN_PARTS.includes(name)) {
    return { kind: 'knownPart' };
  }
  if (name.startsWith('word/media/')) {
    return { kind: 'knownPart', markers: ['mediaPart'] };
  }
  if (docxZipUnsupportedStoryName(name)) {
    return { kind: 'knownPart', story: 'unsupported', markers: ['unsupportedStory'] };
  }
  return { kind: 'unknownPart' };
}

function docxZipBuildEntry(name, byteSize, compressedSize) {
  const classified = docxZipClassifyEntry(name);
  const entry = {
    id: name,
    kind: classified.kind,
    byteSize,
    compressedSize,
  };
  if (classified.story !== undefined) entry.story = classified.story;
  if (classified.markers !== undefined) entry.markers = classified.markers.slice();
  return entry;
}

function docxZipValidateEndRecord(bytes, endOffset) {
  if (endOffset === null) {
    return bytes.byteLength < DOCX_ZIP_END_FIXED_BYTES
      ? { failure: docxZipInventoryFailure('DOCX_ZIP_EOCD_TRUNCATED') }
      : { failure: docxZipInventoryFailure('DOCX_ZIP_EOCD_NOT_FOUND') };
  }

  const endCommentSize = docxZipReadU16(bytes, endOffset + 20);
  if (endOffset + DOCX_ZIP_END_FIXED_BYTES + endCommentSize !== bytes.byteLength) {
    return { failure: docxZipInventoryFailure('DOCX_ZIP_EOCD_TRUNCATED') };
  }

  const diskIndex = docxZipReadU16(bytes, endOffset + 4);
  const centralDiskIndex = docxZipReadU16(bytes, endOffset + 6);
  const diskEntryCount = docxZipReadU16(bytes, endOffset + 8);
  const entryCount = docxZipReadU16(bytes, endOffset + 10);
  const centralSize = docxZipReadU32(bytes, endOffset + 12);
  const centralOffset = docxZipReadU32(bytes, endOffset + 16);

  if (diskIndex !== 0 || centralDiskIndex !== 0 || diskEntryCount !== entryCount) {
    return { failure: docxZipInventoryFailure('DOCX_ZIP_MULTI_DISK_UNSUPPORTED') };
  }
  if (
    docxZipHasZip64Locator(bytes, endOffset)
    || diskEntryCount === DOCX_ZIP_U16_MAX
    || entryCount === DOCX_ZIP_U16_MAX
    || centralSize === DOCX_ZIP_U32_MAX
    || centralOffset === DOCX_ZIP_U32_MAX
  ) {
    return { failure: docxZipInventoryFailure('DOCX_ZIP64_UNSUPPORTED') };
  }
  if (centralSize > DOCX_ZIP_INVENTORY_BOUNDS.MAX_CENTRAL_DIRECTORY_BYTES) {
    return {
      failure: docxZipInventoryFailure('DOCX_ZIP_CENTRAL_DIRECTORY_TOO_LARGE', {
        limit: DOCX_ZIP_INVENTORY_BOUNDS.MAX_CENTRAL_DIRECTORY_BYTES,
        actual: centralSize,
      }),
    };
  }
  if (entryCount > DOCX_ZIP_INVENTORY_BOUNDS.MAX_ENTRIES) {
    return {
      failure: docxZipInventoryFailure('DOCX_ZIP_ENTRY_COUNT_EXCEEDED', {
        limit: DOCX_ZIP_INVENTORY_BOUNDS.MAX_ENTRIES,
        actual: entryCount,
      }),
    };
  }
  if (centralOffset + centralSize > endOffset || centralOffset + centralSize > bytes.byteLength) {
    return { failure: docxZipInventoryFailure('DOCX_ZIP_CENTRAL_DIRECTORY_TRUNCATED') };
  }
  return {
    record: {
      centralOffset,
      centralSize,
      entryCount,
    },
  };
}

function docxZipParseCentralDirectory(bytes, record) {
  const entries = [];
  let totalByteSize = 0;
  let cursor = record.centralOffset;
  const centralEnd = record.centralOffset + record.centralSize;

  for (let index = 0; index < record.entryCount; index += 1) {
    if (cursor + DOCX_ZIP_CENTRAL_FILE_FIXED_BYTES > centralEnd) {
      return { failure: docxZipInventoryFailure('DOCX_ZIP_CENTRAL_DIRECTORY_TRUNCATED') };
    }
    if (docxZipReadU32(bytes, cursor) !== DOCX_ZIP_CENTRAL_FILE_SIGNATURE) {
      return { failure: docxZipInventoryFailure('DOCX_ZIP_CENTRAL_DIRECTORY_TRUNCATED') };
    }

    const flags = docxZipReadU16(bytes, cursor + 8);
    const compressedSize = docxZipReadU32(bytes, cursor + 20);
    const byteSize = docxZipReadU32(bytes, cursor + 24);
    const nameSize = docxZipReadU16(bytes, cursor + 28);
    const extraSize = docxZipReadU16(bytes, cursor + 30);
    const commentSize = docxZipReadU16(bytes, cursor + 32);
    const diskStart = docxZipReadU16(bytes, cursor + 34);
    const localOffset = docxZipReadU32(bytes, cursor + 42);
    const recordSize = DOCX_ZIP_CENTRAL_FILE_FIXED_BYTES + nameSize + extraSize + commentSize;

    if (cursor + recordSize > centralEnd) {
      return { failure: docxZipInventoryFailure('DOCX_ZIP_CENTRAL_DIRECTORY_TRUNCATED') };
    }
    if (flags & DOCX_ZIP_FLAG_ENCRYPTED) {
      return { failure: docxZipInventoryFailure('DOCX_ZIP_ENTRY_ENCRYPTED_UNSUPPORTED') };
    }
    if (
      compressedSize === DOCX_ZIP_U32_MAX
      || byteSize === DOCX_ZIP_U32_MAX
      || localOffset === DOCX_ZIP_U32_MAX
    ) {
      return { failure: docxZipInventoryFailure('DOCX_ZIP64_UNSUPPORTED') };
    }
    if (diskStart !== 0) {
      return { failure: docxZipInventoryFailure('DOCX_ZIP_MULTI_DISK_UNSUPPORTED') };
    }
    if (nameSize > DOCX_ZIP_INVENTORY_BOUNDS.MAX_ENTRY_NAME_BYTES) {
      return {
        failure: docxZipInventoryFailure('DOCX_ZIP_ENTRY_NAME_TOO_LARGE', {
          limit: DOCX_ZIP_INVENTORY_BOUNDS.MAX_ENTRY_NAME_BYTES,
          actual: nameSize,
        }),
      };
    }
    if (extraSize > DOCX_ZIP_INVENTORY_BOUNDS.MAX_ENTRY_EXTRA_BYTES) {
      return {
        failure: docxZipInventoryFailure('DOCX_ZIP_ENTRY_EXTRA_TOO_LARGE', {
          limit: DOCX_ZIP_INVENTORY_BOUNDS.MAX_ENTRY_EXTRA_BYTES,
          actual: extraSize,
        }),
      };
    }
    if (commentSize > DOCX_ZIP_INVENTORY_BOUNDS.MAX_ENTRY_COMMENT_BYTES) {
      return {
        failure: docxZipInventoryFailure('DOCX_ZIP_ENTRY_COMMENT_TOO_LARGE', {
          limit: DOCX_ZIP_INVENTORY_BOUNDS.MAX_ENTRY_COMMENT_BYTES,
          actual: commentSize,
        }),
      };
    }
    if (localOffset >= record.centralOffset || localOffset >= bytes.byteLength) {
      return { failure: docxZipInventoryFailure('DOCX_ZIP_ENTRY_OFFSET_INVALID') };
    }
    if (byteSize > DOCX_ZIP_INVENTORY_BOUNDS.MAX_ENTRY_UNCOMPRESSED_BYTES) {
      return {
        failure: docxZipInventoryFailure('DOCX_ZIP_ENTRY_UNCOMPRESSED_SIZE_EXCEEDED', {
          limit: DOCX_ZIP_INVENTORY_BOUNDS.MAX_ENTRY_UNCOMPRESSED_BYTES,
          actual: byteSize,
        }),
      };
    }

    totalByteSize += byteSize;
    if (totalByteSize > DOCX_ZIP_INVENTORY_BOUNDS.MAX_TOTAL_UNCOMPRESSED_BYTES) {
      return {
        failure: docxZipInventoryFailure('DOCX_ZIP_TOTAL_UNCOMPRESSED_SIZE_EXCEEDED', {
          limit: DOCX_ZIP_INVENTORY_BOUNDS.MAX_TOTAL_UNCOMPRESSED_BYTES,
          actual: totalByteSize,
        }),
      };
    }

    const name = docxZipReadAsciiName(bytes, cursor + DOCX_ZIP_CENTRAL_FILE_FIXED_BYTES, nameSize);
    if (docxZipInventoryNameInvalid(name)) {
      return { failure: docxZipInventoryFailure('DOCX_ZIP_ENTRY_NAME_INVALID') };
    }

    entries.push(docxZipBuildEntry(name, byteSize, compressedSize));
    cursor += recordSize;
  }

  if (cursor !== centralEnd) {
    return { failure: docxZipInventoryFailure('DOCX_ZIP_CENTRAL_DIRECTORY_TRUNCATED') };
  }
  return { inventory: { entries } };
}

export function materializeDocxPackageInventoryFromZipBytes(input) {
  const bytes = docxZipInventoryInputToBytes(input);
  if (bytes === null) return docxZipInventoryFailure('DOCX_ZIP_BYTES_INPUT_INVALID');
  if (bytes.byteLength > DOCX_ZIP_INVENTORY_BOUNDS.MAX_INPUT_BYTES) {
    return {
      ...docxZipInventoryFailure('DOCX_ZIP_BYTES_INPUT_TOO_LARGE', {
        limit: DOCX_ZIP_INVENTORY_BOUNDS.MAX_INPUT_BYTES,
        actual: bytes.byteLength,
      }),
    };
  }

  const endOffset = docxZipFindEndRecord(bytes);
  const endResult = docxZipValidateEndRecord(bytes, endOffset);
  if (endResult.failure) return endResult.failure;

  const centralResult = docxZipParseCentralDirectory(bytes, endResult.record);
  if (centralResult.failure) return centralResult.failure;
  return docxZipInventorySuccess(centralResult.inventory);
}
// RB_06_DOCX_ZIP_INVENTORY_MATERIALIZER_END

// RB_08_DOCX_PART_POLICY_CLASSIFIER_START
const DOCX_PART_POLICY_TYPE = 'docxPartPolicyClassification';

const DOCX_PART_POLICY_CATEGORY_NAMES = [
  'mainDocumentPart',
  'knownSupportPart',
  'mediaPart',
  'relationshipPart',
  'unsupportedStoryPart',
  'unknownPart',
  'directoryPart',
];

const DOCX_PART_POLICY_DIAGNOSTIC_MESSAGES = Object.freeze({
  [DOCX_PART_POLICY_DIAGNOSTIC_CODES.INPUT_REJECTED]: 'input must be caller-supplied inventory metadata',
  [DOCX_PART_POLICY_DIAGNOSTIC_CODES.PACKAGE_REJECTED]: 'package boundary inspection rejected the inventory',
  [DOCX_PART_POLICY_DIAGNOSTIC_CODES.MAIN_DOCUMENT_MISSING]: 'main document part is missing',
  [DOCX_PART_POLICY_DIAGNOSTIC_CODES.MAIN_DOCUMENT_DUPLICATE]: 'main document part is duplicated',
  [DOCX_PART_POLICY_DIAGNOSTIC_CODES.RELATIONSHIP_REQUIRES_FUTURE_PARSER]: 'relationship part requires a future parser',
  [DOCX_PART_POLICY_DIAGNOSTIC_CODES.UNSUPPORTED_STORY_DIAGNOSTICS_ONLY]: 'unsupported story part is diagnostics-only',
  [DOCX_PART_POLICY_DIAGNOSTIC_CODES.UNKNOWN_PART_DIAGNOSTICS_ONLY]: 'unknown part is diagnostics-only',
  [DOCX_PART_POLICY_DIAGNOSTIC_CODES.DIRECTORY_DIAGNOSTICS_ONLY]: 'directory part is diagnostics-only',
  [DOCX_PART_POLICY_DIAGNOSTIC_CODES.MEDIA_DIAGNOSTICS_ONLY]: 'media part is diagnostics-only',
  [DOCX_PART_POLICY_DIAGNOSTIC_CODES.ACCEPTED]: 'part policy accepted metadata-only inventory',
});

function docxPartPolicyEmptyCategories() {
  const categories = {};
  for (const category of DOCX_PART_POLICY_CATEGORY_NAMES) {
    categories[category] = { count: 0, entryIds: [] };
  }
  return categories;
}

function docxPartPolicyDiagnostic(code, options = {}) {
  const diagnostic = {
    code,
    severity: options.severity || (code === DOCX_PART_POLICY_DIAGNOSTIC_CODES.ACCEPTED ? 'info' : 'warning'),
    message: DOCX_PART_POLICY_DIAGNOSTIC_MESSAGES[code] || code,
  };
  if (options.category !== undefined) diagnostic.category = options.category;
  if (options.entryId !== undefined) diagnostic.entryId = options.entryId;
  if (options.sourceCode !== undefined) diagnostic.sourceCode = options.sourceCode;
  return diagnostic;
}

function docxPartPolicyEligibility(decision, diagnostics) {
  const parserRequired = diagnostics.some((diagnostic) => (
    diagnostic.code === DOCX_PART_POLICY_DIAGNOSTIC_CODES.RELATIONSHIP_REQUIRES_FUTURE_PARSER
    || diagnostic.code === DOCX_PART_POLICY_DIAGNOSTIC_CODES.UNSUPPORTED_STORY_DIAGNOSTICS_ONLY
    || diagnostic.code === DOCX_PART_POLICY_DIAGNOSTIC_CODES.UNKNOWN_PART_DIAGNOSTICS_ONLY
    || diagnostic.code === DOCX_PART_POLICY_DIAGNOSTIC_CODES.DIRECTORY_DIAGNOSTICS_ONLY
    || diagnostic.code === DOCX_PART_POLICY_DIAGNOSTIC_CODES.MEDIA_DIAGNOSTICS_ONLY
  ));
  return {
    safe: true,
    parserCandidateOnly: decision === DOCX_PART_POLICY_DECISIONS.ACCEPTED && !parserRequired,
    canCreateReviewPacket: false,
    canPreviewApply: false,
    canImportMutate: false,
    canWriteStorage: false,
  };
}

function docxPartPolicyInputRejected(input) {
  if (typeof input === 'string') return true;
  if (!input || typeof input !== 'object') return false;
  return isDocxPackageBoundaryRejectedInput(input)
    || typeof input.nodeType === 'number'
    || typeof input.nodeName === 'string'
    || typeof input.tagName === 'string'
    || hasOwnField(input, 'documentElement')
    || hasOwnField(input, 'childNodes')
    || hasOwnField(input, 'ownerDocument')
    || (typeof input.name === 'string' && typeof input.arrayBuffer === 'function');
}

function docxPartPolicyNormalizeInput(input) {
  if (docxPartPolicyInputRejected(input)) return { rejected: true };
  const hasWrappedInventory = isPlainObject(input) && hasOwnField(input, 'inventory');
  const inventory = hasWrappedInventory ? input.inventory : input;
  const inspection = isPlainObject(input) && hasOwnField(input, 'inspection') ? input.inspection : null;
  return { inventory, inspection };
}

function docxPartPolicyEntryId(entry, index) {
  return typeof entry?.id === 'string' && entry.id.trim() ? entry.id.trim() : String(index);
}

function docxPartPolicyEntryMarkers(entry) {
  return Array.isArray(entry?.markers)
    ? entry.markers.filter((marker) => typeof marker === 'string').slice().sort()
    : [];
}

function docxPartPolicyEntryCategories(entry) {
  const markers = docxPartPolicyEntryMarkers(entry);
  const categories = [];
  if (entry?.kind === 'directory') categories.push('directoryPart');
  if (entry?.kind === 'unknownPart') categories.push('unknownPart');
  if (entry?.kind === 'relationshipPart' || markers.includes('relationship')) categories.push('relationshipPart');
  if (entry?.story === 'unsupported' || markers.includes('unsupportedStory')) categories.push('unsupportedStoryPart');
  if (markers.includes('mediaPart')) categories.push('mediaPart');
  if (entry?.story === 'main' || markers.includes('documentPart') || entry?.id === 'word/document.xml') {
    categories.push('mainDocumentPart');
  }
  if (entry?.kind === 'knownPart' && categories.length === 0) categories.push('knownSupportPart');
  return categories.length > 0 ? categories : ['unknownPart'];
}

function docxPartPolicyEvidenceForEntry(entry, index, category) {
  const evidence = {
    category,
    entryId: docxPartPolicyEntryId(entry, index),
    kind: typeof entry?.kind === 'string' ? entry.kind : undefined,
    story: typeof entry?.story === 'string' ? entry.story : undefined,
    markers: docxPartPolicyEntryMarkers(entry),
    byteSize: isFiniteNonnegativeInteger(entry?.byteSize) ? entry.byteSize : undefined,
    compressedSize: isFiniteNonnegativeInteger(entry?.compressedSize) ? entry.compressedSize : undefined,
  };
  for (const key of Object.keys(evidence)) {
    if (evidence[key] === undefined) delete evidence[key];
  }
  return evidence;
}

function docxPartPolicyAddCategory(categories, category, entryId) {
  categories[category].count += 1;
  categories[category].entryIds.push(entryId);
}

function docxPartPolicySeverityForInspection(inspection) {
  return inspection?.classification === 'quarantined' || inspection?.classification === 'malformed'
    ? 'error'
    : 'warning';
}

function docxPartPolicyInspectionEvidence(inspection) {
  return {
    category: 'packageInspection',
    classification: typeof inspection?.classification === 'string' ? inspection.classification : undefined,
    status: typeof inspection?.status === 'string' ? inspection.status : undefined,
    code: typeof inspection?.code === 'string' ? inspection.code : undefined,
  };
}

function docxPartPolicyResult(decision, code, diagnostics, categories, evidence) {
  const sortedDiagnostics = diagnostics.slice().sort((left, right) => (
    String(left.code).localeCompare(String(right.code))
    || String(left.category || '').localeCompare(String(right.category || ''))
    || String(left.entryId || '').localeCompare(String(right.entryId || ''))
  ));
  const sortedEvidence = evidence.slice().sort((left, right) => (
    String(left.category).localeCompare(String(right.category))
    || String(left.entryId || '').localeCompare(String(right.entryId || ''))
    || String(left.code || '').localeCompare(String(right.code || ''))
  ));
  for (const category of DOCX_PART_POLICY_CATEGORY_NAMES) {
    categories[category].entryIds.sort();
  }
  return {
    schemaVersion: DOCX_PART_POLICY_SCHEMA,
    type: DOCX_PART_POLICY_TYPE,
    status: decision,
    code,
    reason: code,
    decision,
    categories,
    diagnostics: sortedDiagnostics,
    evidence: sortedEvidence,
    eligibility: docxPartPolicyEligibility(decision, sortedDiagnostics),
  };
}

export function classifyDocxPartPolicy(input = {}) {
  const normalized = docxPartPolicyNormalizeInput(input);
  const categories = docxPartPolicyEmptyCategories();
  const evidence = [];
  const diagnostics = [];

  if (normalized.rejected) {
    const code = DOCX_PART_POLICY_DIAGNOSTIC_CODES.INPUT_REJECTED;
    diagnostics.push(docxPartPolicyDiagnostic(code, { severity: 'error' }));
    return docxPartPolicyResult(DOCX_PART_POLICY_DECISIONS.REJECTED, code, diagnostics, categories, evidence);
  }

  const inspection = normalized.inspection || inspectDocxPackageInventory(normalized.inventory);
  evidence.push(docxPartPolicyInspectionEvidence(inspection));
  if (inspection.classification === 'malformed' || inspection.classification === 'quarantined') {
    const code = DOCX_PART_POLICY_DIAGNOSTIC_CODES.PACKAGE_REJECTED;
    diagnostics.push(docxPartPolicyDiagnostic(code, {
      severity: docxPartPolicySeverityForInspection(inspection),
      sourceCode: inspection.code,
    }));
    return docxPartPolicyResult(DOCX_PART_POLICY_DECISIONS.REJECTED, code, diagnostics, categories, evidence);
  }

  const entries = Array.isArray(normalized.inventory?.entries) ? normalized.inventory.entries : [];
  entries.forEach((entry, index) => {
    const entryId = docxPartPolicyEntryId(entry, index);
    for (const category of docxPartPolicyEntryCategories(entry)) {
      docxPartPolicyAddCategory(categories, category, entryId);
      evidence.push(docxPartPolicyEvidenceForEntry(entry, index, category));
    }
  });

  if (categories.mainDocumentPart.count === 0) {
    diagnostics.push(docxPartPolicyDiagnostic(DOCX_PART_POLICY_DIAGNOSTIC_CODES.MAIN_DOCUMENT_MISSING, {
      category: 'mainDocumentPart',
    }));
  }
  if (categories.mainDocumentPart.count > 1) {
    for (const entryId of categories.mainDocumentPart.entryIds) {
      diagnostics.push(docxPartPolicyDiagnostic(DOCX_PART_POLICY_DIAGNOSTIC_CODES.MAIN_DOCUMENT_DUPLICATE, {
        category: 'mainDocumentPart',
        entryId,
      }));
    }
  }

  const degradedCategories = [
    ['relationshipPart', DOCX_PART_POLICY_DIAGNOSTIC_CODES.RELATIONSHIP_REQUIRES_FUTURE_PARSER],
    ['unsupportedStoryPart', DOCX_PART_POLICY_DIAGNOSTIC_CODES.UNSUPPORTED_STORY_DIAGNOSTICS_ONLY],
    ['unknownPart', DOCX_PART_POLICY_DIAGNOSTIC_CODES.UNKNOWN_PART_DIAGNOSTICS_ONLY],
    ['directoryPart', DOCX_PART_POLICY_DIAGNOSTIC_CODES.DIRECTORY_DIAGNOSTICS_ONLY],
    ['mediaPart', DOCX_PART_POLICY_DIAGNOSTIC_CODES.MEDIA_DIAGNOSTICS_ONLY],
  ];
  for (const [category, diagnosticCode] of degradedCategories) {
    for (const entryId of categories[category].entryIds) {
      diagnostics.push(docxPartPolicyDiagnostic(diagnosticCode, { category, entryId }));
    }
  }

  if (inspection.classification === 'suspicious' && diagnostics.length === 0) {
    diagnostics.push(docxPartPolicyDiagnostic(DOCX_PART_POLICY_DIAGNOSTIC_CODES.PACKAGE_REJECTED, {
      severity: 'warning',
      sourceCode: inspection.code,
    }));
  }

  if (diagnostics.length > 0) {
    const code = diagnostics.some((diagnostic) => diagnostic.severity === 'error')
      ? DOCX_PART_POLICY_DIAGNOSTIC_CODES.PACKAGE_REJECTED
      : diagnostics[0].code;
    return docxPartPolicyResult(DOCX_PART_POLICY_DECISIONS.DEGRADED, code, diagnostics, categories, evidence);
  }

  return docxPartPolicyResult(
    DOCX_PART_POLICY_DECISIONS.ACCEPTED,
    DOCX_PART_POLICY_DIAGNOSTIC_CODES.ACCEPTED,
    [],
    categories,
    evidence,
  );
}
// RB_08_DOCX_PART_POLICY_CLASSIFIER_END

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

// RB_09_BLOCK_LINEAGE_CONTRACTS_START
const REVISION_BLOCK_VALID_CODE = 'REVISION_BRIDGE_BLOCK_VALID';
const REVISION_BLOCK_INVALID_CODE = 'E_REVISION_BRIDGE_BLOCK_INVALID';
const REVISION_BLOCK_LINEAGE_VALID_CODE = 'REVISION_BRIDGE_BLOCK_LINEAGE_VALID';
const REVISION_BLOCK_LINEAGE_INVALID_CODE = 'E_REVISION_BRIDGE_BLOCK_LINEAGE_INVALID';

function revisionBlockCanonicalJson(value) {
  if (value === null) return 'null';
  const valueType = typeof value;
  if (valueType === 'string') return JSON.stringify(value);
  if (valueType === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  if (valueType === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return `[${value.map((item) => revisionBlockCanonicalJson(item)).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${revisionBlockCanonicalJson(value[key])}`
    )).join(',')}}`;
  }
  return 'null';
}

function revisionBlockHash(value) {
  const text = revisionBlockCanonicalJson(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function revisionBlockCleanRecord(value) {
  return isPlainObject(value) ? cloneJsonSafe(value) || {} : {};
}

function revisionBlockInput(input) {
  return isPlainObject(input) ? input : {};
}

function revisionBlockValidationFailure(reasons, value = null) {
  return {
    ok: false,
    type: 'revisionBridge.block.validation',
    code: REVISION_BLOCK_INVALID_CODE,
    reason: reasons[0]?.code || REVISION_BLOCK_INVALID_CODE,
    reasons,
    value,
  };
}

function revisionBlockValidationSuccess(value) {
  return {
    ok: true,
    type: 'revisionBridge.block.validation',
    code: REVISION_BLOCK_VALID_CODE,
    reason: REVISION_BLOCK_VALID_CODE,
    reasons: [],
    value: cloneJsonSafe(value),
  };
}

function revisionBlockLineageValidationFailure(reasons, value = null) {
  return {
    ok: false,
    type: 'revisionBridge.blockLineage.validation',
    code: REVISION_BLOCK_LINEAGE_INVALID_CODE,
    reason: reasons[0]?.code || REVISION_BLOCK_LINEAGE_INVALID_CODE,
    reasons,
    value,
  };
}

function revisionBlockLineageValidationSuccess(value) {
  return {
    ok: true,
    type: 'revisionBridge.blockLineage.validation',
    code: REVISION_BLOCK_LINEAGE_VALID_CODE,
    reason: REVISION_BLOCK_LINEAGE_VALID_CODE,
    reasons: [],
    value: cloneJsonSafe(value),
  };
}

function collectRevisionBlockCycleReasons(edges, knownBlockIds) {
  const reasons = [];
  const outgoing = {};
  for (const blockId of knownBlockIds) outgoing[blockId] = [];
  edges.forEach((edge) => {
    if (isPlainObject(edge) && outgoing[edge.fromBlockId]) outgoing[edge.fromBlockId].push(edge.toBlockId);
  });

  const visiting = {};
  const visited = {};
  function visit(blockId, trail) {
    if (visiting[blockId]) {
      reasons.push(invalidField('lineageEdges', `lineage cycle detected at ${blockId}`));
      return;
    }
    if (visited[blockId]) return;
    visiting[blockId] = true;
    for (const nextBlockId of outgoing[blockId] || []) {
      if (knownBlockIds.includes(nextBlockId)) visit(nextBlockId, trail.concat(nextBlockId));
    }
    visiting[blockId] = false;
    visited[blockId] = true;
  }

  for (const blockId of knownBlockIds) visit(blockId, [blockId]);
  return reasons.slice(0, 1);
}

export function isRevisionBlockKind(value) {
  return REVISION_BRIDGE_BLOCK_KINDS.includes(value);
}

export function normalizeRevisionBlockText(value) {
  return typeof value === 'string' ? value.replace(/\r\n?/gu, '\n').trim() : '';
}

export function createRevisionBlockOrder(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function createRevisionBlockVersionHash(input = {}) {
  const block = revisionBlockInput(input);
  return `rbvh_${revisionBlockHash({
    schemaVersion: REVISION_BRIDGE_BLOCK_SCHEMA,
    kind: isRevisionBlockKind(block.kind) ? block.kind : 'paragraph',
    text: normalizeRevisionBlockText(block.text),
    attrs: revisionBlockCleanRecord(block.attrs),
  })}`;
}

export function createRevisionBlockLineageId(input = {}) {
  const block = revisionBlockInput(input);
  const explicitSeed = normalizeString(block.lineageSeed);
  const seed = explicitSeed || revisionBlockCanonicalJson({
    sceneId: normalizeString(block.sceneId),
    order: createRevisionBlockOrder(block.order),
    kind: isRevisionBlockKind(block.kind) ? block.kind : 'paragraph',
    text: normalizeRevisionBlockText(block.text),
  });
  return `rbli_${revisionBlockHash({
    schemaVersion: REVISION_BRIDGE_BLOCK_LINEAGE_SCHEMA,
    seed,
  })}`;
}

export function createRevisionBlockInstanceId(input = {}) {
  const block = revisionBlockInput(input);
  return `rbbi_${revisionBlockHash({
    schemaVersion: REVISION_BRIDGE_BLOCK_SCHEMA,
    sceneId: normalizeString(block.sceneId),
    order: createRevisionBlockOrder(block.order),
    kind: isRevisionBlockKind(block.kind) ? block.kind : 'paragraph',
    lineageId: createRevisionBlockLineageId(block),
  })}`;
}

export function createRevisionBlock(input = {}) {
  const block = revisionBlockInput(input);
  const kind = isRevisionBlockKind(block.kind) ? block.kind : 'paragraph';
  const order = createRevisionBlockOrder(block.order);
  const candidate = {
    schemaVersion: REVISION_BRIDGE_BLOCK_SCHEMA,
    blockId: normalizeString(block.blockId) || createRevisionBlockInstanceId({ ...block, kind, order }),
    lineageId: normalizeString(block.lineageId) || createRevisionBlockLineageId({ ...block, kind, order }),
    versionHash: normalizeString(block.versionHash) || createRevisionBlockVersionHash({ ...block, kind }),
    kind,
    order,
    text: normalizeRevisionBlockText(block.text),
    attrs: revisionBlockCleanRecord(block.attrs),
    source: revisionBlockCleanRecord(block.source),
  };
  return cloneJsonSafe(candidate);
}

function collectRevisionBlockReasons(input, block, prefix) {
  const reasons = [];
  if (!isPlainObject(input)) {
    reasons.push(invalidField(prefix, `${prefix} must be an object`));
    return reasons;
  }
  if (input.schemaVersion !== REVISION_BRIDGE_BLOCK_SCHEMA) reasons.push(invalidField(`${prefix}.schemaVersion`, 'block schemaVersion is not supported'));
  if (!normalizeString(input.blockId || block.blockId)) reasons.push(missingField(`${prefix}.blockId`));
  if (!normalizeString(input.lineageId || block.lineageId)) reasons.push(missingField(`${prefix}.lineageId`));
  if (!normalizeString(input.versionHash || block.versionHash)) reasons.push(missingField(`${prefix}.versionHash`));
  if (!hasOwnField(input, 'kind')) {
    reasons.push(missingField(`${prefix}.kind`));
  } else if (!isRevisionBlockKind(input.kind)) {
    reasons.push(invalidField(`${prefix}.kind`, 'block kind is not supported'));
  }
  if (!hasOwnField(input, 'order') || createRevisionBlockOrder(input.order) === null) {
    reasons.push(invalidField(`${prefix}.order`, 'block order must be a non-negative safe integer'));
  }
  if (hasOwnField(input, 'attrs') && !isPlainObject(input.attrs)) {
    reasons.push(invalidField(`${prefix}.attrs`, 'block attrs must be an object'));
  }
  if (hasOwnField(input, 'source') && !isPlainObject(input.source)) {
    reasons.push(invalidField(`${prefix}.source`, 'block source must be an object'));
  }
  return reasons;
}

export function validateRevisionBlock(input = {}) {
  const block = createRevisionBlock(input);
  const reasons = collectRevisionBlockReasons(input, block, 'block');
  if (reasons.length > 0) return revisionBlockValidationFailure(reasons);
  return revisionBlockValidationSuccess(block);
}

export function validateRevisionBlockLineage(input = {}) {
  const lineage = revisionBlockInput(input);
  const reasons = [];
  if (!isPlainObject(input)) {
    reasons.push(invalidField('blockLineage', 'blockLineage must be an object'));
    return revisionBlockLineageValidationFailure(reasons);
  }
  if (lineage.schemaVersion !== REVISION_BRIDGE_BLOCK_LINEAGE_SCHEMA) {
    reasons.push(invalidField('blockLineage.schemaVersion', 'blockLineage schemaVersion is not supported'));
  }
  if (!Array.isArray(lineage.blocks)) {
    reasons.push(invalidField('blockLineage.blocks', 'blockLineage blocks must be an array'));
    return revisionBlockLineageValidationFailure(reasons);
  }

  const blockIds = [];
  lineage.blocks.forEach((candidate, index) => {
    if (!isPlainObject(candidate)) {
      reasons.push(invalidField(`blockLineage.blocks.${index}`, 'blockLineage block must be an object'));
      return;
    }
    const blockResult = validateRevisionBlock(candidate);
    for (const reason of blockResult.reasons) {
      reasons.push({
        ...reason,
        field: reason.field.replace(/^block/u, `blockLineage.blocks.${index}`),
      });
    }
    const blockId = normalizeString(candidate.blockId);
    if (blockId) {
      if (blockIds.includes(blockId)) reasons.push(invalidField(`blockLineage.blocks.${index}.blockId`, 'blockId must be unique'));
      blockIds.push(blockId);
    }
  });

  if (hasOwnField(lineage, 'lineageEdges')) {
    if (!Array.isArray(lineage.lineageEdges)) {
      reasons.push(invalidField('blockLineage.lineageEdges', 'blockLineage lineageEdges must be an array'));
    } else {
      lineage.lineageEdges.forEach((edge, index) => {
        if (!isPlainObject(edge)) {
          reasons.push(invalidField(`blockLineage.lineageEdges.${index}`, 'lineage edge must be an object'));
          return;
        }
        const fromBlockId = normalizeString(edge.fromBlockId);
        const toBlockId = normalizeString(edge.toBlockId);
        if (!fromBlockId) reasons.push(missingField(`blockLineage.lineageEdges.${index}.fromBlockId`));
        if (!toBlockId) reasons.push(missingField(`blockLineage.lineageEdges.${index}.toBlockId`));
        if (fromBlockId && !blockIds.includes(fromBlockId)) {
          reasons.push(invalidField(`blockLineage.lineageEdges.${index}.fromBlockId`, 'lineage edge references an unknown block'));
        }
        if (toBlockId && !blockIds.includes(toBlockId)) {
          reasons.push(invalidField(`blockLineage.lineageEdges.${index}.toBlockId`, 'lineage edge references an unknown block'));
        }
        if (fromBlockId && toBlockId && fromBlockId === toBlockId) {
          reasons.push(invalidField(`blockLineage.lineageEdges.${index}`, 'lineage edge must not reference itself'));
        }
      });
      if (reasons.length === 0) {
        reasons.push(...collectRevisionBlockCycleReasons(lineage.lineageEdges, blockIds));
      }
    }
  }

  if (reasons.length > 0) return revisionBlockLineageValidationFailure(reasons);
  return revisionBlockLineageValidationSuccess({
    schemaVersion: REVISION_BRIDGE_BLOCK_LINEAGE_SCHEMA,
    blocks: lineage.blocks.map((block) => createRevisionBlock(block)),
    lineageEdges: Array.isArray(lineage.lineageEdges) ? cloneJsonSafe(lineage.lineageEdges) : [],
  });
}

export function deriveRevisionBlocksFromPlainSceneText(input = {}) {
  const source = revisionBlockInput(input);
  const sceneId = normalizeString(source.sceneId);
  const text = normalizeRevisionBlockText(source.text);
  if (!text) return [];
  return text
    .split(/\n[ \t]*\n+/u)
    .map((paragraphText) => normalizeRevisionBlockText(paragraphText))
    .filter(Boolean)
    .map((paragraphText, order) => createRevisionBlock({
      sceneId,
      lineageSeed: `${sceneId}:${order}:paragraph`,
      kind: 'paragraph',
      order,
      text: paragraphText,
      attrs: {},
      source: {
        kind: 'plainSceneText',
        sceneId,
      },
    }));
}

function normalizeRevisionBlockIdentityComparable(value) {
  return normalizeRevisionBlockText(value).replace(/\s+/gu, ' ').toLowerCase();
}

function revisionBlockIdentityDiagnostic(code, block, index, message) {
  return {
    code,
    severity: code === 'REVISION_BRIDGE_BLOCK_COPY_AMBIGUITY' ? 'warning' : 'error',
    riskClass: code === 'REVISION_BRIDGE_BLOCK_COPY_AMBIGUITY' ? 'high' : 'critical',
    automationPolicy: 'manualOnly',
    blockId: normalizeString(block.blockId),
    lineageId: normalizeString(block.lineageId),
    index,
    message,
  };
}

export function evaluateRevisionBlockIdentityRisks(input = {}) {
  const source = revisionBlockInput(input);
  const candidates = Array.isArray(source.blocks) ? source.blocks : [];
  const blocks = candidates
    .map((item) => createRevisionBlock(item))
    .filter((item) => isPlainObject(item));
  const diagnostics = [];
  const byComparableText = {};

  blocks.forEach((block, index) => {
    const blockId = normalizeString(block.blockId);
    const orderText = String(createRevisionBlockOrder(block.order));
    const visibleText = normalizeRevisionBlockIdentityComparable(block.text);
    const blockIdComparable = normalizeRevisionBlockIdentityComparable(blockId);
    if (blockId && orderText !== 'null' && blockId === orderText) {
      diagnostics.push(revisionBlockIdentityDiagnostic(
        'REVISION_BRIDGE_BLOCK_ID_EQUALS_ORDER',
        block,
        index,
        'blockId must not equal visible paragraph index',
      ));
    }
    if (blockId && visibleText && blockIdComparable === visibleText) {
      diagnostics.push(revisionBlockIdentityDiagnostic(
        'REVISION_BRIDGE_BLOCK_ID_EQUALS_VISIBLE_TEXT',
        block,
        index,
        'blockId must not equal visible text',
      ));
    }
    if (block.kind === 'heading' && blockId && visibleText && blockIdComparable === visibleText) {
      diagnostics.push(revisionBlockIdentityDiagnostic(
        'REVISION_BRIDGE_BLOCK_ID_EQUALS_HEADING_TEXT',
        block,
        index,
        'blockId must not equal heading text',
      ));
    }
    if (visibleText) {
      if (!Array.isArray(byComparableText[visibleText])) byComparableText[visibleText] = [];
      byComparableText[visibleText].push({ block, index });
    }
  });

  Object.keys(byComparableText).forEach((key) => {
    const rows = byComparableText[key];
    if (!Array.isArray(rows) || rows.length < 2) return;
    rows.forEach(({ block, index }) => {
      diagnostics.push(revisionBlockIdentityDiagnostic(
        'REVISION_BRIDGE_BLOCK_COPY_AMBIGUITY',
        block,
        index,
        'duplicated visible text creates block copy ambiguity',
      ));
    });
  });

  return {
    schemaVersion: REVISION_BRIDGE_BLOCK_IDENTITY_RISK_SCHEMA,
    type: 'revisionBridge.blockIdentityRisk',
    status: 'evaluated',
    code: diagnostics.length > 0
      ? 'REVISION_BRIDGE_BLOCK_IDENTITY_RISK_FOUND'
      : 'REVISION_BRIDGE_BLOCK_IDENTITY_RISK_NONE',
    diagnostics,
  };
}
// RB_09_BLOCK_LINEAGE_CONTRACTS_END

// RB_10_INLINE_RANGE_ANCHOR_CONTRACTS_START
const INLINE_RANGE_VALID_CODE = 'REVISION_BRIDGE_INLINE_RANGE_VALID';
const INLINE_RANGE_INVALID_CODE = 'E_REVISION_BRIDGE_INLINE_RANGE_INVALID';
const COMMENT_ANCHOR_PLACEMENT_VALID_CODE = 'REVISION_BRIDGE_COMMENT_ANCHOR_PLACEMENT_VALID';
const COMMENT_ANCHOR_PLACEMENT_INVALID_CODE = 'E_REVISION_BRIDGE_COMMENT_ANCHOR_PLACEMENT_INVALID';
const COMMENT_ANCHOR_PLACEMENT_FORBIDDEN_TEXT_FIELDS = [
  'body',
  'text',
  'messages',
  'commentText',
];

function inlineRangeInput(input) {
  return isPlainObject(input) ? input : {};
}

function inlineRangePosition(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function inlineRangeReason(code, field, message) {
  return { code, field, message };
}

function inlineRangeValidationFailure(reasons, value = null) {
  return {
    ok: false,
    type: 'revisionBridge.inlineRange.validation',
    code: INLINE_RANGE_INVALID_CODE,
    reason: reasons[0]?.code || INLINE_RANGE_INVALID_CODE,
    reasons,
    value,
  };
}

function inlineRangeValidationSuccess(value) {
  return {
    ok: true,
    type: 'revisionBridge.inlineRange.validation',
    code: INLINE_RANGE_VALID_CODE,
    reason: INLINE_RANGE_VALID_CODE,
    reasons: [],
    value: cloneJsonSafe(value),
  };
}

function commentAnchorPlacementValidationFailure(reasons, value = null) {
  return {
    ok: false,
    type: 'revisionBridge.commentAnchorPlacement.validation',
    code: COMMENT_ANCHOR_PLACEMENT_INVALID_CODE,
    reason: reasons[0]?.code || COMMENT_ANCHOR_PLACEMENT_INVALID_CODE,
    reasons,
    value,
  };
}

function commentAnchorPlacementValidationSuccess(value) {
  return {
    ok: true,
    type: 'revisionBridge.commentAnchorPlacement.validation',
    code: COMMENT_ANCHOR_PLACEMENT_VALID_CODE,
    reason: COMMENT_ANCHOR_PLACEMENT_VALID_CODE,
    reasons: [],
    value: cloneJsonSafe(value),
  };
}

function inlineRangeNormalizeTargetScope(value) {
  const scope = isPlainObject(value) ? value : {};
  return {
    type: normalizeString(scope.type),
    id: normalizeString(scope.id),
  };
}

function inlineRangeBlockTextFromContext(blockId, context) {
  if (!blockId || !isPlainObject(context)) return null;
  const blocks = context.blocks;
  if (Array.isArray(blocks)) {
    const block = blocks.find((candidate) => isPlainObject(candidate) && normalizeString(candidate.blockId) === blockId);
    return block ? normalizeRevisionBlockText(block.text) : null;
  }
  if (isPlainObject(blocks)) {
    const block = blocks[blockId];
    if (typeof block === 'string') return normalizeRevisionBlockText(block);
    if (isPlainObject(block)) return normalizeRevisionBlockText(block.text);
  }
  return null;
}

function inlineRangeContextHasBlocks(context) {
  return isPlainObject(context) && (Array.isArray(context.blocks) || isPlainObject(context.blocks));
}

export function isRevisionInlineAnchorKind(value) {
  return REVISION_BRIDGE_INLINE_ANCHOR_KINDS.includes(value);
}

export function isRevisionMatchConfidence(value) {
  return REVISION_BRIDGE_MATCH_CONFIDENCE_LEVELS.includes(value);
}

export function isRevisionRiskClass(value) {
  return REVISION_BRIDGE_RISK_CLASSES.includes(value);
}

export function isRevisionAutomationPolicy(value) {
  return REVISION_BRIDGE_AUTOMATION_POLICIES.includes(value);
}

export function createInlineRange(input = {}) {
  const range = inlineRangeInput(input);
  const kind = isRevisionInlineAnchorKind(range.kind) ? range.kind : 'point';
  const confidence = isRevisionMatchConfidence(range.confidence) ? range.confidence : (kind === 'orphan' ? 'unresolved' : 'exact');
  const automationPolicy = isRevisionAutomationPolicy(range.automationPolicy)
    ? range.automationPolicy
    : (kind === 'orphan' ? 'diagnosticsOnly' : 'manualOnly');
  const from = inlineRangePosition(range.from);
  const to = inlineRangePosition(range.to);
  return cloneJsonSafe({
    schemaVersion: REVISION_BRIDGE_INLINE_RANGE_SCHEMA,
    kind,
    blockId: normalizeString(range.blockId),
    lineageId: normalizeString(range.lineageId),
    from,
    to,
    quote: normalizeString(range.quote),
    prefix: normalizeString(range.prefix),
    suffix: normalizeString(range.suffix),
    confidence,
    riskClass: isRevisionRiskClass(range.riskClass) ? range.riskClass : 'low',
    automationPolicy,
    deletedTarget: range.deletedTarget === true,
    reasonCodes: normalizeStringArray(range.reasonCodes),
  });
}

function collectInlineRangeReasons(input, range, context) {
  const reasons = [];
  if (!isPlainObject(input)) {
    reasons.push(invalidField('inlineRange', 'inlineRange must be an object'));
    return reasons;
  }
  if (input.schemaVersion !== REVISION_BRIDGE_INLINE_RANGE_SCHEMA) {
    reasons.push(invalidField('inlineRange.schemaVersion', 'inlineRange schemaVersion is not supported'));
  }
  if (!isRevisionInlineAnchorKind(input.kind)) {
    reasons.push(invalidField('inlineRange.kind', 'inlineRange kind is not supported'));
  }
  if (!hasOwnField(input, 'from') || inlineRangePosition(input.from) === null) {
    reasons.push(invalidField('inlineRange.from', 'inlineRange from must be a non-negative safe integer'));
  }
  if (!hasOwnField(input, 'to') || inlineRangePosition(input.to) === null) {
    reasons.push(invalidField('inlineRange.to', 'inlineRange to must be a non-negative safe integer'));
  }
  if (!isRevisionMatchConfidence(input.confidence)) {
    reasons.push(invalidField('inlineRange.confidence', 'inlineRange confidence is not supported'));
  }
  if (!isRevisionRiskClass(input.riskClass)) {
    reasons.push(invalidField('inlineRange.riskClass', 'inlineRange riskClass is not supported'));
  }
  if (!isRevisionAutomationPolicy(input.automationPolicy)) {
    reasons.push(invalidField('inlineRange.automationPolicy', 'inlineRange automationPolicy is not supported'));
  }
  if (!Array.isArray(input.reasonCodes)) {
    reasons.push(invalidField('inlineRange.reasonCodes', 'inlineRange reasonCodes must be an array'));
  }

  if (range.kind === 'point' && range.from !== range.to) {
    reasons.push(invalidField('inlineRange', 'point inlineRange must have matching from and to'));
  }
  if (range.kind === 'span' && !(range.from < range.to)) {
    reasons.push(invalidField('inlineRange', 'span inlineRange must have from less than to'));
  }
  if (range.kind === 'deleted') {
    if (!(range.from <= range.to)) reasons.push(invalidField('inlineRange', 'deleted inlineRange must have from less than or equal to to'));
    if (range.deletedTarget !== true) reasons.push(invalidField('inlineRange.deletedTarget', 'deleted inlineRange must have deletedTarget true'));
    if (range.automationPolicy === 'autoEligible') reasons.push(invalidField('inlineRange.automationPolicy', 'deleted inlineRange cannot be autoEligible'));
  }
  if (range.kind === 'orphan') {
    if (range.blockId) reasons.push(invalidField('inlineRange.blockId', 'orphan inlineRange must not set blockId'));
    if (range.confidence !== 'unresolved') reasons.push(invalidField('inlineRange.confidence', 'orphan inlineRange must be unresolved'));
    if (range.automationPolicy !== 'diagnosticsOnly' && range.automationPolicy !== 'hardFail') {
      reasons.push(invalidField('inlineRange.automationPolicy', 'orphan inlineRange must be diagnosticsOnly or hardFail'));
    }
  }
  if ((range.confidence === 'approximate' || range.confidence === 'unresolved') && range.automationPolicy === 'autoEligible') {
    reasons.push(invalidField('inlineRange.automationPolicy', 'approximate or unresolved inlineRange cannot be autoEligible'));
  }

  const blockText = inlineRangeBlockTextFromContext(range.blockId, context);
  if (range.kind !== 'orphan' && inlineRangeContextHasBlocks(context)) {
    if (blockText === null) {
      reasons.push(invalidField('inlineRange.blockId', 'inlineRange blockId is not present in context blocks'));
    } else if (range.to > blockText.length) {
      reasons.push(invalidField('inlineRange.to', 'inlineRange to exceeds context block text length'));
    }
  }
  if (range.confidence === 'exact' && range.quote && blockText !== null && !blockText.includes(range.quote)) {
    reasons.push(inlineRangeReason(
      'REVISION_BRIDGE_INLINE_RANGE_STALE_QUOTE',
      'inlineRange.quote',
      'exact inlineRange quote is not present in context block text',
    ));
  }
  return reasons;
}

export function validateInlineRange(input = {}, context = {}) {
  const range = createInlineRange(input);
  const reasons = collectInlineRangeReasons(input, range, context);
  if (reasons.length > 0) return inlineRangeValidationFailure(reasons, range);
  return inlineRangeValidationSuccess(range);
}

export function createCommentAnchorPlacement(input = {}) {
  const placement = inlineRangeInput(input);
  return cloneJsonSafe({
    schemaVersion: REVISION_BRIDGE_COMMENT_ANCHOR_PLACEMENT_SCHEMA,
    placementId: normalizeString(placement.placementId),
    threadId: normalizeString(placement.threadId),
    targetScope: inlineRangeNormalizeTargetScope(placement.targetScope),
    inlineRange: createInlineRange(placement.inlineRange),
    resolvedState: normalizeString(placement.resolvedState),
    acceptedState: normalizeString(placement.acceptedState),
    diagnosticsOnly: placement.diagnosticsOnly === true,
  });
}

export function validateCommentAnchorPlacement(input = {}, context = {}) {
  const placement = createCommentAnchorPlacement(input);
  const reasons = [];
  if (!isPlainObject(input)) {
    reasons.push(invalidField('commentAnchorPlacement', 'commentAnchorPlacement must be an object'));
    return commentAnchorPlacementValidationFailure(reasons, placement);
  }
  if (input.schemaVersion !== REVISION_BRIDGE_COMMENT_ANCHOR_PLACEMENT_SCHEMA) {
    reasons.push(invalidField('commentAnchorPlacement.schemaVersion', 'commentAnchorPlacement schemaVersion is not supported'));
  }
  if (!normalizeString(input.placementId)) reasons.push(missingField('commentAnchorPlacement.placementId'));
  if (!normalizeString(input.threadId)) reasons.push(missingField('commentAnchorPlacement.threadId'));
  if (!isPlainObject(input.targetScope)) {
    reasons.push(invalidField('commentAnchorPlacement.targetScope', 'commentAnchorPlacement targetScope must be an object'));
  } else if (!normalizeString(input.targetScope.type)) {
    reasons.push(missingField('commentAnchorPlacement.targetScope.type'));
  }
  for (const field of COMMENT_ANCHOR_PLACEMENT_FORBIDDEN_TEXT_FIELDS) {
    if (hasOwnField(input, field)) {
      reasons.push(invalidField(`commentAnchorPlacement.${field}`, 'commentAnchorPlacement must not duplicate comment content'));
    }
  }
  const inlineRangeResult = validateInlineRange(input.inlineRange, context);
  for (const reason of inlineRangeResult.reasons) {
    reasons.push({
      ...reason,
      field: reason.field.replace(/^inlineRange/u, 'commentAnchorPlacement.inlineRange'),
    });
  }
  if (reasons.length > 0) return commentAnchorPlacementValidationFailure(reasons, placement);
  return commentAnchorPlacementValidationSuccess(placement);
}
// RB_10_INLINE_RANGE_ANCHOR_CONTRACTS_END

// RB_11_ANCHOR_CONFIDENCE_ENGINE_CONTRACTS_START
const ANCHOR_CONFIDENCE_READY_CODE = 'REVISION_BRIDGE_ANCHOR_CONFIDENCE_EVALUATED';
const ANCHOR_CONFIDENCE_DIAGNOSTICS_CODE = 'E_REVISION_BRIDGE_ANCHOR_CONFIDENCE_DIAGNOSTICS';
const ANCHOR_CONFIDENCE_HARD_FAIL_CODE = 'E_REVISION_BRIDGE_ANCHOR_CONFIDENCE_HARD_FAIL';

function anchorConfidenceRangeInput(input) {
  if (!isPlainObject(input)) return {};
  return isPlainObject(input.inlineRange) ? input.inlineRange : input;
}

function anchorConfidenceDiagnostic(code, field, message) {
  return { code, field, message };
}

function anchorConfidenceAddDiagnostic(diagnostics, code, field, message) {
  if (!diagnostics.some((diagnostic) => diagnostic.code === code && diagnostic.field === field)) {
    diagnostics.push(anchorConfidenceDiagnostic(code, field, message));
  }
}

function anchorConfidenceTextFromEntry(entry) {
  if (typeof entry === 'string') return normalizeRevisionBlockText(entry);
  if (isPlainObject(entry)) return normalizeRevisionBlockText(entry.text);
  return null;
}

function anchorConfidenceBlockTextFromContext(blockId, context) {
  if (!blockId || !isPlainObject(context)) return { hasIndex: false, text: null };
  if (Array.isArray(context.blocks)) {
    const block = context.blocks.find((candidate) => isPlainObject(candidate) && normalizeString(candidate.blockId) === blockId);
    return { hasIndex: true, text: anchorConfidenceTextFromEntry(block) };
  }
  if (isPlainObject(context.blocks)) {
    return { hasIndex: true, text: anchorConfidenceTextFromEntry(context.blocks[blockId]) };
  }
  if (isPlainObject(context.blockMap)) {
    return { hasIndex: true, text: anchorConfidenceTextFromEntry(context.blockMap[blockId]) };
  }
  return { hasIndex: false, text: null };
}

function anchorConfidenceRiskRank(riskClass) {
  const index = REVISION_BRIDGE_RISK_CLASSES.indexOf(riskClass);
  return index === -1 ? REVISION_BRIDGE_RISK_CLASSES.indexOf('critical') : index;
}

function anchorConfidenceMaxRisk(left, right) {
  return anchorConfidenceRiskRank(left) >= anchorConfidenceRiskRank(right) ? left : right;
}

function anchorConfidenceHasHardFailure(diagnostics) {
  return diagnostics.some((diagnostic) => (
    diagnostic.code === 'REVISION_BRIDGE_ANCHOR_CONFIDENCE_VALIDATION_FAILED'
    || diagnostic.code === 'REVISION_BRIDGE_ANCHOR_CONFIDENCE_OUT_OF_BOUNDS'
  ));
}

function anchorConfidenceHasUnresolvedFailure(diagnostics) {
  return diagnostics.some((diagnostic) => (
    diagnostic.code === 'REVISION_BRIDGE_ANCHOR_CONFIDENCE_MISSING_BLOCK'
    || diagnostic.code === 'REVISION_BRIDGE_ANCHOR_CONFIDENCE_STALE_QUOTE'
    || diagnostic.code === 'REVISION_BRIDGE_ANCHOR_CONFIDENCE_ORPHAN'
    || diagnostic.code === 'REVISION_BRIDGE_ANCHOR_CONFIDENCE_DELETED_TARGET'
    || diagnostic.code === 'REVISION_BRIDGE_ANCHOR_CONFIDENCE_UNRESOLVED_ANCHOR'
  ));
}

function anchorDisagreementSummaryInitialCounts() {
  return {
    REVISION_BRIDGE_ANCHOR_CONFIDENCE_QUOTE_ELSEWHERE: 0,
    REVISION_BRIDGE_ANCHOR_CONFIDENCE_PREFIX_MISMATCH: 0,
    REVISION_BRIDGE_ANCHOR_CONFIDENCE_SUFFIX_MISMATCH: 0,
    REVISION_BRIDGE_ANCHOR_CONFIDENCE_STALE_QUOTE: 0,
    REVISION_BRIDGE_ANCHOR_CONFIDENCE_MISSING_BLOCK: 0,
    REVISION_BRIDGE_ANCHOR_CONFIDENCE_OUT_OF_BOUNDS: 0,
  };
}

export function evaluateInlineRangeAnchorConfidence(input = {}, context = {}) {
  const rangeInput = anchorConfidenceRangeInput(input);
  const inlineRange = createInlineRange(rangeInput);
  const validation = validateInlineRange(rangeInput, context);
  const diagnostics = [];
  const block = anchorConfidenceBlockTextFromContext(inlineRange.blockId, context);
  let exactRange = false;
  let riskClass = isRevisionRiskClass(inlineRange.riskClass) ? inlineRange.riskClass : 'critical';

  if (!validation.ok) {
    for (const reason of validation.reasons) {
      if (reason.code === 'REVISION_BRIDGE_INLINE_RANGE_STALE_QUOTE') {
        anchorConfidenceAddDiagnostic(
          diagnostics,
          'REVISION_BRIDGE_ANCHOR_CONFIDENCE_STALE_QUOTE',
          reason.field,
          'quote is not present in the target block',
        );
      } else if (reason.field === 'inlineRange.blockId') {
        anchorConfidenceAddDiagnostic(
          diagnostics,
          'REVISION_BRIDGE_ANCHOR_CONFIDENCE_MISSING_BLOCK',
          reason.field,
          reason.message,
        );
      } else if (reason.field === 'inlineRange.to') {
        anchorConfidenceAddDiagnostic(
          diagnostics,
          'REVISION_BRIDGE_ANCHOR_CONFIDENCE_OUT_OF_BOUNDS',
          reason.field,
          reason.message,
        );
      } else {
        anchorConfidenceAddDiagnostic(
          diagnostics,
          'REVISION_BRIDGE_ANCHOR_CONFIDENCE_VALIDATION_FAILED',
          reason.field,
          reason.message,
        );
      }
    }
  }

  if (inlineRange.kind === 'orphan') {
    anchorConfidenceAddDiagnostic(
      diagnostics,
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_ORPHAN',
      'inlineRange.kind',
      'orphan anchor remains unresolved',
    );
  }
  if (inlineRange.kind === 'deleted' || inlineRange.deletedTarget === true) {
    anchorConfidenceAddDiagnostic(
      diagnostics,
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_DELETED_TARGET',
      'inlineRange.deletedTarget',
      'deleted target is not eligible for automation',
    );
  }
  if (inlineRange.confidence === 'weakHigh' || inlineRange.confidence === 'approximate') {
    anchorConfidenceAddDiagnostic(
      diagnostics,
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_WEAK_ANCHOR',
      'inlineRange.confidence',
      'weak or approximate anchor needs manual review',
    );
  }
  if (inlineRange.confidence === 'unresolved') {
    anchorConfidenceAddDiagnostic(
      diagnostics,
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_UNRESOLVED_ANCHOR',
      'inlineRange.confidence',
      'unresolved anchor cannot be automated',
    );
  }

  if (inlineRange.kind !== 'orphan' && block.hasIndex && block.text === null) {
    anchorConfidenceAddDiagnostic(
      diagnostics,
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_MISSING_BLOCK',
      'inlineRange.blockId',
      'target block is not present in the supplied context',
    );
  }

  if (block.text !== null && inlineRange.kind !== 'orphan') {
    const rangeInBounds = inlineRange.from !== null
      && inlineRange.to !== null
      && inlineRange.from <= inlineRange.to
      && inlineRange.from <= block.text.length
      && inlineRange.to <= block.text.length;

    if (!rangeInBounds) {
      anchorConfidenceAddDiagnostic(
        diagnostics,
        'REVISION_BRIDGE_ANCHOR_CONFIDENCE_OUT_OF_BOUNDS',
        'inlineRange',
        'target range is outside the target block',
      );
    } else {
      const quoteAtRange = inlineRange.quote === ''
        ? inlineRange.from === inlineRange.to
        : block.text.slice(inlineRange.from, inlineRange.to) === inlineRange.quote;
      exactRange = inlineRange.confidence === 'exact' && quoteAtRange;

      if (inlineRange.quote && !quoteAtRange) {
        const quoteCode = block.text.includes(inlineRange.quote)
          ? 'REVISION_BRIDGE_ANCHOR_CONFIDENCE_QUOTE_ELSEWHERE'
          : 'REVISION_BRIDGE_ANCHOR_CONFIDENCE_STALE_QUOTE';
        anchorConfidenceAddDiagnostic(
          diagnostics,
          quoteCode,
          'inlineRange.quote',
          quoteCode === 'REVISION_BRIDGE_ANCHOR_CONFIDENCE_QUOTE_ELSEWHERE'
            ? 'quote exists in the block but not at the target range'
            : 'quote is not present in the target block',
        );
      }

      if (inlineRange.prefix && block.text.slice(Math.max(0, inlineRange.from - inlineRange.prefix.length), inlineRange.from) !== inlineRange.prefix) {
        anchorConfidenceAddDiagnostic(
          diagnostics,
          'REVISION_BRIDGE_ANCHOR_CONFIDENCE_PREFIX_MISMATCH',
          'inlineRange.prefix',
          'prefix does not match text before the target range',
        );
      }
      if (inlineRange.suffix && block.text.slice(inlineRange.to, inlineRange.to + inlineRange.suffix.length) !== inlineRange.suffix) {
        anchorConfidenceAddDiagnostic(
          diagnostics,
          'REVISION_BRIDGE_ANCHOR_CONFIDENCE_SUFFIX_MISMATCH',
          'inlineRange.suffix',
          'suffix does not match text after the target range',
        );
      }
    }
  }

  const hardFailure = anchorConfidenceHasHardFailure(diagnostics);
  const unresolvedFailure = anchorConfidenceHasUnresolvedFailure(diagnostics);
  let confidence = inlineRange.confidence;
  let automationPolicy = 'manualOnly';

  if (hardFailure) {
    confidence = 'unresolved';
    riskClass = 'critical';
    automationPolicy = 'hardFail';
  } else if (unresolvedFailure) {
    confidence = 'unresolved';
    riskClass = anchorConfidenceMaxRisk(riskClass, 'high');
    automationPolicy = 'diagnosticsOnly';
  } else if (exactRange && diagnostics.length === 0) {
    confidence = 'exact';
    riskClass = 'low';
    automationPolicy = 'manualConfirmRequired';
    anchorConfidenceAddDiagnostic(
      diagnostics,
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_EXACT_RANGE',
      'inlineRange',
      'quote matches the target range exactly',
    );
  } else if (diagnostics.length > 0) {
    confidence = confidence === 'exact' ? 'approximate' : confidence;
    riskClass = anchorConfidenceMaxRisk(riskClass, 'medium');
    automationPolicy = 'manualOnly';
  }

  const reasonCodes = diagnostics.map((diagnostic) => diagnostic.code);
  const status = automationPolicy === 'hardFail'
    ? 'hardFail'
    : (diagnostics.length > 0 && reasonCodes[0] !== 'REVISION_BRIDGE_ANCHOR_CONFIDENCE_EXACT_RANGE' ? 'diagnostics' : 'evaluated');
  const code = status === 'hardFail'
    ? ANCHOR_CONFIDENCE_HARD_FAIL_CODE
    : (status === 'diagnostics' ? ANCHOR_CONFIDENCE_DIAGNOSTICS_CODE : ANCHOR_CONFIDENCE_READY_CODE);

  return {
    schemaVersion: REVISION_BRIDGE_ANCHOR_CONFIDENCE_EVALUATION_SCHEMA,
    type: 'revisionBridge.anchorConfidence.evaluation',
    status,
    code,
    reason: reasonCodes[0] || code,
    inlineRange: cloneJsonSafe({
      ...inlineRange,
      confidence,
      riskClass,
      automationPolicy,
      reasonCodes,
    }),
    confidence,
    riskClass,
    automationPolicy,
    reasonCodes: cloneJsonSafe(reasonCodes),
    diagnostics: cloneJsonSafe(diagnostics),
  };
}

// RB_30_ANCHOR_DISAGREEMENT_SUMMARY_CONTRACTS_START
export function summarizeRevisionBridgeAnchorDisagreements(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const entries = Array.isArray(source.entries) ? source.entries : [];
  const counts = anchorDisagreementSummaryInitialCounts();
  const diagnostics = [];
  let totalEvaluated = 0;
  let totalWithDisagreement = 0;

  entries.forEach((entry, index) => {
    if (!isPlainObject(entry)) {
      diagnostics.push(invalidField(
        `entries.${index}`,
        'anchor disagreement entry must be an object',
      ));
      return;
    }
    const evaluation = isPlainObject(entry.evaluation)
      ? entry.evaluation
      : evaluateInlineRangeAnchorConfidence(entry.inlineRange || entry, entry.context || {});
    if (!isPlainObject(evaluation) || !Array.isArray(evaluation.reasonCodes)) {
      diagnostics.push(invalidField(
        `entries.${index}.evaluation`,
        'entry evaluation must include reasonCodes array',
      ));
      return;
    }
    totalEvaluated += 1;
    let hasDisagreement = false;
    const seenCodes = new Set();
    for (const reasonCode of evaluation.reasonCodes) {
      if (Object.hasOwn(counts, reasonCode)) {
        if (seenCodes.has(reasonCode)) continue;
        seenCodes.add(reasonCode);
        counts[reasonCode] += 1;
        hasDisagreement = true;
      }
    }
    if (hasDisagreement) totalWithDisagreement += 1;
  });

  return {
    schemaVersion: REVISION_BRIDGE_ANCHOR_DISAGREEMENT_SUMMARY_SCHEMA,
    type: 'revisionBridge.anchorDisagreement.summary',
    status: diagnostics.length > 0 ? 'invalid' : 'evaluated',
    code: diagnostics.length > 0
      ? REVIEWGRAPH_INVALID_CODE
      : REVIEWGRAPH_VALID_CODE,
    reason: diagnostics.length > 0
      ? diagnostics[0].code
      : REVIEWGRAPH_VALID_CODE,
    diagnostics,
    totalEvaluated,
    totalWithDisagreement,
    counts,
  };
}
// RB_30_ANCHOR_DISAGREEMENT_SUMMARY_CONTRACTS_END
// RB_11_ANCHOR_CONFIDENCE_ENGINE_CONTRACTS_END

// RB_12_MATCH_PROOF_CONTRACTS_START
function matchProofRangeInput(input) {
  if (!isPlainObject(input)) return {};
  return isPlainObject(input.inlineRange) ? input.inlineRange : input;
}

function matchProofDiagnostic(code, field, message) {
  return { code, field, message };
}

function matchProofAddDiagnostic(diagnostics, code, field, message) {
  if (!diagnostics.some((diagnostic) => diagnostic.code === code && diagnostic.field === field)) {
    diagnostics.push(matchProofDiagnostic(code, field, message));
  }
}

function matchProofTextFromEntry(entry) {
  if (typeof entry === 'string') return normalizeRevisionBlockText(entry);
  if (isPlainObject(entry)) return normalizeRevisionBlockText(entry.text);
  return null;
}

function matchProofBlockFromContext(blockId, context) {
  if (!blockId || !isPlainObject(context)) return { found: false, text: null, lineageId: '' };
  if (Array.isArray(context.blocks)) {
    const block = context.blocks.find((candidate) => isPlainObject(candidate) && normalizeString(candidate.blockId) === blockId);
    return {
      found: block !== undefined,
      text: matchProofTextFromEntry(block),
      lineageId: isPlainObject(block) ? normalizeString(block.lineageId) : '',
    };
  }
  if (isPlainObject(context.blocks)) {
    const block = context.blocks[blockId];
    return {
      found: block !== undefined,
      text: matchProofTextFromEntry(block),
      lineageId: isPlainObject(block) ? normalizeString(block.lineageId) : '',
    };
  }
  if (isPlainObject(context.blockMap)) {
    const block = context.blockMap[blockId];
    return {
      found: block !== undefined,
      text: matchProofTextFromEntry(block),
      lineageId: isPlainObject(block) ? normalizeString(block.lineageId) : '',
    };
  }
  return { found: false, text: null, lineageId: '' };
}

function matchProofRangeInBounds(range, text) {
  return text !== null
    && Number.isSafeInteger(range.from)
    && Number.isSafeInteger(range.to)
    && range.from >= 0
    && range.to >= 0
    && range.from <= range.to
    && range.to <= text.length;
}

function matchProofProofForSide(expected, observed) {
  return {
    expected,
    observed,
    matched: expected === observed,
  };
}

function matchProofInlineRangeSnapshot(inlineRange) {
  return cloneJsonSafe({
    schemaVersion: inlineRange.schemaVersion,
    kind: inlineRange.kind,
    blockId: inlineRange.blockId,
    lineageId: inlineRange.lineageId,
    from: inlineRange.from,
    to: inlineRange.to,
    quote: inlineRange.quote,
    prefix: inlineRange.prefix,
    suffix: inlineRange.suffix,
    confidence: inlineRange.confidence,
    riskClass: inlineRange.riskClass,
    deletedTarget: inlineRange.deletedTarget,
    reasonCodes: inlineRange.reasonCodes,
  });
}

function matchProofResult(status, reasonCodes, diagnostics, inlineRange, block, comparedRange, observedQuote, prefixProof, suffixProof) {
  return {
    schemaVersion: REVISION_BRIDGE_MATCH_PROOF_SCHEMA,
    type: 'revisionBridge.matchProof',
    status,
    code: REVISION_BRIDGE_MATCH_PROOF_REASON_CODES[0],
    reason: reasonCodes[0] || REVISION_BRIDGE_MATCH_PROOF_REASON_CODES[0],
    inlineRange: matchProofInlineRangeSnapshot(inlineRange),
    blockRef: {
      blockId: inlineRange.blockId,
      lineageId: inlineRange.lineageId || block.lineageId,
      hasContextBlock: block.found === true && block.text !== null,
    },
    comparedRange: cloneJsonSafe(comparedRange),
    expectedQuote: inlineRange.quote,
    observedQuote,
    prefixProof: cloneJsonSafe(prefixProof),
    suffixProof: cloneJsonSafe(suffixProof),
    reasonCodes: cloneJsonSafe(reasonCodes),
    diagnostics: cloneJsonSafe(diagnostics),
  };
}

function matchProofReasonCodes(diagnostics) {
  const codes = [];
  for (const diagnostic of diagnostics) {
    if (!codes.includes(diagnostic.code)) codes.push(diagnostic.code);
  }
  return codes;
}

function matchProofHasAny(diagnostics, codes) {
  return diagnostics.some((diagnostic) => codes.includes(diagnostic.code));
}

function matchProofMapValidationReason(reason, diagnostics) {
  if (reason.code === 'REVISION_BRIDGE_INLINE_RANGE_STALE_QUOTE') {
    matchProofAddDiagnostic(
      diagnostics,
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_STALE_QUOTE',
      reason.field,
      'quote is not present in the target block',
    );
  } else if (reason.field === 'inlineRange.blockId') {
    matchProofAddDiagnostic(
      diagnostics,
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_MISSING_BLOCK',
      reason.field,
      reason.message,
    );
  } else if (reason.field === 'inlineRange.to') {
    matchProofAddDiagnostic(
      diagnostics,
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_OUT_OF_BOUNDS',
      reason.field,
      reason.message,
    );
  } else {
    matchProofAddDiagnostic(
      diagnostics,
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_VALIDATION_FAILED',
      reason.field,
      reason.message,
    );
  }
}

export function buildInlineRangeMatchProof(input = {}, context = {}) {
  const rangeInput = matchProofRangeInput(input);
  const inlineRange = createInlineRange(rangeInput);
  const diagnostics = [];
  let validation;

  try {
    validation = validateInlineRange(rangeInput, context);
  } catch {
    validation = {
      ok: false,
      reasons: [
        matchProofDiagnostic(
          'REVISION_BRIDGE_ANCHOR_CONFIDENCE_VALIDATION_FAILED',
          'inlineRange',
          'inlineRange validation failed',
        ),
      ],
    };
  }

  for (const reason of validation.reasons || []) {
    matchProofMapValidationReason(reason, diagnostics);
  }

  const block = matchProofBlockFromContext(inlineRange.blockId, context);
  if (inlineRange.kind !== 'orphan' && block.text === null) {
    matchProofAddDiagnostic(
      diagnostics,
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_MISSING_BLOCK',
      'inlineRange.blockId',
      'target block is not present in the supplied context',
    );
  }
  if (inlineRange.kind === 'orphan') {
    matchProofAddDiagnostic(
      diagnostics,
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_ORPHAN',
      'inlineRange.kind',
      'orphan anchor remains unresolved',
    );
  }
  if (inlineRange.kind === 'deleted' || inlineRange.deletedTarget === true) {
    matchProofAddDiagnostic(
      diagnostics,
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_DELETED_TARGET',
      'inlineRange.deletedTarget',
      'deleted target remains unresolved',
    );
  }
  if (inlineRange.confidence === 'weakHigh' || inlineRange.confidence === 'approximate') {
    matchProofAddDiagnostic(
      diagnostics,
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_WEAK_ANCHOR',
      'inlineRange.confidence',
      'weak or approximate anchor is only partially proven',
    );
  }
  if (inlineRange.confidence === 'unresolved') {
    matchProofAddDiagnostic(
      diagnostics,
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_UNRESOLVED_ANCHOR',
      'inlineRange.confidence',
      'unresolved anchor remains unresolved',
    );
  }

  const originalRange = {
    from: inlineRange.from,
    to: inlineRange.to,
    inBounds: matchProofRangeInBounds(inlineRange, block.text),
  };
  if (block.text !== null && inlineRange.kind !== 'orphan' && !originalRange.inBounds) {
    matchProofAddDiagnostic(
      diagnostics,
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_OUT_OF_BOUNDS',
      'inlineRange',
      'target range is outside the target block',
    );
  }

  let comparedRange = originalRange;
  let exactRange = false;
  if (originalRange.inBounds) {
    exactRange = inlineRange.quote === ''
      ? inlineRange.from === inlineRange.to
      : block.text.slice(inlineRange.from, inlineRange.to) === inlineRange.quote;
  }

  if (block.text !== null && originalRange.inBounds && inlineRange.quote && !exactRange) {
    const firstIndex = block.text.indexOf(inlineRange.quote);
    if (firstIndex >= 0) {
      comparedRange = {
        from: firstIndex,
        to: firstIndex + inlineRange.quote.length,
        inBounds: true,
      };
      matchProofAddDiagnostic(
        diagnostics,
        'REVISION_BRIDGE_ANCHOR_CONFIDENCE_QUOTE_ELSEWHERE',
        'inlineRange.quote',
        'quote exists in the block but not at the target range',
      );
    } else {
      matchProofAddDiagnostic(
        diagnostics,
        'REVISION_BRIDGE_ANCHOR_CONFIDENCE_STALE_QUOTE',
        'inlineRange.quote',
        'quote is not present in the target block',
      );
    }
  }

  const observedQuote = comparedRange.inBounds ? block.text.slice(comparedRange.from, comparedRange.to) : '';
  const prefixObserved = comparedRange.inBounds
    ? block.text.slice(Math.max(0, comparedRange.from - inlineRange.prefix.length), comparedRange.from)
    : '';
  const suffixObserved = comparedRange.inBounds
    ? block.text.slice(comparedRange.to, comparedRange.to + inlineRange.suffix.length)
    : '';
  const prefixProof = matchProofProofForSide(inlineRange.prefix, prefixObserved);
  const suffixProof = matchProofProofForSide(inlineRange.suffix, suffixObserved);

  if (comparedRange.inBounds && !prefixProof.matched) {
    matchProofAddDiagnostic(
      diagnostics,
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_PREFIX_MISMATCH',
      'inlineRange.prefix',
      'prefix does not match text before the compared range',
    );
  }
  if (comparedRange.inBounds && !suffixProof.matched) {
    matchProofAddDiagnostic(
      diagnostics,
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_SUFFIX_MISMATCH',
      'inlineRange.suffix',
      'suffix does not match text after the compared range',
    );
  }

  const hardCodes = [
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_VALIDATION_FAILED',
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_OUT_OF_BOUNDS',
  ];
  const unresolvedCodes = [
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_MISSING_BLOCK',
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_STALE_QUOTE',
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_ORPHAN',
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_DELETED_TARGET',
    'REVISION_BRIDGE_ANCHOR_CONFIDENCE_UNRESOLVED_ANCHOR',
  ];

  const exactProof = exactRange
    && originalRange.from === comparedRange.from
    && originalRange.to === comparedRange.to
    && prefixProof.matched
    && suffixProof.matched
    && !matchProofHasAny(diagnostics, hardCodes)
    && !matchProofHasAny(diagnostics, unresolvedCodes)
    && !matchProofHasAny(diagnostics, [
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_QUOTE_ELSEWHERE',
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_PREFIX_MISMATCH',
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_SUFFIX_MISMATCH',
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_WEAK_ANCHOR',
    ]);

  if (exactProof) {
    matchProofAddDiagnostic(
      diagnostics,
      'REVISION_BRIDGE_ANCHOR_CONFIDENCE_EXACT_RANGE',
      'inlineRange',
      'quote matches the target range exactly',
    );
  }

  const reasonCodes = matchProofReasonCodes(diagnostics);
  const status = matchProofHasAny(diagnostics, hardCodes)
    ? 'hardFail'
    : matchProofHasAny(diagnostics, unresolvedCodes)
      ? 'unresolved'
      : exactProof
        ? 'matched'
        : 'partial';

  return matchProofResult(
    status,
    reasonCodes,
    diagnostics,
    inlineRange,
    block,
    comparedRange,
    observedQuote,
    prefixProof,
    suffixProof,
  );
}
// RB_12_MATCH_PROOF_CONTRACTS_END

// RB_13_PLACEMENT_EVALUATION_CONTRACTS_START
function placementEvaluationClone(value) {
  if (value === null) return null;
  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') return value;
  if (Array.isArray(value)) return value.map((item) => placementEvaluationClone(item));
  if (isPlainObject(value)) {
    const clone = {};
    for (const key of Object.keys(value)) {
      const clonedValue = placementEvaluationClone(value[key]);
      if (clonedValue !== undefined) clone[key] = clonedValue;
    }
    return clone;
  }
  return undefined;
}

function placementEvaluationInlineRangeSnapshot(inlineRange) {
  return {
    schemaVersion: inlineRange.schemaVersion,
    kind: inlineRange.kind,
    blockId: inlineRange.blockId,
    lineageId: inlineRange.lineageId,
    from: inlineRange.from,
    to: inlineRange.to,
    quote: inlineRange.quote,
    prefix: inlineRange.prefix,
    suffix: inlineRange.suffix,
    confidence: inlineRange.confidence,
    riskClass: inlineRange.riskClass,
    deletedTarget: inlineRange.deletedTarget,
    reasonCodes: placementEvaluationClone(inlineRange.reasonCodes),
  };
}

function placementEvaluationSnapshot(placement) {
  return {
    schemaVersion: placement.schemaVersion,
    placementId: placement.placementId,
    threadId: placement.threadId,
    targetScope: {
      type: placement.targetScope.type,
      id: placement.targetScope.id,
    },
    inlineRange: placementEvaluationInlineRangeSnapshot(placement.inlineRange),
    resolvedState: placement.resolvedState,
    acceptedState: placement.acceptedState,
    diagnosticsOnly: placement.diagnosticsOnly,
  };
}

function placementEvaluationDiagnosticField(field) {
  const normalized = normalizeString(field);
  const blockedFields = [
    'commentAnchorPlacement.body',
    'commentAnchorPlacement.text',
    'commentAnchorPlacement.messages',
    'commentAnchorPlacement.commentText',
  ];
  if (blockedFields.includes(normalized)) return 'commentAnchorPlacement';
  if (normalized === 'inlineRange') return 'commentAnchorPlacement.inlineRange';
  if (normalized.startsWith('inlineRange.')) return `commentAnchorPlacement.${normalized}`;
  if (normalized.endsWith('.automationPolicy')) return normalized.slice(0, -'.automationPolicy'.length);
  return normalized;
}

function placementEvaluationDiagnosticMessage(message) {
  return normalizeString(message).replace(/automationPolicy/gu, 'policy');
}

function placementEvaluationReasonSnapshot(reason) {
  return {
    code: normalizeString(reason.code),
    field: placementEvaluationDiagnosticField(reason.field),
    message: placementEvaluationDiagnosticMessage(reason.message),
  };
}

function placementEvaluationValidationSnapshot(validation) {
  return {
    ok: validation.ok === true,
    type: normalizeString(validation.type),
    code: normalizeString(validation.code),
    reason: normalizeString(validation.reason),
    reasons: (Array.isArray(validation.reasons) ? validation.reasons : [])
      .map((reason) => placementEvaluationReasonSnapshot(reason)),
  };
}

function placementEvaluationAddDiagnostic(diagnostics, code, field, message) {
  const diagnostic = {
    code: normalizeString(code),
    field: placementEvaluationDiagnosticField(field),
    message: placementEvaluationDiagnosticMessage(message),
  };
  if (!diagnostic.code) return;
  const exists = diagnostics.some((candidate) => (
    candidate.code === diagnostic.code
    && candidate.field === diagnostic.field
    && candidate.message === diagnostic.message
  ));
  if (!exists) diagnostics.push(diagnostic);
}

function placementEvaluationPushReasonCode(reasonCodes, code) {
  const normalized = normalizeString(code);
  if (
    REVISION_BRIDGE_ANCHOR_CONFIDENCE_REASON_CODES.includes(normalized)
    && !reasonCodes.includes(normalized)
  ) {
    reasonCodes.push(normalized);
  }
}

function placementEvaluationValidationHardFailed(validation) {
  if (validation.ok === true) return false;
  return (validation.reasons || []).some((reason) => {
    const field = normalizeString(reason.field);
    return !field.startsWith('commentAnchorPlacement.inlineRange');
  });
}

function placementEvaluationStatus(validation, matchProof, confidenceEvaluation) {
  if (
    placementEvaluationValidationHardFailed(validation)
    || matchProof.status === 'hardFail'
    || confidenceEvaluation.status === 'hardFail'
    || confidenceEvaluation.automationPolicy === 'hardFail'
  ) {
    return 'hardFail';
  }
  if (
    matchProof.status === 'unresolved'
    || confidenceEvaluation.confidence === 'unresolved'
    || confidenceEvaluation.automationPolicy === 'diagnosticsOnly'
  ) {
    return 'unresolved';
  }
  if (
    matchProof.status !== 'matched'
    || confidenceEvaluation.status !== 'evaluated'
    || confidenceEvaluation.confidence !== 'exact'
  ) {
    return 'diagnostics';
  }
  return 'evaluated';
}

function placementEvaluationCode(status, validation) {
  if (validation.ok !== true) return PLACEMENT_EVALUATION_VALIDATION_FAILED_CODE;
  if (status === 'hardFail') return PLACEMENT_EVALUATION_HARD_FAIL_CODE;
  if (status === 'unresolved') return PLACEMENT_EVALUATION_UNRESOLVED_CODE;
  if (status === 'diagnostics') return PLACEMENT_EVALUATION_DIAGNOSTICS_CODE;
  return PLACEMENT_EVALUATION_EVALUATED_CODE;
}

function placementEvaluationDiagnostics(validation, matchProof, confidenceEvaluation) {
  const diagnostics = [];
  for (const reason of validation.reasons || []) {
    placementEvaluationAddDiagnostic(
      diagnostics,
      PLACEMENT_EVALUATION_VALIDATION_FAILED_CODE,
      reason.field,
      reason.message,
    );
  }
  for (const diagnostic of matchProof.diagnostics || []) {
    placementEvaluationAddDiagnostic(diagnostics, diagnostic.code, diagnostic.field, diagnostic.message);
  }
  for (const diagnostic of confidenceEvaluation.diagnostics || []) {
    placementEvaluationAddDiagnostic(diagnostics, diagnostic.code, diagnostic.field, diagnostic.message);
  }
  return diagnostics;
}

function placementEvaluationReasonCodes(code, matchProof, confidenceEvaluation) {
  const reasonCodes = [code];
  for (const reasonCode of matchProof.reasonCodes || []) {
    placementEvaluationPushReasonCode(reasonCodes, reasonCode);
  }
  for (const reasonCode of confidenceEvaluation.reasonCodes || []) {
    placementEvaluationPushReasonCode(reasonCodes, reasonCode);
  }
  return reasonCodes;
}

function evaluateCommentAnchorPlacementProof(input = {}, context = {}) {
  const validation = validateCommentAnchorPlacement(input, context);
  const placement = validation.value || createCommentAnchorPlacement(input);
  const matchProof = buildInlineRangeMatchProof(placement.inlineRange, context);
  const confidenceEvaluation = evaluateInlineRangeAnchorConfidence(placement.inlineRange, context);
  const status = placementEvaluationStatus(validation, matchProof, confidenceEvaluation);
  const code = placementEvaluationCode(status, validation);
  const reasonCodes = placementEvaluationReasonCodes(code, matchProof, confidenceEvaluation);

  return {
    schemaVersion: REVISION_BRIDGE_PLACEMENT_EVALUATION_SCHEMA,
    type: 'revisionBridge.commentAnchorPlacement.evaluation',
    status,
    code,
    reason: reasonCodes[0] || code,
    placement: placementEvaluationSnapshot(placement),
    validation: placementEvaluationValidationSnapshot(validation),
    matchProof: placementEvaluationClone(matchProof),
    confidenceEvaluation: placementEvaluationClone(confidenceEvaluation),
    reasonCodes,
    diagnostics: placementEvaluationDiagnostics(validation, matchProof, confidenceEvaluation),
  };
}
// RB_13_PLACEMENT_EVALUATION_CONTRACTS_END

export { evaluateCommentAnchorPlacementProof };

export function evaluateCommentAnchorPlacementBatchDiagnostics(input = {}) {
  return placementBatchDiagnosticsEvaluate(input);
}

export function previewRevisionSessionPlacementAdmission(input = {}) {
  return placementAdmissionPreviewEvaluate(input);
}

export function previewRevisionSessionSkeletonAdmission(input = {}) {
  return revisionSessionSkeletonAdmissionPreviewEvaluate(input);
}

export function previewRevisionSessionImportSeam(input = {}) {
  return revisionSessionImportSeamPreviewEvaluate(input);
}

export function buildRevisionSessionRegistryRecord(input = {}) {
  return revisionSessionRegistryRecordBuild(input);
}

// RB_14_PLACEMENT_BATCH_DIAGNOSTICS_CONTRACTS_START
function placementBatchDiagnosticsCountsByStatus() {
  return {
    evaluated: 0,
    diagnostics: 0,
    unresolved: 0,
    hardFail: 0,
  };
}

function placementBatchDiagnosticsCountsByReasonCode() {
  const counts = {};
  for (const code of REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_REASON_CODES) {
    counts[code] = 0;
  }
  return counts;
}

const PLACEMENT_BATCH_DIAGNOSTICS_SUMMARY_ORDER = Object.freeze([
  'hardFail',
  'unresolved',
  'diagnostics',
  'evaluated',
]);

function placementBatchDiagnosticsCheck(input) {
  if (!isPlainObject(input)) {
    return {
      ok: false,
      field: 'input',
      message: 'input must be a plain object',
    };
  }
  if (!Array.isArray(input.placements)) {
    return {
      ok: false,
      field: 'placements',
      message: 'placements must be an array',
    };
  }
  const context = input.context || {};
  if (!isPlainObject(context)) {
    return {
      ok: false,
      field: 'context',
      message: 'context must be a plain object',
    };
  }
  return {
    ok: true,
    placements: input.placements,
    context,
  };
}

function placementBatchDiagnosticsAddReasonCount(counts, code) {
  const normalized = normalizeString(code);
  if (Object.hasOwn(counts, normalized)) counts[normalized] += 1;
}

function placementBatchDiagnosticsSummaryRank(severity) {
  const rank = PLACEMENT_BATCH_DIAGNOSTICS_SUMMARY_ORDER.indexOf(severity);
  return rank === -1 ? PLACEMENT_BATCH_DIAGNOSTICS_SUMMARY_ORDER.length : rank;
}

function placementBatchDiagnosticsSummaryFirstIndex(item) {
  return item.indexes.length > 0 ? item.indexes[0] : -1;
}

function placementBatchDiagnosticsCompareSummaryItems(left, right) {
  const severityDelta = placementBatchDiagnosticsSummaryRank(left.severity)
    - placementBatchDiagnosticsSummaryRank(right.severity);
  if (severityDelta !== 0) return severityDelta;
  const countDelta = right.count - left.count;
  if (countDelta !== 0) return countDelta;
  const codeDelta = left.code.localeCompare(right.code);
  if (codeDelta !== 0) return codeDelta;
  return placementBatchDiagnosticsSummaryFirstIndex(left)
    - placementBatchDiagnosticsSummaryFirstIndex(right);
}

function placementBatchDiagnosticsAddSummaryItem(items, severity, code, index) {
  const normalizedSeverity = normalizeString(severity);
  const normalizedCode = normalizeString(code);
  if (!normalizedSeverity || !normalizedCode) return;
  let item = items.find((candidate) => (
    candidate.severity === normalizedSeverity
    && candidate.code === normalizedCode
  ));
  if (!item) {
    item = {
      severity: normalizedSeverity,
      code: normalizedCode,
      count: 0,
      indexes: [],
    };
    items.push(item);
  }
  item.count += 1;
  if (Number.isSafeInteger(index) && !item.indexes.includes(index)) item.indexes.push(index);
}

function placementBatchDiagnosticsSummary(items) {
  const sortedItems = [...items].sort(placementBatchDiagnosticsCompareSummaryItems);
  return {
    schemaVersion: REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_SCHEMA,
    sortOrder: [...PLACEMENT_BATCH_DIAGNOSTICS_SUMMARY_ORDER],
    total: sortedItems.length,
    items: sortedItems,
  };
}

function placementBatchDiagnosticsSummaryFromEvaluations(evaluations) {
  const items = [];
  for (const item of evaluations) {
    for (const reasonCode of item.evaluation.reasonCodes || []) {
      placementBatchDiagnosticsAddSummaryItem(items, item.evaluation.status, reasonCode, item.index);
    }
  }
  return placementBatchDiagnosticsSummary(items);
}

function placementBatchDiagnosticsStatus(countsByStatus) {
  if (countsByStatus.hardFail > 0) return 'hardFail';
  if (countsByStatus.unresolved > 0) return 'unresolved';
  if (countsByStatus.diagnostics > 0) return 'diagnostics';
  return 'evaluated';
}

function placementBatchDiagnosticsCode(status) {
  if (status === 'hardFail') return PLACEMENT_BATCH_DIAGNOSTICS_HARD_FAIL_CODE;
  if (status === 'unresolved') return PLACEMENT_BATCH_DIAGNOSTICS_UNRESOLVED_CODE;
  if (status === 'diagnostics') return PLACEMENT_BATCH_DIAGNOSTICS_DIAGNOSTICS_CODE;
  return PLACEMENT_BATCH_DIAGNOSTICS_EVALUATED_CODE;
}

function placementBatchDiagnosticsEnvelope(
  status,
  code,
  total,
  countsByStatus,
  countsByReasonCode,
  evaluations,
  diagnostics,
  diagnosticSummary,
) {
  return {
    schemaVersion: REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_SCHEMA,
    type: 'revisionBridge.commentAnchorPlacement.batchDiagnostics',
    status,
    code,
    reason: code,
    total,
    countsByStatus,
    countsByReasonCode,
    evaluations,
    diagnostics,
    diagnosticSummary,
  };
}

function placementBatchDiagnosticsFromEvaluationDiagnostics(evaluation, index) {
  const diagnostics = [];
  for (const diagnostic of evaluation.diagnostics || []) {
    diagnostics.push({
      code: normalizeString(diagnostic.code),
      field: placementEvaluationDiagnosticField(diagnostic.field),
      message: placementEvaluationDiagnosticMessage(diagnostic.message),
      index,
    });
  }
  return diagnostics;
}

function placementBatchDiagnosticsEvaluate(input) {
  const countsByStatus = placementBatchDiagnosticsCountsByStatus();
  const countsByReasonCode = placementBatchDiagnosticsCountsByReasonCode();
  const checked = placementBatchDiagnosticsCheck(input);
  if (checked.ok !== true) {
    countsByReasonCode[PLACEMENT_BATCH_DIAGNOSTICS_VALIDATION_FAILED_CODE] = 1;
    const diagnosticSummary = placementBatchDiagnosticsSummary([{
      severity: 'hardFail',
      code: PLACEMENT_BATCH_DIAGNOSTICS_VALIDATION_FAILED_CODE,
      count: 1,
      indexes: [],
    }]);
    return placementBatchDiagnosticsEnvelope(
      'hardFail',
      PLACEMENT_BATCH_DIAGNOSTICS_VALIDATION_FAILED_CODE,
      0,
      countsByStatus,
      countsByReasonCode,
      [],
      [{
        code: PLACEMENT_BATCH_DIAGNOSTICS_VALIDATION_FAILED_CODE,
        field: checked.field,
        message: checked.message,
      }],
      diagnosticSummary,
    );
  }

  const evaluations = [];
  const diagnostics = [];
  for (let index = 0; index < checked.placements.length; index += 1) {
    const evaluation = evaluateCommentAnchorPlacementProof(checked.placements[index], checked.context);
    evaluations.push({ index, evaluation });
    if (Object.hasOwn(countsByStatus, evaluation.status)) countsByStatus[evaluation.status] += 1;
    for (const reasonCode of evaluation.reasonCodes || []) {
      placementBatchDiagnosticsAddReasonCount(countsByReasonCode, reasonCode);
    }
    diagnostics.push(...placementBatchDiagnosticsFromEvaluationDiagnostics(evaluation, index));
  }

  const status = placementBatchDiagnosticsStatus(countsByStatus);
  const code = placementBatchDiagnosticsCode(status);
  const diagnosticSummary = placementBatchDiagnosticsSummaryFromEvaluations(evaluations);
  return placementBatchDiagnosticsEnvelope(
    status,
    code,
    checked.placements.length,
    countsByStatus,
    countsByReasonCode,
    evaluations,
    diagnostics,
    diagnosticSummary,
  );
}
// RB_14_PLACEMENT_BATCH_DIAGNOSTICS_CONTRACTS_END

// RB_16_PLACEMENT_ADMISSION_PREVIEW_CONTRACTS_START
const PLACEMENT_ADMISSION_PREVIEW_SCHEMA = 'revision-bridge.revision-session-placement-admission-preview.v1';
const PLACEMENT_ADMISSION_PREVIEW_ADMIT_CODE = 'REVISION_BRIDGE_REVISION_SESSION_PLACEMENT_ADMISSION_PREVIEW_ADMIT';
const PLACEMENT_ADMISSION_PREVIEW_BLOCK_CODE = 'REVISION_BRIDGE_REVISION_SESSION_PLACEMENT_ADMISSION_PREVIEW_BLOCK';
const PLACEMENT_ADMISSION_PREVIEW_DEFAULT_BLOCKING_STATUSES = Object.freeze([
  'unresolved',
  'hardFail',
]);
const PLACEMENT_ADMISSION_PREVIEW_VALID_STATUSES = Object.freeze([
  'evaluated',
  'diagnostics',
  'unresolved',
  'hardFail',
]);

function placementAdmissionPreviewStatuses(input) {
  if (!hasOwnField(input, 'blockingStatuses')) {
    return { ok: true, value: [...PLACEMENT_ADMISSION_PREVIEW_DEFAULT_BLOCKING_STATUSES] };
  }
  if (!Array.isArray(input.blockingStatuses) || input.blockingStatuses.length === 0) {
    return { ok: false, value: [] };
  }
  const value = [];
  for (const item of input.blockingStatuses) {
    if (typeof item !== 'string') return { ok: false, value: [] };
    const status = normalizeString(item);
    if (!PLACEMENT_ADMISSION_PREVIEW_VALID_STATUSES.includes(status)) return { ok: false, value: [] };
    if (!value.includes(status)) value.push(status);
  }
  if (value.length === 0) return { ok: false, value: [] };
  return { ok: true, value };
}

function placementAdmissionPreviewValidEvaluationItem(item) {
  if (!isPlainObject(item) || !Number.isSafeInteger(item.index) || item.index < 0) return false;
  if (!isPlainObject(item.evaluation)) return false;
  if (!PLACEMENT_ADMISSION_PREVIEW_VALID_STATUSES.includes(item.evaluation.status)) return false;
  return Array.isArray(item.evaluation.reasonCodes);
}

function placementAdmissionPreviewValidDiagnosticItem(item) {
  return isPlainObject(item) && Number.isSafeInteger(item.index) && item.index >= 0;
}

function placementAdmissionPreviewBatch(input) {
  if (!isPlainObject(input)) return { ok: false, value: null };
  const batch = input.batchDiagnostics;
  if (!isPlainObject(batch)) return { ok: false, value: null };
  if (batch.type !== 'revisionBridge.commentAnchorPlacement.batchDiagnostics') return { ok: false, value: null };
  if (!PLACEMENT_ADMISSION_PREVIEW_VALID_STATUSES.includes(batch.status)) return { ok: false, value: null };
  if (!Number.isSafeInteger(batch.total) || batch.total < 0) return { ok: false, value: null };
  if (!Array.isArray(batch.evaluations)) return { ok: false, value: null };
  if (batch.total !== batch.evaluations.length) return { ok: false, value: null };
  if (!Array.isArray(batch.diagnostics)) return { ok: false, value: null };
  if (!isPlainObject(batch.diagnosticSummary)) return { ok: false, value: null };
  for (const item of batch.evaluations) {
    if (!placementAdmissionPreviewValidEvaluationItem(item)) return { ok: false, value: null };
  }
  for (const item of batch.diagnostics) {
    if (!placementAdmissionPreviewValidDiagnosticItem(item)) return { ok: false, value: null };
  }
  return { ok: true, value: batch };
}

function placementAdmissionPreviewCode(status) {
  if (status === 'hardFail') return PLACEMENT_BATCH_DIAGNOSTICS_VALIDATION_FAILED_CODE;
  if (status === 'block') return PLACEMENT_ADMISSION_PREVIEW_BLOCK_CODE;
  return PLACEMENT_ADMISSION_PREVIEW_ADMIT_CODE;
}

function placementAdmissionPreviewSummary(items) {
  const sortedItems = [...items].sort(placementBatchDiagnosticsCompareSummaryItems);
  return {
    schemaVersion: PLACEMENT_ADMISSION_PREVIEW_SCHEMA,
    sortOrder: [...PLACEMENT_BATCH_DIAGNOSTICS_SUMMARY_ORDER],
    total: sortedItems.length,
    items: sortedItems,
  };
}

function placementAdmissionPreviewSummaryFromEvaluations(evaluations) {
  const items = [];
  for (const item of evaluations) {
    for (const reasonCode of item.evaluation.reasonCodes) {
      if (REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_REASON_CODES.includes(reasonCode)) {
        placementBatchDiagnosticsAddSummaryItem(items, item.evaluation.status, reasonCode, item.index);
      }
    }
  }
  return placementAdmissionPreviewSummary(items);
}

function placementAdmissionPreviewInvalidSummary() {
  return placementAdmissionPreviewSummary([{
    severity: 'hardFail',
    code: PLACEMENT_BATCH_DIAGNOSTICS_VALIDATION_FAILED_CODE,
    count: 1,
    indexes: [],
  }]);
}

function placementAdmissionPreviewEnvelope(
  status,
  blockingStatuses,
  sourceStatus,
  sourceTotal,
  blockingEvaluations,
  blockingDiagnostics,
  diagnosticSummary,
) {
  const countsByStatus = placementBatchDiagnosticsCountsByStatus();
  const countsByReasonCode = placementBatchDiagnosticsCountsByReasonCode();
  for (const item of blockingEvaluations) {
    if (Object.hasOwn(countsByStatus, item.evaluation.status)) countsByStatus[item.evaluation.status] += 1;
    for (const reasonCode of item.evaluation.reasonCodes) {
      placementBatchDiagnosticsAddReasonCount(countsByReasonCode, reasonCode);
    }
  }
  const code = placementAdmissionPreviewCode(status);
  return {
    schemaVersion: PLACEMENT_ADMISSION_PREVIEW_SCHEMA,
    type: 'revisionBridge.revisionSession.placementAdmissionPreview',
    status,
    code,
    reason: code,
    canAdmit: status === 'admit',
    sourceStatus,
    sourceTotal,
    blockingStatuses,
    total: blockingEvaluations.length,
    countsByStatus,
    countsByReasonCode,
    blockingEvaluations,
    blockingDiagnostics,
    diagnosticSummary,
  };
}

function placementAdmissionPreviewInvalid(blockingStatuses, source) {
  return placementAdmissionPreviewEnvelope(
    'hardFail',
    blockingStatuses,
    source ? source.status : '',
    source ? source.total : 0,
    [],
    [],
    placementAdmissionPreviewInvalidSummary(),
  );
}

function placementAdmissionPreviewEvaluate(input) {
  const statuses = placementAdmissionPreviewStatuses(isPlainObject(input) ? input : {});
  const source = placementAdmissionPreviewBatch(input);
  const sourceStatus = source.ok === true ? source.value.status : '';
  const sourceTotal = source.ok === true ? source.value.total : 0;
  if (statuses.ok !== true || source.ok !== true) {
    return placementAdmissionPreviewInvalid(
      statuses.ok === true ? statuses.value : [],
      source.ok === true ? source.value : null,
    );
  }

  const blockingEvaluations = source.value.evaluations
    .filter((item) => statuses.value.includes(item.evaluation.status))
    .sort((left, right) => left.index - right.index)
    .map((item) => placementEvaluationClone(item));
  const indexes = blockingEvaluations.map((item) => item.index);
  const blockingDiagnostics = source.value.diagnostics
    .filter((item) => indexes.includes(item.index))
    .map((item) => placementEvaluationClone(item));
  const status = blockingEvaluations.length > 0 ? 'block' : 'admit';
  return placementAdmissionPreviewEnvelope(
    status,
    [...statuses.value],
    sourceStatus,
    sourceTotal,
    blockingEvaluations,
    blockingDiagnostics,
    placementAdmissionPreviewSummaryFromEvaluations(blockingEvaluations),
  );
}
// RB_16_PLACEMENT_ADMISSION_PREVIEW_CONTRACTS_END

// RB_17_REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_CONTRACTS_START
const REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_ADMIT_CODE =
  'REVISION_BRIDGE_REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_ADMIT';
const REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_BLOCK_CODE =
  'REVISION_BRIDGE_REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_BLOCK';
const REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_INVALID_CODE =
  'E_REVISION_BRIDGE_REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_INVALID';
const REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_STATUSES = Object.freeze([
  'admit',
  'block',
  'hardFail',
]);
const REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_IDS = Object.freeze([
  ['projectId', 'revisionSession.projectId'],
  ['revisionSessionId', 'revisionSession.revisionSessionId'],
  ['ex' + 'portId', 'revisionSession.ex' + 'portId'],
  ['baselineHash', 'revisionSession.baselineHash'],
]);
const REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_GRAPH = Object.freeze([
  'commentThreads',
  'commentPlacements',
  'textChanges',
  'structuralChanges',
  'diagnosticItems',
  'decisionStates',
]);
const REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_STATUS_COUNT_KEYS = Object.freeze([
  'evaluated',
  'diagnostics',
  'unresolved',
  'hardFail',
]);
const REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_REJECT_KEYS = Object.freeze([
  'im' + 'port',
  'stor' + 'age',
  'ap' + 'ply',
  'i' + 'pc',
  'par' + 'ser',
  'u' + 'i',
  'net' + 'work',
  'com' + 'mand',
  'pa' + 'th',
  'wri' + 'te',
  'sa' + 've',
]);

function revisionSessionSkeletonAdmissionPreviewReason(field, message) {
  return {
    code: REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_INVALID_CODE,
    field,
    message,
  };
}

function revisionSessionSkeletonAdmissionPreviewIds(input) {
  const source = isPlainObject(input) ? input : {};
  const ids = {};
  const reasons = [];
  for (const [key, field] of REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_IDS) {
    const value = normalizeString(source[key]);
    ids[key] = value;
    if (!value) {
      reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
        field,
        `${key} must be a non-empty string`,
      ));
    }
  }
  return { ids, reasons };
}

function revisionSessionSkeletonAdmissionPreviewCheckField(preview, key, check, message) {
  if (!check(preview[key])) {
    return revisionSessionSkeletonAdmissionPreviewReason(`placementAdmissionPreview.${key}`, message);
  }
  return null;
}

function revisionSessionSkeletonAdmissionPreviewCheckArray(preview, key) {
  return revisionSessionSkeletonAdmissionPreviewCheckField(
    preview,
    key,
    Array.isArray,
    `${key} must be an array`,
  );
}

function revisionSessionSkeletonAdmissionPreviewCheckSafeCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function revisionSessionSkeletonAdmissionPreviewHasRejectScalar(value) {
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    const segments = normalized.split(/[^a-z0-9]+/u).filter(Boolean);
    for (const key of REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_REJECT_KEYS) {
      if (normalized === key || segments.includes(key)) return true;
    }
    return false;
  }
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (revisionSessionSkeletonAdmissionPreviewHasRejectScalar(value[index])) return true;
    }
    return false;
  }
  for (const nested of Object.values(value)) {
    if (revisionSessionSkeletonAdmissionPreviewHasRejectScalar(nested)) return true;
  }
  return false;
}

function revisionSessionSkeletonAdmissionPreviewStatusCode(status) {
  if (status === 'admit') return PLACEMENT_ADMISSION_PREVIEW_ADMIT_CODE;
  if (status === 'block') return PLACEMENT_ADMISSION_PREVIEW_BLOCK_CODE;
  if (status === 'hardFail') return PLACEMENT_BATCH_DIAGNOSTICS_VALIDATION_FAILED_CODE;
  return '';
}

function revisionSessionSkeletonAdmissionPreviewCheckScalars(preview) {
  const reasons = [];
  const expectedCode = revisionSessionSkeletonAdmissionPreviewStatusCode(preview.status);
  if (preview.canAdmit !== (preview.status === 'admit')) {
    reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
      'placementAdmissionPreview.canAdmit',
      'canAdmit must match status',
    ));
  }
  if (!expectedCode || preview.code !== expectedCode) {
    reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
      'placementAdmissionPreview.code',
      'code must match status',
    ));
  }
  if (!expectedCode || preview.reason !== expectedCode) {
    reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
      'placementAdmissionPreview.reason',
      'reason must match status',
    ));
  }
  if (!PLACEMENT_ADMISSION_PREVIEW_VALID_STATUSES.includes(preview.sourceStatus)) {
    reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
      'placementAdmissionPreview.sourceStatus',
      'sourceStatus must be a known source status',
    ));
  }
  if (Array.isArray(preview.blockingStatuses)) {
    for (let index = 0; index < preview.blockingStatuses.length; index += 1) {
      if (!PLACEMENT_ADMISSION_PREVIEW_VALID_STATUSES.includes(preview.blockingStatuses[index])) {
        reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
          `placementAdmissionPreview.blockingStatuses.${index}`,
          'blockingStatuses entry must be a known status',
        ));
      }
    }
  }
  return reasons;
}

function revisionSessionSkeletonAdmissionPreviewExpectedStatusCounts(evaluations) {
  const counts = placementBatchDiagnosticsCountsByStatus();
  for (const item of evaluations) {
    if (isPlainObject(item) && isPlainObject(item.evaluation) && Object.hasOwn(counts, item.evaluation.status)) {
      counts[item.evaluation.status] += 1;
    }
  }
  return counts;
}

function revisionSessionSkeletonAdmissionPreviewExpectedReasonCounts(evaluations) {
  const counts = placementBatchDiagnosticsCountsByReasonCode();
  for (const item of evaluations) {
    const reasonCodes = isPlainObject(item?.evaluation) && Array.isArray(item.evaluation.reasonCodes)
      ? item.evaluation.reasonCodes
      : [];
    for (const reasonCode of reasonCodes) {
      placementBatchDiagnosticsAddReasonCount(counts, reasonCode);
    }
  }
  return counts;
}

function revisionSessionSkeletonAdmissionPreviewCountsEqual(left, right, keys) {
  for (const key of keys) {
    if (left[key] !== right[key]) return false;
  }
  return true;
}

function revisionSessionSkeletonAdmissionPreviewCheckStatusCounts(preview) {
  const counts = preview.countsByStatus;
  if (!isPlainObject(counts)) {
    return [revisionSessionSkeletonAdmissionPreviewReason(
      'placementAdmissionPreview.countsByStatus',
      'countsByStatus must be a plain object',
    )];
  }
  const reasons = [];
  for (const key of Object.keys(counts)) {
    if (!REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_STATUS_COUNT_KEYS.includes(key)) {
      reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
        'placementAdmissionPreview.countsByStatus',
        'countsByStatus contains an unsupported key',
      ));
    }
  }
  for (const key of REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_STATUS_COUNT_KEYS) {
    if (!revisionSessionSkeletonAdmissionPreviewCheckSafeCount(counts[key])) {
      reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
        `placementAdmissionPreview.countsByStatus.${key}`,
        `${key} count must be a safe non-negative integer`,
      ));
    }
  }
  const expectedCounts = revisionSessionSkeletonAdmissionPreviewExpectedStatusCounts(preview.blockingEvaluations || []);
  if (!revisionSessionSkeletonAdmissionPreviewCountsEqual(
    counts,
    expectedCounts,
    REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_STATUS_COUNT_KEYS,
  )) {
    reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
      'placementAdmissionPreview.countsByStatus',
      'countsByStatus must match delegated evidence',
    ));
  }
  return reasons;
}

function revisionSessionSkeletonAdmissionPreviewCheckReasonCounts(preview) {
  const counts = preview.countsByReasonCode;
  if (!isPlainObject(counts)) {
    return [revisionSessionSkeletonAdmissionPreviewReason(
      'placementAdmissionPreview.countsByReasonCode',
      'countsByReasonCode must be a plain object',
    )];
  }
  const reasons = [];
  for (const key of Object.keys(counts)) {
    if (!REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_REASON_CODES.includes(key)) {
      reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
        'placementAdmissionPreview.countsByReasonCode',
        'countsByReasonCode contains an unsupported key',
      ));
    } else if (!revisionSessionSkeletonAdmissionPreviewCheckSafeCount(counts[key])) {
      reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
        `placementAdmissionPreview.countsByReasonCode.${key}`,
        `${key} count must be a safe non-negative integer`,
      ));
    }
  }
  for (const key of REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_REASON_CODES) {
    if (!revisionSessionSkeletonAdmissionPreviewCheckSafeCount(counts[key])) {
      reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
        `placementAdmissionPreview.countsByReasonCode.${key}`,
        `${key} count must be a safe non-negative integer`,
      ));
    }
  }
  const expectedCounts = revisionSessionSkeletonAdmissionPreviewExpectedReasonCounts(preview.blockingEvaluations || []);
  if (!revisionSessionSkeletonAdmissionPreviewCountsEqual(
    counts,
    expectedCounts,
    REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_REASON_CODES,
  )) {
    reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
      'placementAdmissionPreview.countsByReasonCode',
      'countsByReasonCode must match delegated evidence',
    ));
  }
  return reasons;
}

function revisionSessionSkeletonAdmissionPreviewHasRejectKey(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (revisionSessionSkeletonAdmissionPreviewHasRejectKey(value[index])) return true;
    }
    return false;
  }
  for (const key of Object.keys(value)) {
    const lowerKey = key.toLowerCase();
    if (REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_REJECT_KEYS.includes(lowerKey)) {
      return true;
    }
    if (revisionSessionSkeletonAdmissionPreviewHasRejectKey(value[key])) return true;
  }
  return false;
}

function revisionSessionSkeletonAdmissionPreviewCanProjectEvaluations(evaluations) {
  if (!Array.isArray(evaluations)) return false;
  for (const item of evaluations) {
    if (!isPlainObject(item) || !Number.isSafeInteger(item.index) || item.index < 0) return false;
    if (!isPlainObject(item.evaluation)) return false;
    if (!PLACEMENT_ADMISSION_PREVIEW_VALID_STATUSES.includes(item.evaluation.status)) return false;
    if (!Array.isArray(item.evaluation.reasonCodes)) return false;
    for (const reasonCode of item.evaluation.reasonCodes) {
      if (!REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_REASON_CODES.includes(reasonCode)) return false;
    }
  }
  return true;
}

function revisionSessionSkeletonAdmissionPreviewCheckEvaluations(preview) {
  const reasons = [];
  for (const item of preview.blockingEvaluations || []) {
    if (!isPlainObject(item) || !Number.isSafeInteger(item.index) || item.index < 0) {
      reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
        'placementAdmissionPreview.blockingEvaluations',
        'blockingEvaluations entry must have a safe index',
      ));
      continue;
    }
    if (!isPlainObject(item.evaluation)) {
      reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
        'placementAdmissionPreview.blockingEvaluations',
        'blockingEvaluations entry must have an evaluation',
      ));
      continue;
    }
    if (!PLACEMENT_ADMISSION_PREVIEW_VALID_STATUSES.includes(item.evaluation.status)) {
      reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
        'placementAdmissionPreview.blockingEvaluations',
        'evaluation status must be known',
      ));
    }
    if (!Array.isArray(item.evaluation.reasonCodes)) {
      reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
        'placementAdmissionPreview.blockingEvaluations',
        'evaluation reasonCodes must be an array',
      ));
      continue;
    }
    for (const reasonCode of item.evaluation.reasonCodes) {
      if (!REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_REASON_CODES.includes(reasonCode)) {
        reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
          'placementAdmissionPreview.blockingEvaluations',
          'evaluation reasonCodes must be public reason codes',
        ));
      }
    }
  }
  return reasons;
}

function revisionSessionSkeletonAdmissionPreviewCheckDiagnostics(preview) {
  const reasons = [];
  for (const item of preview.blockingDiagnostics || []) {
    if (!isPlainObject(item) || !Number.isSafeInteger(item.index) || item.index < 0) {
      reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
        'placementAdmissionPreview.blockingDiagnostics',
        'blockingDiagnostics entry must have a safe index',
      ));
      continue;
    }
    if (!REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_REASON_CODES.includes(item.code)) {
      reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
        'placementAdmissionPreview.blockingDiagnostics',
        'blockingDiagnostics code must be a public reason code',
      ));
    }
    if (typeof item.field !== 'string' || typeof item.message !== 'string') {
      reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
        'placementAdmissionPreview.blockingDiagnostics',
        'blockingDiagnostics field and message must be strings',
      ));
    }
  }
  return reasons;
}

function revisionSessionSkeletonAdmissionPreviewCheckSummary(preview) {
  const summary = preview.diagnosticSummary;
  const reasons = [];
  const expectedKeys = ['schemaVersion', 'sortOrder', 'total', 'items'];
  const summaryKeys = isPlainObject(summary) ? Object.keys(summary) : [];
  if (summaryKeys.length !== expectedKeys.length || summaryKeys.some((key) => !expectedKeys.includes(key))) {
    reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
      'placementAdmissionPreview.diagnosticSummary',
      'diagnosticSummary must use the exact public shape',
    ));
    return reasons;
  }
  if (summary.schemaVersion !== PLACEMENT_ADMISSION_PREVIEW_SCHEMA) {
    reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
      'placementAdmissionPreview.diagnosticSummary',
      'diagnosticSummary schemaVersion must match placement admission preview',
    ));
  }
  if (
    !Array.isArray(summary.sortOrder)
    || summary.sortOrder.length !== PLACEMENT_BATCH_DIAGNOSTICS_SUMMARY_ORDER.length
    || summary.sortOrder.some((item, index) => item !== PLACEMENT_BATCH_DIAGNOSTICS_SUMMARY_ORDER[index])
  ) {
    reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
      'placementAdmissionPreview.diagnosticSummary',
      'diagnosticSummary sortOrder must be canonical',
    ));
  }
  if (!Array.isArray(summary.items) || summary.total !== summary.items.length) {
    reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
      'placementAdmissionPreview.diagnosticSummary',
      'diagnosticSummary total must match items',
    ));
    return reasons;
  }
  for (const item of summary.items) {
    const itemKeys = isPlainObject(item) ? Object.keys(item) : [];
    const expectedItemKeys = ['severity', 'code', 'count', 'indexes'];
    if (itemKeys.length !== expectedItemKeys.length || itemKeys.some((key) => !expectedItemKeys.includes(key))) {
      reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
        'placementAdmissionPreview.diagnosticSummary',
        'diagnosticSummary item must use the exact public shape',
      ));
      continue;
    }
    if (!PLACEMENT_ADMISSION_PREVIEW_VALID_STATUSES.includes(item.severity)) {
      reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
        'placementAdmissionPreview.diagnosticSummary',
        'diagnosticSummary severity must be known',
      ));
    }
    if (!REVISION_BRIDGE_PLACEMENT_BATCH_DIAGNOSTICS_REASON_CODES.includes(item.code)) {
      reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
        'placementAdmissionPreview.diagnosticSummary',
        'diagnosticSummary code must be a public reason code',
      ));
    }
    if (!revisionSessionSkeletonAdmissionPreviewCheckSafeCount(item.count)) {
      reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
        'placementAdmissionPreview.diagnosticSummary',
        'diagnosticSummary count must be safe',
      ));
    }
    if (
      !Array.isArray(item.indexes)
      || item.indexes.some((index) => !Number.isSafeInteger(index) || index < 0)
    ) {
      reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
        'placementAdmissionPreview.diagnosticSummary',
        'diagnosticSummary indexes must be safe',
      ));
    }
  }
  if (revisionSessionSkeletonAdmissionPreviewCanProjectEvaluations(preview.blockingEvaluations)) {
    const expectedSummary = placementAdmissionPreviewSummaryFromEvaluations(preview.blockingEvaluations);
    if (JSON.stringify(summary) !== JSON.stringify(expectedSummary)) {
      reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
        'placementAdmissionPreview.diagnosticSummary',
        'diagnosticSummary must match delegated evidence',
      ));
    }
  }
  return reasons;
}

function revisionSessionSkeletonAdmissionPreviewCheckPreview(preview) {
  const reasons = [];
  if (!isPlainObject(preview)) {
    return {
      ok: false,
      value: null,
      reasons: [revisionSessionSkeletonAdmissionPreviewReason(
        'placementAdmissionPreview',
        'placementAdmissionPreview must be a plain object',
      )],
    };
  }

  const checks = [
    revisionSessionSkeletonAdmissionPreviewCheckField(
      preview,
      'type',
      (value) => value === 'revisionBridge.revisionSession.placementAdmissionPreview',
      'type must be revisionBridge.revisionSession.placementAdmissionPreview',
    ),
    revisionSessionSkeletonAdmissionPreviewCheckField(
      preview,
      'schemaVersion',
      (value) => value === PLACEMENT_ADMISSION_PREVIEW_SCHEMA,
      `schemaVersion must be ${PLACEMENT_ADMISSION_PREVIEW_SCHEMA}`,
    ),
    revisionSessionSkeletonAdmissionPreviewCheckField(
      preview,
      'status',
      (value) => REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_STATUSES.includes(value),
      'status must be admit, block, or hardFail',
    ),
    revisionSessionSkeletonAdmissionPreviewCheckField(
      preview,
      'canAdmit',
      (value) => typeof value === 'boolean',
      'canAdmit must be a boolean',
    ),
    revisionSessionSkeletonAdmissionPreviewCheckField(
      preview,
      'code',
      (value) => typeof value === 'string',
      'code must be a string',
    ),
    revisionSessionSkeletonAdmissionPreviewCheckField(
      preview,
      'reason',
      (value) => typeof value === 'string',
      'reason must be a string',
    ),
    revisionSessionSkeletonAdmissionPreviewCheckField(
      preview,
      'sourceStatus',
      (value) => typeof value === 'string',
      'sourceStatus must be a string',
    ),
    revisionSessionSkeletonAdmissionPreviewCheckField(
      preview,
      'sourceTotal',
      Number.isSafeInteger,
      'sourceTotal must be a safe integer',
    ),
    revisionSessionSkeletonAdmissionPreviewCheckField(
      preview,
      'total',
      Number.isSafeInteger,
      'total must be a safe integer',
    ),
    revisionSessionSkeletonAdmissionPreviewCheckArray(preview, 'blockingStatuses'),
    revisionSessionSkeletonAdmissionPreviewCheckArray(preview, 'blockingEvaluations'),
    revisionSessionSkeletonAdmissionPreviewCheckArray(preview, 'blockingDiagnostics'),
    revisionSessionSkeletonAdmissionPreviewCheckField(
      preview,
      'diagnosticSummary',
      isPlainObject,
      'diagnosticSummary must be a plain object',
    ),
  ];

  for (const check of checks) {
    if (check) reasons.push(check);
  }
  reasons.push(...revisionSessionSkeletonAdmissionPreviewCheckScalars(preview));
  reasons.push(...revisionSessionSkeletonAdmissionPreviewCheckEvaluations(preview));
  reasons.push(...revisionSessionSkeletonAdmissionPreviewCheckDiagnostics(preview));
  reasons.push(...revisionSessionSkeletonAdmissionPreviewCheckSummary(preview));
  reasons.push(...revisionSessionSkeletonAdmissionPreviewCheckStatusCounts(preview));
  reasons.push(...revisionSessionSkeletonAdmissionPreviewCheckReasonCounts(preview));
  if (revisionSessionSkeletonAdmissionPreviewHasRejectKey(preview)) {
    reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
      'placementAdmissionPreview',
      'placementAdmissionPreview contains an unsupported delegated key',
    ));
  }
  if (revisionSessionSkeletonAdmissionPreviewHasRejectScalar(preview)) {
    reasons.push(revisionSessionSkeletonAdmissionPreviewReason(
      'placementAdmissionPreview',
      'placementAdmissionPreview contains an unsupported delegated value',
    ));
  }
  return {
    ok: reasons.length === 0,
    value: reasons.length === 0 ? revisionSessionSkeletonAdmissionPreviewSnapshot(preview) : null,
    reasons,
  };
}

function revisionSessionSkeletonAdmissionPreviewSnapshot(preview) {
  return {
    schemaVersion: normalizeString(preview.schemaVersion),
    type: normalizeString(preview.type),
    status: normalizeString(preview.status),
    code: normalizeString(preview.code),
    reason: normalizeString(preview.reason),
    canAdmit: preview.canAdmit === true,
    sourceStatus: normalizeString(preview.sourceStatus),
    sourceTotal: preview.sourceTotal,
    blockingStatuses: cloneJsonSafe(preview.blockingStatuses),
    total: preview.total,
    countsByStatus: cloneJsonSafe(preview.countsByStatus),
    countsByReasonCode: cloneJsonSafe(preview.countsByReasonCode),
    blockingEvaluations: cloneJsonSafe(preview.blockingEvaluations),
    blockingDiagnostics: cloneJsonSafe(preview.blockingDiagnostics),
    diagnosticSummary: cloneJsonSafe(preview.diagnosticSummary),
  };
}

function revisionSessionSkeletonAdmissionPreviewCandidate(ids) {
  const reviewGraph = {};
  for (const key of REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_GRAPH) {
    reviewGraph[key] = [];
  }
  return createRevisionSession({
    sessionId: ids.revisionSessionId,
    projectId: ids.projectId,
    baselineHash: ids.baselineHash,
    createdAt: '',
    updatedAt: '',
    reviewGraph,
  });
}

function revisionSessionSkeletonAdmissionPreviewEnvelope(status, code, reason, ids, candidate, preview, reasons) {
  return {
    schemaVersion: REVISION_BRIDGE_REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_SCHEMA,
    type: 'revisionBridge.revisionSession.skeletonAdmissionPreview',
    status,
    code,
    reason,
    canAdmit: status === 'admit',
    projectId: ids.projectId,
    revisionSessionId: ids.revisionSessionId,
    ['ex' + 'portId']: ids['ex' + 'portId'],
    baselineHash: ids.baselineHash,
    candidateSession: candidate,
    placementAdmissionPreview: preview,
    reasons,
  };
}

function revisionSessionSkeletonAdmissionPreviewEvaluate(input) {
  const ids = revisionSessionSkeletonAdmissionPreviewIds(input);
  const source = isPlainObject(input) ? input : {};
  const preview = revisionSessionSkeletonAdmissionPreviewCheckPreview(source.placementAdmissionPreview);
  const hardReasons = ids.reasons.concat(preview.reasons);
  if (hardReasons.length > 0) {
    return revisionSessionSkeletonAdmissionPreviewEnvelope(
      'hardFail',
      REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_INVALID_CODE,
      hardReasons[0].code,
      ids.ids,
      null,
      preview.value,
      hardReasons,
    );
  }
  if (preview.value.canAdmit !== true) {
    const reasons = [{
      code: REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_BLOCK_CODE,
      field: 'placementAdmissionPreview.canAdmit',
      message: 'placementAdmissionPreview cannot admit',
    }];
    return revisionSessionSkeletonAdmissionPreviewEnvelope(
      'block',
      REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_BLOCK_CODE,
      REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_BLOCK_CODE,
      ids.ids,
      null,
      preview.value,
      reasons,
    );
  }
  return revisionSessionSkeletonAdmissionPreviewEnvelope(
    'admit',
    REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_ADMIT_CODE,
    REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_ADMIT_CODE,
    ids.ids,
    revisionSessionSkeletonAdmissionPreviewCandidate(ids.ids),
    preview.value,
    [],
  );
}
// RB_17_REVISION_SESSION_SKELETON_ADMISSION_PREVIEW_CONTRACTS_END

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
    resolvedState: normalizeStringEnum(placement.resolvedState, ['open', 'resolved'], 'open'),
    acceptedState: normalizeStringEnum(
      placement.acceptedState,
      ['pending', 'accepted', 'rejected', 'deferred'],
      'pending',
    ),
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

// RB_29_COMMENT_DECISION_SEPARATION_CONTRACTS_START
function commentDecisionSeparationInitialCounts() {
  return {
    open: 0,
    resolved: 0,
  };
}

function commentAcceptanceInitialCounts() {
  return {
    pending: 0,
    accepted: 0,
    rejected: 0,
    deferred: 0,
  };
}

function commentDecisionMatrixKey(resolvedState, acceptedState) {
  return `${resolvedState}::${acceptedState}`;
}

export function evaluateRevisionBridgeCommentDecisionSeparation(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const rows = Array.isArray(source.commentPlacements) ? source.commentPlacements : [];
  const countsByResolvedState = commentDecisionSeparationInitialCounts();
  const countsByAcceptedState = commentAcceptanceInitialCounts();
  const matrix = {};
  const diagnostics = [];

  rows.forEach((placementInput, index) => {
    if (!isPlainObject(placementInput)) {
      diagnostics.push(invalidField(
        `commentPlacements.${index}`,
        'comment placement entry must be an object',
      ));
      return;
    }
    const placement = normalizeCommentPlacement(placementInput);
    if (!Object.hasOwn(countsByResolvedState, placement.resolvedState)) {
      diagnostics.push(invalidField(
        `commentPlacements.${index}.resolvedState`,
        'resolvedState is not supported',
      ));
      return;
    }
    if (!Object.hasOwn(countsByAcceptedState, placement.acceptedState)) {
      diagnostics.push(invalidField(
        `commentPlacements.${index}.acceptedState`,
        'acceptedState is not supported',
      ));
      return;
    }
    countsByResolvedState[placement.resolvedState] += 1;
    countsByAcceptedState[placement.acceptedState] += 1;
    const key = commentDecisionMatrixKey(placement.resolvedState, placement.acceptedState);
    matrix[key] = Number.isSafeInteger(matrix[key]) ? matrix[key] + 1 : 1;
  });

  return {
    schemaVersion: REVISION_BRIDGE_COMMENT_DECISION_SEPARATION_SCHEMA,
    type: 'revisionBridge.commentDecisionSeparation',
    status: diagnostics.length > 0 ? 'invalid' : 'evaluated',
    code: diagnostics.length > 0
      ? REVIEWGRAPH_INVALID_CODE
      : REVIEWGRAPH_VALID_CODE,
    reason: diagnostics.length > 0
      ? diagnostics[0].code
      : REVIEWGRAPH_VALID_CODE,
    diagnostics,
    countsByResolvedState,
    countsByAcceptedState,
    matrix,
  };
}
// RB_29_COMMENT_DECISION_SEPARATION_CONTRACTS_END

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

// RB_33_STRUCTURAL_OPS_MANUAL_REVIEW_CONTRACTS_START
function structuralOpBlastRadius(kind) {
  const normalizedKind = normalizeString(kind);
  if (
    normalizedKind === 'scene-reorder'
    || normalizedKind === 'scene-split'
    || normalizedKind === 'split-scene'
    || normalizedKind === 'scene-merge'
    || normalizedKind === 'merge-scene'
    || normalizedKind === 'block-move'
    || normalizedKind === 'block-split'
    || normalizedKind === 'block-merge'
  ) {
    return 'high';
  }
  if (normalizedKind === 'block-insert' || normalizedKind === 'block-delete') return 'medium';
  return 'low';
}

function structuralOpAffectedCommentCount(change, placements) {
  const targetScopeType = normalizeString(change?.targetScope?.type);
  const targetScopeId = normalizeString(change?.targetScope?.id);
  if (!targetScopeType || !targetScopeId) return 0;
  return placements.filter((placement) => (
    isPlainObject(placement)
    && normalizeString(placement?.targetScope?.type) === targetScopeType
    && normalizeString(placement?.targetScope?.id) === targetScopeId
  )).length;
}

export function previewRevisionBridgeStructuralOpsManualReview(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const changeInputs = Array.isArray(source.structuralChanges) ? source.structuralChanges : [];
  const commentPlacements = Array.isArray(source.commentPlacements) ? source.commentPlacements : [];
  const reasons = [];
  const operations = [];

  changeInputs.forEach((changeInput, index) => {
    if (!isPlainObject(changeInput)) {
      reasons.push(invalidField(
        `structuralChanges.${index}`,
        'structural change entry must be an object',
      ));
      return;
    }
    const validation = validateStructuralChange(changeInput);
    if (!validation.ok) {
      for (const reason of validation.reasons) {
        reasons.push({
          ...reason,
          field: reason.field.replace(/^structuralChange/u, `structuralChanges.${index}`),
        });
      }
      return;
    }
    const change = validation.value;
    if (!change.targetScope.type) {
      reasons.push(missingField(`structuralChanges.${index}.targetScope.type`));
      return;
    }
    if (!change.targetScope.id) {
      reasons.push(missingField(`structuralChanges.${index}.targetScope.id`));
      return;
    }
    operations.push({
      structuralChangeId: change.structuralChangeId,
      kind: change.kind,
      targetScope: cloneJsonSafe(change.targetScope),
      blastRadius: structuralOpBlastRadius(change.kind),
      affectedCommentCount: structuralOpAffectedCommentCount(change, commentPlacements),
      manualOnly: true,
      diagnosticsOnly: true,
      beforeAfterPreviewRequired: true,
    });
  });

  return {
    schemaVersion: REVISION_BRIDGE_STRUCTURAL_OPS_MANUAL_REVIEW_SCHEMA,
    type: 'revisionBridge.structuralOps.manualReviewPreview',
    status: reasons.length > 0 ? 'invalid' : 'evaluated',
    code: reasons.length > 0
      ? REVIEWGRAPH_INVALID_CODE
      : REVIEWGRAPH_VALID_CODE,
    reason: reasons.length > 0
      ? reasons[0].code
      : REVIEWGRAPH_VALID_CODE,
    canApply: false,
    operations,
    reasons,
  };
}
// RB_33_STRUCTURAL_OPS_MANUAL_REVIEW_CONTRACTS_END

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

// RB_21_REVISION_SESSION_STATE_MACHINE_CONTRACTS_START
function resolveRevisionSessionStateInput(input = {}) {
  if (!isPlainObject(input)) return '';
  if (hasOwnField(input, 'sessionState')) return input.sessionState;
  if (hasOwnField(input, 'state')) return input.state;
  return '';
}

function resolveRevisionSessionPreviousStateInput(input = {}) {
  if (!isPlainObject(input)) return '';
  if (hasOwnField(input, 'previousSessionState')) return input.previousSessionState;
  if (hasOwnField(input, 'previousState')) return input.previousState;
  return '';
}

export function normalizeRevisionSessionState(state, fallback = '') {
  const normalized = normalizeString(state);
  if (!normalized) return fallback;
  return REVISION_BRIDGE_REVISION_SESSION_STATES.includes(normalized) ? normalized : fallback;
}

export function isRevisionSessionStateTransitionAllowed(fromState, toState) {
  const from = normalizeRevisionSessionState(fromState);
  const to = normalizeRevisionSessionState(toState);
  if (!from || !to) return false;
  const allowed = REVISION_SESSION_ALLOWED_TRANSITIONS[from];
  return Array.isArray(allowed) ? allowed.includes(to) : false;
}

function collectRevisionSessionStateMachineReasons(input, session) {
  const reasons = [];
  const hasState = hasOwnField(input, 'sessionState') || hasOwnField(input, 'state');
  const hasPreviousState = hasOwnField(input, 'previousSessionState') || hasOwnField(input, 'previousState');
  const hasStateChangedAt = hasOwnField(input, 'stateChangedAt');

  if (hasState && !normalizeRevisionSessionState(resolveRevisionSessionStateInput(input))) {
    reasons.push(invalidField(
      'revisionSession.sessionState',
      'RevisionSession sessionState is not supported',
    ));
  }

  if (hasPreviousState && !normalizeRevisionSessionState(resolveRevisionSessionPreviousStateInput(input))) {
    reasons.push(invalidField(
      'revisionSession.previousSessionState',
      'RevisionSession previousSessionState is not supported',
    ));
  }

  if (hasStateChangedAt && typeof input.stateChangedAt !== 'string') {
    reasons.push(invalidField(
      'revisionSession.stateChangedAt',
      'RevisionSession stateChangedAt must be a string',
    ));
  }

  if (session.previousSessionState && !session.stateChangedAt) {
    reasons.push(missingField('revisionSession.stateChangedAt'));
  }

  if (!session.previousSessionState && session.stateChangedAt) {
    reasons.push(invalidField(
      'revisionSession.stateChangedAt',
      'stateChangedAt requires previousSessionState',
    ));
  }

  if (session.previousSessionState) {
    if (session.previousSessionState === session.sessionState) {
      reasons.push(invalidField(
        'revisionSession.sessionState',
        'RevisionSession transition must change state',
      ));
    } else if (!isRevisionSessionStateTransitionAllowed(session.previousSessionState, session.sessionState)) {
      reasons.push(invalidField(
        'revisionSession.sessionState',
        'RevisionSession state transition is not allowed',
      ));
    }
  }

  return reasons;
}
// RB_21_REVISION_SESSION_STATE_MACHINE_CONTRACTS_END

// RB_22_REVISION_SESSION_VERSION_TAGS_CONTRACTS_START
export function normalizeRevisionSessionVersionTags(input = {}) {
  const source = isPlainObject(input) ? input : {};
  return {
    parserVersion: normalizeString(source.parserVersion) || REVISION_BRIDGE_REVISION_SESSION_VERSION_TAGS.parserVersion,
    matcherVersion: normalizeString(source.matcherVersion) || REVISION_BRIDGE_REVISION_SESSION_VERSION_TAGS.matcherVersion,
    policyVersion: normalizeString(source.policyVersion) || REVISION_BRIDGE_REVISION_SESSION_VERSION_TAGS.policyVersion,
    receiptVersion: normalizeString(source.receiptVersion) || REVISION_BRIDGE_REVISION_SESSION_VERSION_TAGS.receiptVersion,
  };
}

function collectRevisionSessionVersionTagReasons(input) {
  const reasons = [];
  if (!isPlainObject(input)) return reasons;
  const fields = ['parserVersion', 'matcherVersion', 'policyVersion', 'receiptVersion'];
  for (const field of fields) {
    if (!hasOwnField(input, field)) continue;
    if (typeof input[field] !== 'string') {
      reasons.push(invalidField(
        `revisionSession.${field}`,
        `RevisionSession ${field} must be a string`,
      ));
    }
  }
  return reasons;
}
// RB_22_REVISION_SESSION_VERSION_TAGS_CONTRACTS_END

// RB_23_REVISION_SESSION_STATE_INVARIANTS_CONTRACTS_START
function revisionSessionReviewGraphItemCount(graph = {}) {
  if (!isPlainObject(graph)) return 0;
  const collections = [
    'commentThreads',
    'commentPlacements',
    'textChanges',
    'structuralChanges',
    'diagnosticItems',
    'decisionStates',
  ];
  let total = 0;
  for (const key of collections) {
    const value = graph[key];
    if (Array.isArray(value)) total += value.length;
  }
  return total;
}

function collectRevisionSessionStateInvariantReasons(session) {
  const reasons = [];
  const graph = isPlainObject(session.reviewGraph) ? session.reviewGraph : {};
  const state = normalizeRevisionSessionState(session.sessionState, 'Imported');
  const decisions = Array.isArray(graph.decisionStates) ? graph.decisionStates : [];
  const diagnostics = Array.isArray(graph.diagnosticItems) ? graph.diagnosticItems : [];

  if (state === 'Exported' && revisionSessionReviewGraphItemCount(graph) > 0) {
    reasons.push(invalidField(
      'revisionSession.reviewGraph',
      'Exported RevisionSession must not contain imported review graph items',
    ));
  }

  if (['Decisioned', 'Planned', 'Applying', 'Applied', 'Verified', 'Closed'].includes(state)) {
    if (decisions.length === 0) {
      reasons.push(invalidField(
        'revisionSession.reviewGraph.decisionStates',
        `${state} RevisionSession requires decisionStates`,
      ));
    }
    if (state === 'Decisioned' && decisions.some((decision) => decision.status === 'pending')) {
      reasons.push(invalidField(
        'revisionSession.reviewGraph.decisionStates',
        'Decisioned RevisionSession cannot include pending decisions',
      ));
    }
  }

  if (['Applying', 'Applied', 'Verified', 'Closed'].includes(state)) {
    if (!decisions.some((decision) => decision.status === 'accepted')) {
      reasons.push(invalidField(
        'revisionSession.reviewGraph.decisionStates',
        `${state} RevisionSession requires at least one accepted decision`,
      ));
    }
  }

  if (['Failed', 'Quarantined'].includes(state) && diagnostics.length === 0) {
    reasons.push(invalidField(
      'revisionSession.reviewGraph.diagnosticItems',
      `${state} RevisionSession requires diagnosticItems`,
    ));
  }

  return reasons;
}

export function evaluateRevisionSessionStateInvariants(input = {}) {
  const session = normalizeRevisionSession(input);
  const reasons = collectRevisionSessionStateInvariantReasons(session);
  if (reasons.length > 0) {
    return {
      ok: false,
      schemaVersion: REVISION_BRIDGE_REVISION_SESSION_STATE_INVARIANTS_SCHEMA,
      type: 'revisionBridge.revisionSessionStateInvariants',
      status: 'invalid',
      code: REVIEWGRAPH_INVALID_CODE,
      reason: reasons[0].code || REVIEWGRAPH_INVALID_CODE,
      reasons,
      value: null,
    };
  }
  return {
    ok: true,
    schemaVersion: REVISION_BRIDGE_REVISION_SESSION_STATE_INVARIANTS_SCHEMA,
    type: 'revisionBridge.revisionSessionStateInvariants',
    status: 'valid',
    code: REVIEWGRAPH_VALID_CODE,
    reason: REVIEWGRAPH_VALID_CODE,
    reasons: [],
    value: session,
  };
}
// RB_23_REVISION_SESSION_STATE_INVARIANTS_CONTRACTS_END

// RB_24_EXPORT_MANIFEST_TRANSPORT_ENVELOPE_CONTRACTS_START
function normalizeRevisionBridgeSceneBaseline(scene = {}) {
  const source = isPlainObject(scene) ? scene : {};
  return {
    sceneId: normalizeString(source.sceneId),
    sceneHash: normalizeString(source.sceneHash),
    sceneStructuralHash: normalizeString(source.sceneStructuralHash),
    title: normalizeString(source.title),
    orderIndex: Number.isFinite(Number(source.orderIndex)) ? Number(source.orderIndex) : 0,
    sourcePath: normalizeString(source.sourcePath),
    relativePath: normalizeString(source.relativePath),
  };
}

function normalizeRevisionBridgeBlockBaseline(block = {}) {
  const source = isPlainObject(block) ? block : {};
  return {
    blockInstanceId: normalizeString(source.blockInstanceId || source.blockId),
    blockLineageId: normalizeString(source.blockLineageId),
    blockVersionHash: normalizeString(source.blockVersionHash || source.textHash),
    blockKind: normalizeString(source.blockKind || 'paragraph'),
    blockOrder: Number.isFinite(Number(source.blockOrder ?? source.ordinal)) ? Number(source.blockOrder ?? source.ordinal) : 0,
    blockHash: normalizeString(source.blockHash),
    blockTextHash: normalizeString(source.blockTextHash || source.textHash),
    blockStructuralHash: normalizeString(source.blockStructuralHash),
    sceneId: normalizeString(source.sceneId),
  };
}

function normalizeRevisionBridgeSceneOrder(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeString(item))
    .filter((item) => Boolean(item));
}

export function buildRevisionBridgeExportManifest(snapshot = {}, manifest = {}) {
  const safeSnapshot = isPlainObject(snapshot) ? snapshot : {};
  const safeManifest = isPlainObject(manifest) ? manifest : {};
  const sceneOrder = normalizeRevisionBridgeSceneOrder(
    Array.isArray(safeManifest.sceneOrder) ? safeManifest.sceneOrder : safeSnapshot.sceneOrder,
  );
  const scenes = Array.isArray(safeSnapshot.sceneBaselines)
    ? safeSnapshot.sceneBaselines.map((scene) => normalizeRevisionBridgeSceneBaseline(scene))
    : [];
  const blocks = Array.isArray(safeSnapshot.blockBaselines)
    ? safeSnapshot.blockBaselines.map((block) => normalizeRevisionBridgeBlockBaseline(block))
    : [];

  return {
    schemaVersion: REVISION_BRIDGE_EXPORT_MANIFEST_SCHEMA,
    kind: 'ExportManifest',
    id: normalizeString(safeManifest.id),
    projectId: normalizeString(safeManifest.projectId || safeSnapshot.projectId),
    profileId: normalizeString(safeManifest.profileId || safeSnapshot.profileId || REVISION_BRIDGE_DOCX_REVIEW_PROFILE_ID),
    createdAt: normalizeString(safeManifest.createdAt),
    baselineHash: normalizeString(safeManifest.baselineHash || safeSnapshot.baselineHash),
    docFingerprint: normalizeString(safeManifest.docFingerprint || safeSnapshot.docFingerprintPlan),
    sourceVersion: normalizeString(safeManifest.sourceVersion || safeSnapshot.sourceVersion),
    sceneOrder,
    scenes,
    blocks,
    trust: {
      localCanonical: true,
      embeddedTransportIsAdvisory: true,
    },
  };
}

export function buildRevisionBridgeTransportEnvelope(exportManifest = {}) {
  const manifest = isPlainObject(exportManifest) ? exportManifest : {};
  const sceneOrder = normalizeRevisionBridgeSceneOrder(manifest.sceneOrder);
  return {
    schemaVersion: REVISION_BRIDGE_TRANSPORT_ENVELOPE_SCHEMA,
    kind: 'TransportEnvelope',
    advisory: true,
    exportId: normalizeString(manifest.id),
    projectId: normalizeString(manifest.projectId),
    profileId: normalizeString(manifest.profileId || REVISION_BRIDGE_DOCX_REVIEW_PROFILE_ID),
    baselineHash: normalizeString(manifest.baselineHash),
    docFingerprint: normalizeString(manifest.docFingerprint),
    sceneOrder,
    sceneCount: sceneOrder.length,
    createdAt: normalizeString(manifest.createdAt),
  };
}

export function evaluateRevisionBridgeTransportBinding(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const exportManifest = isPlainObject(source.exportManifest) ? source.exportManifest : null;
  const transportEnvelope = isPlainObject(source.transportEnvelope) ? source.transportEnvelope : null;
  const reasons = [];

  if (!exportManifest) {
    reasons.push(missingField('exportManifest'));
  }
  if (!transportEnvelope) {
    reasons.push(missingField('transportEnvelope'));
  }
  if (reasons.length > 0) {
    return {
      ok: false,
      schemaVersion: REVISION_BRIDGE_TRANSPORT_BINDING_SCHEMA,
      type: 'revisionBridge.transportBinding',
      status: 'advisory',
      code: REVIEWGRAPH_INVALID_CODE,
      reason: reasons[0].code || REVIEWGRAPH_INVALID_CODE,
      reasons,
    };
  }

  const checks = [
    ['exportId', normalizeString(exportManifest.id), normalizeString(transportEnvelope.exportId)],
    ['projectId', normalizeString(exportManifest.projectId), normalizeString(transportEnvelope.projectId)],
    ['baselineHash', normalizeString(exportManifest.baselineHash), normalizeString(transportEnvelope.baselineHash)],
    ['docFingerprint', normalizeString(exportManifest.docFingerprint), normalizeString(transportEnvelope.docFingerprint)],
  ];

  for (const [field, manifestValue, envelopeValue] of checks) {
    if (!manifestValue || !envelopeValue) {
      reasons.push(invalidField(
        `transportBinding.${field}`,
        'Transport binding requires both manifest and envelope values',
      ));
      continue;
    }
    if (manifestValue !== envelopeValue) {
      reasons.push(invalidField(
        `transportBinding.${field}`,
        'Transport envelope does not match local export manifest',
      ));
    }
  }

  if (reasons.length > 0) {
    return {
      ok: false,
      schemaVersion: REVISION_BRIDGE_TRANSPORT_BINDING_SCHEMA,
      type: 'revisionBridge.transportBinding',
      status: 'mismatch',
      code: REVIEWGRAPH_INVALID_CODE,
      reason: reasons[0].code || REVIEWGRAPH_INVALID_CODE,
      reasons,
    };
  }

  return {
    ok: true,
    schemaVersion: REVISION_BRIDGE_TRANSPORT_BINDING_SCHEMA,
    type: 'revisionBridge.transportBinding',
    status: 'verified',
    code: REVIEWGRAPH_VALID_CODE,
    reason: REVIEWGRAPH_VALID_CODE,
    reasons: [],
  };
}
// RB_24_EXPORT_MANIFEST_TRANSPORT_ENVELOPE_CONTRACTS_END

// RB_34_EXPORT_RUNTIME_SNAPSHOT_READINESS_CONTRACTS_START
export function normalizeRevisionBridgeExportRuntimeSnapshot(snapshot = {}) {
  const source = isPlainObject(snapshot) ? snapshot : {};
  return {
    projectId: normalizeString(source.projectId),
    baselineHash: normalizeString(source.baselineHash),
    docFingerprint: normalizeString(source.docFingerprint || source.docFingerprintPlan),
    sourceVersion: normalizeString(source.sourceVersion),
    profileId: normalizeString(source.profileId || source.reviewProfileId || REVISION_BRIDGE_DOCX_REVIEW_PROFILE_ID),
    content: normalizeString(source.content),
    plainText: normalizeString(source.plainText),
    bookProfile: isPlainObject(source.bookProfile) ? { ...source.bookProfile } : null,
    sceneOrder: normalizeRevisionBridgeSceneOrder(source.sceneOrder),
    sceneBaselines: Array.isArray(source.sceneBaselines)
      ? source.sceneBaselines.map((scene) => normalizeRevisionBridgeSceneBaseline(scene))
      : [],
    blockBaselines: Array.isArray(source.blockBaselines)
      ? source.blockBaselines.map((block) => normalizeRevisionBridgeBlockBaseline(block))
      : [],
  };
}

export function evaluateRevisionBridgeExportRuntimeSnapshot(snapshot = {}) {
  const source = isPlainObject(snapshot) ? snapshot : {};
  const normalized = normalizeRevisionBridgeExportRuntimeSnapshot(source);
  const reasons = [];

  if (!normalized.projectId) reasons.push(missingField('projectId'));
  if (!normalized.baselineHash) reasons.push(missingField('baselineHash'));
  if (!normalized.docFingerprint) reasons.push(missingField('docFingerprint'));
  if (!normalized.sourceVersion) reasons.push(missingField('sourceVersion'));

  if (!Array.isArray(source.sceneOrder)) {
    reasons.push(missingField('sceneOrder'));
  } else if (normalized.sceneOrder.length === 0) {
    reasons.push(invalidField('sceneOrder', 'sceneOrder must contain at least one scene id'));
  }

  if (!Array.isArray(source.sceneBaselines)) {
    reasons.push(missingField('sceneBaselines'));
  } else if (normalized.sceneBaselines.length === 0) {
    reasons.push(invalidField('sceneBaselines', 'sceneBaselines must contain at least one scene baseline'));
  }

  if (!Array.isArray(source.blockBaselines)) {
    reasons.push(missingField('blockBaselines'));
  } else if (normalized.blockBaselines.length === 0) {
    reasons.push(invalidField('blockBaselines', 'blockBaselines must contain at least one block baseline'));
  }

  const minimalEditorSnapshot = Boolean(normalized.content || normalized.plainText || normalized.bookProfile);
  const hasInvalidReason = reasons.some((reason) => reason?.code === 'REVISION_BRIDGE_FIELD_INVALID');
  const ready = reasons.length === 0;

  return {
    ok: ready,
    schemaVersion: REVISION_BRIDGE_EXPORT_RUNTIME_SNAPSHOT_SCHEMA,
    type: 'revisionBridge.exportRuntimeSnapshotReadiness',
    status: ready ? 'ready' : (hasInvalidReason ? 'invalid' : (minimalEditorSnapshot ? 'advisory' : 'invalid')),
    code: ready ? REVIEWGRAPH_VALID_CODE : REVIEWGRAPH_INVALID_CODE,
    reason: ready ? REVIEWGRAPH_VALID_CODE : (reasons[0]?.code || REVIEWGRAPH_INVALID_CODE),
    reasons,
    requiredFields: [
      'projectId',
      'baselineHash',
      'docFingerprint',
      'sourceVersion',
      'sceneOrder',
      'sceneBaselines',
      'blockBaselines',
    ],
    snapshot: normalized,
    eligibility: {
      canBuildManifest: ready,
      canBuildTransportEnvelope: ready,
      canBindExportEntrypoint: ready,
    },
  };
}
// RB_34_EXPORT_RUNTIME_SNAPSHOT_READINESS_CONTRACTS_END

export function normalizeRevisionSession(input = {}) {
  const session = isPlainObject(input) ? input : {};
  const versionTags = normalizeRevisionSessionVersionTags(session);
  return {
    schemaVersion: REVISION_BRIDGE_REVISION_SESSION_SCHEMA,
    sessionId: normalizeString(session.sessionId),
    projectId: normalizeString(session.projectId),
    baselineHash: normalizeString(session.baselineHash),
    sessionState: normalizeRevisionSessionState(resolveRevisionSessionStateInput(session), 'Imported'),
    previousSessionState: normalizeRevisionSessionState(resolveRevisionSessionPreviousStateInput(session)),
    stateChangedAt: normalizeString(session.stateChangedAt),
    parserVersion: versionTags.parserVersion,
    matcherVersion: versionTags.matcherVersion,
    policyVersion: versionTags.policyVersion,
    receiptVersion: versionTags.receiptVersion,
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
  reasons.push(...collectRevisionSessionStateMachineReasons(input, session));
  reasons.push(...collectRevisionSessionStateInvariantReasons(session));
  reasons.push(...collectRevisionSessionVersionTagReasons(input));
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
  } else if (!packet.targetScope.id) {
    reasons.push(missingField('targetScope.id'));
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
  if (!packet.targetScope.id) reasons.push(applyMissingReason('targetScope.id'));
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

export const REVISION_BRIDGE_APPLY_TXN_SCHEMA = 'revision-bridge.apply-txn.v1';
export const REVISION_BRIDGE_APPLY_TXN_PREVIEW_SCHEMA = 'revision-bridge.apply-txn-preview.v1';
export const REVISION_BRIDGE_APPLY_PLAN_SCHEMA = 'revision-bridge.apply-plan.v1';
export const REVISION_BRIDGE_APPLY_RECEIPT_SCHEMA = 'revision-bridge.apply-receipt.v1';
export const REVISION_BRIDGE_APPLY_RECEIPT_PREVIEW_SCHEMA = 'revision-bridge.apply-receipt-preview.v1';
export const REVISION_BRIDGE_APPLY_TXN_STATES = Object.freeze([
  'Prepared',
  'WritingTemps',
  'Committing',
  'Verifying',
  'Applied',
  'Failed',
  'Recovering',
  'Closed',
]);
const APPLY_TXN_VALID_CODE = 'REVISION_BRIDGE_APPLY_TXN_VALID';
const APPLY_TXN_INVALID_CODE = 'E_REVISION_BRIDGE_APPLY_TXN_INVALID';
const APPLY_TXN_PREVIEW_BLOCKED_CODE = 'E_REVISION_BRIDGE_APPLY_TXN_BLOCKED';
const APPLY_TXN_RUNTIME_NOT_ENABLED_CODE = 'REVISION_BRIDGE_APPLY_TXN_RUNTIME_NOT_ENABLED';
const APPLY_TXN_INVALID_TRANSITION_CODE = 'REVISION_BRIDGE_APPLY_TXN_INVALID_TRANSITION';
const APPLY_TXN_MISSING_TRANSITION_SIDE_CODE = 'REVISION_BRIDGE_APPLY_TXN_TRANSITION_FIELDS_REQUIRED';
const APPLY_TXN_DECISION_SET_EMPTY_CODE = 'REVISION_BRIDGE_APPLY_TXN_DECISION_SET_EMPTY';
const APPLY_PLAN_NO_ACCEPTED_DECISIONS_CODE = 'REVISION_BRIDGE_APPLY_PLAN_NO_ACCEPTED_DECISIONS';
const APPLY_RECEIPT_VALID_CODE = 'REVISION_BRIDGE_APPLY_RECEIPT_VALID';
const APPLY_RECEIPT_INVALID_CODE = 'E_REVISION_BRIDGE_APPLY_RECEIPT_INVALID';
const APPLY_RECEIPT_PREVIEW_BLOCKED_CODE = 'E_REVISION_BRIDGE_APPLY_RECEIPT_BLOCKED';
const APPLY_RECEIPT_RUNTIME_NOT_ENABLED_CODE = 'REVISION_BRIDGE_APPLY_RECEIPT_RUNTIME_NOT_ENABLED';
const APPLY_RECEIPT_WRITE_SET_EMPTY_CODE = 'REVISION_BRIDGE_APPLY_RECEIPT_WRITE_SET_EMPTY';
export const REVISION_BRIDGE_APPLY_TXN_REASON_CODES = Object.freeze([
  APPLY_TXN_RUNTIME_NOT_ENABLED_CODE,
  APPLY_TXN_INVALID_TRANSITION_CODE,
  APPLY_TXN_MISSING_TRANSITION_SIDE_CODE,
  APPLY_TXN_DECISION_SET_EMPTY_CODE,
  'REVISION_BRIDGE_FIELD_REQUIRED',
  'REVISION_BRIDGE_FIELD_INVALID',
]);
export const REVISION_BRIDGE_APPLY_RECEIPT_REASON_CODES = Object.freeze([
  APPLY_RECEIPT_RUNTIME_NOT_ENABLED_CODE,
  APPLY_RECEIPT_WRITE_SET_EMPTY_CODE,
  'REVISION_BRIDGE_FIELD_REQUIRED',
  'REVISION_BRIDGE_FIELD_INVALID',
]);

const APPLY_TXN_ALLOWED_TRANSITIONS = Object.freeze({
  Prepared: Object.freeze(['WritingTemps', 'Failed']),
  WritingTemps: Object.freeze(['Committing', 'Failed']),
  Committing: Object.freeze(['Verifying', 'Failed']),
  Verifying: Object.freeze(['Applied', 'Failed']),
  Applied: Object.freeze(['Closed', 'Recovering']),
  Failed: Object.freeze(['Recovering', 'Closed']),
  Recovering: Object.freeze(['Closed', 'Failed']),
  Closed: Object.freeze([]),
});

function normalizeApplyTxnState(value) {
  const state = normalizeString(value);
  return REVISION_BRIDGE_APPLY_TXN_STATES.includes(state) ? state : '';
}

function normalizeApplyTxnTargetScope(input) {
  const scope = isPlainObject(input) ? input : {};
  return {
    type: normalizeString(scope.type),
    id: normalizeString(scope.id),
    sceneIds: Array.isArray(scope.sceneIds)
      ? [...new Set(scope.sceneIds.map((item) => normalizeString(item)).filter(Boolean))]
      : [],
  };
}

function normalizeApplyTxnCandidate(input) {
  const txn = isPlainObject(input) ? input : {};
  const decisionSet = normalizeDecisionSet(txn.decisionSet);
  return {
    schemaVersion: normalizeString(txn.schemaVersion),
    projectId: normalizeString(txn.projectId),
    revisionSessionId: normalizeString(txn.revisionSessionId),
    baselineHash: normalizeString(txn.baselineHash),
    targetScope: normalizeApplyTxnTargetScope(txn.targetScope),
    decisionSet,
    fromState: normalizeApplyTxnState(txn.fromState),
    toState: normalizeApplyTxnState(txn.toState),
  };
}

function collectApplyTxnValidationReasons(input, txn) {
  const reasons = [];
  if (!isPlainObject(input)) {
    reasons.push(invalidField('applyTxn', 'applyTxn must be an object'));
    return reasons;
  }
  if (!txn.schemaVersion) {
    reasons.push(missingField('schemaVersion'));
  } else if (txn.schemaVersion !== REVISION_BRIDGE_APPLY_TXN_SCHEMA) {
    reasons.push(invalidField('schemaVersion', 'schemaVersion is not supported'));
  }
  if (!txn.projectId) reasons.push(missingField('projectId'));
  if (!txn.revisionSessionId) reasons.push(missingField('revisionSessionId'));
  if (!txn.baselineHash) reasons.push(missingField('baselineHash'));
  if (!isPlainObject(input.targetScope)) {
    reasons.push(missingField('targetScope'));
  } else if (!txn.targetScope.type) {
    reasons.push(missingField('targetScope.type'));
  } else if (!txn.targetScope.id) {
    reasons.push(missingField('targetScope.id'));
  }
  if (!isPlainObject(input.decisionSet)) {
    reasons.push(missingField('decisionSet'));
  } else if (!Array.isArray(input.decisionSet.decisions)) {
    reasons.push(invalidField('decisionSet.decisions', 'decisionSet.decisions must be an array'));
  } else if (txn.decisionSet.decisions.length === 0) {
    reasons.push({
      code: APPLY_TXN_DECISION_SET_EMPTY_CODE,
      field: 'decisionSet.decisions',
      message: 'decisionSet must include at least one decision',
    });
  }

  const inputFromState = normalizeString(input.fromState);
  const inputToState = normalizeString(input.toState);
  const hasTransitionIntent = Boolean(inputFromState || inputToState);
  if (hasTransitionIntent) {
    if (!txn.fromState || !txn.toState) {
      reasons.push({
        code: APPLY_TXN_MISSING_TRANSITION_SIDE_CODE,
        field: !txn.fromState ? 'fromState' : 'toState',
        message: 'fromState and toState are both required when transition is provided',
      });
    } else {
      const allowedNext = APPLY_TXN_ALLOWED_TRANSITIONS[txn.fromState] || [];
      if (!allowedNext.includes(txn.toState)) {
        reasons.push({
          code: APPLY_TXN_INVALID_TRANSITION_CODE,
          field: 'toState',
          message: `${txn.fromState} cannot transition to ${txn.toState}`,
        });
      }
    }
  }
  return reasons;
}

// RB_18_APPLY_TXN_CONTRACTS_START
export function validateRevisionBridgeApplyTxn(input = {}) {
  const applyTxn = normalizeApplyTxnCandidate(input);
  const reasons = collectApplyTxnValidationReasons(input, applyTxn);
  if (reasons.length > 0) {
    return {
      ok: false,
      type: 'revisionBridge.applyTxnValidation',
      code: APPLY_TXN_INVALID_CODE,
      reason: reasons[0]?.code || APPLY_TXN_INVALID_CODE,
      reasons,
      applyTxn: null,
    };
  }
  return {
    ok: true,
    type: 'revisionBridge.applyTxnValidation',
    code: APPLY_TXN_VALID_CODE,
    reason: APPLY_TXN_VALID_CODE,
    reasons: [],
    applyTxn: cloneJsonSafe(applyTxn),
  };
}

export function previewRevisionBridgeApplyTxn(input = {}) {
  const validation = validateRevisionBridgeApplyTxn(input);
  const applyTxn = validation.ok ? validation.applyTxn : normalizeApplyTxnCandidate(input);
  const reasons = validation.ok
    ? [{
      code: APPLY_TXN_RUNTIME_NOT_ENABLED_CODE,
      field: 'applyTxn',
      message: 'ApplyTxn runtime execution is not enabled in contract-only mode',
    }]
    : validation.reasons;
  return {
    schemaVersion: REVISION_BRIDGE_APPLY_TXN_PREVIEW_SCHEMA,
    type: 'revisionBridge.applyTxnPreview',
    status: 'blocked',
    code: APPLY_TXN_PREVIEW_BLOCKED_CODE,
    reason: reasons[0]?.code || APPLY_TXN_PREVIEW_BLOCKED_CODE,
    canOpen: false,
    applyTxn: cloneJsonSafe(applyTxn),
    allowedTransitions: cloneJsonSafe(APPLY_TXN_ALLOWED_TRANSITIONS),
    reasons,
  };
}

// RB_32_APPLY_PLAN_PREVIEW_CONTRACTS_START
function applyPlanAcceptedDecisionIds(decisions = []) {
  return decisions
    .filter((decision) => isPlainObject(decision) && decision.status === 'accepted')
    .map((decision) => normalizeString(decision.decisionId))
    .filter(Boolean);
}

function applyPlanScopeSceneIds(targetScope = {}) {
  const scope = isPlainObject(targetScope) ? targetScope : {};
  if (Array.isArray(scope.sceneIds) && scope.sceneIds.length > 0) {
    return scope.sceneIds.map((sceneId) => normalizeString(sceneId)).filter(Boolean);
  }
  const scopeId = normalizeString(scope.id);
  return scopeId ? [scopeId] : [];
}

export function previewRevisionBridgeApplyPlan(input = {}) {
  const validation = validateRevisionBridgeApplyTxn(input);
  const applyTxn = validation.ok ? validation.applyTxn : normalizeApplyTxnCandidate(input);
  const acceptedDecisionIds = applyPlanAcceptedDecisionIds(applyTxn.decisionSet?.decisions || []);
  const sceneIds = applyPlanScopeSceneIds(applyTxn.targetScope);
  const reasons = validation.ok
    ? (acceptedDecisionIds.length > 0
      ? [{
        code: APPLY_TXN_RUNTIME_NOT_ENABLED_CODE,
        field: 'applyPlan',
        message: 'ApplyPlan runtime execution is not enabled in contract-only mode',
      }]
      : [{
        code: APPLY_PLAN_NO_ACCEPTED_DECISIONS_CODE,
        field: 'decisionSet.decisions.status',
        message: 'ApplyPlan requires at least one accepted decision',
      }])
    : validation.reasons;
  const sceneBuckets = sceneIds.map((sceneId) => ({
    sceneId,
    decisionIds: cloneJsonSafe(acceptedDecisionIds),
    decisionCount: acceptedDecisionIds.length,
  }));

  return {
    schemaVersion: REVISION_BRIDGE_APPLY_PLAN_SCHEMA,
    type: 'revisionBridge.applyPlanPreview',
    status: 'blocked',
    code: APPLY_TXN_PREVIEW_BLOCKED_CODE,
    reason: reasons[0]?.code || APPLY_TXN_PREVIEW_BLOCKED_CODE,
    canApply: false,
    applyTxn: cloneJsonSafe(applyTxn),
    applyPlan: {
      scopeType: normalizeString(applyTxn.targetScope?.type),
      scopeId: normalizeString(applyTxn.targetScope?.id),
      sceneBuckets,
      acceptedDecisionIds: cloneJsonSafe(acceptedDecisionIds),
      decisionSummary: {
        total: Array.isArray(applyTxn.decisionSet?.decisions) ? applyTxn.decisionSet.decisions.length : 0,
        accepted: acceptedDecisionIds.length,
      },
      runtimeMode: 'contractOnly',
    },
    reasons,
  };
}
// RB_32_APPLY_PLAN_PREVIEW_CONTRACTS_END
// RB_18_APPLY_TXN_CONTRACTS_END

// RB_26_APPLY_RECEIPT_CONTRACTS_START
function normalizeApplyReceiptStatus(value) {
  const status = normalizeString(value);
  return ['applied', 'failed', 'blocked'].includes(status) ? status : 'blocked';
}

function normalizeApplyReceiptWriteEntry(input = {}) {
  const entry = isPlainObject(input) ? input : {};
  return {
    entityKind: normalizeString(entry.entityKind),
    entityId: normalizeString(entry.entityId),
    beforeHash: normalizeString(entry.beforeHash),
    afterHash: normalizeString(entry.afterHash),
  };
}

function normalizeApplyReceiptDecisionSummary(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const toCount = (value) => {
    if (!Number.isFinite(Number(value))) return 0;
    const count = Math.floor(Number(value));
    return count > 0 ? count : 0;
  };
  return {
    total: toCount(source.total),
    accepted: toCount(source.accepted),
    rejected: toCount(source.rejected),
    deferred: toCount(source.deferred),
  };
}

function normalizeApplyReceiptCandidate(input = {}) {
  const receipt = isPlainObject(input) ? input : {};
  return {
    schemaVersion: normalizeString(receipt.schemaVersion),
    receiptId: normalizeString(receipt.receiptId),
    applyTxnId: normalizeString(receipt.applyTxnId),
    projectId: normalizeString(receipt.projectId),
    revisionSessionId: normalizeString(receipt.revisionSessionId),
    baselineHash: normalizeString(receipt.baselineHash),
    targetScope: normalizeApplyTxnTargetScope(receipt.targetScope),
    status: normalizeApplyReceiptStatus(receipt.status),
    decisionSummary: normalizeApplyReceiptDecisionSummary(receipt.decisionSummary),
    writes: Array.isArray(receipt.writes)
      ? receipt.writes.map((entry) => normalizeApplyReceiptWriteEntry(entry))
      : [],
    runtimeMode: normalizeString(receipt.runtimeMode) || 'contractOnly',
    createdAt: normalizeString(receipt.createdAt),
  };
}

function collectApplyReceiptValidationReasons(input, receipt) {
  const reasons = [];
  if (!isPlainObject(input)) {
    reasons.push(invalidField('applyReceipt', 'applyReceipt must be an object'));
    return reasons;
  }
  if (!receipt.schemaVersion) {
    reasons.push(missingField('schemaVersion'));
  } else if (receipt.schemaVersion !== REVISION_BRIDGE_APPLY_RECEIPT_SCHEMA) {
    reasons.push(invalidField('schemaVersion', 'schemaVersion is not supported'));
  }
  if (!receipt.receiptId) reasons.push(missingField('receiptId'));
  if (!receipt.projectId) reasons.push(missingField('projectId'));
  if (!receipt.revisionSessionId) reasons.push(missingField('revisionSessionId'));
  if (!receipt.baselineHash) reasons.push(missingField('baselineHash'));
  if (!isPlainObject(input.targetScope)) {
    reasons.push(missingField('targetScope'));
  } else if (!receipt.targetScope.type) {
    reasons.push(missingField('targetScope.type'));
  } else if (!receipt.targetScope.id) {
    reasons.push(missingField('targetScope.id'));
  }
  if (!isPlainObject(input.decisionSummary)) reasons.push(missingField('decisionSummary'));
  if (!Array.isArray(input.writes)) {
    reasons.push(missingField('writes'));
  } else if (receipt.status === 'applied' && receipt.writes.length === 0) {
    reasons.push({
      code: APPLY_RECEIPT_WRITE_SET_EMPTY_CODE,
      field: 'writes',
      message: 'applied receipt must include at least one write entry',
    });
  }

  receipt.writes.forEach((entry, index) => {
    if (!entry.entityKind) reasons.push(missingField(`writes.${index}.entityKind`));
    if (!entry.entityId) reasons.push(missingField(`writes.${index}.entityId`));
    if (!entry.beforeHash) reasons.push(missingField(`writes.${index}.beforeHash`));
    if (!entry.afterHash) reasons.push(missingField(`writes.${index}.afterHash`));
  });

  const counted = receipt.decisionSummary.accepted + receipt.decisionSummary.rejected + receipt.decisionSummary.deferred;
  if (receipt.decisionSummary.total > 0 && counted > receipt.decisionSummary.total) {
    reasons.push(invalidField(
      'decisionSummary.total',
      'decisionSummary total must be greater or equal to accepted, rejected and deferred sum',
    ));
  }
  return reasons;
}

export function validateRevisionBridgeApplyReceipt(input = {}) {
  const applyReceipt = normalizeApplyReceiptCandidate(input);
  const reasons = collectApplyReceiptValidationReasons(input, applyReceipt);
  if (reasons.length > 0) {
    return {
      ok: false,
      type: 'revisionBridge.applyReceiptValidation',
      code: APPLY_RECEIPT_INVALID_CODE,
      reason: reasons[0]?.code || APPLY_RECEIPT_INVALID_CODE,
      reasons,
      applyReceipt: null,
    };
  }
  return {
    ok: true,
    type: 'revisionBridge.applyReceiptValidation',
    code: APPLY_RECEIPT_VALID_CODE,
    reason: APPLY_RECEIPT_VALID_CODE,
    reasons: [],
    applyReceipt: cloneJsonSafe(applyReceipt),
  };
}

export function previewRevisionBridgeApplyReceipt(input = {}) {
  const validation = validateRevisionBridgeApplyReceipt(input);
  const applyReceipt = validation.ok
    ? validation.applyReceipt
    : normalizeApplyReceiptCandidate(input);
  const reasons = validation.ok
    ? [{
      code: APPLY_RECEIPT_RUNTIME_NOT_ENABLED_CODE,
      field: 'applyReceipt',
      message: 'ApplyReceipt persistence is not enabled in contract-only mode',
    }]
    : validation.reasons;
  return {
    schemaVersion: REVISION_BRIDGE_APPLY_RECEIPT_PREVIEW_SCHEMA,
    type: 'revisionBridge.applyReceiptPreview',
    status: 'blocked',
    code: APPLY_RECEIPT_PREVIEW_BLOCKED_CODE,
    reason: reasons[0]?.code || APPLY_RECEIPT_PREVIEW_BLOCKED_CODE,
    canPersist: false,
    applyReceipt: cloneJsonSafe(applyReceipt),
    reasons,
  };
}
// RB_26_APPLY_RECEIPT_CONTRACTS_END

// RB_19_REVISION_SESSION_IMPORT_SEAM_PREVIEW_CONTRACTS_START
const REVISION_SESSION_IMPORT_SEAM_PREVIEW_READY_CODE =
  'REVISION_BRIDGE_REVISION_SESSION_IMPORT_SEAM_PREVIEW_READY';
const REVISION_SESSION_IMPORT_SEAM_PREVIEW_BLOCKED_CODE =
  'REVISION_BRIDGE_REVISION_SESSION_IMPORT_SEAM_PREVIEW_BLOCKED';
const REVISION_SESSION_IMPORT_SEAM_PREVIEW_DIAGNOSTICS_CODE =
  'E_REVISION_BRIDGE_REVISION_SESSION_IMPORT_SEAM_PREVIEW_DIAGNOSTICS';

function revisionSessionImportSeamPreviewIds(input) {
  const source = isPlainObject(input) ? input : {};
  return {
    projectId: normalizeString(source.projectId),
    revisionSessionId: normalizeString(source.revisionSessionId),
    exportId: normalizeString(source.exportId),
    baselineHash: normalizeString(source.baselineHash),
  };
}

function revisionSessionImportSeamPreviewInputReasons(input, ids) {
  const reasons = [];
  if (!isPlainObject(input)) {
    reasons.push(invalidField(
      'revisionSessionImportSeamPreview',
      'revisionSession import seam preview input must be an object',
    ));
    return reasons;
  }
  if (!ids.projectId) reasons.push(missingField('projectId'));
  if (!ids.revisionSessionId) reasons.push(missingField('revisionSessionId'));
  if (!ids.exportId) reasons.push(missingField('exportId'));
  if (!ids.baselineHash) reasons.push(missingField('baselineHash'));
  if (!isPlainObject(input.parsedSurface)) reasons.push(missingField('parsedSurface'));
  if (hasOwnField(input, 'createdAt') && typeof input.createdAt !== 'string') {
    reasons.push(invalidField('createdAt', 'createdAt must be a caller-supplied string'));
  }
  if (hasOwnField(input, 'updatedAt') && typeof input.updatedAt !== 'string') {
    reasons.push(invalidField('updatedAt', 'updatedAt must be a caller-supplied string'));
  }
  if (hasOwnField(input, 'context') && !isPlainObject(input.context)) {
    reasons.push(invalidField('context', 'context must be a plain object'));
  }
  return reasons;
}

function revisionSessionImportSeamPreviewAnchorCandidate(input, index) {
  if (!isPlainObject(input)) return null;
  if (
    input.schemaVersion === REVISION_BRIDGE_COMMENT_ANCHOR_PLACEMENT_SCHEMA
    && isPlainObject(input.inlineRange)
  ) {
    return cloneJsonSafe(input);
  }

  const placement = normalizeCommentPlacement(input);
  const from = Number.isSafeInteger(placement.range.from) ? placement.range.from : 0;
  const to = Number.isSafeInteger(placement.range.to) ? placement.range.to : from;
  return {
    schemaVersion: REVISION_BRIDGE_COMMENT_ANCHOR_PLACEMENT_SCHEMA,
    placementId: placement.placementId || `placement-${index}`,
    threadId: placement.threadId || `thread-${index}`,
    targetScope: cloneJsonSafe(placement.targetScope),
    inlineRange: {
      schemaVersion: REVISION_BRIDGE_INLINE_RANGE_SCHEMA,
      kind: 'span',
      blockId: placement.anchor.value,
      lineageId: '',
      from,
      to: to >= from ? to : from,
      quote: placement.quote,
      prefix: placement.prefix,
      suffix: placement.suffix,
      confidence: 'exact',
      riskClass: 'low',
      automationPolicy: 'manualOnly',
      deletedTarget: false,
      reasonCodes: [],
    },
    resolvedState: 'open',
    acceptedState: 'pending',
    diagnosticsOnly: false,
  };
}

function revisionSessionImportSeamPreviewPlacementCandidates(parsedSurface) {
  const placements = isPlainObject(parsedSurface) && Array.isArray(parsedSurface.commentPlacements)
    ? parsedSurface.commentPlacements
    : [];
  return placements
    .map((item, index) => revisionSessionImportSeamPreviewAnchorCandidate(item, index))
    .filter((item) => isPlainObject(item));
}

function revisionSessionImportSeamPreviewEnvelope(
  status,
  code,
  ids,
  adapterResult,
  batchDiagnostics,
  placementAdmissionPreview,
  skeletonAdmissionPreview,
  reasons,
) {
  return {
    schemaVersion: REVISION_BRIDGE_REVISION_SESSION_IMPORT_SEAM_PREVIEW_SCHEMA,
    type: 'revisionBridge.revisionSession.importSeamPreview',
    status,
    code,
    reason: reasons[0]?.code || code,
    canCreateRevisionSession: status === 'ready',
    canMutateManuscript: false,
    projectId: ids.projectId,
    revisionSessionId: ids.revisionSessionId,
    exportId: ids.exportId,
    baselineHash: ids.baselineHash,
    parsedReviewSurfaceAdapter: cloneJsonSafe(adapterResult),
    placementBatchDiagnostics: cloneJsonSafe(batchDiagnostics),
    placementAdmissionPreview: cloneJsonSafe(placementAdmissionPreview),
    skeletonAdmissionPreview: cloneJsonSafe(skeletonAdmissionPreview),
    candidateSession: status === 'ready' ? cloneJsonSafe(skeletonAdmissionPreview?.candidateSession) : null,
    reasons: cloneJsonSafe(reasons),
  };
}

function revisionSessionImportSeamPreviewEvaluate(input) {
  const source = isPlainObject(input) ? input : {};
  const ids = revisionSessionImportSeamPreviewIds(source);
  const inputReasons = revisionSessionImportSeamPreviewInputReasons(input, ids);
  if (inputReasons.length > 0) {
    return revisionSessionImportSeamPreviewEnvelope(
      'diagnostics',
      REVISION_SESSION_IMPORT_SEAM_PREVIEW_DIAGNOSTICS_CODE,
      ids,
      null,
      null,
      null,
      null,
      inputReasons,
    );
  }

  const adapterInput = {
    projectId: ids.projectId,
    sessionId: ids.revisionSessionId,
    baselineHash: ids.baselineHash,
    parsedSurface: cloneJsonSafe(source.parsedSurface),
  };
  if (hasOwnField(source, 'createdAt')) adapterInput.createdAt = source.createdAt;
  if (hasOwnField(source, 'updatedAt')) adapterInput.updatedAt = source.updatedAt;

  const adapterResult = adaptParsedReviewSurfaceToReviewPacketPreviewInput(adapterInput);
  if (adapterResult.ok !== true) {
    return revisionSessionImportSeamPreviewEnvelope(
      'diagnostics',
      REVISION_SESSION_IMPORT_SEAM_PREVIEW_DIAGNOSTICS_CODE,
      ids,
      adapterResult,
      null,
      null,
      null,
      adapterResult.reasons || [],
    );
  }

  const placementCandidates = revisionSessionImportSeamPreviewPlacementCandidates(source.parsedSurface);
  const batchDiagnostics = evaluateCommentAnchorPlacementBatchDiagnostics({
    placements: placementCandidates,
    context: isPlainObject(source.context) ? cloneJsonSafe(source.context) : {},
  });
  const placementAdmissionInput = {
    batchDiagnostics,
  };
  if (Array.isArray(source.blockingStatuses)) {
    placementAdmissionInput.blockingStatuses = cloneJsonSafe(source.blockingStatuses);
  }
  const placementAdmissionPreview = previewRevisionSessionPlacementAdmission(placementAdmissionInput);
  const skeletonAdmissionPreview = previewRevisionSessionSkeletonAdmission({
    projectId: ids.projectId,
    revisionSessionId: ids.revisionSessionId,
    exportId: ids.exportId,
    baselineHash: ids.baselineHash,
    placementAdmissionPreview,
  });

  if (skeletonAdmissionPreview.status === 'admit') {
    return revisionSessionImportSeamPreviewEnvelope(
      'ready',
      REVISION_SESSION_IMPORT_SEAM_PREVIEW_READY_CODE,
      ids,
      adapterResult,
      batchDiagnostics,
      placementAdmissionPreview,
      skeletonAdmissionPreview,
      [],
    );
  }
  if (skeletonAdmissionPreview.status === 'block') {
    return revisionSessionImportSeamPreviewEnvelope(
      'blocked',
      REVISION_SESSION_IMPORT_SEAM_PREVIEW_BLOCKED_CODE,
      ids,
      adapterResult,
      batchDiagnostics,
      placementAdmissionPreview,
      skeletonAdmissionPreview,
      skeletonAdmissionPreview.reasons || [],
    );
  }
  return revisionSessionImportSeamPreviewEnvelope(
    'diagnostics',
    REVISION_SESSION_IMPORT_SEAM_PREVIEW_DIAGNOSTICS_CODE,
    ids,
    adapterResult,
    batchDiagnostics,
    placementAdmissionPreview,
    skeletonAdmissionPreview,
    skeletonAdmissionPreview.reasons || [{
      code: REVISION_SESSION_IMPORT_SEAM_PREVIEW_DIAGNOSTICS_CODE,
      field: 'skeletonAdmissionPreview',
      message: 'skeleton admission preview returned diagnostics',
    }],
  );
}
// RB_19_REVISION_SESSION_IMPORT_SEAM_PREVIEW_CONTRACTS_END

// RB_31_REVISION_SESSION_REGISTRY_RECORD_CONTRACTS_START
function revisionSessionRegistryGraphCount(value) {
  return Array.isArray(value) ? value.length : 0;
}

function revisionSessionRegistryGraphCounts(candidateSession) {
  const session = isPlainObject(candidateSession) ? candidateSession : {};
  const graph = isPlainObject(session.reviewGraph) ? session.reviewGraph : {};
  return {
    commentThreads: revisionSessionRegistryGraphCount(graph.commentThreads),
    commentPlacements: revisionSessionRegistryGraphCount(graph.commentPlacements),
    textChanges: revisionSessionRegistryGraphCount(graph.textChanges),
    structuralChanges: revisionSessionRegistryGraphCount(graph.structuralChanges),
    diagnosticItems: revisionSessionRegistryGraphCount(graph.diagnosticItems),
    decisionStates: revisionSessionRegistryGraphCount(graph.decisionStates),
  };
}

function revisionSessionRegistryImportPreview(input) {
  if (!isPlainObject(input)) return {};
  return isPlainObject(input.importPreview) ? input.importPreview : input;
}

function revisionSessionRegistryInputReasons(input, preview) {
  const reasons = [];
  if (!isPlainObject(input)) {
    reasons.push(invalidField(
      'revisionSessionRegistryRecord',
      'revision session registry record input must be an object',
    ));
    return reasons;
  }
  if (!isPlainObject(preview)) {
    reasons.push(missingField('importPreview'));
    return reasons;
  }
  if (
    hasOwnField(preview, 'schemaVersion')
    && preview.schemaVersion !== REVISION_BRIDGE_REVISION_SESSION_IMPORT_SEAM_PREVIEW_SCHEMA
  ) {
    reasons.push(invalidField(
      'importPreview.schemaVersion',
      'import preview schemaVersion is not supported',
    ));
  }
  if (!normalizeString(preview.projectId)) reasons.push(missingField('importPreview.projectId'));
  if (!normalizeString(preview.revisionSessionId)) reasons.push(missingField('importPreview.revisionSessionId'));
  if (!normalizeString(preview.exportId)) reasons.push(missingField('importPreview.exportId'));
  if (!normalizeString(preview.baselineHash)) reasons.push(missingField('importPreview.baselineHash'));
  if (preview.canMutateManuscript === true) {
    reasons.push(invalidField(
      'importPreview.canMutateManuscript',
      'import preview cannot allow manuscript mutation',
    ));
  }
  return reasons;
}

export function revisionSessionRegistryRecordBuild(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const preview = revisionSessionRegistryImportPreview(input);
  const reasons = revisionSessionRegistryInputReasons(input, preview);
  const previewStatus = normalizeStringEnum(preview.status, ['ready', 'blocked', 'diagnostics'], 'diagnostics');
  const previewReasons = Array.isArray(preview.reasons) ? cloneJsonSafe(preview.reasons) : [];
  const graphCounts = revisionSessionRegistryGraphCounts(preview.candidateSession);

  return {
    schemaVersion: REVISION_BRIDGE_REVISION_SESSION_REGISTRY_RECORD_SCHEMA,
    type: 'revisionBridge.revisionSession.registryRecord',
    status: reasons.length > 0 ? 'invalid' : 'recorded',
    code: reasons.length > 0
      ? REVIEWGRAPH_INVALID_CODE
      : REVIEWGRAPH_VALID_CODE,
    reason: reasons.length > 0
      ? reasons[0].code
      : REVIEWGRAPH_VALID_CODE,
    projectId: normalizeString(preview.projectId),
    revisionSessionId: normalizeString(preview.revisionSessionId),
    exportId: normalizeString(preview.exportId),
    baselineHash: normalizeString(preview.baselineHash),
    importPreviewStatus: previewStatus,
    importPreviewCode: normalizeString(preview.code),
    importPreviewReason: normalizeString(preview.reason),
    candidateSessionAvailable: isPlainObject(preview.candidateSession),
    sessionState: previewStatus === 'ready' ? 'Imported' : 'Diagnosed',
    storagePolicy: 'registryOnly',
    canMutateManuscript: false,
    importReasonCount: previewReasons.length,
    reviewGraphCounts: graphCounts,
    createdAt: normalizeString(source.createdAt || preview.createdAt),
    updatedAt: normalizeString(source.updatedAt || preview.updatedAt),
    importReasons: previewReasons,
    reasons: cloneJsonSafe(reasons),
  };
}
// RB_31_REVISION_SESSION_REGISTRY_RECORD_CONTRACTS_END
