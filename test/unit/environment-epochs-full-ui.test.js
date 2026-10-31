'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const ROOT = path.resolve(__dirname, '../..');
const file = path.join(ROOT, 'src/renderer/design-os/designOsEnvironmentEpochs.mjs');
const load = () => import(pathToFileURL(fs.existsSync(file) ? file : path.join(ROOT, 'src/renderer/design-os/designOsFormConfiguration.mjs')).href);

test('full ENV actual Settings exposes finite view-profile preview/apply instead of unreachable legacy controls', () => {
  const source = fs.readFileSync(path.join(ROOT, 'src/renderer/editor.js'), 'utf8');
  assert.match(source, /selectControl\('settings-full-environment-profile', 'View profile'\)/u);
  for (const copy of ['Standard', 'Focus', 'Compact', 'Preview profile', 'Apply profile']) assert.ok(source.includes(copy), copy);
  assert.match(source, /previewFullEnvironmentSelection\('PROFILE'\)/u);
  assert.match(source, /kind === 'PROFILE'/u);
  assert.match(source, /v\.profile\.value/u);
  assert.match(source, /v\.controls\.applyProfile\.disabled/u);
});

test('full ENV publication guard vetoes every stale identity, authoring/composition and unavailable capability', async () => {
  const m = await load(); assert.equal(typeof m.canPublishFullEnvironment, 'function');
  const token = { projectId: 'p', documentId: 'd', publicationId: 'publication1', editGeneration: 9,
    formGeneration: 7, requestId: 'request1', capabilityAvailable: true, dirty: false, composing: false, authoringPending: false };
  assert.equal(m.canPublishFullEnvironment(token, { ...token }), true);
  for (const key of ['projectId', 'documentId', 'publicationId', 'editGeneration', 'formGeneration', 'requestId'])
    assert.equal(m.canPublishFullEnvironment(token, { ...token, [key]: 'stale' }), false, key);
  for (const key of ['dirty', 'composing', 'authoringPending']) assert.equal(m.canPublishFullEnvironment(token, { ...token, [key]: true }), false, key);
  assert.equal(m.canPublishFullEnvironment(token, { ...token, capabilityAvailable: false }), false);
});

test('full ENV actual UI seam is projection-only and never routes history through destructive old reset or text writer', () => {
  const source = fs.readFileSync(path.join(ROOT, 'src/renderer/editor.js'), 'utf8');
  const start = source.indexOf('function applyFullEnvironmentForm('), end = source.indexOf('// FULL_ENVIRONMENT_FORM_END', start);
  assert.ok(start >= 0 && end > start, 'specific existing-Settings form adapter must be wired');
  const body = source.slice(start, end);
  for (const forbidden of ['renderStyledView(', 'setEditorText(', 'innerHTML', 'performSafeResetShell(', 'clearProjectWorkspaceStorage(', 'writeToolbarConfiguratorStoredState(', 'localStorage.setItem(', 'setFontSizePx('])
    assert.equal(body.includes(forbidden), false, forbidden);
  for (const required of ['validateFullEnvironmentConfiguration', 'canPublishFullEnvironment', 'applySpatialLayoutState', 'applyFloatingToolbarState', 'fullEnvironmentToolbarProjection', 'syncLiteralToolbarDisplays'])
    assert.equal(body.includes(required), true, required);
  assert.match(source, /configurationVersion:\s*2/u); assert.match(source, /CONFIRM_APPLY/u); assert.match(source, /ABANDON_APPLY/u);
});

test('full ENV UI keeps current reset, last stable, preset and old epoch distinct with honest partial and legacy copy', () => {
  const source = fs.readFileSync(path.join(ROOT, 'src/renderer/editor.js'), 'utf8');
  for (const token of ['Reset current view', 'Restore last stable', 'Save named preset', 'Apply preset', 'LEGACY_THEME_WRAP_ONLY_OTHER_CURRENT_FIELDS_RETAINED', 'E_FULL_ENV_PARTIAL'])
    assert.ok(source.includes(token), token);
  const model = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(model, /(?:node:fs|ipcRenderer|ipcMain|localStorage|fetch\()/u, 'model/form guards cannot gain platform or persistence capability');
});

test('full ENV every active menu, Kernel and editor reset route goes to the same governed preview instead of the legacy preset eraser', () => {
  const source = fs.readFileSync(path.join(ROOT, 'src/renderer/editor.js'), 'utf8');
  assert.equal((source.match(/safeResetShell:\s*\(\) => openFullEnvironmentSource\('RESET'\)/gu) || []).length, 2);
  assert.equal((source.match(/restoreLastStableShell:\s*\(\) => openFullEnvironmentSource\('LAST_STABLE'\)/gu) || []).length, 2);
  assert.doesNotMatch(source, /(?:=>\s*performSafeResetShell\(\)|^\s+performSafeResetShell\(\);)/mu);
  assert.doesNotMatch(source, /(?:=>\s*performRestoreLastStableShell\(\)|^\s+performRestoreLastStableShell\(\);)/mu);
});

test('full ENV opt-in form snapshot executes the real renderer function without reading manuscript or selection', () => {
  const vm = require('node:vm'), source = fs.readFileSync(path.join(ROOT, 'src/renderer/editor.js'), 'utf8');
  const start = source.indexOf('function composeEditorSnapshot('), end = source.indexOf('function applyIncomingBookProfile(', start);
  assert.ok(start >= 0 && end > start); const accessed = [], metadata = { configuration: { formOnly: true }, formGeneration: 4, composing: false, authoringPending: false };
  const host = { currentProjectId: 'project-current', currentDocumentId: 'scene-current', currentTreeContentPublicationId: 'publication-current',
    localEditGeneration: 9, isTiptapMode: false, wordCommentDraft: null, wordCommentBusy: false, manuscriptDrafts: new Map(),
    notesMutationPending: 0, storyDrafts: new Map(), storyMutationPending: false, pendingStoryRequestId: null,
    composeDocumentContent: () => { accessed.push('content'); return 'Known manuscript N+1'; },
    getPlainText: () => { accessed.push('plainText'); return 'Known manuscript N+1'; },
    getActiveBookProfile: () => null, getSelectionOffsets: () => ({ start: 8, end: 8 }),
    composeFullEnvironmentMetadata: () => metadata, prepareFullEnvironmentWindowProjection: () => 'owned-operation' };
  const context = vm.createContext(host); new vm.Script(source.slice(start, end)).runInContext(context);
  const ordinary = context.composeEditorSnapshot(); assert.equal(ordinary.content, 'Known manuscript N+1');
  assert.deepEqual(accessed, ['content', 'plainText']); accessed.length = 0;
  const form = context.composeEditorSnapshot({ environmentConfigurationWindow: { displayId: '1' } });
  assert.deepEqual(accessed, [], 'configuration query must not serialize manuscript or acquire authoring snapshots');
  assert.equal(Object.hasOwn(form, 'content'), false); assert.equal(Object.hasOwn(form, 'selectionRange'), false);
  assert.equal(form.environmentConfiguration, metadata); assert.equal(form.generation, 9);
});
