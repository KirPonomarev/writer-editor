const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { deflateRawSync } = require('node:zlib');

const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);
const TTF_BYTES = fs.readFileSync(path.resolve(__dirname, '../../src/renderer/assets/fonts/Circe-Regular.ttf'));
const BAD_TTF_BYTES = Buffer.from('BADDfont', 'ascii');

async function loadBridge() {
  return import(pathToFileURL(path.join(process.cwd(), MODULE_PATH)).href);
}

function asciiBytes(value) {
  return Buffer.from(value, 'ascii');
}

function utf8Bytes(value) {
  return Buffer.from(value, 'utf8');
}

function normalizeEntry(entry) {
  const body = Buffer.isBuffer(entry.body)
    ? entry.body
    : utf8Bytes(typeof entry.body === 'string' ? entry.body : '');
  const method = entry.method ?? 0;
  const compressedBody = method === 8 ? deflateRawSync(body) : body;
  return {
    name: entry.name,
    method,
    flags: entry.flags ?? 0,
    body,
    compressedBody,
    byteSize: entry.byteSize ?? body.length,
    compressedSize: entry.compressedSize ?? compressedBody.length,
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
  header.writeUInt32LE(0, 14);
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
  header.writeUInt16LE(entry.flags, 8);
  header.writeUInt16LE(entry.method, 10);
  header.writeUInt32LE(0, 16);
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

function fontContentTypesXml(contentType = 'application/x-font-ttf') {
  return `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="ttf" ContentType="${contentType}"/></Types>`;
}

function fontRelationshipsXml(target = 'fonts/font1.ttf') {
  return `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rFont1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="${target}"/></Relationships>`;
}

function assertExactShape(result) {
  assert.deepEqual(Object.keys(result), [
    'ok',
    'schemaVersion',
    'type',
    'status',
    'code',
    'reason',
    'decision',
    'diagnostics',
    'evidence',
    'budgets',
    'parse',
  ]);
  assert.deepEqual(Object.keys(result.parse), [
    'attempted',
    'semanticAllowed',
  ]);
}

test('Stage02 hostile file gate exports public API and allows clean pre-parse container only', async () => {
  const bridge = await loadBridge();
  const zipBytes = zipFixture([
    {
      name: 'word/document.xml',
      method: 8,
      body: '<w:document><w:body><w:p/></w:body></w:document>',
    },
  ]);

  assert.equal(typeof bridge.inspectDocxHostileFileGateFromZipBytes, 'function');
  assert.equal(bridge.DOCX_HOSTILE_FILE_GATE_SCHEMA, 'revision-bridge.docx-hostile-file-gate.v1');
  assert.equal(bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.PASS, 'STAGE02_GATE_PASS');

  const result = bridge.inspectDocxHostileFileGateFromZipBytes(zipBytes);

  assertExactShape(result);
  assert.equal(result.ok, true);
  assert.equal(result.schemaVersion, bridge.DOCX_HOSTILE_FILE_GATE_SCHEMA);
  assert.equal(result.status, 'accepted');
  assert.equal(result.decision, 'pass');
  assert.equal(result.code, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.PASS);
  assert.equal(result.reason, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.PASS);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.parse.attempted, false);
  assert.equal(result.parse.semanticAllowed, true);
});

test('Stage02 hostile file gate blocks duplicate entry names before semantic parse', async () => {
  const bridge = await loadBridge();
  const zipBytes = zipFixture([
    { name: 'word/document.xml', body: '<root/>' },
    { name: 'word/document.xml', body: '<root/>' },
  ]);

  const result = bridge.inspectDocxHostileFileGateFromZipBytes(zipBytes);

  assertExactShape(result);
  assert.equal(result.ok, false);
  assert.equal(result.code, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.DUPLICATE_ENTRY_NAME);
  assert.equal(result.parse.attempted, false);
  assert.equal(result.parse.semanticAllowed, false);
});

test('Stage02 hostile file gate blocks compression ratio bombs before semantic parse', async () => {
  const bridge = await loadBridge();
  const zipBytes = zipFixture([
    {
      name: 'word/document.xml',
      method: 8,
      body: `<root>${'a'.repeat(20000)}</root>`,
    },
  ]);

  const result = bridge.inspectDocxHostileFileGateFromZipBytes(zipBytes);

  assertExactShape(result);
  assert.equal(result.ok, false);
  assert.equal(result.code, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.COMPRESSION_RATIO_EXCEEDED);
  assert.equal(result.parse.attempted, false);
  assert.equal(result.parse.semanticAllowed, false);
});

test('Stage02 hostile file gate blocks declaration-level DTD and ignores late-layer ENTITY-like text', async () => {
  const bridge = await loadBridge();
  const dtdZip = zipFixture([
    {
      name: 'word/document.xml',
      body: '<?xml version="1.0"?><!DOCTYPE root><root/>',
    },
  ]);
  const lateTextZip = zipFixture([
    {
      name: 'word/document.xml',
      body: '<root>text <!ENTITY not-a-declaration></root>',
    },
  ]);

  const blocked = bridge.inspectDocxHostileFileGateFromZipBytes(dtdZip);
  const allowed = bridge.inspectDocxHostileFileGateFromZipBytes(lateTextZip);

  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.XML_DTD_DECLARATION_PRESENT);
  assert.equal(blocked.parse.attempted, false);
  assert.equal(blocked.parse.semanticAllowed, false);

  assert.equal(allowed.ok, true);
  assert.equal(allowed.code, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.PASS);
  assert.equal(allowed.parse.attempted, false);
  assert.equal(allowed.parse.semanticAllowed, true);
});

test('Stage02 hostile file gate blocks declaration-level ENTITY marker', async () => {
  const bridge = await loadBridge();
  const zipBytes = zipFixture([
    {
      name: 'word/document.xml',
      body: '<?xml version="1.0"?><!ENTITY stage02 "x"><root/>',
    },
  ]);

  const result = bridge.inspectDocxHostileFileGateFromZipBytes(zipBytes);

  assert.equal(result.ok, false);
  assert.equal(result.code, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.XML_ENTITY_DECLARATION_PRESENT);
  assert.equal(result.parse.attempted, false);
  assert.equal(result.parse.semanticAllowed, false);
});

test('Stage02 hostile file gate allows bounded ignored parts and quarantines unknown parts', async () => {
  const bridge = await loadBridge();
  const unknownPart = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', body: '<root/>' },
    { name: 'custom/item.bin', body: 'x' },
  ]));
  const wordSidePart = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', body: '<root/>' },
    { name: 'word/comments.xml', body: '<w:comments/>' },
    { name: 'word/commentsExtended.xml', body: '<w15:commentsEx/>' },
    { name: 'word/commentsIds.xml', body: '<w16cid:commentsIds/>' },
    { name: 'word/commentsExtensible.xml', body: '<w16cex:commentsExtensible/>' },
    { name: 'word/webSettings.xml', body: '<w:webSettings/>' },
    { name: 'word/people.xml', body: '<w15:people/>' },
  ]));
  const embeddedFontPart = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', body: '<root/>' },
    { name: '[Content_Types].xml', body: fontContentTypesXml() },
    { name: 'word/fontTable.xml', body: '<w:fonts/>' },
    { name: 'word/_rels/fontTable.xml.rels', body: fontRelationshipsXml() },
    { name: 'word/fonts/font1.odttf', body: Buffer.from([0, 1, 2, 3]) },
    { name: 'word/fonts/font1.ttf', body: TTF_BYTES },
  ]));
  const unsupportedFontPart = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', body: '<root/>' },
    { name: 'word/fonts/font1.woff', body: Buffer.from([0, 1, 2, 3]) },
  ]));
  const directoryPart = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', body: '<root/>' },
    { name: 'folder/', body: '' },
  ]));
  const unsupportedStory = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', body: '<root/>' },
    { name: 'word/comments.xml', body: '<comments/>' },
  ]));

  assert.equal(unknownPart.ok, false);
  assert.equal(unknownPart.decision, 'quarantined');
  assert.equal(unknownPart.code, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.PACKAGE_QUARANTINED);
  assert.equal(unsupportedFontPart.ok, false);
  assert.equal(unsupportedFontPart.decision, 'quarantined');
  assert.equal(unsupportedFontPart.code, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.PACKAGE_QUARANTINED);
  for (const result of [wordSidePart, embeddedFontPart, directoryPart, unsupportedStory]) {
    assert.equal(result.ok, true);
    assert.equal(result.decision, 'pass');
    assert.equal(result.code, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.PASS);
    assert.equal(result.parse.attempted, false);
    assert.equal(result.parse.semanticAllowed, true);
  }
});

test('Stage02 hostile file gate rejects invalid .ttf font admission controls before semantic parse', async () => {
  const bridge = await loadBridge();
  const fontType = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/font';
  const baseEntries = ({
    contentType = 'application/x-font-ttf',
    contentTypes = fontContentTypesXml(contentType),
    relationship = fontRelationshipsXml(),
    fontBody = TTF_BYTES,
    extras = [],
  } = {}) => [
    { name: 'word/document.xml', body: '<root/>' },
    { name: '[Content_Types].xml', body: contentTypes },
    { name: 'word/fontTable.xml', body: '<w:fonts/>' },
    ...(relationship === null ? [] : [{ name: 'word/_rels/fontTable.xml.rels', body: relationship }]),
    { name: 'word/fonts/font1.ttf', body: fontBody },
    ...extras,
  ];
  const cases = [
    ['bad-font-magic', baseEntries({ fontBody: BAD_TTF_BYTES })],
    ['bad-ttf-content-type', baseEntries({ contentType: 'application/octet-stream' })],
    ['missing-font-relationship', baseEntries({ relationship: null })],
    ['unbound-extra-font-part', baseEntries({
      extras: [{ name: 'word/fonts/unbound-evil.ttf', body: BAD_TTF_BYTES }],
    })],
    ['comment-only-font-relationships', baseEntries({
      relationship: `<Relationships><!-- <Relationship Id="rFont1" Type="${fontType}" Target="fonts/font1.ttf"/> --></Relationships>`,
    })],
    ['comment-only-ttf-content-type', baseEntries({
      contentTypes: '<Types><!-- <Default Extension="ttf" ContentType="application/x-font-ttf"/> --></Types>',
    })],
    ['shadow-namespaced-content-type', baseEntries({
      contentTypes: '<Types xmlns:evil="urn:evil"><Default Extension="ttf" evil:ContentType="application/x-font-ttf" ContentType="application/octet-stream"/></Types>',
    })],
    ['shadow-namespaced-relationship-type', baseEntries({
      relationship: `<Relationships xmlns:evil="urn:evil"><Relationship Id="rFont1" evil:Type="${fontType}" Type="urn:not-font" Target="fonts/font1.ttf"/></Relationships>`,
    })],
    ['malformed-unclosed-content-default', baseEntries({
      contentTypes: '<Types><Default Extension="ttf" ContentType="application/x-font-ttf"',
    })],
    ['truncated-four-byte-sfnt', baseEntries({
      fontBody: Buffer.from([0x00, 0x01, 0x00, 0x00]),
    })],
  ];

  for (const [caseId, entries] of cases) {
    const result = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture(entries));
    assert.equal(result.ok, false, caseId);
    assert.equal(result.decision, 'quarantined', caseId);
    assert.equal(result.code, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.PACKAGE_QUARANTINED, caseId);
    assert.equal(result.parse.attempted, false, caseId);
    assert.equal(result.parse.semanticAllowed, false, caseId);
    assert.equal(result.diagnostics.some((item) => (
      item.sourceCode === 'DOCX_UNKNOWN_PART_PRESENT'
    )), true, caseId);
  }
});

test('Stage02 hostile file gate distinguishes internal, safe hyperlink, and hostile external relationship targets', async () => {
  const bridge = await loadBridge();
  const internal = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', body: '<root/>' },
    { name: 'word/styles.xml', body: '<root/>' },
    {
      name: 'word/_rels/document.xml.rels',
      body: '<Relationships><Relationship Target="styles.xml"/></Relationships>',
    },
    { name: 'customXml/item1.xml', body: '<root/>' },
    { name: 'customXml/itemProps1.xml', body: '<root/>' },
    {
      name: 'customXml/_rels/item1.xml.rels',
      body: '<Relationships><Relationship Target="itemProps1.xml"/></Relationships>',
    },
  ]));
  const safeExternalHyperlink = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', body: '<root/>' },
    {
      name: 'word/_rels/document.xml.rels',
      body: '<Relationships><Relationship Id="rIdLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.invalid" TargetMode="External"/></Relationships>',
    },
  ]));
  const external = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', body: '<root/>' },
    {
      name: 'word/_rels/document.xml.rels',
      body: '<Relationships><Relationship Target="https://example.invalid" TargetMode="External"/></Relationships>',
    },
  ]));
  const encodedExternal = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', body: '<root/>' },
    {
      name: 'word/_rels/document.xml.rels',
      body: '<Relationships><Relationship Id="rIdLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.invalid" TargetMode="&#69;xternal"/></Relationships>',
    },
  ]));
  const attachedTemplateExternal = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', body: '<root/>' },
    {
      name: 'word/_rels/document.xml.rels',
      body: '<Relationships><Relationship Id="rIdTpl" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/attachedTemplate" Target="https://evil.invalid/template.dotx" TargetMode="External"/></Relationships>',
    },
  ]));
  const unsafeSchemeExternal = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', body: '<root/>' },
    {
      name: 'word/_rels/document.xml.rels',
      body: '<Relationships><Relationship Id="rIdLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="file:///etc/passwd" TargetMode="External"/></Relationships>',
    },
  ]));
  const customXmlExternal = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', body: '<root/>' },
    { name: 'customXml/item1.xml', body: '<root/>' },
    {
      name: 'customXml/_rels/item1.xml.rels',
      body: '<Relationships><Relationship Id="rIdLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.invalid" TargetMode="External"/></Relationships>',
    },
  ]));
  const malformedTargetMode = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', body: '<root/>' },
    {
      name: 'word/_rels/document.xml.rels',
      body: '<Relationships><Relationship Target="https://example.invalid" TargetMode=External/></Relationships>',
    },
  ]));

  assert.equal(internal.ok, true);
  assert.equal(internal.code, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.PASS);
  assert.equal(safeExternalHyperlink.ok, true);
  assert.equal(safeExternalHyperlink.code, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.PASS);
  assert.equal(safeExternalHyperlink.parse.semanticAllowed, true);
  assert.equal(external.ok, false);
  assert.equal(external.code, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.EXTERNAL_RELATIONSHIP_PRESENT);
  assert.equal(external.parse.attempted, false);
  assert.equal(external.parse.semanticAllowed, false);
  for (const result of [encodedExternal, attachedTemplateExternal, unsafeSchemeExternal, customXmlExternal, malformedTargetMode]) {
    assert.equal(result.ok, false);
    assert.equal(result.code, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.EXTERNAL_RELATIONSHIP_PRESENT);
    assert.equal(result.parse.attempted, false);
    assert.equal(result.parse.semanticAllowed, false);
  }
});

test('Stage02 hostile file gate rejects invalid internal relationship graph references', async () => {
  const bridge = await loadBridge();
  const drawingDocument = (relationshipId) => (
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><w:r><w:drawing><a:blip r:embed="${relationshipId}"/></w:drawing></w:r></w:p></w:body></w:document>`
  );
  const validEquivalent = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', body: drawingDocument('rImg9') },
    { name: 'word/media/image1.png', body: ONE_PIXEL_PNG },
    {
      name: 'word/_rels/document.xml.rels',
      body: '<Relationships><Relationship Id="rStyles" Target="styles.xml"/><Relationship Id="rImg9" Target="./media/../media/image1.png"/></Relationships>',
    },
    { name: 'word/styles.xml', body: '<root/>' },
  ]));
  const missingTarget = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', body: drawingDocument('rImgMissing') },
    {
      name: 'word/_rels/document.xml.rels',
      body: '<Relationships><Relationship Id="rImgMissing" Target="media/missing.png"/></Relationships>',
    },
  ]));
  const escapingTarget = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', body: drawingDocument('rImgEscape') },
    { name: 'word/media/image1.png', body: ONE_PIXEL_PNG },
    {
      name: 'word/_rels/document.xml.rels',
      body: '<Relationships><Relationship Id="rImgEscape" Target="../../evil.png"/></Relationships>',
    },
  ]));
  const unboundDocumentReference = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', body: drawingDocument('rImgUnbound') },
    { name: 'word/media/image1.png', body: ONE_PIXEL_PNG },
    {
      name: 'word/_rels/document.xml.rels',
      body: '<Relationships><Relationship Id="rImgActual" Target="media/image1.png"/></Relationships>',
    },
  ]));

  assert.equal(validEquivalent.ok, true);
  assert.equal(validEquivalent.code, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.PASS);
  assert.equal(missingTarget.ok, false);
  assert.equal(missingTarget.code, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.INTERNAL_RELATIONSHIP_TARGET_MISSING);
  assert.equal(missingTarget.parse.semanticAllowed, false);
  assert.equal(escapingTarget.ok, false);
  assert.equal(escapingTarget.code, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.INTERNAL_RELATIONSHIP_TARGET_UNSAFE);
  assert.equal(escapingTarget.parse.semanticAllowed, false);
  assert.equal(unboundDocumentReference.ok, false);
  assert.equal(unboundDocumentReference.code, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.UNBOUND_RELATIONSHIP_REFERENCE);
  assert.equal(unboundDocumentReference.parse.semanticAllowed, false);
});

test('Stage02 hostile file gate fails closed when declaration region exceeds scan budget', async () => {
  const bridge = await loadBridge();
  const longComment = '<!--' + 'x'.repeat(5000) + '-->';
  const zipBytes = zipFixture([
    {
      name: 'word/document.xml',
      body: `<?xml version="1.0"?>${longComment}<!DOCTYPE root><root/>`,
    },
  ]);

  const result = bridge.inspectDocxHostileFileGateFromZipBytes(zipBytes);

  assert.equal(result.ok, false);
  assert.equal(result.code, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.DECLARATION_SCAN_UNAVAILABLE);
  assert.equal(result.parse.semanticAllowed, false);
});

test('Stage02 hostile file gate ignores comment and PI noise before the root but still catches later DTD', async () => {
  const bridge = await loadBridge();
  const safeZip = zipFixture([
    {
      name: 'word/document.xml',
      body: '<?xml version="1.0"?><?probe ok?><!----><!-- <fake/> --><root/>',
    },
  ]);
  const hostileZip = zipFixture([
    {
      name: 'word/document.xml',
      body: '<?xml version="1.0"?><?probe ok?><!----><!-- <fake/> --><!DOCTYPE root><root/>',
    },
  ]);

  const safe = bridge.inspectDocxHostileFileGateFromZipBytes(safeZip);
  const hostile = bridge.inspectDocxHostileFileGateFromZipBytes(hostileZip);

  assert.equal(safe.ok, true);
  assert.equal(safe.code, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.PASS);
  assert.equal(hostile.ok, false);
  assert.equal(hostile.code, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.XML_DTD_DECLARATION_PRESENT);
});

test('Stage02 hostile file gate fails closed on inflated size mismatch', async () => {
  const bridge = await loadBridge();
  const zipBytes = zipFixture([
    {
      name: 'word/document.xml',
      method: 8,
      body: '<root>' + 'a'.repeat(5000) + '</root>',
      byteSize: 32,
    },
  ]);

  const result = bridge.inspectDocxHostileFileGateFromZipBytes(zipBytes);

  assert.equal(result.ok, false);
  assert.equal(result.code, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.DECLARATION_SCAN_UNAVAILABLE);
  assert.equal(result.parse.semanticAllowed, false);
});

test('Stage02 hostile file gate allows latest Word deflate compression option flags', async () => {
  const bridge = await loadBridge();
  const zipBytes = zipFixture([
    {
      name: 'word/document.xml',
      method: 8,
      flags: 6,
      body: '<root>latest Word deflate flags are not authority by themselves</root>',
    },
    {
      name: 'word/_rels/document.xml.rels',
      method: 8,
      flags: 6,
      body: '<Relationships><Relationship Target="styles.xml"/></Relationships>',
    },
    {
      name: 'word/styles.xml',
      method: 8,
      flags: 6,
      body: '<root/>',
    },
  ]);

  const result = bridge.inspectDocxHostileFileGateFromZipBytes(zipBytes);

  assert.equal(result.ok, true);
  assert.equal(result.code, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.PASS);
  assert.equal(result.parse.semanticAllowed, true);
});

test('Stage02 hostile file gate still rejects data-descriptor and unknown ZIP flags', async () => {
  const bridge = await loadBridge();
  const dataDescriptor = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', method: 8, flags: 8, body: '<root/>' },
  ]));
  const unknownFlag = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', method: 8, flags: 32, body: '<root/>' },
  ]));
  const storedWithDeflateFlags = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', method: 0, flags: 6, body: '<root/>' },
  ]));

  for (const result of [dataDescriptor, unknownFlag, storedWithDeflateFlags]) {
    assert.equal(result.ok, false);
    assert.equal(result.code, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.DECLARATION_SCAN_UNAVAILABLE);
    assert.equal(result.parse.semanticAllowed, false);
  }
});

test('Stage02 hostile file gate rejects unsupported ZIP methods on non-XML entries too', async () => {
  const bridge = await loadBridge();
  const zipBytes = zipFixture([
    { name: 'word/document.xml', body: '<root/>' },
    { name: 'custom/item.bin', body: 'x', method: 9 },
  ]);

  const result = bridge.inspectDocxHostileFileGateFromZipBytes(zipBytes);

  assert.equal(result.ok, false);
  assert.equal(result.code, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.DECLARATION_SCAN_UNAVAILABLE);
  assert.equal(result.parse.semanticAllowed, false);
});

test('Stage02 hostile file gate rejects backslash names and normalized duplicate names', async () => {
  const bridge = await loadBridge();
  const backslashName = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word\\document.xml', body: '<root/>' },
  ]));
  const normalizedDuplicate = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', body: '<root/>' },
    { name: 'WORD/DOCUMENT.XML', body: '<root/>' },
  ]));

  assert.equal(backslashName.ok, false);
  assert.equal(backslashName.code, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.PATH_TRAVERSAL_DETECTED);
  assert.equal(normalizedDuplicate.ok, false);
  assert.equal(normalizedDuplicate.code, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.DUPLICATE_ENTRY_NAME);
});

test('Stage02 hostile file gate blocks local-header encrypted flag and local flag mismatches', async () => {
  const bridge = await loadBridge();
  const encryptedLocal = zipFixture([
    { name: 'word/document.xml', body: '<root/>' },
  ]);
  encryptedLocal.writeUInt16LE(1, 6);

  const flagMismatch = zipFixture([
    { name: 'word/document.xml', body: '<root/>' },
  ]);
  flagMismatch.writeUInt16LE(8, 6);

  const encrypted = bridge.inspectDocxHostileFileGateFromZipBytes(encryptedLocal);
  const mismatched = bridge.inspectDocxHostileFileGateFromZipBytes(flagMismatch);

  assert.equal(encrypted.ok, false);
  assert.equal(encrypted.code, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.ENCRYPTED_ENTRY_PRESENT);
  assert.equal(mismatched.ok, false);
  assert.equal(mismatched.code, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.DECLARATION_SCAN_UNAVAILABLE);
});

test('Stage02 hostile file gate rejects empty archives as non-admissible containers', async () => {
  const bridge = await loadBridge();
  const result = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([]));

  assert.equal(result.ok, false);
  assert.equal(result.decision, 'quarantined');
  assert.equal(result.code, bridge.DOCX_HOSTILE_FILE_GATE_REASON_CODES.PACKAGE_QUARANTINED);
  assert.equal(result.parse.semanticAllowed, false);
});

test('Stage02 hostile file gate exposes only pre-parse runtime fields on blocked and quarantined results', async () => {
  const bridge = await loadBridge();
  const blocked = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([
    { name: 'word/document.xml', body: '<?xml version="1.0"?><!DOCTYPE root><root/>' },
  ]));
  const quarantined = bridge.inspectDocxHostileFileGateFromZipBytes(zipFixture([]));
  const forbiddenKeys = [
    'reviewPacket',
    'previewInput',
    'revisionBridgePreviewResult',
    'reviewBom',
    'reviewOpIr',
    'selectorStack',
    'apply',
    'applyPlan',
    'canApply',
    'writeStorage',
  ];

  for (const result of [blocked, quarantined]) {
    assertExactShape(result);
    const encoded = JSON.stringify(result);
    for (const key of forbiddenKeys) {
      assert.equal(encoded.includes(`"${key}"`), false);
    }
    assert.equal(result.parse.attempted, false);
  }
});
