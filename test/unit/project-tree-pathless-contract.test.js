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
  const asyncStart = source.indexOf(`async function ${functionName}`);
  const actualStart = start >= 0 ? start : asyncStart;
  assert.notEqual(actualStart, -1, `${functionName} must exist`);
  const next = nextFunctionName
    ? Math.max(source.indexOf(`function ${nextFunctionName}`, actualStart + 1), source.indexOf(`async function ${nextFunctionName}`, actualStart + 1))
    : -1;
  return source.slice(actualStart, next > actualStart ? next : source.length);
}

test('project tree public read model serializes stable IDs without file authority', () => {
  const main = read('src/main.js');
  const section = functionSection(main, 'serializeProjectTreeNode', 'buildProjectTreeRootsWithIdentities');

  assert.match(section, /id: nodeId/u);
  assert.match(section, /nodeId/u);
  assert.equal(/\bpath\s*:/u.test(section), false);
  assert.equal(/effectivePath/u.test(section), false);
  assert.match(main, /root: serializeProjectTreeNode\(roots\[tab\]\)/u);
});

test('project tree renderer emits project and node identity only for tree commands', () => {
  const editor = read('src/renderer/editor.js');
  const functionNames = [
    ['openDocumentNode', 'handleCreateNode'],
    ['handleCreateNode', 'handleRenameNode'],
    ['handleRenameNode', 'handleDeleteNode'],
    ['handleDeleteNode', 'handleMoveNode'],
    ['handleMoveNode', 'handleReorderNode'],
  ];

  for (const [name, next] of functionNames) {
    const section = functionSection(editor, name, next);
    if (name === 'handleCreateNode' || name === 'handleRenameNode') {
      assert.match(section, /const target = captureNodeNameTarget\(node\)/u);
      assert.match(section, /isNodeNameTargetCurrent\(target\)/u);
      assert.match(section, /projectId: target\.projectId/u);
    } else {
      assert.match(section, /projectId: currentProjectId/u);
    }
    assert.match(section, /nodeId|parentNodeId/u);
    assert.equal(/\bpath\s*:/u.test(section), false, `${name} must not emit a path`);
  }
  assert.match(editor, /currentDocumentId/u);
  assert.match(editor, /hasDocumentId/u);
  assert.match(editor, /currentDocumentId === effectiveDocumentId/u);
  const reorderSection = functionSection(editor, 'handleReorderNode', 'handleAddCardForNode');
  assert.match(reorderSection, /await handleMoveNode\(node, targetParentNodeId, targetIndex\)/u);
  assert.equal(/\bpath\s*:/u.test(reorderSection), false, 'handleReorderNode must not emit a path');
});

test('main owns node resolution and tree command results stay pathless', () => {
  const main = read('src/main.js');
  const openSection = functionSection(main, 'handleUiOpenDocumentCommand', 'normalizeLegacyUiBridgePayload');
  const renameSection = functionSection(main, 'handleUiRenameNodeCommand', 'handleUiDeleteNodeCommand');

  assert.match(openSection, /resolveProjectTreeNodeIdentity/u);
  assert.match(openSection, /resolveProjectTreeSceneIdentity/u);
  assert.match(openSection, /return \{ ok: true, documentId: resolvedNode\.nodeId \}/u);
  assert.equal(/sanitizePayloadWithinProjectRoot\(payload, \['path'\]\)/u.test(openSection), false);
  assert.match(renameSection, /resolveTreeCohortNode/u);
  assert.match(renameSection, /runTreeCohortIntent/u);
  const cohortResolver = functionSection(main, 'resolveTreeCohortNode', 'readTreeCohortPath');
  assert.match(cohortResolver, /binding\.manifest\.projectId !== projectId/u);
  assert.match(cohortResolver, /normalized\.value\.nodes\[nodeId\]/u);
  assert.match(cohortResolver, /joinPathSegmentsWithinRoot/u);
  assert.equal(/\bsafe(?:Payload)?\.path\b/u.test(renameSection), false);
});

test('main document open scene-id fallback is project-relative roman txt only', () => {
  const main = read('src/main.js');
  const normalizeSection = functionSection(main, 'normalizeProjectRelativeSceneId', 'resolveProjectTreeSceneIdentity');
  const resolverSection = functionSection(main, 'resolveProjectTreeSceneIdentity', 'getProjectDocumentIdentityPayload');

  assert.ok(normalizeSection.includes(".replace(/\\\\/g, '/')"));
  assert.match(normalizeSection, /normalized\.startsWith\('roman\/'\)/u);
  assert.match(normalizeSection, /normalized\.toLowerCase\(\)\.endsWith\('\.txt'\)/u);
  assert.match(normalizeSection, /segment === '\.\.'/u);
  assert.match(normalizeSection, /segment\.startsWith\('\.'\)/u);
  assert.match(resolverSection, /joinPathSegmentsWithinRoot\(projectRoot, normalizedSceneId\.split\('\/'\)/u);
  assert.match(resolverSection, /sanitizePathFieldsWithinRoot/u);
  assert.match(resolverSection, /upsertProjectTreeIdentityForPath\(pathGuard\.payload\.path, 'scene'\)/u);
  assert.equal(/\bsafePayload\.path\b/u.test(resolverSection), false);
});

test('active document channel exposes document identity without renderer path authority', () => {
  const main = read('src/main.js');
  const editor = read('src/renderer/editor.js');
  const sendSection = functionSection(main, 'sendEditorText', 'attachProjectIdToEditorPayload');
  const attachSection = functionSection(main, 'attachProjectIdToEditorPayload', 'sendEditorFontSize');
  const listenerStart = editor.indexOf('window.electronAPI.onEditorSetText((payload) => {');
  const listenerEnd = editor.indexOf('window.electronAPI.onEditorTextRequest', listenerStart);
  const listenerSection = editor.slice(listenerStart, listenerEnd);

  assert.match(sendSection, /documentId: typeof payload\.documentId/u);
  assert.equal(/path: typeof payload\.path/u.test(sendSection), false);
  assert.match(attachSection, /privateFilePath/u);
  assert.match(attachSection, /documentId: typeof source\.documentId/u);
  assert.equal(/path: typeof source\.path/u.test(attachSection), false);
  assert.notEqual(listenerStart, -1);
  assert.ok(listenerEnd > listenerStart);
  assert.match(listenerSection, /hasDocumentId/u);
  assert.equal(/hasPath|currentDocumentPath/u.test(listenerSection), false);
  assert.equal(/currentDocumentPath/u.test(editor), false);
});

const vm = require('node:vm');
function executableFunctions(names) {
  const source = read('src/renderer/editor.js');
  return names.map(name => {
    const match = new RegExp(`^(?:async )?function ${name}\\(`, 'mu').exec(source);
    assert.ok(match, name);
    const end = source.indexOf('\n}\n', match.index);
    assert.ok(end > match.index, name);
    return source.slice(match.index, end + 2);
  }).join('\n');
}
function sceneUiHarness() {
  const scene = { nodeId: 'scene', kind: 'scene', label: 'Original' };
  const calls = [];
  const c = {
    currentProjectId: 'project', treeRoot: scene,
    treeMutationProjection: { projectId: 'project', treeRevision: 7,
      lastMutation: { id: 'mutation', kind: 'copy', canUndo: true } },
    treeMutationPending: false, allowed: true, calls, reloads: 0, statuses: [],
    EXTRA_COMMAND_IDS: { TREE_COPY_NODE: 'copy', TREE_UNDO_LAST_MUTATION: 'undo' },
    getEffectiveDocumentId: n => n.nodeId,
    findTreeNodeById: (root, id) => root?.nodeId === id ? root : null,
    normalizeNodeName: v => ({ ok: typeof v === 'string' && Boolean(v.trim()) }),
    openNodeNameDialog: async () => 'Copy',
  };
  c.isNavigatorContextCommandAvailable = () => c.allowed;
  c.updateStatusText = text => c.statuses.push(text);
  c.dispatchUiCommand = async (id, payload) => { calls.push({ id, payload: JSON.parse(JSON.stringify(payload)) }); return { ok: true }; };
  c.loadTree = async () => { c.reloads++; };
  c.appendContextMenuCommandItem = (items, id, label, invoke, options) => items.push({ id, label, invoke, ...options });
  vm.createContext(c);
  vm.runInContext(executableFunctions(['captureNodeNameTarget', 'isNodeNameTargetCurrent',
    'captureTreeMutationProjection', 'handleCopyNode', 'handleUndoTreeMutation', 'appendTreeUndoMenuItem']), c);
  return c;
}

test('executed scene copy captures current project, identity and revision; cancellation and delayed changes write nothing', async () => {
  for (const change of ['cancel', 'project', 'tree', 'revision', 'capability', 'pending']) {
    const c = sceneUiHarness();
    c.openNodeNameDialog = async () => {
      if (change === 'project') c.currentProjectId = 'other';
      if (change === 'tree') c.treeRoot = { ...c.treeRoot, label: 'Changed' };
      if (change === 'revision') c.treeMutationProjection = { ...c.treeMutationProjection, treeRevision: 8 };
      if (change === 'capability') c.allowed = false;
      if (change === 'pending') c.treeMutationPending = true;
      return change === 'cancel' ? null : 'Copy';
    };
    await c.handleCopyNode(c.treeRoot);
    assert.equal(c.calls.length, 0, change);
    assert.equal(c.reloads, 0, change);
    assert.equal(c.statuses.length, change === 'cancel' ? 0 : 1, change);
  }
  const c = sceneUiHarness();
  await c.handleCopyNode(c.treeRoot);
  assert.deepEqual(c.calls, [{ id: 'copy', payload: { projectId: 'project', nodeId: 'scene', name: 'Copy', expectedTreeRevision: 7 } }]);
  assert.equal(c.reloads, 1);
  assert.equal(c.treeMutationPending, false);
});

test('executed tree Undo is explicit, projection-bound and disabled without current authority evidence', async () => {
  for (const mode of ['missing', 'stale-project', 'unavailable', 'capability', 'pending']) {
    const c = sceneUiHarness();
    if (mode === 'missing') c.treeMutationProjection = null;
    if (mode === 'stale-project') c.currentProjectId = 'other';
    if (mode === 'unavailable') c.treeMutationProjection.lastMutation.canUndo = false;
    if (mode === 'capability') c.allowed = false;
    if (mode === 'pending') c.treeMutationPending = true;
    await c.handleUndoTreeMutation();
    assert.equal(c.calls.length, 0, mode);
    const items = [];
    c.appendTreeUndoMenuItem(items);
    if (mode !== 'capability') assert.equal(items[0].enabled, false, mode);
  }
  const c = sceneUiHarness();
  await c.handleUndoTreeMutation();
  assert.deepEqual(c.calls, [{ id: 'undo', payload: { projectId: 'project', expectedTreeRevision: 7, mutationId: 'mutation' } }]);
  assert.equal(c.reloads, 1);
});

test('late copy or Undo completion never reloads a different project; failure keeps projection and releases pending state', async () => {
  for (const action of ['copy', 'undo']) {
    const c = sceneUiHarness();
    c.dispatchUiCommand = async () => { c.currentProjectId = 'other'; return { ok: true }; };
    await (action === 'copy' ? c.handleCopyNode(c.treeRoot) : c.handleUndoTreeMutation());
    assert.equal(c.reloads, 0);
    assert.equal(c.treeMutationPending, false);
    const f = sceneUiHarness();
    f.dispatchUiCommand = async () => ({ ok: false });
    await (action === 'copy' ? f.handleCopyNode(f.treeRoot) : f.handleUndoTreeMutation());
    assert.equal(f.reloads, 0);
    assert.equal(f.treeMutationPending, false);
    assert.equal(f.treeMutationProjection.treeRevision, 7);
  }
});

test('executed menu focuses enabled action and Escape restores trigger; text Undo remains separate', () => {
  const buttons = [];
  let focus = '';
  const trigger = { isConnected: true, focus: () => { focus = 'trigger'; } };
  const menu = { innerHTML: '', hidden: true, style: {}, appendChild: b => buttons.push(b),
    querySelector: () => buttons.find(b => !b.disabled) };
  const c = { contextMenu: menu, contextMenuReturnFocus: null,
    document: { activeElement: trigger, createElement: () => ({ dataset: {},
      focus: () => { focus = 'action'; }, addEventListener() {} }) } };
  vm.createContext(c);
  vm.runInContext(executableFunctions(['clearContextMenu', 'showContextMenu']), c);
  c.showContextMenu([{ label: 'Disabled', enabled: false }, { label: 'Copy', onInvoke() {} }], 10, 20, trigger);
  assert.equal(focus, 'action');
  let stopped = 0;
  menu.onkeydown({ key: 'Escape', preventDefault() { stopped++; }, stopPropagation() { stopped++; } });
  assert.equal(menu.hidden, true);
  assert.equal(focus, 'trigger');
  assert.equal(stopped, 2);
  const editor = read('src/renderer/editor.js');
  assert.match(editor, /event\.key === 'ContextMenu' \|\| \(event\.key === 'F10' && event\.shiftKey\)/u);
  assert.match(editor, /\(key === 'Z' \|\| key === 'z'\) && !event\.shiftKey\) \{\s*event\.preventDefault\(\);\s*void dispatchUiCommand\(EXTRA_COMMAND_IDS\.EDIT_UNDO\)/u);
  assert.equal(executableFunctions(['handleUndoTreeMutation']).includes('handleUndo('), false);
});

test('stale query completion cannot replace tree or mutation projection after project switch', async () => {
  let finish;
  const c = { currentProjectId: 'project', activeTab: 'roman', treeQueryGeneration: 0,
    treeRoot: { nodeId: 'existing' }, treeMutationProjection: { treeRevision: 7 },
    window: { electronAPI: { invokeWorkspaceQueryBridge() {} } },
    PROJECT_TREE_QUERY_ID: 'query.projectTree',
    invokeWorkspaceQueryBridge: () => new Promise(resolve => { finish = resolve; }),
    updateStatusText: () => assert.fail('stale query must not publish even an error') };
  vm.createContext(c);
  vm.runInContext(executableFunctions(['loadTree']), c);
  const pending = c.loadTree();
  c.currentProjectId = 'other';
  finish({ ok: true, projectId: 'project', root: { nodeId: 'stale' }, treeRevision: 9 });
  await pending;
  assert.equal(c.treeRoot.nodeId, 'existing');
  assert.equal(c.treeMutationProjection.treeRevision, 7);
});


test('Undo menu closure cannot target a newer mutation after projection refresh', async () => {
  const c = sceneUiHarness();
  const items = [];
  c.appendTreeUndoMenuItem(items);
  c.treeMutationProjection = { ...c.treeMutationProjection, treeRevision: 8,
    lastMutation: { id: 'new-mutation', kind: 'move', canUndo: true } };
  await items[0].invoke();
  assert.equal(c.calls.length, 0);
});


test('executed focused tree keyboard opens existing actions without intercepting text Undo', () => {
  const editor = read('src/renderer/editor.js');
  const start = editor.indexOf("if (treeContainer) {\n  treeContainer.addEventListener('keydown'");
  const end = editor.indexOf('\nlet spatialResizeDragState', start);
  assert.ok(start > 0 && end > start);
  let keydown;
  let opened = 0;
  class Element { closest() { return this; } }
  class HTMLElement extends Element { constructor() { super(); this.dataset = { navigatorRowId: 'scene' }; } getBoundingClientRect() { return { left: 10, bottom: 20 }; } }
  const row = new HTMLElement();
  const c = { Element, HTMLElement, treeRoot: {}, treeContainer: { addEventListener(type, listener) { if (type === 'keydown') keydown = listener; } },
    findTreeNodeById: () => ({ nodeId: 'scene' }), buildContextMenuItems: () => [{ label: 'Copy' }],
    showContextMenu(items, x, y, trigger) { assert.equal(trigger, row); assert.equal(x, 10); assert.equal(y, 20); opened++; },
    getVisibleNavigatorRowIds: () => [] };
  vm.createContext(c);
  vm.runInContext(editor.slice(start, end), c);
  for (const [key, shiftKey] of [['ContextMenu', false], ['F10', true]]) {
    let stopped = 0;
    keydown({ target: row, key, shiftKey, preventDefault() { stopped++; }, stopPropagation() { stopped++; } });
    assert.equal(stopped, 2);
  }
  assert.equal(opened, 2);
  keydown({ target: row, key: 'z', metaKey: true, preventDefault() { assert.fail('tree must not own text Undo'); } });
  assert.equal(opened, 2);
});


test('tree context publication preserves authoring and history and rejects stale or forged Main payloads', () => {
  const calls = [];
  const c = { currentProjectId: 'project', currentDocumentId: 'scene', currentDocumentKind: 'scene',
    currentDocumentTitle: 'Before', metaEnabled: true, localEditGeneration: 9,
    localDirty: true, lastAckedGeneration: 8, currentRightTab: 'history',
    composeDocumentContent: () => 'exact current authoring bytes',
    getActiveDocumentTitleStorageKey: id => id,
    localStorage: { setItem: (key, value) => calls.push(['title', key, value]) },
    updateInspectorSnapshot: () => calls.push('inspector'), refreshMetadataInspector: () => calls.push('metadata'),
    refreshManuscriptNoteReferences: () => calls.push('notes'), refreshVisibleCommentProjection: () => calls.push('comments'),
    refreshSceneHistory: () => calls.push('history'),
    setTiptapDocumentSnapshot: () => assert.fail('tree publication must not replace PM state'),
    setPlainText: () => assert.fail('tree publication must not replace text') };
  vm.createContext(c);
  vm.runInContext(executableFunctions(['applyTreeContextPublication']), c);
  const publication = { treePublication: true, projectId: 'project', documentId: 'scene', kind: 'scene',
    metaEnabled: true, expectedGeneration: 9, title: 'Renamed',
    expectedContent: 'exact current authoring bytes', content: 'exact current authoring bytes' };
  for (const override of [
    { projectId: 'other' }, { documentId: 'other' }, { kind: 'material' }, { metaEnabled: false },
    { expectedGeneration: 8 }, { expectedGeneration: '9' }, { content: 'modified' },
    { expectedContent: 'forged', content: 'forged' }, { title: '' },
  ]) {
    assert.equal(c.applyTreeContextPublication({ ...publication, ...override }), false);
    assert.equal(c.currentDocumentTitle, 'Before');
    assert.equal(calls.length, 0);
  }
  assert.equal(c.applyTreeContextPublication(publication), true);
  assert.equal(c.currentDocumentTitle, 'Renamed');
  assert.deepEqual(calls, [['title', 'project', 'Renamed'], 'inspector', 'metadata', 'notes', 'comments', 'history']);
  assert.equal(c.localDirty, true);
  assert.equal(c.localEditGeneration, 9);
  assert.equal(c.lastAckedGeneration, 8);
});


test('equivalent tree query refresh during name dialog preserves exact revision-bound target', async () => {
  const c = sceneUiHarness();
  c.openNodeNameDialog = async () => {
    c.treeRoot = { ...c.treeRoot };
    c.treeMutationProjection = { ...c.treeMutationProjection };
    return 'Copy';
  };
  await c.handleCopyNode(c.treeRoot);
  assert.equal(c.calls.length, 1);
  assert.equal(c.calls[0].payload.expectedTreeRevision, 7);
});


test('removed-copy replacement requires live old identity and bytes before ordinary editor replacement', () => {
  const c = { currentProjectId: 'project', currentDocumentId: 'copy', localEditGeneration: 9,
    composeDocumentContent: () => 'saved copied scene' };
  vm.createContext(c);
  vm.runInContext(executableFunctions(['isTreeReplacementCurrent']), c);
  const payload = { treeReplacement: true, projectId: 'project', expectedDocumentId: 'copy',
    documentId: 'source', kind: 'scene', metaEnabled: true, expectedGeneration: 9,
    expectedContent: 'saved copied scene', content: 'original source scene' };
  assert.equal(c.isTreeReplacementCurrent(payload), true);
  for (const override of [{ treePublication: true }, { projectId: 'other' }, { expectedDocumentId: 'other' },
    { documentId: 'copy' }, { documentId: '' }, { kind: 'external' }, { metaEnabled: false },
    { expectedGeneration: 8 }, { expectedGeneration: '9' }, { expectedContent: 'stale' }, { content: null }]) {
    assert.equal(c.isTreeReplacementCurrent({ ...payload, ...override }), false);
  }
  c.composeDocumentContent = () => 'new unsaved edit';
  assert.equal(c.isTreeReplacementCurrent(payload), false);
  const source = read('src/renderer/editor.js');
  const listener = source.slice(source.indexOf('window.electronAPI.onEditorSetText((payload) => {'));
  assert.ok(listener.indexOf('!isTreeReplacementCurrent(payload)') < listener.indexOf('setTiptapDocumentSnapshot({'));
});
