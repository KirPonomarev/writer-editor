const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../..');
const load=name=>import(pathToFileURL(path.join(root,'scripts/ops',name)).href);
test('fixed JS corpora agree with an independently implemented Python oracle at every word',async()=>{
 const {WORD_VOLUME_IDS,buildWordVolumeFixture}=await load('rtk-interop-word-volume-fixtures.mjs');
 for(const volume of WORD_VOLUME_IDS){
  const fixture=buildWordVolumeFixture(volume);
  const child=spawnSync('python3',['-I','-B','-c',"import importlib.util,json,sys; s=importlib.util.spec_from_file_location('v',sys.argv[1]); v=importlib.util.module_from_spec(s); s.loader.exec_module(v); print(json.dumps(v.expected_scenes(sys.argv[2]),ensure_ascii=False))",'scripts/ops/rtk-interop-word-volume-readback.py',volume],{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:16*1024*1024});
  assert.equal(child.status,0,child.stderr);assert.deepEqual(fixture.scenes.map(s=>s.paragraphs),JSON.parse(child.stdout));
 }
});
test('volume independent reader executes corruption, volume, native text and filesystem adversaries',()=>{
 const child=spawnSync('python3',['-I','-B','test/unit/rtk-interop-word-volume.test.py'],{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
 assert.equal(child.status,0,child.stdout+child.stderr);assert.match(child.stderr,/Ran 11 tests/);assert.match(child.stderr,/\nOK\n/);
});
test('all sixteen exact journeys are distinct and repeats and wrong profiles provide no cells',async()=>{
 const {WORD_BATCH_CELLS,validateWordBatchRuns}=await load('rtk-interop-word-text-order-batch.mjs');
 const runs=WORD_BATCH_CELLS.filter(c=>c.startsWith('ORDER__')).map(c=>c+'__contract');
 assert.equal(validateWordBatchRuns(runs).length,16);
 for(const bad of [[...runs,runs[0]],runs.map((r,i)=>i===1?runs[0].replace('contract','second'):r),[runs[0].replace('SINGLE_SCENE','MILLION_WORDS')],[runs[0].replace('C1','C3')]])assert.throws(()=>validateWordBatchRuns(bad),/WORD_BATCH_/);
});
test('volume proof has only stdlib raw readers and fixed expected corpora',()=>{
 const s=fs.readFileSync(path.join(root,'scripts/ops/rtk-interop-word-volume-readback.py'),'utf8');
 assert.doesNotMatch(s,/import (?:subprocess|requests)|src\/io|expectedParagraphs\]/);
 assert.match(s,/checked_read\(root,b\)==files/);
});
test('main-owned 500k content and plan references fit while total cache and input ceilings stay bounded',async()=>{
 const {buildWordVolumeFixture}=await load('rtk-interop-word-volume-fixtures.mjs');
 const {buildStoredZip,escapeXml}=require('../../src/export/docx/docxMinBuilder');
 const {createDocxImportPreviewReferences}=require('../../src/utils/docxImportPreviewReferences');
 const {buildDocxContentPreviewFromZipBytes,buildDocxImportPreviewPlanFromContentPreview}=await import('../../src/io/revisionBridge/index.mjs');
 const fixture=buildWordVolumeFixture('LARGE_DOCUMENT');
 const bytes=buildStoredZip([
  {name:'[Content_Types].xml',data:'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'},
  {name:'_rels/.rels',data:'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'},
  {name:'word/document.xml',data:'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+fixture.sourceParagraphs.map(p=>'<w:p><w:r><w:t xml:space="preserve">'+escapeXml(p)+'</w:t></w:r></w:p>').join('')+'</w:body></w:document>'},
 ]);
 const content=buildDocxContentPreviewFromZipBytes(bytes);assert.equal(content.ok,true);
 assert.ok(Buffer.byteLength(JSON.stringify(content))>4*1024*1024);
 const main=fs.readFileSync(path.join(root,'src/main.js'),'utf8');
 const section=main.slice(main.indexOf('// DOCX_IMPORT_PREVIEW_REFERENCES_START'),main.indexOf('// DOCX_IMPORT_PREVIEW_REFERENCES_END'));
 const context={createDocxImportPreviewReferences,getProjectRootPath:()=>'/owned-volume-test',isPlainObjectValue:v=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v),cloneJsonSafe:v=>JSON.parse(JSON.stringify(v))};
 require('node:vm').runInNewContext(section+'\nglobalThis.port={remember:rememberDocxImportPreviewReference,resolve:resolveDocxImportPreviewReference,capture:captureDocxImportPreviewContext};',context);
 const {port}=context,ref=port.remember('content',content,port.capture());assert.match(ref,/^[a-f0-9]{64}$/);
 const previewSection=main.slice(main.indexOf('// DOCX_IMPORT_PREVIEW_COMMAND_SURFACE_START'),main.indexOf('// DOCX_IMPORT_PREVIEW_COMMAND_SURFACE_END'));
 require('node:vm').runInNewContext(previewSection+'\nglobalThis.validatePreview=validateDocxImportPreviewPayload;',context);
 assert.equal(context.validatePreview({requestId:'bounded-reference',docxContentPreviewRef:ref}).ok,true);
 assert.equal(context.validatePreview({docxContentPreviewReport:content}).error.reason,'DOCX_IMPORT_PREVIEW_PAYLOAD_TOO_LARGE');
 assert.equal(context.validatePreview({docxContentPreviewRef:'f'.repeat(64)}).ok,false);
 assert.equal(context.validatePreview({docxContentPreviewRef:ref,docxContentPreviewReport:content}).ok,false);
 const poisoned=port.remember('content',{...content,projectRoot:'/forged'},port.capture());
 assert.equal(context.validatePreview({docxContentPreviewRef:poisoned}).ok,false);
 const plan=buildDocxImportPreviewPlanFromContentPreview(port.resolve('content',ref));assert.equal(plan.ok,true);
 const planRef=port.remember('plan',plan,port.capture());assert.match(planRef,/^[a-f0-9]{64}$/);
 assert.equal(port.resolve('plan',planRef).candidateCreatePlan.entries[0].content,fixture.sourceParagraphs.join('\n'));
 assert.equal(port.remember('content',{text:'x'.repeat(8*1024*1024)},port.capture()),'');
 const filler={text:'z'.repeat(7*1024*1024)};port.remember('content',filler,port.capture());port.remember('plan',filler,port.capture());
 assert.equal(port.resolve('content',ref),null);assert.equal(port.resolve('plan',planRef),null);
});
