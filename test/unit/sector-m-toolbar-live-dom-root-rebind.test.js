const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');
const GROUP_SELECTOR = '.floating-toolbar__group';
const ITEM_SELECTOR = '[data-toolbar-item-key], [data-bind-key], [data-toolbar-bind-key]';

function createToolbarDocument() {
  return {
    currentToolbarRoot: null,
    querySelector(selector) {
      if (selector === '[data-toolbar]') {
        return this.currentToolbarRoot;
      }
      return null;
    },
  };
}

function createNode(name, options = {}) {
  return {
    name,
    hidden: Boolean(options.hidden),
    isConnected: options.isConnected !== false,
    dataset: { ...(options.dataset || {}) },
    className: options.className || '',
    children: [],
    parentNode: null,
    parentElement: null,
    ownerDocument: options.ownerDocument || null,
    calls: {
      appendChild: 0,
      insertBefore: 0,
    },
    queryMap: new Map(Object.entries(options.queryMap || {})),
    setAttribute(attributeName, value) {
      this[attributeName] = String(value);
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
      if (!child.ownerDocument) {
        child.ownerDocument = this.ownerDocument || null;
      }
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
  if (!child.ownerDocument) {
    child.ownerDocument = parent.ownerDocument || null;
  }
  return child;
}

function setTreeConnection(node, isConnected) {
  if (!node || typeof node !== 'object') return;
  node.isConnected = isConnected;
  for (const child of node.children || []) {
    setTreeConnection(child, isConnected);
  }
}

function wireToolbarRegistry(documentLike) {
  const root = createNode('toolbar-root', { ownerDocument: documentLike });
  const shell = createNode('toolbar-shell', { ownerDocument: documentLike });
  const controls = createNode('toolbar-controls', {
    className: 'floating-toolbar__controls',
    ownerDocument: documentLike,
  });

  const typeGroup = createNode('type-group', {
    className: 'floating-toolbar__group floating-toolbar__group--type',
    ownerDocument: documentLike,
  });
  const formatGroup = createNode('format-group', {
    className: 'floating-toolbar__group floating-toolbar__group--format-inline',
    ownerDocument: documentLike,
  });
  const paragraphGroup = createNode('paragraph-group', {
    className: 'floating-toolbar__group floating-toolbar__group--paragraph',
    ownerDocument: documentLike,
  });
  const historyGroup = createNode('history-group', {
    className: 'floating-toolbar__group floating-toolbar__group--history',
    ownerDocument: documentLike,
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
    ownerDocument: documentLike,
  });
  const weightNode = createNode('weight-node', {
    dataset: { toolbarItemKey: 'weight-select' },
    hidden: true,
    ownerDocument: documentLike,
  });
  const sizeNode = createNode('size-node', {
    dataset: { toolbarItemKey: 'size-select' },
    hidden: true,
    ownerDocument: documentLike,
  });
  const lineHeightNode = createNode('line-height-node', {
    dataset: { toolbarItemKey: 'line-height-select' },
    hidden: true,
    ownerDocument: documentLike,
  });
  const boldNode = createNode('bold-node', {
    dataset: { toolbarItemKey: 'format-bold' },
    hidden: true,
    ownerDocument: documentLike,
  });
  const italicNode = createNode('italic-node', {
    dataset: { toolbarItemKey: 'format-italic' },
    hidden: true,
    ownerDocument: documentLike,
  });
  const paragraphTriggerNode = createNode('paragraph-trigger-node', {
    dataset: { toolbarItemKey: 'paragraph-trigger' },
    hidden: true,
    ownerDocument: documentLike,
  });
  const listTriggerNode = createNode('list-trigger-node', {
    dataset: { toolbarItemKey: 'list-type' },
    hidden: true,
    ownerDocument: documentLike,
  });
  const undoNode = createNode('undo-node', {
    dataset: { toolbarItemKey: 'history-undo' },
    hidden: true,
    ownerDocument: documentLike,
  });
  const redoNode = createNode('redo-node', {
    dataset: { toolbarItemKey: 'history-redo' },
    hidden: true,
    ownerDocument: documentLike,
  });

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
  root.queryMap = new Map(shell.queryMap);
  root.queryMap.set('[data-toolbar-shell]', shell);
  root.queryMap.set('.floating-toolbar__shell', shell);
  root.queryMap.set('.floating-toolbar__controls', controls);

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
  };
}

function importRuntimeProjectionModule() {
  const modulePath = pathToFileURL(path.join(ROOT, 'src', 'renderer', 'toolbar', 'toolbarRuntimeProjection.mjs')).href;
  return import(modulePath);
}

function getVisibleNodeNames(group) {
  return group.children.filter((node) => node.hidden !== true).map((node) => node.name);
}

function createProfileState(masterIds) {
  return {
    activeToolbarProfile: 'master',
    toolbarProfiles: {
      minimal: ['toolbar.history.undo'],
      master: masterIds,
    },
  };
}

test('sector-m toolbar live dom root rebind: projection rebinds to the current toolbar root before mutation', async () => {
  const { createToolbarRuntimeRegistry, applyToolbarActiveProfile } = await importRuntimeProjectionModule();
  const documentLike = createToolbarDocument();
  const rootA = wireToolbarRegistry(documentLike);
  documentLike.currentToolbarRoot = rootA.root;

  const registry = createToolbarRuntimeRegistry(rootA.root);
  applyToolbarActiveProfile(registry, createProfileState([
    'toolbar.history.redo',
    'toolbar.font.size',
    'toolbar.font.family',
    'toolbar.format.bold',
  ]));

  const rootAVisibleOrderBefore = getVisibleNodeNames(rootA.historyGroup);
  const rootAGroupOrderBefore = rootA.controls.children.map((node) => node.name);
  const rootAInsertBeforeCount = rootA.controls.calls.insertBefore;

  const rootB = wireToolbarRegistry(documentLike);
  documentLike.currentToolbarRoot = rootB.root;
  setTreeConnection(rootA.root, false);

  const snapshot = applyToolbarActiveProfile(registry, createProfileState([
    'toolbar.format.italic',
    'toolbar.history.undo',
    'toolbar.font.family',
  ]));

  assert.equal(snapshot.failClosed, false);
  assert.equal(snapshot.registry.toolbarRoot, rootB.root);
  assert.equal(snapshot.registry.controlsContainer, rootB.controls);
  assert.deepEqual(snapshot.visibleBindKeys, [
    'format-italic',
    'history-undo',
    'font-select',
  ]);
  assert.deepEqual(getVisibleNodeNames(rootB.formatGroup), ['italic-node']);
  assert.deepEqual(getVisibleNodeNames(rootB.historyGroup), ['undo-node']);
  assert.deepEqual(getVisibleNodeNames(rootB.typeGroup), ['font-node']);
  assert.deepEqual(getVisibleNodeNames(rootA.historyGroup), rootAVisibleOrderBefore);
  assert.deepEqual(rootA.controls.children.map((node) => node.name), rootAGroupOrderBefore);
  assert.equal(rootA.controls.calls.insertBefore, rootAInsertBeforeCount);
});

test('sector-m toolbar live dom root rebind: connected stale root is ignored when owner document exposes a newer toolbar root', async () => {
  const { createToolbarRuntimeRegistry, applyToolbarActiveProfile } = await importRuntimeProjectionModule();
  const documentLike = createToolbarDocument();
  const rootA = wireToolbarRegistry(documentLike);
  const rootB = wireToolbarRegistry(documentLike);
  documentLike.currentToolbarRoot = rootA.root;

  const registry = createToolbarRuntimeRegistry(rootA.root);
  applyToolbarActiveProfile(registry, createProfileState([
    'toolbar.history.redo',
    'toolbar.font.family',
  ]));

  const rootAVisibleOrderBefore = getVisibleNodeNames(rootA.historyGroup);
  const rootAGroupOrderBefore = rootA.controls.children.map((node) => node.name);
  const rootAInsertBeforeCount = rootA.controls.calls.insertBefore;

  documentLike.currentToolbarRoot = rootB.root;

  const snapshot = applyToolbarActiveProfile(registry, createProfileState([
    'toolbar.format.italic',
    'toolbar.history.undo',
    'toolbar.font.family',
  ]));

  assert.equal(snapshot.failClosed, false);
  assert.equal(snapshot.registry.toolbarRoot, rootB.root);
  assert.equal(snapshot.registry.controlsContainer, rootB.controls);
  assert.deepEqual(snapshot.visibleBindKeys, [
    'format-italic',
    'history-undo',
    'font-select',
  ]);
  assert.deepEqual(getVisibleNodeNames(rootB.formatGroup), ['italic-node']);
  assert.deepEqual(getVisibleNodeNames(rootB.historyGroup), ['undo-node']);
  assert.deepEqual(getVisibleNodeNames(rootB.typeGroup), ['font-node']);
  assert.deepEqual(getVisibleNodeNames(rootA.historyGroup), rootAVisibleOrderBefore);
  assert.deepEqual(rootA.controls.children.map((node) => node.name), rootAGroupOrderBefore);
  assert.equal(rootA.controls.calls.insertBefore, rootAInsertBeforeCount);
});

test('sector-m toolbar live dom root rebind: detached root path fails closed without mutating stale nodes', async () => {
  const { createToolbarRuntimeRegistry, applyToolbarActiveProfile } = await importRuntimeProjectionModule();
  const documentLike = createToolbarDocument();
  const rootA = wireToolbarRegistry(documentLike);
  documentLike.currentToolbarRoot = rootA.root;

  const registry = createToolbarRuntimeRegistry(rootA.root);
  applyToolbarActiveProfile(registry, createProfileState([
    'toolbar.history.redo',
    'toolbar.font.family',
    'toolbar.format.bold',
  ]));

  const rootAVisibleOrderBefore = getVisibleNodeNames(rootA.historyGroup);
  const rootAGroupOrderBefore = rootA.controls.children.map((node) => node.name);
  const rootAInsertBeforeCount = rootA.controls.calls.insertBefore;

  documentLike.currentToolbarRoot = null;
  setTreeConnection(rootA.root, false);

  const snapshot = applyToolbarActiveProfile(registry, createProfileState([
    'toolbar.format.italic',
    'toolbar.history.undo',
  ]));

  assert.equal(snapshot.failClosed, true);
  assert.equal(snapshot.failClosedReason, 'stale-root');
  assert.equal(snapshot.hasVisibleItems, false);
  assert.deepEqual(snapshot.visibleItemIds, []);
  assert.deepEqual(getVisibleNodeNames(rootA.historyGroup), rootAVisibleOrderBefore);
  assert.deepEqual(rootA.controls.children.map((node) => node.name), rootAGroupOrderBefore);
  assert.equal(rootA.controls.calls.insertBefore, rootAInsertBeforeCount);
});
