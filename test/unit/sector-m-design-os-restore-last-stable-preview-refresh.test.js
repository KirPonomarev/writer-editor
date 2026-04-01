const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function readEditorSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8')
}

test.skip('restore-last-stable preview refresh: success path preserves port usage and adds final preview sync', () => {
  const source = readEditorSource()
  const start = source.indexOf('function performRestoreLastStableShell() {')
  const end = source.indexOf('function openSimpleModal(modal) {', start)
  assert.ok(start > -1 && end > start, 'performRestoreLastStableShell bounds must exist')
  const snippet = source.slice(start, end)

  assert.ok(snippet.includes('designOsDormantRuntimeMount.ports.restoreLastStableShell'))
  assert.ok(snippet.includes('nextRestoreLayoutState = buildSpatialStateFromLayoutSnapshot(layoutSnapshot, {'))
  assert.ok(snippet.includes('applySpatialLayoutState(nextRestoreLayoutState, {'))

  const applyIdx = snippet.indexOf('applySpatialLayoutState(nextRestoreLayoutState, {')
  const syncIdx = snippet.indexOf('syncDesignOsDormantContext();')
  assert.ok(applyIdx > -1)
  assert.ok(syncIdx > applyIdx, 'final sync must run after restored layout apply path')
})

test.skip('restore-last-stable preview refresh: fallback path keeps restore helpers and syncs after both restore calls', () => {
  const source = readEditorSource()
  const start = source.indexOf('function performRestoreLastStableShell() {')
  const end = source.indexOf('function openSimpleModal(modal) {', start)
  const snippet = source.slice(start, end)

  assert.ok(snippet.includes('restoreSpatialLayoutState(currentProjectId);'))
  assert.ok(snippet.includes('restoreLastStableSpatialLayoutState(currentProjectId);'))
  const restoreIdx = snippet.indexOf('restoreSpatialLayoutState(currentProjectId);')
  const restoreStableIdx = snippet.indexOf('restoreLastStableSpatialLayoutState(currentProjectId);')
  const syncIdx = snippet.indexOf('syncDesignOsDormantContext();')
  assert.ok(restoreIdx > -1)
  assert.ok(restoreStableIdx > restoreIdx)
  assert.ok(syncIdx > restoreStableIdx, 'final sync must run after fallback restore calls')
})

test.skip('restore-last-stable preview refresh: single final sync call remains the single preview source inside handler', () => {
  const source = readEditorSource()
  const start = source.indexOf('function performRestoreLastStableShell() {')
  const end = source.indexOf('function openSimpleModal(modal) {', start)
  const snippet = source.slice(start, end)

  const syncMatches = snippet.match(/syncDesignOsDormantContext\(\);/g) || []
  assert.equal(syncMatches.length, 1)
})

test.skip('restore-last-stable preview refresh: safe-reset handler and replay helper remain untouched', () => {
  const source = readEditorSource()
  const safeResetStart = source.indexOf('function performSafeResetShell() {')
  const restoreStart = source.indexOf('function performRestoreLastStableShell() {')
  assert.ok(safeResetStart > -1 && restoreStart > safeResetStart)
  const safeResetSnippet = source.slice(safeResetStart, restoreStart)

  assert.ok(safeResetSnippet.includes('replayDesignOsDormantDesignStateAfterSafeReset();'))
  assert.ok(safeResetSnippet.includes('if (safeResetPortSucceeded) {'))
  assert.ok(safeResetSnippet.includes('const layoutSnapshot = designOsDormantRuntimeMount.ports.safeResetShell();'))
})

test.skip('restore-last-stable preview refresh: compatibility surfaces remain unchanged', () => {
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
