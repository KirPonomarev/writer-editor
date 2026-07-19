const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

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

  assert.ok(handlerBlock.includes('const confirmed = payload && payload.confirmed === true'))
  assert.ok(handlerBlock.includes('sendCanonicalRuntimeCommand('))
  assert.ok(handlerBlock.includes("'cmd.project.export.docxMin'"))
  assert.ok(handlerBlock.includes('preview: true'))
  assert.ok(handlerBlock.includes("'open-export-preview'"))
  assert.ok(handlerBlock.includes('if (!confirmed) {'))
  assert.ok(handlerBlock.includes('return response;'))
  assert.equal(handlerBlock.includes("sendRuntimeCommand('open-export-preview'"), false)
})

test('export preview command id canonicalization: editor handles canonical payload.commandId preview flag path with legacy fallback', () => {
  const source = read('src/renderer/editor.js')

  assert.ok(source.includes('function handleCanonicalRuntimeCommandId(commandId, runtimePayload = null) {'))
  assert.ok(source.includes("if (commandId === COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN && payload.preview === true) {"))
  assert.ok(source.includes('openExportSurfaceModal(commandId);'))
  assert.ok(source.includes('function runExportSurfaceFormat(format)'))
  assert.ok(source.includes('return openExportPreviewModal();'))
  assert.ok(source.includes("case 'export-docx-min':"))
  assert.ok(source.includes('void dispatchUiCommand(COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN);'))
  assert.equal(source.includes("case 'export-docx-min':\n      openExportPreviewModal();"), false)
  assert.ok(source.includes('await dispatchUiCommand(COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN, {'))
  assert.ok(source.includes('confirmed: true,'))

  assert.ok(source.includes('const commandPayload = payload && payload.payload && typeof payload.payload === \'object\' && !Array.isArray(payload.payload)'))
  assert.ok(source.includes('if (handleCanonicalRuntimeCommandId(commandId, commandPayload)) {'))

  assert.ok(source.includes("} else if (command === 'open-export-preview') {"))
})

test('export preview command id canonicalization: runtime bridge handles canonical docx preview command id', async () => {
  const { createTiptapRuntimeBridge } = await loadRuntimeBridgeModule()

  let previewCalls = 0
  let surfaceCalls = 0
  const bridge = createTiptapRuntimeBridge({
    runtimeHandlers: {
      openExportSurface() {
        surfaceCalls += 1
      },
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
  assert.equal(surfaceCalls, 1)
  assert.equal(previewCalls, 0)

  const legacyResult = bridge.handleRuntimeCommand({ command: 'open-export-preview' })
  assert.equal(legacyResult.handled, true)
  assert.equal(legacyResult.command, 'open-export-preview')
  assert.equal(previewCalls, 1)
})

test('export preview command id canonicalization: project command forwards confirm payload and preserves preview surface semantics', async () => {
  const registryModule = await import(pathToFileURL(path.join(ROOT, 'src', 'renderer', 'commands', 'registry.mjs')).href)
  const runnerModule = await import(pathToFileURL(path.join(ROOT, 'src', 'renderer', 'commands', 'runCommand.mjs')).href)
  const projectModule = await import(pathToFileURL(path.join(ROOT, 'src', 'renderer', 'commands', 'projectCommands.mjs')).href)
  const registry = registryModule.createCommandRegistry()
  const requests = []

  projectModule.registerProjectCommands(registry, {
    electronAPI: {
      invokeUiCommandBridge: async (request) => {
        requests.push(request)
        if (request.payload && request.payload.confirmed === true) {
          return {
            ok: true,
            value: {
              ok: 1,
              outPath: '/tmp/confirmed.docx',
              bytesWritten: 42,
            },
          }
        }
        return {
          ok: true,
          value: {
            ok: true,
            preview: true,
          },
        }
      },
    },
  })

  const runCommand = runnerModule.createCommandRunner(registry)
  const previewResult = await runCommand(projectModule.COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN)
  const confirmedResult = await runCommand(projectModule.COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN, { confirmed: true })

  assert.equal(requests.length, 2)
  assert.equal(requests[0].commandId, projectModule.COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN)
  assert.equal(Object.prototype.hasOwnProperty.call(requests[0].payload, 'confirmed'), false)
  assert.equal(requests[1].payload.confirmed, true)
  assert.deepEqual(previewResult, {
    ok: true,
    value: {
      exported: false,
      preview: true,
    },
  })
  assert.deepEqual(confirmedResult, {
    ok: true,
    value: {
      exported: true,
      outPath: '/tmp/confirmed.docx',
      bytesWritten: 42,
    },
  })
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
