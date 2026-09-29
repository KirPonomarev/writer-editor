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
