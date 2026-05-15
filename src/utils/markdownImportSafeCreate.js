const fs = require('node:fs').promises;
const path = require('node:path');
const crypto = require('node:crypto');

const { sanitizePathFieldsWithinRoot } = require('../core/io/path-boundary');
const { writeFlowSceneBatchAtomic } = require('./flowSceneBatchAtomic');

const MARKDOWN_IMPORT_SAFE_CREATE_RECEIPT_SCHEMA = 'markdown-import-safe-create-receipt.v1';
const MARKDOWN_IMPORT_SAFE_CREATE_RECEIPT_TYPE = 'markdown.import.safeCreate.receipt';
const MARKDOWN_IMPORT_SAFE_CREATE_READY_REASON = 'MARKDOWN_IMPORT_SAFE_CREATE_APPLIED';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

function normalizeReservedNames(input) {
  if (!Array.isArray(input)) return new Set();
  return new Set(
    input
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean),
  );
}

function classifyRomanScenePath(projectRoot, romanRoot, safePath, reservedTopLevelRomanNames) {
  const relativeToProject = path.relative(projectRoot, safePath);
  if (!relativeToProject || relativeToProject.startsWith('..')) return '';
  const projectParts = relativeToProject.split(path.sep);
  if (projectParts[0] !== 'roman') return '';

  const relativeToRoman = path.relative(romanRoot, safePath);
  if (!relativeToRoman || relativeToRoman.startsWith('..')) return '';
  if (!safePath.toLowerCase().endsWith('.txt')) return '';

  const romanParts = relativeToRoman.split(path.sep);
  if (romanParts.length === 1) {
    const topLevelBaseName = path.basename(safePath, '.txt').trim().toLowerCase();
    if (reservedTopLevelRomanNames.has(topLevelBaseName)) return '';
    return 'chapter-file';
  }
  if (romanParts.length === 2) {
    return 'chapter-file';
  }
  return 'scene';
}

function validatePreviewEnvelope(previewPayload, previewSchemaVersion) {
  if (!isPlainObject(previewPayload)) {
    return buildError(
      'MDV1_SAFE_CREATE_PREVIEW_REQUIRED',
      'import_safe_create_preview_required',
    );
  }
  if (previewPayload.schemaVersion !== previewSchemaVersion) {
    return buildError(
      'MDV1_SAFE_CREATE_PREVIEW_INVALID',
      'import_safe_create_preview_invalid',
      { field: 'schemaVersion' },
    );
  }
  if (previewPayload.type !== 'markdown.import.preview') {
    return buildError(
      'MDV1_SAFE_CREATE_PREVIEW_INVALID',
      'import_safe_create_preview_invalid',
      { field: 'type' },
    );
  }
  if (previewPayload.status !== 'preview') {
    return buildError(
      'MDV1_SAFE_CREATE_PREVIEW_INVALID',
      'import_safe_create_preview_invalid',
      { field: 'status' },
    );
  }
  if (previewPayload.writeEffects !== false) {
    return buildError(
      'MDV1_SAFE_CREATE_PREVIEW_INVALID',
      'import_safe_create_preview_invalid',
      { field: 'writeEffects' },
    );
  }
  if (!isPlainObject(previewPayload.safeCreatePlan)) {
    return buildError(
      'MDV1_SAFE_CREATE_PREVIEW_INVALID',
      'import_safe_create_preview_invalid',
      { field: 'safeCreatePlan' },
    );
  }
  if (previewPayload.safeCreatePlan.mode !== 'create-only') {
    return buildError(
      'MDV1_SAFE_CREATE_PREVIEW_INVALID',
      'import_safe_create_preview_invalid',
      { field: 'safeCreatePlan.mode' },
    );
  }
  if (!Array.isArray(previewPayload.safeCreatePlan.entries) || previewPayload.safeCreatePlan.entries.length === 0) {
    return buildError(
      'MDV1_SAFE_CREATE_PREVIEW_INVALID',
      'import_safe_create_preview_invalid',
      { field: 'safeCreatePlan.entries' },
    );
  }
  return { ok: true, value: previewPayload.safeCreatePlan.entries };
}

async function applyMarkdownImportSafeCreate(input = {}, options = {}) {
  const projectRoot = typeof options.projectRoot === 'string' ? options.projectRoot.trim() : '';
  if (!projectRoot) {
    return buildError(
      'MDV1_SAFE_CREATE_PROJECT_ROOT_REQUIRED',
      'import_safe_create_project_root_required',
    );
  }

  const previewSchemaVersion = typeof options.previewSchemaVersion === 'string' && options.previewSchemaVersion.trim()
    ? options.previewSchemaVersion.trim()
    : 'markdown-import-preview.v1';
  const previewPayload = isPlainObject(input.previewPayload) ? input.previewPayload : null;
  const previewValidation = validatePreviewEnvelope(previewPayload, previewSchemaVersion);
  if (!previewValidation.ok) {
    return previewValidation;
  }

  const reservedTopLevelRomanNames = normalizeReservedNames(options.reservedTopLevelRomanNames);
  const romanRoot = typeof options.romanRoot === 'string' && options.romanRoot.trim()
    ? options.romanRoot.trim()
    : path.join(projectRoot, 'roman');
  const normalizedEntries = [];
  const seenSceneIds = new Set();
  const seenPaths = new Set();

  for (let index = 0; index < previewValidation.value.length; index += 1) {
    const entry = previewValidation.value[index];
    if (!isPlainObject(entry)) {
      return buildError(
        'MDV1_SAFE_CREATE_PREVIEW_INVALID',
        'import_safe_create_preview_invalid',
        { field: 'safeCreatePlan.entries', index },
      );
    }

    const sceneId = typeof entry.sceneId === 'string' ? entry.sceneId.trim() : '';
    if (!sceneId) {
      return buildError(
        'MDV1_SAFE_CREATE_PREVIEW_INVALID',
        'import_safe_create_preview_invalid',
        { field: 'safeCreatePlan.entries.sceneId', index },
      );
    }
    if (seenSceneIds.has(sceneId)) {
      return buildError(
        'MDV1_SAFE_CREATE_PREVIEW_INVALID',
        'import_safe_create_preview_invalid',
        { field: 'safeCreatePlan.entries.sceneId', index, sceneId },
      );
    }
    seenSceneIds.add(sceneId);

    const rawPath = typeof entry.path === 'string' ? entry.path : '';
    const guardedPath = sanitizePathFieldsWithinRoot(
      { path: rawPath },
      ['path'],
      projectRoot,
      { mode: 'any', resolveSymlinks: true },
    );
    if (!guardedPath.ok || !guardedPath.payload) {
      return buildError(
        'MDV1_SAFE_CREATE_PATH_FORBIDDEN',
        'import_safe_create_path_forbidden',
        {
          index,
          path: rawPath,
          failReason: guardedPath.pathGuard && typeof guardedPath.pathGuard.failReason === 'string'
            ? guardedPath.pathGuard.failReason
            : 'PATH_BOUNDARY_VIOLATION',
        },
      );
    }

    const safePath = guardedPath.payload.path;
    if (seenPaths.has(safePath)) {
      return buildError(
        'MDV1_SAFE_CREATE_PREVIEW_INVALID',
        'import_safe_create_preview_invalid',
        { field: 'safeCreatePlan.entries.path', index, path: safePath },
      );
    }
    seenPaths.add(safePath);

    const sceneKind = classifyRomanScenePath(projectRoot, romanRoot, safePath, reservedTopLevelRomanNames);
    if (!sceneKind) {
      return buildError(
        'MDV1_SAFE_CREATE_PATH_FORBIDDEN',
        'import_safe_create_scene_path_forbidden',
        { index, path: safePath },
      );
    }

    if (await pathExists(safePath)) {
      return buildError(
        'MDV1_SAFE_CREATE_EXISTING_SCENE_BLOCKED',
        'import_safe_create_existing_scene_blocked',
        { index, sceneId, path: safePath },
      );
    }

    normalizedEntries.push({
      sceneId,
      path: safePath,
      kind: sceneKind,
      content: normalizeText(entry.content),
    });
  }

  const queueDiskOperation = typeof options.queueDiskOperation === 'function'
    ? options.queueDiskOperation
    : async (operation) => operation();
  const writeBatchAtomic = typeof options.writeBatchAtomic === 'function'
    ? options.writeBatchAtomic
    : writeFlowSceneBatchAtomic;
  const writeResult = await queueDiskOperation(
    () => writeBatchAtomic({
      projectRoot,
      entries: normalizedEntries.map((entry) => ({
        path: entry.path,
        content: entry.content,
      })),
    }),
    typeof options.operationLabel === 'string' && options.operationLabel.trim()
      ? options.operationLabel
      : 'safe create import scene batch',
  );

  if (!writeResult || writeResult.ok !== true) {
    if (writeResult && isPlainObject(writeResult.error)) {
      return {
        ok: false,
        error: {
          code: typeof writeResult.error.code === 'string' ? writeResult.error.code : 'MDV1_SAFE_CREATE_WRITE_FAIL',
          reason: typeof writeResult.error.reason === 'string'
            ? writeResult.error.reason
            : 'import_safe_create_write_failed',
          details: isPlainObject(writeResult.error.details) ? writeResult.error.details : {},
        },
      };
    }
    return buildError(
      'MDV1_SAFE_CREATE_WRITE_FAIL',
      'import_safe_create_write_failed',
    );
  }

  const verifiedEntries = [];
  for (const entry of normalizedEntries) {
    const actualContent = normalizeText(await fs.readFile(entry.path, 'utf8'));
    verifiedEntries.push({
      sceneId: entry.sceneId,
      path: entry.path,
      kind: entry.kind,
      bytesWritten: Buffer.byteLength(actualContent, 'utf8'),
      outputHash: sha256Text(actualContent),
    });
  }

  const inputHash = sha256Text(stableStringify(previewPayload));
  const outputHash = sha256Text(stableStringify({
    createdScenes: verifiedEntries,
  }));
  const receipt = {
    schemaVersion: MARKDOWN_IMPORT_SAFE_CREATE_RECEIPT_SCHEMA,
    type: MARKDOWN_IMPORT_SAFE_CREATE_RECEIPT_TYPE,
    reason: MARKDOWN_IMPORT_SAFE_CREATE_READY_REASON,
    projectId: typeof options.projectId === 'string' ? options.projectId : '',
    batchId: writeResult.value && typeof writeResult.value.batchId === 'string'
      ? writeResult.value.batchId
      : '',
    inputHash,
    outputHash,
    createdSceneIds: verifiedEntries.map((entry) => entry.sceneId),
    createdScenes: verifiedEntries,
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
  MARKDOWN_IMPORT_SAFE_CREATE_RECEIPT_SCHEMA,
  MARKDOWN_IMPORT_SAFE_CREATE_RECEIPT_TYPE,
  MARKDOWN_IMPORT_SAFE_CREATE_READY_REASON,
  applyMarkdownImportSafeCreate,
};
