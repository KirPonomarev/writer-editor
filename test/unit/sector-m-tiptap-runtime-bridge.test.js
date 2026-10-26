const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const ROOT = process.cwd()

test('actual status subscription exposes bounded DOCX export failure without exposing background status', () => {
  const vm = require('node:vm');
  const source = fs.readFileSync(path.join(ROOT, 'src/renderer/editor.js'), 'utf8');
  const helperStart = source.indexOf('function updateStatusText(');
  const helperEnd = source.indexOf('\nfunction updateSaveStateText(', helperStart);
  const listenerStart = source.indexOf('window.electronAPI.onStatusUpdate((status) => {');
  const listenerEnd = source.indexOf('\n  window.electronAPI.onSetDirty(', listenerStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart && listenerStart >= 0 && listenerEnd > listenerStart);
  let onStatus;
  const c = {statusElement:{textContent:'',style:{visibility:''}},heldCommandStatusMessage:false,
    window:{electronAPI:{onStatusUpdate(fn){onStatus=fn;}}},
    updateWarningStateText(){},updatePerfHintText(){},updateInspectorSnapshot(){}};
  vm.createContext(c);
  vm.runInContext(source.slice(helperStart,helperEnd)+'\n'+source.slice(listenerStart,listenerEnd),c);
  onStatus('Фоновая операция');
  assert.equal(c.statusElement.style.visibility,'');
  assert.equal(c.heldCommandStatusMessage,false);
  c.heldCommandStatusMessage=true;c.statusElement.textContent='Предыдущее сообщение';
  const failure='Не удалось экспортировать DOCX (E_REVIEW_DOCX_EXPORT_FAILED: FULL_MANUSCRIPT_INVALID).';
  onStatus(failure);
  assert.equal(c.statusElement.style.visibility,'visible');
  assert.equal(c.statusElement.textContent,failure);
  onStatus('Фоновая операция');
  assert.equal(c.statusElement.textContent,failure);
  onStatus('Не удалось экспортировать DOCX (E_REVIEW_DOCX_EXPORT_FAILED).');
  assert.equal(c.statusElement.textContent,'Не удалось экспортировать DOCX (E_REVIEW_DOCX_EXPORT_FAILED).');
  assert.equal(c.statusElement.style.visibility,'visible');
  for(const unexpected of ['Не удалось экспортировать DOCX (/private/manuscript).',
    'Не удалось экспортировать DOCX (E_REVIEW_DOCX_EXPORT_FAILED: private text).',
    'Не удалось экспортировать DOCX (E_REVIEW_DOCX_EXPORT_FAILED). extra',
    'Не удалось экспортировать DOCX (E_REVIEW_DOCX_EXPORT_FAILED: RTK_WORD_'+ 'A'.repeat(321)+').']) {
    c.heldCommandStatusMessage=false;c.statusElement.style.visibility='';onStatus(unexpected);
    assert.equal(c.statusElement.style.visibility,'');
    assert.equal(c.heldCommandStatusMessage,false);
  }
});

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
  const { DocumentStories } = await import(pathToFileURL(path.join(ROOT, 'src/renderer/tiptap/documentStories.mjs')));
  const editor = new Editor({ element: null, extensions: [StarterKit.configure({ trailingNode: false }),
    WordPendingRevisions, UserBookmarks, ManuscriptNoteReferences, DocumentSections, DocumentStories], content: doc });
  let markerInitializations = 0;
  const marker = new pm.Plugin({ key: new pm.PluginKey('treeResetSentinel'), state: {
    init() { markerInitializations++; return { retained: true }; }, apply(_tr, previous) { return previous; },
  } });
  editor.view.updateState(editor.state.reconfigure({ plugins: [...editor.extensionManager.plugins, marker] }));
  const c = { currentEditorInstance: editor, document: {}, getFocusedManuscriptBodyEditor: () => null,
    history: historyApi.history, setCheckedReviewDocument: setCheckedDocument,
    wordSections: require('../../src/core/word-sections-v1.cjs'),
    wordStories: require('../../src/core/word-stories-v1.cjs'), notifyFormattingStateChange() {} };
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

// Startup admission: FINITE_HEADLESS_NOT_BROWSER. Actual production functions,
// installed real Editor/PM, with only mount/focus and known empty-HTML ports.
function startupActualFunction(source, name) {
  const match = new RegExp('^(?:export )?(?:async )?function ' + name + '\\(', 'm').exec(source); assert.ok(match, name);
  const end = source.indexOf('\n}\n', match.index); assert.ok(end > match.index); return source.slice(match.index, end + 2).replace(/^export /, '');
}
async function startupRealInit(t) {
  const vm = require('node:vm'), { Editor: ActualEditor } = await import('@tiptap/core');
  const c = { console, currentEditorInstance: null, currentIpcSession: null, currentRuntimeBridge: null, currentFormattingStateHandler: null,
    unloadHookBound: false, runtimeCommandListenerAttached: false, recoveryRestoredListenerAttached: false, userBookmarkManageHandler: null };
  const modules = ['documentCommentEditIntents', 'documentStories', 'documentSections', 'documentBreaks', 'documentListNumbering', 'documentListItems',
    'documentHeadings', 'documentTextStyle', 'documentParagraphAlignment', 'documentTables', 'documentMedia', 'manuscriptNotes', 'wordPendingRevisions', 'userBookmarks'];
  for (const name of modules) Object.assign(c, await import(pathToFileURL(path.join(ROOT, 'src/renderer/tiptap', name + '.mjs')).href));
  for (const [name, spec] of [['StarterKit', '@tiptap/starter-kit'], ['Color', '@tiptap/extension-color'], ['Highlight', '@tiptap/extension-highlight'], ['Underline', '@tiptap/extension-underline']]) c[name] = (await import(spec)).default;
  // VM configuration objects cross a realm. Copy their exact own fields into
  // the real extension realm; preserve functions, booleans and all keys.
  for (const name of ['StarterKit', 'Highlight', 'DocumentListNumbering', 'UserBookmarkLink']) {
    const actual = c[name]; c[name] = Object.create(actual); c[name].configure = raw => actual.configure({ ...raw });
  }
  Object.assign(c, await loadIpcModule()); c.createTiptapRuntimeBridge = (await loadRuntimeBridgeModule()).createTiptapRuntimeBridge;
  const listeners = new Map(), constructorOptions = [], focusCalls = [];
  class Mount {
    constructor(tag) { this.tagName = tag; this.attrs = {}; this.children = []; this.text = ''; this.classList = { add() {} }; }
    getAttribute(key) { return this.attrs[key] ?? null; } setAttribute(key, value) { this.attrs[key] = value; } removeAttribute(key) { delete this.attrs[key]; }
    appendChild(node) { this.children.push(node); return node; }
    set innerHTML(value) { assert.equal(value, ''); this.text = ''; this.children = []; this.clearCount = (this.clearCount || 0) + 1; }
    get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
  }
  const mount = new Mount('div'); mount.text = 'Retained pre-init bytes e\u0301 🧭'; mount.attrs = { role: 'textbox', 'aria-label': 'Текст сцены', contenteditable: 'true' };
  c.document = { createElement: tag => new Mount(tag), getElementById: () => null };
  c.window = { electronAPI: { onRuntimeCommand: handler => listeners.set('runtime', handler), onRecoveryRestored: handler => listeners.set('recovery', handler) }, addEventListener: (name, handler) => listeners.set(name, handler) };
  c.Editor = function(options) {
    assert.equal(options.content, '<p></p>', 'only the exact known initial DOM-parsed empty content may be adapted');
    constructorOptions.push({ content: options.content, editableOwn: Object.hasOwn(options, 'editable'), editable: options.editable ?? null,
      extensionNames: options.extensions.map(extension => extension.name), attributes: { ...options.editorProps.attributes } });
    const editor = new ActualEditor({ ...options, element: null, content: { type: 'doc', content: [{ type: 'paragraph' }] } });
    editor.view.updateState(editor.state.reconfigure({ plugins: editor.extensionManager.plugins }));
    const chain = editor.chain.bind(editor); editor.chain = (...args) => { const actual = chain(...args); actual.focus = (...values) => { focusCalls.push(values); return actual; }; return actual; };
    return editor;
  };
  const source = fs.readFileSync(path.join(ROOT, 'src/renderer/tiptap/index.js'), 'utf8'); vm.createContext(c);
  vm.runInContext(['initTiptap', 'destroyCurrentEditor', 'ensureRuntimeListenersAttached', 'notifyFormattingStateChange'].map(name => startupActualFunction(source, name)).join('\n'), c);
  const editor = c.initTiptap(mount, { attachIpc: false }); assert.equal(editor instanceof ActualEditor, true); t.after(() => c.destroyCurrentEditor());
  return { c, editor, listeners, mount, constructorOptions, focusCalls };
}

test('initial production TipTap construction keeps authoring unavailable before first current document [FINITE_HEADLESS_NOT_BROWSER]', async t => {
  const h = await startupRealInit(t); assert.equal(h.constructorOptions.length, 1); assert.equal(h.mount.clearCount, 1); assert.equal(h.mount.textContent, '');
  assert.equal(h.editor.state.doc.textContent, ''); assert.ok(h.editor.state.plugins.length > 0);
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_INIT_TIPTAP_AND_REAL_CONSTRUCTOR', options: h.constructorOptions, effectiveEditable: h.editor.isEditable, clearedMount: true, actualPmDocument: h.editor.state.doc.toJSON(), finiteHeadlessNotBrowser: true }));
  assert.equal(h.editor.isEditable, false, 'a blank primary editor cannot accept authoring before its first current document');
});

test('initial production runtime subscription cannot mutate a readonly document through the list bridge [FINITE_HEADLESS_NOT_BROWSER]', async t => {
  const h = await startupRealInit(t); h.editor.setEditable(false); assert.equal(h.editor.isEditable, false);
  const before = h.editor.state.doc.toJSON(), listener = h.listeners.get('runtime'); assert.equal(typeof listener, 'function');
  listener({ commandId: 'cmd.project.list.toggleBullet' }); const after = h.editor.state.doc.toJSON();
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_INDEX_RUNTIME_LISTENER_AND_REAL_PM_LIST_COMMAND', editable: h.editor.isEditable, before, after, presentationFocusCalls: h.focusCalls.length, finiteHeadlessNotBrowser: true }));
  assert.deepEqual(after, before, 'the initial unavailable editor cannot acquire authored list structure via the existing runtime bridge');
});

test('actual checked document adapter retains Unicode edits and real Undo Redo after legal adoption [FINITE_PM_NOT_BROWSER]', async t => {
  const first = { type: 'doc', content: [treeParagraph('Saved e\u0301 🧭')] }, second = { type: 'doc', content: [treeParagraph('Current 👩🏽‍💻 e\u0301')] };
  const { c, editor } = await treeDocumentAdapter(first); t.after(() => editor.destroy());
  assert.equal(c.replaceTiptapTreeDocumentSnapshot({ doc: second }), true); assert.equal(editor.state.doc.textContent, 'Current 👩🏽‍💻 e\u0301');
  const before = editor.state.doc.toJSON(); editor.view.dispatch(editor.state.tr.insertText(' author 🧭', editor.state.doc.content.size - 1)); const edited = editor.state.doc.toJSON();
  assert.notDeepEqual(edited, before); assert.equal(editor.commands.undo(), true); assert.deepEqual(editor.state.doc.toJSON(), before);
  assert.equal(editor.commands.redo(), true); assert.deepEqual(editor.state.doc.toJSON(), edited);
  const state = editor.state; assert.equal(c.replaceTiptapTreeDocumentSnapshot({ doc: { type: 'doc', content: [{ type: 'not-a-schema-node' }] } }), false);
  assert.equal(editor.state, state); assert.deepEqual(editor.state.doc.toJSON(), edited);
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_CHECKED_PM_ADOPTION_UNICODE_UNDO_REDO_AND_FAILED_ADOPTION_RETENTION', edited, finitePmNotBrowser: true }));
});

// FINITE_PM_NOT_BROWSER: actual installed Editor, production init/onUpdate,
// complete adoption callback, parser, checked adapter and dirty/autosave chain.
// Presentation and timer/lifecycle ports only observe; no filesystem or Save ACK.
async function startupAdoptionDirtyHarness(t, { reviewLock = false } = {}) {
  const vm = require('node:vm'), h = await startupRealInit(t);
  const tiptapSource = fs.readFileSync(path.join(ROOT, 'src/renderer/tiptap/index.js'), 'utf8');
  const rendererSource = fs.readFileSync(path.join(ROOT, 'src/renderer/editor.js'), 'utf8');
  const envelope = require('../../src/core/document-content-envelope-v1.cjs');
  const realCheckedReviewDocument = h.c.setCheckedDocument;
  Object.assign(h.c, {
    history: (await import('@tiptap/pm/history')).history,
    setCheckedReviewDocument: realCheckedReviewDocument,
    wordSections: require('../../src/core/word-sections-v1.cjs'),
    wordStories: require('../../src/core/word-stories-projection-v1.cjs'),
    wordListNumbering: require('../../src/core/word-list-numbering-v1.cjs'),
    buildParagraphDocumentFromText: envelope.buildParagraphDocumentFromText,
  });
  vm.runInContext(['setCheckedDocument', 'setTiptapDocumentSnapshot', 'getTiptapPlainText', 'readEditorText']
    .map(name => startupActualFunction(tiptapSource, name)).join('\n'), h.c);
  const signals = [], timers = new Map(), updates = [], parses = [], adoptions = [], presentation = [];
  let incoming, timerSequence = 0;
  const c = {
    console, isTiptapMode: true, primaryTiptapEditor: null,
    editor: { isConnected: true, dataset: reviewLock ? { reviewFormattingPreviousEditable: 'true' } : {},
      removeAttribute(name) { presentation.push(['removeAttribute', name]); } },
    initialDocumentAdopted: false, initialDocumentFailureStatus: null, heldCommandStatusMessage: false,
    statusElement: { textContent: '', style: { visibility: '' } }, warningStateElement: { textContent: '' }, recoveryMessage: { textContent: '' },
    currentProjectId: 'project-startup-dirty', currentDocumentId: null, currentDocumentKind: null,
    currentDocumentTitle: '', localEditGeneration: 0, lastAckedGeneration: 0, localDirty: false,
    currentCards: [], currentMeta: envelope.createDefaultDocumentMeta(), metaEnabled: false, plainTextBuffer: '',
    activeDocumentRevealRequested: false, currentRightTab: 'metadata', currentTreeContentPublicationId: '',
    currentMetadataBaselineHash: '', metadataUpdatePending: false, treeDetachedOrigin: null,
    storyDrafts: new Map(), manuscriptDrafts: new Map(), storyMutationPending: false, notesMutationPending: false,
    wordCommentDraft: null, wordCommentBusy: false, pendingStoryRequestId: null,
    flowModeState: { active: false }, centralSheetStripPendingStructuralInput: false,
    centralSheetStripLargePayloadFastPathActive: false, autoSaveTimerId: null, AUTO_SAVE_DELAY: 400,
    nowMs: () => 0,
    window: {
      electronAPI: {
        onEditorSetText(handler) { incoming = handler; },
        // Deliberately empty result: observation is not a synthetic successful ACK.
        async invokeSaveLifecycleSignalBridge(request) { signals.push(JSON.parse(JSON.stringify(request))); return {}; },
      },
      setTimeout(callback, delay) { const id = ++timerSequence; timers.set(id, { callback, delay }); return id; },
    },
    clearTimeout(id) { timers.delete(id); },
    parseObservablePayload: envelope.parseObservablePayload,
    getTiptapPlainText: () => h.c.getTiptapPlainText(),
    setTiptapDocumentSnapshot(snapshot) {
      const result = h.c.setTiptapDocumentSnapshot(snapshot);
      adoptions.push({ resetHistory: snapshot.resetHistory, accepted: result, hasDoc: Boolean(snapshot.doc) }); return result;
    },
    shouldUseCentralSheetLargePayloadFastPath: () => false,
    reviewSurfaceResolveIncomingPayload: () => null,
    revealActiveDocumentAncestors: () => ({ found: false }),
    requestAnimationFrame(callback) { presentation.push(['selectionFrame', callback]); },
  };
  for (const name of ['cancelLinkDialog', 'invalidateAtlasPublications', 'clearFlowModeState', 'clearPendingMetadataUpdate',
    'applyIncomingBookProfile', 'setReviewSurfaceState', 'clearCentralSheetLargePayloadFastPath', 'resetCentralSheetStripForIncomingPayload',
    'updateMetaInputs', 'updateMetaVisibility', 'updateCardsList', 'updateWordCount', 'scheduleCentralSheetStripProofRefresh',
    'showEditorPanelFor', 'renderTree', 'updateSaveStateText', 'refreshManuscriptNoteReferences', 'refreshVisibleCommentProjection',
    'updatePerfHintText', 'updateInspectorSnapshot', 'refreshMetadataInspector', 'applyPendingProjectSearchJump',
    'syncVisibleAuthoringSurfacesSurface', 'scheduleIncrementalInputDomSync', 'scheduleDeferredHotpathRender',
    'scheduleDeferredPaginationRefresh', 'scheduleCentralSheetStripPostStructuralRefresh', 'scheduleWordCountRefresh',
    'recordWriterRuntimeBudget']) c[name] = (...args) => { presentation.push([name, ...args]); };
  vm.createContext(c);
  vm.runInContext(['parseDocumentContent', 'normalizeProjectId', 'isProjectTreeDocumentId', 'holdInitialDocumentFailure',
    'handleDocumentContentParseIssue', 'updateStatusText', 'updateWarningStateText', 'syncPlainTextBufferFromEditorDom',
    'invokeSaveLifecycleSignalBridge', 'scheduleAutoSave', 'markAsModified', 'handleTiptapDocumentUpdate']
    .map(name => startupActualFunction(rendererSource, name)).join('\n'), c);
  const parse = c.parseDocumentContent;
  c.parseDocumentContent = content => { const result = parse(content); parses.push({ issue: result.issue, doc: result.doc }); return result; };
  const editor = h.c.initTiptap(h.mount, { attachIpc: false, onDocumentUpdate: () => c.handleTiptapDocumentUpdate() });
  // FINITE_PM lifecycle projection from the SDK public headless view;
  // this does not establish mounted DOM, browser or native liveness.
  const lifecycleFacade = new Proxy(editor, { get(target, key) {
    if (key === 'isDestroyed') return target.view.isDestroyed;
    const value = Reflect.get(target, key, target);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
  c.primaryTiptapEditor = lifecycleFacade;
  h.c.currentEditorInstance = lifecycleFacade;
  editor.on('update', ({ transaction }) => updates.push({ docChanged: transaction.docChanged, text: editor.state.doc.textContent }));
  const start = rendererSource.indexOf('window.electronAPI.onEditorSetText((payload) => {');
  const end = rendererSource.indexOf('  window.electronAPI.onEditorTextRequest(', start);
  assert.ok(start >= 0 && end > start, 'complete production adoption callback boundaries');
  vm.runInContext(rendererSource.slice(start, end), c);
  const observe = label => ({ label, finitePmNotBrowser: true, actualInitCount: h.constructorOptions.length,
    lifecycle: { actualEditorIsDestroyed: editor.isDestroyed, publicSdkViewIsDestroyed: editor.view.isDestroyed,
      facadeIsDestroyed: lifecycleFacade.isDestroyed, mountedBrowserOrNativeLivenessClaim: false },
    editable: editor.isEditable, adopted: c.initialDocumentAdopted, failure: c.initialDocumentFailureStatus,
    generation: c.localEditGeneration, lastAckedGeneration: c.lastAckedGeneration, dirty: c.localDirty,
    text: h.c.getTiptapPlainText(), signals: JSON.parse(JSON.stringify(signals)),
    timerCount: timers.size, timerDelays: [...timers.values()].map(item => item.delay),
    updates: JSON.parse(JSON.stringify(updates)), parses: JSON.parse(JSON.stringify(parses)), adoptions: [...adoptions] });
  const flushAutoSave = async () => {
    for (const [id, entry] of [...timers]) { timers.delete(id); entry.callback(); }
    // Await the actual async bridge, acknowledgement observer and finally chain.
    for (let i = 0; i < 8; i++) await Promise.resolve();
  };
  return { c, editor, incoming: payload => incoming(payload), observe, flushAutoSave, updates, signals, timers };
}

const startupDirtySavedText = 'Saved e\u0301 🧭\nCurrent 👩🏽‍💻';
function startupDirtyPayload(content = startupDirtySavedText) {
  return { content, documentId: 'tree-node-' + 'a'.repeat(32), projectId: 'project-startup-dirty', kind: 'scene', title: 'Saved', metaEnabled: false };
}

test('first actual authoritative plain adoption enables authoring without dirty generation or autosave [FINITE_PM_NOT_BROWSER]', async t => {
  const h = await startupAdoptionDirtyHarness(t);
  h.incoming(startupDirtyPayload()); const loaded = h.observe('first-authoritative-plain-adoption');
  await h.flushAutoSave(); const afterTimer = h.observe('after-finite-timer-drain');
  t.diagnostic(JSON.stringify({ loaded, afterTimer }));
  assert.equal(loaded.actualInitCount, 2); assert.equal(loaded.adopted, true); assert.equal(loaded.editable, true);
  assert.equal(loaded.text, startupDirtySavedText); assert.equal(loaded.adoptions.length, 1); assert.equal(loaded.adoptions[0].accepted, true);
  assert.equal(loaded.generation, 0, 'authoritative enable is not an author edit');
  assert.equal(loaded.lastAckedGeneration, 0); assert.equal(loaded.dirty, false);
  assert.deepEqual(loaded.signals, []); assert.equal(loaded.timerCount, 0);
  assert.deepEqual(afterTimer.signals, []); assert.equal(afterTimer.generation, 0); assert.equal(afterTimer.dirty, false);
});

test('actual Unicode insertion and real Undo Redo retain dirty and autosave notifications after adoption [FINITE_PM_NOT_BROWSER]', async t => {
  const h = await startupAdoptionDirtyHarness(t);
  h.incoming(startupDirtyPayload()); const initial = h.observe('initial-observed-separately');
  await h.flushAutoSave(); const baseline = h.observe('initial-timer-drain-observed-separately');
  const before = h.editor.state.doc.toJSON(), suffix = ' authored e\u0301 🧭';
  h.editor.view.dispatch(h.editor.state.tr.insertText(suffix, h.editor.state.doc.content.size - 1));
  const inserted = h.observe('actual-unicode-transaction'), edited = h.editor.state.doc.toJSON();
  const undone = h.editor.commands.undo(), afterUndo = h.observe('actual-undo'), undoDoc = h.editor.state.doc.toJSON();
  const redone = h.editor.commands.redo(), afterRedo = h.observe('actual-redo'), redoDoc = h.editor.state.doc.toJSON();
  await h.flushAutoSave(); const final = h.observe('actual-autosave-request-no-ack');
  t.diagnostic(JSON.stringify({ initial, baseline, inserted, undone, afterUndo, redone, afterRedo, final }));
  assert.equal(initial.editable, true); assert.equal(initial.adopted, true);
  assert.equal(inserted.text, startupDirtySavedText + suffix); assert.notDeepEqual(edited, before);
  assert.equal(undone, true); assert.deepEqual(undoDoc, before); assert.equal(redone, true); assert.deepEqual(redoDoc, edited);
  for (const [offset, state] of [[1, inserted], [2, afterUndo], [3, afterRedo]]) {
    assert.equal(state.generation, initial.generation + offset); assert.equal(state.dirty, true); assert.equal(state.timerCount, 1);
    assert.equal(state.signals.filter(item => item.signalId === 'signal.localDirty.set').length,
      initial.signals.filter(item => item.signalId === 'signal.localDirty.set').length + offset);
    assert.deepEqual(state.signals.at(-1), { signalId: 'signal.localDirty.set', payload: { state: true, generation: state.generation } });
    assert.equal(state.updates.at(-1).docChanged, true);
  }
  assert.equal(final.signals.filter(item => item.signalId === 'signal.autoSave.request').length,
    baseline.signals.filter(item => item.signalId === 'signal.autoSave.request').length + 1);
  assert.equal(final.lastAckedGeneration, initial.lastAckedGeneration, 'empty observation result cannot acknowledge an edit');
  assert.equal(final.dirty, true); assert.equal(final.timerCount, 0);
});

for (const specimen of ['invalid-first-parse', 'invalid-first-schema', 'review-readonly-lock']) {
  test('actual adoption preserves unavailable authoring for ' + specimen + ' [FINITE_PM_NOT_BROWSER]', async t => {
    const h = await startupAdoptionDirtyHarness(t, { reviewLock: specimen === 'review-readonly-lock' });
    const before = h.editor.state, raw = JSON.stringify({ type: 'doc', content: [{ type: 'not-a-schema-node' }] });
    const content = specimen === 'invalid-first-parse' ? '[doc-v2 length=100]\n{' : specimen === 'invalid-first-schema'
      ? `[doc-v2 length=${raw.length}]\n${raw}` : startupDirtySavedText;
    h.incoming(startupDirtyPayload(content)); const observed = h.observe(specimen);
    await h.flushAutoSave(); const afterTimer = h.observe(specimen + '-timer-drain');
    t.diagnostic(JSON.stringify({ observed, afterTimer }));
    assert.equal(observed.editable, false); assert.equal(observed.generation, 0); assert.equal(observed.dirty, false);
    assert.deepEqual(observed.signals, []); assert.equal(observed.timerCount, 0); assert.deepEqual(afterTimer.signals, []);
    if (specimen === 'review-readonly-lock') {
      assert.equal(observed.adopted, true); assert.equal(observed.text, startupDirtySavedText); assert.equal(observed.adoptions[0].accepted, true);
    } else {
      assert.equal(observed.adopted, false); assert.equal(h.editor.state, before); assert.ok(observed.failure);
      if (specimen === 'invalid-first-parse') { assert.ok(observed.parses[0].issue); assert.deepEqual(observed.adoptions, []); }
      else { assert.equal(observed.parses[0].issue, null); assert.equal(observed.adoptions[0].accepted, false); }
    }
  });
}
