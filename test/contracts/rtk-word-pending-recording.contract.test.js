'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const recording = require('../../src/core/word-pending-recording-v1.cjs');
const review = require('../../src/core/word-pending-text-revisions-v1.cjs');
const doc = (...paragraphs) => ({ type: 'doc', content: paragraphs.map(text => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] })) });
const meta = { author: 'Кирилл', date: '2026-09-28T07:00:00.000Z' };
test('imported rich ledger accepts exactly 16 MiB and rejects overflow without changing source or history', () => {
  const ledger={schemaVersion:2,source:doc('😀x'),revisions:[{id:'revision-1',nativeId:'owned',operation:'delete',author:'Editor',date:meta.date,dateUtc:meta.date,
    groupId:null,paragraphIndex:0,from:2,to:3,state:'pending'}],undo:[],redo:[['accepted']],roundUndo:[],roundRedo:[],returnReceipts:[]};
  ledger.source.content[0].content[0].marks=[{type:'bold'},{type:'textStyle',attrs:{fontFamily:'Georgia',fontSize:'14pt',wordLanguage:{val:'ru-RU',eastAsia:'ja-JP',bidi:'ar-SA'}}}];
  const limit=16*1024*1024,node=ledger.source.content[0].content[0];
  node.text+='x'.repeat(limit-Buffer.byteLength(JSON.stringify(ledger)));
  const original=JSON.stringify(ledger);assert.equal(Buffer.byteLength(original),limit);
  assert.deepEqual(review.validateLedger(ledger),ledger);
  const restored=review.readLedger(review.bindLedger(ledger));assert.deepEqual(restored,ledger);
  const overflow=JSON.parse(original);overflow.source.content[0].content[0].text+='x';
  assert.equal(Buffer.byteLength(JSON.stringify(overflow)),limit+1);
  assert.throws(()=>review.bindLedger(overflow),/PENDING_REVISIONS_BUDGET/u);
  const malformed=JSON.parse(original);malformed.source.content[0].attrs={foreign:true};
  malformed.source.content[0].content[0].text=malformed.source.content[0].content[0].text.slice(0,-100);
  assert.throws(()=>review.bindLedger(malformed),/PENDING_REVISIONS_INVALID/u);
  assert.equal(JSON.stringify(ledger),original);assert.deepEqual(restored.redo,[['accepted']]);
});
for (const [name, original, current, operations] of [
  ['insert', 'hello', 'hello world', ['insert']], ['delete', 'hello world', 'hello', ['delete']],
  ['replace', 'hello world', 'hello Word', ['delete', 'insert']], ['empty', '', 'Первый', ['insert']],
  ['erase', 'Первый', '', ['delete']], ['unicode', 'a😀b', 'a🦊b', ['delete', 'insert']],
]) test(`record ${name}; native review decisions and restart-safe session undo`, () => {
  const base = doc(original), result = recording.derive(base, doc(current), meta);
  const ledger = review.readLedger(JSON.parse(JSON.stringify(result.doc)));
  assert.equal(result.changed, true); assert.deepEqual(ledger.revisions.map(r => r.operation), operations);
  assert.ok(ledger.revisions.every(r => r.author === meta.author && r.dateUtc === meta.date));
  assert.equal(review.projection(result.doc).original, original); assert.equal(review.projection(result.doc).current, current);
  assert.equal(review.projection(review.decide(result.doc, { action: 'rejectAll' }).doc).current, original);
  assert.equal(review.projection(review.decide(result.doc, { action: 'acceptAll' }).doc).current, current);
  const undo = review.decide(result.doc, { action: 'undo' }).doc;
  assert.equal(review.projection(undo).current, original);
  assert.equal(review.projection(review.decide(undo, { action: 'redo' }).doc).current, current);
});
test('replacement is one decision group; independent paragraph deltas remain independent', () => {
  const result = recording.derive(doc('old', 'other'), doc('new', 'other!'), meta);
  const p = review.projection(result.doc);
  assert.equal(p.revisions.length, 3); assert.equal(p.revisions[0].groupId, p.revisions[1].groupId);
  const decided = review.decide(result.doc, { action: 'reject', revisionId: p.revisions[0].id });
  assert.equal(review.projection(decided.doc).current, 'old\nother!');
});
test('repeated autosave derives one frame and stable IDs; typing Undo restores exact original', () => {
  const base = doc('A'), first = recording.derive(base, doc('AB'), meta), second = recording.derive(base, doc('ABC'), meta);
  assert.equal(review.readLedger(first.doc).roundUndo.length, 1);
  assert.equal(review.readLedger(second.doc).roundUndo.length, 1);
  assert.equal(review.readLedger(first.doc).revisions[0].id, review.readLedger(second.doc).revisions[0].id);
  assert.deepEqual(recording.derive(base, doc('A'), meta), { changed: false, doc: base });
  assert.deepEqual(recording.derive(base, doc('ABC'), meta), second);
});
test('existing Word revisions retain IDs provenance and decision history outside the new span', () => {
  const old = recording.derive(doc('A B'), doc('A BC'), { ...meta, author: 'Word' }).doc;
  const next = recording.derive(old, doc('!A BC'), meta).doc;
  const ledger = review.readLedger(next), oldRevision = review.readLedger(old).revisions[0];
  assert.equal(ledger.revisions.length, 2);
  assert.deepEqual(ledger.revisions.find(r => r.id === oldRevision.id), { ...oldRevision, from: oldRevision.from + 1, to: oldRevision.to + 1 });
  assert.equal(ledger.roundUndo.length, 2);
  assert.deepEqual(review.readLedger(review.decide(next, { action: 'undo' }).doc).revisions, review.readLedger(old).revisions);
  assert.throws(() => recording.derive(old, doc('A BD'), meta), /EXISTING_REVISION_OVERLAP/);
});
test('format-only edits become reversible decisions; structure failures preserve working state', () => {
  const base = doc('abc'), formatted = doc('abc'); formatted.content[0].content[0].marks = [{ type: 'bold' }];
  const frozen = JSON.stringify({ base, formatted });
  const recorded = recording.derive(base, formatted, meta).doc;
  assert.equal(review.projection(recorded).revisions[0].operation, 'format');
  assert.deepEqual(review.normalizeNode(review.decide(recorded, { action: 'rejectAll' }).doc), review.normalizeNode(base));
  assert.deepEqual(review.normalizeNode(review.decide(recorded, { action: 'acceptAll' }).doc), review.normalizeNode(formatted));
  const linked = structuredClone(formatted); linked.content[0].content[0].marks = [{ type: 'link', attrs: { href: 'https://example.com' } }];
  const linkRecorded = recording.derive(base, linked, meta).doc;
  assert.equal(review.projection(linkRecorded).revisions[0].operation, 'format');
  assert.deepEqual(review.normalizeNode(review.decide(linkRecorded, { action: 'rejectAll' }).doc), review.normalizeNode(base));
  assert.deepEqual(review.normalizeNode(review.decide(linkRecorded, { action: 'acceptAll' }).doc), review.normalizeNode(linked));
  for (const href of ['javascript:alert(1)', 'file:///private/manuscript', '#unbound-bookmark']) {
    const unsupported = structuredClone(linked); unsupported.content[0].content[0].marks[0].attrs.href = href;
    assert.throws(() => recording.derive(base, unsupported, meta), /MARK_UNSUPPORTED/);
  }
  assert.equal(JSON.stringify({ base, formatted }), frozen);
  assert.throws(() => recording.derive(base, { type: 'doc', content: [{ type: 'bulletList', content: [{ type: 'listItem', content: doc('abc').content }] }] }, meta), /STRUCTURE_UNSUPPORTED/);
  assert.throws(() => recording.derive(base, { type: 'doc', content: [{ type: 'table', content: [] }] }, meta), /PENDING_REVISIONS/);
});
test('source rich runs, inserted rich text and independent formatting have separate reversible decisions', () => {
  const base = doc('abc'); base.content[0].content[0].marks = [{ type: 'bold' }];
  const working = structuredClone(base); working.content[0].content.push({ type: 'text', text: '!', marks: [{ type: 'italic' }] });
  const result = recording.derive(base, working, meta);
  assert.deepEqual(review.materialize(review.readLedger(result.doc)), working);
  working.content[0].content[0].marks = [{ type: 'underline' }];
  const mixed = recording.derive(base, working, meta).doc;
  assert.deepEqual(review.normalizeNode(mixed), review.normalizeNode(working));
  assert.deepEqual(review.readLedger(mixed).revisions.map(r => r.operation), ['format', 'insert']);
  const format = review.readLedger(mixed).revisions.find(r => r.operation === 'format');
  const rejected = review.decide(mixed, { action: 'reject', revisionId: format.id }).doc;
  assert.equal(review.projection(rejected).current, 'abc!');
  assert.deepEqual(rejected.content[0].content[0].marks, [{ type: 'bold' }]);
  assert.deepEqual(review.normalizeNode(review.decide(mixed, { action: 'rejectAll' }).doc), review.normalizeNode(base));
});
test('renderer cannot inject a ledger, author controls or unbounded history', () => {
  const base = doc('A'), result = recording.derive(base, doc('AB'), meta);
  assert.throws(() => recording.derive(base, result.doc, meta), /RENDERER_LEDGER_FORBIDDEN/);
  assert.throws(() => recording.derive(base, doc('AB'), { ...meta, author: '\u0000' }), /METADATA_INVALID/);
  assert.throws(() => recording.derive(base, doc('AB'), { ...meta, date: 'tomorrow' }), /METADATA_INVALID/);
  const ledger = review.readLedger(result.doc); ledger.roundUndo = Array.from({ length: 128 }, () => structuredClone(ledger.roundUndo[0]));
  assert.throws(() => recording.derive(review.bindLedger(ledger), doc('!AB'), meta), /HISTORY_BUDGET/);
});

test('native Tiptap typing and plain paste emit empty inherited color without changing rich truth', () => {
  const base = doc('Native text'); base.content[0].content[0].marks = [{ type: 'textStyle', attrs: { fontFamily: 'Aptos', fontSize: '12pt' } }];
  const working = structuredClone(base); working.attrs = { wordPendingRevisions: null }; working.content[0].attrs = { textAlign: null };
  working.content[0].content.unshift({ type: 'text', text: 'Recorded ', marks: [{ type: 'textStyle', attrs: { color: '', fontFamily: 'Aptos', fontSize: '12pt' } }] });
  const result = recording.derive(base, working, meta);
  assert.equal(review.projection(result.doc).current, 'Recorded Native text');
  assert.equal(review.projection(result.doc).original, 'Native text');
  assert.ok(!JSON.stringify(review.readLedger(result.doc).source).includes('"color":""'));
});
test('recording retains schema5 parent-child identities, round frames and bound note points',()=>{
 const source={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'added',marks:[{type:'bold'}]}]}]},common={nativeId:'native',author:'Word',date:'',dateUtc:'',paragraphIndex:0,from:0,to:5,state:'pending',groupId:null};
 const parent={...common,id:'revision-1',operation:'insert'},child={...common,id:'revision-2',operation:'format',parentRevisionId:'revision-1',format:{kind:'run',before:[],after:[{type:'bold'}]}};
 const initial=review.bindLedger({schemaVersion:5,source,revisions:[parent,child],undo:[],redo:[],roundUndo:[],roundRedo:[],returnReceipts:[]});
 assert.equal(review.readLedger(recording.prepare(initial).baseline).schemaVersion,5);
 const working=review.materialize(review.readLedger(initial));working.content[0].content.push({type:'text',text:'!'});
 const next=recording.derive(initial,working,meta).doc,ledger=review.readLedger(next);
 assert.equal(ledger.schemaVersion,5);assert.deepEqual(ledger.revisions.slice(0,2),[parent,child]);assert.equal(ledger.roundUndo.at(-1).schemaVersion,5);
 assert.deepEqual(review.readLedger(review.decide(next,{action:'undo'}).doc).revisions,[parent,child]);
 const notes={schemaVersion:5,source:doc('plain'),revisions:[],undo:[],redo:[],roundUndo:[],roundRedo:[],returnReceipts:[],noteSourcePoints:[{noteId:'note-one',paragraphIndex:0,offsetUtf16:0}]};
 const noteDoc=review.bindLedger(notes);assert.deepEqual(recording.prepare(noteDoc).baseline,noteDoc);assert.deepEqual(review.readLedger(noteDoc).noteSourcePoints,notes.noteSourcePoints);
});

test('Round decision anchor geometry accepts returned styles while rich Undo and message provenance stay exact',()=>{
 const env=require('../../src/core/document-content-envelope-v1.cjs'),rounds=require('../../src/core/word-pending-recording-comments-v1.cjs'),anchor=require('../../src/core/word-comment-authoring-v1.cjs');
 const sceneId='roman/a.txt',projectId='round-style',sha='a'.repeat(64),body='alpha';
 const styled=source=>{const copy=structuredClone(source);copy.content[0].attrs={wordParagraphSpacing:{after:160,line:278,lineRule:'auto'},wordParagraphMarkLanguage:{val:'ru-FI'}};
  for(const n of copy.content[0].content||[])n.marks=[...(n.marks||[]),{type:'textStyle',attrs:{fontFamily:'Calibri',fontSize:'14pt',wordLanguage:{val:'en-US'}}}];return copy;};
 const state=source=>JSON.stringify({schemaVersion:'yalken.rtk.word.non-text-return-state.v1',projectId,revision:0,events:[],threads:[{threadId:'root',rootCommentId:'root-message',sceneId,status:'open',
  anchor:anchor.exactAnchor({paragraphIndex:0,startUtf16:0,selectedText:body},sceneId,[review.projection(source).current]),messages:[{commentId:'root-message',kind:'root',body:'Unchanged comment',provenance:{author:'Reader'}}]}]});
 for(const styleOnly of [false,true]){
  const baseline=review.bindLedger({schemaVersion:2,source:doc(body),revisions:[],undo:[],redo:[],roundUndo:[],roundRedo:[],returnReceipts:[]});
  const candidate=styleOnly?baseline:recording.derive(doc(body),doc(body+'!'),meta).doc,ledger=review.readLedger(candidate);
  const returned=review.bindLedger({...ledger,source:styled(ledger.source),roundUndo:[],roundRedo:[]});
  const applied=review.replaceFromReturn(baseline,returned,{roundId:'style-'+styleOnly,artifactSha256:sha}).doc,beforeText=state(applied);
  const beforeContent=env.composeObservablePayload({doc:applied}),undone=review.decide(applied,{action:'undo'}).doc,afterContent=env.composeObservablePayload({doc:undone});
  const input={beforeText,projectId,sceneId,beforeContent,afterContent,decision:{action:'undo'}};
  const result=rounds.planRecordingRoundDecision(input,review.readLedger(applied),review.readLedger(undone));
  assert.deepEqual(review.roundFrame(review.readLedger(undone)),review.lastRoundFrame(review.readLedger(applied)));
  const redone=review.decide(undone,{action:'redo'}).doc;assert.deepEqual(redone,applied);
  const redo=rounds.planRecordingRoundDecision({...input,beforeText:result?.afterText||beforeText,beforeContent:afterContent,afterContent:beforeContent,decision:{action:'redo'}},review.readLedger(undone),review.readLedger(redone));
  assert.deepEqual(JSON.parse(redo?.afterText||result?.afterText||beforeText).threads.map(t=>t.messages),JSON.parse(beforeText).threads.map(t=>t.messages));
  for(const mutate of [
   source=>{source.content[0].attrs.textAlign='center';},
   source=>{source.content[0].content[0].marks.push({type:'bold'});},
   source=>{source.content[0].content[0].marks.find(m=>m.type==='textStyle').attrs.color='#ff0000';},
   source=>{source.content[0].type='heading';source.content[0].attrs.level=1;},
  ]){
   const forged=structuredClone(review.readLedger(applied));mutate(forged.source);
   const forgedDoc=review.bindLedger(forged),restored=review.decide(forgedDoc,{action:'undo'}).doc;
   assert.throws(()=>rounds.planRecordingRoundDecision({...input,beforeContent:env.composeObservablePayload({doc:forgedDoc}),afterContent:env.composeObservablePayload({doc:restored})},forged,review.readLedger(restored)),
    /RECORDING_COMMENT_ROUND_(?:SOURCE_MISMATCH|UNSUPPORTED)/u);
  }
 }
 const baseline=review.readLedger(review.bindLedger({schemaVersion:2,source:doc(body),revisions:[],undo:[],redo:[],roundUndo:[],roundRedo:[],returnReceipts:[]}));
 const noDelta={...structuredClone(baseline),roundUndo:[review.roundFrame(baseline)]};
 assert.throws(()=>rounds.planRecordingRoundDecision({decision:{action:'undo'},beforeContent:env.composeObservablePayload({doc:review.bindLedger(noDelta)}),afterContent:env.composeObservablePayload({doc:review.bindLedger(baseline)})},noDelta,baseline),/RECORDING_COMMENT_ROUND_UNSUPPORTED/u);
 const old=recording.derive(doc(body),doc(body+'!'),meta).doc,next=recording.derive(old,doc(body+'! tail'),meta).doc,forged=review.readLedger(next);
 forged.source=styled(forged.source);forged.revisions[0].author='Forged prior event';
 const forgedDoc=review.bindLedger(forged),restored=review.decide(forgedDoc,{action:'undo'}).doc;
 assert.throws(()=>rounds.planRecordingRoundDecision({beforeText:state(forgedDoc),projectId,sceneId,decision:{action:'undo'},beforeContent:env.composeObservablePayload({doc:forgedDoc}),afterContent:env.composeObservablePayload({doc:restored})},forged,review.readLedger(restored)),/RECORDING_COMMENT_ROUND_SOURCE_MISMATCH/u);
});
test('Round decision retains exact prior format meaning and provenance across a common returned style underlay',()=>{
 const env=require('../../src/core/document-content-envelope-v1.cjs'),rounds=require('../../src/core/word-pending-recording-comments-v1.cjs'),anchor=require('../../src/core/word-comment-authoring-v1.cjs');
 const projectId='retained-format-underlay',sceneId='roman/a.txt',body='alpha',style={type:'textStyle',attrs:{fontFamily:'Calibri',fontSize:'14pt',wordLanguage:{val:'en-GB'}}};
 for(const kind of ['run','paragraph']){
  const old=doc(body),formatted=doc(body);
  if(kind==='run')formatted.content[0].content[0].marks=[{type:'bold'}];else formatted.content[0].attrs={textAlign:'center'};
  const baseline=recording.derive(old,formatted,meta).doc,next=structuredClone(formatted);next.content[0].content[0].text+='!';
  const returned=structuredClone(review.readLedger(recording.derive(baseline,next,meta).doc));
  for(const p of returned.source.content){p.attrs={...p.attrs,wordParagraphSpacing:{after:160,line:278,lineRule:'auto'},wordParagraphMarkLanguage:{val:'ru-FI'}};for(const n of p.content||[])n.marks=[...(n.marks||[]),structuredClone(style)];}
  const prior=returned.revisions.find(r=>r.operation==='format');
  for(const side of ['before','after'])if(kind==='run')prior.format[side].push(structuredClone(style));else prior.format[side].attrs={...prior.format[side].attrs,wordParagraphSpacing:{after:160,line:278,lineRule:'auto'},wordParagraphMarkLanguage:{val:'ru-FI'}};
  const applied=review.replaceFromReturn(baseline,review.bindLedger(returned),{roundId:'underlay-'+kind,artifactSha256:'a'.repeat(64)}).doc;
  const beforeText=JSON.stringify({schemaVersion:'yalken.rtk.word.non-text-return-state.v1',projectId,revision:0,events:[],threads:[{threadId:'root',rootCommentId:'root-message',sceneId,status:'open',anchor:anchor.exactAnchor({paragraphIndex:0,startUtf16:0,selectedText:body},sceneId,[review.projection(applied).current]),messages:[{commentId:'root-message',kind:'root',body:'Retained discussion',provenance:{author:'Reader'}}]}]});
  const execute=candidate=>{const undone=review.decide(candidate,{action:'undo'}).doc;return rounds.planRecordingRoundDecision({beforeText,projectId,sceneId,beforeContent:env.composeObservablePayload({doc:candidate}),afterContent:env.composeObservablePayload({doc:undone}),decision:{action:'undo'}},review.readLedger(candidate),review.readLedger(undone));};
  const result=execute(applied),undone=review.decide(applied,{action:'undo'}).doc;assert.deepEqual(review.roundFrame(review.readLedger(undone)),review.roundFrame(review.readLedger(baseline)));
  const redone=review.decide(undone,{action:'redo'}).doc;assert.deepEqual(redone,applied);
  const redo=rounds.planRecordingRoundDecision({beforeText:result?.afterText||beforeText,projectId,sceneId,beforeContent:env.composeObservablePayload({doc:undone}),afterContent:env.composeObservablePayload({doc:redone}),decision:{action:'redo'}},review.readLedger(undone),review.readLedger(redone));
  assert.deepEqual(JSON.parse(redo?.afterText||result?.afterText||beforeText).threads.map(t=>({anchor:t.anchor,messages:t.messages,status:t.status})),JSON.parse(beforeText).threads.map(t=>({anchor:t.anchor,messages:t.messages,status:t.status})));
  for(const mutate of [r=>{r.author='Forged';},r=>{r.nativeId='forged-native';},r=>{r.date='2026-09-29T07:00:00.000Z';r.dateUtc=r.date;},r=>{r.state='accepted';},r=>{r.id='revision-999';},r=>{if(kind==='run')r.format.before.push({type:'italic'});else r.format.before.attrs={...r.format.before.attrs,textAlign:'right'};}]){
   const forged=structuredClone(review.readLedger(applied));mutate(forged.revisions.find(r=>r.operation==='format'));
   assert.throws(()=>execute(review.bindLedger(forged)),/RECORDING_COMMENT_ROUND_SOURCE_MISMATCH/u);
  }
 }
});
