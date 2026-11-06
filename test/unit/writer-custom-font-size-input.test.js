'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'src/renderer/editor.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8');
function body(name) {
  const match = new RegExp(`\\n(?:async )?function ${name}\\(`).exec(source);
  assert.ok(match, name);
  const end = source.indexOf('\n}', match.index);
  assert.ok(end > match.index);
  return source.slice(match.index, end + 2);
}
class Option { constructor(label, value) { this.textContent = label; this.value = value; } }
class Select {
  constructor(options) { this.options = options; this.listeners = new Map(); this.value = '__custom_size__'; }
  get value() { return this.options[this.selectedIndex]?.value || ''; }
  set value(value) { this.selectedIndex = this.options.findIndex(row => row.value === String(value)); }
  add(option, before) {
    const selected = this.options[this.selectedIndex];
    this.options.splice(before ? this.options.indexOf(before) : this.options.length, 0, option);
    this.selectedIndex = this.options.indexOf(selected);
  }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
}
function host(outcome = { ok: true }) {
  const markup = html.match(/<select\b[^>]*data-size-select[^>]*>([\s\S]*?)<\/select>/u);
  assert.ok(markup);
  const options = [...markup[1].matchAll(/<option value="([^"]+)">([^<]*)<\/option>/gu)]
    .map(match => new Option(match[2], match[1]));
  const writes = [], calls = [], commands = [], statuses = [], errors = [];
  const manuscript = Object.freeze({ text: 'Keep 🧭 Café Café Ёлка Ёлка', revision: 3 });
  let resolve, reject;
  const h = vm.createContext({
    currentProjectId: 'project-owned', currentDocumentId: 'scene-owned', atlasPublicationEpoch: 7,
    localEditGeneration: 3, fullEnvironmentFormGeneration: 9, currentFontSizePx: 16,
    editor: { style: { fontSize: '16px' }, isConnected: true },
    sizeSelect: new Select(options), sizeDisplay: { textContent: '16' },
    fontSelect: null, fontDisplay: null, weightSelect: null, weightDisplay: null,
    lineHeightSelect: null, lineHeightDisplay: null, HTMLSelectElement: Select, Option,
    // Explicit source-function hosts; no native or Kernel-capability acceptance.
    window: { __PRODUCT_PROFILE: 'WRITER_LOCAL_SCENE_LANGUAGE_TAG_V12',
      prompt: () => { throw Error('prompt() is not supported.'); } },
    openLinkDialog: options => { calls.push(options); return new Promise((yes, no) => { resolve = yes; reject = no; }); },
    UI_COMMAND_IDS: { FONT_SIZE_SET: 'cmd.ui.fontSize.set' },
    dispatchUiCommand: async (id, payload, options) => { commands.push({ id, payload, options }); return outcome; },
    localStorage: { setItem: (key, value) => writes.push([key, value]) },
    updateStatusText: (...args) => statuses.push(args), console: { error: (...args) => errors.push(args) },
  });
  new vm.Script(['ensureSelectHasOption', 'syncLiteralToolbarDisplays', 'setCurrentFontSize', 'promptForCustomFontSize']
    .map(body).join('\n')).runInContext(h);
  const start = () => {
    let pending;
    try { pending = Promise.resolve(h.promptForCustomFontSize()); } catch (error) { pending = Promise.reject(error); }
    pending.catch(() => {}); // Preserve the original rejection for the assertion.
    return pending;
  };
  const unchanged = () => {
    assert.equal(h.editor.style.fontSize, '16px'); assert.equal(h.currentFontSizePx, 16);
    assert.equal(h.sizeSelect.value, '16'); assert.equal(h.sizeDisplay.textContent, '16');
    assert.deepEqual(writes, []); assert.equal(manuscript.text, 'Keep 🧭 Café Café Ёлка Ёлка');
    assert.equal(manuscript.revision, 3);
  };
  const bindActualSizeControl = () => {
    const start = source.indexOf("\nif (sizeSelect) {\n  sizeSelect.addEventListener('change'");
    const end = source.indexOf('\n}\n\nif (lineHeightSelect)', start) + 2;
    assert.ok(start >= 0 && end > start);
    new vm.Script(source.slice(start, end)).runInContext(h);
    return value => { h.sizeSelect.value = value; return h.sizeSelect.listeners.get('change')({ target: h.sizeSelect }); };
  };
  return { h, writes, calls, commands, statuses, errors, start, unchanged, bindActualSizeControl,
    accept: value => resolve(value), fail: error => reject(error) };
}
test('ordinary font-size selection still sends the existing canonical command', () => {
  const x = host(); x.bindActualSizeControl()('18');
  assert.equal(x.calls.length, 0); assert.equal(x.commands.length, 1);
  assert.equal(x.commands[0].id, 'cmd.ui.fontSize.set'); assert.equal(x.commands[0].payload.px, 18);
  assert.deepEqual(x.writes, []);
});
for (const [input, expected] of [['19.6', 20], ['19.49', 19], ['0.5', 1], ['72', 72], [' 20 ', 20]]) {
  test(`custom font size ${JSON.stringify(input)} sends only rounded canonical intent`, async () => {
    const x = host(), pending = x.start();
    assert.equal(x.calls.length, 1, 'Electron unsupported prompt must not be used'); x.unchanged();
    assert.equal(x.calls[0].initialValue, '16'); assert.equal(x.calls[0].inputMode, 'decimal');
    assert.equal(x.calls[0].normalize(input).ok, true); assert.equal(x.commands.length, 0);
    x.accept(input); await pending;
    assert.equal(x.commands.length, 1); assert.equal(x.commands[0].id, 'cmd.ui.fontSize.set');
    assert.equal(x.commands[0].payload.px, expected); x.unchanged();
    assert.equal(typeof x.commands[0].options.isCurrentPresentation, 'function');
    assert.equal(x.commands[0].options.isCurrentPresentation(), true);
  });
}
test('font-size Cancel keeps the applied field and sends no command', async () => {
  const x = host(), pending = x.start(); assert.equal(x.calls.length, 1); x.unchanged();
  x.accept(null); await pending; x.unchanged(); assert.equal(x.commands.length, 0);
});
for (const invalid of ['', ' ', 'no', 'Infinity', '0', '-1', '0.49', {}, 19.6, false]) {
  test(`invalid font-size response ${JSON.stringify(invalid)} cannot dispatch or persist`, async () => {
    const x = host(), pending = x.start(); assert.equal(x.calls.length, 1);
    assert.equal(x.calls[0].normalize(invalid).ok, false);
    x.accept(invalid); await pending; x.unchanged(); assert.equal(x.commands.length, 0);
  });
}
for (const [name, mutate] of [
  ['project', h => { h.currentProjectId = 'different'; }], ['document', h => { h.currentDocumentId = 'different'; }],
  ['publication lifecycle', h => { h.atlasPublicationEpoch++; }], ['authoring revision', h => { h.localEditGeneration++; }],
  ['form generation', h => { h.fullEnvironmentFormGeneration++; }], ['profile', h => { h.window.__PRODUCT_PROFILE = 'different'; }],
  ['disconnected editor', h => { h.editor.isConnected = false; }],
  ['replaced editor', h => { h.editor = { style: { fontSize: '16px' }, isConnected: true }; }],
]) {
  test(`stale font-size ${name} refuses the delayed command`, async () => {
    const x = host(), pending = x.start(); assert.equal(x.calls.length, 1);
    mutate(x.h); x.accept('19.6'); await pending; x.unchanged(); assert.equal(x.commands.length, 0);
  });
}
test('a newer applied font size survives the old pending modal', async () => {
  const x = host(), pending = x.start(); assert.equal(x.calls.length, 1);
  x.h.editor.style.fontSize = '22px'; x.h.setCurrentFontSize(22); x.h.fullEnvironmentFormGeneration++;
  x.accept('19.6'); await pending;
  assert.equal(x.h.sizeSelect.value, '22'); assert.equal(x.h.sizeDisplay.textContent, '22');
  assert.equal(x.h.editor.style.fontSize, '22px'); assert.equal(x.commands.length, 0); assert.deepEqual(x.writes, []);
});
test('failed font-size dialog preserves its original error and truthful field', async () => {
  const x = host(), pending = x.start(); assert.equal(x.calls.length, 1);
  x.fail(Error('DIALOG_FAILED')); await assert.rejects(pending, /DIALOG_FAILED/); x.unchanged();
  assert.equal(x.commands.length, 0); assert.equal(x.statuses.length, 1);
});
test('Kernel refusal has no optimistic size apply or preference fallback', async () => {
  const x = host({ ok: false, error: { code: 'CAPABILITY_DENIED' } }), pending = x.start();
  assert.equal(x.calls.length, 1); x.accept('19.6'); const result = await pending;
  assert.equal(result.ok, false); assert.equal(result.error.code, 'CAPABILITY_DENIED');
  assert.equal(x.commands.length, 1); x.unchanged(); x.h.currentProjectId = 'different';
  assert.equal(x.commands[0].options.isCurrentPresentation(), false);
});
test('the actual Other size control opens the modal and dispatches its accepted value', async () => {
  const x = host(), change = x.bindActualSizeControl();
  assert.doesNotThrow(() => change('__custom_size__')); assert.equal(x.calls.length, 1); x.unchanged();
  x.accept('19.6'); await new Promise(setImmediate);
  assert.equal(x.commands.length, 1); assert.equal(x.commands[0].payload.px, 20);
  assert.deepEqual(x.errors, []); x.unchanged();
});
