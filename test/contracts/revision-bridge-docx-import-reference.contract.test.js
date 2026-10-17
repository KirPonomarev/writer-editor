const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const v8 = require('node:v8');
const { pathToFileURL } = require('node:url');
const { createDocxImportPreviewReferences } = require('../../src/utils/docxImportPreviewReferences');
const { buildStoredZip, escapeXml } = require('../../src/export/docx/docxMinBuilder');
const { createEnvelope, validateIpcEnvelope } = require('../../src/core/ipc-envelope-v1.cjs');
const admission = require('../../src/utils/docxImportSafeCreate');
const { withRealDocxImportAuthority } = require('../fixtures/docx-import-real-authority.cjs');
const { parseObservablePayload } = require('../../src/core/document-content-envelope-v1.cjs');
const root = path.resolve(__dirname, '../..');
const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
const bridge = () => import(pathToFileURL(path.join(root, 'src/io/revisionBridge/index.mjs')).href);
const copy = value => JSON.parse(JSON.stringify(value));
const record = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function docx(paragraphs) {
  return buildStoredZip([
    { name: '[Content_Types].xml', data: '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: '_rels/.rels', data: '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/document.xml', data: '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + paragraphs.map(text => '<w:p><w:r><w:t xml:space="preserve">' + escapeXml(text) + '</w:t></w:r></w:p>').join('') + '</w:body></w:document>' },
  ]);
}

function section(name) {
  const begin = main.indexOf('// ' + name + '_START');
  const end = main.indexOf('// ' + name + '_END', begin);
  assert.ok(begin >= 0 && end > begin, name);
  return main.slice(begin, end);
}

function namedMainFunction(name) {
  const start = main.indexOf(`async function ${name}(`) >= 0
    ? main.indexOf(`async function ${name}(`) : main.indexOf(`function ${name}(`);
  const next = main.slice(start + 1).search(/\n(?:async )?function /u);
  assert.ok(start >= 0 && next >= 0, name);
  return main.slice(start, start + 1 + next);
}

function harness(t, options = {}) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'docx-reference-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
  const state = { writes: 0, beforeLoad: null, beforeQueue: null, beforeEnsure: null, beforeActivate: null };
  const sandbox = {
    Buffer, createDocxImportPreviewReferences, cloneJsonSafe: copy, isPlainObjectValue: record,
    ...admission, currentProjectName: 'A', path, sanitizeFilename: value => value,
    fs: fs.promises, crypto,
    readVerifiedProjectDocxNovelCohort: require('../../src/core/project-transaction-v1.cjs').readVerifiedProjectDocxNovelCohort,
    mainWindow: { id: 'reference-window' }, activeStage10ApplicationBootstrap: { id: 'reference-bootstrap' },
    commentAuthoringSessionId: 'reference-session', currentLifecycleSubjectId: () => 'reference-subject',
    currentFilePath: '', lastSignaledEditGeneration: 0, isDirty: false, activePendingRecording: false, autoSaveInProgress: false,
    userBookmarkCapability: commandId => assert.equal(commandId, 'cmd.project.docx.importSafeCreate'),
    recoverPendingWriterProjectTransaction: async () => {
      const core = require('../../src/core/project-transaction-v1.cjs');
      const binding = await core.readPendingProjectTransactionBinding({ manifestPath: path.join(sandbox.getProjectRootPath(), 'project.craftsman.json') });
      assert.equal(binding.pending, false, 'reference-only fixture must not bypass a real pending transaction');
      return { recovered: false, outcome: 'NO_JOURNAL' };
    },
    loadRevisionBridgeModule: async () => { await state.beforeLoad?.(); return bridge(); },
    getProjectRootPath: () => path.join(tempRoot, sandbox.currentProjectName),
    getProjectSectionPath: () => path.join(sandbox.getProjectRootPath(), 'roman'),
    ensureProjectStructure: async () => {
      await state.beforeEnsure?.();
      fs.mkdirSync(sandbox.getProjectSectionPath(), { recursive: true });
    },
    resolveProjectBindingForFile: async () => {
      const projectRoot = sandbox.getProjectRootPath();
      state.binding = await withRealDocxImportAuthority({ projectRoot, projectId: 'docx-reference-project' });
      return state.binding;
    },
    getMainProjectManifestAuthority: async () => {
      const real = state.binding.transactionAuthority;
      return { ...real, commitManifestText: async args => {
        await state.beforeActivate?.();
        const result = await real.commitManifestText(args);
        state.writes += 1;
        return result;
      } };
    },
    queueDiskOperation: async operation => { await state.beforeQueue?.(); return operation(); },
    module: { exports: {} },
    ...options,
  };
  const setter = main.slice(main.indexOf('function setActiveProjectNameFromRoot('), main.indexOf('function makeProjectLifecycleError('));
  const source = ['DOCX_IMPORT_PREVIEW_REFERENCES', 'DOCX_CONTENT_PREVIEW_COMMAND_SURFACE', 'DOCX_IMPORT_PREVIEW_COMMAND_SURFACE', 'DOCX_IMPORT_SAFE_CREATE_COMMAND_SURFACE'].map(section).join('\n');
  const inventory = ['treeCohortError', 'readTreeCohortPath', 'captureTreeCohortInventory', 'computeHash'].map(namedMainFunction).join('\n');
  vm.runInNewContext(source + '\n' + setter + '\n' + inventory + '\nmodule.exports = { handleDocxContentPreviewCommandSurface, handleDocxImportPreviewCommandSurface, handleDocxImportSafeCreateCommandSurface, invalidateDocxImportPreviewReferences, setActiveProjectNameFromRoot };', sandbox);
  return { ...sandbox.module.exports, state, sandbox, tempRoot };
}

async function preview(port, paragraphs) {
  const content = await port.handleDocxContentPreviewCommandSurface({ requestId: 'content-test', bufferSource: docx(paragraphs).toString('base64') });
  assert.equal(content.previewOk, true, JSON.stringify(content));
  assert.match(content.docxContentPreviewRef, /^[a-f0-9]{64}$/u);
  const payload = { requestId: 'plan-test', docxContentPreviewRef: content.docxContentPreviewRef };
  assert.equal(validateIpcEnvelope(createEnvelope('ui:command-bridge', 'cmd.project.docx.previewImportPlan', payload), 'ui:command-bridge').ok, true);
  const plan = await port.handleDocxImportPreviewCommandSurface(payload);
  assert.equal(plan.importPreviewOk, true, JSON.stringify(plan));
  assert.match(plan.docxImportPreviewRef, /^[a-f0-9]{64}$/u);
  return { content, plan };
}

test('reference snapshots are immutable, typed, context bound, bounded and expire without extending on reads', () => {
  let time = 0;
  const store = createDocxImportPreviewReferences({ now: () => time, ttlMs: 10, maxEntries: 64, maxSnapshotBytes: 100, maxTotalBytes: 150 });
  const input = { text: 'Привет 🧑‍💻' };
  const ref = store.remember('content', input, 'project-A:g1');
  input.text = 'tampered';
  const output = store.resolve('content', ref, 'project-A:g1');
  assert.equal(output.text, 'Привет 🧑‍💻');
  output.text = 'changed again';
  assert.equal(store.resolve('content', ref, 'project-A:g1').text, 'Привет 🧑‍💻');
  for (const [kind, token, context] of [['plan', ref, 'project-A:g1'], ['content', ref, 'project-B:g1'], ['content', ref, 'project-A:g2'], ['content', 'f'.repeat(64), 'project-A:g1']]) assert.equal(store.resolve(kind, token, context), null);
  assert.equal(store.remember('content', { text: 'x'.repeat(100) }, 'project-A:g1'), '');
  const cycle = {}; cycle.self = cycle;
  assert.equal(store.remember('content', cycle, 'project-A:g1'), '');
  assert.equal(store.remember('content', { toJSON: () => undefined }, 'project-A:g1'), '');
  time = 9; assert.ok(store.resolve('content', ref, 'project-A:g1'));
  time = 10; assert.equal(store.resolve('content', ref, 'project-A:g1'), null);
  const a = store.remember('plan', { text: 'a'.repeat(60) }, 'A');
  const b = store.remember('plan', { text: 'b'.repeat(60) }, 'A');
  const c = store.remember('plan', { text: 'c'.repeat(60) }, 'A');
  assert.equal(store.resolve('plan', a, 'A'), null);
  assert.ok(store.resolve('plan', b, 'A')); assert.ok(store.resolve('plan', c, 'A'));
  store.clear(); assert.equal(store.resolve('plan', c, 'A'), null);
  const one = createDocxImportPreviewReferences({ maxEntries: 1 });
  const old = one.remember('plan', { value: 1 }, 'A');
  one.remember('plan', { value: 2 }, 'A');
  assert.equal(one.resolve('plan', old, 'A'), null);
});

test('64-paragraph actual parser and main command chain preserve content through compact references and atomic readback', async t => {
  const port = harness(t);
  const paragraphs = Array.from({ length: 64 }, (_, i) => i === 5 || i === 10 ? '' : ` ${i}: Привет Café 中文 שלום 🧑‍💻 `);
  const { content, plan } = await preview(port, paragraphs);
  const original = createEnvelope('ui:command-bridge', 'cmd.project.docx.previewImportPlan', { requestId: 'old', docxContentPreviewReport: content.docxContentPreviewReport });
  assert.equal(validateIpcEnvelope(original, 'ui:command-bridge').code, 'E_ENVELOPE_BREADTH');
  content.docxContentPreviewReport.contentPreview.paragraphs[0].text = 'renderer replacement';
  plan.docxImportPreviewPlan.candidateCreatePlan.entries[0].content = 'renderer replacement';
  const payload = { requestId: 'same-import', docxImportPreviewRef: plan.docxImportPreviewRef };
  assert.equal(validateIpcEnvelope(createEnvelope('ui:command-bridge', 'cmd.project.docx.importSafeCreate', payload), 'ui:command-bridge').ok, true);
  const result = await port.handleDocxImportSafeCreateCommandSurface(payload);
  assert.equal(result.safeCreateOk, true, JSON.stringify(result));
  assert.equal(port.state.writes, 1);
  const imported = path.join(port.tempRoot, 'A', 'roman', 'Imported');
  const files = fs.readdirSync(imported).filter(name => name.endsWith('.txt'));
  assert.equal(files.length, 1);
  assert.equal(fs.readFileSync(path.join(imported, files[0]), 'utf8'), paragraphs.join('\n'));
  const retry = await port.handleDocxImportSafeCreateCommandSurface(payload);
  assert.equal(retry.safeCreateOk, true, JSON.stringify(retry));
  assert.equal(retry.idempotent, true); assert.equal(port.state.writes, 1);
});

test('large admitted plans retain the wire limit and import through a bounded current reference', async t => {
  const port = harness(t);
  const paragraphs = Array.from({ length: 4500 }, (_, index) => `${index}: ${'large bound payload '.repeat(48)}`);
  const retain = (name, value) => {
    const directory = process.env.YALKEN_NOVEL_PARTITION_EVIDENCE_DIR;
    if (directory) { fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(path.join(directory, `large-reference-${name}.v8`), v8.serialize(value)); }
  };
  const { content, plan } = await preview(port, paragraphs);
  const combined = (await bridge()).buildDocxImportPreviewPlanFromContentPreview(content.docxContentPreviewReport);
  retain('input', { paragraphs, content, plan, combined });
  assert.equal(combined.ok, true);
  assert.equal(combined.candidateCreatePlan.sceneStrategy, 'single-scene');
  assert.equal(combined.candidateCreatePlan.entryCount, 1);
  assert.equal(combined.candidateCreatePlan.entries.length, 1);
  assert.ok(combined.candidateCreatePlan.entries[0].content === paragraphs.join('\n'), 'default combined builder preserves every literal paragraph');
  assert.equal(plan.docxImportPreviewPlan.candidateCreatePlan.sceneStrategy, 'word-novel-root-partitions');
  const direct = { requestId: 'large-direct', docxImportPreviewPlan: plan.docxImportPreviewPlan };
  assert.ok(JSON.stringify(direct).length > 4 * 1024 * 1024);
  const rejected = await port.handleDocxImportSafeCreateCommandSurface(direct);
  assert.equal(rejected.error.reason, 'DOCX_IMPORT_SAFE_CREATE_PAYLOAD_TOO_LARGE');
  assert.equal(port.state.writes, 0);
  const payload = { requestId: 'large-reference', docxImportPreviewRef: plan.docxImportPreviewRef };
  assert.equal(validateIpcEnvelope(createEnvelope('ui:command-bridge', 'cmd.project.docx.importSafeCreate', payload), 'ui:command-bridge').ok, true);
  const result = await port.handleDocxImportSafeCreateCommandSurface(payload);
  retain('result', { direct, rejected, payload, result, writes: port.state.writes });
  assert.equal(result.safeCreateOk, true, JSON.stringify(result));
  assert.equal(port.state.writes, 1);
  const imported = path.join(port.tempRoot, 'A', 'roman', 'Imported');
  const files = fs.readdirSync(imported).filter(name => name.endsWith('.txt'));
  const scenes = result.receipt.createdScenes;
  const readback = scenes.map(scene => { const content = fs.readFileSync(path.join(port.tempRoot, 'A', scene.relativeFile), 'utf8');
    return { scene, content, parsed: parseObservablePayload(content) }; });
  const commits = scenes.map(scene => { const source = fs.readFileSync(path.join(port.tempRoot, 'A', scene.relativeFile+'.wp201-commit.json'), 'utf8');
    return { scene, source, record: JSON.parse(source) }; });
  const packetPath = require('../../src/core/project-transaction-v1.cjs').recoveryPacketPathFor(port.state.binding.manifestPath, commits[0].record.transactionId);
  const packetBytes = fs.readFileSync(packetPath);
  retain('readback', { readback, files, commits, packetPath, packetBytes, manifestText: fs.readFileSync(port.state.binding.manifestPath, 'utf8'), result });
  assert.ok(scenes.length > 1);
  assert.equal(scenes.length, plan.docxImportPreviewPlan.candidateCreatePlan.entryCount);
  assert.equal(result.receipt.sceneStrategy, 'word-novel-root-partitions');
  const orderedFiles = scenes.map(scene => path.basename(scene.relativeFile));
  assert.equal(new Set(orderedFiles).size, scenes.length, 'no duplicate scene files');
  assert.deepEqual(files.sort(), orderedFiles.slice().sort(), 'no missing or extra scenes');
  assert.deepEqual(copy(result.createdSceneIds), scenes.map(scene => scene.sceneId));
  assert.deepEqual(copy(result.publicSceneLocators), scenes.map(scene => scene.publicSceneLocator));
  assert.deepEqual(copy(result.publicSceneLocator), copy(result.publicSceneLocators[0]));
  assert.ok(readback.every(scene => !scene.parsed.issue), 'all canonical scene envelopes parse without loss');
  assert.ok(readback.map(scene => scene.parsed.text).join('\n') === paragraphs.join('\n'), 'ordered scenes preserve every literal paragraph');
  port.invalidateDocxImportPreviewReferences();
  const invalidated = await port.handleDocxImportSafeCreateCommandSurface(payload);
  retain('invalidated', { invalidated, writes: port.state.writes });
  assert.equal(invalidated.ok, false);
  assert.equal(port.state.writes, 1);
});

test('forged, malformed, mixed, wrong-kind and expired project-generation references never reach the writer', async t => {
  const port = harness(t);
  const { content, plan } = await preview(port, ['Alpha', '', 'Привет']);
  for (const payload of [
    { docxImportPreviewRef: '0'.repeat(64) }, { docxImportPreviewRef: { token: plan.docxImportPreviewRef } },
    { docxImportPreviewRef: content.docxContentPreviewRef },
    { docxImportPreviewRef: plan.docxImportPreviewRef, docxImportPreviewPlan: plan.docxImportPreviewPlan },
    { docxImportPreviewRef: plan.docxImportPreviewRef, projectRoot: '/forged' },
  ]) assert.equal((await port.handleDocxImportSafeCreateCommandSurface(payload)).ok, false);
  assert.equal((await port.handleDocxImportPreviewCommandSurface({ docxContentPreviewRef: content.docxContentPreviewRef, docxContentPreviewReport: content.docxContentPreviewReport })).ok, false);
  port.setActiveProjectNameFromRoot(path.join(port.tempRoot, 'B'));
  assert.equal((await port.handleDocxImportSafeCreateCommandSurface({ docxImportPreviewRef: plan.docxImportPreviewRef })).ok, false);
  port.setActiveProjectNameFromRoot(path.join(port.tempRoot, 'A'));
  assert.equal((await port.handleDocxImportSafeCreateCommandSurface({ docxImportPreviewRef: plan.docxImportPreviewRef })).ok, false);
  assert.equal(port.state.writes, 0);
});

test('project change during async source parsing or planning cannot publish a usable reference', async t => {
  const port = harness(t);
  port.state.beforeLoad = () => port.invalidateDocxImportPreviewReferences();
  const content = await port.handleDocxContentPreviewCommandSurface({ bufferSource: docx(['Alpha']).toString('base64') });
  assert.equal(content.ok, false); assert.equal(content.docxContentPreviewRef, undefined);
  port.state.beforeLoad = null;
  const fresh = await port.handleDocxContentPreviewCommandSurface({ bufferSource: docx(['Alpha']).toString('base64') });
  port.state.beforeLoad = () => port.invalidateDocxImportPreviewReferences();
  const plan = await port.handleDocxImportPreviewCommandSurface({ docxContentPreviewRef: fresh.docxContentPreviewRef });
  assert.equal(plan.ok, false); assert.equal(plan.docxImportPreviewRef, undefined);
  assert.equal(port.state.writes, 0);
});

for (const stage of ['beforeEnsure', 'beforeQueue']) test('project change at ' + stage + ' prevents the imported scene write', async t => {
  const port = harness(t);
  const { plan } = await preview(port, ['Alpha', 'Bravo']);
  port.state[stage] = () => port.invalidateDocxImportPreviewReferences();
  const result = await port.handleDocxImportSafeCreateCommandSurface({ docxImportPreviewRef: plan.docxImportPreviewRef });
  assert.equal(result.ok, false, JSON.stringify(result));
  assert.equal(port.state.writes, 0);
});

test('actual renderer confirmation forwards only compact references through the existing command runner', async t => {
  const port = harness(t);
  const paragraphs = Array.from({ length: 64 }, (_, i) => `Paragraph ${i} Привет`);
  const { content, plan } = await preview(port, paragraphs);
  const { createCommandRegistry } = await import('../../src/renderer/commands/registry.mjs');
  const { createCommandRunner } = await import('../../src/renderer/commands/runCommand.mjs');
  const { registerProjectCommands } = await import('../../src/renderer/commands/projectCommands.mjs');
  const registry = createCommandRegistry();
  const requests = [];
  registerProjectCommands(registry, { electronAPI: {
    invokeUiCommandBridge: async request => {
      requests.push(copy(request));
      const envelope = createEnvelope('ui:command-bridge', request.commandId, request.payload);
      assert.equal(validateIpcEnvelope(envelope, 'ui:command-bridge').ok, true);
      const handler = request.commandId === 'cmd.project.docx.previewImportPlan'
        ? port.handleDocxImportPreviewCommandSurface : port.handleDocxImportSafeCreateCommandSurface;
      return { ok: true, value: await handler(request.payload) };
    },
  } });
  const run = createCommandRunner(registry, { capability: { platformId: 'node' } });
  const result = await run('cmd.project.importDocxV1', {
    accept: true, requestId: 'renderer-reference-test',
    localFilePreview: { docxContentPreviewRef: content.docxContentPreviewRef, docxContentPreviewReport: content.docxContentPreviewReport },
    docxContentPreviewReport: content.docxContentPreviewReport,
    docxImportPreviewPlan: plan.docxImportPreviewPlan,
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(port.state.writes, 1);
  assert.equal(requests.length, 2);
  assert.deepEqual(Object.keys(requests[0].payload).sort(), ['docxContentPreviewRef', 'requestId']);
  assert.deepEqual(Object.keys(requests[1].payload).sort(), ['docxImportPreviewRef', 'requestId']);
});

test('expiry while a confirmed import waits in the queue prevents writing', async t => {
  let now = 0;
  const port = harness(t, { createDocxImportPreviewReferences: () => createDocxImportPreviewReferences({ now: () => now, ttlMs: 10 }) });
  const { plan } = await preview(port, ['Alpha', 'Bravo']);
  port.state.beforeQueue = () => { now = 10; };
  const result = await port.handleDocxImportSafeCreateCommandSurface({ docxImportPreviewRef: plan.docxImportPreviewRef });
  assert.equal(result.ok, false); assert.equal(port.state.writes, 0);
});

test('project invalidation before atomic activation leaves no imported scene', async t => {
  const port = harness(t);
  const { plan } = await preview(port, ['Alpha', 'Bravo']);
  port.state.beforeActivate = () => port.invalidateDocxImportPreviewReferences();
  const result = await port.handleDocxImportSafeCreateCommandSurface({ docxImportPreviewRef: plan.docxImportPreviewRef });
  assert.equal(result.ok, false, JSON.stringify(result));
  const imported = path.join(port.tempRoot, 'A', 'roman', 'Imported');
  assert.deepEqual(fs.existsSync(imported) ? fs.readdirSync(imported).filter(name => name.endsWith('.txt')) : [], []);
});

async function newProjectHarness(t, inputBytes, referenceOptions = {}, oneWayManuscript = false) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-docx-new-project-15k-20261017-'));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const io = await bridge(), bytes = inputBytes || fs.readFileSync(path.join(root, 'test/fixtures/docx-pending-deleted-comment-import.docx'));
  const preview = io.buildDocxContentPreviewFromZipBytes(oneWayManuscript ? {bytes,manuscriptProfile:'YALKEN_MANUSCRIPT_V1'} : bytes), plan = io.buildDocxNovelImportPreviewPlanFromContentPreview(preview);
  assert.equal(plan.ok, true, JSON.stringify(plan));admission.rememberDocxImportPreviewPlanAdmission(plan);
  const refs = createDocxImportPreviewReferences(referenceOptions), state = { context: 'source-project:1', allowed: true, registrations: 0, checks: [] };
  const reference = refs.remember('plan', plan, state.context);
  const core = await import('../../src/core/docx-new-project-v1.mjs'), port = await import('../../src/product/docxNewProjectCreateV1.mjs');
  const { createMainProjectManifestAuthority } = await import('../../src/product/mainProjectManifestAuthority.mjs');
  const authority = createMainProjectManifestAuthority({ anchorRoot: path.join(parent, '.authority'), useLeaseHeartbeatWorker: false });
  const sandbox = { isPlainObjectValue: record, crypto, ...admission, mainWindow: { isDestroyed: () => false },
    captureDocxImportPreviewContext: () => state.context,
    rememberDocxImportPreviewReference: (kind, value, context) => refs.remember(kind, value, context),
    cloneJsonSafe: copy, Buffer, loadRevisionBridgeModule: bridge,
    resolveDocxImportPreviewReference: (kind, ref) => refs.resolve(kind, ref, state.context),
    isDocxImportPreviewReferenceCurrent: (kind, ref) => refs.isCurrent(kind, ref, state.context),
    userBookmarkCapability: id => { state.checks.push(id); if (!state.allowed) throw Error('CAPABILITY_DENIED'); },
    fileManager: { getDocumentsPath: () => parent }, PROJECT_SUBFOLDERS: { roman: 'roman', materials: 'materials' },
    getMainProjectManifestAuthority: async () => authority,
    touchProjectLibraryIndexForBinding: async () => { state.registrations++; },
    makeProjectLifecycleError: (code, reason) => ({ ok: false, error: { code, reason } }),
    loadCore: async () => core, loadPort: async () => port,
  };
  // Only module resolution is injected; the actual Main handler and both product modules execute.
  const handler = section('DOCX_NEW_PROJECT_CREATE')
    .replace("import('./core/docx-new-project-v1.mjs')", 'loadCore()')
    .replace("import('./product/docxNewProjectCreateV1.mjs')", 'loadPort()');
  vm.runInNewContext('let docxNewProjectAttempt=null; const docxNewProjectCompleted=new Map();\n' + handler, sandbox);
  const invoke = payload => sandbox.handleDocxNewProjectCreateCommand(payload);
  const request = { requestId: 'fresh-request', docxImportPreviewRef: reference, action: 'preview' };
  const localModule = require('../../src/utils/docxImportLocalFilePreview.js');
  Object.assign(sandbox, { ...localModule, readDocxImportAttempt: () => { throw Error('NEW_TARGET_MUST_NOT_READ_OLD_RECEIPT'); } });
  vm.runInNewContext(section('DOCX_IMPORT_PREVIEW_COMMAND_SURFACE') + '\n' + section('DOCX_IMPORT_LOCAL_FILE_PREVIEW_COMMAND_SURFACE'), sandbox);
  sandbox.pickDocxImportLocalFilePreviewFile = async () => ({ path: '/synthetic/manuscript.docx', size: bytes.length });
  sandbox.readDocxImportLocalFilePreviewBytes = async () => bytes;
  return { parent, bytes, plan, core, port, authority, sandbox, state, refs, reference, request, invoke };
}
const freshIdentity = () => ({ projectId: crypto.randomUUID(), projectName: 'Fresh manuscript', operationId: 'fresh-operation', createdAtUtc: '2026-10-17T01:00:00.000Z' });
const newProjectRows = doc => require('../../src/core/word-pending-text-revisions-v1.cjs').paragraphs(doc)
  .map(p => (p.content || []).map(n => n.type === 'hardBreak' ? '\n' : n.text || '').join(''));
const literalCurrent = ['Одинаковая фраза: повтор 🧭.', 'До ВСТАВКА😀 после.', 'До  после.', 'Одинаковая фраза: повтор 🧭.', 'Перед сноской.', 'Кавычки «точно», Café, Ελληνικά, 中文 и семья 👨‍👩‍👧‍👦.'];
const literalOriginal = [...literalCurrent.slice(0, 1), 'До  после.', 'До УДАЛЕНИЕ🧭 после.', ...literalCurrent.slice(3)];

test('new-project preview writes nothing; real manifest-last creation preserves literal text, notes and discussions', async t => {
  const h = await newProjectHarness(t), before = fs.readdirSync(h.parent);
  const preview = await h.invoke(h.request);assert.equal(preview.ok, true, JSON.stringify(preview));
  assert.equal(preview.writeEffects, false);assert.deepEqual(fs.readdirSync(h.parent), before);
  assert.equal(preview.summary.noteCount, 1);assert.equal(preview.summary.commentCount, 3);assert.equal(preview.summary.revisionCount, 2);
  const payload = { ...h.request, action: 'create' };
  const [created, duplicate] = await Promise.all([h.invoke(payload), h.invoke(payload)]);
  assert.equal(created.ok, true, JSON.stringify(created));assert.equal(duplicate.projectId, created.projectId);
  const replay = await h.invoke(payload);assert.equal(replay.idempotent, true);assert.equal(replay.projectId, created.projectId);
  assert.equal(h.state.registrations, 1);
  const project = path.join(h.parent, 'Word-' + created.projectId), manifest = JSON.parse(fs.readFileSync(path.join(project, 'project.craftsman.json')));
  assert.equal(manifest.projectId, created.projectId);assert.equal(manifest.projectName, 'Рукопись из Word');
  const sceneId = 'roman/Imported/0001 Imported DOCX.txt', content = fs.readFileSync(path.join(project, sceneId), 'utf8');
  const pending = require('../../src/core/word-pending-text-revisions-v1.cjs'), envelope = require('../../src/core/document-content-envelope-v1.cjs');
  const doc = envelope.parseObservablePayload(content).doc, projection = pending.projection(doc);
  assert.deepEqual(newProjectRows(pending.normalizeNode(doc)), literalCurrent);
  assert.equal(projection.original, literalOriginal.join('\n'));
  assert.equal(manifest.treeIdentity.nodes[Object.keys(manifest.treeIdentity.nodes)[0]].bindingKey, 'file:' + sceneId);
  const notes = JSON.parse(fs.readFileSync(path.join(project, 'notes.craftsman.json'))), threads = JSON.parse(fs.readFileSync(path.join(project, '.yalken/word-review/non-text-return-state.v1.json'))).threads;
  assert.equal(notes.notes[0].body, 'Содержание сноски сохраняется.');assert.equal(notes.notes[0].manuscript.reference.offsetUtf16, 95);
  assert.equal(pending.noteProjection(doc)[0].noteId, notes.notes[0].id);
  assert.equal(threads[0].messages[1].body, 'Ответ к вставке');assert.equal(threads[2].anchor.sceneParagraphIndex, 3);
  assert.deepEqual(pending.readCommentUnionContext({ document: doc, anchor: threads[1].anchor }), { quote: 'УДАЛЕНИЕ🧭', hidden: true });
  assert.equal(fs.readdirSync(h.parent).filter(name => name.startsWith('Word-')).length, 1);
  const separate = await h.invoke({ ...payload, requestId: 'explicit-repeat' });assert.equal(separate.ok, true);
  assert.notEqual(separate.projectId, created.projectId);assert.equal(h.state.registrations, 2);
  assert.ok(h.state.checks.includes('cmd.project.lifecycle.create'));assert.ok(h.state.checks.includes('cmd.project.importDocxV1'));
  assert.deepEqual(fs.readFileSync(path.join(root, 'test/fixtures/docx-pending-deleted-comment-import.docx')), h.bytes);
});

test('new-project Main refuses raw authority, expired references, request conflicts and denied capability before writes', async t => {
  const h = await newProjectHarness(t);
  for (const extra of [{ path: '/foreign' }, { projectId: crypto.randomUUID() }, { docxImportPreviewPlan: h.plan }, { accepted: true }, { action: 'unknown' }, { requestId: '' }]) {
    assert.equal((await h.invoke({ ...h.request, ...extra })).ok, false);
  }
  h.state.allowed = false;assert.equal((await h.invoke(h.request)).ok, false);h.state.allowed = true;
  assert.equal((await h.invoke(h.request)).ok, true);
  assert.equal((await h.invoke({ ...h.request, projectName: 'other' })).error.reason, 'DOCX_NEW_PROJECT_REQUEST_CONFLICT');
  h.state.context = 'other:2';assert.equal((await h.invoke({ ...h.request, action: 'create' })).ok, false);
  assert.deepEqual(fs.readdirSync(h.parent), []);
});

for (const fault of ['cancel', 'foreign', 'changed', 'published', 'root-swap', 'nested-symlink', 'hardlink']) test(`new-project port protects source and foreign data after ${fault}`, async t => {
  const h = await newProjectHarness(t), identity = freshIdentity(), ownership = {}, model = h.core.prepareDocxNewProject({ plan: h.plan, ...identity });
  const project = path.join(h.parent, model.directoryName), scene = path.join(project, model.files[0].relativePath), manifestPath = path.join(project, 'project.craftsman.json');
  const outside = path.join(h.parent, 'protected.txt');fs.writeFileSync(outside, 'FOREIGN');let injected = false;
  const authority = fault === 'published' ? { ...h.authority, commitManifestText: async args => {
    const value = await h.authority.commitManifestText(args);injected = true;throw Error('INJECTED_AFTER_PUBLICATION');
  } } : h.authority;
  const options = { plan: h.plan, identity, ownership, parentDirectoryPath: h.parent, transactionAuthority: authority,
    assertPublication: async () => {
      if (injected || !fs.existsSync(scene)) return;
      if (!fs.statSync(scene).size) return;
      injected = true;
      if (fault === 'foreign') fs.writeFileSync(path.join(project, 'FOREIGN.txt'), 'FOREIGN');
      if (fault === 'changed') fs.writeFileSync(scene, 'EXTERNAL CHANGE');
      if (fault === 'root-swap') { fs.renameSync(project, project + '-moved');fs.mkdirSync(project);fs.writeFileSync(path.join(project, 'FOREIGN.txt'), 'FOREIGN'); }
      if (fault === 'nested-symlink') { fs.renameSync(path.dirname(scene), path.dirname(scene) + '-moved');fs.symlinkSync(h.parent, path.dirname(scene), 'dir'); }
      if (fault === 'hardlink') { fs.unlinkSync(scene);fs.linkSync(outside, scene); }
      if (fault !== 'published') throw Error('INJECTED_BEFORE_PUBLICATION');
    } };
  await assert.rejects(h.port.createDocxNewProject(options));assert.equal(injected, true);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'FOREIGN');
  if (fault === 'cancel') { assert.equal(fs.existsSync(project), false); }
  else if (fault === 'published') {
    assert.equal(fs.existsSync(manifestPath), true);
    const verified = await h.port.createDocxNewProject({ ...options, transactionAuthority: h.authority, assertPublication: async () => {} });
    assert.equal(verified.idempotent, true);assert.equal(verified.projectId, identity.projectId);
  } else {
    assert.equal(fs.existsSync(manifestPath), false);
    if (fault === 'foreign' || fault === 'root-swap') assert.equal(fs.readFileSync(path.join(project, 'FOREIGN.txt'), 'utf8'), 'FOREIGN');
    if (fault === 'changed') assert.equal(fs.readFileSync(scene, 'utf8'), 'EXTERNAL CHANGE');
  }
});

test('new-project port never claims a pre-existing directory or symlink', async t => {
  const h = await newProjectHarness(t);
  for (const symlink of [false, true]) {
    const identity = freshIdentity(), model = h.core.prepareDocxNewProject({ plan: h.plan, ...identity }), target = path.join(h.parent, model.directoryName);
    if (symlink) fs.symlinkSync(h.parent, target, 'dir');else { fs.mkdirSync(target);fs.writeFileSync(path.join(target, 'foreign'), 'KEEP'); }
    await assert.rejects(h.port.createDocxNewProject({ plan: h.plan, identity, parentDirectoryPath: h.parent, transactionAuthority: h.authority, ownership: {}, assertPublication: async () => {} }));
    if (!symlink) assert.equal(fs.readFileSync(path.join(target, 'foreign'), 'utf8'), 'KEEP');
  }
});

test('new-project clean plain text imports without requiring a private envelope', async t => {
  const expected = ['Plain chapter', '', 'Unicode 😀 café'];
  const h = await newProjectHarness(t, docx(expected)), created = await h.invoke({ ...h.request, action: 'create' });
  assert.equal(created.ok, true, JSON.stringify(created));
  const text = fs.readFileSync(path.join(h.parent, 'Word-' + created.projectId, 'roman/Imported/0001 Imported DOCX.txt'), 'utf8');
  assert.equal(text, expected.join('\n'));assert.equal(created.summary.characters, Array.from(expected.join('\n')).length);
});

function trackedChapter15k() {
  // A ZIP-only fixture reader, not a DOCX semantic oracle. Literal expected rows are above.
  const { inflateRawSync } = require('node:zlib'), source = fs.readFileSync(path.join(root, 'test/fixtures/docx-pending-deleted-comment-import.docx'));
  const entries = [];
  for (let offset = 0; source.readUInt32LE(offset) === 0x04034b50;) {
    const flags = source.readUInt16LE(offset + 6), method = source.readUInt16LE(offset + 8), length = source.readUInt32LE(offset + 18);
    assert.equal(flags & 8, 0);assert.ok([0, 8].includes(method));
    const nameLength = source.readUInt16LE(offset + 26), extraLength = source.readUInt16LE(offset + 28);
    const name = source.subarray(offset + 30, offset + 30 + nameLength).toString();
    const begin = offset + 30 + nameLength + extraLength, packed = source.subarray(begin, begin + length);
    entries.push({ name, data: (method === 8 ? inflateRawSync(packed) : packed).toString() });offset = begin + length;
  }
  const expected = [...literalCurrent];
  const row = 'Контрольный абзац — текст главы, точные символы и пробелы. '.repeat(4);
  while (Array.from([...expected, row].join('\n')).length < 15000) expected.push(row);
  const missing = 15000 - Array.from(expected.join('\n')).length - 1;expected.push('я'.repeat(missing));
  const suffix = expected.slice(literalCurrent.length).map(text => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`).join('');
  const document = entries.find(e => e.name === 'word/document.xml');assert.ok(document);
  document.data = document.data.replace('</w:body>', suffix + '</w:body>');
  return { bytes: buildStoredZip(entries), expected, original: [...literalOriginal, ...expected.slice(literalCurrent.length)] };
}

test('15000-character public command creates a new project; cold reopen and durable decisions preserve all text, comments and notes', async t => {
  const fixture = trackedChapter15k();assert.equal(Array.from(fixture.expected.join('\n')).length, 15000);
  const h = await newProjectHarness(t, fixture.bytes);
  const protectedRoot = path.join(h.parent, 'Existing-project');fs.mkdirSync(protectedRoot);
  const protectedFile = path.join(protectedRoot, 'manuscript.txt');fs.writeFileSync(protectedFile, 'Existing saved text');
  const unsavedDraft = { text: 'Unsaved author text', revision: 7 }, beforeDraft = JSON.stringify(unsavedDraft);
  h.sandbox.confirmDiscardChanges = () => { throw Error('IMPORT_MUST_NOT_DISCARD_CURRENT_DRAFT'); };

  const registryModule = await import('../../src/renderer/commands/registry.mjs'), runnerModule = await import('../../src/renderer/commands/runCommand.mjs');
  const commands = await import('../../src/renderer/commands/projectCommands.mjs'), registry = registryModule.createCommandRegistry();
  const calls = [];
  commands.registerProjectCommands(registry, { electronAPI: { invokeUiCommandBridge: async request => {
    calls.push(request.commandId);
    if (request.commandId === 'cmd.project.docx.previewLocalFile') return { ok: true, value: await h.sandbox.handleDocxImportLocalFilePreviewCommandSurface(request.payload) };
    if (request.commandId === 'cmd.project.docx.previewImportPlan') return { ok: true, value: await h.sandbox.handleDocxImportPreviewCommandSurface(request.payload) };
    assert.equal(request.commandId, 'cmd.project.lifecycle.create');return { ok: true, value: await h.invoke(request.payload) };
  } } });
  const run = runnerModule.createCommandRunner(registry, { capability: { platformId: 'node' } });
  const preview = await run(commands.COMMAND_IDS.PROJECT_IMPORT_DOCX_V1, { target: 'new-project', requestId: 'chapter15k', editorMode: 'tiptap' });
  assert.equal(preview.ok, true, JSON.stringify(preview));assert.equal(preview.value.newProjectPreview.summary.characters, 15000);
  assert.deepEqual(fs.readdirSync(h.parent), ['Existing-project']);
  const created = await run(commands.COMMAND_IDS.PROJECT_IMPORT_DOCX_V1, { target: 'new-project', requestId: 'chapter15k', accept: true,
    docxImportPreviewRef: preview.value.docxImportPreviewRef, editorMode: 'tiptap' });
  assert.equal(created.ok, true, JSON.stringify(created));
  const projectId = created.value.projectId, projectRoot = path.join(h.parent, 'Word-' + projectId), sceneId = 'roman/Imported/0001 Imported DOCX.txt';
  const scenePath = path.join(projectRoot, sceneId), manifestPath = path.join(projectRoot, 'project.craftsman.json');
  const { createStage10MainPersistenceAdapter } = await import('../../src/product/stage10MainPersistenceAdapter.mjs');
  const { createStage10ApplicationBootstrap } = await import('../../src/product/stage10ApplicationBootstrap.mjs');
  const portOptions = { projectRoot, anchorRoot: path.join(h.parent, '.cold-anchors'), transactionAuthority: h.authority };
  const firstRuntime = createStage10ApplicationBootstrap({ persistencePort: createStage10MainPersistenceAdapter(portOptions) });
  assert.equal((await firstRuntime.createProjectRuntime({ projectId, title: 'Word manuscript' })).ok, true);
  const coldRuntime = createStage10ApplicationBootstrap({ persistencePort: createStage10MainPersistenceAdapter(portOptions) });
  assert.equal((await coldRuntime.reopenProjectRuntime({ projectId })).ok, true);
  const pending = require('../../src/core/word-pending-text-revisions-v1.cjs'), envelope = require('../../src/core/document-content-envelope-v1.cjs');
  const noteModel = require('../../src/core/word-manuscript-notes-v1.cjs'), commentModel = require('../../src/core/word-pending-comment-decisions-v1.cjs');
  const tx = require('../../src/core/project-transaction-v1.cjs'), notesPath = path.join(projectRoot, 'notes.craftsman.json');
  const commentsPath = path.join(projectRoot, '.yalken/word-review/non-text-return-state.v1.json');
  for (const action of ['rejectAll', 'undo', 'acceptAll']) {
    const content = fs.readFileSync(scenePath, 'utf8'), doc = envelope.parseObservablePayload(content).doc;
    const initial = pending.projection(doc);assert.equal(initial.original, fixture.original.join('\n'));
    const state = fs.readFileSync(commentsPath, 'utf8'), noteText = fs.readFileSync(notesPath, 'utf8');
    const after = pending.decide(doc, { action }).doc, nextContent = envelope.composeObservablePayload({ doc: after });
    const commentState = commentModel.planPendingCommentDecision({ beforeText: state, projectId, sceneId, beforeContent: content, afterContent: nextContent, decision: { action } });
    const noteState = noteModel.planManuscriptNoteAnchorSave({ beforeText: noteText, projectId, sceneId, beforeContent: content, afterContent: nextContent, includeUnchanged: true });
    await h.authority.withProjectLease(projectId, lease => lease.publish(async proof => {
      const before = fs.readFileSync(manifestPath, 'utf8'), manifest = JSON.parse(before);manifest.lastCommandId++;
      const args = { scenePath, sceneContent: nextContent, expectedSceneContent: content, manifestPath, expectedManifestContent: before,
        manifestContent: JSON.stringify(manifest), revision: lease.fencingGeneration, commentState, noteState, revalidate: () => proof.assertOwned(),
        verifyManifestContinuation: request => h.authority.verifyManifestContinuation({ ...request, projectId }),
        publishManifest: async ({ manifestPath, expectedText, nextText }) => {
          const r = await h.authority.commitManifestText({ projectId, lease, targetPath: manifestPath, expectedText, nextText });assert.equal(r.durablePublication, true);
        } };
      assert.equal((await tx.commitProjectTransaction(args)).success, true);await tx.readVerifiedProjectTransaction(args);
    }));
    const reopened = envelope.parseObservablePayload(fs.readFileSync(scenePath, 'utf8')).doc;
    assert.deepEqual(newProjectRows(pending.normalizeNode(reopened)), action === 'rejectAll' ? fixture.original : fixture.expected);
    const persistedNotes = JSON.parse(fs.readFileSync(notesPath)).notes, threads = JSON.parse(fs.readFileSync(commentsPath)).threads;
    assert.equal(persistedNotes[0].body, 'Содержание сноски сохраняется.');assert.equal(persistedNotes[0].manuscript.reference.offsetUtf16, action === 'rejectAll' ? 96 : 95);
    assert.equal(threads[0].messages[1].body, 'Ответ к вставке');assert.equal(threads[1].messages[0].body, 'Обсуждение удаления');
    assert.equal(threads[2].anchor.sceneParagraphIndex, 3);assert.equal(threads[2].anchor.selectedText, 'повтор 🧭');
    pending.buildCommentExportBinding({ document: reopened, anchors: threads.filter(x => x.status !== 'deleted').map(x => ({ threadId: x.threadId, anchor: x.anchor })) });
  }
  assert.equal(fs.readFileSync(protectedFile, 'utf8'), 'Existing saved text');assert.equal(JSON.stringify(unsavedDraft), beforeDraft);
  assert.deepEqual(calls, ['cmd.project.docx.previewLocalFile', 'cmd.project.docx.previewImportPlan', 'cmd.project.lifecycle.create', 'cmd.project.lifecycle.create']);
});

test('seeded creation revalidates context and capability after asynchronous adapter loading', async t => {
  for (const change of ['context', 'capability']) {
    const h = await newProjectHarness(t), original = h.sandbox.loadPort;
    h.sandbox.loadPort = async () => { if (change === 'context') h.state.context = 'different:2';else h.state.allowed = false;return original(); };
    const result = await h.invoke({ ...h.request, action: 'create' });assert.equal(result.ok, false);
    assert.deepEqual(fs.readdirSync(h.parent), []);
  }
});

test('unknown seeded fields cannot fall through to ordinary empty-project creation', async t => {
  const h = await newProjectHarness(t);
  vm.runInNewContext(namedMainFunction('handleProjectLifecycleCreateCommand'), h.sandbox);
  for (const payload of [{ path: '/foreign' }, { docxImportPreviewPlan: h.plan }, { target: 'new-project' }, { action: 'create' }, { projectId: crypto.randomUUID() }]) {
    const result = await h.sandbox.handleProjectLifecycleCreateCommand(payload);assert.equal(result.ok, false);assert.equal(result.error.code, 'E_PROJECT_CREATE_PAYLOAD_INVALID');
  }
  assert.equal(validateIpcEnvelope(createEnvelope('ui:command-bridge', 'cmd.project.lifecycle.create', h.request), 'ui:command-bridge').ok, true);
  assert.deepEqual(fs.readdirSync(h.parent), []);
});

test('supported-profile refusal is visible before new-project publication', async t => {
  const bytes = buildStoredZip([
    { name: '[Content_Types].xml', data: '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: '_rels/.rels', data: '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/document.xml', data: '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tblPr/><w:tblGrid><w:gridCol/></w:tblGrid><w:tr><w:tc><w:tcPr/><w:p><w:r><w:t>Cell content</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>' },
  ]);
  const h = await newProjectHarness(t, bytes), result = await h.invoke(h.request);
  assert.equal(result.ok, false);assert.equal(result.error.reason, 'DOCX_NEW_PROJECT_CONTENT_UNSUPPORTED');assert.deepEqual(fs.readdirSync(h.parent), []);
});

test('partitioned manuscript retains paragraph separators and reports the complete text size', async t => {
  const expected = Array.from({ length: 201 }, (_, i) => `Paragraph ${i} 😀`), h = await newProjectHarness(t, docx(expected));
  assert.equal(h.plan.candidateCreatePlan.entries.length, 2);
  const result = await h.invoke({ ...h.request, action: 'create' });assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.summary.sceneCount, 2);assert.equal(result.summary.characters, Array.from(expected.join('\n')).length);
  assert.equal(result.summary.currentUtf16CodeUnits, expected.join('\n').length);
  const model = h.core.prepareDocxNewProject({ plan: h.plan, ...freshIdentity() });
  const texts = model.files.filter(f => f.role === 'scene').map(f => fs.readFileSync(path.join(h.parent, 'Word-' + result.projectId, f.relativePath), 'utf8'));
  const envelope = require('../../src/core/document-content-envelope-v1.cjs');
  assert.equal(texts.map(text => envelope.parseObservablePayload(text).text).join('\n'), expected.join('\n'));
});


test('new-project per-effect freshness does not reparse and hash the complete immutable source', async t => {
  const h = await newProjectHarness(t, docx(Array.from({ length: 201 }, (_, i) => `Source paragraph ${i} 😀`)));
  const counts = {};
  for (const key of ['resolveDocxImportPreviewReference', 'isDocxImportPreviewPlanAdmitted', 'hashDocxImportPreviewPlanForAdmission']) {
    const original = h.sandbox[key];counts[key] = 0;
    h.sandbox[key] = (...args) => { counts[key]++;return original(...args); };
  }
  const created = await h.invoke({ ...h.request, action: 'create' });
  assert.equal(created.ok, true, JSON.stringify(created));assert.equal(created.summary.sceneCount, 2);
  assert.equal(counts.resolveDocxImportPreviewReference, 1, 'one private snapshot read, independent of file-effect count');
  assert.equal(counts.isDocxImportPreviewPlanAdmitted, 1, 'one initial full admission check');
  assert.equal(counts.hashDocxImportPreviewPlanForAdmission, 1, 'one initial source binding hash');
  assert.ok(h.state.checks.filter(id => id === 'cmd.project.lifecycle.create').length > 20, 'capability remains live at every effect');
});

test('reference freshness checks preserve kind, context, non-extending TTL, eviction and invalidation', () => {
  let now = 0;
  const refs = createDocxImportPreviewReferences({ now: () => now, ttlMs: 10, maxEntries: 1 });
  const ref = refs.remember('plan', { value: 'original' }, 'A');
  assert.equal(refs.isCurrent('plan', ref, 'A'), true);
  for (const [kind, token, context] of [['content', ref, 'A'], ['plan', ref, 'B'], ['plan', 'raw', 'A'], ['plan', {}, 'A'], ['plan', ref, '']]) {
    assert.equal(refs.isCurrent(kind, token, context), false);
  }
  now = 9;assert.equal(refs.isCurrent('plan', ref, 'A'), true);
  now = 10;assert.equal(refs.isCurrent('plan', ref, 'A'), false);
  assert.equal(refs.resolve('plan', ref, 'A'), null);
  const replaced = refs.remember('plan', { value: 1 }, 'A');
  const live = refs.remember('plan', { value: 2 }, 'A');
  assert.equal(refs.isCurrent('plan', replaced, 'A'), false);assert.equal(refs.isCurrent('plan', live, 'A'), true);
  refs.clear();assert.equal(refs.isCurrent('plan', live, 'A'), false);
  for (const value of [null, {}, '', 'a'.repeat(64), '0'.repeat(63), 'A'.repeat(64)]) assert.equal(admission.isDocxImportPreviewPlanAdmissionCurrent(value), false);
});

test('new-project source is frozen before asynchronous adapters can change any part of its binding', async t => {
  const h = await newProjectHarness(t), resolve = h.sandbox.resolveDocxImportPreviewReference;
  let captured;
  h.sandbox.resolveDocxImportPreviewReference = (...args) => { captured = resolve(...args);return captured; };
  const load = h.sandbox.loadPort;
  h.sandbox.loadPort = async () => {
    assert.equal(Object.isFrozen(captured), true);assert.equal(Object.isFrozen(captured.candidateCreatePlan.entries[0]), true);
    const before = admission.hashDocxImportPreviewPlanForAdmission(captured);
    assert.equal(Reflect.set(captured.candidateCreatePlan.entries[0], 'content', 'FOREIGN TEXT'), false);
    assert.equal(admission.hashDocxImportPreviewPlanForAdmission(captured), before);
    return load();
  };
  const result = await h.invoke({ ...h.request, action: 'create' });assert.equal(result.ok, true, JSON.stringify(result));
  const text = fs.readFileSync(path.join(h.parent, 'Word-' + result.projectId, 'roman/Imported/0001 Imported DOCX.txt'), 'utf8');
  assert.equal(parseObservablePayload(text).text, literalCurrent.join('\n'));
});

test('new-project revocation before or during effects still refuses without publishing a project', async t => {
  for (const when of ['before', 'during']) for (const reason of ['clear', 'expiry', 'eviction', 'admission']) {
    let now = 0, revoked = false;
    const h = await newProjectHarness(t, undefined, { now: () => now, ttlMs: 10 });
    const revoke = () => {
      revoked = true;
      if (reason === 'clear') h.refs.clear();
      else if (reason === 'expiry') now = 10;
      else if (reason === 'eviction') for (let i = 0; i < 64; i++) h.refs.remember('plan', { index: i }, h.state.context);
      else for (let i = 0; i < 65; i++) admission.rememberDocxImportPreviewPlanAdmission({ otherSource: i });
    };
    const load = h.sandbox.loadPort;
    h.sandbox.loadPort = async () => {
      const actual = await load();
      if (when === 'before') revoke();
      return { createDocxNewProject: args => actual.createDocxNewProject({ ...args, assertPublication: async () => {
        if (when === 'during' && !revoked) {
          const project = path.join(h.parent, 'Word-' + args.identity.projectId);
          const scene = path.join(project, 'roman/Imported/0001 Imported DOCX.txt');
          if (fs.existsSync(scene) && fs.statSync(scene).size > 0) revoke();
        }
        return args.assertPublication();
      } }) };
    };
    const result = await h.invoke({ ...h.request, action: 'create' });assert.equal(result.ok, false, JSON.stringify({ when, reason, result }));
    assert.equal(revoked, true);
    assert.equal(result.error.reason, 'DOCX_IMPORT_PLAN_REFERENCE_INVALID');
    assert.equal(h.state.registrations, 0);
    assert.deepEqual(fs.readdirSync(h.parent).filter(name => name.startsWith('Word-')), []);
    if (when === 'before') assert.deepEqual(fs.readdirSync(h.parent), []);
  }
});


test('real Word public new-project target binds explicit manuscript profile and persists exact editorial graph', async t => {
  const bytes = fs.readFileSync(path.join(root, 'test/fixtures/docx-word-native-manuscript-profile.docx'));
  const h = await newProjectHarness(t, bytes, {}, true);
  const selected = await h.sandbox.handleDocxImportLocalFilePreviewCommandSurface({requestId:'real-word-public',target:'new-project'});
  assert.equal(selected.importPreviewOk, true, JSON.stringify(selected));
  assert.ok(selected.docxImportPreviewPlan.lossReport.items.some(i => i.code === 'DOCX_IMPORT_PREVIEW_MANUSCRIPT_PRESENTATION_NORMALIZED'));
  const planned = await h.sandbox.handleDocxImportPreviewCommandSurface({requestId:'real-word-public',docxContentPreviewRef:selected.docxContentPreviewRef});
  assert.equal(planned.importPreviewOk, true, JSON.stringify(planned));
  const created = await h.invoke({requestId:'real-word-public',docxImportPreviewRef:planned.docxImportPreviewRef,action:'create'});
  assert.equal(created.ok, true, JSON.stringify(created));
  assert.equal(created.summary.commentCount,3);assert.equal(created.summary.noteCount,1);assert.equal(created.summary.revisionCount,2);
  const project = path.join(h.parent,'Word-'+created.projectId), sceneId='roman/Imported/0001 Imported DOCX.txt';
  const pending=require('../../src/core/word-pending-text-revisions-v1.cjs'), env=require('../../src/core/document-content-envelope-v1.cjs');
  const doc=env.parseObservablePayload(fs.readFileSync(path.join(project,sceneId),'utf8')).doc;
  assert.deepEqual(newProjectRows(pending.normalizeNode(doc)),literalCurrent);assert.equal(pending.projection(doc).original,literalOriginal.join('\n'));
  const threads=JSON.parse(fs.readFileSync(path.join(project,'.yalken/word-review/non-text-return-state.v1.json'))).threads;
  assert.deepEqual(threads.map(c=>c.messages.map(m=>m.body)),[['Нативное обсуждение вставки','Нативный ответ к вставке'],['Нативное обсуждение удаления'],['Нативно: именно второй повтор']]);
  assert.deepEqual(pending.readCommentUnionContext({document:doc,anchor:threads[1].anchor}),{quote:'УДАЛЕНИЕ🧭',hidden:true});
  const notes=JSON.parse(fs.readFileSync(path.join(project,'notes.craftsman.json'))).notes;
  assert.equal(notes[0].body,' Содержание нативной сноски сохраняется.');assert.equal(notes[0].manuscript.reference.offsetUtf16,95);
  assert.deepEqual(fs.readFileSync(path.join(root,'test/fixtures/docx-word-native-manuscript-profile.docx')),bytes);
});

test('one-way manuscript compacts existing rich frames losslessly and refuses malformed frame variants', async () => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const { compactDocxImportCandidateContent: compact } = await import('../../src/core/project-tree-cohort-v1.mjs');
  const envelope = require('../../src/core/document-content-envelope-v1.cjs');
  const bytes = fs.readFileSync(path.join(root, 'test/fixtures/docx-word-native-manuscript-profile.docx'));
  const preview = bridge.buildDocxContentPreviewFromZipBytes({ bytes, manuscriptProfile: 'YALKEN_MANUSCRIPT_V1' });
  const before = bridge.buildDocxImportPreviewPlanFromContentPreview(preview);
  const after = bridge.buildDocxNovelImportPreviewPlanFromContentPreview(preview);
  assert(before.ok && after.ok);
  const original = before.candidateCreatePlan.entries[0].content, content = after.candidateCreatePlan.entries[0].content;
  assert(Buffer.byteLength(content) < Buffer.byteLength(original));
  assert.deepEqual(envelope.parseObservablePayload(content), envelope.parseObservablePayload(original));
  assert.equal(compact(content), content);
  assert.equal(compact('Plain 🧭 text'), 'Plain 🧭 text');
  assert.equal(admission.validateDocxImportPreviewPlan(after).ok, true);
  assert.equal(after.source.sourceArtifactSha256, before.source.sourceArtifactSha256);
  assert.notEqual(after.previewHash, before.previewHash);
  assert.equal(bridge.buildDocxImportPreviewPlanFromContentPreview(preview).candidateCreatePlan.entries[0].content, original);
  for (const bad of [undefined, original.replace(/length=\d+/u, 'length=1'), original + '\nforeign',
    envelope.composeObservablePayload({ doc: envelope.parseObservablePayload(original).doc, metaEnabled: true })]) {
    assert.throws(() => compact(bad), error => /E_DOCX_NOVEL_COMPACT_FRAME|E_TREE_COHORT_SCENE_INVALID/u.test(error.code));
  }
});

test('compact source deterministically rederives every partition and preserves the complete prepared project graph', async () => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const { partitionDocxImportCandidate } = await import('../../src/core/project-tree-cohort-v1.mjs');
  const { prepareDocxNewProject } = await import('../../src/core/docx-new-project-v1.mjs');
  const envelope = require('../../src/core/document-content-envelope-v1.cjs');
  const bytes = fs.readFileSync(path.join(root, 'test/fixtures/docx-word-native-manuscript-profile.docx'));
  const preview = bridge.buildDocxContentPreviewFromZipBytes({ bytes, manuscriptProfile: 'YALKEN_MANUSCRIPT_V1' });
  const original = bridge.buildDocxImportPreviewPlanFromContentPreview(preview), policy = { targetParagraphs: 2, targetUtf16: 1000 };
  const readable = partitionDocxImportCandidate(original.candidateCreatePlan, original.source.sourceArtifactSha256, policy);
  const plan = bridge.buildDocxNovelImportPreviewPlanFromContentPreview(preview, policy), candidate = plan.candidateCreatePlan;
  assert(plan.ok && candidate.entryCount > 1);
  assert.deepEqual(partitionDocxImportCandidate({ mode: 'create-only', sceneStrategy: 'single-scene', entryCount: 1,
    entries: [candidate.sourceCandidate] }, plan.source.sourceArtifactSha256, policy), candidate);
  candidate.entries.forEach((entry, index) => {
    const before = readable.entries[index];
    assert.deepEqual(envelope.parseObservablePayload(entry.content), envelope.parseObservablePayload(before.content));
    assert.deepEqual(entry.comments, before.comments);assert.deepEqual(entry.notes, before.notes);
  });
  const readablePlan = bridge.buildDocxNovelImportPreviewPlanFromContentPreview({ ...preview,
    diagnostics: preview.diagnostics.filter(item => item.code !== 'DOCX_MANUSCRIPT_PRESENTATION_NORMALIZED') }, policy);
  assert.deepEqual(readablePlan.candidateCreatePlan, readable);
  const identity = { projectId: '00000000-0000-4000-8000-000000000001', projectName: 'Lossless manuscript',
    operationId: 'compact-proof', createdAtUtc: '2026-10-17T09:00:00.000Z' };
  const left = prepareDocxNewProject({ plan: readablePlan, ...identity }), right = prepareDocxNewProject({ plan, ...identity });
  assert.equal(left.manifestText, right.manifestText);assert.deepEqual(left.summary, right.summary);
  left.files.forEach((file, i) => {
    const after = right.files[i];assert.equal(file.relativePath, after.relativePath);
    if (file.role === 'scene') assert.deepEqual(envelope.parseObservablePayload(file.content), envelope.parseObservablePayload(after.content));
    else assert.equal(file.content, after.content);
  });
});
