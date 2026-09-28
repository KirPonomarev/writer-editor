'use strict';

// Bounded, lossless admission of baseline JFIF. Validate every entropy-coded
// block, not just SOF dimensions. No IDCT, transcoding, filesystem or platform
// decoder is needed to preserve the original compressed bytes. T.81 B/C/F.
const fail = code => { throw Error(`DOCUMENT_MEDIA_JPEG_${code}`); };
const need = (ok, code) => { if (!ok) fail(code); };

function exifOrientation(data) {
  need(data.length >= 14 && data.subarray(0, 6).equals(Buffer.from('Exif\0\0')), 'EXIF');
  const t = data.subarray(6), little = t.toString('ascii', 0, 2) === 'II';
  need(little || t.toString('ascii', 0, 2) === 'MM', 'EXIF_ENDIAN');
  const u16 = at => { need(at >= 0 && at + 2 <= t.length, 'EXIF_BOUNDS'); return little ? t.readUInt16LE(at) : t.readUInt16BE(at); };
  const u32 = at => { need(at >= 0 && at + 4 <= t.length, 'EXIF_BOUNDS'); return little ? t.readUInt32LE(at) : t.readUInt32BE(at); };
  need(u16(2) === 42, 'EXIF_HEADER');
  const start = u32(4); need(start >= 8, 'EXIF_BOUNDS');
  const count = u16(start); need(count <= 256 && start + 2 + count * 12 + 4 <= t.length, 'EXIF_BOUNDS');
  let orientation = 1, seen = false;
  const sizes = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];
  for (let i = 0; i < count; i++) {
    const at = start + 2 + i * 12, tag = u16(at), type = u16(at + 2), n = u32(at + 4);
    need(type > 0 && type < sizes.length && n > 0, 'EXIF_FIELD');
    const bytes = sizes[type] * n;
    if (bytes > 4) { const offset = u32(at + 8); need(offset >= 8 && offset + bytes <= t.length, 'EXIF_BOUNDS'); }
    if (tag === 0x112) {
      need(!seen && type === 3 && n === 1, 'EXIF_ORIENTATION'); seen = true; orientation = u16(at + 8);
    }
  }
  const next = u32(start + 2 + count * 12);
  need(next === 0 || (next >= 8 && next + 2 <= t.length), 'EXIF_BOUNDS');
  need(orientation === 1, 'ORIENTATION_UNSUPPORTED');
}

function inspectJpeg(bytes, limits) {
  need(Buffer.isBuffer(bytes), 'BYTES');
  need(bytes.length <= limits.bytes, 'BYTE_LIMIT');
  need(bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8, 'BYTES');
  let at = 2, frame = null, jfif = false, exif = false, restart = 0;
  const quant = new Map(), huffman = new Map();
  const marker = () => {
    need(at < bytes.length && bytes[at++] === 0xff, 'MARKER');
    while (at < bytes.length && bytes[at] === 0xff) at++;
    need(at < bytes.length && bytes[at] !== 0, 'MARKER');
    return bytes[at++];
  };
  const segment = () => {
    need(at + 2 <= bytes.length, 'TRUNCATED');
    const length = bytes.readUInt16BE(at); need(length >= 2 && at + length <= bytes.length, 'SEGMENT_SIZE');
    const data = bytes.subarray(at + 2, at + length); at += length; return data;
  };
  while (at < bytes.length) {
    const code = marker();
    need(![0xd8, 0xd9, 0x01].includes(code) && !(code >= 0xd0 && code <= 0xd7), 'MARKER_ORDER');
    const data = segment();
    if (code === 0xe0) {
      need(!jfif && data.length >= 14 && data.toString('ascii', 0, 5) === 'JFIF\0', 'JFIF');
      need(data[5] === 1 && data[6] <= 2 && data[7] <= 2 && data.readUInt16BE(8) > 0
        && data.readUInt16BE(10) > 0 && data.length === 14 + 3 * data[12] * data[13], 'JFIF');
      jfif = true;
    } else if (code === 0xe1) {
      need(!exif, 'EXIF_DUPLICATE'); exifOrientation(data); exif = true;
    } else if (code === 0xe2) {
      fail('ICC_OR_APP2_UNSUPPORTED');
    } else if (code === 0xee) {
      need(data.length === 12 && data.toString('ascii', 0, 5) === 'Adobe' && data[11] === 1, 'ADOBE_COLOR_UNSUPPORTED');
    } else if (code === 0xfe) {
      // Literal bounded comment bytes are preserved, never interpreted.
    } else if (code === 0xdb) {
      let p = 0; need(data.length > 0, 'QUANT_TABLE');
      while (p < data.length) {
        const info = data[p++]; need(info <= 3 && p + 64 <= data.length, 'QUANT_TABLE');
        const values = data.subarray(p, p + 64); need(values.every(value => value > 0), 'QUANT_TABLE');
        quant.set(info, values); p += 64;
      }
    } else if (code === 0xc4) {
      let p = 0; need(data.length > 0, 'HUFFMAN_TABLE');
      while (p < data.length) {
        const info = data[p++]; need((info >> 4) <= 1 && (info & 15) <= 1 && p + 16 <= data.length, 'HUFFMAN_TABLE');
        const counts = data.subarray(p, p + 16); p += 16;
        const total = counts.reduce((sum, value) => sum + value, 0);
        need(total > 0 && total <= 256 && p + total <= data.length, 'HUFFMAN_TABLE');
        const tables = Array.from({ length: 17 }, () => new Map()), seen = new Set(); let value = 0;
        for (let length = 1; length <= 16; length++) {
          for (let i = 0; i < counts[length - 1]; i++) {
            const symbol = data[p++];
            need(value < (2 ** length) - 1 && !seen.has(symbol), 'HUFFMAN_CODE'); seen.add(symbol);
            need((info >> 4) === 0 ? symbol <= 11 : symbol === 0 || symbol === 0xf0
              || ((symbol & 15) >= 1 && (symbol & 15) <= 10), 'HUFFMAN_SYMBOL');
            tables[length].set(value++, symbol);
          }
          value *= 2;
        }
        huffman.set(info, tables);
      }
    } else if (code === 0xc0) {
      need(!frame && data.length >= 9 && data[0] === 8, 'FRAME');
      const height = data.readUInt16BE(1), width = data.readUInt16BE(3), count = data[5];
      need([1, 3].includes(count), 'COLOR_UNSUPPORTED');
      need(data.length === 6 + 3 * count && width > 0 && height > 0, 'FRAME');
      need(width <= limits.dimension && height <= limits.dimension && width * height <= limits.pixels, 'PIXEL_LIMIT');
      const components = [];
      for (let i = 0; i < count; i++) {
        const p = 6 + i * 3, id = data[p], h = data[p + 1] >> 4, v = data[p + 1] & 15, q = data[p + 2];
        need(id === i + 1 && [1, 2].includes(h) && [1, 2].includes(v) && q <= 3, 'COMPONENT');
        need((count === 3 && i === 0) || (h === 1 && v === 1), 'SAMPLING_UNSUPPORTED');
        components.push({ id, h, v, q });
      }
      frame = { width, height, components };
    } else if (code === 0xdd) {
      need(data.length === 2, 'RESTART_INTERVAL'); restart = data.readUInt16BE(0);
    } else if (code === 0xda) {
      need(frame && jfif, 'FRAME_OR_JFIF_MISSING');
      const count = data[0]; need(count === frame.components.length && data.length === 1 + 2 * count + 3, 'SCAN_COMPONENTS');
      need(data.at(-3) === 0 && data.at(-2) === 63 && data.at(-1) === 0, 'SCAN_PARAMETERS');
      const seen = new Set(), scan = [];
      for (let i = 0; i < count; i++) {
        const id = data[1 + i * 2], selectors = data[2 + i * 2], dc = selectors >> 4, ac = selectors & 15;
        const component = frame.components.find(c => c.id === id);
        need(component && !seen.has(id) && dc <= 1 && ac <= 1 && quant.has(component.q)
          && huffman.has(dc) && huffman.has(0x10 + ac), 'SCAN_TABLES');
        seen.add(id); scan.push({ ...component, dc: huffman.get(dc), ac: huffman.get(0x10 + ac) });
      }
      let bits = 0, current = 0;
      const bit = () => {
        if (!bits) {
          need(at < bytes.length, 'ENTROPY_TRUNCATED'); current = bytes[at++];
          if (current === 0xff) { need(at < bytes.length && bytes[at++] === 0, 'ENTROPY_EARLY_MARKER'); }
          bits = 8;
        }
        return (current >> --bits) & 1;
      };
      const symbol = table => {
        let value = 0;
        for (let length = 1; length <= 16; length++) {
          value = value * 2 + bit();
          if (table[length].has(value)) return table[length].get(value);
        }
        fail('ENTROPY_CODE');
      };
      const skip = n => { for (let i = 0; i < n; i++) bit(); };
      const align = () => { need(!bits || (current & ((1 << bits) - 1)) === (1 << bits) - 1, 'ENTROPY_PADDING'); bits = 0; };
      const maxH = Math.max(...scan.map(c => c.h)), maxV = Math.max(...scan.map(c => c.v));
      const mcus = Math.ceil(frame.width / (8 * maxH)) * Math.ceil(frame.height / (8 * maxV));
      let restartIndex = 0;
      for (let mcu = 0; mcu < mcus; mcu++) {
        for (const component of scan) for (let block = 0; block < component.h * component.v; block++) {
          skip(symbol(component.dc));
          for (let k = 1; k < 64;) {
            const value = symbol(component.ac), run = value >> 4, size = value & 15;
            if (value === 0) break;
            if (!size) { need(run === 15 && k + 16 <= 64, 'ENTROPY_RUN'); k += 16; }
            else { k += run; need(k < 64, 'ENTROPY_RUN'); skip(size); k++; }
          }
        }
        if (restart && (mcu + 1) % restart === 0 && mcu + 1 < mcus) {
          align(); need(marker() === 0xd0 + (restartIndex++ % 8), 'RESTART_MARKER');
        }
      }
      align(); need(marker() === 0xd9 && at === bytes.length, 'END_OR_EXTRA_SCAN');
      return { width: frame.width, height: frame.height, mimeType: 'image/jpeg' };
    } else {
      fail('CODING_OR_METADATA_UNSUPPORTED');
    }
  }
  fail('SCAN_MISSING');
}

module.exports = { inspectJpeg };
