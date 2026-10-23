const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const profile = require('../../src/core/writer-local-profile-v1.cjs');
const productRegistry = require('../../src/shared/productCommandRegistry.cjs');
const workspaceRegistry = require('../../src/shared/workspaceQueryRegistry.cjs');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('WP307 optional domain and query cut remains exhaustive against live registries', () => {
  const optionalDomains = new Set(profile.OPTIONAL_PRODUCT_DOMAINS);
  for (const record of productRegistry.PRODUCT_COMMAND_RECORDS) {
    assert.equal(optionalDomains.has(record.domain), true, `${record.id} escaped WRITER_LOCAL_V1`);
  }

  const optionalQueryIds = new Set(profile.OPTIONAL_QUERY_IDS);
  for (const record of workspaceRegistry.WORKSPACE_QUERY_RECORDS) {
    const optional = record.owner !== 'main'
      || record.id === workspaceRegistry.WORKSPACE_QUERY_IDS.COLLAB_SCOPE_LOCAL
      || record.id === workspaceRegistry.WORKSPACE_QUERY_IDS.STAGE10_PRODUCT_STATE;
    assert.equal(optionalQueryIds.has(record.id), optional, record.id);
  }
});

test('WP307 main revalidates profile before command/query dispatch and package load', () => {
  const source = read('src/main.js');
  const profileSource = read('src/core/writer-local-profile-v1.cjs');
  for (const token of [
    "require('./core/writer-local-profile-v1.cjs')",
    'profile: getWriterLocalRuntimeProfile(),',
    'evaluateWriterLocalCommandAccess({',
    'evaluateWriterLocalQueryAccess({',
    'function dispatchMenuCommand(commandId, payload = {}, options = {}) {',
    'if (getWriterLocalRuntimeProfile().active) return false;',
    'PRODUCT_PROFILE: writerLocalProfile.profileId,',
    'isPackaged: app.isPackaged === true,',
    'platform: process.platform,',
  ]) {
    assert.equal(source.includes(token), true, token);
  }
  assert.doesNotMatch(source, /WRITER_LOCAL_V1.*process\.env/u);
  assert.doesNotMatch(profileSource, /process\.env/u);
  for (const commandId of [
    'cmd.project.review.openComments',
    'cmd.project.review.exportDocxReviewPacket',
    'cmd.project.review.exportFullManuscriptDocxReviewPacket',
    'cmd.project.review.activateDocxReviewPreviewSession',
    'cmd.project.review.applyExactTextChangesBatch',
    'cmd.project.review.applyStructuralReturn',
    'cmd.project.review.inspectFormattingReturnReplay',
    'cmd.project.review.inspectStructuralReturnReplay',
    'cmd.project.review.reloadReconciledScene',
  ]) {
    assert.equal(profileSource.includes(commandId), true, commandId);
  }
});

test('WP307 C2 DOCX review roundtrip survivors are bridged by main while near matches stay profile-denied', () => {
  const source = read('src/main.js');
  const survivorIds = [
    'cmd.project.review.openComments',
    'cmd.project.review.openDocxReviewPreviewSession',
    'cmd.project.review.exportDocxReviewPacket',
    'cmd.project.review.activateDocxReviewPreviewSession',
    'cmd.project.review.applyExactTextChangesBatch',
    'cmd.project.review.applyStructuralReturn',
    'cmd.project.review.inspectFormattingReturnReplay',
    'cmd.project.review.inspectStructuralReturnReplay',
    'cmd.project.review.reloadReconciledScene',
  ];
  const allowlistStart = source.indexOf('const UI_COMMAND_BRIDGE_ALLOWED_COMMAND_IDS = new Set([');
  const allowlistEnd = source.indexOf(']);', allowlistStart);
  assert.notEqual(allowlistStart, -1);
  assert.notEqual(allowlistEnd, -1);
  const allowlistSection = source.slice(allowlistStart, allowlistEnd);

  const handlersStart = source.indexOf('const MENU_COMMAND_HANDLERS = Object.freeze({');
  const handlersEnd = source.indexOf('function dispatchMenuCommand(commandId, payload = {}, options = {}) {', handlersStart);
  assert.notEqual(handlersStart, -1);
  assert.notEqual(handlersEnd, -1);
  const handlersSection = source.slice(handlersStart, handlersEnd);

  for (const commandId of survivorIds) {
    assert.equal(allowlistSection.includes(`'${commandId}'`), true, `allowlist:${commandId}`);
    assert.equal(handlersSection.includes(`'${commandId}':`), true, `handler:${commandId}`);
  }

  const active = profile.createWriterLocalProfileProjection({ isPackaged: true, platform: 'darwin' });
  for (const commandId of [
    'cmd.project.review.exportDocxReviewPacket.v2',
    'cmd.project.review.exportFullManuscriptDocxReviewPacket.extra',
    'cmd.project.review.activateDocxReviewPreviewSession.extra',
    'cmd.project.review.applyExactTextChangesBatchAll',
    'cmd.project.review.applyStructuralReturnAll',
    'cmd.project.review.applyStructuralReturn.extra',
    'cmd.project.review.applyExactTextChange',
    'cmd.project.review.exportLocalPacket',
    'cmd.project.review.applyFullManuscriptExactTextReturn',
    'cmd.project.plan.switchMode',
  ]) {
    const decision = profile.evaluateWriterLocalCommandAccess({ profile: active, commandId });
    assert.equal(decision.allowed, false, commandId);
    assert.equal(decision.reason, profile.WRITER_LOCAL_OPTIONAL_SYSTEM_DISABLED, commandId);
  }
});

test('WP307 flags projection removes optional controls from keyboard and accessibility paths', () => {
  const flags = read('src/renderer/flags.js');
  assert.match(flags, /qs\.get\('PRODUCT_PROFILE'\) === 'WRITER_LOCAL_V1'/u);
  for (const token of [
    'const applyWriterLocalPresentationCut = () => {',
    "'[data-mode=\"plan\"]'",
    "'[data-mode=\"review\"]'",
    "'[data-right-tab=\"comments\"]'",
    "'[data-right-tab=\"atlas\"]'",
    "element.setAttribute('aria-hidden', 'true');",
    "element.style.setProperty('display', 'none', 'important');",
    "document.addEventListener('DOMContentLoaded', applyWriterLocalPresentationCut, { once: true });",
  ]) {
    assert.equal(flags.includes(token), true, token);
  }
});

test('WP307 preserves its historical wording hash and follows admitted append-only successors through command palette current editor', () => {
  const editor = read('src/renderer/editor.js');
  const registry = JSON.parse(read('docs/OPS/RTK/YALKEN_INTEROP_TERMINAL_CLAIM_REGISTRY_V1.json'));
  const wp307SuccessorBytes = read('docs/OPS/R24/CORRECTIVE/WP307_EDITOR_WORDING_SUCCESSOR_V1.json');
  const wp503SuccessorBytes = read('docs/OPS/R24/CORRECTIVE/WP503_RELEASE01_WORDING_SURFACE_SUCCESSOR_V1.json');
  const wp504Successor = JSON.parse(read('docs/OPS/R24/CORRECTIVE/WP504_RELEASE01_WORDING_SURFACE_SUCCESSOR_V1.json'));
  const wp603SuccessorV2Bytes = read('docs/OPS/R24/CORRECTIVE/WP603_PACKAGED_RECOVERY_RELEASE01_WORDING_SURFACE_SUCCESSOR_V2.json');
  const wp604Successor = JSON.parse(read('docs/OPS/R24/CORRECTIVE/WP604_RELEASE01_WORDING_SURFACE_SUCCESSOR_V1.json'));
  const wp604SuccessorBytes = read('docs/OPS/R24/CORRECTIVE/WP604_RELEASE01_WORDING_SURFACE_SUCCESSOR_V1.json');
  const wp605Successor = JSON.parse(read('docs/OPS/R24/CORRECTIVE/WP605_RELEASE01_WORDING_SURFACE_SUCCESSOR_V1.json'));
  const wp605SuccessorBytes = read('docs/OPS/R24/CORRECTIVE/WP605_RELEASE01_WORDING_SURFACE_SUCCESSOR_V1.json');
  const wp606Successor = JSON.parse(read('docs/OPS/R24/CORRECTIVE/WP606_RELEASE01_WORDING_SURFACE_SUCCESSOR_V1.json'));
  const wp606SuccessorBytes = read('docs/OPS/R24/CORRECTIVE/WP606_RELEASE01_WORDING_SURFACE_SUCCESSOR_V1.json');
  const wp607Successor = JSON.parse(read('docs/OPS/R24/CORRECTIVE/WP607_RELEASE01_WORDING_SURFACE_SUCCESSOR_V1.json'));
  const wp806SuccessorBytes = read('docs/OPS/R24/CORRECTIVE/WP806_RELEASE01_WORDING_SURFACE_SUCCESSOR_V1.json');
  const wp806Successor = JSON.parse(wp806SuccessorBytes);
  const commandPaletteSuccessorBytes = read('docs/OPS/R24/CORRECTIVE/CORE_A4_COMMAND_PALETTE_VISIBLE_COMMANDS_WORDING_SURFACE_SUCCESSOR_V1.json');
  const commandPaletteSuccessor = JSON.parse(commandPaletteSuccessorBytes);
  const textSingleSceneSuccessorBytes = read('docs/OPS/R24/CORRECTIVE/TEXT_SINGLE_SCENE_C1_SOURCE_RUNTIME_WORDING_SURFACE_SUCCESSOR_V1.json');
  const textSingleSceneSuccessor = JSON.parse(textSingleSceneSuccessorBytes);
  const wp307Successor = JSON.parse(wp307SuccessorBytes);
  const wp503Successor = JSON.parse(wp503SuccessorBytes);
  const surface = registry.wordingSurfaces.find((entry) => entry.path === 'src/renderer/editor.js');
  assert.ok(surface);
  const digest = `sha256:${crypto.createHash('sha256').update(editor).digest('hex')}`;
  const bundleDigest = `sha256:${crypto.createHash('sha256').update(read('src/renderer/editor.bundle.js')).digest('hex')}`;
  assert.equal(surface.sha256, 'sha256:5d443aca3c441c831ee9a47a3e7445a836730d0c602cf95136afc76ce47af320');
  assert.equal(wp307Successor.historicalRegistry.sha256, crypto.createHash('sha256').update(read('docs/OPS/RTK/YALKEN_INTEROP_TERMINAL_CLAIM_REGISTRY_V1.json')).digest('hex'));
  assert.equal(wp307Successor.historicalRegistry.editorSourceSha256, surface.sha256);
  assert.equal(wp307Successor.successor.scope, 'WP503_READ_ONLY_ATLAS_SURFACE_RENDERER_WIRING');
  assert.equal(wp503Successor.predecessorSuccessor.sha256, crypto.createHash('sha256').update(wp307SuccessorBytes).digest('hex'));
  assert.equal(wp504Successor.predecessorSuccessor.sha256, crypto.createHash('sha256').update(wp503SuccessorBytes).digest('hex'));
  const wp504Editor = wp504Successor.surfaceOverrides.find((entry) => entry.path === 'src/renderer/editor.js');
  const wp604Editor = wp604Successor.surfaceOverrides.find((entry) => entry.path === 'src/renderer/editor.js');
  const wp605Editor = wp605Successor.surfaceOverrides.find((entry) => entry.path === 'src/renderer/editor.js');
  const wp606Editor = wp606Successor.surfaceOverrides.find((entry) => entry.path === 'src/renderer/editor.js');
  const wp607Editor = wp607Successor.surfaceOverrides.find((entry) => entry.path === 'src/renderer/editor.js');
  const wp806Editor = wp806Successor.surfaceOverrides.find((entry) => entry.path === 'src/renderer/editor.js');
  const commandPalettePredecessorEditor = commandPaletteSuccessor.predecessorSurfaceOverrides.find((entry) => entry.path === 'src/renderer/editor.js');
  const commandPaletteEditor = commandPaletteSuccessor.surfaceOverrides.find((entry) => entry.path === 'src/renderer/editor.js');
  assert.match(wp504Editor.sha256, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(wp604Successor.predecessorSuccessor.sha256, crypto.createHash('sha256').update(wp603SuccessorV2Bytes).digest('hex'));
  assert.equal(wp604Editor.sha256, 'sha256:b22ea774845b2376e1c8ecd76b2bd32878fdaa2c7b7a8e459416d8781e2ca561');
  assert.equal(wp605Successor.predecessorSuccessor.sha256, crypto.createHash('sha256').update(wp604SuccessorBytes).digest('hex'));
  assert.match(wp605Editor.sha256, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(wp606Successor.predecessorSuccessor.sha256, crypto.createHash('sha256').update(wp605SuccessorBytes).digest('hex'));
  assert.match(wp606Editor.sha256, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(wp607Successor.predecessorSuccessor.sha256, crypto.createHash('sha256').update(wp606SuccessorBytes).digest('hex'));
  assert.match(wp607Editor.sha256, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(wp806Successor.predecessorSuccessor.sha256, crypto.createHash('sha256').update(read('docs/OPS/R24/CORRECTIVE/WP805_RELEASE01_WORDING_SURFACE_SUCCESSOR_V1.json')).digest('hex'));
  assert.equal(crypto.createHash('sha256').update(wp806SuccessorBytes).digest('hex'), '4ade89239fd394817167f5e1a9a5db853fb5f68a358ab11901a27e2d0c5181d6');
  assert.equal(wp806Editor.sha256, 'sha256:655f95584fbd2c96ee99e92cd404e9599666db98eb5107d1e2ebd660777dd13a');
  assert.equal(commandPaletteSuccessor.schemaVersion, 'CORE_A4_COMMAND_PALETTE_VISIBLE_COMMANDS_WORDING_SURFACE_SUCCESSOR_V1');
  assert.equal(commandPaletteSuccessor.status, 'CURRENT_APPEND_ONLY_SUCCESSOR');
  assert.equal(commandPaletteSuccessor.predecessorSuccessor.path, 'docs/OPS/R24/CORRECTIVE/WP806_RELEASE01_WORDING_SURFACE_SUCCESSOR_V1.json');
  assert.equal(commandPaletteSuccessor.predecessorSuccessor.sha256, crypto.createHash('sha256').update(wp806SuccessorBytes).digest('hex'));
  assert.equal(commandPalettePredecessorEditor.sha256, wp806Editor.sha256);
  assert.equal(commandPaletteSuccessor.taskId, 'CORE-A4-YALKEN-PHASE02-RENDERER-COMMAND-PALETTE-VISIBILITY-001');
  assert.deepEqual(commandPaletteSuccessor.surfaceOverrides.map((entry) => entry.path), ['src/renderer/editor.js']);
  assert.equal(commandPaletteEditor.sha256, 'sha256:c6fe78e4fccd35cd9c75daedc026632f11cf2006ad0bddd0c7902b7d4a5052e6');
  assert.equal(commandPaletteSuccessor.generatedRuntimeArtifact.path, 'src/renderer/editor.bundle.js');
  assert.match(commandPaletteSuccessor.generatedRuntimeArtifact.sha256, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(commandPaletteSuccessor.authority.nonClaims.includes('NO_WP806_HISTORICAL_REWRITE'), true);
  assert.equal(commandPaletteSuccessor.authority.nonClaims.includes('NO_DOCX_COMMAND_BRIDGE_CHANGE'), true);
  assert.equal(commandPaletteSuccessor.authority.nonClaims.includes('NO_IMPORT_EXPORT_CHANGE'), true);
  assert.equal(commandPaletteSuccessor.authority.nonClaims.includes('NO_PORTABILITY_LAB_CHANGE'), true);
  assert.equal(textSingleSceneSuccessor.schemaVersion, 'TEXT_SINGLE_SCENE_C1_SOURCE_RUNTIME_WORDING_SURFACE_SUCCESSOR_V1');
  assert.equal(textSingleSceneSuccessor.status, 'CURRENT_APPEND_ONLY_SUCCESSOR');
  assert.equal(textSingleSceneSuccessor.taskId, 'TEXT_SINGLE_SCENE_C1_SOURCE_RUNTIME_PRODUCT_REPAIR');
  assert.equal(textSingleSceneSuccessor.predecessorSuccessor.path, 'docs/OPS/R24/CORRECTIVE/CORE_A4_COMMAND_PALETTE_VISIBLE_COMMANDS_WORDING_SURFACE_SUCCESSOR_V1.json');
  assert.equal(textSingleSceneSuccessor.predecessorSuccessor.sha256, crypto.createHash('sha256').update(commandPaletteSuccessorBytes).digest('hex'));
  const textSingleScenePredecessorEditor = textSingleSceneSuccessor.predecessorSurfaceOverrides.find((entry) => entry.path === 'src/renderer/editor.js');
  const textSingleSceneEditor = textSingleSceneSuccessor.surfaceOverrides.find((entry) => entry.path === 'src/renderer/editor.js');
  assert.equal(textSingleScenePredecessorEditor.sha256, commandPaletteEditor.sha256);
  assert.deepEqual(textSingleSceneSuccessor.surfaceOverrides.map((entry) => entry.path), ['src/renderer/editor.js']);
  assert.equal(textSingleSceneEditor.sha256, 'sha256:7d09958be969c60092e6dd4c4d5d97381ff8351876dae2529fe1a6a26d82fb03');
  assert.equal(textSingleSceneSuccessor.generatedRuntimeArtifact.path, 'src/renderer/editor.bundle.js');
  // Keep the historical wording successor intact. The existing C1 repair
  // qualification binds the later editor and generated bundle to actual bytes.
  assert.equal(textSingleSceneSuccessor.generatedRuntimeArtifact.sha256, 'sha256:7afd94715444f1793f5dbe631ebce894a0b355447d8d3d7d034c05a705640947');
  const dataPolicy = JSON.parse(read('docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json'));
  const repair = dataPolicy.qualifiedRuntimeRepair;
  assert.equal(repair.id, 'DOCX_IMPORT_PREVIEW_REFERENCE_REPAIR_V1');
  assert.equal(repair.bindingBaseSha, '0a45daf438c778143afad28ba02b519393a11f9b');
  const repairedBundle = repair.sourceBindings.find((entry) => entry.path === 'src/renderer/editor.bundle.js');
  assert.equal(`sha256:${repairedBundle.sha256}`, bundleDigest);
  const repairedEditors = repair.sourceBindings.filter((entry) => entry.path === 'src/renderer/editor.js');
  assert.equal(repairedEditors.length, 1);
  assert.equal(`sha256:${repairedEditors[0].sha256}`, digest);
  assert.equal(textSingleSceneSuccessor.authority.nonClaims.includes('no cell acceptance'), true);
  assert.equal(wp307Successor.programDone, false);
  assert.equal(wp503Successor.programDone, false);
  assert.equal(wp504Successor.programDone, false);
  assert.equal(wp604Successor.programDone, false);
  assert.equal(wp605Successor.programDone, false);
  assert.equal(wp606Successor.programDone, false);
  assert.equal(wp607Successor.programDone, false);
  assert.equal(wp806Successor.programDone, false);
  assert.equal(commandPaletteSuccessor.programDone, false);
  assert.equal(textSingleSceneSuccessor.programDone, false);
});

test('WP307 profile contract carries no persistence, network or external authority', () => {
  const source = read('src/core/writer-local-profile-v1.cjs');
  for (const forbidden of [
    'node:fs',
    'ipcMain',
    'ipcRenderer',
    'fetch(',
    'http://',
    'https://',
    'writeFile',
    'localStorage',
    'process.env',
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

// Actual Main under an inert Electron host: no app/renderer/native launch.
// Only the host platform is explicit so the packaged-Darwin policy is also
// exercised on non-Mac CI; Kernel, project owner, lease and filesystem are real.
async function fullMacMainFixture(t, { packaged = true, platform = 'darwin' } = {}) {
  const os = require('node:os'), Module = require('node:module');
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'yalken-full-mac-map-'));
  const marker = crypto.randomUUID(), markerPath = path.join(root, '.owner');
  fs.writeFileSync(markerPath, marker, { flag: 'wx' }); const identity = fs.lstatSync(root);
  const documents = path.join(root, 'Documents'), userData = path.join(root, 'userData');
  fs.mkdirSync(path.join(documents, 'craftsman'), { recursive: true }); fs.mkdirSync(userData);
  const h = { root, documents, userData, handlers: new Map(), listeners: new Map(), sent: [], shellUrl: '', editor: { content: '', generation: 0 } };
  function InertWindow(options = {}) {
    if (options.webPreferences?.javascript === false) {
      // Finite print effect, NOT physical Electron/PDF acceptance. The real
      // renderPdfBufferFromHtml owns this window and all security options.
      h.printCalls = (h.printCalls || 0) + 1; h.printOptions = options;
      this.webContents = { on() {}, setWindowOpenHandler() {}, printToPDF: async options => {
        h.pdfOptions = options; return h.print ? h.print() : finiteManualMapPdf();
      } };
      this.loadURL = async url => { h.printHtml = decodeURIComponent(url.split(',').slice(1).join(',')); };
      this.isDestroyed = () => false; this.destroy = () => { h.printDestroyed = true; }; return;
    }
    h.window = this; this.isDestroyed = () => false; this.on = () => {};
    this.webContents = { id: 713, session: {}, isDestroyed: () => false, on() {}, setWindowOpenHandler() {},
      getURL: () => h.shellUrl, send: (channel, payload) => {
        h.sent.push([channel, payload]);
        if (channel === 'editor:set-text') h.editor = { ...payload, generation: 0 };
        if (channel === 'editor:snapshot-request') queueMicrotask(() => h.listeners.get('editor:snapshot-response')(
          h.event(), { requestId: payload.requestId, snapshot: h.editor }));
      } };
    this.loadFile = (file, { query }) => {
      const url = require('node:url').pathToFileURL(file);
      for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
      h.shellUrl = url.href; return new Promise(() => {}); // No renderer/startup.
    };
  }
  InertWindow.getAllWindows = () => [h.window]; InertWindow.getFocusedWindow = () => h.window;
  const electron = { app: { isPackaged: packaged, whenReady: () => new Promise(() => {}), on() {}, setPath() {},
    getPath: key => key === 'documents' ? documents : key === 'userData' ? userData : root,
    quit() {}, exit() {}, setName() {}, requestSingleInstanceLock: () => true }, BrowserWindow: InertWindow,
    screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1280, height: 800 } }) },
    Menu: { buildFromTemplate: () => ({}), setApplicationMenu() {} },
    dialog: { showMessageBox: async () => ({ response: 0 }), showOpenDialog: async () => ({ canceled: true }),
      showSaveDialog: async () => ({ canceled: true }) },
    ipcMain: { on: (name, handler) => h.listeners.set(name, handler), handle: (name, handler) => h.handlers.set(name, handler) },
    session: { defaultSession: { webRequest: { onHeadersReceived() {} } } } };
  const mainPath = path.join(ROOT, 'src/main.js'), filePath = path.join(ROOT, 'src/utils/fileManager.js');
  h.dialog = electron.dialog;
  const originalLoad = Module._load; delete require.cache[filePath];
  try {
    Module._load = function(request, ...args) {
      if (request === 'electron') return electron;
      const loaded = originalLoad.call(this, request, ...args);
      if (request !== './main/projectArchiveDarwinPublication.cjs') return loaded;
      return { ...loaded, createDarwinExclusiveFilePublisher: options => {
        const current = () => h.filePublication || loaded.createDarwinExclusiveFilePublisher({ ...options, helperPath: h.helperPath });
        const publish = input => current()(input); publish.assertAvailable = input => current().assertAvailable(input); return publish;
      } };
    };
    const compiled = new Module(mainPath, module); compiled.filename = mainPath;
    compiled.paths = Module._nodeModulePaths(path.dirname(mainPath));
    const host = `const process = new Proxy(global.process, {get(t,k){return k==='platform'?${JSON.stringify(platform)}:Reflect.get(t,k)}});\n`;
    compiled._compile(host + read('src/main.js') + `\nmodule.exports.__profile = () => getWriterLocalRuntimeProfile();
      module.exports.__host = {
        revokeOwner() { activeStage10ApplicationBootstrap = null; },
        invalidateSession() { commentAuthoringSessionId = crypto.randomUUID(); },
        invalidateGeneration() { lastSignaledEditGeneration += 1; },
        afterCoreBinding(callback) { const build = buildProductCoreStateForCurrentProject; let armed = true;
          buildProductCoreStateForCurrentProject = async (...args) => { const result = await build(...args);
            if (armed) { armed = false; await callback(result); } return result; }; },
        denyCapability() { const read = readAuthorityCapabilityMatrixDoc; readAuthorityCapabilityMatrixDoc = () => {
          const matrix = read(); matrix.items.find(row => row.platformId === 'node').capabilities['cap.manualMap.edit'] = false; return matrix; }; },
        afterTruth(callback) { const prepare = prepareCanonicalProjectTruthCommand; prepareCanonicalProjectTruthCommand = async (...args) => {
          const result = await prepare(...args); await callback(); return result; }; }
      };`, mainPath);
    h.main = compiled.exports; h.main.createWindow();
    const manager = require(filePath), previous = manager.getDocumentsPath;
    manager.getDocumentsPath = () => path.join(documents, 'craftsman');
    t.after(() => { manager.getDocumentsPath = previous; delete require.cache[filePath]; });
  } finally { Module._load = originalLoad; }
  t.after(() => {
    const now = fs.lstatSync(root); assert.equal(now.dev, identity.dev); assert.equal(now.ino, identity.ino);
    assert.equal(fs.readFileSync(markerPath, 'utf8'), marker); fs.rmSync(root, { recursive: true });
  });
  h.event = () => ({ sender: h.window.webContents, senderFrame: { url: h.shellUrl } });
  h.command = async (id, payload, event = h.event()) => h.handlers.get('ui:command-bridge')(event,
    require('../../src/core/ipc-envelope-v1.cjs').createEnvelope('ui:command-bridge', id, payload));
  h.query = (id, payload = {}) => h.handlers.get('ui:workspace-query-bridge')(h.event(),
    require('../../src/core/ipc-envelope-v1.cjs').createEnvelope('ui:workspace-query-bridge', id, payload));
  h.roster = () => { const rows = []; function visit(dir) { for (const name of fs.readdirSync(dir).sort()) {
    const file = path.join(dir, name), s = fs.lstatSync(file); assert.equal(s.isSymbolicLink(), false);
    rows.push([path.relative(documents, file), s.isDirectory() ? 'directory' : crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]);
    if (s.isDirectory()) visit(file);
  } } visit(documents); return rows; };
  return h;
}

function finiteManualMapPdf() {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>', '<< /Length 0 >>\nstream\n\nendstream'];
  let text = '%PDF-1.7\n%\xff\xfe\xfd\xfc\n'; const offsets = [0];
  objects.forEach((body, i) => { offsets.push(Buffer.byteLength(text, 'latin1')); text += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = Buffer.byteLength(text, 'latin1');
  text += `xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(text, 'latin1');
}

function fullMacPdfPublication(h) {
  if (process.platform === 'darwin') {
    h.helperPath = path.join(h.root, 'project-archive-fs');
    require('../../scripts/build-project-archive-native.cjs').buildProjectArchiveNative({ outputPath: h.helperPath });
  } else {
    h.filePublication = async ({ sourcePath, targetPath, assertCurrent }) => {
      await assertCurrent(); await fs.promises.copyFile(sourcePath, targetPath, fs.constants.COPYFILE_EXCL);
    };
    h.filePublication.assertAvailable = async ({ assertCurrent }) => { await assertCurrent(); return { available: true, readOnly: true }; };
  }
}

async function fullMacRendererCommandPort(h, { allowUnregistered = false } = {}) {
  const vm = require('node:vm');
  const registryModule = await import('../../src/renderer/commands/registry.mjs');
  const projectModule = await import('../../src/renderer/commands/projectCommands.mjs');
  const runnerModule = await import('../../src/renderer/commands/runCommand.mjs');
  const busModule = await import('../../src/renderer/commands/commandBusGuard.mjs');
  const registry = registryModule.createCommandRegistry(); let last;
  // Finite IPC transport uses the real envelope/Main fixture; no renderer
  // normalization, registry, capability runner or command bus is replaced.
  projectModule.registerProjectCommands(registry, { electronAPI: { invokeUiCommandBridge: async request => {
    const mainResult = await h.command(request.commandId, structuredClone(request.payload));
    last = { request, mainResult }; return mainResult;
  } } });
  const context = { isTiptapMode: true, COMMAND_BUS_ROUTE: 'command.bus',
    runCommandThroughBus: busModule.runCommandThroughBus,
    runCommand: runnerModule.createCommandRunner(registry, { capability: { platformId: 'node', editorMode: 'tiptap' } }),
    updateStatusText() {}, mapCommandErrorToUi: error => ({ userMessage: error.reason, severity: 'INFO' }) };
  const editor = read('src/renderer/editor.js');
  const actual = name => {
    const start = editor.indexOf((name === 'dispatchUiCommand' ? 'async ' : '') + 'function ' + name + '(');
    const end = editor.indexOf('\n}\n', start); assert.ok(start >= 0 && end > start, name);
    return editor.slice(start, end + 2);
  };
  vm.createContext(context); vm.runInContext(actual('withEditorModeCommandPayload') + '\n' + actual('dispatchUiCommand'), context);
  return async (id, payload, tiptap = true) => {
    context.isTiptapMode = tiptap; last = null;
    const result = await context.dispatchUiCommand(id, payload);
    if (allowUnregistered && !last) return { request: null, mainResult: null, result };
    assert.ok(last, 'actual renderer registry/runner/bus must reach Main');
    assert.equal(result.ok, last.mainResult.ok, 'renderer result must agree with Main');
    return { ...last, result };
  };
}

test('full Mac actual guarded Main admits FREE map create add and queries under the ordinary project owner', async t => {
  const h = await fullMacMainFixture(t);
  const created = await h.main.handleProjectLifecycleCreateCommand({ projectName: 'Full Mac Map' });
  assert.equal(created.ok, true, JSON.stringify(created)); assert.equal(created.stage10Bootstrap.productLifecycleReachable, true);
  const projectRoot = path.join(h.documents, 'craftsman', 'Full Mac Map');
  const manifestPath = path.join(projectRoot, 'project.craftsman.json');
  const originalManifest = JSON.parse(fs.readFileSync(manifestPath));
  const before = h.roster(), projectId = created.projectId;
  const create = await h.command('manualMap.create', { projectId, mapId: 'map-full-mac', title: 'Карта e\u0301 🧭' });
  const add = await h.command('manualMap.node.add', { projectId, mapId: 'map-full-mac', nodeId: 'node-full-mac', label: 'Узел', nodeKind: 'note' });
  const currentScene = await h.query('query.atlasCurrentScene', { projectId });
  const workbench = await h.query('query.manualMapWorkbench', { projectId, mapId: 'map-full-mac' });
  t.diagnostic('FULL_MAC_ACTUAL_MAIN ' + JSON.stringify({ profile: h.main.__profile(), create, add, currentScene, workbench,
    before, after: h.roster(), manifest: JSON.parse(fs.readFileSync(manifestPath)) }));
  assert.equal(create.ok, true, JSON.stringify(create)); assert.equal(add.ok, true, JSON.stringify(add));
  assert.equal(currentScene.ok, true, JSON.stringify(currentScene)); assert.equal(workbench.ok, true, JSON.stringify(workbench));
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  assert.equal(manifest.manualMaps.schemaVersion, 'manualMap.author.v1');
  assert.equal(manifest.manualMaps.maps['map-full-mac'].nodes['node-full-mac'].label, 'Узел');
  const protectedManifest = { ...manifest }; delete protectedManifest.manualMaps; delete protectedManifest.lastCommandId;
  assert.deepEqual(protectedManifest, originalManifest);
  for (const row of before.filter(([name]) => !name.includes('/.stage10-local') && !name.endsWith('/project.craftsman.json')))
    assert.deepEqual(h.roster().find(([name]) => name === row[0]), row, row[0]);
  assert.equal(workbench.manualMapWorkbench.graph.nodes[0].label, 'Узел');
  assert.equal(workbench.manualMapWorkbench.listParity.rows[0].itemId, 'node-full-mac');
  const reopened = await h.main.handleProjectLifecycleOpenCommand({ projectId });
  assert.equal(reopened.ok, true, JSON.stringify(reopened));
  assert.deepEqual(JSON.parse(fs.readFileSync(manifestPath)).manualMaps, manifest.manualMaps);
  assert.equal((await h.query('query.manualMapWorkbench', { projectId })).manualMapWorkbench.graph.nodes[0].id, 'node-full-mac');
});

test('full Mac actual Main keeps profile caller entitlement and optional refusals before effects', async t => {
  const h = await fullMacMainFixture(t), before = h.roster();
  assert.equal(h.main.__profile().profileId, 'WRITER_LOCAL_MANUAL_MAP_V4');
  assert.equal(new URL(h.shellUrl).searchParams.get('PRODUCT_PROFILE'), 'WRITER_LOCAL_MANUAL_MAP_V4');
  const unselected = ['atlas', 'idea', 'meaning', 'blackBox', 'stage10'].map(domain =>
    productRegistry.PRODUCT_COMMAND_RECORDS.find(row => row.domain === domain && !['manualMap.create', 'manualMap.node.add'].includes(row.id)).id);
  for (const id of unselected) {
    const result = await h.command(id, { projectId: 'forged', profileId: 'WRITER_LOCAL_ATLAS_V2', tier: 'pro', optionalSystemsEnabled: true });
    assert.equal(result.ok, false, id); assert.equal(result.reason, 'WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED', JSON.stringify(result));
  }
  for (const id of ['query.collabScopeLocal', 'query.stage10ProductState', 'query.atlasOverview', 'query.projectionInspector'])
    assert.equal((await h.query(id)).error, 'WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED', id);
  for (const id of ['manualMap.create.extra', ' manualMap.create', 'manualMap.node.add ']) assert.equal((await h.command(id, {})).ok, false, id);
  for (const id of ['query.atlasCurrentScene.extra', 'query.manualMapWorkbench ']) assert.equal((await h.query(id)).ok, false, id);
  const event = h.event();
  for (const forged of [{ ...event, sender: { ...event.sender, id: 999 } }, { ...event, sender: { ...event.sender, session: {} } },
    { ...event, senderFrame: { url: h.shellUrl.replace('WRITER_LOCAL_MANUAL_MAP_V4', 'WRITER_LOCAL_V1') } }])
    await assert.rejects(h.command('manualMap.create', {}, forged), /E_IPC_/u);
  assert.deepEqual(h.roster(), before);
  const source = await fullMacMainFixture(t, { packaged: false });
  const unentitled = await source.command('cmd.project.review.applyExactTextChange', { tier: 'pro', profileId: 'WRITER_LOCAL_ATLAS_V2' });
  assert.equal(unentitled.ok, false); assert.equal(unentitled.value.code, 'E_COMMAND_DISABLED_FOR_ENTITLEMENT');
  assert.equal(source.main.__profile().active, false);
  const forged = source.event(); forged.senderFrame.url = source.shellUrl.replace('PRODUCT_PROFILE=', 'PRODUCT_PROFILE=WRITER_LOCAL_ATLAS_V2');
  await assert.rejects(source.command('manualMap.create', {}, forged), /E_IPC_/u);
});

test('full Mac actual Main consumes current project capability owner and source revision at commit', async t => {
  for (const fault of ['foreign-project', 'capability', 'owner', 'revision']) await t.test(fault, async t => {
    const h = await fullMacMainFixture(t);
    let expected, manifestPath, exercised = fault !== 'revision';
    // Install before bootstrap captures the actual prepare function. Installing
    // after Create would leave the transparent observer outside the real port.
    if (fault === 'revision') h.main.__host.afterTruth(async () => {
      const next = JSON.parse(expected); next.foreignRevisionMarker = 'preserve-newer'; next.lastCommandId = 77;
      expected = Buffer.from(JSON.stringify(next)); fs.writeFileSync(manifestPath, expected); exercised = true;
    });
    const created = await h.main.handleProjectLifecycleCreateCommand({ projectName: 'Guarded Map' }); assert.equal(created.ok, true);
    manifestPath = path.join(h.documents, 'craftsman', 'Guarded Map', 'project.craftsman.json');
    expected = fs.readFileSync(manifestPath);
    if (fault === 'capability') h.main.__host.denyCapability();
    if (fault === 'owner') h.main.__host.revokeOwner();
    const result = await h.command('manualMap.create', { projectId: fault === 'foreign-project' ? 'foreign' : created.projectId,
      mapId: 'must-not-publish', title: 'Refused' });
    t.diagnostic(JSON.stringify({ fault, result })); assert.equal(exercised, true);
    assert.equal(result.ok, false, JSON.stringify(result)); assert.equal(fs.readFileSync(manifestPath).equals(expected), true);
    assert.equal(JSON.parse(expected).manualMaps, undefined);
  });
});

test('full Mac flags preserve the old cut and expose only the existing Atlas tab for the new hint', () => {
  const vm = require('node:vm'), selectors = ['[data-mode="plan"]', '[data-mode="review"]', '[data-right-tab="comments"]',
    '[data-right-tab="atlas"]', '[data-toolbar-item-key="review-comment"]', '[data-atlas-reachability-opener]'];
  for (const id of ['WRITER_LOCAL_V1', 'WRITER_LOCAL_ATLAS_V2', 'WRITER_LOCAL_MANUAL_MAP_V3', 'WRITER_LOCAL_MANUAL_MAP_V4', 'WRITER_LOCAL_MANUAL_MAP_V4.extra', 'WRITER_LOCAL_ATLAS_V2.extra', '']) {
    const elements = Object.fromEntries(selectors.map(selector => [selector, { hidden: false, disabled: false, tabIndex: 0,
      attrs: {}, style: { setProperty(name, value, priority) { this[name] = [value, priority]; } },
      setAttribute(name, value) { this.attrs[name] = value; } }]));
    const callbacks = [], window = { location: { search: '?USE_TIPTAP=1&PRODUCT_PROFILE=' + id } };
    const document = { body: { dataset: {} }, querySelectorAll: selector => selector.split(',').map(key => elements[key]),
      addEventListener: (name, callback) => callbacks.push(callback) };
    vm.runInNewContext(read('src/renderer/flags.js'), { window, document, URLSearchParams, console: { log() {} } });
    callbacks.forEach(callback => callback());
    for (const selector of selectors) {
      const hidden = id === 'WRITER_LOCAL_V1' || ['WRITER_LOCAL_ATLAS_V2', 'WRITER_LOCAL_MANUAL_MAP_V3', 'WRITER_LOCAL_MANUAL_MAP_V4'].includes(id) && selector !== '[data-right-tab="atlas"]';
      assert.equal(elements[selector].hidden, hidden, id + selector); assert.equal(elements[selector].disabled, hidden);
      assert.equal(elements[selector].tabIndex, hidden ? -1 : 0);
      if (hidden) { assert.equal(elements[selector].attrs['aria-hidden'], 'true'); assert.deepEqual(elements[selector].style.display, ['none', 'important']); }
    }
    assert.equal(window.__PRODUCT_PROFILE, ['WRITER_LOCAL_V1', 'WRITER_LOCAL_ATLAS_V2', 'WRITER_LOCAL_MANUAL_MAP_V3', 'WRITER_LOCAL_MANUAL_MAP_V4'].includes(id) ? id : '');
  }
});

test('manual-map authoring actual packaged Main updates an explicitly selected node without touching manuscript', async t => {
  const h = await fullMacMainFixture(t);
  const created = await h.main.handleProjectLifecycleCreateCommand({ projectName: 'Manual authoring RED' });
  assert.equal(created.ok, true);
  const payload = { projectId: created.projectId, mapId: 'map-a' };
  assert.equal((await h.command('manualMap.create', { ...payload, title: 'Map A' })).ok, true);
  assert.equal((await h.command('manualMap.node.add', { ...payload, nodeId: 'a', label: 'Before' })).ok, true);
  const manifestPath = path.join(h.documents, 'craftsman', 'Manual authoring RED', 'project.craftsman.json');
  const before = JSON.parse(fs.readFileSync(manifestPath));
  const changed = await h.command('manualMap.node.update', { ...payload, nodeId: 'a', label: 'После e\u0301 🧭' });
  assert.equal(changed.ok, true, JSON.stringify(changed));
  const after = JSON.parse(fs.readFileSync(manifestPath));
  assert.equal(after.manualMaps.maps['map-a'].nodes.a.label, 'После e\u0301 🧭');
  for (const value of [before, after]) { delete value.manualMaps; delete value.lastCommandId; }
  assert.deepEqual(after, before);
});

test('manual-map authoring actual Main executes all sixteen commands with real Core and Stage10 persistence', async t => {
  const h = await fullMacMainFixture(t), executed = new Set();
  const uiCommand = await fullMacRendererCommandPort(h);
  if (process.platform === 'darwin') {
    h.helperPath = path.join(h.root, 'project-archive-fs');
    const built = require('../../scripts/build-project-archive-native.cjs').buildProjectArchiveNative({ outputPath: h.helperPath });
    t.diagnostic('ACTUAL_DARWIN_FILE_PUBLICATION ' + JSON.stringify(built));
  } else {
    // Finite filesystem effect boundary for non-Darwin CI only. This is Main/
    // Core/Stage10 behavior, never physical Darwin publication evidence.
    h.filePublication = async ({ sourcePath, targetPath, assertCurrent }) => {
      await assertCurrent(); await fs.promises.copyFile(sourcePath, targetPath, fs.constants.COPYFILE_EXCL);
    };
    h.filePublication.assertAvailable = async ({ assertCurrent }) => { await assertCurrent(); return { available: true, readOnly: true }; };
    t.diagnostic('FINITE_NON_DARWIN_FILE_EFFECT_NOT_PHYSICAL_PUBLICATION');
  }
  const created = await h.main.handleProjectLifecycleCreateCommand({ projectName: 'Complete manual maps' });
  assert.equal(created.ok, true);
  const projectId = created.projectId, mapId = 'map-a';
  const command = async (id, payload) => {
    const { mainResult: result, request } = await uiCommand(id, { projectId, mapId, ...payload });
    assert.equal(request.payload.editorMode, 'tiptap');
    assert.equal(result.ok, true, id + ': ' + JSON.stringify(result)); executed.add(id); return result;
  };
  const manifestPath = path.join(h.documents, 'craftsman', 'Complete manual maps', 'project.craftsman.json');
  const before = JSON.parse(fs.readFileSync(manifestPath)), roster = h.roster();
  const made = await command('manualMap.create', { title: 'Source e\u0301 🧭' });
  assert.equal(made.value.mapId, mapId);
  await command('manualMap.create', { mapId: 'map-b', title: 'Target' });
  for (const nodeId of ['a', 'b', 'c']) await command('manualMap.node.add', { nodeId, label: nodeId, nodeKind: 'note' });
  await command('manualMap.node.add', { mapId: 'map-b', nodeId: 'z', label: 'Target node' });
  await command('manualMap.node.update', { nodeId: 'a', label: 'Edited', position: { x: 30, y: 80 } });
  for (const edgeId of ['e', 'e2']) await command('manualMap.edge.add', { edgeId, fromNodeId: 'a', toNodeId: 'b', label: 'Link' });
  await command('manualMap.edge.update', { edgeId: 'e', label: 'Edited link' });
  await command('manualMap.edge.delete', { edgeId: 'e2' });
  for (const groupId of ['g', 'g2']) await command('manualMap.group.create', { groupId, label: 'Group', nodeIds: ['a', 'b'] });
  await command('manualMap.group.update', { groupId: 'g', label: 'Edited group', nodeIds: ['a', 'b'], colorTag: 'neutral' });
  await command('manualMap.group.delete', { groupId: 'g2' });
  const donor = path.join(h.root, 'reference.txt'), donorBytes = Buffer.from('Реальный reference e\u0301 🧭\n');
  fs.writeFileSync(donor, donorBytes);
  h.dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [donor] });
  await command('manualMap.attachment.add', { nodeId: 'a', attachmentId: 'att', label: 'Selected file', attachmentKind: 'reference' });
  await command('manualMap.portal.add', { portalId: 'p', fromNodeId: 'a', targetMapId: 'map-b', targetNodeId: 'z', label: 'Cross map' });
  await command('manualMap.template.apply', { templateInstanceId: 'starter', templateId: 'two', templateName: 'Two nodes',
    nodes: [{ nodeId: 't1', label: 'One' }, { nodeId: 't2', label: 'Two' }], edges: [{ edgeId: 'te', fromNodeId: 't1', toNodeId: 't2' }] });
  await command('manualMap.node.delete', { nodeId: 'c' });
  const exportedJson = path.join(h.root, 'manual-map.json'), exportedSvg = path.join(h.root, 'manual-map.svg');
  h.dialog.showSaveDialog = async (...args) => ({ canceled: false, filePath: args.at(-1).title.includes('JSON') ? exportedJson : exportedSvg });
  await command('manualMap.export.json', {}); await command('manualMap.export.imagePdf', {});
  const json = JSON.parse(fs.readFileSync(exportedJson));
  assert.equal(json.attachments[0].source.sourceHash, crypto.createHash('sha256').update(donorBytes).digest('hex'));
  assert.equal(json.attachments[0].source.byteLength, donorBytes.length);
  assert.equal(json.attachments[0].source.name, 'reference.txt'); assert.equal(json.attachments[0].source.mediaType, 'text/plain');
  assert.equal(json.attachments[0].storedContent, false); assert.equal(JSON.stringify(json).includes(h.root), false);
  assert.match(fs.readFileSync(exportedSvg, 'utf8'), /<svg/u);
  h.dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [exportedJson] });
  const imported = await command('manualMap.import.jsonRepeat', { targetMapId: 'imported', title: 'Imported' });
  assert.equal(imported.value.mapId, 'imported');
  assert.deepEqual([...executed].sort(), [...profile.WRITER_MANUAL_MAP_COMMAND_IDS].sort());
  let manifest = JSON.parse(fs.readFileSync(manifestPath));
  assert.deepEqual(manifest.manualMaps.maps['map-a'].portals.p.target, { mapId: 'map-b', nodeId: 'z' });
  assert.equal(manifest.manualMaps.maps.imported.nodes.a.label, 'Edited');
  const protectedAfter = { ...manifest }; delete protectedAfter.manualMaps; delete protectedAfter.lastCommandId;
  assert.deepEqual(protectedAfter, before);
  for (const row of roster.filter(([name]) => !name.includes('/.stage10-local') && !name.endsWith('/project.craftsman.json')))
    assert.deepEqual(h.roster().find(([name]) => name === row[0]), row, row[0]);
  assert.equal((await h.main.handleProjectLifecycleOpenCommand({ projectId })).ok, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(manifestPath)).manualMaps, manifest.manualMaps);
  const queried = await h.query('query.manualMapWorkbench', { projectId, mapId: 'map-b' });
  assert.equal(queried.manualMapWorkbench.mapId, 'map-b'); assert.equal(queried.manualMapWorkbench.mapRows.length, 3);
  const empty = await h.main.handleProjectLifecycleCreateCommand({ projectName: 'First imported map' });
  assert.equal(empty.ok, true);
  const { mainResult: first } = await uiCommand('manualMap.import.jsonRepeat', { projectId: empty.projectId, targetMapId: 'first', title: 'First' });
  assert.equal(first.ok, true, JSON.stringify(first)); assert.equal(first.value.mapId, 'first');
});

test('manual-map actual renderer transport prepares real attachments in both editor modes', async t => {
  for (const tiptap of [true, false]) await t.test(tiptap ? 'tiptap' : 'legacy', async t => {
    const h = await fullMacMainFixture(t), uiCommand = await fullMacRendererCommandPort(h);
    const created = await h.main.handleProjectLifecycleCreateCommand({ projectName: 'Transport attachment' });
    assert.equal(created.ok, true); const projectId = created.projectId, mapId = 'map';
    assert.equal((await h.command('manualMap.create', { projectId, mapId, title: 'A' })).ok, true);
    assert.equal((await h.command('manualMap.node.add', { projectId, mapId, nodeId: 'n', label: 'A' })).ok, true);
    const donor = path.join(h.root, 'reference.txt'), bytes = Buffer.from('Реальный e\u0301 🧭\n'); fs.writeFileSync(donor, bytes);
    let pickerCalls = 0; h.dialog.showOpenDialog = async () => { pickerCalls++; return { canceled: false, filePaths: [donor] }; };
    const before = h.roster(), input = { projectId, mapId, nodeId: 'n', attachmentId: 'a', label: 'Selected', attachmentKind: 'reference' };
    const { mainResult, request } = await uiCommand('manualMap.attachment.add', input, tiptap);
    t.diagnostic(JSON.stringify({ transported: request.payload, mainResult, pickerCalls, canonicalUnchanged: JSON.stringify(h.roster()) === JSON.stringify(before) }));
    assert.equal(request.payload.editorMode, tiptap ? 'tiptap' : 'legacy'); assert.equal(Object.hasOwn(input, 'editorMode'), false);
    assert.equal(mainResult.ok, true, JSON.stringify(mainResult)); assert.equal(pickerCalls, 1);
    const manifest = JSON.parse(fs.readFileSync(path.join(h.documents, 'craftsman', 'Transport attachment', 'project.craftsman.json')));
    const attachment = manifest.manualMaps.maps.map.attachments.a;
    assert.equal(attachment.source.sourceHash, crypto.createHash('sha256').update(bytes).digest('hex'));
    assert.equal(attachment.source.byteLength, bytes.length); assert.equal(attachment.storedContent, false);
    assert.equal(Object.hasOwn(attachment, 'editorMode'), false); assert.equal(JSON.stringify(attachment).includes(h.root), false);
  });
});

test('manual-map attachment transport rejects malformed mode and author authority before picker or writes', async t => {
  const h = await fullMacMainFixture(t), created = await h.main.handleProjectLifecycleCreateCommand({ projectName: 'Transport refusals' });
  assert.equal(created.ok, true); const projectId = created.projectId, mapId = 'map';
  assert.equal((await h.command('manualMap.create', { projectId, mapId, title: 'A' })).ok, true);
  assert.equal((await h.command('manualMap.node.add', { projectId, mapId, nodeId: 'n', label: 'A' })).ok, true);
  let pickerCalls = 0; h.dialog.showOpenDialog = async () => { pickerCalls++; return { canceled: true }; };
  const before = h.roster();
  const payloads = [null, false, {}, ['tiptap'], '', 'TIPTAP', 'tiptap.extra', 'x'.repeat(1001)].map(editorMode => ({ editorMode }));
  for (const key of ['source', 'sourceHash', 'byteLength', 'mediaType', 'path', 'targetPath', 'extra']) payloads.push({ editorMode: 'tiptap', [key]: 'forged' });
  for (const extra of payloads) {
    const result = await h.command('manualMap.attachment.add', { projectId, mapId, nodeId: 'n', attachmentId: 'a', label: 'Selected', ...extra });
    assert.equal(result.ok, false, JSON.stringify(extra)); assert.equal(result.reason, 'MANUAL_MAP_ATTACHMENT_INTENT_INVALID');
    assert.equal(pickerCalls, 0); assert.deepEqual(h.roster(), before);
  }
});

test('manual-map attachment real picker refuses forged metadata and cancelled/stale/revoked/changed input without canonical writes', async t => {
  for (const fault of ['forged', 'cancel', 'owner', 'session', 'generation', 'window', 'project-away-back', 'capability', 'capability-after-read', 'revision', 'oversize', 'symlink', 'changed-read']) await t.test(fault, async t => {
    const h = await fullMacMainFixture(t);
    const created = await h.main.handleProjectLifecycleCreateCommand({ projectName: 'Attachment guards' });
    assert.equal(created.ok, true); const projectId = created.projectId, mapId = 'a';
    assert.equal((await h.command('manualMap.create', { projectId, mapId, title: 'A' })).ok, true);
    assert.equal((await h.command('manualMap.node.add', { projectId, mapId, nodeId: 'a', label: 'A' })).ok, true);
    const donor = path.join(h.root, 'selected.txt'); fs.writeFileSync(donor, 'real selected bytes');
    if (fault === 'oversize') fs.truncateSync(donor, 8 * 1024 * 1024 + 1);
    if (fault === 'symlink') { fs.renameSync(donor, donor + '.original'); fs.symlinkSync(donor + '.original', donor); }
    const manifestPath = path.join(h.documents, 'craftsman', 'Attachment guards', 'project.craftsman.json');
    let pickerCalls = 0;
    h.dialog.showOpenDialog = async () => {
      pickerCalls++;
      if (fault === 'owner') h.main.__host.revokeOwner();
      if (fault === 'session') h.main.__host.invalidateSession();
      if (fault === 'generation') h.main.__host.invalidateGeneration();
      if (fault === 'window') h.window.isDestroyed = () => true;
      if (fault === 'project-away-back') assert.equal((await h.main.handleProjectLifecycleOpenCommand({ projectId })).ok, true);
      if (fault === 'capability') h.main.__host.denyCapability();
      if (fault === 'revision') {
        const value = JSON.parse(fs.readFileSync(manifestPath)); value.foreign = 'preserved'; fs.writeFileSync(manifestPath, JSON.stringify(value));
      }
      return { canceled: fault === 'cancel', filePaths: [donor] };
    };
    const originalOpen = fs.promises.open;
    if (['changed-read', 'capability-after-read'].includes(fault)) fs.promises.open = async (file, ...args) => {
      const handle = await originalOpen(file, ...args);
      if (file !== donor) return handle;
      const read = handle.read.bind(handle); handle.read = async (...params) => {
        const value = await read(...params);
        if (fault === 'changed-read') fs.appendFileSync(donor, 'changed'); else h.main.__host.denyCapability();
        return value;
      };
      return handle;
    };
    const before = h.roster();
    let result; try { result = await h.command('manualMap.attachment.add', { projectId, mapId, nodeId: 'a', attachmentId: 'att', label: 'Reference',
      ...(fault === 'forged' ? { source: { sourceHash: 'a'.repeat(64) } } : {}) }); }
    finally { fs.promises.open = originalOpen; }
    assert.equal(result.ok, false, JSON.stringify(result)); assert.equal(pickerCalls, fault === 'forged' ? 0 : 1);
    if (fault === 'revision') {
      const expected = h.roster().filter(([name]) => !name.endsWith('/project.craftsman.json'));
      assert.deepEqual(expected, before.filter(([name]) => !name.endsWith('/project.craftsman.json')));
      assert.equal(JSON.parse(fs.readFileSync(manifestPath)).foreign, 'preserved');
    } else assert.deepEqual(h.roster(), before);
  });
});

test('manual-map actual Main refuses a manifest changed after the real Core binding without overwriting newer unrelated bytes', async t => {
  const h = await fullMacMainFixture(t);
  const created = await h.main.handleProjectLifecycleCreateCommand({ projectName: 'Manifest binding race' });
  assert.equal(created.ok, true); let newerRaw, expectedRoster, manifestPath;
  h.main.__host.afterCoreBinding(binding => {
    manifestPath = binding.manifestPath;
    newerRaw = JSON.stringify({ ...binding.manifest, newerUnrelatedAuthorData: { owner: 'concurrent', text: 'Сохранить e\u0301 🧭' } }, null, 2) + '\n';
    fs.writeFileSync(manifestPath, newerRaw); expectedRoster = h.roster();
  });
  const result = await h.command('manualMap.create', { projectId: created.projectId, mapId: 'stale', title: 'Must not write' });
  assert.equal(result.ok, false, JSON.stringify(result));
  assert.equal(fs.readFileSync(manifestPath, 'utf8'), newerRaw);
  assert.deepEqual(h.roster(), expectedRoster);
});

test('manual-map PDF actual renderer-to-Main exports binary through the real print helper [FINITE_PRINT_NOT_PHYSICAL_PDF_PROOF]', async t => {
  const h = await fullMacMainFixture(t), ui = await fullMacRendererCommandPort(h);
  fullMacPdfPublication(h);
  const made = await h.main.handleProjectLifecycleCreateCommand({ projectName: 'Binary PDF' }); assert.equal(made.ok, true);
  const payload = { projectId: made.projectId, mapId: 'map' };
  assert.equal((await ui('manualMap.create', { ...payload, title: 'Карта <script> e\u0301 🧭' })).mainResult.ok, true);
  assert.equal((await ui('manualMap.node.add', { ...payload, nodeId: 'n', label: '<img src="file:///private"> & e\u0301 🧭' })).mainResult.ok, true);
  const svg = path.join(h.root, 'map.svg'), pdf = path.join(h.root, 'map.pdf'); let saves = 0;
  h.dialog.showSaveDialog = async () => ({ canceled: false, filePath: ++saves === 1 ? svg : pdf });
  assert.equal((await ui('manualMap.export.imagePdf', payload)).mainResult.ok, true);
  assert.match(fs.readFileSync(svg, 'utf8'), /<svg/u);
  const before = h.roster(), window = h.window;
  const { mainResult: result, request } = await ui('manualMap.export.imagePdf', { ...payload, requestedFormat: 'pdf' });
  const unchanged = JSON.stringify(before) === JSON.stringify(h.roster());
  t.diagnostic(JSON.stringify({ result, saves, printCalls: h.printCalls || 0, canonicalUnchanged: unchanged }));
  assert.equal(request.payload.editorMode, 'tiptap'); assert.equal(request.payload.requestedFormat, 'pdf');
  if (!result.ok) { assert.equal(unchanged, true); assert.equal(saves, 1); assert.equal(h.printCalls || 0, 0); }
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(h.window, window); assert.equal(h.printCalls, 1); assert.equal(h.printDestroyed, true);
  assert.deepEqual(h.printOptions.webPreferences, { contextIsolation: true, javascript: false, nodeIntegration: false, sandbox: true, webSecurity: true });
  assert.deepEqual(h.pdfOptions, { printBackground: true, preferCSSPageSize: true });
  assert.match(h.printHtml, /Content-Security-Policy/u); assert.match(h.printHtml, /&lt;img/u); assert.doesNotMatch(h.printHtml, /<img src=/u);
  const bytes = fs.readFileSync(pdf); assert.equal(bytes.equals(finiteManualMapPdf()), true);
  assert.equal(result.value.export.pdf.binaryGenerated, true);
  assert.equal(result.value.export.sha256, crypto.createHash('sha256').update(bytes).digest('hex'));
  assert.equal(result.value.export.byteLength, bytes.length); assert.equal(result.value.export.mediaType, 'application/pdf');
  assert.equal((await h.main.handleProjectLifecycleOpenCommand({ projectId: made.projectId })).ok, true);
  assert.equal((await h.query('query.manualMapWorkbench', payload)).manualMapWorkbench.graph.nodes[0].id, 'n');
});

test('manual-map PDF actual Main preserves empty and invalid UTF8 previous files [FINITE_PRINT_NOT_PHYSICAL_PDF_PROOF]', async t => {
  const h = await fullMacMainFixture(t), ui = await fullMacRendererCommandPort(h); fullMacPdfPublication(h);
  const made = await h.main.handleProjectLifecycleCreateCommand({ projectName: 'Opaque PDF overwrite' }); assert.equal(made.ok, true);
  const payload = { projectId: made.projectId, mapId: 'map', requestedFormat: 'pdf' };
  assert.equal((await ui('manualMap.create', { ...payload, title: 'A' })).mainResult.ok, true);
  assert.equal((await ui('manualMap.node.add', { ...payload, nodeId: 'n', label: 'A' })).mainResult.ok, true);
  for (const previous of [Buffer.alloc(0), Buffer.from([0xff, 0xfe, 0, 0x80, 0x81])]) {
    const target = path.join(h.root, 'opaque.pdf'); fs.writeFileSync(target, previous);
    h.dialog.showSaveDialog = async () => ({ canceled: false, filePath: target });
    const result = (await ui('manualMap.export.imagePdf', payload)).mainResult;
    assert.equal(result.ok, true, JSON.stringify(result)); assert.deepEqual(fs.readFileSync(target), finiteManualMapPdf());
    assert.equal(fs.readdirSync(h.root).some(name => name.includes('.stage10-cas.')), false);
  }
});

test('manual-map PDF print, cancellation and after-await guards refuse without canonical writes [FINITE_PRINT_NOT_PHYSICAL_PDF_PROOF]', async t => {
  for (const fault of ['print-error', 'empty', 'html', 'high-bit-header', 'missing-eof', 'oversize', 'owner', 'session',
    'generation', 'window', 'capability', 'revision', 'cancel', 'dialog-capability', 'changed-read', 'read-capability']) await t.test(fault, async t => {
    const h = await fullMacMainFixture(t), ui = await fullMacRendererCommandPort(h);
    const made = await h.main.handleProjectLifecycleCreateCommand({ projectName: 'PDF guards' }); assert.equal(made.ok, true);
    const payload = { projectId: made.projectId, mapId: 'map', requestedFormat: 'pdf' };
    assert.equal((await ui('manualMap.create', { ...payload, title: 'A' })).mainResult.ok, true);
    assert.equal((await ui('manualMap.node.add', { ...payload, nodeId: 'n', label: 'A' })).mainResult.ok, true);
    const target = path.join(h.root, 'guard.pdf'), old = Buffer.from([0xff, 0xfe, 0, 0x81]);
    const manifest = path.join(h.documents, 'craftsman', 'PDF guards', 'project.craftsman.json');
    if (fault.includes('read')) fs.writeFileSync(target, old);
    let saves = 0, newer, readChanged = false;
    h.print = async () => {
      if (fault === 'print-error') throw Error('FINITE_PRINT_REFUSAL');
      if (fault === 'empty') return Buffer.alloc(0);
      if (fault === 'html') return Buffer.from('<html>not PDF</html>');
      if (fault === 'oversize') return Buffer.alloc(8 * 1024 * 1024 + 1);
      const bytes = finiteManualMapPdf();
      if (fault === 'high-bit-header') bytes[0] |= 0x80;
      if (fault === 'missing-eof') return bytes.subarray(0, bytes.length - 8);
      if (fault === 'owner') h.main.__host.revokeOwner();
      if (fault === 'session') h.main.__host.invalidateSession();
      if (fault === 'generation') h.main.__host.invalidateGeneration();
      if (fault === 'window') h.window.isDestroyed = () => true;
      if (fault === 'capability') h.main.__host.denyCapability();
      if (fault === 'revision') { newer = JSON.stringify({ ...JSON.parse(fs.readFileSync(manifest)), concurrent: 'preserve' }); fs.writeFileSync(manifest, newer); }
      return bytes;
    };
    h.dialog.showSaveDialog = async () => {
      saves++; if (fault === 'dialog-capability') h.main.__host.denyCapability();
      return { canceled: fault === 'cancel', filePath: target };
    };
    const originalOpen = fs.promises.open;
    if (fault.includes('read')) fs.promises.open = async (file, ...args) => {
      const handle = await originalOpen(file, ...args); if (file !== target) return handle;
      const read = handle.read.bind(handle); handle.read = async (...params) => {
        const value = await read(...params);
        if (!readChanged) {
          readChanged = true;
          if (fault === 'changed-read') fs.appendFileSync(target, Buffer.from([0xff])); else h.main.__host.denyCapability();
        }
        return value;
      }; return handle;
    };
    const before = h.roster(); let result;
    try { result = (await ui('manualMap.export.imagePdf', payload)).mainResult; } finally { fs.promises.open = originalOpen; }
    assert.equal(result.ok, false, JSON.stringify(result)); assert.equal(h.printCalls, 1); assert.equal(h.printDestroyed, true);
    assert.equal(saves, ['cancel', 'dialog-capability', 'changed-read', 'read-capability'].includes(fault) ? 1 : 0);
    if (fault === 'revision') {
      assert.equal(fs.readFileSync(manifest, 'utf8'), newer);
      assert.deepEqual(h.roster().filter(([name]) => !name.endsWith('/project.craftsman.json')), before.filter(([name]) => !name.endsWith('/project.craftsman.json')));
    } else assert.deepEqual(h.roster(), before);
    if (!fault.includes('read')) assert.equal(fs.existsSync(target), false);
    else { assert.equal(readChanged, true); assert.deepEqual(fs.readFileSync(target), fault === 'changed-read' ? Buffer.concat([old, Buffer.from([0xff])]) : old); }
  });
});

test('manual-map Core admits strict PDF metadata only through existing imagePdf command', async () => {
  const core = await import('../../src/core/runtime.mjs');
  let result = core.reduceCoreState(core.createInitialCoreState(), { type: core.CORE_COMMAND_IDS.PROJECT_CREATE, payload: { projectId: 'pdf-core', title: 'A' } });
  assert.equal(result.ok, true);
  result = core.reduceCoreState(result.state, { type: core.CORE_COMMAND_IDS.MANUAL_MAP_CREATE, payload: { projectId: 'pdf-core', mapId: 'map', title: 'A' } });
  assert.equal(result.ok, true); const state = result.state, bytes = finiteManualMapPdf();
  const artifact = { schemaVersion: 'manualMap.localArtifactIntent.v1', format: 'pdf', mediaType: 'application/pdf',
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length };
  const run = (extra, type = core.CORE_COMMAND_IDS.MANUAL_MAP_EXPORT_IMAGE_PDF) => core.reduceCoreState(state,
    { type, payload: { projectId: 'pdf-core', mapId: 'map', artifact: { ...artifact, ...extra } } });
  assert.equal(run({}).ok, true); assert.equal(run({}, core.CORE_COMMAND_IDS.MANUAL_MAP_EXPORT_JSON).ok, false);
  for (const extra of [{ format: ' pdf ' }, { mediaType: 'image/svg+xml' }, { byteLength: '420' }, { byteLength: 0 },
    { byteLength: 8 * 1024 * 1024 + 1 }, { byteLength: 1.5 }, { sha256: ' ' + artifact.sha256 }, { sha256: 'z'.repeat(64) }]) {
    const refused = run(extra); assert.equal(refused.ok, false, JSON.stringify(extra)); assert.deepEqual(refused.state, state);
  }
});


test('manual-map Markdown actual renderer-to-Main exports a saved UTF8 packet [FINITE_IPC_NOT_NATIVE_ACCEPTANCE]', async t => {
  const h = await fullMacMainFixture(t), ui = await fullMacRendererCommandPort(h, { allowUnregistered: true });
  fullMacPdfPublication(h);
  const made = await h.main.handleProjectLifecycleCreateCommand({ projectName: 'Markdown packet' }); assert.equal(made.ok, true);
  const payload = { projectId: made.projectId, mapId: 'map' }, title = 'Карта <script> e\u0301 🧭';
  assert.equal((await ui('manualMap.create', { ...payload, title })).mainResult.ok, true);
  assert.equal((await ui('manualMap.node.add', { ...payload, nodeId: 'n', label: '```\n# <img> e\u0301 👩‍🚀' })).mainResult.ok, true);
  const svg = path.join(h.root, 'map.svg'), target = path.join(h.root, 'map.md'); let saves = 0, options;
  h.dialog.showSaveDialog = async (...args) => { options = args.at(-1); return { canceled: false, filePath: ++saves === 1 ? svg : target }; };
  assert.equal((await ui('manualMap.export.imagePdf', payload)).mainResult.ok, true);
  assert.match(fs.readFileSync(svg, 'utf8'), /<svg/u);
  const before = h.roster(), response = await ui('manualMap.export.markdown', payload);
  const unchanged = JSON.stringify(before) === JSON.stringify(h.roster());
  t.diagnostic(JSON.stringify({ result: response.result, saves, canonicalUnchanged: unchanged, reachedMain: !!response.mainResult }));
  if (!response.result.ok) { assert.equal(unchanged, true); assert.equal(saves, 1); assert.equal(response.result.error.code, 'E_COMMAND_NOT_FOUND'); }
  assert.equal(response.result.ok, true, JSON.stringify(response.result));
  assert.equal(response.request.payload.editorMode, 'tiptap'); assert.equal(response.mainResult.ok, true);
  assert.deepEqual(options.filters, [{ name: 'Markdown', extensions: ['md'] }]); assert.match(options.defaultPath, /\.md$/u);
  const bytes = fs.readFileSync(target), receipt = response.mainResult.value.export;
  assert.equal(receipt.format, 'markdown'); assert.equal(receipt.mediaType, 'text/markdown');
  assert.equal(receipt.sha256, crypto.createHash('sha256').update(bytes).digest('hex')); assert.equal(receipt.byteLength, bytes.length);
  const bridge = await import('../../src/import/mindmap/v1/manualMapMarkdownPortabilityBridge.mjs');
  const parsed = bridge.parseManualMapMarkdownPortabilityBridge({ markdown: bytes.toString('utf8') }); assert.equal(parsed.ok, true);
  assert.equal(parsed.value.mapId, payload.mapId); assert.equal(parsed.value.payload.title, title);
  assert.equal(parsed.value.payload.nodes[0].label, '```\n# <img> e\u0301 👩‍🚀'); assert.notEqual(receipt.sha256, parsed.value.markdownHash);
  assert.equal((await h.main.handleProjectLifecycleOpenCommand({ projectId: made.projectId })).ok, true);
  assert.equal((await h.query('query.manualMapWorkbench', payload)).manualMapWorkbench.graph.nodes[0].id, 'n');
});


test('manual-map Markdown transport rejects unknown authority before the Save effect', async t => {
  const h = await fullMacMainFixture(t), ui = await fullMacRendererCommandPort(h);
  const made = await h.main.handleProjectLifecycleCreateCommand({ projectName: 'Markdown intent guards' }); assert.equal(made.ok, true);
  const payload = { projectId: made.projectId, mapId: 'map' };
  assert.equal((await ui('manualMap.create', { ...payload, title: 'Saved' })).mainResult.ok, true);
  let saves = 0; h.dialog.showSaveDialog = async () => { saves++; return { canceled: true }; }; const before = h.roster();
  for (const key of ['path', 'targetPath', 'source', 'payload', 'artifact', 'content', 'markdown', 'sha256', 'byteLength', 'requestedFormat', 'extra']) {
    const result = (await ui('manualMap.export.markdown', { ...payload, [key]: 'forged' })).mainResult;
    assert.equal(result.ok, false, key); assert.equal(result.reason, 'MANUAL_MAP_MARKDOWN_INTENT_INVALID');
    assert.equal(saves, 0); assert.deepEqual(h.roster(), before);
  }
  for (const key of ['mapId', 'projectId']) for (const value of [null, false, {}, [], '', '   ', 'x'.repeat(1001)]) {
    const result = (await ui('manualMap.export.markdown', { ...payload, [key]: value })).mainResult;
    assert.equal(result.ok, false, key + ':' + JSON.stringify(value));
    assert.equal(saves, 0, key + ':' + JSON.stringify(value) + ':' + JSON.stringify(result)); assert.deepEqual(h.roster(), before);
  }
  for (const editorMode of [null, false, {}, ['tiptap'], '', 'TIPTAP', 'legacy.extra']) {
    const result = await h.command('manualMap.export.markdown', { ...payload, editorMode });
    assert.equal(result.ok, false, JSON.stringify(editorMode)); assert.equal(result.reason, 'MANUAL_MAP_MARKDOWN_INTENT_INVALID');
    assert.equal(saves, 0); assert.deepEqual(h.roster(), before);
  }
});

test('manual-map Markdown actual Main cancellation and after-await refusals retain source and external bytes', async t => {
  for (const fault of ['cancel', 'owner', 'session', 'generation', 'window', 'project-away-back', 'capability', 'revision',
    'read-capability', 'changed-read', 'invalid-utf8', 'oversize', 'symlink', 'inside-project']) {
    const h = await fullMacMainFixture(t), ui = await fullMacRendererCommandPort(h);
    const made = await h.main.handleProjectLifecycleCreateCommand({ projectName: 'Markdown guards' }); assert.equal(made.ok, true);
    const payload = { projectId: made.projectId, mapId: 'map' };
    assert.equal((await ui('manualMap.create', { ...payload, title: 'Saved' })).mainResult.ok, true);
    const manifest = path.join(h.documents, 'craftsman', 'Markdown guards', 'project.craftsman.json');
    const target = fault === 'inside-project' ? path.join(path.dirname(manifest), 'map.md') : path.join(h.root, 'map.md');
    const previous = Buffer.from('\ufeffPrevious e\u0301 🧭\n'); let expected = previous;
    fs.writeFileSync(target, previous);
    if (fault === 'invalid-utf8') { expected = Buffer.from([0xff, 0xfe]); fs.writeFileSync(target, expected); }
    if (fault === 'oversize') fs.truncateSync(target, 8 * 1024 * 1024 + 1);
    if (fault === 'symlink') { fs.renameSync(target, target + '.original'); fs.symlinkSync(target + '.original', target); }
    let newer, saves = 0, changed = false;
    h.dialog.showSaveDialog = async () => {
      saves++; await Promise.resolve();
      if (fault === 'owner') h.main.__host.revokeOwner();
      if (fault === 'session') h.main.__host.invalidateSession();
      if (fault === 'generation') h.main.__host.invalidateGeneration();
      if (fault === 'window') h.window.isDestroyed = () => true;
      if (fault === 'project-away-back') assert.equal((await h.main.handleProjectLifecycleOpenCommand({ projectId: made.projectId })).ok, true);
      if (fault === 'capability') h.main.__host.denyCapability();
      if (fault === 'revision') { newer = JSON.stringify({ ...JSON.parse(fs.readFileSync(manifest)), concurrent: 'keep' }); fs.writeFileSync(manifest, newer); }
      return { canceled: fault === 'cancel', filePath: target };
    };
    const originalOpen = fs.promises.open;
    if (['changed-read', 'read-capability'].includes(fault)) fs.promises.open = async (name, ...args) => {
      const handle = await originalOpen(name, ...args); if (name !== target) return handle;
      const read = handle.read.bind(handle); handle.read = async (...params) => {
        const result = await read(...params); if (!changed) { changed = true;
          if (fault === 'changed-read') { expected = Buffer.concat([previous, Buffer.from('foreign')]); fs.writeFileSync(target, expected); }
          else h.main.__host.denyCapability();
        } return result;
      }; return handle;
    };
    const before = h.roster(), oldManifest = fs.readFileSync(manifest); let result;
    try { result = (await ui('manualMap.export.markdown', payload)).mainResult; } finally { fs.promises.open = originalOpen; }
    assert.equal(result.ok, false, fault + ':' + JSON.stringify(result)); assert.equal(saves, 1);
    if (fault === 'revision') {
      assert.equal(fs.readFileSync(manifest, 'utf8'), newer);
      assert.deepEqual(h.roster().filter(([name]) => !name.endsWith('/project.craftsman.json')), before.filter(([name]) => !name.endsWith('/project.craftsman.json')));
    } else { assert.deepEqual(fs.readFileSync(manifest), oldManifest); assert.deepEqual(h.roster(), before); }
    if (['changed-read', 'read-capability'].includes(fault)) assert.equal(changed, true);
    if (!['oversize', 'symlink'].includes(fault)) assert.deepEqual(fs.readFileSync(target), expected);
    if (fault === 'symlink') assert.equal(fs.lstatSync(target).isSymbolicLink(), true);
  }
});

test('manual-map Markdown Core metadata stays format-specific with exact raw hash and safe UTF8 length', async () => {
  const core = await import('../../src/core/runtime.mjs');
  const built = core.applyCoreSequence(core.createInitialCoreState(), [
    { type: core.CORE_COMMAND_IDS.PROJECT_CREATE, payload: { projectId: 'md-core', title: 'A' } },
    { type: core.CORE_COMMAND_IDS.MANUAL_MAP_CREATE, payload: { projectId: 'md-core', mapId: 'map', title: 'A' } },
  ]); assert.equal(built.ok, true); const state = built.state;
  const artifact = { schemaVersion: 'manualMap.localArtifactIntent.v1', format: 'markdown', mediaType: 'text/markdown', sha256: 'a'.repeat(64), byteLength: 1 };
  const run = (extra, type = core.CORE_COMMAND_IDS.MANUAL_MAP_EXPORT_MARKDOWN) => core.reduceCoreState(state,
    { type, payload: { projectId: 'md-core', mapId: 'map', artifact: { ...artifact, ...extra } } });
  assert.equal(run({}).ok, true); assert.equal(run({ byteLength: 8 * 1024 * 1024 }).ok, true);
  for (const type of [core.CORE_COMMAND_IDS.MANUAL_MAP_EXPORT_JSON, core.CORE_COMMAND_IDS.MANUAL_MAP_EXPORT_IMAGE_PDF]) assert.equal(run({}, type).ok, false);
  for (const extra of [{ format: 'json' }, { format: ' markdown ' }, { mediaType: 'application/json' }, { sha256: ' ' + artifact.sha256 },
    { sha256: 'z'.repeat(64) }, { byteLength: '1' }, { byteLength: 0 }, { byteLength: 1.5 }, { byteLength: 8 * 1024 * 1024 + 1 }]) {
    const refused = run(extra); assert.equal(refused.ok, false, JSON.stringify(extra)); assert.deepEqual(refused.state, state);
  }
});


test('manual-map Markdown actual Main overwrites empty and BOM UTF8 targets in both editor modes', async t => {
  const h = await fullMacMainFixture(t), ui = await fullMacRendererCommandPort(h); fullMacPdfPublication(h);
  const made = await h.main.handleProjectLifecycleCreateCommand({ projectName: 'Markdown previous bytes' }); assert.equal(made.ok, true);
  const payload = { projectId: made.projectId, mapId: 'map' };
  assert.equal((await ui('manualMap.create', { ...payload, title: 'e\u0301 🧭' })).mainResult.ok, true);
  const target = path.join(h.root, 'map.md'); h.dialog.showSaveDialog = async () => ({ canceled: false, filePath: target });
  for (const [previous, tiptap] of [['', true], ['\ufeffPrevious e\u0301 👩‍🚀\n', false]]) {
    fs.writeFileSync(target, previous); const { mainResult: result, request } = await ui('manualMap.export.markdown', payload, tiptap);
    assert.equal(request.payload.editorMode, tiptap ? 'tiptap' : 'legacy'); assert.equal(result.ok, true, JSON.stringify(result));
    const bytes = fs.readFileSync(target); assert.equal(result.value.export.sha256, crypto.createHash('sha256').update(bytes).digest('hex'));
    assert.equal(result.value.export.byteLength, bytes.length); assert.equal(fs.readdirSync(h.root).some(name => name.includes('.stage10-cas.')), false);
  }
});
