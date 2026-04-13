const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const ROOT = path.resolve(__dirname, '..', '..')

function createMemoryStorage() {
  const data = new Map()
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null
    },
    setItem(key, value) {
      data.set(key, String(value))
    },
    removeItem(key) {
      data.delete(key)
    },
  }
}

async function importModule(parts) {
  return import(pathToFileURL(path.join(ROOT, ...parts)).href)
}

async function loadRuntimeBridgeModule() {
  const source = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'tiptap', 'runtimeBridge.js'), 'utf8')
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`)
}

test('toolbar expansion wave a1: catalog promotes bold, italic, underline, link and list type', async () => {
  const catalog = await importModule(['src', 'renderer', 'toolbar', 'toolbarFunctionCatalog.mjs'])

  assert.deepEqual(catalog.TOOLBAR_CANONICAL_LIVE_ORDER, [
    'toolbar.font.family',
    'toolbar.font.weight',
    'toolbar.font.size',
    'toolbar.text.lineHeight',
    'toolbar.format.bold',
    'toolbar.format.italic',
    'toolbar.format.underline',
    'toolbar.paragraph.alignment',
    'toolbar.list.type',
    'toolbar.insert.link',
    'toolbar.history.undo',
    'toolbar.history.redo',
  ])

  assert.equal(catalog.getToolbarFunctionCatalogEntryById('toolbar.format.bold').implementationState, 'live')
  assert.equal(catalog.getToolbarFunctionCatalogEntryById('toolbar.format.bold').commandId, 'cmd.project.format.toggleBold')
  assert.equal(catalog.getToolbarFunctionCatalogEntryById('toolbar.format.italic').implementationState, 'live')
  assert.equal(catalog.getToolbarFunctionCatalogEntryById('toolbar.format.italic').commandId, 'cmd.project.format.toggleItalic')
  assert.equal(catalog.getToolbarFunctionCatalogEntryById('toolbar.format.underline').implementationState, 'live')
  assert.equal(catalog.getToolbarFunctionCatalogEntryById('toolbar.format.underline').commandId, 'cmd.project.format.toggleUnderline')
  assert.equal(catalog.getToolbarFunctionCatalogEntryById('toolbar.list.type').implementationState, 'live')
  assert.equal(catalog.getToolbarFunctionCatalogEntryById('toolbar.list.type').actionAlias, 'toggle-list-menu')
  assert.equal(catalog.getToolbarFunctionCatalogEntryById('toolbar.insert.link').implementationState, 'live')
  assert.equal(catalog.getToolbarFunctionCatalogEntryById('toolbar.insert.link').commandId, 'cmd.project.insert.linkPrompt')
})

test('toolbar expansion wave a1: expanded seed is new-project only and saved minimal is not backfilled', async () => {
  const catalog = await importModule(['src', 'renderer', 'toolbar', 'toolbarFunctionCatalog.mjs'])
  const profile = await importModule(['src', 'renderer', 'toolbar', 'toolbarProfileState.mjs'])
  const storage = createMemoryStorage()

  const seed = profile.createCanonicalMinimalToolbarProfileState()
  assert.deepEqual(seed.toolbarProfiles.minimal, catalog.TOOLBAR_CANONICAL_LIVE_ORDER)

  storage.setItem('toolbarProfiles:existing', JSON.stringify({
    version: 2,
    toolbarProfiles: { minimal: ['toolbar.font.family'] },
  }))
  const existing = profile.resolveToolbarProfileStateForProjectSwitch(storage, 'existing')
  assert.equal(existing.source, 'persisted')
  assert.deepEqual(existing.state.toolbarProfiles.minimal, ['toolbar.font.family'])

  const next = profile.resolveToolbarProfileStateForProjectSwitch(storage, 'new-project')
  assert.equal(next.source, 'seed')
  assert.deepEqual(next.state.toolbarProfiles.minimal, catalog.TOOLBAR_CANONICAL_LIVE_ORDER)
})

test('toolbar expansion wave a1: capability gate allows rich commands only in TipTap mode', async () => {
  const capability = await importModule(['src', 'renderer', 'commands', 'capabilityPolicy.mjs'])
  const projectCommands = await importModule(['src', 'renderer', 'commands', 'projectCommands.mjs'])

  const expected = [
    [projectCommands.EXTRA_COMMAND_IDS.FORMAT_TOGGLE_BOLD, 'cap.project.format.toggleBold'],
    [projectCommands.EXTRA_COMMAND_IDS.FORMAT_TOGGLE_ITALIC, 'cap.project.format.toggleItalic'],
    [projectCommands.EXTRA_COMMAND_IDS.FORMAT_TOGGLE_UNDERLINE, 'cap.project.format.toggleUnderline'],
    [projectCommands.EXTRA_COMMAND_IDS.LIST_TOGGLE_BULLET, 'cap.project.list.toggleBullet'],
    [projectCommands.EXTRA_COMMAND_IDS.LIST_TOGGLE_ORDERED, 'cap.project.list.toggleOrdered'],
    [projectCommands.EXTRA_COMMAND_IDS.LIST_CLEAR, 'cap.project.list.clear'],
    [projectCommands.EXTRA_COMMAND_IDS.INSERT_LINK_PROMPT, 'cap.project.insert.linkPrompt'],
  ]

  for (const [commandId, capabilityId] of expected) {
    assert.equal(capability.CAPABILITY_BINDING[commandId], capabilityId)
    assert.equal(capability.CAPABILITY_MATRIX.node[capabilityId], true)
    assert.equal(capability.CAPABILITY_MATRIX.web[capabilityId], true)
    assert.equal(capability.CAPABILITY_MATRIX['mobile-wrapper'][capabilityId], true)
    assert.deepEqual(capability.enforceCapabilityForCommand(commandId, { platformId: 'node', editorMode: 'tiptap' }), { ok: true })
    const legacy = capability.enforceCapabilityForCommand(commandId, { platformId: 'node', editorMode: 'legacy' })
    assert.equal(legacy.ok, false)
    assert.equal(legacy.error.reason, 'EDITOR_MODE_UNSUPPORTED')
  }
})

test('toolbar expansion wave a1: runtime bridge routes canonical TipTap rich command ids', async () => {
  const { createTiptapRuntimeBridge } = await loadRuntimeBridgeModule()
  const calls = []
  const editor = {
    isActive(type) {
      return type === 'bulletList'
    },
    commands: {
      toggleBold() {
        calls.push('toggleBold')
        return true
      },
      toggleItalic() {
        calls.push('toggleItalic')
        return true
      },
      toggleBulletList() {
        calls.push('toggleBulletList')
        return true
      },
      toggleOrderedList() {
        calls.push('toggleOrderedList')
        return true
      },
    },
  }
  const bridge = createTiptapRuntimeBridge({ editor })

  assert.equal(bridge.handleRuntimeCommand({ commandId: 'cmd.project.format.toggleBold' }).result.performed, true)
  assert.equal(bridge.handleRuntimeCommand({ commandId: 'cmd.project.format.toggleItalic' }).result.performed, true)
  assert.equal(bridge.handleRuntimeCommand({ commandId: 'cmd.project.list.toggleBullet' }).result.performed, true)
  assert.equal(bridge.handleRuntimeCommand({ commandId: 'cmd.project.list.toggleOrdered' }).result.performed, true)
  assert.deepEqual(bridge.handleRuntimeCommand({ commandId: 'cmd.project.list.clear' }).result, {
    performed: true,
    action: 'clearList',
    reason: null,
  })
  assert.deepEqual(calls, ['toggleBold', 'toggleItalic', 'toggleBulletList', 'toggleOrderedList', 'toggleBulletList'])
})
