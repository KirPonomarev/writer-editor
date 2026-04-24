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
