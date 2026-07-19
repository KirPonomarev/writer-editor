const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');

async function importModule(relativePath) {
  return import(pathToFileURL(path.join(ROOT, relativePath)).href);
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('S34 settings aggregator: every setting declares owner, scope, and persistence without a second store', async () => {
  const settings = await importModule('src/renderer/settings/settingsAggregator.mjs');
  const aggregation = settings.buildSettingsAggregation({
    theme: 'dark',
    fontFamily: 'Roboto Ms',
    fontWeight: 'Light',
    fontSizePx: 28,
    lineHeight: '1.0',
    wordWrap: true,
    viewMode: 'focus',
    editorZoom: 0.7,
    projectId: 'project-001',
    bookFormat: 'A4',
    bookOrientation: 'portrait',
    menuLocale: 'ru',
  });

  assert.equal(aggregation.schemaVersion, 'settings-aggregation.v1');
  assert.equal(aggregation.createsStore, false);
  assert.ok(aggregation.settings.length >= 20);

  const seen = new Set();
  aggregation.settings.forEach((entry) => {
    assert.equal(typeof entry.id, 'string');
    assert.equal(seen.has(entry.id), false, entry.id);
    seen.add(entry.id);
    assert.ok(entry.owner, entry.id);
    assert.ok(entry.scope, entry.id);
    assert.ok(entry.persistenceClass, entry.id);
    assert.ok(['live', 'read_only', 'unavailable'].includes(entry.status), entry.id);
  });

  assert.ok(aggregation.settings.some((entry) => entry.scope === 'project'));
  assert.ok(aggregation.settings.some((entry) => entry.scope === 'application'));
  assert.equal(
    aggregation.settings.find((entry) => entry.id === 'layout.bookProfile')?.persistenceClass,
    'project-manifest:bookProfile',
  );
  assert.equal(
    aggregation.settings.find((entry) => entry.id === 'appearance.theme')?.persistenceClass,
    'localStorage:editorTheme',
  );
});

test('S34 settings aggregator: unavailable spelling and accessibility claims are truthful', async () => {
  const settings = await importModule('src/renderer/settings/settingsAggregator.mjs');
  const aggregation = settings.buildSettingsAggregation({});
  const spelling = aggregation.settings.find((entry) => entry.id === 'language.spelling');
  const accessibility = aggregation.settings.find((entry) => entry.id === 'accessibility.customOverrides');
  const reducedMotion = aggregation.settings.find((entry) => entry.id === 'accessibility.reducedMotion');

  assert.equal(spelling.status, 'unavailable');
  assert.equal(spelling.persistenceClass, 'unsupported');
  assert.equal(spelling.commandId, '');
  assert.match(spelling.note, /No local spell engine/);

  assert.equal(accessibility.status, 'unavailable');
  assert.match(accessibility.note, /no user override surface/i);

  assert.equal(reducedMotion.status, 'read_only');
  assert.equal(reducedMotion.value, 'Follows system');
  assert.equal(reducedMotion.persistenceClass, 'prefers-reduced-motion');
});

test('S34 settings surface: modal renders the aggregation read model and keeps live controls owner-owned', () => {
  const html = read('src/renderer/index.html');
  const source = read('src/renderer/editor.js');

  assert.ok(html.includes('data-settings-summary'));
  assert.ok(html.includes('data-settings-sections'));
  assert.ok(html.includes('data-settings-theme'));
  assert.ok(html.includes('data-settings-wrap'));

  assert.ok(source.includes("from './settings/settingsAggregator.mjs'"));
  assert.ok(source.includes('function buildSettingsAggregationSnapshot()'));
  assert.ok(source.includes('function renderSettingsAggregation()'));
  assert.ok(source.includes('row.dataset.settingsOwner = setting.owner;'));
  assert.ok(source.includes('row.dataset.settingsPersistence = setting.persistenceClass;'));
  assert.ok(source.includes('void dispatchUiCommand(UI_COMMAND_IDS.THEME_SET'));
  assert.ok(source.includes('applyWordWrap(enabled);'));

  const renderStart = source.indexOf('function renderSettingsAggregation()');
  const openStart = source.indexOf('function openSettingsModal()', renderStart);
  const renderSnippet = source.slice(renderStart, openStart);
  assert.equal(renderSnippet.includes('innerHTML'), false);
});

test('S34 settings safe reset: shell reset does not mutate text truth', () => {
  const source = read('src/renderer/editor.js');
  const resetStart = source.indexOf('function performSafeResetShell()');
  const restoreStart = source.indexOf('function performRestoreLastStableShell()', resetStart);
  assert.ok(resetStart > -1 && restoreStart > resetStart);
  const resetSnippet = source.slice(resetStart, restoreStart);

  assert.ok(resetSnippet.includes('clearProjectWorkspaceStorage(currentProjectId);'));
  assert.ok(resetSnippet.includes('applySpatialLayoutState(getSpatialLayoutBaselineForViewport()'));
  assert.ok(resetSnippet.includes("updateStatusText('Shell reset to baseline')"));
  assert.equal(resetSnippet.includes('setTiptapPlainText'), false);
  assert.equal(resetSnippet.includes('setTiptapDocumentSnapshot'), false);
  assert.equal(resetSnippet.includes('editor.textContent'), false);
  assert.equal(resetSnippet.includes('editor.innerHTML'), false);
  assert.equal(resetSnippet.includes('markAsModified('), false);
  assert.equal(resetSnippet.includes('saveCurrentDocument'), false);
});
