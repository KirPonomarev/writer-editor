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
