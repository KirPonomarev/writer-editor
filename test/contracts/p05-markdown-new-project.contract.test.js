'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const os = require('node:os');
const crypto = require('node:crypto');
const { createEnvelope, validateIpcEnvelope } = require('../../src/core/ipc-envelope-v1.cjs');

const root = path.resolve(__dirname, '../..');
const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
const record = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const copy = value => JSON.parse(JSON.stringify(value));
function namedFunction(source, name) {
  const match = new RegExp(`^(?:async )?function ${name}\\(`, 'mu').exec(source);
  assert.ok(match, `missing function ${name}`);
  const end = source.indexOf('\n}', match.index);
  assert.notEqual(end, -1);
  return source.slice(match.index, end + 2);
}

test('INT03 routes a private Markdown preview reference to new-project creation without ordinary empty-project effects', async () => {
  const calls = [];
  const sandbox = {
    isPlainObjectValue: record,
    handleMarkdownNewProjectCreateCommand: async payload => {
      calls.push(copy(payload));
      return { ok: true, created: true, target: 'new-project', projectId: 'fresh-project' };
    },
    makeProjectLifecycleError: (code, reason) => ({ ok: false, error: { code, reason } }),
    normalizeProjectLifecyclePayload: () => { throw Error('MUST_NOT_CREATE_EMPTY_PROJECT'); },
  };
  vm.runInNewContext(namedFunction(main, 'handleProjectLifecycleCreateCommand'), sandbox);
  const intent = { requestId: 'markdown-create-1', markdownImportPreviewRef: 'mdp_1234567890abcdef12345678', action: 'create' };
  assert.equal(validateIpcEnvelope(createEnvelope('ui:command-bridge', 'cmd.project.lifecycle.create', intent), 'ui:command-bridge').ok, true);
  const result = await sandbox.handleProjectLifecycleCreateCommand(intent);
  assert.equal(result.ok, true, 'an admitted Markdown import must create a new project, not fail or fall through to an empty project');
  assert.equal(result.target, 'new-project');
  assert.deepEqual(calls, [intent]);
});

test('INT03 rejects mixed format references before either creation handler can claim authority', async () => {
  const sandbox = {
    isPlainObjectValue: record,
    handleMarkdownNewProjectCreateCommand: () => { throw Error('MIXED_MARKDOWN_AUTHORITY'); },
    handleDocxNewProjectCreateCommand: () => { throw Error('MIXED_DOCX_AUTHORITY'); },
    makeProjectLifecycleError: (code, reason) => ({ ok: false, error: { code, reason } }),
  };
  vm.runInNewContext(namedFunction(main, 'handleProjectLifecycleCreateCommand'), sandbox);
  const result = await sandbox.handleProjectLifecycleCreateCommand({ requestId: 'mixed', action: 'create',
    markdownImportPreviewRef: 'mdp_1234567890abcdef12345678', docxImportPreviewRef: 'foreign-docx-reference' });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'E_PROJECT_CREATE_PAYLOAD_INVALID');
});

const markdown = '# Рассвет\n\nСвет e\u0301 🧭.\n\n- Один\n- Два\n\n```js\nconst n = 1;\n```\n';
const expectedDocument = { type: 'doc', content: [
  { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Рассвет' }] },
  { type: 'paragraph', content: [{ type: 'text', text: 'Свет e\u0301 🧭.' }] },
  { type: 'bulletList', content: ['Один', 'Два'].map(text => ({ type: 'listItem', content: [
    { type: 'paragraph', content: [{ type: 'text', text }] },
  ] })) },
  { type: 'codeBlock', attrs: { language: 'js' }, content: [{ type: 'text', text: 'const n = 1;' }] },
] };
const oldProjectId = '11111111-1111-4111-8111-111111111111';
function roster(directory) {
  const rows = {};
  const visit = relative => {
    const target = path.join(directory, relative), st = fs.lstatSync(target);
    assert.equal(st.isSymbolicLink(), false);
    rows[relative] = { kind: st.isDirectory() ? 'directory' : 'file', mode: st.mode, mtimeMs: st.mtimeMs,
      ...(st.isFile() ? { sha256: crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex') } : {}) };
    if (st.isDirectory()) for (const name of fs.readdirSync(target).sort()) visit(relative ? relative + '/' + name : name);
  };
  visit(''); return rows;
}
// This oracle reads the length frame and JSON directly, without the import
// parser, preparer or canonical document-envelope reader.
function independentlyReadScene(file) {
  const raw = fs.readFileSync(file, 'utf8'), header = /^\[doc-v2 length=(\d+)\]\n/u.exec(raw);
  assert.ok(header, 'expected a real saved rich document');
  const body = raw.slice(header[0].length, header[0].length + Number(header[1]));
  assert.equal(body.length, Number(header[1]));
  return JSON.parse(body);
}

async function actualMainHarness(t) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-p05-markdown-'));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const projects = path.join(parent, 'projects'), oldRoot = path.join(projects, 'Old');
  fs.mkdirSync(path.join(oldRoot, 'roman'), { recursive: true });
  fs.writeFileSync(path.join(oldRoot, 'project.craftsman.json'), JSON.stringify({ schemaVersion: 1, projectId: oldProjectId }));
  fs.writeFileSync(path.join(oldRoot, 'roman/Keep.txt'), 'Чужая рукопись. e\u0301 🧭\n');
  const input = path.join(parent, 'source.md'); fs.writeFileSync(input, markdown);
  const foreign = path.join(parent, 'foreign.bin'); fs.writeFileSync(foreign, Buffer.from([0, 255, 128, 42]));
  const { createMainProjectManifestAuthority } = await import('../../src/product/mainProjectManifestAuthority.mjs');
  const authority = createMainProjectManifestAuthority({ anchorRoot: path.join(parent, '.authority'), useLeaseHeartbeatWorker: false });
  const state = { root: oldRoot, subject: oldProjectId, allowed: true, registrations: 0, checks: [], publications: 0 };
  const sandbox = { Buffer, Date, TextDecoder, crypto, path, isPlainObjectValue: record, cloneJsonSafe: copy,
    ...require('../../src/core/io/path-boundary'),
    currentFilePath: path.join(oldRoot, 'roman/Keep.txt'), docxImportPreviewProjectGeneration: 1,
    currentLifecycleSubjectId: () => state.subject, commentAuthoringSessionId: 'session-one', lastSignaledEditGeneration: 0,
    activeStage10ApplicationBootstrap: {}, markdownLocalFilePreviewGeneration: 0, pendingMarkdownLocalFilePreview: null,
    mainWindow: { isDestroyed: () => false, webContents: { isDestroyed: () => false } },
    userBookmarkCapability: id => { state.checks.push(id); if (!state.allowed) throw Error('CAPABILITY_DENIED'); },
    getProjectRootPath: () => state.root, getProjectSectionPath: name => path.join(state.root, name),
    fileManager: { getDocumentsPath: () => projects }, PROJECT_SUBFOLDERS: { roman: 'roman', materials: 'materials' },
    getMainProjectManifestAuthority: async () => authority,
    touchProjectLibraryIndexForBinding: async () => { state.registrations++; },
    makeProjectLifecycleError: (code, reason) => ({ ok: false, error: { code, reason } }),
    loadPort: () => import('../../src/product/docxNewProjectCreateV1.mjs'),
    loadMarkdownTransformModule: () => import('../../src/export/markdown/v1/index.mjs'),
    loadDocumentContentEnvelopeModule: () => import('../../src/renderer/documentContentEnvelope.mjs'),
    readExternalFileBounded: require('../../src/utils/externalFileAuthority').readExternalFileBounded,
    applyMarkdownImportSafeCreate: require('../../src/utils/markdownImportSafeCreate').applyMarkdownImportSafeCreate,
    writeFlowSceneBatchAtomic: require('../../src/utils/flowSceneBatchAtomic').writeFlowSceneBatchAtomic,
    ROMAN_SECTION_FILENAME_SET: new Set(), queueDiskOperation: async operation => operation(),
    ensureProjectStructure: async () => assert.ok(fs.statSync(path.join(oldRoot, 'roman')).isDirectory()),
    resolveProjectBindingForFile: async () => JSON.parse(fs.readFileSync(path.join(oldRoot, 'project.craftsman.json'))),
    IMPORT_MARKDOWN_V1_CHANNEL: 'm:cmd:project:import:markdownV1:v1',
    MARKDOWN_IMPORT_PREVIEW_SCHEMA: 'markdown-import-preview.v1', MARKDOWN_IMPORT_PREVIEW_TYPE: 'markdown.import.preview',
    MARKDOWN_IMPORT_LOCAL_FILE_PREVIEW_COMMAND_ID: 'cmd.project.markdown.previewLocalFile',
    MARKDOWN_IMPORT_LOCAL_FILE_ACCEPT_COMMAND_ID: 'cmd.project.markdown.acceptLocalPreview',
    MARKDOWN_LOCAL_FILE_MAX_BYTES: 1024 * 1024, MARKDOWN_LOCAL_FILE_MAX_REQUEST_ID_CHARS: 120,
    MARKDOWN_LOCAL_FILE_PREVIEW_TTL_MS: 15 * 60 * 1000,
  };
  const names = ['sanitizeFilename', 'normalizeFlowTextInput', 'computeHash', 'mapMarkdownErrorCode', 'getMarkdownRecoveryGuidance',
    'makeTypedMarkdownError', 'normalizeMarkdownImportPayload', 'buildMarkdownImportSafeCreatePlan', 'buildMarkdownImportPreviewEnvelope',
    'handleImportMarkdownV1', 'normalizeMarkdownLocalFileRequestId', 'validateMarkdownLocalFileIntentPayload',
    'sanitizeMarkdownLocalFilePreviewForRenderer', 'remapMarkdownLocalFileError', 'captureMarkdownImportPreviewContext',
    'isMarkdownImportPreviewContextCurrent', 'freezeMarkdownImportSource', 'handleMarkdownImportLocalFilePreviewCommandSurface',
    'handleMarkdownImportLocalFileAcceptCommandSurface', 'sanitizeMarkdownLocalFileReceiptForRenderer',
    'handleMarkdownNewProjectCreateCommand', 'handleProjectLifecycleCreateCommand'];
  const functions = names.map(name => namedFunction(main, name));
  // Only ESM resolution is injected. The actual Main handlers, actual parser,
  // bounded reader, both real product modules and manifest/lease authority run.
  const creationIndex = names.indexOf('handleMarkdownNewProjectCreateCommand');
  assert.ok(functions[creationIndex].includes("import('./product/docxNewProjectCreateV1.mjs')"));
  functions[creationIndex] = functions[creationIndex].replace("import('./product/docxNewProjectCreateV1.mjs')", 'loadPort()');
  vm.runInNewContext('let markdownNewProjectAttempt = null; const markdownNewProjectCompleted = new Map();\n'
    + functions.join('\n'), sandbox);
  const preview = options => sandbox.handleMarkdownImportLocalFilePreviewCommandSurface({ requestId: 'preview-one' }, {
    pickLocalFile: async () => ({ filePath: input, sourceName: 'source.md' }), ...options,
  });
  const create = (ref, extra = {}) => sandbox.handleProjectLifecycleCreateCommand({
    requestId: 'create-one', markdownImportPreviewRef: ref, action: 'create', ...extra,
  });
  return { parent, projects, oldRoot, input, foreign, state, sandbox, authority, preview, create,
    newRoots: () => fs.readdirSync(projects).filter(name => name !== 'Old').map(name => path.join(projects, name)) };
}

test('INT03 actual Main preview is zero-write and pathless; real manifest-last creation preserves literal rich IR and old graph', async t => {
  const h = await actualMainHarness(t), before = roster(h.parent), old = roster(h.oldRoot);
  const preview = await h.preview();
  assert.equal(preview.ok, 1, JSON.stringify(preview));
  assert.deepEqual(roster(h.parent), before);
  assert.equal(JSON.stringify(preview).includes(h.parent), false);
  const commit = h.authority.commitManifestText;
  h.sandbox.getMainProjectManifestAuthority = async () => ({ ...h.authority, commitManifestText: async input => {
    h.state.publications++;
    assert.equal(fs.existsSync(input.targetPath), false);
    assert.deepEqual(independentlyReadScene(path.join(path.dirname(input.targetPath), 'roman/Imported/0001 Imported Markdown.txt')), expectedDocument);
    return commit(input);
  } });
  const created = await h.create(preview.previewId);
  assert.equal(created.ok, true, JSON.stringify(created)); assert.equal(created.target, 'new-project');
  assert.notEqual(created.projectId, oldProjectId); assert.equal(h.newRoots().length, 1);
  const manifest = JSON.parse(fs.readFileSync(path.join(h.newRoots()[0], 'project.craftsman.json')));
  assert.equal(manifest.projectId, created.projectId);
  assert.deepEqual(independentlyReadScene(path.join(h.newRoots()[0], 'roman/Imported/0001 Imported Markdown.txt')), expectedDocument);
  assert.equal(Object.keys(manifest.treeIdentity.nodes).length, 1);
  assert.deepEqual(roster(h.oldRoot), old); assert.equal(fs.readFileSync(h.input, 'utf8'), markdown);
  assert.deepEqual(fs.readFileSync(h.foreign), Buffer.from([0, 255, 128, 42]));
  assert.equal(h.state.publications, 1); assert.equal(h.state.registrations, 1);
  for (const id of ['cmd.project.lifecycle.create', 'cmd.project.importMarkdownV1', 'cmd.project.markdown.previewLocalFile'])
    assert.ok(h.state.checks.includes(id), id);
  const closed = roster(h.projects), replay = await h.create(preview.previewId);
  assert.equal(replay.ok, true); assert.equal(replay.idempotent, true); assert.equal(replay.projectId, created.projectId);
  assert.deepEqual(roster(h.projects), closed); assert.equal(h.state.publications, 1); assert.equal(h.state.registrations, 1);
  assert.equal((await h.create(preview.previewId, { requestId: 'another-request' })).ok, false);
  assert.equal((await h.sandbox.handleMarkdownImportLocalFileAcceptCommandSurface({ previewId: preview.previewId })).ok, 0);
  assert.deepEqual(roster(h.projects), closed);
});

test('INT03 stale identity, capability, TTL and window changes refuse before new-project effects', async t => {
  const changes = {
    root: h => { h.state.root = h.parent; }, subject: h => { h.state.subject = 'other-subject'; },
    session: h => { h.sandbox.commentAuthoringSessionId = 'another-session'; },
    projectGeneration: h => { h.sandbox.docxImportPreviewProjectGeneration++; },
    file: h => { h.sandbox.currentFilePath = h.input; }, edit: h => { h.sandbox.lastSignaledEditGeneration++; },
    owner: h => { h.sandbox.activeStage10ApplicationBootstrap = {}; },
    contents: h => { h.sandbox.mainWindow.webContents = { isDestroyed: () => false }; },
    closedWindow: h => { h.sandbox.mainWindow.isDestroyed = () => true; },
    capability: h => { h.state.allowed = false; },
    ttl: h => { h.sandbox.pendingMarkdownLocalFilePreview.createdAtMs -= 15 * 60 * 1000 + 1; },
    clockRollback: h => { h.sandbox.pendingMarkdownLocalFilePreview.createdAtMs += 60 * 1000; },
  };
  for (const [name, change] of Object.entries(changes)) await t.test(name, async child => {
    const h = await actualMainHarness(child), old = roster(h.oldRoot), preview = await h.preview();
    assert.equal(preview.ok, 1); change(h);
    assert.equal((await h.create(preview.previewId)).ok, false);
    assert.deepEqual(h.newRoots(), []); assert.deepEqual(roster(h.oldRoot), old); assert.equal(h.state.registrations, 0);
  });
});

test('INT03 rechecks after picker, bounded read, parser and module/authority acquisition awaits', async t => {
  for (const boundary of ['picker', 'read', 'parser', 'port', 'authority']) await t.test(boundary, async child => {
    const h = await actualMainHarness(child), old = roster(h.oldRoot);
    const mutate = () => { h.sandbox.lastSignaledEditGeneration++; };
    const options = {};
    if (boundary === 'picker') options.pickLocalFile = async () => { mutate(); return { filePath: h.input }; };
    if (boundary === 'read') options.readLocalFile = async (...args) => { const value = await h.sandbox.readExternalFileBounded(...args); mutate(); return value; };
    if (boundary === 'parser') { const load = h.sandbox.loadMarkdownTransformModule; h.sandbox.loadMarkdownTransformModule = async () => { const value = await load(); mutate(); return value; }; }
    const preview = await h.preview(options);
    if (['picker', 'read', 'parser'].includes(boundary)) assert.equal(preview.ok, 0);
    else {
      assert.equal(preview.ok, 1);
      if (boundary === 'port') { const load = h.sandbox.loadPort; h.sandbox.loadPort = async () => { const value = await load(); mutate(); return value; }; }
      else h.sandbox.getMainProjectManifestAuthority = async () => { mutate(); return h.authority; };
      assert.equal((await h.create(preview.previewId)).ok, false);
    }
    assert.deepEqual(h.newRoots(), []); assert.deepEqual(roster(h.oldRoot), old);
  });
});

test('INT03 an admitted preview uses its immutable source snapshot, not later external bytes or renderer fields', async t => {
  const h = await actualMainHarness(t), preview = await h.preview();
  assert.equal(preview.ok, 1);
  fs.writeFileSync(h.input, '# Changed after preview\n');
  preview.previewResult.safeCreatePlan.entries[0].content = 'renderer replacement';
  const before = roster(h.projects);
  for (const field of ['source', 'sourceSha256', 'content', 'path', 'previewPayload']) {
    const result = await h.create(preview.previewId, { [field]: '/foreign-or-replacement' });
    assert.equal(result.ok, false); assert.deepEqual(roster(h.projects), before);
  }
  const created = await h.create(preview.previewId); assert.equal(created.ok, true, JSON.stringify(created));
  assert.deepEqual(independentlyReadScene(path.join(h.newRoots()[0], 'roman/Imported/0001 Imported Markdown.txt')), expectedDocument);
  assert.equal(fs.readFileSync(h.input, 'utf8'), '# Changed after preview\n');
});

test('INT03 simultaneous same request shares one publication; different requests and changed bindings cannot duplicate it', async t => {
  const h = await actualMainHarness(t), preview = await h.preview(), actual = h.sandbox.loadPort;
  let release; const paused = new Promise(resolve => { release = resolve; });
  h.sandbox.loadPort = async () => { await paused; return actual(); };
  const first = h.create(preview.previewId), same = h.create(preview.previewId);
  assert.equal((await h.create(preview.previewId, { requestId: 'different-request' })).ok, false);
  assert.equal((await h.create(preview.previewId, { projectName: 'Changed binding' })).ok, false);
  release(); const [one, two] = await Promise.all([first, same]);
  assert.equal(one.ok, true, JSON.stringify(one)); assert.equal(two.ok, true); assert.equal(one.projectId, two.projectId);
  assert.equal(h.newRoots().length, 1); assert.equal(h.state.registrations, 1);
});

test('INT03 unpublished failure rolls back only its owned graph and retries with the same reserved identity', async t => {
  const h = await actualMainHarness(t), preview = await h.preview(), old = roster(h.oldRoot);
  h.sandbox.getMainProjectManifestAuthority = async () => ({ ...h.authority,
    commitManifestText: async () => { throw Error('INJECTED_BEFORE_MANIFEST'); } });
  const failed = await h.create(preview.previewId); assert.equal(failed.ok, false);
  assert.deepEqual(h.newRoots(), []); assert.deepEqual(roster(h.oldRoot), old);
  h.sandbox.getMainProjectManifestAuthority = async () => h.authority;
  const retried = await h.create(preview.previewId); assert.equal(retried.ok, true, JSON.stringify(retried));
  assert.equal(h.newRoots().length, 1); assert.deepEqual(roster(h.oldRoot), old);
});

test('INT03 lost publication acknowledgement preserves the published root and retry verifies it without republishing', async t => {
  const h = await actualMainHarness(t), preview = await h.preview(), commit = h.authority.commitManifestText;
  let calls = 0;
  h.sandbox.getMainProjectManifestAuthority = async () => ({ ...h.authority,
    commitManifestText: async input => { calls++; await commit(input); throw Error('INJECTED_LOST_ACK'); } });
  assert.equal((await h.create(preview.previewId)).ok, false); assert.equal(h.newRoots().length, 1);
  const before = roster(h.projects), retried = await h.create(preview.previewId);
  assert.equal(retried.ok, true, JSON.stringify(retried)); assert.equal(retried.idempotent, true);
  assert.equal(calls, 1); assert.equal(h.state.registrations, 1); assert.deepEqual(roster(h.projects), before);
});

test('INT03 derived library failure does not unpublish the project or cause repeated creation', async t => {
  const h = await actualMainHarness(t), preview = await h.preview();
  h.sandbox.touchProjectLibraryIndexForBinding = async () => { h.state.registrations++; throw Error('DERIVED_INDEX_UNAVAILABLE'); };
  const created = await h.create(preview.previewId); assert.equal(created.ok, true); assert.equal(created.libraryRefreshPending, true);
  const before = roster(h.projects), replay = await h.create(preview.previewId);
  assert.equal(replay.ok, true); assert.equal(replay.idempotent, true); assert.deepEqual(roster(h.projects), before);
  assert.equal(h.state.registrations, 1);
});

test('INT03 missing, forged and superseded preview references have no filesystem effects', async t => {
  const h = await actualMainHarness(t), original = roster(h.parent);
  assert.equal((await h.create('mdp_1234567890abcdef12345678')).ok, false);
  assert.deepEqual(roster(h.parent), original);
  const first = await h.preview(), second = await h.preview();
  assert.equal(first.ok, 1); assert.equal(second.ok, 1); assert.notEqual(first.previewId, second.previewId);
  assert.equal((await h.create(first.previewId)).ok, false);
  assert.deepEqual(roster(h.parent), original);
  assert.equal((await h.create(second.previewId)).ok, true); assert.equal(h.newRoots().length, 1);
});

test('INT03 a late picker cannot replace the newer admitted preview', async t => {
  const h = await actualMainHarness(t); let release;
  const late = h.preview({ pickLocalFile: () => new Promise(resolve => { release = resolve; }) });
  const current = await h.preview(); assert.equal(current.ok, 1);
  release({ filePath: h.input }); assert.equal((await late).ok, 0);
  assert.equal((await h.create(current.previewId)).ok, true); assert.equal(h.newRoots().length, 1);
});

test('INT03 picker cancellation and oversized source refuse without parser or project effects', async t => {
  const h = await actualMainHarness(t), original = roster(h.projects);
  const cancelled = await h.preview({ pickLocalFile: async () => ({ canceled: true }) });
  assert.equal(cancelled.ok, 1); assert.equal(cancelled.canceled, true); assert.deepEqual(roster(h.projects), original);
  fs.writeFileSync(h.input, Buffer.alloc(1024 * 1024 + 1, 65));
  h.sandbox.loadMarkdownTransformModule = () => { throw Error('OVERSIZED_SOURCE_MUST_NOT_REACH_PARSER'); };
  const oversized = await h.preview(); assert.equal(oversized.ok, 0);
  // Preserve the existing public Markdown error vocabulary; the independent
  // bounded reader supplies the precise typed refusal reason.
  assert.equal(oversized.error.code, 'MDV1_INTERNAL_ERROR');
  assert.equal(oversized.error.reason, 'EXTERNAL_SOURCE_TOO_LARGE'); assert.deepEqual(roster(h.projects), original);
});

test('INT03 invalid UTF-8 refuses before conversion instead of publishing replacement characters without a loss warning', async t => {
  const h = await actualMainHarness(t), before = roster(h.projects);
  const input = Buffer.from([0x23, 0x20, 0xff, 0x0a]); fs.writeFileSync(h.input, input);
  const result = await h.preview();
  assert.equal(result.ok, 0, 'invalid source bytes cannot silently become U+FFFD in an accepted Markdown preview');
  assert.equal(result.error.code, 'MDV1_INPUT_ENCODING_INVALID');
  assert.equal(result.error.reason, 'markdown_utf8_invalid');
  assert.deepEqual(fs.readFileSync(h.input), input); assert.deepEqual(roster(h.projects), before);
});

for (const newline of ['\r\n', '\r']) test(`INT03 valid UTF-8 BOM and ${JSON.stringify(newline)} retain canonical Unicode and rich IR`, async t => {
  const h = await actualMainHarness(t), bytes = Buffer.from('\ufeff' + markdown.replaceAll('\n', newline), 'utf8');
  fs.writeFileSync(h.input, bytes);
  const preview = await h.preview(); assert.equal(preview.ok, 1, JSON.stringify(preview));
  const created = await h.create(preview.previewId); assert.equal(created.ok, true, JSON.stringify(created));
  assert.deepEqual(independentlyReadScene(path.join(h.newRoots()[0], 'roman/Imported/0001 Imported Markdown.txt')), expectedDocument);
  assert.deepEqual(fs.readFileSync(h.input), bytes);
});

for (const kind of ['directory', 'file', 'symlink']) test(`INT03 refuses an existing foreign ${kind} without clobber or rollback deletion`, async t => {
  const h = await actualMainHarness(t), preview = await h.preview(), old = roster(h.oldRoot);
  const id = '22222222-2222-4222-8222-222222222222', target = path.join(h.projects, `Markdown-${id}`);
  const outside = path.join(h.parent, 'foreign-root'); fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, 'KEEP'), 'FOREIGN');
  if (kind === 'directory') { fs.mkdirSync(target); fs.writeFileSync(path.join(target, 'KEEP'), 'FOREIGN'); }
  else if (kind === 'file') fs.writeFileSync(target, 'FOREIGN');
  else fs.symlinkSync(outside, target, 'dir');
  h.sandbox.crypto = { ...crypto, randomUUID: () => id };
  const outsideBefore = roster(outside), targetStat = fs.lstatSync(target);
  const result = await h.create(preview.previewId); assert.equal(result.ok, false, JSON.stringify(result));
  assert.equal(fs.lstatSync(target).ino, targetStat.ino); assert.deepEqual(roster(outside), outsideBefore);
  if (kind === 'directory') assert.equal(fs.readFileSync(path.join(target, 'KEEP'), 'utf8'), 'FOREIGN');
  if (kind === 'file') assert.equal(fs.readFileSync(target, 'utf8'), 'FOREIGN');
  if (kind === 'symlink') assert.equal(fs.readlinkSync(target), outside);
  assert.deepEqual(roster(h.oldRoot), old); assert.equal(h.state.registrations, 0);
});

test('INT03 capability revoked after the real scene write prevents manifest publication and removes only owned unpublished files', async t => {
  const h = await actualMainHarness(t), preview = await h.preview(), old = roster(h.oldRoot), load = h.sandbox.loadPort;
  let injected = false;
  h.sandbox.loadPort = async () => {
    const actual = await load();
    return { createMarkdownNewProject: args => actual.createMarkdownNewProject({ ...args, assertPublication: async () => {
      const scene = path.join(args.parentDirectoryPath, `Markdown-${args.identity.projectId}`, 'roman/Imported/0001 Imported Markdown.txt');
      if (!injected && fs.existsSync(scene) && fs.statSync(scene).size > 0) { injected = true; h.state.allowed = false; }
      await args.assertPublication();
    } }) };
  };
  assert.equal((await h.create(preview.previewId)).ok, false); assert.equal(injected, true);
  assert.deepEqual(h.newRoots(), []); assert.deepEqual(roster(h.oldRoot), old); assert.equal(h.state.registrations, 0);
});

test('protected legacy Markdown safe-create API still writes its own admitted scene once, without replacing the original scene', async t => {
  const h = await actualMainHarness(t), before = fs.readFileSync(path.join(h.oldRoot, 'roman/Keep.txt'));
  const manifest = fs.readFileSync(path.join(h.oldRoot, 'project.craftsman.json')), preview = await h.preview();
  const result = await h.sandbox.handleMarkdownImportLocalFileAcceptCommandSurface({ previewId: preview.previewId });
  assert.equal(result.ok, 1, JSON.stringify(result)); assert.equal(result.safeCreate, true);
  assert.equal(result.receipt.projectId, oldProjectId); assert.deepEqual(h.newRoots(), []);
  const imported = fs.readdirSync(path.join(h.oldRoot, 'roman/Imported')); assert.equal(imported.length, 1);
  assert.deepEqual(independentlyReadScene(path.join(h.oldRoot, 'roman/Imported', imported[0])), expectedDocument);
  assert.deepEqual(fs.readFileSync(path.join(h.oldRoot, 'roman/Keep.txt')), before);
  assert.deepEqual(fs.readFileSync(path.join(h.oldRoot, 'project.craftsman.json')), manifest);
  const closed = roster(h.oldRoot);
  assert.equal((await h.sandbox.handleMarkdownImportLocalFileAcceptCommandSurface({ previewId: preview.previewId })).ok, 0);
  assert.deepEqual(roster(h.oldRoot), closed);
});
