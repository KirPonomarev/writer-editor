'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { buildStoredZip, buildDocxMinBuffer } = require('../../src/export/docx/docxMinBuilder.js');
const { createImageAttrs } = require('../../src/io/documentMedia.js');
const { buildDocxRunContentXml } = require('../../src/export/docx/docxTextXml.js');
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const modules = Promise.all([
  import('../../src/io/revisionBridge/index.mjs'),
  import('../../src/renderer/documentContentEnvelope.mjs'),
  import('../../src/docxPageSetupBind.mjs'),
  import('../../src/derived/semanticMapping.mjs'),
  import('../../src/derived/styleMap.mjs'),
]);
function pack(body, prefix = 'w') {
  return buildStoredZip([
    { name: '[Content_Types].xml', data: '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: '_rels/.rels', data: '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/document.xml', data: `<${prefix}:document xmlns:${prefix}="${W}"><${prefix}:body>${body}</${prefix}:body></${prefix}:document>` },
  ]);
}
async function preview(bytes) {
  const [bridge, envelope] = await modules;
  const report = bridge.buildDocxContentPreviewFromZipBytes(bytes);
  assert.equal(report.ok, true, JSON.stringify(report));
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(report);
  assert.equal(plan.ok, true, JSON.stringify(plan));
  const content = plan.candidateCreatePlan.entries[0].content;
  return { report, plan, content, doc: envelope.parseObservablePayload(content).doc };
}
async function exportDoc(doc) {
  const [, , docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await modules;
  return buildDocxMinBuffer({ doc, bookProfile: { formatId: 'A4' } }, { docxPageSetupBindModule, semanticMappingModule, styleMapModule });
}

for (const [atom, expected] of [['cr', '\n'], ['noBreakHyphen', '\u2011'], ['softHyphen', '\u00ad']]) {
  test(`Word audit: generic ${atom} is real text, not silently omitted`, async () => {
    const { report } = await preview(pack(`<w:p><w:r><w:t>left</w:t><w:${atom}/><w:t>right</w:t></w:r></w:p>`));
    assert.equal(report.contentPreview.paragraphs[0].text, `left${expected}right`);
  });
}

test('Word audit: styled namespace aliases, repeated breaks, Unicode and empty paragraphs survive five cycles', async () => {
  let { doc } = await preview(pack('<q:p><q:r><q:rPr><q:b/></q:rPr><q:cr/><q:t>A日本語 é</q:t><q:noBreakHyphen/><q:t>B</q:t><q:softHyphen/><q:t>C</q:t><q:cr/><q:cr/></q:r></q:p><q:p/>', 'q'));
  const expected = { type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'hardBreak' }, { type: 'text', text: 'A日本語 é\u2011B\u00adC', marks: [{ type: 'bold' }] }, { type: 'hardBreak' }, { type: 'hardBreak' }] },
    { type: 'paragraph', content: [] },
  ] };
  assert.deepEqual(doc, expected);
  for (let i = 0; i < 5; i++) { ({ doc } = await preview(await exportDoc(doc))); assert.deepEqual(doc, expected, `cycle ${i + 1}`); }
});

test('Word audit: export uses native Word hyphen atoms and preserves neighboring text', () => {
  assert.equal(buildDocxRunContentXml('A\u2011B\u00adC'), '<w:t xml:space="preserve">A</w:t><w:noBreakHyphen/><w:t xml:space="preserve">B</w:t><w:softHyphen/><w:t xml:space="preserve">C</w:t>');
});

test('Word audit: hyphen atoms count in both PNG placements without changing bytes or dimensions', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAICAYAAADwdn+XAAAAFklEQVR4nGP4z8DwHx8mAo4aMPQNAADNZv8BGUNAhgAAAABJRU5ErkJggg==', 'base64');
  const image = (alt, width, height) => ({ type: 'image', attrs: createImageAttrs(png, { alt, displayName: 'same.png', displayWidthEmu: width, displayHeightEmu: height }) });
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'A\u2011B\u00adC' }, image('one', 228600, 114300),
    { type: 'hardBreak' }, { type: 'text', text: 'D\u00adE\u2011F' }, image('two', 304800, 152400), { type: 'text', text: 'tail' },
  ] }] };
  const { doc: actual } = await preview(await exportDoc(doc));
  assert.deepEqual(actual, doc);
});

test('Word audit: namespace spoofing and atoms outside a run cannot supply imported text', async () => {
  const [bridge] = await modules;
  for (const atom of ['cr', 'noBreakHyphen', 'softHyphen']) {
    for (const body of [
      `<w:p><w:r><w:t>a</w:t><w:${atom} xmlns:w="urn:foreign"/><w:t>b</w:t></w:r></w:p>`,
      `<w:p><w:r><w:t>a</w:t></w:r><w:${atom}/><w:r><w:t>b</w:t></w:r></w:p>`,
    ]) {
      const report = bridge.buildDocxContentPreviewFromZipBytes(pack(body));
      assert.equal(report.ok, false, JSON.stringify({ atom, report }));
      assert.equal(bridge.buildDocxImportPreviewPlanFromContentPreview(report).ok, false);
    }
  }
});

test('Word audit: foreign Symbol glyph and positioned-tab losses must be explicit', async () => {
  for (const [atom, attrs] of [['sym', 'w:font="Wingdings" w:char="F04A"'], ['ptab', 'w:alignment="right" w:relativeTo="margin" w:leader="none"']]) {
    const { plan, report } = await preview(pack(`<w:p><w:r><w:t>left</w:t><w:${atom} ${attrs}/><w:t>right</w:t></w:r></w:p>`));
    assert.equal(report.diagnostics.some(d => d.tagName === `w:${atom}`), true, `No silent ${atom} loss`);
    assert.equal(plan.lossReport.items.some(d => d.tagName === `w:${atom}` && d.severity === 'warning'), true);
  }
});

test('Word audit: native atoms survive real fenced persistence and idempotent replay', async t => {
  const { applyDocxImportSafeCreate, rememberDocxImportPreviewPlanAdmission } = require('../fixtures/docx-import-real-authority.cjs');
  const { plan, doc } = await preview(pack('<w:p><w:r><w:t>A</w:t><w:noBreakHyphen/><w:t>B</w:t><w:softHyphen/><w:t>C</w:t><w:cr/><w:t>D</w:t></w:r></w:p>'));
  const [, envelope] = await modules;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'word-atom-persistence-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const options = { projectRoot: root, romanRoot: path.join(root, 'roman'), projectId: 'word-atom-audit' };
  rememberDocxImportPreviewPlanAdmission(plan);
  const result = await applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, options);
  assert.equal(result.ok, true, JSON.stringify(result));
  const directory = path.join(options.romanRoot, 'Imported');
  const files = fs.readdirSync(directory).filter(f => f.endsWith('.txt'));
  assert.equal(files.length, 1);
  const saved = fs.readFileSync(path.join(directory, files[0]), 'utf8');
  assert.deepEqual(envelope.parseObservablePayload(saved).doc, doc);
  const replay = await applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, options);
  assert.equal(replay.ok, true, JSON.stringify(replay));
  assert.equal(replay.value.idempotent, true);
  assert.equal(fs.readFileSync(path.join(directory, files[0]), 'utf8'), saved);
  assert.deepEqual((await preview(await exportDoc(doc))).doc, doc);
});

const stable = value => Array.isArray(value) ? `[${value.map(stable).join(',')}]`
  : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}` : JSON.stringify(value);
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const cryptoPort = { sha256Text: sha, sha256Json: value => `sha256:${sha(stable(value))}`, byteLength: value => Buffer.byteLength(value),
  hmacSha256Text: (value, secret) => `hmac-sha256:${crypto.createHmac('sha256', secret).update(value).digest('hex')}`,
  hmacSha256Json: (value, secret) => `hmac-sha256:${crypto.createHmac('sha256', secret).update(stable(value)).digest('hex')}` };

test('Word audit: return formatting scanner counts atom positions and ignores foreign text', async () => {
  const { extractReviewTransportFormattingRunsV2 } = await import('../../src/io/revisionBridge/reviewTransportPackageParserV2.mjs');
  const xml = `<w:document xmlns:w="${W}" xmlns:x="urn:foreign"><w:body><w:p><w:r><w:t>A</w:t><w:noBreakHyphen/><w:t>B</w:t><w:softHyphen/><w:t>C</w:t><w:cr/><w:t>D</w:t><x:t>NOT WORD TEXT</x:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>bold</w:t></w:r></w:p></w:body></w:document>`;
  const result = extractReviewTransportFormattingRunsV2(xml, { cryptoPort });
  assert.equal(result.ok, true, JSON.stringify(result));
  const paragraph = result.paragraphs[0];
  assert.equal(paragraph.paragraphText, 'A\u2011B\u00adC\nDbold');
  assert.equal(paragraph.formattedRuns[1].from, 7);
  assert.equal(paragraph.formattedRuns[1].to, 11);
});

test('Word audit: manual review candidates retain hyphens in both quoted and replacement text', async () => {
  const [bridge] = await modules;
  const bytes = pack('<w:p><w:del w:id="1" w:author="reviewer"><w:r><w:delText>old</w:delText><w:noBreakHyphen/><w:delText>text</w:delText></w:r></w:del><w:ins w:id="2" w:author="reviewer"><w:r><w:t>new</w:t><w:softHyphen/><w:t>text</w:t></w:r></w:ins></w:p>');
  const result = bridge.buildDocxReviewPreviewSessionCandidateFromZipBytes(bytes, {
    targetScope: { type: 'scene', id: 'roman/imported/scene-1.txt' }, createdAt: '2026-09-26T09:00:00.000Z',
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.reviewPacket.textChanges.length, 1);
  assert.equal(result.reviewPacket.textChanges[0].match.quote, 'old\u2011text');
  assert.equal(result.reviewPacket.textChanges[0].replacementText, 'new\u00adtext');
  assert.equal(result.canAutoApply, false);
  assert.equal(result.canImportMutate, false);
  assert.equal(result.canWriteStorage, false);
});

test('Word audit: authenticated review export preserves hyphen text and canonical footnote bodies', async () => {
  const { buildFullManuscriptDocxReviewPacketSource } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource');
  const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder');
  const { validateDocumentNotesReturn } = require('../../src/export/docx/docxReviewPacketNotes');
  const [bridge] = await modules;
  const sceneId = 'roman/chapter/a.txt';
  const input = { projectId: 'word-atom-review', projectRoot: '/synthetic', scenes: [
    { sceneId, scenePath: '/synthetic/roman/chapter/a.txt', text: 'A\u2011B\u00adC', order: 0 },
  ], notesDocument: { schemaVersion: 1, projectId: 'word-atom-review', notes: [
    { id: 'note-atom', scope: 'scene', title: 'T\u2011U', body: 'X\u00adY\nZ', deleted: false, attachment: { scope: 'scene', sceneId, nodeId: 'node-a' } },
  ] }, documentNoteSelections: [{ noteId: 'note-atom', kind: 'footnote' }] };
  const source = buildFullManuscriptDocxReviewPacketSource(input, { revisionBridge: bridge, cryptoPort });
  const bytes = buildDocxReviewPacketBuffer(source);
  const parsed = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes, hmacSecret: source.forbiddenSecret,
    expectedAuthority: source.localAuthorityCapsule.expectedAuthority }, { cryptoPort });
  assert.equal(parsed.ok, true, JSON.stringify(parsed.reasons));
  assert.equal(parsed.reviewIr.formattingParagraphs[0].paragraphText, input.scenes[0].text);
  const verified = validateDocumentNotesReturn({ expected: source.localAuthorityCapsule.documentNotes,
    returned: parsed.reviewIr.documentNotes, signedDigest: parsed.authorityCarrier?.selectedCarrier?.payload?.documentNotesDigest });
  assert.equal(verified.ok, true, JSON.stringify(verified));
  assert.deepEqual(parsed.reviewIr.documentNotes.notes[0].paragraphs, ['T\u2011U', 'X\u00adY\nZ']);
});

test('Word audit: authenticated hyperlink labels retain their full text and exact target', async () => {
  const { buildFullManuscriptDocxReviewPacketSource } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource');
  const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder');
  const [bridge, envelope] = await modules;
  const href = 'https://example.invalid/reference';
  const text = 'A\u2011B\u00adC';
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text, marks: [{ type: 'link', attrs: { href } }] }] }] };
  const raw = envelope.composeObservablePayload({ doc });
  const normalized = envelope.parseObservablePayload(raw);
  const source = buildFullManuscriptDocxReviewPacketSource({ projectId: 'word-atom-link', projectRoot: '/synthetic', scenes: [
    { sceneId: 'roman/a.txt', scenePath: '/synthetic/roman/a.txt', text: normalized.text, doc: normalized.doc, observableContent: raw, order: 0 },
  ] }, { revisionBridge: bridge, cryptoPort });
  const bytes = buildDocxReviewPacketBuffer(source);
  const result = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes,
    hmacSecret: source.forbiddenSecret, expectedAuthority: source.localAuthorityCapsule.expectedAuthority }, { cryptoPort });
  assert.equal(result.ok, true, JSON.stringify(result.reasons));
  assert.equal(result.reviewIr.formattingParagraphs[0].paragraphText, text);
  assert.equal(result.reviewIr.formattingDeltas.find(d => d.formatKind === 'hyperlink').values.text, text);
  const extracted = bridge.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes }, { cryptoPort });
  assert.equal(extracted.ok, true);
  assert.match(extracted.parts['word/_rels/document.xml.rels'], /Target="https:\/\/example\.invalid\/reference"/u);
});
