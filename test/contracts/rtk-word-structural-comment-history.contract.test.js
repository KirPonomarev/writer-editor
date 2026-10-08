'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const envelope=require('../../src/core/document-content-envelope-v1.cjs');
const {planCommentAuthoring,readState}=require('../../src/core/word-comment-authoring-v1.cjs');
const {planCommentAnchorSave}=require('../../src/core/word-comment-anchor-save-v1.cjs');
const {replayEditIntents}=require('../../src/core/word-comment-edit-intents-v1.cjs');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const projectId='structural-project',sceneId='roman/scene.txt';
const content=texts=>envelope.composeObservablePayload({doc:{type:'doc',content:texts.map(text=>({type:'paragraph',content:text?[{type:'text',text}]:[]}))}});
function root(texts,anchor={paragraphIndex:0,startUtf16:1,selectedText:'lpha'}) {
 return planCommentAuthoring({beforeText:null,projectId,sceneId,sceneSha256:sha(content(texts)),paragraphs:texts,now:'2026-10-05T00:00:00Z',input:{requestId:'root',action:'create',projectId,sceneId,subjectId:'scene',expectedStateSha256:'',expectedSceneSha256:sha(content(texts)),body:'Exact retained discussion',anchor}}).afterText;
}
let serial=0;
function edit(f,from,t,to,removed,inserted,historyId='group',direction='forward') {return {id:'e'+(++serial),historyId,direction,fromParagraphIndex:f,fromUtf16:from,toParagraphIndex:t,toUtf16:to,removedParagraphs:removed,insertedParagraphs:inserted};}
function save(before,after,state,edits) {return planCommentAnchorSave({beforeText:state,projectId,sceneId,beforeContent:content(before),afterContent:content(after),sessionId:'session',editIntents:{schemaVersion:2,baselineTextSha256:sha(JSON.stringify(before)),edits}}).afterText;}
test('V2 distinguishes paragraph separators from hardBreak and rejects stale segments',()=>{
 const wire={schemaVersion:2,baselineTextSha256:sha(JSON.stringify(['Al\npha'])),edits:[edit(0,2,0,2,[''],['',''])]};
 assert.deepEqual(replayEditIntents(['Al\npha'],['Al','\npha'],wire).steps[0].afterParagraphs,['Al','\npha']);
 assert.throws(()=>replayEditIntents(['Al\npha'],['Al','pha'],wire),/REPLAY_MISMATCH/);
 const bad=structuredClone(wire);bad.edits[0].removedParagraphs=['X'];
 assert.throws(()=>replayEditIntents(['Al\npha'],['Al','\npha'],bad),/SPLICE_STALE/);
});
test('root Enter becomes multi range and saved Undo Redo restores exact graph body and coordinates',()=>{
 const before=['Alpha','Tail'],initial=root(before),split=['Al','pha','Tail'];
 const state=save(before,split,initial,[edit(0,2,0,2,[''],['',''])]);
 const a=readState(state,projectId).threads[0];assert.equal(a.anchor.kind,'multi-paragraph-range');assert.equal(a.anchor.selectedText,'l\npha');assert.equal(a.anchor.endSceneParagraphIndex,1);
 assert.equal(JSON.parse(state).schemaVersion,'yalken.rtk.word.non-text-return-state.v5');
 const undo=save(split,before,state,[edit(0,2,1,0,['',''],[''],'group','undo')]);
 assert.deepEqual(JSON.parse(undo).threads[0].anchor,JSON.parse(initial).threads[0].anchor);
 const redo=save(before,split,undo,[edit(0,2,0,2,[''],['',''],'group','redo')]);
 assert.deepEqual(JSON.parse(redo).threads[0],a);
 assert.deepEqual(a.messages,JSON.parse(initial).threads[0].messages);
});
test('legacy saved group survives earlier structural split and both saved Undos',()=>{
 const original=['Prefix','Alpha'],initial=root(original,{paragraphIndex:1,startUtf16:0,selectedText:'Alpha'}),typed=['Prefix','AlXpha'];
 const legacy=planCommentAnchorSave({beforeText:initial,projectId,sceneId,beforeContent:content(original),afterContent:content(typed),sessionId:'session',editIntents:{schemaVersion:1,baselineTextSha256:sha(JSON.stringify(original)),edits:[{id:'legacy',historyId:'legacy',direction:'forward',paragraphIndex:1,fromUtf16:2,toUtf16:2,removedText:'',insertText:'X'}]}}).afterText;
 const oldEntry=JSON.parse(legacy).threads[0].anchorEditHistory[0];
 const split=['Pre','fix','AlXpha'];const after=save(typed,split,legacy,[edit(0,3,0,3,[''],['',''],'split')]);
 assert.equal(JSON.parse(after).threads[0].anchor.sceneParagraphIndex,2);
 assert.deepEqual(JSON.parse(after).threads[0].anchorEditHistory[0],oldEntry);
 const undoSplit=save(split,typed,after,[edit(0,3,1,0,['',''],[''],'split','undo')]);
 const undoOld=save(typed,original,undoSplit,[edit(1,2,1,3,['X'],[''],'legacy','undo')]);
 assert.deepEqual(JSON.parse(undoOld).threads[0].anchor,JSON.parse(initial).threads[0].anchor);
});
test('structural deletion retains body, maps collapsed locator after earlier split and restores each history',()=>{
 const original=['Prefix','Alpha','Tail'],initial=root(original,{paragraphIndex:1,startUtf16:0,selectedText:'Alpha'});
 const deleted=['Prefix','','Tail'];let state=save(original,deleted,initial,[edit(1,0,1,5,['Alpha'],[''],'delete')]);
 const split=['Pre','fix','','Tail'];state=save(deleted,split,state,[edit(0,3,0,3,[''],['',''],'split')]);
 assert.equal(JSON.parse(state).threads[0].anchorEditHistory.at(-1).after.liveLocator.sceneParagraphIndex,2);
 state=save(split,deleted,state,[edit(0,3,1,0,['',''],[''],'split','undo')]);
 state=save(deleted,original,state,[edit(1,0,1,0,[''],['Alpha'],'delete','undo')]);
 assert.deepEqual(JSON.parse(state).threads[0].anchor,JSON.parse(initial).threads[0].anchor);
 assert.deepEqual(JSON.parse(state).threads[0].messages,JSON.parse(initial).threads[0].messages);
});
test('equal-count list cross-leaf replacement is refused without changing canonical bytes',()=>{
 const before=['Alpha','Beta'],after=['AlX','Yta'];const state=root(before);
 const list=texts=>envelope.composeObservablePayload({doc:{type:'doc',content:[{type:'orderedList',content:texts.map(text=>({type:'listItem',content:[{type:'paragraph',content:[{type:'text',text}]}]}))}]}});
 const args={beforeText:state,projectId,sceneId,beforeContent:list(before),afterContent:list(after),sessionId:'session',editIntents:{schemaVersion:2,baselineTextSha256:sha(JSON.stringify(before)),edits:[edit(0,2,1,2,['pha','Be'],['X','Y'])]}};
 assert.throws(()=>planCommentAnchorSave(args),/COMMENT_SAVE_STRUCTURE_UNSUPPORTED/);assert.equal(args.beforeText,state);
});
test('deleted separate typing group unwinds and redoes twice without losing its locator',()=>{
 const original=['Alpha'],initial=root(original,{paragraphIndex:0,startUtf16:0,selectedText:'Alpha'});
 const deleted=[''],typed=['X'];let state=save(original,deleted,initial,[edit(0,0,0,5,['Alpha'],[''],'delete')]);
 state=save(deleted,typed,state,[edit(0,0,0,0,[''],['X'],'typing')]);const final=JSON.parse(state).threads[0];
 state=save(typed,deleted,state,[edit(0,0,0,1,['X'],[''],'typing','undo')]);
 state=save(deleted,original,state,[edit(0,0,0,0,[''],['Alpha'],'delete','undo')]);
 assert.deepEqual(JSON.parse(state).threads[0].anchor,JSON.parse(initial).threads[0].anchor);
 state=save(original,deleted,state,[edit(0,0,0,5,['Alpha'],[''],'delete','redo')]);
 state=save(deleted,typed,state,[edit(0,0,0,0,[''],['X'],'typing','redo')]);assert.deepEqual(JSON.parse(state).threads[0],final);
});
test('legacy deleted saved group accepts exact V2 same-leaf Undo without fabricated locator',()=>{
 const original=['Alpha tail'],initial=root(original,{paragraphIndex:0,startUtf16:0,selectedText:'Alpha'}),deleted=[' tail'];
 const legacy=planCommentAnchorSave({beforeText:initial,projectId,sceneId,beforeContent:content(original),afterContent:content(deleted),sessionId:'session',editIntents:{schemaVersion:1,baselineTextSha256:sha(JSON.stringify(original)),edits:[{id:'old-delete',historyId:'old-delete',direction:'forward',paragraphIndex:0,fromUtf16:0,toUtf16:5,removedText:'Alpha',insertText:''}]}}).afterText;
 const restored=save(deleted,original,legacy,[edit(0,0,0,0,[''],['Alpha'],'old-delete','undo')]);
 assert.deepEqual(JSON.parse(restored).threads[0].anchor,JSON.parse(initial).threads[0].anchor);
 assert.equal(JSON.parse(restored).threads[0].anchorEditHistory[0].schemaVersion,undefined);
 assert.throws(()=>save(deleted,[' ','tail'],legacy,[edit(0,1,0,1,[''],['',''],'split')]),/COMMENT_EDIT_HISTORY_STALE/);
 assert.throws(()=>save(deleted,['Wrong tail'],legacy,[edit(0,0,0,0,[''],['Wrong'],'old-delete','undo')]),/COMMENT_EDIT_HISTORY_STALE/);
});
test('unknown Undo group cannot replace equal-length quote or revive manual tombstone',()=>{
 const old=['Alpha'],initial=root(old,{paragraphIndex:0,startUtf16:0,selectedText:'Alpha'}),changed=['AlXha'];
 const state=save(old,changed,initial,[edit(0,2,0,3,['p'],['X'],'known')]);
 assert.throws(()=>save(changed,old,state,[edit(0,2,0,3,['X'],['p'],'unknown','undo')]),/COMMENT_EDIT_HISTORY_EXPIRED/);
 const manual=JSON.parse(initial);manual.threads[0].status='deleted';const beforeText=JSON.stringify(manual);
 const out=planCommentAnchorSave({beforeText,projectId,sceneId,beforeContent:content(old),afterContent:content(changed),sessionId:'session',includeUnchanged:true,editIntents:{schemaVersion:2,baselineTextSha256:sha(JSON.stringify(old)),edits:[edit(0,2,0,3,['p'],['X'],'unknown','undo')]}});
 assert.equal(out.afterText,beforeText);
});
test('V2 checks original anchor scene and literal quote before replay or Undo',()=>{
 const before=['Alpha'],after=['AlXpha'],initial=root(before,{paragraphIndex:0,startUtf16:0,selectedText:'Alpha'});
 for(const mutate of [a=>a.sceneId='foreign-scene',a=>{a.selectedText='Wrong';a.selectedTextSha256=sha('Wrong');},a=>a.selectedTextSha256=sha('Wrong'),a=>a.blockTextSha256=sha('Wrong')]) {
  const graph=JSON.parse(initial);mutate(graph.threads[0].anchor);const raw=JSON.stringify(graph);
  assert.throws(()=>save(before,after,raw,[edit(0,2,0,2,[''],['X'])]),/COMMENT_(SAVE_)?ANCHOR_STALE/);
  assert.equal(JSON.stringify(graph),raw);
 }
 const deleted=JSON.parse(initial);deleted.threads[0].status='deleted';deleted.threads[0].anchor.sceneId='foreign-scene';
 assert.throws(()=>save(before,after,JSON.stringify(deleted),[edit(0,2,0,2,[''],['X'])]),/COMMENT_SAVE_ANCHOR_STALE/);
});

// Isolated caller observation delegates the real parser and freezes its actual
// JSON result. Counts exclude envelope/proof/internal pending validators.
function frozenCommentObserver() {
 const fs=require('node:fs'),path=require('node:path'),{Module,createRequire}=require('node:module');
 const file=require.resolve('../../src/core/word-comment-anchor-save-v1.cjs'),actual=createRequire(file),m=new Module(file);let calls=0;
 const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
 m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));
 m.require=id=>id==='./document-content-envelope-v1.cjs'?{...actual(id),parseObservablePayload(raw){calls++;return freeze(actual(id).parseObservablePayload(raw));}}:actual(id);
 m._compile(fs.readFileSync(file,'utf8'),file);return {core:m.exports,reset(){calls=0;},count:()=>calls,freeze};
}
function observationCommentDoc(n,first='Alpha 😀 tail') {
 const p=text=>({type:'paragraph',content:text?[{type:'text',text}]:[]});
 return {type:'doc',content:[p(first),p(''),{type:'paragraph',content:[{type:'text',text:'hard'},{type:'hardBreak'},{type:'text',text:'break'}]},
  ...Array.from({length:n-5},()=>p('repeat')),{type:'orderedList',attrs:{start:3},content:['List alpha','List beta'].map(text=>({type:'listItem',content:[p(text)]}))}]};
}
const observationCommentEncode=doc=>envelope.composeObservablePayload({doc});
const observationCommentTexts=doc=>require('../../src/core/word-comment-anchor-save-v1.cjs').paragraphs(observationCommentEncode(doc)).map(p=>p.text);
function observationCommentGraph(doc) {
 const state=JSON.parse(root(observationCommentTexts(doc),{paragraphIndex:0,startUtf16:0,selectedText:'Alpha'})),own=state.threads[0];
 own.messages.push({...structuredClone(own.messages[0]),commentId:'reply',kind:'reply',body:'Retained reply'});
 for(const [id,status] of [['foreign','resolved'],['manual','deleted']]) {const t=structuredClone(own);t.threadId=id;t.rootCommentId=id;t.status=status;t.messages=t.messages.map((m,i)=>({...m,commentId:id+i}));if(id==='foreign'){t.sceneId='roman/foreign.txt';t.anchor.sceneId=t.sceneId;}state.threads.push(t);}
 return JSON.stringify(state);
}
function observationCommentArgs(before,after,state,edits,extra={}) {
 return {beforeText:state,projectId,sceneId,beforeContent:observationCommentEncode(before),afterContent:observationCommentEncode(after),sessionId:'session',includeUnchanged:true,
  editIntents:{schemaVersion:2,baselineTextSha256:sha(JSON.stringify(observationCommentTexts(before))),edits},...extra};
}
test('frozen same-call comment observations preserve full discussion and saved structural history at 10/20/40 leaves',()=>{
 const h=frozenCommentObserver();
 for(const n of [10,20,40]) {
  let doc=observationCommentDoc(n),state=observationCommentGraph(doc);const initial=JSON.parse(state),normal=()=>observationCommentDoc(n);
  const split=normal();split.content.splice(0,1,...[{type:'paragraph',content:[{type:'text',text:'Al'}]},{type:'paragraph',content:[{type:'text',text:'pha 😀 tail'}]}]);
  const steps=[['insert',observationCommentDoc(n,'Al!pha 😀 tail'),edit(0,2,0,2,[''],['!'],'insert')],
   ['undo',normal(),edit(0,2,0,3,['!'],[''],'insert','undo')],['redo',observationCommentDoc(n,'Al!pha 😀 tail'),edit(0,2,0,2,[''],['!'],'insert','redo')],
   ['undo',normal(),edit(0,2,0,3,['!'],[''],'insert','undo')],['delete',observationCommentDoc(n,' 😀 tail'),edit(0,0,0,5,['Alpha'],[''],'delete')],
   ['undo',normal(),edit(0,0,0,0,[''],['Alpha'],'delete','undo')],['split',split,edit(0,2,0,2,[''],['',''],'split')],['undo',normal(),edit(0,2,1,0,['',''],[''],'split','undo')]];
  for(const [label,next,wire] of steps) {
   const args=h.freeze(observationCommentArgs(doc,next,state,[wire])),bytes=JSON.stringify(args);h.reset();const result=h.core.planCommentAnchorSave(args),graph=JSON.parse(result.afterText);
   assert.equal(JSON.stringify(args),bytes);assert.equal(result.beforeText,state);assert.deepEqual(graph.threads[0].messages,initial.threads[0].messages);
   assert.deepEqual(graph.threads.slice(1),initial.threads.slice(1));assert.equal(graph.threads[0].status,label==='delete'?'deleted':'open');
   if(label==='split'){assert.equal(graph.threads[0].anchor.kind,'multi-paragraph-range');assert.equal(graph.threads[0].anchor.selectedText,'Al\npha');}
   assert.equal(h.count(),2,'direct structural-planner parser calls only');state=result.afterText;doc=next;
  }
  assert.deepEqual(JSON.parse(state).threads[0].anchor,initial.threads[0].anchor);assert.ok(JSON.parse(state).threads[0].anchorEditHistory.length);
 }
});
test('fresh frozen comment observations retain numbered leaf identity and cross-leaf refusal',()=>{
 const h=frozenCommentObserver(),before=observationCommentDoc(10),state=observationCommentGraph(before),after=structuredClone(before);
 after.content.at(-1).content[0].content[0].content[0].text='List !alpha';
 const args=h.freeze(observationCommentArgs(before,after,state,[edit(8,5,8,5,[''],['!'],'list')]));h.reset();
 const result=h.core.planCommentAnchorSave(args),expected=JSON.parse(state);expected.revision++;assert.deepEqual(JSON.parse(result.afterText),expected);assert.equal(h.count(),2);
 const cross=structuredClone(before);cross.content.at(-1).content[0].content[0].content[0].text='List X';cross.content.at(-1).content[1].content[0].content[0].text='Ybeta';
 assert.throws(()=>h.core.planCommentAnchorSave(h.freeze(observationCommentArgs(before,cross,state,[edit(8,5,9,5,['alpha','List '],['X','Y'],'cross')]))),e=>e.code==='COMMENT_SAVE_STRUCTURE_UNSUPPORTED');
 const fresh=observationCommentArgs(before,observationCommentDoc(10,'Al!pha 😀 tail'),state,[edit(0,2,0,2,[''],['!'],'fresh')]);
 assert.equal(JSON.parse(h.core.planCommentAnchorSave(h.freeze(fresh)).afterText).threads[0].anchor.selectedText,'Al!pha');
 assert.throws(()=>h.core.planCommentAnchorSave({...fresh,afterContent:'[doc-v2 length=1]\n{\n[/doc-v2]'}),e=>e.code==='COMMENT_SAVE_SCENE_INVALID');
 assert.equal(args.beforeText,state);
});
test('comment observation reuse keeps bare-parse/session/paragraph error order and public paragraph admission',()=>{
 const h=frozenCommentObserver(),doc=observationCommentDoc(10),state=observationCommentGraph(doc),bad='[doc-v2 length=1]\n{\n[/doc-v2]';
 const args=observationCommentArgs(doc,observationCommentDoc(10,'Al!pha 😀 tail'),state,[edit(0,2,0,2,[''],['!'],'order')]);
 for(const [extra,code] of [[{beforeContent:bad},'COMMENT_SAVE_SCENE_INVALID'],[{afterContent:bad},'COMMENT_SAVE_SCENE_INVALID'],
  [{beforeContent:bad,afterContent:null},'COMMENT_SAVE_SCENE_INVALID'],[{beforeContent:bad,sessionId:'!'},'COMMENT_EDIT_SESSION_INVALID'],[{afterContent:null},'COMMENT_SAVE_SCENE_BUDGET']]) {
  const input=h.freeze({...args,...extra}),bytes=JSON.stringify(input);assert.throws(()=>h.core.planCommentAnchorSave(input),e=>e.name==='Error'&&e.code===code&&e.message===code);assert.equal(JSON.stringify(input),bytes);
 }
 assert.deepEqual(h.core.paragraphs('Alpha\n\nTail').map(x=>x.text),['Alpha','','Tail']);
 assert.deepEqual(h.core.paragraphs(observationCommentEncode(doc)).map(x=>x.text),observationCommentTexts(doc));
 for(const [input,code] of [[null,'COMMENT_SAVE_SCENE_BUDGET'],[bad,'COMMENT_SAVE_SCENE_INVALID']])assert.throws(()=>h.core.paragraphs(input),e=>e.code===code);
});
