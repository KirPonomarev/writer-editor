const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function readEditorSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8')
}

test.skip('layout commit sync: editor imports buildLayoutPatchFromSpatialState and uses commitDesign at resize_end boundary only', () => {
  const source = readEditorSource()
  assert.ok(source.includes('buildLayoutPatchFromSpatialState,'))

  const stopStart = source.indexOf('function stopSpatialResize()')
  const stopEnd = source.indexOf('if (sidebar && sidebarResizer)')
  assert.ok(stopStart > -1 && stopEnd > stopStart, 'stopSpatialResize bounds must exist')
  const stopSnippet = source.slice(stopStart, stopEnd)
  assert.ok(stopSnippet.includes('const committedLayoutState = commitSpatialLayoutState(currentProjectId);'))
  assert.ok(stopSnippet.includes('syncDesignOsDormantLayoutCommitAtResizeEnd(committedLayoutState);'))

  const helperStart = source.indexOf('function syncDesignOsDormantLayoutCommitAtResizeEnd(committedSpatialState)')
  const helperEnd = source.indexOf('function applyMode(mode)')
  assert.ok(helperStart > -1 && helperEnd > helperStart, 'layout commit helper bounds must exist')
  const helperSnippet = source.slice(helperStart, helperEnd)
  assert.ok(helperSnippet.includes("typeof designOsDormantRuntimeMount.ports.commitDesign !== 'function'"))
  assert.ok(helperSnippet.includes('const layoutPatch = buildLayoutPatchFromSpatialState(committedSpatialState, {'))
  assert.ok(helperSnippet.includes('designOsDormantRuntimeMount.ports.commitDesign({'))
  assert.ok(helperSnippet.includes('context,'))
  assert.ok(helperSnippet.includes('layout_patch: layoutPatch,'))
  assert.ok(helperSnippet.includes("commit_point: 'resize_end',"))
  assert.equal(helperSnippet.includes('design_patch'), false, 'design_patch must not be sent')
})

test.skip('layout commit sync: fallback remains when commitDesign ports are unavailable or throw', () => {
  const source = readEditorSource()

  const helperStart = source.indexOf('function syncDesignOsDormantLayoutCommitAtResizeEnd(committedSpatialState)')
  const helperEnd = source.indexOf('function applyMode(mode)')
  assert.ok(helperStart > -1 && helperEnd > helperStart, 'layout commit helper bounds must exist')
  const helperSnippet = source.slice(helperStart, helperEnd)
  assert.ok(helperSnippet.includes('if (!designOsDormantRuntimeMount.ports || typeof designOsDormantRuntimeMount.ports.commitDesign !== \'function\') return;'))
  assert.ok(helperSnippet.includes('try {'))
  assert.ok(helperSnippet.includes('} catch {}'))

  const stopStart = source.indexOf('function stopSpatialResize()')
  const stopEnd = source.indexOf('if (sidebar && sidebarResizer)')
  const stopSnippet = source.slice(stopStart, stopEnd)
  assert.ok(stopSnippet.includes('commitSpatialLayoutState(currentProjectId);'))
})

test.skip('layout commit sync: safe-reset and restore handlers remain unchanged in this slice', () => {
  const source = readEditorSource()

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

test.skip('layout commit sync: status warning perf semantics and runtime bridge command surface remain unchanged', () => {
  const source = readEditorSource()

  const statusStart = source.indexOf('function updateStatusText(text)')
  const statusEnd = source.indexOf('function updateSaveStateText(text)')
  const statusSnippet = source.slice(statusStart, statusEnd)
  assert.ok(statusSnippet.includes('statusElement.textContent = buildStatusLineWithDormantYdosHint(text);'))

  const warningStart = source.indexOf('function updateWarningStateText(text)')
  const warningEnd = source.indexOf('function updatePerfHintText(text)')
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
