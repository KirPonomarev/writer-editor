'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder.js');
const { buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
const producer = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const modules = Promise.all([import('../../src/io/revisionBridge/index.mjs'), import('../../src/renderer/documentContentEnvelope.mjs')]);
const stable = v => Array.isArray(v) ? '[' + v.map(stable).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}' : JSON.stringify(v);
const sha = v => 'sha256:' + crypto.createHash('sha256').update(v).digest('hex');
const hmac = (v, key) => 'hmac-sha256:' + crypto.createHmac('sha256', key).update(v).digest('hex');
const cryptoPort = { sha256Text: v => sha(v).slice(7), sha256Json: v => sha(stable(v)),
  hmacSha256Json: (v, key) => hmac(stable(v), key), hmacSha256Text: hmac, byteLength: v => Buffer.byteLength(v) };
const p = text => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] });
const cell = text => ({ type: 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [p(text)] });
async function fixture() {
  const [bridge, envelope] = await modules;
  const doc = { type: 'doc', content: [p('before sentinel outside'), { type: 'table', content: [
    { type: 'tableRow', content: [cell('cell sentinel alpha'), cell('repeated')] },
    { type: 'tableRow', content: [cell(''), cell('repeated')] },
  ] }, p('after')] };
  const raw = envelope.composeObservablePayload({ doc });
  const scene = { sceneId: 'roman/table.txt', scenePath: '/synthetic/roman/table.txt', doc, text: envelope.deriveVisibleTextFromDocument(doc), observableContent: raw, order: 0 };
  const source = producer.buildFullManuscriptDocxReviewPacketSource({ projectId: 'table-review-test', projectRoot: '/synthetic', manifestPath: '/synthetic/manifest.json', scenes: [scene], expectedOrderedSceneIds: [scene.sceneId] },
    { revisionBridge: bridge, cryptoPort, createdAtUtc: '2026-09-25T00:00:00Z', roundIdHex: 'a'.repeat(32), keyIdHex: 'b'.repeat(32), hmacSecret: 'synthetic-test-key' });
  const bytes = buildDocxReviewPacketBuffer(source);
  const parts = bridge.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes }, { cryptoPort }).parts;
  const parse = xml => bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes: buildStoredZip(Object.entries(parts).map(([name, data]) => ({ name, data: name === 'word/document.xml' ? xml : data }))) }, { cryptoPort });
  const analysis = parse(parts['word/document.xml']);
  assert.equal(analysis.ok, true, JSON.stringify(analysis));
  return { bridge, doc, source, exportMap: source.localAuthorityCapsule.exportMap, xml: parts['word/document.xml'], parse, ir: analysis.reviewIr };
}
test('Table review binding accounts only matching native table occurrences and leaves immutable raw evidence untouched', async () => {
  const { bridge, ir, exportMap } = await fixture();
  const before = structuredClone(ir), mapBefore = structuredClone(exportMap);
  const result = bridge.bindDocxReviewTableTopology(ir, exportMap);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.applicable, true);
  assert.equal(result.proof.automaticApplyAuthority, false);
  assert.equal(result.reviewIr.structureChanges.some(x => x.structureKind === 'tbl'), false);
  assert.equal(result.reviewIr.opaqueUnsupported.some(x => x.elementName === 'tbl'), false);
  assert.deepEqual(ir, before); assert.deepEqual(exportMap, mapBefore);
  assert.deepEqual(result.reviewIr.formattingParagraphs, ir.formattingParagraphs);
});
test('Word auto-fit grid recalculation binds only an implicit legacy table and grants no write', async () => {
  const { bridge, xml, parse, exportMap } = await fixture();
  // Native Word recalculates a legacy auto-fit grid when tracked text is edited.
  // Its grid is derived layout, while an explicitly stored grid stays protected.
  const changed = xml.replace('<w:gridCol w:w="1440"/><w:gridCol w:w="1440"/>',
    '<w:gridCol w:w="5772"/><w:gridCol w:w="1749"/>');
  assert.notEqual(changed, xml);
  const parsed = parse(changed); assert.equal(parsed.ok, true);
  const before = structuredClone(parsed.reviewIr), mapBefore = structuredClone(exportMap);
  const bound = bridge.bindDocxReviewTableTopology(parsed.reviewIr, exportMap);
  assert.equal(bound.ok, true, JSON.stringify(bound));
  assert.equal(bound.proof.automaticApplyAuthority, false);
  assert.deepEqual(parsed.reviewIr, before); assert.deepEqual(exportMap, mapBefore);
  const candidate = bridge.buildDocxReviewPreviewSessionCandidateFromEvidence(
    { returnedProjection: parsed.reviewIr }, { fullManuscriptExportMap: exportMap });
  assert.equal(candidate.ok, true, JSON.stringify(candidate));
  assert.equal(candidate.canAutoApply, false); assert.equal(candidate.canWriteStorage, false);
  const explicitMap = structuredClone(exportMap);
  for (const scene of explicitMap.scenes) for (const block of scene.blocks) {
    if (block.formatIr?.table) block.formatIr.table.wordTable = require('../../src/io/documentTableProperties.js').legacyTableProperties(2);
  }
  assert.equal(bridge.bindDocxReviewTableTopology(parsed.reviewIr, explicitMap).ok, false);
});
test('Table review rejects missing or altered topology, malformed occurrence inventory and packet-carried self proof', async () => {
  const { bridge, ir, exportMap } = await fixture();
  assert.equal(bridge.bindDocxReviewTableTopology(ir, null).ok, false);
  for (const mutate of [
    x => x.formattingParagraphs.forEach(p => delete p.table),
    x => { x.formattingParagraphs.find(p => p.table).table.column = 1; },
    x => { x.formattingParagraphs.find(p => p.table).table.rowspan = 2; },
    x => x.formattingParagraphs.unshift({ paragraphText: 'moved' }),
    x => { x.structureChanges = x.structureChanges.filter(p => p.structureKind !== 'tbl'); },
    x => x.structureChanges.push(structuredClone(x.structureChanges.find(p => p.structureKind === 'tbl'))),
    x => { x.opaqueUnsupported.find(p => p.elementName === 'tbl').sourceXmlProvenance.closeEnd++; },
    x => { x.structureChanges.find(p => p.structureKind === 'tbl').sourceXmlProvenance.namespaceUri = 'urn:foreign'; },
  ]) {
    const bad = structuredClone(ir); mutate(bad); bad.tableTopologyBinding = { status: 'PASS', automaticApplyAuthority: true };
    assert.equal(bridge.bindDocxReviewTableTopology(bad, exportMap).ok, false);
    const candidate = bridge.buildDocxReviewPreviewSessionCandidateFromEvidence({ returnedProjection: bad }, { fullManuscriptExportMap: exportMap });
    assert.equal(candidate.canAutoApply, false); assert.equal(candidate.canWriteStorage, false); assert.equal(candidate.ok, false);
  }
});
test('Foreign namespace table inventory is retained as blocking even beside an unchanged native table', async () => {
  const { bridge, ir, exportMap } = await fixture();
  for (const [key, item] of [['structureChanges', ir.structureChanges.find(x => x.structureKind === 'tbl')], ['opaqueUnsupported', ir.opaqueUnsupported.find(x => x.elementName === 'tbl')]]) {
    const foreign = structuredClone(item); foreign.sourceXmlProvenance.namespaceUri = 'urn:foreign';
    const mixed = structuredClone(ir); mixed[key].push(foreign);
    const bound = bridge.bindDocxReviewTableTopology(mixed, exportMap);
    assert.equal(bound.ok, true); assert.ok(bound.reviewIr[key].some(x => x.sourceXmlProvenance?.namespaceUri === 'urn:foreign' && x.writerAuthorityImpact === 'blocking'));
  }
});
test('Tracked table property, grid, cell and row changes never inherit unchanged table text authority', async () => {
  const { bridge, xml, parse, exportMap } = await fixture();
  const edits = [
    ['tblPr', 'tblPrChange'], ['tblGrid', 'tblGridChange'], ['tcPr', 'tcPrChange'],
    ['tcPr', 'cellIns'], ['tcPr', 'cellDel'], ['tcPr', 'cellMerge'],
    ['trPr', 'trPrChange'], ['trPr', 'ins'], ['trPr', 'del'],
  ];
  for (const [parent, name] of edits) {
    const marker = `<w:${name} w:id="987" w:author="reviewer" w:date="2026-09-25T00:00:00Z"/>`;
    const changed = parent === 'trPr' ? xml.replace('<w:tr>', '<w:tr><w:trPr>' + marker + '</w:trPr>')
      : xml.includes(`<w:${parent}/>` ) ? xml.replace(`<w:${parent}/>`, `<w:${parent}>${marker}</w:${parent}>`) : xml.replace(`</w:${parent}>`, marker + `</w:${parent}>`);
    assert.notEqual(changed, xml, name);
    const parsed = parse(changed);
    if (!parsed.ok) { assert.equal(parsed.canApply, false); continue; }
    const bound = bridge.bindDocxReviewTableTopology(parsed.reviewIr, exportMap);
    assert.equal(bound.ok, true, name + JSON.stringify(bound));
    const expected = name === 'ins' ? 'tableRowInserted' : name === 'del' ? 'tableRowDeleted' : name;
    assert.ok(bound.reviewIr.structureChanges.some(x => x.structureKind === expected && x.writerAuthorityImpact === 'blocking'), name);
  }
});
test('Tracked text inside a table can form a preview only after local topology comparison, without granting a write', async () => {
  const { bridge, xml, parse, exportMap } = await fixture();
  const changed = xml.replace(/<w:r>(<w:rPr>[^]*?<\/w:rPr>)?<w:t(?: [^>]*)?>cell sentinel alpha<\/w:t><\/w:r>/u,
    '<w:del w:id="901" w:author="reviewer"><w:r><w:delText>cell sentinel alpha</w:delText></w:r></w:del><w:ins w:id="902" w:author="reviewer"><w:r><w:t>cell sentinel round1</w:t></w:r></w:ins>');
  assert.notEqual(changed, xml);
  const parsed = parse(changed); assert.equal(parsed.ok, true, JSON.stringify(parsed));
  const result = bridge.bindDocxReviewTableTopology(parsed.reviewIr, exportMap);
  assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(result.reviewIr.textRevisions.length, 2);
  const packet = { returnedProjection: parsed.reviewIr };
  const before = structuredClone(packet);
  const candidate = bridge.buildDocxReviewPreviewSessionCandidateFromEvidence(packet, { fullManuscriptExportMap: exportMap });
  assert.equal(candidate.ok, true, JSON.stringify(candidate));
  assert.equal(candidate.summary.structuralChangeCount, 0);
  assert.ok(candidate.summary.textChangeCount > 0, JSON.stringify(candidate));
  assert.equal(candidate.canAutoApply, false); assert.equal(candidate.canWriteStorage, false);
  assert.deepEqual(packet, before);
});

test('Full table review export preserves protected notes inside cells and exact comment anchors after tables', async () => {
  const [bridge, envelope] = await modules;
  const fixtures = await import('../../scripts/ops/rtk-interop-word-manuscript-fixtures.mjs');
  const f = fixtures.buildWordManuscriptFixture('SINGLE_SCENE', 'C2', fixtures.TABLES_RECIPE);
  assert.equal(f.scenes[0].doc.content[0].type, 'table');
  const doc = f.scenes[0].doc, raw = envelope.composeObservablePayload({ doc });
  const scenes = [{ sceneId: 'roman/table.txt', nodeId: 'test-node', scenePath: '/synthetic/roman/table.txt', doc, text: envelope.deriveVisibleTextFromDocument(doc), observableContent: raw, order: 0 }];
  const projectId = 'table-review-test';
  const notes = fixtures.buildWordManuscriptNoteState({ fixture: f, projectId, scenes });
  const comments = fixtures.buildWordManuscriptCommentState({ fixture: f, projectId, sceneId: scenes[0].sceneId });
  const source = producer.buildFullManuscriptDocxReviewPacketSource({ projectId, projectRoot: '/synthetic', manifestPath: '/synthetic/manifest.json', scenes, expectedOrderedSceneIds: scenes.map(s => s.sceneId), nonTextReturnState: comments, notesDocument: notes.document, documentNoteSelections: notes.selections },
    { revisionBridge: bridge, cryptoPort, createdAtUtc: '2026-09-25T00:00:00Z', roundIdHex: 'a'.repeat(32), keyIdHex: 'b'.repeat(32), hmacSecret: 'synthetic-test-key' });
  const bytes = buildDocxReviewPacketBuffer(source);
  const parsed = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes }, { cryptoPort });
  assert.equal(parsed.ok, true, JSON.stringify(parsed.reasons));
  const { compareCommentExportReadback } = require('../../src/export/docx/docxReviewPacketComments.js');
  assert.equal(compareCommentExportReadback(source.commentExport, parsed.reviewIr.commentThreads).ok, true);
  assert.deepEqual(parsed.reviewIr.documentNotes.notes, source.documentNotes.notes);
  const parts = bridge.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes }, { cryptoPort }).parts;
  const xml = parts['word/document.xml'];
  for (const transform of [
    x => x.replace(/(<w:r>[^]*?<w:footnoteReference[^>]*\/>[^]*?<\/w:r>)/u, '<w:ins w:id="900">$1</w:ins>'),
    x => x.replace('<w:footnoteReference', '<x:footnoteReference xmlns:x="urn:foreign"'),
    x => x.replace(/<w:r>(?:(?!<\/w:r>)[^])*<w:footnoteReference[^>]*\/>(?:(?!<\/w:r>)[^])*<\/w:r>/u,
      run => run.replace('<w:r>', '<x:r xmlns:x="urn:foreign">').replace('</w:r>', '</x:r>')),
  ]) {
    const changed = transform(xml); assert.notEqual(changed, xml);
    const bad = buildStoredZip(Object.entries(parts).map(([name, data]) => ({ name, data: name === 'word/document.xml' ? changed : data })));
    const analysis = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes: bad }, { cryptoPort });
    assert.equal(analysis.ok, false); assert.equal(analysis.canApply, false);
  }
});

test('Only the observed neutral Word row margin exception is accepted; semantic row exceptions stay blocked', async () => {
  const { xml, parse } = await fixture();
  const margin = '<w:tblPrEx><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPrEx>';
  assert.equal(parse(xml.replaceAll('<w:tr>', '<w:tr>' + margin)).ok, true);
  for (const invalid of [margin.replace('w:w="0"', 'w:w="10"'), margin.replace('w:type="dxa"', 'w:type="pct"'), margin.replace('<w:top', '<w:left'), margin.replace('</w:tblCellMar>', '<w:top w:w="0" w:type="dxa"/></w:tblCellMar>'), margin.replace('</w:tblPrEx>', '<w:tblPrExChange/></w:tblPrEx>'), '<w:tblPrEx/>']) {
    assert.equal(parse(xml.replace('<w:tr>', '<w:tr>' + invalid)).ok, false, invalid);
  }
});
