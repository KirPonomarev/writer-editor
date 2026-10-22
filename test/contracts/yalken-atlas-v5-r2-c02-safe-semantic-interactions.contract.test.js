const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = process.cwd();
const editorPath = path.join(repoRoot, 'src', 'renderer', 'editor.js');
const cssPath = path.join(repoRoot, 'src', 'renderer', 'styles.css');
const editor = fs.readFileSync(editorPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

test('R2 C02 routes Manual Map semantic actions through visible draft forms before dispatch', () => {
  assert.match(editor, /let manualMapCommandDraft = null/u);
  assert.match(editor, /schemaVersion:\s*'manualMap\.commandDraft\.v1'/u);
  assert.match(editor, /dataset\.manualMapCommandForm = 'true'/u);
  assert.match(editor, /dataset\.manualMapSelectionTarget = draft\.targetId/u);
  assert.match(editor, /dataset\.manualMapImpactPreview = 'true'/u);
  assert.match(editor, /dataset\.manualMapCommandApply = 'true'/u);
  assert.match(editor, /runProductJourneyCommand\(commandId, payload\)/u);

  const toolbarDirectDispatch = /button\.addEventListener\('click',\s*\(\)\s*=>\s*\{[\s\S]{0,160}runManualMapWorkbenchCommand/u;
  assert.doesNotMatch(editor, toolbarDirectDispatch);
});

test('R2 C02 destructive and structural Manual Map changes require explicit confirmation and expose cancel no-op', () => {
  assert.match(editor, /risk:\s*'destructive'/u);
  assert.match(editor, /risk:\s*'structural'/u);
  assert.match(editor, /dataset\.manualMapConfirmRisk = draft\.risk/u);
  assert.match(editor, /reason:\s*'CONFIRMATION_REQUIRED'/u);
  assert.match(editor, /dataset\.manualMapCommandCancel = 'true'/u);
  assert.match(editor, /status:\s*'CANCELLED_NOOP'/u);
  assert.match(editor, /mutationDispatched:\s*false/u);
});

test('R2 C02 preserves explicit targets and forbids first-object fallback mutations', () => {
  assert.doesNotMatch(editor, /nodes\.slice\(0,\s*3\)/u);
  assert.doesNotMatch(editor, /selectedNode\s*\|\|\s*nodes\[0\]/u);
  assert.doesNotMatch(editor, /selectedEdge\s*\|\|\s*edges\[0\]/u);
  assert.doesNotMatch(editor, /selectedGroup\s*\|\|\s*groups\[0\]/u);
  assert.match(editor, /targetId:\s*selectedNodeId/u);
  assert.match(editor, /targetId:\s*selectedEdgeId/u);
  assert.match(editor, /targetId:\s*manualMapText\(selectedGroup\?\.id\)/u);
});

test('R2 C02 turns drag persistence into previewed Apply instead of direct pointer-up mutation', () => {
  const pointerUpStart = editor.indexOf('function handleManualMapWorkbenchPointerUp');
  assert.notEqual(pointerUpStart, -1);
  const pointerUpEnd = editor.indexOf('async function refreshManualMapWorkbench', pointerUpStart);
  const pointerUpSource = editor.slice(pointerUpStart, pointerUpEnd);
  assert.match(pointerUpSource, /openManualMapCommandDraft\(/u);
  assert.match(pointerUpSource, /title:\s*'Move node'/u);
  assert.match(pointerUpSource, /impactPreview:/u);
  assert.doesNotMatch(pointerUpSource, /runManualMapWorkbenchCommand/u);
  assert.doesNotMatch(pointerUpSource, /runProductJourneyCommand/u);
});

test('R2 C02 styles command forms without adding a new UI framework or dependency marker', () => {
  assert.match(css, /\.manual-map-workspace__command-form/u);
  assert.match(css, /\.manual-map-workspace__impact-preview/u);
  assert.match(css, /\.manual-map-workspace__confirm/u);
  assert.match(css, /\.manual-map-workspace__command-actions/u);
  assert.doesNotMatch(editor + css, /from ['"](?:react|vue|svelte|@mui|antd)/u);
});

// Execute the actual draft listeners and actual workbench clear/rebuild path.
// The finite DOM port models focused-subtree removal; it is not native/IME proof.
function draftDomHarness(transform = text => text) {
  const vm = require('node:vm');
  const document = { activeElement: null };
  const dataName = (name) => name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  class Element {
    constructor(tag) {
      this.tagName = tag.toUpperCase(); this.children = []; this.parentElement = null;
      this.dataset = {}; this.listeners = {}; this._value = ''; this.valueWrites = 0;
      this._text = ''; this.checked = false; this.hidden = false; this.disabled = false;
      this.selectionStart = 0; this.selectionEnd = 0; this.selectionDirection = 'none';
    }
    get isConnected() { return this === document.body || !!this.parentElement?.isConnected; }
    contains(node) { return this === node || this.children.some((child) => child.contains(node)); }
    append(...nodes) { nodes.forEach((node) => this.appendChild(node)); }
    appendChild(node) { node.parentElement = this; this.children.push(node); return node; }
    remove() {
      if (this.contains(document.activeElement)) document.activeElement = document.body;
      if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((node) => node !== this);
      this.parentElement = null;
    }
    get innerHTML() { return ''; }
    set innerHTML(value) {
      assert.equal(value, '', 'only the actual empty-host rebuild is modeled');
      [...this.children].forEach((child) => child.remove()); this._text = '';
    }
    get textContent() { return this._text + this.children.map((child) => child.textContent).join(''); }
    set textContent(value) { [...this.children].forEach((child) => child.remove()); this._text = String(value); }
    get value() { return this._value; }
    set value(value) {
      this.valueWrites++; this._value = String(value);
      this.selectionStart = this.selectionEnd = this._value.length; this.selectionDirection = 'none';
    }
    setSelectionRange(start, end, direction = 'none') {
      this.selectionStart = start; this.selectionEnd = end; this.selectionDirection = direction;
    }
    focus() { document.activeElement = this; }
    setAttribute(name, value) {
      if (name.startsWith('data-')) this.dataset[dataName(name.slice(5))] = String(value);
    }
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
    emit(name, detail = {}) {
      const event = { target: this, preventDefault() {}, ...detail };
      return Promise.all((this.listeners[name] || []).map((fn) => fn(event)));
    }
    querySelectorAll(selector) {
      const match = /^\[data-([a-z-]+)\]$/.exec(selector);
      assert.ok(match, 'finite DOM selector must be explicit: ' + selector);
      const key = dataName(match[1]), result = [];
      const visit = (node) => {
        for (const child of node.children) {
          if (Object.hasOwn(child.dataset, key)) result.push(child);
          visit(child);
        }
      };
      visit(this); return result;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  }
  document.body = new Element('body'); document.activeElement = document.body;
  document.createElement = (tag) => new Element(tag);
  const rail = new Element('div'), plan = new Element('div'), workspace = new Element('section');
  document.body.append(rail, workspace); workspace.append(plan);
  const calls = [], counters = { renders: 0, queries: 0 };
  const noop = () => {};
  const context = {
    document, HTMLElement: Element, Element, counters,
    manualMapWorkbenchHost: rail, manualMapPlanHost: plan, manualMapPlanWorkspace: workspace,
    currentProjectId: 'project-a', currentDocumentId: 'scene-a', currentTreeContentPublicationId: 'publication-a',
    localEditGeneration: 1, currentRightTab: 'atlas', currentAtlasSurface: 'manualMap',
    atlasJourneyState: { commandSeq: 0 }, manualMapCommandDraft: null, manualMapSearchQuery: '',
    manualMapWorkbenchState: { state: 'ready', projectId: 'project-a', mapId: 'map-a',
      graph: {}, summary: { mapCount: 1, nodeCount: 0, edgeCount: 0, groupCount: 0 } },
    normalizeManualMapWorkbench: (value) => value,
    buildManualMapWorkbenchRuntimeModel: () => ({ sourceGraph: {}, resourceBudgetProof: {}, viewportPlan: {} }),
    applyAtlasResolvedSurfaceBinding: noop, appendAtlasOverviewMetric: noop,
    renderManualMapToolbar: noop, showManualMapPlanWorkspace: noop, renderManualMapList: noop,
    renderManualMapPortabilityReadback: noop, renderManualMapPortabilityCommandReadback: noop,
    renderManualMapGraphCanvas: noop, renderManualMapInspector: noop,
    appendAtlasOverviewSection: (host) => { const section = new Element('section'); host.append(section); return section; },
    runProductJourneyCommand: async (commandId, payload) => {
      calls.push(JSON.parse(JSON.stringify({ commandId, payload })));
      return context.commandResult || { ok: true };
    },
    refreshManualMapWorkbench: async () => { counters.queries++; },
  };
  vm.createContext(context);
  function sourceFunction(name) {
    let start = editor.indexOf('async function ' + name + '(');
    if (start < 0) start = editor.indexOf('function ' + name + '(');
    assert.notEqual(start, -1, 'actual function missing: ' + name);
    const end = editor.indexOf('\n}\n', start); assert.ok(end > start);
    return transform(editor.slice(start, end + 2));
  }
  const names = ['manualMapText', 'createManualMapCommandDraft', 'openManualMapCommandDraft',
    'cancelManualMapCommandDraft', 'updateManualMapCommandDraftField', 'setManualMapCommandDraftConfirmation',
    'applyManualMapCommandDraft', 'renderManualMapCommandDraft', 'renderManualMapWorkbenchInto',
    'renderManualMapWorkbenchState'];
  if (editor.includes('function syncManualMapCommandDraftControls(')) names.push('syncManualMapCommandDraftControls');
  names.push('invalidateAtlasPublications', 'captureAtlasPublication', 'beginAtlasQueryPublication', 'readAtlasQueryProjection');
  const stateStart = editor.indexOf('let atlasPublicationEpoch =');
  const stateEnd = editor.indexOf('let manualMapPortabilityCommandState =', stateStart);
  assert.ok(stateStart >= 0 && stateEnd > stateStart);
  vm.runInContext(editor.slice(stateStart, stateEnd) + names.map(sourceFunction).join('\n') + '\n' +
    'const actualWorkbenchRender = renderManualMapWorkbenchInto;\n' +
    'renderManualMapWorkbenchInto = (...args) => { counters.renders++; return actualWorkbenchRender(...args); };\n' +
    'globalThis.port = { open: openManualMapCommandDraft, draft: () => manualMapCommandDraft };', context);
  const field = (host = rail) => host.querySelector('[data-manual-map-command-field]');
  function open(kind = 'title', risk = kind === 'title' ? 'structural' : 'semantic', targetId = 'target-a') {
    context.port.open({ commandId: kind === 'title' ? 'manualMap.create' : 'manualMap.node.add',
      targetKind: kind === 'title' ? 'map' : 'node', targetId, risk,
      payload: { mapId: 'map-a', ...(kind === 'title' ? {} : { nodeId: targetId }), [kind]: '01 Начало' },
      fields: [{ name: kind, label: kind, type: 'text', value: '01 Начало' }] });
    return field();
  }
  function edit(input, text, inputType = 'insertText', isComposing = false) {
    // Browser editing changes the native value/selection before the real listener.
    const start = input.selectionStart, end = input.selectionEnd;
    input._value = input._value.slice(0, start) + text + input._value.slice(end);
    input.setSelectionRange(start + text.length, start + text.length);
    return input.emit('input', { data: text, inputType, isComposing });
  }
  const draft = () => JSON.parse(JSON.stringify(context.port.draft()));
  const form = (host = rail) => host.querySelector('[data-manual-map-command-form]');
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  return { document, rail, plan, context, calls, counters, field, open, edit, draft, form, settle };
}

for (const kind of ['title', 'label']) test('R2 C02 actual ' + kind + ' typing keeps the input node focus and selection', async () => {
  const h = draftDomHarness(), input = h.open(kind);
  input.focus(); input.setSelectionRange(input.value.length, input.value.length);
  const renders = h.counters.renders, valueWrites = input.valueWrites;
  await h.edit(input, '1');
  assert.equal(h.document.activeElement, input, 'actual rebuild must not send focus to BODY');
  assert.equal(h.field(), input, 'focused input must remain the same connected node');
  await h.edit(input, '2');
  assert.equal(input.value, '01 Начало12');
  assert.equal(h.draft().payload[kind], input.value);
  assert.equal(h.field(h.plan).value, input.value, 'other current projection mirrors the draft');
  assert.equal(input.selectionStart, input.value.length);
  assert.equal(input.selectionEnd, input.value.length);
  assert.equal(input.valueWrites, valueWrites, 'runtime must not set the active input value');
  assert.equal(h.counters.renders, renders, 'no graph/workbench rebuild per character');
  assert.equal(h.counters.queries, 0); assert.equal(h.calls.length, 0);
});

for (const kind of ['title', 'label']) test('R2 C02 actual ' + kind + ' preserves replacement backspace Unicode and composition-style input', async () => {
  const h = draftDomHarness(), input = h.open(kind);
  input.focus(); input.setSelectionRange(0, 2, 'backward');
  await h.edit(input, '🧭e\u0301', 'insertReplacementText');
  assert.equal(h.field(), input); assert.equal(input.value, '🧭e\u0301 Начало');
  assert.equal(input.selectionStart, 4); assert.equal(input.selectionEnd, 4);
  input.setSelectionRange(2, 4, 'backward'); await h.edit(input, '', 'deleteContentBackward');
  assert.equal(input.value, '🧭 Начало'); assert.equal(input.selectionStart, 2);
  input.setSelectionRange(input.value.length, input.value.length);
  const writes = input.valueWrites;
  await input.emit('compositionstart', { data: '' });
  await h.edit(input, 'に', 'insertCompositionText', true);
  assert.equal(h.document.activeElement, input); assert.equal(h.field(), input);
  await h.edit(input, 'ほん', 'insertCompositionText', true);
  await input.emit('compositionend', { data: 'にほん' });
  assert.equal(input.value, '🧭 Началоにほん');
  assert.equal(h.draft().payload[kind], input.value);
  assert.equal(input.selectionStart, input.value.length);
  assert.equal(input.valueWrites, writes); assert.equal(h.calls.length, 0);
});

test('R2 C02 actual confirmation and stale error clearing preserve the current controls', async () => {
  const h = draftDomHarness(); h.open();
  await h.form().emit('submit'); await h.settle();
  assert.equal(h.calls.length, 0);
  assert.equal(h.draft().result.reason, 'CONFIRMATION_REQUIRED');
  const input = h.field(), form = h.form(); input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
  await h.edit(input, '12');
  assert.equal(h.form(), form); assert.equal(h.draft().result, null);
  assert.equal(form.querySelector('[data-manual-map-operation-result]'), null);
  const confirm = form.querySelector('[data-manual-map-confirm-risk]');
  confirm.focus(); confirm.checked = true; await confirm.emit('change');
  assert.equal(h.form(), form); assert.equal(h.document.activeElement, confirm);
  assert.equal(h.form(h.plan).querySelector('[data-manual-map-confirm-risk]').checked, true);
  assert.equal(h.draft().confirmChecked, true); assert.equal(h.calls.length, 0);
  await form.emit('submit'); await h.settle();
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].payload.title, '01 Начало12');
  assert.equal(h.draft().result.status, 'APPLIED');
  await form.emit('submit'); await h.settle();
  assert.equal(h.calls.length, 1, 'detached old submit cannot redispatch');
});

test('R2 C02 actual cancel and replaced or foreign-project controls cannot edit or dispatch a newer draft', async () => {
  const h = draftDomHarness(), old = h.open();
  const oldForm = h.form(), oldConfirm = oldForm.querySelector('[data-manual-map-confirm-risk]');
  const oldCancel = oldForm.querySelector('[data-manual-map-command-cancel]');
  const next = h.open('label', 'semantic', 'node-b'), before = h.draft();
  await old.emit('input'); oldConfirm.checked = true; await oldConfirm.emit('change');
  await oldForm.emit('submit'); await oldCancel.emit('click'); await h.settle();
  assert.deepEqual(h.draft(), before); assert.equal(h.calls.length, 0);
  h.context.currentProjectId = 'project-b'; next.focus(); next.setSelectionRange(0, 0);
  await h.edit(next, 'foreign'); assert.deepEqual(h.draft(), before);
  h.context.currentProjectId = 'project-a';
  await h.form().querySelector('[data-manual-map-command-cancel]').emit('click');
  assert.equal(h.draft().state, 'cancelled'); assert.equal(h.draft().result.status, 'CANCELLED_NOOP');
  const cancelled = h.draft(), cancelledInput = h.field();
  cancelledInput.focus(); await h.edit(cancelledInput, 'ignored');
  assert.deepEqual(h.draft(), cancelled); assert.equal(h.calls.length, 0);
});

test('R2 C02 actual Apply preserves a capability refusal receipt without optimistic success or retry', async () => {
  const h = draftDomHarness(), input = h.open('label');
  h.context.commandResult = { ok: false, reason: 'CAPABILITY_DISABLED_FOR_COMMAND' };
  input.focus(); input.setSelectionRange(input.value.length, input.value.length); await h.edit(input, '12');
  await h.form().emit('submit'); await h.settle();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].commandId, 'manualMap.node.add');
  assert.equal(h.calls[0].payload.label, '01 Начало12');
  assert.equal(h.draft().state, 'failed');
  assert.equal(h.draft().result.status, 'FAILED');
  assert.equal(h.draft().result.reason, 'CAPABILITY_DISABLED_FOR_COMMAND');
  assert.equal(h.draft().result.mutationDispatched, false);
});

test('R2 C02 detached controls cannot alter a replacement with identical command and target IDs', async () => {
  const h = draftDomHarness(), old = h.open(), oldForm = h.form();
  const current = h.open(), before = h.draft(); current.focus();
  await h.edit(old, 'late');
  assert.deepEqual(h.draft(), before, 'connected-node guard must consume late old input');
  const confirm = oldForm.querySelector('[data-manual-map-confirm-risk]');
  confirm.checked = true; await confirm.emit('change'); await oldForm.emit('submit');
  await oldForm.querySelector('[data-manual-map-command-cancel]').emit('click'); await h.settle();
  assert.deepEqual(h.draft(), before); assert.equal(h.calls.length, 0);
  assert.equal(h.field(), current); assert.equal(h.document.activeElement, current);
});

// Deferred ports retain actual renderer decisions, normalizers and DOM rebuilds.
// They are typed transport fixtures, not a claim of real Core/native execution.
function publicationHarness(transform) {
  const h = draftDomHarness(transform), vm = require('node:vm'), c = h.context;
  const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
  const text = name => {
    const start = editor.indexOf('async function ' + name + '(') >= 0
      ? editor.indexOf('async function ' + name + '(') : editor.indexOf('function ' + name + '(');
    assert.ok(start >= 0, 'actual function exists: ' + name);
    const end = editor.indexOf('\n}\n', start); assert.ok(end > start);
    const value = editor.slice(start, end + 2);
    return transform ? transform(value) : value;
  };
  const leaves = [
    ['refreshManualMapWorkbench', 'MANUAL_MAP_WORKBENCH_QUERY_ID', 'manualMapWorkbench', 'normalizeManualMapWorkbench', 'manualMapWorkbenchState', 'renderManualMapWorkbenchState'],
    ['refreshAtlasCurrentScene', 'ATLAS_CURRENT_SCENE_QUERY_ID', 'atlasCurrentScene', 'normalizeAtlasCurrentSceneDossier', 'atlasCurrentSceneState', 'renderAtlasCurrentSceneState'],
    ['refreshProjectionInspector', 'PROJECTION_INSPECTOR_QUERY_ID', 'projectionInspector', 'normalizeProjectionInspector', 'projectionInspectorState', 'renderProjectionInspectorState'],
    ['refreshAtlasOverview', 'ATLAS_OVERVIEW_QUERY_ID', 'atlasOverview', 'normalizeAtlasOverview', 'atlasOverviewState', 'renderAtlasOverviewState'],
    ['refreshAtlasEntityDossier', 'ATLAS_ENTITY_DOSSIER_QUERY_ID', 'atlasEntityDossier', 'normalizeAtlasEntityDossier', 'atlasEntityDossierState', 'renderAtlasEntityDossierState'],
    ['refreshAtlasRelationDossier', 'ATLAS_RELATION_DOSSIER_QUERY_ID', 'atlasRelationDossier', 'normalizeAtlasRelationDossier', 'atlasRelationDossierState', 'renderAtlasRelationDossierState'],
    ['refreshAtlasMatrices', 'ATLAS_MATRICES_QUERY_ID', 'atlasMatrices', 'normalizeAtlasMatrices', 'atlasMatricesState', 'renderAtlasMatricesState'],
    ['refreshAtlasHeatmap', 'ATLAS_HEATMAP_QUERY_ID', 'atlasHeatmap', 'normalizeAtlasHeatmap', 'atlasHeatmapState', 'renderAtlasHeatmapState'],
    ['refreshAtlasTemporalLayout', 'ATLAS_TEMPORAL_LAYOUT_QUERY_ID', 'atlasTemporalLayout', 'normalizeAtlasTemporalLayout', 'atlasTemporalLayoutState', 'renderAtlasTemporalLayoutState'],
    ['refreshAtlasContinuityLedgerSurface', 'ATLAS_CONTINUITY_LEDGER_SURFACE_QUERY_ID', 'atlasContinuityLedgerSurface', 'normalizeAtlasContinuityLedgerSurface', 'atlasContinuityLedgerState', 'renderAtlasContinuityLedgerState'],
    ['refreshAtlasReportsSavedQueries', 'ATLAS_REPORTS_SAVED_QUERIES_QUERY_ID', 'atlasReportsSavedQueries', 'normalizeAtlasReportsSavedQueries', 'atlasReportsState', 'renderAtlasReportsSavedQueriesState'],
    ['refreshAtlasDiagnosticsStageAcceptance', 'ATLAS_DIAGNOSTICS_STAGE_ACCEPTANCE_QUERY_ID', 'atlasDiagnosticsStageAcceptance', 'normalizeAtlasDiagnosticsStageAcceptance', 'atlasDiagnosticsState', 'renderAtlasDiagnosticsStageAcceptanceState'],
  ];
  const statuses = [], errors = [], queries = [], commands = [], delivered = [], renders = [];
  let incoming, working = 'manuscript é 🧭';
  Object.assign(c, { currentDocumentId: 'scene-a', currentDocumentTitle: 'A', currentRightTab: 'atlas',
    isTiptapMode: false, COMMAND_BUS_ROUTE: 'command.bus', METADATA_UPDATE_COMMAND_ID: 'cmd.project.metadata.update',
    atlasJourneyState: { status: 'idle', commandSeq: 0 }, atlasJourneyDraft: {}, atlasSelectedEntityId: '', atlasSelectedRelation: {},
    atlasHeatmapExplicitOpen: true, atlasTemporalLayoutExplicitOpen: true, atlasContinuityLedgerExplicitOpen: true,
    atlasContinuityRequestEpoch: 0, runCommand: {},
    manualMapPortabilityCommandState: { status: '' },
    syncAtlasSurfaceCompositionState() {}, normalizeAtlasSurface: value => value,
    updateStatusText: (value, options = {}) => statuses.push({ value, clear: options.clear === true }),
    mapCommandErrorToUi: error => ({ userMessage: 'visible:' + error.reason, code: error.code, severity: 'ERROR' }),
    console: { error: value => errors.push(value), warn: value => errors.push(value) },
    isMetadataUpdateStaleResult: () => false, renderAtlasWorkspaceState() {},
    renderAtlasJourneyState: () => renders.push(['journey', JSON.stringify(c.atlasJourneyState)]),
    logDevError: (...args) => errors.push(args),
    activeTab: 'notes', treeQueryGeneration: 0, treeContainer: null, treeRoot: null, treeMutationProjection: null,
    activeDocumentRevealRequested: false, currentDocumentKind: 'scene', metaEnabled: true,
    EXTRA_COMMAND_IDS: { PROJECT_DOCUMENT_OPEN: 'project.open', TREE_DELETE_NODE: 'tree.delete' },
    PROJECT_TREE_QUERY_ID: 'query.projectTree', normalizeProjectId: value => value,
    getEffectiveDocumentId: node => node.nodeId, getEffectiveDocumentKind: node => node.kind,
    createNavigatorSelectionState: projectId => ({ projectId }), isProjectTreeDocumentId: () => false,
    wordCommentDraft: null, wordCommentBusy: false, storyDrafts: new Map(), storyMutationPending: false,
    manuscriptDrafts: new Map(), notesMutationPending: false, flowModeState: { active: false },
    localDirty: false, lastAckedGeneration: 1, currentMetadataBaselineHash: '', metadataUpdatePending: false,
    composeDocumentContent: () => working,
    parseDocumentContent: value => ({ text: value, meta: {}, cards: [] }),
    shouldUseCentralSheetLargePayloadFastPath: () => false, reviewSurfaceResolveIncomingPayload: () => null,
    revealActiveDocumentAncestors: () => ({ found: false }), requestAnimationFrame() {},
    setPlainText: value => { working = value; }, showEditorPanelFor: value => { c.currentDocumentTitle = value; },
    localStorage: { setItem() {} }, getActiveDocumentTitleStorageKey: () => 'active-title',
  });
  for (const name of ['updateMetaVisibility', 'updateInspectorSnapshot', 'refreshMetadataInspector', 'renderTree',
    'invalidateDocxImportAttempt', 'collapseSelection', 'cancelLinkDialog', 'clearFlowModeState', 'clearPendingMetadataUpdate',
    'applyIncomingBookProfile', 'setReviewSurfaceState', 'clearCentralSheetLargePayloadFastPath', 'updateMetaInputs',
    'updateCardsList', 'updateWordCount', 'scheduleCentralSheetStripProofRefresh', 'updateSaveStateText',
    'refreshManuscriptNoteReferences', 'refreshVisibleCommentProjection', 'updatePerfHintText', 'applyPendingProjectSearchJump',
    'restoreSpatialLayoutState', 'adoptToolbarConfiguratorState', 'refreshTreeForProjectPublication', 'syncVisibleAuthoringSurfacesSurface']) c[name] = () => {};
  const projection = (row, projectId = c.currentProjectId, marker = 'current') => ({ ok: true, [row[2]]: {
    state: 'ready', projectId, sceneId: c.currentDocumentId, mapId: 'map-a', marker,
    requestedEntityId: c.atlasSelectedEntityId || '', requestedPairId: c.atlasSelectedRelation.pairId || '',
    requestedLeftEntityId: c.atlasSelectedRelation.leftEntityId || '', requestedRightEntityId: c.atlasSelectedRelation.rightEntityId || '',
    entities: [], mentions: [], graph: { projectId, mapId: 'map-a', nodes: [], edges: [], groups: [], meta: { marker } },
    summary: { mapCount: 1, workbenchHash: marker },
  } });
  for (const row of leaves) {
    c[row[1]] = 'query.' + row[2]; c[row[4]] = projection(row)[row[2]];
    if (row[5] !== 'renderManualMapWorkbenchState') c[row[5]] = () => renders.push([row[2], JSON.stringify(c[row[4]])]);
  }
  c.WORKSPACE_QUERY_ID_SET = new Set([...leaves.map(row => c[row[1]]), c.PROJECT_TREE_QUERY_ID]);
  c.window = { confirm: () => true, electronAPI: { onEditorSetText: fn => { incoming = fn; }, invokeWorkspaceQueryBridge: async ({ queryId, payload }) => {
    if (queryId === c.PROJECT_TREE_QUERY_ID) return c.treePort(payload);
    const row = leaves.find(row => c[row[1]] === queryId); assert.ok(row);
    const request = { queryId, payload: JSON.parse(JSON.stringify(payload)), row };
    queries.push(request);
    return c.queryPort ? c.queryPort(request) : projection(row, payload.projectId);
  } } };
  c.runCommandThroughBus = async (_runner, id, payload) => {
    commands.push({ id, payload: JSON.parse(JSON.stringify(payload)) });
    return c.commandPort ? c.commandPort(id, payload) : { ok: true, value: { status: 'APPLIED' } };
  };
  const names = ['withEditorModeCommandPayload', 'dispatchUiCommand', 'invokeWorkspaceQueryBridge',
    'runProductJourneyCommand', 'refreshAtlasProductSurfaces', 'refreshActiveAtlasSurface',
    'runManualMapWorkbenchCommand', 'runManualMapExportCommand', 'unwrapManualMapProductCommandReceipt',
    'runAtlasSurfaceProductCommand', 'appendAtlasJourneyField', 'appendAtlasJourneySelect',
    'openDocumentNode', 'handleDeleteNode', 'loadTree',
    'applyTreeDetachedPublication', 'applyTreeContextPublication', ...leaves.map(row => row[0]),
    ...new Set(leaves.map(row => row[3])), 'reviewSurfaceIsPlainObject'];
  for (const match of editor.matchAll(/^function (normalizeAtlas\w+)\(/gm)) if (!names.includes(match[1])) names.push(match[1]);
  const constantsStart = editor.indexOf('const ATLAS_SURFACE_IDS = Object.freeze([');
  const constantsEnd = editor.indexOf('const ATLAS_DEFERRED_SURFACE_IDS =', constantsStart);
  assert.ok(constantsStart >= 0 && constantsEnd > constantsStart);
  vm.runInContext(editor.slice(constantsStart, constantsEnd) + names.map(text).join('\n'), c);
  const listenerStart = editor.indexOf('window.electronAPI.onEditorSetText((payload) => {');
  const listenerEnd = editor.indexOf('  window.electronAPI.onEditorTextRequest(', listenerStart);
  assert.ok(listenerStart >= 0 && listenerEnd > listenerStart);
  vm.runInContext(transform ? transform(editor.slice(listenerStart, listenerEnd)) : editor.slice(listenerStart, listenerEnd), c);
  const dispatch = c.dispatchUiCommand;
  c.dispatchUiCommand = async (...args) => { const result = await dispatch(...args); delivered.push(result); return result; };
  return { ...h, c, deferred, leaves, projection, statuses, errors, queries, commands, delivered, renders,
    incoming: payload => incoming(payload), working: () => working };
}

test('R2 C02 delayed actual Apply and Journey cannot replace a same-target newer draft', async () => {
  const h = publicationHarness(), response = h.deferred();
  h.c.commandPort = () => response.promise;
  h.open('label'); const pending = h.c.applyManualMapCommandDraft();
  assert.equal(h.commands.length, 1);
  const current = h.open('label'); current.focus(); current.setSelectionRange(2, 5, 'backward');
  await h.edit(current, 'B e\u0301 🧭');
  const expected = h.draft(), form = h.form(), selection = [current.selectionStart, current.selectionEnd, current.selectionDirection];
  const actualReceipt = { ok: true, value: { status: 'APPLIED', receiptId: 'typed-port-A' } };
  response.resolve(actualReceipt); await pending;
  assert.deepEqual(h.draft(), expected, 'old actual completion must not restore draft A over B');
  assert.equal(h.form(), form); assert.equal(h.field(), current); assert.equal(h.document.activeElement, current);
  assert.deepEqual([current.selectionStart, current.selectionEnd, current.selectionDirection], selection);
  assert.equal(h.commands.length, 1, 'no retry or rollback dispatch');
  assert.equal(h.delivered[0], actualReceipt, 'retain actual transport result without relabelling it cancellation');
});

test('R2 C02 stale actual dispatch refusal cannot overwrite the newer draft status', async () => {
  const h = publicationHarness(), response = h.deferred(); h.c.commandPort = () => response.promise;
  h.open('label'); const pending = h.c.applyManualMapCommandDraft();
  h.open('label'); h.statuses.push({ value: 'B current', clear: false });
  response.resolve({ ok: false, error: { code: 'E_COMMAND_FAILED', op: 'manualMap.node.add', reason: 'CAPABILITY_DISABLED_FOR_COMMAND' } });
  await pending;
  assert.equal(h.statuses.at(-1).value, 'B current', 'late failure has no current presentation ownership');
  assert.equal(h.errors.length, 0); assert.equal(h.commands.length, 1);
});

function callPublicationLeaf(h, row, options = {}) {
  return row[0] === 'refreshAtlasTemporalLayout' ? h.c[row[0]](null, options) : h.c[row[0]](options);
}
function focusedDraftWitness(h) {
  const input = h.field(); assert.ok(input); input.focus(); input.setSelectionRange(2, 4, 'backward');
  return { input, form: h.form(), value: input.value, selection: [input.selectionStart, input.selectionEnd, input.selectionDirection], draft: h.draft() };
}
function assertDraftWitness(h, witness) {
  assert.equal(h.field(), witness.input); assert.equal(h.form(), witness.form);
  assert.equal(h.document.activeElement, witness.input); assert.equal(witness.input.value, witness.value);
  assert.deepEqual([witness.input.selectionStart, witness.input.selectionEnd, witness.input.selectionDirection], witness.selection);
  assert.deepEqual(h.draft(), witness.draft);
}

for (let index = 0; index < 12; index++) {
  test('R2 C02 actual reader ' + index + ' retains Q2 when Q1 completes later', async () => {
    const h = publicationHarness(), row = h.leaves[index], first = h.deferred(), second = h.deferred();
    h.c.queryPort = () => h.queries.length === 1 ? first.promise : second.promise;
    const q1 = callPublicationLeaf(h, row), q2 = callPublicationLeaf(h, row);
    assert.equal(h.queries.length, 2);
    second.resolve(h.projection(row, 'project-a', 'Q2')); await q2;
    const expected = JSON.stringify(h.c[row[4]]), renders = h.renders.length, domRenders = h.counters.renders;
    first.resolve(h.projection(row, 'project-a', 'Q1')); await q1;
    assert.equal(JSON.stringify(h.c[row[4]]), expected); assert.equal(h.renders.length, renders);
    assert.equal(h.counters.renders, domRenders); assert.equal(h.c[row[4]].state, 'ready');
  });
  test('R2 C02 actual reader ' + index + ' cannot republish over a newer field edit', async () => {
    const h = publicationHarness(), row = h.leaves[index], response = h.deferred(); h.open('label');
    h.c.queryPort = () => response.promise;
    const pending = callPublicationLeaf(h, row);
    if (index === 0) { // Loading intentionally hides the form; a newer real projection restores it.
      h.c.queryPort = request => h.projection(request.row); await callPublicationLeaf(h, row);
    }
    const input = h.field(); assert.ok(input); input.focus(); input.setSelectionRange(2, 2);
    await h.edit(input, 'B é 🧭'); const witness = focusedDraftWitness(h);
    const expected = JSON.stringify(h.c[row[4]]), renders = h.renders.length, domRenders = h.counters.renders;
    response.resolve(h.projection(row, 'project-a', 'old')); await pending;
    assertDraftWitness(h, witness); assert.equal(JSON.stringify(h.c[row[4]]), expected);
    assert.equal(h.renders.length, renders); assert.equal(h.counters.renders, domRenders);
  });
  test('R2 C02 actual reader ' + index + ' refuses stale parent before loading render', async () => {
    const h = publicationHarness(), row = h.leaves[index], current = h.c.captureAtlasPublication();
    h.open('label'); const witness = focusedDraftWitness(h), state = JSON.stringify(h.c[row[4]]);
    const renders = h.renders.length, domRenders = h.counters.renders;
    await callPublicationLeaf(h, row, { isCurrent: current });
    assert.equal(h.queries.length, 0); assert.equal(JSON.stringify(h.c[row[4]]), state);
    assert.equal(h.renders.length, renders); assert.equal(h.counters.renders, domRenders); assertDraftWitness(h, witness);
  });
  for (const malformed of ['foreign-project', 'array', 'missing-project']) test('R2 C02 actual reader ' + index + ' rejects ' + malformed, async () => {
    const h = publicationHarness(), row = h.leaves[index], result = h.projection(row);
    if (malformed === 'foreign-project') result[row[2]].projectId = 'project-foreign';
    if (malformed === 'array') result[row[2]] = [];
    if (malformed === 'missing-project') delete result[row[2]].projectId;
    h.c.queryPort = () => result; await callPublicationLeaf(h, row);
    assert.equal(h.c[row[4]].state, 'unavailable'); assert.equal(h.c[row[4]].projectId, 'project-a');
    assert.equal(h.commands.length, 0);
  });
}

test('R2 C02 real query echoes reject foreign entity coordinates while allowing canonical selected fallbacks', async () => {
  const h = publicationHarness(); h.c.atlasSelectedEntityId = 'missing-entity';
  h.c.atlasSelectedRelation = { pairId: 'missing-pair', leftEntityId: 'left', rightEntityId: 'right' };
  for (const index of [4, 5]) {
    const row = h.leaves[index], valid = h.projection(row);
    Object.assign(valid[row[2]], index === 4 ? { selectedEntityId: 'existing-entity' } : {
      selectedPairId: 'existing-pair', relation: { leftEntityId: 'existing-left', rightEntityId: 'existing-right' } });
    const fields = index === 4 ? ['requestedEntityId'] : ['requestedPairId', 'requestedLeftEntityId', 'requestedRightEntityId'];
    for (const field of fields) {
      const wrong = JSON.parse(JSON.stringify(valid)); wrong[row[2]][field] = 'foreign-coordinate';
      h.c.queryPort = () => wrong; await callPublicationLeaf(h, row);
      assert.equal(h.c[row[4]].state, 'unavailable');
      assert.equal(index === 4 ? h.c.atlasSelectedEntityId : h.c.atlasSelectedRelation.pairId, index === 4 ? 'missing-entity' : 'missing-pair');
    }
    h.c.queryPort = () => valid; await callPublicationLeaf(h, row);
    assert.equal(h.c[row[4]].state, 'ready');
    assert.equal(index === 4 ? h.c.atlasSelectedEntityId : h.c.atlasSelectedRelation.pairId, index === 4 ? 'existing-entity' : 'existing-pair');
  }
});

test('R2 C02 current Map query keeps the supported first-map fallback and rejects changed current selection', async () => {
  const h = publicationHarness(), row = h.leaves[0]; h.c.manualMapWorkbenchState.mapId = 'vanished';
  h.c.queryPort = () => h.projection(row); await h.c.refreshManualMapWorkbench();
  assert.equal(h.c.manualMapWorkbenchState.mapId, 'map-a'); assert.equal(h.c.manualMapWorkbenchState.state, 'ready');
  const response = h.deferred(); h.c.queryPort = () => response.promise;
  const pending = h.c.refreshManualMapWorkbench(); h.c.manualMapWorkbenchState.mapId = 'user-selected-b';
  const expected = JSON.stringify(h.c.manualMapWorkbenchState); response.resolve(h.projection(row)); await pending;
  assert.equal(JSON.stringify(h.c.manualMapWorkbenchState), expected);
});

test('R2 C02 currentScene requires the requested scene even for an explicitly empty selection', async () => {
  for (const sceneId of ['scene-a', '']) {
    const h = publicationHarness(), row = h.leaves[1]; h.c.currentDocumentId = sceneId;
    const wrong = h.projection(row); wrong.atlasCurrentScene.sceneId = 'foreign-scene';
    h.c.queryPort = () => wrong; await h.c.refreshAtlasCurrentScene();
    assert.equal(h.c.atlasCurrentSceneState.state, 'unavailable');
    h.c.queryPort = () => h.projection(row); await h.c.refreshAtlasCurrentScene();
    assert.equal(h.c.atlasCurrentSceneState.state, 'ready'); assert.equal(h.c.atlasCurrentSceneState.sceneId, sceneId);
  }
});

test('R2 C02 current failure remains visible and cannot be converted into an applied receipt', async () => {
  const h = publicationHarness(); h.open('label');
  const receipt = { ok: false, error: { code: 'E_COMMAND_FAILED', reason: 'CAPABILITY_DISABLED_FOR_COMMAND' } };
  h.c.commandPort = () => receipt; await h.c.applyManualMapCommandDraft();
  assert.equal(h.draft().state, 'failed'); assert.equal(h.draft().result.status, 'FAILED');
  assert.equal(h.statuses.filter(value => value.value === 'visible:CAPABILITY_DISABLED_FOR_COMMAND').length, 1);
  assert.equal(h.errors.length, 1); assert.equal(h.commands.length, 1); assert.equal(h.delivered[0], receipt);
});

test('R2 C02 a released command cannot publish its independently delayed child after B is current', async () => {
  const h = publicationHarness(), command = h.deferred(), scene = h.deferred(); h.open('label');
  h.c.commandPort = () => command.promise;
  h.c.queryPort = request => request.row[0] === 'refreshAtlasCurrentScene' ? scene.promise : h.projection(request.row);
  const pending = h.c.applyManualMapCommandDraft(), receipt = { ok: true, value: { status: 'APPLIED', receiptId: 'A' } };
  command.resolve(receipt); await h.settle();
  assert.equal(h.queries.length, 1); assert.equal(h.queries[0].row[0], 'refreshAtlasCurrentScene');
  h.open('label'); const witness = focusedDraftWitness(h), state = JSON.stringify(h.c.atlasCurrentSceneState);
  scene.resolve(h.projection(h.leaves[1])); await pending;
  assertDraftWitness(h, witness); assert.equal(JSON.stringify(h.c.atlasCurrentSceneState), state);
  assert.equal(h.queries.length, 1, 'stale parent must not start its later fanout/manual refresh');
  assert.equal(h.delivered[0], receipt);
});

test('R2 C02 all eight real Journey fanout replies are fenced independently after parent completion', async () => {
  const h = publicationHarness(), gates = [];
  h.c.queryPort = request => {
    if (request.row[0] === 'refreshAtlasCurrentScene') return h.projection(request.row);
    const gate = h.deferred(); gates.push({ ...gate, row: request.row }); return gate.promise;
  };
  const receipt = { ok: true, value: { status: 'APPLIED' } }; h.c.commandPort = () => receipt;
  assert.equal(await h.c.runProductJourneyCommand('manualMap.node.add', { mapId: 'map-a', label: 'A' }), receipt);
  assert.equal(gates.length, 8); assert.deepEqual(gates.map(g => g.row[0]).sort(), [
    'refreshAtlasOverview', 'refreshAtlasEntityDossier', 'refreshAtlasRelationDossier', 'refreshAtlasMatrices',
    'refreshAtlasReportsSavedQueries', 'refreshAtlasDiagnosticsStageAcceptance', 'refreshManualMapWorkbench', 'refreshProjectionInspector'].sort());
  h.c.queryPort = request => h.projection(request.row);
  await h.c.refreshManualMapWorkbench(); h.open('label'); const witness = focusedDraftWitness(h);
  const states = h.leaves.map(row => JSON.stringify(h.c[row[4]])), renders = h.renders.length, domRenders = h.counters.renders;
  for (const gate of gates) {
    gate.resolve(h.projection(gate.row, 'project-a', 'A')); await h.settle();
    assert.deepEqual(h.leaves.map(row => JSON.stringify(h.c[row[4]])), states); assertDraftWitness(h, witness);
    assert.equal(h.renders.length, renders); assert.equal(h.counters.renders, domRenders);
  }
});

for (const wrapper of ['runManualMapWorkbenchCommand', 'runManualMapExportCommand', 'runAtlasSurfaceProductCommand']) {
  test('R2 C02 ' + wrapper + ' retains B presentation when same-context A completes last', async () => {
    const h = publicationHarness(), a = h.deferred(), b = h.deferred();
    h.c.commandPort = () => h.commands.length === 1 ? a.promise : b.promise;
    const pendingA = h.c[wrapper]('manualMap.export.json', { mapId: 'map-a' });
    const pendingB = h.c[wrapper]('manualMap.export.json', { mapId: 'map-a' });
    const receiptB = { ok: true, value: { mapId: 'map-b', export: { jsonSha256: 'B' } } };
    b.resolve(receiptB); assert.equal(await pendingB, receiptB); await h.settle();
    const state = JSON.stringify({ journey: h.c.atlasJourneyState, portability: h.c.manualMapPortabilityCommandState });
    const counts = [h.queries.length, h.counters.renders, h.renders.length, h.statuses.length];
    const receiptA = { ok: true, value: { mapId: 'map-a', export: { jsonSha256: 'A' } } };
    a.resolve(receiptA); assert.equal(await pendingA, receiptA); await h.settle();
    assert.equal(JSON.stringify({ journey: h.c.atlasJourneyState, portability: h.c.manualMapPortabilityCommandState }), state);
    assert.deepEqual([h.queries.length, h.counters.renders, h.renders.length, h.statuses.length], counts);
    assert.equal(h.commands.length, 2);
  });
}

test('R2 C02 editing the same live draft while Apply waits retains working text without retrying the actual effect', async () => {
  const h = publicationHarness(), gate = h.deferred(); h.open('label'); h.c.commandPort = () => gate.promise;
  const pending = h.c.applyManualMapCommandDraft();
  // The current form's native field can still deliver its already queued input.
  h.c.updateManualMapCommandDraftField('label', 'B exact é 🧭');
  const expected = h.draft(), count = h.counters.renders;
  const receipt = { ok: true, value: { status: 'APPLIED' } }; gate.resolve(receipt); await pending;
  assert.deepEqual(h.draft(), expected); assert.equal(h.counters.renders, count);
  assert.equal(h.delivered[0], receipt); assert.equal(h.commands.length, 1);
});

for (const lifecycle of ['same-id-payload', 'away-back-payload', 'context', 'detach', 'open-away-back', 'tree-away-back', 'delete']) {
  test('R2 C02 actual ' + lifecycle + ' invalidates old command publication', async () => {
    const h = publicationHarness(), gate = h.deferred(); h.c.currentTreeContentPublicationId = '';
    h.open('label'); h.c.commandPort = () => gate.promise; const pending = h.c.applyManualMapCommandDraft();
    const payload = { projectId: 'project-a', documentId: 'scene-a', kind: 'scene', metaEnabled: true,
      title: 'Current', content: h.working(), expectedContent: h.working(), expectedGeneration: 1 };
    if (lifecycle === 'same-id-payload') h.incoming(payload);
    if (lifecycle === 'away-back-payload') { h.incoming({ ...payload, projectId: 'project-b' }); h.incoming(payload); }
    if (lifecycle === 'context') assert.equal(h.c.applyTreeContextPublication({ ...payload, treePublication: true }), true);
    if (lifecycle === 'detach') assert.equal(h.c.applyTreeDetachedPublication({ ...payload, treeDetached: true,
      expectedDocumentId: 'scene-a', documentId: '' }), true);
    if (lifecycle === 'open-away-back') {
      h.c.commandPort = (_id, value) => ({ ok: true, value: { documentId: value.nodeId } });
      assert.equal(await h.c.openDocumentNode({ nodeId: 'scene-b', kind: 'scene' }), true);
      assert.equal(await h.c.openDocumentNode({ nodeId: 'scene-a', kind: 'scene' }), true);
    }
    if (lifecycle === 'tree-away-back') {
      h.c.treePort = () => ({ ok: true, projectId: h.c.currentProjectId === 'project-a' ? 'project-b' : 'project-a', root: {} });
      await h.c.loadTree(); await h.c.loadTree(); assert.equal(h.c.currentProjectId, 'project-a');
    }
    if (lifecycle === 'delete') {
      h.c.commandPort = () => ({ ok: true }); h.c.treePort = () => ({ ok: true, projectId: 'project-a', root: {} });
      await h.c.handleDeleteNode({ nodeId: 'scene-a' }); assert.equal(h.c.currentDocumentId, null);
    }
    await h.settle(); const state = JSON.stringify({ journey: h.c.atlasJourneyState, draft: h.draft() });
    const count = [h.renders.length, h.queries.length, h.statuses.length, h.counters.renders];
    gate.resolve({ ok: true, value: { status: 'APPLIED' } }); await pending; await h.settle();
    assert.equal(JSON.stringify({ journey: h.c.atlasJourneyState, draft: h.draft() }), state);
    assert.deepEqual([h.renders.length, h.queries.length, h.statuses.length, h.counters.renders], count);
    assert.equal(h.working(), 'manuscript é 🧭');
  });
}

for (const control of ['field', 'select']) test('R2 C02 real Journey ' + control + ' edits invalidate old command and query presentation', async () => {
  const h = publicationHarness(), gate = h.deferred(); h.c.commandPort = () => gate.promise;
  const pending = h.c.runProductJourneyCommand('atlas.entity.rename', { entityId: 'entity-a', name: 'A' });
  const input = control === 'field' ? h.c.appendAtlasJourneyField(h.rail, { fieldName: 'entityName', value: 'A' })
    : h.c.appendAtlasJourneySelect(h.rail, { fieldName: 'sourceEntityId', value: 'A', options: [{ value: 'B' }] });
  input.focus(); input.value = 'B'; await input.emit(control === 'field' ? 'input' : 'change');
  const state = JSON.stringify(h.c.atlasJourneyState), draft = JSON.stringify(h.c.atlasJourneyDraft), renders = h.renders.length;
  const receipt = { ok: true, value: { status: 'APPLIED' } }; gate.resolve(receipt);
  assert.equal(await pending, receipt); assert.equal(JSON.stringify(h.c.atlasJourneyState), state);
  assert.equal(JSON.stringify(h.c.atlasJourneyDraft), draft); assert.equal(h.renders.length, renders);
  assert.equal(h.queries.length, 0); assert.equal(h.document.activeElement, input);
});

test('R2 C02 active Journey finally cannot rebuild B after its currentScene child becomes stale', async () => {
  const h = publicationHarness(), gate = h.deferred(); h.c.currentAtlasSurface = 'journey';
  h.c.queryPort = () => gate.promise; h.c.refreshActiveAtlasSurface(); assert.equal(h.queries.length, 1);
  h.open('label'); const witness = focusedDraftWitness(h), renders = h.renders.length;
  gate.resolve(h.projection(h.leaves[1])); await h.settle();
  assert.equal(h.renders.length, renders); assertDraftWitness(h, witness);
});

test('R2 C02 stale product-surface parent cannot start any loading render or query', async () => {
  const h = publicationHarness(), current = h.c.captureAtlasPublication(); h.open('label');
  const witness = focusedDraftWitness(h), renders = h.renders.length, domRenders = h.counters.renders;
  await h.c.refreshAtlasProductSurfaces({ isCurrent: current });
  assert.equal(h.queries.length, 0); assert.equal(h.renders.length, renders); assert.equal(h.counters.renders, domRenders);
  assertDraftWitness(h, witness);
});

test('R2 C02 current source-edit generation, cancel and tab changes refuse late query publication', async () => {
  for (const change of ['generation', 'cancel', 'tab', 'surface']) {
    const h = publicationHarness(), row = h.leaves[2], gate = h.deferred(); h.open('label');
    h.c.queryPort = () => gate.promise; const pending = callPublicationLeaf(h, row);
    if (change === 'generation') h.c.localEditGeneration++;
    if (change === 'cancel') h.c.cancelManualMapCommandDraft();
    if (change === 'tab') h.c.currentRightTab = 'metadata';
    if (change === 'surface') h.c.currentAtlasSurface = 'overview';
    const expected = JSON.stringify(h.c[row[4]]), renders = h.renders.length;
    gate.resolve(h.projection(row)); await pending;
    assert.equal(JSON.stringify(h.c[row[4]]), expected); assert.equal(h.renders.length, renders);
  }
});

test('R2 C02 declined lifecycle payload cannot cancel an otherwise current Atlas publication', async () => {
  const h = publicationHarness(), current = h.c.captureAtlasPublication();
  assert.equal(h.c.applyTreeContextPublication({ treePublication: true, projectId: 'foreign' }), false);
  assert.equal(h.c.applyTreeDetachedPublication({ treeDetached: true, projectId: 'foreign' }), false);
  assert.equal(current(), true); assert.equal(h.working(), 'manuscript é 🧭');
});

// Each mutant compiles the same actual functions. Only semantic assertion
// failure counts as sensitivity; missing bindings and parse errors cannot pass.
async function sequenceOracle(transform) {
  const h = publicationHarness(transform), a = h.deferred(), b = h.deferred();
  h.c.commandPort = () => h.commands.length === 1 ? a.promise : b.promise;
  const pa = h.c.runManualMapExportCommand('manualMap.export.json', { mapId: 'map-a' });
  const pb = h.c.runManualMapExportCommand('manualMap.export.json', { mapId: 'map-a' });
  b.resolve({ ok: true, value: { mapId: 'B', export: { jsonSha256: 'B' } } }); await pb; await h.settle();
  const expected = JSON.stringify(h.c.manualMapPortabilityCommandState);
  a.resolve({ ok: true, value: { mapId: 'A', export: { jsonSha256: 'A' } } }); await pa;
  assert.equal(JSON.stringify(h.c.manualMapPortabilityCommandState), expected, 'OUTER_SEQUENCE_REQUIRED');
}
async function queryOrderOracle(transform) {
  const h = publicationHarness(transform), row = h.leaves[2], a = h.deferred(), b = h.deferred();
  h.c.queryPort = () => h.queries.length === 1 ? a.promise : b.promise;
  const pa = callPublicationLeaf(h, row), pb = callPublicationLeaf(h, row);
  const valueB = h.projection(row); valueB[row[2]].unavailableReason = 'B';
  b.resolve(valueB); await pb; const expected = JSON.stringify(h.c[row[4]]);
  a.resolve(h.projection(row)); await pa; assert.equal(JSON.stringify(h.c[row[4]]), expected, 'QUERY_ORDER_REQUIRED');
}
async function lifecycleOracle(transform) {
  const h = publicationHarness(transform), gate = h.deferred(); h.c.currentTreeContentPublicationId = '';
  h.c.commandPort = () => gate.promise; const pending = h.c.runProductJourneyCommand('manualMap.node.add', { mapId: 'map-a' });
  h.incoming({ projectId: 'project-a', documentId: 'scene-a', kind: 'scene', metaEnabled: true, title: 'A', content: h.working() });
  await h.settle(); const expected = JSON.stringify(h.c.atlasJourneyState);
  gate.resolve({ ok: true, value: { status: 'APPLIED' } }); await pending;
  assert.equal(JSON.stringify(h.c.atlasJourneyState), expected, 'LIFECYCLE_EPOCH_REQUIRED');
}
async function parentOracle(transform) {
  const h = publicationHarness(transform), row = h.leaves[2], current = h.c.captureAtlasPublication();
  h.open('label'); const before = [h.queries.length, h.renders.length];
  await callPublicationLeaf(h, row, { isCurrent: current });
  assert.deepEqual([h.queries.length, h.renders.length], before, 'PARENT_BEFORE_EFFECT_REQUIRED');
}
async function errorOracle(transform) {
  const h = publicationHarness(transform), gate = h.deferred(); h.open('label'); h.c.commandPort = () => gate.promise;
  const pending = h.c.applyManualMapCommandDraft(); h.open('label'); h.statuses.push({ value: 'B' });
  gate.resolve({ ok: false, error: { code: 'E_COMMAND_FAILED', reason: 'CAPABILITY_DISABLED_FOR_COMMAND' } }); await pending;
  assert.equal(h.statuses.at(-1).value, 'B', 'EARLY_PRESENTATION_OWNER_REQUIRED');
}
async function revisionOracle(transform) {
  const h = publicationHarness(transform), row = h.leaves[2], gate = h.deferred(); h.open('label');
  h.c.queryPort = () => gate.promise; const pending = callPublicationLeaf(h, row);
  await h.edit(h.field(), 'B'); const expected = JSON.stringify(h.c[row[4]]), renders = h.renders.length;
  gate.resolve(h.projection(row)); await pending;
  assert.equal(JSON.stringify(h.c[row[4]]), expected, 'FIELD_REVISION_REQUIRED'); assert.equal(h.renders.length, renders, 'FIELD_REVISION_REQUIRED');
}
const semanticMutants = [
  ['outer-sequence', sequenceOracle, text => text.startsWith('async function runManualMapExportCommand(')
    ? text.replace('sequence === atlasCommandPublicationSequence', 'true') : text],
  ['query-order', queryOrderOracle, text => text.replace('sequence === atlasQueryPublicationSequences.get(key)', 'true')],
  ['lifecycle-epoch', lifecycleOracle, text => text.replace('atlasPublicationEpoch += 1;', 'atlasPublicationEpoch += 0;')],
  ['parent-before-loading', parentOracle, text => text.replace('if (options.isCurrent && !options.isCurrent()) return null;', ';')],
  ['early-error-presentation', errorOracle, text => text.replace('!deferredMetadataError && ownsPresentation()', '!deferredMetadataError')],
  ['per-edit-revision', revisionOracle, text => text.replace('draftRevision === manualMapDraftRevision', 'true')],
];
for (const [name, oracle, mutant] of semanticMutants) test('R2 C02 actual semantic oracle rejects compiling ' + name + ' mutant', async () => {
  await oracle();
  await assert.rejects(() => oracle(mutant), error => error.code === 'ERR_ASSERTION', 'semantic mutant must fail an outcome assertion');
});

test('R2 C02 normal current Apply permits slow current fanout siblings after its applied draft publication', async () => {
  const h = publicationHarness(), scene = h.deferred(), outerMap = h.deferred(), siblings = [];
  let mapRequests = 0;
  h.c.queryPort = request => {
    if (request.row[0] === 'refreshAtlasCurrentScene') return scene.promise;
    if (request.row[0] === 'refreshManualMapWorkbench' && ++mapRequests === 2) return outerMap.promise;
    const gate = h.deferred(); siblings.push({ ...gate, row: request.row }); return gate.promise;
  };
  h.open('label'); const pending = h.c.applyManualMapCommandDraft(); await h.settle();
  assert.equal(h.queries.length, 1); scene.resolve(h.projection(h.leaves[1])); await h.settle();
  assert.equal(siblings.length, 8); assert.equal(mapRequests, 2); assert.equal(h.draft().state, 'applying');
  outerMap.resolve(h.projection(h.leaves[0], 'project-a', 'outerMap')); await pending;
  assert.equal(h.draft().state, 'applied'); const draft = h.draft();
  for (const sibling of siblings.filter(s => s.row[0] !== 'refreshManualMapWorkbench')) {
    sibling.resolve(h.projection(sibling.row)); await h.settle();
    assert.equal(h.c[sibling.row[4]].state, 'ready', 'legitimate current sibling must publish after Apply');
    assert.deepEqual(h.draft(), draft);
  }
  siblings.find(s => s.row[0] === 'refreshManualMapWorkbench').resolve(h.projection(h.leaves[0], 'project-a', 'olderMap'));
  await h.settle(); assert.equal(h.c.manualMapWorkbenchState.summary.workbenchHash, 'outerMap');
  assert.deepEqual(h.draft(), draft); assert.equal(h.commands.length, 1);
});
