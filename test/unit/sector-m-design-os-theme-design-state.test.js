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
  const paramsStart = source.indexOf('(', start)
  assert.ok(paramsStart > start, `${name} params must exist`)
  let paramsDepth = 0
  let paramsEnd = -1
  for (let index = paramsStart; index < source.length; index += 1) {
    const char = source[index]
    if (char === '(') paramsDepth += 1
    if (char === ')') paramsDepth -= 1
    if (paramsDepth === 0) {
      paramsEnd = index
      break
    }
  }
  assert.ok(paramsEnd > paramsStart, `${name} params must close`)
  const braceStart = source.indexOf('{', paramsEnd)
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
  vm.runInNewContext(script, sandbox, { filename: 'sector-m-design-os-theme-design-state.editor-snippet.js' })
  return { exported: sandbox.module.exports, sandbox }
}

function toPlain(value) {
  return JSON.parse(JSON.stringify(value))
}

test('theme design state: current theme design patch helper returns color and surface fields only', () => {
  const source = readEditorSource()
  const snippet = extractFunctionSource(source, 'buildDesignOsDormantThemeDesignPatch')
  assert.ok(snippet.includes('color: {'))
  assert.ok(snippet.includes('background: { canvas: backgroundCanvas }'))
  assert.ok(snippet.includes('surface: {'))
  assert.ok(snippet.includes('panel: surfacePanel,'))
  assert.ok(snippet.includes('elevated: surfaceElevated,'))
  assert.ok(snippet.includes('text: { primary: foregroundPrimary }'))
  assert.ok(snippet.includes('shell: { background: shellBackground }'))
  assert.ok(snippet.includes('editor: { background: editorBackground }'))
  assert.equal(snippet.includes('layout_patch'), false)
  assert.equal(snippet.includes('productTruth'), false)
  assert.equal(snippet.includes('typography:'), false)

  const styleValues = new Map([
    ['--background', '#101119'],
    ['--foreground', '#fdfdfd'],
    ['--card', '#181a24'],
    ['--sidebar', '#171925'],
    ['--canvas-bg', '#11131d'],
  ])

  const { exported } = instantiateFunctions([
    'buildDesignOsDormantThemeDesignPatch',
  ], {
    document: {
      body: {
        classList: {
          contains: (name) => name === 'dark-theme',
        },
      },
    },
    window: {
      getComputedStyle: () => ({
        getPropertyValue: (propertyName) => styleValues.get(propertyName) || '',
      }),
    },
  })

  assert.deepEqual(toPlain(exported.buildDesignOsDormantThemeDesignPatch()), {
    color: {
      background: { canvas: '#101119' },
      surface: {
        panel: '#181a24',
        elevated: '#171925',
      },
      text: { primary: '#fdfdfd' },
    },
    surface: {
      shell: { background: '#11131d' },
      editor: { background: '#181a24' },
    },
  })
})

test('theme design state: commit helper uses design_patch only with mode_switch and preview sync', () => {
  const source = readEditorSource()
  const snippet = extractFunctionSource(source, 'commitDesignOsDormantThemeDesignPatch')
  assert.ok(snippet.includes('design_patch: designPatch,'))
  assert.ok(snippet.includes("commit_point: 'mode_switch',"))
  assert.equal(snippet.includes('layout_patch'), false)

  const events = []
  const { exported } = instantiateFunctions([
    'buildDesignOsDormantThemeDesignPatch',
    'commitDesignOsDormantThemeDesignPatch',
  ], {
    document: {
      body: {
        classList: {
          contains: () => false,
        },
      },
    },
    window: {
      getComputedStyle: () => ({
        getPropertyValue: (propertyName) => ({
          '--background': '#e7e0d5',
          '--foreground': '#171317',
          '--card': '#fffdf8',
          '--sidebar': '#e0d7c8',
          '--canvas-bg': '#d8cfc1',
        }[propertyName] || ''),
      }),
    },
    buildDesignOsDormantContext: () => ({ profile: 'BASELINE', workspace: 'WRITE' }),
    designOsDormantRuntimeMount: {
      ports: {
        commitDesign: (payload) => {
          events.push(['commit', toPlain(payload)])
          return { committed: true }
        },
      },
      lastContext: null,
      lastPreview: null,
    },
    syncDesignOsDormantContext: () => {
      events.push(['sync'])
      return { previewed: true }
    },
    refreshDesignOsDormantPreview: () => {
      events.push(['preview'])
      return { previewed: true }
    },
  })

  assert.deepEqual(toPlain(exported.commitDesignOsDormantThemeDesignPatch()), { committed: true })
  assert.deepEqual(toPlain(events), [
    ['commit', {
      context: { profile: 'BASELINE', workspace: 'WRITE' },
      design_patch: {
        color: {
          background: { canvas: '#e7e0d5' },
          surface: {
            panel: '#fffdf8',
            elevated: '#e0d7c8',
          },
          text: { primary: '#171317' },
        },
        surface: {
          shell: { background: '#d8cfc1' },
          editor: { background: '#fffdf8' },
        },
      },
      commit_point: 'mode_switch',
    }],
    ['sync'],
  ])

  events.length = 0
  exported.commitDesignOsDormantThemeDesignPatch({ syncPreview: false })
  assert.deepEqual(toPlain(events), [
    ['commit', {
      context: { profile: 'BASELINE', workspace: 'WRITE' },
      design_patch: {
        color: {
          background: { canvas: '#e7e0d5' },
          surface: {
            panel: '#fffdf8',
            elevated: '#e0d7c8',
          },
          text: { primary: '#171317' },
        },
        surface: {
          shell: { background: '#d8cfc1' },
          editor: { background: '#fffdf8' },
        },
      },
      commit_point: 'mode_switch',
    }],
  ])
})

test('theme design state: applyTheme commits theme patch and saved theme paths still reuse applyTheme', () => {
  const source = readEditorSource()
  const applyThemeSnippet = extractFunctionSource(source, 'applyTheme')
  assert.ok(applyThemeSnippet.includes("document.body.classList.add('dark-theme');"))
  assert.ok(applyThemeSnippet.includes("document.body.classList.remove('dark-theme');"))
  assert.ok(applyThemeSnippet.includes('commitDesignOsDormantThemeDesignPatch();'))

  const loadSavedThemeSnippet = extractFunctionSource(source, 'loadSavedTheme')
  assert.ok(loadSavedThemeSnippet.includes('applyTheme(savedTheme);'))

  const onThemeChangedStart = source.indexOf('window.electronAPI.onThemeChanged((theme) => {')
  const onThemeChangedEnd = source.indexOf('});\n}\n\nloadSavedTheme();', onThemeChangedStart)
  assert.ok(onThemeChangedStart > -1 && onThemeChangedEnd > onThemeChangedStart, 'onThemeChanged bounds must exist')
  const onThemeChangedSnippet = source.slice(onThemeChangedStart, onThemeChangedEnd)
  assert.ok(onThemeChangedSnippet.includes('applyTheme(theme);'))

  const events = []
  const { exported } = instantiateFunctions([
    'applyTheme',
  ], {
    document: {
      body: {
        classList: {
          add: (name) => events.push(['add', name]),
          remove: (name) => events.push(['remove', name]),
        },
      },
    },
    localStorage: {
      setItem: (key, value) => events.push(['persist', key, value]),
    },
    updateThemeSwatches: (theme) => events.push(['swatches', theme]),
    updateInspectorSnapshot: () => events.push(['snapshot']),
    commitDesignOsDormantThemeDesignPatch: () => events.push(['commit']),
  })

  exported.applyTheme('dark')
  assert.deepEqual(toPlain(events), [
    ['add', 'dark-theme'],
    ['persist', 'editorTheme', 'dark'],
    ['swatches', 'dark'],
    ['snapshot'],
    ['commit'],
  ])
})

test('theme design state: remount keeps theme replay compatible and falls back to preview refresh when commit path is unavailable', () => {
  const source = readEditorSource()
  const remountSnippet = extractFunctionSource(source, 'remountDesignOsDormantRuntimeForCurrentDocumentContext')
  assert.ok(remountSnippet.includes("commitDesignOsDormantThemeDesignPatch({ syncPreview: false })"))
  assert.ok(remountSnippet.includes('syncDesignOsDormantContext();'))
  assert.ok(remountSnippet.includes('refreshDesignOsDormantPreview();'))

  const withCommitEvents = []
  const withCommit = instantiateFunctions([
    'buildDesignOsDormantThemeDesignPatch',
    'commitDesignOsDormantThemeDesignPatch',
    'remountDesignOsDormantRuntimeForCurrentDocumentContext',
  ], {
    document: {
      body: {
        classList: {
          contains: () => false,
        },
      },
    },
    window: {
      getComputedStyle: () => ({
        getPropertyValue: (propertyName) => ({
          '--background': '#e7e0d5',
          '--foreground': '#171317',
          '--card': '#fffdf8',
          '--sidebar': '#e0d7c8',
          '--canvas-bg': '#d8cfc1',
        }[propertyName] || ''),
      }),
    },
    buildDesignOsDormantProductTruth: () => ({ project_id: 'writer', scenes: {}, active_scene_id: 'scene-a' }),
    createRepoGroundedDesignOsBrowserRuntime: ({ productTruth }) => {
      withCommitEvents.push(['bootstrap', toPlain(productTruth)])
      return { runtime: { id: 'runtime' }, compatibility: { ok: true } }
    },
    createDesignOsPorts: ({ runtime, defaultContext }) => {
      withCommitEvents.push(['ports', runtime.id, toPlain(defaultContext)])
      return {
        commitDesign: (payload) => {
          withCommitEvents.push(['commit', toPlain(payload)])
          return { committed: true }
        },
        previewDesign: () => {
          withCommitEvents.push(['preview'])
          return { previewed: true }
        },
      }
    },
    buildDesignOsDormantContext: () => ({ profile: 'BASELINE', workspace: 'WRITE' }),
    rememberDesignOsDormantLayoutState: (layoutState) => withCommitEvents.push(['layout-memory', toPlain(layoutState)]),
    getSpatialLayoutBaselineForViewport: () => ({ source: 'baseline-layout' }),
    spatialLayoutState: null,
    syncDesignOsDormantContext: () => withCommitEvents.push(['sync']),
    buildProductTruthHash: () => 'hash-1',
    designOsDormantRuntimeMount: null,
  })

  withCommit.exported.remountDesignOsDormantRuntimeForCurrentDocumentContext()
  assert.deepEqual(toPlain(withCommitEvents), [
    ['bootstrap', { project_id: 'writer', scenes: {}, active_scene_id: 'scene-a' }],
    ['ports', 'runtime', { profile: 'BASELINE', workspace: 'WRITE' }],
    ['layout-memory', { source: 'baseline-layout' }],
    ['commit', {
      context: { profile: 'BASELINE', workspace: 'WRITE' },
      design_patch: {
        color: {
          background: { canvas: '#e7e0d5' },
          surface: {
            panel: '#fffdf8',
            elevated: '#e0d7c8',
          },
          text: { primary: '#171317' },
        },
        surface: {
          shell: { background: '#d8cfc1' },
          editor: { background: '#fffdf8' },
        },
      },
      commit_point: 'mode_switch',
    }],
    ['sync'],
  ])

  const fallbackEvents = []
  const fallback = instantiateFunctions([
    'buildDesignOsDormantThemeDesignPatch',
    'commitDesignOsDormantThemeDesignPatch',
    'remountDesignOsDormantRuntimeForCurrentDocumentContext',
  ], {
    document: {
      body: {
        classList: {
          contains: () => false,
        },
      },
    },
    window: {
      getComputedStyle: () => ({
        getPropertyValue: () => '',
      }),
    },
    buildDesignOsDormantProductTruth: () => ({ project_id: 'writer', scenes: {}, active_scene_id: 'scene-a' }),
    createRepoGroundedDesignOsBrowserRuntime: () => ({ runtime: { id: 'runtime' }, compatibility: { ok: true } }),
    createDesignOsPorts: () => ({
      previewDesign: () => {
        fallbackEvents.push(['preview'])
        return { previewed: true }
      },
    }),
    buildDesignOsDormantContext: () => ({ profile: 'BASELINE', workspace: 'WRITE' }),
    rememberDesignOsDormantLayoutState: (layoutState) => fallbackEvents.push(['layout-memory', toPlain(layoutState)]),
    getSpatialLayoutBaselineForViewport: () => ({ source: 'baseline-layout' }),
    spatialLayoutState: null,
    buildProductTruthHash: () => 'hash-1',
    designOsDormantRuntimeMount: null,
    refreshDesignOsDormantPreview: () => {
      fallbackEvents.push(['preview'])
      return { previewed: true }
    },
  })

  fallback.exported.remountDesignOsDormantRuntimeForCurrentDocumentContext()
  assert.deepEqual(toPlain(fallbackEvents), [
    ['layout-memory', { source: 'baseline-layout' }],
    ['preview'],
  ])
})

test('theme design state: non-theme compatibility surfaces remain unchanged after typography slice lands', () => {
  const source = readEditorSource()

  const stopSpatialResizeSnippet = extractFunctionSource(source, 'stopSpatialResize')
  assert.ok(stopSpatialResizeSnippet.includes('commitSpatialLayoutState(currentProjectId);'))
  assert.equal(stopSpatialResizeSnippet.includes('commitDesign('), false)

  const applyFontSnippet = extractFunctionSource(source, 'applyFont')
  assert.equal(applyFontSnippet.includes('commitDesignOsDormantThemeDesignPatch'), false)

  const applyLineHeightSnippet = extractFunctionSource(source, 'applyLineHeight')
  assert.equal(applyLineHeightSnippet.includes('commitDesignOsDormantThemeDesignPatch'), false)

  const applyFontWeightSnippet = extractFunctionSource(source, 'applyFontWeight')
  assert.equal(applyFontWeightSnippet.includes('commitDesignOsDormantThemeDesignPatch'), false)

  const applyWordWrapSnippet = extractFunctionSource(source, 'applyWordWrap')
  assert.equal(applyWordWrapSnippet.includes('commitDesignOsDormantThemeDesignPatch'), false)

  const safeResetSnippet = extractFunctionSource(source, 'performSafeResetShell')
  assert.ok(safeResetSnippet.includes('applyTheme(SAFE_RESET_BASELINE_THEME);'))
  assert.equal(safeResetSnippet.includes('commitDesignOsDormantThemeDesignPatch'), false)

  const restoreSnippet = extractFunctionSource(source, 'performRestoreLastStableShell')
  assert.ok(restoreSnippet.includes('loadSavedTheme();'))
  assert.equal(restoreSnippet.includes('commitDesignOsDormantThemeDesignPatch'), false)

  const saveBoundarySnippet = extractFunctionSource(source, 'syncDesignOsDormantProductTruthAtSaveBoundary')
  assert.ok(saveBoundarySnippet.includes('if (nextTruthHash === lastSyncedDormantProductTruthHash) {'))
  assert.ok(saveBoundarySnippet.includes('mountDesignOsDormantRuntime({ productTruth: nextProductTruth });'))
  assert.equal(saveBoundarySnippet.includes('commitDesignOsDormantThemeDesignPatch'), false)

  assert.ok(source.includes('profile: resolveDormantDesignOsProfileFromStyleValue(styleValue),'))
  assert.ok(source.includes('workspace: mapEditorModeToWorkspace(currentMode),'))
  assert.ok(source.includes('shell_mode: resolveDormantDesignOsShellModeFromLayoutMode(layoutMode),'))
  assert.ok(source.includes('const nextVisibleCommandIds = normalizeDormantVisibleCommandIds(preview?.visible_commands);'))

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
