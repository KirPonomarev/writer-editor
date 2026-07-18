const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const ROOT = path.resolve(__dirname, '..', '..')
const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)

async function loadFlowModeModule() {
  return import(pathToFileURL(path.join(ROOT, 'src', 'renderer', 'commands', 'flowMode.mjs')).href)
}

async function loadEnvelopeModule() {
  return import(pathToFileURL(path.join(ROOT, 'src', 'renderer', 'documentContentEnvelope.mjs')).href)
}

function read(filePath) {
  return fs.readFileSync(path.join(ROOT, filePath), 'utf8')
}

test('S15 projection save maps each editable segment to one stable scene id and baseline hash', async () => {
  const flow = await loadFlowModeModule()
  const envelope = await loadEnvelopeModule()
  const refs = [
    {
      path: '/tmp/one.txt',
      sceneId: 'roman/01_one.txt',
      nodeId: 'tree-node-11111111111111111111111111111111',
      baselineHash: HASH_A,
      title: 'One',
      kind: 'scene',
      content: '',
    },
    {
      path: '/tmp/two.txt',
      sceneId: 'roman/02_two.txt',
      nodeId: 'tree-node-22222222222222222222222222222222',
      baselineHash: HASH_B,
      title: 'Two',
      kind: 'scene',
      content: '',
    },
  ]

  const payload = flow.buildFlowProjectionSavePayload('One\n\nAlpha edited\n\nTwo\n\nBeta edited\n', refs)

  assert.equal(payload.ok, true)
  assert.deepEqual(
    payload.scenes.map((scene) => [scene.sceneId, scene.nodeId, scene.baselineHash, scene.path]),
    [
      ['roman/01_one.txt', 'tree-node-11111111111111111111111111111111', HASH_A, '/tmp/one.txt'],
      ['roman/02_two.txt', 'tree-node-22222222222222222222222222222222', HASH_B, '/tmp/two.txt'],
    ],
  )
  assert.equal(envelope.parseObservablePayload(payload.scenes[0].content).text, 'Alpha edited')
  assert.equal(envelope.parseObservablePayload(payload.scenes[1].content).text, 'Beta edited')
})

test('S15 projection save blocks damaged and ambiguous scene boundaries before payload creation', async () => {
  const flow = await loadFlowModeModule()
  const refs = [
    { path: '/tmp/one.txt', sceneId: 'roman/01_one.txt', baselineHash: HASH_A, title: 'One', content: '' },
    { path: '/tmp/two.txt', sceneId: 'roman/02_two.txt', baselineHash: HASH_B, title: 'Two', content: '' },
  ]

  const damaged = flow.buildFlowProjectionSavePayload('One renamed\n\nAlpha\n\nTwo\n\nBeta\n', refs)
  assert.equal(damaged.ok, false)
  assert.equal(damaged.error.code, 'M15_FLOW_BOUNDARY_DAMAGED')
  assert.equal(damaged.error.reason, 'flow_boundary_damaged')

  const ambiguous = flow.buildFlowProjectionSavePayload('One\n\nAlpha\n\nTwo\n\ninside text\n\nTwo\n\nBeta\n', refs)
  assert.equal(ambiguous.ok, false)
  assert.equal(ambiguous.error.code, 'M15_FLOW_BOUNDARY_AMBIGUOUS')
  assert.equal(ambiguous.error.reason, 'flow_boundary_ambiguous')
})

test('S15 projection save blocks missing source and missing baseline hash with zero-write payloads', async () => {
  const flow = await loadFlowModeModule()

  const missingSource = flow.buildFlowProjectionSavePayload('One\n\nAlpha\n', [
    { path: '/tmp/one.txt', sceneId: 'roman/01_one.txt', baselineHash: HASH_A, title: 'One', missing: true, content: '' },
  ])
  assert.equal(missingSource.ok, false)
  assert.equal(missingSource.error.code, 'M15_FLOW_SCENE_MISSING')
  assert.equal(missingSource.error.reason, 'flow_scene_missing')

  const missingHash = flow.buildFlowProjectionSavePayload('One\n\nAlpha\n', [
    { path: '/tmp/one.txt', sceneId: 'roman/01_one.txt', title: 'One', content: '' },
  ])
  assert.equal(missingHash.ok, false)
  assert.equal(missingHash.error.code, 'M15_FLOW_SCENE_BASELINE_HASH_MISSING')
  assert.equal(missingHash.error.reason, 'flow_scene_baseline_hash_missing')
})

test('S15 renderer uses guarded projection save while keeping legacy marker save as fallback', () => {
  const source = read('src/renderer/editor.js')

  assert.ok(source.includes('buildFlowProjectionSavePayload,'))
  assert.ok(source.includes('? buildFlowProjectionSavePayload(getPlainText(), flowModeState.scenes)'))
  assert.ok(source.includes(': buildFlowSavePayload(getPlainText(), flowModeState.scenes);'))
  assert.ok(source.includes('baselineHash: scene.baselineHash'))
})

test('S15 main flow save validates stable ids and stale source hash before batch write', () => {
  const source = read('src/main.js')
  const saveStart = source.indexOf('async function handleFlowSaveV1(payloadRaw)')
  const saveEnd = source.indexOf('function extractNumericPrefix(name)')
  const saveSource = source.slice(saveStart, saveEnd)
  const staleIndex = saveSource.indexOf('flow_stale_source')
  const writeIndex = saveSource.indexOf('() => writeFlowSceneBatchAtomic({')

  assert.notEqual(saveStart, -1)
  assert.notEqual(saveEnd, -1)
  assert.ok(source.includes('baselineHash: missing ?'))
  assert.ok(saveSource.includes('M15_FLOW_SCENE_ID_MISMATCH'))
  assert.ok(saveSource.includes('M15_FLOW_NODE_ID_MISMATCH'))
  assert.ok(saveSource.includes('M15_FLOW_BASELINE_HASH_MISSING'))
  assert.ok(saveSource.includes('M15_FLOW_STALE_SOURCE'))
  assert.notEqual(staleIndex, -1)
  assert.notEqual(writeIndex, -1)
  assert.ok(staleIndex < writeIndex)
})
