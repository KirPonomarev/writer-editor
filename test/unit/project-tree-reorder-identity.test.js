'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const boundary = require('../../src/core/io/path-boundary');

const ROOT = path.resolve(__dirname, '../..');
const editor = fs.readFileSync(path.join(ROOT, 'src/renderer/editor.js'), 'utf8');
const main = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');
const presentation = import(pathToFileURL(path.join(ROOT, 'src/renderer/leftRailPresentationModel.mjs')).href);
const id = n => 'tree-node-' + n.toString(16).padStart(32, '0');
const node = (n, kind, children = [], label = String(n)) => ({ nodeId: id(n), id: id(n), kind, label, children });

function sourceFunction(source, name) {
  const match = new RegExp('(?:async )?function ' + name + '\\(').exec(source);
  assert.ok(match, name + ' exists in the production source');
  const end = source.indexOf('\n}', match.index);
  assert.ok(end > match.index);
  const body = source.slice(match.index, end + 2);
  new vm.Script(body);
  return body;
}

async function renderer(raw) {
  const c = {
    treeRoot: raw, currentProjectId: 'project-reorder',
    treeMutationProjection: { projectId: 'project-reorder', treeRevision: 7 },
    treeMutationPending: false, allowed: true,
    NAVIGATOR_MOVABLE_KINDS: new Set(['part', 'chapter-folder', 'chapter-file', 'scene']),
    EXTRA_COMMAND_IDS: { TREE_MOVE_NODE: 'cmd.project.tree.moveNode' },
    document: { createElement: () => ({}) }, calls: [], reloads: 0,
  };
  c.isNavigatorContextCommandAvailable = () => c.allowed;
  c.dispatchUiCommand = async (commandId, payload) => {
    c.calls.push({ commandId, payload: JSON.parse(JSON.stringify(payload)) });
    return { ok: true };
  };
  c.loadTree = async () => { c.reloads++; };
  vm.createContext(c);
  const names = ['getEffectiveDocumentId', 'isProjectTreeDocumentId', 'getEffectiveDocumentKind',
    'findTreeNodeById', 'isNavigatorMovableNode', 'captureTreeMutationProjection', 'handleMoveNode', 'handleReorderNode'];
  // Run the old real handlers during RED too; absent future helpers must not
  // turn the causal test into a missing-function or ReferenceError failure.
  if (/function captureTreeReorderIntent\(/u.test(editor)) names.push('captureTreeReorderIntent');
  vm.runInContext(names.map(name => sourceFunction(editor, name)).join('\n'), c);
  const render = sourceFunction(editor, 'renderTreeNode');
  const prefixEnd = render.indexOf('\n  const row');
  assert.ok(prefixEnd > 0);
  vm.runInContext(render.slice(0, prefixEnd) + '\n}', c);
  const shown = (await presentation).buildLeftRailPresentationTree(raw);
  const annotate = (parent, parentId = '') => {
    (parent.children || []).forEach((child, index) => {
      // Exact production render assignment prefix, without a native DOM.
      c.renderTreeNode(child, 1, false, [], parentId || c.getEffectiveDocumentId(parent), index);
      annotate(child, c.getEffectiveDocumentId(child));
    });
  };
  annotate(shown);
  c.shown = shown;
  c.shownNode = n => c.findTreeNodeById(shown, id(n));
  return c;
}

function rootTree() {
  return node(1, 'roman-root', [
    node(2, 'roman-section', [], 'обложка'), node(3, 'roman-section', [], 'черновик'),
    node(4, 'roman-section', [], 'чистовой текст'),
    node(10, 'chapter-folder', [node(100, 'scene'), node(101, 'scene')], 'Alpha'),
    node(11, 'chapter-folder', [node(102, 'scene')], 'Beta'),
    node(5, 'roman-section', [], 'сны'),
  ]);
}

test('chapter Up emits the current raw parent and authored ordinal through the existing pathless command', async () => {
  const raw = rootTree(), before = JSON.stringify(raw), c = await renderer(raw);
  const shown = c.shownNode(11);
  assert.equal(shown.parentNodeId, 'left-rail-manuscript');
  assert.equal(shown.siblingIndex, 4);
  await c.handleReorderNode(shown, 'up');
  assert.deepEqual(c.calls, [{ commandId: 'cmd.project.tree.moveNode', payload: {
    projectId: 'project-reorder', nodeId: id(11), targetParentNodeId: id(1), targetIndex: 0, expectedTreeRevision: 7,
  } }]);
  assert.equal(c.reloads, 1);
  assert.equal(JSON.stringify(raw), before, 'a presentation operation cannot rewrite the canonical projection');
});

test('chapter Down remains usable after an equivalent same-revision raw-tree refresh', async () => {
  const c = await renderer(rootTree()), shown = c.shownNode(10);
  c.treeRoot = JSON.parse(JSON.stringify(c.treeRoot));
  await c.handleReorderNode(shown, 'down');
  assert.deepEqual(c.calls[0]?.payload, {
    projectId: 'project-reorder', nodeId: id(10), targetParentNodeId: id(1), targetIndex: 1, expectedTreeRevision: 7,
  });
  assert.equal(c.calls.length, 1);
});

test('first Up and last Down are true boundary no-ops despite presentation sections', async () => {
  for (const [n, direction] of [[10, 'up'], [11, 'down']]) {
    const c = await renderer(rootTree());
    await c.handleReorderNode(c.shownNode(n), direction);
    assert.deepEqual(c.calls, []);
    assert.equal(c.reloads, 0);
  }
});

test('parts, nested chapters and scenes use their actual parent and sibling order', async () => {
  const raw = node(1, 'roman-root', [node(2, 'roman-section', [], 'черновик'),
    node(20, 'part', [node(30, 'chapter-folder', [node(40, 'scene'), node(41, 'scene')]), node(31, 'chapter-file')]),
    node(21, 'part', []),
  ]);
  for (const [n, direction, parent, targetIndex] of [[21, 'up', 1, 0], [31, 'up', 20, 0], [40, 'down', 30, 1]]) {
    const c = await renderer(JSON.parse(JSON.stringify(raw)));
    await c.handleReorderNode(c.shownNode(n), direction);
    assert.deepEqual(c.calls[0]?.payload, {
      projectId: 'project-reorder', nodeId: id(n), targetParentNodeId: id(parent), targetIndex, expectedTreeRevision: 7,
    });
    assert.equal(c.calls.length, 1);
  }
});

test('missing or retired raw membership, invalid direction and unavailable revision or capability never dispatch', async () => {
  const changes = [
    c => { c.treeRoot.children = c.treeRoot.children.filter(n => n.nodeId !== id(11)); },
    c => { c.treeRoot = null; },
    c => { c.currentProjectId = 'foreign-project'; },
    c => { c.treeMutationProjection = null; },
    c => { c.allowed = false; },
    c => { c.treeMutationPending = true; },
    () => {},
  ];
  for (let i = 0; i < changes.length; i++) {
    const c = await renderer(rootTree()), shown = c.shownNode(11);
    changes[i](c);
    await c.handleReorderNode(shown, i === changes.length - 1 ? 'sideways' : 'up');
    assert.deepEqual(c.calls, [], 'refusal variant ' + i);
    assert.equal(c.reloads, 0);
  }
});

function physicalFixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'writer-tree-reorder-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const roman = path.join(root, 'roman'); fs.mkdirSync(roman);
  for (const name of ['02_Alpha', '03_Beta']) fs.mkdirSync(path.join(roman, name));
  for (const [name, text] of [['черновик.txt', 'Original draft 🧭'], ['обложка.txt', 'Original cover'],
    ['02_Alpha/01_Scene.txt', 'Alpha'], ['03_Beta/01_Scene.txt', 'Beta']]) fs.writeFileSync(path.join(roman, name), text);
  const records = [
    [1, 'roman', 'roman-root'], [2, 'roman/черновик.txt', 'roman-section'], [3, 'roman/обложка.txt', 'roman-section'],
    [10, 'roman/02_Alpha', 'chapter-folder'], [11, 'roman/03_Beta', 'chapter-folder'],
    [100, 'roman/02_Alpha/01_Scene.txt', 'scene'], [101, 'roman/03_Beta/01_Scene.txt', 'scene'],
  ];
  const manifest = { projectId: 'project-reorder', treeIdentity: { schemaVersion: 1,
    nodes: Object.fromEntries(records.map(([n, relativePath, kind]) => [id(n), { bindingKey: 'file:' + relativePath, kind, present: true }])) } };
  const c = { path, Buffer, fs: fsp, joinPathSegmentsWithinRoot: boundary.joinPathSegmentsWithinRoot,
    isPathInsideBoundary: boundary.isPathInsideBoundary, logDevError: (_name, error) => { throw error; } };
  vm.createContext(c);
  const constantsStart = main.indexOf('const TREE_MOVE_ALLOWED_NODE_KINDS = new Set([');
  assert.ok(constantsStart > 0);
  vm.runInContext(main.slice(constantsStart, main.indexOf(']);', constantsStart) + 3), c);
  const names = ['sanitizeFilename', 'extractNumericPrefix', 'stripNumericPrefix', 'stripTxtExtension',
    'getDisplayNameForEntry', 'formatPrefixedName', 'isPathInside', 'readDirectoryEntries', 'makeTreeMoveError',
    'buildOrderedTreeMoveRenames', 'dedupeRenames', 'readTreeOrderedEntries', 'buildTreeMovePlan', 'treeCohortError'];
  vm.runInContext(names.map(name => sourceFunction(main, name)).join('\n'), c);
  return { root, roman, manifest, c, binding: { projectRoot: root, manifest } };
}

test('Main authored reorder planning preserves physical fixed default-section names and bytes', async t => {
  const f = physicalFixture(t), before = new Map(['черновик.txt', 'обложка.txt'].map(n => [n, fs.readFileSync(path.join(f.roman, n))]));
  const result = await f.c.buildTreeMovePlan(path.join(f.roman, '03_Beta'), f.roman, 0, f.binding);
  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(result.value.renames)), [
    { from: path.join(f.roman, '03_Beta'), to: path.join(f.roman, '01_Beta') },
  ]);
  for (const [n, bytes] of before) assert.deepEqual(fs.readFileSync(path.join(f.roman, n)), bytes);
  assert.equal(fs.existsSync(path.join(f.roman, '03_Beta/01_Scene.txt')), true, 'planning is read-only');
});

test('Main fixed roman-section owner cannot enter the authored movable sequence', async t => {
  const f = physicalFixture(t);
  const result = await f.c.buildTreeMovePlan(path.join(f.roman, 'черновик.txt'), f.roman, 0, f.binding);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'E_TREE_MOVE_NODE_NOT_FOUND');
  assert.equal(fs.readFileSync(path.join(f.roman, 'черновик.txt'), 'utf8'), 'Original draft 🧭');
});

test('Main refuses unowned physical siblings before admitting an authored rename plan', async t => {
  const f = physicalFixture(t), unknown = path.join(f.roman, '04_Unowned.txt');
  fs.writeFileSync(unknown, 'Unowned source');
  await assert.rejects(f.c.buildTreeMovePlan(path.join(f.roman, '03_Beta'), f.roman, 0, f.binding), { code: 'E_TREE_COHORT_OWNER_REQUIRED' });
  assert.equal(fs.readFileSync(unknown, 'utf8'), 'Unowned source');
  assert.equal(fs.existsSync(path.join(f.roman, '03_Beta/01_Scene.txt')), true);
});
