'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const model = require('../../src/core/word-pending-text-revisions-v1.cjs');
const recording = require('../../src/core/word-pending-recording-v1.cjs');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const { buildStoredZip, buildDocxMinBuffer } = require('../../src/export/docx/docxMinBuilder.js');
const { buildFullManuscriptDocxReviewPacketSource } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder.js');
// Fresh full exports materialize this closed SOURCE-owned transport basis;
// generic imports observe it literally, while the saved authored source stays raw.
function expectedEmission(doc,profile='full') {
  if(profile==='minimum')return model.normalizeNode(doc);
  const typography=require('../../src/core/word-review-typography-v1.cjs');
  const expected=typography.document(model.normalizeNode(doc),typography.freshBodyTypography());
  expected.attrs={...expected.attrs,wordDefaultTabStop:doc.attrs?.wordDefaultTabStop??720};
  return model.normalizeNode(expected);
}
const modules = Promise.all([import('../../src/io/revisionBridge/index.mjs'), import('../../src/docxPageSetupBind.mjs'),
  import('../../src/derived/semanticMapping.mjs'), import('../../src/derived/styleMap.mjs')]);
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const provenance = 'w:author="Mac reviewer" w:date="2026-09-29T03:52:00Z"';
const run = text => text ? `<w:r><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:eastAsia="Aptos" w:cs="Aptos"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r>` : '';
const mark = (kind, id) => `<w:rPr><w:${kind} w:id="${id}" ${provenance}/></w:rPr>`;
const p = (text, kind = '', id = 0, align = 'left') => `<w:p><w:pPr><w:jc w:val="${align}"/>${kind ? mark(kind, id) : ''}</w:pPr>${run(text)}</w:p>`;
const row = (values, operation = '', id = 1) => `<w:tr>${operation ? `<w:trPr><w:${operation} w:id="${id}" ${provenance}/></w:trPr>` : ''}${values.map(value => `<w:tc><w:tcPr/>${p(value)}</w:tc>`).join('')}</w:tr>`;
const table = rows => `<w:tbl><w:tblPr/><w:tblGrid><w:gridCol/><w:gridCol/></w:tblGrid>${rows}</w:tbl>`;
const body = p('Rows') + table(row(['Keep A', 'Keep B']) + row(['Delete A', 'Delete B'], 'del', 1) + row(['Insert A', 'Insert B'], 'ins', 2) + row(['Last A', 'Last B']));
function pack(body) {
  return buildStoredZip([
    { name: '[Content_Types].xml', data: '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: '_rels/.rels', data: '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/document.xml', data: `<w:document xmlns:w="${W}" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"><w:body>${body}</w:body></w:document>` },
  ]);
}
async function parse(bytes) {
  const [bridge] = await modules, preview = bridge.buildDocxContentPreviewFromZipBytes(bytes);
  assert.equal(preview.ok, true, JSON.stringify(preview));
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(preview); assert.equal(plan.ok, true, JSON.stringify(plan));
  return envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc;
}
async function cycle(doc, profile) {
  const [, docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await modules;
  const bytes = profile === 'minimum' ? buildDocxMinBuffer({ doc, bookProfile: { formatId: 'A4' } },
    { docxPageSetupBindModule, semanticMappingModule, styleMapModule }) : buildDocxReviewPacketBuffer(
      buildFullManuscriptDocxReviewPacketSource({ projectId: 'boundaries', projectRoot: '/synthetic', scenes: [
        { sceneId: 'roman/a.txt', scenePath: '/synthetic/roman/a.txt', doc, text: envelope.deriveVisibleTextFromDocument(doc), order: 0 },
      ] }));
  return parse(bytes);
}
const clean = model.normalizeNode;
test('Native row ownership produces one decision per inserted/deleted row', async () => {
  const doc = await parse(pack(body)), ledger = model.readLedger(doc);
  assert.equal(ledger.revisions.length, 2);
  assert.deepEqual(ledger.revisions.map(r => [r.operation, r.structure.rowIndex]), [['delete', 1], ['insert', 2]]);
  assert.equal(model.projection(doc).original, 'Rows\nKeep A\nKeep B\nDelete A\nDelete B\nLast A\nLast B');
  assert.equal(model.projection(doc).current, 'Rows\nKeep A\nKeep B\nInsert A\nInsert B\nLast A\nLast B');
});
test('Row decisions, reopen and minimum/full export retain both projections', async () => {
  const initial = await parse(pack(body));
  for (const action of ['', 'accept', 'reject', 'acceptAll', 'rejectAll']) {
    const doc = action ? model.decide(initial, { action, ...(action.endsWith('All') ? {} : { revisionId: 'revision-1' }) }).doc : initial;
    const reopened = envelope.parseObservablePayload(envelope.composeObservablePayload({ doc })).doc;
    assert.deepEqual(reopened, doc);
    if (action) assert.deepEqual(clean(model.decide(doc, { action: 'undo' }).doc), clean(initial));
    for (const profile of ['minimum', 'full']) {
      const returned = await cycle(doc, profile);
      for (const mode of ['original', 'current']) {
        const expected = model.materialize(model.readLedger(doc), mode === 'original' && !action ? 'original' : 'current');
        const actual = model.readLedger(returned) ? model.materialize(model.readLedger(returned), mode) : returned;
        if (mode === 'current' || !action || action.endsWith('All')) assert.deepEqual(clean(actual), expectedEmission(expected,profile), `${action} ${profile} ${mode}`);
        else assert.deepEqual(model.paragraphs(actual).map(p => (p.content || []).map(n => n.text || '\n').join('')),
          action === 'accept' ? ['Rows', 'Keep A', 'Keep B', 'Last A', 'Last B'] : ['Rows', 'Keep A', 'Keep B', 'Delete A', 'Delete B', 'Last A', 'Last B']);
      }
    }
  }
});
const metadata = { author: 'Mac writer', date: '2026-09-29T05:20:00.000Z' };
test('Recorded row addition/deletion preserves Original, rich cells, neighboring revisions and history', async () => {
  const cleanDoc = await parse(pack(p('Rows') + table(row(['Keep A', 'Keep B']) + row(['Delete A', 'Delete B']) + row(['Last A', 'Last B']))));
  const desired = structuredClone(cleanDoc);
  desired.content[1].content.splice(1, 1);
  const added = structuredClone(desired.content[1].content[0]);
  added.content[0].content[0].content[0].text = 'New row 😀';
  desired.content[1].content.splice(1, 0, added);
  // Two separate recorded gestures, followed by final body typing against the
  // same stable session baseline, retain one insertion/deletion per row.
  const deleted = structuredClone(cleanDoc); deleted.content[1].content.splice(1, 1);
  const result = recording.derive(cleanDoc, deleted, metadata).doc;
  const second = recording.derive(result, desired, metadata).doc;
  const ledger = model.readLedger(second);
  assert.deepEqual(clean(model.materialize(ledger, 'original')), clean(cleanDoc));
  assert.deepEqual(clean(second), clean(desired));
  assert.deepEqual(ledger.revisions.map(r => r.operation), ['delete', 'insert']);
  assert.deepEqual(clean(model.decide(second, { action: 'undo' }).doc), clean(result));
  for (const profile of ['minimum', 'full']) assert.deepEqual(clean(await cycle(second, profile)), expectedEmission(desired,profile));
  const thirdWorking = recording.prepare(second).working;
  thirdWorking.content[1].content.at(-1).content[0].content[0].content[0].text += ' changed';
  const third = recording.derive(second, thirdWorking, metadata).doc;
  assert.deepEqual(model.readLedger(third).revisions.filter(model.isTableRow).map(r => r.id), ['revision-1', 'revision-2']);
  assert.deepEqual(clean(third), clean(thirdWorking));
  assert.deepEqual(clean(model.materialize(model.readLedger(third), 'original')), clean(cleanDoc));
});
test('Native row carriers are bounded and reject conflicting provenance, duplicate ownership and vertical merge dependencies', async () => {
  const [bridge] = await modules;
  for (const xml of [
    body.replace('<w:trPr><w:del w:id="1"', '<w:trPr><w:ins w:id="99"/><w:del w:id="1"'),
    body.replace('w:id="2"', 'w:id="1"'),
    body.replace(p('Delete A'), `<w:p><w:del w:id="9" w:author="different"><w:r><w:delText>Delete A</w:delText></w:r></w:del></w:p>`),
    body.replace(p('Delete A'), `<w:p><w:ins w:id="9" ${provenance}>${run('Delete A')}</w:ins></w:p>`),
    body.replace('<w:tcPr/>', '<w:tcPr><w:vMerge w:val="continue"/></w:tcPr>'),
  ]) assert.equal(bridge.buildDocxContentPreviewFromZipBytes(pack(xml)).ok, false);
});
test('Full publication binds the union before removing deleted-row bookmark occurrences', async () => {
  const [bridge] = await modules, doc = await parse(pack(body));
  const source = buildFullManuscriptDocxReviewPacketSource({ projectId: 'rows', projectRoot: '/synthetic', scenes: [
    { sceneId: 'roman/a.txt', scenePath: '/synthetic/roman/a.txt', doc, text: envelope.deriveVisibleTextFromDocument(doc), order: 0 },
  ] });
  const bytes = buildDocxReviewPacketBuffer(source);
  const xml = bridge.extractDocxReviewTransportPackagePartsFromZipBytes(bytes).parts['word/document.xml'];
  assert.deepEqual(bridge.visibleSceneTextsFromWordDocumentXml(xml, source.localAuthorityCapsule.exportMap),
    { ok: true, sceneTexts: ['Rows\nKeep A\nKeep B\nInsert A\nInsert B\nLast A\nLast B'] });
  assert.equal(source.sceneText, 'Rows\nKeep A\nKeep B\nInsert A\nInsert B\nLast A\nLast B');
  const names = [...xml.matchAll(/w:name="(YRTK_[^"]+)"/g)].map(m => m[1]);
  for (const wrong of [xml.replace(names[3], 'UNKNOWN'), xml.replace(names[3], names[4]),
    xml.replace(names[3], 'TMP').replace(names[4], names[3]).replace('TMP', names[4])])
    assert.equal(bridge.visibleSceneTextsFromWordDocumentXml(wrong, source.localAuthorityCapsule.exportMap).ok, false);
});
test('A new Word row must be fully tracked and tied to an unchanged authenticated table', async () => {
  const [bridge] = await modules, doc = await parse(pack(body));
  const source = buildFullManuscriptDocxReviewPacketSource({ projectId: 'rows', projectRoot: '/synthetic', scenes: [
    { sceneId: 'roman/a.txt', scenePath: '/synthetic/roman/a.txt', doc, text: envelope.deriveVisibleTextFromDocument(doc), order: 0 },
  ] });
  const xml = bridge.extractDocxReviewTransportPackagePartsFromZipBytes(buildDocxReviewPacketBuffer(source)).parts['word/document.xml'];
  const last = [...xml.matchAll(/<w:tr>[\s\S]*?<\/w:tr>/g)].at(-1)[0];
  const added = row(['New A', 'New B'], 'ins', 100);
  const returned = xml.replace(last, added + last), options = { allowPendingTableRows: true };
  const ownership = bridge.visibleSceneTextsFromWordDocumentXml(returned, source.localAuthorityCapsule.exportMap, options);
  assert.equal(ownership.ok, true, JSON.stringify(ownership));
  assert.deepEqual(ownership.sourceParagraphBindings, [0, 1, 2, 3, 4, 5, 6, null, null, 7, 8]);
  assert.deepEqual(ownership.paragraphBindings, [0, 1, 2, 3, 4, 5, 6, 6, 6, 7, 8]);
  assert.equal(ownership.sceneTexts[0], 'Rows\nKeep A\nKeep B\nInsert A\nInsert B\nNew A\nNew B\nLast A\nLast B');
  const proposed = await parse(pack(returned.match(/<w:body>([\s\S]*)<\/w:body>/)[1]));
  const merged = model.replaceFromReturn(doc, proposed, { roundId: 'new-row', artifactSha256: 'a'.repeat(64) }, ownership.sourceParagraphBindings).doc;
  assert.deepEqual(model.readLedger(merged).revisions.map(r => r.id), ['revision-1', 'revision-2', 'revision-3']);
  assert.deepEqual(clean(model.decide(merged, { action: 'undo' }).doc), clean(doc));
  for (const bad of [returned.replace(added, row(['New A', 'New B'])), returned.replace(added, row(['New A', 'New B'], 'del', 100)),
    returned.replace(added, added.replace('<w:tcPr/>', '<w:tcPr><w:gridSpan w:val="2"/></w:tcPr>'))])
    assert.equal(bridge.visibleSceneTextsFromWordDocumentXml(bad, source.localAuthorityCapsule.exportMap, options).ok, false);
  assert.equal(bridge.visibleSceneTextsFromWordDocumentXml(returned, source.localAuthorityCapsule.exportMap).ok, false);
});
test('Both export profiles declare modern Word layout to prevent legacy row-grid rewrites', async () => {
  const [bridge, docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await modules;
  const doc = await parse(pack(body));
  const bytes = buildDocxMinBuffer({ doc, bookProfile: { formatId: 'A4' } }, { docxPageSetupBindModule, semanticMappingModule, styleMapModule });
  const parts = bridge.extractDocxReviewTransportPackagePartsFromZipBytes(bytes).parts;
  assert.match(parts['word/settings.xml'], /w:name="compatibilityMode"[^>]*w:val="15"/);
  assert.match(parts['word/_rels/document.xml.rels'], /relationships\/settings" Target="settings.xml"/);
});
test('Word omission of row UTC recovers only from consistent same-date subordinate carriers', async () => {
  const [bridge] = await modules;
  const child = `<w:p><w:del w:id="90" ${provenance} xmlns:w16du="http://schemas.microsoft.com/office/word/2023/wordml/word16du" w16du:dateUtc="2026-09-29T00:52:00Z"><w:r><w:delText>Delete A</w:delText></w:r></w:del></w:p>`;
  const xml = body.replace(p('Delete A'), child), doc = await parse(pack(xml));
  assert.equal(model.readLedger(doc).revisions[0].dateUtc, '2026-09-29T00:52:00Z');
  for (const profile of ['minimum', 'full']) assert.equal(model.readLedger(await cycle(doc, profile)).revisions[0].dateUtc, '2026-09-29T00:52:00Z');
  const conflict = xml.replace(p('Delete B'), child.replace('w:id="90"','w:id="91"').replace('00:52:00Z','01:52:00Z').replace('Delete A','Delete B'));
  assert.equal(bridge.buildDocxContentPreviewFromZipBytes(pack(conflict)).ok, false);
});
