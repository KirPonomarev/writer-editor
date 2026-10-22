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
function draftDomHarness() {
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
    currentProjectId: 'project-a', manualMapCommandDraft: null, manualMapSearchQuery: '',
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
    return editor.slice(start, end + 2);
  }
  const names = ['manualMapText', 'createManualMapCommandDraft', 'openManualMapCommandDraft',
    'cancelManualMapCommandDraft', 'updateManualMapCommandDraftField', 'setManualMapCommandDraftConfirmation',
    'applyManualMapCommandDraft', 'renderManualMapCommandDraft', 'renderManualMapWorkbenchInto',
    'renderManualMapWorkbenchState'];
  if (editor.includes('function syncManualMapCommandDraftControls(')) names.push('syncManualMapCommandDraftControls');
  vm.runInContext(names.map(sourceFunction).join('\n') + '\n' +
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
