const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const ROOT = path.resolve(__dirname, '..', '..')

function createMemoryStorage() {
  const data = new Map()
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null
    },
    setItem(key, value) {
      data.set(key, String(value))
    },
    removeItem(key) {
      data.delete(key)
    },
  }
}

async function importModule(parts) {
  return import(pathToFileURL(path.join(ROOT, ...parts)).href)
}

function read(parts) {
  return fs.readFileSync(path.join(ROOT, ...parts), 'utf8')
}

test('toolbar expansion wave b: catalog promotes color and review items while saved profiles are not auto backfilled', async () => {
  const catalog = await importModule(['src', 'renderer', 'toolbar', 'toolbarFunctionCatalog.mjs'])
  const profile = await importModule(['src', 'renderer', 'toolbar', 'toolbarProfileState.mjs'])
  const storage = createMemoryStorage()

  assert.deepEqual(catalog.TOOLBAR_CANONICAL_LIVE_ORDER, [
    'toolbar.font.family',
    'toolbar.font.weight',
    'toolbar.font.size',
    'toolbar.text.lineHeight',
    'toolbar.format.bold',
    'toolbar.format.italic',
    'toolbar.format.underline',
    'toolbar.paragraph.alignment',
    'toolbar.list.type',
    'toolbar.insert.link',
    'toolbar.color.text',
    'toolbar.color.highlight',
    'toolbar.review.comment',
    'toolbar.style.paragraph',
    'toolbar.style.character',
    'toolbar.history.undo',
    'toolbar.history.redo',
  ])
  assert.equal(catalog.getToolbarFunctionCatalogEntryById('toolbar.color.text').implementationState, 'live')
  assert.equal(catalog.getToolbarFunctionCatalogEntryById('toolbar.color.text').commandId, 'cmd.project.format.textColorPicker')
  assert.equal(catalog.getToolbarFunctionCatalogEntryById('toolbar.color.highlight').implementationState, 'live')
  assert.equal(catalog.getToolbarFunctionCatalogEntryById('toolbar.color.highlight').commandId, 'cmd.project.format.highlightColorPicker')
  assert.equal(catalog.getToolbarFunctionCatalogEntryById('toolbar.review.comment').implementationState, 'live')
  assert.equal(catalog.getToolbarFunctionCatalogEntryById('toolbar.review.comment').commandId, 'cmd.project.review.openComments')

  const seed = profile.createCanonicalMinimalToolbarProfileState()
  assert.deepEqual(seed.toolbarProfiles.minimal, catalog.TOOLBAR_CANONICAL_LIVE_ORDER)
  assert.deepEqual(seed.toolbarProfiles.master, catalog.TOOLBAR_CANONICAL_LIVE_ORDER)

  storage.setItem('toolbarProfiles:existing-wave-b', JSON.stringify({
    version: 3,
    activeToolbarProfile: 'master',
    toolbarProfiles: {
      minimal: ['toolbar.font.family', 'toolbar.insert.link'],
      master: ['toolbar.history.undo'],
    },
  }))

  const resolved = profile.resolveToolbarProfileStateForProjectSwitch(storage, 'existing-wave-b')
  assert.equal(resolved.source, 'persisted')
  assert.equal(resolved.shouldPersist, false)
  assert.deepEqual(resolved.state, {
    version: 3,
    activeToolbarProfile: 'master',
    toolbarProfiles: {
      minimal: ['toolbar.font.family', 'toolbar.insert.link'],
      master: ['toolbar.history.undo'],
    },
  })
})

test('toolbar expansion wave b: command registry and capability policy expose bounded color pickers and review opener', async () => {
  const projectCommands = await importModule(['src', 'renderer', 'commands', 'projectCommands.mjs'])
  const capability = await importModule(['src', 'renderer', 'commands', 'capabilityPolicy.mjs'])
  const registered = new Map()
  const calls = []

  const registry = {
    registerCommand(meta, handler) {
      registered.set(meta.id, { meta, handler })
    },
  }

  projectCommands.registerProjectCommands(registry, {
    electronAPI: null,
    uiActions: {
      formatTextColorPicker(payload = {}) {
        calls.push({ kind: 'text-color', payload })
        return { performed: true, source: 'ui-action' }
      },
      formatHighlightColorPicker(payload = {}) {
        calls.push({ kind: 'highlight-color', payload })
        return { performed: true, source: 'ui-action' }
      },
      reviewOpenComments(payload = {}) {
        calls.push({ kind: 'review-comments', payload })
        return { performed: true, source: 'shell' }
      },
    },
  })

  const textColorEntry = registered.get(projectCommands.EXTRA_COMMAND_IDS.FORMAT_TEXT_COLOR_PICKER)
  assert.ok(textColorEntry, 'text color command must be registered')
  assert.equal(textColorEntry.meta.group, 'format')

  const highlightEntry = registered.get(projectCommands.EXTRA_COMMAND_IDS.FORMAT_HIGHLIGHT_COLOR_PICKER)
  assert.ok(highlightEntry, 'highlight color command must be registered')
  assert.equal(highlightEntry.meta.group, 'format')

  const reviewEntry = registered.get(projectCommands.EXTRA_COMMAND_IDS.REVIEW_OPEN_COMMENTS)
  assert.ok(reviewEntry, 'review open comments command must be registered')
  assert.equal(reviewEntry.meta.group, 'review')

  const textPayload = { source: 'toolbar', mode: 'text' }
  const highlightPayload = { source: 'toolbar', mode: 'highlight' }
  const reviewPayload = { source: 'palette' }

  const textResult = await textColorEntry.handler(textPayload)
  const highlightResult = await highlightEntry.handler(highlightPayload)
  const reviewResult = await reviewEntry.handler(reviewPayload)

  assert.equal(textResult.ok, true)
  assert.equal(highlightResult.ok, true)
  assert.equal(reviewResult.ok, true)
  assert.deepEqual(calls, [
    { kind: 'text-color', payload: textPayload },
    { kind: 'highlight-color', payload: highlightPayload },
    { kind: 'review-comments', payload: reviewPayload },
  ])

  assert.equal(capability.CAPABILITY_BINDING[projectCommands.EXTRA_COMMAND_IDS.FORMAT_TEXT_COLOR_PICKER], 'cap.project.format.textColorPicker')
  assert.equal(capability.CAPABILITY_BINDING[projectCommands.EXTRA_COMMAND_IDS.FORMAT_HIGHLIGHT_COLOR_PICKER], 'cap.project.format.highlightColorPicker')
  assert.equal(capability.CAPABILITY_BINDING[projectCommands.EXTRA_COMMAND_IDS.REVIEW_OPEN_COMMENTS], 'cap.project.review.openComments')

  const legacyText = capability.enforceCapabilityForCommand(projectCommands.EXTRA_COMMAND_IDS.FORMAT_TEXT_COLOR_PICKER, {
    platformId: 'node',
    editorMode: 'legacy',
  })
  assert.equal(legacyText.ok, false)
  assert.equal(legacyText.error.reason, 'EDITOR_MODE_UNSUPPORTED')

  const legacyHighlight = capability.enforceCapabilityForCommand(projectCommands.EXTRA_COMMAND_IDS.FORMAT_HIGHLIGHT_COLOR_PICKER, {
    platformId: 'node',
    editorMode: 'legacy',
  })
  assert.equal(legacyHighlight.ok, false)
  assert.equal(legacyHighlight.error.reason, 'EDITOR_MODE_UNSUPPORTED')

  assert.deepEqual(
    capability.enforceCapabilityForCommand(projectCommands.EXTRA_COMMAND_IDS.REVIEW_OPEN_COMMENTS, {
      platformId: 'node',
      editorMode: 'legacy',
    }),
    { ok: true },
  )
})

test('toolbar expansion wave b: source pins explicit library labels and collapsed cursor color semantics', () => {
  const editorSource = read(['src', 'renderer', 'editor.js'])
  const tiptapSource = read(['src', 'renderer', 'tiptap', 'index.js'])

  assert.ok(editorSource.includes("color: 'color'"))
  assert.ok(editorSource.includes("review: 'review'"))
  assert.ok(editorSource.includes("Object.freeze({ value: '#1f1a15', label: 'Ink' })"))
  assert.ok(editorSource.includes("Object.freeze({ value: '#8a3b2e', label: 'Brick' })"))
  assert.ok(editorSource.includes("Object.freeze({ value: '#2f5f8a', label: 'Blue' })"))
  assert.ok(editorSource.includes("Object.freeze({ value: '#2f6a4f', label: 'Green' })"))
  assert.ok(editorSource.includes("Object.freeze({ value: '#ffdf20', label: 'Yellow' })"))
  assert.ok(editorSource.includes("Object.freeze({ value: '#ffd6e7', label: 'Pink' })"))
  assert.ok(editorSource.includes("Object.freeze({ value: '#cfe8ff', label: 'Sky' })"))
  assert.ok(editorSource.includes("Object.freeze({ value: '#d8f0c2', label: 'Mint' })"))

  assert.ok(tiptapSource.includes("if (state.selectionEmpty && !state.textColorActive) {"))
  assert.ok(tiptapSource.includes("chain = chain.extendMarkRange('textStyle')"))
  assert.ok(tiptapSource.includes("if (state.selectionEmpty && !state.highlightActive) {"))
  assert.ok(tiptapSource.includes("chain = chain.extendMarkRange('highlight')"))
  assert.ok(tiptapSource.includes("return { performed: false, action: commandName, reason: 'NO_OP' }"))
})
