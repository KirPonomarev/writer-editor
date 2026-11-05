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
  constructor(options) { this.options = options; this.value = '__custom_line_height__'; }
  get value() { return this.options[this.selectedIndex]?.value || ''; }
  set value(value) { this.selectedIndex = this.options.findIndex(row => row.value === String(value)); }
  add(option, before) {
    const selected = this.options[this.selectedIndex];
    this.options.splice(before ? this.options.indexOf(before) : this.options.length, 0, option);
    this.selectedIndex = this.options.indexOf(selected);
  }
}
function host() {
  const markup = html.match(/<select\b[^>]*data-line-height-select[^>]*>([\s\S]*?)<\/select>/u);
  assert.ok(markup);
  const options = [...markup[1].matchAll(/<option value="([^"]+)">([^<]*)<\/option>/gu)]
    .map(match => new Option(match[2], match[1]));
  const writes = [], calls = [], statuses = [], manuscript = Object.freeze({ text: 'Keep 🧭 Café Café Ёлка Ёлка', revision: 3 });
  let resolve, reject, signals = 0;
  const h = vm.createContext({
    currentProjectId: 'project-owned', currentDocumentId: 'scene-owned', atlasPublicationEpoch: 7,
    localEditGeneration: 3, fullEnvironmentFormGeneration: 9,
    editor: { style: { lineHeight: '1.75' }, isConnected: true },
    lineHeightSelect: new Select(options), lineHeightDisplay: { textContent: '1.75' },
    fontSelect: null, fontDisplay: null, weightSelect: null, weightDisplay: null,
    sizeSelect: null, sizeDisplay: null, currentFontSizePx: 16, HTMLSelectElement: Select, Option,
    // Explicit unrelated hosts: actual function execution, not native/capability acceptance.
    window: { __PRODUCT_PROFILE: 'WRITER_LOCAL_SCENE_LANGUAGE_TAG_V12',
      prompt: () => { throw Error('prompt() is not supported.'); } },
    openLinkDialog: options => { calls.push(options); return new Promise((yes, no) => { resolve = yes; reject = no; }); },
    localStorage: { setItem: (key, value) => writes.push([key, value]) },
    noteFullEnvironmentFormChanged: () => { signals++; }, getPlainText: () => manuscript.text,
    renderStyledView: () => {}, scheduleCentralSheetStripProofRefresh: () => {},
    updateStatusText: (...args) => statuses.push(args),
  });
  new vm.Script(['ensureSelectHasOption', 'syncLiteralToolbarDisplays', 'applyLineHeight', 'promptForCustomLineHeight']
    .map(body).join('\n')).runInContext(h);
  const start = () => {
    let pending;
    try { pending = Promise.resolve(h.promptForCustomLineHeight()); } catch (error) { pending = Promise.reject(error); }
    pending.catch(() => {}); // Preserve the original rejection for the assertion below.
    return pending;
  };
  const unchanged = () => {
    assert.equal(h.editor.style.lineHeight, '1.75');
    assert.equal(h.lineHeightSelect.value, '1.75');
    assert.equal(h.lineHeightDisplay.textContent, '1.75');
    assert.deepEqual(writes, []); assert.equal(signals, 0);
    assert.equal(manuscript.text, 'Keep 🧭 Café Café Ёлка Ёлка'); assert.equal(manuscript.revision, 3);
  };
  return { h, writes, calls, statuses, start, unchanged, accept: value => resolve(value), fail: error => reject(error), signals: () => signals };
}
test('existing ordinary line-height apply remains the only shell preference write', () => {
  const x = host(); x.h.applyLineHeight('1.75');
  assert.deepEqual(x.writes, [['editorLineHeight', '1.75']]); assert.equal(x.signals(), 1);
});
for (const [input, expected] of [['1.37', '1.37'], ['1.3704', '1.37'], ['0.5', '0.5'], ['4', '4']]) {
  test(`custom line-height ${input} uses the existing modal and apply path`, async () => {
    const x = host(), pending = x.start();
    assert.equal(x.calls.length, 1, 'Electron unsupported prompt must not be used'); x.unchanged();
    assert.equal(x.calls[0].initialValue, '1.75'); assert.equal(x.calls[0].inputMode, 'decimal');
    assert.equal(x.calls[0].normalize(input).ok, true);
    x.accept(input); await pending;
    assert.equal(x.h.editor.style.lineHeight, expected); assert.equal(x.h.lineHeightSelect.value, expected);
    assert.equal(x.h.lineHeightDisplay.textContent, expected);
    assert.deepEqual(x.writes, [['editorLineHeight', expected]]); assert.equal(x.signals(), 1);
  });
}
test('cancel leaves the applied value represented with no write', async () => {
  const x = host(), pending = x.start(); assert.equal(x.calls.length, 1); x.unchanged();
  x.accept(null); await pending; x.unchanged();
});
for (const invalid of ['', 'no', 'Infinity', '0', '0.49', '4.01', {}, 1.37]) {
  test(`invalid custom response ${JSON.stringify(invalid)} cannot persist`, async () => {
    const x = host(), pending = x.start(); assert.equal(x.calls.length, 1);
    assert.equal(x.calls[0].normalize(invalid).ok, false);
    x.accept(invalid); await pending; x.unchanged(); assert.equal(x.statuses.length, 1);
  });
}
for (const [name, mutate] of [
  ['project', h => { h.currentProjectId = 'different'; }], ['document', h => { h.currentDocumentId = 'different'; }],
  ['publication lifecycle', h => { h.atlasPublicationEpoch++; }], ['authoring revision', h => { h.localEditGeneration++; }],
  ['form generation', h => { h.fullEnvironmentFormGeneration++; }], ['profile', h => { h.window.__PRODUCT_PROFILE = 'different'; }],
  ['disconnected surface', h => { h.editor.isConnected = false; }],
]) {
  test(`stale ${name} refuses a delayed valid custom reply`, async () => {
    const x = host(), pending = x.start(); assert.equal(x.calls.length, 1);
    mutate(x.h); x.accept('1.37'); await pending; x.unchanged();
  });
}
test('a newer form survives the delayed old custom response', async () => {
  const x = host(), pending = x.start(); assert.equal(x.calls.length, 1);
  x.h.applyLineHeight('2.0'); x.h.fullEnvironmentFormGeneration++;
  x.accept('1.37'); await pending;
  assert.equal(x.h.lineHeightSelect.value, '2.0'); assert.equal(x.h.lineHeightDisplay.textContent, '2.0');
  assert.deepEqual(x.writes, [['editorLineHeight', '2.0']]); assert.equal(x.signals(), 1);
});
test('a failed dialog preserves the original error and truthful field', async () => {
  const x = host(), pending = x.start(); assert.equal(x.calls.length, 1);
  x.fail(Error('DIALOG_FAILED')); await assert.rejects(pending, /DIALOG_FAILED/); x.unchanged();
});
