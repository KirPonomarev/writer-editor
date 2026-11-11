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

function fullEnvironmentRendererFunctions(names, host) {
  const vm = require('node:vm'), source = fs.readFileSync(path.join(ROOT, 'src/renderer/editor.js'), 'utf8');
  const bodies = names.map(name => {
    const marker = (source.includes(`async function ${name}(`) ? 'async ' : '') + `function ${name}(`;
    const start = source.indexOf(marker), end = source.indexOf('\n}', start);
    assert.ok(start >= 0 && end > start, name); return source.slice(start, end + 2);
  });
  const context = vm.createContext(host); new vm.Script(bodies.join('\n')).runInContext(context); return context;
}

test('full ENV actual cancelled/applied map results do not invent authoring pending; retained/failed/unknown and other drafts still veto', () => {
  const h = fullEnvironmentRendererFunctions(['manualMapHasRetainedDraft', 'cancelManualMapCommandDraft', 'hasFullEnvironmentAuthoringPending'], {
    wordCommentDraft: null, wordCommentBusy: false, manuscriptDrafts: new Map(), notesMutationPending: false,
    storyDrafts: new Map(), storyMutationPending: false, metadataUpdateDebounceId: null, metadataUpdatePending: false,
    metadataUpdateInFlight: false, treeMutationPending: false, pendingRevisionBusy: false, pendingDocxImportAttempt: null,
    pendingMarkdownImportAttempt: null,
    manualMapCommandDraft: null, manualMapDraftOwnership: 4, renderManualMapWorkbenchState: () => {},
    sceneLanguageAuthorDrafts: new Map(), ideaMeaningAuthorDrafts: new Map(), rangeLanguageAuthorDrafts: new Map(),
  });
  for (const state of ['draft', 'pending', 'failed', 'unknown']) {
    h.manualMapCommandDraft = { state, payload: { title: 'Keep author draft' } };
    assert.equal(h.hasFullEnvironmentAuthoringPending(), true, state);
  }
  h.cancelManualMapCommandDraft();
  assert.equal(h.manualMapCommandDraft.state, 'cancelled'); assert.equal(h.manualMapCommandDraft.result.status, 'CANCELLED_NOOP');
  assert.equal(h.manualMapHasRetainedDraft(), false, 'existing lifecycle oracle says explicit Cancel is terminal');
  assert.equal(h.hasFullEnvironmentAuthoringPending(), false, 'terminal result must not permanently disable environment recovery');
  h.manualMapCommandDraft = { state: 'applied', result: { status: 'APPLIED' } };
  assert.equal(h.hasFullEnvironmentAuthoringPending(), false);
  h.wordCommentDraft = { text: 'Unrelated unsaved comment' }; assert.equal(h.hasFullEnvironmentAuthoringPending(), true);
  h.wordCommentDraft = null; h.manualMapCommandDraft = null; assert.equal(h.hasFullEnvironmentAuthoringPending(), false);
  for (const phase of ['creating', 'opening']) {
    h.pendingMarkdownImportAttempt = { phase };
    assert.equal(h.hasFullEnvironmentAuthoringPending(), true, `Markdown ${phase} must veto environment publication`);
  }
  h.pendingMarkdownImportAttempt = { phase: 'previewing' };
  assert.equal(h.hasFullEnvironmentAuthoringPending(), false, 'read-only preview is not retained authoring');
  h.pendingMarkdownImportAttempt = null;
  assert.equal(h.hasFullEnvironmentAuthoringPending(), false, 'completed Markdown action must release the veto');
  for (const retained of [{ languageCode: 'en-US' }, { capture: { quoteText: 'Keep author source' } }, { pending: { active: true } }]) {
    h.rangeLanguageAuthorDrafts.set('current-range', retained);
    assert.equal(h.hasFullEnvironmentAuthoringPending(), true, 'retained range input must veto environment publication');
    h.rangeLanguageAuthorDrafts.clear();
    assert.equal(h.hasFullEnvironmentAuthoringPending(), false, 'explicit range discard releases only its own veto');
  }
});

test('full ENV actual Settings refresh invalidates stale projection before await, disables loading and refuses superseded publication', async () => {
  const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
  const select = value => ({ value, disabled: false, options: [{ value }], replaceChildren(...options) { this.options = options; } });
  const attributes = {}, controls = Object.fromEntries(['capture', 'restore', 'preview', 'savePreset', 'applyPreset', 'reset', 'lastStable', 'recover', 'previewProfile', 'applyProfile'].map(name => [name, { disabled: false }]));
  const fresh = { capacity: { epochs: 1, presets: 1 }, availability: { capture: true, restore: true, configure: true },
    current: { profile: 'BASELINE' }, liveConfiguration: { profile: 'BASELINE' }, pending: null, legacy: null,
    epochs: [{ epochId: 'epoch1', sequence: 1, recordedAtUtc: '2026-10-31T12:00:00.000Z', configuration: { workspace: 'WRITE', profile: 'BASELINE' } }],
    presets: [{ presetId: 'preset1', name: 'Keep this preset' }] };
  const v = { host: { isConnected: true, setAttribute(key, value) { attributes[key] = value; } }, controls,
    projection: fresh, pending: null, select: select('EPOCH:old'), presets: select('preset1'), profile: select('FOCUS'),
    name: { value: 'Keep transient name' }, preview: { textContent: 'Old unbound B preview' }, status: { textContent: '' },
    previewBinding: { source: { kind: 'PROFILE', id: 'FOCUS' }, generation: 7 }, previewRequest: {}, profileChosen: true };
  const gate = deferred();
  const h = fullEnvironmentRendererFunctions(['updateFullEnvironmentControls', 'publishFullEnvironmentView', 'refreshFullEnvironmentEpochs'], {
    fullEnvironmentView: v, currentProjectId: 'current-project', fullEnvironmentFormGeneration: 7, settingsModal: { hidden: false },
    ensureFullEnvironmentControls: () => v, hydrateFullEnvironmentForProject: () => gate.promise,
    readFullEnvironmentProjection: async () => fresh, fullEnvironmentMessage: error => String(error),
    document: { createElement: () => ({ value: '', textContent: '' }) },
  });
  const run = h.refreshFullEnvironmentEpochs();
  try {
    assert.equal(v.projection, null); assert.equal(v.previewBinding, null); assert.equal(v.previewRequest, null);
    assert.equal(v.preview.textContent, ''); assert.equal(v.profileChosen, false);
    assert.equal(v.controls.restore.disabled, true); assert.equal(v.controls.capture.disabled, true); assert.equal(attributes['aria-busy'], 'true');
  } finally { gate.resolve(); }
  await run; assert.equal(v.projection, fresh); assert.equal(v.profile.value, 'BASELINE');
  assert.equal(v.name.value, 'Keep transient name'); assert.equal(attributes['aria-busy'], 'false');
  const old = deferred(), current = deferred(), queue = [old, current];
  h.hydrateFullEnvironmentForProject = () => queue.shift().promise;
  const oldRun = h.refreshFullEnvironmentEpochs(), currentRun = h.refreshFullEnvironmentEpochs();
  try {
    old.resolve(); await oldRun; assert.equal(v.projection, null, 'older completion cannot republish while newer refresh waits');
    assert.equal(attributes['aria-busy'], 'true'); assert.equal(v.controls.restore.disabled, true);
  } finally { old.resolve(); current.resolve(); }
  await currentRun; assert.equal(v.projection, fresh); assert.equal(attributes['aria-busy'], 'false');
});

test('full ENV actual toolbar runtime consumes the selected project projection without changing named definitions', async () => {
  const runtime = await import(pathToFileURL(path.join(ROOT, 'src/renderer/toolbar/toolbarRuntimeProjection.mjs')).href);
  const undo = 'toolbar.history.undo', redo = 'toolbar.history.redo';
  const stored = Object.freeze({ activeToolbarProfile: 'minimal', toolbarProfiles: Object.freeze({
    minimal: Object.freeze([undo]), master: Object.freeze([undo, redo]),
  }) });
  const savedBytes = JSON.stringify(stored), calls = [], registry = {};
  const selected = Object.freeze({ projectId: 'project-current', profile: 'minimal', toolbarIds: Object.freeze([redo, undo]) });
  const h = fullEnvironmentRendererFunctions(['projectMainFloatingToolbarRuntime'], {
    toolbarRuntimeProjectionModule: { applyToolbarActiveProfile(actualRegistry, state) {
      calls.push({ state, ids: runtime.collectVisibleToolbarItemIdsFromState(state) }); return { registry: actualRegistry };
    } }, toolbarRuntimeRegistry: registry, configuratorBucketState: stored, fullEnvironmentToolbarProjection: selected,
    currentProjectId: 'project-current', floatingToolbarState: {}, toolbarItemOffsets: {}, closeOrphanedMainToolbarOverlays: () => {},
    restoreFocusFromHiddenMainToolbarItem: () => {}, syncToolbarFormattingState: () => {}, scheduleToolbarAnchorUpdate: () => {},
  });
  h.projectMainFloatingToolbarRuntime('environment-projection');
  assert.deepEqual(calls[0].ids, [redo, undo], 'actual runtime input must follow epoch visibility/order, not the saved preset');
  assert.equal(calls[0].state.activeToolbarProfile, 'minimal');
  assert.equal(h.configuratorBucketState, stored); assert.equal(JSON.stringify(stored), savedBytes);
  assert.equal(h.fullEnvironmentToolbarProjection, selected);
  h.fullEnvironmentToolbarProjection = { projectId: 'different-project', profile: 'master', toolbarIds: [redo] };
  h.projectMainFloatingToolbarRuntime('foreign-projection');
  assert.equal(calls[1].state, stored); assert.deepEqual(calls[1].ids, [undo], 'stale project cannot override this toolbar');
  h.fullEnvironmentToolbarProjection = { projectId: 'project-current', profile: 'master', toolbarIds: [redo] };
  h.projectMainFloatingToolbarRuntime('environment-projection');
  assert.equal(calls[2].state.activeToolbarProfile, 'master'); assert.deepEqual(calls[2].ids, [redo]);
  assert.equal(JSON.stringify(stored), savedBytes, 'both named profile definitions remain byte-equivalent');
});

test('full ENV actual form health reads DOM order/hidden items and profile instead of echoing desired configuration', async () => {
  const runtime = await import(pathToFileURL(path.join(ROOT, 'src/renderer/toolbar/toolbarRuntimeProjection.mjs')).href);
  const undo = { hidden: false }, redo = { hidden: false }, size = { hidden: true };
  const descriptors = [{ node: undo, itemId: 'toolbar.history.undo', bindKey: 'undo' },
    { node: redo, itemId: 'toolbar.history.redo', bindKey: 'redo' },
    { node: size, itemId: 'toolbar.font.size', bindKey: 'size' }];
  const group = { querySelectorAll: () => [redo, size, undo] }, shell = { dataset: { toolbarProfile: 'master' } };
  const registry = { toolbarShell: shell, controlsContainer: { querySelectorAll: () => [group] },
    groupDescriptors: [{ element: group, itemDescriptors: descriptors }], itemDescriptors: descriptors,
    itemDescriptorByNode: new Map(descriptors.map(row => [row.node, row])) };
  const h = fullEnvironmentRendererFunctions(['readFullEnvironmentForm'], {
    fullEnvironmentWindowBinding: { displayId: '1' }, editor: { style: { fontFamily: 'monospace', lineHeight: '1.625' } },
    toolbar: { classList: { contains: () => false } }, toolbarShell: shell, leftToolbar: {}, sidebar: {},
    spatialLayoutState: { leftSidebarWidth: 290, rightSidebarWidth: 290, leftCollapsed: false, rightCollapsed: false },
    document: { body: { classList: { contains: () => false } } }, TOOLBAR_COMPACT_CLASS: 'compact', currentMode: 'write',
    floatingToolbarState: { isDetached: false }, leftFloatingToolbarState: { isDetached: false }, getSpatialLayoutMode: () => 'desktop',
    getToolbarConfiguratorActiveProfile: () => 'minimal', getToolbarConfiguratorProfileIds: () => ['toolbar.history.undo'],
    toolbarRuntimeRegistry: registry, toolbarRuntimeProjectionModule: runtime,
    currentLeftTab: 'project', currentRightTab: 'inspector', toolbarItemOffsets: {}, leftToolbarButtonOffsets: {},
    wordWrapEnabled: false, fontSelect: { value: 'monospace' }, weightSelect: { value: 'light' }, lineHeightSelect: { value: '1.625' },
    currentFontSizePx: 16, editorZoom: 0.5, activeLayoutPreviewState: { enabled: false, frameMode: true },
    validateFullEnvironmentConfiguration: value => value,
  });
  const actual = h.readFullEnvironmentForm();
  assert.deepEqual(Array.from(actual.composition.toolbarIds), ['toolbar.history.redo', 'toolbar.history.undo']);
  assert.equal(actual.composition.profile, 'master', 'physical shell label must agree with the actual runtime');
  assert.equal(actual.composition.toolbarIds.includes('toolbar.font.size'), false, 'hidden actual control is absent');
  h.toolbarRuntimeRegistry = null;
  assert.throws(() => h.readFullEnvironmentForm(), /E_FULL_ENV/u, 'missing runtime cannot be replaced with desired IDs');
});

test('full ENV actual automatic hydration waits for checked initial source and never starts from a tree query alone', async () => {
  const calls = [], projectId = 'project-current';
  const h = fullEnvironmentRendererFunctions(['hydrateFullEnvironmentForProject'], {
    initialDocumentAdopted: false, currentProjectId: projectId, fullEnvironmentHydratedProject: '', fullEnvironmentReadyProject: '',
    fullEnvironmentHydrationPromise: null, fullEnvironmentLastSignal: Promise.resolve(), fullEnvironmentPendingWindow: null,
    readFullEnvironmentProjection: async () => { calls.push('read'); return {
      current: { profile: 'BASELINE' }, liveConfiguration: { profile: 'FOCUS' }, pending: null, revision: 3, availability: { configure: true },
    }; }, fullEnvironmentToken: () => ({ checkedSource: true }), fullEnvironmentPayload: () => ({}),
    EXTRA_COMMAND_IDS: { ENVIRONMENT_CONFIGURATION_COMMIT: 'commit' },
    dispatchFullEnvironment: async () => { calls.push('commit'); return {}; },
    completeFullEnvironmentApply: async () => { calls.push('apply'); }, fullEnvironmentView: null,
  });
  await h.hydrateFullEnvironmentForProject();
  assert.deepEqual(calls, [], 'before checked document adoption even automatic form reads/writes must wait');
  assert.equal(h.fullEnvironmentHydratedProject, '');
  h.initialDocumentAdopted = true; await h.hydrateFullEnvironmentForProject();
  assert.deepEqual(calls, ['read', 'commit', 'apply']); assert.equal(h.fullEnvironmentHydratedProject, projectId);
  assert.equal(h.fullEnvironmentReadyProject, projectId);
  const source = fs.readFileSync(path.join(ROOT, 'src/renderer/editor.js'), 'utf8');
  const start = source.indexOf('async function loadTree('), end = source.indexOf('\n}', start);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(source.slice(start, end), /hydrateFullEnvironmentForProject\(/u, 'tree projection does not adopt the authoring source');
});

test('full ENV Settings live Quiet mode follows the applied form despite missing or stale legacy preferences', async () => {
  const { buildSettingsAggregation } = await import(pathToFileURL(path.join(ROOT, 'src/renderer/settings/settingsAggregator.mjs')).href);
  for (const scenario of [
    { focus: true, select: null, stored: 'default' },
    { focus: false, select: null, stored: 'focus' },
    { focus: true, select: { value: 'default' }, stored: 'default' },
    { focus: false, select: { value: 'focus' }, stored: 'focus' },
  ]) {
    const h = fullEnvironmentRendererFunctions(['buildSettingsAggregationSnapshot'], {
      buildSettingsAggregation, getActiveBookProfile: () => ({ formatId: 'A4', orientation: 'portrait' }),
      activeBookProfileState: {}, currentProjectId: 'project-current',
      document: { body: { classList: { contains: name => name === 'focus-mode' && scenario.focus } } },
      fontSelect: null, weightSelect: null, lineHeightSelect: null, currentFontSizePx: 16,
      wordWrapEnabled: false, editorZoom: 0.5, styleSelect: scenario.select,
      localStorage: { getItem: () => scenario.stored, setItem: () => assert.fail('live query cannot write preferences') },
      getToolbarConfiguratorActiveProfile: () => 'minimal',
    });
    const snapshot = h.buildSettingsAggregationSnapshot();
    const row = snapshot.settings.find(setting => setting.id === 'editor.viewMode');
    assert.equal(row.value, scenario.focus ? 'focus' : 'default', 'live aggregation must follow the applied form, not a stale control or preference');
    assert.equal(row.status, 'live'); assert.equal(snapshot.createsStore, false);
  }
});

test('full ENV actual current Settings entry opens the fullV2 query surface and cannot route to retained V1 controllers or change author state', async () => {
  for (const dark of [false, true]) for (const wrap of [false, true]) {
    const calls = [], modal = { hidden: true }, editor = { text: 'Keep current N+1' };
    const model = { doc: { text: editor.text }, selection: { from: 2, to: 7 } };
    const query = Promise.resolve({ queryOnly: true });
    const forbidden = () => assert.fail('opening current fullV2 Settings cannot invoke a legacy controller, apply preferences or write product state');
    const h = fullEnvironmentRendererFunctions(['openSettingsModal'], {
      document: { body: { classList: { contains: name => { assert.equal(name, 'dark-theme'); return dark; } } } },
      settingsThemeSelect: { value: 'stale' }, settingsWrapSelect: { value: 'stale' }, wordWrapEnabled: wrap,
      settingsModal: modal, editor, tiptapEditor: { state: model },
      renderSettingsAggregation: () => calls.push('actual-aggregation-request'),
      openSimpleModal: target => { assert.equal(target, modal); target.hidden = false; calls.push('open'); },
      ensureFullEnvironmentControls: () => { assert.equal(modal.hidden, false); calls.push('fullV2-controls'); },
      refreshFullEnvironmentEpochs: () => { calls.push('fullV2-query'); return query; },
      ensureSavedEnvironmentEpochControls: forbidden, refreshSavedEnvironmentEpochs: forbidden,
      applyTheme: forbidden, applyWordWrap: forbidden, dispatchUiCommand: forbidden, saveCurrentDocument: forbidden,
    });
    assert.equal(h.openSettingsModal(), query);
    assert.deepEqual(await query, { queryOnly: true });
    assert.deepEqual(calls, ['actual-aggregation-request', 'open', 'fullV2-controls', 'fullV2-query']);
    assert.equal(h.settingsThemeSelect.value, dark ? 'dark' : 'light');
    assert.equal(h.settingsWrapSelect.value, wrap ? 'on' : 'off');
    assert.equal(h.editor, editor); assert.equal(editor.text, 'Keep current N+1');
    assert.equal(h.tiptapEditor.state, model); assert.deepEqual(model, { doc: { text: editor.text }, selection: { from: 2, to: 7 } });
  }
});
