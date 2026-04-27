const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function read(filePath) {
  return fs.readFileSync(path.join(ROOT, filePath), 'utf8')
}

test('toolbar shell action command kernel: editor handleUiAction routes toolbar shell actions through dispatchUiCommand', () => {
  const source = read('src/renderer/editor.js')

  const blockMatch = source.match(/function handleUiAction\(action\) \{[\s\S]*?\n\}/)
  assert.ok(blockMatch, 'handleUiAction block must exist')
  const block = blockMatch[0]

  assert.ok(block.includes("case 'open-settings':"))
  assert.ok(block.includes('void dispatchUiCommand(EXTRA_COMMAND_IDS.VIEW_OPEN_SETTINGS);'))
  assert.equal(block.includes('openSettingsModal();'), false)

  assert.ok(block.includes("case 'open-diagnostics':"))
  assert.ok(block.includes('void dispatchUiCommand(EXTRA_COMMAND_IDS.TOOLS_OPEN_DIAGNOSTICS);'))
  assert.equal(block.includes('openDiagnosticsModal();'), false)

  assert.ok(block.includes("case 'open-recovery':"))
  assert.ok(block.includes('void dispatchUiCommand(EXTRA_COMMAND_IDS.REVIEW_OPEN_RECOVERY);'))
  assert.equal(block.includes("openRecoveryModal('Recovery modal opened manually');"), false)

  assert.ok(block.includes("case 'export-docx-min':"))
  assert.ok(block.includes('void dispatchUiCommand(COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN);'))
})

test('toolbar shell action command kernel: x101 toolbar action map points to existing command paths for shell actions', () => {
  const source = read('docs/OPS/STATUS/X101_MENU_COMMAND_MAP_LOCK_V1.json')

  assert.ok(source.includes('"open-settings": "EXTRA_COMMAND_IDS.VIEW_OPEN_SETTINGS"'))
  assert.ok(source.includes('"open-diagnostics": "EXTRA_COMMAND_IDS.TOOLS_OPEN_DIAGNOSTICS"'))
  assert.ok(source.includes('"open-recovery": "EXTRA_COMMAND_IDS.REVIEW_OPEN_RECOVERY"'))

  assert.ok(source.includes('"export-docx-min": "COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN"'))
  assert.ok(source.includes('"search": "EXTRA_COMMAND_IDS.EDIT_FIND"'))
  assert.ok(source.includes('"replace": "EXTRA_COMMAND_IDS.EDIT_REPLACE"'))
  assert.ok(source.includes('{ "label": "Copy", "role": "copy" }'))
  assert.ok(source.includes('{ "label": "Paste", "role": "paste" }'))
  assert.ok(source.includes('{ "label": "Select All", "role": "selectAll" }'))

  assert.equal(source.includes('"open-settings": "LOCAL_MODAL_HANDLER"'), false)
  assert.equal(source.includes('"open-diagnostics": "LOCAL_MODAL_HANDLER"'), false)
  assert.equal(source.includes('"open-recovery": "LOCAL_MODAL_HANDLER"'), false)
})

test('toolbar shell action command kernel: out-of-scope command kernel and runtime bridge files remain compatible', () => {
  const mainSource = read('src/main.js')
  const projectCommandsSource = read('src/renderer/commands/projectCommands.mjs')
  const capabilitySource = read('src/renderer/commands/capabilityPolicy.mjs')
  const bindingSource = read('docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json')
  const namespaceSource = read('docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json')
  const runtimeBridgeSource = read('src/renderer/tiptap/runtimeBridge.js')
  const preloadSource = read('src/preload.js')

  assert.ok(mainSource.includes("'cmd.project.view.openSettings': () => {"))
  assert.ok(mainSource.includes("'cmd.project.tools.openDiagnostics': () => {"))
  assert.ok(mainSource.includes("'cmd.project.review.openRecovery': () => {"))

  assert.ok(projectCommandsSource.includes("VIEW_OPEN_SETTINGS: 'cmd.project.view.openSettings'"))
  assert.ok(projectCommandsSource.includes("TOOLS_OPEN_DIAGNOSTICS: 'cmd.project.tools.openDiagnostics'"))
  assert.ok(projectCommandsSource.includes("REVIEW_OPEN_RECOVERY: 'cmd.project.review.openRecovery'"))

  assert.ok(capabilitySource.includes("'cmd.project.view.openSettings': 'cap.project.view.openSettings'"))
  assert.ok(capabilitySource.includes("'cmd.project.tools.openDiagnostics': 'cap.project.tools.openDiagnostics'"))
  assert.ok(capabilitySource.includes("'cmd.project.review.openRecovery': 'cap.project.review.openRecovery'"))
  assert.ok(bindingSource.includes('"commandId": "cmd.project.view.openSettings"'))
  assert.ok(bindingSource.includes('"commandId": "cmd.project.tools.openDiagnostics"'))
  assert.ok(bindingSource.includes('"commandId": "cmd.project.review.openRecovery"'))
  assert.ok(namespaceSource.includes('"canonicalPrefix": "cmd.project."'))

  assert.ok(runtimeBridgeSource.includes("if (commandId === 'cmd.project.view.openSettings')"))
  assert.ok(preloadSource.includes('invokeUiCommandBridge: (request) => {'))
})
