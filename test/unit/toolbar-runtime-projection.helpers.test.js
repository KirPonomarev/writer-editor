const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');
const GROUP_SELECTOR = '.floating-toolbar__group';
const ITEM_SELECTOR = '[data-toolbar-item-key], [data-bind-key], [data-toolbar-bind-key]';

function createNode(name, options = {}) {
  return {
    name,
    hidden: Boolean(options.hidden),
    dataset: { ...(options.dataset || {}) },
    className: options.className || '',
    children: [],
    parentNode: null,
    parentElement: null,
    calls: {
      appendChild: 0,
      insertBefore: 0,
      replaceChildren: 0,
    },
    queryMap: new Map(Object.entries(options.queryMap || {})),
    setAttribute(attributeName, value) {
      this[attributeName] = String(value);
    },
    removeAttribute(attributeName) {
      delete this[attributeName];
    },
    appendChild(child) {
      this.calls.appendChild += 1;
      return this.insertBefore(child, null);
    },
    insertBefore(child, beforeNode) {
      this.calls.insertBefore += 1;
      if (!child || typeof child !== 'object') {
        return child;
      }

      const currentParent = child.parentNode;
      if (currentParent && currentParent !== this) {
        const currentIndex = currentParent.children.indexOf(child);
        if (currentIndex > -1) {
          currentParent.children.splice(currentIndex, 1);
        }
      }

      const currentIndex = this.children.indexOf(child);
      if (currentIndex > -1) {
        this.children.splice(currentIndex, 1);
      }

      const beforeIndex = beforeNode ? this.children.indexOf(beforeNode) : -1;
      const targetIndex = beforeIndex >= 0 ? beforeIndex : this.children.length;
      this.children.splice(targetIndex, 0, child);
      child.parentNode = this;
      child.parentElement = this;
      return child;
    },
    querySelector(selector) {
      return this.queryMap.get(selector) || null;
    },
    querySelectorAll(selector) {
      if (selector === GROUP_SELECTOR || selector === ITEM_SELECTOR) {
        return [...this.children];
      }
      return [];
    },
    closest(selector) {
      let current = this;
      while (current) {
        if (selector === GROUP_SELECTOR && typeof current.className === 'string' && current.className.includes('floating-toolbar__group')) {
          return current;
        }
        current = current.parentNode || null;
      }
      return null;
    },
  };
}

function connect(parent, child) {
  parent.children.push(child);
  child.parentNode = parent;
  child.parentElement = parent;
  return child;
}

function wireToolbarRegistry() {
  const root = createNode('toolbar-root');
  const shell = createNode('toolbar-shell');
  const controls = createNode('toolbar-controls', {
    className: 'floating-toolbar__controls',
  });

  const typeGroup = createNode('type-group', {
    className: 'floating-toolbar__group floating-toolbar__group--type',
  });
  const formatGroup = createNode('format-group', {
    className: 'floating-toolbar__group floating-toolbar__group--format-inline',
  });
  const paragraphGroup = createNode('paragraph-group', {
    className: 'floating-toolbar__group floating-toolbar__group--paragraph',
  });
  const historyGroup = createNode('history-group', {
    className: 'floating-toolbar__group floating-toolbar__group--history',
  });

  connect(root, shell);
  connect(shell, controls);
  connect(controls, typeGroup);
  connect(controls, formatGroup);
  connect(controls, paragraphGroup);
  connect(controls, historyGroup);

  shell.queryMap.set('[data-toolbar-shell]', shell);
  shell.queryMap.set('.floating-toolbar__shell', shell);
  shell.queryMap.set('.floating-toolbar__controls', controls);
  root.queryMap.set('[data-toolbar-shell]', shell);
  root.queryMap.set('.floating-toolbar__shell', shell);
  root.queryMap.set('.floating-toolbar__controls', controls);

  const fontNode = createNode('font-node', {
    dataset: { toolbarItemKey: 'font-select' },
    hidden: true,
  });
  const weightNode = createNode('weight-node', {
    dataset: { toolbarItemKey: 'weight-select' },
    hidden: true,
  });
  const sizeNode = createNode('size-node', {
    dataset: { toolbarItemKey: 'size-select' },
    hidden: true,
  });
  const lineHeightNode = createNode('line-height-node', {
    dataset: { toolbarItemKey: 'line-height-select' },
    hidden: true,
  });
  const boldNode = createNode('bold-node', {
    dataset: { toolbarItemKey: 'format-bold' },
    hidden: true,
  });
  const italicNode = createNode('italic-node', {
    dataset: { toolbarItemKey: 'format-italic' },
    hidden: true,
  });
  const paragraphTriggerNode = createNode('paragraph-trigger-node', {
    dataset: { toolbarItemKey: 'paragraph-trigger' },
    hidden: true,
  });
  const listTriggerNode = createNode('list-trigger-node', {
    dataset: { toolbarItemKey: 'list-type' },
    hidden: true,
  });
  const undoNode = createNode('undo-node', {
    dataset: { toolbarItemKey: 'history-undo' },
    hidden: true,
  });
  const redoNode = createNode('redo-node', {
    dataset: { toolbarItemKey: 'history-redo' },
    hidden: true,
  });
  const paragraphMenu = createNode('paragraph-menu', { hidden: false });
  const listMenu = createNode('list-menu', { hidden: false });
  const spacingMenu = createNode('spacing-menu', { hidden: false });

  connect(typeGroup, fontNode);
  connect(typeGroup, weightNode);
  connect(typeGroup, sizeNode);
  connect(typeGroup, lineHeightNode);
  connect(formatGroup, boldNode);
  connect(formatGroup, italicNode);
  connect(paragraphGroup, paragraphTriggerNode);
  connect(paragraphGroup, listTriggerNode);
  connect(historyGroup, undoNode);
  connect(historyGroup, redoNode);

  shell.queryMap.set('[data-paragraph-menu]', paragraphMenu);
  shell.queryMap.set('[data-list-menu]', listMenu);
  shell.queryMap.set('[data-toolbar-spacing-menu]', spacingMenu);
  shell.queryMap.set('[data-toolbar-item-key="font-select"]', fontNode);
  shell.queryMap.set('[data-toolbar-item-key="weight-select"]', weightNode);
  shell.queryMap.set('[data-toolbar-item-key="size-select"]', sizeNode);
  shell.queryMap.set('[data-toolbar-item-key="line-height-select"]', lineHeightNode);
  shell.queryMap.set('[data-toolbar-item-key="format-bold"]', boldNode);
  shell.queryMap.set('[data-toolbar-item-key="format-italic"]', italicNode);
  shell.queryMap.set('[data-toolbar-item-key="paragraph-trigger"]', paragraphTriggerNode);
  shell.queryMap.set('[data-toolbar-item-key="list-type"]', listTriggerNode);
  shell.queryMap.set('[data-toolbar-item-key="history-undo"]', undoNode);
  shell.queryMap.set('[data-toolbar-item-key="history-redo"]', redoNode);
  root.queryMap.set('[data-toolbar-item-key="font-select"]', fontNode);
  root.queryMap.set('[data-toolbar-item-key="weight-select"]', weightNode);
  root.queryMap.set('[data-toolbar-item-key="size-select"]', sizeNode);
  root.queryMap.set('[data-toolbar-item-key="line-height-select"]', lineHeightNode);
  root.queryMap.set('[data-toolbar-item-key="format-bold"]', boldNode);
  root.queryMap.set('[data-toolbar-item-key="format-italic"]', italicNode);
  root.queryMap.set('[data-toolbar-item-key="paragraph-trigger"]', paragraphTriggerNode);
  root.queryMap.set('[data-toolbar-item-key="list-type"]', listTriggerNode);
  root.queryMap.set('[data-toolbar-item-key="history-undo"]', undoNode);
  root.queryMap.set('[data-toolbar-item-key="history-redo"]', redoNode);

  return {
    root,
    shell,
    controls,
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
    redoNode,
    paragraphMenu,
    listMenu,
    spacingMenu,
  };
}

function importRuntimeProjectionModule() {
  const modulePath = pathToFileURL(path.join(ROOT, 'src', 'renderer', 'toolbar', 'toolbarRuntimeProjection.mjs')).href;
  return import(modulePath);
}

test('toolbar runtime projection: registry is derived from the floating toolbar controls container only', async () => {
  const { createToolbarRuntimeRegistry } = await importRuntimeProjectionModule();
  const nodes = wireToolbarRegistry();
  const registry = createToolbarRuntimeRegistry(nodes.root);

  assert.equal(registry.toolbarRoot, nodes.root);
  assert.equal(registry.toolbarShell, nodes.shell);
  assert.equal(registry.controlsContainer, nodes.controls);
  assert.deepEqual(
    registry.groupDescriptors.map((group) => group.element.name),
    ['type-group', 'format-group', 'paragraph-group', 'history-group'],
  );
  assert.equal(nodes.root.calls.appendChild, 0);
  assert.equal(nodes.root.calls.insertBefore, 0);
  assert.equal(nodes.shell.calls.appendChild, 0);
  assert.equal(nodes.shell.calls.insertBefore, 0);
  assert.equal(nodes.controls.calls.appendChild, 0);
  assert.equal(nodes.controls.calls.insertBefore, 0);
});

test('toolbar runtime projection: active profile ids preserve profile order and drop duplicates safely', async () => {
  const { collectVisibleToolbarItemIdsFromState } = await importRuntimeProjectionModule();

  const ids = collectVisibleToolbarItemIdsFromState({
    activeToolbarProfile: 'master',
    toolbarProfiles: {
      minimal: ['toolbar.history.undo'],
      master: [
        'toolbar.history.redo',
        'toolbar.format.bold',
        'toolbar.format.bold',
        'toolbar.font.family',
        'toolbar.unknown.entry',
        'toolbar.format.italic',
      ],
    },
  });

  assert.deepEqual(ids, [
    'toolbar.history.redo',
    'toolbar.format.bold',
    'toolbar.font.family',
    'toolbar.format.italic',
  ]);
});

test('toolbar runtime projection: applyToolbarActiveProfile reorders visible items and groups within bounded containers', async () => {
  const { createToolbarRuntimeRegistry, applyToolbarActiveProfile } = await importRuntimeProjectionModule();
  const nodes = wireToolbarRegistry();
  const registry = createToolbarRuntimeRegistry(nodes.root);
  const snapshot = applyToolbarActiveProfile(registry, {
    activeToolbarProfile: 'master',
    toolbarProfiles: {
      minimal: ['toolbar.history.undo'],
      master: [
        'toolbar.history.redo',
        'toolbar.font.size',
        'toolbar.font.family',
        'toolbar.font.weight',
        'toolbar.format.italic',
        'toolbar.format.bold',
        'toolbar.paragraph.alignment',
        'toolbar.history.undo',
      ],
    },
  });

  assert.deepEqual(snapshot.visibleItemIds, [
    'toolbar.history.redo',
    'toolbar.history.undo',
    'toolbar.font.size',
    'toolbar.font.family',
    'toolbar.font.weight',
    'toolbar.format.italic',
    'toolbar.format.bold',
    'toolbar.paragraph.alignment',
  ]);
  assert.deepEqual(snapshot.visibleBindKeys, [
    'history-redo',
    'history-undo',
    'size-select',
    'font-select',
    'weight-select',
    'format-italic',
    'format-bold',
    'paragraph-trigger',
  ]);
  assert.deepEqual(snapshot.groupVisibleBindKeys, [
    ['history-redo', 'history-undo'],
    ['size-select', 'font-select', 'weight-select'],
    ['format-italic', 'format-bold'],
    ['paragraph-trigger'],
  ]);
  assert.equal(snapshot.hasVisibleItems, true);
  assert.equal(snapshot.anchorResyncRequired, true);
  assert.equal(nodes.controls.calls.insertBefore > 0, true);
  assert.equal(nodes.historyGroup.calls.insertBefore > 0, true);
  assert.equal(nodes.typeGroup.calls.insertBefore > 0, true);
  assert.equal(nodes.formatGroup.calls.insertBefore > 0, true);
  assert.equal(nodes.paragraphGroup.calls.insertBefore > 0, true);
  assert.deepEqual(nodes.controls.children.map((node) => node.name), [
    'history-group',
    'type-group',
    'format-group',
    'paragraph-group',
  ]);
  assert.deepEqual(nodes.historyGroup.children.filter((node) => node.hidden !== true).map((node) => node.name), ['redo-node', 'undo-node']);
  assert.deepEqual(nodes.typeGroup.children.filter((node) => node.hidden !== true).map((node) => node.name), ['size-node', 'font-node', 'weight-node']);
  assert.deepEqual(nodes.formatGroup.children.filter((node) => node.hidden !== true).map((node) => node.name), ['italic-node', 'bold-node']);
  assert.deepEqual(nodes.paragraphGroup.children.filter((node) => node.hidden !== true).map((node) => node.name), ['paragraph-trigger-node']);
  assert.equal(nodes.listTriggerNode.hidden, true);
  assert.equal(nodes.listMenu.hidden, true);
  assert.equal(nodes.spacingMenu.hidden, true);
});

test('toolbar runtime projection: minimal wrapper keeps minimal profile compatibility and active profile state out of the contract', async () => {
  const { createToolbarRuntimeRegistry, applyToolbarProfileMinimal } = await importRuntimeProjectionModule();
  const nodes = wireToolbarRegistry();
  const registry = createToolbarRuntimeRegistry(nodes.root);
  const snapshot = applyToolbarProfileMinimal(registry, {
    activeToolbarProfile: 'master',
    toolbarProfiles: {
      minimal: [
        'toolbar.history.undo',
        'toolbar.font.family',
      ],
      master: [
        'toolbar.format.bold',
        'toolbar.history.redo',
      ],
    },
  });

  assert.deepEqual(snapshot.visibleItemIds, [
    'toolbar.history.undo',
    'toolbar.font.family',
  ]);
  assert.deepEqual(snapshot.visibleBindKeys, [
    'history-undo',
    'font-select',
  ]);
  assert.deepEqual(snapshot.groupVisibleBindKeys, [
    ['history-undo'],
    ['font-select'],
    [],
    [],
  ]);
  assert.equal(nodes.historyGroup.hidden, false);
  assert.equal(nodes.typeGroup.hidden, false);
  assert.equal(nodes.formatGroup.hidden, true);
  assert.equal(nodes.paragraphGroup.hidden, true);
  assert.deepEqual(nodes.controls.children.map((node) => node.name), [
    'history-group',
    'type-group',
    'format-group',
    'paragraph-group',
  ]);
});
