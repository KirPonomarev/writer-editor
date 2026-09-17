const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../..');
const load=name=>import(pathToFileURL(path.join(root,'scripts/ops',name)).href);
test('fixed JS corpora agree with an independently implemented Python oracle at every word',async()=>{
 const {WORD_VOLUME_IDS,buildWordVolumeFixture}=await load('rtk-interop-word-volume-fixtures.mjs');
 for(const volume of WORD_VOLUME_IDS){
  const fixture=buildWordVolumeFixture(volume);
  const child=spawnSync('python3',['-I','-B','-c',"import importlib.util,json,sys; s=importlib.util.spec_from_file_location('v',sys.argv[1]); v=importlib.util.module_from_spec(s); s.loader.exec_module(v); print(json.dumps(v.expected_scenes(sys.argv[2]),ensure_ascii=False))",'scripts/ops/rtk-interop-word-volume-readback.py',volume],{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:16*1024*1024});
  assert.equal(child.status,0,child.stderr);assert.deepEqual(fixture.scenes.map(s=>s.paragraphs),JSON.parse(child.stdout));
 }
});
test('volume independent reader executes corruption, volume, native text and filesystem adversaries',()=>{
 const child=spawnSync('python3',['-I','-B','test/unit/rtk-interop-word-volume.test.py'],{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
 assert.equal(child.status,0,child.stdout+child.stderr);assert.match(child.stderr,/Ran 10 tests/);assert.match(child.stderr,/\nOK\n/);
});
test('all sixteen exact journeys are distinct and repeats and wrong profiles provide no cells',async()=>{
 const {WORD_BATCH_CELLS,validateWordBatchRuns}=await load('rtk-interop-word-text-order-batch.mjs');
 const runs=WORD_BATCH_CELLS.filter(c=>c.startsWith('ORDER__')).map(c=>c+'__contract');
 assert.equal(validateWordBatchRuns(runs).length,16);
 for(const bad of [[...runs,runs[0]],runs.map((r,i)=>i===1?runs[0].replace('contract','second'):r),[runs[0].replace('SINGLE_SCENE','MILLION_WORDS')],[runs[0].replace('C1','C3')]])assert.throws(()=>validateWordBatchRuns(bad),/WORD_BATCH_/);
});
test('volume proof has only stdlib raw readers and fixed expected corpora',()=>{
 const s=fs.readFileSync(path.join(root,'scripts/ops/rtk-interop-word-volume-readback.py'),'utf8');
 assert.doesNotMatch(s,/import (?:subprocess|requests)|src\/io|expectedParagraphs\]/);
 assert.match(s,/checked_read\(root,b\)==files/);
});
