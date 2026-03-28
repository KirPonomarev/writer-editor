const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function readEditorSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8')
}

test('typography design state: narrow typography patch helper exists and includes only required fields', () => {
  const source = readEditorSource()
  const start = source.indexOf('function buildDesignOsDormantTypographyDesignPatch() {')
  const end = source.indexOf('function commitDesignOsDormantTypographyDesignPatch({ syncPreview = true } = {}) {')
  assert.ok(start > -1 && end > start, 'typography patch helper bounds must exist')
  const snippet = source.slice(start, end)

  assert.ok(snippet.includes('typography: {'))
  assert.ok(snippet.includes('font: {'))
  assert.ok(snippet.includes('body: {'))
  assert.ok(snippet.includes('family: fontFamily,'))
  assert.ok(snippet.includes('sizePx: Number(sizePx.toFixed(2)),'))
  assert.ok(snippet.includes('lineHeight: Number(lineHeightValue.toFixed(3)),'))

  assert.equal(snippet.includes('layout_patch'), false)
  assert.equal(snippet.includes('productTruth'), false)
  assert.equal(snippet.includes('visible_commands'), false)
})

test('typography design state: commit helper uses design_patch only with commit_point apply and refreshes preview', () => {
  const source = readEditorSource()
  const start = source.indexOf('function commitDesignOsDormantTypographyDesignPatch({ syncPreview = true } = {}) {')
  const end = source.indexOf('function remountDesignOsDormantRuntimeForCurrentDocumentContext(options = {}) {')
  assert.ok(start > -1 && end > start, 'typography commit helper bounds must exist')
  const snippet = source.slice(start, end)

  assert.ok(snippet.includes('designOsDormantRuntimeMount.ports.commitDesign({'))
  assert.ok(snippet.includes('context: buildDesignOsDormantContext(),'))
  assert.ok(snippet.includes('design_patch: designPatch,'))
  assert.ok(snippet.includes("commit_point: 'apply',"))
  assert.equal(snippet.includes('layout_patch'), false)
  assert.ok(snippet.includes('syncDesignOsDormantContext();'))
})

test('typography design state: remount helper replays typography patch after runtime recreation', () => {
  const source = readEditorSource()
  const start = source.indexOf('function remountDesignOsDormantRuntimeForCurrentDocumentContext(options = {}) {')
  const end = source.indexOf('function syncDesignOsDormantRuntimeTruthAtSaveBoundary(previousDirtyState, nextDirtyState) {')
  assert.ok(start > -1 && end > start, 'remount helper bounds must exist')
  const snippet = source.slice(start, end)

  assert.ok(snippet.includes('syncDesignOsDormantLayoutCommitAtResizeEnd(layoutStateForReplay);'))
  assert.ok(snippet.includes('commitDesignOsDormantTypographyDesignPatch({ syncPreview: false });'))
  assert.ok(snippet.includes('syncDesignOsDormantContext();'))
})

test('typography design state: apply boundaries trigger typography design patch commit', () => {
  const source = readEditorSource()

  const applyFontStart = source.indexOf('function applyFont(fontFamily) {')
  const applyFontEnd = source.indexOf('function loadSavedFont() {', applyFontStart)
  assert.ok(applyFontStart > -1 && applyFontEnd > applyFontStart, 'applyFont bounds must exist')
  const applyFontSnippet = source.slice(applyFontStart, applyFontEnd)
  assert.ok(applyFontSnippet.includes('editor.style.fontFamily = fontFamily;'))
  assert.ok(applyFontSnippet.includes('commitDesignOsDormantTypographyDesignPatch();'))

  const applyLineHeightStart = source.indexOf('function applyLineHeight(value, persist = true) {')
  const applyLineHeightEnd = source.indexOf('function applyWordWrap(enabled, persist = true) {', applyLineHeightStart)
  assert.ok(applyLineHeightStart > -1 && applyLineHeightEnd > applyLineHeightStart, 'applyLineHeight bounds must exist')
  const applyLineHeightSnippet = source.slice(applyLineHeightStart, applyLineHeightEnd)
  assert.ok(applyLineHeightSnippet.includes('editor.style.lineHeight = String(value);'))
  assert.ok(applyLineHeightSnippet.includes('commitDesignOsDormantTypographyDesignPatch();'))

  const setFontSizeStart = source.indexOf('window.electronAPI.onEditorSetFontSize(({ px }) => {')
  const setFontSizeEnd = source.indexOf('  if (typeof window.electronAPI.onRecoveryRestored === \'function\') {', setFontSizeStart)
  assert.ok(setFontSizeStart > -1 && setFontSizeEnd > setFontSizeStart, 'onEditorSetFontSize bounds must exist')
  const setFontSizeSnippet = source.slice(setFontSizeStart, setFontSizeEnd)
  assert.ok(setFontSizeSnippet.includes('setCurrentFontSize(px);'))
  assert.ok(setFontSizeSnippet.includes('renderStyledView(getPlainText());'))
  assert.ok(setFontSizeSnippet.includes('commitDesignOsDormantTypographyDesignPatch();'))
})

test('typography design state: save-boundary hash logic and key compatibility surfaces remain unchanged', () => {
  const source = readEditorSource()

  const saveBoundaryStart = source.indexOf('function syncDesignOsDormantRuntimeTruthAtSaveBoundary(previousDirtyState, nextDirtyState) {')
  const saveBoundaryEnd = source.indexOf('function mountDesignOsDormantRuntime() {', saveBoundaryStart)
  assert.ok(saveBoundaryStart > -1 && saveBoundaryEnd > saveBoundaryStart, 'save boundary helper bounds must exist')
  const saveBoundarySnippet = source.slice(saveBoundaryStart, saveBoundaryEnd)
  assert.ok(saveBoundarySnippet.includes('if (!previousDirtyState || nextDirtyState) return;'))
  assert.ok(saveBoundarySnippet.includes('if (productTruthHash === designOsDormantLastSyncedProductTruthHash) return;'))

  const applyFontWeightStart = source.indexOf('function applyFontWeight(weight, persist = true) {')
  const applyFontWeightEnd = source.indexOf('function applyLineHeight(value, persist = true) {', applyFontWeightStart)
  const applyFontWeightSnippet = source.slice(applyFontWeightStart, applyFontWeightEnd)
  assert.equal(applyFontWeightSnippet.includes('commitDesignOsDormantTypographyDesignPatch'), false)

  const applyWordWrapStart = source.indexOf('function applyWordWrap(enabled, persist = true) {')
  const applyWordWrapEnd = source.indexOf('function applyViewMode(mode, persist = true) {', applyWordWrapStart)
  const applyWordWrapSnippet = source.slice(applyWordWrapStart, applyWordWrapEnd)
  assert.equal(applyWordWrapSnippet.includes('commitDesignOsDormantTypographyDesignPatch'), false)

  const applyThemeStart = source.indexOf('function applyTheme(theme) {')
  const applyThemeEnd = source.indexOf('function loadSavedTheme() {', applyThemeStart)
  const applyThemeSnippet = source.slice(applyThemeStart, applyThemeEnd)
  assert.equal(applyThemeSnippet.includes('commitDesignOsDormantTypographyDesignPatch'), false)

  assert.ok(source.includes('profile: resolveDormantDesignOsProfileFromStyleValue(styleValue),'))
  assert.ok(source.includes('workspace: mapEditorModeToWorkspace(currentMode),'))
  assert.ok(source.includes('shell_mode: resolveDormantDesignOsShellModeFromLayoutMode(layoutMode),'))
  assert.ok(source.includes('const nextVisibleCommandIds = normalizeDormantVisibleCommandIds(preview?.visible_commands);'))
  assert.ok(source.includes('const cssVariables = extractCssVariablesFromTokens(resolvedTokens, {'))

  const safeResetStart = source.indexOf('function performSafeResetShell() {')
  const restoreStart = source.indexOf('function performRestoreLastStableShell() {')
  assert.ok(safeResetStart > -1 && restoreStart > safeResetStart, 'safe reset and restore function bounds must exist')
  const safeResetSnippet = source.slice(safeResetStart, restoreStart)
  assert.ok(safeResetSnippet.includes('designOsDormantRuntimeMount.ports.safeResetShell'))

  const restoreEnd = source.indexOf('function openDiagnosticsModal() {', restoreStart)
  assert.ok(restoreEnd > restoreStart, 'restore function end bound must exist')
  const restoreSnippet = source.slice(restoreStart, restoreEnd)
  assert.ok(restoreSnippet.includes('designOsDormantRuntimeMount.ports.restoreLastStableShell'))
})
