const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const ROOT = path.resolve(__dirname, '..', '..')

function readEditorSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8')
}

function readStylesSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'styles.css'), 'utf8')
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

function instantiateSelectionHelpers(context = {}) {
  const source = readEditorSource()
  const script = `
let activeConfiguratorBucketItemSelection = { bucketKey: '', itemId: '' };
${[
  'createToolbarConfiguratorBucketItemSelection',
  'isToolbarConfiguratorBucketItemSelected',
  'clearToolbarConfiguratorBucketItemSelection',
  'reconcileToolbarConfiguratorBucketItemSelection',
  'setToolbarConfiguratorBucketItemSelection',
].map((name) => extractFunctionSource(source, name)).join('\n\n')}
module.exports = {
  createToolbarConfiguratorBucketItemSelection,
  isToolbarConfiguratorBucketItemSelected,
  clearToolbarConfiguratorBucketItemSelection,
  reconcileToolbarConfiguratorBucketItemSelection,
  setToolbarConfiguratorBucketItemSelection,
  readSelection() {
    return activeConfiguratorBucketItemSelection;
  },
};
`
  const sandbox = {
    module: { exports: {} },
    exports: {},
    TOOLBAR_CONFIGURATOR_PROFILE_NAMES: ['minimal', 'master'],
    renderToolbarConfiguratorBuckets: () => {},
    getToolbarConfiguratorProfileIds: () => [],
    ...context,
  }
  vm.runInNewContext(script, sandbox, {
    filename: 'sector-m-toolbar-x102-parity-remove-affordance.selection-snippet.js',
  })
  return sandbox.module.exports
}

function toPlain(value) {
  return JSON.parse(JSON.stringify(value))
}

test('sector-m toolbar x102 parity remove affordance: bucket surface no longer diverges through is-active-profile while remove cross still depends on active item state', () => {
  const source = readEditorSource()
  const styles = readStylesSource()

  assert.equal(source.includes("bucket.classList.toggle('is-active-profile', isActiveProfile);"), false)
  assert.equal(styles.includes('.configurator-panel__bucket.is-active-profile'), false)
  assert.ok(styles.includes('.configurator-panel__bucket-item.is-active .configurator-panel__bucket-remove'))
})

test('sector-m toolbar x102 parity remove affordance: editor wiring binds remove discoverability to click or selection on minimal bucket items', () => {
  const source = readEditorSource()

  assert.ok(source.includes('let activeConfiguratorBucketItemSelection = {'))
  assert.ok(source.includes('function setToolbarConfiguratorBucketItemSelection(bucketKey, itemId, shouldRender = true)'))
  assert.ok(source.includes("configuratorPanel.addEventListener('focusin', (event) => {"))
  assert.ok(source.includes("event.target.closest('.configurator-panel__bucket-item[data-item-id]')"))
  assert.ok(source.includes('item.tabIndex = 0;'))
  assert.ok(source.includes('removeButton.hidden = isProtectedBucket;'))
  assert.ok(source.includes('removeButton.disabled = isProtectedBucket;'))
})

test('sector-m toolbar x102 parity remove affordance: bucket item selection normalizes, renders, and reconciles honestly', () => {
  let renderCount = 0
  let bucketItems = {
    minimal: ['toolbar.font.family', 'toolbar.history.undo'],
    master: ['toolbar.font.family', 'toolbar.history.undo', 'toolbar.format.bold'],
  }

  const helpers = instantiateSelectionHelpers({
    renderToolbarConfiguratorBuckets: () => {
      renderCount += 1
    },
    getToolbarConfiguratorProfileIds: (bucketKey) => bucketItems[bucketKey] || [],
  })

  assert.deepEqual(
    toPlain(helpers.createToolbarConfiguratorBucketItemSelection('minimal', 'toolbar.history.undo')),
    { bucketKey: 'minimal', itemId: 'toolbar.history.undo' },
  )
  assert.deepEqual(
    toPlain(helpers.createToolbarConfiguratorBucketItemSelection('unknown', 'toolbar.history.undo')),
    { bucketKey: '', itemId: '' },
  )

  assert.equal(helpers.setToolbarConfiguratorBucketItemSelection('minimal', 'toolbar.history.undo'), true)
  assert.equal(renderCount, 1)
  assert.equal(helpers.isToolbarConfiguratorBucketItemSelected('minimal', 'toolbar.history.undo'), true)
  assert.deepEqual(toPlain(helpers.readSelection()), {
    bucketKey: 'minimal',
    itemId: 'toolbar.history.undo',
  })

  bucketItems = {
    minimal: ['toolbar.font.family'],
    master: ['toolbar.font.family', 'toolbar.history.undo', 'toolbar.format.bold'],
  }
  assert.equal(helpers.reconcileToolbarConfiguratorBucketItemSelection(), true)
  assert.deepEqual(toPlain(helpers.readSelection()), {
    bucketKey: '',
    itemId: '',
  })

  assert.equal(helpers.setToolbarConfiguratorBucketItemSelection('minimal', 'toolbar.font.family'), true)
  assert.equal(helpers.clearToolbarConfiguratorBucketItemSelection(true), true)
  assert.equal(renderCount, 3)
  assert.deepEqual(toPlain(helpers.readSelection()), {
    bucketKey: '',
    itemId: '',
  })
})
