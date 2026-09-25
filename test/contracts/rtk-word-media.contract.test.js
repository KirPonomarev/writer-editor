'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { createImageAttrs } = require('../../src/io/documentMedia.js');
const { buildDocxMinBuffer } = require('../../src/export/docx/docxMinBuilder.js');
function python(code, input) {
  const r = spawnSync('python3', ['-c', code], { input, maxBuffer: 8 * 1024 * 1024 });
  assert.equal(r.status, 0, r.stderr.toString()); return r.stdout;
}
function image(blue = false) {
  return python(`import zlib,struct,sys
chunk=lambda t,d:struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d))
p=bytes([0,0,255,255] if ${blue ? 'True' : 'False'} else [255,0,0,255])
sys.stdout.buffer.write(b'\\x89PNG\\r\\n\\x1a\\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',2,1,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(b'\\x00'+p*2))+chunk(b'IEND',b''))`);
}
async function exported(doc) {
  const [docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await Promise.all([
    import('../../src/docxPageSetupBind.mjs'), import('../../src/derived/semanticMapping.mjs'), import('../../src/derived/styleMap.mjs'),
  ]);
  return buildDocxMinBuffer({ doc, bookProfile: { formatId: 'A4' } }, { docxPageSetupBindModule, semanticMappingModule, styleMapModule });
}
function inspect(bytes) {
  return JSON.parse(python(`import sys,io,zipfile,json,hashlib,xml.etree.ElementTree as E
z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))
n={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main','wp':'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships','pr':'http://schemas.openxmlformats.org/package/2006/relationships','ct':'http://schemas.openxmlformats.org/package/2006/content-types'}
d=E.fromstring(z.read('word/document.xml'))
r=E.fromstring(z.read('word/_rels/document.xml.rels'))
rels={x.attrib['Id']:x.attrib['Target'] for x in r if x.attrib.get('Type','').endswith('/image')}
imgs=[x.attrib['{'+n['r']+'}embed'] for x in d.findall('.//a:blip',n)]
print(json.dumps({'names':z.namelist(),'targets':list(rels.values()),'embeds':imgs,'alts':[x.attrib['descr'] for x in d.findall('.//wp:docPr',n)],'displayNames':[x.attrib['name'] for x in d.findall('.//wp:docPr',n)],'dimensions':[[x.attrib['cx'],x.attrib['cy']] for x in d.findall('.//wp:extent',n)],'hashes':[hashlib.sha256(z.read('word/'+rels[i])).hexdigest() for i in imgs],'pngTypes':[x.attrib for x in E.fromstring(z.read('[Content_Types].xml')) if x.attrib.get('Extension')=='png']}))`, bytes).toString());
}
test('Word media: actual DOCX carries two distinct binaries and three ordered placements with reused image and literal alt', async () => {
  const red = image(), blue = image(true);
  const attrs = [createImageAttrs(red, { alt: '紅 & <red> 🧭\nline\t2', displayName: 'same.png' }), createImageAttrs(blue, { alt: 'blue', displayName: 'same.png' })];
  const doc = { type: 'doc', content: [attrs[0], attrs[1], attrs[0]].map(a => ({ type: 'paragraph', content: [{ type: 'image', attrs: a }] })) };
  const out = inspect(await exported(doc));
  const h = bytes => createHash('sha256').update(bytes).digest('hex');
  assert.deepEqual(out.hashes, [h(red), h(blue), h(red)]);
  assert.equal(out.names.filter(n => n.startsWith('word/media/')).length, 2);
  assert.deepEqual(out.alts, [attrs[0].alt, attrs[1].alt, attrs[0].alt]);
  assert.deepEqual(out.displayNames, ['same.png', 'same.png', 'same.png']);
  assert.deepEqual(out.dimensions, Array(3).fill(['19050', '9525']));
  assert.equal(out.embeds[0], out.embeds[2]); assert.notEqual(out.embeds[0], out.embeds[1]);
  assert.deepEqual(out.pngTypes, [{ Extension: 'png', ContentType: 'image/png' }]);
  assert.equal(new Set(out.names).size, out.names.length);
});
test('Word media: export rejects forged owned path or substituted image before package creation', async () => {
  const a = createImageAttrs(image());
  for (const change of [{ assetPath: '../outside.png' }, { dataBase64: image(true).toString('base64') }]) {
    await assert.rejects(() => exported({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'image', attrs: { ...a, ...change } }] }] }), /DOCUMENT_MEDIA_IDENTITY/);
  }
});


test('Word media: generic import reconstructs ordered image identity and alt from actual DOCX bytes', async () => {
  const red = createImageAttrs(image(), { alt: '赤 & alt\nline', displayName: 'same.png' });
  const blue = createImageAttrs(image(true), { alt: 'blue', displayName: 'same.png' });
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'before ' }, { type: 'image', attrs: red }, { type: 'text', text: ' middle ' },
    { type: 'image', attrs: blue }, { type: 'image', attrs: red }, { type: 'text', text: ' after' },
  ] }] };
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const envelope = await import('../../src/renderer/documentContentEnvelope.mjs');
  const preview = bridge.buildDocxContentPreviewFromZipBytes(await exported(doc));
  assert.equal(preview.ok, true, JSON.stringify(preview));
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(preview);
  assert.equal(plan.ok, true, JSON.stringify(plan));
  const parsed = envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content);
  assert.deepEqual(parsed.doc, envelope.canonicalizeDocumentJson(doc));
});


test('Word media: admitted generic create stores actual assets atomically and replay detects missing or altered binary', async t => {
  const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
  const { applyDocxImportSafeCreate, rememberDocxImportPreviewPlanAdmission } = require('../fixtures/docx-import-real-authority.cjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'word-media-create-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const attrs = createImageAttrs(image(), { alt: 'red', displayName: 'same.png' });
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'image ' }, { type: 'image', attrs }] }] };
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(bridge.buildDocxContentPreviewFromZipBytes(await exported(doc)));
  assert.equal(plan.ok, true, JSON.stringify(plan));
  assert.equal(plan.lossReport.items.some(x => x.code === 'DOCX_IMPORT_PREVIEW_MEDIA_NOT_IMPORTED'), false, JSON.stringify(plan.lossReport));
  rememberDocxImportPreviewPlanAdmission(plan);
  const options = { projectRoot: root, romanRoot: path.join(root, 'roman'), projectId: 'word-media-test' };
  const result = await applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, options);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(fs.readFileSync(path.join(root, attrs.assetPath)), image());
  const replay = await applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, options);
  assert.equal(replay.ok, true, JSON.stringify(replay)); assert.equal(replay.value.idempotent, true);
  fs.writeFileSync(path.join(root, attrs.assetPath), image(true));
  assert.equal((await applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, options)).error.code, 'DOCX_SAFE_CREATE_MEDIA_INVALID');
  fs.unlinkSync(path.join(root, attrs.assetPath));
  assert.equal((await applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, options)).error.code, 'DOCX_SAFE_CREATE_MEDIA_MISSING');
});


test('Word media: main and local preview projections retain the exact image-bearing candidate', async () => {
  const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const { createDocxImportLocalFilePreview } = require('../../src/utils/docxImportLocalFilePreview.js');
  const attrs = createImageAttrs(image(), { alt: 'same alt', displayName: 'same.png' });
  const bytes = await exported({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'image', attrs }] }] });
  const report = bridge.buildDocxContentPreviewFromZipBytes(bytes);
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(report);
  const main = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
  const start = main.indexOf('function copyDocxImportPreviewAllowedFields('), end = main.indexOf('function validateDocxImportPreviewPayload(', start);
  const projected = vm.runInNewContext(main.slice(start, end) + '\ncanonicalizeDocxImportPreviewSourceReport(report);', {
    report, isPlainObjectValue: v => Boolean(v && typeof v === 'object' && !Array.isArray(v)), cloneJsonSafe: v => JSON.parse(JSON.stringify(v)),
  });
  const mainPlan = bridge.buildDocxImportPreviewPlanFromContentPreview(JSON.parse(JSON.stringify(projected)));
  const local = await createDocxImportLocalFilePreview({}, { pickLocalFile: async () => ({ path: '/tmp/synthetic-media.docx' }), readLocalFileBytes: async () => bytes });
  assert.equal(plan.ok, true, JSON.stringify(plan)); assert.equal(mainPlan.ok, true, JSON.stringify(mainPlan)); assert.equal(local.ok, true, JSON.stringify(local));
  assert.equal(mainPlan.candidateCreatePlan.entries[0].content, plan.candidateCreatePlan.entries[0].content);
  assert.equal(local.docxImportPreviewPlan.candidateCreatePlan.entries[0].content, plan.candidateCreatePlan.entries[0].content);
  assert.equal(mainPlan.lossReport.items.some(x => x.code === 'DOCX_IMPORT_PREVIEW_MEDIA_NOT_IMPORTED'), false);
});

test('Word media: raw escaping relationships, missing or corrupt images and wrong content types fail before import', async () => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const attrs = createImageAttrs(image());
  const source = await exported({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'image', attrs }] }] });
  for (const mode of ['escape', 'missing', 'crc', 'mime']) {
    const changed = python(`import sys,io,zipfile
z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()));parts={n:z.read(n) for n in z.namelist()}
mode='${mode}'
name=next(n for n in parts if n.startswith('word/media/'))
if mode=='escape':parts['word/_rels/document.xml.rels']=parts['word/_rels/document.xml.rels'].replace(b'Target="media/',b'Target="../../media/')
if mode=='missing':del parts[name]
if mode=='crc':b=bytearray(parts[name]);b[-1]^=1;parts[name]=bytes(b)
if mode=='mime':parts['[Content_Types].xml']=parts['[Content_Types].xml'].replace(b'image/png',b'image/svg+xml')
out=io.BytesIO()
with zipfile.ZipFile(out,'w') as dest:
 for n,b in parts.items():dest.writestr(n,b)
sys.stdout.buffer.write(out.getvalue())`, source);
    assert.equal(bridge.buildDocxContentPreviewFromZipBytes(changed).ok, false, mode);
  }
});

test('Word media: review packet retains image-only and mixed paragraphs, reuse, marks and literal placement', async () => {
  const { buildFormatIrParagraphs } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
  const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder.js');
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const envelope = await import('../../src/renderer/documentContentEnvelope.mjs');
  const red = createImageAttrs(image(), { alt: 'red', displayName: 'red.png' });
  const blue = createImageAttrs(image(true), { alt: 'blue', displayName: 'blue.png' });
  const doc = { type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'image', attrs: red }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'before ', marks: [{ type: 'bold' }] }, { type: 'image', attrs: blue }, { type: 'image', attrs: red }, { type: 'text', text: ' after' }] },
  ] };
  const blocks = buildFormatIrParagraphs({ doc, text: envelope.deriveVisibleTextFromDocument(doc), sceneId: 'media.txt' });
  const build = blocks => buildDocxReviewPacketBuffer({ blocks, customProperties: [{ name: 'YRTK_C01_AUTH', value: 'synthetic-without-authority' }, { name: 'YRTK2_TOKEN', value: 'synthetic-without-authority' }] });
  const bytes = build(blocks);
  assert.deepEqual(inspect(bytes).alts, ['red', 'blue', 'red']);
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(bridge.buildDocxContentPreviewFromZipBytes(bytes));
  assert.equal(plan.ok, true, JSON.stringify(plan));
  assert.deepEqual(envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc, envelope.canonicalizeDocumentJson(doc));
  for (const offset of [-1, 1, 1.5, 99]) {
    const invalid = structuredClone(blocks); invalid[0].formatIr.media[0].offset = offset;
    assert.throws(() => build(invalid), /DOCX_MEDIA_PLACEMENT/);
  }
});

test('Word media: review intake derives image hashes from ZIP bytes and requires exact authenticated source graph', async () => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const { buildFormatIrParagraphs } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
  const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder.js');
  const { buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
  const cryptoPort = { sha256Text: v => `sha256:${createHash('sha256').update(v).digest('hex')}`,
    sha256Json: v => `sha256:${createHash('sha256').update(JSON.stringify(v)).digest('hex')}`, byteLength: v => Buffer.byteLength(v) };
  const attrs = createImageAttrs(image(), { alt: 'protected alt', displayName: 'image.png' });
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'prefix ' }, { type: 'image', attrs }, { type: 'text', text: ' after' }] }] };
  const blocks = buildFormatIrParagraphs({ doc, text: 'prefix  after', sceneId: 'media.txt' });
  const bytes = buildDocxReviewPacketBuffer({ blocks, customProperties: [{ name: 'YRTK_C01_AUTH', value: 'synthetic-without-authority' }, { name: 'YRTK2_TOKEN', value: 'synthetic-without-authority' }] });
  const parse = bytes => bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes }, { cryptoPort });
  const result = parse(bytes);
  assert.equal(result.ok, true, JSON.stringify(result.reasons));
  assert.equal(result.reviewIr.documentMedia.placements[0].sha256, attrs.sha256);
  assert.equal(JSON.stringify(result.reviewIr.documentMedia).includes(attrs.dataBase64), false);
  const exportMap = { scenes: [{ sceneId: 'media.txt', blocks }] };
  const binding = bridge.bindDocxReviewMedia(result.reviewIr, exportMap);
  assert.equal(binding.ok, true, JSON.stringify(binding));
  assert.equal(binding.proof.automaticApplyAuthority, false);
  assert.equal(binding.reviewIr.opaqueUnsupported.some(x => x.elementName === 'drawing'), false);
  assert.equal(bridge.bindDocxReviewMedia(result.reviewIr, null).ok, false);
  const stripped = structuredClone(result.reviewIr); delete stripped.documentMedia;
  assert.equal(bridge.bindDocxReviewMedia(stripped, exportMap).ok, false);
  const unrelated = structuredClone(result.reviewIr); unrelated.opaqueUnsupported.push({ elementName: 'altChunk', writerAuthorityImpact: 'blocking' });
  assert.equal(bridge.bindDocxReviewMedia(unrelated, exportMap).reviewIr.opaqueUnsupported.some(x => x.elementName === 'altChunk'), true);
  const extracted = bridge.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes }, { cryptoPort });
  const all = { ...extracted.parts, ...extracted.binaryParts };
  for (const mode of ['replace', 'drop', 'alt', 'move', 'crc']) {
    const parts = { ...all };
    const png = Object.keys(parts).find(n => n.startsWith('word/media/'));
    if (mode === 'replace') parts[png] = image(true);
    if (mode === 'drop') parts['word/document.xml'] = parts['word/document.xml'].replace(/<w:drawing>[^]*?<\/w:drawing>/u, '');
    if (mode === 'alt') parts['word/document.xml'] = parts['word/document.xml'].replaceAll('protected alt', 'different alt');
    if (mode === 'move') parts['word/document.xml'] = parts['word/document.xml'].replace('prefix ', 'prefix longer ');
    if (mode === 'crc') { parts[png] = Buffer.from(parts[png]); parts[png][parts[png].length - 1] ^= 1; }
    const changed = parse(buildStoredZip(Object.entries(parts).map(([name, data]) => ({ name, data }))));
    assert.equal(changed.ok && bridge.bindDocxReviewMedia(changed.reviewIr, exportMap).ok, false, mode);
    if (changed.ok) assert.notEqual(changed.supportedSemanticDigest, result.supportedSemanticDigest, mode);
  }
});

test('Word media: exact text Apply preserves adjacent image bytes and rejects a replacement crossing the image', async t => {
  const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
  const writer = await import('../../src/io/revisionBridge/exactTextMinSafeWrite.mjs');
  const envelope = await import('../../src/renderer/documentContentEnvelope.mjs');
  const attrs = createImageAttrs(image(), { alt: 'keep me' });
  for (const [quote, replacementText, ok] of [['before', 'changed before', true], ['after', 'changed after', true], ['beforeafter', 'flatten', false]]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'media-exact-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const scenePath = path.join(root, 'scene.txt');
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'before' }, { type: 'image', attrs }, { type: 'text', text: 'after' }] }] };
    const original = envelope.composeObservablePayload({ doc }); fs.writeFileSync(scenePath, original);
    const change = { changeId: 'change-1', targetScope: { type: 'scene', id: 'scene-1' }, match: { kind: 'exact', quote, prefix: '', suffix: '' }, replacementText, createdAt: '2026-09-25T00:00:00.000Z' };
    const projectSnapshot = { projectId: 'project-1', baselineHash: 'baseline-1', scenes: [{ sceneId: 'scene-1', text: original }] };
    const revisionSession = { projectId: 'project-1', sessionId: 'session-1', baselineHash: 'baseline-1', status: 'open', reviewGraph: { textChanges: [change], structuralChanges: [], commentThreads: [], commentPlacements: [], diagnosticItems: [], decisionStates: [] } };
    const result = await writer.applyExactTextBatchMinSafeWrite({ projectRoot: root, projectSnapshot, revisionSession, reviewItems: [change], scenePath, scenePathBySceneId: { 'scene-1': scenePath } });
    assert.equal(result.ok, ok, JSON.stringify(result));
    const actual = fs.readFileSync(scenePath, 'utf8');
    if (ok) {
      assert.deepEqual(envelope.parseObservablePayload(actual).doc.content[0].content.find(n => n.type === 'image').attrs, attrs);
      assert.equal(envelope.parseObservablePayload(actual).text, 'beforeafter'.replace(quote, replacementText));
      assert.equal(fs.readFileSync(result.receipt.recovery.snapshotPath, 'utf8'), original);
    } else assert.equal(actual, original);
  }
});

test('Word media: unsupported drawing semantics cannot masquerade as preserved image bytes', async () => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const { buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
  const attrs = createImageAttrs(image());
  const source = await exported({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'image', attrs }] }] });
  const { parts, binaryParts } = bridge.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes: source });
  const mutations = [
    x => x.replace('<a:xfrm>', '<a:xfrm rot="5400000">'),
    x => x.replace('<a:xfrm>', '<a:xfrm flipH="1">'),
    x => x.replace('<a:stretch>', '<a:srcRect l="50000"/><a:stretch>'),
    x => x.replace('<wp:docPr ', '<wp:docPr hidden="1" '),
    x => x.replace('<a:blip ', '<a:blip r:link="external" '),
    x => x.replace('<w:drawing>', '<w:del w:id="1"><w:drawing>').replace('</w:drawing>', '</w:drawing></w:del>'),
    x => x.replace('prst="rect"', 'prst="ellipse"'),
    x => x.replace('<a:off x="0"', '<a:off x="123"'),
    x => x.replace('<a:fillRect/>', '<a:fillRect r="2000"/>'),
    x => x.replace('<pic:spPr>', '<pic:spPr><a:effectLst><a:grayscl/></a:effectLst>'),
  ];
  for (const mutate of mutations) {
    const xml = mutate(parts['word/document.xml']); assert.notEqual(xml, parts['word/document.xml']);
    const bytes = buildStoredZip(Object.entries({ ...parts, ...binaryParts, 'word/document.xml': xml }).map(([name, data]) => ({ name, data })));
    assert.equal(bridge.buildDocxContentPreviewFromZipBytes(bytes).ok, false, xml);
  }
});


test('Word media: independent raw oracle executes real retained Word bytes and rejects corruptions', () => {
  const path = require('node:path');
  const result = spawnSync('python3', ['-I', '-B', path.join(__dirname, '../unit/rtk-word-media.test.py')], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /Ran 6 tests/u);
  assert.match(result.stderr, /OK/u);
});


test('Word media acceptance rejects missing native hops, broken asset continuity and altered round bindings', async () => {
 const { validateManuscriptMediaProof: check } = await import('../../scripts/ops/rtk-interop-word-manuscript-batch.mjs');
 const witnesses=JSON.parse(require('node:zlib').gunzipSync(Buffer.from('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','base64')));
 for(const witness of witnesses){
  const {proof,rounds,route}=witness;
  const row={recipe:'MEDIA_V1',route,volume:'SINGLE_SCENE'},batch={mediaGraphHashes:{SINGLE_SCENE:proof.expectedGraphSha256}};
  assert.equal(check(proof,row,batch,rounds),true);
  for(const kind of ['native','asset','round','placement','viewport','control','loss','cycles']){
   const p=structuredClone(proof),r=structuredClone(rounds);
   if(kind==='native')delete p.nativeReadbacks['final-word-lifecycle'];
   else if(kind==='asset')p.assetSnapshots['reopened-media-assets'].assets[0].sha256='0'.repeat(64);
   else if(kind==='round')r[0].returnedSha256='0'.repeat(64);
   else if(kind==='placement')p.stages['rounds/1/word'].placementCount=2;
   else if(kind==='viewport')p.viewportProof.viewCount=2;
   else if(kind==='control')p.negativeControls[0].rejected=false;
   else if(kind==='loss')p.lossLedger.lostImages=['lost'];
   else r.length=0;
   assert.throws(()=>check(p,row,batch,r),/MANUSCRIPT_MEDIA_/,kind);
  }
  assert.throws(()=>check(proof,{...row,route:'C3'},batch,rounds),/MANUSCRIPT_MEDIA_/);
  assert.throws(()=>check(proof,{...row,recipe:'DEFAULT'},batch,rounds),/MANUSCRIPT_MEDIA_/);
 }
});
