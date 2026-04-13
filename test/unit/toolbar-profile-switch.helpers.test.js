const test = require('node:test')
const assert = require('node:assert/strict')
const { pathToFileURL } = require('node:url')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

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
  }
}

test('toolbar profile switch helper: v3 normalization preserves stored order and drops invalid ids', async () => {
  const profileState = await loadProfileState()

  assert.deepEqual(
    profileState.createToolbarProfileState(['toolbar.font.family', 'toolbar.font.family', 'toolbar.format.bold']),
    {
      version: 3,
      activeToolbarProfile: 'minimal',
      toolbarProfiles: {
        minimal: ['toolbar.font.family', 'toolbar.format.bold'],
        master: [],
      },
    },
  )

  const normalized = profileState.normalizeToolbarProfileState({
    version: 3,
    activeToolbarProfile: 'not-a-profile',
    toolbarProfiles: {
      minimal: [
        'toolbar.list.type',
        'toolbar.format.underline',
        'toolbar.font.family',
        'toolbar.font.family',
        'toolbar.history.undo',
        'toolbar.proofing.grammar',
        'toolbar.format.bold',
        'unknown-id',
      ],
      master: [
        'toolbar.history.redo',
        'toolbar.color.text',
        'toolbar.font.size',
        'toolbar.history.redo',
        'toolbar.insert.link',
      ],
    },
  })

  assert.deepEqual(normalized, {
    version: 3,
    activeToolbarProfile: 'minimal',
      toolbarProfiles: {
        minimal: [
          'toolbar.list.type',
          'toolbar.format.underline',
          'toolbar.font.family',
          'toolbar.history.undo',
          'toolbar.format.bold',
        ],
        master: [
          'toolbar.history.redo',
          'toolbar.font.size',
          'toolbar.insert.link',
        ],
      },
    })
})

test('toolbar profile switch helper: persisted v2 migrates once to v3 and preserves minimal order', async () => {
  const profileState = await loadProfileState()
  const storage = createMemoryStorage()

  storage.setItem('toolbarProfiles:project-v2', JSON.stringify({
    version: 2,
    toolbarProfiles: {
      minimal: [
        'toolbar.format.italic',
        'toolbar.font.family',
        'toolbar.font.weight',
        'toolbar.font.family',
      ],
    },
  }))

  const resolved = profileState.resolveToolbarProfileStateForProjectSwitch(storage, 'project-v2')

  assert.equal(resolved.source, 'persisted')
  assert.equal(resolved.shouldPersist, true)
  assert.deepEqual(resolved.state, {
    version: 3,
    activeToolbarProfile: 'minimal',
      toolbarProfiles: {
        minimal: [
          'toolbar.format.italic',
          'toolbar.font.family',
          'toolbar.font.weight',
        ],
        master: [
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
        ],
      },
  })
})

test('toolbar profile switch helper: legacy migration resolves directly to v3 shape', async () => {
  const profileState = await loadProfileState()
  const storage = createMemoryStorage()

  storage.setItem(profileState.TOOLBAR_PROFILE_LEGACY_STORAGE_KEY, JSON.stringify({
    master: ['Font Family', 'Font Size'],
    minimal: ['Line Height', 'Redo'],
  }))

  const resolved = profileState.resolveToolbarProfileStateForProjectSwitch(storage, 'project-legacy')

  assert.equal(resolved.source, 'legacy')
  assert.equal(resolved.shouldPersist, true)
  assert.deepEqual(resolved.state, {
    version: 3,
    activeToolbarProfile: 'minimal',
    toolbarProfiles: {
      minimal: [
        'toolbar.font.family',
        'toolbar.font.size',
        'toolbar.text.lineHeight',
        'toolbar.history.redo',
      ],
      master: [
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
      ],
    },
  })

  const lossy = profileState.migrateLegacyConfiguratorBuckets({
    master: ['Font Family', 'Color Background'],
    minimal: ['Font Family', 'New Slot'],
  })
  assert.equal(lossy.exactMatch, false)
  assert.equal(lossy.isLossy, true)
  assert.deepEqual(lossy.state, profileState.createCanonicalMinimalToolbarProfileState())

  const empty = profileState.migrateLegacyConfiguratorBuckets({
    master: [],
    minimal: [],
  })
  assert.equal(empty.exactMatch, false)
  assert.equal(empty.isLossy, false)
  assert.deepEqual(empty.state, profileState.createCanonicalMinimalToolbarProfileState())
})

test('toolbar profile switch helper: empty projectId resolves ephemeral v3 baseline without persistent write', async () => {
  const profileState = await loadProfileState()
  const storage = createMemoryStorage()

  const resolved = profileState.resolveToolbarProfileStateForProjectSwitch(storage, '')

  assert.equal(resolved.source, 'ephemeral')
  assert.equal(resolved.shouldPersist, false)
  assert.equal(resolved.shouldConsumeLegacySource, false)
  assert.deepEqual(resolved.state, profileState.createCanonicalMinimalToolbarProfileState())
  assert.equal(storage.has('toolbarProfiles:'), false)
})
