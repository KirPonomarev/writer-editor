const path = require('node:path');
const crypto = require('node:crypto');
const { TextDecoder } = require('node:util');

const TXT_IMPORT_LOCAL_FILE_PREVIEW_SCHEMA = 'txt-import-local-file-preview.v1';
const TXT_IMPORT_LOCAL_FILE_PREVIEW_TYPE = 'txt.import.localFilePreview';
const TXT_IMPORT_PREVIEW_SCHEMA = 'txt-import-preview.v1';
const TXT_IMPORT_PREVIEW_TYPE = 'txt.import.preview';
const TXT_IMPORT_PREVIEW_READY_CODE = 'TXT_IMPORT_PREVIEW_READY';
const TXT_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES = 10 * 1024 * 1024;
const TXT_IMPORT_LOCAL_FILE_PREVIEW_MAX_REQUEST_ID_CHARS = 120;
const TXT_IMPORT_PREVIEW_ADMISSION_LIMIT = 64;

const TXT_IMPORT_LOCAL_FILE_PREVIEW_ALLOWED_INPUT_KEYS = new Set(['requestId']);
const TXT_IMPORT_LOCAL_FILE_PREVIEW_FORBIDDEN_KEYS = new Set([
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

const TXT_IMPORT_LOCAL_FILE_PREVIEW_CODES = Object.freeze({
  READY: 'TXT_IMPORT_LOCAL_FILE_PREVIEW_READY',
  INPUT_INVALID: 'TXT_IMPORT_LOCAL_FILE_PREVIEW_INPUT_INVALID',
  PICKER_UNAVAILABLE: 'TXT_IMPORT_LOCAL_FILE_PREVIEW_PICKER_UNAVAILABLE',
  PICKER_CANCELLED: 'TXT_IMPORT_LOCAL_FILE_PREVIEW_PICKER_CANCELLED',
  SELECTION_INVALID: 'TXT_IMPORT_LOCAL_FILE_PREVIEW_SELECTION_INVALID',
  EXTENSION_UNSUPPORTED: 'TXT_IMPORT_LOCAL_FILE_PREVIEW_EXTENSION_UNSUPPORTED',
  FILE_TOO_LARGE: 'TXT_IMPORT_LOCAL_FILE_PREVIEW_FILE_TOO_LARGE',
  READER_UNAVAILABLE: 'TXT_IMPORT_LOCAL_FILE_PREVIEW_READER_UNAVAILABLE',
  READ_FAILED: 'TXT_IMPORT_LOCAL_FILE_PREVIEW_READ_FAILED',
  BYTES_INVALID: 'TXT_IMPORT_LOCAL_FILE_PREVIEW_BYTES_INVALID',
  ENCODING_UNSUPPORTED: 'TXT_IMPORT_LOCAL_FILE_PREVIEW_ENCODING_UNSUPPORTED',
  OUTPUT_FORBIDDEN: 'TXT_IMPORT_LOCAL_FILE_PREVIEW_OUTPUT_FORBIDDEN',
});

const txtImportPreviewPlanAdmissions = new Map();

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

function shortHash(value) {
  return sha256Text(value).slice(0, 10);
}

function normalizeRequestId(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : 'txt-import-local-file-preview-request';
}

function buildError(code, reason, details = undefined) {
  const error = { code, reason };
  if (isPlainObject(details) && Object.keys(details).length > 0) {
    error.details = cloneJsonSafe(details);
  }
  return { ok: false, error };
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
    if (TXT_IMPORT_LOCAL_FILE_PREVIEW_FORBIDDEN_KEYS.has(key)) {
      return nextPath.join('.');
    }
    const nested = findForbiddenKey(value[key], nextPath);
    if (nested) return nested;
  }
  return '';
}

function unsupportedKeys(value, allowedKeys) {
  if (!isPlainObject(value)) return [];
  return Object.keys(value).filter((key) => !allowedKeys.has(key)).sort();
}

function sanitizeFilename(name) {
  const safe = String(name || '')
    .trim()
    .replace(/[\\/<>:"|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/g, '');
  return safe.slice(0, 96) || 'Imported TXT';
}

function sanitizeSourceName(name) {
  const base = path.basename(String(name || '').trim() || 'import.txt');
  return sanitizeFilename(base) || 'import.txt';
}

function countLines(text) {
  if (!text) return 0;
  return normalizeText(text).split('\n').length;
}

function detectExplicitNonUtf8Bom(bytes) {
  if (!Buffer.isBuffer(bytes)) return '';
  if (bytes.length >= 4) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe && bytes[2] === 0x00 && bytes[3] === 0x00) return 'utf32le';
    if (bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0xfe && bytes[3] === 0xff) return 'utf32be';
  }
  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf16le';
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf16be';
  }
  return '';
}

function decodeUtf8TextStrict(rawBytes) {
  const fileBytes = Buffer.isBuffer(rawBytes) ? rawBytes : Buffer.from(rawBytes || []);
  if (fileBytes.length === 0) {
    return buildError(
      TXT_IMPORT_LOCAL_FILE_PREVIEW_CODES.BYTES_INVALID,
      'TXT_IMPORT_LOCAL_FILE_PREVIEW_BYTES_EMPTY',
    );
  }
  const explicitBom = detectExplicitNonUtf8Bom(fileBytes);
  if (explicitBom) {
    return buildError(
      TXT_IMPORT_LOCAL_FILE_PREVIEW_CODES.ENCODING_UNSUPPORTED,
      'TXT_IMPORT_LOCAL_FILE_PREVIEW_ENCODING_UNSUPPORTED',
      { encoding: explicitBom },
    );
  }

  let decoded = '';
  try {
    decoded = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(fileBytes);
  } catch {
    return buildError(
      TXT_IMPORT_LOCAL_FILE_PREVIEW_CODES.ENCODING_UNSUPPORTED,
      'TXT_IMPORT_LOCAL_FILE_PREVIEW_ENCODING_UNSUPPORTED',
      { encoding: 'non-utf8' },
    );
  }

  if (decoded.includes('\u0000')) {
    return buildError(
      TXT_IMPORT_LOCAL_FILE_PREVIEW_CODES.ENCODING_UNSUPPORTED,
      'TXT_IMPORT_LOCAL_FILE_PREVIEW_ENCODING_UNSUPPORTED',
      { encoding: 'nul-byte-sequence' },
    );
  }

  return {
    ok: true,
    value: {
      text: normalizeText(decoded),
      hasUtf8Bom: (
        fileBytes.length >= 3
        && fileBytes[0] === 0xef
        && fileBytes[1] === 0xbb
        && fileBytes[2] === 0xbf
      ),
    },
  };
}

function buildSceneId(sourceName, textHash, textLength, lineCount) {
  return `txt-import-scene-${shortHash(stableStringify({
    sourceName,
    textHash,
    textLength,
    lineCount,
  }))}`;
}

function recomputeTxtImportPreviewHash(plan) {
  if (!isPlainObject(plan)) return '';
  const source = isPlainObject(plan.source) ? plan.source : {};
  const candidate = isPlainObject(plan.candidateCreatePlan) ? plan.candidateCreatePlan : {};
  const entry = Array.isArray(candidate.entries) && isPlainObject(candidate.entries[0]) ? candidate.entries[0] : {};
  const entrySource = isPlainObject(entry.source) ? entry.source : {};
  return shortHash(stableStringify({
    sourceName: source.sourceName,
    encoding: source.encoding,
    hasUtf8Bom: source.hasUtf8Bom === true,
    byteLength: source.byteLength,
    textLength: source.textLength,
    lineCount: source.lineCount,
    textHash: source.textHash,
    sceneId: entry.sceneId,
    title: entry.title,
    kind: entry.kind,
    contentTextHash: entry.contentTextHash,
    sourceTextHash: entrySource.textHash,
    sourceTextLength: entrySource.textLength,
    sourceLineCount: entrySource.lineCount,
  }));
}

function rememberTxtImportPreviewPlanAdmission(plan) {
  const admissionHash = recomputeTxtImportPreviewHash(plan);
  if (!admissionHash) return '';
  txtImportPreviewPlanAdmissions.delete(admissionHash);
  txtImportPreviewPlanAdmissions.set(admissionHash, true);
  while (txtImportPreviewPlanAdmissions.size > TXT_IMPORT_PREVIEW_ADMISSION_LIMIT) {
    const firstKey = txtImportPreviewPlanAdmissions.keys().next().value;
    txtImportPreviewPlanAdmissions.delete(firstKey);
  }
  return admissionHash;
}

function isTxtImportPreviewPlanAdmitted(plan) {
  const admissionHash = recomputeTxtImportPreviewHash(plan);
  if (!admissionHash || !txtImportPreviewPlanAdmissions.has(admissionHash)) {
    return false;
  }
  txtImportPreviewPlanAdmissions.delete(admissionHash);
  txtImportPreviewPlanAdmissions.set(admissionHash, true);
  return true;
}

function buildTxtImportPreviewPlan({ sourceName, text, byteLength, hasUtf8Bom }) {
  const normalizedSourceName = sanitizeSourceName(sourceName);
  const normalizedTitle = sanitizeFilename(normalizedSourceName.replace(/\.txt$/i, '')) || 'Imported TXT';
  const content = normalizeText(text);
  const textHash = shortHash(content);
  const textLength = content.length;
  const lineCount = countLines(content);
  const sceneId = buildSceneId(normalizedSourceName, textHash, textLength, lineCount);
  const plan = {
    ok: true,
    schemaVersion: TXT_IMPORT_PREVIEW_SCHEMA,
    type: TXT_IMPORT_PREVIEW_TYPE,
    status: 'preview',
    code: TXT_IMPORT_PREVIEW_READY_CODE,
    reason: TXT_IMPORT_PREVIEW_READY_CODE,
    decision: 'preview',
    writeEffects: false,
    source: {
      schemaVersion: TXT_IMPORT_LOCAL_FILE_PREVIEW_SCHEMA,
      type: TXT_IMPORT_LOCAL_FILE_PREVIEW_TYPE,
      sourceName: normalizedSourceName,
      encoding: 'utf-8',
      hasUtf8Bom: hasUtf8Bom === true,
      byteLength,
      textLength,
      lineCount,
      textHash,
    },
    candidateCreatePlan: {
      mode: 'create-only',
      sceneStrategy: 'single-scene',
      entryCount: 1,
      entries: [
        {
          sceneId,
          kind: 'scene',
          title: normalizedTitle,
          content,
          contentTextHash: textHash,
          source: {
            schemaVersion: TXT_IMPORT_LOCAL_FILE_PREVIEW_SCHEMA,
            type: TXT_IMPORT_LOCAL_FILE_PREVIEW_TYPE,
            sourceName: normalizedSourceName,
            encoding: 'utf-8',
            hasUtf8Bom: hasUtf8Bom === true,
            byteLength,
            textLength,
            lineCount,
            textHash,
          },
        },
      ],
    },
  };
  plan.previewHash = recomputeTxtImportPreviewHash(plan);
  return plan;
}

function validateSelectionDescriptor(selection, requestId) {
  if (!isPlainObject(selection)) {
    return buildError(
      TXT_IMPORT_LOCAL_FILE_PREVIEW_CODES.SELECTION_INVALID,
      'TXT_IMPORT_LOCAL_FILE_PREVIEW_SELECTION_INVALID',
    );
  }

  const filePath = typeof selection.path === 'string' && selection.path.trim()
    ? selection.path.trim()
    : typeof selection.filePath === 'string' && selection.filePath.trim()
      ? selection.filePath.trim()
      : '';
  const fileName = typeof selection.name === 'string' && selection.name.trim()
    ? selection.name.trim()
    : (filePath ? path.basename(filePath) : '');
  const lowerPath = filePath.toLowerCase();
  const lowerName = fileName.toLowerCase();
  if (!filePath || !fileName || (!lowerPath.endsWith('.txt') && !lowerName.endsWith('.txt'))) {
    return buildError(
      TXT_IMPORT_LOCAL_FILE_PREVIEW_CODES.EXTENSION_UNSUPPORTED,
      'TXT_IMPORT_LOCAL_FILE_PREVIEW_EXTENSION_UNSUPPORTED',
    );
  }

  const sizeHint = Number.isFinite(selection.size) && selection.size >= 0
    ? Math.floor(selection.size)
    : null;

  return {
    ok: true,
    value: {
      requestId: normalizeRequestId(requestId),
      path: filePath,
      name: fileName,
      sizeHint,
    },
  };
}

async function createTxtImportLocalFilePreview(input = {}, options = {}) {
  if (!isPlainObject(input)) {
    return buildError(
      TXT_IMPORT_LOCAL_FILE_PREVIEW_CODES.INPUT_INVALID,
      'TXT_IMPORT_LOCAL_FILE_PREVIEW_INPUT_INVALID',
    );
  }

  const forbiddenKey = findForbiddenKey(input);
  if (forbiddenKey) {
    return buildError(
      TXT_IMPORT_LOCAL_FILE_PREVIEW_CODES.INPUT_INVALID,
      'TXT_IMPORT_LOCAL_FILE_PREVIEW_INPUT_FORBIDDEN_FIELD',
      { key: forbiddenKey },
    );
  }
  const extraKeys = unsupportedKeys(input, TXT_IMPORT_LOCAL_FILE_PREVIEW_ALLOWED_INPUT_KEYS);
  if (extraKeys.length > 0) {
    return buildError(
      TXT_IMPORT_LOCAL_FILE_PREVIEW_CODES.INPUT_INVALID,
      'TXT_IMPORT_LOCAL_FILE_PREVIEW_INPUT_UNSUPPORTED_FIELDS',
      { fields: extraKeys },
    );
  }

  const requestId = normalizeRequestId(input.requestId);
  if (requestId.length > TXT_IMPORT_LOCAL_FILE_PREVIEW_MAX_REQUEST_ID_CHARS) {
    return buildError(
      TXT_IMPORT_LOCAL_FILE_PREVIEW_CODES.INPUT_INVALID,
      'TXT_IMPORT_LOCAL_FILE_PREVIEW_REQUEST_ID_TOO_LONG',
      {
        maxChars: TXT_IMPORT_LOCAL_FILE_PREVIEW_MAX_REQUEST_ID_CHARS,
        payloadChars: requestId.length,
      },
    );
  }

  const pickLocalFile = typeof options.pickLocalFile === 'function'
    ? options.pickLocalFile
    : null;
  if (!pickLocalFile) {
    return buildError(
      TXT_IMPORT_LOCAL_FILE_PREVIEW_CODES.PICKER_UNAVAILABLE,
      'TXT_IMPORT_LOCAL_FILE_PREVIEW_PICKER_UNAVAILABLE',
    );
  }
  const readLocalFileBytes = typeof options.readLocalFileBytes === 'function'
    ? options.readLocalFileBytes
    : null;
  if (!readLocalFileBytes) {
    return buildError(
      TXT_IMPORT_LOCAL_FILE_PREVIEW_CODES.READER_UNAVAILABLE,
      'TXT_IMPORT_LOCAL_FILE_PREVIEW_READER_UNAVAILABLE',
    );
  }

  let selectedFile = null;
  try {
    selectedFile = await pickLocalFile({
      requestId,
      maxBytes: TXT_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES,
    });
  } catch {
    return buildError(
      TXT_IMPORT_LOCAL_FILE_PREVIEW_CODES.PICKER_UNAVAILABLE,
      'TXT_IMPORT_LOCAL_FILE_PREVIEW_PICKER_UNAVAILABLE',
    );
  }

  if (selectedFile && selectedFile.canceled === true) {
    return {
      ok: true,
      requestId,
      schemaVersion: TXT_IMPORT_LOCAL_FILE_PREVIEW_SCHEMA,
      type: TXT_IMPORT_LOCAL_FILE_PREVIEW_TYPE,
      status: 'cancelled',
      code: TXT_IMPORT_LOCAL_FILE_PREVIEW_CODES.PICKER_CANCELLED,
      reason: TXT_IMPORT_LOCAL_FILE_PREVIEW_CODES.PICKER_CANCELLED,
      decision: 'cancelled',
      writeEffects: false,
      importPreviewOk: false,
      sourceSummary: null,
      txtImportPreviewPlan: null,
    };
  }

  const selection = validateSelectionDescriptor(selectedFile, requestId);
  if (!selection.ok) return selection;
  if (
    Number.isInteger(selection.value.sizeHint)
    && selection.value.sizeHint > TXT_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES
  ) {
    return buildError(
      TXT_IMPORT_LOCAL_FILE_PREVIEW_CODES.FILE_TOO_LARGE,
      'TXT_IMPORT_LOCAL_FILE_PREVIEW_FILE_TOO_LARGE',
      { maxBytes: TXT_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES },
    );
  }

  let rawBytes = null;
  try {
    rawBytes = await readLocalFileBytes(selection.value, {
      requestId,
      maxBytes: TXT_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES,
    });
  } catch (error) {
    return buildError(
      typeof error?.code === 'string' && error.code
        ? error.code
        : TXT_IMPORT_LOCAL_FILE_PREVIEW_CODES.READ_FAILED,
      typeof error?.reason === 'string' && error.reason
        ? error.reason
        : 'TXT_IMPORT_LOCAL_FILE_PREVIEW_READ_FAILED',
      isPlainObject(error?.details) ? error.details : undefined,
    );
  }

  const fileBytes = Buffer.isBuffer(rawBytes) ? rawBytes : Buffer.from(rawBytes || []);
  if (fileBytes.length === 0) {
    return buildError(
      TXT_IMPORT_LOCAL_FILE_PREVIEW_CODES.BYTES_INVALID,
      'TXT_IMPORT_LOCAL_FILE_PREVIEW_BYTES_EMPTY',
    );
  }
  if (fileBytes.length > TXT_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES) {
    return buildError(
      TXT_IMPORT_LOCAL_FILE_PREVIEW_CODES.FILE_TOO_LARGE,
      'TXT_IMPORT_LOCAL_FILE_PREVIEW_FILE_TOO_LARGE',
      { maxBytes: TXT_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES },
    );
  }

  const decoded = decodeUtf8TextStrict(fileBytes);
  if (!decoded.ok) return decoded;

  const previewPlan = buildTxtImportPreviewPlan({
    sourceName: selection.value.name,
    text: decoded.value.text,
    byteLength: fileBytes.length,
    hasUtf8Bom: decoded.value.hasUtf8Bom,
  });
  rememberTxtImportPreviewPlanAdmission(previewPlan);

  const sourceSummary = {
    sourceName: previewPlan.source.sourceName,
    encoding: previewPlan.source.encoding,
    hasUtf8Bom: previewPlan.source.hasUtf8Bom === true,
    byteLength: previewPlan.source.byteLength,
    textLength: previewPlan.source.textLength,
    lineCount: previewPlan.source.lineCount,
    textHash: previewPlan.source.textHash,
  };

  return {
    ok: true,
    requestId,
    schemaVersion: TXT_IMPORT_LOCAL_FILE_PREVIEW_SCHEMA,
    type: TXT_IMPORT_LOCAL_FILE_PREVIEW_TYPE,
    status: 'preview',
    code: TXT_IMPORT_LOCAL_FILE_PREVIEW_CODES.READY,
    reason: TXT_IMPORT_LOCAL_FILE_PREVIEW_CODES.READY,
    decision: 'preview',
    writeEffects: false,
    importPreviewOk: true,
    sourceSummary,
    txtImportPreviewPlan: previewPlan,
  };
}

module.exports = {
  TXT_IMPORT_LOCAL_FILE_PREVIEW_SCHEMA,
  TXT_IMPORT_LOCAL_FILE_PREVIEW_TYPE,
  TXT_IMPORT_PREVIEW_SCHEMA,
  TXT_IMPORT_PREVIEW_TYPE,
  TXT_IMPORT_PREVIEW_READY_CODE,
  TXT_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES,
  TXT_IMPORT_LOCAL_FILE_PREVIEW_MAX_REQUEST_ID_CHARS,
  createTxtImportLocalFilePreview,
  rememberTxtImportPreviewPlanAdmission,
  isTxtImportPreviewPlanAdmitted,
  recomputeTxtImportPreviewHash,
  normalizeText,
  shortHash,
  stableStringify,
};
