const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function read(filePath) {
  return fs.readFileSync(path.join(ROOT, filePath), 'utf8')
}

test.skip('toolbar export docx preview command kernel: editor handleUiAction routes export-docx-min through command id', () => {
  const source = read('src/renderer/editor.js')

  const blockMatch = source.match(/function handleUiAction\(action\) \{[\s\S]*?\n\}/)
  assert.ok(blockMatch, 'handleUiAction block must exist')
  const block = blockMatch[0]

  assert.ok(block.includes("case 'export-docx-min':"))
  assert.ok(block.includes('void dispatchUiCommand(COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN);'))
  assert.equal(block.includes('openExportPreviewModal();'), false)

  assert.ok(source.includes('function openExportPreviewModal() {'))
  assert.ok(source.includes('async function confirmExportPreviewAndRun() {'))
  assert.ok(source.includes('await dispatchUiCommand(COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN);'))
})

test.skip('toolbar export docx preview command kernel: x101 toolbar action map records direct command kernel path', () => {
  const source = read('docs/OPS/STATUS/X101_MENU_COMMAND_MAP_LOCK_V1.json')

  assert.ok(source.includes('"export-docx-min": "COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN"'))
  assert.equal(source.includes('"export-docx-min": "COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN_THROUGH_PREVIEW_CONFIRM"'), false)

  assert.ok(source.includes('"open-settings": "EXTRA_COMMAND_IDS.VIEW_OPEN_SETTINGS"'))
  assert.ok(source.includes('"open-diagnostics": "EXTRA_COMMAND_IDS.TOOLS_OPEN_DIAGNOSTICS"'))
  assert.ok(source.includes('"open-recovery": "EXTRA_COMMAND_IDS.REVIEW_OPEN_RECOVERY"'))
})

test.skip('toolbar export docx preview command kernel: out-of-scope command kernel and runtime surfaces remain compatible', () => {
  const mainSource = read('src/main.js')
  const projectCommandsSource = read('src/renderer/commands/projectCommands.mjs')
  const capabilitySource = read('src/renderer/commands/capabilityPolicy.mjs')
  const bindingSource = read('docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json')
  const namespaceSource = read('docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json')
  const runtimeBridgeSource = read('src/renderer/tiptap/runtimeBridge.js')
  const preloadSource = read('src/preload.js')

  assert.ok(mainSource.includes("'cmd.project.export.docxMin': async (payload = {}) => {"))
  assert.ok(mainSource.includes("sendCanonicalRuntimeCommand(\n      'cmd.project.export.docxMin'"))
  assert.ok(mainSource.includes("'open-export-preview'"))

  assert.ok(projectCommandsSource.includes("PROJECT_EXPORT_DOCX_MIN: COMMAND_KEY_TO_ID.PROJECT_EXPORT_DOCX_MIN"))
  assert.ok(capabilitySource.includes("'cmd.project.export.docxMin': 'cap.project.export.docxMin'"))
  assert.ok(bindingSource.includes('"commandId": "cmd.project.export.docxMin"'))
  assert.ok(namespaceSource.includes('"canonicalPrefix": "cmd.project."'))
  assert.ok(runtimeBridgeSource.includes("if (commandId === 'cmd.project.export.docxMin' && payload.preview === true) {"))
  assert.ok(preloadSource.includes('invokeUiCommandBridge: (request) => {'))
})
