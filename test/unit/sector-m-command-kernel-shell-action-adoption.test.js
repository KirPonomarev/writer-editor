const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const ROOT = path.resolve(__dirname, '..', '..')

function read(filePath) {
  return fs.readFileSync(path.join(ROOT, filePath), 'utf8')
}

async function loadProjectCommands() {
  return import(pathToFileURL(path.join(ROOT, 'src', 'renderer', 'commands', 'projectCommands.mjs')).href)
}

async function loadCapabilityPolicy() {
  return import(pathToFileURL(path.join(ROOT, 'src', 'renderer', 'commands', 'capabilityPolicy.mjs')).href)
}

function readBindingDoc() {
  return JSON.parse(read('docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json'))
}

test.skip('command kernel shell action adoption: projectCommands defines and registers all eight existing shell action ids', async () => {
  const source = read('src/renderer/commands/projectCommands.mjs')
  const projectCommands = await loadProjectCommands()

  assert.equal(projectCommands.EXTRA_COMMAND_IDS.VIEW_OPEN_SETTINGS, 'cmd.project.view.openSettings')
  assert.equal(projectCommands.EXTRA_COMMAND_IDS.VIEW_SAFE_RESET, 'cmd.project.view.safeReset')
  assert.equal(projectCommands.EXTRA_COMMAND_IDS.VIEW_RESTORE_LAST_STABLE, 'cmd.project.view.restoreLastStable')
  assert.equal(projectCommands.EXTRA_COMMAND_IDS.TOOLS_OPEN_DIAGNOSTICS, 'cmd.project.tools.openDiagnostics')
  assert.equal(projectCommands.EXTRA_COMMAND_IDS.REVIEW_OPEN_RECOVERY, 'cmd.project.review.openRecovery')
  assert.equal(projectCommands.EXTRA_COMMAND_IDS.PLAN_SWITCH_MODE, 'cmd.project.plan.switchMode')
  assert.equal(projectCommands.EXTRA_COMMAND_IDS.REVIEW_SWITCH_MODE, 'cmd.project.review.switchMode')
  assert.equal(projectCommands.EXTRA_COMMAND_IDS.WINDOW_SWITCH_MODE_WRITE, 'cmd.project.window.switchModeWrite')

  assert.ok(source.includes('id: EXTRA_COMMAND_IDS.VIEW_OPEN_SETTINGS,'))
  assert.ok(source.includes('id: EXTRA_COMMAND_IDS.VIEW_SAFE_RESET,'))
  assert.ok(source.includes('id: EXTRA_COMMAND_IDS.VIEW_RESTORE_LAST_STABLE,'))
  assert.ok(source.includes('id: EXTRA_COMMAND_IDS.TOOLS_OPEN_DIAGNOSTICS,'))
  assert.ok(source.includes('id: EXTRA_COMMAND_IDS.REVIEW_OPEN_RECOVERY,'))
  assert.ok(source.includes('id: EXTRA_COMMAND_IDS.PLAN_SWITCH_MODE,'))
  assert.ok(source.includes('id: EXTRA_COMMAND_IDS.REVIEW_SWITCH_MODE,'))
  assert.ok(source.includes('id: EXTRA_COMMAND_IDS.WINDOW_SWITCH_MODE_WRITE,'))
})

test.skip('command kernel shell action adoption: mode switch commands reuse one switchMode ui action with fixed modes', () => {
  const source = read('src/renderer/commands/projectCommands.mjs')

  assert.ok(source.includes("'switchMode',"))
  assert.ok(source.includes("EXTRA_COMMAND_IDS.PLAN_SWITCH_MODE,"))
  assert.ok(source.includes("EXTRA_COMMAND_IDS.REVIEW_SWITCH_MODE,"))
  assert.ok(source.includes("EXTRA_COMMAND_IDS.WINDOW_SWITCH_MODE_WRITE,"))
  assert.ok(source.includes("{ mode: 'plan' }"))
  assert.ok(source.includes("{ mode: 'review' }"))
  assert.ok(source.includes("{ mode: 'write' }"))
})

test.skip('command kernel shell action adoption: editor exposes required uiActions for shell actions and mode switching', () => {
  const source = read('src/renderer/editor.js')

  assert.ok(source.includes('openSettings: () => openSettingsModal(),'))
  assert.ok(source.includes('safeResetShell: () => performSafeResetShell(),'))
  assert.ok(source.includes('restoreLastStableShell: () => performRestoreLastStableShell(),'))
  assert.ok(source.includes('openDiagnostics: () => openDiagnosticsModal(),'))
  assert.ok(source.includes("openRecovery: () => openRecoveryModal('Recovery modal opened from menu'),"))
  assert.ok(source.includes('switchMode: (payload = {}) => {'))
  assert.ok(source.includes("if (mode === 'write' || mode === 'plan' || mode === 'review') {"))
  assert.ok(source.includes('applyMode(mode);'))
})

test.skip('command kernel shell action adoption: runtime and docs capability bindings match for eight shell action ids and platform matrix is explicit', async () => {
  const projectCommands = await loadProjectCommands()
  const capabilityPolicy = await loadCapabilityPolicy()
  const bindingDoc = readBindingDoc()
  const bindingMap = new Map(bindingDoc.items.map((item) => [item.commandId, item.capabilityId]))

  const expected = new Map([
    [projectCommands.EXTRA_COMMAND_IDS.VIEW_OPEN_SETTINGS, 'cap.project.view.openSettings'],
    [projectCommands.EXTRA_COMMAND_IDS.VIEW_SAFE_RESET, 'cap.project.view.safeReset'],
    [projectCommands.EXTRA_COMMAND_IDS.VIEW_RESTORE_LAST_STABLE, 'cap.project.view.restoreLastStable'],
    [projectCommands.EXTRA_COMMAND_IDS.TOOLS_OPEN_DIAGNOSTICS, 'cap.project.tools.openDiagnostics'],
    [projectCommands.EXTRA_COMMAND_IDS.REVIEW_OPEN_RECOVERY, 'cap.project.review.openRecovery'],
    [projectCommands.EXTRA_COMMAND_IDS.PLAN_SWITCH_MODE, 'cap.project.plan.switchMode'],
    [projectCommands.EXTRA_COMMAND_IDS.REVIEW_SWITCH_MODE, 'cap.project.review.switchMode'],
    [projectCommands.EXTRA_COMMAND_IDS.WINDOW_SWITCH_MODE_WRITE, 'cap.project.window.switchModeWrite'],
  ])

  for (const [commandId, capabilityId] of expected.entries()) {
    assert.equal(capabilityPolicy.CAPABILITY_BINDING[commandId], capabilityId)
    assert.equal(bindingMap.get(commandId), capabilityId)

    assert.equal(capabilityPolicy.CAPABILITY_MATRIX.node[capabilityId], true)
    assert.equal(capabilityPolicy.CAPABILITY_MATRIX.web[capabilityId], false)
    assert.equal(capabilityPolicy.CAPABILITY_MATRIX['mobile-wrapper'][capabilityId], false)
  }
})

test.skip('command kernel shell action adoption: out-of-scope surfaces remain unchanged by intent', () => {
  const mainSource = read('src/main.js')
  const preloadSource = read('src/preload.js')
  const tiptapSource = read('src/renderer/tiptap/index.js')
  const namespaceDoc = read('docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json')

  assert.ok(mainSource.includes("'cmd.project.view.openSettings': () => {"))
  assert.ok(preloadSource.includes('invokeUiCommandBridge: (request) => {'))
  assert.ok(tiptapSource.includes('invokeSaveLifecycleSignalBridge'))
  assert.ok(namespaceDoc.includes('"cmd.ui.theme.set"'))
})
