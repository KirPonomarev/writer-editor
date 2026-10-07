'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { deriveChanges } = require('../../src/core/word-pending-recording-intents-v1.cjs');
const { textDigest } = require('../../src/core/word-comment-edit-intents-v1.cjs');
const recording = require('../../src/core/word-pending-recording-v1.cjs');
const review = require('../../src/core/word-pending-text-revisions-v1.cjs');
const doc = text => ({ type: 'doc', content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }] });
const meta = { author: 'Editor', date: '2026-10-05T07:00:00.000Z' };
const edit = (id, from, removed, inserted, direction = 'forward', historyId = id) => ({ id, historyId, direction,
  fromParagraphIndex: 0, toParagraphIndex: 0, fromUtf16: from, toUtf16: from + removed.length,
  removedParagraphs: [removed], insertedParagraphs: [inserted] });
const plan = (text, ...edits) => ({ schemaVersion: 2, baselineTextSha256: textDigest([text]), edits });
const change = (from, to, newFrom, newTo) => ({ from, to, newFrom, newTo });


const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const authoring = require('../../src/core/word-comment-authoring-v1.cjs');
const { planRecordingCommentSave } = require('../../src/core/word-pending-recording-comments-v1.cjs');
const { planPendingCommentDecision } = require('../../src/core/word-pending-comment-decisions-v1.cjs');
const { sha256UpdateCompatible: sha } = require('../../src/core/browser-safe-hash.cjs');
const projectId='record-comments', sceneId='roman/a.txt';
const encode=doc=>envelope.composeObservablePayload({doc});
function add(doc, beforeText=null, start=1, selectedText='a', requestId='root') {
 return authoring.planCommentAuthoring({beforeText,projectId,sceneId,paragraphs:review.paragraphs(review.normalizeNode(doc)).map(p=>(p.content||[]).map(n=>n.text||'\n').join('')),
 sceneSha256:sha(encode(doc)),now:'2026-10-05T00:00:00Z',input:{action:'create',requestId,projectId,sceneId,subjectId:'test',expectedStateSha256:beforeText===null?'':sha(beforeText),expectedSceneSha256:sha(encode(doc)),body:'Keep comment',anchor:{paragraphIndex:0,startUtf16:start,selectedText}}}).afterText;
}
function save(base,before,after,comments,previous,next) {
 const recordingProofJson=JSON.stringify({schemaVersion:1,baselineContent:encode(base),metadata:meta,previousIntents:previous,nextIntents:next,sessionId:'editor-session'});
 return planRecordingCommentSave({beforeText:comments,projectId,sceneId,beforeContent:encode(before),afterContent:encode(after),recordingProofJson});
}
function decide(doc,state,action) {
 const after=review.decide(doc,{action}).doc;
 return {doc:after,state:planPendingCommentDecision({beforeText:state,projectId,sceneId,beforeContent:encode(doc),afterContent:encode(after),decision:{action}}).afterText};
}
test('fresh canonical proof RHS is reused without changing complete rich replay or inputs',t=>{
 const rich=doc('aaa');rich.content[0].attrs={wordParagraphMarkTypography:{fontSlots:{ascii:'Georgia'},fontSize:'14pt'},wordParagraphSpacing:null,wordParagraphMarkLanguage:null};
 rich.content[0].content[0].marks=[{type:'textStyle',attrs:{fontFamily:'Georgia',fontSize:'12pt',wordLanguage:{val:'ru-RU',eastAsia:'ja-JP'}}}];
 const defaults=doc('aaa');defaults.content[0].attrs={wordParagraphMarkTypography:null,wordParagraphSpacing:null,wordParagraphMarkLanguage:null};
 const list={type:'doc',content:[{type:'orderedList',attrs:{start:3},content:[{type:'listItem',content:doc('aaa').content}]}]};
 const notes=review.bindLedger({schemaVersion:5,source:doc('aaa'),revisions:[],undo:[],redo:[],roundUndo:[],roundRedo:[],returnReceipts:[],noteSourcePoints:[{noteId:'note-one',paragraphIndex:0,offsetUtf16:1}]});
 const history=review.decide(recording.derive(notes,doc('a!aa'),meta,plan('aaa',edit('old',1,'','!'))).doc,{action:'undo'}).doc;
 assert.equal(review.readLedger(history).roundRedo.length,1);
 const parse=envelope.parseObservablePayload,canon=envelope.canonicalizeDocumentJson,derive=recording.derive,rows=[];
 for(const [name,base] of Object.entries({rich,defaults,list,history})) {
  const working=review.normalizeNode(base),leaf=review.paragraphs(working)[0];leaf.content.push({type:'text',text:'!'});
  const previous=plan('aaa'),next=plan('aaa',edit('new',3,'','!')),after=derive(base,working,meta,next).doc;
  const input={beforeContent:encode(base),afterContent:encode(after),recordingProofJson:JSON.stringify({schemaVersion:1,baselineContent:encode(base),metadata:meta,previousIntents:previous,nextIntents:next,sessionId:'rhs-parity'})};
  if(name==='defaults'){const raw=JSON.stringify(base);input.beforeContent='[doc-v2 length='+raw.length+']\n'+raw;}
  const original=JSON.stringify({base,working,after,input}),parsed=new Set(),derived=new Set();let rhsCopies=0,derivedCopies=0,replays=0;
  envelope.parseObservablePayload=raw=>{const value=parse(raw);parsed.add(value.doc);return value;};
  envelope.canonicalizeDocumentJson=value=>{if(parsed.has(value))rhsCopies++;if(derived.has(value))derivedCopies++;return canon(value);};
  recording.derive=(...args)=>{const before=JSON.stringify(args),value=derive(...args);assert.equal(JSON.stringify(args),before);derived.add(value.doc);replays++;return value;};
  let result;try{result=require('../../src/core/word-pending-recording-comments-v1.cjs').validateRecordingSaveProof(input);}
  finally{envelope.parseObservablePayload=parse;envelope.canonicalizeDocumentJson=canon;recording.derive=derive;}
  const expected={proof:JSON.parse(input.recordingProofJson),baseline:parse(encode(base)),before:parse(input.beforeContent),after:parse(input.afterContent),previous,next};
  assert.deepEqual(result,expected);assert.equal(JSON.stringify({base,working,after,input}),original);
  const returned=JSON.stringify(result);for(const [p,intents] of [[result.before,previous],[result.after,next]]) {
   const frozen=JSON.stringify(p.doc),oldRhs=canon(p.doc),oldLhs=canon(derive(result.baseline.doc,review.normalizeNode(p.doc),meta,intents).doc);
   assert.deepEqual(oldRhs,p.doc);assert.deepEqual(oldLhs,oldRhs);assert.equal(JSON.stringify(p.doc),frozen);
  }
  assert.equal(JSON.stringify(result),returned);assert.equal(parsed.size,3);assert.equal(replays,2);assert.equal(derivedCopies,2);rows.push({name,rhsCopies,replays,derivedCopies,input,result,derivedDocs:[...derived]});
 }
 t.diagnostic(JSON.stringify({completeCanonicalProofParity:rows}));
 for(const row of rows)assert.equal(row.rhsCopies,0,row.name);
});
test('annotated recording proof accepts exactly 32 MiB with full replay and rejects overflow and forged history',()=>{
 const base=doc('aaa'),state=add(base),next=plan('aaa',edit('middle',1,'a',''));
 const recorded=recording.derive(base,doc('aa'),meta,next).doc;
 const proof=JSON.stringify({schemaVersion:1,baselineContent:encode(base),metadata:meta,previousIntents:plan('aaa'),nextIntents:next,sessionId:'editor-session'});
 const limit=32*1024*1024,padded=proof+' '.repeat(limit-Buffer.byteLength(proof));assert.equal(Buffer.byteLength(padded),limit);
 const input={beforeText:state,projectId,sceneId,beforeContent:encode(base),afterContent:encode(recorded),recordingProofJson:padded};
 const original=JSON.stringify({base,recorded,state}),saved=planRecordingCommentSave(input);
 assert.deepEqual(saved,{...save(base,base,recorded,state,plan('aaa'),next),recordingProofJson:padded});
 const undo=decide(JSON.parse(JSON.stringify(recorded)),saved.afterText,'undo');
 assert.deepEqual(JSON.parse(undo.state).threads[0].anchor,JSON.parse(state).threads[0].anchor);
 assert.deepEqual(decide(undo.doc,undo.state,'redo').doc,recorded);
 assert.throws(()=>planRecordingCommentSave({...input,recordingProofJson:padded+' '}),/RECORDING_COMMENT_PROOF_BUDGET/u);
 const forged=JSON.parse(JSON.stringify(review.readLedger(recorded)));forged.revisions[0].author='Forged';
 assert.throws(()=>planRecordingCommentSave({...input,afterContent:encode(review.bindLedger(forged))}),/RECORDING_COMMENT_LEDGER_MISMATCH/u);
 assert.throws(()=>planRecordingCommentSave({...input,recordingProofJson:JSON.stringify({...JSON.parse(proof),sessionId:'foreign session'})}),/RECORDING_COMMENT_PROOF_INVALID/u);
 assert.equal(JSON.stringify({base,recorded,state}),original);
});
test('recorded middle deletion preserves comment body and exact round Undo/Redo after restart',()=>{
 const base=doc('aaa'), state=add(base), next=plan('aaa',edit('middle',1,'a',''));
 const recorded=recording.derive(base,doc('aa'),meta,next).doc;
 const saved=save(base,base,recorded,state,plan('aaa'),next);
 assert.equal(JSON.parse(saved.afterText).threads[0].status,'deleted');
 assert.deepEqual(JSON.parse(saved.afterText).threads[0].messages,JSON.parse(state).threads[0].messages);
 const undone=decide(JSON.parse(JSON.stringify(recorded)),saved.afterText,'undo');
 assert.deepEqual(JSON.parse(undone.state).threads[0].anchor,JSON.parse(state).threads[0].anchor);
 assert.equal(JSON.parse(undone.state).threads[0].status,'open');
 const redone=decide(undone.doc,undone.state,'redo');assert.equal(JSON.parse(redone.state).threads[0].status,'deleted');
});
test('successive autosaves, later decision Undo and round Undo retain original anchor',()=>{
 const base=doc('A quote Z'),state=add(base,null,2,'quote');
 const first=plan('A quote Z',edit('left',0,'A','BBBB'));
 const a=recording.derive(base,doc('BBBB quote Z'),meta,first).doc;
 const saved=save(base,base,a,state,plan('A quote Z'),first);
 const next=plan('A quote Z',...first.edits,edit('right',11,'Z','YYYY'));
 const b=recording.derive(base,doc('BBBB quote YYYY'),meta,next).doc;
 const saved2=save(base,a,b,saved.afterText,first,next);
 const rejected=decide(b,saved2.afterText,'rejectAll');
 const undoDecision=decide(rejected.doc,rejected.state,'undo');
 const undoRound=decide(undoDecision.doc,undoDecision.state,'undo');
 assert.deepEqual(JSON.parse(undoRound.state).threads[0].anchor,JSON.parse(state).threads[0].anchor);
 const redoRound=decide(undoRound.doc,undoRound.state,'redo');
 assert.equal(JSON.parse(redoRound.state).threads[0].anchor.startUtf16,5);
});
test('forged ledger or missing provenance is rejected before a comment plan is admitted',()=>{
 const base=doc('aaa'),state=add(base), next=plan('aaa',edit('middle',1,'a',''));
 const wrong=recording.derive(base,doc('aa'),meta).doc;
 assert.throws(()=>save(base,base,wrong,state,plan('aaa'),next),/LEDGER_MISMATCH/);
 assert.throws(()=>save(base,base,wrong,state,plan('aaa'),plan('aaa')),/REPLAY_MISMATCH/);
});
test('comment added during recording gets a truthful baseline for later round Undo and Redo',()=>{
 const base=doc('abc'),state=add(base,null,1,'b');
 const first=plan('abc',edit('insert',1,'','XX'));const a=recording.derive(base,doc('aXXbc'),meta,first).doc;
 const saved=save(base,base,a,state,plan('abc'),first);
 const withNew=add(a,saved.afterText,1,'XX','new-root');
 const next=plan('abc',...first.edits,edit('end',5,'','!'));const b=recording.derive(base,doc('aXXbc!'),meta,next).doc;
 const saved2=save(base,a,b,withNew,first,next);
 const undone=decide(b,saved2.afterText,'undo');assert.equal(JSON.parse(undone.state).threads[1].status,'deleted');
 const redone=decide(undone.doc,undone.state,'redo');assert.equal(JSON.parse(redone.state).threads[1].status,'open');
 assert.equal(JSON.parse(redone.state).threads[1].anchor.selectedText,'XX');
});
test('editor Undo of a recorded deletion restores comment before stopping the session',()=>{
 const base=doc('aaa'),state=add(base),first=plan('aaa',edit('middle',1,'a',''));
 const a=recording.derive(base,doc('aa'),meta,first).doc;const saved=save(base,base,a,state,plan('aaa'),first);
 const next=plan('aaa',...first.edits,edit('undo',1,'','a','undo','middle'));
 const b=recording.derive(base,base,meta,next).doc;const saved2=save(base,a,b,saved.afterText,first,next);
 assert.equal(JSON.parse(saved2.afterText).threads[0].status,'open');
 assert.deepEqual(JSON.parse(saved2.afterText).threads[0].anchor,JSON.parse(state).threads[0].anchor);
});
test('manual tombstone stays deleted across recording round Undo',()=>{
 const base=doc('abc'),state=add(base,null,1,'b'),first=plan('abc',edit('first',0,'','!'));
 const a=recording.derive(base,doc('!abc'),meta,first).doc;const saved=save(base,base,a,state,plan('abc'),first);
 const manual=JSON.parse(saved.afterText);manual.threads[0].status='deleted';delete manual.threads[0].anchorEditHistory;
 const undone=decide(a,JSON.stringify(manual),'undo');assert.equal(JSON.parse(undone.state).threads[0].status,'deleted');
});

for (const insert of ['', 'XX']) test(`Word language round with ${insert ? 'text insertion' : 'only formatting'} restores exact rich source and anchors after restart`,()=>{
 const base=doc('hello tail'), marks=[{type:'textStyle',attrs:{wordLanguage:{val:'ru-RU'}}}];
 const incoming=review.bindLedger({schemaVersion:1,source:{type:'doc',content:[{type:'paragraph',content:[
  ...(insert?[{type:'text',text:insert}]:[]),{type:'text',text:'hello',marks},{type:'text',text:' tail'}]}]},
  revisions:[...(insert?[{id:'revision-1',nativeId:'1',operation:'insert',paragraphIndex:0,from:0,to:insert.length,state:'pending',groupId:null,author:'Word',date:'',dateUtc:''}]:[]),
  {id:'revision-2',nativeId:'2',operation:'format',paragraphIndex:0,from:insert.length,to:insert.length+5,state:'pending',groupId:null,author:'Word',date:'',dateUtc:'',format:{kind:'run',before:[],after:marks}}],undo:[],redo:[]});
 const returned=review.replaceFromReturn(base,incoming,{roundId:'language-round',artifactSha256:'a'.repeat(64)}).doc;
 const state=add(returned,null,insert.length+6,'tail'), original=JSON.parse(state).threads[0];
 const undone=decide(JSON.parse(JSON.stringify(returned)),state,'undo');
 assert.deepEqual(review.normalizeNode(undone.doc),base);
 assert.equal(JSON.parse(undone.state).threads[0].anchor.startUtf16,6);
 assert.deepEqual(JSON.parse(undone.state).threads[0].messages,original.messages);
 const redone=decide(JSON.parse(JSON.stringify(undone.doc)),undone.state,'redo');
 assert.deepEqual(review.normalizeNode(redone.doc),review.normalizeNode(returned));
 assert.deepEqual(JSON.parse(redone.state).threads[0].anchor,original.anchor);
 assert.deepEqual(review.readLedger(redone.doc).revisions,review.readLedger(returned).revisions);
 const forged=review.readLedger(returned);forged.revisions.find(r=>r.operation==='format').format.before=[{type:'bold'}];
 assert.throws(()=>decide(review.bindLedger(forged),state,'undo'),/RECORDING_COMMENT_ROUND_SOURCE_MISMATCH/);
});
