'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto');
const { createRequire } = require('node:module');
const pending = require('../../src/core/word-pending-text-revisions-v1.cjs');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const notes = require('../../src/core/word-manuscript-notes-v1.cjs');
const delta = require('../../src/core/word-note-return-delta-v1.cjs');
const builder = require('../../src/export/docx/docxReviewPacketBuilder.js');
const { buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
const p = text => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] });
const d = (...content) => ({ type: 'doc', content });
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const plain = value => JSON.parse(JSON.stringify(value));
const sceneId = 'roman/scene.txt', projectId = 'project-test';
const revision = (from, to, operation = 'delete') => ({ id: 'revision-1', nativeId: '51', operation,
  author: 'Reviewer', date: '', dateUtc: '', paragraphIndex: 0, from, to, state: 'pending', groupId: null });
const ledger = (source, revisions) => ({ schemaVersion: 2, source, revisions, undo: [], redo: [], roundUndo: [], roundRedo: [], returnReceipts: [] });
// Shared owned fixture, loaded without registering this file's tests by the
// other two contracts. Every expected point/text below is a literal oracle.
async function composedBookFixture(bodyOverride = null, { legacyNoteProfile = false, noteProfileV2 = false, bodyParagraphAttrs = null, authoredRunLanguage = null, includeCodeBlock = false, sourceFactory = null } = {}) {
  const ids=[sceneId,'roman/b.txt','roman/c.txt'],makeSource=sourceFactory||require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js').buildFullManuscriptDocxReviewPacketSource;
  const {exactAnchor}=require('../../src/core/word-comment-authoring-v1.cjs');
  const event=(id,operation,from,to)=>({...revision(from,to,operation),id:'revision-'+id,nativeId:String(id),author:'Prior writer'});
  const beforeDocs=[d(p('AxxB tail')),d(p('Control Beta')),pending.bindNoteSourcePoints(pending.bindLedger(ledger(d(p('oldnew tail')),[event(1,'delete',0,3),event(2,'insert',3,6)])),[{noteId:'note-gamma',paragraphIndex:0,offsetUtf16:8}])];
  const codeBlock={type:'codeBlock',attrs:{language:''},content:[{type:'text',text:'const answer = 42;'}]};
  if(includeCodeBlock)beforeDocs[0].content.push(plain(codeBlock));
  if(authoredRunLanguage)beforeDocs.forEach((doc,i)=>{const old=pending.readLedger(doc),value=plain(old||doc);for(const node of (old?value.source:value).content[0].content)if(node.type==='text')node.marks=[{type:'textStyle',attrs:{fontFamily:'Georgia',fontSize:'14pt',wordLanguage:plain(authoredRunLanguage)}}];beforeDocs[i]=old?pending.bindLedger(value):value;});
  if(bodyParagraphAttrs)beforeDocs.forEach((doc,i)=>{const old=pending.readLedger(doc),value=plain(old||doc);(old?value.source:value).content[0].attrs=plain(bodyParagraphAttrs);beforeDocs[i]=old?pending.bindLedger(value):value;});
  const body=bodyOverride||d({type:'paragraph',attrs:{wordParagraphSpacing:{before:0,after:120},wordParagraphMarkLanguage:{val:'ru-RU'}},content:[
    {type:'text',text:'Rich body',marks:[{type:'bold'},{type:'textStyle',attrs:{fontFamily:'Georgia',fontSize:'14pt',wordLanguage:{val:'ru-RU',eastAsia:'ja-JP',bidi:'he-IL'}}}]},
    {type:'hardBreak'},{type:'text',text:'kept'}]});
  const identities=['note-left','note-right','note-beta','note-gamma'],owners=[0,0,1,2],offsets=[1,3,2,5];
  const document={schemaVersion:1,projectId,notes:identities.map((id,i)=>({id,title:'',scope:'manuscript',body:notes.validateNoteBody(body).text,
    manuscript:notes.bindManuscriptPayload({kind:i%2?'endnote':'footnote',body,sceneId:ids[owners[i]],offsetUtf16:offsets[i],sceneContent:envelope.composeObservablePayload({doc:beforeDocs[owners[i]]})})}))};
  const state={schemaVersion:'yalken.rtk.word.non-text-return-state.v1',projectId,revision:0,events:[],threads:ids.map((id,i)=>({threadId:'thread-'+i,rootCommentId:'root-'+i,sceneId:id,status:'open',
    anchor:exactAnchor({paragraphIndex:0,startUtf16:i===0?5:i===1?0:1,selectedText:i===0?'tail':i===1?'Control':'e'},id,[i===0?'AxxB tail':i===1?'Control Beta':'new tail']),
    messages:[{commentId:'root-'+i,kind:'root',body:'Question '+i,provenance:{author:'Writer'}}]}))};
  const packet=(docs,notesDocument,nonTextReturnState)=>{
    const value=makeSource({projectId,projectRoot:'/project',notesDocument,nonTextReturnState,scenes:ids.map((id,i)=>({sceneId:id,scenePath:'/project/'+id,order:i,
      doc:docs[i],text:envelope.deriveVisibleTextFromDocument(docs[i]),observableContent:envelope.composeObservablePayload({doc:docs[i]})}))});
    // Keep both historical emitter/proof laws executable; production selects v3.
    if(legacyNoteProfile)for(const noteBaseline of [value.documentNotes,value.localAuthorityCapsule.documentNotes])noteBaseline.breakEmission={schemaVersion:1,fontSize:'12pt'};
    if(noteProfileV2)for(const noteBaseline of [value.documentNotes,value.localAuthorityCapsule.documentNotes]){noteBaseline.breakEmission.schemaVersion=2;delete noteBaseline.breakEmission.bodyParagraphDefaults;}
    return value;
  };
  const source=packet(beforeDocs,document,state);
  const afterDocs=[pending.bindNoteSourcePoints(pending.bindLedger(ledger(d(p('!AxxB tail')),[{...event(3,'insert',0,1),author:'Word editor'},{...event(4,'delete',2,4),author:'Word editor'}])),
    [{noteId:'note-left',paragraphIndex:0,offsetUtf16:2},{noteId:'note-right',paragraphIndex:0,offsetUtf16:4}]),beforeDocs[1],
    pending.bindNoteSourcePoints(pending.bindLedger(ledger(d(p('!oldnew tail')),[{...event(3,'insert',0,1),author:'Word editor'},event(1,'delete',1,4),event(2,'insert',4,7)])),[{noteId:'note-gamma',paragraphIndex:0,offsetUtf16:9}])];
  if(includeCodeBlock){const value=plain(pending.readLedger(afterDocs[0]));value.source.content.push(plain(codeBlock));afterDocs[0]=pending.bindLedger(value);}
  if(authoredRunLanguage)afterDocs.forEach((doc,i)=>{const old=pending.readLedger(doc),value=plain(old||doc);for(const node of (old?value.source:value).content[0].content)if(node.type==='text')node.marks=[{type:'textStyle',attrs:{fontFamily:'Georgia',fontSize:'14pt',wordLanguage:plain(authoredRunLanguage)}}];afterDocs[i]=old?pending.bindLedger(value):value;});
  if(bodyParagraphAttrs)afterDocs.forEach((doc,i)=>{const old=pending.readLedger(doc),value=plain(old||doc);(old?value.source:value).content[0].attrs=plain(bodyParagraphAttrs);afterDocs[i]=old?pending.bindLedger(value):value;});
  const afterNotes=plain(document),afterOffsets=[2,2,2,6],current=['!AB tail','Control Beta','!new tail'];
  if(includeCodeBlock)current[0]+='\nconst answer = 42;';
  afterNotes.notes.forEach((n,i)=>{n.manuscript.reference.offsetUtf16=afterOffsets[i];n.manuscript.reference.sourceTextSha256=hash(current[owners[i]]);});
  const afterState=plain(state);afterState.threads[0].anchor=exactAnchor({paragraphIndex:0,startUtf16:4,selectedText:'tail'},ids[0],current[0].split('\n'));
  afterState.threads[2].anchor=exactAnchor({paragraphIndex:0,startUtf16:2,selectedText:'e'},ids[2],[current[2]]);
  afterState.threads[1].messages.push({commentId:'foreign-reply',kind:'reply',body:'Foreign Beta reply retained',provenance:{author:'Beta editor'}});
  afterState.threads[2].messages.push({commentId:'gamma-reply',kind:'reply',body:'Gamma reply retained',provenance:{author:'Word editor'}});
  const afterSource=packet(afterDocs,afterNotes,afterState),bridge=await import('../../src/io/revisionBridge/index.mjs');
  const cryptoPort={sha256Text:hash,sha256Json:value=>'sha256:'+hash(JSON.stringify(value)),byteLength:value=>Buffer.byteLength(value)};
  const protectedSources=JSON.stringify({source,afterSource,beforeDocs,afterDocs});
  const originalParts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes(builder.buildDocxReviewPacketBuffer(source)).parts;
  const returnedParts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes(builder.buildDocxReviewPacketBuffer(afterSource)).parts;
  const originalXml=originalParts['word/document.xml'],returnedXml=returnedParts['word/document.xml'];
  const names=xml=>[...xml.matchAll(/<w:bookmarkStart\b[^>]*\bw:name="(YRTK_[^"]+)"[^>]*\/>/gu)].map(match=>match[1]);
  const originalNames=names(originalXml),returnedNames=names(returnedXml);
  const occurrence=map=>map.scenes.flatMap(scene=>scene.blocks.map((block,index)=>[scene.sceneId,index,block.documentParagraphIndex]));
  assert.deepEqual(occurrence(afterSource.localAuthorityCapsule.exportMap),occurrence(source.localAuthorityCapsule.exportMap));
  const declared=source.localAuthorityCapsule.exportMap.scenes.flatMap(scene=>scene.blocks.map(block=>block.wordSignals.filter(signal=>signal.kind==='bookmarkName')[0].value.name));
  assert.deepEqual(originalNames,declared);assert.equal(returnedNames.length,originalNames.length);
  const {extractTransportParagraphOwnershipV1}=await import('../../src/io/revisionBridge/reviewTransportPackageParserV2.mjs');
  const paragraphOwners=originalNames.map((_,index)=>[index]);
  assert.deepEqual(extractTransportParagraphOwnershipV1(originalXml,originalNames,{cryptoPort}),paragraphOwners);
  assert.deepEqual(extractTransportParagraphOwnershipV1(returnedXml,returnedNames,{cryptoPort}),paragraphOwners);
  // Word edits retain the original round's owned body bookmark occurrences.
  // The second producer supplies changed XML only, never replacement authority.
  let ordinal=0;
  returnedParts['word/document.xml']=returnedXml.replace(/<w:bookmarkStart\b[^>]*\bw:name="(YRTK_[^"]+)"[^>]*\/>/gu,(tag,name)=>{
    assert.equal(name,returnedNames[ordinal]);return tag.replace(`w:name="${name}"`,`w:name="${originalNames[ordinal++]}"`);
  });
  assert.equal(ordinal,originalNames.length);assert.deepEqual(names(returnedParts['word/document.xml']),originalNames);
  assert.deepEqual(extractTransportParagraphOwnershipV1(returnedParts['word/document.xml'],originalNames,{cryptoPort}),paragraphOwners);
  const bytes=buildStoredZip(Object.entries(returnedParts).map(([name,data])=>({name,data})));
  assert.equal(JSON.stringify({source,afterSource,beforeDocs,afterDocs}),protectedSources);
  const analysis=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},{cryptoPort});assert.equal(analysis.ok,true,JSON.stringify(analysis));
  const preview=bridge.buildDocxContentPreviewFromZipBytes(bytes);assert.equal(preview.ok,true);
  const parsed=bridge.buildDocxPendingCommentReturnDocumentsFromZipBytes({bytes,exportMap:source.localAuthorityCapsule.exportMap,baselineDocuments:ids.map((id,i)=>({sceneId:id,document:beforeDocs[i]})),
    retainPendingScenes:true,documentSections:source.documentSections,signedSectionsDigest:source.documentSections.protectedDigest});assert.equal(parsed.ok,true,JSON.stringify(parsed));
  const exportMap=plain(source.localAuthorityCapsule.exportMap);delete exportMap.commentExport;
  const noteContext={baseline:source.documentNotes,returnedNotes:bridge.parseDocumentNotesRichReturn(bytes,analysis.reviewIr.documentNotes,{includeBreakProjection:true}),
    returnedReferences:analysis.reviewIr.documentNotes.references,unionReferences:preview.contentPreview.pendingNoteReferences};
  const proof={schemaVersion:4,projectId,roundId:'book-notes-round',artifactSha256:'sha256:'+hash(bytes),baseline:source.commentExport,exportMap,noteContext,
    returnedScenes:parsed.scenes.map(s=>({sceneId:s.sceneId,ledger:pending.readLedger(s.returnedDocument)})),returnedThreads:analysis.reviewIr.commentThreads,
    returnedParagraphs:analysis.reviewIr.formattingParagraphs.map(({paragraphIndex,paragraphText,trackedRevision})=>({paragraphIndex,paragraphText,trackedRevision})),commentReturnInventory:analysis.reviewIr.commentReturnInventory};
  const scenes=ids.map((id,i)=>({sceneId:id,beforeContent:envelope.composeObservablePayload({doc:beforeDocs[i]})}));
  return {ids,beforeDocs,document,state,source,afterSource,afterDocs,afterNotes,bytes,bridge,analysis,preview,proof,scenes,notesText:JSON.stringify(document),beforeText:JSON.stringify(state),current,afterOffsets};
}
// A new producer is invoked with exactly one real source scene. Preserve that
// producer's signed carriers; the second producer supplies Word edits only.
async function singleFullManuscriptFixture({tracked=false,withNotes=true,ownedSceneId=sceneId,projectRoot='/project'}={}) {
  const makeSource=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js').buildFullManuscriptDocxReviewPacketSource;
  const {exactAnchor}=require('../../src/core/word-comment-authoring-v1.cjs');
  const ids=[ownedSceneId],event=(id,operation,from,to)=>({...revision(from,to,operation),id:'revision-'+id,nativeId:String(id),author:id===1?'Prior writer':'Word editor'});
  const sourceDoc=d(p('AxxB tail'),p(''),p('After empty paragraph'));
  let beforeDoc=tracked?pending.bindLedger(ledger(sourceDoc,[event(1,'delete',1,3)])):sourceDoc;
  const identities=['note-left','note-right','note-colocated'],rawOffsets=[1,3,1];
  if(tracked&&withNotes)beforeDoc=pending.bindNoteSourcePoints(beforeDoc,identities.map((noteId,i)=>({noteId,paragraphIndex:0,offsetUtf16:rawOffsets[i]})));
  const richBody=d({type:'paragraph',attrs:{wordParagraphSpacing:{before:0,after:120},wordParagraphMarkLanguage:{val:'ru-RU'}},content:[
    {type:'text',text:'Rich body',marks:[{type:'bold'},{type:'textStyle',attrs:{fontFamily:'Georgia',fontSize:'14pt',wordLanguage:{val:'ru-RU',eastAsia:'ja-JP',bidi:'he-IL'}}}]},
    {type:'hardBreak'},{type:'text',text:'kept'},{type:'hardBreak'}]},p(''),p('Final note paragraph'));
  const beforeTextValue=tracked?'AB tail':'AxxB tail';
  const document={schemaVersion:1,projectId,notes:(withNotes?identities:[]).map((id,i)=>({id,title:'',scope:'manuscript',body:notes.validateNoteBody(richBody).text,
    privateMetadata:{keep:'exact-'+id},manuscript:notes.bindManuscriptPayload({kind:i===1?'endnote':'footnote',body:richBody,sceneId:ownedSceneId,
      offsetUtf16:tracked?1:rawOffsets[i],sceneContent:envelope.composeObservablePayload({doc:beforeDoc})})}))};
  document.notes.push({id:'private-project-note',scope:'project',title:'Private',body:'Private text',privateMetadata:{keep:'private'}},
    {id:'foreign-manuscript-note',scope:'manuscript',title:'Foreign',body:'Foreign body',manuscript:notes.bindManuscriptPayload({kind:'footnote',body:d(p('Foreign body')),
      sceneId:'roman/foreign.txt',offsetUtf16:2,sceneContent:envelope.composeObservablePayload({doc:d(p('Foreign scene'))})})});
  const state={schemaVersion:'yalken.rtk.word.non-text-return-state.v1',projectId,revision:0,events:[],threads:[
    {threadId:'single-tail',rootCommentId:'single-root',sceneId:ownedSceneId,status:'open',anchor:exactAnchor({paragraphIndex:0,startUtf16:tracked?3:5,selectedText:'tail'},ownedSceneId,[beforeTextValue,'','After empty paragraph']),
      messages:[{commentId:'single-root',kind:'root',body:'Writer question',provenance:{author:'Writer'}}]},
    {threadId:'foreign-thread',rootCommentId:'foreign-root',sceneId:'roman/foreign.txt',status:'deleted',deleted:true,anchor:exactAnchor({paragraphIndex:0,startUtf16:0,selectedText:'Foreign'},'roman/foreign.txt',['Foreign scene']),
      messages:[{commentId:'foreign-root',kind:'root',body:'Foreign discussion',provenance:{author:'Another writer'}}]}]};
  const packet=(doc,notesDocument,nonTextReturnState)=>makeSource({projectId,projectRoot,notesDocument,nonTextReturnState,
    scenes:[{sceneId:ownedSceneId,scenePath:path.join(projectRoot,ownedSceneId),doc,text:envelope.deriveVisibleTextFromDocument(doc),observableContent:envelope.composeObservablePayload({doc}),order:0}]});
  const source=packet(beforeDoc,document,state),union=d(p('!AxxB tail'),p(''),p('After empty paragraph'));
  const revisions=tracked?[event(3,'insert',0,1),event(1,'delete',2,4),event(4,'delete',4,5)]:[event(3,'insert',0,1),event(4,'delete',2,4)];
  let afterDoc=pending.bindLedger(ledger(union,revisions));
  if(withNotes)afterDoc=pending.bindNoteSourcePoints(afterDoc,identities.map((noteId,i)=>({noteId,paragraphIndex:0,offsetUtf16:rawOffsets[i]+1})));
  const current=[(tracked?'!A tail':'!AB tail')+'\n\nAfter empty paragraph'],afterNotes=plain(document);
  for(const note of afterNotes.notes.filter(note=>identities.includes(note.id))) {note.manuscript.reference.offsetUtf16=2;note.manuscript.reference.sourceTextSha256=hash(current[0]);}
  const afterState=plain(state),thread=afterState.threads[0];
  thread.anchor=exactAnchor({paragraphIndex:0,startUtf16:tracked?3:4,selectedText:'tail'},ownedSceneId,current[0].split('\n'));
  thread.status='resolved';thread.messages.push({commentId:'single-reply',kind:'reply',body:'Editor reply',provenance:{author:'Editor'}});
  afterState.threads.push({threadId:'single-insert',rootCommentId:'single-insert-root',sceneId:ownedSceneId,status:'open',
    anchor:exactAnchor({paragraphIndex:0,startUtf16:0,selectedText:'!'},ownedSceneId,current[0].split('\n')),
    messages:[{commentId:'single-insert-root',kind:'root',body:'Inserted text discussion',provenance:{author:'Proofreader'}}]});
  const afterSource=packet(afterDoc,afterNotes,afterState),bridge=await import('../../src/io/revisionBridge/index.mjs');
  const cryptoPort={sha256Text:hash,sha256Json:value=>'sha256:'+hash(JSON.stringify(value)),byteLength:value=>Buffer.byteLength(value)};
  const originalBytes=builder.buildDocxReviewPacketBuffer(source),originalParts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes(originalBytes).parts;
  const editedParts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes(builder.buildDocxReviewPacketBuffer(afterSource)).parts;
  const parts={...originalParts};for(const [name,data] of Object.entries(editedParts))if(name.startsWith('word/'))parts[name]=data;
  const names=xml=>[...xml.matchAll(/<w:bookmarkStart\b[^>]*\bw:name="(YRTK_[^"]+)"[^>]*\/>/gu)].map(m=>m[1]);
  const ownedNames=names(originalParts['word/document.xml']),editedNames=names(parts['word/document.xml']);
  assert.equal(ownedNames.length,3);assert.equal(editedNames.length,3);
  let index=0;parts['word/document.xml']=parts['word/document.xml'].replace(/<w:bookmarkStart\b[^>]*\bw:name="(YRTK_[^"]+)"[^>]*\/>/gu,(tag,name)=>tag.replace(`w:name="${name}"`,`w:name="${ownedNames[index++]}"`));
  const bytes=buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data})));
  const analysis=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes,hmacSecret:source.forbiddenSecret,expectedAuthority:source.localAuthorityCapsule.expectedAuthority},
    {cryptoPort:{...cryptoPort,hmacSha256Json:(value,key)=>'hmac-sha256:'+crypto.createHmac('sha256',key).update(JSON.stringify(value)).digest('hex')}});
  assert.equal(analysis.ok,true,JSON.stringify(analysis));assert.equal(analysis.authorityCarrier.status,'verified-baseline-bound');
  const preview=bridge.buildDocxContentPreviewFromZipBytes(bytes);assert.equal(preview.ok,true,JSON.stringify(preview));
  const parsed=bridge.buildDocxPendingCommentReturnDocumentsFromZipBytes({bytes,exportMap:source.localAuthorityCapsule.exportMap,
    baselineDocuments:[{sceneId:ownedSceneId,document:beforeDoc}],retainPendingScenes:true,...(withNotes?{baselineDocumentNotes:source.documentNotes}:{}),
    documentSections:source.documentSections,signedSectionsDigest:source.documentSections.protectedDigest,cryptoPort});
  assert.equal(parsed.ok,true,JSON.stringify(parsed));
  const exportMap=plain(source.localAuthorityCapsule.exportMap);delete exportMap.commentExport;
  const proof={schemaVersion:withNotes?4:3,projectId,roundId:source.localAuthorityCapsule.roundId,artifactSha256:'sha256:'+hash(bytes),baseline:source.commentExport,exportMap,
    returnedScenes:parsed.scenes.map(s=>({sceneId:s.sceneId,ledger:pending.readLedger(s.returnedDocument)})),returnedThreads:analysis.reviewIr.commentThreads,
    returnedParagraphs:analysis.reviewIr.formattingParagraphs.map(({paragraphIndex,paragraphText,trackedRevision})=>({paragraphIndex,paragraphText,trackedRevision})),commentReturnInventory:analysis.reviewIr.commentReturnInventory,
    ...(withNotes?{noteContext:{baseline:source.documentNotes,returnedNotes:bridge.parseDocumentNotesRichReturn(bytes,analysis.reviewIr.documentNotes,{includeBreakProjection:true}),
      returnedReferences:analysis.reviewIr.documentNotes.references,unionReferences:preview.contentPreview.pendingNoteReferences}}:{})};
  const scenes=[{sceneId:ownedSceneId,beforeContent:envelope.composeObservablePayload({doc:beforeDoc})}];
  return {ids,beforeDocs:[beforeDoc],afterDocs:[afterDoc],document,state,source,afterSource,afterNotes,afterState,richBody,bytes,originalBytes,bridge,analysis,preview,proof,scenes,
    notesText:JSON.stringify(document),beforeText:JSON.stringify(state),current,afterOffsets:withNotes?[2,2,2]:[]};
}
test('complete book note law retains typed spacing/language/breaks and rejects every changed or unknown body field',async()=>{
  const f=await composedBookFixture(),input={document:f.document,projectId,baseline:f.proof.noteContext.baseline,exportMap:f.proof.exportMap,
    scenes:f.scenes.map((s,i)=>({sceneId:s.sceneId,document:f.beforeDocs[i],returnedDocument:pending.bindLedger(f.proof.returnedScenes[i].ledger)})),
    returnedNotes:f.proof.noteContext.returnedNotes,returnedReferences:f.proof.noteContext.returnedReferences,unionReferences:f.proof.noteContext.unionReferences};
  const result=delta.bindUnchangedBookPendingNotes(input);
  assert.deepEqual(pending.readLedger(result[0].beforeDoc).noteSourcePoints.map(p=>p.offsetUtf16),[1,3]);
  assert.deepEqual(pending.readLedger(result[0].returnedDoc).noteSourcePoints.map(p=>p.offsetUtf16),[2,4]);
  assert.deepEqual(pending.readLedger(result[2].returnedDoc).noteSourcePoints.map(p=>p.offsetUtf16),[9]);
  for(const mutate of [b=>b.content[0].attrs.wordParagraphSpacing.after++,b=>delete b.content[0].attrs.wordParagraphSpacing,
    b=>b.content[0].attrs.wordParagraphMarkLanguage.val='en-US',b=>b.content[0].content[1].marks=[{type:'bold'}],
    b=>b.content[0].content[0].marks[1].attrs.wordLanguage.bidi='ar-SA',b=>b.content[0].content[0].marks[1].attrs.fontFamily='Arial']) {
    const bad=plain(input);mutate(bad.returnedNotes[0].body);assert.throws(()=>delta.bindUnchangedBookPendingNotes(bad),/PENDING_NOTE_BODY_CHANGED|NOTE_BODY_BREAK/u);
  }
  for(const mutate of [x=>x.returnedNotes.pop(),x=>x.returnedNotes[0].transportIdentity='foreign',x=>x.returnedNotes[0].transportIdentity=x.returnedNotes[1].transportIdentity,
    x=>x.unionReferences[0].offsetUtf16++,x=>x.unionReferences[0].paragraphIndex=2,x=>x.returnedNotes[0].kind='endnote',
    x=>x.baseline.sourceBindings[0].documentParagraphIndex=2,x=>x.scenes.reverse(),x=>x.returnedNotes.push(plain(x.returnedNotes[0])),
    x=>x.unionReferences[2].nativeId=x.unionReferences[0].nativeId,x=>x.returnedReferences[2].nativeId=x.returnedReferences[0].nativeId,
    x=>x.baseline.sourceBindings[2].nativeId=x.baseline.sourceBindings[0].nativeId,
    x=>{for(const key of ['returnedNotes','returnedReferences','unionReferences'])[x[key][0],x[key][1]]=[x[key][1],x[key][0]];}]) {
    const bad=plain(input);mutate(bad);assert.throws(()=>delta.bindUnchangedBookPendingNotes(bad),/PENDING_NOTE_|NOTE_/u,String(mutate));
  }
});
test('inactive 720-to-708 tab emission requires complete local book-note bodies and returned identities',async()=>{
  // Execute the exact predecessor producer, which selects its own V1 law.
  // This observes compatibility; it grants no runtime round/write authority.
  const file=require.resolve('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js'),Module=require('node:module');
  const old=require('node:child_process').execFileSync('git',['show','42b7d2e930aac884b580bcbe8b2d6faa44ab9ac8:src/export/docx/fullManuscriptDocxReviewPacketSource.js'],{cwd:path.resolve(__dirname,'../..'),encoding:'utf8'});
  assert.equal(hash(old),'829fb5729f333a17a45ee06113ec0cbd07fffcf358b8b88b459f78f15294213d');
  const predecessor=new Module(file,module);predecessor.filename=file;predecessor.paths=Module._nodeModulePaths(path.dirname(file));predecessor._compile(old,file);
  const f=await composedBookFixture(null,{sourceFactory:predecessor.exports.buildFullManuscriptDocxReviewPacketSource}),original=f.bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:f.bytes}).parts;
  const pack=parts=>buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data})));
  assert.equal(f.source.exportTypography,undefined,'predecessor packet retains its original top-level shape');
  assert.equal(f.source.localAuthorityCapsule.exportMap.exportTypography.schemaVersion,'yalken.review-docx.typography-defaults.v1');
  assert.doesNotMatch(original['word/settings.xml'],/<w:defaultTabStop\b/u);
  assert.ok(f.source.localAuthorityCapsule.exportMap.scenes.every(scene=>scene.documentFormatIr.explicit===false&&scene.documentFormatIr.wordDefaultTabStop===720));
  const parts={...original,'word/settings.xml':original['word/settings.xml'].replace('</w:settings>','<w:defaultTabStop w:val="708"/></w:settings>')},bytes=pack(parts);
  const input={bytes,exportMap:f.source.localAuthorityCapsule.exportMap,baselineDocuments:f.ids.map((sceneId,i)=>({sceneId,document:f.beforeDocs[i]})),
    baselineDocumentNotes:f.source.documentNotes,documentSections:f.source.documentSections,signedSectionsDigest:f.source.documentSections.protectedDigest,
    allowInactiveDefaultTabEmission:true,retainPendingScenes:true};
  const result=f.bridge.buildDocxPendingCommentReturnDocumentsFromZipBytes(input);
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.deepEqual(result.scenes,f.proof.returnedScenes.map(scene=>({sceneId:scene.sceneId,returnedDocument:pending.bindLedger(scene.ledger)})));
  const refuse=value=>{const result=f.bridge.buildDocxPendingCommentReturnDocumentsFromZipBytes(value);assert.equal(result.ok,false,JSON.stringify(result));};
  for(const mutate of [x=>delete x.baselineDocumentNotes,x=>x.baselineDocumentNotes=null,x=>x.allowInactiveDefaultTabEmission=false,
    x=>x.baselineDocumentNotes.sourceBindings.pop(),x=>x.baselineDocumentNotes.sourceBindings[0].richBody=null,
    x=>x.baselineDocumentNotes.projectId='foreign',x=>x.baselineDocumentNotes.policy='READ_ONLY',x=>x.baselineDocumentNotes.protectedDigest='sha256:'+'0'.repeat(64),
    x=>x.baselineDocumentNotes.sourceBindings[0].transportIdentity=x.baselineDocumentNotes.sourceBindings[1].transportIdentity,
    x=>x.baselineDocumentNotes.sourceBindings[0].nativeId=x.baselineDocumentNotes.sourceBindings[2].nativeId,
    x=>x.baselineDocumentNotes.sourceBindings[0].sceneId='foreign.txt',x=>x.baselineDocumentNotes.sourceBindings[0].paragraphs[0]='changed',
    x=>x.exportMap.scenes[0].documentFormatIr.explicit=true,x=>x.exportMap.scenes[0].documentFormatIr.wordDefaultTabStop=709,
    x=>x.baselineDocuments[1].document.content[0].content[0].text+='\t']) {
    const bad={...input,exportMap:plain(input.exportMap),baselineDocuments:plain(input.baselineDocuments),baselineDocumentNotes:plain(input.baselineDocumentNotes)};
    mutate(bad);refuse(bad);
  }
  // A complete, coherently hashed local note baseline with an actual tab is
  // still active. Missing/altered rich-body fields cannot hide that carrier.
  const bad={...input,baselineDocumentNotes:plain(input.baselineDocumentNotes)},baseline=bad.baselineDocumentNotes;
  baseline.sourceBindings[0].richBody.content[0].content[0].text+='\t';
  baseline.sourceBindings[0].paragraphs=notes.validateNoteBody(baseline.sourceBindings[0].richBody).paragraphs.map(row=>row.paragraph.content.map(node=>node.type==='hardBreak'?'\n':node.text).join(''));
  baseline.notes[0].paragraphs=plain(baseline.sourceBindings[0].paragraphs);
  const stable=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
  baseline.protectedDigest='sha256:'+hash(stable({schemaVersion:baseline.schemaVersion,notes:baseline.notes}));refuse(bad);
  const listed={...input,baselineDocumentNotes:plain(input.baselineDocumentNotes)};
  listed.baselineDocumentNotes.sourceBindings[0].richBody.content=[{type:'bulletList',content:[{type:'listItem',content:listed.baselineDocumentNotes.sourceBindings[0].richBody.content}]}];
  assert.ok(notes.validateNoteBody(listed.baselineDocumentNotes.sourceBindings[0].richBody).paragraphs[0].list);refuse(listed);
  for(const [name,carrier] of [['word/document.xml','<w:tab/>'],['word/document.xml','<alias:tab xmlns:alias="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>'],
    ['word/footnotes.xml','<w:tab/>'],['word/endnotes.xml','<w:tab/>'],['word/footnotes.xml','<w:t>&#x9;</w:t>'],['word/endnotes.xml','<w:t>&#0009;</w:t>']]) {
    const changed={...parts,[name]:parts[name].replace('</w:r>',carrier+'</w:r>')};assert.notEqual(changed[name],parts[name]);refuse({...input,bytes:pack(changed)});
  }
  for(const defaultTab of [719,721])refuse({...input,bytes:pack({...parts,'word/settings.xml':parts['word/settings.xml'].replace('w:val="708"',`w:val="${defaultTab}"`)})});
  for(const kind of ['header','footer'])refuse({...input,bytes:pack({...parts,[`word/${kind}1.xml`]:`<w:${kind==='header'?'hdr':'ftr'} xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p/></w:${kind==='header'?'hdr':'ftr'}>`})});
});
test('fresh body720 book-note transport preserves all raw source and refuses a genuine single708 setting edit',async()=>{
 const f=await composedBookFixture(),parts=f.bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:f.bytes}).parts;
 const protectedRaw=JSON.stringify({scenes:f.scenes,beforeDocs:f.beforeDocs,notes:f.notesText,source:f.source.localAuthorityCapsule.exportMap});
 assert.equal(f.source.exportTypography.schemaVersion,'yalken.review-docx.typography-defaults.v2');
 assert.match(parts['word/settings.xml'],/<w:defaultTabStop w:val="720"\/>/u);
 const input={bytes:f.bytes,exportMap:f.source.localAuthorityCapsule.exportMap,baselineDocuments:f.ids.map((sceneId,i)=>({sceneId,document:f.beforeDocs[i]})),
  baselineDocumentNotes:f.source.documentNotes,documentSections:f.source.documentSections,signedSectionsDigest:f.source.documentSections.protectedDigest,
  allowInactiveDefaultTabEmission:true,retainPendingScenes:true};
 const unchanged=f.bridge.buildDocxPendingCommentReturnDocumentsFromZipBytes(input);assert.equal(unchanged.ok,true,JSON.stringify(unchanged));
 assert.deepEqual(unchanged.scenes,f.proof.returnedScenes.map(scene=>({sceneId:scene.sceneId,returnedDocument:pending.bindLedger(scene.ledger)})));
 parts['word/settings.xml']=parts['word/settings.xml'].replace('<w:defaultTabStop w:val="720"/>','<w:defaultTabStop w:val="708"/>');
 const changed=buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data}))),refused=f.bridge.buildDocxPendingCommentReturnDocumentsFromZipBytes({...input,bytes:changed});
 assert.equal(refused.ok,false);assert.equal(refused.code,'PENDING_COMMENT_DOCUMENT_FORMAT_CHANGED');
 assert.equal(JSON.stringify({scenes:f.scenes,beforeDocs:f.beforeDocs,notes:f.notesText,source:f.source.localAuthorityCapsule.exportMap}),protectedRaw);
});
test('book note styles resolve completely while no-notes styles and global defaults remain byte-exact',async()=>{
  const f=await composedBookFixture(null,{legacyNoteProfile:true}),parts=f.bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:f.bytes}).parts;
  const styles=parts['word/styles.xml'],definitions=[...styles.matchAll(/<w:style\b[^>]*w:styleId="([^"]+)"[^>]*>[\s\S]*?<\/w:style>/gu)];
  const ids=new Set(definitions.map(match=>match[1]));assert.equal(ids.size,definitions.length);
  for(const [kind,type] of [['Text','paragraph'],['Reference','character']])for(const prefix of ['Footnote','Endnote']){
    const id=prefix+kind,definition=definitions.find(match=>match[1]===id)?.[0];
    assert.equal(definition,`<w:style w:type="${type}" w:styleId="${id}"><w:name w:val="${prefix} ${kind}"/></w:style>`);
  }
  for(const part of ['word/document.xml','word/footnotes.xml','word/endnotes.xml'])
    for(const match of parts[part].matchAll(/<w:(?:pStyle|rStyle)\b[^>]*w:val="([^"]+)"/gu))assert.ok(ids.has(match[1]),part+' unresolved '+match[1]);
  for(const match of styles.matchAll(/<w:(?:basedOn|link|next)\b[^>]*w:val="([^"]+)"/gu))assert.ok(ids.has(match[1]),'unresolved style inheritance');
  const noNotes=builder.buildDocxReviewPacketBuffer({...f.afterSource,documentNotes:null});
  const clean=f.bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:noNotes}).parts['word/styles.xml'];
  assert.equal(styles.replace(/  <w:style w:type="paragraph" w:styleId="FootnoteText">[\s\S]*?<w:style w:type="character" w:styleId="EndnoteReference">[\s\S]*?<\/w:style>\n/u,''),clean);
  assert.equal(clean.match(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/u)[0],'<w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults>');
});
test('actual ZIP book note break formatting is retained and every altered or forged complete projection refuses',async()=>{
  const body=d({type:'paragraph',content:[{type:'text',text:'😀X'},{type:'hardBreak'},{type:'text',text:'😀X'},{type:'hardBreak'},{type:'text',text:'last'}]},
    {type:'paragraph',content:[{type:'text',text:'kept'},{type:'hardBreak'}]});
  const f=await composedBookFixture(body,{legacyNoteProfile:true}),input={document:f.document,projectId,baseline:f.proof.noteContext.baseline,exportMap:f.proof.exportMap,
    scenes:f.scenes.map((s,i)=>({sceneId:s.sceneId,document:f.beforeDocs[i],returnedDocument:pending.bindLedger(f.proof.returnedScenes[i].ledger)})),
    returnedNotes:f.proof.noteContext.returnedNotes,returnedReferences:f.proof.noteContext.returnedReferences,unionReferences:f.proof.noteContext.unionReferences};
  const format={marks:[],boldCs:false,italicCs:false,forceCs:false,rtl:false,fontSize:'12pt',fontSizeCs:'12pt'};
  const expected={schemaVersion:1,paragraphCount:2,textSha256:hash('😀X\n😀X\nlast\nkept\n'),breaks:[{paragraphIndex:0,offsetUtf16:3,kind:'line',format},
    {paragraphIndex:0,offsetUtf16:7,kind:'line',format},{paragraphIndex:1,offsetUtf16:4,kind:'line',format}]};
  assert.deepEqual(input.returnedNotes.map(note=>note.breakProjection),Array(4).fill(expected));delta.bindUnchangedBookPendingNotes(input);
  const original=f.bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:f.bytes}).parts;
  const readParts=parts=>{
    const bytes=buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data}))),analysis=f.bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},
      {cryptoPort:{sha256Text:hash,sha256Json:value=>'sha256:'+hash(JSON.stringify(value)),byteLength:value=>Buffer.byteLength(value)}});
    assert.equal(analysis.ok,true,JSON.stringify({code:analysis.code,reasons:analysis.reasons}));
    return f.bridge.parseDocumentNotesRichReturn(bytes,analysis.reviewIr.documentNotes,{includeBreakProjection:true});
  };
  const readback=properties=>{
    const parts={...original};parts['word/footnotes.xml']=parts['word/footnotes.xml'].replace('<w:r><w:br/></w:r>',`<w:r><w:rPr>${properties}</w:rPr><w:br/></w:r>`);
    assert.notEqual(parts['word/footnotes.xml'],original['word/footnotes.xml'],'actual ZIP corruption target');return readParts(parts);
  };
  const legacy=f.bridge.parseDocumentNotesRichReturn(f.bytes,f.analysis.reviewIr.documentNotes);
  assert.equal(Object.hasOwn(legacy[0],'breakProjection'),false);assert.deepEqual(legacy[0].body,input.returnedNotes[0].body);
  const materialized=readback('<w:sz w:val="24"/><w:szCs w:val="24"/>');
  assert.deepEqual(materialized[0].breakProjection,expected);delta.bindUnchangedBookPendingNotes({...input,returnedNotes:materialized});
  for(const properties of ['<w:b w:val="1"/>','<w:bCs w:val="1"/>','<w:iCs w:val="1"/>','<w:color w:val="FF0000"/>','<w:highlight w:val="yellow"/>',
    '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>','<w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:eastAsia="Arial" w:cs="Georgia"/>',
    '<w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:eastAsia="Georgia" w:cs="Arial"/>','<w:szCs w:val="28"/>',
    ...['val','eastAsia','bidi'].map(field=>`<w:lang w:${field}="en-GB"/>`),'<w:rtl w:val="1"/>']) {
    const returnedNotes=readback(properties);assert.deepEqual(returnedNotes[0].body,input.returnedNotes[0].body,'old lossy body is unchanged');
    assert.notDeepEqual(returnedNotes[0].breakProjection,expected,properties);assert.throws(()=>delta.bindUnchangedBookPendingNotes({...input,returnedNotes}),/PENDING_NOTE_BREAK_CHANGED/u);
  }
  for(const properties of ['<w:vertAlign w:val="superscript"/>','<w:b w:val="0"/><w:b w:val="0"/>','<w:color w:val="auto" w:unknown="1"/>'])
    assert.throws(()=>readback(properties),/NOTE_BREAK_PROPERTY_UNSUPPORTED/u);
  for(const mutate of [parts=>{parts['word/styles.xml']=parts['word/styles.xml'].replace(/<w:style w:type="paragraph" w:styleId="FootnoteText">[\s\S]*?<\/w:style>/u,'');},
    parts=>{parts['word/styles.xml']=parts['word/styles.xml'].replace('<w:name w:val="Footnote Text"/>','<w:name w:val="Footnote Text"/><w:rPr><w:vertAlign w:val="superscript"/></w:rPr>');},
    parts=>{parts['word/styles.xml']=parts['word/styles.xml'].replace('<w:name w:val="Footnote Text"/>','<w:name w:val="Footnote Text"/><w:pPr><w:keepNext/></w:pPr>');},
    parts=>{parts['word/footnotes.xml']=parts['word/footnotes.xml'].replace('</w:pPr>','<w:keepNext/></w:pPr>');}]) {
    const parts={...original};mutate(parts);assert.notDeepEqual(parts,original);assert.throws(()=>readParts(parts),/NOTE_BREAK_STYLE_INVALID|NOTE_BREAK_PARAGRAPH_UNSUPPORTED/u);
  }
  for(const mutate of [x=>delete x.returnedNotes[0].breakProjection,x=>x.returnedNotes[0].breakProjection.breaks.pop(),x=>x.returnedNotes[0].breakProjection.breaks.push(plain(x.returnedNotes[0].breakProjection.breaks[0])),
    x=>x.returnedNotes[0].breakProjection.breaks[0].offsetUtf16++,x=>x.returnedNotes[0].breakProjection.breaks[0].paragraphIndex++,x=>x.returnedNotes[0].breakProjection.extra=true,
    x=>x.returnedNotes[0].breakProjection.paragraphCount++,x=>x.returnedNotes[0].breakProjection.textSha256='0'.repeat(64),
    x=>delete x.baseline.breakEmission,x=>x.baseline.breakEmission.fontSize='14pt',x=>x.baseline.breakEmission.wordLanguage={val:'en-US'}]) {
    const bad=plain(input);mutate(bad);assert.throws(()=>delta.bindUnchangedBookPendingNotes(bad),/PENDING_NOTE_BREAK_/u);
  }
});
test('closed v2 note styles survive Word defaults and zero omission while source fields and every effective break remain guarded',async()=>{
  const f=await composedBookFixture(null,{noteProfileV2:true}),baseline=f.source.documentNotes,input={document:f.document,projectId,baseline,exportMap:f.proof.exportMap,
    scenes:f.scenes.map((s,i)=>({sceneId:s.sceneId,document:f.beforeDocs[i],returnedDocument:pending.bindLedger(f.proof.returnedScenes[i].ledger)})),
    returnedNotes:f.proof.noteContext.returnedNotes,returnedReferences:f.proof.noteContext.returnedReferences,unionReferences:f.proof.noteContext.unionReferences};
  assert.deepEqual(baseline.breakEmission,{schemaVersion:2,fontSize:'12pt',fontFamily:'Times New Roman',
    wordLanguage:{val:'en-US',eastAsia:'en-US',bidi:'en-US'},paragraphSpacing:{before:0,after:0,line:240,lineRule:'auto'}});
  assert.deepEqual(f.document.notes.map(n=>n.manuscript.body),f.afterNotes.notes.map(n=>n.manuscript.body));
  delta.bindUnchangedBookPendingNotes(input);
  const original=f.bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:f.bytes}).parts;
  const read=parts=>{
    const bytes=buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data}))),analysis=f.bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},
      {cryptoPort:{sha256Text:hash,sha256Json:value=>'sha256:'+hash(JSON.stringify(value)),byteLength:value=>Buffer.byteLength(value)}});
    assert.equal(analysis.ok,true,JSON.stringify(analysis));return f.bridge.parseDocumentNotesRichReturn(bytes,analysis.reviewIr.documentNotes,{includeBreakProjection:true});
  };
  const word={...original};
  // Independently emulate the observed Save As: defaults differ, zero values
  // vanish, and note style identifiers change. Source-owned style fields win.
  word['word/styles.xml']=word['word/styles.xml'].replace('<w:rPrDefault><w:rPr>','<w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:lang w:val="ru-FI" w:eastAsia="ru-RU" w:bidi="ar-SA"/>')
    .replace('</w:docDefaults>','<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="278" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>');
  for(const name of ['word/styles.xml','word/footnotes.xml','word/endnotes.xml'])word[name]=word[name].replaceAll('w:before="0"','').replaceAll('FootnoteText','WordFootnote').replaceAll('EndnoteText','WordEndnote');
  const returned=read(word);delta.bindUnchangedBookPendingNotes({...input,returnedNotes:returned});
  assert.deepEqual(returned.map(n=>n.breakProjection),input.returnedNotes.map(n=>n.breakProjection));
  for(const properties of ['<w:b/>','<w:color w:val="FF0000"/>','<w:rFonts w:ascii="Arial"/>','<w:rFonts w:eastAsia="Arial"/>',
    '<w:rFonts w:cs="Arial"/>','<w:sz w:val="28"/>',...['val','eastAsia','bidi'].map(field=>`<w:lang w:${field}="en-GB"/>`)]) {
    const bad={...word,'word/footnotes.xml':word['word/footnotes.xml'].replace('<w:r><w:br/></w:r>',`<w:r><w:rPr>${properties}</w:rPr><w:br/></w:r>`)};
    assert.notEqual(bad['word/footnotes.xml'],word['word/footnotes.xml']);
    assert.throws(()=>delta.bindUnchangedBookPendingNotes({...input,returnedNotes:read(bad)}),/PENDING_NOTE_BREAK_CHANGED/u,properties);
  }
  const inherited={...word,'word/styles.xml':word['word/styles.xml'].replace('<w:spacing w:after="160"','<w:spacing w:before="75" w:after="160"')};
  assert.throws(()=>delta.bindUnchangedBookPendingNotes({...input,returnedNotes:read(inherited)}),/PENDING_NOTE_BODY_CHANGED/u);
  for(const mutate of [e=>e.fontFamily='Arial',e=>e.fontSize='14pt',e=>e.wordLanguage.bidi='ar-SA',e=>e.paragraphSpacing.line=278,e=>e.schemaVersion=3,e=>e.extra=true]) {
    const bad=plain(baseline);mutate(bad.breakEmission);
    assert.throws(()=>delta.bindUnchangedBookPendingNotes({...input,baseline:bad}),/PENDING_NOTE_BREAK_BASELINE_REQUIRED/u);
    assert.throws(()=>builder.buildDocxReviewPacketBuffer({...f.afterSource,documentNotes:bad}),/DOCX_NOTE_EMISSION_INVALID/u);
  }
  const make=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js').buildFullManuscriptDocxReviewPacketSource;
  const ordinary=make({projectId,projectRoot:'/project',notesDocument:f.document,nonTextReturnState:{...f.state,threads:[]},scenes:f.ids.map((sceneId,i)=>({sceneId,scenePath:'/project/'+sceneId,order:i,
    doc:f.beforeDocs[i],text:envelope.deriveVisibleTextFromDocument(f.beforeDocs[i]),observableContent:envelope.composeObservablePayload({doc:f.beforeDocs[i]})}))});
  assert.deepEqual(ordinary.documentNotes.breakEmission,baseline.breakEmission);
});
test('closed v3 emission pins body pPr without granting fallback fields canonical ownership or accepting altered profile',async()=>{
  const f=await composedBookFixture(),parts=f.bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:f.bytes}).parts;
  const profile={wordParagraphSpacing:{before:0,after:0,line:240,lineRule:'auto'},wordParagraphMarkLanguage:{val:'en-US',eastAsia:'en-US',bidi:'en-US'}};
  assert.deepEqual(f.source.documentNotes.breakEmission.bodyParagraphDefaults,profile);
  assert.equal(f.source.documentNotes.breakEmission.schemaVersion,3);
  for(const paragraph of parts['word/document.xml'].matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/gu)){
    assert.match(paragraph[0],/<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"\/>/u);
    assert.match(paragraph[0],/<w:lang w:val="en-US" w:eastAsia="en-US" w:bidi="en-US"\/>/u);
  }
  assert.ok(f.source.localAuthorityCapsule.exportMap.scenes.every(scene=>scene.blocks.every(block=>block.formatIr.paragraph.wordParagraphSpacing===undefined&&block.formatIr.paragraph.wordParagraphMarkLanguage===undefined)));
  const input={document:f.document,projectId,baseline:f.proof.noteContext.baseline,exportMap:f.proof.exportMap,
    scenes:f.scenes.map((s,i)=>({sceneId:s.sceneId,document:f.beforeDocs[i],returnedDocument:pending.bindLedger(f.proof.returnedScenes[i].ledger)})),
    returnedNotes:f.proof.noteContext.returnedNotes,returnedReferences:f.proof.noteContext.returnedReferences,unionReferences:f.proof.noteContext.unionReferences};
  assert.deepEqual(delta.bindUnchangedBookPendingNotes(input).map(b=>b.bodyParagraphEmission),Array(3).fill(profile));
  for(const mutate of [e=>delete e.bodyParagraphDefaults,e=>e.bodyParagraphDefaults.wordParagraphSpacing.line=278,
    e=>delete e.bodyParagraphDefaults.wordParagraphSpacing.before,e=>e.bodyParagraphDefaults.wordParagraphMarkLanguage.bidi='ar-SA',
    e=>e.bodyParagraphDefaults.extra=true,e=>e.schemaVersion=4,e=>e.extra=true]){
    const baseline=plain(input.baseline);mutate(baseline.breakEmission);
    assert.throws(()=>delta.bindUnchangedBookPendingNotes({...input,baseline}),/PENDING_NOTE_BREAK_BASELINE_REQUIRED/u);
    assert.throws(()=>builder.buildDocxReviewPacketBuffer({...f.afterSource,documentNotes:baseline}),/DOCX_NOTE_EMISSION_INVALID/u);
  }
});
test('Return note points preserve semantic ownership across pending and resolved export bases, not raw union offsets',()=>{
  for(const state of ['pending','accepted','rejected']) {
    const prior=pending.bindNoteSourcePoints(pending.bindLedger(ledger(d(p('Axx NOTE Z')),[{...revision(1,3,'insert'),state}])),[{noteId:'note-1',paragraphIndex:0,offsetUtf16:5}]);
    const old=pending.readLedger(prior),basis=pending.exportNoteBasis(old),incoming=plain(basis);
    incoming.source.content[0].content[0].text='!'+incoming.source.content[0].content[0].text;
    incoming.revisions.forEach(r=>{r.from++;r.to++;});incoming.revisions.unshift({...revision(0,1,'insert'),id:'revision-2',nativeId:'52'});
    const exportedPoint=pending.projectSourcePoint(old,old.noteSourcePoints[0],'export');
    const returned=pending.bindNoteSourcePoints(pending.bindLedger({...incoming,schemaVersion:2,roundUndo:[],roundRedo:[],returnReceipts:[]}),[{noteId:'note-1',paragraphIndex:0,offsetUtf16:exportedPoint.offsetUtf16+1}]);
    const receipt={roundId:'note-return-'+state,artifactSha256:'a'.repeat(64)},result=pending.replaceFromReturn(prior,returned,receipt);
    assert.equal(result.changed,true);assert.deepEqual(pending.readLedger(result.doc).noteSourcePoints,pending.readLedger(returned).noteSourcePoints);
    const undone=pending.decide(result.doc,{action:'undo'}).doc;assert.deepEqual(pending.roundFrame(pending.readLedger(undone)),pending.roundFrame(old));
    const redone=pending.decide(undone,{action:'redo'}).doc;assert.deepEqual(redone,result.doc);
    // Replay retains the entire current document even if a clean incoming
    // preview no longer carries source-point bindings after local decisions.
    assert.deepEqual(pending.replaceFromReturn(result.doc,pending.bindLedger(basis),receipt),{changed:false,replay:true,doc:result.doc});
    for(const kind of ['missing','foreign','extra','moved','duplicate']) {
      const forged=plain(pending.readLedger(returned));
      if(kind==='missing'){delete forged.noteSourcePoints;forged.schemaVersion=2;}
      if(kind==='foreign')forged.noteSourcePoints[0].noteId='other-note';
      if(kind==='extra')forged.noteSourcePoints.push({...forged.noteSourcePoints[0],noteId:'other-note'});
      if(kind==='moved')forged.noteSourcePoints[0].offsetUtf16++;
      if(kind==='duplicate')forged.noteSourcePoints.push(plain(forged.noteSourcePoints[0]));
      assert.throws(()=>pending.replaceFromReturn(prior,pending.bindLedger(forged),{roundId:'forged-note',artifactSha256:'b'.repeat(64)}),/PENDING_NOTE_(?:REVISION_UNSUPPORTED|POINTS_INVALID)/u,kind+' '+state);
    }
  }
});
function notesFor(doc, offsets) {
  const raw = envelope.composeObservablePayload({ doc });
  return { schemaVersion: 1, projectId, notes: offsets.map((offsetUtf16, i) => ({ id: 'note-' + i, title: '', scope: 'manuscript', body: 'Body 😀',
    manuscript: notes.bindManuscriptPayload({ kind: i % 2 ? 'endnote' : 'footnote', body: d(p('Body 😀')), sceneId, offsetUtf16, sceneContent: raw }) })) };
}
async function sourceHarness(raw, notesDocument, changes = {}) {
  const file = path.join(__dirname, 'rtk-word-c2-rich-scene-reexport.contract.test.js');
  const text = fs.readFileSync(file, 'utf8').split('\nfunction doc(paragraphs)')[0] + '\nmodule.exports={harness};';
  const mod = { exports: {} }; new Function('require', 'module', '__dirname', text)(createRequire(file), mod, __dirname);
  const h = await mod.exports.harness(raw, { notesDocument, ...changes });
  const mainPath = require.resolve('../../src/main.js'), main = fs.readFileSync(mainPath, 'utf8');
  h.context.require = createRequire(mainPath);
  for (const name of ['scenePendingExportSemantics', 'buildSceneNoteReviewPublicationGate', 'docxReviewReturnIntakeProductBudgets'])
    vm.runInContext(main.match(new RegExp('(?:async )?function ' + name + '\\([^]*?\\n}(?=\\n|$)'))[0], h.context);
  vm.runInContext(main.match(/const DOCX_REVIEW_RETURN_INTAKE_FULL_MANUSCRIPT_PRODUCT_BUDGETS = Object.freeze\([^]*?\n}\);/)[0], h.context);
  return h;
}
async function decode(bytes, source, h) {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const analysis = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes, hmacSecret: source.forbiddenSecret,
    expectedAuthority: source.localAuthorityCapsule.expectedAuthority }, { cryptoPort: h.context.createRtkReviewTransportCryptoPort() });
  assert.equal(analysis.ok, true, JSON.stringify(analysis.reasons));
  assert.equal(analysis.authorityCarrier.status, 'verified-baseline-bound');
  const preview = bridge.buildDocxContentPreviewFromZipBytes(bytes);
  assert.equal(preview.ok, true, JSON.stringify(preview));
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(preview);
  assert.equal(plan.ok, true, JSON.stringify(plan));
  return { bridge, analysis, preview, doc: envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc };
}
test('source points distinguish both deletion boundaries across round undo, decisions, restart and Core note cohort', async () => {
  const original = d(p('AxxB')), beforeNotes = notesFor(original, [1, 3]);
  const points = beforeNotes.notes.map((n, i) => ({ noteId: n.id, paragraphIndex: 0, offsetUtf16: [1, 3][i] }));
  const before = pending.bindNoteSourcePoints(original, points);
  const incoming = pending.bindNoteSourcePoints(pending.bindLedger(ledger(original, [revision(1, 3)])), points);
  const receipt={roundId:'round-a',artifactSha256:'a'.repeat(64)},producer=await sourceHarness(envelope.composeObservablePayload({doc:original}),beforeNotes),source=await producer.run();
  const ownBytes=builder.buildDocxReviewPacketBuffer(source), own=await decode(ownBytes,source,producer);
  const proof={schemaVersion:1,projectId,sceneId,baseline:source.documentNotes,exportMap:source.localAuthorityCapsule.exportMap,returnedDoc:incoming,receipt,
    returnedNotes:own.bridge.parseDocumentNotesRichReturn(ownBytes,own.analysis.reviewIr.documentNotes,{includeBreakProjection:true}),
    unionReferences:points.map((point,i)=>({kind:beforeNotes.notes[i].manuscript.kind,nativeId:source.documentNotes.sourceBindings[i].nativeId,paragraphIndex:0,offsetUtf16:point.offsetUtf16}))};
  let doc = pending.replaceFromReturn(before, incoming, receipt).doc;
  let previous = original, state = beforeNotes;
  const observe = expected => {
    const beforeContent = envelope.composeObservablePayload({ doc: previous }), afterContent = envelope.composeObservablePayload({ doc });
    const cohort = notes.planManuscriptNoteAnchorSave({ beforeText: JSON.stringify(state), projectId, sceneId, beforeContent, afterContent,
      ...(previous===original?{pendingNoteReturnProofJson:JSON.stringify(proof)}:{}) });
    if (cohort) { notes.validateNoteCohort(cohort, { projectId, sceneId, beforeContent, afterContent }); state = JSON.parse(cohort.afterText); }
    assert.deepEqual(state.notes.map(n => n.manuscript.reference.offsetUtf16), expected);
    assert.deepEqual(state.notes.map(n => n.manuscript.body), beforeNotes.notes.map(n => n.manuscript.body));
    doc = envelope.parseObservablePayload(afterContent).doc; pending.readLedger(doc); previous = doc;
  };
  const proofJson=JSON.stringify(proof),cap=32*1024*1024,exact=proofJson+' '.repeat(cap-Buffer.byteLength(proofJson));
  const args={beforeText:JSON.stringify(beforeNotes),projectId,sceneId,beforeContent:envelope.composeObservablePayload({doc:original}),afterContent:envelope.composeObservablePayload({doc})};
  const normal=notes.planManuscriptNoteAnchorSave({...args,pendingNoteReturnProofJson:proofJson});
  const full=notes.planManuscriptNoteAnchorSave({...args,pendingNoteReturnProofJson:exact});
  assert.deepEqual({...full,pendingNoteReturnProofJson:proofJson},normal);notes.validateNoteCohort(full,args);
  assert.throws(()=>notes.planManuscriptNoteAnchorSave({...args,pendingNoteReturnProofJson:exact+' '}),e=>e.code==='NOTE_RETURN_PROOF_BUDGET');
  const forged=structuredClone(proof);forged.baseline.stateDigest='0'.repeat(64);
  assert.throws(()=>notes.planManuscriptNoteAnchorSave({...args,pendingNoteReturnProofJson:JSON.stringify(forged)+' '.repeat(9*1024*1024)}),/PENDING_NOTE_/);
  assert.equal(JSON.stringify(proof),proofJson);
  observe([1,1]);
  for (const [action, expected] of [['rejectAll',[1,3]],['undo',[1,1]],['acceptAll',[1,1]],['undo',[1,1]],['undo',[1,3]],['redo',[1,1]]]) {
    doc = pending.decide(doc, { action }).doc; observe(expected);
  }
  assert.throws(() => pending.bindNoteSourcePoints(incoming, [{ noteId:'bad', paragraphIndex:0, offsetUtf16:2 }]), /REFERENCE_CONSUMED/);
  assert.deepEqual(pending.readLedger(require('../../src/core/word-pending-recording-v1.cjs').prepare(doc).baseline).noteSourcePoints,
    pending.readLedger(doc).noteSourcePoints);
});

test('fresh single-scene clean and pending producers own complete V2 note meaning without changing authored bodies', async () => {
  const body=d({type:'paragraph',attrs:{wordParagraphSpacing:{after:120},wordParagraphMarkLanguage:{val:'ru-RU'}},content:[
    {type:'text',text:'Rich 😀',marks:[{type:'bold'},{type:'textStyle',attrs:{fontFamily:'Georgia',fontSize:'14pt',wordLanguage:{val:'ru-RU'}}}]},
    {type:'hardBreak'},{type:'text',text:'kept'}]});
  for(const tracked of [false,true]) {
    const original=d(p('AxxB')), points=[{noteId:'note-0',paragraphIndex:0,offsetUtf16:1},{noteId:'note-1',paragraphIndex:0,offsetUtf16:3}];
    const doc=tracked?pending.bindNoteSourcePoints(pending.bindLedger(ledger(original,[revision(1,3)])),points):original;
    const document=notesFor(doc,tracked?[1,1]:[1,3]);
    document.notes.forEach(note=>{note.manuscript.body=plain(body);note.body=notes.validateNoteBody(body).text;note.privateMetadata={keep:'exact'};});
    const raw=envelope.composeObservablePayload({doc}), h=await sourceHarness(raw,document), mainSource=await h.run();
    const fullSource=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js').buildFullManuscriptDocxReviewPacketSource({
      projectId,projectRoot:'/project',notesDocument:document,scenes:[{sceneId,scenePath:'/project/'+sceneId,order:0,doc,text:envelope.deriveVisibleTextFromDocument(doc),observableContent:raw}]});
    for(const source of [mainSource,fullSource]) {
      assert.equal(source.documentNotes.breakEmission?.schemaVersion,2);
      assert.deepEqual(plain(source.documentNotes.sourceBindings.map(b=>b.richBody)),document.notes.map(n=>n.manuscript.body));
      const bytes=builder.buildDocxReviewPacketBuffer(source), bridge=await import('../../src/io/revisionBridge/index.mjs');
      const analysis=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},{cryptoPort:{sha256Text:hash,sha256Json:v=>'sha256:'+hash(JSON.stringify(v)),byteLength:v=>Buffer.byteLength(v)}});
      assert.equal(analysis.ok,true,JSON.stringify(analysis));
      const returnedNotes=bridge.parseDocumentNotesRichReturn(bytes,analysis.reviewIr.documentNotes,{includeBreakProjection:true});
      const preview=bridge.buildDocxContentPreviewFromZipBytes(bytes), plan=bridge.buildDocxImportPreviewPlanFromContentPreview(preview);
      assert.equal(plan.ok,true);const returnedDoc=envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc;
      if(tracked) {
        const bound=delta.bindUnchangedPendingNotes({document,projectId,sceneId,baseline:source.documentNotes,exportMap:source.localAuthorityCapsule.exportMap,
          beforeDoc:doc,returnedDoc,returnedNotes,unionReferences:preview.contentPreview.pendingNoteReferences});
        assert.deepEqual(pending.readLedger(bound.returnedDoc).noteSourcePoints,points);
      } else {
        const result=delta.planNoteReturnDelta({document,projectId,roundId:'fresh-v2',artifactSha256:hash(bytes),baseline:source.documentNotes,
          exportMap:source.localAuthorityCapsule.exportMap,returnedNotes,returnedParagraphs:analysis.reviewIr.formattingParagraphs,now:'2026-10-07T00:00:00Z'});
        assert.equal(result.unchanged,true);assert.equal(result.document,document);
      }
      if(source===mainSource)assert.equal((await h.context.buildSceneNoteReviewPublicationGate(source,bytes,bridge)).publishAllowed,true);
    }
  }
});

test('actual single-scene producer, signed Word parser, unchanged-note admission and publication preserve distinct collapsed references', async () => {
  const before = d(p('AxxB')), document = notesFor(before, [1,3]);
  const raw = envelope.composeObservablePayload({ doc: before }), h = await sourceHarness(raw, document), source = await h.run();
  const original = builder.buildDocxReviewPacketBuffer(source), bridge = await import('../../src/io/revisionBridge/index.mjs');
  const parts = bridge.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes: original }).parts;
  const match = /<w:r>(<w:rPr>[^]*?<\/w:rPr>)?<w:t(?: [^>]*)?>xx<\/w:t><\/w:r>/u;
  assert.match(parts['word/document.xml'], match);
  parts['word/document.xml'] = parts['word/document.xml'].replace(match, '<w:del w:id="51" w:author="Reviewer"><w:r><w:delText>xx</w:delText></w:r></w:del>');
  const bytes = buildStoredZip(Object.entries(parts).map(([name,data]) => ({ name,data })));
  const parsed = await decode(bytes, source, h);
  assert.deepEqual(parsed.preview.contentPreview.pendingNoteReferences.map(n => n.offsetUtf16), [1,3]);
  const bound = delta.bindUnchangedPendingNotes({ document, projectId, sceneId, baseline: source.documentNotes,
    exportMap: source.localAuthorityCapsule.exportMap, beforeDoc: before, returnedDoc: parsed.doc,
    returnedNotes: bridge.parseDocumentNotesRichReturn(bytes, parsed.analysis.reviewIr.documentNotes,{includeBreakProjection:true}),
    unionReferences: parsed.preview.contentPreview.pendingNoteReferences });
  const after = pending.replaceFromReturn(bound.beforeDoc, bound.returnedDoc, { roundId: source.exportCapsule.roundId, artifactSha256: hash(bytes) }).doc;
  const afterRaw = envelope.composeObservablePayload({ doc: after });
  const cohort = notes.planManuscriptNoteAnchorSave({ beforeText: JSON.stringify(document), projectId, sceneId, beforeContent: raw, afterContent: afterRaw });
  const updated = JSON.parse(cohort.afterText);
  assert.deepEqual(updated.notes.map(n => n.manuscript.reference.offsetUtf16), [1,1]);
  for (const action of [null, 'rejectAll', 'acceptAll']) {
    const current = action ? pending.decide(after, { action }).doc : after;
    const currentRaw = envelope.composeObservablePayload({ doc: current });
    const next = notes.planManuscriptNoteAnchorSave({ beforeText: JSON.stringify(updated), projectId, sceneId, beforeContent: afterRaw, afterContent: currentRaw });
    const n = next ? JSON.parse(next.afterText) : updated;
    const output = await sourceHarness(currentRaw, n), exported = await output.run(), outputBytes = builder.buildDocxReviewPacketBuffer(exported);
    const reread = await decode(outputBytes, exported, output);
    const gate = await output.context.buildSceneNoteReviewPublicationGate(exported, outputBytes, bridge);
    assert.equal(gate.publishAllowed, true);
    assert.equal((bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:outputBytes}).parts['word/document.xml'].match(/<w:del\b/gu)||[]).length, action ? 0 : 1);
    assert.equal(reread.preview.contentPreview.manuscriptNotes.length, 2);
  }
});

async function runtimeFixture(t, insertion = false, richBody = null) {
  const file = path.join(__dirname, 'rtk-word-pending-return-runtime.contract.test.js');
  const text = fs.readFileSync(file, 'utf8').split("\ntest('actual authenticated")[0] + '\nmodule.exports={harness};';
  const mod = { exports: {} }; new Function('require', 'module', '__dirname', text)(createRequire(file), mod, __dirname);
  const h = await mod.exports.harness(t, { clean:true }), root = path.dirname(path.dirname(h.file));
  const before = d(p('AxxB')), document = notesFor(before, [1,3]);
  document.notes.forEach(n => { n.manuscript.reference.sceneId = 'roman/a.txt';
    if(richBody){n.manuscript.body=plain(richBody);n.body=notes.validateNoteBody(richBody).text;n.privateMetadata={untouched:'private'};} });
  const raw = envelope.composeObservablePayload({doc:before}); fs.writeFileSync(h.file, raw);
  const notePath = path.join(root,'notes.craftsman.json'), manifestPath = path.join(root,'project.craftsman.json');
  fs.writeFileSync(notePath, JSON.stringify(document)); fs.writeFileSync(manifestPath, JSON.stringify({ schemaVersion:1, projectId, revision:0 }));
  const oldContext = h.context;
  h.context = () => ({...oldContext(), projectId});
  Object.assign(h.c, {
    require:createRequire(require.resolve('../../src/main.js')),
    manuscriptNoteModel:notes,
    notesStateDigest:require('../../src/export/docx/docxReviewPacketNotes.js').notesStateDigest,
    readCommentAuthoringContext:async()=>h.context(),
    loadNotesStorageModule:async()=>({readNotesStorage:async()=>({ok:true,document:JSON.parse(fs.readFileSync(notePath,'utf8')),sourceExists:true,sourceText:fs.readFileSync(notePath,'utf8')})}),
  });
  const producer=await sourceHarness(raw, document, {currentFilePath:h.file,
    getProjectRelativeFilePath:()=> 'roman/a.txt',
    readReviewExactTextApplyProjectBinding:async()=>({ok:true,projectId,projectRoot:root,manifestPath})});
  const source=await producer.run(), bridge=await import('../../src/io/revisionBridge/index.mjs');
  const parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:builder.buildDocxReviewPacketBuffer(source)}).parts;
  if (insertion) parts['word/document.xml']=parts['word/document.xml'].replace(/<w:r>(<w:rPr>[^]*?<\/w:rPr>)?<w:t(?: [^>]*)?>A<\/w:t><\/w:r>/u,
    run=>'<w:ins w:id="51" w:author="Reviewer"><w:r><w:t>😀</w:t></w:r></w:ins>'+run);
  else parts['word/document.xml']=parts['word/document.xml'].replace(/<w:r>(<w:rPr>[^]*?<\/w:rPr>)?<w:t(?: [^>]*)?>xx<\/w:t><\/w:r>/u,
    '<w:del w:id="51" w:author="Reviewer"><w:r><w:delText>xx</w:delText></w:r></w:del>');
  const bytes=buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data}))), decoded=await decode(bytes,source,producer);
  h.input={...h.input,docxBytes:bytes,context:{projectId,projectRoot:root,
    reviewTransportAuthorityCapsule:{...source.localAuthorityCapsule,projectRoot:root,
      exportMapAuthority:'main-owned-active-export-authority-store-after-return-authentication',returnedArtifactExportMapAccepted:false},
    reviewTransportReturnIntake:{authenticated:true,returnedArtifactSha256:'sha256:'+hash(bytes),parserResult:decoded.analysis}}};
  h.c.createRtkReviewTransportCryptoPort=producer.context.createRtkReviewTransportCryptoPort;
  // The nested harness allocated a different initial round. Publish this
  // producer's actual private capsule through the same durable-record fixture
  // and real Main validator, using the crypto port that will verify its return.
  h.authority=require('../helpers/main-docx-round-authority').installMainDocxRoundAuthority(h.c,
    {projectRoot:root,projectId,references:[h.input.context.reviewTransportAuthorityCapsule],publishAllocated:true,t});
  const tx=require('../../src/core/project-transaction-v1.cjs'), save=require('../../src/core/save-coordinator-v1.cjs');
  const publishManifest=async({manifestPath,expectedText,nextText,revision})=>{
    assert.equal(fs.readFileSync(manifestPath,'utf8'),expectedText);
    await save.durableSaveTransaction({filePath:manifestPath,content:nextText,revision});
  };
  h.c.commitWriterProjectSnapshot=async(target,content,generation,profile,label,options)=>{
    if(h.race)h.race(); await options.beforeScenePublish();
    const beforeText=fs.readFileSync(notePath,'utf8'), expectedManifestContent=fs.readFileSync(manifestPath,'utf8');
    const revision=JSON.parse(expectedManifestContent).revision+1;
    const noteState=notes.planManuscriptNoteAnchorSave({beforeText,projectId,sceneId:'roman/a.txt',beforeContent:options.expectedSceneContent,afterContent:content,
      ...(options.pendingNoteReturnProofJson!==undefined?{pendingNoteReturnProofJson:options.pendingNoteReturnProofJson}:{})});
    const request={scenePath:target,manifestPath,sceneContent:content,expectedSceneContent:options.expectedSceneContent,
      expectedManifestContent,manifestContent:JSON.stringify({...JSON.parse(expectedManifestContent),revision}),revision,noteState,publishManifest};
    h.lastRequest=request;
    if(h.mutateRequest)h.mutateRequest(request);
    const adapter=h.failNotePublish?{...fs.promises,rename:async(a,b)=>{if(b===notePath)throw Error('INJECTED_NOTE_PUBLICATION_FAILURE');return fs.promises.rename(a,b);}}:fs.promises;
    await tx.commitProjectTransaction({...request,fsAdapter:adapter});h.writes++;
    return {success:true,projectTransaction:true};
  };
  h.command=(action,override={})=>h.c.dispatchMenuCommand('cmd.project.review.decidePendingRevision',{projectId,sceneId:'roman/a.txt',subjectId:'life:session',
    expectedSceneSha256:h.context().sceneSha256,action,...override},{route:'command.bus'});
  return Object.assign(h,{root,notePath,manifestPath,document,source,bytes,decoded,publishManifest,
    offsets:()=>JSON.parse(fs.readFileSync(notePath,'utf8')).notes.map(n=>n.manuscript.reference.offsetUtf16)});
}
test('authenticated Main preparation, Kernel and actual atomic scene/notes writer apply, restart, decide and replay together',async t=>{
  const h=await runtimeFixture(t);
  assert.deepEqual(h.input.context.reviewTransportAuthorityCapsule.commentExport.threads,[]);
  assert.deepEqual(h.input.context.reviewTransportAuthorityCapsule.commentExport.tombstones,[]);
  assert.deepEqual(h.input.context.reviewTransportReturnIntake.parserResult.reviewIr.commentThreads,[]);
  assert.equal((await h.prepare()).status,'preview-ready');assert.equal(h.writes,0);
  assert.equal((await h.prepared.apply()).ok,true);assert.deepEqual(h.offsets(),[1,1]);
  for(const [action,expected]of [['rejectAll',[1,3]],['undo',[1,1]],['acceptAll',[1,1]],['undo',[1,1]],['undo',[1,3]],['redo',[1,1]]]){
    const result=await h.command(action);assert.equal(result.ok,true,JSON.stringify(result));assert.deepEqual(h.offsets(),expected);
    const raw=fs.readFileSync(h.file,'utf8');pending.readLedger(envelope.parseObservablePayload(raw).doc);
  }
  const writes=h.writes;assert.equal((await h.prepare()).status,'replayed');assert.equal(h.writes,writes);
});
test('actual atomic writer rollback and stale note CAS never publish a partial pending-note cohort',async t=>{
  for(const failure of ['notePublication','staleNotes']){
    const h=await runtimeFixture(t), before=[h.file,h.notePath,h.manifestPath].map(p=>fs.readFileSync(p,'utf8'));
    assert.equal((await h.prepare()).status,'preview-ready');
    if(failure==='notePublication')h.failNotePublish=true;
    else h.race=()=>{const n=JSON.parse(fs.readFileSync(h.notePath,'utf8'));n.notes[0].title='concurrent';fs.writeFileSync(h.notePath,JSON.stringify(n));};
    await assert.rejects(h.prepared.apply());assert.equal(h.writes,0);
    if(failure==='notePublication'){
      await require('../../src/core/project-transaction-v1.cjs').recoverProjectTransaction({scenePath:h.file,manifestPath:h.manifestPath,publishManifest:h.publishManifest});
      assert.deepEqual([h.file,h.notePath,h.manifestPath].map(p=>fs.readFileSync(p,'utf8')),before);
    }else{assert.equal(fs.readFileSync(h.file,'utf8'),before[0]);assert.equal(fs.readFileSync(h.manifestPath,'utf8'),before[2]);}
  }
});
test('fresh V2 single-scene note changes remain clean edits but pending body and break changes refuse without writes',async t=>{
  const body=d({type:'paragraph',attrs:{wordParagraphSpacing:{after:120},wordParagraphMarkLanguage:{val:'ru-RU'}},content:[
    {type:'text',text:'Rich 😀',marks:[{type:'bold'},{type:'textStyle',attrs:{fontFamily:'Georgia',fontSize:'14pt',wordLanguage:{val:'ru-RU'}}}]},
    {type:'hardBreak'},{type:'text',text:'kept'}]});
  for(const mutation of ['text','font','size','language','eastAsia','bidi','bold','spacing','breakFont']) {
    const h=await runtimeFixture(t,false,body), bridge=h.input.revisionBridge;
    const before=[h.file,h.notePath,h.manifestPath].map(f=>fs.readFileSync(f,'utf8'));
    const parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:h.bytes}).parts, prior=parts['word/footnotes.xml'];
    if(mutation==='text')parts['word/footnotes.xml']=prior.replace('Rich','Edited');
    if(mutation==='font')parts['word/footnotes.xml']=prior.replaceAll('Georgia','Arial');
    if(mutation==='size')parts['word/footnotes.xml']=prior.replaceAll('w:val="28"','w:val="30"');
    if(mutation==='language')parts['word/footnotes.xml']=prior.replace('w:val="ru-RU"','w:val="ru-FI"');
    if(['eastAsia','bidi'].includes(mutation))parts['word/footnotes.xml']=prior.replace('<w:lang w:val="ru-RU"/>',`<w:lang w:val="ru-RU" w:${mutation}="ja-JP"/>`);
    if(mutation==='bold')parts['word/footnotes.xml']=prior.replaceAll('<w:b w:val="1"/>','<w:b w:val="0"/>');
    if(mutation==='spacing')parts['word/footnotes.xml']=prior.replace('w:after="120"','w:after="121"');
    if(mutation==='breakFont')parts['word/footnotes.xml']=prior.replace(/<w:r>(<w:rPr>[^]*?<\/w:rPr>)?<w:br\/><\/w:r>/u,
      '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/></w:rPr><w:br/></w:r>');
    assert.notEqual(parts['word/footnotes.xml'],prior,mutation);
    const bytes=buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data}))), parsed=await decode(bytes,h.source,{context:h.c});
    h.input.docxBytes=bytes;h.input.context.reviewTransportReturnIntake.returnedArtifactSha256='sha256:'+hash(bytes);
    h.input.context.reviewTransportReturnIntake.parserResult=parsed.analysis;
    const result=await h.prepare();assert.equal(result.status,'blocked',JSON.stringify(result));
    assert.match(result.code,/PENDING_NOTE_BODY_CHANGED|PENDING_NOTE_BREAK_CHANGED/);assert.equal(h.writes,0);
    assert.deepEqual([h.file,h.notePath,h.manifestPath].map(f=>fs.readFileSync(f,'utf8')),before);
    // Clean edits are planned from the same genuine parsed note package; the
    // manuscript proof remains the unchanged clean source, not tracked input.
    const clean=h.source.localAuthorityCapsule.exportMap.scenes[0].blocks.map((b,i)=>({paragraphIndex:i,paragraphText:b.formatIr.runs.map(r=>r.text).join(''),trackedRevision:false}));
    const input={document:h.document,projectId,roundId:'clean-edit-'+mutation,artifactSha256:hash(bytes),baseline:h.source.documentNotes,
      exportMap:h.source.localAuthorityCapsule.exportMap,returnedNotes:bridge.parseDocumentNotesRichReturn(bytes,parsed.analysis.reviewIr.documentNotes,{includeBreakProjection:true}),
      returnedParagraphs:clean,now:'2026-10-07T00:00:00Z'};
    if(mutation==='breakFont')assert.throws(()=>delta.planNoteReturnDelta(input),/NOTE_RETURN_BREAK_CHANGED/);
    else {const plan=delta.planNoteReturnDelta(input);assert.equal(plan.changes.length,1,mutation);assert.equal(plan.changes[0].operation,'update');
      assert.deepEqual(plan.document.notes[1],h.document.notes[1]);assert.deepEqual(plan.document.notes[0].privateMetadata,h.document.notes[0].privateMetadata);}
  }
});
test('fresh single-scene native note renumbering retains canonical identity while incomplete joins refuse',async t=>{
  for(const corrupted of [false,true]) {
    const h=await runtimeFixture(t,true), bridge=h.input.revisionBridge, files=[h.file,h.notePath,h.manifestPath],before=files.map(f=>fs.readFileSync(f,'utf8'));
    const parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:h.bytes}).parts;
    parts['word/document.xml']=parts['word/document.xml'].replace('<w:footnoteReference w:id="1"','<w:footnoteReference w:id="71"').replace('<w:endnoteReference w:id="1"','<w:endnoteReference w:id="81"');
    parts['word/footnotes.xml']=parts['word/footnotes.xml'].replace('<w:footnote w:id="1"','<w:footnote w:id="'+(corrupted?'72':'71')+'"');
    parts['word/endnotes.xml']=parts['word/endnotes.xml'].replace('<w:endnote w:id="1"','<w:endnote w:id="81"');
    const bytes=buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data})));
    h.input.docxBytes=bytes;h.input.context.reviewTransportReturnIntake.returnedArtifactSha256='sha256:'+hash(bytes);
    h.input.context.reviewTransportReturnIntake.parserResult=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes,hmacSecret:h.source.forbiddenSecret,
      expectedAuthority:h.source.localAuthorityCapsule.expectedAuthority},{cryptoPort:h.c.createRtkReviewTransportCryptoPort()});
    const result=await h.prepare();
    if(corrupted){assert.ok(result==null||result.status==='blocked');assert.equal(h.prepared,undefined);assert.equal(h.writes,0);assert.deepEqual(files.map(f=>fs.readFileSync(f,'utf8')),before);}
    else {assert.equal(result.status,'preview-ready',JSON.stringify(result));await h.prepared.apply();assert.equal(h.writes,1);
      assert.deepEqual(JSON.parse(fs.readFileSync(h.notePath,'utf8')).notes.map(n=>({id:n.id,body:n.manuscript.body})),h.document.notes.map(n=>({id:n.id,body:n.manuscript.body})));}
  }
});
for(const profileAttack of ['missing','partial','forged','foreignScene','foreignBlock','nativeDuplicate','breakMissing'])
 test(`fresh single-scene V2 atomic ${profileAttack} retains all business bytes`,async t=>{
  const h=await runtimeFixture(t,true);assert.equal((await h.prepare()).status,'preview-ready');
  const files=[h.file,h.notePath,h.manifestPath],before=files.map(f=>fs.readFileSync(f,'utf8'));
  h.mutateRequest=request=>{
    const proof=JSON.parse(request.noteState.pendingNoteReturnProofJson);
    if(profileAttack==='missing')delete proof.baseline.breakEmission;
    if(profileAttack==='partial')delete proof.baseline.breakEmission.wordLanguage.bidi;
    if(profileAttack==='forged')proof.baseline.breakEmission.fontFamily='Arial';
    if(profileAttack==='foreignScene')proof.exportMap.scenes[0].sceneId='foreign';
    if(profileAttack==='foreignBlock')proof.baseline.sourceBindings[0].blockTextSha256='0'.repeat(64);
    if(profileAttack==='nativeDuplicate')proof.unionReferences[1].nativeId=proof.unionReferences[0].nativeId,proof.unionReferences[1].kind=proof.unionReferences[0].kind;
    if(profileAttack==='breakMissing')delete proof.returnedNotes[0].breakProjection;
    request.noteState.pendingNoteReturnProofJson=JSON.stringify(proof);
  };
  await assert.rejects(h.prepared.apply(),/NOTE_STATE/);assert.equal(h.writes,0);assert.deepEqual(files.map(f=>fs.readFileSync(f,'utf8')),before);
 });

for(const attack of ['omitted','malformed','extra','foreignProject','foreignScene','baselineDigest','foreignRoster','noteBody','source','point','receipt','history','afterLedger','beforeSource','staleNotes'])
 test(`authenticated single-scene note return atomic ${attack} refuses with all business bytes retained`,async t=>{
  const h=await runtimeFixture(t,true);assert.equal((await h.prepare()).status,'preview-ready');
  const files=[h.file,h.notePath,h.manifestPath],before=files.map(file=>fs.readFileSync(file,'utf8'));
  h.mutateRequest=request=>{
   assert.equal(typeof request.noteState.pendingNoteReturnProofJson,'string');
   if(attack==='omitted'){delete request.noteState.pendingNoteReturnProofJson;return;}
   if(attack==='malformed'){request.noteState.pendingNoteReturnProofJson='{';return;}
   if(attack==='staleNotes'){fs.writeFileSync(h.notePath,before[1]+' ');return;}
   if(attack==='beforeSource'){request.expectedSceneContent+=' ';return;}
   if(attack==='history'||attack==='afterLedger'){
    const ledger=plain(pending.readLedger(envelope.parseObservablePayload(request.sceneContent).doc));
    if(attack==='history')ledger.returnReceipts=[];else ledger.revisions[0].author='Forged author';
    request.sceneContent=envelope.composeObservablePayload({doc:pending.bindLedger(ledger)});return;
   }
   const proof=JSON.parse(request.noteState.pendingNoteReturnProofJson);
   if(attack==='extra')proof.authority=true;
   if(attack==='foreignProject')proof.projectId='foreign';if(attack==='foreignScene')proof.sceneId='roman/foreign.txt';
   if(attack==='baselineDigest')proof.baseline.stateDigest='sha256:'+'0'.repeat(64);
   if(attack==='foreignRoster')proof.baseline.sourceBindings[0].noteId='foreign';
   if(attack==='noteBody')proof.returnedNotes[0].body.content[0].content[0].text='Forged body';
   if(attack==='source'){
    const ledger=plain(pending.readLedger(proof.returnedDoc));ledger.source.content[0].content.at(-1).text+='X';proof.returnedDoc=pending.bindLedger(ledger);
   }
   if(attack==='point')proof.unionReferences[0].offsetUtf16++;
   if(attack==='receipt')proof.receipt.artifactSha256='b'.repeat(64);
   request.noteState.pendingNoteReturnProofJson=JSON.stringify(proof);
  };
  await assert.rejects(h.prepared.apply(),attack==='staleNotes'?/NOTE_CAS/:/NOTE_STATE/);assert.equal(h.writes,0);
  assert.deepEqual(files.map(file=>fs.readFileSync(file,'utf8')),[before[0],attack==='staleNotes'?before[1]+' ':before[1],before[2]]);
 });

test('source-point projection preserves disjoint edits across nested, repeated, empty and Unicode leaves for every decision combination',()=>{
  const c=(...content)=>({type:'tableCell',attrs:{colspan:1,rowspan:1,colwidth:null},content});
  const table=(...content)=>({type:'table',content:[{type:'tableRow',content}]});
  const source=d(p('pre CUT tail'),table(c(p(''),table(c(p('A xx NOTE yy 😀Z')),c(p('same'))),p('')),c(p('same'))),p(''));
  const revisions=[{...revision(4,8),paragraphIndex:0},
    {...revision(2,5,'insert'),paragraphIndex:2,id:'revision-2',nativeId:'52'},
    {...revision(10,13,'insert'),paragraphIndex:2,id:'revision-3',nativeId:'53'}];
  const points=[{noteId:'inner',paragraphIndex:2,offsetUtf16:7},{noteId:'empty',paragraphIndex:4,offsetUtf16:0},
    {noteId:'repeated',paragraphIndex:5,offsetUtf16:2},{noteId:'terminal',paragraphIndex:6,offsetUtf16:0}];
  for(const a of ['pending','accepted','rejected'])for(const b of ['pending','accepted','rejected'])for(const c of ['pending','accepted','rejected']){
    const input=ledger(source,revisions.map((r,i)=>({...r,state:[a,b,c][i]})));
    const doc=pending.bindNoteSourcePoints(pending.bindLedger(input),points);
    const decoded=envelope.parseObservablePayload(envelope.composeObservablePayload({doc}));assert.equal(decoded.issue,null);
    const projected=pending.noteProjection(decoded.doc);
    const prefix=a==='rejected'?'pre CUT tail':'pre tail', inner='A '+(b==='rejected'?'':'xx ')+'NOTE '+(c==='rejected'?'':'yy ')+'😀Z';
    const texts=[prefix,'',inner,'same','','same',''];
    assert.deepEqual(projected.map(p=>p.globalOffsetUtf16),[
      prefix.length+2+inner.indexOf('NOTE')+2,
      texts.slice(0,4).reduce((n,s)=>n+s.length+1,0),
      texts.slice(0,5).reduce((n,s)=>n+s.length+1,0)+2,
      texts.slice(0,6).reduce((n,s)=>n+s.length+1,0)]);
  }
  assert.throws(()=>pending.bindNoteSourcePoints(pending.bindLedger(ledger(d(p('😀')),[])),[{noteId:'n',paragraphIndex:0,offsetUtf16:1}]),/BOUNDARY/);
  const value=pending.bindNoteSourcePoints(pending.bindLedger(ledger(source,revisions)),points);
  for(const mutate of [l=>l.noteSourcePoints.push({...l.noteSourcePoints[0]}),l=>l.noteSourcePoints[0].offsetUtf16=-1,
    l=>l.noteSourcePoints[0].paragraphIndex=100,l=>l.noteSourcePoints[0].authority=true,l=>l.noteSourcePoints=[],
    l=>l.noteSourcePoints[0].noteId='../authority',l=>l.noteSourcePoints[0].offsetUtf16=3]){
    const l=structuredClone(pending.readLedger(value));mutate(l);assert.throws(()=>pending.bindLedger(l),/PENDING_NOTE/);
  }
});

// Frozen N-1 declaration boundary from 3cc58101, before pending note points.
// The real reader reaches this check before canonicalizing a declared document.
function nMinusOneDecode(serializedDoc) {
  const fail=code=>{throw Object.assign(Error(code),{code});};
  const isDeclaration=value=>value && typeof value==='object' && !Array.isArray(value)
    && ['format','version','requiredFeatures'].some(key=>Object.hasOwn(value,key));
  const newline=serializedDoc.indexOf('\n'),firstLine=newline<0?serializedDoc:serializedDoc.slice(0,newline);
  let declaration;try{declaration=JSON.parse(firstLine);}catch{declaration=null;}
  if(!isDeclaration(declaration)){return JSON.parse(serializedDoc);}
  if(Object.keys(declaration).sort().join(',')!=='format,requiredFeatures,version')fail('DOC_BLOCK_FORMAT_DECLARATION_INVALID');
  if(declaration.format!=='yalken.scene-document'||declaration.version!==3)fail('DOC_BLOCK_FORMAT_UNSUPPORTED');
  if(!Array.isArray(declaration.requiredFeatures)||declaration.requiredFeatures.length!==1
    ||declaration.requiredFeatures[0]!=='word-user-bookmarks.v1')fail('DOC_BLOCK_REQUIRED_FEATURES_UNSUPPORTED');
  return JSON.parse(serializedDoc.slice(newline+1));
}
test('bookmark working envelope retains inherited endpoints until authenticated save rebase after deletion', () => {
  const bookmarks = require('../../src/core/word-user-bookmarks-v1.cjs');
  const endpoint = offsetUtf16 => ({ paragraphIndex: 0, offsetUtf16, edge: 'text' });
  const before = bookmarks.planMutation({ doc: d(p('Prefix Keep Target')), action: 'create',
    requestId: 'bookmark-delete-before', projectId, sceneId, name: 'Target',
    start: endpoint(12), end: endpoint(18) }).doc;
  const inherited = bookmarks.readRegistry(before);
  const working = plain(before); working.content[0].content[0].text = 'Keep Target';
  const raw = envelope.composeObservablePayload({ doc: working });
  const parsed = envelope.parseObservablePayload(raw);
  assert.equal(parsed.issue, null);
  assert.deepEqual(bookmarks.readRegistry(parsed.doc, { checkBounds: false }), inherited);
  assert.throws(() => bookmarks.readRegistry(parsed.doc), /USER_BOOKMARK_ENDPOINT_BOUNDARY/);
  const saved = bookmarks.planSave({ beforeDoc: before, workingDoc: parsed.doc });
  const record = saved.registry.bookmarks[0];
  assert.equal(record.id, inherited.bookmarks[0].id);
  assert.deepEqual(record.start, endpoint(5)); assert.deepEqual(record.end, endpoint(11));
  const reopened = envelope.parseObservablePayload(envelope.composeObservablePayload({ doc: saved.doc }));
  assert.equal(reopened.issue, null);
  assert.deepEqual(bookmarks.readRegistry(reopened.doc), saved.registry);
  assert.deepEqual(bookmarks.planSave({ beforeDoc: reopened.doc, workingDoc: reopened.doc }).doc, saved.doc);
  const forged = plain(working); forged.attrs[bookmarks.KEY].bookmarks[0].name = 'Forged';
  const forgedParsed = envelope.parseObservablePayload(envelope.composeObservablePayload({ doc: forged }));
  assert.equal(forgedParsed.issue, null);
  assert.throws(() => bookmarks.planSave({ beforeDoc: before, workingDoc: forgedParsed.doc }), /USER_BOOKMARK_SAVE_AUTHORITY/);
  const malformed = raw.replace('"edge": "text"', '"edge": "xxxx"');
  assert.notEqual(malformed, raw);
  assert.equal(envelope.parseObservablePayload(malformed).issue?.details?.message, 'USER_BOOKMARK_ENDPOINT_INVALID');
  assert.deepEqual(bookmarks.readRegistry(before), inherited);
});

test('new semantic envelope refuses N-1 readers, missing declaration and unknown future state without flattening',()=>{
  const doc=pending.bindNoteSourcePoints(pending.bindLedger(ledger(d(p('AxxB')),[revision(1,3)])),[{noteId:'n',paragraphIndex:0,offsetUtf16:1}]);
  const raw=envelope.composeObservablePayload({doc}), body=raw.slice(raw.indexOf('\n')+1);
  assert.match(body,/"requiredFeatures":\["word-pending-note-points.v1"\]/u);
  assert.throws(()=>nMinusOneDecode(body),/REQUIRED_FEATURES_UNSUPPORTED/);
  assert.throws(()=>JSON.parse(body),SyntaxError,'older single JSON decoder also refuses the two-record payload');
  const missing=JSON.stringify(doc), malformed=[`[doc-v2 length=${missing.length}]\n${missing}`,
    raw.replace('word-pending-note-points.v1','word-pending-note-points.v9'),raw.replace('"schemaVersion": 3','"schemaVersion": 9')];
  for(const value of malformed){const parsed=envelope.parseObservablePayload(value);assert.ok(parsed.issue);assert.equal(parsed.doc,null);}
  for(const schemaVersion of [1,2]){
    const l=ledger(d(p('AxB')),[revision(1,2,'insert')]);l.schemaVersion=schemaVersion;
    if(schemaVersion===1){delete l.roundUndo;delete l.roundRedo;delete l.returnReceipts;}
    const original=pending.bindLedger(l), parsed=envelope.parseObservablePayload(envelope.composeObservablePayload({doc:original}));
    assert.equal(parsed.issue,null);assert.deepEqual(pending.readLedger(parsed.doc),l);
  }
});

for(const mutation of ['body','kind','identity','missing','duplicate','insideRevision','namespace','referenceMove']){
  test(`authenticated pending-note return rejects ${mutation} with unchanged canonical bytes`,async t=>{
    const h=await runtimeFixture(t),before=[h.file,h.notePath,h.manifestPath].map(p=>fs.readFileSync(p,'utf8'));
    assert.equal(h.c.assertFreshDocxReviewRoundAuthority(h.input.context.reviewTransportAuthorityCapsule).roundId,h.source.exportCapsule.roundId);
    const bridge=h.input.revisionBridge,parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:h.bytes}).parts;
    if(mutation==='body')parts['word/footnotes.xml']=parts['word/footnotes.xml'].replace('Body','Changed');
    if(mutation==='identity')parts['word/footnotes.xml']=parts['word/footnotes.xml'].replace(/_YALKEN_NOTE_[a-f0-9]{24}/u,'_YALKEN_NOTE_'+'a'.repeat(24));
    const marker=parts['word/document.xml'].match(/<w:r><w:rPr><w:rStyle w:val="FootnoteReference"\/><\/w:rPr><w:footnoteReference[^]*?<\/w:r>/u)[0];
    if(mutation==='kind')parts['word/document.xml']=parts['word/document.xml'].replace('<w:footnoteReference','<w:endnoteReference');
    if(mutation==='missing')parts['word/document.xml']=parts['word/document.xml'].replace(marker,'');
    if(mutation==='duplicate')parts['word/document.xml']=parts['word/document.xml'].replace(marker,marker+marker);
    if(mutation==='insideRevision')parts['word/document.xml']=parts['word/document.xml'].replace(marker,'').replace('<w:del w:id="51" w:author="Reviewer">','<w:del w:id="51" w:author="Reviewer">'+marker);
    if(mutation==='namespace')parts['word/document.xml']=parts['word/document.xml'].replace('<w:footnoteReference','<foreign:footnoteReference xmlns:foreign="urn:foreign"');
    if(mutation==='referenceMove')parts['word/document.xml']=parts['word/document.xml'].replace(marker,'').replace('</w:del>','</w:del>'+marker);
    const bytes=buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data})));
    h.input.docxBytes=bytes;h.input.context.reviewTransportReturnIntake.returnedArtifactSha256='sha256:'+hash(bytes);
    h.input.context.reviewTransportReturnIntake.parserResult=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes,hmacSecret:h.source.forbiddenSecret,
      expectedAuthority:h.source.localAuthorityCapsule.expectedAuthority},{cryptoPort:h.c.createRtkReviewTransportCryptoPort()});
    const result=await h.prepare(), noteCode={body:'PENDING_NOTE_BODY_CHANGED',identity:'PENDING_NOTE_IDENTITY_MISMATCH',referenceMove:'PENDING_NOTE_REFERENCE_MOVED'}[mutation];
    if(noteCode){
      assert.equal(result?.status,'blocked',JSON.stringify(result));assert.equal(result.code,noteCode);
    }else{
      const preview=bridge.buildDocxContentPreviewFromZipBytes(bytes);
      assert.equal(h.decoded.preview.ok,true,'unchanged producer output must reach a valid note preview');
      assert.equal(preview.ok,false);assert.equal(preview.status,'blocked');assert.equal(preview.contentPreview,null);
      assert.equal(preview.reason,mutation==='missing'?'DOCX_GENERIC_NOTES_INCOMPLETE':'DOCX_CONTENT_PREVIEW_INTERNAL_ERROR');
      assert.equal(result,null,'invalid note XML must not enter authenticated pending apply');
    }
    assert.equal(h.prepared,undefined);assert.equal(h.writes,0);
    assert.deepEqual([h.file,h.notePath,h.manifestPath].map(p=>fs.readFileSync(p,'utf8')),before);
  });
}

test('native XML insertion before both existing note kinds remains reversible through actual Main and atomic writer',async t=>{
  const h=await runtimeFixture(t,true);const prepared=await h.prepare();assert.equal(prepared.status,'preview-ready',JSON.stringify(prepared));
  await h.prepared.apply();assert.deepEqual(h.offsets(),[3,5]);
  for(const [action,expected]of [['rejectAll',[1,3]],['undo',[3,5]],['acceptAll',[3,5]],['undo',[3,5]],['undo',[1,3]],['redo',[3,5]]]){
    const result=await h.command(action);assert.equal(result.ok,true,JSON.stringify(result));assert.deepEqual(h.offsets(),expected);
  }
});

test('two native disjoint insertions surrounding an unchanged note avoid contiguous-diff ambiguity and preserve rich nested note body',async()=>{
  const before=d(p('A NOTE Z')),document=notesFor(before,[4]);
  const c=(...content)=>({type:'tableCell',attrs:{colspan:1,rowspan:1,colwidth:null},content});
  const table=(...content)=>({type:'table',content:[{type:'tableRow',content}]});
  document.notes[0].manuscript.body=d(table(c(p('outer'),table(c(p('inner'))),p(''))));
  document.notes[0].body=notes.validateNoteBody(document.notes[0].manuscript.body).text;
  const raw=envelope.composeObservablePayload({doc:before}),h=await sourceHarness(raw,document),source=await h.run();
  const bridge=await import('../../src/io/revisionBridge/index.mjs');
  const parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:builder.buildDocxReviewPacketBuffer(source)}).parts;
  parts['word/document.xml']=parts['word/document.xml'].replace(/<w:t(?: [^>]*)?>A NO<\/w:t>/u,
    '<w:t xml:space="preserve">A </w:t></w:r><w:ins w:id="51" w:author="Reviewer"><w:r><w:t xml:space="preserve">xx </w:t></w:r></w:ins><w:r><w:t>NO</w:t>')
    .replace(/<w:t(?: [^>]*)?>TE Z<\/w:t>/u,'<w:t xml:space="preserve">TE </w:t></w:r><w:ins w:id="52" w:author="Reviewer"><w:r><w:t xml:space="preserve">yy </w:t></w:r></w:ins><w:r><w:t>Z</w:t>');
  const bytes=buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data}))),parsed=await decode(bytes,source,h);
  assert.equal(pending.projection(parsed.doc).current,'A xx NOTE yy Z');
  assert.throws(()=>notes.mapPoint('A NOTE Z','A xx NOTE yy Z',4),/NOTE_REFERENCE_EDIT_CONFLICT/);
  const bound=delta.bindUnchangedPendingNotes({document,projectId,sceneId,baseline:source.documentNotes,exportMap:source.localAuthorityCapsule.exportMap,
    beforeDoc:before,returnedDoc:parsed.doc,returnedNotes:bridge.parseDocumentNotesRichReturn(bytes,parsed.analysis.reviewIr.documentNotes,{includeBreakProjection:true}),unionReferences:parsed.preview.contentPreview.pendingNoteReferences});
  const after=pending.replaceFromReturn(bound.beforeDoc,bound.returnedDoc,{roundId:source.exportCapsule.roundId,artifactSha256:hash(bytes)}).doc;
  const cohort=notes.planManuscriptNoteAnchorSave({beforeText:JSON.stringify(document),projectId,sceneId,beforeContent:raw,afterContent:envelope.composeObservablePayload({doc:after})});
  assert.equal(JSON.parse(cohort.afterText).notes[0].manuscript.reference.offsetUtf16,7);
  assert.deepEqual(JSON.parse(cohort.afterText).notes[0].manuscript.body,document.notes[0].manuscript.body);
});

test('equal visible text with changed source occurrence commits the note cohort through actual Main and atomic writer',async t=>{
  const h=await runtimeFixture(t),bridge=h.input.revisionBridge;
  const beforeRaw=fs.readFileSync(h.file,'utf8'), parts=bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:h.bytes}).parts;
  const marker=parts['word/document.xml'].match(/<w:r><w:rPr><w:rStyle w:val="EndnoteReference"\/><\/w:rPr><w:endnoteReference[^]*?<\/w:r>/u)[0];
  parts['word/document.xml']=parts['word/document.xml'].replace(marker,marker+'<w:ins w:id="52" w:author="Reviewer"><w:r><w:t>xx</w:t></w:r></w:ins>');
  const bytes=buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data})));
  h.input.docxBytes=bytes;h.input.context.reviewTransportReturnIntake.returnedArtifactSha256='sha256:'+hash(bytes);
  h.input.context.reviewTransportReturnIntake.parserResult=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes,hmacSecret:h.source.forbiddenSecret,
    expectedAuthority:h.source.localAuthorityCapsule.expectedAuthority},{cryptoPort:h.c.createRtkReviewTransportCryptoPort()});
  const prepared=await h.prepare();assert.equal(prepared.status,'preview-ready',JSON.stringify(prepared));
  assert.equal(notes.sceneText(envelope.composeObservablePayload({doc:h.prepared.changes.after})),notes.sceneText(beforeRaw));
  await h.prepared.apply();assert.deepEqual(h.offsets(),[1,1]);assert.ok(h.lastRequest.noteState);
  for(const [action,expected]of [['undo',[1,3]],['redo',[1,1]],['rejectAll',[1,3]],['undo',[1,1]]]){
    const result=await h.command(action);assert.equal(result.ok,true,JSON.stringify(result));assert.deepEqual(h.offsets(),expected);
    assert.equal(notes.sceneText(fs.readFileSync(h.file,'utf8')),'AxxB');
    assert.deepEqual(JSON.parse(fs.readFileSync(h.notePath,'utf8')).notes.map(n=>n.manuscript.body),h.document.notes.map(n=>n.manuscript.body));
  }
});

for(const tracked of [false,true])test('single full manuscript complete note and discussion cohort '+(tracked?'pending':'clean'),async()=>{
  const f=await singleFullManuscriptFixture({tracked}),before=JSON.stringify(f.proof),mixed=require('../../src/core/word-pending-comment-return-v1.cjs');
  assert.equal(f.source.localAuthorityCapsule.scope,'full-manuscript');assert.equal(f.source.documentNotes.breakEmission.schemaVersion,2);
  const plan=mixed.planMixedBookReturn({projectId,beforeText:f.beforeText,scenes:f.scenes,notesText:f.notesText,returnProofJson:JSON.stringify(f.proof)});
  const actual=pending.projection(envelope.parseObservablePayload(plan.scenes[0].content).doc);
  assert.equal(actual.current,f.current[0]);assert.equal(actual.original,'AxxB tail\n\nAfter empty paragraph');
  const state=JSON.parse(plan.afterText);assert.equal(state.threads.find(t=>t.threadId==='single-tail').status,'resolved');
  assert.deepEqual(state.threads.find(t=>t.threadId==='foreign-thread'),f.state.threads[1]);assert.equal(JSON.stringify(f.proof),before);
  const model=await import('../../src/core/project-tree-cohort-v1.mjs');
  const cohort=model.planProjectMixedWordReturnCohort({operation:'word-mixed-return',operationId:'one-complete',projectId,manifestPath:'/project/project.craftsman.json',
    beforeManifestText:JSON.stringify({projectId}),expectedTreeRevision:0,scenes:f.scenes.map(s=>({...s,commitText:null})),notesText:f.notesText,commentsText:f.beforeText,returnProofJson:JSON.stringify(f.proof)});
  model.validateProjectTreeCohort(cohort);assert.equal(cohort.affectedScenes.length,1);
});

for(const kind of ['missing-profile','profile-v1','profile-v3','partial-profile','unknown-profile','missing-note','duplicate-native','wrong-native','wrong-identity','wrong-offset','body-change','break-change']) {
  test('single full manuscript strict complete note refusal '+kind,async()=>{
    const f=await singleFullManuscriptFixture({tracked:true}),proof=plain(f.proof),ctx=proof.noteContext,baseline=ctx.baseline;
    if(kind==='missing-profile')delete baseline.breakEmission;
    if(kind==='profile-v1')baseline.breakEmission={schemaVersion:1,fontSize:'12pt'};
    if(kind==='profile-v3')baseline.breakEmission.schemaVersion=3;
    if(kind==='partial-profile')delete baseline.breakEmission.wordLanguage;
    if(kind==='unknown-profile')baseline.breakEmission.unrecognized=true;
    if(kind==='missing-note')ctx.returnedNotes.pop();
    if(kind==='duplicate-native') {ctx.returnedReferences[1].nativeId=ctx.returnedReferences[0].nativeId;ctx.returnedReferences[1].kind=ctx.returnedReferences[0].kind;}
    if(kind==='wrong-native')ctx.returnedReferences[0].nativeId='999';
    if(kind==='wrong-identity')ctx.returnedNotes[0].transportIdentity='_YALKEN_NOTE_'+'0'.repeat(24);
    if(kind==='wrong-offset')ctx.unionReferences[0].offsetUtf16++;
    if(kind==='body-change')ctx.returnedNotes[0].body.content[0].content[0].text+=' changed';
    if(kind==='break-change')ctx.returnedNotes[0].breakProjection=[];
    const protectedInput=JSON.stringify({scenes:f.scenes,document:f.document,state:f.state,proof});
    assert.throws(()=>require('../../src/core/word-pending-comment-return-v1.cjs').planMixedBookReturn({projectId,beforeText:f.beforeText,scenes:f.scenes,notesText:f.notesText,returnProofJson:JSON.stringify(proof)}),/PENDING_NOTE_/);
    assert.equal(JSON.stringify({scenes:f.scenes,document:f.document,state:f.state,proof}),protectedInput);
  });
}
test('single full manuscript producer refuses an active discussion in an absent scene',async()=>{
  const f=await singleFullManuscriptFixture(),state=plain(f.state);state.threads[1].status='open';delete state.threads[1].deleted;
  assert.throws(()=>require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js').buildFullManuscriptDocxReviewPacketSource({projectId,nonTextReturnState:state,
    scenes:[{sceneId:f.ids[0],doc:f.beforeDocs[0],text:envelope.deriveVisibleTextFromDocument(f.beforeDocs[0]),order:0}]}),/DOCX_COMMENT_ANCHOR_STALE/);
});

// The isolated source inspection delegates the real validator. On this empty
// history fixture it observes one inspection per full readLedger call only.
function pairedNoteObserver() {
 const {Module}=require('node:module'),file=require.resolve('../../src/core/word-pending-text-revisions-v1.cjs'),actual=createRequire(file),m=new Module(file),events=[];
 m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));
 m.require=id=>id==='./word-paragraph-spacing-v1.cjs'?{...actual(id),inspectDocumentParagraphSpacing(doc){events.push('validate:'+envelope.deriveVisibleTextFromDocument(doc).slice(0,1));return actual(id).inspectDocumentParagraphSpacing(doc);}}:actual(id);
 m._compile(fs.readFileSync(file,'utf8'),file);return {core:m.exports,events,reset(){events.length=0;}};
}
function pairNoteFreeze(x) {if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(pairNoteFreeze);Object.freeze(x);}return x;}
function pairNoteFixture(n=10,schemaVersion=3,first='AxxB 😀 tail') {
 const source=d(p(first),p(''),{type:'paragraph',content:[{type:'text',text:'hard'},{type:'hardBreak'},{type:'text',text:'break'}]},...Array.from({length:n-5},()=>p('repeat')),
  {type:'orderedList',attrs:{start:3},content:['List alpha','List beta'].map(text=>({type:'listItem',content:[p(text)]}))});
 return pending.bindLedger({schemaVersion,source,revisions:[revision(1,3)],undo:[],redo:[],...(schemaVersion>=2?{roundUndo:[],roundRedo:[],returnReceipts:[]}:{}),
  ...([3,5].includes(schemaVersion)?{noteSourcePoints:[1,3,1].map((offsetUtf16,i)=>({noteId:'note-'+i,paragraphIndex:0,offsetUtf16}))}:{})});
}
function pairNotePublicComposition(core,beforeDoc,afterDoc) {
 const beforeLedger=core.readLedger(beforeDoc),afterLedger=core.readLedger(afterDoc);
 return {beforeLedger,afterLedger,beforePoints:core.noteProjection(beforeDoc),afterPoints:core.noteProjection(afterDoc)};
}
test('paired raw documents retain complete public projections, original aliases and fresh arrays with two full validations',()=>{
 const h=pairedNoteObserver();
 for(const n of [10,20,40])for(const schema of [1,2,3,5]) {
  const before=pairNoteFreeze(pairNoteFixture(n,schema)),after=pairNoteFreeze(pending.decide(before,{action:'rejectAll'}).doc),bytes=JSON.stringify({before,after});
  h.reset();const expected=pairNotePublicComposition(h.core,before,after);assert.equal(h.events.length,4,'old public composition seam, not total envelope validation');
  h.reset();const actual=h.core.readNoteProjectionPair(before,after);assert.deepEqual(actual,expected);assert.equal(actual.beforeLedger,before.attrs[pending.KEY]);assert.equal(actual.afterLedger,after.attrs[pending.KEY]);
  if(schema===3||schema===5){assert.deepEqual(actual.beforePoints.map(x=>x.globalOffsetUtf16),[1,1,1]);assert.deepEqual(actual.afterPoints.map(x=>x.globalOffsetUtf16),[1,3,1]);assert.notEqual(actual.beforePoints,expected.beforePoints);}
  else {assert.equal(actual.beforePoints,null);assert.equal(actual.afterPoints,null);}
  assert.equal(JSON.stringify({before,after}),bytes);assert.equal(h.events.length,2,'isolated pair readLedger source inspections; internal point validation retained');
  const same=h.core.readNoteProjectionPair(before,before),again=h.core.readNoteProjectionPair(before,before);assert.equal(same.beforeLedger,same.afterLedger);
  if(same.beforePoints){assert.notEqual(same.beforePoints,same.afterPoints);assert.notEqual(same.beforePoints,again.beforePoints);assert.notEqual(same.beforePoints[0],again.beforePoints[0]);}
 }
 for(const before of [null,d(p('plain')),{...d(p('plain')),attrs:{[pending.KEY]:null}}])assert.deepEqual(h.core.readNoteProjectionPair(before,before),{beforeLedger:null,afterLedger:null,beforePoints:null,afterPoints:null});
});
test('both real raw ledger validations precede either derived projection and preserve before-first refusal',()=>{
 const h=pairedNoteObserver(),before=pairNoteFixture(),after=pairNoteFixture(10,3,'ZxxB 😀 tail');
 for(const [label,doc] of [['before',before],['after',after]]) {
  const l=doc.attrs[pending.KEY];l.noteSourcePoints=new Proxy(l.noteSourcePoints,{get(target,key,receiver){if(key==='map')h.events.push('derive:'+label);return Reflect.get(target,key,receiver);}});
 }
 pairNoteFreeze(before);pairNoteFreeze(after);h.reset();const result=h.core.readNoteProjectionPair(before,after);
 assert.deepEqual(result.beforePoints.map(p=>p.offsetUtf16),[1,1,1]);assert.deepEqual(result.afterPoints.map(p=>p.offsetUtf16),[1,1,1]);
 assert.deepEqual(h.events,['validate:A','validate:Z','derive:before','derive:after']);
 const badAfter=plain(after);badAfter.attrs[pending.KEY].schemaVersion=4;h.reset();
 assert.throws(()=>h.core.readNoteProjectionPair(before,pairNoteFreeze(badAfter)),e=>e.code==='PENDING_REVISIONS_INVALID');assert.deepEqual(h.events,['validate:A']);
 const badBefore=plain(before);badBefore.attrs[pending.KEY].noteSourcePoints[0].offsetUtf16=2;h.reset();
 assert.throws(()=>h.core.readNoteProjectionPair(pairNoteFreeze(badBefore),badAfter),e=>e.code==='PENDING_NOTE_REFERENCE_CONSUMED');assert.deepEqual(h.events,['validate:A']);
 const orderError=Object.assign(Error('DERIVED_MAP_OBSERVED'),{code:'DERIVED_MAP_OBSERVED'}),probe=pairNoteFixture();
 probe.attrs[pending.KEY].noteSourcePoints=new Proxy(probe.attrs[pending.KEY].noteSourcePoints,{get(target,key,receiver){if(key==='map')throw orderError;return Reflect.get(target,key,receiver);}});
 assert.throws(()=>h.core.readNoteProjectionPair(probe,badAfter),e=>e.code==='PENDING_REVISIONS_INVALID');
 assert.throws(()=>h.core.readNoteProjectionPair(probe,after),e=>e===orderError);
});
test('paired projection retains modes, schema absence, consumed/surrogate/history/descriptor refusals and fresh calls',()=>{
 const h=pairedNoteObserver(),healthy=pairNoteFixture(),noPoints=plain(pending.readLedger(healthy));delete noPoints.noteSourcePoints;noPoints.schemaVersion=5;
 const plainFive=pending.bindLedger(noPoints);assert.equal(h.core.noteProjection(plainFive,'bad'),null);assert.equal(h.core.noteProjection(null,'bad'),null);assert.equal(h.core.noteProjection(d(p('plain')),'bad'),null);
 for(const [mode,offsets] of [['current',[1,1,1]],['original',[1,3,1]],['export',[1,3,1]]])assert.deepEqual(h.core.noteProjection(healthy,mode).map(p=>p.globalOffsetUtf16),offsets);
 assert.throws(()=>h.core.noteProjection(healthy,'bad'),e=>e.code==='PENDING_NOTE_POINT_MODE');
 const mutations=[['PENDING_NOTE_REFERENCE_CONSUMED',l=>l.noteSourcePoints[0].offsetUtf16=2],['PENDING_NOTE_POINT_BOUNDARY',l=>l.noteSourcePoints[0].offsetUtf16=6],
  ['PENDING_REVISIONS_HISTORY_BUDGET',l=>l.undo=Array(129).fill(['pending'])],['PENDING_NOTE_POINTS_INVALID',l=>l.noteSourcePoints[0].noteId='bad/name'],['PENDING_REVISIONS_INVALID',l=>l.schemaVersion=4]];
 for(const [code,mutate] of mutations)for(const side of ['before','after','both']) {
  const bad=plain(healthy);mutate(bad.attrs[pending.KEY]);const input=pairNoteFreeze({before:side==='after'?plain(healthy):plain(bad),after:side==='before'?plain(healthy):plain(bad)}),bytes=JSON.stringify(input);
  assert.throws(()=>h.core.readNoteProjectionPair(input.before,input.after),e=>e.name==='Error'&&e.code===code&&e.message===code);assert.equal(JSON.stringify(input),bytes);
 }
 const mismatched=plain(healthy);mismatched.content[0]=p('forged');assert.throws(()=>h.core.readNoteProjectionPair(healthy,mismatched),e=>e.code==='PENDING_REVISIONS_PROJECTION_MISMATCH');
 // These are malformed ledger/history operands, not a new outer-doc boundary.
 for(const kind of ['getter','toJSON','cycle']) {
  const bad=plain(healthy),l=bad.attrs[pending.KEY];let invoked=0;
  if(kind==='getter')Object.defineProperty(l,'undo',{get(){invoked++;return [];},enumerable:true});
  if(kind==='toJSON')l.toJSON=()=>{invoked++;return {};};if(kind==='cycle')l.roundUndo.push(l);
  assert.throws(()=>h.core.readNoteProjectionPair(bad,healthy),e=>e.code==='PENDING_REVISIONS_DATA_INVALID');assert.equal(invoked,0);
 }
 const fresh=plain(healthy),first=h.core.readNoteProjectionPair(fresh,fresh);fresh.attrs[pending.KEY].noteSourcePoints[0].offsetUtf16=4;
 const second=h.core.readNoteProjectionPair(fresh,fresh);assert.equal(first.beforePoints[0].offsetUtf16,1);assert.equal(second.beforePoints[0].offsetUtf16,2);assert.notEqual(first.beforePoints,second.beforePoints);assert.equal(second.beforeLedger,fresh.attrs[pending.KEY]);
 fresh.attrs[pending.KEY].noteSourcePoints[0].offsetUtf16=2;assert.throws(()=>h.core.readNoteProjectionPair(fresh,fresh),e=>e.code==='PENDING_NOTE_REFERENCE_CONSUMED');
});


// Shared tiny source operands; Word normalization below is independent XML,
// anchored to retained SOURCE62/64 observations, not a native acceptance claim.
function bookNoteDefaultsData(projectId, ids, history = 'none') {
  const docs=[d(p('Альфа 😀 строка')),d(p('Beta stable')),d(p('Гамма owner'))];
  if(history!=='none')docs[1]=pending.bindLedger(ledger(d(p('Beta stable')),[{...revision(0,1,'insert'),state:history==='resolved'?'accepted':'pending'}]));
  const body=d({type:'paragraph',attrs:{wordParagraphSpacing:{before:0,after:120},wordParagraphMarkLanguage:{val:'ru-RU'}},content:[
    {type:'hardBreak'},{type:'text',text:'Язык 😀',marks:[{type:'bold'},{type:'textStyle',attrs:{fontFamily:'Georgia',fontSize:'14pt',wordLanguage:{val:'ru-RU',eastAsia:'ja-JP',bidi:'he-IL'}}}]},
    {type:'hardBreak'},{type:'text',text:'kept tail'},{type:'hardBreak'}]},p(''),p(''));
  const records=[0,0,2].map((owner,i)=>({id:'fresh-book-note-'+i,scope:'manuscript',title:'',body:notes.validateNoteBody(body).text,
    manuscript:notes.bindManuscriptPayload({kind:i===1?'endnote':'footnote',body,sceneId:ids[owner],offsetUtf16:owner===0?6:2,sceneContent:envelope.composeObservablePayload({doc:docs[owner]})})}));
  const document={schemaVersion:1,projectId,notes:[...records,{id:'private-kept',scope:'project',title:'Private',body:'Private retained'},
    {...plain(records[0]),id:'deleted-kept',deleted:true},{...plain(records[0]),id:'foreign-kept',manuscript:notes.bindManuscriptPayload({kind:'footnote',body,sceneId:'foreign/outside.txt',offsetUtf16:0,sceneContent:'Foreign'})}]};
  return {docs,document,ids};
}
function bookNoteDefaultsWordParts(original) {
  const parts={...original};
  parts['word/styles.xml']=parts['word/styles.xml'].replace('<w:rPrDefault><w:rPr>','<w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:lang w:val="ru-FI" w:eastAsia="ru-RU" w:bidi="ar-SA"/>')
    .replace('</w:docDefaults>','<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="278" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>');
  for(const name of ['word/styles.xml','word/footnotes.xml','word/endnotes.xml'])parts[name]=parts[name].replaceAll('FootnoteText','ObservedFootnote').replaceAll('EndnoteText','ObservedEndnote').replaceAll('w:before="0"','');
  for(const name of ['word/footnotes.xml','word/endnotes.xml'])parts[name]=parts[name].replace(/<w:r>(<w:rPr>(?:(?!<\/w:rPr>)[^])*<\/w:rPr>)<w:t[^>]*>Язык 😀<\/w:t><\/w:r>/gu,
    (_all,properties)=>`<w:r>${properties}<w:t xml:space="preserve">Язык </w:t></w:r><w:r>${properties}<w:t>😀</w:t></w:r>`);
  return parts;
}
function retainBookNoteDefaults(label, values) {
  if(!process.env.YALKEN_BOOK_NOTE_DEFAULTS_EVIDENCE_DIR)return;
  const root=process.env.YALKEN_BOOK_NOTE_DEFAULTS_EVIDENCE_DIR;fs.mkdirSync(root,{recursive:true});
  fs.writeFileSync(path.join(root,label+'.v8'),require('node:v8').serialize(values),{flag:'wx'});
}
async function bookNoteDefaultsFixture(history='none') {
  const data=bookNoteDefaultsData(projectId,['roman/a.txt','roman/b.txt','roman/c.txt'],history),bridge=await import('../../src/io/revisionBridge/index.mjs');
  const main=fs.readFileSync(require.resolve('../../src/main.js'),'utf8'),realm=vm.createContext({crypto,Buffer,isPlainObjectValue:x=>!!x&&typeof x==='object'&&!Array.isArray(x)});
  vm.runInContext(['stableRtkReviewTransportJson','createRtkReviewTransportCryptoPort'].map(name=>main.match(new RegExp('function '+name+'\\([^]*?\\n}(?=\\n|$)'))[0]).join('\n')+'\nthis.cryptoPort=createRtkReviewTransportCryptoPort();',realm);
  const source=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js').buildFullManuscriptDocxReviewPacketSource({projectId,projectRoot:'/project',notesDocument:data.document,
    scenes:data.ids.map((sceneId,i)=>({sceneId,scenePath:'/project/'+sceneId,order:i,doc:data.docs[i],text:envelope.deriveVisibleTextFromDocument(data.docs[i]),observableContent:envelope.composeObservablePayload({doc:data.docs[i]})}))},{revisionBridge:bridge,cryptoPort:realm.cryptoPort});
  const originalBytes=builder.buildDocxReviewPacketBuffer(source),original=bridge.extractDocxReviewTransportPackagePartsFromZipBytes(originalBytes).parts,parts=bookNoteDefaultsWordParts(original);
  const read=parts=>{const bytes=buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data}))),analysis=bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes},{cryptoPort:{sha256Text:hash,sha256Json:x=>'sha256:'+hash(JSON.stringify(x)),byteLength:x=>Buffer.byteLength(x)}});
    assert.equal(analysis.ok,true,JSON.stringify({code:analysis.code,reasons:analysis.reasons}));return {bytes,analysis,returnedNotes:bridge.parseDocumentNotesRichReturn(bytes,analysis.reviewIr.documentNotes,{includeBreakProjection:true})};};
  const observed=read(parts),input={document:data.document,projectId,roundId:'fresh-book-note-defaults',artifactSha256:hash(observed.bytes),baseline:source.documentNotes,
    exportMap:source.localAuthorityCapsule.exportMap,returnedNotes:observed.returnedNotes,returnedParagraphs:observed.analysis.reviewIr.formattingParagraphs,now:'2026-10-08T19:00:00Z'};
  return {...data,bridge,source,originalBytes,original,parts,read,...observed,input};
}
test('fresh book V2 complete defaults retain original notes and real edits remain explicit',async()=>{
  const f=await bookNoteDefaultsFixture(),before=plain({document:f.document,source:f.source}),beforeBytes=require('node:v8').serialize({document:f.document,source:f.source}),actual=delta.planNoteReturnDelta(f.input);
  retainBookNoteDefaults('core-ordinary',{...before,docs:f.docs,originalBytes:f.originalBytes,parts:f.parts,bytes:f.bytes,analysis:f.analysis,input:f.input,actual});
  assert.equal(actual.unchanged,true);assert.equal(actual.document,f.document);assert.deepEqual(actual.changes,[]);
  assert.equal(require('node:v8').serialize({document:f.document,source:f.source}).equals(beforeBytes),true,'complete input bytes changed');assert.equal(Object.hasOwn(actual.document,'wordNoteReturnReceipts'),false);
  const parts={...f.parts,'word/footnotes.xml':f.parts['word/footnotes.xml'].replace('kept tail','kept EDIT')},edited=f.read(parts);
  const input={...f.input,artifactSha256:hash(edited.bytes),returnedNotes:edited.returnedNotes},plan=delta.planNoteReturnDelta(input);
  retainBookNoteDefaults('core-real-edit',{input,parts,bytes:edited.bytes,actual:plan});assert.equal(plan.changes.length,1);assert.equal(plan.changes[0].noteId,'fresh-book-note-0');
  assert.equal(plan.changes[0].operation,'update');assert.equal(plan.document.wordNoteReturnReceipts.length,1);
  for(const old of f.document.notes.filter(n=>n.id!=='fresh-book-note-0'))assert.equal(require('node:util').isDeepStrictEqual(plan.document.notes.find(n=>n.id===old.id),old),true,'unrelated note changed');
  const renamed={...f.parts};for(const kind of ['footnote','endnote']) {
    renamed['word/'+kind+'s.xml']=renamed['word/'+kind+'s.xml'].replace(new RegExp('(<w:'+kind+'\\b[^>]*\\bw:id=")([1-9][0-9]*)(")','gu'),(_all,a,id,b)=>a+(Number(id)+10)+b);
    renamed['word/document.xml']=renamed['word/document.xml'].replace(new RegExp('(<w:'+kind+'Reference\\b[^>]*\\bw:id=")([1-9][0-9]*)(")','gu'),(_all,a,id,b)=>a+(Number(id)+10)+b);
  }
  const renumbered=f.read(renamed),renumberInput={...f.input,artifactSha256:hash(renumbered.bytes),returnedNotes:renumbered.returnedNotes},renumberPlan=delta.planNoteReturnDelta(renumberInput);
  retainBookNoteDefaults('core-native-renumber',{input:renumberInput,parts:renamed,bytes:renumbered.bytes,actual:renumberPlan});assert.equal(renumberPlan.unchanged,true);assert.equal(renumberPlan.document,f.document);
});
test('fresh book V2 closed local roster and complete break facts refuse corruption without mutation',async()=>{
 const f=await bookNoteDefaultsFixture(),faults=[['profile',x=>x.baseline.breakEmission.fontFamily='Arial'],['partial',x=>delete x.baseline.breakEmission.wordLanguage],
  ['unknown',x=>x.baseline.breakEmission.schemaVersion=99],['scene-order',x=>x.exportMap.scenes.reverse()],['scene-duplicate',x=>x.exportMap.scenes[1].sceneId=x.exportMap.scenes[0].sceneId],
  ['scene-null',x=>x.exportMap.scenes[0]=null],['block-null',x=>x.exportMap.scenes[0].blocks[0]=null],['format-null',x=>x.exportMap.scenes[0].blocks[0].formatIr=null],
  ['runs-object',x=>x.exportMap.scenes[0].blocks[0].formatIr.runs={}],['runs-null',x=>x.exportMap.scenes[0].blocks[0].formatIr.runs=null],['run-null',x=>x.exportMap.scenes[0].blocks[0].formatIr.runs[0]=null],
  ['run-text',x=>x.exportMap.scenes[0].blocks[0].formatIr.runs[0].text=null],['binding-null',x=>x.baseline.sourceBindings[0]=null],['binding-array',x=>x.baseline.sourceBindings[0]=[]],
  ['block-duplicate',x=>x.exportMap.scenes[1].blocks[0].blockId=x.exportMap.scenes[0].blocks[0].blockId],['global',x=>x.exportMap.scenes[1].blocks[0].documentParagraphIndex=0],
  ['source-hash',x=>x.exportMap.scenes[0].blocks[0].canonicalTextSha256='sha256:'+'0'.repeat(64)],['binding-hash',x=>x.baseline.sourceBindings[0].blockTextSha256='0'.repeat(64)],
  ['roster',x=>x.baseline.sourceBindings.pop()],['transport',x=>x.baseline.sourceBindings[0].transportIdentity='_YALKEN_NOTE_'+'0'.repeat(24)],
  ['native-duplicate',x=>x.baseline.sourceBindings[2].nativeId=x.baseline.sourceBindings[0].nativeId],['surrogate',x=>x.baseline.sourceBindings[0].offsetUtf16=7],
  ['break',x=>delete x.returnedNotes[0].breakProjection],['point',x=>x.returnedNotes[0].offsetUtf16=7],['returned-duplicate',x=>x.returnedNotes.push(plain(x.returnedNotes[0]))]];
 for(const [name,mutate] of faults) {const input=plain(f.input);mutate(input);const before=JSON.stringify(input);let failure;try{delta.planNoteReturnDelta(input);}catch(error){failure={code:error.code||error.message};}
  retainBookNoteDefaults('core-refuse-'+name,{input,failure});assert.ok(failure,'missing refusal '+name);assert.match(failure.code,/NOTE_RETURN_|PENDING_NOTE_/u,name);assert.equal(JSON.stringify(input),before,'mutated '+name);}
 for(const properties of ['<w:b/>','<w:rFonts w:eastAsia="Arial"/>','<w:rFonts w:cs="Arial"/>','<w:szCs w:val="28"/>',...['val','eastAsia','bidi'].map(field=>`<w:lang w:${field}="en-GB"/>`)]) {
  const parts={...f.parts,'word/footnotes.xml':f.parts['word/footnotes.xml'].replace('<w:r><w:br/></w:r>',`<w:r><w:rPr>${properties}</w:rPr><w:br/></w:r>`)},observed=f.read(parts),input={...f.input,returnedNotes:observed.returnedNotes};let failure;
  try{delta.planNoteReturnDelta(input);}catch(error){failure={code:error.code||error.message};}retainBookNoteDefaults('core-break-'+hash(properties),{input,parts,bytes:observed.bytes,failure});assert.equal(failure?.code,'NOTE_RETURN_BREAK_CHANGED',properties);
 }
});
