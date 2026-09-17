const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { deflateRawSync, inflateRawSync } = require('node:zlib');
const { pathToFileURL } = require('node:url');
const { createDocxActivationRequestDigestGuard } = require('../../src/main/rtkDocxActivationGuards.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MAIN_PATH = path.join(REPO_ROOT, 'src', 'main.js');
const RETURN_INTAKE_WORKER_PATH = path.join(REPO_ROOT, 'src', 'main', 'rtkDocxReturnIntakeWorker.cjs');
const BRIDGE_MODULE_PATH = path.join(REPO_ROOT, 'src', 'io', 'revisionBridge', 'index.mjs');
const GOOGLE_C4_NATIVE_RETURN_FIXTURE_PATH = path.join(
  REPO_ROOT,
  'test',
  'fixtures',
  'revision-bridge',
  'google-c4-native-review-returned.docx',
);
const GOOGLE_C4_NATIVE_RETURN_FIXTURE_PROVENANCE_PATH = path.join(
  REPO_ROOT,
  'test',
  'fixtures',
  'revision-bridge',
  'google-c4-native-review-returned.provenance.json',
);
const GOOGLE_C4_NATIVE_RETURN_FIXTURE_SHA256 = 'f1bb75df191e945aeb2be29eccc4eaf71448195322eac2b31cc5f0ecf1689515';
const GOOGLE_C4_NATIVE_RETURN_ORIGINAL_EXTERNAL_ARTIFACT_SHA256 = '0c746653efce8d874cab50b1c9089124fcd86b58edefd812eb78f0e5142387f4';
const GOOGLE_C4_PR1918_SANITIZED_DERIVATIVE_FIXTURE_PATH = path.join(
  REPO_ROOT,
  'test',
  'fixtures',
  'revision-bridge',
  'google-c4-pr1918-sanitized-derivative-of-physical-return.docx',
);
const GOOGLE_C4_PR1918_SANITIZED_DERIVATIVE_FIXTURE_PROVENANCE_PATH = path.join(
  REPO_ROOT,
  'test',
  'fixtures',
  'revision-bridge',
  'google-c4-pr1918-sanitized-derivative-of-physical-return.docx.provenance.json',
);
const GOOGLE_C4_PR1918_SANITIZED_DERIVATIVE_FIXTURE_SHA256 = '5f806e5eb0325b91e17a947c773f6ee9683dca31cd4e0831a62cd38dd52d67ba';
const GOOGLE_C4_PR1918_EXTERNAL_PHYSICAL_ARTIFACT_SHA256 = 'caf19c22c25a8fa77c928045f40dccb86efcd9bcdfa851f205c7e58a8a6e2a7f';
const GOOGLE_C4_PR1918_SANITIZED_AUTHOR_PSEUDONYM = 'Yalken Reviewer0';
const MUTATE_SECTION_START = '// CONTOUR_01A_REVIEW_MUTATE_PORT_START';
const MUTATE_SECTION_END = '// CONTOUR_01A_REVIEW_MUTATE_PORT_END';
const INTAKE_SECTION_START = '// DOCX_INTAKE_GATE_COMMAND_SURFACE_START';
const INTAKE_SECTION_END = '// DOCX_INTAKE_GATE_COMMAND_SURFACE_END';
const ACTIVATION_SECTION_START = '// DOCX_REVIEW_PREVIEW_SESSION_COMMAND_SURFACE_START';
const ACTIVATION_SECTION_END = '// DOCX_REVIEW_PREVIEW_SESSION_COMMAND_SURFACE_END';

function readMainSource() {
  return fs.readFileSync(MAIN_PATH, 'utf8');
}

function extractMarkedSection(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);
  assert.notEqual(start, -1, `missing marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing marker: ${endMarker}`);
  assert.ok(end > start, `marker order invalid: ${startMarker}`);
  return text.slice(start, end + endMarker.length);
}

function extractMenuCommandHandlersSection(text) {
  const startMarker = 'const MENU_COMMAND_HANDLERS = Object.freeze({';
  const endMarker = '\n\nfunction shouldFailHardOnMenuConfigError';
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start);
  assert.notEqual(start, -1, `missing marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing marker: ${endMarker}`);
  assert.ok(end > start, 'menu command handler markers must be ordered');
  return text.slice(start, end);
}

const MENU_HANDLER_COMPUTED_KEY_GLOBALS = Object.freeze({
  EXPORT_CURRENT_SCENE_TXT_COMMAND_ID: 'cmd.project.exportCurrentSceneTxtV1',
  EXPORT_SELECTED_SCENES_TXT_COMMAND_ID: 'cmd.project.exportSelectedScenesTxtV1',
  EXPORT_ALL_SCENES_TXT_COMMAND_ID: 'cmd.project.exportAllScenesTxtV1',
  EXPORT_PDF_COMMAND_ID: 'cmd.project.exportPdfV1',
  EXPORT_PROJECT_ARCHIVE_COMMAND_ID: 'cmd.project.exportFullArchiveV1',
  IMPORT_PROJECT_ARCHIVE_COMMAND_ID: 'cmd.project.importFullArchiveV1',
  TXT_IMPORT_LOCAL_FILE_PREVIEW_COMMAND_ID: 'cmd.project.txt.previewLocalFile',
  TXT_IMPORT_SAFE_CREATE_COMMAND_ID: 'cmd.project.txt.importSafeCreate',
  TREE_MOVE_COMMAND_ID: 'cmd.project.tree.moveNode',
  METADATA_UPDATE_COMMAND_ID: 'cmd.project.metadata.update',
  NOTES_CREATE_COMMAND_ID: 'cmd.project.notes.create',
  NOTES_UPDATE_COMMAND_ID: 'cmd.project.notes.update',
  NOTES_DELETE_COMMAND_ID: 'cmd.project.notes.delete',
  NOTES_RESTORE_COMMAND_ID: 'cmd.project.notes.restore',
  NOTES_ATTACH_SCENE_COMMAND_ID: 'cmd.project.notes.attachToScene',
  NOTES_CONVERT_SCENE_COMMAND_ID: 'cmd.project.notes.convertToScene',
  REPLACE_SINGLE_SAFE_COMMAND_ID: 'cmd.project.edit.replaceSingleSafe',
  REPLACE_MASS_PREVIEW_COMMAND_ID: 'cmd.project.edit.replaceMassPreview',
  REPLACE_MASS_APPLY_COMMAND_ID: 'cmd.project.edit.replaceMassApply',
  REPLACE_MASS_ROLLBACK_COMMAND_ID: 'cmd.project.edit.replaceMassRollback',
  PROJECT_LIFECYCLE_CREATE_COMMAND_ID: 'cmd.project.lifecycle.create',
  PROJECT_LIFECYCLE_OPEN_COMMAND_ID: 'cmd.project.lifecycle.open',
  PROJECT_LIFECYCLE_CONTINUE_COMMAND_ID: 'cmd.project.lifecycle.continue',
  PROJECT_LIFECYCLE_RENAME_COMMAND_ID: 'cmd.project.lifecycle.rename',
  PROJECT_LIFECYCLE_DUPLICATE_COMMAND_ID: 'cmd.project.lifecycle.duplicate',
  PROJECT_LIFECYCLE_MOVE_LOCATION_COMMAND_ID: 'cmd.project.lifecycle.moveLocation',
  PROJECT_LIFECYCLE_ARCHIVE_COMMAND_ID: 'cmd.project.lifecycle.archive',
  PROJECT_LIFECYCLE_TRASH_COMMAND_ID: 'cmd.project.lifecycle.trash',
  PROJECT_LIFECYCLE_RESTORE_COMMAND_ID: 'cmd.project.lifecycle.restore',
  PROJECT_LIFECYCLE_BACKUP_COMMAND_ID: 'cmd.project.lifecycle.createBackup',
  PROJECT_LIFECYCLE_INTEGRITY_COMMAND_ID: 'cmd.project.lifecycle.inspectIntegrity',
  PROJECT_LIFECYCLE_PERMANENT_DELETE_COMMAND_ID: 'cmd.project.lifecycle.permanentDelete',
  HISTORY_CREATE_CHECKPOINT_COMMAND_ID: 'cmd.project.history.createCheckpoint',
  HISTORY_RESTORE_PREVIEW_COMMAND_ID: 'cmd.project.history.restorePreview',
  HISTORY_RESTORE_APPLY_COMMAND_ID: 'cmd.project.history.restoreApply',
  HISTORY_RESTORE_UNDO_COMMAND_ID: 'cmd.project.history.restoreUndo',
});

const COMMAND_SURFACE_KERNEL_COMMAND_IDS = Object.freeze({
  RTK_REVIEW_APPLY_NON_OVERLAP_TRACKED_REPLACEMENTS: 'cmd.rtk.review.applyNonOverlapTrackedReplacements',
  RTK_REVIEW_APPLY_MULTI_SCENE_NON_OVERLAP_TRACKED_REPLACEMENTS:
    'cmd.rtk.review.applyMultiSceneNonOverlapTrackedReplacements',
  RTK_REVIEW_APPLY_ROOT_COMMENT_RETURN: 'cmd.rtk.review.applyRootCommentReturn',
  RTK_REVIEW_APPLY_COMMENT_LIFECYCLE_RETURN: 'cmd.rtk.review.applyCommentLifecycleReturn',
  RTK_REVIEW_APPLY_MULTI_SCENE_FORMATTING_RETURN: 'cmd.rtk.review.applyMultiSceneFormattingReturn',
  RTK_REVIEW_APPLY_MULTI_SCENE_STRUCTURAL_RETURN: 'cmd.rtk.review.applyMultiSceneStructuralReturn',
});

function cloneJsonSafe(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function isPlainObjectValue(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasReviewSurfacePayload(value) {
  return isPlainObjectValue(value) && Object.keys(value).length > 0;
}

function computeHash(text) {
  return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

function readZipEntryBytes(zipBytes, entryName) {
  const bytes = Buffer.from(zipBytes);
  for (let index = bytes.length - 22; index >= 0; index -= 1) {
    if (bytes.readUInt32LE(index) !== 0x06054b50) continue;
    const centralDirectoryOffset = bytes.readUInt32LE(index + 16);
    const totalEntries = bytes.readUInt16LE(index + 10);
    let offset = centralDirectoryOffset;
    for (let entryIndex = 0; entryIndex < totalEntries; entryIndex += 1) {
      assert.equal(bytes.readUInt32LE(offset), 0x02014b50);
      const method = bytes.readUInt16LE(offset + 10);
      const compressedSize = bytes.readUInt32LE(offset + 20);
      const nameLength = bytes.readUInt16LE(offset + 28);
      const extraLength = bytes.readUInt16LE(offset + 30);
      const commentLength = bytes.readUInt16LE(offset + 32);
      const localHeaderOffset = bytes.readUInt32LE(offset + 42);
      const name = bytes.slice(offset + 46, offset + 46 + nameLength).toString('utf8');
      if (name === entryName) {
        assert.equal(bytes.readUInt32LE(localHeaderOffset), 0x04034b50);
        const localNameLength = bytes.readUInt16LE(localHeaderOffset + 26);
        const localExtraLength = bytes.readUInt16LE(localHeaderOffset + 28);
        const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
        const data = bytes.slice(dataStart, dataStart + compressedSize);
        if (method === 0) return data;
        if (method === 8) return inflateRawSync(data);
        throw new Error(`UNSUPPORTED_TEST_ZIP_METHOD:${method}`);
      }
      offset += 46 + nameLength + extraLength + commentLength;
    }
    break;
  }
  throw new Error(`ZIP_ENTRY_NOT_FOUND:${entryName}`);
}

function readZipEntryText(zipBytes, entryName) {
  return readZipEntryBytes(zipBytes, entryName).toString('utf8');
}

function xmlAuthorAttributeValues(xml) {
  return [...String(xml || '').matchAll(/[A-Za-z0-9_.:-]*author="([^"]*)"/gu)]
    .map((match) => match[1]);
}

async function loadBridge() {
  return import(pathToFileURL(BRIDGE_MODULE_PATH).href);
}

function instantiateDocxReviewPreviewSessionPort(options = {}) {
  const mainSource = readMainSource();
  const mutateSection = extractMarkedSection(mainSource, MUTATE_SECTION_START, MUTATE_SECTION_END);
  const intakeSection = extractMarkedSection(mainSource, INTAKE_SECTION_START, INTAKE_SECTION_END);
  const activationSection = extractMarkedSection(mainSource, ACTIVATION_SECTION_START, ACTIVATION_SECTION_END);
  const menuCommandHandlersSection = extractMenuCommandHandlersSection(mainSource);
  const runtimeCommands = [];
  const sandbox = {
    activeDocxActivationRequestDigestGuard: options.activeDocxActivationRequestDigestGuard
      || createDocxActivationRequestDigestGuard(),
    activeReviewSessionStore: null,
    activeReviewSessionLifecycle: 'passive',
    autoSaveInProgress: false,
    currentFilePath: '/project/roman/imported/scene-1.txt',
    currentReviewSurfacePayload: {},
    currentReviewSurfacePayloadSource: 'none',
    currentReviewSurfacePayloadContentHash: '',
    isDirty: false,
    crypto,
    Buffer,
    COMMAND_SURFACE_KERNEL_COMMAND_IDS,
    ...MENU_HANDLER_COMPUTED_KEY_GLOBALS,
    cloneJsonSafe,
    computeHash,
    fs: options.fs || { readFile: async () => 'Anchored text' },
    fsSync: options.fsSync || {
      existsSync: () => false,
      lstatSync: () => ({ isSymbolicLink: () => false, isFile: () => false }),
      readFileSync: () => 'Anchored text',
    },
    getDocumentContextFromPath: options.getDocumentContextFromPath || (() => ({ kind: 'scene' })),
    getProjectRootPath: options.getProjectRootPath || (() => '/project'),
    getProjectRelativeFilePath: options.getProjectRelativeFilePath || (() => 'roman/imported/scene-1.txt'),
    hasReviewSurfacePayload,
    isAllowedFilePath: options.isAllowedFilePath || (() => true),
    isPlainObjectValue,
    isPathInsideBoundary: options.isPathInsideBoundary || (() => true),
    loadRevisionBridgeModule: typeof options.loadRevisionBridgeModule === 'function'
      ? options.loadRevisionBridgeModule
      : loadBridge,
    dispatchCommandSurfaceKernel: typeof options.dispatchCommandSurfaceKernel === 'function'
      ? options.dispatchCommandSurfaceKernel
      : async () => ({ ok: false, error: { code: 'E_TEST_COMMAND_HANDLER_MISSING', reason: 'TEST_COMMAND_HANDLER_MISSING' } }),
    module: { exports: {} },
    exports: {},
    path,
    readReviewExactTextApplyProjectBinding: options.readReviewExactTextApplyProjectBinding || (async () => ({
      ok: true,
      projectId: 'project-1',
      manifestPath: '/project/manifest.json',
      projectRoot: '/project',
    })),
    verifyFullManuscriptCurrentSceneBindings: options.verifyFullManuscriptCurrentSceneBindings
      || (() => ({ ok: true, status: 'verified', sceneCount: 1, sceneReadback: [] })),
    runtimeCommands,
    sendCanonicalRuntimeCommand(commandId, payload = {}, legacyCommand = '') {
      runtimeCommands.push({ commandId, payload, legacyCommand });
      return true;
    },
  };
  vm.runInNewContext(
    `${mutateSection}
${intakeSection}
${activationSection}
const MENU_PRESENTATION_COMMAND_CLASSIC = 'cmd.menu.presentation.classic';
const MENU_PRESENTATION_COMMAND_COMPACT = 'cmd.menu.presentation.compact';
const MENU_LOCALE_COMMAND_BASE = 'cmd.menu.locale.base';
const MENU_LOCALE_COMMAND_RU = 'cmd.menu.locale.ru';
const MENU_LOCALE_COMMAND_EN = 'cmd.menu.locale.en';
const MENU_CUSTOMIZATION_COMMAND_RESET = 'cmd.menu.customization.reset';
const MENU_CUSTOMIZATION_COMMAND_TOGGLE_VISIBILITY = 'cmd.menu.customization.toggleVisibility';
const MENU_CUSTOMIZATION_COMMAND_MOVE_EARLIER = 'cmd.menu.customization.moveEarlier';
const MENU_CUSTOMIZATION_COMMAND_MOVE_LATER = 'cmd.menu.customization.moveLater';
const __testHandleDocxReviewPreviewSessionActivationCommandSurface = handleDocxReviewPreviewSessionActivationCommandSurface;
handleDocxReviewPreviewSessionActivationCommandSurface = (payload = {}, testOptions = {}) => (
  __testHandleDocxReviewPreviewSessionActivationCommandSurface(payload, {
    allowInlineDocxReturnIntakeParserForTests: true,
    ...testOptions,
  })
);
${menuCommandHandlersSection}
module.exports = {
  DOCX_REVIEW_PREVIEW_SESSION_COMMAND_ID,
  MENU_COMMAND_HANDLERS,
  runtimeCommands,
  handleDocxReviewPreviewSessionActivationCommandSurface,
  handleReviewSurfaceApplyExactTextChangeCommandSurface,
  handleReviewSurfaceApplyFullManuscriptExactTextReturnCommandSurface,
  getState() {
    return {
      activeReviewSessionStore,
      activeReviewSessionLifecycle,
      currentReviewSurfacePayload,
      currentReviewSurfacePayloadSource,
      currentReviewSurfacePayloadContentHash,
    };
  },
};`,
    sandbox,
    { filename: MAIN_PATH },
  );
  return sandbox.module.exports;
}

function asciiBytes(value) {
  return Buffer.from(value, 'ascii');
}

function utf8Bytes(value) {
  return Buffer.from(value, 'utf8');
}

function normalizeEntry(entry) {
  const body = Buffer.isBuffer(entry.body)
    ? entry.body
    : utf8Bytes(typeof entry.body === 'string' ? entry.body : '');
  const method = entry.method ?? 0;
  const compressedBody = method === 8 ? deflateRawSync(body) : body;
  return {
    name: entry.name,
    method,
    body,
    compressedBody,
    byteSize: entry.byteSize ?? body.length,
    compressedSize: entry.compressedSize ?? compressedBody.length,
  };
}

// CRC32 (table-based, IEEE polynomial) — ZIP CRC is computed over the
// UNCOMPRESSED body, so we crc32 over normalized.body for every entry
// regardless of storage method. Copied from the ZIP-01 evidence table-impl.
const CRC32_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  return value >>> 0;
});

function crc32Bytes(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function localRecord(entry, offset) {
  const normalized = normalizeEntry(entry);
  const name = asciiBytes(normalized.name);
  const header = Buffer.alloc(30 + name.length);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(entry.flags ?? 0, 6);
  header.writeUInt16LE(normalized.method, 8);
  header.writeUInt32LE(crc32Bytes(normalized.body), 14);
  header.writeUInt32LE(normalized.compressedSize, 18);
  header.writeUInt32LE(normalized.byteSize, 22);
  header.writeUInt16LE(name.length, 26);
  name.copy(header, 30);
  return {
    ...normalized,
    offset,
    bytes: Buffer.concat([header, normalized.compressedBody]),
  };
}

function centralRecord(entry) {
  const name = asciiBytes(entry.name);
  const header = Buffer.alloc(46 + name.length);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(entry.flags ?? 0, 8);
  header.writeUInt16LE(entry.method, 10);
  header.writeUInt32LE(crc32Bytes(entry.body), 16);
  header.writeUInt32LE(entry.compressedSize, 20);
  header.writeUInt32LE(entry.byteSize, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt32LE(entry.offset, 42);
  name.copy(header, 46);
  return header;
}

function zipFixture(entries) {
  const locals = [];
  let offset = 0;
  for (const entry of entries) {
    const local = localRecord(entry, offset);
    locals.push(local);
    offset += local.bytes.length;
  }
  const central = Buffer.concat(locals.map((entry) => centralRecord(entry)));
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(locals.length, 8);
  end.writeUInt16LE(locals.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([Buffer.concat(locals.map((entry) => entry.bytes)), central, end]);
}

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const W14_NS = 'http://schemas.microsoft.com/office/word/2010/wordml';

function documentXml(body, extraNamespaces = '') {
  return `<w:document xmlns:w="${W_NS}"${extraNamespaces}><w:body>${body}</w:body></w:document>`;
}

function paragraphXml(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function cleanDocxZip(body = '<w:p/>', extraEntries = [], options = {}) {
  return zipFixture([
    {
      name: 'word/document.xml',
      method: 8,
      body: documentXml(body, options.extraNamespaces),
    },
    ...extraEntries,
  ]);
}

function docxWithAnchoredComment(extraBody = '', extraEntries = []) {
  return cleanDocxZip([
    '<w:p>',
    '<w:commentRangeStart w:id="0"/>',
    '<w:r><w:t>Anchored text</w:t></w:r>',
    '<w:commentRangeEnd w:id="0"/>',
    '<w:r><w:commentReference w:id="0"/></w:r>',
    '</w:p>',
    extraBody,
  ].join(''), [
    {
      name: 'word/comments.xml',
      method: 8,
      body: [
        `<w:comments xmlns:w="${W_NS}">`,
        '<w:comment w:id="0" w:author="reviewer" w:date="2026-04-24T08:00:00.000Z">',
        '<w:p><w:r><w:t>Resolve this comment.</w:t></w:r></w:p>',
        '</w:comment>',
        '</w:comments>',
      ].join(''),
    },
    ...extraEntries,
  ]);
}

function docxWithCommentAndBody(body, commentBody = 'Resolve this comment.', extraEntries = [], options = {}) {
  return cleanDocxZip(body, [
    {
      name: 'word/comments.xml',
      method: 8,
      body: [
        `<w:comments xmlns:w="${W_NS}">`,
        '<w:comment w:id="0" w:author="reviewer">',
        `<w:p><w:r><w:t>${commentBody}</w:t></w:r></w:p>`,
        '</w:comment>',
        '</w:comments>',
      ].join(''),
    },
    ...extraEntries,
  ], options);
}

function toPayload(bytes, overrides = {}) {
  return {
    requestId: 'docx-review-preview-session-request',
    bufferSource: Buffer.from(bytes).toString('base64'),
    ...overrides,
  };
}

function collectKeys(value, pathParts = []) {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectKeys(item, pathParts.concat(String(index))));
  }
  if (!value || typeof value !== 'object') return [];
  return Object.keys(value).flatMap((key) => (
    [pathParts.concat(key).join('.')].concat(collectKeys(value[key], pathParts.concat(key)))
  ));
}

function assertNoWriteReceiptsOrApplyAuthority(value) {
  const keys = collectKeys(value);
  for (const forbidden of [
    'receipt',
    'recovery',
    'writeReceipt',
    'importReceipt',
    'exportReceipt',
  ]) {
    assert.equal(keys.some((key) => key === forbidden || key.endsWith(`.${forbidden}`)), false, forbidden);
  }
}

function reviewContext(overrides = {}) {
  return {
    ok: true,
    projectId: 'project-1',
    projectRoot: '/project',
    baselineHash: 'baseline-1',
    currentBaselineHash: 'baseline-1',
    targetScope: {
      type: 'scene',
      id: 'roman/imported/scene-1.txt',
    },
    createdAt: '2026-04-24T08:00:00.000Z',
    ...overrides,
  };
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const c05CryptoPort = {
  sha256Text(value) {
    return crypto.createHash('sha256').update(Buffer.from(String(value || ''), 'utf8')).digest('hex');
  },
  sha256Json(value) {
    return `sha256:${this.sha256Text(stableJson(value))}`;
  },
  hmacSha256Json(value, secret) {
    return `hmac-sha256:${crypto
      .createHmac('sha256', String(secret || ''))
      .update(stableJson(value), 'utf8')
      .digest('hex')}`;
  },
  hmacSha256Text(value, secret) {
    return `hmac-sha256:${crypto
      .createHmac('sha256', String(secret || ''))
      .update(String(value || ''), 'utf8')
      .digest('hex')}`;
  },
  byteLength(value) {
    return Buffer.byteLength(String(value || ''), 'utf8');
  },
};

function c05Sha256Text(value) {
  return `sha256:${c05CryptoPort.sha256Text(value)}`;
}

function c05SourceFenceToken(source) {
  const payload = {
    schemaVersion: 'yalken.sourceFence.token.v1',
    purpose: 'WRITE_SOURCE',
    projectId: source.projectId,
    rootId: source.rootId,
    documentId: source.documentId,
    canonicalRevision: source.canonicalRevision,
    workingRevision: source.workingRevision,
    sourceDigest: source.sourceDigest,
  };
  return {
    ...payload,
    fenceDigest: c05Sha256Text(stableJson(payload)),
  };
}

function c05SourceFenceBinding({ commandId, source }) {
  const request = {
    schemaVersion: 'yalken.sourceFence.request.v1',
    purpose: 'WRITE_SOURCE',
    expected: source,
    current: { ...source, dirtyState: 'CLEAN' },
    dirtyPolicy: 'REQUIRE_CLEAN',
    authority: {
      decision: 'ALLOW',
      mayWrite: true,
      commandId,
    },
    fence: c05SourceFenceToken(source),
  };
  return {
    schemaVersion: 'yalken.rtk.round-authority-source-fence.v1',
    request,
    result: {
      schemaVersion: 'yalken.sourceFence.result.v1',
      ok: true,
      decision: 'ALLOW',
      code: 'YALKEN_SOURCE_FENCE_ALLOWED',
      reasons: [],
      observed: {
        purpose: 'WRITE_SOURCE',
        projectId: source.projectId,
        rootId: source.rootId,
        documentId: source.documentId,
        canonicalRevision: source.canonicalRevision,
        workingRevision: source.workingRevision,
        sourceDigest: source.sourceDigest,
        dirtyState: 'CLEAN',
        dirtyPolicy: 'REQUIRE_CLEAN',
      },
    },
  };
}

function base64UrlText(value) {
  return Buffer.from(String(value || ''), 'utf8')
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '');
}

function hmacSha256Json(value, secret) {
  return `hmac-sha256:${crypto
    .createHmac('sha256', Buffer.from(String(secret || ''), 'utf8'))
    .update(Buffer.from(stableJson(value), 'utf8'))
    .digest('hex')}`;
}

function base64UrlEncodeBytes(bytes) {
  return Buffer.from(bytes).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function hexBytes(hex) {
  const clean = String(hex || '').replace(/^sha256:/u, '');
  const bytes = [];
  for (let index = 0; index < clean.length; index += 2) {
    bytes.push(Number.parseInt(clean.slice(index, index + 2), 16));
  }
  return bytes;
}

function makeTestYrtk2({ keyIdHex, roundIdHex, coreManifestDigest, secret }) {
  const payloadBytes = [
    ...Buffer.from('YRT2', 'ascii'),
    1,
    ...hexBytes(keyIdHex),
    ...hexBytes(roundIdHex),
    ...hexBytes(coreManifestDigest),
  ];
  const macInput = `YALKEN_RTK_WORD_V4_YRTK2_MAC_INPUT_V1:${Buffer.from(payloadBytes).toString('hex')}`;
  const macHex = c05CryptoPort.hmacSha256Text(macInput, secret).replace(/^hmac-sha256:/u, '');
  const token = base64UrlEncodeBytes([...payloadBytes, ...hexBytes(macHex)]);
  return {
    token,
    tokenDigest: c05CryptoPort.sha256Text(token),
    tokenLength: token.length,
    keyIdHex,
    roundIdHex,
    coreManifestDigest,
    secretEmbeddedInDocx: false,
  };
}

function customPropertiesXml(properties = []) {
  return [
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">',
    ...properties.map((property, index) => (
      `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="${index + 2}" name="${property.name}"><vt:lpwstr>${property.value}</vt:lpwstr></property>`
    )),
    '</Properties>',
  ].join('');
}

function productContentTypesXml(options = {}) {
  const includeComments = options.includeComments !== false;
  return [
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>',
    ...(includeComments ? ['<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>'] : []),
    '<Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/>',
    '</Types>',
  ].join('');
}

function productRootRelsXml() {
  return [
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>',
    '<Relationship Id="rIdYrtkCustomProps" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties" Target="docProps/custom.xml"/>',
    '</Relationships>',
  ].join('');
}

function productDocumentRelsXml() {
  return [
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rIdComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/>',
    '</Relationships>',
  ].join('');
}

function productAuthorityEnvelope(payload, secret, overrides = {}) {
  const body = {
    schemaVersion: 'yalken.rtk.locator-authority-envelope.c01.v1',
    payload,
    payloadDigest: c05CryptoPort.sha256Json(payload),
    signature: hmacSha256Json(payload, secret),
    keyId: 'product-review-docx-local-secret-v1',
    secretEmbeddedInDocx: false,
    ...overrides,
  };
  return `YRTK1.${base64UrlText(JSON.stringify(body))}`;
}

function customPropertyFromSource(source, name) {
  return (Array.isArray(source?.customProperties) ? source.customProperties : [])
    .find((property) => property?.name === name)?.value || '';
}

function importTestRoundKeyRef(roundId, secret) {
  const { createRequire: createNodeRequire } = require('node:module');
  const bridge = createNodeRequire(__filename)('../../src/io/revisionBridge/index.mjs');
  const result = bridge.importRoundKey({ roundId, secret });
  if (!result || result.ok !== true || typeof result.keyRef !== 'string' || !result.keyRef) {
    throw new Error('TEST_ROUND_KEY_IMPORT_FAILED');
  }
  return result.keyRef;
}

function productReviewDocxWithAnchoredComment({
  secret = 'local-secret-for-product-return-intake',
  roundId = 'round-product-intake-1',
  roundIdHex = '11111111111111111111111111111111',
  keyIdHex = '22222222222222222222222222222222',
  exportId = 'export-product-intake-1',
  sceneId = 'roman/imported/scene-1.txt',
  sceneText = 'Anchored text',
  blockId = 'block-product-intake-1',
  envelopeOverrides = {},
  includeYrtk2 = true,
  yrtk2TokenOverride = null,
} = {}) {
  const rawSha256 = c05Sha256Text(sceneText);
  const yrtk2 = makeTestYrtk2({
    keyIdHex,
    roundIdHex,
    coreManifestDigest: c05Sha256Text('core-manifest-product-intake-1'),
    secret,
  });
  const payload = {
    schemaVersion: 'yalken.rtk.locator-authority-envelope.c01.v1',
    taskId: 'YALKEN_WORD_ROUNDTRIP_RELEASE_AUDIT_NIGHT_01',
    profileId: 'word-mac-latest-observed-16.111.x-product-review-export-p0',
    caseId: 'product-review-docx-export-p0',
    sceneId,
    sceneRevision: rawSha256,
    rawSha256,
    blockId,
    roundId,
    exportId,
    exportArtifactId: 'export-artifact-product-intake-1',
    semanticReturnId: 'semantic-return-product-intake-1',
    coreManifestDigest: yrtk2.coreManifestDigest,
    transportManifestDigest: c05Sha256Text('transport-manifest-product-intake-1'),
    yrtk2TokenDigest: yrtk2.tokenDigest,
    blockCount: 1,
  };
  const authority = productAuthorityEnvelope(payload, secret, envelopeOverrides);
  return {
    payload,
    secret,
    yrtk2,
    bytes: docxWithAnchoredComment('', [
      {
        name: '[Content_Types].xml',
        method: 8,
        body: productContentTypesXml(),
      },
      {
        name: '_rels/.rels',
        method: 8,
        body: productRootRelsXml(),
      },
      {
        name: 'word/_rels/document.xml.rels',
        method: 8,
        body: productDocumentRelsXml(),
      },
      {
        name: 'docProps/custom.xml',
        method: 8,
        body: customPropertiesXml([
          { name: 'YRTK_C01_AUTH', value: authority },
          ...(includeYrtk2 ? [{ name: 'YRTK2_TOKEN', value: yrtk2TokenOverride || yrtk2.token }] : []),
          { name: 'YRTK_CORE_DIGEST', value: payload.coreManifestDigest },
        ]),
      },
    ]),
  };
}

function productReviewDocxWithTrackedReplacement({
  secret = 'local-secret-for-product-return-intake',
  roundId = 'round-product-intake-replacement-1',
  roundIdHex = '33333333333333333333333333333333',
  keyIdHex = '44444444444444444444444444444444',
  exportId = 'export-product-intake-replacement-1',
  sceneId = 'roman/imported/scene-1.txt',
  sceneText = 'Alpha beta gamma.',
  deletedText = 'beta',
  insertedText = 'delta',
  blockId = 'block-product-intake-replacement-1',
  envelopeOverrides = {},
} = {}) {
  const rawSha256 = c05Sha256Text(sceneText);
  const yrtk2 = makeTestYrtk2({
    keyIdHex,
    roundIdHex,
    coreManifestDigest: c05Sha256Text('core-manifest-product-intake-replacement-1'),
    secret,
  });
  const payload = {
    schemaVersion: 'yalken.rtk.locator-authority-envelope.c01.v1',
    taskId: 'YALKEN_WORD_ROUNDTRIP_RELEASE_AUDIT_NIGHT_01',
    profileId: 'word-mac-latest-observed-16.111.x-product-review-export-p0',
    caseId: 'product-review-docx-export-p0-tracked-replacement',
    sceneId,
    sceneRevision: rawSha256,
    rawSha256,
    blockId,
    roundId,
    exportId,
    exportArtifactId: 'export-artifact-product-intake-replacement-1',
    semanticReturnId: 'semantic-return-product-intake-replacement-1',
    coreManifestDigest: yrtk2.coreManifestDigest,
    transportManifestDigest: c05Sha256Text('transport-manifest-product-intake-replacement-1'),
    yrtk2TokenDigest: yrtk2.tokenDigest,
    blockCount: 1,
  };
  const authority = productAuthorityEnvelope(payload, secret, envelopeOverrides);
  return {
    payload,
    secret,
    yrtk2,
    sceneText,
    deletedText,
    insertedText,
    bytes: cleanDocxZip([
      '<w:p>',
      '<w:r><w:t>Alpha </w:t></w:r>',
      `<w:del w:id="1"><w:r><w:delText>${deletedText}</w:delText></w:r></w:del>`,
      `<w:ins w:id="2"><w:r><w:t>${insertedText}</w:t></w:r></w:ins>`,
      '<w:r><w:t> gamma.</w:t></w:r>',
      '</w:p>',
    ].join(''), [
      {
        name: '[Content_Types].xml',
        method: 8,
        body: productContentTypesXml({ includeComments: false }),
      },
      {
        name: '_rels/.rels',
        method: 8,
        body: productRootRelsXml(),
      },
      {
        name: 'docProps/custom.xml',
        method: 8,
        body: customPropertiesXml([
          { name: 'YRTK_C01_AUTH', value: authority },
          { name: 'YRTK2_TOKEN', value: yrtk2.token },
          { name: 'YRTK_CORE_DIGEST', value: payload.coreManifestDigest },
        ]),
      },
    ]),
  };
}

function productAuthorityStoreFromDocx(docx, overrides = {}) {
  return {
    schemaVersion: 'yalken.rtk.word.product-review-docx-export.authority-store.v1',
    lastRoundId: docx.payload.roundId,
    roundsById: {
      [docx.payload.roundId]: {
        schemaVersion: 'yalken.rtk.word.product-review-docx-export.local-authority.v1',
        projectRoot: '/project',
        scenePath: '/project/roman/imported/scene-1.txt',
        baselineFinalText: typeof docx.sceneText === 'string' ? docx.sceneText : 'Anchored text',
        hmacSecret: docx.secret,
        keyRef: importTestRoundKeyRef(docx.payload.roundId, docx.secret),
        lifecycleState: 'PUBLISHED_ACTIVE',
        expectedAuthority: {
          sceneId: docx.payload.sceneId,
          sceneRevision: docx.payload.sceneRevision,
          rawSha256: docx.payload.rawSha256,
          blockId: docx.payload.blockId,
          roundId: docx.payload.roundId,
          exportId: docx.payload.exportId,
        },
        roundId: docx.payload.roundId,
        exportIdentity: docx.payload.exportId,
        manifestDigest: docx.payload.transportManifestDigest,
        coreManifestDigest: docx.payload.coreManifestDigest,
        yrtk2: {
          tokenDigest: docx.yrtk2.tokenDigest,
          tokenLength: docx.yrtk2.tokenLength,
          keyIdHex: docx.yrtk2.keyIdHex,
          roundIdHex: docx.yrtk2.roundIdHex,
          coreManifestDigest: docx.yrtk2.coreManifestDigest,
          secretEmbeddedInDocx: false,
        },
        exportMap: {
          scenes: [
            {
              sceneId: docx.payload.sceneId,
              rawSha256: docx.payload.rawSha256,
            },
          ],
        },
        ...overrides,
      },
    },
    secretExposedToRenderer: false,
  };
}

function sceneExportMapBlocks(sceneId, sceneText, options = {}) {
  const blockPrefix = typeof options.blockPrefix === 'string' ? options.blockPrefix : 'block-c4-google';
  return String(sceneText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map((text, index) => ({
    sceneId,
    blockId: `${blockPrefix}-${String(index + 1).padStart(4, '0')}`,
    paragraphId: `yrtk-c4-p-${String(index + 1).padStart(4, '0')}`,
    documentParagraphIndex: index,
    canonicalTextSha256: c05Sha256Text(text),
    canonicalMarksSha256: c05CryptoPort.sha256Json({ marks: [] }),
    wordSignals: [
      {
        kind: 'bookmarkName',
        value: { name: `YRTK_SOURCE_${String(index + 1).padStart(4, '0')}` },
        applyAuthority: false,
      },
    ],
  }));
}

function googleRewrittenBookmarkReturnBytes(docx, options = {}) {
  const sceneText = typeof options.sceneText === 'string' ? options.sceneText : docx.sceneText;
  const deletedText = typeof options.deletedText === 'string' ? options.deletedText : docx.deletedText;
  const insertedText = typeof options.insertedText === 'string' ? options.insertedText : docx.insertedText;
  const targetOrdinal = Number.isSafeInteger(options.targetOrdinal) ? options.targetOrdinal : 0;
  const paragraphs = String(sceneText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const body = paragraphs.map((text, index) => {
    const randomBookmarkName = `_GoBack_${crypto.createHash('sha1').update(`${index}:${text}`).digest('hex').slice(0, 12)}`;
    const bookmarkId = 700 + index;
    const prefix = `<w:bookmarkStart w:id="${bookmarkId}" w:name="${randomBookmarkName}"/><w:bookmarkEnd w:id="${bookmarkId}"/>`;
    if (index !== targetOrdinal) return `${prefix}<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
    if (options.physicalConcatenatedCommentAnchor === true) {
      return [
        prefix,
        '<w:p>',
        '<w:ins w:id="0" w:author="Google Reviewer" w:date="2026-09-15T02:15:37Z">',
        `<w:r><w:t>${insertedText.replace(/omega$/u, '')}</w:t></w:r>`,
        '<w:commentRangeStart w:id="0"/>',
        '<w:r><w:t>omega</w:t></w:r>',
        '</w:ins>',
        '<w:del w:id="0" w:author="Google Reviewer" w:date="2026-09-15T02:15:37Z">',
        '<w:r><w:delText>sentinel</w:delText></w:r>',
        '<w:commentRangeEnd w:id="0"/>',
        '<w:r><w:commentReference w:id="0"/></w:r>',
        `<w:r><w:delText>${deletedText.replace(/^sentinel/u, '')}</w:delText></w:r>`,
        '</w:del>',
        '</w:p>',
      ].join('');
    }
    return [
      prefix,
      '<w:p>',
      `<w:del w:id="41"><w:r><w:delText>${deletedText}</w:delText></w:r></w:del>`,
      '<w:ins w:id="42">',
      `<w:r><w:t>${insertedText.slice(0, -1)}</w:t></w:r>`,
      '<w:commentRangeStart w:id="0"/>',
      `<w:r><w:t>${insertedText.slice(-1)}</w:t></w:r>`,
      '<w:commentRangeEnd w:id="0"/>',
      '<w:r><w:commentReference w:id="0"/></w:r>',
      '</w:ins>',
      '</w:p>',
    ].join('');
  }).join('');
  return cleanDocxZip(body, [
    {
      name: '[Content_Types].xml',
      method: 8,
      body: productContentTypesXml(),
    },
    {
      name: '_rels/.rels',
      method: 8,
      body: productRootRelsXml(),
    },
    {
      name: 'word/_rels/document.xml.rels',
      method: 8,
      body: productDocumentRelsXml(),
    },
    {
      name: 'word/comments.xml',
      method: 8,
      body: [
        `<w:comments xmlns:w="${W_NS}">`,
        '<w:comment w:id="0" w:author="Google Reviewer" w:date="2026-09-15T02:15:56Z">',
        '<w:p><w:r><w:t>C4 anchored UI comment on suggested replacement for Yalken review intake.</w:t></w:r></w:p>',
        '</w:comment>',
        '</w:comments>',
      ].join(''),
    },
    {
      name: 'docProps/custom.xml',
      method: 8,
      body: customPropertiesXml([
        { name: 'YRTK_C01_AUTH', value: productAuthorityEnvelope(docx.payload, docx.secret) },
        { name: 'YRTK2_TOKEN', value: docx.yrtk2.token },
        { name: 'YRTK_CORE_DIGEST', value: docx.payload.coreManifestDigest },
      ]),
    },
  ]);
}

function googleRewrittenFormattingParagraphs(sceneText, options = {}) {
  return String(sceneText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
    .map((text, index) => {
      const paragraphText = index === options.targetOrdinal
        ? text.replace(options.deletedText || 'sentinel alpha', options.insertedText || 'sentinel omega')
        : text;
      return {
        paragraphIndex: index,
        documentParagraphIndex: index,
        paragraphText,
        trackedRevision: index === options.targetOrdinal,
        bookmarkNames: [],
        formattedRuns: [],
      };
    });
}

function googleC4BlockAuthorityInput(options = {}) {
  const sceneId = 'roman/google-c4-direct.txt';
  const sceneLines = [
    '[plainTextPreserved] Body text sentinel alpha.',
    '',
    '[latin-basic] Plain ASCII text survives Word and Yalken return.',
    '[latin-diacritic] Café naïve façade coöperate jalapeño résumé.',
    '[cyrillic] Привет мир. Текст сцены сохраняется.',
    '[greek] Καλημέρα κόσμε. Το κείμενο παραμένει.',
    '[cjk] 中文文本保留。日本語の本文も保持。한국어 문장도 유지.',
    '[rtl-hebrew] שלום עולם. טקסט בעברית נשמר.',
    '[emoji-zwj] Family 👨‍👩‍👧‍👦 and technologist 🧑‍💻 stay intact.',
    '  [whitespaceEdgesPreserved] leading and trailing spaces stay here  ',
    '',
    '[paragraphBoundariesPreserved] Final paragraph after an intentional empty paragraph.',
  ];
  const targetOrdinal = 0;
  const blocks = sceneLines.map((text, index) => ({
    sceneId,
    blockId: `block-google-c4-${String(index).padStart(4, '0')}`,
    documentParagraphIndex: index,
    text,
  }));
  const targetBlockId = blocks[targetOrdinal].blockId;
  const reviewIr = c05ReviewIr({
    deleted: 'sentinel alpha',
    inserted: 'sentinel omega',
    groupId: 'google-c4-direct',
    paragraphIndex: 0,
  });
  const input = {
    commandId: 'cmd.rtk.review.applyNonOverlapTrackedReplacements',
    callerRole: 'main',
    commandAuthority: {
      issuer: 'main',
      intent: 'rtk.exactApply',
      commandId: 'cmd.rtk.review.applyNonOverlapTrackedReplacements',
    },
    exactAuthority: c05ExactAuthority(),
    authorityCarrier: c05AuthorityCarrier(sceneId, 'attacker-random-bookmark-block'),
    reviewIr,
    localBaseline: {
      sceneId,
      blockId: targetBlockId,
      authorityKind: 'main-owned-scene-export-map-ordinal-v1',
      sceneBlocks: blocks,
      sceneOrdinalAuthority: {
        schemaVersion: 'yalken.rtk.return-intake.scene-ordinal-authority.v1',
        source: 'main-owned-local-export-map',
        sceneId,
        targetBlockId,
        targetDocumentParagraphIndex: targetOrdinal,
        blockCount: blocks.length,
        returnedParagraphCount: blocks.length,
        currentRawSha256: c05Sha256Text(sceneLines.join('\n')),
        touchedParagraphs: [
          {
            kind: 'textRevision:delete',
            id: 'del-google-c4-direct',
            rawReturnedParagraphIndex: 0,
            documentParagraphIndex: 0,
            sceneId,
            blockId: targetBlockId,
          },
          {
            kind: 'textRevision:insert',
            id: 'ins-google-c4-direct',
            rawReturnedParagraphIndex: 0,
            documentParagraphIndex: 0,
            sceneId,
            blockId: targetBlockId,
          },
        ],
        returnedGoogleBookmarkNamesAuthority: false,
        globalTextSearchAuthority: false,
        fuzzyMatchAuthority: false,
      },
    },
  };
  if (typeof options.mutate === 'function') {
    options.mutate(input, { blocks, targetBlockId, sceneLines });
  }
  return input;
}

async function runGoogleC4SceneActivation(options = {}) {
  const bridge = await loadBridge();
  const sceneId = 'roman/google-c4-scene.txt';
  const targetOrdinal = 0;
  const sceneLines = [
    'sentinel alpha',
    'context line 02',
    'context line 03',
    'context line 04',
    'context line 05',
    'context line 06',
    'context line 07',
    'context line 08',
    'context line 09',
    'context line 10',
    'context line 11',
    'context line 12',
  ];
  const sceneText = sceneLines.join('\n');
  const blocks = sceneExportMapBlocks(sceneId, sceneText);
  const docx = productReviewDocxWithTrackedReplacement({
    roundId: 'round-google-c4-scene-ordinal',
    roundIdHex: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    keyIdHex: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    exportId: 'export-google-c4-scene-ordinal',
    sceneId,
    sceneText,
    deletedText: 'sentinel alpha',
    insertedText: 'sentinel omega',
    blockId: blocks[targetOrdinal].blockId,
  });
  const returnedBytes = options.returnedBytes || googleRewrittenBookmarkReturnBytes(docx, {
    sceneText,
    targetOrdinal,
    physicalConcatenatedCommentAnchor: options.physicalConcatenatedCommentAnchor === true,
  });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-google-c4-negative-'));
  const scenePath = path.join(tmpDir, sceneId);
  fs.mkdirSync(path.dirname(scenePath), { recursive: true });
  fs.writeFileSync(scenePath, sceneText, 'utf8');
  const reviewIr = c05ReviewIr({
    deleted: 'sentinel alpha',
    inserted: 'sentinel omega',
    groupId: 'google-c4-ordinal',
    paragraphIndex: targetOrdinal,
  });
  reviewIr.formattingParagraphs = googleRewrittenFormattingParagraphs(sceneText, {
    targetOrdinal,
    deletedText: 'sentinel alpha',
    insertedText: 'sentinel omega',
  });
  reviewIr.commentThreads = [{
    threadId: 'rtk-comment-0',
    commentId: '0',
    authorId: 'Google Reviewer',
    status: 'ANCHORED',
    paragraphIndex: targetOrdinal,
    documentParagraphIndex: targetOrdinal,
    anchorLocator: {
      paragraphIndex: targetOrdinal,
      bookmarkNames: [],
    },
    createdAt: '2026-09-15T02:15:56Z',
    updatedAt: '2026-09-15T02:15:56Z',
    tags: ['docx-review'],
    messages: [{
      messageId: 'rtk-comment-0-message-1',
      authorId: 'Google Reviewer',
      body: 'C4 anchored UI comment on suggested replacement for Yalken review intake.',
      createdAt: '2026-09-15T02:15:56Z',
    }],
  }];
  reviewIr.commentPlacements = [{
    placementId: 'docx-comment-placement-0',
    threadId: 'rtk-comment-0',
    sourceCommentId: '0',
    quote: typeof options.commentQuote === 'string' ? options.commentQuote : 'sentinel omeg',
    targetScope: { type: 'scene', id: sceneId },
    selector: { type: 'docx-comment-range', id: '0' },
    anchor: { kind: 'docx-comment-range', value: 'w:comment:0' },
    nativeCommentId: '0',
    relatedReplacementGroupId: 'google-c4-ordinal',
    relatedReplacementGroupMode: 'WITHIN_INSERT',
    range: isPlainObjectValue(options.commentRange)
      ? cloneJsonSafe(options.commentRange)
      : { from: 0, to: 'sentinel omeg'.length },
  }];
  if (typeof options.mutateReviewIr === 'function') options.mutateReviewIr(reviewIr);
  const parserResult = {
    ok: true,
    authorityCarrier: {
      status: 'verified-baseline-bound',
      selectedCarrier: {
        encoded: productAuthorityEnvelope(docx.payload, docx.secret),
        payload: docx.payload,
        baselineBinding: { allExpectedMatched: true },
      },
    },
    exactAuthority: c05ExactAuthority(),
    parserProfileDigest: c05Sha256Text('parser-google-c4-ordinal'),
    analysisDigest: c05Sha256Text('analysis-google-c4-ordinal'),
    sourceMode: 'TRACKED',
    reviewIr,
  };
  if (typeof options.mutateParserResult === 'function') options.mutateParserResult(parserResult);
  const calls = [];
  const applyHandler = bridge.createRtkNonOverlapTrackedReplacementCommandHandler({
    cryptoPort: c05CryptoPort,
    now: () => 1700000000000,
  });
  const rootHandler = bridge.createRtkRootCommentReturnCommandHandler();
  const lifecycleHandler = bridge.createRtkCommentLifecycleReturnCommandHandler();
  const port = instantiateDocxReviewPreviewSessionPort({
    dispatchCommandSurfaceKernel: async (commandId, payload = {}) => {
      calls.push({ commandId, payload: cloneJsonSafe(payload) });
      if (commandId === 'cmd.rtk.reviewSession.importComments') {
        return { ok: true, status: 'committed', session: { summary: { threadCount: 1 } }, storageEffects: {} };
      }
      if (commandId === 'cmd.rtk.review.applyNonOverlapTrackedReplacements') return applyHandler(payload);
      if (commandId === 'cmd.rtk.review.applyRootCommentReturn') return rootHandler(payload);
      if (commandId === 'cmd.rtk.review.applyCommentLifecycleReturn') return lifecycleHandler(payload);
      assert.fail(`unexpected command: ${commandId}`);
    },
  });
  const sceneHash = computeHash(sceneText);
  const exportMap = {
    scope: 'scene',
    roundId: docx.payload.roundId,
    scenes: [{
      sceneId,
      sceneOrdinal: 0,
      rawSha256: docx.payload.rawSha256,
      blocks,
    }],
  };
  if (typeof options.mutateExportMap === 'function') options.mutateExportMap(exportMap);
  const activationPayload = toPayload(returnedBytes, options.explicitCanonicalApplyConfirmed === true
    ? { explicitCanonicalApplyConfirmed: true }
    : {});
  const activationRuntimeOptions = {
    activeReviewDocxExportAuthorityStore: productAuthorityStoreFromDocx(docx, {
      projectRoot: tmpDir,
      scenePath,
      baselineFinalText: sceneText,
      scope: 'scene',
      exportMap,
    }),
    buildMainReviewContext: async () => reviewContext({
      projectId: 'project-google-c4-scene',
      projectRoot: tmpDir,
      scenePath,
      sceneText,
      baselineHash: sceneHash,
      currentBaselineHash: sceneHash,
      targetScope: { type: 'scene', id: sceneId },
    }),
  };
  if (options.useRealReturnIntakeParser !== true) {
    activationRuntimeOptions.runDocxReviewReturnIntakeInUtilityProcess = async (input) => wrapParserResultAsPacketResult(parserResult, {
        returnedArtifactSha256: input?.returnedArtifactSha256,
        yrtk2Token: docx.yrtk2.token,
        coreManifestDigest: docx.payload.coreManifestDigest,
      });
  }
  const result = await port.handleDocxReviewPreviewSessionActivationCommandSurface(
    activationPayload,
    activationRuntimeOptions,
  );
  return { result, calls, port, scenePath, sceneText };
}

function activationResultCodes(result = {}) {
  const codes = [];
  const push = (value) => {
    if (typeof value === 'string' && value) codes.push(value);
  };
  push(result?.error?.code);
  push(result?.error?.reason);
  push(result?.returnIntake?.code);
  push(result?.returnIntake?.reason);
  push(result?.nonOverlapTrackedReplacementProductPath?.reason);
  push(result?.nonOverlapTrackedReplacementProductPath?.runtimePreviewCode);
  for (const item of Array.isArray(result?.nonOverlapTrackedReplacementProductPath?.runtimePreviewReasons)
    ? result.nonOverlapTrackedReplacementProductPath.runtimePreviewReasons
    : []) {
    push(item.code);
  }
  return codes;
}

function c4PhysicalCommentCommandInput(options = {}) {
  const sceneId = 'roman/google-c4-scene.txt';
  const scenePath = path.join(os.tmpdir(), 'yalken-c4-physical-builder', sceneId);
  const sceneText = [
    'sentinel alpha',
    'context line 02',
    'context line 03',
  ].join('\n');
  const blockId = 'block-c4-google-0001';
  const sourceChange = {
    changeId: 'docx-tracked-replace-d7c2e7a8',
    targetScope: { type: 'scene', id: sceneId },
    replacementText: 'sentinel omega',
    paragraphIndex: 0,
    documentParagraphIndex: 0,
    nativeReplacementGroupId: 'replacement-group-c4-native-0',
    match: {
      quote: 'sentinel alpha',
      blockId,
      paragraphIndex: 0,
      documentParagraphIndex: 0,
      blockRange: {
        sceneStart: 0,
        blockLocalStart: 0,
        blockLocalEnd: 'sentinel alpha'.length,
        documentParagraphIndex: 0,
      },
    },
  };
  const placement = {
    placementId: 'docx-comment-placement-0',
    threadId: 'rtk-comment-0',
    sourceCommentId: '0',
    quote: 'omegasentinel',
    targetScope: { type: 'scene', id: sceneId },
    range: { from: 0, to: 'omegasentinel'.length },
    nativeCommentId: '0',
    relatedReplacementGroupId: 'replacement-group-c4-native-0',
    relatedReplacementGroupMode: 'CROSS_REPLACEMENT',
    sceneAuthority: {
      blockId,
      paragraphIndex: 0,
      documentParagraphIndex: 0,
    },
    sceneAuthoritySource: 'authenticated-candidate-export-map-placement',
  };
  if (typeof options.mutatePlacement === 'function') options.mutatePlacement(placement);
  const textChanges = [sourceChange];
  if (typeof options.mutateTextChanges === 'function') options.mutateTextChanges(textChanges);
  return {
    authenticated: true,
    projectId: 'project-google-c4-scene',
    projectRoot: os.tmpdir(),
    returnArtifactId: `sha256:${GOOGLE_C4_PR1918_SANITIZED_DERIVATIVE_FIXTURE_SHA256}`,
    localAuthorityCapsule: {
      projectId: 'project-google-c4-scene',
      projectRoot: os.tmpdir(),
      scenePathBySceneId: { [sceneId]: scenePath },
      baselineFinalTextBySceneId: { [sceneId]: sceneText },
    },
    reviewIr: {
      schemaVersion: 'yalken.rtk.review-ir.v2',
      textChanges,
      commentThreads: [{
        threadId: 'rtk-comment-0',
        commentId: '0',
        sourceCommentId: '0',
        targetScope: { type: 'scene', id: sceneId },
        messages: [{
          messageId: 'rtk-comment-0-message-1',
          body: 'C4 anchored review comment for sentinel omega.',
        }],
      }],
      commentPlacements: [placement],
    },
  };
}

function capturedC4PhysicalSceneText() {
  return [
    '[plainTextPreserved] Body text sentinel alpha.',
    '',
    '[latin-basic] Plain ASCII text survives Word and Yalken return.',
    '[latin-diacritic] Café naïve façade coöperate jalapeño résumé.',
    '[cyrillic] Привет мир. Текст сцены сохраняется.',
    '[greek] Καλημέρα κόσμε. Το κείμενο παραμένει.',
    '[cjk] 中文文本保留。日本語の本文も保持。한국어 문장도 유지.',
    '[rtl-hebrew] שלום עולם. טקסט בעברית נשמר.',
    '[emoji-zwj] Family 👨‍👩‍👧‍👦 and technologist 🧑‍💻 stay intact.',
    '  [whitespaceEdgesPreserved] leading and trailing spaces stay here  ',
    '',
    '[paragraphBoundariesPreserved] Final paragraph after an intentional empty paragraph.',
  ].join('\n');
}

function capturedC4PhysicalExportMap() {
  const sceneId = 'roman/черновик.txt';
  return {
    scope: 'scene',
    roundId: 'round-d83254951e5382fe997303a5c8aa0e77',
    scenes: [{
      sceneId,
      sceneOrdinal: 0,
      blocks: capturedC4PhysicalSceneText().split('\n').map((text, index) => ({
        sceneId,
        blockId: index === 0 ? 'block-0001-257e76631298cbeb' : `block-${String(index + 1).padStart(4, '0')}-captured-c4`,
        documentParagraphIndex: index,
        canonicalTextSha256: c05Sha256Text(text),
        wordSignals: [],
      })),
    }],
  };
}

function c05ReviewIr({ deleted = 'beta', inserted = 'delta', groupId = 'group-c05', paragraphIndex = null } = {}) {
  const paragraphFields = Number.isSafeInteger(paragraphIndex)
    ? { paragraphIndex, documentParagraphIndex: paragraphIndex }
    : {};
  return {
    schemaVersion: 'yalken.rtk.review-ir.v2',
    sourceMode: 'TRACKED',
    textRevisions: [
      {
        kind: 'TextRevision',
        operation: 'delete',
        nativeRevisionId: `del-${groupId}`,
        text: deleted,
        textDigest: c05Sha256Text(`delete:${deleted}`),
        replacementGroupId: groupId,
        ...paragraphFields,
      },
      {
        kind: 'TextRevision',
        operation: 'insert',
        nativeRevisionId: `ins-${groupId}`,
        text: inserted,
        textDigest: c05Sha256Text(`insert:${inserted}`),
        replacementGroupId: groupId,
        ...paragraphFields,
      },
    ],
    moveRevisions: [],
    propertyRevisions: [],
    structureChanges: [],
    formattingDeltas: [],
    commentThreads: [],
    opaqueUnsupported: [],
  };
}

function c05ExactAuthority(overrides = {}) {
  return {
    validSignedLocator: true,
    sceneRevisionUnchanged: true,
    rawSha256Unchanged: true,
    uniqueTarget: true,
    nonOverlapping: true,
    allRelevantXmlSemanticsAccounted: true,
    ambiguousDuplicate: false,
    crossScene: false,
    structuralTopologyChanged: false,
    ...overrides,
  };
}

// EVID-01 Pass 2: the DOCX return intake worker now emits a ReturnEvidencePacket
// V1 alongside the legacy parserResult. The command-surface spies inject a
// worker result; this helper wraps a fake parserResult into a packet-shaped
// worker result so the intake verify gate (schema + artifact digest +
// packetDigest) and the YRTK2-from-packet lane are exercised honestly. The
// yrtk2 evidence (token + coreManifestDigest) is taken from the local
// authority capsule the test already owns.
const { createRequire } = require('node:module');
const cjsRequireForEsm = createRequire(__filename);
let buildReturnEvidencePacketV1Sync = null;
try {
  // The packet module is ESM (.mjs); createRequire lets us load it synchronously
  // because it has no ESM-only runtime imports beyond node:crypto.
  ({ buildReturnEvidencePacketV1: buildReturnEvidencePacketV1Sync } = cjsRequireForEsm('../../src/io/revisionBridge/reviewTransportReturnEvidenceV1.mjs'));
} catch {
  buildReturnEvidencePacketV1Sync = null;
}

function wrapParserResultAsPacketResult(parserResult, options = {}) {
  if (typeof buildReturnEvidencePacketV1Sync !== 'function') {
    // Fallback: return the legacy shape if the packet module could not be
    // required synchronously. This keeps older node paths usable.
    return { ok: true, parserResult };
  }
  const artifactSha256 = typeof options.returnedArtifactSha256 === 'string'
    ? options.returnedArtifactSha256
    : '';
  const yrtk2Token = typeof options.yrtk2Token === 'string' ? options.yrtk2Token : '';
  const coreManifestDigest = typeof options.coreManifestDigest === 'string'
    ? options.coreManifestDigest
    : '';
  const effectiveBudgets = { maxWorkerOutputBytes: 16 * 1024 * 1024 };
  const packet = buildReturnEvidencePacketV1Sync({
    requestId: typeof options.requestId === 'string' ? options.requestId : 'docx-review-preview-session-request',
    artifactSha256,
    effectiveBudgets,
    effectiveBudgetDigest: c05CryptoPort.sha256Json(effectiveBudgets),
    resourceReceipt: {
      parserStatus: parserResult?.status || 'review-ir-ready',
      sourceMode: parserResult?.sourceMode || 'TRACKED',
    },
    packageInventoryDigest: c05CryptoPort.sha256Json(parserResult?.packageInventory || {}),
    unverifiedCarrierEvidence: isPlainObjectValue(parserResult?.authorityCarrier) ? parserResult.authorityCarrier : {},
    returnedProjection: {
      ...(isPlainObjectValue(parserResult?.reviewIr) ? parserResult.reviewIr : {}),
      yrtk2Evidence: { token: yrtk2Token, coreManifestDigest },
    },
    projectionDigest: parserResult?.supportedSemanticDigest || parserResult?.analysisDigest || c05CryptoPort.sha256Json({ sourceMode: parserResult?.sourceMode || 'TRACKED' }),
    diagnostics: Array.isArray(parserResult?.reasons) ? parserResult.reasons : [],
    workerBuildDigest: parserResult?.parserProfileDigest || c05CryptoPort.sha256Json({ implementationId: 'command-surface-spy' }),
  });
  return { ok: true, packet, parserResult };
}

function c05AuthorityCarrier(sceneId = 'roman/imported/scene-1.txt', blockId = 'block-c05-target') {
  return {
    schemaVersion: 'yalken.rtk.review-transport-authority-carrier.v2',
    status: 'verified-baseline-bound',
    selectedCarrier: {
      carrier: 'customDocumentProperty',
      propertyName: 'YRTK_C01_AUTH',
      verified: true,
      validSignedLocator: true,
      payload: {
        sceneId,
        sceneRevision: 'scene-revision-c05-0001',
        rawSha256: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
        blockId,
        roundId: 'round-c05',
        exportId: 'export-c05',
      },
      baselineBinding: {
        allExpectedPresent: true,
        allExpectedMatched: true,
        sceneRevisionMatches: true,
        rawSha256Matches: true,
      },
    },
    carriers: [],
    exactAuthority: c05ExactAuthority(),
    reasons: [],
  };
}

function c05ProductApplyInput({
  sceneText = 'Alpha beta gamma.',
  sceneId = 'roman/imported/scene-1.txt',
  blockId = 'block-c05-target',
  baselineHash = 'baseline-1',
} = {}) {
  const sourceRevisionSha256 = c05Sha256Text(`revision:${sceneText}`);
  const sourceRawBytesSha256 = c05Sha256Text(`raw:${sceneText}`);
  const commandId = 'cmd.rtk.review.applyNonOverlapTrackedReplacements';
  const source = {
    projectId: 'project-1',
    rootId: 'root-c05',
    documentId: sceneId,
    canonicalRevision: sourceRevisionSha256,
    workingRevision: sourceRevisionSha256,
    sourceDigest: sourceRawBytesSha256,
  };
  return {
    commandId,
    callerRole: 'main',
    commandAuthority: {
      issuer: 'main',
      intent: 'rtk.exactApply',
      commandId,
    },
    roundId: 'round-c05',
    requestId: 'request-c05-1',
    exportIdentity: 'export-c05',
    returnArtifactSha256: c05Sha256Text('returned-docx-c05'),
    manifestDigest: c05Sha256Text('manifest-c05'),
    analysisDigest: c05Sha256Text('analysis-c05'),
    returnLifecycleState: 'RETURN_ANALYZED',
    sourceIdentity: {
      sourceTokenDomain: 'SOURCE_TOKEN_DOMAIN_V1',
      writerTextDomain: 'WRITER_TEXT_DOMAIN_V1',
      projectId: source.projectId,
      rootId: source.rootId,
      documentId: source.documentId,
      canonicalRevision: source.canonicalRevision,
      workingRevision: source.workingRevision,
      revisionSha256: sourceRevisionSha256,
      rawBytesSha256: sourceRawBytesSha256,
    },
    currentIdentity: {
      projectId: source.projectId,
      rootId: source.rootId,
      documentId: source.documentId,
      canonicalRevision: source.canonicalRevision,
      workingRevision: source.workingRevision,
      revisionSha256: sourceRevisionSha256,
      rawBytesSha256: sourceRawBytesSha256,
    },
    sourceFence: c05SourceFenceBinding({ commandId, source }),
    exactAuthority: c05ExactAuthority(),
    authorityCarrier: c05AuthorityCarrier(sceneId, blockId),
    reviewIr: c05ReviewIr(),
    localBaseline: {
      sceneId,
      sceneBlocks: [
        {
          sceneId,
          blockId,
          text: sceneText,
        },
      ],
    },
    writerContext: {
      projectRoot: '/project',
      scenePath: '/project/roman/imported/scene-1.txt',
      scenePathBySceneId: { [sceneId]: '/project/roman/imported/scene-1.txt' },
      projectSnapshot: {
        projectId: 'project-1',
        baselineHash,
        scenes: [{ sceneId, text: sceneText }],
      },
      revisionSession: {
        projectId: 'project-1',
        sessionId: 'session-c05',
        baselineHash,
        status: 'open',
        reviewGraph: {
          commentThreads: [],
          commentPlacements: [],
          textChanges: [],
          structuralChanges: [],
          diagnosticItems: [],
          decisionStates: [],
        },
      },
    },
    previewConfirmed: false,
  };
}

test('DOCX review preview session command: command is bridge-allowlisted and handler-owned', () => {
  const source = readMainSource();

  assert.match(
    source,
    /UI_COMMAND_BRIDGE_ALLOWED_COMMAND_IDS\s*=\s*new Set\(\[[\s\S]*'cmd\.project\.review\.activateDocxReviewPreviewSession'/,
  );
  assert.match(
    source,
    /'cmd\.project\.review\.activateDocxReviewPreviewSession':\s*async\s*\(payload\s*=\s*\{\}\)\s*=>\s*\{[\s\S]*handleDocxReviewPreviewSessionActivationCommandSurface\(payload\)/,
  );
  assert.match(
    source,
    /'cmd\.project\.review\.activateDocxReviewPreviewSession':\s*async\s*\(payload\s*=\s*\{\}\)\s*=>\s*\{[\s\S]*sendCanonicalRuntimeCommand\(\s*'cmd\.project\.review\.openComments',\s*\{\s*source:\s*'review-docx-preview-session',\s*requestId:\s*result\.requestId\s*\}/,
  );
  assert.match(
    source,
    /DOCX_REVIEW_PREVIEW_SESSION_ALLOWED_CONTEXT_KINDS\s*=\s*new Set\(\[[\s\S]*'scene'[\s\S]*'chapter-file'[\s\S]*'roman-section'/,
  );
  assert.match(source, /documentKind:\s*documentContext\.kind/u);
  assert.match(source, /targetScope:\s*\{\s*type:\s*'scene',\s*id:\s*sceneId/u);
});

test('DOCX review preview session command: activates an in-memory review session from DOCX comments', async () => {
  const port = instantiateDocxReviewPreviewSessionPort();
  const result = await port.handleDocxReviewPreviewSessionActivationCommandSurface(
    toPayload(docxWithAnchoredComment()),
    {
      buildMainReviewContext: async () => reviewContext(),
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.commandId, 'cmd.project.review.activateDocxReviewPreviewSession');
  assert.equal(result.activated, true);
  assert.equal(result.canOpenReviewSession, true);
  assert.equal(result.canAutoApply, false);
  assert.equal(result.canImportMutate, false);
  assert.equal(result.canWriteStorage, false);
  assert.equal(result.session.projectId, 'project-1');
  assert.equal(result.session.baselineHash, 'baseline-1');
  assert.equal(result.reviewSurface.revisionSession.reviewGraph.commentThreads.length, 1);
  assert.equal(
    result.reviewSurface.revisionSession.reviewGraph.commentThreads[0].messages[0].body,
    'Resolve this comment.',
  );
  assert.deepEqual(result.reviewSurface.revisionSession.reviewGraph.textChanges, []);
  assert.equal(result.reviewSurface.blockedApplyPlan.canApply, false);
  assert.deepEqual(result.reviewSurface.blockedApplyPlan.applyOps, []);
  assert.equal(result.candidateSummary.commentThreadCount, 1);
  assertNoWriteReceiptsOrApplyAuthority(result);
  assert.equal(port.getState().activeReviewSessionLifecycle, 'active');
});

test('DOCX review preview session command: menu handler opens comments after activation', async () => {
  const port = instantiateDocxReviewPreviewSessionPort();
  const result = await port.MENU_COMMAND_HANDLERS['cmd.project.review.activateDocxReviewPreviewSession'](
    toPayload(docxWithAnchoredComment()),
  );

  assert.equal(result.ok, true);
  assert.equal(result.activated, true);
  assert.deepEqual(cloneJsonSafe(port.runtimeCommands), [
    {
      commandId: 'cmd.project.review.openComments',
      payload: {
        source: 'review-docx-preview-session',
        requestId: 'docx-review-preview-session-request',
      },
      legacyCommand: 'review-comment',
    },
  ]);
});

test('DOCX review preview session command: no-evidence DOCX leaves session passive', async () => {
  const port = instantiateDocxReviewPreviewSessionPort();
  const result = await port.handleDocxReviewPreviewSessionActivationCommandSurface(
    toPayload(cleanDocxZip(paragraphXml('Clean'))),
    {
      buildMainReviewContext: async () => reviewContext(),
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.op, 'cmd.project.review.activateDocxReviewPreviewSession');
  assert.equal(result.error.code, 'E_DOCX_REVIEW_PREVIEW_SESSION_NO_CANDIDATE');
  assert.equal(result.error.reason, 'DOCX_REVIEW_PREVIEW_SESSION_CANDIDATE_NO_REVIEW_COMMENTS');
  assert.equal(port.getState().activeReviewSessionLifecycle, 'passive');
});

test('DOCX review preview session command: forbidden renderer fields are rejected before context', async () => {
  const port = instantiateDocxReviewPreviewSessionPort();
  const result = await port.handleDocxReviewPreviewSessionActivationCommandSurface(
    toPayload(docxWithAnchoredComment(), {
      reviewPacket: { leak: true },
    }),
    {
      buildMainReviewContext: async () => {
        throw new Error('context must not be read for forbidden payload fields');
      },
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.op, 'cmd.project.review.activateDocxReviewPreviewSession');
  assert.equal(result.error.code, 'E_DOCX_INTAKE_GATE_PAYLOAD_INVALID');
  assert.equal(result.error.reason, 'DOCX_INTAKE_GATE_PAYLOAD_UNSUPPORTED_FIELDS');
  assert.deepEqual(result.error.details.fields, ['reviewPacket']);
  assert.equal(port.getState().activeReviewSessionLifecycle, 'passive');
});

test('DOCX review preview session command: complex tracked changes open manual structural review', async () => {
  const port = instantiateDocxReviewPreviewSessionPort();
  const result = await port.handleDocxReviewPreviewSessionActivationCommandSurface(
    toPayload(cleanDocxZip([
      paragraphXml('Before'),
      '<w:ins><w:p><w:r><w:t>Inserted</w:t></w:r></w:p></w:ins>',
    ].join(''))),
    {
      buildMainReviewContext: async () => reviewContext(),
    },
  );

  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(result.activated, true);
  assert.equal(result.diagnosticOnly, false);
  assert.equal(result.canOpenReviewSession, true);
  assert.equal(result.canCreateReviewPacket, true);
  assert.equal(result.canAutoApply, false);
  assert.equal(result.canImportMutate, false);
  assert.equal(result.canWriteStorage, false);
  assert.equal(result.candidateSummary.status, 'ready');
  assert.equal(result.candidateSummary.diagnosticItemCount, 2);
  assert.equal(result.candidateSummary.structuralChangeCount, 1);
  const reviewGraph = result.reviewSurface.revisionSession.reviewGraph;
  assert.equal(reviewGraph.diagnosticItems.length, 2);
  assert.equal(reviewGraph.diagnosticItems[0].diagnosticId, 'docx-review-tracked-insertCount');
  assert.deepEqual(reviewGraph.textChanges, []);
  assert.equal(reviewGraph.structuralChanges.length, 1);
  assert.equal(reviewGraph.structuralChanges[0].manualOnly, true);
  assert.equal(result.reviewSurface.blockedApplyPlan.canApply, false);
  assert.deepEqual(result.reviewSurface.blockedApplyPlan.applyOps, []);
  assertNoWriteReceiptsOrApplyAuthority(result);
  assert.equal(port.getState().activeReviewSessionLifecycle, 'active');
});

test('DOCX review preview session command: simple replacement opens one manual text candidate', async () => {
  const port = instantiateDocxReviewPreviewSessionPort();
  const result = await port.handleDocxReviewPreviewSessionActivationCommandSurface(
    toPayload(cleanDocxZip([
      '<w:p>',
      '<w:r><w:t>Alpha </w:t></w:r>',
      '<w:del w:id="1"><w:r><w:delText>beta</w:delText></w:r></w:del>',
      '<w:ins w:id="2"><w:r><w:t>delta</w:t></w:r></w:ins>',
      '<w:r><w:t> gamma.</w:t></w:r>',
      '</w:p>',
    ].join(''))),
    {
      buildMainReviewContext: async () => reviewContext(),
    },
  );

  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(result.activated, true);
  assert.equal(result.diagnosticOnly, false);
  assert.equal(result.canOpenReviewSession, true);
  assert.equal(result.canAutoApply, false);
  assert.equal(result.candidateSummary.textChangeCount, 1);
  assert.equal(result.candidateSummary.trackedTextCandidateCount, 1);
  const reviewGraph = result.reviewSurface.revisionSession.reviewGraph;
  assert.equal(reviewGraph.textChanges.length, 1);
  assert.equal(reviewGraph.textChanges[0].match.kind, 'manual');
  assert.equal(reviewGraph.textChanges[0].match.quote, 'beta');
  assert.equal(reviewGraph.textChanges[0].replacementText, 'delta');
  assert.equal(result.nonOverlapTrackedReplacementProductPath, null);
  assert.equal(result.reviewSurface.blockedApplyPlan.canApply, false);
  assert.deepEqual(result.reviewSurface.blockedApplyPlan.applyOps, []);
  assertNoWriteReceiptsOrApplyAuthority(result);
});

test('DOCX review preview session command: non-overlap tracked replacements reach product apply path only through a hidden main envelope', async () => {
  const calls = [];
  const port = instantiateDocxReviewPreviewSessionPort({
    dispatchCommandSurfaceKernel: async (commandId, payload = {}) => {
      calls.push({ commandId, payload: cloneJsonSafe(payload) });
      assert.equal(commandId, 'cmd.rtk.review.applyNonOverlapTrackedReplacements');
      assert.equal(payload.previewConfirmed, true);
      assert.equal(payload.commandAuthority.issuer, 'main');
      assert.equal(payload.commandAuthority.intent, 'rtk.exactApply');
      assert.equal(payload.exactAuthority.validSignedLocator, true);
      assert.equal(payload.exactAuthority.uniqueTarget, true);
      assert.equal(payload.writerContext.scenePath, '/project/roman/imported/scene-1.txt');
      return {
        status: 'applied',
        code: 'RTK_APPLIED',
        reason: 'RTK_APPLIED',
        applied: true,
        writerCalled: true,
        automaticApplyCertified: true,
        runtimeSummary: {
          replacementPairCount: 1,
          trustedBlockRangeDigestCount: 1,
        },
        vetoMetrics: {
          falseExact: 0,
          wrongSceneRouting: 0,
          silentApply: 0,
          replayFailure: 0,
          silentLoss: 0,
        },
      };
    },
  });
  const result = await port.handleDocxReviewPreviewSessionActivationCommandSurface(
    toPayload(cleanDocxZip([
      '<w:p>',
      '<w:r><w:t>Alpha </w:t></w:r>',
      '<w:del w:id="1"><w:r><w:delText>beta</w:delText></w:r></w:del>',
      '<w:ins w:id="2"><w:r><w:t>delta</w:t></w:r></w:ins>',
      '<w:r><w:t> gamma.</w:t></w:r>',
      '</w:p>',
    ].join(''))),
    {
      buildMainReviewContext: async () => reviewContext({
        scenePath: '/project/roman/imported/scene-1.txt',
        sceneText: 'Alpha beta gamma.',
      }),
      buildRtkNonOverlapTrackedReplacementApplyInput: async () => ({
        ok: true,
        input: c05ProductApplyInput(),
      }),
    },
  );

  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(result.canAutoApply, false);
  assert.equal(result.canImportMutate, false);
  assert.equal(result.canWriteStorage, false);
  assert.equal(result.nonOverlapTrackedReplacementProductPath.prepared, true, JSON.stringify(result.nonOverlapTrackedReplacementProductPath, null, 2));
  assert.equal(result.nonOverlapTrackedReplacementProductPath.status, 'preview-ready');
  assert.equal(result.nonOverlapTrackedReplacementProductPath.writerCalled, false);
  assert.equal(result.nonOverlapTrackedReplacementProductPath.rendererAuthority, false);
  assert.equal(calls.length, 0);

  const textChanges = result.reviewSurface.revisionSession.reviewGraph.textChanges;
  assert.equal(textChanges.length, 1);
  assert.equal(textChanges[0].rtkProductPath, 'nonOverlapTrackedReplacement');
  assert.equal(textChanges[0].match.kind, 'exact');
  assert.equal(textChanges[0].match.quote, 'beta');
  assert.equal(textChanges[0].match.blockId, 'block-c05-target');
  assert.equal(Object.prototype.hasOwnProperty.call(textChanges[0].match, 'blockRange'), false);
  assert.equal(result.reviewSurface.exactTextPlanPreview.status, 'ready');
  assert.equal(result.reviewSurface.exactTextPlanPreview.productPath.rendererAuthority, false);
  assert.equal(result.reviewSurface.rtkNonOverlapTrackedReplacementProductPath.productRuntimeWired, true);
  assert.equal(result.reviewSurface.rtkNonOverlapTrackedReplacementProductPath.automaticApplyCertified, false);
  assertNoWriteReceiptsOrApplyAuthority(result);

  const changeId = textChanges[0].changeId;
  const applied = await port.handleReviewSurfaceApplyExactTextChangeCommandSurface({
    requestId: 'apply-c05-from-visible-preview',
    changeId,
  });
  assert.equal(applied.ok, true, JSON.stringify(applied, null, 2));
  assert.equal(applied.applied, true);
  assert.equal(applied.result.automaticApplyCertified, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].payload.requestId, 'apply-c05-from-visible-preview');
  assert.equal(calls[0].payload.previewConfirmed, true);
  assert.equal(applied.reviewSurface.exactTextAppliedChangeIds.includes(changeId), true);
  assert.equal(applied.reviewSurface.rtkNonOverlapTrackedReplacementApplyResult.status, 'applied');
  assert.equal(port.getState().currentReviewSurfacePayload.rtkNonOverlapTrackedReplacementApplyResult.status, 'applied');
});

test('DOCX review preview session command: full-manuscript return exposes only explicit product apply and dispatches main-owned multi-scene envelope', async () => {
  const {
    buildFullManuscriptDocxReviewPacketSource,
  } = require(path.join(REPO_ROOT, 'src', 'export', 'docx', 'fullManuscriptDocxReviewPacketSource.js'));
  const {
    buildFullManuscriptReviewReturnApplyPlan,
    buildFullManuscriptReturnIntakeProofBindingDigest,
  } = require(path.join(REPO_ROOT, 'src', 'export', 'docx', 'fullManuscriptDocxReviewReturnRouter.js'));
  const revisionBridge = await loadBridge();
  const fullSource = buildFullManuscriptDocxReviewPacketSource({
    projectId: 'project-c5v2-product-route',
    projectRoot: '/project',
    manifestPath: '/project/manifest.json',
    scenes: [
      {
        sceneId: 'roman/preface.md',
        scenePath: '/project/roman/preface.md',
        text: 'The artist is the creator of beautiful things.',
        order: 0,
      },
      {
        sceneId: 'roman/chapter-01.md',
        scenePath: '/project/roman/chapter-01.md',
        text: 'The studio was filled with the rich odour of roses.',
        order: 1,
      },
    ],
  }, {
    roundIdHex: 'feed0000000000000000000000000001',
    keyIdHex: 'feed0000000000000000000000000002',
    hmacSecret: 'local-secret-for-full-manuscript-product-route',
    cryptoPort: c05CryptoPort,
    revisionBridge,
  });
  fullSource.localAuthorityCapsule.keyRef = importTestRoundKeyRef(
    fullSource.localAuthorityCapsule.roundId,
    fullSource.localAuthorityCapsule.hmacSecret,
  );
  fullSource.localAuthorityCapsule.lifecycleState = 'PUBLISHED_ACTIVE';
  const returnedAuthority = {
    scope: 'full-manuscript',
    projectId: 'project-c5v2-product-route',
    roundId: fullSource.localAuthorityCapsule.roundId,
    exportId: fullSource.localAuthorityCapsule.exportIdentity,
    fullBookRawSha256: fullSource.exportCapsule.fullBookRawSha256,
    orderedSceneIds: fullSource.exportCapsule.orderedSceneIds,
  };
  const operations = [
    {
      id: 'op-preface-full-product-route',
      family: 'tracked_text_edit',
      sceneId: 'roman/preface.md',
      anchor: { sceneId: 'roman/preface.md', selectedText: 'beautiful things' },
      semanticIntent: { kind: 'replace', replacementText: 'luminous forms' },
    },
    {
      id: 'op-chapter-full-product-route',
      family: 'tracked_text_edit',
      sceneId: 'roman/chapter-01.md',
      anchor: { sceneId: 'roman/chapter-01.md', selectedText: 'rich odour of roses' },
      semanticIntent: { kind: 'replace', replacementText: 'quiet scent of roses' },
    },
  ];
  const returnIntakeProof = {
    status: 'authenticated-return-ir-ready',
    authenticated: true,
    returnedArtifactSha256: c05CryptoPort.sha256Json({ returned: fullSource.localAuthorityCapsule.roundId }),
    coreManifestDigest: fullSource.localAuthorityCapsule.coreManifestDigest,
    yrtk2Verification: {
      code: 'RTK_RETURN_INTAKE_YRTK2_VERIFIED',
      coreManifestDigest: fullSource.localAuthorityCapsule.coreManifestDigest,
      keyIdHex: fullSource.localAuthorityCapsule.yrtk2.keyIdHex,
      roundIdHex: fullSource.localAuthorityCapsule.yrtk2.roundIdHex,
      tokenDigest: fullSource.localAuthorityCapsule.yrtk2.tokenDigest,
    },
    parserProfileDigest: c05CryptoPort.sha256Json({ parser: 'test-parser-v2' }),
    analysisDigest: c05CryptoPort.sha256Json({ analysis: operations.map((operation) => operation.id) }),
    reviewIrDigest: c05CryptoPort.sha256Json({ reviewIr: operations.map((operation) => operation.id) }),
    operationSource: 'parsed-review-ir',
    operationIds: operations.map((operation) => operation.id),
  };
  returnIntakeProof.mainIntakeAuthorityDigest = buildFullManuscriptReturnIntakeProofBindingDigest({
    proof: returnIntakeProof,
    localAuthority: fullSource.localAuthorityCapsule,
    operations,
  });
  const fullPlan = buildFullManuscriptReviewReturnApplyPlan({
    projectId: 'project-c5v2-product-route',
    requestId: 'activate-full-manuscript-product-route',
    localAuthorityCapsule: fullSource.localAuthorityCapsule,
    returnedAuthority,
    operations,
    returnIntakeProof,
  });
  assert.equal(fullPlan.ok, true, JSON.stringify(fullPlan, null, 2));
  const calls = [];
  const port = instantiateDocxReviewPreviewSessionPort({
    dispatchCommandSurfaceKernel: async (commandId, payload = {}) => {
      calls.push({ commandId, payload: cloneJsonSafe(payload) });
      assert.equal(commandId, 'cmd.rtk.review.applyMultiSceneNonOverlapTrackedReplacements');
      assert.equal(payload.previewConfirmed, true);
      assert.equal(payload.commandId, 'cmd.rtk.review.applyMultiSceneNonOverlapTrackedReplacements');
      assert.equal(payload.sceneCommands.length, 2);
      assert.equal(payload.sceneCommands[0].input.commandAuthority.issuer, 'main');
      assert.equal(payload.sceneCommands[1].input.commandAuthority.issuer, 'main');
      return {
        ok: true,
        status: 'applied',
        code: 'RTK_MULTI_SCENE_EXACT_APPLIED',
        reason: 'RTK_MULTI_SCENE_EXACT_APPLIED',
        applied: true,
        replay: false,
        writerCalled: true,
        automaticApplyCertified: false,
        multiSceneAtomicApplyCertified: false,
        sceneResults: [
          { sceneId: 'roman/preface.md', status: 'applied' },
          { sceneId: 'roman/chapter-01.md', status: 'applied' },
        ],
      };
    },
  });
  const parserResult = {
    ok: true,
    authorityCarrier: {
      status: 'verified-baseline-bound',
      selectedCarrier: {
        encoded: customPropertyFromSource(fullSource, 'YRTK_C01_AUTH'),
        payload: returnedAuthority,
        baselineBinding: { allExpectedMatched: true },
      },
    },
    exactAuthority: { validSignedLocator: true, sceneRevisionUnchanged: true, rawSha256Unchanged: true },
    parserProfileDigest: c05Sha256Text('parser-full-route'),
    analysisDigest: c05Sha256Text('analysis-full-route'),
    sourceMode: 'TRACKED',
    reviewIr: c05ReviewIr(),
  };
  const result = await port.handleDocxReviewPreviewSessionActivationCommandSurface(
    toPayload(cleanDocxZip([
      '<w:p>',
      '<w:r><w:t>Alpha </w:t></w:r>',
      '<w:del w:id="1"><w:r><w:delText>beta</w:delText></w:r></w:del>',
      '<w:ins w:id="2"><w:r><w:t>delta</w:t></w:r></w:ins>',
      '<w:r><w:t> gamma.</w:t></w:r>',
      '</w:p>',
    ].join(''), [
      {
        name: 'docProps/custom.xml',
        method: 8,
        body: customPropertiesXml([
          { name: 'YRTK_C01_AUTH', value: customPropertyFromSource(fullSource, 'YRTK_C01_AUTH') },
          { name: 'YRTK2_TOKEN', value: customPropertyFromSource(fullSource, 'YRTK2_TOKEN') },
          { name: 'YRTK_CORE_DIGEST', value: fullSource.localAuthorityCapsule.coreManifestDigest },
        ]),
      },
    ])),
    {
      activeReviewDocxExportAuthorityStore: {
        schemaVersion: 'yalken.rtk.word.product-review-docx-export.authority-store.v1',
        scope: 'full-manuscript',
        lastRoundId: fullSource.localAuthorityCapsule.roundId,
        roundsById: { [fullSource.localAuthorityCapsule.roundId]: fullSource.localAuthorityCapsule },
        secretExposedToRenderer: false,
      },
      runDocxReviewReturnIntakeInUtilityProcess: async (input) => wrapParserResultAsPacketResult(parserResult, {
        returnedArtifactSha256: input?.returnedArtifactSha256,
        yrtk2Token: customPropertyFromSource(fullSource, 'YRTK2_TOKEN'),
        coreManifestDigest: fullSource.localAuthorityCapsule.coreManifestDigest,
      }),
      buildMainReviewContext: async () => reviewContext({
        projectId: 'project-c5v2-product-route',
        projectRoot: '/project',
        targetScope: { type: 'scene', id: 'roman/preface.md' },
      }),
      buildRtkNonOverlapTrackedReplacementApplyInput: async () => ({
        ok: true,
        fullManuscriptPlan: fullPlan,
      }),
    },
  );

  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(result.nonOverlapTrackedReplacementProductPath.prepared, true, JSON.stringify(result.nonOverlapTrackedReplacementProductPath, null, 2));
  assert.equal(result.nonOverlapTrackedReplacementProductPath.reason, 'RTK_FULL_MANUSCRIPT_EXACT_PRODUCT_PATH_READY');
  assert.equal(result.nonOverlapTrackedReplacementProductPath.writerCalled, false);
  assert.equal(result.nonOverlapTrackedReplacementProductPath.rendererAuthority, false);
  assert.equal(result.reviewSurface.fullManuscriptExactTextReturnPreview.applyCommandId, 'cmd.project.review.applyFullManuscriptExactTextReturn');
  assert.equal(result.reviewSurface.fullManuscriptExactTextReturnPreview.rendererAuthority, false);
  assert.equal(result.reviewSurface.fullManuscriptExactTextReturnPreview.productRuntimeWired, true);
  assert.equal(Object.prototype.hasOwnProperty.call(result.reviewSurface.fullManuscriptExactTextReturnPreview, 'sceneCommands'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.reviewSurface.fullManuscriptExactTextReturnPreview, 'fullManuscriptInput'), false);
  assert.equal(result.reviewSurface.exactTextPlanPreview.plan.fullManuscript, true);
  assert.equal(result.reviewSurface.exactTextPlanPreview.plan.applyOps.length, 2);
  assert.equal(calls.length, 0);

  const applied = await port.handleReviewSurfaceApplyFullManuscriptExactTextReturnCommandSurface({
    requestId: 'explicit-renderer-confirmed-full-manuscript-apply',
  });
  assert.equal(applied.ok, true, JSON.stringify(applied, null, 2));
  assert.equal(applied.applied, true);
  // MULTI-01: staged sequential apply certified as STAGED, not atomic.
  assert.equal(applied.result.multiSceneAtomicApplyCertified, false);
  assert.equal(applied.result.automaticApplyCertified, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].payload.requestId, 'explicit-renderer-confirmed-full-manuscript-apply');
  assert.equal(calls[0].payload.sceneCommands.length, 2);
  assert.equal(applied.reviewSurface.exactTextAppliedChangeIds.length, 2);
  assert.equal(applied.reviewSurface.rtkFullManuscriptNonOverlapTrackedReplacementApplyResult.status, 'applied');

  const mainSource = readMainSource();
  const rendererSource = fs.readFileSync(path.join(REPO_ROOT, 'src', 'renderer', 'editor.js'), 'utf8');
  const entitlementLaw = require(path.join(REPO_ROOT, 'src', 'core', 'entitlement-law-v1.cjs'));
  assert.match(mainSource, /'cmd\.project\.review\.applyFullManuscriptExactTextReturn': async/u);
  assert.match(mainSource, /COMMAND_SURFACE_KERNEL_COMMAND_IDS\.RTK_REVIEW_APPLY_MULTI_SCENE_NON_OVERLAP_TRACKED_REPLACEMENTS/u);
  assert.match(rendererSource, /REVIEW_SURFACE_FULL_MANUSCRIPT_EXACT_TEXT_APPLY_COMMAND_ID/u);
  assert.match(rendererSource, /data-review-apply-full-manuscript-exact/u);
  assert.ok(entitlementLaw.FREE_PRO_COMPLEXITY_COMMAND_IDS.includes('cmd.project.review.applyFullManuscriptExactTextReturn'));
  assert.deepEqual(
    entitlementLaw.decideCommandEntitlement('cmd.project.review.applyFullManuscriptExactTextReturn'),
    {
      ok: false,
      available: false,
      visible: false,
      access: 'pro_complexity_surface',
      reason: 'PRO_COMPLEXITY_SURFACE_UNAVAILABLE_IN_FREE',
      commandId: 'cmd.project.review.applyFullManuscriptExactTextReturn',
    },
  );
});

test('DOCX review preview session command: current-profile YRTK carrier authenticates full-manuscript packet and exposes exact lane', async () => {
  const {
    buildFullManuscriptDocxReviewPacketSource,
  } = require(path.join(REPO_ROOT, 'src', 'export', 'docx', 'fullManuscriptDocxReviewPacketSource.js'));
  const revisionBridge = await loadBridge();
  const sceneId = 'roman/current-profile-c1.txt';
  const sceneText = 'Alpha beta gamma.';
  const fullSource = buildFullManuscriptDocxReviewPacketSource({
    projectId: 'project-c1-current-profile',
    projectRoot: '/project',
    manifestPath: '/project/manifest.json',
    scenes: [
      {
        sceneId,
        scenePath: `/project/${sceneId}`,
        text: sceneText,
        order: 0,
      },
    ],
  }, {
    roundIdHex: 'c1000000000000000000000000000001',
    keyIdHex: 'c1000000000000000000000000000002',
    hmacSecret: 'local-secret-for-c1-current-profile',
    cryptoPort: c05CryptoPort,
    revisionBridge,
  });
  fullSource.localAuthorityCapsule.keyRef = importTestRoundKeyRef(
    fullSource.localAuthorityCapsule.roundId,
    fullSource.localAuthorityCapsule.hmacSecret,
  );
  fullSource.localAuthorityCapsule.lifecycleState = 'PUBLISHED_ACTIVE';
  const declaredBookmark = fullSource.localAuthorityCapsule.exportMap.scenes[0].blocks[0].wordSignals.find((signal) => signal.kind === 'bookmarkName').value.name;
  const returnedBytes = cleanDocxZip([
    '<w:p>',
    `<w:bookmarkStart w:id="7" w:name="${declaredBookmark}"/>`,
    '<w:r><w:t>Alpha </w:t></w:r>',
    '<w:del w:id="1"><w:r><w:delText>beta</w:delText></w:r></w:del>',
    '<w:ins w:id="2"><w:r><w:t>delta</w:t></w:r></w:ins>',
    '<w:r><w:t> gamma.</w:t></w:r>',
    '<w:bookmarkEnd w:id="7"/>',
    '</w:p>',
  ].join(''), [
    {
      name: '[Content_Types].xml',
      method: 8,
      body: productContentTypesXml({ includeComments: false }),
    },
    {
      name: '_rels/.rels',
      method: 8,
      body: productRootRelsXml(),
    },
    {
      name: 'docProps/custom.xml',
      method: 8,
      body: customPropertiesXml([
        { name: 'YRTK_C01_AUTH', value: customPropertyFromSource(fullSource, 'YRTK_C01_AUTH') },
        { name: 'YRTK2_TOKEN', value: customPropertyFromSource(fullSource, 'YRTK2_TOKEN') },
        { name: 'YRTK_CORE_DIGEST', value: fullSource.localAuthorityCapsule.coreManifestDigest },
      ]),
    },
  ]);
  const port = instantiateDocxReviewPreviewSessionPort({
    dispatchCommandSurfaceKernel: async () => {
      throw new Error('current-profile intake preview must not dispatch without explicit apply');
    },
  });

  const result = await port.handleDocxReviewPreviewSessionActivationCommandSurface(
    toPayload(returnedBytes),
    {
      activeReviewDocxExportAuthorityStore: {
        schemaVersion: 'yalken.rtk.word.product-review-docx-export.authority-store.v1',
        scope: 'full-manuscript',
        lastRoundId: fullSource.localAuthorityCapsule.roundId,
        roundsById: {
          [fullSource.localAuthorityCapsule.roundId]: fullSource.localAuthorityCapsule,
        },
        secretExposedToRenderer: false,
      },
      buildMainReviewContext: async () => reviewContext({
        projectId: 'project-c1-current-profile',
        projectRoot: '/project',
        scenePath: `/project/${sceneId}`,
        sceneText,
        targetScope: { type: 'scene', id: sceneId },
      }),
      buildRtkNonOverlapTrackedReplacementApplyInput: async () => null,
    },
  );

  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(result.returnIntake.authenticated, true);
  assert.equal(result.returnIntake.status, 'authenticated-return-ir-ready');
  assert.equal(result.returnIntake.authorityCarrierStatus, 'verified-baseline-bound');
  assert.equal(result.returnIntake.fullManuscriptExportMapTransport.present, true);
  assert.equal(result.returnIntake.fullManuscriptExportMapTransport.returnedArtifactExportMapAccepted, false);
  assert.equal(result.returnIntake.counts.textRevisions, 2);
  const textChanges = result.reviewSurface.revisionSession.reviewGraph.textChanges;
  assert.equal(textChanges.length, 1);
  assert.deepEqual(textChanges[0].targetScope, { type: 'scene', id: sceneId });
  assert.equal(textChanges[0].match.kind, 'exact');
  assert.equal(textChanges[0].match.quote, 'beta');
  assert.equal(textChanges[0].replacementText, 'delta');
  assert.equal(result.canAutoApply, false);
  assert.equal(result.canImportMutate, false);
  assert.equal(result.canWriteStorage, false);
});

test('DOCX review preview session command: authenticated return IR drives visible preview explicit apply and replay', async () => {
  const docx = productReviewDocxWithTrackedReplacement();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-rtk-p0-return-loop-'));
  const scenePath = path.join(tmpDir, 'scene-1.txt');
  fs.writeFileSync(scenePath, docx.sceneText, 'utf8');
  const bridge = await loadBridge();
  const calls = [];
  const applyHandler = bridge.createRtkNonOverlapTrackedReplacementCommandHandler({
    cryptoPort: c05CryptoPort,
    now: () => 1700000000000,
  });
  const port = instantiateDocxReviewPreviewSessionPort({
    dispatchCommandSurfaceKernel: async (commandId, payload = {}) => {
      calls.push({ commandId, payload: cloneJsonSafe(payload) });
      assert.equal(commandId, 'cmd.rtk.review.applyNonOverlapTrackedReplacements');
      return applyHandler(payload);
    },
  });
  const sceneHash = computeHash(docx.sceneText);
  const result = await port.handleDocxReviewPreviewSessionActivationCommandSurface(
    toPayload(docx.bytes),
    {
      activeReviewDocxExportAuthorityStore: productAuthorityStoreFromDocx(docx, {
        projectRoot: tmpDir,
        scenePath,
        baselineFinalText: docx.sceneText,
      }),
      buildMainReviewContext: async () => reviewContext({
        projectRoot: tmpDir,
        scenePath,
        sceneText: docx.sceneText,
        baselineHash: sceneHash,
        currentBaselineHash: sceneHash,
      }),
    },
  );

  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(result.returnIntake.authenticated, true);
  assert.equal(result.returnIntake.status, 'authenticated-return-ir-ready');
  assert.equal(result.nonOverlapTrackedReplacementProductPath.prepared, true, JSON.stringify(result.nonOverlapTrackedReplacementProductPath, null, 2));
  assert.equal(result.reviewSurface.rtkNonOverlapTrackedReplacementProductPath.productRuntimeWired, true);
  assert.equal(result.reviewSurface.rtkNonOverlapTrackedReplacementProductPath.automaticApplyCertified, false);
  assert.equal(fs.readFileSync(scenePath, 'utf8'), docx.sceneText);
  assert.equal(calls.length, 0);

  const textChanges = result.reviewSurface.revisionSession.reviewGraph.textChanges;
  assert.equal(textChanges.length, 1);
  assert.equal(textChanges[0].match.kind, 'exact');
  assert.equal(textChanges[0].match.quote, docx.deletedText);
  assert.equal(textChanges[0].replacementText, docx.insertedText);
  assert.equal(textChanges[0].rtkProductPath, 'nonOverlapTrackedReplacement');

  const applied = await port.handleReviewSurfaceApplyExactTextChangeCommandSurface({
    requestId: 'apply-authenticated-return-ir',
    changeId: textChanges[0].changeId,
  });
  assert.equal(applied.ok, true, JSON.stringify(applied, null, 2));
  assert.equal(applied.applied, true);
  assert.equal(applied.result.status, 'applied');
  assert.equal(applied.result.writerCalled, true);
  assert.equal(fs.readFileSync(scenePath, 'utf8'), 'Alpha delta gamma.');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].payload.previewConfirmed, true);
  assert.equal(calls[0].payload.returnArtifactSha256, result.returnIntake.returnedArtifactSha256);
  assert.equal(calls[0].payload.reviewIr.textRevisions.length, 2);
  assert.equal(calls[0].payload.authorityCarrier.selectedCarrier.payload.roundId, docx.payload.roundId);

  const replay = await port.handleReviewSurfaceApplyExactTextChangeCommandSurface({
    requestId: 'apply-authenticated-return-ir-replay',
    changeId: textChanges[0].changeId,
  });
  assert.equal(replay.ok, true, JSON.stringify(replay, null, 2));
  assert.equal(replay.replay, true);
  assert.equal(replay.result.status, 'replay');
  assert.equal(fs.readFileSync(scenePath, 'utf8'), 'Alpha delta gamma.');
  assert.equal(calls.length, 2);
});

test('DOCX review preview session command: real Google C4 return parser projection is 12 physical paragraphs', async () => {
  const bridge = await loadBridge();
  const bytes = fs.readFileSync(GOOGLE_C4_NATIVE_RETURN_FIXTURE_PATH);
  assert.equal(
    crypto.createHash('sha256').update(bytes).digest('hex'),
    GOOGLE_C4_NATIVE_RETURN_FIXTURE_SHA256,
  );
  const provenance = JSON.parse(fs.readFileSync(GOOGLE_C4_NATIVE_RETURN_FIXTURE_PROVENANCE_PATH, 'utf8'));
  assert.equal(provenance.fixtureKind, 'SANITIZED_DERIVATIVE_OF_PHYSICAL_RETURN');
  assert.equal(provenance.originalExternalArtifactSha256, GOOGLE_C4_NATIVE_RETURN_ORIGINAL_EXTERNAL_ARTIFACT_SHA256);
  assert.equal(provenance.sanitizedFixtureSha256, GOOGLE_C4_NATIVE_RETURN_FIXTURE_SHA256);
  assert.equal(Object.hasOwn(provenance, 'nativeGoogleDocId'), false);
  assert.equal(Object.hasOwn(provenance, 'providerDocumentIdentifier'), false);
  assert.equal(provenance.sanitization.documentXmlUtf16LengthPreserved, true);
  assert.equal(
    provenance.xmlDigestBinding.sourceDocumentXmlUtf16Length,
    provenance.xmlDigestBinding.sanitizedDocumentXmlUtf16Length,
  );
  const documentXml = readZipEntryText(bytes, 'word/document.xml');
  const commentsXml = readZipEntryText(bytes, 'word/comments.xml');
  assert.deepEqual(
    xmlAuthorAttributeValues(documentXml),
    [GOOGLE_C4_PR1918_SANITIZED_AUTHOR_PSEUDONYM, GOOGLE_C4_PR1918_SANITIZED_AUTHOR_PSEUDONYM],
  );
  assert.deepEqual(
    xmlAuthorAttributeValues(commentsXml),
    [GOOGLE_C4_PR1918_SANITIZED_AUTHOR_PSEUDONYM],
  );

  const result = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes }, { cryptoPort: c05CryptoPort });

  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(result.sourceMode, 'TRACKED');
  assert.equal(result.reviewIr.formattingParagraphs.length, 12);
  assert.deepEqual(
    result.reviewIr.formattingParagraphs.map((paragraph) => paragraph.paragraphIndex),
    Array.from({ length: 12 }, (_, index) => index),
  );
  assert.deepEqual(
    result.reviewIr.formattingParagraphs.map((paragraph) => paragraph.bookmarkNames),
    Array.from({ length: 12 }, () => []),
  );
  assert.equal(result.reviewIr.formattingParagraphs[0].paragraphText, '[plainTextPreserved] Body text sentinel omega.');
  assert.equal(result.reviewIr.formattingParagraphs[0].trackedRevision, true);

  const revisionsByOperation = new Map(result.reviewIr.textRevisions.map((revision) => [revision.operation, revision]));
  assert.equal(result.reviewIr.textRevisions.length, 2);
  assert.equal(revisionsByOperation.get('delete').text, 'sentinel alpha');
  assert.equal(revisionsByOperation.get('insert').text, 'sentinel omega');
  assert.equal(revisionsByOperation.get('delete').paragraphIndex, 0);
  assert.equal(revisionsByOperation.get('insert').paragraphIndex, 0);

  assert.equal(result.reviewIr.commentThreads.length, 1);
  assert.equal(result.reviewIr.commentThreads[0].status, 'ANCHORED');
  assert.equal(result.reviewIr.commentThreads[0].paragraphIndex, 0);
  assert.deepEqual(result.reviewIr.commentThreads[0].anchorLocator.bookmarkNames, []);
});

test('DOCX review preview session command: C4 block authority is derived from main-owned scene ordinal capsule', async () => {
  const bridge = await loadBridge();
  const result = bridge.evaluateReviewTransportBlockExactAuthorityV2(
    googleC4BlockAuthorityInput(),
    { cryptoPort: c05CryptoPort },
  );

  assert.equal(result.status, 'exact-authority-ready', JSON.stringify(result, null, 2));
  assert.equal(result.targetBlockId, 'block-google-c4-0000');
  assert.equal(result.exactAuthority.uniqueTarget, true);
  assert.equal(result.exactAuthority.nonOverlapping, true);
  assert.equal(result.exactTextAnchors[0].documentParagraphIndex, 0);
  assert.equal(result.exactTextAnchors[0].start, '[plainTextPreserved] Body text '.length);
  assert.equal(result.exactTextAnchors[0].end, '[plainTextPreserved] Body text sentinel alpha'.length);

  const sameTextElsewhere = bridge.evaluateReviewTransportBlockExactAuthorityV2(
    googleC4BlockAuthorityInput({
      mutate: ({ localBaseline }) => {
        localBaseline.sceneBlocks[1].text = 'another block with sentinel alpha';
        localBaseline.sceneOrdinalAuthority.currentRawSha256 = c05Sha256Text(
          localBaseline.sceneBlocks.map((block) => block.text).join('\n'),
        );
      },
    }),
    { cryptoPort: c05CryptoPort },
  );
  assert.equal(sameTextElsewhere.status, 'exact-authority-ready', JSON.stringify(sameTextElsewhere, null, 2));
  assert.equal(sameTextElsewhere.targetBlockId, 'block-google-c4-0000');
  assert.equal(sameTextElsewhere.exactTextAnchors[0].blockId, 'block-google-c4-0000');
});

test('DOCX review preview session command: C4 runtime admits Google replacement pair with shared native revision id', async () => {
  const bridge = await loadBridge();
  const input = googleC4BlockAuthorityInput({
    mutate: ({ reviewIr, localBaseline }) => {
      for (const revision of reviewIr.textRevisions) {
        revision.nativeRevisionId = '0';
      }
      for (const touched of localBaseline.sceneOrdinalAuthority.touchedParagraphs) {
        touched.id = '0';
      }
    },
  });
  const sceneText = input.localBaseline.sceneBlocks.map((block) => block.text).join('\n');
  const sceneId = input.localBaseline.sceneId;
  const sourceRevisionSha256 = c05Sha256Text(sceneText);
  const commandId = 'cmd.rtk.review.applyNonOverlapTrackedReplacements';
  const source = {
    projectId: 'project-google-c4-shared-native-id',
    rootId: 'root-google-c4-shared-native-id',
    documentId: sceneId,
    canonicalRevision: sourceRevisionSha256,
    workingRevision: sourceRevisionSha256,
    sourceDigest: sourceRevisionSha256,
  };
  input.returnLifecycleState = 'RETURN_ANALYZED';
  input.roundId = 'round-google-c4-shared-native-id';
  input.requestId = 'request-google-c4-shared-native-id';
  input.exportIdentity = 'export-google-c4-shared-native-id';
  input.returnArtifactSha256 = c05Sha256Text('returned-google-c4-shared-native-id');
  input.manifestDigest = c05Sha256Text('manifest-google-c4-shared-native-id');
  input.analysisDigest = c05Sha256Text('analysis-google-c4-shared-native-id');
  input.sourceIdentity = {
    sourceTokenDomain: 'SOURCE_TOKEN_DOMAIN_V1',
    writerTextDomain: 'WRITER_TEXT_DOMAIN_V1',
    projectId: source.projectId,
    rootId: source.rootId,
    documentId: source.documentId,
    canonicalRevision: source.canonicalRevision,
    workingRevision: source.workingRevision,
    revisionSha256: sourceRevisionSha256,
    rawBytesSha256: sourceRevisionSha256,
  };
  input.currentIdentity = {
    projectId: source.projectId,
    rootId: source.rootId,
    documentId: source.documentId,
    canonicalRevision: source.canonicalRevision,
    workingRevision: source.workingRevision,
    revisionSha256: sourceRevisionSha256,
    rawBytesSha256: sourceRevisionSha256,
  };
  input.sourceFence = c05SourceFenceBinding({ commandId, source });
  input.writerContext = {
    projectRoot: '/project',
    scenePath: '/project/roman/google-c4-direct.txt',
    scenePathBySceneId: { [sceneId]: '/project/roman/google-c4-direct.txt' },
    projectSnapshot: {
      projectId: source.projectId,
      scenes: [{ sceneId, text: sceneText }],
    },
    revisionSession: {
      projectId: source.projectId,
      sessionId: 'session-google-c4-shared-native-id',
      reviewGraph: {},
    },
  };
  input.previewConfirmed = true;

  const preview = bridge.buildNonOverlapTrackedReplacementRuntimePreview(input, { cryptoPort: c05CryptoPort });

  assert.equal(preview.ok, true, JSON.stringify(preview, null, 2));
  assert.equal(preview.binding.blockAuthority.targetBlockId, 'block-google-c4-0000');
  assert.equal(preview.binding.writerInput.reviewItems.length, 1);
  assert.deepEqual(preview.binding.writerInput.reviewItems[0].sourceRevisionIds, ['0', '0']);
  assert.deepEqual(
    preview.binding.writerInput.reviewItems[0].sourceRevisionRefs
      .map((ref) => `${ref.operation}:${ref.nativeRevisionId}`)
      .sort(),
    ['delete:0', 'insert:0'],
  );
  assert.equal(preview.binding.trustedBlockRangeDigests.length, 1);
});

test('DOCX review preview session command: C4 scene ordinal capsule rejects forged or stale authority', async () => {
  const bridge = await loadBridge();
  const cases = [
    [
      'cardinality',
      ({ localBaseline }) => {
        localBaseline.sceneOrdinalAuthority.returnedParagraphCount = 11;
      },
      'RTK_COMMAND_ENVELOPE_TAMPERED',
    ],
    [
      'tampered-kind',
      ({ localBaseline }) => {
        localBaseline.authorityKind = 'renderer-owned-scene-export-map-ordinal-v1';
      },
      'RTK_BLOCKED_AUTHORITY_KIND_TAMPERED',
    ],
    [
      'missing-capsule',
      ({ localBaseline }) => {
        delete localBaseline.sceneOrdinalAuthority;
      },
      'RTK_BLOCKED_AUTHORITY_KIND_TAMPERED',
    ],
    [
      'duplicate-target-text',
      ({ localBaseline }) => {
        localBaseline.sceneBlocks[0].text = '[plainTextPreserved] Body text sentinel alpha sentinel alpha.';
        localBaseline.sceneOrdinalAuthority.currentRawSha256 = c05Sha256Text(
          localBaseline.sceneBlocks.map((block) => block.text).join('\n'),
        );
      },
      'RTK_BLOCKED_AMBIGUOUS_TEXT',
    ],
    [
      'stale-current-raw-sha',
      ({ localBaseline }) => {
        localBaseline.sceneOrdinalAuthority.currentRawSha256 = 'sha256:bad';
      },
      'RTK_COMMAND_ENVELOPE_TAMPERED',
    ],
    [
      'scene-id-mismatch',
      ({ localBaseline }) => {
        localBaseline.sceneOrdinalAuthority.sceneId = 'roman/other-scene.txt';
      },
      'RTK_COMMAND_ENVELOPE_TAMPERED',
    ],
    [
      'target-block-document-paragraph-index-mismatch',
      ({ localBaseline }) => {
        localBaseline.sceneBlocks[0].documentParagraphIndex = 1;
      },
      'RTK_COMMAND_ENVELOPE_TAMPERED',
    ],
    [
      'index-only-without-selected-block',
      ({ localBaseline }) => {
        delete localBaseline.blockId;
      },
      'RTK_MANUAL_DEGRADED_LOCATOR',
    ],
  ];

  for (const [name, mutate, code] of cases) {
    const result = bridge.evaluateReviewTransportBlockExactAuthorityV2(
      googleC4BlockAuthorityInput({ mutate }),
      { cryptoPort: c05CryptoPort },
    );
    assert.equal(result.status, 'manual-or-blocked', `${name}: ${JSON.stringify(result, null, 2)}`);
    assert.equal(result.exactAuthority.uniqueTarget, false, name);
    assert.equal(result.reasons.some((reason) => reason.code === code), true, `${name}: ${JSON.stringify(result.reasons, null, 2)}`);
  }
});

test('DOCX review preview session command: C4 paragraph projection failures block before writer dispatch', async () => {
  const cases = [
    [
      'formattingParagraphs absent',
      ({ mutateReviewIr: (reviewIr) => { delete reviewIr.formattingParagraphs; } }),
      'RTK_RETURN_INTAKE_SCENE_PARAGRAPH_PROJECTION_REQUIRED',
    ],
    [
      'paragraph index absent',
      ({ mutateReviewIr: (reviewIr) => {
        delete reviewIr.formattingParagraphs[0].paragraphIndex;
        delete reviewIr.formattingParagraphs[0].documentParagraphIndex;
      } }),
      'RTK_RETURN_INTAKE_SCENE_PARAGRAPH_INDEX_REQUIRED',
    ],
    [
      '11 paragraph cardinality',
      ({ mutateReviewIr: (reviewIr) => { reviewIr.formattingParagraphs.pop(); } }),
      'RTK_RETURN_INTAKE_SCENE_PARAGRAPH_PROJECTION_CARDINALITY_MISMATCH',
    ],
    [
      '13 paragraph cardinality',
      ({ mutateReviewIr: (reviewIr) => {
        reviewIr.formattingParagraphs.push({
          paragraphIndex: 12,
          documentParagraphIndex: 12,
          paragraphText: 'extra paragraph',
          trackedRevision: false,
          bookmarkNames: [],
          formattedRuns: [],
        });
      } }),
      'RTK_RETURN_INTAKE_SCENE_PARAGRAPH_PROJECTION_CARDINALITY_MISMATCH',
    ],
    [
      'reordered array index',
      ({ mutateReviewIr: (reviewIr) => {
        [reviewIr.formattingParagraphs[0], reviewIr.formattingParagraphs[1]] = [
          reviewIr.formattingParagraphs[1],
          reviewIr.formattingParagraphs[0],
        ];
      } }),
      'RTK_RETURN_INTAKE_SCENE_PARAGRAPH_PROJECTION_ORDER_MISMATCH',
    ],
    [
      'duplicate paragraph index',
      ({ mutateReviewIr: (reviewIr) => { reviewIr.formattingParagraphs[1].paragraphIndex = 0; } }),
      'RTK_RETURN_INTAKE_SCENE_PARAGRAPH_INDEX_DUPLICATE',
    ],
    [
      'out of range paragraph index',
      ({ mutateReviewIr: (reviewIr) => { reviewIr.formattingParagraphs[11].paragraphIndex = 99; } }),
      'RTK_RETURN_INTAKE_SCENE_PARAGRAPH_INDEX_OUT_OF_RANGE',
    ],
    [
      'untouched paragraph text changed',
      ({ mutateReviewIr: (reviewIr) => { reviewIr.formattingParagraphs[1].paragraphText = 'changed untouched paragraph'; } }),
      'RTK_RETURN_INTAKE_SCENE_RETURNED_TEXT_MISMATCH',
    ],
    [
      'wrong touched replacement result',
      ({ mutateReviewIr: (reviewIr) => { reviewIr.formattingParagraphs[0].paragraphText = 'sentinel zeta'; } }),
      'RTK_RETURN_INTAKE_SCENE_RETURNED_TEXT_MISMATCH',
    ],
    [
      'missing revision paragraph index',
      ({ mutateReviewIr: (reviewIr) => {
        delete reviewIr.textRevisions[0].paragraphIndex;
        delete reviewIr.textRevisions[0].documentParagraphIndex;
      } }),
      'RTK_RETURN_INTAKE_SCENE_TOUCHED_PARAGRAPH_INDEX_REQUIRED',
    ],
    [
      'missing comment paragraph index',
      ({ mutateReviewIr: (reviewIr) => {
        delete reviewIr.commentThreads[0].paragraphIndex;
        delete reviewIr.commentThreads[0].documentParagraphIndex;
        delete reviewIr.commentThreads[0].anchorLocator.paragraphIndex;
      } }),
      'RTK_RETURN_INTAKE_SCENE_TOUCHED_PARAGRAPH_INDEX_REQUIRED',
    ],
    [
      'partial delete insert pair',
      ({ mutateReviewIr: (reviewIr) => {
        reviewIr.textRevisions = reviewIr.textRevisions.filter((revision) => revision.operation !== 'insert');
      } }),
      'RTK_RETURN_INTAKE_SCENE_PARTIAL_ANCHOR',
    ],
    [
      'stale scene hash',
      ({ mutateExportMap: (exportMap) => { exportMap.scenes[0].rawSha256 = 'sha256:bad'; } }),
      'RTK_RETURN_INTAKE_SCENE_EXPORT_MAP_STALE',
    ],
  ];

  for (const [name, options, expectedCode] of cases) {
    const { result, calls } = await runGoogleC4SceneActivation(options);
    assert.equal(
      activationResultCodes(result).includes(expectedCode),
      true,
      `${name}: ${JSON.stringify(result, null, 2)}`,
    );
    assert.equal(
      calls.filter((call) => call.commandId === 'cmd.rtk.review.applyNonOverlapTrackedReplacements').length,
      0,
      name,
    );
  }
});

test('DOCX review preview session command: C4 product path accepts Google leading blank paragraph prefix only with shifted ordinal authority', async () => {
  const shiftParagraphIndex = (value) => (Number.isSafeInteger(value) ? value + 1 : value);
  const { result, calls, scenePath } = await runGoogleC4SceneActivation({
    explicitCanonicalApplyConfirmed: true,
    mutateReviewIr: (reviewIr) => {
      for (const paragraph of reviewIr.formattingParagraphs) {
        paragraph.paragraphIndex = shiftParagraphIndex(paragraph.paragraphIndex);
        paragraph.documentParagraphIndex = shiftParagraphIndex(paragraph.documentParagraphIndex);
      }
      reviewIr.formattingParagraphs.unshift({
        paragraphIndex: 0,
        documentParagraphIndex: 0,
        paragraphText: '',
        trackedRevision: false,
        bookmarkNames: [],
        formattedRuns: [],
      });
      for (const revision of reviewIr.textRevisions) {
        revision.paragraphIndex = shiftParagraphIndex(revision.paragraphIndex);
        revision.documentParagraphIndex = shiftParagraphIndex(revision.documentParagraphIndex);
      }
      for (const thread of reviewIr.commentThreads) {
        thread.paragraphIndex = shiftParagraphIndex(thread.paragraphIndex);
        thread.documentParagraphIndex = shiftParagraphIndex(thread.documentParagraphIndex);
        if (thread.anchorLocator) {
          thread.anchorLocator.paragraphIndex = shiftParagraphIndex(thread.anchorLocator.paragraphIndex);
        }
      }
    },
  });

  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(result.returnIntake.authenticated, true, JSON.stringify(result.returnIntake, null, 2));
  assert.equal(result.nonOverlapTrackedReplacementProductPath.prepared, true, JSON.stringify(result.nonOverlapTrackedReplacementProductPath, null, 2));
  const textChanges = result.reviewSurface.revisionSession.reviewGraph.textChanges;
  assert.equal(textChanges.length, 1);
  assert.equal(textChanges[0].rtkProductPath, 'nonOverlapTrackedReplacement');
  assert.equal(textChanges[0].match.blockId, 'block-c4-google-0001');
  assert.equal(textChanges[0].paragraphIndex, 0);
  assert.equal(textChanges[0].documentParagraphIndex, 0);
  assert.equal(result.preCommentExactTextApplyResult.ok, true, JSON.stringify(result.preCommentExactTextApplyResult, null, 2));
  assert.equal(result.preCommentExactTextApplyResult.applied, true);
  assert.equal(result.commentProductPath.ok, true, JSON.stringify(result.commentProductPath, null, 2));
  assert.equal(result.commentProductPath.status, 'applied-and-replayed');
  assert.equal(fs.readFileSync(scenePath, 'utf8'), [
    'sentinel omega',
    'context line 02',
    'context line 03',
    'context line 04',
    'context line 05',
    'context line 06',
    'context line 07',
    'context line 08',
    'context line 09',
    'context line 10',
    'context line 11',
    'context line 12',
  ].join('\n'));
  assert.equal(
    calls.filter((call) => call.commandId === 'cmd.rtk.review.applyNonOverlapTrackedReplacements').length,
    1,
  );
  const applyCall = calls.find((call) => call.commandId === 'cmd.rtk.review.applyNonOverlapTrackedReplacements');
  const rootCall = calls.find((call) => call.commandId === 'cmd.rtk.review.applyRootCommentReturn');
  assert.ok(rootCall, JSON.stringify(calls.map((call) => call.commandId)));
  assert.equal(rootCall.payload.anchor.blockId, 'block-c4-google-0001');
  assert.equal(rootCall.payload.anchor.paragraphIndex, 0);
  assert.equal(rootCall.payload.nativeOwnership.groupId, 'google-c4-ordinal');
  assert.equal(rootCall.payload.nativeOwnership.relationMode, 'WITHIN_INSERT');
  assert.equal(rootCall.payload.selectedText, 'sentinel omeg');
  assert.equal(rootCall.payload.selectedTextSource, 'parser-quote-within-insert');
  assert.equal(rootCall.payload.sceneText.startsWith('sentinel omega'), true);
  assert.deepEqual(
    applyCall.payload.localBaseline.sceneOrdinalAuthority.touchedParagraphs.map((item) => [
      item.rawReturnedParagraphIndex,
      item.documentParagraphIndex,
      item.blockId,
    ]),
    [
      [1, 0, 'block-c4-google-0001'],
      [1, 0, 'block-c4-google-0001'],
      [1, 0, 'block-c4-google-0001'],
    ],
  );
});

test('DOCX review preview session command: C4 sanitized physical derivative applies exact text before root comment', async () => {
  const bridge = await loadBridge();
  const returnedBytes = fs.readFileSync(GOOGLE_C4_PR1918_SANITIZED_DERIVATIVE_FIXTURE_PATH);
  assert.equal(
    crypto.createHash('sha256').update(returnedBytes).digest('hex'),
    GOOGLE_C4_PR1918_SANITIZED_DERIVATIVE_FIXTURE_SHA256,
  );
  const provenance = JSON.parse(fs.readFileSync(GOOGLE_C4_PR1918_SANITIZED_DERIVATIVE_FIXTURE_PROVENANCE_PATH, 'utf8'));
  assert.equal(provenance.fixtureKind, 'SANITIZED_DERIVATIVE_OF_PHYSICAL_RETURN');
  assert.equal(provenance.originalExternalArtifactSha256, GOOGLE_C4_PR1918_EXTERNAL_PHYSICAL_ARTIFACT_SHA256);
  assert.equal(provenance.sanitizedFixtureSha256, GOOGLE_C4_PR1918_SANITIZED_DERIVATIVE_FIXTURE_SHA256);
  assert.equal(Object.hasOwn(provenance, 'nativeGoogleDocId'), false);
  assert.equal(Object.hasOwn(provenance, 'providerDocumentIdentifier'), false);
  assert.equal(provenance.sanitization.documentXmlUtf16LengthPreserved, true);
  assert.equal(
    provenance.xmlDigestBinding.sourceDocumentXmlUtf16Length,
    provenance.xmlDigestBinding.sanitizedDocumentXmlUtf16Length,
  );
  assert.equal(provenance.parserInvariant.insertXmlRange.openStart, 2123);
  assert.equal(provenance.parserInvariant.insertXmlRange.closeEnd, 2524);
  assert.equal(provenance.parserInvariant.deleteXmlRange.openStart, 2524);
  assert.equal(provenance.parserInvariant.deleteXmlRange.closeEnd, 3049);
  const documentXml = readZipEntryText(returnedBytes, 'word/document.xml');
  const commentsXml = readZipEntryText(returnedBytes, 'word/comments.xml');
  assert.deepEqual(
    xmlAuthorAttributeValues(documentXml),
    [GOOGLE_C4_PR1918_SANITIZED_AUTHOR_PSEUDONYM, GOOGLE_C4_PR1918_SANITIZED_AUTHOR_PSEUDONYM],
  );
  assert.deepEqual(
    xmlAuthorAttributeValues(commentsXml),
    [GOOGLE_C4_PR1918_SANITIZED_AUTHOR_PSEUDONYM],
  );
  const parserResult = bridge.buildDocxReviewTransportAnalysisFromZipBytes({
    bytes: returnedBytes,
    returnedArtifactSha256: `sha256:${GOOGLE_C4_PR1918_SANITIZED_DERIVATIVE_FIXTURE_SHA256}`,
    requestId: 'c4-pr1918-sanitized-derivative-parser-proof',
  }, {
    cryptoPort: c05CryptoPort,
  });
  assert.equal(parserResult.ok, true, JSON.stringify(parserResult, null, 2));
  assert.equal(parserResult.reviewIr.commentThreads[0].quotedAnchorText, 'omegasentinel');
  assert.equal(parserResult.reviewIr.commentThreads[0].paragraphIndex, 0);
  assert.equal(parserResult.reviewIr.commentThreads[0].relatedReplacementGroup.relationMode, 'CROSS_REPLACEMENT');
  assert.equal(parserResult.reviewIr.commentThreads[0].relatedReplacementGroup.groupId, 'c1b5771a4816c512ba2a9e2ed1c1c249e7beecee833dd32151df2e803c9411c8');
  assert.match(parserResult.reviewIr.commentThreads[0].relatedReplacementGroup.relationDigest, /^sha256:[0-9a-f]{64}$/u);
  assert.equal(parserResult.reviewIr.textRevisions.length, 2);
  assert.deepEqual(
    parserResult.reviewIr.textRevisions.map((revision) => [
      revision.operation,
      revision.text,
      revision.replacementGroupId,
      revision.sourceXmlProvenance.openStart,
      revision.sourceXmlProvenance.closeEnd,
    ]),
    [
      ['insert', 'sentinel omega', 'c1b5771a4816c512ba2a9e2ed1c1c249e7beecee833dd32151df2e803c9411c8', 2123, 2524],
      ['delete', 'sentinel alpha', 'c1b5771a4816c512ba2a9e2ed1c1c249e7beecee833dd32151df2e803c9411c8', 2524, 3049],
    ],
  );
  const packet = bridge.buildReturnEvidencePacketV1({
    requestId: 'c4-pr1918-sanitized-derivative-parser-proof',
    artifactSha256: `sha256:${GOOGLE_C4_PR1918_SANITIZED_DERIVATIVE_FIXTURE_SHA256}`,
    effectiveBudgets: { maxWorkerOutputBytes: 16 * 1024 * 1024 },
    effectiveBudgetDigest: c05CryptoPort.sha256Json({ maxWorkerOutputBytes: 16 * 1024 * 1024 },
    ),
    resourceReceipt: { parserStatus: parserResult.status, sourceMode: parserResult.sourceMode },
    packageInventoryDigest: c05CryptoPort.sha256Json(parserResult.packageInventory || {}),
    unverifiedCarrierEvidence: parserResult.authorityCarrier || {},
    returnedProjection: parserResult.reviewIr,
    projectionDigest: parserResult.supportedSemanticDigest || parserResult.analysisDigest,
    diagnostics: parserResult.reasons || [],
    workerBuildDigest: parserResult.parserProfileDigest,
  });
  const candidate = bridge.buildDocxReviewPreviewSessionCandidateFromEvidence(packet, {
    targetScope: { type: 'scene', id: 'roman/черновик.txt' },
    createdAt: '2026-09-15T13:52:15.466Z',
    fullManuscriptExportMap: capturedC4PhysicalExportMap(),
  });
  assert.equal(candidate.status, 'ready', JSON.stringify(candidate, null, 2));
  const rawReviewIr = cloneJsonSafe(candidate.reviewPacket);
  const capturedBlockId = 'block-0001-257e76631298cbeb';
  assert.equal(rawReviewIr.textChanges[0].match.blockId, capturedBlockId);
  assert.equal(rawReviewIr.textChanges[0].paragraphIndex, 0);
  assert.equal(rawReviewIr.textChanges[0].nativeReplacementGroupId, 'c1b5771a4816c512ba2a9e2ed1c1c249e7beecee833dd32151df2e803c9411c8');
  assert.equal(rawReviewIr.commentPlacements[0].sceneAuthority.blockId, capturedBlockId);
  assert.equal(rawReviewIr.commentPlacements[0].relatedReplacementGroupId, 'c1b5771a4816c512ba2a9e2ed1c1c249e7beecee833dd32151df2e803c9411c8');
  assert.equal(rawReviewIr.commentPlacements[0].relatedReplacementGroupMode, 'CROSS_REPLACEMENT');
  const rawReviewIrDigestBefore = computeHash(JSON.stringify(rawReviewIr));
  const rawProjectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-c4-sanitized-derivative-command-'));
  const rawScenePath = path.join(rawProjectRoot, 'roman', 'черновик.txt');
  fs.mkdirSync(path.dirname(rawScenePath), { recursive: true });
  fs.writeFileSync(rawScenePath, capturedC4PhysicalSceneText(), 'utf8');
  const rawPlan = bridge.buildAuthenticatedCommentReturnCommands({
    authenticated: true,
    projectId: 'project-844fa157-ff48-4110-b928-b99be8cdf946',
    projectRoot: rawProjectRoot,
    returnArtifactId: `sha256:${GOOGLE_C4_PR1918_SANITIZED_DERIVATIVE_FIXTURE_SHA256}`,
    localAuthorityCapsule: {
      projectId: 'project-844fa157-ff48-4110-b928-b99be8cdf946',
      projectRoot: rawProjectRoot,
      scenePathBySceneId: { 'roman/черновик.txt': rawScenePath },
      baselineFinalTextBySceneId: { 'roman/черновик.txt': capturedC4PhysicalSceneText() },
    },
    reviewIr: rawReviewIr,
  });
  assert.equal(computeHash(JSON.stringify(rawReviewIr)), rawReviewIrDigestBefore);
  assert.equal(rawPlan.ok, true, JSON.stringify(rawPlan, null, 2));
  const rawRootPayload = rawPlan.commands.find((command) => command.family === 'root_comment').payload;
  assert.equal(rawRootPayload.selectedText, 'sentinel omega');
  assert.equal(rawRootPayload.rawParserQuote, 'omegasentinel');
  assert.equal(rawRootPayload.anchor.blockId, capturedBlockId);
  assert.equal(rawRootPayload.anchor.nativeReplacementGroupId, 'c1b5771a4816c512ba2a9e2ed1c1c249e7beecee833dd32151df2e803c9411c8');
  const rawRootHandler = bridge.createRtkRootCommentReturnCommandHandler();
  const rawApplied = await rawRootHandler(rawRootPayload);
  assert.equal(rawApplied.ok, true, JSON.stringify(rawApplied, null, 2));
  assert.equal(rawApplied.status, 'applied');
  const rawReplay = await rawRootHandler(rawRootPayload);
  assert.equal(rawReplay.ok, true, JSON.stringify(rawReplay, null, 2));
  assert.equal(rawReplay.status, 'replay');

  const activationOptions = {
    explicitCanonicalApplyConfirmed: true,
    useRealReturnIntakeParser: true,
    physicalConcatenatedCommentAnchor: true,
  };

  const { result, calls, scenePath } = await runGoogleC4SceneActivation(activationOptions);

  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.match(result.returnIntake.returnedArtifactSha256, /^sha256:[0-9a-f]{64}$/u);
  assert.equal(result.returnIntake.utilityProcess.mode, 'inline-test-fallback');
  assert.equal(result.preCommentExactTextApplyResult.ok, true, JSON.stringify(result.preCommentExactTextApplyResult, null, 2));
  assert.equal(result.preCommentExactTextApplyResult.applied, true);
  assert.equal(result.commentProductPath.ok, true, JSON.stringify(result.commentProductPath, null, 2));
  assert.equal(result.commentProductPath.status, 'applied-and-replayed');

  const exactApplyIndex = calls.findIndex((call) => (
    call.commandId === 'cmd.rtk.review.applyNonOverlapTrackedReplacements'
  ));
  const rootApplyIndex = calls.findIndex((call) => (
    call.commandId === 'cmd.rtk.review.applyRootCommentReturn'
  ));
  assert.ok(exactApplyIndex >= 0, JSON.stringify(calls.map((call) => call.commandId)));
  assert.ok(rootApplyIndex > exactApplyIndex, JSON.stringify(calls.map((call) => call.commandId)));

  const rootPayload = calls[rootApplyIndex].payload;
  assert.equal(rootPayload.selectedText, 'sentinel omega');
  assert.equal(rootPayload.rawParserQuote, 'omegasentinel');
  assert.equal(rootPayload.selectedTextSource, 'authenticated-replacement');
  assert.equal(rootPayload.anchor.authoritySource, 'rtk-non-overlap-product-replacement-authority');
  assert.equal((rootPayload.sceneText.match(/sentinel omega/g) || []).length, 1);
  assert.equal(rootPayload.sceneText.includes('sentinel alpha'), false);
  assert.equal(fs.readFileSync(scenePath, 'utf8').startsWith('sentinel omega'), true);

  const withinInsertActivation = await runGoogleC4SceneActivation({
    explicitCanonicalApplyConfirmed: true,
    useRealReturnIntakeParser: true,
  });
  assert.equal(withinInsertActivation.result.ok, true, JSON.stringify(withinInsertActivation.result, null, 2));
  assert.equal(withinInsertActivation.result.commentProductPath.ok, true, JSON.stringify(withinInsertActivation.result.commentProductPath, null, 2));
  const withinInsertRootApplyIndex = withinInsertActivation.calls.findIndex((call) => (
    call.commandId === 'cmd.rtk.review.applyRootCommentReturn'
  ));
  assert.ok(withinInsertRootApplyIndex >= 0, JSON.stringify(withinInsertActivation.calls.map((call) => call.commandId)));
  const withinInsertRootPayload = withinInsertActivation.calls[withinInsertRootApplyIndex].payload;
  assert.equal(withinInsertRootPayload.selectedText, 'a');
  assert.equal(withinInsertRootPayload.rawParserQuote, 'a');
  assert.equal(withinInsertRootPayload.nativeOwnership.relationMode, 'WITHIN_INSERT');
  assert.equal(withinInsertRootPayload.sceneText.startsWith('sentinel omega'), true);
});

test('DOCX review preview session command: C4 source comment anchor association fails closed on unowned replacement groups', async () => {
  const bridge = await loadBridge();
  const plan = (input) => bridge.buildAuthenticatedCommentReturnCommands(input);
  const blockedCodes = (result) => (Array.isArray(result.typedBlocked) ? result.typedBlocked : [])
    .map((item) => item.code);

  const positive = plan(c4PhysicalCommentCommandInput());
  assert.equal(positive.ok, true, JSON.stringify(positive, null, 2));
  const rootPayload = positive.commands.find((command) => command.family === 'root_comment').payload;
  assert.equal(rootPayload.selectedText, 'sentinel omega');
  assert.equal(rootPayload.rawParserQuote, 'omegasentinel');
  assert.equal(rootPayload.nativeOwnership.groupId, 'replacement-group-c4-native-0');

  const ambiguous = plan(c4PhysicalCommentCommandInput({
    mutateTextChanges: (textChanges) => {
      textChanges.push({
        ...cloneJsonSafe(textChanges[0]),
        changeId: 'docx-tracked-replace-second',
      });
    },
  }));
  assert.equal(ambiguous.ok, false);
  assert.deepEqual(blockedCodes(ambiguous), ['RTK_COMMENT_PRODUCT_RETURN_SOURCE_TEXT_CHANGE_AMBIGUOUS']);

  const wrongBlock = plan(c4PhysicalCommentCommandInput({
    mutatePlacement: (placement) => {
      placement.sceneAuthority.blockId = 'block-c4-google-9999';
    },
  }));
  assert.equal(wrongBlock.ok, false);
  assert.deepEqual(blockedCodes(wrongBlock), ['RTK_COMMENT_PRODUCT_RETURN_SOURCE_TEXT_CHANGE_UNRESOLVED']);

  const wrongParagraph = plan(c4PhysicalCommentCommandInput({
    mutatePlacement: (placement) => {
      placement.paragraphIndex = 1;
      placement.documentParagraphIndex = 1;
      placement.sceneAuthority.paragraphIndex = 1;
      placement.sceneAuthority.documentParagraphIndex = 1;
    },
  }));
  assert.equal(wrongParagraph.ok, false);
  assert.deepEqual(blockedCodes(wrongParagraph), ['RTK_COMMENT_PRODUCT_RETURN_SOURCE_TEXT_CHANGE_UNRESOLVED']);

  const missingNativeCommentId = plan(c4PhysicalCommentCommandInput({
    mutatePlacement: (placement) => {
      delete placement.nativeCommentId;
      delete placement.sourceCommentId;
    },
  }));
  assert.equal(missingNativeCommentId.ok, false);
  assert.deepEqual(blockedCodes(missingNativeCommentId), ['RTK_COMMENT_PRODUCT_RETURN_NATIVE_COMMENT_IDENTITY_INVALID']);

  const staleReplacementGroup = plan(c4PhysicalCommentCommandInput({
    mutateTextChanges: (textChanges) => {
      textChanges[0].nativeReplacementGroupId = 'stale-group';
    },
  }));
  assert.equal(staleReplacementGroup.ok, false);
  assert.deepEqual(blockedCodes(staleReplacementGroup), ['RTK_COMMENT_PRODUCT_RETURN_SOURCE_TEXT_CHANGE_UNRESOLVED']);

  const missingCrossReplacementRelation = plan(c4PhysicalCommentCommandInput({
    mutatePlacement: (placement) => {
      delete placement.relatedReplacementGroupId;
      delete placement.relatedReplacementGroupMode;
    },
  }));
  assert.equal(missingCrossReplacementRelation.ok, false);
  assert.deepEqual(blockedCodes(missingCrossReplacementRelation), ['RTK_COMMENT_PRODUCT_RETURN_SOURCE_TEXT_CHANGE_UNRESOLVED']);

  const exactQuote = plan(c4PhysicalCommentCommandInput({
    mutatePlacement: (placement) => {
      placement.quote = 'sentinel alpha';
      placement.range = { from: 0, to: 'sentinel alpha'.length };
      delete placement.relatedReplacementGroupId;
      delete placement.relatedReplacementGroupMode;
    },
  }));
  assert.equal(exactQuote.ok, true, JSON.stringify(exactQuote, null, 2));
  const exactPayload = exactQuote.commands.find((command) => command.family === 'root_comment').payload;
  assert.equal(exactPayload.selectedText, 'sentinel alpha');
  assert.equal(exactPayload.selectedTextSource, 'parser-quote');

  const exactQuoteMissingNativeCommentId = plan(c4PhysicalCommentCommandInput({
    mutatePlacement: (placement) => {
      placement.quote = 'sentinel alpha';
      placement.range = { from: 0, to: 'sentinel alpha'.length };
      delete placement.relatedReplacementGroupId;
      delete placement.relatedReplacementGroupMode;
      delete placement.nativeCommentId;
      delete placement.sourceCommentId;
    },
  }));
  assert.equal(exactQuoteMissingNativeCommentId.ok, false);
  assert.deepEqual(blockedCodes(exactQuoteMissingNativeCommentId), ['RTK_COMMENT_PRODUCT_RETURN_NATIVE_COMMENT_IDENTITY_INVALID']);

  const exactQuoteMismatchedNativeCommentId = plan(c4PhysicalCommentCommandInput({
    mutatePlacement: (placement) => {
      placement.quote = 'sentinel alpha';
      placement.range = { from: 0, to: 'sentinel alpha'.length };
      delete placement.relatedReplacementGroupId;
      delete placement.relatedReplacementGroupMode;
      placement.nativeCommentId = 'forged-comment-id';
    },
  }));
  assert.equal(exactQuoteMismatchedNativeCommentId.ok, false);
  assert.deepEqual(blockedCodes(exactQuoteMismatchedNativeCommentId), ['RTK_COMMENT_PRODUCT_RETURN_NATIVE_COMMENT_IDENTITY_INVALID']);

  const withinInsert = plan(c4PhysicalCommentCommandInput({
    mutatePlacement: (placement) => {
      placement.quote = 'omega';
      placement.range = { from: 0, to: 'omega'.length };
      placement.relatedReplacementGroupMode = 'WITHIN_INSERT';
    },
  }));
  assert.equal(withinInsert.ok, true, JSON.stringify(withinInsert, null, 2));
  const withinInsertPayload = withinInsert.commands.find((command) => command.family === 'root_comment').payload;
  assert.equal(withinInsertPayload.selectedText, 'omega');
  assert.equal(withinInsertPayload.selectedTextSource, 'parser-quote-within-insert');
  assert.equal(withinInsertPayload.sceneText.startsWith('sentinel omega'), true);
});

test('DOCX review preview session command: Google-rewritten scene bookmarks bind through main-owned exportMap ordinal authority', async () => {
  const bridge = await loadBridge();
  const sceneId = 'roman/google-c4-scene.txt';
  const targetOrdinal = 0;
  const sceneLines = [
    'sentinel alpha',
    'context line 02',
    'context line 03',
    'context line 04',
    'context line 05',
    'context line 06',
    'context line 07',
    'context line 08',
    'context line 09',
    'context line 10',
    'context line 11',
    'context line 12',
  ];
  const sceneText = sceneLines.join('\n');
  const blocks = sceneExportMapBlocks(sceneId, sceneText);
  const docx = productReviewDocxWithTrackedReplacement({
    roundId: 'round-google-c4-scene-ordinal',
    roundIdHex: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    keyIdHex: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    exportId: 'export-google-c4-scene-ordinal',
    sceneId,
    sceneText,
    deletedText: 'sentinel alpha',
    insertedText: 'sentinel omega',
    blockId: blocks[targetOrdinal].blockId,
  });
  const returnedBytes = googleRewrittenBookmarkReturnBytes(docx, {
    sceneText,
    targetOrdinal,
  });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-google-c4-scene-'));
  const scenePath = path.join(tmpDir, sceneId);
  fs.mkdirSync(path.dirname(scenePath), { recursive: true });
  fs.writeFileSync(scenePath, sceneText, 'utf8');
  const returnedTargetParagraphIndex = targetOrdinal;
  const reviewIr = c05ReviewIr({
    deleted: 'sentinel alpha',
    inserted: 'sentinel omega',
    groupId: 'google-c4-ordinal',
    paragraphIndex: returnedTargetParagraphIndex,
  });
  reviewIr.textRevisions[0].nativeRevisionId = '0';
  reviewIr.textRevisions[0].sourceXmlProvenance = { partName: 'word/document.xml', openStart: 180, closeEnd: 260 };
  reviewIr.textRevisions[1].nativeRevisionId = '0';
  reviewIr.textRevisions[1].sourceXmlProvenance = { partName: 'word/document.xml', openStart: 100, closeEnd: 180 };
  reviewIr.formattingParagraphs = googleRewrittenFormattingParagraphs(sceneText, {
    targetOrdinal,
    deletedText: 'sentinel alpha',
    insertedText: 'sentinel omega',
  });
  reviewIr.commentThreads = [{
    threadId: 'rtk-comment-0',
    commentId: '0',
    authorId: 'Google Reviewer',
    status: 'ANCHORED',
    anchorStart: 140,
    anchorEnd: 220,
    paragraphIndex: returnedTargetParagraphIndex,
    documentParagraphIndex: returnedTargetParagraphIndex,
    anchorLocator: {
      paragraphIndex: returnedTargetParagraphIndex,
      bookmarkNames: [],
    },
    createdAt: '2026-09-15T02:15:56Z',
    updatedAt: '2026-09-15T02:15:56Z',
    tags: ['docx-review'],
    messages: [{
      messageId: 'rtk-comment-0-message-1',
      authorId: 'Google Reviewer',
      body: 'C4 anchored UI comment on suggested replacement for Yalken review intake.',
      createdAt: '2026-09-15T02:15:56Z',
    }],
  }];
  reviewIr.commentPlacements = [{
    placementId: 'docx-comment-placement-0',
    threadId: 'rtk-comment-0',
    sourceCommentId: '0',
    quote: 'sentinel omeg',
    targetScope: { type: 'scene', id: sceneId },
    paragraphIndex: returnedTargetParagraphIndex,
    documentParagraphIndex: returnedTargetParagraphIndex,
    selector: { type: 'docx-comment-range', id: '0' },
    anchor: { kind: 'docx-comment-range', value: 'w:comment:0' },
    range: { from: 0, to: 'sentinel omeg'.length },
    nativeCommentId: '0',
    relatedReplacementGroupId: 'google-c4-ordinal',
    relatedReplacementGroupMode: 'WITHIN_INSERT',
  }];
  const parserResult = {
    ok: true,
    authorityCarrier: {
      status: 'verified-baseline-bound',
      selectedCarrier: {
        encoded: productAuthorityEnvelope(docx.payload, docx.secret),
        payload: docx.payload,
        baselineBinding: { allExpectedMatched: true },
      },
    },
    exactAuthority: c05ExactAuthority(),
    parserProfileDigest: c05Sha256Text('parser-google-c4-ordinal'),
    analysisDigest: c05Sha256Text('analysis-google-c4-ordinal'),
    sourceMode: 'TRACKED',
    reviewIr,
  };
  const calls = [];
  const applyHandler = bridge.createRtkNonOverlapTrackedReplacementCommandHandler({
    cryptoPort: c05CryptoPort,
    now: () => 1700000000000,
  });
  const port = instantiateDocxReviewPreviewSessionPort({
    dispatchCommandSurfaceKernel: async (commandId, payload = {}) => {
      calls.push({ commandId, payload: cloneJsonSafe(payload) });
      if (commandId === 'cmd.rtk.reviewSession.importComments') {
        return { ok: true, status: 'committed', session: { summary: { threadCount: 1 } }, storageEffects: {} };
      }
      assert.equal(commandId, 'cmd.rtk.review.applyNonOverlapTrackedReplacements');
      return applyHandler(payload);
    },
  });
  const sceneHash = computeHash(sceneText);
  const result = await port.handleDocxReviewPreviewSessionActivationCommandSurface(
    toPayload(returnedBytes),
    {
      activeReviewDocxExportAuthorityStore: productAuthorityStoreFromDocx(docx, {
        projectRoot: tmpDir,
        scenePath,
        baselineFinalText: sceneText,
        scope: 'scene',
        exportMap: {
          scope: 'scene',
          roundId: docx.payload.roundId,
          scenes: [{
            sceneId,
            sceneOrdinal: 0,
            rawSha256: docx.payload.rawSha256,
            blocks,
          }],
        },
      }),
      runDocxReviewReturnIntakeInUtilityProcess: async (input) => wrapParserResultAsPacketResult(parserResult, {
        returnedArtifactSha256: input?.returnedArtifactSha256,
        yrtk2Token: docx.yrtk2.token,
        coreManifestDigest: docx.payload.coreManifestDigest,
      }),
      buildMainReviewContext: async () => reviewContext({
        projectId: 'project-google-c4-scene',
        projectRoot: tmpDir,
        scenePath,
        sceneText,
        baselineHash: sceneHash,
        currentBaselineHash: sceneHash,
        targetScope: { type: 'scene', id: sceneId },
      }),
    },
  );

  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(result.returnIntake.authenticated, true);
  assert.equal(result.nonOverlapTrackedReplacementProductPath.prepared, true, JSON.stringify(result.nonOverlapTrackedReplacementProductPath, null, 2));
  assert.equal(result.nonOverlapTrackedReplacementProductPath.rendererAuthority, false);
  assert.equal(result.commentProductPath.ok, true, JSON.stringify(result.commentProductPath, null, 2));
  assert.equal(result.commentProductPath.status, 'preview-ready');
  assert.equal(result.commentProductPath.sceneAuthorityIdentityJoin.unjoinedPlacementCount, 0);
  assert.equal(fs.readFileSync(scenePath, 'utf8'), sceneText);

  const textChanges = result.reviewSurface.revisionSession.reviewGraph.textChanges;
  assert.equal(textChanges.length, 1);
  assert.equal(textChanges[0].match.quote, 'sentinel alpha');
  assert.equal(textChanges[0].replacementText, 'sentinel omega');
  assert.equal(textChanges[0].rtkProductPath, 'nonOverlapTrackedReplacement');

  const applied = await port.handleReviewSurfaceApplyExactTextChangeCommandSurface({
    requestId: 'apply-google-c4-scene-ordinal',
    changeId: textChanges[0].changeId,
  });
  assert.equal(applied.ok, true, JSON.stringify(applied, null, 2));
  assert.equal(applied.applied, true);
  assert.equal(applied.result.writerCalled, true);
  assert.equal(fs.readFileSync(scenePath, 'utf8'), sceneLines.with(targetOrdinal, 'sentinel omega').join('\n'));
  assert.equal(calls.filter((call) => call.commandId === 'cmd.rtk.review.applyNonOverlapTrackedReplacements').length, 1);
  const applyPayload = calls.find((call) => call.commandId === 'cmd.rtk.review.applyNonOverlapTrackedReplacements').payload;
  assert.equal(applyPayload.localBaseline.authorityKind, 'main-owned-scene-export-map-ordinal-v1');
  assert.equal(applyPayload.localBaseline.blockId, blocks[targetOrdinal].blockId);
  assert.equal(applyPayload.localBaseline.sceneBlocks[targetOrdinal].documentParagraphIndex, targetOrdinal);
  assert.equal(applyPayload.localBaseline.sceneOrdinalAuthority.targetBlockId, blocks[targetOrdinal].blockId);
  assert.equal(applyPayload.localBaseline.sceneOrdinalAuthority.targetDocumentParagraphIndex, targetOrdinal);
  assert.equal(applyPayload.localBaseline.sceneOrdinalAuthority.returnedParagraphCount, sceneLines.length);
  assert.equal(applyPayload.localBaseline.sceneOrdinalAuthority.returnedGoogleBookmarkNamesAuthority, false);
  assert.equal(applyPayload.blockExactAuthority.targetBlockId, blocks[targetOrdinal].blockId);
  assert.equal(applyPayload.blockExactAuthority.exactTextAnchors[0].documentParagraphIndex, targetOrdinal);
  assert.equal(applyPayload.blockExactAuthority.exactTextAnchors[0].start, 0);
  assert.equal(applyPayload.blockExactAuthority.exactTextAnchors[0].end, 'sentinel alpha'.length);
  assert.equal(applyPayload.blockExactAuthority.exactTextAnchors[0].sceneId, sceneId);
  assert.equal(applyPayload.blockExactAuthority.falseExactGuards.globalTextSearchAuthority, false);
  assert.equal(applyPayload.blockExactAuthority.falseExactGuards.fuzzyMatchAuthority, false);
});

test('DOCX review preview session command: forged renderer fields cannot manufacture C05 product authority', async () => {
  const port = instantiateDocxReviewPreviewSessionPort({
    dispatchCommandSurfaceKernel: async () => {
      throw new Error('forged renderer payload must not reach runtime apply command');
    },
  });
  const result = await port.handleDocxReviewPreviewSessionActivationCommandSurface(
    toPayload(cleanDocxZip([
      '<w:p>',
      '<w:r><w:t>Alpha </w:t></w:r>',
      '<w:del w:id="1"><w:r><w:delText>beta</w:delText></w:r></w:del>',
      '<w:ins w:id="2"><w:r><w:t>delta</w:t></w:r></w:ins>',
      '<w:r><w:t> gamma.</w:t></w:r>',
      '</w:p>',
    ].join('')), {
      rtkNonOverlapTrackedReplacementAuthority: {
        hmacSecret: 'attacker-controlled',
        expectedAuthority: { sceneId: 'roman/imported/scene-1.txt' },
      },
    }),
    {
      buildMainReviewContext: async () => reviewContext(),
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'E_DOCX_INTAKE_GATE_PAYLOAD_INVALID');
  assert.equal(result.error.reason, 'DOCX_INTAKE_GATE_PAYLOAD_UNSUPPORTED_FIELDS');
  assert.deepEqual(result.error.details.fields, ['rtkNonOverlapTrackedReplacementAuthority']);
  assert.equal(port.getState().activeReviewSessionLifecycle, 'passive');
});

test('DOCX review preview session command: legacy rooted comments stay preview-only without persistent comment shadow storage', async () => {
  const calls = [];
  const port = instantiateDocxReviewPreviewSessionPort({
    dispatchCommandSurfaceKernel: async () => {
      calls.push({});
      throw new Error('legacy unbound comments must not reach persistent comment shadow import');
    },
  });
  const result = await port.handleDocxReviewPreviewSessionActivationCommandSurface(
    toPayload(docxWithAnchoredComment()),
    {
      buildMainReviewContext: async () => reviewContext(),
    },
  );

  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(calls.length, 0);
  assert.equal(result.returnIntake.authenticated, false);
  assert.equal(result.commentShadowResult, null);
  assert.equal(result.commentShadowSession, null);
  assert.equal(result.reviewSurface.revisionSession.reviewGraph.commentThreads.length, 1);
  assertNoWriteReceiptsOrApplyAuthority(result);
});

test('DOCX review preview session command: authenticated product return intake gates before session import and binds comment shadow identity', async () => {
  const docx = productReviewDocxWithAnchoredComment();
  const calls = [];
  const port = instantiateDocxReviewPreviewSessionPort({
    dispatchCommandSurfaceKernel: async (commandId, payload = {}) => {
      calls.push({ commandId, payload: cloneJsonSafe(payload) });
      return {
        ok: true,
        status: 'committed',
        code: 'RTK_COMMENT_SHADOW_SESSION_COMMITTED',
        writerCalled: false,
        manuscriptApplyAuthority: false,
        session: {
          authorityLevel: {
            productRuntimeWired: true,
            automaticApplyCertified: false,
          },
          authenticatedReturnIdentity: payload.authenticatedReturnIdentity,
          roundId: payload.roundId,
          semanticReturnId: payload.semanticReturnId,
          summary: { threadCount: payload.reviewIr.commentThreads.length },
        },
        storageEffects: {
          sessionRecordCreated: true,
          receiptCreated: true,
          manuscriptBytesWritten: 0,
        },
      };
    },
  });
  const result = await port.handleDocxReviewPreviewSessionActivationCommandSurface(
    toPayload(docx.bytes),
    {
      activeReviewDocxExportAuthorityStore: productAuthorityStoreFromDocx(docx),
      buildMainReviewContext: async () => reviewContext({
        scenePath: '/project/roman/imported/scene-1.txt',
        sceneText: 'Anchored text',
      }),
    },
  );

  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(result.returnIntake.authenticated, true);
  assert.equal(result.returnIntake.status, 'authenticated-return-ir-ready');
  assert.equal(result.returnIntake.authority.validSignedLocator, true);
  assert.equal(result.returnIntake.roundId, docx.payload.roundId);
  assert.equal(result.returnIntake.exportId, docx.payload.exportId);
  assert.equal(result.returnIntake.semanticReturnId, docx.payload.semanticReturnId);
  assert.equal(result.returnIntake.canAutoApply, false);
  assert.equal(result.canAutoApply, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].commandId, 'cmd.rtk.reviewSession.importComments');
  assert.equal(calls[0].payload.roundId, docx.payload.roundId);
  assert.equal(calls[0].payload.returnArtifactId, result.returnIntake.returnedArtifactSha256);
  assert.equal(calls[0].payload.semanticReturnId, docx.payload.semanticReturnId);
  assert.equal(calls[0].payload.authenticatedReturnIdentity.authenticated, true);
  assert.equal(calls[0].payload.authenticatedReturnIdentity.projectId, 'project-1');
  assert.equal(calls[0].payload.authenticatedReturnIdentity.sceneId, docx.payload.sceneId);
  assert.equal(calls[0].payload.authenticatedReturnIdentity.sceneRevision, docx.payload.sceneRevision);
  assert.equal(calls[0].payload.authenticatedReturnIdentity.rawSha256, docx.payload.rawSha256);
  assert.equal(calls[0].payload.authenticatedReturnIdentity.exportId, docx.payload.exportId);
  assert.equal(calls[0].payload.authenticatedReturnIdentity.returnArtifactId, result.returnIntake.returnedArtifactSha256);
  assert.equal(calls[0].payload.reviewIr.roundId, docx.payload.roundId);
  assert.equal(calls[0].payload.reviewIr.commentThreads.length, 1);
  assert.equal(result.commentShadowSession.authenticatedReturnIdentity.sceneId, docx.payload.sceneId);
  assert.equal(result.commentShadowResult.storageEffects.sessionRecordCreated, true);
  assert.equal(result.commentShadowResult.storageEffects.manuscriptBytesWritten, 0);
  assert.equal(port.getState().activeReviewSessionLifecycle, 'active');
  assertNoWriteReceiptsOrApplyAuthority(result);
});

test('DOCX review preview session command: product return with valid C01 but missing or forged YRTK2 fails closed before import', async () => {
  for (const [name, docx, expectedReason] of [
    ['missing-yrtk2', productReviewDocxWithAnchoredComment({ includeYrtk2: false }), 'RTK_RETURN_INTAKE_YRTK2_REQUIRED'],
    ['forged-yrtk2', productReviewDocxWithAnchoredComment({ yrtk2TokenOverride: 'A'.repeat(135) }), 'RTK_RETURN_INTAKE_YRTK2_TOKEN_DIGEST_MISMATCH'],
  ]) {
    const port = instantiateDocxReviewPreviewSessionPort({
      dispatchCommandSurfaceKernel: async () => {
        throw new Error(`${name} must not reach product import`);
      },
    });
    const result = await port.handleDocxReviewPreviewSessionActivationCommandSurface(
      toPayload(docx.bytes),
      {
        activeReviewDocxExportAuthorityStore: productAuthorityStoreFromDocx(docx),
        buildMainReviewContext: async () => reviewContext({
          scenePath: '/project/roman/imported/scene-1.txt',
          sceneText: 'Anchored text',
        }),
      },
    );

    assert.equal(result.ok, false, name);
    assert.equal(result.error.code, 'E_DOCX_REVIEW_PREVIEW_SESSION_RETURN_INTAKE_BLOCKED', name);
    assert.equal(result.error.reason, expectedReason, name);
    assert.equal(port.getState().activeReviewSessionLifecycle, 'passive', name);
  }
});

test('DOCX review preview session command: full-manuscript active authority store transports local export map into candidate and canonical comment commands', async () => {
  const bridge = await loadBridge();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-n2-authority-transport-'));
  const sceneId = 'roman/chapter-01.txt';
  const sceneText = 'Physical comment anchor';
  const scenePath = path.join(tmpDir, sceneId);
  fs.mkdirSync(path.dirname(scenePath), { recursive: true });
  fs.writeFileSync(scenePath, sceneText);
  const roundId = 'round-full-manuscript-authority-transport';
  const exportId = 'export-full-manuscript-authority-transport';
  const payload = {
    scope: 'full-manuscript', projectId: 'project-1', sceneCount: 1, orderedSceneIds: [sceneId],
    caseId: 'full-manuscript-authority-transport',
    fullBookRawSha256: c05Sha256Text(sceneText), roundId, exportId,
    semanticReturnId: 'semantic-full-manuscript-authority-transport',
    coreManifestDigest: c05Sha256Text('core-full-manuscript-authority-transport'),
    transportManifestDigest: c05Sha256Text('transport-full-manuscript-authority-transport'),
    capabilityManifestDigest: c05Sha256Text('capability-full-manuscript-authority-transport'),
  };
  const yrtk2 = makeTestYrtk2({
    keyIdHex: '55555555555555555555555555555555',
    roundIdHex: '66666666666666666666666666666666',
    coreManifestDigest: payload.coreManifestDigest,
    secret: 'main-owned-local-secret',
  });
  const authority = productAuthorityEnvelope(payload, 'main-owned-local-secret');
  const parserResult = {
    ok: true,
    authorityCarrier: {
      status: 'verified-baseline-bound',
      selectedCarrier: { encoded: authority, payload, baselineBinding: { allExpectedMatched: true } },
    },
    exactAuthority: { validSignedLocator: true, sceneRevisionUnchanged: true, rawSha256Unchanged: true },
    parserProfileDigest: c05Sha256Text('parser'), analysisDigest: c05Sha256Text('analysis'), sourceMode: 'TRACKED',
    reviewIr: {
      commentThreads: [{
        threadId: 'rtk-comment-0', commentId: '0', status: 'resolved', paragraphIndex: 0,
        anchorLocator: { paraId: 'aaaabbbb', textId: '11112222', bookmarkNames: [] },
        quotedAnchorText: sceneText,
        messages: [
          { messageId: 'docx-comment-0-root', body: 'Physical root body' },
          { messageId: 'docx-comment-0-reply', body: 'Physical reply body' },
        ],
      }],
      commentPlacements: [{
        threadId: 'rtk-comment-0', sourceCommentId: '0', targetScope: { type: 'scene', id: '' }, quote: sceneText,
      }],
      textRevisions: [], moveRevisions: [], propertyRevisions: [], formattingDeltas: [],
      structureChanges: [], opaqueUnsupported: [],
    },
  };
  const bytes = docxWithCommentAndBody([
    '<w:p w14:paraId="aaaabbbb" w14:textId="11112222">',
    '<w:commentRangeStart w:id="0"/>',
    '<w:r><w:t>Physical comment anchor</w:t></w:r>',
    '<w:commentRangeEnd w:id="0"/>',
    '<w:r><w:commentReference w:id="0"/></w:r>',
    '</w:p>',
  ].join(''), 'Physical root body', [
    {
      name: 'docProps/custom.xml',
      method: 8,
      body: customPropertiesXml([
        { name: 'YRTK_C01_AUTH', value: authority },
        { name: 'YRTK2_TOKEN', value: yrtk2.token },
        { name: 'YRTK_CORE_DIGEST', value: payload.coreManifestDigest },
      ]),
    },
  ], { extraNamespaces: ` xmlns:w14="${W14_NS}"` });
  const localAuthority = {
    schemaVersion: 'yalken.rtk.word.product-review-docx-export.local-authority.v1',
    projectRoot: tmpDir,
    scope: 'full-manuscript',
    scenePathBySceneId: { [sceneId]: scenePath },
    baselineFinalTextBySceneId: { [sceneId]: sceneText },
    hmacSecret: 'main-owned-local-secret',
    keyRef: importTestRoundKeyRef(roundId, 'main-owned-local-secret'),
    lifecycleState: 'PUBLISHED_ACTIVE',
    expectedAuthority: {
      scope: 'full-manuscript', sceneCount: 1, orderedSceneIds: [sceneId],
      fullBookRawSha256: payload.fullBookRawSha256, roundId, exportId,
      capabilityManifestDigest: payload.capabilityManifestDigest,
    },
    roundId, exportIdentity: exportId,
    manifestDigest: payload.transportManifestDigest,
    coreManifestDigest: payload.coreManifestDigest,
    yrtk2: {
      tokenDigest: yrtk2.tokenDigest,
      tokenLength: yrtk2.tokenLength,
      keyIdHex: yrtk2.keyIdHex,
      roundIdHex: yrtk2.roundIdHex,
      coreManifestDigest: yrtk2.coreManifestDigest,
      secretEmbeddedInDocx: false,
    },
    exportMap: {
      scenes: [{
        sceneId,
        blocks: [{
          blockId: 'block-1',
          wordSignals: [{ kind: 'w14ParaIdTextId', value: { paraId: 'aaaabbbb', textId: '11112222' } }],
        }],
      }],
    },
  };
  const calls = [];
  const rootHandler = bridge.createRtkRootCommentReturnCommandHandler();
  const lifecycleHandler = bridge.createRtkCommentLifecycleReturnCommandHandler();
  const port = instantiateDocxReviewPreviewSessionPort({
    dispatchCommandSurfaceKernel: async (commandId, commandPayload = {}) => {
      calls.push(commandId);
      if (commandId === 'cmd.rtk.reviewSession.importComments') {
        return { ok: true, status: 'committed', session: { summary: { threadCount: 1 } }, storageEffects: {} };
      }
      if (commandId === 'cmd.rtk.review.applyRootCommentReturn') return rootHandler(commandPayload);
      if (commandId === 'cmd.rtk.review.applyCommentLifecycleReturn') return lifecycleHandler(commandPayload);
      return { ok: false, code: 'UNEXPECTED_COMMAND' };
    },
  });
  const result = await port.handleDocxReviewPreviewSessionActivationCommandSurface(toPayload(bytes), {
    activeReviewDocxExportAuthorityStore: {
      schemaVersion: 'yalken.rtk.word.product-review-docx-export.authority-store.v1',
      scope: 'full-manuscript', lastRoundId: roundId, roundsById: { [roundId]: localAuthority },
      secretExposedToRenderer: false,
    },
    runDocxReviewReturnIntakeInUtilityProcess: async (input) => wrapParserResultAsPacketResult(parserResult, {
      returnedArtifactSha256: input?.returnedArtifactSha256,
      yrtk2Token: yrtk2.token,
      coreManifestDigest: yrtk2.coreManifestDigest,
    }),
    buildMainReviewContext: async () => reviewContext({
      projectRoot: tmpDir, scenePath, sceneText,
      targetScope: { type: 'scene', id: sceneId },
    }),
  });
  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(result.returnIntake.fullManuscriptExportMapTransport.present, true);
  assert.equal(result.returnIntake.fullManuscriptExportMapTransport.returnedArtifactExportMapAccepted, false);
  assert.equal(result.candidateSummary.pendingFallbackCommentPlacementCount, 0);
  assert.deepEqual(Array.from(result.candidateSummary.commentSceneAuthoritySources), [
    'authenticated-full-manuscript-export-map-paragraph-signal',
  ]);
  assert.equal(result.commentProductPath.ok, true);
  assert.equal(result.commentProductPath.status, 'preview-ready');
  assert.equal(result.commentProductPath.code, 'RTK_COMMENT_PRODUCT_RETURN_PREVIEW_READY_EXPLICIT_APPLY_REQUIRED');
  assert.equal(result.commentProductPath.pendingProductApplyLane, true);
  assert.equal(result.commentProductPath.explicitUserConfirmedCanonicalCommandRequired, true);
  assert.equal(result.commentProductPath.sceneAuthorityIdentityJoin.identityJoinCount, 1);
  assert.equal(result.commentProductPath.sceneAuthorityIdentityJoin.unjoinedPlacementCount, 0);
  assert.equal(result.commentProductPath.planSummary.commandCount, 3);
  assert.equal(result.commentProductPath.applyReceipts.length, 0);
  assert.equal(result.commentProductPath.previewCommands.length, 3);
  assert.equal(calls.filter((commandId) => commandId === 'cmd.rtk.review.applyRootCommentReturn').length, 0);
  assert.equal(calls.filter((commandId) => commandId === 'cmd.rtk.review.applyCommentLifecycleReturn').length, 0);
});

test('DOCX review preview session command: explicit full-manuscript comment apply writes canonical durable state', async () => {
  const bridge = await loadBridge();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docx-review-full-comment-explicit-'));
  const sceneId = 'roman/scene-comment-explicit.txt';
  const sceneText = 'Physical comment anchor';
  const scenePath = path.join(tmpDir, sceneId);
  fs.mkdirSync(path.dirname(scenePath), { recursive: true });
  fs.writeFileSync(scenePath, sceneText);
  const roundId = 'round-full-manuscript-comment-explicit';
  const exportId = 'export-full-manuscript-comment-explicit';
  const coreManifestDigest = c05Sha256Text('core-full-manuscript-comment-explicit');
  const yrtk2 = makeTestYrtk2({
    keyIdHex: '55555555555555555555555555555555',
    roundIdHex: '66666666666666666666666666666666',
    coreManifestDigest,
    secret: 'main-owned-local-secret',
  });
  const payload = {
    scope: 'full-manuscript', projectId: 'project-1', sceneCount: 1, orderedSceneIds: [sceneId],
    caseId: 'full-manuscript-comment-explicit',
    fullBookRawSha256: c05Sha256Text(sceneText), roundId, exportId,
    semanticReturnId: 'semantic-full-manuscript-comment-explicit',
    coreManifestDigest,
    transportManifestDigest: c05Sha256Text('transport-full-manuscript-comment-explicit'),
    capabilityManifestDigest: c05Sha256Text('capability-full-manuscript-comment-explicit'),
    yrtk2TokenDigest: yrtk2.tokenDigest,
  };
  const authority = productAuthorityEnvelope(payload, 'main-owned-local-secret');
  const parserResult = {
    ok: true,
    authorityCarrier: {
      status: 'verified-baseline-bound',
      selectedCarrier: { encoded: authority, payload, baselineBinding: { allExpectedMatched: true } },
    },
    exactAuthority: { validSignedLocator: true, sceneRevisionUnchanged: true, rawSha256Unchanged: true },
    parserProfileDigest: c05Sha256Text('parser-explicit'),
    analysisDigest: c05Sha256Text('analysis-explicit'),
    sourceMode: 'TRACKED',
    reviewIr: {
      commentThreads: [{
        threadId: 'rtk-comment-explicit-0', commentId: '0', status: 'resolved', paragraphIndex: 0,
        anchorLocator: { paraId: 'aaaabbbb', textId: '11112222', bookmarkNames: [] },
        quotedAnchorText: sceneText,
        messages: [
          { messageId: 'docx-comment-explicit-0-root', body: 'Physical root body' },
          { messageId: 'docx-comment-explicit-0-reply', body: 'Physical reply body' },
        ],
      }],
      commentPlacements: [{
        threadId: 'rtk-comment-explicit-0',
        sourceCommentId: '0',
        targetScope: { type: 'scene', id: '' },
        quote: sceneText,
      }],
      textChanges: [{
        changeId: 'tracked-change-comment-explicit',
        targetScope: { type: 'scene', id: sceneId },
        match: { quote: 'old text', blockId: 'block-1' },
        replacementText: sceneText,
      }],
      textRevisions: [], moveRevisions: [], propertyRevisions: [], formattingDeltas: [],
      structureChanges: [], opaqueUnsupported: [],
    },
  };
  const bytes = docxWithCommentAndBody([
    '<w:p w14:paraId="aaaabbbb" w14:textId="11112222">',
    '<w:commentRangeStart w:id="0"/>',
    '<w:r><w:t>Physical comment anchor</w:t></w:r>',
    '<w:commentRangeEnd w:id="0"/>',
    '<w:r><w:commentReference w:id="0"/></w:r>',
    '</w:p>',
  ].join(''), 'Physical root body', [
    {
      name: 'docProps/custom.xml',
      method: 8,
      body: customPropertiesXml([
        { name: 'YRTK_C01_AUTH', value: authority },
        { name: 'YRTK2_TOKEN', value: yrtk2.token },
        { name: 'YRTK_CORE_DIGEST', value: coreManifestDigest },
      ]),
    },
  ], { extraNamespaces: ` xmlns:w14="${W14_NS}"` });
  const localAuthority = {
    schemaVersion: 'yalken.rtk.word.product-review-docx-export.local-authority.v1',
    projectRoot: tmpDir,
    scope: 'full-manuscript',
    scenePathBySceneId: { [sceneId]: scenePath },
    baselineFinalTextBySceneId: { [sceneId]: sceneText },
    hmacSecret: 'main-owned-local-secret',
    keyRef: importTestRoundKeyRef(roundId, 'main-owned-local-secret'),
    lifecycleState: 'PUBLISHED_ACTIVE',
    expectedAuthority: {
      scope: 'full-manuscript', sceneCount: 1, orderedSceneIds: [sceneId],
      fullBookRawSha256: payload.fullBookRawSha256, roundId, exportId,
      capabilityManifestDigest: payload.capabilityManifestDigest,
    },
    roundId,
    exportIdentity: exportId,
    manifestDigest: payload.transportManifestDigest,
    coreManifestDigest: payload.coreManifestDigest,
    yrtk2: {
      tokenDigest: yrtk2.tokenDigest,
      tokenLength: yrtk2.tokenLength,
      keyIdHex: yrtk2.keyIdHex,
      roundIdHex: yrtk2.roundIdHex,
      coreManifestDigest: yrtk2.coreManifestDigest,
      secretEmbeddedInDocx: false,
    },
    exportMap: {
      scenes: [{
        sceneId,
        blocks: [{
          blockId: 'block-1',
          wordSignals: [{ kind: 'w14ParaIdTextId', value: { paraId: 'aaaabbbb', textId: '11112222' } }],
        }],
      }],
    },
  };
  const calls = [];
  const rootHandler = bridge.createRtkRootCommentReturnCommandHandler();
  const lifecycleHandler = bridge.createRtkCommentLifecycleReturnCommandHandler();
  const port = instantiateDocxReviewPreviewSessionPort({
    dispatchCommandSurfaceKernel: async (commandId, commandPayload = {}) => {
      calls.push(commandId);
      if (commandId === 'cmd.rtk.reviewSession.importComments') {
        return { ok: true, status: 'committed', session: { summary: { threadCount: 1 } }, storageEffects: {} };
      }
      if (commandId === 'cmd.rtk.review.applyRootCommentReturn') return rootHandler(commandPayload);
      if (commandId === 'cmd.rtk.review.applyCommentLifecycleReturn') return lifecycleHandler(commandPayload);
      return { ok: false, code: 'UNEXPECTED_COMMAND' };
    },
  });
  const result = await port.handleDocxReviewPreviewSessionActivationCommandSurface({
    ...toPayload(bytes),
    explicitCanonicalApplyConfirmed: true,
  }, {
    activeReviewDocxExportAuthorityStore: {
      schemaVersion: 'yalken.rtk.word.product-review-docx-export.authority-store.v1',
      scope: 'full-manuscript', lastRoundId: roundId, roundsById: { [roundId]: localAuthority },
      secretExposedToRenderer: false,
    },
    runDocxReviewReturnIntakeInUtilityProcess: async (input) => wrapParserResultAsPacketResult(parserResult, {
      returnedArtifactSha256: input?.returnedArtifactSha256,
      yrtk2Token: yrtk2.token,
      coreManifestDigest: yrtk2.coreManifestDigest,
    }),
    buildMainReviewContext: async () => reviewContext({
      projectRoot: tmpDir, scenePath, sceneText,
      targetScope: { type: 'scene', id: sceneId },
    }),
  });
  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(result.commentProductPath.ok, true);
  assert.equal(result.commentProductPath.status, 'applied-and-replayed');
  assert.equal(result.commentProductPath.pendingProductApplyLane, false);
  assert.equal(result.commentProductPath.semanticOracle.rootApplied, 1);
  assert.equal(result.commentProductPath.semanticOracle.lifecycleApplied, 2);
  assert.equal(result.commentProductPath.semanticOracle.triangleGreen, true);
  assert.equal(calls.filter((commandId) => commandId === 'cmd.rtk.review.applyRootCommentReturn').length, 2);
  assert.equal(calls.filter((commandId) => commandId === 'cmd.rtk.review.applyCommentLifecycleReturn').length, 4);
  const canonical = JSON.parse(fs.readFileSync(
    path.join(tmpDir, '.yalken', 'word-review', 'non-text-return-state.v1.json'),
    'utf8',
  ));
  assert.equal(canonical.threads[0].messages[0].body, 'Physical root body');
  assert.deepEqual(canonical.events.map((event) => event.kind), [
    'root_comment_added', 'comment_reply_added', 'comment_resolved',
  ]);
  assert.equal(fs.existsSync(path.join(tmpDir, '.yalken', 'recovery', 'non-text-return-state.v1.json')), true);
});

test('DOCX review preview session command: authenticated full-manuscript missing and forged local maps block before command dispatch', async () => {
  const roundId = 'round-map-negatives';
  const yrtk2 = makeTestYrtk2({
    keyIdHex: '77777777777777777777777777777777',
    roundIdHex: '88888888888888888888888888888888',
    coreManifestDigest: c05Sha256Text('core-map-negatives'),
    secret: 'main-owned-local-secret',
  });
  const payload = {
    scope: 'full-manuscript', roundId, exportId: 'export-map-negatives', orderedSceneIds: ['scene-a'],
    caseId: 'full-manuscript-map-negatives',
    fullBookRawSha256: c05Sha256Text('scene-a'),
    capabilityManifestDigest: c05Sha256Text('capability-map-negatives'),
    coreManifestDigest: yrtk2.coreManifestDigest,
    transportManifestDigest: c05Sha256Text('transport-map-negatives'),
    yrtk2TokenDigest: yrtk2.tokenDigest,
  };
  const authority = productAuthorityEnvelope(payload, 'main-owned-local-secret');
  const bytes = docxWithAnchoredComment('', [
    {
      name: 'docProps/custom.xml',
      method: 8,
      body: customPropertiesXml([
        { name: 'YRTK_C01_AUTH', value: authority },
        { name: 'YRTK2_TOKEN', value: yrtk2.token },
        { name: 'YRTK_CORE_DIGEST', value: yrtk2.coreManifestDigest },
      ]),
    },
  ]);
  const parserResult = {
    ok: true,
    authorityCarrier: { status: 'verified-baseline-bound', selectedCarrier: { encoded: authority, payload, baselineBinding: { allExpectedMatched: true } } },
    exactAuthority: { validSignedLocator: true }, reviewIr: { commentThreads: [], commentPlacements: [] },
  };
  for (const [name, exportMap, expectedReason] of [
    ['missing', undefined, 'RTK_RETURN_INTAKE_LOCAL_FULL_MANUSCRIPT_EXPORT_MAP_REQUIRED'],
    ['forged', { scenes: [{ sceneId: 'scene-forged', blocks: [{ blockId: 'block-forged' }] }] }, 'RTK_RETURN_INTAKE_LOCAL_FULL_MANUSCRIPT_EXPORT_MAP_MISMATCH'],
  ]) {
    let dispatchCount = 0;
    const port = instantiateDocxReviewPreviewSessionPort({ dispatchCommandSurfaceKernel: async () => { dispatchCount += 1; } });
    const localAuthority = {
      scope: 'full-manuscript', hmacSecret: 'main-owned-local-secret', roundId,
      keyRef: importTestRoundKeyRef(roundId, 'main-owned-local-secret'),
      lifecycleState: 'PUBLISHED_ACTIVE',
      expectedAuthority: {
        scope: 'full-manuscript', orderedSceneIds: ['scene-a'], roundId,
        exportId: payload.exportId,
        fullBookRawSha256: payload.fullBookRawSha256,
        capabilityManifestDigest: payload.capabilityManifestDigest,
      },
      coreManifestDigest: yrtk2.coreManifestDigest,
      yrtk2: {
        tokenDigest: yrtk2.tokenDigest,
        tokenLength: yrtk2.tokenLength,
        keyIdHex: yrtk2.keyIdHex,
        roundIdHex: yrtk2.roundIdHex,
        coreManifestDigest: yrtk2.coreManifestDigest,
        secretEmbeddedInDocx: false,
      },
      exportMap,
    };
    const result = await port.handleDocxReviewPreviewSessionActivationCommandSurface(toPayload(bytes), {
      activeReviewDocxExportAuthorityStore: { roundsById: { [roundId]: localAuthority } },
      runDocxReviewReturnIntakeInUtilityProcess: async (input) => wrapParserResultAsPacketResult(parserResult, {
        returnedArtifactSha256: input?.returnedArtifactSha256,
        yrtk2Token: yrtk2.token,
        coreManifestDigest: yrtk2.coreManifestDigest,
      }),
      buildMainReviewContext: async () => reviewContext(),
    });
    assert.equal(result.ok, false, name);
    assert.equal(result.error.reason, expectedReason, name);
    assert.equal(dispatchCount, 0, name);
  }
});

test('DOCX review preview session command: product carrier without local round store is blocked before import', async () => {
  const docx = productReviewDocxWithAnchoredComment();
  const port = instantiateDocxReviewPreviewSessionPort({
    dispatchCommandSurfaceKernel: async () => {
      throw new Error('foreign product return must not reach comment shadow import');
    },
  });
  const result = await port.handleDocxReviewPreviewSessionActivationCommandSurface(
    toPayload(docx.bytes),
    {
      buildMainReviewContext: async () => reviewContext({
        scenePath: '/project/roman/imported/scene-1.txt',
        sceneText: 'Anchored text',
      }),
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'E_DOCX_REVIEW_PREVIEW_SESSION_RETURN_INTAKE_BLOCKED');
  assert.equal(result.error.reason, 'RTK_RETURN_INTAKE_FOREIGN_OR_EXPIRED_ROUND');
  assert.equal(port.getState().activeReviewSessionLifecycle, 'passive');
});

test('DOCX review preview session command: typed worker failure does not downgrade product carrier to legacy preview', async () => {
  const docx = productReviewDocxWithAnchoredComment();
  let dispatchCount = 0;
  const port = instantiateDocxReviewPreviewSessionPort({
    dispatchCommandSurfaceKernel: async () => {
      dispatchCount += 1;
      return { ok: false, code: 'UNEXPECTED_DISPATCH' };
    },
  });
  const result = await port.handleDocxReviewPreviewSessionActivationCommandSurface(
    toPayload(docx.bytes),
    {
      activeReviewDocxExportAuthorityStore: productAuthorityStoreFromDocx(docx),
      runDocxReviewReturnIntakeInUtilityProcess: async () => ({
        ok: false,
        status: 'blocked',
        code: 'RTK_RETURN_INTAKE_UTILITY_PROCESS_TIMEOUT',
        reason: 'RTK_RETURN_INTAKE_UTILITY_PROCESS_TIMEOUT',
        canOpenReviewSession: false,
        canAutoApply: false,
        canImportMutate: false,
        canWriteStorage: false,
        utilityProcess: {
          requiredForProduct: true,
          attempted: true,
          mode: 'electron-utility-process',
        },
      }),
      buildMainReviewContext: async () => reviewContext({
        scenePath: '/project/roman/imported/scene-1.txt',
        sceneText: 'Anchored text',
      }),
    },
  );

  assert.equal(result.ok, false, JSON.stringify(result, null, 2));
  assert.equal(result.error.code, 'E_DOCX_REVIEW_PREVIEW_SESSION_RETURN_INTAKE_BLOCKED');
  assert.equal(result.error.reason, 'RTK_RETURN_INTAKE_UTILITY_PROCESS_TIMEOUT');
  assert.equal(dispatchCount, 0);
  assert.equal(port.getState().activeReviewSessionLifecycle, 'passive');
});

test('DOCX review preview session command: tampered product carrier HMAC cannot open a session', async () => {
  const docx = productReviewDocxWithAnchoredComment({
    envelopeOverrides: {
      signature: 'hmac-sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    },
  });
  const port = instantiateDocxReviewPreviewSessionPort({
    dispatchCommandSurfaceKernel: async () => {
      throw new Error('tampered product return must not reach comment shadow import');
    },
  });
  const result = await port.handleDocxReviewPreviewSessionActivationCommandSurface(
    toPayload(docx.bytes),
    {
      activeReviewDocxExportAuthorityStore: productAuthorityStoreFromDocx(docx),
      buildMainReviewContext: async () => reviewContext({
        scenePath: '/project/roman/imported/scene-1.txt',
        sceneText: 'Anchored text',
      }),
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'E_DOCX_REVIEW_PREVIEW_SESSION_RETURN_INTAKE_BLOCKED');
  assert.equal(result.error.reason, 'RTK_RETURN_INTAKE_AUTHORITY_NOT_VERIFIED');
  assert.equal(port.getState().activeReviewSessionLifecycle, 'passive');
});


test('DOCX review preview session command: product carrier packet without encoded HMAC proof cannot open a session', async () => {
  const docx = productReviewDocxWithAnchoredComment();
  let dispatchCount = 0;
  const port = instantiateDocxReviewPreviewSessionPort({
    dispatchCommandSurfaceKernel: async () => { dispatchCount += 1; },
  });
  const parserResult = {
    ok: true,
    status: 'review-ir-ready',
    authorityCarrier: {
      status: 'verified-baseline-bound',
      selectedCarrier: {
        payload: docx.payload,
        baselineBinding: { allExpectedMatched: true },
      },
    },
    exactAuthority: { validSignedLocator: true },
    parserProfileDigest: c05Sha256Text('parser-missing-carrier-encoded'),
    analysisDigest: c05Sha256Text('analysis-missing-carrier-encoded'),
    sourceMode: 'TRACKED',
    reviewIr: { commentThreads: [], commentPlacements: [], textRevisions: [] },
  };
  const result = await port.handleDocxReviewPreviewSessionActivationCommandSurface(
    toPayload(docx.bytes),
    {
      activeReviewDocxExportAuthorityStore: productAuthorityStoreFromDocx(docx),
      runDocxReviewReturnIntakeInUtilityProcess: async (input) => wrapParserResultAsPacketResult(parserResult, {
        returnedArtifactSha256: input?.returnedArtifactSha256,
        yrtk2Token: docx.yrtk2.token,
        coreManifestDigest: docx.yrtk2.coreManifestDigest,
      }),
      buildMainReviewContext: async () => reviewContext({
        scenePath: '/project/roman/imported/scene-1.txt',
        sceneText: 'Anchored text',
      }),
    },
  );

  assert.equal(result.ok, false, JSON.stringify(result, null, 2));
  assert.equal(result.error.code, 'E_DOCX_REVIEW_PREVIEW_SESSION_RETURN_INTAKE_BLOCKED');
  assert.equal(result.error.reason, 'RTK_RETURN_INTAKE_AUTHORITY_CARRIER_ENCODED_REQUIRED');
  assert.equal(dispatchCount, 0);
  assert.equal(port.getState().activeReviewSessionLifecycle, 'passive');
});

test('DOCX review preview session command: product carrier verifier absence fails closed before import', async () => {
  const docx = productReviewDocxWithAnchoredComment();
  let dispatchCount = 0;
  const port = instantiateDocxReviewPreviewSessionPort({
    dispatchCommandSurfaceKernel: async () => { dispatchCount += 1; },
    loadRevisionBridgeModule: async () => {
      const bridge = await loadBridge();
      return Object.fromEntries(
        Object.entries(bridge).filter(([name]) => name !== 'verifyAuthorityCarrierSignatureWithSecret'),
      );
    },
  });
  const result = await port.handleDocxReviewPreviewSessionActivationCommandSurface(
    toPayload(docx.bytes),
    {
      activeReviewDocxExportAuthorityStore: productAuthorityStoreFromDocx(docx),
      buildMainReviewContext: async () => reviewContext({
        scenePath: '/project/roman/imported/scene-1.txt',
        sceneText: 'Anchored text',
      }),
    },
  );

  assert.equal(result.ok, false, JSON.stringify(result, null, 2));
  assert.equal(result.error.code, 'E_DOCX_REVIEW_PREVIEW_SESSION_RETURN_INTAKE_BLOCKED');
  assert.equal(result.error.reason, 'RTK_RETURN_INTAKE_AUTHORITY_CARRIER_VERIFIER_REQUIRED');
  assert.equal(dispatchCount, 0);
  assert.equal(port.getState().activeReviewSessionLifecycle, 'passive');
});

test('DOCX review preview session command: stale local scene blocks authenticated return before import', async () => {
  const docx = productReviewDocxWithAnchoredComment();
  const port = instantiateDocxReviewPreviewSessionPort({
    dispatchCommandSurfaceKernel: async () => {
      throw new Error('stale product return must not reach comment shadow import');
    },
  });
  const result = await port.handleDocxReviewPreviewSessionActivationCommandSurface(
    toPayload(docx.bytes),
    {
      activeReviewDocxExportAuthorityStore: productAuthorityStoreFromDocx(docx),
      buildMainReviewContext: async () => reviewContext({
        scenePath: '/project/roman/imported/scene-1.txt',
        sceneText: 'Edited after export',
      }),
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'E_DOCX_REVIEW_PREVIEW_SESSION_RETURN_INTAKE_BLOCKED');
  assert.equal(result.error.reason, 'RTK_RETURN_INTAKE_STALE_CURRENT_SCENE');
  assert.equal(port.getState().activeReviewSessionLifecycle, 'passive');
});

test('DOCX review preview session command: return intake V2 source is before session import and uses parser utility boundary', () => {
  const source = extractMarkedSection(readMainSource(), ACTIVATION_SECTION_START, ACTIVATION_SECTION_END);
  assert.match(source, /inspectDocxReviewReturnIntakeV2[\s\S]*buildDocxReviewPreviewSessionCandidateFromZipBytes/u);
  assert.match(source, /runDocxReviewReturnIntakeParserV2InUtilityProcess/u);
  assert.match(source, /buildDocxReviewTransportAnalysisFromZipBytes/u);
  assert.match(source, /RTK_RETURN_INTAKE_FOREIGN_OR_EXPIRED_ROUND/u);
  assert.match(source, /RTK_RETURN_INTAKE_AUTHORITY_NOT_VERIFIED/u);
});

test('DOCX review preview session command: return intake worker accepts Electron parentPort event payloads', () => {
  delete require.cache[RETURN_INTAKE_WORKER_PATH];
  const worker = require(RETURN_INTAKE_WORKER_PATH);
  assert.equal(typeof worker.unwrapParentPortMessage, 'function');
  assert.equal(typeof worker.stripSecret, 'function');
  assert.deepEqual(
    worker.unwrapParentPortMessage({ data: { bytesBase64: 'QUJD', requestId: 'physical-canary' } }),
    { bytesBase64: 'QUJD', requestId: 'physical-canary' },
  );
  assert.deepEqual(
    worker.unwrapParentPortMessage({ bytesBase64: 'REVG', requestId: 'direct' }),
    { bytesBase64: 'REVG', requestId: 'direct' },
  );
  const bytes = Buffer.from('PK\x03\x04', 'binary');
  const stripped = worker.stripSecret({ bytes, hmacSecret: 'local-secret-never-returned' });
  assert.equal(Buffer.isBuffer(stripped.bytes), true);
  assert.equal(stripped.bytes.equals(bytes), true);
  assert.equal(Object.prototype.hasOwnProperty.call(stripped, 'hmacSecret'), false);
});

test('DOCX review preview session command: source section has no storage write authority', () => {
  const source = extractMarkedSection(readMainSource(), ACTIVATION_SECTION_START, ACTIVATION_SECTION_END);
  assert.match(source, /persistDocxReviewReturnAuthorityStore/u);
  for (const forbidden of [
    'queueDiskOperation',
    'applyExactTextMinSafeWrite',
    'applyDocxImportSafeCreate',
    'buildDocxMinBuffer',
    'receipt:',
    'recovery:',
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});
