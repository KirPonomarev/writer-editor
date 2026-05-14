const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function read(filePath) {
  return fs.readFileSync(path.join(ROOT, filePath), 'utf8')
}

test('preload workspace query bridge: preload exposes one typed query bridge api', () => {
  const source = read('src/preload.js')

  assert.equal((source.match(/invokeWorkspaceQueryBridge:\s*\(request\)\s*=>\s*\{/g) || []).length, 1)
  assert.ok(source.includes("const WORKSPACE_QUERY_BRIDGE_CHANNEL = 'ui:workspace-query-bridge';"))
  assert.ok(source.includes("return ipcRenderer.invoke(WORKSPACE_QUERY_BRIDGE_CHANNEL, { queryId, payload });"))
})

test('preload workspace query bridge: main has one query bridge handler with strict allowlist', () => {
  const source = read('src/main.js')

  assert.equal((source.match(/ipcMain\.handle\('ui:workspace-query-bridge'/g) || []).length, 1)
  assert.ok(source.includes('const WORKSPACE_QUERY_BRIDGE_ALLOWED_QUERY_IDS = new Set(['))
  assert.ok(source.includes("'query.projectTree'"))
  assert.ok(source.includes("'query.collabScopeLocal'"))
  assert.ok(source.includes("'query.reviewSurface'"))
  assert.ok(source.includes('if (!WORKSPACE_QUERY_BRIDGE_ALLOWED_QUERY_IDS.has(queryId)) {'))
  assert.ok(source.includes("return { ok: false, error: 'QUERY_ID_NOT_ALLOWED' };"))
  assert.ok(source.includes("if (queryId === 'query.reviewSurface') {"))
  assert.ok(source.includes('return handleWorkspaceReviewSurfaceQuery();'))
  assert.ok(source.includes('function handleWorkspaceReviewSurfaceQuery() {'))
  assert.ok(source.includes('reviewSurface: isPlainObjectValue(currentReviewSurfacePayload)'))
})

test('preload workspace query bridge: editor tree collab and review surface reads use query bridge only', () => {
  const source = read('src/renderer/editor.js')

  assert.ok(source.includes("const result = await invokeWorkspaceQueryBridge('query.projectTree', { tab: activeTab });"))
  assert.ok(source.includes("collabScopeLocal = (await invokeWorkspaceQueryBridge('query.collabScopeLocal')) === true;"))
  assert.ok(source.includes("const REVIEW_SURFACE_QUERY_ID = 'query.reviewSurface';"))
  assert.ok(source.includes('const result = await invokeWorkspaceQueryBridge(REVIEW_SURFACE_QUERY_ID);'))
  assert.ok(source.includes('return setReviewSurfaceState(result.reviewSurface);'))

  assert.equal(source.includes('window.electronAPI.getProjectTree(activeTab)'), false)
  assert.equal(source.includes('window.electronAPI.getCollabScopeLocal()'), false)
  assert.equal(source.includes('window.electronAPI.getReviewSurface('), false)
  assert.equal(source.includes('__getYalkenReviewSurfaceState'), false)
})

test('preload workspace query bridge: existing query semantics and out-of-scope paths stay compatible', () => {
  const preloadSource = read('src/preload.js')
  const mainSource = read('src/main.js')
  const editorSource = read('src/renderer/editor.js')

  assert.ok(preloadSource.includes('getProjectTree: (tab) => {'))
  assert.ok(preloadSource.includes('getCollabScopeLocal: () => {'))
  assert.equal(preloadSource.includes('getReviewSurface:'), false)

  assert.ok(mainSource.includes('async function handleWorkspaceProjectTreeQuery(payload) {'))
  assert.ok(mainSource.includes('function handleWorkspaceCollabScopeLocalQuery() {'))
  assert.ok(mainSource.includes('function handleWorkspaceReviewSurfaceQuery() {'))
  assert.ok(mainSource.includes("ipcMain.handle('ui:get-project-tree', async (_, payload) => {"))
  assert.ok(mainSource.includes('return handleWorkspaceProjectTreeQuery(payload);'))
  assert.ok(mainSource.includes("ipcMain.handle('ui:get-collab-scope-local', async () => {"))
  assert.ok(mainSource.includes('return handleWorkspaceCollabScopeLocalQuery();'))

  assert.ok(preloadSource.includes('requestAutoSave: () => {'))
  assert.ok(preloadSource.includes('notifyDirtyState: (state) => {'))
  assert.ok(mainSource.includes("ipcMain.handle('ui:command-bridge', async (_, request) => {"))
  assert.ok(preloadSource.includes('invokeSaveLifecycleSignalBridge: (request) => {'))
  assert.ok(mainSource.includes("ipcMain.handle('ui:save-lifecycle-signal-bridge', async (_, request) => {"))
  assert.ok(editorSource.includes('typeof window.electronAPI.invokeSaveLifecycleSignalBridge !=='))
  assert.ok(editorSource.includes("invokeSaveLifecycleSignalBridge('signal.autoSave.request')"))
  assert.ok(editorSource.includes("void invokeSaveLifecycleSignalBridge('signal.localDirty.set', { state: true });"))
})

test('preload workspace query bridge: review surface query has a live producer path and canonical artifact fallback', () => {
  const source = read('src/main.js')

  assert.ok(source.includes('async function buildDerivedReviewSurfacePayload() {'))
  assert.ok(source.includes('const snapshot = await requestEditorSnapshot(1200);'))
  assert.ok(source.includes("const parsed = JSON.parse(text);"))
  assert.ok(source.includes("parsed.type === 'revisionBridge.stage01FixedCorePreview'"))
  assert.ok(source.includes("parsed.type === 'revisionBridge.parsedReviewSurfaceAdapter'"))
  assert.ok(source.includes('const revisionBridge = await loadRevisionBridgeModule();'))
  assert.ok(source.includes('adaptParsedReviewSurfaceToReviewPacketPreviewInput({'))
  assert.ok(source.includes('buildRevisionPacketPreview({'))
  assert.ok(source.includes("let currentReviewSurfacePayloadSource = 'none';"))
  assert.ok(source.includes("let currentReviewSurfacePayloadContentHash = '';"))
  assert.ok(source.includes("currentReviewSurfacePayloadSource = 'direct';"))
  assert.ok(source.includes('currentReviewSurfacePayloadContentHash = computeHash(safePayload.content);'))
  assert.ok(source.includes("currentReviewSurfacePayloadSource = 'derived';"))
  assert.ok(source.includes('const derivedPayload = await buildDerivedReviewSurfacePayload();'))
  assert.ok(source.includes('if (hasReviewSurfacePayload(derivedPayload)) {'))
  assert.ok(source.includes("} else if (currentReviewSurfacePayloadSource === 'derived') {"))
  assert.ok(source.includes("} else if (currentReviewSurfacePayloadSource === 'direct') {"))
  assert.ok(source.includes('const directPayloadMatches = await directReviewSurfacePayloadStillMatchesCurrentText();'))
  assert.ok(source.includes('return computeHash(sourceText) === currentReviewSurfacePayloadContentHash;'))
  assert.ok(source.includes('} else if (!hasReviewSurfacePayload(currentReviewSurfacePayload)) {'))
})
