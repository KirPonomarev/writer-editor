'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const ROOT = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(ROOT, 'src/renderer/editor.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'src/renderer/index.html'), 'utf8');
const settingsModule = import(pathToFileURL(path.join(ROOT, 'src/renderer/settings/settingsAggregator.mjs')).href);

// The select models browser value/selectedIndex semantics. Production code owns
// option insertion, startup order, applied line height, display and Settings.
class Select {
  constructor(options) { this.options = options; this.selectedIndex = 0; }
  get value() { return this.options[this.selectedIndex]?.value || ''; }
  set value(value) { this.selectedIndex = this.options.findIndex(option => option.value === String(value)); }
  add(option, before) {
    const selected = this.options[this.selectedIndex];
    const index = before ? this.options.indexOf(before) : this.options.length;
    this.options.splice(index, 0, option);
    this.selectedIndex = this.options.indexOf(selected);
  }
}
class Option {
  constructor(label, value) { this.textContent = String(label); this.value = String(value); }
}
function functionBody(name) {
  const start = source.indexOf(`function ${name}(`), end = source.indexOf('\n}', start);
  assert.ok(start >= 0 && end > start, name);
  return source.slice(start, end + 2);
}
function startupHost(saved, literal, buildSettingsAggregation) {
  const selectMarkup = html.match(/<select\b[^>]*data-line-height-select[^>]*>([\s\S]*?)<\/select>/u);
  assert.ok(selectMarkup, 'use the actual existing line-height options');
  const options = [...selectMarkup[1].matchAll(/<option value="([^"]+)">([^<]*)<\/option>/gu)]
    .map(match => new Option(match[2], match[1]));
  const preferences = new Map(saved === null ? [] : [['editorLineHeight', saved]]), writes = [];
  const manuscript = Object.freeze({ id: 'scene-owned', text: 'Keep 🧭 Café Café Ёлка Ёлка', revision: 9 });
  const host = {
    editor: { style: { lineHeight: '0.9', fontFamily: 'monospace' } },
    lineHeightSelect: new Select(options), lineHeightDisplay: { textContent: 'uninitialized' },
    fontSelect: null, fontDisplay: null, weightSelect: null, weightDisplay: null,
    sizeSelect: null, sizeDisplay: null, currentFontSizePx: 16,
    document: { body: { classList: { contains: name => literal && name === 'literal-stage-a' } } },
    HTMLSelectElement: Select, Option,
    localStorage: { getItem: key => preferences.get(key) ?? null,
      setItem: (key, value) => { writes.push([key, value]); preferences.set(key, value); } },
    noteFullEnvironmentFormChanged: () => {}, getPlainText: () => manuscript.text,
    renderStyledView: () => {}, scheduleCentralSheetStripProofRefresh: () => {},
    // Unrelated startup seams are explicit fixtures, not native qualification.
    loadSavedViewMode: () => {}, loadSavedFontWeight: () => {},
    loadSavedWordWrap: () => {}, loadSavedEditorZoom: () => {},
    buildSettingsAggregation, getActiveBookProfile: () => ({ formatId: 'A4', orientation: 'portrait' }),
    activeBookProfileState: {}, wordWrapEnabled: true, editorZoom: 1, currentProjectId: 'project-owned',
    getToolbarConfiguratorActiveProfile: () => 'minimal',
  };
  const weightsStart = source.indexOf('const FONT_WEIGHT_PRESETS = Object.freeze({');
  const weightsEnd = source.indexOf('\nlet editorZoom =', weightsStart);
  assert.ok(weightsStart >= 0 && weightsEnd > weightsStart);
  const names = ['normalizeFontWeightPreset', 'ensureSelectHasOption', 'applyFontWeight',
    'applyLineHeight', 'setCurrentFontSize', 'syncLiteralToolbarDisplays', 'loadSavedLineHeight',
    'applyLiteralToolbarMasterVisualDefaults', 'buildSettingsAggregationSnapshot'];
  const context = vm.createContext(host);
  new vm.Script(source.slice(weightsStart, weightsEnd) + '\n' + names.map(functionBody).join('\n')).runInContext(context);
  const start = source.indexOf('\nloadSavedViewMode();\nloadSavedFontWeight();');
  const end = source.indexOf("\nsetPlainText('');", start);
  assert.ok(start >= 0 && end > start, 'execute the actual initialization sequence');
  const boot = () => new vm.Script(source.slice(start, end)).runInContext(context);
  return { host: context, preferences, writes, manuscript, boot };
}
function observedForm(host) {
  const row = host.buildSettingsAggregationSnapshot().settings.find(item => item.id === 'appearance.lineHeight');
  assert.ok(row); assert.equal(row.status, 'live');
  return { applied: host.editor.style.lineHeight, selected: host.lineHeightSelect.value,
    displayed: host.lineHeightDisplay.textContent, settings: row.value };
}
function expectedForm(value) {
  return { applied: value, selected: value, displayed: value, settings: value };
}

for (const scenario of [
  { name: 'fresh literal startup retains its applied default', saved: null, literal: true, expected: '1.625' },
  { name: 'literal startup reflects a saved nondefault value', saved: '1.25', literal: true, expected: '1.25' },
  { name: 'literal startup reflects a saved custom value', saved: '1.37', literal: true, expected: '1.37' },
  { name: 'saved literal 1.0 remains a coherent control', saved: '1.0', literal: true, expected: '1.0' },
  { name: 'nonliteral startup preserves the existing loader result', saved: '1.25', literal: false, expected: '1.25' },
]) {
  test(`Writer line-height ${scenario.name}`, async () => {
    const { buildSettingsAggregation } = await settingsModule;
    const h = startupHost(scenario.saved, scenario.literal, buildSettingsAggregation);
    const before = JSON.stringify(h.manuscript);
    h.boot();
    assert.equal(h.host.editor.style.lineHeight, scenario.expected, 'preserve the actual applied typography');
    assert.equal(h.preferences.get('editorLineHeight') ?? null, scenario.saved, 'startup must not rewrite the preference');
    assert.deepEqual(h.writes, [], 'representing the value must not persist another value');
    assert.equal(JSON.stringify(h.manuscript), before);
    assert.deepEqual(observedForm(h.host), expectedForm(scenario.expected), 'every current field must reflect applied form');
    const matching = h.host.lineHeightSelect.options.filter(option => option.value === scenario.expected);
    assert.equal(matching.length, 1, 'custom value must remain exactly selectable');
  });
}

test('Writer line-height ordinary user choice survives a fresh startup without another preference write', async () => {
  const { buildSettingsAggregation } = await settingsModule;
  const author = startupHost(null, true, buildSettingsAggregation);
  author.boot();
  author.host.applyLineHeight('1.75');
  assert.deepEqual(observedForm(author.host), expectedForm('1.75'));
  assert.deepEqual(author.writes, [['editorLineHeight', '1.75']]);
  const reopened = startupHost(author.preferences.get('editorLineHeight'), true, buildSettingsAggregation);
  reopened.boot();
  assert.equal(reopened.host.editor.style.lineHeight, '1.75', 'cold startup must retain chosen typography');
  assert.deepEqual(reopened.writes, []);
  assert.deepEqual(observedForm(reopened.host), expectedForm('1.75'));
  assert.deepEqual(reopened.manuscript, author.manuscript);
});
