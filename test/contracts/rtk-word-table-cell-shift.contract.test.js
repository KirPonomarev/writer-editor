'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fixtures = require('../fixtures/word-table-cell-shift-native-v1.json');
const model = require('../../src/core/word-pending-text-revisions-v1.cjs');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const { buildStoredZip, buildDocxMinBuffer } = require('../../src/export/docx/docxMinBuilder.js');
const { buildFullManuscriptDocxReviewPacketSource } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder.js');
const modules = Promise.all([import('../../src/io/revisionBridge/index.mjs'), import('../../src/docxPageSetupBind.mjs'),
  import('../../src/derived/semanticMapping.mjs'), import('../../src/derived/styleMap.mjs')]);
const pack = parts => buildStoredZip(Object.entries(parts).map(([name, data]) => ({ name, data })));
const original = ['Cell structural review', 'First A', 'First B', 'First C', 'Middle A', 'Middle B', 'Middle C', 'Last A', 'Last B', 'Last C', 'After table.'];
const expected = {
  insert: ['Cell structural review', 'First A', 'First B', 'First C', 'Middle A', 'Inserted cell', 'Middle C', 'Last A', 'Middle B', 'Last C', '', 'Last B', '', 'After table.'],
  delete: ['Cell structural review', 'First A', 'First B', 'First C', 'Middle A', 'Last B', 'Middle C', 'Last A', '', 'Last C', 'After table.'],
};
async function parse(bytes) {
  const [bridge] = await modules;
  const preview = bridge.buildDocxContentPreviewFromZipBytes(bytes);
  assert.equal(preview.ok, true, JSON.stringify(preview));
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(preview);
  assert.equal(plan.ok, true, JSON.stringify(plan));
  return envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc;
}
async function exportDoc(doc, profile) {
  const [, docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await modules;
  if (profile === 'minimum') return buildDocxMinBuffer({ doc, bookProfile: { formatId: 'A4' } }, { docxPageSetupBindModule, semanticMappingModule, styleMapModule });
  return buildDocxReviewPacketBuffer(buildFullManuscriptDocxReviewPacketSource({ projectId: 'cell-shift', projectRoot: '/synthetic', scenes: [
    { sceneId: 'roman/a.txt', scenePath: '/synthetic/roman/a.txt', doc, text: envelope.deriveVisibleTextFromDocument(doc), order: 0 },
  ] }));
}
for (const fixture of fixtures.cases) {
  test(`Native Mac cell ${fixture.operation} shift retains text, empty cells, provenance and both document versions`, async () => {
    const doc = await parse(pack(fixture.parts)), projection = model.projection(doc), ledger = model.readLedger(doc);
    assert.equal(projection.original, original.join('\n'));
    assert.equal(projection.current, expected[fixture.operation].join('\n'));
    assert.equal(ledger.revisions.filter(model.isTableRow).length, fixture.operation === 'insert' ? 1 : 0);
    assert.ok(ledger.revisions.every(r => r.author === 'Yalken C5V2 Canary' && r.dateUtc));
    for (const profile of ['minimum', 'full']) {
      const returned = await parse(await exportDoc(doc, profile));
      for (const mode of ['original', 'current']) assert.deepEqual(model.normalizeNode(model.materialize(model.readLedger(returned), mode)),
        model.normalizeNode(model.materialize(ledger, mode)), `${profile} ${mode}`);
    }
  });
  test(`Native Mac cell ${fixture.operation} decisions retain durable history and resolved exports`, async () => {
    const doc = await parse(pack(fixture.parts));
    for (const action of ['acceptAll', 'rejectAll']) {
      const decided = model.decide(doc, { action }).doc;
      const reopened = envelope.parseObservablePayload(envelope.composeObservablePayload({ doc: decided })).doc;
      const visible = action === 'acceptAll' ? expected[fixture.operation] : original;
      assert.equal(envelope.deriveVisibleTextFromDocument(reopened), visible.join('\n'));
      const undone = model.decide(reopened, { action: 'undo' }).doc;
      assert.deepEqual(model.normalizeNode(undone), model.normalizeNode(doc));
      assert.deepEqual(model.decide(undone, { action: 'redo' }).doc, reopened);
      for (const profile of ['minimum', 'full']) assert.deepEqual(model.normalizeNode(await parse(await exportDoc(reopened, profile))), model.normalizeNode(reopened));
    }
  });
}
test('Unknown native cell markers cannot silently enter the supported shift profile', async () => {
  const [bridge] = await modules;
  for (const marker of ['cellIns', 'cellDel', 'cellMerge']) {
    const parts = { ...fixtures.cases[1].parts };
    parts['word/document.xml'] = parts['word/document.xml'].replace('<w:tcPr>', `<w:tcPr><w:${marker} w:id="90" w:author="Other" w:date="2026-09-29T06:00:00Z"/>`);
    assert.equal(bridge.buildDocxContentPreviewFromZipBytes(pack(parts)).ok, false, marker);
  }
});


test('Authenticated native cell delete return retains the donor occurrence when Word moves its bookmark', async () => {
  const [bridge] = await modules;
  const { documentXml, exportMap } = fixtures.returnedShift;
  const result = bridge.visibleSceneTextsFromWordDocumentXml(documentXml, exportMap, { allowPendingTableRows: true });
  assert.equal(result.ok, true, JSON.stringify(result));
  const texts = [...expected.insert];
  texts[1] = 'First A source authored'; texts[6] = 'Last C'; texts[9] = '';
  assert.deepEqual(result.sceneTexts, [texts.join('\n')]);
});

test('Cell bookmark repair rejects altered provenance, content, rich formatting and transport identity', async () => {
  const [bridge] = await modules;
  const { documentXml, exportMap } = fixtures.returnedShift;
  const del = documentXml.match(/<w:del w:id="17"[\s\S]*?<\/w:del>/u)[0];
  const mutations = [
    ['author', del.replace('Yalken C5V2 Canary', 'Other author')],
    ['UTC', del.replace('2026-09-29T06:18:00Z', '2026-09-29T06:19:00Z')],
    ['content', del.replace('Last C', 'Other C')],
    ['format', del.replace('<w:rPr>', '<w:rPr><w:b/>')],
    ['untracked', '<w:r><w:t>Last C</w:t></w:r>'],
    ['two candidate deletions', del + del.replace('w:id="17"', 'w:id="999"')],
  ];
  for (const [label, replacement] of mutations) {
    const result = bridge.visibleSceneTextsFromWordDocumentXml(documentXml.replace(del, replacement), exportMap, { allowPendingTableRows: true });
    assert.equal(result.ok, false, label);
    assert.equal(result.code, 'PENDING_CELL_SHIFT_BOOKMARK_BINDING', label);
  }
  const donorName = exportMap.scenes[0].blocks[9].wordSignals.find(s => s.kind === 'bookmarkName').value.name;
  for (const xml of [documentXml.replace(donorName, 'YRTK_' + 'f'.repeat(32)), documentXml.replace('w:id="10"', 'w:id="9"')]) {
    assert.equal(bridge.visibleSceneTextsFromWordDocumentXml(xml, exportMap, { allowPendingTableRows: true }).ok, false);
  }
  assert.equal(bridge.visibleSceneTextsFromWordDocumentXml(documentXml, exportMap).ok, false, 'not enabled outside authenticated pending route');
});

test('Cell bookmark repair cannot cross scene/table/column identity or rescue stale local text', async () => {
  const [bridge] = await modules;
  const { documentXml, exportMap } = fixtures.returnedShift;
  for (const mutate of [
    b => { b.formatIr.table.column = 1; },
    b => { b.formatIr.table.tableId = 'another-table'; },
    b => { b.formatIr.table.row = 3; },
    b => { b.formatIr.table.rowspan = 2; },
    b => { b.formatIr.runs[0].text = 'stale'; },
    b => { b.pendingRevisionSegments = [{ operation: 'insert' }]; },
  ]) {
    const map = structuredClone(exportMap); mutate(map.scenes[0].blocks[9]);
    assert.equal(bridge.visibleSceneTextsFromWordDocumentXml(documentXml, map, { allowPendingTableRows: true }).ok, false);
  }
  const map = structuredClone(exportMap), tail = map.scenes[0].blocks.splice(9);
  map.scenes.push({ ...map.scenes[0], sceneId: 'other-scene', blocks: tail });
  assert.equal(bridge.visibleSceneTextsFromWordDocumentXml(documentXml, map, { allowPendingTableRows: true }).ok, false);
});

test('Cell bookmark normalization changes no content or revision semantics and is idempotent', async () => {
  const { createHash } = require('node:crypto');
  const parser = await import('../../src/io/revisionBridge/reviewTransportPackageParserV2.mjs');
  const { documentXml, exportMap } = fixtures.returnedShift;
  const cryptoPort = { sha256Text: t => 'sha256:' + createHash('sha256').update(t).digest('hex'),
    sha256Json: t => 'sha256:' + createHash('sha256').update(JSON.stringify(t)).digest('hex'), byteLength: t => Buffer.byteLength(t) };
  const blocks = exportMap.scenes.flatMap(s => s.blocks.map(b => ({ ...b, ownerSceneId: s.sceneId })));
  const normalized = parser.restoreShiftedCellBookmarkOwnershipV1(documentXml, blocks, { cryptoPort });
  const withoutTransport = xml => xml.replace(/<w:bookmark(?:Start|End)\b[^>]*\/>/gu, '');
  assert.equal(withoutTransport(normalized), withoutTransport(documentXml));
  assert.equal(parser.restoreShiftedCellBookmarkOwnershipV1(normalized, blocks, { cryptoPort }), normalized);
  const before = parser.extractPendingTextRevisionSourceV1(documentXml, { cryptoPort });
  const after = parser.extractPendingTextRevisionSourceV1(normalized, { cryptoPort });
  assert.deepEqual(after.revisions, before.revisions);
  assert.equal(withoutTransport(after.currentXml), withoutTransport(before.currentXml));
  assert.equal(withoutTransport(after.originalXml), withoutTransport(before.originalXml));
});
