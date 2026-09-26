const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const {createReviewSecretStore}=require('../../src/core/review-secret-store-v1.cjs');
const bridgePath=path.resolve(__dirname,'../../src/io/revisionBridge/reviewTransportRoundStoreV3.mjs');
// Test-only encryption port; production receives Electron OS safeStorage.
function testEncryption() {
 const key=Buffer.alloc(32,0x5a);
 return {isEncryptionAvailable:()=>true,getSelectedStorageBackend:()=> 'gnome_libsecret',encryptString(s){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key,iv);const b=Buffer.concat([c.update(s,'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),b]);},decryptString(b){const c=crypto.createDecipheriv('aes-256-gcm',key,b.subarray(0,12));c.setAuthTag(b.subarray(12,28));return Buffer.concat([c.update(b.subarray(28)),c.final()]).toString('utf8');}};
}
function roots(t) {const root=fs.mkdtempSync(path.join(os.tmpdir(),'rtk-key-'));const project=path.join(root,'project');fs.mkdirSync(project);t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return{root,project};}
function port(r,extra={}) {return createReviewSecretStore({userDataRoot:r.root,projectRoot:r.project,safeStorage:testEncryption(),...extra});}
function file(r,ref) {return path.join(fs.realpathSync(r.root),'review-round-keys-v1',crypto.createHash('sha256').update(fs.realpathSync(r.project)).digest('hex'),ref+'.key');}
const childCode=`const fs=require('node:fs'),crypto=require('node:crypto');const {createReviewSecretStore}=require(${JSON.stringify(path.resolve(__dirname,'../../src/core/review-secret-store-v1.cjs'))});const testEncryption=${testEncryption.toString()};(async()=>{const q=JSON.parse(fs.readFileSync(0,'utf8'));const b=await import(${JSON.stringify(pathToFileURL(bridgePath).href)});const persistence=createReviewSecretStore({userDataRoot:q.root,projectRoot:q.project,safeStorage:testEncryption()});let k=q.key;if(q.op==='create')k=b.createRoundKey({roundId:'round-1',persistence});let h=b.resolveRoundKey(k.keyRef,{persistence,roundId:'round-1',keyIdHex:k.keyIdHex,roundIdHex:k.roundIdHex});if(q.op==='revoke')b.revokeRoundKey(k.keyRef);if(q.op==='lose')b.markRoundKeyLost(k.keyRef);process.stdout.write(JSON.stringify({key:k,state:h?.state||null,signature:h?.sign({text:'same payload'})||null,verified:h?.verify({text:'same payload'},q.signature)||false,secretAvailable:!!h?.hmacSecret()}));})().catch(e=>{process.stderr.write(e.message);process.exitCode=1;});`;
function child(r,q){const c=spawnSync(process.execPath,['-e',childCode],{input:JSON.stringify({...r,...q}),encoding:'utf8'});assert.equal(c.status,0,c.stderr);return JSON.parse(c.stdout);}

test('key survives a real new process; encrypted bytes contain no secret and cross-project resolve fails',async t=>{
 const r=roots(t),a=child(r,{op:'create'}),b=child(r,{op:'resolve',key:a.key,signature:a.signature});assert.equal(a.state,'ACTIVE');assert.equal(b.signature,a.signature);assert.equal(b.verified,true);
 const p=port(r),entry=p.read(a.key.keyRef),bytes=fs.readFileSync(file(r,a.key.keyRef));assert(!bytes.includes(Buffer.from(entry.secret)));assert(!bytes.includes(Buffer.from('"secret"')));assert(!JSON.stringify(a.key).includes(entry.secret));
 const other=path.join(r.root,'other');fs.mkdirSync(other);assert.equal(child({...r,project:other},{op:'resolve',key:a.key}).state,null);
 if(process.platform!=='win32')assert.equal(fs.statSync(file(r,a.key.keyRef)).mode&0o777,0o600);
});

test('revocation and loss persist; already obtained handles lose signing capability',async t=>{
 const r=roots(t),a=child(r,{op:'create'});const revoked=child(r,{op:'revoke',key:a.key,signature:a.signature});assert.equal(revoked.state,'REVOKED');assert.equal(revoked.signature,null);assert.equal(revoked.verified,true);
 const fresh=child(r,{op:'resolve',key:a.key,signature:a.signature});assert.equal(fresh.state,'REVOKED');assert.equal(fresh.signature,null);assert.equal(fresh.verified,true);
 child(r,{op:'lose',key:a.key});const lost=child(r,{op:'resolve',key:a.key,signature:a.signature});assert.equal(lost.state,'LOST');assert.equal(lost.signature,null);assert.equal(lost.verified,false);assert.equal(lost.secretAvailable,false);
 const p=port(r),e=p.read(a.key.keyRef);assert.throws(()=>p.write(a.key.keyRef,{...e,state:'ACTIVE'}),/STATE_CONFLICT/);
});

test('missing, corrupt, oversized, symlink and foreign identity records never restore a key',async t=>{
 const r=roots(t),a=child(r,{op:'create'}),f=file(r,a.key.keyRef),original=fs.readFileSync(f),p=port(r);
 fs.unlinkSync(f);assert.equal(child(r,{key:a.key}).state,null);
 fs.writeFileSync(f,Buffer.alloc(16385),{mode:0o600});assert.equal(child(r,{key:a.key}).state,null);
 fs.writeFileSync(f,Buffer.from('corrupt'));assert.equal(child(r,{key:a.key}).state,null);
 fs.unlinkSync(f);const target=path.join(r.root,'protected');fs.writeFileSync(target,original,{mode:0o600});fs.symlinkSync(target,f);assert.equal(child(r,{key:a.key}).state,null);assert.throws(()=>p.write(a.key.keyRef,{secret:'a'.repeat(64)}));assert.deepEqual(fs.readFileSync(target),original);
 fs.unlinkSync(f);const safe=testEncryption(),record=JSON.parse(safe.decryptString(original));record.projectBinding='b'.repeat(64);fs.writeFileSync(f,safe.encryptString(JSON.stringify(record)),{mode:0o600});assert.equal(child(r,{key:a.key}).state,null);
});

test('OS protection unavailable or Linux plaintext backend rejects writes without fallback',t=>{
 const r=roots(t);const ref='c'.repeat(64);const e={secret:'a'.repeat(64),state:'ACTIVE',keyIdHex:crypto.createHash('sha256').update('a'.repeat(64)).digest('hex').slice(0,32),roundIdHex:'b'.repeat(32),createdAt:new Date().toISOString()};
 for(const extra of [{safeStorage:{...testEncryption(),isEncryptionAvailable:()=>false}},{platform:'linux',safeStorage:{...testEncryption(),getSelectedStorageBackend:()=> 'basic_text'}}])assert.throws(()=>port(r,extra).write(ref,e),/ENCRYPTION_UNAVAILABLE/);
 assert(!fs.existsSync(path.join(r.root,'review-round-keys-v1')));
});

test('round identity mismatch and persistent write failure cannot authorize an active key',async t=>{
 const r=roots(t),b=await import(pathToFileURL(bridgePath).href),p=port(r),k=b.createRoundKey({roundId:'identity',persistence:p});
 for(const mismatch of [{roundId:'wrong'},{keyIdHex:'e'.repeat(32)},{roundIdHex:'d'.repeat(32)}])assert.equal(b.resolveRoundKey(k.keyRef,{persistence:p,...mismatch}),null);
 const h=b.resolveRoundKey(k.keyRef,{persistence:p,roundId:'identity'});assert(h.sign({a:1}));b.revokeRoundKey(k.keyRef);assert.equal(h.state,'REVOKED');assert.equal(h.sign({a:1}),null);
 assert.throws(()=>b.createRoundKey({roundId:'write-failure',persistence:{write(){throw Error('disk full');}}}),/disk full/);
 const failing={projectBinding:'test-failure',write(){}};const x=b.createRoundKey({roundId:'restriction-failure',persistence:failing});const handle=b.resolveRoundKey(x.keyRef);failing.write=()=>{throw Error('disk full');};assert.equal(b.revokeRoundKey(x.keyRef).code,'RTK_ROUND_KEY_PERSIST_FAILED');assert.equal(handle.sign({a:1}),null);
});


test('a cached handle observes durable revocation and missing ciphertext fails closed',async t=>{
 const r=roots(t),b=await import(pathToFileURL(bridgePath).href),p=port(r),k=b.createRoundKey({roundId:'round-1',persistence:p});
 const h=b.resolveRoundKey(k.keyRef,{persistence:p});assert(h.sign({a:1}));
 child(r,{op:'revoke',key:k});assert.equal(b.resolveRoundKey(k.keyRef,{persistence:p}).state,'REVOKED');assert.equal(h.sign({a:1}),null);
 fs.unlinkSync(file(r,k.keyRef));assert.equal(b.resolveRoundKey(k.keyRef,{persistence:p}),null);assert.equal(h.state,'LOST');
});

const vm=require('node:vm');
const mainSource=fs.readFileSync(path.resolve(__dirname,'../../src/main.js'),'utf8');
function mainFunction(name,next){const start=mainSource.indexOf('async function '+name+'(');assert(start>=0);const end=mainSource.indexOf('async function '+next+'(',start);assert(end>start);return mainSource.slice(start,end).split("\nlet ")[0];}
test('Kernel formatting and structural Apply revalidate the private live key and session before any writer',async()=>{
 for(const kind of ['formatting','structural','text','full-text'])for(const state of ['ACTIVE','REVOKED','VERIFY_ONLY','LOST',null]){
  let writes=0;let keyState=state;
  const input={projectRoot:'/test-project',requestId:'private-request',operations:[{operationId:'op'}]};
  const store={input,keyAuthority:{keyRef:'private-ref',roundId:'private-round',projectRoot:'/test-project'},inputsByKey:{change:input},fullManuscriptInput:input};
  const env={isPlainObjectValue:x=>!!x&&typeof x==='object'&&!Array.isArray(x),getProjectRootPath:()=>'/test-project',
   activeRtkFormattingReturnApplyStore:store,activeRtkStructuralReturnApplyStore:store,
   activeRtkNonOverlapTrackedReplacementApplyStore:store,activeReviewSessionStore:{},rtkNonOverlapTrackedReplacementStoreTokenMatches:()=>true,
   queueDiskOperation:async f=>f(),publishReviewSceneWithProjectTransaction:()=>{throw Error("unexpected writer");},
   loadRtkNonOverlapTrackedReplacementModule:async()=>({createRtkNonOverlapTrackedReplacementCommandHandler:()=>async()=>{writes++;return{ok:true};}}),
   loadRtkMultiSceneNonOverlapTrackedReplacementModule:async()=>({createRtkMultiSceneNonOverlapTrackedReplacementCommandHandler:()=>async()=>{writes++;return{ok:true};}}),
   rtkFormattingReturnStoreMatchesActiveSession:()=>true,rtkStructuralReturnStoreMatchesActiveSession:()=>true,
   resolveDocxReviewRoundKeyHandle:async(ref,authority)=>{assert.equal(ref,'private-ref');assert.equal(authority.roundId,'private-round');return keyState?{state:keyState}:null;},
   createRtkReviewTransportCryptoPort:()=>({}),makeReviewMutateTypedError:()=>({ok:false}),
   loadRtkFormattingReturnModule:async()=>({createRtkFormattingReturnCommandHandler:()=>async()=>{writes++;return{ok:true};}}),
   loadRtkStructuralReturnModule:async()=>({createRtkStructuralReturnCommandHandler:()=>async()=>{writes++;return{ok:true};}})};
  vm.createContext(env);vm.runInContext(mainFunction('handleRtkNonOverlapTrackedReplacementCommandSurface','handleRtkMultiSceneNonOverlapTrackedReplacementCommandSurface')+mainFunction('handleRtkMultiSceneNonOverlapTrackedReplacementCommandSurface','revalidateRtkReturnApplyKey')+mainFunction('revalidateRtkReturnApplyKey','handleRtkFormattingReturnCommandSurface')+mainFunction('handleRtkFormattingReturnCommandSurface','handleRtkStructuralReturnCommandSurface')+mainFunction('handleRtkStructuralReturnCommandSurface','buildRtkFormattingReturnRuntimeProjectScope'),env);
  const call=kind==='text'?env.handleRtkNonOverlapTrackedReplacementCommandSurface:kind==='full-text'?env.handleRtkMultiSceneNonOverlapTrackedReplacementCommandSurface:kind==='formatting'?env.handleRtkFormattingReturnCommandSurface:env.handleRtkStructuralReturnCommandSurface;
  const result=await call(JSON.parse(JSON.stringify(input)));assert.equal(result.ok,state==='ACTIVE',JSON.stringify({kind,state,result}));assert.equal(writes,state==='ACTIVE'?1:0);
  writes=0;keyState='ACTIVE';assert.equal((await call({...input,requestId:'forged'})).ok,false);assert.equal(writes,0);
  env.resolveDocxReviewRoundKeyHandle=async()=>{env.activeRtkFormattingReturnApplyStore=null;env.activeRtkStructuralReturnApplyStore=null;env.activeRtkNonOverlapTrackedReplacementApplyStore=null;return{state:'ACTIVE'};};
  assert.equal((await call(input)).code,'RTK_ROUND_KEY_STALE_AUTHORITY');assert.equal(writes,0);
 }
});
