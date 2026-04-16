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

function instantiateFunctions(functionNames, context = {}) {
  const source = readEditorSource()
  const script = `${functionNames.map((name) => extractFunctionSource(source, name)).join('\n\n')}\nmodule.exports = { ${functionNames.join(', ')} };`
  const sandbox = {
    module: { exports: {} },
    exports: {},
    Array,
    Math,
    Object,
    JSON,
    ...context,
  }
  vm.runInNewContext(script, sandbox, { filename: 'sector-m-toolbar-inner-window-return.editor-snippet.js' })
  return sandbox.module.exports
}

function toPlain(value) {
  return JSON.parse(JSON.stringify(value))
}

test('sector-m toolbar inner window return: lower area rebuilds as a 4x5 live-plus-placeholder slot grid', () => {
  const source = readEditorSource()
  const styles = readStylesSource()
  const renderSnippet = extractFunctionSource(source, 'renderToolbarConfiguratorLibrary')

  assert.ok(source.includes('const TOOLBAR_CONFIGURATOR_LIBRARY_COLUMN_COUNT = 4;'))
  assert.ok(source.includes('const TOOLBAR_CONFIGURATOR_LIBRARY_MIN_SLOT_COUNT = 20;'))
  assert.ok(source.includes("const TOOLBAR_CONFIGURATOR_LIBRARY_PLACEHOLDER_TEXT = 'New Slot';"))
  assert.equal(source.includes('TOOLBAR_CONFIGURATOR_LIBRARY_VISIBLE_STATES'), false)
  assert.equal(renderSnippet.includes("configurator-panel__label"), false)
  assert.ok(styles.includes('grid-template-columns: repeat(4, minmax(0, 1fr));'))
  assert.ok(styles.includes('.configurator-panel__slot--placeholder,'))

  const { getToolbarConfiguratorLibraryColumns } = instantiateFunctions([
    'listToolbarConfiguratorLibraryEntries',
    'getToolbarConfiguratorLibraryColumns',
  ], {
    listLiveToolbarFunctionCatalogEntries: () => Array.from({ length: 17 }, (_, index) => ({
      id: `item-${index + 1}`,
      labels: { ru: { panelLabel: `Пункт ${index + 1}` } },
      implementationState: 'live',
    })),
    TOOLBAR_CONFIGURATOR_LIBRARY_COLUMN_COUNT: 4,
    TOOLBAR_CONFIGURATOR_LIBRARY_MIN_SLOT_COUNT: 20,
    TOOLBAR_CONFIGURATOR_LIBRARY_PLACEHOLDER_TEXT: 'New Slot',
  })

  const columns = toPlain(getToolbarConfiguratorLibraryColumns())
  const flat = columns.flat()

  assert.equal(columns.length, 4)
  assert.deepEqual(columns.map((column) => column.length), [5, 5, 5, 5])
  assert.equal(flat.filter((slot) => slot.kind === 'item').length, 17)
  assert.equal(flat.filter((slot) => slot.kind === 'placeholder').length, 3)
  assert.equal(columns[0][0].itemId, 'item-1')
  assert.equal(columns[1][0].itemId, 'item-2')
  assert.equal(columns[2][0].itemId, 'item-3')
  assert.equal(columns[3][4].label, 'New Slot')
})

test('sector-m toolbar inner window return: state normalization still preserves provided master ids instead of hard-resetting them', () => {
  const source = readEditorSource()

  assert.match(
    source,
    /function createToolbarConfiguratorState[\s\S]*const hasMaster = Object\.prototype\.hasOwnProperty\.call\(rawToolbarProfiles, 'master'\);[\s\S]*\? normalizeToolbarConfiguratorItemIds\(rawToolbarProfiles\.master\)[\s\S]*: createToolbarConfiguratorCanonicalProfileIds\(\)/,
  )
  assert.doesNotMatch(
    source,
    /function createToolbarConfiguratorState[\s\S]*master: Object\.freeze\(createToolbarConfiguratorCanonicalProfileIds\(\)\),/,
  )
})

test('sector-m toolbar inner window return: inter-bucket transfer keeps full master truth while mutating minimal honestly', () => {
  const { getToolbarConfiguratorBucketDropIntent, resolveToolbarConfiguratorInterBucketTransfer } = instantiateFunctions([
    'getToolbarConfiguratorBucketDropIntent',
    'insertToolbarConfiguratorItemIntoBucket',
    'resolveToolbarConfiguratorInterBucketTransfer',
  ], {
    normalizeToolbarConfiguratorProfileName: (profileName) => profileName === 'master' ? 'master' : 'minimal',
    isPlainObject: (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value),
    createToolbarConfiguratorSeedState: () => ({
      activeToolbarProfile: 'minimal',
      toolbarProfiles: {
        minimal: ['toolbar.font.family'],
        master: ['toolbar.font.family', 'toolbar.font.weight', 'toolbar.format.bold'],
      },
    }),
  })

  assert.equal(
    getToolbarConfiguratorBucketDropIntent({ sourceType: 'bucket-item', itemId: 'toolbar.font.family', bucketKey: 'master' }, 'minimal'),
    'copy-from-master',
  )
  assert.equal(
    getToolbarConfiguratorBucketDropIntent({ sourceType: 'bucket-item', itemId: 'toolbar.font.family', bucketKey: 'minimal' }, 'master'),
    'return-to-master',
  )
  assert.equal(
    getToolbarConfiguratorBucketDropIntent({ sourceType: 'bucket-item', itemId: 'toolbar.font.family', bucketKey: 'master' }, 'master'),
    'reorder',
  )

  const baseState = {
    activeToolbarProfile: 'minimal',
    toolbarProfiles: {
      minimal: ['toolbar.font.family', 'toolbar.font.weight'],
      master: ['toolbar.font.family', 'toolbar.font.weight', 'toolbar.format.bold'],
    },
  }

  const copyToMinimal = toPlain(resolveToolbarConfiguratorInterBucketTransfer(
    baseState,
    { sourceType: 'bucket-item', itemId: 'toolbar.format.bold', bucketKey: 'master' },
    'minimal',
    1,
  ))
  assert.deepEqual(copyToMinimal.toolbarProfiles.minimal, [
    'toolbar.font.family',
    'toolbar.format.bold',
    'toolbar.font.weight',
  ])
  assert.deepEqual(copyToMinimal.toolbarProfiles.master, [
    'toolbar.font.family',
    'toolbar.font.weight',
    'toolbar.format.bold',
  ])

  const returnToMaster = toPlain(resolveToolbarConfiguratorInterBucketTransfer(
    copyToMinimal,
    { sourceType: 'bucket-item', itemId: 'toolbar.font.family', bucketKey: 'minimal' },
    'master',
    99,
  ))
  assert.deepEqual(returnToMaster.toolbarProfiles.minimal, [
    'toolbar.format.bold',
    'toolbar.font.weight',
  ])
  assert.deepEqual(returnToMaster.toolbarProfiles.master, [
    'toolbar.font.family',
    'toolbar.font.weight',
    'toolbar.format.bold',
  ])

  const duplicateIntoMinimal = toPlain(resolveToolbarConfiguratorInterBucketTransfer(
    baseState,
    { sourceType: 'bucket-item', itemId: 'toolbar.font.family', bucketKey: 'master' },
    'minimal',
    2,
  ))
  assert.deepEqual(duplicateIntoMinimal.toolbarProfiles.minimal, [
    'toolbar.font.weight',
    'toolbar.font.family',
  ])
  assert.deepEqual(duplicateIntoMinimal.toolbarProfiles.master, [
    'toolbar.font.family',
    'toolbar.font.weight',
    'toolbar.format.bold',
  ])
})
