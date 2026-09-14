const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function readEditorSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8')
}

function extractFunctionSource(source, functionName) {
  const start = source.indexOf(`function ${functionName}(`)
  assert.notEqual(start, -1, `${functionName} source must exist`)
  const signatureEnd = source.indexOf(') {', start)
  assert.notEqual(signatureEnd, -1, `${functionName} signature must close`)
  const bodyStart = source.indexOf('{', signatureEnd)
  assert.notEqual(bodyStart, -1, `${functionName} body must exist`)
  let depth = 0
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index]
    if (character === '{') depth += 1
    if (character === '}') depth -= 1
    if (depth === 0) {
      return source.slice(start, index + 1)
    }
  }
  assert.fail(`${functionName} body must close`)
}

test('command palette visibility: editor imports listCommandCatalog and tracks local dormant visible command set', () => {
  const source = readEditorSource()
  assert.ok(source.includes("import { listCommandCatalog } from './commands/command-catalog.v1.mjs';"))
  assert.ok(source.includes('createDesignOsPorts,'))
  assert.ok(source.includes('let designOsDormantVisibleCommandIds = null;'))
  assert.ok(source.includes('const catalogManagedProjectCommandIds = new Set(listCommandCatalog().map((entry) => entry.id));'))
  assert.ok(source.includes('let designOsDormantCommandVisibilityDiagnostic = Object.freeze({'))
  assert.ok(source.includes('window.__DESIGN_OS_DORMANT_COMMAND_VISIBILITY_DIAGNOSTIC_V1__ = designOsDormantCommandVisibilityDiagnostic;'))
})

test('command palette visibility: syncDesignOsDormantContext captures preview.visible_commands and falls back open', () => {
  const source = readEditorSource()
  const start = source.indexOf('function syncDesignOsDormantContext()')
  const end = source.indexOf('function filterPaletteCommandEntries(')
  assert.ok(start > -1 && end > start, 'syncDesignOsDormantContext bounds must exist')

  const snippet = source.slice(start, end)
  assert.ok(snippet.includes('const mount = mountDesignOsDormantRuntime();'))
  assert.ok(snippet.includes("typeof mount.ports.previewDesign !== 'function'"))
  assert.ok(snippet.includes('const preview = mount.ports.previewDesign({'))
  assert.ok(snippet.includes('const nextVisibleCommandIds = normalizeDormantVisibleCommandIds(preview?.visible_commands);'))
  assert.ok(snippet.includes('designOsDormantVisibleCommandIds = nextVisibleCommandIds;'))
  assert.ok(snippet.includes('designOsDormantVisibleCommandIds = null;'))
  assert.ok(snippet.includes("recordDesignOsDormantCommandVisibilityDiagnostic('fallback-open', 'PREVIEW_PORT_UNAVAILABLE');"))
  assert.ok(snippet.includes("recordDesignOsDormantCommandVisibilityDiagnostic('fallback-open', 'PREVIEW_THROW', {"))
  assert.equal(snippet.includes('catch {}'), false)
})

test('command palette visibility: preview unavailable or throwing keeps base palette commands behaviorally open', () => {
  const source = readEditorSource()
  const harnessSource = [
    extractFunctionSource(source, 'normalizeDormantDesignOsError'),
    extractFunctionSource(source, 'recordDesignOsDormantCommandVisibilityDiagnostic'),
    extractFunctionSource(source, 'normalizeDormantVisibleCommandIds'),
    extractFunctionSource(source, 'syncDesignOsDormantContext'),
    extractFunctionSource(source, 'filterPaletteCommandEntries'),
    extractFunctionSource(source, 'createDormantAwarePaletteDataProvider'),
  ].join('\n\n')
  const createHarness = Function(`
    'use strict';
    const window = {};
    const catalogManagedProjectCommandIds = new Set([
      'cmd.project.open',
      'cmd.project.flowOpenV1',
    ]);
    let currentMount = null;
    let designOsDormantRuntimeMount = null;
    let designOsDormantVisibleCommandIds = null;
    let designOsDormantCommandVisibilityDiagnostic = Object.freeze({
      schemaVersion: 'yalken.designOs.dormantCommandVisibilityDiagnostic.v1',
      status: 'not-synced',
      reason: 'NOT_SYNCED',
      visibleCommandCount: null,
    });
    function buildDesignOsDormantContext() {
      return {
        shell_mode: 'CALM_DOCKED',
        profile: 'BASELINE',
        workspace: 'WRITE',
        platform: 'macos',
        accessibility: 'default',
      };
    }
    function mountDesignOsDormantRuntime() {
      return currentMount;
    }
    ${harnessSource}
    return {
      createProvider(baseProvider) {
        return createDormantAwarePaletteDataProvider(baseProvider);
      },
      setMount(nextMount) {
        currentMount = nextMount;
        designOsDormantRuntimeMount = nextMount;
      },
      syncDesignOsDormantContext,
      readDiagnostic() {
        return window.__DESIGN_OS_DORMANT_COMMAND_VISIBILITY_DIAGNOSTIC_V1__;
      },
    };
  `)
  const harness = createHarness()
  const baseEntries = [
    { id: 'cmd.project.open' },
    { id: 'cmd.project.flowOpenV1' },
    { id: 'cmd.project.insert.addCard' },
  ]
  const baseProvider = {
    listAll() {
      return baseEntries
    },
    listBySurface() {
      return baseEntries
    },
    listByGroup() {
      return [{ group: 'all', commands: baseEntries }]
    },
  }
  const provider = harness.createProvider(baseProvider)

  harness.setMount({
    ports: {
      previewDesign() {
        return { visible_commands: ['cmd.project.open'] }
      },
    },
  })
  harness.syncDesignOsDormantContext()
  assert.deepEqual(provider.listAll().map((entry) => entry.id), [
    'cmd.project.open',
    'cmd.project.insert.addCard',
  ])
  assert.equal(harness.readDiagnostic().reason, 'VISIBLE_COMMANDS_CAPTURED')
  assert.equal(harness.readDiagnostic().visibleCommandCount, 1)

  harness.setMount({ ports: {} })
  harness.syncDesignOsDormantContext()
  assert.deepEqual(provider.listAll().map((entry) => entry.id), baseEntries.map((entry) => entry.id))
  assert.equal(harness.readDiagnostic().reason, 'PREVIEW_PORT_UNAVAILABLE')
  assert.equal(harness.readDiagnostic().status, 'fallback-open')

  harness.setMount({
    ports: {
      previewDesign() {
        throw new Error('planned preview failure')
      },
    },
  })
  harness.syncDesignOsDormantContext()
  assert.deepEqual(provider.listAll().map((entry) => entry.id), baseEntries.map((entry) => entry.id))
  assert.equal(harness.readDiagnostic().reason, 'PREVIEW_THROW')
  assert.equal(harness.readDiagnostic().status, 'fallback-open')
  assert.equal(harness.readDiagnostic().error.message, 'planned preview failure')
})

test('command palette visibility: existing palette provider is wrapped and filtering applies to listAll listBySurface listByGroup', () => {
  const source = readEditorSource()
  assert.ok(source.includes('function createDormantAwarePaletteDataProvider(baseProvider) {'))
  assert.ok(source.includes('const commandPaletteDataProvider = createPaletteDataProvider(commandRegistry, {'))
  assert.ok(source.includes("entitlementTier: 'free',"))
  assert.ok(source.includes('const commandPaletteDataProviderBase = Object.freeze({'))
  assert.ok(source.includes('listAll: commandPaletteDataProvider.listAll.bind(commandPaletteDataProvider),'))
  assert.ok(source.includes('Object.assign(commandPaletteDataProvider, createDormantAwarePaletteDataProvider(commandPaletteDataProviderBase));'))
  assert.ok(source.includes('window.__COMMAND_PALETTE_DATA_PROVIDER_V1__ = commandPaletteDataProvider;'))
  assert.ok(source.includes('if (!catalogManagedProjectCommandIds.has(entry.id)) return true;'))
  assert.ok(source.includes('if (!(designOsDormantVisibleCommandIds instanceof Set)) return true;'))
  assert.ok(source.includes('return designOsDormantVisibleCommandIds.has(entry.id);'))
  assert.ok(source.includes('listAll() {'))
  assert.ok(source.includes('listBySurface(surface) {'))
  assert.ok(source.includes('listByGroup(surface) {'))
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

test('command palette visibility: runtime bridge command surface remains unchanged and palette resyncs before render', () => {
  const source = readEditorSource()

  const renderStart = source.indexOf('function renderCommandPaletteList(rawQuery = \'\')')
  const renderEnd = source.indexOf('function ensureCommandPaletteSearchFieldVisible()')
  assert.ok(renderStart > -1 && renderEnd > renderStart, 'palette render bounds must exist')
  const renderSnippet = source.slice(renderStart, renderEnd)
  assert.ok(renderSnippet.includes('syncDesignOsDormantContext();'))
  assert.ok(renderSnippet.indexOf('syncDesignOsDormantContext();') < renderSnippet.indexOf('commandPaletteDataProvider.listAll()'))

  const bridgeSource = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'tiptap', 'runtimeBridge.js'), 'utf8')
  assert.ok(bridgeSource.includes("commandId === 'cmd.project.view.openSettings'"))
  assert.ok(bridgeSource.includes("commandId === 'cmd.project.review.openRecovery'"))
  assert.ok(bridgeSource.includes("commandId === 'cmd.project.edit.undo'"))
  assert.ok(bridgeSource.includes("commandId === 'cmd.project.edit.find'"))
})
