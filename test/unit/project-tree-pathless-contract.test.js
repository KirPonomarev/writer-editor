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
    currentDocumentId: 'scene', currentTreeContentPublicationId: '', localEditGeneration: 9,
    isTiptapMode: true, flowModeState: { active: false }, wordCommentDraft: null, wordCommentBusy: false,
    manuscriptDrafts: new Map(), notesMutationPending: false,
    composeDocumentContent: () => 'live rich buffer', getTiptapRootSplitBoundary: () => ({ boundaryRootIndex: 1, position: 8 }),
    treeMutationProjection: { projectId: 'project', treeRevision: 7,
      lastMutation: { id: 'mutation', kind: 'copy', canUndo: true } },
    treeMutationPending: false, allowed: true, calls, reloads: 0, statuses: [],
    EXTRA_COMMAND_IDS: { TREE_COPY_NODE: 'copy', TREE_UNDO_LAST_MUTATION: 'undo', TREE_SPLIT_SCENE: 'split', TREE_MERGE_NEXT_SCENE: 'merge' },
    getEffectiveDocumentId: n => n?.nodeId || '',
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
    'captureTreeMutationProjection', 'handleCopyNode', 'handleUndoTreeMutation', 'appendTreeUndoMenuItem',
    'findNextTreeScene', 'treeContentUnavailableReason', 'captureTreeContentTarget',
    'isTreeContentTargetCurrent', 'handleTreeContentMutation']), c);
  return c;
}

test('actual name dialog submit reaches create, rename and copy handlers with Cyrillic input', async () => {
  for (const action of ['create', 'rename', 'copy']) {
    for (const submit of ['button', 'enter']) {
      const c = sceneUiHarness(), nodes = [];
      class Element {
        constructor(tag) { this.tag = tag; this.style = {}; this.events = {}; this.isConnected = true; nodes.push(this); }
        setAttribute() {}
        removeAttribute() {}
        append() {}
        addEventListener(type, handler) { this.events[type] = handler; }
        focus() { c.document.activeElement = this; }
        select() {}
        showModal() { this.open = true; }
        close() { this.open = false; this.events.close?.(); }
        remove() { this.isConnected = false; }
      }
      c.document = { createElement: tag => new Element(tag), body: new Element('body'), activeElement: new Element('button') };
      c.EXTRA_COMMAND_IDS.TREE_CREATE_NODE = 'create'; c.EXTRA_COMMAND_IDS.TREE_RENAME_NODE = 'rename';
      vm.runInContext(read('src/renderer/linkDialog.mjs').replace(/export /gu, ''), c);
      vm.runInContext(executableFunctions(['handleCreateNode', 'handleRenameNode']), c);
      const pending = action === 'create' ? c.handleCreateNode(c.treeRoot, 'scene', 'Новая сцена')
        : action === 'rename' ? c.handleRenameNode(c.treeRoot) : c.handleCopyNode(c.treeRoot);
      const input = nodes.find(n => n.tag === 'input');
      input.value = 'Альфа';
      if (submit === 'enter') input.events.keydown({ key: 'Enter', isComposing: false, preventDefault() {} });
      else nodes.find(n => n.tag === 'button' && n.className?.includes('--primary')).events.click();
      await pending;
      assert.equal(c.calls.length, 1, `${action} ${submit}`);
      assert.equal(c.calls[0].id, action);
      assert.equal(c.calls[0].payload.name, 'Альфа');
      assert.equal(c.reloads, 1);
      assert.equal(c.statuses.length, 0);
    }
  }
});

test('command error reveals only existing product status and survives background save until next command', async () => {
  const status = { textContent: 'Готово', style: {} };
  const siblings = [{ style: {} }, { style: {} }];
  const parent = { style: { visibility: 'hidden' }, children: [status, ...siblings] };
  status.parentElement = parent;
  const c = { statusElement: status, heldCommandStatusMessage: false, succeeded: false,
    runCommand() {}, COMMAND_BUS_ROUTE: 'command.bus', withEditorModeCommandPayload: p => p,
    mapCommandErrorToUi: () => ({ userMessage: 'Переименование не выполнено', severity: 'WARN' }),
    runCommandThroughBus: async () => c.succeeded ? { ok: true } : { ok: false, error: {} } };
  vm.createContext(c);
  vm.runInContext(executableFunctions(['updateStatusText', 'dispatchUiCommand']), c);
  await c.dispatchUiCommand('rename');
  assert.equal(status.style.visibility, 'visible');
  assert.equal(status.textContent, 'Переименование не выполнено');
  c.updateStatusText('Автосохранено');
  assert.equal(status.textContent, 'Переименование не выполнено');
  assert.equal(status.style.visibility, 'visible');
  assert.equal(parent.style.visibility, 'hidden');
  assert.deepEqual(siblings.map(n => n.style), [{}, {}]);
  c.succeeded = true;
  await c.dispatchUiCommand('rename');
  assert.equal(status.style.visibility, '');
  assert.equal(c.heldCommandStatusMessage, false);
  c.updateStatusText('Готово');
  assert.equal(status.textContent, 'Готово');
});

test('real tree command refusal preserves typed Main conflict in public status and diagnostic code', async () => {
  const { pathToFileURL } = require('node:url');
  const commands = await import(pathToFileURL(path.join(ROOT, 'src/renderer/commands/projectCommands.mjs')).href);
  const bridge = require('../../src/shared/commandBridgeResponse.cjs');
  const handlers = new Map(), logs = [];
  let response = bridge.makeCommandBridgeFailure('E_TREE_UNDO_CAS', { ok: false, reason: 'E_TREE_UNDO_CAS' });
  commands.registerProjectCommands({ registerCommand(meta, handler) { handlers.set(meta.id, handler); } }, {
    electronAPI: { invokeUiCommandBridge() {
      return response;
    } },
  });
  const c = { statusElement: { textContent: '', style: {} }, heldCommandStatusMessage: false,
    COMMAND_BUS_ROUTE: 'command.bus', UI_ERROR_FALLBACK_SEVERITY: 'ERROR',
    uiErrorMap: { index: new Map(), defaultUserMessage: 'GENERIC_FAILURE' },
    withEditorModeCommandPayload: p => p, runCommand: (id, p) => handlers.get(id)(p),
    runCommandThroughBus: (runner, id, p) => runner(id, p), console: { error: x => logs.push(x) } };
  vm.createContext(c);
  vm.runInContext(executableFunctions(['updateStatusText', 'mapCommandErrorToUi', 'dispatchUiCommand']), c);
  const result = await c.dispatchUiCommand(commands.EXTRA_COMMAND_IDS.TREE_UNDO_LAST_MUTATION,
    { projectId: 'project', expectedTreeRevision: 5, mutationId: 'mutation' });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'E_TREE_UNDO_CAS');
  assert.equal(result.error.reason, 'E_TREE_UNDO_CAS');
  assert.equal(c.statusElement.style.visibility, 'visible');
  assert.notEqual(c.statusElement.textContent, 'GENERIC_FAILURE');
  assert.match(c.statusElement.textContent, /отмен|Отмен/u);
  assert.match(logs[0], /code=E_TREE_UNDO_CAS/u);
  for (const invalid of [null, 'invalid', {}, { ok: false, reason: 'free text with spaces' }]) {
    response = invalid;
    const refused = await c.dispatchUiCommand(commands.EXTRA_COMMAND_IDS.TREE_COPY_NODE,
      { projectId: 'project', expectedTreeRevision: 5, nodeId: 'scene', name: 'Copy' });
    assert.equal(refused.ok, false);
    assert.equal(refused.error.code, 'E_COMMAND_FAILED');
    assert.match(c.statusElement.textContent, /копии/u);
  }
  response = bridge.makeCommandBridgeFailure('E_TREE_COHORT_PUBLICATION_STALE',
    { ok: false, reason: 'E_TREE_COHORT_PUBLICATION_STALE', committed: true });
  await c.dispatchUiCommand(commands.EXTRA_COMMAND_IDS.TREE_UNDO_LAST_MUTATION,
    { projectId: 'project', expectedTreeRevision: 5, mutationId: 'mutation' });
  assert.match(c.statusElement.textContent, /Структура изменена/u);
  response = bridge.makeCommandBridgeFailure('E_TREE_REVISION_CAS', { ok: false, reason: 'E_TREE_REVISION_CAS' });
  const move = await c.dispatchUiCommand(commands.EXTRA_COMMAND_IDS.TREE_MOVE_NODE,
    { projectId: 'project', nodeId: 'scene', targetParentNodeId: 'chapter', targetIndex: 0, expectedTreeRevision: 5 });
  assert.equal(move.ok, false);
  assert.equal(move.error.code, 'E_TREE_REVISION_CAS');
  assert.equal(move.error.reason, 'E_TREE_REVISION_CAS');
  assert.match(c.statusElement.textContent, /перемещ/u);
  assert.match(logs.at(-1), /code=E_TREE_REVISION_CAS/u);
});

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

test('tree dragover accepts protected-mode type while drop alone reads and validates node intent', () => {
  const source = read('src/renderer/editor.js');
  const start = source.indexOf("  row.addEventListener('dragstart', (event) => {");
  const end = source.indexOf('\n  li.appendChild(row);', start);
  assert.ok(start > 0 && end > start);
  const handlers = new Map(), moves = [], logs = [];
  const dragged = { nodeId: 'source', kind: 'scene' };
  const c = { row: { addEventListener: (type, handler) => handlers.set(type, handler) },
    effectiveDocumentId: 'chapter', activeTab: 'roman', node: { kind: 'chapter-folder' },
    parentNodeId: 'part', siblingIndex: 1, treeRoot: {},
    isNavigatorMovableNode: () => true,
    findTreeNodeById: (root, id) => id === 'source' ? dragged : null,
    handleMoveNode: (...args) => moves.push(args), console: { info: message => logs.push(message) } };
  vm.createContext(c);
  vm.runInContext(source.slice(start, end), c);
  let startPrevented = 0;
  handlers.get('dragstart')({ preventDefault() { startPrevented++; } });
  assert.equal(startPrevented, 1);
  assert.match(logs.at(-1), /phase=start outcome=blocked reason=NO_DATA_TRANSFER/u);
  const stored = [];
  const startTransfer = { setData: (...args) => stored.push(args) };
  c.activeTab = 'notes';
  handlers.get('dragstart')({ dataTransfer: startTransfer, preventDefault() { startPrevented++; } });
  assert.equal(stored.length, 0);
  assert.match(logs.at(-1), /roman=false/u);
  c.activeTab = 'roman';
  handlers.get('dragstart')({ dataTransfer: startTransfer, preventDefault() { assert.fail('eligible start'); } });
  assert.equal(stored.length, 3);
  assert.equal(startTransfer.effectAllowed, 'move');
  assert.equal(logs.at(-1), 'TREE_DRAG phase=start outcome=accepted');
  const beforeHover = logs.length;
  let prevented = 0, reads = 0;
  const transfer = { types: ['application/x-yalken-tree-node-id'],
    getData() { reads++; return ''; }, dropEffect: 'none' };
  handlers.get('dragover')({ dataTransfer: transfer, preventDefault() { prevented++; } });
  assert.equal(prevented, 1, 'HTML protected-mode hover must allow the subsequent drop');
  assert.equal(reads, 0, 'dragover has formats only, never payload authority');
  assert.equal(transfer.dropEffect, 'move');
  assert.equal(logs.length, beforeHover, 'hover produces no diagnostic spam');
  for (const types of [[], ['text/plain'], ['Files']]) {
    handlers.get('dragover')({ dataTransfer: { ...transfer, types }, preventDefault() { assert.fail('foreign format'); } });
  }
  c.activeTab = 'notes';
  handlers.get('dragover')({ dataTransfer: transfer, preventDefault() { assert.fail('wrong workspace'); } });
  c.activeTab = 'roman';
  for (const id of ['', 'missing', 'chapter']) {
    handlers.get('drop')({ dataTransfer: { getData: () => id }, preventDefault() {} });
    assert.equal(moves.length, 0);
  }
  handlers.get('drop')({ dataTransfer: { types: ['application/x-yalken-tree-node-id'], getData: type => ({
    'application/x-yalken-tree-node-id': 'source',
    'application/x-yalken-tree-parent-node-id': 'other-chapter',
    'application/x-yalken-tree-sibling-index': '0',
  })[type] || '' }, preventDefault() {} });
  assert.equal(moves.length, 1);
  assert.equal(moves[0][0], dragged);
  assert.deepEqual(moves[0].slice(1), ['chapter', 0]);
  assert.equal(logs.at(-2), 'TREE_DRAG phase=drop formatPresent=true');
  assert.equal(logs.at(-1), 'TREE_DRAG phase=drop outcome=intent-dispatched');
  handlers.get('dragend')({ dataTransfer: { dropEffect: 'none' } });
  assert.equal(logs.at(-1), 'TREE_DRAG phase=end effect=none');
  assert.ok(logs.every(message => !message.includes('other-chapter') && !message.includes('nodeId')));
});


test('tree context publication preserves authoring and history and rejects stale or forged Main payloads', () => {
  const calls = [];
  const c = { currentProjectId: 'project', currentDocumentId: 'scene', currentDocumentKind: 'scene',
    currentDocumentTitle: 'Before', metaEnabled: true, localEditGeneration: 9,
    localDirty: true, lastAckedGeneration: 8, currentRightTab: 'history',
    composeDocumentContent: () => 'exact current authoring bytes',
    getActiveDocumentTitleStorageKey: id => id,
    localStorage: { setItem: (key, value) => calls.push(['title', key, value]) },
    syncVisibleAuthoringSurfacesSurface: () => calls.push(['surface-title', c.currentDocumentTitle]),
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
  assert.deepEqual(calls, [['title', 'project', 'Renamed'], ['surface-title', 'Renamed'], 'inspector', 'metadata', 'notes', 'comments', 'history']);
  assert.equal(c.localDirty, true);
  assert.equal(c.localEditGeneration, 9);
  assert.equal(c.lastAckedGeneration, 8);
});

test('committed copy Undo detaches only exact late working buffer and preserves text history and dirty generation', () => {
  const calls = [];
  const c = { currentProjectId: 'project', currentDocumentId: 'copy', currentDocumentKind: 'scene',
    currentDocumentTitle: 'Copy', metaEnabled: true, localEditGeneration: 12, localDirty: true,
    lastAckedGeneration: 11, currentRightTab: 'history', composeDocumentContent: () => 'late unsaved text',
    syncVisibleAuthoringSurfacesSurface: () => calls.push(['surface-title', c.currentDocumentTitle]),
    updateInspectorSnapshot: () => calls.push('inspector'), refreshMetadataInspector: () => calls.push('metadata'),
    refreshManuscriptNoteReferences: () => calls.push('notes'), refreshVisibleCommentProjection: () => calls.push('comments'),
    refreshSceneHistory: () => calls.push('history'), updateStatusText: () => calls.push('status'),
    setTiptapDocumentSnapshot: () => assert.fail('must retain PM document and history'),
    setPlainText: () => assert.fail('must retain live text') };
  vm.createContext(c);
  vm.runInContext(executableFunctions(['applyTreeDetachedPublication']), c);
  const payload = { treeDetached: true, projectId: 'project', expectedDocumentId: 'copy', documentId: '',
    expectedGeneration: 12, expectedContent: 'late unsaved text', title: 'Несохранённая восстановленная копия' };
  for (const override of [{ projectId: 'other' }, { expectedDocumentId: 'source' }, { documentId: 'source' },
    { expectedGeneration: 11 }, { expectedGeneration: '12' }, { expectedContent: 'old text' },
    { treePublication: true }, { treeReplacement: true }, { title: '' }]) {
    assert.equal(c.applyTreeDetachedPublication({ ...payload, ...override }), false);
    assert.equal(c.currentDocumentId, 'copy');
    assert.equal(c.currentDocumentTitle, 'Copy');
    assert.equal(calls.length, 0);
  }
  assert.equal(c.applyTreeDetachedPublication(payload), true);
  assert.equal(c.currentDocumentId, '');
  assert.equal(c.currentDocumentTitle, payload.title);
  assert.equal(c.currentDocumentKind, 'scene');
  assert.equal(c.metaEnabled, true);
  assert.equal(c.localDirty, true);
  assert.equal(c.localEditGeneration, 12);
  assert.equal(c.lastAckedGeneration, 11);
  assert.deepEqual(calls, [['surface-title', payload.title], 'inspector', 'metadata', 'notes', 'comments', 'history', 'status']);
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
    wordCommentDraft: null, wordCommentBusy: false, manuscriptDrafts: new Map(), notesMutationPending: false,
    composeDocumentContent: () => 'saved copied scene' };
  vm.createContext(c);
  vm.runInContext(executableFunctions(['treeReplacementRefusalReason', 'isTreeReplacementCurrent']), c);
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

test('actual replacement listener preserves late drafts or stale generation and accepts an exact idle replacement', () => {
  const source = read('src/renderer/editor.js');
  const start = source.indexOf('window.electronAPI.onEditorSetText((payload) => {');
  const end = source.indexOf('  window.electronAPI.onEditorTextRequest(', start);
  for (const [route, state] of [
    ...['stale-generation', 'idle', 'comment-draft', 'comment-busy', 'note-draft', 'note-busy'].map(state => ['normal', state]),
    ...['stale-generation', 'idle', 'comment-draft', 'comment-busy', 'note-draft', 'note-busy',
      'wrong-project', 'wrong-origin', 'stale-content', 'missing-recovery-flag', 'missing-private-origin'].map(state => ['detached', state]),
  ]) {
    const expectedGeneration = state === 'stale-generation' ? 0 : 9;
    let listener, working = 'copied live content';
    const detached = route === 'detached';
    const events = [], warnings = [];
    const c = { currentProjectId: 'project', currentDocumentId: 'copy', currentDocumentKind: 'scene',
      treeDetachedOrigin: null, currentDocumentTitle: 'Beta', localEditGeneration: 9, lastAckedGeneration: 9, localDirty: false,
      wordCommentDraft: state === 'comment-draft' ? { body: 'unsaved comment' } : null,
      wordCommentBusy: state === 'comment-busy',
      manuscriptDrafts: new Map(state === 'note-draft' ? [['note', { body: 'unsaved note' }]] : []),
      notesMutationPending: state === 'note-busy',
      metaEnabled: true, isTiptapMode: true, activeDocumentRevealRequested: false, currentRightTab: 'metadata',
      window: { electronAPI: { onEditorSetText: handler => { listener = handler; } } },
      console: { warn: value => warnings.push(value) }, composeDocumentContent: () => working,
      updateStatusText: (value, options) => events.push(['status', value, options?.visible]),
      isProjectTreeDocumentId: id => Boolean(id), normalizeProjectId: id => id,
      parseDocumentContent: content => ({ doc: { type: 'doc', content: [] }, text: content, meta: {}, cards: [] }),
      shouldUseCentralSheetLargePayloadFastPath: () => false,
      setTiptapDocumentSnapshot: snapshot => { working = snapshot.text; events.push(['replace', snapshot.text]); },
      reviewSurfaceResolveIncomingPayload: () => ({}), revealActiveDocumentAncestors: () => ({ found: true }),
      editorPanel: null, mainContent: null, emptyState: null,
      localStorage: { setItem: (key, value) => events.push(['stored-title', value]) },
      getActiveDocumentTitleStorageKey: () => 'title',
      showAuthoringSurfacesSurface: () => events.push(['surface-title', c.currentDocumentTitle]),
      requestAnimationFrame() {},
    };
    for (const name of ['cancelLinkDialog', 'clearFlowModeState', 'clearPendingMetadataUpdate', 'applyIncomingBookProfile',
      'setReviewSurfaceState', 'clearCentralSheetLargePayloadFastPath', 'resetCentralSheetStripForIncomingPayload',
      'updateMetaInputs', 'updateMetaVisibility', 'updateCardsList', 'updateWordCount', 'scheduleCentralSheetStripProofRefresh',
      'hideManualMapPlanWorkspace', 'hideNotesWorkspace', 'hideProjectSearchWorkspace', 'hideWriterHomeSurface',
      'syncVisibleAuthoringSurfacesSurface', 'renderTree', 'updateSaveStateText', 'refreshManuscriptNoteReferences', 'refreshVisibleCommentProjection',
      'updatePerfHintText', 'updateInspectorSnapshot', 'refreshMetadataInspector', 'applyPendingProjectSearchJump']) c[name] = () => {};
    c.setReviewSurfaceState = () => events.push(['review-replaced']);
    const priorComment = c.wordCommentDraft, priorNote = c.manuscriptDrafts.get('note');
    vm.createContext(c);
    vm.runInContext(executableFunctions(['treeReplacementRefusalReason', 'isTreeReplacementCurrent', 'applyTreeDetachedPublication', 'showEditorPanelFor'])
      + '\n' + source.slice(start, end), c);
    if (detached) {
      listener({ treeDetached: true, projectId: 'project', expectedDocumentId: 'copy', documentId: '',
        title: 'Recovery', expectedGeneration: 9, expectedContent: working });
      assert.equal(c.currentDocumentId, '');
      assert.equal(working, 'copied live content');
      assert.equal(c.treeDetachedOrigin.documentId, 'copy');
      if (state === 'missing-private-origin') c.treeDetachedOrigin = null;
    }
    listener({ treeReplacement: true, treeRecovery: detached && state !== 'missing-recovery-flag',
      projectId: state === 'wrong-project' ? 'other' : 'project',
      expectedDocumentId: state === 'wrong-origin' ? 'other' : 'copy', documentId: 'source',
      kind: 'scene', metaEnabled: true, title: 'Alpha', expectedGeneration,
      expectedContent: state === 'stale-content' ? 'stale' : 'copied live content', content: 'original source content' });
    if (state !== 'idle') {
      assert.equal(working, 'copied live content');
      assert.equal(c.currentDocumentId, detached ? '' : 'copy');
      assert.equal(c.currentDocumentTitle, detached ? 'Recovery' : 'Beta');
      const reason = ({ 'wrong-project': 'PROJECT_MISMATCH', 'wrong-origin': 'SOURCE_DOCUMENT_MISMATCH',
        'stale-content': 'CONTENT_MISMATCH', 'missing-recovery-flag': 'SOURCE_DOCUMENT_MISMATCH',
        'missing-private-origin': 'SOURCE_DOCUMENT_MISMATCH' })[state];
      if (reason) assert.ok(warnings[0].includes(`reason=${reason}`));
      else assert.match(warnings[0], state === 'stale-generation'
        ? /reason=GENERATION_MISMATCH expectedGeneration=0 actualGeneration=9/u
        : /reason=AUTHORING_DRAFT_PENDING expectedGeneration=9 actualGeneration=9/u);
      assert.equal(warnings[0].includes('copied live content'), false);
      assert.equal(events.at(-1)[2], true);
      assert.equal(c.wordCommentDraft, priorComment);
      assert.equal(c.manuscriptDrafts.get('note'), priorNote);
      assert.equal(c.wordCommentBusy, state === 'comment-busy');
      assert.equal(c.notesMutationPending, state === 'note-busy');
      assert.equal(events.some(event => event[0] === 'replace' || event[0] === 'review-replaced'), false);
    } else {
      assert.equal(working, 'original source content');
      assert.equal(c.currentDocumentId, 'source');
      assert.equal(c.currentDocumentTitle, 'Alpha');
      assert.equal(c.treeDetachedOrigin, null);
      assert.ok(events.some(x => x[0] === 'surface-title' && x[1] === 'Alpha'));
      assert.equal(warnings.length, 0);
      assert.equal(c.localEditGeneration, 9);
    }
  }
});

test('existing editor snapshot response observes the current project and document alongside its exact buffer generation', () => {
  const responses = [], c = { currentProjectId: 'project', currentDocumentId: 'copy', localEditGeneration: 9,
    currentTreeContentPublicationId: 'observed-publication',
    composeDocumentContent: () => 'exact live copy', getPlainText: () => 'live copy',
    getActiveBookProfile: () => ({ format: 'A4' }), getSelectionOffsets: () => ({ start: 1, end: 2 }),
    isTiptapMode: false, wordCommentDraft: null, wordCommentBusy: false, manuscriptDrafts: new Map(), notesMutationPending: false,
    window: { electronAPI: { onEditorSnapshotRequest(handler) { c.respond = handler; },
      sendEditorSnapshotResponse(requestId, snapshot) { responses.push({ requestId, snapshot }); } } } };
  vm.createContext(c);
  vm.runInContext(executableFunctions(['composeEditorSnapshot']), c);
  const source = read('src/renderer/editor.js');
  const start = source.indexOf("  if (typeof window.electronAPI.onEditorSnapshotRequest === 'function') {");
  const end = source.indexOf('\n  window.electronAPI.onEditorSetFontSize(', start);
  assert.ok(start > 0 && end > start);
  vm.runInContext(source.slice(start, end), c);
  c.respond({ requestId: 'capture-copy' });
  assert.equal(responses[0].requestId, 'capture-copy');
  assert.equal(responses[0].snapshot.projectId, 'project');
  assert.equal(responses[0].snapshot.documentId, 'copy');
  assert.equal(responses[0].snapshot.content, 'exact live copy');
  assert.equal(responses[0].snapshot.generation, 9);
  assert.equal(responses[0].snapshot.treeContentPublicationId, 'observed-publication');
  assert.equal(responses[0].snapshot.rootSplitBoundary, null);
  c.isTiptapMode = true;
  c.getTiptapImageInsertionPosition = () => 7;
  c.getTiptapRootSplitBoundary = () => ({ boundaryRootIndex: 1, position: 7 });
  c.currentDocumentId = 'source';
  c.respond({ requestId: 'capture-source' });
  assert.equal(responses[1].snapshot.documentId, 'source');
  assert.deepEqual(JSON.parse(JSON.stringify(responses[1].snapshot.rootSplitBoundary)), { boundaryRootIndex: 1, position: 7 });
  c.currentProjectId = null; c.currentDocumentId = null;
  c.respond({ requestId: 'capture-unbound' });
  assert.equal(responses[2].snapshot.projectId, '');
  assert.equal(responses[2].snapshot.documentId, '');
  assert.equal(c.localEditGeneration, 9);
});

function sceneMoveHarness() {
  const c = sceneUiHarness(), scene = c.treeRoot;
  c.scene = scene;
  c.treeRoot = { nodeId: 'roman', kind: 'roman-root', children: [
    { nodeId: 'old', kind: 'chapter-folder', label: 'Исходная', children: [scene] },
    { nodeId: 'part', kind: 'part', label: 'Часть', children: [
      { nodeId: 'destination', kind: 'chapter-folder', label: 'Перенос', children: [] },
    ] },
  ] };
  c.EXTRA_COMMAND_IDS.TREE_MOVE_NODE = 'move';
  vm.runInContext(executableFunctions(['findTreeNodeById', 'collectSceneMoveDestinations',
    'handleChooseSceneMove', 'buildContextMenuItems']), c);
  const nodes = [];
  class Element {
    constructor(tag) { this.tag = tag; this.style = {}; this.events = {}; this.children = []; this.isConnected = true; nodes.push(this); }
    setAttribute() {}
    removeAttribute() {}
    select() {}
    append(...children) { this.children.push(...children); }
    addEventListener(type, fn) { this.events[type] = fn; }
    focus() { c.document.activeElement = this; }
    showModal() { this.open = true; }
    close() { this.open = false; this.events.close?.(); }
    remove() { this.isConnected = false; }
  }
  c.document = { createElement: tag => new Element(tag), body: new Element('body'), activeElement: new Element('button') };
  c.trigger = c.document.activeElement; c.nodes = nodes;
  vm.runInContext(read('src/renderer/linkDialog.mjs').replace(/export /gu, ''), c);
  return c;
}

test('actual move menu and native select reach the registered existing bridge with node-only revision-bound intent', async () => {
  const { pathToFileURL } = require('node:url');
  const commands = await import(pathToFileURL(path.join(ROOT, 'src/renderer/commands/projectCommands.mjs')).href);
  for (const confirmation of ['button', 'keyboard']) {
    const c = sceneMoveHarness(), handlers = new Map(), calls = [];
    c.EXTRA_COMMAND_IDS = commands.EXTRA_COMMAND_IDS;
    commands.registerProjectCommands({ registerCommand(meta, fn) { handlers.set(meta.id, fn); } }, {
      electronAPI: { invokeUiCommandBridge(...args) { calls.push(JSON.parse(JSON.stringify(args))); return { ok: true }; } },
    });
    c.dispatchUiCommand = (id, payload) => handlers.get(id)(payload);
    const item = c.buildContextMenuItems(c.scene).find(item => item.label === 'Переместить…');
    assert.equal(item.id, commands.EXTRA_COMMAND_IDS.TREE_MOVE_NODE);
    assert.equal(item.enabled, true);
    const pending = item.invoke();
    const select = c.nodes.find(node => node.tag === 'select');
    assert.deepEqual(select.children.map(option => [option.value, option.textContent]), [['destination', 'Часть › Перенос']]);
    assert.equal(c.document.activeElement, select);
    if (confirmation === 'keyboard') select.events.keydown({ key: 'Enter', preventDefault() {} });
    else c.nodes.find(node => node.textContent === 'Переместить в начало').events.click();
    await pending;
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], [{ route: 'command.bus', commandId: commands.EXTRA_COMMAND_IDS.TREE_MOVE_NODE, payload: {
      projectId: 'project', nodeId: 'scene', targetParentNodeId: 'destination', targetIndex: 0, expectedTreeRevision: 7,
    } }]);
    assert.equal(c.reloads, 1);
    assert.equal(c.document.activeElement, c.trigger);
    assert.equal(c.treeMutationPending, false);
    assert.equal(c.isLinkDialogOpen(), false);
  }
});

test('move dialog cancellation and stale source, project, revision, target or capability never dispatch', async () => {
  const cases = {
    cancel: c => c.nodes.find(n => n.textContent === 'Отмена').events.click(),
    escape: c => c.nodes.find(n => n.tag === 'dialog').events.cancel({ preventDefault() {} }),
    close: c => c.nodes.find(n => n.tag === 'dialog').close(),
    externalCancel: c => c.cancelLinkDialog(),
    project: c => { c.currentProjectId = 'other'; },
    revision: c => { c.treeMutationProjection.treeRevision++; },
    projectionProject: c => { c.treeMutationProjection.projectId = 'other'; },
    missingSource: c => { c.treeRoot.children[0].children = []; },
    missingTarget: c => { c.treeRoot.children[1].children = []; },
    targetKind: c => { c.treeRoot.children[1].children[0].kind = 'scene'; },
    denied: c => { c.allowed = false; },
    pending: c => { c.treeMutationPending = true; },
  };
  for (const [name, mutate] of Object.entries(cases)) {
    const c = sceneMoveHarness();
    const pending = c.handleChooseSceneMove(c.scene);
    mutate(c);
    c.nodes.find(n => n.textContent === 'Переместить в начало').events.click();
    await pending;
    assert.equal(c.calls.length, 0, name);
    assert.equal(c.reloads, 0, name);
    assert.equal(c.isLinkDialogOpen(), false, name);
  }
  for (const mutate of [c => { c.treeRoot.children.pop(); }, c => { c.allowed = false; }, c => { c.treeMutationPending = true; }]) {
    const c = sceneMoveHarness(); mutate(c);
    await c.handleChooseSceneMove(c.scene);
    assert.equal(c.nodes.some(n => n.tag === 'dialog'), false);
    assert.equal(c.calls.length, 0);
  }
});

test('move selection cannot submit an injected choice and equivalent same-revision refresh remains usable', async () => {
  const c = sceneMoveHarness();
  const pending = c.handleChooseSceneMove(c.scene);
  const select = c.nodes.find(n => n.tag === 'select');
  select.value = 'forged';
  c.nodes.find(n => n.textContent === 'Переместить в начало').events.click();
  assert.equal(c.isLinkDialogOpen(), true);
  assert.equal(c.calls.length, 0);
  assert.equal(await c.openNodeMoveDialog({ destinations: [{ nodeId: 'other', label: 'Other' }] }), null);
  c.treeRoot = JSON.parse(JSON.stringify(c.treeRoot));
  select.value = 'destination';
  c.nodes.find(n => n.textContent === 'Переместить в начало').events.click();
  await pending;
  assert.equal(c.calls.length, 1);
  assert.equal(c.reloads, 1);
});

function sceneContentHarness() {
  const c = sceneMoveHarness();
  c.scene.parentNodeId = 'old';
  c.treeRoot.children[0].children.push({ nodeId: 'right', parentNodeId: 'old', kind: 'scene', label: 'Правая' });
  c.boundary = { boundaryRootIndex: 1, position: 8 };
  c.getTiptapRootSplitBoundary = () => c.boundary;
  return c;
}

test('real split name dialog and merge menu use the registered generic bridge with only bounded identity intent', async () => {
  const { pathToFileURL } = require('node:url');
  const commands = await import(pathToFileURL(path.join(ROOT, 'src/renderer/commands/projectCommands.mjs')).href);
  for (const split of [true, false]) {
    const c = sceneContentHarness(), handlers = new Map(), calls = [];
    c.EXTRA_COMMAND_IDS = commands.EXTRA_COMMAND_IDS;
    commands.registerProjectCommands({ registerCommand(meta, fn) { handlers.set(meta.id, fn); } }, {
      electronAPI: { invokeUiCommandBridge: async value => { calls.push(JSON.parse(JSON.stringify(value))); return { ok: true, value: { ok: true } }; } },
    });
    c.dispatchUiCommand = (id, payload) => handlers.get(id)(payload);
    const commandId = split ? commands.EXTRA_COMMAND_IDS.TREE_SPLIT_SCENE : commands.EXTRA_COMMAND_IDS.TREE_MERGE_NEXT_SCENE;
    const item = c.buildContextMenuItems(c.scene).find(x => x.id === commandId);
    assert.equal(item.enabled, true);
    const pending = item.invoke();
    if (split) {
      const input = c.nodes.find(n => n.tag === 'input'); input.value = 'Правая сцена';
      input.events.keydown({ key: 'Enter', preventDefault() {} });
    }
    await pending;
    assert.deepEqual(calls, [{ route: 'command.bus', commandId, payload: {
      projectId: 'project', nodeId: 'scene', expectedTreeRevision: 7, expectedDocumentId: 'scene', expectedGeneration: 9,
      expectedTreeContentPublicationId: '', ...(split ? { name: 'Правая сцена', boundaryRootIndex: 1 } : {}),
    } }]);
    assert.equal(c.reloads, 1); assert.equal(c.treeMutationPending, false);
    assert.equal(c.isLinkDialogOpen(), false);
  }
});

test('split dialog cancellation and changed root selection, epoch, authoring or tree state never dispatch', async () => {
  const changes = {
    cancel: c => c.nodes.find(n => n.textContent === 'Отмена').events.click(),
    project: c => { c.currentProjectId = 'other'; },
    node: c => { c.currentDocumentId = 'right'; },
    tree: c => { c.treeMutationProjection.treeRevision++; },
    generation: c => { c.localEditGeneration++; },
    epoch: c => { c.currentTreeContentPublicationId = 'other'; },
    bytes: c => { c.composeDocumentContent = () => 'changed'; },
    rootIndex: c => { c.boundary = { boundaryRootIndex: 2, position: 8 }; },
    position: c => { c.boundary = { boundaryRootIndex: 1, position: 9 }; },
    rangeOrNested: c => { c.boundary = null; },
    comment: c => { c.wordCommentDraft = {}; },
    note: c => { c.manuscriptDrafts.set('note', {}); },
    pending: c => { c.treeMutationPending = true; },
    capability: c => { c.allowed = false; },
  };
  for (const [name, mutate] of Object.entries(changes)) {
    const c = sceneContentHarness(), pending = c.handleTreeContentMutation(c.scene, true);
    mutate(c);
    c.nodes.find(n => n.textContent === 'Разделить').events.click();
    await pending;
    assert.equal(c.calls.length, 0, name); assert.equal(c.reloads, 0, name);
    assert.equal(c.isLinkDialogOpen(), false, name);
  }
  const c = sceneContentHarness(); c.boundary = null;
  const item = c.buildContextMenuItems(c.scene).find(x => x.id === 'split');
  assert.equal(item.enabled, false); assert.match(item.label, /курсор.*начале/u);
  await c.handleTreeContentMutation(c.scene, true);
  assert.equal(c.nodes.some(n => n.tag === 'dialog'), false);
  assert.equal(c.calls.length, 0);
  c.treeRoot.children[0].children.pop();
  const merge = c.buildContextMenuItems(c.scene).find(x => x.id === 'merge');
  assert.equal(merge.enabled, false); assert.match(merge.label, /нет следующей/u);
});

test('registered split and merge reject malformed observation and preserve typed Main refusal', async () => {
  const commands = await import(require('node:url').pathToFileURL(path.join(ROOT, 'src/renderer/commands/projectCommands.mjs')).href);
  const handlers = new Map(), calls = [];
  commands.registerProjectCommands({ registerCommand(meta, fn) { handlers.set(meta.id, fn); } }, {
    electronAPI: { invokeUiCommandBridge: async value => { calls.push(value); return { ok: true, value: { ok: false, reason: 'E_TREE_PARTITION_RANGE_CROSSES' } }; } },
  });
  const payload = { projectId: 'project', nodeId: 'scene', expectedDocumentId: 'scene', expectedGeneration: 9,
    expectedTreeRevision: 7, expectedTreeContentPublicationId: '', boundaryRootIndex: 1, name: 'Right' };
  const handler = handlers.get(commands.EXTRA_COMMAND_IDS.TREE_SPLIT_SCENE);
  for (const override of [{ expectedDocumentId: 'other' }, { expectedGeneration: -1 }, { expectedGeneration: '9' },
    { expectedTreeRevision: null }, { expectedTreeContentPublicationId: null }, { boundaryRootIndex: 0 }, { boundaryRootIndex: 1.5 }]) {
    assert.equal((await handler({ ...payload, ...override })).ok, false);
  }
  assert.equal(calls.length, 0);
  const result = await handler(payload);
  assert.equal(result.ok, false); assert.equal(result.error.code, 'E_TREE_PARTITION_RANGE_CROSSES');
  assert.match(result.error.details.userMessage, /разделить/u);
  const policy = await import(require('node:url').pathToFileURL(path.join(ROOT, 'src/renderer/commands/capabilityPolicy.mjs')).href);
  for (const id of [commands.EXTRA_COMMAND_IDS.TREE_SPLIT_SCENE, commands.EXTRA_COMMAND_IDS.TREE_MERGE_NEXT_SCENE]) {
    assert.equal(policy.enforceCapabilityForCommand(id, {}, { defaultPlatformId: 'node' }).ok, true);
    for (const platform of ['web', 'mobile']) assert.equal(policy.enforceCapabilityForCommand(id, {}, { defaultPlatformId: platform }).ok, false);
  }
});

test('whole editor listener accepts same-ID partition only after checked replacement and retains declined buffer, history and drafts', () => {
  const source = read('src/renderer/editor.js');
  const start = source.indexOf('window.electronAPI.onEditorSetText((payload) => {');
  const end = source.indexOf('  window.electronAPI.onEditorTextRequest(', start);
  for (const mode of ['same-id', 'changed-id-recovery', 'project', 'document', 'generation', 'epoch', 'target-epoch',
    'content', 'comment', 'comment-busy', 'note', 'note-busy', 'flow', 'mixed-flags', 'invalid-document', 'adapter-refused']) {
    let listener, working = 'before rich buffer', history = ['prior text edit'];
    const effects = [], statuses = [];
    const c = { currentProjectId: 'project', currentDocumentId: 'scene', currentDocumentKind: 'scene',
      currentDocumentTitle: 'Before', currentTreeContentPublicationId: 'prior', treeDetachedOrigin: null,
      localEditGeneration: 9, lastAckedGeneration: 8, localDirty: true, metaEnabled: true,
      wordCommentDraft: mode === 'comment' ? { body: 'draft' } : null, wordCommentBusy: mode === 'comment-busy',
      manuscriptDrafts: new Map(mode === 'note' ? [['note', { body: 'draft' }]] : []), notesMutationPending: mode === 'note-busy',
      isTiptapMode: true, flowModeState: { active: mode === 'flow' }, activeDocumentRevealRequested: false, currentRightTab: 'metadata',
      window: { electronAPI: { onEditorSetText: fn => { listener = fn; } } }, console: { warn() {} },
      composeDocumentContent: () => working, updateStatusText: value => statuses.push(value),
      parseDocumentContent: content => ({ doc: { type: 'doc', content: [] }, text: content, meta: { marker: 'target' }, cards: [], issue: mode === 'invalid-document' ? {} : null }),
      replaceTiptapTreeDocumentSnapshot: () => {
        if (mode === 'adapter-refused') return false;
        assert.equal(c.currentTreeContentPublicationId, 'prior');
        effects.push('replace-and-reset'); working = 'target rich buffer'; history = []; return true;
      },
      setTiptapDocumentSnapshot: () => assert.fail('must not replace twice after checked tree replacement'),
      isProjectTreeDocumentId: id => Boolean(id), normalizeProjectId: id => id,
      shouldUseCentralSheetLargePayloadFastPath: () => false, reviewSurfaceResolveIncomingPayload: () => ({}),
      revealActiveDocumentAncestors: () => ({ found: true }), editorPanel: null, mainContent: null, emptyState: null,
      localStorage: { setItem() {} }, getActiveDocumentTitleStorageKey: () => 'title', requestAnimationFrame() {},
    };
    for (const name of ['cancelLinkDialog', 'clearFlowModeState', 'clearPendingMetadataUpdate', 'applyIncomingBookProfile',
      'setReviewSurfaceState', 'clearCentralSheetLargePayloadFastPath', 'resetCentralSheetStripForIncomingPayload',
      'updateMetaInputs', 'updateMetaVisibility', 'updateCardsList', 'updateWordCount', 'scheduleCentralSheetStripProofRefresh',
      'hideManualMapPlanWorkspace', 'hideNotesWorkspace', 'hideProjectSearchWorkspace', 'hideWriterHomeSurface',
      'showAuthoringSurfacesSurface', 'renderTree', 'updateSaveStateText', 'refreshManuscriptNoteReferences', 'refreshVisibleCommentProjection',
      'updatePerfHintText', 'updateInspectorSnapshot', 'refreshMetadataInspector', 'applyPendingProjectSearchJump']) c[name] = () => {};
    vm.createContext(c);
    vm.runInContext(executableFunctions(['treeContentReplacementRefusalReason', 'showEditorPanelFor']) + '\n' + source.slice(start, end), c);
    const overrides = { project: { projectId: 'foreign' }, document: { expectedDocumentId: 'wrong' }, generation: { expectedGeneration: 8 },
      epoch: { expectedTreeContentPublicationId: 'wrong' }, 'target-epoch': { treeContentPublicationId: 'prior' },
      content: { expectedContent: 'stale' }, 'mixed-flags': { treePublication: true } };
    const comment = c.wordCommentDraft, note = c.manuscriptDrafts.get('note');
    listener({ treeContentReplacement: true, projectId: 'project', expectedDocumentId: 'scene',
      documentId: mode === 'changed-id-recovery' ? 'recovered' : 'scene', kind: 'scene', metaEnabled: true,
      title: 'After', expectedGeneration: 9, expectedTreeContentPublicationId: 'prior', treeContentPublicationId: 'next',
      expectedContent: 'before rich buffer', content: 'target rich buffer', ...overrides[mode] });
    if (mode === 'same-id' || mode === 'changed-id-recovery') {
      assert.deepEqual(effects, ['replace-and-reset']); assert.equal(working, 'target rich buffer');
      assert.deepEqual(history, []); assert.equal(c.currentDocumentTitle, 'After');
      assert.equal(c.currentDocumentId, mode === 'same-id' ? 'scene' : 'recovered');
      assert.equal(c.currentTreeContentPublicationId, 'next'); assert.equal(c.localDirty, false);
      assert.equal(c.lastAckedGeneration, 9); assert.equal(c.currentMeta.marker, 'target');
    } else {
      assert.deepEqual(effects, [], mode); assert.equal(working, 'before rich buffer', mode);
      assert.deepEqual(history, ['prior text edit'], mode); assert.equal(c.currentDocumentTitle, 'Before', mode);
      assert.equal(c.currentDocumentId, 'scene', mode); assert.equal(c.currentTreeContentPublicationId, 'prior', mode);
      assert.equal(c.localDirty, true, mode); assert.equal(c.lastAckedGeneration, 8, mode);
      assert.equal(c.wordCommentDraft, comment); assert.equal(c.manuscriptDrafts.get('note'), note);
      assert.equal(statuses.length, 1, mode);
    }
  }
});
