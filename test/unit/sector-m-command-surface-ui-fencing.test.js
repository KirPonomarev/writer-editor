const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function read(filePath) {
  return fs.readFileSync(path.join(ROOT, filePath), 'utf8')
}

test.skip('command surface ui fencing: namespace canon admits only explicit cmd.ui aliases without wildcarding', () => {
  const doc = JSON.parse(read('docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json'))
  const aliasMap = doc.aliasMap || {}

  assert.equal(aliasMap['cmd.ui.theme.set'], 'cmd.ui.theme.set')
  assert.equal(aliasMap['cmd.ui.font.set'], 'cmd.ui.font.set')
  assert.equal(aliasMap['cmd.ui.fontSize.set'], 'cmd.ui.fontSize.set')

  const wildcardKeys = Object.keys(aliasMap).filter((key) => key.includes('*'))
  assert.deepEqual(wildcardKeys, [])
})

test.skip('command surface ui fencing: projectCommands registers existing cmd.ui ids and routes via uiActions only', () => {
  const source = read('src/renderer/commands/projectCommands.mjs')

  assert.ok(source.includes("THEME_SET: 'cmd.ui.theme.set'"))
  assert.ok(source.includes("FONT_SET: 'cmd.ui.font.set'"))
  assert.ok(source.includes("FONT_SIZE_SET: 'cmd.ui.fontSize.set'"))

  assert.ok(source.includes('id: UI_COMMAND_IDS.THEME_SET,'))
  assert.ok(source.includes('id: UI_COMMAND_IDS.FONT_SET,'))
  assert.ok(source.includes('id: UI_COMMAND_IDS.FONT_SIZE_SET,'))

  assert.ok(source.includes("surface: ['internal'],"))
  assert.ok(source.includes("runUiAction(uiActions, 'setTheme', UI_COMMAND_IDS.THEME_SET, input)"))
  assert.ok(source.includes("runUiAction(uiActions, 'setFont', UI_COMMAND_IDS.FONT_SET, input)"))
  assert.ok(source.includes("runUiAction(uiActions, 'setFontSize', UI_COMMAND_IDS.FONT_SIZE_SET, input)"))
})

test.skip('command surface ui fencing: editor exposes uiActions and routes theme user actions via dispatchUiCommand', () => {
  const source = read('src/renderer/editor.js')

  assert.ok(source.includes('setTheme: (payload) => handleUiSetThemeCommand(payload),'))
  assert.ok(source.includes('setFont: (payload) => handleUiSetFontCommand(payload),'))
  assert.ok(source.includes('setFontSize: (payload) => handleUiSetFontSizeCommand(payload),'))

  assert.ok(source.includes("void dispatchUiCommand(UI_COMMAND_IDS.THEME_SET, { theme: 'dark' });"))
  assert.ok(source.includes("void dispatchUiCommand(UI_COMMAND_IDS.THEME_SET, { theme: 'light' });"))
  assert.ok(source.includes('void dispatchUiCommand(UI_COMMAND_IDS.THEME_SET, { theme: nextTheme });'))
})

test.skip('command surface ui fencing: font and font-size user surfaces route through dispatch including custom prompt success path', () => {
  const source = read('src/renderer/editor.js')

  assert.ok(source.includes('function promptForCustomFontSize() {'))
  assert.ok(source.includes('void dispatchUiCommand(UI_COMMAND_IDS.FONT_SET, { fontFamily });'))
  assert.ok(source.includes('void dispatchUiCommand(UI_COMMAND_IDS.FONT_SIZE_SET, { px: nextSize });'))
  assert.ok(source.includes('const customSize = promptForCustomFontSize();'))
  assert.ok(source.includes('void dispatchUiCommand(UI_COMMAND_IDS.FONT_SIZE_SET, { px: customSize });'))
})

test.skip('command surface ui fencing: protected compatibility paths remain unchanged', () => {
  const source = read('src/renderer/editor.js')

  assert.equal(source.includes('window.electronAPI.fileOpen('), false)
  assert.ok(source.includes('function performSafeResetShell() {'))
  assert.ok(source.includes('function performRestoreLastStableShell() {'))
  assert.ok(source.includes("window.electronAPI.onThemeChanged((theme) => {"))
  assert.ok(source.includes("window.electronAPI.onFontChanged((fontFamily) => {"))
  assert.ok(source.includes("window.electronAPI.onEditorSetFontSize(({ px }) => {"))
})
