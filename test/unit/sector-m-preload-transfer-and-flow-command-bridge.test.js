const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function read(filePath) {
  return fs.readFileSync(path.join(ROOT, filePath), 'utf8')
}

test('preload transfer and flow bridge: projectCommands routes five existing transfer and flow commands through invokeUiCommandBridge', () => {
  const source = read('src/renderer/commands/projectCommands.mjs')

  assert.ok(source.includes("const COMMAND_BRIDGE_ROUTE = 'command.bus';"))
  assert.ok(source.includes('async function invokeTransferAndFlowCommandBridge(electronAPI, commandId, payload = {}) {'))
  assert.ok(source.includes('response = await invokeTransferAndFlowCommandBridge(electronAPI, COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN, payload);'))
  assert.ok(source.includes('response = await invokeTransferAndFlowCommandBridge(electronAPI, COMMAND_IDS.PROJECT_IMPORT_MARKDOWN_V1, payload);'))
  assert.ok(source.includes('response = await invokeTransferAndFlowCommandBridge(electronAPI, COMMAND_IDS.PROJECT_EXPORT_MARKDOWN_V1, payload);'))
  assert.ok(source.includes('response = await invokeTransferAndFlowCommandBridge(electronAPI, COMMAND_IDS.PROJECT_FLOW_OPEN_V1);'))
  assert.ok(source.includes('response = await invokeTransferAndFlowCommandBridge('))
  assert.ok(source.includes('COMMAND_IDS.PROJECT_FLOW_SAVE_V1,'))

  assert.equal(source.includes('electronAPI.exportDocxMin('), false)
  assert.equal(source.includes('electronAPI.importMarkdownV1('), false)
  assert.equal(source.includes('electronAPI.exportMarkdownV1('), false)
  assert.equal(source.includes('electronAPI.openFlowModeV1('), false)
  assert.equal(source.includes('electronAPI.saveFlowModeV1('), false)
})

test('preload transfer and flow bridge: main allowlist includes five transfer flow ids in addition to previously adopted ids', () => {
  const source = read('src/main.js')

  assert.ok(source.includes('const UI_COMMAND_BRIDGE_ALLOWED_COMMAND_IDS = new Set(['))
  assert.ok(source.includes("'cmd.project.export.docxMin'"))
  assert.ok(source.includes("'cmd.project.importMarkdownV1'"))
  assert.ok(source.includes("'cmd.project.exportMarkdownV1'"))
  assert.ok(source.includes("'cmd.project.flowOpenV1'"))
  assert.ok(source.includes("'cmd.project.flowSaveV1'"))

  assert.ok(source.includes("'cmd.project.new'"))
  assert.ok(source.includes("'cmd.project.open'"))
  assert.ok(source.includes("'cmd.project.save'"))
  assert.ok(source.includes("'cmd.project.saveAs'"))
  assert.ok(source.includes("'cmd.project.document.open'"))
  assert.ok(source.includes("'cmd.project.tree.createNode'"))
  assert.ok(source.includes("'cmd.ui.theme.set'"))

  assert.ok(source.includes("if (!UI_COMMAND_BRIDGE_ALLOWED_COMMAND_IDS.has(commandId)) {"))
  assert.ok(source.includes("return { ok: false, reason: 'COMMAND_ID_NOT_ALLOWED' };"))
})

test('preload transfer and flow bridge: main bridge reuses existing export import and flow backend handlers', () => {
  const source = read('src/main.js')

  assert.ok(source.includes("'cmd.project.export.docxMin': async (payload = {}) => {"))
  assert.ok(source.includes('const response = await handleExportDocxMin({'))

  assert.ok(source.includes("'cmd.project.importMarkdownV1': async (payload = {}) => {"))
  assert.ok(source.includes('return handleImportMarkdownV1(payload);'))

  assert.ok(source.includes("'cmd.project.exportMarkdownV1': async (payload = {}) => {"))
  assert.ok(source.includes('return handleExportMarkdownV1(payload);'))

  assert.ok(source.includes("'cmd.project.flowOpenV1': async () => {"))
  assert.ok(source.includes('return handleFlowOpenV1();'))

  assert.ok(source.includes("'cmd.project.flowSaveV1': async (payload = {}) => {"))
  assert.ok(source.includes('return handleFlowSaveV1(payload);'))

  assert.ok(source.includes("ipcMain.handle(EXPORT_DOCX_MIN_CHANNEL, async (_, payload) => {"))
  assert.ok(source.includes("ipcMain.handle(IMPORT_MARKDOWN_V1_CHANNEL, async (_, payload) => {"))
  assert.ok(source.includes("ipcMain.handle(EXPORT_MARKDOWN_V1_CHANNEL, async (_, payload) => {"))
  assert.ok(source.includes("ipcMain.handle(FLOW_OPEN_V1_CHANNEL, async () => {"))
  assert.ok(source.includes("ipcMain.handle(FLOW_SAVE_V1_CHANNEL, async (_, payload) => {"))
})

test('preload transfer and flow bridge: out-of-scope surfaces remain present and compatible', () => {
  const preloadSource = read('src/preload.js')
  const capabilitySource = read('src/renderer/commands/capabilityPolicy.mjs')
  const bindingDoc = read('docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json')
  const namespaceDoc = read('docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json')

  assert.ok(preloadSource.includes('invokeUiCommandBridge: (request) => {'))
  assert.ok(capabilitySource.includes("'cmd.project.importMarkdownV1': 'cap.project.import.markdownV1'"))
  assert.ok(bindingDoc.includes('"commandId": "cmd.project.importMarkdownV1"'))
  assert.ok(namespaceDoc.includes('"cmd.file.importMarkdownV1": "cmd.project.importMarkdownV1"'))
})
