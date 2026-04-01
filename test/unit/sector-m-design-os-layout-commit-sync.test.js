const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function readEditorSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8')
}

test('layout commit sync: runtime slice is not currently admitted in editor runtime path', () => {
  const source = readEditorSource()
  assert.equal(source.includes('buildLayoutPatchFromSpatialState'), false)
  assert.equal(source.includes('commitDesign('), false)
  assert.equal(source.includes('syncDesignOsDormantLayoutCommitAtResizeEnd('), false)
})

test('layout commit sync: current resize flow persists baseline spatial state without dormant commitDesign ports', () => {
  const source = readEditorSource()

  const stopStart = source.indexOf('function stopSpatialResize()')
  const stopEnd = source.indexOf('if (sidebar && sidebarResizer)')
  assert.ok(stopStart > -1 && stopEnd > stopStart, 'stopSpatialResize bounds must exist')
  const stopSnippet = source.slice(stopStart, stopEnd)
  assert.ok(stopSnippet.includes('commitSpatialLayoutState(currentProjectId);'))
  assert.equal(stopSnippet.includes('commitDesign('), false)
})

test('layout commit sync: safe-reset and restore handlers remain stable while layout commit slice is not admitted', () => {
  const source = readEditorSource()

  const safeStart = source.indexOf('function performSafeResetShell()')
  const safeEnd = source.indexOf('function performRestoreLastStableShell()')
  assert.ok(safeStart > -1 && safeEnd > safeStart, 'performSafeResetShell bounds must exist')
  const safeSnippet = source.slice(safeStart, safeEnd)
  assert.ok(safeSnippet.includes('applySpatialLayoutState(getSpatialLayoutBaselineForViewport(), {'))

  const restoreStart = source.indexOf('function performRestoreLastStableShell()')
  const restoreEnd = source.indexOf('function openSimpleModal(modal)')
  assert.ok(restoreStart > -1 && restoreEnd > restoreStart, 'performRestoreLastStableShell bounds must exist')
  const restoreSnippet = source.slice(restoreStart, restoreEnd)
  assert.ok(restoreSnippet.includes('restoreSpatialLayoutState(currentProjectId);'))
})

test('layout commit sync: runtime bridge command surface remains unchanged', () => {
  const source = readEditorSource()

  const statusStart = source.indexOf('function updateStatusText(text)')
  const statusEnd = source.indexOf('function updateSaveStateText(text)')
  assert.ok(statusStart > -1 && statusEnd > statusStart, 'status update bounds must exist')
  const statusSnippet = source.slice(statusStart, statusEnd)
  assert.ok(statusSnippet.includes('statusElement.textContent = text;'))

  const warningStart = source.indexOf('function updateWarningStateText(text)')
  const warningEnd = source.indexOf('function updatePerfHintText(text)')
  assert.ok(warningStart > -1 && warningEnd > warningStart, 'warning update bounds must exist')
  const warningSnippet = source.slice(warningStart, warningEnd)
  assert.ok(warningSnippet.includes('warningStateElement.textContent = `Warnings: ${text}`;'))

  const perfStart = source.indexOf('function updatePerfHintText(text)')
  const perfEnd = source.indexOf('function buildStatusLineWithDormantYdosHint(text)')
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
