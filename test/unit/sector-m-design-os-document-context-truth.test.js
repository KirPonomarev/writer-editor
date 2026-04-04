const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const ROOT = path.resolve(__dirname, '..', '..')

function readEditorSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8')
}

function extractFunctionSource(source, name) {
  const signature = `function ${name}(`
  const start = source.indexOf(signature)
  assert.ok(start > -1, `${name} must exist`)
  const braceStart = source.indexOf('{', start)
  assert.ok(braceStart > start, `${name} body must exist`)
  let depth = 0
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index]
    if (char === '{') depth += 1
    if (char === '}') depth -= 1
    if (depth === 0) {
      return source.slice(start, index + 1)
    }
  }
  throw new Error(`Unclosed function body for ${name}`)
}

function instantiateFunctions(functionNames, context = {}) {
  const source = readEditorSource()
  const script = `${functionNames.map((name) => extractFunctionSource(source, name)).join('\n\n')}\nmodule.exports = { ${functionNames.join(', ')} };`
  const sandbox = {
    module: { exports: {} },
    exports: {},
    ...context,
  }
  vm.runInNewContext(script, sandbox, { filename: 'sector-m-design-os-document-context-truth.editor-snippet.js' })
  return { exported: sandbox.module.exports, sandbox }
}

function toPlain(value) {
  return JSON.parse(JSON.stringify(value))
}

test('document context truth: non-flow truth mirrors current project and document with no hardcoded scene_1', () => {
  const { exported } = instantiateFunctions([
    'normalizeProjectId',
    'buildSingleSceneFallbackTruth',
    'buildFlowModeDormantTruth',
    'buildDesignOsDormantProductTruth',
  ], {
    currentProjectId: 'writer-project',
    currentDocumentPath: 'scenes/ch01-sc01.md',
    currentDocumentKind: 'scene',
    flowModeState: { active: false, scenes: [], dirty: false },
    getPlainText: () => 'Alpha text',
    buildFlowSavePayload: () => {
      throw new Error('flow payload must not be called for non-flow truth')
    },
  })

  const truth = exported.buildDesignOsDormantProductTruth()
  assert.deepEqual(toPlain(truth), {
    project_id: 'writer-project',
    scenes: {
      'scenes/ch01-sc01.md': 'Alpha text',
    },
    active_scene_id: 'scenes/ch01-sc01.md',
  })

  const snippet = extractFunctionSource(readEditorSource(), 'buildDesignOsDormantProductTruth')
  assert.equal(snippet.includes("'scene-1'"), false)
})

test('document context truth: flow payload builds multi-scene truth and invalid payload falls back to one local scene', () => {
  const baseFunctions = [
    'normalizeProjectId',
    'buildSingleSceneFallbackTruth',
    'buildFlowModeDormantTruth',
    'buildDesignOsDormantProductTruth',
  ]

  const valid = instantiateFunctions(baseFunctions, {
    currentProjectId: 'flow-project',
    currentDocumentPath: null,
    currentDocumentKind: null,
    flowModeState: {
      active: true,
      scenes: [
        { path: 'flow/scene-1.md', title: 'One', kind: 'scene' },
        { path: 'flow/scene-2.md', title: 'Two', kind: 'scene' },
      ],
      dirty: true,
    },
    getPlainText: () => 'unused',
    buildFlowSavePayload: () => ({
      ok: true,
      scenes: [
        { path: 'flow/scene-1.md', content: 'One body' },
        { path: 'flow/scene-2.md', content: 'Two body' },
      ],
    }),
  }).exported

  assert.deepEqual(toPlain(valid.buildDesignOsDormantProductTruth()), {
    project_id: 'flow-project',
    scenes: {
      'flow/scene-1.md': 'One body',
      'flow/scene-2.md': 'Two body',
    },
    active_scene_id: 'flow/scene-1.md',
  })

  const invalid = instantiateFunctions(baseFunctions, {
    currentProjectId: '',
    currentDocumentPath: '',
    currentDocumentKind: '',
    flowModeState: { active: true, scenes: [], dirty: false },
    getPlainText: () => 'Fallback body',
    buildFlowSavePayload: () => ({ ok: false, error: { code: 'BAD_FLOW' } }),
  }).exported

  assert.deepEqual(toPlain(invalid.buildDesignOsDormantProductTruth()), {
    project_id: 'local-project',
    scenes: {
      'scene-local': 'Fallback body',
    },
    active_scene_id: 'scene-local',
  })
})

test('document context truth: dormant context derives profile workspace shell platform and accessibility', () => {
  const { exported } = instantiateFunctions([
    'resolveDormantDesignOsProfileFromStyleValue',
    'resolveDormantDesignOsShellModeFromLayoutMode',
    'getCurrentDesignOsStyleValue',
    'buildDesignOsDormantContext',
  ], {
    styleSelect: { value: 'focus' },
    currentMode: 'review',
    spatialLayoutState: { viewportMode: 'compact' },
    mapEditorModeToWorkspace: (mode) => mode.toUpperCase(),
    deriveRuntimePlatformId: () => 'windows',
    deriveAccessibilityId: () => 'reduced_motion',
    getSpatialLayoutMode: () => 'desktop',
    document: {
      body: {
        classList: {
          contains: () => false,
        },
      },
    },
  })

  assert.deepEqual(toPlain(exported.buildDesignOsDormantContext()), {
    profile: 'FOCUS',
    workspace: 'REVIEW',
    shell_mode: 'COMPACT_DOCKED',
    platform: 'windows',
    accessibility: 'reduced_motion',
  })
})

test('document context truth: remount rebuilds runtime with explicit product truth, replays layout, and refreshes preview', () => {
  const events = []
  const runtime = { kind: 'runtime' }
  const { exported, sandbox } = instantiateFunctions([
    'resolveDormantDesignOsProfileFromStyleValue',
    'resolveDormantDesignOsShellModeFromLayoutMode',
    'getCurrentDesignOsStyleValue',
    'buildDesignOsDormantContext',
    'remountDesignOsDormantRuntimeForCurrentDocumentContext',
  ], {
    styleSelect: { value: 'default' },
    currentMode: 'write',
    spatialLayoutState: null,
    mapEditorModeToWorkspace: () => 'WRITE',
    deriveRuntimePlatformId: () => 'macos',
    deriveAccessibilityId: () => 'default',
    getSpatialLayoutMode: () => 'desktop',
    document: {
      body: {
        classList: {
          contains: () => false,
        },
      },
    },
    designOsDormantRuntimeMount: null,
    getSpatialLayoutBaselineForViewport: () => ({ source: 'baseline-layout' }),
    createRepoGroundedDesignOsBrowserRuntime: ({ productTruth }) => {
      events.push(['bootstrap', productTruth])
      return { runtime, compatibility: { phase04: true } }
    },
    createDesignOsPorts: ({ runtime: nextRuntime, defaultContext }) => {
      events.push(['ports', nextRuntime, defaultContext])
      return { previewDesign() {}, getRuntimeSnapshot() {} }
    },
    replayDesignOsDormantRuntimeLayout: (layoutState) => {
      events.push(['layout', layoutState])
    },
    refreshDesignOsDormantPreview: () => {
      events.push(['preview'])
    },
  })

  const explicitTruth = {
    project_id: 'writer-project',
    scenes: { 'scene-a': 'A' },
    active_scene_id: 'scene-a',
  }

  const mount = exported.remountDesignOsDormantRuntimeForCurrentDocumentContext(explicitTruth)
  assert.equal(mount.runtime, runtime)
  assert.deepEqual(toPlain(mount.productTruth), explicitTruth)
  assert.deepEqual(toPlain(events), [
    ['bootstrap', explicitTruth],
    ['ports', runtime, {
      profile: 'BASELINE',
      workspace: 'WRITE',
      shell_mode: 'CALM_DOCKED',
      platform: 'macos',
      accessibility: 'default',
    }],
    ['layout', { source: 'baseline-layout' }],
    ['preview'],
  ])
  assert.deepEqual(toPlain(sandbox.designOsDormantRuntimeMount.productTruth), explicitTruth)
})

test('document context truth: boundaries remount only on onEditorSetText success, flow open success, and flow save success', () => {
  const source = readEditorSource()
  const remountMatches = source.match(/remountDesignOsDormantRuntimeForCurrentDocumentContext\(/g) || []
  assert.equal(remountMatches.length, 5)

  const flowOpenSnippet = extractFunctionSource(source, 'handleFlowModeOpenUiPath')
  assert.ok(flowOpenSnippet.includes("showEditorPanelFor('Flow mode');"))
  assert.ok(flowOpenSnippet.includes('remountDesignOsDormantRuntimeForCurrentDocumentContext();'))

  const flowSaveSnippet = extractFunctionSource(source, 'handleFlowModeSaveUiPath')
  assert.ok(flowSaveSnippet.includes('const saveResult = await runFlowSaveCommand(payload.scenes);'))
  assert.ok(flowSaveSnippet.includes('remountDesignOsDormantRuntimeForCurrentDocumentContext();'))

  const setTextStart = source.indexOf('window.electronAPI.onEditorSetText((payload) => {')
  const setTextEnd = source.indexOf('updateInspectorSnapshot();', setTextStart)
  assert.ok(setTextStart > -1 && setTextEnd > setTextStart, 'onEditorSetText bounds must exist')
  const setTextSnippet = source.slice(setTextStart, setTextEnd)
  assert.ok(setTextSnippet.includes('remountDesignOsDormantRuntimeForCurrentDocumentContext();'))

  const inputListenerStart = source.indexOf("editor.addEventListener('input', () => {")
  const inputListenerEnd = source.indexOf("editor.addEventListener('paste', (event) => {", inputListenerStart)
  assert.ok(inputListenerStart > -1 && inputListenerEnd > inputListenerStart, 'input listener bounds must exist')
  const inputSnippet = source.slice(inputListenerStart, inputListenerEnd)
  assert.equal(inputSnippet.includes('remountDesignOsDormantRuntimeForCurrentDocumentContext();'), false)

  const resizeStart = source.lastIndexOf("window.addEventListener('resize', () => {", setTextStart)
  const resizeEnd = source.indexOf('if (window.electronAPI) {', resizeStart)
  assert.ok(resizeStart > -1 && resizeEnd > resizeStart, 'resize bounds must exist')
  const resizeSnippet = source.slice(resizeStart, resizeEnd)
  assert.equal(resizeSnippet.includes('remountDesignOsDormantRuntimeForCurrentDocumentContext();'), false)
})
