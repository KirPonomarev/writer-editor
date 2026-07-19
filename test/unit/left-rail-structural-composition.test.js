const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

test('left rail keeps header, projection, tree, and summary as separate layers', () => {
  const html = read('src/renderer/index.html');
  const styles = read('src/renderer/styles.css');

  assert.match(html, /data-left-rail-header/u);
  assert.match(html, /data-left-rail-action="search"/u);
  assert.match(html, /data-left-rail-action="add"/u);
  assert.match(html, /data-left-rail-project-controls/u);
  assert.match(html, /data-left-rail-summary/u);
  assert.equal(html.includes('workspace-map__path'), false);
  assert.equal(html.includes('workspace-map__path-item'), false);

  assert.match(styles, /\.left-rail-header\s*\{/u);
  assert.match(styles, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/u);
  assert.match(styles, /\.left-rail-projection\s*\{/u);
  assert.match(styles, /\.left-rail-summary\s*\{/u);
  assert.match(styles, /--tree-row-height: 31px/u);
  assert.match(styles, /--tree-indent: 13px/u);
});

test('left rail actions reuse command-gated navigator behavior and derived counters', () => {
  const editor = read('src/renderer/editor.js');
  const createStart = editor.indexOf('function buildNavigatorRootCreateMenuItems(');
  const createEnd = editor.indexOf('function renderTree(', createStart);
  const createSection = editor.slice(createStart, createEnd);

  assert.ok(createStart >= 0 && createEnd > createStart);
  assert.match(createSection, /appendContextMenuCommandItem/u);
  assert.match(createSection, /EXTRA_COMMAND_IDS\.TREE_CREATE_NODE/u);
  assert.match(createSection, /handleCreateNode\(romanRoot, 'part'/u);
  assert.match(createSection, /handleCreateNode\(romanRoot, 'chapter-file'/u);
  assert.match(createSection, /handleCreateNode\(romanRoot, 'chapter-folder'/u);
  assert.equal(createSection.includes('onClick:'), false);

  assert.match(editor, /function updateLeftRailSummary\(presentationRoot = null\)/u);
  assert.match(editor, /normalizeNavigatorDerivedCounters\(presentationRoot\)/u);
  assert.match(editor, /leftRailProgressValue\.style\.width/u);
  assert.match(editor, /applyLeftTab\('search'\)/u);
});
