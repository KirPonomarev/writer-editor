const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function read(filePath) {
  return fs.readFileSync(path.join(ROOT, filePath), 'utf8')
}

test('preload ui command bridge: preload exposes one typed invoke api for command bridge', () => {
  const source = read('src/preload.js')

  assert.equal((source.match(/invokeUiCommandBridge:\s*\(request\)\s*=>\s*\{/g) || []).length, 1)
  assert.ok(source.includes("const UI_COMMAND_BRIDGE_CHANNEL = 'ui:command-bridge';"))
  assert.ok(source.includes("return ipcRenderer.invoke(UI_COMMAND_BRIDGE_CHANNEL, { route, commandId, payload });"))
})

test('preload ui command bridge: main exposes one handler and enforces route and allowlist', () => {
  const source = read('src/main.js')

  assert.equal((source.match(/ipcMain\.handle\('ui:command-bridge'/g) || []).length, 1)
  assert.ok(source.includes("if (route !== COMMAND_BUS_ROUTE) {"))
  assert.ok(source.includes("return { ok: false, reason: 'COMMAND_ROUTE_UNSUPPORTED' };"))
  assert.ok(source.includes('UI_COMMAND_BRIDGE_ALLOWED_COMMAND_IDS'))
  assert.ok(source.includes("'cmd.ui.theme.set'"))
  assert.ok(source.includes("'cmd.ui.font.set'"))
  assert.ok(source.includes("'cmd.ui.fontSize.set'"))
  assert.ok(source.includes("return { ok: false, reason: 'COMMAND_ID_NOT_ALLOWED' };"))
  assert.ok(source.includes('dispatchMenuCommand(commandId, payload, { route: COMMAND_BUS_ROUTE })'))
})

test('preload ui command bridge: editor cmd.ui handlers use bridge and no longer call direct setTheme setFont setFontSizePx', () => {
  const source = read('src/renderer/editor.js')

  assert.ok(source.includes('async function handleUiSetThemeCommand(payload = {}) {'))
  assert.ok(source.includes('async function handleUiSetFontCommand(payload = {}) {'))
  assert.ok(source.includes('async function handleUiSetFontSizeCommand(payload = {}) {'))
  assert.ok(source.includes('invokePreloadUiCommandBridge(UI_COMMAND_IDS.THEME_SET, { theme: nextTheme })'))
  assert.ok(source.includes('invokePreloadUiCommandBridge(UI_COMMAND_IDS.FONT_SET, { fontFamily })'))
  assert.ok(source.includes('invokePreloadUiCommandBridge(UI_COMMAND_IDS.FONT_SIZE_SET, { px })'))

  assert.equal(source.includes('window.electronAPI.setTheme(nextTheme);'), false)
  assert.equal(source.includes('window.electronAPI.setFont(fontFamily);'), false)
  assert.equal(source.includes('window.electronAPI.setFontSizePx(px);'), false)
})

test('preload ui command bridge: legacy internal non-command paths remain present', () => {
  const preloadSource = read('src/preload.js')
  const editorSource = read('src/renderer/editor.js')

  assert.ok(preloadSource.includes("setTheme: (theme) => {"))
  assert.ok(preloadSource.includes("ipcRenderer.send('ui:set-theme', theme);"))
  assert.ok(preloadSource.includes("setFont: (fontFamily) => {"))
  assert.ok(preloadSource.includes("ipcRenderer.send('ui:set-font', fontFamily);"))
  assert.ok(preloadSource.includes("setFontSizePx: (px) => {"))
  assert.ok(preloadSource.includes("ipcRenderer.send('ui:set-font-size', px);"))

  assert.ok(editorSource.includes('function performSafeResetShell() {'))
  assert.ok(editorSource.includes('function performRestoreLastStableShell() {'))
})
