const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function readEditorSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8')
}

function readRuntimeBridgeSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'tiptap', 'runtimeBridge.js'), 'utf8')
}

test('save boundary truth sync: safe reset and restore shell handlers exist as active runtime path', () => {
  const source = readEditorSource()
  assert.ok(source.includes('function performSafeResetShell()'))
  assert.ok(source.includes('function performRestoreLastStableShell()'))
  assert.ok(source.includes("updateStatusText('Shell reset to baseline')"))
  assert.ok(source.includes('Restored last stable shell state'))
})

test('save boundary truth sync: runtime bridge keeps canonical safe-reset and restore command handling', () => {
  const bridgeSource = readRuntimeBridgeSource()
  const commands = [...bridgeSource.matchAll(/command === '([^']+)'/g)]
    .map((match) => match[1])
    .filter((command) => command !== 'string')

  assert.ok(commands.includes('safe-reset-shell'))
  assert.ok(commands.includes('restore-last-stable-shell'))
  assert.ok(bridgeSource.includes("if (commandId === 'cmd.project.view.safeReset')"))
  assert.ok(bridgeSource.includes("if (commandId === 'cmd.project.view.restoreLastStable')"))
})

test('save boundary truth sync: editor runtime handlers wire safe-reset and restore through tiptap bridge', () => {
  const source = readEditorSource()
  assert.ok(source.includes('setTiptapRuntimeHandlers({'))
  assert.ok(source.includes('safeResetShell: () => performSafeResetShell(),'))
  assert.ok(source.includes('restoreLastStableShell: () => performRestoreLastStableShell(),'))
})
