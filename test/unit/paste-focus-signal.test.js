const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function extractFunctionBody(source, functionName) {
  const signature = `function ${functionName}`;
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `Missing ${functionName}`);

  const bodyStart = source.indexOf('{', start);
  assert.notEqual(bodyStart, -1, `Missing ${functionName} body`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) {
      return source.slice(bodyStart + 1, index);
    }
  }

  assert.fail(`Unterminated ${functionName} body`);
}

function extractFunctionSource(source, functionName) {
  const signature = `function ${functionName}`;
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `Missing ${functionName}`);

  const bodyStart = source.indexOf('{', start);
  assert.notEqual(bodyStart, -1, `Missing ${functionName} body`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) {
      return source.slice(start, index + 1);
    }
  }

  assert.fail(`Unterminated ${functionName} source`);
}

test('paste focus signal uses a narrow boolean preload bridge', () => {
  const preloadSource = read('src/preload.js');
  const editorSource = read('src/renderer/editor.js');
  const mainSource = read('src/main.js');

  assert.match(preloadSource, /const EDITOR_PASTE_FOCUS_STATE_CHANNEL = ['"]editor:paste-focus-state['"]/);
  assert.match(preloadSource, /notifyEditorPasteFocusState:\s*\(focused\)\s*=>\s*\{/);
  assert.match(preloadSource, /focused:\s*focused\s*===\s*true/);
  assert.match(preloadSource, /ipcRenderer\.send\(EDITOR_PASTE_FOCUS_STATE_CHANNEL/);

  assert.match(editorSource, /function\s+isEditorPasteTargetFocused\s*\(/);
  assert.match(editorSource, /activeElement\.closest\(['"]\.ProseMirror['"]\)/);
  assert.match(editorSource, /proseMirror\.isContentEditable/);
  assert.match(editorSource, /notifyEditorPasteFocusState\(isEditorPasteTargetFocused\(\)\)/);

  assert.match(mainSource, /const EDITOR_PASTE_FOCUS_STATE_CHANNEL = ['"]editor:paste-focus-state['"]/);
  assert.match(mainSource, /function\s+normalizeEditorPasteFocusState\s*\(/);
  assert.match(mainSource, /typeof payload\.focused !== ['"]boolean['"]/);
  assert.match(mainSource, /mainWindow\.on\(['"]blur['"]/);
});

test('main process paste handler has no renderer probe and no unguarded synthetic paste', () => {
  const mainSource = read('src/main.js');
  const handlerBody = extractFunctionBody(mainSource, 'handlePrimaryPasteShortcut');

  assert.equal(mainSource.includes('executeJavaScript'), false);
  assert.equal(mainSource.includes('focusProbeScript'), false);
  assert.doesNotMatch(handlerBody, /document\.activeElement/);
  assert.doesNotMatch(handlerBody, /\.ProseMirror/);
  assert.doesNotMatch(handlerBody, /isContentEditable/);
  assert.match(handlerBody, /isEditorPasteTargetFocused\s*!==\s*true/);
  assert.match(handlerBody, /win\.webContents\.paste\(\)/);
  assert.ok(
    handlerBody.indexOf('isEditorPasteTargetFocused !== true') < handlerBody.indexOf('win.webContents.paste()'),
    'synthetic paste must remain behind the renderer focus signal guard',
  );
  assert.doesNotMatch(handlerBody, /event\.preventDefault\(\)/);
});

test('main process paste handler behavior follows renderer focus signal', () => {
  const mainSource = read('src/main.js');
  const detectorSource = extractFunctionSource(mainSource, 'isPrimaryPasteShortcut');
  const handlerSource = extractFunctionSource(mainSource, 'handlePrimaryPasteShortcut');
  const module = { exports: {} };

  vm.runInNewContext(`
    let isEditorPasteTargetFocused = false;
    ${detectorSource}
    ${handlerSource}
    module.exports = {
      setEditorPasteTargetFocused(value) {
        isEditorPasteTargetFocused = value;
      },
      handlePrimaryPasteShortcut,
    };
  `, {
    module,
    process: { platform: 'linux' },
  });

  const shortcut = {
    type: 'keyDown',
    key: 'v',
    control: true,
    meta: false,
    alt: false,
    shift: false,
    isAutoRepeat: false,
  };
  const makeWindow = () => {
    let pasteCount = 0;
    return {
      get pasteCount() {
        return pasteCount;
      },
      isDestroyed: () => false,
      isFocused: () => true,
      webContents: {
        isDestroyed: () => false,
        paste: () => {
          pasteCount += 1;
        },
      },
    };
  };

  const falseWindow = makeWindow();
  module.exports.setEditorPasteTargetFocused(false);
  assert.equal(module.exports.handlePrimaryPasteShortcut({}, shortcut, falseWindow), true);
  assert.equal(falseWindow.pasteCount, 0);

  const trueWindow = makeWindow();
  module.exports.setEditorPasteTargetFocused(true);
  assert.equal(module.exports.handlePrimaryPasteShortcut({}, shortcut, trueWindow), true);
  assert.equal(trueWindow.pasteCount, 1);

  const nonShortcutWindow = makeWindow();
  module.exports.setEditorPasteTargetFocused(true);
  assert.equal(module.exports.handlePrimaryPasteShortcut({}, { ...shortcut, key: 'x' }, nonShortcutWindow), false);
  assert.equal(nonShortcutWindow.pasteCount, 0);
});

// Finite DOM/browser-effect ports: production classifier, listeners, preload
// serialization and Main decisions execute unchanged. This is not native input.
function clipboardFocusHarness(platform = 'darwin') {
  class Element {
    constructor(tagName = 'DIV', properties = {}) {
      Object.assign(this, { tagName, type: 'text', connected: true, readOnly: false,
        disabled: false, parentElement: null, children: [], editable: undefined,
        proseMirror: false, value: 'Aе\u0301🧭Z', selectionStart: 1, selectionEnd: 4 }, properties);
    }
    append(child) { child.parentElement = this; this.children.push(child); return child; }
    get isConnected() { return this.connected && (!this.parentElement || this.parentElement.isConnected); }
    get isContentEditable() { return this.editable ?? this.parentElement?.isContentEditable ?? false; }
    closest(selector) {
      assert.equal(selector, '.ProseMirror');
      for (let node = this; node; node = node.parentElement) if (node.proseMirror) return node;
      return null;
    }
    contains(value) {
      for (let node = value; node; node = node.parentElement) if (node === this) return true;
      return false;
    }
    matches(selector) {
      assert.equal(selector, ':disabled');
      if (this.disabled) return true;
      for (let node = this.parentElement; node; node = node.parentElement) {
        if (node.tagName !== 'FIELDSET' || !node.disabled) continue;
        const firstLegend = node.children.find(child => child.tagName === 'LEGEND');
        if (!firstLegend || !firstLegend.contains(this)) return true;
      }
      return false;
    }
  }
  let focused = true;
  const calls = [], effects = [], frames = [], documentHandlers = {}, windowHandlers = {};
  const mainSource = read('src/main.js'), preloadSource = read('src/preload.js');
  const context = vm.createContext({ process: { platform } });
  vm.runInContext('let isEditorPasteTargetFocused = false;\n' + [
    'normalizeEditorPasteFocusState', 'isPrimaryPasteShortcut',
    'handlePrimaryPasteShortcut', 'handlePrimaryCutShortcut',
  ].map(name => extractFunctionSource(mainSource, name)).join('\n'), context);
  context.ipcRenderer = { send(channel, payload) {
    assert.equal(channel, 'editor:paste-focus-state');
    assert.deepEqual(Object.keys(payload), ['focused']);
    const state = context.normalizeEditorPasteFocusState(payload);
    assert.equal(typeof state, 'boolean');
    calls.push(state); context.focusSignal = state;
    vm.runInContext('isEditorPasteTargetFocused = focusSignal;', context);
  } };
  const preloadMethod = preloadSource.match(/notifyEditorPasteFocusState:\s*(\(focused\)\s*=>\s*\{[\s\S]*?\n  \}),/);
  assert.ok(preloadMethod, 'actual narrow preload method');
  vm.runInContext("const EDITOR_PASTE_FOCUS_STATE_CHANNEL = 'editor:paste-focus-state';\n"
    + 'this.preloadNotify = ' + preloadMethod[1] + ';', context);
  const document = { activeElement: new Element('BODY'), hasFocus: () => focused,
    addEventListener(type, callback) { documentHandlers[type] = callback; } };
  const window = { electronAPI: { notifyEditorPasteFocusState: context.preloadNotify },
    addEventListener(type, callback) { windowHandlers[type] = callback; },
    requestAnimationFrame(callback) { frames.push(callback); } };
  const renderer = read('src/renderer/editor.js');
  vm.runInContext(renderer.slice(renderer.indexOf('function isEditorPasteTargetFocused()'),
    renderer.indexOf("const statusElement = document.getElementById('status');")),
  vm.createContext({ window, document, HTMLElement: Element }));
  let prevented = 0;
  const event = { preventDefault() { prevented++; } };
  const nativeWindow = { isDestroyed: () => false, isFocused: () => focused,
    webContents: { isDestroyed: () => false,
      paste() { effects.push({ kind: 'paste', target: document.activeElement }); },
      cut() { effects.push({ kind: 'cut', target: document.activeElement }); } } };
  return { Element, document, window, calls, effects, frames, context, nativeWindow,
    get prevented() { return prevented; },
    focus(element) { document.activeElement = element; documentHandlers.focusin(); },
    focusout() { documentHandlers.focusout(); },
    blur() { focused = false; windowHandlers.blur(); },
    refocus() { focused = true; windowHandlers.focus(); },
    flush() { for (const callback of frames.splice(0)) callback(); },
    invoke(kind, overrides = {}, win = nativeWindow) {
      const input = { type: 'keyDown', key: kind === 'paste' ? 'v' : 'x',
        meta: platform === 'darwin', control: platform !== 'darwin',
        alt: false, shift: false, isAutoRepeat: false, ...overrides };
      return context[kind === 'paste' ? 'handlePrimaryPasteShortcut' : 'handlePrimaryCutShortcut'](event, input, win);
    } };
}

test('current writable native text inputs and textarea route actual Main Paste and Cut once without touching selection', () => {
  for (const [tagName, type] of [['TEXTAREA', 'textarea'], ...['text', 'search', 'email', 'url', 'tel', 'password'].map(type => ['INPUT', type])]) {
    const h = clipboardFocusHarness(), target = new h.Element(tagName, { type });
    const before = [target.value, target.selectionStart, target.selectionEnd];
    h.focus(target);
    assert.equal(h.calls.at(-1), true, tagName + ':' + type);
    assert.equal(h.invoke('paste'), true); assert.equal(h.invoke('cut'), true);
    assert.deepEqual(h.effects.map(effect => effect.kind), ['paste', 'cut']);
    assert.ok(h.effects.every(effect => effect.target === target));
    assert.equal(h.prevented, 1, 'only existing Cut prevents native default');
    assert.deepEqual([target.value, target.selectionStart, target.selectionEnd], before);
  }
});

test('non-text native controls cannot borrow an enclosing ProseMirror paste target', () => {
  for (const type of ['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'hidden', 'number', 'range', 'color', 'date', 'datetime-local', 'month', 'time', 'week']) {
    const h = clipboardFocusHarness(), pm = new h.Element('DIV', { proseMirror: true, editable: true });
    const target = pm.append(new h.Element('INPUT', { type }));
    h.focus(target); assert.equal(h.calls.at(-1), false, type);
    h.invoke('paste'); h.invoke('cut'); assert.deepEqual(h.effects, [], type);
  }
});

test('readonly disabled and inherited-disabled native fields refuse clipboard while first legend remains writable', () => {
  for (const tagName of ['INPUT', 'TEXTAREA']) {
    for (const properties of [{ disabled: true }, { readOnly: true }, { connected: false }]) {
      const h = clipboardFocusHarness(); h.focus(new h.Element(tagName, properties));
      assert.equal(h.calls.at(-1), false); h.invoke('paste'); h.invoke('cut');
      assert.deepEqual(h.effects, []);
    }
    const h = clipboardFocusHarness(), fieldset = new h.Element('FIELDSET', { disabled: true });
    const legend = fieldset.append(new h.Element('LEGEND'));
    const allowed = legend.append(new h.Element(tagName));
    h.focus(allowed); assert.equal(h.calls.at(-1), true, 'browser first-legend exemption');
    const refused = fieldset.append(new h.Element(tagName));
    h.focus(refused); assert.equal(h.calls.at(-1), false, 'inherited disabled outside first legend');
    const secondLegend = fieldset.append(new h.Element('LEGEND'));
    h.focus(secondLegend.append(new h.Element(tagName))); assert.equal(h.calls.at(-1), false);
    const outer = new h.Element('FIELDSET', { disabled: true }); outer.append(fieldset);
    h.focus(allowed); assert.equal(h.calls.at(-1), false, 'inner legend does not escape disabled outer fieldset');
  }
});

test('ProseMirror roots and editable descendants remain eligible but disconnected or noneditable focus does not', () => {
  const h = clipboardFocusHarness(), pm = new h.Element('DIV', { proseMirror: true, editable: true });
  for (const target of [pm, pm.append(new h.Element('SPAN'))]) {
    h.focus(target); assert.equal(h.calls.at(-1), true); h.invoke('paste'); h.invoke('cut');
    assert.equal(h.effects.at(-1).target, target);
  }
  for (const target of [new h.Element('DIV', { editable: true }), new h.Element('BUTTON'), new h.Element('SELECT'),
    pm.append(new h.Element('BUTTON')), pm.append(new h.Element('SELECT')),
    pm.append(new h.Element('SPAN', { editable: false })), new h.Element('DIV', { proseMirror: true, editable: false }),
    new h.Element('DIV', { proseMirror: true, editable: true, connected: false }), null, {}]) {
    const count = h.effects.length;
    h.focus(target); assert.equal(h.calls.at(-1), false); h.invoke('paste'); h.invoke('cut');
    assert.equal(h.effects.length, count);
  }
});

test('deferred focusout cannot reassert routing after blur even when DOM activeElement remains editable', () => {
  const h = clipboardFocusHarness(), pm = new h.Element('DIV', { proseMirror: true, editable: true });
  h.focus(pm); assert.equal(h.calls.at(-1), true);
  h.focusout(); assert.equal(h.frames.length, 1); h.blur();
  assert.equal(h.calls.at(-1), false);
  const afterBlur = h.calls.length; h.flush();
  assert.equal(h.calls.length, afterBlur, 'old frame must not publish after window blur');
  h.invoke('paste'); h.invoke('cut'); assert.deepEqual(h.effects, []);
  h.refocus(); assert.equal(h.calls.at(-1), true); h.invoke('paste');
  assert.equal(h.effects.length, 1); assert.equal(h.effects[0].target, pm);
});

test('refocus and newer focus transitions invalidate each pending older focusout publication', () => {
  const h = clipboardFocusHarness(), pm = new h.Element('DIV', { proseMirror: true, editable: true });
  h.focus(pm); h.focusout(); h.blur(); h.refocus();
  const current = h.calls.length; h.flush(); assert.equal(h.calls.length, current);
  h.focusout(); h.focus(new h.Element('INPUT')); const newer = h.calls.length;
  assert.equal(h.calls.at(-1), true); h.flush(); assert.equal(h.calls.length, newer);
  h.focusout(); h.document.activeElement = new h.Element('BODY'); h.flush();
  assert.equal(h.calls.at(-1), false, 'current frame re-reads the actual target');
  h.invoke('paste'); h.invoke('cut'); assert.deepEqual(h.effects, []);
});

test('current deferred publication rechecks live connection writability and document focus', () => {
  for (const change of [target => { target.connected = false; }, target => { target.readOnly = true; }, target => { target.disabled = true; }]) {
    const h = clipboardFocusHarness(), target = new h.Element('TEXTAREA');
    h.focus(target); assert.equal(h.calls.at(-1), true); h.focusout(); change(target); h.flush();
    assert.equal(h.calls.at(-1), false); h.invoke('paste'); h.invoke('cut'); assert.deepEqual(h.effects, []);
  }
  const h = clipboardFocusHarness(), pm = new h.Element('DIV', { proseMirror: true, editable: true });
  h.focus(pm); h.document.hasFocus = () => false; h.focusout(); h.flush();
  assert.equal(h.calls.at(-1), false, 'DOM activeElement does not prove focused document');
  h.invoke('paste'); h.invoke('cut'); assert.deepEqual(h.effects, []);
});

test('actual Main clipboard modifiers liveness and focused-window guards remain enforced for native inputs', () => {
  for (const platform of ['darwin', 'linux']) {
    const h = clipboardFocusHarness(platform); h.focus(new h.Element('INPUT'));
    assert.equal(h.calls.at(-1), true);
    for (const kind of ['paste', 'cut']) {
      const modifiers = [{ type: 'keyUp' }, { key: 'a' }, { alt: true }, { shift: true }, { isAutoRepeat: true },
        platform === 'darwin' ? { meta: false } : { control: false },
        platform === 'darwin' ? { control: true } : { meta: true }];
      for (const input of modifiers) h.invoke(kind, input);
      for (const win of [null, { ...h.nativeWindow, isDestroyed: () => true },
        { ...h.nativeWindow, isFocused: () => false }, { ...h.nativeWindow, webContents: null },
        { ...h.nativeWindow, webContents: { isDestroyed: () => true } }]) h.invoke(kind, {}, win);
    }
    assert.deepEqual(h.effects, []); assert.equal(h.prevented, 0);
    h.invoke('paste'); h.invoke('cut');
    assert.deepEqual(h.effects.map(effect => effect.kind), platform === 'darwin' ? ['paste', 'cut'] : ['paste']);
    h.focus(new h.Element('BODY')); const count = h.effects.length;
    h.invoke('paste'); h.invoke('cut'); assert.equal(h.effects.length, count);
  }
});

test('actual preload remains boolean-only and rejects truthy non-booleans without clipboard effects', () => {
  const h = clipboardFocusHarness();
  for (const value of ['true', 1, {}, [], null, undefined, false]) {
    h.context.preloadNotify(value); assert.equal(h.calls.at(-1), false);
    h.invoke('paste'); h.invoke('cut');
  }
  assert.deepEqual(h.effects, []);
  for (const payload of [null, [], {}, { focused: 1 }, { focused: 'true' }]) {
    assert.equal(h.context.normalizeEditorPasteFocusState(payload), null);
  }
});


test('actual Pulse correction field uses the guarded native clipboard route and rejects invalid or disabled edits [FINITE_DOM_NOT_NATIVE]', () => {
  const h = clipboardFocusHarness();
  class Control extends h.Element {
    constructor(tag) { super(tag.toUpperCase()); this.dataset = {}; this.listeners = {}; this.textContent = ''; }
    appendChild(child) { return this.append(child); }
    setAttribute(name, value) { this[name] = value; }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    focus() { h.focus(this); }
    remove() {
      if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(node => node !== this);
      this.parentElement = null; this.connected = false;
    }
    querySelector(selector) {
      assert.equal(selector, '[data-pulse-correction-value]');
      return walk(this).find(node => Object.hasOwn(node.dataset || {}, 'pulseCorrectionValue')) || null;
    }
  }
  const walk = node => [node, ...node.children.flatMap(walk)];
  const parent = new Control('section'), item = parent.append(new Control('div')), edit = item.append(new Control('button'));
  let productDispatches = 0;
  const document = { createElement: tag => new Control(tag), body: h.document.body,
    get activeElement() { return h.document.activeElement; } };
  const context = vm.createContext({ document, pulseHistoryPending: null,
    captureAtlasPublication: () => () => true,
    runPulseCorrectionCommand: () => { productDispatches++; } });
  vm.runInContext(extractFunctionSource(read('src/renderer/editor.js'), 'openPulseCorrectionEditor'), context);
  context.openPulseCorrectionEditor(item, { targetLedgerSequence: 1, metricId: 'SCENES_EDITED_COUNT',
    fieldLabel: 'Scenes edited', originalValue: 1, effectiveValue: 1, correctionSequence: null },
  { correctionIdentity: { ledgerSequence: 1 } }, parent, {}, edit);
  const input = parent.querySelector('[data-pulse-correction-value]');
  assert.ok(input); assert.equal(h.document.activeElement, input);
  assert.equal(h.calls.at(-1), true, 'the actual focused Pulse value field must receive the existing guarded native Paste route');
  h.invoke('paste'); assert.equal(h.effects.length, 1); assert.equal(h.effects[0].target, input);
  for (const property of ['readOnly', 'disabled']) {
    input[property] = true; h.focus(input); h.invoke('paste');
    assert.equal(h.calls.at(-1), false); assert.equal(h.effects.length, 1); input[property] = false;
  }
  h.focus(input);
  const button = action => walk(parent).find(node => node.dataset?.pulseHistoryAction === action + '-1-SCENES_EDITED_COUNT');
  for (const value of ['', '-1', '0.5', '1e2', '00', ' 0', '1000000001']) {
    input.value = value; button('preview').listeners.click();
    assert.equal(input['aria-invalid'], 'true', value); assert.equal(button('confirm'), undefined);
    assert.equal(productDispatches, 0);
  }
  input.value = '0'; button('preview').listeners.click();
  assert.ok(button('confirm')); assert.equal(input.disabled, true); assert.equal(productDispatches, 0);
  assert.match(walk(parent).map(node => node.textContent).join(' '), /Измерено: 1.*Поправка автора: 0/u);
  h.focus(input); h.invoke('paste'); assert.equal(h.calls.at(-1), false); assert.equal(h.effects.length, 1);
  button('cancel').listeners.click(); assert.equal(h.document.activeElement, edit); assert.equal(productDispatches, 0);
  const blockedNumber = new h.Element('INPUT', { type: 'number' }); h.focus(blockedNumber); h.invoke('paste');
  assert.equal(h.calls.at(-1), false); assert.equal(h.effects.length, 1, 'the pre-existing numeric-control clipboard prohibition stays enforced');
});
