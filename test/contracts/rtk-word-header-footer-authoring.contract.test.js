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
async function harness(initialDoc = fixture()) {
  const [{getSchema},{default:StarterKit},ui,{DocumentSections},{EditorState},{history,undo,redo}] = await modules;
  const schema = getSchema([StarterKit.configure({trailingNode:false}),DocumentSections,ui.DocumentStories]);
  let state = EditorState.create({schema,doc:schema.nodeFromJSON(initialDoc),plugins:[history(),...DocumentSections.config.addProseMirrorPlugins.call({})]});
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

async function controller(saveResponses = [true], options = {}) {
  const h = await harness(options.doc || fixture());
  const fs = require('node:fs'), vm = require('node:vm');
  const source = fs.readFileSync(require('node:path').join(__dirname,'../../src/renderer/editor.js'),'utf8');
  const start = source.indexOf('function openDocumentStories(');
  const code = source.slice(start,source.indexOf('function manuscriptMutationBinding()',start));
  const nodes = [];
  class Element {
    constructor(tag) { this.tag=tag;this.children=[];this.listeners={};this.value='';nodes.push(this); }
    setAttribute() {} append(...children) {this.children.push(...children);if(this.tag==='select'&&!this.value)this.value=children[0]?.value||'';}
    after(child) {this.children.push(child);} remove() {this.removed=true;for(const child of this.children)child.remove?.();} focus() {} addEventListener(name,fn){this.listeners[name]=fn;}
  }
  let body, hooks;let saveCount=0;const intents=[];
  const context = {isTiptapMode:true,currentDocumentKind:options.kind || 'scene',currentProjectId:'project-A',currentDocumentId:'scene-A',currentTreeContentPublicationId:'revision-A',flowModeState:{active:options.flow === true},
    storyMutationPending:false,pendingStoryRequestId:null,storyRequestSequence:0,storyEditorPanel:null,destroyStoryEditor:null,storyDrafts:new Map(),manuscriptDrafts:new Map(),wordCommentDraft:null,wordCommentBusy:false,notesMutationPending:false,
    document:{createElement:tag=>new Element(tag),querySelector:()=>null},notesCaptureForm:new Element('form'),setNotesWorkspaceStatus:()=>{},
    storyInventory:h.ui.storyInventory,getTiptapDocumentSnapshot:()=>({doc:envelope.canonicalizeDocumentJson(h.editor.getJSON())}),
    applyTiptapStoryBody:(...args)=>h.ui.applyStoryBody(h.editor,...args),
    createManuscriptBodyEditor:(_host,options)=>{hooks=options;return {setDocument:value=>{body=structuredClone(value);},getJSON:()=>body,setEditable(){},destroy(){}};},
    invokeWorkspaceQueryBridge:async id=>{assert.equal(id,'query.project.documentStories');return{ok:true,projectId:'project-A',sceneId:'scene-A',subjectId:'subject-A',expectedSceneSha256:'digest'};},
    dispatchUiCommand:async (id,payload)=>{
      if(id==='cmd.project.save'){const ok=saveResponses[Math.min(saveCount++,saveResponses.length-1)];return{ok};}
      intents.push({id,payload});const action=id.split('.').at(-1);
      const {sectionIndex,role,variant,source,titlePage,evenAndOddHeaders}=payload;
      const intent=action==='options'?{op:'setSectionOptions',sectionIndex,titlePage,evenAndOddHeaders}:{op:action,sectionIndex,role,variant,...(action==='create'?{source}:{})};
      const plan=stories.planStoryMutation(h.editor.getJSON(),intent,{idSeed:'intent-'+intents.length,trustedSections:{schemaVersion:1,boundaries:[],final:props}});
      h.dispatch(h.editor.state.tr.replaceWith(0,h.editor.state.doc.content.size,h.editor.state.schema.nodeFromJSON(plan.doc).content).setDocAttribute('wordSections',plan.doc.attrs.wordSections).setDocAttribute('wordStories',plan.doc.attrs.wordStories).setMeta('wordPendingRevisionsExternal',true));
      return{ok:true,value:{result:{ok:true,storyId:plan.storyId}}};
    },
  };
  vm.createContext(context);vm.runInContext(code+'\nglobalThis.openStories=openDocumentStories;',context);context.openStories();
  return {h,context,nodes,intents,get saveCount(){return saveCount;},edit(text){body={type:'doc',content:[p(text)]};hooks.onChange(body);},
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

test('browser bundle parses and edits story projections without Node globals',async()=>{
  const esbuild=require('esbuild'),vm=require('node:vm'),path=require('node:path');
  const source=esbuild.buildSync({stdin:{contents:`import envelope from './src/core/document-content-envelope-v1.cjs';
    import stories from './src/core/word-stories-projection-v1.cjs';
    import { storyInventory } from './src/renderer/tiptap/documentStories.mjs';
    globalThis.check = raw => {
      const parsed = envelope.parseObservablePayload(raw);
      if (parsed.issue) return JSON.stringify({issue:parsed.issue});
      const rows = storyInventory(parsed.doc);
      const next = stories.replaceBodyProjection(parsed.doc, rows[0].id, {type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Browser edit'}]}]});
      const reopened = envelope.parseObservablePayload(envelope.composeObservablePayload({...parsed,doc:next}));
      return JSON.stringify({issue:reopened.issue, text:envelope.deriveVisibleTextFromDocument(reopened.doc), rows:storyInventory(reopened.doc)});
    };`,resolveDir:path.resolve(__dirname,'../..')},bundle:true,format:'iife',platform:'browser',write:false}).outputFiles[0].text;
  assert.equal(source.includes('node:crypto'),false);assert.equal(source.includes('src/io/documentMedia.js'),false);
  const context={TextEncoder,TextDecoder,URL};vm.createContext(context);vm.runInContext(source,context);
  assert.equal(context.Buffer,undefined);assert.equal(context.process,undefined);
  const doc=fixture();
  const image=require('../../src/io/documentMedia.js').createImageAttrs(require('../fixtures/document-jpeg-fixtures.cjs').rgb,{alt:'header image'});
  doc.attrs.wordStories.stories[1].body={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Reference',marks:[{type:'link',attrs:{href:'https://example.org/header'}}]},{type:'image',attrs:image}]}]};
  const result=JSON.parse(context.check(envelope.composeObservablePayload({doc})));
  assert.equal(result.issue,null,JSON.stringify(result));assert.equal(result.text,'Alpha\nBeta');assert.equal(result.rows.length,2);
  assert.equal(result.rows[0].body.content[0].content[0].text,'Browser edit');
  assert.deepEqual(result.rows[1].body,doc.attrs.wordStories.stories[1].body);
});

test('actual checked scene-load chain replaces root story metadata together with manuscript body',async()=>{
  const [{Editor},{default:StarterKit},ui,{DocumentSections}]=await modules;
  const {WordPendingRevisions,setCheckedDocument:setCheckedReviewDocument}=await import('../../src/renderer/tiptap/wordPendingRevisions.mjs');
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
  const source=fs.readFileSync(path.join(__dirname,'../../src/renderer/tiptap/index.js'),'utf8');
  const start=source.indexOf('function setCheckedDocument(editor, doc) {');
  const context={wordSections:sections,wordStories:stories,setCheckedReviewDocument};vm.createContext(context);
  vm.runInContext(source.slice(start,source.indexOf('\nexport function applyTiptapUserBookmarkPublication',start)),context);
  const editor=new Editor({element:null,extensions:[StarterKit.configure({trailingNode:false}),DocumentSections,ui.DocumentStories,WordPendingRevisions],content:{type:'doc',content:[p('Old scene')]}});
  assert.equal(context.setCheckedDocument(editor,fixture()),true);
  assert.equal(envelope.deriveVisibleTextFromDocument(editor.getJSON()),'Alpha\nBeta');assert.deepEqual(stories.read(editor.getJSON()),stories.read(fixture()));
  const ordinary={type:'doc',content:[p('Different scene')]};assert.equal(context.setCheckedDocument(editor,ordinary),true);
  assert.equal(stories.read(editor.getJSON()),null);assert.equal(sections.read(editor.getJSON()),null);assert.equal(envelope.deriveVisibleTextFromDocument(editor.getJSON()),'Different scene');
  editor.destroy();
});

test('actual auxiliary editor schema normalizes only null language defaults before story Save',async()=>{
  const [{Editor},{manuscriptBodyExtensions,readManuscriptBodyDocument}]=await Promise.all([import('@tiptap/core'),import('../../src/renderer/tiptap/manuscriptNotes.mjs')]);
  const {editor,ui}=await harness();
  const body={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'EVEN PAGE HEADER',marks:[{type:'textStyle',attrs:{fontFamily:'Aptos',fontSize:'12pt'}}]}]}]};
  const auxiliary=new Editor({element:null,extensions:manuscriptBodyExtensions(),content:body});
  auxiliary.commands.insertContentAt(1,{type:'text',text:'YALKEN EDIT '});
  const raw=auxiliary.getJSON();assert.equal(raw.content[0].attrs.wordParagraphMarkLanguage,null);
  const normalized=readManuscriptBodyDocument(auxiliary);
  assert.equal(Object.hasOwn(normalized.content[0].attrs,'wordParagraphMarkLanguage'),false);
  assert.equal(ui.applyStoryBody(editor,editor.getJSON(),'head',normalized),true);
  assert.match(stories.read(editor.getJSON()).stories[0].body.content[0].content.map(node=>node.text||'').join(''),/YALKEN EDIT EVEN PAGE HEADER/);
  const paragraphLanguage={val:'ru-FI',eastAsia:'ru-RU',bidi:'ar-SA'},runLanguage={val:'en-US',eastAsia:'ja-JP',bidi:'he-IL'};
  const explicit=structuredClone(body);explicit.content[0].attrs={wordParagraphMarkLanguage:paragraphLanguage};
  explicit.content[0].content[0].marks[0].attrs.wordLanguage=runLanguage;
  auxiliary.commands.setContent(explicit);
  const authored=readManuscriptBodyDocument(auxiliary);
  assert.deepEqual(authored.content[0].attrs.wordParagraphMarkLanguage,paragraphLanguage);
  assert.deepEqual(authored.content[0].content[0].marks[0].attrs.wordLanguage,runLanguage);
  assert.equal(ui.applyStoryBody(editor,editor.getJSON(),'head',authored),true);
  const saved=stories.read(editor.getJSON()).stories[0].body;
  assert.deepEqual(saved.content[0].attrs.wordParagraphMarkLanguage,paragraphLanguage);
  assert.deepEqual(saved.content[0].content[0].marks[0].attrs.wordLanguage,runLanguage);
  const protectedDoc=JSON.stringify(editor.getJSON());
  for(const scope of ['paragraph','run']){
    const malformed=structuredClone(explicit);
    if(scope==='paragraph')malformed.content[0].attrs.wordParagraphMarkLanguage={val:'bad tag'};
    else malformed.content[0].content[0].marks[0].attrs.wordLanguage={val:'bad tag'};
    auxiliary.commands.setContent(malformed);
    assert.throws(()=>stories.replaceBodyProjection(editor.getJSON(),'head',readManuscriptBodyDocument(auxiliary)),/WORD_LANGUAGE_INVALID/);
    assert.equal(JSON.stringify(editor.getJSON()),protectedDoc,'malformed language must not mutate the saved story');
  }
  auxiliary.destroy();
});

test('actual single story Apply control routes through the admitted batch command without changing entitlements',()=>{
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
  const source=fs.readFileSync(path.join(__dirname,'../../src/renderer/editor.js'),'utf8');
  const start=source.indexOf("  const cleanLinkReturn = changeId.startsWith(");
  const route=source.slice(start,source.indexOf('  let bridgeResult = null;',start));
  const law=require('../../src/core/entitlement-law-v1.cjs');
  for(const changeId of ['docx-story-return-123','ordinary-text-change']){
    const context={changeId,requestId:'request-1',REVIEW_SURFACE_EXACT_TEXT_APPLY_BATCH_COMMAND_ID:'cmd.project.review.applyExactTextChangesBatch',REVIEW_SURFACE_EXACT_TEXT_APPLY_COMMAND_ID:'cmd.project.review.applyExactTextChange',
      reviewSurfaceBuildExactTextApplyBatchPayload:(requestId,changeIds)=>({requestId,changeIds}),reviewSurfaceBuildExactTextApplyPayload:(requestId,changeId)=>({requestId,changeId})};
    vm.createContext(context);vm.runInContext(route+'\nglobalThis.selected={commandId,payload};',context);
    if(changeId.startsWith('docx-story-return-')){
      assert.equal(context.selected.commandId,'cmd.project.review.applyExactTextChangesBatch');
      assert.equal(JSON.stringify(context.selected.payload.changeIds),JSON.stringify([changeId]));
      assert.equal(law.decideCommandEntitlement(context.selected.commandId,'free').available,true);
    } else assert.equal(context.selected.commandId,'cmd.project.review.applyExactTextChange');
  }
});

test('actual contextual create on ordinary scene sends bounded intent, then body edit uses normal Save',async()=>{
  const c=await controller([true],{doc:{type:'doc',content:[p('Ordinary scene')]}});
  await c.click('Создать отдельный колонтитул');
  assert.equal(c.intents.length,1);assert.equal(c.intents[0].id,'cmd.project.documentStories.create');
  assert.deepEqual(Object.keys(c.intents[0].payload).sort(),['expectedSceneSha256','projectId','requestId','role','sceneId','sectionIndex','source','subjectId','variant'].sort());
  const registry=stories.read(c.h.editor.getJSON());assert.equal(registry.stories.length,1);assert.equal(registry.stories[0].role,'header');
  c.edit('Created in Yalken');await c.click('Сохранить колонтитул');
  assert.equal(c.text(),'Created in Yalken');assert.equal(envelope.deriveVisibleTextFromDocument(c.h.editor.getJSON()),'Ordinary scene');
});
test('renderer creation publication requires matching request, scene, generation and absence of newer auxiliary drafts',()=>{
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
  const source=fs.readFileSync(path.join(__dirname,'../../src/renderer/editor.js'),'utf8');
  const start=source.indexOf("    if (payload?.storyPublication === true) {");const end=source.indexOf('    let treeContentParsed = null;',start);
  const baseline=envelope.composeObservablePayload({doc:fixture()}),next=stories.planStoryMutation(fixture(),{op:'create',sectionIndex:1,role:'footer',variant:'first',source:'empty'},{idSeed:'publisher-test'});
  const payload={storyPublication:true,storyPublicationRequestId:'request-1',projectId:'project-A',documentId:'scene-A',expectedGeneration:2,expectedContent:baseline,content:envelope.composeObservablePayload({doc:next.doc})};
  let writes=0;const context={pendingStoryRequestId:'request-1',currentProjectId:'project-A',currentDocumentId:'scene-A',localEditGeneration:2,composeDocumentContent:()=>baseline,parseDocumentContent:envelope.parseObservablePayload,storyDrafts:new Map(),manuscriptDrafts:new Map(),wordCommentDraft:null,wordCommentBusy:false,notesMutationPending:false,replaceTiptapTreeDocumentSnapshot:()=>{writes++;},updateStatusText(){}};
  vm.createContext(context);vm.runInContext('globalThis.publish=payload=>{'+source.slice(start,end)+'};',context);
  context.publish(payload);assert.equal(writes,1);
  context.storyDrafts.set('new',{body:'newer draft'});context.publish(payload);assert.equal(writes,1);
  context.storyDrafts.clear();context.publish({...payload,storyPublicationRequestId:'old'});context.publish({...payload,expectedGeneration:1});context.publish({...payload,documentId:'different'});assert.equal(writes,1);
});
test('story command capabilities are explicit desktop FREE authorship, absent on web',async()=>{
  const {enforceCapabilityForCommand}=await import('../../src/renderer/commands/capabilityPolicy.mjs');const law=require('../../src/core/entitlement-law-v1.cjs');
  for(const action of ['create','remove','linkPrevious','options']){const id='cmd.project.documentStories.'+action;
    assert.equal(law.decideCommandEntitlement(id,'free').available,true);
    assert.equal(enforceCapabilityForCommand(id,{platformId:'node'}).ok,true);
    assert.equal(enforceCapabilityForCommand(id,{platformId:'web'}).ok,false);
  }
});

test('actual story surface admits chapter documents and scenes but never folders or combined flow',async()=>{
  for(const kind of ['scene','chapter-file']){
    const c=await controller([true],{doc:{type:'doc',content:[p('Document')]},kind});
    await c.click('Создать отдельный колонтитул');assert.equal(c.intents.length,1);
    c.edit('Authored '+kind);await c.click('Сохранить колонтитул');assert.equal(c.text(),'Authored '+kind);
  }
  for(const options of [{kind:'chapter'},{kind:'folder'},{kind:'scene',flow:true}]){
    const c=await controller([true],options);assert.equal(c.context.storyEditorPanel,null);assert.equal(c.intents.length,0);assert.equal(c.saveCount,0);
  }
});
