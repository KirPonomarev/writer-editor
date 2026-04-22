const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(file) {
  return fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
}

test('zoom layout metrics: renderer styles do not use transform scale for editor zoom', () => {
  const css = read('src/renderer/styles.css');
  assert.equal(css.includes('transform: scale(var(--editor-zoom));'), false);
});

test('zoom layout metrics: active book profile source keeps A4 as the runtime default', () => {
  const js = read('src/renderer/editor.js');
  assert.ok(js.includes('const DEFAULT_ACTIVE_BOOK_PROFILE = createDefaultBookProfile();'));
  assert.ok(js.includes('const DEFAULT_PREVIEW_CHROME_STATE = createPreviewChromeState();'));
  assert.ok(js.includes('let activeBookProfileState = DEFAULT_ACTIVE_BOOK_PROFILE;'));
  assert.ok(js.includes('let activePreviewChromeState = DEFAULT_PREVIEW_CHROME_STATE;'));
  assert.ok(js.includes('const initialPageMetrics = getPageMetrics({'));
  assert.ok(js.includes('profile: activeBookProfileState,'));
  assert.ok(js.includes('applyPreviewChromeCssVars(activePreviewChromeState, document.documentElement, ZOOM_DEFAULT, PX_PER_MM_AT_ZOOM_1);'));
  assert.ok(js.includes('zoom: ZOOM_DEFAULT'));
});

test('zoom layout metrics: setEditorZoom applies page metrics via layout variables', () => {
  const js = read('src/renderer/editor.js');
  assert.ok(js.includes('function setEditorZoom(value, persist = true) {'));
  assert.ok(js.includes('const metrics = getPageMetrics({'));
  assert.ok(js.includes('profile: activeBookProfileState,'));
  assert.ok(js.includes('applyPageGeometryCssVars(metrics);'));
  assert.ok(js.includes('applyPreviewChromeCssVars(activePreviewChromeState, document.documentElement, editorZoom, PX_PER_MM_AT_ZOOM_1);'));
});
