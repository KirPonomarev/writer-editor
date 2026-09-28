const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { inspectPng, createImageAttrs, validateImageAttrs, documentMedia } = require('../../src/io/documentMedia');
const jpegFixtures = require('../fixtures/document-jpeg-fixtures.cjs');
const { inspectJpeg } = require('../../src/io/documentJpeg.js');
const { MEDIA_LIMITS } = require('../../src/io/documentMedia.js');
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
  assert.throws(() => inspectPng(Buffer.alloc(4 * 1024 * 1024 + 1)), /DOCUMENT_MEDIA_PNG_BYTE_LIMIT/);
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
  const invalidShapes = [Object.assign([], attrs), Object.assign(Object.create(attrs), Object.fromEntries(Object.keys(attrs).map((_, i) => ['unknown' + i, i])))];
  for (const bad of invalidShapes) assert.throws(() => documentMedia({ type: 'doc', content: [{ type: 'paragraph', content: [image, { type: 'image', attrs: bad }] }] }), /DOCUMENT_MEDIA_ATTRS/);
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

test('W3: intrinsic identity is independent of exact positive EMU placement size', () => {
  const { imageDisplaySize } = require('../../src/io/documentMedia');
  const legacy=createImageAttrs(png()), sized=createImageAttrs(png(),{displayWidthEmu:19051,displayHeightEmu:9526});
  assert.equal(sized.assetId,legacy.assetId);assert.equal(sized.sha256,legacy.sha256);
  assert.equal(sized.width,1);assert.equal(sized.height,1);
  assert.deepEqual(imageDisplaySize(sized),{cx:19051,cy:9526});
  assert.deepEqual(validateImageAttrs(sized).attrs,sized);
  assert.deepEqual(createImageAttrs(png(),{displayWidthEmu:9525,displayHeightEmu:9525}),legacy);
  assert.deepEqual(imageDisplaySize(legacy),{cx:9525,cy:9525});
  for(const value of [0,-1,NaN,Infinity,1.5,78028801,'9525',null])
    assert.throws(()=>createImageAttrs(png(),{displayWidthEmu:value,displayHeightEmu:9525}),/DOCUMENT_MEDIA_DISPLAY_EXTENT/);
  assert.throws(()=>createImageAttrs(png(),{displayWidthEmu:9525}),/DOCUMENT_MEDIA_DISPLAY_EXTENT/);
  for(const n of [1,78028800])assert.equal(imageDisplaySize(createImageAttrs(png(),{displayWidthEmu:n,displayHeightEmu:1})).cx,n);
});
test('W3: one binary has independent bounded placements and cannot evade display area budget',()=>{
  const attrs=n=>createImageAttrs(png(),{displayWidthEmu:n*9525,displayHeightEmu:n*9525});
  const doc=sizes=>({type:'doc',content:[{type:'paragraph',content:sizes.map(n=>({type:'image',attrs:attrs(n)}))}]});
  const graph=documentMedia(doc([1,2,3]));assert.equal(graph.assets.length,1);
  assert.deepEqual(graph.placements.map(a=>a.displayWidthEmu||a.width*9525),[9525,19050,28575]);
  assert.throws(()=>documentMedia(doc([8192,8192])),/DOCUMENT_MEDIA_DOCUMENT_BOUNDS/);
});

test('JPEG: independent grayscale, 4:4:4, optimized 4:2:0 and restart streams retain original bytes', () => {
  for (const name of ['rgb', 'gray', 'subsampled', 'restart']) {
    const bytes = jpegFixtures[name], attrs = createImageAttrs(bytes, { alt: 'Иллюстрация 🧭', displayName: 'book.jpeg' });
    assert.equal(attrs.mimeType, 'image/jpeg'); assert.equal(attrs.width, 19); assert.equal(attrs.height, 17);
    assert.match(attrs.assetPath, /^assets\/media\/[a-f0-9]{64}\.jpg$/u);
    assert.deepEqual(validateImageAttrs(attrs).bytes, bytes);
    assert.deepEqual(validateImageAttrs(attrs).attrs, attrs);
  }
});

test('JPEG: every truncation, trailing bytes and missing entropy is rejected, even with valid dimensions', () => {
  const bytes = jpegFixtures.rgb;
  for (let length = 0; length < bytes.length; length++) {
    assert.throws(() => inspectJpeg(bytes.subarray(0, length), MEDIA_LIMITS), /DOCUMENT_MEDIA_JPEG_/u, `prefix ${length}`);
  }
  assert.throws(() => createImageAttrs(Buffer.concat([bytes, Buffer.from([0])])), /DOCUMENT_MEDIA_JPEG_END/u);
  const scan = bytes.indexOf(Buffer.from([0xff, 0xda])), data = scan + 2 + bytes.readUInt16BE(scan + 2);
  const empty = Buffer.concat([bytes.subarray(0, data), Buffer.from([0xff, 0xd9])]);
  assert.throws(() => createImageAttrs(empty), /DOCUMENT_MEDIA_JPEG_ENTROPY/u);
  const extra = Buffer.concat([bytes.subarray(0, -2), Buffer.from([0]), bytes.subarray(-2)]);
  assert.throws(() => createImageAttrs(extra), /DOCUMENT_MEDIA_JPEG_/u);
});

test('JPEG: malformed quantization, Huffman, component and restart data cannot gain media identity', () => {
  const mutate = (source, marker, fn) => { const b = Buffer.from(source), at = b.indexOf(Buffer.from([0xff, marker])); assert.ok(at >= 0); fn(b, at + 4); return b; };
  const cases = [
    mutate(jpegFixtures.rgb, 0xdb, (b, p) => { b[p + 1] = 0; }),
    mutate(jpegFixtures.rgb, 0xc4, (b, p) => { b[p + 1] = 255; }),
    mutate(jpegFixtures.rgb, 0xc4, (b, p) => { b[p] = 0x22; }),
    mutate(jpegFixtures.rgb, 0xc0, (b, p) => { b[p + 7] = 0; }),
    mutate(jpegFixtures.rgb, 0xc0, (b, p) => { b[p + 9] = b[p + 6]; }),
    mutate(jpegFixtures.rgb, 0xda, (b, p) => { b[p + 2] = 0x33; }),
    mutate(jpegFixtures.rgb, 0xda, (b, p) => { b[p + 1] = 9; }),
  ];
  const badRestart = Buffer.from(jpegFixtures.restart), rst = badRestart.indexOf(Buffer.from([0xff, 0xd0]));
  assert.ok(rst > 0); badRestart[rst + 1] = 0xd3; cases.push(badRestart);
  for (const bytes of cases) assert.throws(() => createImageAttrs(bytes), /DOCUMENT_MEDIA_JPEG_/u);
});

test('JPEG: byte, dimension and pixel limit edges are checked before entropy traversal', () => {
  const bytes = jpegFixtures.rgb;
  for (const delta of [-1, 0, 1]) {
    const check = patch => inspectJpeg(bytes, { ...MEDIA_LIMITS, ...patch });
    for (const patch of [{ bytes: bytes.length + delta }, { pixels: 19 * 17 + delta }, { dimension: 19 + delta }]) {
      if (delta < 0) assert.throws(() => check(patch), /DOCUMENT_MEDIA_JPEG_(BYTE|PIXEL)_LIMIT/u);
      else assert.equal(check(patch).width, 19);
    }
  }
  const large = Buffer.from(bytes), sof = large.indexOf(Buffer.from([0xff, 0xc0]));
  large.writeUInt16BE(8193, sof + 7);
  assert.throws(() => createImageAttrs(large), /DOCUMENT_MEDIA_JPEG_PIXEL_LIMIT/u);
  assert.throws(() => inspectJpeg(Buffer.alloc(MEDIA_LIMITS.bytes + 1), MEDIA_LIMITS), /DOCUMENT_MEDIA_JPEG_BYTE_LIMIT/u);
});

function jpegApp(marker, data) {
  const head = Buffer.alloc(4); head[0] = 0xff; head[1] = marker; head.writeUInt16BE(data.length + 2, 2);
  return Buffer.concat([jpegFixtures.rgb.subarray(0, 2), head, data, jpegFixtures.rgb.subarray(2)]);
}
function exif(orientation = 1) {
  const t = Buffer.alloc(26); t.write('II'); t.writeUInt16LE(42, 2); t.writeUInt32LE(8, 4);
  t.writeUInt16LE(1, 8); t.writeUInt16LE(0x112, 10); t.writeUInt16LE(3, 12); t.writeUInt32LE(1, 14); t.writeUInt16LE(orientation, 18);
  return Buffer.concat([Buffer.from('Exif\0\0'), t]);
}
test('JPEG: metadata policy preserves identity orientation and rejects rotation, ICC and unqualified coding', () => {
  const bytes = jpegApp(0xe1, exif(1)); assert.deepEqual(validateImageAttrs(createImageAttrs(bytes)).bytes, bytes);
  for (const n of [0, 2, 3, 4, 5, 6, 7, 8, 9]) assert.throws(() => createImageAttrs(jpegApp(0xe1, exif(n))), /ORIENTATION_UNSUPPORTED/u);
  const malformed = exif(1); malformed.writeUInt32LE(0xffffffff, 10);
  assert.throws(() => createImageAttrs(jpegApp(0xe1, malformed)), /EXIF_BOUNDS/u);
  assert.throws(() => createImageAttrs(jpegApp(0xe2, Buffer.from('ICC_PROFILE\0'))), /ICC_OR_APP2_UNSUPPORTED/u);
  assert.throws(() => createImageAttrs(jpegFixtures.progressive), /CODING_OR_METADATA_UNSUPPORTED/u);
  assert.throws(() => createImageAttrs(jpegFixtures.cmyk), /COLOR_UNSUPPORTED/u);
});

test('JPEG: MIME, path and placement claims cannot override inspected identity; PNG and JPEG share budgets', () => {
  const attrs = createImageAttrs(jpegFixtures.rgb);
  for (const patch of [{ mimeType: 'image/png' }, { assetPath: attrs.assetPath.replace('.jpg', '.png') }, { width: 18 },
    { dataBase64: jpegFixtures.gray.toString('base64') }, { assetPath: '../../book.jpg' }, { orientation: 6 }]) {
    assert.throws(() => validateImageAttrs({ ...attrs, ...patch }), /DOCUMENT_MEDIA_/u);
  }
  const sized = createImageAttrs(jpegFixtures.rgb, { displayWidthEmu: 38101, displayHeightEmu: 28577 });
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [attrs, createImageAttrs(png()), sized].map(attrs => ({ type: 'image', attrs })) }] };
  const graph = documentMedia(doc); assert.equal(graph.assets.length, 2); assert.equal(graph.placements.length, 3);
  assert.equal(graph.placements[2].displayWidthEmu, 38101);
});
