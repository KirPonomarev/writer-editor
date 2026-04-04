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
    Set,
    ...context,
  }
  vm.runInNewContext(script, sandbox, { filename: 'sector-m-design-os-profile-adoption.editor-snippet.js' })
  return { exported: sandbox.module.exports, sandbox }
}

function toPlain(value) {
  return JSON.parse(JSON.stringify(value))
}

test('profile adoption: helper maps focus to FOCUS and defaults unknown values to BASELINE', () => {
  const source = readEditorSource()
  const helperSnippet = extractFunctionSource(source, 'resolveDormantDesignOsProfileFromStyleValue')
  assert.equal(helperSnippet.includes('COMPACT'), false)
  assert.equal(helperSnippet.includes('SAFE'), false)

  const { exported } = instantiateFunctions([
    'resolveDormantDesignOsProfileFromStyleValue',
  ])

  assert.equal(exported.resolveDormantDesignOsProfileFromStyleValue('focus'), 'FOCUS')
  assert.equal(exported.resolveDormantDesignOsProfileFromStyleValue(' Focus '), 'FOCUS')
  assert.equal(exported.resolveDormantDesignOsProfileFromStyleValue('default'), 'BASELINE')
  assert.equal(exported.resolveDormantDesignOsProfileFromStyleValue('unknown'), 'BASELINE')
  assert.equal(exported.resolveDormantDesignOsProfileFromStyleValue(''), 'BASELINE')
  assert.equal(exported.resolveDormantDesignOsProfileFromStyleValue(undefined), 'BASELINE')
})

test('profile adoption: buildDesignOsDormantContext uses style selector and body fallback without hardcoded profile', () => {
  const source = readEditorSource()
  const contextSnippet = extractFunctionSource(source, 'buildDesignOsDormantContext')
  assert.ok(contextSnippet.includes('profile: resolveDormantDesignOsProfileFromStyleValue(styleValue),'))
  assert.equal(contextSnippet.includes("profile: 'BASELINE'"), false)

  const focused = instantiateFunctions([
    'resolveDormantDesignOsProfileFromStyleValue',
    'resolveDormantDesignOsShellModeFromLayoutMode',
    'getCurrentDesignOsStyleValue',
    'buildDesignOsDormantContext',
  ], {
    styleSelect: { value: 'focus' },
    currentMode: 'review',
    spatialLayoutState: { viewportMode: 'desktop' },
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
  }).exported

  assert.deepEqual(toPlain(focused.buildDesignOsDormantContext()), {
    profile: 'FOCUS',
    workspace: 'REVIEW',
    shell_mode: 'CALM_DOCKED',
    platform: 'windows',
    accessibility: 'reduced_motion',
  })

  const bodyFallback = instantiateFunctions([
    'resolveDormantDesignOsProfileFromStyleValue',
    'getCurrentDesignOsStyleValue',
  ], {
    styleSelect: { value: '' },
    document: {
      body: {
        classList: {
          contains: (className) => className === 'focus-mode',
        },
      },
    },
  }).exported

  assert.equal(bodyFallback.getCurrentDesignOsStyleValue(), 'focus')
})

test('profile adoption: applyViewMode resyncs dormant context after local focus and persistence updates', () => {
  const source = readEditorSource()
  const snippet = extractFunctionSource(source, 'applyViewMode')
  const toggleIdx = snippet.indexOf("document.body.classList.toggle('focus-mode', isFocus);")
  const styleIdx = snippet.indexOf('styleSelect.value = mode;')
  const persistIdx = snippet.indexOf("localStorage.setItem('editorViewMode', mode);")
  const syncIdx = snippet.indexOf('syncDesignOsDormantContext();')
  assert.ok(toggleIdx > -1 && styleIdx > -1 && persistIdx > -1 && syncIdx > -1)
  assert.ok(syncIdx > persistIdx, 'sync must run after persistence update')

  const events = []
  const styleState = { value: 'default' }
  const styleSelect = {}
  Object.defineProperty(styleSelect, 'value', {
    get() {
      return styleState.value
    },
    set(nextValue) {
      styleState.value = nextValue
      events.push(['style', nextValue])
    },
  })

  const { exported } = instantiateFunctions([
    'applyViewMode',
  ], {
    document: {
      body: {
        classList: {
          toggle: (className, enabled) => {
            events.push(['toggle', className, enabled])
          },
        },
      },
    },
    styleSelect,
    localStorage: {
      setItem: (key, value) => {
        events.push(['persist', key, value])
      },
    },
    syncDesignOsDormantContext: () => {
      events.push(['sync'])
    },
  })

  exported.applyViewMode('focus')
  assert.deepEqual(toPlain(events), [
    ['toggle', 'focus-mode', true],
    ['style', 'focus'],
    ['persist', 'editorViewMode', 'focus'],
    ['sync'],
  ])

  events.length = 0
  exported.applyViewMode('default', false)
  assert.deepEqual(toPlain(events), [
    ['toggle', 'focus-mode', false],
    ['style', 'default'],
    ['sync'],
  ])
})

test('profile adoption: syncDesignOsDormantContext remains single preview path while token css projection is delegated', () => {
  const source = readEditorSource()
  const snippet = extractFunctionSource(source, 'syncDesignOsDormantContext')
  assert.ok(snippet.includes('const preview = refreshDesignOsDormantPreview();'))
  assert.ok(snippet.includes('designOsDormantVisibleCommandIds = normalizeDormantVisibleCommandIds(preview?.visible_commands);'))
  assert.equal(snippet.includes('previewDesign('), false)
  assert.ok(snippet.includes('extractCssVariablesFromTokens('))
  assert.ok(snippet.includes('applyCssVariables('))

  const { exported, sandbox } = instantiateFunctions([
    'normalizeDormantVisibleCommandIds',
    'syncDesignOsDormantContext',
  ], {
    refreshCalls: 0,
    preview: {
      degraded_to_baseline: true,
      visible_commands: ['alpha', ' alpha ', '', 'beta'],
      resolved_tokens: { accent: '#fff' },
    },
    designOsDormantDegradedToBaseline: false,
    designOsDormantVisibleCommandIds: [],
    designOsDormantResolvedTokens: null,
    refreshDesignOsDormantPreview: () => {
      sandbox.refreshCalls += 1
      return sandbox.preview
    },
    document: {
      body: {
        classList: {
          contains: () => false,
        },
      },
      documentElement: { id: 'root' },
    },
    extractCssVariablesFromTokens: (tokens, options) => {
      sandbox.extractArgs = [toPlain(tokens), toPlain(options)]
      return { '--background': '#fff' }
    },
    applyCssVariables: (root, vars) => {
      sandbox.cssApplyArgs = [root.id, toPlain(vars)]
    },
  })

  assert.deepEqual(toPlain(exported.syncDesignOsDormantContext()), {
    degraded_to_baseline: true,
    visible_commands: ['alpha', ' alpha ', '', 'beta'],
    resolved_tokens: { accent: '#fff' },
  })
  assert.equal(sandbox.refreshCalls, 1)
  assert.equal(sandbox.designOsDormantDegradedToBaseline, true)
  assert.deepEqual(toPlain(sandbox.designOsDormantVisibleCommandIds), ['alpha', 'beta'])
  assert.deepEqual(toPlain(sandbox.designOsDormantResolvedTokens), { accent: '#fff' })
  assert.deepEqual(toPlain(sandbox.extractArgs), [
    { accent: '#fff' },
    { isDarkTheme: false },
  ])
  assert.deepEqual(toPlain(sandbox.cssApplyArgs), ['root', { '--background': '#fff' }])
})

test('profile adoption: command palette provider and later shell slices remain unchanged', () => {
  const source = readEditorSource()
  assert.ok(source.includes("const commandPaletteDataProvider = createPaletteDataProvider(commandRegistry, { defaultSurface: 'palette' });"))
  assert.ok(source.includes('window.__COMMAND_PALETTE_DATA_PROVIDER_V1__ = commandPaletteDataProvider;'))
  assert.equal(source.includes('createDormantAwarePaletteDataProvider('), false)
  assert.equal(source.includes('filterPaletteCommandEntries('), false)
  assert.equal(source.includes("import { listCommandCatalog } from './commands/command-catalog.v1.mjs';"), false)
  assert.ok(source.includes('function performSafeResetShell()'))
  assert.ok(source.includes('function performRestoreLastStableShell()'))
  assert.equal(source.includes('function syncDesignOsDormantLayoutCommitAtResizeEnd('), false)

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
  assert.equal(bridgeSource.includes('design-os-profile'), false)
  assert.equal(bridgeSource.includes('design-os-preview'), false)
  assert.equal(bridgeSource.includes('design-os-commit'), false)
})
