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
  assert.ok(source.includes('isImplicitExpandedToolbarProfileState,'))
  assert.ok(source.includes('resolveToolbarProfileStateForProjectSwitch,'))
  assert.ok(source.includes('writeToolbarProfileState,'))
  assert.equal(source.includes('TOOLBAR_CONFIGURATOR_CATALOG_BY_ID'), false)
  assert.equal(source.includes('TOOLBAR_CONFIGURATOR_LEGACY_LABEL_TO_ID'), false)
  assert.equal(source.includes('CONFIGURATOR_BUCKETS_STORAGE_KEY'), false)
})

test('toolbar configurator foundation: persisted exact old expanded seed is normalized through the shared matcher', () => {
  const source = readEditorSource()

  const resolveStart = source.indexOf('function resolveToolbarConfiguratorState(projectId = currentProjectId) {')
  const resolveEnd = source.indexOf('let configuratorBucketState = createToolbarConfiguratorSeedState();')
  assert.ok(resolveStart > -1 && resolveEnd > resolveStart, 'resolveToolbarConfiguratorState bounds must exist')
  const resolveSnippet = source.slice(resolveStart, resolveEnd)
  assert.ok(resolveSnippet.includes('const effectiveState = isImplicitExpandedToolbarProfileState(normalizedState)'))
  assert.ok(resolveSnippet.includes('createToolbarConfiguratorSeedState()'))
  assert.ok(resolveSnippet.includes('state: effectiveState,'))
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
  assert.ok(safeSnippet.includes('createToolbarConfiguratorSeedState()'))
  assert.ok(safeSnippet.includes('writeToolbarConfiguratorStoredState(currentProjectId, nextToolbarProfileState);'))
  assert.ok(safeSnippet.includes('renderToolbarConfiguratorProfileSwitch();'))
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

test('toolbar configurator foundation: profile switch and reorder-aware wiring are present', () => {
  const source = readEditorSource()

  const foundationStart = source.indexOf('function initializeToolbarConfiguratorFoundation() {')
  const foundationEnd = source.indexOf('function updateTransformingClass() {')
  assert.ok(foundationStart > -1 && foundationEnd > foundationStart, 'initializeToolbarConfiguratorFoundation bounds must exist')
  const foundationSnippet = source.slice(foundationStart, foundationEnd)
  assert.ok(foundationSnippet.includes('setToolbarConfiguratorActiveProfile(profileSwitchButton.dataset.toolbarProfileSwitch || \'\');'))
  assert.ok(foundationSnippet.includes("addToolbarConfiguratorItem(libraryButton.dataset.itemId || '', getToolbarConfiguratorActiveProfile());"))
  assert.ok(foundationSnippet.includes("removeToolbarConfiguratorItem(removeButton.dataset.itemId || '', bucketKey);"))
  assert.equal(source.includes('configuratorSlotButtons'), false)
  assert.equal(source.includes('applyConfiguratorSelection'), false)
  assert.equal(source.includes('setActiveConfiguratorBucketSelection'), false)
  assert.equal(source.includes('moveConfiguratorBucketItem'), false)
  assert.equal(source.includes('handleConfiguratorBucketPointer'), false)
  assert.ok(source.includes('item.draggable = true;'))
  assert.ok(source.includes("sourceType: isBucketItem ? 'bucket-item' : 'library-item'"))
  assert.ok(source.includes("bucketKey: isBucketItem"))
  assert.ok(source.includes("sourceIndex: isBucketItem ? sourceElement.dataset.bucketIndex || '' : undefined"))
  assert.ok(source.includes("event.dataTransfer.effectAllowed = isBucketItem ? 'move' : 'copy';"))
  assert.ok(source.includes("setToolbarConfiguratorDropTarget(bucket, marker, hoveredItem instanceof HTMLElement && bucket.contains(hoveredItem) ? hoveredItem : null);"))
  assert.ok(source.includes("commitToolbarConfiguratorBucketDrop(payload, bucketKey, insertionIndex, hoveredItem instanceof HTMLElement ? hoveredItem : null);"))
  assert.ok(source.includes("bucket.classList.remove('is-drop-target', 'is-drop-target-inside');"))
  assert.ok(source.includes('is-drop-target-before'))
  assert.ok(source.includes('is-drop-target-after'))
  assert.ok(source.includes('is-drop-target-inside'))
  assert.ok(source.includes('initializeToolbarConfiguratorFoundation();'))
})
