const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function read(filePath) {
  return fs.readFileSync(path.join(ROOT, filePath), 'utf8')
}

test('tiptap save lifecycle tail closure: index routes dirty signal through existing save lifecycle bridge', () => {
  const source = read('src/renderer/tiptap/index.js')

  assert.ok(source.includes("typeof window.electronAPI.invokeSaveLifecycleSignalBridge !== 'function'"))
  assert.ok(source.includes('window.electronAPI.invokeSaveLifecycleSignalBridge({'))
  assert.ok(source.includes("signalId: 'signal.localDirty.set'"))
  assert.ok(source.includes('payload: { state: Boolean(nextDirty) }'))
  assert.ok(source.includes('}).catch(() => {})'))

  assert.equal(source.includes('window.electronAPI.notifyDirtyState('), false)
})

test('tiptap save lifecycle tail closure: false and true dirty transitions remain unchanged in semantics', () => {
  const source = read('src/renderer/tiptap/index.js')

  assert.ok(source.includes('notifyDirtyState(false)'))
  assert.ok(source.includes('notifyDirtyState(true)'))
})

test('tiptap save lifecycle tail closure: autosave path is not opened in tiptap slice', () => {
  const source = read('src/renderer/tiptap/index.js')
  assert.equal(source.includes('requestAutoSave'), false)
})
