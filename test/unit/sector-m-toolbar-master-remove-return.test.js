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
  let parenDepth = 0
  let braceStart = -1
  for (let index = start; index < source.length; index += 1) {
    const char = source[index]
    if (char === '(') parenDepth += 1
    if (char === ')') parenDepth -= 1
    if (char === '{' && parenDepth === 0) {
      braceStart = index
      break
    }
  }
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

function createFakeElement(tagName) {
  return {
    tagName,
    className: '',
    dataset: {},
    attributes: {},
    children: [],
    textContent: '',
    hidden: false,
    disabled: false,
    draggable: false,
    tabIndex: undefined,
    type: '',
    setAttribute(name, value) {
      this.attributes[name] = value
    },
    append(...nodes) {
      this.children.push(...nodes)
    },
  }
}

function instantiateBucketHelpers(context = {}) {
  const source = readEditorSource()
  const script = `
${[
  'normalizeToolbarConfiguratorProfileName',
  'isToolbarConfiguratorProtectedBucket',
  'createToolbarConfiguratorBucketItem',
  'getToolbarConfiguratorProfileIds',
  'removeToolbarConfiguratorItem',
].map((name) => extractFunctionSource(source, name)).join('\n\n')}
function commitToolbarConfiguratorState(nextState) {
  committed += 1
  committedState = nextState
  configuratorBucketState = nextState
}
let committed = 0
let committedState = null
module.exports = {
  createToolbarConfiguratorBucketItem,
  removeToolbarConfiguratorItem,
  readCommitted() {
    return { committed, committedState, configuratorBucketState }
  },
}
`
  const sandbox = {
    module: { exports: {} },
    exports: {},
    document: {
      createElement: createFakeElement,
    },
    getToolbarConfiguratorCatalogItem(itemId) {
      return { id: itemId, implementationState: 'live' }
    },
    getToolbarConfiguratorEntryPanelLabel(entry) {
      return entry.id
    },
    isToolbarConfiguratorBucketItemSelected() {
      return false
    },
    configuratorBucketState: {
      toolbarProfiles: {
        minimal: ['toolbar.history.undo'],
        master: ['toolbar.history.undo', 'toolbar.format.bold'],
      },
    },
    ...context,
  }
  vm.runInNewContext(script, sandbox, {
    filename: 'sector-m-toolbar-master-remove-return.editor-snippet.js',
  })
  return sandbox.module.exports
}

function toPlain(value) {
  return JSON.parse(JSON.stringify(value))
}

test('sector-m toolbar master remove return: selected master items are not hidden or disabled for remove affordance', () => {
  const helpers = instantiateBucketHelpers()

  const masterItem = helpers.createToolbarConfiguratorBucketItem('toolbar.format.bold', 'master', 1)
  const minimalItem = helpers.createToolbarConfiguratorBucketItem('toolbar.history.undo', 'minimal', 0)

  assert.equal(masterItem.children[2].hidden, false)
  assert.equal(masterItem.children[2].disabled, false)
  assert.equal(minimalItem.children[2].hidden, false)
  assert.equal(minimalItem.children[2].disabled, false)
})

test('sector-m toolbar master remove return: removeToolbarConfiguratorItem mutates master and minimal honestly', () => {
  const helpers = instantiateBucketHelpers()

  helpers.removeToolbarConfiguratorItem('toolbar.format.bold', 'master')
  const afterMaster = toPlain(helpers.readCommitted())
  assert.equal(afterMaster.committed, 1)
  assert.deepEqual(afterMaster.configuratorBucketState.toolbarProfiles.master, [
    'toolbar.history.undo',
  ])

  helpers.removeToolbarConfiguratorItem('toolbar.history.undo', 'minimal')
  const afterMinimal = toPlain(helpers.readCommitted())
  assert.equal(afterMinimal.committed, 2)
  assert.deepEqual(afterMinimal.configuratorBucketState.toolbarProfiles.minimal, [])
})

test('sector-m toolbar master remove return: master removal persists after adopt and reopen state path', () => {
  const source = readEditorSource()
  const script = `
${[
  'normalizeToolbarConfiguratorProfileName',
  'createToolbarConfiguratorState',
  'readToolbarConfiguratorStoredState',
  'writeToolbarConfiguratorStoredState',
  'resolveToolbarConfiguratorState',
  'commitToolbarConfiguratorState',
  'adoptToolbarConfiguratorState',
  'getToolbarConfiguratorProfileIds',
  'removeToolbarConfiguratorItem',
].map((name) => extractFunctionSource(source, name)).join('\n\n')}
module.exports = {
  removeToolbarConfiguratorItem,
  adoptToolbarConfiguratorState,
  readState() {
    return configuratorBucketState
  },
  readStored(projectId) {
    return readToolbarConfiguratorStoredState(projectId)
  },
}
`

  const store = new Map()
  const sandbox = {
    module: { exports: {} },
    exports: {},
    TOOLBAR_CONFIGURATOR_DEFAULT_ACTIVE_PROFILE: 'minimal',
    currentProjectId: 'project-07d',
    configuratorBucketState: {
      version: 3,
      activeToolbarProfile: 'master',
      toolbarProfiles: {
        minimal: ['toolbar.history.undo'],
        master: ['toolbar.history.undo', 'toolbar.format.bold'],
      },
    },
    normalizeProjectId(value) {
      return typeof value === 'string' ? value.trim() : ''
    },
    getToolbarProfileStorageKey(projectId) {
      return projectId ? `toolbarProfiles:${projectId}` : ''
    },
    isPlainObject(value) {
      return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    },
    normalizeToolbarConfiguratorItemIds(values) {
      return Array.isArray(values) ? [...values] : []
    },
    createToolbarConfiguratorCanonicalProfileIds() {
      return ['toolbar.history.undo', 'toolbar.format.bold']
    },
    isImplicitExpandedToolbarProfileState() {
      return false
    },
    resolveToolbarProfileStateForProjectSwitch() {
      return {
        source: 'seed',
        shouldPersist: false,
        shouldConsumeLegacySource: false,
        state: {
          version: 3,
          activeToolbarProfile: 'minimal',
          toolbarProfiles: {
            minimal: ['toolbar.history.undo'],
            master: ['toolbar.history.undo', 'toolbar.format.bold'],
          },
        },
      }
    },
    consumeLegacyConfiguratorBuckets() {},
    reconcileToolbarConfiguratorBucketItemSelection() {},
    renderToolbarConfiguratorLibrary() {},
    renderToolbarConfiguratorProfileSwitch() {},
    renderToolbarConfiguratorBuckets() {},
    projectMainFloatingToolbarRuntime() {},
    localStorage: {
      getItem(key) {
        return store.has(key) ? store.get(key) : null
      },
      setItem(key, value) {
        store.set(key, String(value))
      },
    },
  }

  vm.runInNewContext(script, sandbox, {
    filename: 'sector-m-toolbar-master-remove-return.persistence-snippet.js',
  })

  const helpers = sandbox.module.exports
  helpers.removeToolbarConfiguratorItem('toolbar.format.bold', 'master')

  assert.deepEqual(toPlain(helpers.readStored('project-07d').toolbarProfiles.master), [
    'toolbar.history.undo',
  ])

  sandbox.configuratorBucketState = {
    version: 3,
    activeToolbarProfile: 'master',
    toolbarProfiles: {
      minimal: ['toolbar.history.undo'],
      master: ['toolbar.history.undo', 'toolbar.format.bold'],
    },
  }

  helpers.adoptToolbarConfiguratorState('project-07d')

  assert.deepEqual(toPlain(helpers.readState().toolbarProfiles.master), [
    'toolbar.history.undo',
  ])
})
