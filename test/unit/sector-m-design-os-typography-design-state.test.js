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
  vm.runInNewContext(script, sandbox, { filename: 'sector-m-design-os-typography-design-state.editor-snippet.js' })
  return { exported: sandbox.module.exports, sandbox }
}

function toPlain(value) {
  return JSON.parse(JSON.stringify(value))
}

test('typography design state: narrow typography patch helper returns only required fields', () => {
  const source = readEditorSource()
  const snippet = extractFunctionSource(source, 'buildDesignOsDormantTypographyDesignPatch')
  assert.ok(snippet.includes('typography: {'))
  assert.ok(snippet.includes('font: {'))
  assert.ok(snippet.includes('body: {'))
  assert.ok(snippet.includes('family: fontFamily,'))
  assert.ok(snippet.includes('sizePx: Number(sizePx.toFixed(2)),'))
  assert.ok(snippet.includes('lineHeight: Number(lineHeightValue.toFixed(3)),'))
  assert.equal(snippet.includes('layout_patch'), false)
  assert.equal(snippet.includes('productTruth'), false)
  assert.equal(snippet.includes('visible_commands'), false)

  const { exported } = instantiateFunctions([
    'buildDesignOsDormantTypographyDesignPatch',
  ], {
    editor: {
      style: {
        fontFamily: '"Literata", serif',
        lineHeight: '1.625',
      },
    },
    currentFontSizePx: 13.5,
    window: {
      getComputedStyle: () => ({
        fontFamily: '"Literata", serif',
        fontSize: '13.5px',
        lineHeight: '1.625',
      }),
    },
  })

  assert.deepEqual(toPlain(exported.buildDesignOsDormantTypographyDesignPatch()), {
    typography: {
      font: {
        body: {
          family: '"Literata", serif',
          sizePx: 13.5,
          lineHeight: 1.625,
        },
      },
    },
  })
})

test('typography design state: commit helper uses design_patch only with apply commit point and preview sync', () => {
  const source = readEditorSource()
  const snippet = extractFunctionSource(source, 'commitDesignOsDormantTypographyDesignPatch')
  assert.ok(snippet.includes('design_patch: designPatch,'))
  assert.ok(snippet.includes("commit_point: 'apply',"))
  assert.equal(snippet.includes('layout_patch'), false)

  const events = []
  const { exported } = instantiateFunctions([
    'buildDesignOsDormantTypographyDesignPatch',
    'commitDesignOsDormantTypographyDesignPatch',
  ], {
    editor: {
      style: {
        fontFamily: '"Literata", serif',
        lineHeight: '1.625',
      },
    },
    currentFontSizePx: 13.5,
    window: {
      getComputedStyle: () => ({
        fontFamily: '"Literata", serif',
        fontSize: '13.5px',
        lineHeight: '1.625',
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

  assert.deepEqual(toPlain(exported.commitDesignOsDormantTypographyDesignPatch()), { committed: true })
  assert.deepEqual(toPlain(events), [
    ['commit', {
      context: { profile: 'BASELINE', workspace: 'WRITE' },
      design_patch: {
        typography: {
          font: {
            body: {
              family: '"Literata", serif',
              sizePx: 13.5,
              lineHeight: 1.625,
            },
          },
        },
      },
      commit_point: 'apply',
    }],
    ['sync'],
  ])

  events.length = 0
  exported.commitDesignOsDormantTypographyDesignPatch({ syncPreview: false })
  assert.deepEqual(toPlain(events), [
    ['commit', {
      context: { profile: 'BASELINE', workspace: 'WRITE' },
      design_patch: {
        typography: {
          font: {
            body: {
              family: '"Literata", serif',
              sizePx: 13.5,
              lineHeight: 1.625,
            },
          },
        },
      },
      commit_point: 'apply',
    }],
  ])
})

test('typography design state: apply boundaries commit typography patch and saved paths still reuse apply helpers', () => {
  const source = readEditorSource()

  const applyFontSnippet = extractFunctionSource(source, 'applyFont')
  assert.ok(applyFontSnippet.includes('commitDesignOsDormantTypographyDesignPatch();'))

  const loadSavedFontSnippet = extractFunctionSource(source, 'loadSavedFont')
  assert.ok(loadSavedFontSnippet.includes('applyFont(savedFont);'))

  const onFontChangedStart = source.indexOf('window.electronAPI.onFontChanged((fontFamily) => {')
  const onFontChangedEnd = source.indexOf('});\n}\n\nloadSavedFont();', onFontChangedStart)
  assert.ok(onFontChangedStart > -1 && onFontChangedEnd > onFontChangedStart, 'onFontChanged bounds must exist')
  const onFontChangedSnippet = source.slice(onFontChangedStart, onFontChangedEnd)
  assert.ok(onFontChangedSnippet.includes('applyFont(fontFamily);'))

  const applyLineHeightSnippet = extractFunctionSource(source, 'applyLineHeight')
  assert.ok(applyLineHeightSnippet.includes('commitDesignOsDormantTypographyDesignPatch();'))

  const loadSavedLineHeightSnippet = extractFunctionSource(source, 'loadSavedLineHeight')
  assert.ok(loadSavedLineHeightSnippet.includes('applyLineHeight(saved, false);'))
  assert.ok(loadSavedLineHeightSnippet.includes("applyLineHeight('1.625', false);"))

  const setFontSizeStart = source.indexOf('window.electronAPI.onEditorSetFontSize(({ px }) => {')
  const setFontSizeEnd = source.indexOf('  if (typeof window.electronAPI.onRecoveryRestored === \'function\') {', setFontSizeStart)
  assert.ok(setFontSizeStart > -1 && setFontSizeEnd > setFontSizeStart, 'onEditorSetFontSize bounds must exist')
  const setFontSizeSnippet = source.slice(setFontSizeStart, setFontSizeEnd)
  assert.ok(setFontSizeSnippet.includes('setCurrentFontSize(px);'))
  assert.ok(setFontSizeSnippet.includes('renderStyledView(getPlainText());'))
  assert.ok(setFontSizeSnippet.includes('commitDesignOsDormantTypographyDesignPatch();'))

  const fontEvents = []
  const { exported: fontExported } = instantiateFunctions([
    'applyFont',
  ], {
    editor: { style: {} },
    localStorage: {
      setItem: (key, value) => fontEvents.push(['persist', key, value]),
    },
    syncLiteralToolbarDisplays: () => fontEvents.push(['toolbar']),
    commitDesignOsDormantTypographyDesignPatch: () => fontEvents.push(['commit']),
  })

  fontExported.applyFont('"IBM Plex Sans", sans-serif')
  assert.deepEqual(toPlain(fontEvents), [
    ['persist', 'editorFont', '"IBM Plex Sans", sans-serif'],
    ['toolbar'],
    ['commit'],
  ])

  const lineHeightEvents = []
  const { exported: lineHeightExported } = instantiateFunctions([
    'applyLineHeight',
  ], {
    editor: { style: {} },
    lineHeightSelect: null,
    ensureSelectHasOption: () => lineHeightEvents.push(['ensure-option']),
    localStorage: {
      setItem: (key, value) => lineHeightEvents.push(['persist', key, value]),
    },
    syncLiteralToolbarDisplays: () => lineHeightEvents.push(['toolbar']),
    renderStyledView: (value) => lineHeightEvents.push(['render', value]),
    getPlainText: () => 'body',
    commitDesignOsDormantTypographyDesignPatch: () => lineHeightEvents.push(['commit']),
  })

  lineHeightExported.applyLineHeight('1.4')
  assert.deepEqual(toPlain(lineHeightEvents), [
    ['persist', 'editorLineHeight', '1.4'],
    ['toolbar'],
    ['render', 'body'],
    ['commit'],
  ])
})

test('typography design state: remount replays typography before theme and keeps single final sync', () => {
  const source = readEditorSource()
  const remountSnippet = extractFunctionSource(source, 'remountDesignOsDormantRuntimeForCurrentDocumentContext')
  assert.ok(remountSnippet.includes("commitDesignOsDormantTypographyDesignPatch({ syncPreview: false })"))
  assert.ok(remountSnippet.includes("commitDesignOsDormantThemeDesignPatch({ syncPreview: false })"))
  assert.ok(remountSnippet.includes('syncDesignOsDormantContext();'))
  assert.ok(remountSnippet.includes('refreshDesignOsDormantPreview();'))

  const events = []
  const { exported } = instantiateFunctions([
    'buildDesignOsDormantTypographyDesignPatch',
    'commitDesignOsDormantTypographyDesignPatch',
    'buildDesignOsDormantThemeDesignPatch',
    'commitDesignOsDormantThemeDesignPatch',
    'remountDesignOsDormantRuntimeForCurrentDocumentContext',
  ], {
    editor: {
      style: {
        fontFamily: '"Literata", serif',
        lineHeight: '1.625',
      },
    },
    currentFontSizePx: 13.5,
    document: {
      body: {
        classList: {
          contains: () => false,
        },
      },
    },
    window: {
      getComputedStyle: (node) => node && node.style
        ? {
            fontFamily: '"Literata", serif',
            fontSize: '13.5px',
            lineHeight: '1.625',
          }
        : {
            getPropertyValue: (propertyName) => ({
              '--background': '#e7e0d5',
              '--foreground': '#171317',
              '--card': '#fffdf8',
              '--sidebar': '#e0d7c8',
              '--canvas-bg': '#d8cfc1',
            }[propertyName] || ''),
          },
    },
    buildDesignOsDormantProductTruth: () => ({ project_id: 'writer', scenes: {}, active_scene_id: 'scene-a' }),
    createRepoGroundedDesignOsBrowserRuntime: ({ productTruth }) => {
      events.push(['bootstrap', toPlain(productTruth)])
      return { runtime: { id: 'runtime' }, compatibility: { ok: true } }
    },
    createDesignOsPorts: ({ runtime, defaultContext }) => {
      events.push(['ports', runtime.id, toPlain(defaultContext)])
      return {
        commitDesign: (payload) => {
          events.push(['commit', toPlain(payload)])
          return { committed: true }
        },
        previewDesign: () => {
          events.push(['preview'])
          return { previewed: true }
        },
      }
    },
    buildDesignOsDormantContext: () => ({ profile: 'BASELINE', workspace: 'WRITE' }),
    rememberDesignOsDormantLayoutState: (layoutState) => events.push(['layout-memory', toPlain(layoutState)]),
    getSpatialLayoutBaselineForViewport: () => ({ source: 'baseline-layout' }),
    spatialLayoutState: null,
    syncDesignOsDormantContext: () => events.push(['sync']),
    buildProductTruthHash: () => 'hash-1',
    designOsDormantRuntimeMount: null,
  })

  exported.remountDesignOsDormantRuntimeForCurrentDocumentContext()
  assert.deepEqual(toPlain(events), [
    ['bootstrap', { project_id: 'writer', scenes: {}, active_scene_id: 'scene-a' }],
    ['ports', 'runtime', { profile: 'BASELINE', workspace: 'WRITE' }],
    ['layout-memory', { source: 'baseline-layout' }],
    ['commit', {
      context: { profile: 'BASELINE', workspace: 'WRITE' },
      design_patch: {
        typography: {
          font: {
            body: {
              family: '"Literata", serif',
              sizePx: 13.5,
              lineHeight: 1.625,
            },
          },
        },
      },
      commit_point: 'apply',
    }],
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
})

test('typography design state: save-boundary and later slices remain unchanged', () => {
  const source = readEditorSource()

  const saveBoundarySnippet = extractFunctionSource(source, 'syncDesignOsDormantProductTruthAtSaveBoundary')
  assert.ok(saveBoundarySnippet.includes('if (nextTruthHash === lastSyncedDormantProductTruthHash) {'))
  assert.ok(saveBoundarySnippet.includes('mountDesignOsDormantRuntime({ productTruth: nextProductTruth });'))
  assert.equal(saveBoundarySnippet.includes('commitDesignOsDormantTypographyDesignPatch'), false)

  const applyFontWeightSnippet = extractFunctionSource(source, 'applyFontWeight')
  assert.equal(applyFontWeightSnippet.includes('commitDesignOsDormantTypographyDesignPatch'), false)

  const applyWordWrapSnippet = extractFunctionSource(source, 'applyWordWrap')
  assert.equal(applyWordWrapSnippet.includes('commitDesignOsDormantTypographyDesignPatch'), false)

  const applyThemeSnippet = extractFunctionSource(source, 'applyTheme')
  assert.equal(applyThemeSnippet.includes('commitDesignOsDormantTypographyDesignPatch'), false)

  const safeResetSnippet = extractFunctionSource(source, 'performSafeResetShell')
  assert.equal(safeResetSnippet.includes('commitDesignOsDormantTypographyDesignPatch'), false)

  const restoreSnippet = extractFunctionSource(source, 'performRestoreLastStableShell')
  assert.equal(restoreSnippet.includes('commitDesignOsDormantTypographyDesignPatch'), false)

  assert.ok(source.includes('profile: resolveDormantDesignOsProfileFromStyleValue(styleValue),'))
  assert.ok(source.includes('workspace: mapEditorModeToWorkspace(currentMode),'))
  assert.ok(source.includes('shell_mode: resolveDormantDesignOsShellModeFromLayoutMode(layoutMode),'))
  assert.ok(source.includes('const nextVisibleCommandIds = normalizeDormantVisibleCommandIds(preview?.visible_commands);'))
  assert.ok(source.includes('designOsDormantResolvedTokens ='))
})
