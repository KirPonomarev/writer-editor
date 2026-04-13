const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function readEditorSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8')
}

test('toolbar configurator foundation: editor adopts shared toolbar catalog and profile state modules', () => {
  const source = readEditorSource()

  assert.ok(source.includes("from './toolbar/toolbarFunctionCatalog.mjs'"))
  assert.ok(source.includes("from './toolbar/toolbarProfileState.mjs'"))
  assert.ok(source.includes('getToolbarFunctionCatalogEntryById,'))
  assert.ok(source.includes('listLiveToolbarFunctionCatalogEntries,'))
  assert.ok(source.includes('resolveToolbarProfileStateForProjectSwitch,'))
  assert.ok(source.includes('writeToolbarProfileState,'))
  assert.equal(source.includes('TOOLBAR_CONFIGURATOR_CATALOG_BY_ID'), false)
  assert.equal(source.includes('TOOLBAR_CONFIGURATOR_LEGACY_LABEL_TO_ID'), false)
  assert.equal(source.includes('CONFIGURATOR_BUCKETS_STORAGE_KEY'), false)
})

test('toolbar configurator foundation: workspace clear and safe reset include project-scoped toolbar state lifecycle', () => {
  const source = readEditorSource()

  const clearStart = source.indexOf('function clearProjectWorkspaceStorage(projectId = currentProjectId) {')
  const clearEnd = source.indexOf('function performSafeResetShell()')
  assert.ok(clearStart > -1 && clearEnd > clearStart, 'clearProjectWorkspaceStorage bounds must exist')
  const clearSnippet = source.slice(clearStart, clearEnd)
  assert.ok(clearSnippet.includes('keysToRemove.add(getToolbarProfileStorageKey(normalizedProjectId));'))

  const safeStart = source.indexOf('function performSafeResetShell()')
  const safeEnd = source.indexOf('function performRestoreLastStableShell()')
  assert.ok(safeStart > -1 && safeEnd > safeStart, 'performSafeResetShell bounds must exist')
  const safeSnippet = source.slice(safeStart, safeEnd)
  assert.ok(safeSnippet.includes('clearProjectWorkspaceStorage(currentProjectId);'))
  assert.ok(safeSnippet.includes('consumeLegacyConfiguratorBuckets(localStorage);'))
  assert.ok(safeSnippet.includes('createCanonicalMinimalToolbarProfileState()'))
  assert.ok(safeSnippet.includes('createEphemeralBaselineToolbarProfileState()'))
  assert.ok(safeSnippet.includes('writeToolbarProfileState(localStorage, currentProjectId, nextToolbarProfileState);'))
  assert.equal(safeSnippet.includes('readConfiguratorBucketState('), false)
  assert.equal(safeSnippet.includes('persistConfiguratorBucketState('), false)
})

test('toolbar configurator foundation: restore-last-stable and project switch re-adopt toolbar profile state', () => {
  const source = readEditorSource()

  const restoreStart = source.indexOf('function performRestoreLastStableShell()')
  const restoreEnd = source.indexOf('function openSimpleModal(modal)')
  assert.ok(restoreStart > -1 && restoreEnd > restoreStart, 'performRestoreLastStableShell bounds must exist')
  const restoreSnippet = source.slice(restoreStart, restoreEnd)
  assert.ok(restoreSnippet.includes('restoreSpatialLayoutState(currentProjectId);'))
  assert.ok(restoreSnippet.includes('adoptToolbarConfiguratorState(currentProjectId);'))
  assert.equal(restoreSnippet.includes('readConfiguratorBucketState('), false)

  const projectSwitchStart = source.indexOf('if (hasProjectId) {')
  const projectSwitchEnd = source.indexOf('const parsed = parseDocumentContent(content);')
  assert.ok(projectSwitchStart > -1 && projectSwitchEnd > projectSwitchStart, 'project switch bounds must exist')
  const projectSwitchSnippet = source.slice(projectSwitchStart, projectSwitchEnd)
  assert.ok(projectSwitchSnippet.includes('currentProjectId = nextProjectId;'))
  assert.ok(projectSwitchSnippet.includes('restoreSpatialLayoutState(currentProjectId);'))
  assert.ok(projectSwitchSnippet.includes('adoptToolbarConfiguratorState(currentProjectId);'))
})

test('toolbar configurator foundation: master is hidden and reorder-era configurator hooks are absent', () => {
  const source = readEditorSource()

  const foundationStart = source.indexOf('function initializeToolbarConfiguratorFoundation() {')
  const foundationEnd = source.indexOf('function updateTransformingClass() {')
  assert.ok(foundationStart > -1 && foundationEnd > foundationStart, 'initializeToolbarConfiguratorFoundation bounds must exist')
  const foundationSnippet = source.slice(foundationStart, foundationEnd)
  assert.ok(foundationSnippet.includes('configuratorMasterSection.hidden = true;'))
  assert.ok(foundationSnippet.includes("sourceType: 'library-item'"))
  assert.ok(foundationSnippet.includes("event.dataTransfer.effectAllowed = 'copy';"))
  assert.equal(foundationSnippet.includes("effectAllowed = 'move'"), false)
  assert.equal(foundationSnippet.includes('bucket.dataset.bucketIndex'), false)

  assert.equal(source.includes('configuratorSlotButtons'), false)
  assert.equal(source.includes('applyConfiguratorSelection'), false)
  assert.equal(source.includes('setActiveConfiguratorBucketSelection'), false)
  assert.equal(source.includes('moveConfiguratorBucketItem'), false)
  assert.equal(source.includes('handleConfiguratorBucketPointer'), false)
  assert.ok(source.includes('item.draggable = false;'))
  assert.ok(source.includes('initializeToolbarConfiguratorFoundation();'))
})
