const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function readEditorSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8')
}

test('shell mode adoption: buildDesignOsDormantContext uses existing spatial layout mode facts and no longer hardcodes CALM_DOCKED', () => {
  const source = readEditorSource()

  const helperStart = source.indexOf('function resolveDormantDesignOsShellModeFromLayoutMode(layoutMode) {')
  const helperEnd = source.indexOf('function buildDesignOsDormantContext()')
  assert.ok(helperStart > -1 && helperEnd > helperStart, 'shell mode helper bounds must exist')
  const helperSnippet = source.slice(helperStart, helperEnd)
  assert.ok(helperSnippet.includes("if (normalized === 'compact' || normalized === 'mobile') return 'COMPACT_DOCKED';"))
  assert.ok(helperSnippet.includes("return 'CALM_DOCKED';"))
  assert.equal(helperSnippet.includes('SPATIAL_ADVANCED'), false)
  assert.equal(helperSnippet.includes('SAFE_RECOVERY'), false)

  const contextStart = source.indexOf('function buildDesignOsDormantContext()')
  const contextEnd = source.indexOf('function buildDesignOsDormantProductTruth()')
  assert.ok(contextStart > -1 && contextEnd > contextStart, 'context builder bounds must exist')
  const contextSnippet = source.slice(contextStart, contextEnd)
  assert.ok(contextSnippet.includes('const layoutMode = spatialLayoutState && typeof spatialLayoutState.viewportMode === \'string\''))
  assert.ok(contextSnippet.includes('shell_mode: resolveDormantDesignOsShellModeFromLayoutMode(layoutMode),'))
  assert.equal(contextSnippet.includes("shell_mode: 'CALM_DOCKED'"), false)
  assert.ok(contextSnippet.includes('profile: resolveDormantDesignOsProfileFromStyleValue(styleValue),'))
  assert.ok(contextSnippet.includes('workspace: mapEditorModeToWorkspace(currentMode),'))
})

test('shell mode adoption: resize path triggers dormant preview resync after spatial layout update', () => {
  const source = readEditorSource()
  const start = source.indexOf("window.addEventListener('resize', () => {")
  const end = source.indexOf('scheduleLayoutRefresh();', start)
  assert.ok(start > -1 && end > start, 'resize listener bounds must exist')
  const snippet = source.slice(start, end + 'scheduleLayoutRefresh();'.length)
  const updateIdx = snippet.indexOf('updateSpatialLayoutForViewportChange();')
  const syncIdx = snippet.indexOf('syncDesignOsDormantContext();')
  assert.ok(updateIdx > -1 && syncIdx > -1, 'resize path must include update and sync')
  assert.ok(syncIdx > updateIdx, 'sync must run after spatial layout update')
})

test('shell mode adoption: syncDesignOsDormantContext remains the single source for visible_commands resolved_tokens and degraded_to_baseline', () => {
  const source = readEditorSource()
  const start = source.indexOf('function syncDesignOsDormantContext()')
  const end = source.indexOf('function syncDesignOsDormantTextInput()')
  assert.ok(start > -1 && end > start, 'syncDesignOsDormantContext bounds must exist')
  const snippet = source.slice(start, end)
  assert.ok(snippet.includes('const preview = designOsDormantRuntimeMount.ports.previewDesign({'))
  assert.ok(snippet.includes('designOsDormantDegradedToBaseline = preview?.degraded_to_baseline === true;'))
  assert.ok(snippet.includes('const nextVisibleCommandIds = normalizeDormantVisibleCommandIds(preview?.visible_commands);'))
  assert.ok(snippet.includes('const resolvedTokens = preview?.resolved_tokens;'))
  assert.ok(snippet.includes('const cssVariables = extractCssVariablesFromTokens(resolvedTokens, {'))
  assert.ok(snippet.includes('applyCssVariables(document.documentElement, cssVariables);'))
})

test('shell mode adoption: layout commit helper continues to use context.shell_mode and handler flow remains unchanged', () => {
  const source = readEditorSource()
  const start = source.indexOf('function syncDesignOsDormantLayoutCommitAtResizeEnd(committedSpatialState)')
  const end = source.indexOf('function applyMode(mode)')
  assert.ok(start > -1 && end > start, 'layout commit helper bounds must exist')
  const snippet = source.slice(start, end)
  assert.ok(snippet.includes('const context = buildDesignOsDormantContext();'))
  assert.ok(snippet.includes("shellMode: context.shell_mode || 'CALM_DOCKED',"))
  assert.ok(snippet.includes("commit_point: 'resize_end',"))
})

test('shell mode adoption: command palette wrapper token css path safe reset restore and runtime bridge surface remain compatible', () => {
  const source = readEditorSource()

  assert.ok(source.includes('function createDormantAwarePaletteDataProvider(baseProvider) {'))
  assert.ok(source.includes('const commandPaletteDataProvider = createDormantAwarePaletteDataProvider(baseCommandPaletteDataProvider);'))
  assert.ok(source.includes('window.__COMMAND_PALETTE_DATA_PROVIDER_V1__ = commandPaletteDataProvider;'))
  assert.ok(source.includes('const cssVariables = extractCssVariablesFromTokens(resolvedTokens, {'))
  assert.ok(source.includes('applyCssVariables(document.documentElement, cssVariables);'))

  const safeStart = source.indexOf('function performSafeResetShell()')
  const safeEnd = source.indexOf('function performRestoreLastStableShell()')
  assert.ok(safeStart > -1 && safeEnd > safeStart, 'safe reset bounds must exist')
  const safeSnippet = source.slice(safeStart, safeEnd)
  assert.ok(safeSnippet.includes("typeof designOsDormantRuntimeMount.ports.safeResetShell === 'function'"))

  const restoreStart = source.indexOf('function performRestoreLastStableShell()')
  const restoreEnd = source.indexOf('function openSimpleModal(modal)')
  assert.ok(restoreStart > -1 && restoreEnd > restoreStart, 'restore bounds must exist')
  const restoreSnippet = source.slice(restoreStart, restoreEnd)
  assert.ok(restoreSnippet.includes("typeof designOsDormantRuntimeMount.ports.restoreLastStableShell === 'function'"))

  const bridgeSource = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'tiptap', 'runtimeBridge.js'), 'utf8')
  const commands = [...bridgeSource.matchAll(/command === '([^']+)'/g)]
    .map((match) => match[1])
    .filter((command) => command !== 'string')

  assert.deepEqual(commands, [
    'undo',
    'edit-undo',
    'redo',
    'edit-redo',
    'open-settings',
    'safe-reset-shell',
    'restore-last-stable-shell',
    'open-diagnostics',
    'open-recovery',
    'open-export-preview',
    'insert-add-card',
    'format-align-left',
    'switch-mode-plan',
    'switch-mode-review',
    'switch-mode-write',
  ])
})
