'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const model = require('../../src/core/word-manuscript-notes-v1.cjs');
const media = require('../../src/io/documentMedia.js');
const jpeg = require('../fixtures/document-jpeg-fixtures.cjs');
const { buildCanonicalNotesExport } = require('../../src/export/docx/docxReviewPacketNotes.js');
const { buildDocxMinBuffer } = require('../../src/export/docx/docxMinBuilder.js');
const { planNoteReturnDelta } = require('../../src/core/word-note-return-delta-v1.cjs');
const clone = value => JSON.parse(JSON.stringify(value));
const p = (...content) => ({ type: 'paragraph', content });
const text = value => ({ type: 'text', text: value });
const doc = (...content) => ({ type: 'doc', content });
const image = () => ({ type: 'image', attrs: media.createImageAttrs(jpeg.rgb, { alt: 'note image', displayName: 'note.jpg' }) });
const body = () => doc(p(text('before'), image(), text('after')));
const block = { sceneId: 'roman/a.txt', blockId: 'b', documentParagraphIndex: 0, text: 'Text', formatIr: { runs: [{ text: 'Text' }] } };
function notes(value = body()) { return { schemaVersion: 1, projectId: 'p', notes: ['footnote', 'endnote'].map(kind => ({
  id: kind, scope: 'manuscript', title: '', body: model.validateNoteBody(value).text,
  manuscript: model.bindManuscriptPayload({ body: value, kind, sceneId: block.sceneId, offsetUtf16: 2, sceneContent: 'Text' }),
})) }; }
async function exported(document) {
  const projection = buildCanonicalNotesExport(document, [], [block], 'p', { editableReturn: true });
  const [docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await Promise.all([
    import('../../src/docxPageSetupBind.mjs'), import('../../src/derived/semanticMapping.mjs'), import('../../src/derived/styleMap.mjs')]);
  return { projection, bytes: buildDocxMinBuffer({ doc: doc(p(text('Text'))), plainText: 'Text', bookProfile: { formatId: 'A4' } },
    { docxPageSetupBindModule, semanticMappingModule, styleMapModule, documentNotes: projection, noteBlocks: [block] }) };
}
test('note media: both kinds share bytes but retain independent placement and five exported cycles', async () => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  let document = notes();
  for (let round = 0; round < 5; round++) {
    const { bytes } = await exported(document);
    const preview = bridge.buildDocxContentPreviewFromZipBytes(bytes);
    assert.equal(preview.ok, true, JSON.stringify(preview));
    assert.equal(preview.contentPreview.manuscriptNotes.length, 2);
    for (const note of preview.contentPreview.manuscriptNotes) {
      const asset = media.documentMedia(note.body).assets[0];
      assert.deepEqual(asset.bytes, jpeg.rgb);
      assert.equal(model.validateNoteBody(note.body).text, 'beforeafter');
      assert.equal(note.body.content[0].content[1].type, 'image');
    }
    const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(preview);
    assert.equal(plan.ok, true, JSON.stringify(plan));
    document = notes(preview.contentPreview.manuscriptNotes[0].body);
  }
});
test('note media: unknown attributes, forged hashes, external authority and note budget refuse', () => {
  for (const change of [n => n.attrs.sha256 = '0'.repeat(64), n => n.attrs.assetPath = '../private.png',
    n => n.attrs.src = 'https://invalid.test/image.jpg', n => n.marks = [{ type: 'link', attrs: { href: 'https://invalid.test' } }]]) {
    const value = body(); change(value.content[0].content[1]); assert.throws(() => model.validateNoteBody(value));
  }
  const value = doc(p(...Array.from({ length: Math.ceil(model.LIMITS.bytes / JSON.stringify(image()).length) + 1 }, image)));
  assert.throws(() => model.validateNoteBody(value), /BUDGET/);
});
test('note media: image-only edits produce explicit delta; unchanged image retains exact body', () => {
  const document = notes(), baseline = buildCanonicalNotesExport(document, [], [block], 'p', { editableReturn: true });
  const returned = baseline.sourceBindings.map(binding => ({ kind: binding.kind, paragraphIndex: 0, offsetUtf16: 2,
    transportIdentity: binding.transportIdentity, paragraphs: binding.paragraphs, body: clone(binding.richBody) }));
  const input = { document, projectId: 'p', roundId: 'round', artifactSha256: 'a'.repeat(64), baseline,
    exportMap: { scenes: [{ sceneId: block.sceneId, blocks: [block] }] }, returnedNotes: returned,
    returnedParagraphs: [{ paragraphIndex: 0, paragraphText: 'Text', trackedRevision: false }], now: '2026-10-01T10:00:00Z' };
  assert.equal(planNoteReturnDelta(input).unchanged, true);
  for (const mutate of [n => n.attrs.alt = 'changed', n => Object.assign(n.attrs, { displayWidthEmu: 400000, displayHeightEmu: 300000 }),
    n => n.attrs = media.createImageAttrs(jpeg.gray)]) {
    const changed = clone(returned); mutate(changed[0].body.content[0].content[1]);
    const result = planNoteReturnDelta({ ...input, returnedNotes: changed });
    assert.equal(result.changes.length, 1); assert.equal(result.changes[0].operation, 'update');
    assert.deepEqual(result.document.notes[1], document.notes[1]);
    assert.deepEqual(result.document.notes[0].manuscript.body, changed[0].body);
  }
});
test('note media: durable transaction binds asset bytes, preserves private state, and publishes unchanged scene', async t => {
  const tx = require('../../src/core/project-transaction-v1.cjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'note-media-tx-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const scenePath = path.join(root, block.sceneId), manifestPath = path.join(root, 'project.json'), notePath = path.join(root, 'notes.craftsman.json');
  fs.mkdirSync(path.dirname(scenePath), { recursive: true });
  const before = notes(doc(p(text('beforeafter')))); before.notes.unshift({ id: 'private', scope: 'inbox', body: 'protected' });
  const after = notes(); after.notes.unshift(clone(before.notes[0]));
  const beforeText = JSON.stringify(before), afterText = JSON.stringify(after), manifestContent = JSON.stringify({ projectId: 'p' });
  fs.writeFileSync(scenePath, 'Text'); fs.writeFileSync(manifestPath, manifestContent); fs.writeFileSync(notePath, beforeText);
  const asset = media.documentMedia(body()).assets[0], resource = { path: path.join(root, asset.attrs.assetPath), content: asset.bytes };
  const request = { scenePath, manifestPath, sceneContent: 'Text', expectedSceneContent: 'Text', manifestContent, expectedManifestContent: manifestContent,
    revision: 1, noteState: { mode: 'MANUSCRIPT_BODY_UPDATE_V1', beforeText, afterText }, mediaUpdateResources: [resource],
    publishManifest: async ({ expectedText, nextText }) => { assert.equal(fs.readFileSync(manifestPath, 'utf8'), expectedText); fs.writeFileSync(manifestPath, nextText); } };
  const forged = clone(after); forged.notes[0].body = 'leak';
  await assert.rejects(tx.commitProjectTransaction({ ...request, noteState: { ...request.noteState, afterText: JSON.stringify(forged) } }), /NOTE_STATE/);
  await assert.rejects(tx.commitProjectTransaction({ ...request, mediaUpdateResources: [{ ...resource, content: jpeg.gray }] }), /MEDIA_RESOURCE_BINDING/);
  assert.equal(fs.readFileSync(notePath, 'utf8'), beforeText); assert.equal(fs.existsSync(resource.path), false);
  const result = await tx.commitProjectTransaction(request); assert.equal(result.success, true);
  assert.equal(fs.readFileSync(scenePath, 'utf8'), 'Text'); assert.equal(fs.readFileSync(notePath, 'utf8'), afterText);
  assert.deepEqual(fs.readFileSync(resource.path), asset.bytes);
});

test('note media: generic import atomically creates note assets and replay detects substitution', async t => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const { applyDocxImportSafeCreate, rememberDocxImportPreviewPlanAdmission } = require('../fixtures/docx-import-real-authority.cjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'note-media-import-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const { bytes } = await exported(notes());
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(bridge.buildDocxContentPreviewFromZipBytes(bytes));
  assert.equal(plan.ok, true); rememberDocxImportPreviewPlanAdmission(plan);
  const options = { projectRoot: root, romanRoot: path.join(root, 'roman'), projectId: 'note-image-project' };
  const result = await applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, options);
  assert.equal(result.ok, true, JSON.stringify(result));
  const assetPath = path.join(root, image().attrs.assetPath);
  assert.deepEqual(fs.readFileSync(assetPath), jpeg.rgb);
  const saved = JSON.parse(fs.readFileSync(path.join(root, 'notes.craftsman.json')));
  assert.equal(saved.notes.length, 2); assert.equal(media.documentMedia(saved.notes[0].manuscript.body).assets.length, 1);
  assert.equal((await applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, options)).value.idempotent, true);
  fs.writeFileSync(assetPath, jpeg.gray);
  assert.equal((await applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, options)).error.code, 'DOCX_SAFE_CREATE_MEDIA_INVALID');
});

test('note media: actual editor schema preserves image between text through serialization', async () => {
  const { getSchema } = await import('@tiptap/core');
  const { default: StarterKit } = await import('@tiptap/starter-kit');
  const { DocumentMedia } = await import('../../src/renderer/tiptap/documentMedia.mjs');
  const schema = getSchema([StarterKit.configure({ heading: false, codeBlock: false }), DocumentMedia]);
  const parsed = schema.nodeFromJSON(body()); parsed.check();
  assert.deepEqual(model.validateNoteBody(parsed.toJSON()).body, body());
  assert.equal(schema.nodes.image.spec.parseDOM.length, 0);
});

test('note media: crash after notes publication rolls back both image and notes; committed recovery retains both', async t => {
  const tx = require('../../src/core/project-transaction-v1.cjs'), { spawnSync } = require('node:child_process');
  for (const boundary of ['NOTES', 'COMMIT']) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'note-media-crash-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const scenePath = path.join(root, block.sceneId), manifestPath = path.join(root, 'project.json'), notePath = path.join(root, 'notes.craftsman.json');
    fs.mkdirSync(path.dirname(scenePath), { recursive: true });
    const beforeText = JSON.stringify(notes(doc(p(text('beforeafter'))))), afterText = JSON.stringify(notes()), manifestContent = JSON.stringify({ projectId: 'p' });
    fs.writeFileSync(scenePath, 'Text'); fs.writeFileSync(manifestPath, manifestContent); fs.writeFileSync(notePath, beforeText);
    const asset = media.documentMedia(body()).assets[0], resourcePath = path.join(root, asset.attrs.assetPath);
    const request = { scenePath, manifestPath, sceneContent: 'Text', expectedSceneContent: 'Text', manifestContent, expectedManifestContent: manifestContent,
      revision: 1, noteState: { mode: 'MANUSCRIPT_BODY_UPDATE_V1', beforeText, afterText }, mediaUpdateResources: [{ path: resourcePath, content: [...asset.bytes] }] };
    const script = `const fs=require('node:fs'),fsp=require('node:fs/promises'),tx=require(${JSON.stringify(require.resolve('../../src/core/project-transaction-v1.cjs'))});
      const q=JSON.parse(fs.readFileSync(0)); q.mediaUpdateResources[0].content=Buffer.from(q.mediaUpdateResources[0].content);
      const target=${JSON.stringify(boundary === 'NOTES' ? notePath : tx.commitPathFor(scenePath))};
      const fsAdapter={...fsp,rename:async(a,b)=>{await fsp.rename(a,b);if(b===target)process.kill(process.pid,'SIGKILL')}};
      tx.commitProjectTransaction({...q,fsAdapter,publishManifest:async({nextText})=>fs.writeFileSync(q.manifestPath,nextText)}).catch(e=>{console.error(e);process.exit(1)});`;
    const crashed = spawnSync(process.execPath, ['-e', script], { input: JSON.stringify(request), timeout: 15000 });
    assert.equal(crashed.signal, 'SIGKILL', crashed.stderr.toString());
    await tx.recoverProjectTransaction({ scenePath, manifestPath, publishManifest: async ({ nextText }) => fs.writeFileSync(manifestPath, nextText) });
    assert.equal(fs.readFileSync(scenePath, 'utf8'), 'Text');
    assert.equal(fs.readFileSync(notePath, 'utf8'), boundary === 'NOTES' ? beforeText : afterText);
    assert.equal(fs.existsSync(resourcePath), boundary === 'COMMIT');
  }
});

test('note media: package rejects hostile image relationships, bytes, MIME and drawing attributes', async () => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs'), { spawnSync } = require('node:child_process');
  const { bytes } = await exported(notes());
  for (const mode of ['external', 'escape', 'mime', 'bytes', 'unused', 'effect']) {
    const script = `import sys,json,base64,zipfile,io
source,mode=json.loads(sys.stdin.read()); z=zipfile.ZipFile(io.BytesIO(base64.b64decode(source))); p={n:z.read(n) for n in z.namelist()}
r='word/_rels/footnotes.xml.rels'
if mode=='external':p[r]=p[r].replace(b'Target="media/',b'TargetMode="External" Target="https://invalid.test/')
if mode=='escape':p[r]=p[r].replace(b'Target="media/',b'Target="../media/')
if mode=='mime':p['[Content_Types].xml']=p['[Content_Types].xml'].replace(b'image/jpeg',b'image/png')
if mode=='bytes':p[next(n for n in p if n.startswith('word/media/'))]=b'corrupt'
if mode=='unused':p[r]=p[r].replace(b'</Relationships>',b'<Relationship Id="unused" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/unused.jpg"/></Relationships>')
if mode=='effect':p['word/footnotes.xml']=p['word/footnotes.xml'].replace(b'<a:xfrm>',b'<a:xfrm rot="20">')
o=io.BytesIO()
with zipfile.ZipFile(o,'w',zipfile.ZIP_STORED) as out:
 for n,v in p.items():out.writestr(n,v)
sys.stdout.buffer.write(o.getvalue())`;
    const changed = spawnSync('python3', ['-c', script], { input: JSON.stringify([bytes.toString('base64'), mode]) });
    assert.equal(changed.status, 0, changed.stderr.toString());
    assert.equal(bridge.buildDocxContentPreviewFromZipBytes(changed.stdout).ok, false, mode);
  }
});
