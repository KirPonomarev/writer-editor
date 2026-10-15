'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),fsp=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const vm=require('node:vm'),crypto=require('node:crypto'),{Module,createRequire}=require('node:module');
const tx=require('../../src/core/project-transaction-v1.cjs');
const {createCommandSurfaceKernel}=require('../../src/command/commandSurfaceKernel.js');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const ROOT=path.resolve(__dirname,'../..'),ID='cmd.project.recoverMissingIntegrityAnchor';
function named(source,name){const at=source.indexOf('async function '+name+'(')>=0?source.indexOf('async function '+name+'('):source.indexOf('function '+name+'(');assert.ok(at>=0,name);const end=source.indexOf('\n}',at);assert.ok(end>at);return source.slice(at,end+2);}
function snapshot(root){const values={};const walk=directory=>{for(const name of fs.readdirSync(directory).sort()){const target=path.join(directory,name),stat=fs.lstatSync(target);if(stat.isDirectory())walk(target);else values[path.relative(root,target)]=stat.isSymbolicLink()?{link:fs.readlinkSync(target)}:fs.readFileSync(target);}};walk(root);return values;}
function json(target,value){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(value,null,2)+'\n');}
async function harness(t,options={}){
  const filename=require.resolve('./rtk-word-mixed-return-transaction.contract.test.js'),fixtureModule=new Module(filename,module);
  fixtureModule.filename=filename;fixtureModule.paths=Module._nodeModulePaths(path.dirname(filename));fixtureModule.require=createRequire(filename);
  // Only the existing fixture definition is compiled. No test registration is
  // copied or suppressed; its real parser, planner and writer remain in use.
  fixtureModule._compile("const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');const envelope=require('../../src/core/document-content-envelope-v1.cjs');\n"+named(fs.readFileSync(filename,'utf8'),'notesBookDiskFixture')+'\nmodule.exports=notesBookDiskFixture;',filename);
  const f=await fixtureModule.exports(t),projectId=f.input.projectId;
  const manifest={schemaVersion:1,projectId,projectName:path.basename(f.root),treeIdentity:{schemaVersion:1,nodes:Object.fromEntries(f.ids.map(id=>['tree-node-'+sha(id).slice(0,32),{kind:'scene',present:true,bindingKey:'file:'+id}]))}};
  json(f.manifestPath,manifest);f.input.beforeManifestText=fs.readFileSync(f.manifestPath,'utf8');
  const proof=JSON.parse(f.input.returnProofJson);proof.schemaVersion=5;proof.now='2026-10-16T00:00:00.000Z';proof.noteContext.schemaVersion=2;f.input.returnProofJson=JSON.stringify(proof);
  const userData=fs.mkdtempSync(path.join(os.tmpdir(),'yalken-recovery-userdata-'));t.after(()=>fs.rmSync(userData,{recursive:true,force:true}));
  const anchorRoot=path.join(userData,'stage10-integrity-anchors');
  const {createMainProjectManifestAuthority}=await import('../../src/product/mainProjectManifestAuthority.mjs');
  const transactionAuthority=createMainProjectManifestAuthority({anchorRoot,useLeaseHeartbeatWorker:false});
  const commit=async request=>transactionAuthority.withProjectLease(projectId,lease=>tx.commitProjectTransaction({...request,manifestPath:f.manifestPath,
    publishManifest:args=>transactionAuthority.commitManifestText({...args,projectId,lease}),revalidate:()=>lease.assertOwned()}));
  await commit({revision:1,treeCohort:f.model.planProjectMixedWordReturnCohort(f.input)});
  fs.unlinkSync(path.join(f.root,'request.json'));
  if(options.history)assert.equal((await commit({revision:2,wordHistory:{projectId,sceneId:f.ids[0],action:'undo'}})).changed,true,'real v5 book Undo must actually publish the v6 history packet');
  const {createStage10MainPersistenceAdapter}=await import('../../src/product/stage10MainPersistenceAdapter.mjs');
  const {createStage10ApplicationBootstrap}=await import('../../src/product/stage10ApplicationBootstrap.mjs');
  const makeAdapter=extra=>createStage10MainPersistenceAdapter({projectRoot:f.root,anchorRoot,transactionAuthority,useLeaseHeartbeatWorker:false,...extra});
  const adapter=makeAdapter(),bootstrap=createStage10ApplicationBootstrap({persistencePort:adapter});
  if(options.initialCreateInterruption){
    let hit=false;const fault=makeAdapter({onKillpoint:name=>{if(name==='after-session-write'&&!hit){hit=true;throw Error('initial Stage10 interruption');}}});
    await assert.rejects(createStage10ApplicationBootstrap({persistencePort:fault}).createProjectRuntime({projectId}),/initial Stage10 interruption/);assert.equal(hit,true);
    return {...f,projectId,userData,anchorRoot,transactionAuthority,makeAdapter,adapter,paths:adapter.paths(projectId),createStage10ApplicationBootstrap,protected:snapshot(f.root)};
  }
  await bootstrap.createProjectRuntime({projectId,title:'Preserved original'});
  const paths=adapter.paths(projectId),oldBundle=await adapter.readStage10State(projectId);
  fs.unlinkSync(paths.anchor);fs.unlinkSync(paths.anchorRecovery);
  return {...f,projectId,userData,anchorRoot,transactionAuthority,commit,makeAdapter,adapter,paths,oldBundle,createStage10ApplicationBootstrap,protected:snapshot(f.root)};
}
function mainPort(f,{choice=0,onDialog,adapter=f.adapter}={}){
  const source=fs.readFileSync(path.join(ROOT,'src/main.js'),'utf8'),calls={dialog:0,writers:0};let documents=path.dirname(f.root);
  const sandbox={Buffer,Object,Error,path,fs:fsp,normalizeStableProjectId:v=>typeof v==='string'?v.trim():'',isPlainObjectValue:v=>!!v&&typeof v==='object'&&!Array.isArray(v),
    sanitizeFilename:v=>v,loadSettings:async()=>({}),readSessionContinuityV1:()=>({ok:true,present:false}),
    currentProjectName:path.basename(f.root),DEFAULT_PROJECT_NAME:path.basename(f.root),PROJECT_MANIFEST_FILENAME:'project.craftsman.json',
    pendingMissingIntegrityAnchorRecoveryBinding:null,activeStage10ApplicationBootstrap:null,
    fileManager:{getDocumentsPath:()=>documents,writeFileAtomic:()=>{throw Error('unexpected legacy writer');},migrateDocumentsFolder:async()=>{calls.writers++;throw Error('startup writer reached');}},
    app:{getPath:()=>f.userData},loadStage10MainPersistenceAdapterModule:async()=>({createStage10MainPersistenceAdapter:()=>adapter}),getMainProjectManifestAuthority:async()=>f.transactionAuthority,
    dialog:{showMessageBox:async args=>{calls.dialog++;assert.equal(args.defaultId,0);assert.equal(args.cancelId,0);assert.deepEqual(Array.from(args.buttons),['Отмена','Восстановить доверие']);if(onDialog)await onDialog(sandbox);return {response:choice};}},
    COMMAND_SURFACE_KERNEL_COMMAND_IDS:{PROJECT_RECOVER_MISSING_INTEGRITY_ANCHOR:ID}};
  const functions=['resolveReadOnlyStartupRecoveryBinding','handleMissingIntegrityAnchorRecovery','recoverMissingIntegrityAnchorAtStartup','initializeApp'];
  vm.runInNewContext(functions.map(name=>named(source,name)).join('\n'),sandbox);
  const kernel=createCommandSurfaceKernel({[ID]:payload=>sandbox.handleMissingIntegrityAnchorRecovery(payload)});
  sandbox.dispatchCommandSurfaceKernel=(id,payload)=>kernel.dispatch(id,payload);
  return {sandbox,calls,kernel,setDocuments:value=>{documents=value;}};
}

async function ordinaryStartupPort(f){
  const main=mainPort(f,{choice:1}),c=main.sandbox,source=fs.readFileSync(path.join(ROOT,'src/main.js'),'utf8'),order=[];
  const early=c.recoverMissingIntegrityAnchorAtStartup;c.recoverMissingIntegrityAnchorAtStartup=async()=>{order.push('integrity');return early();};
  Object.assign(c,{fsSync:fs,STAGE10_LOCAL_STATE_DIRNAME:'.stage10-local',STAGE10_LEGACY_PRODUCT_SESSION_FILENAME:'product-session.v1.json',
    STAGE10_LEGACY_RECEIPT_AUTHORITY_HEAD_FILENAME:'command-receipt-authority-head.v1.json',PROJECT_MANIFEST_SCHEMA_VERSION:1,
    joinPathSegmentsWithinRoot:(root,segments)=>path.join(root,...segments),getProjectManifestPath:()=>f.manifestPath,
    ensureProjectManifest:async()=>({manifestPath:f.manifestPath,manifest:JSON.parse(await fsp.readFile(f.manifestPath,'utf8'))}),
    setActiveProjectNameFromRoot:root=>{c.currentProjectName=path.basename(root);},prepareCanonicalProjectTruthCommand:()=>{throw Error('unexpected canonical command');},
    loadStage10ApplicationBootstrapModule:()=>import('../../src/product/stage10ApplicationBootstrap.mjs'),
    loadStage10ApplicationCommandRouteModule:()=>import('../../src/product/stage10ApplicationCommandRoute.mjs'),
    recoverPendingWriterProjectTransaction:()=>f.transactionAuthority.withProjectLease(f.projectId,lease=>tx.recoverProjectTransaction({scenePath:path.join(f.root,f.ids[0]),manifestPath:f.manifestPath,
      publishManifest:args=>f.transactionAuthority.commitManifestText({...args,projectId:f.projectId,lease}),revalidate:()=>lease.assertOwned()})),
    ensureAutosaveDirectory:async()=>{order.push('autosave-directory');assert.equal((await fsp.stat(f.userData)).isDirectory(),true);},
    ensureProjectStructure:async()=>{order.push('structure');await fsp.mkdir(path.join(f.root,'roman'),{recursive:true});},
    buildProjectTreeRootsWithIdentities:async()=>{order.push('tree');await tx.readVerifiedProjectTreeMutation({manifestPath:f.manifestPath});}});
  c.fileManager.migrateDocumentsFolder=async()=>{order.push('migrate');assert.equal((await fsp.stat(f.root)).isDirectory(),true);};
  c.fileManager.ensureDocumentsFolder=async()=>{order.push('documents');assert.equal((await fsp.stat(path.dirname(f.root))).isDirectory(),true);};
  for(const name of ['reconcileReviewFormattingReturnAtStartup','reconcileReviewStructuralReturnAtStartup','reconcileReviewExactTextApplyJournalsAtStartup','reconcileRoundRecordV3StoreAtStartup'])c[name]=async()=>{order.push(name);assert.equal((await fsp.stat(f.manifestPath)).isFile(),true);};
  vm.runInNewContext(['getStage10LocalStatePath','readStage10LocalStatePresence','bootstrapStage10ApplicationForProject','resolveStartupStage10ProjectBinding','recoverSelectedProjectAtStartup','bootstrapStage10ApplicationAtStartup'].map(name=>named(source,name)).join('\n'),c);
  for(const name of ['recoverSelectedProjectAtStartup','bootstrapStage10ApplicationAtStartup']){const actual=c[name];c[name]=async()=>{order.push(name);return actual();};}
  return {...main,order};
}

test('missing-anchor recovery: ordinary reopen refuses and explicit recovery is required',async t=>{
  const f=await harness(t);
  await assert.rejects(f.createStage10ApplicationBootstrap({persistencePort:f.adapter}).reopenProjectRuntime({projectId:f.projectId}),e=>e.reason==='PERSISTENCE_SPLIT_STATE_DETECTED');
  assert.equal(typeof f.adapter.prepareMissingIntegrityAnchorRecovery,'function');
  const candidate=await f.adapter.prepareMissingIntegrityAnchorRecovery(f.projectId);
  assert.equal(candidate.sceneCount,3);assert.equal(candidate.treeRevision,1);assert.ok(candidate.fileCount>10);
  assert.deepEqual(snapshot(f.root),f.protected,'preparation never mutates original project');
});

test('missing-anchor recovery: valid interrupted initial persistence delegates to ordinary journal recovery',async t=>{
  const f=await harness(t,{initialCreateInterruption:true}),main=mainPort(f,{choice:1});
  assert.equal(fs.existsSync(f.paths.anchor),false);assert.equal(fs.existsSync(f.paths.transaction),true);
  await main.sandbox.recoverMissingIntegrityAnchorAtStartup();
  assert.equal(main.calls.dialog,0,'existing journal authority never prompts for a new trust root');
  assert.equal(fs.existsSync(f.paths.anchor),false,'preparation remains read-only');assert.deepEqual(snapshot(f.root),f.protected);
  const startup=await ordinaryStartupPort(f);await startup.sandbox.initializeApp();
  assert.deepEqual(startup.order,['integrity','migrate','documents','autosave-directory','recoverSelectedProjectAtStartup','structure','tree','bootstrapStage10ApplicationAtStartup',
    'reconcileReviewFormattingReturnAtStartup','reconcileReviewStructuralReturnAtStartup','reconcileReviewExactTextApplyJournalsAtStartup','reconcileRoundRecordV3StoreAtStartup']);
  assert.equal(startup.calls.dialog,0);assert.equal(startup.sandbox.activeStage10ApplicationBootstrap.getProjectId(),f.projectId);
  const repaired=await f.adapter.readStage10State(f.projectId);assert.equal(repaired.recoveryConsumed,true);assert.equal(repaired.integrityAnchor.anchorVersion,1);
  assert.equal(fs.existsSync(f.paths.transaction),false);assert.equal(Object.hasOwn(repaired.integrityAnchor,'recoveryRoot'),false);
  const reopened=await f.createStage10ApplicationBootstrap({persistencePort:f.makeAdapter()}).reopenProjectRuntime({projectId:f.projectId});assert.equal(reopened.readModels.replay.ok,true);
  for(const [name,bytes]of Object.entries(f.protected))if(!name.startsWith('.stage10-local/'))assert.deepEqual(snapshot(f.root)[name],bytes);
});
test('missing-anchor recovery: actual initializeApp Cancel precedes every project writer',async t=>{
  const f=await harness(t),main=mainPort(f);
  await assert.rejects(main.sandbox.initializeApp(),e=>e.code==='E_STAGE10_RECOVERY_CANCELLED');
  assert.equal(main.calls.dialog,1);assert.equal(main.calls.writers,0);assert.equal(fs.existsSync(f.paths.anchor),false);
  assert.deepEqual(snapshot(f.root),f.protected);assert.equal(main.sandbox.pendingMissingIntegrityAnchorRecoveryBinding,null);
});
test('missing-anchor recovery: real Kernel/native consent publishes one honest root and preserves the complete pair/history',async t=>{
  const f=await harness(t,{history:true}),main=mainPort(f,{choice:1});
  await main.sandbox.recoverMissingIntegrityAnchorAtStartup();
  const bundle=await f.adapter.readStage10State(f.projectId),anchor=bundle.integrityAnchor;
  assert.equal(anchor.anchorVersion,2);assert.equal(anchor.authorityGeneration,f.oldBundle.integrityAnchor.authorityGeneration);
  assert.equal(anchor.previousIntegrityAnchorDigest,'');assert.equal(bundle.previousIntegrityAnchor,null);
  assert.equal(anchor.recoveryRoot.trustBasis,'EXPLICIT_LOCAL_OWNER_REVALIDATION');
  assert.equal(anchor.recoveryRoot.rawSessionDigest,sha(f.protected['.stage10-local/product-session.v2.json']));
  assert.deepEqual(snapshot(f.root),f.protected,'every private, pending, note, comment and retained packet byte remains exact');
  const reopened=f.createStage10ApplicationBootstrap({persistencePort:f.makeAdapter()});
  assert.equal((await reopened.reopenProjectRuntime({projectId:f.projectId})).readModels.replay.ok,true);
  const stage=await import('../../src/product/stage10ProductWiring.mjs');
  for(let i=0;i<2;i++)assert.equal((await reopened.dispatchProjectCommand(stage.STAGE10_PRODUCT_COMMAND_IDS.OPERATION_EXCHANGE_PREPARE,{projectId:f.projectId,sessionId:'continued-'+i})).ok,true);
  const next=await f.adapter.readStage10State(f.projectId);
  assert.deepEqual(next.integrityAnchor.recoveryRoot,anchor.recoveryRoot);assert.equal(next.integrityAnchor.authorityGeneration,anchor.authorityGeneration+2);
  assert.equal((await f.createStage10ApplicationBootstrap({persistencePort:f.makeAdapter()}).reopenProjectRuntime({projectId:f.projectId})).readModels.replay.ok,true);
});
test('missing-anchor recovery: no Main startup capability and caller approval/path payload cannot authorize the command',async t=>{
  const f=await harness(t),main=mainPort(f,{choice:1});
  assert.equal((await main.kernel.dispatch(ID,{approved:true,projectRoot:f.root})).ok,false);
  assert.equal((await main.kernel.dispatch(ID,{})).ok,false);assert.equal(main.calls.dialog,0);
  main.sandbox.pendingMissingIntegrityAnchorRecoveryBinding=await main.sandbox.resolveReadOnlyStartupRecoveryBinding();
  assert.equal((await main.kernel.dispatch(ID,{approved:true})).ok,false);assert.equal(main.calls.dialog,0);
  assert.equal(fs.existsSync(f.paths.anchor),false);assert.deepEqual(snapshot(f.root),f.protected);
  const source=fs.readFileSync(path.join(ROOT,'src/main.js'),'utf8');
  assert.match(named(source,'getInternalCommandSurfaceKernel'),/PROJECT_RECOVER_MISSING_INTEGRITY_ANCHOR\]: handleMissingIntegrityAnchorRecovery/);
});
for(const value of ['null','false','{','{}'])test('missing-anchor recovery: present anchor '+value+' never offers replacement',async t=>{
  const f=await harness(t);fs.writeFileSync(f.paths.anchor,value);
  assert.equal(await f.adapter.prepareMissingIntegrityAnchorRecovery(f.projectId),null);
  const main=mainPort(f,{choice:1});await main.sandbox.recoverMissingIntegrityAnchorAtStartup();
  assert.equal(main.calls.dialog,0);assert.equal(fs.readFileSync(f.paths.anchor,'utf8'),value);assert.deepEqual(snapshot(f.root),f.protected);
});
test('missing-anchor recovery: dangling anchor and symlink trust root never grant missing authority',async t=>{
  const f=await harness(t);fs.symlinkSync(path.join(f.userData,'absent'),f.paths.anchor);
  assert.equal(await f.adapter.prepareMissingIntegrityAnchorRecovery(f.projectId),null);fs.unlinkSync(f.paths.anchor);
  const saved=f.paths.anchorRoot+'-original';fs.renameSync(f.paths.anchorRoot,saved);fs.symlinkSync(saved,f.paths.anchorRoot);
  await assert.rejects(f.adapter.prepareMissingIntegrityAnchorRecovery(f.projectId),e=>e.reason==='RECOVERY_TRUST_ROOT_BOUNDARY');
  assert.deepEqual(snapshot(f.root),f.protected);
});
for(const field of ['anchorRecovery','transaction'])test('missing-anchor recovery: preserved '+field+' refuses a new root',async t=>{
  const f=await harness(t);fs.writeFileSync(f.paths[field],'null');
  if(field==='transaction'){
    assert.equal(await f.adapter.prepareMissingIntegrityAnchorRecovery(f.projectId),null);
    const main=mainPort(f,{choice:1});await main.sandbox.recoverMissingIntegrityAnchorAtStartup();assert.equal(main.calls.dialog,0);
    const startup=await ordinaryStartupPort(f);await assert.rejects(startup.sandbox.initializeApp());
    assert.equal(startup.calls.dialog,0);assert.equal(startup.order.includes('reconcileRoundRecordV3StoreAtStartup'),false);
    assert.equal(fs.existsSync(f.paths.anchor),false,'invalid pending authority never creates or replaces trust');
  }else await assert.rejects(f.adapter.prepareMissingIntegrityAnchorRecovery(f.projectId),e=>e.reason==='RECOVERY_EXISTING_TRUST_OR_TRANSACTION');
  assert.deepEqual(snapshot(f.root),f.protected);
});
test('missing-anchor recovery: unknown trust evidence and legacy namespace refuse without migration',async t=>{
  const f=await harness(t);fs.writeFileSync(path.join(f.paths.anchorRoot,'unknown.json'),'{}');
  await assert.rejects(f.adapter.prepareMissingIntegrityAnchorRecovery(f.projectId),e=>e.reason==='RECOVERY_UNKNOWN_TRUST_EVIDENCE');
  fs.unlinkSync(path.join(f.paths.anchorRoot,'unknown.json'));const legacy=path.join(f.anchorRoot,f.paths.legacyProjectKey);fs.mkdirSync(legacy);
  await assert.rejects(f.adapter.prepareMissingIntegrityAnchorRecovery(f.projectId),e=>e.reason==='RECOVERY_EXISTING_TRUST_OR_TRANSACTION');
  assert.ok(fs.existsSync(legacy));assert.deepEqual(snapshot(f.root),f.protected);
});
test('missing-anchor recovery: raw schema, legacy defaults, foreign project and executable replay corruption refuse',async t=>{
  const f=await harness(t),session=JSON.parse(f.protected['.stage10-local/product-session.v2.json']),store=JSON.parse(f.protected['.stage10-local/command-receipt-authority-store.v2.json']);
  const {validateStage10MissingAnchorRecoveryPair:validate}=await import('../../src/product/stage10ProductWiring.mjs');
  assert.equal(validate(session,store,f.projectId).replay.ok,true);
  for(const change of [s=>delete s.commentPackets,s=>s.commandReceipts=[],s=>s.schemaVersion='old',s=>s.projectId='foreign',s=>s.networkAdapterEnabled=true,s=>s.eventLog.events[0].operationEnvelope.payload.title='forged']){
    const bad=structuredClone(session);change(bad);assert.throws(()=>validate(bad,store,f.projectId));json(f.paths.session,bad);
    await assert.rejects(f.adapter.prepareMissingIntegrityAnchorRecovery(f.projectId));assert.equal(fs.existsSync(f.paths.anchor),false);
  }
  fs.writeFileSync(f.paths.session,f.protected['.stage10-local/product-session.v2.json']);
  const bad=structuredClone(store);bad.receipts[0].opId='forged';assert.throws(()=>validate(session,bad,f.projectId));
  assert.deepEqual(snapshot(f.root),f.protected);
});
test('missing-anchor recovery: corrupt current packet or historical packet and foreign canonical bytes refuse',async t=>{
  const f=await harness(t,{history:true}),source=snapshot(f.root),tree=await tx.readVerifiedProjectTreeMutation({manifestPath:f.manifestPath});
  const current=tx.recoveryPacketPathFor(f.manifestPath,tree.receipt.transactionId),historical=Object.keys(source).find(name=>name.startsWith('.yalken-recovery/wp201-')&&path.join(f.root,name)!==current);
  for(const target of [current,path.join(f.root,historical),path.join(f.root,f.ids[0]),path.join(f.root,'notes.craftsman.json')]){
    const before=fs.readFileSync(target);fs.writeFileSync(target,Buffer.concat([before,Buffer.from(' corrupt')]));
    await assert.rejects(f.adapter.prepareMissingIntegrityAnchorRecovery(f.projectId));assert.equal(fs.existsSync(f.paths.anchor),false);fs.writeFileSync(target,before);
  }
  assert.deepEqual(snapshot(f.root),source);
});
for(const field of ['pair','manifest','snapshot','selection'])test('missing-anchor recovery: '+field+' change during native confirmation refuses',async t=>{
  const f=await harness(t),main=mainPort(f,{choice:1,onDialog:async()=>{
    if(field==='pair')fs.appendFileSync(f.paths.session,' ');
    if(field==='manifest')fs.appendFileSync(f.manifestPath,' ');
    if(field==='snapshot')fs.writeFileSync(path.join(f.root,'foreign-private.txt'),'preserve');
    if(field==='selection')main.setDocuments(path.join(f.userData,'different'));
  }});
  await assert.rejects(main.sandbox.recoverMissingIntegrityAnchorAtStartup());assert.equal(main.calls.dialog,1);assert.equal(fs.existsSync(f.paths.anchor),false);
  const after=snapshot(f.root);for(const [name,bytes] of Object.entries(f.protected))if(!['.stage10-local/product-session.v2.json','project.craftsman.json'].includes(name))assert.deepEqual(after[name],bytes);
});
test('missing-anchor recovery: final selection change and last-instant anchor publication refuse under the real lease',async t=>{
  const f=await harness(t),candidate=await f.adapter.prepareMissingIntegrityAnchorRecovery(f.projectId);let checks=0;
  await assert.rejects(f.adapter.recoverMissingIntegrityAnchor(f.projectId,candidate,async()=>{if(++checks===3)throw Object.assign(Error('stale'),{code:'SELECTION_STALE'});}),e=>e.code==='SELECTION_STALE');
  assert.equal(fs.existsSync(f.paths.anchor),false);assert.deepEqual(snapshot(f.root),f.protected);
  checks=0;await assert.rejects(f.adapter.recoverMissingIntegrityAnchor(f.projectId,candidate,async()=>{if(++checks===3)fs.writeFileSync(f.paths.anchor,'foreign exclusive winner');}),e=>e.reason==='RECOVERY_ANCHOR_ALREADY_PRESENT');
  assert.equal(fs.readFileSync(f.paths.anchor,'utf8'),'foreign exclusive winner');assert.deepEqual(snapshot(f.root),f.protected);
});
for(const boundary of ['before-recovery-anchor-link','after-recovery-anchor-link'])test('missing-anchor recovery: publication interruption '+boundary+' has one normal reopen outcome',async t=>{
  const f=await harness(t),candidate=await f.adapter.prepareMissingIntegrityAnchorRecovery(f.projectId),fault=f.makeAdapter({onKillpoint:name=>{if(name===boundary)throw Error(boundary);}});
  await assert.rejects(fault.recoverMissingIntegrityAnchor(f.projectId,candidate,async()=>{}),new RegExp(boundary));
  assert.deepEqual(snapshot(f.root),f.protected);
  const reopened=f.createStage10ApplicationBootstrap({persistencePort:f.makeAdapter()});
  if(boundary.startsWith('before')){assert.equal(fs.existsSync(f.paths.anchor),false);await assert.rejects(reopened.reopenProjectRuntime({projectId:f.projectId}));}
  else {assert.equal((await reopened.reopenProjectRuntime({projectId:f.projectId})).readModels.replay.ok,true);assert.equal((await f.adapter.readStage10State(f.projectId)).integrityAnchor.anchorVersion,2);}
});
test('missing-anchor recovery: ordinary interrupted commit/reopen retains the new trust provenance',async t=>{
  const f=await harness(t),candidate=await f.adapter.prepareMissingIntegrityAnchorRecovery(f.projectId),receipt=await f.adapter.recoverMissingIntegrityAnchor(f.projectId,candidate,async()=>{});
  const fault=f.makeAdapter({onKillpoint:name=>{if(name==='after-session-write')throw Error('interrupted normal commit');}}),bootstrap=f.createStage10ApplicationBootstrap({persistencePort:fault});
  await bootstrap.reopenProjectRuntime({projectId:f.projectId});const stage=await import('../../src/product/stage10ProductWiring.mjs');
  await assert.rejects(bootstrap.dispatchProjectCommand(stage.STAGE10_PRODUCT_COMMAND_IDS.OPERATION_EXCHANGE_PREPARE,{projectId:f.projectId,sessionId:'crash'}),/interrupted normal commit/);
  const restored=f.createStage10ApplicationBootstrap({persistencePort:f.makeAdapter()});assert.equal((await restored.reopenProjectRuntime({projectId:f.projectId})).readModels.replay.ok,true);
  assert.deepEqual((await f.adapter.readStage10State(f.projectId)).integrityAnchor.recoveryRoot,receipt.recoveryRoot);
});

test('missing-anchor recovery: v1 digest compatibility and every v2 provenance binding are enforced',async t=>{
  const f=await harness(t),a=await import('../../src/product/stage10IntegrityAnchor.mjs');
  assert.equal(a.stage10IntegrityAnchorDigest(f.oldBundle.integrityAnchor),f.oldBundle.integrityAnchor.integrityAnchorDigest);
  assert.equal(a.validateStage10IntegrityAnchor(f.oldBundle.integrityAnchor,{projectId:f.projectId,session:f.oldBundle.session,authorityStore:f.oldBundle.authorityStore,previousAnchor:f.oldBundle.previousIntegrityAnchor}).ok,true);
  const candidate=await f.adapter.prepareMissingIntegrityAnchorRecovery(f.projectId);await f.adapter.recoverMissingIntegrityAnchor(f.projectId,candidate,async()=>{});
  const bundle=await f.adapter.readStage10State(f.projectId),options={projectId:f.projectId,session:bundle.session,authorityStore:bundle.authorityStore};
  for(const change of [v=>delete v.recoveryRoot,v=>v.recoveryRoot.trustBasis='ORIGINAL_TRUST_RECONSTRUCTED',v=>v.recoveryRoot.authorityGeneration=0,
    v=>v.recoveryRoot.authorityGeneration++,v=>v.recoveryRoot.sessionDigest='0'.repeat(64),v=>v.recoveryRoot.authorityStoreDigest='0'.repeat(64),
    v=>v.recoveryRoot.authorityHeadDigest='0'.repeat(64),v=>v.recoveryRoot.recoveryId='forged',v=>v.recoveryRoot.extra=true,v=>v.previousIntegrityAnchorDigest='f'.repeat(64)]){
    const bad=structuredClone(bundle.integrityAnchor);change(bad);bad.integrityAnchorDigest=a.stage10IntegrityAnchorDigest(bad);
    assert.equal(a.validateStage10IntegrityAnchor(bad,options).ok,false);
  }
  const forged=structuredClone(bundle.integrityAnchor);forged.anchorVersion=1;forged.schemaVersion=a.STAGE10_INTEGRITY_ANCHOR_SCHEMA;forged.integrityAnchorDigest=a.stage10IntegrityAnchorDigest(forged);
  assert.equal(a.validateStage10IntegrityAnchor(forged,options).ok,false);
});
test('missing-anchor recovery: coherent raw receipts cannot hide a wrong replayed Core result',async t=>{
  const f=await harness(t),session=structuredClone(f.oldBundle.session);session.coreState.data.projects[f.projectId].title='Unreplayed canonical title';
  const {validateStage10MissingAnchorRecoveryPair:validate}=await import('../../src/product/stage10ProductWiring.mjs');
  assert.throws(()=>validate(session,f.oldBundle.authorityStore,f.projectId),e=>e.code==='E_STAGE10_REOPEN_REPLAY_INVALID');
  json(f.paths.session,session);await assert.rejects(f.adapter.prepareMissingIntegrityAnchorRecovery(f.projectId),e=>e.code==='E_STAGE10_REOPEN_REPLAY_INVALID');
  assert.equal(fs.existsSync(f.paths.anchor),false);
});
test('missing-anchor recovery: another real project lease and lost lease metadata refuse publication',async t=>{
  const f=await harness(t),candidate=await f.adapter.prepareMissingIntegrityAnchorRecovery(f.projectId);
  await f.transactionAuthority.withProjectLease(f.projectId,async()=>{
    await assert.rejects(f.adapter.recoverMissingIntegrityAnchor(f.projectId,candidate,async()=>{}),e=>e.code==='E_PROJECT_LEASE_HELD');
  });
  let checks=0;
  await assert.rejects(f.adapter.recoverMissingIntegrityAnchor(f.projectId,candidate,async()=>{
    if(++checks===3){const metadata=path.join(f.paths.anchorRoot,'project-transaction.lease/owner.v3.json');const record=JSON.parse(fs.readFileSync(metadata));record.ownerTokenDigest='f'.repeat(64);json(metadata,record);}
  }),e=>typeof e.code==='string'&&e.code.startsWith('E_PROJECT_LEASE_'));
  assert.equal(fs.existsSync(f.paths.anchor),false);assert.deepEqual(snapshot(f.root),f.protected);
});
for(const boundary of ['before-recovery-anchor-link','after-recovery-anchor-link'])test('missing-anchor recovery: actual owned SIGKILL '+boundary+' preserves files and resolves in a new process',async t=>{
  const f=await harness(t),{spawn}=require('node:child_process');
  const program=`import{createStage10MainPersistenceAdapter}from ${JSON.stringify(path.join(ROOT,'src/product/stage10MainPersistenceAdapter.mjs'))};
const [projectRoot,anchorRoot,projectId,boundary]=process.argv.slice(1);const adapter=createStage10MainPersistenceAdapter({projectRoot,anchorRoot,useLeaseHeartbeatWorker:false,onKillpoint:async name=>{if(name===boundary){await new Promise(resolve=>process.stdout.write('HIT:'+name+'\\n',resolve));process.kill(process.pid,'SIGKILL');}}});
const candidate=await adapter.prepareMissingIntegrityAnchorRecovery(projectId);await adapter.recoverMissingIntegrityAnchor(projectId,candidate,async()=>{});`;
  const result=await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['--input-type=module','-e',program,f.root,f.anchorRoot,f.projectId,boundary],{stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
    const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('owned recovery child timeout'));},20000);
    child.stdout.on('data',value=>stdout+=value);child.stderr.on('data',value=>stderr+=value);child.on('error',reject);child.on('close',(code,signal)=>{clearTimeout(timer);resolve({code,signal,stdout,stderr});});
  });
  assert.equal(result.signal,'SIGKILL',JSON.stringify(result));assert.match(result.stdout,new RegExp('HIT:'+boundary));assert.deepEqual(snapshot(f.root),f.protected);
  const orphans=fs.readdirSync(f.paths.anchorRoot).filter(name=>/^\.recovery-[a-f0-9-]{36}\.tmp$/u.test(name));assert.equal(orphans.length,1);
  const orphanPath=path.join(f.paths.anchorRoot,orphans[0]),orphanBytes=fs.readFileSync(orphanPath);
  const expected=Object.fromEntries(Object.entries(f.protected).map(([name,bytes])=>[name,sha(bytes)]));
  const freshProgram=`import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import{createStage10MainPersistenceAdapter}from ${JSON.stringify(path.join(ROOT,'src/product/stage10MainPersistenceAdapter.mjs'))};
import{createStage10ApplicationBootstrap}from ${JSON.stringify(path.join(ROOT,'src/product/stage10ApplicationBootstrap.mjs'))};
const [projectRoot,anchorRoot,projectId,boundary,expectedJson]=process.argv.slice(1),expected=JSON.parse(expectedJson);
const observe=()=>{const rows={};const walk=dir=>{for(const name of fs.readdirSync(dir)){const full=path.join(dir,name);if(fs.lstatSync(full).isDirectory())walk(full);else rows[path.relative(projectRoot,full)]=crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');}};walk(projectRoot);return rows;};assert.deepEqual(observe(),expected);
const adapter=createStage10MainPersistenceAdapter({projectRoot,anchorRoot,useLeaseHeartbeatWorker:false,leaseNowMs:()=>Date.now()+120000});
let beforeMissingRefused=false,explicitRetry=false;const bootstrap=createStage10ApplicationBootstrap({persistencePort:adapter});
if(boundary.startsWith('before')){await assert.rejects(bootstrap.reopenProjectRuntime({projectId}),e=>e.reason==='PERSISTENCE_SPLIT_STATE_DETECTED');beforeMissingRefused=true;const candidate=await adapter.prepareMissingIntegrityAnchorRecovery(projectId);await adapter.recoverMissingIntegrityAnchor(projectId,candidate,async()=>{});explicitRetry=true;}
const reopened=await createStage10ApplicationBootstrap({persistencePort:adapter}).reopenProjectRuntime({projectId});assert.equal(reopened.readModels.replay.ok,true);assert.deepEqual(observe(),expected);
console.log(JSON.stringify({pid:process.pid,beforeMissingRefused,explicitRetry,ordinaryReopen:true,anchorVersion:(await adapter.readStage10State(projectId)).integrityAnchor.anchorVersion}));`;
  const fresh=require('node:child_process').spawnSync(process.execPath,['--input-type=module','-e',freshProgram,f.root,f.anchorRoot,f.projectId,boundary,JSON.stringify(expected)],{encoding:'utf8',timeout:20000});
  assert.equal(fresh.status,0,fresh.stderr);const observed=JSON.parse(fresh.stdout);assert.notEqual(observed.pid,process.pid);
  assert.equal(observed.ordinaryReopen,true);assert.equal(observed.anchorVersion,2);assert.equal(observed.explicitRetry,boundary.startsWith('before'));
  assert.deepEqual(fs.readFileSync(orphanPath),orphanBytes,'old orphan candidate remains exact; cleanup is not used as recovery');
  assert.deepEqual(snapshot(f.root),f.protected);
});

async function wordOriginHarness(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'yalken-recovery-word-origin-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const projectRoot=path.join(root,'project'),romanRoot=path.join(projectRoot,'roman'),manifestPath=path.join(projectRoot,'project.craftsman.json'),projectId='word-origin-recovery';
  fs.mkdirSync(romanRoot,{recursive:true});json(manifestPath,{schemaVersion:1,projectId,projectName:'Word',treeIdentity:{schemaVersion:1,nodes:{}}});
  const fixtureFile=require.resolve('./rtk-word-novel-import-partition.contract.test.js'),fixtureSource=fs.readFileSync(fixtureFile,'utf8');
  const fixtureModule=new Module(fixtureFile,module);fixtureModule.filename=fixtureFile;fixtureModule.paths=Module._nodeModulePaths(path.dirname(fixtureFile));fixtureModule.require=createRequire(fixtureFile);
  fixtureModule._compile("const {buildStoredZip}=require('../../src/export/docx/docxMinBuilder.js');const W_NS='http://schemas.openxmlformats.org/wordprocessingml/2006/main';\n"+named(fixtureSource,'novelBytes')+'\nmodule.exports=novelBytes;',fixtureFile);
  const bridge=await import('../../src/io/revisionBridge/index.mjs'),bytes=fixtureModule.exports(20),parsed=bridge.buildDocxContentPreviewFromZipBytes({bytes});assert.equal(parsed.ok,true);
  const plan=bridge.buildDocxNovelImportPreviewPlanFromContentPreview(parsed,{targetParagraphs:4});assert.equal(plan.ok,true);
  const mainSource=fs.readFileSync(path.join(ROOT,'src/main.js'),'utf8'),sandbox={fs:fsp,path,computeHash:sha,treeCohortError:code=>Object.assign(Error(code),{code})};
  vm.runInNewContext(named(mainSource,'readTreeCohortPath')+'\n'+named(mainSource,'captureTreeCohortInventory'),sandbox);
  const anchorRoot=path.join(root,'anchors'),{createMainProjectManifestAuthority}=await import('../../src/product/mainProjectManifestAuthority.mjs');
  const transactionAuthority=createMainProjectManifestAuthority({anchorRoot,useLeaseHeartbeatWorker:false});
  const authority=require('../fixtures/docx-import-real-authority.cjs'),safe=require('../../src/utils/docxImportSafeCreate.js');
  const options=await authority.withRealDocxImportAuthority({projectRoot,romanRoot,manifestPath,projectId,transactionAuthority,captureTreeCohortInventory:sandbox.captureTreeCohortInventory,importRequestNonce:'recovery-word-origin'});
  safe.rememberDocxImportPreviewPlanAdmission(plan);const imported=await safe.applyDocxImportSafeCreate({docxImportPreviewPlan:plan},options);assert.equal(imported.ok,true,JSON.stringify(imported.error));
  const {createStage10MainPersistenceAdapter}=await import('../../src/product/stage10MainPersistenceAdapter.mjs'),{createStage10ApplicationBootstrap}=await import('../../src/product/stage10ApplicationBootstrap.mjs');
  const adapter=createStage10MainPersistenceAdapter({projectRoot,anchorRoot,transactionAuthority,useLeaseHeartbeatWorker:false});
  await createStage10ApplicationBootstrap({persistencePort:adapter}).createProjectRuntime({projectId,title:'Word import preserved'});
  const paths=adapter.paths(projectId);fs.unlinkSync(paths.anchor);fs.unlinkSync(paths.anchorRecovery);
  return {root:projectRoot,adapter,paths,projectId,manifestPath,scenes:imported.value.receipt.createdScenes,createStage10ApplicationBootstrap};
}
test('missing-anchor recovery: real Word-origin novel uses the same strict root and ordinary reopen',async t=>{
  const f=await wordOriginHarness(t),before=snapshot(f.root),candidate=await f.adapter.prepareMissingIntegrityAnchorRecovery(f.projectId);
  assert.equal(candidate.sceneCount,f.scenes.length);assert.ok(candidate.sceneCount>1);
  await f.adapter.recoverMissingIntegrityAnchor(f.projectId,candidate,async()=>{});assert.deepEqual(snapshot(f.root),before);
  assert.equal((await f.createStage10ApplicationBootstrap({persistencePort:f.adapter}).reopenProjectRuntime({projectId:f.projectId})).readModels.replay.ok,true);
});
for(const origin of ['Yalken','Word'])test('missing-anchor recovery: '+origin+' extra active corrupt scene cannot hide outside the validated roster',async t=>{
  const f=origin==='Word'?await wordOriginHarness(t):await harness(t),manifest=JSON.parse(fs.readFileSync(f.manifestPath));
  manifest.treeIdentity.nodes['tree-node-'+sha('foreign').slice(0,32)]={kind:'scene',present:true,bindingKey:'file:roman/foreign.txt'};
  json(f.manifestPath,manifest);fs.writeFileSync(path.join(f.root,'roman/foreign.txt'),'unverified data');
  await assert.rejects(f.adapter.prepareMissingIntegrityAnchorRecovery(f.projectId));assert.equal(fs.existsSync(f.paths.anchor),false);
  assert.equal(fs.readFileSync(path.join(f.root,'roman/foreign.txt'),'utf8'),'unverified data');
});

test('missing-anchor recovery: duplicate raw JSON keys refuse before normalization and never replace trust',async t=>{
  const f=await harness(t),original=fs.readFileSync(f.paths.session,'utf8');
  fs.writeFileSync(f.paths.session,original.replace('{','{\n  "projectId": "foreign",'));
  await assert.rejects(f.adapter.prepareMissingIntegrityAnchorRecovery(f.projectId),e=>e.reason==='RECOVERY_RAW_PAIR_WIRE_INVALID');
  assert.equal(fs.existsSync(f.paths.anchor),false);assert.equal(fs.readFileSync(f.paths.authority).equals(f.protected['.stage10-local/command-receipt-authority-store.v2.json']),true);
});
test('missing-anchor recovery: genuinely expired existing lease refuses publication without changing product files',async t=>{
  const f=await harness(t),candidate=await f.adapter.prepareMissingIntegrityAnchorRecovery(f.projectId);
  const {createProjectLeaseManager}=await import('../../src/product/projectLease.mjs'),{createMainProjectManifestAuthority}=await import('../../src/product/mainProjectManifestAuthority.mjs');
  let offset=0;const leaseManager=createProjectLeaseManager({leaseRoot:f.anchorRoot,nowMs:()=>Date.now()+offset,nowMonotonicMs:()=>Number(process.hrtime.bigint()/1000000n)+offset,useProcessInstanceGuard:false,useHeartbeatWorker:false,ttlMs:5000});
  const authority=createMainProjectManifestAuthority({anchorRoot:f.anchorRoot,leaseManager});
  const adapter=f.makeAdapter({transactionAuthority:authority,onKillpoint:name=>{if(name==='before-recovery-anchor-link')offset=120000;}});
  await assert.rejects(adapter.recoverMissingIntegrityAnchor(f.projectId,candidate,async()=>{}),e=>e.code==='E_STAGE10_RECOVERY_LEASE_EXPIRED');
  assert.equal(fs.existsSync(f.paths.anchor),false);assert.deepEqual(snapshot(f.root),f.protected);
});

test('missing-anchor recovery: selection changes during the final real snapshot and publication is refused',async t=>{
  const f=await harness(t),read=fsp.readFile;let armed=false,manifestReads=0,changed=false;
  const main=mainPort(f,{choice:1,onDialog:async()=>{armed=true;}});
  fsp.readFile=async(target,...args)=>{
    const value=await read(target,...args);
    if(armed && target===f.manifestPath && ++manifestReads===4){changed=true;main.setDocuments(path.join(f.userData,'changed-during-final-snapshot'));}
    return value;
  };
  try {await assert.rejects(main.sandbox.recoverMissingIntegrityAnchorAtStartup(),e=>e.code==='E_STAGE10_RECOVERY_SELECTION_STALE');}
  finally {fsp.readFile=read;}
  assert.equal(changed,true,'the final Core snapshot was entered before selection changed');assert.equal(fs.existsSync(f.paths.anchor),false);assert.deepEqual(snapshot(f.root),f.protected);
});
