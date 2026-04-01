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

test.skip('edit menu find replace command kernel: main edit menu includes command items with accelerators and canonical handlers', () => {
  const source = read('src/main.js')

  assert.ok(source.includes("commandItem('edit-find', 'Find', 'cmd.project.edit.find', { accelerator: 'CmdOrCtrl+F' })"))
  assert.ok(source.includes("commandItem('edit-replace', 'Replace', 'cmd.project.edit.replace', { accelerator: 'CmdOrCtrl+H' })"))

  assert.ok(source.includes("'cmd.project.edit.find': () => {"))
  assert.ok(source.includes("'cmd.project.edit.replace': () => {"))
  assert.ok(source.includes("sendCanonicalRuntimeCommand(\n      'cmd.project.edit.find'"))
  assert.ok(source.includes("sendCanonicalRuntimeCommand(\n      'cmd.project.edit.replace'"))

  assert.equal(source.includes("sendRuntimeCommand('search'"), false)
  assert.equal(source.includes("sendRuntimeCommand('replace'"), false)
})

test.skip('edit menu find replace command kernel: editor canonical runtime path handles find replace and exposes tiptap handlers', () => {
  const source = read('src/renderer/editor.js')

  assert.ok(source.includes('if (commandId === EXTRA_COMMAND_IDS.EDIT_FIND) {'))
  assert.ok(source.includes('if (commandId === EXTRA_COMMAND_IDS.EDIT_REPLACE) {'))
  assert.ok(source.includes('void dispatchUiCommand(EXTRA_COMMAND_IDS.EDIT_FIND);'))
  assert.ok(source.includes('void dispatchUiCommand(EXTRA_COMMAND_IDS.EDIT_REPLACE);'))

  assert.ok(source.includes('find: () => {'))
  assert.ok(source.includes('replace: () => {'))

  assert.ok(source.includes("} else if (command === 'search') {"))
  assert.ok(source.includes("} else if (command === 'replace') {"))
})

test.skip('edit menu find replace command kernel: tiptap runtime bridge handles canonical and legacy find replace paths', async () => {
  const { createTiptapRuntimeBridge } = await loadRuntimeBridgeModule()

  let findCalls = 0
  let replaceCalls = 0
  const bridge = createTiptapRuntimeBridge({
    runtimeHandlers: {
      find() {
        findCalls += 1
      },
      replace() {
        replaceCalls += 1
      },
    },
  })

  const canonicalFind = bridge.handleRuntimeCommand({ commandId: 'cmd.project.edit.find' })
  assert.equal(canonicalFind.handled, true)
  assert.equal(canonicalFind.commandId, 'cmd.project.edit.find')
  assert.deepEqual(canonicalFind.result, {
    performed: true,
    action: 'cmd.project.edit.find',
    reason: null,
  })

  const canonicalReplace = bridge.handleRuntimeCommand({ commandId: 'cmd.project.edit.replace' })
  assert.equal(canonicalReplace.handled, true)
  assert.equal(canonicalReplace.commandId, 'cmd.project.edit.replace')
  assert.deepEqual(canonicalReplace.result, {
    performed: true,
    action: 'cmd.project.edit.replace',
    reason: null,
  })

  const legacyFind = bridge.handleRuntimeCommand({ command: 'search' })
  assert.equal(legacyFind.handled, true)
  assert.equal(legacyFind.command, 'search')

  const legacyReplace = bridge.handleRuntimeCommand({ command: 'replace' })
  assert.equal(legacyReplace.handled, true)
  assert.equal(legacyReplace.command, 'replace')

  assert.equal(findCalls, 2)
  assert.equal(replaceCalls, 2)
})

test.skip('edit menu find replace command kernel: x101 lock and out-of-scope surfaces remain aligned', () => {
  const x101Source = read('docs/OPS/STATUS/X101_MENU_COMMAND_MAP_LOCK_V1.json')
  const projectCommandsSource = read('src/renderer/commands/projectCommands.mjs')
  const capabilitySource = read('src/renderer/commands/capabilityPolicy.mjs')
  const bindingSource = read('docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json')
  const namespaceSource = read('docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json')
  const preloadSource = read('src/preload.js')
  const tiptapIndexSource = read('src/renderer/tiptap/index.js')

  assert.ok(x101Source.includes('{ "label": "Find", "commandId": "cmd.project.edit.find" }'))
  assert.ok(x101Source.includes('{ "label": "Replace", "commandId": "cmd.project.edit.replace" }'))
  assert.ok(x101Source.includes('{ "label": "Copy", "role": "copy" }'))
  assert.ok(x101Source.includes('{ "label": "Paste", "role": "paste" }'))
  assert.ok(x101Source.includes('{ "label": "Select All", "role": "selectAll" }'))

  assert.ok(projectCommandsSource.includes("EDIT_FIND: 'cmd.project.edit.find'"))
  assert.ok(projectCommandsSource.includes("EDIT_REPLACE: 'cmd.project.edit.replace'"))
  assert.ok(capabilitySource.includes("'cmd.project.edit.find': 'cap.project.edit.find'"))
  assert.ok(capabilitySource.includes("'cmd.project.edit.replace': 'cap.project.edit.replace'"))
  assert.ok(bindingSource.includes('"commandId": "cmd.project.edit.find"'))
  assert.ok(bindingSource.includes('"commandId": "cmd.project.edit.replace"'))
  assert.ok(namespaceSource.includes('"canonicalPrefix": "cmd.project."'))
  assert.ok(preloadSource.includes('invokeUiCommandBridge: (request) => {'))
  assert.ok(tiptapIndexSource.includes('setTiptapRuntimeHandlers'))
})
