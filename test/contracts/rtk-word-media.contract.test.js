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
  const { applyDocxImportSafeCreate, rememberDocxImportPreviewPlanAdmission } = require('../../src/utils/docxImportSafeCreate.js');
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
