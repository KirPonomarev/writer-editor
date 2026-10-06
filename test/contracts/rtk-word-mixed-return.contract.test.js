'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const review=require('../../src/core/word-pending-text-revisions-v1.cjs');
const envelope=require('../../src/core/document-content-envelope-v1.cjs');
const {exactAnchor}=require('../../src/core/word-comment-authoring-v1.cjs');
const {planMixedPendingReturn}=require('../../src/core/word-pending-comment-return-v1.cjs');
const {buildFullManuscriptDocxReviewPacketSource:makeSource}=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const {buildDocxReviewPacketBuffer:build}=require('../../src/export/docx/docxReviewPacketBuilder.js');
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const stable=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const encode=doc=>envelope.composeObservablePayload({doc});
const projectId='mixed-test',sceneId='roman/a.txt';
async function notesBookFixture(options) {
 const file=require('node:path').join(__dirname,'rtk-word-pending-notes.contract.test.js'),module={exports:{}};
 const code=require('node:fs').readFileSync(file,'utf8').split("\ntest('complete book note law")[0]+'\nmodule.exports={composedBookFixture};';
 new Function('require','module','__dirname',code)(require('node:module').createRequire(file),module,__dirname);
 return module.exports.composedBookFixture(null,options);
}
test('book schema4 independently derives new source points and the complete foreign reply graph without caller after state',async()=>{
 const f=await notesBookFixture(),model=require('../../src/core/word-pending-comment-return-v1.cjs');
 const input={beforeText:f.beforeText,projectId:f.document.projectId,scenes:f.scenes,notesText:f.notesText,returnProofJson:JSON.stringify(f.proof)},result=model.planMixedBookReturn(input);
 assert.equal(result.scenes[1].content,f.scenes[1].beforeContent,'control owner stays byte exact');
 for(const [index,original] of [[0,'AxxB tail'],[2,'old tail']]) {
  const doc=envelope.parseObservablePayload(result.scenes[index].content).doc;
  assert.equal(review.projection(doc).current,f.current[index]);assert.equal(review.projection(doc).original,original);
  assert.deepEqual(review.readLedger(doc).noteSourcePoints.map(p=>p.offsetUtf16),index===0?[2,4]:[9]);
  assert.deepEqual(review.readLedger(review.decide(doc,{action:'undo'}).doc).source,review.readLedger(f.beforeDocs[index])?.source||f.beforeDocs[index]);
  assert.deepEqual(review.decide(review.decide(doc,{action:'undo'}).doc,{action:'redo'}).doc,doc);
 }
 const graph=JSON.parse(result.afterText);assert.equal(graph.threads.find(t=>t.threadId==='thread-1').messages.at(-1).body,'Foreign Beta reply retained');
 assert.equal(graph.threads.find(t=>t.threadId==='thread-2').messages.at(-1).body,'Gamma reply retained');
 const comment=require('../../src/core/word-comment-return-delta-v1.cjs'),mixed=f.scenes.map((scene,i)=>({sceneId:scene.sceneId,document:f.beforeDocs[i],returnedDocument:review.bindLedger(f.proof.returnedScenes[i].ledger)}));
 assert.equal(comment.planCommentReturnDelta({...f.proof,beforeText:f.beforeText,notesText:f.notesText,mixedPendingScenes:mixed}).afterText,result.afterText);
 for(const alter of [p=>p.schemaVersion=3,p=>delete p.noteContext.returnedReferences,p=>p.noteContext.callerAfter=f.afterNotes,
  p=>p.noteContext.unionReferences[0].offsetUtf16++,p=>p.noteContext.returnedNotes[0].body.content[0].attrs.wordParagraphSpacing.after++,
  p=>p.returnedScenes[0].ledger.noteSourcePoints=[{noteId:'note-left',paragraphIndex:0,offsetUtf16:3}]]) {
  const proof=structuredClone(f.proof);alter(proof);assert.throws(()=>model.planMixedBookReturn({...input,returnProofJson:JSON.stringify(proof)}),/PENDING_|MIXED_RETURN_|NOTE_/u,String(alter));
 }
 const stale=JSON.parse(f.notesText);stale.notes[0].manuscript.reference.offsetUtf16++;
 assert.throws(()=>comment.planCommentReturnDelta({...f.proof,beforeText:f.beforeText,notesText:JSON.stringify(stale),mixedPendingScenes:mixed}),/PENDING_NOTE_BASELINE_CONFLICT/u);
});
test('v3 book transport keeps authored absent and partial body fields through parsed changed ZIP, Undo and strict semantic refusals',async()=>{
 const model=require('../../src/core/word-pending-comment-return-v1.cjs'),{buildStoredZip}=require('../../src/export/docx/docxMinBuilder.js');
 for(const attrs of [null,{wordParagraphSpacing:{after:120},wordParagraphMarkLanguage:{val:'ru-RU'}},
  {wordParagraphSpacing:{before:100,after:120,line:280,lineRule:'auto'},wordParagraphMarkLanguage:{val:'ru-RU',eastAsia:'ja-JP',bidi:'he-IL'}}]){
  const f=await notesBookFixture({bodyParagraphAttrs:attrs}),parts=f.bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:f.bytes}).parts;
  parts['word/styles.xml']=parts['word/styles.xml'].replace('<w:rPrDefault><w:rPr>','<w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:lang w:val="ru-FI" w:eastAsia="ru-RU" w:bidi="ar-SA"/>').replace('</w:docDefaults>','<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="278" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>');
  const proofFor=changed=>{
   const bytes=buildStoredZip(Object.entries(changed).map(([name,data])=>({name,data}))),parsed=f.bridge.buildDocxPendingCommentReturnDocumentsFromZipBytes({bytes,
    exportMap:f.source.localAuthorityCapsule.exportMap,baselineDocuments:f.ids.map((sceneId,i)=>({sceneId,document:f.beforeDocs[i]})),retainPendingScenes:true,
    documentSections:f.source.documentSections,signedSectionsDigest:f.source.documentSections.protectedDigest});
   assert.equal(parsed.ok,true,JSON.stringify(parsed));const proof=structuredClone(f.proof);
   proof.returnedScenes=parsed.scenes.map(s=>({sceneId:s.sceneId,ledger:review.readLedger(s.returnedDocument)}));
   const analysis=f.bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},{cryptoPort:{sha256Text:sha,sha256Json:value=>'sha256:'+sha(JSON.stringify(value)),byteLength:value=>Buffer.byteLength(value)}});
   assert.equal(analysis.ok,true,JSON.stringify(analysis));const preview=f.bridge.buildDocxContentPreviewFromZipBytes(bytes);assert.equal(preview.ok,true);
   proof.noteContext.returnedNotes=f.bridge.parseDocumentNotesRichReturn(bytes,analysis.reviewIr.documentNotes,{includeBreakProjection:true});
   proof.noteContext.returnedReferences=analysis.reviewIr.documentNotes.references;proof.noteContext.unionReferences=preview.contentPreview.pendingNoteReferences;return proof;
  };
  const input={beforeText:f.beforeText,projectId:f.document.projectId,scenes:f.scenes,notesText:f.notesText},proof=proofFor(parts);
  const result=model.planMixedBookReturn({...input,returnProofJson:JSON.stringify(proof)});
  for(const i of [0,2]){
   const doc=envelope.parseObservablePayload(result.scenes[i].content).doc,ledger=review.readLedger(doc);
   assert.deepEqual(ledger.source.content[0].attrs,attrs||undefined);
   assert.equal(review.projection(doc).current,f.current[i]);
   assert.deepEqual(review.readLedger(review.decide(doc,{action:'undo'}).doc).source,review.readLedger(f.beforeDocs[i])?.source||f.beforeDocs[i]);
  }
  assert.equal(result.scenes[1].content,f.scenes[1].beforeContent);
  for(const [from,to] of [['w:line="'+(attrs?.wordParagraphSpacing.line||240)+'"','w:line="278"'],['w:after="'+(attrs?120:0)+'"','w:after="161"'],['w:bidi="'+(attrs?.wordParagraphMarkLanguage.bidi||'en-US')+'"','w:bidi="ar-SA"']]){
   const changed={...parts,'word/document.xml':parts['word/document.xml'].replace(from,to)};assert.notEqual(changed['word/document.xml'],parts['word/document.xml']);
   assert.throws(()=>model.planMixedBookReturn({...input,returnProofJson:JSON.stringify(proofFor(changed))}),/MIXED_RETURN_NOTE_FORMAT_UNSUPPORTED/u);
  }
  for(const [field,value] of [['val','ru-FI'],['bidi','ar-SA']]){
   let changedRun=false;const xml=parts['word/document.xml'].replace(/<w:r>[\s\S]*?<\/w:r>/gu,run=>{
    if(changedRun||!/<w:t\b[^>]*>A<\/w:t>/u.test(run))return run;changedRun=true;
    if(/<w:lang\b/u.test(run))return run.replace(/<w:lang\b[^>]*\/>/u,tag=>tag.includes('w:'+field+'=')?tag.replace(new RegExp('w:'+field+'="[^"]*"','u'),'w:'+field+'="'+value+'"'):tag.replace('/>',' w:'+field+'="'+value+'"/>'));
    const properties='<w:lang w:'+field+'="'+value+'"/>';return run.includes('</w:rPr>')?run.replace('</w:rPr>',properties+'</w:rPr>'):run.replace('<w:r>','<w:r><w:rPr>'+properties+'</w:rPr>');
   });assert.equal(changedRun,true);assert.notEqual(xml,parts['word/document.xml']);
   assert.throws(()=>model.planMixedBookReturn({...input,returnProofJson:JSON.stringify(proofFor({...parts,'word/document.xml':xml}))}),/MIXED_RETURN_NOTE_FORMAT_UNSUPPORTED/u);
  }
  const zero={...parts,'word/document.xml':parts['word/document.xml'].replaceAll(' w:before="0"','')};
  const unchanged=model.planMixedBookReturn({...input,returnProofJson:JSON.stringify(proofFor(zero))});assert.deepEqual(unchanged,result);
 }
 const explicit=await notesBookFixture({bodyParagraphAttrs:{wordParagraphMarkLanguage:{val:'ru-RU'}},authoredRunLanguage:{val:'he-IL'}});
 const preserved=model.planMixedBookReturn({beforeText:explicit.beforeText,projectId:explicit.document.projectId,scenes:explicit.scenes,notesText:explicit.notesText,returnProofJson:JSON.stringify(explicit.proof)});
 for(const i of [0,2])for(const node of review.readLedger(envelope.parseObservablePayload(preserved.scenes[i].content).doc).source.content[0].content.filter(n=>n.type==='text')){
  if(node.text!=='!')assert.deepEqual(node.marks,[{type:'textStyle',attrs:{fontFamily:'Georgia',fontSize:'14pt',wordLanguage:{val:'he-IL'}}}]);
 }
 const legacy=await notesBookFixture({noteProfileV2:true}),proof=structuredClone(legacy.proof);
 proof.returnedScenes[0].ledger.source.content[0].attrs={wordParagraphSpacing:{after:160,line:278,lineRule:'auto'},wordParagraphMarkLanguage:{val:'ru-FI',eastAsia:'ru-RU',bidi:'ar-SA'}};
 assert.throws(()=>model.planMixedBookReturn({beforeText:legacy.beforeText,projectId:legacy.document.projectId,scenes:legacy.scenes,notesText:legacy.notesText,returnProofJson:JSON.stringify(proof)}),/MIXED_RETURN_NOTE_FORMAT_UNSUPPORTED/u);
});
test('v3 notes and discussions preserve unchanged codeBlock through changed text while its original typed format guard rejects actual ZIP mutations',async()=>{
 const f=await notesBookFixture({includeCodeBlock:true}),model=require('../../src/core/word-pending-comment-return-v1.cjs'),{buildStoredZip}=require('../../src/export/docx/docxMinBuilder.js');
 const input={beforeText:f.beforeText,projectId:f.document.projectId,scenes:f.scenes,notesText:f.notesText,returnProofJson:JSON.stringify(f.proof)},result=model.planMixedBookReturn(input);
 const code={type:'codeBlock',attrs:{language:''},content:[{type:'text',text:'const answer = 42;'}]},doc=envelope.parseObservablePayload(result.scenes[0].content).doc;
 assert.deepEqual(review.readLedger(doc).source.content[1],code);assert.equal(review.projection(doc).current,'!AB tail\nconst answer = 42;');
 assert.equal(result.scenes[1].content,f.scenes[1].beforeContent);assert.equal(JSON.parse(result.afterText).threads.find(t=>t.threadId==='thread-1').messages.at(-1).body,'Foreign Beta reply retained');
 assert.deepEqual(review.readLedger(review.decide(doc,{action:'undo'}).doc).source,f.beforeDocs[0]);
 const parts=f.bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:f.bytes}).parts,codeParagraph=[...parts['word/document.xml'].matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/gu)][1][0];
 assert.match(codeParagraph,/<w:pStyle w:val="YalkenCodeBlock"\/>/u);assert.doesNotMatch(codeParagraph,/<w:spacing\b|<w:lang\b/u);
 const parse=xml=>f.bridge.buildDocxPendingCommentReturnDocumentsFromZipBytes({bytes:buildStoredZip(Object.entries({...parts,'word/document.xml':xml}).map(([name,data])=>({name,data}))),
  exportMap:f.source.localAuthorityCapsule.exportMap,baselineDocuments:f.ids.map((sceneId,i)=>({sceneId,document:f.beforeDocs[i]})),retainPendingScenes:true,
  documentSections:f.source.documentSections,signedSectionsDigest:f.source.documentSections.protectedDigest});
 // The existing code model owns fixed typography and syntax language. Run
 // proofing language has no representation here; it is not a claimed invariant.
 for(const property of ['<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>','<w:sz w:val="28"/>']){
  const changed=codeParagraph.replace('<w:r>','<w:r><w:rPr>'+property+'</w:rPr>');assert.notEqual(changed,codeParagraph);
  const rejected=parse(parts['word/document.xml'].replace(codeParagraph,changed));assert.equal(rejected.ok,false,JSON.stringify(rejected));assert.equal(rejected.code,'DOCX_CODE_BLOCK_FORMAT_UNSUPPORTED');
 }
 const forged=structuredClone(f.proof);forged.returnedScenes[0].ledger.source.content[1].attrs.language='python';
 assert.throws(()=>model.planMixedBookReturn({...input,returnProofJson:JSON.stringify(forged)}),/MIXED_RETURN_STRUCTURE_OR_FORMAT_CHANGED/u);
});
test('Signed code emission distinguishes Menlo defaults from authored Word styles without losing rich round inverse',async()=>{
 const {deriveMixedPendingDocument}=require('../../src/core/word-pending-comment-return-v1.cjs'),bridge=await import('../../src/io/revisionBridge/index.mjs');
 const style=attrs=>[{type:'textStyle',attrs}],edited={fontFamily:'Georgia',fontSize:'14pt',wordLanguage:{val:'en-GB'}};
 for(const authored of [undefined,{fontFamily:'Menlo',fontSize:'10pt'},edited]){
  const source={type:'doc',content:[{type:'codeBlock',attrs:{language:''},content:[{type:'text',text:'alpha',...(authored?{marks:style(authored)}:{})}]}]};
  const old=review.bindLedger({schemaVersion:2,source,revisions:[{id:'revision-1',nativeId:'1',operation:'insert',author:'Writer',date:'',dateUtc:'',paragraphIndex:0,from:0,to:1,state:'pending',groupId:null}],undo:[],redo:[],roundUndo:[],roundRedo:[],returnReceipts:[]});
  const packet=makeSource({projectId,projectRoot:'/project',scenes:[{sceneId,scenePath:'/project/'+sceneId,order:0,text:'alpha',doc:old,observableContent:encode(old)}]}),capsule=packet.localAuthorityCapsule;
  const exportParagraphs=capsule.exportMap.scenes[0].blocks.map(b=>b.formatIr.paragraph),exportTypography=capsule.exportMap.exportTypography;
  const binding=review.buildCommentExportBinding({document:old,anchors:[],exportTypography,exportParagraphs,schemaVersion:1}).binding;
  const derive=(incoming,paragraphs=exportParagraphs)=>deriveMixedPendingDocument({document:old,returnedDocument:incoming,binding,anchors:[],exportTypography,exportParagraphs:paragraphs,cleanTransportSchemaVersion:1,allowUntrackedRichFormatting:true});
  const bytes=build(packet),parsed=bridge.buildDocxPendingCommentReturnDocumentsFromZipBytes({bytes,exportMap:capsule.exportMap,baselineDocuments:[{sceneId,document:old}],documentSections:capsule.documentSections,signedSectionsDigest:capsule.documentSections.protectedDigest,retainPendingSceneId:sceneId});
  if(authored===edited){assert.equal(parsed.ok,false);assert.equal(parsed.code,'DOCX_CODE_BLOCK_FORMAT_UNSUPPORTED');}
  else assert.equal(parsed.ok,true,JSON.stringify(parsed));
  const unchanged=derive(authored===edited?old:parsed.scenes[0].returnedDocument);
  assert.equal(unchanged.changed,false);assert.deepEqual(review.readLedger(unchanged.document).source,review.readLedger(old).source);
  const incoming=structuredClone(review.readLedger(old));incoming.source.content[0].content=[{type:'text',text:'alpha!',marks:style(edited)}];
  incoming.revisions.push({id:'revision-2',nativeId:'41',operation:'insert',author:'Word editor',date:'2026-10-06T00:00:00Z',dateUtc:'',paragraphIndex:0,from:5,to:6,state:'pending',groupId:null});
  const result=derive(review.bindLedger(incoming));assert.equal(result.changed,true);for(const node of review.readLedger(result.document).source.content[0].content)assert.deepEqual(node.marks,style(edited));
  assert.equal(review.projection(result.document).original,'lpha');assert.equal(review.projection(result.document).current,'alpha!');
  const round=review.replaceFromReturn(old,result.document,{roundId:'round-code',artifactSha256:sha(bytes)}).doc;
  const undone=review.decide(round,{action:'undo'}).doc;assert.deepEqual(review.readLedger(undone).source,review.readLedger(old).source);
  const redone=review.decide(undone,{action:'redo'}).doc;assert.deepEqual(review.readLedger(redone).source,review.readLedger(result.document).source);
  assert.throws(()=>derive(review.bindLedger(incoming),null),/PENDING_COMMENT_EXPORT_LAYOUT_INVALID|MIXED_RETURN_CODE_STYLE_EMISSION_UNPROVEN/u);
  const rebound=structuredClone(exportParagraphs);rebound[0].codeLanguage='python';assert.throws(()=>derive(review.bindLedger(incoming),rebound),/MIXED_RETURN_CODE_STYLE_EMISSION_UNPROVEN/u);
 }
});
test('Mixed book derivation retains run events through implicit emitted fonts and a fresh paragraph-mark language change',()=>{
 const {deriveMixedPendingDocument}=require('../../src/core/word-pending-comment-return-v1.cjs'),lang=val=>({type:'textStyle',attrs:{wordLanguage:{val}}}),defaults={fontFamily:'Times New Roman',fontSize:'12pt'};
 const source={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'a',marks:[lang('en-US')]},{type:'text',text:'b',marks:[{type:'bold'}]},{type:'text',text:'c'}]}]};
 const revision=(id,from,to,extra)=>({id:'revision-'+id,nativeId:String(id),operation:'format',author:'Writer',date:'',dateUtc:'',paragraphIndex:0,from,to,state:'pending',groupId:null,...extra});
 const old=review.bindLedger({schemaVersion:5,source,revisions:[revision(1,0,1,{operation:'insert'}),revision(2,0,1,{parentRevisionId:'revision-1',format:{kind:'run',before:[lang('ru-RU')],after:[lang('en-US')]}}),revision(3,1,2,{format:{kind:'run',before:[],after:[{type:'bold'}]}})],undo:[],redo:[],roundUndo:[],roundRedo:[],returnReceipts:[]});
 const incoming=structuredClone(review.readLedger(old)),withDefaults=marks=>{const copy=structuredClone(marks);let mark=copy.find(m=>m.type==='textStyle');if(!mark){mark={type:'textStyle',attrs:{}};copy.push(mark);}Object.assign(mark.attrs,defaults);return copy;};
 incoming.source.content[0].content.push({type:'text',text:'!'});
 for(const n of incoming.source.content[0].content)n.marks=withDefaults(n.marks||[]);
 for(const r of incoming.revisions.filter(r=>r.operation==='format'))for(const side of ['before','after'])r.format[side]=withDefaults(r.format[side]);
 incoming.revisions.push(revision(4,0,4,{format:{kind:'paragraph',before:{type:'paragraph'},after:{type:'paragraph',attrs:{wordParagraphMarkLanguage:{val:'ru-RU'}}}}}),revision(5,3,4,{operation:'insert',author:'Editor'}));incoming.source.content[0].attrs={wordParagraphMarkLanguage:{val:'ru-RU'}};
 incoming.revisions.sort((a,b)=>a.from-b.from);
 const binding=review.buildCommentExportBinding({document:old,anchors:[],schemaVersion:1}).binding;
 const derive=ledger=>deriveMixedPendingDocument({document:old,returnedDocument:review.bindLedger(ledger),binding,anchors:[],cleanTransportSchemaVersion:1,allowUntrackedRichFormatting:true});
 const result=derive(incoming),ledger=review.readLedger(result.document),paragraphFormat=ledger.revisions.find(review.isParagraphFormat);
 assert.equal(paragraphFormat.format.before.attrs?.wordParagraphMarkLanguage,undefined);assert.deepEqual(paragraphFormat.format.after.attrs.wordParagraphMarkLanguage,{val:'ru-RU'});
 for(const r of ledger.revisions.filter(r=>r.operation==='format'&&r.format.kind==='run')){const prior=review.readLedger(old).revisions.find(p=>p.id===r.id);assert.deepEqual(review.formatTransitionMeaning(r.format),review.formatTransitionMeaning(prior.format));assert.equal(r.nativeId,prior.nativeId);assert.equal(r.author,prior.author);assert.equal(r.parentRevisionId,prior.parentRevisionId);assert.ok(r.format.after.every(m=>!m.attrs?.fontFamily&&!m.attrs?.fontSize));}
 assert.equal(review.projection(result.document).current,'abc!');assert.equal(review.projection(result.document).original,'bc');
 for(const id of ['revision-2','revision-3']){const forged=structuredClone(incoming),r=forged.revisions.find(r=>r.id===id);r.format.before.push({type:'italic'});assert.throws(()=>derive(forged),/MIXED_RETURN_(?:OLD_FORMAT_TRANSITION_CHANGED|SOURCE_CHANGED)/u);}
});
async function fixture(clean=false,markChange=false) {
  const source={type:'doc',content:['oldnew','tail AAA BBB'].map(text=>({type:'paragraph',content:[{type:'text',text}]}))};
  if(markChange)source.content.push({type:'paragraph',attrs:{wordParagraphMarkTypography:{bold:false,fontFamily:'Arial',fontSize:'12pt'}},content:[]});
  if(markChange)source.content[1].attrs={wordParagraphMarkTypography:{bold:false,fontFamily:'Arial',fontSize:'12pt'}};
  if(markChange==='font-slots')for(const index of [1,2])source.content[index].attrs.wordParagraphMarkTypography={fontSlots:{ascii:'Arial',hAnsi:'Georgia'}};
  const revisions=['delete','insert'].map((operation,i)=>({id:'revision-'+(i+1),nativeId:''+i,operation,author:'Writer',date:'',dateUtc:'',paragraphIndex:0,from:i*3,to:i*3+3,state:'pending',groupId:'group-1'}));
  let beforeDoc=review.bindLedger({schemaVersion:1,source,revisions,undo:[],redo:[]});
  if(clean)beforeDoc=review.normalizeNode(beforeDoc);
  const state={schemaVersion:'yalken.rtk.word.non-text-return-state.v1',projectId,revision:0,events:[],threads:[
    {threadId:'first',rootCommentId:'first-root',sceneId,status:'open',anchor:exactAnchor({paragraphIndex:0,startUtf16:1,selectedText:'ew'},sceneId,['new','tail AAA BBB']),messages:[{commentId:'first-root',kind:'root',body:'Old query',provenance:{author:'Writer'}}]},
    {threadId:'second',rootCommentId:'second-root',sceneId,status:'open',anchor:exactAnchor({paragraphIndex:1,startUtf16:9,selectedText:'BBB'},sceneId,['new','tail AAA BBB']),messages:[{commentId:'second-root',kind:'root',body:'Second query',provenance:{author:'Writer'}}]}]};
  const beforeContent=encode(beforeDoc),beforeText=JSON.stringify(state);
  const exported=makeSource({projectId,projectRoot:'/project',nonTextReturnState:state,scenes:[{sceneId,scenePath:'/project/'+sceneId,order:0,text:'new\ntail AAA BBB',doc:beforeDoc,observableContent:beforeContent}]});
  const ledger=structuredClone(review.readLedger(beforeDoc)||{schemaVersion:2,source:beforeDoc,revisions:[],undo:[],redo:[],roundUndo:[],roundRedo:[],returnReceipts:[]});ledger.source.content[1].content[0].text='tail AAAZZZ BBB';
  ledger.revisions.push(...['delete','insert'].map((operation,i)=>({id:'revision-'+(3+i),nativeId:''+(2+i),operation,author:'Editor',date:'',dateUtc:'',paragraphIndex:1,from:5+i*3,to:8+i*3,state:'pending',groupId:'group-2'})));
  if(markChange)for(const index of [1,2]){const before=review.paragraphProperties(ledger.source.content[index]);ledger.source.content[index].attrs.wordParagraphMarkTypography=markChange==='font-slots'?{fontSlots:{ascii:'Aptos',hAnsi:'Georgia',cs:'Arial'}}:{bold:markChange!=='omit-off',fontFamily:'Georgia',fontSize:'14pt'};ledger.revisions.push({id:'revision-'+(5+index),nativeId:String(4+index),operation:'format',author:'Editor',date:'',dateUtc:'',paragraphIndex:index,from:0,to:(ledger.source.content[index].content||[]).map(n=>n.text).join('').length,state:'pending',groupId:null,format:{kind:'paragraph',before,after:review.paragraphProperties(ledger.source.content[index])}});}ledger.revisions.sort((a,b)=>a.paragraphIndex-b.paragraphIndex||a.from-b.from);
  const returnedDoc=review.bindLedger(ledger),afterState=structuredClone(state);
  afterState.threads.forEach((t,i)=>t.messages.push({commentId:'reply-'+i,kind:'reply',body:'Answer '+i,provenance:{author:'Editor'}}));
  afterState.threads[0].messages[0].body='Edited query';
  afterState.threads[1].anchor=exactAnchor({paragraphIndex:1,startUtf16:9,selectedText:'BBB'},sceneId,['new','tail ZZZ BBB']);
  afterState.threads.push({threadId:'new-root-thread',rootCommentId:'new-root',sceneId,status:'open',anchor:exactAnchor({paragraphIndex:1,startUtf16:6,selectedText:'ZZ'},sceneId,['new','tail ZZZ BBB']),messages:[{commentId:'new-root',kind:'root',body:'Fresh insertion query',provenance:{author:'Editor'}}]});
  let bytes=build(makeSource({projectId,projectRoot:'/project',nonTextReturnState:afterState,scenes:[{sceneId,scenePath:'/project/'+sceneId,order:0,text:'new\ntail ZZZ BBB',doc:returnedDoc}]}));
  const bridge=await import('../../src/io/revisionBridge/index.mjs'),cryptoPort={sha256Text:sha,sha256Json:v=>'sha256:'+sha(stable(v)),byteLength:v=>Buffer.byteLength(v)};
  if(markChange==='omit-off'){const parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes}).parts;parts['word/document.xml']=parts['word/document.xml'].replaceAll('<w:b w:val="0"/>','');bytes=require('../../src/export/docx/docxMinBuilder.js').buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data})));}
  const parsed=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},{cryptoPort});assert.equal(parsed.ok,true);
  const capsule=exported.localAuthorityCapsule;
  const documents=bridge.buildDocxPendingCommentReturnDocumentsFromZipBytes({bytes,exportMap:capsule.exportMap,baselineDocuments:[{sceneId,document:beforeDoc}],documentSections:capsule.documentSections,signedSectionsDigest:capsule.documentSections.protectedDigest,retainPendingSceneId:sceneId});assert.equal(documents.ok,true,JSON.stringify(documents));
  const proof={schemaVersion:1,projectId,roundId:'round-mixed',artifactSha256:'sha256:'+sha(bytes),baseline:capsule.commentExport,exportMap:capsule.exportMap,returnedDocument:documents.scenes[0].returnedDocument,
    returnedThreads:parsed.reviewIr.commentThreads,returnedParagraphs:parsed.reviewIr.formattingParagraphs.map(({paragraphIndex,paragraphText,trackedRevision})=>({paragraphIndex,paragraphText,trackedRevision})),commentReturnInventory:parsed.reviewIr.commentReturnInventory};
  return {beforeContent,beforeText,beforeDoc,proof,projectId,sceneId};
}
const plan=f=>planMixedPendingReturn({...f,returnProofJson:JSON.stringify(f.proof)});
async function assertDiscussionReadback(doc,state) {
 const canonical=JSON.parse(state),bridge=await import('../../src/io/revisionBridge/index.mjs');
 const bytes=build(makeSource({projectId,projectRoot:'/project',nonTextReturnState:canonical,scenes:[{sceneId,scenePath:'/project/'+sceneId,order:0,text:envelope.deriveVisibleTextFromDocument(doc),doc}]}));
 const result=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},{cryptoPort:{sha256Text:sha,sha256Json:v=>'sha256:'+sha(stable(v)),byteLength:v=>Buffer.byteLength(v)}});
 assert.equal(result.ok,true);const active=canonical.threads.filter(t=>t.status!=='deleted');assert.equal(result.reviewIr.commentThreads.length,active.length);
 for(const expected of active) {
  const actual=result.reviewIr.commentThreads.find(t=>t.body===expected.messages[0].body);assert.ok(actual);
  assert.deepEqual([actual.body,...actual.replies.map(r=>r.body)],expected.messages.map(m=>m.body));
  assert.equal(actual.finalTextAnchorRange.selectedText,expected.anchor.selectedText);
  assert.equal(actual.paragraphIndex,expected.anchor.sceneParagraphIndex);assert.equal(actual.finalTextAnchorRange.startUtf16,expected.anchor.startUtf16);
 }
}

test('mixed Word replacement preserves old partitions, rich source, multiple discussions and restart round inverse',async()=>{
  const f=await fixture(),p=plan(f),ledger=review.readLedger(p.replacement.doc);
  assert.equal(review.projection(p.replacement.doc).current,'new\ntail ZZZ BBB');
  assert.deepEqual(ledger.revisions.slice(0,2),review.readLedger(f.beforeDoc).revisions);
  assert.equal(JSON.parse(p.afterText).threads.length,3);
  const decisions=require('../../src/core/word-pending-comment-decisions-v1.cjs');
  let doc=JSON.parse(JSON.stringify(p.replacement.doc)),state=p.afterText;
  for(const action of ['undo','redo']) {
    const next=review.decide(doc,{action}).doc;
    state=decisions.planPendingCommentDecision({beforeText:state,projectId,sceneId,beforeContent:encode(doc),afterContent:encode(next),decision:{action}}).afterText;doc=next;
    assert.equal(JSON.parse(state).threads.reduce((n,t)=>n+t.messages.length,0),5);
    assert.equal(JSON.parse(state).threads.at(-1).status,action==='undo'?'deleted':'open');
  }
  assert.equal(review.projection(doc).current,'new\ntail ZZZ BBB');
  const reexport=makeSource({projectId,projectRoot:'/project',nonTextReturnState:JSON.parse(state),scenes:[{sceneId,scenePath:'/project/'+sceneId,order:0,text:envelope.deriveVisibleTextFromDocument(doc),doc}]});
  assert.ok(build(reexport).length>0);
});
for(const [name,mutate] of Object.entries({
  provenance:f=>{const d=f.proof.returnedDocument,l=review.readLedger(d);l.revisions[0].author='forged';l.revisions.forEach(r=>r.groupId=null);f.proof.returnedDocument=review.bindLedger(l);},
  missingPartition:f=>{const l=review.readLedger(f.proof.returnedDocument);l.revisions.shift();l.revisions.forEach(r=>r.groupId=null);f.proof.returnedDocument=review.bindLedger(l);},
  missingInventory:f=>{delete f.proof.commentReturnInventory;},
  anchor:f=>{f.proof.returnedThreads[0].anchorRange.startUtf16++;},
  foreignProject:f=>{f.proof.projectId='foreign';},
  baseline:f=>{f.beforeContent+=' ';},
  visibleText:f=>{f.proof.returnedParagraphs[1].paragraphText+='forged';},
  format:f=>{const l=review.readLedger(f.proof.returnedDocument);l.source.content[1].content[0].marks=[{type:'bold'}];f.proof.returnedDocument=review.bindLedger(l);},
  unknownField:f=>{f.proof.extra=true;},
}))test('mixed return refuses '+name+' before publication',async()=>{const f=await fixture();mutate(f);assert.throws(()=>plan(f));});
test('first clean signed rich baseline admits changed pending graph with reversible empty source round',async()=>{
 const f=await fixture(true),p=plan(f);assert.equal(review.readLedger(f.beforeDoc),null);
 assert.equal(review.projection(p.replacement.doc).current,'new\ntail ZZZ BBB');
 const undo=review.decide(p.replacement.doc,{action:'undo'}).doc;
 assert.deepEqual(review.normalizeNode(undo),review.normalizeNode(f.beforeDoc));
});
test('repeated equal pending insertion cannot choose an old occurrence by matching quote',()=>{
 const make=value=>review.bindLedger({schemaVersion:1,source:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:value}]}]},
   revisions:[{id:'revision-1',nativeId:'0',operation:'insert',author:'A',date:'',dateUtc:'',paragraphIndex:0,from:0,to:value.length,state:'pending',groupId:null}],undo:[],redo:[]});
 const before=make('a'),after=make('aa'),binding=review.buildCommentExportBinding({document:before,schemaVersion:2}).binding;
 const ledger=review.readLedger(after);ledger.source=review.buildCommentExportBinding({document:after,schemaVersion:2}).projection.union;
 assert.throws(()=>require('../../src/core/word-pending-comment-return-v1.cjs').deriveMixedPendingDocument({document:before,returnedDocument:review.bindLedger(ledger),binding,anchors:[]}),/MAPPING_AMBIGUOUS/);
});
test('changed megaparagraph refuses before character atom allocation',()=>{
 const make=value=>review.bindLedger({schemaVersion:1,source:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:value}]}]},
   revisions:[{id:'revision-1',nativeId:'0',operation:'insert',author:'A',date:'',dateUtc:'',paragraphIndex:0,from:0,to:value.length,state:'pending',groupId:null}],undo:[],redo:[]});
 const before=make('a'.repeat(10000)),after=make('a'.repeat(10000)+'b'),binding=review.buildCommentExportBinding({document:before,schemaVersion:2}).binding;
 const ledger=review.readLedger(after);ledger.source=review.buildCommentExportBinding({document:after,schemaVersion:2}).projection.union;
 assert.throws(()=>require('../../src/core/word-pending-comment-return-v1.cjs').deriveMixedPendingDocument({document:before,returnedDocument:review.bindLedger(ledger),binding,anchors:[]}),/CHANGED_PARAGRAPH_BUDGET/);
});

test('mixed comment starting at replacement insertion keeps its explicit Word union endpoint on reexport and round redo',async()=>{
 const f=await fixture(),thread=f.proof.returnedThreads.at(-1);
 thread.anchorRange.startUtf16=8;thread.anchorRange.endUtf16=11;thread.anchorRange.selectedText='ZZZ';thread.quotedAnchorText='ZZZ';
 thread.finalTextAnchorRange.startUtf16=5;thread.finalTextAnchorRange.endUtf16=8;thread.finalTextAnchorRange.selectedText='ZZZ';
 const p=plan(f),decisions=require('../../src/core/word-pending-comment-decisions-v1.cjs');let doc=p.replacement.doc,state=p.afterText;
 const exported=()=>makeSource({projectId,projectRoot:'/project',nonTextReturnState:JSON.parse(state),scenes:[{sceneId,scenePath:'/project/'+sceneId,order:0,text:envelope.deriveVisibleTextFromDocument(doc),doc}]});
 assert.ok(build(exported()).length);await assertDiscussionReadback(doc,state);
 for(const action of ['undo','redo']) {const next=review.decide(doc,{action}).doc;state=decisions.planPendingCommentDecision({beforeText:state,projectId,sceneId,beforeContent:encode(doc),afterContent:encode(next),decision:{action}}).afterText;doc=next;assert.ok(build(exported()).length);await assertDiscussionReadback(doc,state);}
});

for(const action of ['accept','reject'])for(const targetId of ['revision-1','revision-2','revision-3','revision-4'])test('boundary discussion stays exportable through '+action+' '+targetId+' and decision Undo/Redo',async()=>{
 const f=await fixture(),thread=f.proof.returnedThreads.at(-1);
 Object.assign(thread.anchorRange,{startUtf16:8,endUtf16:11,selectedText:'ZZZ'});thread.quotedAnchorText='ZZZ';
 Object.assign(thread.finalTextAnchorRange,{startUtf16:5,endUtf16:8,selectedText:'ZZZ'});
 const p=plan(f),decisions=require('../../src/core/word-pending-comment-decisions-v1.cjs');let doc=p.replacement.doc,state=p.afterText;
 for(const decision of [{action,revisionId:targetId},{action:'undo'},{action:'redo'}]) {
   const next=review.decide(doc,decision).doc;
   state=decisions.planPendingCommentDecision({beforeText:state,projectId,sceneId,beforeContent:encode(doc),afterContent:encode(next),decision}).afterText;doc=next;
   await assertDiscussionReadback(doc,state);
 }
});
for(const kind of ['stale','endpoint','unknown'])test('export refuses '+kind+' pending union locator before publication',async()=>{
 const f=await fixture(),thread=f.proof.returnedThreads.at(-1);
 Object.assign(thread.anchorRange,{startUtf16:8,endUtf16:11,selectedText:'ZZZ'});thread.quotedAnchorText='ZZZ';
 Object.assign(thread.finalTextAnchorRange,{startUtf16:5,endUtf16:8,selectedText:'ZZZ'});
 const p=plan(f),state=JSON.parse(p.afterText),locator=state.threads.at(-1).anchor.pendingUnionLocator;
 if(kind==='stale')locator.geometrySha256='0'.repeat(64);else if(kind==='endpoint')locator.unionStart.offsetUtf16++;else locator.extra=true;
 assert.throws(()=>makeSource({projectId,projectRoot:'/project',nonTextReturnState:state,scenes:[{sceneId,scenePath:'/project/'+sceneId,order:0,text:review.projection(p.replacement.doc).current,doc:p.replacement.doc}]}),/LOCATOR/);
});

for(const placement of ['span','paragraph'])test('mixed Core orders fresh insertion before existing '+placement+' without reassigning IDs',async()=>{
 const f=await fixture(),old=structuredClone(review.readLedger(f.beforeDoc));
 if(placement==='paragraph'){old.source.content.unshift({type:'paragraph',content:[{type:'text',text:'lead'}]});old.revisions.forEach(r=>r.paragraphIndex++);}
 const before=review.bindLedger(old),incoming=structuredClone(old),p=0,from=placement==='span'?0:4;
 incoming.source.content[p].content[0].text=placement==='span'?'Xoldnew':'leadX';
 if(placement==='span')incoming.revisions.forEach(r=>{r.from++;r.to++;});
 incoming.revisions.unshift({id:'revision-3',nativeId:'2',operation:'insert',author:'Editor',date:'',dateUtc:'',paragraphIndex:p,from,to:from+1,state:'pending',groupId:null});
 const binding=review.buildCommentExportBinding({document:before,schemaVersion:2}).binding;
 incoming.source=review.buildCommentExportBinding({document:review.bindLedger(incoming),schemaVersion:2}).projection.union;
 const derived=require('../../src/core/word-pending-comment-return-v1.cjs').deriveMixedPendingDocument({document:before,returnedDocument:review.bindLedger(incoming),binding,anchors:[]});
 const rows=review.readLedger(derived.document).revisions;assert.deepEqual(rows.map(r=>r.id),['revision-3','revision-1','revision-2']);
 for(const previous of old.revisions){const retained=rows.find(r=>r.id===previous.id);assert.deepEqual(retained,{...previous,from:previous.from+(placement==='span'?1:0),to:previous.to+(placement==='span'?1:0)});}
});

test('Paragraph mark typography: mixed tracked replacement plus replies preserves empty/nonempty mark changes and round inverse',async()=>{
 const f=await fixture(false,true),p=plan(f),doc=p.replacement.doc;
 assert.equal(review.projection(doc).current,'new\ntail ZZZ BBB\n');
 assert.deepEqual(review.paragraphs(review.normalizeNode(doc)).slice(1).map(p=>p.attrs.wordParagraphMarkTypography),Array(2).fill({bold:true,fontFamily:'Georgia',fontSize:'14pt'}));
 assert.deepEqual(review.paragraphs(review.materialize(review.readLedger(doc),'original')).slice(1).map(p=>p.attrs.wordParagraphMarkTypography),Array(2).fill({bold:false,fontFamily:'Arial',fontSize:'12pt'}));
 await assertDiscussionReadback(doc,p.afterText);
 let inverse=review.decide(doc,{action:'undo'}).doc;assert.deepEqual(review.normalizeNode(inverse),review.normalizeNode(f.beforeDoc));
 inverse=review.decide(envelope.parseObservablePayload(encode(inverse)).doc,{action:'redo'}).doc;assert.deepEqual(review.normalizeNode(inverse),review.normalizeNode(doc));
 for(const revision of review.readLedger(doc).revisions.filter(review.isParagraphFormat)){for(const action of ['accept','reject']){const decided=review.decide(doc,{action,revisionId:revision.id}).doc;assert.deepEqual(review.paragraphs(review.normalizeNode(decided))[revision.paragraphIndex].attrs.wordParagraphMarkTypography,action==='accept'?{bold:true,fontFamily:'Georgia',fontSize:'14pt'}:{bold:false,fontFamily:'Arial',fontSize:'12pt'});}}
});

test('Paragraph mark typography: Word omission of effective off retains canonical false during a genuine size/family change',async()=>{
 const f=await fixture(false,'omit-off'),p=plan(f);
 assert.deepEqual(review.normalizeNode(p.replacement.doc).content.slice(1).map(p=>p.attrs.wordParagraphMarkTypography),Array(2).fill({bold:false,fontFamily:'Georgia',fontSize:'14pt'}));
 assert.deepEqual(review.normalizeNode(review.decide(p.replacement.doc,{action:'undo'}).doc),review.normalizeNode(f.beforeDoc));
 const forged=structuredClone(f),l=review.readLedger(forged.proof.returnedDocument),r=l.revisions.find(review.isParagraphFormat);r.format.before.attrs.wordParagraphMarkTypography.bold=true;forged.proof.returnedDocument=review.bindLedger(l);assert.throws(()=>plan(forged),/MIXED_RETURN_STRUCTURE_OR_FORMAT_CHANGED/);
});

test('Paragraph mark fontSlots: compound text discussions retain source slots through UndoRedo and reject forged previous slots',async()=>{
 const f=await fixture(false,'font-slots'),p=plan(f),before=review.normalizeNode(f.beforeDoc),doc=p.replacement.doc;
 assert.deepEqual(review.normalizeNode(doc).content.slice(1).map(p=>p.attrs.wordParagraphMarkTypography),[{fontSlots:{ascii:'Aptos',hAnsi:'Georgia',cs:'Arial'}},{fontSlots:{ascii:'Aptos',hAnsi:'Georgia',cs:'Arial'}}]);
 const undone=review.decide(doc,{action:'undo'}).doc;assert.deepEqual(review.normalizeNode(undone),before);
 const redone=review.decide(undone,{action:'redo'}).doc;assert.deepEqual(review.normalizeNode(redone),review.normalizeNode(doc));await assertDiscussionReadback(redone,p.afterText);
 const forged=structuredClone(f),ledger=review.readLedger(forged.proof.returnedDocument);ledger.revisions.find(review.isParagraphFormat).format.before.attrs.wordParagraphMarkTypography.fontSlots.ascii='Courier New';forged.proof.returnedDocument=review.bindLedger(ledger);assert.throws(()=>plan(forged),/MIXED_RETURN_STRUCTURE_OR_FORMAT_CHANGED/);
});
