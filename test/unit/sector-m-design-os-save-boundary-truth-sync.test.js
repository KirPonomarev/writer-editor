const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function readEditorSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8')
}

test('save boundary truth sync: buildProductTruthHash import and last synced hash state exist', () => {
  const source = readEditorSource()
  assert.ok(source.includes('buildProductTruthHash,'))
  assert.ok(source.includes('let designOsDormantLastSyncedProductTruthHash = null;'))
})

test('save boundary truth sync: remount helper updates last synced hash after successful remount', () => {
  const source = readEditorSource()
  const start = source.indexOf('function remountDesignOsDormantRuntimeForCurrentDocumentContext(options = {}) {')
  const end = source.indexOf('function syncDesignOsDormantRuntimeTruthAtSaveBoundary(previousDirtyState, nextDirtyState) {')
  assert.ok(start > -1 && end > start, 'remount helper bounds must exist')
  const snippet = source.slice(start, end)

  assert.ok(snippet.includes('const productTruth = options && typeof options === \'object\' && options.productTruth'))
  assert.ok(snippet.includes(': buildDesignOsDormantProductTruth();'))
  assert.ok(snippet.includes('const productTruthHash = options && typeof options === \'object\' && typeof options.productTruthHash === \'string\' && options.productTruthHash'))
  assert.ok(snippet.includes(': buildProductTruthHash(productTruth);'))
  assert.ok(snippet.includes('productTruth,'))
  assert.ok(snippet.includes('designOsDormantLastSyncedProductTruthHash = productTruthHash;'))
})

test('save boundary truth sync: save boundary helper uses hash guard and avoids status text parsing', () => {
  const source = readEditorSource()
  const start = source.indexOf('function syncDesignOsDormantRuntimeTruthAtSaveBoundary(previousDirtyState, nextDirtyState) {')
  const end = source.indexOf('function mountDesignOsDormantRuntime() {')
  assert.ok(start > -1 && end > start, 'save-boundary helper bounds must exist')
  const snippet = source.slice(start, end)

  assert.ok(snippet.includes('if (!previousDirtyState || nextDirtyState) return;'))
  assert.ok(snippet.includes('const productTruth = buildDesignOsDormantProductTruth();'))
  assert.ok(snippet.includes('productTruthHash = buildProductTruthHash(productTruth);'))
  assert.ok(snippet.includes('if (productTruthHash === designOsDormantLastSyncedProductTruthHash) return;'))
  assert.ok(snippet.includes('remountDesignOsDormantRuntimeForCurrentDocumentContext({'))
  assert.equal(snippet.includes('status'), false, 'helper must not parse status text')
})

test('save boundary truth sync: onSetDirty true to false transition calls helper and direct remount boundaries remain', () => {
  const source = readEditorSource()
  const setDirtyStart = source.indexOf('window.electronAPI.onSetDirty((state) => {')
  const setDirtyEnd = source.indexOf('});\n}\n\nsetCurrentFontSize', setDirtyStart)
  assert.ok(setDirtyStart > -1 && setDirtyEnd > setDirtyStart, 'onSetDirty bounds must exist')
  const setDirtySnippet = source.slice(setDirtyStart, setDirtyEnd)

  assert.ok(setDirtySnippet.includes('const previousDirtyState = localDirty === true;'))
  assert.ok(setDirtySnippet.includes('const nextDirtyState = state === true;'))
  assert.ok(setDirtySnippet.includes('syncDesignOsDormantRuntimeTruthAtSaveBoundary(previousDirtyState, nextDirtyState);'))

  const flowOpenStart = source.indexOf('async function handleFlowModeOpenUiPath() {')
  const flowOpenEnd = source.indexOf('async function handleFlowModeSaveUiPath() {')
  const flowOpenSnippet = source.slice(flowOpenStart, flowOpenEnd)
  assert.ok(flowOpenSnippet.includes('remountDesignOsDormantRuntimeForCurrentDocumentContext();'))

  const flowSaveStart = source.indexOf('async function handleFlowModeSaveUiPath() {')
  const flowSaveEnd = source.indexOf('async function handleMarkdownImportUiPath() {')
  const flowSaveSnippet = source.slice(flowSaveStart, flowSaveEnd)
  assert.ok(flowSaveSnippet.includes('remountDesignOsDormantRuntimeForCurrentDocumentContext();'))

  const setTextStart = source.indexOf('window.electronAPI.onEditorSetText((payload) => {')
  const setTextEnd = source.indexOf('renderTree();', setTextStart)
  const setTextSnippet = source.slice(setTextStart, setTextEnd)
  assert.ok(setTextSnippet.includes('remountDesignOsDormantRuntimeForCurrentDocumentContext();'))
})

test('save boundary truth sync: no remount on every input or resize and compatibility surfaces stay intact', () => {
  const source = readEditorSource()

  const inputStart = source.indexOf("editor.addEventListener('input', () => {")
  const inputEnd = source.indexOf("editor.addEventListener('paste', (event) => {", inputStart)
  assert.ok(inputStart > -1 && inputEnd > inputStart, 'input listener bounds must exist')
  const inputSnippet = source.slice(inputStart, inputEnd)
  assert.equal(inputSnippet.includes('remountDesignOsDormantRuntimeForCurrentDocumentContext();'), false)

  const resizeStart = source.indexOf("window.addEventListener('resize', () => {")
  const resizeEnd = source.indexOf('});\n\nmountDesignOsDormantRuntime();', resizeStart)
  assert.ok(resizeStart > -1 && resizeEnd > resizeStart, 'resize listener bounds must exist')
  const resizeSnippet = source.slice(resizeStart, resizeEnd)
  assert.equal(resizeSnippet.includes('remountDesignOsDormantRuntimeForCurrentDocumentContext();'), false)

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
