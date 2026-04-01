const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function readEditorSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8')
}

test.skip('command palette visibility: editor imports listCommandCatalog and tracks local dormant visible command set', () => {
  const source = readEditorSource()
  assert.ok(source.includes("import { listCommandCatalog } from './commands/command-catalog.v1.mjs';"))
  assert.ok(source.includes('let designOsDormantVisibleCommandIds = null;'))
  assert.ok(source.includes('const catalogManagedProjectCommandIds = new Set(listCommandCatalog().map((entry) => entry.id));'))
})

test.skip('command palette visibility: syncDesignOsDormantContext captures preview.visible_commands and keeps token css path', () => {
  const source = readEditorSource()
  const start = source.indexOf('function syncDesignOsDormantContext()')
  const end = source.indexOf('function syncDesignOsDormantTextInput()')
  assert.ok(start > -1 && end > start, 'syncDesignOsDormantContext bounds must exist')

  const snippet = source.slice(start, end)
  assert.ok(snippet.includes('const preview = designOsDormantRuntimeMount.ports.previewDesign({'))
  assert.ok(snippet.includes('designOsDormantDegradedToBaseline = preview?.degraded_to_baseline === true;'))
  assert.ok(snippet.includes('const nextVisibleCommandIds = normalizeDormantVisibleCommandIds(preview?.visible_commands);'))
  assert.ok(snippet.includes('designOsDormantVisibleCommandIds = nextVisibleCommandIds;'))
  assert.ok(snippet.includes('const resolvedTokens = preview?.resolved_tokens;'))
  assert.ok(snippet.includes("const isDarkTheme = document.body.classList.contains('dark-theme');"))
  assert.ok(snippet.includes('const cssVariables = extractCssVariablesFromTokens(resolvedTokens, {'))
  assert.ok(snippet.includes('applyCssVariables(document.documentElement, cssVariables);'))
  assert.ok(snippet.includes('designOsDormantVisibleCommandIds = null;'))
})

test.skip('command palette visibility: existing palette provider is wrapped and filtering applies to listAll listBySurface listByGroup', () => {
  const source = readEditorSource()
  assert.ok(source.includes('function createDormantAwarePaletteDataProvider(baseProvider) {'))
  assert.ok(source.includes('const baseCommandPaletteDataProvider = createPaletteDataProvider(commandRegistry, { defaultSurface: \'palette\' });'))
  assert.ok(source.includes('const commandPaletteDataProvider = createDormantAwarePaletteDataProvider(baseCommandPaletteDataProvider);'))
  assert.ok(source.includes('window.__COMMAND_PALETTE_DATA_PROVIDER_V1__ = commandPaletteDataProvider;'))
  assert.ok(source.includes('if (!catalogManagedProjectCommandIds.has(entry.id)) return true;'))
  assert.ok(source.includes('if (!(designOsDormantVisibleCommandIds instanceof Set)) return true;'))
  assert.ok(source.includes('return designOsDormantVisibleCommandIds.has(entry.id);'))
  assert.ok(source.includes('listAll() {'))
  assert.ok(source.includes('listBySurface(surface) {'))
  assert.ok(source.includes('listByGroup(surface) {'))
})

test.skip('command palette visibility: baseline visible_commands semantics hide flow catalog entries and keep required core and non-catalog extras', () => {
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

test.skip('command palette visibility: runtime bridge command surface and layout sync helper remain unchanged', () => {
  const source = readEditorSource()

  const layoutStart = source.indexOf('function syncDesignOsDormantLayoutCommitAtResizeEnd(committedSpatialState)')
  const layoutEnd = source.indexOf('function applyMode(mode)')
  assert.ok(layoutStart > -1 && layoutEnd > layoutStart, 'layout commit helper bounds must exist')
  const layoutSnippet = source.slice(layoutStart, layoutEnd)
  assert.ok(layoutSnippet.includes('const layoutPatch = buildLayoutPatchFromSpatialState(committedSpatialState, {'))
  assert.ok(layoutSnippet.includes("commit_point: 'resize_end',"))

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
