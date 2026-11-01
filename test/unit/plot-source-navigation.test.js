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
