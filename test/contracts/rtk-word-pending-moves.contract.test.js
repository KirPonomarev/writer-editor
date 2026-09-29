'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const model = require('../../src/core/word-pending-text-revisions-v1.cjs');
const recording = require('../../src/core/word-pending-recording-v1.cjs');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const { buildStoredZip, buildDocxMinBuffer } = require('../../src/export/docx/docxMinBuilder.js');
const { buildFullManuscriptDocxReviewPacketSource } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder.js');
const modules = Promise.all([import('../../src/io/revisionBridge/index.mjs'), import('../../src/docxPageSetupBind.mjs'),
  import('../../src/derived/semanticMapping.mjs'), import('../../src/derived/styleMap.mjs')]);
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const run = t => `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`;
const provenance = 'w:author="Reviewer" w:date="2026-09-29T04:52:00Z"';
// Literal shape observed in macOS Word: different wrapper IDs; equal range
// names; smart cut leaves a trailing source space and an independent insertion.
function side(kind, text, id, name = 'move241549937') {
  return `<w:${kind}RangeStart w:id="${id}" w:name="${name}" ${provenance}/><w:${kind} w:id="${id + 1}" ${provenance}>${run(text)}</w:${kind}><w:${kind}RangeEnd w:id="${id}"/>`;
}
const from = side('moveFrom', 'migrating sentence ', 0), to = side('moveTo', 'migrating sentence', 3);
const space = `<w:ins w:id="2" ${provenance}>${run(' ')}</w:ins>`;
const body = `<w:p>${run('First. ')}${from}${run('Tail.')}</w:p><w:p>${run('Second.')}${space}${to}${run(' Protected.')}</w:p>`;
function pack(value = body, prefix = 'w') {
  return buildStoredZip([
    { name: '[Content_Types].xml', data: '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: '_rels/.rels', data: '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/document.xml', data: `<${prefix}:document xmlns:${prefix}="${W}"><${prefix}:body>${value}</${prefix}:body></${prefix}:document>` },
  ]);
}
async function parse(bytes) {
  const [b] = await modules, preview = b.buildDocxContentPreviewFromZipBytes(bytes);
  assert.equal(preview.ok, true, JSON.stringify(preview));
  const plan = b.buildDocxImportPreviewPlanFromContentPreview(preview); assert.equal(plan.ok, true, JSON.stringify(plan));
  return envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc;
}
async function exportDoc(doc, profile) {
  const [, docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await modules;
  return profile === 'minimum' ? buildDocxMinBuffer({ doc, bookProfile: { formatId: 'A4' } }, { docxPageSetupBindModule, semanticMappingModule, styleMapModule })
    : buildDocxReviewPacketBuffer(buildFullManuscriptDocxReviewPacketSource({ projectId: 'moves', projectRoot: '/synthetic', scenes: [
      { sceneId: 'roman/a.txt', scenePath: '/synthetic/roman/a.txt', doc, text: envelope.deriveVisibleTextFromDocument(doc), order: 0 },
    ] }));
}
test('Native move range names preserve Original/Current and pair decisions across paragraphs with independent smart whitespace', async () => {
  const doc = await parse(pack(body.replaceAll('w:', 'q:'), 'q')), view = model.projection(doc);
  assert.equal(view.original, 'First. migrating sentence Tail.\nSecond. Protected.');
  assert.equal(view.current, 'First. Tail.\nSecond. migrating sentence Protected.');
  assert.equal(view.revisions[0].moveName, 'move241549937');
  assert.notEqual(view.revisions[0].nativeId, view.revisions[2].nativeId);
  assert.equal(view.revisions[1].groupId, null);
  for (const action of ['accept', 'reject']) for (const revisionId of ['revision-1', 'revision-3']) {
    let changed = model.decide(doc, { action, revisionId }).doc;
    changed = envelope.parseObservablePayload(envelope.composeObservablePayload({ doc: changed })).doc;
    assert.deepEqual(model.projection(changed).revisions.map(r => r.state), [action + 'ed', 'pending', action + 'ed']);
    const undone = model.decide(changed, { action: 'undo' }).doc;
    assert.deepEqual(model.projection(undone), { ...view, canRedo: true });
    assert.deepEqual(model.decide(undone, { action: 'redo' }).doc, changed);
  }
  assert.equal(model.projection(model.decide(doc, { action: 'rejectAll' }).doc).current, view.original);
});
test('Five ordinary/full serialization and durable returned rounds preserve native move semantics and stable group identities', async () => {
  const initial = await parse(pack()), expected = model.projection(initial);
  for (const profile of ['minimum', 'full']) {
    let doc = initial;
    for (let round = 1; round <= 5; round++) {
      const returned = await parse(await exportDoc(doc, profile));
      doc = model.replaceFromReturn(doc, returned, { roundId: profile + round, artifactSha256: String(round).padStart(64, '0') }).doc;
      doc = envelope.parseObservablePayload(envelope.composeObservablePayload({ doc })).doc;
      const actual = model.projection(doc);
      assert.equal(actual.original, expected.original); assert.equal(actual.current, expected.current);
      assert.deepEqual(actual.revisions.map(r => [r.id, r.groupId, r.operation, r.text, Boolean(r.moveName)]),
        expected.revisions.map(r => [r.id, r.groupId, r.operation, r.text, Boolean(r.moveName)]));
    }
    for (let i = 0; i < 5; i++) doc = model.decide(doc, { action: 'undo' }).doc;
    assert.equal(model.readLedger(doc).roundUndo.length, 0);
    for (let i = 0; i < 5; i++) doc = model.decide(doc, { action: 'redo' }).doc;
    assert.equal(model.readLedger(doc).roundUndo.length, 5);
  }
});
test('Same-paragraph and destination-before-source moves survive export without inferring ordinary equal text as moves', async () => {
  for (const xml of [`<w:p>${from}${run('middle ')}${to}</w:p>`, `<w:p>${to}</w:p><w:p>${from}</w:p>`]) {
    const doc = await parse(pack(xml)), expected = model.projection(doc);
    for (const profile of ['minimum', 'full']) {
      const actual = model.projection(await parse(await exportDoc(doc, profile)));
      assert.equal(actual.original, expected.original); assert.equal(actual.current, expected.current);
      assert.equal(actual.revisions.filter(r => r.moveName).length, 2);
    }
  }
  const ordinary = `<w:p><w:del w:id="1" ${provenance}><w:r><w:delText>same</w:delText></w:r></w:del><w:ins w:id="2" ${provenance}>${run('same')}</w:ins></w:p>`;
  assert.equal(model.projection(await parse(pack(ordinary))).revisions.some(r => r.moveName), false);
});
test('Malformed or ambiguous move ranges fail before generic import grants any create plan', async () => {
  const [b] = await modules;
  const mutants = [
    body.replace(to, ''), body.replace(from, ''),
    body.replace('w:name="move241549937"', 'w:name="other"'),
    body.replace('<w:moveFromRangeEnd w:id="0"/>', ''),
    body.replace('<w:moveToRangeEnd w:id="3"/>', '<w:moveToRangeEnd w:id="77"/>'),
    body.replace('w:name="move241549937"', 'w:name="two names"'),
    body.replace('<w:moveFrom w:id="1"', '<w:moveFrom w:id="4"'),
    body.replace('<w:moveFromRangeStart w:id="0"', '<w:moveFromRangeStart w:id="3"'),
    body.replace('w:author="Reviewer"', 'w:author="Forged"'),
    body.replace('</w:moveFrom>', '</w:moveFrom>' + run('unowned')),
    body.replace('</w:moveFrom>', '</w:moveFrom><w:moveFrom w:id="77" ' + provenance + '>' + run('extra') + '</w:moveFrom>'),
    body.replace('<w:moveFromRangeEnd w:id="0"/>', '</w:p><w:p><w:moveFromRangeEnd w:id="0"/>'),
    body.replace(run('migrating sentence '), '<w:r><w:delText>migrating sentence </w:delText></w:r>'),
    body.replace(run('migrating sentence '), '<w:ins w:id="88">' + run('nested') + '</w:ins>'),
    body.replace('</w:moveTo>', '<w:commentReference w:id="1"/></w:moveTo>'),
    body.replace('<w:moveFromRangeEnd w:id="0"/>', '<w:moveFromRangeEnd w:id="0"/><w:moveFromRangeEnd w:id="0"/>'),
  ];
  for (const xml of mutants) assert.equal(b.buildDocxContentPreviewFromZipBytes(pack(xml)).ok, false, xml);
});
test('Canonical ledger rejects orphan move metadata, mixed pair states and forged group topology', async () => {
  const ledger = model.readLedger(await parse(pack()));
  for (const mutate of [
    l => { l.revisions[0].moveName = 'other'; },
    l => { delete l.revisions[2].moveName; },
    l => { l.revisions[0].groupId = null; },
    l => { l.revisions[0].state = 'accepted'; },
    l => { l.revisions[0].moveName = ''; },
    l => { l.undo.push(['accepted', 'pending', 'pending']); },
  ]) { const bad = structuredClone(ledger); mutate(bad); assert.throws(() => model.bindLedger(bad)); }
});
test('Unrelated recording retains move ownership and one-step history', async () => {
  const doc = await parse(pack()), prepared = recording.prepare(doc), working = structuredClone(prepared.working);
  model.paragraphs(working)[0].content.at(-1).text += ' Added';
  const changed = recording.derive(prepared.baseline, working, { author: 'Owner', date: '2026-09-29T03:00:00.000Z' }).doc;
  assert.equal(model.projection(changed).revisions.filter(r => r.moveName).length, 2);
  assert.equal(model.projection(model.decide(changed, { action: 'undo' }).doc).current, model.projection(doc).current);
});
test('Moves between existing table cells preserve leaf ownership and table geometry', async () => {
  const ledger = model.readLedger(await parse(pack()));
  ledger.source.content = [{ type: 'table', content: [{ type: 'tableRow', content: ledger.source.content.map(p => ({
    type: 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [p],
  })) }] }];
  const doc = model.bindLedger(ledger), expected = model.projection(doc);
  for (const profile of ['minimum', 'full']) {
    const returned = await parse(await exportDoc(doc, profile));
    assert.equal(returned.content[0].type, 'table');
    assert.equal(returned.content[0].content[0].content.length, 2);
    assert.equal(model.projection(returned).original, expected.original);
    assert.equal(model.projection(returned).current, expected.current);
    assert.deepEqual(model.projection(returned).revisions.map(r => r.paragraphIndex), [0, 1, 1]);
  }
});
test('Full-manuscript export scopes duplicate local move group IDs by scene', async () => {
  const [bridge] = await modules, doc = await parse(pack());
  const source = buildFullManuscriptDocxReviewPacketSource({ projectId: 'two-scenes', projectRoot: '/synthetic',
    scenes: ['a', 'b'].map((id, order) => ({ sceneId: `roman/${id}.txt`, scenePath: `/synthetic/roman/${id}.txt`,
      doc, text: envelope.deriveVisibleTextFromDocument(doc), order })) });
  const bytes = buildDocxReviewPacketBuffer(source), crypto = require('node:crypto');
  const cryptoPort = { sha256Text: v => 'sha256:' + crypto.createHash('sha256').update(v).digest('hex'),
    sha256Json: v => 'sha256:' + crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex'), byteLength: v => Buffer.byteLength(v) };
  const projection = bridge.extractDocxReviewTransportWordDocumentProjection({ bytes }, { cryptoPort });
  assert.equal(projection.ok, true, JSON.stringify(projection));
  const names = [...projection.documentXml.matchAll(/<w:move(?:From|To)RangeStart[^>]*w:name="([^"]+)"/gu)].map(m => m[1]);
  assert.equal(names.length, 4); assert.equal(new Set(names).size, 2);
  const current = bridge.visibleSceneTextsFromWordDocumentXml(projection.documentXml, source.localAuthorityCapsule.exportMap, { cryptoPort });
  assert.equal(current.ok, true, JSON.stringify(current));
  assert.deepEqual(current.sceneTexts, [model.projection(doc).current, model.projection(doc).current]);
  const returned = await parse(bytes);
  assert.equal(new Set(model.projection(returned).revisions.filter(r => r.moveName).map(r => r.groupId)).size, 2);
});

test('Word may place a paired transport bookmark endpoint beside a move wrapper without changing its body', async () => {
  const start = '<w:bookmarkStart w:id="90" w:name="YRTK_0123456789abcdef0123456789abcdef"/>';
  const end = '<w:bookmarkEnd w:id="90"/>';
  const native = body.replace('<w:p>' + run('Second.'), '<w:p>' + start + run('Second.'))
    .replace('</w:moveTo>', '</w:moveTo>' + end);
  const imported = await parse(pack(native)), baseline = await parse(pack());
  assert.deepEqual(model.projection(imported), model.projection(baseline));
  const [bridge] = await modules;
  for (const bad of [native.replace(start, ''), native.replace(end, end + end), native.replace(start, start + start),
    native.replace('YRTK_0123456789abcdef0123456789abcdef', 'UserBookmark'),
    native.replace(end, end + run('unowned')), native.replace(end, '<q:bookmarkEnd xmlns:q="urn:foreign" w:id="90"/>')]) {
    assert.equal(bridge.buildDocxContentPreviewFromZipBytes(pack(bad)).ok, false);
  }
});
