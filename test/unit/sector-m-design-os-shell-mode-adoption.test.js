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
  vm.runInNewContext(script, sandbox, { filename: 'sector-m-design-os-shell-mode-adoption.editor-snippet.js' })
  return { exported: sandbox.module.exports, sandbox }
}

function extractResizeListenerSnippet(source) {
  const start = source.lastIndexOf("window.addEventListener('resize', () => {")
  const end = source.indexOf('if (window.electronAPI) {', start)
  assert.ok(start > -1 && end > start, 'runtime resize listener bounds must exist')
  return source.slice(start, end)
}

function toPlain(value) {
  return JSON.parse(JSON.stringify(value))
}

test('shell mode adoption: helper maps compact and mobile to COMPACT_DOCKED and defaults to CALM_DOCKED', () => {
  const { exported } = instantiateFunctions([
    'resolveDormantDesignOsShellModeFromLayoutMode',
  ])

  assert.equal(exported.resolveDormantDesignOsShellModeFromLayoutMode('compact'), 'COMPACT_DOCKED')
  assert.equal(exported.resolveDormantDesignOsShellModeFromLayoutMode('mobile'), 'COMPACT_DOCKED')
  assert.equal(exported.resolveDormantDesignOsShellModeFromLayoutMode('desktop'), 'CALM_DOCKED')
  assert.equal(exported.resolveDormantDesignOsShellModeFromLayoutMode(''), 'CALM_DOCKED')
  assert.equal(exported.resolveDormantDesignOsShellModeFromLayoutMode('unknown'), 'CALM_DOCKED')
})

test('shell mode adoption: buildDesignOsDormantContext uses spatial layout facts without hardcoded shell mode', () => {
  const { exported } = instantiateFunctions([
    'resolveDormantDesignOsProfileFromStyleValue',
    'resolveDormantDesignOsShellModeFromLayoutMode',
    'getCurrentDesignOsStyleValue',
    'buildDesignOsDormantContext',
  ], {
    styleSelect: { value: 'focus' },
    currentMode: 'review',
    spatialLayoutState: { viewportMode: 'mobile' },
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

  const source = readEditorSource()
  const contextSnippet = extractFunctionSource(source, 'buildDesignOsDormantContext')
  assert.equal(contextSnippet.includes("shell_mode: 'CALM_DOCKED'"), false)
  assert.ok(contextSnippet.includes('shell_mode: resolveDormantDesignOsShellModeFromLayoutMode(layoutMode),'))
})

test('shell mode adoption: syncDesignOsDormantContext stays a single preview-sync path', () => {
  const { exported, sandbox } = instantiateFunctions([
    'normalizeDormantVisibleCommandIds',
    'syncDesignOsDormantContext',
  ], {
    calls: 0,
    preview: {
      shell_mode: 'COMPACT_DOCKED',
      degraded_to_baseline: true,
      visible_commands: ['alpha', 'alpha', 'beta'],
      resolved_tokens: { shell: { density: 'compact' } },
    },
    designOsDormantDegradedToBaseline: false,
    designOsDormantVisibleCommandIds: [],
    designOsDormantResolvedTokens: null,
    refreshDesignOsDormantPreview: () => {
      sandbox.calls += 1
      return sandbox.preview
    },
  })

  assert.deepEqual(toPlain(exported.syncDesignOsDormantContext()), {
    shell_mode: 'COMPACT_DOCKED',
    degraded_to_baseline: true,
    visible_commands: ['alpha', 'alpha', 'beta'],
    resolved_tokens: { shell: { density: 'compact' } },
  })
  assert.equal(sandbox.calls, 1)
  assert.equal(sandbox.designOsDormantDegradedToBaseline, true)
  assert.deepEqual(toPlain(sandbox.designOsDormantVisibleCommandIds), ['alpha', 'beta'])
  assert.deepEqual(toPlain(sandbox.designOsDormantResolvedTokens), { shell: { density: 'compact' } })

  const snippet = extractFunctionSource(readEditorSource(), 'syncDesignOsDormantContext')
  assert.ok(snippet.includes('const preview = refreshDesignOsDormantPreview();'))
  assert.ok(snippet.includes('designOsDormantVisibleCommandIds = normalizeDormantVisibleCommandIds(preview?.visible_commands);'))
  assert.equal(snippet.includes('previewDesign('), false)
})

test('shell mode adoption: resize path updates spatial layout then syncs dormant context before layout refresh', () => {
  const source = readEditorSource()
  const snippet = extractResizeListenerSnippet(source)
  const updateIdx = snippet.indexOf('updateSpatialLayoutForViewportChange();')
  const syncIdx = snippet.indexOf('syncDesignOsDormantContext();')
  const scheduleIdx = snippet.indexOf('scheduleLayoutRefresh();')

  assert.ok(updateIdx > -1, 'resize path must update spatial layout state')
  assert.ok(syncIdx > -1, 'resize path must sync dormant context')
  assert.ok(scheduleIdx > -1, 'resize path must keep layout refresh scheduling')
  assert.ok(syncIdx > updateIdx, 'dormant context sync must run after spatial layout update')
  assert.ok(scheduleIdx > syncIdx, 'layout refresh must remain after dormant context sync')
})

test('shell mode adoption: layout commit restore and bridge slices remain compatible', () => {
  const editorSource = readEditorSource()

  assert.equal(editorSource.includes('syncDesignOsDormantLayoutCommitAtResizeEnd('), false)
  assert.ok(editorSource.includes('function performSafeResetShell()'))
  assert.ok(editorSource.includes('function performRestoreLastStableShell()'))

  const bridgeSource = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'tiptap', 'runtimeBridge.js'), 'utf8')
  assert.ok(bridgeSource.includes("command === 'safe-reset-shell'"))
  assert.ok(bridgeSource.includes("command === 'restore-last-stable-shell'"))
  assert.equal(bridgeSource.includes('design-os-shell-mode'), false)
})
