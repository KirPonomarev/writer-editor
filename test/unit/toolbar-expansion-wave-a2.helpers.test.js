const test = require('node:test')
const assert = require('node:assert/strict')
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

test('toolbar expansion wave a2: canonical seed includes underline and link but saved profiles are not auto backfilled', async () => {
  const catalog = await importModule(['src', 'renderer', 'toolbar', 'toolbarFunctionCatalog.mjs'])
  const profile = await importModule(['src', 'renderer', 'toolbar', 'toolbarProfileState.mjs'])
  const storage = createMemoryStorage()

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

  const seed = profile.createCanonicalMinimalToolbarProfileState()
  assert.deepEqual(seed.toolbarProfiles.minimal, catalog.TOOLBAR_CANONICAL_LIVE_ORDER)
  assert.deepEqual(seed.toolbarProfiles.master, catalog.TOOLBAR_CANONICAL_LIVE_ORDER)

  storage.setItem('toolbarProfiles:existing-v3', JSON.stringify({
    version: 3,
    activeToolbarProfile: 'master',
    toolbarProfiles: {
      minimal: ['toolbar.font.family'],
      master: ['toolbar.format.italic'],
    },
  }))

  const resolved = profile.resolveToolbarProfileStateForProjectSwitch(storage, 'existing-v3')
  assert.equal(resolved.source, 'persisted')
  assert.equal(resolved.shouldPersist, false)
  assert.deepEqual(resolved.state, {
    version: 3,
    activeToolbarProfile: 'master',
    toolbarProfiles: {
      minimal: ['toolbar.font.family'],
      master: ['toolbar.format.italic'],
    },
  })
})

test('toolbar expansion wave a2: command registry exposes underline and link prompt through UI action bridge', async () => {
  const projectCommands = await importModule(['src', 'renderer', 'commands', 'projectCommands.mjs'])
  const registered = new Map()
  const calls = []

  const registry = {
    registerCommand(meta, handler) {
      registered.set(meta.id, { meta, handler })
    },
  }

  projectCommands.registerProjectCommands(registry, {
    electronAPI: null,
    uiActions: {
      formatToggleUnderline(payload = {}) {
        calls.push({ kind: 'underline', payload })
        return { performed: true, source: 'ui-action' }
      },
      insertLinkPrompt(payload = {}) {
        calls.push({ kind: 'link', payload })
        return { performed: true, source: 'ui-action' }
      },
    },
  })

  const underlineEntry = registered.get(projectCommands.EXTRA_COMMAND_IDS.FORMAT_TOGGLE_UNDERLINE)
  assert.ok(underlineEntry, 'underline command must be registered')
  assert.equal(underlineEntry.meta.group, 'format')
  assert.equal(underlineEntry.meta.hotkey, 'Cmd/Ctrl+U')
  const underlineResult = await underlineEntry.handler()
  assert.equal(underlineResult.ok, true)

  const linkEntry = registered.get(projectCommands.EXTRA_COMMAND_IDS.INSERT_LINK_PROMPT)
  assert.ok(linkEntry, 'insert link command must be registered')
  assert.equal(linkEntry.meta.group, 'insert')
  assert.equal(linkEntry.meta.hotkey, 'Cmd/Ctrl+K')
  const linkPayload = { href: 'https://example.com' }
  const linkResult = await linkEntry.handler(linkPayload)
  assert.equal(linkResult.ok, true)

  assert.deepEqual(calls, [
    { kind: 'underline', payload: {} },
    { kind: 'link', payload: linkPayload },
  ])
})
