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
    Array,
    Set,
    ...context,
  }
  vm.runInNewContext(script, sandbox, { filename: 'sector-m-design-os-command-palette-visibility.editor-snippet.js' })
  return { exported: sandbox.module.exports, sandbox }
}

function toPlain(value) {
  return JSON.parse(JSON.stringify(value))
}

test('command palette visibility: editor imports listCommandCatalog and initializes dormant visibility state', () => {
  const source = readEditorSource()
  assert.ok(source.includes("import { listCommandCatalog } from './commands/command-catalog.v1.mjs';"))
  assert.ok(source.includes('let designOsDormantVisibleCommandIds = null;'))
  assert.ok(source.includes('const catalogManagedProjectCommandIds = new Set(listCommandCatalog().map((entry) => entry.id));'))
})

test('command palette visibility: syncDesignOsDormantContext captures preview.visible_commands and keeps token css path', () => {
  const snippet = extractFunctionSource(readEditorSource(), 'syncDesignOsDormantContext')
  assert.ok(snippet.includes('const preview = refreshDesignOsDormantPreview();'))
  assert.ok(snippet.includes('designOsDormantDegradedToBaseline = preview?.degraded_to_baseline === true;'))
  assert.ok(snippet.includes('const nextVisibleCommandIds = normalizeDormantVisibleCommandIds(preview?.visible_commands);'))
  assert.ok(snippet.includes('designOsDormantVisibleCommandIds = Array.isArray(preview?.visible_commands) ? nextVisibleCommandIds : null;'))
  assert.ok(snippet.includes('const resolvedTokens ='))
  assert.ok(snippet.includes("const isDarkTheme = document.body.classList.contains('dark-theme');"))
  assert.ok(snippet.includes('const cssVariables = extractCssVariablesFromTokens(resolvedTokens, {'))
  assert.ok(snippet.includes('applyCssVariables(document.documentElement, cssVariables);'))

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
      resolved_tokens: { color: { accent: '#fff' } },
    }),
    document: {
      body: {
        classList: {
          contains: () => false,
        },
      },
      documentElement: { id: 'root' },
    },
    extractCssVariablesFromTokens: (tokens, options) => {
      sandbox.cssArgs = [toPlain(tokens), toPlain(options)]
      return { '--accent': '#fff' }
    },
    applyCssVariables: (root, vars) => {
      sandbox.applyArgs = [root.id, toPlain(vars)]
    },
  })

  const preview = exported.syncDesignOsDormantContext()
  assert.deepEqual(toPlain(preview), {
    degraded_to_baseline: false,
    visible_commands: ['cmd.project.open', ' cmd.project.save ', '', 'cmd.project.open'],
    resolved_tokens: { color: { accent: '#fff' } },
  })
  assert.deepEqual(toPlain(sandbox.designOsDormantVisibleCommandIds), [
    'cmd.project.open',
    'cmd.project.save',
  ])
  assert.deepEqual(toPlain(sandbox.cssArgs), [
    { color: { accent: '#fff' } },
    { isDarkTheme: false },
  ])
  assert.deepEqual(toPlain(sandbox.applyArgs), ['root', { '--accent': '#fff' }])
})

test('command palette visibility: existing palette provider is wrapped and filtering applies to listAll listBySurface listByGroup', () => {
  const source = readEditorSource()
  assert.ok(source.includes('function createDormantAwarePaletteDataProvider(baseProvider) {'))
  assert.ok(source.includes('const baseCommandPaletteDataProvider = createPaletteDataProvider(commandRegistry, { defaultSurface: \'palette\' });'))
  assert.ok(source.includes('const commandPaletteDataProvider = createDormantAwarePaletteDataProvider(baseCommandPaletteDataProvider);'))
  assert.ok(source.includes('window.__COMMAND_PALETTE_DATA_PROVIDER_V1__ = commandPaletteDataProvider;'))
  assert.ok(source.includes('if (!catalogManagedProjectCommandIds.has(entry.id)) return true;'))
  assert.ok(source.includes('if (!Array.isArray(designOsDormantVisibleCommandIds)) return true;'))
  assert.ok(source.includes('return designOsDormantVisibleCommandIds.includes(entry.id);'))
  assert.ok(source.includes('listAll() {'))
  assert.ok(source.includes('listBySurface(surface) {'))
  assert.ok(source.includes('listByGroup(surface) {'))

  const { exported } = instantiateFunctions([
    'shouldKeepDormantPaletteEntry',
    'filterDormantPaletteEntries',
    'filterDormantPaletteGroups',
    'createDormantAwarePaletteDataProvider',
  ], {
    catalogManagedProjectCommandIds: new Set([
      'cmd.project.open',
      'cmd.project.save',
      'cmd.project.flowOpenV1',
      'cmd.project.flowSaveV1',
    ]),
    designOsDormantVisibleCommandIds: [
      'cmd.project.open',
      'cmd.project.save',
    ],
  })

  const provider = exported.createDormantAwarePaletteDataProvider({
    listAll: () => ([
      { id: 'cmd.project.open', label: 'Open' },
      { id: 'cmd.project.flowOpenV1', label: 'Flow Open' },
      { id: 'cmd.project.insert.addCard', label: 'Add Card' },
    ]),
    listBySurface: () => ([
      { id: 'cmd.project.save', label: 'Save' },
      { id: 'cmd.project.flowSaveV1', label: 'Flow Save' },
      { id: 'cmd.project.insert.addCard', label: 'Add Card' },
    ]),
    listByGroup: () => ([
      { group: 'file', commands: [{ id: 'cmd.project.open' }, { id: 'cmd.project.save' }] },
      { group: 'flow', commands: [{ id: 'cmd.project.flowOpenV1' }, { id: 'cmd.project.flowSaveV1' }] },
      { group: 'insert', commands: [{ id: 'cmd.project.insert.addCard' }] },
    ]),
  })

  assert.deepEqual(toPlain(provider.listAll().map((entry) => entry.id)), [
    'cmd.project.open',
    'cmd.project.insert.addCard',
  ])
  assert.deepEqual(toPlain(provider.listBySurface('palette').map((entry) => entry.id)), [
    'cmd.project.save',
    'cmd.project.insert.addCard',
  ])
  assert.deepEqual(toPlain(provider.listByGroup('palette')), [
    { group: 'file', commands: [{ id: 'cmd.project.open' }, { id: 'cmd.project.save' }] },
    { group: 'insert', commands: [{ id: 'cmd.project.insert.addCard' }] },
  ])
})

test('command palette visibility: baseline visible_commands semantics hide flow catalog entries and keep required core and non-catalog extras', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'OPS', 'STATUS', 'X15_PROFILE_PRESETS_SCHEMA_v1.json'), 'utf8'))
  const baselineVisibleSet = new Set([
    ...(Array.isArray(schema?.requiredCoreCommands) ? schema.requiredCoreCommands : []),
    ...(Array.isArray(schema?.presets?.pro?.commandVisibility?.forceVisible) ? schema.presets.pro.commandVisibility.forceVisible : []),
  ])

  const catalogSource = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'commands', 'command-catalog.v1.mjs'), 'utf8')
  const catalogIds = [...catalogSource.matchAll(/id:\s*'([^']+)'/g)].map((match) => match[1])
  const catalogManaged = new Set(catalogIds)

  const filterEntries = (entries) =>
    entries.filter((entry) => {
      if (!catalogManaged.has(entry.id)) return true
      return baselineVisibleSet.has(entry.id)
    })

  const baseEntries = [
    ...catalogIds.map((id) => ({ id })),
    { id: 'cmd.project.insert.addCard' },
  ]
  const filteredIds = new Set(filterEntries(baseEntries).map((entry) => entry.id))

  assert.equal(filteredIds.has('cmd.project.flowOpenV1'), false)
  assert.equal(filteredIds.has('cmd.project.flowSaveV1'), false)
  assert.equal(filteredIds.has('cmd.project.open'), true)
  assert.equal(filteredIds.has('cmd.project.save'), true)
  assert.equal(filteredIds.has('cmd.project.export.docxMin'), true)
  assert.equal(filteredIds.has('cmd.project.insert.addCard'), true)

  const grouped = [
    { group: 'file', commands: [{ id: 'cmd.project.open' }, { id: 'cmd.project.save' }] },
    { group: 'flow', commands: [{ id: 'cmd.project.flowOpenV1' }, { id: 'cmd.project.flowSaveV1' }] },
    { group: 'insert', commands: [{ id: 'cmd.project.insert.addCard' }] },
  ]
  const filteredGroups = grouped
    .map((group) => ({ group: group.group, commands: filterEntries(group.commands) }))
    .filter((group) => group.commands.length > 0)

  assert.deepEqual(filteredGroups.map((group) => group.group), ['file', 'insert'])
})

test('command palette visibility: runtime bridge command surface and layout sync helper remain unchanged', () => {
  const source = readEditorSource()

  const layoutSnippet = extractFunctionSource(source, 'stopSpatialResize')
  assert.ok(layoutSnippet.includes('commitSpatialLayoutState(currentProjectId);'))
  assert.equal(layoutSnippet.includes('commitDesign('), false)

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
