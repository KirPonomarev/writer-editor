const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { deflateRawSync } = require('node:zlib');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MAIN_PATH = path.join(REPO_ROOT, 'src', 'main.js');
const ADAPTER_PATH = path.join(REPO_ROOT, 'src', 'utils', 'docxImportLocalFilePreview.js');
const PROJECT_COMMANDS_PATH = path.join(REPO_ROOT, 'src', 'renderer', 'commands', 'projectCommands.mjs');
const CAPABILITY_POLICY_PATH = path.join(REPO_ROOT, 'src', 'renderer', 'commands', 'capabilityPolicy.mjs');
const CAPABILITY_BINDING_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'COMMAND_CAPABILITY_BINDING.json');
const PRELOAD_PATH = path.join(REPO_ROOT, 'src', 'preload.js');
const COMMAND_EFFECT_MODEL_PATH = path.join(REPO_ROOT, 'src', 'renderer', 'commands', 'commandEffectModel.mjs');
const COMMAND_REGISTRY_PATH = path.join(REPO_ROOT, 'src', 'renderer', 'commands', 'registry.mjs');
const RUN_COMMAND_PATH = path.join(REPO_ROOT, 'src', 'renderer', 'commands', 'runCommand.mjs');
const SECTION_START = '// DOCX_IMPORT_LOCAL_FILE_PREVIEW_COMMAND_SURFACE_START';
const SECTION_END = '// DOCX_IMPORT_LOCAL_FILE_PREVIEW_COMMAND_SURFACE_END';

const {
  DOCX_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES,
  DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES,
  createDocxImportLocalFilePreview,
} = require('../../src/utils/docxImportLocalFilePreview');

function readSource(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function extractMarkedSection(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);
  assert.notEqual(start, -1, `missing marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing marker: ${endMarker}`);
  assert.ok(end > start, `marker order invalid: ${startMarker}`);
  return text.slice(start, end + endMarker.length);
}

function cloneJsonSafe(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function isPlainObjectValue(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function instantiateDocxImportLocalFilePreviewCommandPort(options = {}) {
  const section = extractMarkedSection(readSource(MAIN_PATH), SECTION_START, SECTION_END);
  const calls = {
    showOpenDialog: [],
    stat: [],
    readFile: [],
    rememberAdmission: [],
  };
  const sandbox = {
    Buffer,
    calls,
    cloneJsonSafe,
    createDocxImportLocalFilePreview: Object.prototype.hasOwnProperty.call(
      options,
      'createDocxImportLocalFilePreview',
    )
      ? options.createDocxImportLocalFilePreview
      : createDocxImportLocalFilePreview,
    dialog: {
      showOpenDialog: async (...args) => {
        calls.showOpenDialog.push(cloneJsonSafe(args));
        if (typeof options.showOpenDialog === 'function') {
          return options.showOpenDialog(...args);
        }
        return options.dialogResult || { canceled: true };
      },
    },
    DOCX_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES,
    fileManager: {
      getDocumentsPath: () => (
        typeof options.documentsPath === 'string' ? options.documentsPath : os.tmpdir()
      ),
    },
    fs: {
      stat: async (filePath) => {
        calls.stat.push(filePath);
        if (typeof options.stat === 'function') return options.stat(filePath);
        return {
          size: Number.isInteger(options.size)
            ? options.size
            : Buffer.isBuffer(options.bytes)
              ? options.bytes.length
              : Buffer.byteLength(String(options.bytes || '')),
          isFile: () => options.isFile !== false,
        };
      },
      readFile: async (filePath) => {
        calls.readFile.push(filePath);
        if (typeof options.readFile === 'function') return options.readFile(filePath);
        return Buffer.from(options.bytes || '');
      },
    },
    getProjectRootPath: () => (
      typeof options.projectRoot === 'string'
        ? options.projectRoot
        : path.join(os.tmpdir(), 'docx-local-command-project-root')
    ),
    isPlainObjectValue,
    readExternalFileBounded: async (filePath, readOptions = {}) => {
      const bytes = await sandbox.fs.readFile(filePath);
      const byteLength = Buffer.isBuffer(bytes) ? bytes.length : Buffer.byteLength(String(bytes || ''));
      if (Number.isInteger(readOptions.maxBytes) && byteLength > readOptions.maxBytes) {
        const error = new Error('EXTERNAL_SOURCE_TOO_LARGE');
        error.code = 'E_EXTERNAL_FILE_AUTHORITY';
        error.reason = 'EXTERNAL_SOURCE_TOO_LARGE';
        error.details = { maxBytes: readOptions.maxBytes, actualBytes: byteLength };
        throw error;
      }
      if (Number.isInteger(readOptions.expectedBytes) && readOptions.expectedBytes !== byteLength) {
        const error = new Error('EXTERNAL_SOURCE_CHANGED_DURING_READ');
        error.code = 'E_EXTERNAL_FILE_AUTHORITY';
        error.reason = 'EXTERNAL_SOURCE_CHANGED_DURING_READ';
        throw error;
      }
      return { bytes: Buffer.from(bytes), byteLength };
    },
    rememberDocxImportPreviewPlanAdmission: typeof options.rememberAdmission === 'function'
      ? (plan) => {
          calls.rememberAdmission.push(cloneJsonSafe(plan));
          return options.rememberAdmission(plan);
        }
      : (plan) => {
          calls.rememberAdmission.push(cloneJsonSafe(plan));
          return 'admitted-preview-plan';
        },
    mainWindow: options.mainWindow || {},
    module: { exports: {} },
    exports: {},
    path,
  };

  vm.runInNewContext(
    `${section}
module.exports = {
  calls,
  DOCX_IMPORT_LOCAL_FILE_PREVIEW_COMMAND_ID,
  findDocxImportLocalFilePreviewForbiddenKey,
  pickDocxImportLocalFilePreviewFile,
  readDocxImportLocalFilePreviewBytes,
  validateDocxImportLocalFilePreviewSuccessResult,
  buildDocxImportLocalFilePreviewCommandResult,
  handleDocxImportLocalFilePreviewCommandSurface,
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

function localRecord(entry, offset) {
  const normalized = normalizeEntry(entry);
  const name = asciiBytes(normalized.name);
  const header = Buffer.alloc(30 + name.length);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(entry.flags ?? 0, 6);
  header.writeUInt16LE(normalized.method, 8);
  header.writeUInt32LE(0, 14);
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
  header.writeUInt16LE(entry.method, 10);
  header.writeUInt32LE(0, 16);
  header.writeUInt32LE(entry.compressedSize, 20);
  header.writeUInt32LE(entry.byteSize, 24);
  header.writeUInt16LE(name.length, 28);
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
  end.writeUInt16LE(locals.length, 8);
  end.writeUInt16LE(locals.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([Buffer.concat(locals.map((entry) => entry.bytes)), central, end]);
}

function documentXml(body) {
  return `<w:document><w:body>${body}</w:body></w:document>`;
}

function paragraphXml(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function cleanDocxZip(body = '<w:p/>') {
  return zipFixture([
    {
      name: 'word/document.xml',
      method: 8,
      body: documentXml(body),
    },
  ]);
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

function assertNoForbiddenPublicFields(value) {
  const keys = collectKeys(value);
  const forbidden = [
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
  ];

  for (const key of forbidden) {
    assert.equal(
      keys.some((candidate) => candidate === key || candidate.endsWith(`.${key}`)),
      false,
      key,
    );
  }
}

function assertNoTempMutation(tempRoot) {
  assert.deepEqual(fs.readdirSync(tempRoot).sort(), []);
}

async function importModule(filePath) {
  return import(pathToFileURL(filePath).href);
}

test('DOCX local file preview command surface: command is bridge wired with explicit node capability', async () => {
  const mainSource = readSource(MAIN_PATH);
  const section = extractMarkedSection(mainSource, SECTION_START, SECTION_END);
  const adapterSource = readSource(ADAPTER_PATH);
  const projectCommandsSource = readSource(PROJECT_COMMANDS_PATH);
  const capabilityPolicySource = readSource(CAPABILITY_POLICY_PATH);
  const bindingDoc = JSON.parse(readSource(CAPABILITY_BINDING_PATH));
  const bindingMap = new Map(bindingDoc.items.map((item) => [item.commandId, item.capabilityId]));
  const { createCommandRegistry } = await importModule(COMMAND_REGISTRY_PATH);
  const { createCommandRunner } = await importModule(RUN_COMMAND_PATH);
  const { registerProjectCommands, EXTRA_COMMAND_IDS } = await importModule(PROJECT_COMMANDS_PATH);

  assert.match(
    mainSource,
    /UI_COMMAND_BRIDGE_ALLOWED_COMMAND_IDS\s*=\s*new Set\(\[[\s\S]*'cmd\.project\.docx\.previewLocalFile'/,
  );
  assert.match(
    mainSource,
    /'cmd\.project\.docx\.previewLocalFile':\s*async\s*\(payload\s*=\s*\{\}\)\s*=>\s*\{\s*return handleDocxImportLocalFilePreviewCommandSurface\(payload\);/,
  );
  assert.ok(projectCommandsSource.includes("PROJECT_DOCX_PREVIEW_LOCAL_FILE: 'cmd.project.docx.previewLocalFile'"));
  assert.ok(projectCommandsSource.includes('id: EXTRA_COMMAND_IDS.PROJECT_DOCX_PREVIEW_LOCAL_FILE,'));
  assert.ok(projectCommandsSource.includes("surface: ['internal'],"));
  assert.ok(projectCommandsSource.includes('invokeBridgeOnlyCommand('));
  assert.ok(readSource(PRELOAD_PATH).includes('invokeUiCommandBridge: (request) => {'));
  assert.ok(readSource(COMMAND_EFFECT_MODEL_PATH).includes("if (effectType === 'electron-bridge-only') {"));
  assert.ok(capabilityPolicySource.includes("'cmd.project.docx.previewLocalFile': 'cap.project.docx.previewLocalFile'"));
  assert.equal(bindingMap.get('cmd.project.docx.previewLocalFile'), 'cap.project.docx.previewLocalFile');

  const capabilityPolicy = await importModule(CAPABILITY_POLICY_PATH);
  assert.deepEqual(
    capabilityPolicy.enforceCapabilityForCommand('cmd.project.docx.previewLocalFile', { platformId: 'node' }),
    { ok: true },
  );
  assert.equal(
    capabilityPolicy.enforceCapabilityForCommand('cmd.project.docx.previewLocalFile', { platformId: 'web' }).error.reason,
    'CAPABILITY_DISABLED_FOR_COMMAND',
  );
  assert.equal(
    capabilityPolicy.enforceCapabilityForCommand(
      'cmd.project.docx.previewLocalFile',
      { platformId: 'mobile-wrapper' },
    ).error.reason,
    'CAPABILITY_DISABLED_FOR_COMMAND',
  );

  const bridgeRequests = [];
  const registry = createCommandRegistry();
  registerProjectCommands(registry, {
    electronAPI: {
      invokeUiCommandBridge: async (request) => {
        bridgeRequests.push(cloneJsonSafe(request));
        return {
          ok: true,
          value: {
            ok: true,
            requestId: 'renderer-run',
            commandId: 'cmd.project.docx.previewLocalFile',
            commandOk: true,
            schemaVersion: 'revision-bridge.docx-import-local-file-preview.v1',
            type: 'docx.import.localFilePreview',
            status: 'preview',
            code: 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_READY',
            reason: 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_READY',
            decision: 'preview',
            writeEffects: false,
            contentPreviewOk: true,
            importPreviewOk: true,
            docxContentPreviewReport: { ok: true },
            docxImportPreviewPlan: { ok: true },
          },
        };
      },
    },
  });

  const meta = registry.getMeta(EXTRA_COMMAND_IDS.PROJECT_DOCX_PREVIEW_LOCAL_FILE);
  assert.deepEqual(meta.surface, ['internal']);
  const runNodeCommand = createCommandRunner(registry, { capability: { platformId: 'node' } });
  const nodeResult = await runNodeCommand(EXTRA_COMMAND_IDS.PROJECT_DOCX_PREVIEW_LOCAL_FILE, {
    requestId: 'renderer-run',
  });
  assert.equal(nodeResult.ok, true, JSON.stringify(nodeResult, null, 2));
  assert.equal(nodeResult.value.preview, true);
  assert.equal(nodeResult.value.localFilePreview.commandId, 'cmd.project.docx.previewLocalFile');
  assert.deepEqual(bridgeRequests, [{
    route: 'command.bus',
    commandId: 'cmd.project.docx.previewLocalFile',
    payload: { requestId: 'renderer-run' },
  }]);

  const runWebCommand = createCommandRunner(registry, { capability: { platformId: 'web' } });
  const webResult = await runWebCommand(EXTRA_COMMAND_IDS.PROJECT_DOCX_PREVIEW_LOCAL_FILE, {
    requestId: 'renderer-web',
  });
  assert.equal(webResult.ok, false);
  assert.equal(webResult.error.reason, 'CAPABILITY_DISABLED_FOR_COMMAND');
  assert.equal(bridgeRequests.length, 1);

  for (const forbidden of [
    'applyDocxImportSafeCreate',
    'writeFlowSceneBatchAtomic',
    '.flow-batch',
    'runDocxMinExport',
    'handleExportDocxMin',
    'persistBookProfile',
    'ensureProjectStructure',
  ]) {
    assert.equal(section.includes(forbidden), false, forbidden);
  }
  for (const forbidden of [
    'showOpenDialog',
    'ipcMain',
    'BrowserWindow',
    'MENU_COMMAND_HANDLERS',
    'applyDocxImportSafeCreate',
    'writeFlowSceneBatchAtomic',
  ]) {
    assert.equal(adapterSource.includes(forbidden), false, forbidden);
  }
});

test('DOCX local file preview command surface: clean selected DOCX returns pathless preview command envelope', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'docx-local-command-'));
  const selectedPath = path.join(tempRoot, 'Preview.docx');
  const bytes = cleanDocxZip([
    paragraphXml('Alpha'),
    paragraphXml('Bravo'),
  ].join(''));
  const port = instantiateDocxImportLocalFilePreviewCommandPort({
    documentsPath: tempRoot,
    dialogResult: { canceled: false, filePaths: [selectedPath] },
    size: bytes.length,
    bytes,
  });

  const result = await port.handleDocxImportLocalFilePreviewCommandSurface({
    requestId: 'local-command-1',
  });

  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(result.commandId, 'cmd.project.docx.previewLocalFile');
  assert.equal(result.requestId, 'local-command-1');
  assert.equal(result.commandOk, true);
  assert.equal(result.writeEffects, false);
  assert.equal(result.contentPreviewOk, true);
  assert.equal(result.importPreviewOk, true);
  assert.equal(result.docxContentPreviewReport.code, 'DOCX_CONTENT_PREVIEW_READY');
  assert.deepEqual(result.docxContentPreviewReport.contentPreview.paragraphs.map((entry) => entry.text), [
    'Alpha',
    'Bravo',
  ]);
  assert.equal(result.docxImportPreviewPlan.code, 'DOCX_IMPORT_PREVIEW_READY');
  assert.equal(result.docxImportPreviewPlan.candidateCreatePlan.entries[0].content, 'Alpha\n\nBravo');
  assert.equal(port.calls.rememberAdmission.length, 0);
  assert.equal(port.calls.showOpenDialog.length, 1);
  assert.equal(port.calls.readFile.length, 1);
  assertNoForbiddenPublicFields(result);
  assert.equal(JSON.stringify(result).includes(selectedPath), false);
});

test('DOCX local file preview command surface: cancel and invalid selection fail closed before read', async () => {
  const cancelled = instantiateDocxImportLocalFilePreviewCommandPort({
    dialogResult: { canceled: true, filePaths: [] },
  });
  const cancelledResult = await cancelled.handleDocxImportLocalFilePreviewCommandSurface({});
  assert.equal(cancelledResult.ok, false);
  assert.equal(cancelledResult.error.reason, DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.PICKER_CANCELLED);
  assert.equal(cancelled.calls.readFile.length, 0);
  assertNoForbiddenPublicFields(cancelledResult);

  const invalid = instantiateDocxImportLocalFilePreviewCommandPort({
    dialogResult: { canceled: false, filePaths: [] },
  });
  const invalidResult = await invalid.handleDocxImportLocalFilePreviewCommandSurface({});
  assert.equal(invalidResult.ok, false);
  assert.equal(invalidResult.error.reason, DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.SELECTION_INVALID);
  assert.equal(invalid.calls.readFile.length, 0);
  assertNoForbiddenPublicFields(invalidResult);
});

test('DOCX local file preview command surface: extension and size gates fail before bridge preview', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'docx-local-command-gates-'));
  const unsupported = instantiateDocxImportLocalFilePreviewCommandPort({
    dialogResult: { canceled: false, filePaths: [path.join(tempRoot, 'NotDocx.txt')] },
    bytes: cleanDocxZip('<w:p/>'),
  });
  const unsupportedResult = await unsupported.handleDocxImportLocalFilePreviewCommandSurface({});
  assert.equal(unsupportedResult.ok, false);
  assert.equal(unsupportedResult.error.reason, DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.EXTENSION_UNSUPPORTED);
  assert.equal(unsupported.calls.readFile.length, 0);
  assertNoForbiddenPublicFields(unsupportedResult);

  const oversizedHint = instantiateDocxImportLocalFilePreviewCommandPort({
    dialogResult: { canceled: false, filePaths: [path.join(tempRoot, 'Huge.docx')] },
    size: DOCX_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES + 1,
    bytes: cleanDocxZip('<w:p/>'),
  });
  const oversizedHintResult = await oversizedHint.handleDocxImportLocalFilePreviewCommandSurface({});
  assert.equal(oversizedHintResult.ok, false);
  assert.equal(oversizedHintResult.error.reason, DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.FILE_TOO_LARGE);
  assert.equal(oversizedHint.calls.readFile.length, 0);
  assertNoForbiddenPublicFields(oversizedHintResult);

  const oversizedActual = instantiateDocxImportLocalFilePreviewCommandPort({
    dialogResult: { canceled: false, filePaths: [path.join(tempRoot, 'HugeActual.docx')] },
    size: 1,
    bytes: Buffer.alloc(DOCX_IMPORT_LOCAL_FILE_PREVIEW_MAX_BYTES + 1),
  });
  const oversizedActualResult = await oversizedActual.handleDocxImportLocalFilePreviewCommandSurface({});
  assert.equal(oversizedActualResult.ok, false);
  assert.equal(oversizedActualResult.error.reason, 'EXTERNAL_SOURCE_TOO_LARGE');
  assert.equal(oversizedActual.calls.readFile.length, 1);
  assertNoForbiddenPublicFields(oversizedActualResult);
});

test('DOCX local file preview command surface: read failure and empty bytes fail closed', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'docx-local-command-read-'));
  const readFailure = instantiateDocxImportLocalFilePreviewCommandPort({
    dialogResult: { canceled: false, filePaths: [path.join(tempRoot, 'ReadFail.docx')] },
    readFile: async () => {
      throw new Error('read failed');
    },
  });
  const readFailureResult = await readFailure.handleDocxImportLocalFilePreviewCommandSurface({});
  assert.equal(readFailureResult.ok, false);
  assert.equal(readFailureResult.error.reason, DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.READ_FAILED);
  assertNoForbiddenPublicFields(readFailureResult);

  const emptyBytes = instantiateDocxImportLocalFilePreviewCommandPort({
    dialogResult: { canceled: false, filePaths: [path.join(tempRoot, 'Empty.docx')] },
    bytes: Buffer.alloc(0),
  });
  const emptyBytesResult = await emptyBytes.handleDocxImportLocalFilePreviewCommandSurface({});
  assert.equal(emptyBytesResult.ok, false);
  assert.equal(emptyBytesResult.error.reason, DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.BYTES_INVALID);
  assertNoForbiddenPublicFields(emptyBytesResult);
});

test('DOCX local file preview command surface: malformed and hostile DOCX remain non-mutating preview failures', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'docx-local-command-hostile-'));
  const malformed = instantiateDocxImportLocalFilePreviewCommandPort({
    dialogResult: { canceled: false, filePaths: [path.join(tempRoot, 'Malformed.docx')] },
    bytes: cleanDocxZip('<w:p><w:r><w:t>Alpha</w:r></w:p>'),
  });
  const malformedResult = await malformed.handleDocxImportLocalFilePreviewCommandSurface({});
  assert.equal(malformedResult.ok, true);
  assert.equal(malformedResult.status, 'blocked');
  assert.equal(malformedResult.importPreviewOk, false);
  assert.equal(malformedResult.docxImportPreviewPlan, null);
  assert.equal(malformedResult.docxContentPreviewReport.code, 'DOCX_CONTENT_PREVIEW_XML_MALFORMED');
  assertNoForbiddenPublicFields(malformedResult);

  const hostileDuplicate = instantiateDocxImportLocalFilePreviewCommandPort({
    dialogResult: { canceled: false, filePaths: [path.join(tempRoot, 'Duplicate.docx')] },
    bytes: zipFixture([
      { name: 'word/document.xml', body: documentXml(paragraphXml('A')) },
      { name: 'WORD/DOCUMENT.XML', body: documentXml(paragraphXml('B')) },
    ]),
  });
  const duplicateResult = await hostileDuplicate.handleDocxImportLocalFilePreviewCommandSurface({});
  assert.equal(duplicateResult.ok, true);
  assert.equal(duplicateResult.status, 'blocked');
  assert.equal(duplicateResult.importPreviewOk, false);
  assert.equal(duplicateResult.docxImportPreviewPlan, null);
  assert.equal(duplicateResult.docxContentPreviewReport.code, 'DOCX_CONTENT_PREVIEW_PREFLIGHT_BLOCKED');
  assertNoForbiddenPublicFields(duplicateResult);
});

test('DOCX local file preview command surface: renderer path injection is rejected before picker and temp project stays clean', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'docx-local-command-inject-'));
  const port = instantiateDocxImportLocalFilePreviewCommandPort({
    documentsPath: tempRoot,
    dialogResult: { canceled: false, filePaths: [path.join(tempRoot, 'Ignored.docx')] },
    bytes: cleanDocxZip('<w:p/>'),
  });
  const injectedPath = path.join(tempRoot, 'Injected.docx');

  const result = await port.handleDocxImportLocalFilePreviewCommandSurface({
    requestId: 'renderer-injection',
    path: injectedPath,
    filePath: injectedPath,
    projectRoot: tempRoot,
    rawBytes: 'ignored',
    bufferSource: 'ignored',
    outPath: injectedPath,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, DOCX_IMPORT_LOCAL_FILE_PREVIEW_CODES.INPUT_INVALID);
  assert.equal(port.calls.showOpenDialog.length, 0);
  assert.equal(port.calls.readFile.length, 0);
  assertNoForbiddenPublicFields(result);
  assert.equal(JSON.stringify(result).includes(injectedPath), false);
  for (const forbiddenText of ['filePath', 'projectRoot', 'rawBytes', 'bufferSource', 'outPath']) {
    assert.equal(JSON.stringify(result).includes(forbiddenText), false, forbiddenText);
  }
  assertNoTempMutation(tempRoot);
});

test('DOCX local file preview command surface: helper and hostile output fail closed without public leaks', async () => {
  const helperMissing = instantiateDocxImportLocalFilePreviewCommandPort({
    createDocxImportLocalFilePreview: undefined,
  });
  const helperMissingResult = await helperMissing.handleDocxImportLocalFilePreviewCommandSurface({});
  assert.equal(helperMissingResult.ok, false);
  assert.equal(helperMissingResult.error.reason, 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_HELPER_UNAVAILABLE');
  assertNoForbiddenPublicFields(helperMissingResult);

  const hostileOutput = instantiateDocxImportLocalFilePreviewCommandPort({
    createDocxImportLocalFilePreview: async () => ({
      ok: true,
      requestId: 'hostile-output',
      schemaVersion: 'revision-bridge.docx-import-local-file-preview.v1',
      type: 'docx.import.localFilePreview',
      status: 'preview',
      code: 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_READY',
      reason: 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_READY',
      decision: 'preview',
      writeEffects: false,
      contentPreviewOk: true,
      importPreviewOk: true,
      docxContentPreviewReport: { ok: true },
      docxImportPreviewPlan: {
        ok: true,
        writeReceipt: { path: '/tmp/leak' },
      },
    }),
  });
  const hostileResult = await hostileOutput.handleDocxImportLocalFilePreviewCommandSurface({});
  assert.equal(hostileResult.ok, false);
  assert.equal(hostileResult.error.reason, 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_FORBIDDEN_RESULT');
  assert.equal(hostileResult.error.details.key, 'docxImportPreviewPlan.writeReceipt');
  assertNoForbiddenPublicFields(hostileResult);
});
