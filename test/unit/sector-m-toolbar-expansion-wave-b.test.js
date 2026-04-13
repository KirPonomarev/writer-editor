const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function read(parts) {
  return fs.readFileSync(path.join(ROOT, ...parts), 'utf8')
}

test('sector-m toolbar expansion wave b: main toolbar exposes bounded color review groups and shared picker shell in canonical DOM order', () => {
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

  assert.ok(html.includes('floating-toolbar__group--color'))
  assert.ok(html.includes('floating-toolbar__group--review'))
  assert.ok(html.includes('data-action="color-text"'))
  assert.ok(html.includes('data-action="color-highlight"'))
  assert.ok(html.includes('data-action="review-open-comments"'))
  assert.ok(html.includes('data-toolbar-color-picker'))
  assert.ok(html.includes('data-toolbar-color-picker-title'))
  assert.ok(html.includes('data-toolbar-color-picker-swatches'))
  assert.ok(html.includes('data-toolbar-color-picker-close'))
})

test('sector-m toolbar expansion wave b: editor wiring keeps color and review behavior behind command kernel and bounded shell semantics', () => {
  const editorSource = read(['src', 'renderer', 'editor.js'])
  const stylesSource = read(['src', 'renderer', 'styles.css'])

  assert.ok(editorSource.includes("void dispatchUiCommand(EXTRA_COMMAND_IDS.FORMAT_TEXT_COLOR_PICKER);"))
  assert.ok(editorSource.includes("void dispatchUiCommand(EXTRA_COMMAND_IDS.FORMAT_HIGHLIGHT_COLOR_PICKER);"))
  assert.ok(editorSource.includes("void dispatchUiCommand(EXTRA_COMMAND_IDS.REVIEW_OPEN_COMMENTS);"))
  assert.ok(editorSource.includes("formatTextColorPicker: () => handleFormatTextColorPicker()"))
  assert.ok(editorSource.includes("formatHighlightColorPicker: () => handleFormatHighlightColorPicker()"))
  assert.ok(editorSource.includes("reviewOpenComments: () => handleReviewOpenComments()"))
  assert.ok(editorSource.includes("if (currentMode === 'review' && currentRightTab === 'comments') {"))
  assert.ok(editorSource.includes("applyMode('review');"))
  assert.ok(editorSource.includes("applyRightTab('comments');"))
  assert.ok(editorSource.includes("return { performed: true, action: 'reviewOpenComments', reason: null };"))
  assert.ok(editorSource.includes("handleTiptapFormatCommand('setColor', { value })"))
  assert.ok(editorSource.includes("handleTiptapFormatCommand('unsetColor')"))
  assert.ok(editorSource.includes("handleTiptapFormatCommand('setHighlight', { value })"))
  assert.ok(editorSource.includes("handleTiptapFormatCommand('unsetHighlight')"))
  assert.ok(editorSource.includes("const target = event.target instanceof Element ? event.target.closest('[data-toolbar-color-swatch-value], [data-toolbar-color-picker-close]') : null;"))
  assert.ok(editorSource.includes("if (target.closest('[data-toolbar-item-key=\"color-text\"], [data-toolbar-item-key=\"color-highlight\"]')) return;"))

  assert.ok(stylesSource.includes('.floating-toolbar__group--color'))
  assert.ok(stylesSource.includes('.floating-toolbar__group--review'))
  assert.ok(stylesSource.includes('.floating-toolbar__color-picker'))
  assert.ok(stylesSource.includes('.floating-toolbar__color-picker-swatches'))
  assert.ok(stylesSource.includes('.floating-toolbar__button--color'))
  assert.ok(stylesSource.includes('.floating-toolbar__button--review'))
})
