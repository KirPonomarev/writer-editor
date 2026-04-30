const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../..');

function readSource(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('editorial sheet shell continuity: runtime overscans and paints page bands behind virtual shell spacers', () => {
  const editorText = readSource('src/renderer/editor.js');
  const cssText = readSource('src/renderer/styles.css');

  assert.ok(editorText.includes('const CENTRAL_SHEET_RUNTIME_WINDOW_OVERSCAN = 6;'));

  const proofSelector = '.main-content--editor #editor.tiptap-host.tiptap-host--central-sheet-strip-proof';
  const proofStart = cssText.indexOf(`${proofSelector} {`);
  assert.notEqual(proofStart, -1, 'central sheet proof selector must exist');
  const proofEnd = cssText.indexOf('\n}', proofStart);
  const proofBlock = cssText.slice(proofStart, proofEnd);

  assert.match(proofBlock, /background:\s*repeating-linear-gradient\(/);
  assert.ok(proofBlock.includes('var(--page-bg) var(--page-height-px)'));
  assert.ok(proofBlock.includes('transparent var(--central-sheet-page-stride-px)'));

  const darkSelector = `body.dark-theme ${proofSelector}`;
  const darkStart = cssText.indexOf(`${darkSelector} {`);
  assert.notEqual(darkStart, -1, 'dark central sheet proof selector must exist');
  const darkEnd = cssText.indexOf('\n}', darkStart);
  const darkBlock = cssText.slice(darkStart, darkEnd);

  assert.match(darkBlock, /background:\s*repeating-linear-gradient\(/);
  assert.ok(darkBlock.includes('var(--page-bg) var(--page-height-px)'));
  assert.ok(darkBlock.includes('transparent var(--central-sheet-page-stride-px)'));
});
