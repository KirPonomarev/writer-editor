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
// The finite DOM port models focused-subtree removal/movement; it is not native/IME proof.
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
      this.attributes = {}; this.style = {};
      this.disconnects = 0; this.focusCalls = 0;
      this.classList = { add: name => { this.className = `${this.className || ''} ${name}`.trim(); } };
    }
    get isContentEditable() {
      const value = this.attributes.contenteditable;
      return value === 'false' ? false : ['', 'true', 'plaintext-only'].includes(value) || !!this.parentElement?.isContentEditable;
    }
    closest(selector) {
      for (let node = this; node; node = node.parentElement) {
        if (selector.split(',').some(part => {
          part = part.trim();
          if (/^[a-z]+$/.test(part)) return node.tagName === part.toUpperCase();
          const match = /^\[([a-z-]+)(?:="([^"]*)")?\]$/.exec(part);
          assert.ok(match, 'finite DOM closest selector must be explicit: ' + part);
          const value = match[1].startsWith('data-') ? node.dataset[dataName(match[1].slice(5))] : node.attributes[match[1]];
          return value !== undefined && (match[2] === undefined || value === match[2]);
        })) return node;
      }
      return null;
    }
    get isConnected() { return this === document.body || !!this.parentElement?.isConnected; }
    contains(node) { return this === node || this.children.some((child) => child.contains(node)); }
    append(...nodes) { nodes.forEach((node) => this.appendChild(node)); }
    appendChild(node) { return this.insertBefore(node, null); }
    insertBefore(node, anchor) {
      assert.ok(anchor === null || anchor.parentElement === this);
      if (node.fragment) { [...node.children].forEach(child => this.insertBefore(child, anchor)); return node; }
      if (node.parentElement) node.remove();
      node.parentElement = this;
      this.children.splice(anchor === null ? this.children.length : this.children.indexOf(anchor), 0, node); return node;
    }
    remove() {
      if (this.isConnected) {
        const mark = node => { node.disconnects++; node.children.forEach(mark); }; mark(this);
      }
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
    focus() { this.focusCalls++; document.activeElement = this; }
    setAttribute(name, value) {
      this.attributes[name] = String(value);
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
  document.createElementNS = (namespace, tag) => new Element(tag);
  document.createDocumentFragment = () => Object.assign(new Element('fragment'), { fragment: true });
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
  if (editor.includes('function captureManualMapControlContext(')) names.push('captureManualMapControlContext');
  names.push('unwrapManualMapProductCommandReceipt');
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
  const loadActual = (...names) => vm.runInContext(names.map(sourceFunction).join('\n'), context);
  return { document, rail, plan, context, calls, counters, field, open, edit, draft, form, settle, loadActual };
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
  vm.runInContext(fs.readFileSync(path.join(repoRoot, 'src/core/browser-safe-hash.mjs'), 'utf8').replace(/^export /gm, ''), c);
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
    getPlainText: () => working,
    parseDocumentContent: require('../../src/core/document-content-envelope-v1.cjs').parseObservablePayload,
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
    summary: { mapCount: 1, workbenchHash: marker, sceneTextHash: c.hashCanonicalValue(working) },
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
    if (index === 0) { // A newer current query makes the earlier response stale, including its loading phase.
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

function manualAuthoringDomHarness() {
  const h = draftDomHarness(), c = h.context;
  const graph = { nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], edges: [], groups: [] };
  Object.assign(c, { manualMapTransientViewState: { selection: { primaryNodeId: 'a', nodeIds: ['a'], edgeIds: [] } },
    crypto: require('node:crypto').webcrypto,
    manualMapPortabilityCommandState: {},
    manualMapListState: {}, manualMapPinnedNodeIds: new Set(), manualMapDragState: null,
    MANUAL_MAP_DEFAULT_VIEWPORT: { x: 0, y: 0, zoom: 1 }, normalizeManualMapViewState: value => value,
    currentDocumentTitle: 'Scene', atlasJourneyDraft: {}, findAtlasJourneyEntity: () => null,
    makeStableUiId: (() => { let i = 0; return name => name + ++i; })(), manualMapLayoutMode: 'manual',
    MANUAL_MAP_LAYOUT_MODES: { MANUAL: 'manual', HIERARCHY: 'hierarchy' }, MANUAL_MAP_WORKBENCH_QUERY_ID: 'query.manualMapWorkbench',
    invokeWorkspaceQueryBridge: async () => { throw Error('UNEXPECTED_QUERY'); } });
  c.manualMapWorkbenchState.mapRows = [{ mapId: 'map-a', title: 'Source' }, { mapId: 'map-b', title: 'Target B' }, { mapId: 'map-c', title: 'Target C' }];
  h.loadActual('makeManualMapAuthorId', 'manualMapHasRetainedDraft', 'selectManualMap', 'refreshManualMapPortalTargets',
    'getManualMapSelectedNodeId', 'getManualMapSelectedEdgeId', 'getManualMapNodeById', 'getManualMapEdgeById',
    'getManualMapGroupByNodeId', 'makeManualMapDraftButton', 'renderManualMapToolbar');
  const toolbar = () => c.renderManualMapToolbar(h.rail, c.manualMapWorkbenchState, { sourceGraph: graph, presentationGraph: graph }, { compact: true });
  const button = label => h.rail.querySelectorAll('[data-manual-map-command-draft]').find(node => node.textContent === label);
  const input = name => h.rail.querySelectorAll('[data-manual-map-command-field]').find(node => node.dataset.manualMapCommandField === name);
  return { ...h, c, toolbar, button, input };
}

test('manual-map labelled PDF control sends only selected map intent and preserves working inputs in both hosts', async () => {
  for (const host of ['rail', 'plan']) {
    const h = manualAuthoringDomHarness();
    h.loadActual('runManualMapExportCommand', 'renderManualMapPortabilityCommandReadback');
    h.c.manualMapPortabilityCommandState.pdfTypedLoss = 'OLD_TYPED_LOSS';
    h.toolbar(); const oldPdf = h.rail.querySelectorAll('[data-manual-map-portability-action]').find(node => node.textContent === 'Export PDF');
    assert.equal(oldPdf.disabled, false);
    h.open(); const input = h.field(h[host]); input.focus(); input.setSelectionRange(2, 4);
    const draft = h.draft(), buttons = h[host].querySelectorAll('[data-manual-map-portability-action]');
    const pdf = buttons.find(node => node.dataset.manualMapPortabilityAction === 'export-pdf');
    const svg = buttons.find(node => node.dataset.manualMapPortabilityAction === 'export-image-pdf');
    assert.equal(pdf.tagName, 'BUTTON'); assert.equal(pdf.type, 'button'); assert.equal(pdf.textContent, 'Export PDF');
    assert.equal(pdf.className, svg.className); assert.equal(svg.textContent, 'Export SVG'); assert.equal(pdf.disabled, true);
    assert.equal(pdf.title, 'Apply or cancel the current draft before exporting PDF');
    assert.equal(pdf.dataset.productCommandId, 'manualMap.export.imagePdf');
    for (const state of ['draft', 'applying', 'failed']) {
      h.c.manualMapCommandDraft.state = state; const retained = h.draft();
      await pdf.emit('click'); await oldPdf.emit('click'); await h.settle();
      assert.deepEqual(h.calls, []); assert.deepEqual(h.draft(), retained);
      assert.equal(h.field(h[host]) === input, true); assert.equal(h.document.activeElement === input, true);
      assert.equal(input.selectionStart, 2); assert.equal(input.selectionEnd, 4);
    }
    h.c.manualMapCommandDraft.state = 'draft'; assert.deepEqual(h.draft(), draft);
    h.c.cancelManualMapCommandDraft(); assert.equal(h.draft().state, 'cancelled');
    const readyPdf = h[host].querySelectorAll('[data-manual-map-portability-action]').find(node => node.textContent === 'Export PDF');
    assert.equal(readyPdf.disabled, false);
    h.c.commandResult = { ok: true, value: { mapId: 'map-a', export: { format: 'pdf', mediaType: 'application/pdf',
      sha256: 'a'.repeat(64), byteLength: 420, pdf: { binaryGenerated: true } } } };
    await readyPdf.emit('click'); await h.settle();
    assert.deepEqual(h.calls, [{ commandId: 'manualMap.export.imagePdf', payload: { mapId: 'map-a', requestedFormat: 'pdf' } }]);
    assert.equal(h.c.manualMapPortabilityCommandState.pdfSha256, 'a'.repeat(64));
    assert.equal(h.c.manualMapPortabilityCommandState.pdfTypedLoss, '');
    assert.equal(h.draft().state, 'cancelled');
    assert.match(h[host].querySelectorAll('[data-manual-map-portability-command-state]').find(node =>
      node.dataset.manualMapPortabilityCommandState === 'pdf').textContent, /aaaaaaaaaaaa/u);
    h.c.manualMapWorkbenchState.mapId = ''; h[host].innerHTML = '';
    h.c.renderManualMapToolbar(h[host], h.c.manualMapWorkbenchState, { sourceGraph: {}, presentationGraph: {} });
    const disabled = h[host].querySelectorAll('[data-manual-map-portability-action]').find(node => node.textContent === 'Export PDF');
    assert.equal(disabled.disabled, true); await disabled.emit('click'); assert.equal(h.calls.length, 1);
  }
});

test('manual-map PDF receipt publishes only for the current project and latest export sequence', async () => {
  for (const stale of ['project', 'sequence']) {
    const h = publicationHarness(), first = h.deferred(), second = h.deferred();
    h.c.manualMapPortabilityCommandState.pdfTypedLoss = 'PRESERVE';
    h.c.commandPort = () => h.commands.length === 1 ? first.promise : second.promise;
    const pending = h.c.runManualMapExportCommand('manualMap.export.imagePdf', { mapId: 'map-a', requestedFormat: 'pdf' });
    if (stale === 'project') { h.c.currentProjectId = 'replacement'; h.c.invalidateAtlasPublications(); }
    else {
      const newer = h.c.runManualMapExportCommand('manualMap.export.imagePdf', { mapId: 'map-a', requestedFormat: 'pdf' });
      second.resolve({ ok: true, value: { export: { format: 'pdf', sha256: 'b'.repeat(64), pdf: { binaryGenerated: true } } } });
      await newer; assert.equal(h.c.manualMapPortabilityCommandState.pdfSha256, 'b'.repeat(64));
    }
    const expected = JSON.stringify(h.c.manualMapPortabilityCommandState), manuscript = h.working(), draft = h.draft();
    first.resolve({ ok: true, value: { export: { format: 'pdf', sha256: 'a'.repeat(64), pdf: { binaryGenerated: true } } } });
    await pending; assert.equal(JSON.stringify(h.c.manualMapPortabilityCommandState), expected);
    assert.equal(h.working(), manuscript); assert.deepEqual(h.draft(), draft);
  }
});

test('manual-map actual selector blocks retained/applying/failed drafts without removing working input or caret', async () => {
  const h = manualAuthoringDomHarness(); h.open();
  const input = h.field(); input.focus(); input.setSelectionRange(2, 4);
  const selector = h.rail.querySelector('[data-manual-map-selector]');
  assert.equal(selector.tagName, 'SELECT'); assert.equal(selector.disabled, true);
  selector.value = 'map-b'; await selector.emit('change'); await h.settle();
  assert.equal(h.c.manualMapWorkbenchState.mapId, 'map-a'); assert.equal(h.field(), input);
  assert.equal(h.document.activeElement, input); assert.equal(input.selectionStart, 2); assert.equal(input.selectionEnd, 4);
  for (const state of ['applying', 'failed']) {
    h.c.commandResult = { ok: false };
    if (state === 'applying') {
      let release; h.c.runProductJourneyCommand = () => new Promise(resolve => { release = resolve; });
      await h.rail.querySelector('[data-manual-map-confirm-risk]').emit('change');
      h.c.setManualMapCommandDraftConfirmation(true); const pending = h.c.applyManualMapCommandDraft();
      await h.c.selectManualMap('map-b'); assert.equal(h.c.manualMapWorkbenchState.mapId, 'map-a');
      release({ ok: false, reason: 'REFUSED' }); await pending;
    }
    await h.c.selectManualMap('map-b'); assert.equal(h.c.manualMapWorkbenchState.mapId, 'map-a');
  }
  await h.rail.querySelector('[data-manual-map-command-cancel]').emit('click');
  await h.c.selectManualMap('map-b'); assert.equal(h.c.manualMapWorkbenchState.mapId, 'map-b');
  assert.equal(h.calls.length, 0); // the pending finite command above never called this recorder
});

test('manual-map real attachment draft emits only identifiers, label and kind', async () => {
  const h = manualAuthoringDomHarness(); h.toolbar();
  await h.button('Add attachment').emit('click');
  assert.deepEqual(Object.keys(h.draft().payload).sort(), ['attachmentId', 'attachmentKind', 'label', 'mapId', 'nodeId']);
});

test('manual-map real import control is enabled before the first map and adopts the actual command receipt before refresh', async () => {
  const h = manualAuthoringDomHarness(); h.c.manualMapWorkbenchState.mapId = ''; h.c.manualMapWorkbenchState.mapRows = [];
  h.toolbar(); assert.equal(h.button('Import JSON file').disabled, false);
  await h.button('Import JSON file').emit('click');
  h.c.commandResult = { ok: true, value: { mapId: 'actual-imported', import: { mapId: 'actual-imported' } } };
  const observed = []; h.c.refreshManualMapWorkbench = async () => observed.push(h.c.manualMapWorkbenchState.mapId);
  h.c.setManualMapCommandDraftConfirmation(true); await h.c.applyManualMapCommandDraft();
  assert.deepEqual(observed, ['actual-imported']); assert.equal(h.draft().state, 'applied');
  assert.equal(h.calls[0].commandId, 'manualMap.import.jsonRepeat');
});

test('manual-map create adopts receipt map identity and ignores an old detached selector', async () => {
  const h = manualAuthoringDomHarness(); h.toolbar();
  const old = h.rail.querySelector('[data-manual-map-selector]');
  h.open(); h.c.commandResult = { ok: true, value: { mapId: 'actual-created' } };
  const observed = []; h.c.refreshManualMapWorkbench = async () => observed.push(h.c.manualMapWorkbenchState.mapId);
  h.c.setManualMapCommandDraftConfirmation(true); await h.c.applyManualMapCommandDraft();
  assert.deepEqual(observed, ['actual-created']);
  old.value = 'map-b'; await old.emit('change'); assert.equal(h.c.manualMapWorkbenchState.mapId, 'actual-created');
});

test('manual-map portal target queries are independent, exact and ordered without replacing the source map', async () => {
  const h = manualAuthoringDomHarness(); h.toolbar(); await h.button('Add portal').emit('click');
  const calls = [], replies = [];
  h.c.invokeWorkspaceQueryBridge = (id, payload) => new Promise(resolve => { calls.push({ id, payload }); replies.push(resolve); });
  h.input('targetMapId').value = 'map-b'; await h.input('targetMapId').emit('change');
  h.input('targetMapId').value = 'map-c'; await h.input('targetMapId').emit('change');
  assert.equal(calls.length, 2); assert.equal(calls[0].payload.mapId, 'map-b'); assert.equal(calls[1].payload.mapId, 'map-c');
  const reply = mapId => ({ ok: true, manualMapWorkbench: { state: 'ready', projectId: 'project-a', mapId,
    graph: { mapId, nodes: [{ id: mapId + '-node', label: 'Target node' }] } } });
  replies[1](reply('map-c')); await h.settle(); replies[0](reply('map-b')); await h.settle();
  assert.equal(h.c.manualMapWorkbenchState.mapId, 'map-a');
  assert.deepEqual(h.draft().fields.find(field => field.name === 'targetNodeId').options,
    [{ value: '', label: 'Whole map' }, { value: 'map-c-node', label: 'Target node' }]);
  assert.equal(h.draft().payload.mapId, 'map-a'); assert.equal(h.draft().payload.targetMapId, 'map-c');
});

test('manual-map portal target publication preserves focused working input and clears nodes when its map changes', async () => {
  const h = manualAuthoringDomHarness(); h.toolbar(); await h.button('Add portal').emit('click');
  const replies = []; h.c.invokeWorkspaceQueryBridge = () => new Promise(resolve => replies.push(resolve));
  h.input('targetMapId').value = 'map-b'; await h.input('targetMapId').emit('change');
  const label = h.input('label'); label.focus(); label.setSelectionRange(2, 4);
  replies[0]({ ok: true, manualMapWorkbench: { state: 'ready', projectId: 'project-a', mapId: 'map-b',
    graph: { mapId: 'map-b', nodes: [{ id: 'b-node', label: 'Target B' }] } } }); await h.settle();
  assert.equal(h.input('label'), label, 'target options must not replace working input');
  assert.equal(h.document.activeElement, label); assert.equal(label.selectionStart, 2); assert.equal(label.selectionEnd, 4);
  assert.deepEqual(h.input('targetNodeId').children.map(option => option.value), ['', 'b-node']);
  h.input('targetNodeId').value = 'b-node'; await h.input('targetNodeId').emit('change');
  h.input('targetMapId').value = 'map-c'; await h.input('targetMapId').emit('change');
  assert.equal(h.draft().payload.targetNodeId, '');
  assert.deepEqual(h.input('targetNodeId').children.map(option => option.value), ['']);
});

for (const stale of [false, true]) test('manual-map portal target query rejection preserves current input and ignores stale errors: ' + stale, async () => {
  const h = manualAuthoringDomHarness(); h.toolbar(); await h.button('Add portal').emit('click');
  h.c.updateManualMapCommandDraftField('targetMapId', 'map-b');
  let reject; h.c.invokeWorkspaceQueryBridge = () => new Promise((resolve, fail) => { reject = fail; });
  const label = h.input('label'); label.focus(); label.setSelectionRange(2, 4);
  const pending = h.c.refreshManualMapPortalTargets();
  if (stale) h.open('label');
  const replacement = h.context.port.draft(); reject(Object.assign(Error('IPC query timed out'), { code: 'E_TIMEOUT' }));
  await assert.doesNotReject(pending);
  assert.equal(h.calls.length, 0);
  if (stale) assert.equal(h.context.port.draft(), replacement);
  else {
    assert.equal(h.input('label'), label); assert.equal(h.document.activeElement, label);
    assert.equal(label.selectionStart, 2); assert.equal(label.selectionEnd, 4);
    assert.match(h.input('targetNodeId').children[0].textContent, /unavailable/iu);
    assert.equal(h.draft().payload.targetMapId, 'map-b');
  }
});

for (const fault of ['wrong-map', 'wrong-project', 'malformed-node', 'edited', 'cancelled', 'source-switch']) test('manual-map portal refuses late ' + fault + ' target projection', async () => {
  const h = manualAuthoringDomHarness(); h.toolbar(); await h.button('Add portal').emit('click');
  let reply; h.c.invokeWorkspaceQueryBridge = () => new Promise(resolve => { reply = resolve; });
  h.input('targetMapId').value = 'map-b'; await h.input('targetMapId').emit('change');
  if (fault === 'edited') h.c.updateManualMapCommandDraftField('label', 'Keep working text');
  if (fault === 'cancelled') h.c.cancelManualMapCommandDraft();
  if (fault === 'source-switch') h.c.manualMapWorkbenchState.mapId = 'map-c';
  reply({ ok: true, manualMapWorkbench: { state: 'ready', projectId: fault === 'wrong-project' ? 'foreign' : 'project-a',
    mapId: fault === 'wrong-map' ? 'map-a' : 'map-b', graph: { mapId: 'map-b', nodes: fault === 'malformed-node' ? [null] : [{ id: 'late' }] } } });
  await h.settle();
  assert.deepEqual(h.draft().fields.find(field => field.name === 'targetNodeId').options, [{ value: '', label: 'Whole map' }]);
  assert.equal(h.calls.length, 0);
});

test('manual-map real creation identifiers remain distinct after a renderer process restart', async () => {
  for (const [label, key] of [['Create map', 'mapId'], ['Add node', 'nodeId'], ['Scene node', 'nodeId'], ['Entity node', 'nodeId'], ['Add edge', 'edgeId'],
    ['Create group', 'groupId'], ['Add attachment', 'attachmentId'], ['Add portal', 'portalId'],
    ['Apply template', 'templateInstanceId'], ['Import JSON file', 'targetMapId']]) {
    const ids = [];
    for (let process = 0; process < 2; process++) {
      const h = manualAuthoringDomHarness();
      h.context.findAtlasJourneyEntity = () => ({ entityId: 'entity-a', name: 'Entity' });
      h.context.atlasStableUiIdSeq = 0; h.loadActual('makeStableUiId');
      h.context.manualMapTransientViewState.selection.nodeIds = ['a', 'b'];
      h.toolbar(); await h.button(label).emit('click');
      const payload = h.draft().payload;
      const created = label === 'Apply template' ? [payload.templateInstanceId, ...payload.nodes.map(node => node.nodeId), ...payload.edges.map(edge => edge.edgeId)] : [payload[key]];
      assert.equal(new Set(created).size, created.length); ids.push(created);
    }
    for (const id of ids[0]) assert.equal(ids[1].includes(id), false, label + ' must not reuse a persisted identity');
  }
});

test('manual-map authoring refuses missing secure identity generation without a counter fallback or command write', async () => {
  const h = manualAuthoringDomHarness(); h.toolbar(); h.context.crypto = undefined;
  await assert.rejects(async () => h.button('Create map').emit('click'), { code: 'E_MANUAL_MAP_IDENTITY_UNAVAILABLE' });
  assert.equal(h.draft(), null); assert.equal(h.calls.length, 0);
});

// Actual key handler, reducers, draft rebuild, list and canvas rendering. The
// finite DOM does not implement native caret movement or macOS accelerators.
async function manualMapKeyboardDomHarness() {
  const h = draftDomHarness(), c = h.context, { pathToFileURL } = require('node:url');
  const interaction = await import(pathToFileURL(path.join(repoRoot, 'src/derived/mindmap/manualMapInteraction.mjs')).href);
  const parity = await import(pathToFileURL(path.join(repoRoot, 'src/derived/mindmap/manualMapListKeyboardParity.mjs')).href);
  const graph = { nodes: [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }], edges: [], groups: [] };
  Object.assign(c, interaction, parity, { MANUAL_MAP_SVG_NS: 'http://www.w3.org/2000/svg',
    manualMapPinnedNodeIds: new Set(), manualMapListState: { activeRowId: 'node:a' },
    manualMapTransientViewState: interaction.normalizeManualMapViewState({}, graph) });
  c.buildManualMapWorkbenchRuntimeModel = () => ({ sourceGraph: graph, presentationGraph: graph,
    listParity: parity.buildManualMapListParityModel({ graph, viewState: c.manualMapTransientViewState, listState: c.manualMapListState }),
    viewportPlan: { viewState: c.manualMapTransientViewState, nodes: graph.nodes, edges: [] }, resourceBudgetProof: {} });
  h.rail.dataset.manualMapWorkbenchHost = 'true'; h.plan.dataset.manualMapPlanHost = 'true';
  h.loadActual('manualMapNumber', 'manualMapNodePosition', 'getManualMapEdgeById', 'getManualMapEventGraph',
    'setManualMapViewIntent', 'handleManualMapWorkbenchKeydown', 'renderManualMapList', 'renderManualMapGraphCanvas');
  const key = (target, key) => {
    const event = { target, key, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    c.handleManualMapWorkbenchKeydown(event); return event;
  };
  return { ...h, c, key };
}

for (const placement of ['rail', 'plan']) for (const kind of ['title', 'label']) {
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
    test(`manual-map actual ${placement} ${kind} ${key} leaves the focused draft connected`, async () => {
      const h = await manualMapKeyboardDomHarness(); h.open(kind);
      const host = h[placement], input = h.field(host); input.focus(); input.setSelectionRange(2, 4, 'backward');
      const renders = h.counters.renders, view = JSON.stringify(h.c.manualMapTransientViewState), draft = h.draft();
      const event = h.key(input, key);
      assert.deepEqual({ prevented: event.defaultPrevented, sameInput: h.field(host) === input,
        connected: input.isConnected, focused: h.document.activeElement === input, renders: h.counters.renders - renders },
      { prevented: false, sameInput: true, connected: true, focused: true, renders: 0 });
      assert.equal(input.selectionStart, 2); assert.equal(input.selectionEnd, 4); assert.equal(input.selectionDirection, 'backward');
      assert.equal(JSON.stringify(h.c.manualMapTransientViewState), view); assert.deepEqual(h.draft(), draft);
      await h.edit(input, '🧭'); assert.equal(h.draft().payload[kind], input.value);
      assert.equal(h.field(host), input); assert.equal(h.counters.queries, 0); assert.equal(h.calls.length, 0);
    });
  }
}

for (const placement of ['rail', 'plan']) for (const kind of ['textarea', 'select', 'button-child', 'editable-child', 'plaintext-child']) {
  test(`manual-map actual ${placement} ${kind} keeps all four arrows out of graph handling`, async () => {
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
      const h = await manualMapKeyboardDomHarness(); h.open(); const host = h[placement], input = h.field(host);
      const control = kind === 'button-child' ? h.form(host).querySelector('[data-manual-map-command-cancel]')
        : h.document.createElement(kind.endsWith('-child') ? 'div' : kind);
      if (kind !== 'button-child') host.append(control);
      if (kind === 'editable-child' || kind === 'plaintext-child') control.setAttribute('contenteditable', kind === 'plaintext-child' ? 'plaintext-only' : 'true');
      const target = kind.endsWith('-child') ? h.document.createElement('span') : control;
      if (target !== control) control.append(target);
      control.value = 'draft 🧭'; control.focus();
      if (kind === 'textarea') control.setSelectionRange(1, 3, 'backward');
      const renders = h.counters.renders, view = JSON.stringify(h.c.manualMapTransientViewState), draft = h.draft();
      assert.equal(h.key(target, key).defaultPrevented, false);
      assert.equal(h.document.activeElement, control); assert.equal(control.isConnected, true); assert.equal(h.field(host), input);
      if (kind === 'textarea') {
        assert.equal(control.selectionStart, 1); assert.equal(control.selectionEnd, 3); assert.equal(control.selectionDirection, 'backward');
      }
      assert.equal(h.counters.renders, renders); assert.equal(JSON.stringify(h.c.manualMapTransientViewState), view);
      assert.deepEqual(h.draft(), draft); assert.equal(h.counters.queries, 0); assert.equal(h.calls.length, 0);
    }
  });
}

for (const placement of ['rail', 'plan']) test(`manual-map actual ${placement} canvas still pans in all four directions`, async () => {
  const h = await manualMapKeyboardDomHarness(), host = h[placement];
  for (const [key, dx, dy] of [['ArrowLeft', -64, 0], ['ArrowRight', 64, 0], ['ArrowUp', 0, -64], ['ArrowDown', 0, 64]]) {
    h.c.renderManualMapWorkbenchState();
    if (placement === 'rail') h.c.renderManualMapGraphCanvas(host, h.c.manualMapWorkbenchState, h.c.buildManualMapWorkbenchRuntimeModel());
    const canvas = host.querySelector('[data-manual-map-canvas]'), before = h.c.manualMapTransientViewState.viewport, renders = h.counters.renders;
    assert.ok(canvas); assert.equal(h.key(canvas, key).defaultPrevented, true);
    assert.equal(h.c.manualMapTransientViewState.viewport.x, before.x + dx); assert.equal(h.c.manualMapTransientViewState.viewport.y, before.y + dy);
    assert.ok(h.counters.renders > renders); assert.equal(h.calls.length, 0); assert.equal(h.counters.queries, 0);
  }
});

for (const placement of ['rail', 'plan']) test(`manual-map actual ${placement} BUTTON graph rows retain navigation and activation`, async () => {
  const h = await manualMapKeyboardDomHarness(), host = h[placement]; h.c.renderManualMapWorkbenchState();
  let row = host.querySelectorAll('[data-manual-map-row-id]')[0]; assert.equal(row.tagName, 'BUTTON');
  assert.equal(h.key(row.children[0], 'ArrowDown').defaultPrevented, true); assert.equal(h.c.manualMapListState.activeRowId, 'node:b');
  row = host.querySelectorAll('[data-manual-map-row-id]').find(row => row.dataset.manualMapRowId === 'node:b');
  assert.equal(h.key(row, 'Enter').defaultPrevented, true); assert.deepEqual([...h.c.manualMapTransientViewState.selection.nodeIds], ['b']);
  assert.equal(h.c.manualMapTransientViewState.viewport.x, 0); assert.equal(h.c.manualMapTransientViewState.viewport.y, 0);
  assert.equal(h.calls.length, 0); assert.equal(h.counters.queries, 0);
});

test('manual-map actual keyboard ignores non-host targets but keeps noneditable graph descendants active', async () => {
  const h = await manualMapKeyboardDomHarness(), before = JSON.stringify(h.c.manualMapTransientViewState);
  assert.equal(h.key(h.document.body, 'ArrowRight').defaultPrevented, false);
  assert.equal(JSON.stringify(h.c.manualMapTransientViewState), before); assert.equal(h.counters.renders, 0);
  h.c.renderManualMapWorkbenchState(); const child = h.document.createElement('span'); child.setAttribute('contenteditable', 'false');
  h.plan.querySelector('[data-manual-map-canvas]').append(child); assert.equal(child.isContentEditable, false);
  assert.equal(h.key(child, 'ArrowRight').defaultPrevented, true); assert.equal(h.c.manualMapTransientViewState.viewport.x, 64);
  assert.equal(h.calls.length, 0); assert.equal(h.counters.queries, 0);
});

test('manual-map labelled Markdown control sends only selected map intent and preserves working inputs in both hosts', async () => {
  for (const host of ['rail', 'plan']) {
    const h = manualAuthoringDomHarness();
    h.loadActual('runManualMapExportCommand', 'renderManualMapPortabilityCommandReadback');
    h.c.manualMapPortabilityCommandState.markdownPreviousMarker = 'OLD_TYPED_LOSS';
    h.toolbar(); const oldPdf = h.rail.querySelectorAll('[data-manual-map-portability-action]').find(node => node.textContent === 'Export Markdown');
    assert.equal(oldPdf.disabled, false);
    h.open(); const input = h.field(h[host]); input.focus(); input.setSelectionRange(2, 4);
    const draft = h.draft(), buttons = h[host].querySelectorAll('[data-manual-map-portability-action]');
    const pdf = buttons.find(node => node.dataset.manualMapPortabilityAction === 'export-markdown');
    const svg = buttons.find(node => node.dataset.manualMapPortabilityAction === 'export-image-pdf');
    assert.equal(pdf.tagName, 'BUTTON'); assert.equal(pdf.type, 'button'); assert.equal(pdf.textContent, 'Export Markdown');
    assert.equal(pdf.className, svg.className); assert.equal(svg.textContent, 'Export SVG'); assert.equal(pdf.disabled, true);
    assert.equal(pdf.title, 'Apply or cancel the current draft before exporting Markdown');
    assert.equal(pdf.dataset.productCommandId, 'manualMap.export.markdown');
    for (const state of ['draft', 'applying', 'failed']) {
      h.c.manualMapCommandDraft.state = state; const retained = h.draft();
      await pdf.emit('click'); await oldPdf.emit('click'); await h.settle();
      assert.deepEqual(h.calls, []); assert.deepEqual(h.draft(), retained);
      assert.equal(h.field(h[host]) === input, true); assert.equal(h.document.activeElement === input, true);
      assert.equal(input.selectionStart, 2); assert.equal(input.selectionEnd, 4);
    }
    h.c.manualMapCommandDraft.state = 'draft'; assert.deepEqual(h.draft(), draft);
    h.c.cancelManualMapCommandDraft(); assert.equal(h.draft().state, 'cancelled');
    const readyPdf = h[host].querySelectorAll('[data-manual-map-portability-action]').find(node => node.textContent === 'Export Markdown');
    assert.equal(readyPdf.disabled, false);
    h.c.commandResult = { ok: true, value: { mapId: 'map-a', export: { format: 'markdown', mediaType: 'text/markdown',
      sha256: 'a'.repeat(64), byteLength: 420, markdownSha256: 'a'.repeat(64) } } };
    await readyPdf.emit('click'); await h.settle();
    assert.deepEqual(h.calls, [{ commandId: 'manualMap.export.markdown', payload: { mapId: 'map-a' } }]);
    assert.equal(h.c.manualMapPortabilityCommandState.markdownSha256, 'a'.repeat(64));
    assert.equal(h.c.manualMapPortabilityCommandState.markdownPreviousMarker, 'OLD_TYPED_LOSS');
    assert.equal(h.draft().state, 'cancelled');
    assert.match(h[host].querySelectorAll('[data-manual-map-portability-command-state]').find(node =>
      node.dataset.manualMapPortabilityCommandState === 'markdown').textContent, /aaaaaaaaaaaa/u);
    h.c.manualMapWorkbenchState.mapId = ''; h[host].innerHTML = '';
    h.c.renderManualMapToolbar(h[host], h.c.manualMapWorkbenchState, { sourceGraph: {}, presentationGraph: {} });
    const disabled = h[host].querySelectorAll('[data-manual-map-portability-action]').find(node => node.textContent === 'Export Markdown');
    assert.equal(disabled.disabled, true); await disabled.emit('click'); assert.equal(h.calls.length, 1);
  }
});

test('manual-map Markdown receipt publishes only for the current project and latest export sequence', async () => {
  for (const stale of ['project', 'sequence']) {
    const h = publicationHarness(), first = h.deferred(), second = h.deferred();
    h.c.manualMapPortabilityCommandState.markdownPreviousMarker = 'PRESERVE';
    h.c.commandPort = () => h.commands.length === 1 ? first.promise : second.promise;
    const pending = h.c.runManualMapExportCommand('manualMap.export.markdown', { mapId: 'map-a' });
    if (stale === 'project') { h.c.currentProjectId = 'replacement'; h.c.invalidateAtlasPublications(); }
    else {
      const newer = h.c.runManualMapExportCommand('manualMap.export.markdown', { mapId: 'map-a' });
      second.resolve({ ok: true, value: { export: { format: 'markdown', sha256: 'b'.repeat(64), markdownSha256: 'b'.repeat(64) } } });
      await newer; assert.equal(h.c.manualMapPortabilityCommandState.markdownSha256, 'b'.repeat(64));
    }
    const expected = JSON.stringify(h.c.manualMapPortabilityCommandState), manuscript = h.working(), draft = h.draft();
    first.resolve({ ok: true, value: { export: { format: 'markdown', sha256: 'a'.repeat(64), markdownSha256: 'a'.repeat(64) } } });
    await pending; assert.equal(JSON.stringify(h.c.manualMapPortabilityCommandState), expected);
    assert.equal(h.working(), manuscript); assert.deepEqual(h.draft(), draft);
  }
});

// Actual renderer/filter/layout/list/canvas functions; deferred transport is finite,
// not physical export, browser composition, or native IME qualification.
async function liveControlHarness() {
  const h = publicationHarness(), c = h.c, { pathToFileURL } = require('node:url');
  for (const name of ['derived/mindmap/manualMapInteraction.mjs', 'derived/mindmap/manualMapViewportPlanner.mjs',
    'derived/mindmap/manualMapLayoutScheduler.mjs', 'derived/mindmap/manualMapListKeyboardParity.mjs', 'core/text-fold-tape-v1.mjs']) {
    Object.assign(c, await import(pathToFileURL(path.join(repoRoot, 'src', name)).href));
  }
  const start = editor.indexOf('const MANUAL_MAP_SVG_NS ='), end = editor.indexOf('\nconst isTiptapMode =', start);
  require('node:vm').runInContext(editor.slice(start, end), c);
  Object.assign(c, { manualMapLayoutMode: 'manual-fixed-position', manualMapLayoutGeneration: 0,
    manualMapPinnedNodeIds: new Set(), manualMapListState: { activeRowId: 'node:a' },
    manualMapTransientViewState: c.normalizeManualMapViewState({}, {}) });
  h.loadActual('cloneManualMapJson', 'getManualMapGraph', 'buildManualMapHierarchyPresentationGraph',
    'filterManualMapGraphForWorkbench', 'buildManualMapWorkbenchRuntimeModel', 'manualMapNumber', 'manualMapNodePosition',
    'getManualMapEdgeById', 'renderManualMapList', 'renderManualMapGraphCanvas', 'appendAtlasReportsRow',
    'renderManualMapPortabilityCommandReadback');
  const result = (marker = 'current', state = 'ready') => {
    const value = h.projection(h.leaves[0], c.currentProjectId, marker);
    Object.assign(value.manualMapWorkbench, { state, unavailableReason: state === 'unavailable' ? 'CURRENT_REFUSAL' : '' });
    value.manualMapWorkbench.graph.nodes = [{ id: 'a', label: 'Café one', position: { x: 0, y: 0 } },
      { id: 'b', label: 'Beta', position: { x: 200, y: 0 } }, { id: marker, label: marker, position: { x: 300, y: 0 } }];
    value.manualMapWorkbench.summary.nodeCount = 3;
    return value;
  };
  c.manualMapWorkbenchState = c.normalizeManualMapWorkbench(result('initial').manualMapWorkbench);
  c.queryPort = request => request.row[0] === 'refreshManualMapWorkbench' ? result('fresh') : h.projection(request.row);
  const search = () => {
    const walk = node => [node, ...node.children.flatMap(walk)];
    return walk(h.plan).find(node => node.tagName === 'INPUT' && node.type === 'search');
  };
  const rows = host => host.querySelectorAll('[data-manual-map-row-id]').map(node => node.dataset.itemId);
  c.renderManualMapWorkbenchState();
  return { ...h, result, search, rows };
}

function liveWitness(h, input) {
  return { input, parent: input.parentElement, form: input.closest('form'), value: input.value,
    selection: [input.selectionStart, input.selectionEnd, input.selectionDirection],
    writes: input.valueWrites, disconnects: input.disconnects, focuses: input.focusCalls };
}
function assertLiveControl(h, witness) {
  const input = witness.input;
  assert.equal(input.isConnected, true, 'editing ancestor must remain continuously connected');
  assert.equal(input.parentElement, witness.parent); assert.equal(input.closest('form'), witness.form);
  assert.equal(h.document.activeElement, input); assert.equal(input.value, witness.value);
  assert.deepEqual([input.selectionStart, input.selectionEnd, input.selectionDirection], witness.selection);
  assert.equal(input.valueWrites, witness.writes, 'no active/composing value restoration');
  assert.equal(input.disconnects, witness.disconnects, 'same-node remove/reappend is still a disconnect');
  assert.equal(input.focusCalls, witness.focuses, 'no focus restoration hides a disconnect');
}

test('manual-map finite DOM witnesses removal and movement as editing disconnects', () => {
  for (const move of [false, true]) {
    const h = draftDomHarness(), input = h.open(), form = h.form(); input.focus();
    if (move) h.rail.append(form); else { form.remove(); h.rail.append(form); }
    assert.equal(input.isConnected, true); assert.equal(input.disconnects, 1);
    assert.equal(h.document.activeElement, h.document.body);
  }
});

for (const placement of ['rail', 'plan']) for (const kind of ['title', 'label']) {
  test(`manual-map current export running ready and refusal preserve ${placement} ${kind} editing`, async () => {
    for (const ok of [true, false]) {
      const h = await liveControlHarness(); h.open(kind, 'semantic');
      const input = h.field(h[placement]); input.focus(); input.setSelectionRange(2, 5, 'backward');
      await input.emit('compositionstart'); const witness = liveWitness(h, input), draft = h.draft();
      const gate = h.deferred(); h.c.commandPort = () => gate.promise;
      const pending = h.c.runManualMapExportCommand(ok ? 'manualMap.export.json' : 'manualMap.export.imagePdf', { mapId: 'map-a' });
      assertLiveControl(h, witness); assert.equal(h.field(h[placement]), input);
      assert.match(h[placement].querySelectorAll('[data-manual-map-portability-command-state]')[0].textContent, /running/u);
      const receipt = ok ? { ok: true, value: { export: { jsonSha256: 'a'.repeat(64) } } }
        : { ok: false, error: { code: 'E_COMMAND_FAILED', reason: 'CAPABILITY_DISABLED_FOR_COMMAND' } };
      gate.resolve(receipt); assert.equal(await pending, receipt);
      assertLiveControl(h, witness); assert.deepEqual(h.draft(), draft);
      assert.equal(h[placement].dataset.manualMapWorkbenchStatus, 'ready');
      assert.equal(h.rows(h[placement]).includes('fresh'), true); assert.equal(h.rows(h[placement]).includes('initial'), false);
      assert.equal(h.plan.querySelectorAll('[data-manual-map-node-id]').some(node => node.dataset.manualMapNodeId === 'fresh'), true);
      assert.match(h[placement].querySelectorAll('[data-manual-map-portability-command-state]')[0].textContent,
        ok ? /exported/u : /CAPABILITY_DISABLED_FOR_COMMAND/u);
      assert.equal(h.commands.length, 1); assert.ok(h.queries.length > 0);
      await input.emit('compositionend'); await h.edit(input, 'にほん', 'insertCompositionText');
      assert.equal(h.draft().payload[kind], input.value); assert.equal(h.field(h[placement]), input);
    }
  });
}

for (const placement of ['rail', 'plan']) test(`manual-map current loading and unavailable retain ${placement} working control without stale graph`, async () => {
  for (const outcome of ['ready', 'unavailable']) {
    const h = await liveControlHarness(); h.open('label');
    const input = h.field(h[placement]); input.focus(); input.setSelectionRange(2, 4, 'backward');
    const witness = liveWitness(h, input), gate = h.deferred(); h.c.queryPort = () => gate.promise;
    const pending = h.c.refreshManualMapWorkbench({ force: true });
    assertLiveControl(h, witness); assert.equal(h[placement].dataset.manualMapWorkbenchStatus, 'loading');
    assert.equal(h[placement].querySelector('[data-manual-map-canvas]'), null);
    assert.match(h[placement].textContent, /Graph workbench обновляется/u);
    await h.form(h[placement]).emit('submit'); assert.equal(h.commands.length, 0, 'loading is no mutation authority');
    gate.resolve(h.result('current', outcome)); await pending; assertLiveControl(h, witness);
    assert.equal(h[placement].dataset.manualMapWorkbenchStatus, outcome);
    if (outcome === 'unavailable') {
      assert.match(h[placement].textContent, /CURRENT_REFUSAL/u); assert.deepEqual(h.rows(h[placement]), []);
      await h.form(h[placement]).emit('submit'); assert.equal(h.commands.length, 0);
    } else assert.equal(h.rows(h[placement]).includes('current'), true);
    h.c.queryPort = () => h.result('restored'); await h.c.refreshManualMapWorkbench({ force: true });
    assertLiveControl(h, witness); assert.equal(h.rows(h[placement]).includes('restored'), true);
  }
});

test('manual-map actual current missing-map refusal retains only owned editing buffers and explicit other map retires them', async () => {
  for (const refusal of ['malformed-query', 'unavailable-no-map', 'explicit-other-map']) {
    const h = await liveControlHarness(); h.open('label'); const input = h.field(), form = h.form(), search = h.search();
    input.focus(); input.setSelectionRange(2, 4, 'backward'); const witness = liveWitness(h, input), draft = h.draft();
    const result = refusal === 'malformed-query' ? {} : h.result('refusal', 'unavailable');
    if (result.manualMapWorkbench) result.manualMapWorkbench.mapId = refusal === 'explicit-other-map' ? 'other-map' : '';
    h.c.queryPort = () => result; await h.c.refreshManualMapWorkbench();
    assert.equal(h.rail.dataset.manualMapWorkbenchStatus, 'unavailable'); assert.deepEqual(h.rows(h.rail), []);
    assert.equal(h.plan.querySelector('[data-manual-map-canvas]'), null);
    if (refusal === 'explicit-other-map') {
      assert.equal(input.isConnected, false); assert.equal(search.isConnected, false);
      await h.edit(input, 'stale'); await h.edit(search, 'stale'); assert.equal(h.c.manualMapSearchQuery, '');
    } else { assertLiveControl(h, witness); assert.equal(h.form(), form); assert.equal(h.search(), search); }
    await form.emit('submit'); await h.c.applyManualMapCommandDraft(); assert.equal(h.commands.length, 0);
    assert.deepEqual(h.draft(), draft); h.c.queryPort = () => h.result('recovered'); await h.c.refreshManualMapWorkbench();
    if (refusal !== 'explicit-other-map') assertLiveControl(h, witness);
    assert.equal(h.rows(h.rail).includes('recovered'), true); assert.equal(h.commands.length, 0);
  }
});

test('manual-map actual PLAN search keeps one live control through Unicode filtering draft opening and current refresh', async () => {
  const h = await liveControlHarness(), input = h.search(); input.focus(); input.setSelectionRange(0, 0);
  const disconnects = input.disconnects, writes = input.valueWrites, focuses = input.focusCalls;
  await h.edit(input, 'CAFÉ'); assert.equal(h.search(), input); assert.equal(h.document.activeElement, input);
  assert.deepEqual(h.rows(h.plan), ['a']); assert.deepEqual(h.rows(h.rail), ['a']);
  await input.emit('compositionstart'); await h.edit(input, ' one', 'insertCompositionText', true);
  assert.equal(input.value, 'CAFÉ one'); assert.equal(h.c.manualMapSearchQuery, input.value);
  assert.deepEqual(h.plan.querySelectorAll('[data-manual-map-node-id]').map(node => node.dataset.manualMapNodeId), ['a']);
  h.open('label'); assert.equal(h.search(), input, 'draft ownership does not retire search');
  const draft = h.draft(); input.setSelectionRange(0, input.value.length, 'backward'); await h.edit(input, '  Beta  ');
  assert.deepEqual(h.rows(h.plan), ['b']); assert.deepEqual(h.draft(), draft);
  input.setSelectionRange(2, 6, 'backward'); const witness = liveWitness(h, input), gate = h.deferred();
  h.c.queryPort = () => gate.promise; const pending = h.c.refreshManualMapWorkbench();
  assertLiveControl(h, witness); assert.equal(h.search(), input); assert.equal(h.plan.querySelector('[data-manual-map-canvas]'), null);
  gate.resolve(h.result('new-current')); await pending; assertLiveControl(h, witness);
  assert.deepEqual(h.rows(h.plan), ['b']); assert.equal(input.disconnects, disconnects);
  assert.equal(input.valueWrites, writes); assert.equal(input.focusCalls, focuses); assert.equal(h.commands.length, 0);
});

for (const placement of ['rail', 'plan']) test(`manual-map ${placement} pending Apply accepts queued native field input but never duplicates or falsely cancels effect`, async () => {
  const h = await liveControlHarness(); h.open('label'); const gate = h.deferred(); h.c.commandPort = () => gate.promise;
  const input = h.field(h[placement]); input.focus(); input.setSelectionRange(2, 4, 'backward');
  const witness = liveWitness(h, input), form = h.form(h[placement]), pending = h.c.applyManualMapCommandDraft();
  assertLiveControl(h, witness); assert.equal(h.commands.length, 1); assert.equal(h.draft().state, 'applying');
  await input.emit('compositionstart'); await h.edit(input, 'late é 🧭', 'insertCompositionText', true);
  assert.equal(h.draft().payload.label, input.value, 'actual queued input listener owns working bytes while Apply waits');
  const working = h.draft(), edited = liveWitness(h, input);
  assert.equal(form.querySelector('[data-manual-map-command-apply]').disabled, true);
  await form.emit('submit'); await h.c.applyManualMapCommandDraft();
  await form.querySelector('[data-manual-map-command-cancel]').emit('click');
  assert.equal(h.commands.length, 1); assert.deepEqual(h.draft(), working, 'an in-flight mutation is not a cancel no-op');
  const receipt = { ok: true, value: { status: 'APPLIED', receiptId: 'actual-finite-effect' } };
  gate.resolve(receipt); await pending; assertLiveControl(h, edited); assert.deepEqual(h.draft(), working);
  assert.equal(h.delivered[0], receipt); assert.equal(h.commands.length, 1);
  assert.equal(form.querySelector('[data-manual-map-command-apply]').disabled, false);
  await input.emit('compositionend'); await form.querySelector('[data-manual-map-command-cancel]').emit('click');
  assert.equal(h.draft().result.status, 'CANCELLED_NOOP'); assert.equal(h.commands.length, 1);
});

test('manual-map composing inactive field is never assigned while the other placement changes working text', async () => {
  const h = await liveControlHarness(); h.open('label'); const input = h.field(); input.focus();
  await input.emit('compositionstart'); const value = input.value, writes = input.valueWrites;
  const other = h.field(h.plan); other.focus(); other.setSelectionRange(0, other.value.length); await h.edit(other, 'other pending');
  h.c.renderManualMapWorkbenchState(); assert.equal(h.field(), input); assert.equal(input.value, value);
  assert.equal(input.valueWrites, writes); assert.equal(input.disconnects, 0);
  await input.emit('compositionend'); input.focus(); input.setSelectionRange(0, input.value.length); await h.edit(input, 'exact composed 🧭');
  assert.equal(h.draft().payload.label, input.value); assert.equal(h.field(h.plan).value, input.value);
});

for (const change of ['project', 'map', 'document', 'publication', 'generation', 'lifecycle', 'schema']) {
  test(`manual-map ${change} replacement retires captured form and search owners without rebinding callbacks`, async () => {
    const h = await liveControlHarness(); h.open('label'); const old = h.field(), form = h.form(), search = h.search();
    const keys = { project: 'currentProjectId', document: 'currentDocumentId', publication: 'currentTreeContentPublicationId', generation: 'localEditGeneration' };
    if (keys[change]) { const key = keys[change], original = h.c[key]; h.c[key] = change === 'generation' ? 2 : 'away';
      h.c.renderManualMapWorkbenchState(); h.c[key] = original; h.c.invalidateAtlasPublications(); }
    if (change === 'map') { h.c.manualMapWorkbenchState.mapId = 'away'; h.c.renderManualMapWorkbenchState();
      h.c.manualMapWorkbenchState.mapId = 'map-a'; h.c.invalidateAtlasPublications(); }
    if (change === 'lifecycle') h.c.invalidateAtlasPublications();
    if (change === 'schema') h.c.manualMapCommandDraft.fields[0].type = 'textarea';
    else h.open('label');
    h.c.renderManualMapWorkbenchState(); const current = h.field(), expected = h.draft(), query = h.c.manualMapSearchQuery;
    assert.notEqual(current, old); assert.equal(old.isConnected, false);
    await h.edit(old, 'late'); await form.emit('submit'); await form.querySelector('[data-manual-map-command-cancel]').emit('click');
    assert.deepEqual(h.draft(), expected); assert.equal(h.commands.length, 0);
    if (change !== 'schema') {
      assert.notEqual(h.search(), search); await h.edit(search, 'foreign'); assert.equal(h.c.manualMapSearchQuery, query);
    }
    assert.equal(h.field(), current); assert.equal(current.isConnected, true);
  });
}

test('manual-map focused portal select defers option writes then resyncs only its captured owner on blur', async () => {
  for (const placement of ['rail', 'plan']) {
    const h = manualAuthoringDomHarness(); h.toolbar(); await h.button('Add portal').emit('click');
    let reply; h.c.invokeWorkspaceQueryBridge = () => new Promise(resolve => { reply = resolve; });
    h.input('targetMapId').value = 'map-b'; await h.input('targetMapId').emit('change');
    const select = h[placement].querySelectorAll('[data-manual-map-command-field]').find(input => input.dataset.manualMapCommandField === 'targetNodeId');
    select.focus(); const writes = select.valueWrites;
    reply({ ok: true, manualMapWorkbench: { state: 'ready', projectId: 'project-a', mapId: 'map-b',
      graph: { mapId: 'map-b', nodes: [{ id: 'b-node', label: 'Target B' }] } } }); await h.settle();
    assert.deepEqual(select.children.map(option => option.value), ['']); assert.equal(select.valueWrites, writes);
    assert.equal(h.draft().fields.find(field => field.name === 'targetNodeId').options.length, 2);
    const label = h.input('label'); label.focus(); label.setSelectionRange(2, 4, 'backward');
    // Finite focus transition followed by the actual blur listener, not native Select/IME proof.
    await select.emit('blur'); assert.deepEqual(select.children.map(option => option.value), ['', 'b-node']);
    assert.equal(select.isConnected, true); assert.equal(select.disconnects, 0); assert.equal(h.document.activeElement, label);
    assert.deepEqual([label.selectionStart, label.selectionEnd, label.selectionDirection], [2, 4, 'backward']);
    h.open('label'); const draft = h.draft(), field = h.field(); field.focus();
    let syncs = 0; const sync = h.c.syncManualMapCommandDraftControls;
    h.c.syncManualMapCommandDraftControls = (...args) => { syncs++; return sync(...args); };
    await select.emit('blur'); assert.equal(syncs, 0, 'retired Select must not resync a replacement owner');
    assert.deepEqual(h.draft(), draft); assert.equal(h.document.activeElement, field); assert.equal(h.calls.length, 0);
  }
});


const SOURCE_CONTINUITY_TEXT = 'Начало e\u0301 🧭. Мира увидела маяк. Северная ответила Мире. Мира сохранила знак.';
const SOURCE_CONTINUITY_PREFIX = 'Добавлено. ';
function continuityRendererHarness() {
  const h = publicationHarness(), vm = require('node:vm'), c = h.c, selected = [], focused = [];
  const fn = name => { const match = new RegExp('^(?:async )?function ' + name + '\\(', 'm').exec(editor); assert.ok(match, name);
    const end = editor.indexOf('\n}\n', match.index); assert.ok(end > match.index); return editor.slice(match.index, end + 2); };
  c.currentAtlasSurface = 'currentScene'; c.setPlainText(SOURCE_CONTINUITY_TEXT); c.localEditGeneration = 1; c.lastAckedGeneration = 1; c.localDirty = false;
  c.focusEditorSurface = owner => focused.push(owner); c.setSelectionRange = (start, end) => selected.push({ start, end, quote: c.getPlainText().slice(start, end) });
  vm.runInContext(fn('focusAtlasMention'), c);
  const digest = text => require('node:crypto').createHash('sha256').update(JSON.stringify(text)).digest('hex');
  const projection = (text = SOURCE_CONTINUITY_TEXT, start = 14) => {
    const end = start + 4, quote = 'Мира', projectId = c.currentProjectId, sceneId = c.currentDocumentId;
    return { ok: true, atlasCurrentScene: { state: 'ready', schemaVersion: 'derived.atlas.currentSceneDossier.v1', projectId, sceneId,
      summary: { entityCount: 1, mentionCount: 1, sceneTextHash: digest(text) }, entities: [], mentions: [{ mentionId: 'selected-mira', entityId: 'mira',
        sceneId, matchedText: quote, startOffset: start, endOffset: end, context: { quote }, trustState: 'ALGORITHMIC_OBSERVATION',
        evidenceAnchor: { schemaVersion: 'atlas.evidenceAnchor.v1', anchorId: 'bounded-source-anchor', projectId, sceneId, entityId: 'mira',
          startOffset: start, endOffset: end, quote, quoteHash: digest(quote), sceneTextHash: digest(text) } }] } };
  };
  c.atlasCurrentSceneState = c.normalizeAtlasCurrentSceneDossier(projection().atlasCurrentScene);
  let dirty;
  c.window.electronAPI.onSetDirty = fn => { dirty = fn; };
  const start = editor.indexOf('  window.electronAPI.onSetDirty((message) => {'), end = editor.indexOf('\n  });', start); assert.ok(start >= 0 && end > start);
  vm.runInContext(editor.slice(start, end + 6), c);
  return { ...h, selected, focused, projection, digest, dirty: message => dirty(message) };
}

// Existing finite DOM/query ports with the actual dossier, journey, listeners and dispatch.
function savedReattachmentRendererHarness() {
  const h = publicationHarness(), c = h.c, vm = require('node:vm'), issued = [];
  const make = tag => h.document.createElement(tag), walk = node => [node, ...node.children.flatMap(walk)];
  Object.assign(c, { atlasJourneyHost: make('section'), atlasEntityDossierHost: make('section'),
    atlasStableUiIdSeq: 0, atlasSelectedEntityId: 'mira', currentAtlasSurface: 'entity',
    crypto: { randomUUID: () => { const id = require('node:crypto').randomUUID(); issued.push(id); return id; } },
    atlasJourneyDraft: { sourceEntityId: 'mira', targetEntityId: '', mentionId: '', decisionId: '', decisionEvidenceAnchor: null, reattachmentId: '' } });
  h.document.body.append(c.atlasJourneyHost, c.atlasEntityDossierHost);
  const names = ['makeAtlasCommandButton', 'getAtlasJourneyEntities', 'getAtlasJourneyMentions', 'findAtlasJourneyEntity',
    'findAtlasJourneyMention', 'makeStableUiId', 'ensureAtlasJourneyDraftId', 'getAtlasJourneyEntityName', 'getAtlasJourneyAliasValue',
    'reconcileAtlasJourneyDraft', 'formatAtlasJourneyEntityOption', 'formatAtlasJourneyMentionOption', 'renderAtlasJourneyState',
    'renderAtlasEntityDossierState', 'appendAtlasOverviewRow', 'appendAtlasOverviewSection', 'makeManualMapAuthorId'];
  for (const match of editor.matchAll(/^(?:async )?function (\w*AtlasReattachment\w*)\(/gm)) if (!names.includes(match[1])) names.push(match[1]);
  h.loadActual(...names);
  let current, dossier;
  const original = { schemaVersion: 'atlas.evidenceAnchor.v1', anchorId: 'saved-original-anchor', projectId: 'project-a', sceneId: 'scene-a',
    entityId: 'mira', startOffset: 14, endOffset: 18, quote: 'Мира', quoteHash: c.hashCanonicalValue('Мира'),
    sceneTextHash: c.hashCanonicalValue(SOURCE_CONTINUITY_TEXT), retainedCoordinateData: { unicode: 'é 🧭' } };
  const source = { rowKind: 'sourceRecord', sourceRecordKind: 'decision', sourceRecordId: 'saved-confirmation', sourceRecordHash: 'a'.repeat(64),
    projectId: 'project-a', entityId: 'mira', evidenceState: 'REVIEW_REQUIRED', sceneId: 'scene-a', quote: 'Мира', startOffset: 14, endOffset: 18,
    evidenceAnchor: original, currentEvidenceAnchor: null, candidateCount: 2, reattachmentId: '' };
  const publish = (text = SOURCE_CONTINUITY_PREFIX + SOURCE_CONTINUITY_TEXT, generation = 1) => {
    c.setPlainText(text); c.localDirty = false; c.localEditGeneration = generation; c.lastAckedGeneration = generation;
    current = { state: 'ready', projectId: 'project-a', sceneId: 'scene-a', sceneTitle: 'Repeated name',
      summary: { sceneTextHash: c.hashCanonicalValue(text), entityCount: 1, mentionCount: 2 }, entities: [{ entityId: 'mira', name: 'Мира', entityKind: 'character' }],
      mentions: [25, 68].map(start => ({ mentionId: 'mira-' + start, entityId: 'mira', sceneId: 'scene-a', startOffset: start, endOffset: start + 4,
        matchedText: 'Мира', context: { before: text.slice(Math.max(0, start - 12), start), quote: 'Мира', after: text.slice(start + 4, start + 24) },
        evidenceAnchor: { ...original, anchorId: 'current-' + start, startOffset: start, endOffset: start + 4, sceneTextHash: c.hashCanonicalValue(text) } })) };
    dossier = { state: 'ready', projectId: 'project-a', requestedEntityId: 'mira', selectedEntityId: 'mira', entity: { entityId: 'mira', name: 'Мира' },
      summary: { evidenceHealth: 'reviewRequired' }, evidenceLedger: { state: 'ready', rows: [source], sourceRecords: [source], sourceRecordCount: 1, sourceRecordsComplete: true } };
    c.atlasCurrentSceneState = c.normalizeAtlasCurrentSceneDossier(structuredClone(current));
    c.atlasEntityDossierState = c.normalizeAtlasEntityDossier(structuredClone(dossier));
    c.renderAtlasEntityDossierState(); c.renderAtlasJourneyState();
  };
  c.queryPort = request => request.row[2] === 'atlasCurrentScene' ? { ok: true, atlasCurrentScene: structuredClone(current) }
    : request.row[2] === 'atlasEntityDossier' ? { ok: true, atlasEntityDossier: structuredClone(dossier) } : h.projection(request.row);
  const render = () => { c.renderAtlasEntityDossierState(); c.renderAtlasJourneyState(); };
  const pickButton = () => walk(c.atlasEntityDossierHost).find(node => node.dataset.atlasSourceRecordSelect === source.sourceRecordId);
  const pick = async () => { const button = pickButton(); assert.ok(button, 'actual cold dossier must expose an explicit saved-confirmation control');
    assert.equal(button.tagName, 'BUTTON'); assert.equal(button.type, 'button'); await button.emit('click'); await h.settle(); };
  const target = async (id = 'mira-68') => { const select = walk(c.atlasJourneyHost).find(node => node.dataset.atlasJourneyField === 'mentionId');
    assert.ok(select); select.value = id; await select.emit('change'); };
  const button = () => walk(c.atlasJourneyHost).find(node => node.dataset.atlasJourneyAction === 'reattach-evidence');
  const apply = async () => { const b = button(); assert.ok(b); await b.emit('click'); await h.settle(); };
  publish();
  return { ...h, c, issued, source, original, publish, render, walk, pickButton, pick, target, button, apply,
    dossier: () => structuredClone(dossier), setDossier: value => { dossier = value; c.atlasEntityDossierState = c.normalizeAtlasEntityDossier(value); render(); } };
}

test('actual cold dossier selects saved confirmation and dispatches the separately chosen exact duplicate occurrence', async () => {
  const h = savedReattachmentRendererHarness(), c = h.c;
  assert.equal(c.atlasJourneyDraft.decisionId, '', 'cold author intent must not manufacture another confirmation');
  await h.pick(); assert.equal(h.commands.length, 0);
  await h.target('mira-68'); assert.equal(h.button().disabled, false); await h.apply();
  assert.equal(h.commands.length, 1); const sent = h.commands[0]; assert.equal(sent.id, 'atlas.evidence.reattach');
  assert.equal(sent.payload.sourceRecordId, 'saved-confirmation'); assert.equal(sent.payload.sourceRecordKind, 'decision');
  assert.equal(sent.payload.expectedSourceRecordHash, h.source.sourceRecordHash); assert.deepEqual(sent.payload.staleEvidenceAnchor, h.original);
  assert.equal(sent.payload.newEvidenceAnchor.startOffset, 68); assert.equal(sent.payload.newEvidenceAnchor.endOffset, 72);
  assert.equal(sent.payload.newEvidenceAnchor.sceneTextHash, c.hashCanonicalValue(c.getPlainText()));
  assert.match(sent.payload.reattachmentId, /^atlas-reattach-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u);
  assert.equal(h.commands.some(row => row.id === 'atlas.mention.confirm'), false); assert.equal(h.issued.length, 1);
});

test('actual occurrence choices show distinct ranges and surrounding context for repeated identical names', () => {
  const h = savedReattachmentRendererHarness();
  const select = h.walk(h.c.atlasJourneyHost).find(node => node.dataset.atlasJourneyField === 'mentionId');
  const first = select.children.find(node => node.value === 'mira-25'), second = select.children.find(node => node.value === 'mira-68');
  assert.ok(first); assert.ok(second); assert.notEqual(first.textContent, second.textContent);
  assert.match(first.textContent, /25.*29/u); assert.match(second.textContent, /68.*72/u);
  assert.match(first.textContent, /увидела/u); assert.match(second.textContent, /сохранила/u);
});

test('actual saved source selection refuses missing unavailable partial malformed or foreign projections', async t => {
  for (const [name, mutate] of [
    ['missing-sources', d => { delete d.evidenceLedger.sourceRecords; }], ['partial', d => { d.evidenceLedger.sourceRecordsComplete = false; }],
    ['unavailable', d => { d.state = 'unavailable'; d.unavailableReason = 'INBOX_UNAVAILABLE'; }],
    ['foreign-project', d => { d.projectId = 'foreign'; }], ['foreign-entity', d => { d.selectedEntityId = 'foreign'; }],
    ['bad-source-hash', d => { d.evidenceLedger.sourceRecords[0].sourceRecordHash = ''; }],
    ['truncated-original', d => { delete d.evidenceLedger.sourceRecords[0].evidenceAnchor.schemaVersion; }],
  ]) await t.test(name, async () => {
    const h = savedReattachmentRendererHarness(), d = h.dossier(); mutate(d); h.setDossier(d);
    const button = h.pickButton(); if (button) await button.emit('click');
    await h.target(); await h.apply(); assert.equal(h.commands.length, 0, name);
    assert.equal(h.button().disabled, true); assert.equal(h.issued.length, 0);
    if (name === 'partial' || name === 'unavailable') assert.match(h.c.atlasEntityDossierHost.textContent, /partial|неполн|unavailable|недоступ|INBOX_UNAVAILABLE/iu);
  });
});

test('actual reattachment refuses dirty unacknowledged source and stale detached source controls', async t => {
  for (const fault of ['dirty', 'unacked', 'project', 'entity', 'source-hash', 'detached']) await t.test(fault, async () => {
    const h = savedReattachmentRendererHarness(); await h.pick(); await h.target(); const old = h.button(), oldSource = h.pickButton();
    if (fault === 'dirty') h.c.localDirty = true;
    if (fault === 'unacked') h.c.localEditGeneration++;
    if (fault === 'project') h.c.currentProjectId = 'other';
    if (fault === 'entity') h.c.atlasSelectedEntityId = 'other';
    if (fault === 'source-hash') h.c.setPlainText(h.c.getPlainText() + ' Позже.');
    if (fault === 'detached') { h.c.invalidateAtlasPublications(); h.render(); await oldSource.emit('click'); }
    await old.emit('click'); await h.settle(); assert.equal(h.commands.length, 0, fault); assert.equal(h.issued.length, 0);
  });
});

test('actual same-intent retry retains UUID while accepted next source correction and cold intent receive distinct UUIDs', async () => {
  const h = savedReattachmentRendererHarness(); await h.pick(); await h.target();
  h.c.commandPort = () => ({ ok: false, error: { code: 'E_RETRY', reason: 'EXPLICIT_RETRY' } });
  await h.apply(); const first = h.commands[0].payload.reattachmentId;
  await h.apply(); assert.equal(h.commands[1].payload.reattachmentId, first); assert.equal(h.issued.length, 1);
  h.c.commandPort = () => ({ ok: true, value: { status: 'APPLIED' } }); await h.apply();
  assert.equal(h.commands[2].payload.reattachmentId, first);
  h.publish(SOURCE_CONTINUITY_PREFIX + SOURCE_CONTINUITY_TEXT + ' Позже.', 2); await h.pick(); await h.target('mira-25'); await h.apply();
  const second = h.commands[3].payload.reattachmentId; assert.notEqual(second, first); assert.equal(h.issued.length, 2);
  const cold = savedReattachmentRendererHarness(); cold.c.atlasStableUiIdSeq = 0; cold.c.atlasJourneyDraft.reattachmentId = '';
  await cold.pick(); await cold.target(); await cold.apply(); assert.notEqual(cold.commands[0].payload.reattachmentId, first);
  assert.notEqual(cold.commands[0].payload.reattachmentId, second); assert.equal(cold.issued.length, 1);
});

test('actual pending reattachment blocks duplicate dispatch and ignores stale asynchronous completion', async t => {
  for (const fault of ['project', 'entity', 'dirty', 'source', 'publication']) await t.test(fault, async () => {
    const h = savedReattachmentRendererHarness(), pending = h.deferred(); await h.pick(); await h.target();
    h.c.commandPort = () => pending.promise; await h.apply(); assert.equal(h.commands.length, 1);
    await h.apply(); assert.equal(h.commands.length, 1, 'one author intent cannot create concurrent canonical operations');
    if (fault === 'project') h.c.currentProjectId = 'replacement';
    if (fault === 'entity') h.c.atlasSelectedEntityId = 'replacement';
    if (fault === 'dirty') h.c.localDirty = true;
    if (fault === 'source') h.c.setPlainText(h.c.getPlainText() + ' Позже.');
    if (fault === 'publication') h.c.invalidateAtlasPublications();
    const queries = h.queries.length, before = JSON.stringify(h.c.atlasJourneyDraft);
    pending.resolve({ ok: true, value: { status: 'APPLIED' } }); await h.settle();
    assert.notEqual(h.c.atlasJourneyState.status, 'applied', 'stale completion must not publish success');
    assert.equal(JSON.stringify(h.c.atlasJourneyDraft), before); assert.equal(h.queries.length, queries);
  });
});

test('actual reattachment UUID absence refuses dispatch without falling back to the session counter', async () => {
  const h = savedReattachmentRendererHarness(); await h.pick(); await h.target(); h.c.crypto = {};
  await h.apply(); assert.equal(h.commands.length, 0); assert.equal(h.issued.length, 0);
  assert.notEqual(h.c.atlasJourneyState.status, 'applied');
});

test('AF1 actual current-scene focus refuses dirty shifted source without selecting unrelated text', async () => {
  const h = continuityRendererHarness(), c = h.c;
  c.focusAtlasMention('selected-mira'); assert.deepEqual(h.selected, [{ start: 14, end: 18, quote: 'Мира' }]);
  h.selected.length = 0; h.focused.length = 0; h.statuses.length = 0;
  c.setPlainText(SOURCE_CONTINUITY_PREFIX + SOURCE_CONTINUITY_TEXT); c.localEditGeneration = 2; c.localDirty = true;
  c.focusAtlasMention('selected-mira');
  assert.deepEqual(h.selected, []); assert.deepEqual(h.focused, []);
  assert.equal(h.statuses.some(s => s.value === 'Atlas evidence открыт в тексте'), false);
  assert.equal(c.getPlainText().slice(14, 18), 'ало '); assert.equal(c.getPlainText().slice(25, 29), 'Мира');
  await c.refreshAtlasCurrentScene(); assert.equal(h.queries.length, 0, 'dirty source must not request saved source as current');
  assert.equal(c.atlasCurrentSceneState.state, 'unavailable');
});

test('AF1 actual focus requires complete current project scene source quote and integral range', async t => {
  for (const [name, mutate] of [
    ['state', c => { c.atlasCurrentSceneState.state = 'loading'; }], ['project', c => { c.atlasCurrentSceneState.projectId = 'foreign'; }],
    ['scene', c => { c.atlasCurrentSceneState.sceneId = 'foreign'; }], ['mention-scene', c => { c.atlasCurrentSceneState.mentions[0].sceneId = 'foreign'; }],
    ['unacked', c => { c.lastAckedGeneration = 0; }], ['anchor-project', c => { c.atlasCurrentSceneState.mentions[0].evidenceAnchor.projectId = 'foreign'; }],
    ['anchor-entity', c => { c.atlasCurrentSceneState.mentions[0].evidenceAnchor.entityId = 'foreign'; }],
    ['anchor-scene', c => { c.atlasCurrentSceneState.mentions[0].evidenceAnchor.sceneId = 'foreign'; }],
    ['anchor-range', c => { c.atlasCurrentSceneState.mentions[0].evidenceAnchor.startOffset = 13; }],
    ['quote', c => { c.atlasCurrentSceneState.mentions[0].evidenceAnchor.quote = 'Лира'; }],
    ['quote-hash', c => { c.atlasCurrentSceneState.mentions[0].evidenceAnchor.quoteHash = '0'.repeat(64); }],
    ['source-hash', c => { c.atlasCurrentSceneState.mentions[0].evidenceAnchor.sceneTextHash = '0'.repeat(64); }],
    ['summary-hash', c => { c.atlasCurrentSceneState.summary.sceneTextHash = '0'.repeat(64); }],
    ['saved-source-append', c => { c.setPlainText(SOURCE_CONTINUITY_TEXT + ' append'); }],
    ['fractional', c => { c.atlasCurrentSceneState.mentions[0].startOffset = 14.5; }],
    ['empty', c => { c.atlasCurrentSceneState.mentions[0].endOffset = 14; }],
    ['negative', c => { c.atlasCurrentSceneState.mentions[0].startOffset = -1; }],
    ['too-far', c => { c.atlasCurrentSceneState.mentions[0].endOffset = 999; }],
    ['missing-anchor', c => { delete c.atlasCurrentSceneState.mentions[0].evidenceAnchor; }],
  ]) await t.test(name, () => {
    const h = continuityRendererHarness(); mutate(h.c); const before = h.c.getPlainText(); h.c.focusAtlasMention('selected-mira');
    assert.deepEqual(h.selected, [], name); assert.deepEqual(h.focused, [], name); assert.equal(h.c.getPlainText(), before);
    assert.equal(h.statuses.some(s => s.value === 'Atlas evidence открыт в тексте'), false);
  });
});

test('AF1 actual query cannot publish source mismatch and exact current SAVED refreshes correct shifted evidence', async () => {
  const h = continuityRendererHarness(), c = h.c, shifted = SOURCE_CONTINUITY_PREFIX + SOURCE_CONTINUITY_TEXT;
  c.setPlainText(shifted); c.localEditGeneration = 2; c.lastAckedGeneration = 2;
  c.queryPort = () => h.projection(); await c.refreshAtlasCurrentScene();
  assert.equal(c.atlasCurrentSceneState.state, 'unavailable', 'saved projection must agree with current live text');
  c.localDirty = true; c.lastAckedGeneration = 1; h.queries.length = 0;
  c.queryPort = () => h.projection(shifted, 25);
  h.dirty({ state: false, ack: { kind: 'SAVED', savedGeneration: 2 } }); await h.settle();
  assert.equal(c.localDirty, false); assert.equal(h.queries.length, 1);
  assert.equal(c.atlasCurrentSceneState.state, 'ready'); assert.equal(c.atlasCurrentSceneState.mentions[0].startOffset, 25);
  c.focusAtlasMention('selected-mira'); assert.deepEqual(h.selected, [{ start: 25, end: 29, quote: 'Мира' }]);
  c.setPlainText(SOURCE_CONTINUITY_TEXT); c.localEditGeneration = 3; c.localDirty = true; h.selected.length = 0;
  c.queryPort = () => h.projection(); h.dirty({ state: false, ack: { kind: 'SAVED', savedGeneration: 3 } }); await h.settle();
  c.focusAtlasMention('selected-mira'); assert.deepEqual(h.selected, [{ start: 14, end: 18, quote: 'Мира' }]);
});

test('AF1 actual SaveACK never admits stale protected at-risk or legacy-false source and hidden surfaces do not refresh', async t => {
  for (const [name, message] of [ ['stale', { state: false, ack: { kind: 'SAVED', savedGeneration: 1 } }],
    ['protected', { state: true, ack: { kind: 'PROTECTED' } }], ['at-risk', { state: true, ack: { kind: 'AT_RISK' } }], ['legacy', false] ]) await t.test(name, async () => {
    const h = continuityRendererHarness(), c = h.c; c.setPlainText(SOURCE_CONTINUITY_PREFIX + SOURCE_CONTINUITY_TEXT); c.localEditGeneration = 2; c.localDirty = true;
    h.dirty(message); await h.settle(); assert.equal(h.queries.length, 0); c.focusAtlasMention('selected-mira'); assert.deepEqual(h.selected, []);
  });
  for (const surface of ['manualMap', 'entity']) {
    const h = continuityRendererHarness(); h.c.currentAtlasSurface = surface; h.c.localDirty = true;
    h.dirty({ state: false, ack: { kind: 'SAVED', savedGeneration: 1 } }); await h.settle(); assert.equal(h.queries.length, 0);
  }
});

test('AF1 actual query pending across edits project scene publication or surface switches cannot publish late evidence', async t => {
  for (const [name, mutate] of [ ['edit', c => { c.localEditGeneration++; c.localDirty = true; }],
    ['dirty-only', c => { c.localDirty = true; }],
    ['project', c => { c.currentProjectId = 'foreign'; }], ['scene', c => { c.currentDocumentId = 'foreign'; }],
    ['publication', c => { c.currentTreeContentPublicationId = 'new'; }], ['surface', c => { c.currentAtlasSurface = 'manualMap'; }],
    ['away-back', c => { c.invalidateAtlasPublications(); c.invalidateAtlasPublications(); }] ]) await t.test(name, async () => {
    const h = continuityRendererHarness(), gate = h.deferred(); h.c.queryPort = () => gate.promise;
    const pending = h.c.refreshAtlasCurrentScene(); assert.equal(h.queries.length, 1); mutate(h.c);
    const before = JSON.stringify(h.c.atlasCurrentSceneState); gate.resolve(h.projection()); await pending;
    assert.equal(JSON.stringify(h.c.atlasCurrentSceneState), before); assert.deepEqual(h.selected, []);
  });
});


test('AF1 actual current-scene query preserves typed upstream refusal failure and no-scene empty reasons', async t => {
  for (const kind of ['unavailable', 'query-failed', 'no-scene-empty', 'source-bearing-empty']) await t.test(kind, async () => {
    const h = continuityRendererHarness(), c = h.c;
    let result = h.projection();
    if (kind === 'unavailable') result = { ok: true, atlasCurrentScene: { state: 'unavailable', unavailableReason: 'ATLAS_CAPABILITY_DENIED', projectId: c.currentProjectId, sceneId: c.currentDocumentId } };
    if (kind === 'query-failed') result = { ok: false, error: { code: 'E_ATLAS_CAPABILITY_DENIED' } };
    if (kind === 'no-scene-empty') { c.currentDocumentId = ''; result = { ok: true, atlasCurrentScene: { state: 'empty', unavailableReason: '', projectId: c.currentProjectId, sceneId: '' } }; }
    if (kind === 'source-bearing-empty') result.atlasCurrentScene.state = 'empty';
    c.queryPort = () => result; await c.refreshAtlasCurrentScene();
    assert.equal(c.atlasCurrentSceneState.state, kind.endsWith('empty') ? 'empty' : 'unavailable');
    assert.equal(c.atlasCurrentSceneState.unavailableReason, kind === 'unavailable' ? 'ATLAS_CAPABILITY_DENIED' : kind === 'query-failed' ? 'ATLAS_QUERY_FAILED' : '');
    assert.deepEqual(h.selected, []); assert.deepEqual(h.focused, []);
  });
});


function productionContinuityTextAdapter() {
  const Module = require('node:module'), tiptap = fs.readFileSync(path.join(repoRoot, 'src/renderer/tiptap/index.js'), 'utf8');
  const imports = tiptap.slice(0, tiptap.indexOf('let currentEditorInstance'));
  const extensions = tiptap.slice(tiptap.indexOf('    extensions: [') + '    extensions: '.length, tiptap.indexOf("    content: '<p></p>'")).trim().replace(/,$/, '');
  const readers = tiptap.slice(tiptap.indexOf('function readEditorText('), tiptap.indexOf('function normalizeFormattingColor('));
  const actual = name => { const start = tiptap.indexOf('export function ' + name + '('), end = tiptap.indexOf('\n}\n', start);
    assert.ok(start >= 0 && end > start); return tiptap.slice(start, end + 2); };
  const output = require('esbuild').buildSync({ stdin: { contents: imports + '\nlet currentEditorInstance=null;\n' + readers
    + '\nconst extensions=' + extensions + ';export {Editor,extensions};export const bindEditor=editor=>{currentEditorInstance=editor};\n'
    + actual('getTiptapPlainText') + '\n' + actual('getTiptapDocumentSnapshot'), resolveDir: path.join(repoRoot, 'src/renderer/tiptap') },
    bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent' }).outputFiles[0].text;
  // In-memory production module, no repository/temp output or invented text reader.
  const file = path.join(repoRoot, 'finite-atlas-text-adapter.cjs'), compiled = new Module(file, module);
  compiled.filename = file; compiled.paths = Module._nodeModulePaths(repoRoot); compiled._compile(output, file); return compiled.exports;
}

test('AF1 actual production Tiptap shared envelope preserves trailing empty paragraphs and refuses incompatible source coordinates [HEADLESS_NOT_NATIVE]', async t => {
  const production = productionContinuityTextAdapter(), envelope = require('../../src/core/document-content-envelope-v1.cjs'), vm = require('node:vm');
  for (const [kind, rawText, start, compatible] of [
    ['normal-unicode-repeated', SOURCE_CONTINUITY_TEXT, 57, true],
    ['multiple-paragraphs', SOURCE_CONTINUITY_TEXT + '\nПослесловие.', 57, true],
    ['trailing-one-LF', SOURCE_CONTINUITY_TEXT + '\n', 57, true],
    ['trailing-two-LF', SOURCE_CONTINUITY_TEXT + '\n\n', 57, true],
    ['trailing-three-LF', SOURCE_CONTINUITY_TEXT + '\n\n\n', 57, true],
    ['leading-empty', '\n' + SOURCE_CONTINUITY_TEXT, 57, false],
    ['internal-collapsed-before', SOURCE_CONTINUITY_TEXT.replace('. Мира', '.\n\n\nМира'), 58, false],
    ['internal-collapsed-after-matching-quote', SOURCE_CONTINUITY_TEXT + '\n\n\nМира', 14, false],
  ]) await t.test(kind, async () => {
    const h = continuityRendererHarness(), c = h.c, doc = envelope.buildParagraphDocumentFromText(rawText);
    const editor = new production.Editor({ element: null, extensions: production.extensions, content: doc });
    try {
      production.bindEditor(editor);
      Object.assign(c, { isTiptapMode: true, centralSheetStripLargePayloadFastPathActive: false, plainTextBuffer: '',
        metaEnabled: false, currentMeta: envelope.createDefaultDocumentMeta(), currentCards: [],
        composeObservablePayload: envelope.composeObservablePayload, parseObservablePayload: envelope.parseObservablePayload,
        getTiptapPlainText: production.getTiptapPlainText, getTiptapDocumentSnapshot: production.getTiptapDocumentSnapshot });
      for (const name of ['getPlainText', 'composeDocumentContent', 'parseDocumentContent']) {
        const at = editorSourceFunction(name); vm.runInContext(at, c);
      }
      const savedRaw = c.composeDocumentContent(), saved = envelope.parseObservablePayload(savedRaw), before = JSON.stringify(editor.getJSON());
      assert.equal(saved.issue, null); assert.equal(c.getPlainText(), rawText); assert.equal(saved.text.slice(start, start + 4), 'Мира');
      c.queryPort = () => h.projection(saved.text, start); await c.refreshAtlasCurrentScene();
      assert.equal(c.atlasCurrentSceneState.state, compatible ? 'ready' : 'unavailable', kind);
      c.focusAtlasMention('selected-mira');
      assert.deepEqual(h.selected, compatible ? [{ start, end: start + 4, quote: 'Мира' }] : [], kind);
      assert.equal(h.statuses.some(s => s.value === 'Atlas evidence открыт в тексте'), compatible, kind);
      assert.equal(c.getPlainText(), rawText); assert.equal(JSON.stringify(editor.getJSON()), before); assert.equal(c.composeDocumentContent(), savedRaw);
      if (kind === 'internal-collapsed-after-matching-quote') assert.equal(rawText.slice(start, start + 4), 'Мира', 'matching local quote cannot certify incompatible whole source');
    } finally { editor.destroy(); }
  });
});

function editorSourceFunction(name) {
  const match = new RegExp('^(?:async )?function ' + name + '\\(', 'm').exec(editor), end = match && editor.indexOf('\n}\n', match.index);
  assert.ok(match && end > match.index, name); return editor.slice(match.index, end + 2);
}


test('AF1 actual focus refuses a forged source witness extending into discarded trailing LF despite consistent raw quote and canonical hash', async () => {
  const h = continuityRendererHarness(), c = h.c, text = SOURCE_CONTINUITY_TEXT + '\n'; c.setPlainText(text);
  c.queryPort = () => h.projection(); await c.refreshAtlasCurrentScene(); assert.equal(c.atlasCurrentSceneState.state, 'ready');
  const mention = c.atlasCurrentSceneState.mentions[0], start = SOURCE_CONTINUITY_TEXT.length - 1, end = text.length, quote = text.slice(start, end);
  assert.equal(quote, '.\n'); assert.equal(end > SOURCE_CONTINUITY_TEXT.length, true); assert.equal(end <= text.length, true);
  Object.assign(mention, { matchedText: quote, startOffset: start, endOffset: end });
  Object.assign(mention.evidenceAnchor, { startOffset: start, endOffset: end, quote, quoteHash: h.digest(quote), sceneTextHash: h.digest(SOURCE_CONTINUITY_TEXT) });
  assert.equal(c.atlasCurrentSceneState.summary.sceneTextHash, h.digest(SOURCE_CONTINUITY_TEXT));
  c.focusAtlasMention('selected-mira'); assert.deepEqual(h.selected, []); assert.deepEqual(h.focused, []);
  assert.equal(h.statuses.some(s => s.value === 'Atlas evidence открыт в тексте'), false); assert.equal(c.getPlainText(), text);
});
