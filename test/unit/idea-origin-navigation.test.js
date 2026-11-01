'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const Module=require('node:module');
const ROOT=path.resolve(__dirname,'../..');
const helperPath=path.join(ROOT,'test/unit/r24-wp307-writer-local-profile-integration.test.js');
const helperSource=fs.readFileSync(helperPath,'utf8');
const firstCase=helperSource.indexOf('\ntest(');assert.ok(firstCase>0);
function existingFunction(name){
  const match=new RegExp('^(?:async )?function '+name+'\\(','mu').exec(helperSource);assert.ok(match,name);
  const end=helperSource.indexOf('\n}',match.index);assert.ok(end>match.index,name);
  return helperSource.slice(match.index,end+2);
}
const navigationHooks=`\nmodule.exports.__navigation={
  state:()=>({filePath:currentFilePath,dirty:isDirty,generation:lastSignaledEditGeneration}),
  afterBarrier(callback){const original=confirmDiscardChanges;confirmDiscardChanges=async()=>{const result=await original();confirmDiscardChanges=original;if(result)await callback();return result;};}
};\n`;
const originalFixture=existingFunction('fullMacMainFixture');assert.equal(originalFixture.split("read('src/main.js')").length,2);
const helperModule=new Module(helperPath,module);helperModule.filename=helperPath;
helperModule.paths=Module._nodeModulePaths(path.dirname(helperPath));
const TEXT='Начало é 🧭. Мира увидела маяк. Северная ответила Мире. Мира сохранила знак.';
helperModule._compile(helperSource.slice(0,firstCase)+'\nconst navigationHooks='+JSON.stringify(navigationHooks)+';\nconst EXACT_ATLAS_TEXT='+JSON.stringify(TEXT)+';\n'
  +originalFixture.replace("read('src/main.js')","read('src/main.js')+navigationHooks")+'\n'
  +['fullMacRendererCommandPort','exactAtlasScene','finiteManualMapPdf'].map(existingFunction).join('\n')
  +'\nmodule.exports={fullMacMainFixture,fullMacRendererCommandPort,exactAtlasScene};',helperPath);
const {fullMacMainFixture,fullMacRendererCommandPort,exactAtlasScene}=helperModule.exports;
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function fullRoster(root){
  const rows=[];
  function visit(dir){for(const name of fs.readdirSync(dir).sort()){
    const p=path.join(dir,name),s=fs.lstatSync(p);assert.equal(s.isSymbolicLink(),false);
    rows.push([path.relative(root,p),s.isDirectory()?'directory':hash(fs.readFileSync(p))]);if(s.isDirectory())visit(p);
  }}
  visit(root);return rows;
}
async function fixture(t){
  // Reuse only existing fixture definitions, not any old test registration.
  // The entire actual Main and the actual packaged Darwin profile execute;
  // native Electron/window/snapshot ports remain finite, never native credit.
  const h=await fullMacMainFixture(t,{packaged:true,rendererLoaded:true});
  const f=await exactAtlasScene(h,'Idea origin source'),ui=await fullMacRendererCommandPort(h);
  assert.equal((await h.main.handleUiOpenDocumentCommand({projectId:f.projectId,nodeId:f.sceneId})).ok,true);
  const ideaId='saved-navigation-idea',linkId='saved-navigation-origin';
  const created=await ui('idea.create',{projectId:f.projectId,ideaId,title:'Авторская идея é 🧭',summary:'Saved explicit author record'});
  assert.equal(created.mainResult.ok,true,JSON.stringify(created));
  assert.equal(created.mainResult.value.receipt.status,'APPLIED');assert.equal(created.mainResult.value.receipt.storageWritten,true);
  const {hashCanonicalValue}=await import('../../src/core/browser-safe-hash.mjs');
  const originRef={schemaVersion:'idea.originRef.v1',kind:'sceneTextRange',sceneId:f.sceneId,startOffset:0,endOffset:TEXT.length,sourceHash:hashCanonicalValue(TEXT),targetId:ideaId};
  const linked=await ui('idea.originLink.add',{projectId:f.projectId,ideaId,linkId,originRef});
  assert.equal(linked.mainResult.ok,true,JSON.stringify(linked));
  assert.equal(linked.mainResult.value.receipt.status,'APPLIED');assert.equal(linked.mainResult.value.receipt.storageWritten,true);
  const packet=await h.query('query.projectionInspector',{projectId:f.projectId,idea:{selectedId:ideaId}});assert.equal(packet.ok,true);
  const idea=packet.projectionInspector.projectionStates.find(x=>x.projectionId==='idea');
  assert.equal(idea.state,'ready');assert.equal(idea.details.originLinkCount,1);
  assert.deepEqual(idea.details.originLinks[0].originRef,originRef);
  const expected={schemaVersion:'idea.sourceNavigation.v1',projectId:f.projectId,ideaId,linkId,originRef,
    sceneRevision:'sha256:'+hash(fs.readFileSync(f.scenePath)),projectionHash:idea.projectionHash};
  const open=async(value=expected,registered=false)=>{
    const payload={projectId:f.projectId,nodeId:f.sceneId,expectedIdeaSource:value};
    return registered?(await ui('cmd.project.document.open',payload)).mainResult:h.command('cmd.project.document.open',payload);
  };
  return {h,f,ui,expected,open,ideaId,linkId,originRef};
}
const publications=h=>h.sent.filter(([channel])=>channel==='editor:set-text').length;

test('Idea origin current registered caller reaches actual Kernel Main and preserves author truth',async t=>{
  const x=await fixture(t),before=x.h.roster();
  const response=await x.ui('cmd.project.document.open',{projectId:x.f.projectId,nodeId:x.f.sceneId,expectedIdeaSource:x.expected});
  assert.equal(response.mainResult.ok,true,JSON.stringify(response));
  assert.deepEqual(response.request.payload.expectedIdeaSource,x.expected,'actual registration must preserve the complete expected origin');
  assert.equal(x.h.main.__navigation.state().filePath,x.f.scenePath);
  assert.deepEqual(x.h.roster(),before);assert.deepEqual(fs.readFileSync(x.f.scenePath),x.f.sceneBytes);
});

test('Idea origin legacy document-open without an expectation remains available',async t=>{
  const x=await fixture(t),before=x.h.roster();
  const result=await x.ui('cmd.project.document.open',{projectId:x.f.projectId,nodeId:x.f.sceneId});
  assert.equal(result.mainResult.ok,true);assert.equal(Object.hasOwn(result.request.payload,'expectedIdeaSource'),false);
  assert.deepEqual(x.h.roster(),before);
});

for(const registered of [false,true])for(const fault of ['null','array','extra-path','foreign-project','wrong-idea','missing-link','stale-hash','stale-revision','stale-projection','wrong-range']){
  test('Idea origin '+(registered?'registered':'direct guarded Main')+' refuses '+fault+' before any source or editor replacement',async t=>{
    const x=await fixture(t);let value=structuredClone(x.expected);
    if(fault==='null')value=null;
    if(fault==='array')value=[];
    if(fault==='extra-path')value.path=x.f.scenePath;
    if(fault==='foreign-project')value.projectId='foreign-project';
    if(fault==='wrong-idea')value.ideaId='another-idea';
    if(fault==='missing-link')value.linkId='absent-origin';
    if(fault==='stale-hash')value.originRef.sourceHash='0'.repeat(64);
    if(fault==='stale-revision')value.sceneRevision='sha256:'+'0'.repeat(64);
    if(fault==='stale-projection')value.projectionHash='0'.repeat(64);
    if(fault==='wrong-range')value.originRef.endOffset++;
    const before=fullRoster(x.h.root),state=x.h.main.__navigation.state(),sent=publications(x.h);
    const result=await x.open(value,registered);
    assert.equal(result.ok,false,'an invalid saved-origin expectation must not be ignored');
    assert.deepEqual(x.h.main.__navigation.state(),state);assert.equal(publications(x.h),sent);
    assert.deepEqual(fullRoster(x.h.root),before);
  });
}

for(const mutation of ['scene','saved-link','generation'])test('Idea origin revalidates '+mutation+' after the actual no-loss await',async t=>{
  const x=await fixture(t);let reached=0,expectedRoster;
  const state=x.h.main.__navigation.state(),sent=publications(x.h);
  x.h.main.__navigation.afterBarrier(()=>{
    reached++;
    if(mutation==='scene')fs.writeFileSync(x.f.scenePath,fs.readFileSync(x.f.scenePath,'utf8')+'\nNew source Ω');
    if(mutation==='saved-link'){
      const m=JSON.parse(fs.readFileSync(x.f.manifestPath));m.ideas.originLinks[x.linkId].originRef.endOffset--;
      fs.writeFileSync(x.f.manifestPath,JSON.stringify(m));
    }
    if(mutation==='generation')x.h.main.__host.invalidateGeneration();
    expectedRoster=x.h.roster();
  });
  const result=await x.open();
  assert.equal(reached,1,'actual no-loss boundary must execute');assert.equal(result.ok,false);
  assert.equal(publications(x.h),sent);assert.equal(x.h.main.__navigation.state().filePath,state.filePath);
  assert.deepEqual(x.h.roster(),expectedRoster);
});

test('Idea origin rechecks saved-link manifest after real session settings rename and before publication',async t=>{
  const x=await fixture(t),rename=fs.promises.rename;let reached=0,expectedRoster;
  const sent=publications(x.h),state=x.h.main.__navigation.state();
  fs.promises.rename=async(...args)=>{
    const value=await rename.apply(fs.promises,args);
    if(!reached&&String(args[1]).startsWith(x.h.root+path.sep)&&path.basename(String(args[1]))==='settings.json'){
      reached++;const m=JSON.parse(fs.readFileSync(x.f.manifestPath));delete m.ideas.originLinks[x.linkId];
      fs.writeFileSync(x.f.manifestPath,JSON.stringify(m));expectedRoster=x.h.roster();
    }
    return value;
  };
  t.after(()=>{fs.promises.rename=rename;});
  const result=await x.open();assert.equal(reached,1,'actual settings publication boundary must execute');
  assert.equal(result.ok,false);assert.equal(publications(x.h),sent);
  assert.equal(x.h.main.__navigation.state().filePath,state.filePath);assert.deepEqual(x.h.roster(),expectedRoster);
});

test('Idea origin saves another dirty scene through the actual barrier before opening its unchanged source',async t=>{
  const x=await fixture(t),tree=await x.h.main.handleWorkspaceProjectTreeQuery({tab:'roman'});
  const flat=node=>[node,...(node.children||[]).flatMap(flat)],oldIds=new Set(flat(tree.root).map(n=>n.nodeId));
  const parent=flat(tree.root).find(n=>n!==tree.root&&['folder','part','chapter-folder'].includes(n.kind));assert.ok(parent);
  const created=await x.ui('cmd.project.tree.createNode',{projectId:x.f.projectId,parentNodeId:parent.nodeId,kind:'scene',name:'Working scene Ω'});
  assert.equal(created.mainResult.ok,true,JSON.stringify(created));
  const next=await x.h.main.handleWorkspaceProjectTreeQuery({tab:'roman'});
  const other=flat(next.root).find(n=>!oldIds.has(n.nodeId)&&n.kind==='scene');assert.ok(other);
  const resolved=await x.h.main.resolveProjectTreeNodeIdentity(other.nodeId,x.f.projectId);
  assert.equal((await x.h.main.handleUiOpenDocumentCommand({projectId:x.f.projectId,nodeId:other.nodeId})).ok,true);
  const envelope=require('../../src/core/document-content-envelope-v1.cjs');
  const text='Несохранённый другой источник é 🧭 Ω';
  const built=envelope.composeDocumentContentFromBase({baseContent:x.h.editor.content,nextVisibleText:text});assert.equal(built.ok,true);
  const generation=x.h.editor.generation+1;
  x.h.editor={...x.h.editor,content:built.content,plainText:text,generation};
  const signal=require('../../src/core/ipc-envelope-v1.cjs').createEnvelope('ui:save-lifecycle-signal-bridge','signal.localDirty.set',{state:true,generation});
  assert.equal((await x.h.handlers.get('ui:save-lifecycle-signal-bridge')(x.h.event(),signal)).ok,true);
  const ideas=JSON.parse(fs.readFileSync(x.f.manifestPath)).ideas;
  const result=await x.open();assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(envelope.parseObservablePayload(fs.readFileSync(resolved.nodePath,'utf8')).text,text);
  assert.deepEqual(fs.readFileSync(x.f.scenePath),x.f.sceneBytes);
  assert.deepEqual(JSON.parse(fs.readFileSync(x.f.manifestPath)).ideas,ideas);
  assert.equal(x.h.main.__navigation.state().filePath,x.f.scenePath);
  assert.equal(x.h.main.__navigation.state().dirty,false);
});
