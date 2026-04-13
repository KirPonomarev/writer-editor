import {
  composeObservablePayload,
  parseObservablePayload,
} from '../documentContentEnvelope.mjs'

let currentSessionRef = null
let textRequestListenerAttached = false
let setTextListenerAttached = false
let listenerCount = 0

export { composeObservablePayload, parseObservablePayload }

function readCurrentObservablePayload() {
  const session = currentSessionRef
  if (!session || typeof session.readObservablePayload !== 'function') {
    return ''
  }

  try {
    return session.readObservablePayload()
  } catch {
    return ''
  }
}

function applyIncomingPayload(payload) {
  const session = currentSessionRef
  if (!session || typeof session.applyIncomingPayload !== 'function') {
    return
  }

  session.applyIncomingPayload(payload)
}

export function createTextRequestHandler({ readObservablePayload, sendEditorTextResponse } = {}) {
  const read = typeof readObservablePayload === 'function' ? readObservablePayload : (() => '')
  const send = typeof sendEditorTextResponse === 'function' ? sendEditorTextResponse : (() => {})

  return function handleTextRequest(payload = {}) {
    const requestId = payload && Object.prototype.hasOwnProperty.call(payload, 'requestId')
      ? payload.requestId
      : undefined
    const text = read()
    send(requestId, text)
    return { requestId, text }
  }
}

export function createSetTextHandler({ applyIncomingPayload: applyPayload } = {}) {
  const apply = typeof applyPayload === 'function' ? applyPayload : (() => {})

  return function handleSetText(payload = {}) {
    apply(payload)
    return { applied: true, payload }
  }
}
function ensureListenersAttached() {
  if (!window.electronAPI) return

  if (!textRequestListenerAttached && typeof window.electronAPI.onEditorTextRequest === 'function') {
    const handleTextRequest = createTextRequestHandler({
      readObservablePayload: readCurrentObservablePayload,
      sendEditorTextResponse: (requestId, text) => {
        window.electronAPI.sendEditorTextResponse(requestId, text)
      },
    })
    window.electronAPI.onEditorTextRequest(handleTextRequest)
    textRequestListenerAttached = true
    listenerCount += 1
  }

  if (!setTextListenerAttached && typeof window.electronAPI.onEditorSetText === 'function') {
    const handleSetText = createSetTextHandler({
      applyIncomingPayload,
    })
    window.electronAPI.onEditorSetText(handleSetText)
    setTextListenerAttached = true
    listenerCount += 1
  }
}

export function attachTiptapIpc(session, options = {}) {
  if (options && options.attachWindowListeners === true) {
    ensureListenersAttached()
  }
  currentSessionRef = session || null
}

export function detachTiptapIpc(session) {
  if (!session || currentSessionRef === session) {
    currentSessionRef = null
  }
}

export function getTiptapIpcDebugState() {
  return {
    textRequestListenerAttached,
    setTextListenerAttached,
    listenerCount,
    hasCurrentSessionRef: Boolean(currentSessionRef),
  }
}
