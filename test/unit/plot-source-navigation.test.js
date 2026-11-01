'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { pathToFileURL } = require('node:url');
const ROOT = path.resolve(__dirname, '../..');
const fixturePath = path.join(ROOT, 'test/contracts/rtk-word-scene-identity-main.contract.test.js');
const source = fs.readFileSync(fixturePath, 'utf8');
const firstCase = source.indexOf('\ntest('); assert.ok(firstCase > 0);
function functionSource(name) {
  const match = new RegExp(`^(?:async )?function ${name}\\(`, 'mu').exec(source); assert.ok(match, name);
  return source.slice(match.index, source.indexOf('\n}', match.index) + 2);
}
const probe = `module.exports.__probe = {
  plotCore: buildProductCoreStateForCurrentProject,
  plotInspector: handleWorkspaceProjectionInspectorQuery,
  afterPlotBarrier(callback) {const prior=confirmDiscardChanges;confirmDiscardChanges=async()=>{const r=await prior();confirmDiscardChanges=prior;if(r)await callback();return r;};},`;
const initializer = source.slice(0, firstCase); assert.equal(initializer.split('module.exports.__probe = {').length, 2);
const fixtureModule = new Module(fixturePath, module); fixtureModule.filename = fixturePath;
fixtureModule.paths = Module._nodeModulePaths(path.dirname(fixturePath));
fixtureModule._compile(initializer.replace('module.exports.__probe = {', probe) + '\n' + functionSource('mountRenderer') + '\nmodule.exports={fixture,mountRenderer};', fixturePath);
const { fixture, mountRenderer } = fixtureModule.exports;
async function sourceRequest(f, target = f.a.nodeId) {
  const { derivePlotProjection } = await import(pathToFileURL(path.join(ROOT, 'src/derived/plot/derivePlotProjection.mjs')).href);
  const { coreState, projectId } = await f.probe.plotCore();
  const result = derivePlotProjection({ coreState, params: { projectId }, capabilitySnapshot: {} }); assert.equal(result.ok, true);
  const originRef = result.value.originRefs.find(row => row.sceneId === target && row.kind === 'scene'); assert.ok(originRef);
  return { schemaVersion: 'plot.sourceNavigation.v1', originRef, sceneRevision: coreState.data.projects[projectId].scenes[target].sceneRevision, projectionHash: result.value.meta.projectionHash };
}

test('actual Main current Plot source opens only through existing Kernel document route', async t => {
  const f = await fixture(t), ui = mountRenderer(f, 'Beta', 0), expectedPlotSource = await sourceRequest(f);
  const result = await f.probe.dispatch('cmd.project.document.open', { projectId: f.query.projectId, nodeId: f.a.nodeId, expectedPlotSource });
  assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(f.probe.state().filePath, f.alpha);
  assert.equal(ui.sends.filter(row => row.channel === 'editor:set-text').at(-1).payload.content, 'Alpha');
});

for (const issue of ['raw-null', 'raw-array', 'extra-field', 'foreign-project', 'wrong-scene', 'missing-ref', 'stale-hash', 'stale-revision', 'stale-projection', 'wrong-range']) {
  test('actual Main rejects untrusted Plot source '+issue+' before replacement or source writes', async t => {
    const f = await fixture(t), ui = mountRenderer(f, 'Beta', 0); let expectedPlotSource = await sourceRequest(f);
    if (issue === 'raw-null') expectedPlotSource = null;
    if (issue === 'raw-array') expectedPlotSource = [];
    if (issue === 'extra-field') expectedPlotSource.path = f.beta;
    if (issue === 'foreign-project') expectedPlotSource.originRef.projectId = 'foreign-project';
    if (issue === 'wrong-scene') expectedPlotSource.originRef.sceneId = f.b.nodeId;
    if (issue === 'missing-ref') expectedPlotSource.originRef.refId = 'plot-origin:'+'0'.repeat(64);
    if (issue === 'stale-hash') expectedPlotSource.originRef.sourceHash = '0'.repeat(64);
    if (issue === 'stale-revision') expectedPlotSource.sceneRevision = 'sha256:'+'0'.repeat(64);
    if (issue === 'stale-projection') expectedPlotSource.projectionHash = '0'.repeat(64);
    if (issue === 'wrong-range') expectedPlotSource.originRef.endOffset++;
    const before = f.capture();
    const result = await f.probe.dispatch('cmd.project.document.open', { projectId:f.query.projectId, nodeId:f.a.nodeId, expectedPlotSource });
    assert.equal(result.ok,false,'expected source must be validated, not silently ignored');
    assert.equal(f.probe.state().filePath,f.beta); assert.equal(ui.sends.filter(row=>row.channel==='editor:set-text').length,0);
    assert.deepEqual(f.capture(),before);
  });
}

test('actual Main saves a different dirty scene before current Plot source navigation', async t => {
  const f = await fixture(t), expectedPlotSource = await sourceRequest(f), text='Несохранённое e\u0301 🧭';
  mountRenderer(f,text,1);f.probe.state({dirty:true});
  const result = await f.probe.dispatch('cmd.project.document.open',{projectId:f.query.projectId,nodeId:f.a.nodeId,expectedPlotSource});
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(fs.readFileSync(f.beta,'utf8'),text);assert.equal(fs.readFileSync(f.alpha,'utf8'),'Alpha');
});

test('actual Main refuses Plot origin changed while no-loss barrier awaits', async t => {
  const f = await fixture(t), ui=mountRenderer(f,'Beta',0), expectedPlotSource=await sourceRequest(f);let reached=0;
  f.probe.afterPlotBarrier(()=>{reached++;fs.writeFileSync(f.alpha,'Newer author source Ω');});
  const result=await f.probe.dispatch('cmd.project.document.open',{projectId:f.query.projectId,nodeId:f.a.nodeId,expectedPlotSource});
  assert.equal(reached,1);assert.equal(result.ok,false,'the old source reference cannot authorize opening a changed target');
  assert.equal(f.probe.state().filePath,f.beta);assert.equal(ui.sends.filter(row=>row.channel==='editor:set-text').length,0);assert.equal(fs.readFileSync(f.alpha,'utf8'),'Newer author source Ω');
});

test('actual Main projection query rejects malformed Plot options before deriving selected data', async t => {
  const f=await fixture(t);mountRenderer(f,'Beta',0);const before=f.capture();
  for(const plot of [{offset:-1},{offset:'24'},{selectedId:17},{search:[]},{outside:'x'}]){
    const result=await f.probe.plotInspector({projectId:f.query.projectId,plot});assert.equal(result.ok,false,JSON.stringify(plot));
  }
  assert.deepEqual(f.capture(),before);
});

test('actual Main refuses changed origin manifest after session persistence before editor publication', async t => {
  const f=await fixture(t), ui=mountRenderer(f,'Beta',0), expectedPlotSource=await sourceRequest(f);
  const rename=fs.promises.rename;let reached=0,changed='';
  fs.promises.rename=async(...args)=>{
    const value=await rename.apply(fs.promises,args);
    if(!reached&&String(args[1]).startsWith(f.temp+path.sep)&&path.basename(String(args[1]))==='settings.json'){
      reached++;changed=fs.readFileSync(f.manifestPath,'utf8')+'\n';fs.writeFileSync(f.manifestPath,changed);
    }
    return value;
  };
  t.after(()=>{fs.promises.rename=rename;});
  const result=await f.probe.dispatch('cmd.project.document.open',{projectId:f.query.projectId,nodeId:f.a.nodeId,expectedPlotSource});
  assert.equal(reached,1,'actual settings persistence barrier must be reached');
  assert.equal(result.ok,false);assert.equal(f.probe.state().filePath,f.beta);
  assert.equal(ui.sends.filter(row=>row.channel==='editor:set-text').length,0);
  assert.equal(fs.readFileSync(f.manifestPath,'utf8'),changed);assert.equal(fs.readFileSync(f.alpha,'utf8'),'Alpha');
});

// Real renderer registration/effect bridge plus actual Main/Core/Kernel and real
// fixture files. Native Electron ports remain inert; this is not native credit.
async function registeredPlotOpen(f, input) {
  const { createCommandRegistry } = await import(pathToFileURL(path.join(ROOT,'src/renderer/commands/registry.mjs')).href);
  const { registerProjectCommands } = await import(pathToFileURL(path.join(ROOT,'src/renderer/commands/projectCommands.mjs')).href);
  const { runCommandThroughBus } = await import(pathToFileURL(path.join(ROOT,'src/renderer/commands/commandBusGuard.mjs')).href);
  const registry=createCommandRegistry(), requests=[];
  registerProjectCommands(registry,{electronAPI:{invokeUiCommandBridge:async envelope=>{
    requests.push(structuredClone(envelope));assert.equal(envelope.route,'command.bus');
    return f.probe.dispatch(envelope.commandId,envelope.payload);
  }}});
  const result=await runCommandThroughBus((id,payload)=>registry.getHandler(id)(payload),'cmd.project.document.open',input,{route:'command.bus'});
  return {result,requests};
}

test('actual registered document route forwards exact current Plot expectation to actual Main',async t=>{
  const f=await fixture(t);mountRenderer(f,'Beta',0);const expectedPlotSource=await sourceRequest(f);
  const {result,requests}=await registeredPlotOpen(f,{projectId:f.query.projectId,nodeId:f.a.nodeId,expectedPlotSource});
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(requests.length,1);
  assert.deepEqual(requests[0].payload,{projectId:f.query.projectId,nodeId:f.a.nodeId,expectedPlotSource},'the real registry may not silently erase the source guard');
  assert.equal(f.probe.state().filePath,f.alpha);
});

for(const invalid of ['null','malformed','stale-revision','stale-projection','foreign-project','source-path-field'])
 test('actual registered route preserves '+invalid+' Plot intent for Main refusal',async t=>{
  const f=await fixture(t),ui=mountRenderer(f,'Beta',0),before=f.capture();let expectedPlotSource=await sourceRequest(f);
  if(invalid==='null')expectedPlotSource=null;
  if(invalid==='malformed')expectedPlotSource={schemaVersion:'plot.sourceNavigation.v1'};
  if(invalid==='stale-revision')expectedPlotSource.sceneRevision='sha256:'+'a'.repeat(64);
  if(invalid==='stale-projection')expectedPlotSource.projectionHash='b'.repeat(64);
  if(invalid==='foreign-project')expectedPlotSource.originRef.projectId='project-foreign';
  if(invalid==='source-path-field')expectedPlotSource.originRef.path='/outside/never-authority';
  const {result,requests}=await registeredPlotOpen(f,{projectId:f.query.projectId,nodeId:f.a.nodeId,expectedPlotSource});
  assert.equal(result.ok,false,'malformed/stale source intent must survive registration and be refused, not become a legacy open');
  assert.equal(requests.length,1);assert.deepEqual(requests[0].payload.expectedPlotSource,expectedPlotSource);
  assert.equal(f.probe.state().filePath,f.beta);assert.equal(ui.sends.filter(r=>r.channel==='editor:set-text').length,0);assert.deepEqual(f.capture(),before);
 });

test('actual registered legacy open preserves absent expectation and strips untrusted path fields',async t=>{
  const f=await fixture(t);mountRenderer(f,'Beta',0);
  const {result,requests}=await registeredPlotOpen(f,{projectId:f.query.projectId,nodeId:f.a.nodeId,path:'/outside/never-authority',other:'ignored'});
  assert.equal(result.ok,true,JSON.stringify(result));assert.deepEqual(requests[0].payload,{projectId:f.query.projectId,nodeId:f.a.nodeId});
  assert.equal(Object.hasOwn(requests[0].payload,'expectedPlotSource'),false);assert.equal(f.probe.state().filePath,f.alpha);
});

test('actual registered source replacement preserves Renderer session generation for strict ENV and Quit',async t=>{
  const f=await fixture(t), rendererGeneration=3, dirtyText='Несохранённый e\u0301 🧭 перед источником';
  let rendererContent=dirtyText;
  mountRenderer(f,()=>rendererContent,()=>rendererGeneration,null,null,payload=>{rendererContent=payload.content;});
  f.probe.state({dirty:true});
  const expectedPlotSource=await sourceRequest(f);
  const {result}=await registeredPlotOpen(f,{projectId:f.query.projectId,nodeId:f.a.nodeId,expectedPlotSource});
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(fs.readFileSync(f.beta,'utf8'),dirtyText);
  assert.equal(fs.readFileSync(f.alpha,'utf8'),'Alpha');
  assert.equal(f.probe.state().filePath,f.alpha);
  assert.equal(f.probe.state().dirty,false);
  // Actual Renderer keeps its monotonic session counter on main-owned load,
  // and strict full ENV capture compares this snapshot coordinate with Main.
  const snapshot=await f.probe.snapshot();
  assert.equal(snapshot.content,'Alpha');
  assert.equal(snapshot.generation,rendererGeneration);
  assert.equal(f.probe.state().generation,snapshot.generation,'a saved source baseline cannot rewind Main below the live Renderer coordinate');
});
