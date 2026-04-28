const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = process.cwd();
const MODULE_PATH = path.join(ROOT, 'src', 'core', 'sceneBlockAdmission.mjs');

async function loadBlockAdmission() {
  return import(pathToFileURL(MODULE_PATH).href);
}

test('scene block admission: paragraph heading quote and break blocks are accepted canonically', async () => {
  const admission = await loadBlockAdmission();
  const cases = [
    {
      id: 'block-1',
      sceneId: 'scene-1',
      type: 'paragraph',
      text: 'Alpha',
    },
    {
      id: 'block-2',
      sceneId: 'scene-1',
      type: 'heading',
      text: 'Heading',
    },
    {
      id: 'block-3',
      sceneId: 'scene-1',
      type: 'blockquote',
      text: 'Quote',
      markRefs: ['m-1', 'm-2'],
    },
    {
      id: 'block-4',
      sceneId: 'scene-1',
      type: 'thematicBreak',
    },
  ];

  for (const source of cases) {
    const result = admission.admitSceneBlock(source, { sceneId: 'scene-1' });
    assert.equal(result.ok, true, source.type);
    assert.equal(result.admitted, true, source.type);
    assert.equal(result.block.id, source.id, source.type);
    assert.equal(result.block.sceneId, 'scene-1', source.type);
    assert.equal(result.block.type, source.type, source.type);
    assert.match(result.normalizedHashSha256, /^[0-9a-f]{64}$/u, source.type);
  }
});

test('scene block admission: parent scene mismatch is rejected', async () => {
  const admission = await loadBlockAdmission();
  const result = admission.admitSceneBlock(
    {
      id: 'block-parent-mismatch',
      sceneId: 'scene-2',
      type: 'paragraph',
      text: 'Alpha',
    },
    { sceneId: 'scene-1', index: 0 },
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'E_SCENE_BLOCK_PARENT_SCENE_MISMATCH');
});

test('scene block admission: invalid type text and mark refs are rejected deterministically', async () => {
  const admission = await loadBlockAdmission();

  const invalidType = admission.admitSceneBlock({
    id: 'block-invalid-type',
    sceneId: 'scene-1',
    type: 'list',
    text: 'Alpha',
  }, { sceneId: 'scene-1' });
  assert.equal(invalidType.ok, false);
  assert.equal(invalidType.error.code, 'E_SCENE_BLOCK_TYPE_INVALID');

  const invalidText = admission.admitSceneBlock({
    id: 'block-invalid-text',
    sceneId: 'scene-1',
    type: 'paragraph',
    text: 1,
  }, { sceneId: 'scene-1' });
  assert.equal(invalidText.ok, false);
  assert.equal(invalidText.error.code, 'E_SCENE_BLOCK_TEXT_INVALID');

  const invalidMarkRefs = admission.admitSceneBlock({
    id: 'block-invalid-markrefs',
    sceneId: 'scene-1',
    type: 'paragraph',
    text: 'Alpha',
    markRefs: ['m-1', ''],
  }, { sceneId: 'scene-1' });
  assert.equal(invalidMarkRefs.ok, false);
  assert.equal(invalidMarkRefs.error.code, 'E_SCENE_BLOCK_MARK_REFS_INVALID');
});

test('scene block admission: thematic break forbids nonempty text', async () => {
  const admission = await loadBlockAdmission();
  const result = admission.admitSceneBlock({
    id: 'block-break',
    sceneId: 'scene-1',
    type: 'thematicBreak',
    text: 'nope',
  }, { sceneId: 'scene-1' });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'E_SCENE_BLOCK_TEXT_FORBIDDEN');
});

test('scene block admission: hash stays stable when only duplicate mark refs repeat', async () => {
  const admission = await loadBlockAdmission();
  const first = admission.admitSceneBlock({
    id: 'block-hash',
    sceneId: 'scene-1',
    type: 'blockquote',
    text: 'Alpha',
    markRefs: ['m-1', 'm-2'],
  }, { sceneId: 'scene-1' });
  const second = admission.admitSceneBlock({
    id: 'block-hash',
    sceneId: 'scene-1',
    type: 'blockquote',
    text: 'Alpha',
    markRefs: ['m-1', 'm-2', 'm-2'],
  }, { sceneId: 'scene-1' });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.normalizedHashSha256, second.normalizedHashSha256);
});
