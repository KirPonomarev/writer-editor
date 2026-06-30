const fs = require('node:fs').promises;
const path = require('node:path');
const crypto = require('node:crypto');

const {
  isPathInsideBoundary,
  joinPathSegmentsWithinRoot,
} = require('../core/io/path-boundary');
const { writeFlowSceneBatchAtomic } = require('./flowSceneBatchAtomic');

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
const DOCX_IMPORT_SAFE_CREATE_ADMISSION_LIMIT = 64;
const DOCX_IMPORT_SAFE_CREATE_MESSAGE_CODE_RE = /^(DOCX|FLOW)_[A-Z0-9_]{1,95}$/u;
const docxImportPreviewPlanAdmissions = new Map();

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
]);
const DOCX_IMPORT_SAFE_CREATE_ALLOWED_ENTRY_KEYS = new Set([
  'sceneId',
  'kind',
  'title',
  'content',
  'contentTextHash',
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
  const expectedSceneId = `docx-import-scene-${docxStableHash(docxCanonicalJson({
    sourceTextHash: entry.source.textHash,
    contentTextHash: entry.contentTextHash,
    paragraphCount: entry.source.paragraphCount,
  }))}`;
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
    || plan.lossReport.mode !== 'plain-text-only'
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
      },
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

function buildDocxImportScenePath(romanRoot, entry) {
  const suffix = entry.contentTextHash || entry.sceneId.replace(/^docx-import-scene-/u, '');
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

async function applyDocxImportSafeCreate(input = {}, options = {}) {
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

  const targetPath = buildDocxImportScenePath(romanRoot, validated.value.entry);
  if (
    !isPathInsideBoundary(romanRoot, targetPath, { resolveSymlinks: false })
    || !isPathInsideBoundary(projectRoot, targetPath, { resolveSymlinks: true })
  ) {
    return buildError(
      'DOCX_SAFE_CREATE_SCENE_PATH_FORBIDDEN',
      'docx_import_safe_create_scene_path_forbidden',
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
  };
  const queueDiskOperation = typeof options.queueDiskOperation === 'function'
    ? options.queueDiskOperation
    : async (operation) => operation();
  const writeBatchAtomic = typeof options.writeBatchAtomic === 'function'
    ? options.writeBatchAtomic
    : writeFlowSceneBatchAtomic;

  let writeResult = null;
  try {
    writeResult = await queueDiskOperation(
      () => writeBatchAtomic(
        {
          projectRoot,
          entries: [
            {
              path: normalizedEntry.path,
              content: normalizedEntry.content,
            },
          ],
        },
        {
          beforeActivate: async ({ entry }) => {
            if (await pathExists(entry.path)) {
              throw new Error('DOCX_SAFE_CREATE_EXISTING_SCENE_BLOCKED');
            }
          },
        },
      ),
      typeof options.operationLabel === 'string' && options.operationLabel.trim()
        ? options.operationLabel
        : 'safe create DOCX import scene batch',
    );
  } catch (error) {
    return buildError(
      'DOCX_SAFE_CREATE_WRITE_FAIL',
      'docx_import_safe_create_write_failed',
      {
        messageCode: error
          && typeof error.message === 'string'
          && DOCX_IMPORT_SAFE_CREATE_MESSAGE_CODE_RE.test(error.message)
          ? error.message.slice(0, 96)
          : 'WRITE_EXCEPTION',
      },
    );
  }

  if (!writeResult || writeResult.ok !== true) {
    if (writeResult && isPlainObject(writeResult.error)) {
      const reason = writeResult.error.reason === 'DOCX_SAFE_CREATE_EXISTING_SCENE_BLOCKED'
        ? 'docx_import_safe_create_existing_scene_blocked'
        : (typeof writeResult.error.reason === 'string'
          ? writeResult.error.reason
          : 'docx_import_safe_create_write_failed');
      return {
        ok: false,
        error: {
          code: typeof writeResult.error.code === 'string'
            ? writeResult.error.code
            : 'DOCX_SAFE_CREATE_WRITE_FAIL',
          reason,
          details: isPlainObject(writeResult.error.details)
            ? sanitizePublicErrorDetails(writeResult.error.details)
            : {},
        },
      };
    }
    return buildError(
      'DOCX_SAFE_CREATE_WRITE_FAIL',
      'docx_import_safe_create_write_failed',
    );
  }

  const actualContent = normalizeText(await fs.readFile(normalizedEntry.path, 'utf8'));
  const verifiedScene = {
    sceneId: normalizedEntry.sceneId,
    kind: normalizedEntry.kind,
    title: normalizedEntry.title,
    bytesWritten: Buffer.byteLength(actualContent, 'utf8'),
    outputHash: sha256Text(actualContent),
  };
  const lossReportSummary = {
    schemaVersion: validated.value.lossReport.schemaVersion,
    mode: validated.value.lossReport.mode,
    itemCount: validated.value.lossReport.itemCount,
  };
  const inputHash = sha256Text(stableStringify(plan));
  const outputHash = sha256Text(stableStringify({ createdScenes: [verifiedScene] }));
  const receipt = {
    schemaVersion: DOCX_IMPORT_SAFE_CREATE_RECEIPT_SCHEMA,
    type: DOCX_IMPORT_SAFE_CREATE_RECEIPT_TYPE,
    reason: DOCX_IMPORT_SAFE_CREATE_READY_REASON,
    projectId: typeof options.projectId === 'string' ? options.projectId : '',
    batchId: writeResult.value && typeof writeResult.value.batchId === 'string'
      ? writeResult.value.batchId
      : '',
    sourcePreviewHash: validated.value.previewHash,
    inputHash,
    outputHash,
    createdSceneIds: [verifiedScene.sceneId],
    createdScenes: [verifiedScene],
    lossReportSummary,
    atomicEvidence: {
      sceneCount: 1,
      markerCleared: true,
    },
  };

  return {
    ok: true,
    value: {
      created: true,
      safeCreate: true,
      createdSceneIds: receipt.createdSceneIds,
      receipt,
    },
  };
}

module.exports = {
  DOCX_IMPORT_SAFE_CREATE_RECEIPT_SCHEMA,
  DOCX_IMPORT_SAFE_CREATE_RECEIPT_TYPE,
  DOCX_IMPORT_SAFE_CREATE_READY_REASON,
  applyDocxImportSafeCreate,
  hashDocxImportPreviewPlanForAdmission,
  isDocxImportPreviewPlanAdmitted,
  rememberDocxImportPreviewPlanAdmission,
  validateDocxImportPreviewPlan,
};
