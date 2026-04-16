const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function readEditorSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8')
}

test('sector-m toolbar startup init crash: formatting state handler is registered only after toolbar color state exists', () => {
  const source = readEditorSource()

  const colorStateIndex = source.indexOf('let toolbarColorPickerState = {')
  const stylesStateIndex = source.indexOf('let toolbarStylesMenuState = {')
  const startupInitIndex = source.indexOf('initializeFloatingToolbarStylesMenu();')
  const firstSyncIndex = source.indexOf('syncToolbarFormattingState();', startupInitIndex)
  const handlerIndex = source.indexOf('setTiptapFormattingStateHandler(syncToolbarFormattingState);')

  assert.ok(colorStateIndex > -1, 'toolbar color picker state must exist')
  assert.ok(stylesStateIndex > colorStateIndex, 'toolbar styles state must exist after color picker state')
  assert.ok(startupInitIndex > stylesStateIndex, 'startup block must appear after toolbar state declarations')
  assert.ok(firstSyncIndex > startupInitIndex, 'startup block must perform an initial formatting sync')
  assert.ok(handlerIndex > firstSyncIndex, 'handler registration must happen after initial formatting sync and state initialization')
})

test('sector-m toolbar startup init crash: drag foundation uses the color picker overlay binding', () => {
  const source = readEditorSource()
  const helperStart = source.indexOf('function initializeFloatingToolbarDragFoundation() {')
  assert.ok(helperStart > -1, 'drag foundation helper must exist')

  const helperSnippet = source.slice(helperStart, helperStart + 500)
  assert.ok(helperSnippet.includes('toolbarColorPickerOverlay,'), 'drag foundation must preserve selection on the real color picker overlay')
  assert.equal(helperSnippet.includes('toolbarColorPicker,'), false, 'drag foundation must not reference a missing toolbarColorPicker binding')
})
