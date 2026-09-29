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
const provenance = 'w:author="Reviewer" w:date="2026-09-29T02:21:00Z"';
const run = (t, pr = '') => `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}<w:t xml:space="preserve">${t}</w:t></w:r>`;
const change = (kind, id, old = '') => `<w:${kind}Change w:id="${id}" ${provenance}><w:${kind}>${old}</w:${kind}></w:${kind}Change>`;
const body = `<w:p>${run('Formatting ')}${run('target words', '<w:b/>' + change('rPr', 0))}${run(' remain pending.')}</w:p>`
  + `<w:p><w:pPr><w:jc w:val="center"/>${change('pPr', 1)}</w:pPr>${run('Paragraph alignment remains pending.')}</w:p>`;
function pack(value = body, prefix = 'w') {
  return buildStoredZip([
    { name: '[Content_Types].xml', data: '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>' },
    { name: '_rels/.rels', data: '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/document.xml', data: `<${prefix}:document xmlns:${prefix}="${W}"><${prefix}:body>${value}</${prefix}:body></${prefix}:document>` },
    { name: 'word/styles.xml', data: `<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:eastAsia="Aptos" w:cs="Aptos"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>` },
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
    : buildDocxReviewPacketBuffer(buildFullManuscriptDocxReviewPacketSource({ projectId: 'format', projectRoot: '/synthetic', scenes: [
      { sceneId: 'roman/a.txt', scenePath: '/synthetic/roman/a.txt', doc, text: envelope.deriveVisibleTextFromDocument(doc), order: 0 },
    ] }));
}
const canonical = doc => model.normalizeNode(doc);
const materialized = (doc, mode) => canonical(model.materialize(model.readLedger(doc), mode));
const meta = { author: 'Owner', date: '2026-09-29T03:00:00.000Z' };
const p = (text, marks = []) => ({ type: 'paragraph', content: text ? [{ type: 'text', text, ...(marks.length ? { marks } : {}) }] : [] });
test('Formatting-only Word import retains pending before/after and individual decisions rather than silently accepting Current', async () => {
  const doc = await parse(pack(body.replaceAll('w:', 'q:'), 'q')), ledger = model.readLedger(doc);
  assert.deepEqual(ledger.revisions.map(r => [r.operation, r.format.kind, r.state]), [['format', 'run', 'pending'], ['format', 'paragraph', 'pending']]);
  const original = materialized(doc, 'original'), current = materialized(doc, 'current');
  assert.equal(original.content[0].content.some(n => n.marks?.some(m => m.type === 'bold')), false);
  assert.equal(current.content[0].content[1].marks[0].type, 'bold');
  assert.equal(original.content[1].attrs, undefined); assert.equal(current.content[1].attrs.textAlign, 'center');
  const runRejected = model.decide(doc, { action: 'reject', revisionId: ledger.revisions[0].id }).doc;
  assert.equal(runRejected.content[0].content.some(n => n.marks?.some(m => m.type === 'bold')), false);
  assert.equal(runRejected.content[1].attrs.textAlign, 'center');
  for (const action of ['acceptAll', 'rejectAll']) {
    let result = model.decide(doc, { action }).doc;
    result = envelope.parseObservablePayload(envelope.composeObservablePayload({ doc: result })).doc;
    assert.deepEqual(canonical(result), action === 'acceptAll' ? current : original);
    const undo = model.decide(result, { action: 'undo' }).doc;
    assert.deepEqual(model.readLedger(undo).revisions, ledger.revisions);
    assert.deepEqual(model.decide(undo, { action: 'redo' }).doc, result);
  }
});
test('Five minimum/full cycles retain rich Original/Current, provenance and returned history', async () => {
  const initial = await parse(pack());
  for (const profile of ['minimum', 'full']) {
    let doc = initial;
    for (let round = 1; round <= 5; round++) {
      const returned = await parse(await exportDoc(doc, profile));
      doc = model.replaceFromReturn(doc, returned, { roundId: profile + round, artifactSha256: String(round).padStart(64, '0') }).doc;
      doc = envelope.parseObservablePayload(envelope.composeObservablePayload({ doc })).doc;
      for (const mode of ['original', 'current']) assert.deepEqual(materialized(doc, mode), materialized(initial, mode));
      assert.deepEqual(model.projection(doc).revisions.map(r => [r.id, r.format, r.author, r.date]),
        model.projection(initial).revisions.map(r => [r.id, r.format, r.author, r.date]));
    }
    for (let n = 0; n < 5; n++) doc = model.decide(doc, { action: 'undo' }).doc;
    assert.equal(model.readLedger(doc).roundUndo.length, 0);
    for (let n = 0; n < 5; n++) doc = model.decide(doc, { action: 'redo' }).doc;
    assert.equal(model.readLedger(doc).roundUndo.length, 5);
  }
});
test('Accepted/rejected formatting exports resolved values with no resurrected native changes', async () => {
  const initial = await parse(pack());
  for (const action of ['acceptAll', 'rejectAll']) for (const profile of ['minimum', 'full']) {
    const decided = model.decide(initial, { action }).doc, returned = await parse(await exportDoc(decided, profile));
    assert.equal(model.readLedger(returned), null); assert.deepEqual(canonical(returned), canonical(decided));
  }
});
test('Paragraph and run properties on the same paragraph remain independent; empty paragraph alignment is reversible', async () => {
  const xml = `<w:p><w:pPr><w:jc w:val="right"/>${change('pPr', 1)}</w:pPr>${run('same', '<w:i/>' + change('rPr', 0))}</w:p>`
    + `<w:p><w:pPr><w:jc w:val="center"/>${change('pPr', 2)}</w:pPr></w:p>`;
  const doc = await parse(pack(xml)), ledger = model.readLedger(doc);
  assert.equal(ledger.revisions.length, 3); assert.equal(ledger.revisions.at(-1).from, 0); assert.equal(ledger.revisions.at(-1).to, 0);
  for (const profile of ['minimum', 'full']) {
    const returned = await parse(await exportDoc(doc, profile));
    for (const mode of ['original', 'current']) assert.deepEqual(materialized(returned, mode), materialized(doc, mode));
  }
});
test('Malformed property ownership, duplicate IDs, nested changes and unsupported semantics fail before admission', async () => {
  const [b] = await modules;
  for (const xml of [
    body.replace('w:id="1"', 'w:id="0"'), body.replace('<w:rPr></w:rPr>', '<w:pPr/>'),
    body.replace('<w:rPr></w:rPr>', '<w:rPr/><w:rPr/>'),
    body.replace('<w:rPr></w:rPr>', `<w:rPr>${change('rPr', 99)}</w:rPr>`),
    body.replace('<w:pPr></w:pPr>', '<w:pPr><w:sectPr/></w:pPr>'),
    body.replace('<w:b/>', '<w:b/><w:unknown/>'),
    body.replace('<w:b/>', '<w:b/><w:vertAlign w:val="superscript"/>'),
    body.replace(run('target words', '<w:b/>' + change('rPr', 0)), change('rPr', 0) + run('target words')),
    body.replace('<w:rPr></w:rPr>', '<w:rPr><w:b/></w:rPr>'),
    body.replace('target words', ''),
    body.replace('<w:pPr></w:pPr>', '<w:pPr><w:jc w:val="diagonal"/></w:pPr>'),
  ]) assert.equal(b.buildDocxContentPreviewFromZipBytes(pack(xml)).ok, false, xml);
});
test('Canonical property source binding and overlap checks reject forged ledgers and split Unicode spans', async () => {
  const ledger = model.readLedger(await parse(pack()));
  for (const changeLedger of [
    l => { l.revisions[0].format.after = []; },
    l => { l.revisions[0].format.before = [{ type: 'link', attrs: { href: 'file:///private' } }]; },
    l => { l.revisions[1].format.after.attrs.textAlign = 'left'; },
    l => { l.revisions[1].from = 1; },
    l => { l.revisions[0].groupId = 'group-1'; },
    l => { l.revisions[0].moveName = 'fake'; },
    l => { l.revisions.push({ ...structuredClone(l.revisions[1]), id: 'revision-3' }); },
  ]) { const bad = structuredClone(ledger); changeLedger(bad); assert.throws(() => model.bindLedger(bad)); }
  const recorded = recording.derive({ type: 'doc', content: [p('a😀b')] }, { type: 'doc', content: [p('a😀b', [{ type: 'bold' }])] }, meta).doc;
  const bad = structuredClone(model.readLedger(recorded)); bad.revisions[0].from = 2;
  assert.throws(() => model.bindLedger(bad));
});
test('Recording tracks supported marks and paragraph properties, including insertion plus independent formatting in one session', () => {
  const base = { type: 'doc', content: [p('alpha beta'), p('')] }, working = structuredClone(base);
  working.content[0].content = [{ type: 'text', text: 'alpha ', marks: [{ type: 'bold' }] }, { type: 'text', text: 'new beta', marks: [{ type: 'italic' }] }];
  working.content[0].attrs = { textAlign: 'center' }; working.content[1].attrs = { textAlign: 'right' };
  const result = recording.derive(base, working, meta).doc;
  assert.deepEqual(canonical(result), canonical(working));
  assert.deepEqual(canonical(model.decide(result, { action: 'rejectAll' }).doc), canonical(base));
  assert.equal(model.readLedger(result).roundUndo.length, 1);
  assert.equal(model.readLedger(result).revisions.filter(r => r.operation === 'format').length, 4);
  assert.deepEqual(recording.derive(base, working, meta).doc, result);
  assert.deepEqual(canonical(model.decide(result, { action: 'undo' }).doc), canonical(base));
});
test('Unchanged pending paragraph format survives additional typing; overlapping pending run formatting fails without changing buffers', () => {
  const base = { type: 'doc', content: [p('protected')] }, working = structuredClone(base); working.content[0].attrs = { textAlign: 'center' };
  const first = recording.derive(base, working, meta).doc, next = recording.prepare(first).working;
  next.content[0].content[0].text += '!';
  const second = recording.derive(first, next, meta).doc;
  assert.equal(model.readLedger(second).revisions.find(model.isParagraphFormat).to, 'protected!'.length);
  const bold = structuredClone(base); bold.content[0].content[0].marks = [{ type: 'bold' }];
  const pending = recording.derive(base, bold, meta).doc, italic = recording.prepare(pending).working;
  italic.content[0].content[0].marks = [{ type: 'italic' }]; const frozen = JSON.stringify({ pending, italic });
  assert.throws(() => recording.derive(pending, italic, meta), /EXISTING_REVISION_OVERLAP/);
  assert.equal(JSON.stringify({ pending, italic }), frozen);
});
test('All supported mark families and heading changes preserve both rich projections through both exporters', async () => {
  const marks = [{ type: 'bold' }, { type: 'italic' }, { type: 'underline' }, { type: 'strike' },
    { type: 'highlight', attrs: { color: '#ffff00' } },
    { type: 'textStyle', attrs: { fontFamily: 'Georgia', fontSize: '15.5pt', color: '#123456' } }];
  for (const reverse of [false, true]) {
    const plain = { type: 'doc', content: [p('A😀 mixed\twords'), p('Title')] };
    // Use the explicit Writer/Word 12pt baseline; full export materializes it.
    for (const leaf of plain.content) leaf.content[0].marks = [{ type: 'textStyle', attrs: { fontSize: '12pt' } }];
    const rich = structuredClone(plain); rich.content[0].content[0].marks = marks;
    rich.content[1].type = 'heading'; rich.content[1].attrs = { level: 2, textAlign: 'right' };
    const doc = recording.derive(reverse ? rich : plain, reverse ? plain : rich, meta).doc;
    for (const profile of ['minimum', 'full']) {
      const returned = await parse(await exportDoc(doc, profile));
      for (const mode of ['original', 'current']) assert.deepEqual(materialized(returned, mode), materialized(doc, mode), `${profile}:${reverse}:${mode}`);
    }
  }
});
test('Cell list formatting keeps numbering and table topology while a separate cell has a pending text change', async () => {
  const base = { type: 'doc', content: [{ type: 'table', content: [{ type: 'tableRow', content: [
    { type: 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [
      { type: 'orderedList', attrs: { start: 7 }, content: [{ type: 'listItem', content: [p('same')] }] }, p('')] },
    { type: 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [p('same')] },
  ] }] }] };
  for (const leaf of model.paragraphs(base)) for (const node of leaf.content) node.marks = [{ type: 'textStyle', attrs: { fontSize: '12pt' } }];
  const working = structuredClone(base), leaves = model.paragraphs(working);
  leaves[0].attrs = { textAlign: 'center' }; leaves[0].content[0].marks.push({ type: 'underline' });
  leaves[2].content[0].text = 'same new';
  const doc = recording.derive(base, working, meta).doc;
  for (const profile of ['minimum', 'full']) {
    const returned = await parse(await exportDoc(doc, profile));
    for (const mode of ['original', 'current']) assert.deepEqual(materialized(returned, mode), materialized(doc, mode));
  }
});
test('Native Word timestamp precision preserves owned formatting IDs without conflating different authors or times', () => {
  const base = { type: 'doc', content: [p('one'), p('two')] }, working = structuredClone(base);
  working.content.forEach(n => { n.content[0].marks = [{ type: 'bold' }]; });
  const doc = recording.derive(base, working, { author: 'Mac Source Author', date: '2026-09-29T02:59:12.651Z' }).doc;
  for (const mutation of ['precision', 'author', 'time']) {
    const incoming = structuredClone(model.readLedger(doc));
    incoming.revisions.forEach((r, i) => {
      r.id = `revision-${i + 8}`; r.nativeId = String(i);
      r.date = '2026-09-29T02:59:00Z'; r.dateUtc = '2026-09-29T02:59:12Z';
      if (mutation === 'author') r.author = 'Different';
      if (mutation === 'time') r.dateUtc = '2026-09-29T02:59:13Z';
    });
    const returned = model.replaceFromReturn(doc, model.bindLedger(incoming), { roundId: mutation, artifactSha256: 'a'.repeat(64) }).doc;
    const rows = model.readLedger(returned).revisions;
    assert.deepEqual(rows.map(r => r.id), mutation === 'precision' ? ['revision-1', 'revision-2'] : ['revision-3', 'revision-4']);
    assert.equal(rows[0].date, '2026-09-29T02:59:00Z');
  }
});
