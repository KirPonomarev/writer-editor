'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const tx = require('../../src/core/project-transaction-v1.cjs');
const model = require('../../src/core/word-manuscript-notes-v1.cjs');
const { durableSaveTransaction } = require('../../src/core/save-coordinator-v1.cjs');
const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Тело', marks: [{ type: 'italic' }] }] }] };
function fixture(t, importing = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'manuscript-notes-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const scenePath = path.join(root, 'roman/s.txt'), manifestPath = path.join(root, 'project.json'), notePath = path.join(root, 'notes.craftsman.json');
  fs.mkdirSync(path.dirname(scenePath));
  const beforeScene = importing ? null : 'До слова', afterScene = importing ? 'До слова' : '!До слова';
  const beforeManifest = JSON.stringify({ projectId: 'p', revision: 0 }), afterManifest = JSON.stringify({ projectId: 'p', revision: 1 });
  const manuscript = model.bindManuscriptPayload({ kind: 'footnote', body, sceneId: 'roman/s.txt', offsetUtf16: 3, sceneContent: 'До слова' });
  const beforeText = JSON.stringify({ schemaVersion: 1, projectId: 'p', notes: [
    { id: 'private', scope: 'inbox', body: 'Do not change' },
    ...(!importing ? [{ id: 'note-a', scope: 'manuscript', body: 'Тело', manuscript }] : []),
  ] });
  const imported = JSON.parse(beforeText); imported.notes.push({ id: 'note-a', scope: 'manuscript', body: 'Тело', manuscript });
  const noteState = importing ? { mode: 'MANUSCRIPT_IMPORT_V1', beforeText, afterText: JSON.stringify(imported) }
    : model.planManuscriptNoteAnchorSave({ beforeText, projectId: 'p', sceneId: 'roman/s.txt', beforeContent: beforeScene, afterContent: afterScene });
  if (beforeScene !== null) fs.writeFileSync(scenePath, beforeScene);
  fs.writeFileSync(manifestPath, beforeManifest); fs.writeFileSync(notePath, beforeText);
  const request = { scenePath, manifestPath, sceneContent: afterScene, expectedSceneContent: beforeScene,
    manifestContent: afterManifest, expectedManifestContent: beforeManifest, revision: 1, noteState };
  fs.writeFileSync(path.join(root, 'request.json'), JSON.stringify(request));
  return { root, scenePath, manifestPath, notePath, beforeScene, afterScene, beforeManifest, afterManifest, beforeText, request };
}
const publishManifest = async ({ manifestPath, expectedText, nextText, revision }) => {
  assert.equal(fs.readFileSync(manifestPath, 'utf8'), expectedText);
  await durableSaveTransaction({ filePath: manifestPath, content: nextText, revision });
};
const observed = f => [fs.existsSync(f.scenePath) ? fs.readFileSync(f.scenePath, 'utf8') : null,
  fs.readFileSync(f.manifestPath, 'utf8'), fs.existsSync(f.notePath) ? fs.readFileSync(f.notePath, 'utf8') : null];
const CHILD = `
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path');
const [modulePath,savePath,root,mode,boundary]=process.argv.slice(1),tx=require(modulePath),{durableSaveTransaction}=require(savePath),q=JSON.parse(fs.readFileSync(path.join(root,'request.json')));
const targets=new Map([[tx.journalPathFor(q.manifestPath),'JOURNAL'],[q.manifestPath,'MANIFEST'],[q.scenePath,'SCENE'],[path.join(root,'notes.craftsman.json'),'NOTES'],[tx.commitPathFor(q.scenePath),'COMMIT']]);
const adapter={...fsp,rename:async(a,b)=>{const result=await fsp.rename(a,b);if(mode==='crash'&&targets.get(b)===boundary)process.kill(process.pid,'SIGKILL');return result;},unlink:async p=>{if(mode==='crash'&&p===tx.journalPathFor(q.manifestPath)&&boundary==='BEFORE_CLEANUP')process.kill(process.pid,'SIGKILL');const result=await fsp.unlink(p);if(mode==='crash'&&p===tx.journalPathFor(q.manifestPath)&&boundary==='AFTER_CLEANUP')process.kill(process.pid,'SIGKILL');return result;}};
const publishManifest=async({manifestPath,expectedText,nextText,revision})=>{if(fs.readFileSync(manifestPath,'utf8')!==expectedText)throw Error('CAS');await durableSaveTransaction({filePath:manifestPath,content:nextText,revision,fsAdapter:adapter});};
(mode==='recover'?tx.recoverProjectTransaction({...q,publishManifest,fsAdapter:adapter}):tx.commitProjectTransaction({...q,publishManifest,fsAdapter:adapter})).then(()=>process.exit(0)).catch(e=>{console.error(e.code||e.message);process.exit(1)});
`;
function child(f, mode, boundary = '') {
  return new Promise((resolve, reject) => {
    const c = spawn(process.execPath, ['-e', CHILD, require.resolve('../../src/core/project-transaction-v1.cjs'),
      require.resolve('../../src/core/save-coordinator-v1.cjs'), f.root, mode, boundary]);
    let stderr = ''; const timer = setTimeout(() => { c.kill('SIGKILL'); reject(Error('owned child timeout')); }, 15000);
    c.stderr.on('data', chunk => { stderr += chunk; }); c.on('error', reject);
    c.on('close', (code, signal) => { clearTimeout(timer); resolve({ code, signal, stderr }); });
  });
}
for (const importing of [false, true]) {
  for (const boundary of ['JOURNAL', 'MANIFEST', 'SCENE', 'NOTES', 'COMMIT', 'BEFORE_CLEANUP', 'AFTER_CLEANUP']) {
    test(`manuscript ${importing ? 'import' : 'rebase'}: SIGKILL ${boundary} recovers all members in a new process`, async t => {
      const f = fixture(t, importing), crash = await child(f, 'crash', boundary);
      assert.equal(crash.signal, 'SIGKILL', JSON.stringify(crash));
      const recovery = await child(f, 'recover'); assert.equal(recovery.code, 0, recovery.stderr);
      const committed = ['COMMIT', 'BEFORE_CLEANUP', 'AFTER_CLEANUP'].includes(boundary);
      assert.deepEqual(observed(f), committed ? [f.afterScene, f.afterManifest, f.request.noteState.afterText]
        : [f.beforeScene, f.beforeManifest, f.beforeText]);
      assert.equal((await child(f, 'recover')).code, 0);
      if (!committed) assert.equal((await child(f, 'commit')).code, 0);
      assert.deepEqual(observed(f), [f.afterScene, f.afterManifest, f.request.noteState.afterText]);
      assert.equal(tx.classifyProjectTransactionState(f).classification, 'NEW_COMMITTED');
    });
  }
}
test('note cohort cannot mutate body/private state through scene save or bypass CAS', async t => {
  const f = fixture(t), before = observed(f);
  for (const mutate of [x => x.notes[0].body = 'leak', x => x.notes[1].manuscript.body.content[0].content[0].text = 'forged',
    x => x.notes[1].manuscript.reference.sceneId = 'roman/other.txt']) {
    const after = JSON.parse(f.request.noteState.afterText); mutate(after);
    await assert.rejects(tx.commitProjectTransaction({ ...f.request, publishManifest,
      noteState: { ...f.request.noteState, afterText: JSON.stringify(after) } }), /NOTE_STATE/);
    assert.deepEqual(observed(f), before);
  }
  fs.writeFileSync(f.notePath, f.beforeText + ' ');
  await assert.rejects(tx.commitProjectTransaction({ ...f.request, publishManifest }), /NOTE_CAS/);
  assert.deepEqual(observed(f), [f.beforeScene, f.beforeManifest, f.beforeText + ' ']);
});
test('missing notes storage is created and rolled back coherently', async t => {
  const f = fixture(t, true); fs.unlinkSync(f.notePath);
  const after = JSON.parse(f.request.noteState.afterText); after.notes.shift();
  f.request.noteState = { mode: 'MANUSCRIPT_IMPORT_V1', beforeText: null, afterText: JSON.stringify(after) };
  fs.writeFileSync(path.join(f.root, 'request.json'), JSON.stringify(f.request));
  assert.equal((await child(f, 'crash', 'NOTES')).signal, 'SIGKILL');
  const recovery = await child(f, 'recover'); assert.equal(recovery.code, 0, recovery.stderr);
  assert.deepEqual(observed(f), [null, f.beforeManifest, null]);
  assert.equal((await child(f, 'commit')).code, 0);
  assert.deepEqual(observed(f), [f.afterScene, f.afterManifest, f.request.noteState.afterText]);
});
function proofFixture(t, recording) {
  const f=fixture(t),pending=require('../../src/core/word-pending-text-revisions-v1.cjs'),envelope=require('../../src/core/document-content-envelope-v1.cjs');
  const source={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'AxxB'}]}]},points=[1,3].map((offsetUtf16,i)=>({noteId:'note-'+i,paragraphIndex:0,offsetUtf16}));
  const old={schemaVersion:3,source,revisions:[{id:'revision-1',nativeId:'51',operation:'delete',author:'Editor',date:'',dateUtc:'',paragraphIndex:0,from:1,to:3,state:'pending',groupId:null}],
    undo:[],redo:[],roundUndo:[],roundRedo:[],returnReceipts:[],noteSourcePoints:points};
  const beforeDoc=recording?pending.bindLedger(old):source;
  f.beforeScene=envelope.composeObservablePayload({doc:beforeDoc});
  const document={schemaVersion:1,projectId:'p',notes:[{id:'private',scope:'inbox',body:'Immutable'},...points.map((point,i)=>({id:point.noteId,scope:'manuscript',title:'Keep '+i,body:'Тело',
    manuscript:model.bindManuscriptPayload({kind:i?'endnote':'footnote',body,sceneId:'roman/s.txt',offsetUtf16:recording?1:point.offsetUtf16,sceneContent:f.beforeScene})}))]};
  f.beforeText=JSON.stringify(document);let afterDoc,proofKey,proof;
  if(recording){
    const recorder=require('../../src/core/word-pending-recording-v1.cjs'),metadata={author:'Writer',date:'2026-10-06T00:00:00.000Z'},
      digest=require('../../src/core/word-comment-edit-intents-v1.cjs').textDigest(['AB']),previousIntents={schemaVersion:2,baselineTextSha256:digest,edits:[]},
      nextIntents={...previousIntents,edits:[{id:'insert',historyId:'insert',direction:'forward',fromParagraphIndex:0,toParagraphIndex:0,fromUtf16:1,toUtf16:1,removedParagraphs:[''],insertedParagraphs:['!']}]};
    afterDoc=recorder.derive(beforeDoc,{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'A!B'}]}]},metadata,nextIntents).doc;
    proofKey='recordingProofJson';proof={schemaVersion:1,sessionId:'recording-test',baselineContent:f.beforeScene,metadata,previousIntents,nextIntents};
  }else{
    const receipt={roundId:'authenticated-synthetic-round',artifactSha256:'a'.repeat(64)},baseline={projectId:'p',policy:'MANUSCRIPT_NOTES_EXPLICIT_RETURN_V1',
      stateDigest:require('../../src/export/docx/docxReviewPacketNotes.js').notesStateDigest(document),sourceBindings:points.map((point,i)=>({noteId:point.noteId,sceneId:'roman/s.txt',kind:i?'endnote':'footnote',richBody:body,transportIdentity:'_YALKEN_NOTE_'+String(i).repeat(24)}))};
    const returnedDoc=pending.bindLedger(old),bound=pending.bindNoteSourcePoints(source,points);
    afterDoc=pending.replaceFromReturn(bound,returnedDoc,receipt).doc;
    proofKey='pendingNoteReturnProofJson';proof={schemaVersion:1,projectId:'p',sceneId:'roman/s.txt',baseline,exportMap:{scenes:[]},returnedDoc,receipt,
      returnedNotes:points.map((point,i)=>({kind:i?'endnote':'footnote',transportIdentity:baseline.sourceBindings[i].transportIdentity,body,paragraphIndex:0,offsetUtf16:point.offsetUtf16})),
      unionReferences:points.map((point,i)=>({kind:i?'endnote':'footnote',paragraphIndex:0,offsetUtf16:point.offsetUtf16}))};
  }
  f.afterScene=envelope.composeObservablePayload({doc:afterDoc});
  const noteState=model.planManuscriptNoteAnchorSave({beforeText:f.beforeText,projectId:'p',sceneId:'roman/s.txt',beforeContent:f.beforeScene,afterContent:f.afterScene,[proofKey]:JSON.stringify(proof)});
  f.request={...f.request,sceneContent:f.afterScene,expectedSceneContent:f.beforeScene,noteState};
  fs.writeFileSync(f.scenePath,f.beforeScene);fs.writeFileSync(f.notePath,f.beforeText);fs.writeFileSync(path.join(f.root,'request.json'),JSON.stringify(f.request));return f;
}
for(const recording of [false,true])for(const boundary of ['JOURNAL','MANIFEST','SCENE','NOTES','COMMIT','BEFORE_CLEANUP','AFTER_CLEANUP'])
 test(`proof-bearing ${recording?'recording':'single-scene return'} note cohort recovers exact source points and complete notes after ${boundary}`,async t=>{
  const f=proofFixture(t,recording);assert.equal((await child(f,'crash',boundary)).signal,'SIGKILL');
  const recovery=await child(f,'recover');assert.equal(recovery.code,0,recovery.stderr);
  const committed=['COMMIT','BEFORE_CLEANUP','AFTER_CLEANUP'].includes(boundary);
  assert.deepEqual(observed(f),committed?[f.afterScene,f.afterManifest,f.request.noteState.afterText]:[f.beforeScene,f.beforeManifest,f.beforeText]);
  assert.equal((await child(f,'recover')).code,0);if(!committed)assert.equal((await child(f,'commit')).code,0);
  assert.deepEqual(observed(f),[f.afterScene,f.afterManifest,f.request.noteState.afterText]);
  const pending=require('../../src/core/word-pending-text-revisions-v1.cjs'),doc=require('../../src/core/document-content-envelope-v1.cjs').parseObservablePayload(f.afterScene).doc;
  assert.deepEqual(pending.readLedger(doc).noteSourcePoints.map(p=>p.offsetUtf16),recording?[2,4]:[1,3]);
  assert.deepEqual(JSON.parse(f.request.noteState.afterText).notes.map(n=>n.manuscript?.body||n.body),JSON.parse(f.beforeText).notes.map(n=>n.manuscript?.body||n.body));
 });
