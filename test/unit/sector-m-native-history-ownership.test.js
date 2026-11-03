const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const indexSource = read('src/renderer/tiptap/index.js');
const editorSource = read('src/renderer/editor.js');
const ids = { undo: 'cmd.project.edit.undo', redo: 'cmd.project.edit.redo' };

function actualFunction(source, name, optional = false) {
  const start = source.indexOf('function ' + name + '(');
  if (start < 0 && optional) return '';
  assert.ok(start >= 0, 'production function ' + name);
  const end = source.indexOf('\n}', start);
  assert.ok(end > start, 'whole production function ' + name);
  return source.slice(start, end + 2);
}

function liveListener(editor = null) {
  const hostCalls = [], directCalls = [];
  let listener;
  const context = vm.createContext({
    window: { electronAPI: { onRuntimeCommand(callback) { listener = callback; } } },
    currentEditorInstance: editor, runtimeCommandListenerAttached: false,
    recoveryRestoredListenerAttached: false, userBookmarkManageHandler: null,
    runtimeHistoryCommandHandler: null,
    currentRuntimeBridge: { handleRuntimeCommand(packet) { directCalls.push(packet); }, setRuntimeHandlers() {} },
  });
  vm.runInContext([
    actualFunction(indexSource, 'routeRuntimeHistoryCommand', true),
    actualFunction(indexSource, 'ensureRuntimeListenersAttached'),
    actualFunction(indexSource, 'setTiptapRuntimeHandlers'),
  ].join('\n'), context);
  context.setTiptapRuntimeHandlers({ historyCommand: commandId => hostCalls.push(commandId) });
  context.ensureRuntimeListenersAttached();
  assert.equal(typeof listener, 'function');
  return { context, hostCalls, directCalls, send: packet => listener(packet) };
}

test('live IPC history enters the host Kernel once, including matching legacy envelopes and absent Writer', () => {
  for (const action of ['undo', 'redo']) for (const editor of [null, { isDestroyed: true }, { isEditable: false }, {}]) {
    for (const packet of [
      { commandId: ids[action] }, { command: action }, { command: 'edit-' + action },
      { commandId: ids[action], command: 'edit-' + action, payload: { source: 'menu' } },
    ]) {
      const h = liveListener(editor); h.send(packet);
      assert.deepEqual(h.hostCalls, [ids[action]], JSON.stringify(packet));
      assert.deepEqual(h.directCalls, [], 'live IPC must never mutate through the private bridge');
    }
  }
});

test('live history refuses disagreeing or malformed selectors before private bridge fallback', () => {
  for (const packet of [
    { commandId: ids.undo, command: 'redo' }, { commandId: ids.redo, command: 'edit-undo' },
    { commandId: 'cmd.project.save', command: 'undo' }, { commandId: '', command: 'undo' },
    { commandId: null, command: 'edit-redo' }, { commandId: {}, command: 'undo' },
    { commandId: ids.undo, command: '' }, { commandId: ids.redo, command: null },
    { commandId: ids.undo, command: 'undo-extra' }, { commandId: ids.redo, command: [] },
  ]) {
    const h = liveListener({}); h.send(packet);
    assert.deepEqual(h.hostCalls, []); assert.deepEqual(h.directCalls, [], JSON.stringify(packet));
  }
});

test('missing history host never falls back and window-lifetime handler survives an editor teardown', () => {
  const h = liveListener({}); h.context.setTiptapRuntimeHandlers({}); h.send({ commandId: ids.undo });
  assert.deepEqual(h.hostCalls, []); assert.deepEqual(h.directCalls, []);
  h.context.setTiptapRuntimeHandlers({ historyCommand: id => h.hostCalls.push(id) });
  h.context.currentEditorInstance = null; h.context.currentRuntimeBridge = null;
  h.send({ commandId: ids.redo }); assert.deepEqual(h.hostCalls, [ids.redo]);
});

test('unrelated runtime commands retain their existing bridge path and readonly refusal', () => {
  const h = liveListener({}); const packet = { commandId: 'cmd.project.view.openSettings' };
  h.send(packet); assert.deepEqual(h.directCalls, [packet]); assert.deepEqual(h.hostCalls, []);
  const locked = liveListener({ isEditable: false }); locked.send({ commandId: 'cmd.project.format.toggleBold' });
  assert.deepEqual(locked.directCalls, []); assert.deepEqual(locked.hostCalls, []);
});

test('non-record runtime envelopes refuse before any interpretation or bridge call', () => {
  for (const packet of [null, undefined, false, 43, 'undo', [], Object.assign([], { commandId: ids.undo })]) {
    const h = liveListener({}); h.send(packet);
    assert.deepEqual(h.hostCalls, []); assert.deepEqual(h.directCalls, []);
  }
});

class Element {
  constructor(tagName = 'DIV', extra = {}) {
    Object.assign(this, { tagName, type: 'text', isConnected: true, readOnly: false,
      disabled: false, inheritedDisabled: false, isContentEditable: false, dataset: {} }, extra);
  }
  matches(selector) { assert.equal(selector, ':disabled'); return this.disabled || this.inheritedDisabled; }
  contains(element) { return this === element || this.child === element; }
  closest(selector) {
    if (selector === 'button[data-action]') return this.tagName === 'BUTTON' && this.dataset.action ? this : null;
    return null;
  }
}

async function authoringHarness() {
  const { Schema } = require('@tiptap/pm/model');
  const { EditorState } = require('@tiptap/pm/state');
  const { history, closeHistory, undo, redo, undoDepth, redoDepth } = require('@tiptap/pm/history');
  const schema = new Schema({ nodes: { doc: { content: 'paragraph+' },
    paragraph: { content: 'text*', group: 'block' }, text: { group: 'inline' } } });
  let state = EditorState.create({ schema, plugins: [history()] });
  for (const text of ['A — e\u0301 🧭', 'B — e\u0301 🧭', 'C — e\u0301 🧭']) {
    state = state.apply(closeHistory(state.tr.insertText(text, 1, state.doc.content.size - 1)));
  }
  const pmDom = new Element(), control = new Element('INPUT'), toolbarButton = new Element('BUTTON', { dataset: { action: 'undo' } });
  const document = { activeElement: pmDom, focused: true, hasFocus() { return this.focused; },
    execCommand(action) { nativeCalls.push(action); return nativeResult; } };
  let nativeResult = true, pmCalls = 0, generation = 3;
  const nativeCalls = [], kernelCalls = [], toolbarShell = new Element(); toolbarShell.child = toolbarButton;
  const pm = { get state() { return state; }, isDestroyed: false, isEditable: true,
    view: { dom: pmDom, composing: false }, commands: {
      undo() { pmCalls++; return undo(state, tr => { state = state.apply(tr); generation++; }); },
      redo() { pmCalls++; return redo(state, tr => { state = state.apply(tr); generation++; }); },
    } };
  const bridgeModule = read('src/renderer/tiptap/runtimeBridge.js');
  const { createTiptapRuntimeBridge } = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(bridgeModule));
  let auxiliary = null;
  const bridge = createTiptapRuntimeBridge({ editor: pm, resolveHistoryEditor: () => auxiliary || pm });
  const context = vm.createContext({ document, HTMLElement: Element,
    editor: pmDom, currentProjectId: 'project-test', currentDocumentId: 'node-test',
    isTiptapMode: true, fullEnvironmentComposing: false,
    currentEditorInstance: pm, getFocusedManuscriptBodyEditor: () => auxiliary,
    toolbarShell, beginCentralSheetStripStructuralTransition() {},
    undoTiptap: () => bridge.undo(), redoTiptap: () => bridge.redo(),
  });
  vm.runInContext([
    actualFunction(indexSource, 'isTiptapHistoryTargetFocused', true),
    actualFunction(editorSource, 'runFocusedHistoryCommand', true),
    actualFunction(editorSource, 'handleUndo'), actualFunction(editorSource, 'handleRedo'),
  ].join('\n'), context);
  const { createCommandRegistry } = await import('../../src/renderer/commands/registry.mjs');
  const { createCommandRunner } = await import('../../src/renderer/commands/runCommand.mjs');
  const { registerProjectCommands } = await import('../../src/renderer/commands/projectCommands.mjs');
  const { runCommandThroughBus } = await import('../../src/renderer/commands/commandBusGuard.mjs');
  const registry = createCommandRegistry();
  registerProjectCommands(registry, { uiActions: { undo: () => context.handleUndo(), redo: () => context.handleRedo() } });
  const runner = createCommandRunner(registry);
  return { context, pm, pmDom, control, toolbarButton, toolbarShell, document, nativeCalls, kernelCalls,
    set nativeResult(value) { nativeResult = value; },
    get pmCalls() { return pmCalls; }, get generation() { return generation; },
    observe: () => ({ doc: state.doc.toJSON(), undo: undoDepth(state), redo: redoDepth(state), generation }),
    async invoke(action, input = {}) {
      kernelCalls.push(ids[action]);
      const result = await runCommandThroughBus(runner, ids[action], { platformId: 'node', editorMode: 'tiptap', ...input }, { route: 'command.bus' });
      if (input.platformId !== 'unavailable-platform') assert.equal(result.ok, true, JSON.stringify(result));
      return result;
    },
  };
}

test('post-Kernel actual PM history performs C to B to C once with independent PM depths and generations', async () => {
  const h = await authoringHarness(), c = h.observe();
  assert.equal(c.undo, 3); assert.equal(c.redo, 0);
  await h.invoke('undo'); const b = h.observe();
  assert.equal(b.doc.content[0].content[0].text, 'B — e\u0301 🧭');
  assert.equal(b.undo, 2); assert.equal(b.redo, 1); assert.equal(b.generation, c.generation + 1);
  await h.invoke('redo'); const restored = h.observe();
  assert.deepEqual(restored.doc, c.doc); assert.equal(restored.undo, 3); assert.equal(restored.redo, 0);
  assert.equal(restored.generation, c.generation + 2); assert.equal(h.pmCalls, 2);
  assert.deepEqual(h.kernelCalls, [ids.undo, ids.redo]); assert.deepEqual(h.nativeCalls, []);
});

test('native INPUT and TEXTAREA select browser adapter after Kernel without a project or any Writer change', async () => {
  for (const tagName of ['INPUT', 'TEXTAREA']) for (const action of ['undo', 'redo']) {
    const h = await authoringHarness(), before = h.observe();
    h.control.tagName = tagName; h.document.activeElement = h.control;
    h.context.currentProjectId = ''; h.context.currentDocumentId = '';
    const result = await h.invoke(action);
    assert.equal(result.ok, true); assert.equal(result.value.result.performed, true);
    assert.deepEqual(h.nativeCalls, [action]); assert.equal(h.pmCalls, 0); assert.deepEqual(h.observe(), before);
  }
});

test('invalid native targets never fallback to Writer, including inherited disabled state', async () => {
  for (const mutation of [control => { control.readOnly = true; }, control => { control.disabled = true; },
    control => { control.inheritedDisabled = true; }, control => { control.type = 'number'; },
    control => { control.type = 'checkbox'; }, control => { control.type = 'file'; },
    control => { control.isConnected = false; }]) {
    for (const action of ['undo', 'redo']) {
      const h = await authoringHarness(), before = h.observe(); mutation(h.control); h.document.activeElement = h.control;
      const result = await h.invoke(action); assert.equal(result.value.result.performed, false);
      assert.deepEqual(h.nativeCalls, []); assert.equal(h.pmCalls, 0); assert.deepEqual(h.observe(), before);
    }
  }
});

test('lost focus, wrong PM owner, composing, readonly, destroyed and absent authoring identity refuse', async () => {
  for (const mutation of [h => { h.document.focused = false; }, h => { h.document.activeElement = new Element(); },
    h => { h.document.activeElement = new Element('SELECT'); }, h => { h.pmDom.isConnected = false; },
    h => { h.pm.isDestroyed = true; }, h => { h.pm.isEditable = false; }, h => { h.pm.view.composing = true; },
    h => { h.context.currentProjectId = ''; }, h => { h.context.currentDocumentId = ''; }]) {
    const h = await authoringHarness(), before = h.observe(); mutation(h);
    const result = await h.invoke('undo'); assert.equal(result.value.result.performed, false);
    assert.equal(h.pmCalls, 0); assert.deepEqual(h.nativeCalls, []); assert.deepEqual(h.observe(), before);
  }
});

test('native adapter false and empty PM history never manufacture an edit or generation', async () => {
  const h = await authoringHarness(); h.document.activeElement = h.control; h.nativeResult = false;
  const before = h.observe(); const refused = await h.invoke('undo');
  assert.equal(refused.value.result.performed, false); assert.deepEqual(h.observe(), before);
  h.document.activeElement = h.pmDom;
  for (let n = 0; n < 3; n++) await h.invoke('undo');
  const empty = h.observe(); assert.equal(empty.undo, 0);
  const result = await h.invoke('undo'); assert.equal(result.value.result.performed, false);
  assert.deepEqual(h.observe(), empty);
});

test('owned toolbar target uses existing history effect; unrelated button cannot acquire Writer history', async () => {
  const h = await authoringHarness(); h.document.activeElement = h.toolbarButton;
  const result = await h.invoke('undo'); assert.equal(result.value.result.performed, true);
  assert.equal(h.pmCalls, 1); assert.deepEqual(h.nativeCalls, []);
  const before = h.observe(); h.document.activeElement = new Element('BUTTON', { dataset: { action: 'undo' } });
  const refused = await h.invoke('undo'); assert.equal(refused.value.result.performed, false); assert.deepEqual(h.observe(), before);
});

test('capability refusal happens before either target adapter', async () => {
  for (const target of ['control', 'pmDom']) {
    const h = await authoringHarness(); h.document.activeElement = h[target]; const before = h.observe();
    const result = await h.invoke('undo', { platformId: 'unavailable-platform' });
    assert.equal(result.ok, false); assert.equal(h.pmCalls, 0); assert.deepEqual(h.nativeCalls, []); assert.deepEqual(h.observe(), before);
  }
});

test('the existing global composition fence protects both native fields and the PM target', async () => {
  for (const target of ['control', 'pmDom']) {
    const h = await authoringHarness(); h.document.activeElement = h[target];
    h.context.fullEnvironmentComposing = true; const before = h.observe();
    const result = await h.invoke('undo'); assert.equal(result.value.result.performed, false);
    assert.equal(h.pmCalls, 0); assert.deepEqual(h.nativeCalls, []); assert.deepEqual(h.observe(), before);
  }
});

test('a replaced registered PM owner cannot receive history from the still-focused old DOM', async () => {
  const h = await authoringHarness(), before = h.observe();
  h.context.currentEditorInstance = { ...h.pm, view: { dom: new Element(), composing: false } };
  const result = await h.invoke('undo'); assert.equal(result.value.result.performed, false);
  assert.equal(h.pmCalls, 0); assert.deepEqual(h.observe(), before);
});

test('actual toolbar and live host handlers dispatch existing canonical Kernel ids rather than direct history', () => {
  const ui = actualFunction(editorSource, 'handleUiAction');
  const calls = [], context = vm.createContext({ EXTRA_COMMAND_IDS: { EDIT_UNDO: ids.undo, EDIT_REDO: ids.redo },
    dispatchUiCommand: commandId => calls.push(commandId) });
  vm.runInContext(ui, context);
  for (const action of ['undo', 'redo']) {
    const before = calls.length; assert.equal(context.handleUiAction(action), true);
    assert.equal(calls.length, before + 1); assert.equal(calls.at(-1), ids[action]);
    const branch = ui.slice(ui.indexOf("case '" + action + "':"));
    const body = branch.slice(0, branch.indexOf('\n    case ', 1));
    assert.match(body, new RegExp('dispatchUiCommand\\(EXTRA_COMMAND_IDS.EDIT_' + action.toUpperCase()));
    assert.doesNotMatch(body, /handleUndo|handleRedo|undoTiptap|redoTiptap/);
  }
  const host = editorSource.slice(editorSource.indexOf('setTiptapRuntimeHandlers({'));
  assert.match(host.slice(0, host.indexOf('\n    });')), /historyCommand:\s*\(commandId\)\s*=>\s*\{\s*void dispatchUiCommand\(commandId\)/);
});
