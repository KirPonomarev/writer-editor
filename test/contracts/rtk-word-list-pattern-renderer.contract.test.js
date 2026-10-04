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
  const {createPaletteDataProvider}=await import('../../src/renderer/commands/palette-groups.v1.mjs');
  const {resolveCommandEntitlement}=await import('../../src/renderer/commands/localCapabilityProvider.mjs');
  const surfaced=createPaletteDataProvider(registry,{defaultSurface:'palette',entitlementTier:'free'}).listAll();
  assert.equal(surfaced.find(entry=>entry.id===id)?.label,'Настроить нумерацию');
  assert.equal(resolveCommandEntitlement(id,{entitlementTier:'free'}).available,true);
  assert.equal((await run(id,{platformId:'node',editorMode:'tiptap'})).ok,true);assert.equal(calls,1);
  assert.equal((await run(id,{platformId:'node',editorMode:'plain'})).ok,false);assert.equal(calls,1);
  assert.equal((await run(id,{platformId:'unknown',editorMode:'tiptap'})).ok,false);assert.equal(calls,1);
  assert.equal(enforceCapabilityForCommand(id,{platformId:'node',editorMode:'tiptap'}).ok,true);
});

test('ordinary typing maps marker decorations without rescanning the numbering model',async()=>{
  const input=core.planNumberingEdit(doc(p('Alpha')),{listPath:[0],action:'configure',levels:core.defaultLevels()});
  const {editor}=await harness(input);const original=core.resolveMarkers;let calls=0;
  try {
    core.resolveMarkers=(...args)=>{calls++;return original(...args);};
    editor.commands.setTextSelection(4);editor.commands.insertContent({type:'text',text:'z'});
    assert.equal(calls,0);assert.match(editor.state.doc.textContent,/z/);
  }finally{core.resolveMarkers=original;editor.destroy();}
});

test('unrelated structural edit retains explicit imported skipped numbering levels',async()=>{
  const input=core.planNumberingEdit(doc(p('Parent')),{listPath:[0],action:'configure',levels:core.defaultLevels()});
  const pattern=structuredClone(input.content[0].attrs.wordNumbering);pattern.level=2;
  input.content[0].content[0].content.push({type:'orderedList',attrs:{wordNumbering:pattern,start:1,type:'1'},content:[{type:'listItem',content:[p('Child')]}]});
  const {editor}=await harness(input);
  try {
    editor.commands.insertContentAt(editor.state.doc.content.size,p('Unrelated'));
    assert.equal(editor.getJSON().content[0].content[0].content[1].attrs.wordNumbering.level,2);
  }finally{editor.destroy();}
});

test('consecutive settings commands have separate Undo steps',async()=>{
  const {editor,ui}=await harness(doc(p('Alpha')));
  try{
    const levels=core.defaultLevels();levels[0].text='Article %1';ui.captureNumberingTarget(editor).apply({action:'configure',levels});
    const first=editor.getJSON();levels[0].text='(%1)';ui.captureNumberingTarget(editor).apply({action:'configure',levels});
    assert.equal(editor.commands.undo(),true);assert.deepEqual(editor.getJSON(),first);
    assert.equal(editor.commands.redo(),true);assert.equal(editor.getJSON().content[0].attrs.wordNumbering.levels[0].text,'(%1)');
  }finally{editor.destroy();}
});

test('new list continues the explicitly selected custom definition and restart is independently undoable',async()=>{
  const levels=core.defaultLevels();levels[0].text='Article %1';
  const initial=core.planNumberingEdit(doc(p('Alpha'),p('gap'),{type:'orderedList',content:[{type:'listItem',content:[p('Beta')]}]}),{listPath:[0],action:'configure',levels});
  const {editor,ui}=await harness(initial);
  try{
    let position;editor.state.doc.descendants((node,pos)=>{if(node.isText&&node.text==='Beta')position=pos;});editor.commands.setTextSelection(position);
    const target=ui.captureNumberingTarget(editor);assert.equal(target.candidates.length,1);
    assert.deepEqual(target.preview({action:'continue',instanceId:target.candidates[0].instanceId}),['Article 2']);
    target.apply({action:'continue',instanceId:target.candidates[0].instanceId});const continued=editor.getJSON();
    const next=ui.captureNumberingTarget(editor);assert.deepEqual(next.preview({action:'restart',levels:next.levels}),['Article 1']);
    next.apply({action:'restart',levels:next.levels});assert.notEqual(editor.getJSON().content[0].attrs.wordNumbering.instanceId,editor.getJSON().content[2].attrs.wordNumbering.instanceId);
    assert.equal(editor.commands.undo(),true);assert.deepEqual(editor.getJSON(),continued);
  }finally{editor.destroy();}
});

test('actual formatting preview preserves detached numbering projection and renders escaped before/after settings',()=>{
  const source=fs.readFileSync(path.resolve(__dirname,'../../src/renderer/editor.js'),'utf8');
  const start=source.indexOf('function reviewSurfaceNumberingProjection('),end=source.indexOf('function reviewSurfaceNormalizeExactTextApplyState(',start);
  const ctx=vm.createContext({wordListNumbering:core,
    reviewSurfaceIsPlainObject:v=>v&&typeof v==='object'&&!Array.isArray(v),
    reviewSurfaceText:v=>typeof v==='string'?v.trim():'',reviewSurfaceArray:v=>Array.isArray(v)?v:[],
    reviewSurfaceEscapeHtml:v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))});
  vm.runInContext(source.slice(start,end),ctx);
  const expectedLevels=core.defaultLevels(2),levels=structuredClone(expectedLevels);
  levels[0].text='<img src=x onerror=evil> %1';levels[0].start=3;
  levels[1].format='a';levels[1].restartAfterLevel=null;
  const operation={operationId:'op',sceneId:'scene<1>',kind:'list-numbering',numbering:{instanceId:'list',expectedLevels,levels}};
  const normalized=ctx.reviewSurfaceNormalizeFormattingReturn({status:'ready',operations:[operation]},{});
  assert.equal(normalized.ready,true);assert.equal(normalized.operations[0].kind,'list-numbering');
  assert.deepEqual(normalized.operations[0].numbering.levels,levels);
  levels[0].text='MUTATED';assert.notEqual(normalized.operations[0].numbering.levels[0].text,'MUTATED');
  const markup=ctx.reviewSurfaceRenderNumberingChanges(normalized.operations);
  assert.match(markup,/Уровень 1: «%1\.», формат 1, начало 1, не перезапускать → «&lt;img/);
  assert.match(markup,/Уровень 2:.*после уровня 1 →.*формат a.*не перезапускать/);
  assert.match(markup,/scene&lt;1&gt;/);assert.doesNotMatch(markup,/<img|MUTATED/);
  assert.equal(ctx.reviewSurfaceRenderNumberingChanges([{sceneId:'x',numbering:{expectedLevels,levels:expectedLevels}}]),'');
  assert.equal(ctx.reviewSurfaceNumberingProjection({...operation,numbering:{expectedLevels,levels:[{evil:true}]}}),null);
  assert.match(source,/reviewSurfaceRenderNumberingChanges\(formattingReturn\.operations\)/);
});

function editorPatternLabels(editor) {
  return [...core.resolveMarkers(editor.getJSON()).values()].flatMap(value=>value.items.map(item=>item.label));
}
function editorTextPosition(editor,text) {
  let result;editor.state.doc.descendants((node,pos)=>{if(node.isText&&node.text===text)result=pos;});
  assert.equal(typeof result,'number');return result;
}

test('actual editor selection slice copy and paste preserves custom definition and Undo/Redo without claiming OS clipboard transport',async()=>{
  const levels=core.defaultLevels(2);levels[0].text='Article %1';levels[0].start=4;
  const input=core.planNumberingEdit(doc(p('Alpha'),p('separator')),{listPath:[0],action:'configure',levels});
  const {editor}=await harness(input);
  try {
    const before=editor.getJSON();
    editor.commands.setNodeSelection(0);
    const copied=editor.state.selection.content();
    editor.commands.setTextSelection(editor.state.doc.content.size-1);
    editor.view.dispatch(editor.state.tr.replaceSelection(copied).setMeta('paste',true).setMeta('uiEvent','paste'));
    assert.deepEqual(editorPatternLabels(editor),['Article 4','Article 5']);
    assert.equal(editor.state.doc.textContent,'AlphaseparatorAlpha');
    const after=editor.getJSON();assert.deepEqual(after.content.at(-1).attrs.wordNumbering,before.content[0].attrs.wordNumbering);
    assert.equal(editor.commands.undo(),true);assert.deepEqual(editor.getJSON(),before);
    assert.equal(editor.commands.redo(),true);assert.deepEqual(editor.getJSON(),after);
  }finally{editor.destroy();}
});

test('actual list item deletion and backward merge recompute custom counters and preserve exact Undo/Redo',async()=>{
  for(const action of ['delete','merge']) {
    const levels=core.defaultLevels(2);levels[0].text='Section %1)';levels[0].start=7;
    const initial=doc({type:'orderedList',content:['Alpha','Beta','Gamma'].map(text=>({type:'listItem',content:[p(text)]}))});
    const {editor}=await harness(core.planNumberingEdit(initial,{listPath:[0],action:'configure',levels}));
    try {
      const before=editor.getJSON();editor.commands.setTextSelection(editorTextPosition(editor,'Beta'));
      if(action==='delete') {
        const from=editor.state.selection.$from.before(2);
        editor.commands.setNodeSelection(from);assert.equal(editor.commands.deleteSelection(),true);
      } else assert.equal(editor.commands.joinBackward(),true);
      assert.deepEqual(editorPatternLabels(editor),['Section 7)','Section 8)']);
      assert.equal(editor.state.doc.textContent,action==='delete'?'AlphaGamma':'AlphaBetaGamma');
      assert.deepEqual(editor.getJSON().content[0].attrs.wordNumbering,before.content[0].attrs.wordNumbering);
      const after=editor.getJSON();assert.equal(editor.commands.undo(),true);assert.deepEqual(editor.getJSON(),before);
      assert.equal(editor.commands.redo(),true);assert.deepEqual(editor.getJSON(),after);
    }finally{editor.destroy();}
  }
});

test('actual overflow split refuses before publishing state and retains document selection and Undo history',async()=>{
  for(const [format,start] of [['I',3999],['a',780],['1',2147483647]]) {
    const levels=core.defaultLevels(1);Object.assign(levels[0],{format,start,text:'%1)'});
    const {editor}=await harness(core.planNumberingEdit(doc(p('Alpha')),{listPath:[0],action:'configure',levels}));
    try {
      editor.commands.setTextSelection(editorTextPosition(editor,'Alpha')+2);
      const state=editor.state,before=editor.getJSON(),selection=editor.state.selection.toJSON();
      assert.throws(()=>editor.commands.splitListItem('listItem'),/WORD_LIST_NUMBERING_INVALID/);
      assert.equal(editor.state,state);assert.deepEqual(editor.getJSON(),before);assert.deepEqual(editor.state.selection.toJSON(),selection);
      assert.equal(editor.commands.undo(),false);
      assert.equal(editorPatternLabels(editor).length,1);
    }finally{editor.destroy();}
  }
});

test('numbering clipboard event hooks restore only Core-validated descriptors onto a sanitized slice across editors',async()=>{
  const {AllSelection}=await import('@tiptap/pm/state');
  const {Slice,Fragment,DOMSerializer}=await import('@tiptap/pm/model');
  const levels=core.defaultLevels(2);levels[0].text='Item %1)';levels[0].start=4;
  const input=core.planNumberingEdit(doc({type:'orderedList',content:['Alpha','Beta'].map(text=>({type:'listItem',content:[p(text)]}))}),{listPath:[0],action:'configure',levels});
  const origin=await harness(input),destination=await harness(core.planNumberingEdit(doc(p('destination')),{listPath:[0],action:'configure',levels:core.defaultLevels(2)})),messages=[];
  try {
    const {createNumberingClipboardHandlers,NUMBERING_CLIPBOARD_MIME}=origin.ui,handlers=createNumberingClipboardHandlers(message=>messages.push(message));
    origin.editor.view.dispatch(origin.editor.state.tr.setSelection(new AllSelection(origin.editor.state.doc)));
    const data=new Map(),clipboardData={clearData:()=>data.clear(),setData:(key,value)=>data.set(key,value),getData:key=>data.get(key)||''};
    let prevented=0;const event={type:'copy',clipboardData,preventDefault:()=>prevented++};
    // Actual schema HTML output deliberately contains no private canonical identity.
    const spec=DOMSerializer.fromSchema(origin.editor.schema).nodes.orderedList(origin.editor.state.doc.firstChild);
    assert.equal(JSON.stringify(spec).includes('wordNumbering'),false);
    const view={get state(){return origin.editor.state;},editable:true,serializeForClipboard:()=>({dom:{innerHTML:'<ol start="4"><li>Alpha</li><li>Beta</li></ol>'},text:'Alpha\nBeta'}),dispatch:tr=>origin.editor.view.dispatch(tr)};
    assert.equal(handlers.handleDOMEvents.copy(view,event),true);assert.equal(prevented,1);
    assert.ok(data.get(NUMBERING_CLIPBOARD_MIME));assert.equal(messages.length,0);
    const clean=structuredClone(input);for(const node of clean.content){delete node.attrs.wordNumbering;delete node.attrs.wordListId;delete node.attrs.wordListStart;}
    const sanitized=new Slice(Fragment.fromJSON(destination.editor.schema,clean.content),0,0);
    // Copy then edit is permitted; paste is independent of source document revision.
    origin.editor.commands.setTextSelection(4);origin.editor.commands.insertContent({type:'text',text:'changed'});
    destination.editor.view.dispatch(destination.editor.state.tr.setSelection(new AllSelection(destination.editor.state.doc)));
    const before=destination.editor.getJSON(),destinationView={get state(){return destination.editor.state;},editable:true,dispatch:tr=>destination.editor.view.dispatch(tr)};
    assert.equal(handlers.handlePaste(destinationView,{clipboardData,preventDefault(){}},sanitized),true);
    assert.equal(messages.length,0);assert.deepEqual(editorPatternLabels(destination.editor),['Item 4)','Item 5)']);
    assert.notEqual(destination.editor.getJSON().content[0].attrs.wordNumbering.instanceId,input.content[0].attrs.wordNumbering.instanceId);
    const after=destination.editor.getJSON();assert.equal(destination.editor.commands.undo(),true);assert.deepEqual(destination.editor.getJSON(),before);
    assert.equal(destination.editor.commands.redo(),true);assert.deepEqual(destination.editor.getJSON(),after);
    for(const invalid of ['{','x'.repeat(65537),JSON.stringify({schemaVersion:'yalken.numbering-clipboard.v1',path:'/tmp/authority'})]) {
      data.set(NUMBERING_CLIPBOARD_MIME,invalid);const state=destination.editor.state;
      assert.equal(handlers.handlePaste(destinationView,{clipboardData,preventDefault(){}},sanitized),true);assert.equal(destination.editor.state,state);
    }
    assert.equal(messages.length,3);
    assert.equal(handlers.handlePaste(destinationView,{shiftKey:true,clipboardData,preventDefault(){}},sanitized),false);
    data.clear();assert.equal(handlers.handlePaste(destinationView,{clipboardData,preventDefault(){}},sanitized),false);
    // Carrier preparation failure cannot turn Cut into a destructive plain-text fallback.
    origin.editor.commands.setTextSelection({from:4,to:editorTextPosition(origin.editor,'Beta')+2});const state=origin.editor.state;
    assert.equal(handlers.handleDOMEvents.cut(view,{...event,type:'cut'}),true);assert.equal(origin.editor.state,state);assert.equal(messages.length,4);
  }finally{origin.editor.destroy();destination.editor.destroy();}
});

test('numbered Cut publishes checked carrier before deletion and retains exact Undo on success or clipboard failure',async()=>{
  const {AllSelection}=await import('@tiptap/pm/state');
  for(const failedWrite of [false,true]) {
    const levels=core.defaultLevels(1);levels[0].text='Item %1)';
    const {editor,ui}=await harness(core.planNumberingEdit(doc(p('Alpha')),{listPath:[0],action:'configure',levels}));
    const notices=[],data=new Map();
    try {
      editor.view.dispatch(editor.state.tr.setSelection(new AllSelection(editor.state.doc)));
      const before=editor.getJSON(),state=editor.state;
      const handlers=ui.createNumberingClipboardHandlers(message=>notices.push(message));
      const view={get state(){return editor.state;},editable:true,serializeForClipboard:()=>({dom:{innerHTML:'<ol><li>Alpha</li></ol>'},text:'Alpha'}),dispatch:tr=>editor.view.dispatch(tr)};
      const clipboardData={clearData:()=>data.clear(),setData:(k,v)=>{if(failedWrite&&k===ui.NUMBERING_CLIPBOARD_MIME)throw Error('write');data.set(k,v);},getData:k=>data.get(k)||''};
      assert.equal(handlers.handleDOMEvents.cut(view,{type:'cut',clipboardData,preventDefault(){}}),true);
      if(failedWrite){assert.equal(editor.state,state);assert.equal(notices.length,1);}
      else {assert.equal(notices.length,0);assert.ok(data.get(ui.NUMBERING_CLIPBOARD_MIME));assert.equal(editor.state.doc.textContent,'');assert.equal(editor.commands.undo(),true);assert.deepEqual(editor.getJSON(),before);}
    }finally{editor.destroy();}
  }
});

test('actual ProseMirror clipboard context cannot bypass numbering identity validation without MIME or through plain-paste fallback',async()=>{
  const pmModel=await import('@tiptap/pm/model');
  const source=fs.readFileSync(require.resolve('prosemirror-view'),'utf8');
  const from=source.indexOf('function addContext(slice, context) {'),to=source.indexOf('\nvar handlers =',from);
  assert.ok(from>=0&&to>from);
  // Execute the actual installed parser helper in this realm: it reconstructs
  // context attrs with type.create and never invokes the schema parseHTML hook.
  const addContext=new Function('prosemirrorModel',`${source.slice(from,to)};return addContext;`)(pmModel);
  const levels=core.defaultLevels(1);levels[0].text='Item %1)';
  const input=core.planNumberingEdit(doc(p('Existing')),{listPath:[0],action:'configure',levels});
  const {editor,ui}=await harness(input),notices=[];
  try {
    const handlers=ui.createNumberingClipboardHandlers(message=>notices.push(message));
    const item=editor.schema.nodeFromJSON({type:'listItem',content:[p('Untrusted')]});
    const bare=new pmModel.Slice(pmModel.Fragment.from(item),0,0);
    for(const attrs of [{wordNumbering:input.content[0].attrs.wordNumbering},{wordListId:'legacy',wordListStart:3}]) {
      const forged=addContext(bare,JSON.stringify(['orderedList',{start:1,...attrs}]));
      assert.equal(forged.openStart,1);assert.deepEqual(forged.content.firstChild.attrs.wordNumbering??forged.content.firstChild.attrs.wordListId,attrs.wordNumbering??attrs.wordListId);
      for(const shiftKey of [false,true]) {
        let prevented=false;const state=editor.state;
        assert.equal(handlers.handlePaste({state,editable:true,dispatch:()=>assert.fail('forged slice dispatched')},{shiftKey,clipboardData:{getData:()=>''},preventDefault(){prevented=true;}},forged),true);
        assert.equal(prevented,true);assert.equal(editor.state,state);
      }
    }
    assert.equal(notices.length,4);
    const clean=new pmModel.Slice(pmModel.Fragment.from(editor.schema.nodeFromJSON(p('ordinary text'))),0,0);
    assert.equal(handlers.handlePaste({state:editor.state},{clipboardData:{getData:()=>''}},clean),false);
  }finally{editor.destroy();}
});
