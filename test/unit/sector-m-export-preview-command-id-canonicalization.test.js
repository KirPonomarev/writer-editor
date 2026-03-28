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

test('export preview command id canonicalization: main emits canonical commandId for docx preview branch', () => {
  const source = read('src/main.js')
  const handlerMatch = source.match(/'cmd\.project\.export\.docxMin': async \(payload = \{\}\) => \{[\s\S]*?\n  \},/)
  assert.ok(handlerMatch, 'docx export menu handler must exist')
  const handlerBlock = handlerMatch[0]

  assert.ok(handlerBlock.includes('sendCanonicalRuntimeCommand('))
  assert.ok(handlerBlock.includes("'cmd.project.export.docxMin'"))
  assert.ok(handlerBlock.includes('preview: true'))
  assert.ok(handlerBlock.includes("'open-export-preview'"))
  assert.equal(handlerBlock.includes("sendRuntimeCommand('open-export-preview'"), false)
})

test('export preview command id canonicalization: editor handles canonical payload.commandId preview flag path with legacy fallback', () => {
  const source = read('src/renderer/editor.js')

  assert.ok(source.includes('function handleCanonicalRuntimeCommandId(commandId, runtimePayload = null) {'))
  assert.ok(source.includes("if (commandId === COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN && payload.preview === true) {"))
  assert.ok(source.includes('openExportPreviewModal();'))

  assert.ok(source.includes('const commandPayload = payload && payload.payload && typeof payload.payload === \'object\' && !Array.isArray(payload.payload)'))
  assert.ok(source.includes('if (handleCanonicalRuntimeCommandId(commandId, commandPayload)) {'))

  assert.ok(source.includes("} else if (command === 'open-export-preview') {"))
})

test('export preview command id canonicalization: runtime bridge handles canonical docx preview command id', async () => {
  const { createTiptapRuntimeBridge } = await loadRuntimeBridgeModule()

  let previewCalls = 0
  const bridge = createTiptapRuntimeBridge({
    runtimeHandlers: {
      openExportPreview() {
        previewCalls += 1
      },
    },
  })

  const canonicalResult = bridge.handleRuntimeCommand({
    commandId: 'cmd.project.export.docxMin',
    payload: { preview: true },
  })

  assert.equal(canonicalResult.handled, true)
  assert.equal(canonicalResult.commandId, 'cmd.project.export.docxMin')
  assert.deepEqual(canonicalResult.result, {
    performed: true,
    action: 'cmd.project.export.docxMin',
    reason: null,
  })
  assert.equal(previewCalls, 1)

  const legacyResult = bridge.handleRuntimeCommand({ command: 'open-export-preview' })
  assert.equal(legacyResult.handled, true)
  assert.equal(legacyResult.command, 'open-export-preview')
  assert.equal(previewCalls, 2)
})

test('export preview command id canonicalization: out-of-scope command kernel and preload surfaces stay unchanged', () => {
  const projectCommandsSource = read('src/renderer/commands/projectCommands.mjs')
  const capabilitySource = read('src/renderer/commands/capabilityPolicy.mjs')
  const bindingDoc = read('docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json')
  const preloadSource = read('src/preload.js')
  const tiptapIndexSource = read('src/renderer/tiptap/index.js')

  assert.ok(projectCommandsSource.includes("'export-docx-min': 'cmd.project.export.docxMin'"))
  assert.ok(capabilitySource.includes("'cmd.project.export.docxMin': 'cap.project.export.docxMin'"))
  assert.ok(bindingDoc.includes('"commandId": "cmd.project.export.docxMin"'))
  assert.ok(preloadSource.includes('invokeUiCommandBridge: (request) => {'))
  assert.ok(tiptapIndexSource.includes('setTiptapRuntimeHandlers'))
})
