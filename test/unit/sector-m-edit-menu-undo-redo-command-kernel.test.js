const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function read(filePath) {
  return fs.readFileSync(path.join(ROOT, filePath), 'utf8')
}

async function loadRuntimeBridgeModule() {
  const filePath = path.join(ROOT, 'src', 'renderer', 'tiptap', 'runtimeBridge.js')
  const source = fs.readFileSync(filePath, 'utf8')
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`)
}

test('edit menu undo redo command kernel: main edit menu uses command items and canonical handlers', () => {
  const source = read('src/main.js')

  assert.ok(source.includes("commandItem('edit-undo', 'Undo', 'cmd.project.edit.undo', { accelerator: 'CmdOrCtrl+Z' })"))
  assert.ok(source.includes("commandItem('edit-redo', 'Redo', 'cmd.project.edit.redo', { accelerator: 'Shift+CmdOrCtrl+Z' })"))

  const ensureX101EditBlock = source.match(/const editMenu = ensureMenu\('edit', 'Edit', \[\]\);[\s\S]*?if \(editMenu\.submenu\.length === 0\) \{[\s\S]*?\n  \}/)
  assert.ok(ensureX101EditBlock, 'edit menu bootstrap block must exist')
  assert.equal(ensureX101EditBlock[0].includes("{ role: 'undo' }"), false)
  assert.equal(ensureX101EditBlock[0].includes("{ role: 'redo' }"), false)

  assert.ok(source.includes("'cmd.project.edit.undo': () => {"))
  assert.ok(source.includes("'cmd.project.edit.redo': () => {"))
  assert.ok(source.includes("sendCanonicalRuntimeCommand(\n      'cmd.project.edit.undo'"))
  assert.ok(source.includes("sendCanonicalRuntimeCommand(\n      'cmd.project.edit.redo'"))
  assert.equal(source.includes("sendRuntimeCommand('undo'"), false)
  assert.equal(source.includes("sendRuntimeCommand('edit-undo'"), false)
  assert.equal(source.includes("sendRuntimeCommand('redo'"), false)
  assert.equal(source.includes("sendRuntimeCommand('edit-redo'"), false)
})

test('edit menu undo redo command kernel: editor canonical runtime path handles undo redo with existing behavior', () => {
  const source = read('src/renderer/editor.js')

  assert.ok(source.includes('function handleCanonicalRuntimeCommandId(commandId, runtimePayload = null) {'))
  assert.ok(source.includes('if (commandId === EXTRA_COMMAND_IDS.EDIT_UNDO) {'))
  assert.ok(source.includes('if (commandId === EXTRA_COMMAND_IDS.EDIT_REDO) {'))
  assert.ok(source.includes('void dispatchUiCommand(EXTRA_COMMAND_IDS.EDIT_UNDO);'))
  assert.ok(source.includes('void dispatchUiCommand(EXTRA_COMMAND_IDS.EDIT_REDO);'))

  assert.ok(source.includes("} else if (command === 'undo' || command === 'edit-undo') {"))
  assert.ok(source.includes("} else if (command === 'redo' || command === 'edit-redo') {"))
})

test('edit menu undo redo command kernel: tiptap runtime bridge handles canonical command ids and keeps legacy compatibility', async () => {
  const { createTiptapRuntimeBridge } = await loadRuntimeBridgeModule()

  let undoCalls = 0
  let redoCalls = 0
  const bridge = createTiptapRuntimeBridge({
    editor: {
      commands: {
        undo() {
          undoCalls += 1
          return true
        },
        redo() {
          redoCalls += 1
          return true
        },
      },
    },
  })

  const canonicalUndo = bridge.handleRuntimeCommand({ commandId: 'cmd.project.edit.undo' })
  assert.equal(canonicalUndo.handled, true)
  assert.equal(canonicalUndo.commandId, 'cmd.project.edit.undo')
  assert.deepEqual(canonicalUndo.result, { performed: true, action: 'undo', reason: null })

  const canonicalRedo = bridge.handleRuntimeCommand({ commandId: 'cmd.project.edit.redo' })
  assert.equal(canonicalRedo.handled, true)
  assert.equal(canonicalRedo.commandId, 'cmd.project.edit.redo')
  assert.deepEqual(canonicalRedo.result, { performed: true, action: 'redo', reason: null })

  const legacyUndo = bridge.handleRuntimeCommand({ command: 'edit-undo' })
  assert.equal(legacyUndo.handled, true)
  assert.equal(legacyUndo.command, 'edit-undo')

  const legacyRedo = bridge.handleRuntimeCommand({ command: 'edit-redo' })
  assert.equal(legacyRedo.handled, true)
  assert.equal(legacyRedo.command, 'edit-redo')

  assert.equal(undoCalls, 2)
  assert.equal(redoCalls, 2)
})

test('edit menu undo redo command kernel: x101 lock and out-of-scope surfaces remain aligned', () => {
  const x101Source = read('docs/OPS/STATUS/X101_MENU_COMMAND_MAP_LOCK_V1.json')
  const projectCommandsSource = read('src/renderer/commands/projectCommands.mjs')
  const capabilitySource = read('src/renderer/commands/capabilityPolicy.mjs')
  const bindingSource = read('docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json')
  const namespaceSource = read('docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json')
  const preloadSource = read('src/preload.js')
  const tiptapIndexSource = read('src/renderer/tiptap/index.js')

  assert.ok(x101Source.includes('{ "label": "Undo", "commandId": "cmd.project.edit.undo" }'))
  assert.ok(x101Source.includes('{ "label": "Redo", "commandId": "cmd.project.edit.redo" }'))
  assert.ok(x101Source.includes('{ "label": "Copy", "role": "copy" }'))
  assert.ok(x101Source.includes('{ "label": "Paste", "role": "paste" }'))
  assert.ok(x101Source.includes('{ "label": "Select All", "role": "selectAll" }'))

  assert.ok(projectCommandsSource.includes("EDIT_UNDO: 'cmd.project.edit.undo'"))
  assert.ok(projectCommandsSource.includes("EDIT_REDO: 'cmd.project.edit.redo'"))
  assert.ok(capabilitySource.includes("'cmd.project.edit.undo': 'cap.project.edit.undo'"))
  assert.ok(capabilitySource.includes("'cmd.project.edit.redo': 'cap.project.edit.redo'"))
  assert.ok(bindingSource.includes('"commandId": "cmd.project.edit.undo"'))
  assert.ok(bindingSource.includes('"commandId": "cmd.project.edit.redo"'))
  assert.ok(namespaceSource.includes('"schemaVersion": 1'))
  assert.ok(preloadSource.includes('invokeUiCommandBridge: (request) => {'))
  assert.ok(tiptapIndexSource.includes('setTiptapRuntimeHandlers'))
})
