'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const tx = require('../../src/core/project-transaction-v1.cjs');
const childFile = path.join(__dirname, '../fixtures/word-import-transaction-child.cjs');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'word-tx-resources-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const manifestPath = path.join(root, 'project.json'), scenePath = path.join(root, 'roman', 'imported.txt');
  fs.mkdirSync(path.dirname(scenePath));
  fs.writeFileSync(manifestPath, '{"projectId":"tx-resources","revision":0}');
  const shared = path.join(root, 'shared.png'); fs.writeFileSync(shared, 'existing shared bytes');
  return { root, manifestPath, scenePath, shared };
}
function child(root, mode, killAt = '') {
  return new Promise((resolve, reject) => {
    const processHandle = spawn(process.execPath, [childFile, root, mode, killAt], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    let stdout = '', stderr = '', point;
    const timer = setTimeout(() => { processHandle.kill('SIGKILL'); reject(Error('owned transaction child timeout')); }, 15000);
    processHandle.stdout.on('data', x => { stdout += x; });
    processHandle.stderr.on('data', x => { stderr += x; });
    processHandle.on('message', value => { point = value.point; if (point === killAt && mode === 'crash') processHandle.kill('SIGKILL'); });
    processHandle.on('error', reject);
    processHandle.on('close', (code, signal) => { clearTimeout(timer); resolve({ code, signal, point, stdout, stderr }); });
  });
}
for (const boundary of ['PREPARE', 'ASSET_LINK', 'RECEIPT_LINK', 'MANIFEST', 'SCENE', 'COMMIT', 'BEFORE_CLEANUP', 'AFTER_CLEANUP']) {
  test(`Word transaction: parent SIGKILL at ${boundary}, new process recovers coherent create`, async t => {
    const f = fixture(t), crashed = await child(f.root, 'crash', boundary);
    assert.equal(crashed.point, boundary, crashed.stderr);
    assert.equal(crashed.signal, 'SIGKILL');
    const recovered = await child(f.root, 'recover');
    assert.equal(recovered.code, 0, recovered.stderr);
    const committed = ['COMMIT', 'BEFORE_CLEANUP', 'AFTER_CLEANUP'].includes(boundary);
    assert.equal(JSON.parse(recovered.stdout).committed, committed);
    assert.equal(fs.existsSync(f.scenePath), committed);
    assert.equal(fs.existsSync(path.join(f.root, 'assets/new.png')), committed);
    assert.equal(fs.existsSync(path.join(f.root, '.yalken/receipts/operation.json')), committed);
    assert.equal(JSON.parse(fs.readFileSync(f.manifestPath)).revision, committed ? 1 : 0);
    assert.equal(fs.readFileSync(f.shared, 'utf8'), 'existing shared bytes');
    assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)), false);
    if (!committed) {
      const retry = await child(f.root, 'create');
      assert.equal(retry.code, 0, retry.stderr);
      assert.equal(JSON.parse(retry.stdout).success, true);
    }
    const replay = await child(f.root, 'recover');
    assert.equal(replay.code, 0, replay.stderr);
    assert.equal(JSON.parse(replay.stdout).committed, true);
  });
}

test('Word transaction: divergent companion blocks rollback without touching scene, manifest or shared asset', async t => {
  const f = fixture(t); assert.equal((await child(f.root, 'crash', 'MANIFEST')).signal, 'SIGKILL');
  const asset = path.join(f.root, 'assets/new.png'); fs.writeFileSync(asset, 'foreign replacement');
  const before = fs.readFileSync(f.manifestPath);
  const result = await child(f.root, 'recover');
  assert.equal(result.code, 1); assert.match(result.stderr, /RESOURCE_DIVERGENCE/);
  assert.deepEqual(fs.readFileSync(f.manifestPath), before);
  assert.equal(fs.readFileSync(asset, 'utf8'), 'foreign replacement');
  assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)), true);
  assert.equal(fs.readFileSync(f.shared, 'utf8'), 'existing shared bytes');
});

test('Word transaction: hostile resource paths, duplicates and aggregate budget fail before intent/publication', async t => {
  const f = fixture(t); let publishes = 0;
  const request = resources => tx.commitProjectTransaction({ scenePath: f.scenePath, manifestPath: f.manifestPath,
    sceneContent: 'new', expectedSceneContent: null, manifestContent: '{"revision":1}',
    expectedManifestContent: fs.readFileSync(f.manifestPath, 'utf8'), revision: 1,
    publishManifest: async () => { publishes++; }, createResources: resources });
  for (const resources of [
    [{ path: path.join(f.root, '../escape'), content: 'bad' }],
    [{ path: f.manifestPath, content: 'bad' }],
    [{ path: f.scenePath, content: 'bad' }],
    [{ path: path.join(f.root, 'a'), content: 'x' }, { path: path.join(f.root, 'a'), content: 'y' }],
    [{ path: path.join(f.root, 'a'), content: Buffer.alloc(20 * 1024 * 1024 + 1) }],
  ]) await assert.rejects(request(resources), /RESOURCE_/);
  assert.equal(publishes, 0); assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)), false);
});

test('Word transaction: symlinked companion parent and pre-existing file are never overwritten', async t => {
  const f = fixture(t); fs.mkdirSync(path.join(f.root, 'protected')); fs.symlinkSync(path.join(f.root, 'protected'), path.join(f.root, 'link'));
  const before = fs.readFileSync(f.manifestPath);
  for (const target of [path.join(f.root, 'link/a'), f.shared]) {
    await assert.rejects(tx.commitProjectTransaction({ scenePath: f.scenePath, manifestPath: f.manifestPath,
      sceneContent: 'new', expectedSceneContent: null, manifestContent: '{}', expectedManifestContent: before.toString(),
      revision: 1, publishManifest: async () => assert.fail('must not publish'),
      createResources: [{ path: target, content: 'new' }] }), /RESOURCE_(BOUNDARY|EXISTS)/);
  }
  assert.deepEqual(fs.readFileSync(f.manifestPath), before);
  assert.equal(fs.readFileSync(f.shared, 'utf8'), 'existing shared bytes');
  assert.equal(fs.existsSync(tx.journalPathFor(f.manifestPath)), false);
});

for(const [beforeVersion,afterVersion] of [...[1,2,3,4].map(v=>[v,4]),...[1,2,3,4,5].map(v=>[v,5])]) test(`Word comment graph transaction admits monotonic v${beforeVersion} to v${afterVersion} append and rejects downgrade`,async t=>{
 const f=fixture(t),commentPath=path.join(f.root,'.yalken/word-review/non-text-return-state.v1.json');
 const {deriveCommentAnchor}=require('../../src/core/word-comment-ranges-v1.cjs');
 const sceneId='roman/imported.txt',before={schemaVersion:`yalken.rtk.word.non-text-return-state.v${beforeVersion}`,projectId:'tx-resources',revision:0,threads:[],events:[]};
 const after={...before,schemaVersion:`yalken.rtk.word.non-text-return-state.v${afterVersion}`,revision:1,threads:[{threadId:'multi',sceneId,rootCommentId:'root',status:'open',messages:[{commentId:'root',kind:'root',body:'Retained'}],anchor:deriveCommentAnchor({sceneId,paragraphs:['Alpha','Beta'],input:{kind:'multi-paragraph-range',paragraphIndex:0,startUtf16:0,endParagraphIndex:1,endUtf16:4}})}]};
 fs.mkdirSync(path.dirname(commentPath),{recursive:true});fs.writeFileSync(commentPath,JSON.stringify(before));
 const priorManifest=fs.readFileSync(f.manifestPath,'utf8');let published=0;
 const request={scenePath:f.scenePath,manifestPath:f.manifestPath,sceneContent:'Alpha\nBeta',expectedSceneContent:null,expectedManifestContent:priorManifest,manifestContent:JSON.stringify({projectId:'tx-resources',revision:1}),revision:1,createResources:[{path:path.join(f.root,'.yalken/receipts/multi.json'),content:'receipt'}],commentState:{beforeText:JSON.stringify(before),afterText:JSON.stringify(after)},publishManifest:async({expectedText,nextText})=>{assert.equal(fs.readFileSync(f.manifestPath,'utf8'),expectedText);published++;fs.writeFileSync(f.manifestPath,nextText);}};
 if(beforeVersion===afterVersion) {
  for(const downgrade of Array.from({length:beforeVersion-1},(_,i)=>i+1)) {const bad={...after,schemaVersion:`yalken.rtk.word.non-text-return-state.v${downgrade}`};await assert.rejects(tx.commitProjectTransaction({...request,commentState:{...request.commentState,afterText:JSON.stringify(bad)}}),/COMMENT_STATE/);}
  assert.equal(published,0);assert.equal(fs.existsSync(f.scenePath),false);assert.equal(fs.readFileSync(commentPath,'utf8'),JSON.stringify(before));
 }
 const result=await tx.commitProjectTransaction(request);assert.equal(result.success,true,JSON.stringify(result));
 assert.deepEqual(JSON.parse(fs.readFileSync(commentPath,'utf8')),after);
 await tx.recoverProjectTransaction({scenePath:f.scenePath,manifestPath:f.manifestPath,publishManifest:request.publishManifest});
 assert.deepEqual(JSON.parse(fs.readFileSync(commentPath,'utf8')),after);
});
