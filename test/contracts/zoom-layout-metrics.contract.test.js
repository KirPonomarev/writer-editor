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

test('zoom layout metrics: setEditorZoom applies page metrics via layout variables', () => {
  const js = read('src/renderer/editor.js');
  assert.match(js, /function\s+setEditorZoom\s*\([\s\S]*?getPageMetrics\(\{\s*pageWidthMm:\s*initialPageWidthMm,\s*zoom:\s*editorZoom\s*\}\)/m);
  assert.match(js, /function\s+setEditorZoom\s*\([\s\S]*?applyPageViewCssVars\(metrics\)/m);
});
