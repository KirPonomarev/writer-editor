const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function readEditorSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8')
}

test('restore-last-stable adoption: performRestoreLastStableShell adopts dormant restore port path', () => {
  const source = readEditorSource()

  const start = source.indexOf('function performRestoreLastStableShell()')
  const end = source.indexOf('function openSimpleModal(modal)')
  assert.ok(start > -1 && end > start, 'performRestoreLastStableShell bounds must exist')
  const snippet = source.slice(start, end)

  assert.ok(snippet.includes('let nextRestoreLayoutState = null;'))
  assert.ok(snippet.includes("typeof designOsDormantRuntimeMount.ports.restoreLastStableShell === 'function'"))
  assert.ok(snippet.includes('const layoutSnapshot = designOsDormantRuntimeMount.ports.restoreLastStableShell();'))
  assert.ok(snippet.includes('nextRestoreLayoutState = buildSpatialStateFromLayoutSnapshot(layoutSnapshot, {'))
  assert.ok(snippet.includes('viewportWidth: getSpatialLayoutViewportWidth(),'))
  assert.ok(snippet.includes('designOsDormantDegradedToBaseline = false;'))
  assert.ok(snippet.includes('if (nextRestoreLayoutState) {'))
  assert.ok(snippet.includes('applySpatialLayoutState(nextRestoreLayoutState, {'))
})

test('restore-last-stable adoption: fallback path remains when ports unavailable or throw', () => {
  const source = readEditorSource()

  const start = source.indexOf('function performRestoreLastStableShell()')
  const end = source.indexOf('function openSimpleModal(modal)')
  assert.ok(start > -1 && end > start, 'performRestoreLastStableShell bounds must exist')
  const snippet = source.slice(start, end)

  assert.ok(snippet.includes('} else {'))
  assert.ok(snippet.includes('restoreSpatialLayoutState(currentProjectId);'))
  assert.ok(snippet.includes('restoreLastStableSpatialLayoutState(currentProjectId);'))
  assert.ok(snippet.includes("return { performed: true, action: 'restore-last-stable-shell', reason: null };"))
})

test('restore-last-stable adoption: safe-reset handler and runtime command surface remain unchanged', () => {
  const source = readEditorSource()

  const safeStart = source.indexOf('function performSafeResetShell()')
  const safeEnd = source.indexOf('function performRestoreLastStableShell()')
  assert.ok(safeStart > -1 && safeEnd > safeStart, 'performSafeResetShell bounds must exist')
  const safeSnippet = source.slice(safeStart, safeEnd)
  assert.ok(safeSnippet.includes("typeof designOsDormantRuntimeMount.ports.safeResetShell === 'function'"))
  assert.ok(safeSnippet.includes('nextSafeResetLayoutState = buildSpatialStateFromLayoutSnapshot(layoutSnapshot, {'))

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
