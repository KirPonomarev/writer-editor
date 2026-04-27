const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()
const contractsRoot = path.join(root, 'src', 'contracts')

function readContract(basename) {
  return fs.readFileSync(path.join(contractsRoot, basename), 'utf8')
}

test('longform public contracts remap: files exist in src contracts and stay shape only', () => {
  const expected = [
    'inline-range.contract.ts',
    'block.contract.ts',
    'scene.contract.ts',
    'longform-project.contract.ts',
  ]

  for (const basename of expected) {
    const filePath = path.join(contractsRoot, basename)
    assert.equal(fs.existsSync(filePath), true, `${basename} must exist`)
    const text = fs.readFileSync(filePath, 'utf8')

    assert.match(text, /export type /u, `${basename} must export types only`)
    assert.equal(/require\(/u.test(text), false, `${basename} must not require runtime modules`)
    assert.equal(/module\.exports/u.test(text), false, `${basename} must not use CommonJS exports`)
    assert.equal(/from\s+['"]electron['"]/u.test(text), false, `${basename} must not import electron`)
    assert.equal(/new\s+[A-Z_a-z]/u.test(text), false, `${basename} must not construct runtime objects`)
    assert.equal(/export const /u.test(text), false, `${basename} must not export runtime values`)
    assert.equal(/export function /u.test(text), false, `${basename} must not export runtime functions`)
  }
})

test('longform public contracts remap: shape fields and re-export surface are complete', () => {
  const inlineRange = readContract('inline-range.contract.ts')
  const block = readContract('block.contract.ts')
  const scene = readContract('scene.contract.ts')
  const project = readContract('longform-project.contract.ts')
  const indexText = readContract('index.ts')

  assert.match(inlineRange, /export type LongformInlineRange/u)
  assert.match(inlineRange, /kind: LongformInlineRangeKind/u)
  assert.match(inlineRange, /from: number/u)
  assert.match(inlineRange, /to: number/u)
  assert.match(inlineRange, /offsetUnit: LongformInlineRangeOffsetUnit/u)

  assert.match(block, /export type LongformBlock/u)
  assert.match(block, /type: LongformBlockType/u)
  assert.match(block, /text: string/u)
  assert.match(block, /inlineRanges: LongformInlineRange\[\]/u)

  assert.match(scene, /export type LongformScene/u)
  assert.match(scene, /title: string/u)
  assert.match(scene, /blocks: LongformBlock\[\]/u)
  assert.match(scene, /hash: string/u)

  assert.match(project, /export type LongformProjectManifest/u)
  assert.match(project, /sceneOrder: string\[\]/u)
  assert.match(project, /scenes: Record<string, LongformProjectManifestSceneEntry>/u)
  assert.match(project, /bookProfile: LongformBookProfile/u)
  assert.match(project, /compileProfile: LongformCompileProfile/u)
  assert.match(project, /manifestHash: string/u)

  assert.match(indexText, /LongformInlineRange/u)
  assert.match(indexText, /LongformBlock/u)
  assert.match(indexText, /LongformScene/u)
  assert.match(indexText, /LongformProjectManifest/u)
})
