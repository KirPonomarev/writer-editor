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

test('tiptap runtime bridge: canonical bold command id prefers focused chain execution when available', async () => {
  const { createTiptapRuntimeBridge } = await loadRuntimeBridgeModule()
  let directCalls = 0
  const trace = []
  const bridge = createTiptapRuntimeBridge({
    editor: {
      commands: {
        toggleBold() {
          directCalls += 1
          return true
        },
      },
      chain() {
        return {
          focus() {
            trace.push('focus')
            return this
          },
          toggleBold() {
            trace.push('toggleBold')
            return this
          },
          run() {
            trace.push('run')
            return true
          },
        }
      },
    },
  })

  const result = bridge.handleRuntimeCommand({ commandId: 'cmd.project.format.toggleBold' })
  assert.equal(directCalls, 0)
  assert.deepEqual(trace, ['focus', 'toggleBold', 'run'])
  assert.deepEqual(result, {
    handled: true,
    result: { performed: true, action: 'toggleBold', reason: null },
    commandId: 'cmd.project.format.toggleBold',
  })
})

test('tiptap runtime bridge: canonical italic command id prefers focused chain execution when available', async () => {
  const { createTiptapRuntimeBridge } = await loadRuntimeBridgeModule()
  let directCalls = 0
  const trace = []
  const bridge = createTiptapRuntimeBridge({
    editor: {
      commands: {
        toggleItalic() {
          directCalls += 1
          return true
        },
      },
      chain() {
        return {
          focus() {
            trace.push('focus')
            return this
          },
          toggleItalic() {
            trace.push('toggleItalic')
            return this
          },
          run() {
            trace.push('run')
            return true
          },
        }
      },
    },
  })

  const result = bridge.handleRuntimeCommand({ commandId: 'cmd.project.format.toggleItalic' })
  assert.equal(directCalls, 0)
  assert.deepEqual(trace, ['focus', 'toggleItalic', 'run'])
  assert.deepEqual(result, {
    handled: true,
    result: { performed: true, action: 'toggleItalic', reason: null },
    commandId: 'cmd.project.format.toggleItalic',
  })
})

test('tiptap runtime bridge: canonical underline command id prefers focused chain execution when available', async () => {
  const { createTiptapRuntimeBridge } = await loadRuntimeBridgeModule()
  let directCalls = 0
  const trace = []
  const bridge = createTiptapRuntimeBridge({
    editor: {
      commands: {
        toggleUnderline() {
          directCalls += 1
          return true
        },
      },
      chain() {
        return {
          focus() {
            trace.push('focus')
            return this
          },
          toggleUnderline() {
            trace.push('toggleUnderline')
            return this
          },
          run() {
            trace.push('run')
            return true
          },
        }
      },
    },
  })

  const result = bridge.handleRuntimeCommand({ commandId: 'cmd.project.format.toggleUnderline' })
  assert.equal(directCalls, 0)
  assert.deepEqual(trace, ['focus', 'toggleUnderline', 'run'])
  assert.deepEqual(result, {
    handled: true,
    result: { performed: true, action: 'toggleUnderline', reason: null },
    commandId: 'cmd.project.format.toggleUnderline',
  })
})

test('tiptap runtime bridge: canonical clear list command id preserves clearList action while using focused chain', async () => {
  const { createTiptapRuntimeBridge } = await loadRuntimeBridgeModule()
  let directCalls = 0
  const trace = []
  const bridge = createTiptapRuntimeBridge({
    editor: {
      commands: {
        toggleBulletList() {
          directCalls += 1
          return true
        },
      },
      isActive(markName) {
        return markName === 'bulletList'
      },
      chain() {
        return {
          focus() {
            trace.push('focus')
            return this
          },
          toggleBulletList() {
            trace.push('toggleBulletList')
            return this
          },
          run() {
            trace.push('run')
            return true
          },
        }
      },
    },
  })

  const result = bridge.handleRuntimeCommand({ commandId: 'cmd.project.list.clear' })
  assert.equal(directCalls, 0)
  assert.deepEqual(trace, ['focus', 'toggleBulletList', 'run'])
  assert.deepEqual(result, {
    handled: true,
    result: { performed: true, action: 'clearList', reason: null },
    commandId: 'cmd.project.list.clear',
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

test('tiptap runtime bridge: canonical text color picker command id delegates only to runtime handler callback', async () => {
  const { createTiptapRuntimeBridge } = await loadRuntimeBridgeModule()
  const calls = []
  const bridge = createTiptapRuntimeBridge({
    runtimeHandlers: {
      formatTextColorPicker(commandId, payload) {
        calls.push({ commandId, payload })
        return {
          performed: true,
          action: 'textColorPicker',
          reason: null,
        }
      },
    },
  })

  const payload = { source: 'toolbar' }
  const result = bridge.handleRuntimeCommand({
    commandId: 'cmd.project.format.textColorPicker',
    payload,
  })

  assert.deepEqual(calls, [
    {
      commandId: 'cmd.project.format.textColorPicker',
      payload,
    },
  ])
  assert.deepEqual(result, {
    handled: true,
    result: { performed: true, action: 'textColorPicker', reason: null },
    commandId: 'cmd.project.format.textColorPicker',
  })
})

test('tiptap runtime bridge: canonical highlight color picker command id propagates negative callback result', async () => {
  const { createTiptapRuntimeBridge } = await loadRuntimeBridgeModule()
  const bridge = createTiptapRuntimeBridge({
    runtimeHandlers: {
      formatHighlightColorPicker() {
        return {
          performed: false,
          action: 'highlightColorPicker',
          reason: 'EDITOR_MODE_UNSUPPORTED',
        }
      },
    },
  })

  const result = bridge.handleRuntimeCommand({
    commandId: 'cmd.project.format.highlightColorPicker',
    payload: { source: 'toolbar' },
  })

  assert.deepEqual(result, {
    handled: true,
    result: { performed: false, action: 'highlightColorPicker', reason: 'EDITOR_MODE_UNSUPPORTED' },
    commandId: 'cmd.project.format.highlightColorPicker',
  })
})

test('tiptap tiptap index: underline link color and highlight extensions are configured inertly and expose the bounded command API', () => {
  const filePath = path.join(ROOT, 'src', 'renderer', 'tiptap', 'index.js')
  const source = fs.readFileSync(filePath, 'utf8')

  assert.ok(source.includes("import Color from '@tiptap/extension-color'"))
  assert.ok(source.includes("import Highlight from '@tiptap/extension-highlight'"))
  assert.ok(source.includes("import { UserBookmarks, UserBookmarkLink, applyUserBookmarkPublication } from './userBookmarks.mjs'"))
  const bookmarkSource = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'tiptap', 'userBookmarks.mjs'), 'utf8')
  assert.ok(bookmarkSource.includes("import Link from '@tiptap/extension-link'"))
  assert.ok(bookmarkSource.includes('UserBookmarkLink = Link.extend({'))
  assert.ok(bookmarkSource.includes('...this.parent?.()'))
  assert.ok(source.includes("import { DocumentTextStyle } from './documentTextStyle.mjs'"))
  assert.ok(source.includes("import Underline from '@tiptap/extension-underline'"))
  assert.ok(source.includes('StarterKit.configure({'))
  assert.ok(source.includes('link: false'))
  assert.ok(source.includes('underline: false'))
  assert.ok(source.includes('DocumentTextStyle,'))
  assert.ok(source.includes('Color,'))
  assert.ok(source.includes('Highlight.configure({'))
  assert.ok(source.includes('multicolor: true'))
  assert.ok(source.includes('Underline,'))
  assert.ok(source.includes('UserBookmarkLink.configure({'))
  assert.ok(source.includes('autolink: false'))
  assert.ok(source.includes('linkOnPaste: false'))
  assert.ok(source.includes('openOnClick: false'))
  assert.ok(source.includes("underline: Boolean(editor.isActive('underline'))"))
  assert.ok(source.includes('textColor,'))
  assert.ok(source.includes('textColorActive: textColor.length > 0'))
  assert.ok(source.includes('highlightColor,'))
  assert.ok(source.includes('highlightActive,'))
  assert.ok(source.includes("const linkActive = Boolean(editor.isActive('link'))"))
  assert.ok(source.includes('link: linkActive'))
  assert.ok(source.includes('linkActive,'))
  assert.ok(source.includes("if (commandName === 'toggleUnderline')"))
  assert.ok(source.includes("if (commandName === 'setColor')"))
  assert.ok(source.includes("if (commandName === 'unsetColor')"))
  assert.ok(source.includes("if (commandName === 'setHighlight')"))
  assert.ok(source.includes("if (commandName === 'unsetHighlight')"))
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
    'toggle-preview',
    'toggle-preview-frame',
    'switch-preview-format-a4',
    'switch-preview-format-a5',
    'switch-preview-format-letter',
    'switch-preview-orientation-portrait',
    'switch-preview-orientation-landscape',
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

async function treeDocumentAdapter(doc) {
  const vm = require('node:vm');
  const { Editor } = await import('@tiptap/core');
  const { default: StarterKit } = await import('@tiptap/starter-kit');
  const pm = await import('@tiptap/pm/state');
  const historyApi = await import('@tiptap/pm/history');
  const { WordPendingRevisions, setCheckedDocument } = await import(pathToFileURL(path.join(ROOT, 'src/renderer/tiptap/wordPendingRevisions.mjs')));
  const { UserBookmarks } = await import(pathToFileURL(path.join(ROOT, 'src/renderer/tiptap/userBookmarks.mjs')));
  const { ManuscriptNoteReferences } = await import(pathToFileURL(path.join(ROOT, 'src/renderer/tiptap/manuscriptNotes.mjs')));
  const { DocumentSections } = await import(pathToFileURL(path.join(ROOT, 'src/renderer/tiptap/documentSections.mjs')));
  const editor = new Editor({ element: null, extensions: [StarterKit.configure({ trailingNode: false }),
    WordPendingRevisions, UserBookmarks, ManuscriptNoteReferences, DocumentSections], content: doc });
  let markerInitializations = 0;
  const marker = new pm.Plugin({ key: new pm.PluginKey('treeResetSentinel'), state: {
    init() { markerInitializations++; return { retained: true }; }, apply(_tr, previous) { return previous; },
  } });
  editor.view.updateState(editor.state.reconfigure({ plugins: [...editor.extensionManager.plugins, marker] }));
  const c = { currentEditorInstance: editor, document: {}, getFocusedManuscriptBodyEditor: () => null,
    history: historyApi.history, setCheckedReviewDocument: setCheckedDocument,
    wordSections: require('../../src/core/word-sections-v1.cjs'), notifyFormattingStateChange() {} };
  const source = fs.readFileSync(path.join(ROOT, 'src/renderer/tiptap/index.js'), 'utf8');
  const functions = ['getTiptapRootSplitBoundary', 'replaceTiptapTreeDocumentSnapshot', 'setCheckedDocument'].map(name => {
    const match = new RegExp(`^(?:export )?function ${name}\\(`, 'm').exec(source);
    assert.ok(match, name); const end = source.indexOf('\n}\n', match.index);
    return source.slice(match.index, end + 2).replace(/^export /, '');
  }).join('\n');
  vm.createContext(c); vm.runInContext(functions, c);
  return { c, editor, marker, historyApi, pm, markerInitializations: () => markerInitializations };
}

const treeParagraph = text => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] });

test('actual PM root split observation excludes first, nested, range and interior selections', async () => {
  const doc = { type: 'doc', content: [treeParagraph('Left 🧭'), { type: 'heading', attrs: { level: 2 },
    content: [{ type: 'text', text: 'Right' }] }, { type: 'bulletList', content: [
    { type: 'listItem', content: [treeParagraph('Nested')] },
  ] }] };
  const { c, editor, pm } = await treeDocumentAdapter(doc);
  const at = (from, to = from) => editor.view.dispatch(editor.state.tr.setSelection(pm.TextSelection.create(editor.state.doc, from, to)));
  at(1); assert.equal(c.getTiptapRootSplitBoundary(), null);
  const rootStart = editor.state.doc.child(0).nodeSize + 1;
  at(rootStart);
  assert.deepEqual(JSON.parse(JSON.stringify(c.getTiptapRootSplitBoundary())), { boundaryRootIndex: 1, position: rootStart });
  at(rootStart, rootStart + 2); assert.equal(c.getTiptapRootSplitBoundary(), null);
  at(rootStart + 1); assert.equal(c.getTiptapRootSplitBoundary(), null);
  const nestedStart = editor.state.doc.child(0).nodeSize + editor.state.doc.child(1).nodeSize + 3;
  at(nestedStart); assert.equal(c.getTiptapRootSplitBoundary(), null);
  at(rootStart); c.getFocusedManuscriptBodyEditor = () => ({});
  assert.equal(c.getTiptapRootSplitBoundary(), null);
  editor.destroy();
});

test('actual Tiptap checked structural replacement resets only text history and preserves extensions and subsequent Undo', async () => {
  const { c, editor, marker, historyApi, markerInitializations } = await treeDocumentAdapter({ type: 'doc', content: [treeParagraph('Left'), treeParagraph('Right')] });
  editor.view.dispatch(editor.state.tr.insertText(' edit', 5));
  assert.equal(historyApi.undoDepth(editor.state), 1);
  const originalPlugins = editor.state.plugins, markerState = marker.getState(editor.state);
  const registry = { schemaVersion: 'yalken.word-user-bookmarks.v1', sceneId: 'scene', revision: 0, bookmarks: [] };
  const next = { type: 'doc', attrs: { wordUserBookmarks: registry }, content: [treeParagraph('Left')] };
  assert.equal(c.replaceTiptapTreeDocumentSnapshot({ doc: next }), true);
  assert.equal(editor.state.doc.textContent, 'Left');
  assert.deepEqual(editor.state.doc.attrs.wordUserBookmarks, registry);
  assert.deepEqual(editor.state.plugins, originalPlugins);
  assert.equal(marker.getState(editor.state), markerState); assert.equal(markerInitializations(), 1);
  assert.equal(historyApi.undoDepth(editor.state), 0); assert.equal(historyApi.redoDepth(editor.state), 0);
  assert.equal(editor.commands.undo(), false); assert.equal(editor.state.doc.textContent, 'Left');
  editor.view.dispatch(editor.state.tr.insertText('!', 5));
  assert.equal(editor.commands.undo(), true); assert.equal(editor.state.doc.textContent, 'Left');
  assert.equal(editor.commands.redo(), true); assert.equal(editor.state.doc.textContent, 'Left!');
  const before = editor.state;
  assert.equal(c.replaceTiptapTreeDocumentSnapshot({ doc: { type: 'doc', content: [{ type: 'not-a-schema-node' }] } }), false);
  assert.equal(editor.state, before); assert.equal(historyApi.undoDepth(editor.state), 1);
  assert.equal(markerInitializations(), 1);
  editor.destroy();
});
