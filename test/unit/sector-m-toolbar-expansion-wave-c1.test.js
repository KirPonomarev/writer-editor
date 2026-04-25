const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function read(parts) {
  return fs.readFileSync(path.join(ROOT, ...parts), 'utf8')
}

test('sector-m toolbar expansion wave c1: main toolbar exposes styles group and shared menu shell in canonical DOM order', () => {
  const html = read(['src', 'renderer', 'index.html'])
  const controlsMatch = html.match(/<div class="floating-toolbar__controls">([\s\S]*?)<div class="floating-toolbar__paragraph-menu"/)
  assert.ok(controlsMatch, 'main floating toolbar controls block must exist')

  const bindKeys = [...controlsMatch[1].matchAll(/data-toolbar-item-key="([^"]+)"/g)].map((match) => match[1])
  assert.deepEqual(bindKeys, [
    'font-select',
    'weight-select',
    'size-select',
    'line-height-select',
    'format-bold',
    'format-italic',
    'format-underline',
    'paragraph-trigger',
    'list-type',
    'insert-link',
    'color-text',
    'color-highlight',
    'review-comment',
    'style-paragraph',
    'style-character',
    'history-undo',
    'history-redo',
  ])

  assert.ok(html.includes('floating-toolbar__group--styles'))
  assert.ok(html.includes('data-action="toggle-style-paragraph-menu"'))
  assert.ok(html.includes('data-action="toggle-style-character-menu"'))
  assert.ok(html.includes('data-toolbar-styles-menu'))
  assert.ok(html.includes('data-style-paragraph-option="paragraph-none"'))
  assert.ok(html.includes('data-style-paragraph-option="paragraph-blockquote"'))
  assert.ok(html.includes('data-style-character-option="character-emphasis"'))
  assert.ok(html.includes('data-style-character-option="character-code-span"'))
})

test('sector-m toolbar expansion wave c1: editor wiring keeps styles local and mutually bounded against other overlays', () => {
  const editorSource = read(['src', 'renderer', 'editor.js'])
  const stylesSource = read(['src', 'renderer', 'styles.css'])

  assert.ok(editorSource.includes('applyTiptapParagraphStyle,'))
  assert.ok(editorSource.includes('applyTiptapCharacterStyle,'))
  assert.ok(editorSource.includes('function setToolbarStylesMenuOpen(nextOpen, nextAnchor = toolbarStylesMenuState.anchor)'))
  assert.ok(editorSource.includes('function initializeFloatingToolbarStylesMenu()'))
  assert.ok(editorSource.includes("case 'toggle-style-paragraph-menu':"))
  assert.ok(editorSource.includes("case 'toggle-style-character-menu':"))
  assert.ok(editorSource.includes('applyTextStyle(optionId);'))
  assert.ok(editorSource.includes("setToolbarStylesMenuOpen(false);"))
  assert.ok(editorSource.includes('const TOOLBAR_STYLES_MENU_ANCHORS = Object.freeze({'))
  assert.ok(editorSource.includes("paragraph: 'paragraph'"))
  assert.ok(editorSource.includes("character: 'character'"))
  assert.ok(editorSource.includes('toolbarStylesMenuState.anchor === TOOLBAR_STYLES_MENU_ANCHORS.paragraph'))
  assert.ok(editorSource.includes('toolbarStylesMenuState.anchor === TOOLBAR_STYLES_MENU_ANCHORS.character'))

  const spacingStart = editorSource.indexOf('function setToolbarSpacingMenuOpen(nextOpen)')
  const paragraphStart = editorSource.indexOf('function setParagraphMenuOpen(nextOpen)')
  const listStart = editorSource.indexOf('function setListMenuOpen(nextOpen)')
  const stylesStart = editorSource.indexOf('function setToolbarStylesMenuOpen(nextOpen, nextAnchor = toolbarStylesMenuState.anchor)')
  const tuningStart = editorSource.indexOf('function setToolbarSpacingTuningMode(nextActive)')
  assert.ok(spacingStart > -1 && paragraphStart > spacingStart && listStart > paragraphStart && stylesStart > listStart && tuningStart > stylesStart)

  const spacingSnippet = editorSource.slice(spacingStart, paragraphStart)
  const paragraphSnippet = editorSource.slice(paragraphStart, listStart)
  const listSnippet = editorSource.slice(listStart, stylesStart)
  const stylesSnippet = editorSource.slice(stylesStart, tuningStart)
  assert.ok(spacingSnippet.includes('setToolbarStylesMenuOpen(false);'))
  assert.ok(paragraphSnippet.includes('setToolbarStylesMenuOpen(false);'))
  assert.ok(listSnippet.includes('setToolbarStylesMenuOpen(false);'))
  assert.ok(stylesSnippet.includes('setToolbarColorPickerOpen(false);'))
  assert.ok(stylesSnippet.includes('setParagraphMenuOpen(false);'))
  assert.ok(stylesSnippet.includes('setListMenuOpen(false);'))

  assert.ok(stylesSource.includes('.floating-toolbar__group--styles'))
  assert.ok(stylesSource.includes('.floating-toolbar__button--styles'))
  assert.ok(stylesSource.includes('.floating-toolbar__styles-menu'))
  assert.ok(stylesSource.includes('.floating-toolbar__styles-menu-item'))
})
