const { documentMedia, MEDIA_LIMITS } = require('../io/documentMedia.js');
const fs = require('node:fs').promises;
const path = require('node:path');
const crypto = require('node:crypto');

const {
  isPathInsideBoundary,
  joinPathSegmentsWithinRoot,
} = require('../core/io/path-boundary');
const { commitProjectTransaction, recoverProjectTransaction, readPendingProjectTransactionBinding,
  readVerifiedProjectTransaction } = require('../core/project-transaction-v1.cjs');

const DOCX_IMPORT_SAFE_CREATE_RECEIPT_SCHEMA = 'revision-bridge.docx-import-safe-create-receipt.v1';
const DOCX_IMPORT_SAFE_CREATE_RECEIPT_TYPE = 'docx.import.safeCreate.receipt';
const DOCX_IMPORT_SAFE_CREATE_READY_REASON = 'DOCX_IMPORT_SAFE_CREATE_APPLIED';
const DOCX_IMPORT_PREVIEW_SCHEMA = 'revision-bridge.docx-import-preview.v1';
const DOCX_IMPORT_PREVIEW_TYPE = 'docx.import.preview';
const DOCX_IMPORT_PREVIEW_READY_CODE = 'DOCX_IMPORT_PREVIEW_READY';
const DOCX_IMPORT_PREVIEW_LOSS_REPORT_SCHEMA = 'revision-bridge.docx-import-preview.loss-report.v1';
const DOCX_CONTENT_PREVIEW_SCHEMA = 'revision-bridge.docx-content-preview.v1';
const DOCX_CONTENT_PREVIEW_TYPE = 'docxContentPreviewReport';
const DOCX_CONTENT_PREVIEW_SOURCE_PART = 'word/document.xml';
const DOCX_IMPORT_SAFE_CREATE_IDEMPOTENT_INTEGRITY_CODE =
  'DOCX_SAFE_CREATE_IDEMPOTENT_RECEIPT_INTEGRITY_FAILED';
const DOCX_IMPORT_SAFE_CREATE_IDEMPOTENT_INTEGRITY_REASON =
  'docx_import_safe_create_idempotent_receipt_integrity_failed';
const DOCX_IMPORT_SAFE_CREATE_ADMISSION_LIMIT = 64;
const DOCX_IMPORT_SAFE_CREATE_MESSAGE_CODE_RE = /^(DOCX|FLOW)_[A-Z0-9_]{1,95}$/u;
const DOCX_IMPORT_SAFE_CREATE_SCENE_INTEGRITY_SCOPE =
  'CANONICAL_TEXT_NORMALIZED_LINE_ENDINGS';
const DOCX_IMPORT_SAFE_CREATE_CREATED_AT_AUTHORITY =
  'NON_AUTHORITATIVE_EVENT_METADATA_SHAPE_ONLY';
const DOCX_IMPORT_SAFE_CREATE_DEFAULT_OPERATION_NONCE = 'docx-import-safe-create-request';
const DOCX_IMPORT_SAFE_CREATE_MAX_OPERATION_NONCE_CHARS = 120;
const docxImportPreviewPlanAdmissions = new Map();

// GENERIC-01 (Pass 2): durable receipt store. The store is keyed by the
// main-owned importOperationId. Re-applying the same operation id returns the
// prior durable receipt (writerCalls=0); a new operation id on the same
// artifact produces an independent copy.
const DOCX_IMPORT_RECEIPT_V2_SCHEMA = 'revision-bridge.docx-import-receipt.v2';
const hashExactBytes = value => crypto.createHash('sha256').update(value).digest('hex');
const DOCX_IMPORT_RECEIPT_V3_SCHEMA = 'revision-bridge.docx-import-receipt.v3';
const DOCX_IMPORT_RECEIPT_STORE_DIRNAME = path.join('.yalken', 'docx-import', 'receipts');

const DOCX_IMPORT_SAFE_CREATE_ALLOWED_PLAN_KEYS = new Set([
  'ok',
  'schemaVersion',
  'type',
  'status',
  'code',
  'reason',
  'decision',
  'writeEffects',
  'diagnostics',
  'evidence',
  'budgets',
  'source',
  'candidateCreatePlan',
  'lossReport',
  'previewHash',
  // GENERIC-01 (G6): carrier-ignored classification.
  'carrierIgnored',
]);
const DOCX_IMPORT_SAFE_CREATE_ALLOWED_ENTRY_KEYS = new Set([
  'sceneId',
  'kind',
  'title',
  'content',
  'contentTextHash',
  // GENERIC-01 (G1): full SHA-256 of the normalized importable content.
  'candidateContentSha256',
  'source',
]);
const DOCX_IMPORT_SAFE_CREATE_ALLOWED_ENTRY_SOURCE_KEYS = new Set([
  'schemaVersion',
  'type',
  'sourcePart',
  'paragraphRange',
  'paragraphCount',
  'textHash',
]);
const DOCX_IMPORT_SAFE_CREATE_FORBIDDEN_KEYS = new Set([
  'reviewPacket',
  'reviewSurface',
  'parsedReviewSurface',
  'activeReviewSession',
  'previewInput',
  'applyOps',
  'applyPlan',
  'canApply',
  'canCreateReviewPacket',
  'canPreviewApply',
  'canImportMutate',
  'canWriteStorage',
  'writeReceipt',
  'importReceipt',
  'exportReceipt',
  'safeCreatePlan',
  'rawBytes',
  'bufferSource',
  'filePath',
  'projectRoot',
  'packageInspection',
  'partPolicy',
  'intakePreflightReport',
  'docxIntakePreflightReport',
  'outPath',
  'outDir',
  'storage',
  'renderer',
  'preload',
  'path',
  'bytes',
  'zip',
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneJsonSafe(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function normalizeText(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function stableSort(value) {
  if (Array.isArray(value)) return value.map((entry) => stableSort(entry));
  if (!isPlainObject(value)) return value;
  const out = {};
  for (const key of Object.keys(value).sort((left, right) => left.localeCompare(right))) {
    out[key] = stableSort(value[key]);
  }
  return out;
}

function stableStringify(value) {
  return JSON.stringify(stableSort(value));
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(normalizeText(value), 'utf8').digest('hex');
}

function isSha256Hex(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}

function isIsoCreatedAt(value) {
  if (
    typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  ) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function hashDocxImportPreviewPlanForAdmission(plan) {
  if (!isPlainObject(plan)) return '';
  try {
    return sha256Text(stableStringify(plan));
  } catch {
    return '';
  }
}

function rememberDocxImportPreviewPlanAdmission(plan) {
  const admissionHash = hashDocxImportPreviewPlanForAdmission(plan);
  if (!admissionHash) return '';
  docxImportPreviewPlanAdmissions.delete(admissionHash);
  docxImportPreviewPlanAdmissions.set(admissionHash, true);
  while (docxImportPreviewPlanAdmissions.size > DOCX_IMPORT_SAFE_CREATE_ADMISSION_LIMIT) {
    const firstKey = docxImportPreviewPlanAdmissions.keys().next().value;
    docxImportPreviewPlanAdmissions.delete(firstKey);
  }
  return admissionHash;
}

function isDocxImportPreviewPlanAdmitted(plan) {
  const admissionHash = hashDocxImportPreviewPlanForAdmission(plan);
  if (!admissionHash || !docxImportPreviewPlanAdmissions.has(admissionHash)) {
    return false;
  }
  docxImportPreviewPlanAdmissions.delete(admissionHash);
  docxImportPreviewPlanAdmissions.set(admissionHash, true);
  return true;
}

function docxStableHash(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function docxCanonicalJson(value) {
  if (value === null) return 'null';
  const valueType = typeof value;
  if (valueType === 'string') return JSON.stringify(value);
  if (valueType === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  if (valueType === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return `[${value.map((item) => docxCanonicalJson(item)).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${docxCanonicalJson(value[key])}`
    )).join(',')}}`;
  }
  return 'null';
}

function recomputeDocxImportPreviewHash(plan) {
  const body = cloneJsonSafe(plan);
  delete body.previewHash;
  return docxStableHash(docxCanonicalJson(body));
}

function buildError(code, reason, details = {}) {
  return {
    ok: false,
    error: {
      code,
      reason,
      details,
    },
  };
}

function sanitizePublicErrorDetails(details) {
  if (!isPlainObject(details)) return {};
  const result = {};
  if (typeof details.field === 'string') result.field = details.field;
  if (Array.isArray(details.fields)) {
    result.fields = details.fields.filter((item) => typeof item === 'string');
  }
  if (typeof details.key === 'string') result.key = details.key;
  if (Number.isInteger(details.index)) result.index = details.index;
  if (typeof details.sceneId === 'string') result.sceneId = details.sceneId;
  if (Number.isInteger(details.maxChars)) result.maxChars = details.maxChars;
  if (Number.isInteger(details.payloadChars)) result.payloadChars = details.payloadChars;
  if (typeof details.expected === 'string' && /^[a-f0-9]{8,64}$/u.test(details.expected)) {
    result.expected = details.expected;
  }
  if (typeof details.failReason === 'string') result.failReason = details.failReason;
  if (typeof details.batchId === 'string') result.batchId = details.batchId;
  if (Array.isArray(details.staleMarkers)) {
    result.staleMarkerCount = details.staleMarkers.length;
  }
  return result;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function unsupportedKeys(value, allowedKeys) {
  if (!isPlainObject(value)) return [];
  return Object.keys(value).filter((key) => !allowedKeys.has(key)).sort();
}

function findForbiddenKey(value, pathParts = []) {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = findForbiddenKey(value[index], pathParts.concat(String(index)));
      if (nested) return nested;
    }
    return '';
  }
  if (!isPlainObject(value)) return '';

  for (const key of Object.keys(value)) {
    const nextPath = pathParts.concat(key);
    const isAllowedTopLevelWriteEffects = pathParts.length === 0 && key === 'writeEffects';
    if (!isAllowedTopLevelWriteEffects && DOCX_IMPORT_SAFE_CREATE_FORBIDDEN_KEYS.has(key)) {
      return nextPath.join('.');
    }
    const nested = findForbiddenKey(value[key], nextPath);
    if (nested) return nested;
  }
  return '';
}

function validateDocxImportPreviewPlan(plan) {
  if (!isPlainObject(plan)) {
    return buildError(
      'DOCX_SAFE_CREATE_PREVIEW_REQUIRED',
      'docx_import_safe_create_preview_required',
    );
  }

  const forbiddenKey = findForbiddenKey(plan);
  if (forbiddenKey) {
    return buildError(
      'DOCX_SAFE_CREATE_PREVIEW_FORBIDDEN_FIELD',
      'docx_import_safe_create_preview_forbidden_field',
      { key: forbiddenKey },
    );
  }

  const extraPlanKeys = unsupportedKeys(plan, DOCX_IMPORT_SAFE_CREATE_ALLOWED_PLAN_KEYS);
  if (extraPlanKeys.length > 0) {
    return buildError(
      'DOCX_SAFE_CREATE_PREVIEW_INVALID',
      'docx_import_safe_create_preview_unsupported_fields',
      { fields: extraPlanKeys },
    );
  }

  if (
    plan.schemaVersion !== DOCX_IMPORT_PREVIEW_SCHEMA
    || plan.type !== DOCX_IMPORT_PREVIEW_TYPE
    || plan.ok !== true
    || plan.status !== 'preview'
    || plan.code !== DOCX_IMPORT_PREVIEW_READY_CODE
    || plan.decision !== 'preview'
    || plan.writeEffects !== false
  ) {
    return buildError(
      'DOCX_SAFE_CREATE_PREVIEW_INVALID',
      'docx_import_safe_create_preview_invalid',
      { field: 'previewEnvelope' },
    );
  }

  if (typeof plan.previewHash !== 'string' || !/^[a-f0-9]{8}$/u.test(plan.previewHash)) {
    return buildError(
      'DOCX_SAFE_CREATE_PREVIEW_INVALID',
      'docx_import_safe_create_preview_hash_invalid',
      { field: 'previewHash' },
    );
  }
  const recomputedPreviewHash = recomputeDocxImportPreviewHash(plan);
  if (plan.previewHash !== recomputedPreviewHash) {
    return buildError(
      'DOCX_SAFE_CREATE_PREVIEW_TAMPERED',
      'docx_import_safe_create_preview_hash_mismatch',
      {
        field: 'previewHash',
        expected: recomputedPreviewHash,
      },
    );
  }

  if (!isPlainObject(plan.source)) {
    return buildError(
      'DOCX_SAFE_CREATE_PREVIEW_INVALID',
      'docx_import_safe_create_preview_invalid',
      { field: 'source' },
    );
  }
  if (
    plan.source.schemaVersion !== DOCX_CONTENT_PREVIEW_SCHEMA
    || plan.source.type !== DOCX_CONTENT_PREVIEW_TYPE
    || plan.source.sourcePart !== DOCX_CONTENT_PREVIEW_SOURCE_PART
    || typeof plan.source.contentPreviewHash !== 'string'
    || !/^[a-f0-9]{8}$/u.test(plan.source.contentPreviewHash)
    || typeof plan.source.textHash !== 'string'
    || !/^[a-f0-9]{8}$/u.test(plan.source.textHash)
    || !Number.isInteger(plan.source.paragraphCount)
    || plan.source.paragraphCount < 0
    || !Number.isInteger(plan.source.textLength)
    || plan.source.textLength < 0
  ) {
    return buildError(
      'DOCX_SAFE_CREATE_PREVIEW_INVALID',
      'docx_import_safe_create_preview_invalid',
      { field: 'source' },
    );
  }
  // GENERIC-01 (G1): full SHA-256 artifact identity on plan.source. Optional
  // but, if present, must be a 64-hex SHA-256. This is the identity thread.
  if (
    plan.source.sourceArtifactSha256 !== undefined
    && plan.source.sourceArtifactSha256 !== null
    && (
      typeof plan.source.sourceArtifactSha256 !== 'string'
      || !/^[a-f0-9]{64}$/u.test(plan.source.sourceArtifactSha256)
    )
  ) {
    return buildError(
      'DOCX_SAFE_CREATE_PREVIEW_INVALID',
      'docx_import_safe_create_preview_invalid',
      { field: 'source.sourceArtifactSha256' },
    );
  }
  if (
    plan.source.candidateContentSha256 !== undefined
    && plan.source.candidateContentSha256 !== null
    && (
      typeof plan.source.candidateContentSha256 !== 'string'
      || !/^[a-f0-9]{64}$/u.test(plan.source.candidateContentSha256)
    )
  ) {
    return buildError(
      'DOCX_SAFE_CREATE_PREVIEW_INVALID',
      'docx_import_safe_create_preview_invalid',
      { field: 'source.candidateContentSha256' },
    );
  }

  const candidate = plan.candidateCreatePlan;
  if (!isPlainObject(candidate)) {
    return buildError(
      'DOCX_SAFE_CREATE_PREVIEW_INVALID',
      'docx_import_safe_create_candidate_required',
      { field: 'candidateCreatePlan' },
    );
  }
  if (
    candidate.mode !== 'create-only'
    || candidate.sceneStrategy !== 'single-scene'
    || candidate.entryCount !== 1
    || !Array.isArray(candidate.entries)
    || candidate.entries.length !== 1
  ) {
    return buildError(
      'DOCX_SAFE_CREATE_PREVIEW_INVALID',
      'docx_import_safe_create_candidate_invalid',
      { field: 'candidateCreatePlan' },
    );
  }

  const entry = candidate.entries[0];
  if (!isPlainObject(entry)) {
    return buildError(
      'DOCX_SAFE_CREATE_PREVIEW_INVALID',
      'docx_import_safe_create_candidate_invalid',
      { field: 'candidateCreatePlan.entries.0' },
    );
  }
  const extraEntryKeys = unsupportedKeys(entry, DOCX_IMPORT_SAFE_CREATE_ALLOWED_ENTRY_KEYS);
  if (extraEntryKeys.length > 0) {
    return buildError(
      'DOCX_SAFE_CREATE_PREVIEW_INVALID',
      'docx_import_safe_create_candidate_unsupported_fields',
      { field: 'candidateCreatePlan.entries.0', fields: extraEntryKeys },
    );
  }
  if (
    typeof entry.sceneId !== 'string'
    || !/^docx-import-scene-[a-f0-9]{8}$/u.test(entry.sceneId)
    || entry.kind !== 'scene'
    || typeof entry.content !== 'string'
    || typeof entry.contentTextHash !== 'string'
    || !/^[a-f0-9]{8}$/u.test(entry.contentTextHash)
  ) {
    return buildError(
      'DOCX_SAFE_CREATE_PREVIEW_INVALID',
      'docx_import_safe_create_candidate_invalid',
      { field: 'candidateCreatePlan.entries.0' },
    );
  }
  // GENERIC-01 (G1): full SHA-256 candidate content identity. Optional but, if
  // present, must be a 64-hex SHA-256. The 8-hex contentTextHash stays as a
  // deterministic legacy preview hash (never identity).
  if (
    entry.candidateContentSha256 !== undefined
    && entry.candidateContentSha256 !== null
    && (
      typeof entry.candidateContentSha256 !== 'string'
      || !/^[a-f0-9]{64}$/u.test(entry.candidateContentSha256)
    )
  ) {
    return buildError(
      'DOCX_SAFE_CREATE_PREVIEW_INVALID',
      'docx_import_safe_create_candidate_invalid',
      { field: 'candidateCreatePlan.entries.0.candidateContentSha256' },
    );
  }
  const content = normalizeText(entry.content);
  if (entry.contentTextHash !== docxStableHash(content)) {
    return buildError(
      'DOCX_SAFE_CREATE_PREVIEW_TAMPERED',
      'docx_import_safe_create_content_hash_mismatch',
      { field: 'candidateCreatePlan.entries.0.contentTextHash' },
    );
  }

  if (!isPlainObject(entry.source)) {
    return buildError(
      'DOCX_SAFE_CREATE_PREVIEW_INVALID',
      'docx_import_safe_create_candidate_invalid',
      { field: 'candidateCreatePlan.entries.0.source' },
    );
  }
  const extraSourceKeys = unsupportedKeys(entry.source, DOCX_IMPORT_SAFE_CREATE_ALLOWED_ENTRY_SOURCE_KEYS);
  if (extraSourceKeys.length > 0) {
    return buildError(
      'DOCX_SAFE_CREATE_PREVIEW_INVALID',
      'docx_import_safe_create_candidate_unsupported_fields',
      { field: 'candidateCreatePlan.entries.0.source', fields: extraSourceKeys },
    );
  }
  if (
    entry.source.schemaVersion !== plan.source.schemaVersion
    || entry.source.type !== plan.source.type
    || entry.source.sourcePart !== plan.source.sourcePart
    || entry.source.paragraphCount !== plan.source.paragraphCount
    || entry.source.textHash !== plan.source.textHash
  ) {
    return buildError(
      'DOCX_SAFE_CREATE_PREVIEW_TAMPERED',
      'docx_import_safe_create_source_mismatch',
      { field: 'candidateCreatePlan.entries.0.source' },
    );
  }
  if (
    !isPlainObject(entry.source.paragraphRange)
    || !Number.isInteger(entry.source.paragraphRange.start)
    || !Number.isInteger(entry.source.paragraphRange.end)
  ) {
    return buildError(
      'DOCX_SAFE_CREATE_PREVIEW_INVALID',
      'docx_import_safe_create_candidate_invalid',
      { field: 'candidateCreatePlan.entries.0.source.paragraphRange' },
    );
  }
  // GENERIC-01 (G1): sceneId derivation. When sourceArtifactSha256 is present
  // (the GENERIC-01 identity thread), sceneId MUST derive from it so distinct
  // raw artifacts yield distinct sceneIds. Otherwise (legacy plans without the
  // identity thread), fall back to the 32-bit content-hash derivation.
  const expectedSceneId = typeof plan.source.sourceArtifactSha256 === 'string'
    && /^[a-f0-9]{64}$/u.test(plan.source.sourceArtifactSha256)
    ? `docx-import-scene-${plan.source.sourceArtifactSha256.slice(0, 8)}`
    : `docx-import-scene-${docxStableHash(
      `${entry.source.textHash}:${entry.contentTextHash}:${entry.source.paragraphCount}`,
    )}`;
  if (entry.sceneId !== expectedSceneId) {
    return buildError(
      'DOCX_SAFE_CREATE_PREVIEW_TAMPERED',
      'docx_import_safe_create_scene_id_mismatch',
      { field: 'candidateCreatePlan.entries.0.sceneId' },
    );
  }

  if (
    !isPlainObject(plan.lossReport)
    || plan.lossReport.schemaVersion !== DOCX_IMPORT_PREVIEW_LOSS_REPORT_SCHEMA
    || !['plain-text-only', 'inline-marks', 'headings-and-inline-marks', 'lists-headings-and-inline-marks', 'block-styles-headings-lists-and-inline-marks'].includes(plan.lossReport.mode)
    || !Array.isArray(plan.lossReport.items)
    || plan.lossReport.itemCount !== plan.lossReport.items.length
  ) {
    return buildError(
      'DOCX_SAFE_CREATE_PREVIEW_INVALID',
      'docx_import_safe_create_loss_report_invalid',
      { field: 'lossReport' },
    );
  }

  return {
    ok: true,
    value: {
      entry: {
        sceneId: entry.sceneId,
        kind: entry.kind,
        title: typeof entry.title === 'string' && entry.title.trim()
          ? entry.title.trim()
          : 'Imported DOCX preview',
        content,
        contentTextHash: entry.contentTextHash,
        candidateContentSha256: typeof entry.candidateContentSha256 === 'string'
          && /^[a-f0-9]{64}$/u.test(entry.candidateContentSha256)
          ? entry.candidateContentSha256
          : (typeof plan.source.candidateContentSha256 === 'string'
            && /^[a-f0-9]{64}$/u.test(plan.source.candidateContentSha256)
            ? plan.source.candidateContentSha256
            : null),
      },
      sourceArtifactSha256: typeof plan.source.sourceArtifactSha256 === 'string'
        && /^[a-f0-9]{64}$/u.test(plan.source.sourceArtifactSha256)
        ? plan.source.sourceArtifactSha256
        : null,
      carrierIgnored: isPlainObject(plan.carrierIgnored) && plan.carrierIgnored.ignored === true
        ? {
          ignored: true,
          reason: typeof plan.carrierIgnored.reason === 'string' ? plan.carrierIgnored.reason : '',
          tokenDetected: plan.carrierIgnored.tokenDetected === true,
        }
        : null,
      lossReport: cloneJsonSafe(plan.lossReport),
      previewHash: plan.previewHash,
    },
  };
}

function sanitizeFilename(name) {
  const safe = String(name || '')
    .trim()
    .replace(/[\\/<>:"|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/g, '');

  return safe.slice(0, 80) || 'Untitled';
}

// GENERIC-01 (G5): scene path derives from import instance identity, not a
// content hash suffix. The identity component is derived from the main-owned
// importOperationId so two distinct import operations never collide on disk.
function buildDocxImportScenePath(romanRoot, entry, identityComponent) {
  const suffix = identityComponent
    || (typeof entry.importOperationId === 'string' && entry.importOperationId.length > 0
      ? entry.importOperationId.replace(/^docx-import-op-/u, '').slice(0, 8)
      : '')
    || entry.sceneId.replace(/^docx-import-scene-/u, '');
  return joinPathSegmentsWithinRoot(
    romanRoot,
    ['Imported', `${sanitizeFilename(entry.title)} ${suffix}.txt`],
    { resolveSymlinks: false },
  );
}

function validateTrustedRoots(projectRoot, romanRoot) {
  if (typeof projectRoot !== 'string' || !projectRoot.trim()) {
    return buildError(
      'DOCX_SAFE_CREATE_PROJECT_ROOT_REQUIRED',
      'docx_import_safe_create_project_root_required',
    );
  }
  if (typeof romanRoot !== 'string' || !romanRoot.trim()) {
    return buildError(
      'DOCX_SAFE_CREATE_ROMAN_ROOT_REQUIRED',
      'docx_import_safe_create_roman_root_required',
    );
  }
  if (!isPathInsideBoundary(projectRoot, romanRoot, { resolveSymlinks: true })) {
    return buildError(
      'DOCX_SAFE_CREATE_ROOT_INVALID',
      'docx_import_safe_create_roman_root_invalid',
    );
  }
  return { ok: true };
}

// GENERIC-01 (G2/G4): durable idempotent receipt store. The store lives under
// <projectRoot>/.yalken/docx-import/receipts/<importOperationId>.json. It is a
// bounded companion in the Core transaction; it cannot prove its own commit.
function buildReceiptStoreDir(projectRoot) {
  return path.join(projectRoot, DOCX_IMPORT_RECEIPT_STORE_DIRNAME);
}

function buildReceiptStorePath(projectRoot, importOperationId) {
  return path.join(buildReceiptStoreDir(projectRoot), `${importOperationId}.json`);
}

async function readDurableReceipt(projectRoot, importOperationId) {
  const result = await readDurableReceiptRecord(projectRoot, importOperationId);
  return result.status === 'ok' ? result.receipt : null;
}

async function readDurableReceiptRecord(projectRoot, importOperationId) {
  if (!/^docx-import-op-[a-f0-9]{12}$/.test(importOperationId || '')) return { status: 'unreadable', receipt: null };
  const receiptPath = buildReceiptStorePath(projectRoot, importOperationId);
  let text = '';
  try {
    if (!isPathInsideBoundary(projectRoot, receiptPath, { resolveSymlinks: true })) throw Error('DOCX_SAFE_CREATE_RECEIPT_PATH');
    const stat = await fs.lstat(receiptPath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 4 * 1024 * 1024) throw Error('DOCX_SAFE_CREATE_RECEIPT_INVALID');
    text = await fs.readFile(receiptPath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') return { status: 'missing', receipt: null };
    return { status: 'unreadable', receipt: null };
  }
  try {
    return { status: 'ok', receipt: JSON.parse(text) };
  } catch {
    return { status: 'malformed', receipt: null };
  }
}



function normalizeDocxImportOperationNonce(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return DOCX_IMPORT_SAFE_CREATE_DEFAULT_OPERATION_NONCE;
  if (raw.length <= DOCX_IMPORT_SAFE_CREATE_MAX_OPERATION_NONCE_CHARS) return raw;
  return `sha256:${crypto.createHash('sha256').update(raw, 'utf8').digest('hex')}`;
}

// GENERIC-01 (B): main-owned importOperationId. Canonical form derives from the
// operation-scoped identity (projectId + sourceArtifactSha256 +
// candidateContentSha256 + previewHash + optional request nonce), NOT from a
// single content hash. Two distinct raw artifacts or user-confirmed import
// requests therefore yield distinct operation ids.
function buildImportOperationId(options) {
  const operationNonce = normalizeDocxImportOperationNonce(options.operationNonce);
  const operationCanonical = {
    projectId: typeof options.projectId === 'string' ? options.projectId : '',
    sourceArtifactSha256: typeof options.sourceArtifactSha256 === 'string'
      ? options.sourceArtifactSha256 : '',
    candidateContentSha256: typeof options.candidateContentSha256 === 'string'
      ? options.candidateContentSha256 : '',
    previewHash: typeof options.previewHash === 'string' ? options.previewHash : '',
    sceneId: typeof options.sceneId === 'string' ? options.sceneId : '',
  };
  if (operationNonce !== DOCX_IMPORT_SAFE_CREATE_DEFAULT_OPERATION_NONCE) {
    operationCanonical.operationNonce = operationNonce;
  }
  const operationHash = crypto.createHash('sha256')
    .update(stableStringify(operationCanonical), 'utf8').digest('hex');
  return `docx-import-op-${operationHash.slice(0, 12)}`;
}

function buildDocxImportSceneTreeIdentities(importOperationId, sceneId, publicSceneLocator = null) {
  const publicTreeNodeId = isPlainObject(publicSceneLocator)
    && typeof publicSceneLocator.nodeId === 'string'
    && /^tree-node-[a-f0-9]{32}$/u.test(publicSceneLocator.nodeId)
    ? publicSceneLocator.nodeId
    : '';
  const treeNodeId = publicTreeNodeId || `yalken.scene.tree.${crypto.createHash('sha256')
    .update(`${importOperationId}:${sceneId}`, 'utf8').digest('hex').slice(0, 16)}`;
  const treeId = `yalken.scene.tree.root.${crypto.createHash('sha256')
    .update(`root:${importOperationId}`, 'utf8').digest('hex').slice(0, 16)}`;
  return { treeNodeId, treeId };
}

function normalizeProjectTreeBindingKey(value) {
  const bindingKey = typeof value === 'string' ? value.trim().replace(/\\/gu, '/') : '';
  if (!bindingKey || bindingKey.length > 1024 || /[\u0000-\u001F]/u.test(bindingKey)) {
    return '';
  }
  if (!bindingKey.startsWith('file:')) return '';
  const relativePath = bindingKey.slice('file:'.length);
  const segments = relativePath.split('/');
  if (
    !relativePath
    || relativePath.startsWith('/')
    || segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    return '';
  }
  return bindingKey;
}

function buildDeterministicProjectTreeNodeId(projectId, bindingKey) {
  const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
  const normalizedBindingKey = normalizeProjectTreeBindingKey(bindingKey);
  if (!normalizedProjectId || !normalizedBindingKey) return '';
  const digest = crypto.createHash('sha256')
    .update(`${normalizedProjectId}\u0000${normalizedBindingKey}`, 'utf8')
    .digest('hex');
  return `tree-node-${digest.slice(0, 32)}`;
}

function buildDocxImportSceneTreeIdentityDescriptor({ projectRoot, targetPath, projectId }) {
  const relativePath = path.relative(projectRoot, targetPath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) return null;
  const relativeFile = relativePath.split(path.sep).join('/');
  if (!relativeFile.startsWith('roman/Imported/') || !relativeFile.toLowerCase().endsWith('.txt')) {
    return null;
  }
  const bindingKey = normalizeProjectTreeBindingKey(`file:${relativeFile}`);
  const nodeId = buildDeterministicProjectTreeNodeId(projectId, bindingKey);
  if (!bindingKey || !nodeId) return null;
  return {
    bindingKey,
    kind: 'scene',
    nodeId,
    present: true,
    relativeFile,
  };
}

function buildDocxImportPublicSceneLocator({ projectRoot, targetPath, projectId, sceneId }) {
  const normalizedSceneId = typeof sceneId === 'string' ? sceneId.trim() : '';
  if (!/^docx-import-scene-[a-f0-9]{8}$/u.test(normalizedSceneId)) return null;
  const descriptor = buildDocxImportSceneTreeIdentityDescriptor({ projectRoot, targetPath, projectId });
  if (!descriptor) return null;
  return {
    sceneId: normalizedSceneId,
    nodeId: descriptor.nodeId,
    label: path.posix.basename(descriptor.relativeFile, '.txt'),
    kind: descriptor.kind,
  };
}

function buildVerifiedDocxImportScene(entry, importOperationId, content, publicSceneLocator = null) {
  const actualContent = normalizeText(content);
  const { treeNodeId, treeId } = buildDocxImportSceneTreeIdentities(
    importOperationId,
    entry.sceneId,
    publicSceneLocator,
  );
  return {
    sceneId: entry.sceneId,
    kind: 'scene',
    title: entry.title,
    // These fields are canonical-text evidence after Yalken newline normalization,
    // not raw filesystem byte identity.
    bytesWritten: Buffer.byteLength(actualContent, 'utf8'),
    outputHash: sha256Text(actualContent),
    treeNodeId,
    treeId,
    ...(isPlainObject(publicSceneLocator) ? { publicSceneLocator: cloneJsonSafe(publicSceneLocator) } : {}),
  };
}

function buildDocxImportSceneTreeIdentityList(verifiedScene) {
  return [
    {
      sceneId: verifiedScene.sceneId,
      treeNodeId: verifiedScene.treeNodeId,
      treeId: verifiedScene.treeId,
    },
  ];
}

function jsonStableEqual(left, right) {
  return stableStringify(left) === stableStringify(right);
}

function buildIdempotentReceiptIntegrityError(field, sceneId, failReason, expected = '') {
  return buildError(
    DOCX_IMPORT_SAFE_CREATE_IDEMPOTENT_INTEGRITY_CODE,
    DOCX_IMPORT_SAFE_CREATE_IDEMPOTENT_INTEGRITY_REASON,
    {
      field,
      sceneId,
      failReason,
      ...(typeof expected === 'string' && /^[a-f0-9]{8,64}$/u.test(expected)
        ? { expected }
        : {}),
    },
  );
}

function buildDocxImportTransactionEvidence(manifestEvidence, batchId) {
  return {
    lease: { fencingGeneration: manifestEvidence.fencingGeneration },
    manifestHash: manifestEvidence.nextHash,
    batchManifestHash: sha256Text(batchId),
  };
}

function normalizeDocxImportManifestTreeNodeId(value) {
  const nodeId = typeof value === 'string' ? value.trim() : '';
  return /^tree-node-[a-f0-9]{32}$/u.test(nodeId) ? nodeId : '';
}

function buildDocxImportManifestTextWithSceneTreeIdentity({
  manifestText,
  projectId,
  sceneTreeIdentityDescriptor,
}) {
  if (typeof manifestText !== 'string' || !manifestText.trim()) return '';
  if (!isPlainObject(sceneTreeIdentityDescriptor)) return '';
  const nodeId = normalizeDocxImportManifestTreeNodeId(sceneTreeIdentityDescriptor.nodeId);
  const bindingKey = normalizeProjectTreeBindingKey(sceneTreeIdentityDescriptor.bindingKey);
  const kind = typeof sceneTreeIdentityDescriptor.kind === 'string'
    ? sceneTreeIdentityDescriptor.kind.trim()
    : '';
  if (!nodeId || !bindingKey || !/^[A-Za-z0-9._:-]{1,96}$/u.test(kind)) return '';
  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch {
    return '';
  }
  if (!isPlainObject(manifest) || typeof manifest.projectId !== 'string' || manifest.projectId.trim() !== projectId) {
    return '';
  }
  const sourceTreeIdentity = isPlainObject(manifest.treeIdentity) ? manifest.treeIdentity : {};
  const sourceNodes = isPlainObject(sourceTreeIdentity.nodes) ? sourceTreeIdentity.nodes : {};
  for (const [existingNodeId, existingNode] of Object.entries(sourceNodes)) {
    if (
      existingNodeId !== nodeId
      && isPlainObject(existingNode)
      && existingNode.present !== false
      && existingNode.bindingKey === bindingKey
    ) {
      return '';
    }
  }
  const nextNodes = {
    ...sourceNodes,
    [nodeId]: {
      ...(isPlainObject(sourceNodes[nodeId]) ? sourceNodes[nodeId] : {}),
      bindingKey,
      kind,
      present: true,
    },
  };
  const nextTreeIdentity = {
    ...sourceTreeIdentity,
    schemaVersion: 1,
    nodes: Object.fromEntries(Object.entries(nextNodes).sort(([left], [right]) => left.localeCompare(right))),
  };
  const currentLastCommandId = Number(manifest.lastCommandId);
  const nextLastCommandId = Number.isSafeInteger(currentLastCommandId) && currentLastCommandId >= 0
    ? currentLastCommandId + 1
    : 1;
  const nextManifest = {
    ...manifest,
    treeIdentity: nextTreeIdentity,
    lastCommandId: nextLastCommandId,
  };
  return `${JSON.stringify(nextManifest, null, 2)}\n`;
}

function validateDocxImportManifestAuthority(manifestAuthority, importOperationId) {
  if (!isPlainObject(manifestAuthority)) {
    return {
      ok: false,
      field: 'manifestAuthority',
      failReason: 'manifest_authority_shape_mismatch',
    };
  }

  if (manifestAuthority.algorithmic === true) return { ok: false, field: 'manifestAuthority', failReason: 'durable_authority_required' };

  const allowedKeys = new Set([
    'revision',
    'fencingGeneration',
    'nextHash',
    'previousHash',
    'durablePublication',
  ]);
  if (unsupportedKeys(manifestAuthority, allowedKeys).length > 0) {
    return {
      ok: false,
      field: 'manifestAuthority',
      failReason: 'manifest_authority_unsupported_fields',
    };
  }
  if (typeof manifestAuthority.revision !== 'string' || !manifestAuthority.revision.trim()) {
    return {
      ok: false,
      field: 'manifestAuthority.revision',
      failReason: 'manifest_authority_revision_invalid',
    };
  }
  if (
    !Number.isSafeInteger(manifestAuthority.fencingGeneration)
    || manifestAuthority.fencingGeneration <= 0
  ) {
    return {
      ok: false,
      field: 'manifestAuthority.fencingGeneration',
      failReason: 'manifest_authority_fencing_generation_invalid',
    };
  }
  if (manifestAuthority.revision !== String(manifestAuthority.fencingGeneration)) {
    return {
      ok: false,
      field: 'manifestAuthority.revision',
      failReason: 'manifest_authority_revision_mismatch',
    };
  }
  if (!isSha256Hex(manifestAuthority.nextHash)) {
    return {
      ok: false,
      field: 'manifestAuthority.nextHash',
      failReason: 'manifest_authority_next_hash_invalid',
    };
  }
  if (
    typeof manifestAuthority.previousHash !== 'string'
    || (manifestAuthority.previousHash.length > 0 && !isSha256Hex(manifestAuthority.previousHash))
  ) {
    return {
      ok: false,
      field: 'manifestAuthority.previousHash',
      failReason: 'manifest_authority_previous_hash_invalid',
    };
  }
  if (manifestAuthority.durablePublication !== true) {
    return {
      ok: false,
      field: 'manifestAuthority.durablePublication',
      failReason: 'manifest_authority_publication_invalid',
    };
  }
  return { ok: true };
}

async function validateExistingDocxImportReceipt(options) {
  const {
    receipt,
    plan,
    validated,
    projectRoot,
    romanRoot,
    targetPath,
    importOperationId,
    operationNonce,
    projectId,
    transactionAuthority,
    manifestPath,
  } = options;
  const entry = validated.value.entry;
  const fail = (field, failReason, expected = '') => buildIdempotentReceiptIntegrityError(
    field,
    entry.sceneId,
    failReason,
    expected,
  );

  if (!isPlainObject(receipt)) return fail('receipt', 'receipt_not_object');
  if (receipt.schemaVersion === DOCX_IMPORT_RECEIPT_V2_SCHEMA) {
    return buildError('DOCX_SAFE_CREATE_LEGACY_RECOVERY_REQUIRED', 'docx_import_legacy_receipt_requires_recovery');
  }
  if (receipt.schemaVersion !== DOCX_IMPORT_RECEIPT_V3_SCHEMA) {
    return fail('schemaVersion', 'schema_version_mismatch');
  }
  if (receipt.type !== DOCX_IMPORT_SAFE_CREATE_RECEIPT_TYPE) {
    return fail('type', 'receipt_type_mismatch');
  }
  if (receipt.reason !== DOCX_IMPORT_SAFE_CREATE_READY_REASON) {
    return fail('reason', 'receipt_reason_mismatch');
  }
  if (receipt.importOperationId !== importOperationId) {
    return fail('importOperationId', 'operation_id_mismatch');
  }
  if (
    operationNonce !== DOCX_IMPORT_SAFE_CREATE_DEFAULT_OPERATION_NONCE
    && receipt.importOperationNonce !== operationNonce
  ) {
    return fail('importOperationNonce', 'operation_nonce_mismatch');
  }
  if (
    operationNonce === DOCX_IMPORT_SAFE_CREATE_DEFAULT_OPERATION_NONCE
    && receipt.importOperationNonce !== undefined
    && receipt.importOperationNonce !== operationNonce
  ) {
    return fail('importOperationNonce', 'operation_nonce_mismatch');
  }
  if (receipt.projectId !== projectId) return fail('projectId', 'project_id_mismatch');
  if (receipt.sourceArtifactSha256 !== validated.value.sourceArtifactSha256) {
    return fail('sourceArtifactSha256', 'source_artifact_hash_mismatch');
  }
  if (receipt.candidateContentSha256 !== entry.candidateContentSha256) {
    return fail('candidateContentSha256', 'candidate_content_hash_mismatch');
  }
  if (receipt.sourcePreviewHash !== validated.value.previewHash) {
    return fail('sourcePreviewHash', 'source_preview_hash_mismatch');
  }
  if (receipt.sceneIntegrityScope !== DOCX_IMPORT_SAFE_CREATE_SCENE_INTEGRITY_SCOPE) {
    return fail('sceneIntegrityScope', 'scene_integrity_scope_mismatch');
  }
  if (receipt.createdAtAuthority !== DOCX_IMPORT_SAFE_CREATE_CREATED_AT_AUTHORITY) {
    return fail('createdAtAuthority', 'created_at_authority_mismatch');
  }
  if (!isIsoCreatedAt(receipt.createdAt)) {
    return fail('createdAt', 'created_at_invalid');
  }

  const inputHash = sha256Text(stableStringify(plan));
  if (receipt.inputHash !== inputHash) return fail('inputHash', 'input_hash_mismatch', inputHash);
  if (typeof receipt.batchId !== 'string' || receipt.batchId.length === 0) {
    return fail('batchId', 'batch_id_invalid');
  }
  if (!isPlainObject(receipt.transactionEvidence)) {
    return fail('transactionEvidence', 'transaction_evidence_shape_mismatch');
  }
  const transactionEvidenceKeys = unsupportedKeys(
    receipt.transactionEvidence,
    new Set(['lease', 'manifestHash', 'batchManifestHash']),
  );
  if (transactionEvidenceKeys.length > 0) {
    return fail('transactionEvidence', 'transaction_evidence_unsupported_fields');
  }
  const expectedBatchManifestHash = sha256Text(receipt.batchId);
  if (receipt.transactionEvidence.batchManifestHash !== expectedBatchManifestHash) {
    return fail(
      'transactionEvidence.batchManifestHash',
      'batch_manifest_hash_mismatch',
      expectedBatchManifestHash,
    );
  }
  if (receipt.batchId !== `project-create-${importOperationId}`) {
    return fail('batchId', 'batch_id_invalid');
  }
  const manifestAuthorityValidation = validateDocxImportManifestAuthority(
    receipt.manifestAuthority,
    importOperationId,
  );
  if (!manifestAuthorityValidation.ok) {
    return fail(
      manifestAuthorityValidation.field,
      manifestAuthorityValidation.failReason,
      manifestAuthorityValidation.expected || '',
    );
  }
  const expectedTransactionEvidence = buildDocxImportTransactionEvidence(
    receipt.manifestAuthority,
    receipt.batchId,
  );
  if (!jsonStableEqual(receipt.transactionEvidence.lease, expectedTransactionEvidence.lease)) {
    return fail('transactionEvidence.lease', 'transaction_lease_mismatch');
  }
  if (receipt.transactionEvidence.manifestHash !== expectedTransactionEvidence.manifestHash) {
    return fail(
      'transactionEvidence.manifestHash',
      'transaction_manifest_hash_mismatch',
      expectedTransactionEvidence.manifestHash,
    );
  }
  if (receipt.transactionEvidence.batchManifestHash !== expectedTransactionEvidence.batchManifestHash) {
    return fail(
      'transactionEvidence.batchManifestHash',
      'transaction_batch_manifest_hash_mismatch',
      expectedTransactionEvidence.batchManifestHash,
    );
  }
  if (!jsonStableEqual(receipt.createdSceneIds, [entry.sceneId])) {
    return fail('createdSceneIds', 'created_scene_ids_mismatch');
  }
  if (!Array.isArray(receipt.createdScenes) || receipt.createdScenes.length !== 1) {
    return fail('createdScenes', 'created_scenes_shape_mismatch');
  }

  if (
    !isPathInsideBoundary(romanRoot, targetPath, { resolveSymlinks: false })
    || !isPathInsideBoundary(projectRoot, targetPath, { resolveSymlinks: true })
  ) {
    return fail('createdScenes.0.boundary', 'scene_path_boundary_mismatch');
  }

  let actualContent = '';
  try {
    actualContent = normalizeText(await fs.readFile(targetPath, 'utf8'));
  } catch {
    return fail('createdScenes.0.outputHash', 'scene_missing_or_unreadable');
  }

  const expectedContent = normalizeText(entry.content);
  const expectedPublicSceneLocator = buildDocxImportPublicSceneLocator({
    projectRoot,
    targetPath,
    projectId,
    sceneId: entry.sceneId,
  });
  const expectedVerifiedSceneWithoutLocator = buildVerifiedDocxImportScene(
    entry,
    importOperationId,
    expectedContent,
  );
  const expectedVerifiedScene = buildVerifiedDocxImportScene(
    entry,
    importOperationId,
    expectedContent,
    expectedPublicSceneLocator,
  );
  if (actualContent !== expectedContent) {
    return fail(
      'createdScenes.0.outputHash',
      'scene_content_mismatch',
      expectedVerifiedScene.outputHash,
    );
  }
  const createdSceneMatches = jsonStableEqual(receipt.createdScenes[0], expectedVerifiedScene)
    || jsonStableEqual(receipt.createdScenes[0], expectedVerifiedSceneWithoutLocator);
  if (!createdSceneMatches) {
    return fail(
      'createdScenes.0',
      'created_scene_receipt_mismatch',
      expectedVerifiedScene.outputHash,
    );
  }

  const expectedSceneTreeIdentities = buildDocxImportSceneTreeIdentityList(expectedVerifiedScene);
  if (!jsonStableEqual(receipt.sceneTreeIdentities, expectedSceneTreeIdentities)) {
    return fail('sceneTreeIdentities', 'scene_tree_identity_mismatch');
  }

  const outputHash = sha256Text(stableStringify({ createdScenes: [expectedVerifiedScene] }));
  const legacyOutputHash = sha256Text(stableStringify({ createdScenes: [expectedVerifiedSceneWithoutLocator] }));
  if (receipt.outputHash !== outputHash && receipt.outputHash !== legacyOutputHash) {
    return fail('outputHash', 'output_hash_mismatch', outputHash);
  }
  if (receipt.publicSceneLocators !== undefined) {
    const expectedPublicSceneLocators = expectedPublicSceneLocator ? [expectedPublicSceneLocator] : [];
    if (!jsonStableEqual(receipt.publicSceneLocators, expectedPublicSceneLocators)) {
      return fail('publicSceneLocators', 'public_scene_locators_mismatch');
    }
  }
  if (receipt.publicSceneLocator !== undefined && !jsonStableEqual(receipt.publicSceneLocator, expectedPublicSceneLocator)) {
    return fail('publicSceneLocator', 'public_scene_locator_mismatch');
  }

  const expectedLossReportSummary = {
    schemaVersion: validated.value.lossReport.schemaVersion,
    mode: validated.value.lossReport.mode,
    itemCount: validated.value.lossReport.itemCount,
  };
  if (!jsonStableEqual(receipt.lossReport, validated.value.lossReport)) {
    return fail('lossReport', 'loss_report_mismatch');
  }
  if (!jsonStableEqual(receipt.lossReportSummary, expectedLossReportSummary)) {
    return fail('lossReportSummary', 'loss_report_summary_mismatch');
  }
  if (!jsonStableEqual(receipt.carrierIgnored, validated.value.carrierIgnored)) {
    return fail('carrierIgnored', 'carrier_ignored_mismatch');
  }
  if (!jsonStableEqual(receipt.atomicEvidence, { sceneCount: 1, markerCleared: true })) {
    return fail('atomicEvidence', 'atomic_evidence_mismatch');
  }

  try {
    const commit = await readVerifiedProjectTransaction({ scenePath: targetPath, manifestPath,
      verifyManifestContinuation: args => transactionAuthority.verifyManifestContinuation({ ...args, projectId }) });
    const receiptPath = buildReceiptStorePath(projectRoot, importOperationId);
    const stored = await fs.readFile(receiptPath);
    if (commit.schemaVersion !== 'yalken.project-transaction.commit.v2'
      || commit.revision !== receipt.manifestAuthority.fencingGeneration
      || commit.manifestDigest !== receipt.manifestAuthority.nextHash
      || !commit.resources.some(resource => resource.path === receiptPath && resource.digest === hashExactBytes(stored))) {
      return fail('transactionEvidence', 'committed_receipt_binding_mismatch');
    }
  } catch { return fail('transactionEvidence', 'committed_transaction_readback_failed'); }

  return {
    ok: true,
    receipt,
    publicSceneLocator: expectedPublicSceneLocator,
    publicSceneLocators: expectedPublicSceneLocator ? [expectedPublicSceneLocator] : [],
  };
}

// Derive every asset path from validated canonical bytes. Existing content-
// addressed assets are reused only after exact readback; no incoming path is
// trusted and no image becomes an independent filesystem writer.
async function prepareDocxMediaEntries(content, projectRoot) {
  const { parseObservablePayload } = await import('../renderer/documentContentEnvelope.mjs');
  const parsed = parseObservablePayload(content);
  if (parsed.issue) throw Error('DOCX_MEDIA_DOCUMENT_INVALID');
  const graph = documentMedia(parsed.doc), entries = [];
  for (const asset of graph.assets) {
    const target = path.join(projectRoot, asset.attrs.assetPath);
    if (!isPathInsideBoundary(projectRoot, target, { resolveSymlinks: true })) throw Error('DOCX_MEDIA_PATH');
    let current = projectRoot;
    for (const part of asset.attrs.assetPath.split('/')) {
      current = path.join(current, part);
      try {
        const stat = await fs.lstat(current);
        if (stat.isSymbolicLink() || (current !== target && !stat.isDirectory())) throw Error('DOCX_MEDIA_PATH');
        if (current === target && (!stat.isFile() || stat.size > MEDIA_LIMITS.bytes)) throw Error('DOCX_MEDIA_FILE');
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    try {
      const actual = await fs.readFile(target);
      if (!actual.equals(asset.bytes)) throw Error('DOCX_MEDIA_EXISTING_BYTES');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      entries.push({ path: target, content: asset.bytes });
    }
  }
  return entries;
}

async function verifyDocxMediaAssetFiles(content, projectRoot) {
  const missing = await prepareDocxMediaEntries(content, projectRoot);
  if (missing.length) throw Error('DOCX_MEDIA_FILES_MISSING');
}

async function applyDocxImportSafeCreateInLease(input = {}, options = {}) {
  const projectRoot = typeof options.projectRoot === 'string' ? options.projectRoot.trim() : '';
  const romanRoot = typeof options.romanRoot === 'string' ? options.romanRoot.trim() : '';

  const plan = isPlainObject(input.docxImportPreviewPlan) ? input.docxImportPreviewPlan : null;
  const validated = validateDocxImportPreviewPlan(plan);
  if (!validated.ok) return validated;
  if (!isDocxImportPreviewPlanAdmitted(plan)) {
    return buildError(
      'DOCX_SAFE_CREATE_PREVIEW_NOT_ADMITTED',
      'docx_import_safe_create_preview_not_admitted',
    );
  }
  const roots = validateTrustedRoots(projectRoot, romanRoot);
  if (!roots.ok) return roots;

  const projectId = typeof options.projectId === 'string' ? options.projectId : '';
  const operationNonce = normalizeDocxImportOperationNonce(options.importRequestNonce);
  const importOperationId = buildImportOperationId({
    projectId,
    sourceArtifactSha256: validated.value.sourceArtifactSha256,
    candidateContentSha256: validated.value.entry.candidateContentSha256,
    previewHash: validated.value.previewHash,
    sceneId: validated.value.entry.sceneId,
    operationNonce,
  });

  const targetPath = buildDocxImportScenePath(
    romanRoot,
    validated.value.entry,
    importOperationId.replace(/^docx-import-op-/u, '').slice(0, 8),
  );
  if (
    !isPathInsideBoundary(romanRoot, targetPath, { resolveSymlinks: false })
    || !isPathInsideBoundary(projectRoot, targetPath, { resolveSymlinks: true })
  ) {
    return buildError(
      'DOCX_SAFE_CREATE_SCENE_PATH_FORBIDDEN',
      'docx_import_safe_create_scene_path_forbidden',
    );
  }
  let mediaEntries;
  try { mediaEntries = await prepareDocxMediaEntries(validated.value.entry.content, projectRoot); }
  catch (error) { return buildError('DOCX_SAFE_CREATE_MEDIA_INVALID', 'docx_import_media_invalid', { code: error.message }); }
  const transactionAuthority = typeof options.transactionAuthority === 'object'
    && options.transactionAuthority !== null
    ? options.transactionAuthority
    : null;

  // GENERIC-01 (G2/G4): idempotent lookup. If a durable receipt already exists
  // for this importOperationId, accept it only after re-reading the created
  // scene and revalidating the receipt bindings. A stale or corrupted receipt
  // fails closed without performing any new storage writes.
  const existingReceiptRecord = await readDurableReceiptRecord(projectRoot, importOperationId);
  if (existingReceiptRecord && existingReceiptRecord.status === 'ok') {
    if (mediaEntries.length) return buildError('DOCX_SAFE_CREATE_MEDIA_MISSING', 'docx_import_replay_media_missing');
    const receiptValidation = await validateExistingDocxImportReceipt({
      receipt: existingReceiptRecord.receipt,
      plan,
      validated,
      projectRoot,
      romanRoot,
      targetPath,
      importOperationId,
      operationNonce,
      projectId,
      transactionAuthority,
      manifestPath: options.manifestPath,
    });
    if (!receiptValidation.ok) return receiptValidation;
    return {
      ok: true,
      value: {
        created: false,
        safeCreate: true,
        idempotent: true,
        createdSceneIds: receiptValidation.receipt.createdSceneIds || [],
        publicSceneLocators: receiptValidation.publicSceneLocators || [],
        publicSceneLocator: receiptValidation.publicSceneLocator || null,
        receipt: receiptValidation.receipt,
        receiptStore: { dir: buildReceiptStoreDir(projectRoot) },
        lookupReceipt: async (opId) => readDurableReceipt(projectRoot, opId || importOperationId),
        importOperationId,
      },
    };
  }
  if (existingReceiptRecord && existingReceiptRecord.status !== 'missing') {
    return buildIdempotentReceiptIntegrityError(
      'receipt',
      validated.value.entry.sceneId,
      existingReceiptRecord.status === 'malformed'
        ? 'receipt_json_malformed'
        : 'receipt_read_failed',
    );
  }

  if (await pathExists(targetPath)) {
    return buildError(
      'DOCX_SAFE_CREATE_EXISTING_SCENE_BLOCKED',
      'docx_import_safe_create_existing_scene_blocked',
      { sceneId: validated.value.entry.sceneId },
    );
  }

  const normalizedEntry = {
    sceneId: validated.value.entry.sceneId,
    path: targetPath,
    kind: 'scene',
    title: validated.value.entry.title,
    content: validated.value.entry.content,
    importOperationId,
  };
  const sceneTreeIdentityDescriptor = buildDocxImportSceneTreeIdentityDescriptor({
    projectRoot,
    targetPath: normalizedEntry.path,
    projectId,
  });
  const publicSceneLocator = buildDocxImportPublicSceneLocator({
    projectRoot,
    targetPath: normalizedEntry.path,
    projectId,
    sceneId: normalizedEntry.sceneId,
  });

  const manifestContent = buildDocxImportManifestTextWithSceneTreeIdentity({
    manifestText: options.manifestRaw, projectId, sceneTreeIdentityDescriptor,
  });
  if (!manifestContent) throw Error('DOCX_SAFE_CREATE_MANIFEST_TREE_IDENTITY_INVALID');
  const manifestEvidence = {
    revision: String(options.lease.fencingGeneration), fencingGeneration: options.lease.fencingGeneration,
    nextHash: hashExactBytes(manifestContent), previousHash: hashExactBytes(options.manifestRaw), durablePublication: true,
  };
  const actualContent = normalizeText(normalizedEntry.content);
  const verifiedScene = buildVerifiedDocxImportScene(
    normalizedEntry,
    importOperationId,
    actualContent,
    publicSceneLocator,
  );
  const verifiedSceneWithPublicLocator = buildVerifiedDocxImportScene(
    normalizedEntry,
    importOperationId,
    actualContent,
    publicSceneLocator,
  );
  const sceneTreeIdentities = buildDocxImportSceneTreeIdentityList(verifiedScene);
  const inputHash = sha256Text(stableStringify(plan));
  const outputHash = sha256Text(stableStringify({ createdScenes: [verifiedSceneWithPublicLocator] }));

  // GENERIC-01 (G7): typed lossReport persists in the receipt. The summary is
  // kept for backwards compatibility, but the typed items survive the apply
  // boundary so the loss categories are observable downstream.
  const lossReportForReceipt = cloneJsonSafe(validated.value.lossReport);
  const lossReportSummary = {
    schemaVersion: validated.value.lossReport.schemaVersion,
    mode: validated.value.lossReport.mode,
    itemCount: validated.value.lossReport.itemCount,
  };

  const receipt = {
    schemaVersion: DOCX_IMPORT_RECEIPT_V3_SCHEMA,
    type: DOCX_IMPORT_SAFE_CREATE_RECEIPT_TYPE,
    reason: DOCX_IMPORT_SAFE_CREATE_READY_REASON,
    sceneIntegrityScope: DOCX_IMPORT_SAFE_CREATE_SCENE_INTEGRITY_SCOPE,
    importOperationId,
    ...(operationNonce !== DOCX_IMPORT_SAFE_CREATE_DEFAULT_OPERATION_NONCE
      ? { importOperationNonce: operationNonce }
      : {}),
    projectId,
    sourceArtifactSha256: validated.value.sourceArtifactSha256,
    candidateContentSha256: validated.value.entry.candidateContentSha256,
    batchId: `project-create-${importOperationId}`,
    sourcePreviewHash: validated.value.previewHash,
    inputHash,
    outputHash,
    createdSceneIds: [verifiedScene.sceneId],
    createdScenes: [verifiedSceneWithPublicLocator],
    sceneTreeIdentities,
    ...(publicSceneLocator ? {
      publicSceneLocators: [publicSceneLocator],
      publicSceneLocator,
    } : {}),
    lossReport: lossReportForReceipt,
    lossReportSummary,
    manifestAuthority: manifestEvidence,
    carrierIgnored: validated.value.carrierIgnored,
    transactionEvidence: buildDocxImportTransactionEvidence(
      manifestEvidence,
      `project-create-${importOperationId}`,
    ),
    atomicEvidence: {
      sceneCount: 1,
      markerCleared: true,
    },
    createdAtAuthority: DOCX_IMPORT_SAFE_CREATE_CREATED_AT_AUTHORITY,
    createdAt: new Date().toISOString(),
  };

  const receiptPath = buildReceiptStorePath(projectRoot, importOperationId);
  await commitProjectTransaction({ scenePath: targetPath, sceneContent: normalizedEntry.content,
    expectedSceneContent: null, manifestPath: options.manifestPath, manifestContent,
    expectedManifestContent: options.manifestRaw, revision: options.lease.fencingGeneration,
    createResources: [...mediaEntries, { path: receiptPath, content: `${JSON.stringify(receipt, null, 2)}\n` }],
    publishManifest: options.publishManifest, verifyManifestContinuation: options.verifyManifestContinuation,
    fsAdapter: options.fsAdapter });
  // Precomputed receipt fields confer no success until independent durable
  // commit/manifest/scene/resource readback has verified the whole publication.
  const checked = await validateExistingDocxImportReceipt({ receipt, plan, validated,
    projectRoot, romanRoot, targetPath, importOperationId, operationNonce, projectId,
    transactionAuthority, manifestPath: options.manifestPath });
  if (!checked.ok) return checked;
  await verifyDocxMediaAssetFiles(normalizedEntry.content, projectRoot);
  await options.assertPublication();

  return {
    ok: true,
    value: {
      created: true,
      safeCreate: true,
      createdSceneIds: receipt.createdSceneIds,
      publicSceneLocators: publicSceneLocator ? [publicSceneLocator] : [],
      publicSceneLocator,
      receipt,
      receiptStore: { dir: buildReceiptStoreDir(projectRoot) },
      lookupReceipt: async (opId) => readDurableReceipt(projectRoot, opId || importOperationId),
      importOperationId,
    },
  };
}

// The command's entire read/recover/create/replay sequence holds one project
// lease. No absent-authority or algorithmic success path exists in runtime.
async function applyDocxImportSafeCreate(input = {}, options = {}) {
  const validated = validateDocxImportPreviewPlan(input.docxImportPreviewPlan);
  if (!validated.ok) return validated;
  if (!isDocxImportPreviewPlanAdmitted(input.docxImportPreviewPlan)) {
    return buildError('DOCX_SAFE_CREATE_PREVIEW_NOT_ADMITTED', 'docx_import_safe_create_preview_not_admitted');
  }
  const roots = validateTrustedRoots(options.projectRoot, options.romanRoot);
  if (!roots.ok) return roots;
  const authority = options.transactionAuthority;
  if (!authority || typeof authority.withProjectLease !== 'function' || typeof authority.commitManifestText !== 'function'
    || typeof authority.verifyManifestContinuation !== 'function' || !options.projectId
    || !path.isAbsolute(options.manifestPath || '') || path.dirname(options.manifestPath) !== options.projectRoot
    || typeof options.manifestRaw !== 'string') {
    return buildError('DOCX_SAFE_CREATE_AUTHORITY_REQUIRED', 'docx_import_manifest_authority_required');
  }
  const queue = typeof options.queueDiskOperation === 'function' ? options.queueDiskOperation : op => op();
  try {
    return await queue(() => authority.withProjectLease(options.projectId, lease => lease.publish(async proof => {
      const assertPublication = async () => {
        if (typeof options.assertPublication === 'function') await options.assertPublication();
        await proof.assertOwned();
      };
      await assertPublication();
      if (await fs.readFile(options.manifestPath, 'utf8') !== options.manifestRaw) throw Error('DOCX_SAFE_CREATE_MANIFEST_CAS');
      const fsAdapter = new Proxy(fs, { get(target, key) {
        if (typeof target[key] !== 'function') return target[key];
        return async (...args) => {
          if (['open', 'rename', 'link', 'unlink', 'mkdir'].includes(key)) await assertPublication();
          return target[key](...args);
        };
      } });
      const publishManifest = async ({ manifestPath, expectedText, nextText }) => {
        await assertPublication();
        const result = await authority.commitManifestText({ projectId: options.projectId,
          targetPath: manifestPath, expectedText, nextText, lease, label: 'docxImportSafeCreate' });
        if (result?.ok !== true || result.readbackVerified !== true || result.durablePublication !== true
          || result.fencingGeneration !== lease.fencingGeneration || result.nextHash !== hashExactBytes(nextText)
          || result.previousHash !== hashExactBytes(expectedText)) throw Error('DOCX_SAFE_CREATE_MANIFEST_PUBLICATION_UNVERIFIED');
      };
      const verifyManifestContinuation = args => authority.verifyManifestContinuation({ ...args, projectId: options.projectId });
      const legacyBatchRoot = path.join(options.projectRoot, '.flow-batch');
      if (!isPathInsideBoundary(options.projectRoot, legacyBatchRoot, { resolveSymlinks: true })) throw Error('DOCX_SAFE_CREATE_LEGACY_PATH');
      let legacyEntries;
      try { legacyEntries = await fs.readdir(legacyBatchRoot); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (legacyEntries?.some(name => name.endsWith('.json'))) {
        return buildError('DOCX_SAFE_CREATE_LEGACY_RECOVERY_REQUIRED', 'docx_import_legacy_batch_requires_recovery');
      }
      const pending = await readPendingProjectTransactionBinding({ manifestPath: options.manifestPath, fsAdapter });
      if (pending.pending) await recoverProjectTransaction({ scenePath: pending.scenePath,
        manifestPath: options.manifestPath, publishManifest, verifyManifestContinuation, fsAdapter });
      const manifestRaw = await fs.readFile(options.manifestPath, 'utf8');
      if (JSON.parse(manifestRaw).projectId !== options.projectId) throw Error('DOCX_SAFE_CREATE_PROJECT_IDENTITY_MISMATCH');
      const result = await applyDocxImportSafeCreateInLease(input, { ...options, manifestRaw, lease,
        publishManifest, verifyManifestContinuation, fsAdapter, assertPublication });
      await assertPublication();
      return result;
    })), options.operationLabel || 'safe create DOCX import transaction');
  } catch (error) {
    return buildError('DOCX_SAFE_CREATE_WRITE_FAIL', 'docx_import_safe_create_write_failed', {
      messageCode: /^[A-Z][A-Z0-9_]{1,95}$/.test(error?.code || error?.message || '')
        ? (error.code || error.message) : 'WRITE_EXCEPTION',
    });
  }
}

module.exports = {
  DOCX_IMPORT_SAFE_CREATE_RECEIPT_SCHEMA,
  DOCX_IMPORT_SAFE_CREATE_RECEIPT_TYPE,
  DOCX_IMPORT_SAFE_CREATE_READY_REASON,
  DOCX_IMPORT_RECEIPT_V2_SCHEMA,
  DOCX_IMPORT_RECEIPT_V3_SCHEMA,
  applyDocxImportSafeCreate,
  verifyDocxMediaAssetFiles,
  buildImportOperationId,
  hashDocxImportPreviewPlanForAdmission,
  isDocxImportPreviewPlanAdmitted,
  rememberDocxImportPreviewPlanAdmission,
  validateDocxImportPreviewPlan,
};
