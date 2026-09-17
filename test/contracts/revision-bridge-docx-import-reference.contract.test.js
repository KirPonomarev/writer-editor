const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const { createDocxImportPreviewReferences } = require('../../src/utils/docxImportPreviewReferences');
const { buildStoredZip, escapeXml } = require('../../src/export/docx/docxMinBuilder');
const { createEnvelope, validateIpcEnvelope } = require('../../src/core/ipc-envelope-v1.cjs');
const admission = require('../../src/utils/docxImportSafeCreate');
const { writeFlowSceneBatchAtomic } = require('../../src/utils/flowSceneBatchAtomic');
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

function harness(t, options = {}) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'docx-reference-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
  const state = { writes: 0, beforeLoad: null, beforeQueue: null, beforeEnsure: null, beforeActivate: null };
  const sandbox = {
    Buffer, createDocxImportPreviewReferences, cloneJsonSafe: copy, isPlainObjectValue: record,
    ...admission, currentProjectName: 'A', path, sanitizeFilename: value => value,
    loadRevisionBridgeModule: async () => { await state.beforeLoad?.(); return bridge(); },
    getProjectRootPath: () => path.join(tempRoot, sandbox.currentProjectName),
    getProjectSectionPath: () => path.join(sandbox.getProjectRootPath(), 'roman'),
    ensureProjectStructure: async () => {
      await state.beforeEnsure?.();
      fs.mkdirSync(sandbox.getProjectSectionPath(), { recursive: true });
    },
    resolveProjectBindingForFile: async () => ({ projectId: 'docx-reference-project', manifestPath: '', manifestRaw: '' }),
    getMainProjectManifestAuthority: async () => null,
    queueDiskOperation: async operation => { await state.beforeQueue?.(); return operation(); },
    writeFlowSceneBatchAtomic: async (input, options = {}) => {
      state.writes += 1;
      return writeFlowSceneBatchAtomic(input, { ...options, beforeActivate: async (...args) => {
        await state.beforeActivate?.();
        return options.beforeActivate?.(...args);
      } });
    },
    module: { exports: {} },
    ...options,
  };
  const setter = main.slice(main.indexOf('function setActiveProjectNameFromRoot('), main.indexOf('function makeProjectLifecycleError('));
  const source = ['DOCX_IMPORT_PREVIEW_REFERENCES', 'DOCX_CONTENT_PREVIEW_COMMAND_SURFACE', 'DOCX_IMPORT_PREVIEW_COMMAND_SURFACE', 'DOCX_IMPORT_SAFE_CREATE_COMMAND_SURFACE'].map(section).join('\n');
  vm.runInNewContext(source + '\n' + setter + '\nmodule.exports = { handleDocxContentPreviewCommandSurface, handleDocxImportPreviewCommandSurface, handleDocxImportSafeCreateCommandSurface, invalidateDocxImportPreviewReferences, setActiveProjectNameFromRoot };', sandbox);
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
  const { plan } = await preview(port, paragraphs);
  const direct = { requestId: 'large-direct', docxImportPreviewPlan: plan.docxImportPreviewPlan };
  assert.ok(JSON.stringify(direct).length > 4 * 1024 * 1024);
  const rejected = await port.handleDocxImportSafeCreateCommandSurface(direct);
  assert.equal(rejected.error.reason, 'DOCX_IMPORT_SAFE_CREATE_PAYLOAD_TOO_LARGE');
  assert.equal(port.state.writes, 0);
  const payload = { requestId: 'large-reference', docxImportPreviewRef: plan.docxImportPreviewRef };
  assert.equal(validateIpcEnvelope(createEnvelope('ui:command-bridge', 'cmd.project.docx.importSafeCreate', payload), 'ui:command-bridge').ok, true);
  const result = await port.handleDocxImportSafeCreateCommandSurface(payload);
  assert.equal(result.safeCreateOk, true, JSON.stringify(result));
  assert.equal(port.state.writes, 1);
  const imported = path.join(port.tempRoot, 'A', 'roman', 'Imported');
  const files = fs.readdirSync(imported).filter(name => name.endsWith('.txt'));
  assert.equal(files.length, 1);
  assert.equal(fs.readFileSync(path.join(imported, files[0]), 'utf8'), paragraphs.join('\n'));
  port.invalidateDocxImportPreviewReferences();
  assert.equal((await port.handleDocxImportSafeCreateCommandSurface(payload)).ok, false);
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
