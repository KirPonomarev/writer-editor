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

test('toolbar expansion wave c1: catalog promotes styles items while default seed stays bounded', async () => {
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
  assert.equal(catalog.getToolbarFunctionCatalogEntryById('toolbar.style.paragraph').implementationState, 'live')
  assert.equal(catalog.getToolbarFunctionCatalogEntryById('toolbar.style.paragraph').actionAlias, 'toggle-style-paragraph-menu')
  assert.equal(catalog.getToolbarFunctionCatalogEntryById('toolbar.style.paragraph').commandId, null)
  assert.equal(catalog.getToolbarFunctionCatalogEntryById('toolbar.style.character').implementationState, 'live')
  assert.equal(catalog.getToolbarFunctionCatalogEntryById('toolbar.style.character').actionAlias, 'toggle-style-character-menu')
  assert.equal(catalog.getToolbarFunctionCatalogEntryById('toolbar.style.character').commandId, null)
  assert.equal(catalog.getToolbarFunctionCatalogEntryById('toolbar.insert.image').implementationState, 'blocked')
  assert.equal(
    catalog.getToolbarFunctionCatalogEntryById('toolbar.insert.image').blockerReason,
    'offline-first image asset pipeline not selected',
  )
  assert.equal(catalog.getToolbarFunctionCatalogEntryById('toolbar.proofing.spellcheck').implementationState, 'blocked')
  assert.equal(
    catalog.getToolbarFunctionCatalogEntryById('toolbar.proofing.spellcheck').blockerReason,
    'offline-first spellcheck dictionary policy not selected',
  )

  const seed = profile.createCanonicalMinimalToolbarProfileState()
  assert.deepEqual(seed.toolbarProfiles.minimal, catalog.TOOLBAR_DEFAULT_MINIMAL_IDS)
  assert.deepEqual(seed.toolbarProfiles.master, catalog.TOOLBAR_CANONICAL_LIVE_ORDER)

  storage.setItem('toolbarProfiles:existing-wave-c1', JSON.stringify({
    version: 3,
    activeToolbarProfile: 'master',
    toolbarProfiles: {
      minimal: ['toolbar.font.family', 'toolbar.insert.link'],
      master: ['toolbar.review.comment'],
    },
  }))

  const resolved = profile.resolveToolbarProfileStateForProjectSwitch(storage, 'existing-wave-c1')
  assert.equal(resolved.source, 'persisted')
  assert.equal(resolved.shouldPersist, false)
  assert.deepEqual(resolved.state, {
    version: 3,
    activeToolbarProfile: 'master',
    toolbarProfiles: {
      minimal: ['toolbar.font.family', 'toolbar.insert.link'],
      master: ['toolbar.review.comment'],
    },
  })
})

test('toolbar expansion wave c1: tiptap styles stay structured and do not reuse plain-text rebuild as primary truth', () => {
  const editorSource = read(['src', 'renderer', 'editor.js'])
  const tiptapSource = read(['src', 'renderer', 'tiptap', 'index.js'])

  const applyTextStyleStart = editorSource.indexOf('function applyTextStyle(action)')
  const legacyBranchStart = editorSource.indexOf('const text = getPlainText();', applyTextStyleStart)
  assert.notEqual(applyTextStyleStart, -1)
  assert.notEqual(legacyBranchStart, -1)

  const tiptapBranch = editorSource.slice(applyTextStyleStart, legacyBranchStart)
  assert.ok(tiptapBranch.includes("applyTiptapParagraphStyle(action)"))
  assert.ok(tiptapBranch.includes("applyTiptapCharacterStyle(action)"))
  assert.equal(tiptapBranch.includes('setPlainText('), false)

  assert.ok(tiptapSource.includes('export function applyTiptapParagraphStyle(optionId)'))
  assert.ok(tiptapSource.includes('export function applyTiptapCharacterStyle(optionId)'))
  assert.ok(tiptapSource.includes("return createStructuredStyleResult('applyCharacterStyle', false, 'NO_SELECTION', optionId)"))
  assert.ok(tiptapSource.includes("return createStructuredStyleResult('applyParagraphStyle', false, 'UNSUPPORTED_STYLE_OPTION', optionId)"))
  assert.ok(tiptapSource.includes('chain.clearNodes().setParagraph().run()'))
  assert.ok(tiptapSource.includes('chain.clearNodes().setHeading({ level: levelMap[optionId] }).run()'))
  assert.ok(tiptapSource.includes('chain.clearNodes().setBlockquote().run()'))
  assert.ok(tiptapSource.includes("paragraphStyle: getStructuredParagraphStyleOption(editor)"))
  assert.ok(tiptapSource.includes("characterStyle: getStructuredCharacterStyleOption(editor)"))
})

test('toolbar expansion wave c1: source pins styles label truth and typed result reasons', () => {
  const editorSource = read(['src', 'renderer', 'editor.js'])

  assert.ok(editorSource.includes("styles: 'styles'"))
  assert.ok(editorSource.includes("return { performed: false, action: 'applyCharacterStyle', reason: 'NO_SELECTION', optionId: action };"))
  assert.ok(editorSource.includes("return { performed: false, action: actionId, reason: 'NO_OP', optionId: action };"))
  assert.ok(editorSource.includes('function handleStyleParagraphMenu()'))
  assert.ok(editorSource.includes('function handleStyleCharacterMenu()'))
})
