const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('selected scenes TXT export UI flow: renderer owns only transient picker and confirmation flow', () => {
  const editor = read('src/renderer/editor.js');

  for (const marker of [
    'const SELECTED_SCENES_TXT_EXPORT_SCOPE_QUERY_ID = WORKSPACE_QUERY_IDS.SELECTED_SCENES_TXT_EXPORT_SCOPE;',
    'const selectedScenesTxtExportModal = document.querySelector(\'[data-selected-scenes-txt-export-modal]\');',
    'function normalizeSelectedScenesTxtExportScope(scope)',
    'function getSelectedScenesTxtExportCheckedSceneIds()',
    'function updateSelectedScenesTxtExportModalState()',
    'function renderSelectedScenesTxtExportCandidateList(scope)',
    'function openSelectedScenesTxtExportModal(scope)',
    'async function confirmSelectedScenesTxtExportAndRun()',
    'async function openSelectedScenesTxtExportFlow()',
    'try {',
    "result = await invokeWorkspaceQueryBridge(SELECTED_SCENES_TXT_EXPORT_SCOPE_QUERY_ID, {});",
    "updateStatusText('Selected scenes TXT export unavailable');",
    'const result = await dispatchUiCommand(EXTRA_COMMAND_IDS.PROJECT_EXPORT_SELECTED_SCENES_TXT, {',
    'selectedSceneIds,',
    'if (commandId === EXTRA_COMMAND_IDS.PROJECT_EXPORT_SELECTED_SCENES_TXT) {',
    'openExportSurfaceModal(commandId);',
  ]) {
    assert.ok(editor.includes(marker), marker);
  }
  assert.equal(
    editor.includes("invokePreloadUiCommandBridge('cmd.project.exportSelectedScenesTxtV1'"),
    false,
  );
});

test('selected scenes TXT export UI flow: renderer does not treat tree row state as export truth', () => {
  const editor = read('src/renderer/editor.js');
  const start = editor.indexOf('async function openSelectedScenesTxtExportFlow()');
  const end = editor.indexOf('function getDocxImportPreviewPlanFromValue(value)', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const section = editor.slice(start, end);

  for (const forbidden of [
    'currentDocumentPath =',
    'treeRoot',
    'openDocumentNode(',
    'dispatchUiCommand(COMMAND_IDS.PROJECT_IMPORT_TXT_V1',
  ]) {
    assert.equal(section.includes(forbidden), false, forbidden);
  }
});

test('selected scenes TXT export UI flow: shipped bundle carries the transient selector surface', () => {
  const bundle = read('src/renderer/editor.bundle.js');
  const html = read('src/renderer/index.html');
  for (const marker of [
    'query.selectedScenesTxtExportScope',
    'cmd.project.exportSelectedScenesTxtV1',
    'Selected scenes TXT export ready',
    'Selected scenes TXT export cancelled',
    'Selected scenes TXT exported:',
  ]) {
    assert.ok(bundle.includes(marker), marker);
  }

  for (const marker of [
    'data-selected-scenes-txt-export-modal',
    'Selected Scenes TXT Export',
    'Выберите сцены для экспорта в один TXT файл.',
  ]) {
    assert.ok(html.includes(marker), marker);
  }
});


function txtPickerHost(query, dispatch = async () => ({ ok: true, value: { exported: true, sceneCount: 1 } })) {
  const vm = require('node:vm'), source = read('src/renderer/editor.js');
  const start = source.indexOf('let selectedScenesTxtExportRequestId =');
  const end = source.indexOf('function getDocxImportPreviewPlanFromValue(value)', start);
  assert.ok(start >= 0 && end > start);
  const statuses = [], calls = [], modal = { open: false };
  class Element {}
  class Input { constructor(value) { this.value = value; } }
  const list = new Element(); list.querySelectorAll = () => [new Input('roman/Imported/01 Scene.txt')];
  const context = vm.createContext({ HTMLElement: Element, HTMLInputElement: Input,
    selectedScenesTxtExportList: list, selectedScenesTxtExportModal: modal,
    selectedScenesTxtExportSummary: {}, selectedScenesTxtExportConfirmButtons: [],
    SELECTED_SCENES_TXT_EXPORT_SCOPE_QUERY_ID: 'query.selectedScenesTxtExportScope',
    EXTRA_COMMAND_IDS: { PROJECT_EXPORT_SELECTED_SCENES_TXT: 'cmd.project.exportSelectedScenesTxtV1' },
    invokeWorkspaceQueryBridge: query, getNavigatorSelectionDescriptor: () => ({ projectId: '', selectedIds: [] }),
    updateStatusText: text => statuses.push(text),
    openSimpleModal: () => { modal.open = true; }, closeSimpleModal: () => { modal.open = false; },
    dispatchUiCommand: async (command, payload) => { calls.push({ command, payload: JSON.parse(JSON.stringify(payload)) }); return dispatch(); },
  });
  vm.runInContext(source.slice(start, end), context);
  vm.runInContext('renderSelectedScenesTxtExportCandidateList = () => {};', context);
  const api = vm.runInContext('({ open: openSelectedScenesTxtExportFlow, confirm: confirmSelectedScenesTxtExportAndRun, close: closeSelectedScenesTxtExportModal, normalize: normalizeSelectedScenesTxtExportScope, requestId: () => selectedScenesTxtExportRequestId })', context);
  return { api, statuses, calls, modal };
}

function txtPickerScope(suffix = 'a') {
  return { ok: true, scope: { projectId: 'project-picker',
    requestId: 'selected-scenes-txt-' + suffix.repeat(36), defaultSceneIds: ['roman/Imported/01 Scene.txt'],
    sceneCandidates: [{ sceneId: 'roman/Imported/01 Scene.txt', nodeId: 'tree-node-' + 'a'.repeat(32), label: 'Scene' }] } };
}

test('selected TXT picker echoes the issued Main request once and keeps only confirmed scene intent', async () => {
  const scope = txtPickerScope(), h = txtPickerHost(async () => scope);
  await h.api.open(); assert.equal(h.modal.open, true);
  assert.equal(h.api.requestId(), scope.scope.requestId);
  await h.api.confirm();
  assert.equal(h.modal.open, false); assert.equal(h.api.requestId(), '');
  assert.deepEqual(h.calls, [{ command: 'cmd.project.exportSelectedScenesTxtV1', payload: {
    confirmed: true, requestId: scope.scope.requestId, selectedSceneIds: ['roman/Imported/01 Scene.txt'],
  } }]);
  await h.api.confirm(); assert.equal(h.calls.length, 1);
});

test('selected TXT picker refuses missing Main continuation and clears it on cancel', async () => {
  const invalid = txtPickerScope(); delete invalid.scope.requestId;
  const h = txtPickerHost(async () => invalid);
  await h.api.open(); assert.equal(h.modal.open, false);
  await h.api.confirm(); assert.equal(h.calls.length, 0);
  const valid = txtPickerScope('b'), other = txtPickerHost(async () => valid);
  await other.api.open(); other.api.close();
  assert.equal(other.api.requestId(), ''); assert.equal(other.modal.open, false);
  await other.api.confirm(); assert.equal(other.calls.length, 0);
});

test('selected TXT picker discards older asynchronous query and a query cancelled while pending', async () => {
  const resolvers = [], h = txtPickerHost(() => new Promise(resolve => resolvers.push(resolve)));
  const first = h.api.open(), second = h.api.open();
  resolvers[1](txtPickerScope('b')); await second;
  resolvers[0](txtPickerScope('a')); await first;
  assert.equal(h.api.requestId(), txtPickerScope('b').scope.requestId);
  await h.api.confirm(); assert.equal(h.calls[0].payload.requestId, txtPickerScope('b').scope.requestId);
  const cancelled = h.api.open(); h.api.close();
  resolvers[2](txtPickerScope('c')); await cancelled;
  assert.equal(h.modal.open, false); assert.equal(h.api.requestId(), '');
  await h.api.confirm(); assert.equal(h.calls.length, 1);
});

test('selected TXT picker does not publish an older command result into a newer picker', async () => {
  let finish;
  const h = txtPickerHost(async () => txtPickerScope(), () => new Promise(resolve => { finish = resolve; }));
  await h.api.open(); const old = h.api.confirm();
  await h.api.open(); const before = [...h.statuses];
  finish({ ok: true, value: { exported: true, sceneCount: 1 } }); await old;
  assert.deepEqual(h.statuses, before); assert.equal(h.modal.open, true);
});
