const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function functionSection(source, functionName, nextFunctionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} must exist`);
  const next = nextFunctionName ? source.indexOf(`function ${nextFunctionName}`, start + 1) : -1;
  return source.slice(start, next > start ? next : source.length);
}

test('navigator derived counters renderer projects only pathless counter data', () => {
  const editor = read('src/renderer/editor.js');
  const normalizeSection = functionSection(editor, 'normalizeNavigatorDerivedCounters', 'formatNavigatorDerivedCounters');
  const formatSection = functionSection(editor, 'formatNavigatorDerivedCounters', 'isTreeNodeDefaultExpanded');
  const renderSection = functionSection(editor, 'renderTreeNode', 'findRomanRootNode');

  assert.match(normalizeSection, /node\.derivedCounters/u);
  assert.equal(/\bpath\s*:/u.test(normalizeSection), false);
  assert.match(formatSection, /сл\./u);
  assert.match(formatSection, /сц\./u);
  assert.match(renderSection, /row\.dataset\.navigatorWordCount/u);
  assert.match(renderSection, /row\.dataset\.navigatorSceneCount/u);
  assert.match(renderSection, /row\.dataset\.navigatorProgressPercent/u);
  assert.match(renderSection, /tree__counters/u);
  assert.equal(/\bpath\s*:/u.test(renderSection), false);
});

test('navigator derived counters styles stay bounded in the left rail', () => {
  const styles = read('src/renderer/styles.css');
  assert.match(styles, /\.sidebar--left \.tree__counters/u);
  assert.match(styles, /max-width: 96px/u);
  assert.match(styles, /text-overflow: ellipsis/u);
  assert.equal(styles.includes('transform: scale'), false);
});

