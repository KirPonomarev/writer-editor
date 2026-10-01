'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const media = require('../../src/io/documentMedia.js');
const model = require('../../src/core/word-media-return-v1.cjs');
const jpeg = require('../fixtures/document-jpeg-fixtures.cjs');
const attrs = () => media.createImageAttrs(jpeg.rgb, { alt: 'original', displayName: 'same.jpg' });
const text = value => ({ type: 'text', text: value, marks: [{ type: 'bold' }] });
const doc = () => ({ type: 'doc', attrs: { wordUserBookmarks: null }, content: [
  { type: 'paragraph', attrs: { textAlign: 'center' }, content: [text('A🙂'), { type: 'image', attrs: attrs() }, text(' B')] },
  { type: 'paragraph', content: [text('untouched')] },
] });
const row = (a = attrs(), offset = 3) => ({ paragraphIndex: 0, offset, attrs: a });

test('media return: add, delete, replace and resize preserve source and all nonmedia data', () => {
  for (const placements of [[row(), row(attrs(), 5)], [], [row(media.createImageAttrs(jpeg.gray))],
    [row({ ...attrs(), displayWidthEmu: 1800000, displayHeightEmu: 1200000 })]]) {
    const before = doc(), saved = JSON.stringify(before), plan = model.planMediaReturn({ beforeDoc: before, placements });
    assert.equal(plan.changed, true); assert.equal(JSON.stringify(before), saved);
    assert.deepEqual(model.mediaPlacements(plan.doc), placements);
    assert.deepEqual(plan.doc.content[1], before.content[1]);
    assert.deepEqual(plan.doc.attrs, before.attrs);
    assert.deepEqual(plan.doc.content[0].attrs, before.content[0].attrs);
    assert.equal(plan.doc.content[0].content.filter(n => n.type === 'text').map(n => n.text).join(''), 'A🙂 B');
    for (const n of plan.doc.content[0].content.filter(n => n.type === 'text')) assert.deepEqual(n.marks, [{ type: 'bold' }]);
  }
});
test('media return: ordered repeated placements, text splitting, boundary positions and no-op', () => {
  const before = doc(), placements = [row(attrs(), 0), row(attrs(), 1), row(attrs(), 1), row(attrs(), 5)];
  const plan = model.planMediaReturn({ beforeDoc: before, placements });
  assert.deepEqual(model.mediaPlacements(plan.doc), placements);
  assert.equal(model.planMediaReturn({ beforeDoc: plan.doc, placements }).changed, false);
  assert.deepEqual(model.planMediaReturn({ beforeDoc: before, placements: [row()] }).doc, before);
});
test('media return: reject unsafe coordinates, unsupported atoms and forged binary identity', () => {
  for (const placements of [[row(attrs(), 2)], [row(attrs(), 6)], [row(attrs(), -1)],
    [{ ...row(), paragraphIndex: 2 }], [row(attrs(), 3), row(attrs(), 1)],
    [row({ ...attrs(), sha256: '0'.repeat(64) })], [row({ ...attrs(), assetPath: '../foreign.jpg' })],
    [row({ ...attrs(), displayWidthEmu: 0, displayHeightEmu: 1 })]]) {
    const before = doc(), frozen = JSON.stringify(before);
    assert.throws(() => model.planMediaReturn({ beforeDoc: before, placements }));
    assert.equal(JSON.stringify(before), frozen);
  }
  const before = doc(); before.content[0].content.push({ type: 'unknownAtom' });
  assert.throws(() => model.planMediaReturn({ beforeDoc: before, placements: [] }), /INLINE_COMPOSITE/);
});

test('media return IO: actual product package admits changed size and rejects nonmedia or ownership changes', async () => {
  const io = await import('../../src/io/revisionBridge/index.mjs');
  const { analyzeMediaReturn } = await import('../../src/io/revisionBridge/reviewTransportMediaReturnV1.mjs');
  const envelope = require('../../src/core/document-content-envelope-v1.cjs');
  const { buildFullManuscriptDocxReviewPacketSource } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
  const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder.js');
  const { buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
  const crypto = require('node:crypto');
  const cryptoPort = { sha256Text: value => 'sha256:' + crypto.createHash('sha256').update(value).digest('hex'),
    sha256Json: value => 'sha256:' + crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'), byteLength: value => Buffer.byteLength(value) };
  const beforeDoc = doc(), product = buildFullManuscriptDocxReviewPacketSource({
    projectId: 'media-project', projectRoot: '/synthetic', manifestPath: '/synthetic/manifest.json',
    scenes: [{ sceneId: 'a.txt', scenePath: '/synthetic/a.txt', order: 0, title: 'A', doc: beforeDoc,
      text: envelope.deriveVisibleTextFromDocument(beforeDoc), observableContent: envelope.composeObservablePayload({ doc: beforeDoc }) }],
  }, { createdAtUtc: '2026-10-01T03:00:00.000Z', roundIdHex: 'a'.repeat(32), keyIdHex: 'b'.repeat(32), hmacSecret: 'synthetic-only' });
  const original = buildDocxReviewPacketBuffer(product);
  const map = io.bindUserBookmarkExportTransportPartsV1(product.localAuthorityCapsule.exportMap, original);
  const extracted = io.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes: original });
  for (const mode of ['same', 'resize', 'text', 'bold', 'owner', 'foreign-part', 'bad-bytes']) {
    const parts = { ...extracted.parts, ...extracted.binaryParts };
    let xml = parts['word/document.xml'];
    if (mode === 'resize') xml = xml.replaceAll('cx="180975"', 'cx="1800000"').replaceAll('cy="161925"', 'cy="1200000"');
    if (mode === 'text') xml = xml.replace('untouched', 'CHANGED');
    if (mode === 'bold') xml = xml.replaceAll('<w:b/>', '<w:b w:val="0"/>').replaceAll('<w:b w:val="1"/>', '<w:b w:val="0"/>');
    if (mode === 'owner') xml = xml.replace(/w:name="YRTK_[a-f0-9]{32}"/, 'w:name="FOREIGN"');
    if (mode === 'foreign-part') parts['customXml/foreign.xml'] = '<foreign/>';
    parts['word/document.xml'] = xml;
    const bytes = buildStoredZip(Object.entries(parts).map(([name, data]) => ({ name, data })));
    const parsed = io.buildDocxReviewTransportAnalysisFromZipBytes({ bytes }, { cryptoPort });
    if (mode === 'foreign-part' && !parsed.ok) continue;
    assert.equal(parsed.ok, true, mode + ': ' + JSON.stringify(parsed).slice(0, 500));
    const binaryParts = { ...extracted.binaryParts };
    if (mode === 'bad-bytes') binaryParts[Object.keys(binaryParts)[0]] = jpeg.gray;
    const result = analyzeMediaReturn({ beforeDocs: { 'a.txt': beforeDoc }, exportMap: map, reviewIr: parsed.reviewIr, binaryParts });
    assert.equal(result.ok, ['same', 'resize'].includes(mode), mode + ': ' + JSON.stringify(result).slice(0, 700));
    if (result.ok) {
      assert.equal(result.changed, mode === 'resize');
      if (result.changed) assert.equal(result.candidate.plan.after[0].attrs.displayWidthEmu, 1800000);
    }
  }
});
