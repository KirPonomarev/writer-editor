const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const ROOT = path.resolve(__dirname, '..', '..')

function read(filePath) {
  return fs.readFileSync(path.join(ROOT, filePath), 'utf8')
}

async function loadProjectCommands() {
  return import(pathToFileURL(path.join(ROOT, 'src', 'renderer', 'commands', 'projectCommands.mjs')).href)
}

async function loadCapabilityPolicy() {
  return import(pathToFileURL(path.join(ROOT, 'src', 'renderer', 'commands', 'capabilityPolicy.mjs')).href)
}

function readBindingDoc() {
  return JSON.parse(read('docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json'))
}

function createCaptureRegistry() {
  const handlers = new Map()
  return {
    registry: {
      registerCommand(meta, handler) {
        handlers.set(meta.id, { meta, handler })
      },
    },
    handlers,
  }
}

function assertBridgeCall(call, expectedCommandId, expectedPayload) {
  assert.deepEqual(call, {
    route: 'command.bus',
    commandId: expectedCommandId,
    payload: expectedPayload,
  })
}

test('command kernel tree-document adoption: projectCommands defines and registers five stable command ids', async () => {
  const projectCommandsSource = read('src/renderer/commands/projectCommands.mjs')
  const commandEffectSource = read('src/renderer/commands/commandEffectModel.mjs')
  const projectCommands = await loadProjectCommands()

  assert.equal(projectCommands.EXTRA_COMMAND_IDS.PROJECT_DOCUMENT_OPEN, 'cmd.project.document.open')
  assert.equal(projectCommands.EXTRA_COMMAND_IDS.TREE_CREATE_NODE, 'cmd.project.tree.createNode')
  assert.equal(projectCommands.EXTRA_COMMAND_IDS.TREE_RENAME_NODE, 'cmd.project.tree.renameNode')
  assert.equal(projectCommands.EXTRA_COMMAND_IDS.TREE_DELETE_NODE, 'cmd.project.tree.deleteNode')
  assert.equal(projectCommands.EXTRA_COMMAND_IDS.TREE_REORDER_NODE, 'cmd.project.tree.reorderNode')

  assert.ok(projectCommandsSource.includes('id: EXTRA_COMMAND_IDS.PROJECT_DOCUMENT_OPEN,'))
  assert.ok(projectCommandsSource.includes('id: EXTRA_COMMAND_IDS.TREE_CREATE_NODE,'))
  assert.ok(projectCommandsSource.includes('id: EXTRA_COMMAND_IDS.TREE_RENAME_NODE,'))
  assert.ok(projectCommandsSource.includes('id: EXTRA_COMMAND_IDS.TREE_DELETE_NODE,'))
  assert.ok(projectCommandsSource.includes('id: EXTRA_COMMAND_IDS.TREE_REORDER_NODE,'))

  assert.equal(projectCommandsSource.includes('electronAPI.openDocument('), false)
  assert.equal(projectCommandsSource.includes('electronAPI.createNode('), false)
  assert.equal(projectCommandsSource.includes('electronAPI.renameNode('), false)
  assert.equal(projectCommandsSource.includes('electronAPI.deleteNode('), false)
  assert.equal(projectCommandsSource.includes('electronAPI.reorderNode('), false)

  assert.ok(projectCommandsSource.includes('invokeBridgeOnlyCommand('))
  assert.ok(projectCommandsSource.includes("effectType: 'electron-bridge-only',"))
  assert.ok(commandEffectSource.includes('electronAPI.invokeUiCommandBridge({'))
  assert.ok(commandEffectSource.includes('route: plan.route,'))
  assert.ok(commandEffectSource.includes('commandId: plan.commandId,'))
  assert.ok(commandEffectSource.includes('payload: plan.payload,'))
  assert.ok(projectCommandsSource.includes('EXTRA_COMMAND_IDS.PROJECT_DOCUMENT_OPEN,'))
  assert.ok(projectCommandsSource.includes('{ path, title, kind },'))
  assert.ok(projectCommandsSource.includes('EXTRA_COMMAND_IDS.TREE_CREATE_NODE,'))
  assert.ok(projectCommandsSource.includes('{ parentPath, kind, name },'))
  assert.ok(projectCommandsSource.includes('EXTRA_COMMAND_IDS.TREE_RENAME_NODE,'))
  assert.ok(projectCommandsSource.includes('{ path, name },'))
  assert.ok(projectCommandsSource.includes('EXTRA_COMMAND_IDS.TREE_DELETE_NODE,'))
  assert.ok(projectCommandsSource.includes('{ path },'))
  assert.ok(projectCommandsSource.includes('EXTRA_COMMAND_IDS.TREE_REORDER_NODE,'))
  assert.ok(projectCommandsSource.includes('{ path, direction },'))
})

test('command kernel tree-document adoption: tree document commands execute exact command bridge payloads', async () => {
  const projectCommands = await loadProjectCommands()
  const calls = []
  const electronAPI = {
    invokeUiCommandBridge(request) {
      calls.push(request)
      return { ok: 1 }
    },
  }
  const { registry, handlers } = createCaptureRegistry()
  projectCommands.registerProjectCommands(registry, { electronAPI })

  const cases = [
    [
      projectCommands.EXTRA_COMMAND_IDS.PROJECT_DOCUMENT_OPEN,
      { path: 'scene-1.md', title: 'Scene 1', kind: 'scene' },
      { path: 'scene-1.md', title: 'Scene 1', kind: 'scene' },
    ],
    [
      projectCommands.EXTRA_COMMAND_IDS.TREE_CREATE_NODE,
      { parentPath: 'book', kind: 'scene', name: 'New Scene' },
      { parentPath: 'book', kind: 'scene', name: 'New Scene' },
    ],
    [
      projectCommands.EXTRA_COMMAND_IDS.TREE_RENAME_NODE,
      { path: 'book/old.md', name: 'New Name' },
      { path: 'book/old.md', name: 'New Name' },
    ],
    [
      projectCommands.EXTRA_COMMAND_IDS.TREE_DELETE_NODE,
      { path: 'book/delete.md' },
      { path: 'book/delete.md' },
    ],
    [
      projectCommands.EXTRA_COMMAND_IDS.TREE_REORDER_NODE,
      { path: 'book/reorder.md', direction: 'up' },
      { path: 'book/reorder.md', direction: 'up' },
    ],
  ]

  for (const [commandId, input, expectedPayload] of cases) {
    const registered = handlers.get(commandId)
    assert.ok(registered, `missing registered handler for ${commandId}`)
    const before = calls.length
    const result = await registered.handler(input)
    assert.equal(result.ok, true)
    assert.equal(calls.length, before + 1)
    assertBridgeCall(calls.at(-1), commandId, expectedPayload)
  }
})

test('command kernel tree-document adoption: runtime and docs capability bindings match for new command ids', async () => {
  const projectCommands = await loadProjectCommands()
  const capabilityPolicy = await loadCapabilityPolicy()
  const bindingDoc = readBindingDoc()
  const bindingMap = new Map(bindingDoc.items.map((item) => [item.commandId, item.capabilityId]))

  const expected = new Map([
    [projectCommands.EXTRA_COMMAND_IDS.PROJECT_DOCUMENT_OPEN, 'cap.project.document.open'],
    [projectCommands.EXTRA_COMMAND_IDS.TREE_CREATE_NODE, 'cap.project.tree.createNode'],
    [projectCommands.EXTRA_COMMAND_IDS.TREE_RENAME_NODE, 'cap.project.tree.renameNode'],
    [projectCommands.EXTRA_COMMAND_IDS.TREE_DELETE_NODE, 'cap.project.tree.deleteNode'],
    [projectCommands.EXTRA_COMMAND_IDS.TREE_REORDER_NODE, 'cap.project.tree.reorderNode'],
  ])

  for (const [commandId, capabilityId] of expected.entries()) {
    assert.equal(capabilityPolicy.CAPABILITY_BINDING[commandId], capabilityId)
    assert.equal(bindingMap.get(commandId), capabilityId)

    assert.equal(capabilityPolicy.CAPABILITY_MATRIX.node[capabilityId], true)
    assert.equal(capabilityPolicy.CAPABILITY_MATRIX.web[capabilityId], false)
    assert.equal(capabilityPolicy.CAPABILITY_MATRIX['mobile-wrapper'][capabilityId], false)
  }
})

test('command kernel tree-document adoption: editor routes tree and document actions via dispatchUiCommand only', () => {
  const source = read('src/renderer/editor.js')

  assert.equal(source.includes('window.electronAPI.openDocument('), false)
  assert.equal(source.includes('window.electronAPI.createNode('), false)
  assert.equal(source.includes('window.electronAPI.renameNode('), false)
  assert.equal(source.includes('window.electronAPI.deleteNode('), false)
  assert.equal(source.includes('window.electronAPI.reorderNode('), false)

  assert.ok(source.includes('dispatchUiCommand(EXTRA_COMMAND_IDS.PROJECT_DOCUMENT_OPEN, {'))
  assert.ok(source.includes('dispatchUiCommand(EXTRA_COMMAND_IDS.TREE_CREATE_NODE, {'))
  assert.ok(source.includes('dispatchUiCommand(EXTRA_COMMAND_IDS.TREE_RENAME_NODE, { path: node.path, name })'))
  assert.ok(source.includes('dispatchUiCommand(EXTRA_COMMAND_IDS.TREE_DELETE_NODE, { path: node.path })'))
  assert.ok(source.includes('dispatchUiCommand(EXTRA_COMMAND_IDS.TREE_REORDER_NODE, { path: node.path, direction })'))
})

test('command kernel tree-document adoption: tree click and context actions continue through openDocumentNode and handlers', () => {
  const source = read('src/renderer/editor.js')

  assert.ok(source.includes('const opened = await openDocumentNode(node);'))
  assert.ok(source.includes("items.push({ label: 'Новая папка', onClick: () => handleCreateNode(node, 'folder', 'Название папки') });"))
  assert.ok(source.includes("items.push({ label: 'Переименовать', onClick: () => handleRenameNode(node) });"))
  assert.ok(source.includes("items.push({ label: 'Удалить', onClick: () => handleDeleteNode(node) });"))
  assert.ok(source.includes("items.push({ label: 'Вверх', onClick: () => handleReorderNode(node, 'up') });"))
})

test('command kernel tree-document adoption: loadTree data fetch uses query bridge and signal paths remain canonicalized', () => {
  const source = read('src/renderer/editor.js')

  assert.ok(source.includes('async function loadTree() {'))
  assert.ok(source.includes("const result = await invokeWorkspaceQueryBridge('query.projectTree', { tab: activeTab });"))
  assert.ok(source.includes("void invokeSaveLifecycleSignalBridge('signal.localDirty.set', { state: true });"))
  assert.ok(source.includes("invokeSaveLifecycleSignalBridge('signal.autoSave.request')"))
  assert.ok(source.includes("collabScopeLocal = (await invokeWorkspaceQueryBridge('query.collabScopeLocal')) === true;"))
})
