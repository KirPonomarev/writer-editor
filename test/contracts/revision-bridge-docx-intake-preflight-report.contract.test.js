const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { deflateRawSync } = require('node:zlib');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = path.join(ROOT, 'src', 'io', 'revisionBridge', 'index.mjs');
const SECTION_START = '// RB_10_DOCX_INTAKE_PREFLIGHT_REPORT_START';
const SECTION_END = '// RB_10_DOCX_INTAKE_PREFLIGHT_REPORT_END';
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);
const TTF_BYTES = Buffer.from([
  0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x10,
  0x00, 0x00, 0x00, 0x00, 0x68, 0x65, 0x61, 0x64,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1c,
  0x00, 0x00, 0x00, 0x00,
]);

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

function normalizeEntry(entry) {
  const body = Buffer.isBuffer(entry.body)
    ? entry.body
    : utf8Bytes(typeof entry.body === 'string' ? entry.body : '');
  const method = entry.method ?? 0;
  const compressedBody = method === 8 ? deflateRawSync(body) : body;
  return {
    name: entry.name,
    method,
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
  header.writeUInt16LE(entry.flags ?? 0, 6);
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
  header.writeUInt16LE(entry.flags ?? 0, 8);
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

function cleanDocxZip(extraEntries = []) {
  return zipFixture([
    {
      name: 'word/document.xml',
      method: 8,
      body: '<w:document><w:body><w:p/></w:body></w:document>',
    },
    ...extraEntries,
  ]);
}

function fontContentTypesXml(contentType = 'application/x-font-ttf') {
  return `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="ttf" ContentType="${contentType}"/></Types>`;
}

function fontRelationshipsXml(target = 'fonts/font1.ttf') {
  return `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rFont1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="${target}"/></Relationships>`;
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

function assertPreParseReport(result) {
  assert.equal(result.schemaVersion, 'revision-bridge.docx-intake-preflight-report.v1');
  assert.equal(result.type, 'docxIntakePreflightReport');
  assert.equal(result.semanticParseNotRun, true);
  assert.equal(result.parse.attempted, false);
  assert.equal(result.parse.semanticAllowed, false);
  assert.equal(result.preflightSummary.semanticParseNotRun, true);
  assert.equal(result.preflightSummary.eligibility.canCreateReviewPacket, false);
  assert.equal(result.preflightSummary.eligibility.canPreviewApply, false);
  assert.equal(result.preflightSummary.eligibility.canImportMutate, false);
  assert.equal(result.preflightSummary.eligibility.canWriteStorage, false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'reviewPacket'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'reviewSurface'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'applyOps'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'inventory'), false);
}

test('DOCX intake preflight report: clean minimal package is parser-candidate only', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildDocxIntakePreflightReportFromZipBytes(cleanDocxZip());

  assertPreParseReport(result);
  assert.equal(result.ok, true);
  assert.equal(result.status, 'accepted');
  assert.equal(result.decision, 'accepted');
  assert.equal(result.code, 'DOCX_PART_POLICY_ACCEPTED');
  assert.equal(result.gatePass, true);
  assert.equal(result.gate.code, 'STAGE02_GATE_PASS');
  assert.equal(result.packageInspection.classification, 'clean');
  assert.equal(result.partPolicy.decision, 'accepted');
  assert.equal(result.preflightSummary.eligibility.safe, true);
  assert.equal(result.preflightSummary.eligibility.parserCandidateOnly, true);
  assert.deepEqual(result.preflightSummary.inventory.categoryCounts.mainDocumentPart, 1);
});

test('DOCX intake preflight report: media stays degraded diagnostics only', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildDocxIntakePreflightReportFromZipBytes(cleanDocxZip([
    { name: 'word/media/image1.png', body: 'png' },
  ]));
  const embeddedFont = bridge.buildDocxIntakePreflightReportFromZipBytes(cleanDocxZip([
    { name: '[Content_Types].xml', body: fontContentTypesXml() },
    { name: 'word/fontTable.xml', body: '<w:fonts/>' },
    { name: 'word/_rels/fontTable.xml.rels', body: fontRelationshipsXml() },
    { name: 'word/fonts/font1.odttf', body: Buffer.from([0, 1, 2, 3]) },
    { name: 'word/fonts/font1.ttf', body: TTF_BYTES },
  ]));

  assertPreParseReport(result);
  assert.equal(result.ok, true);
  assert.equal(result.gatePass, true);
  assert.equal(result.status, 'degraded');
  assert.equal(result.decision, 'degraded');
  assert.equal(result.code, 'DOCX_PART_POLICY_MEDIA_DIAGNOSTICS_ONLY');
  assert.equal(result.partPolicy.eligibility.parserCandidateOnly, true);
  assert.equal(result.preflightSummary.eligibility.parserCandidateOnly, true);
  assert.equal(result.diagnostics.some((item) => (
    item.source === 'partPolicy' && item.code === 'DOCX_PART_POLICY_MEDIA_DIAGNOSTICS_ONLY'
  )), true);

  assertPreParseReport(embeddedFont);
  assert.equal(embeddedFont.ok, true);
  assert.equal(embeddedFont.gatePass, true);
  assert.equal(embeddedFont.status, 'degraded');
  assert.equal(embeddedFont.decision, 'degraded');
  assert.equal(embeddedFont.partPolicy.diagnostics.some((item) => (
    item.code === 'DOCX_PART_POLICY_EMBEDDED_FONT_DIAGNOSTICS_ONLY'
    && item.entryId === 'word/fonts/font1.ttf'
  )), true);
  assert.equal(embeddedFont.partPolicy.eligibility.parserCandidateOnly, true);
  assert.equal(embeddedFont.preflightSummary.eligibility.parserCandidateOnly, true);
  assert.equal(embeddedFont.preflightSummary.inventory.categoryCounts.fontPart, 2);
  assert.equal(embeddedFont.diagnostics.some((item) => (
    item.source === 'partPolicy' && item.code === 'DOCX_PART_POLICY_EMBEDDED_FONT_DIAGNOSTICS_ONLY'
  )), true);
});

test('DOCX intake preflight report: adversarial .ttf admission is blocked before semantic parse', async () => {
  const bridge = await loadBridge();
  const fontType = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/font';
  const adversarialFontZip = ({
    contentTypes = fontContentTypesXml(),
    relationship = fontRelationshipsXml(),
    fontBody = TTF_BYTES,
  } = {}) => cleanDocxZip([
    { name: '[Content_Types].xml', body: contentTypes },
    { name: 'word/fontTable.xml', body: '<w:fonts/>' },
    ...(relationship === null ? [] : [{ name: 'word/_rels/fontTable.xml.rels', body: relationship }]),
    { name: 'word/fonts/font1.ttf', body: fontBody },
  ]);
  const cases = [
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

  for (const [caseId, bytes] of cases) {
    const result = bridge.buildDocxIntakePreflightReportFromZipBytes(bytes);
    assertPreParseReport(result);
    assert.equal(result.ok, false, caseId);
    assert.equal(result.gatePass, false, caseId);
    assert.equal(result.status, 'rejected', caseId);
    assert.equal(result.decision, 'quarantined', caseId);
    assert.equal(result.code, 'STAGE02_PACKAGE_QUARANTINED', caseId);
    assert.equal(result.preflightSummary.eligibility.parserCandidateOnly, false, caseId);
    assert.equal(result.preflightSummary.eligibility.canImportMutate, false, caseId);
    assert.equal(result.preflightSummary.eligibility.canWriteStorage, false, caseId);
    assert.equal(result.diagnostics.some((item) => (
      item.code === 'STAGE02_PACKAGE_QUARANTINED'
      && item.sourceCode === 'DOCX_UNKNOWN_PART_PRESENT'
    )), true, caseId);
  }
});

test('DOCX intake preflight report: bounded degraded parts become content-only candidates', async () => {
  const bridge = await loadBridge();
  const relationship = bridge.buildDocxIntakePreflightReportFromZipBytes(cleanDocxZip([
    { name: 'word/_rels/document.xml.rels', body: '<Relationships/>' },
  ]));
  const customProperties = bridge.buildDocxIntakePreflightReportFromZipBytes(cleanDocxZip([
    {
      name: 'docProps/custom.xml',
      body: '<Properties><property name="YRTK_C01_AUTH"><vt:lpwstr>YRTK1.synthetic</vt:lpwstr></property></Properties>',
    },
  ]));
  const unknown = bridge.buildDocxIntakePreflightReportFromZipBytes(cleanDocxZip([
    { name: 'custom/item.bin', body: 'x' },
  ]));
  const unsupportedStory = bridge.buildDocxIntakePreflightReportFromZipBytes(cleanDocxZip([
    { name: 'word/header1.xml', body: '<w:hdr/>' },
  ]));
  const externalRelationship = bridge.buildDocxIntakePreflightReportFromZipBytes(cleanDocxZip([
    {
      name: 'word/_rels/document.xml.rels',
      body: '<Relationships><Relationship Target="https://example.invalid" TargetMode="External"/></Relationships>',
    },
  ]));
  const safeExternalHyperlink = bridge.buildDocxIntakePreflightReportFromZipBytes(cleanDocxZip([
    {
      name: 'word/_rels/document.xml.rels',
      body: '<Relationships><Relationship Id="rIdLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.invalid" TargetMode="External"/></Relationships>',
    },
  ]));
  const equivalentInternalRelationship = bridge.buildDocxIntakePreflightReportFromZipBytes(zipFixture([
    {
      name: 'word/document.xml',
      method: 8,
      body: '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><w:r><w:drawing><a:blip r:embed="rImg9"/></w:drawing></w:r></w:p></w:body></w:document>',
    },
    { name: 'word/media/image1.png', body: ONE_PIXEL_PNG },
    { name: 'word/styles.xml', body: '<w:styles/>' },
    {
      name: 'word/_rels/document.xml.rels',
      body: '<Relationships><Relationship Id="rStyles" Target="styles.xml"/><Relationship Id="rImg9" Target="./media/../media/image1.png"/></Relationships>',
    },
  ]));
  const attachedTemplateExternal = bridge.buildDocxIntakePreflightReportFromZipBytes(cleanDocxZip([
    {
      name: 'word/_rels/document.xml.rels',
      body: '<Relationships><Relationship Id="rIdTpl" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/attachedTemplate" Target="https://evil.invalid/template.dotx" TargetMode="External"/></Relationships>',
    },
  ]));
  const missingMainDocument = bridge.buildDocxIntakePreflightReportFromZipBytes(zipFixture([
    { name: 'word/styles.xml', body: '<w:styles/>' },
  ]));

  for (const result of [relationship, safeExternalHyperlink, equivalentInternalRelationship, unsupportedStory]) {
    assertPreParseReport(result);
    assert.equal(result.ok, true);
    assert.equal(result.gatePass, true);
    assert.equal(result.status, 'degraded');
    assert.equal(result.preflightSummary.eligibility.parserCandidateOnly, true);
    assert.equal(result.preflightSummary.eligibility.canImportMutate, false);
    assert.equal(result.preflightSummary.eligibility.canWriteStorage, false);
  }
  for (const result of [externalRelationship, attachedTemplateExternal, unknown, missingMainDocument]) {
    assertPreParseReport(result);
    assert.equal(result.ok, false);
    assert.equal(result.gatePass, false);
    assert.equal(result.preflightSummary.eligibility.parserCandidateOnly, false);
    assert.equal(result.preflightSummary.eligibility.canImportMutate, false);
    assert.equal(result.preflightSummary.eligibility.canWriteStorage, false);
  }
  assert.equal(relationship.code, 'DOCX_PART_POLICY_RELATIONSHIP_DIAGNOSTICS_ONLY');
  assert.equal(safeExternalHyperlink.code, 'DOCX_PART_POLICY_RELATIONSHIP_DIAGNOSTICS_ONLY');
  assert.equal(equivalentInternalRelationship.code, 'DOCX_PART_POLICY_RELATIONSHIP_DIAGNOSTICS_ONLY');
  assert.equal(customProperties.ok, true);
  assert.equal(customProperties.gatePass, true);
  assert.equal(customProperties.partPolicy.categories.knownSupportPart.entryIds.includes('docProps/custom.xml'), true);
  assert.equal(customProperties.preflightSummary.eligibility.parserCandidateOnly, true);
  assert.equal(externalRelationship.code, 'STAGE02_EXTERNAL_RELATIONSHIP_PRESENT');
  assert.equal(attachedTemplateExternal.code, 'STAGE02_EXTERNAL_RELATIONSHIP_PRESENT');
  assert.equal(unknown.code, 'STAGE02_PACKAGE_QUARANTINED');
  assert.equal(unsupportedStory.code, 'DOCX_PART_POLICY_UNSUPPORTED_STORY_DIAGNOSTICS_ONLY');
  assert.equal(missingMainDocument.code, 'STAGE02_PACKAGE_QUARANTINED');
});

test('DOCX intake preflight report: hostile containers stay blocked before semantic parse', async () => {
  const bridge = await loadBridge();
  const duplicate = bridge.buildDocxIntakePreflightReportFromZipBytes(zipFixture([
    { name: 'word/document.xml', body: '<root/>' },
    { name: 'WORD/DOCUMENT.XML', body: '<root/>' },
  ]));
  const traversal = bridge.buildDocxIntakePreflightReportFromZipBytes(zipFixture([
    { name: 'word\\document.xml', body: '<root/>' },
  ]));
  const dtd = bridge.buildDocxIntakePreflightReportFromZipBytes(cleanDocxZip([
    { name: 'word/styles.xml', body: '<?xml version="1.0"?><!DOCTYPE root><root/>' },
  ]));
  const entity = bridge.buildDocxIntakePreflightReportFromZipBytes(cleanDocxZip([
    { name: 'word/styles.xml', body: '<?xml version="1.0"?><!ENTITY stage02 "x"><root/>' },
  ]));
  const bomb = bridge.buildDocxIntakePreflightReportFromZipBytes(cleanDocxZip([
    {
      name: 'word/styles.xml',
      method: 8,
      body: `<root>${'a'.repeat(20000)}</root>`,
    },
  ]));
  const missingRelationshipTarget = bridge.buildDocxIntakePreflightReportFromZipBytes(zipFixture([
    {
      name: 'word/document.xml',
      body: '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p/></w:body></w:document>',
    },
    {
      name: 'word/_rels/document.xml.rels',
      body: '<Relationships><Relationship Id="rImgMissing" Target="media/missing.png"/></Relationships>',
    },
  ]));
  const escapingRelationshipTarget = bridge.buildDocxIntakePreflightReportFromZipBytes(zipFixture([
    {
      name: 'word/document.xml',
      body: '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p/></w:body></w:document>',
    },
    { name: 'word/media/image1.png', body: ONE_PIXEL_PNG },
    {
      name: 'word/_rels/document.xml.rels',
      body: '<Relationships><Relationship Id="rImgEscape" Target="../../evil.png"/></Relationships>',
    },
  ]));
  const unboundRelationshipReference = bridge.buildDocxIntakePreflightReportFromZipBytes(zipFixture([
    {
      name: 'word/document.xml',
      body: '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><w:r><w:drawing><a:blip r:embed="rImgUnbound"/></w:drawing></w:r></w:p></w:body></w:document>',
    },
    { name: 'word/media/image1.png', body: ONE_PIXEL_PNG },
    {
      name: 'word/_rels/document.xml.rels',
      body: '<Relationships><Relationship Id="rImgActual" Target="media/image1.png"/></Relationships>',
    },
  ]));

  const expected = [
    [duplicate, 'STAGE02_DUPLICATE_ENTRY_NAME'],
    [traversal, 'STAGE02_PATH_TRAVERSAL_DETECTED'],
    [dtd, 'STAGE02_XML_DTD_DECLARATION_PRESENT'],
    [entity, 'STAGE02_XML_ENTITY_DECLARATION_PRESENT'],
    [bomb, 'STAGE02_COMPRESSION_RATIO_EXCEEDED'],
    [missingRelationshipTarget, 'STAGE02_INTERNAL_RELATIONSHIP_TARGET_MISSING'],
    [escapingRelationshipTarget, 'STAGE02_INTERNAL_RELATIONSHIP_TARGET_UNSAFE'],
    [unboundRelationshipReference, 'STAGE02_UNBOUND_RELATIONSHIP_REFERENCE'],
  ];

  for (const [result, code] of expected) {
    assertPreParseReport(result);
    assert.equal(result.ok, false);
    assert.equal(result.gatePass, false);
    assert.equal(result.code, code);
    assert.equal(result.gate.parse.attempted, false);
    assert.equal(result.preflightSummary.eligibility.parserCandidateOnly, false);
  }
});

test('DOCX intake preflight report: malformed input returns bounded report without throwing', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildDocxIntakePreflightReportFromZipBytes('review.docx');

  assertPreParseReport(result);
  assert.equal(result.ok, false);
  assert.equal(result.gatePass, false);
  assert.equal(result.status, 'rejected');
  assert.equal(result.decision, 'quarantined');
  assert.equal(result.code, 'STAGE02_PACKAGE_MALFORMED');
  assert.equal(result.packageInspection, null);
  assert.equal(result.partPolicy, null);
  assert.equal(result.preflightSummary.inventory.entryCount, 0);
});

test('DOCX intake preflight report: output is deterministic and input is not mutated', async () => {
  const bridge = await loadBridge();
  const input = cleanDocxZip();
  const before = Buffer.from(input);
  const first = bridge.buildDocxIntakePreflightReportFromZipBytes(input);
  const second = bridge.buildDocxIntakePreflightReportFromZipBytes(input);

  assert.deepEqual(first, second);
  assert.equal(input.equals(before), true);
});

test('DOCX intake preflight report: result and implementation stay out of parser import storage layers', async () => {
  const bridge = await loadBridge();
  const result = bridge.buildDocxIntakePreflightReportFromZipBytes(cleanDocxZip());
  const resultKeys = collectKeys(result);
  const forbiddenResultKeys = [
    'reviewPacket',
    'reviewSurface',
    'applyOps',
    'canApply',
    'writeReceipt',
    'exportReceipt',
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
    'applyOps',
    'canApply: true',
  ];

  for (const marker of forbiddenRuntimeMarkers) {
    assert.equal(section.includes(marker), false, `${marker} must stay out of preflight report contour`);
  }
});
