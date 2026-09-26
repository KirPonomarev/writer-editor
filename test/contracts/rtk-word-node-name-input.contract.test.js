const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../../src/renderer/editor.js'), 'utf8');
const dialogSource = fs.readFileSync(path.resolve(__dirname, '../../src/renderer/linkDialog.mjs'), 'utf8').replace(/export /g, '');
function harness() {
  let respond;
  const effects = [];
  const node = { nodeId: 'n1', kind: 'scene', label: 'Original' };
  const context = vm.createContext({
    currentProjectId: 'p1', treeRoot: { children: [node] }, allowed: true,
    EXTRA_COMMAND_IDS: { TREE_CREATE_NODE: 'create', TREE_RENAME_NODE: 'rename' },
    getEffectiveDocumentId: (n) => n?.nodeId,
    findTreeNodeById: (root, id) => root.children.find((n) => n.nodeId === id),
    openNodeNameDialog: (options) => { context.options = options; return new Promise((r) => { respond = r; }); },
    dispatchUiCommand: async (id, payload) => { effects.push([id, JSON.parse(JSON.stringify(payload))]); return { ok: context.allowed }; },
    loadTree: async () => { effects.push(['load']); },
  });
  vm.runInContext(dialogSource, context);
  // Keep the actual validator; substitute only the asynchronous input port.
  context.openNodeNameDialog = (options) => { context.options = options; return new Promise((r) => { respond = r; }); };
  vm.runInContext(source.slice(source.indexOf('function captureNodeNameTarget('), source.indexOf('async function handleDeleteNode(')), context);
  return { context, node, effects, respond: (v) => respond(v), run: (rename) => rename ? context.handleRenameNode(node) : context.handleCreateNode(node, 'scene', 'Новая сцена') };
}
for (const rename of [false, true]) {
  test(`node name ${rename ? 'rename' : 'create'} uses captured identity and canonical dispatch`, async () => {
    const h = harness(), pending = h.run(rename); h.respond(' Новая сцена '); await pending;
    assert.deepEqual(h.effects, [[rename ? 'rename' : 'create', { projectId: 'p1', [rename ? 'nodeId' : 'parentNodeId']: 'n1', ...(!rename ? { kind: 'scene' } : {}), name: 'Новая сцена' }], ['load']]);
  });
  test(`node name ${rename} rejects stale project, snapshot, node kind, label and removal`, async () => {
    for (const mutate of [
      (h) => { h.context.currentProjectId = 'p2'; },
      (h) => { h.context.treeRoot = { children: [h.node] }; },
      (h) => { h.context.currentProjectId = 'p2'; h.context.treeRoot = { children: [h.node] }; h.context.currentProjectId = 'p1'; },
      (h) => { h.node.kind = 'part'; }, (h) => { h.node.label = 'Changed'; },
      (h) => { h.context.treeRoot.children = []; },
    ]) {
      const h = harness(), pending = h.run(rename); mutate(h); h.respond('Valid'); await pending; assert.deepEqual(h.effects, []);
    }
  });
  test(`node name ${rename} cancels and validates before dispatch; rejected command cannot reload`, async () => {
    for (const value of [null, '', '   ', '../escape', 'a/b', 'a\\b', 'x\n', 'a'.repeat(81), '.', 'end.']) {
      const h = harness(), pending = h.run(rename); h.respond(value); await pending; assert.deepEqual(h.effects, [], String(value));
    }
    const h = harness(), pending = h.run(rename); h.context.allowed = false; h.respond('Valid'); await pending;
    assert.equal(h.effects.length, 1); assert.equal(h.effects[0][0], rename ? 'rename' : 'create');
  });
}
function dom() {
  const nodes = [];
  class Element {
    constructor(tag) { this.tag = tag; this.style = {}; this.attrs = {}; this.events = {}; this.children = []; this.isConnected = true; nodes.push(this); }
    setAttribute(k, v) { this.attrs[k] = v; }
    append(...children) { this.children.push(...children); }
    addEventListener(k, f) { this.events[k] = f; }
    focus() { document.activeElement = this; }
    select() { this.selected = true; }
    showModal() { this.open = true; }
    close() { this.open = false; this.events.close?.(); }
    remove() { this.isConnected = false; }
  }
  const document = { createElement: (tag) => new Element(tag), body: new Element('body'), activeElement: new Element('button') };
  const previous = document.activeElement;
  const context = vm.createContext({ document }); vm.runInContext(dialogSource, context);
  return { context, nodes, document, previous, input: () => nodes.findLast((n) => n.tag === 'input'), dialog: () => nodes.findLast((n) => n.tag === 'dialog') };
}
test('native name dialog labels, validation, duplicate exclusion, IME, Enter and focus', async () => {
  const h = dom(), pending = h.context.openNodeNameDialog({ title: 'Глава' });
  assert.equal(h.input().inputMode, 'text'); assert.equal(h.document.activeElement, h.input());
  assert.equal(h.context.isLinkDialogOpen(), true);
  assert.equal(await h.context.openNodeNameDialog({ title: 'Duplicate' }), null);
  const key = { key: 'Enter', isComposing: false, preventDefault() {} };
  h.input().value = ''; h.input().events.keydown(key); assert.equal(h.input().attrs['aria-invalid'], 'true');
  h.input().value = 'Глава 1'; h.input().events.keydown({ ...key, isComposing: true }); assert.equal(h.context.isLinkDialogOpen(), true);
  h.input().events.keydown(key); assert.equal(await pending, 'Глава 1');
  assert.equal(h.context.isLinkDialogOpen(), false); assert.equal(h.document.activeElement, h.previous);
  assert.equal(h.dialog().isConnected, false);
});
test('Escape, lifecycle cancel, explicit cancel and native close do not accept input', async () => {
  for (const action of ['escape', 'lifecycle', 'button', 'close']) {
    const h = dom(), pending = h.context.openNodeNameDialog({ title: 'Имя', initialValue: 'Original', rename: true });
    assert.equal(h.input().value, 'Original');
    if (action === 'escape') h.dialog().events.cancel({ preventDefault() {} });
    if (action === 'lifecycle') h.context.cancelLinkDialog();
    if (action === 'button') h.nodes.find((n) => n.textContent === 'Отмена').events.click();
    if (action === 'close') h.dialog().close();
    assert.equal(await pending, null); assert.equal(h.context.isLinkDialogOpen(), false);
  }
});
test('existing link dialog retains URL labels, validation, apply and remove semantics', async () => {
  for (const remove of [false, true]) {
    const h = dom(), pending = h.context.openLinkDialog({ title: 'Link', initialValue: 'https://example.invalid', canRemove: true, normalize: (v) => ({ ok: v.startsWith('https://') }) });
    assert.equal(h.input().inputMode, 'url'); assert.ok(h.nodes.some((n) => n.textContent === 'Link address'));
    h.nodes.find((n) => n.textContent === (remove ? 'Remove link' : 'Apply')).events.click();
    assert.equal(await pending, remove ? '' : 'https://example.invalid');
  }
});
