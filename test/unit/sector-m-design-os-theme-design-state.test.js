const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function readEditorSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8')
}

test('theme design state: current theme design_patch helper exists with color and surface fields only', () => {
  const source = readEditorSource()
  const start = source.indexOf('function buildDesignOsDormantThemeDesignPatch() {')
  const end = source.indexOf('function commitDesignOsDormantThemeDesignPatch({ syncPreview = true } = {}) {')
  assert.ok(start > -1 && end > start, 'theme patch helper bounds must exist')
  const snippet = source.slice(start, end)

  assert.ok(snippet.includes('color: {'))
  assert.ok(snippet.includes('background: {'))
  assert.ok(snippet.includes('canvas: backgroundCanvas,'))
  assert.ok(snippet.includes('text: {'))
  assert.ok(snippet.includes('primary: foregroundPrimary,'))
  assert.ok(snippet.includes('surface: {'))
  assert.ok(snippet.includes('panel: surfacePanel,'))
  assert.ok(snippet.includes('elevated: surfaceElevated,'))
  assert.ok(snippet.includes('surface: {'))
  assert.ok(snippet.includes('shell: {'))
  assert.ok(snippet.includes('editor: {'))

  assert.equal(snippet.includes('layout_patch'), false)
  assert.equal(snippet.includes('productTruth'), false)
  assert.equal(snippet.includes('typography:'), false)
})

test('theme design state: commit helper uses design_patch only with commit_point mode_switch and refreshes preview', () => {
  const source = readEditorSource()
  const start = source.indexOf('function commitDesignOsDormantThemeDesignPatch({ syncPreview = true } = {}) {')
  const end = source.indexOf('function remountDesignOsDormantRuntimeForCurrentDocumentContext(options = {}) {')
  assert.ok(start > -1 && end > start, 'theme commit helper bounds must exist')
  const snippet = source.slice(start, end)

  assert.ok(snippet.includes('designOsDormantRuntimeMount.ports.commitDesign({'))
  assert.ok(snippet.includes('context: buildDesignOsDormantContext(),'))
  assert.ok(snippet.includes('design_patch: designPatch,'))
  assert.ok(snippet.includes("commit_point: 'mode_switch',"))
  assert.equal(snippet.includes('layout_patch'), false)
  assert.ok(snippet.includes('syncDesignOsDormantContext();'))
})

test('theme design state: applyTheme commits theme patch and saved theme paths reuse applyTheme', () => {
  const source = readEditorSource()

  const applyThemeStart = source.indexOf('function applyTheme(theme) {')
  const applyThemeEnd = source.indexOf('function loadSavedTheme() {', applyThemeStart)
  assert.ok(applyThemeStart > -1 && applyThemeEnd > applyThemeStart, 'applyTheme bounds must exist')
  const applyThemeSnippet = source.slice(applyThemeStart, applyThemeEnd)
  assert.ok(applyThemeSnippet.includes("document.body.classList.add('dark-theme');"))
  assert.ok(applyThemeSnippet.includes("document.body.classList.remove('dark-theme');"))
  assert.ok(applyThemeSnippet.includes('commitDesignOsDormantThemeDesignPatch();'))

  const loadSavedThemeStart = source.indexOf('function loadSavedTheme() {')
  const loadSavedThemeEnd = source.indexOf('if (window.electronAPI) {', loadSavedThemeStart)
  const loadSavedThemeSnippet = source.slice(loadSavedThemeStart, loadSavedThemeEnd)
  assert.ok(loadSavedThemeSnippet.includes('applyTheme(savedTheme);'))

  const onThemeChangedStart = source.indexOf('window.electronAPI.onThemeChanged((theme) => {')
  const onThemeChangedEnd = source.indexOf('});\n}\n\nloadSavedTheme();', onThemeChangedStart)
  assert.ok(onThemeChangedStart > -1 && onThemeChangedEnd > onThemeChangedStart, 'onThemeChanged bounds must exist')
  const onThemeChangedSnippet = source.slice(onThemeChangedStart, onThemeChangedEnd)
  assert.ok(onThemeChangedSnippet.includes('applyTheme(theme);'))
})

test('theme design state: remount replays theme patch before final preview sync and keeps typography replay', () => {
  const source = readEditorSource()
  const start = source.indexOf('function remountDesignOsDormantRuntimeForCurrentDocumentContext(options = {}) {')
  const end = source.indexOf('function syncDesignOsDormantRuntimeTruthAtSaveBoundary(previousDirtyState, nextDirtyState) {')
  assert.ok(start > -1 && end > start, 'remount helper bounds must exist')
  const snippet = source.slice(start, end)

  const layoutIdx = snippet.indexOf('syncDesignOsDormantLayoutCommitAtResizeEnd(layoutStateForReplay);')
  const typographyReplayIdx = snippet.indexOf('commitDesignOsDormantTypographyDesignPatch({ syncPreview: false });')
  const themeReplayIdx = snippet.indexOf('commitDesignOsDormantThemeDesignPatch({ syncPreview: false });')
  const previewSyncIdx = snippet.indexOf('syncDesignOsDormantContext();')

  assert.ok(layoutIdx > -1, 'layout replay must remain')
  assert.ok(typographyReplayIdx > -1, 'typography replay must remain')
  assert.ok(themeReplayIdx > -1, 'theme replay must exist')
  assert.ok(previewSyncIdx > -1, 'final preview sync must remain')
  assert.ok(layoutIdx < typographyReplayIdx)
  assert.ok(typographyReplayIdx < themeReplayIdx)
  assert.ok(themeReplayIdx < previewSyncIdx)
})

test('theme design state: typography flow and save-boundary hash logic remain compatible', () => {
  const source = readEditorSource()

  const applyFontStart = source.indexOf('function applyFont(fontFamily) {')
  const applyFontEnd = source.indexOf('function loadSavedFont() {', applyFontStart)
  const applyFontSnippet = source.slice(applyFontStart, applyFontEnd)
  assert.ok(applyFontSnippet.includes('commitDesignOsDormantTypographyDesignPatch();'))
  assert.equal(applyFontSnippet.includes('commitDesignOsDormantThemeDesignPatch();'), false)

  const applyLineHeightStart = source.indexOf('function applyLineHeight(value, persist = true) {')
  const applyLineHeightEnd = source.indexOf('function applyWordWrap(enabled, persist = true) {', applyLineHeightStart)
  const applyLineHeightSnippet = source.slice(applyLineHeightStart, applyLineHeightEnd)
  assert.ok(applyLineHeightSnippet.includes('commitDesignOsDormantTypographyDesignPatch();'))
  assert.equal(applyLineHeightSnippet.includes('commitDesignOsDormantThemeDesignPatch();'), false)

  const applyFontWeightStart = source.indexOf('function applyFontWeight(weight, persist = true) {')
  const applyFontWeightEnd = source.indexOf('function applyLineHeight(value, persist = true) {', applyFontWeightStart)
  const applyFontWeightSnippet = source.slice(applyFontWeightStart, applyFontWeightEnd)
  assert.equal(applyFontWeightSnippet.includes('commitDesignOsDormantThemeDesignPatch'), false)

  const applyWordWrapStart = source.indexOf('function applyWordWrap(enabled, persist = true) {')
  const applyWordWrapEnd = source.indexOf('function applyViewMode(mode, persist = true) {', applyWordWrapStart)
  const applyWordWrapSnippet = source.slice(applyWordWrapStart, applyWordWrapEnd)
  assert.equal(applyWordWrapSnippet.includes('commitDesignOsDormantThemeDesignPatch'), false)

  const saveBoundaryStart = source.indexOf('function syncDesignOsDormantRuntimeTruthAtSaveBoundary(previousDirtyState, nextDirtyState) {')
  const saveBoundaryEnd = source.indexOf('function mountDesignOsDormantRuntime() {', saveBoundaryStart)
  const saveBoundarySnippet = source.slice(saveBoundaryStart, saveBoundaryEnd)
  assert.ok(saveBoundarySnippet.includes('if (!previousDirtyState || nextDirtyState) return;'))
  assert.ok(saveBoundarySnippet.includes('if (productTruthHash === designOsDormantLastSyncedProductTruthHash) return;'))

  assert.ok(source.includes('profile: resolveDormantDesignOsProfileFromStyleValue(styleValue),'))
  assert.ok(source.includes('workspace: mapEditorModeToWorkspace(currentMode),'))
  assert.ok(source.includes('shell_mode: resolveDormantDesignOsShellModeFromLayoutMode(layoutMode),'))
  assert.ok(source.includes('const nextVisibleCommandIds = normalizeDormantVisibleCommandIds(preview?.visible_commands);'))
  assert.ok(source.includes('const cssVariables = extractCssVariablesFromTokens(resolvedTokens, {'))
})
