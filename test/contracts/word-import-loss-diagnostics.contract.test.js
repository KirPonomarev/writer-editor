'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { buildDocxMinBuffer, buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
const { createImageAttrs } = require('../../src/io/documentMedia.js');
const modules = Promise.all([import('../../src/io/revisionBridge/index.mjs'), import('../../src/docxPageSetupBind.mjs'), import('../../src/derived/semanticMapping.mjs'), import('../../src/derived/styleMap.mjs')]);
const p = text => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const table = { type: 'table', content: [{ type: 'tableRow', content: ['A', 'B'].map(text => ({ type: 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [p(text)] })) }] };
function python(code, input) { const r = spawnSync('python3', ['-I', '-B', '-c', code], { input, maxBuffer: 16 * 1024 * 1024 }); assert.equal(r.status, 0, r.stderr.toString()); return r.stdout; }
const png = () => python("import zlib,struct,sys\nc=lambda t,d:struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d))\nsys.stdout.buffer.write(b'\\x89PNG\\r\\n\\x1a\\n'+c(b'IHDR',struct.pack('>IIBBBBB',2,1,8,6,0,0,0))+c(b'IDAT',zlib.compress(bytes([0,255,0,0,255,0,0,255,255])))+c(b'IEND',b''))");
async function exported(content) { const [,docxPageSetupBindModule,semanticMappingModule,styleMapModule] = await modules; return buildDocxMinBuffer({ doc: { type:'doc',content }, bookProfile:{formatId:'A4'} }, {docxPageSetupBindModule,semanticMappingModule,styleMapModule}); }
function mutate(bytes, change) {
  const parts = JSON.parse(python("import sys,io,zipfile,json,base64\nz=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))\nprint(json.dumps({n:base64.b64encode(z.read(n)).decode() for n in z.namelist()}))", bytes));
  const out = Object.fromEntries(Object.entries(parts).map(([n,b])=>[n,Buffer.from(b,'base64')])); change(out);
  return buildStoredZip(Object.entries(out).map(([name,data])=>({name,data})));
}
const xmlChange = change => parts => { parts['word/document.xml']=Buffer.from(change(parts['word/document.xml'].toString())); };
const changes = {
  widths: x => x.replaceAll('<w:tcPr>', '<w:tcPr><w:tcW w:type="pct" w:w="5000"/>'),
  shading: x => x.replace('<w:tcPr>','<w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="FF0000" w:themeFill="accent1"/>'),
  borders: x => x.replaceAll('w:val="single" w:sz="4"','w:val="dotted" w:sz="24"'),
};
async function preview(bytes) { const [bridge]=await modules; const report=bridge.buildDocxContentPreviewFromZipBytes(bytes); return {report,plan:report.ok?bridge.buildDocxImportPreviewPlanFromContentPreview(report):null}; }
const mediaBytes = async () => exported([{type:'paragraph',content:[{type:'image',attrs:createImageAttrs(png(),{alt:'synthetic red blue'})}]}]);
test('W2/W3: resized valid PNG imports with explicit placement instead of malformed XML', async()=>{
  const {report}=await preview(mutate(await mediaBytes(),xmlChange(x=>x.replaceAll('cx="19050"','cx="38100"'))));
  assert.equal(report.ok,true,JSON.stringify(report));assert.equal(report.contentPreview.paragraphs[0].media[0].attrs.displayWidthEmu,38100);
});
test('W2: actual malformed XML, corrupted PNG and external relationship remain blocked and distinct',async()=>{
  const bytes=await mediaBytes();
  const malformed=await preview(mutate(bytes,xmlChange(x=>x.replace('</w:document>','</w:broken>'))));assert.equal(malformed.report.ok,false);assert.match(JSON.stringify(malformed.report),/XML|MALFORMED/u);
  const corrupt=await preview(mutate(bytes,parts=>{const n=Object.keys(parts).find(n=>n.startsWith('word/media/'));parts[n][45]^=1;}));
  assert.equal(corrupt.report.ok,false);assert.equal(corrupt.report.code,'DOCX_CONTENT_PREVIEW_MEDIA_INVALID');assert.equal(corrupt.report.reason,'DOCUMENT_MEDIA_PNG_CHUNK_CRC');
  const external=await preview(mutate(bytes,parts=>{const n='word/_rels/document.xml.rels';parts[n]=Buffer.from(parts[n].toString().replace(/Target="media\/[^"]+"/u,'Target="https://example.invalid/image.png" TargetMode="External"'));}));
  assert.equal(external.report.ok,false);assert.equal(external.plan,null);
});
for(const feature of Object.keys(changes))test(`W2: concrete ${feature} loss includes bounded location, source property and transformation`,async()=>{
  const {report,plan}=await preview(mutate(await exported([table]),xmlChange(changes[feature])));assert.equal(report.ok,true);assert.equal(plan.ok,true);
  const items=plan.lossReport.items.filter(x=>x.feature===`table.${feature}`);assert.ok(items.length>0,JSON.stringify(plan.lossReport));
  for(const item of items){assert.equal(item.severity,'warning');assert.equal(item.location.tableIndex,0);assert.ok(item.sourceProperty);assert.ok(item.transformation);assert.match(item.message,/Table 1/u);}
});
test('W2: preserved default table has no invented property loss',async()=>{
  const {plan}=await preview(await exported([table]));assert.equal(plan.ok,true);assert.equal(plan.lossReport.items.some(x=>x.feature?.startsWith('table.')),false);
});
test('W2: combined loss survives main projection, durable receipt and replay',async t=>{
  const bytes=mutate(await exported([table]),xmlChange(x=>changes.borders(changes.shading(changes.widths(x)))));
  const direct=await preview(bytes);const [bridge]=await modules;
  const {createDocxImportLocalFilePreview}=require('../../src/utils/docxImportLocalFilePreview.js');
  const local=await createDocxImportLocalFilePreview({}, {pickLocalFile:async()=>({fileName:'synthetic.docx',size:bytes.length}),readLocalFileBytes:async()=>bytes});
  assert.equal(local.ok,true,JSON.stringify(local));
  const report=local.docxContentPreviewReport,plan=local.docxImportPreviewPlan;
  assert.deepEqual(plan.lossReport,direct.plan.lossReport); // Covers both local-file sanitizers before main admission.
  const main=fs.readFileSync(path.join(__dirname,'../../src/main.js'),'utf8');const start=main.indexOf('function copyDocxImportPreviewAllowedFields('),end=main.indexOf('function validateDocxImportPreviewPayload(',start);
  const projected=vm.runInNewContext(main.slice(start,end)+'\ncanonicalizeDocxImportPreviewSourceReport(report);',{report,isPlainObjectValue:v=>v&&typeof v==='object'&&!Array.isArray(v),cloneJsonSafe:v=>JSON.parse(JSON.stringify(v))});
  const projectedPlan=bridge.buildDocxImportPreviewPlanFromContentPreview(JSON.parse(JSON.stringify(projected)));
  assert.deepEqual(projectedPlan.lossReport,plan.lossReport);assert.equal(new Set(plan.lossReport.items.map(x=>x.feature).filter(Boolean)).size,3);
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'word-loss-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const {applyDocxImportSafeCreate,rememberDocxImportPreviewPlanAdmission}=require('../fixtures/docx-import-real-authority.cjs');rememberDocxImportPreviewPlanAdmission(plan);
  const options={projectRoot:root,romanRoot:path.join(root,'roman'),projectId:'word-loss-test'};
  const first=await applyDocxImportSafeCreate({docxImportPreviewPlan:plan},options);assert.equal(first.ok,true,JSON.stringify(first));
  const again=await applyDocxImportSafeCreate({docxImportPreviewPlan:plan},options);assert.equal(again.ok,true);assert.equal(again.value.idempotent,true);
  assert.deepEqual(first.value.receipt.lossReport,plan.lossReport);assert.deepEqual(again.value.receipt.lossReport,plan.lossReport);
});
test('W2: existing confirmation displays actual loss messages and receipt fallback preserves items',()=>{
  const editor=fs.readFileSync(path.join(__dirname,'../../src/renderer/editor.js'),'utf8');const start=editor.indexOf('function summarizeDocxImportLoss('),end=editor.indexOf('function closeDocxImportPreviewModal(',start);
  const lossReport={mode:'inline-marks',itemCount:1,items:[{severity:'warning',message:'Table 1 column 1 width changes from 720 to 1440 twips.'}]};
  const text=vm.runInNewContext(editor.slice(start,end)+'\nsummarizeDocxImportLoss({lossReport});',{lossReport});assert.match(text,/720 to 1440/u);
  const commands=fs.readFileSync(path.join(__dirname,'../../src/renderer/commands/projectCommands.mjs'),'utf8');const a=commands.indexOf('function getDocxImportLossReport('),b=commands.indexOf('function isReadyDocxImportPreviewPlan(',a);
  const result=vm.runInNewContext(commands.slice(a,b)+'\ngetDocxImportLossReport(null,{lossReport,lossReportSummary:{itemCount:1}});',{lossReport,getObjectOrNull:v=>v&&typeof v==='object'&&!Array.isArray(v)?v:null});assert.equal(result,lossReport);
});

test('W2: PNG pixel budget is a resource failure, never malformed XML or warning-success', async()=>{
  const bytes=mutate(await mediaBytes(),parts=>{
    const name=Object.keys(parts).find(n=>n.startsWith('word/media/'));
    parts[name]=python("import sys,struct,zlib\nb=bytearray(sys.stdin.buffer.read());b[16:20]=struct.pack('>I',8193);b[29:33]=struct.pack('>I',zlib.crc32(b[12:29]));sys.stdout.buffer.write(b)",parts[name]);
  });
  const {report,plan}=await preview(bytes);
  assert.equal(report.ok,false);assert.equal(report.code,'DOCX_CONTENT_PREVIEW_RESOURCE_LIMIT_EXCEEDED');assert.equal(report.reason,'DOCUMENT_MEDIA_PNG_PIXEL_LIMIT');assert.equal(plan,null);
});
test('W2: floating drawing is specifically unsupported and original file remains untouched',async()=>{
  const bytes=mutate(await mediaBytes(),xmlChange(x=>x.replaceAll('wp:inline','wp:anchor'))),before=Buffer.from(bytes);
  const {report,plan}=await preview(bytes);assert.equal(report.code,'DOCX_CONTENT_PREVIEW_UNSUPPORTED_FEATURE');assert.equal(report.reason,'DOCUMENT_MEDIA_FLOATING_IMAGE_UNSUPPORTED');assert.equal(plan,null);assert.deepEqual(bytes,before);
});
test('W2: excessive table diagnostics block rather than hide arbitrary losses',async()=>{
  const row={type:'tableRow',content:Array.from({length:128},()=>({type:'tableCell',attrs:{colspan:1,rowspan:1,colwidth:null},content:[p('x')]}))};
  const many={type:'table',content:[row]};
  const {report,plan}=await preview(mutate(await exported([many,many]),xmlChange(changes.widths)));
  assert.equal(report.code,'DOCX_CONTENT_PREVIEW_RESOURCE_LIMIT_EXCEEDED');assert.equal(report.reason,'DOCX_TABLE_DIAGNOSTIC_LIMIT');assert.equal(plan,null);
});
test('W2: unknown internal exception text cannot escape the typed boundary',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../../src/io/revisionBridge/index.mjs'),'utf8');
  const a=source.indexOf('const DOCX_CONTENT_PREVIEW_FAILURE_REASONS ='),b=source.indexOf('// Allowlisted bounded diagnostic data',a);
  const classify=vm.runInNewContext(source.slice(a,b)+'\ndocxContentPreviewSemanticFailure;',{
    DOCX_CONTENT_PREVIEW_SOURCE_PART:'word/document.xml',docxContentPreviewDiagnostic:(code,options)=>({code,...options}),
  });
  const failure=classify(new Error('/private/owner-project secret-token unexpected'));assert.equal(failure.code,'DOCX_CONTENT_PREVIEW_INTERNAL_ERROR');assert.doesNotMatch(JSON.stringify(failure),/private|secret-token|owner-project/u);
  assert.equal(classify(new Error('DOCUMENT_MEDIA_NATIVE_VALIDATOR_UNAVAILABLE')).code,'DOCX_CONTENT_PREVIEW_INTERNAL_ERROR');
  assert.equal(classify(new Error('DOCUMENT_MEDIA_RELATIONSHIP_TARGET')).code,'DOCX_CONTENT_PREVIEW_SECURITY_REJECTED');
  assert.equal(classify(new Error('DOCUMENT_MEDIA_MADE_UP_UNSUPPORTED')).code,'DOCX_CONTENT_PREVIEW_INTERNAL_ERROR');
});
test('W2: namespaced property data is bounded; unsafe or unknown diagnostic metadata is not copied',async()=>{
  const {report}=await preview(mutate(await exported([table]),xmlChange(x=>x.replace('w:w="1440"',`w:w="${'7'.repeat(129)}"`))));
  assert.equal(report.ok,false);assert.equal(report.reason,'DOCX_TABLE_PROPERTY_INVALID');
  const source=fs.readFileSync(path.join(__dirname,'../../src/io/revisionBridge/index.mjs'),'utf8'),a=source.indexOf('function docxTableLossDetails('),b=source.indexOf('function docxContentPreviewBudgetsCopy(',a);
  const details=vm.runInNewContext(source.slice(a,b)+'\ndocxTableLossDetails;',{isPlainObject:v=>v&&typeof v==='object'&&!Array.isArray(v)});
  const valid={feature:'table.widths',location:{tableIndex:0},sourceProperty:'width=720',transformation:'width=1440'};
  assert.equal(details(valid).feature,'table.widths');
  for(const invalid of [{...valid,location:{tableIndex:-1}},{...valid,location:{tableIndex:0,path:'evil'}},{...valid,sourceProperty:'x'.repeat(2049)},{...valid,transformation:'a\nforged'},{...valid,feature:'command.execute'}])assert.deepEqual(Object.keys(details(invalid)),[]);
});
test('W2: readonly warning surface and truncated report remain explicit plain text',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../../src/renderer/index.html'),'utf8');assert.match(html,/<textarea[^>]+data-docx-import-preview-loss[^>]+readonly[^>]+aria-label="DOCX import loss details"/u);
  const editor=fs.readFileSync(path.join(__dirname,'../../src/renderer/editor.js'),'utf8'),a=editor.indexOf('function summarizeDocxImportLoss('),b=editor.indexOf('function closeDocxImportPreviewModal(',a);
  const summarize=vm.runInNewContext(editor.slice(a,b)+'\nsummarizeDocxImportLoss;');
  const text=summarize({lossReport:{itemCount:2,items:[{severity:'warning',message:'<script>unsafe()</script>'}]}});assert.match(text,/Additional loss details/u);assert.match(text,/<script>/u);
  assert.match(editor,/docxImportPreviewLoss\.value = summarizeDocxImportLoss\(value\)/u);assert.doesNotMatch(editor,/docxImportPreviewLoss\.innerHTML/u);
});

test('W2: blocked confirmation explains the category without exposing an exception',()=>{
  const editor=fs.readFileSync(path.join(__dirname,'../../src/renderer/editor.js'),'utf8'),a=editor.indexOf('function summarizeDocxImportPreview('),b=editor.indexOf('function summarizeDocxImportLoss(',a);
  const summarize=vm.runInNewContext(editor.slice(a,b)+'\nsummarizeDocxImportPreview;',{getDocxImportPreviewPlanFromValue:v=>v.docxImportPreviewPlan});
  for(const [code,expected] of [['UNSUPPORTED_FEATURE',/cannot preserve/u],['XML_MALFORMED',/XML is malformed/u],['RESOURCE_LIMIT_EXCEEDED',/safety limit/u],['INTERNAL_ERROR',/internal failure/u]]){
    const message=summarize({docxImportPreviewPlan:{ok:false},docxContentPreviewReport:{code:`DOCX_CONTENT_PREVIEW_${code}`,reason:'/private/secret'}});
    assert.match(message,expected);assert.match(message,/Nothing was imported/u);assert.doesNotMatch(message,/private|secret/u);
  }
});
test('W2: table property losses follow namespace resolution, not the literal prefix',async()=>{
  const bytes=mutate(await exported([table]),xmlChange(x=>changes.shading(x).replaceAll('w:','word:').replace('xmlns:w=','xmlns:word=')));
  const {report,plan}=await preview(bytes);assert.equal(report.ok,true,JSON.stringify(report));assert.equal(plan.lossReport.items.filter(x=>x.feature==='table.shading').length,1);
});

test('W2: an unexpected native validator failure is not relabelled as damaged input',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../../src/io/documentMedia.js'),'utf8');
  const unexpected=new Error('/private/host/runtime-internal');
  const module={exports:{}};
  vm.runInNewContext(source,{Buffer,module,process:{getBuiltinModule:name=>name==='node:zlib'?{inflateSync(){throw unexpected;}}:require(name)}});
  assert.throws(()=>module.exports.inspectPng(png()),error=>error===unexpected);
});
