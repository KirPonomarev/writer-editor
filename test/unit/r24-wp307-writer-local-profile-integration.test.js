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
    'cmd.project.review.activateDocxReviewPreviewSession',
    'cmd.project.review.applyExactTextChangesBatch',
  ]) {
    assert.equal(profileSource.includes(commandId), true, commandId);
  }
});

test('WP307 C2 DOCX review roundtrip survivors are bridged by main while near matches stay profile-denied', () => {
  const source = read('src/main.js');
  const survivorIds = [
    'cmd.project.review.openComments',
    'cmd.project.review.exportDocxReviewPacket',
    'cmd.project.review.activateDocxReviewPreviewSession',
    'cmd.project.review.applyExactTextChangesBatch',
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
    'cmd.project.review.activateDocxReviewPreviewSession.extra',
    'cmd.project.review.applyExactTextChangesBatchAll',
    'cmd.project.review.applyExactTextChange',
    'cmd.project.review.exportLocalPacket',
    'cmd.project.review.openDocxReviewPreviewSession',
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
  assert.equal(textSingleSceneEditor.sha256, digest);
  assert.equal(textSingleSceneSuccessor.generatedRuntimeArtifact.path, 'src/renderer/editor.bundle.js');
  assert.equal(textSingleSceneSuccessor.generatedRuntimeArtifact.sha256, bundleDigest);
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
