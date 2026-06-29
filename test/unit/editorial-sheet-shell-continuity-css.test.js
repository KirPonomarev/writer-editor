const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../..');

function readSource(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function extractCssRule(source, selector) {
  const start = source.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `Missing CSS rule for ${selector}`);
  const bodyStart = source.indexOf('{', start) + 1;
  const bodyEnd = source.indexOf('\n}', bodyStart);
  assert.notEqual(bodyEnd, -1, `Missing CSS rule close for ${selector}`);
  return source.slice(bodyStart, bodyEnd);
}

test('editorial sheet shell continuity: runtime overscans while paper stays on shell layer only', () => {
  const editorText = readSource('src/renderer/editor.js');
  const cssText = readSource('src/renderer/styles.css');

  assert.ok(editorText.includes('const CENTRAL_SHEET_RUNTIME_WINDOW_OVERSCAN = 6;'));

  const proofSelector = '.main-content--editor #editor.tiptap-host.tiptap-host--central-sheet-strip-proof';
  const proofBlock = extractCssRule(cssText, proofSelector);
  const darkBlock = extractCssRule(cssText, `body.dark-theme ${proofSelector}`);
  const shellBlock = extractCssRule(
    cssText,
    `${proofSelector} .tiptap-sheet-strip > .tiptap-page-wrap .tiptap-page`,
  );

  assert.match(proofBlock, /background:\s*transparent;/);
  assert.doesNotMatch(proofBlock, /repeating-linear-gradient/);
  assert.doesNotMatch(proofBlock, /var\(--page-bg\)/);

  assert.match(darkBlock, /background:\s*transparent;/);
  assert.doesNotMatch(darkBlock, /repeating-linear-gradient/);
  assert.doesNotMatch(darkBlock, /var\(--page-bg\)/);

  assert.match(shellBlock, /background:\s*var\(--page-bg\);/);
  assert.match(shellBlock, /border-radius:\s*var\(--page-radius\);/);
});
