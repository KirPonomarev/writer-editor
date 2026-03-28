const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function readEditorSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8')
}

test('safe reset design-state replay: helper exists and replays typography then theme then single preview sync', () => {
  const source = readEditorSource()
  const start = source.indexOf('function replayDesignOsDormantDesignStateAfterSafeReset() {')
  const end = source.indexOf('function remountDesignOsDormantRuntimeForCurrentDocumentContext(options = {}) {')
  assert.ok(start > -1 && end > start, 'safe-reset replay helper bounds must exist')
  const snippet = source.slice(start, end)

  const typographyIdx = snippet.indexOf('commitDesignOsDormantTypographyDesignPatch({ syncPreview: false });')
  const themeIdx = snippet.indexOf('commitDesignOsDormantThemeDesignPatch({ syncPreview: false });')
  const syncIdx = snippet.indexOf('syncDesignOsDormantContext();')

  assert.ok(typographyIdx > -1, 'typography replay call must exist')
  assert.ok(themeIdx > -1, 'theme replay call must exist')
  assert.ok(syncIdx > -1, 'single final sync call must exist')
  assert.ok(typographyIdx < themeIdx)
  assert.ok(themeIdx < syncIdx)
})

test('safe reset design-state replay: performSafeResetShell success path still uses safeResetShell and invokes replay helper only on success', () => {
  const source = readEditorSource()
  const start = source.indexOf('function performSafeResetShell() {')
  const end = source.indexOf('function performRestoreLastStableShell() {')
  assert.ok(start > -1 && end > start, 'performSafeResetShell bounds must exist')
  const snippet = source.slice(start, end)

  assert.ok(snippet.includes('designOsDormantRuntimeMount.ports.safeResetShell'))
  assert.ok(snippet.includes('let safeResetPortSucceeded = false;'))
  assert.ok(snippet.includes('safeResetPortSucceeded = true;'))
  assert.ok(snippet.includes('if (safeResetPortSucceeded) {'))
  assert.ok(snippet.includes('replayDesignOsDormantDesignStateAfterSafeReset();'))

  const portCallIdx = snippet.indexOf('const layoutSnapshot = designOsDormantRuntimeMount.ports.safeResetShell();')
  const successFlagIdx = snippet.indexOf('safeResetPortSucceeded = true;')
  const replayGuardIdx = snippet.indexOf('if (safeResetPortSucceeded) {')
  const replayCallIdx = snippet.indexOf('replayDesignOsDormantDesignStateAfterSafeReset();')
  const sizeApplyIdx = snippet.indexOf('setCurrentFontSize(SAFE_RESET_BASELINE_FONT_SIZE_PX);')

  assert.ok(portCallIdx > -1)
  assert.ok(successFlagIdx > portCallIdx)
  assert.ok(sizeApplyIdx > successFlagIdx)
  assert.ok(replayGuardIdx > sizeApplyIdx)
  assert.ok(replayCallIdx > replayGuardIdx)
})

test('safe reset design-state replay: safe-reset layout translation and baseline fallback remain unchanged', () => {
  const source = readEditorSource()
  const start = source.indexOf('function performSafeResetShell() {')
  const end = source.indexOf('function performRestoreLastStableShell() {')
  const snippet = source.slice(start, end)

  assert.ok(snippet.includes('nextSafeResetLayoutState = buildSpatialStateFromLayoutSnapshot(layoutSnapshot, {'))
  assert.ok(snippet.includes('applySpatialLayoutState(nextSafeResetLayoutState || getSpatialLayoutBaselineForViewport(), {'))
  assert.ok(snippet.includes('commitSpatialLayoutState(currentProjectId);'))
})

test('safe reset design-state replay: restore-last-stable handler remains without replay helper call', () => {
  const source = readEditorSource()
  const start = source.indexOf('function performRestoreLastStableShell() {')
  const end = source.indexOf('function openSimpleModal(modal) {', start)
  assert.ok(start > -1 && end > start, 'performRestoreLastStableShell bounds must exist')
  const snippet = source.slice(start, end)

  assert.equal(snippet.includes('replayDesignOsDormantDesignStateAfterSafeReset'), false)
  assert.ok(snippet.includes('designOsDormantRuntimeMount.ports.restoreLastStableShell'))
})

test('safe reset design-state replay: patch helpers and compatibility surfaces remain unchanged', () => {
  const source = readEditorSource()

  const typographyCommitStart = source.indexOf('function commitDesignOsDormantTypographyDesignPatch({ syncPreview = true } = {}) {')
  const themePatchStart = source.indexOf('function buildDesignOsDormantThemeDesignPatch() {')
  assert.ok(typographyCommitStart > -1 && themePatchStart > typographyCommitStart)
  const typographyCommitSnippet = source.slice(typographyCommitStart, themePatchStart)
  assert.ok(typographyCommitSnippet.includes("commit_point: 'apply',"))

  const themeCommitStart = source.indexOf('function commitDesignOsDormantThemeDesignPatch({ syncPreview = true } = {}) {')
  const replayHelperStart = source.indexOf('function replayDesignOsDormantDesignStateAfterSafeReset() {')
  assert.ok(themeCommitStart > -1 && replayHelperStart > themeCommitStart)
  const themeCommitSnippet = source.slice(themeCommitStart, replayHelperStart)
  assert.ok(themeCommitSnippet.includes("commit_point: 'mode_switch',"))

  const saveBoundaryStart = source.indexOf('function syncDesignOsDormantRuntimeTruthAtSaveBoundary(previousDirtyState, nextDirtyState) {')
  const saveBoundaryEnd = source.indexOf('function mountDesignOsDormantRuntime() {', saveBoundaryStart)
  assert.ok(saveBoundaryStart > -1 && saveBoundaryEnd > saveBoundaryStart)
  const saveBoundarySnippet = source.slice(saveBoundaryStart, saveBoundaryEnd)
  assert.ok(saveBoundarySnippet.includes('if (!previousDirtyState || nextDirtyState) return;'))
  assert.ok(saveBoundarySnippet.includes('if (productTruthHash === designOsDormantLastSyncedProductTruthHash) return;'))

  assert.ok(source.includes('profile: resolveDormantDesignOsProfileFromStyleValue(styleValue),'))
  assert.ok(source.includes('workspace: mapEditorModeToWorkspace(currentMode),'))
  assert.ok(source.includes('shell_mode: resolveDormantDesignOsShellModeFromLayoutMode(layoutMode),'))
  assert.ok(source.includes('const nextVisibleCommandIds = normalizeDormantVisibleCommandIds(preview?.visible_commands);'))
  assert.ok(source.includes('const cssVariables = extractCssVariablesFromTokens(resolvedTokens, {'))
})
