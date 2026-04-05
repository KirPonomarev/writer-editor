const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const ROOT = path.resolve(__dirname, '..', '..')

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
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
  const source = readFile('src/renderer/editor.js')
  const script = `${functionNames.map((name) => extractFunctionSource(source, name)).join('\n\n')}\nmodule.exports = { ${functionNames.join(', ')} };`
  const sandbox = {
    module: { exports: {} },
    exports: {},
    Set,
    ...context,
  }
  vm.runInNewContext(script, sandbox, { filename: 'sector-m-design-os-profile-user-surface.editor-snippet.js' })
  return { exported: sandbox.module.exports, sandbox }
}

function toPlain(value) {
  return JSON.parse(JSON.stringify(value))
}

test('profile user surface: settings modal exposes a real profile select in current html', () => {
  const html = readFile('src/renderer/index.html')
  assert.ok(html.includes('data-profile-select'))
  assert.ok(html.includes('id="settings-profile"'))
  assert.ok(html.includes('<option value="default">Baseline</option>'))
  assert.ok(html.includes('<option value="focus">Focus</option>'))
  assert.equal(html.includes('data-style-select'), false)
})

test('profile user surface: profile select drives dormant context and applyViewMode sync', () => {
  const sandboxEvents = []
  const profileState = { value: 'focus' }
  const profileSelect = {}
  Object.defineProperty(profileSelect, 'value', {
    get() {
      return profileState.value
    },
    set(nextValue) {
      profileState.value = nextValue
      sandboxEvents.push(['profile', nextValue])
    },
  })
  const runtime = instantiateFunctions([
    'resolveDormantDesignOsProfileFromStyleValue',
    'resolveDormantDesignOsShellModeFromLayoutMode',
    'getCurrentDesignOsStyleValue',
    'buildDesignOsDormantContext',
    'applyViewMode',
  ], {
    profileSelect,
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
          toggle: (className, enabled) => {
            sandboxEvents.push(['toggle', className, enabled])
          },
        },
      },
    },
    localStorage: {
      setItem: (key, value) => {
        sandboxEvents.push(['persist', key, value])
      },
    },
    syncDesignOsDormantContext: () => {
      sandboxEvents.push(['sync'])
    },
  })

  assert.equal(runtime.exported.getCurrentDesignOsStyleValue(), 'focus')
  assert.deepEqual(toPlain(runtime.exported.buildDesignOsDormantContext()), {
    profile: 'FOCUS',
    workspace: 'REVIEW',
    shell_mode: 'CALM_DOCKED',
    platform: 'windows',
    accessibility: 'reduced_motion',
  })

  runtime.exported.applyViewMode('default')
  assert.deepEqual(toPlain(sandboxEvents), [
    ['toggle', 'focus-mode', false],
    ['profile', 'default'],
    ['persist', 'editorViewMode', 'default'],
    ['sync'],
  ])
  assert.equal(profileState.value, 'default')
})
