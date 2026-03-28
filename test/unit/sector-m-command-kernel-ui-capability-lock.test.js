const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const ROOT = path.resolve(__dirname, '..', '..')

function readBindingDoc() {
  return JSON.parse(
    fs.readFileSync(path.join(ROOT, 'docs', 'OPS', 'STATUS', 'COMMAND_CAPABILITY_BINDING.json'), 'utf8'),
  )
}

async function loadCapabilityPolicy() {
  return import(pathToFileURL(path.join(ROOT, 'src', 'renderer', 'commands', 'capabilityPolicy.mjs')).href)
}

async function loadProjectCommands() {
  return import(pathToFileURL(path.join(ROOT, 'src', 'renderer', 'commands', 'projectCommands.mjs')).href)
}

test('command kernel ui capability lock: runtime binding includes existing cmd.ui command ids', async () => {
  const capabilityPolicy = await loadCapabilityPolicy()
  const projectCommands = await loadProjectCommands()

  assert.equal(capabilityPolicy.CAPABILITY_BINDING[projectCommands.UI_COMMAND_IDS.THEME_SET], 'cap.ui.theme.set')
  assert.equal(capabilityPolicy.CAPABILITY_BINDING[projectCommands.UI_COMMAND_IDS.FONT_SET], 'cap.ui.font.set')
  assert.equal(capabilityPolicy.CAPABILITY_BINDING[projectCommands.UI_COMMAND_IDS.FONT_SIZE_SET], 'cap.ui.fontSize.set')
})

test('command kernel ui capability lock: node allows cmd.ui capabilities and web-mobile stay disabled', async () => {
  const capabilityPolicy = await loadCapabilityPolicy()

  assert.equal(capabilityPolicy.CAPABILITY_MATRIX.node['cap.ui.theme.set'], true)
  assert.equal(capabilityPolicy.CAPABILITY_MATRIX.node['cap.ui.font.set'], true)
  assert.equal(capabilityPolicy.CAPABILITY_MATRIX.node['cap.ui.fontSize.set'], true)

  assert.equal(capabilityPolicy.CAPABILITY_MATRIX.web['cap.ui.theme.set'], false)
  assert.equal(capabilityPolicy.CAPABILITY_MATRIX.web['cap.ui.font.set'], false)
  assert.equal(capabilityPolicy.CAPABILITY_MATRIX.web['cap.ui.fontSize.set'], false)

  assert.equal(capabilityPolicy.CAPABILITY_MATRIX['mobile-wrapper']['cap.ui.theme.set'], false)
  assert.equal(capabilityPolicy.CAPABILITY_MATRIX['mobile-wrapper']['cap.ui.font.set'], false)
  assert.equal(capabilityPolicy.CAPABILITY_MATRIX['mobile-wrapper']['cap.ui.fontSize.set'], false)
})

test('command kernel ui capability lock: runtime and docs bindings match exactly for cmd.ui commands', async () => {
  const capabilityPolicy = await loadCapabilityPolicy()
  const projectCommands = await loadProjectCommands()
  const bindingDoc = readBindingDoc()
  const bindingMap = new Map(bindingDoc.items.map((item) => [item.commandId, item.capabilityId]))

  assert.equal(bindingMap.get(projectCommands.UI_COMMAND_IDS.THEME_SET), 'cap.ui.theme.set')
  assert.equal(bindingMap.get(projectCommands.UI_COMMAND_IDS.FONT_SET), 'cap.ui.font.set')
  assert.equal(bindingMap.get(projectCommands.UI_COMMAND_IDS.FONT_SIZE_SET), 'cap.ui.fontSize.set')

  assert.equal(
    capabilityPolicy.CAPABILITY_BINDING[projectCommands.UI_COMMAND_IDS.THEME_SET],
    bindingMap.get(projectCommands.UI_COMMAND_IDS.THEME_SET),
  )
  assert.equal(
    capabilityPolicy.CAPABILITY_BINDING[projectCommands.UI_COMMAND_IDS.FONT_SET],
    bindingMap.get(projectCommands.UI_COMMAND_IDS.FONT_SET),
  )
  assert.equal(
    capabilityPolicy.CAPABILITY_BINDING[projectCommands.UI_COMMAND_IDS.FONT_SIZE_SET],
    bindingMap.get(projectCommands.UI_COMMAND_IDS.FONT_SIZE_SET),
  )
})

test('command kernel ui capability lock: capability enforcement outcome matches platform policy', async () => {
  const capabilityPolicy = await loadCapabilityPolicy()
  const projectCommands = await loadProjectCommands()

  const nodeTheme = capabilityPolicy.enforceCapabilityForCommand(projectCommands.UI_COMMAND_IDS.THEME_SET, { platformId: 'node' })
  assert.equal(nodeTheme.ok, true)

  const webTheme = capabilityPolicy.enforceCapabilityForCommand(projectCommands.UI_COMMAND_IDS.THEME_SET, { platformId: 'web' })
  assert.equal(webTheme.ok, false)
  assert.equal(webTheme.error.code, 'E_CAPABILITY_DISABLED_FOR_COMMAND')

  const mobileFontSize = capabilityPolicy.enforceCapabilityForCommand(projectCommands.UI_COMMAND_IDS.FONT_SIZE_SET, { platformId: 'mobile-wrapper' })
  assert.equal(mobileFontSize.ok, false)
  assert.equal(mobileFontSize.error.code, 'E_CAPABILITY_DISABLED_FOR_COMMAND')
})
