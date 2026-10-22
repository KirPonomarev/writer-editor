const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const Module = require('node:module');

const ROOT = path.resolve(__dirname, '..', '..');
// Each harness owns its persistence profile; repository bytes stay read-only.
const USER_DATA_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-main-test-profile-'));
test.after(() => fs.rmSync(USER_DATA_ROOT, { recursive: true, force: true }));

async function loadMainWithElectronStub() {
  const mainPath = path.join(ROOT, 'src', 'main.js');
  const fileManagerPath = path.join(ROOT, 'src', 'utils', 'fileManager.js');
  const originalLoad = Module._load;
  const electronStub = {
    app: {
      getPath: (name) => name === 'userData' ? USER_DATA_ROOT : ROOT,
      setPath: () => {},
      whenReady: () => new Promise(() => {}),
      on: () => {},
      quit: () => {},
      exit: () => {},
      setName: () => {},
      requestSingleInstanceLock: () => true,
    },
    BrowserWindow: {
      getFocusedWindow: () => null,
      getAllWindows: () => [],
    },
    Menu: {
      buildFromTemplate: () => ({}),
      setApplicationMenu: () => {},
    },
    dialog: {
      showMessageBox: async () => ({}),
      showSaveDialog: async () => ({ canceled: true }),
      showOpenDialog: async () => ({ canceled: true }),
    },
    ipcMain: {
      on: () => {},
      handle: () => {},
    },
    session: {
      defaultSession: { webRequest: { onHeadersReceived: () => {} } },
    },
  };

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'electron') return electronStub;
    return originalLoad.call(this, request, parent, isMain);
  };
  delete require.cache[mainPath];
  delete require.cache[fileManagerPath];
  try {
    return {
      main: require(mainPath),
      fileManager: require(fileManagerPath),
    };
  } finally {
    Module._load = originalLoad;
  }
}

function sha256(text) {
  return crypto.createHash('sha256').update(text || '', 'utf8').digest('hex');
}

function findNode(root, predicate) {
  if (!root) return null;
  if (predicate(root)) return root;
  for (const child of root.children || []) {
    const found = findNode(child, predicate);
    if (found) return found;
  }
  return null;
}

test('metadata inspector read model exposes active scene metadata without file paths', async (t) => {
  const tempRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'metadata-read-main-'));
  t.after(async () => fsPromises.rm(tempRoot, { recursive: true, force: true }));

  const documentsRoot = path.join(tempRoot, 'Documents', 'craftsman');
  const projectRoot = path.join(documentsRoot, 'Роман');
  const importedRoot = path.join(projectRoot, 'roman', 'Imported');
  await fsPromises.mkdir(importedRoot, { recursive: true });
  await fsPromises.writeFile(
    path.join(importedRoot, '01_Alpha.txt'),
    [
      '[meta]',
      'synopsis: Quiet scene summary',
      'status: чистовой текст',
      'tags: POV=Kira; линия=A; место=Station',
      '[/meta]',
      '',
      'alpha beta gamma',
    ].join('\n'),
    'utf8',
  );

  const { main, fileManager } = await loadMainWithElectronStub();
  const originalGetDocumentsPath = fileManager.getDocumentsPath;
  fileManager.getDocumentsPath = () => documentsRoot;
  t.after(() => { fileManager.getDocumentsPath = originalGetDocumentsPath; });

  await main.buildProjectTreeRootsWithIdentities('Роман');
  const tree = await main.handleWorkspaceProjectTreeQuery({ tab: 'roman' });
  assert.equal(tree.ok, true);
  const alpha = findNode(tree.root, (node) => node.kind === 'scene' && node.label === 'Alpha');
  assert.ok(alpha);

  const result = await main.handleWorkspaceMetadataInspectorQuery({
    projectId: tree.projectId,
    nodeId: alpha.nodeId,
  });

  assert.equal(result.ok, true);
  assert.equal(result.state, 'ready');
  assert.equal(result.context.nodeId, alpha.nodeId);
  assert.equal(result.context.kind, 'scene');
  assert.equal(result.context.title, 'Alpha');
  assert.equal(result.context.metaEnabled, true);
  assert.equal(result.metadata.synopsis, 'Quiet scene summary');
  assert.equal(result.metadata.status, 'чистовой текст');
  assert.deepEqual(result.metadata.tags, { pov: 'Kira', line: 'A', place: 'Station' });
  assert.equal(result.wordCount, 3);
  assert.match(result.modifiedAtUtc, /^\d{4}-\d{2}-\d{2}T/u);
  assert.equal(result.contentHash, sha256(await fsPromises.readFile(path.join(importedRoot, '01_Alpha.txt'), 'utf8')));
  assert.equal(JSON.stringify(result).includes(projectRoot), false);
});

test('metadata inspector read model exposes legacy manuscript documents without granting metadata writes', async (t) => {
  const tempRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'metadata-read-empty-'));
  t.after(async () => fsPromises.rm(tempRoot, { recursive: true, force: true }));

  const documentsRoot = path.join(tempRoot, 'Documents', 'craftsman');
  const legacyRoot = path.join(documentsRoot, 'Роман', 'roman');
  const legacyText = 'Первый сон возвращается перед рассветом.';
  await fsPromises.mkdir(legacyRoot, { recursive: true });
  await fsPromises.writeFile(path.join(legacyRoot, 'сны.txt'), legacyText, 'utf8');
  const { main, fileManager } = await loadMainWithElectronStub();
  const originalGetDocumentsPath = fileManager.getDocumentsPath;
  fileManager.getDocumentsPath = () => documentsRoot;
  t.after(() => { fileManager.getDocumentsPath = originalGetDocumentsPath; });

  await main.buildProjectTreeRootsWithIdentities('Роман');
  const empty = await main.handleWorkspaceMetadataInspectorQuery({});
  assert.equal(empty.ok, true);
  assert.equal(empty.state, 'empty');
  assert.equal(empty.unavailableReason, 'NO_ACTIVE_NODE');

  const tree = await main.handleWorkspaceProjectTreeQuery({ tab: 'roman' });
  const romanSection = findNode(tree.root, (node) => node.kind === 'roman-section' && node.label === 'сны');
  assert.ok(romanSection);
  const legacyDocument = await main.handleWorkspaceMetadataInspectorQuery({
    projectId: tree.projectId,
    nodeId: romanSection.nodeId,
  });
  assert.equal(legacyDocument.ok, true);
  assert.equal(legacyDocument.state, 'ready');
  assert.equal(legacyDocument.context.kind, 'roman-section');
  assert.equal(legacyDocument.context.title, 'сны');
  assert.equal(legacyDocument.context.metaEnabled, false);
  assert.equal(legacyDocument.wordCount, 5);
  assert.match(legacyDocument.modifiedAtUtc, /^\d{4}-\d{2}-\d{2}T/u);
  assert.equal(Object.hasOwn(legacyDocument, 'contentHash'), false);
  assert.equal(JSON.stringify(legacyDocument).includes(documentsRoot), false);

  const blockedWrite = await main.handleMetadataUpdateCommand({
    projectId: tree.projectId,
    nodeId: romanSection.nodeId,
    baselineHash: sha256(legacyText),
    metadata: { synopsis: 'Не должно сохраниться' },
  });
  assert.equal(blockedWrite.ok, false);
  assert.equal(blockedWrite.code, 'E_METADATA_UPDATE_KIND_BLOCKED');
  assert.equal(await fsPromises.readFile(path.join(legacyRoot, 'сны.txt'), 'utf8'), legacyText);
});

test('metadata update command writes only metadata and preserves text plus unknown fields', async (t) => {
  const tempRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'metadata-write-main-'));
  t.after(async () => fsPromises.rm(tempRoot, { recursive: true, force: true }));

  const documentsRoot = path.join(tempRoot, 'Documents', 'craftsman');
  const projectRoot = path.join(documentsRoot, 'Роман');
  const importedRoot = path.join(projectRoot, 'roman', 'Imported');
  const scenePath = path.join(importedRoot, '01_Alpha.txt');
  await fsPromises.mkdir(importedRoot, { recursive: true });
  const before = [
    '[meta]',
    'synopsis: Old summary',
    'status: черновик',
    'tags: POV=Old; линия=Old line; место=Old place',
    '[/meta]',
    '',
    'alpha beta gamma',
    '',
    '[pro-unknown]',
    '{"timeline":["future"]}',
    '[/pro-unknown]',
  ].join('\n');
  await fsPromises.writeFile(scenePath, before, 'utf8');

  const { main, fileManager } = await loadMainWithElectronStub();
  const originalGetDocumentsPath = fileManager.getDocumentsPath;
  fileManager.getDocumentsPath = () => documentsRoot;
  t.after(() => { fileManager.getDocumentsPath = originalGetDocumentsPath; });

  await main.buildProjectTreeRootsWithIdentities('Роман');
  const tree = await main.handleWorkspaceProjectTreeQuery({ tab: 'roman' });
  const alpha = findNode(tree.root, (node) => node.kind === 'scene' && node.label === 'Alpha');
  assert.ok(alpha);

  const result = await main.handleMetadataUpdateCommand({
    projectId: tree.projectId,
    nodeId: alpha.nodeId,
    baselineHash: sha256(before),
    metadata: {
      synopsis: 'New summary',
      status: 'чистовой текст',
      tags: { pov: 'Kira', line: 'A', place: 'Station' },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.updated, true);
  assert.equal(result.receipt.schemaVersion, 'metadata-update-receipt.v1');
  assert.equal(result.receipt.recovery.snapshotCreated, true);
  assert.equal(result.receipt.recovery.snapshotReadable, true);
  assert.equal(result.receipt.recovery.snapshotHashMatchesInput, true);
  assert.equal(JSON.stringify(result).includes(projectRoot), false);

  const after = await fsPromises.readFile(scenePath, 'utf8');
  assert.ok(after.includes('synopsis: New summary'));
  assert.ok(after.includes('status: чистовой текст'));
  assert.ok(after.includes('tags: POV=Kira; линия=A; место=Station'));
  assert.ok(after.includes('alpha beta gamma'));
  assert.ok(after.includes('[pro-unknown]\n{"timeline":["future"]}\n[/pro-unknown]'));
  assert.equal(after.replace(/^\[meta\][\s\S]*?\[\/meta\]\n\n/u, ''), before.replace(/^\[meta\][\s\S]*?\[\/meta\]\n\n/u, ''));
});

test('metadata update command fails closed on stale context and renderer path authority', async (t) => {
  const tempRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'metadata-write-stale-'));
  t.after(async () => fsPromises.rm(tempRoot, { recursive: true, force: true }));

  const documentsRoot = path.join(tempRoot, 'Documents', 'craftsman');
  const projectRoot = path.join(documentsRoot, 'Роман');
  const importedRoot = path.join(projectRoot, 'roman', 'Imported');
  const scenePath = path.join(importedRoot, '01_Alpha.txt');
  await fsPromises.mkdir(importedRoot, { recursive: true });
  const before = [
    '[meta]',
    'synopsis: Old summary',
    'status: черновик',
    'tags: POV=; линия=; место=',
    '[/meta]',
    '',
    'alpha beta gamma',
  ].join('\n');
  await fsPromises.writeFile(scenePath, before, 'utf8');

  const { main, fileManager } = await loadMainWithElectronStub();
  const originalGetDocumentsPath = fileManager.getDocumentsPath;
  fileManager.getDocumentsPath = () => documentsRoot;
  t.after(() => { fileManager.getDocumentsPath = originalGetDocumentsPath; });

  await main.buildProjectTreeRootsWithIdentities('Роман');
  const tree = await main.handleWorkspaceProjectTreeQuery({ tab: 'roman' });
  const alpha = findNode(tree.root, (node) => node.kind === 'scene' && node.label === 'Alpha');
  assert.ok(alpha);

  const pathAuthority = await main.handleMetadataUpdateCommand({
    projectId: tree.projectId,
    nodeId: alpha.nodeId,
    baselineHash: sha256(before),
    path: scenePath,
    metadata: { synopsis: 'Blocked', status: 'черновик', tags: {} },
  });
  assert.equal(pathAuthority.ok, false);
  assert.equal(pathAuthority.reason, 'METADATA_UPDATE_RENDERER_AUTHORITY_DENIED');

  const stale = await main.handleMetadataUpdateCommand({
    projectId: tree.projectId,
    nodeId: alpha.nodeId,
    baselineHash: sha256('different content'),
    metadata: { synopsis: 'Blocked', status: 'чистовой текст', tags: {} },
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.reason, 'METADATA_UPDATE_STALE_CONTEXT');
  assert.equal(await fsPromises.readFile(scenePath, 'utf8'), before);
});

// Adapter-level renderer/Main proof: browser selection semantics, real metadata
// persistence/readback, no Electron window or private IPC authority.
const metadataVm = require('node:vm');
const metadataRendererSource = fs.readFileSync(path.join(ROOT, 'src/renderer/editor.js'), 'utf8');
function metadataSection(start, end) {
  const from = metadataRendererSource.indexOf(start);
  const to = metadataRendererSource.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, start);
  return metadataRendererSource.slice(from, to);
}
function metadataDeferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
function metadataControl(initial = '') {
  let value = initial;
  const listeners = new Map();
  return {
    disabled: false, readOnly: false, isConnected: true, dataset: {},
    selectionStart: 0, selectionEnd: 0, selectionDirection: 'none', assignments: 0,
    get value() { return value; },
    set value(next) {
      next = String(next);
      if (next !== value) {
        value = next; this.assignments += 1;
        this.selectionStart = this.selectionEnd = next.length;
        this.selectionDirection = 'none';
      }
    },
    addEventListener(name, fn) { listeners.set(name, fn); },
    setSelectionRange(start, end, direction = 'none') {
      this.selectionStart = start; this.selectionEnd = end; this.selectionDirection = direction;
    },
    input(next, start = next.length, end = start, direction = 'none', isComposing = false) {
      this.value = next; this.setSelectionRange(start, end, direction);
      listeners.get('input')?.({ target: this, isComposing });
    },
    replaceSelection(text) {
      const at = this.selectionStart;
      this.input(value.slice(0, at) + text + value.slice(this.selectionEnd), at + text.length);
    },
  };
}
async function metadataWorkingHarness(t) {
  const tempRoot = fs.realpathSync(await fsPromises.mkdtemp(path.join(os.tmpdir(), 'metadata-working-caret-')));
  fs.writeFileSync(path.join(tempRoot, 'OWNED_METADATA_FIXTURE'), 'synthetic metadata/caret test only\n');
  t.after(() => fsPromises.rm(tempRoot, { recursive: true, force: true }));
  const documentsRoot = path.join(tempRoot, 'Documents', 'craftsman');
  const importedRoot = path.join(documentsRoot, 'Роман', 'roman', 'Imported');
  await fsPromises.mkdir(importedRoot, { recursive: true });
  const suffix = '\n\nmanuscript é 🧭\n\n[pro-unknown]\n{"keep":[1,"two"]}\n[/pro-unknown]';
  const source = '[meta]\nsynopsis: Синопсис é 🧭\nstatus: черновик\ntags: POV=Kira; линия=A; место=Station\n[/meta]' + suffix;
  const scenePath = path.join(importedRoot, '01_Alpha.txt');
  await fsPromises.writeFile(scenePath, source);
  await fsPromises.writeFile(path.join(importedRoot, '02_Beta.txt'), source.replace('Синопсис', 'Beta'));
  const { main, fileManager } = await loadMainWithElectronStub();
  const oldDocuments = fileManager.getDocumentsPath;
  fileManager.getDocumentsPath = () => documentsRoot;
  t.after(() => { fileManager.getDocumentsPath = oldDocuments; });
  await main.buildProjectTreeRootsWithIdentities('Роман');
  const tree = await main.handleWorkspaceProjectTreeQuery({ tab: 'roman' });
  const alpha = findNode(tree.root, (n) => n.kind === 'scene' && n.label === 'Alpha');
  const beta = findNode(tree.root, (n) => n.kind === 'scene' && n.label === 'Beta');
  assert.ok(alpha && beta);
  const synopsis = metadataControl(), pov = metadataControl(), line = metadataControl(), place = metadataControl();
  const status = metadataControl('черновик'), timers = new Map(), statuses = [], commands = [], queries = [];
  let timerId = 0, incoming;
  const ports = { commandGate: null, queryGates: [] };
  const c = {
    currentProjectId: tree.projectId, currentDocumentId: alpha.nodeId, currentDocumentKind: 'scene', currentDocumentTitle: 'Alpha',
    currentMeta: {}, metaEnabled: true, metaSynopsis: synopsis, metaStatus: status, metaTagPov: pov, metaTagLine: line, metaTagPlace: place,
    inspectorMetaSynopsisValue: synopsis, inspectorMetaStatusValue: status,
    document: { activeElement: null }, metaPanel: { dataset: {}, classList: { toggle() {}, add() {} } },
    inspectorEmptyState: null, rightInspectorTabButton: null, inspectorContextKind: null, inspectorSceneSections: [],
    inspectorSceneDetails: null, inspectorDocumentSummary: null, inspectorDocumentTypeValue: null,
    inspectorDetailsShowLabel: null, inspectorDetailsHideLabel: null, inspectorMetaContextValue: null,
    inspectorMetaWordCountValue: null, inspectorDocumentWordCountValue: null, inspectorMetaTagsValue: null,
    inspectorMetaModifiedValue: null, inspectorDocumentModifiedValue: null,
    METADATA_UPDATE_COMMAND_ID: 'cmd.project.metadata.update', METADATA_INSPECTOR_QUERY_ID: 'query.metadataInspector',
    ensureSelectHasOption() {}, getPlainText: () => 'manuscript é 🧭',
    updateStatusText: (value) => statuses.push(value),
    window: {
      setTimeout(fn, delay) { assert.equal(delay, 400); timers.set(++timerId, fn); return timerId; },
      clearTimeout(id) { timers.delete(id); },
      electronAPI: { invokeWorkspaceQueryBridge() {}, onEditorSetText(fn) { incoming = fn; } },
    },
    async dispatchUiCommand(id, payload) {
      assert.equal(id, 'cmd.project.metadata.update');
      const result = await main.handleMetadataUpdateCommand(JSON.parse(JSON.stringify(payload)));
      commands.push({ payload: JSON.parse(JSON.stringify(payload)), result });
      if (ports.commandGate) await ports.commandGate.promise;
      return result.ok ? { ok: true, value: result } : result;
    },
    async invokeWorkspaceQueryBridge(id, payload) {
      assert.equal(id, 'query.metadataInspector');
      const gate = ports.queryGates.shift();
      const result = await main.handleWorkspaceMetadataInspectorQuery(payload);
      queries.push(result);
      if (gate) await gate.promise;
      return result;
    },
    isTiptapMode: false, activeDocumentRevealRequested: false, currentRightTab: 'metadata', localEditGeneration: 7,
    lastAckedGeneration: 7, localDirty: false, currentCards: [], editor: null, editorPanel: null, mainContent: null, emptyState: null,
    normalizeProjectId: (id) => id, isProjectTreeDocumentId: () => false,
    parseDocumentContent: require(path.join(ROOT, 'src/core/document-content-envelope-v1.cjs')).parseObservablePayload,
    shouldUseCentralSheetLargePayloadFastPath: () => false, reviewSurfaceResolveIncomingPayload: () => null,
    revealActiveDocumentAncestors: () => ({ found: false }), requestAnimationFrame() {},
  };
  for (const name of ['cancelLinkDialog', 'clearFlowModeState', 'applyIncomingBookProfile', 'setReviewSurfaceState',
    'clearCentralSheetLargePayloadFastPath', 'setPlainText', 'updateMetaVisibility', 'updateCardsList', 'updateWordCount',
    'scheduleCentralSheetStripProofRefresh', 'showEditorPanelFor', 'renderTree', 'updateSaveStateText',
    'refreshManuscriptNoteReferences', 'refreshVisibleCommentProjection', 'updatePerfHintText', 'updateInspectorSnapshot',
    'applyPendingProjectSearchJump', 'invalidateDocxImportAttempt', 'restoreSpatialLayoutState', 'adoptToolbarConfiguratorState',
    'refreshTreeForProjectPublication', 'hideManualMapPlanWorkspace', 'hideNotesWorkspace', 'hideProjectSearchWorkspace',
    'hideAuthoringSurfacesSurface', 'showWriterHomeSurface']) c[name] = () => {};
  c.createNavigatorSelectionState = () => ({});
  metadataVm.createContext(c);
  metadataVm.runInContext(
    metadataSection("let currentMetadataBaselineHash = '';", 'let expandedNodesByTab')
    + metadataSection('function updateMetaInputs(', 'function updateMetaVisibility(')
    + metadataSection('function normalizeMetadataInspectorPayload(', 'function normalizeNotesWorkspaceReadModel(')
    + metadataSection("if (metaSynopsis) {\n  metaSynopsis.addEventListener('input'", 'if (addCardButton)')
    + metadataSection('function collapseSelection()', 'function updateMetaInputs(')
    + metadataSection('window.electronAPI.onEditorSetText((payload) => {', '  window.electronAPI.onEditorTextRequest('), c);
  await c.refreshMetadataInspector();
  c.document.activeElement = synopsis;
  assert.equal(c.inspectorMetaSynopsisValue, c.metaSynopsis, 'actual HTML selectors alias one textarea');
  assert.match(fs.readFileSync(path.join(ROOT, 'src/renderer/index.html'), 'utf8'), /<textarea[^>]*data-meta-synopsis[^>]*data-inspector-meta-synopsis/u);
  assert.equal(synopsis.value, 'Синопсис é 🧭');
  const state = () => JSON.parse(metadataVm.runInContext('JSON.stringify({baseline:currentMetadataBaselineHash,pending:metadataUpdatePending,meta:currentMeta})', c));
  const raw = () => fsPromises.readFile(scenePath, 'utf8');
  const waitFor = async (predicate) => {
    const deadline = performance.now() + 2000;
    while (!predicate() && performance.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 5));
    assert.ok(predicate(), 'finite Main adapter operation reached expected barrier');
  };
  return { c, synopsis, pov, line, place, status, statuses, timers, ports, commands, queries, tree, alpha, beta, source, suffix, state, raw, waitFor,
    flush: () => c.flushMetadataUpdate(), refresh: () => c.refreshMetadataInspector(),
    debounce: async () => {
      assert.equal(timers.size, 1);
      const [id, callback] = timers.entries().next().value;
      const queryCount = queries.length;
      timers.delete(id); callback();
      await waitFor(() => queries.length > queryCount);
      await new Promise(setImmediate);
    },
    incoming: async (content, projectId = tree.projectId, documentId = alpha.nodeId) => {
      assert.equal(projectId, tree.projectId, 'fixture publication belongs to this actual canonical project');
      const target = documentId === alpha.nodeId ? scenePath : path.join(importedRoot, '02_Beta.txt');
      assert.ok(documentId === alpha.nodeId || documentId === beta.nodeId);
      await fsPromises.writeFile(target, content);
      incoming({ content, projectId, documentId, metaEnabled: true, kind: 'scene' });
    },
    betaProjection: () => main.handleWorkspaceMetadataInspectorQuery({ projectId: tree.projectId, nodeId: beta.nodeId }),
    assertBody: async () => assert.equal((await raw()).slice((await raw()).indexOf('[/meta]') + 7), suffix),
  };
}

test('metadata readback preserves cut caret and subsequent paste through real Main persistence', async (t) => {
  const h = await metadataWorkingHarness(t);
  h.synopsis.setSelectionRange(0, 'Синопсис'.length, 'forward');
  h.synopsis.replaceSelection('');
  assert.equal(h.timers.size, 1, 'actual input listener schedules the existing debounce');
  assert.equal(h.synopsis.value, ' é 🧭');
  await h.debounce();
  t.diagnostic(JSON.stringify({ readback: h.queries.at(-1).metadata.synopsis, working: h.synopsis.value,
    caret: h.synopsis.selectionStart, rawScene: await h.raw() }));
  assert.equal(h.commands[0].result.ok, true);
  assert.equal(h.commands[0].result.receipt.recovery.snapshotReadable, true);
  assert.equal(h.queries.at(-1).metadata.synopsis, 'é 🧭', 'canonical normalizer remains authoritative');
  await h.assertBody();
  assert.equal(h.synopsis.value, ' é 🧭', 'active authoring whitespace must survive canonical readback');
  assert.equal(h.state().meta.synopsis, ' é 🧭', 'ordinary Save keeps the raw metadata authoring working value');
  assert.equal(h.synopsis.selectionStart, 0);
  assert.equal(h.synopsis.selectionEnd, 0);
  h.synopsis.replaceSelection('Замысел');
  await h.debounce();
  assert.equal(h.synopsis.value, 'Замысел é 🧭');
  assert.equal(h.queries.at(-1).metadata.synopsis, 'Замысел é 🧭');
  assert.equal(h.state().baseline, sha256(await h.raw()));
  await h.assertBody();
});

test('metadata readback preserves active middle selection, direction and composition-style tag input', async (t) => {
  const h = await metadataWorkingHarness(t);
  for (const control of [h.synopsis, h.pov, h.line, h.place]) {
    h.c.document.activeElement = control;
    control.input('  é 🧭 draft  ', 2, 5, 'backward', true);
    const assignments = control.assignments;
    await h.flush();
    assert.equal(control.value, '  é 🧭 draft  ');
    assert.deepEqual([control.selectionStart, control.selectionEnd, control.selectionDirection], [2, 5, 'backward']);
    assert.equal(control.assignments, assignments, 'readback does not call the changed-value setter on the active field');
    assert.equal(h.commands.at(-1).result.ok, true);
  }
  await h.assertBody();
});

test('metadata inactive mirrors consume canonical values and unchanged values retain selection', async (t) => {
  const h = await metadataWorkingHarness(t);
  h.synopsis.input('  canonical  ', 3, 6, 'backward');
  h.c.document.activeElement = null;
  await h.flush();
  assert.equal(h.synopsis.value, 'canonical');
  h.synopsis.setSelectionRange(1, 3, 'backward');
  const assignments = h.synopsis.assignments;
  await h.refresh();
  assert.equal(h.synopsis.assignments, assignments);
  assert.deepEqual([h.synopsis.selectionStart, h.synopsis.selectionEnd, h.synopsis.selectionDirection], [1, 3, 'backward']);
});

test('metadata pending newer edit eventually persists after an in-flight real Main acknowledgement', async (t) => {
  const h = await metadataWorkingHarness(t);
  const gate = metadataDeferred(); h.ports.commandGate = gate;
  h.synopsis.input('first A');
  const first = h.flush();
  await h.waitFor(() => h.commands.length === 1);
  h.synopsis.input('  newer B é 🧭  ', 2);
  const premature = h.flush();
  await new Promise(setImmediate);
  gate.resolve(); await first; await premature;
  h.ports.commandGate = null;
  if (h.state().pending) await h.flush();
  assert.equal(h.commands.length, 2, 'one actual command per authored version');
  assert.ok(h.commands.every((entry) => entry.result.ok), 'B must use A resulting CAS baseline');
  assert.equal(h.queries.at(-1).metadata.synopsis, 'newer B é 🧭');
  assert.equal(h.synopsis.value, '  newer B é 🧭  ');
  assert.equal(h.synopsis.selectionStart, 2);
  assert.equal(h.state().pending, false);
  assert.equal(h.state().baseline, sha256(await h.raw()));
  await h.assertBody();
});

test('metadata stale query and command ack cannot overwrite a same-ID incoming payload', async (t) => {
  const h = await metadataWorkingHarness(t);
  const queryGate = metadataDeferred(); h.ports.queryGates.push(queryGate);
  const oldQuery = h.refresh(); await h.waitFor(() => h.queries.length === 2);
  const ackGate = metadataDeferred(); h.ports.commandGate = ackGate;
  h.synopsis.input('old command');
  const oldCommand = h.flush(); await h.waitFor(() => h.commands.length === 1);
  await h.incoming(h.source.replace('Синопсис', 'Incoming SAME IDs'));
  await h.waitFor(() => h.queries.length === 3);
  await new Promise(setImmediate);
  const before = h.state(), statuses = [...h.statuses];
  assert.equal(h.synopsis.value, 'Incoming SAME IDs é 🧭', 'actual incoming payload forces replacement despite focus and same IDs');
  queryGate.resolve(); await oldQuery;
  assert.deepEqual(h.state(), before, 'old query cannot change incoming model or baseline');
  assert.deepEqual(h.statuses, statuses);
  assert.equal(h.synopsis.value, 'Incoming SAME IDs é 🧭');
  ackGate.resolve(); await oldCommand;
  assert.equal(h.synopsis.value, 'Incoming SAME IDs é 🧭');
  assert.deepEqual(h.state(), before);
  assert.deepEqual(h.statuses, statuses);
});

test('metadata query ordering and new input refuse stale projection baseline and status', async (t) => {
  const h = await metadataWorkingHarness(t);
  const gate = metadataDeferred(); h.ports.queryGates.push(gate);
  const older = h.refresh(); await h.waitFor(() => h.queries.length === 2);
  h.synopsis.input('newer version'); await h.flush();
  const before = h.state(), statuses = [...h.statuses];
  gate.resolve(); await older;
  assert.deepEqual(h.state(), before);
  assert.deepEqual(h.statuses, statuses);
  const inputGate = metadataDeferred(); h.ports.queryGates.push(inputGate);
  const beforeInput = h.refresh(); await h.waitFor(() => h.queries.length === 4);
  h.synopsis.input('pending unsaved version', 4, 8, 'forward');
  inputGate.resolve(); await beforeInput;
  assert.equal(h.state().pending, true);
  assert.equal(h.synopsis.value, 'pending unsaved version');
  await h.flush();
  assert.equal(h.queries.at(-1).metadata.synopsis, 'pending unsaved version');
  await h.assertBody();
});

test('metadata different-document payload and away-and-back clear invalidate prior async work', async (t) => {
  const h = await metadataWorkingHarness(t);
  const gate = metadataDeferred(); h.ports.queryGates.push(gate);
  const old = h.refresh(); await h.waitFor(() => h.queries.length === 2);
  await h.incoming(h.source.replace('Синопсис', 'Other document'), h.tree.projectId, h.beta.nodeId);
  assert.equal(h.synopsis.value, 'Other document é 🧭');
  assert.equal(h.c.currentDocumentId, h.beta.nodeId);
  h.c.collapseSelection();
  await h.incoming(h.source.replace('Синопсис', 'Back to Alpha'));
  await h.waitFor(() => h.queries.length === 4);
  await new Promise(setImmediate);
  const before = h.state();
  gate.resolve(); await old;
  assert.deepEqual(h.state(), before);
  assert.equal(h.synopsis.value, 'Back to Alpha é 🧭');
});

test('metadata wrong project or node projection cannot replace current baseline or working form', async (t) => {
  const h = await metadataWorkingHarness(t);
  const beta = await h.betaProjection();
  assert.equal(beta.ok, true);
  const before = h.state(), statuses = [...h.statuses], value = h.synopsis.value;
  h.c.renderMetadataInspectorState(beta);
  assert.deepEqual(h.state(), before);
  assert.equal(h.synopsis.value, value);
  for (const state of ['ready', 'unavailable']) {
    h.c.renderMetadataInspectorState({ ...beta, state, context: { ...beta.context, nodeId: h.alpha.nodeId, projectId: 'foreign-project' } });
    assert.deepEqual(h.state(), before);
  }
  assert.deepEqual(h.statuses, statuses);
  assert.equal(h.synopsis.value, value);
});
