const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { deflateRawSync } = require('node:zlib');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = path.join(ROOT, 'src', 'io', 'revisionBridge', 'index.mjs');
const SECTION_START = '// RB_11_DOCX_CONTENT_PREVIEW_START';
const SECTION_END = '// RB_11_DOCX_CONTENT_PREVIEW_END';
const TTF_BYTES = fs.readFileSync(path.resolve(__dirname, '../../src/renderer/assets/fonts/Circe-Regular.ttf'));

async function loadBridge() {
  return import(pathToFileURL(MODULE_PATH).href);
}

function readBridgeSource() {
  return fs.readFileSync(MODULE_PATH, 'utf8');
}

function extractMarkedSection(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);
  assert.notEqual(start, -1, `missing marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing marker: ${endMarker}`);
  assert.ok(end > start, `marker order invalid: ${startMarker}`);
  return text.slice(start, end + endMarker.length);
}

function asciiBytes(value) {
  return Buffer.from(value, 'ascii');
}

function utf8Bytes(value) {
  return Buffer.from(value, 'utf8');
}

const CRC32_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  return value >>> 0;
});

function crc32Bytes(input) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function normalizeEntry(entry) {
  const body = Buffer.isBuffer(entry.body)
    ? entry.body
    : utf8Bytes(typeof entry.body === 'string' ? entry.body : '');
  const method = entry.method ?? 0;
  const compressedBody = method === 8 ? deflateRawSync(body) : body;
  const crc32 = entry.useRealCrc === true ? crc32Bytes(body) : 0;
  return {
    name: entry.name,
    flags: entry.flags ?? 0,
    method,
    body,
    compressedBody,
    byteSize: entry.byteSize ?? body.length,
    compressedSize: entry.compressedSize ?? compressedBody.length,
    localCrc32: entry.localCrc32 ?? entry.crc32 ?? crc32,
    centralCrc32: entry.centralCrc32 ?? entry.crc32 ?? crc32,
  };
}

function localRecord(entry, offset) {
  const normalized = normalizeEntry(entry);
  const name = asciiBytes(normalized.name);
  const header = Buffer.alloc(30 + name.length);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(normalized.flags, 6);
  header.writeUInt16LE(normalized.method, 8);
  header.writeUInt32LE(normalized.localCrc32, 14);
  header.writeUInt32LE(normalized.compressedSize, 18);
  header.writeUInt32LE(normalized.byteSize, 22);
  header.writeUInt16LE(name.length, 26);
  name.copy(header, 30);
  return {
    ...normalized,
    offset,
    bytes: Buffer.concat([header, normalized.compressedBody]),
  };
}

function centralRecord(entry) {
  const name = asciiBytes(entry.name);
  const header = Buffer.alloc(46 + name.length);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(entry.flags ?? 0, 8);
  header.writeUInt16LE(entry.method, 10);
  header.writeUInt32LE(entry.centralCrc32, 16);
  header.writeUInt32LE(entry.compressedSize, 20);
  header.writeUInt32LE(entry.byteSize, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt32LE(entry.offset, 42);
  name.copy(header, 46);
  return header;
}

function zipFixture(entries) {
  const locals = [];
  let offset = 0;
  for (const entry of entries) {
    const local = localRecord(entry, offset);
    locals.push(local);
    offset += local.bytes.length;
  }
  const central = Buffer.concat(locals.map((entry) => centralRecord(entry)));
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(locals.length, 8);
  end.writeUInt16LE(locals.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([Buffer.concat(locals.map((entry) => entry.bytes)), central, end]);
}

function documentXml(body) {
  return `<w:document><w:body>${body}</w:body></w:document>`;
}

function contentTypesXml() {
  return '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
}

function fontContentTypesXml(contentType = 'application/x-font-ttf') {
  return `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="ttf" ContentType="${contentType}"/></Types>`;
}

function fontRelationshipsXml(target = 'fonts/font1.ttf') {
  return `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rFont1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="${target}"/></Relationships>`;
}

test('DOCX font admission: independent S11 OPC XML and SFNT boundary controls', async (t) => {
  const bridge = await loadBridge();
  const ctNs = 'http://schemas.openxmlformats.org/package/2006/content-types';
  const relNs = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const ct = fontContentTypesXml();
  const rels = fontRelationshipsXml();
  const mutateFont = (change) => {
    const copy = Buffer.from(TTF_BYTES);
    return change(copy) || copy;
  };
  const headRecord = Array.from({ length: TTF_BYTES.readUInt16BE(4) }, (_, i) => 12 + i * 16)
    .find((offset) => TTF_BYTES.toString('ascii', offset, offset + 4) === 'head');
  assert.notEqual(headRecord, undefined);
  const cases = [
    ['ct-multiple-roots', { ct: ct + `<Types xmlns="${ctNs}"/>` }],
    ['ct-wrong-root-canonical-child', { ct: `<Envelope xmlns="urn:evil"><Default xmlns="${ctNs}" Extension="ttf" ContentType="application/x-font-ttf"/></Envelope>` }],
    ['rels-wrong-root-canonical-child', { rels: rels.replace('<Relationships ', '<Envelope ').replace('</Relationships>', '</Envelope>') }],
    ['ct-no-namespace', { ct: ct.replace(` xmlns="${ctNs}"`, '') }],
    ['rels-no-namespace', { rels: rels.replace(` xmlns="${relNs}"`, '') }],
    ['ct-duplicate-default-xmlns', { ct: ct.replace('<Types ', `<Types xmlns="${ctNs}" `) }],
    ['rels-duplicate-default-xmlns', { rels: rels.replace('<Relationships ', `<Relationships xmlns="${relNs}" `) }],
    ['ct-trailing-garbage', { ct: ct + 'GARBAGE' }],
    ['rels-trailing-garbage', { rels: rels + 'GARBAGE' }],
    ['ct-invalid-utf8-comment', { ct: Buffer.concat([Buffer.from(ct + '<!--'), Buffer.from([0xc3, 0x28]), Buffer.from('-->')]) }],
    ['rels-invalid-utf8-comment', { rels: Buffer.concat([Buffer.from(rels + '<!--'), Buffer.from([0xc3, 0x28]), Buffer.from('-->')]) }],
    ['ct-unescaped-less-than-attribute', { ct: ct.replace('<Types ', '<Types Note="<" ') }],
    ['font-offset-past-eof', { font: mutateFont((f) => { f.writeUInt32BE(f.length + 4096, 20); }) }],
    ['font-length-overflow', { font: mutateFont((f) => { f.writeUInt32BE(0xffffffff, 24); }) }],
    ['font-duplicate-table-tag', { font: mutateFont((f) => { f.copy(f, 28, 12, 16); }) }],
    ['font-required-head-removed', { font: mutateFont((f) => { f.write('xxxx', headRecord, 'ascii'); }) }],
    ['font-head-magic-corrupt', { font: mutateFont((f) => { f.write('BAD!', f.readUInt32BE(headRecord + 8) + 12, 'ascii'); }) }],
    ['font-truncated-after-directory', { font: TTF_BYTES.subarray(0, 12 + TTF_BYTES.readUInt16BE(4) * 16) }],
    ['ct-nested-default', { ct: ct.replace('<Default ', '<Default Extension="xml" ContentType="application/xml"><Default ').replace('/></Types>', '/></Default></Types>') }],
    ['rels-nested-relationship', { rels: rels.replace('<Relationship ', '<Relationship Id="outer" Type="urn:other" Target="fontTable.xml"><Relationship ').replace('/></Relationships>', '/></Relationship></Relationships>') }],
    ['ct-mismatched-closing-prefix', { ct: ct.replace('<Types ', `<a:Types xmlns:a="${ctNs}" xmlns:b="${ctNs}" `).replace('</Types>', '</b:Types>') }],
    ['ct-attribute-without-separator', { ct: ct.replace('" ContentType=', '"ContentType=') }],
    ['ct-invalid-entity', { ct: ct.replace('Extension="ttf"', 'Extension="ttf" Note="&bogus;"') }],
    ['ct-invalid-comment', { ct: ct.replace('<Default ', '<!-- invalid -- comment --><Default ') }],
    ['ct-cdata-outside-root', { ct: '<![CDATA[ignored]]>' + ct }],
    ['ct-late-xml-declaration', { ct: ct + '<?xml version="1.0"?>' }],
    ['ct-duplicate-default-entry', { ct: ct.replace('</Types>', '<Default Extension="ttf" ContentType="application/x-font-ttf"/></Types>') }],
    ['rels-duplicate-id', { rels: rels.replace('</Relationships>', '<Relationship Id="rFont1" Type="urn:other" Target="fontTable.xml"/></Relationships>') }],
    ['font-table-inside-directory', { font: mutateFont((f) => { f.writeUInt32BE(12, 20); }) }],
    ['font-overlapping-tables', { font: mutateFont((f) => { f.writeUInt32BE(f.readUInt32BE(36), 20); }) }],
    ['font-nonprintable-tag', { font: mutateFont((f) => { f[12] = 0; }) }],
    ['font-unaligned-table', { font: mutateFont((f) => { f.writeUInt32BE(f.readUInt32BE(20) + 1, 20); }) }],
  ];
  const inputFor = (value = {}) => cleanDocxZip(paragraphXml('S11 preserved text'), [
    { name: '[Content_Types].xml', body: value.ct ?? ct },
    { name: 'word/fontTable.xml', body: '<w:fonts/>' },
    { name: 'word/_rels/fontTable.xml.rels', body: value.rels ?? rels },
    { name: 'word/fonts/font1.ttf', body: value.font ?? TTF_BYTES },
  ]);
  for (const [id, value] of cases) {
    await t.test(id, () => {
      const bytes = inputFor(value);
      const before = Buffer.from(bytes);
      const preflight = bridge.buildDocxIntakePreflightReportFromZipBytes(bytes);
      const preview = bridge.buildDocxContentPreviewFromZipBytes(bytes);
      const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(preview);
      assert.equal(preflight.gatePass, false);
      assert.equal(preview.ok, false);
      assert.equal(plan.ok, false);
      assert.notEqual(plan.writeEffects, true);
      assert.deepEqual(bytes, before);
    });
  }
  await t.test('real-font-positive-and-prefixed-OPC-positive', () => {
    for (const value of [{}, { ct: '<?xml version = "1.0" encoding = "UTF-8" standalone = "yes"?>' + ct }, {
      ct: '<?xml version="1.0" encoding="UTF-8"?>' + ct
        .replace('<Types ', '<c:Types ').replace('xmlns=', 'xmlns:c=')
        .replace('<Default ', '<c:Default ').replace('</Types>', '</c:Types>'),
      rels: rels.replace('<Relationships ', '<r:Relationships ').replace('xmlns=', 'xmlns:r=')
        .replace('<Relationship ', '<r:Relationship ').replace('</Relationships>', '</r:Relationships>'),
    }]) {
      const bytes = inputFor(value);
      const preflight = bridge.buildDocxIntakePreflightReportFromZipBytes(bytes);
      const preview = bridge.buildDocxContentPreviewFromZipBytes(bytes);
      const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(preview);
      assert.equal(preflight.gatePass, true);
      assert.equal(preview.ok, true);
      assert.equal(plan.ok, true);
      assert.notEqual(plan.writeEffects, true);
      assert.equal(plan.lossReport.items.some((item) => item.category === 'font'), true);
      assert.equal(preview.contentPreview.paragraphs[0].text, 'S11 preserved text');
    }
  });
});

function paragraphXml(text) {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function numberedParagraphXml(text, { ilvl = '0', numId = '1' } = {}) {
  return [
    '<w:p><w:pPr><w:numPr>',
    `<w:ilvl w:val="${ilvl}"/>`,
    `<w:numId w:val="${numId}"/>`,
    '</w:numPr></w:pPr>',
    `<w:r><w:t>${text}</w:t></w:r></w:p>`,
  ].join('');
}

function numberingXml() {
  return [
    '<w:numbering>',
    '<w:abstractNum w:abstractNumId="0">',
    '<w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl>',
    '</w:abstractNum>',
    '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>',
    '</w:numbering>',
  ].join('');
}

function customMetadataXml(mode = 'default') {
  if (mode === 'prefixed') {
    return '<cp:Properties xmlns:cp="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><cp:property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="YalkenInteropSentinel"><vt:lpwstr>YALKEN_CUSTOM_METADATA_SENTINEL_001</vt:lpwstr></cp:property></cp:Properties>';
  }
  if (mode === 'wrong-namespace') {
    return '<Properties xmlns="urn:not-custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><property pid="2" name="YalkenInteropSentinel"><vt:lpwstr>YALKEN_CUSTOM_METADATA_SENTINEL_001</vt:lpwstr></property></Properties>';
  }
  return '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="YalkenInteropSentinel"><vt:lpwstr>YALKEN_CUSTOM_METADATA_SENTINEL_001</vt:lpwstr></property></Properties>';
}

function cleanDocxZip(body = '<w:p/>', extraEntries = []) {
  return zipFixture([
    {
      name: 'word/document.xml',
      method: 8,
      body: documentXml(body),
    },
    ...extraEntries,
  ]);
}

function cleanStoredDocxZip(body = '<w:p/>', extraEntries = []) {
  return zipFixture([
    {
      name: 'word/document.xml',
      method: 0,
      body: documentXml(body),
    },
    ...extraEntries,
  ]);
}

function rawStoredDocxZip(xmlText) {
  return zipFixture([
    {
      name: 'word/document.xml',
      method: 0,
      body: xmlText,
    },
  ]);
}

function collectKeys(value, pathParts = []) {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectKeys(item, pathParts.concat(String(index))));
  }
  if (!value || typeof value !== 'object') return [];
  return Object.keys(value).flatMap((key) => (
    [pathParts.concat(key).join('.')].concat(collectKeys(value[key], pathParts.concat(key)))
  ));
}

function assertContentPreviewShell(result) {
  assert.equal(result.schemaVersion, 'revision-bridge.docx-content-preview.v1');
  assert.equal(result.type, 'docxContentPreviewReport');
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'reviewPacket'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'reviewSurface'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'parsedReviewSurface'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'activeReviewSession'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'applyOps'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'writeReceipt'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'importReceipt'), false);
}

test('DOCX content preview: exports bounded helper and schema', async () => {
  const bridge = await loadBridge();

  assert.equal(bridge.DOCX_CONTENT_PREVIEW_SCHEMA, 'revision-bridge.docx-content-preview.v1');
  assert.equal(typeof bridge.buildDocxContentPreviewFromZipBytes, 'function');
});

test('DOCX content preview: clean main document returns ordered deterministic paragraphs', async () => {
  const bridge = await loadBridge();
  const input = cleanDocxZip([
    paragraphXml('Alpha'),
    paragraphXml('Bravo'),
    paragraphXml('Charlie'),
  ].join(''));
  const before = Buffer.from(input);
  const first = bridge.buildDocxContentPreviewFromZipBytes(input);
  const second = bridge.buildDocxContentPreviewFromZipBytes(input);

  assertContentPreviewShell(first);
  assert.deepEqual(first, second);
  assert.equal(input.equals(before), true);
  assert.equal(first.ok, true);
  assert.equal(first.status, 'preview');
  assert.equal(first.decision, 'preview');
  assert.equal(first.code, 'DOCX_CONTENT_PREVIEW_READY');
  assert.equal(first.preflightSummary.status, 'accepted');
  assert.equal(first.preflightSummary.gatePass, true);
  assert.equal(first.preflightSummary.parserCandidateOnly, true);
  assert.equal(first.parse.attempted, true);
  assert.equal(first.parse.completed, true);
  assert.equal(first.contentPreview.sourcePart, 'word/document.xml');
  assert.equal(first.contentPreview.paragraphCount, 3);
  assert.deepEqual(first.contentPreview.paragraphs.map((paragraph) => paragraph.text), [
    'Alpha',
    'Bravo',
    'Charlie',
  ]);
  assert.deepEqual(first.contentPreview.paragraphs.map((paragraph) => paragraph.order), [0, 1, 2]);
  assert.match(first.contentPreview.textHash, /^[a-f0-9]{8}$/u);
  assert.equal(first.evidence.some((item) => item.kind === 'contentPreview' && item.textHash), true);

  // GENERIC-01 (G1 amendment): full SHA-256 artifact identity. The 8-hex
  // textHash stays as a deterministic legacy preview hash; the 64-hex
  // sourceArtifactSha256 is the full artifact identity over raw bytes.
  assert.match(first.sourceArtifactSha256, /^[a-f0-9]{64}$/u);
  assert.equal(
    first.sourceArtifactSha256 !== first.contentPreview.textHash,
    true,
    'sourceArtifactSha256 (64 hex) must be distinct from textHash (8 hex)',
  );
  // Distinct raw bytes yield distinct artifact SHA-256.
  const otherBytes = cleanDocxZip(['Alpha', 'Bravo', 'Delta']);
  const other = bridge.buildDocxContentPreviewFromZipBytes(otherBytes);
  assert.notEqual(first.sourceArtifactSha256, other.sourceArtifactSha256);

  // GENERIC-01 (G6 amendment): clean DOCX has no carrier classification.
  assert.equal(first.carrierIgnored, null);
});

test('DOCX content preview: tabs, breaks, empty paragraphs, and XML entities are stable text only', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildDocxContentPreviewFromZipBytes(cleanDocxZip([
    '<w:p><w:r><w:t>A&amp;B</w:t><w:tab/><w:t>C&lt;D</w:t><w:br/><w:t>&quot;E&apos;</w:t></w:r></w:p>',
    '<w:p/>',
  ].join('')));
  const importPreview = bridge.buildDocxImportPreviewPlanFromContentPreview(result);

  assertContentPreviewShell(result);
  assert.equal(result.ok, true);
  assert.deepEqual(result.contentPreview.paragraphs.map((paragraph) => paragraph.text), [
    'A&B\tC<D\n"E\'',
    '',
  ]);
  assert.equal(result.contentPreview.paragraphCount, 2);
  assert.equal(result.diagnostics.filter((item) => (
    item.code === 'DOCX_CONTENT_PREVIEW_TYPED_BREAK_DIAGNOSTIC'
    && item.sourceCode === 'DOCX_CONTENT_PREVIEW_TYPED_BREAK_LINE'
    && item.tagName === 'w:br'
  )).length, 1);
  assert.equal(importPreview.lossReport.items.some((item) => (
    item.code === 'DOCX_IMPORT_PREVIEW_LINE_BREAK_TEXT_ONLY'
    && item.category === 'lineBreak'
    && item.sourceCode === 'DOCX_CONTENT_PREVIEW_TYPED_BREAK_LINE'
    && item.tagName === 'w:br'
  )), true);
});

test('DOCX content preview: typed breaks and section types have exact plain text loss items', async () => {
  const bridge = await loadBridge();
  const input = cleanDocxZip([
    '<w:p><w:r><w:t>T04_LINE_BEFORE</w:t><w:br/><w:t>T04_LINE_AFTER</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>T04_PAGE_BEFORE</w:t><w:br w:type="page"/><w:t>T04_PAGE_AFTER</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>T04_COLUMN_BEFORE</w:t><w:br w:type="column"/><w:t>T04_COLUMN_AFTER</w:t></w:r></w:p>',
    paragraphXml('T04_PARAGRAPH_ONE'),
    paragraphXml('T04_PARAGRAPH_TWO'),
    [
      '<w:p><w:r><w:t>T04_SECTION_ONE</w:t></w:r><w:pPr><w:sectPr>',
      '<w:type w:val="nextPage"/>',
      '</w:sectPr></w:pPr></w:p>',
    ].join(''),
    [
      '<w:p><w:r><w:t>T04_SECTION_TWO</w:t></w:r><w:pPr><w:sectPr>',
      '<w:type w:val="continuous"/>',
      '</w:sectPr></w:pPr></w:p>',
    ].join(''),
  ].join(''));
  const before = Buffer.from(input);
  const result = bridge.buildDocxContentPreviewFromZipBytes(input);
  const importPreview = bridge.buildDocxImportPreviewPlanFromContentPreview(result);

  assertContentPreviewShell(result);
  assert.equal(input.equals(before), true);
  assert.equal(result.ok, true);
  assert.equal(result.code, 'DOCX_CONTENT_PREVIEW_READY');
  assert.deepEqual(result.contentPreview.paragraphs.map((paragraph) => paragraph.text), [
    'T04_LINE_BEFORE\nT04_LINE_AFTER',
    'T04_PAGE_BEFORE\nT04_PAGE_AFTER',
    'T04_COLUMN_BEFORE\nT04_COLUMN_AFTER',
    'T04_PARAGRAPH_ONE',
    'T04_PARAGRAPH_TWO',
    'T04_SECTION_ONE',
    'T04_SECTION_TWO',
  ]);
  for (const sourceCode of [
    'DOCX_CONTENT_PREVIEW_TYPED_BREAK_LINE',
    'DOCX_CONTENT_PREVIEW_TYPED_BREAK_PAGE',
    'DOCX_CONTENT_PREVIEW_TYPED_BREAK_COLUMN',
  ]) {
    assert.equal(result.diagnostics.filter((item) => (
      item.code === 'DOCX_CONTENT_PREVIEW_TYPED_BREAK_DIAGNOSTIC'
      && item.sourceCode === sourceCode
      && item.sourcePart === 'word/document.xml'
      && item.tagName === 'w:br'
    )).length, 1);
  }
  for (const sourceCode of [
    'DOCX_CONTENT_PREVIEW_SECTION_BREAK_NEXT_PAGE',
    'DOCX_CONTENT_PREVIEW_SECTION_BREAK_CONTINUOUS',
  ]) {
    assert.equal(result.diagnostics.filter((item) => (
      item.code === 'DOCX_CONTENT_PREVIEW_SECTION_BREAK_DIAGNOSTIC'
      && item.sourceCode === sourceCode
      && item.sourcePart === 'word/document.xml'
      && item.tagName === 'w:sectPr'
    )).length, 1);
  }
  assert.equal(importPreview.ok, true);
  assert.equal(importPreview.writeEffects, false);
  assert.equal(importPreview.candidateCreatePlan.entries[0].content, [
    'T04_LINE_BEFORE\nT04_LINE_AFTER',
    'T04_PAGE_BEFORE\nT04_PAGE_AFTER',
    'T04_COLUMN_BEFORE\nT04_COLUMN_AFTER',
    'T04_PARAGRAPH_ONE',
    'T04_PARAGRAPH_TWO',
    'T04_SECTION_ONE',
    'T04_SECTION_TWO',
  ].join('\n\n'));
  for (const expected of [
    ['DOCX_IMPORT_PREVIEW_LINE_BREAK_TEXT_ONLY', 'lineBreak', 'DOCX_CONTENT_PREVIEW_TYPED_BREAK_LINE'],
    ['DOCX_IMPORT_PREVIEW_PAGE_BREAK_TEXT_ONLY', 'pageBreak', 'DOCX_CONTENT_PREVIEW_TYPED_BREAK_PAGE'],
    ['DOCX_IMPORT_PREVIEW_COLUMN_BREAK_TEXT_ONLY', 'columnBreak', 'DOCX_CONTENT_PREVIEW_TYPED_BREAK_COLUMN'],
    [
      'DOCX_IMPORT_PREVIEW_SECTION_BREAK_NEXT_PAGE_NOT_IMPORTED',
      'sectionBreak',
      'DOCX_CONTENT_PREVIEW_SECTION_BREAK_NEXT_PAGE',
    ],
    [
      'DOCX_IMPORT_PREVIEW_SECTION_BREAK_CONTINUOUS_NOT_IMPORTED',
      'sectionBreak',
      'DOCX_CONTENT_PREVIEW_SECTION_BREAK_CONTINUOUS',
    ],
  ]) {
    const [code, category, sourceCode] = expected;
    assert.equal(importPreview.lossReport.items.filter((item) => (
      item.code === code
      && item.category === category
      && item.sourceCode === sourceCode
    )).length, 1);
  }
  assert.equal(importPreview.lossReport.items.some((item) => (
    item.code === 'DOCX_IMPORT_PREVIEW_PLAIN_TEXT_ONLY'
    && item.category === 'formatting'
  )), true);
});

test('DOCX content preview: lexical break and section words do not create typed loss', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildDocxContentPreviewFromZipBytes(cleanDocxZip(
    paragraphXml('Visible w:br w:type page column w:sectPr nextPage continuous only'),
  ));
  const importPreview = bridge.buildDocxImportPreviewPlanFromContentPreview(result);

  assertContentPreviewShell(result);
  assert.equal(result.ok, true);
  assert.deepEqual(result.contentPreview.paragraphs.map((paragraph) => paragraph.text), [
    'Visible w:br w:type page column w:sectPr nextPage continuous only',
  ]);
  assert.equal(result.diagnostics.some((item) => (
    item.code === 'DOCX_CONTENT_PREVIEW_TYPED_BREAK_DIAGNOSTIC'
    || item.code === 'DOCX_CONTENT_PREVIEW_SECTION_BREAK_DIAGNOSTIC'
  )), false);
  assert.equal(importPreview.lossReport.items.some((item) => (
    item.code === 'DOCX_IMPORT_PREVIEW_LINE_BREAK_TEXT_ONLY'
    || item.code === 'DOCX_IMPORT_PREVIEW_PAGE_BREAK_TEXT_ONLY'
    || item.code === 'DOCX_IMPORT_PREVIEW_COLUMN_BREAK_TEXT_ONLY'
    || item.code === 'DOCX_IMPORT_PREVIEW_SECTION_BREAK_NEXT_PAGE_NOT_IMPORTED'
    || item.code === 'DOCX_IMPORT_PREVIEW_SECTION_BREAK_CONTINUOUS_NOT_IMPORTED'
  )), false);
});

test('DOCX content preview: hostile and malformed packages stop while known degraded parts are ignored', async () => {
  const bridge = await loadBridge();
  const fontType = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/font';
  const adversarialFontZip = ({
    contentTypes = fontContentTypesXml(),
    relationship = fontRelationshipsXml(),
    fontBody = TTF_BYTES,
  } = {}) => cleanDocxZip(paragraphXml('BadFont'), [
    { name: '[Content_Types].xml', body: contentTypes },
    { name: 'word/fontTable.xml', body: '<w:fonts/>' },
    ...(relationship === null ? [] : [{ name: 'word/_rels/fontTable.xml.rels', body: relationship }]),
    { name: 'word/fonts/font1.ttf', body: fontBody },
  ]);
  const duplicate = bridge.buildDocxContentPreviewFromZipBytes(zipFixture([
    { name: 'word/document.xml', body: documentXml(paragraphXml('A')) },
    { name: 'WORD/DOCUMENT.XML', body: documentXml(paragraphXml('B')) },
  ]));
  const dtd = bridge.buildDocxContentPreviewFromZipBytes(zipFixture([
    {
      name: 'word/document.xml',
      body: '<?xml version="1.0"?><!DOCTYPE root><w:document><w:body/></w:document>',
    },
  ]));
  const degraded = bridge.buildDocxContentPreviewFromZipBytes(cleanDocxZip(paragraphXml('Media'), [
    { name: 'word/media/image1.png', body: 'png' },
  ]));
  const embeddedFont = bridge.buildDocxContentPreviewFromZipBytes(cleanDocxZip(paragraphXml('Font'), [
    { name: '[Content_Types].xml', body: fontContentTypesXml() },
    { name: 'word/fontTable.xml', body: '<w:fonts/>' },
    { name: 'word/_rels/fontTable.xml.rels', body: fontRelationshipsXml() },
    { name: 'word/fonts/font1.odttf', body: Buffer.from([0, 1, 2, 3]) },
    { name: 'word/fonts/font1.ttf', body: TTF_BYTES },
  ]));
  const badFont = bridge.buildDocxContentPreviewFromZipBytes(cleanDocxZip(paragraphXml('BadFont'), [
    { name: '[Content_Types].xml', body: fontContentTypesXml() },
    { name: 'word/fontTable.xml', body: '<w:fonts/>' },
    { name: 'word/_rels/fontTable.xml.rels', body: fontRelationshipsXml() },
    { name: 'word/fonts/font1.ttf', body: Buffer.from('BADDfont', 'ascii') },
  ]));
  const malformed = bridge.buildDocxContentPreviewFromZipBytes('review.docx');

  for (const result of [duplicate, dtd, badFont, malformed]) {
    assertContentPreviewShell(result);
    assert.equal(result.ok, false);
    assert.equal(result.code, 'DOCX_CONTENT_PREVIEW_PREFLIGHT_BLOCKED');
    assert.equal(result.parse.attempted, false);
    assert.equal(result.parse.completed, false);
    assert.equal(result.contentPreview, null);
    assert.equal(result.diagnostics.some((item) => item.code === 'DOCX_CONTENT_PREVIEW_PREFLIGHT_BLOCKED'), true);
  }
  assert.equal(duplicate.reason, 'STAGE02_DUPLICATE_ENTRY_NAME');
  assert.equal(dtd.reason, 'STAGE02_XML_DTD_DECLARATION_PRESENT');
  assert.equal(badFont.reason, 'STAGE02_PACKAGE_QUARANTINED');
  assert.equal(malformed.reason, 'STAGE02_PACKAGE_MALFORMED');
  assert.equal(degraded.ok, true);
  assert.equal(degraded.status, 'preview');
  assert.equal(degraded.parse.attempted, true);
  assert.equal(degraded.contentPreview.paragraphs[0].text, 'Media');
  assert.equal(degraded.diagnostics.some((item) => (
    item.code === 'DOCX_PART_POLICY_MEDIA_DIAGNOSTICS_ONLY'
  )), true);
  assert.equal(embeddedFont.ok, true);
  assert.equal(embeddedFont.status, 'preview');
  assert.equal(embeddedFont.parse.attempted, true);
  assert.equal(embeddedFont.contentPreview.paragraphs[0].text, 'Font');
  assert.equal(embeddedFont.diagnostics.some((item) => (
    item.code === 'DOCX_PART_POLICY_EMBEDDED_FONT_DIAGNOSTICS_ONLY'
    && item.entryId === 'word/fonts/font1.odttf'
  )), true);
  assert.equal(embeddedFont.diagnostics.some((item) => (
    item.code === 'DOCX_PART_POLICY_EMBEDDED_FONT_DIAGNOSTICS_ONLY'
    && item.entryId === 'word/fonts/font1.ttf'
  )), true);
  const importPreview = bridge.buildDocxImportPreviewPlanFromContentPreview(embeddedFont);
  assert.equal(importPreview.ok, true);
  assert.equal(importPreview.lossReport.items.some((item) => (
    item.code === 'DOCX_IMPORT_PREVIEW_EMBEDDED_FONTS_NOT_IMPORTED'
    && item.category === 'font'
    && item.sourcePart === 'word/fonts/font1.odttf'
  )), true);
  assert.equal(importPreview.lossReport.items.some((item) => (
    item.code === 'DOCX_IMPORT_PREVIEW_EMBEDDED_FONTS_NOT_IMPORTED'
    && item.category === 'font'
    && item.sourcePart === 'word/fonts/font1.ttf'
  )), true);

  const adversarialCases = [
    ['comment-only-font-relationships', adversarialFontZip({
      relationship: `<Relationships><!-- <Relationship Id="rFont1" Type="${fontType}" Target="fonts/font1.ttf"/> --></Relationships>`,
    })],
    ['comment-only-ttf-content-type', adversarialFontZip({
      contentTypes: '<Types><!-- <Default Extension="ttf" ContentType="application/x-font-ttf"/> --></Types>',
    })],
    ['shadow-namespaced-content-type', adversarialFontZip({
      contentTypes: '<Types xmlns:evil="urn:evil"><Default Extension="ttf" evil:ContentType="application/x-font-ttf" ContentType="application/octet-stream"/></Types>',
    })],
    ['shadow-namespaced-relationship-type', adversarialFontZip({
      relationship: `<Relationships xmlns:evil="urn:evil"><Relationship Id="rFont1" evil:Type="${fontType}" Type="urn:not-font" Target="fonts/font1.ttf"/></Relationships>`,
    })],
    ['malformed-unclosed-content-default', adversarialFontZip({
      contentTypes: '<Types><Default Extension="ttf" ContentType="application/x-font-ttf"',
    })],
    ['truncated-four-byte-sfnt', adversarialFontZip({
      fontBody: Buffer.from([0x00, 0x01, 0x00, 0x00]),
    })],
  ];
  for (const [caseId, bytes] of adversarialCases) {
    const result = bridge.buildDocxContentPreviewFromZipBytes(bytes);
    assert.equal(result.ok, false, caseId);
    assert.equal(result.code, 'DOCX_CONTENT_PREVIEW_PREFLIGHT_BLOCKED', caseId);
    assert.equal(result.parse.attempted, false, caseId);
    const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(result);
    assert.equal(plan.ok, false, caseId);
    assert.equal(plan.writeEffects, false, caseId);
  }
});

test('DOCX content preview: actual CRC mismatch fails closed before preview ready', async () => {
  const bridge = await loadBridge();
  const documentBody = documentXml(paragraphXml('CRC guarded text'));
  const contentTypes = contentTypesXml();
  const documentCrc = crc32Bytes(utf8Bytes(documentBody));
  const contentTypesCrc = crc32Bytes(utf8Bytes(contentTypes));
  const forgedDocumentCrc = (documentCrc ^ 0xffffffff) >>> 0;
  const forgedContentTypesCrc = (contentTypesCrc ^ 0xffffffff) >>> 0;
  const valid = zipFixture([
    { name: '[Content_Types].xml', method: 0, body: contentTypes, useRealCrc: true },
    { name: 'word/document.xml', method: 8, body: documentBody, useRealCrc: true },
  ]);
  const staleDocumentCrc = zipFixture([
    { name: '[Content_Types].xml', method: 0, body: contentTypes, useRealCrc: true },
    {
      name: 'word/document.xml',
      method: 8,
      body: documentBody,
      localCrc32: forgedDocumentCrc,
      centralCrc32: forgedDocumentCrc,
    },
  ]);
  const staleContentTypesCrc = zipFixture([
    {
      name: '[Content_Types].xml',
      method: 0,
      body: contentTypes,
      localCrc32: forgedContentTypesCrc,
      centralCrc32: forgedContentTypesCrc,
    },
    { name: 'word/document.xml', method: 8, body: documentBody, useRealCrc: true },
  ]);

  const positive = bridge.buildDocxContentPreviewFromZipBytes(valid);
  assertContentPreviewShell(positive);
  assert.equal(positive.ok, true);
  assert.equal(positive.code, 'DOCX_CONTENT_PREVIEW_READY');
  assert.deepEqual(positive.contentPreview.paragraphs.map((paragraph) => paragraph.text), ['CRC guarded text']);

  for (const bytes of [staleDocumentCrc, staleContentTypesCrc]) {
    const preview = bridge.buildDocxContentPreviewFromZipBytes(bytes);
    const transport = bridge.extractDocxReviewTransportPackagePartsFromZipBytes(bytes);

    assertContentPreviewShell(preview);
    assert.equal(preview.ok, false);
    assert.equal(preview.code, 'DOCX_CONTENT_PREVIEW_PREFLIGHT_BLOCKED');
    assert.equal(preview.reason, 'RTK_ZIP_CRC_MISMATCH');
    assert.equal(preview.parse.attempted, false);
    assert.equal(preview.contentPreview, null);
    assert.equal(preview.preflightSummary.gatePass, false);
    assert.equal(preview.diagnostics.some((item) => (
      item.code === 'DOCX_CONTENT_PREVIEW_PREFLIGHT_BLOCKED'
      && item.sourceCode === 'RTK_ZIP_CRC_MISMATCH'
    )), true);
    assert.equal(transport.ok, false);
    assert.equal(transport.code, 'RTK_ZIP_CRC_MISMATCH');
  }
});

test('DOCX content preview: table text is preserved while unsupported structures stay diagnostic-only', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildDocxContentPreviewFromZipBytes(cleanDocxZip([
    paragraphXml('Before'),
    '<w:tbl><w:tr><w:tc>',
    paragraphXml('Table text'),
    '</w:tc></w:tr></w:tbl>',
    '<w:ins>',
    paragraphXml('Inserted text'),
    '</w:ins>',
    paragraphXml('After'),
  ].join('')));
  const importPreview = bridge.buildDocxImportPreviewPlanFromContentPreview(result);

  assertContentPreviewShell(result);
  assert.equal(result.ok, true);
  assert.equal(result.code, 'DOCX_CONTENT_PREVIEW_READY');
  assert.deepEqual(result.contentPreview.paragraphs.map((paragraph) => paragraph.text), [
    'Before',
    'Table text',
    'After',
  ]);
  assert.equal(importPreview.ok, true);
  assert.equal(importPreview.writeEffects, false);
  assert.equal(importPreview.candidateCreatePlan.entries[0].content, 'Before\n\nTable text\n\nAfter');
  assert.equal(importPreview.lossReport.items.some((item) => (
    item.code === 'DOCX_IMPORT_PREVIEW_TABLE_NOT_IMPORTED'
    && item.category === 'table'
  )), true);
  assert.equal(importPreview.candidateCreatePlan.entries[0].content.includes('Inserted text'), false);
  assert.equal(result.diagnostics.some((item) => (
    item.code === 'DOCX_CONTENT_PREVIEW_UNSUPPORTED_STRUCTURE_DIAGNOSTIC'
    && item.tagName === 'w:tbl'
  )), true);
  assert.equal(result.diagnostics.some((item) => (
    item.code === 'DOCX_CONTENT_PREVIEW_UNSUPPORTED_STRUCTURE_DIAGNOSTIC'
    && item.tagName === 'w:ins'
  )), true);
});

test('DOCX content preview: markup compatibility imports exactly one effective branch with explicit loss', async () => {
  const bridge = await loadBridge();
  const before = paragraphXml('P07_ALT_BEFORE');
  const choice = paragraphXml('P07_CHOICE_TEXT_WORD14_BRANCH');
  const fallback = paragraphXml('P07_FALLBACK_TEXT_STANDARD_BRANCH');
  const after = paragraphXml('P07_ALT_AFTER');
  const alternateContent = (requires, body, fallbackBody = fallback) => [
    before,
    '<mc:AlternateContent>',
    `<mc:Choice Requires="${requires}">`,
    body,
    '</mc:Choice>',
    fallbackBody === null ? '' : `<mc:Fallback>${fallbackBody}</mc:Fallback>`,
    '</mc:AlternateContent>',
    after,
  ].join('');
  const multiChoiceAlternateContent = [
    before,
    '<mc:AlternateContent>',
    '<mc:Choice Requires="w99">',
    paragraphXml('P07_UNSUPPORTED_FIRST_BRANCH'),
    '</mc:Choice>',
    '<mc:Choice Requires="w14">',
    choice,
    '</mc:Choice>',
    '<mc:Fallback>',
    fallback,
    '</mc:Fallback>',
    '</mc:AlternateContent>',
    after,
  ].join('');
  const cases = [
    {
      label: 'supported choice',
      bytes: cleanDocxZip(alternateContent('w14', choice)),
      paragraphs: ['P07_ALT_BEFORE', 'P07_CHOICE_TEXT_WORD14_BRANCH', 'P07_ALT_AFTER'],
      imported: 'P07_ALT_BEFORE\n\nP07_CHOICE_TEXT_WORD14_BRANCH\n\nP07_ALT_AFTER',
      absentText: 'P07_FALLBACK_TEXT_STANDARD_BRANCH',
      lossCode: null,
    },
    {
      label: 'second supported choice only',
      bytes: cleanDocxZip(multiChoiceAlternateContent),
      paragraphs: ['P07_ALT_BEFORE', 'P07_CHOICE_TEXT_WORD14_BRANCH', 'P07_ALT_AFTER'],
      imported: 'P07_ALT_BEFORE\n\nP07_CHOICE_TEXT_WORD14_BRANCH\n\nP07_ALT_AFTER',
      absentText: 'P07_UNSUPPORTED_FIRST_BRANCH',
      lossCode: null,
    },
    {
      label: 'unsupported choice with fallback',
      bytes: cleanDocxZip(alternateContent('w99', choice)),
      paragraphs: ['P07_ALT_BEFORE', 'P07_FALLBACK_TEXT_STANDARD_BRANCH', 'P07_ALT_AFTER'],
      imported: 'P07_ALT_BEFORE\n\nP07_FALLBACK_TEXT_STANDARD_BRANCH\n\nP07_ALT_AFTER',
      absentText: 'P07_CHOICE_TEXT_WORD14_BRANCH',
      lossCode: 'DOCX_IMPORT_PREVIEW_MARKUP_COMPATIBILITY_FALLBACK_SELECTED',
    },
    {
      label: 'unsupported choice without fallback',
      bytes: cleanDocxZip(alternateContent('w99', choice, null)),
      paragraphs: ['P07_ALT_BEFORE', 'P07_ALT_AFTER'],
      imported: 'P07_ALT_BEFORE\n\nP07_ALT_AFTER',
      absentText: 'P07_CHOICE_TEXT_WORD14_BRANCH',
      lossCode: 'DOCX_IMPORT_PREVIEW_MARKUP_COMPATIBILITY_BRANCH_NOT_IMPORTED',
    },
    {
      label: 'empty selected branch',
      bytes: cleanDocxZip(alternateContent('w14', '', fallback)),
      paragraphs: ['P07_ALT_BEFORE', 'P07_ALT_AFTER'],
      imported: 'P07_ALT_BEFORE\n\nP07_ALT_AFTER',
      absentText: 'P07_FALLBACK_TEXT_STANDARD_BRANCH',
      lossCode: 'DOCX_IMPORT_PREVIEW_MARKUP_COMPATIBILITY_SELECTED_BRANCH_EMPTY',
    },
    {
      label: 'Word-normalized effective branch',
      bytes: cleanDocxZip([before, choice, after].join('')),
      paragraphs: ['P07_ALT_BEFORE', 'P07_CHOICE_TEXT_WORD14_BRANCH', 'P07_ALT_AFTER'],
      imported: 'P07_ALT_BEFORE\n\nP07_CHOICE_TEXT_WORD14_BRANCH\n\nP07_ALT_AFTER',
      absentText: 'P07_FALLBACK_TEXT_STANDARD_BRANCH',
      lossCode: null,
    },
    {
      label: 'plain positive control',
      bytes: cleanDocxZip([paragraphXml('P07_CONTROL_BEFORE'), paragraphXml('P07_CONTROL_AFTER')].join('')),
      paragraphs: ['P07_CONTROL_BEFORE', 'P07_CONTROL_AFTER'],
      imported: 'P07_CONTROL_BEFORE\n\nP07_CONTROL_AFTER',
      absentText: 'P07_CHOICE_TEXT_WORD14_BRANCH',
      lossCode: null,
    },
  ];

  for (const item of cases) {
    const original = Buffer.from(item.bytes);
    const result = bridge.buildDocxContentPreviewFromZipBytes(item.bytes);
    const importPreview = bridge.buildDocxImportPreviewPlanFromContentPreview(result);

    assertContentPreviewShell(result);
    assert.equal(item.bytes.equals(original), true, `${item.label} must stay zero-write`);
    assert.equal(result.ok, true, item.label);
    assert.equal(result.code, 'DOCX_CONTENT_PREVIEW_READY', item.label);
    assert.deepEqual(result.contentPreview.paragraphs.map((paragraph) => paragraph.text), item.paragraphs, item.label);
    assert.equal(importPreview.ok, true, item.label);
    assert.equal(importPreview.writeEffects, false, item.label);
    assert.equal(importPreview.candidateCreatePlan.entries[0].content, item.imported, item.label);
    assert.equal(importPreview.candidateCreatePlan.entries[0].content.includes(item.absentText), false, item.label);
    if (item.lossCode) {
      assert.equal(importPreview.lossReport.items.some((loss) => (
        loss.code === item.lossCode
        && loss.category === 'markupCompatibility'
        && loss.tagName === 'mc:AlternateContent'
      )), true, item.label);
    } else {
      assert.equal(importPreview.lossReport.items.some((loss) => (
        loss.category === 'markupCompatibility'
      )), false, item.label);
    }
  }
});

test('DOCX content preview: safe external hyperlinks preserve visible labels but stay inert preview candidates', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildDocxContentPreviewFromZipBytes(cleanDocxZip([
    '<w:p>',
    '<w:r><w:t>Before </w:t></w:r>',
    '<w:hyperlink r:id="rIdLink"><w:r><w:t>Link text</w:t></w:r></w:hyperlink>',
    '<w:r><w:t> After</w:t></w:r>',
    '</w:p>',
  ].join(''), [
    {
      name: 'word/_rels/document.xml.rels',
      method: 8,
      body: '<Relationships><Relationship Id="rIdLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.invalid" TargetMode="External"/></Relationships>',
    },
  ]));
  const importPreview = bridge.buildDocxImportPreviewPlanFromContentPreview(result);

  assertContentPreviewShell(result);
  assert.equal(result.ok, true);
  assert.equal(result.code, 'DOCX_CONTENT_PREVIEW_READY');
  assert.equal(result.contentPreview.paragraphs[0].text, 'Before Link text After');
  assert.equal(result.contentPreview.paragraphs[0].text.includes('https://example.invalid'), false);
  assert.equal(result.preflightSummary.status, 'degraded');
  assert.equal(result.preflightSummary.parserCandidateOnly, true);
  assert.equal(result.preflightSummary.gatePass, true);
  assert.equal(result.diagnostics.some((item) => (
    item.code === 'DOCX_CONTENT_PREVIEW_UNSUPPORTED_STRUCTURE_DIAGNOSTIC'
    && item.tagName === 'w:hyperlink'
  )), true);
  assert.equal(result.diagnostics.some((item) => (
    item.code === 'DOCX_PART_POLICY_RELATIONSHIP_DIAGNOSTICS_ONLY'
    && item.entryId === 'word/_rels/document.xml.rels'
  )), true);
  assert.equal(importPreview.ok, true);
  assert.equal(importPreview.writeEffects, false);
  assert.equal(importPreview.lossReport.items.some((item) => (
    item.code === 'DOCX_IMPORT_PREVIEW_LINK_NOT_IMPORTED'
    && item.category === 'link'
    && item.tagName === 'w:hyperlink'
  )), true);
  assert.equal(importPreview.lossReport.items.some((item) => (
    item.code === 'DOCX_IMPORT_PREVIEW_RELATIONSHIPS_NOT_IMPORTED'
    && item.category === 'relationship'
  )), true);
});

test('DOCX content preview: hyperlink visible text survives split runs anchors and Unicode', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildDocxContentPreviewFromZipBytes(cleanDocxZip([
    '<w:p>',
    '<w:r><w:t>Before </w:t></w:r>',
    '<w:hyperlink r:id="rIdAlpha"><w:r><w:t>Visible </w:t></w:r><w:r><w:t>Label Alpha</w:t></w:r></w:hyperlink>',
    '<w:r><w:t> | </w:t></w:r>',
    '<w:bookmarkStart w:id="1" w:name="SceneAnchor"/>',
    '<w:bookmarkEnd w:id="1"/>',
    '<w:hyperlink w:anchor="SceneAnchor"><w:r><w:t>Anchor Label</w:t></w:r></w:hyperlink>',
    '<w:r><w:t> | </w:t></w:r>',
    '<w:hyperlink r:id="rIdUnicode"><w:r><w:t>Юникод Ω label</w:t></w:r></w:hyperlink>',
    '<w:r><w:t> After</w:t></w:r>',
    '</w:p>',
  ].join(''), [
    {
      name: 'word/_rels/document.xml.rels',
      method: 8,
      body: [
        '<Relationships>',
        '<Relationship Id="rIdAlpha" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://target.example/alpha?secret=1" TargetMode="External"/>',
        '<Relationship Id="rIdUnicode" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://target.example/unicode?label=%D0%AE" TargetMode="External"/>',
        '</Relationships>',
      ].join(''),
    },
  ]));
  const importPreview = bridge.buildDocxImportPreviewPlanFromContentPreview(result);

  assertContentPreviewShell(result);
  assert.equal(result.ok, true);
  assert.equal(result.code, 'DOCX_CONTENT_PREVIEW_READY');
  assert.equal(
    result.contentPreview.paragraphs[0].text,
    'Before Visible Label Alpha | Anchor Label | Юникод Ω label After',
  );
  assert.equal(result.contentPreview.paragraphs[0].text.includes('https://target.example'), false);
  assert.equal(result.diagnostics.filter((item) => (
    item.code === 'DOCX_CONTENT_PREVIEW_UNSUPPORTED_STRUCTURE_DIAGNOSTIC'
    && item.tagName === 'w:hyperlink'
  )).length, 1);
  assert.equal(result.diagnostics.some((item) => (
    item.code === 'DOCX_CONTENT_PREVIEW_UNSUPPORTED_STRUCTURE_DIAGNOSTIC'
    && item.tagName === 'w:bookmarkStart'
  )), true);
  assert.equal(importPreview.ok, true);
  assert.equal(importPreview.writeEffects, false);
  assert.equal(
    importPreview.candidateCreatePlan.entries[0].content,
    'Before Visible Label Alpha | Anchor Label | Юникод Ω label After',
  );
  assert.equal(importPreview.lossReport.items.some((item) => (
    item.code === 'DOCX_IMPORT_PREVIEW_LINK_NOT_IMPORTED'
    && item.category === 'link'
    && item.tagName === 'w:hyperlink'
  )), true);
  assert.equal(importPreview.lossReport.items.some((item) => (
    item.code === 'DOCX_IMPORT_PREVIEW_BOOKMARKS_NOT_IMPORTED'
    && item.category === 'bookmark'
  )), true);
  assert.equal(importPreview.lossReport.items.some((item) => (
    item.code === 'DOCX_IMPORT_PREVIEW_RELATIONSHIPS_NOT_IMPORTED'
    && item.category === 'relationship'
  )), true);
});

test('DOCX content preview: paragraph numbering is explicit unsupported list loss', async () => {
  const bridge = await loadBridge();
  const input = cleanDocxZip([
    numberedParagraphXml('alpha', { numId: '1', ilvl: '0' }),
    numberedParagraphXml('beta', { numId: '1', ilvl: '1' }),
    numberedParagraphXml('gamma', { numId: '2', ilvl: '0' }),
  ].join(''), [
    { name: 'word/numbering.xml', method: 8, body: numberingXml() },
  ]);
  const before = Buffer.from(input);
  const result = bridge.buildDocxContentPreviewFromZipBytes(input);
  const importPreview = bridge.buildDocxImportPreviewPlanFromContentPreview(result);

  assertContentPreviewShell(result);
  assert.equal(input.equals(before), true);
  assert.equal(result.ok, true);
  assert.equal(result.code, 'DOCX_CONTENT_PREVIEW_READY');
  assert.deepEqual(result.contentPreview.paragraphs.map((paragraph) => paragraph.text), [
    'alpha',
    'beta',
    'gamma',
  ]);
  const listDiagnostics = result.diagnostics.filter((item) => (
    item.code === 'DOCX_CONTENT_PREVIEW_LIST_NUMBERING_DIAGNOSTIC'
    && item.tagName === 'w:numPr'
    && item.sourcePart === 'word/document.xml'
  ));
  assert.deepEqual(listDiagnostics.map((item) => ({
    paragraphIndex: item.paragraphIndex,
    numId: item.numId,
    ilvl: item.ilvl,
    listKey: item.listKey,
  })), [
    { paragraphIndex: 0, numId: '1', ilvl: '0', listKey: 'numId:1|ilvl:0' },
    { paragraphIndex: 1, numId: '1', ilvl: '1', listKey: 'numId:1|ilvl:1' },
    { paragraphIndex: 2, numId: '2', ilvl: '0', listKey: 'numId:2|ilvl:0' },
  ]);
  assert.equal(importPreview.ok, true);
  assert.equal(importPreview.writeEffects, false);
  assert.equal(importPreview.candidateCreatePlan.entries[0].content, 'alpha\n\nbeta\n\ngamma');
  const listLossItems = importPreview.lossReport.items.filter((item) => (
    item.code === 'DOCX_IMPORT_PREVIEW_LIST_NUMBERING_NOT_IMPORTED'
    && item.category === 'listNumbering'
    && item.tagName === 'w:numPr'
    && item.sourceCode === 'DOCX_CONTENT_PREVIEW_LIST_NUMBERING_DIAGNOSTIC'
  ));
  assert.deepEqual(listLossItems.map((item) => ({
    paragraphIndex: item.paragraphIndex,
    numId: item.numId,
    ilvl: item.ilvl,
    listKey: item.listKey,
  })), [
    { paragraphIndex: 0, numId: '1', ilvl: '0', listKey: 'numId:1|ilvl:0' },
    { paragraphIndex: 1, numId: '1', ilvl: '1', listKey: 'numId:1|ilvl:1' },
    { paragraphIndex: 2, numId: '2', ilvl: '0', listKey: 'numId:2|ilvl:0' },
  ]);
});

test('DOCX content preview: explicit numId zero does not create list loss', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildDocxContentPreviewFromZipBytes(cleanDocxZip(
    numberedParagraphXml('not numbered', { numId: '0', ilvl: '0' }),
    [
      { name: 'word/numbering.xml', method: 8, body: numberingXml() },
    ],
  ));
  const importPreview = bridge.buildDocxImportPreviewPlanFromContentPreview(result);

  assertContentPreviewShell(result);
  assert.equal(result.ok, true);
  assert.deepEqual(result.contentPreview.paragraphs.map((paragraph) => paragraph.text), [
    'not numbered',
  ]);
  assert.equal(result.diagnostics.some((item) => (
    item.code === 'DOCX_CONTENT_PREVIEW_LIST_NUMBERING_DIAGNOSTIC'
  )), false);
  assert.equal(importPreview.lossReport.items.some((item) => (
    item.code === 'DOCX_IMPORT_PREVIEW_LIST_NUMBERING_NOT_IMPORTED'
  )), false);
});

test('DOCX content preview: numbering text and unused numbering part do not create list loss', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildDocxContentPreviewFromZipBytes(cleanDocxZip(
    paragraphXml('Visible w:numPr and word/numbering.xml names only'),
    [
      { name: 'word/numbering.xml', method: 8, body: numberingXml() },
    ],
  ));
  const importPreview = bridge.buildDocxImportPreviewPlanFromContentPreview(result);

  assertContentPreviewShell(result);
  assert.equal(result.ok, true);
  assert.deepEqual(result.contentPreview.paragraphs.map((paragraph) => paragraph.text), [
    'Visible w:numPr and word/numbering.xml names only',
  ]);
  assert.equal(result.diagnostics.some((item) => (
    item.code === 'DOCX_CONTENT_PREVIEW_LIST_NUMBERING_DIAGNOSTIC'
  )), false);
  assert.equal(importPreview.lossReport.items.some((item) => (
    item.code === 'DOCX_IMPORT_PREVIEW_LIST_NUMBERING_NOT_IMPORTED'
  )), false);
});

test('DOCX content preview: bookmarks and custom metadata are explicit diagnostics without lexical false positives', async () => {
  const bridge = await loadBridge();
  const bookmark = bridge.buildDocxContentPreviewFromZipBytes(cleanDocxZip(
    '<w:p><w:bookmarkStart w:id="7" w:name="YALKEN_NATIVE_BOOKMARK_001"/><w:r><w:t>Bookmark target</w:t></w:r><w:bookmarkEnd w:id="7"/></w:p>',
  ));
  const metadataDefault = bridge.buildDocxContentPreviewFromZipBytes(cleanDocxZip(paragraphXml('Metadata target'), [
    { name: 'docProps/custom.xml', method: 0, body: customMetadataXml('default') },
  ]));
  const metadataPrefixed = bridge.buildDocxContentPreviewFromZipBytes(cleanDocxZip(paragraphXml('Metadata prefixed target'), [
    { name: 'docProps/custom.xml', method: 0, body: customMetadataXml('prefixed') },
  ]));
  const falseLexical = bridge.buildDocxContentPreviewFromZipBytes(cleanDocxZip(
    paragraphXml('Visible YALKEN_NATIVE_BOOKMARK_001 and YALKEN_CUSTOM_METADATA_SENTINEL_001 only'),
  ));
  const wrongNamespace = bridge.buildDocxContentPreviewFromZipBytes(cleanDocxZip(paragraphXml('Wrong namespace'), [
    { name: 'docProps/custom.xml', method: 0, body: customMetadataXml('wrong-namespace') },
  ]));

  assertContentPreviewShell(bookmark);
  assert.equal(bookmark.ok, true);
  assert.deepEqual(bookmark.contentPreview.paragraphs.map((paragraph) => paragraph.text), ['Bookmark target']);
  assert.equal(bookmark.diagnostics.some((item) => (
    item.code === 'DOCX_CONTENT_PREVIEW_UNSUPPORTED_STRUCTURE_DIAGNOSTIC'
    && item.tagName === 'w:bookmarkStart'
  )), true);
  assert.equal(bookmark.diagnostics.some((item) => (
    item.code === 'DOCX_CONTENT_PREVIEW_UNSUPPORTED_STRUCTURE_DIAGNOSTIC'
    && item.tagName === 'w:bookmarkEnd'
  )), true);

  for (const result of [metadataDefault, metadataPrefixed]) {
    assertContentPreviewShell(result);
    assert.equal(result.ok, true);
    assert.equal(result.diagnostics.some((item) => (
      item.code === 'DOCX_CONTENT_PREVIEW_CUSTOM_METADATA_DIAGNOSTIC'
      && item.sourcePart === 'docProps/custom.xml'
    )), true);
  }

  assert.equal(falseLexical.ok, true);
  assert.equal(falseLexical.diagnostics.some((item) => (
    item.code === 'DOCX_CONTENT_PREVIEW_CUSTOM_METADATA_DIAGNOSTIC'
    || item.tagName === 'w:bookmarkStart'
    || item.tagName === 'w:bookmarkEnd'
  )), false);
  assert.equal(wrongNamespace.ok, true);
  assert.equal(wrongNamespace.diagnostics.some((item) => (
    item.code === 'DOCX_CONTENT_PREVIEW_CUSTOM_METADATA_DIAGNOSTIC'
  )), false);
});

test('DOCX content preview: accepted containers still fail closed on malformed XML and budget overflow', async () => {
  const bridge = await loadBridge();
  const malformed = bridge.buildDocxContentPreviewFromZipBytes(cleanDocxZip(
    '<w:p><w:r><w:t>Leaked</w:p></w:r>',
  ));
  const tooManyParagraphs = bridge.buildDocxContentPreviewFromZipBytes(cleanStoredDocxZip(
    '<w:p/>'.repeat(64001),
  ));
  const writerScaleOverOldLimit = bridge.buildDocxContentPreviewFromZipBytes(cleanStoredDocxZip(
    paragraphXml('W'.repeat(1000001)),
  ));

  assertContentPreviewShell(malformed);
  assert.equal(malformed.ok, false);
  assert.equal(malformed.code, 'DOCX_CONTENT_PREVIEW_XML_MALFORMED');
  assert.equal(malformed.parse.attempted, true);
  assert.equal(malformed.parse.completed, false);
  assert.equal(malformed.contentPreview, null);
  assert.equal(malformed.diagnostics.some((item) => (
    item.code === 'DOCX_CONTENT_PREVIEW_XML_MALFORMED'
    && item.sourceCode === 'DOCX_XML_TAG_MISMATCH'
  )), true);

  assertContentPreviewShell(tooManyParagraphs);
  assert.equal(tooManyParagraphs.ok, false);
  assert.equal(tooManyParagraphs.code, 'DOCX_CONTENT_PREVIEW_XML_PARSE_LIMIT_EXCEEDED');
  assert.equal(tooManyParagraphs.parse.attempted, true);
  assert.equal(tooManyParagraphs.parse.completed, false);
  assert.equal(tooManyParagraphs.contentPreview, null);

  assertContentPreviewShell(writerScaleOverOldLimit);
  assert.equal(writerScaleOverOldLimit.ok, true);
  assert.equal(writerScaleOverOldLimit.code, 'DOCX_CONTENT_PREVIEW_READY');
  assert.equal(writerScaleOverOldLimit.contentPreview.textLength, 1000001);
});

test('DOCX content preview: unsupported encoding and namespace prefix do not produce empty successful previews', async () => {
  const bridge = await loadBridge();
  const unsupportedEncoding = bridge.buildDocxContentPreviewFromZipBytes(zipFixture([
    {
      name: 'word/document.xml',
      method: 0,
      body: '<?xml version="1.0" encoding="UTF-16"?><w:document><w:body><w:p/></w:body></w:document>',
    },
  ]));
  const unsupportedPrefix = bridge.buildDocxContentPreviewFromZipBytes(cleanDocxZip(
    '<x:p><x:r><x:t>Hidden</x:t></x:r></x:p>',
  ));

  assertContentPreviewShell(unsupportedEncoding);
  assert.equal(unsupportedEncoding.ok, false);
  assert.equal(unsupportedEncoding.code, 'DOCX_CONTENT_PREVIEW_UNSUPPORTED_XML_ENCODING');
  assert.equal(unsupportedEncoding.parse.attempted, true);
  assert.equal(unsupportedEncoding.parse.completed, false);
  assert.equal(unsupportedEncoding.contentPreview, null);

  assertContentPreviewShell(unsupportedPrefix);
  assert.equal(unsupportedPrefix.ok, false);
  assert.equal(unsupportedPrefix.code, 'DOCX_CONTENT_PREVIEW_UNSUPPORTED_XML_PREFIX');
  assert.equal(unsupportedPrefix.parse.attempted, true);
  assert.equal(unsupportedPrefix.parse.completed, false);
  assert.equal(unsupportedPrefix.contentPreview, null);
});

test('DOCX content preview: trailing XML garbage and multiple roots never return ready', async () => {
  const bridge = await loadBridge();
  const validRoot = documentXml(paragraphXml('Alpha'));
  const trailingBareLessThan = bridge.buildDocxContentPreviewFromZipBytes(rawStoredDocxZip(`${validRoot}<`));
  const trailingTextAfterRoot = bridge.buildDocxContentPreviewFromZipBytes(rawStoredDocxZip(`${validRoot}leaked`));
  const secondRoot = bridge.buildDocxContentPreviewFromZipBytes(rawStoredDocxZip(`${validRoot}${documentXml(paragraphXml('Beta'))}`));

  for (const result of [trailingBareLessThan, trailingTextAfterRoot, secondRoot]) {
    assertContentPreviewShell(result);
    assert.equal(result.ok, false);
    assert.equal(result.code, 'DOCX_CONTENT_PREVIEW_XML_MALFORMED');
    assert.equal(result.parse.attempted, true);
    assert.equal(result.parse.completed, false);
    assert.equal(result.contentPreview, null);
  }
  assert.equal(trailingBareLessThan.diagnostics.some((item) => item.sourceCode === 'DOCX_XML_TOKEN_GAP'), true);
  assert.equal(trailingTextAfterRoot.diagnostics.some((item) => item.sourceCode === 'DOCX_XML_TEXT_OUTSIDE_ROOT'), true);
  assert.equal(secondRoot.diagnostics.some((item) => item.sourceCode === 'DOCX_XML_MULTIPLE_ROOTS'), true);
});

test('DOCX content preview: result and implementation stay out of UI review import storage layers', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildDocxContentPreviewFromZipBytes(cleanDocxZip(paragraphXml('Safe')));
  const resultKeys = collectKeys(result);
  const forbiddenResultKeys = [
    'reviewPacket',
    'reviewSurface',
    'parsedReviewSurface',
    'activeReviewSession',
    'previewInput',
    'applyOps',
    'applyPlan',
    'canApply',
    'canCreateReviewPacket',
    'canPreviewApply',
    'canImportMutate',
    'canWriteStorage',
    'writeReceipt',
    'importReceipt',
    'exportReceipt',
    'inventory',
    'entries',
  ];

  for (const forbidden of forbiddenResultKeys) {
    assert.equal(resultKeys.some((key) => key === forbidden || key.endsWith(`.${forbidden}`)), false, forbidden);
  }

  const section = extractMarkedSection(readBridgeSource(), SECTION_START, SECTION_END);
  const forbiddenRuntimeMarkers = [
    'fs.',
    'readFile',
    'writeFile',
    'ipc',
    'electron',
    'fetch',
    'http',
    'https',
    'DOMParser',
    'XMLParser',
    'xmldom',
    'fast-xml-parser',
    'buildRevisionPacketPreview',
    'adaptParsedReviewSurfaceToReviewPacketPreviewInput',
    'handleReviewSurfaceImportPacketCommandSurface',
    'exactTextMinSafeWrite',
    'buildDocxMinBuffer',
    'reviewSurface',
    'reviewPacket',
    'parsedReviewSurface',
    'activeReviewSession',
    'applyOps',
    'canApply: true',
    'writeReceipt',
    'importReceipt',
  ];

  for (const marker of forbiddenRuntimeMarkers) {
    assert.equal(section.includes(marker), false, `${marker} must stay out of content preview contour`);
  }
});
