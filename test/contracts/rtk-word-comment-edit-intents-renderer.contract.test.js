'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
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
    ui.checkpointCommentEditIntents(editor);assert.equal(wire().edits.length,0);
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
test('snapshot bridge carries the live bounded ledger and exact-generation save acknowledgement checkpoints it',()=>{
  const fs=require('node:fs'),vm=require('node:vm');
  const source=fs.readFileSync(require('node:path').join(__dirname,'../../src/renderer/editor.js'),'utf8');
  const start=source.indexOf('function composeEditorSnapshot()'),end=source.indexOf('\n}',start)+2;
  const ackStart=source.indexOf('window.electronAPI.onSetDirty((message) => {'),ackEnd=source.indexOf('\n  });',ackStart)+6;
  let callback, checkpoints=0;
  const context={currentProjectId:'p',currentDocumentId:'s',currentTreeContentPublicationId:null,isTiptapMode:true,localEditGeneration:4,localDirty:true,lastAckedGeneration:0,
    wordCommentDraft:null,wordCommentBusy:false,manuscriptDrafts:new Map(),notesMutationPending:false,storyDrafts:new Map(),storyMutationPending:false,pendingStoryRequestId:null,
    composeDocumentContent:()=>'',getPlainText:()=>'',getActiveBookProfile:()=>null,getSelectionOffsets:()=>({start:0,end:0}),
    getTiptapImageInsertionPosition:()=>null,getTiptapRootSplitBoundary:()=>null,getTiptapCommentEditIntentsJson:()=>'{"proof":"live"}',
    checkpointTiptapCommentEditIntents:()=>{checkpoints++;},updateSaveStateText(){},refreshManuscriptNoteReferences(){},refreshVisibleCommentProjection(){},updateInspectorSnapshot(){},
    window:{electronAPI:{onSetDirty(fn){callback=fn;}}}};
  vm.createContext(context);vm.runInContext(source.slice(start,end)+'\n'+source.slice(ackStart,ackEnd),context);
  assert.equal(vm.runInContext('composeEditorSnapshot().commentEditIntentsJson',context),'{"proof":"live"}');
  callback({state:false,ack:{kind:'SAVED',savedGeneration:3}});assert.equal(checkpoints,0);
  callback({state:false,ack:{kind:'PROTECTED',savedGeneration:4}});assert.equal(checkpoints,0);
  callback({state:false,ack:{kind:'SAVED',savedGeneration:4}});assert.equal(checkpoints,1);
});
