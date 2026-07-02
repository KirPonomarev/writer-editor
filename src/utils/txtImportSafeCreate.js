const fs = require('node:fs').promises;
const crypto = require('node:crypto');

const {
  isPathInsideBoundary,
  joinPathSegmentsWithinRoot,
} = require('../core/io/path-boundary');
const { writeFlowSceneBatchAtomic } = require('./flowSceneBatchAtomic');
const {
  TXT_IMPORT_PREVIEW_SCHEMA,
  TXT_IMPORT_PREVIEW_TYPE,
  TXT_IMPORT_PREVIEW_READY_CODE,
  isTxtImportPreviewPlanAdmitted,
  recomputeTxtImportPreviewHash,
  normalizeText,
  shortHash,
  stableStringify,
} = require('./txtImportLocalFilePreview');

const TXT_IMPORT_SAFE_CREATE_RECEIPT_SCHEMA = 'txt-import-safe-create-receipt.v1';
const TXT_IMPORT_SAFE_CREATE_RECEIPT_TYPE = 'txt.import.safeCreate.receipt';
const TXT_IMPORT_SAFE_CREATE_READY_REASON = 'TXT_IMPORT_SAFE_CREATE_APPLIED';

const TXT_IMPORT_SAFE_CREATE_ALLOWED_PLAN_KEYS = new Set([
  'ok',
  'schemaVersion',
  'type',
  'status',
  'code',
  'reason',
  'decision',
  'writeEffects',
  'source',
  'candidateCreatePlan',
  'previewHash',
]);
const TXT_IMPORT_SAFE_CREATE_ALLOWED_SOURCE_KEYS = new Set([
  'schemaVersion',
  'type',
  'sourceName',
  'encoding',
  'hasUtf8Bom',
  'byteLength',
  'textLength',
  'lineCount',
  'textHash',
]);
const TXT_IMPORT_SAFE_CREATE_ALLOWED_ENTRY_KEYS = new Set([
  'sceneId',
  'kind',
  'title',
  'content',
  'contentTextHash',
  'source',
]);
const TXT_IMPORT_SAFE_CREATE_FORBIDDEN_KEYS = new Set([
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
  'receipt',
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneJsonSafe(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(normalizeText(value), 'utf8').digest('hex');
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
    if (TXT_IMPORT_SAFE_CREATE_FORBIDDEN_KEYS.has(key)) {
      return nextPath.join('.');
    }
    const nested = findForbiddenKey(value[key], nextPath);
    if (nested) return nested;
  }
  return '';
}

function sanitizeFilename(name) {
  const safe = String(name || '')
    .trim()
    .replace(/[\\/<>:"|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/g, '');
  return safe.slice(0, 80) || 'Imported TXT';
}

function buildSceneId(sourceName, textHash, textLength, lineCount) {
  return `txt-import-scene-${shortHash(stableStringify({
    sourceName,
    textHash,
    textLength,
    lineCount,
  }))}`;
}

function validateTrustedRoots(projectRoot, romanRoot) {
  if (typeof projectRoot !== 'string' || !projectRoot.trim()) {
    return buildError(
      'TXT_SAFE_CREATE_PROJECT_ROOT_REQUIRED',
      'txt_import_safe_create_project_root_required',
    );
  }
  if (typeof romanRoot !== 'string' || !romanRoot.trim()) {
    return buildError(
      'TXT_SAFE_CREATE_ROMAN_ROOT_REQUIRED',
      'txt_import_safe_create_roman_root_required',
    );
  }
  if (!isPathInsideBoundary(projectRoot, romanRoot, { resolveSymlinks: true })) {
    return buildError(
      'TXT_SAFE_CREATE_ROOT_INVALID',
      'txt_import_safe_create_roman_root_invalid',
    );
  }
  return { ok: true };
}

function validateTxtImportPreviewPlan(plan) {
  if (!isPlainObject(plan)) {
    return buildError(
      'TXT_SAFE_CREATE_PREVIEW_REQUIRED',
      'txt_import_safe_create_preview_required',
    );
  }

  const forbiddenKey = findForbiddenKey(plan);
  if (forbiddenKey) {
    return buildError(
      'TXT_SAFE_CREATE_PREVIEW_FORBIDDEN_FIELD',
      'txt_import_safe_create_preview_forbidden_field',
      { key: forbiddenKey },
    );
  }

  const extraPlanKeys = unsupportedKeys(plan, TXT_IMPORT_SAFE_CREATE_ALLOWED_PLAN_KEYS);
  if (extraPlanKeys.length > 0) {
    return buildError(
      'TXT_SAFE_CREATE_PREVIEW_INVALID',
      'txt_import_safe_create_preview_unsupported_fields',
      { fields: extraPlanKeys },
    );
  }

  if (
    plan.schemaVersion !== TXT_IMPORT_PREVIEW_SCHEMA
    || plan.type !== TXT_IMPORT_PREVIEW_TYPE
    || plan.ok !== true
    || plan.status !== 'preview'
    || plan.code !== TXT_IMPORT_PREVIEW_READY_CODE
    || plan.decision !== 'preview'
    || plan.writeEffects !== false
  ) {
    return buildError(
      'TXT_SAFE_CREATE_PREVIEW_INVALID',
      'txt_import_safe_create_preview_invalid',
      { field: 'previewEnvelope' },
    );
  }

  if (typeof plan.previewHash !== 'string' || !/^[a-f0-9]{10}$/u.test(plan.previewHash)) {
    return buildError(
      'TXT_SAFE_CREATE_PREVIEW_INVALID',
      'txt_import_safe_create_preview_hash_invalid',
      { field: 'previewHash' },
    );
  }
  if (recomputeTxtImportPreviewHash(plan) !== plan.previewHash) {
    return buildError(
      'TXT_SAFE_CREATE_PREVIEW_TAMPERED',
      'txt_import_safe_create_preview_hash_mismatch',
      { field: 'previewHash' },
    );
  }

  const source = plan.source;
  if (!isPlainObject(source)) {
    return buildError(
      'TXT_SAFE_CREATE_PREVIEW_INVALID',
      'txt_import_safe_create_preview_invalid',
      { field: 'source' },
    );
  }
  const extraSourceKeys = unsupportedKeys(source, TXT_IMPORT_SAFE_CREATE_ALLOWED_SOURCE_KEYS);
  if (extraSourceKeys.length > 0) {
    return buildError(
      'TXT_SAFE_CREATE_PREVIEW_INVALID',
      'txt_import_safe_create_preview_unsupported_fields',
      { field: 'source', fields: extraSourceKeys },
    );
  }
  if (
    source.schemaVersion !== 'txt-import-local-file-preview.v1'
    || source.type !== 'txt.import.localFilePreview'
    || source.encoding !== 'utf-8'
    || typeof source.sourceName !== 'string'
    || !Number.isInteger(source.byteLength)
    || source.byteLength <= 0
    || !Number.isInteger(source.textLength)
    || source.textLength < 0
    || !Number.isInteger(source.lineCount)
    || source.lineCount < 0
    || typeof source.textHash !== 'string'
    || !/^[a-f0-9]{10}$/u.test(source.textHash)
  ) {
    return buildError(
      'TXT_SAFE_CREATE_PREVIEW_INVALID',
      'txt_import_safe_create_preview_invalid',
      { field: 'source' },
    );
  }

  const candidate = plan.candidateCreatePlan;
  if (!isPlainObject(candidate)) {
    return buildError(
      'TXT_SAFE_CREATE_PREVIEW_INVALID',
      'txt_import_safe_create_candidate_required',
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
      'TXT_SAFE_CREATE_PREVIEW_INVALID',
      'txt_import_safe_create_candidate_invalid',
      { field: 'candidateCreatePlan' },
    );
  }

  const entry = candidate.entries[0];
  if (!isPlainObject(entry)) {
    return buildError(
      'TXT_SAFE_CREATE_PREVIEW_INVALID',
      'txt_import_safe_create_candidate_invalid',
      { field: 'candidateCreatePlan.entries.0' },
    );
  }
  const extraEntryKeys = unsupportedKeys(entry, TXT_IMPORT_SAFE_CREATE_ALLOWED_ENTRY_KEYS);
  if (extraEntryKeys.length > 0) {
    return buildError(
      'TXT_SAFE_CREATE_PREVIEW_INVALID',
      'txt_import_safe_create_candidate_unsupported_fields',
      { field: 'candidateCreatePlan.entries.0', fields: extraEntryKeys },
    );
  }
  if (
    typeof entry.sceneId !== 'string'
    || !/^txt-import-scene-[a-f0-9]{10}$/u.test(entry.sceneId)
    || entry.kind !== 'scene'
    || typeof entry.title !== 'string'
    || typeof entry.content !== 'string'
    || typeof entry.contentTextHash !== 'string'
    || !/^[a-f0-9]{10}$/u.test(entry.contentTextHash)
  ) {
    return buildError(
      'TXT_SAFE_CREATE_PREVIEW_INVALID',
      'txt_import_safe_create_candidate_invalid',
      { field: 'candidateCreatePlan.entries.0' },
    );
  }

  const content = normalizeText(entry.content);
  if (sha256Text(content).slice(0, 10) !== entry.contentTextHash) {
    return buildError(
      'TXT_SAFE_CREATE_PREVIEW_TAMPERED',
      'txt_import_safe_create_content_hash_mismatch',
      { field: 'candidateCreatePlan.entries.0.contentTextHash' },
    );
  }

  if (!isPlainObject(entry.source)) {
    return buildError(
      'TXT_SAFE_CREATE_PREVIEW_INVALID',
      'txt_import_safe_create_candidate_invalid',
      { field: 'candidateCreatePlan.entries.0.source' },
    );
  }
  const entrySourceKeys = unsupportedKeys(entry.source, TXT_IMPORT_SAFE_CREATE_ALLOWED_SOURCE_KEYS);
  if (entrySourceKeys.length > 0) {
    return buildError(
      'TXT_SAFE_CREATE_PREVIEW_INVALID',
      'txt_import_safe_create_candidate_unsupported_fields',
      { field: 'candidateCreatePlan.entries.0.source', fields: entrySourceKeys },
    );
  }
  if (stableStringify(entry.source) !== stableStringify(source)) {
    return buildError(
      'TXT_SAFE_CREATE_PREVIEW_TAMPERED',
      'txt_import_safe_create_source_mismatch',
      { field: 'candidateCreatePlan.entries.0.source' },
    );
  }

  const expectedSceneId = buildSceneId(
    source.sourceName,
    source.textHash,
    source.textLength,
    source.lineCount,
  );
  if (entry.sceneId !== expectedSceneId) {
    return buildError(
      'TXT_SAFE_CREATE_PREVIEW_TAMPERED',
      'txt_import_safe_create_scene_id_mismatch',
      { field: 'candidateCreatePlan.entries.0.sceneId' },
    );
  }

  return {
    ok: true,
    value: {
      previewHash: plan.previewHash,
      entry: {
        sceneId: entry.sceneId,
        kind: entry.kind,
        title: entry.title.trim() || 'Imported TXT',
        content,
        contentTextHash: entry.contentTextHash,
      },
    },
  };
}

function buildTxtImportScenePath(romanRoot, entry) {
  return joinPathSegmentsWithinRoot(
    romanRoot,
    ['Imported', `${sanitizeFilename(entry.title)} ${entry.contentTextHash}.txt`],
    { resolveSymlinks: false },
  );
}

async function applyTxtImportSafeCreate(input = {}, options = {}) {
  const projectRoot = typeof options.projectRoot === 'string' ? options.projectRoot.trim() : '';
  const romanRoot = typeof options.romanRoot === 'string' ? options.romanRoot.trim() : '';
  const plan = isPlainObject(input.txtImportPreviewPlan) ? input.txtImportPreviewPlan : null;

  const validated = validateTxtImportPreviewPlan(plan);
  if (!validated.ok) return validated;
  if (!isTxtImportPreviewPlanAdmitted(plan)) {
    return buildError(
      'TXT_SAFE_CREATE_PREVIEW_NOT_ADMITTED',
      'txt_import_safe_create_preview_not_admitted',
    );
  }
  const roots = validateTrustedRoots(projectRoot, romanRoot);
  if (!roots.ok) return roots;

  const targetPath = buildTxtImportScenePath(romanRoot, validated.value.entry);
  if (
    !isPathInsideBoundary(romanRoot, targetPath, { resolveSymlinks: false })
    || !isPathInsideBoundary(projectRoot, targetPath, { resolveSymlinks: true })
  ) {
    return buildError(
      'TXT_SAFE_CREATE_SCENE_PATH_FORBIDDEN',
      'txt_import_safe_create_scene_path_forbidden',
    );
  }
  if (await pathExists(targetPath)) {
    return buildError(
      'TXT_SAFE_CREATE_EXISTING_SCENE_BLOCKED',
      'txt_import_safe_create_existing_scene_blocked',
      { sceneId: validated.value.entry.sceneId },
    );
  }

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
              path: targetPath,
              content: validated.value.entry.content,
            },
          ],
        },
        {
          beforeActivate: async ({ entry }) => {
            if (await pathExists(entry.path)) {
              throw new Error('TXT_SAFE_CREATE_EXISTING_SCENE_BLOCKED');
            }
          },
        },
      ),
      typeof options.operationLabel === 'string' && options.operationLabel.trim()
        ? options.operationLabel
        : 'safe create TXT import scene batch',
    );
  } catch (error) {
    return buildError(
      'TXT_SAFE_CREATE_WRITE_FAIL',
      'txt_import_safe_create_write_failed',
      {
        message: error && typeof error.message === 'string' ? error.message : 'WRITE_EXCEPTION',
      },
    );
  }

  if (!writeResult || writeResult.ok !== true) {
    if (writeResult && isPlainObject(writeResult.error)) {
      return buildError(
        typeof writeResult.error.code === 'string' ? writeResult.error.code : 'TXT_SAFE_CREATE_WRITE_FAIL',
        typeof writeResult.error.reason === 'string'
          ? writeResult.error.reason
          : 'txt_import_safe_create_write_failed',
        isPlainObject(writeResult.error.details) ? writeResult.error.details : {},
      );
    }
    return buildError(
      'TXT_SAFE_CREATE_WRITE_FAIL',
      'txt_import_safe_create_write_failed',
    );
  }

  const actualContent = normalizeText(await fs.readFile(targetPath, 'utf8'));
  const createdScene = {
    sceneId: validated.value.entry.sceneId,
    kind: validated.value.entry.kind,
    title: validated.value.entry.title,
    contentTextHash: validated.value.entry.contentTextHash,
    bytesWritten: Buffer.byteLength(actualContent, 'utf8'),
    outputHash: sha256Text(actualContent),
  };
  const receipt = {
    schemaVersion: TXT_IMPORT_SAFE_CREATE_RECEIPT_SCHEMA,
    type: TXT_IMPORT_SAFE_CREATE_RECEIPT_TYPE,
    reason: TXT_IMPORT_SAFE_CREATE_READY_REASON,
    projectId: typeof options.projectId === 'string' ? options.projectId : '',
    batchId: writeResult.value && typeof writeResult.value.batchId === 'string'
      ? writeResult.value.batchId
      : '',
    sourcePreviewHash: validated.value.previewHash,
    inputHash: sha256Text(stableStringify(cloneJsonSafe(plan))),
    outputHash: sha256Text(stableStringify({
      createdScenes: [createdScene],
    })),
    createdSceneIds: [createdScene.sceneId],
    createdScenes: [createdScene],
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
  TXT_IMPORT_SAFE_CREATE_RECEIPT_SCHEMA,
  TXT_IMPORT_SAFE_CREATE_RECEIPT_TYPE,
  TXT_IMPORT_SAFE_CREATE_READY_REASON,
  applyTxtImportSafeCreate,
};
