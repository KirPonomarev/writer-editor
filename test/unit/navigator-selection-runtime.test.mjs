import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

test('navigator runtime separates active document, selection, and focus semantics', () => {
  const source = read('src/renderer/editor.js');
  const renderStart = source.indexOf('function renderTreeNode(');
  const renderEnd = source.indexOf('function findRomanRootNode(', renderStart);
  const renderSection = source.slice(renderStart, renderEnd);

  assert.match(renderSection, /row\.classList\.add\('is-active-document'\)/u);
  assert.match(renderSection, /row\.dataset\.activeDocument = 'true'/u);
  assert.match(renderSection, /row\.setAttribute\('aria-current', 'true'\)/u);
  assert.match(renderSection, /navigatorSelectionState\.selectedIds\.includes/u);
  assert.match(renderSection, /row\.setAttribute\('aria-selected', selected \? 'true' : 'false'\)/u);
  assert.match(renderSection, /row\.addEventListener\('focus'/u);
  assert.match(renderSection, /selectionOnly/u);
});

test('navigator keyboard behavior shares the bounded selection model', () => {
  const source = read('src/renderer/editor.js');
  const start = source.indexOf("treeContainer.addEventListener('keydown'");
  const end = source.indexOf("treeContainer.addEventListener('contextmenu'", start);
  const section = source.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.match(section, /ArrowUp/u);
  assert.match(section, /ArrowDown/u);
  assert.match(section, /Home/u);
  assert.match(section, /End/u);
  assert.match(section, /moveNavigatorFocus/u);
  assert.match(section, /applyNavigatorSelection/u);
  assert.match(section, /event\.shiftKey/u);
  assert.match(section, /event\.metaKey \|\| event\.ctrlKey/u);
  assert.match(section, /scheduleNavigatorRowFocus/u);
});

test('selection read model is transient and only preselects main-validated export candidates', () => {
  const model = read('src/renderer/navigatorSelectionModel.mjs');
  const renderer = read('src/renderer/editor.js');
  const main = read('src/main.js');

  assert.equal(/localStorage|sessionStorage|electronAPI|writeFile|fetch\(/u.test(model), false);
  assert.match(model, /scopes: Object\.freeze\(\['flow', 'export'\]\)/u);
  assert.match(renderer, /function applyNavigatorSelectionToExportScope\(scope\)/u);
  assert.match(renderer, /candidate\.nodeId && selectedNodeIds\.has\(candidate\.nodeId\)/u);
  assert.match(main, /nodeId: binding\.nodeIdsByBindingKey\.get/u);
  assert.match(main, /nodeId: candidate\.nodeId/u);
  assert.match(main, /payload\.selectedSceneIds\.filter/u);
});

test('safe reset and project changes discard transient selection state', () => {
  const source = read('src/renderer/editor.js');
  const resetStart = source.indexOf('function performSafeResetShell()');
  const resetEnd = source.indexOf('function performRestoreLastStableShell()', resetStart);
  const resetSection = source.slice(resetStart, resetEnd);

  assert.match(resetSection, /navigatorSelectionState = createNavigatorSelectionState\(currentProjectId\)/u);
  assert.equal((source.match(/navigatorSelectionState = createNavigatorSelectionState\(currentProjectId\)/gu) || []).length >= 3, true);
  assert.match(source, /reconcileNavigatorSelectionWithTree\(\)/u);
});
