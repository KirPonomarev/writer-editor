'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const builder = () => require('../../scripts/build-atlas-language-resources.cjs');

function archive(name = 'owned.txt', bytes = Buffer.from('owned fixture')) {
  const filename = Buffer.from(name), crc = builder().crc32(bytes);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4);
  local.writeUInt32LE(crc, 14); local.writeUInt32LE(bytes.length, 18); local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(filename.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(0x314, 4); central.writeUInt16LE(20, 6);
  central.writeUInt32LE(crc, 16); central.writeUInt32LE(bytes.length, 20); central.writeUInt32LE(bytes.length, 24); central.writeUInt16LE(filename.length, 28);
  central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
  const body = Buffer.concat([local, filename, bytes]), directory = Buffer.concat([central, filename]);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(body.length, 16);
  return Buffer.concat([body, directory, end]);
}

test('resource builder: bounded ZIP parser independently checks the local bytes, CRC and roster', () => {
  const rows = builder().readZip(archive());
  assert.equal(rows.length, 1); assert.equal(rows[0].path, 'owned.txt');
  assert.equal(rows[0].bytes.toString(), 'owned fixture');
  const corrupt = archive(); corrupt[30 + 'owned.txt'.length] ^= 1;
  assert.throws(() => builder().readZip(corrupt), /E_ATLAS_RESOURCE_/u);
  assert.throws(() => builder().readZip(Buffer.concat([archive(), Buffer.from('unlisted tail')])), /E_ATLAS_RESOURCE_/u);
});

for (const name of ['../escape', '/absolute', 'a/../escape', 'a\\b', 'a//b', 'a/./b', 'a/ ', 'Cafe\u0301', 'a\0b']) {
  test('resource builder: refuse unsafe archive path ' + JSON.stringify(name), () => {
    assert.throws(() => builder().readZip(archive(name)), /E_ATLAS_RESOURCE_/u);
  });
}

test('resource builder: fixed source digest is checked before archive interpretation or output creation', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-resource-builder-'));
  const input = path.join(root, 'source'); fs.mkdirSync(input);
  const manifest = require('../../src/main/atlasLanguageResourcesV1.json');
  for (const row of manifest.inputs) fs.writeFileSync(path.join(input, row.filename), 'changed source');
  const output = path.join(root, 'output');
  await assert.rejects(builder().buildAtlasLanguageResources({ sourceDirectory: input, outputDirectory: output }), /E_ATLAS_RESOURCE_SOURCE_HASH/u);
  assert.equal(fs.existsSync(output), false);
});

test('resource builder: refuse replacement and output within the original source directory', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-resource-existing-'));
  fs.writeFileSync(path.join(root, 'protected'), 'original');
  await assert.rejects(builder().buildAtlasLanguageResources({ sourceDirectory: root, outputDirectory: root }), /E_ATLAS_RESOURCE_TARGET/u);
  await assert.rejects(builder().buildAtlasLanguageResources({ sourceDirectory: root, outputDirectory: path.join(root, 'nested') }), /E_ATLAS_RESOURCE_TARGET/u);
  assert.equal(hash(fs.readFileSync(path.join(root, 'protected'))), hash('original'));
});

function nativeNoticeFixture(expectedNoticeBytes, actualNoticeBytes = expectedNoticeBytes) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-native-notice-test-'));
  const sourceDirectory = path.join(root, 'original-inputs'); fs.mkdirSync(sourceDirectory);
  const noticeDirectory = path.join(root, 'separate-native-notices'); fs.mkdirSync(noticeDirectory);
  const manifest = structuredClone(require('../../src/main/atlasLanguageResourcesV1.json'));
  manifest.inputs = manifest.inputs.map(row => {
    // These finite archives have valid pinned bytes but cannot be decoded.
    // A rejected fifth input must be detected before any of their parsers run.
    const bytes = Buffer.from('deliberately undecodable original archive: ' + row.role);
    fs.writeFileSync(path.join(sourceDirectory, row.filename), bytes);
    return { ...row, byteLength: bytes.length, sha256: hash(bytes) };
  });
  const filename = 'ATLAS_NATIVE_SOURCE_NOTICES_01.zip';
  manifest.nativeNotices = { role: 'nativeNotices', filename, byteLength: expectedNoticeBytes.length,
    sha256: hash(expectedNoticeBytes), entryCount: 7 };
  const nativeNoticesArchive = path.join(noticeDirectory, filename);
  fs.writeFileSync(nativeNoticesArchive, actualNoticeBytes);
  // Load the complete production module with only immutable fixture pin data.
  // Its actual file reader, ZIP parser and output behavior are not replaced.
  const Module = require('node:module');
  const filenameBuilder = require.resolve('../../scripts/build-atlas-language-resources.cjs');
  const loaded = new Module(filenameBuilder, module);
  loaded.filename = filenameBuilder; loaded.paths = Module._nodeModulePaths(path.dirname(filenameBuilder));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = name => name === '../src/main/atlasLanguageResourcesV1.json' ? manifest : originalRequire(name);
  loaded._compile(fs.readFileSync(filenameBuilder, 'utf8'), filenameBuilder);
  return { assembler: loaded.exports, sourceDirectory, nativeNoticesArchive,
    outputDirectory: path.join(root, 'new-output'), actualNoticeBytes };
}

test('resource builder: refuse corrupt separate native notices before decoding original archives or creating output', async () => {
  const fixture = nativeNoticeFixture(Buffer.from('fixed expected notice bytes'), Buffer.from('changed native notice bytes'));
  await assert.rejects(fixture.assembler.buildAtlasLanguageResources(fixture), /E_ATLAS_RESOURCE_SOURCE_HASH/u);
  assert.equal(fs.existsSync(fixture.outputDirectory), false);
  assert.deepEqual(fs.readFileSync(fixture.nativeNoticesArchive), fixture.actualNoticeBytes);
});

test('resource builder: refuse traversal in the pinned native notice archive before decoding original archives or creating output', async () => {
  const fixture = nativeNoticeFixture(archive('../escape', Buffer.from('untrusted notice')));
  await assert.rejects(fixture.assembler.buildAtlasLanguageResources(fixture), /E_ATLAS_RESOURCE_ZIP_PATH/u);
  assert.equal(fs.existsSync(fixture.outputDirectory), false);
  assert.deepEqual(fs.readFileSync(fixture.nativeNoticesArchive), fixture.actualNoticeBytes);
});
