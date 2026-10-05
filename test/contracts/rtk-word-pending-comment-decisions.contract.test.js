'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const review = require('../../src/core/word-pending-text-revisions-v1.cjs');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const authoring = require('../../src/core/word-comment-authoring-v1.cjs');
const { planPendingCommentDecision } = require('../../src/core/word-pending-comment-decisions-v1.cjs');
const { sha256UpdateCompatible: sha } = require('../../src/core/browser-safe-hash.cjs');
const projectId = 'pending-comments', sceneId = 'roman/a.txt';
const encode = doc => envelope.composeObservablePayload({ doc });
const p = text => ({ type: 'paragraph', content: [{ type: 'text', text }] });
function document(text = 'oldnew tail', revisions) {
  return review.bindLedger({ schemaVersion: 1, source: { type: 'doc', content: [p(text)] },
    revisions: (revisions || [['delete', 0, 3], ['insert', 3, 6]]).map(([operation, from, to], i) => ({
      id: 'revision-' + (i + 1), nativeId: '' + i, operation, from, to, paragraphIndex: 0,
      author: 'Word reviewer', date: '', dateUtc: '', state: 'pending', groupId: revisions ? null : 'group-1' })), undo: [], redo: [] });
}
function add(doc, beforeText = null, anchor = { paragraphIndex: 0, startUtf16: 0, selectedText: 'new' }, requestId = 'root-1') {
  const current = review.paragraphs(review.normalizeNode(doc)).map(row => (row.content || []).map(n => n.text || '\n').join(''));
  return authoring.planCommentAuthoring({ beforeText, projectId, sceneId, paragraphs: current,
    sceneSha256: sha(encode(doc)), now: '2026-10-05T00:00:00Z', input: { action: 'create', requestId,
      projectId, sceneId, subjectId: 'test', expectedStateSha256: beforeText === null ? '' : sha(beforeText),
      expectedSceneSha256: sha(encode(doc)), body: 'Keep body and provenance', anchor } }).afterText;
}
function decide(doc, state, decision) {
  const after = review.decide(doc, decision).doc;
  const plan = planPendingCommentDecision({ beforeText: state, projectId, sceneId,
    beforeContent: encode(doc), afterContent: encode(after), decision });
  return { doc: JSON.parse(JSON.stringify(after)), state: plan.afterText, plan };
}
test('selected rejection, saved restart Undo/Redo and all decisions preserve exact comment identity', () => {
  const doc = document(), state = add(doc), original = JSON.parse(state).threads[0];
  const rejected = decide(doc, state, { action: 'reject', revisionId: 'revision-1' });
  assert.equal(review.projection(rejected.doc).current, 'old tail');
  assert.equal(JSON.parse(rejected.state).threads[0].status, 'deleted');
  assert.deepEqual(JSON.parse(rejected.state).threads[0].messages, original.messages);
  const undone = decide(rejected.doc, rejected.state, { action: 'undo' });
  assert.deepEqual(JSON.parse(undone.state).threads[0].anchor, original.anchor);
  assert.equal(JSON.parse(undone.state).threads[0].status, 'open');
  const redone = decide(undone.doc, undone.state, { action: 'redo' });
  assert.equal(JSON.parse(redone.state).threads[0].status, 'deleted');
  const accepted = decide(doc, state, { action: 'acceptAll' });
  assert.equal(accepted.state, state, 'accepting current view never rewrites comments');
  assert.equal(decide(accepted.doc, accepted.state, { action: 'undo' }).state, state);
  assert.equal(JSON.parse(decide(doc, state, { action: 'rejectAll' }).state).threads[0].status, 'deleted');
});
test('repeated text uses exact insertion occurrence and restores both consumed and shifted anchors', () => {
  const doc = document('aaa', [['insert', 1, 2]]);
  let state = add(doc, null, { paragraphIndex: 0, startUtf16: 1, selectedText: 'a' });
  state = add(doc, state, { paragraphIndex: 0, startUtf16: 2, selectedText: 'a' }, 'root-2');
  const result = decide(doc, state, { action: 'rejectAll' }), rows = JSON.parse(result.state).threads;
  assert.equal(rows[0].status, 'deleted'); assert.equal(rows[1].status, 'open');
  assert.equal(rows[1].anchor.startUtf16, 1);
  const undo = JSON.parse(decide(result.doc, result.state, { action: 'undo' }).state);
  assert.deepEqual(undo.threads.map(t => t.anchor), JSON.parse(state).threads.map(t => t.anchor));
});
test('a new root after rejection survives the first inverse history and subsequent Redo', () => {
  const doc = document(), rejected = decide(doc, add(doc), { action: 'rejectAll' });
  rejected.state = add(rejected.doc, rejected.state, { paragraphIndex: 0, startUtf16: 0, selectedText: 'old' }, 'later-root');
  const original = JSON.parse(rejected.state).threads[1];
  const undone = decide(rejected.doc, rejected.state, { action: 'undo' });
  assert.equal(JSON.parse(undone.state).threads[1].status, 'deleted');
  const redone = decide(undone.doc, undone.state, { action: 'redo' });
  assert.equal(JSON.parse(redone.state).threads[1].status, 'open');
  assert.deepEqual(JSON.parse(redone.state).threads[1].anchor, original.anchor);
  assert.deepEqual(JSON.parse(redone.state).threads[1].messages, original.messages);
});
test('manual tombstones never revive and sibling threads remain unchanged', () => {
  const doc = document(), state = JSON.parse(add(doc)); state.threads[0].status = 'deleted';
  const sibling = structuredClone(state.threads[0]); sibling.sceneId = 'roman/other.txt';
  sibling.threadId = 'sibling'; sibling.anchor.sceneId = sibling.sceneId; state.threads.push(sibling);
  const result = decide(doc, JSON.stringify(state), { action: 'rejectAll' });
  const undone = decide(result.doc, result.state, { action: 'undo' });
  assert.deepEqual(JSON.parse(undone.state).threads, state.threads);
});
test('forged scene delta, stale anchor and unknown decision refuse instead of publishing a comment graph', () => {
  const doc = document(), state = add(doc), after = review.decide(doc, { action: 'rejectAll' }).doc;
  const args = { beforeText: state, projectId, sceneId, beforeContent: encode(doc), afterContent: encode(after), decision: { action: 'rejectAll' } };
  assert.throws(() => planPendingCommentDecision({ ...args, afterContent: encode(doc) }), /TARGET_MISMATCH/);
  assert.throws(() => planPendingCommentDecision({ ...args, decision: { action: 'discard' } }));
  const stale = JSON.parse(state); stale.threads[0].anchor.blockTextSha256 = sha('wrong');
  assert.throws(() => planPendingCommentDecision({ ...args, beforeText: JSON.stringify(stale) }), /ANCHOR/);
  assert.throws(() => planPendingCommentDecision({ ...args, projectId: 'foreign' }), /STATE_INVALID/);
});

for(const kind of ['point','multi-paragraph-range'])test(`resolved ${kind} restores exact anchors through saved decision Undo and Redo`,()=>{
  const ledger=review.readLedger(document());ledger.source.content.push(p('Second paragraph'));
  const doc=review.bindLedger(ledger);
  const anchor=kind==='point'?{kind,paragraphIndex:0,startUtf16:1,selectedText:'',affinity:'right'}
    :{kind,paragraphIndex:0,startUtf16:1,endParagraphIndex:1,endUtf16:6,selectedText:'ew tail\nSecond'};
  const state=JSON.parse(add(doc,null,anchor));state.threads[0].status='resolved';
  const saved=JSON.stringify(state),original=state.threads[0];
  const rejected=decide(doc,saved,{action:'rejectAll'});
  const undone=decide(rejected.doc,rejected.state,{action:'undo'}),restored=JSON.parse(undone.state).threads[0];
  assert.deepEqual(restored.anchor,original.anchor);assert.equal(restored.status,'resolved');assert.deepEqual(restored.messages,original.messages);
  const redone=decide(undone.doc,undone.state,{action:'redo'});
  assert.deepEqual(JSON.parse(redone.state).threads[0].anchor,JSON.parse(rejected.state).threads[0].anchor);
  assert.equal(JSON.parse(redone.state).threads[0].status,JSON.parse(rejected.state).threads[0].status);
});

test('independent inline decisions Undo in reverse order preserve multiple exact occurrences',()=>{
  const doc=document('oldnew tail',[['delete',0,3],['insert',3,6]]),state=add(doc);
  const first=decide(doc,state,{action:'reject',revisionId:'revision-1'});
  assert.equal(review.projection(first.doc).current,'oldnew tail');
  assert.equal(JSON.parse(first.state).threads[0].anchor.startUtf16,3);
  const second=decide(first.doc,first.state,{action:'reject',revisionId:'revision-2'});
  assert.equal(JSON.parse(second.state).threads[0].status,'deleted');
  const undoSecond=decide(second.doc,second.state,{action:'undo'});
  assert.deepEqual(JSON.parse(undoSecond.state).threads[0].anchor,JSON.parse(first.state).threads[0].anchor);
  const undoFirst=decide(undoSecond.doc,undoSecond.state,{action:'undo'});
  assert.deepEqual(JSON.parse(undoFirst.state).threads[0].anchor,JSON.parse(state).threads[0].anchor);
});

test('signed transport v2 pins missing run properties and native timestamp precision without changing local truth',()=>{
 const p=require('../../src/core/word-pending-text-revisions-v1.cjs');
 const source={type:'doc',content:[{type:'paragraph',attrs:{wordParagraphMarkLanguage:{val:'ru-FI'}},content:[{type:'text',text:'ab'},{type:'hardBreak',marks:[{type:'italic'}]},{type:'text',text:'c'}]}]};
 const revision={id:'revision-1',nativeId:'1',operation:'insert',from:1,to:2,paragraphIndex:0,author:'Editor',date:'2026-10-05T07:12:02.240Z',dateUtc:'2026-10-05T07:12:02.240Z',groupId:null,state:'pending'};
 const document=p.bindLedger({schemaVersion:1,source,revisions:[revision],undo:[],redo:[]}),before=JSON.stringify(document),typography={schemaVersion:'yalken.review-docx.typography-defaults.v1',fontSize:'12pt'};
 const {binding,projection}=p.buildCommentExportBinding({schemaVersion:2,document,exportTypography:typography});
 const rows=projection.segments[0],returnedSource=structuredClone(source);returnedSource.content[0].content=rows.map(s=>s.node);
 const returned=p.bindLedger({schemaVersion:1,source:returnedSource,revisions:[{...revision,date:'2026-10-05T07:12:00Z',dateUtc:'2026-10-05T07:12:02Z'}],undo:[],redo:[]});
 assert.equal(p.verifyCommentReturnBinding({document,binding,returnedDocument:returned,exportTypography:typography}).partitions.length,1);
 assert.equal(JSON.stringify(document),before);
 const breakStyle=rows.find(s=>s.node.type==='hardBreak').node.marks.find(m=>m.type==='textStyle').attrs;
 assert.equal(breakStyle.fontFamily,'Times New Roman');assert.deepEqual(breakStyle.wordLanguage,{val:'ru-FI',eastAsia:'en-US',bidi:'en-US'});
 for(const mutation of ['font','language','time','author']) {
  const l=structuredClone(p.readLedger(returned));
  if(mutation==='font')l.source.content[0].content.find(n=>n.type==='hardBreak').marks.find(m=>m.type==='textStyle').attrs.fontFamily='Georgia';
  if(mutation==='language')l.source.content[0].content.find(n=>n.type==='hardBreak').marks.find(m=>m.type==='textStyle').attrs.wordLanguage.val='fr-FR';
  if(mutation==='time')l.revisions[0].dateUtc='2026-10-05T07:12:03Z';
  if(mutation==='author')l.revisions[0].author='Other';
  assert.throws(()=>p.verifyCommentReturnBinding({document,binding,returnedDocument:p.bindLedger(l),exportTypography:typography}),/PENDING_COMMENT_(PROJECTION|PARTITION)_CHANGED/);
 }
 const legacy=p.buildCommentExportBinding({document,exportTypography:typography}).binding;
 assert.equal(legacy.schemaVersion,1);assert.throws(()=>p.verifyCommentReturnBinding({document,binding:legacy,returnedDocument:returned,exportTypography:typography}),/PENDING_COMMENT_PROJECTION_CHANGED/);
});
