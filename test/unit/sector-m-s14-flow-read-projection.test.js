const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const ROOT = path.resolve(__dirname, '..', '..')

async function loadFlowModeModule() {
  return import(pathToFileURL(path.join(ROOT, 'src', 'renderer', 'commands', 'flowMode.mjs')).href)
}

async function loadEnvelopeModule() {
  return import(pathToFileURL(path.join(ROOT, 'src', 'renderer', 'documentContentEnvelope.mjs')).href)
}

function read(filePath) {
  return fs.readFileSync(path.join(ROOT, filePath), 'utf8')
}

test('S14 flow read projection rebuilds text and order from source scenes without a stored flow document', async () => {
  const flow = await loadFlowModeModule()
  const envelope = await loadEnvelopeModule()
  const scenes = [
    {
      sceneId: 'roman/01_one.txt',
      nodeId: 'tree-node-11111111111111111111111111111111',
      title: 'One',
      kind: 'scene',
      content: envelope.composeObservablePayload({ doc: envelope.buildParagraphDocumentFromText('Alpha') }),
    },
    {
      sceneId: 'roman/02_two.txt',
      nodeId: 'tree-node-22222222222222222222222222222222',
      title: 'Two',
      kind: 'scene',
      content: envelope.composeObservablePayload({ doc: envelope.buildParagraphDocumentFromText('Beta\nGamma') }),
    },
  ]

  const projection = flow.composeFlowReadProjection(scenes)

  assert.equal(projection.ok, true)
  assert.equal(projection.text, 'One\n\nAlpha\n\nTwo\n\nBeta\nGamma\n')
  assert.equal(projection.partial, false)
  assert.deepEqual(projection.missingSceneIds, [])
  assert.deepEqual(
    projection.scenes.map((scene) => [scene.sceneId, scene.nodeId, scene.order]),
    [
      ['roman/01_one.txt', 'tree-node-11111111111111111111111111111111', 0],
      ['roman/02_two.txt', 'tree-node-22222222222222222222222222222222', 1],
    ],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(projection.scenes[0], 'path'), false)
})

test('S14 flow read projection keeps missing scenes partial and source jump exact by caret offset', async () => {
  const flow = await loadFlowModeModule()
  const projection = flow.composeFlowReadProjection([
    {
      sceneId: 'roman/01_one.txt',
      nodeId: 'tree-node-11111111111111111111111111111111',
      title: 'One',
      content: 'Alpha',
    },
    {
      sceneId: 'roman/02_missing.txt',
      nodeId: 'tree-node-22222222222222222222222222222222',
      title: 'Missing',
      missing: true,
      partial: true,
      content: '',
    },
  ])

  assert.equal(projection.partial, true)
  assert.deepEqual(projection.missingSceneIds, ['roman/02_missing.txt'])

  const first = flow.findFlowProjectionSceneAtOffset(projection, projection.text.indexOf('Alpha'))
  assert.equal(first.sceneId, 'roman/01_one.txt')
  assert.equal(first.nodeId, 'tree-node-11111111111111111111111111111111')
  assert.equal(first.missing, false)

  const missing = flow.findFlowProjectionSceneAtOffset(projection, projection.text.indexOf('[missing source scene]'))
  assert.equal(missing.sceneId, 'roman/02_missing.txt')
  assert.equal(missing.nodeId, 'tree-node-22222222222222222222222222222222')
  assert.equal(missing.missing, true)
})

test('S14 renderer opens continuous mode through read projection and exposes exact source jump', () => {
  const source = read('src/renderer/editor.js')

  assert.ok(source.includes('composeFlowReadProjection(scenes)'))
  assert.ok(source.includes("showEditorPanelFor('Непрерывно')"))
  assert.ok(source.includes('findFlowProjectionSceneAtOffset(flowModeState.projection, selection.start)'))
  assert.ok(source.includes("flowModeState.active && event.altKey && event.key === 'Enter'"))
  assert.ok(source.includes('clearFlowModeState();'))
})

test('S14 main flow open returns stable read descriptors and never writes missing projection files', () => {
  const source = read('src/main.js')
  const openStart = source.indexOf('async function handleFlowOpenV1()')
  const openEnd = source.indexOf('async function handleFlowSaveV1(payloadRaw)')
  const openSource = source.slice(openStart, openEnd)

  assert.ok(source.includes('async function buildFlowStableNodeIdMap()'))
  assert.ok(source.includes('function buildFlowSceneReadDescriptor(node, identity)'))
  assert.ok(source.includes('sceneId: descriptor.sceneId'))
  assert.ok(source.includes('nodeId: descriptor.nodeId'))
  assert.ok(source.includes('missing,'))
  assert.ok(source.includes('partial: missing,'))
  assert.notEqual(openStart, -1)
  assert.notEqual(openEnd, -1)
  assert.equal(openSource.includes("() => fileManager.writeFileAtomic(filePath, '')"), false)
})
