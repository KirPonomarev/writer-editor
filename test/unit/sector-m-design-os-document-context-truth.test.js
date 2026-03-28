const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function readEditorSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8')
}

test('document context truth: product truth builder no longer hardcodes scene_1 and uses real non-flow context with fallback', () => {
  const source = readEditorSource()
  const start = source.indexOf('function buildDesignOsDormantProductTruth() {')
  const end = source.indexOf('function remountDesignOsDormantRuntimeForCurrentDocumentContext() {')
  assert.ok(start > -1 && end > start, 'buildDesignOsDormantProductTruth bounds must exist')
  const snippet = source.slice(start, end)

  assert.equal(snippet.includes("'scene-1'"), false)
  assert.ok(snippet.includes("const projectId = normalizeProjectId(currentProjectId) || 'local-project';"))
  assert.ok(snippet.includes("const fallbackSceneId = 'scene-local';"))
  assert.ok(snippet.includes('const hasPath = typeof currentDocumentPath === \'string\' && currentDocumentPath.trim().length > 0;'))
  assert.ok(snippet.includes('const hasKind = typeof currentDocumentKind === \'string\' && currentDocumentKind.trim().length > 0;'))
  assert.ok(snippet.includes('const sceneId = currentDocumentPath.trim();'))
})

test('document context truth: flow mode uses buildFlowSavePayload and invalid flow payload falls back to single-scene truth', () => {
  const source = readEditorSource()
  const start = source.indexOf('function buildDesignOsDormantProductTruth() {')
  const end = source.indexOf('function remountDesignOsDormantRuntimeForCurrentDocumentContext() {')
  const snippet = source.slice(start, end)

  assert.ok(snippet.includes('const payload = buildFlowSavePayload(getPlainText(), flowModeState.scenes);'))
  assert.ok(snippet.includes('if (!payload.ok || !Array.isArray(payload.scenes) || payload.scenes.length === 0) return null;'))
  assert.ok(snippet.includes('const activeSceneId = payload.scenes.find((scene) => scene && typeof scene.path === \'string\' && scene.path.trim())'))
  assert.ok(snippet.includes('if (!activeSceneId || Object.keys(scenes).length === 0) return null;'))
  assert.ok(snippet.includes('if (flowModeState.active) {'))
  assert.ok(snippet.includes('return buildSingleSceneFallbackTruth();'))
})

test('document context truth: remount helper recreates runtime and ports then replays layout and preview sync', () => {
  const source = readEditorSource()
  const start = source.indexOf('function remountDesignOsDormantRuntimeForCurrentDocumentContext() {')
  const end = source.indexOf('function mountDesignOsDormantRuntime() {')
  assert.ok(start > -1 && end > start, 'remount helper bounds must exist')
  const snippet = source.slice(start, end)

  assert.ok(snippet.includes('createRepoGroundedDesignOsBrowserRuntime({'))
  assert.ok(snippet.includes('productTruth: buildDesignOsDormantProductTruth(),'))
  assert.ok(snippet.includes('const ports = createDesignOsPorts({'))
  assert.ok(snippet.includes('defaultContext: buildDesignOsDormantContext(),'))
  assert.ok(snippet.includes('const layoutStateForReplay = spatialLayoutState || getSpatialLayoutBaselineForViewport();'))
  assert.ok(snippet.includes('syncDesignOsDormantLayoutCommitAtResizeEnd(layoutStateForReplay);'))
  assert.ok(snippet.includes('syncDesignOsDormantContext();'))
})

test('document context truth: remount runs only on existing document context boundaries', () => {
  const source = readEditorSource()
  const remountMatches = source.match(/remountDesignOsDormantRuntimeForCurrentDocumentContext\(/g) || []
  assert.equal(remountMatches.length, 5, 'expected definition plus mount and 3 boundary calls')

  const flowOpenStart = source.indexOf('async function handleFlowModeOpenUiPath() {')
  const flowOpenEnd = source.indexOf('async function handleFlowModeSaveUiPath() {')
  const flowOpenSnippet = source.slice(flowOpenStart, flowOpenEnd)
  assert.ok(flowOpenSnippet.includes("showEditorPanelFor('Flow mode');"))
  assert.ok(flowOpenSnippet.includes('remountDesignOsDormantRuntimeForCurrentDocumentContext();'))

  const flowSaveStart = source.indexOf('async function handleFlowModeSaveUiPath() {')
  const flowSaveEnd = source.indexOf('async function handleMarkdownImportUiPath() {')
  const flowSaveSnippet = source.slice(flowSaveStart, flowSaveEnd)
  assert.ok(flowSaveSnippet.includes('const saveResult = await runFlowSaveCommand(payload.scenes);'))
  assert.ok(flowSaveSnippet.includes('remountDesignOsDormantRuntimeForCurrentDocumentContext();'))

  const setTextStart = source.indexOf('window.electronAPI.onEditorSetText((payload) => {')
  const setTextEnd = source.indexOf('renderTree();', setTextStart)
  assert.ok(setTextStart > -1 && setTextEnd > setTextStart, 'onEditorSetText bounds must exist')
  const setTextSnippet = source.slice(setTextStart, setTextEnd)
  assert.ok(setTextSnippet.includes('remountDesignOsDormantRuntimeForCurrentDocumentContext();'))

  const inputListenerStart = source.indexOf("editor.addEventListener('input', () => {")
  const inputListenerEnd = source.indexOf("editor.addEventListener('paste', (event) => {", inputListenerStart)
  assert.ok(inputListenerStart > -1 && inputListenerEnd > inputListenerStart, 'input listener bounds must exist')
  const inputSnippet = source.slice(inputListenerStart, inputListenerEnd)
  assert.equal(inputSnippet.includes('remountDesignOsDormantRuntimeForCurrentDocumentContext();'), false)
})

test('document context truth: profile workspace shell mappings and key compatibility surfaces remain unchanged', () => {
  const source = readEditorSource()

  assert.ok(source.includes('profile: resolveDormantDesignOsProfileFromStyleValue(styleValue),'))
  assert.ok(source.includes('workspace: mapEditorModeToWorkspace(currentMode),'))
  assert.ok(source.includes('shell_mode: resolveDormantDesignOsShellModeFromLayoutMode(layoutMode),'))

  const layoutStart = source.indexOf('function syncDesignOsDormantLayoutCommitAtResizeEnd(committedSpatialState)')
  const layoutEnd = source.indexOf('function applyMode(mode)')
  const layoutSnippet = source.slice(layoutStart, layoutEnd)
  assert.ok(layoutSnippet.includes('const context = buildDesignOsDormantContext();'))
  assert.ok(layoutSnippet.includes("shellMode: context.shell_mode || 'CALM_DOCKED',"))

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
