'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStoredZip, buildDocxMinBuffer } = require('../../src/export/docx/docxMinBuilder.js');
const { normalizeDocxHttpHref, parseDocxHyperlinkInstruction } = require('../../src/io/docxHyperlinks.cjs');
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const O = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const P = 'http://schemas.openxmlformats.org/package/2006/relationships';
const HREF = 'https://example.invalid/путь?q=1&b=%F0%9F%98%80#part';
const xml = s => s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const run = (text, marks='') => `<w:r>${marks?`<w:rPr>${marks}</w:rPr>`:''}<w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
const mods = Promise.all([import('../../src/io/revisionBridge/index.mjs'),import('../../src/renderer/documentContentEnvelope.mjs'),import('../../src/docxPageSetupBind.mjs'),import('../../src/derived/semanticMapping.mjs'),import('../../src/derived/styleMap.mjs')]);
function pack(body, relationships=`<Relationship Id="link1" Type="${O}/hyperlink" Target="${xml(HREF)}" TargetMode="External"/>`) {
 return buildStoredZip([
  {name:'[Content_Types].xml',data:'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'},
  {name:'_rels/.rels',data:`<Relationships xmlns="${P}"><Relationship Id="d" Type="${O}/officeDocument" Target="word/document.xml"/></Relationships>`},
  {name:'word/_rels/document.xml.rels',data:`<Relationships xmlns="${P}">${relationships}</Relationships>`},
  {name:'word/document.xml',data:`<w:document xmlns:w="${W}" xmlns:r="${O}"><w:body>${body}</w:body></w:document>`}
 ]);
}
async function read(bytes) {
 const [b,e] = await mods;const preview=b.buildDocxContentPreviewFromZipBytes(bytes);const plan=b.buildDocxImportPreviewPlanFromContentPreview(preview);
 assert.equal(plan.ok,true,JSON.stringify(preview));return {preview,plan,...e.parseObservablePayload(plan.candidateCreatePlan.entries[0].content)};
}
function characters(doc) {return doc.content.map(p=>(p.content||[]).flatMap(n=>[...(n.type==='hardBreak'?'\n':n.text||'')].map(c=>({c,href:n.marks?.find(m=>m.type==='link')?.attrs.href||null,other:(n.marks||[]).filter(m=>m.type!=='link').map(m=>m.type).sort()}))));}
async function write(doc) {const [,,docxPageSetupBindModule,semanticMappingModule,styleMapModule]=await mods;return buildDocxMinBuffer({doc,bookProfile:{formatId:'A4'}},{docxPageSetupBindModule,semanticMappingModule,styleMapModule});}

test('P1a URL grammar is inert, bounded and rejects confusing or unsupported targets',()=>{
 for(const s of [HREF,'HTTP://example.invalid/a','https://example.invalid/'])assert.equal(normalizeDocxHttpHref(s),s);
 for(const s of ['',null,'file:///tmp/a','javascript:alert(1)','data:x','mailto:x@y','https://u:p@example.invalid/','https://example.invalid/ a','https:\\example.invalid','https://example.invalid/\n','https://example.invalid/'+ 'a'.repeat(2048)])assert.throws(()=>normalizeDocxHttpHref(s),/DOCX_LINK_TARGET_UNSUPPORTED/);
 assert.equal(parseDocxHyperlinkInstruction(` HYPERLINK "${HREF}" \\h `),HREF);
 assert.equal(parseDocxHyperlinkInstruction('HYPERLINK "https://example.invalid/a" \\l "part" \\h'), 'https://example.invalid/a#part');
 assert.throws(()=>parseDocxHyperlinkInstruction('HYPERLINK "https://example.invalid/a" \\h \\h'), /DOCX_LINK_FIELD_UNSUPPORTED/);
 for(const s of ['DDE "x"',`HYPERLINK "${HREF}" \\l "x"`,`HYPERLINK "${HREF}" \\o "tip"`,'HYPERLINK "file:///tmp/a"'])assert.throws(()=>parseDocxHyperlinkInstruction(s),/DOCX_LINK_/);
});

test('P1a relationship links preserve split labels, marks, Unicode and unlinked neighbors',async()=>{
 const r=await read(pack(`<w:p>${run('before ')}<w:hyperlink r:id="link1">${run('Ссы','<w:b/>')}${run('лка 😀')}</w:hyperlink>${run(' after')}</w:p>`));
 const c=characters(r.doc)[0];assert.equal(r.text,'before Ссылка 😀 after');
 assert(c.slice(0,7).every(x=>x.href===null));assert(c.slice(7,15).every(x=>x.href===HREF));assert(c.slice(15).every(x=>x.href===null));assert.deepEqual(c[7].other,['bold']);
 assert(!r.plan.lossReport.items.some(x=>x.code==='DOCX_IMPORT_PREVIEW_LINK_NOT_IMPORTED'));
});

test('P1a simple and split complex HYPERLINK fields preserve result-only labels',async()=>{
 const simple=`<w:fldSimple w:instr="${xml(`HYPERLINK "${HREF}"`)}">${run('label')}</w:fldSimple>`;
 const complex='<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> HYPER</w:instrText></w:r>'+`<w:r><w:instrText>${xml(`LINK "${HREF}"`)}</w:instrText></w:r>`+'<w:r><w:fldChar w:fldCharType="separate"/></w:r>'+run('la')+run('bel')+'<w:r><w:fldChar w:fldCharType="end"/></w:r>';
 for(const form of [simple,complex]){const r=await read(pack(`<w:p>${run('x')}${form}${run('y')}</w:p>`,''));assert.equal(r.text,'xlabely');assert.deepEqual(characters(r.doc)[0].map(x=>x.href),[null,...Array(5).fill(HREF),null]);}
});

test('P1a five codec cycles retain independent character/target graph and no duplicate targets',async()=>{
 let doc=(await read(pack(`<w:p>${run('pre ')}<w:hyperlink r:id="link1">${run('😀 café','<w:i/>')}</w:hyperlink>${run(' post')}</w:p>`))).doc;
 const expected=characters(doc);
 for(let i=0;i<5;i++){const bytes=await write(doc);const [b]=await mods;const p=b.extractDocxReviewTransportPackagePartsFromZipBytes({bytes});assert.equal(p.ok,true);assert.equal((p.parts['word/_rels/document.xml.rels'].match(/TargetMode="External"/g)||[]).length,1);doc=(await read(bytes)).doc;assert.deepEqual(characters(doc),expected);}
 // Codec cycles are regression evidence, not five native alternating exchanges.
});

test('P1a missing, duplicate, spoofed and unsupported referenced relationships never become writable plain text',async()=>{
 const [b]=await mods;
 for(const rel of ['',`<Relationship Id="link1" Type="${O}/image" Target="a.png"/>`,`<Relationship Id="link1" Type="${O}/hyperlink" Target="https://example.invalid/" TargetMode="External"/>`.repeat(2),`<Relationship Id="link1" Type="${O}/hyperlink" Target="mailto:x@y" TargetMode="External"/>`]){
  const p=b.buildDocxContentPreviewFromZipBytes(pack(`<w:p><w:hyperlink r:id="link1">${run('label')}</w:hyperlink></w:p>`,rel));assert.equal(b.buildDocxImportPreviewPlanFromContentPreview(p).ok,false,JSON.stringify(p));
 }
 for(const attrs of ['w:anchor="bookmark"','xmlns:r="urn:spoof" r:id="link1"','r:id="link1" w:tooltip="meaning"']){
  const p=b.buildDocxContentPreviewFromZipBytes(pack(`<w:p><w:hyperlink ${attrs}>${run('label')}</w:hyperlink></w:p>`));assert.equal(b.buildDocxImportPreviewPlanFromContentPreview(p).ok,false,JSON.stringify(p));
 }
});

test('P1a malformed link fields and nested links reject without a partial successful label',async()=>{
 const [b]=await mods;
 for(const body of [`<w:hyperlink r:id="link1"><w:hyperlink r:id="link1">${run('x')}</w:hyperlink></w:hyperlink>`,`<w:fldSimple w:instr="HYPERLINK &quot;${xml(HREF)}&quot; \\o &quot;tip&quot;">${run('x')}</w:fldSimple>`,`<w:r><w:fldChar w:fldCharType="begin"/><w:instrText>HYPERLINK "${xml(HREF)}"</w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>${run('x')}`]){
  const p=b.buildDocxContentPreviewFromZipBytes(pack(`<w:p>${body}</w:p>`));assert.equal(b.buildDocxImportPreviewPlanFromContentPreview(p).ok,false,JSON.stringify(p));
 }
});

async function signedLinkSource(fontSize = null) {
 const [b,e]=await mods, crypto=require('node:crypto');
 const stable=v=>Array.isArray(v)?'['+v.map(stable).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}':JSON.stringify(v);
 const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
 const cryptoPort={sha256Text:sha,sha256Json:v=>'sha256:'+sha(stable(v)),byteLength:v=>Buffer.byteLength(v),hmacSha256Text:(v,s)=>'hmac-sha256:'+crypto.createHmac('sha256',s).update(v).digest('hex'),hmacSha256Json:(v,s)=>'hmac-sha256:'+crypto.createHmac('sha256',s).update(stable(v)).digest('hex')};
 const doc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'before '},{type:'text',text:'Ссылка 😀',marks:[{type:'link',attrs:{href:HREF,target:'_blank',rel:'noopener noreferrer nofollow'}},{type:'bold'}]},{type:'text',text:' after'}]}]};
 if(fontSize) doc.content[0].content[1].marks.push({type:'textStyle',attrs:{fontSize}});
 const content=e.composeObservablePayload({doc});
 const {buildFullManuscriptDocxReviewPacketSource}=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource');
 const {buildDocxReviewPacketBuffer}=require('../../src/export/docx/docxReviewPacketBuilder');
 const source=buildFullManuscriptDocxReviewPacketSource({projectId:'p1a-synthetic-review',projectRoot:'/synthetic',scenes:[{sceneId:'roman/a.txt',scenePath:'/synthetic/roman/a.txt',text:'before Ссылка 😀 after',doc,observableContent:content,order:0}]},{revisionBridge:b,cryptoPort});
 const original=buildDocxReviewPacketBuffer(source),parts=b.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:original}).parts;
 return {b,e,doc,content,source,parts,cryptoPort};
}

test('P1a signed return changes href through existing formatting operation without changing label or neighbors',async()=>{
 const {b,e,doc,content,source,parts,cryptoPort}=await signedLinkSource();
 const replacement='https://example.invalid/changed?q=2';
 const next={...parts,'word/_rels/document.xml.rels':parts['word/_rels/document.xml.rels'].replace(xml(HREF),xml(replacement))};assert.notEqual(next['word/_rels/document.xml.rels'],parts['word/_rels/document.xml.rels']);
 const bytes=buildStoredZip(Object.entries(next).map(([name,data])=>({name,data})));
 const analysis=b.buildDocxReviewTransportAnalysisFromZipBytes({bytes,hmacSecret:source.forbiddenSecret,expectedAuthority:source.localAuthorityCapsule.expectedAuthority},{cryptoPort});assert.equal(analysis.ok,true,JSON.stringify(analysis.reasons));
 const options={fullManuscriptExportMap:source.localAuthorityCapsule.exportMap,cryptoPort};
 const candidates=b.buildDocxReviewFormattingReturnCandidatesFromEvidence({returnedProjection:{formattingParagraphs:analysis.reviewIr.formattingParagraphs}},options);
 assert.equal(candidates.candidates.length,1,JSON.stringify(candidates));assert.equal(candidates.candidates[0].selectedText,'Ссылка 😀');assert.deepEqual(candidates.candidates[0].inline,{link:{action:'set',value:replacement}});
 const legacy=b.buildDocxReviewFormattingReturnCandidatesFromZipBytes(bytes,options);assert.deepEqual(legacy.candidates,candidates.candidates);
 const runtime=await import('../../src/io/revisionBridge/reviewTransportFormattingReturnRuntime.mjs');const applied=runtime.applyFormattingOperationsToObservableContent(content,candidates.candidates);assert.equal(applied.ok,true,JSON.stringify(applied));
 const expected=characters(doc).map(row=>row.map(x=>({...x,href:x.href?replacement:null})));assert.deepEqual(characters(e.parseObservablePayload(applied.content).doc),expected);
 const unsafe=structuredClone(candidates.candidates);unsafe[0].inline.link.value='javascript:alert(1)';assert.equal(runtime.applyFormattingOperationsToObservableContent(content,unsafe).ok,false);
});

test('P1a unlink and unchanged signed returns produce exact removal or no operation',async()=>{
 const {b,content,source,parts,cryptoPort}=await signedLinkSource();const opts={fullManuscriptExportMap:source.localAuthorityCapsule.exportMap,cryptoPort};
 const original=buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data})));
 const unchanged=b.buildDocxReviewFormattingReturnCandidatesFromZipBytes(original,opts);assert.equal(unchanged.candidates.length,0,JSON.stringify(unchanged));
 const next={...parts,'word/document.xml':parts['word/document.xml'].replace(/<w:hyperlink\b[^>]*>/g,'').replace(/<\/w:hyperlink>/g,'')};
 const bytes=buildStoredZip(Object.entries(next).map(([name,data])=>({name,data})));
 const c=b.buildDocxReviewFormattingReturnCandidatesFromZipBytes(bytes,opts);assert.equal(c.candidates.length,1,JSON.stringify(c));assert.deepEqual(c.candidates[0].inline,{link:{action:'remove'}});
 const runtime=await import('../../src/io/revisionBridge/reviewTransportFormattingReturnRuntime.mjs');const applied=runtime.applyFormattingOperationsToObservableContent(content,c.candidates);assert.equal(applied.ok,true);assert(characters(applied.doc)[0].every(x=>x.href===null));
});

test('P1a signed href change persists atomically, reopens in another process and rejects stale or repeated writes',async()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
 const {b,doc,content,source,parts,cryptoPort}=await signedLinkSource();
 const href='https://example.invalid/durable#target';
 const bytes=buildStoredZip(Object.entries({...parts,'word/_rels/document.xml.rels':parts['word/_rels/document.xml.rels'].replace(xml(HREF),xml(href))}).map(([name,data])=>({name,data})));
 const candidates=b.buildDocxReviewFormattingReturnCandidatesFromZipBytes(bytes,{fullManuscriptExportMap:source.localAuthorityCapsule.exportMap,cryptoPort});assert.equal(candidates.candidates.length,1);
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'yalken-p1a-link-transaction-'));const scene=path.join(root,'roman/a.txt');fs.mkdirSync(path.dirname(scene));fs.writeFileSync(scene,content);
 const runtime=await import('../../src/io/revisionBridge/reviewTransportFormattingReturnRuntime.mjs');
 const input={commandId:'cmd.rtk.review.applyMultiSceneFormattingReturn',callerRole:'main',commandAuthority:{issuer:'main',intent:'rtk.formattingApply',commandId:'cmd.rtk.review.applyMultiSceneFormattingReturn'},projectId:'p1a-synthetic-review',projectRoot:root,requestId:'p1a-durable',returnArtifactSha256:'sha256:'+cryptoPort.sha256Text(bytes),scenePathBySceneId:{'roman/a.txt':scene},previewConfirmed:true,operations:candidates.candidates};
 try {
  const applied=await runtime.applyMultiSceneFormattingReturnRuntime(input,{cryptoPort});assert.equal(applied.status,'applied',JSON.stringify(applied));assert(applied.readback.every(x=>x.matchesAfter));
  const envelope=require('node:url').pathToFileURL(path.resolve(__dirname,'../../src/renderer/documentContentEnvelope.mjs')).href;
  const child=cp.execFileSync(process.execPath,['--input-type=module','-e',`import fs from 'node:fs';import {parseObservablePayload} from ${JSON.stringify(envelope)};console.log(JSON.stringify(parseObservablePayload(fs.readFileSync(process.argv[1],'utf8')).doc));`,scene],{encoding:'utf8'});
  assert.deepEqual(characters(JSON.parse(child)),characters(doc).map(row=>row.map(x=>({...x,href:x.href?href:null}))));
  const after=fs.readFileSync(scene);const replay=await runtime.applyMultiSceneFormattingReturnRuntime(input,{cryptoPort});assert.equal(replay.status,'replay');assert.equal(replay.writerCalled,false);assert.deepEqual(fs.readFileSync(scene),after);
  const conflict=await runtime.applyMultiSceneFormattingReturnRuntime({...input,requestId:'p1a-conflict',returnArtifactSha256:'sha256:'+ 'b'.repeat(64)},{cryptoPort});assert.equal(conflict.code,'RTK_FORMATTING_OPERATION_REPLAY_CONFLICT');assert.deepEqual(fs.readFileSync(scene),after);
  const stale=await runtime.applyMultiSceneFormattingReturnRuntime({...input,requestId:'p1a-stale',operations:input.operations.map(op=>({...op,operationId:op.operationId+'-new'})),returnArtifactSha256:'sha256:'+ 'c'.repeat(64)},{cryptoPort});assert.equal(stale.ok,false);assert.equal(stale.code,'RTK_FORMATTING_SOURCE_SCENE_STALE');assert.deepEqual(fs.readFileSync(scene),after);
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});

test('P1a native hyperlink theme uses the selected theme RGB, never cached color or unrelated namespaces',async()=>{
 const [b]=await mods;const A='http://schemas.openxmlformats.org/drawingml/2006/main';
 const basic=pack(`<w:p><w:hyperlink r:id="link1">${run('label','<w:rStyle w:val="Hyperlink"/>')}</w:hyperlink></w:p>`);
 const parts=b.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:basic}).parts;
 parts['word/_rels/document.xml.rels']=parts['word/_rels/document.xml.rels'].replace('</Relationships>',`<Relationship Id="theme" Type="${O}/theme" Target="theme/theme1.xml"/><Relationship Id="settings" Type="${O}/settings" Target="settings.xml"/></Relationships>`);
 parts['word/styles.xml']=`<w:styles xmlns:w="${W}"><w:style w:type="character" w:styleId="Hyperlink"><w:rPr><w:color w:val="FF0000" w:themeColor="hyperlink"/><w:u w:val="single"/></w:rPr></w:style></w:styles>`;
 parts['word/theme/theme1.xml']=`<a:theme xmlns:a="${A}"><a:themeElements><a:clrScheme name="Proof"><a:hlink><a:srgbClr val="123456"/></a:hlink><a:accent1><a:srgbClr val="654321"/></a:accent1></a:clrScheme><a:fontScheme name="Proof"><a:majorFont><a:latin typeface="Aptos"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>`;
 parts['word/settings.xml']=`<w:settings xmlns:w="${W}"><w:clrSchemeMapping w:hyperlink="hyperlink"/></w:settings>`;
 const zip=p=>buildStoredZip(Object.entries(p).map(([name,data])=>({name,data})));
 const resolved=await read(zip(parts));const marks=resolved.doc.content[0].content[0].marks;assert.equal(marks.find(m=>m.type==='textStyle').attrs.color,'#123456');assert(marks.some(m=>m.type==='underline'));assert.equal(marks.find(m=>m.type==='link').attrs.href,HREF);
 const mapped=await read(zip({...parts,'word/settings.xml':parts['word/settings.xml'].replace('w:hyperlink="hyperlink"','w:hyperlink="accent1"')}));assert.equal(mapped.doc.content[0].content[0].marks.find(m=>m.type==='textStyle').attrs.color,'#654321');
 for(const theme of [parts['word/theme/theme1.xml'].replace('<a:srgbClr val="123456"/>','<a:srgbClr val="123456"><a:tint val="10000"/></a:srgbClr>'),parts['word/theme/theme1.xml'].replace('<a:srgbClr val="123456"/>','<a:sysClr val="windowText" lastClr="123456"/>')]){
  const preview=b.buildDocxContentPreviewFromZipBytes(zip({...parts,'word/theme/theme1.xml':theme}));
  const plan=b.buildDocxImportPreviewPlanFromContentPreview(preview);
  // Unsupported theme effects must remain an explicit loss, never use FF0000.
  assert.equal(plan.ok,true);assert(plan.lossReport.items.some(x=>x.code==='DOCX_IMPORT_PREVIEW_COLOR_NOT_IMPORTED'));
  assert.equal(plan.candidateCreatePlan.entries[0].content.includes('#ff0000'),false);
 }
});

test('P1a real editor RGB serialization remains exactly equivalent in signed export', async()=>{
 const {buildFormatIrParagraphs}=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource');
 const scene=color=>({sceneId:'roman/link.txt',text:'правка 😀',doc:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'правка 😀',marks:[{type:'textStyle',attrs:{color,fontFamily:'Aptos',fontSize:'12pt'}},{type:'underline'},{type:'link',attrs:{href:HREF,title:null,class:null}}]}]}]}});
 assert.deepEqual(buildFormatIrParagraphs(scene('rgb(70, 120, 134)')),buildFormatIrParagraphs(scene('#467886')));
 assert.equal(buildFormatIrParagraphs(scene('rgb(70, 120, 134)'))[0].formatIr.runs[0].inline.color,'#467886');
 for(const bad of ['rgba(70,120,134,0.5)','rgb(256,0,0)','var(--color)','red']) assert.throws(()=>buildFormatIrParagraphs(scene(bad)),/FULL_MANUSCRIPT_FORMAT_IR_COLOR_UNSUPPORTED/);
});

test('P1a scene return matches rich paragraph projection without treating envelope JSON as text',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
 const main=fs.readFileSync(path.resolve(__dirname,'../../src/main.js'),'utf8');
 const [,envelope]=await mods;
 const {buildFormatIrParagraphs}=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource');
 const ctx=vm.createContext({loadDocumentContentEnvelopeModule:async()=>envelope,buildFormatIrParagraphs});
 vm.runInContext(main.slice(main.indexOf('function docxReviewReturnIntakeSceneParagraphTexts('),main.indexOf('function docxReviewReturnIntakeSceneRevisionOrdinal(')),ctx);
 const paragraphs=['P1A_NATIVE правка 😀','','last'];
 const doc={type:'doc',content:paragraphs.map(text=>({type:'paragraph',content:text?[{type:'text',text,marks:[{type:'link',attrs:{href:HREF}}]}]:[]}))};
 const raw=envelope.composeObservablePayload({doc,meta:{synopsis:'not document text'}});
 assert.deepEqual(Array.from(await ctx.readDocxReviewReturnIntakeSceneParagraphTexts(raw,'scene')),paragraphs);
 assert.deepEqual(Array.from(await ctx.readDocxReviewReturnIntakeSceneParagraphTexts('plain\n\nlast','scene')),['plain','','last']);
 await assert.rejects(ctx.readDocxReviewReturnIntakeSceneParagraphTexts('[doc-v2 length=10]\n{}','scene'),/DOCUMENT_ENVELOPE_INVALID/);
});

test('P1a formatting-only signed return opens explicit review, while an unbound packet cannot',async()=>{
 const {b,source,parts,cryptoPort}=await signedLinkSource();
 const changed={...parts,'word/_rels/document.xml.rels':parts['word/_rels/document.xml.rels'].replace(xml(HREF),'https://example.invalid/new')};
 const bytes=buildStoredZip(Object.entries(changed).map(([name,data])=>({name,data})));
 const analysis=b.buildDocxReviewTransportAnalysisFromZipBytes({bytes,hmacSecret:source.forbiddenSecret,expectedAuthority:source.localAuthorityCapsule.expectedAuthority},{cryptoPort});
 assert.equal(analysis.ok,true);
 const packet={returnedProjection:analysis.reviewIr};
 const bound=b.buildDocxReviewPreviewSessionCandidateFromEvidence(packet,{formattingExportMap:source.localAuthorityCapsule.exportMap,cryptoPort});
 assert.equal(bound.status,'diagnostics');
 assert(bound.reviewPacket.diagnosticItems.some(x=>x.diagnosticId==='docx-review-diagnostic-DOCX_REVIEW_PREVIEW_SESSION_FORMATTING_CHANGES'));
 assert.equal(bound.canAutoApply,false); assert.equal(bound.canWriteStorage,false);
 const unbound=b.buildDocxReviewPreviewSessionCandidateFromEvidence(packet,{});
 assert.equal(unbound.reviewPacket,null);
});

test('P1a local scene scope is recovered from verified local export map, never from foreign payload',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
 const main=fs.readFileSync(path.resolve(__dirname,'../../src/main.js'),'utf8');
 const ctx=vm.createContext({isPlainObjectValue:v=>!!v&&typeof v==='object'&&!Array.isArray(v),docxReviewPreviewSessionDetailString:v=>typeof v==='string'?v:'',cloneJsonSafe:v=>JSON.parse(JSON.stringify(v)),buildDocxReviewReturnIntakeSceneExportMapAuthority:async()=>({ok:true,applicable:true}),docxReviewReturnIntakeBlocked:reason=>({ok:false,reason})});
 vm.runInContext(main.slice(main.indexOf('async function buildDocxReviewReturnIntakeLocalAuthorityCapsule('),main.indexOf('function runDocxReviewReturnIntakeParserV2Inline(')),ctx);
 const local={exportMap:{scope:'scene',scenes:[{sceneId:'s1'}]}};
 const result=await ctx.buildDocxReviewReturnIntakeLocalAuthorityCapsule(local,{authorityCarrier:{selectedCarrier:{payload:{scope:'full-manuscript'}}}},{});
 assert.equal(result.scope,'scene');assert.equal(result.authenticatedSceneExportMap.scenes[0].sceneId,'s1');assert.equal(result.authenticatedFullManuscriptExportMap,null);assert.equal(result.returnedArtifactExportMapAccepted,false);
});

test('P1a native Word body bookmark and inherited default size retain exact link authority',async()=>{
 const {b,source,parts,cryptoPort}=await signedLinkSource('12pt');
 const href='https://example.invalid/native-default';
 const bm=parts['word/document.xml'].match(/<w:bookmarkStart\b[^>]*\/>/)[0];
 const doc=parts['word/document.xml'].replace(bm,'').replace('<w:body>','<w:body>'+bm)
   .replace(/ w14:(?:paraId|textId)="[^"]*"/g,'').replace(/<w:sz(?:Cs)?\b[^>]*\/>/g,'');
 const styles=size=>`<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;
 const bytes=(size,document=doc)=>buildStoredZip(Object.entries({...parts,'word/document.xml':document,'word/styles.xml':styles(size),'word/_rels/document.xml.rels':parts['word/_rels/document.xml.rels'].replace(xml(HREF),href)}).map(([name,data])=>({name,data})));
 const options={fullManuscriptExportMap:source.localAuthorityCapsule.exportMap,cryptoPort};
 const exact=b.buildDocxReviewFormattingReturnCandidatesFromZipBytes(bytes('24'),options);
 assert.equal(exact.candidates.length,1,JSON.stringify(exact));assert.deepEqual(exact.candidates[0].inline,{link:{action:'set',value:href}});
 const analysis=b.buildDocxReviewTransportAnalysisFromZipBytes({bytes:bytes('24'),hmacSecret:source.forbiddenSecret,expectedAuthority:source.localAuthorityCapsule.expectedAuthority},{cryptoPort});
 assert.equal(analysis.ok,true,JSON.stringify(analysis.reasons));
 const packet={returnedProjection:analysis.reviewIr};
 const projected=b.buildDocxReviewFormattingReturnCandidatesFromEvidence(packet,options);
 assert.deepEqual(projected.candidates,exact.candidates);
 const preview=b.buildDocxReviewPreviewSessionCandidateFromEvidence(packet,{formattingExportMap:options.fullManuscriptExportMap,cryptoPort});
 assert(preview.reviewPacket?.diagnosticItems.some(d=>d.diagnosticId.endsWith('FORMATTING_CHANGES')));
 const changed=b.buildDocxReviewFormattingReturnCandidatesFromZipBytes(bytes('28'),options);
 assert.equal(changed.candidates[0].inline.fontSize.value,'14pt');
 const invalidAnalysis=b.buildDocxReviewTransportAnalysisFromZipBytes({bytes:bytes('bad'),hmacSecret:source.forbiddenSecret,expectedAuthority:source.localAuthorityCapsule.expectedAuthority},{cryptoPort});
 const invalidPreview=b.buildDocxReviewPreviewSessionCandidateFromEvidence({returnedProjection:invalidAnalysis.reviewIr},{formattingExportMap:options.fullManuscriptExportMap,cryptoPort});
 assert(invalidPreview.reviewPacket.diagnosticItems.some(d=>d.message==='RTK_FORMATTING_RETURN_EFFECTIVE_RUN_STYLE_UNRESOLVED'));
 const invalid=b.buildDocxReviewFormattingReturnCandidatesFromZipBytes(bytes('bad'),options);
 assert.equal(invalid.candidates.length,0);assert(invalid.diagnostics.some(d=>d.code==='RTK_FORMATTING_RETURN_EFFECTIVE_RUN_STYLE_UNRESOLVED'));
 const duplicate=b.buildDocxReviewFormattingReturnCandidatesFromZipBytes(bytes('24',doc.replace(bm,bm+bm)),options);
 assert.equal(duplicate.candidates.length,0);
 const wrongNs=b.buildDocxReviewFormattingReturnCandidatesFromZipBytes(bytes('24',doc.replace(bm,bm.replace('<w:bookmarkStart','<x:bookmarkStart xmlns:x="urn:spoof"'))),options);
 assert.equal(wrongNs.candidates.length,0);
 const noEnd=b.buildDocxReviewFormattingReturnCandidatesFromZipBytes(bytes('24',doc.replace(/<w:bookmarkEnd\b[^>]*\/>/g,'')),options);
 assert.equal(noEnd.candidates.length,0);
});

test('P1a native Hyperlink character style resolves theme color, rejects ambiguous inheritance and never trusts cached RGB',async()=>{
 const {b,source,parts,cryptoPort}=await signedLinkSource('12pt');
 const a='http://schemas.openxmlformats.org/drawingml/2006/main';
 const style=`<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="character" w:default="1" w:styleId="base"><w:name w:val="Default Paragraph Font"/></w:style><w:style w:type="character" w:styleId="native"><w:name w:val="Hyperlink"/><w:basedOn w:val="base"/><w:rPr><w:color w:val="FF0000" w:themeColor="hyperlink"/><w:u w:val="single"/></w:rPr></w:style></w:styles>`;
 const theme=`<a:theme xmlns:a="${a}"><a:themeElements><a:clrScheme name="test"><a:hlink><a:srgbClr val="467886"/></a:hlink><a:accent1><a:srgbClr val="112233"/></a:accent1></a:clrScheme></a:themeElements></a:theme>`;
 const href='https://example.invalid/created';
 const document=parts['word/document.xml'].replace(/(<w:hyperlink\b[^>]*><w:r><w:rPr>)/,'$1<w:rStyle w:val="native"/>').replace(/<w:sz(?:Cs)?\b[^>]*\/>/g,'');
 const changed={...parts,'word/document.xml':document,'word/styles.xml':style,'word/theme/theme1.xml':theme,'word/_rels/document.xml.rels':parts['word/_rels/document.xml.rels'].replace(xml(HREF),href)};
 const analyze=(overrides,mayBlock=false)=>{const bytes=buildStoredZip(Object.entries({...changed,...overrides}).map(([name,data])=>({name,data})));const analysis=b.buildDocxReviewTransportAnalysisFromZipBytes({bytes,hmacSecret:source.forbiddenSecret,expectedAuthority:source.localAuthorityCapsule.expectedAuthority},{cryptoPort});if(mayBlock && !analysis.ok)return {candidates:[],diagnostics:analysis.reasons};assert.equal(analysis.ok,true,JSON.stringify(analysis.reasons));return b.buildDocxReviewFormattingReturnCandidatesFromEvidence({returnedProjection:analysis.reviewIr},{fullManuscriptExportMap:source.localAuthorityCapsule.exportMap,cryptoPort});};
 const exact=analyze({});assert.equal(exact.candidates.length,1,JSON.stringify(exact));assert.deepEqual(exact.candidates[0].inline,{underline:{action:'set',value:true},color:{action:'set',value:'#467886'},link:{action:'set',value:href}});
 const mapped=analyze({'word/settings.xml':`<w:settings xmlns:w="${W}"><w:clrSchemeMapping w:hyperlink="accent1"/></w:settings>`});assert.equal(mapped.candidates[0].inline.color.value,'#112233');
 for(const overrides of [
  {'word/theme/theme1.xml':''},
  {'word/theme/theme1.xml':theme.replace('<a:srgbClr val="467886"/>','<a:srgbClr val="467886"><a:tint val="50000"/></a:srgbClr>')},
  {'word/styles.xml':style.replace('<w:basedOn w:val="base"/>','<w:basedOn w:val="native"/>')},
  {'word/styles.xml':style.replace('<w:basedOn w:val="base"/>','<w:basedOn w:val="missing"/>')},
  {'word/styles.xml':style.replace('<w:u w:val="single"/>','<w:u w:val="single"/><w:b/>')},
  {'word/styles.xml':style.replace('</w:styles>',style.match(/<w:style w:type="character" w:styleId="native">.*?<\/w:style>/)[0]+'</w:styles>')},
 ]) {const result=analyze(overrides,true);assert.equal(result.candidates.length,0,JSON.stringify(result));assert(result.diagnostics.length>0);}
});
