import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import {
  attachTiptapIpc,
  composeObservablePayload,
  detachTiptapIpc,
  parseObservablePayload,
} from './ipc.js'

let currentEditorInstance = null
let currentIpcSession = null
let unloadHookBound = false

function cloneDefaultMeta() {
  return {
    synopsis: '',
    status: 'черновик',
    tags: { pov: '', line: '', place: '' },
  }
}

function textToDoc(text = '') {
  const lines = String(text || '').split('\n')
  const content = lines.map((line) => {
    if (!line) {
      return { type: 'paragraph' }
    }
    return {
      type: 'paragraph',
      content: [{ type: 'text', text: line }],
    }
  })

  return {
    type: 'doc',
    content: content.length ? content : [{ type: 'paragraph' }],
  }
}

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
  if (!window.electronAPI || typeof window.electronAPI.notifyDirtyState !== 'function') {
    return
  }

  window.electronAPI.notifyDirtyState(Boolean(nextDirty))
}

function createIpcSession(editor) {
  const state = {
    metaEnabled: false,
    meta: cloneDefaultMeta(),
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
        text: readEditorText(editor),
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
        editor.commands.setContent(textToDoc(parsed.text || ''), false)
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
}

export function initTiptap(mountEl) {
  if (!mountEl) throw new Error('TipTap mount element not found (#editor)')

  destroyCurrentEditor()

  // legacy editor раньше работал через textContent; TipTapу нужен контейнер
  mountEl.innerHTML = ''
  mountEl.classList.add('tiptap-host')

  const contentEl = document.createElement('div')
  contentEl.className = 'tiptap-editor'
  mountEl.appendChild(contentEl)

  const editor = new Editor({
    element: contentEl,
    extensions: [StarterKit],
    content: '<p></p>',
    onUpdate: () => {
      currentIpcSession?.handleUpdate()
    },
  })

  currentIpcSession = createIpcSession(editor)
  attachTiptapIpc(currentIpcSession)
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
