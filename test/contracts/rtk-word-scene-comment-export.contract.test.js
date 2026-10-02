'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {createRequire} = require('node:module');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const {exactAnchor} = require('../../src/core/word-comment-authoring-v1.cjs');
const {commentStateDigest,compareCommentExportReadback} = require('../../src/export/docx/docxReviewPacketComments.js');
const {buildStoredZip} = require('../../src/export/docx/docxMinBuilder.js');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const read = file => fs.readFileSync(file,'utf8');
const p = text => ({type:'paragraph',content:[{type:'text',text,marks:[{type:'bold'}]}]});

// Reuse the existing entire-Main fixture and its real manifest/lease/writer.
// Extend only the test-private accessor, never any production authority port.
async function fixture(t,{empty=false}={}) {
  const file=path.join(__dirname,'rtk-word-scene-identity-main.contract.test.js');
  let source=read(file).split("\ntest('actual Main simultaneous")[0];
  // Disposable safeStorage adapter: exercise the actual encrypted key-store
  // writer/reader without accessing the owner's OS keychain.
  source=source.replace('const electron = { app,',`const electron = { safeStorage: {
    isEncryptionAvailable:()=>true,
    encryptString(value){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',Buffer.alloc(32,9),iv);return Buffer.concat([iv,cipher.update(value,'utf8'),cipher.final(),cipher.getAuthTag()]);},
    decryptString(value){const cipher=crypto.createDecipheriv('aes-256-gcm',Buffer.alloc(32,9),value.subarray(0,12));cipher.setAuthTag(value.subarray(-16));return Buffer.concat([cipher.update(value.subarray(12,-16)),cipher.final()]).toString('utf8');},
  }, app,`);
  source=source.replace('snapshot: requestEditorSnapshot,','snapshot: requestEditorSnapshot, reviewSource: readDocxReviewPacketExportSource, reviewBuild: buildDocxReviewPacketBuffer, reviewCheck: revalidateSceneNoteReviewExportSource, reviewExport: handleReviewDocxExportPacketCommandSurface, commentApply: applyAuthenticatedCommentDelta, cryptoPort: createRtkReviewTransportCryptoPort,');
  const mod={exports:{}};
  new Function('require','module','__dirname',source+'\nmodule.exports={fixture};')(createRequire(file),mod,__dirname);
  const f=await mod.exports.fixture(t), sceneId=path.relative(f.root,f.alpha).split(path.sep).join('/');
  const siblingId=path.relative(f.root,f.beta).split(path.sep).join('/');
  const text='Before 🧭 anchor and after.', doc={type:'doc',content:[p(text),p('Second exact anchor')]};
  const raw=envelope.composeObservablePayload({doc,metaEnabled:true,meta:{status:'черновик',synopsis:'Scene comments',tags:{}},cards:[]});
  fs.writeFileSync(f.alpha,raw);
  const thread=(id,owner,paragraphIndex,startUtf16,selectedText,status='open')=>({threadId:'thread-'+id,sceneId:owner,rootCommentId:'root-'+id,status,
    anchor:exactAnchor({paragraphIndex,startUtf16,selectedText},owner,owner===sceneId?[text,'Second exact anchor']:['Beta']),
    messages:[{commentId:'root-'+id,kind:'root',body:'Root '+id,provenance:{author:' Alice & <編集> ',initials:'AE',date:'2026-10-02T10:00:37.562Z'}},
      {commentId:'reply-'+id,kind:'reply',body:'Reply '+id+'\n尾',provenance:{author:'Bob'}}]});
  const threads=empty?[]:[thread('selected',sceneId,0,7,'🧭 anchor'),thread('resolved',sceneId,1,0,'Second','resolved'),thread('deleted',sceneId,0,7,'🧭 anchor','deleted')];
  threads.push(thread('sibling',siblingId,0,0,'Beta'));
  threads.at(-1).messages[0].body='SIBLING_PRIVATE_BODY';
  const state={schemaVersion:'yalken.rtk.word.non-text-return-state.v1',projectId:f.query.projectId,revision:4,threads,events:[]};
  const statePath=path.join(f.root,'.yalken/word-review/non-text-return-state.v1.json');
  fs.mkdirSync(path.dirname(statePath),{recursive:true});fs.writeFileSync(statePath,JSON.stringify(state,null,2)+'\n');
  f.probe.state({filePath:f.alpha,dirty:false,generation:0});
  const url=f.probe.shellUrl(), wc={id:901,session:{},getURL:()=>url,isDestroyed:()=>false,send(channel,payload){
    if(channel==='editor:snapshot-request') queueMicrotask(()=>f.listeners.get('editor:snapshot-response')({sender:wc,senderFrame:{url}},
      {requestId:payload.requestId,snapshot:{content:read(f.alpha),generation:0,projectId:f.query.projectId,documentId:f.a.nodeId}}));
  }};
  f.probe.state({window:{webContents:wc,isDestroyed:()=>false}});
  const bridge=await import('../../src/io/revisionBridge/index.mjs');
  return Object.assign(f,{sceneId,siblingId,raw,state,statePath,bridge});
}
function parts(f,bytes){return f.bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes}).parts;}
function parsed(f,bytes,source){
  const result=f.bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes,...(source?{hmacSecret:source.forbiddenSecret,expectedAuthority:source.localAuthorityCapsule.expectedAuthority}:{})},{cryptoPort:f.probe.cryptoPort()});
  assert.equal(result.ok,true,JSON.stringify(result.reasons));return result;
}

test('actual Main Review source emits only selected comments, full canonical digest and provisional/final ZIP proof',async t=>{
  const f=await fixture(t), before=f.capture(), source=await f.probe.reviewSource();
  assert.ok(source.sceneNoteBinding);assert.equal(source.commentExport.stateDigest,commentStateDigest(f.state));
  assert.deepEqual(source.commentExport.threads.map(x=>x.threadId),['thread-selected','thread-resolved']);
  assert.deepEqual(source.commentExport.tombstones.map(x=>x.threadId),['thread-deleted']);
  const result=await f.probe.reviewBuild(source), decoded=parsed(f,result.documentBuffer,source), xml=parts(f,result.documentBuffer);
  assert.deepEqual(result.publicationGate.commentProofs.map(x=>x.phase),['provisional','final']);
  assert.equal(decoded.authorityCarrier.status,'verified-baseline-bound');
  assert.equal(decoded.authorityCarrier.selectedCarrier.payload.commentStateDigest,commentStateDigest(f.state));
  assert.equal(decoded.authorityCarrier.selectedCarrier.payload.commentSummary.exportedThreadCount,2);
  assert.equal(compareCommentExportReadback(source.commentExport,decoded.reviewIr.commentThreads).ok,true);
  assert.equal(Object.values(xml).join('\n').includes('SIBLING_PRIVATE_BODY'),false);
  assert.equal(Object.values(xml).join('\n').includes('thread-sibling'),false);
  await f.probe.reviewCheck(source);assert.deepEqual(f.capture(),before);
});
test('actual Main Minimal publishes selected roots/replies/provenance/resolved state and generic rich import',async t=>{
  const f=await fixture(t), before=f.capture(), target=path.join(f.temp,'scene-min.docx');f.chooseSavePath(target);
  const receipt=await f.probe.exportMin({requestId:'scene-min',path:target});assert.equal(receipt.ok,1,JSON.stringify(receipt));
  const bytes=fs.readFileSync(target), result=parsed(f,bytes), zip=parts(f,bytes);
  assert.equal(result.reviewIr.commentThreads.length,2);assert.equal(result.reviewIr.commentThreads[0].replies[0].body,'Reply selected\n尾');
  assert.equal(result.reviewIr.commentThreads[1].status,'RESOLVED');assert.equal(result.reviewIr.commentThreads[0].quotedAnchorText,'🧭 anchor');
  assert.equal(Object.values(zip).join('\n').includes('SIBLING_PRIVATE_BODY'),false);
  const preview=f.bridge.buildDocxContentPreviewFromZipBytes(bytes);assert.equal(preview.ok,true,JSON.stringify(preview));
  assert.deepEqual(f.capture(),before);
});
test('actual Main empty selected scope retains full digest and explicit final absence proof',async t=>{
  const f=await fixture(t,{empty:true}), source=await f.probe.reviewSource(), output=await f.probe.reviewBuild(source);
  assert.ok(source.sceneNoteBinding);assert.equal(source.commentExport.stateDigest,commentStateDigest(f.state));
  assert.deepEqual(source.commentExport.threads,[]);assert.deepEqual(output.publicationGate.commentProofs,[{phase:'final',ok:true,unchangedThreadIds:[],missing:[],changed:[]}]);
  const target=path.join(f.temp,'empty-min.docx');f.chooseSavePath(target);
  assert.equal((await f.probe.exportMin({path:target})).ok,1);assert.equal(parsed(f,fs.readFileSync(target)).reviewIr.commentThreads.length,0);
});
test('actual selected-scene signed producer, activation, explicit comment return atomic writer and replay preserve sibling bytes',async t=>{
  const f=await fixture(t), source=await f.probe.reviewSource(), output=await f.probe.reviewBuild(source);
  // The actual producer binds its own new round; publication uses the actual
  // transition, durable CAS writer and crypto port rather than an inherited round.
  await f.probe.activate(source.pendingAuthorityStore);
  const published=f.probe.strict(f.root).record.roundsById[source.localAuthorityCapsule.roundId];f.probe.fresh(published);
  const zip=parts(f,output.documentBuffer);zip['word/comments.xml']=zip['word/comments.xml'].replace('Root selected','Changed selected');
  // Exact native Word timestamp precision law: both representations may be
  // minute-truncated; authenticated canonical provenance must remain exact.
  for(const name of ['word/comments.xml','word/commentsExtensible.xml'])zip[name]=zip[name].replaceAll('2026-10-02T10:00:37.562Z','2026-10-02T10:00:00Z');
  const bytes=buildStoredZip(Object.entries(zip).map(([name,data])=>({name,data}))), intake=parsed(f,bytes,source);
  const sibling=JSON.stringify(f.state.threads.at(-1)), sceneBefore=read(f.alpha), siblingSceneBefore=read(f.beta);
  const context={projectId:f.query.projectId,projectRoot:f.root,reviewTransportAuthorityCapsule:published,
    reviewTransportReturnIntake:{authenticated:true,returnedArtifactSha256:'sha256:'+sha(bytes),parserResult:intake}};
  let prepared;
  const request={context,requestId:'single-scene-return',docxBytes:bytes,revisionBridge:f.bridge,isCurrent:()=>true,onPrepared:value=>{prepared=value;}};
  const preview=await f.probe.commentApply(request);assert.equal(preview.status,'preview-ready',JSON.stringify(preview));
  assert.equal((await prepared.apply()).ok,true);
  const after=JSON.parse(read(f.statePath));assert.equal(after.threads[0].messages[0].body,'Changed selected');
  assert.deepEqual(after.threads[0].messages[0].provenance,f.state.threads[0].messages[0].provenance);
  assert.equal(JSON.stringify(after.threads.at(-1)),sibling);assert.equal(read(f.alpha),sceneBefore);assert.equal(read(f.beta),siblingSceneBefore);
  assert.equal((await f.probe.commentApply({...request,explicitCanonicalApplyConfirmed:true})).status,'replayed');
});
test('actual Main Minimal comment projection preserves a codeBlock multiline UTF16 anchor',async t=>{
  const f=await fixture(t), text='one\n🧭 anchor';
  const doc={type:'doc',content:[{type:'codeBlock',content:[{type:'text',text}]}]};
  fs.writeFileSync(f.alpha,envelope.composeObservablePayload({doc}));
  f.state.threads=f.state.threads.filter(thread=>thread.sceneId!==f.sceneId);
  f.state.threads.push({threadId:'code-thread',sceneId:f.sceneId,rootCommentId:'code-root',status:'open',
    anchor:exactAnchor({paragraphIndex:0,startUtf16:4,selectedText:'🧭 anchor'},f.sceneId,[text]),messages:[{commentId:'code-root',kind:'root',body:'Code comment'}]});
  fs.writeFileSync(f.statePath,JSON.stringify(f.state));const target=path.join(f.temp,'code-min.docx');f.chooseSavePath(target);
  const result=await f.probe.exportMin({path:target});assert.equal(result.ok,1,JSON.stringify(result));
  const thread=parsed(f,fs.readFileSync(target)).reviewIr.commentThreads[0];assert.equal(thread.quotedAnchorText,'🧭 anchor');
  assert.equal(thread.anchorRange.startUtf16,4);assert.equal(thread.body,'Code comment');
});
for(const mode of ['review','minimal'])test(`actual Main ${mode} refuses a source change during final comment read before publication`,async t=>{
  const f=await fixture(t), source=mode==='review'?await f.probe.reviewSource():null;
  const target=path.join(f.temp,'stale.docx');f.chooseSavePath(target);
  const fsp=require('node:fs/promises'), original=fsp.readFile;let reads=mode==='review'?1:0;
  fsp.readFile=async function(file,...args){const result=await original.call(this,file,...args);
    if(file===f.statePath && ++reads===2)fs.writeFileSync(f.alpha,f.raw+'\nconcurrent canonical change');return result;};
  try{
    if(mode==='review')await assert.rejects(f.probe.reviewCheck(source),/SOURCE_STALE/);
    else{const result=await f.probe.exportMin({path:target});assert.equal(result.ok,0,JSON.stringify(result));assert.equal(result.error.details.message,'DOCX_SOURCE_CHANGED');}
    assert.equal(fs.existsSync(target),false);assert.match(read(f.alpha),/concurrent canonical change$/);
  }finally{fsp.readFile=original;}
});
for(const mode of ['review','minimal'])test(`actual Main ${mode} refuses sibling comment changes at final awaited read`,async t=>{
  const f=await fixture(t), source=mode==='review'?await f.probe.reviewSource():null;
  const target=path.join(f.temp,'stale-comments.docx');f.chooseSavePath(target);
  const fsp=require('node:fs/promises'), original=fsp.readFile;let reads=mode==='review'?1:0;
  fsp.readFile=async function(file,...args){const result=await original.call(this,file,...args);
    if(file===f.statePath && ++reads===2){const changed=JSON.parse(result);changed.revision++;changed.threads.at(-1).messages[0].body='Concurrent sibling edit';fs.writeFileSync(file,JSON.stringify(changed));}return result;};
  try{
    if(mode==='review')await assert.rejects(f.probe.reviewCheck(source),/COMMENTS_STALE/);
    else{const result=await f.probe.exportMin({path:target});assert.equal(result.ok,0,JSON.stringify(result));assert.equal(result.error.details.message,'DOCX_COMMENTS_CHANGED');}
    assert.equal(fs.existsSync(target),false);assert.equal(JSON.parse(read(f.statePath)).threads.at(-1).messages[0].body,'Concurrent sibling edit');
  }finally{fsp.readFile=original;}
});
test('actual Main Review command writes verified ZIP before activating its own newly produced durable round',async t=>{
  const f=await fixture(t), target=path.join(f.temp,'published-review.docx');f.chooseSavePath(target);
  const result=await f.probe.reviewExport({path:target,requestId:'publish-selected-comments'});assert.equal(result.ok,true,JSON.stringify(result));
  const durable=f.probe.strict(f.root).record, active=durable.roundsById[durable.lastRoundId];
  assert.equal(active.lifecycleState,'PUBLISHED_ACTIVE');assert.equal(active.commentExport.stateDigest,commentStateDigest(f.state));
  const imported=parsed(f,fs.readFileSync(target));assert.equal(imported.reviewIr.commentThreads.length,2);
  assert.equal(Object.values(parts(f,fs.readFileSync(target))).join('\n').includes('SIBLING_PRIVATE_BODY'),false);
});
for(const mode of ['review','minimal'])for(const change of ['comments','notes','manifest','generation'])test(`actual ${mode} command blocks ${change} final-read race without publishing or activating old source`,async t=>{
  const f=await fixture(t), target=path.join(f.temp,'blocked-'+change+'.docx');f.chooseSavePath(target);
  const authority=f.probe.authorityPath(f.root), authorityBefore=fs.existsSync(authority)?read(authority):null;
  const fsp=require('node:fs/promises'), original=fsp.readFile;let reads=0;
  fsp.readFile=async function(file,...args){const result=await original.call(this,file,...args);
    if(file===f.statePath && ++reads===2){
      if(change==='comments'){const value=JSON.parse(result);value.revision++;value.threads.at(-1).messages[0].body='Final foreign change';fs.writeFileSync(file,JSON.stringify(value));}
      if(change==='notes')fs.writeFileSync(path.join(f.root,'notes.craftsman.json'),JSON.stringify({schemaVersion:1,projectId:f.query.projectId,notes:[]}));
      if(change==='manifest'){const value=JSON.parse(read(f.manifestPath));value.revision=(value.revision||0)+1;fs.writeFileSync(f.manifestPath,JSON.stringify(value));}
      if(change==='generation')f.probe.state({generation:1,dirty:true});
    }return result;};
  try{
    const result=mode==='review'?await f.probe.reviewExport({path:target}):await f.probe.exportMin({path:target});
    assert.equal(Boolean(result.ok),false,JSON.stringify(result));assert.match(JSON.stringify(result),/STALE|CHANGED/);
    assert.equal(fs.existsSync(target),false);assert.equal(fs.existsSync(authority)?read(authority):null,authorityBefore);
    if(change==='generation')assert.equal(f.probe.state().dirty,true);
  }finally{fsp.readFile=original;}
});
for(const mode of ['review','minimal'])for(const malformed of ['project','revision','sibling-id','sibling-anchor','sibling-provenance'])test(`actual ${mode} validates omitted sibling ${malformed} before export`,async t=>{
  const f=await fixture(t), target=path.join(f.temp,'invalid.docx');f.chooseSavePath(target);
  const value=structuredClone(f.state), sibling=value.threads.at(-1);
  const expected={project:'RTK_NON_TEXT_STATE_PROJECT_MISMATCH',revision:'RTK_NON_TEXT_STATE_REVISION_INVALID',
    'sibling-id':'DOCX_COMMENT_IDENTITY_COLLISION','sibling-anchor':'DOCX_COMMENT_ANCHOR_INVALID','sibling-provenance':'RTK_COMMENT_PROVENANCE_INVALID'};
  if(malformed==='project')value.projectId='foreign';if(malformed==='revision')value.revision=-1;
  if(malformed==='sibling-id')sibling.messages[0].commentId=value.threads[0].messages[0].commentId;
  if(malformed==='sibling-anchor')sibling.anchor.sceneId=f.sceneId;
  if(malformed==='sibling-provenance')sibling.messages[0].provenance.author=17;
  fs.writeFileSync(f.statePath,JSON.stringify(value));const before=f.capture();
  const result=mode==='review'?await f.probe.reviewExport({path:target}):await f.probe.exportMin({path:target});
  assert.equal(Boolean(result.ok),false,JSON.stringify(result));assert.ok(JSON.stringify(result).includes(expected[malformed]),JSON.stringify(result));
  assert.equal(fs.existsSync(target),false);assert.deepEqual(f.capture(),before);
});
test('actual Review Main gate rejects a forged full-state digest and foreign selected-scene projection',async t=>{
  const f=await fixture(t), source=await f.probe.reviewSource(), before=f.capture();
  await assert.rejects(f.probe.reviewBuild({...source,commentExport:{...source.commentExport,stateDigest:'sha256:'+'a'.repeat(64)}}),/COMMENT_BINDING_MISMATCH/);
  const foreign=structuredClone(source.commentExport);foreign.threads[0].sceneId=f.siblingId;
  await assert.rejects(f.probe.reviewCheck({...source,commentExport:foreign}),/COMMENTS_STALE/);assert.deepEqual(f.capture(),before);
});
for(const mode of ['review','minimal'])test(`actual ${mode} rejects active pending revisions plus comments explicitly before artifact publication`,async t=>{
  const f=await fixture(t), pending=require('../../src/core/word-pending-text-revisions-v1.cjs');
  const original=envelope.parseObservablePayload(read(f.alpha)).doc;
  const doc=pending.bindLedger({schemaVersion:2,source:original,revisions:[{id:'revision-1',nativeId:'51',operation:'insert',author:'Reviewer',
    date:'',dateUtc:'',paragraphIndex:1,from:12,to:13,state:'pending',groupId:null}],undo:[],redo:[],roundUndo:[],roundRedo:[],returnReceipts:[]});
  assert.ok(pending.readLedger(doc));fs.writeFileSync(f.alpha,envelope.composeObservablePayload({doc}));
  const before=f.capture(), target=path.join(f.temp,'pending-comments.docx');f.chooseSavePath(target);
  const result=mode==='review'?await f.probe.reviewExport({path:target}):await f.probe.exportMin({path:target});
  assert.equal(Boolean(result.ok),false,JSON.stringify(result));assert.match(JSON.stringify(result),/PENDING_REVISIONS_ANNOTATION_EXPORT_UNSUPPORTED/);
  assert.equal(fs.existsSync(target),false);assert.deepEqual(f.capture(),before);
});
