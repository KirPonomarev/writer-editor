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
  assert.ok(source.includes('if (!WORKSPACE_QUERY_BRIDGE_ALLOWED_QUERY_IDS.has(queryId)) {'))
  assert.ok(source.includes("return { ok: false, error: 'QUERY_ID_NOT_ALLOWED' };"))
})

test('preload workspace query bridge: editor loadTree and initializeCollabScopeLocal use query bridge only', () => {
  const source = read('src/renderer/editor.js')

  assert.ok(source.includes("const result = await invokeWorkspaceQueryBridge('query.projectTree', { tab: activeTab });"))
  assert.ok(source.includes("collabScopeLocal = (await invokeWorkspaceQueryBridge('query.collabScopeLocal')) === true;"))

  assert.equal(source.includes('window.electronAPI.getProjectTree(activeTab)'), false)
  assert.equal(source.includes('window.electronAPI.getCollabScopeLocal()'), false)
})

test('preload workspace query bridge: existing query semantics and out-of-scope paths stay compatible', () => {
  const preloadSource = read('src/preload.js')
  const mainSource = read('src/main.js')
  const editorSource = read('src/renderer/editor.js')

  assert.ok(preloadSource.includes('getProjectTree: (tab) => {'))
  assert.ok(preloadSource.includes('getCollabScopeLocal: () => {'))

  assert.ok(mainSource.includes('async function handleWorkspaceProjectTreeQuery(payload) {'))
  assert.ok(mainSource.includes('function handleWorkspaceCollabScopeLocalQuery() {'))
  assert.ok(mainSource.includes("ipcMain.handle('ui:get-project-tree', async (_, payload) => {"))
  assert.ok(mainSource.includes('return handleWorkspaceProjectTreeQuery(payload);'))
  assert.ok(mainSource.includes("ipcMain.handle('ui:get-collab-scope-local', async () => {"))
  assert.ok(mainSource.includes('return handleWorkspaceCollabScopeLocalQuery();'))

  assert.ok(preloadSource.includes('requestAutoSave: () => {'))
  assert.ok(preloadSource.includes('notifyDirtyState: (state) => {'))
  assert.ok(mainSource.includes("ipcMain.handle('ui:command-bridge', async (_, request) => {"))
  assert.ok(editorSource.includes('typeof window.electronAPI.requestAutoSave !=='))
  assert.ok(editorSource.includes('.requestAutoSave()'))
  assert.ok(editorSource.includes('window.electronAPI.notifyDirtyState(true);'))
})
