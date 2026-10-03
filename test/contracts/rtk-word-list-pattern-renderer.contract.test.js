'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const core = require('../../src/core/word-list-numbering-v1.cjs');
const p = text => ({type:'paragraph',content:[{type:'text',text}]});
const doc = (...content) => ({type:'doc',content});
async function harness(content) {
  const [{Editor}, {default:StarterKit}, ui] = await Promise.all([import('@tiptap/core'),import('@tiptap/starter-kit'),import('../../src/renderer/tiptap/documentListNumbering.mjs')]);
  const editor = new Editor({element:null,extensions:[StarterKit.configure({trailingNode:false}),ui.DocumentListNumbering],content});
  // A headless editor has no mounted view: install the real extension plugins
  // and model view lifecycle only, retaining actual transactions/history.
  editor.view.updateState(editor.state.reconfigure({plugins:editor.extensionManager.plugins}));
  let destroyed=false;Object.defineProperty(editor,'isDestroyed',{get:()=>destroyed});
  const destroy=editor.destroy.bind(editor);editor.destroy=()=>{destroyed=true;destroy();};
  return {editor,ui};
}
test('actual editor creates literal pattern through a captured paragraph, with one-step Undo and Redo',async()=>{
  const {editor,ui}=await harness(doc(p('Alpha'),p('unrelated')));
  try {
    editor.commands.setTextSelection(2);const before=editor.getJSON(), levels=core.defaultLevels();levels[0].text='Article %1';
    const target=ui.captureNumberingTarget(editor);assert.deepEqual(target.preview({action:'configure',levels}),['Article 1']);
    assert.equal(target.apply({action:'configure',levels}).performed,true);
    assert.equal(editor.getJSON().content[0].type,'orderedList');
    assert.deepEqual(editor.getJSON().content[1],before.content[1]);
    assert.equal(editor.commands.undo(),true);assert.deepEqual(editor.getJSON(),before);
    assert.equal(editor.commands.redo(),true);assert.equal(editor.getJSON().content[0].attrs.wordNumbering.levels[0].text,'Article %1');
  } finally {editor.destroy();}
});
test('captured target rejects changed document, identity, read-only and destroyed editor',async()=>{
  for(const scenario of ['document','identity','readonly','destroyed']){
    const {editor,ui}=await harness(doc(p('Alpha')));let current=true;
    try {
      const target=ui.captureNumberingTarget(editor,()=>current);
      if(scenario==='document')editor.commands.insertContent({type:'text',text:'changed'});
      if(scenario==='identity')current=false;
      if(scenario==='readonly')editor.setEditable(false);
      if(scenario==='destroyed')editor.destroy();
      const before=JSON.stringify(editor.getJSON());
      assert.throws(()=>target.apply({action:'configure',levels:core.defaultLevels()}),/STALE_EDITOR_TARGET/);
      assert.equal(JSON.stringify(editor.getJSON()),before);
    }finally{if(!editor.isDestroyed)editor.destroy();}
  }
});
test('derived marker decorations contain literal labels without inserting author text, hidden HTML attrs refuse spoofing',async()=>{
  const levels=core.defaultLevels();levels[0].text='(%1)';
  const numbered=core.planNumberingEdit(doc(p('Alpha')),{listPath:[0],action:'configure',levels});
  const {editor,ui}=await harness(numbered);
  try {
    const before=JSON.stringify(editor.getJSON());const decorations=ui.numberingDecorations(editor.state.doc).find();
    assert.equal(decorations.length,1);assert.equal(decorations[0].type.attrs['data-word-marker'],'(1)');
    assert.equal(JSON.stringify(editor.getJSON()),before);assert.equal(editor.state.doc.textContent,'Alpha');
    for(const attr of Object.values(ui.DocumentListNumbering.config.addGlobalAttributes()[0].attributes)){
      assert.equal(attr.rendered,false);assert.equal(attr.parseHTML({getAttribute:()=>'{"forged":true}'}),null);
    }
  }finally{editor.destroy();}
});
test('settings entry dispatches the registered command; auxiliary capture never falls back to manuscript',async()=>{
  const root=path.resolve(__dirname,'../../src/renderer');const source=fs.readFileSync(path.join(root,'editor.js'),'utf8');
  const start=source.indexOf('function dispatchListTypeAction('), end=source.indexOf('async function handlePlanFlowSave',start), calls=[];
  const ctx=vm.createContext({EXTRA_COMMAND_IDS:{LIST_CONFIGURE_NUMBERING:'cmd.project.list.configureNumbering'},dispatchUiCommand:id=>{calls.push(id);return Promise.resolve({ok:true});}});
  vm.runInContext(source.slice(start,end),ctx);await ctx.dispatchListTypeAction('configure-numbering');assert.deepEqual(calls,['cmd.project.list.configureNumbering']);
  const index=fs.readFileSync(path.join(root,'tiptap/index.js'),'utf8');const from=index.indexOf('export function captureTiptapNumberingTarget()'),to=index.indexOf('export function captureTiptapLinkTarget()',from);
  const target=vm.createContext({getFocusedManuscriptBodyEditor:()=>({}),captureNumberingTarget:()=>{throw Error('wrong main target');}});
  vm.runInContext(index.slice(from,to).replace('export ',''),target);assert.equal(target.captureTiptapNumberingTarget(),null);
});

test('actual sink, split, lift and Undo recompute parent-dependent markers without author text changes',async()=>{
  const levels=core.defaultLevels();levels[0].text='(%1)';levels[1].text='%1.%2.';
  const input=core.planNumberingEdit(doc({type:'orderedList',content:[{type:'listItem',content:[p('Alpha')]},{type:'listItem',content:[p('Beta')]}]}),{listPath:[0],action:'configure',levels});
  const {editor}=await harness(input);
  const position=text=>{let found;editor.state.doc.descendants((node,pos)=>{if(node.isText&&node.text===text)found=pos;});return found;};
  const labels=()=>{const json=editor.getJSON(),projections=core.resolveMarkers(json),out=[];const walk=node=>{const projection=projections.get(node);(node.content||[]).forEach((child,index)=>{if(projection)out.push(projection.items[index].label);walk(child);});};walk(json);return out;};
  try {
    const before=editor.getJSON();editor.commands.setTextSelection(position('Beta'));
    assert.equal(editor.commands.sinkListItem('listItem'),true);assert.deepEqual(labels(),['(1)','1.1.']);
    const nested=editor.getJSON();assert.equal(nested.content[0].content[0].content[1].attrs.wordNumbering.level,1);
    assert.equal(editor.commands.undo(),true);assert.deepEqual(editor.getJSON(),before);
    assert.equal(editor.commands.redo(),true);assert.deepEqual(labels(),['(1)','1.1.']);
    editor.commands.setTextSelection(position('Beta')+2);assert.equal(editor.commands.splitListItem('listItem'),true);
    assert.deepEqual(labels(),['(1)','1.1.','1.2.']);
    assert.equal(editor.commands.liftListItem('listItem'),true);
    assert.deepEqual(labels(),['(1)','1.1.','(2)']);
    assert.equal(editor.state.doc.textContent,'AlphaBeta');
  }finally{editor.destroy();}
});

test('mixed legacy and patterned starts remain bound to their own list nodes',async()=>{
  const patterned=core.planNumberingEdit(doc(p('pattern')),{listPath:[0],action:'configure',levels:core.defaultLevels()}).content[0];
  const legacy={type:'orderedList',attrs:{start:7,wordListId:'legacy',wordListStart:7},content:[{type:'listItem',content:[p('legacy')]}]};
  const {editor,ui}=await harness(doc(patterned,p('gap'),legacy));
  try{
    editor.commands.setTextSelection(3);const target=ui.captureNumberingTarget(editor);const levels=core.defaultLevels();levels[0].start=4;
    target.apply({action:'configure',levels});
    const actual=editor.getJSON();assert.equal(actual.content[0].attrs.start,4);assert.equal(actual.content[2].attrs.start,7);
  }finally{editor.destroy();}
});

test('actual settings dialog retains input after stale/capability refusal and cancellation never applies',async()=>{
  const source=fs.readFileSync(path.resolve(__dirname,'../../src/renderer/editor.js'),'utf8');
  for(const scenario of ['cancel','stale','capability','refused','apply']) {
    const nodes=[],applied=[];let focused;
    class Element {
      constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.style={};this.events={};this.attrs={};this.isConnected=true;this.value='';nodes.push(this);}
      append(...nodes){this.children.push(...nodes);for(const node of nodes)node.parent=this;if(this.tagName==='SELECT'&&this.children.length===nodes.length)this.value=nodes[0]?.value||'';}
      after(node){this.parent.append(node);}
      replaceChildren(){this.children=[];}
      setAttribute(key,value){this.attrs[key]=value;} removeAttribute(key){delete this.attrs[key];}
      addEventListener(name,fn){this.events[name]=fn;}
      focus(){focused=this;} showModal(){this.open=true;} close(){this.open=false;this.events.close?.();} remove(){this.isConnected=false;}
    }
    const document={activeElement:new Element('button'),createElement:tag=>new Element(tag),body:new Element('body')};
    const ctx=vm.createContext({document,structuredClone,isTiptapMode:true,currentProjectId:'p',currentDocumentId:'scene',localEditGeneration:1,
      isLinkDialogOpen:()=>false,updateStatusText(){},window:{},EXTRA_COMMAND_IDS:{LIST_CONFIGURE_NUMBERING:'configure'},withEditorModeCommandPayload:()=>({}),
      enforceCapabilityForCommand:()=>({ok:scenario!=='capability'}),
      captureTiptapNumberingTarget:()=>({levels:[{format:'1',start:1,text:'%1.',restartAfterLevel:null}],level:0,candidates:[],
        preview:()=>['1.'],apply:input=>{if(scenario==='refused')return {performed:false,reason:'REFUSED'};applied.push(input);return {performed:true};}})});
    const start=source.indexOf('let activeNumberingDialog = null;'),end=source.indexOf('function dispatchListTypeAction(',start);
    vm.runInContext(source.slice(start,end),ctx);const pending=ctx.handleNumberingSettings();
    const dialog=nodes.find(node=>node.tagName==='DIALOG'),template=nodes.find(node=>node.id==='numbering-template');
    assert.equal(dialog.open,true);assert.equal(focused,template);assert.equal(template.attrs['aria-describedby'],'numbering-template-hint numbering-error');
    template.value='Article %1';if(scenario==='stale')ctx.currentDocumentId='other';
    if(scenario!=='cancel')nodes.find(node=>node.textContent==='Применить').events.click();
    if(scenario!=='apply'){
      assert.equal(applied.length,0);assert.equal(dialog.open,true);assert.equal(template.value,'Article %1');
      nodes.find(node=>node.textContent==='Отмена').events.click();
    }
    const result=await pending;assert.equal(result.performed,scenario==='apply');assert.equal(dialog.isConnected,false);
    assert.equal(focused,document.activeElement);
    if(scenario==='apply')assert.equal(applied[0].levels[0].text,'Article %1');
  }
});

test('real command runner enforces numbering capability and editor mode before invoking settings',async()=>{
  const [{createCommandRegistry},{createCommandRunner},{registerProjectCommands,EXTRA_COMMAND_IDS},{enforceCapabilityForCommand}]=await Promise.all([
    import('../../src/renderer/commands/registry.mjs'),import('../../src/renderer/commands/runCommand.mjs'),
    import('../../src/renderer/commands/projectCommands.mjs'),import('../../src/renderer/commands/capabilityPolicy.mjs')]);
  const registry=createCommandRegistry();let calls=0;
  registerProjectCommands(registry,{uiActions:{listConfigureNumbering:()=>{calls++;return {performed:true};}}});
  const run=createCommandRunner(registry),id=EXTRA_COMMAND_IDS.LIST_CONFIGURE_NUMBERING;
  assert.equal((await run(id,{platformId:'node',editorMode:'tiptap'})).ok,true);assert.equal(calls,1);
  assert.equal((await run(id,{platformId:'node',editorMode:'plain'})).ok,false);assert.equal(calls,1);
  assert.equal((await run(id,{platformId:'unknown',editorMode:'tiptap'})).ok,false);assert.equal(calls,1);
  assert.equal(enforceCapabilityForCommand(id,{platformId:'node',editorMode:'tiptap'}).ok,true);
});
