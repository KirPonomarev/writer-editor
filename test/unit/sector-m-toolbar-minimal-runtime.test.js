const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function readEditorSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8')
}

test('sector-m toolbar minimal runtime: editor wires the shared registry projection for the main floating toolbar only', () => {
  const source = readEditorSource()

  assert.ok(source.includes("from './toolbar/toolbarRuntimeProjection.mjs'"), 'shared toolbar runtime module import must exist')
  assert.ok(source.includes('createToolbarRuntimeRegistry('), 'shared runtime registry must be created')
  assert.ok(source.includes('applyToolbarProfileMinimal('), 'minimal profile projection must be applied')
  assert.ok(source.includes('function projectMainFloatingToolbarRuntime('), 'main toolbar projection helper must exist')

  const cleanupStart = source.indexOf('function closeOrphanedMainToolbarOverlays(')
  const helperStart = source.indexOf('function projectMainFloatingToolbarRuntime(')
  assert.ok(cleanupStart > -1 && helperStart > cleanupStart, 'cleanup helper bounds must exist')
  const helperEnd = source.indexOf('function getSnappedFloatingToolbarPosition(', helperStart)
  assert.ok(helperEnd > helperStart, 'projection helper bounds must exist')
  const cleanupSnippet = source.slice(cleanupStart, helperStart)
  const helperSnippet = source.slice(helperStart, helperEnd)

  assert.ok(cleanupSnippet.includes('hasVisibleItems'), 'cleanup helper must respect the projection snapshot visibility flag')
  assert.ok(cleanupSnippet.includes('visibleBindKeys'), 'cleanup helper must inspect visible bind keys from the projection snapshot')
  assert.ok(cleanupSnippet.includes('setParagraphMenuOpen(false);'), 'cleanup helper must close orphaned paragraph overlay')
  assert.ok(cleanupSnippet.includes('setToolbarSpacingMenuOpen(false);'), 'cleanup helper must close orphaned spacing overlay')
  assert.ok(helperSnippet.includes('restoreFocusFromHiddenMainToolbarItem();'), 'helper must restore focus away from hidden toolbar controls')
  assert.ok(helperSnippet.includes('scheduleToolbarAnchorUpdate();'), 'helper must resync toolbar anchors after projection')
  assert.equal(helperSnippet.includes('leftToolbar'), false, 'projection helper must stay on the main floating toolbar path')

  const commitStart = source.indexOf('function commitToolbarConfiguratorState(minimalIds) {')
  const adoptStart = source.indexOf('function adoptToolbarConfiguratorState(projectId = currentProjectId) {')
  const initStart = source.indexOf('function initializeToolbarConfiguratorFoundation() {')
  const safeResetStart = source.indexOf('function performSafeResetShell() {')
  const restoreStart = source.indexOf('function performRestoreLastStableShell() {')
  const projectSwitchStart = source.indexOf('window.electronAPI.onEditorSetText((payload) => {')
  assert.ok(commitStart > -1 && adoptStart > commitStart && initStart > adoptStart && safeResetStart > initStart && restoreStart > safeResetStart && projectSwitchStart > restoreStart)

  const commitSnippet = source.slice(commitStart, adoptStart)
  const adoptSnippet = source.slice(adoptStart, safeResetStart)
  const initSnippet = source.slice(initStart, safeResetStart)
  const safeResetSnippet = source.slice(safeResetStart, restoreStart)
  const projectSwitchSnippet = source.slice(projectSwitchStart, source.indexOf('window.electronAPI.onEditorTextRequest', projectSwitchStart))

  assert.ok(commitSnippet.includes('renderToolbarConfiguratorBuckets();'))
  assert.ok(commitSnippet.includes("projectMainFloatingToolbarRuntime('configurator-commit');"))
  assert.ok(adoptSnippet.includes('renderToolbarConfiguratorLibrary();'))
  assert.ok(adoptSnippet.includes('renderToolbarConfiguratorBuckets();'))
  assert.ok(adoptSnippet.includes("projectMainFloatingToolbarRuntime('configurator-adopt');"))
  assert.ok(initSnippet.includes('adoptToolbarConfiguratorState(currentProjectId);'))
  assert.ok(safeResetSnippet.includes('renderToolbarConfiguratorBuckets();'))
  assert.ok(safeResetSnippet.includes("projectMainFloatingToolbarRuntime('safe-reset-shell');"))
  assert.ok(source.slice(restoreStart, projectSwitchStart).includes('adoptToolbarConfiguratorState(currentProjectId);'))
  assert.ok(projectSwitchSnippet.includes('restoreSpatialLayoutState(currentProjectId);'))
  assert.ok(projectSwitchSnippet.includes('adoptToolbarConfiguratorState(currentProjectId);'))
})
