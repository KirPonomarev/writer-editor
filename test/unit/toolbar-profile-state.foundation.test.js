const test = require('node:test')
const assert = require('node:assert/strict')
const { pathToFileURL } = require('node:url')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

async function loadCatalog() {
  return import(pathToFileURL(path.join(ROOT, 'src', 'renderer', 'toolbar', 'toolbarFunctionCatalog.mjs')).href)
}

async function loadProfileState() {
  return import(pathToFileURL(path.join(ROOT, 'src', 'renderer', 'toolbar', 'toolbarProfileState.mjs')).href)
}

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
    has(key) {
      return data.has(key)
    },
    dump() {
      return new Map(data)
    },
  }
}

test('toolbar foundation catalog: live planned blocked filtering and canonical order are stable', async () => {
  const catalog = await loadCatalog()

  assert.deepEqual(catalog.TOOLBAR_CANONICAL_LIVE_ORDER, [
    'toolbar.font.family',
    'toolbar.font.weight',
    'toolbar.font.size',
    'toolbar.text.lineHeight',
    'toolbar.format.bold',
    'toolbar.format.italic',
    'toolbar.paragraph.alignment',
    'toolbar.list.type',
    'toolbar.history.undo',
    'toolbar.history.redo',
  ])

  assert.deepEqual(
    catalog.listLiveToolbarFunctionCatalogEntries().map((entry) => entry.id),
    catalog.TOOLBAR_CANONICAL_LIVE_ORDER,
  )
  assert.deepEqual(
    catalog.listToolbarFunctionCatalogEntriesByImplementationState('planned').map((entry) => entry.id),
    catalog.TOOLBAR_PLANNED_IDS,
  )
  assert.deepEqual(
    catalog.listToolbarFunctionCatalogEntriesByImplementationState('blocked').map((entry) => entry.id),
    catalog.TOOLBAR_BLOCKED_IDS,
  )
  assert.equal(catalog.getToolbarFunctionCatalogEntryById('toolbar.font.family').labels.ru.panelLabel, 'Шрифт')
  assert.equal(Object.prototype.hasOwnProperty.call(catalog.getToolbarFunctionCatalogEntryById('toolbar.font.family'), 'label'), false)
})

test('toolbar foundation profile state: project-scoped storage, v3 seed, and migration coverage', async () => {
  const catalog = await loadCatalog()
  const profileState = await loadProfileState()
  const storage = createMemoryStorage()

  assert.equal(profileState.getToolbarProfileStorageKey(' project-1 '), 'toolbarProfiles:project-1')
  assert.equal(profileState.getToolbarProfileStorageKey(''), '')

  const canonicalState = profileState.createCanonicalMinimalToolbarProfileState()
  assert.deepEqual(canonicalState, {
    version: 3,
    activeToolbarProfile: 'minimal',
    toolbarProfiles: {
      minimal: catalog.TOOLBAR_CANONICAL_LIVE_ORDER,
      master: catalog.TOOLBAR_CANONICAL_LIVE_ORDER,
    },
  })

  assert.equal(profileState.writeToolbarProfileState(storage, '', canonicalState), false)
  assert.equal(storage.dump().size, 0)

  const ephemeral = profileState.resolveToolbarProfileStateForProjectSwitch(storage, '')
  assert.equal(ephemeral.source, 'ephemeral')
  assert.equal(ephemeral.shouldPersist, false)
  assert.equal(ephemeral.shouldConsumeLegacySource, false)
  assert.deepEqual(ephemeral.state, canonicalState)

  assert.equal(profileState.writeToolbarProfileState(storage, 'project-1', canonicalState), true)
  assert.equal(storage.getItem('toolbarProfiles:project-1'), JSON.stringify(canonicalState))
  assert.deepEqual(profileState.readToolbarProfileState(storage, 'project-1'), canonicalState)

  storage.setItem('toolbarProfiles:project-empty', JSON.stringify({
    version: 3,
    activeToolbarProfile: 'master',
    toolbarProfiles: { minimal: [], master: [] },
  }))
  assert.deepEqual(profileState.readToolbarProfileState(storage, 'project-empty'), {
    version: 3,
    activeToolbarProfile: 'master',
    toolbarProfiles: { minimal: [], master: [] },
  })

  storage.setItem('toolbarProfiles:project-v2', JSON.stringify({
    version: 2,
    toolbarProfiles: {
      minimal: ['toolbar.font.size', 'toolbar.font.family', 'toolbar.font.family', 'toolbar.font.weight'],
    },
  }))
  const resolvedV2 = profileState.resolveToolbarProfileStateForProjectSwitch(storage, 'project-v2')
  assert.equal(resolvedV2.source, 'persisted')
  assert.equal(resolvedV2.shouldPersist, true)
  assert.deepEqual(resolvedV2.state, {
    version: 3,
    activeToolbarProfile: 'minimal',
    toolbarProfiles: {
      minimal: ['toolbar.font.size', 'toolbar.font.family', 'toolbar.font.weight'],
      master: catalog.TOOLBAR_CANONICAL_LIVE_ORDER,
    },
  })

  storage.setItem(profileState.TOOLBAR_PROFILE_LEGACY_STORAGE_KEY, JSON.stringify({
    master: ['Font Family', 'Font Size'],
    minimal: ['Line Height', 'Redo'],
  }))
  const resolvedFromLegacy = profileState.resolveToolbarProfileStateForProjectSwitch(storage, 'project-legacy')
  assert.equal(resolvedFromLegacy.source, 'legacy')
  assert.equal(resolvedFromLegacy.shouldPersist, true)
  assert.deepEqual(resolvedFromLegacy.state, {
    version: 3,
    activeToolbarProfile: 'minimal',
    toolbarProfiles: {
      minimal: [
        'toolbar.font.family',
        'toolbar.font.size',
        'toolbar.text.lineHeight',
        'toolbar.history.redo',
      ],
      master: catalog.TOOLBAR_CANONICAL_LIVE_ORDER,
    },
  })

  storage.setItem(profileState.TOOLBAR_PROFILE_LEGACY_STORAGE_KEY, JSON.stringify({
    master: ['Font Family', 'Color Background'],
    minimal: ['Font Family', 'New Slot', 'Unknown Label'],
  }))
  const resolvedFromLossyLegacy = profileState.resolveToolbarProfileStateForProjectSwitch(storage, 'project-lossy')
  assert.equal(resolvedFromLossyLegacy.source, 'seed')
  assert.equal(resolvedFromLossyLegacy.shouldPersist, true)
  assert.deepEqual(resolvedFromLossyLegacy.state, canonicalState)

  const storageWithPersisted = createMemoryStorage()
  storageWithPersisted.setItem('toolbarProfiles:project-ready', JSON.stringify({
    version: 3,
    activeToolbarProfile: 'master',
    toolbarProfiles: {
      minimal: [],
      master: ['toolbar.font.family'],
    },
  }))
  storageWithPersisted.setItem(profileState.TOOLBAR_PROFILE_LEGACY_STORAGE_KEY, JSON.stringify({
    master: ['Font Family'],
    minimal: ['Redo'],
  }))
  const persistedWins = profileState.resolveToolbarProfileStateForProjectSwitch(storageWithPersisted, 'project-ready')
  assert.equal(persistedWins.source, 'persisted')
  assert.equal(persistedWins.shouldPersist, false)
  assert.equal(persistedWins.shouldConsumeLegacySource, true)
  assert.deepEqual(persistedWins.state, {
    version: 3,
    activeToolbarProfile: 'master',
    toolbarProfiles: {
      minimal: [],
      master: ['toolbar.font.family'],
    },
  })
})
