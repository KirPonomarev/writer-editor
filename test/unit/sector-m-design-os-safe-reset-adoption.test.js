const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function readEditorSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8')
}

test.skip('safe reset adoption: editor imports buildSpatialStateFromLayoutSnapshot and uses safeResetShell port path', () => {
  const source = readEditorSource()
  assert.ok(source.includes('buildSpatialStateFromLayoutSnapshot,'), 'import for layout translator must exist')

  const start = source.indexOf('function performSafeResetShell()')
  const end = source.indexOf('function performRestoreLastStableShell()')
  assert.ok(start > -1 && end > start, 'performSafeResetShell bounds must exist')
  const snippet = source.slice(start, end)

  assert.ok(snippet.includes('let nextSafeResetLayoutState = null;'))
  assert.ok(snippet.includes("typeof designOsDormantRuntimeMount.ports.safeResetShell === 'function'"))
  assert.ok(snippet.includes('const layoutSnapshot = designOsDormantRuntimeMount.ports.safeResetShell();'))
  assert.ok(snippet.includes('nextSafeResetLayoutState = buildSpatialStateFromLayoutSnapshot(layoutSnapshot, {'))
  assert.ok(snippet.includes('viewportWidth: getSpatialLayoutViewportWidth(),'))
  assert.ok(snippet.includes('designOsDormantDegradedToBaseline = false;'))
  assert.ok(snippet.includes('applySpatialLayoutState(nextSafeResetLayoutState || getSpatialLayoutBaselineForViewport(), {'))
})

test.skip('safe reset adoption: baseline fallback remains and restore-last-stable flow is unchanged', () => {
  const source = readEditorSource()

  const safeResetStart = source.indexOf('function performSafeResetShell()')
  const safeResetEnd = source.indexOf('function performRestoreLastStableShell()')
  assert.ok(safeResetStart > -1 && safeResetEnd > safeResetStart, 'safe reset bounds must exist')
  const safeResetSnippet = source.slice(safeResetStart, safeResetEnd)
  assert.ok(safeResetSnippet.includes('nextSafeResetLayoutState || getSpatialLayoutBaselineForViewport()'))

  const restoreStart = source.indexOf('function performRestoreLastStableShell()')
  const restoreEnd = source.indexOf('function openSimpleModal(modal)')
  assert.ok(restoreStart > -1 && restoreEnd > restoreStart, 'restore-last-stable bounds must exist')
  const restoreSnippet = source.slice(restoreStart, restoreEnd)
  assert.equal(restoreSnippet.includes('safeResetShell('), false)
  assert.equal(restoreSnippet.includes('buildSpatialStateFromLayoutSnapshot('), false)
  assert.ok(restoreSnippet.includes("return { performed: true, action: 'restore-last-stable-shell', reason: null };"))
})

test.skip('safe reset adoption: safe-reset command id and runtime bridge command surface stay unchanged', () => {
  const source = readEditorSource()
  assert.ok(source.includes("if (command === 'safe-reset-shell')"))

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
