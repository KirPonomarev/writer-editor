const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function readEditorSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8')
}

test.skip('profile adoption: buildDesignOsDormantContext no longer hardcodes BASELINE and maps style selector to BASELINE and FOCUS', () => {
  const source = readEditorSource()
  assert.ok(source.includes('function resolveDormantDesignOsProfileFromStyleValue(styleValue) {'))
  const helperStart = source.indexOf('function resolveDormantDesignOsProfileFromStyleValue(styleValue) {')
  const helperEnd = source.indexOf('function buildDesignOsDormantContext()')
  assert.ok(helperStart > -1 && helperEnd > helperStart, 'profile helper bounds must exist')
  const helperSnippet = source.slice(helperStart, helperEnd)
  assert.ok(helperSnippet.includes("if (normalized === 'focus') return 'FOCUS';"))
  assert.ok(helperSnippet.includes("return 'BASELINE';"))
  assert.equal(helperSnippet.includes('COMPACT'), false)
  assert.equal(helperSnippet.includes('SAFE'), false)

  const start = source.indexOf('function buildDesignOsDormantContext()')
  const end = source.indexOf('function buildDesignOsDormantProductTruth()')
  assert.ok(start > -1 && end > start, 'buildDesignOsDormantContext bounds must exist')
  const snippet = source.slice(start, end)
  assert.ok(snippet.includes("const styleValue = styleSelect && typeof styleSelect.value === 'string' ? styleSelect.value : '';"))
  assert.ok(snippet.includes('profile: resolveDormantDesignOsProfileFromStyleValue(styleValue),'))
  assert.equal(snippet.includes("profile: 'BASELINE'"), false)
})

test.skip('profile adoption: applyViewMode triggers dormant preview resync after local focus and persistence update', () => {
  const source = readEditorSource()
  const start = source.indexOf('function applyViewMode(mode, persist = true) {')
  const end = source.indexOf('function applyTextStyle(action) {')
  assert.ok(start > -1 && end > start, 'applyViewMode bounds must exist')
  const snippet = source.slice(start, end)

  const toggleIdx = snippet.indexOf("document.body.classList.toggle('focus-mode', isFocus);")
  const selectIdx = snippet.indexOf('styleSelect.value = mode;')
  const persistIdx = snippet.indexOf("localStorage.setItem('editorViewMode', mode);")
  const syncIdx = snippet.indexOf('syncDesignOsDormantContext();')
  assert.ok(toggleIdx > -1 && selectIdx > -1 && persistIdx > -1 && syncIdx > -1)
  assert.ok(syncIdx > persistIdx, 'sync must run after local focus and persistence updates')
})

test.skip('profile adoption: syncDesignOsDormantContext remains the single path for degraded visible_commands and resolved_tokens refresh', () => {
  const source = readEditorSource()
  const start = source.indexOf('function syncDesignOsDormantContext()')
  const end = source.indexOf('function syncDesignOsDormantTextInput()')
  assert.ok(start > -1 && end > start, 'syncDesignOsDormantContext bounds must exist')
  const snippet = source.slice(start, end)

  assert.ok(snippet.includes('const preview = designOsDormantRuntimeMount.ports.previewDesign({'))
  assert.ok(snippet.includes('designOsDormantDegradedToBaseline = preview?.degraded_to_baseline === true;'))
  assert.ok(snippet.includes('const nextVisibleCommandIds = normalizeDormantVisibleCommandIds(preview?.visible_commands);'))
  assert.ok(snippet.includes('designOsDormantVisibleCommandIds = nextVisibleCommandIds;'))
  assert.ok(snippet.includes('const resolvedTokens = preview?.resolved_tokens;'))
  assert.ok(snippet.includes('const cssVariables = extractCssVariablesFromTokens(resolvedTokens, {'))
  assert.ok(snippet.includes('applyCssVariables(document.documentElement, cssVariables);'))
})

test.skip('profile adoption: command palette wrapper semantics remain compatible and non-catalog commands stay visible', () => {
  const source = readEditorSource()
  const filterStart = source.indexOf('function filterPaletteCommandEntries(entries) {')
  const filterEnd = source.indexOf('function createDormantAwarePaletteDataProvider(baseProvider) {')
  assert.ok(filterStart > -1 && filterEnd > filterStart, 'palette filter bounds must exist')
  const filterSnippet = source.slice(filterStart, filterEnd)
  assert.ok(filterSnippet.includes('if (!catalogManagedProjectCommandIds.has(entry.id)) return true;'))
  assert.ok(filterSnippet.includes('if (!(designOsDormantVisibleCommandIds instanceof Set)) return true;'))
  assert.ok(filterSnippet.includes('return designOsDormantVisibleCommandIds.has(entry.id);'))

  const wrapperStart = source.indexOf('function createDormantAwarePaletteDataProvider(baseProvider) {')
  const wrapperEnd = source.indexOf('const baseCommandPaletteDataProvider = createPaletteDataProvider(commandRegistry, { defaultSurface: \'palette\' });')
  assert.ok(wrapperStart > -1 && wrapperEnd > wrapperStart, 'palette wrapper bounds must exist')
  const wrapper = source.slice(wrapperStart, wrapperEnd)
  assert.ok(wrapper.includes('listAll() {'))
  assert.ok(wrapper.includes('listBySurface(surface) {'))
  assert.ok(wrapper.includes('listByGroup(surface) {'))
})

test.skip('profile adoption: layout commit safe reset restore and runtime bridge command surface remain unchanged', () => {
  const source = readEditorSource()

  const layoutStart = source.indexOf('function syncDesignOsDormantLayoutCommitAtResizeEnd(committedSpatialState)')
  const layoutEnd = source.indexOf('function applyMode(mode)')
  assert.ok(layoutStart > -1 && layoutEnd > layoutStart, 'layout helper bounds must exist')
  const layoutSnippet = source.slice(layoutStart, layoutEnd)
  assert.ok(layoutSnippet.includes('const layoutPatch = buildLayoutPatchFromSpatialState(committedSpatialState, {'))
  assert.ok(layoutSnippet.includes("commit_point: 'resize_end',"))

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
