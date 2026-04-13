import { Editor } from '@tiptap/core'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
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
let currentFormattingStateHandler = null
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

function readFormattingState(editor) {
  if (!editor || typeof editor.isActive !== 'function') {
    return {
      bold: false,
      italic: false,
      underline: false,
      link: false,
      linkActive: false,
      linkHref: '',
      selectionEmpty: true,
      bulletList: false,
      orderedList: false,
    }
  }

  const linkActive = Boolean(editor.isActive('link'))
  const linkAttributes = typeof editor.getAttributes === 'function' ? editor.getAttributes('link') : null
  const selectionEmpty = Boolean(editor.state && editor.state.selection ? editor.state.selection.empty : true)

  return {
    bold: Boolean(editor.isActive('bold')),
    italic: Boolean(editor.isActive('italic')),
    underline: Boolean(editor.isActive('underline')),
    link: linkActive,
    linkActive,
    linkHref: linkAttributes && typeof linkAttributes.href === 'string' ? linkAttributes.href : '',
    selectionEmpty,
    bulletList: Boolean(editor.isActive('bulletList')),
    orderedList: Boolean(editor.isActive('orderedList')),
  }
}

function notifyFormattingStateChange() {
  if (typeof currentFormattingStateHandler !== 'function') return
  currentFormattingStateHandler(readFormattingState(currentEditorInstance))
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
  currentFormattingStateHandler = null
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
  const nextFormattingStateHandler = typeof options.onFormattingStateChange === 'function'
    ? options.onFormattingStateChange
    : null

  destroyCurrentEditor()
  currentFormattingStateHandler = nextFormattingStateHandler

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
    extensions: [
      StarterKit.configure({
        link: false,
        underline: false,
      }),
      Underline,
      Link.configure({
        autolink: false,
        linkOnPaste: false,
        openOnClick: false,
      }),
    ],
    content: '<p></p>',
    onUpdate: () => {
      currentIpcSession?.handleUpdate()
      notifyFormattingStateChange()
    },
    onSelectionUpdate: () => {
      notifyFormattingStateChange()
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

export function setTiptapFormattingStateHandler(handler = null) {
  currentFormattingStateHandler = typeof handler === 'function' ? handler : null
  notifyFormattingStateChange()
}

export function getTiptapPlainText() {
  return readEditorText(currentEditorInstance)
}

export function setTiptapPlainText(text = '') {
  if (!currentEditorInstance) return
  currentEditorInstance.commands.setContent(buildParagraphDocumentFromText(text), false)
  notifyFormattingStateChange()
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
  notifyFormattingStateChange()
}

export function getTiptapFormattingState() {
  return readFormattingState(currentEditorInstance)
}

export function runTiptapFormatCommand(commandName, commandPayload = undefined) {
  if (!currentEditorInstance || !currentEditorInstance.commands) {
    return { performed: false, action: commandName, reason: 'EDITOR_UNAVAILABLE' }
  }

  if (commandName === 'clearList') {
    const state = readFormattingState(currentEditorInstance)
    if (state.bulletList && typeof currentEditorInstance.commands.toggleBulletList === 'function') {
      const performed = Boolean(currentEditorInstance.commands.toggleBulletList())
      notifyFormattingStateChange()
      return { performed, action: commandName, reason: performed ? null : 'COMMAND_RETURNED_FALSE' }
    }
    if (state.orderedList && typeof currentEditorInstance.commands.toggleOrderedList === 'function') {
      const performed = Boolean(currentEditorInstance.commands.toggleOrderedList())
      notifyFormattingStateChange()
      return { performed, action: commandName, reason: performed ? null : 'COMMAND_RETURNED_FALSE' }
    }
    return { performed: false, action: commandName, reason: 'LIST_NOT_ACTIVE' }
  }

  if (commandName === 'toggleUnderline') {
    if (typeof currentEditorInstance.commands.toggleUnderline !== 'function') {
      return { performed: false, action: commandName, reason: 'FORMAT_COMMAND_UNSUPPORTED' }
    }
    const performed = Boolean(currentEditorInstance.commands.toggleUnderline())
    notifyFormattingStateChange()
    return { performed, action: commandName, reason: performed ? null : 'COMMAND_RETURNED_FALSE' }
  }

  if (commandName === 'setLink') {
    const linkPayload = commandPayload && typeof commandPayload === 'object' && !Array.isArray(commandPayload)
      ? commandPayload
      : null
    if (!linkPayload || typeof linkPayload.href !== 'string' || linkPayload.href.length === 0) {
      return { performed: false, action: commandName, reason: 'LINK_PAYLOAD_INVALID' }
    }
    const href = linkPayload.href.trim()
    if (!href) {
      return { performed: false, action: commandName, reason: 'LINK_PAYLOAD_INVALID' }
    }
    const chain = typeof currentEditorInstance.chain === 'function'
      ? currentEditorInstance.chain().focus().extendMarkRange('link')
      : null
    if (!chain && typeof currentEditorInstance.commands.setLink !== 'function') {
      return { performed: false, action: commandName, reason: 'FORMAT_COMMAND_UNSUPPORTED' }
    }
    const performed = chain && typeof chain.setLink === 'function' && typeof chain.run === 'function'
      ? Boolean(chain.setLink({ href }).run())
      : Boolean(currentEditorInstance.commands.setLink({ href }))
    notifyFormattingStateChange()
    return { performed, action: commandName, reason: performed ? null : 'COMMAND_RETURNED_FALSE' }
  }

  if (commandName === 'unsetLink') {
    const chain = typeof currentEditorInstance.chain === 'function'
      ? currentEditorInstance.chain().focus().extendMarkRange('link')
      : null
    if (!chain && typeof currentEditorInstance.commands.unsetLink !== 'function') {
      return { performed: false, action: commandName, reason: 'FORMAT_COMMAND_UNSUPPORTED' }
    }
    const performed = chain && typeof chain.unsetLink === 'function' && typeof chain.run === 'function'
      ? Boolean(chain.unsetLink().run())
      : Boolean(currentEditorInstance.commands.unsetLink())
    notifyFormattingStateChange()
    return { performed, action: commandName, reason: performed ? null : 'COMMAND_RETURNED_FALSE' }
  }

  const commandMap = {
    toggleBold: () => currentEditorInstance.commands.toggleBold(),
    toggleItalic: () => currentEditorInstance.commands.toggleItalic(),
    toggleBulletList: () => currentEditorInstance.commands.toggleBulletList(),
    toggleOrderedList: () => currentEditorInstance.commands.toggleOrderedList(),
  }

  const command = commandMap[commandName]
  if (typeof command !== 'function') {
    return { performed: false, action: commandName, reason: 'FORMAT_COMMAND_UNSUPPORTED' }
  }

  const performed = Boolean(command())
  notifyFormattingStateChange()
  return { performed, action: commandName, reason: performed ? null : 'COMMAND_RETURNED_FALSE' }
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
