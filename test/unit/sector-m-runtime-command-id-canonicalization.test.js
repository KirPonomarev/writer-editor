const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function read(filePath) {
  return fs.readFileSync(path.join(ROOT, filePath), 'utf8')
}

async function loadRuntimeBridgeModule() {
  const filePath = path.join(ROOT, 'src', 'renderer', 'tiptap', 'runtimeBridge.js')
  const source = fs.readFileSync(filePath, 'utf8')
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`)
}

test('runtime command id canonicalization: main emits canonical commandId envelope for adopted runtime menu ids', () => {
  const source = read('src/main.js')

  assert.ok(source.includes('function sendCanonicalRuntimeCommand(commandId, payload = {}, legacyCommand = \'\') {'))
  assert.ok(source.includes('commandId,'))
  assert.ok(source.includes('envelope.command = legacyCommand;'))

  assert.ok(source.includes("sendCanonicalRuntimeCommand("))
  assert.ok(source.includes("'cmd.project.view.openSettings'"))
  assert.ok(source.includes("'cmd.project.view.safeReset'"))
  assert.ok(source.includes("'cmd.project.view.restoreLastStable'"))
  assert.ok(source.includes("'cmd.project.tools.openDiagnostics'"))
  assert.ok(source.includes("'cmd.project.review.openRecovery'"))
  assert.ok(source.includes("'cmd.project.insert.addCard'"))
  assert.ok(source.includes("'cmd.project.format.alignLeft'"))
  assert.ok(source.includes("'cmd.project.plan.switchMode'"))
  assert.ok(source.includes("'cmd.project.review.switchMode'"))
  assert.ok(source.includes("'cmd.project.window.switchModeWrite'"))

  assert.equal(source.includes("sendRuntimeCommand('open-settings'"), false)
  assert.equal(source.includes("sendRuntimeCommand('safe-reset-shell'"), false)
  assert.equal(source.includes("sendRuntimeCommand('restore-last-stable-shell'"), false)
  assert.equal(source.includes("sendRuntimeCommand('open-diagnostics'"), false)
  assert.equal(source.includes("sendRuntimeCommand('open-recovery'"), false)
  assert.equal(source.includes("sendRuntimeCommand('insert-add-card'"), false)
  assert.equal(source.includes("sendRuntimeCommand('format-align-left'"), false)
  assert.equal(source.includes("sendRuntimeCommand('switch-mode-plan'"), false)
  assert.equal(source.includes("sendRuntimeCommand('switch-mode-review'"), false)
  assert.equal(source.includes("sendRuntimeCommand('switch-mode-write'"), false)
})

test('runtime command id canonicalization: editor non-tiptap runtime consumer handles payload.commandId first for adopted ids', () => {
  const source = read('src/renderer/editor.js')

  assert.ok(source.includes('function handleCanonicalRuntimeCommandId(commandId) {'))
  assert.ok(source.includes('if (commandId === EXTRA_COMMAND_IDS.VIEW_OPEN_SETTINGS) {'))
  assert.ok(source.includes('if (commandId === EXTRA_COMMAND_IDS.VIEW_SAFE_RESET) {'))
  assert.ok(source.includes('if (commandId === EXTRA_COMMAND_IDS.VIEW_RESTORE_LAST_STABLE) {'))
  assert.ok(source.includes('if (commandId === EXTRA_COMMAND_IDS.TOOLS_OPEN_DIAGNOSTICS) {'))
  assert.ok(source.includes('if (commandId === EXTRA_COMMAND_IDS.REVIEW_OPEN_RECOVERY) {'))
  assert.ok(source.includes('if (commandId === EXTRA_COMMAND_IDS.INSERT_ADD_CARD) {'))
  assert.ok(source.includes('if (commandId === EXTRA_COMMAND_IDS.FORMAT_ALIGN_LEFT) {'))
  assert.ok(source.includes('if (commandId === EXTRA_COMMAND_IDS.PLAN_SWITCH_MODE) {'))
  assert.ok(source.includes('if (commandId === EXTRA_COMMAND_IDS.REVIEW_SWITCH_MODE) {'))
  assert.ok(source.includes('if (commandId === EXTRA_COMMAND_IDS.WINDOW_SWITCH_MODE_WRITE) {'))
  assert.ok(source.includes('const commandId = payload && typeof payload.commandId === \'string\' ? payload.commandId : \'\';'))
  assert.ok(source.includes('if (handleCanonicalRuntimeCommandId(commandId)) {'))

  assert.ok(source.includes("} else if (command === 'open-export-preview') {"))
})

test('runtime command id canonicalization: tiptap runtime bridge handles payload.commandId first for adopted ids and mode mapping', async () => {
  const { createTiptapRuntimeBridge } = await loadRuntimeBridgeModule()

  let settingsCalls = 0
  let safeResetCalls = 0
  let restoreCalls = 0
  let diagnosticsCalls = 0
  let recoveryCalls = 0
  let addCardCalls = 0
  let alignLeftCalls = 0
  const switchModes = []

  const bridge = createTiptapRuntimeBridge({
    runtimeHandlers: {
      openSettings() { settingsCalls += 1 },
      safeResetShell() { safeResetCalls += 1 },
      restoreLastStableShell() { restoreCalls += 1 },
      openDiagnostics() { diagnosticsCalls += 1 },
      openRecovery() { recoveryCalls += 1 },
      insertAddCard() { addCardCalls += 1 },
      formatAlignLeft() { alignLeftCalls += 1 },
      switchMode(mode) { switchModes.push(mode) },
    },
  })

  const ids = [
    'cmd.project.view.openSettings',
    'cmd.project.view.safeReset',
    'cmd.project.view.restoreLastStable',
    'cmd.project.tools.openDiagnostics',
    'cmd.project.review.openRecovery',
    'cmd.project.insert.addCard',
    'cmd.project.format.alignLeft',
    'cmd.project.plan.switchMode',
    'cmd.project.review.switchMode',
    'cmd.project.window.switchModeWrite',
  ]

  for (const commandId of ids) {
    const result = bridge.handleRuntimeCommand({ commandId })
    assert.equal(result.handled, true)
    assert.equal(result.commandId, commandId)
  }

  assert.equal(settingsCalls, 1)
  assert.equal(safeResetCalls, 1)
  assert.equal(restoreCalls, 1)
  assert.equal(diagnosticsCalls, 1)
  assert.equal(recoveryCalls, 1)
  assert.equal(addCardCalls, 1)
  assert.equal(alignLeftCalls, 1)
  assert.deepEqual(switchModes, ['plan', 'review', 'write'])
})

test('runtime command id canonicalization: out-of-scope surfaces remain compatible', () => {
  const mainSource = read('src/main.js')
  const projectCommandsSource = read('src/renderer/commands/projectCommands.mjs')
  const capabilitySource = read('src/renderer/commands/capabilityPolicy.mjs')
  const bindingDoc = read('docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json')
  const preloadSource = read('src/preload.js')
  const tiptapIndexSource = read('src/renderer/tiptap/index.js')

  assert.ok(mainSource.includes("sendCanonicalRuntimeCommand("))
  assert.ok(mainSource.includes("'open-export-preview'"))
  assert.ok(projectCommandsSource.includes("VIEW_OPEN_SETTINGS: 'cmd.project.view.openSettings'"))
  assert.ok(capabilitySource.includes("'cmd.project.view.openSettings': 'cap.project.view.openSettings'"))
  assert.ok(bindingDoc.includes('"commandId": "cmd.project.view.openSettings"'))
  assert.ok(preloadSource.includes('invokeUiCommandBridge: (request) => {'))
  assert.ok(tiptapIndexSource.includes('setTiptapRuntimeHandlers'))
})
