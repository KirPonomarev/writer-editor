const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { inspectPng, createImageAttrs, validateImageAttrs, documentMedia } = require('../../src/io/documentMedia');
// Test fixture encoder is independent of the production reader.
function crc(bytes) { let c = -1; for (const b of bytes) { c ^= b; for (let i = 0; i < 8; i++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; } return (c ^ -1) >>> 0; }
function chunk(type, data) { const b = Buffer.alloc(data.length + 12); b.writeUInt32BE(data.length); b.write(type, 4); data.copy(b, 8); b.writeUInt32BE(crc(b.subarray(4, -4)), b.length - 4); return b; }
function png(pixel = [255, 0, 0, 255], width = 1) {
  const h = Buffer.from([0,0,0,1,0,0,0,1,8,6,0,0,0]); h.writeUInt32BE(width);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', h), chunk('IDAT', zlib.deflateSync(Buffer.from([0,...pixel]))), chunk('IEND', Buffer.alloc(0))]);
}
test('PNG media retains byte identity, Unicode alt and repeated display names with distinct assets', () => {
  const red = createImageAttrs(png(), { alt: '紅 🧭 & <alt>', displayName: 'same.png' });
  const blue = createImageAttrs(png([0,0,255,255]), { alt: 'blue', displayName: 'same.png' });
  assert.notEqual(red.assetId, blue.assetId);
  assert.equal(red.width, 1); assert.equal(red.height, 1);
  assert.deepEqual(validateImageAttrs(red).bytes, png());
  assert.equal(validateImageAttrs(red).attrs.alt, '紅 🧭 & <alt>');
  const graph = documentMedia({ type: 'doc', content: [red, blue, red].map(attrs => ({ type: 'paragraph', content: [{ type: 'image', attrs }] })) });
  assert.equal(graph.assets.length, 2); assert.equal(graph.placements.length, 3);
  assert.deepEqual(graph.placements.map(p => p.position), [[0,0],[1,0],[2,0]]);
});
test('PNG rejects corruption, invalid dimensions, truncated stream, trailing bytes and decoded size mismatch', () => {
  const corrupt = png(); corrupt[42] ^= 1;
  for (const bytes of [corrupt, png().subarray(0, -1), Buffer.concat([png(), Buffer.from([0])]), png([1,2,3,4], 0), png([1,2,3,4], 8193), png([1,2,3,4], 2)]) {
    assert.throws(() => inspectPng(bytes), /DOCUMENT_MEDIA_/);
  }
});
test('Untrusted media attributes never create external paths or accept substituted bytes', () => {
  const attrs = createImageAttrs(png());
  for (const change of [{ assetPath: '../../escape.png' }, { assetPath: '/tmp/escape.png' }, { dataBase64: png([0,0,255,255]).toString('base64') }, { mimeType: 'image/svg+xml' }, { width: 3 }, { assetId: 'claimed' }, { src: 'https://example.test/image.png' }, { alt: '\u0000' }]) {
    assert.throws(() => validateImageAttrs({ ...attrs, ...change }), /DOCUMENT_MEDIA_/);
  }
});
test('PNG resource limit applies before decompression and malformed base64 cannot normalize into authority', () => {
  const attrs = createImageAttrs(png());
  assert.throws(() => validateImageAttrs({ ...attrs, dataBase64: attrs.dataBase64 + '\n' }), /DOCUMENT_MEDIA_ATTRS/);
  assert.throws(() => inspectPng(Buffer.alloc(4 * 1024 * 1024 + 1)), /DOCUMENT_MEDIA_PNG_BYTES/);
});

test('Media cannot silently disappear from unsupported node positions', () => {
  const image = { type: 'image', attrs: createImageAttrs(png()) };
  for (const type of ['doc', 'codeBlock', 'tableCell']) assert.throws(() => documentMedia({ type, content: [image] }), /DOCUMENT_MEDIA_IMAGE_SHAPE/);
});


test('repeated media cannot evade payload budgets through one content-addressed asset', () => {
  const original = png(), data = Buffer.concat([original.subarray(0, -12), chunk('tEXt', Buffer.alloc(1024 * 1024, 65)), original.subarray(-12)]);
  const attrs = createImageAttrs(data), image = { type: 'image', attrs };
  const doc = copies => ({ type: 'doc', content: [{ type: 'paragraph', content: Array(copies).fill(image) }] });
  assert.equal(documentMedia(doc(3)).assets.length, 1);
  assert.throws(() => documentMedia(doc(17)), /DOCUMENT_MEDIA_DOCUMENT_BOUNDS/);
  const arrayAttrs = Object.assign([], attrs);
  assert.throws(() => documentMedia({ type: 'doc', content: [{ type: 'paragraph', content: [image, { type: 'image', attrs: arrayAttrs }] }] }), /DOCUMENT_MEDIA_ATTRS/);
  const changed = { ...attrs, width: 2 };
  assert.throws(() => documentMedia({ type: 'doc', content: [{ type: 'paragraph', content: [image, { type: 'image', attrs: changed }] }] }), /DOCUMENT_MEDIA_IDENTITY/);
  const label = documentMedia({ type: 'doc', content: [{ type: 'paragraph', content: [image, { type: 'image', attrs: { ...attrs, alt: 'second placement' } }] }] });
  assert.equal(label.placements[1].alt, 'second placement');
});


test('decoded pixel budget counts every placement even when compressed bytes are small', () => {
  const header = Buffer.alloc(13); header.writeUInt32BE(4096, 0); header.writeUInt32BE(4096, 4); header[8] = 1;
  const bytes = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(Buffer.alloc(4096 * 513))), chunk('IEND', Buffer.alloc(0))]);
  const image = { type: 'image', attrs: createImageAttrs(bytes) };
  const doc = copies => ({ type: 'doc', content: [{ type: 'paragraph', content: Array(copies).fill(image) }] });
  assert.equal(documentMedia(doc(4)).placements.length, 4);
  assert.throws(() => documentMedia(doc(5)), /DOCUMENT_MEDIA_DOCUMENT_BOUNDS/);
});
