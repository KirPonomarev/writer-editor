'use strict';

// Pure, bounded canonical media data. No filesystem, DOM, network or authority.
const builtin = name => {
  const module = typeof process !== 'undefined' && typeof process.getBuiltinModule === 'function' ? process.getBuiltinModule(name) : null;
  if (!module) throw Error('DOCUMENT_MEDIA_NATIVE_VALIDATOR_UNAVAILABLE');
  return module;
};
const LIMITS = Object.freeze({ bytes: 4 * 1024 * 1024, pixels: 16 * 1024 * 1024, dimension: 8192, assets: 128, totalBytes: 16 * 1024 * 1024, placementPixels: 64 * 1024 * 1024 });
const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const KEYS = ['assetId', 'assetPath', 'sha256', 'mimeType', 'width', 'height', 'alt', 'displayName', 'dataBase64'];
const fail = code => { throw new Error(`DOCUMENT_MEDIA_${code}`); };
const hash = bytes => builtin('node:crypto').createHash('sha256').update(bytes).digest('hex');
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// PNG Third Edition: validate the actual chunk stream, CRCs, dimensions and
// bounded decompressed scanlines. Preserve original bytes, including metadata.
function inspectPng(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 57 || bytes.length > LIMITS.bytes
    || !bytes.subarray(0, 8).equals(SIGNATURE)) fail('PNG_BYTES');
  let offset = 8, header = null, palette = null, ended = false, idatEnded = false;
  const idats = [];
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) fail('PNG_TRUNCATED');
    const size = bytes.readUInt32BE(offset), end = offset + 12 + size;
    if (size > LIMITS.bytes || end > bytes.length) fail('PNG_CHUNK_SIZE');
    const type = bytes.toString('ascii', offset + 4, offset + 8), data = bytes.subarray(offset + 8, end - 4);
    if (!bytes.subarray(offset + 4, offset + 8).every(b => (b >= 65 && b <= 90) || (b >= 97 && b <= 122)) || type[2] !== type[2].toUpperCase()
      || crc32(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) fail('PNG_CHUNK_CRC');
    if (!header && type !== 'IHDR') fail('PNG_HEADER_ORDER');
    if (type === 'IHDR') {
      if (header || size !== 13) fail('PNG_HEADER');
      const width = data.readUInt32BE(0), height = data.readUInt32BE(4), depth = data[8], color = data[9];
      const depths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
      if (!width || !height || width > LIMITS.dimension || height > LIMITS.dimension || width * height > LIMITS.pixels
        || !depths[color]?.includes(depth) || data[10] !== 0 || data[11] !== 0 || data[12] > 1) fail('PNG_HEADER');
      header = { width, height, depth, color, interlace: data[12] };
    } else if (type === 'PLTE') {
      if (palette || idats.length || !size || size % 3 || size > 768 || [0, 4].includes(header.color)
        || (header.color === 3 && size / 3 > 2 ** header.depth)) fail('PNG_PALETTE');
      palette = data;
    } else if (type === 'IDAT') {
      if (idatEnded || (header.color === 3 && !palette)) fail('PNG_DATA_ORDER');
      idats.push(data);
    } else if (type === 'IEND') {
      if (size || !idats.length || end !== bytes.length) fail('PNG_END');
      ended = true;
    } else {
      if (type[0] === type[0].toUpperCase()) fail('PNG_UNKNOWN_CRITICAL_CHUNK');
      if (['acTL', 'fcTL', 'fdAT'].includes(type)) fail('ANIMATED_PNG_UNSUPPORTED');
      if (idats.length) idatEnded = true;
    }
    offset = end;
  }
  if (!ended) fail('PNG_END');
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[header.color];
  const passes = header.interlace ? [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]] : [[0, 0, 1, 1]];
  const rows = passes.map(([x, y, dx, dy]) => {
    const width = Math.max(0, Math.ceil((header.width - x) / dx)), height = Math.max(0, Math.ceil((header.height - y) / dy));
    return { height: width ? height : 0, stride: 1 + Math.ceil(width * channels * header.depth / 8) };
  });
  const expected = rows.reduce((sum, row) => sum + row.height * row.stride, 0);
  let raw;
  try {
    const compressed = Buffer.concat(idats), result = builtin('node:zlib').inflateSync(compressed, { maxOutputLength: expected + 1, info: true });
    if (result.engine.bytesWritten !== compressed.length) fail('PNG_COMPRESSED_TRAILING_BYTES');
    raw = result.buffer;
  }
  catch { fail('PNG_DECOMPRESSION'); }
  if (raw.length !== expected) fail('PNG_SCANLINE_SIZE');
  let cursor = 0;
  for (const row of rows) for (let y = 0; y < row.height; y++, cursor += row.stride) if (raw[cursor] > 4) fail('PNG_FILTER');
  return { width: header.width, height: header.height, mimeType: 'image/png', sha256: hash(bytes) };
}
function label(value, key) {
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/u.test(value)
    || /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/u.test(value)) fail(key);
  return value;
}
function createImageAttrs(bytes, { alt = '', displayName = '' } = {}) {
  const info = inspectPng(bytes);
  return { assetId: `sha256-${info.sha256}`, assetPath: `assets/media/${info.sha256}.png`, ...info,
    alt: label(alt, 'ALT'), displayName: label(displayName, 'NAME'), dataBase64: bytes.toString('base64') };
}
function validateImageAttrs(attrs) {
  if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs) || Object.keys(attrs).length !== KEYS.length
    || Object.keys(attrs).some(key => !KEYS.includes(key)) || typeof attrs.dataBase64 !== 'string'
    || attrs.dataBase64.length > Math.ceil(LIMITS.bytes / 3) * 4 || attrs.dataBase64.length % 4 !== 0 || /[^A-Za-z0-9+/=]/u.test(attrs.dataBase64)) fail('ATTRS');
  const bytes = Buffer.from(attrs.dataBase64, 'base64');
  if (bytes.toString('base64') !== attrs.dataBase64) fail('ATTRS');
  const expected = createImageAttrs(bytes, attrs);
  if (KEYS.some(key => attrs[key] !== expected[key])) fail('IDENTITY');
  return { attrs: expected, bytes };
}
function documentMedia(doc) {
  const assets = new Map(), placements = [], validatedByEncoding = new Map();
  let visited = 0, totalBytes = 0, referenceBytes = 0, placementPixels = 0;
  const visit = (node, position = [], parentType = '') => {
    if (++visited > 1000000 || position.length > 32) fail('DOCUMENT_BOUNDS');
    if (node?.type === 'image') {
      if (!['paragraph', 'heading'].includes(parentType) || node.content?.length || node.marks?.length) fail('IMAGE_SHAPE');
      const cached = validatedByEncoding.get(node.attrs?.dataBase64);
      const media = cached && typeof node.attrs === 'object' && !Array.isArray(node.attrs)
        && Object.keys(node.attrs).length === KEYS.length
        && KEYS.every(key => node.attrs[key] === cached.attrs[key]) ? cached : validateImageAttrs(node.attrs);
      validatedByEncoding.set(media.attrs.dataBase64, media);
      // Canonical nodes carry encoded bytes. Reuse must not evade the aggregate
      // serialized-document or decoded-pixel budget, even with one asset ID.
      referenceBytes += media.bytes.length;
      placementPixels += media.attrs.width * media.attrs.height;
      if (referenceBytes > LIMITS.totalBytes || placementPixels > LIMITS.placementPixels) fail('DOCUMENT_BOUNDS');
      if (!assets.has(media.attrs.assetId)) {
        totalBytes += media.bytes.length;
        if (totalBytes > LIMITS.totalBytes) fail('DOCUMENT_BOUNDS');
        assets.set(media.attrs.assetId, media);
      }
      if (assets.size > LIMITS.assets || placements.length >= 4096) fail('DOCUMENT_BOUNDS');
      placements.push({ position, ...media.attrs });
      return;
    }
    for (const [index, child] of (Array.isArray(node?.content) ? node.content : []).entries()) visit(child, [...position, index], node?.type);
  };
  visit(doc);
  return { assets: [...assets.values()], placements };
}
module.exports = { MEDIA_LIMITS: LIMITS, inspectPng, createImageAttrs, validateImageAttrs, documentMedia };
