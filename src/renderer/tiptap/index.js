import { DocumentCommentEditIntents, getCommentEditIntentsJson, checkpointCommentEditIntents, commentSelectionIntent } from './documentCommentEditIntents.mjs';
import wordStories from '../../core/word-stories-projection-v1.cjs';
import { DocumentStories, applyStoryBody } from './documentStories.mjs';
import wordSections from '../../core/word-sections-v1.cjs';
import { DocumentSections } from './documentSections.mjs';
import { DocumentBreaks } from './documentBreaks.mjs';
import { DocumentListNumbering, captureNumberingTarget, numberingDocumentJSON } from './documentListNumbering.mjs';
import wordListNumbering from '../../core/word-list-numbering-v1.cjs';
import { DocumentListItems } from './documentListItems.mjs';
import { DocumentHeadings } from './documentHeadings.mjs';
import { applyLocalImagePublication } from './localImage.mjs'
import { textOffsetForPosition, positionForTextOffset } from './textCoordinates.mjs'
import { WordPendingRevisions, setCheckedDocument as setCheckedReviewDocument } from './wordPendingRevisions.mjs'
import { UserBookmarks, UserBookmarkLink, applyUserBookmarkPublication } from './userBookmarks.mjs'
import { Editor } from '@tiptap/core'
import { history } from '@tiptap/pm/history'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import { DocumentTextStyle } from './documentTextStyle.mjs'
import { DocumentParagraphAlignment, readParagraphAlignment } from './documentParagraphAlignment.mjs'
import { DocumentTables } from './documentTables.mjs'
import { DocumentMedia } from './documentMedia.mjs'
import { ManuscriptNoteReferences, applyManuscriptNoteProjection, getFocusedManuscriptBodyEditor } from './manuscriptNotes.mjs'
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
let userBookmarkManageHandler = null

export function getTiptapImageInsertionPosition() {
  const editor = currentEditorInstance
  if (!editor || getFocusedManuscriptBodyEditor(document)) return null
  return editor.state.selection.to
}

// Observed selection only. Main/Core independently validate the root boundary
// against the exact captured document before any structural write.
export function getTiptapRootSplitBoundary() {
  const editor = currentEditorInstance
  if (!editor || getFocusedManuscriptBodyEditor(document)) return null
  const selection = editor.state.selection
  const from = selection?.$from
  if (!selection.empty || !from || from.depth !== 1 || from.parentOffset !== 0
    || !['paragraph', 'heading'].includes(from.parent.type.name)) return null
  const boundaryRootIndex = from.index(0)
  if (boundaryRootIndex < 1 || boundaryRootIndex >= editor.state.doc.childCount) return null
  return { boundaryRootIndex, position: selection.from }
}

// A committed partition must never be undone through the ordinary text stack.
// Retain the original history plugin/config and every other plugin's state;
// only the history field is removed and initialized again.
export function replaceTiptapTreeDocumentSnapshot(snapshot = {}) {
  const editor = currentEditorInstance
  if (!editor || !snapshot.doc || typeof snapshot.doc !== 'object') return false
  const before = editor.state
  const historyKey = history().spec.key
  const historyPlugins = before.plugins.filter(plugin => plugin.spec.key === historyKey)
  if (historyPlugins.length !== 1) return false
  try {
    const expected = editor.schema.nodeFromJSON(snapshot.doc)
    expected.check()
    if (!setCheckedDocument(editor, snapshot.doc) || !editor.state.doc.eq(expected)) {
      if (editor.state !== before) editor.view.updateState(before)
      return false
    }
    const plugins = editor.state.plugins
    const reset = editor.state.reconfigure({ plugins: plugins.filter(plugin => plugin !== historyPlugins[0]) })
      .reconfigure({ plugins })
    editor.view.updateState(reset)
    notifyFormattingStateChange()
    return true
  } catch {
    if (editor.state !== before) editor.view.updateState(before)
    return false
  }
}

export function applyTiptapLocalImagePublication(payload, currentContent) {
  if (!currentEditorInstance || currentContent !== payload.expectedContent) return false
  const checked = parseObservablePayload(payload.content)
  return !checked.issue && Boolean(checked.doc)
    && applyLocalImagePublication(currentEditorInstance, checked.doc, payload.position)
}

function setCheckedDocument(editor, doc) {
  wordSections.read(doc);
  wordStories.readProjection(doc);
  const result = setCheckedReviewDocument(editor, doc)
  if (result) editor.view.dispatch(editor.state.tr.setDocAttribute('wordUserBookmarks', doc.attrs?.wordUserBookmarks || null).setDocAttribute('wordSections', doc.attrs?.wordSections || null).setDocAttribute('wordStories', doc.attrs?.wordStories || null).setDocAttribute('wordDefaultTabStop', doc.attrs?.wordDefaultTabStop ?? null)
    .setMeta('wordPendingRevisionsExternal', true).setMeta('preventUpdate', true).setMeta('addToHistory', false))
  return result
}

export function applyTiptapUserBookmarkPublication(payload, currentContent) {
  if (!currentEditorInstance || typeof currentContent !== 'string'
    || currentContent !== payload.expectedContent) return false
  const checked = parseObservablePayload(payload.content)
  return !checked.issue && Boolean(checked.doc)
    && applyUserBookmarkPublication(currentEditorInstance, checked.doc, payload.affectedBookmarkId || null)
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
  } catch (error) {
    if (editor.getJSON()?.attrs?.wordPendingRevisions || editor.getJSON()?.attrs?.wordUserBookmarks || editor.getJSON()?.attrs?.wordSections || editor.getJSON()?.attrs?.wordStories) throw error
    return buildParagraphDocumentFromText(readEditorText(editor))
  }
}

function normalizeFormattingColor(value) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim().toLowerCase()
    : ''
}

const STRUCTURED_PARAGRAPH_STYLE_OPTIONS = new Set([
  'paragraph-none',
  'paragraph-title',
  'paragraph-heading1',
  'paragraph-heading2',
  'paragraph-blockquote',
])

const STRUCTURED_CHARACTER_STYLE_OPTIONS = new Set([
  'character-emphasis',
  'character-code-span',
])

function createStructuredStyleResult(action, performed, reason, optionId = null) {
  return {
    performed: Boolean(performed),
    action,
    reason: reason || null,
    optionId,
  }
}

function getStructuredParagraphStyleOption(editor) {
  if (!editor || typeof editor.isActive !== 'function') {
    return ''
  }

  if (
    editor.isActive('bulletList')
    || editor.isActive('orderedList')
    || editor.isActive('codeBlock')
  ) {
    return ''
  }

  if (editor.isActive('blockquote')) {
    return 'paragraph-blockquote'
  }
  if (editor.isActive('heading', { level: 1 })) {
    return 'paragraph-title'
  }
  if (editor.isActive('heading', { level: 2 })) {
    return 'paragraph-heading1'
  }
  if (editor.isActive('heading', { level: 3 })) {
    return 'paragraph-heading2'
  }
  if (editor.isActive('paragraph')) {
    return 'paragraph-none'
  }
  return ''
}

function getStructuredCharacterStyleOption(editor) {
  if (!editor || typeof editor.isActive !== 'function') {
    return ''
  }

  if (editor.isActive('code')) {
    return 'character-code-span'
  }
  if (editor.isActive('italic')) {
    return 'character-emphasis'
  }
  return ''
}

function runTiptapStructuredParagraphStyle(optionId) {
  const editor = getFocusedManuscriptBodyEditor() || currentEditorInstance
  if (!STRUCTURED_PARAGRAPH_STYLE_OPTIONS.has(optionId)) {
    return createStructuredStyleResult('applyParagraphStyle', false, 'UNSUPPORTED_STYLE_OPTION', optionId)
  }
  if (!editor || !editor.commands) {
    return createStructuredStyleResult('applyParagraphStyle', false, 'EDITOR_UNAVAILABLE', optionId)
  }

  if (editor.isDestroyed || editor.isEditable === false) return createStructuredStyleResult('applyParagraphStyle', false, 'EDITOR_READ_ONLY', optionId)

  const currentOptionId = getStructuredParagraphStyleOption(editor)
  if (currentOptionId === optionId) {
    return createStructuredStyleResult('applyParagraphStyle', false, 'NO_OP', optionId)
  }

  const chain = typeof editor.chain === 'function'
    ? editor.chain().focus()
    : null
  if (!chain || typeof chain.run !== 'function') {
    return createStructuredStyleResult('applyParagraphStyle', false, 'FORMAT_COMMAND_UNSUPPORTED', optionId)
  }

  let performed = false
  if (optionId === 'paragraph-none') {
    if (
      typeof chain.clearNodes !== 'function'
      || typeof chain.setParagraph !== 'function'
    ) {
      return createStructuredStyleResult('applyParagraphStyle', false, 'FORMAT_COMMAND_UNSUPPORTED', optionId)
    }
    performed = Boolean(chain.clearNodes().setParagraph().run())
  } else if (optionId === 'paragraph-blockquote') {
    if (
      typeof chain.clearNodes !== 'function'
      || typeof chain.setBlockquote !== 'function'
    ) {
      return createStructuredStyleResult('applyParagraphStyle', false, 'FORMAT_COMMAND_UNSUPPORTED', optionId)
    }
    performed = Boolean(chain.clearNodes().setBlockquote().run())
  } else {
    const levelMap = {
      'paragraph-title': 1,
      'paragraph-heading1': 2,
      'paragraph-heading2': 3,
    }
    if (
      typeof chain.clearNodes !== 'function'
      || typeof chain.setHeading !== 'function'
    ) {
      return createStructuredStyleResult('applyParagraphStyle', false, 'FORMAT_COMMAND_UNSUPPORTED', optionId)
    }
    performed = Boolean(chain.clearNodes().setHeading({ level: levelMap[optionId] }).run())
  }

  notifyFormattingStateChange(editor)
  return createStructuredStyleResult(
    'applyParagraphStyle',
    performed,
    performed ? null : 'NO_OP',
    optionId,
  )
}

function runTiptapStructuredCharacterStyle(optionId) {
  const editor = getFocusedManuscriptBodyEditor() || currentEditorInstance
  if (!STRUCTURED_CHARACTER_STYLE_OPTIONS.has(optionId)) {
    return createStructuredStyleResult('applyCharacterStyle', false, 'UNSUPPORTED_STYLE_OPTION', optionId)
  }
  if (!editor || !editor.commands) {
    return createStructuredStyleResult('applyCharacterStyle', false, 'EDITOR_UNAVAILABLE', optionId)
  }

  if (editor.isDestroyed || editor.isEditable === false) return createStructuredStyleResult('applyCharacterStyle', false, 'EDITOR_READ_ONLY', optionId)

  const state = readFormattingState(editor)
  if (state.selectionEmpty) {
    return createStructuredStyleResult('applyCharacterStyle', false, 'NO_SELECTION', optionId)
  }

  let performed = false
  if (optionId === 'character-emphasis') {
    const chainPerformed = runEditorChainCommand(editor, 'toggleItalic')
    if (chainPerformed !== null) {
      performed = chainPerformed
    } else if (typeof editor.commands.toggleItalic !== 'function') {
      return createStructuredStyleResult('applyCharacterStyle', false, 'FORMAT_COMMAND_UNSUPPORTED', optionId)
    } else {
      performed = Boolean(editor.commands.toggleItalic())
    }
  } else {
    const chainPerformed = runEditorChainCommand(editor, 'toggleCode')
    if (chainPerformed !== null) {
      performed = chainPerformed
    } else if (typeof editor.commands.toggleCode !== 'function') {
      return createStructuredStyleResult('applyCharacterStyle', false, 'FORMAT_COMMAND_UNSUPPORTED', optionId)
    } else {
      performed = Boolean(editor.commands.toggleCode())
    }
  }

  notifyFormattingStateChange(editor)
  return createStructuredStyleResult(
    'applyCharacterStyle',
    performed,
    performed ? null : 'NO_OP',
    optionId,
  )
}

export function applyTiptapParagraphStyle(optionId) {
  return runTiptapStructuredParagraphStyle(optionId)
}

export function applyTiptapCharacterStyle(optionId) {
  return runTiptapStructuredCharacterStyle(optionId)
}

function readFormattingState(editor) {
  if (!editor || typeof editor.isActive !== 'function') {
    return {
      bold: false,
      italic: false,
      underline: false,
      textColor: '',
      textColorActive: false,
      highlightColor: '',
      highlightActive: false,
      link: false,
      linkActive: false,
      linkHref: '',
      paragraphAlignment: '',
      paragraphStyle: '',
      characterStyle: '',
      selectionEmpty: true,
      bulletList: false,
      orderedList: false,
    }
  }

  const linkActive = Boolean(editor.isActive('link'))
  const linkAttributes = typeof editor.getAttributes === 'function' ? editor.getAttributes('link') : null
  const textStyleAttributes = typeof editor.getAttributes === 'function' ? editor.getAttributes('textStyle') : null
  const highlightAttributes = typeof editor.getAttributes === 'function' ? editor.getAttributes('highlight') : null
  const selectionEmpty = Boolean(editor.state && editor.state.selection ? editor.state.selection.empty : true)
  const textColor = normalizeFormattingColor(textStyleAttributes && textStyleAttributes.color)
  const highlightColor = normalizeFormattingColor(highlightAttributes && highlightAttributes.color)
  const highlightActive = Boolean(editor.isActive('highlight'))

  return {
    bold: Boolean(editor.isActive('bold')),
    italic: Boolean(editor.isActive('italic')),
    underline: Boolean(editor.isActive('underline')),
    textColor,
    textColorActive: textColor.length > 0,
    highlightColor,
    highlightActive,
    link: linkActive,
    linkActive,
    linkHref: linkAttributes && typeof linkAttributes.href === 'string' ? linkAttributes.href : '',
    paragraphAlignment: readParagraphAlignment(editor),
    paragraphStyle: getStructuredParagraphStyleOption(editor),
    characterStyle: getStructuredCharacterStyleOption(editor),
    selectionEmpty,
    bulletList: Boolean(editor.isActive('bulletList')),
    orderedList: Boolean(editor.isActive('orderedList')),
  }
}

function notifyFormattingStateChange(editor = getFocusedManuscriptBodyEditor() || currentEditorInstance) {
  if (typeof currentFormattingStateHandler !== 'function') return
  currentFormattingStateHandler(readFormattingState(editor))
}

function getTiptapDocumentContentSize(editor) {
  const doc = editor && editor.state ? editor.state.doc : null
  return doc && doc.content ? Math.max(1, doc.content.size) : 1
}

function getTextOffsetForDocumentPosition(editor, position) {
  return editor?.state?.doc ? textOffsetForPosition(editor.state.doc, position) : 0
}

function getDocumentPositionForTextOffset(editor, offset) {
  return editor?.state?.doc ? positionForTextOffset(editor.state.doc, offset) : 1
}

function runFocusedChainCommand(commandName, payload = undefined) {
  return runEditorChainCommand(currentEditorInstance, commandName, payload)
}

function runEditorChainCommand(editor, commandName, payload = undefined) {
  if (editor?.isDestroyed || editor?.isEditable === false) return false
  if (!editor || typeof editor.chain !== 'function') {
    return null
  }
  const chain = editor.chain().focus()
  if (!chain || typeof chain[commandName] !== 'function' || typeof chain.run !== 'function') {
    return null
  }
  const nextChain = payload === undefined ? chain[commandName]() : chain[commandName](payload)
  return Boolean(nextChain.run())
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
      if (payload?.storyPublication === true) return // The scene controller validates request, draft and generation before publication.
      if (payload?.localImageAuthoringPublication === true) {
        applyTiptapLocalImagePublication(payload, this.readObservablePayload())
        return
      }
      if (payload?.userBookmarkAuthoringPublication === true) {
        if (this.readObservablePayload() !== payload.expectedContent) return
        const checked = parseObservablePayload(payload.content)
        if (!checked.issue && checked.doc) applyUserBookmarkPublication(editor, checked.doc, payload.affectedBookmarkId || null)
        return
      }
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
        setCheckedDocument(editor, parsed.doc || buildParagraphDocumentFromText(parsed.text || ''))
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
      if (payload?.commandId === 'cmd.project.bookmarks.managePrompt') {
        userBookmarkManageHandler?.(); return
      }
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
  const editorAccessibilityAttributes = {
    'aria-label': mountEl.getAttribute('aria-label') || 'Текст сцены',
    'aria-multiline': mountEl.getAttribute('aria-multiline') || 'true',
    'data-bidi-policy': mountEl.getAttribute('data-bidi-policy') || 'plaintext',
    dir: mountEl.getAttribute('dir') || 'auto',
    role: 'textbox',
  }

  destroyCurrentEditor()
  currentFormattingStateHandler = nextFormattingStateHandler

  destroyCurrentEditor()

  // legacy editor раньше работал через textContent; TipTapу нужен контейнер
  mountEl.innerHTML = ''
  mountEl.classList.add('tiptap-host')
  mountEl.removeAttribute('contenteditable')
  mountEl.removeAttribute('role')
  mountEl.removeAttribute('aria-label')
  mountEl.removeAttribute('aria-multiline')
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
    editorProps: {
      attributes: editorAccessibilityAttributes,
    },
    extensions: [
      StarterKit.configure({
        // Loading or focusing a document must not invent authored paragraphs.
        // Enter, list splitting and exitCode remain explicit authoring commands.
        trailingNode: false,
        heading: false,
        listItem: false,
        hardBreak: false,
        link: false,
        underline: false,
      }),
      DocumentListNumbering.configure({ onClipboardStatus: message => {
        const status = document.getElementById('status');
        if (status) status.textContent = message;
      } }),
      DocumentCommentEditIntents,
      DocumentSections,
      DocumentStories,
      DocumentHeadings,
      DocumentListItems,
      DocumentBreaks,
      DocumentTextStyle,
      DocumentParagraphAlignment,
      DocumentTables,
      DocumentMedia,
      ManuscriptNoteReferences,
      WordPendingRevisions,
      UserBookmarks,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      Underline,
      UserBookmarkLink.configure({
        autolink: false,
        linkOnPaste: false,
        openOnClick: false,
      }),
    ],
    content: '<p></p>',
    onUpdate: () => {
      currentIpcSession?.handleUpdate()
      options.onDocumentUpdate?.()
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
    resolveHistoryEditor: () => getFocusedManuscriptBodyEditor() || editor,
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
  userBookmarkManageHandler = runtimeHandlers.userBookmarkManage || null
  if (!currentRuntimeBridge || typeof currentRuntimeBridge.setRuntimeHandlers !== 'function') {
    return
  }

  currentRuntimeBridge.setRuntimeHandlers(runtimeHandlers)
}

export function setTiptapFormattingStateHandler(handler = null) {
  currentFormattingStateHandler = typeof handler === 'function' ? handler : null
  notifyFormattingStateChange()
}

export function focusTiptapSurface(position = 'current') {
  if (!currentEditorInstance) {
    return { performed: false, action: 'focus', reason: 'EDITOR_UNAVAILABLE', position }
  }

  const normalizedPosition = position === 'start' || position === 'end' ? position : null
  const focusCommand = currentEditorInstance.commands && typeof currentEditorInstance.commands.focus === 'function'
    ? currentEditorInstance.commands.focus
    : null
  if (!focusCommand) {
    return { performed: false, action: 'focus', reason: 'COMMAND_UNAVAILABLE', position }
  }

  const performed = normalizedPosition
    ? Boolean(focusCommand(normalizedPosition))
    : Boolean(focusCommand())
  notifyFormattingStateChange()
  return { performed, action: 'focus', reason: performed ? null : 'COMMAND_RETURNED_FALSE', position }
}

export function getTiptapSelectionOffsets() {
  if (!currentEditorInstance || !currentEditorInstance.state || !currentEditorInstance.state.selection) {
    return { start: 0, end: 0 }
  }

  const { from, to } = currentEditorInstance.state.selection
  const start = getTextOffsetForDocumentPosition(currentEditorInstance, Math.min(from, to))
  const end = getTextOffsetForDocumentPosition(currentEditorInstance, Math.max(from, to))
  return { start, end }
}

export function setTiptapManuscriptNoteProjection(projection) {
  applyManuscriptNoteProjection(currentEditorInstance, projection, getDocumentPositionForTextOffset)
}

export function setTiptapSelectionOffsets(start = 0, end = start) {
  if (!currentEditorInstance || !currentEditorInstance.commands) {
    return { performed: false, action: 'setSelection', reason: 'EDITOR_UNAVAILABLE' }
  }

  const boundedStart = getDocumentPositionForTextOffset(currentEditorInstance, Math.min(start, end))
  const boundedEnd = getDocumentPositionForTextOffset(currentEditorInstance, Math.max(start, end))
  const chainResult = runFocusedChainCommand('setTextSelection', { from: boundedStart, to: boundedEnd })
  if (chainResult !== null) {
    notifyFormattingStateChange()
    return { performed: chainResult, action: 'setSelection', reason: chainResult ? null : 'COMMAND_RETURNED_FALSE' }
  }

  if (typeof currentEditorInstance.commands.setTextSelection !== 'function') {
    return { performed: false, action: 'setSelection', reason: 'COMMAND_UNAVAILABLE' }
  }

  const performed = Boolean(currentEditorInstance.commands.setTextSelection({ from: boundedStart, to: boundedEnd }))
  if (performed && typeof currentEditorInstance.commands.focus === 'function') {
    currentEditorInstance.commands.focus()
  }
  notifyFormattingStateChange()
  return { performed, action: 'setSelection', reason: performed ? null : 'COMMAND_RETURNED_FALSE' }
}

export function getTiptapPlainText() {
  return readEditorText(currentEditorInstance)
}

export function setTiptapPlainText(text = '') {
  if (!currentEditorInstance) return
  setCheckedDocument(currentEditorInstance, buildParagraphDocumentFromText(text))
  notifyFormattingStateChange()
}

export function applyTiptapStoryBody(expectedDoc, storyId, body) {
  return applyStoryBody(currentEditorInstance, expectedDoc, storyId, body);
}

export function getTiptapCommentEditIntentsJson() {
  return getCommentEditIntentsJson(currentEditorInstance);
}
export function checkpointTiptapCommentEditIntents() {
  return checkpointCommentEditIntents(currentEditorInstance);
}
export function getTiptapCommentSelectionIntent() {
  return commentSelectionIntent(currentEditorInstance);
}

export function getTiptapDocumentSnapshot() {
  return {
    doc: readEditorDocument(currentEditorInstance),
    text: readEditorText(currentEditorInstance),
  }
}

export function setTiptapDocumentSnapshot(snapshot = {}) {
  const editor = currentEditorInstance
  if (!editor || editor.isDestroyed) return false
  const before = editor.state
  const plugins = before.plugins
  const historyKey = history().spec.key
  const historyPlugins = plugins.filter(plugin => plugin.spec.key === historyKey)
  if (snapshot.resetHistory === true && historyPlugins.length !== 1) return false
  const doc = snapshot && snapshot.doc && typeof snapshot.doc === 'object'
    ? snapshot.doc
    : buildParagraphDocumentFromText(snapshot && typeof snapshot.text === 'string' ? snapshot.text : '')
  try {
    const expected = editor.schema.nodeFromJSON(wordListNumbering.normalizeAuthoring(
      numberingDocumentJSON(editor.schema.nodeFromJSON(doc))))
    expected.check()
    if (!setCheckedDocument(editor, doc) || !editor.state.doc.eq(expected)) throw Error('DOCUMENT_PUBLICATION_REFUSED')
    if (snapshot.resetHistory === true) {
      const reset = editor.state.reconfigure({ plugins: plugins.filter(plugin => plugin !== historyPlugins[0]) })
        .reconfigure({ plugins })
      editor.view.updateState(reset)
    }
  } catch {
    if (editor.state !== before) editor.view.updateState(before)
    return false
  }
  notifyFormattingStateChange()
  return true
}

// A dialog owns only this captured editor selection. It may never fall back
// to another editor when focus changes while awaiting user input.
export function captureTiptapNumberingTarget() {
  if (getFocusedManuscriptBodyEditor()) return null;
  const editor = currentEditorInstance;
  return captureNumberingTarget(editor, () => currentEditorInstance === editor);
}

export function captureTiptapLinkTarget() {
  const auxiliary = getFocusedManuscriptBodyEditor();
  const editor = auxiliary || currentEditorInstance;
  if (!editor || editor.isDestroyed || editor.isEditable === false || !editor.state?.selection) return null;
  const doc = editor.state.doc, selection = editor.state.selection;
  return Object.freeze({
    auxiliary: Boolean(auxiliary), formattingState: readFormattingState(editor),
    apply(commandName, payload = {}) {
      if (editor.isDestroyed || editor.isEditable === false || editor.state.doc !== doc
        || (!auxiliary && currentEditorInstance !== editor)) {
        return { performed: false, action: 'insertLinkPrompt', reason: 'STALE_EDITOR_TARGET' };
      }
      if (!['setLink', 'unsetLink'].includes(commandName)
        || (auxiliary && (payload.wordBookmarkId || payload.wordBookmarkName || String(payload.href || '').startsWith('#')))) {
        return { performed: false, action: 'insertLinkPrompt', reason: 'FORMAT_COMMAND_UNSUPPORTED' };
      }
      const chain = editor.chain?.();
      if (!chain || ['focus', 'setTextSelection', 'extendMarkRange', commandName, 'run'].some(name => typeof chain[name] !== 'function')) {
        return { performed: false, action: 'insertLinkPrompt', reason: 'FORMAT_COMMAND_UNSUPPORTED' };
      }
      const selected = chain.focus().setTextSelection({ from: selection.from, to: selection.to }).extendMarkRange('link');
      const performed = Boolean((commandName === 'setLink' ? selected.setLink(payload) : selected.unsetLink()).run());
      notifyFormattingStateChange(editor);
      return { performed, action: commandName, reason: performed ? null : 'COMMAND_RETURNED_FALSE' };
    },
  });
}

export function getTiptapFormattingState() {
  return readFormattingState(getFocusedManuscriptBodyEditor() || currentEditorInstance)
}

export function runTiptapFormatCommand(commandName, commandPayload = undefined) {
  const editor = getFocusedManuscriptBodyEditor() || currentEditorInstance
  const runFocusedChainCommand = (name, value) => runEditorChainCommand(editor, name, value)
  if (!editor || !editor.commands) {
    return { performed: false, action: commandName, reason: 'EDITOR_UNAVAILABLE' }
  }

  if (editor.isDestroyed || editor.isEditable === false) {
    return { performed: false, action: commandName, reason: 'EDITOR_READ_ONLY' }
  }

  if (commandName === 'setParagraphAlignment') {
    const value = commandPayload?.value
    const performed = runFocusedChainCommand('setParagraphAlignment', value)
    notifyFormattingStateChange(editor)
    return { performed: performed === true, action: commandName, reason: performed ? null : 'ALIGNMENT_NOT_CHANGED' }
  }

  if (commandName === 'clearList') {
    const state = readFormattingState(editor)
    if (state.bulletList && typeof editor.commands.toggleBulletList === 'function') {
      const chainPerformed = runFocusedChainCommand('toggleBulletList')
      const performed = chainPerformed !== null
        ? chainPerformed
        : Boolean(editor.commands.toggleBulletList())
      notifyFormattingStateChange(editor)
      return { performed, action: commandName, reason: performed ? null : 'COMMAND_RETURNED_FALSE' }
    }
    if (state.orderedList && typeof editor.commands.toggleOrderedList === 'function') {
      const chainPerformed = runFocusedChainCommand('toggleOrderedList')
      const performed = chainPerformed !== null
        ? chainPerformed
        : Boolean(editor.commands.toggleOrderedList())
      notifyFormattingStateChange(editor)
      return { performed, action: commandName, reason: performed ? null : 'COMMAND_RETURNED_FALSE' }
    }
    return { performed: false, action: commandName, reason: 'LIST_NOT_ACTIVE' }
  }

  if (commandName === 'toggleUnderline') {
    const performed = runFocusedChainCommand('toggleUnderline')
    if (performed !== null) {
      notifyFormattingStateChange(editor)
      return { performed, action: commandName, reason: performed ? null : 'COMMAND_RETURNED_FALSE' }
    }
    if (typeof editor.commands.toggleUnderline !== 'function') {
      return { performed: false, action: commandName, reason: 'FORMAT_COMMAND_UNSUPPORTED' }
    }
    const fallbackPerformed = Boolean(editor.commands.toggleUnderline())
    notifyFormattingStateChange(editor)
    return { performed: fallbackPerformed, action: commandName, reason: fallbackPerformed ? null : 'COMMAND_RETURNED_FALSE' }
  }

  if (commandName === 'setColor') {
    const colorPayload = commandPayload && typeof commandPayload === 'object' && !Array.isArray(commandPayload)
      ? commandPayload
      : null
    const value = normalizeFormattingColor(colorPayload && colorPayload.value)
    if (!value) {
      return { performed: false, action: commandName, reason: 'COLOR_PAYLOAD_INVALID' }
    }
    const state = readFormattingState(editor)
    let chain = typeof editor.chain === 'function'
      ? editor.chain().focus()
      : null
    if (state.selectionEmpty && state.textColorActive && chain && typeof chain.extendMarkRange === 'function') {
      chain = chain.extendMarkRange('textStyle')
    }
    if ((!chain || typeof chain.setColor !== 'function' || typeof chain.run !== 'function') && typeof editor.commands.setColor !== 'function') {
      return { performed: false, action: commandName, reason: 'FORMAT_COMMAND_UNSUPPORTED' }
    }
    const performed = chain && typeof chain.setColor === 'function' && typeof chain.run === 'function'
      ? Boolean(chain.setColor(value).run())
      : Boolean(editor.commands.setColor(value))
    notifyFormattingStateChange(editor)
    return { performed, action: commandName, reason: performed ? null : 'COMMAND_RETURNED_FALSE' }
  }

  if (commandName === 'unsetColor') {
    const state = readFormattingState(editor)
    if (state.selectionEmpty && !state.textColorActive) {
      return { performed: false, action: commandName, reason: 'NO_OP' }
    }
    let chain = typeof editor.chain === 'function'
      ? editor.chain().focus()
      : null
    if (state.selectionEmpty && state.textColorActive && chain && typeof chain.extendMarkRange === 'function') {
      chain = chain.extendMarkRange('textStyle')
    }
    if ((!chain || typeof chain.unsetColor !== 'function' || typeof chain.run !== 'function') && typeof editor.commands.unsetColor !== 'function') {
      return { performed: false, action: commandName, reason: 'FORMAT_COMMAND_UNSUPPORTED' }
    }
    const performed = chain && typeof chain.unsetColor === 'function' && typeof chain.run === 'function'
      ? Boolean(chain.unsetColor().run())
      : Boolean(editor.commands.unsetColor())
    notifyFormattingStateChange(editor)
    return { performed, action: commandName, reason: performed ? null : 'COMMAND_RETURNED_FALSE' }
  }

  if (commandName === 'setHighlight') {
    const highlightPayload = commandPayload && typeof commandPayload === 'object' && !Array.isArray(commandPayload)
      ? commandPayload
      : null
    const value = normalizeFormattingColor(highlightPayload && highlightPayload.value)
    if (!value) {
      return { performed: false, action: commandName, reason: 'HIGHLIGHT_PAYLOAD_INVALID' }
    }
    const state = readFormattingState(editor)
    let chain = typeof editor.chain === 'function'
      ? editor.chain().focus()
      : null
    if (state.selectionEmpty && state.highlightActive && chain && typeof chain.extendMarkRange === 'function') {
      chain = chain.extendMarkRange('highlight')
    }
    if ((!chain || typeof chain.setHighlight !== 'function' || typeof chain.run !== 'function') && typeof editor.commands.setHighlight !== 'function') {
      return { performed: false, action: commandName, reason: 'FORMAT_COMMAND_UNSUPPORTED' }
    }
    const performed = chain && typeof chain.setHighlight === 'function' && typeof chain.run === 'function'
      ? Boolean(chain.setHighlight({ color: value }).run())
      : Boolean(editor.commands.setHighlight({ color: value }))
    notifyFormattingStateChange(editor)
    return { performed, action: commandName, reason: performed ? null : 'COMMAND_RETURNED_FALSE' }
  }

  if (commandName === 'unsetHighlight') {
    const state = readFormattingState(editor)
    if (state.selectionEmpty && !state.highlightActive) {
      return { performed: false, action: commandName, reason: 'NO_OP' }
    }
    let chain = typeof editor.chain === 'function'
      ? editor.chain().focus()
      : null
    if (state.selectionEmpty && state.highlightActive && chain && typeof chain.extendMarkRange === 'function') {
      chain = chain.extendMarkRange('highlight')
    }
    if ((!chain || typeof chain.unsetHighlight !== 'function' || typeof chain.run !== 'function') && typeof editor.commands.unsetHighlight !== 'function') {
      return { performed: false, action: commandName, reason: 'FORMAT_COMMAND_UNSUPPORTED' }
    }
    const performed = chain && typeof chain.unsetHighlight === 'function' && typeof chain.run === 'function'
      ? Boolean(chain.unsetHighlight().run())
      : Boolean(editor.commands.unsetHighlight())
    notifyFormattingStateChange(editor)
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
    const chain = typeof editor.chain === 'function'
      ? editor.chain().focus().extendMarkRange('link')
      : null
    if ((!chain || typeof chain.setLink !== 'function' || typeof chain.run !== 'function') && typeof editor.commands.setLink !== 'function') {
      return { performed: false, action: commandName, reason: 'FORMAT_COMMAND_UNSUPPORTED' }
    }
    const performed = chain && typeof chain.setLink === 'function' && typeof chain.run === 'function'
      ? Boolean(chain.setLink({ href, wordBookmarkId: linkPayload.wordBookmarkId || null,
        wordBookmarkName: linkPayload.wordBookmarkName || null }).run())
      : Boolean(editor.commands.setLink({ href, wordBookmarkId: linkPayload.wordBookmarkId || null,
        wordBookmarkName: linkPayload.wordBookmarkName || null }))
    notifyFormattingStateChange(editor)
    return { performed, action: commandName, reason: performed ? null : 'COMMAND_RETURNED_FALSE' }
  }

  if (commandName === 'unsetLink') {
    const chain = typeof editor.chain === 'function'
      ? editor.chain().focus().extendMarkRange('link')
      : null
    if ((!chain || typeof chain.unsetLink !== 'function' || typeof chain.run !== 'function') && typeof editor.commands.unsetLink !== 'function') {
      return { performed: false, action: commandName, reason: 'FORMAT_COMMAND_UNSUPPORTED' }
    }
    const performed = chain && typeof chain.unsetLink === 'function' && typeof chain.run === 'function'
      ? Boolean(chain.unsetLink().run())
      : Boolean(editor.commands.unsetLink())
    notifyFormattingStateChange(editor)
    return { performed, action: commandName, reason: performed ? null : 'COMMAND_RETURNED_FALSE' }
  }

  const commandMap = {
    toggleBold: () => runFocusedChainCommand('toggleBold'),
    toggleItalic: () => runFocusedChainCommand('toggleItalic'),
    toggleBulletList: () => runFocusedChainCommand('toggleBulletList'),
    toggleOrderedList: () => runFocusedChainCommand('toggleOrderedList'),
  }

  const command = commandMap[commandName]
  if (typeof command !== 'function') {
    return { performed: false, action: commandName, reason: 'FORMAT_COMMAND_UNSUPPORTED' }
  }

  const result = command()
  const performed = typeof result === 'boolean' ? result : Boolean(result)
  notifyFormattingStateChange(editor)
  return { performed, action: commandName, reason: performed ? null : 'COMMAND_RETURNED_FALSE' }
}

export function undoTiptap() {
  return currentRuntimeBridge?.undo() || { performed: false }
}

export function redoTiptap() {
  return currentRuntimeBridge?.redo() || { performed: false }
}
