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
  const { documentXml, exportMap, stylesXml } = fixtures.returnedShift;
  const result = bridge.visibleSceneTextsFromWordDocumentXml(documentXml, exportMap, { allowPendingTableRows: true, stylesXml });
  assert.equal(result.ok, true, JSON.stringify(result));
  const texts = [...expected.insert];
  texts[1] = 'First A source authored'; texts[6] = 'Last C'; texts[9] = '';
  assert.deepEqual(result.sceneTexts, [texts.join('\n')]);
});

test('Cell bookmark repair rejects altered provenance, content, rich formatting and transport identity', async () => {
  const [bridge] = await modules;
  const { documentXml, exportMap, stylesXml } = fixtures.returnedShift;
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
    const result = bridge.visibleSceneTextsFromWordDocumentXml(documentXml.replace(del, replacement), exportMap, { allowPendingTableRows: true, stylesXml });
    assert.equal(result.ok, false, label);
    assert.equal(result.code, 'PENDING_CELL_SHIFT_BOOKMARK_BINDING', label);
  }
  const donorName = exportMap.scenes[0].blocks[9].wordSignals.find(s => s.kind === 'bookmarkName').value.name;
  for (const xml of [documentXml.replace(donorName, 'YRTK_' + 'f'.repeat(32)), documentXml.replace('w:id="10"', 'w:id="9"')]) {
    assert.equal(bridge.visibleSceneTextsFromWordDocumentXml(xml, exportMap, { allowPendingTableRows: true, stylesXml }).ok, false);
  }
  assert.equal(bridge.visibleSceneTextsFromWordDocumentXml(documentXml, exportMap).ok, false, 'not enabled outside authenticated pending route');
});

test('Cell bookmark repair cannot cross scene/table/column identity or rescue stale local text', async () => {
  const [bridge] = await modules;
  const { documentXml, exportMap, stylesXml } = fixtures.returnedShift;
  for (const mutate of [
    b => { b.formatIr.table.column = 1; },
    b => { b.formatIr.table.tableId = 'another-table'; },
    b => { b.formatIr.table.row = 3; },
    b => { b.formatIr.table.rowspan = 2; },
    b => { b.formatIr.runs[0].text = 'stale'; },
    b => { b.pendingRevisionSegments = [{ operation: 'insert' }]; },
  ]) {
    const map = structuredClone(exportMap); mutate(map.scenes[0].blocks[9]);
    assert.equal(bridge.visibleSceneTextsFromWordDocumentXml(documentXml, map, { allowPendingTableRows: true, stylesXml }).ok, false);
  }
  const map = structuredClone(exportMap), tail = map.scenes[0].blocks.splice(9);
  map.scenes.push({ ...map.scenes[0], sceneId: 'other-scene', blocks: tail });
  assert.equal(bridge.visibleSceneTextsFromWordDocumentXml(documentXml, map, { allowPendingTableRows: true, stylesXml }).ok, false);
});

test('Cell bookmark normalization changes no content or revision semantics and is idempotent', async () => {
  const { createHash } = require('node:crypto');
  const parser = await import('../../src/io/revisionBridge/reviewTransportPackageParserV2.mjs');
  const { documentXml, exportMap, stylesXml } = fixtures.returnedShift;
  const cryptoPort = { sha256Text: t => 'sha256:' + createHash('sha256').update(t).digest('hex'),
    sha256Json: t => 'sha256:' + createHash('sha256').update(JSON.stringify(t)).digest('hex'), byteLength: t => Buffer.byteLength(t) };
  const blocks = exportMap.scenes.flatMap(s => s.blocks.map(b => ({ ...b, ownerSceneId: s.sceneId })));
  const normalized = parser.restoreShiftedCellBookmarkOwnershipV1(documentXml, blocks, { cryptoPort, stylesXml });
  const withoutTransport = xml => xml.replace(/<w:bookmark(?:Start|End)\b[^>]*\/>/gu, '');
  assert.equal(withoutTransport(normalized), withoutTransport(documentXml));
  assert.equal(parser.restoreShiftedCellBookmarkOwnershipV1(normalized, blocks, { cryptoPort, stylesXml }), normalized);
  const before = parser.extractPendingTextRevisionSourceV1(documentXml, { cryptoPort, stylesXml });
  const after = parser.extractPendingTextRevisionSourceV1(normalized, { cryptoPort, stylesXml });
  assert.deepEqual(after.revisions, before.revisions);
  assert.equal(withoutTransport(after.currentXml), withoutTransport(before.currentXml));
  assert.equal(withoutTransport(after.originalXml), withoutTransport(before.originalXml));
});

for (const kind of ['insertDownXml', 'deleteUpXml']) {
  test(`Controlled ${kind} chain binds each source occurrence and preserves both versions`, async () => {
    const [bridge] = await modules;
    const fixture = fixtures.syntheticShiftChains, xml = fixture[kind];
    const result = bridge.visibleSceneTextsFromWordDocumentXml(xml, fixture.exportMap, { allowPendingTableRows: true });
    assert.equal(result.ok, true, JSON.stringify(result));
    const current = [...original];
    if (kind === 'insertDownXml') {
      current[3] = 'Inserted C'; current[6] = 'First C'; current[9] = 'Middle C';
      current.splice(10, 0, '', '', 'Last C');
      assert.deepEqual(result.sourceParagraphBindings, [0,1,2,3,4,5,6,7,8,9,null,null,null,10]);
    } else { current[3] = 'Middle C'; current[6] = 'Last C'; current[9] = ''; }
    assert.deepEqual(result.sceneTexts, [current.join('\n')]);
    const doc = await parse(pack({ ...fixtures.cases[0].parts, 'word/document.xml': xml }));
    const trusted = model.materialize(model.readLedger(await parse(pack(fixtures.cases[0].parts))), 'original');
    assert.deepEqual(bridge.validateShiftedCellReturnOriginalV1(trusted, doc), { ok: true });
    assert.equal(model.projection(doc).original, original.join('\n'));
    assert.equal(model.projection(doc).current, current.join('\n'));
    for (const action of ['acceptAll', 'rejectAll']) {
      const decided = model.decide(doc, { action }).doc;
      const paragraphTexts = node => node.type === 'paragraph' ? [(node.content || []).map(r => r.text || '').join('')]
        : (node.content || []).flatMap(paragraphTexts);
      assert.deepEqual(paragraphTexts(decided), action === 'acceptAll' ? current : original);
      assert.deepEqual(model.normalizeNode(model.decide(decided, { action: 'undo' }).doc), model.normalizeNode(doc));
    }
    for (const profile of ['minimum', 'full']) {
      const returned = await parse(await exportDoc(doc, profile));
      for (const mode of ['original', 'current']) assert.deepEqual(model.normalizeNode(model.materialize(model.readLedger(returned), mode)),
        model.normalizeNode(model.materialize(model.readLedger(doc), mode)), `${profile} ${mode}`);
    }
  });
}

test('Controlled appended row cannot rescue missing identity, forged provenance or changed geometry', async () => {
  const [bridge] = await modules, fixture = fixtures.syntheticShiftChains, xml = fixture.insertDownXml;
  const rowMarker = xml.match(/<w:ins w:id="207"[^>]*\/>/u)[0];
  const donor = xml.match(/<w:del w:id="206"[\s\S]*?<\/w:del>/u)[0];
  const mutations = [
    xml.replace(rowMarker, ''),
    xml.replace(rowMarker, rowMarker.replace('Synthetic native-shape chain', 'Other author')),
    xml.replace(rowMarker, rowMarker.replace('2026-09-29T12:00:00Z', '2026-09-29T12:00:01Z')),
    xml.replace(rowMarker, rowMarker.replace('<w:ins', '<w:del')),
    xml.replace('<w:gridCol w:w="3000"/>', '<w:gridCol w:w="3001"/>'),
    xml.replace('<w:ins w:id="208"', '<w:ins w:id="207"'),
    xml.replace(donor, donor + donor.replace('w:id="206"', 'w:id="999"')),
    xml.replace(donor, donor.replace('<w:rPr>', '<w:rPr><w:b/>')),
    xml.replace(donor, donor.replace('Last C', 'Stale C')),
  ];
  for (const [i, candidate] of mutations.entries()) assert.equal(bridge.visibleSceneTextsFromWordDocumentXml(candidate,
    fixture.exportMap, { allowPendingTableRows: true }).ok, false, `mutation ${i}`);
  const name = fixture.exportMap.scenes[0].blocks[9].wordSignals.find(s => s.kind === 'bookmarkName').value.name;
  assert.equal(bridge.visibleSceneTextsFromWordDocumentXml(xml.replace(name, 'YRTK_' + '0'.repeat(32)), fixture.exportMap,
    { allowPendingTableRows: true }).ok, false);
  assert.equal(bridge.visibleSceneTextsFromWordDocumentXml(xml, fixture.exportMap).ok, false);
});

test('Controlled chain uses physical source occurrences when cell text repeats', async () => {
  const [bridge] = await modules, fixture = fixtures.syntheticShiftChains, map = structuredClone(fixture.exportMap);
  for (const i of [3, 6, 9]) for (const run of map.scenes[0].blocks[i].formatIr.runs) run.text = 'Repeated C';
  for (const key of ['insertDownXml', 'deleteUpXml']) {
    const xml = fixture[key].replaceAll('First C', 'Repeated C').replaceAll('Middle C', 'Repeated C').replaceAll('Last C', 'Repeated C');
    const result = bridge.visibleSceneTextsFromWordDocumentXml(xml, map, { allowPendingTableRows: true });
    assert.equal(result.ok, true, JSON.stringify(result));
    const shifted = structuredClone(map); shifted.scenes[0].blocks[6].formatIr.table.column = 1;
    assert.equal(bridge.visibleSceneTextsFromWordDocumentXml(xml, shifted, { allowPendingTableRows: true }).ok, false);
  }
});

test('Controlled multi-cell normalization relocates only transport bytes and rejects partial ranges', async () => {
  const { createHash } = require('node:crypto'), parser = await import('../../src/io/revisionBridge/reviewTransportPackageParserV2.mjs');
  const fixture = fixtures.syntheticShiftChains, blocks = fixture.exportMap.scenes.flatMap(s => s.blocks.map(b => ({ ...b, ownerSceneId: s.sceneId })));
  const cryptoPort = { sha256Text: t => 'sha256:' + createHash('sha256').update(t).digest('hex'),
    sha256Json: t => 'sha256:' + createHash('sha256').update(JSON.stringify(t)).digest('hex'), byteLength: t => Buffer.byteLength(t) };
  const withoutTransport = xml => xml.replace(/<w:bookmark(?:Start|End)\b[^>]*\/>/gu, '');
  for (const key of ['insertDownXml', 'deleteUpXml']) {
    const xml = fixture[key], normalized = parser.restoreShiftedCellBookmarkOwnershipV1(xml, blocks, { cryptoPort });
    assert.equal(withoutTransport(normalized), withoutTransport(xml));
    assert.equal(parser.restoreShiftedCellBookmarkOwnershipV1(normalized, blocks, { cryptoPort }), normalized);
    const before = parser.extractPendingTextRevisionSourceV1(xml, { cryptoPort }), after = parser.extractPendingTextRevisionSourceV1(normalized, { cryptoPort });
    assert.deepEqual(after.revisions, before.revisions);
    for (const field of ['currentXml', 'originalXml']) assert.equal(withoutTransport(after[field]), withoutTransport(before[field]));
    const marker = xml.match(/<w:bookmarkEnd w:id="7"\/>/u)[0];
    assert.throws(() => parser.restoreShiftedCellBookmarkOwnershipV1(xml.replace(marker, ''), blocks, { cryptoPort }));
  }
});


test('Coordinated shifted-copy formatting cannot change the authenticated Original rich text', async () => {
  const [bridge] = await modules;
  for (const [xml, map, insertedId, deletedId] of [
    [fixtures.returnedShift.documentXml, fixtures.returnedShift.exportMap, '11', '17'],
    [fixtures.syntheticShiftChains.insertDownXml, fixtures.syntheticShiftChains.exportMap, '208', '206'],
    [fixtures.syntheticShiftChains.deleteUpXml, fixtures.syntheticShiftChains.exportMap, '103', '105'],
  ]) {
    let changed = xml;
    for (const [kind, id] of [['ins', insertedId], ['del', deletedId]]) {
      const wrapper = new RegExp(`<w:${kind} w:id="${id}"[\\s\\S]*?<\\/w:${kind}>`, 'u');
      assert.ok(wrapper.test(changed));
      changed = changed.replace(wrapper, match => match.replace('<w:rPr>', '<w:rPr><w:b/>'));
    }
    const result = bridge.visibleSceneTextsFromWordDocumentXml(changed, map, { allowPendingTableRows: true, stylesXml: fixtures.returnedShift.stylesXml });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'PENDING_CELL_SHIFT_BOOKMARK_BINDING');
  }
});

test('Inherited table font size requires exact bounded native defaults and cannot hide style changes', async () => {
  const [bridge] = await modules, { documentXml, exportMap, stylesXml } = fixtures.returnedShift;
  assert.equal(bridge.visibleSceneTextsFromWordDocumentXml(documentXml, exportMap, { allowPendingTableRows: true }).ok, false,
    'missing effective style evidence is unknown');
  const defaults = stylesXml.match(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/u)[0];
  for (const changed of [
    defaults.replaceAll('w:val="24"', 'w:val="26"'),
    defaults.replace('<w:rPr>', '<w:rPr><w:b/>'),
  ]) assert.equal(bridge.visibleSceneTextsFromWordDocumentXml(documentXml, exportMap,
    { allowPendingTableRows: true, stylesXml: stylesXml.replace(defaults, changed) }).ok, false);
  const map = structuredClone(exportMap); map.scenes[0].blocks[9].formatIr.runs[0].inline.bold = true;
  assert.equal(bridge.visibleSceneTextsFromWordDocumentXml(documentXml, map, { allowPendingTableRows: true, stylesXml }).ok, false,
    'a missing bold effect cannot be inferred from defaults');
});

test('Validated returned-package projection carries effective styles into authenticated shifted ownership', async () => {
  const [bridge] = await modules, { documentXml, exportMap, stylesXml } = fixtures.returnedShift;
  const returned = pack({ ...fixtures.cases[0].parts, 'word/document.xml': documentXml, 'word/styles.xml': stylesXml });
  const projection = bridge.extractDocxReviewTransportWordDocumentProjection(returned);
  assert.equal(projection.ok, true, JSON.stringify(projection));
  assert.equal(projection.stylesXml, stylesXml);
  const ownership = bridge.visibleSceneTextsFromWordDocumentXml(projection.documentXml, exportMap,
    { allowPendingTableRows: true, stylesXml: projection.stylesXml });
  assert.equal(ownership.ok, true, JSON.stringify(ownership));
  const defaults = stylesXml.match(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/u)[0];
  const mutated = pack({ ...fixtures.cases[0].parts, 'word/document.xml': documentXml,
    'word/styles.xml': stylesXml.replace(defaults, defaults.replaceAll('w:val="24"', 'w:val="26"')) });
  const changed = bridge.extractDocxReviewTransportWordDocumentProjection(mutated);
  assert.equal(changed.ok, true);
  assert.equal(bridge.visibleSceneTextsFromWordDocumentXml(changed.documentXml, exportMap,
    { allowPendingTableRows: true, stylesXml: changed.stylesXml }).ok, false);
  const explicit = fixtures.syntheticShiftChains.deleteUpXml;
  assert.equal(bridge.visibleSceneTextsFromWordDocumentXml(explicit, fixtures.syntheticShiftChains.exportMap,
    { allowPendingTableRows: true, stylesXml: stylesXml.replace(defaults, defaults.replace('<w:rPr>', '<w:rPr><w:b/>')) }).ok, false,
    'unsafe inherited effect remains blocked even when size is explicit');
});

test('Full rich Original proof protects the unmoved receiver and stale trusted source before replacement', async () => {
  const [bridge] = await modules, fixture = fixtures.returnedShift;
  const trusted = model.materialize(model.readLedger(await parse(pack(fixtures.cases[0].parts))), 'original');
  const parts = { ...fixtures.cases[0].parts, 'word/document.xml': fixture.documentXml, 'word/styles.xml': fixture.stylesXml };
  const incoming = await parse(pack(parts));
  assert.deepEqual(bridge.validateShiftedCellReturnOriginalV1(trusted, incoming), { ok: true });
  const deletion = fixture.documentXml.match(/<w:del w:id="12"[\s\S]*?<\/w:del>/u)[0];
  const changedXml = fixture.documentXml.replace(deletion, deletion.replace('<w:rPr>', '<w:rPr><w:b/>'));
  const ownership = bridge.visibleSceneTextsFromWordDocumentXml(changedXml, fixture.exportMap,
    { allowPendingTableRows: true, stylesXml: fixture.stylesXml });
  assert.equal(ownership.ok, true, 'unmoved original receiver requires the additional full Core proof');
  assert.equal(ownership.cellShiftBookmarkRestored, true);
  const changed = await parse(pack({ ...parts, 'word/document.xml': changedXml }));
  assert.deepEqual(bridge.validateShiftedCellReturnOriginalV1(trusted, changed),
    { ok: false, code: 'PENDING_CELL_SHIFT_ORIGINAL_RICH_MISMATCH' });
  const wrongScene = structuredClone(trusted); wrongScene.content[0].content[0].text = 'A different scene';
  assert.equal(bridge.validateShiftedCellReturnOriginalV1(wrongScene, incoming).ok, false);
  const stale = structuredClone(trusted); stale.content[1].content[0].content[0].content[0].content[0].text += ' stale';
  assert.equal(bridge.validateShiftedCellReturnOriginalV1(stale, incoming).ok, false);
  assert.equal(bridge.validateShiftedCellReturnOriginalV1(null, null).ok, false);
  const fs = require('node:fs'), path = require('node:path');
  const main = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
  const start = main.indexOf('if (!replay && mapped.cellShiftBookmarkRestored === true)');
  assert.ok(start > 0);
  const remainder = main.slice(start);
  assert.ok(remainder.indexOf('validateShiftedCellReturnOriginalV1(current.parsed.doc, incoming.doc)')
    < remainder.indexOf('pendingTextRevisions.replaceFromReturn('));
  assert.match(remainder.slice(0, remainder.indexOf('pendingTextRevisions.replaceFromReturn(')), /if \(!originalProof\.ok\) throw Error\(originalProof\.code\)/u);
});

test('Explicit donor paragraph/table styles cannot hide inherited rich changes during restoration', async () => {
  const [bridge] = await modules, fixture = fixtures.syntheticShiftChains;
  const xml = fixture.deleteUpXml;
  const donor = [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/gu)][9][0];
  const styled = donor.replace(/^(<w:p\b[^>]*>)/u, '$1<w:pPr><w:pStyle w:val="BoldCell"/></w:pPr>');
  const stylesXml = '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    + '<w:style w:type="paragraph" w:styleId="BoldCell"><w:rPr><w:b/></w:rPr></w:style>'
    + '<w:style w:type="table" w:styleId="BoldTable"><w:rPr><w:b/></w:rPr></w:style></w:styles>';
  for (const candidate of [xml.replace(donor, styled), xml.replace('<w:tblPr>', '<w:tblPr><w:tblStyle w:val="BoldTable"/>')])
    assert.equal(bridge.visibleSceneTextsFromWordDocumentXml(candidate, fixture.exportMap, { allowPendingTableRows: true, stylesXml }).ok, false);
});

test('Canonical same-artifact receipt replay after acceptance or undo preserves the exact document without write', async () => {
  const [bridge] = await modules, fixture = fixtures.returnedShift;
  const before = await parse(pack(fixtures.cases[0].parts));
  const bytes = pack({ ...fixtures.cases[0].parts, 'word/document.xml': fixture.documentXml, 'word/styles.xml': fixture.stylesXml });
  const incoming = await parse(bytes), receipt = { roundId: 'authenticated-cell-replay',
    artifactSha256: require('node:crypto').createHash('sha256').update(bytes).digest('hex') };
  const applied = model.replaceFromReturn(before, incoming, receipt).doc;
  const accepted = model.decide(applied, { action: 'acceptAll' }).doc;
  assert.equal(bridge.validateShiftedCellReturnOriginalV1(accepted, incoming).ok, true,
    'Core retains Original history even after acceptance');
  const undone = model.decide(accepted, { action: 'undo' }).doc;
  for (const current of [accepted, undone]) {
    const observableBefore = envelope.composeObservablePayload({ doc: current });
    const replay = model.replaceFromReturn(current, incoming, receipt);
    assert.equal(replay.changed, false);
    assert.equal(replay.replay, true);
    assert.strictEqual(replay.doc, current);
    assert.equal(envelope.composeObservablePayload({ doc: current }), observableBefore);
  }
  const deletion = fixture.documentXml.match(/<w:del w:id="12"[\s\S]*?<\/w:del>/u)[0];
  const changedXml = fixture.documentXml.replace(deletion, deletion.replace('<w:rPr>', '<w:rPr><w:b/>'));
  const alteredBytes = pack({ ...fixtures.cases[0].parts, 'word/document.xml': changedXml, 'word/styles.xml': fixture.stylesXml });
  const alteredIncoming = await parse(alteredBytes);
  const altered = { ...receipt, artifactSha256: require('node:crypto').createHash('sha256').update(alteredBytes).digest('hex') };
  assert.notEqual(altered.artifactSha256, receipt.artifactSha256);
  const hasReceipt = model.readLedger(accepted).returnReceipts.some(r => r.roundId === altered.roundId && r.artifactSha256 === altered.artifactSha256);
  assert.equal(hasReceipt, false, 'a changed artifact cannot claim the canonical no-op receipt');
  assert.deepEqual(bridge.validateShiftedCellReturnOriginalV1(accepted, alteredIncoming),
    { ok: false, code: 'PENDING_CELL_SHIFT_ORIGINAL_RICH_MISMATCH' });
  const fs = require('node:fs'), path = require('node:path');
  const main = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
  assert.match(main, /if \(!replay && mapped\.cellShiftBookmarkRestored === true\)/u);
});
