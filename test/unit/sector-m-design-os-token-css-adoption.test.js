const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function readEditorSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8')
}

test.skip('token css adoption: editor imports extractCssVariablesFromTokens and applyCssVariables', () => {
  const source = readEditorSource()
  assert.ok(source.includes('extractCssVariablesFromTokens,'))
  assert.ok(source.includes('applyCssVariables,'))
})

test.skip('token css adoption: syncDesignOsDormantContext captures preview and projects resolved tokens to documentElement', () => {
  const source = readEditorSource()
  const start = source.indexOf('function syncDesignOsDormantContext()')
  const end = source.indexOf('function syncDesignOsDormantTextInput()')
  assert.ok(start > -1 && end > start, 'syncDesignOsDormantContext bounds must exist')

  const snippet = source.slice(start, end)
  assert.ok(snippet.includes('const preview = designOsDormantRuntimeMount.ports.previewDesign({'))
  assert.ok(snippet.includes('designOsDormantDegradedToBaseline = preview?.degraded_to_baseline === true;'))
  assert.ok(snippet.includes('const resolvedTokens = preview?.resolved_tokens;'))
  assert.ok(snippet.includes("const isDarkTheme = document.body.classList.contains('dark-theme');"))
  assert.ok(snippet.includes('const cssVariables = extractCssVariablesFromTokens(resolvedTokens, {'))
  assert.ok(snippet.includes('isDarkTheme,'))
  assert.ok(snippet.includes('applyCssVariables(document.documentElement, cssVariables);'))
  assert.ok(snippet.includes('} catch {}'))
})

test.skip('token css adoption: layout sync safe-reset and restore handlers remain unchanged', () => {
  const source = readEditorSource()

  const layoutStart = source.indexOf('function syncDesignOsDormantLayoutCommitAtResizeEnd(committedSpatialState)')
  const layoutEnd = source.indexOf('function applyMode(mode)')
  assert.ok(layoutStart > -1 && layoutEnd > layoutStart, 'layout commit helper bounds must exist')
  const layoutSnippet = source.slice(layoutStart, layoutEnd)
  assert.ok(layoutSnippet.includes('const layoutPatch = buildLayoutPatchFromSpatialState(committedSpatialState, {'))
  assert.ok(layoutSnippet.includes("commit_point: 'resize_end',"))

  const safeStart = source.indexOf('function performSafeResetShell()')
  const safeEnd = source.indexOf('function performRestoreLastStableShell()')
  assert.ok(safeStart > -1 && safeEnd > safeStart, 'performSafeResetShell bounds must exist')
  const safeSnippet = source.slice(safeStart, safeEnd)
  assert.ok(safeSnippet.includes("typeof designOsDormantRuntimeMount.ports.safeResetShell === 'function'"))
  assert.ok(safeSnippet.includes('nextSafeResetLayoutState = buildSpatialStateFromLayoutSnapshot(layoutSnapshot, {'))

  const restoreStart = source.indexOf('function performRestoreLastStableShell()')
  const restoreEnd = source.indexOf('function openSimpleModal(modal)')
  assert.ok(restoreStart > -1 && restoreEnd > restoreStart, 'performRestoreLastStableShell bounds must exist')
  const restoreSnippet = source.slice(restoreStart, restoreEnd)
  assert.ok(restoreSnippet.includes("typeof designOsDormantRuntimeMount.ports.restoreLastStableShell === 'function'"))
  assert.ok(restoreSnippet.includes('nextRestoreLayoutState = buildSpatialStateFromLayoutSnapshot(layoutSnapshot, {'))
})

test.skip('token css adoption: status warning perf semantics and command surface remain unchanged', () => {
  const source = readEditorSource()

  const statusStart = source.indexOf('function updateStatusText(text)')
  const statusEnd = source.indexOf('function updateSaveStateText(text)')
  assert.ok(statusStart > -1 && statusEnd > statusStart, 'updateStatusText bounds must exist')
  const statusSnippet = source.slice(statusStart, statusEnd)
  assert.ok(statusSnippet.includes('statusElement.textContent = buildStatusLineWithDormantYdosHint(text);'))

  const warningStart = source.indexOf('function updateWarningStateText(text)')
  const warningEnd = source.indexOf('function updatePerfHintText(text)')
  assert.ok(warningStart > -1 && warningEnd > warningStart, 'updateWarningStateText bounds must exist')
  const warningSnippet = source.slice(warningStart, warningEnd)
  assert.ok(warningSnippet.includes('warningStateElement.textContent = `Warnings: ${text}`;'))

  const perfStart = source.indexOf('function updatePerfHintText(text)')
  const perfEnd = source.indexOf('function buildStatusLineWithDormantYdosHint(text)')
  assert.ok(perfStart > -1 && perfEnd > perfStart, 'updatePerfHintText bounds must exist')
  const perfSnippet = source.slice(perfStart, perfEnd)
  assert.ok(perfSnippet.includes('perfHintElement.textContent = `Perf: ${text}`;'))

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
