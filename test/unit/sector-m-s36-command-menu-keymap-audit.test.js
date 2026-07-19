const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const ROOT = path.resolve(__dirname, '..', '..')

const MAIN_OWNED_MENU_COMMANDS = Object.freeze({
  'cmd.project.view.setMenuPresentationClassic': 'MENU_PRESENTATION_COMMAND_CLASSIC',
  'cmd.project.view.setMenuPresentationCompact': 'MENU_PRESENTATION_COMMAND_COMPACT',
  'cmd.project.view.setMenuLocaleBase': 'MENU_LOCALE_COMMAND_BASE',
  'cmd.project.view.setMenuLocaleRu': 'MENU_LOCALE_COMMAND_RU',
  'cmd.project.view.setMenuLocaleEn': 'MENU_LOCALE_COMMAND_EN',
  'cmd.project.view.resetMenuCustomization': 'MENU_CUSTOMIZATION_COMMAND_RESET',
  'cmd.project.review.openDocxReviewPreviewSession': 'DOCX_REVIEW_PREVIEW_SESSION_LOCAL_FILE_COMMAND_ID',
})

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'))
}

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function collectCommandNodes(nodes, out = []) {
  for (const node of nodes || []) {
    if (node && typeof node === 'object' && typeof node.canonicalCmdId === 'string' && node.canonicalCmdId) {
      out.push(node)
    }
    if (node && typeof node === 'object' && Array.isArray(node.items)) {
      collectCommandNodes(node.items, out)
    }
  }
  return out
}

function normalizeAccelerator(value) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/\s+/g, '')
    : ''
}

function assertNoAcceleratorConflicts(commandNodes) {
  const byAccelerator = new Map()
  for (const node of commandNodes) {
    const accelerator = normalizeAccelerator(node.accelerator)
    if (!accelerator) continue
    const entries = byAccelerator.get(accelerator) || []
    entries.push({ id: node.id, commandId: node.canonicalCmdId })
    byAccelerator.set(accelerator, entries)
  }

  const conflicts = []
  for (const [accelerator, entries] of byAccelerator) {
    const commandIds = new Set(entries.map((entry) => entry.commandId))
    if (commandIds.size > 1) {
      conflicts.push({ accelerator, entries })
    }
  }
  assert.deepEqual(conflicts, [])
}

async function loadModule(relativePath) {
  return import(pathToFileURL(path.join(ROOT, relativePath)).href)
}

async function buildRegistry() {
  const { createCommandRegistry } = await loadModule('src/renderer/commands/registry.mjs')
  const { registerProjectCommands } = await loadModule('src/renderer/commands/projectCommands.mjs')
  const registry = createCommandRegistry()
  registerProjectCommands(registry, {
    electronAPI: {},
    uiActions: {},
  })
  return registry
}

function buildNormalizedMenu() {
  const { normalizeMenuConfigPipeline } = require(path.join(ROOT, 'src/menu/menu-config-normalizer.js'))
  const result = normalizeMenuConfigPipeline({
    baseConfig: readJson('src/menu/menu-config.v2.json'),
    baseSourceRef: 'test:sector-m-s36-command-menu-keymap-audit',
    context: {
      mode: 'offline',
      profile: 'pro',
      stage: 'X4',
      platform: 'darwin',
      hasDocument: true,
      selectionExists: true,
    },
  })
  assert.equal(result.ok, true)
  assert.deepEqual(result.diagnostics.errors, [])
  return result.normalizedConfig
}

test('S36 command audit: public menu commands resolve to renderer registry or explicit main-owned handlers', async () => {
  const registry = await buildRegistry()
  const normalizedConfig = buildNormalizedMenu()
  const commandNodes = collectCommandNodes(normalizedConfig.menus)
  const commandIds = [...new Set(commandNodes.map((node) => node.canonicalCmdId))].sort()
  const mainSource = readText('src/main.js')
  const handlerBlock = mainSource.slice(mainSource.indexOf('const MENU_COMMAND_HANDLERS'))

  assert.equal(commandIds.length > 0, true)
  for (const commandId of commandIds) {
    if (registry.hasCommand(commandId)) continue

    const mainOwnedToken = MAIN_OWNED_MENU_COMMANDS[commandId]
    assert.equal(typeof mainOwnedToken, 'string', `unexpected public menu command without registry: ${commandId}`)
    assert.equal(mainSource.includes(`'${commandId}'`), true, `main command id missing: ${commandId}`)
    assert.equal(
      handlerBlock.includes(`[${mainOwnedToken}]`) || handlerBlock.includes(`'${commandId}':`),
      true,
      `main handler missing: ${mainOwnedToken}`,
    )
  }
})

test('S36 command audit: public commands have runtime and OPS capability declarations', async () => {
  const normalizedConfig = buildNormalizedMenu()
  const commandNodes = collectCommandNodes(normalizedConfig.menus)
  const commandIds = [...new Set(commandNodes.map((node) => node.canonicalCmdId))].sort()
  const capabilityPolicy = await loadModule('src/renderer/commands/capabilityPolicy.mjs')
  const bindingDoc = readJson('docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json')
  const matrixDoc = readJson('docs/OPS/CAPABILITIES_MATRIX.json')
  const bindingMap = new Map(bindingDoc.items.map((item) => [item.commandId, item.capabilityId]))
  const docsMatrix = new Map(matrixDoc.items.map((item) => [item.platformId, item.capabilities]))

  for (const commandId of commandIds) {
    const runtimeCapability = capabilityPolicy.CAPABILITY_BINDING[commandId]
    assert.equal(typeof runtimeCapability, 'string', `runtime capability binding missing: ${commandId}`)
    assert.equal(bindingMap.get(commandId), runtimeCapability, `OPS capability binding mismatch: ${commandId}`)

    for (const platformId of Object.keys(capabilityPolicy.CAPABILITY_MATRIX)) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(capabilityPolicy.CAPABILITY_MATRIX[platformId], runtimeCapability),
        true,
        `runtime matrix missing ${runtimeCapability} for ${platformId}`,
      )
      assert.equal(
        Object.prototype.hasOwnProperty.call(docsMatrix.get(platformId) || {}, runtimeCapability),
        true,
        `OPS matrix missing ${runtimeCapability} for ${platformId}`,
      )
    }
  }
})

test('S36 command audit: public menu config is canonical and has no shortcut conflicts', () => {
  const baseConfig = readJson('src/menu/menu-config.v2.json')
  const rawConfig = JSON.stringify(baseConfig)
  assert.equal(rawConfig.includes('"actionId"'), false)

  const normalizedConfig = buildNormalizedMenu()
  const commandNodes = collectCommandNodes(normalizedConfig.menus)
  assertNoAcceleratorConflicts(commandNodes)
})

test('S36 command audit: palette entries are unique and capability-bound', async () => {
  const registry = await buildRegistry()
  const capabilityPolicy = await loadModule('src/renderer/commands/capabilityPolicy.mjs')
  const paletteEntries = registry.listBySurface('palette')
  const seen = new Set()

  assert.equal(paletteEntries.length > 0, true)
  for (const entry of paletteEntries) {
    assert.equal(seen.has(entry.id), false, `duplicate palette command: ${entry.id}`)
    seen.add(entry.id)
    assert.equal(typeof capabilityPolicy.CAPABILITY_BINDING[entry.id], 'string', `palette command capability missing: ${entry.id}`)
  }
})
