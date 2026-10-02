'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const tx = require('../../src/core/project-transaction-v1.cjs');
const { durableSaveTransaction } = require('../../src/core/save-coordinator-v1.cjs');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const bookmarks = require('../../src/core/word-user-bookmarks-v1.cjs');
const notes = require('../../src/core/word-manuscript-notes-v1.cjs');
const pending = require('../../src/core/word-pending-text-revisions-v1.cjs');
const modelPromise = import('../../src/core/project-tree-cohort-v1.mjs');
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const now = '2026-10-02T12:00:00.000Z';
const text = p => fs.readFileSync(p, 'utf8');
function inventory(root) {
  const out=[];
  const walk = relative => {
    const full=path.join(root,relative);
    if(!fs.existsSync(full))return;
    const stat=fs.lstatSync(full);
    if(stat.isDirectory()){out.push({relativePath:relative,role:'directory',contentBase64:null});for(const name of fs.readdirSync(full))walk(relative+'/'+name);return;}
    const base=path.basename(relative);
    const role=relative.startsWith('backups/')?(base==='meta.json'?'backupMetadata':'backupSnapshot'):
      /\.wp201-commit\.json$/.test(base)?'sceneCommit':/^\..+\.bak\.\d{13}$/.test(base)?'recoverySnapshot':'scene';
    out.push({relativePath:relative,role,contentBase64:fs.readFileSync(full).toString('base64')});
  };walk('roman');walk('backups');return out;
}
function fixture(t, rich=false) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'tree-cohort-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'roman'));
  const manifestPath=path.join(root,'project.craftsman.json');
  const manifest={projectId:'project-test',schemaVersion:1,treeIdentity:{schemaVersion:1,nodes:{
    'tree-node-a':{bindingKey:'file:roman/01 Alpha.txt',kind:'scene',present:true},
    'tree-node-b':{bindingKey:'file:roman/02 Beta.txt',kind:'scene',present:true}}}};
  fs.writeFileSync(manifestPath,JSON.stringify(manifest));
  let raw='Alpha 😀';
  if(rich){const doc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:raw}]}]};
    const created=bookmarks.planMutation({doc,action:'create',requestId:'create-one',projectId:manifest.projectId,sceneId:'roman/01 Alpha.txt',name:'Anchor',start:{paragraphIndex:0,offsetUtf16:0,edge:'text'},end:{paragraphIndex:0,offsetUtf16:5,edge:'text'}});
    created.doc.content.push({type:'paragraph',content:[{type:'text',text:'link',marks:[{type:'link',attrs:bookmarks.linkAttrs(created.registry.bookmarks[0])}]}]});
    raw=envelope.composeObservablePayload({doc:created.doc});
    const manuscript=notes.bindManuscriptPayload({kind:'footnote',body:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'note'}]}]},sceneId:'roman/01 Alpha.txt',offsetUtf16:2,sceneContent:raw});
    fs.writeFileSync(path.join(root,'notes.craftsman.json'),JSON.stringify({schemaVersion:1,projectId:manifest.projectId,notes:[{id:'note-source',scope:'manuscript',body:'note',manuscript}]}));
  }
  fs.writeFileSync(path.join(root,'roman/01 Alpha.txt'),raw);fs.writeFileSync(path.join(root,'roman/02 Beta.txt'),'Beta');
  const publishManifest=async({manifestPath,expectedText,nextText,revision})=>{assert.equal(text(manifestPath),expectedText);await durableSaveTransaction({filePath:manifestPath,content:nextText,revision});};
  const capture=extra=>({projectId:manifest.projectId,operationId:'operation-one',operation:'move',manifestPath,beforeManifestText:text(manifestPath),
    bindings:[{nodeId:'tree-node-a',fromRelativePath:'roman/01 Alpha.txt',toRelativePath:'roman/03 Alpha.txt'}],
    inventory:inventory(root),notesText:fs.existsSync(path.join(root,'notes.craftsman.json'))?text(path.join(root,'notes.craftsman.json')):null,commentsText:null,now,expectedTreeRevision:0,...extra});
  return {root,manifestPath,publishManifest,capture,raw};
}
test('tree cohort move commits exact identity then ordinary saved-scene writer continues',async t=>{
  const f=fixture(t),m=await modelPromise,plan=m.planProjectTreeCohort(f.capture());
  const result=await tx.commitProjectTransaction({manifestPath:f.manifestPath,revision:1,treeCohort:plan,publishManifest:f.publishManifest,revalidate:async()=>{}});
  assert.equal(result.success,true);assert.equal(fs.existsSync(path.join(f.root,'roman/01 Alpha.txt')),false);
  assert.equal(text(path.join(f.root,'roman/03 Alpha.txt')),f.raw);
  assert.equal(JSON.parse(text(f.manifestPath)).treeIdentity.nodes['tree-node-a'].bindingKey,'file:roman/03 Alpha.txt');
  const scenePath=path.join(f.root,'roman/03 Alpha.txt');
  assert.equal((await tx.readVerifiedProjectTransaction({scenePath,manifestPath:f.manifestPath})).schemaVersion,'yalken.project-transaction.commit.v7');
  await tx.commitProjectTransaction({scenePath,sceneContent:f.raw+'!',expectedSceneContent:f.raw,manifestPath:f.manifestPath,
    manifestContent:text(f.manifestPath),expectedManifestContent:text(f.manifestPath),revision:2,publishManifest:f.publishManifest});
  assert.equal(text(scenePath),f.raw+'!');
  assert.equal((await tx.readVerifiedProjectTreeMutation({manifestPath:f.manifestPath})).lastMutation.canUndo,false);
});
test('tree cohort exact Undo survives reopen and consumes monotonic token',async t=>{
  const f=fixture(t),m=await modelPromise,before=text(f.manifestPath),plan=m.planProjectTreeCohort(f.capture());
  const result=await tx.commitProjectTransaction({manifestPath:f.manifestPath,revision:1,treeCohort:plan,publishManifest:f.publishManifest,revalidate:async()=>{}});
  const projection=await tx.readVerifiedProjectTreeMutation({manifestPath:f.manifestPath,projectId:'project-test'});
  assert.equal(projection.lastMutation.canUndo,true);
  const undo=m.planProjectTreeUndo({projectId:'project-test',operationId:'undo-one',expectedTreeRevision:1,lastMutation:result.transactionId,
    receipt:projection.receipt,retainedPacket:projection.retainedPacket,currentManifestText:text(f.manifestPath),currentInventory:inventory(f.root)});
  await tx.commitProjectTransaction({manifestPath:f.manifestPath,revision:2,treeCohort:undo,publishManifest:f.publishManifest,revalidate:async()=>{}});
  assert.equal(text(f.manifestPath),before);assert.equal(text(path.join(f.root,'roman/01 Alpha.txt')),f.raw);
  assert.equal(fs.existsSync(path.join(f.root,'roman/03 Alpha.txt')),false);
  const end=await tx.readVerifiedProjectTreeMutation({manifestPath:f.manifestPath});assert.equal(end.treeRevision,2);assert.equal(end.lastMutation.canUndo,false);
  await assert.rejects(tx.commitProjectTransaction({manifestPath:f.manifestPath,revision:3,treeCohort:undo,publishManifest:f.publishManifest,revalidate:async()=>{}}),{code:'E_TREE_REVISION_CAS'});
});
test('tree copy forks bookmarks, links and notes while source bytes remain exact',async t=>{
  const f=fixture(t,true),m=await modelPromise;
  const plan=m.planProjectTreeCohort(f.capture({operation:'copy',bindings:[{nodeId:'tree-node-a',fromRelativePath:'roman/01 Alpha.txt',toRelativePath:'roman/03 Copy.txt'}]}));
  await tx.commitProjectTransaction({manifestPath:f.manifestPath,revision:1,treeCohort:plan,publishManifest:f.publishManifest,revalidate:async()=>{}});
  assert.equal(text(path.join(f.root,'roman/01 Alpha.txt')),f.raw);
  const source=envelope.parseObservablePayload(f.raw).doc,copy=envelope.parseObservablePayload(text(path.join(f.root,'roman/03 Copy.txt'))).doc;
  const a=bookmarks.readRegistry(source).bookmarks[0],b=bookmarks.readRegistry(copy).bookmarks[0];
  assert.notEqual(a.id,b.id);assert.notEqual(a.name,b.name);assert.deepEqual(a.start,b.start);assert.deepEqual(a.end,b.end);
  assert.equal(copy.content[1].content[0].marks[0].attrs.wordBookmarkId,b.id);
  const noteDoc=JSON.parse(text(path.join(f.root,'notes.craftsman.json')));assert.equal(noteDoc.notes.length,2);
  assert.equal(noteDoc.notes[0].id,'note-source');assert.notEqual(noteDoc.notes[1].id,'note-source');
  assert.equal(noteDoc.notes[1].manuscript.reference.sceneId,'roman/03 Copy.txt');
  assert.equal(inventory(f.root).filter(x=>x.role==='recoverySnapshot').length,1);
});

test('simultaneous sibling permutation retains each original scene and resource ownership',async t=>{
  const f=fixture(t),m=await modelPromise,mp=f.manifestPath;
  for(const [base,resource] of [['01 Alpha.txt','alpha'],['02 Beta.txt','beta']]){
    const p=path.join(f.root,'roman',base),asset=path.join(f.root,'assets',resource+'.txt');fs.mkdirSync(path.dirname(asset),{recursive:true});fs.writeFileSync(asset,resource);
    fs.writeFileSync(tx.commitPathFor(p),JSON.stringify({schemaVersion:'yalken.project-transaction.commit.v2',transactionId:sha(base),revision:1,
      scenePath:p,manifestPath:mp,sceneDigest:sha(text(p)),manifestDigest:sha(text(mp)),resources:[{path:asset,digest:sha(resource),bytes:resource.length}]}));
  }
  const plan=m.planProjectTreeCohort(f.capture({bindings:[
    {nodeId:'tree-node-a',fromRelativePath:'roman/01 Alpha.txt',toRelativePath:'roman/02 Beta.txt'},
    {nodeId:'tree-node-b',fromRelativePath:'roman/02 Beta.txt',toRelativePath:'roman/01 Alpha.txt'}]}));
  await tx.commitProjectTransaction({manifestPath:mp,revision:2,treeCohort:plan,publishManifest:f.publishManifest,revalidate:async()=>{}});
  assert.equal(text(path.join(f.root,'roman/02 Beta.txt')),f.raw);assert.equal(text(path.join(f.root,'roman/01 Alpha.txt')),'Beta');
  const moved=await tx.readVerifiedProjectTransaction({scenePath:path.join(f.root,'roman/02 Beta.txt'),manifestPath:mp});
  assert.equal(moved.resources[0].digest,sha('alpha'));
  const scenePath=path.join(f.root,'roman/02 Beta.txt');
  await tx.commitProjectTransaction({scenePath,manifestPath:mp,revision:3,sceneContent:f.raw+'!',expectedSceneContent:f.raw,
    manifestContent:text(mp),expectedManifestContent:text(mp),publishManifest:f.publishManifest});
  assert.equal((await tx.readVerifiedProjectTransaction({scenePath,manifestPath:mp})).resources[0].digest,sha('alpha'));
  fs.writeFileSync(path.join(f.root,'assets/alpha.txt'),'tampered');
  await assert.rejects(tx.readVerifiedProjectTransaction({scenePath,manifestPath:mp}),{code:'E_PROJECT_TRANSACTION_RESOURCE_READBACK'});
});

test('copy rejects malformed UTF8 without substituting a replacement character',async t=>{
  const f=fixture(t),m=await modelPromise;fs.writeFileSync(path.join(f.root,'roman/01 Alpha.txt'),Buffer.from([0x41,0xc3,0x42]));
  assert.throws(()=>m.planProjectTreeCohort(f.capture({operation:'copy'})),{code:'E_TREE_COHORT_UTF8'});
});

test('tree move refuses altered inherited resource bytes before journal or scene publication',async t=>{
  const f=fixture(t),m=await modelPromise,scenePath=path.join(f.root,'roman/01 Alpha.txt'),asset=path.join(f.root,'assets/a.bin');
  fs.mkdirSync(path.dirname(asset));fs.writeFileSync(asset,'tampered');
  fs.writeFileSync(tx.commitPathFor(scenePath),JSON.stringify({schemaVersion:'yalken.project-transaction.commit.v2',transactionId:sha('old'),revision:0,scenePath,manifestPath:f.manifestPath,
    sceneDigest:sha(f.raw),manifestDigest:sha(text(f.manifestPath)),resources:[{path:asset,digest:sha('asset'),bytes:5}]}));
  const plan=m.planProjectTreeCohort(f.capture());
  await assert.rejects(tx.commitProjectTransaction({manifestPath:f.manifestPath,revision:1,treeCohort:plan,publishManifest:f.publishManifest,revalidate:async()=>{}}),{code:'E_PROJECT_TRANSACTION_RESOURCE_READBACK'});
  assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)),false);assert.equal(text(scenePath),f.raw);
  const recovered=await tx.recoverProjectTransaction({manifestPath:f.manifestPath,treeCohort:plan,publishManifest:f.publishManifest,revalidate:async()=>{}});
  assert.deepEqual(recovered,{recovered:false,outcome:'NO_JOURNAL',mode:'tree'});
  assert.equal(text(scenePath),f.raw);
});

for(const stage of ['manifest','scene','notes','filesComplete','commitMarker','cleanup'])test(`tree journal recovers injected ${stage} failure with exact cohort`,async t=>{
  const f=fixture(t,true),m=await modelPromise,before=inventory(f.root),beforeManifest=text(f.manifestPath),beforeNotes=text(path.join(f.root,'notes.craftsman.json'));
  const plan=m.planProjectTreeCohort(f.capture());let fired=false;
  const adapter={...fsp,
    rename:async(from,to)=>{if(!fired&&((stage==='scene'&&to.endsWith('03 Alpha.txt'))||(stage==='notes'&&to.endsWith('notes.craftsman.json'))||(stage==='commitMarker'&&to===tx.treeCommitPathFor(f.manifestPath)))){fired=true;throw Error('injected');}return fsp.rename(from,to);},
    unlink:async p=>{if(!fired&&stage==='cleanup'&&p===tx.journalPathFor(f.manifestPath)){fired=true;throw Error('injected');}return fsp.unlink(p);}};
  const publisher=async arg=>{if(!fired&&stage==='manifest'){fired=true;throw Error('injected');}return f.publishManifest(arg);};
  await assert.rejects(tx.commitProjectTransaction({manifestPath:f.manifestPath,revision:1,treeCohort:plan,publishManifest:publisher,revalidate:async()=>{},fsAdapter:adapter,
    afterTreeFilesPublish:()=>{if(stage==='filesComplete'){fired=true;throw Error('injected');}}}));
  assert.equal(fired,true);
  const binding=await tx.readPendingProjectTransactionBinding({manifestPath:f.manifestPath});assert.equal(binding.mode,'tree');
  const result=await tx.recoverProjectTransaction({manifestPath:f.manifestPath,publishManifest:f.publishManifest,revalidate:async()=>{}});
  assert.equal(result.outcome,stage==='cleanup'?'COMMITTED_ROLLED_FORWARD':'UNCOMMITTED_ROLLED_BACK');
  assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)),false);
  if(stage!=='cleanup'){assert.equal(text(f.manifestPath),beforeManifest);assert.equal(text(path.join(f.root,'notes.craftsman.json')),beforeNotes);assert.deepEqual(inventory(f.root),before);}
  else assert.equal(text(path.join(f.root,'roman/03 Alpha.txt')),f.raw);
});

test('foreign bytes after interrupted publication are preserved; recovery never overwrites them',async t=>{
  const f=fixture(t),m=await modelPromise,plan=m.planProjectTreeCohort(f.capture());
  await assert.rejects(tx.commitProjectTransaction({manifestPath:f.manifestPath,revision:1,treeCohort:plan,publishManifest:f.publishManifest,revalidate:async()=>{},afterTreeFilesPublish:()=>{throw Error('stop');}}));
  fs.writeFileSync(path.join(f.root,'roman/03 Alpha.txt'),'FOREIGN');
  await assert.rejects(tx.recoverProjectTransaction({manifestPath:f.manifestPath,publishManifest:f.publishManifest,revalidate:async()=>{}}),{code:'E_TREE_COHORT_UNKNOWN_BYTES'});
  assert.equal(text(path.join(f.root,'roman/03 Alpha.txt')),'FOREIGN');assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)),true);
});

for(const drift of ['scene','notes','symlink','foreignChild','plan','revision'])test(`tree ${drift} admission refuses before journal creation`,async t=>{
  const f=fixture(t,true),m=await modelPromise;let plan=m.planProjectTreeCohort(f.capture());
  if(drift==='scene')fs.writeFileSync(path.join(f.root,'roman/01 Alpha.txt'),'changed');
  if(drift==='notes')fs.appendFileSync(path.join(f.root,'notes.craftsman.json'),' ');
  if(drift==='symlink'){fs.unlinkSync(path.join(f.root,'roman/01 Alpha.txt'));fs.symlinkSync(path.join(f.root,'roman/02 Beta.txt'),path.join(f.root,'roman/01 Alpha.txt'));}
  if(drift==='foreignChild')fs.writeFileSync(path.join(f.root,'roman/unexpected.txt'),'foreign');
  if(drift==='plan'){plan=JSON.parse(JSON.stringify(plan));plan.entries.find(e=>e.role==='notes').afterBase64=Buffer.from('{}').toString('base64');}
  if(drift==='revision')plan=m.planProjectTreeCohort(f.capture({expectedTreeRevision:2}));
  await assert.rejects(tx.commitProjectTransaction({manifestPath:f.manifestPath,revision:1,treeCohort:plan,publishManifest:f.publishManifest,revalidate:async()=>{}}));
  assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)),false);assert.equal(fs.existsSync(path.join(f.root,'roman/03 Alpha.txt')),false);
});

test('copy schema3 ledger remaps note identity in current and round history, retains revision provenance',async t=>{
  const f=fixture(t),m=await modelPromise,p=path.join(f.root,'roman/01 Alpha.txt');
  const source={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Alpha 😀'}]}]};
  const frame={schemaVersion:3,source,revisions:[],undo:[],redo:[],noteSourcePoints:[{noteId:'note-source',paragraphIndex:0,offsetUtf16:2}]};
  const doc=pending.bindLedger({...frame,roundUndo:[frame],roundRedo:[],returnReceipts:[{roundId:'source-round',artifactSha256:'a'.repeat(64)}]});
  const raw=envelope.composeObservablePayload({doc});fs.writeFileSync(p,raw);
  const manuscript=notes.bindManuscriptPayload({kind:'footnote',body:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'note'}]}]},sceneId:'roman/01 Alpha.txt',offsetUtf16:2,sceneContent:raw});
  fs.writeFileSync(path.join(f.root,'notes.craftsman.json'),JSON.stringify({schemaVersion:1,projectId:'project-test',notes:[{id:'note-source',scope:'manuscript',body:'note',manuscript}]}));
  const plan=m.planProjectTreeCohort(f.capture({operation:'copy',bindings:[{nodeId:'tree-node-a',fromRelativePath:'roman/01 Alpha.txt',toRelativePath:'roman/03 Copy.txt'}]}));
  const cloned=envelope.parseObservablePayload(Buffer.from(plan.entries.find(e=>e.relativePath==='roman/03 Copy.txt').afterBase64,'base64').toString()).doc;
  const ledger=pending.readLedger(cloned),fresh=plan.identityMap.notes['note-source'];assert.equal(ledger.noteSourcePoints[0].noteId,fresh);assert.equal(ledger.roundUndo[0].noteSourcePoints[0].noteId,fresh);
  assert.deepEqual(ledger.returnReceipts,pending.readLedger(doc).returnReceipts);assert.equal(text(p),raw);
  const invalid=JSON.parse(JSON.stringify(doc));invalid.attrs.wordPendingRevisions.roundUndo[0].noteSourcePoints[0].noteId='missing-note';fs.writeFileSync(p,envelope.composeObservablePayload({doc:invalid}));
  assert.throws(()=>m.planProjectTreeCohort(f.capture({operation:'copy',bindings:[{nodeId:'tree-node-a',fromRelativePath:'roman/01 Alpha.txt',toRelativePath:'roman/03 Copy.txt'}]})),{code:'E_TREE_COHORT_NOTE_HISTORY_UNKNOWN'});
});

for(const phase of ['beforeCommit','afterCommit','repair'])test(`ordinary save after tree move retains immutable resource proof through ${phase}`,async t=>{
  const f=fixture(t),m=await modelPromise,original=path.join(f.root,'roman/01 Alpha.txt'),asset=path.join(f.root,'assets/a.bin');
  fs.mkdirSync(path.dirname(asset));fs.writeFileSync(asset,'asset');
  fs.writeFileSync(tx.commitPathFor(original),JSON.stringify({schemaVersion:'yalken.project-transaction.commit.v2',transactionId:sha('old'),revision:0,scenePath:original,manifestPath:f.manifestPath,
    sceneDigest:sha(f.raw),manifestDigest:sha(text(f.manifestPath)),resources:[{path:asset,digest:sha('asset'),bytes:5}]}));
  await tx.commitProjectTransaction({manifestPath:f.manifestPath,revision:1,treeCohort:m.planProjectTreeCohort(f.capture()),publishManifest:f.publishManifest,revalidate:async()=>{}});
  const scenePath=path.join(f.root,'roman/03 Alpha.txt'),manifestPath=f.manifestPath;
  const adapter={...fsp,rename:async(from,to)=>{if(phase==='beforeCommit'&&to===tx.commitPathFor(scenePath))throw Error('stop');return fsp.rename(from,to);},
    unlink:async p=>{if(phase!=='beforeCommit'&&p===tx.journalPathFor(manifestPath))throw Error('stop');return fsp.unlink(p);}};
  await assert.rejects(tx.commitProjectTransaction({scenePath,manifestPath,revision:2,sceneContent:f.raw+'!',expectedSceneContent:f.raw,manifestContent:text(manifestPath),expectedManifestContent:text(manifestPath),publishManifest:f.publishManifest,fsAdapter:adapter}));
  assert.equal((await tx.readPendingProjectTransactionBinding({manifestPath})).scenePath,scenePath);
  if(phase==='repair'){
    fs.writeFileSync(tx.commitPathFor(scenePath),'{broken');let binding;
    await assert.rejects(tx.recoverProjectTransaction({scenePath,manifestPath,publishManifest:f.publishManifest}),e=>{binding=e.recovery;return e.code==='E_PROJECT_COMMIT_CORRUPT';});
    const result=await tx.repairCorruptProjectCommit({scenePath,manifestPath,publishManifest:f.publishManifest,decision:'REPAIR_TO_AFTER',verifyAuthorityProof:async p=>p.transactionId===binding.transactionId});
    assert.equal(result.repaired,true);
  }else assert.equal((await tx.recoverProjectTransaction({scenePath,manifestPath,publishManifest:f.publishManifest})).outcome,phase==='beforeCommit'?'UNCOMMITTED_ROLLED_BACK':'COMMITTED_CONVERGED');
  assert.equal(text(scenePath),phase==='beforeCommit'?f.raw:f.raw+'!');
  assert.equal((await tx.readVerifiedProjectTransaction({scenePath,manifestPath})).resources[0].digest,sha('asset'));
  fs.writeFileSync(asset,'other');
  await assert.rejects(tx.readVerifiedProjectTransaction({scenePath,manifestPath}),{code:'E_PROJECT_TRANSACTION_RESOURCE_READBACK'});
});

test('exact tree Undo restores legacy receipt then ordinary save retains resource authority; explicit media replacement owns only new bytes',async t=>{
  const f=fixture(t),m=await modelPromise,scenePath=path.join(f.root,'roman/01 Alpha.txt'),manifestPath=f.manifestPath,asset=path.join(f.root,'assets/a.bin');
  fs.mkdirSync(path.dirname(asset));fs.writeFileSync(asset,'asset');
  fs.writeFileSync(tx.commitPathFor(scenePath),JSON.stringify({schemaVersion:'yalken.project-transaction.commit.v2',transactionId:sha('old'),revision:0,scenePath,manifestPath,
    sceneDigest:sha(f.raw),manifestDigest:sha(text(manifestPath)),resources:[{path:asset,digest:sha('asset'),bytes:5}]}));
  const beforeReceipt=text(tx.commitPathFor(scenePath));
  const result=await tx.commitProjectTransaction({manifestPath,revision:1,treeCohort:m.planProjectTreeCohort(f.capture()),publishManifest:f.publishManifest,revalidate:async()=>{}});
  const state=await tx.readVerifiedProjectTreeMutation({manifestPath});
  const undo=m.planProjectTreeUndo({projectId:'project-test',operationId:'undo-resource',expectedTreeRevision:1,lastMutation:result.transactionId,receipt:state.receipt,retainedPacket:state.retainedPacket,currentManifestText:text(manifestPath),currentInventory:inventory(f.root)});
  await tx.commitProjectTransaction({manifestPath,revision:2,treeCohort:undo,publishManifest:f.publishManifest,revalidate:async()=>{}});
  assert.equal(text(tx.commitPathFor(scenePath)),beforeReceipt);
  await tx.commitProjectTransaction({scenePath,manifestPath,revision:3,sceneContent:f.raw+'!',expectedSceneContent:f.raw,manifestContent:text(manifestPath),expectedManifestContent:text(manifestPath),publishManifest:f.publishManifest});
  assert.equal((await tx.readVerifiedProjectTransaction({scenePath,manifestPath})).resources[0].digest,sha('asset'));
  fs.writeFileSync(asset,'other');await assert.rejects(tx.readVerifiedProjectTransaction({scenePath,manifestPath}),{code:'E_PROJECT_TRANSACTION_RESOURCE_READBACK'});
  fs.writeFileSync(asset,'asset');
  const media=require('../../src/io/documentMedia.js'),bytes=require('../fixtures/document-jpeg-fixtures.cjs').rgb,attrs=media.createImageAttrs(bytes);
  const after=envelope.composeObservablePayload({doc:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:f.raw+'!'},{type:'image',attrs}]}]}});
  await tx.commitProjectTransaction({scenePath,manifestPath,revision:4,sceneContent:after,expectedSceneContent:f.raw+'!',manifestContent:text(manifestPath),expectedManifestContent:text(manifestPath),
    mediaUpdateResources:[{path:path.join(f.root,attrs.assetPath),content:bytes}],publishManifest:f.publishManifest});
  const current=await tx.readVerifiedProjectTransaction({scenePath,manifestPath});assert.equal(current.schemaVersion,'yalken.project-transaction.commit.v6');
  assert.deepEqual(current.resources.map(x=>x.path),[path.join(f.root,attrs.assetPath)]);
  assert.equal(text(asset),'asset'); // Replacement neither republishes nor deletes inherited immutable bytes.
});

function boundaryBookmarkFixture(value,start,end) {
  const endpoint=offsetUtf16=>({paragraphIndex:0,offsetUtf16,edge:'text'});
  const result=bookmarks.planMutation({doc:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:value}]}]},action:'create',
    requestId:'boundary-seed',projectId:'p',sceneId:'a.txt',name:'Boundary',start:endpoint(start),end:endpoint(end)});
  const link={type:'text',text:'Link',marks:[{type:'link',attrs:bookmarks.linkAttrs(result.registry.bookmarks[0])}]};
  result.doc.content.push({type:'paragraph',content:[link]});return result.doc;
}
function boundaryBookmarkEdit(before,value) {
  const working=JSON.parse(JSON.stringify(before));working.content[0].content=value?[{type:'text',text:value}]:[];
  return bookmarks.planSave({beforeDoc:before,workingDoc:working});
}
test('surviving bookmark prefix and suffix boundaries map pure deletion without changing link identity',()=>{
  for(const [text,next,start,end,expectedStart,expectedEnd] of [
    ['PREFIXtarget','target',0,12,0,6],['targetSUFFIX','target',0,12,0,6],
    ['goneTARGET','TARGET',4,10,0,6],['TARGETgone','TARGET',0,6,0,6],['😀target','target',0,8,0,6]]) {
    const before=boundaryBookmarkFixture(text,start,end),id=bookmarks.readRegistry(before).bookmarks[0].id;
    const result=boundaryBookmarkEdit(before,next),record=result.registry.bookmarks[0];
    assert.equal(record.id,id);assert.equal(record.start.offsetUtf16,expectedStart);assert.equal(record.end.offsetUtf16,expectedEnd);
    assert.deepEqual(result.doc.content[1],before.content[1]);
  }
});
for(const [label,text,next,start,end,code] of [
  ['point at deletion start','goneTARGET','TARGET',0,0,'USER_BOOKMARK_EDIT_BOUNDARY_CONFLICT'],
  ['point at deletion end','goneTARGET','TARGET',4,4,'USER_BOOKMARK_EDIT_BOUNDARY_CONFLICT'],
  ['wholly consumed range','goneTARGET','TARGET',0,4,'USER_BOOKMARK_EDIT_BOUNDARY_CONFLICT'],
  ['strict interior','goneTARGET','TARGET',2,8,'USER_BOOKMARK_EDIT_BOUNDARY_CONFLICT'],
  ['replacement','goneTARGET','xTARGET',0,10,'USER_BOOKMARK_EDIT_BOUNDARY_CONFLICT'],
  ['ambiguous repeated placement','aaaa','aaa',1,3,'USER_BOOKMARK_EDIT_AMBIGUOUS']])test(`bookmark deletion preserves refusal for ${label}`,()=>{
  const before=boundaryBookmarkFixture(text,start,end),raw=JSON.stringify(before);
  assert.throws(()=>boundaryBookmarkEdit(before,next),{code});assert.equal(JSON.stringify(before),raw);
});

test('native renamed canary prefix Undo preserves seven bookmark IDs, both links and paragraph terminator owner',()=>{
  const before={"attrs":{"wordPendingRevisions":null,"wordUserBookmarks":{"bookmarks":[{"end":{"edge":"text","offsetUtf16":28,"paragraphIndex":2},"id":"ubm-4a1a5bee6d3f70b639d53e2d519ec983","name":"UserTwinSecond","start":{"edge":"text","offsetUtf16":0,"paragraphIndex":2},"state":"active"},{"end":{"edge":"text","offsetUtf16":8,"paragraphIndex":4},"id":"ubm-203b938b6e70d2fffef234648bb2e1e7","name":"Цель_Кириллица_Ω","start":{"edge":"text","offsetUtf16":0,"paragraphIndex":4},"state":"active"},{"end":{"edge":"text","offsetUtf16":8,"paragraphIndex":4},"id":"ubm-9a163b528a3a77c818439300186b1ce3","name":"usertwinb","start":{"edge":"text","offsetUtf16":0,"paragraphIndex":4},"state":"active"},{"end":{"edge":"afterParagraph","offsetUtf16":26,"paragraphIndex":5},"id":"ubm-38d4ccb77753d2597c6f91faa775f3d5","name":"UserCrossBlock","start":{"edge":"text","offsetUtf16":0,"paragraphIndex":5},"state":"active"},{"end":{"edge":"text","offsetUtf16":1,"paragraphIndex":7},"id":"ubm-d15b0c14e39ee6d0e1b00a9dbf8d8335","name":"UserSpanTwo","start":{"edge":"text","offsetUtf16":0,"paragraphIndex":5},"state":"active"},{"end":{"edge":"text","offsetUtf16":13,"paragraphIndex":7},"id":"ubm-1f4c0c75d96bbde80d4287d2c51cecc2","name":"UserPoint","start":{"edge":"text","offsetUtf16":13,"paragraphIndex":7},"state":"active"},{"end":{"edge":"text","offsetUtf16":17,"paragraphIndex":8},"id":"ubm-a3206b7b59d7d98c1f63f5f19500c5a2","name":"UserEmoji","start":{"edge":"text","offsetUtf16":15,"paragraphIndex":8},"state":"active"}],"revision":1,"schemaVersion":"yalken.word-user-bookmarks.v1"}},"content":[{"attrs":{"textAlign":null},"content":[{"marks":[{"attrs":{"color":null,"fontFamily":"Aptos","fontSize":"12pt"},"type":"textStyle"}],"text":"Bookmark canary","type":"text"}],"type":"paragraph"},{"attrs":{"textAlign":null},"content":[{"marks":[{"attrs":{"color":null,"fontFamily":"Aptos","fontSize":"12pt"},"type":"textStyle"}],"text":"Target Twin Alpha","type":"text"}],"type":"paragraph"},{"attrs":{"textAlign":null},"content":[{"marks":[{"attrs":{"color":null,"fontFamily":"Aptos","fontSize":"12pt"},"type":"textStyle"}],"text":"STARTBOUND_Target Twin Alpha_ENDBOUND","type":"text"}],"type":"paragraph"},{"attrs":{"textAlign":null},"content":[{"marks":[{"attrs":{"class":null,"href":"#usertwinb","rel":"noopener noreferrer nofollow","target":"_blank","title":null,"wordBookmarkId":"ubm-9a163b528a3a77c818439300186b1ce3","wordBookmarkName":"usertwinb"},"type":"link"},{"attrs":{"color":"#467886","fontFamily":"Aptos","fontSize":"12pt"},"type":"textStyle"},{"type":"underline"}],"text":"Link One","type":"text"}],"type":"paragraph"},{"attrs":{"textAlign":null},"content":[{"marks":[{"attrs":{"class":null,"href":"#UserTwinSecond","rel":"noopener noreferrer nofollow","target":"_blank","title":null,"wordBookmarkId":"ubm-4a1a5bee6d3f70b639d53e2d519ec983","wordBookmarkName":"UserTwinSecond"},"type":"link"},{"attrs":{"color":"#467886","fontFamily":"Aptos","fontSize":"12pt"},"type":"textStyle"},{"type":"underline"}],"text":"Link Two","type":"text"}],"type":"paragraph"},{"attrs":{"textAlign":null},"content":[{"marks":[{"attrs":{"color":null,"fontFamily":"Aptos","fontSize":"12pt"},"type":"textStyle"}],"text":" ПроверкаCross Block Start","type":"text"}],"type":"paragraph"},{"attrs":{"textAlign":null},"content":[{"marks":[{"attrs":{"color":null,"fontFamily":"Aptos","fontSize":"12pt"},"type":"textStyle"}],"text":"Cross Block End","type":"text"}],"type":"paragraph"},{"attrs":{"textAlign":null},"content":[{"marks":[{"attrs":{"color":null,"fontFamily":"Aptos","fontSize":"12pt"},"type":"textStyle"}],"text":"After canary.","type":"text"},{"marks":[{"attrs":{"color":null,"fontFamily":"Times New Roman","fontSize":"12pt"},"type":"textStyle"}],"text":" ","type":"text"},{"marks":[{"attrs":{"color":null,"fontFamily":"Aptos","fontSize":"12pt"},"type":"textStyle"}],"text":"POINT_INSERT_","type":"text"}],"type":"paragraph"},{"attrs":{"textAlign":null},"content":[{"marks":[{"attrs":{"color":null,"fontFamily":"Aptos","fontSize":"12pt"},"type":"textStyle"}],"text":"Unicode target ","type":"text"},{"marks":[{"attrs":{"color":null,"fontFamily":null,"fontSize":"12pt"},"type":"textStyle"}],"text":"🌋","type":"text"},{"marks":[{"attrs":{"color":null,"fontFamily":"Aptos","fontSize":"12pt"},"type":"textStyle"}],"text":" omega","type":"text"}],"type":"paragraph"}],"type":"doc"};
  const working=JSON.parse(JSON.stringify(before));assert.ok(working.content[5].content[0].text.startsWith(' Проверка'));
  working.content[5].content[0].text=working.content[5].content[0].text.slice(9);
  const result=bookmarks.planSave({beforeDoc:before,workingDoc:working});
  assert.deepEqual(result.registry.bookmarks.map(x=>x.id),bookmarks.readRegistry(before).bookmarks.map(x=>x.id));
  assert.equal(result.registry.bookmarks.length,7);
  const cross=result.registry.bookmarks.find(x=>x.name==='UserCrossBlock');
  assert.deepEqual(cross.start,{paragraphIndex:5,offsetUtf16:0,edge:'text'});
  assert.deepEqual(cross.end,{paragraphIndex:5,offsetUtf16:17,edge:'afterParagraph'});
  assert.deepEqual(result.registry.bookmarks.find(x=>x.name==='UserSpanTwo').end,{paragraphIndex:7,offsetUtf16:1,edge:'text'});
  assert.deepEqual(result.doc.content[3],before.content[3]);assert.deepEqual(result.doc.content[4],before.content[4]);
});

test('moved backup metadata matches real producer bytes while a later new snapshot still invalidates exact Undo',async t=>{
  const f=fixture(t),m=await modelPromise,manager=require('../../src/utils/backupManager'),source=path.join(f.root,'roman/01 Alpha.txt');
  const first=await manager.createBackup(source,f.raw,{basePath:f.root});assert.equal(first.success,true,first.error);
  const plan=m.planProjectTreeCohort(f.capture());
  await tx.commitProjectTransaction({manifestPath:f.manifestPath,revision:1,treeCohort:plan,publishManifest:f.publishManifest,revalidate:async()=>{}});
  const moved=path.join(f.root,'roman/03 Alpha.txt'),dir=path.join(f.root,'backups',sha(moved)),metadata=text(path.join(dir,'meta.json'));
  assert.equal(metadata,JSON.stringify({originalPath:moved,baseName:path.basename(moved)},null,2));
  assert.equal((await tx.readVerifiedProjectTreeMutation({manifestPath:f.manifestPath})).lastMutation.canUndo,true);
  const next=await manager.createBackup(moved,f.raw,{basePath:f.root});assert.equal(next.success,true,next.error);
  assert.equal(text(path.join(dir,'meta.json')),metadata,'real producer causes no metadata-only CAS drift');
  const current=await tx.readVerifiedProjectTreeMutation({manifestPath:f.manifestPath});
  assert.equal(current.lastMutation.canUndo,false);assert.equal(current.lastMutation.unavailableReason,'E_TREE_COHORT_FOREIGN_ENTRY');
  assert.equal(text(moved),f.raw);
});

async function recoveryFixture(t, options = {}) {
  const f=fixture(t,true),m=await modelPromise,commentModel=require('../../src/core/word-comment-authoring-v1.cjs');
  if(options.pending){
    const source={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Alpha 😀'}]}]};
    const frame={schemaVersion:3,source,revisions:[],undo:[],redo:[],noteSourcePoints:[{noteId:'note-source',paragraphIndex:0,offsetUtf16:2}]};
    const doc=pending.bindLedger({...frame,roundUndo:[frame],roundRedo:[],returnReceipts:[{roundId:'prior-round',artifactSha256:'a'.repeat(64)}]});
    f.raw=envelope.composeObservablePayload({doc});fs.writeFileSync(path.join(f.root,'roman/01 Alpha.txt'),f.raw);
    const manuscript=notes.bindManuscriptPayload({kind:'footnote',body:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'note'}]}]},sceneId:'roman/01 Alpha.txt',offsetUtf16:2,sceneContent:f.raw});
    fs.writeFileSync(path.join(f.root,'notes.craftsman.json'),JSON.stringify({schemaVersion:1,projectId:'project-test',notes:[{id:'note-source',scope:'manuscript',body:'note',manuscript}]}));
  }
  if(options.resource){
    const scenePath=path.join(f.root,'roman/01 Alpha.txt'),asset=path.join(f.root,'assets/a.bin');fs.mkdirSync(path.dirname(asset));fs.writeFileSync(asset,'asset');
    fs.writeFileSync(tx.commitPathFor(scenePath),JSON.stringify({schemaVersion:'yalken.project-transaction.commit.v2',transactionId:sha('resource'),revision:0,scenePath,manifestPath:f.manifestPath,sceneDigest:sha(f.raw),manifestDigest:sha(text(f.manifestPath)),resources:[{path:asset,digest:sha('asset'),bytes:5}]}));
  }
  const commentPath=path.join(f.root,'.yalken/word-review/non-text-return-state.v1.json');
  const paragraphs=envelope.parseObservablePayload(f.raw).doc.content.map(p=>p.content.map(n=>n.text||'').join(''));
  const authored=commentModel.planCommentAuthoring({beforeText:null,projectId:'project-test',sceneId:'roman/01 Alpha.txt',sceneSha256:sha(f.raw),paragraphs,now,
    input:{requestId:'comment-source',action:'create',projectId:'project-test',sceneId:'roman/01 Alpha.txt',expectedStateSha256:'',expectedSceneSha256:sha(f.raw),body:'Rich comment',anchor:{paragraphIndex:0,startUtf16:0,selectedText:'Alpha'}}});
  fs.mkdirSync(path.dirname(commentPath),{recursive:true});fs.writeFileSync(commentPath,authored.afterText);
  const current=extra=>f.capture({commentsText:text(commentPath),...extra});
  const commit=plan=>tx.commitProjectTransaction({manifestPath:f.manifestPath,revision:plan.expectedTreeRevision+1,treeCohort:plan,publishManifest:f.publishManifest,revalidate:async()=>{}});
  const copy=m.planProjectTreeCohort(current({operation:'copy',bindings:[{nodeId:'tree-node-a',fromRelativePath:'roman/01 Alpha.txt',toRelativePath:'roman/03 Copy.txt'}]}));
  await commit(copy);const copyRaw=text(path.join(f.root,'roman/03 Copy.txt'));
  const copied=await tx.readVerifiedProjectTreeMutation({manifestPath:f.manifestPath});
  const undo=m.planProjectTreeUndo({projectId:'project-test',operationId:'undo-copy',expectedTreeRevision:1,lastMutation:copied.lastMutation.id,receipt:copied.receipt,retainedPacket:copied.retainedPacket,currentManifestText:text(f.manifestPath),currentInventory:inventory(f.root)});
  await commit(undo);
  const retained=await tx.readVerifiedProjectTreeMutation({manifestPath:f.manifestPath});
  const parsed=envelope.parseObservablePayload(copyRaw);if(!options.pending)parsed.doc.content[0].content[0].text+=' added';
  const workingContent=envelope.composeObservablePayload({...parsed,doc:parsed.doc});
  const input=current({operation:'copy',operationId:'recover-copy',expectedTreeRevision:2,
    bindings:[{nodeId:'tree-node-a',fromRelativePath:'roman/01 Alpha.txt',toRelativePath:'roman/04 Recovered.txt'}],
    recoveredCopy:{receipt:retained.receipt,retainedPacket:retained.retainedPacket,removedNodeId:copy.pathBindings[0].newNodeId,workingContent}});
  return {...f,m,commit,input,copyRaw,commentPath};
}

test('retained rich copy recovers edited text and independent full graph through real writer, then exact Undo',async t=>{
  const f=await recoveryFixture(t),beforeNotes=text(path.join(f.root,'notes.craftsman.json')),beforeComments=text(f.commentPath);
  const plan=f.m.planProjectTreeCohort(f.input);await f.commit(plan);
  const destination=path.join(f.root,'roman/04 Recovered.txt'),raw=text(destination),doc=envelope.parseObservablePayload(raw).doc;
  assert.equal(notes.sceneText(raw),'Alpha 😀 added\nlink');assert.equal(text(path.join(f.root,'roman/01 Alpha.txt')),f.raw);
  const oldMark=bookmarks.readRegistry(envelope.parseObservablePayload(f.copyRaw).doc).bookmarks[0],newMark=bookmarks.readRegistry(doc).bookmarks[0];
  assert.notEqual(newMark.id,oldMark.id);assert.equal(doc.content[1].content[0].marks[0].attrs.wordBookmarkId,newMark.id);
  const noteDoc=JSON.parse(text(path.join(f.root,'notes.craftsman.json')));assert.deepEqual(noteDoc.notes[0],JSON.parse(beforeNotes).notes[0]);
  assert.equal(noteDoc.notes.length,2);assert.equal(noteDoc.notes[1].manuscript.reference.sceneId,'roman/04 Recovered.txt');
  assert.equal(noteDoc.notes[1].manuscript.reference.sourceTextSha256,sha(notes.sceneText(raw)));
  const comments=JSON.parse(text(f.commentPath));assert.deepEqual(comments.threads[0],JSON.parse(beforeComments).threads[0]);
  assert.equal(comments.threads.length,2);assert.equal(comments.threads[1].messages[0].body,'Rich comment');
  assert.notEqual(comments.threads[1].threadId,comments.threads[0].threadId);assert.equal(comments.threads[1].anchor.sceneId,'roman/04 Recovered.txt');
  assert.equal((await tx.readVerifiedProjectTransaction({scenePath:destination,manifestPath:f.manifestPath})).schemaVersion,'yalken.project-transaction.commit.v7');
  const state=await tx.readVerifiedProjectTreeMutation({manifestPath:f.manifestPath});
  const undo=f.m.planProjectTreeUndo({projectId:'project-test',operationId:'undo-recovered',expectedTreeRevision:3,lastMutation:state.lastMutation.id,receipt:state.receipt,retainedPacket:state.retainedPacket,currentManifestText:text(f.manifestPath),currentInventory:inventory(f.root)});
  assert.equal(undo.pathBindings[0].toRelativePath,'roman/01 Alpha.txt');await f.commit(undo);
  assert.equal(fs.existsSync(destination),false);assert.equal(text(path.join(f.root,'notes.craftsman.json')),beforeNotes);assert.equal(text(f.commentPath),beforeComments);
});

test('recovered-copy input refuses wrong identity, stale receipt, occupied destination, consumed anchors and ledger mutation',async t=>{
  const f=await recoveryFixture(t),before=inventory(f.root),originalManifest=text(f.manifestPath);
  const mutate=fn=>{const value=structuredClone(f.input);fn(value);return value;};
  for(const input of [
    mutate(x=>x.projectId='other'),mutate(x=>x.expectedTreeRevision=1),mutate(x=>x.recoveredCopy.removedNodeId='unknown'),
    mutate(x=>x.bindings[0].copy=false),mutate(x=>x.bindings[0].toRelativePath='roman/02 Beta.txt'),
    mutate(x=>x.recoveredCopy.retainedPacket.entries[0].afterBase64=''),
    mutate(x=>{const p=envelope.parseObservablePayload(x.recoveredCopy.workingContent);p.doc.content[0].content[0].text='Gone';x.recoveredCopy.workingContent=envelope.composeObservablePayload({doc:p.doc});})
  ]) assert.throws(()=>f.m.planProjectTreeCohort(input));
  assert.deepEqual(inventory(f.root),before);assert.equal(text(f.manifestPath),originalManifest);assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)),false);
});

test('recovery cannot use a recomputed forged packet or replay a consumed current Undo',async t=>{
  const f=await recoveryFixture(t),forged=structuredClone(f.input),packet=forged.recoveredCopy.retainedPacket;
  packet.revision++;
  forged.recoveredCopy.receipt.packetDigest=f.m.projectTreeCohortDigest(packet);
  const plan=f.m.planProjectTreeCohort(forged);
  await assert.rejects(f.commit(plan),{code:'E_TREE_RECOVERY_BINDING'});
  assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)),false);
  const valid=f.m.planProjectTreeCohort(f.input);await f.commit(valid);
  await assert.rejects(f.commit(valid),{code:'E_TREE_REVISION_CAS'});
});

for(const stage of ['notes','cleanup'])test(`recovered full graph ${stage} fault uses existing rollback/rollforward`,async t=>{
  const f=await recoveryFixture(t),before=inventory(f.root),notesBefore=text(path.join(f.root,'notes.craftsman.json')),commentsBefore=text(f.commentPath);
  const plan=f.m.planProjectTreeCohort(f.input);let fired=false;
  const adapter={...fsp,rename:async(a,b)=>{if(!fired&&stage==='notes'&&b.endsWith('notes.craftsman.json')){fired=true;throw Error('injected recovery');}return fsp.rename(a,b);},
    unlink:async p=>{if(!fired&&stage==='cleanup'&&p===tx.journalPathFor(f.manifestPath)){fired=true;throw Error('injected recovery');}return fsp.unlink(p);}};
  await assert.rejects(tx.commitProjectTransaction({manifestPath:f.manifestPath,revision:3,treeCohort:plan,publishManifest:f.publishManifest,revalidate:async()=>{},fsAdapter:adapter}));
  assert.equal(fired,true);
  const recovered=await tx.recoverProjectTransaction({manifestPath:f.manifestPath,publishManifest:f.publishManifest,revalidate:async()=>{}});
  assert.equal(recovered.outcome,stage==='cleanup'?'COMMITTED_ROLLED_FORWARD':'UNCOMMITTED_ROLLED_BACK');
  if(stage==='notes'){assert.deepEqual(inventory(f.root),before);assert.equal(text(path.join(f.root,'notes.craftsman.json')),notesBefore);assert.equal(text(f.commentPath),commentsBefore);}
  else {assert.equal(notes.sceneText(text(path.join(f.root,'roman/04 Recovered.txt'))),'Alpha 😀 added\nlink');assert.equal(JSON.parse(text(f.commentPath)).threads.length,2);}
});

test('recovered schema3 note bindings fork current and history identities while altered ledger is refused',async t=>{
  const f=await recoveryFixture(t,{pending:true}),plan=f.m.planProjectTreeCohort(f.input);
  await f.commit(plan);const raw=text(path.join(f.root,'roman/04 Recovered.txt')),ledger=pending.readLedger(envelope.parseObservablePayload(raw).doc);
  const allNotes=JSON.parse(text(path.join(f.root,'notes.craftsman.json'))).notes,fresh=allNotes.find(n=>n.manuscript.reference.sceneId==='roman/04 Recovered.txt');
  assert.equal(ledger.noteSourcePoints[0].noteId,fresh.id);assert.equal(ledger.roundUndo[0].noteSourcePoints[0].noteId,fresh.id);
  assert.notEqual(fresh.id,pending.readLedger(envelope.parseObservablePayload(f.copyRaw).doc).noteSourcePoints[0].noteId);
  const bad=structuredClone(f.input),p=envelope.parseObservablePayload(bad.recoveredCopy.workingContent);
  p.doc.attrs.wordPendingRevisions.returnReceipts[0].roundId='forged-round';bad.recoveredCopy.workingContent=envelope.composeObservablePayload({doc:p.doc});
  assert.throws(()=>f.m.planProjectTreeCohort(bad),{code:'E_TREE_RECOVERY_LEDGER_CHANGED'});
});

test('recovered scene retains immutable asset proof through ordinary save and refuses missing bytes before publication',async t=>{
  const f=await recoveryFixture(t,{resource:true}),plan=f.m.planProjectTreeCohort(f.input),asset=path.join(f.root,'assets/a.bin');
  fs.unlinkSync(asset);await assert.rejects(f.commit(plan));assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)),false);
  fs.writeFileSync(asset,'asset');await f.commit(plan);
  const scenePath=path.join(f.root,'roman/04 Recovered.txt'),raw=text(scenePath),manifest=text(f.manifestPath);
  await tx.commitProjectTransaction({scenePath,sceneContent:raw,expectedSceneContent:raw,manifestPath:f.manifestPath,manifestContent:manifest,expectedManifestContent:manifest,revision:4,publishManifest:f.publishManifest});
  assert.equal((await tx.readVerifiedProjectTransaction({scenePath,manifestPath:f.manifestPath})).resources.length,1);
  fs.writeFileSync(asset,'wrong');await assert.rejects(tx.readVerifiedProjectTransaction({scenePath,manifestPath:f.manifestPath}));
});

test('recovered graph refuses fresh-ID collisions and cross-scene source substitution',async t=>{
  const f=await recoveryFixture(t),plan=f.m.planProjectTreeCohort(f.input);
  const noteCollision=structuredClone(f.input),noteDoc=JSON.parse(noteCollision.notesText),duplicate=structuredClone(noteDoc.notes[0]);
  duplicate.id=Object.values(plan.identityMap.notes)[0];noteDoc.notes.push(duplicate);noteCollision.notesText=JSON.stringify(noteDoc);
  assert.throws(()=>f.m.planProjectTreeCohort(noteCollision),{code:'E_TREE_COHORT_NOTE_ID'});
  const commentCollision=structuredClone(f.input),commentDoc=JSON.parse(commentCollision.commentsText),thread=structuredClone(commentDoc.threads[0]);
  thread.threadId=Object.values(plan.identityMap.threads)[0];commentDoc.threads.push(thread);commentCollision.commentsText=JSON.stringify(commentDoc);
  assert.throws(()=>f.m.planProjectTreeCohort(commentCollision),{code:'COMMENT_STATE_INVALID'});
  const crossed=structuredClone(f.input);crossed.bindings[0].nodeId='tree-node-b';crossed.bindings[0].fromRelativePath='roman/02 Beta.txt';
  assert.throws(()=>f.m.planProjectTreeCohort(crossed),{code:'E_TREE_RECOVERY_SOURCE'});
  const falseCopy=structuredClone(f.input);falseCopy.bindings[0].copy=0;
  assert.throws(()=>f.m.planProjectTreeCohort(falseCopy),{code:'E_TREE_RECOVERY_BINDING'});
});

test('current verified recovery-copy continues into another independent scene and Undo returns to that live prior copy',async t=>{
  const f=await recoveryFixture(t),first=f.m.planProjectTreeCohort(f.input);await f.commit(first);
  const firstPath=path.join(f.root,'roman/04 Recovered.txt'),firstRaw=text(firstPath),state=await tx.readVerifiedProjectTreeMutation({manifestPath:f.manifestPath});
  const parsed=envelope.parseObservablePayload(f.input.recoveredCopy.workingContent);parsed.doc.content[0].content[0].text+=' later';
  const next=f.capture({operation:'copy',operationId:'recover-again',expectedTreeRevision:3,commentsText:text(f.commentPath),
    bindings:[{nodeId:first.pathBindings[0].newNodeId,fromRelativePath:'roman/04 Recovered.txt',toRelativePath:'roman/05 Recovered.txt'}],
    recoveredCopy:{receipt:state.receipt,retainedPacket:state.retainedPacket,removedNodeId:f.input.recoveredCopy.removedNodeId,workingContent:envelope.composeObservablePayload({...parsed,doc:parsed.doc})}});
  const plan=f.m.planProjectTreeCohort(next);await f.commit(plan);
  assert.equal(text(firstPath),firstRaw);assert.equal(text(path.join(f.root,'roman/01 Alpha.txt')),f.raw);
  const nextRaw=text(path.join(f.root,'roman/05 Recovered.txt'));assert.equal(notes.sceneText(nextRaw),'Alpha 😀 added later\nlink');
  const firstId=bookmarks.readRegistry(envelope.parseObservablePayload(firstRaw).doc).bookmarks[0].id;
  assert.notEqual(bookmarks.readRegistry(envelope.parseObservablePayload(nextRaw).doc).bookmarks[0].id,firstId);
  assert.equal(JSON.parse(text(path.join(f.root,'notes.craftsman.json'))).notes.length,3);assert.equal(JSON.parse(text(f.commentPath)).threads.length,3);
  const final=await tx.readVerifiedProjectTreeMutation({manifestPath:f.manifestPath});
  const undo=f.m.planProjectTreeUndo({projectId:'project-test',operationId:'undo-again',expectedTreeRevision:4,lastMutation:final.lastMutation.id,receipt:final.receipt,retainedPacket:final.retainedPacket,currentManifestText:text(f.manifestPath),currentInventory:inventory(f.root)});
  assert.equal(undo.pathBindings[0].toRelativePath,'roman/04 Recovered.txt');await f.commit(undo);assert.equal(text(firstPath),firstRaw);
  const wrong=structuredClone(next);wrong.recoveredCopy.removedNodeId=first.pathBindings[0].newNodeId;
  assert.throws(()=>f.m.planProjectTreeCohort(wrong),{code:'E_TREE_RECOVERY_SOURCE'});
  const ordinary=structuredClone(next),originalPacket=f.input.recoveredCopy.retainedPacket.plan.input.retainedPacket;
  ordinary.recoveredCopy.retainedPacket=originalPacket;ordinary.recoveredCopy.receipt={...state.receipt,transactionId:originalPacket.transactionId,packetDigest:f.m.projectTreeCohortDigest(originalPacket)};
  assert.throws(()=>f.m.planProjectTreeCohort(ordinary),{code:'E_TREE_RECOVERY_SOURCE'});
  const deep=structuredClone(next);let chain={};for(let i=0;i<9;i++)chain={plan:{input:{recoveredCopy:{retainedPacket:chain}}}};deep.recoveredCopy.retainedPacket=chain;
  assert.throws(()=>f.m.planProjectTreeCohort(deep),{code:'E_TREE_RECOVERY_CHAIN_BUDGET'});
});

function topologyFixture(t) {
  const f=fixture(t,true), parsed=envelope.parseObservablePayload(f.raw);
  parsed.doc.content.push({type:'heading',attrs:{level:2},content:[{type:'text',text:'Right 😀'}]}, {type:'paragraph'});
  const created=bookmarks.planMutation({doc:parsed.doc,action:'create',requestId:'right-bookmark',projectId:'project-test',sceneId:'roman/01 Alpha.txt',name:'RightAnchor',start:{paragraphIndex:2,offsetUtf16:6,edge:'text'},end:{paragraphIndex:2,offsetUtf16:8,edge:'text'}});
  f.raw=envelope.composeObservablePayload({doc:created.doc,cards:[{title:'card',text:'value',tags:[]}]});
  fs.writeFileSync(path.join(f.root,'roman/01 Alpha.txt'),f.raw);
  const noteDoc=JSON.parse(text(path.join(f.root,'notes.craftsman.json')));
  for(const note of noteDoc.notes)note.manuscript.reference.sourceTextSha256=notes.sha(notes.sceneText(f.raw));
  noteDoc.notes.push({id:'note-right',scope:'manuscript',body:'right note',manuscript:notes.bindManuscriptPayload({kind:'footnote',body:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'right note'}]}]},sceneId:'roman/01 Alpha.txt',offsetUtf16:20,sceneContent:f.raw})});
  fs.writeFileSync(path.join(f.root,'notes.craftsman.json'),JSON.stringify(noteDoc));
  const commentModel=require('../../src/core/word-comment-authoring-v1.cjs');
  const commentPath=path.join(f.root,'.yalken/word-review/non-text-return-state.v1.json');
  let commentText=null;
  for(const [index,selected] of [[0,'Alpha'],[2,'Right']]){
    const authored=commentModel.planCommentAuthoring({beforeText:commentText,projectId:'project-test',sceneId:'roman/01 Alpha.txt',sceneSha256:sha(f.raw),paragraphs:bookmarks.paragraphs(created.doc).map(bookmarks.textOf),now,
      input:{requestId:`topology-comment-${index}`,action:'create',projectId:'project-test',sceneId:'roman/01 Alpha.txt',expectedStateSha256:commentText===null?'':sha(commentText),expectedSceneSha256:sha(f.raw),body:`Comment ${index}`,anchor:{paragraphIndex:index,startUtf16:0,selectedText:selected}}});
    commentText=authored.afterText;
  }
  fs.mkdirSync(path.dirname(commentPath),{recursive:true});fs.writeFileSync(commentPath,commentText);f.commentPath=commentPath;
  const original=f.capture;
  f.capture=extra=>original({operation:'split',bindings:[],commentsText:text(commentPath),topology:{sourceNodeId:'tree-node-a',sourceRelativePath:'roman/01 Alpha.txt',boundaryRootIndex:2,newRelativePath:'roman/01a Right.txt'},...extra});
  return f;
}
test('rich root split and adjacent merge preserve occurrence anchors and exact structural Undo',async t=>{
  const f=topologyFixture(t),m=await modelPromise,before=f.capture(),plan=m.planProjectTreeCohort(before);
  assert.equal(plan.scenePartitions.length,2);assert.equal(plan.scenePublications[0].beforeContent,f.raw);
  assert.equal(plan.createdNodeIds.length,1);assert.deepEqual(plan.sceneReceiptSources[1].sourceRelativePaths,['roman/01 Alpha.txt']);
  await tx.commitProjectTransaction({manifestPath:f.manifestPath,revision:1,treeCohort:plan,publishManifest:f.publishManifest,revalidate:async()=>{}});
  const left=text(path.join(f.root,'roman/01 Alpha.txt')),right=text(path.join(f.root,'roman/01a Right.txt'));
  assert.equal(notes.sceneText(left)+'\n'+notes.sceneText(right),notes.sceneText(f.raw));
  assert.equal(envelope.parseObservablePayload(right).hasMetaBlock,true);assert.deepEqual(envelope.parseObservablePayload(right).meta,envelope.createDefaultDocumentMeta());
  assert.equal(bookmarks.readRegistry(envelope.parseObservablePayload(right).doc).bookmarks[0].start.paragraphIndex,0);
  const noteDoc=JSON.parse(text(path.join(f.root,'notes.craftsman.json')));
  assert.equal(noteDoc.notes[0].manuscript.reference.sceneId,'roman/01 Alpha.txt');
  assert.equal(noteDoc.notes[1].manuscript.reference.sceneId,'roman/01a Right.txt');
  assert.equal(noteDoc.notes[1].manuscript.reference.offsetUtf16,6);
  const threads=JSON.parse(text(f.commentPath)).threads, originalThreads=JSON.parse(before.commentsText).threads;
  assert.deepEqual(threads.map(t=>t.threadId),originalThreads.map(t=>t.threadId));
  assert.deepEqual(threads[1].messages,originalThreads[1].messages);
  assert.equal(threads[1].anchor.sceneParagraphIndex,0);assert.equal(threads[1].sceneId,'roman/01a Right.txt');
  const merged=m.planProjectTreeCohort(f.capture({operation:'merge',operationId:'merge-one',expectedTreeRevision:1,topology:{leftNodeId:'tree-node-a',leftRelativePath:'roman/01 Alpha.txt',rightNodeId:plan.createdNodeIds[0],rightRelativePath:'roman/01a Right.txt'}}));
  await tx.commitProjectTransaction({manifestPath:f.manifestPath,revision:2,treeCohort:merged,publishManifest:f.publishManifest,revalidate:async()=>{}});
  assert.deepEqual(envelope.parseObservablePayload(text(path.join(f.root,'roman/01 Alpha.txt'))).doc,envelope.parseObservablePayload(f.raw).doc);
  const state=await tx.readVerifiedProjectTreeMutation({manifestPath:f.manifestPath});
  const undo=m.planProjectTreeUndo({projectId:'project-test',operationId:'undo-merge',expectedTreeRevision:2,lastMutation:state.lastMutation.id,receipt:state.receipt,retainedPacket:state.retainedPacket,currentManifestText:text(f.manifestPath),currentInventory:inventory(f.root)});
  await tx.commitProjectTransaction({manifestPath:f.manifestPath,revision:3,treeCohort:undo,publishManifest:f.publishManifest,revalidate:async()=>{}});
  assert.equal(text(path.join(f.root,'roman/01 Alpha.txt')),left);assert.equal(text(path.join(f.root,'roman/01a Right.txt')),right);
});

test('split exact Undo publishes both old owners and restores bytes after reopening',async t=>{
  const f=topologyFixture(t),m=await modelPromise,base=f.capture(),plan=m.planProjectTreeCohort(base);
  await tx.commitProjectTransaction({manifestPath:f.manifestPath,revision:1,treeCohort:plan,publishManifest:f.publishManifest,revalidate:async()=>{}});
  const state=await tx.readVerifiedProjectTreeMutation({manifestPath:f.manifestPath});
  const undo=m.planProjectTreeUndo({projectId:'project-test',operationId:'undo-split',expectedTreeRevision:1,lastMutation:state.lastMutation.id,receipt:state.receipt,retainedPacket:state.retainedPacket,currentManifestText:text(f.manifestPath),currentInventory:inventory(f.root)});
  assert.equal(undo.scenePublications.length,2);assert.equal(undo.scenePublications[1].beforeNodeId,plan.createdNodeIds[0]);
  for(const row of undo.scenePublications){assert.equal(row.afterNodeId,'tree-node-a');assert.equal(row.afterContent,f.raw);}
  await tx.commitProjectTransaction({manifestPath:f.manifestPath,revision:2,treeCohort:undo,publishManifest:f.publishManifest,revalidate:async()=>{}});
  assert.equal(text(f.manifestPath),base.beforeManifestText);assert.equal(text(path.join(f.root,'roman/01 Alpha.txt')),f.raw);
  assert.equal(text(path.join(f.root,'notes.craftsman.json')),base.notesText);assert.deepEqual(inventory(f.root),base.inventory);
});

test('split current receipt recovers late full buffer into independent copy and preserves current partitions',async t=>{
  const f=topologyFixture(t),m=await modelPromise,plan=m.planProjectTreeCohort(f.capture());
  await tx.commitProjectTransaction({manifestPath:f.manifestPath,revision:1,treeCohort:plan,publishManifest:f.publishManifest,revalidate:async()=>{}});
  const state=await tx.readVerifiedProjectTreeMutation({manifestPath:f.manifestPath});
  const before=inventory(f.root),beforeNotes=JSON.parse(text(path.join(f.root,'notes.craftsman.json'))).notes;
  const recovery={receipt:state.receipt,retainedPacket:state.retainedPacket,sourceNodeId:'tree-node-a',workingContent:f.raw};
  const input=f.capture({operation:'copy',operationId:'recovery-topology',topology:undefined,expectedTreeRevision:1,bindings:[{nodeId:'tree-node-a',fromRelativePath:'roman/01 Alpha.txt',toRelativePath:'roman/03 Recovered.txt'}],recoveredCopy:recovery});
  for(const bad of [{...recovery,sourceNodeId:plan.createdNodeIds[0]},{...recovery,removedNodeId:'tree-node-a'},{...recovery,receipt:{...state.receipt,treeRevision:8}}])assert.throws(()=>m.planProjectTreeCohort({...input,recoveredCopy:bad}));
  const recovered=m.planProjectTreeCohort(input);
  await tx.commitProjectTransaction({manifestPath:f.manifestPath,revision:2,treeCohort:recovered,publishManifest:f.publishManifest,revalidate:async()=>{}});
  for(const entry of before.filter(e=>e.role==='scene'))assert.equal(fs.readFileSync(path.join(f.root,entry.relativePath)).toString('base64'),entry.contentBase64);
  const raw=text(path.join(f.root,'roman/03 Recovered.txt'));
  assert.equal(notes.sceneText(raw),notes.sceneText(f.raw));
  const fresh=bookmarks.readRegistry(envelope.parseObservablePayload(raw).doc).bookmarks;
  const old=bookmarks.readRegistry(envelope.parseObservablePayload(f.raw).doc).bookmarks;
  assert.equal(fresh.length,old.length);assert.ok(fresh.every(r=>!old.some(o=>o.id===r.id)));
  const noteDoc=JSON.parse(text(path.join(f.root,'notes.craftsman.json')));
  assert.deepEqual(noteDoc.notes.slice(0,2),beforeNotes);assert.equal(noteDoc.notes.length,4);
  assert.ok(noteDoc.notes.slice(2).every(n=>n.manuscript.reference.sceneId==='roman/03 Recovered.txt'));
});

for(const conflict of ['bookmarkCrossing','linkCrossing','boundary','pending','staleNote','metadata','duplicateBookmark'])test(`topology ${conflict} refuses before filesystem mutation`,async t=>{
  const f=topologyFixture(t),m=await modelPromise,p=path.join(f.root,'roman/01 Alpha.txt');let input=f.capture();
  if(conflict==='boundary')input.topology.boundaryRootIndex=0;
  if(conflict==='staleNote'){const value=JSON.parse(input.notesText);value.notes[0].manuscript.reference.sourceTextSha256='0'.repeat(64);input.notesText=JSON.stringify(value);}
  if(['bookmarkCrossing','linkCrossing','pending'].includes(conflict)){
    const parsed=envelope.parseObservablePayload(text(p));
    if(conflict==='bookmarkCrossing')parsed.doc.attrs.wordUserBookmarks.bookmarks[0].end={paragraphIndex:2,offsetUtf16:1,edge:'text'};
    if(conflict==='linkCrossing')parsed.doc.content[2].content[0].marks=[{type:'link',attrs:bookmarks.linkAttrs(parsed.doc.attrs.wordUserBookmarks.bookmarks[0])}];
    if(conflict==='pending'){
      delete parsed.doc.attrs.wordUserBookmarks;
      parsed.doc.content[1].content[0].marks=[];
      delete parsed.doc.attrs;
      for(const block of parsed.doc.content)block.content ||= [];
      parsed.doc=pending.bindLedger({schemaVersion:2,source:parsed.doc,revisions:[],undo:[],redo:[],roundUndo:[],roundRedo:[],returnReceipts:[]});
    }
    fs.writeFileSync(p,envelope.composeObservablePayload({...parsed,doc:parsed.doc}));input=f.capture();
  }
  if(['metadata','duplicateBookmark'].includes(conflict)){
    const a=envelope.parseObservablePayload(f.raw),b=envelope.parseObservablePayload(f.raw);
    if(conflict==='metadata'){a.meta.synopsis='left';b.meta.synopsis='right';delete b.doc.attrs.wordUserBookmarks;b.doc.content[1].content[0].marks=[];}
    fs.writeFileSync(p,envelope.composeObservablePayload({...a,metaEnabled:true}));fs.writeFileSync(path.join(f.root,'roman/02 Beta.txt'),envelope.composeObservablePayload({...b,metaEnabled:true}));
    input=f.capture({operation:'merge',topology:{leftNodeId:'tree-node-a',leftRelativePath:'roman/01 Alpha.txt',rightNodeId:'tree-node-b',rightRelativePath:'roman/02 Beta.txt'}});
  }
  const before=inventory(f.root);assert.throws(()=>m.planProjectTreeCohort(input), conflict==='pending'?{code:'E_TREE_TOPOLOGY_PENDING_UNSUPPORTED'}:undefined);assert.deepEqual(inventory(f.root),before);assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)),false);
});

for(const stage of ['beforeMarker','afterMarker'])test(`split transaction ${stage} interruption recovers whole annotation graph`,async t=>{
  const f=topologyFixture(t),m=await modelPromise,base=f.capture(),plan=m.planProjectTreeCohort(base);let injected=false;
  const adapter={...fsp,unlink:async p=>{if(stage==='afterMarker'&&!injected&&p===tx.journalPathFor(f.manifestPath)){injected=true;throw Error('split interruption');}return fsp.unlink(p);}};
  await assert.rejects(tx.commitProjectTransaction({manifestPath:f.manifestPath,revision:1,treeCohort:plan,publishManifest:f.publishManifest,revalidate:async()=>{},fsAdapter:adapter,
    afterTreeFilesPublish:()=>{if(stage==='beforeMarker'){injected=true;throw Error('split interruption');}}}),/split interruption/);
  assert.equal(injected,true);assert.equal((await tx.readPendingProjectTransactionBinding({manifestPath:f.manifestPath})).mode,'tree');
  const recovery=await tx.recoverProjectTransaction({manifestPath:f.manifestPath,publishManifest:f.publishManifest,revalidate:async()=>{}});
  if(stage==='beforeMarker'){
    assert.equal(recovery.outcome,'UNCOMMITTED_ROLLED_BACK');assert.equal(text(f.manifestPath),base.beforeManifestText);assert.deepEqual(inventory(f.root),base.inventory);
    assert.equal(text(f.commentPath),base.commentsText);assert.equal(text(path.join(f.root,'notes.craftsman.json')),base.notesText);
  }else{
    assert.equal(recovery.outcome,'COMMITTED_ROLLED_FORWARD');assert.equal((await tx.readVerifiedProjectTreeMutation({manifestPath:f.manifestPath})).lastMutation.canUndo,true);
    assert.equal(notes.sceneText(text(path.join(f.root,'roman/01 Alpha.txt')))+'\n'+notes.sceneText(text(path.join(f.root,'roman/01a Right.txt'))),notes.sceneText(f.raw));
  }
});

test('split retains complete resource receipts on both partitions; merge unions proofs; changed resource prevents publication',async t=>{
  const f=fixture(t),m=await modelPromise,source=path.join(f.root,'roman/01 Alpha.txt');
  const doc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Left'}]},{type:'paragraph',content:[{type:'text',text:'Right'}]}]};
  fs.writeFileSync(source,envelope.composeObservablePayload({doc}));fs.mkdirSync(path.join(f.root,'assets'));
  for(const [relative,assetName]of[['roman/01 Alpha.txt','alpha'],['roman/02 Beta.txt','beta']]){
    const p=path.join(f.root,relative),asset=path.join(f.root,'assets',assetName+'.bin');fs.writeFileSync(asset,assetName);
    fs.writeFileSync(tx.commitPathFor(p),JSON.stringify({schemaVersion:'yalken.project-transaction.commit.v2',transactionId:sha(assetName),revision:0,scenePath:p,manifestPath:f.manifestPath,
      sceneDigest:sha(text(p)),manifestDigest:sha(text(f.manifestPath)),resources:[{path:asset,digest:sha(assetName),bytes:assetName.length}]}));
  }
  const split=m.planProjectTreeCohort(f.capture({operation:'split',bindings:[],topology:{sourceNodeId:'tree-node-a',sourceRelativePath:'roman/01 Alpha.txt',newRelativePath:'roman/01a Right.txt',boundaryRootIndex:1}}));
  await tx.commitProjectTransaction({manifestPath:f.manifestPath,revision:1,treeCohort:split,publishManifest:f.publishManifest,revalidate:async()=>{}});
  const a=await tx.readVerifiedProjectTransaction({scenePath:source,manifestPath:f.manifestPath});
  const rightPath=path.join(f.root,'roman/01a Right.txt'),b=await tx.readVerifiedProjectTransaction({scenePath:rightPath,manifestPath:f.manifestPath});
  assert.deepEqual(a.resources,b.resources);assert.equal(b.resources[0].digest,sha('alpha'));
  const mergeInput=f.capture({operation:'merge',operationId:'merge-resources',bindings:[],expectedTreeRevision:1,topology:{leftNodeId:split.createdNodeIds[0],leftRelativePath:'roman/01a Right.txt',rightNodeId:'tree-node-b',rightRelativePath:'roman/02 Beta.txt'}});
  const merge=m.planProjectTreeCohort(mergeInput);fs.writeFileSync(path.join(f.root,'assets/beta.bin'),'broken');
  await assert.rejects(tx.commitProjectTransaction({manifestPath:f.manifestPath,revision:2,treeCohort:merge,publishManifest:f.publishManifest,revalidate:async()=>{}}),{code:'E_PROJECT_TRANSACTION_RESOURCE_READBACK'});
  assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)),false);fs.writeFileSync(path.join(f.root,'assets/beta.bin'),'beta');
  await tx.commitProjectTransaction({manifestPath:f.manifestPath,revision:2,treeCohort:merge,publishManifest:f.publishManifest,revalidate:async()=>{}});
  const merged=await tx.readVerifiedProjectTransaction({scenePath:rightPath,manifestPath:f.manifestPath});assert.deepEqual(merged.resources.map(r=>r.digest).sort(),[sha('alpha'),sha('beta')].sort());
  const raw=text(rightPath);await tx.commitProjectTransaction({scenePath:rightPath,sceneContent:raw+' ',expectedSceneContent:raw,manifestPath:f.manifestPath,manifestContent:text(f.manifestPath),expectedManifestContent:text(f.manifestPath),revision:3,publishManifest:f.publishManifest});
  assert.deepEqual((await tx.readVerifiedProjectTransaction({scenePath:rightPath,manifestPath:f.manifestPath})).resources,merged.resources);
  assert.equal((await tx.readVerifiedProjectTreeMutation({manifestPath:f.manifestPath})).lastMutation.canUndo,false);
});

test('root split conserves nested table/list leaves, repeated text, empty points and afterParagraph ownership',async t=>{
  const f=fixture(t),m=await modelPromise,p=path.join(f.root,'roman/01 Alpha.txt');
  const para=s=>({type:'paragraph',...(s?{content:[{type:'text',text:s}]}:{})});
  const cell=content=>({type:'tableCell',attrs:{colspan:1,rowspan:1,colwidth:null},content});
  const inner={type:'table',content:[{type:'tableRow',content:[cell([para('same')])]}]};
  const table={type:'table',content:[{type:'tableRow',content:[cell([para('same'),inner,para('')])]}]};
  let doc={type:'doc',content:[para('same'),table,{type:'bulletList',content:[{type:'listItem',content:[para('same')]}]},para(''),para('😀 same')]};
  for(const [name,start,end]of[['Before',{paragraphIndex:4,offsetUtf16:4,edge:'afterParagraph'},{paragraphIndex:4,offsetUtf16:4,edge:'afterParagraph'}],['Empty',{paragraphIndex:5,offsetUtf16:0,edge:'text'},{paragraphIndex:5,offsetUtf16:0,edge:'text'}],['Emoji',{paragraphIndex:6,offsetUtf16:0,edge:'text'},{paragraphIndex:6,offsetUtf16:2,edge:'text'}]])
    doc=bookmarks.planMutation({doc,action:'create',requestId:name,projectId:'project-test',sceneId:'roman/01 Alpha.txt',name,start,end}).doc;
  fs.writeFileSync(p,envelope.composeObservablePayload({doc}));
  const plan=m.planProjectTreeCohort(f.capture({operation:'split',bindings:[],topology:{sourceNodeId:'tree-node-a',sourceRelativePath:'roman/01 Alpha.txt',newRelativePath:'roman/01a Right.txt',boundaryRootIndex:3}}));
  const read=relative=>envelope.parseObservablePayload(Buffer.from(plan.entries.find(e=>e.relativePath===relative).afterBase64,'base64').toString()).doc;
  const left=read('roman/01 Alpha.txt'),right=read('roman/01a Right.txt');
  assert.deepEqual(left.content,doc.content.slice(0,3));assert.deepEqual(right.content,doc.content.slice(3));
  assert.equal(bookmarks.readRegistry(left).bookmarks[0].start.edge,'afterParagraph');
  assert.deepEqual(bookmarks.readRegistry(right).bookmarks.map(b=>b.start.paragraphIndex),[0,1]);
  assert.deepEqual(plan.scenePartitions.map(p=>[p.leafFrom,p.leafTo,p.targetLeafFrom]),[[0,5,0],[5,7,0]]);
});

test('merge refuses nonadjacent or intervening folder and combines disjoint metadata/cards without deduplication',async t=>{
  const f=fixture(t),m=await modelPromise,a=path.join(f.root,'roman/01 Alpha.txt'),b=path.join(f.root,'roman/02 Beta.txt'),card={title:'Same',text:'same',tags:''};
  const left={...envelope.createDefaultDocumentMeta(),synopsis:'left'},right=envelope.createDefaultDocumentMeta();right.tags.place='right';
  fs.writeFileSync(a,envelope.composeObservablePayload({text:'Left',metaEnabled:true,meta:left,cards:[card]}));
  fs.writeFileSync(b,envelope.composeObservablePayload({text:'Right',metaEnabled:true,meta:right,cards:[card]}));
  const capture=()=>f.capture({operation:'merge',bindings:[],topology:{leftNodeId:'tree-node-a',leftRelativePath:'roman/01 Alpha.txt',rightNodeId:'tree-node-b',rightRelativePath:'roman/02 Beta.txt'}});
  fs.mkdirSync(path.join(f.root,'roman/01z Folder'));assert.throws(()=>m.planProjectTreeCohort(capture()),{code:'E_TREE_TOPOLOGY_NOT_ADJACENT'});fs.rmdirSync(path.join(f.root,'roman/01z Folder'));
  const plan=m.planProjectTreeCohort(capture()),parsed=envelope.parseObservablePayload(Buffer.from(plan.entries.find(e=>e.relativePath==='roman/01 Alpha.txt').afterBase64,'base64').toString());
  assert.equal(parsed.meta.synopsis,'left');assert.equal(parsed.meta.tags.place,'right');assert.deepEqual(parsed.cards,[card,card]);
});

for(const kind of ['merge','undo-split','undo-merge'])test(`verified ${kind} beforeimage alone authorizes rich recovery copy`,async t=>{
  const f=topologyFixture(t),m=await modelPromise,commit=plan=>tx.commitProjectTransaction({manifestPath:f.manifestPath,revision:plan.expectedTreeRevision+1,treeCohort:plan,publishManifest:f.publishManifest,revalidate:async()=>{}});
  const split=m.planProjectTreeCohort(f.capture());await commit(split);let state=await tx.readVerifiedProjectTreeMutation({manifestPath:f.manifestPath}),revision=1;
  const rightId=split.createdNodeIds[0],rightRaw=text(path.join(f.root,'roman/01a Right.txt'));
  if(kind!=='undo-split'){
    await commit(m.planProjectTreeCohort(f.capture({operation:'merge',operationId:'merge-before-recovery',expectedTreeRevision:1,topology:{leftNodeId:'tree-node-a',leftRelativePath:'roman/01 Alpha.txt',rightNodeId:rightId,rightRelativePath:'roman/01a Right.txt'}})));
    state=await tx.readVerifiedProjectTreeMutation({manifestPath:f.manifestPath});revision++;
  }
  if(kind.startsWith('undo-')){
    await commit(m.planProjectTreeUndo({projectId:'project-test',operationId:'undo-before-recovery',expectedTreeRevision:revision,lastMutation:state.lastMutation.id,receipt:state.receipt,retainedPacket:state.retainedPacket,currentManifestText:text(f.manifestPath),currentInventory:inventory(f.root)}));
    state=await tx.readVerifiedProjectTreeMutation({manifestPath:f.manifestPath});revision++;
  }
  const whole=kind==='undo-merge',sourceNodeId=whole?'tree-node-a':rightId,workingContent=whole?f.raw:rightRaw;
  const initial=inventory(f.root).filter(e=>e.role==='scene'),notesBefore=JSON.parse(text(path.join(f.root,'notes.craftsman.json'))).notes;
  const input=f.capture({operation:'copy',topology:undefined,operationId:'recover-topology-origin',expectedTreeRevision:revision,
    bindings:[{nodeId:'tree-node-a',fromRelativePath:'roman/01 Alpha.txt',toRelativePath:'roman/04 Recovered.txt'}],
    recoveredCopy:{receipt:state.receipt,retainedPacket:state.retainedPacket,sourceNodeId,workingContent}});
  const plan=m.planProjectTreeCohort(input);await commit(plan);
  const recovered=text(path.join(f.root,'roman/04 Recovered.txt'));assert.equal(notes.sceneText(recovered),notes.sceneText(workingContent));
  for(const item of initial)assert.equal(fs.readFileSync(path.join(f.root,item.relativePath)).toString('base64'),item.contentBase64);
  const afterNotes=JSON.parse(text(path.join(f.root,'notes.craftsman.json'))).notes;assert.deepEqual(afterNotes.slice(0,notesBefore.length),notesBefore);
  assert.equal(afterNotes.length,notesBefore.length+(whole?2:1));
  const nextState=await tx.readVerifiedProjectTreeMutation({manifestPath:f.manifestPath}),live=plan.pathBindings.find(b=>b.copy);
  const retry=m.planProjectTreeCohort(f.capture({operation:'copy',topology:undefined,operationId:'retry-topology-origin',expectedTreeRevision:revision+1,
    bindings:[{nodeId:live.newNodeId,fromRelativePath:live.toRelativePath,toRelativePath:'roman/05 Retry.txt'}],
    recoveredCopy:{receipt:nextState.receipt,retainedPacket:nextState.retainedPacket,sourceNodeId,workingContent}}));
  await commit(retry);assert.equal(notes.sceneText(text(path.join(f.root,'roman/05 Retry.txt'))),notes.sceneText(workingContent));assert.equal(text(path.join(f.root,'roman/04 Recovered.txt')),recovered);
});

test('split preserves actual image node and immutable content-addressed asset proof',async t=>{
  const f=fixture(t),m=await modelPromise,media=require('../../src/io/documentMedia.js'),bytes=require('../fixtures/document-jpeg-fixtures.cjs').rgb,attrs=media.createImageAttrs(bytes,{alt:'original'});
  const source=path.join(f.root,'roman/01 Alpha.txt'),asset=path.join(f.root,attrs.assetPath);fs.mkdirSync(path.dirname(asset),{recursive:true});fs.writeFileSync(asset,bytes);
  const doc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Left'}]},{type:'paragraph',content:[{type:'text',text:'Right'},{type:'image',attrs}]}]};
  const raw=envelope.composeObservablePayload({doc});fs.writeFileSync(source,raw);
  fs.writeFileSync(tx.commitPathFor(source),JSON.stringify({schemaVersion:'yalken.project-transaction.commit.v2',transactionId:sha('image'),revision:0,scenePath:source,manifestPath:f.manifestPath,sceneDigest:sha(raw),manifestDigest:sha(text(f.manifestPath)),resources:[{path:asset,digest:sha(bytes),bytes:bytes.length}]}));
  const plan=m.planProjectTreeCohort(f.capture({operation:'split',bindings:[],topology:{sourceNodeId:'tree-node-a',sourceRelativePath:'roman/01 Alpha.txt',newRelativePath:'roman/01a Right.txt',boundaryRootIndex:1}}));
  await tx.commitProjectTransaction({manifestPath:f.manifestPath,revision:1,treeCohort:plan,publishManifest:f.publishManifest,revalidate:async()=>{}});
  const rightPath=path.join(f.root,'roman/01a Right.txt');assert.deepEqual(envelope.parseObservablePayload(text(rightPath)).doc.content[0].content[1],doc.content[1].content[1]);
  assert.deepEqual(fs.readFileSync(asset),bytes);assert.equal((await tx.readVerifiedProjectTransaction({scenePath:rightPath,manifestPath:f.manifestPath})).resources[0].digest,sha(bytes));
});


test('merge admits only known absent/null pending default; genuine document attribute difference stays blocked',async t=>{
  const f=fixture(t),m=await modelPromise,p=path.join(f.root,'roman/01 Alpha.txt');
  const doc={type:'doc',attrs:{wordPendingRevisions:null},content:[{type:'paragraph',content:[{type:'text',text:'Left'}]}]};
  fs.writeFileSync(p,envelope.composeObservablePayload({doc}));
  const input=f.capture({operation:'merge',bindings:[],topology:{leftNodeId:'tree-node-a',leftRelativePath:'roman/01 Alpha.txt',rightNodeId:'tree-node-b',rightRelativePath:'roman/02 Beta.txt'}});
  const plan=m.planProjectTreeCohort(input);
  assert.equal(notes.sceneText(Buffer.from(plan.entries.find(e=>e.relativePath==='roman/01 Alpha.txt').afterBase64,'base64').toString()),'Left\nBeta');
  doc.attrs.semanticUnknown='meaningful';fs.writeFileSync(p,envelope.composeObservablePayload({doc}));
  assert.throws(()=>m.planProjectTreeCohort({...input,inventory:inventory(f.root)}),{code:'E_TREE_TOPOLOGY_DOCUMENT_ATTRS'});
});
