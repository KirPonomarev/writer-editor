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
  assert.equal(catalog.getToolbarFunctionCatalogEntryById('toolbar.font.family').labels.ru.panelLabel.includes('Шрифт'), true)
  assert.equal(Object.prototype.hasOwnProperty.call(catalog.getToolbarFunctionCatalogEntryById('toolbar.font.family'), 'label'), false)
})

test('toolbar foundation profile state: project-scoped storage, migration, and consume-once legacy behavior', async () => {
  const catalog = await loadCatalog()
  const profileState = await loadProfileState()
  const storage = createMemoryStorage()

  assert.equal(profileState.getToolbarProfileStorageKey(' project-1 '), 'toolbarProfiles:project-1')
  assert.equal(profileState.getToolbarProfileStorageKey(''), '')

  const seedState = profileState.createCanonicalMinimalToolbarProfileState()
  assert.deepEqual(seedState, {
    version: 2,
    toolbarProfiles: {
      minimal: catalog.TOOLBAR_CANONICAL_LIVE_ORDER,
    },
  })

  assert.equal(profileState.writeToolbarProfileState(storage, '', seedState), false)
  assert.equal(storage.dump().size, 0)

  const ephemeral = profileState.resolveToolbarProfileStateForProjectSwitch(storage, '')
  assert.equal(ephemeral.source, 'ephemeral')
  assert.equal(ephemeral.shouldPersist, false)
  assert.equal(ephemeral.shouldConsumeLegacySource, false)
  assert.deepEqual(ephemeral.state.toolbarProfiles.minimal, catalog.TOOLBAR_CANONICAL_LIVE_ORDER)

  assert.equal(profileState.writeToolbarProfileState(storage, 'project-1', seedState), true)
  assert.equal(
    storage.getItem('toolbarProfiles:project-1'),
    JSON.stringify(seedState),
  )

  const readBack = profileState.readToolbarProfileState(storage, 'project-1')
  assert.deepEqual(readBack, seedState)

  storage.setItem('toolbarProfiles:project-empty', JSON.stringify({
    version: 2,
    toolbarProfiles: { minimal: [] },
  }))
  assert.deepEqual(profileState.readToolbarProfileState(storage, 'project-empty'), {
    version: 2,
    toolbarProfiles: { minimal: [] },
  })

  storage.setItem(profileState.TOOLBAR_PROFILE_LEGACY_STORAGE_KEY, JSON.stringify({
    master: ['Font Family', 'Font Size'],
    minimal: ['Line Height', 'Redo'],
  }))

  const exactMigration = profileState.migrateLegacyConfiguratorBuckets({
    master: ['Font Family', 'Font Size'],
    minimal: ['Line Height', 'Redo'],
  })
  assert.equal(exactMigration.exactMatch, true)
  assert.equal(exactMigration.isLossy, false)
  assert.deepEqual(exactMigration.state.toolbarProfiles.minimal, [
    'toolbar.font.family',
    'toolbar.font.size',
    'toolbar.text.lineHeight',
    'toolbar.history.redo',
  ])

  const lossyMigration = profileState.migrateLegacyConfiguratorBuckets({
    master: ['Font Family', 'Color Background'],
    minimal: ['Font Family', 'New Slot', 'Unknown Label'],
  })
  assert.equal(lossyMigration.exactMatch, false)
  assert.equal(lossyMigration.isLossy, true)
  assert.deepEqual(lossyMigration.state.toolbarProfiles.minimal, [
    'toolbar.font.family',
  ])

  const resolvedFromLegacy = profileState.resolveToolbarProfileStateForProjectSwitch(storage, 'project-legacy')
  assert.equal(resolvedFromLegacy.source, 'legacy')
  assert.equal(resolvedFromLegacy.shouldConsumeLegacySource, true)
  assert.deepEqual(resolvedFromLegacy.state.toolbarProfiles.minimal, [
    'toolbar.font.family',
    'toolbar.font.size',
    'toolbar.text.lineHeight',
    'toolbar.history.redo',
  ])

  assert.equal(profileState.consumeLegacyConfiguratorBuckets(storage), true)
  assert.equal(storage.has(profileState.TOOLBAR_PROFILE_LEGACY_STORAGE_KEY), false)

  const resolvedAfterConsume = profileState.resolveToolbarProfileStateForProjectSwitch(storage, 'project-second')
  assert.equal(resolvedAfterConsume.source, 'seed')
  assert.equal(resolvedAfterConsume.shouldConsumeLegacySource, false)
  assert.deepEqual(resolvedAfterConsume.state.toolbarProfiles.minimal, catalog.TOOLBAR_CANONICAL_LIVE_ORDER)

  const storageWithEmpty = createMemoryStorage()
  storageWithEmpty.setItem('toolbarProfiles:project-empty', JSON.stringify({
    version: 2,
    toolbarProfiles: { minimal: [] },
  }))
  storageWithEmpty.setItem(profileState.TOOLBAR_PROFILE_LEGACY_STORAGE_KEY, JSON.stringify({
    master: ['Font Family'],
    minimal: ['Redo'],
  }))
  const preservedEmpty = profileState.resolveToolbarProfileStateForProjectSwitch(storageWithEmpty, 'project-empty')
  assert.equal(preservedEmpty.source, 'persisted')
  assert.deepEqual(preservedEmpty.state.toolbarProfiles.minimal, [])
  assert.equal(preservedEmpty.shouldConsumeLegacySource, true)

  const storageWithPersisted = createMemoryStorage()
  storageWithPersisted.setItem('toolbarProfiles:project-ready', JSON.stringify({
    version: 2,
    toolbarProfiles: { minimal: ['toolbar.font.family'] },
  }))
  storageWithPersisted.setItem(profileState.TOOLBAR_PROFILE_LEGACY_STORAGE_KEY, JSON.stringify({
    master: ['Font Family'],
    minimal: ['Redo'],
  }))
  const persistedWins = profileState.resolveToolbarProfileStateForProjectSwitch(storageWithPersisted, 'project-ready')
  assert.equal(persistedWins.source, 'persisted')
  assert.deepEqual(persistedWins.state.toolbarProfiles.minimal, ['toolbar.font.family'])
  assert.equal(persistedWins.shouldConsumeLegacySource, true)
})
