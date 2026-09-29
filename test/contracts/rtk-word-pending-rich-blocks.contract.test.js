'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), vm = require('node:vm');
const model = require('../../src/core/word-pending-text-revisions-v1.cjs');
const recording = require('../../src/core/word-pending-recording-v1.cjs');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const { buildDocxMinBuffer, buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder.js');
const { buildFullManuscriptDocxReviewPacketSource } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const modules = Promise.all([import('../../src/io/revisionBridge/index.mjs'), import('../../src/docxPageSetupBind.mjs'),
  import('../../src/derived/semanticMapping.mjs'), import('../../src/derived/styleMap.mjs')]);
const p = text => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] });
const cell = (...content) => ({ type: 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content });
const item = (text, ...children) => ({ type: 'listItem', content: [p(text), ...children] });
const ordered = (start, ...content) => ({ type: 'orderedList', attrs: { start }, content });
const bullet = (...content) => ({ type: 'bulletList', content });
const text = node => (node.content || []).map(n => n.type === 'hardBreak' ? '\n' : n.text).join('');
function fixture() {
  const merged = cell(ordered(7, item('same', bullet(item('oldNEW'), item('same'))), item('same')), p(''));
  merged.attrs.rowspan = 2;
  const wide = cell(ordered(3, item('restart'), item('same')), p('')); wide.attrs.colspan = 2;
  const source = { type: 'doc', content: [p('before'), { type: 'table', content: [
    { type: 'tableRow', content: [merged, wide] },
    { type: 'tableRow', content: [cell(p(''), bullet(item('tail oldNEW'))), cell(p('protected'))] },
  ] }, ordered(11, item('outside')), p('after')] };
  const leaves = model.paragraphs(source), revisions = [];
  for (const [quote, from] of [['oldNEW', 0], ['tail oldNEW', 5]]) {
    const paragraphIndex = leaves.findIndex(n => text(n) === quote), groupId = 'group-' + (revisions.length / 2 + 1);
    for (const [operation, start] of [['delete', from], ['insert', from + 3]]) {
      const id = revisions.length + 1;
      revisions.push({ id: 'revision-' + id, nativeId: '' + id, operation, author: 'Word reviewer',
        date: '2026-09-29T00:00:00Z', dateUtc: '', groupId, paragraphIndex, from: start, to: start + 3, state: 'pending' });
    }
  }
  return model.bindLedger({ schemaVersion: 1, source, revisions, undo: [], redo: [] });
}
function shape(doc) {
  const copy = model.normalizeNode(doc); model.paragraphs(copy).forEach(n => { n.content = []; }); return copy;
}
async function parse(bytes) {
  const [bridge] = await modules;
  const preview = bridge.buildDocxContentPreviewFromZipBytes(bytes);
  assert.equal(preview.ok, true, JSON.stringify(preview));
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(preview);
  assert.equal(plan.ok, true, JSON.stringify(plan));
  const parsed = envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content);
  assert.equal(parsed.issue, null);
  return parsed.doc;
}
async function exportDoc(doc, profile) {
  const [, docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await modules;
  if (profile === 'minimum') return buildDocxMinBuffer({ doc, bookProfile: { formatId: 'A4' } },
    { docxPageSetupBindModule, semanticMappingModule, styleMapModule });
  return buildDocxReviewPacketBuffer(buildFullManuscriptDocxReviewPacketSource({ projectId: 'pending-rich', projectRoot: '/synthetic',
    scenes: [{ sceneId: 'roman/rich.txt', scenePath: '/synthetic/roman/rich.txt', doc,
      text: envelope.deriveVisibleTextFromDocument(doc), observableContent: envelope.composeObservablePayload({ doc }), order: 0 }] }));
}
test('Pending list/cell text keeps Original, Current, decisions and durable history without flattening topology', () => {
  const doc = fixture(), expectedShape = shape(doc), initial = model.projection(doc);
  assert.match(initial.original, /tail old/u); assert.match(initial.current, /tail NEW/u);
  assert.equal(initial.revisions[2].paragraphIndex, 10);
  for (const action of ['acceptAll', 'rejectAll']) {
    let changed = model.decide(doc, { action }).doc;
    changed = envelope.parseObservablePayload(envelope.composeObservablePayload({ doc: changed })).doc;
    assert.deepEqual(shape(changed), expectedShape);
    assert.equal(model.projection(changed).current, action === 'acceptAll' ? initial.current : initial.original);
    const undone = model.decide(changed, { action: 'undo' }).doc;
    assert.deepEqual(model.projection(undone).revisions, initial.revisions);
    assert.deepEqual(model.decide(undone, { action: 'redo' }).doc, changed);
  }
  const single = model.decide(doc, { action: 'reject', revisionId: 'revision-3' }).doc;
  assert.deepEqual(model.projection(single).revisions.map(r => r.state), ['pending', 'pending', 'rejected', 'rejected']);
});
test('Five ordinary and authenticated Word cycles retain pending edits after vertical-merge continuations and repeated cell text', async () => {
  const original = fixture(), expected = model.projection(original);
  for (const profile of ['minimum', 'full']) {
    let doc = original;
    for (let round = 1; round <= 5; round++) {
      doc = await parse(await exportDoc(doc, profile));
      const result = model.projection(doc);
      assert.equal(result.original, expected.original, profile + round);
      assert.equal(result.current, expected.current, profile + round);
      assert.deepEqual(shape(doc), shape(original));
      assert.deepEqual(result.revisions.map(r => [r.paragraphIndex, r.operation, r.text, r.author, r.state]),
        expected.revisions.map(r => [r.paragraphIndex, r.operation, r.text, r.author, r.state]));
    }
  }
});
test('Recording inside a table list retains cell identity and rejects topology or formatting changes', () => {
  const source = fixture(), prepared = recording.prepare(source), working = structuredClone(prepared.working);
  const leaf = model.paragraphs(working).find(n => text(n) === 'protected'); leaf.content[0].text = 'protected edit';
  const metadata = { author: 'Owner', date: '2026-09-29T01:00:00.000Z' };
  const result = recording.derive(prepared.baseline, working, metadata);
  assert.equal(result.changed, true); assert.deepEqual(shape(result.doc), shape(source));
  assert.equal(model.projection(result.doc).revisions.at(-1).paragraphIndex, 11);
  assert.equal(model.projection(model.decide(result.doc, { action: 'undo' }).doc).current, model.projection(source).current);
  for (const change of [
    d => { d.content[1].content[0].content[0].content[0].attrs.start++; },
    d => { d.content[1].content[1].content.reverse(); },
    d => { model.paragraphs(d)[0].content[0].marks = [{ type: 'bold' }]; },
  ]) {
    const bad = structuredClone(working); change(bad);
    assert.throws(() => recording.derive(prepared.baseline, bad, metadata), /RECORDING_(?:STRUCTURE|FORMAT)_UNSUPPORTED/u);
  }
});
test('Returned rich rounds retain stable revision ownership through five durable undo and redo steps', async () => {
  let doc = fixture(); const expected = model.projection(doc), expectedShape = shape(doc);
  for (let round = 1; round <= 5; round++) {
    const returned = await parse(await exportDoc(doc, 'full'));
    doc = model.replaceFromReturn(doc, returned, { roundId: 'rich-round-' + round, artifactSha256: String(round).padStart(64, '0') }).doc;
    doc = envelope.parseObservablePayload(envelope.composeObservablePayload({ doc })).doc;
    assert.equal(model.readLedger(doc).roundUndo.length, round);
    assert.deepEqual(shape(doc), expectedShape);
    assert.deepEqual(model.projection(doc).revisions.map(r => [r.id, r.paragraphIndex, r.text]),
      expected.revisions.map(r => [r.id, r.paragraphIndex, r.text]));
  }
  for (let i = 0; i < 5; i++) doc = model.decide(doc, { action: 'undo' }).doc;
  assert.equal(model.readLedger(doc).roundUndo.length, 0);
  for (let i = 0; i < 5; i++) doc = model.decide(doc, { action: 'redo' }).doc;
  assert.equal(model.readLedger(doc).roundUndo.length, 5);
  assert.equal(model.projection(doc).current, expected.current);
  assert.deepEqual(shape(doc), expectedShape);
});
test('Malformed list/cell trees and orphan paragraph coordinates fail before a pending projection exists', () => {
  const ledger = model.readLedger(fixture());
  for (const mutate of [
    x => { x.source.content[1].content[0].content[0].attrs.rowspan = 3; },
    x => { x.source.content[1].content[0].content[0].content[0].content[0].content.push(p('ambiguous continuation')); },
    x => { x.revisions[2].paragraphIndex = x.revisions[3].paragraphIndex = 1000; },
    x => { x.source.content[1].content[0].content[0].content[0].attrs.start = -1; },
    x => { x.source.content[1].content[0].content[0].content.push(structuredClone(x.source.content[1])); },
  ]) {
    const bad = structuredClone(ledger); mutate(bad);
    assert.throws(() => model.bindLedger(bad), /PENDING_REVISIONS/u);
  }
});
test('Pending rich paragraph, list and nesting budgets enforce boundary minus one, boundary and overflow', () => {
  const ledger = source => ({ schemaVersion: 2, source, revisions: [], undo: [], redo: [], roundUndo: [], roundRedo: [], returnReceipts: [] });
  for (const count of [9999, 10000, 10001]) {
    const value = ledger({ type: 'doc', content: [ordered(1, ...Array.from({ length: count }, () => item('')))] });
    if (count <= 10000) assert.doesNotThrow(() => model.validateLedger(value));
    else assert.throws(() => model.validateLedger(value), /PENDING_REVISIONS_BUDGET/u);
  }
  for (const count of [2047, 2048, 2049]) {
    const value = ledger({ type: 'doc', content: Array.from({ length: count }, () => bullet(item(''))) });
    if (count <= 2048) assert.doesNotThrow(() => model.validateLedger(value));
    else assert.throws(() => model.validateLedger(value), /PENDING_REVISIONS_BUDGET/u);
  }
  for (const depth of [7, 8, 9]) {
    let nested = bullet(item(''));
    for (let i = 0; i < depth; i++) nested = bullet(item('', nested));
    const value = ledger({ type: 'doc', content: [nested] });
    if (depth <= 8) assert.doesNotThrow(() => model.validateLedger(value));
    else assert.throws(() => model.validateLedger(value), /PENDING_REVISIONS_BUDGET/u);
  }
});
test('Actual committed-context reader admits bounded pending leaves while keeping comment and dirty-scene restrictions', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pending-rich-context-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'scene.txt'), doc = fixture();
  fs.writeFileSync(file, envelope.composeObservablePayload({ doc }));
  const main = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
  const start = main.indexOf('async function readCommentAuthoringContext(');
  const source = main.slice(start, main.indexOf('async function readCommentAuthoringProjection(', start));
  const context = vm.createContext({ fs: fs.promises, path, activePendingRecording: null, isDirty: false,
    autoSaveInProgress: false, currentFilePath: file, currentLifecycleSubjectId: () => 'life', commentAuthoringSessionId: 'session',
    isAllowedFilePath: value => value === file, getDocumentContextFromPath: () => ({ kind: 'scene' }),
    readReviewExactTextApplyProjectBinding: async () => ({ ok: true, projectRoot: root, projectId: 'rich-context' }),
    loadDocumentContentEnvelopeModule: async () => envelope, pendingTextRevisions: model,
    computeHash: value => crypto.createHash('sha256').update(value).digest('hex'),
    loadRtkNonTextReturnModule: async () => ({ readCommentAuthoringState: async () => ({ state: { threads: [] } }) }),
  });
  vm.runInContext(source, context);
  await assert.rejects(context.readCommentAuthoringContext(), /COMMENT_STORY_UNSUPPORTED/u);
  const result = await context.readCommentAuthoringContext({ pendingRichBlocks: true });
  assert.deepEqual(Array.from(result.paragraphs), model.paragraphs(model.normalizeNode(doc)).map(text));
  assert.equal(result.sceneId, 'scene.txt'); assert.equal(result.projectId, 'rich-context');
  context.isDirty = true;
  await assert.rejects(context.readCommentAuthoringContext({ pendingRichBlocks: true }), /COMMENT_SAVE_SCENE_FIRST/u);
  context.isDirty = false; context.activePendingRecording = {};
  await assert.rejects(context.readCommentAuthoringContext({ pendingRichBlocks: true }), /RECORDING_STOP_BEFORE_ANNOTATIONS_OR_REVIEW/u);
});
test('Tracked table mutations and text revisions targeting a continuation cell cannot inherit text authority', async () => {
  const [bridge] = await modules;
  const bytes = await exportDoc(fixture(), 'full');
  const cryptoPort = { sha256Text: value => crypto.createHash('sha256').update(value).digest('hex'),
    sha256Json: value => 'sha256:' + crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'), byteLength: value => Buffer.byteLength(value) };
  const parts = bridge.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes }, { cryptoPort }).parts;
  const xml = parts['word/document.xml'];
  for (const replace of [
    x => x.replace('</w:tblPr>', '<w:tblPrChange w:id="990"/></w:tblPr>'),
    x => x.replace('<w:vMerge w:val="continue"/></w:tcPr><w:p/>', '<w:vMerge w:val="continue"/></w:tcPr><w:p><w:ins w:id="991"><w:r><w:t>wrong cell</w:t></w:r></w:ins></w:p>'),
    x => x.replace('<w:tr>', '<w:tr><w:trPr><w:ins w:id="992"/></w:trPr>'),
  ]) {
    const changed = replace(xml); assert.notEqual(changed, xml);
    const bad = buildStoredZip(Object.entries(parts).map(([name, data]) => ({ name, data: name === 'word/document.xml' ? changed : data })));
    assert.equal(bridge.buildDocxContentPreviewFromZipBytes(bad).ok, false);
  }
});

test('Actual authenticated pending return preserves exact empty-block positions and rejects mismatched or stale input', async () => {
  const doc = fixture(), raw = envelope.composeObservablePayload({ doc }), bytes = await exportDoc(doc, 'full');
  const [bridge] = await modules;
  const incoming = await parse(bytes), exactText = model.paragraphs(model.normalizeNode(incoming)).map(text).join('\n');
  assert.notEqual(envelope.deriveVisibleTextFromDocument(incoming), exactText);
  const hash = value => crypto.createHash('sha256').update(value).digest('hex');
  const main = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
  const start = main.indexOf('async function prepareAuthenticatedPendingReturn(');
  const source = main.slice(start, main.indexOf('// Only an object retained', start));
  const file = '/synthetic/scene.txt', sceneId = 'scene.txt', root = '/synthetic';
  const capsule = { projectRoot: root, exportMapAuthority: 'main-owned-active-export-authority-store-after-return-authentication',
    returnedArtifactExportMapAccepted: false, exportMap: { scenes: [{ sceneId }] }, scenePathBySceneId: { [sceneId]: file },
    baselineObservableContentBySceneId: { [sceneId]: raw }, roundId: 'rich-return' };
  const context = { projectRoot: root, projectId: 'rich', reviewTransportAuthorityCapsule: capsule,
    reviewTransportReturnIntake: { authenticated: true, returnedArtifactSha256: 'sha256:' + hash(bytes), parserResult: {} } };
  const sandbox = vm.createContext({ Buffer, loadDocumentContentEnvelopeModule: async () => envelope, pendingTextRevisions: model,
    activeStage10ApplicationBootstrap: {}, currentLifecycleSubjectId: () => 'life', lastSignaledEditGeneration: 1,
    currentFilePath: file, isDirty: false, autoSaveInProgress: false, getProjectRootPath: () => root,
    computeHash: hash, createRtkReviewTransportCryptoPort: () => ({}), docxReviewReturnIntakeProductBudgets: () => ({}),
    readCommentAuthoringContext: async () => ({ projectId: 'rich', projectRoot: root, sceneId, raw, parsed: { doc } }),
  });
  vm.runInContext(source, sandbox);
  let mappedText = exactText, prepared;
  const adapter = { ...bridge, extractDocxReviewTransportWordDocumentProjection: () => ({ ok: true, documentXml: '' }),
    visibleSceneTextsFromWordDocumentXml: () => ({ ok: true, sceneTexts: [mappedText] }) };
  const run = (isCurrent = () => true) => sandbox.prepareAuthenticatedPendingReturn({ context, docxBytes: bytes,
    revisionBridge: adapter, isCurrent, onPrepared: value => { prepared = value; } });
  assert.equal((await run()).code, 'PENDING_RETURN_EXPLICIT_APPLY_REQUIRED');
  assert.deepEqual(shape(prepared.changes.after), shape(doc));
  mappedText = exactText.replace('before', 'different');
  assert.equal((await run()).code, 'PENDING_RETURN_PROJECTION_MISMATCH');
  mappedText = exactText;
  assert.equal((await run(() => false)).code, 'PENDING_RETURN_CONTEXT_STALE');
  context.reviewTransportReturnIntake.returnedArtifactSha256 = 'sha256:' + '0'.repeat(64);
  assert.equal((await run()).code, 'PENDING_RETURN_AUTHORITY_REQUIRED');
});

test('Pending rich export binds cell preferred widths to the retained grid including both merge axes', async () => {
  const source = model.normalizeNode(fixture());
  source.content[1].attrs = { wordTable: { version: 1, grid: [4359, 2781, 1627], layout: null,
    widthDxa: null, shading: null, borders: {} } };
  const original = model.readLedger(fixture()); original.source.content[1].attrs = source.content[1].attrs;
  const doc = model.bindLedger(original), [bridge] = await modules;
  const cryptoPort = { sha256Text: value => crypto.createHash('sha256').update(value).digest('hex'),
    sha256Json: value => 'sha256:' + crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'), byteLength: value => Buffer.byteLength(value) };
  for (const profile of ['minimum', 'full']) {
    const bytes = await exportDoc(doc, profile);
    const parts = bridge.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes }, { cryptoPort }).parts;
    const widths = [...parts['word/document.xml'].matchAll(/<w:tcW w:w="(\d+)" w:type="dxa"\/>/gu)].map(m => Number(m[1]));
    assert.deepEqual(widths, [4359, 4408, 4359, 2781, 1627]);
    assert.deepEqual(shape(await parse(bytes)), shape(doc));
  }
});

test('Native pending confirmation names all canonical paragraph leaves without exposing container objects', async () => {
  const main = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
  const start = main.indexOf('async function confirmLocalWordPendingReturn(');
  let shown;
  const context = vm.createContext({ mainWindow: { isDestroyed: () => false }, pendingTextRevisions: model,
    dialog: { showMessageBox: async (_window, options) => { shown = options; return { response: 1 }; } } });
  vm.runInContext(main.slice(start, main.indexOf('async function confirmLocalWordNoteDelta(', start)), context);
  const doc = fixture();
  assert.equal(await context.confirmLocalWordPendingReturn({ fileName: 'review.docx', changes: { before: doc, after: doc } }), true);
  assert.doesNotMatch(shown.detail, /undefined|\[object Object\]/u);
  assert.match(shown.detail, /Абзац 12 \(текст\):\n«protected»/u);
  assert.equal((shown.detail.match(/^Абзац /gmu) || []).length, model.paragraphs(model.normalizeNode(doc)).length * 2);
});

test('Preferred width scalar bounds never invalidate a supported merged-cell grid', async () => {
  for (const width of [31679, 31680, 31681]) {
    const wide = cell(p('wide')); wide.attrs.colspan = 2;
    const doc = { type: 'doc', content: [{ type: 'table', attrs: { wordTable: { version: 1,
      grid: [16000, width - 16000], layout: 'fixed', widthDxa: null, shading: null, borders: {} } },
      content: [{ type: 'tableRow', content: [wide] }] }] };
    for (const profile of ['minimum', 'full']) {
      const bytes = await exportDoc(doc, profile);
      assert.deepEqual(shape(await parse(bytes)), shape(doc));
      assert.equal(bytes.includes(Buffer.from('<w:tcW w:w="' + width + '"')), width <= 31680);
    }
  }
});
