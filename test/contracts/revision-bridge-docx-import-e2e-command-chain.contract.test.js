const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { deflateRawSync } = require('node:zlib');
const { pathToFileURL } = require('node:url');

const {
  applyDocxImportSafeCreate,
  isDocxImportPreviewPlanAdmitted,
  rememberDocxImportPreviewPlanAdmission,
} = require('../../src/utils/docxImportSafeCreate');
const { writeFlowSceneBatchAtomic } = require('../../src/utils/flowSceneBatchAtomic');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MAIN_PATH = path.join(REPO_ROOT, 'src', 'main.js');
const BRIDGE_MODULE_PATH = path.join(REPO_ROOT, 'src', 'io', 'revisionBridge', 'index.mjs');
const DOCX_IMPORT_SCENE_INTEGRITY_SCOPE = 'CANONICAL_TEXT_NORMALIZED_LINE_ENDINGS';
const DOCX_IMPORT_CREATED_AT_AUTHORITY = 'NON_AUTHORITATIVE_EVENT_METADATA_SHAPE_ONLY';

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

function cloneJsonSafe(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function isPlainObjectValue(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
}

async function loadBridge() {
  return import(pathToFileURL(BRIDGE_MODULE_PATH).href);
}

function instantiateMainSection(startMarker, endMarker, exportSource, sandbox) {
  const section = extractMarkedSection(readMainSource(), startMarker, endMarker);
  vm.runInNewContext(
    `${section}
module.exports = {
${exportSource}
};`,
    sandbox,
    { filename: MAIN_PATH },
  );
  return sandbox.module.exports;
}

function instantiateDocxIntakeGatePort() {
  return instantiateMainSection(
    '// DOCX_INTAKE_GATE_COMMAND_SURFACE_START',
    '// DOCX_INTAKE_GATE_COMMAND_SURFACE_END',
    `
  DOCX_INTAKE_GATE_COMMAND_ID,
  handleDocxIntakeGateCommandSurface,
`,
    {
      activeReviewSessionStore: null,
      activeReviewSessionLifecycle: 'passive',
      currentReviewSurfacePayload: {},
      currentReviewSurfacePayloadSource: 'none',
      currentReviewSurfacePayloadContentHash: '',
      Buffer,
      cloneJsonSafe,
      isPlainObjectValue,
      loadRevisionBridgeModule: loadBridge,
      module: { exports: {} },
      exports: {},
    },
  );
}

function instantiateDocxContentPreviewPort() {
  return instantiateMainSection(
    '// DOCX_CONTENT_PREVIEW_COMMAND_SURFACE_START',
    '// DOCX_CONTENT_PREVIEW_COMMAND_SURFACE_END',
    `
  DOCX_CONTENT_PREVIEW_COMMAND_ID,
  handleDocxContentPreviewCommandSurface,
`,
    {
      Buffer,
      cloneJsonSafe,
      isPlainObjectValue,
      loadRevisionBridgeModule: loadBridge,
      module: { exports: {} },
      exports: {},
    },
  );
}

function instantiateDocxImportPreviewPort(options = {}) {
  const calls = {
    rememberAdmission: [],
  };
  return instantiateMainSection(
    '// DOCX_IMPORT_PREVIEW_COMMAND_SURFACE_START',
    '// DOCX_IMPORT_PREVIEW_COMMAND_SURFACE_END',
    `
  calls,
  DOCX_IMPORT_PREVIEW_COMMAND_ID,
  handleDocxImportPreviewCommandSurface,
`,
    {
      calls,
      cloneJsonSafe,
      isPlainObjectValue,
      loadRevisionBridgeModule: loadBridge,
      rememberDocxImportPreviewPlanAdmission: typeof options.rememberAdmission === 'function'
        ? options.rememberAdmission
        : (plan) => {
            calls.rememberAdmission.push(cloneJsonSafe(plan));
            return rememberDocxImportPreviewPlanAdmission(plan);
          },
      module: { exports: {} },
      exports: {},
    },
  );
}

function instantiateDocxSafeCreatePort(options = {}) {
  const projectRoot = options.projectRoot;
  const romanRoot = options.romanRoot || path.join(projectRoot, 'roman');
  const calls = {
    ensureProjectStructure: 0,
    resolveProjectBindingForFile: [],
    queueDiskOperation: [],
  };

  return instantiateMainSection(
    '// DOCX_IMPORT_SAFE_CREATE_COMMAND_SURFACE_START',
    '// DOCX_IMPORT_SAFE_CREATE_COMMAND_SURFACE_END',
    `
  calls,
  DOCX_IMPORT_SAFE_CREATE_COMMAND_ID,
  handleDocxImportSafeCreateCommandSurface,
`,
    {
      calls,
      cloneJsonSafe,
      isPlainObjectValue,
      isDocxImportPreviewPlanAdmitted,
      applyDocxImportSafeCreate,
      ensureProjectStructure: async () => {
        calls.ensureProjectStructure += 1;
        fs.mkdirSync(romanRoot, { recursive: true });
      },
      getProjectSectionPath: (sectionName) => (
        sectionName === 'roman' ? romanRoot : path.join(projectRoot, sectionName)
      ),
      getProjectRootPath: () => projectRoot,
      resolveProjectBindingForFile: async (targetPath) => {
        calls.resolveProjectBindingForFile.push(targetPath);
        return { projectId: 'docx-e2e-project' };
      },
      queueDiskOperation: async (operation, operationLabel) => {
        calls.queueDiskOperation.push(operationLabel);
        return operation();
      },
      getMainProjectManifestAuthority: async () => options.transactionAuthority || null,
      writeFlowSceneBatchAtomic,
      module: { exports: {} },
      exports: {},
    },
  );
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
  header.writeUInt16LE(entry.flags ?? 0, 8);
  header.writeUInt16LE(entry.method, 10);
  header.writeUInt32LE(0, 16);
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

function documentXml(body) {
  return `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
}

function paragraphXml(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function cleanDocxZip(paragraphs = ['Alpha', 'Bravo']) {
  return zipFixture([
    {
      name: 'word/document.xml',
      method: 8,
      body: documentXml(paragraphs.map(paragraphXml).join('')),
    },
  ]);
}

function hostileDuplicateDocxZip() {
  return zipFixture([
    { name: 'word/document.xml', body: documentXml(paragraphXml('A')) },
    { name: 'WORD/DOCUMENT.XML', body: documentXml(paragraphXml('B')) },
  ]);
}

function toBufferPayload(bytes, requestId = 'request-1') {
  return {
    requestId,
    bufferSource: Buffer.from(bytes).toString('base64'),
  };
}

function makeProjectRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
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

function assertNoPublicAuthorityLeak(value) {
  const keys = collectKeys(value);
  for (const forbidden of [
    'path',
    'filePath',
    'projectRoot',
    'rawBytes',
    'bufferSource',
    'zip',
    'storage',
    'writeReceipt',
    'importReceipt',
    'exportReceipt',
  ]) {
    assert.equal(
      keys.some((key) => key === forbidden || key.endsWith(`.${forbidden}`)),
      false,
      forbidden,
    );
  }
}

function assertDocxCommandBridgeWiring() {
  const source = readMainSource();
  const wiring = [
    {
      commandId: 'cmd.project.review.inspectDocxIntakeGate',
      handler: 'handleDocxIntakeGateCommandSurface',
    },
    {
      commandId: 'cmd.project.docx.previewContent',
      handler: 'handleDocxContentPreviewCommandSurface',
    },
    {
      commandId: 'cmd.project.docx.previewImportPlan',
      handler: 'handleDocxImportPreviewCommandSurface',
    },
    {
      commandId: 'cmd.project.docx.importSafeCreate',
      handler: 'handleDocxImportSafeCreateCommandSurface',
    },
  ];

  for (const item of wiring) {
    assert.match(
      source,
      new RegExp(`UI_COMMAND_BRIDGE_ALLOWED_COMMAND_IDS\\s*=\\s*new Set\\(\\[[\\s\\S]*'${item.commandId.replace(/\./gu, '\\.')}'`, 'u'),
      item.commandId,
    );
    assert.match(
      source,
      new RegExp(`'${item.commandId.replace(/\./gu, '\\.')}':\\s*async\\s*\\(payload\\s*=\\s*\\{\\}\\)\\s*=>\\s*\\{\\s*return ${item.handler}\\(payload\\);`, 'u'),
      item.handler,
    );
  }
}

function readOnlyCreatedScene(romanRoot) {
  return fs.readFileSync(readOnlyCreatedScenePath(romanRoot), 'utf8');
}

function readOnlyCreatedScenePath(romanRoot) {
  const importedRoot = path.join(romanRoot, 'Imported');
  const names = fs.readdirSync(importedRoot).filter((name) => name.endsWith('.txt')).sort();
  assert.equal(names.length, 1);
  return path.join(importedRoot, names[0]);
}

function durableReceiptPath(projectRoot, importOperationId) {
  return path.join(
    projectRoot,
    '.yalken',
    'docx-import',
    'receipts',
    `${importOperationId}.json`,
  );
}

function mutateDurableReceipt(projectRoot, importOperationId, mutator) {
  const receiptPath = durableReceiptPath(projectRoot, importOperationId);
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  const nextReceipt = mutator(receipt) || receipt;
  fs.writeFileSync(receiptPath, `${JSON.stringify(nextReceipt, null, 2)}\n`, 'utf8');
  return nextReceipt;
}

function writeDurableReceiptText(projectRoot, importOperationId, text) {
  fs.writeFileSync(durableReceiptPath(projectRoot, importOperationId), text, 'utf8');
}

function assertIdempotentIntegrityFailure(result, safeCreatePort, expectedQueueCallCount) {
  assert.equal(result.ok, false, JSON.stringify(result, null, 2));
  assert.equal(result.error.code, 'DOCX_SAFE_CREATE_IDEMPOTENT_RECEIPT_INTEGRITY_FAILED');
  assert.equal(result.error.reason, 'docx_import_safe_create_idempotent_receipt_integrity_failed');
  assert.equal(safeCreatePort.calls.queueDiskOperation.length, expectedQueueCallCount);
  assertNoPublicAuthorityLeak(result);
}

async function runDocxImportCommandChain(bytes, options = {}) {
  const projectRoot = options.projectRoot || makeProjectRoot('docx-import-e2e-command-chain-');
  const romanRoot = path.join(projectRoot, 'roman');
  const intakePort = instantiateDocxIntakeGatePort();
  const contentPort = instantiateDocxContentPreviewPort();
  const importPreviewPort = instantiateDocxImportPreviewPort(options.importPreviewOptions || {});
  const safeCreatePort = instantiateDocxSafeCreatePort({
    projectRoot,
    romanRoot,
    transactionAuthority: options.transactionAuthority,
  });
  const bufferPayload = toBufferPayload(bytes);

  const intake = await intakePort.handleDocxIntakeGateCommandSurface(bufferPayload);
  const content = await contentPort.handleDocxContentPreviewCommandSurface(bufferPayload);
  const preview = await importPreviewPort.handleDocxImportPreviewCommandSurface({
    requestId: 'request-1',
    docxContentPreviewReport: content.docxContentPreviewReport,
  });
  const safeCreate = await safeCreatePort.handleDocxImportSafeCreateCommandSurface({
    requestId: 'request-1',
    docxImportPreviewPlan: preview.docxImportPreviewPlan,
  });

  return {
    projectRoot,
    romanRoot,
    ports: {
      importPreview: importPreviewPort,
      safeCreate: safeCreatePort,
    },
    intake,
    content,
    preview,
    safeCreate,
  };
}

async function assertDurableReceiptMutationFailsClosed({
  paragraphPrefix,
  mutate,
  field,
  failReason,
}) {
  const first = await runDocxImportCommandChain(cleanDocxZip([`${paragraphPrefix} ${Date.now()}`]));
  assert.equal(first.safeCreate.ok, true, JSON.stringify(first.safeCreate, null, 2));
  const originalText = readOnlyCreatedScene(first.romanRoot);
  const firstOperationId = first.safeCreate.receipt.importOperationId;
  const queueCallsBeforeDuplicate = first.ports.safeCreate.calls.queueDiskOperation.length;

  mutateDurableReceipt(first.projectRoot, firstOperationId, mutate);
  const duplicate = await first.ports.safeCreate.handleDocxImportSafeCreateCommandSurface({
    requestId: first.safeCreate.requestId,
    docxImportPreviewPlan: first.preview.docxImportPreviewPlan,
  });

  assertIdempotentIntegrityFailure(duplicate, first.ports.safeCreate, queueCallsBeforeDuplicate);
  assert.equal(duplicate.error.details.field, field);
  if (failReason) assert.equal(duplicate.error.details.failReason, failReason);
  assert.equal(duplicate.error.details.sceneId, first.safeCreate.createdSceneIds[0]);
  assert.equal(readOnlyCreatedScene(first.romanRoot), originalText);
}

function makeDocxImportTransactionAuthority(overrides = {}, options = {}) {
  const calls = [];
  const readCalls = [];
  const result = {
    revision: 'ignored-revision',
    fencingGeneration: 7,
    nextHash: 'a'.repeat(64),
    previousHash: 'b'.repeat(64),
    durablePublication: true,
    ...overrides,
  };
  let committedAuthority = null;
  const authority = {
    calls,
    readCalls,
    async commitManifestText(payload) {
      calls.push(cloneJsonSafe(payload));
      committedAuthority = {
        revision: String(result.fencingGeneration),
        fencingGeneration: result.fencingGeneration,
        nextHash: result.nextHash,
        previousHash: result.previousHash,
        durablePublication: result.durablePublication,
      };
      return { ...result };
    },
  };
  if (options.exposeReadback !== false) {
    authority.readManifestAuthorityForImport = async (payload) => {
      readCalls.push(cloneJsonSafe(payload));
      if (typeof options.readback === 'function') {
        return options.readback(cloneJsonSafe(payload), cloneJsonSafe(committedAuthority));
      }
      if (options.readback !== undefined) return cloneJsonSafe(options.readback);
      return cloneJsonSafe(committedAuthority);
    };
  }
  return authority;
}

async function assertTransactionAuthorityCoherentForgeryFailsClosed({
  paragraphPrefix,
  requestId,
  mutate,
  field = 'manifestAuthority',
  failReason = 'trusted_manifest_authority_mismatch',
}) {
  const transactionAuthority = makeDocxImportTransactionAuthority();
  const first = await runDocxImportCommandChain(
    cleanDocxZip([`${paragraphPrefix} ${Date.now()}`]),
    { transactionAuthority },
  );
  assert.equal(first.safeCreate.ok, true, JSON.stringify(first.safeCreate, null, 2));
  const originalText = readOnlyCreatedScene(first.romanRoot);
  const receipt = first.safeCreate.receipt;
  const queueCallsBeforeDuplicate = first.ports.safeCreate.calls.queueDiskOperation.length;

  mutateDurableReceipt(first.projectRoot, receipt.importOperationId, mutate);
  const duplicate = await first.ports.safeCreate.handleDocxImportSafeCreateCommandSurface({
    requestId: first.safeCreate.requestId,
    docxImportPreviewPlan: first.preview.docxImportPreviewPlan,
  });

  assertIdempotentIntegrityFailure(duplicate, first.ports.safeCreate, queueCallsBeforeDuplicate);
  assert.equal(duplicate.error.details.field, field);
  assert.equal(duplicate.error.details.failReason, failReason);
  assert.equal(transactionAuthority.readCalls.length, 1);
  assert.equal(transactionAuthority.readCalls[0].projectId, 'docx-e2e-project');
  assert.equal(transactionAuthority.readCalls[0].importOperationId, receipt.importOperationId);
  assert.equal(readOnlyCreatedScene(first.romanRoot), originalText);
}

test('DOCX import e2e command chain: command ids remain live-dispatch wired', () => {
  assertDocxCommandBridgeWiring();
});

test('DOCX import e2e command chain: clean DOCX creates one local scene with pathless receipt', async () => {
  const result = await runDocxImportCommandChain(cleanDocxZip(['Alpha', 'Bravo']));

  assert.equal(result.intake.ok, true);
  assert.equal(result.intake.gatePass, true);
  assert.equal(result.content.ok, true);
  assert.equal(result.content.previewOk, true);
  assert.equal(result.preview.ok, true);
  assert.equal(result.preview.importPreviewOk, true);
  assert.equal(result.preview.docxImportPreviewPlan.writeEffects, false);
  assert.equal(result.ports.importPreview.calls.rememberAdmission.length, 1);

  assert.equal(result.safeCreate.ok, true, JSON.stringify(result.safeCreate, null, 2));
  assert.equal(result.safeCreate.commandOk, true);
  assert.equal(result.safeCreate.safeCreateOk, true);
  assert.equal(result.safeCreate.created, true);
  assert.deepEqual(result.safeCreate.createdSceneIds, [
    result.preview.docxImportPreviewPlan.candidateCreatePlan.entries[0].sceneId,
  ]);
  assert.equal(readOnlyCreatedScene(result.romanRoot), 'Alpha\n\nBravo');
  assert.deepEqual(fs.readdirSync(path.join(result.projectRoot, '.flow-batch')), []);
  assert.equal(result.safeCreate.receipt.atomicEvidence.sceneCount, 1);
  assert.equal(result.safeCreate.receipt.atomicEvidence.markerCleared, true);
  assert.equal(result.safeCreate.receipt.sceneIntegrityScope, DOCX_IMPORT_SCENE_INTEGRITY_SCOPE);
  assert.equal(result.safeCreate.receipt.createdAtAuthority, DOCX_IMPORT_CREATED_AT_AUTHORITY);
  assert.match(result.safeCreate.receipt.createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
  assert.deepEqual(result.safeCreate.receipt.transactionEvidence.lease, { algorithmic: true });
  assert.equal(
    result.safeCreate.receipt.transactionEvidence.manifestHash,
    result.safeCreate.receipt.manifestAuthority.algorithmicHash,
  );
  assert.equal(result.safeCreate.receipt.transactionEvidence.batchManifestHash.length, 64);
  assert.equal(result.safeCreate.receipt.projectId, 'docx-e2e-project');
  assert.equal(result.ports.safeCreate.calls.ensureProjectStructure, 1);
  assert.deepEqual(result.ports.safeCreate.calls.resolveProjectBindingForFile, [result.romanRoot]);
  assert.deepEqual(result.ports.safeCreate.calls.queueDiskOperation, ['safe create DOCX import scene batch']);
  assertNoPublicAuthorityLeak(result.intake);
  assertNoPublicAuthorityLeak(result.content);
  assertNoPublicAuthorityLeak(result.preview);
  assertNoPublicAuthorityLeak(result.safeCreate);
});

test('DOCX import e2e command chain: safe create rejects preview that command did not admit', async () => {
  const result = await runDocxImportCommandChain(cleanDocxZip([`Unadmitted ${Date.now()}`]), {
    importPreviewOptions: {
      rememberAdmission: () => '',
    },
  });

  assert.equal(result.intake.gatePass, true);
  assert.equal(result.content.previewOk, true);
  assert.equal(result.preview.importPreviewOk, true);
  assert.equal(result.safeCreate.ok, false);
  assert.equal(result.safeCreate.error.code, 'E_DOCX_IMPORT_SAFE_CREATE_PREVIEW_NOT_ADMITTED');
  assert.equal(result.safeCreate.error.reason, 'DOCX_IMPORT_SAFE_CREATE_PREVIEW_NOT_ADMITTED');
  assert.equal(result.ports.safeCreate.calls.ensureProjectStructure, 0);
  assert.equal(fs.existsSync(path.join(result.romanRoot, 'Imported')), false);
});

test('DOCX import e2e command chain: blocked intake never becomes storage mutation', async () => {
  const result = await runDocxImportCommandChain(hostileDuplicateDocxZip());

  assert.equal(result.intake.ok, true);
  assert.equal(result.intake.gatePass, false);
  assert.equal(result.content.ok, true);
  assert.equal(result.content.previewOk, false);
  assert.equal(result.preview.ok, true);
  assert.equal(result.preview.importPreviewOk, false);
  assert.equal(result.preview.docxImportPreviewPlan.candidateCreatePlan, null);
  assert.equal(result.safeCreate.ok, false);
  assert.equal(result.safeCreate.error.code, 'E_DOCX_IMPORT_SAFE_CREATE_PREVIEW_NOT_ADMITTED');
  assert.equal(result.ports.safeCreate.calls.ensureProjectStructure, 0);
  assert.equal(fs.existsSync(path.join(result.projectRoot, '.flow-batch')), false);
  assert.equal(fs.existsSync(path.join(result.romanRoot, 'Imported')), false);
  assertNoPublicAuthorityLeak(result.intake);
  assertNoPublicAuthorityLeak(result.content);
  assertNoPublicAuthorityLeak(result.preview);
  assertNoPublicAuthorityLeak(result.safeCreate);
});

test('DOCX import e2e command chain: tamper fails closed and duplicate apply returns idempotent receipt without public leaks', async () => {
  const first = await runDocxImportCommandChain(cleanDocxZip([`Once ${Date.now()}`]));
  assert.equal(first.safeCreate.ok, true, JSON.stringify(first.safeCreate, null, 2));
  const originalText = readOnlyCreatedScene(first.romanRoot);
  const firstOperationId = first.safeCreate.receipt.importOperationId;

  // GENERIC-01 (G2 amendment): duplicate = same idempotent receipt (zero new
  // writes), not a blocking error. Re-applying the same admitted plan returns
  // the original receipt with the same importOperationId and performs no new
  // storage writes.
  const queueCallsBeforeDuplicate = first.ports.safeCreate.calls.queueDiskOperation.length;
  const duplicate = await first.ports.safeCreate.handleDocxImportSafeCreateCommandSurface({
    requestId: first.safeCreate.requestId,
    docxImportPreviewPlan: first.preview.docxImportPreviewPlan,
  });
  assert.equal(duplicate.ok, true, JSON.stringify(duplicate, null, 2));
  assert.equal(duplicate.safeCreateOk, true);
  assert.equal(duplicate.created, false, 'duplicate must not create a new scene');
  assert.equal(duplicate.receipt.importOperationId, firstOperationId);
  assert.equal(first.ports.safeCreate.calls.queueDiskOperation.length, queueCallsBeforeDuplicate);
  assert.equal(readOnlyCreatedScene(first.romanRoot), originalText);
  assertNoPublicAuthorityLeak(duplicate);

  const tamperedPlan = cloneJsonSafe(first.preview.docxImportPreviewPlan);
  tamperedPlan.previewHash = '00000000';
  rememberDocxImportPreviewPlanAdmission(tamperedPlan);
  const tampered = await first.ports.safeCreate.handleDocxImportSafeCreateCommandSurface({
    requestId: 'request-3',
    docxImportPreviewPlan: tamperedPlan,
  });
  assert.equal(tampered.ok, false);
  assert.equal(tampered.error.code, 'DOCX_SAFE_CREATE_PREVIEW_TAMPERED');
  assert.equal(first.ports.safeCreate.calls.queueDiskOperation.length, queueCallsBeforeDuplicate);
  assert.equal(readOnlyCreatedScene(first.romanRoot), originalText);
  assertNoPublicAuthorityLeak(tampered);
});

test('DOCX import e2e command chain: idempotent receipt fails closed when created scene is missing', async () => {
  const first = await runDocxImportCommandChain(cleanDocxZip([`Missing scene ${Date.now()}`]));
  assert.equal(first.safeCreate.ok, true, JSON.stringify(first.safeCreate, null, 2));
  const firstOperationId = first.safeCreate.receipt.importOperationId;
  const scenePath = readOnlyCreatedScenePath(first.romanRoot);
  const queueCallsBeforeDuplicate = first.ports.safeCreate.calls.queueDiskOperation.length;

  fs.unlinkSync(scenePath);
  const duplicate = await first.ports.safeCreate.handleDocxImportSafeCreateCommandSurface({
    requestId: first.safeCreate.requestId,
    docxImportPreviewPlan: first.preview.docxImportPreviewPlan,
  });

  assertIdempotentIntegrityFailure(duplicate, first.ports.safeCreate, queueCallsBeforeDuplicate);
  assert.equal(duplicate.error.details.field, 'createdScenes.0.outputHash');
  assert.equal(duplicate.error.details.sceneId, first.safeCreate.createdSceneIds[0]);
  assert.equal(fs.existsSync(scenePath), false);
  assert.equal(fs.existsSync(durableReceiptPath(first.projectRoot, firstOperationId)), true);
});

test('DOCX import e2e command chain: idempotent receipt fails closed when created scene canonical text changes', async () => {
  const first = await runDocxImportCommandChain(cleanDocxZip([`Changed scene ${Date.now()}`]));
  assert.equal(first.safeCreate.ok, true, JSON.stringify(first.safeCreate, null, 2));
  const scenePath = readOnlyCreatedScenePath(first.romanRoot);
  const originalText = fs.readFileSync(scenePath, 'utf8');
  const mutatedText = `${originalText}\nmutant`;
  const queueCallsBeforeDuplicate = first.ports.safeCreate.calls.queueDiskOperation.length;

  fs.writeFileSync(scenePath, mutatedText, 'utf8');
  const duplicate = await first.ports.safeCreate.handleDocxImportSafeCreateCommandSurface({
    requestId: first.safeCreate.requestId,
    docxImportPreviewPlan: first.preview.docxImportPreviewPlan,
  });

  assertIdempotentIntegrityFailure(duplicate, first.ports.safeCreate, queueCallsBeforeDuplicate);
  assert.equal(duplicate.error.details.field, 'createdScenes.0.outputHash');
  assert.equal(duplicate.error.details.sceneId, first.safeCreate.createdSceneIds[0]);
  assert.equal(fs.readFileSync(scenePath, 'utf8'), mutatedText);
});

test('DOCX import e2e command chain: idempotent receipt fails closed when receipt hash binding changes', async () => {
  const first = await runDocxImportCommandChain(cleanDocxZip([`Receipt hash ${Date.now()}`]));
  assert.equal(first.safeCreate.ok, true, JSON.stringify(first.safeCreate, null, 2));
  const originalText = readOnlyCreatedScene(first.romanRoot);
  const firstOperationId = first.safeCreate.receipt.importOperationId;
  const queueCallsBeforeDuplicate = first.ports.safeCreate.calls.queueDiskOperation.length;
  const wrongCandidateHash = '0'.repeat(64);

  mutateDurableReceipt(first.projectRoot, firstOperationId, (receipt) => ({
    ...receipt,
    candidateContentSha256: wrongCandidateHash,
  }));
  const duplicate = await first.ports.safeCreate.handleDocxImportSafeCreateCommandSurface({
    requestId: first.safeCreate.requestId,
    docxImportPreviewPlan: first.preview.docxImportPreviewPlan,
  });

  assertIdempotentIntegrityFailure(duplicate, first.ports.safeCreate, queueCallsBeforeDuplicate);
  assert.equal(duplicate.error.details.field, 'candidateContentSha256');
  assert.equal(duplicate.error.details.sceneId, first.safeCreate.createdSceneIds[0]);
  assert.equal(readOnlyCreatedScene(first.romanRoot), originalText);
  const receipt = JSON.parse(fs.readFileSync(
    durableReceiptPath(first.projectRoot, firstOperationId),
    'utf8',
  ));
  assert.equal(receipt.candidateContentSha256, wrongCandidateHash);
});

test('DOCX import e2e command chain: idempotent receipt fails closed when batch id changes', async () => {
  await assertDurableReceiptMutationFailsClosed({
    paragraphPrefix: 'Receipt batch',
    field: 'transactionEvidence.batchManifestHash',
    failReason: 'batch_manifest_hash_mismatch',
    mutate: (receipt) => ({
      ...receipt,
      batchId: `${receipt.batchId}-tampered`,
    }),
  });
});

test('DOCX import e2e command chain: idempotent receipt fails closed when manifest authority revision changes', async () => {
  await assertDurableReceiptMutationFailsClosed({
    paragraphPrefix: 'Manifest revision',
    field: 'manifestAuthority',
    failReason: 'manifest_authority_algorithmic_mismatch',
    mutate: (receipt) => ({
      ...receipt,
      manifestAuthority: {
        ...receipt.manifestAuthority,
        revision: '00000000',
      },
    }),
  });
});

test('DOCX import e2e command chain: idempotent receipt fails closed when manifest authority hash changes', async () => {
  await assertDurableReceiptMutationFailsClosed({
    paragraphPrefix: 'Manifest hash',
    field: 'manifestAuthority',
    failReason: 'manifest_authority_algorithmic_mismatch',
    mutate: (receipt) => ({
      ...receipt,
      manifestAuthority: {
        ...receipt.manifestAuthority,
        algorithmicHash: '0'.repeat(64),
      },
    }),
  });
});

test('DOCX import e2e command chain: idempotent receipt fails closed when transaction lease changes', async () => {
  await assertDurableReceiptMutationFailsClosed({
    paragraphPrefix: 'Transaction lease',
    field: 'transactionEvidence.lease',
    failReason: 'transaction_lease_mismatch',
    mutate: (receipt) => ({
      ...receipt,
      transactionEvidence: {
        ...receipt.transactionEvidence,
        lease: { algorithmic: false },
      },
    }),
  });
});

test('DOCX import e2e command chain: idempotent receipt fails closed when transaction manifest hash changes', async () => {
  await assertDurableReceiptMutationFailsClosed({
    paragraphPrefix: 'Transaction manifest',
    field: 'transactionEvidence.manifestHash',
    failReason: 'transaction_manifest_hash_mismatch',
    mutate: (receipt) => ({
      ...receipt,
      transactionEvidence: {
        ...receipt.transactionEvidence,
        manifestHash: '0'.repeat(64),
      },
    }),
  });
});

test('DOCX import e2e command chain: idempotent receipt fails closed when transaction batch hash changes', async () => {
  await assertDurableReceiptMutationFailsClosed({
    paragraphPrefix: 'Transaction batch',
    field: 'transactionEvidence.batchManifestHash',
    failReason: 'batch_manifest_hash_mismatch',
    mutate: (receipt) => ({
      ...receipt,
      transactionEvidence: {
        ...receipt.transactionEvidence,
        batchManifestHash: '0'.repeat(64),
      },
    }),
  });
});

test('DOCX import e2e command chain: transaction manifest authority replay binds lease and manifest hashes', async () => {
  const transactionAuthority = makeDocxImportTransactionAuthority();
  const first = await runDocxImportCommandChain(
    cleanDocxZip([`Transaction authority ${Date.now()}`]),
    { transactionAuthority },
  );
  assert.equal(first.safeCreate.ok, true, JSON.stringify(first.safeCreate, null, 2));
  assert.equal(transactionAuthority.calls.length, 1);
  assert.equal(transactionAuthority.calls[0].projectId, 'docx-e2e-project');

  const receipt = first.safeCreate.receipt;
  assert.deepEqual(receipt.manifestAuthority, {
    revision: '7',
    fencingGeneration: 7,
    nextHash: 'a'.repeat(64),
    previousHash: 'b'.repeat(64),
    durablePublication: true,
  });
  assert.deepEqual(receipt.transactionEvidence.lease, { fencingGeneration: 7 });
  assert.equal(receipt.transactionEvidence.manifestHash, 'a'.repeat(64));
  assert.equal(receipt.transactionEvidence.batchManifestHash, sha256Text(receipt.batchId));

  const originalText = readOnlyCreatedScene(first.romanRoot);
  const queueCallsBeforeDuplicate = first.ports.safeCreate.calls.queueDiskOperation.length;
  const duplicate = await first.ports.safeCreate.handleDocxImportSafeCreateCommandSurface({
    requestId: first.safeCreate.requestId,
    docxImportPreviewPlan: first.preview.docxImportPreviewPlan,
  });
  assert.equal(duplicate.ok, true, JSON.stringify(duplicate, null, 2));
  assert.equal(duplicate.created, false);
  assert.equal(first.ports.safeCreate.calls.queueDiskOperation.length, queueCallsBeforeDuplicate);
  assert.equal(readOnlyCreatedScene(first.romanRoot), originalText);

  mutateDurableReceipt(first.projectRoot, receipt.importOperationId, (storedReceipt) => ({
    ...storedReceipt,
    transactionEvidence: {
      ...storedReceipt.transactionEvidence,
      lease: { fencingGeneration: 8 },
    },
  }));
  const tampered = await first.ports.safeCreate.handleDocxImportSafeCreateCommandSurface({
    requestId: first.safeCreate.requestId,
    docxImportPreviewPlan: first.preview.docxImportPreviewPlan,
  });
  assertIdempotentIntegrityFailure(tampered, first.ports.safeCreate, queueCallsBeforeDuplicate);
  assert.equal(tampered.error.details.field, 'transactionEvidence.lease');
  assert.equal(tampered.error.details.failReason, 'transaction_lease_mismatch');
  assert.equal(readOnlyCreatedScene(first.romanRoot), originalText);
});

test('DOCX import e2e command chain: coherent replay forgery of manifest next hash fails trusted readback', async () => {
  await assertTransactionAuthorityCoherentForgeryFailsClosed({
    paragraphPrefix: 'Coherent next hash',
    requestId: 'request-coherent-next-hash-forgery',
    mutate: (receipt) => {
      const forgedHash = 'c'.repeat(64);
      return {
        ...receipt,
        manifestAuthority: {
          ...receipt.manifestAuthority,
          nextHash: forgedHash,
        },
        transactionEvidence: {
          ...receipt.transactionEvidence,
          manifestHash: forgedHash,
        },
      };
    },
  });
});

test('DOCX import e2e command chain: coherent replay forgery of revision and lease fails trusted readback', async () => {
  await assertTransactionAuthorityCoherentForgeryFailsClosed({
    paragraphPrefix: 'Coherent revision lease',
    requestId: 'request-coherent-revision-lease-forgery',
    mutate: (receipt) => ({
      ...receipt,
      manifestAuthority: {
        ...receipt.manifestAuthority,
        revision: '8',
        fencingGeneration: 8,
      },
      transactionEvidence: {
        ...receipt.transactionEvidence,
        lease: { fencingGeneration: 8 },
      },
    }),
  });
});

test('DOCX import e2e command chain: coherent replay forgery of previous hash fails trusted readback', async () => {
  await assertTransactionAuthorityCoherentForgeryFailsClosed({
    paragraphPrefix: 'Coherent previous hash',
    requestId: 'request-coherent-previous-hash-forgery',
    mutate: (receipt) => ({
      ...receipt,
      manifestAuthority: {
        ...receipt.manifestAuthority,
        previousHash: 'd'.repeat(64),
      },
    }),
  });
});

test('DOCX import e2e command chain: coherent replay forgery of durable publication fails trusted readback', async () => {
  await assertTransactionAuthorityCoherentForgeryFailsClosed({
    paragraphPrefix: 'Coherent durable publication',
    requestId: 'request-coherent-durable-publication-forgery',
    mutate: (receipt) => ({
      ...receipt,
      manifestAuthority: {
        ...receipt.manifestAuthority,
        durablePublication: false,
      },
    }),
  });
});

test('DOCX import e2e command chain: coherent replay forgery of batch evidence is not returned as authority', async () => {
  const transactionAuthority = makeDocxImportTransactionAuthority();
  const first = await runDocxImportCommandChain(
    cleanDocxZip([`Coherent batch evidence ${Date.now()}`]),
    { transactionAuthority },
  );
  assert.equal(first.safeCreate.ok, true, JSON.stringify(first.safeCreate, null, 2));
  const originalText = readOnlyCreatedScene(first.romanRoot);
  const receipt = first.safeCreate.receipt;
  const queueCallsBeforeDuplicate = first.ports.safeCreate.calls.queueDiskOperation.length;
  const forgedBatchId = 'flow-batch-999999999999-deadbeef';

  mutateDurableReceipt(first.projectRoot, receipt.importOperationId, (storedReceipt) => ({
    ...storedReceipt,
    batchId: forgedBatchId,
    transactionEvidence: {
      ...storedReceipt.transactionEvidence,
      batchManifestHash: sha256Text(forgedBatchId),
    },
  }));
  const duplicate = await first.ports.safeCreate.handleDocxImportSafeCreateCommandSurface({
    requestId: first.safeCreate.requestId,
    docxImportPreviewPlan: first.preview.docxImportPreviewPlan,
  });

  assert.equal(duplicate.ok, true, JSON.stringify(duplicate, null, 2));
  assert.equal(duplicate.created, false);
  assert.equal(transactionAuthority.readCalls.length, 1);
  assert.equal(duplicate.receipt.batchId, undefined);
  assert.equal(duplicate.receipt.transactionEvidence.batchManifestHash, undefined);
  assert.equal(
    duplicate.receipt.batchEvidenceAuthority,
    'NOT_RETURNED_ON_IDEMPOTENT_REPLAY_WITHOUT_TRUSTED_BATCH_READBACK',
  );
  assert.deepEqual(duplicate.receipt.manifestAuthority, receipt.manifestAuthority);
  assert.deepEqual(duplicate.receipt.transactionEvidence.lease, receipt.transactionEvidence.lease);
  assert.equal(
    duplicate.receipt.transactionEvidence.manifestHash,
    receipt.transactionEvidence.manifestHash,
  );
  assert.equal(first.ports.safeCreate.calls.queueDiskOperation.length, queueCallsBeforeDuplicate);
  assert.equal(readOnlyCreatedScene(first.romanRoot), originalText);
  assertNoPublicAuthorityLeak(duplicate);
});

test('DOCX import e2e command chain: transaction replay without trusted readback strips stored authority fields', async () => {
  const transactionAuthority = makeDocxImportTransactionAuthority({}, { exposeReadback: false });
  const first = await runDocxImportCommandChain(
    cleanDocxZip([`No readback replay ${Date.now()}`]),
    { transactionAuthority },
  );
  assert.equal(first.safeCreate.ok, true, JSON.stringify(first.safeCreate, null, 2));
  const originalText = readOnlyCreatedScene(first.romanRoot);
  const queueCallsBeforeDuplicate = first.ports.safeCreate.calls.queueDiskOperation.length;

  const duplicate = await first.ports.safeCreate.handleDocxImportSafeCreateCommandSurface({
    requestId: first.safeCreate.requestId,
    docxImportPreviewPlan: first.preview.docxImportPreviewPlan,
  });

  assert.equal(duplicate.ok, true, JSON.stringify(duplicate, null, 2));
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.receipt.batchId, undefined);
  assert.equal(duplicate.receipt.manifestAuthority, undefined);
  assert.equal(duplicate.receipt.transactionEvidence, undefined);
  assert.deepEqual(duplicate.receipt.replayAuthority, {
    schemaVersion: 'revision-bridge.docx-import-safe-create-replay-authority.v1',
    status: 'NON_AUTHORITATIVE',
    reason: 'TRUSTED_TRANSACTION_READBACK_UNAVAILABLE',
  });
  assert.equal(transactionAuthority.readCalls.length, 0);
  assert.equal(first.ports.safeCreate.calls.queueDiskOperation.length, queueCallsBeforeDuplicate);
  assert.equal(readOnlyCreatedScene(first.romanRoot), originalText);
  assertNoPublicAuthorityLeak(duplicate);
});

test('DOCX import e2e command chain: idempotent receipt fails closed on malformed durable receipt json', async () => {
  const first = await runDocxImportCommandChain(cleanDocxZip([`Malformed receipt ${Date.now()}`]));
  assert.equal(first.safeCreate.ok, true, JSON.stringify(first.safeCreate, null, 2));
  const originalText = readOnlyCreatedScene(first.romanRoot);
  const firstOperationId = first.safeCreate.receipt.importOperationId;
  const queueCallsBeforeDuplicate = first.ports.safeCreate.calls.queueDiskOperation.length;

  writeDurableReceiptText(first.projectRoot, firstOperationId, '{"schemaVersion":');
  const duplicate = await first.ports.safeCreate.handleDocxImportSafeCreateCommandSurface({
    requestId: first.safeCreate.requestId,
    docxImportPreviewPlan: first.preview.docxImportPreviewPlan,
  });

  assertIdempotentIntegrityFailure(duplicate, first.ports.safeCreate, queueCallsBeforeDuplicate);
  assert.equal(duplicate.error.details.field, 'receipt');
  assert.equal(duplicate.error.details.failReason, 'receipt_json_malformed');
  assert.equal(readOnlyCreatedScene(first.romanRoot), originalText);
});

test('DOCX import e2e command chain: idempotent receipt fails closed when createdAt shape is invalid', async () => {
  await assertDurableReceiptMutationFailsClosed({
    paragraphPrefix: 'Created at invalid',
    field: 'createdAt',
    failReason: 'created_at_invalid',
    mutate: (receipt) => ({
      ...receipt,
      createdAt: 'not-a-timestamp',
    }),
  });
});

test('DOCX import e2e command chain: createdAt is shape-only non-authoritative metadata', async () => {
  const first = await runDocxImportCommandChain(cleanDocxZip([`Created at metadata ${Date.now()}`]));
  assert.equal(first.safeCreate.ok, true, JSON.stringify(first.safeCreate, null, 2));
  const originalText = readOnlyCreatedScene(first.romanRoot);
  const firstOperationId = first.safeCreate.receipt.importOperationId;
  const queueCallsBeforeDuplicate = first.ports.safeCreate.calls.queueDiskOperation.length;
  const replacementCreatedAt = '2000-01-01T00:00:00.000Z';

  mutateDurableReceipt(first.projectRoot, firstOperationId, (receipt) => ({
    ...receipt,
    createdAt: replacementCreatedAt,
  }));
  const duplicate = await first.ports.safeCreate.handleDocxImportSafeCreateCommandSurface({
    requestId: first.safeCreate.requestId,
    docxImportPreviewPlan: first.preview.docxImportPreviewPlan,
  });

  assert.equal(duplicate.ok, true, JSON.stringify(duplicate, null, 2));
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.receipt.createdAtAuthority, DOCX_IMPORT_CREATED_AT_AUTHORITY);
  assert.equal(duplicate.receipt.createdAt, replacementCreatedAt);
  assert.equal(first.ports.safeCreate.calls.queueDiskOperation.length, queueCallsBeforeDuplicate);
  assert.equal(readOnlyCreatedScene(first.romanRoot), originalText);
  assertNoPublicAuthorityLeak(duplicate);
});

test('DOCX import e2e command chain: CRLF-only scene byte changes are canonical-text equivalent by receipt scope', async () => {
  const first = await runDocxImportCommandChain(cleanDocxZip([`CRLF scope ${Date.now()}`, 'Second']));
  assert.equal(first.safeCreate.ok, true, JSON.stringify(first.safeCreate, null, 2));
  const scenePath = readOnlyCreatedScenePath(first.romanRoot);
  const originalText = fs.readFileSync(scenePath, 'utf8');
  const crlfText = originalText.replace(/\n/gu, '\r\n');
  const queueCallsBeforeDuplicate = first.ports.safeCreate.calls.queueDiskOperation.length;

  fs.writeFileSync(scenePath, crlfText, 'utf8');
  const duplicate = await first.ports.safeCreate.handleDocxImportSafeCreateCommandSurface({
    requestId: first.safeCreate.requestId,
    docxImportPreviewPlan: first.preview.docxImportPreviewPlan,
  });

  assert.equal(duplicate.ok, true, JSON.stringify(duplicate, null, 2));
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.receipt.sceneIntegrityScope, DOCX_IMPORT_SCENE_INTEGRITY_SCOPE);
  assert.equal(first.ports.safeCreate.calls.queueDiskOperation.length, queueCallsBeforeDuplicate);
  assert.equal(fs.readFileSync(scenePath, 'utf8'), crlfText);
  assertNoPublicAuthorityLeak(duplicate);
});
