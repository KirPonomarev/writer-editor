const path = require('node:path');
const { pathToFileURL } = require('node:url');

const DOCX_IMPORT_LOCAL_FILE_PREVIEW_SCHEMA = 'revision-bridge.docx-import-local-file-preview.v1';
const DOCX_IMPORT_LOCAL_FILE_PREVIEW_TYPE = 'docx.import.localFilePreview';
const DOCX_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES = 16 * 1024 * 1024;
const DOCX_IMPORT_LOCAL_FILE_PREVIEW_MAX_REQUEST_ID_CHARS = 120;
const DOCX_IMPORT_LOCAL_FILE_PREVIEW_ALLOWED_INPUT_KEYS = new Set(['requestId']);
const DOCX_IMPORT_LOCAL_FILE_PREVIEW_FORBIDDEN_KEYS = new Set([
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

const DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES = Object.freeze({
  READY: 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_READY',
  CONTENT_BLOCKED: 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_CONTENT_BLOCKED',
  IMPORT_BLOCKED: 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_IMPORT_BLOCKED',
  INPUT_INVALID: 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_INPUT_INVALID',
  PICKER_UNAVAILABLE: 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_PICKER_UNAVAILABLE',
  PICKER_CANCELLED: 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_PICKER_CANCELLED',
  SELECTION_INVALID: 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_SELECTION_INVALID',
  EXTENSION_UNSUPPORTED: 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_EXTENSION_UNSUPPORTED',
  FILE_TOO_LARGE: 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_FILE_TOO_LARGE',
  READER_UNAVAILABLE: 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_READER_UNAVAILABLE',
  READ_FAILED: 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_READ_FAILED',
  BYTES_INVALID: 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_BYTES_INVALID',
  BRIDGE_UNAVAILABLE: 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_BRIDGE_UNAVAILABLE',
  CONTENT_REPORT_INVALID: 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_CONTENT_REPORT_INVALID',
  IMPORT_PLAN_INVALID: 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_IMPORT_PLAN_INVALID',
  OUTPUT_FORBIDDEN: 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_OUTPUT_FORBIDDEN',
});

const REVISION_BRIDGE_MODULE_PATH = path.join(__dirname, '..', 'io', 'revisionBridge', 'index.mjs');

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneJsonSafe(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function normalizeRequestId(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : 'docx-import-local-file-preview-request';
}

function buildError(code, reason, details = undefined) {
  const error = { code, reason };
  if (isPlainObject(details) && Object.keys(details).length > 0) {
    error.details = cloneJsonSafe(details);
  }
  return { ok: false, error };
}

function copyAllowedFields(source, allowedKeys) {
  if (!isPlainObject(source)) return source;
  const result = {};
  for (const key of allowedKeys) {
    if (source[key] !== undefined) result[key] = cloneJsonSafe(source[key]);
  }
  return result;
}

function sanitizeDiagnostics(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => copyAllowedFields(item, [
      'code',
      'severity',
      'category',
      'message',
      'field',
      'entryId',
      'sourceCode',
      'sourcePart',
      'tagName',
      'paragraphIndex',
      'numId',
      'ilvl',
      'listKey',
      'actual',
      'limit',
      'feature',
      'location',
      'sourceProperty',
      'transformation',
    ]))
    .filter(isPlainObject);
}

function sanitizeEvidence(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => copyAllowedFields(item, [
      'kind',
      'entryId',
      'sourceCode',
      'sourcePart',
      'byteSize',
      'compressedSize',
      'paragraphCount',
      'textLength',
      'textHash',
      'contentPreviewHash',
      'mode',
      'sceneStrategy',
      'entryCount',
      'contentTextHash',
      'itemCount',
    ]))
    .filter(isPlainObject);
}

// Semantic validation only: the temporary Core document/IDs are discarded.
// Actual generic-import identity is still minted by the existing plan builder.
function copyValidatedDocxUserBookmarkInventory(contentPreview) {
  if (!contentPreview || typeof contentPreview !== 'object') return null;
  const field = Object.getOwnPropertyDescriptor(contentPreview, 'userBookmarkInventory');
  const fail = () => { throw Object.assign(new Error('DOCX_USER_BOOKMARK_INVENTORY_INVALID'), {code:'DOCX_USER_BOOKMARK_INVENTORY_INVALID'}); };
  if (field && !Object.hasOwn(field, 'value')) fail();
  if (!field || field.value == null) return null;
  const inventory = field.value;
  let nodes = 0, characters = 0;
  const raw = (value, depth = 0) => {
    if (++nodes > 100000 || depth > 12) fail();
    if (value === null || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return;
    if (typeof value === 'string') { characters += value.length; if (characters > 10 * 1024 * 1024) fail(); return; }
    if (!value || typeof value !== 'object'
      || ![Object.prototype, Array.prototype, null].includes(Object.getPrototypeOf(value))) fail();
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of Reflect.ownKeys(value)) {
      if (Array.isArray(value) && key === 'length') continue;
      if (typeof key !== 'string' || !Object.hasOwn(descriptors[key], 'value') || !descriptors[key].enumerable) fail();
      raw(descriptors[key].value, depth + 1);
    }
  };
  raw(inventory);
  const paragraphField = Object.getOwnPropertyDescriptor(contentPreview, 'paragraphs');
  if (!paragraphField || !Object.hasOwn(paragraphField, 'value')
    || !Array.isArray(paragraphField.value) || paragraphField.value.length > 10000) fail();
  const content = [];
  for (let index = 0; index < paragraphField.value.length; index++) {
    const item = Object.getOwnPropertyDescriptor(paragraphField.value, String(index));
    if (!item || !Object.hasOwn(item, 'value') || !item.value || typeof item.value !== 'object') fail();
    const text = Object.getOwnPropertyDescriptor(item.value, 'text');
    if (!text || !Object.hasOwn(text, 'value') || typeof text.value !== 'string') fail();
    content.push({type:'paragraph', content:text.value ? [{type:'text',text:text.value}] : []});
  }
  require('../core/word-user-bookmarks-v1.cjs').importInventory({type:'doc',content}, inventory,
    'docx-import-preview-inventory-validation');
  return cloneJsonSafe(inventory);
}

function sanitizeContentPreviewReport(report, options = {}) {
  const userBookmarkInventory = copyValidatedDocxUserBookmarkInventory(report?.contentPreview);
  if (!isPlainObject(report)) return null;
  return {
    ok: report.ok === true,
    schemaVersion: typeof report.schemaVersion === 'string' ? report.schemaVersion : '',
    type: typeof report.type === 'string' ? report.type : '',
    status: typeof report.status === 'string' ? report.status : 'blocked',
    code: typeof report.code === 'string' ? report.code : DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.CONTENT_REPORT_INVALID,
    reason: typeof report.reason === 'string' ? report.reason : DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.CONTENT_REPORT_INVALID,
    decision: typeof report.decision === 'string' ? report.decision : 'blocked',
    diagnostics: sanitizeDiagnostics(report.diagnostics),
    evidence: sanitizeEvidence(report.evidence),
    budgets: isPlainObject(report.budgets)
      ? copyAllowedFields(report.budgets, [
          'maxMainDocumentBytes',
          'maxParagraphs',
          'maxTextChars',
          'maxDiagnostics',
        ])
      : null,
    preflightSummary: isPlainObject(report.preflightSummary)
      ? copyAllowedFields(report.preflightSummary, [
          'status',
          'decision',
          'code',
          'reason',
          'gatePass',
          'packageClassification',
          'partPolicyDecision',
          'parserCandidateOnly',
        ])
      : null,
    contentPreview: isPlainObject(report.contentPreview)
      ? {
          sourcePart: report.contentPreview.sourcePart,
          ...(userBookmarkInventory ? {userBookmarkInventory} : {}),
          ...(report.contentPreview.wordDefaultTabStop!==undefined?{wordDefaultTabStop:report.contentPreview.wordDefaultTabStop}:{}),
          ...(report.contentPreview.wordSections ? { wordSections: cloneJsonSafe(report.contentPreview.wordSections) } : {}),
          ...(report.contentPreview.wordStories ? { wordStories: cloneJsonSafe(report.contentPreview.wordStories) } : {}),
          ...(isPlainObject(report.contentPreview.pendingRevisionDocument) ? { pendingRevisionDocument: cloneJsonSafe(report.contentPreview.pendingRevisionDocument) } : {}),
          ...(Array.isArray(report.contentPreview.manuscriptNotes) ? { manuscriptNotes: cloneJsonSafe(report.contentPreview.manuscriptNotes) } : {}),
          ...(Array.isArray(report.contentPreview.mediaParts) ? { mediaParts: [...report.contentPreview.mediaParts] } : {}),
          ...(Array.isArray(report.contentPreview.genericComments) ? { genericComments: cloneJsonSafe(report.contentPreview.genericComments) } : {}),
          ...(Array.isArray(report.contentPreview.commentNormalizationLedger) ? { commentNormalizationLedger: cloneJsonSafe(report.contentPreview.commentNormalizationLedger) } : {}),
          paragraphCount: report.contentPreview.paragraphCount,
          textLength: report.contentPreview.textLength,
          textHash: report.contentPreview.textHash,
          paragraphs: Array.isArray(report.contentPreview.paragraphs)
            ? report.contentPreview.paragraphs
              .map((paragraph) => copyAllowedFields(paragraph, [
                'order',
                'sourcePart',
                'text',
                'textHash',
                'charCount',
                'inlineRuns',
                'typedBreaks',
                'headingLevel',
                'textAlign',
                'wordParagraphSpacing', 'wordParagraphIndent', 'wordParagraphTabs',
                'wordParagraphMarkLanguage', 'wordParagraphMarkTypography',
                'list',
                ...(options.novelImport === true ? ['listContinuationLevel','sectionBreakType','sectionBreakTypeImplicit'] : []),
                'blockKind',
                'blockquoteDepth',
                'table',
                'media',
              ]))
              .filter(isPlainObject)
            : [],
        }
      : null,
    // GENERIC-01 (G1/G6): full artifact identity + carrier classification.
    sourceArtifactSha256: typeof report.sourceArtifactSha256 === 'string'
      ? report.sourceArtifactSha256
      : null,
    carrierIgnored: isPlainObject(report.carrierIgnored) && report.carrierIgnored.ignored === true
      ? {
        ignored: true,
        reason: typeof report.carrierIgnored.reason === 'string' ? report.carrierIgnored.reason : '',
        tokenDetected: report.carrierIgnored.tokenDetected === true,
      }
      : null,
    parse: isPlainObject(report.parse)
      ? copyAllowedFields(report.parse, [
          'attempted',
          'completed',
        ])
      : null,
  };
}

function sanitizeImportPreviewPlan(plan) {
  if (!isPlainObject(plan)) return null;
  return {
    ok: plan.ok === true,
    schemaVersion: typeof plan.schemaVersion === 'string' ? plan.schemaVersion : '',
    type: typeof plan.type === 'string' ? plan.type : '',
    status: typeof plan.status === 'string' ? plan.status : 'blocked',
    code: typeof plan.code === 'string' ? plan.code : DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.IMPORT_PLAN_INVALID,
    reason: typeof plan.reason === 'string' ? plan.reason : DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.IMPORT_PLAN_INVALID,
    decision: typeof plan.decision === 'string' ? plan.decision : 'blocked',
    writeEffects: plan.writeEffects === false ? false : null,
    diagnostics: sanitizeDiagnostics(plan.diagnostics),
    evidence: sanitizeEvidence(plan.evidence),
    budgets: isPlainObject(plan.budgets)
      ? copyAllowedFields(plan.budgets, [
          'maxCandidateScenes',
          'maxParagraphs',
          'maxTextChars',
          'maxDiagnostics',
          'maxLossItems',
        ])
      : null,
    source: isPlainObject(plan.source)
      ? copyAllowedFields(plan.source, [
          'schemaVersion',
          'type',
          'code',
          'contentPreviewHash',
          'sourcePart',
          'paragraphCount',
          'textLength',
          'textHash',
          'sourceArtifactSha256',
          'candidateContentSha256',
        ])
      : null,
    candidateCreatePlan: isPlainObject(plan.candidateCreatePlan)
      ? {
          mode: plan.candidateCreatePlan.mode,
          sceneStrategy: plan.candidateCreatePlan.sceneStrategy,
          entryCount: plan.candidateCreatePlan.entryCount,
          ...(plan.candidateCreatePlan.sceneStrategy === 'word-novel-root-partitions' ? {
            sourceCandidate: cloneJsonSafe(plan.candidateCreatePlan.sourceCandidate),
            policy: cloneJsonSafe(plan.candidateCreatePlan.policy),cohortDigest:plan.candidateCreatePlan.cohortDigest,
          } : {}),
          entries: Array.isArray(plan.candidateCreatePlan.entries)
            ? plan.candidateCreatePlan.entries
              .map((entry) => {
                if (!isPlainObject(entry)) return null;
                return {
                  sceneId: entry.sceneId,
                  kind: entry.kind,
                  title: entry.title,
                  content: entry.content,
                  ...(entry.partition !== undefined ? {partition:cloneJsonSafe(entry.partition)} : {}),
                  ...(entry.comments !== undefined ? { comments: cloneJsonSafe(entry.comments) } : {}),
                  ...(entry.notes !== undefined ? { notes: cloneJsonSafe(entry.notes) } : {}),
                  contentTextHash: entry.contentTextHash,
                  candidateContentSha256: typeof entry.candidateContentSha256 === 'string'
                    ? entry.candidateContentSha256
                    : null,
                  source: isPlainObject(entry.source)
                    ? {
                        schemaVersion: entry.source.schemaVersion,
                        type: entry.source.type,
                        sourcePart: entry.source.sourcePart,
                        paragraphRange: isPlainObject(entry.source.paragraphRange)
                          ? copyAllowedFields(entry.source.paragraphRange, ['start', 'end'])
                          : null,
                        paragraphCount: entry.source.paragraphCount,
                        textHash: entry.source.textHash,
                      }
                    : null,
                };
              })
              .filter(isPlainObject)
            : [],
        }
      : null,
    lossReport: isPlainObject(plan.lossReport)
      ? {
          schemaVersion: plan.lossReport.schemaVersion,
          mode: plan.lossReport.mode,
          itemCount: plan.lossReport.itemCount,
          items: Array.isArray(plan.lossReport.items)
            ? plan.lossReport.items
              .map((item) => copyAllowedFields(item, [
                'code',
                'severity',
                'category',
                'message',
                'sourceCode',
                'sourcePart',
                'tagName',
                'feature',
                'location',
                'sourceProperty',
                'paragraphIndex',
                'transformation',
                'normalizationLedger',
              ]))
              .filter(isPlainObject)
            : [],
        }
      : null,
    // GENERIC-01 (G6): carrier-ignored classification on the preview plan.
    carrierIgnored: isPlainObject(plan.carrierIgnored) && plan.carrierIgnored.ignored === true
      ? {
        ignored: true,
        reason: typeof plan.carrierIgnored.reason === 'string' ? plan.carrierIgnored.reason : '',
        tokenDetected: plan.carrierIgnored.tokenDetected === true,
      }
      : null,
    previewHash: typeof plan.previewHash === 'string' ? plan.previewHash : '',
  };
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
    if (DOCX_IMPORT_LOCAL_FILE_PREVIEW_FORBIDDEN_KEYS.has(key)) {
      return nextPath.join('.');
    }
    const nested = findForbiddenKey(value[key], nextPath);
    if (nested) return nested;
  }
  return '';
}

function normalizeSelectionDescriptor(selection) {
  if (!isPlainObject(selection)) return null;
  const pickedPath = typeof selection.path === 'string' && selection.path.trim()
    ? selection.path.trim()
    : typeof selection.filePath === 'string' && selection.filePath.trim()
      ? selection.filePath.trim()
      : '';
  const fileName = typeof selection.name === 'string' && selection.name.trim()
    ? selection.name.trim()
    : typeof selection.fileName === 'string' && selection.fileName.trim()
      ? selection.fileName.trim()
      : pickedPath
        ? path.basename(pickedPath)
        : '';
  const sizeHint = Number.isFinite(selection.size) && selection.size >= 0
    ? Math.floor(selection.size)
    : Number.isFinite(selection.byteLength) && selection.byteLength >= 0
      ? Math.floor(selection.byteLength)
      : null;
  return {
    original: selection,
    fileName,
    extension: path.extname(fileName || pickedPath).toLowerCase(),
    sizeHint,
  };
}

function toByteBuffer(value) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (value instanceof ArrayBuffer) return Buffer.from(new Uint8Array(value));
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  return null;
}

async function loadRevisionBridgeModuleDefault() {
  return import(pathToFileURL(REVISION_BRIDGE_MODULE_PATH).href);
}

function buildEnvelope(input, contentPreviewReport, importPreviewPlan) {
  const requestId = normalizeRequestId(input?.requestId);
  const docxContentPreviewReport = sanitizeContentPreviewReport(contentPreviewReport);
  const docxImportPreviewPlan = sanitizeImportPreviewPlan(importPreviewPlan);
  const importPreviewOk = docxImportPreviewPlan?.ok === true;
  const status = importPreviewOk ? 'preview' : 'blocked';
  const code = importPreviewOk
    ? DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.READY
    : docxImportPreviewPlan
      ? DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.IMPORT_BLOCKED
      : DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.CONTENT_BLOCKED;
  const reason = importPreviewOk
    ? DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.READY
    : typeof docxImportPreviewPlan?.code === 'string' && docxImportPreviewPlan.code
      ? docxImportPreviewPlan.code
      : typeof docxContentPreviewReport?.code === 'string' && docxContentPreviewReport.code
        ? docxContentPreviewReport.code
        : DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.CONTENT_BLOCKED;
  const envelope = {
    ok: true,
    requestId,
    schemaVersion: DOCX_IMPORT_LOCAL_FILE_PREVIEW_SCHEMA,
    type: DOCX_IMPORT_LOCAL_FILE_PREVIEW_TYPE,
    status,
    code,
    reason,
    decision: importPreviewOk ? 'preview' : 'blocked',
    writeEffects: false,
    contentPreviewOk: docxContentPreviewReport?.ok === true,
    importPreviewOk,
    docxContentPreviewReport,
    docxImportPreviewPlan: docxImportPreviewPlan || null,
  };
  const forbiddenKey = findForbiddenKey(envelope);
  if (forbiddenKey) {
    return buildError(
      'E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_FORBIDDEN_OUTPUT',
      DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.OUTPUT_FORBIDDEN,
      { key: forbiddenKey },
    );
  }
  return envelope;
}

function validateInput(input) {
  if (!isPlainObject(input)) {
    return buildError(
      'E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_INPUT_INVALID',
      DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.INPUT_INVALID,
      { field: 'input' },
    );
  }
  const unsupportedKeys = Object.keys(input)
    .filter((key) => !DOCX_IMPORT_LOCAL_FILE_PREVIEW_ALLOWED_INPUT_KEYS.has(key))
    .sort();
  if (unsupportedKeys.length > 0) {
    return buildError(
      'E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_INPUT_INVALID',
      DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.INPUT_INVALID,
      { fields: unsupportedKeys },
    );
  }
  if (input.requestId !== undefined && typeof input.requestId !== 'string') {
    return buildError(
      'E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_INPUT_INVALID',
      DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.INPUT_INVALID,
      { field: 'requestId' },
    );
  }
  if (
    typeof input.requestId === 'string'
    && input.requestId.trim().length > DOCX_IMPORT_LOCAL_FILE_PREVIEW_MAX_REQUEST_ID_CHARS
  ) {
    return buildError(
      'E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_INPUT_INVALID',
      DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.INPUT_INVALID,
      {
        field: 'requestId',
        maxChars: DOCX_IMPORT_LOCAL_FILE_PREVIEW_MAX_REQUEST_ID_CHARS,
      },
    );
  }
  return { ok: true };
}

async function createDocxImportLocalFilePreview(input = {}, options = {}) {
  const validatedInput = validateInput(input);
  if (!validatedInput.ok) return validatedInput;

  const pickLocalFile = typeof options.pickLocalFile === 'function'
    ? options.pickLocalFile
    : null;
  if (!pickLocalFile) {
    return buildError(
      'E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_PICKER_UNAVAILABLE',
      DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.PICKER_UNAVAILABLE,
    );
  }

  const readLocalFileBytes = typeof options.readLocalFileBytes === 'function'
    ? options.readLocalFileBytes
    : null;
  if (!readLocalFileBytes) {
    return buildError(
      'E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_READER_UNAVAILABLE',
      DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.READER_UNAVAILABLE,
    );
  }

  let selection = null;
  try {
    selection = await pickLocalFile({
      requestId: normalizeRequestId(input.requestId),
      acceptedExtensions: ['.docx'],
      maxBytes: DOCX_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES,
    });
  } catch {
    return buildError(
      'E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_SELECTION_INVALID',
      DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.SELECTION_INVALID,
    );
  }

  if (selection?.canceled === true || selection?.cancelled === true) {
    return buildError(
      'E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_PICKER_CANCELLED',
      DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.PICKER_CANCELLED,
    );
  }

  const descriptor = normalizeSelectionDescriptor(selection);
  if (!descriptor || !descriptor.fileName) {
    return buildError(
      'E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_SELECTION_INVALID',
      DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.SELECTION_INVALID,
    );
  }
  if (descriptor.extension !== '.docx') {
    return buildError(
      'E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_EXTENSION_UNSUPPORTED',
      DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.EXTENSION_UNSUPPORTED,
      { field: 'extension' },
    );
  }
  if (
    Number.isInteger(descriptor.sizeHint)
    && descriptor.sizeHint > DOCX_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES
  ) {
    return buildError(
      'E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_FILE_TOO_LARGE',
      DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.FILE_TOO_LARGE,
      { maxBytes: DOCX_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES },
    );
  }

  let rawBytes = null;
  try {
    rawBytes = await readLocalFileBytes(selection, {
      requestId: normalizeRequestId(input.requestId),
      maxBytes: DOCX_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES,
    });
  } catch (error) {
    return buildError(
      typeof error?.code === 'string' && error.code
        ? error.code
        : 'E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_READ_FAILED',
      typeof error?.reason === 'string' && error.reason
        ? error.reason
        : DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.READ_FAILED,
      isPlainObject(error?.details) ? error.details : undefined,
    );
  }

  const fileBytes = toByteBuffer(rawBytes);
  if (!fileBytes || fileBytes.length === 0) {
    return buildError(
      'E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_BYTES_INVALID',
      DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.BYTES_INVALID,
    );
  }
  if (fileBytes.length > DOCX_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES) {
    return buildError(
      'E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_FILE_TOO_LARGE',
      DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.FILE_TOO_LARGE,
      { maxBytes: DOCX_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES },
    );
  }

  const loadRevisionBridgeModule = typeof options.loadRevisionBridgeModule === 'function'
    ? options.loadRevisionBridgeModule
    : loadRevisionBridgeModuleDefault;
  let revisionBridge = null;
  try {
    revisionBridge = await loadRevisionBridgeModule();
  } catch {
    return buildError(
      'E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_BRIDGE_UNAVAILABLE',
      DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.BRIDGE_UNAVAILABLE,
    );
  }
  if (
    !revisionBridge
    || typeof revisionBridge.buildDocxContentPreviewFromZipBytes !== 'function'
    || typeof revisionBridge.buildDocxImportPreviewPlanFromContentPreview !== 'function'
  ) {
    return buildError(
      'E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_BRIDGE_UNAVAILABLE',
      DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.BRIDGE_UNAVAILABLE,
    );
  }

  let contentPreviewReport = null;
  try {
    contentPreviewReport = revisionBridge.buildDocxContentPreviewFromZipBytes(options.novelImport === true
      ? {bytes:fileBytes,budgets:options.contentPreviewBudgets} : fileBytes);
  } catch {
    return buildError(
      'E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_CONTENT_REPORT_INVALID',
      DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.CONTENT_REPORT_INVALID,
    );
  }
  try {
    const previewField = Object.getOwnPropertyDescriptor(contentPreviewReport, 'contentPreview');
    if (previewField && !Object.hasOwn(previewField, 'value')) throw Error('DOCX_USER_BOOKMARK_INVENTORY_INVALID');
    copyValidatedDocxUserBookmarkInventory(previewField?.value);
  } catch { return buildError('E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_CONTENT_REPORT_INVALID',
    DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.CONTENT_REPORT_INVALID); }
  const contentForbiddenKey = findForbiddenKey(contentPreviewReport);
  if (contentForbiddenKey) {
    return buildError(
      'E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_FORBIDDEN_OUTPUT',
      DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.OUTPUT_FORBIDDEN,
      { key: `docxContentPreviewReport.${contentForbiddenKey}` },
    );
  }

  let sanitizedContentPreviewReport;
  try { sanitizedContentPreviewReport = sanitizeContentPreviewReport(contentPreviewReport,options); }
  catch { return buildError('E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_CONTENT_REPORT_INVALID',
    DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.CONTENT_REPORT_INVALID); }
  if (!sanitizedContentPreviewReport) {
    return buildError(
      'E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_CONTENT_REPORT_INVALID',
      DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.CONTENT_REPORT_INVALID,
    );
  }

  if (
    sanitizedContentPreviewReport.ok !== true
    || sanitizedContentPreviewReport.status !== 'preview'
    || sanitizedContentPreviewReport.decision !== 'preview'
  ) {
    return buildEnvelope(input, sanitizedContentPreviewReport, null);
  }

  let importPreviewPlan = null;
  try {
    const build = options.novelImport === true && typeof revisionBridge.buildDocxNovelImportPreviewPlanFromContentPreview === 'function'
      ? revisionBridge.buildDocxNovelImportPreviewPlanFromContentPreview : revisionBridge.buildDocxImportPreviewPlanFromContentPreview;
    importPreviewPlan = build(
      sanitizedContentPreviewReport,
    );
  } catch {
    return buildError(
      'E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_IMPORT_PLAN_INVALID',
      DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.IMPORT_PLAN_INVALID,
    );
  }
  const importForbiddenKey = findForbiddenKey(importPreviewPlan);
  if (importForbiddenKey) {
    return buildError(
      'E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_FORBIDDEN_OUTPUT',
      DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.OUTPUT_FORBIDDEN,
      { key: `docxImportPreviewPlan.${importForbiddenKey}` },
    );
  }

  const sanitizedImportPreviewPlan = sanitizeImportPreviewPlan(importPreviewPlan);
  if (!sanitizedImportPreviewPlan || sanitizedImportPreviewPlan.writeEffects !== false) {
    return buildError(
      'E_DOCX_IMPORT_LOCAL_FILE_PREVIEW_IMPORT_PLAN_INVALID',
      DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.IMPORT_PLAN_INVALID,
    );
  }

  return buildEnvelope(input, sanitizedContentPreviewReport, sanitizedImportPreviewPlan);
}

module.exports = {
  DOCX_IMPORT_LOCAL_FILE_PREVIEW_SCHEMA,
  DOCX_IMPORT_LOCAL_FILE_PREVIEW_TYPE,
  DOCX_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES,
  DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES,
  createDocxImportLocalFilePreview,
  copyValidatedDocxUserBookmarkInventory,
};
