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
