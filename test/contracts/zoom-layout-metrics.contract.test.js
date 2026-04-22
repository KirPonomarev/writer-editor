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
  assert.match(js, /const\s+DEFAULT_ACTIVE_BOOK_PROFILE_ID\s*=\s*'A4';/);
  assert.match(js, /let\s+activeBookProfileSource\s*=\s*createCanonicalActiveBookProfileSource\(\);/);
  assert.match(js, /const\s+initialPageMetrics\s*=\s*getPageMetrics\(\{\s*pageWidthMm:\s*getActiveBookProfilePageWidthMm\(\),\s*zoom:\s*ZOOM_DEFAULT\s*\}\)/m);
});

test('zoom layout metrics: setEditorZoom applies page metrics via layout variables', () => {
  const js = read('src/renderer/editor.js');
  assert.match(js, /function\s+setEditorZoom\s*\([\s\S]*?getPageMetrics\(\{\s*pageWidthMm:\s*getActiveBookProfilePageWidthMm\(\),\s*zoom:\s*editorZoom\s*\}\)/m);
  assert.match(js, /function\s+setEditorZoom\s*\([\s\S]*?applyPageViewCssVars\(metrics\)/m);
});
