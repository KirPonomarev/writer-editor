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
