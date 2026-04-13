const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const ROOT = process.cwd()

async function loadEsmSourceFromFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf8')
  if (filePath.endsWith(path.join('tiptap', 'ipc.js'))) {
    const envelopeHref = pathToFileURL(path.join(ROOT, 'src', 'renderer', 'documentContentEnvelope.mjs')).href
    code = code.replace("../documentContentEnvelope.mjs", envelopeHref)
  }
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

test('tiptap runtime bridge: canonical underline command id delegates to editor.commands.toggleUnderline', async () => {
  const { createTiptapRuntimeBridge } = await loadRuntimeBridgeModule()
  let underlineCalls = 0
  const bridge = createTiptapRuntimeBridge({
    editor: {
      commands: {
        toggleUnderline() {
          underlineCalls += 1
          return true
        },
      },
    },
  })

  const result = bridge.handleRuntimeCommand({ commandId: 'cmd.project.format.toggleUnderline' })
  assert.equal(underlineCalls, 1)
  assert.deepEqual(result, {
    handled: true,
    result: { performed: true, action: 'toggleUnderline', reason: null },
    commandId: 'cmd.project.format.toggleUnderline',
  })
})

test('tiptap runtime bridge: canonical link prompt command id delegates only to runtime handler callback', async () => {
  const { createTiptapRuntimeBridge } = await loadRuntimeBridgeModule()
  const calls = []
  const bridge = createTiptapRuntimeBridge({
    runtimeHandlers: {
      insertLinkPrompt(commandId, payload) {
        calls.push({ commandId, payload })
        return {
          performed: false,
          action: 'insertLinkPrompt',
          reason: 'NO_SELECTION',
        }
      },
    },
  })

  const payload = {
    selection: { from: 4, to: 11 },
    href: 'https://example.com',
  }
  const result = bridge.handleRuntimeCommand({
    commandId: 'cmd.project.insert.linkPrompt',
    payload,
  })

  assert.deepEqual(calls, [
    {
      commandId: 'cmd.project.insert.linkPrompt',
      payload,
    },
  ])
  assert.deepEqual(result, {
    handled: true,
    result: { performed: false, action: 'insertLinkPrompt', reason: 'NO_SELECTION' },
    commandId: 'cmd.project.insert.linkPrompt',
  })
})

test('tiptap tiptap index: underline and link extensions are configured inertly and expose the bounded command API', () => {
  const filePath = path.join(ROOT, 'src', 'renderer', 'tiptap', 'index.js')
  const source = fs.readFileSync(filePath, 'utf8')

  assert.ok(source.includes("import Link from '@tiptap/extension-link'"))
  assert.ok(source.includes("import Underline from '@tiptap/extension-underline'"))
  assert.ok(source.includes('StarterKit.configure({'))
  assert.ok(source.includes('link: false'))
  assert.ok(source.includes('underline: false'))
  assert.ok(source.includes('Underline,'))
  assert.ok(source.includes('Link.configure({'))
  assert.ok(source.includes('autolink: false'))
  assert.ok(source.includes('linkOnPaste: false'))
  assert.ok(source.includes('openOnClick: false'))
  assert.ok(source.includes("underline: Boolean(editor.isActive('underline'))"))
  assert.ok(source.includes("const linkActive = Boolean(editor.isActive('link'))"))
  assert.ok(source.includes('link: linkActive'))
  assert.ok(source.includes('linkActive,'))
  assert.ok(source.includes("if (commandName === 'toggleUnderline')"))
  assert.ok(source.includes("if (commandName === 'setLink')"))
  assert.ok(source.includes("if (commandName === 'unsetLink')"))
})

test('tiptap runtime bridge: dormant string command surface remains unchanged for underline and link', async () => {
  const { createTiptapRuntimeBridge } = await loadRuntimeBridgeModule()
  const bridge = createTiptapRuntimeBridge({})

  assert.deepEqual(bridge.handleRuntimeCommand({ command: 'format-underline' }), {
    handled: false,
    command: 'format-underline',
  })
  assert.deepEqual(bridge.handleRuntimeCommand({ command: 'insert-link' }), {
    handled: false,
    command: 'insert-link',
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

test('tiptap runtime bridge: command surface is locked for dormant bootstrap slice', async () => {
  const filePath = path.join(ROOT, 'src', 'renderer', 'tiptap', 'runtimeBridge.js')
  const source = fs.readFileSync(filePath, 'utf8')
  const commands = [...source.matchAll(/command === '([^']+)'/g)]
    .map((match) => match[1])
    .filter((command) => command !== 'string')
  assert.deepEqual(commands, [
    'undo',
    'edit-undo',
    'redo',
    'edit-redo',
    'open-settings',
    'safe-reset-shell',
    'restore-last-stable-shell',
    'open-diagnostics',
    'open-recovery',
    'open-export-preview',
    'insert-add-card',
    'format-align-left',
    'switch-mode-plan',
    'switch-mode-review',
    'switch-mode-write',
  ])
})

test('tiptap runtime bridge: design-os-specific commands are rejected in dormant slice', async () => {
  const { createTiptapRuntimeBridge } = await loadRuntimeBridgeModule()
  const bridge = createTiptapRuntimeBridge({})
  const forbidden = [
    'design-os-preview',
    'design-os-commit',
    'design-os-safe-reset-shell',
  ]

  for (const command of forbidden) {
    assert.deepEqual(bridge.handleRuntimeCommand({ command }), { handled: false, command })
  }
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

test('tiptap ipc adapter seams: attach does not register window listeners unless explicitly enabled', async () => {
  const {
    attachTiptapIpc,
    detachTiptapIpc,
    getTiptapIpcDebugState,
  } = await loadIpcModule()
  const previousWindow = global.window
  const calls = []
  global.window = {
    electronAPI: {
      onEditorTextRequest(handler) {
        calls.push({ type: 'text', handler })
      },
      onEditorSetText(handler) {
        calls.push({ type: 'set', handler })
      },
    },
  }

  try {
    attachTiptapIpc({
      readObservablePayload() {
        return 'payload'
      },
      applyIncomingPayload() {},
    })

    const state = getTiptapIpcDebugState()
    assert.equal(state.hasCurrentSessionRef, true)
    assert.equal(state.listenerCount, 0)
    assert.deepEqual(calls, [])
  } finally {
    detachTiptapIpc()
    if (previousWindow === undefined) {
      delete global.window
    } else {
      global.window = previousWindow
    }
  }
})
