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
async function fullMacMainFixture(t, { packaged = true, platform = 'darwin', rendererLoaded = false, historicalV7Constructor = false, historicalV8Constructor = false, historicalV9Constructor = false, historicalV10Constructor = false, historicalV11Constructor = false } = {}) {
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
      if (request === './core/entitlement-law-v1.cjs') return { ...loaded, decideCommandEntitlement: (id, ...rest) =>
        h.deniedEntitlement === id ? { available: false, reason: 'SYNTHETIC_SELECTED_ENTITLEMENT_REVOKED' } : loaded.decideCommandEntitlement(id, ...rest) };
      if (request === './core/writer-local-profile-v1.cjs' && historicalV7Constructor) {
        // Historical compatibility only: real V7 factory, current Main body.
        // Default/current-Main tests never select or substitute a profile factory.
        assert.equal(packaged, true); assert.equal(platform, 'darwin');
        t.diagnostic('HISTORICAL_V7_CONSTRUCTOR_SELECTION_NOT_CURRENT_MAIN_PROFILE_COVERAGE');
        return { ...loaded, createWriterAtlasReadSurfacesProfileProjection: loaded.createWriterAtlasExplicitSuppressionProfileProjection,
          createWriterAtlasTemporalAuthoringProfileProjection: loaded.createWriterAtlasExplicitSuppressionProfileProjection,
          createWriterAtlasEntityCorrectionsProfileProjection: loaded.createWriterAtlasExplicitSuppressionProfileProjection,
          createWriterIdeaMeaningAuthoringProfileProjection: loaded.createWriterAtlasExplicitSuppressionProfileProjection,
          createWriterSceneLanguageTagProfileProjection: loaded.createWriterAtlasExplicitSuppressionProfileProjection };
      }
      if (request === './core/writer-local-profile-v1.cjs' && historicalV8Constructor) {
        assert.equal(packaged, true); assert.equal(platform, 'darwin'); assert.equal(historicalV7Constructor, false);
        t.diagnostic('HISTORICAL_V8_CONSTRUCTOR_SELECTION_NOT_CURRENT_MAIN_PROFILE_COVERAGE');
        return { ...loaded, createWriterAtlasTemporalAuthoringProfileProjection: loaded.createWriterAtlasReadSurfacesProfileProjection,
          createWriterAtlasEntityCorrectionsProfileProjection: loaded.createWriterAtlasReadSurfacesProfileProjection,
          createWriterIdeaMeaningAuthoringProfileProjection: loaded.createWriterAtlasReadSurfacesProfileProjection,
          createWriterSceneLanguageTagProfileProjection: loaded.createWriterAtlasReadSurfacesProfileProjection };
      }
      if (request === './core/writer-local-profile-v1.cjs' && historicalV9Constructor) {
        assert.equal(packaged, true); assert.equal(platform, 'darwin'); assert.equal(historicalV7Constructor || historicalV8Constructor, false);
        t.diagnostic('HISTORICAL_V9_CONSTRUCTOR_SELECTION_NOT_CURRENT_MAIN_PROFILE_COVERAGE');
        return { ...loaded, createWriterAtlasEntityCorrectionsProfileProjection: loaded.createWriterAtlasTemporalAuthoringProfileProjection,
          createWriterIdeaMeaningAuthoringProfileProjection: loaded.createWriterAtlasTemporalAuthoringProfileProjection,
          createWriterSceneLanguageTagProfileProjection: loaded.createWriterAtlasTemporalAuthoringProfileProjection };
      }
      if (request === './core/writer-local-profile-v1.cjs' && historicalV10Constructor) {
        assert.equal(packaged, true); assert.equal(platform, 'darwin'); assert.equal(historicalV7Constructor || historicalV8Constructor || historicalV9Constructor, false);
        t.diagnostic('HISTORICAL_V10_CONSTRUCTOR_SELECTION_NOT_CURRENT_MAIN_PROFILE_COVERAGE');
        return { ...loaded, createWriterIdeaMeaningAuthoringProfileProjection: loaded.createWriterAtlasEntityCorrectionsProfileProjection,
          createWriterSceneLanguageTagProfileProjection: loaded.createWriterAtlasEntityCorrectionsProfileProjection };
      }
      if (request === './core/writer-local-profile-v1.cjs' && historicalV11Constructor) {
        assert.equal(packaged, true); assert.equal(platform, 'darwin');
        assert.equal(historicalV7Constructor || historicalV8Constructor || historicalV9Constructor || historicalV10Constructor, false);
        t.diagnostic('HISTORICAL_V11_CONSTRUCTOR_SELECTION_NOT_CURRENT_MAIN_PROFILE_COVERAGE');
        return { ...loaded, createWriterSceneLanguageTagProfileProjection: loaded.createWriterIdeaMeaningAuthoringProfileProjection };
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
        revokeProfile() { getWriterLocalRuntimeProfile = () => require('./core/writer-local-profile-v1.cjs').createWriterLocalProfileProjection({ isPackaged: true, platform: 'darwin' }); },
        invalidateSession() { commentAuthoringSessionId = crypto.randomUUID(); },
        invalidateGeneration() { lastSignaledEditGeneration += 1; },
        invalidateLifecycle() { currentFilePath += '.retired-synthetic-subject'; },
        invalidateProjectRoot() { currentProjectName += ' retired-synthetic-root'; },
        holdProjectQueue(operation) { return enqueueProductCommandTransaction(currentProjectName || DEFAULT_PROJECT_NAME, operation); },
        holdDiskQueue(operation) { return queueDiskOperation(operation, 'owned Pulse test queue'); },
        invalidatePulseUserData() { const get = app.getPath; app.getPath = key => key === 'userData' ? get(key) + '.retired' : get(key); },
        afterCoreBinding(callback) { const build = buildProductCoreStateForCurrentProject; let armed = true;
          buildProductCoreStateForCurrentProject = async (...args) => { const result = await build(...args);
            if (armed) { armed = false; await callback(result); } return result; }; },
        denyCapability(capabilityId = 'cap.manualMap.edit') { const read = readAuthorityCapabilityMatrixDoc; readAuthorityCapabilityMatrixDoc = () => {
          const matrix = read(); matrix.items.find(row => row.platformId === 'node').capabilities[capabilityId] = false; return matrix; }; },
        afterTruth(callback) { const prepare = prepareCanonicalProjectTruthCommand; prepareCanonicalProjectTruthCommand = async (...args) => {
          const result = await prepare(...args); await callback(); return result; }; }
      };`, mainPath);
    h.main = compiled.exports; h.main.createWindow();
    h.main.__host.revokeEntitlement = id => { h.deniedEntitlement = id; };
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

async function reattachmentMainFixture(t, packaged = false, beforeProject, { historicalV7Constructor = false, historicalV8Constructor = false, historicalV9Constructor = false, historicalV10Constructor = false } = {}) {
  const h = await fullMacMainFixture(t, { packaged, rendererLoaded: true, historicalV7Constructor, historicalV8Constructor, historicalV9Constructor, historicalV10Constructor }), ui = await fullMacRendererCommandPort(h);
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
  const h = await fullMacMainFixture(t, { historicalV9Constructor: true }), current = h.main.__profile();
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
  const x = await reattachmentMainFixture(t, true, undefined, { historicalV9Constructor: true }), id = 'atlas.calendar.define'; await persistTemporalControl(x, id, 'caller-control');
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


// Actual initial renderer state, actual Flow producers/listeners and actual renderer/Main command port.
function authorIdentityMainRenderer(x, projection, profileId) {
  const vm = require('node:vm'), source = read('src/renderer/editor.js'), tasks = [], packets = [], document = {};
  class Element {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.listeners = {}; this.disabled = false; this.value = ''; }
    get isConnected() { return this === document.body || !!this.parentElement?.isConnected; }
    set innerHTML(value) { assert.equal(value, ''); this.children.forEach(node => { node.parentElement = null; }); this.children = []; }
    append(...nodes) { nodes.forEach(node => this.appendChild(node)); }
    appendChild(node) { node.parentElement = this; this.children.push(node); return node; }
    setAttribute(name, value) { this[name] = value; }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    emit(name) { return this.listeners[name]?.({ target: this }); }
  }
  document.createElement = tag => new Element(tag); document.body = new Element('body'); const host = new Element('section'); document.body.append(host);
  const c = { document, HTMLElement: Element, window: { __PRODUCT_PROFILE: profileId }, crypto,
    atlasJourneyHost: host, atlasJourneyState: { status: 'idle', commandSeq: 0 }, atlasCurrentSceneState: structuredClone(projection),
    currentProjectId: x.projectId, currentDocumentId: x.sceneId, currentDocumentTitle: 'Owned author identity scene',
    currentTreeContentPublicationId: 'actual-main-scene', currentRightTab: 'atlas', currentAtlasSurface: 'journey',
    localEditGeneration: 0, lastAckedGeneration: 0, localDirty: false, atlasSelectedEntityId: '',
    atlasPublicationEpoch: 0, atlasCommandPublicationSequence: 0, atlasJourneyDraftRevision: 0,
    manualMapDraftOwnership: 0, manualMapDraftRevision: 0, applyAtlasResolvedSurfaceBinding() {}, updateStatusText() {},
    refreshAtlasProductSurfaces: async () => {}, console,
    dispatchUiCommand: async (id, payload) => { const response = await x.ui(id, payload); packets.push(response); return response.result; },
    refreshAtlasCurrentScene: async options => { const current = await x.query(); if (!options.isCurrent || options.isCurrent()) c.atlasCurrentSceneState = structuredClone(current); } };
  const start = source.indexOf('let atlasStableUiIdSeq = 0;'), end = source.indexOf('let atlasTemporalAuthorDraft =', start);
  assert.ok(start > 0 && end > start);
  const actual = name => {
    let a = source.indexOf('async function ' + name + '('); if (a < 0) a = source.indexOf('function ' + name + '(');
    const b = source.indexOf('\n}\n', a); assert.ok(a >= 0 && b > a, name); return source.slice(a, b + 2);
  };
  const names = ['makeAtlasCommandButton', 'getAtlasJourneyEntities', 'getAtlasJourneyMentions', 'findAtlasJourneyEntity',
    'findAtlasJourneyMention', 'makeStableUiId', 'ensureAtlasJourneyDraftId', 'getAtlasJourneyEntityName', 'getAtlasJourneyAliasValue',
    'reconcileAtlasJourneyDraft', 'appendAtlasJourneyField', 'appendAtlasJourneySelect', 'formatAtlasJourneyEntityOption',
    'formatAtlasJourneyMentionOption', 'renderAtlasJourneyState', 'captureAtlasPublication', 'runProductJourneyCommand',
    'getAtlasSuppressionContext', 'isAtlasSuppressionCurrent'];
  vm.createContext(c); vm.runInContext(source.slice(start, end) + names.map(actual).join('\n')
    + '\nconst executeActualJourney = runProductJourneyCommand; runProductJourneyCommand = (...args) => { const p = executeActualJourney(...args); tasks.push(p); return p; };',
  Object.assign(c, { tasks })); c.renderAtlasJourneyState();
  const walk = node => [node, ...node.children.flatMap(walk)];
  const field = async (name, value) => { const node = walk(host).find(row => row.dataset.atlasJourneyField === name); assert.ok(node, name);
    node.value = value; await node.emit(node.tagName === 'SELECT' ? 'change' : 'input'); };
  const click = async action => { const button = walk(host).find(node => node.dataset.atlasJourneyAction === action);
    assert.ok(button); assert.equal(button.disabled, false, 'valid actual producer ' + action); const n = tasks.length;
    button.emit('click'); assert.equal(tasks.length, n + 1); await tasks[n]; assert.ok(packets.length); return packets.at(-1); };
  const target = async (entityId, offset) => { const mention = c.atlasCurrentSceneState.mentions.find(row => row.entityId === entityId && row.startOffset === offset);
    assert.ok(mention, 'real current Main occurrence'); await field('mentionId', mention.mentionId); return structuredClone(mention); };
  return { c, field, click, target, packets };
}

function authorIdentitySnapshot(x) {
  const stage = path.join(x.f.projectRoot, '.stage10-local'), manifestRaw = fs.readFileSync(x.f.manifestPath, 'utf8');
  const session = JSON.parse(fs.readFileSync(path.join(stage, 'product-session.v2.json')));
  const authorityStore = JSON.parse(fs.readFileSync(path.join(stage, 'command-receipt-authority-store.v2.json')));
  const roster = reattachmentWholeFixtureRoster(x.h), anchorNames = ['integrity-anchor.v1.json', 'integrity-anchor.recovery.v1.json', 'fencing-generation.v1.json'];
  const anchors = Object.fromEntries(roster.filter(([name]) => name.startsWith(path.join('userData', 'stage10-integrity-anchors') + path.sep)
    && anchorNames.includes(path.basename(name))).map(([name]) => [name, JSON.parse(fs.readFileSync(path.join(x.h.root, name)))]));
  return { manifest: JSON.parse(manifestRaw), manifestRaw, session, authorityStore, anchors, observedAtMs: Date.now(),
    scene: fs.readFileSync(x.f.scenePath), roster, events: session.eventLog.events, receipts: authorityStore.receipts };
}

function assertAuthorIdentityCanonical(actual, expected) {
  assert.deepEqual(actual, expected);
  const bytes = value => Buffer.from(JSON.stringify(canonicalTemporalValue(value)));
  assert.deepEqual(bytes(actual), bytes(expected)); assert.equal(crypto.createHash('sha256').update(bytes(actual)).digest('hex'),
    crypto.createHash('sha256').update(bytes(expected)).digest('hex'));
}

function assertAuthorIdentityPreservation(x, before, after, commandId, payload, applied, identityKey) {
  const count = applied ? 1 : 0, seq = before.manifest.lastCommandId + count;
  assertAuthorIdentityCanonical(after.events.slice(0, before.events.length), before.events);
  assertAuthorIdentityCanonical(after.receipts.slice(0, before.receipts.length), before.receipts);
  assert.equal(after.events.length, before.events.length + count); assert.equal(after.receipts.length, before.receipts.length + count);
  assert.deepEqual(after.scene, before.scene); assert.equal(after.manifest.lastCommandId, seq); x.assertOriginal();
  if (!applied) { assert.deepEqual(after.roster, before.roster); assertAuthorIdentityCanonical(after.manifest, before.manifest); return; }
  assert.equal(after.events.at(-1).commandId, commandId); assert.equal(after.receipts.at(-1).commandId, commandId);
  assert.equal(after.events.at(-1).domainEventDigest, after.receipts.at(-1).domainEventDigest);
  const projectPrefix = path.relative(x.h.root, x.f.projectRoot) + path.sep;
  const anchorPrefix = path.join('userData', 'stage10-integrity-anchors', identityKey) + path.sep;
  const digest = text => crypto.createHash('sha256').update(text).digest('hex');
  const previousHash = digest(before.manifestRaw), nextHash = digest(after.manifestRaw);
  const transitionBase = path.join('userData', 'stage10-integrity-anchors', 'manifest-transitions');
  const transitionRoot = path.join(transitionBase, digest(x.projectId + '\0' + x.f.manifestPath));
  const transitionDir = path.join(transitionRoot, previousHash), transitionFile = path.join(transitionDir, nextHash + '.json');
  const transitionText = JSON.stringify({ schemaVersion: 'yalken.manifest-transition.v1', projectId: x.projectId,
    targetPath: x.f.manifestPath, previousHash, nextHash });
  assert.notEqual(previousHash, nextHash); assert.equal(fs.readFileSync(path.join(x.h.root, transitionFile), 'utf8'), transitionText);
  const prior = new Map(before.roster), currentRoster = new Map(after.roster), additions = new Set();
  assert.equal(prior.has(transitionFile), false, 'one new command has one new manifest transition');
  for (const name of [transitionBase, transitionRoot, transitionDir]) {
    assert.equal(currentRoster.get(name), 'directory'); if (!prior.has(name)) additions.add(name);
  }
  assert.equal(currentRoster.get(transitionFile), digest(transitionText)); additions.add(transitionFile);
  const mutable = new Set([projectPrefix + 'project.craftsman.json',
    ...['product-session.v2.json', 'command-receipt-authority-store.v2.json', path.join('recovery', 'project-truth.latest.v1.json')]
      .map(name => projectPrefix + path.join('.stage10-local', name)),
    ...['integrity-anchor.v1.json', 'integrity-anchor.recovery.v1.json', 'fencing-generation.v1.json'].map(name => anchorPrefix + name)]);
  const fixed = rows => rows.filter(([name]) => !mutable.has(name) && !additions.has(name));
  assert.deepEqual(fixed(after.roster), fixed(before.roster), 'all prior transitions, manuscript, foreign projects and unrelated runtime files exact');
  const previousAnchor = before.anchors[anchorPrefix + 'integrity-anchor.v1.json'], head = after.authorityStore.currentHead;
  assertAuthorIdentityCanonical(after.anchors[anchorPrefix + 'integrity-anchor.recovery.v1.json'], previousAnchor);
  const anchorCore = { schemaVersion: 'yalken.stage10.mainIntegrityAnchor.v1', anchorVersion: 1, projectId: x.projectId,
    authorityGeneration: head.authorityGeneration, receiptCount: head.receiptCount, receiptRootDigest: head.receiptRootDigest,
    eventLogDigest: head.eventLogDigest, authorityHeadDigest: head.authorityHeadDigest,
    authorityStoreDigest: x.hash(after.authorityStore), sessionDigest: x.hash(after.session),
    previousIntegrityAnchorDigest: previousAnchor.integrityAnchorDigest };
  assert.equal(anchorCore.authorityGeneration, previousAnchor.authorityGeneration + 1);
  assertAuthorIdentityCanonical(after.anchors[anchorPrefix + 'integrity-anchor.v1.json'], { ...anchorCore, integrityAnchorDigest: x.hash(anchorCore) });
  const oldFence = before.anchors[anchorPrefix + 'fencing-generation.v1.json'], fence = after.anchors[anchorPrefix + 'fencing-generation.v1.json'];
  assert.match(fence.ownerTokenDigest, /^[a-f0-9]{64}$/u); assert.notEqual(fence.ownerTokenDigest, oldFence.ownerTokenDigest);
  assert.ok(fence.issuedAtMs >= before.observedAtMs && fence.issuedAtMs <= after.observedAtMs);
  assert.ok(Number.isSafeInteger(fence.monotonicIssuedAtMs) && fence.monotonicIssuedAtMs >= oldFence.monotonicIssuedAtMs);
  assertAuthorIdentityCanonical(fence, { ...oldFence, fencingGeneration: oldFence.fencingGeneration + 1,
    ownerTokenDigest: fence.ownerTokenDigest, issuedAtMs: fence.issuedAtMs, monotonicIssuedAtMs: fence.monotonicIssuedAtMs });
  const recovery = JSON.parse(fs.readFileSync(path.join(x.f.projectRoot, '.stage10-local', 'recovery', 'project-truth.latest.v1.json')));
  assertAuthorIdentityCanonical(recovery, { schemaVersion: 'yalken.stage10.projectTruthRecovery.v1', projectId: x.projectId, reason: commandId,
    previousIntegrityAnchorDigest: previousAnchor.integrityAnchorDigest, previousHash, intendedNextHash: nextHash, previousText: before.manifestRaw });
  const old = before.manifest.atlas, current = after.manifest.atlas, expectedEntities = structuredClone(old.entities), expectedDecisions = structuredClone(old.decisions);
  if (commandId === 'atlas.entity.create') {
    assert.equal(Object.hasOwn(old.entities, payload.entityId), false);
    expectedEntities[payload.entityId] = { id: payload.entityId, name: payload.name, entityKind: payload.entityKind, aliases: {},
      createdByCommandSeq: seq, updatedByCommandSeq: seq };
  } else {
    const entity = expectedEntities[payload.entityId]; assert.ok(entity); entity.updatedByCommandSeq = seq;
    if (commandId === 'atlas.alias.add') {
      assert.equal(Object.hasOwn(entity.aliases, payload.aliasId), false);
      entity.aliases[payload.aliasId] = { id: payload.aliasId, value: payload.value, scope: payload.scope, sceneId: payload.sceneId, createdByCommandSeq: seq };
    } else {
      const added = Object.keys(current.decisions).filter(id => !Object.hasOwn(old.decisions, id)); assert.equal(added.length, 1);
      expectedDecisions[added[0]] = { id: added[0], decisionKind: 'mention.confirm', trustState: 'AUTHOR_CONFIRMED',
        projectId: x.projectId, sceneId: payload.sceneId, entityId: payload.entityId, mentionId: payload.mentionId,
        evidenceAnchor: payload.evidenceAnchor, createdByCommandSeq: seq };
    }
  }
  assertAuthorIdentityCanonical(current.entities, expectedEntities); assertAuthorIdentityCanonical(current.decisions, expectedDecisions);
  assertAuthorIdentityCanonical(after.manifest, { ...before.manifest, lastCommandId: seq,
    atlas: { ...old, entities: expectedEntities, decisions: expectedDecisions } });
}

test('actual V9 cold producers independently create entity alias and confirmation after historical counter records [FINITE_IPC_NOT_NATIVE]', async t => {
  const x = await reattachmentMainFixture(t, true, undefined, { historicalV9Constructor: true });
  assert.equal(x.h.main.__profile().profileId, 'WRITER_LOCAL_ATLAS_TEMPORAL_AUTHORING_V9');
  assert.equal((await x.h.main.handleProjectLifecycleCreateCommand({ projectName: 'Foreign identity project' })).ok, true);
  assert.equal((await x.h.main.handleProjectLifecycleOpenCommand({ projectId: x.projectId })).ok, true);
  const key = (await import('../../src/product/stage10ProjectIdentityKey.mjs')).stage10ProjectPathIdentity(x.projectId); assert.equal(key.ok, true);
  const historical = authorIdentityMainRenderer(x, await x.query(), 'WRITER_LOCAL_ATLAS_READ_SURFACES_V8');
  await historical.field('entityName', 'Мира'); const created = await historical.click('create-entity'); assertTemporalMainReceipt(created.mainResult, 'atlas.entity.create');
  const entityId = created.request.payload.entityId; assert.equal(entityId, 'atlas-entity-00001');
  await historical.target(entityId, 25); await historical.field('aliasValue', 'Старый псевдоним é 🧭');
  const aliased = await historical.click('add-alias'); assertTemporalMainReceipt(aliased.mainResult, 'atlas.alias.add');
  assert.equal(aliased.request.payload.aliasId, 'atlas-alias-00002');
  const confirmed = await historical.click('confirm-mention'); assertTemporalMainReceipt(confirmed.mainResult, 'atlas.mention.confirm');
  assert.equal(confirmed.request.payload.decisionId, 'atlas-decision-00003'); const preserved = authorIdentitySnapshot(x);
  assert.equal((await x.h.main.handleProjectLifecycleOpenCommand({ projectId: x.projectId })).ok, true);
  assertAuthorIdentityCanonical(authorIdentitySnapshot(x).manifest, preserved.manifest);
  const renderer = authorIdentityMainRenderer(x, await x.query(), 'WRITER_LOCAL_ATLAS_TEMPORAL_AUTHORING_V9');
  await renderer.target(entityId, 68); await renderer.field('entityName', 'Лира после перезапуска é 🧭');
  await renderer.field('aliasValue', 'Другой псевдоним после перезапуска é 🧭');
  for (const [action, id] of [['create-entity', 'atlas.entity.create'], ['add-alias', 'atlas.alias.add'], ['confirm-mention', 'atlas.mention.confirm']])
    await t.test(id, async () => {
      const before = authorIdentitySnapshot(x), response = await renderer.click(action), after = authorIdentitySnapshot(x), payload = response.request.payload;
      t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_COLD_AUTHOR_PRODUCER', id, payload, response, before: before.manifest.atlas, after: after.manifest.atlas }));
      const applied = response.mainResult.ok === true;
      assertAuthorIdentityPreservation(x, before, after, id, payload, applied, key.canonicalKey);
      if (!applied) assert.match(JSON.stringify(response), /E_ATLAS_(?:ENTITY|ALIAS|DECISION)_ALREADY_EXISTS/u, 'valid producer failure must be the predicted collision');
      const receipt = assertTemporalMainReceipt(response.mainResult, id);
      assert.equal(response.result.ok, true); assert.equal(response.result.value.performed, true);
      assert.deepEqual(response.result.value.result, response.mainResult.value); assert.deepEqual(after.receipts.at(-1), receipt);
      if (id === 'atlas.entity.create') assert.equal(after.manifest.atlas.entities[payload.entityId].name, payload.name);
      if (id === 'atlas.alias.add') assert.equal(after.manifest.atlas.entities[entityId].aliases[payload.aliasId].value, payload.value);
      if (id === 'atlas.mention.confirm') assert.equal(Object.hasOwn(payload, 'decisionId'), false);
    });
  await t.test('a different opaque alias ID still refuses an already saved alias value', async () => {
    await renderer.field('aliasValue', 'Старый псевдоним é 🧭'); const before = authorIdentitySnapshot(x), result = await renderer.click('add-alias'), after = authorIdentitySnapshot(x);
    t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_ALIAS_VALUE_DUPLICATE', result }));
    assert.equal(result.mainResult.ok, false); assert.match(JSON.stringify(result), /E_ATLAS_ALIAS_VALUE_ALREADY_EXISTS/u);
    assert.deepEqual(after.roster, before.roster); assertAuthorIdentityCanonical(after.manifest, before.manifest);
    assertAuthorIdentityCanonical(after.events, before.events); assertAuthorIdentityCanonical(after.receipts, before.receipts);
  });
  const after = authorIdentitySnapshot(x);
  for (const [id, record] of Object.entries(preserved.manifest.atlas.decisions)) assertAuthorIdentityCanonical(after.manifest.atlas.decisions[id], record);
  for (const [id, record] of Object.entries(preserved.manifest.atlas.entities[entityId].aliases)) assertAuthorIdentityCanonical(after.manifest.atlas.entities[entityId].aliases[id], record);
  assertAuthorIdentityCanonical(after.events.slice(0, preserved.events.length), preserved.events);
  assertAuthorIdentityCanonical(after.receipts.slice(0, preserved.receipts.length), preserved.receipts);
});

test('actual V9 warm distinct confirmations preserve both canonical records and prior history [FINITE_IPC_NOT_NATIVE]', async t => {
  const x = await reattachmentMainFixture(t, true), key = (await import('../../src/product/stage10ProjectIdentityKey.mjs')).stage10ProjectPathIdentity(x.projectId);
  const renderer = authorIdentityMainRenderer(x, await x.query(), 'WRITER_LOCAL_ATLAS_TEMPORAL_AUTHORING_V9');
  await renderer.target(x.entityId, 25); const before = authorIdentitySnapshot(x), first = await renderer.click('confirm-mention'), once = authorIdentitySnapshot(x);
  assertTemporalMainReceipt(first.mainResult, 'atlas.mention.confirm');
  assertAuthorIdentityPreservation(x, before, once, 'atlas.mention.confirm', first.request.payload, true, key.canonicalKey);
  await renderer.target(x.entityId, 68); const second = await renderer.click('confirm-mention'), twice = authorIdentitySnapshot(x);
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_WARM_DISTINCT_CONFIRMATIONS', first, second, firstDecisions: once.manifest.atlas.decisions, afterDecisions: twice.manifest.atlas.decisions }));
  assertAuthorIdentityPreservation(x, once, twice, 'atlas.mention.confirm', second.request.payload, second.mainResult.ok === true, key.canonicalKey);
  assertTemporalMainReceipt(second.mainResult, 'atlas.mention.confirm');
  assert.equal(Object.keys(twice.manifest.atlas.decisions).length, Object.keys(before.manifest.atlas.decisions).length + 2);
});

for (const cold of [false, true]) test('actual V9 identical canonical confirmation retains lawful duplicate refusal ' + (cold ? 'after reopen' : 'while warm'), async t => {
  const x = await reattachmentMainFixture(t, true); let renderer = authorIdentityMainRenderer(x, await x.query(), 'WRITER_LOCAL_ATLAS_TEMPORAL_AUTHORING_V9');
  await renderer.target(x.entityId, 68); const first = await renderer.click('confirm-mention'); assertTemporalMainReceipt(first.mainResult, 'atlas.mention.confirm');
  if (cold) { assert.equal((await x.h.main.handleProjectLifecycleOpenCommand({ projectId: x.projectId })).ok, true);
    renderer = authorIdentityMainRenderer(x, await x.query(), 'WRITER_LOCAL_ATLAS_TEMPORAL_AUTHORING_V9'); await renderer.target(x.entityId, 68); }
  const before = authorIdentitySnapshot(x), result = await renderer.click('confirm-mention'), after = authorIdentitySnapshot(x);
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_IDENTICAL_CANONICAL_CONFIRMATION', cold, result }));
  assert.equal(result.mainResult.ok, false); assert.equal(result.result.ok, false);
  assert.match(JSON.stringify(result), /E_ATLAS_DECISION_ALREADY_EXISTS/u);
  assert.deepEqual(after.roster, before.roster); assertAuthorIdentityCanonical(after.manifest, before.manifest);
  assertAuthorIdentityCanonical(after.events, before.events); assertAuthorIdentityCanonical(after.receipts, before.receipts); x.assertOriginal();
});

test('actual V9 Source entity selection persists alias under the explicitly chosen real entity [FINITE_IPC_NOT_NATIVE]', async t => {
  const x = await reattachmentMainFixture(t, true, undefined, { historicalV9Constructor: true }), targetId = 'source-selection-beacon';
  assert.equal(x.h.main.__profile().profileId, 'WRITER_LOCAL_ATLAS_TEMPORAL_AUTHORING_V9');
  assert.equal((await x.h.main.handleProjectLifecycleCreateCommand({ projectName: 'Foreign source selection project' })).ok, true);
  assert.equal((await x.h.main.handleProjectLifecycleOpenCommand({ projectId: x.projectId })).ok, true);
  const identity = (await import('../../src/product/stage10ProjectIdentityKey.mjs')).stage10ProjectPathIdentity(x.projectId);
  assert.equal(identity.ok, true);
  const setupPayload = { projectId: x.projectId, entityId: targetId, name: 'Маяк', entityKind: 'character' };
  const setupBefore = authorIdentitySnapshot(x), setup = await x.ui('atlas.entity.create', setupPayload), setupAfter = authorIdentitySnapshot(x);
  assertTemporalMainReceipt(setup.mainResult, 'atlas.entity.create');
  assertAuthorIdentityPreservation(x, setupBefore, setupAfter, 'atlas.entity.create', setupPayload, true, identity.canonicalKey);
  const queryBefore = authorIdentitySnapshot(x), projection = await x.query(), queryAfter = authorIdentitySnapshot(x);
  assert.deepEqual(queryAfter.roster, queryBefore.roster);
  for (const id of [x.entityId, targetId]) {
    assert.equal(projection.entities.some(row => row.entityId === id), true, 'real Main query must expose entity ' + id);
    assert.equal(projection.mentions.some(row => row.entityId === id && row.evidenceAnchor?.entityId === id), true,
      'real Main query must expose the matching occurrence ' + id);
  }
  const targetMention = projection.mentions.find(row => row.entityId === targetId);
  assert.equal(targetMention.matchedText.toLowerCase(), 'маяк');
  for (const mode of ['source-picker', 'explicit-mention-positive']) await t.test(mode, async child => {
    const current = await x.query(), renderer = authorIdentityMainRenderer(x, current, 'WRITER_LOCAL_ATLAS_TEMPORAL_AUTHORING_V9');
    await renderer.target(x.entityId, 25);
    if (mode === 'source-picker') await renderer.field('sourceEntityId', targetId);
    else await renderer.target(targetId, targetMention.startOffset);
    const walk = node => [node, ...node.children.flatMap(walk)];
    const sourceControl = walk(renderer.c.atlasJourneyHost).find(node => node.dataset.atlasJourneyField === 'sourceEntityId');
    const mentionControl = walk(renderer.c.atlasJourneyHost).find(node => node.dataset.atlasJourneyField === 'mentionId');
    if (mode === 'explicit-mention-positive') {
      assert.equal(sourceControl.value, targetId); assert.equal(mentionControl.value, targetMention.mentionId);
    }
    await renderer.field('aliasValue', 'Псевдоним маяка é 🧭 ' + mode);
    const selection = { requestedSourceEntityId: targetId, renderedSourceEntityId: sourceControl.value, renderedMentionId: mentionControl.value };
    const before = authorIdentitySnapshot(x), response = await renderer.click('add-alias'), after = authorIdentitySnapshot(x);
    child.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_TWO_ENTITY_SOURCE_SELECTION_PERSISTENCE', mode, selection,
      response, before, after }));
    const payload = response.request.payload, receipt = assertTemporalMainReceipt(response.mainResult, 'atlas.alias.add');
    assert.equal(response.result.ok, true); assert.equal(response.result.value.performed, true);
    assert.deepEqual(response.result.value.result, response.mainResult.value); assert.deepEqual(after.receipts.at(-1), receipt);
    assert.equal(payload.value, 'Псевдоним маяка é 🧭 ' + mode);
    assertAuthorIdentityPreservation(x, before, after, 'atlas.alias.add', payload, true, identity.canonicalKey);
    assert.equal(after.manifest.atlas.entities[payload.entityId].aliases[payload.aliasId].value, payload.value,
      'actual APPLIED owner and complete success footprint are checked before requested destination');
    assert.equal(payload.entityId, targetId, 'alias intent must address the entity explicitly selected by the author');
    assert.equal(selection.renderedSourceEntityId, targetId); assert.equal(selection.renderedMentionId, targetMention.mentionId);
    assertAuthorIdentityCanonical(after.manifest.atlas.entities[x.entityId], before.manifest.atlas.entities[x.entityId]);
    assert.equal(after.manifest.atlas.entities[targetId].aliases[payload.aliasId].value, payload.value);
  });
});

const CORRECTION_MAIN_IDS = ['atlas.observation.reassign', 'atlas.entity.merge', 'atlas.entity.splitRestore'];
const CORRECTION_V10 = 'WRITER_LOCAL_ATLAS_ENTITY_CORRECTIONS_V10';

function assertCorrectionPersistence(x, before, after, commandId, payload, applied) {
  const seq = before.manifest.lastCommandId + (applied ? 1 : 0);
  assertAuthorIdentityCanonical(after.events.slice(0, before.events.length), before.events);
  assertAuthorIdentityCanonical(after.receipts.slice(0, before.receipts.length), before.receipts);
  assert.deepEqual(after.scene, before.scene); x.assertOriginal();
  if (!applied) { assert.deepEqual(after.roster, before.roster); assertAuthorIdentityCanonical(after.manifest, before.manifest); return; }
  assert.equal(after.events.length, before.events.length + 1); assert.equal(after.receipts.length, before.receipts.length + 1);
  assert.equal(after.events.at(-1).commandId, commandId); assert.equal(after.receipts.at(-1).commandId, commandId);
  assert.equal(after.events.at(-1).domainEventDigest, after.receipts.at(-1).domainEventDigest);
  const atlas = structuredClone(before.manifest.atlas), sourceId = payload.sourceEntityId, targetId = payload.targetEntityId;
  if (commandId === 'atlas.observation.reassign') {
    atlas.entities[sourceId].updatedByCommandSeq = seq; atlas.entities[targetId].updatedByCommandSeq = seq;
    atlas.reassignments = { ...(atlas.reassignments || {}), [payload.reassignmentId]: { id: payload.reassignmentId,
      operationKind: 'observation.reassign', projectId: x.projectId, sceneId: payload.sceneId, sourceEntityId: sourceId,
      targetEntityId: targetId, observationId: payload.observationId || '', mentionId: payload.mentionId || '', reason: payload.reason || '',
      evidenceAnchor: payload.evidenceAnchor, createdByCommandSeq: seq } };
  } else if (commandId === 'atlas.entity.merge') {
    const beforeSourceEntity = structuredClone(atlas.entities[sourceId]), beforeTargetEntity = structuredClone(atlas.entities[targetId]);
    atlas.entities[sourceId] = { ...beforeSourceEntity, mergeState: 'MERGED', mergedIntoEntityId: targetId,
      mergeOperationId: payload.operationId, mergedByCommandSeq: seq, updatedByCommandSeq: seq };
    atlas.entities[targetId] = { ...beforeTargetEntity, mergedSourceEntityIds: [...new Set([...(beforeTargetEntity.mergedSourceEntityIds || []), sourceId])].sort(), updatedByCommandSeq: seq };
    atlas.entityOperations = { ...(atlas.entityOperations || {}), [payload.operationId]: { id: payload.operationId,
      operationKind: 'entity.merge', projectId: x.projectId, sourceEntityId: sourceId, targetEntityId: targetId, reason: payload.reason || '',
      beforeSourceEntity, beforeTargetEntity, afterSourceEntity: structuredClone(atlas.entities[sourceId]),
      afterTargetEntity: structuredClone(atlas.entities[targetId]), createdByCommandSeq: seq, restoredByCommandSeq: 0, restoreOperationId: '' } };
  } else {
    const operation = atlas.entityOperations[payload.operationId]; assert.ok(operation);
    atlas.entities[operation.sourceEntityId] = structuredClone(operation.beforeSourceEntity);
    atlas.entities[operation.targetEntityId] = structuredClone(operation.beforeTargetEntity);
    atlas.entityOperations[payload.operationId] = { ...operation, restoredByCommandSeq: seq, restoreOperationId: payload.restoreOperationId };
  }
  assertAuthorIdentityCanonical(after.manifest, { ...before.manifest, lastCommandId: seq, atlas });
  const projectPrefix = path.relative(x.h.root, x.f.projectRoot) + path.sep;
  const anchorPrefix = path.join('userData', 'stage10-integrity-anchors', x.identityKey) + path.sep;
  const digest = value => crypto.createHash('sha256').update(value).digest('hex');
  const previousHash = digest(before.manifestRaw), nextHash = digest(after.manifestRaw);
  const base = path.join('userData', 'stage10-integrity-anchors', 'manifest-transitions');
  const transitionRoot = path.join(base, digest(x.projectId + '\0' + x.f.manifestPath)), transitionDir = path.join(transitionRoot, previousHash);
  const transitionFile = path.join(transitionDir, nextHash + '.json');
  const transition = JSON.stringify({ schemaVersion: 'yalken.manifest-transition.v1', projectId: x.projectId,
    targetPath: x.f.manifestPath, previousHash, nextHash });
  assert.equal(fs.readFileSync(path.join(x.h.root, transitionFile), 'utf8'), transition);
  const oldRoster = new Map(before.roster), newRoster = new Map(after.roster), added = new Set([transitionFile]);
  assert.equal(oldRoster.has(transitionFile), false); assert.equal(newRoster.get(transitionFile), digest(transition));
  for (const name of [base, transitionRoot, transitionDir]) { assert.equal(newRoster.get(name), 'directory'); if (!oldRoster.has(name)) added.add(name); }
  const mutable = new Set([projectPrefix + 'project.craftsman.json',
    ...['product-session.v2.json', 'command-receipt-authority-store.v2.json', path.join('recovery', 'project-truth.latest.v1.json')]
      .map(name => projectPrefix + path.join('.stage10-local', name)),
    ...['integrity-anchor.v1.json', 'integrity-anchor.recovery.v1.json', 'fencing-generation.v1.json'].map(name => anchorPrefix + name)]);
  const fixed = rows => rows.filter(([name]) => !mutable.has(name) && !added.has(name));
  assert.deepEqual(fixed(after.roster), fixed(before.roster), 'complete foreign state manuscript and prior transition records stay exact');
  const previousAnchor = before.anchors[anchorPrefix + 'integrity-anchor.v1.json'], head = after.authorityStore.currentHead;
  assertAuthorIdentityCanonical(after.anchors[anchorPrefix + 'integrity-anchor.recovery.v1.json'], previousAnchor);
  const anchorCore = { schemaVersion: 'yalken.stage10.mainIntegrityAnchor.v1', anchorVersion: 1, projectId: x.projectId,
    authorityGeneration: head.authorityGeneration, receiptCount: head.receiptCount, receiptRootDigest: head.receiptRootDigest,
    eventLogDigest: head.eventLogDigest, authorityHeadDigest: head.authorityHeadDigest, authorityStoreDigest: x.hash(after.authorityStore),
    sessionDigest: x.hash(after.session), previousIntegrityAnchorDigest: previousAnchor.integrityAnchorDigest };
  assert.equal(anchorCore.authorityGeneration, previousAnchor.authorityGeneration + 1);
  assertAuthorIdentityCanonical(after.anchors[anchorPrefix + 'integrity-anchor.v1.json'], { ...anchorCore, integrityAnchorDigest: x.hash(anchorCore) });
  const fence = after.anchors[anchorPrefix + 'fencing-generation.v1.json'], oldFence = before.anchors[anchorPrefix + 'fencing-generation.v1.json'];
  assert.match(fence.ownerTokenDigest, /^[a-f0-9]{64}$/u); assert.notEqual(fence.ownerTokenDigest, oldFence.ownerTokenDigest);
  assert.ok(fence.issuedAtMs >= before.observedAtMs && fence.issuedAtMs <= after.observedAtMs);
  assert.ok(Number.isSafeInteger(fence.monotonicIssuedAtMs) && fence.monotonicIssuedAtMs >= oldFence.monotonicIssuedAtMs);
  assertAuthorIdentityCanonical(fence, { ...oldFence, fencingGeneration: oldFence.fencingGeneration + 1,
    ownerTokenDigest: fence.ownerTokenDigest, issuedAtMs: fence.issuedAtMs, monotonicIssuedAtMs: fence.monotonicIssuedAtMs });
  const recovery = JSON.parse(fs.readFileSync(path.join(x.f.projectRoot, '.stage10-local', 'recovery', 'project-truth.latest.v1.json')));
  assertAuthorIdentityCanonical(recovery, { schemaVersion: 'yalken.stage10.projectTruthRecovery.v1', projectId: x.projectId,
    reason: commandId, previousIntegrityAnchorDigest: previousAnchor.integrityAnchorDigest, previousHash, intendedNextHash: nextHash, previousText: before.manifestRaw });
}

async function correctionMainFixture(t, packaged = false, beforeProject, historicalV9Constructor = false) {
  const x = await reattachmentMainFixture(t, packaged, beforeProject, { historicalV9Constructor });
  x.targetEntityId = 'correction-beacon';
  assertTemporalMainReceipt(await x.command('atlas.entity.create', { entityId: x.targetEntityId, name: 'Маяк', entityKind: 'character' }), 'atlas.entity.create');
  const foreign = await x.h.main.handleProjectLifecycleCreateCommand({ projectName: 'Foreign correction project' }); assert.equal(foreign.ok, true);
  assert.equal((await x.h.main.handleProjectLifecycleOpenCommand({ projectId: x.projectId })).ok, true);
  x.foreignProjectId = foreign.projectId;
  const identity = (await import('../../src/product/stage10ProjectIdentityKey.mjs')).stage10ProjectPathIdentity(x.projectId); assert.equal(identity.ok, true);
  x.identityKey = identity.canonicalKey;
  const current = await x.query(); for (const id of [x.entityId, x.targetEntityId]) {
    assert.equal(current.entities.some(row => row.entityId === id), true); assert.equal(current.mentions.some(row => row.entityId === id), true);
  }
  x.payloadFor = async (id, tag) => {
    if (id === 'atlas.entity.splitRestore') {
      const merge = { projectId: x.projectId, sourceEntityId: x.entityId, targetEntityId: x.targetEntityId, operationId: 'prepare-' + tag, reason: 'Owned restore setup' };
      const before = authorIdentitySnapshot(x), response = await x.ui('atlas.entity.merge', merge), after = authorIdentitySnapshot(x);
      assertTemporalMainReceipt(response.mainResult, 'atlas.entity.merge'); assertCorrectionPersistence(x, before, after, 'atlas.entity.merge', merge, true);
      return { projectId: x.projectId, operationId: merge.operationId, restoreOperationId: 'restore-' + tag };
    }
    if (id === 'atlas.entity.merge') return { projectId: x.projectId, sourceEntityId: x.entityId,
      targetEntityId: x.targetEntityId, operationId: 'merge-' + tag, reason: 'Explicit author merge é 🧭' };
    const mention = (await x.query()).mentions.find(row => row.entityId === x.entityId && row.startOffset === 68); assert.ok(mention);
    return { projectId: x.projectId, sceneId: x.sceneId, sourceEntityId: x.entityId, targetEntityId: x.targetEntityId,
      mentionId: mention.mentionId, evidenceAnchor: mention.evidenceAnchor, reassignmentId: 'reassign-' + tag, reason: 'Explicit author correction é 🧭' };
  };
  x.apply = async (id, payload) => {
    const before = authorIdentitySnapshot(x), response = await x.ui(id, payload), after = authorIdentitySnapshot(x);
    t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_CORRECTION_PERSISTENCE', id, response, before, after }));
    const applied = response.mainResult.ok === true; assertCorrectionPersistence(x, before, after, id, payload, applied);
    const receipt = assertTemporalMainReceipt(response.mainResult, id); assert.equal(response.result.ok, true);
    assert.equal(response.result.value.performed, true); assert.equal(response.result.value.commandAuthority, 'CommandKernel');
    assert.equal(response.result.value.commandId, id); assert.deepEqual(response.result.value.result, response.mainResult.value);
    assert.deepEqual(after.receipts.at(-1), receipt); return { response, before, after };
  };
  x.control = async id => {
    const payload = await x.payloadFor(id, 'positive-control'); await x.apply(id, payload);
    if (id === 'atlas.entity.merge') await x.apply('atlas.entity.splitRestore', { projectId: x.projectId,
      operationId: payload.operationId, restoreOperationId: 'restore-positive-control' });
  };
  return x;
}

test('historical V10 constructor selection preserves twenty-nine commands and twelve queries independently of current Main', async t => {
  const h = await fullMacMainFixture(t, { historicalV10Constructor: true }), active = h.main.__profile();
  assert.equal(active.profileId, CORRECTION_V10); assert.equal(active.schemaVersion, 'writer-local-profile.v10');
  assert.deepEqual(active.admittedCommandIds, [...profile.createWriterAtlasTemporalAuthoringProfileProjection({ isPackaged: true, platform: 'darwin' }).admittedCommandIds, ...CORRECTION_MAIN_IDS]);
  assert.equal(active.admittedCommandIds.length, 29); assert.deepEqual(active.admittedQueryIds, READ_SURFACE_QUERY_IDS);
  assert.equal(new URL(h.shellUrl).searchParams.get('PRODUCT_PROFILE'), CORRECTION_V10);
  for (const key of ['optionalSystemsEnabled', 'signing', 'notarization', 'publicDistribution', 'dependencyAdoption', 'cloudAuthority', 'userDataMutation']) assert.equal(active[key], false);
});

for (const id of CORRECTION_MAIN_IDS) test('lawful unpackaged actual Main persists ' + id + ' with complete canonical footprint [FINITE_IPC_NOT_NATIVE]', async t => {
  const x = await correctionMainFixture(t), payload = await x.payloadFor(id, 'real-positive'); await x.apply(id, payload);
  const before = authorIdentitySnapshot(x), dossier = await x.h.query('query.atlasEntityDossier', { projectId: x.projectId, entityId: x.targetEntityId });
  assert.equal(dossier.ok, true); assert.deepEqual(authorIdentitySnapshot(x).roster, before.roster);
  if (id === 'atlas.observation.reassign') assert.equal(dossier.atlasEntityDossier.evidenceLedger.rows.some(row => row.quote === payload.evidenceAnchor.quote), true);
});

test('historical trusted V9 refuses all three correction commands before Core with complete no-write', async t => {
  const x = await correctionMainFixture(t, true, undefined, true); assert.equal(x.h.main.__profile().profileId, 'WRITER_LOCAL_ATLAS_TEMPORAL_AUTHORING_V9');
  for (const id of CORRECTION_MAIN_IDS) {
    const before = authorIdentitySnapshot(x), payload = id === 'atlas.entity.splitRestore' ? { projectId: x.projectId, operationId: 'not-yet-admitted' } : await x.payloadFor(id, 'historical');
    const response = await x.ui(id, payload); assert.equal(response.mainResult.ok, false);
    assert.match(JSON.stringify(response), /WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED/u); assert.deepEqual(authorIdentitySnapshot(x).roster, before.roster);
  }
});

for (const id of ['atlas.observation.reassign', 'atlas.entity.merge']) test('current packaged correction ' + id + ' reaches actual persisted truth', async t => {
  const x = await correctionMainFixture(t, true), payload = await x.payloadFor(id, 'packaged-current'); await x.apply(id, payload);
});

for (const id of CORRECTION_MAIN_IDS) test('actual correction ' + id + ' revalidates capability after waiting in the project queue', async t => {
  const x = await correctionMainFixture(t); await x.control(id); const payload = await x.payloadFor(id, 'queue-refusal');
  let enter, release, settled = false; const entered = new Promise(resolve => { enter = resolve; }), gate = new Promise(resolve => { release = resolve; });
  t.after(() => release()); const held = x.h.main.__host.holdProjectQueue(async () => { enter(); await gate; }); await entered;
  const pending = x.h.command(id, payload).then(value => { settled = true; return value; }); await new Promise(setImmediate); assert.equal(settled, false);
  x.h.main.__host.denyCapability(productRegistry.getProductCommandRecord(id).capabilityId); const before = authorIdentitySnapshot(x); release(); await held;
  const result = await pending; t.diagnostic(JSON.stringify({ causalReach: 'CORRECTION_QUEUE_REVOKE', id, result }));
  try { assert.equal(result.ok, false); assert.notEqual(result.reason, 'WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED'); }
  finally { assertCorrectionPersistence(x, before, authorIdentitySnapshot(x), id, payload, false); }
});

for (const id of CORRECTION_MAIN_IDS) for (const fault of ['capability', 'owner', 'session', 'lifecycle', 'generation', 'root', 'manifest-cas', 'binding-manifest'])
  test('actual correction ' + id + ' refuses prepared ' + fault + ' drift after a lawful control', async t => {
    let armed = () => {}; const x = await correctionMainFixture(t, false, h => h.main.__host.afterTruth(() => armed())); await x.control(id);
    const payload = await x.payloadFor(id, 'prepared-refusal'); let reached = false, expected;
    const mutate = () => {
      reached = true;
      if (fault === 'capability') x.h.main.__host.denyCapability(productRegistry.getProductCommandRecord(id).capabilityId);
      if (fault === 'owner') x.h.main.__host.revokeOwner(); if (fault === 'session') x.h.main.__host.invalidateSession();
      if (fault === 'lifecycle') x.h.main.__host.invalidateLifecycle(); if (fault === 'generation') x.h.main.__host.invalidateGeneration();
      if (fault === 'root') x.h.main.__host.invalidateProjectRoot();
      if (fault.includes('manifest')) { const manifest = JSON.parse(fs.readFileSync(x.f.manifestPath)); manifest.concurrentCorrection = 'preserve é 🧭'; manifest.lastCommandId += 13; fs.writeFileSync(x.f.manifestPath, JSON.stringify(manifest)); }
      expected = reattachmentWholeFixtureRoster(x.h);
    };
    if (fault === 'binding-manifest') x.h.main.__host.afterCoreBinding(mutate); else armed = mutate;
    const result = await x.h.command(id, payload); t.diagnostic(JSON.stringify({ causalReach: 'CORRECTION_AFTER_PREPARATION', id, fault, reached, result }));
    try { assert.equal(reached, true); assert.equal(result.ok, false); assert.notEqual(result.reason, 'WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED'); }
    finally { assert.deepEqual(reattachmentWholeFixtureRoster(x.h), expected); x.assertOriginal(); }
  });

for (const id of CORRECTION_MAIN_IDS) for (const projectId of [17, []]) test('actual correction ' + id + ' refuses raw project identity ' + JSON.stringify(projectId), async t => {
  const x = await correctionMainFixture(t); await x.control(id); const payload = await x.payloadFor(id, 'raw-project'), before = authorIdentitySnapshot(x);
  const result = await x.h.command(id, { ...payload, projectId, profileId: CORRECTION_V10, tier: 'pro', capabilities: { [id]: true } });
  t.diagnostic(JSON.stringify({ causalReach: 'CORRECTION_RAW_PROJECT_ID', id, projectId, result }));
  try { assert.equal(result.ok, false); assert.match(JSON.stringify(result), /E_PRODUCT_COMMAND_PAYLOAD_INVALID|E_CORE_PROJECT_ID_REQUIRED/u); }
  finally { assertCorrectionPersistence(x, before, authorIdentitySnapshot(x), id, payload, false); }
});

test('actual prepared reassign refuses a late saved scene edit and preserves the concurrent bytes', async t => {
  let armed = () => {}; const x = await correctionMainFixture(t, false, h => h.main.__host.afterTruth(() => armed()));
  await x.control('atlas.observation.reassign'); const payload = await x.payloadFor('atlas.observation.reassign', 'late-source'); let reached = false, expected;
  armed = () => { reached = true; fs.writeFileSync(x.f.scenePath, fs.readFileSync(x.f.scenePath, 'utf8').replaceAll('Мира', 'Лира')); expected = reattachmentWholeFixtureRoster(x.h); };
  const result = await x.h.command('atlas.observation.reassign', payload); t.diagnostic(JSON.stringify({ causalReach: 'CORRECTION_LATE_REASSIGN_SOURCE', reached, result }));
  try { assert.equal(reached, true); assert.equal(result.ok, false); assert.notEqual(result.reason, 'WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED'); }
  finally { assert.deepEqual(reattachmentWholeFixtureRoster(x.h), expected); x.assertOriginal(); }
});

test('actual correction cannot persist after a real Main project switch during preparation', async t => {
  let armed = () => {}; const x = await correctionMainFixture(t, false, h => h.main.__host.afterTruth(() => armed()));
  await x.control('atlas.entity.merge'); const payload = await x.payloadFor('atlas.entity.merge', 'project-switch'); let reached = false, expected;
  armed = async () => { reached = true; assert.equal((await x.h.main.handleProjectLifecycleOpenCommand({ projectId: x.foreignProjectId })).ok, true); expected = reattachmentWholeFixtureRoster(x.h); };
  const result = await x.h.command('atlas.entity.merge', payload); t.diagnostic(JSON.stringify({ causalReach: 'CORRECTION_REAL_PROJECT_SWITCH', reached, result }));
  try { assert.equal(reached, true); assert.equal(result.ok, false); assert.notEqual(result.reason, 'WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED'); }
  finally { assert.deepEqual(reattachmentWholeFixtureRoster(x.h), expected); x.assertOriginal(); }
});

test('actual persisted merge survives reopen and is selectable through a cold production dossier [FINITE_IPC_NOT_NATIVE]', async t => {
  const x = await correctionMainFixture(t), payload = await x.payloadFor('atlas.entity.merge', 'cold-saved'); await x.apply('atlas.entity.merge', payload);
  assert.equal((await x.h.main.handleProjectLifecycleOpenCommand({ projectId: x.projectId })).ok, true);
  const beforeQuery = authorIdentitySnapshot(x), result = await x.h.query('query.atlasEntityDossier', { projectId: x.projectId, entityId: x.targetEntityId });
  assert.equal(result.ok, true); assert.deepEqual(authorIdentitySnapshot(x).roster, beforeQuery.roster);
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_COLD_SAVED_MERGE_DOSSIER', payload, result, stored: beforeQuery.manifest.atlas.entityOperations[payload.operationId] }));
  const packet = result.atlasEntityDossier.savedMergeOperations; assert.ok(packet, 'actual cold dossier must return saved merge rows');
  assert.equal(packet.complete, true); assert.equal(packet.totalCount, 1); assert.equal(packet.rows[0].operationId, payload.operationId);
  assert.equal(packet.rows[0].restoreState, 'RESTORABLE');
  const renderer = authorIdentityMainRenderer(x, await x.query(), CORRECTION_V10), vm = require('node:vm'), source = read('src/renderer/editor.js');
  const walk = node => [node, ...node.children.flatMap(walk)];
  renderer.c.atlasEntityDossierHost = renderer.c.document.createElement('section'); renderer.c.document.body.append(renderer.c.atlasEntityDossierHost);
  renderer.c.atlasEntityDossierState = result.atlasEntityDossier; renderer.c.atlasSelectedEntityId = x.targetEntityId;
  renderer.c.currentAtlasSurface = 'entity';
  const names = new Set(['normalizeAtlasEntityDossier', 'renderAtlasEntityDossierState', 'appendAtlasOverviewRow', 'appendAtlasOverviewSection', 'appendAtlasOverviewMetric',
    ...[...source.matchAll(/^(?:async )?function (\w*Atlas\w*(?:Correction|SavedMerge)\w*)\(/gm)].map(match => match[1])]);
  for (const name of names) {
    let a = source.indexOf('async function ' + name + '('); if (a < 0) a = source.indexOf('function ' + name + '(');
    const b = source.indexOf('\n}\n', a); assert.ok(a >= 0 && b > a); vm.runInContext(source.slice(a, b + 2), renderer.c);
  }
  renderer.c.reviewSurfaceIsPlainObject = value => value && typeof value === 'object' && !Array.isArray(value);
  renderer.c.renderAtlasReattachmentSources = () => {}; renderer.c.renderAtlasEntityDossierState();
  const select = walk(renderer.c.atlasEntityDossierHost).find(node => Object.hasOwn(node.dataset, 'atlasSavedMergeSelect'));
  assert.ok(select, 'cold actual dossier rendering exposes one native saved merge select');
  assert.equal(select.tagName, 'SELECT'); select.value = payload.operationId; await select.emit('change');
  const before = authorIdentitySnapshot(x), response = await renderer.click('split-restore'), after = authorIdentitySnapshot(x);
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_COLD_SELECTED_SPLIT_RESTORE', response, before, after }));
  assertTemporalMainReceipt(response.mainResult, 'atlas.entity.splitRestore');
  assert.equal(response.request.payload.operationId, payload.operationId);
  assertCorrectionPersistence(x, before, after, 'atlas.entity.splitRestore', response.request.payload, true);
});

function correctionMainRenderer(x, projection) {
  const renderer = authorIdentityMainRenderer(x, projection, CORRECTION_V10), source = read('src/renderer/editor.js'), vm = require('node:vm');
  for (const match of source.matchAll(/^(?:async )?function (\w*Atlas\w*(?:Correction|SavedMerge)\w*)\(/gm)) {
    const a = match.index, b = source.indexOf('\n}\n', a); assert.ok(b > a); vm.runInContext(source.slice(a, b + 2), renderer.c);
  }
  return renderer;
}

for (const cold of [false, true]) test('actual distinct reassignment intents retain both records ' + (cold ? 'after cold renderer reopen' : 'while warm'), async t => {
  const x = await correctionMainFixture(t); let renderer = correctionMainRenderer(x, await x.query());
  for (const [i, offset] of [25, 68].entries()) {
    if (i && cold) { assert.equal((await x.h.main.handleProjectLifecycleOpenCommand({ projectId: x.projectId })).ok, true); renderer = correctionMainRenderer(x, await x.query()); }
    await renderer.target(x.entityId, offset); await renderer.field('targetEntityId', x.targetEntityId);
    const before = authorIdentitySnapshot(x), response = await renderer.click('reassign-observation'), after = authorIdentitySnapshot(x);
    t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_WARM_COLD_REASSIGN_IDENTITY', cold, offset, response, before, after }));
    assertCorrectionPersistence(x, before, after, 'atlas.observation.reassign', response.request.payload, response.mainResult.ok === true);
    await t.test('actual receipt and opaque identity for occurrence ' + offset, () => {
      assertTemporalMainReceipt(response.mainResult, 'atlas.observation.reassign');
      assert.match(response.request.payload.reassignmentId, /^atlas-reassign-[a-f0-9-]{36}$/u);
    });
  }
  assert.equal(Object.keys(authorIdentitySnapshot(x).manifest.atlas.reassignments).length, 2);
});

test('actual merge restore then cold merge preserves the prior saved operation under a new intent ID', async t => {
  const x = await correctionMainFixture(t); let firstId = '';
  for (let i = 0; i < 2; i++) {
    const renderer = correctionMainRenderer(x, await x.query()); await renderer.target(x.entityId, 25); await renderer.field('targetEntityId', x.targetEntityId);
    const before = authorIdentitySnapshot(x), response = await renderer.click('merge-entities'), after = authorIdentitySnapshot(x);
    t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_REPEATED_COLD_MERGE_IDENTITY', i, response, before, after }));
    assertCorrectionPersistence(x, before, after, 'atlas.entity.merge', response.request.payload, response.mainResult.ok === true);
    const id = response.request.payload.operationId, priorId = firstId; firstId = id;
    await t.test('actual merge receipt and opaque identity ' + i, () => {
      assertTemporalMainReceipt(response.mainResult, 'atlas.entity.merge');
      assert.match(id, /^atlas-merge-[a-f0-9-]{36}$/u); assert.notEqual(id, priorId);
    });
    if (response.mainResult.ok === true) await x.apply('atlas.entity.splitRestore', {
      projectId: x.projectId, operationId: id, restoreOperationId: 'owned-between-merges-' + i });
    assert.equal((await x.h.main.handleProjectLifecycleOpenCommand({ projectId: x.projectId })).ok, true);
  }
  assert.equal(Object.keys(authorIdentitySnapshot(x).manifest.atlas.entityOperations).length, 2);
});

test('actual Main keeps restored foreign and stale merge refusals with immediate complete no-write', async t => {
  for (const kind of ['restored', 'foreign', 'stale']) await t.test(kind, async t => {
    const x = await correctionMainFixture(t), payload = await x.payloadFor('atlas.entity.splitRestore', 'refusal-' + kind);
    if (kind === 'restored') await x.apply('atlas.entity.splitRestore', payload);
    if (kind === 'stale') {
      const before = authorIdentitySnapshot(x), alias = { projectId: x.projectId, entityId: x.targetEntityId,
        aliasId: 'later-author-alias', value: 'Later preserved correction', scope: 'project', sceneId: '' };
      const response = await x.ui('atlas.alias.add', alias), after = authorIdentitySnapshot(x); assertTemporalMainReceipt(response.mainResult, 'atlas.alias.add');
      assertAuthorIdentityPreservation(x, before, after, 'atlas.alias.add', alias, true, x.identityKey);
    }
    const before = authorIdentitySnapshot(x), result = await x.h.command('atlas.entity.splitRestore', {
      ...payload, ...(kind === 'foreign' ? { operationId: 'foreign-operation' } : {}), restoreOperationId: 'must-not-write' });
    t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_SAVED_MERGE_REFUSAL', kind, result }));
    try { assert.equal(result.ok, false); assert.match(JSON.stringify(result), new RegExp({ restored: 'E_ATLAS_OPERATION_ALREADY_RESTORED', foreign: 'E_ATLAS_OPERATION_NOT_FOUND', stale: 'E_ATLAS_OPERATION_STALE' }[kind], 'u')); }
    finally { assertCorrectionPersistence(x, before, authorIdentitySnapshot(x), 'atlas.entity.splitRestore', payload, false); }
  });
});

function flowRefreshControls(renderer) {
  const walk = node => [node, ...node.children.flatMap(walk)];
  return Object.fromEntries(['sourceEntityId', 'targetEntityId', 'mentionId'].map(name => {
    const node = walk(renderer.c.atlasJourneyHost).find(value => value.dataset.atlasJourneyField === name);
    assert.ok(node, name); assert.equal(node.tagName, 'SELECT');
    return [name, { value: node.value, options: node.children.filter(value => value.tagName === 'OPTION').map(value => value.value) }];
  }));
}

function assertFlowRefreshApplied(x, before, after, response, id) {
  const receipt = assertTemporalMainReceipt(response.mainResult, id); assert.deepEqual(after.receipts.at(-1), receipt);
  assert.equal(response.result.ok, true); assert.equal(response.result.value.performed, true);
  assert.equal(response.result.value.commandAuthority, 'CommandKernel'); assert.equal(response.result.value.commandId, id);
  assert.deepEqual(response.result.value.result, response.mainResult.value);
  assertCorrectionPersistence(x, before, after, id, response.request.payload, true);
}

async function assertFlowRefreshPublished(t, renderer, fresh) {
  const visible = flowRefreshControls(renderer), ids = fresh.entities.map(row => row.entityId);
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_MAIN_FRESH_QUERY_VS_FLOW', fresh, cached: renderer.c.atlasCurrentSceneState, visible }));
  assert.deepEqual(renderer.c.atlasCurrentSceneState.entities, fresh.entities);
  assert.deepEqual(renderer.c.atlasCurrentSceneState.mentions, fresh.mentions);
  const draftSource = require('node:vm').runInContext('atlasJourneyDraft.sourceEntityId', renderer.c);
  const source = ids.includes(draftSource) ? draftSource : ids[0] || '';
  await t.test('visible source choices use refreshed entities', () => assert.deepEqual(visible.sourceEntityId.options, ['', ...ids]));
  await t.test('visible target choices use refreshed entities', () => assert.deepEqual(visible.targetEntityId.options, ['', ...ids.filter(id => id !== source)]));
  await t.test('visible exact mentions use refreshed identities', () => assert.deepEqual(visible.mentionId.options, ['', ...fresh.mentions.map(row => row.mentionId)]));
}

async function flowRefreshColdRenderer(x, operationId) {
  const before = authorIdentitySnapshot(x), dossier = await x.h.query('query.atlasEntityDossier', { projectId: x.projectId, entityId: x.targetEntityId });
  assert.equal(dossier.ok, true); assert.deepEqual(authorIdentitySnapshot(x).roster, before.roster);
  assert.equal(dossier.atlasEntityDossier.savedMergeOperations.rows[0].operationId, operationId);
  assert.equal(dossier.atlasEntityDossier.savedMergeOperations.rows[0].restoreState, 'RESTORABLE');
  const renderer = correctionMainRenderer(x, await x.query()), c = renderer.c, source = read('src/renderer/editor.js'), vm = require('node:vm');
  const start = source.indexOf('const ATLAS_SURFACE_IDS = Object.freeze(['), end = source.indexOf('const ATLAS_DEFERRED_SURFACE_IDS =', start);
  assert.ok(start >= 0 && end > start); vm.runInContext(source.slice(start, source.indexOf('\n', end)), c);
  for (const name of ['reviewSurfaceIsPlainObject', 'normalizeAtlasEntityDossier', 'renderAtlasEntityDossierState', 'appendAtlasOverviewRow',
    'appendAtlasOverviewSection', 'appendAtlasOverviewMetric', 'normalizeAtlasSurface', 'setCurrentAtlasSurface',
    'syncAtlasSurfaceCompositionState', 'syncAtlasReachabilityOpenerState', 'isAtlasSupportedViewportWidth']) {
    const a = source.indexOf('function ' + name + '('), b = source.indexOf('\n}\n', a); assert.ok(a >= 0 && b > a); vm.runInContext(source.slice(a, b + 2), c);
  }
  Object.assign(c, { atlasEntityDossierHost: c.document.createElement('section'), atlasEntityDossierState: dossier.atlasEntityDossier,
    atlasSelectedEntityId: x.targetEntityId, rightAtlasPanel: c.document.createElement('aside'), atlasSurfaceButtons: [], atlasSurfaceShells: [],
    ATLAS_SURFACE_PROVIDER_BY_ID: { entity: 'query.atlasEntityDossier', journey: 'query.atlasCurrentScene' },
    atlasReachabilityOpener: null, atlasReachabilityCaption: null, rightRailOverlayOpen: false,
    getSpatialLayoutViewportWidth: () => 1280, getSpatialLayoutConstraintsForViewport: () => ({ rightRailMode: 'docked' }), renderAtlasReattachmentSources() {} });
  for (const [surface, host] of [['entity', c.atlasEntityDossierHost], ['journey', c.atlasJourneyHost]]) {
    const shell = c.document.createElement('section'); shell.dataset.atlasSurfaceShell = surface; shell.append(host); c.atlasSurfaceShells.push(shell); c.rightAtlasPanel.append(shell);
  }
  c.document.body.append(c.rightAtlasPanel); c.setCurrentAtlasSurface('entity', { refresh: false }); c.renderAtlasEntityDossierState();
  const walk = node => [node, ...node.children.flatMap(walk)], select = walk(c.atlasEntityDossierHost).find(node => Object.hasOwn(node.dataset, 'atlasSavedMergeSelect'));
  assert.ok(select); assert.equal(select.tagName, 'SELECT'); select.value = operationId; await select.emit('change');
  c.setCurrentAtlasSurface('journey', { refresh: false }); assert.equal(c.atlasJourneyHost.parentElement.hidden, false);
  assert.equal(vm.runInContext('atlasJourneyDraft.savedMergeOperation.operationId', c), operationId); return renderer;
}

test('actual current V10 merge publishes refreshed visible Flow choices without another input or navigation', async t => {
  const x = await correctionMainFixture(t, true), renderer = correctionMainRenderer(x, await x.query());
  await renderer.target(x.entityId, 25); await renderer.field('targetEntityId', x.targetEntityId);
  const before = authorIdentitySnapshot(x), response = await renderer.click('merge-entities'), after = authorIdentitySnapshot(x);
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_MAIN_MERGE_FLOW_REFRESH', response, before, after }));
  assertFlowRefreshApplied(x, before, after, response, 'atlas.entity.merge');
  const fresh = await x.query(); assert.deepEqual(fresh.entities.map(row => row.entityId), [x.targetEntityId]);
  assert.deepEqual(authorIdentitySnapshot(x).roster, after.roster); await assertFlowRefreshPublished(t, renderer, fresh);
});

test('actual cold selected merge restore publishes refreshed visible Flow without another input or navigation', async t => {
  const x = await correctionMainFixture(t, true), merge = await x.payloadFor('atlas.entity.merge', 'flow-cold'); await x.apply('atlas.entity.merge', merge);
  assert.equal((await x.h.main.handleProjectLifecycleOpenCommand({ projectId: x.projectId })).ok, true);
  const renderer = await flowRefreshColdRenderer(x, merge.operationId);
  const before = authorIdentitySnapshot(x), response = await renderer.click('split-restore'), after = authorIdentitySnapshot(x);
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_MAIN_COLD_RESTORE_FLOW_REFRESH', response, before, after }));
  assertFlowRefreshApplied(x, before, after, response, 'atlas.entity.splitRestore'); assert.equal(response.request.payload.operationId, merge.operationId);
  const fresh = await x.query(); assert.deepEqual([...fresh.entities.map(row => row.entityId)].sort(), [x.entityId, x.targetEntityId].sort());
  assert.deepEqual(authorIdentitySnapshot(x).roster, after.roster); await assertFlowRefreshPublished(t, renderer, fresh);
});

for (const fault of ['project', 'surface', 'author-draft', 'generation']) test('actual delayed correction scene read cannot rebuild newer ' + fault + ' Flow', async t => {
  const x = await correctionMainFixture(t, true), renderer = correctionMainRenderer(x, await x.query()), c = renderer.c;
  await renderer.target(x.entityId, 25); await renderer.field('targetEntityId', x.targetEntityId);
  let enter, release, actual; const entered = new Promise(resolve => { enter = resolve; }), gate = new Promise(resolve => { release = resolve; }); t.after(() => release());
  c.refreshAtlasCurrentScene = async options => { actual = await x.query(); enter(); await gate; if (!options.isCurrent || options.isCurrent()) c.atlasCurrentSceneState = structuredClone(actual); };
  const before = authorIdentitySnapshot(x), pending = renderer.click('merge-entities');
  await Promise.race([entered, pending.then(result => assert.fail('successful actual command must reach the delayed scene read: ' + JSON.stringify(result)))]);
  const after = authorIdentitySnapshot(x), response = renderer.packets.at(-1); assertFlowRefreshApplied(x, before, after, response, 'atlas.entity.merge');
  assert.deepEqual(actual.entities.map(row => row.entityId), [x.targetEntityId]);
  if (fault === 'project') { assert.equal((await x.h.main.handleProjectLifecycleOpenCommand({ projectId: x.foreignProjectId })).ok, true); c.currentProjectId = x.foreignProjectId; }
  if (fault === 'surface') c.currentAtlasSurface = 'reports';
  if (fault === 'author-draft') await renderer.field('aliasValue', 'New author draft é 🧭');
  if (fault === 'generation') { c.localEditGeneration += 1; c.localDirty = true; }
  c.renderAtlasJourneyState(); const header = c.atlasJourneyHost.children[0], visible = flowRefreshControls(renderer);
  const draft = require('node:vm').runInContext('JSON.stringify(atlasJourneyDraft)', c), cached = JSON.stringify(c.atlasCurrentSceneState), roster = reattachmentWholeFixtureRoster(x.h);
  release(); assert.equal(await pending, response);
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_MAIN_DELAYED_FLOW_REFRESH_REFUSED', fault, response, actual, visibleAfter: flowRefreshControls(renderer) }));
  assert.equal(c.atlasJourneyHost.children[0], header); assert.deepEqual(flowRefreshControls(renderer), visible);
  assert.equal(require('node:vm').runInContext('JSON.stringify(atlasJourneyDraft)', c), draft); assert.equal(JSON.stringify(c.atlasCurrentSceneState), cached);
  assert.deepEqual(reattachmentWholeFixtureRoster(x.h), roster); assert.equal(renderer.packets.length, 1); x.assertOriginal();
});


const IDEA_MEANING_V11 = 'WRITER_LOCAL_IDEA_MEANING_AUTHORING_V11';
const IDEA_MEANING_MAIN_IDS = ['idea.create', 'idea.originLink.add', 'meaning.promote'];

function assertIdeaMeaningPersistence(x, before, after, commandId, payload, applied) {
  assertAuthorIdentityCanonical(after.events.slice(0, before.events.length), before.events);
  assertAuthorIdentityCanonical(after.receipts.slice(0, before.receipts.length), before.receipts);
  assert.deepEqual(after.scene, before.scene); x.assertOriginal();
  if (!applied) { assert.deepEqual(after.roster, before.roster); assertAuthorIdentityCanonical(after.manifest, before.manifest); return; }
  const seq = before.manifest.lastCommandId + 1, expected = structuredClone(before.manifest); expected.lastCommandId = seq;
  if (commandId.startsWith('idea.')) {
    const domain = expected.ideas || { schemaVersion: 'idea.author.v1', ideas: {}, originLinks: {} }; expected.ideas = domain;
    if (commandId === 'idea.create') {
      assert.equal(Object.hasOwn(domain.ideas, payload.ideaId), false);
      domain.ideas[payload.ideaId] = { id: payload.ideaId, title: payload.title.trim(), summary: (payload.summary || '').trim(),
        originLinkIds: [], createdByCommandSeq: seq, updatedByCommandSeq: seq };
    } else {
      const originRef = { schemaVersion: 'idea.originRef.v1', kind: 'sceneTextRange', ...payload.originRef, targetId: payload.originRef.targetId || '' };
      const linkId = payload.linkId || 'idea-origin-link:' + x.hash({ projectId: x.projectId, ideaId: payload.ideaId, originRef });
      assert.equal(Object.hasOwn(domain.originLinks, linkId), false); assert.ok(domain.ideas[payload.ideaId]);
      domain.originLinks[linkId] = { id: linkId, ideaId: payload.ideaId, originRef, createdByCommandSeq: seq };
      domain.ideas[payload.ideaId].originLinkIds.push(linkId); domain.ideas[payload.ideaId].updatedByCommandSeq = seq;
    }
  } else {
    assert.equal(commandId, 'meaning.promote'); expected.meanings ||= { schemaVersion: 'meaning.author.v1', meanings: {} };
    assert.equal(Object.hasOwn(expected.meanings.meanings, payload.meaningId), false);
    expected.meanings.meanings[payload.meaningId] = { id: payload.meaningId, title: payload.title.trim(), interpretation: payload.interpretation.trim(),
      source: payload.source.kind === 'idea' ? { kind: 'idea', ideaId: payload.source.ideaId || payload.source.sourceId }
        : { kind: 'sceneOriginRef', originRef: { schemaVersion: 'idea.originRef.v1', kind: 'sceneTextRange', ...payload.source.originRef, targetId: payload.source.originRef.targetId || '' } },
      promotionKind: 'explicitAuthorPromotion', createdByCommandSeq: seq, updatedByCommandSeq: seq };
  }
  assertAuthorIdentityCanonical(after.manifest, expected);
  assert.equal(after.events.length, before.events.length + 1); assert.equal(after.receipts.length, before.receipts.length + 1);
  assert.equal(after.events.at(-1).commandId, commandId); assert.equal(after.receipts.at(-1).commandId, commandId);
  assert.equal(after.events.at(-1).domainEventDigest, after.receipts.at(-1).domainEventDigest);
  const projectPrefix = path.relative(x.h.root, x.f.projectRoot) + path.sep;
  const anchorPrefix = path.join('userData', 'stage10-integrity-anchors', x.identityKey) + path.sep;
  const digest = value => crypto.createHash('sha256').update(value).digest('hex');
  const previousHash = digest(before.manifestRaw), nextHash = digest(after.manifestRaw);
  const base = path.join('userData', 'stage10-integrity-anchors', 'manifest-transitions');
  const transitionRoot = path.join(base, digest(x.projectId + '\0' + x.f.manifestPath)), transitionDir = path.join(transitionRoot, previousHash);
  const transitionFile = path.join(transitionDir, nextHash + '.json');
  const transition = JSON.stringify({ schemaVersion: 'yalken.manifest-transition.v1', projectId: x.projectId,
    targetPath: x.f.manifestPath, previousHash, nextHash });
  assert.equal(fs.readFileSync(path.join(x.h.root, transitionFile), 'utf8'), transition);
  const oldRoster = new Map(before.roster), newRoster = new Map(after.roster), added = new Set([transitionFile]);
  assert.equal(oldRoster.has(transitionFile), false); assert.equal(newRoster.get(transitionFile), digest(transition));
  for (const name of [base, transitionRoot, transitionDir]) { assert.equal(newRoster.get(name), 'directory'); if (!oldRoster.has(name)) added.add(name); }
  const mutable = new Set([projectPrefix + 'project.craftsman.json',
    ...['product-session.v2.json', 'command-receipt-authority-store.v2.json', path.join('recovery', 'project-truth.latest.v1.json')]
      .map(name => projectPrefix + path.join('.stage10-local', name)),
    ...['integrity-anchor.v1.json', 'integrity-anchor.recovery.v1.json', 'fencing-generation.v1.json'].map(name => anchorPrefix + name)]);
  const fixed = rows => rows.filter(([name]) => !mutable.has(name) && !added.has(name));
  assert.deepEqual(fixed(after.roster), fixed(before.roster), 'complete foreign state manuscript and prior transition records stay exact');
  const previousAnchor = before.anchors[anchorPrefix + 'integrity-anchor.v1.json'], head = after.authorityStore.currentHead;
  assertAuthorIdentityCanonical(after.anchors[anchorPrefix + 'integrity-anchor.recovery.v1.json'], previousAnchor);
  const anchorCore = { schemaVersion: 'yalken.stage10.mainIntegrityAnchor.v1', anchorVersion: 1, projectId: x.projectId,
    authorityGeneration: head.authorityGeneration, receiptCount: head.receiptCount, receiptRootDigest: head.receiptRootDigest,
    eventLogDigest: head.eventLogDigest, authorityHeadDigest: head.authorityHeadDigest, authorityStoreDigest: x.hash(after.authorityStore),
    sessionDigest: x.hash(after.session), previousIntegrityAnchorDigest: previousAnchor.integrityAnchorDigest };
  assert.equal(anchorCore.authorityGeneration, previousAnchor.authorityGeneration + 1);
  assertAuthorIdentityCanonical(after.anchors[anchorPrefix + 'integrity-anchor.v1.json'], { ...anchorCore, integrityAnchorDigest: x.hash(anchorCore) });
  const fence = after.anchors[anchorPrefix + 'fencing-generation.v1.json'], oldFence = before.anchors[anchorPrefix + 'fencing-generation.v1.json'];
  assert.match(fence.ownerTokenDigest, /^[a-f0-9]{64}$/u); assert.notEqual(fence.ownerTokenDigest, oldFence.ownerTokenDigest);
  assert.ok(fence.issuedAtMs >= before.observedAtMs && fence.issuedAtMs <= after.observedAtMs);
  assert.ok(Number.isSafeInteger(fence.monotonicIssuedAtMs) && fence.monotonicIssuedAtMs >= oldFence.monotonicIssuedAtMs);
  assertAuthorIdentityCanonical(fence, { ...oldFence, fencingGeneration: oldFence.fencingGeneration + 1,
    ownerTokenDigest: fence.ownerTokenDigest, issuedAtMs: fence.issuedAtMs, monotonicIssuedAtMs: fence.monotonicIssuedAtMs });
  const recovery = JSON.parse(fs.readFileSync(path.join(x.f.projectRoot, '.stage10-local', 'recovery', 'project-truth.latest.v1.json')));
  assertAuthorIdentityCanonical(recovery, { schemaVersion: 'yalken.stage10.projectTruthRecovery.v1', projectId: x.projectId,
    reason: commandId, previousIntegrityAnchorDigest: previousAnchor.integrityAnchorDigest, previousHash, intendedNextHash: nextHash, previousText: before.manifestRaw });
}

async function ideaMeaningMainFixture(t, packaged = false, beforeProject) {
  const x = await reattachmentMainFixture(t, packaged, beforeProject);
  const foreign = await x.h.main.handleProjectLifecycleCreateCommand({ projectName: 'Foreign Idea Meaning project' }); assert.equal(foreign.ok, true);
  assert.equal((await x.h.main.handleProjectLifecycleOpenCommand({ projectId: x.projectId })).ok, true); x.foreignProjectId = foreign.projectId;
  const identity = (await import('../../src/product/stage10ProjectIdentityKey.mjs')).stage10ProjectPathIdentity(x.projectId);
  assert.equal(identity.ok, true); x.identityKey = identity.canonicalKey; x.ideaId = 'saved-explicit-idea';
  x.origin = async () => {
    const current = await x.query(), mention = current.mentions.find(row => row.startOffset === 68); assert.ok(mention);
    return { schemaVersion: 'idea.originRef.v1', kind: 'sceneTextRange', sceneId: x.sceneId,
      startOffset: mention.startOffset, endOffset: mention.endOffset, sourceHash: current.summary.sceneTextHash, targetId: x.ideaId };
  };
  x.payloadFor = async (id, tag) => id === 'idea.create' ? { projectId: x.projectId, ideaId: 'idea-' + tag,
    title: 'Explicit idea é 🧭 ' + tag, summary: 'Saved author summary ' + tag }
    : id === 'idea.originLink.add' ? { projectId: x.projectId, ideaId: x.ideaId, linkId: 'origin-' + tag, originRef: await x.origin() }
    : { projectId: x.projectId, meaningId: 'meaning-' + tag, title: 'Explicit meaning é 🧭 ' + tag,
      interpretation: 'Chosen interpretation ' + tag, source: { kind: 'idea', ideaId: x.ideaId } };
  x.apply = async (id, payload) => {
    const before = authorIdentitySnapshot(x), response = await x.ui(id, payload), after = authorIdentitySnapshot(x);
    t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_IDEA_MEANING_PERSISTENCE', id, response, beforeManifest: before.manifest, afterManifest: after.manifest,
      beforeEvents: before.events.length, afterEvents: after.events.length, beforeRoster: before.roster, afterRoster: after.roster }));
    assertIdeaMeaningPersistence(x, before, after, id, payload, response.mainResult.ok === true);
    const receipt = assertTemporalMainReceipt(response.mainResult, id); assert.deepEqual(after.receipts.at(-1), receipt);
    assert.equal(response.result.ok, true); assert.equal(response.result.value.performed, true);
    assert.equal(response.result.value.commandAuthority, 'CommandKernel'); assert.equal(response.result.value.commandId, id);
    assert.deepEqual(response.result.value.result, response.mainResult.value); return { before, after, response };
  };
  x.control = async () => {
    await x.apply('idea.create', { ...(await x.payloadFor('idea.create', 'control')), ideaId: x.ideaId });
    await x.apply('idea.originLink.add', await x.payloadFor('idea.originLink.add', 'control'));
    await x.apply('meaning.promote', await x.payloadFor('meaning.promote', 'control'));
  };
  return x;
}

test('historical V11 constructor selection preserves strict V11 and exact thirty-two commands with twelve read-only queries', async t => {
  const h = await fullMacMainFixture(t, { historicalV11Constructor: true }), active = h.main.__profile();
  assert.equal(active.profileId, IDEA_MEANING_V11); assert.equal(active.schemaVersion, 'writer-local-profile.v11');
  assert.deepEqual(active.admittedCommandIds, [...profile.createWriterAtlasEntityCorrectionsProfileProjection({ isPackaged: true, platform: 'darwin' }).admittedCommandIds, ...IDEA_MEANING_MAIN_IDS]);
  assert.equal(active.admittedCommandIds.length, 32); assert.deepEqual(active.admittedQueryIds, READ_SURFACE_QUERY_IDS);
  assert.equal(new URL(h.shellUrl).searchParams.get('PRODUCT_PROFILE'), IDEA_MEANING_V11);
  for (const key of ['optionalSystemsEnabled', 'signing', 'notarization', 'publicDistribution', 'dependencyAdoption', 'cloudAuthority', 'userDataMutation']) assert.equal(active[key], false);
});

for (const packaged of [false, true]) test('actual ' + (packaged ? 'packaged' : 'unpackaged lawful control') + ' Main persists connected Idea origin Meaning chain without manuscript changes', async t => {
  const x = await ideaMeaningMainFixture(t, packaged), initial = authorIdentitySnapshot(x); await x.control();
  const saved = authorIdentitySnapshot(x); assert.deepEqual(saved.scene, initial.scene); assert.equal(saved.events.length, initial.events.length + 3);
  assert.equal(saved.manifest.ideas.originLinks['origin-control'].ideaId, x.ideaId);
  assert.deepEqual(saved.manifest.meanings.meanings['meaning-control'].source, { kind: 'idea', ideaId: x.ideaId });
});

for (const id of IDEA_MEANING_MAIN_IDS) test('actual ' + id + ' refuses capability revoked while queued after a lawful full chain', async t => {
  const x = await ideaMeaningMainFixture(t); await x.control(); const payload = await x.payloadFor(id, 'queued');
  let entered, release, settled = false; const ready = new Promise(r => { entered = r; }), gate = new Promise(r => { release = r; }); t.after(() => release());
  const held = x.h.main.__host.holdProjectQueue(async () => { entered(); await gate; }); await ready;
  const pending = x.h.command(id, payload).then(result => { settled = true; return result; }); await new Promise(setImmediate); assert.equal(settled, false);
  x.h.main.__host.denyCapability(productRegistry.getProductCommandRecord(id).capabilityId); const before = authorIdentitySnapshot(x); release(); await held;
  const result = await pending; t.diagnostic(JSON.stringify({ causalReach: 'IDEA_MEANING_QUEUE_REVOKE', id, result }));
  try { assert.equal(result.ok, false); assert.notEqual(result.reason, 'WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED'); }
  finally { assertIdeaMeaningPersistence(x, before, authorIdentitySnapshot(x), id, payload, false); }
});

for (const id of IDEA_MEANING_MAIN_IDS) for (const fault of ['capability', 'owner', 'session', 'lifecycle', 'generation', 'root', 'manifest-cas', 'binding-manifest'])
  test('actual ' + id + ' refuses prepared ' + fault + ' drift independently of the packaged profile', async t => {
    let armed = () => {}; const x = await ideaMeaningMainFixture(t, false, h => h.main.__host.afterTruth(() => armed())); await x.control();
    const payload = await x.payloadFor(id, 'prepared'); let reached = false, expected;
    const mutate = () => {
      reached = true;
      if (fault === 'capability') x.h.main.__host.denyCapability(productRegistry.getProductCommandRecord(id).capabilityId);
      if (fault === 'owner') x.h.main.__host.revokeOwner(); if (fault === 'session') x.h.main.__host.invalidateSession();
      if (fault === 'lifecycle') x.h.main.__host.invalidateLifecycle(); if (fault === 'generation') x.h.main.__host.invalidateGeneration();
      if (fault === 'root') x.h.main.__host.invalidateProjectRoot();
      if (fault.includes('manifest')) { const raw = JSON.parse(fs.readFileSync(x.f.manifestPath)); raw.concurrentIdeaMeaning = 'preserve é 🧭'; raw.lastCommandId += 13; fs.writeFileSync(x.f.manifestPath, JSON.stringify(raw)); }
      expected = reattachmentWholeFixtureRoster(x.h);
    };
    if (fault === 'binding-manifest') x.h.main.__host.afterCoreBinding(mutate); else armed = mutate;
    const result = await x.h.command(id, payload); t.diagnostic(JSON.stringify({ causalReach: 'IDEA_MEANING_AFTER_PREPARATION', id, fault, reached, result }));
    try { assert.equal(reached, true); assert.equal(result.ok, false); assert.notEqual(result.reason, 'WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED'); }
    finally { assert.deepEqual(reattachmentWholeFixtureRoster(x.h), expected); x.assertOriginal(); }
  });

for (const id of IDEA_MEANING_MAIN_IDS) test('actual ' + id + ' validates raw project identity before application stamping', async t => {
  const x = await ideaMeaningMainFixture(t); await x.control();
  for (const projectId of [17, [], 'x'.repeat(4097)]) await t.test('raw project ' + JSON.stringify(projectId).slice(0, 50), async () => {
    const payload = { ...(await x.payloadFor(id, 'raw-project-' + typeof projectId)), projectId }, before = authorIdentitySnapshot(x);
    const result = await x.h.command(id, { ...payload, profileId: IDEA_MEANING_V11, tier: 'pro', capabilities: { [id]: true } });
    t.diagnostic(JSON.stringify({ causalReach: 'IDEA_MEANING_RAW_PROJECT', id, projectId, result }));
    try { assert.equal(result.ok, false); assert.match(JSON.stringify(result), /E_PRODUCT_COMMAND_PAYLOAD_INVALID/u); }
    finally { assertIdeaMeaningPersistence(x, before, authorIdentitySnapshot(x), id, payload, false); }
  });
});

for (const id of ['idea.originLink.add', 'meaning.promote']) test('actual ' + id + ' rejects raw origin coercion and unsupported identities before Core normalization', async t => {
  const x = await ideaMeaningMainFixture(t); await x.control();
  for (const [index, patch] of [{ startOffset: '68' }, { startOffset: -1 }, { endOffset: '72' }, { schemaVersion: 'idea.originRef.v1.extra' },
    { kind: 'automaticInference' }, { sceneId: 17 }, { sourceHash: 'x'.repeat(64) }].entries()) await t.test(JSON.stringify(patch), async () => {
    const base = await x.payloadFor(id, 'raw-origin-' + index), originRef = { ...(await x.origin()), ...patch };
    const payload = id === 'idea.originLink.add' ? { ...base, originRef } : { ...base, source: { kind: 'sceneOriginRef', originRef } };
    const before = authorIdentitySnapshot(x), result = await x.h.command(id, payload);
    t.diagnostic(JSON.stringify({ causalReach: 'IDEA_MEANING_RAW_ORIGIN', id, patch, result }));
    try { assert.equal(result.ok, false); assert.match(JSON.stringify(result), /E_PRODUCT_COMMAND_PAYLOAD_INVALID/u); }
    finally { assertIdeaMeaningPersistence(x, before, authorIdentitySnapshot(x), id, payload, false); }
  });
});

for (const id of ['idea.originLink.add', 'meaning.promote']) test('actual ' + id + ' rejects late saved scene source change after preparation', async t => {
  let armed = () => {}; const x = await ideaMeaningMainFixture(t, false, h => h.main.__host.afterTruth(() => armed())); await x.control();
  const base = await x.payloadFor(id, 'late-origin'), payload = id === 'idea.originLink.add' ? base : { ...base, source: { kind: 'sceneOriginRef', originRef: await x.origin() } };
  let reached = false, expected; armed = () => { reached = true; fs.writeFileSync(x.f.scenePath, fs.readFileSync(x.f.scenePath, 'utf8').replaceAll('Мира', 'Лира')); expected = reattachmentWholeFixtureRoster(x.h); };
  const result = await x.h.command(id, payload); t.diagnostic(JSON.stringify({ causalReach: 'IDEA_MEANING_LATE_SOURCE', id, reached, result }));
  try { assert.equal(reached, true); assert.equal(result.ok, false); assert.notEqual(result.reason, 'WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED'); }
  finally { assert.deepEqual(reattachmentWholeFixtureRoster(x.h), expected); x.assertOriginal(); }
});

for (const id of IDEA_MEANING_MAIN_IDS) test('actual ' + id + ' cannot persist after a real Main project switch during preparation', async t => {
  let armed = () => {}; const x = await ideaMeaningMainFixture(t, false, h => h.main.__host.afterTruth(() => armed())); await x.control();
  const payload = await x.payloadFor(id, 'project-switch'); let reached = false, expected;
  armed = async () => { reached = true; assert.equal((await x.h.main.handleProjectLifecycleOpenCommand({ projectId: x.foreignProjectId })).ok, true); expected = reattachmentWholeFixtureRoster(x.h); };
  const result = await x.h.command(id, payload); t.diagnostic(JSON.stringify({ causalReach: 'IDEA_MEANING_PROJECT_SWITCH', id, reached, result }));
  try { assert.equal(reached, true); assert.equal(result.ok, false); assert.notEqual(result.reason, 'WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED'); }
  finally { assert.deepEqual(reattachmentWholeFixtureRoster(x.h), expected); x.assertOriginal(); }
});

test('actual cold Main inspector retrieves exact saved Idea Meaning and origin through the existing query without writing', async t => {
  const x = await ideaMeaningMainFixture(t); await x.control(); const saved = authorIdentitySnapshot(x);
  assert.equal((await x.h.main.handleProjectLifecycleOpenCommand({ projectId: x.projectId })).ok, true);
  const before = authorIdentitySnapshot(x), result = await x.h.query('query.projectionInspector', { projectId: x.projectId,
    idea: { offset: 0, search: 'Explicit idea', selectedId: x.ideaId }, meaning: { offset: 0, search: 'Explicit meaning', selectedId: 'meaning-control' } });
  assert.deepEqual(authorIdentitySnapshot(x).roster, before.roster); assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.projectionInspector.authority.commandAuthority, 'none');
  const idea = result.projectionInspector.projectionStates.find(row => row.projectionId === 'idea'), meaning = result.projectionInspector.projectionStates.find(row => row.projectionId === 'meaning');
  assert.ok(idea.details, 'Main must forward bounded view options and saved rows'); assert.ok(meaning.details);
  assert.equal(idea.details.selected.id, x.ideaId); assert.equal(idea.details.selected.title, saved.manifest.ideas.ideas[x.ideaId].title);
  assert.deepEqual(idea.details.originLinks[0].originRef, saved.manifest.ideas.originLinks['origin-control'].originRef);
  assert.deepEqual(meaning.details.selected, saved.manifest.meanings.meanings['meaning-control']);
  for (const projection of [idea, meaning]) { assert.match(projection.projectionHash, /^[a-f0-9]{64}$/u); assert.equal(projection.details.complete, true); }
});


test('actual Main retains legal origin defaults optional IDs Meaning sourceId alias and sceneOriginRef promotion', async t => {
  const x = await ideaMeaningMainFixture(t); await x.control();
  const { schemaVersion, kind, targetId, ...originRef } = await x.origin();
  await x.apply('idea.originLink.add', { projectId: x.projectId, ideaId: x.ideaId, originRef });
  await x.apply('meaning.promote', { ...(await x.payloadFor('meaning.promote', 'source-alias')), source: { kind: 'idea', sourceId: x.ideaId } });
  await x.apply('meaning.promote', { ...(await x.payloadFor('meaning.promote', 'scene-origin')), source: { kind: 'sceneOriginRef', originRef } });
});

test('actual Main retains lawful exact duplicate refusals and all previous Idea Meaning author history', async t => {
  const x = await ideaMeaningMainFixture(t); await x.control();
  const duplicate = [ { ...(await x.payloadFor('idea.create', 'control')), ideaId: x.ideaId },
    await x.payloadFor('idea.originLink.add', 'control'), await x.payloadFor('meaning.promote', 'control') ];
  for (const [index, payload] of duplicate.entries()) await t.test(IDEA_MEANING_MAIN_IDS[index], async () => {
    const id = IDEA_MEANING_MAIN_IDS[index], before = authorIdentitySnapshot(x), result = await x.h.command(id, payload);
    assert.equal(result.ok, false); assert.match(JSON.stringify(result), new RegExp(['E_IDEA_ALREADY_EXISTS', 'E_IDEA_ORIGIN_LINK_ALREADY_EXISTS', 'E_MEANING_ALREADY_EXISTS'][index]));
    assertIdeaMeaningPersistence(x, before, authorIdentitySnapshot(x), id, payload, false);
  });
});
// The old renderer fixture first boots under real V10. Load actual new declarations
// before its first V11 render, so a missing control is an oracle failure, not a late dependency fault.
function ideaMeaningMainRenderer(x, current) {
  const h = authorIdentityMainRenderer(x, current, CORRECTION_V10), c = h.c, vm = require('node:vm'), source = read('src/renderer/editor.js');
  const actual = name => { const match = new RegExp('^(?:async )?function ' + name + '\\(', 'm').exec(source); assert.ok(match, name);
    const end = source.indexOf('\n}\n', match.index); assert.ok(end > match.index); return source.slice(match.index, end + 2); };
  const walk = node => [node, ...node.children.flatMap(walk)], proto = c.HTMLElement.prototype;
  proto.contains = function(node) { return this === node || this.children.some(child => child.contains(node)); };
  proto.remove = function() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(node => node !== this); this.parentElement = null; };
  proto.insertBefore = function(node, anchor) { node.remove(); node.parentElement = this;
    this.children.splice(anchor ? this.children.indexOf(anchor) : this.children.length, 0, node); return node; };
  proto.focus = function() { c.document.activeElement = this; }; proto.setSelectionRange = function(a, b, direction) { this.selectionStart = a; this.selectionEnd = b; this.selectionDirection = direction; };
  proto.setAttribute = function(name, value) { (this.attributes ||= {})[name] = String(value); this[name] = value; };
  proto.getAttribute = function(name) { return this.attributes?.[name] || null; };
  proto.querySelectorAll = function(selector) { const match = /^\[data-([a-z-]+)\]$/.exec(selector); assert.ok(match, selector);
    const key = match[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase()); return walk(this).slice(1).filter(node => Object.hasOwn(node.dataset, key)); };
  proto.querySelector = function(selector) { return this.querySelectorAll(selector)[0] || null; };
  c.document.activeElement = c.document.body; c.window.addEventListener = () => {};
  c.projectionInspectorHost = c.document.createElement('section'); c.document.body.append(c.projectionInspectorHost);
  c.projectionInspectorState = { state: 'empty', projectId: x.projectId, manifests: [], projectionStates: [], summary: {} };
  c.PROJECTION_INSPECTOR_QUERY_ID = 'query.projectionInspector'; c.invokeWorkspaceQueryBridge = (id, payload) => x.h.query(id, payload);
  const hash = read('src/core/browser-safe-hash.mjs').replace(/^export /gm, ''); vm.runInContext(hash, c);
  const sequence = source.match(/^const atlasQueryPublicationSequences = .*;$/m); assert.ok(sequence); vm.runInContext(sequence[0], c);
  for (const match of source.matchAll(/^(?:let|const) (\w*[Ii]deaMeaning\w*) = /gm)) {
    const end = source.indexOf(';\n', match.index); assert.ok(end > match.index && end - match.index < 12000); vm.runInContext(source.slice(match.index, end + 1), c);
  }
  const names = ['beginAtlasQueryPublication', 'readAtlasQueryProjection', 'normalizeProjectionInspector', 'refreshProjectionInspector',
    'renderProjectionInspectorState', 'reviewSurfaceIsPlainObject', 'appendAtlasReportsRow', 'appendAtlasOverviewSection', 'appendAtlasOverviewMetric'];
  for (const match of source.matchAll(/^(?:async )?function (\w*[Ii]deaMeaning\w*)\(/gm)) names.push(match[1]);
  vm.runInContext([...new Set(names)].map(actual).join('\n'), c);
  const work = c.tasks, asyncNames = [...source.matchAll(/^async function (\w*[Ii]deaMeaning\w*)\(/gm)].map(m => m[1]);
  for (const name of asyncNames) { const run = c[name]; c[name] = (...args) => { const p = run(...args); work.push(p); return p; }; }
  c.window.__PRODUCT_PROFILE = IDEA_MEANING_V11; c.renderAtlasJourneyState();
  const field = name => walk(c.atlasJourneyHost).find(node => (node.dataset.ideaMeaningField || node.dataset.atlasJourneyField) === name);
  const button = action => walk(c.atlasJourneyHost).find(node => (node.dataset.ideaMeaningAction || node.dataset.atlasJourneyAction) === action);
  const input = async (name, value) => { const node = field(name); assert.ok(node, 'actual author field ' + name); node.value = value;
    await node.emit(node.tagName === 'SELECT' ? 'change' : 'input'); };
  const click = async action => { const node = button(action); assert.ok(node, 'actual author action ' + action); assert.equal(node.disabled, false);
    let index = work.length; const packets = h.packets.length; await node.emit('click'); await new Promise(setImmediate);
    while (index < work.length) { const next = work.slice(index); index = work.length; await Promise.all(next); }
    return h.packets.length > packets ? h.packets.at(-1) : null; };
  return { ...h, field, input, button, click, walk };
}

test('actual Flow creates links promotes and immediately publishes saved authored rows then cold-selects the same Idea [FINITE_IPC_NOT_NATIVE]', async t => {
  const x = await ideaMeaningMainFixture(t); await x.control(); let h = ideaMeaningMainRenderer(x, await x.query());
  await h.click('idea-load'); await h.input('ideaTitle', 'Actual Flow idea é 🧭'); await h.input('ideaSummary', 'Actual persisted author summary');
  const createBefore = authorIdentitySnapshot(x), created = await h.click('idea-create'), createAfter = authorIdentitySnapshot(x);
  assert.ok(created, 'actual listener reaches real registered Main'); assertTemporalMainReceipt(created.mainResult, 'idea.create');
  assertIdeaMeaningPersistence(x, createBefore, createAfter, 'idea.create', created.request.payload, true);
  const ideaId = created.request.payload.ideaId; assert.equal(createAfter.manifest.ideas.ideas[ideaId].title, 'Actual Flow idea é 🧭');
  assert.ok(h.field('selectedIdeaId').children.some(row => row.value === ideaId), 'post-command saved read updates visible options without navigation');
  await h.input('selectedIdeaId', ideaId); await h.target(x.entityId, 68);
  const linkBefore = authorIdentitySnapshot(x), linked = await h.click('idea-origin-link'), linkAfter = authorIdentitySnapshot(x);
  assert.ok(linked); assertTemporalMainReceipt(linked.mainResult, 'idea.originLink.add'); assertIdeaMeaningPersistence(x, linkBefore, linkAfter, 'idea.originLink.add', linked.request.payload, true);
  assert.equal(linked.request.payload.ideaId, ideaId); assert.equal(linked.request.payload.originRef.startOffset, 68);
  await h.input('meaningTitle', 'Actual Flow meaning'); await h.input('meaningInterpretation', 'Explicitly chosen interpretation é 🧭');
  const meaningBefore = authorIdentitySnapshot(x), promoted = await h.click('meaning-promote'), meaningAfter = authorIdentitySnapshot(x);
  assert.ok(promoted); assertTemporalMainReceipt(promoted.mainResult, 'meaning.promote'); assertIdeaMeaningPersistence(x, meaningBefore, meaningAfter, 'meaning.promote', promoted.request.payload, true);
  assert.deepEqual(structuredClone(promoted.request.payload.source), { kind: 'idea', ideaId });
  assert.ok(h.c.projectionInspectorHost.textContent?.includes('Actual Flow meaning') || h.walk(h.c.projectionInspectorHost).some(node => node.textContent === 'Actual Flow meaning'), 'actual read-only inspector exposes saved Meaning');
  const preserved = authorIdentitySnapshot(x); assert.equal((await x.h.main.handleProjectLifecycleOpenCommand({ projectId: x.projectId })).ok, true);
  h = ideaMeaningMainRenderer(x, await x.query()); await h.click('idea-load');
  assert.ok(h.field('selectedIdeaId').children.some(row => row.value === ideaId), 'fresh VM selects saved Core identity after actual Main reopen');
  await h.input('selectedIdeaId', ideaId); await h.input('meaningTitle', 'Cold distinct meaning'); await h.input('meaningInterpretation', 'Second explicit interpretation');
  const coldBefore = authorIdentitySnapshot(x), cold = await h.click('meaning-promote'), coldAfter = authorIdentitySnapshot(x);
  assertTemporalMainReceipt(cold.mainResult, 'meaning.promote'); assertIdeaMeaningPersistence(x, coldBefore, coldAfter, 'meaning.promote', cold.request.payload, true);
  assert.notEqual(cold.request.payload.meaningId, promoted.request.payload.meaningId);
  assertAuthorIdentityCanonical(coldAfter.manifest.meanings.meanings[promoted.request.payload.meaningId], preserved.manifest.meanings.meanings[promoted.request.payload.meaningId]);
});
for (const id of IDEA_MEANING_MAIN_IDS) test('actual ' + id + ' refuses malformed present scalar fields without normalization or writes', async t => {
  const x = await ideaMeaningMainFixture(t); await x.control();
  const patches = id === 'idea.create' ? [{ ideaId: 17 }, { title: [] }, { summary: 17 }]
    : id === 'idea.originLink.add' ? [{ ideaId: [] }, { linkId: 17 }, { linkId: 'x'.repeat(4097) }]
    : [{ meaningId: [] }, { title: 17 }, { interpretation: [] }];
  for (const [index, patch] of patches.entries()) await t.test(Object.keys(patch)[0], async () => {
    const payload = { ...(await x.payloadFor(id, 'bad-scalar-' + index)), ...patch }, before = authorIdentitySnapshot(x);
    const result = await x.h.command(id, payload); t.diagnostic(JSON.stringify({ causalReach: 'IDEA_MEANING_RAW_SCALAR', id, field: Object.keys(patch)[0], result }));
    try { assert.equal(result.ok, false); assert.match(JSON.stringify(result), /E_PRODUCT_COMMAND_PAYLOAD_INVALID/u); }
    finally { assertIdeaMeaningPersistence(x, before, authorIdentitySnapshot(x), id, payload, false); }
  });
});

test('actual existing inspector query rejects malformed view options without writes or authority', async t => {
  const x = await ideaMeaningMainFixture(t); await x.control();
  for (const options of [{ offset: '24' }, { offset: -1 }, { search: [] }, { selectedId: 17 }]) await t.test(JSON.stringify(options), async () => {
    const before = authorIdentitySnapshot(x), result = await x.h.query('query.projectionInspector', { projectId: x.projectId, idea: options });
    assert.deepEqual(authorIdentitySnapshot(x).roster, before.roster); assert.equal(result.ok, false, JSON.stringify(result));
  });
});

const SCENE_LANGUAGE_V12 = 'WRITER_LOCAL_SCENE_LANGUAGE_TAG_V12';
const SCENE_LANGUAGE_MAIN_IDS = Object.freeze(['atlas.languageTag.set', 'atlas.languageTag.clear']);

function assertSceneLanguagePersistence(x, before, after, commandId, payload, applied) {
  assertAuthorIdentityCanonical(after.events.slice(0, before.events.length), before.events);
  assertAuthorIdentityCanonical(after.receipts.slice(0, before.receipts.length), before.receipts);
  assert.deepEqual(after.scene, before.scene); x.assertOriginal();
  if (!applied) {
    assertAuthorIdentityCanonical(after.manifest, before.manifest); assert.deepEqual(after.roster, before.roster);
    assert.equal(after.events.length, before.events.length); assert.equal(after.receipts.length, before.receipts.length); return;
  }
  const seq = before.manifest.lastCommandId + 1, expected = structuredClone(before.manifest);
  const tags = expected.atlas.languageTags ||= { project: null, scenes: {}, blocks: {}, ranges: {} };
  const scope = payload.scopeKind || payload.scope, bucket = scope === 'project' ? null : tags[scope + 's'];
  const tagId = payload.tagId || (scope === 'project' ? 'atlas-language-tag:project:' + x.projectId
    : 'atlas-language-tag:scene:' + x.projectId + ':' + payload.sceneId);
  const prior = scope === 'project' ? tags.project : bucket[tagId]; expected.lastCommandId = seq;
  if (commandId === 'atlas.languageTag.clear') { if (scope === 'project') tags.project = null; else delete bucket[tagId]; }
  else {
    const base = { schemaVersion: 'atlas.languageTag.v1', id: tagId, projectId: x.projectId, scopeKind: scope,
      sceneId: scope === 'project' ? '' : payload.sceneId, blockId: '', startOffset: 0, endOffset: 0,
      languageCode: payload.languageCode, note: (payload.note || '').trim(), source: 'author', manuscriptMutation: false,
      createdByCommandSeq: Number.isInteger(prior?.createdByCommandSeq) ? prior.createdByCommandSeq : seq, updatedByCommandSeq: seq };
    const tag = { ...base, sourceHash: x.hash(base) }; if (scope === 'project') tags.project = tag; else bucket[tagId] = tag;
  }
  assertAuthorIdentityCanonical(after.manifest, expected);
  assert.equal(after.events.length, before.events.length + 1); assert.equal(after.receipts.length, before.receipts.length + 1);
  const receipt = after.receipts.at(-1), event = after.events.at(-1);
  assert.equal(receipt.commandId, commandId); assert.equal(event.commandId, commandId); assert.equal(event.domainEventDigest, receipt.domainEventDigest);
  const prefix = path.relative(x.h.root, x.f.projectRoot) + path.sep;
  const anchorPrefix = path.join('userData', 'stage10-integrity-anchors', x.identityKey) + path.sep;
  const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  const previousHash = digest(before.manifestRaw), nextHash = digest(after.manifestRaw);
  const base = path.join('userData', 'stage10-integrity-anchors', 'manifest-transitions');
  const transitionRoot = path.join(base, digest(x.projectId + '\0' + x.f.manifestPath));
  const directory = path.join(transitionRoot, previousHash), file = path.join(directory, nextHash + '.json');
  const text = JSON.stringify({ schemaVersion: 'yalken.manifest-transition.v1', projectId: x.projectId,
    targetPath: x.f.manifestPath, previousHash, nextHash });
  assert.equal(fs.readFileSync(path.join(x.h.root, file), 'utf8'), text);
  const old = new Map(before.roster), now = new Map(after.roster), additions = new Set([file]);
  assert.equal(old.has(file), false); assert.equal(now.get(file), digest(text));
  for (const name of [base, transitionRoot, directory]) { assert.equal(now.get(name), 'directory'); if (!old.has(name)) additions.add(name); }
  const mutable = new Set([prefix + 'project.craftsman.json',
    ...['product-session.v2.json', 'command-receipt-authority-store.v2.json', path.join('recovery', 'project-truth.latest.v1.json')].map(name => prefix + path.join('.stage10-local', name)),
    ...['integrity-anchor.v1.json', 'integrity-anchor.recovery.v1.json', 'fencing-generation.v1.json'].map(name => anchorPrefix + name)]);
  const fixed = rows => rows.filter(([name]) => !mutable.has(name) && !additions.has(name));
  assert.deepEqual(fixed(after.roster), fixed(before.roster), 'full manuscript, foreign projects, old transitions and unrelated files exact');
  const previous = before.anchors[anchorPrefix + 'integrity-anchor.v1.json'], head = after.authorityStore.currentHead;
  assertAuthorIdentityCanonical(after.anchors[anchorPrefix + 'integrity-anchor.recovery.v1.json'], previous);
  const core = { schemaVersion: 'yalken.stage10.mainIntegrityAnchor.v1', anchorVersion: 1, projectId: x.projectId,
    authorityGeneration: head.authorityGeneration, receiptCount: head.receiptCount, receiptRootDigest: head.receiptRootDigest,
    eventLogDigest: head.eventLogDigest, authorityHeadDigest: head.authorityHeadDigest, authorityStoreDigest: x.hash(after.authorityStore),
    sessionDigest: x.hash(after.session), previousIntegrityAnchorDigest: previous.integrityAnchorDigest };
  assert.equal(core.authorityGeneration, previous.authorityGeneration + 1);
  assertAuthorIdentityCanonical(after.anchors[anchorPrefix + 'integrity-anchor.v1.json'], { ...core, integrityAnchorDigest: x.hash(core) });
  const fence = after.anchors[anchorPrefix + 'fencing-generation.v1.json'], oldFence = before.anchors[anchorPrefix + 'fencing-generation.v1.json'];
  assert.match(fence.ownerTokenDigest, /^[a-f0-9]{64}$/u); assert.notEqual(fence.ownerTokenDigest, oldFence.ownerTokenDigest);
  assert.ok(fence.issuedAtMs >= before.observedAtMs && fence.issuedAtMs <= after.observedAtMs);
  assert.ok(Number.isSafeInteger(fence.monotonicIssuedAtMs) && fence.monotonicIssuedAtMs >= oldFence.monotonicIssuedAtMs);
  assertAuthorIdentityCanonical(fence, { ...oldFence, fencingGeneration: oldFence.fencingGeneration + 1,
    ownerTokenDigest: fence.ownerTokenDigest, issuedAtMs: fence.issuedAtMs, monotonicIssuedAtMs: fence.monotonicIssuedAtMs });
  const recovery = JSON.parse(fs.readFileSync(path.join(x.f.projectRoot, '.stage10-local', 'recovery', 'project-truth.latest.v1.json')));
  assertAuthorIdentityCanonical(recovery, { schemaVersion: 'yalken.stage10.projectTruthRecovery.v1', projectId: x.projectId,
    reason: commandId, previousIntegrityAnchorDigest: previous.integrityAnchorDigest, previousHash, intendedNextHash: nextHash, previousText: before.manifestRaw });
}

async function sceneLanguageMainFixture(t, packaged = false, beforeProject) {
  const x = await reattachmentMainFixture(t, packaged, beforeProject);
  const foreign = await x.h.main.handleProjectLifecycleCreateCommand({ projectName: 'Foreign language project' }); assert.equal(foreign.ok, true);
  assert.equal((await x.h.main.handleProjectLifecycleOpenCommand({ projectId: x.projectId })).ok, true); x.foreignProjectId = foreign.projectId;
  assert.equal((await x.h.main.handleUiOpenDocumentCommand({ projectId: x.projectId, nodeId: x.sceneId })).ok, true);
  const identity = (await import('../../src/product/stage10ProjectIdentityKey.mjs')).stage10ProjectPathIdentity(x.projectId);
  assert.equal(identity.ok, true); x.identityKey = identity.canonicalKey;
  const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  x.legacy = (patch = {}) => ({ projectId: x.projectId, scopeKind: 'scene', sceneId: x.sceneId, languageCode: 'ru-RU', ...patch });
  x.bound = (patch = {}) => ({ ...x.legacy(), expectedManifestRevision: 'sha256:' + digest(fs.readFileSync(x.f.manifestPath)),
    expectedSceneRevision: 'sha256:' + digest(fs.readFileSync(x.f.scenePath)), ...patch });
  x.saved = id => JSON.parse(fs.readFileSync(x.f.manifestPath)).atlas.languageTags.scenes[id];
  x.apply = async (id, payload) => {
    const before = authorIdentitySnapshot(x), response = await x.ui(id, payload), after = authorIdentitySnapshot(x);
    t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_SCENE_LANGUAGE_PERSISTENCE', id, payload, response,
      beforeManifest: before.manifest, afterManifest: after.manifest, beforeRoster: before.roster, afterRoster: after.roster }));
    assertSceneLanguagePersistence(x, before, after, id, payload, response.mainResult.ok === true);
    const receipt = assertTemporalMainReceipt(response.mainResult, id); assert.deepEqual(after.receipts.at(-1), receipt);
    assert.equal(response.result.ok, true); assert.equal(response.result.value.performed, true);
    assert.equal(response.result.value.commandAuthority, 'CommandKernel'); assert.equal(response.result.value.commandId, id);
    assert.deepEqual(response.result.value.result, response.mainResult.value); return { before, after, response };
  };
  x.control = async () => {
    await x.apply('atlas.languageTag.set', x.legacy({ tagId: 'control-language', note: 'Saved explicit author choice' }));
    await x.apply('atlas.languageTag.set', x.legacy({ tagId: 'control-language', languageCode: 'en-US', expectedTagHash: x.hash(x.saved('control-language')) }));
    await x.apply('atlas.languageTag.clear', x.legacy({ tagId: 'control-language', expectedTagHash: x.hash(x.saved('control-language')) }));
  };
  x.next = async id => {
    if (id === 'atlas.languageTag.clear') await x.apply('atlas.languageTag.set', x.legacy({ tagId: 'clear-only-saved' }));
    return id === 'atlas.languageTag.clear' ? x.legacy({ tagId: 'clear-only-saved', expectedTagHash: x.hash(x.saved('clear-only-saved')) }) : x.legacy();
  };
  return x;
}

test('current literal Main selects exact V12 thirty-four commands and unchanged twelve queries', async t => {
  const h = await fullMacMainFixture(t), active = h.main.__profile();
  assert.equal(active.profileId, SCENE_LANGUAGE_V12); assert.equal(active.schemaVersion, 'writer-local-profile.v12');
  assert.deepEqual(active.admittedCommandIds, [...profile.createWriterIdeaMeaningAuthoringProfileProjection({ isPackaged: true, platform: 'darwin' }).admittedCommandIds, ...SCENE_LANGUAGE_MAIN_IDS]);
  assert.equal(active.admittedCommandIds.length, 34); assert.deepEqual(active.admittedQueryIds, READ_SURFACE_QUERY_IDS);
  assert.equal(new URL(h.shellUrl).searchParams.get('PRODUCT_PROFILE'), SCENE_LANGUAGE_V12);
  for (const key of ['optionalSystemsEnabled', 'signing', 'notarization', 'publicDistribution', 'dependencyAdoption', 'cloudAuthority', 'userDataMutation']) assert.equal(active[key], false);
});

test('historical actual packaged V11 refuses language commands with immediate complete no-write', async t => {
  const h = await fullMacMainFixture(t, { historicalV11Constructor: true }), f = await exactAtlasScene(h, 'V11 language refusal');
  assert.equal(h.main.__profile().profileId, IDEA_MEANING_V11);
  for (const id of SCENE_LANGUAGE_MAIN_IDS) {
    const before = reattachmentWholeFixtureRoster(h), result = await h.command(id, { projectId: f.projectId, sceneId: f.sceneId, scopeKind: 'scene', languageCode: 'ru' });
    assert.equal(result.ok, false); assert.match(JSON.stringify(result), /WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED/u);
    assert.deepEqual(reattachmentWholeFixtureRoster(h), before);
  }
});

test('actual unpackaged lawful Main set replace clear and cold read preserve the whole canonical footprint', async t => {
  const x = await sceneLanguageMainFixture(t); await x.control();
  await x.apply('atlas.languageTag.set', { projectId: x.projectId, scopeKind: 'project', languageCode: 'en-US' });
  const projectTag = JSON.parse(fs.readFileSync(x.f.manifestPath)).atlas.languageTags.project;
  await x.apply('atlas.languageTag.clear', { projectId: x.projectId, scopeKind: 'project', expectedTagHash: x.hash(projectTag) });
  await x.apply('atlas.languageTag.set', x.legacy({ tagId: 'custom-saved-language', languageCode: 'de-DE' }));
  const before = authorIdentitySnapshot(x); assert.equal((await x.h.main.handleProjectLifecycleOpenCommand({ projectId: x.foreignProjectId })).ok, true);
  assert.equal((await x.h.main.handleProjectLifecycleOpenCommand({ projectId: x.projectId })).ok, true);
  const afterOpen = authorIdentitySnapshot(x), projection = await x.query(); assert.deepEqual(afterOpen.scene, before.scene);
  assertAuthorIdentityCanonical(afterOpen.manifest, before.manifest); assertAuthorIdentityCanonical(afterOpen.events, before.events);
  assertAuthorIdentityCanonical(afterOpen.receipts, before.receipts);
  const afterQuery = authorIdentitySnapshot(x); assert.deepEqual(afterQuery.roster, afterOpen.roster);
  assert.ok(projection.sceneLanguageTag, 'cold actual Main read must expose the saved tag');
  assert.deepEqual(projection.sceneLanguageTag, { state: 'ready', reason: '', matchingCount: 1,
    manifestRevision: x.bound().expectedManifestRevision, sceneRevision: x.bound().expectedSceneRevision,
    tag: { id: 'custom-saved-language', languageCode: 'de-DE', recordHash: x.hash(x.saved('custom-saved-language')) } });
  await x.apply('atlas.languageTag.clear', x.legacy({ tagId: 'custom-saved-language', expectedTagHash: x.hash(x.saved('custom-saved-language')) }));
});

test('current packaged Main creates replaces and clears only a revision-bound saved scene tag', async t => {
  const x = await sceneLanguageMainFixture(t, true);
  await x.apply('atlas.languageTag.set', x.bound());
  const keys = Object.keys(JSON.parse(fs.readFileSync(x.f.manifestPath)).atlas.languageTags.scenes); assert.equal(keys.length, 1);
  const tagId = keys[0], old = x.saved(tagId); assert.equal(old.sceneId, x.sceneId);
  await x.apply('atlas.languageTag.set', x.bound({ tagId, expectedTagHash: x.hash(old), languageCode: 'en-US' }));
  await x.apply('atlas.languageTag.clear', x.bound({ tagId, expectedTagHash: x.hash(x.saved(tagId)) }));
});

for (const id of SCENE_LANGUAGE_MAIN_IDS) for (const phase of ['queued', 'prepared'])
  for (const fault of ['capability', 'profile', 'entitlement', 'owner', 'session', 'lifecycle', 'generation', 'root', 'project-switch'])
    test('actual language ' + id + ' refuses ' + phase + ' ' + fault + ' after lawful Main control', async t => {
      let armed = () => {}; const x = await sceneLanguageMainFixture(t, false, h => h.main.__host.afterTruth(() => armed()));
      await x.control(); const payload = x.bound(await x.next(id)); let reached = false, expected, before;
      const mutate = async () => {
        reached = true;
        if (fault === 'capability') x.h.main.__host.denyCapability('cap.atlas.languageTag.edit');
        if (fault === 'profile') x.h.main.__host.revokeProfile(); if (fault === 'entitlement') x.h.main.__host.revokeEntitlement(id);
        if (fault === 'owner') x.h.main.__host.revokeOwner(); if (fault === 'session') x.h.main.__host.invalidateSession();
        if (fault === 'lifecycle') x.h.main.__host.invalidateLifecycle(); if (fault === 'generation') x.h.main.__host.invalidateGeneration();
        if (fault === 'root') x.h.main.__host.invalidateProjectRoot();
        if (fault === 'project-switch') assert.equal((await x.h.main.handleProjectLifecycleOpenCommand({ projectId: x.foreignProjectId })).ok, true);
        before = authorIdentitySnapshot(x); expected = before.roster;
      };
      let result;
      if (phase === 'prepared') { armed = mutate; result = await x.h.command(id, payload); }
      else {
        let enter, release; const ready = new Promise(r => { enter = r; }), gate = new Promise(r => { release = r; }); t.after(() => release());
        const held = x.h.main.__host.holdProjectQueue(async () => { enter(); await gate; }); await ready;
        let settled = false; const pending = x.h.command(id, payload).then(value => { settled = true; return value; });
        await new Promise(setImmediate); assert.equal(settled, false); await mutate(); release(); await held; result = await pending;
      }
      t.diagnostic(JSON.stringify({ causalReach: 'LANGUAGE_AUTHORITY_DRIFT', id, phase, fault, reached, result }));
      try { assert.equal(reached, true); assert.equal(result.ok, false); assert.match(JSON.stringify(result), /E_(?:SCENE_LANGUAGE|PRODUCT_COMMAND|STAGE10|CAPABILITY|COMMAND_DISABLED)/u); }
      finally { assert.deepEqual(reattachmentWholeFixtureRoster(x.h), expected); assertSceneLanguagePersistence(x, before, authorIdentitySnapshot(x), id, payload, false); }
    });

for (const id of SCENE_LANGUAGE_MAIN_IDS) for (const fault of ['binding-manifest', 'manifest-cas', 'late-scene'])
  test('actual language ' + id + ' refuses ' + fault + ' without replacing concurrent bytes', async t => {
    let armed = () => {}; const x = await sceneLanguageMainFixture(t, false, h => h.main.__host.afterTruth(() => armed()));
    await x.control(); const payload = x.bound(await x.next(id)); let reached = false, expected;
    const mutate = () => {
      reached = true;
      if (fault === 'late-scene') fs.writeFileSync(x.f.scenePath, fs.readFileSync(x.f.scenePath, 'utf8').replaceAll('Мира', 'Лира'));
      else { const value = JSON.parse(fs.readFileSync(x.f.manifestPath)); value.concurrentLanguageAuthor = 'preserve é 🧭'; value.lastCommandId += 17; fs.writeFileSync(x.f.manifestPath, JSON.stringify(value)); }
      expected = reattachmentWholeFixtureRoster(x.h);
    };
    if (fault === 'binding-manifest') x.h.main.__host.afterCoreBinding(mutate); else armed = mutate;
    const result = await x.h.command(id, payload); t.diagnostic(JSON.stringify({ causalReach: 'LANGUAGE_SAVED_SOURCE_DRIFT', id, fault, reached, result }));
    try { assert.equal(reached, true); assert.equal(result.ok, false); assert.match(JSON.stringify(result), /E_(?:PRODUCT_COMMAND_REVISION_CONFLICT|SCENE_LANGUAGE[^" ]*)/u); }
    finally { assert.deepEqual(reattachmentWholeFixtureRoster(x.h), expected); x.assertOriginal(); }
  });

for (const id of SCENE_LANGUAGE_MAIN_IDS) test('actual language ' + id + ' rejects malformed raw identity before normalization', async t => {
  const x = await sceneLanguageMainFixture(t); await x.control(); const base = await x.next(id);
  const patches = [{ projectId: 17 }, { projectId: [] }, { projectId: 'x'.repeat(1001) }, { sceneId: 17 }, { sceneId: [] },
    { scopeKind: [] }, { scopeKind: 'scene.extra' }, { tagId: 17 }, { expectedTagHash: [] }, { note: {} }];
  if (id.endsWith('.set')) patches.push({ languageCode: [] }, { languageCode: 17 }, { languageCode: 'x'.repeat(1001) });
  for (const patch of patches) await t.test(JSON.stringify(patch).slice(0, 80), async () => {
    const payload = { ...base, ...patch }, before = authorIdentitySnapshot(x), result = await x.h.command(id, payload);
    t.diagnostic(JSON.stringify({ causalReach: 'LANGUAGE_RAW_IDENTITY', id, patch, result }));
    try { assert.equal(result.ok, false); assert.match(JSON.stringify(result), /E_PRODUCT_COMMAND_PAYLOAD_INVALID/u); }
    finally { assertSceneLanguagePersistence(x, before, authorIdentitySnapshot(x), id, payload, false); }
  });
});

test('current packaged language intent refuses missing invalid or stale revisions and an empty-read concurrent insertion', async t => {
  const x = await sceneLanguageMainFixture(t, true), base = x.bound();
  for (const patch of [{ expectedManifestRevision: undefined, expectedSceneRevision: undefined }, { expectedManifestRevision: undefined }, { expectedSceneRevision: undefined }, { expectedSceneRevision: [] },
    { expectedManifestRevision: 'sha256:' + '0'.repeat(64) }, { expectedSceneRevision: 'sha256:' + '0'.repeat(64) }, { scopeKind: 'project' }]) await t.test(JSON.stringify(patch), async () => {
    const payload = { ...base, ...patch }, before = authorIdentitySnapshot(x), result = await x.h.command('atlas.languageTag.set', payload);
    try { assert.equal(result.ok, false); } finally { assertSceneLanguagePersistence(x, before, authorIdentitySnapshot(x), 'atlas.languageTag.set', payload, false); }
  });
  const emptyRead = x.bound(); await x.apply('atlas.languageTag.set', x.bound());
  const before = authorIdentitySnapshot(x), result = await x.h.command('atlas.languageTag.set', { ...emptyRead, languageCode: 'en-US' });
  t.diagnostic(JSON.stringify({ causalReach: 'LANGUAGE_EMPTY_READ_INSERTION', result, before: before.manifest }));
  try { assert.equal(result.ok, false); assert.match(JSON.stringify(result), /E_PRODUCT_COMMAND_REVISION_CONFLICT/u); }
  finally { assertSceneLanguagePersistence(x, before, authorIdentitySnapshot(x), 'atlas.languageTag.set', emptyRead, false); }
});

test('actual Main current-scene language read preserves raw unknown fields and refuses malformed Atlas absence inference', async t => {
  const x = await sceneLanguageMainFixture(t); await x.control(); await x.apply('atlas.languageTag.set', x.legacy({ tagId: 'raw-custom-id' }));
  const original = JSON.parse(fs.readFileSync(x.f.manifestPath)); original.atlas.languageTags.scenes['raw-custom-id'].retainedUnknown = { text: 'é 🧭', value: [1, 2] };
  for (const [name, mutate] of [['custom-id', () => {}], ['future', value => { value.atlas.schemaVersion = 'atlas.author.v99'; }],
    ['malformed-entities', value => { value.atlas.entities = []; }], ['malformed-bucket', value => { value.atlas.languageTags.scenes = []; }]]) await t.test(name, async () => {
    const raw = structuredClone(original); mutate(raw); fs.writeFileSync(x.f.manifestPath, JSON.stringify(raw));
    const before = reattachmentWholeFixtureRoster(x.h), result = await x.query(); assert.deepEqual(reattachmentWholeFixtureRoster(x.h), before);
    assert.ok(result.sceneLanguageTag, 'actual Main must report raw Atlas read issue before old fallback');
    if (name === 'custom-id') {
      assert.equal(result.sceneLanguageTag.state, 'ready'); assert.equal(result.sceneLanguageTag.tag.id, 'raw-custom-id');
      assert.equal(result.sceneLanguageTag.tag.recordHash, x.hash(raw.atlas.languageTags.scenes['raw-custom-id']));
      assert.notEqual(result.sceneLanguageTag.tag.recordHash, raw.atlas.languageTags.scenes['raw-custom-id'].sourceHash);
    } else { assert.equal(result.sceneLanguageTag.state, 'unavailable'); assert.equal(result.sceneLanguageTag.tag, null); assert.ok(result.sceneLanguageTag.reason); }
    const forged = await x.h.query('query.atlasCurrentScene', { projectId: x.projectId, nodeId: x.sceneId,
      atlasAuthorReadIssue: '', sceneLanguageTag: { state: 'empty', matchingCount: 0 }, tier: 'pro', profileId: SCENE_LANGUAGE_V12 });
    assert.deepEqual(reattachmentWholeFixtureRoster(x.h), before);
    assert.deepEqual(forged.atlasCurrentScene.sceneLanguageTag, result.sceneLanguageTag, 'caller diagnostics never replace actual raw read binding');
  });
});

async function sceneLanguageOtherScene(x) {
  const tree = await x.h.main.handleWorkspaceProjectTreeQuery({ tab: 'roman' }); assert.equal(tree.ok, true);
  const parent = tree.root.children.find(node => node.kind === 'roman-root'); assert.ok(parent && typeof parent.nodeId === 'string', 'actual physical Roman parent');
  const created = await x.h.main.handleUiCreateNodeCommand({ projectId: x.projectId, parentNodeId: parent.nodeId,
    kind: 'chapter-file', name: 'Other lawful language scene' }); assert.equal(created.ok, true, JSON.stringify(created));
  assert.notEqual(created.nodeId, x.sceneId); return created.nodeId;
}

test('explicit bound legacy Main intent cannot overwrite a lawful other-scene tag under the Core default key', async t => {
  const x = await sceneLanguageMainFixture(t); await x.control(); const otherScene = await sceneLanguageOtherScene(x);
  const defaultKey = 'atlas-language-tag:scene:' + x.projectId + ':' + x.sceneId;
  await x.apply('atlas.languageTag.set', x.legacy({ sceneId: otherScene, tagId: defaultKey, languageCode: 'de-DE' }));
  assert.equal((await x.h.main.handleUiOpenDocumentCommand({ projectId: x.projectId, nodeId: x.sceneId })).ok, true);
  const payload = x.bound(), before = authorIdentitySnapshot(x), response = await x.ui('atlas.languageTag.set', payload), after = authorIdentitySnapshot(x);
  t.diagnostic(JSON.stringify({ causalReach: 'LANGUAGE_DEFAULT_KEY_FOREIGN_COLLISION', payload, response, before: before.manifest, after: after.manifest }));
  try { assert.equal(response.mainResult.ok, false); assert.match(JSON.stringify(response), /E_SCENE_LANGUAGE/u); }
  finally { assertSceneLanguagePersistence(x, before, after, 'atlas.languageTag.set', payload, false); }
});

for (const mode of ['opaque-language-namespace', 'malformed-unrelated-atlas']) test('explicit bound language intent cannot erase ' + mode, async t => {
  const x = await sceneLanguageMainFixture(t); await x.control();
  const raw = JSON.parse(fs.readFileSync(x.f.manifestPath));
  if (mode === 'opaque-language-namespace') raw.atlas.languageTags.opaqueExtra = { owner: 'author', text: 'Preserve é 🧭' };
  else raw.atlas.seriesIdentityLinks = ['unknown historical payload must not become an empty bucket'];
  fs.writeFileSync(x.f.manifestPath, JSON.stringify(raw));
  const payload = x.bound(), before = authorIdentitySnapshot(x), response = await x.ui('atlas.languageTag.set', payload), after = authorIdentitySnapshot(x);
  t.diagnostic(JSON.stringify({ causalReach: 'LANGUAGE_UNRELATED_AUTHOR_NO_LOSS', mode, payload, response, before: before.manifest, after: after.manifest }));
  try { assert.equal(response.mainResult.ok, false); assert.match(JSON.stringify(response), /E_(?:SCENE_LANGUAGE|PRODUCT_COMMAND_AUTHOR_SCHEMA_UNSUPPORTED)/u); }
  finally { assertSceneLanguagePersistence(x, before, after, 'atlas.languageTag.set', payload, false); }
});

test('explicit bound language intent targets the actual active scene and preserves legal unbound other-scene authoring', async t => {
  const x = await sceneLanguageMainFixture(t); await x.control(); const otherScene = await sceneLanguageOtherScene(x);
  await x.apply('atlas.languageTag.set', x.legacy({ sceneId: otherScene, tagId: 'lawful-other-scene', languageCode: 'de-DE' }));
  const resolved = await x.h.main.resolveProjectTreeNodeIdentity(otherScene, x.projectId);
  assert.equal((await x.h.main.handleUiOpenDocumentCommand({ projectId: x.projectId, nodeId: x.sceneId })).ok, true);
  const payload = x.bound({ sceneId: otherScene, expectedSceneRevision: 'sha256:' + crypto.createHash('sha256').update(fs.readFileSync(resolved.nodePath)).digest('hex'),
    tagId: 'lawful-other-scene', expectedTagHash: x.hash(x.saved('lawful-other-scene')), languageCode: 'en-US' });
  const before = authorIdentitySnapshot(x), response = await x.ui('atlas.languageTag.set', payload), after = authorIdentitySnapshot(x);
  t.diagnostic(JSON.stringify({ causalReach: 'LANGUAGE_NONACTIVE_SAME_PROJECT_SCENE', payload, response, before: before.manifest, after: after.manifest }));
  try { assert.equal(response.mainResult.ok, false); assert.match(JSON.stringify(response), /E_SCENE_LANGUAGE/u); }
  finally { assertSceneLanguagePersistence(x, before, after, 'atlas.languageTag.set', payload, false); }
});

function sceneLanguageMainRenderer(x, projection) {
  const h = ideaMeaningMainRenderer(x, projection), c = h.c, vm = require('node:vm'), source = read('src/renderer/editor.js');
  const actual = name => { const start = new RegExp('^(?:async )?function ' + name + '\\(', 'm').exec(source);
    assert.ok(start, 'actual language helper ' + name); const end = source.indexOf('\n}\n', start.index); assert.ok(end > start.index); return source.slice(start.index, end + 2); };
  for (const match of source.matchAll(/^(?:let|const) (\w*(?:[Ss]ceneLanguage|SCENE_LANGUAGE)\w*) = /gm)) {
    const end = source.indexOf(';\n', match.index); assert.ok(end > match.index && end - match.index < 12000); vm.runInContext(source.slice(match.index, end + 1), c);
  }
  const names = [...source.matchAll(/^(?:async )?function (\w*[Ss]ceneLanguage\w*)\(/gm)].map(match => match[1]);
  assert.ok(names.includes('getSceneLanguageAuthorForm'), 'missing production language form is an assertion gap, not a fixture exception');
  vm.runInContext(names.map(actual).join('\n'), c);
  for (const match of source.matchAll(/^async function (\w*[Ss]ceneLanguage\w*)\(/gm)) {
    const run = c[match[1]]; c[match[1]] = (...args) => { const p = run(...args); c.tasks.push(p); return p; };
  }
  c.window.__PRODUCT_PROFILE = SCENE_LANGUAGE_V12; c.currentAtlasSurface = 'journey'; c.renderAtlasJourneyState();
  const field = () => h.walk(c.atlasJourneyHost).find(node => node.dataset.sceneLanguageField === 'languageCode');
  const button = action => h.walk(c.atlasJourneyHost).find(node => node.dataset.sceneLanguageAction === action);
  const input = async value => { const node = field(); assert.ok(node, 'actual language input'); node.value = value; await node.emit('input'); };
  const click = async action => { const node = button(action); assert.ok(node, 'actual language action ' + action); assert.equal(node.disabled, false);
    const count = h.packets.length; let index = c.tasks.length; await node.emit('click'); await new Promise(setImmediate);
    while (index < c.tasks.length) { const pending = c.tasks.slice(index); index = c.tasks.length; await Promise.all(pending); }
    return h.packets.length > count ? h.packets.at(-1) : null; };
  const unload = () => { const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() {} };
    assert.equal(typeof c.guardSceneLanguageDraftUnload, 'function'); c.guardSceneLanguageDraftUnload(event); return event; };
  return { ...h, field, button, input, click, unload };
}

test('actual V12 Flow Set saved read cold Clear uses real Main strict receipts and complete no-loss footprint [FINITE_IPC_NOT_NATIVE]', async t => {
  const x = await sceneLanguageMainFixture(t, true); let h = sceneLanguageMainRenderer(x, await x.query());
  await h.input('ru-RU'); let before = authorIdentitySnapshot(x), response = await h.click('set'), after = authorIdentitySnapshot(x);
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_LANGUAGE_FLOW_SET', response, before: before.manifest, after: after.manifest }));
  assert.ok(response); const setReceipt = assertTemporalMainReceipt(response.mainResult, 'atlas.languageTag.set');
  assertSceneLanguagePersistence(x, before, after, 'atlas.languageTag.set', response.request.payload, true);
  assert.deepEqual(after.receipts.at(-1), setReceipt); assert.equal(response.result.value.performed, true);
  assert.equal(Object.hasOwn(response.request.payload, 'tagId'), false); assert.equal(Object.hasOwn(response.request.payload, 'expectedTagHash'), false);
  assert.equal(response.request.payload.expectedManifestRevision, 'sha256:' + crypto.createHash('sha256').update(before.manifestRaw).digest('hex'));
  assert.match(response.request.payload.expectedSceneRevision, /^sha256:[a-f0-9]{64}$/u);
  assert.match(h.c.getSceneLanguageAuthorDraft().saved.textContent, /ru-RU/u); assert.equal(h.unload().defaultPrevented, false, 'fully saved language input permits Quit');
  const savedId = Object.keys(after.manifest.atlas.languageTags.scenes)[0], saved = after.manifest.atlas.languageTags.scenes[savedId];
  assert.equal((await x.h.main.handleProjectLifecycleOpenCommand({ projectId: x.foreignProjectId })).ok, true);
  assert.equal((await x.h.main.handleProjectLifecycleOpenCommand({ projectId: x.projectId })).ok, true);
  assert.equal((await x.h.main.handleUiOpenDocumentCommand({ projectId: x.projectId, nodeId: x.sceneId })).ok, true);
  h = sceneLanguageMainRenderer(x, await x.query()); assert.match(h.c.getSceneLanguageAuthorDraft().saved.textContent, /ru-RU/u); assert.equal(h.button('clear').disabled, false);
  before = authorIdentitySnapshot(x); response = await h.click('clear'); after = authorIdentitySnapshot(x);
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_LANGUAGE_FLOW_COLD_CLEAR', response, before: before.manifest, after: after.manifest }));
  assert.ok(response); const clearReceipt = assertTemporalMainReceipt(response.mainResult, 'atlas.languageTag.clear');
  assertSceneLanguagePersistence(x, before, after, 'atlas.languageTag.clear', response.request.payload, true);
  assert.deepEqual(after.receipts.at(-1), clearReceipt); assert.equal(response.request.payload.tagId, savedId);
  assert.equal(response.request.payload.expectedTagHash, x.hash(saved)); assert.equal(h.button('clear').disabled, true);
  assert.equal(h.unload().defaultPrevented, false); assert.equal((await x.query()).sceneLanguageTag.state, 'empty');
});

test('actual unpackaged bound language Main reaches lawful create replacement and clear independently of packaging', async t => {
  const x = await sceneLanguageMainFixture(t); await x.control();
  await x.apply('atlas.languageTag.set', x.bound());
  const [id] = Object.keys(JSON.parse(fs.readFileSync(x.f.manifestPath)).atlas.languageTags.scenes); assert.ok(id);
  await x.apply('atlas.languageTag.set', x.bound({ tagId: id, expectedTagHash: x.hash(x.saved(id)), languageCode: 'en-US' }));
  await x.apply('atlas.languageTag.clear', x.bound({ tagId: id, expectedTagHash: x.hash(x.saved(id)) }));
});

for (const commandId of SCENE_LANGUAGE_MAIN_IDS) test('actual unpackaged bound ' + commandId + ' rejects missing malformed and stale guard tokens after lawful control', async t => {
  const x = await sceneLanguageMainFixture(t); await x.control(); await x.apply('atlas.languageTag.set', x.bound());
  const [id] = Object.keys(JSON.parse(fs.readFileSync(x.f.manifestPath)).atlas.languageTags.scenes); assert.ok(id);
  const cases = [
    ['missing-manifest-partner', { expectedManifestRevision: undefined }, /E_PRODUCT_COMMAND_PAYLOAD_INVALID/u],
    ['missing-scene-partner', { expectedSceneRevision: undefined }, /E_PRODUCT_COMMAND_PAYLOAD_INVALID/u],
    ['coerced-manifest', { expectedManifestRevision: [] }, /E_PRODUCT_COMMAND_PAYLOAD_INVALID/u],
    ['coerced-scene', { expectedSceneRevision: 17 }, /E_PRODUCT_COMMAND_PAYLOAD_INVALID/u],
    ['malformed-manifest', { expectedManifestRevision: 'a'.repeat(64) }, /E_PRODUCT_COMMAND_PAYLOAD_INVALID/u],
    ['malformed-scene', { expectedSceneRevision: 'sha256:bad' }, /E_PRODUCT_COMMAND_PAYLOAD_INVALID/u],
    ['stale-manifest', { expectedManifestRevision: 'sha256:' + '0'.repeat(64) }, /E_PRODUCT_COMMAND_REVISION_CONFLICT/u],
    ['stale-scene', { expectedSceneRevision: 'sha256:' + '0'.repeat(64) }, /E_(?:PRODUCT_COMMAND_REVISION_CONFLICT|SCENE_LANGUAGE[^" ]*STALE)/u],
  ];
  for (const [name, patch, code] of cases) await t.test(name, async () => {
    if (!x.saved(id)) await x.apply('atlas.languageTag.set', x.legacy({ tagId: id }));
    const payload = x.bound({ tagId: id, expectedTagHash: x.hash(x.saved(id)), ...patch }), before = authorIdentitySnapshot(x);
    const response = await x.ui(commandId, payload), after = authorIdentitySnapshot(x);
    t.diagnostic(JSON.stringify({ causalReach: 'UNPACKAGED_LANGUAGE_BOUND_TOKEN', commandId, name, payload, response, before: before.manifest, after: after.manifest }));
    try { assert.equal(response.mainResult.ok, false); assert.match(JSON.stringify(response), code); }
    finally { assertSceneLanguagePersistence(x, before, after, commandId, payload, false); }
  });
});

test('actual unpackaged bound Set and Clear refuse two lawful custom same-scene tags rather than choosing one', async t => {
  const x = await sceneLanguageMainFixture(t); await x.control();
  await x.apply('atlas.languageTag.set', x.legacy({ tagId: 'custom-first', languageCode: 'ru-RU' }));
  await x.apply('atlas.languageTag.set', x.legacy({ tagId: 'custom-second', languageCode: 'en-US' }));
  for (const commandId of SCENE_LANGUAGE_MAIN_IDS) await t.test(commandId, async () => {
    const payload = x.bound({ tagId: 'custom-first', expectedTagHash: x.hash(x.saved('custom-first')), languageCode: 'de-DE' });
    const before = authorIdentitySnapshot(x), response = await x.ui(commandId, payload), after = authorIdentitySnapshot(x);
    t.diagnostic(JSON.stringify({ causalReach: 'UNPACKAGED_LANGUAGE_AMBIGUOUS_SELECTION', commandId, response, before: before.manifest, after: after.manifest }));
    try { assert.equal(response.mainResult.ok, false); assert.match(JSON.stringify(response), /E_SCENE_LANGUAGE[^" ]*AMBIGUOUS/u); }
    finally { assertSceneLanguagePersistence(x, before, after, commandId, payload, false); }
  });
});

for (const commandId of SCENE_LANGUAGE_MAIN_IDS) test('actual bound ' + commandId + ' requires whole raw saved record hash including unknown fields', async t => {
  const x = await sceneLanguageMainFixture(t); await x.control(); await x.apply('atlas.languageTag.set', x.legacy({ tagId: 'custom-whole-hash' }));
  const old = structuredClone(x.saved('custom-whole-hash')), raw = JSON.parse(fs.readFileSync(x.f.manifestPath));
  raw.atlas.languageTags.scenes[old.id].authorExtra = { retained: 'é 🧭', values: [3, 2, 1] }; fs.writeFileSync(x.f.manifestPath, JSON.stringify(raw));
  assert.notEqual(x.hash(x.saved(old.id)), x.hash(old)); assert.notEqual(x.hash(x.saved(old.id)), old.sourceHash);
  for (const [name, expectedTagHash] of [['prior-whole-record', x.hash(old)], ['sourceHash-not-whole-CAS', old.sourceHash]]) await t.test(name, async () => {
    const payload = x.bound({ tagId: old.id, expectedTagHash, languageCode: 'en-US' }), before = authorIdentitySnapshot(x);
    const response = await x.ui(commandId, payload), after = authorIdentitySnapshot(x);
    t.diagnostic(JSON.stringify({ causalReach: 'LANGUAGE_WHOLE_RECORD_HASH', commandId, name, payload, response, rawRecord: x.saved(old.id) }));
    try { assert.equal(response.mainResult.ok, false); assert.match(JSON.stringify(response), /E_(?:ATLAS_LANGUAGE_TAG_STALE|SCENE_LANGUAGE[^" ]*STALE)/u); }
    finally { assertSceneLanguagePersistence(x, before, after, commandId, payload, false); }
  });
});

const PULSE_LIVE_IDS = Object.freeze(['cmd.project.pulse.optIn', 'cmd.project.pulse.optOut']);
const PULSE_CHANNEL_NAMES = Object.freeze(['pulse-privacy-state.v1.json', 'pulse-ledger.v1.jsonl', 'pulse-ledger-intents.v1.jsonl', 'pulse-ledger-outbox.v1.jsonl', 'pulse-corrections.v1.jsonl']);

async function pulseMainFixture(t) {
  const x = await reattachmentMainFixture(t, true), privacy = await import('../../src/core/pulse-privacy-v1.mjs');
  const ledger = await import('../../src/core/pulse-ledger-v1.mjs'), codec = await import('../../src/core/pulse-policy-codec-v1.mjs');
  x.pulseDirectory = path.join(x.h.userData, 'pulse');
  x.pulseState = () => privacy.readPulsePrivacyStateSnapshot(x.pulseDirectory);
  x.pulseLedger = () => ledger.readPulseLedgerSnapshot(x.pulseDirectory);
  x.pulseFiles = () => fs.existsSync(x.pulseDirectory) ? Object.fromEntries(fs.readdirSync(x.pulseDirectory).sort().map(name => {
    assert.ok(PULSE_CHANNEL_NAMES.includes(name), 'unadmitted Pulse channel: ' + name);
    const file = path.join(x.pulseDirectory, name); assert.equal(fs.lstatSync(file).isFile(), true);
    return [name, fs.readFileSync(file)];
  })) : {};
  x.pulsePayload = (patch = {}) => { const state = x.pulseState(); return { projectId: x.projectId,
    expectedPrivacyRevision: state.revision, expectedPrivacyStateDigest: state.stateDigest, ...patch }; };
  x.pulseRead = async () => {
    const before = reattachmentWholeFixtureRoster(x.h), result = await x.h.query('query.atlasContinuityLedgerSurface', {
      projectId: x.projectId, explicitOpen: true, rowLimit: 16 });
    assert.deepEqual(reattachmentWholeFixtureRoster(x.h), before, 'actual Main Pulse query never creates, repairs or rewrites anything');
    assert.equal(result.ok, true, JSON.stringify(result)); assert.ok(result.atlasContinuityLedgerSurface?.pulseClaim);
    return result.atlasContinuityLedgerSurface;
  };
  x.pulseUi = await fullMacRendererCommandPort(x.h, { allowUnregistered: true });
  x.pulseConsent = async (id, patch = {}) => {
    const priorState = x.pulseState(), before = pulseSnapshot(x), response = await x.pulseUi(id, x.pulsePayload(patch)), after = pulseSnapshot(x);
    t.diagnostic(JSON.stringify({ causalReach: 'PULSE_REGISTERED_CONSENT', id, reachedMain: !!response.mainResult, response }));
    assertPulseConsentFootprint(x, before, after);
    assert.ok(response.mainResult, 'new registered renderer command must reach actual Main; missing ID is an admission gap');
    assert.equal(response.mainResult.ok, true, JSON.stringify(response)); assert.equal(response.result.ok, true);
    assert.equal(response.result.value?.performed, true); const state = x.pulseState();
    assert.equal(state.collectionStatus, id.endsWith('.optIn') ? 'OPTED_IN' : 'OPTED_OUT');
    assert.equal(state.revision, priorState.revision + 1);
    assert.deepEqual(response.mainResult.value.privacyState, state);
    assert.equal((await x.pulseRead()).pulseClaim.privacy.stateDigest, state.stateDigest); return response;
  };
  // This is lawful existing-Core fixture setup, never live Main consent credit.
  x.seedPulse = async () => {
    const controller = await privacy.openPulsePrivacyController(x.pulseDirectory);
    const state = x.pulseState(); await controller.optIn({ schemaVersion: privacy.PULSE_PRIVACY_COMMAND_SCHEMA,
      type: 'OPT_IN', requestId: 'owned-core-control-' + state.revision, expectedPrivacyRevision: state.revision });
    assert.equal(x.pulseState().collectionStatus, 'OPTED_IN'); return controller;
  };
  x.sceneReceipt = () => JSON.parse(fs.readFileSync(x.f.scenePath + '.wp201-commit.json'));
  x.receiptCodec = codec;
  x.originalScene = fs.readFileSync(x.f.scenePath);
  return x;
}

function pulseSnapshot(x) {
  return { ...authorIdentitySnapshot(x), library: JSON.parse(fs.readFileSync(path.join(x.h.userData, 'project-library-index.v1.json'))) };
}

function assertPulseSaveMetadata(x, before, after) {
  const libraryName = path.relative(x.h.root, path.join(x.h.userData, 'project-library-index.v1.json'));
  const boundedTime = value => { const time = Date.parse(value); assert.ok(time >= before.observedAtMs && time <= after.observedAtMs); };
  const old = before.library.entries.find(row => row.projectId === x.projectId), current = after.library.entries.find(row => row.projectId === x.projectId);
  assert.ok(old); assert.ok(current); boundedTime(current.lastOpenedAtUtc); boundedTime(after.library.updatedAtUtc);
  assertAuthorIdentityCanonical(current, { ...old, lastOpenedAtUtc: current.lastOpenedAtUtc, lastSeenAtUtc: current.lastOpenedAtUtc,
    manifestHash: crypto.createHash('sha256').update(JSON.stringify(canonicalTemporalValue(after.manifest))).digest('hex') });
  assertAuthorIdentityCanonical(after.library, { ...before.library, updatedAtUtc: after.library.updatedAtUtc,
    entries: [current, ...before.library.entries.filter(row => row.projectRoot !== old.projectRoot)] });
  const fenceName = Object.keys(before.anchors).find(name => name.endsWith('fencing-generation.v1.json') && before.anchors[name].projectId === x.projectId);
  assert.ok(fenceName); const prior = before.anchors[fenceName], next = after.anchors[fenceName];
  assert.match(next.ownerTokenDigest, /^[a-f0-9]{64}$/u); assert.notEqual(next.ownerTokenDigest, prior.ownerTokenDigest);
  assert.ok(next.issuedAtMs >= before.observedAtMs && next.issuedAtMs <= after.observedAtMs);
  assert.ok(Number.isSafeInteger(next.monotonicIssuedAtMs) && next.monotonicIssuedAtMs >= prior.monotonicIssuedAtMs);
  assertAuthorIdentityCanonical(next, { ...prior, fencingGeneration: prior.fencingGeneration + 1, ownerTokenDigest: next.ownerTokenDigest,
    issuedAtMs: next.issuedAtMs, monotonicIssuedAtMs: next.monotonicIssuedAtMs });
  return [libraryName, fenceName];
}

function assertPulseConsentFootprint(x, before, after) {
  assertAuthorIdentityCanonical(after.manifest, before.manifest); assert.deepEqual(after.scene, before.scene);
  assertAuthorIdentityCanonical(after.events, before.events); assertAuthorIdentityCanonical(after.receipts, before.receipts); x.assertOriginal();
  const pulse = path.relative(x.h.root, x.pulseDirectory), prefix = pulse + path.sep;
  const unrelated = rows => rows.filter(([name]) => name !== pulse && !name.startsWith(prefix));
  assert.deepEqual(unrelated(after.roster), unrelated(before.roster), 'consent changes only the fixed app-local Pulse namespace');
  x.pulseFiles();
}

async function assertPulseSavedSceneFootprint(x, before, after, text) {
  const envelope = require('../../src/core/document-content-envelope-v1.cjs');
  assert.equal(envelope.parseObservablePayload(after.scene.toString('utf8')).text, text);
  assertAuthorIdentityCanonical(after.events, before.events); assertAuthorIdentityCanonical(after.receipts, before.receipts); x.assertOriginal();
  const changed = !before.scene.equals(after.scene), preservation = await import('../../src/core/proRoundtripPreservation.mjs');
  const nowIso = after.manifest.proDataInvalidation?.updatedAtUtc;
  if (changed) { const time = Date.parse(nowIso); assert.ok(time >= before.observedAtMs && time <= after.observedAtMs, 'actual invalidation time belongs to this Save'); }
  const expected = changed ? preservation.applyFreeEditProDataInvalidation(before.manifest, {
    changedSceneIds: [path.relative(x.f.projectRoot, x.f.scenePath).split(path.sep).join('/')], deletedSceneIds: [], nowIso }).manifest : before.manifest;
  assertAuthorIdentityCanonical(after.manifest, expected);
  const receipt = x.sceneReceipt(); assert.equal(receipt.revision, x.h.editor.generation);
  assert.equal(receipt.sceneDigest, crypto.createHash('sha256').update(after.scene).digest('hex'));
  assert.equal(receipt.manifestDigest, crypto.createHash('sha256').update(after.manifestRaw).digest('hex'));
  const mutable = new Set([x.f.scenePath, x.f.scenePath + '.wp201-commit.json', x.f.manifestPath].map(file => path.relative(x.h.root, file)));
  for (const name of assertPulseSaveMetadata(x, before, after)) mutable.add(name);
  const old = new Map(before.roster), next = new Map(after.roster), additions = new Set();
  const transitionRoot = path.join('userData', 'stage10-integrity-anchors', 'manifest-transitions',
    crypto.createHash('sha256').update(x.projectId + '\0' + x.f.manifestPath).digest('hex'));
  if (before.manifestRaw !== after.manifestRaw) {
    const previousHash = crypto.createHash('sha256').update(before.manifestRaw).digest('hex'), nextHash = crypto.createHash('sha256').update(after.manifestRaw).digest('hex');
    const dir = path.join(transitionRoot, previousHash), name = path.join(dir, nextHash + '.json');
    const content = JSON.stringify({ schemaVersion: 'yalken.manifest-transition.v1', projectId: x.projectId, targetPath: x.f.manifestPath, previousHash, nextHash });
    assert.equal(next.get(name), crypto.createHash('sha256').update(content).digest('hex'));
    for (const item of [path.join('userData', 'stage10-integrity-anchors', 'manifest-transitions'), transitionRoot, dir, name]) if (!old.has(item)) additions.add(item);
  }
  const pulse = path.relative(x.h.root, x.pulseDirectory), prefix = pulse + path.sep;
  const fixed = rows => rows.filter(([name]) => !mutable.has(name) && !additions.has(name) && name !== pulse && !name.startsWith(prefix));
  assert.deepEqual(fixed(after.roster), fixed(before.roster), 'every unrelated immediate Documents/userData member and previous transition stays exact');
  x.pulseFiles(); return receipt;
}

function assertPulseAggregate(x, entry, receipt, rawScene) {
  assert.deepEqual(entry.receipt.aggregates, [{ metricId: 'SCENES_EDITED_COUNT', value: 1 }]);
  assert.equal(entry.receipt.sourceRevisionOrdinal, receipt.revision); assert.equal(entry.receipt.generation, x.h.editor.generation);
  assert.deepEqual(x.receiptCodec.assertPulseAggregateReceiptCurrent(entry.receipt, {
    sourceRevisionOrdinal: receipt.revision, generation: x.h.editor.generation }), entry.receipt);
  const channels = Object.values(x.pulseFiles()).map(bytes => bytes.toString('utf8')).join('\n');
  for (const value of [rawScene.toString('utf8'), x.projectId, x.sceneId, x.f.scenePath, x.f.manifestPath, x.h.root,
    receipt.transactionId, receipt.sceneDigest, receipt.manifestDigest,
    x.hash({ idempotencyKey: receipt.transactionId }), x.hash({ idempotencyKey: 'save:' + receipt.transactionId }),
    crypto.createHash('sha256').update(receipt.transactionId).digest('hex')]) assert.equal(channels.includes(value), false, 'Pulse stores no manuscript/identity/path or deterministic transaction correlation');
}

test('Pulse actual existing Core controller and ordinary Main Save are lawful preconditions with no default collection', async t => {
  const x = await pulseMainFixture(t), before = pulseSnapshot(x);
  assert.equal(fs.existsSync(x.pulseDirectory), false); const off = await x.pulseRead();
  assert.equal(off.pulseClaim.state, 'optedOut'); assert.equal(fs.existsSync(x.pulseDirectory), false);
  const text = 'Добавлено. ' + EXACT_ATLAS_TEXT + ' Проверяем обычное сохранение.'; await x.save(text);
  await assertPulseSavedSceneFootprint(x, before, pulseSnapshot(x), text);
  assert.equal(fs.existsSync(x.pulseDirectory), false);
  const controller = await x.seedPulse(), state = x.pulseState(), frozen = reattachmentWholeFixtureRoster(x.h);
  assert.equal((await controller.explain()).privacyState.stateDigest, state.stateDigest);
  assert.deepEqual(reattachmentWholeFixtureRoster(x.h), frozen);
  t.diagnostic(JSON.stringify({ causalReach: 'EXISTING_CORE_AND_CANONICAL_SAVE_CONTROL', actualSaveAck: true, optedInCoreOnly: true, ledgerSequence: (await x.pulseLedger()).sequence }));
});

test('Pulse changed actual saved preimage produces only one scene-edit observation independently of new command admission', async t => {
  const x = await pulseMainFixture(t); await x.seedPulse();
  const before = pulseSnapshot(x), text = 'Добавлено. ' + EXACT_ATLAS_TEXT + ' Ещё один сохранённый абзац.';
  await x.save(text); const after = pulseSnapshot(x), receipt = await assertPulseSavedSceneFootprint(x, before, after, text);
  const ledger = await x.pulseLedger();
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_CANONICAL_SAVE_PULSE_PRODUCER', actualSaveAck: true, actualReceipt: receipt, ledger, rawBeforeHash: crypto.createHash('sha256').update(before.scene).digest('hex'), rawAfterHash: crypto.createHash('sha256').update(after.scene).digest('hex') }));
  assert.equal(ledger.sequence, 1, 'existing canonical Save currently has no Pulse producer'); assertPulseAggregate(x, ledger.entries[0], receipt, after.scene);
  const claim = (await x.pulseRead()).pulseClaim, row = claim.rows[0]; assert.equal(row.sceneEdits.value, 1);
  for (const key of ['added', 'deleted', 'net', 'touched', 'sessions', 'declaredTasks', 'manualPhase']) assert.equal(row[key].status, 'NOT_RECORDED');
});

test('Pulse actual registered Enable changed Save cold history Disable and later Save preserve all old author state [FINITE_IPC_NOT_NATIVE]', async t => {
  const x = await pulseMainFixture(t); await x.pulseConsent(PULSE_LIVE_IDS[0]);
  const before = pulseSnapshot(x), text = 'Добавлено. ' + EXACT_ATLAS_TEXT + ' Явное локальное наблюдение.';
  await x.save(text); const after = pulseSnapshot(x), receipt = await assertPulseSavedSceneFootprint(x, before, after, text);
  const ledger = await x.pulseLedger(); assert.equal(ledger.sequence, 1); assertPulseAggregate(x, ledger.entries[0], receipt, after.scene);
  const state = x.pulseState(), { readPulseClaimProjection } = await import('../../src/core/pulse-claim-v1.mjs');
  const cold = await import('node:child_process').then(({ execFileSync }) => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '--eval',
    `import {readPulseClaimProjection} from ${JSON.stringify(require('node:url').pathToFileURL(path.join(ROOT, 'src/core/pulse-claim-v1.mjs')).href)};process.stdout.write(JSON.stringify(await readPulseClaimProjection(process.argv[1])));`, x.pulseDirectory], { encoding: 'utf8' })));
  assert.deepEqual(cold, await readPulseClaimProjection(x.pulseDirectory)); assert.equal(cold.rows[0].sceneEdits.value, 1);
  assert.equal((await x.h.main.handleProjectLifecycleOpenCommand({ projectId: x.projectId })).ok, true);
  assert.equal((await x.h.main.handleUiOpenDocumentCommand({ projectId: x.projectId, nodeId: x.sceneId })).ok, true);
  assert.equal((await x.pulseRead()).pulseClaim.privacy.stateDigest, state.stateDigest);
  await x.pulseConsent(PULSE_LIVE_IDS[1]); const channels = x.pulseFiles();
  const beforeOffSave = pulseSnapshot(x), second = text + ' После отключения.'; await x.save(second);
  await assertPulseSavedSceneFootprint(x, beforeOffSave, pulseSnapshot(x), second);
  assert.deepEqual(x.pulseFiles(), channels); assert.equal((await x.pulseLedger()).sequence, 1);
  assert.equal((await x.pulseRead()).pulseClaim.state, 'optedOut');
});

for (const id of PULSE_LIVE_IDS) test('Pulse actual Main ' + id + ' validates exact raw consent payload without creating authority', async t => {
  const x = await pulseMainFixture(t); if (id.endsWith('.optOut')) await x.seedPulse();
  const cases = [{ projectId: 17 }, { projectId: [] }, { projectId: '' }, { projectId: 'foreign-project' }, { expectedPrivacyRevision: '0' },
    { expectedPrivacyRevision: -1 }, { expectedPrivacyRevision: [] }, { expectedPrivacyRevision: undefined },
    { expectedPrivacyStateDigest: 17 }, { expectedPrivacyStateDigest: [] }, { expectedPrivacyStateDigest: '' },
    { expectedPrivacyStateDigest: 'f'.repeat(64) }, { expectedPrivacyStateDigest: undefined },
    { path: x.f.scenePath }, { content: EXACT_ATLAS_TEXT }, { type: 'OPT_IN' }, { requestId: 'forged' },
    { aggregates: [{ metricId: 'WORDS_ADDED_COUNT', value: 99 }] }, { receipt: {} }, { tier: 'pro' }];
  for (const patch of cases) await t.test(JSON.stringify(patch), async () => {
    const before = pulseSnapshot(x), result = await x.h.command(id, x.pulsePayload(patch));
    t.diagnostic(JSON.stringify({ causalReach: 'PULSE_RAW_CONSENT_MAIN', id, patch, result }));
    try { assert.equal(result.ok, false); assert.match(JSON.stringify(result), /(?:PULSE|PAYLOAD|PROJECT).*(?:INVALID|STALE|MISMATCH|REQUIRED)/u); }
    finally { assert.deepEqual(pulseSnapshot(x).roster, before.roster); }
  });
});

test('Pulse actual Main consent rejects a stale valid revision and preserves the complete current state', async t => {
  const x = await pulseMainFixture(t), old = x.pulsePayload(); await x.seedPulse();
  const before = pulseSnapshot(x), result = await x.h.command(PULSE_LIVE_IDS[0], old);
  try { assert.equal(result.ok, false); assert.match(JSON.stringify(result), /PULSE.*STALE/u); }
  finally { assert.deepEqual(pulseSnapshot(x).roster, before.roster); }
});

for (const fault of ['owner', 'project', 'session', 'window', 'userData', 'generation', 'entitlement', 'profile', 'lifecycle']) test('Pulse queued consent revalidates actual ' + fault + ' before writes', async t => {
  const x = await pulseMainFixture(t); await x.seedPulse(); let enter, release;
  const entered = new Promise(r => { enter = r; }), gate = new Promise(r => { release = r; }); t.after(() => release());
  const held = x.h.main.__host.holdDiskQueue(async () => { enter(); await gate; }); await entered;
  let settled = false; const pending = x.h.command(PULSE_LIVE_IDS[1], x.pulsePayload()).finally(() => { settled = true; }); await new Promise(setImmediate);
  const queued = !settled;
  if (fault === 'owner') x.h.main.__host.revokeOwner();
  if (fault === 'project') x.h.main.__host.invalidateProjectRoot();
  if (fault === 'session') x.h.main.__host.invalidateSession();
  if (fault === 'window') x.h.window.isDestroyed = () => true;
  if (fault === 'userData') x.h.main.__host.invalidatePulseUserData();
  if (fault === 'generation') x.h.main.__host.invalidateGeneration();
  if (fault === 'entitlement') x.h.main.__host.revokeEntitlement(PULSE_LIVE_IDS[1]);
  if (fault === 'profile') x.h.main.__host.revokeProfile();
  if (fault === 'lifecycle') x.h.main.__host.invalidateLifecycle();
  const before = pulseSnapshot(x); release(); await held; const result = await pending;
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_DISK_QUEUE_PRIVACY_GUARD', fault, queued, result }));
  try { assert.equal(queued, true, 'actual command must wait at diskQueue before fault injection'); assert.equal(result.ok, false); assert.match(JSON.stringify(result), /(?:PULSE|COMMAND_DISABLED).*?(?:STALE|UNAVAILABLE|ENTITLEMENT|REVOKED)/u); }
  finally { assert.deepEqual(pulseSnapshot(x).roster, before.roster); }
});

test('Pulse successful queued opt-out orders before later changed Save without recursion or later collection', async t => {
  const x = await pulseMainFixture(t); await x.pulseConsent(PULSE_LIVE_IDS[0]);
  const before = pulseSnapshot(x), text = 'Добавлено. ' + EXACT_ATLAS_TEXT + ' Очередь после отключения.';
  const generation = await preparePulseDirtyEdit(x, text);
  let enter, release; const entered = new Promise(r => { enter = r; }), gate = new Promise(r => { release = r; }); t.after(() => release());
  const held = x.h.main.__host.holdDiskQueue(async () => { enter(); await gate; }); await entered;
  const off = x.h.command(PULSE_LIVE_IDS[1], x.pulsePayload()); await new Promise(setImmediate);
  const changed = x.ui('cmd.project.save', {});
  release(); await held; assert.equal((await off).ok, true); assert.equal((await changed).mainResult.ok, true);
  assert.equal(x.h.sent.filter(([channel, payload]) => channel === 'set-dirty' && payload.ack?.kind === 'SAVED').at(-1)?.[1].ack.savedGeneration, generation);
  await assertPulseSavedSceneFootprint(x, before, pulseSnapshot(x), text);
  assert.equal(x.pulseState().collectionStatus, 'OPTED_OUT'); assert.equal((await x.pulseLedger()).sequence, 0);
});

test('Pulse no-op and actual canonical replay do not count Save clicks or lastAutosaveHash changes', async t => {
  const x = await pulseMainFixture(t); await x.seedPulse();
  const before = x.pulseFiles(), same = 'Добавлено. ' + EXACT_ATLAS_TEXT;
  await x.save(same); assert.deepEqual(x.pulseFiles(), before, 'new generation but identical actual saved bytes is no observation');
  const text = same + ' Только одно настоящее изменение.'; await x.save(text);
  const snapshot = await x.pulseLedger(); assert.equal(snapshot.sequence, 1);
  const frozen = x.pulseFiles(), replay = (await x.ui('cmd.project.save', {})).mainResult; assert.equal(replay.ok, true, JSON.stringify(replay));
  assert.deepEqual(x.pulseFiles(), frozen); assert.equal((await x.pulseLedger()).sequence, 1);
});

test('Pulse query leaves malformed opted-in channels byte exact and never repairs a torn ledger', async t => {
  const x = await pulseMainFixture(t); await x.seedPulse();
  fs.writeFileSync(path.join(x.pulseDirectory, 'pulse-ledger.v1.jsonl'), '{"broken":');
  const before = pulseSnapshot(x), result = await x.pulseRead();
  assert.equal(result.pulseClaim.state, 'unavailable'); assert.deepEqual(pulseSnapshot(x).roster, before.roster);
});

for (const mode of ['failed-scene', 'auxiliary-before-publish', 'ack-loss-after-publish']) test('Pulse ' + mode + ' retains truthful manuscript SaveACK and explicit history outcome', async t => {
  const x = await pulseMainFixture(t); await x.seedPulse(); const promises = require('node:fs/promises'), rename = promises.rename;
  let reached = false;
  promises.rename = async (from, to) => {
    const target = mode === 'failed-scene' ? to === x.f.scenePath : to.startsWith(x.pulseDirectory + path.sep);
    if (!target || reached) return rename(from, to);
    reached = true; if (mode === 'ack-loss-after-publish') await rename(from, to);
    throw Object.assign(new Error('OWNED_PULSE_WRITE_FAILURE'), { code: 'E_OWNED_PULSE_WRITE_FAILURE' });
  };
  t.after(() => { promises.rename = rename; }); const before = pulseSnapshot(x), pulseBefore = x.pulseFiles(), text = 'Добавлено. ' + EXACT_ATLAS_TEXT + ' Проверка отказа.';
  let actualSaveFailure;
  if (mode === 'failed-scene') { const command = x.h.command; x.h.command = async (...args) => {
    const result = await command(...args); if (args[0] === 'cmd.project.save') actualSaveFailure = result; return result;
  }; }
  let outcome; try { await x.save(text); outcome = { saved: true }; } catch (error) { outcome = { saved: false, message: error.message }; }
  const after = pulseSnapshot(x); t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_PULSE_SAVE_FAILURE', mode, reached, outcome,
    savedScene: require('../../src/core/document-content-envelope-v1.cjs').parseObservablePayload(after.scene.toString('utf8')).text,
    status: x.h.sent.filter(([channel]) => channel === 'status-update').slice(-4) }));
  assert.equal(reached, true, 'actual scene/Pulse publish must reach injected port, not an absent-ID refusal');
  if (mode === 'failed-scene') {
    assert.equal(outcome.saved, false); assert.deepEqual(x.pulseFiles(), pulseBefore); assert.deepEqual(after.scene, before.scene);
    const nowIso = after.manifest.proDataInvalidation.updatedAtUtc, time = Date.parse(nowIso);
    assert.ok(time >= before.observedAtMs && time <= after.observedAtMs);
    const { applyFreeEditProDataInvalidation } = await import('../../src/core/proRoundtripPreservation.mjs');
    assertAuthorIdentityCanonical(after.manifest, applyFreeEditProDataInvalidation(before.manifest, {
      changedSceneIds: [path.relative(x.f.projectRoot, x.f.scenePath).split(path.sep).join('/')], deletedSceneIds: [], nowIso }).manifest);
    assertAuthorIdentityCanonical(after.manifest.atlas, before.manifest.atlas);
    assertAuthorIdentityCanonical(after.events, before.events); assertAuthorIdentityCanonical(after.receipts, before.receipts); x.assertOriginal();
    const transaction = require('../../src/core/project-transaction-v1.cjs'), journalPath = transaction.journalPathFor(x.f.manifestPath);
    const pending = await transaction.readPendingProjectTransactionBinding({ manifestPath: x.f.manifestPath });
    assert.equal(pending.pending, true); assert.equal(pending.scenePath, x.f.scenePath); assert.equal(pending.manifestPath, x.f.manifestPath);
    const journal = JSON.parse(fs.readFileSync(journalPath));
    assert.deepEqual(journal, { schemaVersion: 'yalken.project-transaction.journal.v1', transactionId: pending.transactionId,
      revision: x.h.editor.generation, scenePath: x.f.scenePath, manifestPath: x.f.manifestPath,
      before: { sceneBase64: before.scene.toString('base64'), manifestBase64: Buffer.from(before.manifestRaw).toString('base64') },
      after: { sceneBase64: Buffer.from(x.h.editor.content).toString('base64'), manifestBase64: Buffer.from(after.manifestRaw).toString('base64') } });
    const commitName = path.relative(x.h.root, x.f.scenePath + '.wp201-commit.json');
    assert.equal(new Map(after.roster).get(commitName), new Map(before.roster).get(commitName), 'failed scene never publishes a new commit marker');
    const lastAck = x.h.sent.filter(([channel, payload]) => channel === 'set-dirty' && payload.ack?.kind === 'SAVED').at(-1)?.[1].ack;
    assert.notEqual(lastAck?.savedGeneration, x.h.editor.generation); assert.equal((await x.pulseLedger()).sequence, 0);
    assert.deepEqual(actualSaveFailure, { ok: false, code: 'PROJECT_TRANSACTION_FAILED', reason: 'PROJECT_TRANSACTION_FAILED',
      value: { ok: false, error: { code: 'E_PROJECT_SAVE_FAILED', op: 'cmd.project.save', reason: 'PROJECT_TRANSACTION_FAILED',
        details: { causeCode: 'E_SAVE_ATOMIC_PUBLISH', causePhase: 'ATOMIC_PUBLISH' } } } });
    const fenceName = Object.keys(before.anchors).find(name => name.endsWith('fencing-generation.v1.json') && before.anchors[name].projectId === x.projectId);
    const priorFence = before.anchors[fenceName], nextFence = after.anchors[fenceName];
    assert.match(nextFence.ownerTokenDigest, /^[a-f0-9]{64}$/u); assert.notEqual(nextFence.ownerTokenDigest, priorFence.ownerTokenDigest);
    assert.ok(nextFence.issuedAtMs >= before.observedAtMs && nextFence.issuedAtMs <= after.observedAtMs);
    assert.ok(Number.isSafeInteger(nextFence.monotonicIssuedAtMs) && nextFence.monotonicIssuedAtMs >= priorFence.monotonicIssuedAtMs);
    assertAuthorIdentityCanonical(nextFence, { ...priorFence, fencingGeneration: priorFence.fencingGeneration + 1,
      ownerTokenDigest: nextFence.ownerTokenDigest, issuedAtMs: nextFence.issuedAtMs, monotonicIssuedAtMs: nextFence.monotonicIssuedAtMs });
    const current = new Map(after.roster), originals = new Map(before.roster), additions = new Set([path.relative(x.h.root, journalPath)]);
    const previousHash = crypto.createHash('sha256').update(before.manifestRaw).digest('hex'), nextHash = crypto.createHash('sha256').update(after.manifestRaw).digest('hex');
    const transitionBase = path.join('userData', 'stage10-integrity-anchors', 'manifest-transitions');
    const transitionRoot = path.join(transitionBase, crypto.createHash('sha256').update(x.projectId + '\0' + x.f.manifestPath).digest('hex'));
    const dir = path.join(transitionRoot, previousHash), name = path.join(dir, nextHash + '.json');
    const content = JSON.stringify({ schemaVersion: 'yalken.manifest-transition.v1', projectId: x.projectId, targetPath: x.f.manifestPath, previousHash, nextHash });
    assert.equal(current.get(name), crypto.createHash('sha256').update(content).digest('hex'));
    for (const entry of [transitionBase, transitionRoot, dir]) { assert.equal(current.get(entry), 'directory'); if (!originals.has(entry)) additions.add(entry); }
    if (!originals.has(name)) additions.add(name);
    const mutable = new Set([fenceName, path.relative(x.h.root, x.f.manifestPath)]);
    const fixed = rows => rows.filter(([name]) => !mutable.has(name) && !additions.has(name));
    assert.deepEqual(fixed(after.roster), fixed(before.roster), 'complete pending-phase roster preserves library/settings/old commit/anchors/foreign/Pulse bytes');
    t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_WP201_FAILED_SCENE_PENDING', reached, pendingTransaction: pending.transactionId,
      failedSave: actualSaveFailure, failedNewGenerationAck: true, exactPreparedManifestAndJournal: true, originalSceneHistoryAndPulseExact: true }));
  }
  else {
    assert.equal(outcome.saved, true, 'auxiliary failure must not invalidate durable manuscript SaveACK');
    await assertPulseSavedSceneFootprint(x, before, after, text);
    const status = JSON.stringify(x.h.sent.filter(([channel]) => channel === 'status-update').at(-1)); assert.match(status, /(?:Pulse|history|истори).*(?:partial|record|незапис|не запис|не удалось)/iu);
  }
});

async function pulseMainRenderer(x) {
  const h = authorIdentityMainRenderer(x, await x.query(), CORRECTION_V10), c = h.c, source = read('src/renderer/editor.js'), vm = require('node:vm');
  const walk = node => [node, ...node.children.flatMap(walk)], proto = c.HTMLElement.prototype;
  proto.contains = function(node) { return this === node || this.children.some(child => child.contains(node)); };
  proto.remove = function() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(row => row !== this); this.parentElement = null; };
  proto.focus = function() { c.document.activeElement = this; };
  proto.querySelectorAll = function(selector) {
    const match = /^\[data-([a-z-]+)(?:="([^"]*)")?\]$/u.exec(selector); assert.ok(match, 'bounded actual selector: ' + selector);
    const key = match[1].replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
    return walk(this).slice(1).filter(node => Object.hasOwn(node.dataset, key) && (match[2] === undefined || node.dataset[key] === match[2]));
  };
  proto.querySelector = function(selector) { return this.querySelectorAll(selector)[0] || null; };
  c.document.activeElement = c.document.body; c.window.__PRODUCT_PROFILE = SCENE_LANGUAGE_V12;
  c.atlasContinuityLedgerHost = c.document.createElement('section'); c.document.body.append(c.atlasContinuityLedgerHost);
  c.currentAtlasSurface = 'continuity'; c.atlasContinuityLedgerExplicitOpen = true; c.atlasContinuityRequestEpoch = 0;
  c.ATLAS_CONTINUITY_LEDGER_SURFACE_QUERY_ID = 'query.atlasContinuityLedgerSurface';
  c.atlasContinuityLedgerState = await x.pulseRead();
  c.invokeWorkspaceQueryBridge = (id, payload) => x.h.query(id, structuredClone(payload));
  c.normalizePulseHistoryPresentation = (await import('../../src/renderer/pulseHistoryPresentationModel.mjs')).normalizePulseHistoryPresentation;
  const requests = [], statuses = []; c.updateStatusText = value => statuses.push(value);
  c.dispatchUiCommand = async (id, payload) => { requests.push({ id, payload: structuredClone(payload) }); const packet = await x.pulseUi(id, payload); h.packets.push(packet); return packet.result; };
  const actual = name => { const match = new RegExp('^(?:async )?function ' + name + '\\(', 'm').exec(source); assert.ok(match, name);
    const end = source.indexOf('\n}\n', match.index); assert.ok(end > match.index); return source.slice(match.index, end + 2); };
  const sequence = source.match(/^const atlasQueryPublicationSequences = .*;$/m); assert.ok(sequence); vm.runInContext(sequence[0], c);
  for (const match of source.matchAll(/^(?:const|let) (\w*(?:[Pp]ulse|PULSE)\w*) = /gm)) {
    const end = source.indexOf(';\n', match.index); assert.ok(end > match.index && end - match.index < 12000);
    vm.runInContext(source.slice(match.index, end + 1), c);
  }
  const names = ['beginAtlasQueryPublication', 'normalizeAtlasContinuityLedgerSurface', 'refreshAtlasContinuityLedgerSurface', 'reviewSurfaceIsPlainObject',
    ...[...source.matchAll(/^(?:async )?function (\w*[Pp]ulse\w*)\(/gm)].map(match => match[1])];
  vm.runInContext([...new Set(names)].map(actual).join('\n'), c);
  const tasks = []; for (const match of source.matchAll(/^async function (\w*[Pp]ulse\w*)\(/gm)) {
    const run = c[match[1]]; c[match[1]] = (...args) => { const pending = run(...args); tasks.push(pending); return pending; };
  }
  c.renderAtlasContinuityLedgerState = () => { c.atlasContinuityLedgerHost.innerHTML = ''; c.appendPulseHistory(c.atlasContinuityLedgerHost, c.atlasContinuityLedgerState.pulseClaim); };
  c.renderAtlasContinuityLedgerState();
  const button = action => walk(c.atlasContinuityLedgerHost).find(node => node.dataset.pulseHistoryAction === action);
  const text = node => [typeof node.textContent === 'string' ? node.textContent : '', ...node.children.map(text)].join(' ');
  const settle = async () => { await new Promise(setImmediate); let index = 0;
    while (index < tasks.length) { const pending = tasks.slice(index); index = tasks.length; await Promise.all(pending); } };
  const click = async action => { const node = button(action); assert.ok(node, 'actual Pulse ' + action + ' control'); assert.equal(node.disabled, false);
    await node.emit('click'); await settle(); return h.packets.at(-1); };
  return { ...h, button, click, settle, requests, statuses, text: () => text(c.atlasContinuityLedgerHost) };
}

test('Pulse actual native-style control listeners enable Save cold history and disable through registered Main only [FINITE_DOM_NOT_NATIVE]', async t => {
  const x = await pulseMainFixture(t); let r = await pulseMainRenderer(x), before = pulseSnapshot(x);
  const enable = r.button('optIn'); assert.ok(enable, 'read-only Writing history has no explicit opt-in control yet'); enable.focus();
  let packet = await r.click('optIn'); assert.ok(packet?.mainResult); assert.equal(packet.mainResult.ok, true);
  assertPulseConsentFootprint(x, before, pulseSnapshot(x)); assert.equal(r.requests.length, 1);
  assert.deepEqual(r.requests[0], { id: PULSE_LIVE_IDS[0], payload: { projectId: x.projectId, expectedPrivacyRevision: 0, expectedPrivacyStateDigest: (await import('../../src/core/pulse-privacy-v1.mjs')).readPulsePrivacyStateSnapshot(path.join(x.h.userData, 'never-created')).stateDigest } });
  assert.equal(r.c.document.activeElement?.isConnected, true); assert.equal(r.c.document.activeElement?.dataset.pulseHistoryAction, 'optOut');
  before = pulseSnapshot(x); const text = 'Добавлено. ' + EXACT_ATLAS_TEXT + ' От настоящей кнопки.'; await x.save(text);
  const saved = pulseSnapshot(x), receipt = await assertPulseSavedSceneFootprint(x, before, saved, text); assertPulseAggregate(x, (await x.pulseLedger()).entries[0], receipt, saved.scene);
  await r.c.refreshAtlasContinuityLedgerSurface(); assert.match(r.text(), /1 of 1|1.*ревиз/iu);
  assert.equal((await x.h.main.handleProjectLifecycleOpenCommand({ projectId: x.projectId })).ok, true);
  assert.equal((await x.h.main.handleUiOpenDocumentCommand({ projectId: x.projectId, nodeId: x.sceneId })).ok, true);
  r = await pulseMainRenderer(x); assert.match(r.text(), /1 of 1|1.*ревиз/iu);
  before = pulseSnapshot(x); packet = await r.click('optOut'); assert.equal(packet.mainResult.ok, true); assertPulseConsentFootprint(x, before, pulseSnapshot(x));
  assert.equal(r.requests.length, 1); assert.equal(r.requests[0].id, PULSE_LIVE_IDS[1]); assert.match(r.text(), /off|отключ/iu);
  const frozen = x.pulseFiles(); await x.save(text + ' Отключено.'); assert.deepEqual(x.pulseFiles(), frozen);
});

for (const fault of ['doubleclick', 'detached', 'project', 'surface', 'generation']) test('Pulse actual pending listener protects ' + fault + ' and never grants stale presentation authority', async t => {
  const x = await pulseMainFixture(t), r = await pulseMainRenderer(x), node = r.button('optIn'); assert.ok(node, 'actual opt-in control');
  let enter, release; const entered = new Promise(done => { enter = done; }), gate = new Promise(done => { release = done; }); t.after(() => release());
  const held = x.h.main.__host.holdDiskQueue(async () => { enter(); await gate; }); await entered;
  node.emit('click'); await new Promise(setImmediate); assert.equal(r.requests.length, 1); assert.equal(node.disabled, true);
  assert.match(r.text(), /pending|running|выполн|ожидан|сохран/iu, 'disabled pending action has a visible reason');
  if (fault === 'doubleclick') node.emit('click');
  if (fault === 'detached') r.c.atlasContinuityLedgerHost.remove();
  if (fault === 'project') r.c.currentProjectId = 'newer-project';
  if (fault === 'surface') r.c.currentAtlasSurface = 'journey';
  if (fault === 'generation') r.c.localEditGeneration += 1;
  const visible = r.text(), newer = structuredClone(r.c.atlasContinuityLedgerState), statuses = [...r.statuses];
  release(); await held; await r.settle(); assert.equal(r.requests.length, 1);
  assert.equal(x.pulseState().collectionStatus, 'OPTED_IN', 'already admitted current Main effect may finish; stale UI is not a cancellation claim');
  if (fault !== 'doubleclick') { assert.equal(r.text(), visible); assert.deepEqual(r.c.atlasContinuityLedgerState, newer); assert.deepEqual(r.statuses, statuses); }
  else assert.match(r.text(), /empty|recorded|запис|истори/iu);
});

test('Pulse stale real consent token refuses visibly and unavailable read cannot dispatch a default token', async t => {
  const x = await pulseMainFixture(t), r = await pulseMainRenderer(x); assert.ok(r.button('optIn'));
  await x.seedPulse(); const before = pulseSnapshot(x), packet = await r.click('optIn');
  assert.equal(packet.mainResult.ok, false); assert.match(JSON.stringify(packet), /PULSE.*STALE/u); assert.deepEqual(pulseSnapshot(x).roster, before.roster);
  assert.match(r.text() + ' ' + r.statuses.join(' '), /refus|stale|обнов|устар|не удалось/iu);
  r.c.atlasContinuityLedgerState.pulseClaim = { state: 'unavailable', privacy: { collectionStatus: 'OPTED_OUT' }, rows: [] };
  r.c.renderAtlasContinuityLedgerState(); const count = r.requests.length, node = r.button('optIn');
  assert.ok(!node || node.disabled, 'missing CAS never turns into actionable revision0'); if (node) await node.emit('click');
  await r.settle(); assert.equal(r.requests.length, count);
});

test('Pulse explicit commands never silently repair malformed committed history or erase it as fresh state', async t => {
  const x = await pulseMainFixture(t); await x.seedPulse();
  fs.writeFileSync(path.join(x.pulseDirectory, 'pulse-ledger.v1.jsonl'), '{bad}\n');
  for (const id of PULSE_LIVE_IDS) {
    const before = pulseSnapshot(x), result = await x.h.command(id, x.pulsePayload());
    try { assert.equal(result.ok, false); assert.match(JSON.stringify(result), /E_WP801_|PULSE.*(?:INVALID|UNAVAILABLE)/u); }
    finally { assert.deepEqual(pulseSnapshot(x).roster, before.roster); }
  }
});

async function preparePulseDirtyEdit(x, text) {
  const envelope = require('../../src/core/document-content-envelope-v1.cjs');
  const next = envelope.composeDocumentContentFromBase({ baseContent: x.h.editor.content, nextVisibleText: text }); assert.equal(next.ok, true);
  const generation = x.h.editor.generation + 1; x.h.editor = { ...x.h.editor, content: next.content, plainText: text, generation };
  const signal = require('../../src/core/ipc-envelope-v1.cjs').createEnvelope('ui:save-lifecycle-signal-bridge', 'signal.localDirty.set', { state: true, generation });
  assert.equal((await x.h.handlers.get('ui:save-lifecycle-signal-bridge')(x.h.event(), signal)).ok, true);
  return generation;
}

async function pulseSaveOnly(x, text) {
  const generation = await preparePulseDirtyEdit(x, text);
  const packet = await x.ui('cmd.project.save', {}); assert.equal(packet.mainResult.ok, true, JSON.stringify(packet));
  const ack = x.h.sent.filter(([channel, payload]) => channel === 'set-dirty' && payload.ack?.kind === 'SAVED').at(-1)?.[1].ack;
  assert.equal(ack?.savedGeneration, generation); return packet;
}

test('Pulse changed actual Save rereads consent after awaited canonical write and does not collect after existing-Core opt-out', async t => {
  const x = await pulseMainFixture(t), controller = await x.seedPulse(), promises = require('node:fs/promises'), open = promises.open;
  let enter, release, reached = false; const entered = new Promise(done => { enter = done; }), gate = new Promise(done => { release = done; });
  promises.open = async (file, ...args) => {
    const handle = await open(file, ...args);
    if (!reached && args[0] !== 'r' && file.startsWith(x.f.scenePath + '.')) {
      const write = handle.writeFile.bind(handle); handle.writeFile = async (...values) => { const result = await write(...values); reached = true; enter(); await gate; return result; };
    }
    return handle;
  };
  t.after(() => { release(); promises.open = open; }); const before = pulseSnapshot(x), text = 'Добавлено. ' + EXACT_ATLAS_TEXT + ' Согласие отозвано до публикации.';
  const pending = pulseSaveOnly(x, text), first = await Promise.race([entered.then(() => 'reached'), pending.then(() => 'finished')]);
  assert.equal(first, 'reached', 'actual canonical scene write await is reached independently of new Pulse IDs');
  const state = x.pulseState(); await controller.optOut({ schemaVersion: 'yalken.r24.pulsePrivacyCommand.v1', type: 'OPT_OUT', requestId: 'owned-during-save', expectedPrivacyRevision: state.revision });
  const offFiles = x.pulseFiles(); release(); await pending; promises.open = open;
  await assertPulseSavedSceneFootprint(x, before, pulseSnapshot(x), text); assert.equal(reached, true);
  assert.equal((await x.pulseLedger()).sequence, 0); assert.deepEqual(x.pulseFiles(), offFiles);
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_SAVE_AWAIT_CONSENT_OFF', reached, durableSaveAck: true, privacyRevision: x.pulseState().revision }));
});

test('Pulse actual changed Save producer revalidates owner after awaited Pulse temp write while manuscript remains saved', async t => {
  const x = await pulseMainFixture(t); await x.seedPulse(); const promises = require('node:fs/promises'), open = promises.open;
  let enter, release, reached = false; const entered = new Promise(done => { enter = done; }), gate = new Promise(done => { release = done; });
  promises.open = async (file, ...args) => {
    const handle = await open(file, ...args);
    if (!reached && args[0] !== 'r' && file.startsWith(x.pulseDirectory + path.sep)) {
      const write = handle.writeFile.bind(handle); handle.writeFile = async (...values) => { const result = await write(...values); reached = true; enter(); await gate; return result; };
    }
    return handle;
  };
  t.after(() => { release(); promises.open = open; }); const before = pulseSnapshot(x), channels = x.pulseFiles(), text = 'Добавлено. ' + EXACT_ATLAS_TEXT + ' Проверка живого владельца.';
  const pending = pulseSaveOnly(x, text), first = await Promise.race([entered.then(() => 'reached'), pending.then(() => 'finished')]);
  if (first === 'reached') x.h.main.__host.revokeOwner(); release(); await pending; promises.open = open;
  const after = pulseSnapshot(x); await assertPulseSavedSceneFootprint(x, before, after, text);
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_SAVE_PULSE_POST_AWAIT_OWNER', reached, first, durableSaveAck: true }));
  assert.equal(reached, true, 'current Main has no Pulse producer; absent privacy command IDs are not this oracle');
  assert.deepEqual(x.pulseFiles(), channels); assert.equal((await x.pulseLedger()).sequence, 0);
  const last = x.h.sent.filter(([channel]) => channel === 'status-update').at(-1);
  assert.match(JSON.stringify(last), /(?:Pulse|history|истори).*(?:partial|record|не запис|не удалось)/iu);
});

async function seedPulseCapacity(x) {
  const controller = await x.seedPulse(), { canonicalSerialize } = await import('../../src/core/browser-safe-hash.mjs');
  const receipt = x.receiptCodec.createPulseAggregateReceipt({ sourceRevisionOrdinal: 1, generation: 1, aggregates: [{ metricId: 'SCENES_EDITED_COUNT', value: 1 }] });
  await controller.appendReceipt({ expectedPrivacyRevision: 1, idempotencyKey: 'owned-capacity-first', expectedSequence: 0, receipt });
  const parse = name => fs.readFileSync(path.join(x.pulseDirectory, name), 'utf8').trim().split('\n').map(JSON.parse);
  const first = parse('pulse-ledger.v1.jsonl')[0], admission = parse('pulse-ledger-intents.v1.jsonl')[0], effect = parse('pulse-ledger-outbox.v1.jsonl')[0];
  const entries = [], intents = [], outbox = []; let previousEntryDigest = '0'.repeat(64);
  // Owned full-capacity data uses a real Core-produced template; the public
  // immutable reader and real controller verify every channel before Main runs.
  for (let index = 0; index < 4096; index += 1) {
    const transactionDigest = x.hash({ idempotencyKey: 'owned-capacity-' + index });
    const { entryDigest: ignored, ...payload } = first, entry = { ...payload, sequence: index + 1, previousEntryDigest, transactionDigest };
    entry.entryDigest = x.hash(entry); entries.push(entry); previousEntryDigest = entry.entryDigest;
    const intent = { ...admission, transactionDigest, entryDigest: entry.entryDigest, expectedSequence: index, phase: 'ADMITTED', committedSequence: null };
    intents.push(intent, { ...intent, phase: 'COMMITTED', committedSequence: index + 1 });
    outbox.push({ ...effect, transactionDigest, entryDigest: entry.entryDigest, phase: 'PENDING' },
      { ...effect, transactionDigest, entryDigest: entry.entryDigest, phase: 'APPLIED' });
  }
  for (const [name, rows] of [['pulse-ledger.v1.jsonl', entries], ['pulse-ledger-intents.v1.jsonl', intents], ['pulse-ledger-outbox.v1.jsonl', outbox]]) {
    fs.writeFileSync(path.join(x.pulseDirectory, name), rows.map(canonicalSerialize).join('\n') + '\n');
  }
  const before = x.pulseFiles(); assert.equal((await x.pulseLedger()).sequence, 4096);
  assert.equal((await controller.explain()).identity.ledgerSequence, 4096); assert.deepEqual(x.pulseFiles(), before);
  await assert.rejects(() => controller.appendReceipt({ expectedPrivacyRevision: 1, idempotencyKey: 'owned-over-capacity', expectedSequence: 4096, receipt }),
    error => error.code === 'E_WP804_RETENTION_CAPACITY_NO_AUTOCLEANUP'); assert.deepEqual(x.pulseFiles(), before);
  return before;
}

test('Pulse actual canonical Save at real validated capacity retains all history and visibly records no fabricated observation', async t => {
  const x = await pulseMainFixture(t), channels = await seedPulseCapacity(x), before = pulseSnapshot(x), text = 'Добавлено. ' + EXACT_ATLAS_TEXT + ' История заполнена.';
  await pulseSaveOnly(x, text); const after = pulseSnapshot(x); await assertPulseSavedSceneFootprint(x, before, after, text);
  assert.deepEqual(x.pulseFiles(), channels); assert.equal((await x.pulseLedger()).sequence, 4096);
  const last = x.h.sent.filter(([channel]) => channel === 'status-update').at(-1);
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_SAVE_FULL_CAPACITY', saved: true, verifiedExistingRows: 4096, last }));
  assert.match(JSON.stringify(last), /(?:Pulse|history|истори).*(?:capacity|record|заполн|не запис|не удалось)/iu);
});

// ENV-EPOCH-01: whole actual Main/Kernel/owned filesystem and finite UI proof.
// These tests append to the maintained host; none of its existing bodies change.
const ENVIRONMENT_EPOCH_CAPTURE = 'cmd.project.view.captureEnvironmentEpoch';
const ENVIRONMENT_EPOCH_RESTORE = 'cmd.project.view.restoreEnvironmentEpoch';
const ENVIRONMENT_EPOCH_QUERY = 'query.settingsEnvironmentEpochs';
const ENVIRONMENT_EPOCH_FILE = 'design-os-environment-epochs.json';
const ENVIRONMENT_EPOCH_A = Object.freeze({ theme: 'light', wordWrap: true });
const ENVIRONMENT_EPOCH_B = Object.freeze({ theme: 'dark', wordWrap: false });
const environmentEpochDigest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function environmentEpochWait(pending, label) {
  let timer;
  try { return await Promise.race([pending, new Promise((_, reject) => {
    timer = setTimeout(() => reject(Error('owned finite epoch wait timed out: ' + label)), 10000);
  })]); } finally { clearTimeout(timer); }
}

function environmentEpochWholeRoster(h) {
  const rows = [];
  function visit(directory) {
    for (const name of fs.readdirSync(directory).sort()) {
      const file = path.join(directory, name), stat = fs.lstatSync(file), relative = path.relative(h.root, file);
      if (stat.isSymbolicLink()) rows.push([relative, 'symlink:' + fs.readlinkSync(file)]);
      else if (stat.isDirectory()) { rows.push([relative, 'directory']); visit(file); }
      else { assert.equal(stat.isFile(), true); rows.push([relative, environmentEpochDigest(fs.readFileSync(file))]); }
    }
  }
  visit(h.root); return rows;
}

function assertEnvironmentEpochOnlyFile(x, before, after) {
  const relative = path.join('userData', ENVIRONMENT_EPOCH_FILE);
  assert.deepEqual(after.filter(([name]) => name !== relative), before.filter(([name]) => name !== relative),
    'only the fixed shell-epoch container may differ; manuscript history Pulse settings and owner files remain exact');
}

function environmentEpochProtectedAuthorSnapshot(x) {
  const { observedAtMs, roster, ...canonical } = authorIdentitySnapshot(x);
  return { ...canonical, roster: roster.filter(([name]) => name !== path.join('userData', ENVIRONMENT_EPOCH_FILE)) };
}

async function environmentEpochFixture(t) {
  const x = await pulseMainFixture(t);
  x.epochPath = path.join(x.h.userData, ENVIRONMENT_EPOCH_FILE);
  x.epochUi = await fullMacRendererCommandPort(x.h, { allowUnregistered: true });
  x.epochRaw = () => JSON.parse(fs.readFileSync(x.epochPath, 'utf8'));
  x.epochToken = projection => ({ expectedRevision: projection.revision, expectedStateDigest: projection.stateDigest });
  x.epochRead = async (payload = {}) => {
    const before = environmentEpochWholeRoster(x.h), result = await x.h.query(ENVIRONMENT_EPOCH_QUERY, payload);
    assert.deepEqual(environmentEpochWholeRoster(x.h), before, 'the actual query cannot create repair migrate or rewrite a container');
    assert.equal(result.ok, true, JSON.stringify(result));
    const projection = result.settingsEnvironmentEpochs;
    assert.ok(projection, 'actual immutable Main shell-history projection');
    assert.equal(projection.schemaVersion, 'yalken.environmentEpochHistory.v1');
    assert.equal(Number.isSafeInteger(projection.revision), true); assert.match(projection.stateDigest, /^[a-f0-9]{64}$/u);
    assert.equal(projection.epochs.length, projection.revision); assert.ok(projection.epochs.length <= 128);
    assert.equal(Object.hasOwn(projection, 'activeEpochId'), false, 'latest saved is not live preference truth');
    return projection;
  };
  x.epochCapture = async preferences => {
    const current = await x.epochRead(), before = environmentEpochWholeRoster(x.h), startedAt = Date.now();
    const response = await x.epochUi(ENVIRONMENT_EPOCH_CAPTURE, { ...x.epochToken(current), preferences: { ...preferences } });
    assert.ok(response.mainResult, 'actual registered renderer capture must reach Main');
    assert.equal(response.mainResult.ok, true, JSON.stringify(response)); assert.equal(response.result.ok, true);
    const history = x.epochRaw(), last = history.epochs.at(-1);
    assert.equal(history.revision, current.revision + 1); assert.equal(history.configurationSchema, 'THEME_WRAP_V1');
    assert.deepEqual(history.epochs.slice(0, -1), current.epochs); assert.deepEqual(last.preferences, preferences);
    assert.match(last.epochId, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u);
    assert.equal(last.reason, 'CAPTURE'); assert.equal(last.sourceEpochId, null); assert.equal(last.platform, 'macos');
    assert.ok(Date.parse(last.recordedAtUtc) >= startedAt && Date.parse(last.recordedAtUtc) <= Date.now());
    assert.equal(new Date(last.recordedAtUtc).toISOString(), last.recordedAtUtc);
    assertEnvironmentEpochOnlyFile(x, before, environmentEpochWholeRoster(x.h));
    assert.deepEqual((await x.epochRead()).epochs, history.epochs); return { response, history, epoch: last };
  };
  x.epochRestore = async epochId => {
    const current = await x.epochRead(), selected = current.epochs.find(row => row.epochId === epochId); assert.ok(selected);
    const before = environmentEpochWholeRoster(x.h);
    const response = await x.epochUi(ENVIRONMENT_EPOCH_RESTORE, { ...x.epochToken(current), epochId });
    assert.ok(response.mainResult, 'actual registered renderer restore must reach Main');
    assert.equal(response.mainResult.ok, true, JSON.stringify(response)); assert.equal(response.result.ok, true);
    const history = x.epochRaw(), last = history.epochs.at(-1);
    assert.equal(history.revision, current.revision + 1); assert.deepEqual(history.epochs.slice(0, -1), current.epochs);
    assert.equal(last.reason, 'RESTORE'); assert.equal(last.sourceEpochId, epochId); assert.deepEqual(last.preferences, selected.preferences);
    assert.notEqual(last.epochId, epochId); assert.equal(last.platform, 'macos');
    assertEnvironmentEpochOnlyFile(x, before, environmentEpochWholeRoster(x.h)); return { response, history, epoch: last };
  };
  return x;
}

test('ENV epoch actual unchanged guarded Main refuses capture and restore before any filesystem effects; desired A B cold restore requires admission', async t => {
  const x = await environmentEpochFixture(t), before = environmentEpochWholeRoster(x.h);
  const result = await x.h.query(ENVIRONMENT_EPOCH_QUERY, {});
  if (result.ok !== true) {
    // Deliberately invalid CAS probes can never create a successful path when a
    // query is unavailable. They only expose the unchanged actual command fence.
    const capture = await x.h.command(ENVIRONMENT_EPOCH_CAPTURE, { expectedRevision: null, expectedStateDigest: null, preferences: ENVIRONMENT_EPOCH_A });
    const restore = await x.h.command(ENVIRONMENT_EPOCH_RESTORE, { expectedRevision: null, expectedStateDigest: null, epochId: 'unavailable-read-negative-probe' });
    assert.deepEqual(environmentEpochWholeRoster(x.h), before);
    assert.equal(fs.existsSync(x.epochPath), false);
    t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_MAIN_EPOCH_BRIDGE_REFUSAL_BEFORE_EFFECTS', query: result, capture, restore,
      protectedRosterSha256: environmentEpochDigest(JSON.stringify(before)), fullRosterUnchanged: true }));
    assert.equal(capture.ok, true, 'desired persisted versionA is refused by actual Main: ' + JSON.stringify(capture));
    assert.fail('an unavailable query and negative probes cannot supply successful persistence evidence');
  }
  const a = await x.epochCapture(ENVIRONMENT_EPOCH_A), b = await x.epochCapture(ENVIRONMENT_EPOCH_B);
  const coldReadScript = `import fs from 'node:fs';import {decodeEnvironmentEpochHistory} from ${JSON.stringify(require('node:url').pathToFileURL(path.join(ROOT, 'src/renderer/design-os/designOsFormConfiguration.mjs')).href)};const before=fs.readFileSync(process.argv[1]);process.stdout.write(JSON.stringify({pid:process.pid,history:decodeEnvironmentEpochHistory(before),unchanged:before.equals(fs.readFileSync(process.argv[1]))}));`;
  const coldBefore = environmentEpochWholeRoster(x.h), cold = JSON.parse(require('node:child_process').execFileSync(process.execPath,
    ['--input-type=module', '--eval', coldReadScript, x.epochPath], { encoding: 'utf8' }));
  assert.notEqual(cold.pid, process.pid); assert.equal(cold.unchanged, true); assert.deepEqual(cold.history, b.history);
  assert.deepEqual(environmentEpochWholeRoster(x.h), coldBefore);
  const { previewEnvironmentEpoch } = await import('../../src/renderer/design-os/designOsFormConfiguration.mjs');
  assert.deepEqual(previewEnvironmentEpoch(cold.history, a.epoch.epochId).preferences, ENVIRONMENT_EPOCH_A);
  assert.deepEqual(environmentEpochWholeRoster(x.h), coldBefore);
  const restored = await x.epochRestore(a.epoch.epochId);
  assert.deepEqual(restored.history.epochs.slice(0, 2), b.history.epochs);
  assert.deepEqual(restored.history.epochs.map(row => row.preferences), [ENVIRONMENT_EPOCH_A, ENVIRONMENT_EPOCH_B, ENVIRONMENT_EPOCH_A]);
  assertEnvironmentEpochOnlyFile(x, before, environmentEpochWholeRoster(x.h));
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_MAIN_EPOCH_CAPTURE2_FRESH_PROCESS_READ_AND_RESTORE', revisions: [1, 2, 3], coldPid: cold.pid,
    actualEpochIds: restored.history.epochs.map(row => row.epochId), priorRecordsUnchanged: true, protectedRosterUnchanged: true, nativeAcceptance: false }));
});

test('ENV epoch query absence is genuine read-only empty0 and both commands remain FREE under unchanged strict V12', async t => {
  const x = await environmentEpochFixture(t), before = environmentEpochWholeRoster(x.h), current = await x.epochRead();
  assert.equal(current.revision, 0); assert.deepEqual(current.epochs, []); assert.equal(fs.existsSync(x.epochPath), false);
  assert.deepEqual(environmentEpochWholeRoster(x.h), before);
  const active = x.h.main.__profile(); assert.equal(active.profileId, SCENE_LANGUAGE_V12);
  assert.equal(active.admittedCommandIds.length, 34); assert.equal(active.admittedQueryIds.length, 12);
  const entitlement = require('../../src/core/entitlement-law-v1.cjs');
  for (const id of [ENVIRONMENT_EPOCH_CAPTURE, ENVIRONMENT_EPOCH_RESTORE]) {
    assert.equal(entitlement.decideCommandEntitlement(id, entitlement.getProductEntitlementTier()).available, true);
    assert.equal(profile.evaluateWriterLocalCommandAccess({ profile: active, commandId: id }).allowed, true);
  }
  assert.equal(profile.evaluateWriterLocalQueryAccess({ profile: active, queryId: ENVIRONMENT_EPOCH_QUERY }).allowed, true);
  assert.deepEqual(environmentEpochWholeRoster(x.h), before);
});

test('ENV epoch Main accepts two genuine caller values while keeping all pre-existing manuscript author history Pulse and settings bytes', async t => {
  const x = await environmentEpochFixture(t);
  await x.pulseConsent(PULSE_LIVE_IDS[0]); await pulseSaveOnly(x, 'Добавлено. ' + EXACT_ATLAS_TEXT + ' Retain Pulse observation.'); await x.pulseConsent(PULSE_LIVE_IDS[1]);
  const settingsPath = path.join(x.h.userData, 'settings.json'), settings = JSON.parse(fs.readFileSync(settingsPath));
  settings.retainedUnknownEpochTaskField = { value: 'e\u0301 🧭', doNotMigrate: true }; fs.writeFileSync(settingsPath, JSON.stringify(settings));
  const before = environmentEpochWholeRoster(x.h), pulseBefore = x.pulseFiles(), authorBefore = environmentEpochProtectedAuthorSnapshot(x);
  const a = await x.epochCapture(ENVIRONMENT_EPOCH_A), b = await x.epochCapture(ENVIRONMENT_EPOCH_B);
  await x.epochRestore(a.epoch.epochId);
  assert.deepEqual(environmentEpochProtectedAuthorSnapshot(x), authorBefore); assert.deepEqual(x.pulseFiles(), pulseBefore);
  assert.equal((await x.pulseLedger()).sequence, 1); assert.equal(x.pulseState().collectionStatus, 'OPTED_OUT');
  assertEnvironmentEpochOnlyFile(x, before, environmentEpochWholeRoster(x.h));
  assert.deepEqual(x.epochRaw().epochs.slice(0, 2), b.history.epochs);
});

test('ENV epoch actual Main exact raw capture payload rejects path metadata authority and type coercion before effects', async t => {
  const x = await environmentEpochFixture(t), current = await x.epochRead(), valid = { ...x.epochToken(current), preferences: ENVIRONMENT_EPOCH_A };
  const invalid = [null, [], { ...valid, path: x.epochPath }, { ...valid, schemaVersion: 'forged' }, { ...valid, history: [] },
    { ...valid, epochId: crypto.randomUUID() }, { ...valid, recordedAtUtc: new Date().toISOString() }, { ...valid, platform: 'macos' },
    { ...valid, reason: 'CAPTURE' }, { ...valid, projectId: x.projectId }, { ...valid, capability: true }, { ...valid, entitlement: 'pro' },
    { ...valid, preferences: { theme: 'DARK', wordWrap: true } }, { ...valid, preferences: { theme: 'light', wordWrap: 'true' } },
    { ...valid, preferences: { ...ENVIRONMENT_EPOCH_A, content: 'not-a-preference' } },
    { ...valid, expectedRevision: '0' }, { ...valid, expectedStateDigest: '' }, { ...valid, editorMode: 'tiptap' }];
  for (const [i, payload] of invalid.entries()) await t.test('raw-payload-' + i, async () => {
    const before = environmentEpochWholeRoster(x.h), result = await x.h.command(ENVIRONMENT_EPOCH_CAPTURE, payload);
    assert.equal(result.ok, false, JSON.stringify(result)); assert.deepEqual(environmentEpochWholeRoster(x.h), before);
    assert.equal(fs.existsSync(x.epochPath), false);
  });
});

test('ENV epoch actual Main CAS rejects replay stale revision same-revision byte edits and unknown target without a historical rewrite', async t => {
  const x = await environmentEpochFixture(t), empty = await x.epochRead(), a = await x.epochCapture(ENVIRONMENT_EPOCH_A);
  for (const [id, payload] of [
    [ENVIRONMENT_EPOCH_CAPTURE, { ...x.epochToken(empty), preferences: ENVIRONMENT_EPOCH_B }],
    [ENVIRONMENT_EPOCH_CAPTURE, { ...x.epochToken(await x.epochRead()), expectedStateDigest: 'f'.repeat(64), preferences: ENVIRONMENT_EPOCH_B }],
    [ENVIRONMENT_EPOCH_RESTORE, { ...x.epochToken(await x.epochRead()), epochId: crypto.randomUUID() }],
    [ENVIRONMENT_EPOCH_RESTORE, { ...x.epochToken(await x.epochRead()), epochId: a.epoch.epochId, preferences: ENVIRONMENT_EPOCH_B }],
  ]) {
    const before = environmentEpochWholeRoster(x.h), result = await x.h.command(id, payload);
    assert.equal(result.ok, false, JSON.stringify(result)); assert.deepEqual(environmentEpochWholeRoster(x.h), before);
  }
  const stale = await x.epochRead(), changed = x.epochRaw(); changed.epochs[0].preferences = { ...ENVIRONMENT_EPOCH_B };
  fs.writeFileSync(x.epochPath, JSON.stringify(changed)); const changedBefore = environmentEpochWholeRoster(x.h);
  const refused = await x.h.command(ENVIRONMENT_EPOCH_CAPTURE, { ...x.epochToken(stale), preferences: ENVIRONMENT_EPOCH_A });
  assert.equal(refused.ok, false); assert.deepEqual(environmentEpochWholeRoster(x.h), changedBefore);
  assert.notEqual((await x.epochRead()).stateDigest, stale.stateDigest);
});

for (const fault of ['malformed', 'duplicate-root-key', 'unknown-schema', 'invalid-utf8', 'oversized', 'symlink-file', 'directory']) test('ENV epoch Main readonly and command-path preserve actual ' + fault + ' bytes without repair', async t => {
  const x = await environmentEpochFixture(t), token = await x.epochRead();
  const valid = { schemaVersion: 'yalken.designOsEnvironmentEpochHistory.v1', configurationSchema: 'THEME_WRAP_V1', revision: 0, epochs: [] };
  if (fault === 'directory') fs.mkdirSync(x.epochPath);
  else if (fault === 'symlink-file') {
    const outside = path.join(x.h.root, 'retained-foreign-target.json'); fs.writeFileSync(outside, JSON.stringify(valid)); fs.symlinkSync(outside, x.epochPath);
  } else fs.writeFileSync(x.epochPath, fault === 'malformed' ? '{torn:'
    : fault === 'duplicate-root-key' ? JSON.stringify(valid).replace('"revision":0', '"revision":0,"revision":0')
      : fault === 'unknown-schema' ? JSON.stringify({ ...valid, configurationSchema: 'UNRECOGNIZED' })
        : fault === 'invalid-utf8' ? Buffer.from([0x7b, 0xff, 0x7d]) : Buffer.alloc(65537, 32));
  const before = environmentEpochWholeRoster(x.h), query = await x.h.query(ENVIRONMENT_EPOCH_QUERY, {});
  assert.equal(query.ok, false, JSON.stringify(query));
  assert.equal(query.settingsEnvironmentEpochs?.stateDigest, undefined, 'unavailable malformed state cannot supply actionable empty0 CAS');
  assert.deepEqual(environmentEpochWholeRoster(x.h), before);
  for (const [id, payload] of [[ENVIRONMENT_EPOCH_CAPTURE, { ...x.epochToken(token), preferences: ENVIRONMENT_EPOCH_A }],
    [ENVIRONMENT_EPOCH_RESTORE, { ...x.epochToken(token), epochId: crypto.randomUUID() }]]) {
    const result = await x.h.command(id, payload); assert.equal(result.ok, false, JSON.stringify(result));
    assert.deepEqual(environmentEpochWholeRoster(x.h), before);
  }
});

test('ENV epoch Main query accepts no renderer path identity target or repair request', async t => {
  const x = await environmentEpochFixture(t); await x.epochCapture(ENVIRONMENT_EPOCH_A);
  for (const payload of [{ path: x.epochPath }, { repair: true }, { history: [] }, { projectId: x.projectId }, { expectedRevision: 0 }, { epochId: crypto.randomUUID() }]) {
    const before = environmentEpochWholeRoster(x.h), reply = await x.h.query(ENVIRONMENT_EPOCH_QUERY, payload);
    assert.equal(reply.ok, false, JSON.stringify(reply)); assert.deepEqual(environmentEpochWholeRoster(x.h), before);
  }
});

test('ENV epoch actual Main dirty barrier ignores renderer false and only a genuine current Save ACK permits restore', async t => {
  const x = await environmentEpochFixture(t), a = await x.epochCapture(ENVIRONMENT_EPOCH_A); await x.epochCapture(ENVIRONMENT_EPOCH_B);
  const text = 'Добавлено. ' + EXACT_ATLAS_TEXT + ' Unsaved protected authoring e\u0301 🧭.';
  const generation = await preparePulseDirtyEdit(x, text), current = await x.epochRead(), payload = { ...x.epochToken(current), epochId: a.epoch.epochId };
  const before = environmentEpochWholeRoster(x.h), refused = await x.h.command(ENVIRONMENT_EPOCH_RESTORE, payload);
  assert.equal(refused.ok, false); assert.match(JSON.stringify(refused), /(?:DIRTY|AUTHORING|UNSAVED|SAVE_FIRST|GENERATION)/u);
  assert.deepEqual(environmentEpochWholeRoster(x.h), before);
  const falseSignal = require('../../src/core/ipc-envelope-v1.cjs').createEnvelope('ui:save-lifecycle-signal-bridge', 'signal.localDirty.set', { state: false, generation });
  assert.equal((await x.h.handlers.get('ui:save-lifecycle-signal-bridge')(x.h.event(), falseSignal)).ignored, true);
  assert.equal((await x.h.command(ENVIRONMENT_EPOCH_RESTORE, payload)).ok, false);
  assert.deepEqual(environmentEpochWholeRoster(x.h), before);
  const save = await x.ui('cmd.project.save', {}); assert.equal(save.mainResult.ok, true, JSON.stringify(save));
  const ack = x.h.sent.filter(([channel, value]) => channel === 'set-dirty' && value.ack?.kind === 'SAVED').at(-1)?.[1].ack;
  assert.equal(ack.savedGeneration, generation); const savedScene = fs.readFileSync(x.f.scenePath);
  await x.epochRestore(a.epoch.epochId); assert.deepEqual(fs.readFileSync(x.f.scenePath), savedScene);
  assert.equal(x.epochRaw().epochs.length, 3);
});

for (const fault of ['capability', 'entitlement', 'session', 'generation', 'lifecycle', 'project-root', 'owner', 'userData']) test('ENV epoch actual awaited temp write revalidates ' + fault + ' before atomic publication', async t => {
  const x = await environmentEpochFixture(t); await x.epochCapture(ENVIRONMENT_EPOCH_A); const current = await x.epochRead();
  const before = environmentEpochWholeRoster(x.h), promises = require('node:fs/promises'), open = promises.open; let reached = false;
  promises.open = async (file, ...args) => {
    const handle = await open(file, ...args);
    if (!String(file).startsWith(x.epochPath + '.p2-')) return handle;
    return new Proxy(handle, { get(target, key) {
      const value = target[key]; if (typeof value !== 'function') return value;
      if (key !== 'writeFile') return value.bind(target);
      return async (...values) => {
        const result = await value.apply(target, values); reached = true;
        if (fault === 'capability') x.h.main.__host.denyCapability('cap.project.view.openSettings');
        else if (fault === 'entitlement') x.h.main.__host.revokeEntitlement(ENVIRONMENT_EPOCH_CAPTURE);
        else if (fault === 'session') x.h.main.__host.invalidateSession();
        else if (fault === 'generation') x.h.main.__host.invalidateGeneration();
        else if (fault === 'lifecycle') x.h.main.__host.invalidateLifecycle();
        else if (fault === 'project-root') x.h.main.__host.invalidateProjectRoot();
        else if (fault === 'owner') x.h.main.__host.revokeOwner();
        else x.h.main.__host.invalidatePulseUserData();
        return result;
      };
    } });
  };
  let result; try { result = await x.h.command(ENVIRONMENT_EPOCH_CAPTURE, { ...x.epochToken(current), preferences: ENVIRONMENT_EPOCH_B }); }
  finally { promises.open = open; }
  assert.equal(reached, true, 'real unchanged durable transaction must await the owned temp write');
  assert.equal(result.ok, false, JSON.stringify(result)); assert.deepEqual(environmentEpochWholeRoster(x.h), before);
  assert.equal(x.epochRaw().revision, 1); assert.deepEqual(x.epochRaw().epochs, current.epochs);
});

test('ENV epoch actual queued CAS is captured before waiting and rejects a concurrent command without recursion', async t => {
  const x = await environmentEpochFixture(t), current = await x.epochRead(); let enter, release;
  const entered = new Promise(done => { enter = done; }), gate = new Promise(done => { release = done; });
  const held = x.h.main.__host.holdDiskQueue(async () => { enter(); await gate; }); await environmentEpochWait(entered, 'actual disk queue');
  const payload = { ...x.epochToken(current), preferences: ENVIRONMENT_EPOCH_A };
  const first = x.h.command(ENVIRONMENT_EPOCH_CAPTURE, payload), second = x.h.command(ENVIRONMENT_EPOCH_CAPTURE, { ...payload, preferences: ENVIRONMENT_EPOCH_B });
  await new Promise(setImmediate); assert.equal(fs.existsSync(x.epochPath), false); release();
  const [one, two] = await Promise.all([first, second]); await held;
  assert.equal(one.ok, true, JSON.stringify(one)); assert.equal(two.ok, false, JSON.stringify(two));
  assert.equal(x.epochRaw().revision, 1); assert.deepEqual(x.epochRaw().epochs[0].preferences, ENVIRONMENT_EPOCH_A);
});

test('ENV epoch real commit CAS rereads actual valid prior bytes after awaited temp write before rename', async t => {
  const x = await environmentEpochFixture(t); await x.epochCapture(ENVIRONMENT_EPOCH_A); const current = await x.epochRead();
  const promises = require('node:fs/promises'), open = promises.open; let reached = false, concurrentBytes;
  promises.open = async (file, ...args) => {
    const handle = await open(file, ...args); if (!String(file).startsWith(x.epochPath + '.p2-')) return handle;
    return new Proxy(handle, { get(target, key) {
      const value = target[key]; if (typeof value !== 'function') return value;
      if (key !== 'writeFile') return value.bind(target);
      return async (...values) => { const result = await value.apply(target, values); reached = true;
        const concurrent = x.epochRaw(); concurrent.epochs[0].preferences = { ...ENVIRONMENT_EPOCH_B };
        concurrentBytes = JSON.stringify(concurrent); fs.writeFileSync(x.epochPath, concurrentBytes); return result; };
    } });
  };
  let result; try { result = await x.h.command(ENVIRONMENT_EPOCH_CAPTURE, { ...x.epochToken(current), preferences: ENVIRONMENT_EPOCH_B }); }
  finally { promises.open = open; }
  assert.equal(reached, true); assert.equal(result.ok, false, JSON.stringify(result));
  assert.equal(fs.readFileSync(x.epochPath, 'utf8'), concurrentBytes, 'stale caller cannot overwrite a legitimate concurrent state');
  assert.equal(x.epochRaw().revision, 1); assert.equal(fs.readdirSync(x.h.userData).some(name => name.startsWith(ENVIRONMENT_EPOCH_FILE + '.p2-')), false);
});

test('ENV epoch actual post-rename context failure retains published history and reports partial rather than claiming no writes', async t => {
  const x = await environmentEpochFixture(t); await x.epochCapture(ENVIRONMENT_EPOCH_A); const current = await x.epochRead();
  const before = environmentEpochWholeRoster(x.h), promises = require('node:fs/promises'), rename = promises.rename; let reached = false;
  promises.rename = async (from, to, ...args) => {
    const result = await rename(from, to, ...args);
    if (String(to) === x.epochPath) { reached = true; x.h.main.__host.invalidateGeneration(); }
    return result;
  };
  let result; try { result = await x.h.command(ENVIRONMENT_EPOCH_CAPTURE, { ...x.epochToken(current), preferences: ENVIRONMENT_EPOCH_B }); }
  finally { promises.rename = rename; }
  assert.equal(reached, true); assert.equal(result.ok, false, JSON.stringify(result));
  assert.match(JSON.stringify(result), /(?:PARTIAL|partial)/u); assert.match(JSON.stringify(result), /"storageWritten":true/u);
  const actual = x.epochRaw(); assert.equal(actual.revision, 2); assert.deepEqual(actual.epochs.slice(0, 1), current.epochs);
  assert.deepEqual(actual.epochs[1].preferences, ENVIRONMENT_EPOCH_B);
  assertEnvironmentEpochOnlyFile(x, before, environmentEpochWholeRoster(x.h));
  assert.equal(x.h.sent.filter(([channel]) => channel === 'theme-changed').length, 0, 'partial capture cannot emit a UI apply');
});

test('ENV epoch actual failed temp open retains every prior record and all protected files', async t => {
  const x = await environmentEpochFixture(t); await x.epochCapture(ENVIRONMENT_EPOCH_A); const current = await x.epochRead();
  const before = environmentEpochWholeRoster(x.h), promises = require('node:fs/promises'), open = promises.open; let reached = false;
  promises.open = async (file, ...args) => {
    if (String(file).startsWith(x.epochPath + '.p2-')) { reached = true; throw Object.assign(Error('owned temp access refusal'), { code: 'EACCES' }); }
    return open(file, ...args);
  };
  let result; try { result = await x.h.command(ENVIRONMENT_EPOCH_CAPTURE, { ...x.epochToken(current), preferences: ENVIRONMENT_EPOCH_B }); }
  finally { promises.open = open; }
  assert.equal(reached, true); assert.equal(result.ok, false); assert.deepEqual(environmentEpochWholeRoster(x.h), before);
  assert.deepEqual(x.epochRaw().epochs, current.epochs);
});

test('ENV epoch real validated full128 Main refuses capture and restore without trim or oldest-record rewrite', async t => {
  const x = await environmentEpochFixture(t), model = await import('../../src/renderer/design-os/designOsFormConfiguration.mjs');
  assert.equal(typeof model.createEnvironmentEpochHistory, 'function'); let history = model.createEnvironmentEpochHistory();
  for (let n = 0; n < 128; n += 1) history = model.appendEnvironmentEpoch(history, { expectedRevision: n, epochId: crypto.randomUUID(),
    recordedAtUtc: '2026-10-25T12:30:00.000Z', platform: 'macos', reason: 'CAPTURE', sourceEpochId: null,
    preferences: n % 2 ? ENVIRONMENT_EPOCH_B : ENVIRONMENT_EPOCH_A });
  fs.writeFileSync(x.epochPath, JSON.stringify(history)); const current = await x.epochRead(), before = environmentEpochWholeRoster(x.h);
  assert.equal(current.epochs.length, 128);
  for (const [id, payload] of [[ENVIRONMENT_EPOCH_CAPTURE, { ...x.epochToken(current), preferences: ENVIRONMENT_EPOCH_B }],
    [ENVIRONMENT_EPOCH_RESTORE, { ...x.epochToken(current), epochId: history.epochs[0].epochId }]]) {
    const result = await x.h.command(id, payload); assert.equal(result.ok, false, JSON.stringify(result));
    assert.match(JSON.stringify(result), /(?:CAPACITY|RETENTION)/u); assert.deepEqual(environmentEpochWholeRoster(x.h), before);
  }
});

async function installEnvironmentEpochSettingsAggregation(c) {
  const aggregation = await import('../../src/renderer/settings/settingsAggregator.mjs');
  const book = await import('../../src/core/bookProfile.mjs');
  Object.assign(c, aggregation, { normalizeBookProfile: book.normalizeBookProfile, DEFAULT_ACTIVE_BOOK_PROFILE: book.createDefaultBookProfile(),
    activeBookProfileState: book.createDefaultBookProfile(), configuratorBucketState: { activeToolbarProfile: 'minimal' },
    fontSelect: null, weightSelect: null, lineHeightSelect: null, styleSelect: null, currentFontSizePx: 12, editorZoom: 1, settingsSummary: null });
  const source = read('src/renderer/editor.js'), vm = require('node:vm');
  const actual = name => { const match = new RegExp('^(?:async )?function ' + name + '\\(', 'm').exec(source); assert.ok(match, name);
    const end = source.indexOf('\n}\n', match.index); assert.ok(end > match.index); return source.slice(match.index, end + 2); };
  const names = ['getActiveBookProfile', 'normalizeToolbarConfiguratorProfileName', 'getToolbarConfiguratorActiveProfile', 'buildSettingsAggregationSnapshot', 'renderSettingsAggregation'];
  vm.runInContext(names.map(actual).join('\n'), c);
}

async function environmentEpochSettingsRenderer(x, { actualAggregation = false } = {}) {
  const vm = require('node:vm'), source = read('src/renderer/editor.js'), tasks = [], requests = [], statuses = [], packets = [], document = {};
  class Element {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.listeners = {}; this.disabled = false; this.value = ''; }
    get isConnected() { return this === document.body || !!this.parentElement?.isConnected; }
    set innerHTML(value) { assert.equal(value, ''); this.children.forEach(node => { node.parentElement = null; }); this.children = []; }
    append(...nodes) { nodes.forEach(node => this.appendChild(node)); }
    appendChild(node) { node.parentElement = this; this.children.push(node); return node; }
    setAttribute(name, value) { this[name] = value; }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    emit(name) { return this.listeners[name]?.({ target: this }); }
  }
  document.createElement = tag => new Element(tag); document.body = new Element('body');
  assert.equal(x.h.main.__profile().profileId, SCENE_LANGUAGE_V12);
  const c = { document, HTMLElement: Element, window: { __PRODUCT_PROFILE: SCENE_LANGUAGE_V12 }, console,
    currentProjectId: x.projectId, currentDocumentId: x.sceneId, currentTreeContentPublicationId: 'actual-main-scene',
    localEditGeneration: 0, lastAckedGeneration: 0, localDirty: false };
  vm.createContext(c); const renderer = { c, packets };
  const walk = node => [node, ...node.children.flatMap(walk)], proto = c.HTMLElement.prototype;
  proto.replaceChildren = function(...nodes) { this.children.forEach(node => { node.parentElement = null; }); this.children = []; this.append(...nodes); };
  proto.contains = function(node) { return this === node || this.children.some(child => child.contains(node)); };
  proto.remove = function() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(node => node !== this); this.parentElement = null; };
  proto.insertBefore = function(node, next) { const index = this.children.indexOf(next); assert.ok(index >= 0); node.parentElement = this; this.children.splice(index, 0, node); return node; };
  proto.focus = function() { c.document.activeElement = this; };
  proto.querySelectorAll = function(selector) {
    const match = /^\[data-([a-z-]+)(?:="([^"]*)")?\]$/u.exec(selector); assert.ok(match, 'bounded production Settings selector ' + selector);
    const key = match[1].replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
    return walk(this).slice(1).filter(node => Object.hasOwn(node.dataset, key) && (match[2] === undefined || node.dataset[key] === match[2]));
  };
  proto.querySelector = function(selector) { return this.querySelectorAll(selector)[0] || null; };
  Object.defineProperty(proto, 'classList', { configurable: true, get() {
    if (!this.__classes) this.__classes = new Set(); const classes = this.__classes;
    return { add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value),
      toggle: (value, force) => { const add = force === undefined ? !classes.has(value) : force; if (add) classes.add(value); else classes.delete(value); return add; } };
  } });
  c.document.querySelector = selector => c.document.body.querySelector(selector);
  c.document.activeElement = c.document.body;
  c.settingsModal = c.document.createElement('div'); c.settingsModal.hidden = true; c.document.body.append(c.settingsModal);
  c.settingsSections = c.document.createElement('div'); c.settingsModal.append(c.settingsSections);
  const originalAggregationRow = c.document.createElement('div'); originalAggregationRow.textContent = 'Original settings owner row'; c.settingsSections.append(originalAggregationRow);
  c.settingsThemeSelect = c.document.createElement('select'); c.settingsThemeSelect.value = 'light'; c.settingsModal.append(c.settingsThemeSelect);
  c.settingsWrapSelect = c.document.createElement('select'); c.settingsWrapSelect.value = 'on'; c.settingsModal.append(c.settingsWrapSelect);
  c.editor = c.document.createElement('div'); c.editor.style = {}; c.editor.textContent = 'Protected editor e\u0301 🧭'; c.document.body.append(c.editor);
  const editorModel = { doc: { type: 'doc', content: [{ text: c.editor.textContent }] } }, selection = { from: 2, to: 9 };
  c.tiptapEditor = { state: { doc: editorModel.doc, selection } }; c.wordWrapEnabled = true; c.wrapToggleButton = null;
  const storage = new Map(); c.localStorage = { setItem: (key, value) => storage.set(key, String(value)), getItem: key => storage.get(key) || null };
  c.updateThemeSwatches = () => {}; c.updateInspectorSnapshot = () => {}; c.renderSettingsAggregation = () => {};
  c.openSimpleModal = modal => { modal.hidden = false; }; c.closeSimpleModal = modal => { modal.hidden = true; };
  c.updateStatusText = value => statuses.push(String(value)); c.updateWarningStateText = () => {};
  for (const forbidden of ['renderStyledView', 'setTiptapPlainText', 'setTiptapDocumentSnapshot', 'saveCurrentDocument', 'markAsModified', 'clearProjectWorkspaceStorage']) {
    c[forbidden] = () => { assert.fail('shell preference apply called protected writer ' + forbidden); };
  }
  c.invokeWorkspaceQueryBridge = (id, payload = {}) => x.h.query(id, structuredClone(payload));
  c.dispatchUiCommand = async (id, payload) => { requests.push({ id, payload: structuredClone(payload) }); const response = await x.epochUi(id, payload); renderer.packets.push(response); return response.result; };
  const actual = name => { const match = new RegExp('^(?:async )?function ' + name + '\\(', 'm').exec(source); assert.ok(match, name);
    const end = source.indexOf('\n}\n', match.index); assert.ok(end > match.index); return source.slice(match.index, end + 2); };
  for (const match of source.matchAll(/^(?:const|let) (\w*(?:[Ee]nvironment[Ee]poch|ENVIRONMENT_EPOCH)\w*) = /gm)) {
    const end = source.indexOf(';\n', match.index); assert.ok(end > match.index && end - match.index < 12000); vm.runInContext(source.slice(match.index, end + 1), c);
  }
  const names = [...source.matchAll(/^(?:async )?function (\w*[Ee]nvironment[Ee]poch\w*)\(/gm)].map(match => match[1]);
  assert.ok(names.length > 0, 'actual saved Settings functions do not exist before this contour');
  vm.runInContext(['applyTheme', 'applyWordWrap', 'openSettingsModal', ...names].map(actual).join('\n'), c);
  for (const name of names) {
    const match = new RegExp('^async function ' + name + '\\(', 'm').exec(source); if (!match) continue;
    const run = c[name]; c[name] = (...args) => { const pending = run(...args); tasks.push(pending); return pending; };
  }
  const settle = async () => { await new Promise(setImmediate); let cursor = 0;
    while (cursor < tasks.length) { const pending = tasks.slice(cursor); cursor = tasks.length; await Promise.all(pending); } };
  if (actualAggregation) await installEnvironmentEpochSettingsAggregation(c);
  c.openSettingsModal(); await settle();
  const block = () => walk(c.settingsModal).find(node => Object.hasOwn(node.dataset, 'settingsEnvironmentEpochs'));
  assert.ok(block(), 'existing Settings must expose one saved-versions block');
  const button = action => walk(block()).find(node => node.dataset.environmentEpochAction === action);
  const select = () => walk(block()).find(node => Object.hasOwn(node.dataset, 'environmentEpochSelect'));
  const text = node => [typeof node.textContent === 'string' ? node.textContent : '', ...node.children.map(text)].join(' ');
  const click = async action => { const node = button(action); assert.ok(node, 'actual saved Settings ' + action + ' control'); assert.equal(node.disabled, false);
    await node.emit('click'); await settle(); return renderer.packets.at(-1); };
  const choose = async epochId => { const field = select(); assert.ok(field); field.value = epochId; field.focus(); await field.emit('change'); await settle(); };
  return { ...renderer, requests, statuses, tasks, settle, button, select, choose, click, block, text: () => text(block()), storage,
    protectedIdentity: { editor: c.editor, doc: editorModel.doc, selection, text: c.editor.textContent, aggregationRow: originalAggregationRow } };
}

function assertEnvironmentEpochRendererIdentity(renderer) {
  const { c, protectedIdentity: before } = renderer;
  assert.equal(c.editor, before.editor); assert.equal(c.editor.textContent, before.text);
  assert.equal(c.tiptapEditor.state.doc, before.doc); assert.equal(c.tiptapEditor.state.selection, before.selection);
  assert.equal(c.settingsSections.children.includes(before.aggregationRow), true);
  assert.equal(before.aggregationRow.textContent, 'Original settings owner row');
}

test('ENV epoch actual Settings listeners save A and B preview without writes restore A and preserve focused controls editor model selection and history [FINITE_DOM_NOT_NATIVE]', async t => {
  const x = await environmentEpochFixture(t), r = await environmentEpochSettingsRenderer(x), c = r.c;
  const before = environmentEpochWholeRoster(x.h); await r.click('capture'); const a = x.epochRaw();
  c.applyTheme('dark'); c.applyWordWrap(false); c.settingsThemeSelect.value = 'dark'; c.settingsWrapSelect.value = 'off';
  await r.click('capture'); const b = x.epochRaw(); assert.equal(b.revision, 2);
  const field = r.select(); await r.choose(a.epochs[0].epochId); const selectedBefore = field.value;
  const previewBefore = environmentEpochWholeRoster(x.h), requests = r.requests.length; await r.click('preview');
  assert.deepEqual(environmentEpochWholeRoster(x.h), previewBefore); assert.equal(r.requests.length, requests);
  assert.equal(c.document.body.classList.contains('dark-theme'), true); assert.equal(c.wordWrapEnabled, false);
  assert.equal(r.select(), field); assert.equal(field.value, selectedBefore); assert.equal(c.document.activeElement, field);
  assert.match(r.text(), /(?:light|Light|светл)/iu); assert.match(r.text(), /(?:wrap|Wrap|перенос)/iu);
  const status = walkEnvironmentEpoch(r.block()).find(node => node['aria-live'] === 'polite' || node.role === 'status'); assert.ok(status, 'polite native saved-version status');
  await r.click('restore'); const restored = x.epochRaw();
  assert.equal(restored.revision, 3); assert.deepEqual(restored.epochs.slice(0, 2), b.epochs); assert.equal(restored.epochs[2].sourceEpochId, a.epochs[0].epochId);
  assert.equal(c.document.body.classList.contains('dark-theme'), false); assert.equal(c.wordWrapEnabled, true);
  assert.equal(r.storage.get('editorTheme'), 'light'); assert.equal(r.storage.get('editorWordWrap'), 'on');
  assert.deepEqual(r.requests.map(row => row.id), [ENVIRONMENT_EPOCH_CAPTURE, ENVIRONMENT_EPOCH_CAPTURE, ENVIRONMENT_EPOCH_RESTORE]);
  assertEnvironmentEpochRendererIdentity(r); assertEnvironmentEpochOnlyFile(x, before, environmentEpochWholeRoster(x.h));
});

const walkEnvironmentEpoch = node => [node, ...node.children.flatMap(walkEnvironmentEpoch)];

for (const stale of ['scene', 'project', 'publication', 'generation', 'modal', 'selection', 'detached']) test('ENV epoch actual pending restore cannot apply a late ' + stale + ' result [FINITE_DOM_NOT_NATIVE]', async t => {
  const x = await environmentEpochFixture(t), r = await environmentEpochSettingsRenderer(x), c = r.c;
  await r.click('capture'); const first = x.epochRaw().epochs[0]; c.applyTheme('dark'); c.applyWordWrap(false); await r.click('capture');
  await r.choose(first.epochId);
  const dispatch = c.dispatchUiCommand; let enter, release;
  const entered = new Promise(done => { enter = done; }), gate = new Promise(done => { release = done; });
  c.dispatchUiCommand = async (...args) => { const response = await dispatch(...args); enter(); await gate; return response; };
  const oldCount = r.requests.length, control = r.button('restore'), nativeInput = control.emit('click');
  try { await environmentEpochWait(entered, 'actual committed restore transport'); } catch (error) { release(); throw error; }
  assert.equal(control.disabled, true, 'pending restore excludes duplicate native input'); const duplicateInput = control.emit('click');
  assert.equal(r.requests.length, oldCount + 1);
  if (stale === 'scene') c.currentDocumentId = 'foreign-scene';
  else if (stale === 'project') c.currentProjectId = 'foreign-project';
  else if (stale === 'publication') c.currentTreeContentPublicationId = 'new-publication';
  else if (stale === 'generation') { c.localEditGeneration += 1; c.localDirty = true; }
  else if (stale === 'modal') c.settingsModal.hidden = true;
  else if (stale === 'selection') r.select().value = x.epochRaw().epochs[1].epochId;
  else r.block().remove();
  release(); await nativeInput; await duplicateInput; await r.settle();
  assert.equal(c.document.body.classList.contains('dark-theme'), true); assert.equal(c.wordWrapEnabled, false);
  assert.equal(x.epochRaw().revision, 3, 'already published history remains readable and retained after a stale UI completion');
  assertEnvironmentEpochRendererIdentity(r);
});

test('ENV epoch actual partial restore is shown inline without applying historical preferences or deleting the published record [FINITE_DOM_NOT_NATIVE]', async t => {
  const x = await environmentEpochFixture(t), r = await environmentEpochSettingsRenderer(x), c = r.c;
  await r.click('capture'); const first = x.epochRaw().epochs[0]; c.applyTheme('dark'); c.applyWordWrap(false); await r.click('capture'); await r.choose(first.epochId);
  const promises = require('node:fs/promises'), rename = promises.rename; let reached = false;
  promises.rename = async (from, to, ...args) => { const result = await rename(from, to, ...args);
    if (String(to) === x.epochPath) { reached = true; x.h.main.__host.invalidateGeneration(); } return result; };
  try { await r.click('restore'); } finally { promises.rename = rename; }
  assert.equal(reached, true); assert.equal(x.epochRaw().revision, 3);
  assert.equal(c.document.body.classList.contains('dark-theme'), true); assert.equal(c.wordWrapEnabled, false);
  assert.match(r.text() + ' ' + r.statuses.join(' '), /(?:PARTIAL|partial|частич)/u); assertEnvironmentEpochRendererIdentity(r);
});

test('ENV epoch restore rechecks actual Main dirty risk after awaited temp write even without a newer generation', async t => {
  const x = await environmentEpochFixture(t), a = await x.epochCapture(ENVIRONMENT_EPOCH_A); await x.epochCapture(ENVIRONMENT_EPOCH_B);
  const current = await x.epochRead(), before = environmentEpochWholeRoster(x.h), promises = require('node:fs/promises'), open = promises.open; let reached = false;
  promises.open = async (file, ...args) => {
    const handle = await open(file, ...args); if (!String(file).startsWith(x.epochPath + '.p2-')) return handle;
    return new Proxy(handle, { get(target, key) {
      const value = target[key]; if (typeof value !== 'function') return value;
      if (key !== 'writeFile') return value.bind(target);
      return async (...values) => { const result = await value.apply(target, values); reached = true;
        const signal = require('../../src/core/ipc-envelope-v1.cjs').createEnvelope('ui:save-lifecycle-signal-bridge', 'signal.localDirty.set', { state: true, generation: 0 });
        assert.equal((await x.h.handlers.get('ui:save-lifecycle-signal-bridge')(x.h.event(), signal)).ok, true); return result; };
    } });
  };
  let result; try { result = await x.h.command(ENVIRONMENT_EPOCH_RESTORE, { ...x.epochToken(current), epochId: a.epoch.epochId }); }
  finally { promises.open = open; }
  assert.equal(reached, true); assert.equal(result.ok, false, JSON.stringify(result));
  assert.deepEqual(environmentEpochWholeRoster(x.h), before); assert.equal(x.epochRaw().revision, 2);
});

test('ENV epoch actual saved restore refuses a late valid prior-record digest change while retaining committed history and editor identity [FINITE_DOM_NOT_NATIVE]', async t => {
  const x = await environmentEpochFixture(t), r = await environmentEpochSettingsRenderer(x), c = r.c;
  await r.click('capture'); const first = x.epochRaw().epochs[0];
  c.applyTheme('dark'); c.applyWordWrap(false); await r.click('capture'); await r.choose(first.epochId);
  const before = environmentEpochWholeRoster(x.h), original = x.epochRaw(), applied = [];
  const theme = c.applyTheme, wrap = c.applyWordWrap;
  c.applyTheme = (...args) => { applied.push(['theme', ...args]); return theme(...args); };
  c.applyWordWrap = (...args) => { applied.push(['wrap', ...args]); return wrap(...args); };
  const dispatch = c.dispatchUiCommand, query = c.invokeWorkspaceQueryBridge;
  let committed, committedBytes, changedBytes, saved, fresh;
  c.dispatchUiCommand = async (...args) => {
    const response = await dispatch(...args); assert.equal(args[0], ENVIRONMENT_EPOCH_RESTORE);
    assert.equal(response.ok, true, JSON.stringify(response)); assert.equal(r.packets.at(-1).mainResult.ok, true);
    saved = response.value.result; committedBytes = fs.readFileSync(x.epochPath); committed = JSON.parse(committedBytes);
    assert.equal(committed.revision, 3); assert.deepEqual(committed.epochs.slice(0, 2), original.epochs);
    assert.deepEqual(committed.epochs.at(-1), saved.epoch); assert.equal(saved.epoch.sourceEpochId, first.epochId);
    assert.equal(environmentEpochDigest(committedBytes), saved.settingsEnvironmentEpochs.stateDigest);
    const changed = structuredClone(committed);
    assert.equal(changed.epochs[1].reason, 'CAPTURE'); assert.notEqual(changed.epochs[1].epochId, first.epochId);
    changed.epochs[1].preferences.wordWrap = true;
    changedBytes = Buffer.from(JSON.stringify(changed) + '\n');
    fs.writeFileSync(x.epochPath, changedBytes); // Owned test actor, after real Main commit and before the fresh query.
    return response;
  };
  c.invokeWorkspaceQueryBridge = async (...args) => { fresh = await query(...args); return fresh; };
  await r.click('restore');
  assert.ok(committed && saved && fresh); assert.equal(fresh.ok, true, JSON.stringify(fresh));
  const current = fresh.settingsEnvironmentEpochs, history = x.epochRaw();
  assert.equal(current.revision, saved.settingsEnvironmentEpochs.revision); assert.equal(current.revision, 3);
  assert.deepEqual(current.epochs.at(-1), saved.epoch, 'the entire latest committed record remains equal');
  assert.notEqual(current.stateDigest, saved.settingsEnvironmentEpochs.stateDigest, 'only a fresh actual digest detects the other valid prior-record edit');
  assert.equal(current.stateDigest, environmentEpochDigest(changedBytes));
  assert.deepEqual(fs.readFileSync(x.epochPath), changedBytes, 'UI refusal cannot roll back or delete the actual commit or the owned external edit');
  assert.deepEqual(history.epochs[0], original.epochs[0]); assert.deepEqual(history.epochs.at(-1), committed.epochs.at(-1));
  assert.deepEqual(applied, [], 'neither preference helper may run after the digest changed');
  assert.equal(c.document.body.classList.contains('dark-theme'), true); assert.equal(c.wordWrapEnabled, false);
  assert.equal(r.storage.get('editorTheme'), 'dark'); assert.equal(r.storage.get('editorWordWrap'), 'off');
  assert.match(r.text(), /(?:partial|recorded|Reopen Settings)/u);
  assertEnvironmentEpochRendererIdentity(r); assertEnvironmentEpochOnlyFile(x, before, environmentEpochWholeRoster(x.h));
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_MAIN_RESTORE_COMMITTED_THEN_VALID_PRIOR_CAPTURE_BYTES_CHANGED_BEFORE_FRESH_QUERY',
    revision: current.revision, latestEpochId: saved.epoch.epochId, committedDigest: environmentEpochDigest(committedBytes),
    freshDigest: current.stateDigest, completeLatestRecordEqual: true, preferenceHelperCalls: applied.length, finiteDomNotNative: true }));
});

for (const outcome of ['restore', 'stale', 'partial']) test('ENV epoch actual production aggregation rows follow guarded restore only and retain saved controls ' + outcome + ' [FINITE_DOM_NOT_NATIVE]', async t => {
  const x = await environmentEpochFixture(t), r = await environmentEpochSettingsRenderer(x, { actualAggregation: true }), c = r.c;
  const walk = node => [node, ...node.children.flatMap(walk)];
  const rows = () => Object.fromEntries([['theme', 'appearance.theme'], ['wordWrap', 'editor.wordWrap']].map(([key, id]) => {
    const row = walk(c.settingsSections).find(node => node.dataset.settingsId === id); assert.ok(row, id);
    const value = walk(row).find(node => node.className === 'settings-surface__row-value'); assert.ok(value, id); return [key, value.textContent];
  }));
  const model = () => { const snapshot = c.buildSettingsAggregationSnapshot(); assert.equal(snapshot.createsStore, false);
    return Object.fromEntries([['theme', 'appearance.theme'], ['wordWrap', 'editor.wordWrap']].map(([key, id]) => [key, snapshot.settings.find(row => row.id === id).value])); };
  assert.deepEqual(rows(), { theme: 'Light', wordWrap: 'On' });
  const before = environmentEpochWholeRoster(x.h), author = environmentEpochProtectedAuthorSnapshot(x), pulse = x.pulseFiles();
  const host = r.block(), select = r.select(); await r.click('capture'); const a = x.epochRaw();
  c.applyTheme('dark'); c.applyWordWrap(false); c.settingsThemeSelect.value = 'dark'; c.settingsWrapSelect.value = 'off'; c.renderSettingsAggregation();
  assert.equal(r.block(), host); assert.equal(r.select(), select); assert.deepEqual(rows(), { theme: 'Dark', wordWrap: 'Off' });
  await r.click('capture'); const b = x.epochRaw(); await r.choose(a.epochs[0].epochId);
  const previewBefore = environmentEpochWholeRoster(x.h), requests = r.requests.length; await r.click('preview');
  assert.deepEqual(environmentEpochWholeRoster(x.h), previewBefore); assert.equal(r.requests.length, requests);
  let refreshes = 0, faultReached = outcome === 'restore'; const render = c.renderSettingsAggregation;
  c.renderSettingsAggregation = (...args) => { refreshes++; return render(...args); };
  const promises = require('node:fs/promises'), rename = promises.rename;
  if (outcome === 'stale') { const dispatch = c.dispatchUiCommand;
    c.dispatchUiCommand = async (...args) => { const result = await dispatch(...args); faultReached = true; c.currentDocumentId = 'owned-other-scene'; return result; }; }
  if (outcome === 'partial') promises.rename = async (from, to, ...args) => { const result = await rename(from, to, ...args);
    if (String(to) === x.epochPath) { faultReached = true; x.h.main.__host.invalidateGeneration(); } return result; };
  try { await r.click('restore'); } finally { promises.rename = rename; }
  assert.equal(faultReached, true); const history = x.epochRaw();
  assert.equal(history.revision, 3); assert.deepEqual(history.epochs.slice(0, 2), b.epochs);
  assert.equal(history.epochs.at(-1).sourceEpochId, a.epochs[0].epochId); assert.deepEqual(history.epochs.at(-1).preferences, ENVIRONMENT_EPOCH_A);
  const packet = r.packets.at(-1); assert.ok(packet.mainResult); assert.equal(packet.mainResult.ok, outcome !== 'partial');
  if (outcome === 'partial') assert.match(JSON.stringify(packet), /E_ENVIRONMENT_EPOCH_PARTIAL/u);
  assert.equal(r.block(), host); assert.equal(r.select(), select); assert.equal(c.document.activeElement, select);
  assert.equal(c.editor, r.protectedIdentity.editor); assert.equal(c.editor.textContent, r.protectedIdentity.text);
  assert.equal(c.tiptapEditor.state.doc, r.protectedIdentity.doc); assert.equal(c.tiptapEditor.state.selection, r.protectedIdentity.selection);
  assert.deepEqual(environmentEpochProtectedAuthorSnapshot(x), author); assert.deepEqual(x.pulseFiles(), pulse);
  assertEnvironmentEpochOnlyFile(x, before, environmentEpochWholeRoster(x.h));
  const expected = outcome === 'restore' ? { theme: 'Light', wordWrap: 'On' } : { theme: 'Dark', wordWrap: 'Off' };
  assert.deepEqual(model(), expected); assert.equal(c.settingsThemeSelect.value, outcome === 'restore' ? 'light' : 'dark');
  assert.equal(c.settingsWrapSelect.value, outcome === 'restore' ? 'on' : 'off');
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_MAIN_RESTORE_AND_PRODUCTION_SETTINGS_READ_MODEL_DOM', outcome, historyRevision: history.revision,
    readModel: model(), domRows: rows(), refreshes, savedHostSelectEditorPreserved: true, finiteDomNotNative: true }));
  assert.deepEqual(rows(), expected, 'actual rendered settings rows must follow the current guarded apply');
  assert.equal(refreshes, outcome === 'restore' ? 1 : 0, 'stale and partial completions cannot refresh or apply the historic preferences');
});

// THEME-SUMMARY: append-only actual command/effect timing and no-loss proof.
const THEME_SUMMARY_COMMAND_ID = 'cmd.ui.theme.set';

function themeSummaryDeferred() {
  let release, done = false;
  const promise = new Promise(resolve => { release = resolve; });
  return { promise, release: () => { if (!done) { done = true; release(); } } };
}

function themeSummaryActual(source, name) {
  const match = new RegExp('^(?:async )?function ' + name + '\\(', 'm').exec(source); assert.ok(match, name);
  const end = source.indexOf('\n}\n', match.index); assert.ok(end > match.index); return source.slice(match.index, end + 2);
}

function themeSummaryRegistration(source, marker) {
  const start = source.indexOf(marker), end = source.indexOf('\n}\n', start);
  assert.ok(start >= 0 && end > start, marker); assert.equal(source.indexOf(marker, start + 1), -1);
  return source.slice(start, end + 2);
}

async function themeSummaryFixture(t, { unsaved = false } = {}) {
  const commands = [], arrivals = [], replies = [], packets = [];
  let mainGate = null, holdDelivery = false, actualCallback = null, originalSend = null, x, r, c;
  const releaseMain = () => mainGate?.release.release();
  const deliver = () => {
    holdDelivery = false;
    for (const packet of packets) if (!packet.delivered) {
      assert.equal(typeof actualCallback, 'function'); packet.delivered = true;
      assert.deepEqual(x.h.sent[packet.sentIndex], [packet.channel, packet.payload], 'deliver only the packet emitted by actual Main');
      actualCallback(packet.payload);
      packet.appliedBody = c.document.body.classList.contains('dark-theme') ? 'dark' : 'light';
    }
  };
  t.after(async () => {
    releaseMain();
    try { await Promise.allSettled(commands.map(row => row.promise)); deliver(); }
    finally { if (originalSend) x.h.window.webContents.send = originalSend; }
  });
  x = await environmentEpochFixture(t);
  await x.pulseConsent(PULSE_LIVE_IDS[1]);
  await x.epochCapture(ENVIRONMENT_EPOCH_A); // Genuine existing manual capture; the Theme effect must not append another.
  r = await environmentEpochSettingsRenderer(x, { actualAggregation: true }); c = r.c;
  const source = read('src/renderer/editor.js'), vm = require('node:vm');
  const registryModule = await import('../../src/renderer/commands/registry.mjs');
  const projectModule = await import('../../src/renderer/commands/projectCommands.mjs');
  const runnerModule = await import('../../src/renderer/commands/runCommand.mjs');
  const busModule = await import('../../src/renderer/commands/commandBusGuard.mjs');
  c.UI_COMMAND_IDS = projectModule.UI_COMMAND_IDS; c.isTiptapMode = true; c.COMMAND_BUS_ROUTE = busModule.COMMAND_BUS_ROUTE;
  c.runCommandThroughBus = busModule.runCommandThroughBus;
  c.uiErrorMap = { index: new Map(), defaultUserMessage: 'Command unavailable' }; c.UI_ERROR_FALLBACK_SEVERITY = 'INFO';
  c.window.electronAPI = {
    onThemeChanged: callback => { assert.equal(actualCallback, null); actualCallback = callback; },
    invokeUiCommandBridge: async request => {
      assert.equal(request.commandId, THEME_SUMMARY_COMMAND_ID);
      const arrival = { request: structuredClone(request), reachedMain: false }; arrivals.push(arrival);
      const gate = mainGate;
      if (gate) { gate.entered.release(); await gate.release.promise; }
      else await Promise.resolve(); // Real IPC is asynchronous; never permit a synchronous fake application.
      arrival.reachedMain = true;
      const result = await x.h.command(request.commandId, structuredClone(request.payload));
      replies.push({ request: structuredClone(request), result }); return result;
    },
  };
  const registry = registryModule.createCommandRegistry();
  projectModule.registerProjectCommands(registry, { electronAPI: c.window.electronAPI,
    uiActions: { setTheme: input => c.handleUiSetThemeCommand(input) } });
  c.runCommand = runnerModule.createCommandRunner(registry, { capability: { platformId: 'node', editorMode: 'tiptap' } });
  const functions = ['withEditorModeCommandPayload', 'dispatchUiCommand', 'invokePreloadUiCommandBridge', 'handleUiSetThemeCommand', 'mapCommandErrorToUi'];
  vm.runInContext(functions.map(name => themeSummaryActual(source, name)).join('\n'), c);
  const dispatch = c.dispatchUiCommand;
  c.dispatchUiCommand = (...args) => { const promise = dispatch(...args); commands.push({ id: args[0], promise }); return promise; };
  originalSend = x.h.window.webContents.send;
  x.h.window.webContents.send = function(channel, payload) {
    const result = originalSend.call(this, channel, payload);
    if (channel === 'theme-changed') {
      packets.push({ channel, payload, sentIndex: x.h.sent.length - 1, delivered: false });
      if (!holdDelivery) deliver();
    }
    return result;
  };
  vm.runInContext(themeSummaryRegistration(source, 'if (window.electronAPI) {\n  window.electronAPI.onThemeChanged('), c);
  vm.runInContext(themeSummaryRegistration(source, "if (settingsThemeSelect) {\n  settingsThemeSelect.addEventListener('change'"), c);
  const child = c.document.createElement('span'); child.textContent = 'Retained child e\u0301 🧭'; c.editor.append(child);
  if (unsaved) {
    const text = 'Unsaved author text e\u0301 🧭 must remain'; c.editor.textContent = text; child.textContent = text;
    c.tiptapEditor.state.doc.content[0].text = text; c.localDirty = true; c.localEditGeneration = 7; c.lastAckedGeneration = 0;
    x.h.editor = { content: text, generation: 7 };
    const signal = require('../../src/core/ipc-envelope-v1.cjs').createEnvelope('ui:save-lifecycle-signal-bridge', 'signal.localDirty.set', { state: true, generation: 7 });
    assert.equal((await x.h.handlers.get('ui:save-lifecycle-signal-bridge')(x.h.event(), signal)).ok, true);
  }
  c.settingsThemeSelect.focus();
  const themeRow = () => {
    const row = walkEnvironmentEpoch(c.settingsSections).find(node => node.dataset.settingsId === 'appearance.theme'); assert.ok(row);
    const value = walkEnvironmentEpoch(row).find(node => node.className === 'settings-surface__row-value'); assert.ok(value);
    return { row, value: value.textContent };
  };
  return { x, r, c, commands, arrivals, replies, packets, themeRow,
    body: () => c.document.body.classList.contains('dark-theme') ? 'dark' : 'light',
    gateMain: () => { assert.equal(mainGate, null); mainGate = { entered: themeSummaryDeferred(), release: themeSummaryDeferred() };
      return { entered: mainGate.entered.promise, release: releaseMain }; },
    holdDelivery: () => { holdDelivery = true; }, deliver,
    change: value => { c.settingsThemeSelect.value = value; const count = commands.length; c.settingsThemeSelect.emit('change');
      assert.equal(commands.length, count + 1, 'actual native listener must dispatch'); return commands.at(-1).promise; },
  };
}

function themeSummaryRemember(f) {
  const { x, r, c } = f;
  assert.ok(c.editor.children.length > 0, 'a nonempty editor child identity oracle');
  assert.ok(Object.keys(x.pulseFiles()).length > 0, 'actual pre-existing Pulse bytes');
  return { roster: environmentEpochWholeRoster(x.h), author: environmentEpochProtectedAuthorSnapshot(x), pulse: x.pulseFiles(),
    journal: fs.readFileSync(x.epochPath), epochs: x.epochRaw().epochs, editor: c.editor, doc: c.tiptapEditor.state.doc,
    docJson: JSON.stringify(c.tiptapEditor.state.doc), selection: c.tiptapEditor.state.selection, text: c.editor.textContent,
    children: [...c.editor.children], childText: c.editor.children.map(node => node.textContent), host: r.block(), select: r.select(),
    selected: r.select().value, focus: c.document.activeElement, dirty: c.localDirty, generation: c.localEditGeneration,
    mainEditor: structuredClone(x.h.editor) };
}

function assertThemeSummaryNoLoss(f, before) {
  const { x, r, c } = f;
  assert.deepEqual(environmentEpochWholeRoster(x.h), before.roster, 'ordinary Theme cannot Save, capture epochs or alter any owned filesystem member');
  assert.deepEqual(environmentEpochProtectedAuthorSnapshot(x), before.author); assert.deepEqual(x.pulseFiles(), before.pulse);
  assert.deepEqual(fs.readFileSync(x.epochPath), before.journal); assert.deepEqual(x.epochRaw().epochs, before.epochs);
  assert.equal(c.editor, before.editor); assert.equal(c.tiptapEditor.state.doc, before.doc); assert.equal(JSON.stringify(c.tiptapEditor.state.doc), before.docJson);
  assert.equal(c.tiptapEditor.state.selection, before.selection); assert.equal(c.editor.textContent, before.text);
  assert.equal(c.editor.children.length, before.children.length);
  c.editor.children.forEach((child, index) => { assert.equal(child, before.children[index]); assert.equal(child.textContent, before.childText[index]); });
  assert.equal(r.block(), before.host); assert.equal(r.select(), before.select); assert.equal(r.select().value, before.selected);
  assert.equal(c.document.activeElement, before.focus); assert.equal(c.localDirty, before.dirty); assert.equal(c.localEditGeneration, before.generation);
  assert.deepEqual(x.h.editor, before.mainEditor);
  assert.ok(f.commands.every(row => row.id === THEME_SUMMARY_COMMAND_ID));
}

function assertThemeSummaryApplied(f, t, label) {
  assert.equal(f.replies.length, 1); assert.equal(f.replies[0].result.ok, true, JSON.stringify(f.replies));
  assert.deepEqual(f.replies[0].result.value, { ok: true }, 'actual Main bridge result is not an applied-state receipt');
  assert.equal(f.packets.length, 1); assert.equal(f.packets[0].delivered, true); assert.equal(f.packets[0].payload, 'dark');
  assert.equal(f.packets[0].appliedBody, 'dark'); assert.equal(f.body(), 'dark');
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_THEME_COMMAND_REPLY_TRUE_MAIN_PACKET_APPLIED', label,
    mainResult: f.replies[0].result, packet: f.packets[0], actualBody: f.body(), actualThemeRow: f.themeRow().value,
    finiteDomNotNative: true, durableThemeReceiptClaim: false }));
}

test('THEME summary delayed actual Main invocation refreshes the applied Theme row and retains unsaved authoring', async t => {
  const f = await themeSummaryFixture(t, { unsaved: true }), before = themeSummaryRemember(f), gate = f.gateMain();
  const pending = f.change('dark');
  try {
    await environmentEpochWait(gate.entered, 'actual Theme adapter before Main');
    assert.equal(f.arrivals[0].reachedMain, false); assert.equal(f.replies.length, 0); assert.equal(f.packets.length, 0);
    assert.equal(f.body(), 'light'); assert.equal(f.themeRow().value, 'Light'); assertThemeSummaryNoLoss(f, before);
    gate.release(); await pending;
    assertThemeSummaryApplied(f, t, 'DELAYED_ACTUAL_MAIN_INVOCATION'); assertThemeSummaryNoLoss(f, before);
    assert.equal(f.themeRow().value, 'Dark', 'desired Theme row must follow the real applied Main event without a Wrap input');
  } finally { gate.release(); await pending; }
});

test('THEME summary true Main reply before held genuine push cannot substitute for actual application', async t => {
  const f = await themeSummaryFixture(t, { unsaved: true }), before = themeSummaryRemember(f); f.holdDelivery();
  try {
    const result = await f.change('dark'); assert.equal(result.ok, true); assert.equal(f.replies[0].result.ok, true);
    assert.equal(f.packets.length, 1); assert.equal(f.packets[0].delivered, false);
    assert.equal(f.body(), 'light'); assert.equal(f.themeRow().value, 'Light'); assertThemeSummaryNoLoss(f, before);
    f.deliver(); assertThemeSummaryApplied(f, t, 'REAL_REPLY_BEFORE_HELD_TRUE_PUSH'); assertThemeSummaryNoLoss(f, before);
    assert.equal(f.themeRow().value, 'Dark', 'an await-only listener fix cannot replace refresh after the actual Theme application');
  } finally { f.deliver(); }
});

test('THEME summary controlled actual Main ENT0 denial emits no Theme and preserves state despite outer ui-action ok', async t => {
  const f = await themeSummaryFixture(t, { unsaved: true }), before = themeSummaryRemember(f);
  assert.equal(require('../../src/core/entitlement-law-v1.cjs').decideCommandEntitlement(THEME_SUMMARY_COMMAND_ID).available, true, 'real FREE policy permits Theme');
  f.x.h.main.__host.revokeEntitlement(THEME_SUMMARY_COMMAND_ID); const result = await f.change('dark');
  assert.equal(f.replies.length, 1); const reply = f.replies[0].result;
  assert.equal(reply.ok, false); assert.equal(reply.value.code, 'E_COMMAND_DISABLED_FOR_ENTITLEMENT');
  assert.equal(reply.value.reason, 'SYNTHETIC_SELECTED_ENTITLEMENT_REVOKED'); assert.equal(f.packets.length, 0);
  assert.equal(result.ok, true); assert.equal(result.value.result.performed, false, 'outer ui-action ok is not apply evidence');
  assert.equal(f.body(), 'light'); assert.equal(f.themeRow().value, 'Light'); assertThemeSummaryNoLoss(f, before);
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_MAIN_CONTROLLED_ENT0_REFUSAL_NO_PUSH', reply, outerResult: result, controlledPortRevocationNotRealFreeTierDenial: true }));
});

test('THEME summary valid historical V1 profile remains an actual allowed Theme policy control', async t => {
  const f = await themeSummaryFixture(t), before = themeSummaryRemember(f); f.x.h.main.__host.revokeProfile();
  const active = f.x.h.main.__profile(); assert.equal(active.profileId, 'WRITER_LOCAL_V1');
  assert.equal(profile.evaluateWriterLocalCommandAccess({ profile: active, commandId: THEME_SUMMARY_COMMAND_ID }).allowed, true);
  // Match the existing valid V1 Main projection with its expected caller identity; stale V12 is a different negative.
  const frame = new URL(f.x.h.shellUrl); assert.equal(frame.searchParams.get('PRODUCT_PROFILE'), SCENE_LANGUAGE_V12);
  frame.searchParams.set('PRODUCT_PROFILE', active.profileId); f.x.h.shellUrl = frame.href;
  f.c.window.__PRODUCT_PROFILE = active.profileId;
  await f.change('dark'); assertThemeSummaryApplied(f, t, 'ACTUAL_VALID_V1_POLICY_CONTROL'); assertThemeSummaryNoLoss(f, before);
  t.diagnostic('INVALID_V12_MAIN_REFUSAL_UNKNOWN_NOT_ADMITTED_NO_SYNTHETIC_PROFILE_SETTER');
});

for (const lifecycle of ['hidden', 'detached', 'foreign']) test('THEME summary held true event preserves an unavailable aggregation host ' + lifecycle, async t => {
  const f = await themeSummaryFixture(t, { unsaved: true }), before = themeSummaryRemember(f); f.holdDelivery();
  try {
    await f.change('dark'); assert.equal(f.packets.length, 1); assert.equal(f.packets[0].delivered, false);
    let foreign;
    if (lifecycle === 'hidden') f.c.settingsModal.hidden = true;
    else { f.c.settingsSections.remove(); if (lifecycle === 'foreign') {
      foreign = f.c.document.createElement('section'); f.c.document.body.append(foreign); foreign.append(f.c.settingsSections);
    } }
    const oldRow = f.themeRow().row, render = f.c.renderSettingsAggregation; let refreshes = 0;
    f.c.renderSettingsAggregation = (...args) => { refreshes++; return render(...args); };
    f.deliver(); assertThemeSummaryApplied(f, t, lifecycle.toUpperCase()); assertThemeSummaryNoLoss(f, before);
    assert.equal(refreshes, 0, 'hidden, disconnected or foreign aggregation cannot refresh');
    assert.equal(f.themeRow().row, oldRow); assert.equal(f.themeRow().value, 'Light');
    if (lifecycle !== 'hidden') { f.c.settingsSections.remove(); f.c.settingsModal.append(f.c.settingsSections); if (foreign) foreign.remove(); }
    f.c.openSettingsModal(); await f.r.settle();
    assert.equal(f.themeRow().value, 'Dark', 'actual reopen reads current applied body'); assertThemeSummaryNoLoss(f, before);
  } finally { f.deliver(); }
});

test('THEME summary reopened current Settings receives the real held event without stale view publication', async t => {
  const f = await themeSummaryFixture(t, { unsaved: true }), before = themeSummaryRemember(f); f.holdDelivery();
  try {
    await f.change('dark'); f.c.settingsModal.hidden = true; f.c.openSettingsModal(); await f.r.settle();
    assert.equal(f.body(), 'light'); assert.equal(f.themeRow().value, 'Light'); assertThemeSummaryNoLoss(f, before);
    f.deliver(); assertThemeSummaryApplied(f, t, 'REOPENED_CURRENT_VIEW'); assertThemeSummaryNoLoss(f, before);
    assert.equal(f.themeRow().value, 'Dark', 'the current reopened view reads the actual global Theme at its application boundary');
  } finally { f.deliver(); }
});
