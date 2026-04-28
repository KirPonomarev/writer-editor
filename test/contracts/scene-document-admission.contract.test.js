const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = process.cwd();
const FIXTURES_DIR = path.join(ROOT, 'test', 'fixtures', 'scene-document-admission');
const MODULE_PATH = path.join(ROOT, 'src', 'core', 'sceneDocumentAdmission.mjs');

function readJsonFixture(basename) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, basename), 'utf8'));
}

async function loadSceneAdmission() {
  return import(pathToFileURL(MODULE_PATH).href);
}

test('scene document admission: valid minimal full empty and multi-block fixtures are accepted canonically', async () => {
  const admission = await loadSceneAdmission();
  const fixtureNames = [
    'scene-minimal.valid.json',
    'scene-full.valid.json',
    'scene-empty.valid.json',
    'scene-multi-block.valid.json',
  ];

  for (const basename of fixtureNames) {
    const source = readJsonFixture(basename);
    const result = admission.admitSceneDocument(source);

    assert.equal(result.ok, true, basename);
    assert.equal(result.status, 'accepted', basename);
    assert.equal(result.readOnly, false, basename);
    assert.equal(result.admitted, true, basename);
    assert.equal(result.scene.schemaVersion, admission.SCENE_DOCUMENT_SCHEMA_VERSION, basename);
    assert.equal(result.scene.id, source.id.trim(), basename);
    assert.equal(result.scene.title, source.title.trim(), basename);
    assert.equal(result.scene.order, source.order, basename);
    assert.deepEqual(result.hashInput, admission.buildSceneDocumentHashInput(result.scene), basename);
    assert.equal(result.admissionHashSha256, result.normalizedHashSha256, basename);
    assert.match(result.normalizedHashSha256, /^[0-9a-f]{64}$/u, basename);
  }
});

test('scene document admission: metadata stays inside boundary and is excluded from hash inputs', async () => {
  const admission = await loadSceneAdmission();
  const source = readJsonFixture('scene-full.valid.json');
  const result = admission.admitSceneDocument(source);

  assert.equal(result.ok, true);
  assert.deepEqual(result.scene.metadata, source.metadata);
  assert.deepEqual(admission.SCENE_DOCUMENT_HASH_FIELDS, [
    'schemaVersion',
    'id',
    'title',
    'order',
    'blocks',
  ]);
  assert.deepEqual(admission.SCENE_DOCUMENT_HASH_EXCLUDED_FIELDS, [
    'metadata',
    'unknownFields',
  ]);
  assert.equal(Object.prototype.hasOwnProperty.call(result.hashInput, 'metadata'), false);
});

test('scene document admission: invalid fixtures are rejected with focused field errors', async () => {
  const admission = await loadSceneAdmission();
  const expectations = new Map([
    ['scene-missing-id.invalid.json', 'E_SCENE_DOCUMENT_ID_REQUIRED'],
    ['scene-invalid-order.invalid.json', 'E_SCENE_DOCUMENT_ORDER_INVALID'],
    ['scene-invalid-schema-version.invalid.json', 'E_SCENE_DOCUMENT_SCHEMA_VERSION_INVALID'],
    ['scene-invalid-metadata.invalid.json', 'E_SCENE_DOCUMENT_METADATA_INVALID'],
    ['scene-unknown-field.invalid.json', 'E_SCENE_DOCUMENT_UNKNOWN_FIELD'],
    ['scene-invalid-block-field.invalid.json', 'E_SCENE_DOCUMENT_BLOCK_UNKNOWN_FIELD'],
  ]);

  for (const [basename, code] of expectations.entries()) {
    const result = admission.admitSceneDocument(readJsonFixture(basename));
    assert.equal(result.ok, false, basename);
    assert.equal(result.status, 'rejected', basename);
    assert.equal(result.readOnly, false, basename);
    assert.equal(result.admitted, false, basename);
    assert.equal(result.error.code, code, basename);
    assert.match(result.admissionHashSha256, /^[0-9a-f]{64}$/u, basename);
    assert.equal(result.normalizedHashSha256, '', basename);
  }
});

test('scene document admission: unknown schema version becomes read-only instead of rejection', async () => {
  const admission = await loadSceneAdmission();
  const source = readJsonFixture('scene-unknown-version.read-only.json');
  const result = admission.admitSceneDocument(source);

  assert.equal(result.ok, true);
  assert.equal(result.status, 'read-only');
  assert.equal(result.readOnly, true);
  assert.equal(result.admitted, false);
  assert.equal(result.scene, null);
  assert.equal(result.error.code, 'E_SCENE_DOCUMENT_SCHEMA_VERSION_UNSUPPORTED');
  assert.equal(result.error.details.schemaVersion, 2);
  assert.equal(result.error.details.supportedSchemaVersion, 1);
  assert.deepEqual(result.source, source);
});

test('scene document admission: scene id title order and block list feed the canonical hash input', async () => {
  const admission = await loadSceneAdmission();
  const source = readJsonFixture('scene-minimal.valid.json');
  const result = admission.admitSceneDocument(source);

  assert.equal(result.ok, true);
  assert.deepEqual(result.hashInput, {
    schemaVersion: 1,
    id: 'scene-minimal',
    title: 'Minimal Scene',
    order: 0,
    blocks: [
      {
        type: 'paragraph',
        text: 'Alpha',
      },
    ],
  });
});

test('scene document admission: acceptance hash stays stable when only excluded metadata changes', async () => {
  const admission = await loadSceneAdmission();
  const base = readJsonFixture('scene-full.valid.json');
  const variant = readJsonFixture('scene-full.valid.json');
  variant.metadata = {
    stage: 'published',
    notes: {
      owner: 'beta',
    },
    extra: true,
  };

  const first = admission.admitSceneDocument(base);
  const second = admission.admitSceneDocument(variant);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.normalizedHashSha256, second.normalizedHashSha256);
  assert.deepEqual(first.hashInput, second.hashInput);
});

test('scene document admission: rejection hash stays stable when only unknown-field values change', async () => {
  const admission = await loadSceneAdmission();
  const first = readJsonFixture('scene-unknown-field.invalid.json');
  const second = readJsonFixture('scene-unknown-field.invalid.json');
  second.extraField = {
    nested: 'changed',
  };
  second.metadata = {
    ignored: true,
  };

  const firstResult = admission.admitSceneDocument(first);
  const secondResult = admission.admitSceneDocument(second);

  assert.equal(firstResult.ok, false);
  assert.equal(secondResult.ok, false);
  assert.equal(firstResult.error.code, 'E_SCENE_DOCUMENT_UNKNOWN_FIELD');
  assert.equal(secondResult.error.code, 'E_SCENE_DOCUMENT_UNKNOWN_FIELD');
  assert.equal(firstResult.admissionHashSha256, secondResult.admissionHashSha256);
  assert.deepEqual(firstResult.hashInput, secondResult.hashInput);
});
