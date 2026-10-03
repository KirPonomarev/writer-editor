'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const sections = require('../../src/core/word-sections-v1.cjs');
const stories = require('../../src/core/word-stories-v1.cjs');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const p = text => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] });
const props = { type: 'nextPage', pageSize: { widthTwips: 11906, heightTwips: 16838, orientation: 'portrait' }, margins: { topTwips:1440,rightTwips:1440,bottomTwips:1440,leftTwips:1440,headerTwips:720,footerTwips:720,gutterTwips:0 }, columns:{count:1,spaceTwips:720} };
function fixture() {
  return stories.bind(sections.bind({type:'doc',content:[p('Alpha'),p('Beta')]}, {schemaVersion:1,boundaries:[{endParagraphIndex:0,properties:props}],final:props}), {
    schemaVersion:1,evenAndOddHeaders:true,stories:[{id:'head',role:'header',body:{type:'doc',content:[p('Shared header')]}},{id:'empty',role:'footer',body:{type:'doc',content:[p('')]}}],
    sections:[{titlePage:false,header:{default:'head'},footer:{default:'empty'}},{titlePage:true,header:{},footer:{}}],
  });
}
const modules = Promise.all([import('@tiptap/core'),import('@tiptap/starter-kit'),import('../../src/renderer/tiptap/documentStories.mjs'),import('../../src/renderer/tiptap/documentSections.mjs'),import('@tiptap/pm/state'),import('@tiptap/pm/history')]);
async function harness() {
  const [{getSchema},{default:StarterKit},ui,{DocumentSections},{EditorState},{history,undo,redo}] = await modules;
  const schema = getSchema([StarterKit.configure({trailingNode:false}),DocumentSections,ui.DocumentStories]);
  let state = EditorState.create({schema,doc:schema.nodeFromJSON(fixture()),plugins:[history(),...DocumentSections.config.addProseMirrorPlugins.call({})]});
  const dispatch = tr => {state = state.applyTransaction(tr).state;};
  const editor = {isEditable:true,isDestroyed:false,get state(){return state;},getJSON:()=>state.doc.toJSON(),view:{dispatch}};
  return {editor,dispatch,ui,undo,redo};
}
test('shared inherited header and explicit empty footer inventory retain every section usage',async()=>{
  const {ui}=await harness();const list=ui.storyInventory(fixture());
  assert.equal(list.length,2);assert.match(list[0].label,/Верхний колонтитул/);assert.match(list[0].label,/раздел 1/);assert.match(list[0].label,/раздел 2/);
  assert.equal(list[1].body.content[0].content.length,0);
  assert.deepEqual(stories.read(fixture()).sections[1].header,{});
});
test('body authoring is undoable and serializes independently of manuscript text and section topology',async()=>{
  const {editor,dispatch,ui,undo,redo}=await harness();const before=envelope.canonicalizeDocumentJson(editor.getJSON());
  const body={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Changed header',marks:[{type:'bold'}]}]}]};
  assert.equal(ui.applyStoryBody(editor,before,'head',body),true);
  assert.deepEqual(stories.read(editor.getJSON()).stories[0].body,body);stories.validateSave(before,editor.getJSON());
  assert.equal(envelope.deriveVisibleTextFromDocument(editor.getJSON()),'Alpha\nBeta');
  assert.equal(undo(editor.state,dispatch),true);assert.deepEqual(stories.read(editor.getJSON()),stories.read(before));
  assert.equal(redo(editor.state,dispatch),true);
  const reopened=envelope.parseObservablePayload(envelope.composeObservablePayload({doc:editor.getJSON()})).doc;
  assert.deepEqual(stories.read(reopened).stories[0].body,body);
});
test('body changes reject stale scene snapshots and forbidden rich payloads without mutation',async()=>{
  const {editor,dispatch,ui}=await harness();const before=editor.getJSON();dispatch(editor.state.tr.insertText('new ',1));
  const current=editor.getJSON();assert.equal(ui.applyStoryBody(editor,before,'head',{type:'doc',content:[p('Wrong')]}),false);assert.deepEqual(editor.getJSON(),current);
  assert.throws(()=>ui.applyStoryBody(editor,current,'head',{type:'doc',content:[{type:'rawXml',text:'bad'}]}));assert.deepEqual(editor.getJSON(),current);
  editor.isEditable=false;assert.equal(ui.applyStoryBody(editor,current,'head',{type:'doc',content:[p('Wrong')]}),false);
});
test('ordinary paragraph split and Undo retain story ownership while section endpoints move',async()=>{
  const {editor,dispatch,undo}=await harness();const before=editor.getJSON();dispatch(editor.state.tr.split(3));
  assert.equal(sections.read(editor.getJSON()).boundaries[0].endParagraphIndex,1);assert.deepEqual(stories.read(editor.getJSON()),stories.read(before));
  assert.equal(undo(editor.state,dispatch),true);assert.deepEqual(stories.read(editor.getJSON()),stories.read(before));
});

async function controller(saveResponses = [true]) {
  const h = await harness();
  const fs = require('node:fs'), vm = require('node:vm');
  const source = fs.readFileSync(require('node:path').join(__dirname,'../../src/renderer/editor.js'),'utf8');
  const start = source.indexOf('function openDocumentStories() {');
  const code = source.slice(start,source.indexOf('function manuscriptMutationBinding()',start));
  const nodes = [];
  class Element {
    constructor(tag) { this.tag=tag;this.children=[];this.listeners={};this.value='';nodes.push(this); }
    setAttribute() {} append(...children) {this.children.push(...children);if(this.tag==='select'&&!this.value)this.value=children[0]?.value||'';}
    after(child) {this.children.push(child);} remove() {this.removed=true;} focus() {} addEventListener(name,fn){this.listeners[name]=fn;}
  }
  let body, hooks;let saveCount=0;
  const context = {isTiptapMode:true,currentDocumentKind:'scene',currentProjectId:'project-A',currentDocumentId:'scene-A',currentTreeContentPublicationId:'revision-A',flowModeState:{active:false},
    storyMutationPending:false,storyEditorPanel:null,destroyStoryEditor:null,storyDrafts:new Map(),
    document:{createElement:tag=>new Element(tag),querySelector:()=>null},notesCaptureForm:new Element('form'),setNotesWorkspaceStatus:()=>{},
    storyInventory:h.ui.storyInventory,getTiptapDocumentSnapshot:()=>({doc:envelope.canonicalizeDocumentJson(h.editor.getJSON())}),
    applyTiptapStoryBody:(...args)=>h.ui.applyStoryBody(h.editor,...args),
    createManuscriptBodyEditor:(_host,options)=>{hooks=options;return {setDocument:value=>{body=structuredClone(value);},getJSON:()=>body,setEditable(){},destroy(){}};},
    dispatchUiCommand:async id=>{assert.equal(id,'cmd.project.save');const ok=saveResponses[Math.min(saveCount++,saveResponses.length-1)];return{ok};},
  };
  vm.createContext(context);vm.runInContext(code+'\nglobalThis.openStories=openDocumentStories;',context);context.openStories();
  return {h,context,nodes,get saveCount(){return saveCount;},edit(text){body={type:'doc',content:[p(text)]};hooks.onChange(body);},
    async click(label){nodes.find(node=>node.textContent===label&&!node.removed).listeners.click();await new Promise(resolve=>setImmediate(resolve));},
    text:()=>stories.read(h.editor.getJSON()).stories[0].body.content[0].content[0].text};
}
test('actual contextual controller saves twice through normal scene Save and retains failure draft for retry',async()=>{
  const c=await controller([false,true,true]);c.edit('First draft');
  await c.click('Сохранить колонтитул');assert.equal(c.saveCount,1);assert.equal(c.context.storyDrafts.size,1);assert.equal(c.text(),'First draft');
  await c.click('Сохранить колонтитул');assert.equal(c.saveCount,2);assert.equal(c.context.storyDrafts.size,0);
  c.edit('Second draft');await c.click('Сохранить колонтитул');assert.equal(c.saveCount,3);assert.equal(c.text(),'Second draft');assert.equal(c.context.storyDrafts.size,0);
});
test('actual contextual controller cannot save after scene switch and discards a failed staged save without losing original',async()=>{
  const stale=await controller();stale.edit('Wrong scene');stale.context.currentDocumentId='scene-B';await stale.click('Сохранить колонтитул');
  assert.equal(stale.saveCount,0);assert.equal(stale.text(),'Shared header');assert.equal(stale.context.storyDrafts.size,1);
  const failed=await controller([false]);failed.edit('Failed draft');await failed.click('Сохранить колонтитул');failed.edit('Further draft');
  await failed.click('Отменить изменения колонтитула');assert.equal(failed.text(),'Shared header');assert.equal(failed.context.storyDrafts.size,0);
});
