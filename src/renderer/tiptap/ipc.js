const DEFAULT_META = Object.freeze({
  synopsis: '',
  status: 'черновик',
  tags: Object.freeze({ pov: '', line: '', place: '' }),
})

let currentSessionRef = null
let textRequestListenerAttached = false
let setTextListenerAttached = false
let listenerCount = 0

function cloneDefaultMeta() {
  return {
    synopsis: DEFAULT_META.synopsis,
    status: DEFAULT_META.status,
    tags: { ...DEFAULT_META.tags },
  }
}

function parseIndentedValue(lines, startIndex) {
  const valueLines = []
  const firstLine = lines[startIndex]
  const rawValue = firstLine.split(':').slice(1).join(':').trim()
  valueLines.push(rawValue)
  let index = startIndex + 1
  while (index < lines.length) {
    const line = lines[index]
    if (/^[a-zA-Zа-яА-ЯёЁ]+\s*:/.test(line)) {
      break
    }
    if (line.startsWith('  ') || line.startsWith('\t')) {
      valueLines.push(line.trim())
    }
    index += 1
  }
  return { value: valueLines.join('\n').trim(), nextIndex: index }
}

function parseTagsValue(value) {
  const tags = { pov: '', line: '', place: '' }
  String(value || '')
    .split(';')
    .forEach((chunk) => {
      const [rawKey, ...rest] = chunk.split('=')
      const key = (rawKey || '').trim().toLowerCase()
      const val = rest.join('=').trim()
      if (key === 'pov') tags.pov = val
      if (key === 'линия') tags.line = val
      if (key === 'место') tags.place = val
    })
  return tags
}

function parseMetaBlock(block) {
  const meta = cloneDefaultMeta()
  const lines = String(block || '')
    .replace(/\[\/?meta\]/gi, '')
    .split('\n')
    .map((line) => line.trimEnd())

  let index = 0
  while (index < lines.length) {
    const line = lines[index].trim()
    if (!line) {
      index += 1
      continue
    }
    if (line.startsWith('status:')) {
      meta.status = line.split(':').slice(1).join(':').trim() || meta.status
      index += 1
      continue
    }
    if (line.startsWith('tags:')) {
      meta.tags = parseTagsValue(line.split(':').slice(1).join(':').trim())
      index += 1
      continue
    }
    if (line.startsWith('synopsis:')) {
      const parsed = parseIndentedValue(lines, index)
      meta.synopsis = parsed.value
      index = parsed.nextIndex
      continue
    }
    index += 1
  }

  return meta
}

function parseCardBlock(block) {
  const card = { title: '', text: '', tags: '' }
  const lines = String(block || '')
    .replace(/\[\/?card\]/gi, '')
    .split('\n')
    .map((line) => line.trimEnd())

  let index = 0
  while (index < lines.length) {
    const line = lines[index].trim()
    if (!line) {
      index += 1
      continue
    }
    if (line.startsWith('title:')) {
      card.title = line.split(':').slice(1).join(':').trim()
      index += 1
      continue
    }
    if (line.startsWith('text:')) {
      const parsed = parseIndentedValue(lines, index)
      card.text = parsed.value
      index = parsed.nextIndex
      continue
    }
    if (line.startsWith('tags:')) {
      card.tags = line.split(':').slice(1).join(':').trim()
      index += 1
      continue
    }
    index += 1
  }

  return card
}

function parseCardsBlock(block) {
  const cards = []
  const body = String(block || '').replace(/\[\/?cards\]/gi, '').trim()
  const regex = /\[card\][\s\S]*?\[\/card\]/gi
  let match = regex.exec(body)
  while (match) {
    cards.push(parseCardBlock(match[0]))
    match = regex.exec(body)
  }
  return cards
}

export function parseObservablePayload(rawText = '') {
  let content = String(rawText || '')
  let meta = cloneDefaultMeta()
  let cards = []

  const metaMatch = content.match(/\[meta\][\s\S]*?\[\/meta\]/i)
  if (metaMatch) {
    meta = parseMetaBlock(metaMatch[0])
    content = content.replace(metaMatch[0], '')
  }

  const cardsMatch = content.match(/\[cards\][\s\S]*?\[\/cards\]/i)
  if (cardsMatch) {
    cards = parseCardsBlock(cardsMatch[0])
    content = content.replace(cardsMatch[0], '')
  }

  content = content.replace(/\n{3,}/g, '\n\n')
  content = content.replace(/^\n+/, '')
  content = content.replace(/\n+$/, '')

  return { text: content, meta, cards }
}

function composeMetaBlock(metaEnabled, meta) {
  if (!metaEnabled) return ''

  const safeMeta = meta && typeof meta === 'object' ? meta : cloneDefaultMeta()
  const safeTags = safeMeta.tags && typeof safeMeta.tags === 'object'
    ? safeMeta.tags
    : cloneDefaultMeta().tags

  const lines = ['[meta]']
  lines.push(`status: ${safeMeta.status || 'черновик'}`)
  lines.push(`tags: POV=${safeTags.pov || ''}; линия=${safeTags.line || ''}; место=${safeTags.place || ''}`)

  const synopsisLines = String(safeMeta.synopsis || '').split('\n')
  if (synopsisLines.length) {
    lines.push(`synopsis: ${synopsisLines[0] || ''}`)
    for (let index = 1; index < synopsisLines.length; index += 1) {
      lines.push(`  ${synopsisLines[index]}`)
    }
  } else {
    lines.push('synopsis:')
  }

  lines.push('[/meta]')
  return lines.join('\n')
}

function composeCardsBlock(cards) {
  if (!Array.isArray(cards) || cards.length === 0) return ''

  const lines = ['[cards]']
  cards.forEach((card) => {
    lines.push('[card]')
    lines.push(`title: ${card?.title || ''}`)
    const textLines = String(card?.text || '').split('\n')
    lines.push(`text: ${textLines[0] || ''}`)
    for (let index = 1; index < textLines.length; index += 1) {
      lines.push(`  ${textLines[index]}`)
    }
    lines.push(`tags: ${card?.tags || ''}`)
    lines.push('[/card]')
  })
  lines.push('[/cards]')
  return lines.join('\n')
}

export function composeObservablePayload({
  text = '',
  metaEnabled = false,
  meta = cloneDefaultMeta(),
  cards = [],
} = {}) {
  const parts = []
  const metaBlock = composeMetaBlock(metaEnabled, meta)
  if (metaBlock) {
    parts.push(metaBlock)
  }
  parts.push(String(text || ''))
  const cardsBlock = composeCardsBlock(cards)
  if (cardsBlock) {
    parts.push(cardsBlock)
  }
  return parts.filter(Boolean).join('\n\n')
}

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

export function attachTiptapIpc(session) {
  ensureListenersAttached()
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
