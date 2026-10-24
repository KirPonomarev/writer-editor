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
async function fullMacMainFixture(t, { packaged = true, platform = 'darwin', rendererLoaded = false, historicalV7Constructor = false, historicalV8Constructor = false } = {}) {
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
      getURL: () => h.shellUrl, setZoomFactor() {}, send: (channel, payload) => {
        h.sent.push([channel, payload]);
        if (channel === 'editor:set-text') h.editor = { ...payload, generation: 0 };
        if (channel === 'editor:snapshot-request') queueMicrotask(() => h.listeners.get('editor:snapshot-response')(
          h.event(), { requestId: payload.requestId, snapshot: h.editor }));
      } };
    this.loadFile = (file, { query }) => {
      const url = require('node:url').pathToFileURL(file);
      for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
      h.shellUrl = url.href; return rendererLoaded ? Promise.resolve() : new Promise(() => {}); // Finite load completion only when requested; no renderer.
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
      if (request === './core/writer-local-profile-v1.cjs' && historicalV7Constructor) {
        // Historical compatibility only: real V7 factory, current Main body.
        // Default/current-Main tests never select or substitute a profile factory.
        assert.equal(packaged, true); assert.equal(platform, 'darwin');
        t.diagnostic('HISTORICAL_V7_CONSTRUCTOR_SELECTION_NOT_CURRENT_MAIN_PROFILE_COVERAGE');
        return { ...loaded, createWriterAtlasReadSurfacesProfileProjection: loaded.createWriterAtlasExplicitSuppressionProfileProjection,
          createWriterAtlasTemporalAuthoringProfileProjection: loaded.createWriterAtlasExplicitSuppressionProfileProjection };
      }
      if (request === './core/writer-local-profile-v1.cjs' && historicalV8Constructor) {
        assert.equal(packaged, true); assert.equal(platform, 'darwin'); assert.equal(historicalV7Constructor, false);
        t.diagnostic('HISTORICAL_V8_CONSTRUCTOR_SELECTION_NOT_CURRENT_MAIN_PROFILE_COVERAGE');
        return { ...loaded, createWriterAtlasTemporalAuthoringProfileProjection: loaded.createWriterAtlasReadSurfacesProfileProjection };
      }
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
        async editorReady() { await editorStartupReadyPromise; },
        revokeOwner() { activeStage10ApplicationBootstrap = null; },
        invalidateSession() { commentAuthoringSessionId = crypto.randomUUID(); },
        invalidateGeneration() { lastSignaledEditGeneration += 1; },
        invalidateLifecycle() { currentFilePath += '.retired-synthetic-subject'; },
        invalidateProjectRoot() { currentProjectName += ' retired-synthetic-root'; },
        holdProjectQueue(operation) { return enqueueProductCommandTransaction(currentProjectName || DEFAULT_PROJECT_NAME, operation); },
        afterCoreBinding(callback) { const build = buildProductCoreStateForCurrentProject; let armed = true;
          buildProductCoreStateForCurrentProject = async (...args) => { const result = await build(...args);
            if (armed) { armed = false; await callback(result); } return result; }; },
        denyCapability(capabilityId = 'cap.manualMap.edit') { const read = readAuthorityCapabilityMatrixDoc; readAuthorityCapabilityMatrixDoc = () => {
          const matrix = read(); matrix.items.find(row => row.platformId === 'node').capabilities[capabilityId] = false; return matrix; }; },
        afterTruth(callback) { const prepare = prepareCanonicalProjectTruthCommand; prepareCanonicalProjectTruthCommand = async (...args) => {
          const result = await prepare(...args); await callback(); return result; }; }
      };`, mainPath);
    h.main = compiled.exports; h.main.createWindow();
    if (rendererLoaded) await h.main.__host.editorReady();
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
  const h = await fullMacMainFixture(t, { historicalV7Constructor: true }), before = h.roster();
  assert.equal(h.main.__profile().profileId, 'WRITER_LOCAL_ATLAS_EXPLICIT_SUPPRESSION_V7');
  assert.equal(new URL(h.shellUrl).searchParams.get('PRODUCT_PROFILE'), 'WRITER_LOCAL_ATLAS_EXPLICIT_SUPPRESSION_V7');
  const unselected = ['atlas', 'idea', 'meaning', 'blackBox', 'stage10'].map(domain =>
    productRegistry.PRODUCT_COMMAND_RECORDS.find(row => row.domain === domain && !['atlas.entity.create', 'atlas.alias.add', 'atlas.mention.confirm', 'atlas.evidence.reattach', 'atlas.observation.suppress', 'manualMap.create', 'manualMap.node.add'].includes(row.id)).id);
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
    { ...event, senderFrame: { url: h.shellUrl.replace('WRITER_LOCAL_ATLAS_EXPLICIT_SUPPRESSION_V7', 'WRITER_LOCAL_V1') } }])
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
  for (const id of ['WRITER_LOCAL_V1', 'WRITER_LOCAL_ATLAS_V2', 'WRITER_LOCAL_MANUAL_MAP_V3', 'WRITER_LOCAL_MANUAL_MAP_V4', 'WRITER_LOCAL_EXACT_ATLAS_V5', 'WRITER_LOCAL_EXACT_ATLAS_V5.extra', 'WRITER_LOCAL_MANUAL_MAP_V4.extra', 'WRITER_LOCAL_ATLAS_V2.extra', '']) {
    const elements = Object.fromEntries(selectors.map(selector => [selector, { hidden: false, disabled: false, tabIndex: 0,
      attrs: {}, style: { setProperty(name, value, priority) { this[name] = [value, priority]; } },
      setAttribute(name, value) { this.attrs[name] = value; } }]));
    const callbacks = [], window = { location: { search: '?USE_TIPTAP=1&PRODUCT_PROFILE=' + id } };
    const document = { body: { dataset: {} }, querySelectorAll: selector => selector.split(',').map(key => elements[key]),
      addEventListener: (name, callback) => callbacks.push(callback) };
    vm.runInNewContext(read('src/renderer/flags.js'), { window, document, URLSearchParams, console: { log() {} } });
    callbacks.forEach(callback => callback());
    for (const selector of selectors) {
      const hidden = id === 'WRITER_LOCAL_V1' || ['WRITER_LOCAL_ATLAS_V2', 'WRITER_LOCAL_MANUAL_MAP_V3', 'WRITER_LOCAL_MANUAL_MAP_V4', 'WRITER_LOCAL_EXACT_ATLAS_V5'].includes(id) && selector !== '[data-right-tab="atlas"]';
      assert.equal(elements[selector].hidden, hidden, id + selector); assert.equal(elements[selector].disabled, hidden);
      assert.equal(elements[selector].tabIndex, hidden ? -1 : 0);
      if (hidden) { assert.equal(elements[selector].attrs['aria-hidden'], 'true'); assert.deepEqual(elements[selector].style.display, ['none', 'important']); }
    }
    assert.equal(window.__PRODUCT_PROFILE, ['WRITER_LOCAL_V1', 'WRITER_LOCAL_ATLAS_V2', 'WRITER_LOCAL_MANUAL_MAP_V3', 'WRITER_LOCAL_MANUAL_MAP_V4', 'WRITER_LOCAL_EXACT_ATLAS_V5'].includes(id) ? id : '');
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


const EXACT_ATLAS_TEXT = 'Начало é 🧭. Мира увидела маяк. Северная ответила Мире. Мира сохранила знак.';
async function exactAtlasScene(h, projectName) {
  const made = await h.main.handleProjectLifecycleCreateCommand({ projectName }); assert.equal(made.ok, true);
  const projectId = made.projectId, projectRoot = path.join(h.documents, 'craftsman', projectName);
  const tree = await h.main.handleWorkspaceProjectTreeQuery({ tab: 'roman' }); assert.equal(tree.ok, true);
  const flat = node => [node, ...(node.children || []).flatMap(flat)];
  const node = flat(tree.root).find(row => row.kind === 'scene' || row.kind === 'chapter-file'); assert.ok(node);
  const resolved = await h.main.resolveProjectTreeNodeIdentity(node.nodeId, projectId);
  const envelope = require('../../src/core/document-content-envelope-v1.cjs');
  const seed = envelope.composeDocumentContentFromBase({ baseContent: fs.readFileSync(resolved.nodePath, 'utf8'), nextVisibleText: EXACT_ATLAS_TEXT });
  assert.equal(seed.ok, true); fs.writeFileSync(resolved.nodePath, seed.content);
  assert.equal(envelope.parseObservablePayload(seed.content).text, EXACT_ATLAS_TEXT);
  return { projectId, projectRoot, sceneId: node.nodeId, scenePath: resolved.nodePath,
    sceneBytes: fs.readFileSync(resolved.nodePath), manifestPath: path.join(projectRoot, 'project.craftsman.json') };
}

test('exact Atlas actual renderer Main Kernel persists entity alias exact evidence author decision and reopen [FINITE_IPC_NOT_NATIVE_ACCEPTANCE]', async t => {
  const h = await fullMacMainFixture(t), ui = await fullMacRendererCommandPort(h);
  assert.equal((await h.main.handleProjectLifecycleCreateCommand({ projectName: 'Unrelated Atlas project' })).ok, true);
  const f = await exactAtlasScene(h, 'Exact Atlas Unicode'), { projectId, sceneId } = f;
  assert.equal((await h.command('manualMap.create', { projectId, mapId: 'preserved-map', title: 'Preserved é 🧭' })).ok, true);
  const before = JSON.parse(fs.readFileSync(f.manifestPath)), protectedRoster = h.roster();
  const command = async (id, payload) => {
    const response = await ui(id, { projectId, ...payload });
    t.diagnostic('EXACT_ATLAS_ACTUAL_MAIN ' + JSON.stringify({ id, result: response.mainResult }));
    assert.equal(response.request.payload.editorMode, 'tiptap'); assert.equal(response.mainResult.ok, true, JSON.stringify(response.mainResult));
    assert.equal(response.mainResult.value.receipt.commandId, id); assert.equal(response.mainResult.value.receipt.storageWritten, true);
    assert.deepEqual(fs.readFileSync(f.scenePath), f.sceneBytes); return response.mainResult;
  };
  const entityId = 'entity-mira', aliasId = 'alias-north', decisionId = 'decision-mira-first';
  await command('atlas.entity.create', { entityId, name: 'Мира', entityKind: 'character', opId: 'exact-create' });
  const q = () => h.query('query.atlasCurrentScene', { projectId, nodeId: sceneId });
  const initial = (await q()).atlasCurrentScene;
  assert.equal(initial.state, 'ready'); assert.deepEqual(initial.mentions.map(m => [m.startOffset, m.endOffset]), [[14, 18], [57, 61]]);
  await command('atlas.alias.add', { entityId, aliasId, value: 'Северная', scope: 'scene', sceneId, opId: 'exact-alias' });
  const rosterBeforeRead = h.roster(), projected = await q(); assert.equal(projected.ok, true);
  const scene = projected.atlasCurrentScene; assert.equal(scene.state, 'ready');
  const mentions = scene.mentions.slice().sort((a, b) => a.startOffset - b.startOffset);
  assert.deepEqual(mentions.map(m => [m.matchedText, m.startOffset, m.endOffset, m.termKind, m.trustState]), [
    ['Мира', 14, 18, 'entityName', 'ALGORITHMIC_OBSERVATION'], ['Северная', 33, 41, 'alias', 'ALGORITHMIC_OBSERVATION'],
    ['Мира', 57, 61, 'entityName', 'ALGORITHMIC_OBSERVATION']]);
  const canonicalStringHash = text => crypto.createHash('sha256').update(JSON.stringify(text)).digest('hex');
  for (const m of mentions) {
    assert.equal(m.entityId, entityId); assert.equal(m.sceneId, sceneId); assert.equal(m.context.quote, m.matchedText);
    assert.equal(EXACT_ATLAS_TEXT.slice(m.startOffset, m.endOffset), m.matchedText);
    assert.deepEqual(m.focusIntent, { kind: 'localTextSelection', sceneId, startOffset: m.startOffset, endOffset: m.endOffset });
    assert.equal(m.evidenceAnchor.quote, m.matchedText); assert.equal(m.evidenceAnchor.startOffset, m.startOffset);
    assert.equal(m.evidenceAnchor.endOffset, m.endOffset); assert.equal(m.evidenceAnchor.sceneId, sceneId);
    assert.equal(m.evidenceAnchor.sceneTextHash, canonicalStringHash(EXACT_ATLAS_TEXT));
    assert.equal(m.evidenceAnchor.quoteHash, canonicalStringHash(m.matchedText)); assert.ok(m.evidenceAnchor.anchorId);
  }
  assert.equal(mentions.some(m => m.matchedText === 'Мире'), false);
  const dossier = await h.query('query.atlasEntityDossier', { projectId, entityId }); assert.equal(dossier.ok, true);
  assert.equal(dossier.atlasEntityDossier.entity.name, 'Мира'); assert.equal(dossier.atlasEntityDossier.entity.entityKind, 'character');
  assert.deepEqual(dossier.atlasEntityDossier.aliases, [{ aliasId, value: 'Северная', scope: 'scene', sceneId }]);
  assert.equal(dossier.atlasEntityDossier.surfaceManifest.commandAuthority, 'none'); assert.equal(dossier.atlasEntityDossier.authority.storageMutation, false);
  assert.deepEqual(h.roster(), rosterBeforeRead, 'queries cannot persist derived truth');
  const first = mentions[0];
  await command('atlas.mention.confirm', { entityId, sceneId, mentionId: first.mentionId, evidenceAnchor: first.evidenceAnchor, decisionId, opId: 'exact-confirm' });
  const manifest = JSON.parse(fs.readFileSync(f.manifestPath)), entity = manifest.atlas.entities[entityId], decision = manifest.atlas.decisions[decisionId];
  assert.equal(entity.name, 'Мира'); assert.equal(entity.entityKind, 'character');
  assert.equal(entity.aliases[aliasId].value, 'Северная'); assert.equal(entity.aliases[aliasId].scope, 'scene'); assert.equal(entity.aliases[aliasId].sceneId, sceneId);
  assert.equal(decision.decisionKind, 'mention.confirm'); assert.equal(decision.trustState, 'AUTHOR_CONFIRMED');
  assert.equal(decision.projectId, projectId); assert.equal(decision.sceneId, sceneId); assert.equal(decision.entityId, entityId);
  assert.equal(decision.mentionId, first.mentionId); assert.deepEqual(decision.evidenceAnchor, first.evidenceAnchor);
  const strip = m => { const x = { ...m }; delete x.atlas; delete x.lastCommandId; return x; }; assert.deepEqual(strip(manifest), strip(before));
  for (const row of protectedRoster.filter(([name]) => !name.startsWith('craftsman/Exact Atlas Unicode/.stage10-local') && !name.endsWith('Exact Atlas Unicode/project.craftsman.json')))
    assert.deepEqual(h.roster().find(([name]) => name === row[0]), row, row[0]);
  const stage = path.join(f.projectRoot, '.stage10-local');
  const events = JSON.parse(fs.readFileSync(path.join(stage, 'product-session.v2.json'))).eventLog.events.slice(-3);
  const receipts = JSON.parse(fs.readFileSync(path.join(stage, 'command-receipt-authority-store.v2.json'))).receipts.slice(-3);
  assert.deepEqual(events.map(e => e.commandId), ['atlas.entity.create', 'atlas.alias.add', 'atlas.mention.confirm']);
  assert.deepEqual(receipts.map(e => e.commandId), events.map(e => e.commandId));
  assert.deepEqual(events.map(e => e.opId), ['exact-create', 'exact-alias', 'exact-confirm']);
  for (let i = 0; i < 3; i++) { assert.equal(events[i].domainEventDigest, receipts[i].domainEventDigest); assert.match(events[i].domainEventDigest, /^[a-f0-9]{64}$/u); }
  const after = (await q()).atlasCurrentScene;
  assert.equal(after.mentions.find(m => m.mentionId === first.mentionId).trustState, 'AUTHOR_CONFIRMED');
  assert.equal(after.summary.confirmedMentionCount, 1);
  assert.equal((await h.main.handleProjectLifecycleOpenCommand({ projectId })).ok, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(f.manifestPath)).atlas, manifest.atlas); assert.deepEqual(fs.readFileSync(f.scenePath), f.sceneBytes);
  const reopened = (await q()).atlasCurrentScene;
  assert.deepEqual(reopened.mentions.map(m => [m.matchedText, m.startOffset, m.endOffset, m.trustState]), after.mentions.map(m => [m.matchedText, m.startOffset, m.endOffset, m.trustState]));
  const reopenDossier = (await h.query('query.atlasEntityDossier', { projectId, entityId })).atlasEntityDossier;
  assert.equal(reopenDossier.entity.name, 'Мира'); assert.deepEqual(reopenDossier.aliases, dossier.atlasEntityDossier.aliases);
});

test('exact Atlas actual Main refuses foreign project revoked capability owner and commit revision without writes', async t => {
  for (const fault of ['foreign-project', 'capability', 'owner', 'revision']) await t.test(fault, async t => {
    const h = await fullMacMainFixture(t); let manifestPath, expected, expectedRoster, exercised = fault !== 'revision';
    if (fault === 'revision') h.main.__host.afterTruth(async () => {
      const newer = JSON.parse(expected); newer.concurrentAuthor = 'preserve é 🧭'; newer.lastCommandId = 71;
      expected = Buffer.from(JSON.stringify(newer)); fs.writeFileSync(manifestPath, expected); expectedRoster = h.roster(); exercised = true;
    });
    const f = await exactAtlasScene(h, 'Atlas no-write'); manifestPath = f.manifestPath; expected = fs.readFileSync(manifestPath); expectedRoster = h.roster();
    if (fault === 'capability') h.main.__host.denyCapability('cap.atlas.entity.create');
    if (fault === 'owner') h.main.__host.revokeOwner();
    const result = await h.command('atlas.entity.create', { projectId: fault === 'foreign-project' ? 'foreign' : f.projectId, entityId: 'must-not-write', name: 'Мира' });
    t.diagnostic(JSON.stringify({ fault, result })); assert.equal(exercised, true); assert.equal(result.ok, false);
    assert.notEqual(result.reason, 'WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED');
    assert.deepEqual(fs.readFileSync(manifestPath), expected); assert.deepEqual(h.roster(), expectedRoster); assert.deepEqual(fs.readFileSync(f.scenePath), f.sceneBytes);
  });
});

test('exact Atlas actual Main rejects stale source evidence without altering author data or history', async t => {
  const h = await fullMacMainFixture(t), f = await exactAtlasScene(h, 'Atlas stale evidence'), ui = await fullMacRendererCommandPort(h);
  const { projectId, sceneId } = f, entityId = 'mira';
  const created = await ui('atlas.entity.create', { projectId, entityId, name: 'Мира', entityKind: 'character' });
  assert.equal(created.mainResult.ok, true, JSON.stringify(created.mainResult));
  const first = (await h.query('query.atlasCurrentScene', { projectId, nodeId: sceneId })).atlasCurrentScene.mentions[0]; assert.ok(first);
  // Concurrent author edits replace only the declared synthetic source; the tested confirmation still takes the actual command path.
  const newer = Buffer.from(f.sceneBytes.toString('utf8').replace('Мира', 'Лира')); fs.writeFileSync(f.scenePath, newer); const before = h.roster();
  const refused = (await ui('atlas.mention.confirm', { projectId, entityId, sceneId, mentionId: first.mentionId, evidenceAnchor: first.evidenceAnchor, decisionId: 'stale' })).mainResult;
  assert.equal(refused.ok, false, JSON.stringify(refused)); assert.match(JSON.stringify(refused), /E_ATLAS_EVIDENCE_STALE/u);
  assert.deepEqual(fs.readFileSync(f.scenePath), newer); assert.deepEqual(h.roster(), before);
  assert.equal(JSON.parse(fs.readFileSync(f.manifestPath)).atlas.decisions?.stale, undefined);
});


test('AF1 actual renderer Main SaveACK and canonical source queries preserve author truth across append prefix restoration and reopen [FINITE_IPC_NOT_NATIVE_ACCEPTANCE]', async t => {
  const h = await fullMacMainFixture(t, { rendererLoaded: true }), f = await exactAtlasScene(h, 'Source evidence continuity'), ui = await fullMacRendererCommandPort(h);
  const { projectId, sceneId } = f, entityId = 'continuity-mira', decisionId = 'continuity-first';
  assert.equal((await ui('atlas.entity.create', { projectId, entityId, name: 'Мира', entityKind: 'character' })).mainResult.ok, true);
  const query = async () => {
    const before = h.roster(), result = await h.query('query.atlasCurrentScene', { projectId, nodeId: sceneId });
    assert.equal(result.ok, true, JSON.stringify(result)); assert.deepEqual(h.roster(), before, 'query must not mutate manifest scene or history'); return result.atlasCurrentScene;
  };
  const first = (await query()).mentions.find(m => m.startOffset === 14); assert.ok(first);
  assert.equal((await ui('atlas.mention.confirm', { projectId, sceneId, entityId, mentionId: first.mentionId, evidenceAnchor: first.evidenceAnchor, decisionId })).mainResult.ok, true);
  const originalDecision = JSON.stringify(JSON.parse(fs.readFileSync(f.manifestPath)).atlas.decisions[decisionId]);
  assert.equal((await query()).mentions[0].trustState, 'AUTHOR_CONFIRMED');
  const opened = await h.main.handleUiOpenDocumentCommand({ projectId, nodeId: sceneId }); assert.equal(opened.ok, true, JSON.stringify(opened));
  const envelope = require('../../src/core/document-content-envelope-v1.cjs'); let generation = 0;
  const save = async text => {
    const built = envelope.composeDocumentContentFromBase({ baseContent: h.editor.content, nextVisibleText: text }); assert.equal(built.ok, true);
    h.editor = { ...h.editor, projectId, documentId: sceneId, content: built.content, plainText: text, generation: ++generation };
    const signal = require('../../src/core/ipc-envelope-v1.cjs').createEnvelope('ui:save-lifecycle-signal-bridge', 'signal.localDirty.set', { state: true, generation });
    const raised = await h.handlers.get('ui:save-lifecycle-signal-bridge')(h.event(), signal); assert.equal(raised.ok, true, JSON.stringify(raised));
    const unsavedBytes = fs.readFileSync(f.scenePath); await query(); assert.deepEqual(fs.readFileSync(f.scenePath), unsavedBytes);
    const saved = (await ui('cmd.project.save', {})).mainResult; assert.equal(saved.ok, true, JSON.stringify(saved));
    const ack = h.sent.filter(([channel, payload]) => channel === 'set-dirty' && payload.ack?.kind === 'SAVED').at(-1)?.[1]?.ack;
    assert.ok(ack, 'actual current Main must publish a durable SaveACK'); assert.equal(ack.savedGeneration, generation);
    const raw = fs.readFileSync(f.scenePath), parsed = envelope.parseObservablePayload(raw.toString('utf8'));
    assert.equal(parsed.issue, null); assert.equal(parsed.text, text);
    assert.equal(JSON.stringify(JSON.parse(fs.readFileSync(f.manifestPath)).atlas.decisions[decisionId]), originalDecision);
    return query();
  };
  const appended = await save(EXACT_ATLAS_TEXT + ' Автор дописал абзац.');
  assert.equal(appended.mentions[0].mentionId, first.mentionId); assert.notDeepEqual(appended.mentions[0].evidenceAnchor, first.evidenceAnchor);
  assert.equal(appended.mentions[0].trustState, 'ALGORITHMIC_OBSERVATION'); assert.equal(appended.mentions[0].decisionId, '');
  const shifted = await save('Добавлено. ' + EXACT_ATLAS_TEXT);
  assert.deepEqual(shifted.mentions.map(m => [m.matchedText, m.startOffset, m.endOffset, m.trustState]), [
    ['Мира', 25, 29, 'ALGORITHMIC_OBSERVATION'], ['Мира', 68, 72, 'ALGORITHMIC_OBSERVATION']]);
  const restored = await save(EXACT_ATLAS_TEXT); assert.equal(restored.mentions[0].trustState, 'AUTHOR_CONFIRMED');
  assert.equal(restored.mentions[0].decisionId, decisionId); const restoredBytes = fs.readFileSync(f.scenePath);
  assert.equal((await h.main.handleProjectLifecycleOpenCommand({ projectId })).ok, true);
  assert.equal((await query()).mentions[0].trustState, 'AUTHOR_CONFIRMED'); assert.deepEqual(fs.readFileSync(f.scenePath), restoredBytes);
  assert.equal(JSON.stringify(JSON.parse(fs.readFileSync(f.manifestPath)).atlas.decisions[decisionId]), originalDecision);
});

function reattachmentWholeFixtureRoster(h) {
  const rows = [];
  const visit = dir => { for (const name of fs.readdirSync(dir).sort()) {
    const file = path.join(dir, name), stat = fs.lstatSync(file); assert.equal(stat.isSymbolicLink(), false);
    rows.push([path.relative(h.root, file), stat.isDirectory() ? 'directory' : crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]);
    if (stat.isDirectory()) visit(file);
  } }; visit(h.root); return rows;
}

async function reattachmentMainFixture(t, packaged = false, beforeProject, { historicalV7Constructor = false, historicalV8Constructor = false } = {}) {
  const h = await fullMacMainFixture(t, { packaged, rendererLoaded: true, historicalV7Constructor, historicalV8Constructor }), ui = await fullMacRendererCommandPort(h);
  if (beforeProject) beforeProject(h); // Actual lifecycle bootstrap captures the observer before constructing its prepare port.
  const f = await exactAtlasScene(h, 'Explicit saved reattachment'), { projectId, sceneId } = f;
  const entityId = 'saved-mira', decisionId = 'saved-confirmation';
  const { hashCanonicalValue: hash, canonicalSerialize } = await import('../../src/core/browser-safe-hash.mjs');
  const command = async (id, payload) => (await ui(id, { projectId, ...payload })).mainResult;
  const query = async () => { const r = await h.query('query.atlasCurrentScene', { projectId, nodeId: sceneId }); assert.equal(r.ok, true, JSON.stringify(r)); return r.atlasCurrentScene; };
  assert.equal((await command('atlas.entity.create', { entityId, name: 'Мира', entityKind: 'character' })).ok, true);
  const first = (await query()).mentions.find(m => m.startOffset === 14); assert.ok(first);
  assert.equal((await command('atlas.mention.confirm', { entityId, sceneId, mentionId: first.mentionId, evidenceAnchor: first.evidenceAnchor, decisionId })).ok, true);
  const original = JSON.parse(fs.readFileSync(f.manifestPath)).atlas.decisions[decisionId];
  const originalBytes = Buffer.from(canonicalSerialize(original), 'utf8'), originalHash = hash(original);
  const assertOriginal = () => {
    const actual = JSON.parse(fs.readFileSync(f.manifestPath)).atlas.decisions[decisionId];
    assert.deepEqual(actual, original); assert.deepEqual(Buffer.from(canonicalSerialize(actual), 'utf8'), originalBytes);
    assert.equal(hash(actual), originalHash);
  };
  assert.equal((await h.main.handleUiOpenDocumentCommand({ projectId, nodeId: sceneId })).ok, true);
  const envelope = require('../../src/core/document-content-envelope-v1.cjs'); let generation = 0;
  const save = async text => {
    const built = envelope.composeDocumentContentFromBase({ baseContent: h.editor.content, nextVisibleText: text }); assert.equal(built.ok, true);
    h.editor = { ...h.editor, projectId, documentId: sceneId, content: built.content, plainText: text, generation: ++generation };
    const signal = require('../../src/core/ipc-envelope-v1.cjs').createEnvelope('ui:save-lifecycle-signal-bridge', 'signal.localDirty.set', { state: true, generation });
    assert.equal((await h.handlers.get('ui:save-lifecycle-signal-bridge')(h.event(), signal)).ok, true);
    assert.equal((await command('cmd.project.save', {})).ok, true);
    const ack = h.sent.filter(([channel, payload]) => channel === 'set-dirty' && payload.ack?.kind === 'SAVED').at(-1)?.[1]?.ack;
    assert.equal(ack?.savedGeneration, generation); assert.equal(envelope.parseObservablePayload(fs.readFileSync(f.scenePath, 'utf8')).text, text);
    assertOriginal();
    return query();
  };
  const shifted = await save('Добавлено. ' + EXACT_ATLAS_TEXT);
  assert.deepEqual(shifted.mentions.map(m => [m.startOffset, m.endOffset]), [[25, 29], [68, 72]]);
  const payload = (projection, id, offset = 68) => {
    const mention = projection.mentions.find(m => m.startOffset === offset); assert.ok(mention);
    return { sourceRecordKind: 'decision', sourceRecordId: decisionId, staleEvidenceAnchor: structuredClone(original.evidenceAnchor),
      newEvidenceAnchor: structuredClone(mention.evidenceAnchor), expectedSourceRecordHash: hash(original), reattachmentId: id, reason: 'Explicit reviewed source' };
  };
  return { h, ui, f, projectId, sceneId, entityId, decisionId, original, originalBytes, originalHash, assertOriginal, hash, canonicalSerialize, command, query, save, shifted, payload };
}

test('V6 actual packaged Main successor replaces separately observed V5 reattachment denial [FINITE_IPC_NOT_NATIVE_ACCEPTANCE]', async t => {
  const x = await reattachmentMainFixture(t, true, undefined, { historicalV7Constructor: true }), { h } = x, before = reattachmentWholeFixtureRoster(h);
  if (h.main.__profile().profileId === 'WRITER_LOCAL_EXACT_ATLAS_V5') {
    const denied = await x.command('atlas.evidence.reattach', x.payload(x.shifted, 'packaged-baseline'));
    assert.equal(denied.ok, false); assert.equal(denied.reason, 'WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED');
    assert.deepEqual(reattachmentWholeFixtureRoster(h), before);
    t.diagnostic('EXACT_BASE_PACKAGED_V5_DENIAL_OBSERVED; not a Core identity no-write proof');
  }
  assert.equal(h.main.__profile().profileId, 'WRITER_LOCAL_ATLAS_EXPLICIT_SUPPRESSION_V7');
  assert.equal((await x.command('atlas.evidence.reattach', x.payload(x.shifted, 'packaged-first'))).ok, true);
  assert.equal((await x.query()).mentions.find(m => m.startOffset === 68).trustState, 'AUTHOR_CONFIRMED');
  x.assertOriginal();
});

test('actual unpackaged renderer Main Kernel rejects raw old and new anchor identity with no Documents or integrity-anchor writes', async t => {
  for (const field of ['staleEvidenceAnchor', 'newEvidenceAnchor']) for (const key of ['projectId', 'entityId'])
    for (const value of ['foreign', 42, null, { foreign: true }]) await t.test(`${field}-${key}-${JSON.stringify(value)}`, async t => {
      let reachedCanonical = false, armed = false;
      const x = await reattachmentMainFixture(t, false, h => h.main.__host.afterTruth(() => { if (armed) reachedCanonical = true; })), { h } = x;
      assert.equal(h.main.__profile().active, false, 'inactive source profile must not mask Core validation');
      assert.equal((await x.command('atlas.evidence.reattach', x.payload(x.shifted, 'normal-control'))).ok, true);
      assert.equal((await x.query()).mentions.find(m => m.startOffset === 68).trustState, 'AUTHOR_CONFIRMED');
      x.assertOriginal();
      const payload = x.payload(x.shifted, 'must-not-write', 25); payload[field] = { ...payload[field], [key]: value };
      armed = true;
      const physicalRecordBefore = JSON.stringify(JSON.parse(fs.readFileSync(x.f.manifestPath)).atlas.decisions[x.decisionId]);
      const before = reattachmentWholeFixtureRoster(h), result = await x.command('atlas.evidence.reattach', payload);
      t.diagnostic(JSON.stringify({ field, key, value, reachedCanonical, ok: result.ok, reason: result.reason, coreError: result.value?.applyResult?.error }));
      assert.equal(reachedCanonical, true, 'real owner preparation and canonical Kernel route must execute');
      assert.equal(result.ok, false, JSON.stringify(result)); assert.notEqual(result.reason, 'WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED');
      assert.notEqual(result.reason, 'CAPABILITY_DISABLED_FOR_COMMAND');
      assert.equal(result.value?.error?.code, 'E_COLLAB_EVENTLOG_APPLY_COMMAND_FAILED');
      assert.equal(result.value?.applyResult?.error?.op, 'atlas.evidence.reattach');
      assert.deepEqual(reattachmentWholeFixtureRoster(h), before, 'covers Documents, Stage10 receipts and userData integrity anchors');
      assert.equal(JSON.stringify(JSON.parse(fs.readFileSync(x.f.manifestPath)).atlas.decisions[x.decisionId]), physicalRecordBefore);
      x.assertOriginal();
    });
});

test('actual Main preserves saved original and prior reattachment through re-edit second distinct correction and reopen', async t => {
  const x = await reattachmentMainFixture(t), { h, projectId, entityId } = x;
  const firstSource = await h.query('query.atlasEntityDossier', { projectId, entityId }); assert.equal(firstSource.ok, true);
  const source = firstSource.atlasEntityDossier.evidenceLedger.sourceRecords?.find(row => row.sourceRecordId === x.decisionId);
  assert.ok(source, 'cold query must expose preserved confirmation without creating another author decision');
  assert.deepEqual(source.evidenceAnchor, x.original.evidenceAnchor); assert.equal(source.projectId, projectId);
  assert.equal((await x.command('atlas.evidence.reattach', { ...x.payload(x.shifted, 'z-earlier'),
    staleEvidenceAnchor: source.evidenceAnchor, expectedSourceRecordHash: source.sourceRecordHash })).ok, true);
  const prior = JSON.parse(fs.readFileSync(x.f.manifestPath)).atlas.evidenceReattachments['z-earlier'];
  const priorBytes = Buffer.from(x.canonicalSerialize(prior), 'utf8'), priorHash = x.hash(prior);
  x.assertOriginal();
  const changed = await x.save('Добавлено. ' + EXACT_ATLAS_TEXT + ' Позже.'); assert.equal(changed.summary.confirmedMentionCount, 0);
  const review = (await h.query('query.atlasEntityDossier', { projectId, entityId })).atlasEntityDossier;
  assert.equal(review.summary.reviewRequiredEvidenceCount, 1); assert.equal(review.summary.reattachedEvidenceCount, 0);
  assert.equal(review.evidenceLedger.sourceRecords[0].currentEvidenceAnchor, null);
  assert.equal((await x.command('atlas.evidence.reattach', x.payload(changed, 'a-later', 25))).ok, true);
  const manifest = JSON.parse(fs.readFileSync(x.f.manifestPath)); assert.equal(Object.keys(manifest.atlas.evidenceReattachments).length, 2);
  assert.deepEqual(manifest.atlas.evidenceReattachments['z-earlier'], prior);
  assert.deepEqual(Buffer.from(x.canonicalSerialize(manifest.atlas.evidenceReattachments['z-earlier']), 'utf8'), priorBytes);
  assert.equal(x.hash(manifest.atlas.evidenceReattachments['z-earlier']), priorHash); x.assertOriginal();
  const beforeRead = reattachmentWholeFixtureRoster(h); await x.query(); await h.query('query.atlasEntityDossier', { projectId, entityId });
  assert.deepEqual(reattachmentWholeFixtureRoster(h), beforeRead);
  const sceneBytes = fs.readFileSync(x.f.scenePath); assert.equal((await h.main.handleProjectLifecycleOpenCommand({ projectId })).ok, true);
  assert.equal((await x.query()).mentions.find(m => m.startOffset === 25).trustState, 'AUTHOR_CONFIRMED');
  assert.deepEqual(JSON.parse(fs.readFileSync(x.f.manifestPath)).atlas, manifest.atlas); assert.deepEqual(fs.readFileSync(x.f.scenePath), sceneBytes);
});

test('actual reattachment route refuses stale target revoked capability owner foreign project and commit CAS without author writes', async t => {
  for (const fault of ['stale', 'capability', 'owner', 'foreign-project', 'revision']) await t.test(fault, async t => {
    let expected, reached = false, armed = false, x;
    x = await reattachmentMainFixture(t, false, h => {
      if (fault === 'revision') h.main.__host.afterTruth(() => {
        if (!armed) return;
        reached = true; const m = JSON.parse(fs.readFileSync(x.f.manifestPath)); m.concurrentAuthor = 'preserved'; m.lastCommandId += 7;
        fs.writeFileSync(x.f.manifestPath, JSON.stringify(m)); expected = reattachmentWholeFixtureRoster(h);
      });
    });
    const { h } = x, payload = x.payload(x.shifted, 'must-not-write');
    if (fault === 'stale') await x.save('Добавлено. ' + EXACT_ATLAS_TEXT + ' Позже.');
    if (fault === 'capability') h.main.__host.denyCapability('cap.atlas.evidence.reattach');
    if (fault === 'owner') h.main.__host.revokeOwner();
    if (fault === 'foreign-project') payload.projectId = 'foreign';
    const physicalRecordBefore = JSON.stringify(JSON.parse(fs.readFileSync(x.f.manifestPath)).atlas.decisions[x.decisionId]);
    expected = reattachmentWholeFixtureRoster(h); armed = true;
    const result = await x.command('atlas.evidence.reattach', payload);
    assert.equal(result.ok, false, JSON.stringify(result)); assert.notEqual(result.reason, 'WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED');
    if (fault === 'revision') { assert.equal(reached, true); assert.equal(result.reason, 'PRODUCT_COMMAND_REVISION_CONFLICT'); }
    assert.deepEqual(reattachmentWholeFixtureRoster(h), expected);
    assert.equal(JSON.stringify(JSON.parse(fs.readFileSync(x.f.manifestPath)).atlas.decisions[x.decisionId]), physicalRecordBefore);
    x.assertOriginal();
  });
});

test('actual registered Main result and whole Atlas journey agree on persistence while corrupt response ports fail closed', async t => {
  const x = await reattachmentMainFixture(t), { h } = x, vm = require('node:vm');
  const dossier = (await h.query('query.atlasEntityDossier', { projectId: x.projectId, entityId: x.entityId })).atlasEntityDossier;
  const source = dossier.evidenceLedger.sourceRecords.find(row => row.sourceRecordId === x.decisionId);
  const target = x.shifted.mentions.find(row => row.startOffset === 68); assert.ok(source); assert.ok(target);
  const envelope = require('../../src/core/document-content-envelope-v1.cjs'), sceneBytes = fs.readFileSync(x.f.scenePath);
  const liveText = envelope.parseObservablePayload(sceneBytes.toString('utf8')).text, issued = [], renders = [], refreshes = [];
  let actualResult, sent, backendCalls = 0;
  const c = { currentProjectId: x.projectId, currentDocumentId: x.sceneId, atlasSelectedEntityId: x.entityId,
    currentRightTab: 'atlas', currentAtlasSurface: 'journey', currentTreeContentPublicationId: 'finite-real-dispatch-publication',
    localDirty: false, localEditGeneration: h.editor.generation, lastAckedGeneration: h.editor.generation,
    atlasPublicationEpoch: 0, atlasJourneyDraftRevision: 0, manualMapDraftOwnership: 0, manualMapDraftRevision: 0,
    atlasCommandPublicationSequence: 0, atlasJourneyState: { status: 'idle', commandSeq: 0 },
    atlasCurrentSceneState: structuredClone(x.shifted), atlasEntityDossierState: structuredClone(dossier),
    hashCanonicalValue: x.hash, parseDocumentContent: envelope.parseObservablePayload,
    getPlainText: () => liveText, composeDocumentContent: () => sceneBytes.toString('utf8'),
    crypto: { randomUUID: () => { const id = crypto.randomUUID(); issued.push(id); return id; } }, console,
    updateStatusText() {}, renderAtlasJourneyState: () => renders.push(c.atlasJourneyState.status),
    refreshAtlasCurrentScene: async options => { assert.equal(options.isCurrent(), true); refreshes.push('scene'); c.atlasCurrentSceneState = await x.query(); },
    refreshAtlasProductSurfaces: async options => { assert.equal(options.isCurrent(), true); refreshes.push('surfaces'); },
    dispatchUiCommand: async (id, payload) => { backendCalls++; sent = structuredClone(payload); actualResult = (await x.ui(id, payload)).result; return actualResult; },
  };
  const editor = read('src/renderer/editor.js');
  const names = ['getAtlasJourneyMentions', 'findAtlasJourneyMention', 'captureAtlasPublication',
    'getAtlasReattachmentSources', 'isAtlasReattachmentSource', 'getAtlasReattachmentContext',
    'isAtlasReattachmentCurrent', 'getAtlasReattachmentIntent', 'runAtlasReattachmentCommand'];
  const actual = name => { const start = editor.indexOf((name.startsWith('runAtlas') ? 'async ' : '') + 'function ' + name + '(');
    assert.ok(start >= 0); const end = editor.indexOf('\n}\n', start); assert.ok(end > start); return editor.slice(start, end + 2); };
  vm.createContext(c); vm.runInContext(names.map(actual).join('\n'), c);
  c.atlasJourneyDraft = { reattachmentSource: structuredClone(source), reattachmentContext: c.getAtlasReattachmentContext(),
    reattachmentTarget: target.mentionId, reattachmentId: '', reattachmentIntentKey: '', reattachmentPending: false };
  await c.runAtlasReattachmentCommand();
  const receipt = actualResult.value.result.receipt, persisted = JSON.parse(fs.readFileSync(x.f.manifestPath)).atlas.evidenceReattachments[sent.reattachmentId];
  assert.equal(actualResult.ok, true); assert.equal(actualResult.value.performed, true);
  assert.equal(actualResult.value.commandAuthority, 'CommandKernel'); assert.equal(actualResult.value.commandId, 'atlas.evidence.reattach');
  assert.equal(actualResult.value.result.ok, true); assert.equal(receipt.schemaVersion, 'command-kernel.receipt.v1');
  assert.equal(receipt.commandId, 'atlas.evidence.reattach'); assert.equal(receipt.status, 'APPLIED');
  assert.equal(receipt.capabilityRevalidated, true); assert.equal(receipt.storageWritten, true); assert.ok(persisted);
  assert.equal(persisted.newEvidenceAnchor.startOffset, 68); assert.equal(persisted.sourceRecordHash, x.originalHash); x.assertOriginal();
  t.diagnostic(JSON.stringify({ realRegisteredResponse: true, receiptSchema: receipt.schemaVersion, receiptStatus: receipt.status,
    commandId: receipt.commandId, persistedId: persisted.id, backendCalls }));
  await t.test('real canonical write reports applied persisted and retires its intent UUID', () => {
    assert.equal(c.atlasJourneyState.status, 'applied', 'real saved operation must not be shown as failed');
    assert.equal(c.atlasJourneyState.lastResult, 'persisted'); assert.equal(c.atlasJourneyDraft.reattachmentId, '');
    assert.equal(c.atlasJourneyDraft.reattachmentTarget, ''); assert.equal(issued.length, 1); assert.ok(renders.includes('applied'));
  });
  const afterCanonical = reattachmentWholeFixtureRoster(h);
  const corruptions = [
    ['bare-ok', () => ({ ok: true })], ['unknown-object', () => ({ ok: true, value: { notice: 'UNKNOWN' } })],
    ['shallow-status', r => ({ ok: true, value: { status: r.value.result.receipt.status } })],
    ['missing-performed', r => { delete r.value.performed; return r; }],
    ['wrong-authority', r => { r.value.commandAuthority = 'renderer'; return r; }],
    ['wrong-command', r => { r.value.commandId = 'atlas.mention.confirm'; return r; }],
    ['inner-failure', r => { r.value.result.ok = false; return r; }],
    ['missing-receipt', r => { delete r.value.result.receipt; return r; }],
    ['wrong-schema', r => { r.value.result.receipt.schemaVersion = 'unknown'; return r; }],
    ['wrong-receipt-command', r => { r.value.result.receipt.commandId = 'atlas.mention.confirm'; return r; }],
    ['unknown-status', r => { r.value.result.receipt.status = 'UNKNOWN'; return r; }],
    ['unvalidated-capability', r => { r.value.result.receipt.capabilityRevalidated = false; return r; }],
    ['storage-not-written', r => { r.value.result.receipt.storageWritten = false; return r; }],
  ];
  for (const [name, corrupt] of corruptions) await t.test('finite UI response corruption: ' + name, async () => {
    const response = corrupt(structuredClone(actualResult)); let retryId;
    c.atlasJourneyDraft = { ...c.atlasJourneyDraft, reattachmentContext: c.getAtlasReattachmentContext(),
      reattachmentTarget: target.mentionId, reattachmentId: '', reattachmentIntentKey: '', reattachmentPending: false };
    // This finite response port does not invoke Main or establish a canonical refusal.
    c.dispatchUiCommand = async (_id, payload) => { retryId = payload.reattachmentId; return response; };
    await c.runAtlasReattachmentCommand();
    assert.equal(c.atlasJourneyState.status, 'failed', name); assert.notEqual(c.atlasJourneyState.lastResult, 'persisted');
    assert.ok(retryId); assert.equal(c.atlasJourneyDraft.reattachmentId, retryId, 'unconfirmed response retains retry identity');
    assert.equal(backendCalls, 1); assert.deepEqual(reattachmentWholeFixtureRoster(h), afterCanonical); x.assertOriginal();
  });
  assert.deepEqual(fs.readFileSync(x.f.scenePath), sceneBytes); assert.ok(refreshes.includes('scene'));
});

// Actual Main/Kernel/Core/Stage10 route; unpackaged is explicit and is never a packaged-policy bypass claim.
async function explicitSuppressionMainFixture(t, { packaged = false, beforeProject, historicalV7Constructor = false } = {}) {
  const x = await reattachmentMainFixture(t, packaged, beforeProject, { historicalV7Constructor });
  const payload = (projection = x.shifted, id = 'suppression-control', offset = 25) => {
    const mention = projection.mentions.find(m => m.startOffset === offset); assert.ok(mention);
    return { projectId: x.projectId, sceneId: x.sceneId, entityId: x.entityId, mentionId: mention.mentionId, suppressionId: id,
      evidenceAnchor: { ...structuredClone(mention.evidenceAnchor), retainedSuppressionData: { unicode: 'é 🧭', values: [null, 3, { keep: true }] } }, reason: 'Explicit mistaken occurrence' };
  };
  const dispatch = p => x.ui('atlas.observation.suppress', p);
  const dossier = async () => { const r = await x.h.query('query.atlasEntityDossier', { projectId: x.projectId, entityId: x.entityId }); assert.equal(r.ok, true); return r.atlasEntityDossier; };
  const stored = id => JSON.parse(fs.readFileSync(x.f.manifestPath)).atlas.suppressions[id];
  return { ...x, payload, dispatch, dossier, stored };
}
function assertActualSuppressionReceipt(result) {
  assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(result.value.performed, true); assert.equal(result.value.commandAuthority, 'CommandKernel');
  assert.equal(result.value.commandId, 'atlas.observation.suppress'); assert.equal(result.value.result.ok, true);
  const receipt = result.value.result.receipt; assert.equal(receipt.schemaVersion, 'command-kernel.receipt.v1');
  assert.equal(receipt.commandId, 'atlas.observation.suppress'); assert.equal(receipt.status, 'APPLIED');
  assert.equal(receipt.capabilityRevalidated, true); assert.equal(receipt.storageWritten, true); return receipt;
}

test('actual unpackaged registered suppression reaches canonical Core and persists one exact occurrence with typed APPLIED and cold readback', async t => {
  let reached = false, armed = false;
  const x = await explicitSuppressionMainFixture(t, { beforeProject: h => h.main.__host.afterTruth(() => { if (armed) reached = true; }) });
  const scene = fs.readFileSync(x.f.scenePath), p = x.payload(); armed = true;
  const response = await x.dispatch(p); assert.equal(reached, true); const receipt = assertActualSuppressionReceipt(response.result);
  assert.equal(response.mainResult.ok, true); const original = structuredClone(x.stored(p.suppressionId)); assert.ok(original);
  assert.equal(original.mentionId, p.mentionId); assert.deepEqual(original.evidenceAnchor, p.evidenceAnchor); x.assertOriginal();
  const dossier = await x.dossier(); assert.equal(dossier.summary.observationCount, 2); assert.equal(dossier.summary.activeObservationCount, 1);
  assert.equal(dossier.summary.suppressedObservationCount, 1); assert.equal(dossier.evidenceLedger.rows.some(r => r.evidenceState === 'SUPPRESSED'), true);
  const source = dossier.evidenceLedger.sourceRecords.find(r => r.sourceRecordKind === 'suppression' && r.sourceRecordId === p.suppressionId);
  assert.ok(source); assert.equal(source.sourceRecordHash, x.hash(original)); assert.deepEqual(source.evidenceAnchor, original.evidenceAnchor);
  const beforeRead = reattachmentWholeFixtureRoster(x.h); await x.query(); await x.dossier(); assert.deepEqual(reattachmentWholeFixtureRoster(x.h), beforeRead);
  assert.equal((await x.h.main.handleProjectLifecycleOpenCommand({ projectId: x.projectId })).ok, true);
  assert.deepEqual(x.stored(p.suppressionId), original); assert.equal(x.hash(x.stored(p.suppressionId)), x.hash(original));
  assert.equal((await x.dossier()).summary.suppressedObservationCount, 1); assert.deepEqual(fs.readFileSync(x.f.scenePath), scene); x.assertOriginal();
  t.diagnostic(JSON.stringify({ actualRegisteredProducer: true, canonicalReach: reached, receipt, persistedSuppression: original }));
});

test('packaged V6 suppression denial is configuration evidence and the declared successor must admit only that additional command', async t => {
  const x = await explicitSuppressionMainFixture(t, { packaged: true, historicalV7Constructor: true }), before = reattachmentWholeFixtureRoster(x.h), profile = x.h.main.__profile();
  const legacy = require('../../src/core/writer-local-profile-v1.cjs').createWriterAtlasEvidenceReattachmentProfileProjection({ isPackaged: true, platform: 'darwin' });
  assert.equal(require('../../src/core/writer-local-profile-v1.cjs').evaluateWriterLocalCommandAccess({ profile: legacy, commandId: 'atlas.observation.suppress',
    productCommandRecord: productRegistry.getProductCommandRecord('atlas.observation.suppress') }).allowed, false);
  if (profile.profileId === 'WRITER_LOCAL_ATLAS_EVIDENCE_REATTACHMENT_V6') {
    const denied = await x.dispatch(x.payload()); assert.equal(denied.mainResult.ok, false);
    assert.equal(denied.mainResult.reason, 'WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED'); assert.deepEqual(reattachmentWholeFixtureRoster(x.h), before);
    t.diagnostic('CONFIGURATION_ONLY: actual packaged V6 refuses suppression before Core; this is not semantic refusal evidence');
  }
  assert.equal(profile.profileId, 'WRITER_LOCAL_ATLAS_EXPLICIT_SUPPRESSION_V7', 'declared packaged successor is not yet selected');
  assert.equal(profile.admittedCommandIds.length, 22); assertActualSuppressionReceipt((await x.dispatch(x.payload())).result);
});

test('actual unpackaged suppression raw identity refusals reach Core after lawful positive and preserve complete Documents and userData rosters', async t => {
  for (const key of ['projectId', 'sceneId', 'entityId']) for (const value of ['foreign', null, 42, { forged: true }, 'PADDED'])
    await t.test(`${key}-${JSON.stringify(value)}`, async t => {
      let armed = false, reached = false;
      const x = await explicitSuppressionMainFixture(t, { beforeProject: h => h.main.__host.afterTruth(() => { if (armed) reached = true; }) });
      assertActualSuppressionReceipt((await x.dispatch(x.payload())).result);
      const first = structuredClone(x.stored('suppression-control')), physicalFirst = JSON.stringify(first), p = x.payload(x.shifted, 'must-not-write', 68);
      p.evidenceAnchor[key] = value === 'PADDED' ? ' ' + p.evidenceAnchor[key] + ' ' : value;
      const before = reattachmentWholeFixtureRoster(x.h); armed = true; const response = await x.dispatch(p), after = reattachmentWholeFixtureRoster(x.h);
      t.diagnostic(JSON.stringify({ canonicalReach: reached, key, value: p.evidenceAnchor[key], mainResult: response.mainResult,
        beforeRosterHash: x.hash(before), afterRosterHash: x.hash(after), unexpectedSuppression: x.stored('must-not-write') || null }));
      assert.equal(reached, true, 'observer installed before actual lifecycle captured canonical prepare');
      assert.equal(response.mainResult.ok, false, JSON.stringify(response.mainResult)); assert.notEqual(response.mainResult.reason, 'WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED');
      assert.equal(response.mainResult.value?.applyResult?.error?.op, 'atlas.observation.suppress', 'typed Core refusal, not absent route');
      assert.deepEqual(after, before); assert.deepEqual(x.stored('suppression-control'), first);
      assert.equal(JSON.stringify(x.stored('suppression-control')), physicalFirst); assert.equal(x.stored('must-not-write'), undefined); x.assertOriginal();
    });
});

test('actual suppression stale capability owner foreign project and source CAS refusals preserve author data', async t => {
  for (const fault of ['stale', 'capability', 'owner', 'foreign-project', 'revision']) await t.test(fault, async t => {
    let armed = false, reached = false, expected, x;
    x = await explicitSuppressionMainFixture(t, { beforeProject: h => h.main.__host.afterTruth(() => {
      if (!armed || fault !== 'revision') return; reached = true;
      const m = JSON.parse(fs.readFileSync(x.f.manifestPath)); m.concurrentSuppressionAuthor = 'preserved'; m.lastCommandId += 5;
      fs.writeFileSync(x.f.manifestPath, JSON.stringify(m)); expected = reattachmentWholeFixtureRoster(h);
    }) });
    assertActualSuppressionReceipt((await x.dispatch(x.payload())).result); const p = x.payload(x.shifted, 'must-not-write', 68);
    if (fault === 'stale') await x.save('Добавлено. ' + EXACT_ATLAS_TEXT + ' Позже.');
    if (fault === 'capability') x.h.main.__host.denyCapability('cap.atlas.observation.suppress');
    if (fault === 'owner') x.h.main.__host.revokeOwner(); if (fault === 'foreign-project') p.projectId = 'foreign';
    const original = structuredClone(x.stored('suppression-control')), physical = JSON.stringify(original);
    expected = reattachmentWholeFixtureRoster(x.h); armed = true; const r = await x.dispatch(p);
    assert.equal(r.mainResult.ok, false, JSON.stringify(r.mainResult)); assert.notEqual(r.mainResult.reason, 'WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED');
    if (fault === 'revision') { assert.equal(reached, true); assert.equal(r.mainResult.reason, 'PRODUCT_COMMAND_REVISION_CONFLICT'); }
    if (fault === 'stale') assert.equal(r.mainResult.value?.applyResult?.error?.code, 'E_ATLAS_EVIDENCE_STALE');
    assert.deepEqual(reattachmentWholeFixtureRoster(x.h), expected); assert.deepEqual(x.stored('suppression-control'), original);
    assert.equal(JSON.stringify(x.stored('suppression-control')), physical); x.assertOriginal();
  });
});

test('actual Main suppression re-edit reattachment repeated correction and cold readback agree with original raw source and history', async t => {
  const x = await explicitSuppressionMainFixture(t), p = x.payload(); assertActualSuppressionReceipt((await x.dispatch(p)).result);
  const original = structuredClone(x.stored(p.suppressionId)), originalHash = x.hash(original), originalCanonical = x.canonicalSerialize(original);
  const assertSaved = () => { assert.deepEqual(x.stored(p.suppressionId), original); assert.equal(x.hash(x.stored(p.suppressionId)), originalHash);
    assert.equal(x.canonicalSerialize(x.stored(p.suppressionId)), originalCanonical); x.assertOriginal(); };
  const changed = await x.save('Добавлено. ' + EXACT_ATLAS_TEXT + ' Позже.'); assertSaved();
  const review = await x.dossier(); assert.equal(review.summary.reviewRequiredEvidenceCount >= 1, true);
  assert.equal(review.summary.suppressedObservationCount, 0, 'unchanged mention ID is not a current source witness');
  const attach = async (projection, id, offset) => {
    const target = projection.mentions.find(m => m.startOffset === offset); assert.ok(target);
    const r = await x.command('atlas.evidence.reattach', { projectId: x.projectId, sourceRecordKind: 'suppression', sourceRecordId: original.id,
      expectedSourceRecordHash: originalHash, staleEvidenceAnchor: original.evidenceAnchor, newEvidenceAnchor: target.evidenceAnchor, reattachmentId: id, reason: 'Explicit correction' });
    assert.equal(r.ok, true, JSON.stringify(r)); assertSaved(); return structuredClone(JSON.parse(fs.readFileSync(x.f.manifestPath)).atlas.evidenceReattachments[id]);
  };
  const first = await attach(changed, 'z-first-suppression-correction', 68); assert.equal((await x.dossier()).summary.suppressedObservationCount, 1);
  const later = await x.save('Добавлено. ' + EXACT_ATLAS_TEXT + ' Снова.'); assert.equal((await x.dossier()).summary.suppressedObservationCount, 0);
  const second = await attach(later, 'a-later-suppression-correction', 25);
  assert.equal((await x.dossier()).summary.suppressedObservationCount, 1); assert.notEqual(first.id, second.id);
  const manifest = JSON.parse(fs.readFileSync(x.f.manifestPath)); assert.deepEqual(manifest.atlas.evidenceReattachments[first.id], first);
  const identity = (await import('../../src/product/stage10ProjectIdentityKey.mjs')).stage10ProjectPathIdentity(x.projectId); assert.equal(identity.ok, true);
  const metadataPaths = [path.join('userData', 'project-library-index.v1.json'), path.join('userData', 'stage10-integrity-anchors', identity.canonicalKey, 'fencing-generation.v1.json')];
  const beforeCold = reattachmentWholeFixtureRoster(x.h), beforeDocuments = x.h.roster();
  const beforeRaw = metadataPaths.map(file => fs.readFileSync(path.join(x.h.root, file))), [beforeIndex, beforeFence] = beforeRaw.map(raw => JSON.parse(raw));
  const startedAt = Date.now(), startedMonotonic = Number(process.hrtime.bigint() / 1_000_000n);
  assert.equal((await x.h.main.handleProjectLifecycleOpenCommand({ projectId: x.projectId })).ok, true);
  const endedAt = Date.now(), endedMonotonic = Number(process.hrtime.bigint() / 1_000_000n);
  const afterRaw = metadataPaths.map(file => fs.readFileSync(path.join(x.h.root, file))), [afterIndex, afterFence] = afterRaw.map(raw => JSON.parse(raw));
  t.diagnostic(JSON.stringify({ ordinaryReopenMetadata: metadataPaths.map((file, i) => ({ file, before: beforeRaw[i].toString('utf8'), after: afterRaw[i].toString('utf8') })),
    startedAt, endedAt, startedMonotonic, endedMonotonic }));
  const currentEntry = beforeIndex.entries.find(entry => entry.projectRoot === path.dirname(x.f.manifestPath)); assert.ok(currentEntry);
  assert.equal(currentEntry.projectId, x.projectId); assert.equal(currentEntry.manifestPath, x.f.manifestPath); assert.equal(currentEntry.status, 'available');
  const openedAt = afterIndex.entries[0].lastOpenedAtUtc, updatedAt = afterIndex.updatedAtUtc;
  for (const timestamp of [openedAt, updatedAt]) { const ms = Date.parse(timestamp); assert.ok(ms >= startedAt && ms <= endedAt); assert.equal(new Date(ms).toISOString(), timestamp); }
  assert.ok(Date.parse(updatedAt) >= Date.parse(openedAt));
  const expectedIndex = { schemaVersion: 'project-library-index.v1', updatedAtUtc: updatedAt, entries: [{ ...currentEntry,
    projectName: manifest.projectName, createdAtUtc: manifest.createdAtUtc, lastOpenedAtUtc: openedAt, lastSeenAtUtc: openedAt,
    manifestHash: crypto.createHash('sha256').update(JSON.stringify(x.h.main.getProjectManifestComparable(manifest))).digest('hex') },
  ...beforeIndex.entries.filter(entry => entry.projectRoot !== currentEntry.projectRoot)] };
  assert.deepEqual(afterIndex, expectedIndex);
  assert.equal(beforeFence.schemaVersion, 'yalken.mainProjectLeaseFence.v2'); assert.equal(beforeFence.projectId, x.projectId);
  assert.ok(typeof beforeFence.processInstanceId === 'string' && beforeFence.processInstanceId); assert.equal(beforeFence.ownerPid, process.pid);
  assert.ok(Number.isSafeInteger(beforeFence.fencingGeneration) && beforeFence.fencingGeneration > 0);
  assert.match(afterFence.ownerTokenDigest, /^[a-f0-9]{64}$/u); assert.notEqual(afterFence.ownerTokenDigest, beforeFence.ownerTokenDigest);
  assert.ok(Number.isSafeInteger(afterFence.issuedAtMs) && afterFence.issuedAtMs >= startedAt && afterFence.issuedAtMs <= endedAt);
  assert.ok(Number.isSafeInteger(afterFence.monotonicIssuedAtMs) && afterFence.monotonicIssuedAtMs >= startedMonotonic && afterFence.monotonicIssuedAtMs <= endedMonotonic);
  const expectedFence = { schemaVersion: 'yalken.mainProjectLeaseFence.v2', projectId: x.projectId, processInstanceId: beforeFence.processInstanceId,
    fencingGeneration: beforeFence.fencingGeneration + 2, ownerTokenDigest: afterFence.ownerTokenDigest, ownerPid: process.pid,
    issuedAtMs: afterFence.issuedAtMs, monotonicIssuedAtMs: afterFence.monotonicIssuedAtMs };
  assert.deepEqual(afterFence, expectedFence);
  for (const [i, expected] of [expectedIndex, expectedFence].entries()) {
    assert.deepEqual(beforeRaw[i], Buffer.from(JSON.stringify(JSON.parse(beforeRaw[i]), null, 2) + '\n'));
    assert.deepEqual(afterRaw[i], Buffer.from(JSON.stringify(expected, null, 2) + '\n'));
  }
  const validatedMetadata = new Map(metadataPaths.map((file, i) => [file, crypto.createHash('sha256').update(afterRaw[i]).digest('hex')]));
  const expectedCold = beforeCold.map(([file, hash]) => [file, validatedMetadata.get(file) || hash]);
  assert.deepEqual(reattachmentWholeFixtureRoster(x.h), expectedCold); assert.deepEqual(x.h.roster(), beforeDocuments); assertSaved();
  assert.equal((await x.dossier()).summary.suppressedObservationCount, 1); assert.deepEqual(JSON.parse(fs.readFileSync(x.f.manifestPath)).atlas.evidenceReattachments[second.id], second);
});

// Execute existing runProductJourneyCommand and actual select listener, with only presentation/transport ports finite.
async function actualSuppressionJourneyContext(x) {
  const vm = require('node:vm'), envelope = require('../../src/core/document-content-envelope-v1.cjs');
  const current = await x.query(), target = current.mentions.find(m => m.startOffset === 68), bytes = fs.readFileSync(x.f.scenePath), issued = [];
  let actualResult, sent, backendCalls = 0;
  const c = { currentProjectId: x.projectId, currentDocumentId: x.sceneId, atlasSelectedEntityId: x.entityId, currentRightTab: 'atlas', currentAtlasSurface: 'journey',
    currentTreeContentPublicationId: 'real-suppression-publication', localDirty: false, localEditGeneration: x.h.editor.generation, lastAckedGeneration: x.h.editor.generation,
    atlasPublicationEpoch: 0, atlasJourneyDraftRevision: 0, manualMapDraftOwnership: 0, manualMapDraftRevision: 0, atlasCommandPublicationSequence: 0,
    atlasStableUiIdSeq: 0, atlasJourneyState: { status: 'idle', commandSeq: 0 }, atlasJourneyDraft: { sourceEntityId: x.entityId, mentionId: '', suppressionId: '' },
    atlasCurrentSceneState: current, hashCanonicalValue: x.hash, parseDocumentContent: envelope.parseObservablePayload,
    getPlainText: () => envelope.parseObservablePayload(bytes.toString('utf8')).text, composeDocumentContent: () => bytes.toString('utf8'),
    crypto: { randomUUID: () => { const id = crypto.randomUUID(); issued.push(id); return id; } }, console, updateStatusText() {}, renderAtlasJourneyState() {},
    refreshAtlasCurrentScene: async () => { c.atlasCurrentSceneState = await x.query(); }, refreshAtlasProductSurfaces: async () => {},
    dispatchUiCommand: async (id, payload) => { sent = structuredClone(payload); backendCalls++; actualResult = (await x.ui(id, payload)).result; return actualResult; },
    document: { createElement: tag => ({ tagName: tag.toUpperCase(), children: [], parentElement: null, dataset: {}, listeners: {}, value: '',
      get isConnected() { return this === c.document.body || !!this.parentElement?.isConnected; },
      appendChild(n) { n.parentElement = this; this.children.push(n); }, append(...nodes) { nodes.forEach(n => this.appendChild(n)); },
      addEventListener(name, fn) { this.listeners[name] = fn; } }) } };
  const source = read('src/renderer/editor.js'), names = ['getAtlasJourneyMentions', 'findAtlasJourneyMention', 'getAtlasJourneyEntities', 'findAtlasJourneyEntity',
    'captureAtlasPublication', 'runProductJourneyCommand', 'appendAtlasJourneySelect', 'makeStableUiId', 'ensureAtlasJourneyDraftId'];
  for (const match of source.matchAll(/^(?:async )?function (\w*AtlasSuppression\w*)\(/gm)) names.push(match[1]);
  const actual = name => { const m = new RegExp('^(?:async )?function ' + name + '\\(', 'm').exec(source); assert.ok(m, 'existing actual handler: ' + name);
    const end = source.indexOf('\n}\n', m.index); assert.ok(end > m.index); return source.slice(m.index, end + 2); };
  vm.createContext(c); vm.runInContext([...new Set(names)].map(actual).join('\n'), c);
  c.document.body = c.document.createElement('body'); let host;
  const choose = async () => {
    if (host) { const index = c.document.body.children.indexOf(host); assert.ok(index >= 0); c.document.body.children.splice(index, 1); host.parentElement = null; }
    host = c.document.createElement('section'); c.document.body.append(host);
    const select = c.appendAtlasJourneySelect(host, { fieldName: 'mentionId', value: '', options: current.mentions.map(m => ({ value: m.mentionId, label: m.matchedText })) });
    assert.equal(select.isConnected, true); select.value = target.mentionId; await select.listeners.change();
  };
  const apply = async () => c.runProductJourneyCommand('atlas.observation.suppress', { ...x.payload(current, c.ensureAtlasJourneyDraftId('suppressionId', 'atlas-suppression'), 68) });
  return { c, issued, choose, apply, target, actualResult: () => actualResult, sent: () => sent, backendCalls: () => backendCalls };
}

test('real registered suppression producer agrees with whole journey result and finite corrupt ports never invent acceptance', async t => {
  const x = await explicitSuppressionMainFixture(t), h = await actualSuppressionJourneyContext(x); await h.choose(); await h.apply();
  const actual = h.actualResult(); assertActualSuppressionReceipt(actual); assert.ok(x.stored(h.sent().suppressionId)); x.assertOriginal();
  t.diagnostic(JSON.stringify({ actualRegisteredSuppressionResponse: actual, persistedId: h.sent().suppressionId, issued: h.issued }));
  await t.test('actual persisted result retires only this suppression intent UUID', () => {
    assert.equal(h.c.atlasJourneyState.status, 'applied'); assert.equal(h.c.atlasJourneyState.lastResult, 'persisted');
    assert.equal(h.c.atlasJourneyDraft.suppressionId, ''); assert.equal(h.issued.length, 1);
    assert.match(h.sent().suppressionId, /^atlas-suppression-[a-f0-9-]{36}$/u);
  });
  const roster = reattachmentWholeFixtureRoster(x.h);
  const corruptions = [['bare-ok', () => ({ ok: true })], ['unknown', () => ({ ok: true, value: { notice: 'unknown' } })],
    ['shallow', () => ({ ok: true, value: { status: 'APPLIED' } })], ['performed', r => { delete r.value.performed; return r; }],
    ['authority', r => { r.value.commandAuthority = 'renderer'; return r; }], ['command', r => { r.value.commandId = 'atlas.mention.confirm'; return r; }],
    ['inner', r => { r.value.result.ok = false; return r; }], ['receipt', r => { delete r.value.result.receipt; return r; }],
    ['schema', r => { r.value.result.receipt.schemaVersion = 'unknown'; return r; }], ['receipt-command', r => { r.value.result.receipt.commandId = 'atlas.evidence.reattach'; return r; }],
    ['status', r => { r.value.result.receipt.status = 'UNKNOWN'; return r; }], ['capability', r => { r.value.result.receipt.capabilityRevalidated = false; return r; }],
    ['storage', r => { r.value.result.receipt.storageWritten = false; return r; }]];
  for (const [name, corrupt] of corruptions) await t.test('finite UI-only producer corruption: ' + name, async () => {
    await h.choose(); let retryId, finiteCalls = 0; h.c.dispatchUiCommand = async (_id, payload) => { finiteCalls++; retryId = payload.suppressionId; return corrupt(structuredClone(actual)); };
    await h.apply(); assert.equal(finiteCalls, 1); assert.equal(h.c.atlasJourneyState.status, 'failed'); assert.notEqual(h.c.atlasJourneyState.lastResult, 'persisted');
    assert.ok(retryId); assert.equal(h.c.atlasJourneyDraft.suppressionId, retryId); assert.equal(h.backendCalls(), 1);
    assert.deepEqual(reattachmentWholeFixtureRoster(x.h), roster); x.assertOriginal();
  });
});

// Current tests use the literal Main constructor. Explicitly named V7/V8
// selection fixtures preserve historical policy without claiming current coverage.
const READ_SURFACE_QUERY_IDS = Object.freeze(['query.atlasCurrentScene', 'query.manualMapWorkbench', 'query.atlasEntityDossier',
  'query.atlasOverview', 'query.atlasRelationDossier', 'query.atlasMatrices', 'query.atlasHeatmap', 'query.atlasTemporalLayout',
  'query.atlasContinuityLedgerSurface', 'query.atlasReportsSavedQueries', 'query.atlasDiagnosticsStageAcceptance', 'query.projectionInspector']);
const READ_SURFACE_COMMAND_IDS = Object.freeze(['atlas.entity.create', 'atlas.alias.add', 'atlas.mention.confirm',
  'atlas.observation.suppress', 'atlas.entity.merge', 'atlas.entity.splitRestore', 'atlas.observation.reassign',
  'atlas.evidence.reattach', 'atlas.savedQuery.save', 'atlas.calendar.define', 'atlas.sceneTemporalAnchor.set', 'atlas.continuityFact.record']);

function assertDiagnosticNoAcceptance(value) {
  assert.equal(value.authority.commandAuthority, 'none'); assert.equal(value.authority.projectTruthMutation, false);
  assert.equal(value.authority.storageMutation, false); assert.equal(value.authority.networkMutation, false);
  assert.equal(value.authority.releaseReadinessClaim, false); assert.equal(value.stageAcceptanceProof.pass, false);
  assert.equal(value.stage06AcceptanceProof.pass, false); assert.equal(value.summary.stageAcceptance, 'not_ready');
  assert.equal(value.finalUiAuditReceipt.finalBar.status, 'NOT_READY');
  assert.equal(value.finalUiAuditReceipt.externalEvidence.allRequiredArtifactsPresent, false);
}

test('historical V8 constructor-selection fixture retains strict V8 and all twenty-two V7 command identities', async t => {
  const h = await fullMacMainFixture(t, { historicalV8Constructor: true }), current = h.main.__profile();
  assert.equal(current.profileId, 'WRITER_LOCAL_ATLAS_READ_SURFACES_V8'); assert.equal(current.schemaVersion, 'writer-local-profile.v8');
  assert.equal(new URL(h.shellUrl).searchParams.get('PRODUCT_PROFILE'), current.profileId);
  assert.deepEqual(current.admittedQueryIds, READ_SURFACE_QUERY_IDS);
  const legacy = profile.createWriterAtlasExplicitSuppressionProfileProjection({ isPackaged: true, platform: 'darwin' });
  assert.deepEqual(current.admittedCommandIds, legacy.admittedCommandIds); assert.equal(current.admittedCommandIds.length, 22);
  for (const key of ['optionalSystemsEnabled', 'signing', 'notarization', 'publicDistribution', 'dependencyAdoption', 'cloudAuthority', 'userDataMutation'])
    assert.equal(current[key], false, key);
});

test('current literal packaged Main returns each existing Atlas read projection with complete immediate no-write controls [FINITE_IPC_NOT_NATIVE]', async t => {
  const x = await reattachmentMainFixture(t, true), { h } = x;
  for (const queryId of READ_SURFACE_QUERY_IDS) await t.test(queryId, async () => {
    const before = reattachmentWholeFixtureRoster(h);
    const result = await h.query(queryId, { projectId: x.projectId, nodeId: x.sceneId, entityId: x.entityId, explicitOpen: true });
    t.diagnostic(JSON.stringify({ queryId, actualProfile: h.main.__profile().profileId, result }));
    try {
      assert.equal(result.ok, true, JSON.stringify(result));
      const value = result[queryId.slice('query.'.length)]; assert.ok(value, queryId);
      assert.equal(value.projectId, x.projectId); assert.notEqual(value.state, 'unavailable', JSON.stringify(value));
      assert.equal(typeof value.state, 'string');
      if (queryId === 'query.atlasCurrentScene') assert.equal(value.sceneId, x.sceneId);
      if (queryId === 'query.atlasDiagnosticsStageAcceptance') assertDiagnosticNoAcceptance(value);
      if (queryId === 'query.projectionInspector') assert.equal(value.authority.commandAuthority, 'none');
    } finally { assert.deepEqual(reattachmentWholeFixtureRoster(h), before, 'all Documents, Stage10 receipts and userData bytes'); x.assertOriginal(); }
  });
});

test('historical V8 constructor-selection fixture retains reader caller foreign identity and spoofed authority refusals', async t => {
  const x = await reattachmentMainFixture(t, true, undefined, { historicalV8Constructor: true }), { h } = x;
  const control = await x.query(); assert.equal(control.projectId, x.projectId);
  const before = reattachmentWholeFixtureRoster(h), envelope = require('../../src/core/ipc-envelope-v1.cjs');
  const handler = h.handlers.get('ui:workspace-query-bridge');
  for (const queryId of READ_SURFACE_QUERY_IDS) {
    for (const near of [' ' + queryId, queryId + ' ', queryId + '.extra']) {
      const r = await h.query(near, { projectId: x.projectId }); assert.equal(r.ok, false); assert.equal(r.error, 'QUERY_ID_NOT_ALLOWED', near);
      assert.deepEqual(reattachmentWholeFixtureRoster(h), before);
    }
    const r = await h.query(queryId, { projectId: 'foreign-read-project', nodeId: x.sceneId, entityId: x.entityId, explicitOpen: true });
    assert.notEqual(r.error, 'WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED', 'configuration refusal is not foreign-project read evidence: ' + queryId);
    assert.equal(r.ok === false || r[queryId.slice(6)]?.state === 'unavailable', true, JSON.stringify(r));
    assert.deepEqual(reattachmentWholeFixtureRoster(h), before);
  }
  for (const patch of [{ v: 999 }, { payload: [] }, { extraAuthority: true }]) {
    const request = { ...envelope.createEnvelope('ui:workspace-query-bridge', 'query.atlasCurrentScene', { projectId: x.projectId, nodeId: x.sceneId }), ...patch };
    const r = await handler(h.event(), request); assert.equal(r.ok, false); assert.match(r.error, /^E_ENVELOPE_/u);
  }
  const event = h.event(), request = envelope.createEnvelope('ui:workspace-query-bridge', 'query.atlasCurrentScene', { projectId: x.projectId, nodeId: x.sceneId });
  for (const bad of [{ ...event, sender: { ...event.sender, id: 999 } }, { ...event, sender: { ...event.sender, session: {} } },
    { ...event, senderFrame: { url: h.shellUrl.replace(/PRODUCT_PROFILE=[^&]*/u, 'PRODUCT_PROFILE=WRITER_LOCAL_V1') } }]) {
    await assert.rejects(async () => handler(bad, request), /E_IPC_/u);
    assert.deepEqual(reattachmentWholeFixtureRoster(h), before);
  }
  for (const queryId of ['query.collabScopeLocal', 'query.stage10ProductState']) {
    const r = await h.query(queryId, { projectId: x.projectId, profileId: 'WRITER_LOCAL_ATLAS_READ_SURFACES_V8', optionalSystemsEnabled: true, tier: 'pro' });
    assert.equal(r.ok, false); assert.equal(r.error, 'WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED');
  }
  for (const id of READ_SURFACE_COMMAND_IDS.filter(id => !h.main.__profile().admittedCommandIds.includes(id))) {
    const r = await h.command(id, { projectId: x.projectId, profileId: 'WRITER_LOCAL_ATLAS_READ_SURFACES_V8', tier: 'pro', capabilities: { [id]: true } });
    assert.equal(r.ok, false); assert.equal(r.reason, 'WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED', id);
  }
  assert.deepEqual(reattachmentWholeFixtureRoster(h), before); x.assertOriginal();
});

for (const packaged of [false, true]) test(`current ${packaged ? 'packaged' : 'unpackaged'} Main diagnostics uses trusted policy and recomputes identical read after matrix revocation [FINITE_IPC_NOT_NATIVE]`, async t => {
  // Unpackaged is an honest source-route causal control for policy/cache on M;
  // it never substitutes for the separate packaged successor cases above.
  const x = await reattachmentMainFixture(t, packaged), { h } = x, before = reattachmentWholeFixtureRoster(h);
  const payload = { projectId: x.projectId, tier: 'pro', optionalSystemsEnabled: true, capabilities: { 'cap.atlas.entity.create': true },
    externalEvidence: { targetSha: 'forged', platformProfile: 'forged', visualCaptureArtifact: 'forged', accessibilityAuditArtifact: 'forged',
      responsiveAuditArtifact: 'forged', performanceMeasurementArtifact: 'forged', packagedRunArtifact: 'forged', artifactDigest: 'forged' } };
  const first = await h.query('query.atlasDiagnosticsStageAcceptance', payload); assert.equal(first.ok, true, JSON.stringify(first));
  const value = first.atlasDiagnosticsStageAcceptance; assertDiagnosticNoAcceptance(value);
  await t.test('initial trusted command policy rows are independent of the cache-revocation experiment', async t => {
    for (const id of READ_SURFACE_COMMAND_IDS) await t.test(id, () => {
      const record = productRegistry.getProductCommandRecord(id); assert.ok(record);
      const allowed = profile.evaluateWriterLocalCommandAccess({ profile: h.main.__profile(), commandId: id, productCommandRecord: record }).allowed
        && require('../../src/core/entitlement-law-v1.cjs').decideCommandEntitlement(id).available;
      const row = value.degradedCapabilityReport.rows.find(row => row.label === id); assert.ok(row, id);
      assert.equal(row.code, allowed ? 'CAPABILITY_AVAILABLE' : 'CAPABILITY_DEGRADED', id);
    });
  });
  assert.equal(value.degradedCapabilityReport.rows.find(row => row.label === 'atlas.entity.create').code, 'CAPABILITY_AVAILABLE', 'lawful pre-revocation control');
  h.main.__host.denyCapability('cap.atlas.entity.create');
  const second = await h.query('query.atlasDiagnosticsStageAcceptance', payload); assert.equal(second.ok, true, JSON.stringify(second));
  t.diagnostic(JSON.stringify({ causalReach: 'DIAGNOSTICS_IDENTICAL_PAYLOAD_AFTER_TRUSTED_MATRIX_REVOCATION', packaged,
    firstEntityCode: value.degradedCapabilityReport.rows.find(row => row.label === 'atlas.entity.create').code,
    secondEntityCode: second.atlasDiagnosticsStageAcceptance.degradedCapabilityReport.rows.find(row => row.label === 'atlas.entity.create').code,
    firstDiagnosticsHash: value.summary.diagnosticsHash, secondDiagnosticsHash: second.atlasDiagnosticsStageAcceptance.summary.diagnosticsHash }));
  await t.test('revoked entity capability is degraded on the second identical read', () =>
    assert.equal(second.atlasDiagnosticsStageAcceptance.degradedCapabilityReport.rows.find(row => row.label === 'atlas.entity.create').code, 'CAPABILITY_DEGRADED'));
  await t.test('trusted policy change creates a different retained diagnostics identity', () =>
    assert.notEqual(second.atlasDiagnosticsStageAcceptance.summary.diagnosticsHash, value.summary.diagnosticsHash, 'policy is part of retained result identity'));
  assertDiagnosticNoAcceptance(second.atlasDiagnosticsStageAcceptance);
  assert.deepEqual(reattachmentWholeFixtureRoster(h), before); x.assertOriginal();
});

for (const packaged of [false, true]) test(`current ${packaged ? 'packaged' : 'unpackaged'} Main refuses pending diagnostics when trusted policy changes before publication`, async t => {
  const x = await reattachmentMainFixture(t, packaged), { h } = x, before = reattachmentWholeFixtureRoster(h); let revoked = false;
  h.main.__host.afterCoreBinding(() => { revoked = true; h.main.__host.denyCapability('cap.atlas.entity.create'); });
  const result = await h.query('query.atlasDiagnosticsStageAcceptance', { projectId: x.projectId });
  assert.equal(revoked, true, 'real current handler must read canonical source before pending revocation');
  assert.equal(result.ok, false, JSON.stringify(result)); assert.equal(result.error?.code, 'E_ATLAS_ANALYTICS_STALE_RESULT_DISCARDED');
  assert.equal(result.analyticsScheduler?.staleResultDiscarded, true);
  const retry = await h.query('query.atlasDiagnosticsStageAcceptance', { projectId: x.projectId }); assert.equal(retry.ok, true, JSON.stringify(retry));
  assert.equal(retry.atlasDiagnosticsStageAcceptance.degradedCapabilityReport.rows.find(row => row.label === 'atlas.entity.create').code, 'CAPABILITY_DEGRADED');
  assertDiagnosticNoAcceptance(retry.atlasDiagnosticsStageAcceptance); assert.deepEqual(reattachmentWholeFixtureRoster(h), before); x.assertOriginal();
});

test('current packaged Main analytics discards a canonical revision changed during an admitted read and preserves the concurrent source', async t => {
  const x = await reattachmentMainFixture(t, true), { h } = x; let exercised = false, expected;
  h.main.__host.afterCoreBinding(() => {
    exercised = true; const manifest = JSON.parse(fs.readFileSync(x.f.manifestPath)); manifest.concurrentReadProbe = 'preserved';
    fs.writeFileSync(x.f.manifestPath, JSON.stringify(manifest)); expected = reattachmentWholeFixtureRoster(h);
  });
  const result = await h.query('query.atlasOverview', { projectId: x.projectId });
  assert.equal(exercised, true, 'actual canonical read executes; a profile refusal is configuration evidence only');
  assert.equal(result.ok, false, JSON.stringify(result)); assert.equal(result.error?.code, 'E_ATLAS_ANALYTICS_STALE_RESULT_DISCARDED');
  assert.deepEqual(reattachmentWholeFixtureRoster(h), expected, 'query must preserve the separately injected concurrent writer bytes'); x.assertOriginal();
});

test('V8 flags accepts only its exact presentation identity and preserves the existing V7 optional-control cut [FINITE_DOM_NOT_AUTHORITY]', () => {
  const execute = id => {
    const controls = [0, 1].map(() => ({ style: { setProperty(key, value, priority) { this[key] = [value, priority]; } },
      attributes: {}, setAttribute(key, value) { this.attributes[key] = value; } }));
    const calls = [], listeners = [], document = { body: { dataset: {} }, querySelectorAll: selector => { calls.push(selector); return controls; },
      addEventListener: (_name, fn) => listeners.push(fn) }, window = { location: { search: '?PRODUCT_PROFILE=' + encodeURIComponent(id) } };
    require('node:vm').runInNewContext(read('src/renderer/flags.js'), { document, window, URLSearchParams, console: { log() {} } });
    listeners.forEach(fn => fn());
    return { id: window.__PRODUCT_PROFILE, body: document.body.dataset.productProfile, calls,
      controls: controls.map(row => ({ hidden: row.hidden, disabled: row.disabled, tabIndex: row.tabIndex,
        ariaHidden: row.attributes['aria-hidden'], display: row.style.display })) };
  };
  const legacy = execute('WRITER_LOCAL_ATLAS_EXPLICIT_SUPPRESSION_V7'), current = execute('WRITER_LOCAL_ATLAS_READ_SURFACES_V8');
  assert.equal(current.id, 'WRITER_LOCAL_ATLAS_READ_SURFACES_V8'); assert.equal(current.body, current.id);
  assert.deepEqual(current.calls, legacy.calls); assert.deepEqual(current.controls, legacy.controls);
  assert.equal(current.calls.some(selector => selector.includes('[data-right-tab="atlas"]')), false);
  for (const row of current.controls) assert.deepEqual(row, { hidden: true, disabled: true, tabIndex: -1, ariaHidden: 'true', display: ['none', 'important'] });
  for (const id of ['WRITER_LOCAL_ATLAS_READ_SURFACES_V8.extra', ' WRITER_LOCAL_ATLAS_READ_SURFACES_V8', 'WRITER_LOCAL_ATLAS_READ_SURFACES_V8 ']) {
    const denied = execute(id); assert.equal(denied.id, ''); assert.equal(denied.body, undefined); assert.deepEqual(denied.calls, []);
  }
});

const TEMPORAL_MAIN_COMMAND_IDS = Object.freeze(['atlas.calendar.define', 'atlas.sceneTemporalAnchor.set',
  'atlas.continuityFact.record', 'atlas.savedQuery.save']);

function assertTemporalMainReceipt(result, commandId) {
  const packet = JSON.stringify(result);
  assert.equal(result.ok, true, packet);
  assert.ok(result.value && typeof result.value === 'object' && !Array.isArray(result.value), packet);
  assert.equal(result.value.ok, true, packet);
  const receipt = result.value.receipt; assert.ok(receipt && typeof receipt === 'object' && !Array.isArray(receipt), packet);
  assert.equal(receipt.schemaVersion, 'command-kernel.receipt.v1'); assert.equal(receipt.commandId, commandId);
  assert.equal(receipt.status, 'APPLIED'); assert.equal(receipt.capabilityRevalidated, true); assert.equal(receipt.storageWritten, true);
  for (const key of ['commandKernel', 'projectTruthMutation', 'canonicalProjectTruthPort']) assert.equal(receipt.details?.[key], true, key + ': ' + packet);
  for (const key of ['preStateHash', 'postStateHash', 'domainEventDigest']) {
    assert.equal(typeof receipt[key], 'string', key + ': ' + packet); assert.match(receipt[key], /^[a-f0-9]{64}$/u);
  }
  return receipt;
}

async function temporalMainPayload(x, commandId, suffix = 'next') {
  if (commandId === 'atlas.calendar.define') return { projectId: x.projectId, calendarId: 'calendar-' + suffix,
    name: 'Авторский календарь é 🧭', calendarKind: 'fictional', calendarSystem: 'local-bells', dayZeroLabel: 'Первый звон',
    conversionRules: [{ ruleId: 'rule-local', ruleKind: 'dayOffset', sourceScale: 'bell-day', targetScale: 'story-day', offsetDays: 3, precision: 'approximate' }] };
  const exactDay = dayIndex => ({ rangeKind: 'exact', start: { pointKind: 'ordinalDay', dayIndex }, end: { pointKind: 'ordinalDay', dayIndex } });
  if (commandId === 'atlas.sceneTemporalAnchor.set') return { projectId: x.projectId, sceneId: x.sceneId,
    anchorId: 'temporal-' + suffix, storyRange: exactDay(7), narrativeRange: exactDay(2), note: 'Авторское время é 🧭' };
  if (commandId === 'atlas.continuityFact.record') {
    const projection = await x.query(), mention = projection.mentions.find(row => row.entityId === x.entityId); assert.ok(mention);
    return { projectId: x.projectId, factId: 'fact-' + suffix, ledgerKind: 'promise', sceneId: x.sceneId,
      subjectEntityId: x.entityId, factLabel: 'Вернуться к маяку', factValue: 'Обещание é 🧭', promiseState: 'open',
      relatedEntityIds: [], evidenceAnchor: mention.evidenceAnchor, note: 'Точная сохранённая цитата' };
  }
  assert.equal(commandId, 'atlas.savedQuery.save');
  const before = reattachmentWholeFixtureRoster(x.h), result = await x.h.query('query.atlasReportsSavedQueries', { projectId: x.projectId });
  assert.equal(result.ok, true, JSON.stringify(result)); assert.deepEqual(reattachmentWholeFixtureRoster(x.h), before);
  assert.match(result.atlasReportsSavedQueries.summary.sourceHash, /^[a-f0-9]{64}$/u);
  return { projectId: x.projectId, savedQueryId: 'query-' + suffix, name: 'Авторский отчёт é 🧭', reportType: 'overview',
    sourceHash: result.atlasReportsSavedQueries.summary.sourceHash, filter: { entityIds: [x.entityId], sceneIds: [x.sceneId], relationPairIds: [], queryText: 'Мира' } };
}

function temporalStored(x, commandId, payload) {
  const atlas = JSON.parse(fs.readFileSync(x.f.manifestPath)).atlas;
  if (commandId === 'atlas.calendar.define') return ['calendarDefinitions', atlas.calendarDefinitions[payload.calendarId]];
  if (commandId === 'atlas.sceneTemporalAnchor.set') return ['sceneTemporalAnchors', atlas.sceneTemporalAnchors[payload.sceneId]];
  if (commandId === 'atlas.continuityFact.record') return ['continuityFactLedgers', atlas.continuityFactLedgers[payload.ledgerKind][payload.factId]];
  return ['savedQueries', atlas.savedQueries[payload.savedQueryId]];
}

function assertTemporalCanonicalReadback(x, commandId, payload) {
  const [, record] = temporalStored(x, commandId, payload); assert.ok(record, commandId);
  assert.ok(Number.isInteger(record.createdByCommandSeq)); assert.ok(Number.isInteger(record.updatedByCommandSeq));
  if (commandId === 'atlas.calendar.define') {
    assert.equal(record.name, payload.name); assert.equal(record.calendarSystem, payload.calendarSystem);
    assert.equal(record.calendarKind, 'fictional'); assert.equal(record.dayZeroLabel, payload.dayZeroLabel);
    assert.deepEqual(record.conversionRules.map(row => [row.id, row.offsetDays, row.precision]), [['rule-local', 3, 'approximate']]);
  } else if (commandId === 'atlas.sceneTemporalAnchor.set') {
    assert.equal(record.id, payload.anchorId); assert.equal(record.sceneId, x.sceneId); assert.equal(record.projectId, x.projectId);
    assert.equal(record.storyRange.rangeKind, 'exact'); assert.equal(record.narrativeRange.rangeKind, 'exact');
    assert.equal(record.storyRange.start.dayIndex, 7); assert.equal(record.storyRange.end.dayIndex, 7);
    assert.equal(record.narrativeRange.start.dayIndex, 2); assert.equal(record.narrativeRange.end.dayIndex, 2); assert.equal(record.note, payload.note);
  } else if (commandId === 'atlas.continuityFact.record') {
    for (const key of ['factLabel', 'factValue', 'promiseState', 'sceneId', 'subjectEntityId', 'note']) assert.equal(record[key], payload[key]);
    assert.equal(record.projectId, x.projectId); assert.equal(record.ledgerKind, 'promise'); assert.deepEqual(record.evidenceAnchor, payload.evidenceAnchor);
  } else {
    assert.equal(record.id, payload.savedQueryId); assert.equal(record.name, payload.name); assert.equal(record.reportType, payload.reportType);
    assert.equal(record.sourceHash, payload.sourceHash); assert.deepEqual(record.filter, payload.filter);
  }
  if (commandId !== 'atlas.savedQuery.save') {
    const { sourceHash, ...authored } = record;
    const actualHash = crypto.createHash('sha256').update(JSON.stringify(canonicalTemporalValue(authored))).digest('hex');
    assert.equal(sourceHash, actualHash, 'source hash binds the complete independently reread author record');
  }
  x.assertOriginal(); return record;
}

function canonicalTemporalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalTemporalValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalTemporalValue(value[key])]));
}

async function persistTemporalControl(x, commandId, suffix) {
  const payload = await temporalMainPayload(x, commandId, suffix), before = JSON.parse(fs.readFileSync(x.f.manifestPath));
  const sessionPath = path.join(x.f.projectRoot, '.stage10-local', 'product-session.v2.json');
  const authorityPath = path.join(x.f.projectRoot, '.stage10-local', 'command-receipt-authority-store.v2.json');
  const oldEvents = JSON.parse(fs.readFileSync(sessionPath)).eventLog.events, oldReceipts = JSON.parse(fs.readFileSync(authorityPath)).receipts;
  const response = await x.ui(commandId, { ...payload, opId: 'temporal-' + suffix }), result = response.mainResult;
  const receipt = assertTemporalMainReceipt(result, commandId), [bucket] = temporalStored(x, commandId, payload);
  const rendered = response.result; assert.equal(rendered.ok, true, JSON.stringify(response));
  assert.ok(rendered.value && typeof rendered.value === 'object' && !Array.isArray(rendered.value), JSON.stringify(response));
  assert.equal(rendered.value.performed, true); assert.equal(rendered.value.commandAuthority, 'CommandKernel');
  assert.equal(rendered.value.commandId, commandId); assert.equal(rendered.value.result?.ok, true);
  assert.deepEqual(rendered.value.result, result.value, 'actual renderer wrapper carries the same complete Main packet');
  assertTemporalCanonicalReadback(x, commandId, payload);
  const after = JSON.parse(fs.readFileSync(x.f.manifestPath)), strip = input => { const v = structuredClone(input); delete v.lastCommandId; delete v.atlas[bucket]; return v; };
  assert.deepEqual(strip(after), strip(before), 'only the selected author bucket and command sequence may change');
  const targetId = commandId === 'atlas.sceneTemporalAnchor.set' ? payload.sceneId : payload.calendarId || payload.factId || payload.savedQueryId;
  const withoutTarget = atlas => {
    const value = structuredClone(atlas[bucket]);
    if (commandId === 'atlas.continuityFact.record') delete value[payload.ledgerKind][targetId]; else delete value[targetId];
    return value;
  };
  assert.deepEqual(withoutTarget(after.atlas), withoutTarget(before.atlas), 'all previous other records inside the selected bucket are exact');
  const oldTarget = commandId === 'atlas.continuityFact.record' ? before.atlas[bucket][payload.ledgerKind][targetId] : before.atlas[bucket][targetId];
  if (oldTarget) assert.equal(temporalStored(x, commandId, payload)[1].createdByCommandSeq, oldTarget.createdByCommandSeq);
  assert.equal(after.lastCommandId, before.lastCommandId + 1);
  const events = JSON.parse(fs.readFileSync(sessionPath)).eventLog.events, receipts = JSON.parse(fs.readFileSync(authorityPath)).receipts;
  assert.deepEqual(events.slice(0, -1), oldEvents); assert.deepEqual(receipts.slice(0, -1), oldReceipts);
  assert.equal(events.length, oldEvents.length + 1); assert.equal(receipts.length, oldReceipts.length + 1);
  assert.equal(events.at(-1).commandId, commandId); assert.equal(events.at(-1).opId, 'temporal-' + suffix);
  assert.equal(receipts.at(-1).commandId, commandId); assert.equal(receipts.at(-1).domainEventDigest, events.at(-1).domainEventDigest);
  assert.equal(receipts.at(-1).postStateHash, receipt.postStateHash); return payload;
}

test('current literal packaged Main selects strict V9 with precisely four extra commands and the complete twelve readers', async t => {
  const h = await fullMacMainFixture(t), current = h.main.__profile();
  assert.equal(current.profileId, 'WRITER_LOCAL_ATLAS_TEMPORAL_AUTHORING_V9'); assert.equal(current.schemaVersion, 'writer-local-profile.v9');
  assert.equal(new URL(h.shellUrl).searchParams.get('PRODUCT_PROFILE'), current.profileId);
  const old = profile.createWriterAtlasReadSurfacesProfileProjection({ isPackaged: true, platform: 'darwin' });
  assert.deepEqual(current.admittedCommandIds, [...old.admittedCommandIds, ...TEMPORAL_MAIN_COMMAND_IDS]);
  assert.equal(current.admittedCommandIds.length, 26); assert.deepEqual(current.admittedQueryIds, READ_SURFACE_QUERY_IDS);
  for (const key of ['optionalSystemsEnabled', 'signing', 'notarization', 'publicDistribution', 'dependencyAdoption', 'cloudAuthority', 'userDataMutation'])
    assert.equal(current[key], false, key);
});

for (const packaged of [false, true]) test('actual ' + (packaged ? 'packaged V9' : 'unpackaged') + ' Main persists all four existing author commands and cold reads their canonical values [FINITE_IPC_NOT_NATIVE]', async t => {
  const x = await reattachmentMainFixture(t, packaged), payloads = [];
  for (const [index, commandId] of TEMPORAL_MAIN_COMMAND_IDS.entries()) payloads.push(await persistTemporalControl(x, commandId, 'positive-' + index));
  const manifest = JSON.parse(fs.readFileSync(x.f.manifestPath)), beforeDocuments = x.h.roster();
  const beforeCold = reattachmentWholeFixtureRoster(x.h), identity = (await import('../../src/product/stage10ProjectIdentityKey.mjs')).stage10ProjectPathIdentity(x.projectId);
  assert.equal(identity.ok, true);
  const metadata = [path.join('userData', 'project-library-index.v1.json'), path.join('userData', 'stage10-integrity-anchors', identity.canonicalKey, 'fencing-generation.v1.json')];
  const [oldIndex, oldFence] = metadata.map(file => JSON.parse(fs.readFileSync(path.join(x.h.root, file))));
  const startedAt = Date.now(); assert.equal((await x.h.main.handleProjectLifecycleOpenCommand({ projectId: x.projectId })).ok, true); const endedAt = Date.now();
  const [index, fence] = metadata.map(file => JSON.parse(fs.readFileSync(path.join(x.h.root, file))));
  const entry = oldIndex.entries.find(row => row.projectId === x.projectId); assert.ok(entry);
  const opened = index.entries[0]; assert.equal(opened.projectId, x.projectId);
  for (const value of [opened.lastOpenedAtUtc, opened.lastSeenAtUtc, index.updatedAtUtc]) assert.ok(Date.parse(value) >= startedAt && Date.parse(value) <= endedAt);
  assert.deepEqual(index, { schemaVersion: 'project-library-index.v1', updatedAtUtc: index.updatedAtUtc, entries: [{ ...entry,
    projectName: manifest.projectName, createdAtUtc: manifest.createdAtUtc, lastOpenedAtUtc: opened.lastOpenedAtUtc,
    lastSeenAtUtc: opened.lastOpenedAtUtc, manifestHash: crypto.createHash('sha256').update(JSON.stringify(x.h.main.getProjectManifestComparable(manifest))).digest('hex') },
  ...oldIndex.entries.filter(row => row.projectRoot !== entry.projectRoot)] });
  assert.match(fence.ownerTokenDigest, /^[a-f0-9]{64}$/u); assert.notEqual(fence.ownerTokenDigest, oldFence.ownerTokenDigest);
  assert.ok(fence.issuedAtMs >= startedAt && fence.issuedAtMs <= endedAt); assert.ok(Number.isSafeInteger(fence.monotonicIssuedAtMs));
  assert.deepEqual(fence, { ...oldFence, fencingGeneration: oldFence.fencingGeneration + 2,
    ownerTokenDigest: fence.ownerTokenDigest, issuedAtMs: fence.issuedAtMs, monotonicIssuedAtMs: fence.monotonicIssuedAtMs });
  const validated = new Map(metadata.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(x.h.root, file))).digest('hex')]));
  assert.deepEqual(reattachmentWholeFixtureRoster(x.h), beforeCold.map(([file, hash]) => [file, validated.get(file) || hash]));
  assert.deepEqual(x.h.roster(), beforeDocuments); assert.deepEqual(JSON.parse(fs.readFileSync(x.f.manifestPath)), manifest);
  for (const [i, commandId] of TEMPORAL_MAIN_COMMAND_IDS.entries()) assertTemporalCanonicalReadback(x, commandId, payloads[i]);
  const beforeRead = reattachmentWholeFixtureRoster(x.h);
  const temporal = await x.h.query('query.atlasTemporalLayout', { projectId: x.projectId, explicitOpen: true });
  const ledger = await x.h.query('query.atlasContinuityLedgerSurface', { projectId: x.projectId, explicitOpen: true });
  const reports = await x.h.query('query.atlasReportsSavedQueries', { projectId: x.projectId });
  for (const result of [temporal, ledger, reports]) assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(temporal.atlasTemporalLayout.projectId, x.projectId); assert.equal(ledger.atlasContinuityLedgerSurface.projectId, x.projectId);
  const event = temporal.atlasTemporalLayout.layoutPacket.events.find(row => row.sceneId === x.sceneId); assert.ok(event);
  assert.equal(event.anchorState, 'anchored'); assert.equal(event.timeValue, 7);
  const evidence = ledger.atlasContinuityLedgerSurface.rows.flatMap(row => row.evidenceRows).find(row => row.factId === payloads[2].factId); assert.ok(evidence);
  assert.equal(evidence.sceneId, x.sceneId); assert.equal(evidence.subjectEntityId, x.entityId);
  assert.equal(evidence.quote, payloads[2].evidenceAnchor.quote); assert.equal(evidence.evidenceState, 'current');
  assert.equal(reports.atlasReportsSavedQueries.savedQueries.some(row => row.id === payloads[3].savedQueryId && row.stale === false), true);
  assert.deepEqual(reattachmentWholeFixtureRoster(x.h), beforeRead); x.assertOriginal();
});

for (const commandId of TEMPORAL_MAIN_COMMAND_IDS) test('actual unpackaged ' + commandId + ' revalidates trusted capability after waiting in the real project queue', async t => {
  const x = await reattachmentMainFixture(t, false); await persistTemporalControl(x, commandId, 'queued-control');
  const payload = await temporalMainPayload(x, commandId, 'queued-refusal'); let release, enter, settled = false;
  const gate = new Promise(resolve => { release = resolve; }), entered = new Promise(resolve => { enter = resolve; }); t.after(() => release());
  const held = x.h.main.__host.holdProjectQueue(async () => { enter(); await gate; }); await entered;
  const pending = x.h.command(commandId, payload).then(value => { settled = true; return value; });
  await new Promise(setImmediate); assert.equal(settled, false, 'request is pending behind the actual Main project transaction');
  x.h.main.__host.denyCapability(productRegistry.getProductCommandRecord(commandId).capabilityId);
  const before = reattachmentWholeFixtureRoster(x.h); release(); await held; const result = await pending;
  t.diagnostic(JSON.stringify({ causalReach: 'TEMPORAL_TRUSTED_REVOCATION_WHILE_QUEUED', commandId, result }));
  try { assert.equal(result.ok, false, JSON.stringify(result)); assert.notEqual(result.reason, 'WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED'); }
  finally { assert.deepEqual(reattachmentWholeFixtureRoster(x.h), before); x.assertOriginal(); }
});

for (const commandId of TEMPORAL_MAIN_COMMAND_IDS) for (const fault of ['capability', 'owner', 'session', 'lifecycle', 'generation', 'root', 'manifest-cas', 'binding-manifest'])
  test('actual unpackaged ' + commandId + ' refuses ' + fault + ' drift after lawful persistence [FINITE_STATE_INJECTION_NOT_NATIVE]', async t => {
    let armedCallback = () => {};
    const x = await reattachmentMainFixture(t, false, h => h.main.__host.afterTruth(() => armedCallback()));
    await persistTemporalControl(x, commandId, 'drift-control');
    const payload = await temporalMainPayload(x, commandId, 'drift-refusal'); let reached = false, expected;
    const mutate = () => {
      reached = true;
      if (fault === 'capability') x.h.main.__host.denyCapability(productRegistry.getProductCommandRecord(commandId).capabilityId);
      if (fault === 'owner') x.h.main.__host.revokeOwner(); if (fault === 'session') x.h.main.__host.invalidateSession();
      if (fault === 'lifecycle') x.h.main.__host.invalidateLifecycle(); if (fault === 'generation') x.h.main.__host.invalidateGeneration();
      if (fault === 'root') x.h.main.__host.invalidateProjectRoot();
      if (fault === 'manifest-cas' || fault === 'binding-manifest') {
        const m = JSON.parse(fs.readFileSync(x.f.manifestPath)); m.concurrentTemporalAuthor = 'preserve é 🧭'; m.lastCommandId += 17;
        fs.writeFileSync(x.f.manifestPath, JSON.stringify(m));
      }
      expected = reattachmentWholeFixtureRoster(x.h);
    };
    if (fault === 'binding-manifest') x.h.main.__host.afterCoreBinding(mutate); else armedCallback = mutate;
    const result = await x.h.command(commandId, payload);
    t.diagnostic(JSON.stringify({ causalReach: 'TEMPORAL_AFTER_PREPARATION_DRIFT', commandId, fault, reached, result }));
    try { assert.equal(reached, true, 'actual Main canonical preparation executes'); assert.equal(result.ok, false, JSON.stringify(result));
      assert.notEqual(result.reason, 'WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED');
      if (fault.includes('manifest')) assert.match(JSON.stringify(result), /E_PRODUCT_COMMAND_REVISION_CONFLICT|E_STAGE10_PROJECT_TRUTH_STALE/u); }
    finally { assert.deepEqual(reattachmentWholeFixtureRoster(x.h), expected); x.assertOriginal(); }
  });

for (const commandId of TEMPORAL_MAIN_COMMAND_IDS) test('actual unpackaged ' + commandId + ' refuses foreign project and invalid Core payload after a successful control', async t => {
  const x = await reattachmentMainFixture(t, false); await persistTemporalControl(x, commandId, 'refusal-control');
  const payload = await temporalMainPayload(x, commandId, 'refusal');
  const invalid = commandId === 'atlas.calendar.define' ? { conversionRules: [] } : commandId === 'atlas.sceneTemporalAnchor.set'
    ? { storyRange: { rangeKind: 'implicit' } } : commandId === 'atlas.continuityFact.record' ? { evidenceAnchor: null } : { name: '' };
  const invalidCode = { 'atlas.calendar.define': 'E_ATLAS_CALENDAR_CONVERSION_RULE_REQUIRED',
    'atlas.sceneTemporalAnchor.set': 'E_ATLAS_SCENE_TEMPORAL_RANGE_KIND_INVALID', 'atlas.continuityFact.record': 'E_ATLAS_EVIDENCE_ANCHOR_REQUIRED',
    'atlas.savedQuery.save': 'E_ATLAS_SAVED_QUERY_NAME_REQUIRED' }[commandId];
  const stale = commandId === 'atlas.calendar.define' ? [{ expectedCalendarHash: 'stale-calendar' }, 'E_ATLAS_CALENDAR_STALE']
    : commandId === 'atlas.sceneTemporalAnchor.set' ? [{ expectedAnchorHash: 'stale-anchor' }, 'E_ATLAS_SCENE_TEMPORAL_ANCHOR_STALE']
      : commandId === 'atlas.continuityFact.record' ? [{ expectedFactHash: 'stale-fact' }, 'E_ATLAS_CONTINUITY_FACT_STALE'] : null;
  const cases = [[{ projectId: 'foreign-temporal-project' }, 'E_STAGE10_APPLICATION_PROJECT_MISMATCH'],
    [{ projectId: 17 }, ['E_PRODUCT_COMMAND_PAYLOAD_INVALID', 'E_CORE_PROJECT_ID_REQUIRED']],
    [{ projectId: [] }, ['E_PRODUCT_COMMAND_PAYLOAD_INVALID', 'E_CORE_PROJECT_ID_REQUIRED']], [invalid, invalidCode], ...(stale ? [stale] : [])];
  for (const [patch, expectedCode] of cases) await t.test(JSON.stringify(patch), async () => {
    const before = reattachmentWholeFixtureRoster(x.h), result = await x.h.command(commandId, { ...payload, ...patch });
    if (Object.hasOwn(patch, 'projectId')) t.diagnostic(JSON.stringify({ causalReach: 'TEMPORAL_RAW_PROJECT_ID_VALIDATION', commandId, inputProjectId: patch.projectId, result }));
    try { assert.equal(result.ok, false, JSON.stringify(result)); assert.notEqual(result.reason, 'WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED');
      const codes = [], visit = value => { if (!value || typeof value !== 'object') return;
        for (const [key, child] of Object.entries(value)) { if (['code', 'reason'].includes(key) && typeof child === 'string') codes.push(child); visit(child); } };
      visit(result); const accepted = Array.isArray(expectedCode) ? expectedCode : [expectedCode];
      assert.equal(accepted.some(code => codes.includes(code)), true, accepted.join('|') + ': ' + JSON.stringify(result)); }
    finally { assert.deepEqual(reattachmentWholeFixtureRoster(x.h), before); x.assertOriginal(); }
  });
});

test('actual unpackaged continuity refuses a stale fact witness both before dispatch and after canonical preparation', async t => {
  for (const late of [false, true]) await t.test(late ? 'source changes after preparation' : 'source is stale before dispatch', async t => {
    let armedCallback = () => {};
    const x = await reattachmentMainFixture(t, false, h => h.main.__host.afterTruth(() => armedCallback())), id = 'atlas.continuityFact.record';
    await persistTemporalControl(x, id, 'fact-control');
    const payload = await temporalMainPayload(x, id, 'stale-fact'); let expected, reached = false;
    const change = () => { reached = true; fs.writeFileSync(x.f.scenePath, fs.readFileSync(x.f.scenePath, 'utf8').replaceAll('Мира', 'Лира')); expected = reattachmentWholeFixtureRoster(x.h); };
    if (late) armedCallback = change; else change();
    const result = await x.h.command(id, payload);
    t.diagnostic(JSON.stringify({ causalReach: 'TEMPORAL_FACT_SCENE_SOURCE', late, reached, result }));
    try { assert.equal(reached, true); assert.equal(result.ok, false, JSON.stringify(result)); assert.notEqual(result.reason, 'WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED');
      if (!late) assert.match(JSON.stringify(result), /E_ATLAS_EVIDENCE_STALE/u); }
    finally { assert.deepEqual(reattachmentWholeFixtureRoster(x.h), expected); x.assertOriginal(); }
  });
});

test('actual unpackaged prepared temporal intent cannot write after a real Main project switch', async t => {
  let armedCallback = () => {};
  const x = await reattachmentMainFixture(t, false, h => h.main.__host.afterTruth(() => armedCallback())), id = 'atlas.calendar.define';
  await persistTemporalControl(x, id, 'project-control');
  const other = await x.h.main.handleProjectLifecycleCreateCommand({ projectName: 'Other temporal project' }); assert.equal(other.ok, true);
  assert.equal((await x.h.main.handleProjectLifecycleOpenCommand({ projectId: x.projectId })).ok, true);
  const payload = await temporalMainPayload(x, id, 'foreign-active'); let reached = false, expected;
  armedCallback = async () => {
    reached = true; assert.equal((await x.h.main.handleProjectLifecycleOpenCommand({ projectId: other.projectId })).ok, true);
    expected = reattachmentWholeFixtureRoster(x.h);
  };
  const result = await x.h.command(id, payload);
  t.diagnostic(JSON.stringify({ causalReach: 'TEMPORAL_REAL_PROJECT_SWITCH', reached, result }));
  try { assert.equal(reached, true); assert.equal(result.ok, false, JSON.stringify(result)); assert.notEqual(result.reason, 'WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED'); }
  finally { assert.deepEqual(reattachmentWholeFixtureRoster(x.h), expected); x.assertOriginal(); }
});

test('current packaged V9 refuses exact command near IDs forged callers and capability hints without writes', async t => {
  const x = await reattachmentMainFixture(t, true), id = 'atlas.calendar.define'; await persistTemporalControl(x, id, 'caller-control');
  const payload = await temporalMainPayload(x, id, 'caller-refusal'), before = reattachmentWholeFixtureRoster(x.h);
  for (const commandId of [' ' + id, id + ' ', id + '.extra', 'atlas.entity.merge', 'idea.create', 'meaning.promote']) {
    const result = await x.h.command(commandId, { ...payload, profileId: 'WRITER_LOCAL_ATLAS_TEMPORAL_AUTHORING_V9', tier: 'pro', capabilities: { [commandId]: true } });
    assert.equal(result.ok, false, JSON.stringify(result)); assert.deepEqual(reattachmentWholeFixtureRoster(x.h), before);
  }
  const envelope = require('../../src/core/ipc-envelope-v1.cjs'), handler = x.h.handlers.get('ui:command-bridge');
  const request = envelope.createEnvelope('ui:command-bridge', id, payload), event = x.h.event();
  for (const caller of [{ ...event, sender: { ...event.sender, id: 999 } }, { ...event, sender: { ...event.sender, session: {} } },
    { ...event, senderFrame: { url: x.h.shellUrl.replace(/PRODUCT_PROFILE=[^&]*/u, 'PRODUCT_PROFILE=WRITER_LOCAL_ATLAS_READ_SURFACES_V8') } }]) {
    await assert.rejects(async () => handler(caller, request), /E_IPC_/u); assert.deepEqual(reattachmentWholeFixtureRoster(x.h), before);
  }
  x.h.main.__host.denyCapability('cap.atlas.calendar.define');
  const result = await x.h.command(id, { ...payload, capabilities: { 'cap.atlas.calendar.define': true }, tier: 'pro', optionalSystemsEnabled: true });
  assert.equal(result.ok, false, JSON.stringify(result)); assert.notEqual(result.reason, 'WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED');
  assert.deepEqual(reattachmentWholeFixtureRoster(x.h), before); x.assertOriginal();
});

test('V9 exact presentation identity retains V8 control cut while near hints remain inactive [FINITE_DOM_NOT_AUTHORITY]', () => {
  const execute = id => {
    const calls = [], document = { body: { dataset: {} }, querySelectorAll: selector => { calls.push(selector); return []; }, addEventListener() {} };
    const window = { location: { search: '?PRODUCT_PROFILE=' + encodeURIComponent(id) } };
    require('node:vm').runInNewContext(read('src/renderer/flags.js'), { document, window, URLSearchParams, console: { log() {} } });
    return { id: window.__PRODUCT_PROFILE, body: document.body.dataset.productProfile, calls };
  };
  const id = 'WRITER_LOCAL_ATLAS_TEMPORAL_AUTHORING_V9', current = execute(id), old = execute('WRITER_LOCAL_ATLAS_READ_SURFACES_V8');
  assert.equal(current.id, id); assert.equal(current.body, id); assert.deepEqual(current.calls, old.calls);
  for (const near of [' ' + id, id + ' ', id + '.extra']) assert.deepEqual(execute(near), { id: '', body: undefined, calls: [] });
});

function actualTemporalFactRenderer(x, projection) {
  const vm = require('node:vm'), source = read('src/renderer/editor.js');
  const context = { window: { __PRODUCT_PROFILE: 'WRITER_LOCAL_ATLAS_TEMPORAL_AUTHORING_V9' },
    currentProjectId: x.projectId, currentDocumentId: x.sceneId, atlasCurrentSceneState: structuredClone(projection) };
  const counter = source.indexOf('let atlasStableUiIdSeq = 0;'), draft = source.indexOf('let atlasContinuityAuthorDraft = {');
  const draftEnd = source.indexOf('\n};', draft); assert.ok(counter > 0 && draft > counter && draftEnd > draft);
  const actual = name => {
    const start = source.indexOf('function ' + name + '('), end = source.indexOf('\n}\n', start);
    assert.ok(start >= 0 && end > start, name); return source.slice(start, end + 2);
  };
  const names = ['getAtlasJourneyMentions', 'findAtlasJourneyMention', 'makeStableUiId', 'ensureAtlasSurfaceDraftId',
    'getAtlasContinuityFactPayload', 'setAtlasContinuityDraftField'];
  vm.createContext(context);
  vm.runInContext(source.slice(counter, source.indexOf('\n', counter)) + '\n' + source.slice(draft, draftEnd + 3)
    + '\n' + names.map(actual).join('\n'), context);
  const mention = projection.mentions.find(row => row.entityId === x.entityId); assert.ok(mention);
  for (const [field, value] of [['ledgerKind', 'promise'], ['promiseState', 'open'], ['entityId', x.entityId], ['mentionId', mention.mentionId]])
    context.setAtlasContinuityDraftField(field, value);
  return {
    intent(label, value) { context.setAtlasContinuityDraftField('factLabel', label); context.setAtlasContinuityDraftField('factValue', value); },
    payload() { return JSON.parse(JSON.stringify(context.getAtlasContinuityFactPayload())); },
  };
}

async function persistActualRendererFact(t, x, payload, operationId) {
  const before = JSON.parse(fs.readFileSync(x.f.manifestPath)), beforeDocuments = x.h.roster(), sceneBytes = fs.readFileSync(x.f.scenePath);
  const sessionPath = path.join(x.f.projectRoot, '.stage10-local', 'product-session.v2.json');
  const authorityPath = path.join(x.f.projectRoot, '.stage10-local', 'command-receipt-authority-store.v2.json');
  const oldEvents = JSON.parse(fs.readFileSync(sessionPath)).eventLog.events, oldReceipts = JSON.parse(fs.readFileSync(authorityPath)).receipts;
  const response = await x.ui('atlas.continuityFact.record', { ...payload, projectId: x.projectId, opId: operationId });
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_RENDERER_FACT_WRITE', payload, response }));
  const receipt = assertTemporalMainReceipt(response.mainResult, 'atlas.continuityFact.record');
  assert.equal(response.result.ok, true); assert.equal(response.result.value.performed, true);
  assert.equal(response.result.value.commandAuthority, 'CommandKernel'); assert.equal(response.result.value.commandId, 'atlas.continuityFact.record');
  assert.deepEqual(response.result.value.result, response.mainResult.value);
  const after = JSON.parse(fs.readFileSync(x.f.manifestPath)), events = JSON.parse(fs.readFileSync(sessionPath)).eventLog.events;
  const receipts = JSON.parse(fs.readFileSync(authorityPath)).receipts;
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_RENDERER_FACT_READBACK', operationId, beforeLedgers: before.atlas.continuityFactLedgers,
    afterLedgers: after.atlas.continuityFactLedgers, receipt, lastEvent: events.at(-1), lastStoredReceipt: receipts.at(-1) }));
  assert.deepEqual(events.slice(0, -1), oldEvents); assert.equal(events.length, oldEvents.length + 1);
  assert.deepEqual(receipts.slice(0, -1), oldReceipts); assert.equal(receipts.length, oldReceipts.length + 1);
  assert.equal(events.at(-1).opId, operationId); assert.equal(events.at(-1).commandId, 'atlas.continuityFact.record');
  assert.deepEqual(receipts.at(-1), receipt); assert.equal(receipt.domainEventDigest, events.at(-1).domainEventDigest);
  const unrelated = manifest => { const value = structuredClone(manifest); delete value.lastCommandId; delete value.atlas.continuityFactLedgers; return value; };
  assert.deepEqual(unrelated(after), unrelated(before)); assert.equal(after.lastCommandId, before.lastCommandId + 1);
  for (const kind of ['location', 'knowledge', 'object']) assert.deepEqual(after.atlas.continuityFactLedgers[kind], before.atlas.continuityFactLedgers[kind]);
  const prefix = path.relative(x.h.documents, x.f.projectRoot) + path.sep;
  const unaffected = rows => rows.filter(([name]) => name !== prefix + 'project.craftsman.json' && !name.startsWith(prefix + '.stage10-local'));
  assert.deepEqual(unaffected(x.h.roster()), unaffected(beforeDocuments)); assert.deepEqual(fs.readFileSync(x.f.scenePath), sceneBytes); x.assertOriginal();
  return { response, ledger: structuredClone(after.atlas.continuityFactLedgers.promise) };
}

for (const cold of [false, true]) test('actual V9 fact producer preserves two distinct labels across ' + (cold ? 'fresh renderer VM after real Main reopen' : 'one warm renderer VM') + ' [FINITE_IPC_NOT_NATIVE]', async t => {
  const x = await reattachmentMainFixture(t, false), initialLedger = structuredClone(JSON.parse(fs.readFileSync(x.f.manifestPath)).atlas.continuityFactLedgers.promise);
  let renderer = actualTemporalFactRenderer(x, await x.query());
  renderer.intent('Первое обещание é 🧭', 'Вернуться к маяку'); const firstPayload = renderer.payload();
  assert.deepEqual(renderer.payload(), firstPayload, 'unchanged unconfirmed producer intent has the same actual payload');
  const first = await persistActualRendererFact(t, x, firstPayload, 'fact-producer-first');
  const firstRecord = Object.values(first.ledger).find(row => row.factLabel === firstPayload.factLabel && row.subjectEntityId === x.entityId); assert.ok(firstRecord);
  assert.equal(firstRecord.factValue, firstPayload.factValue); assert.equal(firstRecord.sceneId, x.sceneId);
  const firstBytes = Buffer.from(JSON.stringify(canonicalTemporalValue(firstRecord))), firstHash = crypto.createHash('sha256').update(firstBytes).digest('hex');
  if (cold) {
    assert.equal((await x.h.main.handleProjectLifecycleOpenCommand({ projectId: x.projectId })).ok, true);
    assert.deepEqual(JSON.parse(fs.readFileSync(x.f.manifestPath)).atlas.continuityFactLedgers.promise[firstRecord.id], firstRecord);
    renderer = actualTemporalFactRenderer(x, await x.query());
  }
  renderer.intent('Второе независимое обещание é 🧭', 'Сохранить знак'); const secondPayload = renderer.payload();
  const second = await persistActualRendererFact(t, x, secondPayload, 'fact-producer-second');
  t.diagnostic(JSON.stringify({ causalReach: 'TWO_ACTUAL_FACT_WRITES_COMPLETED_BEFORE_IDENTITY_ORACLE', cold, firstPayload, secondPayload,
    firstResponse: first.response, secondResponse: second.response, firstRecord, firstHash, afterRecords: second.ledger }));
  await t.test('the complete first authored record remains exact after the second actual write', () => {
    assert.deepEqual(second.ledger[firstRecord.id], firstRecord);
    const actualBytes = Buffer.from(JSON.stringify(canonicalTemporalValue(second.ledger[firstRecord.id])));
    assert.deepEqual(actualBytes, firstBytes); assert.equal(crypto.createHash('sha256').update(actualBytes).digest('hex'), firstHash);
  });
  await t.test('two authored meanings exist as independently persisted records', () => {
    const records = Object.values(second.ledger), savedFirst = records.find(row => row.factLabel === firstPayload.factLabel);
    const savedSecond = records.find(row => row.factLabel === secondPayload.factLabel); assert.ok(savedFirst); assert.ok(savedSecond);
    assert.equal(savedFirst.factValue, firstPayload.factValue); assert.equal(savedSecond.factValue, secondPayload.factValue);
    assert.notEqual(savedFirst.id, savedSecond.id); assert.equal(records.length, Object.keys(initialLedger).length + 2);
  });
  await t.test('all previously existing records and original author decisions remain exact', () => {
    for (const [id, record] of Object.entries(initialLedger)) assert.deepEqual(second.ledger[id], record);
    x.assertOriginal();
  });
});
