const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const {
  readFlowSceneBatchMarkers,
  writeFlowSceneBatchAtomic,
} = require('../../src/utils/flowSceneBatchAtomic')

function makeProjectRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

function writeScene(targetPath, content) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.writeFileSync(targetPath, content, 'utf8')
}

test('S16 flow batch atomic helper returns a commit receipt and clears recovery marker on success', async () => {
  const projectRoot = makeProjectRoot('sector-m-s16-flow-batch-receipt-')
  const sceneA = path.join(projectRoot, 'scenes', 'a.txt')
  const sceneB = path.join(projectRoot, 'scenes', 'b.txt')
  writeScene(sceneA, 'before-a\n')
  writeScene(sceneB, 'before-b\n')

  const result = await writeFlowSceneBatchAtomic({
    projectRoot,
    entries: [
      { path: sceneA, sceneId: 'roman/a.txt', content: 'after-a\n' },
      { path: sceneB, sceneId: 'roman/b.txt', content: 'after-b\n' },
    ],
  })

  assert.equal(result.ok, true, JSON.stringify(result, null, 2))
  assert.equal(result.value.receipt.operation, 'flow.batch.save.v1')
  assert.equal(result.value.receipt.committed, true)
  assert.equal(result.value.receipt.markerCleared, true)
  assert.equal(result.value.receipt.sceneCount, 2)
  assert.equal(result.value.receipt.entries.length, 2)
  assert.equal(result.value.receipt.entries[0].bytesWritten, Buffer.byteLength('after-a\n', 'utf8'))
  assert.match(result.value.receipt.entries[0].contentHash, /^[a-f0-9]{64}$/u)
  assert.deepEqual(await readFlowSceneBatchMarkers(projectRoot), [])
})

test('S16 main flow save returns pathless receipt and refreshed scene baselines after batch write', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'main.js'), 'utf8')
  const saveStart = source.indexOf('async function handleFlowSaveV1(payloadRaw)')
  const saveEnd = source.indexOf('function extractNumericPrefix(name)')
  const saveSource = source.slice(saveStart, saveEnd)

  assert.notEqual(saveStart, -1)
  assert.notEqual(saveEnd, -1)
  assert.ok(saveSource.includes("operation: 'flow.batch.save.v1'"))
  assert.ok(saveSource.includes('markerCleared: batchValue.receipt && batchValue.receipt.markerCleared === true'))
  assert.ok(saveSource.includes('scenes: receiptEntries'))
  assert.ok(saveSource.includes('reopenedScenes.push({'))
  assert.ok(saveSource.includes('baselineHash: computeHash(normalizeFlowTextInput(reopenedContent))'))
  assert.equal(saveSource.includes('path: scene.path,'), false)
})

test('S16 command and renderer refresh Flow state from successful save response', () => {
  const projectCommands = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'renderer', 'commands', 'projectCommands.mjs'), 'utf8')
  const editor = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'renderer', 'editor.js'), 'utf8')

  assert.ok(projectCommands.includes('receipt: bridged.receipt'))
  assert.ok(projectCommands.includes('scenes: Array.isArray(bridged.scenes) ? bridged.scenes : []'))
  assert.ok(editor.includes('const refreshedScenes = normalizeFlowSceneRefs(saveResult.value && saveResult.value.scenes);'))
  assert.ok(editor.includes('const nextProjection = refreshedScenes.length === flowModeState.scenes.length'))
  assert.ok(editor.includes('projection: nextProjection'))
})
