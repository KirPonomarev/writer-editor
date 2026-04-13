import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import {
  attachTiptapIpc,
  composeObservablePayload,
  detachTiptapIpc,
  parseObservablePayload,
} from './ipc.js'
import { createTiptapRuntimeBridge } from './runtimeBridge.js'
import {
  buildParagraphDocumentFromText,
  createDefaultDocumentMeta,
  canonicalizeDocumentJson,
} from '../documentContentEnvelope.mjs'

let currentEditorInstance = null
let currentIpcSession = null
let currentRuntimeBridge = null
let unloadHookBound = false
let runtimeCommandListenerAttached = false
let recoveryRestoredListenerAttached = false

function readEditorText(editor) {
  if (!editor || typeof editor.getText !== 'function') {
    return ''
  }

  try {
    return editor.getText({ blockSeparator: '\n' })
  } catch {
    return editor.getText()
  }
}

function notifyDirtyState(nextDirty) {
  if (!window.electronAPI || typeof window.electronAPI.invokeSaveLifecycleSignalBridge !== 'function') {
    return
  }

  window.electronAPI.invokeSaveLifecycleSignalBridge({
    signalId: 'signal.localDirty.set',
    payload: { state: Boolean(nextDirty) },
  }).catch(() => {})
}

function readEditorDocument(editor) {
  if (!editor || typeof editor.getJSON !== 'function') {
    return buildParagraphDocumentFromText('')
  }

  try {
    return canonicalizeDocumentJson(editor.getJSON())
  } catch {
    return buildParagraphDocumentFromText(readEditorText(editor))
  }
}

function createIpcSession(editor, options = {}) {
  const onContentParseIssue = typeof options.onContentParseIssue === 'function'
    ? options.onContentParseIssue
    : null
  const state = {
    metaEnabled: false,
    meta: createDefaultDocumentMeta(),
    cards: [],
    path: null,
    kind: null,
    title: '',
    applyingExternalPayload: false,
  }

  return {
    editor,
    readObservablePayload() {
      return composeObservablePayload({
        doc: readEditorDocument(editor),
        metaEnabled: state.metaEnabled,
        meta: state.meta,
        cards: state.cards,
      })
    },
    applyIncomingPayload(payload) {
      const hasObjectPayload = payload && typeof payload === 'object'
      const content = typeof payload === 'string'
        ? payload
        : hasObjectPayload && typeof payload.content === 'string'
          ? payload.content
          : ''

      const parsed = parseObservablePayload(content)
      if (parsed.issue && onContentParseIssue) {
        onContentParseIssue(parsed.issue)
      }
      state.metaEnabled = hasObjectPayload ? Boolean(payload.metaEnabled) : false
      state.meta = parsed.meta
      state.cards = parsed.cards
      state.path = hasObjectPayload && Object.prototype.hasOwnProperty.call(payload, 'path')
        ? payload.path || null
        : null
      state.kind = hasObjectPayload && Object.prototype.hasOwnProperty.call(payload, 'kind')
        ? payload.kind || null
        : null
      state.title = hasObjectPayload && typeof payload.title === 'string'
        ? payload.title
        : ''

      state.applyingExternalPayload = true
      try {
        editor.commands.setContent(parsed.doc || buildParagraphDocumentFromText(parsed.text || ''), false)
      } finally {
        state.applyingExternalPayload = false
      }

      notifyDirtyState(false)
    },
    handleUpdate() {
      if (state.applyingExternalPayload) return
      notifyDirtyState(true)
    },
  }
}

function destroyCurrentEditor() {
  if (!currentEditorInstance) return

  detachTiptapIpc(currentIpcSession)
  currentEditorInstance.destroy()
  currentEditorInstance = null
  currentIpcSession = null
  currentRuntimeBridge = null
}

function ensureRuntimeListenersAttached() {
  if (!window.electronAPI) return

  if (!runtimeCommandListenerAttached && typeof window.electronAPI.onRuntimeCommand === 'function') {
    window.electronAPI.onRuntimeCommand((payload) => {
      currentRuntimeBridge?.handleRuntimeCommand(payload)
    })
    runtimeCommandListenerAttached = true
  }

  if (!recoveryRestoredListenerAttached && typeof window.electronAPI.onRecoveryRestored === 'function') {
    window.electronAPI.onRecoveryRestored((payload) => {
      currentRuntimeBridge?.handleRecoveryRestored(payload)
    })
    recoveryRestoredListenerAttached = true
  }
}

export function initTiptap(mountEl, options = {}) {
  if (!mountEl) throw new Error('TipTap mount element not found (#editor)')
  const attachIpc = options.attachIpc !== false

  destroyCurrentEditor()

  destroyCurrentEditor()

  // legacy editor раньше работал через textContent; TipTapу нужен контейнер
  mountEl.innerHTML = ''
  mountEl.classList.add('tiptap-host')
  mountEl.removeAttribute('contenteditable')
  mountEl.setAttribute('data-editor-surface', 'tiptap')

  const pageWrapEl = document.createElement('div')
  pageWrapEl.className = 'editor-page-wrap tiptap-page-wrap'

  const pageEl = document.createElement('div')
  pageEl.className = 'editor-page tiptap-page'

  const contentSurfaceEl = document.createElement('div')
  contentSurfaceEl.className = 'editor-page__content tiptap-page__content'

  const contentEl = document.createElement('div')
  contentEl.className = 'tiptap-editor'

  contentSurfaceEl.appendChild(contentEl)
  pageEl.appendChild(contentSurfaceEl)
  pageWrapEl.appendChild(pageEl)
  mountEl.appendChild(pageWrapEl)

  const editor = new Editor({
    element: contentEl,
    extensions: [StarterKit],
    content: '<p></p>',
    onUpdate: () => {
      currentIpcSession?.handleUpdate()
    },
  })

  currentIpcSession = attachIpc ? createIpcSession(editor, options) : null
  if (currentIpcSession) {
    attachTiptapIpc(currentIpcSession, {
      attachWindowListeners: options.attachWindowListeners === true,
    })
  }
  currentRuntimeBridge = createTiptapRuntimeBridge({
    editor,
    runtimeHandlers: options.runtimeHandlers || {},
    onRecoveryRestored: ({ message }) => {
      const statusElement = document.getElementById('status')
      if (statusElement) {
        statusElement.textContent = message
      }
    },
  })
  ensureRuntimeListenersAttached()
  currentEditorInstance = editor

  if (!unloadHookBound) {
    window.addEventListener('beforeunload', () => {
      destroyCurrentEditor()
    })
    unloadHookBound = true
  }

  return editor
}

export function destroyTiptap() {
  destroyCurrentEditor()
}
export function setTiptapRuntimeHandlers(runtimeHandlers = {}) {
  if (!currentRuntimeBridge || typeof currentRuntimeBridge.setRuntimeHandlers !== 'function') {
    return
  }

  currentRuntimeBridge.setRuntimeHandlers(runtimeHandlers)
}

export function getTiptapPlainText() {
  return readEditorText(currentEditorInstance)
}

export function setTiptapPlainText(text = '') {
  if (!currentEditorInstance) return
  currentEditorInstance.commands.setContent(buildParagraphDocumentFromText(text), false)
}

export function getTiptapDocumentSnapshot() {
  return {
    doc: readEditorDocument(currentEditorInstance),
    text: readEditorText(currentEditorInstance),
  }
}

export function setTiptapDocumentSnapshot(snapshot = {}) {
  if (!currentEditorInstance) return
  const doc = snapshot && snapshot.doc && typeof snapshot.doc === 'object'
    ? snapshot.doc
    : buildParagraphDocumentFromText(snapshot && typeof snapshot.text === 'string' ? snapshot.text : '')
  currentEditorInstance.commands.setContent(doc, false)
}

export function undoTiptap() {
  if (!currentEditorInstance || !currentEditorInstance.commands || typeof currentEditorInstance.commands.undo !== 'function') {
    return { performed: false }
  }

  return { performed: Boolean(currentEditorInstance.commands.undo()) }
}

export function redoTiptap() {
  if (!currentEditorInstance || !currentEditorInstance.commands || typeof currentEditorInstance.commands.redo !== 'function') {
    return { performed: false }
  }

  return { performed: Boolean(currentEditorInstance.commands.redo()) }
}
