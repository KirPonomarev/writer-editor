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
  vm.runInNewContext(script, sandbox, { filename: 'sector-m-design-os-token-css-adoption.editor-snippet.js' })
  return { exported: sandbox.module.exports, sandbox }
}

function toPlain(value) {
  return JSON.parse(JSON.stringify(value))
}

test('token css adoption: editor imports extractCssVariablesFromTokens and applyCssVariables', () => {
  const source = readEditorSource()
  assert.ok(source.includes('extractCssVariablesFromTokens,'))
  assert.ok(source.includes('applyCssVariables,'))
})

test('token css adoption: syncDesignOsDormantContext projects resolved tokens to documentElement and preserves preview state', () => {
  const source = readEditorSource()
  const snippet = extractFunctionSource(source, 'syncDesignOsDormantContext')
  assert.ok(snippet.includes('const preview = refreshDesignOsDormantPreview();'))
  assert.ok(snippet.includes('designOsDormantDegradedToBaseline = preview?.degraded_to_baseline === true;'))
  assert.ok(snippet.includes('const resolvedTokens ='))
  assert.ok(snippet.includes("const isDarkTheme = document.body.classList.contains('dark-theme');"))
  assert.ok(snippet.includes('const cssVariables = extractCssVariablesFromTokens(resolvedTokens, {'))
  assert.ok(snippet.includes('applyCssVariables(document.documentElement, cssVariables);'))

  const events = []
  const { exported, sandbox } = instantiateFunctions([
    'normalizeDormantVisibleCommandIds',
    'syncDesignOsDormantContext',
  ], {
    designOsDormantDegradedToBaseline: false,
    designOsDormantVisibleCommandIds: null,
    designOsDormantResolvedTokens: null,
    refreshDesignOsDormantPreview: () => ({
      degraded_to_baseline: false,
      visible_commands: ['cmd.project.open', ' cmd.project.save ', '', 'cmd.project.open'],
      resolved_tokens: {
        color: {
          background: { canvas: '#f7f6f3' },
        },
      },
    }),
    document: {
      body: {
        classList: {
          contains: (name) => name === 'dark-theme',
        },
      },
      documentElement: { id: 'root' },
    },
    extractCssVariablesFromTokens: (tokens, options) => {
      events.push(['extract', toPlain(tokens), toPlain(options)])
      return { '--background': '#f7f6f3' }
    },
    applyCssVariables: (root, vars) => {
      events.push(['apply', root.id, toPlain(vars)])
    },
  })

  const preview = exported.syncDesignOsDormantContext()
  assert.deepEqual(toPlain(preview), {
    degraded_to_baseline: false,
    visible_commands: ['cmd.project.open', ' cmd.project.save ', '', 'cmd.project.open'],
    resolved_tokens: {
      color: {
        background: { canvas: '#f7f6f3' },
      },
    },
  })
  assert.equal(sandbox.designOsDormantDegradedToBaseline, false)
  assert.deepEqual(toPlain(sandbox.designOsDormantVisibleCommandIds), [
    'cmd.project.open',
    'cmd.project.save',
  ])
  assert.deepEqual(toPlain(sandbox.designOsDormantResolvedTokens), {
    color: {
      background: { canvas: '#f7f6f3' },
    },
  })
  assert.deepEqual(toPlain(events), [
    ['extract', {
      color: {
        background: { canvas: '#f7f6f3' },
      },
    }, {
      isDarkTheme: true,
    }],
    ['apply', 'root', { '--background': '#f7f6f3' }],
  ])
})

test('token css adoption: syncDesignOsDormantContext fail-closes css projection and keeps preview truth', () => {
  const events = []
  const { exported, sandbox } = instantiateFunctions([
    'normalizeDormantVisibleCommandIds',
    'syncDesignOsDormantContext',
  ], {
    designOsDormantDegradedToBaseline: false,
    designOsDormantVisibleCommandIds: null,
    designOsDormantResolvedTokens: null,
    refreshDesignOsDormantPreview: () => ({
      degraded_to_baseline: true,
      visible_commands: ['cmd.project.open'],
      resolved_tokens: { semanticIntent: { brand: '#2f6fed' } },
    }),
    document: {
      body: {
        classList: {
          contains: () => false,
        },
      },
      documentElement: { id: 'root' },
    },
    extractCssVariablesFromTokens: () => {
      events.push(['extract'])
      throw new Error('boom')
    },
    applyCssVariables: () => {
      events.push(['apply'])
    },
  })

  const preview = exported.syncDesignOsDormantContext()
  assert.equal(preview.degraded_to_baseline, true)
  assert.equal(sandbox.designOsDormantDegradedToBaseline, true)
  assert.deepEqual(toPlain(sandbox.designOsDormantVisibleCommandIds), ['cmd.project.open'])
  assert.deepEqual(toPlain(sandbox.designOsDormantResolvedTokens), { semanticIntent: { brand: '#2f6fed' } })
  assert.deepEqual(toPlain(events), [['extract']])
})

test('token css adoption: layout sync safe-reset and restore handlers remain unchanged', () => {
  const source = readEditorSource()

  const layoutSnippet = extractFunctionSource(source, 'stopSpatialResize')
  assert.ok(layoutSnippet.includes('commitSpatialLayoutState(currentProjectId);'))
  assert.equal(layoutSnippet.includes('commitDesign('), false)

  const safeStart = source.indexOf('function performSafeResetShell()')
  const safeEnd = source.indexOf('function performRestoreLastStableShell()')
  assert.ok(safeStart > -1 && safeEnd > safeStart, 'performSafeResetShell bounds must exist')
  const safeSnippet = source.slice(safeStart, safeEnd)
  assert.ok(safeSnippet.includes("applyTheme(SAFE_RESET_BASELINE_THEME);"))
  assert.ok(safeSnippet.includes('applySpatialLayoutState(getSpatialLayoutBaselineForViewport(), {'))
  assert.equal(safeSnippet.includes('safeResetShell'), false)

  const restoreStart = source.indexOf('function performRestoreLastStableShell()')
  const restoreEnd = source.indexOf('function openSimpleModal(modal)')
  assert.ok(restoreStart > -1 && restoreEnd > restoreStart, 'performRestoreLastStableShell bounds must exist')
  const restoreSnippet = source.slice(restoreStart, restoreEnd)
  assert.ok(restoreSnippet.includes('restoreSpatialLayoutState(currentProjectId);'))
  assert.equal(restoreSnippet.includes('restoreLastStableShell'), false)
})

test('token css adoption: status warning perf semantics and command surface remain unchanged', () => {
  const source = readEditorSource()

  const statusStart = source.indexOf('function updateStatusText(text)')
  const statusEnd = source.indexOf('function updateSaveStateText(text)')
  assert.ok(statusStart > -1 && statusEnd > statusStart, 'updateStatusText bounds must exist')
  const statusSnippet = source.slice(statusStart, statusEnd)
  assert.ok(statusSnippet.includes('statusElement.textContent = text;'))

  const warningStart = source.indexOf('function updateWarningStateText(text)')
  const warningEnd = source.indexOf('function updatePerfHintText(text)')
  assert.ok(warningStart > -1 && warningEnd > warningStart, 'updateWarningStateText bounds must exist')
  const warningSnippet = source.slice(warningStart, warningEnd)
  assert.ok(warningSnippet.includes('warningStateElement.textContent = `Warnings: ${text}`;'))

  const perfStart = source.indexOf('function updatePerfHintText(text)')
  const perfEnd = source.indexOf('function updateInspectorSnapshot()')
  assert.ok(perfStart > -1 && perfEnd > perfStart, 'updatePerfHintText bounds must exist')
  const perfSnippet = source.slice(perfStart, perfEnd)
  assert.ok(perfSnippet.includes('perfHintElement.textContent = `Perf: ${text}`;'))

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
