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
