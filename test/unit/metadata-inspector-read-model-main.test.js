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
    initialDocumentAdopted: true, // This fixture already owns an adopted live document.
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
    + metadataSection('let atlasPublicationEpoch =', 'let atlasCommandPublicationSequence =')
    + metadataSection('function invalidateAtlasPublications()', 'function captureAtlasPublication(')
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

// Full Main Save and metadata share genuine Core/FS effects. Only Electron's
// window/transport and explicitly armed fault/barrier ports are finite hosts.
async function metadataTransactionHarness(t, { cohorts = false } = {}) {
  const root = fs.realpathSync(await fsPromises.mkdtemp(path.join(os.tmpdir(), 'metadata-transaction-main-')));
  fs.writeFileSync(path.join(root, 'OWNED_METADATA_TRANSACTION'), 'synthetic fixture only\n');
  t.after(() => fsPromises.rm(root, { recursive: true, force: true }));
  const documents = path.join(root, 'Documents', 'craftsman'), userData = path.join(root, 'userData');
  await fsPromises.mkdir(userData, { recursive: true });
  const mainPath = path.join(ROOT, 'src/main.js'), managerPath = path.join(ROOT, 'src/utils/fileManager.js');
  const ports = { sent: [], listeners: new Map(), handlers: new Map(), transactions: [], queued: null, fsHook: null, capability: true };
  let window, shellUrl, snapshot;
  const event = () => ({ sender: window.webContents, senderFrame: { url: shellUrl, parent: null, top: null } });
  function Window() {
    window = this;
    this.isDestroyed = () => false; this.on = () => {};
    this.webContents = { id: 88, session: {}, isDestroyed: () => false, getURL: () => shellUrl,
      setWindowOpenHandler() {}, on() {}, send(channel, payload) {
        ports.sent.push([channel, payload]);
        if (channel === 'editor:set-text') {
          if (payload.expectedGeneration !== undefined) {
            if (snapshot.content === payload.expectedContent && snapshot.generation === payload.expectedGeneration) {
              snapshot = { ...snapshot, content: payload.content };
            }
          } else snapshot = { ...payload, generation: 0, plainText: '' };
        }
        if (channel === 'editor:snapshot-request') queueMicrotask(() => ports.listeners.get('editor:snapshot-response')(
          event(), { requestId: payload.requestId, snapshot }));
      } };
    this.loadFile = (file, { query }) => {
      const url = require('node:url').pathToFileURL(file);
      for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
      shellUrl = url.href; return new Promise(() => {}); // No renderer/startup/application launch.
    };
  }
  Window.getFocusedWindow = () => window; Window.getAllWindows = () => [window];
  const electron = {
    app: { getPath: name => name === 'userData' ? userData : name === 'documents' ? path.dirname(documents) : root,
      setPath() {}, whenReady: () => new Promise(() => {}), on() {}, quit() {}, exit() {}, setName() {}, requestSingleInstanceLock: () => true },
    BrowserWindow: Window, screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1200, height: 800 } }) },
    Menu: { buildFromTemplate: () => ({}), setApplicationMenu() {} },
    dialog: { showMessageBox: async () => ({ response: 1 }), showSaveDialog: async () => ({ canceled: true }), showOpenDialog: async () => ({ canceled: true }) },
    ipcMain: { on: (id, fn) => ports.listeners.set(id, fn), handle: (id, fn) => ports.handlers.set(id, fn) },
    session: { defaultSession: { webRequest: { onHeadersReceived() {} } } },
  };
  const originalLoad = Module._load;
  let main, manager;
  Module._load = function(request, parent, isMain) {
    if (request === 'electron') return electron;
    const actual = originalLoad.call(this, request, parent, isMain);
    if (parent?.filename === mainPath && request === './core/project-transaction-v1.cjs') return { ...actual,
      commitProjectTransaction: async input => {
        ports.transactions.push(input);
        const adapter = new Proxy(fsPromises, { get(target, key) {
          if (typeof target[key] !== 'function') return target[key];
          return async (...args) => { if (ports.fsHook) await ports.fsHook(key, args); return target[key](...args); };
        } });
        return actual.commitProjectTransaction({ ...input, fsAdapter: adapter });
      } };
    if (parent?.filename === mainPath && request === './core/writer-local-profile-v1.cjs') return { ...actual,
      evaluateWriterLocalCommandAccess: input => {
        const result = actual.evaluateWriterLocalCommandAccess(input);
        return !ports.capability && input.commandId === 'cmd.project.metadata.update' ? { ...result, allowed: false } : result;
      } };
    return actual;
  };
  delete require.cache[managerPath];
  try {
    const compiled = new Module(mainPath, module);
    compiled.filename = mainPath; compiled.paths = Module._nodeModulePaths(path.dirname(mainPath));
    compiled._compile(fs.readFileSync(mainPath, 'utf8') + `\nmodule.exports.__metadataTransactionTest = {
      save: handleSave, reopen: openProjectDocumentFile, recover: recoverWriterProjectTransactionForFile,
      continuation: () => userBookmarkSaveContinuation,
      fixtureRawCommit: async sceneContent => {
        const scenePath=currentFilePath, manifestPath=getProjectManifestPath(currentProjectName);
        const raw=await fs.readFile(manifestPath,'utf8'), projectId=JSON.parse(raw).projectId;
        const beforeContent=await fs.readFile(scenePath,'utf8'), sceneId=path.relative(path.dirname(manifestPath),scenePath).split(path.sep).join('/');
        const comments=await (await loadRtkNonTextReturnModule()).readCommentAuthoringState({projectRoot:path.dirname(manifestPath),projectId});
        const notes=await (await loadNotesStorageModule()).readNotesStorage({projectRoot:path.dirname(manifestPath),projectId});
        const commentState=planCommentAnchorSave({beforeText:comments.text,projectId,sceneId,beforeContent,afterContent:sceneContent,includeUnchanged:true});
        const noteState=manuscriptNoteModel.planManuscriptNoteAnchorSave({beforeText:notes.sourceExists?notes.sourceText:null,projectId,sceneId,beforeContent,afterContent:sceneContent,includeUnchanged:true});
        const authority=await getMainProjectManifestAuthority();
        return authority.withProjectLease(projectId,lease=>lease.publish(()=>commitProjectTransaction({
          scenePath,sceneContent,expectedSceneContent:beforeContent,manifestPath,manifestContent:raw,expectedManifestContent:raw,
          revision:lastSignaledEditGeneration,...(commentState?{commentState}:{}),...(noteState?{noteState}:{}),
          verifyManifestContinuation:r=>authority.verifyManifestContinuation({...r,projectId}),
          publishManifest:args=>authority.commitManifestText({projectId,lease,targetPath:args.manifestPath,expectedText:args.expectedText,nextText:args.nextText,label:'owned raw fixture baseline'})
        })));
      },
      queue: (...args) => queueDiskOperation(...args),
      state: () => ({projectName:currentProjectName,file:currentFilePath,session:commentAuthoringSessionId,
        generation:lastSignaledEditGeneration,ack:lastAcknowledgedEditGeneration,dirty:isDirty}),
      change: kind => { if(kind==='project')currentProjectName='Foreign'; if(kind==='file')currentFilePath=null;
        if(kind==='session')commentAuthoringSessionId='foreign'; if(kind==='window')mainWindow={...mainWindow};
        if(kind==='owner')activeStage10ApplicationBootstrap={}; if(kind==='generation')lastSignaledEditGeneration++;
        if(kind==='import')projectArchiveOpenCapture={}; },
      observeQueue: callback => { const original=queueDiskOperation; queueDiskOperation=(operation,label)=>{
        const result=original(operation,label); if(label.startsWith('update metadata'))callback(); return result; }; }
      ,observePublish: callback => { const original=commitWriterProjectSnapshot; commitWriterProjectSnapshot=(...args)=>{
        const options=args[5]; if(typeof options?.beforeScenePublish!=='function')throw Error('actual publication guard required');
        args[5]={...options,beforeScenePublish:async()=>{await callback();return options.beforeScenePublish();}};
        return original(...args); }; }
    };`, mainPath);
    main = compiled.exports; manager = require(managerPath);
    const previous = manager.getDocumentsPath; manager.getDocumentsPath = () => documents;
    t.after(() => { manager.getDocumentsPath = previous; });
    main.createWindow();
  } finally { Module._load = originalLoad; }
  const created = await main.handleProjectLifecycleCreateCommand({ projectName: 'Metadata Tx' });
  assert.equal(created.ok, true, JSON.stringify(created));
  assert.equal(created.stage10Bootstrap.ok, true, 'real existing owner bootstrap');
  const unit = main.__metadataTransactionTest, file = unit.state().file, projectRoot = path.join(documents, 'Metadata Tx');
  const manifestPath = path.join(projectRoot, 'project.craftsman.json');
  const profileModule = await import(require('node:url').pathToFileURL(path.join(ROOT, 'src/core/bookProfile.mjs')).href);
  const profile = { ...profileModule.createDefaultBookProfile(), profileId: 'metadata-transaction-profile', marginLeftMm: 30 };
  const manifest = JSON.parse(await fsPromises.readFile(manifestPath, 'utf8'));
  manifest.bookProfile = profile; manifest.privateSentinel = { retain: ['é', '🧭'] };
  await fsPromises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  const envelope = require('../../src/core/document-content-envelope-v1.cjs');
  let content = envelope.composeObservablePayload({ metaEnabled: true,
    meta: { synopsis: 'Original', status: 'черновик', tags: { pov: 'Kira', line: 'A', place: 'Station' } },
    doc: { type: 'doc', attrs: { wordPendingRevisions: null, wordUserBookmarks: null }, content: [
      { type: 'paragraph', attrs: { textAlign: null }, content: [{ type: 'text', text: 'Привет é 🧭' }] } ] } });
  await fsPromises.writeFile(file, content);
  const resource = path.join(projectRoot, 'assets', 'protected.bin');
  await fsPromises.mkdir(path.dirname(resource), { recursive: true }); await fsPromises.writeFile(resource, Buffer.from([0, 9, 255]));
  const comments = path.join(projectRoot, '.yalken/word-review/non-text-return-state.v1.json');
  await fsPromises.mkdir(path.dirname(comments), { recursive: true });
  await fsPromises.writeFile(comments, JSON.stringify({ schemaVersion: 'yalken.rtk.word.non-text-return-state.v1',
    projectId: created.projectId, revision: 0, threads: [], events: [], privateSentinel: 'comments preserved' }));
  const notes = path.join(projectRoot, 'notes.craftsman.json'), history = path.join(projectRoot, 'backups/protected-history.bin');
  await fsPromises.writeFile(notes, JSON.stringify({ schemaVersion: 1, projectId: created.projectId, notes: [], privateSentinel: 'notes preserved' }));
  await fsPromises.mkdir(path.dirname(history), { recursive: true }); await fsPromises.writeFile(history, Buffer.from([9, 0, 33]));
  if (cohorts) {
    const bookmarks = require('../../src/core/word-user-bookmarks-v1.cjs'), parsed = envelope.parseObservablePayload(content);
    const sceneId = path.relative(projectRoot, file).split(path.sep).join('/');
    const doc = bookmarks.planMutation({ doc: parsed.doc, action: 'create', name: 'Anchor',
      start: { paragraphIndex: 0, offsetUtf16: 1, edge: 'text' }, end: { paragraphIndex: 0, offsetUtf16: 5, edge: 'text' },
      requestId: 'owned-metadata-bookmark', projectId: created.projectId, sceneId }).doc;
    doc.attrs.privateDocumentSentinel = { retain: ['é', '🧭'] };
    content = envelope.composeObservablePayload({ ...parsed, metaEnabled: parsed.hasMetaBlock, doc });
    await fsPromises.writeFile(file, content);
    const comment = require('../../src/core/word-comment-authoring-v1.cjs').planCommentAuthoring({ beforeText: null,
      projectId: created.projectId, sceneId, sceneSha256: sha256(content), paragraphs: [parsed.text], now: '2026-10-22T00:00:00Z',
      input: { requestId: 'metadata-comment', action: 'create', projectId: created.projectId, sceneId,
        expectedSceneSha256: sha256(content), expectedStateSha256: '', body: 'Protected comment é 🧭',
        anchor: { paragraphIndex: 0, startUtf16: 1, selectedText: parsed.text.slice(1, 5) } } });
    await fsPromises.writeFile(comments, comment.afterText);
    const model = require('../../src/core/word-manuscript-notes-v1.cjs');
    const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Protected note é 🧭' }] }] };
    await fsPromises.writeFile(notes, JSON.stringify({ schemaVersion: 1, projectId: created.projectId, notes: [{ id: 'owned-note', scope: 'manuscript',
      body: model.validateNoteBody(body).text, manuscript: model.bindManuscriptPayload({ kind: 'footnote', body, sceneId, offsetUtf16: 2, sceneContent: content }) }] }));
  }
  snapshot = { ...snapshot, content, bookProfile: profile, generation: 1 };
  const signal = async () => {
    const channel = 'ui:save-lifecycle-signal-bridge';
    const request = require('../../src/core/ipc-envelope-v1.cjs').createEnvelope(channel, 'signal.localDirty.set', { state: true, generation: snapshot.generation });
    assert.equal((await ports.handlers.get(channel)(event(), request)).ok, true);
  };
  await signal(); assert.equal(await unit.save(), true, 'actual initial ordinary Save');
  const read = () => fsPromises.readFile(file, 'utf8');
  const commitPath = file + '.wp201-commit.json', commit = () => JSON.parse(fs.readFileSync(commitPath, 'utf8'));
  assert.equal(commit().sceneDigest, sha256(await read()));
  const update = async (synopsis, options) => main.handleMetadataUpdateCommand({ projectId: created.projectId,
    nodeId: created.documentId, baselineHash: sha256(await read()), metadata: { synopsis, status: 'черновик', tags: { pov: 'Kira', line: 'A', place: 'Station' } } }, options);
  const working = async (content, generation) => { snapshot = { ...snapshot, content, generation }; await signal(); };
  const protectedState = async () => ({ profile: JSON.parse(await fsPromises.readFile(manifestPath, 'utf8')).bookProfile,
    sentinel: JSON.parse(await fsPromises.readFile(manifestPath, 'utf8')).privateSentinel,
    resource: [...await fsPromises.readFile(resource)], comments: await fsPromises.readFile(comments, 'utf8'),
    notes: await fsPromises.readFile(notes, 'utf8'), history: [...await fsPromises.readFile(history)],
    document: envelope.parseObservablePayload(await read()).doc });
  return { main, unit, ports, file, root, projectRoot, manifestPath, profile, read, commit, commitPath, update, working,
    projectId: created.projectId, nodeId: created.documentId,
    snapshot: () => snapshot, envelope, protectedState, signal,
    save: () => unit.save(), queued: async () => {
      const gate = metadataDeferred(), seen = metadataDeferred();
      const blocked = unit.queue(() => gate.promise, 'test owned metadata queue barrier');
      unit.observeQueue(() => seen.resolve());
      return { release: async () => { gate.resolve(); await blocked; }, seen: seen.promise };
    },
  };
}

test('metadata transaction preserves real committed scene then ordinary Save acknowledgement and reopen', async (t) => {
  const h = await metadataTransactionHarness(t), before = await h.protectedState();
  const oldCommit = h.commit();
  const pending = h.snapshot().content.replace('Привет é 🧭', 'Привет é 🧭 1');
  await h.working(pending, 2);
  const beforeMetadata = h.unit.state(), pushes = h.ports.sent.length;
  const metadata = await h.update('Замысел é 🧭');
  assert.equal(metadata.ok, true, JSON.stringify(metadata));
  assert.deepEqual(h.unit.state(), beforeMetadata, 'metadata must not acknowledge or clear unsaved manuscript generation');
  assert.equal(h.ports.sent.slice(pushes).some(([id]) => id === 'set-dirty'), false);
  const updated = await h.read();
  await h.working(updated, 2);
  const saved = await h.save();
  const packets = fs.existsSync(path.join(h.projectRoot, '.yalken-recovery'))
    ? fs.readdirSync(path.join(h.projectRoot, '.yalken-recovery')).filter(n => n.endsWith('.json')).map(n => JSON.parse(fs.readFileSync(path.join(h.projectRoot, '.yalken-recovery', n), 'utf8'))) : [];
  t.diagnostic(JSON.stringify({ saved, oldDigest: oldCommit.sceneDigest, rawDigest: sha256(updated), commitDigest: h.commit().sceneDigest,
    recoveryReasons: packets.map(p => p.binding.reasonCode), state: h.unit.state() }));
  assert.equal(saved, true, 'ordinary Save after metadata must retain real transaction coherence');
  assert.equal(h.commit().sceneDigest, sha256(updated));
  assert.deepEqual(await h.protectedState(), before);
  assert.equal(h.envelope.parseObservablePayload(updated).meta.synopsis, 'Замысел é 🧭');
  for (const [body, generation] of [['Привет é 🧭 1', 3], ['Привет é 🧭', 4], ['Привет é 🧭 1', 5]]) {
    const parsed = h.envelope.parseObservablePayload(await h.read());
    parsed.doc.content[0].content[0].text = body;
    await h.working(h.envelope.composeObservablePayload({ ...parsed, metaEnabled: true }), generation);
    assert.equal(await h.save(), true);
    assert.equal(h.unit.state().ack, generation);
    assert.equal(h.unit.state().dirty, false);
    assert.equal(h.commit().sceneDigest, sha256(await h.read()));
  }
  const opened = await h.main.handleProjectLifecycleOpenCommand({ projectId: h.projectId });
  assert.equal(opened.ok, true, JSON.stringify(opened));
  assert.equal(h.snapshot().content, await h.read(), 'normal Main open publishes the actual persisted payload');
  assert.match(h.snapshot().content, /Привет é 🧭 1/u);
  const after = await h.protectedState();
  assert.deepEqual({ ...after, document: before.document }, before);
  assert.equal(h.envelope.parseObservablePayload(await h.read()).meta.synopsis, 'Замысел é 🧭');
});

test('metadata queued transaction refuses changed source, canonical manifest/profile/node and lifecycle authority', async (t) => {
  for (const kind of ['source', 'manifest', 'profile', 'node', 'project', 'file', 'session', 'window', 'owner', 'generation', 'capability', 'import']) {
    await t.test(kind, async (t) => {
      const h = await metadataTransactionHarness(t), blocked = await h.queued();
      const changing = h.update('must refuse');
      await Promise.race([blocked.seen, new Promise((_, reject) => setTimeout(() => reject(Error('real metadata queue not reached')), 2000))]);
      if (kind === 'source') await fsPromises.writeFile(h.file, (await h.read()).replace('Привет', 'Foreign source'));
      else if (['manifest', 'profile', 'node'].includes(kind)) {
        const manifest = JSON.parse(await fsPromises.readFile(h.manifestPath, 'utf8'));
        if (kind === 'manifest') manifest.privateSentinel.newer = true;
        if (kind === 'profile') manifest.bookProfile.marginLeftMm = 35;
        if (kind === 'node') manifest.treeIdentity.nodes[h.nodeId].bindingKey = 'file:roman/Imported/Foreign.txt';
        await fsPromises.writeFile(h.manifestPath, JSON.stringify(manifest, null, 2));
      } else if (kind === 'capability') h.ports.capability = false;
      else h.unit.change(kind);
      const before = { raw: await h.read(), manifest: await fsPromises.readFile(h.manifestPath, 'utf8'),
        commit: await fsPromises.readFile(h.commitPath, 'utf8'), state: h.unit.state(), pushes: h.ports.sent.length };
      await blocked.release(); const result = await changing;
      assert.equal(result.ok, false, JSON.stringify(result));
      assert.match(result.code, /(?:METADATA_UPDATE_(?:CONTEXT|TARGET)_STALE|METADATA_UPDATE_CAPABILITY_DENIED|PROJECT_TRANSACTION_SCENE_CAS)/u);
      assert.equal(await h.read(), before.raw); assert.equal(await fsPromises.readFile(h.manifestPath, 'utf8'), before.manifest);
      assert.equal(await fsPromises.readFile(h.commitPath, 'utf8'), before.commit);
      assert.deepEqual(h.unit.state(), before.state);
      assert.equal(h.ports.sent.slice(before.pushes).some(([id]) => id === 'set-dirty'), false);
    });
  }
});

test('metadata actual Core publication interruption retains readable journal and recovers without repairing commit integrity', async (t) => {
  const h = await metadataTransactionHarness(t), before = await h.read(), priorCommit = await fsPromises.readFile(h.commitPath, 'utf8');
  let exercised = 0;
  h.ports.fsHook = (key, args) => {
    if (key === 'rename' && args[1] === h.file) { exercised++; throw Object.assign(Error('owned scene publication fault'), { code: 'EIO' }); }
  };
  const failed = await h.update('must not report saved');
  assert.equal(failed.ok, false);
  assert.ok(exercised > 0, 'fault reaches real Core scene publication');
  assert.equal(await h.read(), before); assert.equal(await fsPromises.readFile(h.commitPath, 'utf8'), priorCommit);
  const journal = h.manifestPath + '.wp201-transaction.json';
  assert.equal(fs.existsSync(journal), true, 'real interrupted transaction remains recoverable');
  h.ports.fsHook = null;
  const recovery = await h.unit.recover(h.file);
  assert.equal(recovery.recovered, true); assert.equal(await h.read(), before);
  assert.equal(await fsPromises.readFile(h.commitPath, 'utf8'), priorCommit);
  assert.equal(fs.existsSync(journal), false);
  assert.equal((await h.update('after real recovery')).ok, true);
  assert.equal(h.commit().sceneDigest, sha256(await h.read()));
});

test('metadata transaction still refuses an actually corrupt retained commit and ignores the old arbitrary writer option', async (t) => {
  const h = await metadataTransactionHarness(t);
  let bypassCalls = 0;
  const result = await h.update('canonical transaction', { writeFileAtomic: () => { bypassCalls++; return { success: true }; } });
  assert.equal(result.ok, true); assert.equal(bypassCalls, 0);
  assert.equal(h.commit().sceneDigest, sha256(await h.read()));
  const corrupt = { ...h.commit(), sceneDigest: '0'.repeat(64) };
  await fsPromises.writeFile(h.commitPath, JSON.stringify(corrupt));
  const before = await h.read(), commitBefore = await fsPromises.readFile(h.commitPath, 'utf8');
  const failed = await h.update('refuse corruption');
  assert.equal(failed.ok, false); assert.equal(failed.code, 'E_PROJECT_COMMIT_CORRUPT');
  assert.equal(await h.read(), before); assert.equal(await fsPromises.readFile(h.commitPath, 'utf8'), commitBefore);
  const packets = fs.readdirSync(path.join(h.projectRoot, '.yalken-recovery')).filter(n => n.endsWith('.json'))
    .map(n => JSON.parse(fs.readFileSync(path.join(h.projectRoot, '.yalken-recovery', n), 'utf8')));
  assert.ok(packets.some(p => p.binding.reasonCode === 'COMMIT_RECORD_SCENE_DIGEST_MISMATCH'));
  assert.ok(packets.every(p => p.repairContract.automaticRepairForbidden === true));
});

test('metadata existing writer revalidates late capability, window and canonical profile inside its leased publication callback', async (t) => {
  for (const kind of ['capability', 'window', 'profile']) await t.test(kind, async (t) => {
    const h = await metadataTransactionHarness(t), before = await h.read(), commit = await fsPromises.readFile(h.commitPath, 'utf8');
    let observed = 0, changedManifest;
    h.unit.observePublish(async () => {
      observed++;
      assert.equal(h.ports.transactions.length, 1, 'initial Save only; actual Core metadata publication not reached yet');
      if (kind === 'capability') h.ports.capability = false;
      if (kind === 'window') h.unit.change('window');
      if (kind === 'profile') {
        const manifest = JSON.parse(await fsPromises.readFile(h.manifestPath, 'utf8'));
        manifest.bookProfile.marginLeftMm = 40;
        changedManifest = JSON.stringify(manifest, null, 2);
        await fsPromises.writeFile(h.manifestPath, changedManifest);
      }
    });
    const result = await h.update('late change must refuse');
    assert.equal(observed, 1, 'existing commitWriterProjectSnapshot invokes the actual callback under its lease');
    assert.equal(result.ok, false);
    assert.match(result.code, /METADATA_UPDATE_(?:CAPABILITY_DENIED|CONTEXT_STALE|TARGET_STALE)/u);
    assert.equal(await h.read(), before); assert.equal(await fsPromises.readFile(h.commitPath, 'utf8'), commit);
    if (changedManifest) assert.equal(await fsPromises.readFile(h.manifestPath, 'utf8'), changedManifest);
  });
});

test('metadata completed transaction with a later foreign session preserves the effect without publishing into that session', async (t) => {
  const h = await metadataTransactionHarness(t), oldDigest = h.commit().sceneDigest;
  await h.working(h.snapshot().content.replace('Привет', 'Unsaved body'), 2);
  const before = h.unit.state(), sent = h.ports.sent.length;
  let switched = 0;
  h.ports.fsHook = (key, args) => {
    if (key === 'readFile' && args[0] === h.commitPath && !switched && h.commit().sceneDigest !== oldDigest) {
      switched++; h.unit.change('session');
    }
  };
  const result = await h.update('committed before session changed');
  assert.equal(switched, 1, 'race occurs only after real new commit publication');
  assert.equal(result.ok, false); assert.equal(result.code, 'E_METADATA_UPDATE_CONTEXT_STALE');
  assert.equal(result.details.committed, true);
  assert.equal(result.details.contentHashAfter, sha256(await h.read()));
  assert.equal(h.commit().sceneDigest, sha256(await h.read()));
  assert.equal(h.unit.state().session, 'foreign');
  assert.deepEqual({ ...h.unit.state(), session: before.session }, before);
  assert.equal(h.ports.sent.slice(sent).some(([id]) => id === 'set-dirty'), false);
});

test('metadata updates a genuine inactive scene without rebinding or acknowledging the active working buffer', async (t) => {
  const h = await metadataTransactionHarness(t), beta = path.join(path.dirname(h.file), '02_Beta.txt');
  await fsPromises.writeFile(beta, await h.read());
  await h.main.buildProjectTreeRootsWithIdentities('Metadata Tx');
  const identity = await h.main.getProjectDocumentIdentityPayload(beta);
  await h.working(h.snapshot().content.replace('Привет', 'Unsaved Alpha'), 2);
  const before = { raw: await h.read(), commit: await fsPromises.readFile(h.commitPath, 'utf8'), state: h.unit.state(), sent: h.ports.sent.length };
  const result = await h.main.handleMetadataUpdateCommand({ projectId: h.projectId, nodeId: identity.documentId,
    baselineHash: sha256(await fsPromises.readFile(beta, 'utf8')), metadata: { synopsis: 'Beta only', status: 'черновик', tags: {} } });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(h.envelope.parseObservablePayload(await fsPromises.readFile(beta, 'utf8')).meta.synopsis, 'Beta only');
  assert.equal(JSON.parse(await fsPromises.readFile(beta + '.wp201-commit.json', 'utf8')).sceneDigest,
    sha256(await fsPromises.readFile(beta, 'utf8')));
  assert.equal(await h.read(), before.raw); assert.equal(await fsPromises.readFile(h.commitPath, 'utf8'), before.commit);
  assert.deepEqual(h.unit.state(), before.state);
  assert.equal(h.ports.sent.slice(before.sent).some(([id]) => id === 'set-dirty' || id === 'editor:set-text'), false);
});

test('metadata receipt uses actual Core bytes with nonempty cohorts, compact V3 wire and a real Save continuation', async (t) => {
  for (const variant of ['compact', 'continuation']) await t.test(variant, async (t) => {
    const h = await metadataTransactionHarness(t, { cohorts: true });
    const bookmarks = require('../../src/core/word-user-bookmarks-v1.cjs');
    if (variant === 'compact') {
      const raw = await h.read(), match = /\[doc-v2 length=(\d+)\]\n([\s\S]*)$/u.exec(raw);
      const newline = match[2].indexOf('\n');
      const wire = match[2].slice(0, newline + 1) + JSON.stringify(JSON.parse(match[2].slice(newline + 1)));
      const compact = raw.slice(0, match.index) + `[doc-v2 length=${wire.length}]\n${wire}`;
      assert.equal(h.envelope.parseObservablePayload(compact).issue, null);
      assert.equal((await h.unit.fixtureRawCommit(compact)).success, true, 'real Core/leased-authority valid baseline');
      assert.equal(h.commit().sceneDigest, sha256(compact));
    } else {
      const parsed = h.envelope.parseObservablePayload(await h.read());
      parsed.doc.content[0].content[0].text = 'X' + parsed.doc.content[0].content[0].text;
      await h.working(h.envelope.composeObservablePayload({ ...parsed, metaEnabled: parsed.hasMetaBlock }), 2);
      const priorDigest = h.commit().sceneDigest; let newer = 0;
      h.ports.fsHook = async (key, args) => {
        if (key === 'readFile' && args[0] === h.commitPath && !newer && h.commit().sceneDigest !== priorDigest) {
          newer++;
          const pending = h.envelope.parseObservablePayload(h.snapshot().content);
          pending.doc.content[0].content[0].text += 'Y';
          await h.working(h.envelope.composeObservablePayload({ ...pending, metaEnabled: pending.hasMetaBlock }), 3);
        }
      };
      assert.equal((await h.save()).ok, false, 'newer real edit refuses the older Save acknowledgement');
      h.ports.fsHook = null;
      assert.equal(newer, 1); assert.ok(h.unit.continuation());
      assert.equal(h.unit.state().dirty, true); assert.equal(h.unit.state().generation, 3);
    }
    const before = await h.protectedState(), state = h.unit.state(), working = h.snapshot().content, sent = h.ports.sent.length;
    assert.ok(bookmarks.readRegistry(before.document));
    assert.equal(JSON.parse(before.comments).threads.length, 1);
    assert.equal(JSON.parse(before.notes).notes.length, 1);
    assert.deepEqual(before.document.attrs.privateDocumentSentinel, { retain: ['é', '🧭'] });
    const result = await h.update('Bookmark metadata only');
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.receipt.contentHashAfter, sha256(await h.read()));
    assert.equal(h.commit().sceneDigest, result.receipt.contentHashAfter);
    assert.deepEqual(await h.protectedState(), before);
    assert.deepEqual(h.unit.state(), state); assert.equal(h.snapshot().content, working);
    const next = await h.main.handleMetadataUpdateCommand({ projectId: h.projectId, nodeId: h.nodeId,
      baselineHash: result.receipt.contentHashAfter,
      metadata: { synopsis: 'Next CAS uses actual receipt', status: 'черновик', tags: { pov: 'Kira', line: 'A', place: 'Station' } } });
    assert.equal(next.ok, true, JSON.stringify(next));
    assert.equal(h.envelope.parseObservablePayload(await h.read()).meta.synopsis, 'Next CAS uses actual receipt');
    assert.equal(next.receipt.contentHashAfter, sha256(await h.read()));
    assert.equal(h.commit().sceneDigest, next.receipt.contentHashAfter);
    assert.deepEqual(await h.protectedState(), before); assert.deepEqual(h.unit.state(), state);
    assert.equal(h.snapshot().content, working);
    assert.equal(h.ports.sent.slice(sent).some(([id]) => id === 'set-dirty' || id === 'editor:set-text'), false);
  });
});


// Reuse the exact existing faithful Main host; expose only its captured public
// guarded handlers with a finite JSON IPC realm boundary, never a live app.
async function metadataReconciliationHarness(t) {
  const own = fs.readFileSync(__filename, 'utf8');
  let fixture = own.slice(own.indexOf('async function metadataTransactionHarness('), own.indexOf("test('metadata transaction preserves real committed"));
  const seam = 'return { main, unit, ports, file, root, projectRoot, manifestPath, profile, read, commit, commitPath, update, working,';
  assert.equal(fixture.split(seam).length, 2);
  fixture = fixture.replace(seam, seam + `
    bridge:(channel,id,payload)=>ports.handlers.get(channel)(event(),require('../../src/core/ipc-envelope-v1.cjs').createEnvelope(channel,id,JSON.parse(JSON.stringify(payload)))),
    workingOnly:content=>{snapshot={...snapshot,content};},`);
  const host = new Module(__filename, module);
  host.filename = __filename; host.paths = Module._nodeModulePaths(__dirname);
  host._compile(own.slice(0, own.indexOf('// Each harness'))
    + own.slice(own.indexOf('function sha256('), own.indexOf('function findNode('))
    + own.slice(own.indexOf('function metadataDeferred('), own.indexOf('function metadataControl('))
    + fixture + '\nmodule.exports=metadataTransactionHarness;', __filename);
  const h = await host.exports(t);
  const registryModule = await import('../../src/renderer/commands/registry.mjs');
  const projectModule = await import('../../src/renderer/commands/projectCommands.mjs');
  const runnerModule = await import('../../src/renderer/commands/runCommand.mjs');
  const busModule = await import('../../src/renderer/commands/commandBusGuard.mjs');
  const commands = [], queries = [], errors = [], statuses = [], timers = new Map(), ports = { queryGate: null, transform: null, commandTransform: null };
  const registry = registryModule.createCommandRegistry();
  projectModule.registerProjectCommands(registry, { electronAPI: { invokeUiCommandBridge: async (request) => {
    const result = await h.bridge('ui:command-bridge', request.commandId, request.payload);
    commands.push({ id: request.commandId, payload: request.payload, result });
    return ports.commandTransform ? ports.commandTransform(JSON.parse(JSON.stringify(result))) : result;
  } } });
  const run = runnerModule.createCommandRunner(registry, { capability: { platformId: 'node', editorMode: 'tiptap' } });
  const synopsis = metadataControl(), status = metadataControl(), pov = metadataControl(), line = metadataControl(), place = metadataControl();
  let text = '', timerId = 0;
  const statusElement = { style: {}, get textContent() { return text; }, set textContent(v) { text = v; statuses.push(v); } };
  const c = {
    currentProjectId: h.projectId, currentDocumentId: h.nodeId, currentDocumentKind: 'scene', currentDocumentTitle: 'Alpha', currentMeta: {}, metaEnabled: true,
    metaSynopsis: synopsis, metaStatus: status, metaTagPov: pov, metaTagLine: line, metaTagPlace: place,
    inspectorMetaSynopsisValue: synopsis, inspectorMetaStatusValue: status, statusElement, heldCommandStatusMessage: false,
    uiErrorMapDoc: JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/OPS/STATUS/UI_ERROR_MAP.json'), 'utf8')), UI_ERROR_MAP_SCHEMA_VERSION: 'ui-error-map.v1',
    UI_ERROR_FALLBACK_MESSAGE: 'Операция не выполнена', UI_ERROR_FALLBACK_SEVERITY: 'ERROR',
    console: { error: (v) => errors.push(v) }, isTiptapMode: true, runCommand: run, runCommandThroughBus: busModule.runCommandThroughBus, COMMAND_BUS_ROUTE: 'command.bus',
    document: { activeElement: synopsis }, metaPanel: { dataset: {}, classList: { toggle() {}, add() {} } }, inspectorEmptyState: null,
    rightInspectorTabButton: null, inspectorContextKind: null, inspectorSceneSections: [], inspectorSceneDetails: null, inspectorDocumentSummary: null,
    inspectorDocumentTypeValue: null, inspectorDetailsShowLabel: null, inspectorDetailsHideLabel: null, inspectorMetaContextValue: null,
    inspectorMetaWordCountValue: null, inspectorDocumentWordCountValue: null, inspectorMetaTagsValue: null, inspectorMetaModifiedValue: null, inspectorDocumentModifiedValue: null,
    METADATA_UPDATE_COMMAND_ID: 'cmd.project.metadata.update', METADATA_INSPECTOR_QUERY_ID: 'query.metadataInspector',
    composeObservablePayload: h.envelope.composeObservablePayload, parseObservablePayload: h.envelope.parseObservablePayload,
    ensureSelectHasOption() {}, getPlainText: () => 'Привет é 🧭', editor: null, editorPanel: null, mainContent: null,
    window: { setTimeout(fn, delay) { assert.equal(delay, 400); timers.set(++timerId, fn); return timerId; },
      clearTimeout(id) { timers.delete(id); }, electronAPI: { invokeWorkspaceQueryBridge() {} } },
    invokeWorkspaceQueryBridge: async (id, payload) => {
      let result = await h.bridge('ui:workspace-query-bridge', id, payload);
      queries.push({ id, payload: JSON.parse(JSON.stringify(payload)), result });
      const gate = ports.queryGate; ports.queryGate = null;
      if (gate) await gate.promise;
      if (ports.transform) result = ports.transform(JSON.parse(JSON.stringify(result)));
      return result;
    },
  };
  for (const name of ['clearFlowModeState', 'hideManualMapPlanWorkspace', 'hideNotesWorkspace', 'hideProjectSearchWorkspace', 'hideAuthoringSurfacesSurface',
    'setPlainText', 'updateWordCount', 'updateInspectorSnapshot', 'updateCardsList', 'showWriterHomeSurface']) c[name] = () => {};
  metadataVm.createContext(c);
  metadataVm.runInContext(metadataSection("let currentMetadataBaselineHash = '';", 'let expandedNodesByTab')
    + metadataSection('function sanitizeUiErrorMap(', 'async function invokePreloadUiCommandBridge(')
    + metadataSection('function updateStatusText(', 'function updateSaveStateText(')
    + metadataSection('function updateMetaInputs(', 'function updateMetaVisibility(')
    + metadataSection('function collapseSelection()', 'function updateMetaInputs(')
    + metadataSection('function normalizeMetadataInspectorPayload(', 'function normalizeNotesWorkspaceReadModel(')
    + metadataSection("if (metaSynopsis) {\n  metaSynopsis.addEventListener('input'", 'if (addCardButton)'), c);
  await c.refreshMetadataInspector();
  const state = () => JSON.parse(metadataVm.runInContext('JSON.stringify({baseline:currentMetadataBaselineHash,pending:metadataUpdatePending,form:metadataFormGeneration,edit:metadataEditGeneration,meta:currentMeta})', c));
  const waitFor = async (predicate) => { const deadline = performance.now() + 2500;
    while (!predicate() && performance.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 5));
    assert.ok(predicate(), 'finite real metadata barrier reached'); };
  const effect = async () => ({ raw: await h.read(), commit: await fsPromises.readFile(h.commitPath, 'utf8'),
    protected: await h.protectedState(), state: h.unit.state(), transactions: h.ports.transactions.length, pushes: h.ports.sent.length });
  const saveWorking = async () => {
    const parsed = h.envelope.parseObservablePayload(await h.read());
    h.workingOnly(h.envelope.composeObservablePayload({ ...parsed, metaEnabled: true, meta: c.currentMeta }));
    return c.dispatchUiCommand('cmd.project.save', {});
  };
  return { h, c, ports, synopsis, status, pov, line, place, commands, queries, errors, statuses, timers, state, effect, waitFor, saveWorking,
    finalStatus: () => text, flush: () => c.flushMetadataUpdate(),
    input: (value = 'Замысел é 🧭', start = 0, end = start, direction = 'none') => synopsis.input(value, start, end, direction),
    fire: () => { assert.equal(timers.size, 1); const [id, fn] = timers.entries().next().value; timers.delete(id); fn(); },
  };
}

test('metadata Save-before-debounce observes already canonical intent without a false command error or second writer', async (t) => {
  const x = await metadataReconciliationHarness(t);
  x.input(); assert.equal((await x.saveWorking()).ok, true);
  const before = await x.effect(), pending = x.state(), working = x.synopsis.value;
  await x.flush();
  assert.equal(x.commands.at(-1).result.value.code, 'E_METADATA_UPDATE_STALE', 'Main strict CAS still refused the obsolete command');
  assert.notEqual(x.finalStatus(), 'Команда завершилась с ошибкой');
  assert.match(x.finalStatus(), /Метаданные.*сохранены/u);
  assert.equal(x.errors.length, 0, 'already canonical desired intent is read-only, not a displayed command failure');
  assert.deepEqual(await x.effect(), before);
  assert.equal(x.state().baseline, sha256(before.raw));
  assert.deepEqual(x.state().meta, pending.meta); assert.equal(x.synopsis.value, working); assert.equal(x.synopsis.selectionStart, 0);
});

test('metadata reverse ordering keeps actual metadata transaction and ordinary Save successful', async (t) => {
  const x = await metadataReconciliationHarness(t);
  x.input('  Intent é 🧭  '); await x.flush();
  assert.equal(x.commands.at(-1).result.ok, true);
  assert.equal((await x.saveWorking()).ok, true);
  assert.equal(x.errors.length, 0);
  assert.equal(x.h.envelope.parseObservablePayload(await x.h.read()).meta.synopsis, 'Intent é 🧭');
  assert.equal(x.h.commit().sceneDigest, sha256(await x.h.read()));
});

test('metadata canonical equality checks every full field and never rebases a newer draft over foreign data', async (t) => {
  for (const field of ['synopsis', 'status', 'pov', 'line', 'place']) await t.test(field, async (t) => {
    const x = await metadataReconciliationHarness(t);
    x.input('  Submitted A  '); assert.equal((await x.saveWorking()).ok, true);
    const parsed = x.h.envelope.parseObservablePayload(await x.h.read());
    const metadata = JSON.parse(JSON.stringify(parsed.meta));
    if (field === 'synopsis' || field === 'status') metadata[field] = 'foreign canonical';
    else metadata.tags[field] = 'foreign canonical';
    assert.equal((await x.h.unit.fixtureRawCommit(x.h.envelope.composeObservablePayload({ ...parsed, metaEnabled: true, meta: metadata }))).success, true);
    const gate = metadataDeferred(); x.ports.queryGate = gate;
    const old = x.flush(); await x.waitFor(() => x.queries.length === 2);
    x.input('newer B remains unsaved', 3); const before = await x.effect(), baseline = x.state().baseline;
    gate.resolve(); await old;
    assert.deepEqual(await x.effect(), before);
    assert.equal(x.finalStatus(), 'Команда завершилась с ошибкой'); assert.equal(x.errors.length, 1);
    assert.equal(x.state().baseline, baseline); assert.equal(x.state().pending, true);
    assert.equal(x.synopsis.value, 'newer B remains unsaved'); assert.equal(x.synopsis.selectionStart, 3);
    assert.equal(x.timers.size, 0, 'a refused projection cannot automatically schedule B with a foreign baseline');
  });
});

test('metadata stale observation requires complete typed raw projection before canonical comparison', async (t) => {
  const malformed = {
    missingSynopsis: r => { delete r.metadata.synopsis; }, badStatus: r => { r.metadata.status = null; },
    missingPov: r => { delete r.metadata.tags.pov; }, badLine: r => { r.metadata.tags.line = 0; },
    missingPlace: r => { delete r.metadata.tags.place; }, arrayMetadata: r => { r.metadata = []; },
    arrayTags: r => { r.metadata.tags = []; }, noMetadata: r => { delete r.metadata; },
    wrongProject: r => { r.context.projectId = 'foreign'; }, wrongDocument: r => { r.context.nodeId = 'foreign'; },
    disabled: r => { r.context.metaEnabled = false; }, wrongKind: r => { r.context.kind = 'roman-section'; },
    missingTitle: r => { delete r.context.title; }, upperHash: r => { r.contentHash = 'A'.repeat(64); },
    missingHash: r => { delete r.contentHash; }, unavailable: r => { r.state = 'unavailable'; },
    failed: r => { r.ok = false; }, missingOk: r => { delete r.ok; }, arrayContext: r => { r.context = []; },
    noContext: r => { delete r.context; },
  };
  for (const [name, mutate] of Object.entries(malformed)) await t.test(name, async (t) => {
    const x = await metadataReconciliationHarness(t);
    // Empty tags are intentional: a missing field must not default to equality.
    x.c.currentMeta = { synopsis: 'A', status: 'черновик', tags: { pov: '', line: '', place: '' } };
    x.c.updateMetaInputs(false); x.input('A'); assert.equal((await x.saveWorking()).ok, true);
    const before = await x.effect(), baseline = x.state().baseline;
    x.ports.transform = r => { mutate(r); return r; };
    await x.flush();
    assert.deepEqual(await x.effect(), before); assert.equal(x.state().baseline, baseline);
    assert.equal(x.finalStatus(), 'Команда завершилась с ошибкой'); assert.equal(x.state().pending, true);
    assert.equal(x.queries.length, 2); assert.equal(x.timers.size, 0); assert.equal(x.errors.length, 1);
  });
});

test('metadata reconciliation read errors retain actual refusal and working CAS without another write', async (t) => {
  for (const failure of ['null', 'throw']) await t.test(failure, async (t) => {
    const x = await metadataReconciliationHarness(t);
    x.input(); await x.saveWorking(); const before = await x.effect(), baseline = x.state().baseline;
    x.ports.transform = () => { if (failure === 'throw') throw Error('owned query unavailable'); return null; };
    await x.flush();
    assert.deepEqual(await x.effect(), before); assert.equal(x.state().baseline, baseline);
    assert.equal(x.synopsis.value, 'Замысел é 🧭'); assert.equal(x.finalStatus(), 'Команда завершилась с ошибкой');
  });
});

test('metadata newer B uses observed canonical A baseline through a real second strict CAS transaction', async (t) => {
  const x = await metadataReconciliationHarness(t);
  x.input('  A é 🧭  '); await x.saveWorking();
  const gate = metadataDeferred(); x.ports.queryGate = gate;
  const a = x.flush(); await x.waitFor(() => x.queries.length === 2);
  const before = await x.effect();
  x.input('  B é 🧭  ', 2); const pending = x.state(); x.fire();
  await new Promise(setImmediate); assert.equal(x.commands.filter(c => c.id === 'cmd.project.metadata.update').length, 1);
  gate.resolve(); await a;
  assert.deepEqual(await x.effect(), before, 'readback adds no transaction, save acknowledgement or dirty clear');
  assert.equal(x.state().baseline, sha256(before.raw)); assert.equal(x.state().pending, true);
  assert.equal(x.synopsis.value, '  B é 🧭  '); assert.equal(x.synopsis.selectionStart, 2);
  assert.deepEqual(x.state().meta, pending.meta); assert.equal(x.statuses.includes('Метаданные сохранены'), false, 'A never acknowledges B');
  assert.equal(x.timers.size, 1); x.fire();
  await x.waitFor(() => x.commands.filter(c => c.id === 'cmd.project.metadata.update').length === 2 && x.state().pending === false && x.finalStatus() === 'Метаданные сохранены');
  const actual = await x.h.read(), command = x.commands.at(-1);
  assert.equal(command.result.ok, true); assert.equal(command.payload.baselineHash, sha256(before.raw));
  assert.equal(x.h.envelope.parseObservablePayload(actual).meta.synopsis, 'B é 🧭');
  assert.equal(x.h.commit().sceneDigest, sha256(actual)); assert.equal(x.state().baseline, sha256(actual));
  assert.equal(x.h.ports.transactions.length, before.transactions + 1);
  assert.deepEqual(x.h.unit.state(), before.state); assert.deepEqual(await x.h.protectedState(), before.protected);
  assert.equal(x.errors.length, 0); assert.equal(x.synopsis.value, '  B é 🧭  ');
});

test('metadata observation refuses stale form, context, away-back and later query publication', async (t) => {
  for (const change of ['same IDs incoming', 'away back', 'project', 'document', 'later query']) await t.test(change, async (t) => {
    const x = await metadataReconciliationHarness(t);
    x.input('old A'); await x.saveWorking();
    const gate = metadataDeferred(); x.ports.queryGate = gate;
    const old = x.flush(); await x.waitFor(() => x.queries.length === 2);
    if (change === 'later query') await x.c.refreshMetadataInspector();
    else {
      if (change === 'away back') x.c.collapseSelection();
      if (change === 'project') x.c.currentProjectId = 'foreign project';
      if (change === 'document') x.c.currentDocumentId = 'foreign document';
      if (change === 'same IDs incoming' || change === 'away back') {
        const parsed = x.h.envelope.parseObservablePayload(await x.h.read());
        const incoming = { ...parsed.meta, synopsis: 'New canonical payload' };
        assert.equal((await x.h.unit.fixtureRawCommit(x.h.envelope.composeObservablePayload({ ...parsed, metaEnabled: true, meta: incoming }))).success, true);
        x.c.currentMeta = incoming; x.c.metaEnabled = true;
      }
      x.c.updateMetaInputs(false);
      if (change === 'same IDs incoming' || change === 'away back') await x.c.refreshMetadataInspector();
    }
    const before = x.state(), statuses = [...x.statuses], effect = await x.effect(), value = x.synopsis.value;
    gate.resolve(); await old;
    assert.deepEqual(x.state(), before); assert.deepEqual(x.statuses, statuses); assert.deepEqual(await x.effect(), effect);
    assert.equal(x.synopsis.value, value); assert.equal(x.errors.length, 0);
    if (change === 'same IDs incoming' || change === 'away back') assert.equal(value, 'New canonical payload');
  });
});

test('metadata private deferral does not silence other typed failures or unrelated command errors', async (t) => {
  const x = await metadataReconciliationHarness(t);
  x.input(); await x.saveWorking();
  x.ports.commandTransform = result => ({ ...result, value: { ...result.value, reason: 'METADATA_OTHER_FAILURE' } });
  const before = await x.effect(); await x.flush();
  assert.equal(x.errors.length, 1); assert.equal(x.finalStatus(), 'Команда завершилась с ошибкой');
  assert.deepEqual(await x.effect(), before);
  const result = await x.c.dispatchUiCommand('cmd.not.registered', {}, { deferMetadataError: true });
  assert.equal(result.ok, false); assert.equal(x.errors.length, 2); assert.ok(x.finalStatus());
  // Consume the actual dispatcher and bus with finite typed runner errors;
  // these are error-presentation ports, never Main/Kernel decisions or writes.
  const stale = { code: 'E_COMMAND_FAILED', op: 'cmd.project.metadata.update', reason: 'METADATA_UPDATE_STALE_CONTEXT' };
  const cases = [
    ['cmd.project.save', stale],
    ['cmd.project.metadata.update', { ...stale, code: 'E_IO_WRITE' }],
    ['cmd.project.metadata.update', { ...stale, op: 'cmd.project.save' }],
    ['cmd.project.metadata.update', { ...stale, reason: 'METADATA_UPDATE_UNSUPPORTED' }],
  ];
  for (const [id, error] of cases) {
    x.c.runCommand = async () => ({ ok: false, error });
    const count = x.errors.length;
    const refusal = await x.c.dispatchUiCommand(id, {}, { deferMetadataError: true });
    assert.equal(refusal.ok, false); assert.deepEqual(refusal.error, error);
    assert.equal(x.c.statusElement.style.visibility, 'visible'); assert.ok(x.finalStatus());
    assert.equal(x.c.heldCommandStatusMessage, true);
    assert.equal(x.errors.length, count + (x.c.mapCommandErrorToUi(error).severity === 'ERROR' ? 1 : 0));
  }
  assert.deepEqual(await x.effect(), before);
});
