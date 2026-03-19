const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = process.cwd()

async function loadEsmSourceFromFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8')
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`)
}

async function loadRuntimeBridgeModule() {
  const filePath = path.join(ROOT, 'src', 'renderer', 'tiptap', 'runtimeBridge.js')
  return loadEsmSourceFromFile(filePath)
}

async function loadIpcModule() {
  const filePath = path.join(ROOT, 'src', 'renderer', 'tiptap', 'ipc.js')
  return loadEsmSourceFromFile(filePath)
}

test('tiptap runtime bridge: undo delegates to editor.commands.undo', async () => {
  const { createTiptapRuntimeBridge } = await loadRuntimeBridgeModule()
  let undoCalls = 0
  const bridge = createTiptapRuntimeBridge({
    editor: {
      commands: {
        undo() {
          undoCalls += 1
          return true
        },
      },
    },
  })

  const result = bridge.undo()
  assert.equal(undoCalls, 1)
  assert.deepEqual(result, { performed: true, action: 'undo', reason: null })
})

test('tiptap runtime bridge: redo delegates to editor.commands.redo', async () => {
  const { createTiptapRuntimeBridge } = await loadRuntimeBridgeModule()
  let redoCalls = 0
  const bridge = createTiptapRuntimeBridge({
    editor: {
      commands: {
        redo() {
          redoCalls += 1
          return false
        },
      },
    },
  })

  const result = bridge.redo()
  assert.equal(redoCalls, 1)
  assert.deepEqual(result, { performed: false, action: 'redo', reason: null })
})

test('tiptap runtime bridge: recovery-restored hook is deterministic', async () => {
  const { createTiptapRuntimeBridge } = await loadRuntimeBridgeModule()
  let observed = null
  const bridge = createTiptapRuntimeBridge({
    onRecoveryRestored: (payload) => {
      observed = payload
    },
  })

  const first = bridge.handleRecoveryRestored({ message: 'Recovered autosave on reopen path', source: 'autosave' })
  assert.deepEqual(first, {
    handled: true,
    message: 'Recovered autosave on reopen path',
    source: 'autosave',
  })
  assert.deepEqual(observed, first)

  const second = bridge.handleRecoveryRestored({})
  assert.deepEqual(second, {
    handled: true,
    message: 'Recovered autosave on reopen path',
    source: 'unknown',
  })
})

test('tiptap runtime bridge: safe reset delegates to runtime handler', async () => {
  const { createTiptapRuntimeBridge } = await loadRuntimeBridgeModule()
  let safeResetCalls = 0
  const bridge = createTiptapRuntimeBridge({
    runtimeHandlers: {
      safeResetShell() {
        safeResetCalls += 1
      },
    },
  })

  const result = bridge.handleRuntimeCommand({ command: 'safe-reset-shell' })
  assert.equal(safeResetCalls, 1)
  assert.deepEqual(result, {
    handled: true,
    result: { performed: true, action: 'safe-reset-shell', reason: null },
    command: 'safe-reset-shell',
  })
})

test('tiptap runtime bridge: last stable restore delegates to runtime handler', async () => {
  const { createTiptapRuntimeBridge } = await loadRuntimeBridgeModule()
  let restoreCalls = 0
  const bridge = createTiptapRuntimeBridge({
    runtimeHandlers: {
      restoreLastStableShell() {
        restoreCalls += 1
      },
    },
  })

  const result = bridge.handleRuntimeCommand({ command: 'restore-last-stable-shell' })
  assert.equal(restoreCalls, 1)
  assert.deepEqual(result, {
    handled: true,
    result: { performed: true, action: 'restore-last-stable-shell', reason: null },
    command: 'restore-last-stable-shell',
  })
})

test('tiptap ipc adapter seams: text request and set text are deterministic', async () => {
  const { createTextRequestHandler, createSetTextHandler } = await loadIpcModule()

  let readCalls = 0
  let sentPayload = null
  const handleTextRequest = createTextRequestHandler({
    readObservablePayload: () => {
      readCalls += 1
      return 'payload-text'
    },
    sendEditorTextResponse: (requestId, text) => {
      sentPayload = { requestId, text }
    },
  })

  const textResult = handleTextRequest({ requestId: 'req-1' })
  assert.equal(readCalls, 1)
  assert.deepEqual(textResult, { requestId: 'req-1', text: 'payload-text' })
  assert.deepEqual(sentPayload, { requestId: 'req-1', text: 'payload-text' })

  let appliedPayload = null
  const handleSetText = createSetTextHandler({
    applyIncomingPayload: (payload) => {
      appliedPayload = payload
    },
  })

  const incoming = { content: 'new-text', path: '/tmp/example' }
  const setResult = handleSetText(incoming)
  assert.deepEqual(appliedPayload, incoming)
  assert.deepEqual(setResult, { applied: true, payload: incoming })
})
