const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

async function loadModule(relativePath) {
  const fileUrl = pathToFileURL(path.join(ROOT, relativePath)).href;
  return import(fileUrl);
}

function createMemoryStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

test('preview chrome: module normalizes chrome-only gap state without owning geometry', async () => {
  const previewChrome = await loadModule('src/renderer/previewChrome.mjs');

  const chromeState = previewChrome.createPreviewChromeState({
    pageGapMm: '5.5',
    canvasPaddingPx: '64',
  });
  const defaultState = previewChrome.createPreviewChromeState({
    pageGapMm: -1,
    canvasPaddingPx: -1,
  });

  assert.deepEqual(chromeState, {
    pageGapMm: 5.5,
    canvasPaddingPx: 64,
  });
  assert.deepEqual(defaultState, {
    pageGapMm: previewChrome.PREVIEW_CHROME_DEFAULT_PAGE_GAP_MM,
    canvasPaddingPx: previewChrome.PREVIEW_CHROME_CANVAS_PADDING_PX,
  });
  assert.deepEqual(Object.keys(chromeState), ['pageGapMm', 'canvasPaddingPx']);
  assert.equal(Object.prototype.hasOwnProperty.call(chromeState, 'formatId'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(chromeState, 'widthMm'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(chromeState, 'heightMm'), false);
});

test('preview chrome: css vars are applied from chrome state only', async () => {
  const previewChrome = await loadModule('src/renderer/previewChrome.mjs');

  const writes = [];
  const root = {
    style: {
      setProperty(name, value) {
        writes.push([name, value]);
      },
    },
  };

  previewChrome.applyPreviewChromeCssVars(
    { pageGapMm: 4, canvasPaddingPx: 12.4 },
    root,
    1.5,
    2,
  );

  assert.deepEqual(writes, [
    ['--page-gap-px', '12px'],
    ['--canvas-padding-px', '12px'],
  ]);
});

test('preview chrome: blank project switch stays ephemeral and does not write project state', async () => {
  const profileState = await loadModule('src/renderer/toolbar/toolbarProfileState.mjs');
  const storage = createMemoryStorage();

  const resolved = profileState.resolveToolbarProfileStateForProjectSwitch(storage, '');

  assert.equal(resolved.source, 'ephemeral');
  assert.equal(resolved.shouldPersist, false);
  assert.equal(resolved.shouldConsumeLegacySource, false);
  assert.deepEqual(resolved.state, profileState.createCanonicalMinimalToolbarProfileState());
  assert.equal(storage.getItem('toolbarProfiles:'), null);
});

test('preview chrome: editor text wiring routes preview format through active book profile state', () => {
  const source = readFile('src/renderer/editor.js');
  const projectCommands = readFile('src/renderer/commands/projectCommands.mjs');
  const capabilityPolicy = readFile('src/renderer/commands/capabilityPolicy.mjs');

  const previewCommandStart = source.indexOf('const PREVIEW_FORMAT_COMMAND_IDS = Object.freeze({');
  const previewCommandEnd = source.indexOf('const commandPaletteDataProvider = createPaletteDataProvider');
  assert.ok(previewCommandStart > -1 && previewCommandEnd > previewCommandStart, 'preview command block must exist');
  const previewCommandSnippet = source.slice(previewCommandStart, previewCommandEnd);

  assert.ok(previewCommandSnippet.includes('A4: EXTRA_COMMAND_IDS.VIEW_PREVIEW_FORMAT_A4'));
  assert.ok(previewCommandSnippet.includes('A5: EXTRA_COMMAND_IDS.VIEW_PREVIEW_FORMAT_A5'));
  assert.ok(previewCommandSnippet.includes('LETTER: EXTRA_COMMAND_IDS.VIEW_PREVIEW_FORMAT_LETTER'));
  assert.equal(previewCommandSnippet.includes('setPreviewChromeFormat(formatId);'), false);
  assert.ok(projectCommands.includes("VIEW_PREVIEW_FORMAT_A4: 'cmd.project.view.previewFormatA4'"));
  assert.ok(projectCommands.includes("VIEW_PREVIEW_FORMAT_A5: 'cmd.project.view.previewFormatA5'"));
  assert.ok(projectCommands.includes("VIEW_PREVIEW_FORMAT_LETTER: 'cmd.project.view.previewFormatLetter'"));
  assert.ok(projectCommands.includes("runUiAction(uiActions, 'setPreviewFormat', id, { formatId })"));
  assert.ok(capabilityPolicy.includes("'cmd.project.view.previewFormatA5': 'cap.project.view.previewFormatA5'"));
  assert.ok(capabilityPolicy.includes("'cmd.project.view.togglePreview': 'cap.project.view.togglePreview'"));
  assert.ok(source.includes('setPreviewFormat: ({ formatId } = {}) => setActiveBookProfileFormat(formatId),'));
  assert.ok(source.includes('setPreviewFormat: (formatId) => setActiveBookProfileFormat(formatId),'));

  const pageMetricsStart = source.indexOf('function getPageMetrics({');
  const pageMetricsEnd = source.indexOf('function applyPageGeometryCssVars(metrics)');
  assert.ok(pageMetricsStart > -1 && pageMetricsEnd > pageMetricsStart, 'getPageMetrics block must exist');
  const pageMetricsSnippet = source.slice(pageMetricsStart, pageMetricsEnd);

  assert.ok(pageMetricsSnippet.includes('profile = activeBookProfileState'));
  assert.ok(pageMetricsSnippet.includes('resolvePageLayoutMetrics('));

  const formatSwitchStart = source.indexOf('function setActiveBookProfileFormat(formatId) {');
  const formatSwitchEnd = source.indexOf('const initialPageMetrics = getPageMetrics({');
  assert.ok(formatSwitchStart > -1 && formatSwitchEnd > formatSwitchStart, 'setActiveBookProfileFormat block must exist');
  const formatSwitchSnippet = source.slice(formatSwitchStart, formatSwitchEnd);

  assert.ok(formatSwitchSnippet.includes('profile: activeBookProfileState,'));
  assert.ok(formatSwitchSnippet.includes('applyPageGeometryCssVars(metrics);'));
  assert.ok(formatSwitchSnippet.includes('syncPreviewChromeFormatValue();'));
  assert.ok(source.includes('applyPreviewChromeCssVars(activePreviewChromeState, document.documentElement, ZOOM_DEFAULT, PX_PER_MM_AT_ZOOM_1);'));
  assert.ok(source.includes('applyPreviewChromeCssVars(activePreviewChromeState, document.documentElement, editorZoom, PX_PER_MM_AT_ZOOM_1);'));
});
