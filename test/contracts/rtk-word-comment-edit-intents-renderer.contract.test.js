'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const wireHash = wire => require('node:crypto').createHash('sha256').update(wire).digest('hex');
const checkpoint = (ui,editor) => ui.checkpointCommentEditIntents(editor,wireHash(ui.getCommentEditIntentsJson(editor)));
const p = text => ({type:'paragraph',...(text ? {content:[{type:'text',text}]} : {})});
async function harness(content, extraExtensions = []) {
  const [{Editor},{default:StarterKit},ui] = await Promise.all([import('@tiptap/core'),import('@tiptap/starter-kit'),import('../../src/renderer/tiptap/documentCommentEditIntents.mjs')]);
  const editor = new Editor({element:null,extensions:[StarterKit.configure({trailingNode:false}),ui.DocumentCommentEditIntents,...extraExtensions],content:{type:'doc',content}});
  editor.view.updateState(editor.state.reconfigure({plugins:editor.extensionManager.plugins}));
  Object.defineProperty(editor,'isDestroyed',{get:()=>false});
  return {editor,ui,wire:()=>JSON.parse(ui.getCommentEditIntentsJson(editor))};
}
test('real typing captures exact splices and actual merged history group across Undo, checkpoint and Redo',async()=>{
  const {editor,ui,wire}=await harness([p('Alpha Alpha')]);
  try {
    editor.commands.setTextSelection(3);editor.commands.insertContent({type:'text',text:'X'});
    editor.commands.insertContent({type:'text',text:'Y'});
    const forward=wire();assert.ok(forward);assert.equal(forward.edits.length,2);
    assert.equal(forward.edits[0].historyId,forward.edits[1].historyId);
    assert.deepEqual(forward.edits.map(({fromUtf16,insertText})=>({fromUtf16,insertText})),[{fromUtf16:2,insertText:'X'},{fromUtf16:3,insertText:'Y'}]);
    assert.equal(editor.commands.undo(),true);
    const undo=wire().edits.at(-1);assert.equal(undo.direction,'undo');assert.equal(undo.historyId,forward.edits[0].historyId);
    assert.equal(undo.removedText,'XY');assert.equal(undo.insertText,'');
    checkpoint(ui,editor);assert.equal(wire().edits.length,0);
    assert.equal(editor.commands.redo(),true);
    assert.equal(wire().edits[0].direction,'redo');assert.equal(wire().edits[0].historyId,undo.historyId);
    assert.equal(editor.getText(),'AlXYpha Alpha');
  } finally {editor.destroy();}
});
test('collapsed empty paragraph and repeated text selection preserve actual paragraph occurrence',async()=>{
  const {editor,ui}=await harness([p('same'),p(''),p('same')]);
  try {
    editor.commands.setTextSelection(7);
    assert.deepEqual(ui.commentSelectionIntent(editor),{paragraphIndex:1,startUtf16:0,selectedText:'',kind:'point',affinity:'right'});
    editor.commands.setTextSelection({from:9,to:13});
    assert.deepEqual(ui.commentSelectionIntent(editor),{paragraphIndex:2,startUtf16:0,selectedText:'same'});
  } finally {editor.destroy();}
});
test('unsupported paragraph split invalidates proof and checked scene replacement resets it',async()=>{
  const {editor,ui,wire}=await harness([p('Alpha')]);
  try {
    editor.commands.setTextSelection(3);assert.equal(editor.commands.splitBlock(),true);
    assert.equal(ui.getCommentEditIntentsJson(editor),null);
    editor.view.dispatch(editor.state.tr.replaceWith(0,editor.state.doc.content.size,editor.schema.nodeFromJSON(p('Beta')))
      .setMeta('wordPendingRevisionsExternal',true).setMeta('addToHistory',false));
    assert.equal(wire().edits.length,0);assert.equal(editor.getText(),'Beta');
  } finally {editor.destroy();}
});
test('actual continuation and table cell edits replay through Core without confusing repeated paragraphs',async()=>{
  const {DocumentTables}=await import('../../src/renderer/tiptap/documentTables.mjs');
  const core=require('../../src/core/word-comment-edit-intents-v1.cjs');
  const content=[{type:'orderedList',content:[{type:'listItem',content:[p('same'),p('same')]}]},
    {type:'table',content:[{type:'tableRow',content:[{type:'tableCell',content:[p('same')]},{type:'tableCell',content:[p('same')]}]}]}];
  const {editor,ui,wire}=await harness(content,[DocumentTables]);
  try {
    const positions=[];editor.state.doc.descendants((node,pos)=>{if(node.type.name==='paragraph')positions.push(pos+1);});
    editor.commands.setTextSelection(positions[1]+2);editor.commands.insertContent({type:'text',text:'X'});
    const shifted=[];editor.state.doc.descendants((node,pos)=>{if(node.type.name==='paragraph')shifted.push(pos+1);});
    editor.commands.setTextSelection(shifted[3]+2);editor.commands.insertContent({type:'text',text:'Y'});
    const current=[];editor.state.doc.descendants(node=>{if(node.type.name==='paragraph')current.push(node.textContent);});
    assert.deepEqual(current,['same','saXme','same','saYme']);
    assert.deepEqual(wire().edits.map(e=>e.paragraphIndex),[1,3]);
    assert.equal(core.replayEditIntents(['same','same','same','same'],current,ui.getCommentEditIntentsJson(editor)).steps.length,2);
    const expected=editor.getJSON();assert.equal(editor.commands.undo(),true);assert.equal(editor.commands.redo(),true);
    assert.deepEqual(editor.getJSON(),expected);
    assert.equal(core.replayEditIntents(['same','same','same','same'],current,ui.getCommentEditIntentsJson(editor)).steps.length,4);
  } finally {editor.destroy();}
});
test('mark-only changes create no splice; every checked load gets fresh history identities',async()=>{
  const {editor,wire}=await harness([p('Alpha')]);
  try {
    editor.commands.setTextSelection({from:1,to:4});editor.commands.toggleBold();assert.deepEqual(wire().edits,[]);
    editor.commands.setTextSelection(3);editor.commands.insertContent({type:'text',text:'X'});
    const first=wire().edits[0];
    editor.view.dispatch(editor.state.tr.replaceWith(0,editor.state.doc.content.size,editor.schema.nodeFromJSON(p('Alpha')))
      .setMeta('wordPendingRevisionsExternal',true).setMeta('addToHistory',false));
    editor.commands.setTextSelection(3);editor.commands.insertContent({type:'text',text:'Y'});
    assert.notEqual(wire().edits[0].historyId,first.historyId);assert.notEqual(wire().edits[0].id,first.id);
  } finally {editor.destroy();}
});
test('oversized real paste leaves author text intact but never emits a truncated proof',async()=>{
  const {editor,ui}=await harness([p('Alpha')]);
  try {
    editor.commands.setTextSelection(3);editor.commands.insertContent({type:'text',text:'Я'.repeat(34000)});
    assert.equal(editor.state.doc.textContent.length,34005);assert.equal(ui.getCommentEditIntentsJson(editor),null);
    assert.equal(editor.commands.undo(),true);assert.equal(editor.state.doc.textContent,'Alpha');
  } finally {editor.destroy();}
});
test('snapshot bridge carries the live bounded ledger and forwards only SAVED receipts without clearing newer dirty text',()=>{
  const fs=require('node:fs'),vm=require('node:vm');
  const source=fs.readFileSync(require('node:path').join(__dirname,'../../src/renderer/editor.js'),'utf8');
  const start=source.indexOf('function composeEditorSnapshot()'),end=source.indexOf('\n}',start)+2;
  const ackStart=source.indexOf('window.electronAPI.onSetDirty((message) => {'),ackEnd=source.indexOf('\n  });',ackStart)+6;
  let callback, checkpoints=0;
  const context={currentProjectId:'p',currentDocumentId:'s',currentTreeContentPublicationId:null,isTiptapMode:true,localEditGeneration:4,localDirty:true,lastAckedGeneration:0,
    wordCommentDraft:null,wordCommentBusy:false,manuscriptDrafts:new Map(),notesMutationPending:false,storyDrafts:new Map(),storyMutationPending:false,pendingStoryRequestId:null,
    composeDocumentContent:()=>'',getPlainText:()=>'',getActiveBookProfile:()=>null,getSelectionOffsets:()=>({start:0,end:0}),
    getTiptapImageInsertionPosition:()=>null,getTiptapRootSplitBoundary:()=>null,getTiptapCommentEditIntentsJson:()=>'{"proof":"live"}',
    checkpointTiptapCommentEditIntents:receipt=>{if(receipt==='a'.repeat(64))checkpoints++;},updateSaveStateText(){},refreshManuscriptNoteReferences(){},refreshVisibleCommentProjection(){},updateInspectorSnapshot(){},
    window:{electronAPI:{onSetDirty(fn){callback=fn;}}}};
  vm.createContext(context);vm.runInContext(source.slice(start,end)+'\n'+source.slice(ackStart,ackEnd),context);
  assert.equal(vm.runInContext('composeEditorSnapshot().commentEditIntentsJson',context),'{"proof":"live"}');
  callback({state:false,ack:{kind:'SAVED',savedGeneration:3,commentEditIntentsSha256:'a'.repeat(64)}});assert.equal(checkpoints,1);assert.equal(context.localDirty,true);
  callback({state:false,ack:{kind:'PROTECTED',savedGeneration:4,commentEditIntentsSha256:'a'.repeat(64)}});assert.equal(checkpoints,1);
  callback({state:false,ack:{kind:'SAVED',savedGeneration:4,commentEditIntentsSha256:'a'.repeat(64)}});assert.equal(checkpoints,2);
});
test('renderer-generated whole-anchor deletion, Save checkpoint and real Undo restore Core comment identity',async()=>{
  const author=require('../../src/core/word-comment-authoring-v1.cjs');
  const save=require('../../src/core/word-comment-anchor-save-v1.cjs');
  const envelope=require('../../src/core/document-content-envelope-v1.cjs');
  const sha=text=>require('node:crypto').createHash('sha256').update(text).digest('hex');
  const {editor,ui}=await harness([p('Alpha suffix')]);
  const projectId='renderer-save',sceneId='roman/s.txt',sessionId='actual-editor-session';
  const content=()=>envelope.composeObservablePayload({doc:editor.getJSON()});
  try {
    const before=content();
    const state=author.planCommentAuthoring({beforeText:null,projectId,sceneId,sceneSha256:sha(before),paragraphs:['Alpha suffix'],now:'2026-10-04T00:00:00Z',input:{requestId:'create-one',action:'create',projectId,sceneId,subjectId:'scene',expectedStateSha256:'',expectedSceneSha256:sha(before),body:'Retain root',anchor:{paragraphIndex:0,startUtf16:0,selectedText:'Alpha'}}}).afterText;
    editor.commands.setTextSelection({from:1,to:6});editor.commands.deleteSelection();
    const deleted=content(),forward=ui.getCommentEditIntentsJson(editor);
    const first=save.planCommentAnchorSave({beforeText:state,projectId,sceneId,beforeContent:before,afterContent:deleted,editIntents:forward,sessionId});
    assert.equal(JSON.parse(first.afterText).threads[0].status,'deleted');
    checkpoint(ui,editor);assert.equal(editor.commands.undo(),true);
    const restored=save.planCommentAnchorSave({beforeText:first.afterText,projectId,sceneId,beforeContent:deleted,afterContent:content(),editIntents:ui.getCommentEditIntentsJson(editor),sessionId});
    const original=JSON.parse(state).threads[0],actual=JSON.parse(restored.afterText).threads[0];
    assert.equal(actual.threadId,original.threadId);assert.equal(actual.status,'open');
    assert.deepEqual(actual.anchor,original.anchor);assert.deepEqual(actual.messages,original.messages);
  } finally {editor.destroy();}
});
test('delayed saved-prefix receipt retains newer real input and next Save replays suffix, then Undo crosses both saves',async()=>{
  const core=require('../../src/core/word-comment-edit-intents-v1.cjs');
  const {editor,ui,wire}=await harness([p('Alpha')]);
  try {
    editor.commands.setTextSelection(3);editor.commands.insertContent({type:'text',text:'B'});
    const first=ui.getCommentEditIntentsJson(editor),firstHash=wireHash(first);
    editor.commands.insertContent({type:'text',text:'C'});
    const secondHash=wireHash(ui.getCommentEditIntentsJson(editor));
    assert.equal(ui.checkpointCommentEditIntents(editor,firstHash),true);
    assert.equal(editor.state.doc.textContent,'AlBCpha');assert.equal(wire().edits.length,1);
    assert.equal(wire().edits[0].insertText,'C');
    core.replayEditIntents(['AlBpha'],['AlBCpha'],ui.getCommentEditIntentsJson(editor));
    // A second save captured before the first acknowledgement still admits only
    // its remaining suffix, never clears later edits or reverts the baseline.
    assert.equal(ui.checkpointCommentEditIntents(editor,secondHash),true);assert.equal(wire().edits.length,0);
    assert.equal(ui.checkpointCommentEditIntents(editor,firstHash),false);
    assert.equal(editor.commands.undo(),true);assert.equal(editor.state.doc.textContent,'Alpha');
    core.replayEditIntents(['AlBCpha'],['Alpha'],ui.getCommentEditIntentsJson(editor));
    assert.equal(wire().edits[0].direction,'undo');
  } finally {editor.destroy();}
});
test('saved receipt from a replaced scene or unknown wire cannot checkpoint current authoring',async()=>{
  const {editor,ui,wire}=await harness([p('Alpha')]);
  try {
    editor.commands.setTextSelection(3);editor.commands.insertContent({type:'text',text:'B'});
    const foreign=wireHash(ui.getCommentEditIntentsJson(editor));
    editor.view.dispatch(editor.state.tr.replaceWith(0,editor.state.doc.content.size,editor.schema.nodeFromJSON(p('Beta')))
      .setMeta('wordPendingRevisionsExternal',true).setMeta('addToHistory',false));
    editor.commands.setTextSelection(3);editor.commands.insertContent({type:'text',text:'C'});
    const before=wire();
    assert.equal(ui.checkpointCommentEditIntents(editor,foreign),false);
    assert.equal(ui.checkpointCommentEditIntents(editor,'0'.repeat(64)),false);
    assert.equal(ui.checkpointCommentEditIntents(editor),false);
    assert.deepEqual(wire(),before);assert.equal(editor.state.doc.textContent,'BeCta');
  } finally {editor.destroy();}
});
test('soft-break insertion remains one paragraph intent and exact leading/trailing break baseline matches Core',async()=>{
  const core=require('../../src/core/word-comment-edit-intents-v1.cjs');
  const {editor,ui,wire}=await harness([{type:'paragraph',content:[{type:'hardBreak'},{type:'text',text:'Alpha'},{type:'hardBreak'}]}]);
  try {
    editor.commands.setTextSelection(4);assert.equal(editor.commands.setHardBreak(),true);
    assert.equal(wire().edits.length,1);assert.equal(wire().edits[0].insertText,'\n');
    assert.equal(wire().edits[0].paragraphIndex,0);assert.equal(wire().edits[0].fromUtf16,3);
    core.replayEditIntents(['\nAlpha\n'],['\nAl\npha\n'],ui.getCommentEditIntentsJson(editor));
    assert.equal(editor.commands.undo(),true);core.replayEditIntents(['\nAlpha\n'],['\nAlpha\n'],ui.getCommentEditIntentsJson(editor));
  } finally {editor.destroy();}
});
test('existing text preview explicitly discloses bounded comment-anchor changes without rendering untrusted labels',()=>{
  const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
  const source=fs.readFileSync(path.join(__dirname,'../../src/renderer/editor.js'),'utf8');
  const start=source.indexOf('function reviewSurfaceRenderCommentAnchorChanges('),end=source.indexOf('\n}',start)+2;
  const context=vm.createContext({});vm.runInContext(source.slice(start,end),context);
  assert.match(context.reviewSurfaceRenderCommentAnchorChanges({count:2}),/Текст и привязки комментариев применяются вместе/);
  assert.match(context.reviewSurfaceRenderCommentAnchorChanges({count:2}),/Комментариев: 2/);
  for(const count of [undefined,0,-1,129,Infinity,'<img src=x>'])assert.equal(context.reviewSurfaceRenderCommentAnchorChanges({count}),'');
});
for (const scenario of [
  {name:'full anchor',from:1,status:'deleted',after:'XY suffix'},
  {name:'partial anchor',from:4,status:'open',after:'AlpXY suffix'},
]) test(`same actual history group continues saved ${scenario.name} and Save after Undo/Redo restores exact identity`,async()=>{
  const author=require('../../src/core/word-comment-authoring-v1.cjs');
  const save=require('../../src/core/word-comment-anchor-save-v1.cjs');
  const envelope=require('../../src/core/document-content-envelope-v1.cjs');
  const {editor,ui,wire}=await harness([p('Alpha suffix')]);
  const projectId='renderer-tombstone',sceneId='roman/s.txt',sessionId='actual-editor-tombstone';
  const content=()=>envelope.composeObservablePayload({doc:editor.getJSON()});
  let savedContent=content();
  let savedState=author.planCommentAuthoring({beforeText:null,projectId,sceneId,sceneSha256:wireHash(savedContent),paragraphs:['Alpha suffix'],now:'2026-10-04T00:00:00Z',input:{requestId:'create-tombstone',action:'create',projectId,sceneId,subjectId:'scene',expectedStateSha256:'',expectedSceneSha256:wireHash(savedContent),body:'Preserve comment identity',anchor:{paragraphIndex:0,startUtf16:0,selectedText:'Alpha'}}}).afterText;
  const original=JSON.parse(savedState).threads[0];
  const commit=()=>{
    const intent=ui.getCommentEditIntentsJson(editor),nextContent=content();
    const plan=save.planCommentAnchorSave({beforeText:savedState,projectId,sceneId,beforeContent:savedContent,afterContent:nextContent,editIntents:intent,sessionId});
    if(plan)savedState=plan.afterText;
    savedContent=nextContent;
    assert.equal(ui.checkpointCommentEditIntents(editor,wireHash(intent)),true);
    return JSON.parse(savedState).threads[0];
  };
  try {
    editor.commands.setTextSelection({from:scenario.from,to:6});editor.commands.insertContent({type:'text',text:'X'});
    const historyId=wire().edits[0].historyId;
    assert.equal(commit().status,scenario.status);
    editor.commands.insertContent({type:'text',text:'Y'});
    assert.equal(wire().edits[0].historyId,historyId,'typing continues the actual PM group across Save');
    const tombstone=commit();assert.equal(tombstone.status,scenario.status);assert.equal(editor.state.doc.textContent,scenario.after);
    assert.equal(editor.commands.undo(),true);assert.equal(editor.state.doc.textContent,'Alpha suffix');
    const restored=commit();assert.equal(restored.threadId,original.threadId);assert.equal(restored.status,'open');
    assert.deepEqual(restored.anchor,original.anchor);assert.deepEqual(restored.messages,original.messages);
    assert.equal(editor.commands.redo(),true);assert.equal(editor.state.doc.textContent,scenario.after);
    const deletedAgain=commit();assert.equal(deletedAgain.status,scenario.status);assert.equal(deletedAgain.threadId,original.threadId);
    assert.deepEqual(deletedAgain.anchor,tombstone.anchor);assert.deepEqual(deletedAgain.messages,original.messages);
  } finally {editor.destroy();}
});

test('real multi-paragraph selection retains ordered endpoints, empty leaves, hardBreak and repeated occurrences', async () => {
  const {editor,ui}=await harness([p('same'),p(''),{type:'paragraph',content:[{type:'text',text:'same'},{type:'hardBreak'},{type:'text',text:'👩‍💻 end'}]}]);
  try {
    const starts=[];editor.state.doc.descendants((node,pos)=>{if(node.type.name==='paragraph')starts.push(pos+1);});
    editor.commands.setTextSelection({from:starts[0]+2,to:starts[2]+10});
    const expected={kind:'multi-paragraph-range',paragraphIndex:0,startUtf16:2,endParagraphIndex:2,endUtf16:10,selectedText:'me\n\nsame\n👩‍💻'};
    assert.deepEqual(ui.commentSelectionIntent(editor),expected);
    editor.commands.setTextSelection({from:starts[2]+10,to:starts[0]+2});
    assert.deepEqual(ui.commentSelectionIntent(editor),expected);
    editor.commands.setTextSelection({from:starts[0]+2,to:starts[2]+6});
    assert.throws(()=>ui.commentSelectionIntent(editor),/символ|GRAPHEME/);
  } finally {editor.destroy();}
});

test('real multi-paragraph selection admits list continuation and same cell but refuses cross-cell or body-cell ownership', async () => {
  const {DocumentTables}=await import('../../src/renderer/tiptap/documentTables.mjs');
  const {editor,ui}=await harness([{type:'orderedList',content:[{type:'listItem',content:[p('same'),p('same')]}]},
    {type:'table',content:[{type:'tableRow',content:[{type:'tableCell',content:[p('same'),p('same')]},{type:'tableCell',content:[p('same')]}]}]}],[DocumentTables]);
  try {
    const starts=[];editor.state.doc.descendants((node,pos)=>{if(node.type.name==='paragraph')starts.push(pos+1);});
    for(const [a,b] of [[0,1],[2,3]]) {
      editor.commands.setTextSelection({from:starts[a]+1,to:starts[b]+3});
      assert.deepEqual(ui.commentSelectionIntent(editor),{kind:'multi-paragraph-range',paragraphIndex:a,startUtf16:1,endParagraphIndex:b,endUtf16:3,selectedText:'ame\nsam'});
    }
    for(const [a,b] of [[1,2],[3,4]]) {
      editor.commands.setTextSelection({from:starts[a]+1,to:starts[b]+3});
      assert.throws(()=>ui.commentSelectionIntent(editor),/OWNER|ячейк/);
    }
  } finally {editor.destroy();}
});

test('exact structural Undo recovers pending multi-range save proof and prior saved history lineage',async()=>{
  const {closeHistory}=await import('@tiptap/pm/history');
  const author=require('../../src/core/word-comment-authoring-v1.cjs'),save=require('../../src/core/word-comment-anchor-save-v1.cjs');
  const envelope=require('../../src/core/document-content-envelope-v1.cjs');
  const {editor,ui,wire}=await harness([p('Alpha one.'),p('Beta two.')]);
  const projectId='recovered-ledger',sceneId='scene',sessionId='session';
  const content=()=>envelope.composeObservablePayload({doc:editor.getJSON()});
  let raw=content(),state=author.planCommentAuthoring({beforeText:null,projectId,sceneId,sceneSha256:wireHash(raw),paragraphs:['Alpha one.','Beta two.'],now:'2026-10-05T00:00:00Z',input:{requestId:'root',action:'create',projectId,sceneId,expectedStateSha256:'',expectedSceneSha256:wireHash(raw),body:'root',anchor:{kind:'multi-paragraph-range',paragraphIndex:0,startUtf16:0,endParagraphIndex:1,endUtf16:4,selectedText:'Alpha one.\nBeta'}}}).afterText;
  const original=JSON.parse(state).threads[0];
  function persist(quote){const next=content(),proof=ui.getCommentEditIntentsJson(editor);assert.equal(typeof proof,'string');const plan=save.planCommentAnchorSave({beforeText:state,projectId,sceneId,beforeContent:raw,afterContent:next,editIntents:proof,sessionId});state=plan?.afterText||state;raw=next;assert.equal(checkpoint(ui,editor),true);const t=JSON.parse(state).threads[0];assert.equal(t.anchor.selectedText,quote);assert.equal(t.threadId,original.threadId);assert.deepEqual(t.messages,original.messages);}
  try {
    editor.commands.setTextSelection(3);editor.commands.insertContent({type:'text',text:'X'});
    const pending=wire(),proven=editor.state.doc;
    editor.view.dispatch(closeHistory(editor.state.tr));editor.view.dispatch(editor.state.tr.join(editor.state.doc.child(0).nodeSize));
    assert.equal(ui.getCommentEditIntentsJson(editor),null);assert.equal(editor.commands.undo(),true);assert.equal(editor.state.doc.eq(proven),true);assert.deepEqual(wire(),pending);
    persist('AlXpha one.\nBeta');
    assert.equal(editor.commands.undo(),true);persist('Alpha one.\nBeta');
    assert.equal(editor.commands.redo(),true);persist('AlXpha one.\nBeta');
    editor.view.dispatch(closeHistory(editor.state.tr));editor.commands.setTextSelection(editor.state.doc.child(0).nodeSize+1);editor.commands.insertContent({type:'text',text:'ч'});
    persist('AlXpha one.\nчBeta');
  } finally {editor.destroy();}
});

test('inflight save ACK during invalid topology preserves pending suffix and rejects stale checkpoint',async()=>{
  const {closeHistory}=await import('@tiptap/pm/history');
  const core=require('../../src/core/word-comment-edit-intents-v1.cjs');
  const {editor,ui,wire}=await harness([p('Alpha'),p('Beta')]);
  try {
    editor.commands.setTextSelection(3);editor.commands.insertContent({type:'text',text:'B'});
    const first=wireHash(ui.getCommentEditIntentsJson(editor));
    editor.commands.insertContent({type:'text',text:'C'});const second=wireHash(ui.getCommentEditIntentsJson(editor)),suffix=wire().edits[1];
    editor.view.dispatch(closeHistory(editor.state.tr));editor.view.dispatch(editor.state.tr.join(editor.state.doc.child(0).nodeSize));
    assert.equal(ui.getCommentEditIntentsJson(editor),null);
    assert.equal(ui.checkpointCommentEditIntents(editor,first),true);assert.equal(ui.getCommentEditIntentsJson(editor),null);
    assert.equal(ui.checkpointCommentEditIntents(editor,'0'.repeat(64)),false);
    assert.equal(editor.commands.undo(),true);assert.deepEqual(wire().edits,[suffix]);
    core.replayEditIntents(['AlBpha','Beta'],['AlBCpha','Beta'],ui.getCommentEditIntentsJson(editor));
    assert.equal(ui.checkpointCommentEditIntents(editor,second),true);assert.equal(ui.checkpointCommentEditIntents(editor,first),false);
    assert.equal(editor.commands.undo(),true);core.replayEditIntents(['AlBCpha','Beta'],['Alpha','Beta'],ui.getCommentEditIntentsJson(editor));
    assert.equal(wire().edits[0].direction,'undo');
  } finally {editor.destroy();}
});

test('unsupported Redo and nonexact or manual recreation never recover edit proof',async()=>{
  const {closeHistory}=await import('@tiptap/pm/history');
  const {editor,ui}=await harness([p('Alpha'),p('Beta')]);
  try {
    const original=editor.state.doc;
    editor.view.dispatch(editor.state.tr.join(original.child(0).nodeSize));
    assert.equal(editor.commands.undo(),true);assert.equal(typeof ui.getCommentEditIntentsJson(editor),'string');
    assert.equal(editor.commands.redo(),true);assert.equal(ui.getCommentEditIntentsJson(editor),null);
    editor.view.dispatch(closeHistory(editor.state.tr));editor.commands.setTextSelection(2);editor.commands.insertContent({type:'text',text:'X'});
    assert.equal(editor.commands.undo(),true);assert.equal(editor.state.doc.eq(original),false);assert.equal(ui.getCommentEditIntentsJson(editor),null);
    editor.view.dispatch(editor.state.tr.replaceWith(0,editor.state.doc.content.size,original.content));
    assert.equal(editor.state.doc.eq(original),true);assert.equal(ui.getCommentEditIntentsJson(editor),null);
  } finally {editor.destroy();}
});

test('actual AllSelection maps full root text including heading, breaks and empty edges',async()=>{
  const {AllSelection}=await import('@tiptap/pm/state');
  const {editor,ui}=await harness([p(''),{type:'heading',attrs:{level:2},content:[{type:'text',text:'Alpha'}]},p('Beta'),p('')]);
  try {
    editor.view.dispatch(editor.state.tr.setSelection(new AllSelection(editor.state.doc)));
    assert.deepEqual(ui.commentSelectionIntent(editor),{kind:'multi-paragraph-range',paragraphIndex:0,startUtf16:0,endParagraphIndex:3,endUtf16:0,selectedText:'\nAlpha\nBeta\n'});
  } finally {editor.destroy();}
  const empty=await harness([p('')]);
  try {
    empty.editor.view.dispatch(empty.editor.state.tr.setSelection(new AllSelection(empty.editor.state.doc)));
    assert.deepEqual(empty.ui.commentSelectionIntent(empty.editor),{paragraphIndex:0,startUtf16:0,selectedText:'',kind:'point',affinity:'right'});
  } finally {empty.editor.destroy();}
});

test('AllSelection retains exact nested cell ownership and refuses foreign owners or selected nontext blocks',async()=>{
  const {AllSelection}=await import('@tiptap/pm/state');
  const {DocumentTables}=await import('../../src/renderer/tiptap/documentTables.mjs');
  const table=cells=>({type:'table',content:[{type:'tableRow',content:cells.map(content=>({type:'tableCell',content}))}]});
  for (const [content,expected] of [[ [table([[p('Alpha'),p('Beta')]])],{kind:'multi-paragraph-range',paragraphIndex:0,startUtf16:0,endParagraphIndex:1,endUtf16:4,selectedText:'Alpha\nBeta'} ],
    [[table([[p('Alpha')],[p('Beta')]])],/COMMENT_RANGE_OWNER_MISMATCH/],
    [[p('Alpha'),table([[p('Beta')]])],/COMMENT_RANGE_OWNER_MISMATCH/],
    [[table([[p('Alpha'),table([[p('Beta')]]),p('')]])],/COMMENT_RANGE_OWNER_MISMATCH/],
    [[p('Alpha'),{type:'horizontalRule'},p('Beta')],/COMMENT_EDIT_TOPOLOGY_UNSUPPORTED/]]) {
    const {editor,ui}=await harness(content,[DocumentTables]);
    try {editor.view.dispatch(editor.state.tr.setSelection(new AllSelection(editor.state.doc)));
      if(expected instanceof RegExp)assert.throws(()=>ui.commentSelectionIntent(editor),expected);else assert.deepEqual(ui.commentSelectionIntent(editor),expected);
    }finally{editor.destroy();}
  }
});
