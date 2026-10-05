'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../../src/core/word-pending-text-revisions-v1.cjs');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
function ledger() {
  const change = (id, operation, from, to, groupId = null) => ({ id: 'revision-' + id, nativeId: '' + id, operation,
    author: 'Редактор <A>', date: '2026-09-28T10:00:00+03:00', dateUtc: '2026-09-28T07:00:00Z', groupId,
    paragraphIndex: 0, from, to, state: 'pending' });
  return { schemaVersion: 1, source: { type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'A староеновое B 🧭 C', marks: [{ type: 'bold' }] },
  ] }] }, revisions: [change(1, 'delete', 2, 8, 'group-1'), change(2, 'insert', 8, 13, 'group-1'), change(3, 'delete', 16, 18)], undo: [], redo: [] };
}
test('Original/Current preserve rich text, Unicode and durable pending state through envelope', () => {
  const doc = model.bindLedger(ledger());
  const p = model.projection(doc);
  assert.equal(p.original, 'A старое B 🧭 C'); assert.equal(p.current, 'A новое B  C');
  const persisted = envelope.composeObservablePayload({ doc });
  assert.deepEqual(envelope.parseObservablePayload(persisted).doc, envelope.canonicalizeDocumentJson(doc));
  assert.equal(model.readLedger(envelope.parseObservablePayload(persisted).doc).revisions.length, 3);
  assert.equal(p.revisions[0].author, 'Редактор <A>');
});
test('single replacement decision is atomic; undo redo and a new decision retain expected text', () => {
  const doc = model.bindLedger(ledger());
  const rejected = model.decide(doc, { action: 'reject', revisionId: 'revision-2' }).doc;
  assert.equal(model.projection(rejected).current, 'A старое B  C');
  assert.deepEqual(model.readLedger(rejected).revisions.map(r => r.state), ['rejected', 'rejected', 'pending']);
  assert.equal(model.decide(rejected, { action: 'reject', revisionId: 'revision-1' }).changed, false);
  assert.throws(() => model.decide(rejected, { action: 'accept', revisionId: 'revision-1' }), /ALREADY_DECIDED/);
  const undone = model.decide(rejected, { action: 'undo' }).doc;
  assert.equal(model.projection(undone).current, 'A новое B  C');
  const redone = model.decide(envelope.parseObservablePayload(envelope.composeObservablePayload({ doc: undone })).doc, { action: 'redo' }).doc;
  assert.equal(model.projection(redone).current, 'A старое B  C');
  const all = model.decide(undone, { action: 'rejectAll' }).doc;
  assert.equal(model.projection(all).current, model.projection(all).original);
  assert.equal(model.projection(all).canRedo, false);
});
test('acceptAll leaves Current and exports no pending wrappers; undo restores every pending state', () => {
  const doc = model.bindLedger(ledger()), accepted = model.decide(doc, { action: 'acceptAll' }).doc;
  assert.equal(model.projection(accepted).current, model.projection(doc).current);
  assert.ok(model.segments(model.readLedger(accepted), 0, 'export').every(s => !s.revision));
  assert.deepEqual(model.readLedger(model.decide(accepted, { action: 'undo' }).doc).revisions, ledger().revisions);
  assert.equal(model.decide(accepted, { action: 'acceptAll' }).changed, false);
});
test('tampered projection, split surrogate, overlaps, duplicate IDs and half replacement decisions reject', () => {
  const badDoc = model.bindLedger(ledger()); badDoc.content[0].content[0].text = 'forged';
  assert.throws(() => model.readLedger(badDoc), /PROJECTION_MISMATCH/);
  for (const mutate of [l => l.revisions[2].from++, l => l.revisions[2].from = 1,
    l => l.revisions[1].id = l.revisions[0].id, l => l.revisions[1].state = 'accepted',
    l => l.revisions[0].paragraphIndex = -1, l => l.source.content[0].content[0].marks = [{ type: 'link', attrs: { href: 'javascript:bad' } }],
    l => l.undo = [ ['pending'] ], l => l.revisions[0].authority = true,
    l => l.undo = Array(129).fill(['pending', 'pending', 'pending'])]) {
    const value = ledger(); mutate(value); assert.throws(() => model.bindLedger(value), /PENDING_REVISIONS/);
  }
});
test('editor run coalescing and null default attributes preserve checked semantics', () => {
  const doc = model.bindLedger(ledger());
  doc.content[0].attrs = { textAlign: null };
  doc.content[0].content = model.normalizeNode(doc.content[0]).content;
  assert.ok(model.readLedger(doc));
  doc.content[0].content[0].marks = [];
  assert.throws(() => model.readLedger(doc), /PROJECTION_MISMATCH/);
});

test('pending comment proof accepts only exact ordered wrapper partitions and three projections', () => {
  const original = ledger(), doc = model.bindLedger(original);
  const built = model.buildCommentExportBinding({document:doc});
  const returned = structuredClone(original);
  const r = returned.revisions[1];
  returned.revisions.splice(1,1,{...r,to:10,nativeId:'91'},{...r,id:'revision-99',from:10,nativeId:'92'});
  returned.revisions.forEach(r=>r.groupId=null);
  const value = model.bindLedger(returned);
  assert.equal(model.verifyCommentReturnBinding({document:doc,binding:built.binding,returnedDocument:value}).partitions[1].fragments.length,2);
  for (const mutate of [l=>l.revisions[2].author='forged',l=>l.revisions[2].from++,l=>l.source.content[0].content[0].text=l.source.content[0].content[0].text.replace('новое','иное!')]) {
    const bad=structuredClone(returned); mutate(bad);
    assert.throws(()=>model.verifyCommentReturnBinding({document:doc,binding:built.binding,returnedDocument:model.bindLedger(bad)}));
  }
  assert.equal(JSON.stringify(doc),JSON.stringify(model.bindLedger(original)));
});

test('pending mixed source preserves quote, code, list continuation, HTTP links, marked typed breaks and empty leaves',()=>{
  const l=ledger(), mark={type:'textStyle',attrs:{fontFamily:'Georgia',fontSize:'18pt',wordLanguage:{val:'en-US',eastAsia:'ja-JP',bidi:'ar-SA'}}};
  l.source.content.push({type:'blockquote',content:[{type:'paragraph',content:[{type:'text',text:'Quote',marks:[{type:'link',attrs:{href:'https://example.org/read'}}]}]}]},
    {type:'codeBlock',attrs:{language:'js'},content:[{type:'text',text:'code\nline'}]},
    {type:'orderedList',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Item'}]},{type:'paragraph',content:[{type:'hardBreak',attrs:{wordBreakType:'page'},marks:[mark]},{type:'text',text:'continued'},{type:'hardBreak',attrs:{wordBreakType:'column'},marks:[mark]}]}]}]},
    {type:'paragraph'});
  const copy=JSON.stringify(l),doc=model.bindLedger(l);
  assert.equal(model.paragraphs(model.materialize(model.readLedger(doc))).length,6);
  assert.deepEqual(model.readLedger(doc).source,l.source);assert.equal(JSON.stringify(l),copy);
  const built=model.buildCommentExportBinding({document:doc});
  assert.ok(model.verifyCommentReturnBinding({document:doc,binding:built.binding,returnedDocument:doc}));
  for(const mutate of [v=>v.source.content[1].attrs={unknown:true},v=>v.source.content[2].attrs.language={},
    v=>v.source.content[1].content[0].content[0].marks[0].attrs.href='javascript:bad',
    v=>v.source.content[3].content[0].content[1].content[0].marks[0].attrs.wordLanguage={val:'bad tag'},
    v=>v.source.content[3].content[0].content[1].content[0].attrs.wordBreakType='unknown',
    v=>v.source.content.push({type:'future-widget',content:[]})]) {
    const bad=structuredClone(l);mutate(bad);assert.throws(()=>model.bindLedger(bad));
  }
});

test('pending endpoint proof refuses hidden-deletion ambiguity and forged binding data',()=>{
  const doc=model.bindLedger(ledger()),{binding}=model.buildCommentExportBinding({document:doc});
  assert.deepEqual(model.mapCommentExportEndpoint({document:doc,binding,paragraphIndex:0,offsetUtf16:3,affinity:'right'}),{paragraphIndex:0,offsetUtf16:9});
  assert.throws(()=>model.mapCommentExportEndpoint({document:doc,binding,paragraphIndex:0,offsetUtf16:2,affinity:'right'}),/AMBIGUOUS/);
  const bad={...binding,extra:true};assert.throws(()=>model.verifyCommentReturnBinding({document:doc,binding:bad,returnedDocument:doc}),/BINDING_CHANGED/);
  let invoked=false;Object.defineProperty(bad,'extra',{enumerable:true,get(){invoked=true;return true;}});
  assert.throws(()=>model.verifyCommentReturnBinding({document:doc,binding:bad,returnedDocument:doc}),/DATA_INVALID/);assert.equal(invoked,false);
});


test('pending source retains validated section and disabled grid metadata',()=>{
  const l=ledger();l.source.attrs={wordSections:{schemaVersion:1,boundaries:[],final:{type:'nextPage',docGrid:{type:'default',linePitch:360}}}};
  const doc=model.bindLedger(l);assert.deepEqual(doc.attrs.wordSections,l.source.attrs.wordSections);
  const {binding}=model.buildCommentExportBinding({document:doc});
  assert.ok(model.verifyCommentReturnBinding({document:doc,binding,returnedDocument:doc}));
  for(const value of [{schemaVersion:1,boundaries:[],final:{extra:true}},{schemaVersion:1,boundaries:[],final:{docGrid:{type:'lines'}}}]) {
    const bad=structuredClone(l);bad.source.attrs.wordSections=value;assert.throws(()=>model.bindLedger(bad));
  }
});
