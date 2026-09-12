const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { deflateRawSync } = require('node:zlib');

const MODULE_PATH = path.join(process.cwd(), 'src/io/revisionBridge/index.mjs');
const DATA_DESCRIPTOR_FLAG = 0x0008;
const DATA_DESCRIPTOR_SIGNATURE = 0x08074b50;
const UTF8_NAME_FLAG = 0x0800;

async function loadBridge() {
  return import(pathToFileURL(MODULE_PATH).href);
}

const CRC32_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) !== 0 ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  return value >>> 0;
});

function crc32Bytes(input) {
  let value = 0xffffffff;
  for (const byte of input) value = CRC32_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function documentXml(text = 'Descriptor') {
  return Buffer.from(
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`,
    'utf8',
  );
}

function stylesXml() {
  return Buffer.from(
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>',
    'utf8',
  );
}

function normalizeEntry(entry) {
  const body = Buffer.isBuffer(entry.body) ? entry.body : Buffer.from(String(entry.body ?? ''), 'utf8');
  const method = entry.method ?? 8;
  const compressedBody = entry.compressedBody
    ?? (method === 8 ? deflateRawSync(body) : body);
  const descriptor = entry.descriptor !== false;
  const flags = entry.flags ?? (descriptor ? DATA_DESCRIPTOR_FLAG : 0);
  const centralCrc32 = entry.centralCrc32 ?? crc32Bytes(body);
  const centralCompressedSize = entry.centralCompressedSize ?? compressedBody.length;
  const centralByteSize = entry.centralByteSize ?? body.length;
  return {
    ...entry,
    name: entry.name,
    body,
    method,
    compressedBody,
    descriptor,
    flags,
    centralCrc32,
    centralCompressedSize,
    centralByteSize,
  };
}

function localFields(entry) {
  if (!entry.descriptor || entry.localFields === 'central') {
    return [entry.centralCrc32, entry.centralCompressedSize, entry.centralByteSize];
  }
  if (entry.localFields && typeof entry.localFields === 'object') {
    return [
      entry.localFields.crc32 ?? 0,
      entry.localFields.compressedSize ?? 0,
      entry.localFields.byteSize ?? 0,
    ];
  }
  return [0, 0, 0];
}

function descriptorBytes(entry) {
  if (!entry.descriptor) return Buffer.alloc(0);
  const signed = entry.signed !== false;
  const bytes = Buffer.alloc(signed ? 16 : 12);
  let cursor = 0;
  if (signed) {
    bytes.writeUInt32LE(entry.descriptorSignature ?? DATA_DESCRIPTOR_SIGNATURE, cursor);
    cursor += 4;
  }
  bytes.writeUInt32LE(entry.descriptorCrc32 ?? entry.centralCrc32, cursor);
  bytes.writeUInt32LE(entry.descriptorCompressedSize ?? entry.centralCompressedSize, cursor + 4);
  bytes.writeUInt32LE(entry.descriptorByteSize ?? entry.centralByteSize, cursor + 8);
  const truncateTo = entry.truncateDescriptorTo;
  return Number.isInteger(truncateTo) ? bytes.subarray(0, truncateTo) : bytes;
}

function localRecord(entry, offset) {
  const name = Buffer.from(entry.name, 'ascii');
  const extra = Buffer.from(entry.localExtra ?? []);
  const header = Buffer.alloc(30 + name.length + extra.length);
  const [localCrc32, localCompressedSize, localByteSize] = localFields(entry);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(entry.localFlags ?? entry.flags, 6);
  header.writeUInt16LE(entry.localMethod ?? entry.method, 8);
  header.writeUInt32LE(localCrc32 >>> 0, 14);
  header.writeUInt32LE(localCompressedSize >>> 0, 18);
  header.writeUInt32LE(localByteSize >>> 0, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(extra.length, 28);
  name.copy(header, 30);
  extra.copy(header, 30 + name.length);
  const gap = Buffer.alloc(entry.gapBytes ?? 0, 0xa5);
  return {
    ...entry,
    offset,
    bytes: Buffer.concat([header, entry.compressedBody, descriptorBytes(entry), gap]),
  };
}

function centralRecord(entry) {
  const name = Buffer.from(entry.name, 'ascii');
  const header = Buffer.alloc(46 + name.length);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(entry.centralFlags ?? entry.flags, 8);
  header.writeUInt16LE(entry.method, 10);
  header.writeUInt32LE(entry.centralCrc32 >>> 0, 16);
  header.writeUInt32LE(entry.centralCompressedSize >>> 0, 20);
  header.writeUInt32LE(entry.centralByteSize >>> 0, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt32LE((entry.centralLocalOffset ?? entry.offset) >>> 0, 42);
  name.copy(header, 46);
  return header;
}

function zipFixture(rawEntries, options = {}) {
  const locals = [];
  let offset = 0;
  for (const rawEntry of rawEntries) {
    const local = localRecord(normalizeEntry(rawEntry), offset);
    locals.push(local);
    offset += local.bytes.length;
  }
  const centralEntries = Array.isArray(options.centralOrder)
    ? options.centralOrder.map((index) => locals[index])
    : locals;
  const central = Buffer.concat(centralEntries.map(centralRecord));
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(locals.length, 8);
  end.writeUInt16LE(locals.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([Buffer.concat(locals.map((entry) => entry.bytes)), central, end]);
}

function sourceCodes(result) {
  const codes = [];
  const visit = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!value || typeof value !== 'object') return;
    if (typeof value.sourceCode === 'string') codes.push(value.sourceCode);
    for (const nested of Object.values(value)) visit(nested);
  };
  visit(result);
  return codes;
}

function assertStage02Source(result, sourceCode) {
  assert.equal(result.ok, false);
  assert.equal(result.code, 'STAGE02_DECLARATION_SCAN_UNAVAILABLE');
  assert.equal(sourceCodes(result).includes(sourceCode), true, JSON.stringify(result));
}

test('signed data descriptors pass hostile gate, content preview, and review-transport extraction', async () => {
  const bridge = await loadBridge();
  const bytes = zipFixture([
    { name: 'word/document.xml', body: documentXml('Signed') },
    { name: 'word/styles.xml', body: stylesXml(), signed: false },
  ]);

  const gate = bridge.inspectDocxHostileFileGateFromZipBytes(bytes);
  const preview = bridge.buildDocxContentPreviewFromZipBytes(bytes);
  const extraction = bridge.extractDocxReviewTransportPackagePartsFromZipBytes(bytes);

  assert.equal(gate.ok, true);
  assert.equal(gate.code, 'STAGE02_GATE_PASS');
  assert.equal(preview.ok, true);
  assert.equal(preview.code, 'DOCX_CONTENT_PREVIEW_READY');
  assert.equal(preview.contentPreview.paragraphs[0].text, 'Signed');
  assert.equal(extraction.ok, true);
  assert.equal(extraction.code, 'DOCX_REVIEW_TRANSPORT_PARTS_READY');
  assert.equal(extraction.parts['word/document.xml'].includes('Signed'), true);
  assert.equal(extraction.zipInventory.entries.every((entry) => entry.localCrc32 === entry.centralCrc32), true);
});

test('unsigned descriptors and Google-style all-zero local fields are accepted', async () => {
  const bridge = await loadBridge();
  const bytes = zipFixture([
    { name: 'word/document.xml', body: documentXml('Unsigned'), signed: false, localFields: 'zero' },
  ]);
  const gate = bridge.inspectDocxHostileFileGateFromZipBytes(bytes);
  const extraction = bridge.extractDocxReviewTransportPackagePartsFromZipBytes(bytes);

  assert.equal(gate.ok, true);
  assert.equal(extraction.ok, true);
  assert.equal(extraction.parts['word/document.xml'].includes('Unsigned'), true);
});

test('Google-style UTF-8-name metadata plus bit 3 is accepted without widening name policy', async () => {
  const bridge = await loadBridge();
  const googleStyle = zipFixture([
    {
      name: 'word/document.xml',
      body: documentXml('UTF-8 metadata'),
      flags: UTF8_NAME_FLAG | DATA_DESCRIPTOR_FLAG,
    },
  ]);
  const neighboringUnknownBit = zipFixture([
    {
      name: 'word/document.xml',
      body: documentXml('Unknown metadata'),
      flags: UTF8_NAME_FLAG | DATA_DESCRIPTOR_FLAG | 0x1000,
    },
  ]);

  assert.equal(bridge.inspectDocxHostileFileGateFromZipBytes(googleStyle).ok, true);
  assertStage02Source(
    bridge.inspectDocxHostileFileGateFromZipBytes(neighboringUnknownBit),
    'DOCX_ZIP_FLAGS_UNSUPPORTED',
  );
});

test('descriptor entries may repeat exact central CRC and sizes in the local header', async () => {
  const bridge = await loadBridge();
  const bytes = zipFixture([
    { name: 'word/document.xml', body: documentXml('Exact'), localFields: 'central' },
  ]);

  assert.equal(bridge.inspectDocxHostileFileGateFromZipBytes(bytes).ok, true);
  assert.equal(bridge.extractDocxReviewTransportPackagePartsFromZipBytes(bytes).ok, true);
});

test('bit 3 alone is valid for a stored entry but deflate option bits remain invalid for stored data', async () => {
  const bridge = await loadBridge();
  const stored = zipFixture([
    { name: 'word/document.xml', method: 0, body: documentXml('Stored') },
  ]);
  const storedWithDeflateOptions = zipFixture([
    { name: 'word/document.xml', method: 0, flags: DATA_DESCRIPTOR_FLAG | 0x0002, body: documentXml('Bad') },
  ]);

  assert.equal(bridge.inspectDocxHostileFileGateFromZipBytes(stored).ok, true);
  assertStage02Source(
    bridge.inspectDocxHostileFileGateFromZipBytes(storedWithDeflateOptions),
    'DOCX_ZIP_FLAGS_METHOD_UNSUPPORTED',
  );
});

test('descriptor CRC and both declared sizes must exactly match the central directory', async () => {
  const bridge = await loadBridge();
  const cases = [
    [{ descriptorCrc32: 0x10203040 }, 'DOCX_ZIP_DATA_DESCRIPTOR_CRC_MISMATCH'],
    [{ descriptorCompressedSize: 1 }, 'DOCX_ZIP_DATA_DESCRIPTOR_COMPRESSED_SIZE_MISMATCH'],
    [{ descriptorByteSize: 1 }, 'DOCX_ZIP_DATA_DESCRIPTOR_UNCOMPRESSED_SIZE_MISMATCH'],
  ];

  for (const [mutation, sourceCode] of cases) {
    const result = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
      { name: 'word/document.xml', body: documentXml(sourceCode), ...mutation },
    ]));
    assertStage02Source(result, sourceCode);
  }
});

test('truncated descriptors, gaps, and compressed-range overlap fail closed', async () => {
  const bridge = await loadBridge();
  const body = documentXml('Bounds');
  const compressedSize = deflateRawSync(body).length;
  const truncated = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', body, truncateDescriptorTo: 8 },
  ]));
  const gap = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', body, gapBytes: 1 },
  ]));
  const overlap = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', body, centralCompressedSize: compressedSize + 17 },
  ]));

  assertStage02Source(truncated, 'DOCX_ZIP_DATA_DESCRIPTOR_TRUNCATED');
  assertStage02Source(gap, 'DOCX_ZIP_LOCAL_RECORD_GAP');
  assertStage02Source(overlap, 'DOCX_ZIP_LOCAL_RECORD_OVERLAP');
});

test('mixed or nonmatching nonzero local descriptor fields fail closed', async () => {
  const bridge = await loadBridge();
  const body = documentXml('Local fields');
  const compressedSize = deflateRawSync(body).length;
  const mixed = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    {
      name: 'word/document.xml',
      body,
      localFields: { crc32: 0, compressedSize, byteSize: body.length },
    },
  ]));
  const nonmatching = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    {
      name: 'word/document.xml',
      body,
      localFields: { crc32: 0x10203040, compressedSize, byteSize: body.length },
    },
  ]));

  assertStage02Source(mixed, 'DOCX_ZIP_DATA_DESCRIPTOR_LOCAL_FIELDS_INVALID');
  assert.equal(nonmatching.code, 'RTK_ZIP_LOCAL_CENTRAL_MISMATCH');
});

test('unsigned signature-valued CRC is rejected as ambiguous rather than reinterpreted', async () => {
  const bridge = await loadBridge();
  const ambiguous = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    {
      name: 'word/document.xml',
      body: documentXml('Ambiguous'),
      signed: false,
      centralCrc32: DATA_DESCRIPTOR_SIGNATURE,
    },
  ]));

  assertStage02Source(ambiguous, 'DOCX_ZIP_DATA_DESCRIPTOR_AMBIGUOUS');
});

test('multi-entry boundaries are derived by local offset, and duplicate offsets are rejected', async () => {
  const bridge = await loadBridge();
  const entries = [
    { name: 'word/styles.xml', body: stylesXml(), signed: false },
    { name: 'word/document.xml', body: documentXml('Multi'), signed: true },
  ];
  const accepted = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture(entries, { centralOrder: [1, 0] }));
  const duplicateOffset = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    entries[0],
    { ...entries[1], centralLocalOffset: 0 },
  ]));

  assert.equal(accepted.ok, true);
  assertStage02Source(duplicateOffset, 'DOCX_ZIP_LOCAL_OFFSET_AMBIGUOUS');
});

test('encryption, unknown flags, ZIP64, traversal, and compression bombs remain blocked', async () => {
  const bridge = await loadBridge();
  const encrypted = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', body: documentXml('Encrypted'), flags: DATA_DESCRIPTOR_FLAG | 1 },
  ]));
  const unknown = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', body: documentXml('Unknown'), flags: DATA_DESCRIPTOR_FLAG | 0x0020 },
  ]));
  const zip64 = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', body: documentXml('Zip64'), centralByteSize: 0xffffffff },
  ]));
  const traversal = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: '../word/document.xml', body: documentXml('Traversal') },
  ]));
  const bomb = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', body: Buffer.from(`<root>${'a'.repeat(20000)}</root>`) },
  ]));

  assert.equal(encrypted.code, 'STAGE02_ENCRYPTED_ENTRY_PRESENT');
  assertStage02Source(unknown, 'DOCX_ZIP_FLAGS_UNSUPPORTED');
  assert.equal(zip64.ok, false);
  assert.equal(zip64.diagnostics.some((item) => item.sourceCode === 'DOCX_ZIP64_UNSUPPORTED'), true);
  assert.equal(traversal.code, 'STAGE02_PATH_TRAVERSAL_DETECTED');
  assert.equal(bomb.code, 'STAGE02_COMPRESSION_RATIO_EXCEEDED');
});

test('inflate and actual-CRC integrity checks remain active after descriptor admission', async () => {
  const bridge = await loadBridge();
  const body = documentXml('Integrity');
  const corruptDeflate = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', body, compressedBody: Buffer.from([1, 2, 3, 4]) },
  ]));
  const forgedCrc = bridge.extractDocxReviewTransportPackagePartsFromZipBytes(zipFixture([
    { name: 'word/document.xml', body, centralCrc32: 0x10203040 },
  ]));

  assertStage02Source(corruptDeflate, 'DOCX_ZIP_INFLATE_FAILED');
  assert.equal(forgedCrc.ok, false);
  assert.equal(forgedCrc.code, 'RTK_ZIP_CRC_MISMATCH');
});
