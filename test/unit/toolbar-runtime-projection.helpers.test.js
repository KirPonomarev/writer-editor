const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');

function createStubNode(name, options = {}) {
  const node = {
    name,
    hidden: Boolean(options.hidden),
    dataset: { ...(options.dataset || {}) },
    className: options.className || '',
    calls: {
      appendChild: 0,
      insertBefore: 0,
      replaceChildren: 0,
    },
    queryMap: new Map(Object.entries(options.queryMap || {})),
    queryAllMap: new Map(Object.entries(options.queryAllMap || {})),
    setAttribute(attributeName, value) {
      this[attributeName] = String(value);
    },
    removeAttribute(attributeName) {
      delete this[attributeName];
    },
    appendChild() {
      this.calls.appendChild += 1;
      throw new Error(`appendChild should not run for ${this.name}`);
    },
    insertBefore() {
      this.calls.insertBefore += 1;
      throw new Error(`insertBefore should not run for ${this.name}`);
    },
    replaceChildren() {
      this.calls.replaceChildren += 1;
      throw new Error(`replaceChildren should not run for ${this.name}`);
    },
    querySelector(selector) {
      return this.queryMap.get(selector) || null;
    },
    querySelectorAll(selector) {
      return this.queryAllMap.get(selector) || [];
    },
  };

  return node;
}

function wireToolbarRegistry() {
  const root = createStubNode('toolbar-root', {
    dataset: { toolbar: '' },
  });
  const shell = createStubNode('toolbar-shell', {
    dataset: { toolbarShell: '' },
  });

  const typeGroup = createStubNode('type-group', {
    className: 'floating-toolbar__group floating-toolbar__group--type',
  });
  const paragraphGroup = createStubNode('paragraph-group', {
    className: 'floating-toolbar__group floating-toolbar__group--paragraph',
  });
  const formatGroup = createStubNode('format-group', {
    className: 'floating-toolbar__group floating-toolbar__group--format-inline',
  });
  const historyGroup = createStubNode('history-group', {
    className: 'floating-toolbar__group floating-toolbar__group--history',
  });

  const fontNode = createStubNode('font-node', {
    dataset: { toolbarItemKey: 'font-select' },
    hidden: true,
  });
  const weightNode = createStubNode('weight-node', {
    dataset: { toolbarItemKey: 'weight-select' },
    hidden: true,
  });
  const sizeNode = createStubNode('size-node', {
    dataset: { toolbarItemKey: 'size-select' },
    hidden: true,
  });
  const lineHeightNode = createStubNode('line-height-node', {
    dataset: { toolbarItemKey: 'line-height-select' },
    hidden: true,
  });
  const paragraphTriggerNode = createStubNode('paragraph-trigger-node', {
    dataset: { toolbarItemKey: 'paragraph-trigger' },
    hidden: false,
  });
  const boldNode = createStubNode('bold-node', {
    dataset: { toolbarItemKey: 'format-bold' },
    hidden: true,
  });
  const italicNode = createStubNode('italic-node', {
    dataset: { toolbarItemKey: 'format-italic' },
    hidden: true,
  });
  const listTriggerNode = createStubNode('list-trigger-node', {
    dataset: { toolbarItemKey: 'list-type' },
    hidden: false,
  });
  const undoNode = createStubNode('undo-node', {
    dataset: { toolbarItemKey: 'history-undo' },
    hidden: false,
  });
  const paragraphMenu = createStubNode('paragraph-menu', { hidden: false });
  const listMenu = createStubNode('list-menu', { hidden: false });
  const spacingMenu = createStubNode('spacing-menu', { hidden: false });

  root.queryMap.set('[data-toolbar-shell]', shell);
  root.queryMap.set('.floating-toolbar__shell', shell);
  shell.queryMap.set('[data-paragraph-menu]', paragraphMenu);
  shell.queryMap.set('[data-list-menu]', listMenu);
  shell.queryMap.set('[data-toolbar-spacing-menu]', spacingMenu);
  shell.queryMap.set('[data-toolbar-item-key="paragraph-trigger"]', paragraphTriggerNode);
  shell.queryMap.set('[data-toolbar-item-key="list-type"]', listTriggerNode);
  shell.queryMap.set('[data-bind-key="paragraph-trigger"]', paragraphTriggerNode);
  shell.queryMap.set('[data-toolbar-bind-key="paragraph-trigger"]', paragraphTriggerNode);
  shell.queryAllMap.set('.floating-toolbar__group', [typeGroup, formatGroup, paragraphGroup, historyGroup]);

  typeGroup.queryAllMap.set(
    '[data-toolbar-item-key], [data-bind-key], [data-toolbar-bind-key]',
    [fontNode, weightNode, sizeNode, lineHeightNode],
  );
  paragraphGroup.queryAllMap.set(
    '[data-toolbar-item-key], [data-bind-key], [data-toolbar-bind-key]',
    [paragraphTriggerNode, listTriggerNode],
  );
  formatGroup.queryAllMap.set(
    '[data-toolbar-item-key], [data-bind-key], [data-toolbar-bind-key]',
    [boldNode, italicNode],
  );
  historyGroup.queryAllMap.set(
    '[data-toolbar-item-key], [data-bind-key], [data-toolbar-bind-key]',
    [undoNode],
  );

  return {
    root,
    shell,
    typeGroup,
    formatGroup,
    paragraphGroup,
    historyGroup,
    fontNode,
    weightNode,
    sizeNode,
    lineHeightNode,
    boldNode,
    italicNode,
    paragraphTriggerNode,
    listTriggerNode,
    undoNode,
    paragraphMenu,
    listMenu,
    spacingMenu,
  };
}

test('toolbar runtime projection: registry is derived from main floating toolbar DOM containers', async () => {
  const modulePath = pathToFileURL(path.join(ROOT, 'src', 'renderer', 'toolbar', 'toolbarRuntimeProjection.mjs')).href;
  const {
    createToolbarRuntimeRegistry,
  } = await import(modulePath);

  const nodes = wireToolbarRegistry();
  const registry = createToolbarRuntimeRegistry(nodes.root);

  assert.equal(registry.toolbarRoot, nodes.root);
  assert.equal(registry.toolbarShell, nodes.shell);
  assert.deepEqual(
    registry.groupDescriptors.map((group) => group.itemDescriptors.map((item) => item.bindKey)),
    [
      ['font-select', 'weight-select', 'size-select', 'line-height-select'],
      ['format-bold', 'format-italic'],
      ['paragraph-trigger', 'list-type'],
      ['history-undo'],
    ],
  );
  assert.equal(nodes.shell.calls.appendChild, 0);
  assert.equal(nodes.shell.calls.insertBefore, 0);
  assert.equal(nodes.shell.calls.replaceChildren, 0);
});

test('toolbar runtime projection: active profile state collapses to live canonical order only', async () => {
  const modulePath = pathToFileURL(path.join(ROOT, 'src', 'renderer', 'toolbar', 'toolbarRuntimeProjection.mjs')).href;
  const {
    collectVisibleToolbarItemIdsFromState,
  } = await import(modulePath);

  const ids = collectVisibleToolbarItemIdsFromState({
    activeToolbarProfile: 'master',
    toolbarProfiles: {
      minimal: [
        'toolbar.history.redo',
        'toolbar.history.undo',
      ],
      master: [
        'toolbar.history.redo',
        'toolbar.format.italic',
        'toolbar.format.bold',
        'toolbar.font.family',
        'toolbar.format.bold',
      ],
    },
  });

  assert.deepEqual(ids, [
    'toolbar.font.family',
    'toolbar.format.bold',
    'toolbar.format.italic',
    'toolbar.history.redo',
  ]);
});

test('toolbar runtime projection: active empty profile hides overlays and all live groups', async () => {
  const modulePath = pathToFileURL(path.join(ROOT, 'src', 'renderer', 'toolbar', 'toolbarRuntimeProjection.mjs')).href;
  const {
    createToolbarRuntimeRegistry,
    applyToolbarActiveProfile,
  } = await import(modulePath);

  const nodes = wireToolbarRegistry();
  const registry = createToolbarRuntimeRegistry(nodes.root);
  const snapshot = applyToolbarActiveProfile(registry, {
    activeToolbarProfile: 'master',
    toolbarProfiles: {
      minimal: [
        'toolbar.history.undo',
      ],
      master: [],
    },
  });

  assert.equal(snapshot.hasVisibleItems, false);
  assert.deepEqual(snapshot.visibleItemIds, []);
  assert.deepEqual(snapshot.visibleBindKeys, []);
  assert.deepEqual(snapshot.missingBindKeys, ['history-redo']);
  assert.equal(snapshot.paragraphTriggerVisible, false);
  assert.equal(snapshot.listTriggerVisible, false);
  assert.equal(snapshot.spacingMenuVisible, false);
  assert.equal(snapshot.listMenuVisible, false);
  assert.equal(snapshot.anchorResyncRequired, true);
  assert.deepEqual(snapshot.groupVisibleBindKeys, [[], [], [], []]);

  assert.equal(nodes.root.hidden, false);
  assert.equal(nodes.shell.hidden, false);
  assert.equal(nodes.typeGroup.hidden, true);
  assert.equal(nodes.formatGroup.hidden, true);
  assert.equal(nodes.paragraphGroup.hidden, true);
  assert.equal(nodes.historyGroup.hidden, true);
  assert.equal(nodes.fontNode.hidden, true);
  assert.equal(nodes.weightNode.hidden, true);
  assert.equal(nodes.sizeNode.hidden, true);
  assert.equal(nodes.lineHeightNode.hidden, true);
  assert.equal(nodes.boldNode.hidden, true);
  assert.equal(nodes.italicNode.hidden, true);
  assert.equal(nodes.paragraphTriggerNode.hidden, true);
  assert.equal(nodes.listTriggerNode.hidden, true);
  assert.equal(nodes.paragraphMenu.hidden, true);
  assert.equal(nodes.listMenu.hidden, true);
  assert.equal(nodes.spacingMenu.hidden, true);
});

test('toolbar runtime projection: minimal wrapper keeps minimal profile compatibility', async () => {
  const modulePath = pathToFileURL(path.join(ROOT, 'src', 'renderer', 'toolbar', 'toolbarRuntimeProjection.mjs')).href;
  const {
    createToolbarRuntimeRegistry,
    applyToolbarProfileMinimal,
  } = await import(modulePath);

  const nodes = wireToolbarRegistry();
  const registry = createToolbarRuntimeRegistry(nodes.root);
  const snapshot = applyToolbarProfileMinimal(registry, {
    activeToolbarProfile: 'master',
    toolbarProfiles: {
      minimal: [
        'toolbar.history.undo',
        'toolbar.history.redo',
      ],
      master: [],
    },
  });

  assert.equal(snapshot.hasVisibleItems, true);
  assert.deepEqual(snapshot.visibleItemIds, ['toolbar.history.undo']);
  assert.deepEqual(snapshot.visibleBindKeys, ['history-undo']);
  assert.deepEqual(snapshot.missingBindKeys, ['history-redo']);
  assert.equal(snapshot.paragraphTriggerVisible, false);
  assert.equal(snapshot.listTriggerVisible, false);
  assert.equal(snapshot.spacingMenuVisible, false);
  assert.equal(snapshot.listMenuVisible, false);
  assert.equal(snapshot.anchorResyncRequired, true);
  assert.deepEqual(snapshot.groupVisibleBindKeys, [[], [], [], ['history-undo']]);

  assert.equal(nodes.root.hidden, false);
  assert.equal(nodes.shell.hidden, false);
  assert.equal(nodes.typeGroup.hidden, true);
  assert.equal(nodes.formatGroup.hidden, true);
  assert.equal(nodes.paragraphGroup.hidden, true);
  assert.equal(nodes.historyGroup.hidden, false);
  assert.equal(nodes.fontNode.hidden, true);
  assert.equal(nodes.weightNode.hidden, true);
  assert.equal(nodes.sizeNode.hidden, true);
  assert.equal(nodes.lineHeightNode.hidden, true);
  assert.equal(nodes.boldNode.hidden, true);
  assert.equal(nodes.italicNode.hidden, true);
  assert.equal(nodes.paragraphTriggerNode.hidden, true);
  assert.equal(nodes.listTriggerNode.hidden, true);
  assert.equal(nodes.paragraphMenu.hidden, true);
  assert.equal(nodes.listMenu.hidden, true);
  assert.equal(nodes.spacingMenu.hidden, true);
});

test('toolbar runtime projection: live DOM bind key order stays aligned with canonical catalog order', async () => {
  const catalogModulePath = pathToFileURL(path.join(ROOT, 'src', 'renderer', 'toolbar', 'toolbarFunctionCatalog.mjs')).href;
  const catalog = await import(catalogModulePath);
  const html = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'index.html'), 'utf8');
  const controlsMatch = html.match(/<div class="floating-toolbar__controls">([\s\S]*?)<div class="floating-toolbar__paragraph-menu"/);

  assert.ok(controlsMatch, 'floating toolbar controls block must exist');

  const bindKeys = [...controlsMatch[1].matchAll(/data-toolbar-item-key="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(bindKeys, catalog.listLiveToolbarFunctionCatalogEntries().map((entry) => entry.bindKey));
});
