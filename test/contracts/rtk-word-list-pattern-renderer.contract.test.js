'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const core = require('../../src/core/word-list-numbering-v1.cjs');
const p = text => ({type:'paragraph',content:[{type:'text',text}]});
const doc = (...content) => ({type:'doc',content});
let projectNumberingJSON;
async function harness(content, extraExtensions = []) {
  const [{Editor}, {default:StarterKit}, ui] = await Promise.all([import('@tiptap/core'),import('@tiptap/starter-kit'),import('../../src/renderer/tiptap/documentListNumbering.mjs')]);
  projectNumberingJSON=ui.numberingDocumentJSON;
  const editor = new Editor({element:null,extensions:[StarterKit.configure({trailingNode:false}),ui.DocumentListNumbering,...extraExtensions],content});
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
    assert.equal(editor.commands.sinkListItem('listItem'),true);assert.deepEqual(labels(),['(1)','1.1.']);assert.deepEqual(cachedNumberingLabels(editor),['(1)','1.1.']);
    const nested=editor.getJSON();assert.equal(nested.content[0].content[0].content[1].attrs.wordNumbering.level,1);
    assert.equal(editor.commands.undo(),true);assert.deepEqual(editor.getJSON(),before);
    assert.equal(editor.commands.redo(),true);assert.deepEqual(labels(),['(1)','1.1.']);assert.deepEqual(cachedNumberingLabels(editor),['(1)','1.1.']);
    editor.commands.setTextSelection(position('Beta')+2);assert.equal(editor.commands.splitListItem('listItem'),true);
    assert.deepEqual(labels(),['(1)','1.1.','1.2.']);assert.deepEqual(cachedNumberingLabels(editor),['(1)','1.1.','1.2.']);
    assert.equal(editor.commands.liftListItem('listItem'),true);
    assert.deepEqual(labels(),['(1)','1.1.','(2)']);assert.deepEqual(cachedNumberingLabels(editor),['(1)','1.1.','(2)']);
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
  for(const scenario of ['cancel','stale','capability','refused','noop','apply']) {
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
        preview:()=>['1.'],apply:input=>{if(scenario==='noop')return {performed:false,reason:'NO_OP'};if(scenario==='refused')return {performed:false,reason:'REFUSED'};applied.push(input);return {performed:true};}})});
    const start=source.indexOf('let activeNumberingDialog = null;'),end=source.indexOf('function dispatchListTypeAction(',start);
    vm.runInContext(source.slice(start,end),ctx);const pending=ctx.handleNumberingSettings();
    const dialog=nodes.find(node=>node.tagName==='DIALOG'),template=nodes.find(node=>node.id==='numbering-template');
    assert.equal(dialog.open,true);assert.equal(focused,template);assert.equal(template.attrs['aria-describedby'],'numbering-template-hint numbering-error');
    template.value='Article %1';if(scenario==='stale')ctx.currentDocumentId='other';
    if(scenario!=='cancel')nodes.find(node=>node.textContent==='Применить').events.click();
    if(scenario!=='apply'){
      assert.equal(applied.length,0);assert.equal(dialog.open,true);assert.equal(template.value,'Article %1');
      if(scenario==='noop'){assert.equal(nodes.find(node=>node.id==='numbering-error').textContent,'Уже используется выбранная нумерация.');assert.notEqual(template.attrs['aria-invalid'],'true');}
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
  const ctx=vm.createContext({wordListNumbering:core,wordParagraphLayout:require('../../src/core/word-paragraph-layout-v1.cjs'),
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
  const overrideOperation={...operation,numbering:{instanceId:'list',expectedLevels,levels:expectedLevels,instanceOverrides:[{instanceId:'list',expectedStartOverrides:[{level:0,start:4}],startOverrides:[]}]}};
  const overridePreview=ctx.reviewSurfaceNormalizeFormattingReturn({status:'ready',operations:[overrideOperation]},{});
  assert.deepEqual(overridePreview.operations[0].numbering.instanceOverrides,overrideOperation.numbering.instanceOverrides);
  const overrideMarkup=ctx.reviewSurfaceRenderNumberingChanges(overridePreview.operations);
  assert.match(overrideMarkup,/Список 1, уровень 1: начало 4 → по настройке уровня \(1\)/);
  overrideOperation.numbering.instanceOverrides[0].expectedStartOverrides[0].start=99;
  assert.equal(overridePreview.operations[0].numbering.instanceOverrides[0].expectedStartOverrides[0].start,4);
  assert.equal(ctx.reviewSurfaceNumberingProjection({...operation,numbering:{...operation.numbering,instanceOverrides:[{instanceId:'list',expectedStartOverrides:[],startOverrides:[{level:9,start:1}]}]}}),null);
  const compositeMarkup=ctx.reviewSurfaceRenderCompositeNumberingChanges(overridePreview.operations);
  assert.match(compositeMarkup,/Все показанные текстовые изменения и параметры применяются вместе/);
  assert.match(compositeMarkup,/начало 4 → по настройке уровня/);
  assert.equal(ctx.reviewSurfaceRenderCompositeNumberingChanges([]),'');
  assert.match(ctx.reviewSurfaceRenderCompositeNumberingChanges([],[{kind:'document-properties',document:{wordDefaultTabStop:{action:'set',value:708}}}]),/Шаг табуляции: по умолчанию → 35.4 пт/);
  assert.match(source,/reviewSurfaceRenderCompositeNumberingChanges\(exactPreview.numberingChanges, exactPreview.documentChanges\)/);
  const viewStart=source.indexOf('function reviewSurfaceBuildExactTextPreview('),viewEnd=source.indexOf('function buildReviewSurfaceViewModel(',viewStart);
  const viewSource=source.slice(viewStart,viewEnd);
  for(const name of new Set(viewSource.match(/REVIEW_SURFACE_[A-Z_]+/g)))ctx[name]=name.endsWith('MAX_CHANGE_IDS')?64:name;
  Object.assign(ctx,{reviewSurfaceNormalizeExactTextApplyState:()=>null,reviewSurfaceBuildBoundedDisplayDiff:()=>[],reviewSurfacePresentExactApplyState:state=>state});
  vm.runInContext(viewSource,ctx);
  for(const count of [1,2]){
    const model=ctx.reviewSurfaceBuildExactTextPreview({exactTextPlanPreview:{status:'ready',plan:{numberingChanges:overridePreview.operations,applyOps:Array.from({length:count},(_,i)=>({changeId:'change-'+i,sceneId:'scene',expectedText:'before',replacementText:'after'}))}}});
    assert.equal(model.numberingChanges.length,1);assert.equal(model.ops[0].applyDisabled,count>1);
    if(count>1)assert.equal(model.batchAction.applyDisabled,false);
  }
  const gridPreview=ctx.reviewSurfaceNormalizeFormattingReturn({status:'ready',operations:[{operationId:'grid',sceneId:'scene<grid>',kind:'section-doc-grid'}]},{});
  assert.equal(gridPreview.ready,true);
  const gridMarkup=ctx.reviewSurfaceRenderNumberingChanges(gridPreview.operations);
  assert.match(gridMarkup,/Параметры раздела Word/);assert.match(gridMarkup,/отключённой сетки/);
  assert.match(gridMarkup,/scene&lt;grid&gt;/);
  assert.match(source,/reviewSurfaceRenderNumberingChanges\(formattingReturn\.operations\)/);
});

function editorPatternLabels(editor) {
  return [...core.resolveMarkers(projectNumberingJSON(editor.state.doc)).values()].flatMap(value=>value.items.map(item=>item.label));
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

test('captured settings Restart then Continue clears only selected reset and Undo/Redo restores 10 and 11',async()=>{
  const levels=core.defaultLevels(1);levels[0].text='Clause %1';levels[0].start=9;
  const pattern={schemaVersion:1,instanceId:'original',lineageId:'shared',level:0,levels};
  const list=text=>({type:'orderedList',attrs:{start:9,wordNumbering:structuredClone(pattern)},content:[{type:'listItem',content:[p(text)]}]});
  const {editor,ui}=await harness(doc(list('earlier'),p('gap'),list('selected'),p('gap2'),list('later')));
  try {
    assert.deepEqual(editorPatternLabels(editor),['Clause 9','Clause 10','Clause 11']);
    editor.commands.setTextSelection(editorTextPosition(editor,'selected'));
    const target=ui.captureNumberingTarget(editor),restartLevels=structuredClone(target.levels);restartLevels[0].start=3;
    assert.equal(target.apply({action:'restart',levels:restartLevels}).performed,true);
    assert.deepEqual(editorPatternLabels(editor),['Clause 9','Clause 3','Clause 4']);
    const restarted=editor.getJSON(),next=ui.captureNumberingTarget(editor);
    assert.deepEqual(next.preview({action:'continue',instanceId:'original'}),['Clause 10']);
    assert.equal(next.apply({action:'continue',instanceId:'original'}).performed,true);
    assert.deepEqual(editorPatternLabels(editor),['Clause 9','Clause 10','Clause 11']);
    const continued=editor.getJSON();assert.equal(editor.commands.undo(),true);assert.deepEqual(editor.getJSON(),restarted);
    assert.equal(editor.commands.redo(),true);assert.deepEqual(editor.getJSON(),continued);
    assert.equal(editor.state.doc.textContent,'earliergapselectedgap2later');
  }finally{editor.destroy();}
});

test('actual table editor omits only trusted undefined schema defaults and preserves nested numbering through edits envelope serialization and export',async()=>{
  const {DocumentTables}=await import('../../src/renderer/tiptap/documentTables.mjs');
  const envelope=require('../../src/core/document-content-envelope-v1.cjs');
  const levels=core.defaultLevels(2);levels[0].start=3;levels[0].text='Table %1';levels[1].format='a';levels[1].text='%1.%2.';
  const pattern=level=>({schemaVersion:1,instanceId:'word-numbering-7',lineageId:'word-numbering-lineage-4',level,levels});
  const nested={type:'orderedList',attrs:{start:1,type:'a',wordNumbering:pattern(1)},content:['child A','child B'].map(text=>({type:'listItem',content:[p(text)]}))};
  const list={type:'orderedList',attrs:{start:3,wordNumbering:pattern(0)},content:[{type:'listItem',content:[p('root'),nested]}]};
  const [docxPageSetupBindModule,semanticMappingModule,styleMapModule,bridge]=await Promise.all([import('../../src/docxPageSetupBind.mjs'),import('../../src/derived/semanticMapping.mjs'),import('../../src/derived/styleMap.mjs'),import('../../src/io/revisionBridge/index.mjs')]);
  for(const explicit of [false,true]) {
    const table={type:'table',...(explicit?{attrs:{wordTable:{version:1,borders:{},grid:[4320],layout:null,shading:null,widthDxa:4320}}}:{}),content:[{type:'tableRow',content:[{type:'tableCell',attrs:{colspan:1,rowspan:1,colwidth:null},content:[list]}]}]};
    const {editor,ui}=await harness(doc(table),[DocumentTables]);
    try {
      assert.deepEqual(editorPatternLabels(editor),['Table 3','3.a.','3.b.']);
      const before=editor.getJSON();assert.equal(before.content[0].content[0].content[0].attrs.wordCell,undefined);
      if(!explicit)assert.equal(before.content[0].attrs.wordTable,undefined);
      editor.commands.setTextSelection(editorTextPosition(editor,'root'));
      const target=ui.captureNumberingTarget(editor),changed=structuredClone(target.levels);changed[0].text='Cell %1';
      assert.equal(target.apply({action:'configure',levels:changed}).performed,true);
      assert.deepEqual(editorPatternLabels(editor),['Cell 3','3.a.','3.b.']);
      const after=editor.getJSON();assert.equal(editor.commands.undo(),true);
      // The imported decimal list omits type; the existing normalizer makes its
      // derived format explicit on the first authoring transaction, including Undo.
      const normalizedBefore=JSON.parse(JSON.stringify(before));normalizedBefore.content[0].content[0].content[0].content[0].attrs.type='1';
      assert.deepEqual(JSON.parse(JSON.stringify(editor.getJSON())),normalizedBefore);
      assert.equal(editor.commands.redo(),true);assert.deepEqual(editor.getJSON(),after);
      const reopened=envelope.parseObservablePayload(envelope.composeObservablePayload({doc:ui.numberingDocumentJSON(editor.state.doc)}));assert.equal(reopened.issue,null);
      if(explicit){assert.deepEqual(after.content[0].attrs.wordTable,before.content[0].attrs.wordTable);assert.deepEqual(reopened.doc.content[0].attrs.wordTable,before.content[0].attrs.wordTable);}
      assert.deepEqual([...core.resolveMarkers(reopened.doc).values()].flatMap(x=>x.items.map(i=>i.label)),['Cell 3','3.a.','3.b.']);
      const bytes=require('../../src/export/docx/docxMinBuilder.js').buildDocxMinBuffer({doc:reopened.doc,bookProfile:{formatId:'A4'}},{docxPageSetupBindModule,semanticMappingModule,styleMapModule});
      const preview=bridge.buildDocxContentPreviewFromZipBytes(bytes);assert.equal(preview.ok,true,JSON.stringify(preview));
      const plan=bridge.buildDocxImportPreviewPlanFromContentPreview(preview);assert.equal(plan.ok,true,JSON.stringify(plan));
      const imported=envelope.parseObservablePayload(plan.candidateCreatePlan.entries[0].content);assert.equal(imported.issue,null);
      assert.equal(imported.doc.content[0].type,'table');
      assert.deepEqual([...core.resolveMarkers(imported.doc).values()].flatMap(x=>x.items.map(i=>i.label)),['Cell 3','3.a.','3.b.']);
      assert.equal(editor.state.doc.textContent,'rootchild Achild B');
    }finally{editor.destroy();}
  }
});

test('trusted schema projection handles ordinary and numbered images but never weakens external undefined or accessor rejection',async()=>{
  const {DocumentMedia}=await import('../../src/renderer/tiptap/documentMedia.mjs');
  for(const explicit of [false,true])for(const numbered of [false,true]) {
    const image={type:'image',attrs:{assetId:'owned',assetPath:'assets/owned.png',sha256:'a'.repeat(64),mimeType:'image/png',width:1,height:1,alt:'pixel',displayName:'pixel',dataBase64:'AAAA',...(explicit?{wordUseLocalDpi:false,displayWidthEmu:9525,displayHeightEmu:9525,displayEffectExtent:{l:0,r:0,t:0,b:0}}:{})}};
    let input=doc({type:'paragraph',content:[{type:'text',text:'Image'},image]});
    if(numbered)input=core.planNumberingEdit(input,{listPath:[0],action:'configure',levels:core.defaultLevels(1)});
    const {editor,ui}=await harness(input,[DocumentMedia]);
    try {
      const raw=editor.getJSON(),projected=ui.numberingDocumentJSON(editor.state.doc);
      if(!explicit)assert.throws(()=>core.normalizeAuthoring(raw),/WORD_LIST_NUMBERING_INVALID/);
      assert.doesNotThrow(()=>core.normalizeAuthoring(projected));
      let liveImage;editor.state.doc.descendants(node=>{if(node.type.name==='image')liveImage=node;});
      assert.equal(Object.hasOwn(liveImage.attrs,'displayWidthEmu'),true);
      const projectedImage=numbered?projected.content[0].content[0].content[0].content[1]:projected.content[0].content[1];
      if(explicit)for(const key of ['wordUseLocalDpi','displayWidthEmu','displayHeightEmu','displayEffectExtent'])assert.deepEqual(projectedImage.attrs[key],image.attrs[key]);
      else assert.equal(Object.hasOwn(projectedImage.attrs,'displayWidthEmu'),false);
      const target=ui.captureNumberingTarget(editor);assert.ok(target);assert.ok(target.preview({action:'configure',levels:core.defaultLevels(1)}).length);
      editor.commands.setTextSelection(editorTextPosition(editor,'Image')+2);editor.commands.insertContent({type:'text',text:'x'});
      assert.doesNotThrow(()=>core.normalizeAuthoring(ui.numberingDocumentJSON(editor.state.doc)));
    }finally{editor.destroy();}
  }
  const {editor,ui}=await harness(doc(p('Safe')));
  try {
    let reads=0;
    const fake={type:{spec:{attrs:{optional:{default:undefined}}}},marks:[],forEach(){},toJSON(){const attrs={optional:undefined,unknown:undefined};Object.defineProperty(attrs,'trap',{enumerable:true,get(){reads++;return 1;}});return {type:'paragraph',attrs};}};
    const projected=ui.numberingDocumentJSON(fake);assert.equal(reads,0);assert.equal(Object.hasOwn(projected.attrs,'optional'),false);assert.equal(Object.hasOwn(projected.attrs,'unknown'),true);
    assert.throws(()=>core.normalizeAuthoring({type:'doc',content:[projected]}),/WORD_LIST_NUMBERING_INVALID/);assert.equal(reads,0);
  }finally{editor.destroy();}
});

test('actual checked scene replacement preserves imported skipped levels despite blank or colliding previous scene identities',async()=>{
  const {WordPendingRevisions,setCheckedDocument}=await import('../../src/renderer/tiptap/wordPendingRevisions.mjs');
  const {closeHistory}=await import('@tiptap/pm/history');
  const levels=core.defaultLevels(3);levels[0].start=3;levels[1].format='a';levels[1].text='%1.%2';levels[2].text='%3';levels[2].restartAfterLevel=0;
  const pattern=level=>({schemaVersion:1,instanceId:'shared-import-id',lineageId:'shared-import-lineage',level,levels});
  const child=level=>({type:'orderedList',attrs:{start:1,type:levels[level].format,wordNumbering:pattern(level)},content:[{type:'listItem',content:[p('child')]}]});
  const make=level=>doc({type:'orderedList',attrs:{start:3,type:'1',wordNumbering:pattern(0)},content:[{type:'listItem',content:[p('parent'),child(level)]}]});
  for(const before of [doc(p('blank')),make(1)]) {
    const {editor,ui}=await harness(before,[WordPendingRevisions]);
    try {
      let updates=0;editor.on('update',()=>updates++);
      const incoming=make(2),snapshot=JSON.stringify(incoming);
      assert.equal(setCheckedDocument(editor,incoming),true);
      assert.equal(JSON.stringify(incoming),snapshot);assert.equal(updates,0);
      const json=ui.numberingDocumentJSON(editor.state.doc);
      assert.equal(json.content[0].content[0].content[1].attrs.wordNumbering.level,2);
      assert.deepEqual(editorPatternLabels(editor),['3.','1']);
      const loaded=editor.getJSON();
      // The same live editor still performs genuine authoring reparenting.
      // Separate the user action from the synchronously loaded fixture's history event.
      editor.view.dispatch(closeHistory(editor.state.tr));
      editor.commands.setTextSelection(editorTextPosition(editor,'child'));
      assert.equal(editor.commands.liftListItem('listItem'),true);
      assert.deepEqual(editorPatternLabels(editor),['3.','4.']);
      assert.equal(editor.commands.undo(),true);
      assert.equal(ui.numberingDocumentJSON(editor.state.doc).content[0].content[0].content[1].attrs.wordNumbering.level,2);
      assert.deepEqual(editorPatternLabels(editor),['3.','1']);
      assert.deepEqual(editor.getJSON(),loaded);
      assert.equal(editor.commands.redo(),true);assert.deepEqual(editorPatternLabels(editor),['3.','4.']);
    }finally{editor.destroy();}
  }
});

async function scenePublicationHarness(extraExtensions = []) {
  const [pending,sections,stories,bookmarks,{history,closeHistory}]=await Promise.all([
    import('../../src/renderer/tiptap/wordPendingRevisions.mjs'),import('../../src/renderer/tiptap/documentSections.mjs'),
    import('../../src/renderer/tiptap/documentStories.mjs'),import('../../src/renderer/tiptap/userBookmarks.mjs'),import('@tiptap/pm/history')]);
  const {editor}=await harness(doc(p('Scene A')),[pending.WordPendingRevisions,sections.DocumentSections,stories.DocumentStories,bookmarks.UserBookmarks,...extraExtensions]);
  const source=fs.readFileSync(path.resolve(__dirname,'../../src/renderer/tiptap/index.js'),'utf8');
  const code=source.slice(source.indexOf('function setCheckedDocument(editor, doc) {'),source.indexOf('export function applyTiptapUserBookmarkPublication'))
    +source.slice(source.indexOf('export function setTiptapDocumentSnapshot('),source.indexOf('// A dialog owns only')).replace('export ','');
  const context=vm.createContext({currentEditorInstance:editor,history,setCheckedReviewDocument:pending.setCheckedDocument,wordListNumbering:core,numberingDocumentJSON:projectNumberingJSON,
    wordSections:require('../../src/core/word-sections-v1.cjs'),wordStories:require('../../src/core/word-stories-projection-v1.cjs'),notifyFormattingStateChange(){}});
  vm.runInContext(code,context);
  return {editor,context,closeHistory};
}

test('actual scene publication resets foreign history only on identity switch and restores failed publication atomically',async()=>{
  const {editor,context,closeHistory}=await scenePublicationHarness();
  try {
    editor.commands.setTextSelection(3);editor.commands.insertContent({type:'text',text:'edited'});
    assert.equal(context.setTiptapDocumentSnapshot({doc:doc(p('Scene B')),resetHistory:true}),true);
    assert.equal(editor.commands.undo(),false);assert.equal(editor.state.doc.textContent,'Scene B');
    editor.commands.setTextSelection(3);editor.commands.insertContent({type:'text',text:'edited'});
    assert.equal(editor.commands.undo(),true);assert.equal(editor.state.doc.textContent,'Scene B');
    editor.view.dispatch(closeHistory(editor.state.tr));
    assert.equal(context.setTiptapDocumentSnapshot({doc:doc(p('Scene B publication')),resetHistory:false}),true);
    assert.equal(editor.commands.undo(),true);assert.equal(editor.state.doc.textContent,'Scene B');
    const {Plugin}=await import('@tiptap/pm/state');
    const originalPlugins=editor.state.plugins;
    editor.view.updateState(editor.state.reconfigure({plugins:[...originalPlugins,new Plugin({filterTransaction:tr=>!tr.docChanged})]}));
    const rejected=editor.state;
    assert.equal(context.setTiptapDocumentSnapshot({doc:doc(p('Silently rejected')),resetHistory:true}),false);
    assert.equal(editor.state,rejected);
    editor.view.updateState(editor.state.reconfigure({plugins:originalPlugins}));
    const state=editor.state;
    assert.equal(context.setTiptapDocumentSnapshot({doc:{...doc(p('Invalid')),attrs:{wordSections:{bad:true}}},resetHistory:true}),false);
    assert.equal(editor.state,state);
    // A failure after the first setContent also restores the original history and document.
    const real=context.setCheckedReviewDocument;
    context.setCheckedReviewDocument=(...args)=>{real(...args);throw Error('post-content failure');};
    assert.equal(context.setTiptapDocumentSnapshot({doc:doc(p('Partial')),resetHistory:true}),false);assert.equal(editor.state,state);
  }finally{editor.destroy();}
});

test('actual active-scene caller publishes before identity commit including same-id project switch and failed load',async()=>{
  const source=fs.readFileSync(path.resolve(__dirname,'../../src/renderer/editor.js'),'utf8');
  const start=source.indexOf('    // Publish before committing the active identity.'),end=source.indexOf('    if (hasBookProfile) {',start);
  assert.ok(start>=0&&end>start);
  const body=source.slice(start,end);
  const invalidateStart=source.indexOf('function invalidateDocxImportAttempt()'),invalidateEnd=source.indexOf('function isCurrentDocxImportAttempt(',invalidateStart);
  assert.ok(invalidateStart>=0&&invalidateEnd>invalidateStart);
  const invalidator=source.slice(invalidateStart,invalidateEnd);
  for(const scenario of ['scene','project','same','failure','tree']) {
    const {editor,context}=await scenePublicationHarness();
    try {
      const calls=[],notices=[],closed=[],attempt={requestId:'existing'},preview={source:'existing'},plan={ok:true},modal={};
      const ctx=vm.createContext({pendingDocxImportAttempt:attempt,pendingDocxImportPreviewValue:preview,pendingDocxImportPreviewPlan:plan,
        docxImportPreviewModal:modal,closeSimpleModal:value=>closed.push(value),treeContentParsed:scenario==='tree'?{doc:doc(p('Tree already published'))}:null,
        parseDocumentContent:()=>({doc:doc(p('Scene B'))}),content:'irrelevant',shouldUseCentralSheetLargePayloadFastPath:()=>false,
        hasDocumentId:true,documentId:scenario==='scene'?'B':'A',hasKind:true,hasProjectId:true,
        projectId:scenario==='project'?'other':'project',currentDocumentId:'A',currentProjectId:'project',normalizeProjectId:x=>x,
        isTiptapMode:true,setTiptapDocumentSnapshot:input=>{calls.push(input);return scenario==='failure'?false:context.setTiptapDocumentSnapshot(input);},
        updateStatusText:message=>notices.push(message),clearFlowModeState(){},clearPendingMetadataUpdate(){},
        nextMetaEnabled:false,kind:'scene',createNavigatorSelectionState:()=>({}),restoreSpatialLayoutState(){},adoptToolbarConfiguratorState(){}});
      const before=editor.state;vm.runInContext(`${invalidator}
function incoming(){${body}};incoming();`,ctx);
      if(scenario==='project'){assert.equal(ctx.pendingDocxImportAttempt,null);assert.equal(ctx.pendingDocxImportPreviewValue,null);assert.equal(ctx.pendingDocxImportPreviewPlan,null);assert.deepEqual(closed,[modal]);}
      else {assert.equal(ctx.pendingDocxImportAttempt,attempt);assert.equal(ctx.pendingDocxImportPreviewValue,preview);assert.equal(ctx.pendingDocxImportPreviewPlan,plan);assert.equal(closed.length,0);}
      if(scenario==='failure'){assert.equal(ctx.currentDocumentId,'A');assert.equal(ctx.currentProjectId,'project');assert.equal(editor.state,before);assert.equal(notices.length,1);}
      else if(scenario==='tree'){assert.equal(calls.length,0);assert.equal(editor.state,before);}
      else {assert.equal(calls[0].resetHistory,scenario!=='same');assert.equal(ctx.currentDocumentId,scenario==='scene'?'B':'A');assert.equal(ctx.currentProjectId,scenario==='project'?'other':'project');assert.equal(editor.state.doc.textContent,'Scene B');}
    }finally{editor.destroy();}
  }
});

function cachedNumberingLabels(editor) {
  const labels=[];
  for(const plugin of editor.state.plugins) {
    const decorations=plugin.props.decorations?.call(plugin,editor.state);
    if(decorations?.find)labels.push(...decorations.find().filter(value=>value.type.attrs?.['data-word-marker']));
  }
  return labels.sort((a,b)=>a.from-b.from).map(value=>value.type.attrs['data-word-marker']);
}

function ancestryCollisionDocument() {
  const levels=core.defaultLevels(3);levels[0].start=3;levels[1].format='a';levels[1].text='%1.%2.';levels[2].text='%3';levels[2].restartAfterLevel=0;
  const item=(n,...nested)=>({type:'listItem',content:[p('Item '+n),...nested]});
  const list=(level,...content)=>({type:'orderedList',attrs:{start:level?1:3,type:levels[level].format,wordNumbering:{schemaVersion:1,instanceId:'shared',lineageId:'lineage',level,levels}},content});
  return core.normalize(doc(list(0,item(1,list(1,item(2,list(2,item(3),item(4))),item(5,list(2,item(6))))),item(7,list(2,item(8))))));
}
function orderedItemLevels(editor) {
  const levels=[];const walk=node=>{for(const child of node.content||[]){if(node.type==='orderedList')levels.push(node.attrs.wordNumbering.level);walk(child);}};walk(editor.getJSON());return levels;
}

test('per-occurrence transaction provenance lifts item two without changing unrelated skipped levels and Undo/Redo are exact',async()=>{
  const {DocumentTables}=await import('../../src/renderer/tiptap/documentTables.mjs'),{DocumentMedia}=await import('../../src/renderer/tiptap/documentMedia.mjs');
  const input=ancestryCollisionDocument();
  input.content.push({type:'table',content:[{type:'tableRow',content:[{type:'tableCell',content:[p('unrelated cell')]}]}]});
  input.content.push({type:'paragraph',content:[{type:'image',attrs:{assetId:'owned',mimeType:'image/png',width:1,height:1,dataBase64:'AAAA'}}]});
  const {editor}=await harness(input,[DocumentTables,DocumentMedia]);
  try {
    const before=editor.getJSON();
    const initialLabels=['3.','3.a.','1','2','3.b.','3','4.','1'];
    const liftedLabels=['3.','4.','4.a.','4.b.','4.c.','1','5.','1'];
    assert.deepEqual(cachedNumberingLabels(editor),initialLabels);
    editor.commands.setTextSelection(editorTextPosition(editor,'Item 2'));
    assert.equal(editor.commands.liftListItem('listItem'),true);
    assert.deepEqual(orderedItemLevels(editor),[0,0,1,1,1,2,0,2]);
    assert.deepEqual(cachedNumberingLabels(editor),liftedLabels);
    const after=editor.getJSON();assert.deepEqual(after.content.slice(1),before.content.slice(1));
    assert.equal(editor.commands.undo(),true);assert.deepEqual(editor.getJSON(),before);assert.deepEqual(cachedNumberingLabels(editor),initialLabels);
    assert.equal(editor.commands.redo(),true);assert.deepEqual(editor.getJSON(),after);assert.deepEqual(cachedNumberingLabels(editor),liftedLabels);
  }finally{editor.destroy();}
});

test('composed transaction mappings bind paragraph occurrences after unrelated insertion and lift, without text identity',async()=>{
  const {Mapping}=await import('@tiptap/pm/transform');
  const {EditorState,TextSelection}=await import('@tiptap/pm/state');const {liftListItem}=await import('@tiptap/pm/schema-list');
  const {editor,ui}=await harness(ancestryCollisionDocument());
  try {
    const before=editor.state.doc;let state=EditorState.create({schema:editor.schema,doc:before}),transactions=[];
    const insert=state.tr.insert(0,editor.schema.nodeFromJSON(p('Item 2')));transactions.push(insert);state=state.apply(insert);
    let selected;state.doc.descendants((node,pos)=>{if(node.isText&&node.text==='Item 2'&&pos>10)selected=pos;});
    state=state.apply(state.tr.setSelection(TextSelection.create(state.doc,selected)));
    assert.equal(liftListItem(editor.schema.nodes.listItem)(state,tr=>{transactions.push(tr);state=state.apply(tr);}),true);
    const mapping=new Mapping();transactions.forEach(tr=>mapping.appendMapping(tr.mapping));
    const provenance=ui.numberingParagraphProvenance(before,state.doc,mapping);assert.equal(provenance.paragraphs.length,8);
    const next=core.normalizeAuthoring(ui.numberingDocumentJSON(state.doc),ui.numberingDocumentJSON(before),provenance);
    const result=[];const walk=node=>{for(const child of node.content||[]){if(node.type==='orderedList')result.push(node.attrs.wordNumbering.level);walk(child);}};walk(next);
    assert.deepEqual(result,[0,0,1,1,1,2,0,2]);assert.equal(next.content[0].content[0].text,'Item 2');
    assert.equal(before.childCount,1);
  }finally{editor.destroy();}
});

test('mapped authoring preserves unrelated skipped occurrences on prefix insertion and refused first-item sink',async()=>{
  const {editor}=await harness(ancestryCollisionDocument());
  try {
    const expected=orderedItemLevels(editor),before=editor.getJSON();
    editor.commands.setTextSelection(editorTextPosition(editor,'Item 1'));
    // Root lift is a real unlist operation; unavailable sinking of the first
    // item is the no-op boundary and must not fabricate a mapping repair.
    assert.equal(editor.commands.sinkListItem('listItem'),false);assert.deepEqual(editor.getJSON(),before);
    assert.equal(editor.commands.insertContentAt(0,p('unrelated')),true);
    assert.deepEqual(orderedItemLevels(editor),expected);
    assert.equal(editor.commands.undo(),true);assert.deepEqual(editor.getJSON(),before);
  }finally{editor.destroy();}
});

test('actual status callback reveals bounded Word return codes and keeps hostile or unrelated statuses hidden',()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../../src/renderer/editor.js'),'utf8');
 const start=source.indexOf('  window.electronAPI.onStatusUpdate((status) => {'),end=source.indexOf('  window.electronAPI.onSetDirty(',start);
 assert.ok(start>=0&&end>start);let callback;const updates=[],warnings=[];let notes=0;
 const context=vm.createContext({window:{electronAPI:{onStatusUpdate:fn=>{callback=fn;}}},currentProjectId:'project',
  refreshManuscriptNoteReferences:()=>{notes++;},refreshNotesWorkspace:()=>{notes++;},
  updateStatusText:(text,options)=>updates.push({text,visible:options?.visible}),updateWarningStateText:value=>warnings.push(value),updatePerfHintText(){},updateInspectorSnapshot(){}});
 vm.runInContext(source.slice(start,end),context);assert.equal(typeof callback,'function');
 const visible=[
  'Не удалось открыть возврат Word (E_DOCX_REVIEW_PREVIEW_SESSION_FAILED).',
  'Не удалось открыть возврат Word (E_DOCX_REVIEW_PREVIEW_SESSION_RETURN_INTAKE_BLOCKED: RTK_RETURN_INTAKE_DOCUMENT_SECTIONS_MISMATCH).',
  'Не удалось открыть возврат Word (E_DOCX_REVIEW_PREVIEW_SESSION_RETURN_INTAKE_BLOCKED: RTK_WORD_LIST_NUMBERING_INVALID: PENDING_RETURN_INVALID: FULL_MANUSCRIPT_INVALID).',
  'Не удалось экспортировать DOCX (E_REVIEW_DOCX_EXPORT_FAILED: RTK_WORD_LIST_INVALID).'];
 for(const status of visible){callback(status);assert.deepEqual(updates.at(-1),{text:status,visible:true});}
 const hidden=['Готово','error','Сохранено',{},null,
  'Не удалось открыть возврат Word (Error: /Users/private/file.docx).',
  'Не удалось открыть возврат Word (E_DOCX_REVIEW_PREVIEW_SESSION_FAILED: https://example.com/secret).',
  'Не удалось открыть возврат Word (E_DOCX_REVIEW_PREVIEW_SESSION_FAILED\nRTK_WORD_SECRET).',
  'Не удалось открыть возврат Word (E_DOCX_REVIEW_PREVIEW_SESSION_FAILED). private detail',
  'Не удалось открыть возврат Word (RTK_WORD_<script>).',
  'Не удалось открыть возврат Word (RTK_WORD_'+ 'A'.repeat(160)+').',
  'Не удалось открыть возврат Word ('+Array(5).fill('RTK_WORD_FAILED').join(': ')+').',
  'Не удалось открыть возврат Word (UNRELATED_ERROR).'];
 for(const status of hidden){callback(status);assert.deepEqual(updates.at(-1),{text:status,visible:false});}
 const count=updates.length;callback({type:'manuscript-notes-published',projectId:'foreign'});assert.equal(updates.length,count);assert.equal(notes,0);
 callback({type:'manuscript-notes-published',projectId:'project'});assert.equal(notes,2);assert.equal(updates.at(-1).text,'Сноски обновлены');
});

test('actual pending scene publication commits root settings with ledger atomically and passes Main import ACK comparison',async()=>{
  const {DocumentParagraphAlignment}=await import('../../src/renderer/tiptap/documentParagraphAlignment.mjs');
  const {editor,context}=await scenePublicationHarness([DocumentParagraphAlignment]);
  const pending=require('../../src/core/word-pending-text-revisions-v1.cjs');
  const sections=require('../../src/core/word-sections-v1.cjs');
  const envelope=require('../../src/core/document-content-envelope-v1.cjs');
  try {
    let source={type:'doc',attrs:{wordDefaultTabStop:708},content:[p('Before inserted after'),p('Second paragraph')]};
    source=sections.bind(source,{schemaVersion:1,boundaries:[],final:{type:'continuous',docGrid:{type:'default',linePitch:360}}});
    const incoming=pending.bindLedger({schemaVersion:2,source,revisions:[{id:'revision-1',nativeId:'51',operation:'insert',author:'Reviewer',date:'',dateUtc:'',paragraphIndex:0,from:7,to:15,state:'pending',groupId:null}],undo:[],redo:[],roundUndo:[],roundRedo:[],returnReceipts:[]});
    const original=JSON.stringify(incoming),expected=editor.schema.nodeFromJSON(incoming);
    assert.equal(context.setTiptapDocumentSnapshot({doc:incoming,resetHistory:true}),true);
    assert.equal(editor.state.doc.eq(expected),true);
    assert.equal(editor.state.doc.attrs.wordDefaultTabStop,708);
    assert.deepEqual(pending.readLedger(editor.getJSON()),pending.readLedger(incoming));
    assert.deepEqual(sections.read(editor.getJSON()),sections.read(incoming));
    assert.equal(JSON.stringify(incoming),original);
    const main=fs.readFileSync(path.resolve(__dirname,'../../src/main.js'),'utf8');
    const ack=main.slice(main.indexOf('async function docxImportOpenedSnapshotMatches('),main.indexOf('async function handleDocxImportOpenAcknowledgement('));
    const comparator=main.slice(main.indexOf('async function treeSceneSnapshotsEqual('),main.indexOf('async function assertTreeEditorSnapshotIdentity('));
    const ackContext=vm.createContext({loadDocumentContentEnvelopeModule:async()=>envelope,
      loadRtkNonTextReturnModule:()=>import('../../src/io/revisionBridge/reviewTransportNonTextReturnRuntime.mjs'),
      userBookmarkModel:require('../../src/core/word-user-bookmarks-v1.cjs'),pendingTextRevisions:pending});
    vm.runInContext(comparator+ack,ackContext);
    const raw=envelope.composeObservablePayload({doc:incoming});
    const live=envelope.composeObservablePayload({doc:editor.getJSON(),metaEnabled:true});
    assert.equal(await ackContext.docxImportOpenedSnapshotMatches(raw,live),true);
    const state=editor.state,malformed=structuredClone(incoming);malformed.attrs.wordDefaultTabStop=720;
    assert.equal(context.setTiptapDocumentSnapshot({doc:malformed,resetHistory:true}),false);
    assert.equal(editor.state,state,'inconsistent projection cannot publish or clear history');
    assert.equal(context.setTiptapDocumentSnapshot({doc:doc(p('Next scene')),resetHistory:true}),true);
    assert.equal(editor.state.doc.attrs.wordPendingRevisions,null);
    assert.equal(editor.state.doc.attrs.wordDefaultTabStop,null);
    assert.equal(editor.state.doc.attrs.wordSections,null);
  }finally{editor.destroy();}
});
