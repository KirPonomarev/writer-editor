'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const locationModel = require('../../src/core/project-location-v1.cjs').createProjectLocationAdapter({
  fsAdapter: fs, path, sha256: value => crypto.createHash('sha256').update(value).digest('hex'),
});
const transaction = require('../../src/core/project-transaction-v1.cjs');

async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'project-location-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const beforeRoot = path.join(root, 'Before'), currentRoot = path.join(root, 'After β 夜');
  await fs.mkdir(path.join(beforeRoot, 'roman'), { recursive: true });
  const beforeManifest = path.join(beforeRoot, 'project.craftsman.json'), beforeScene = path.join(beforeRoot, 'roman', 'scene.txt');
  const projectId = 'project-location-fixture';
  const manifestText = JSON.stringify({ schemaVersion: 1, projectId, projectName: 'Before', unknown: { preserved: true } }) + '\n';
  await fs.writeFile(beforeManifest, manifestText);
  await fs.writeFile(beforeScene, 'initial');
  await transaction.commitProjectTransaction({ manifestPath: beforeManifest, scenePath: beforeScene,
    manifestContent: manifestText, expectedManifestContent: manifestText,
    sceneContent: 'Сцена é 🧭', expectedSceneContent: 'initial', revision: 1, publishManifest: async () => {} });
  const commitBytes = await fs.readFile(transaction.commitPathFor(beforeScene));
  const original = await locationModel.getProjectLocation({ manifestPath: beforeManifest, projectId });
  const manifestPath = path.join(currentRoot, 'project.craftsman.json'), scenePath = path.join(currentRoot, 'roman', 'scene.txt');
  const binding = locationModel.createLocationRecord(original, projectId, manifestPath);
  const bindingText = JSON.stringify(binding) + '\n';
  await fs.writeFile(locationModel.locationPathFor(beforeManifest), bindingText);
  await fs.rename(beforeRoot, currentRoot);
  return { root, beforeRoot, currentRoot, beforeManifest, beforeScene, manifestPath, scenePath, projectId, manifestText, binding, bindingText, commitBytes };
}

test('location routes unchanged historical commits only inside the current root', async t => {
  const f = await fixture(t);
  await fs.mkdir(path.dirname(f.beforeScene), { recursive: true });
  await fs.writeFile(f.beforeScene, 'foreign old-location sentinel');
  const context = await locationModel.getProjectLocation(f);
  assert.equal(context.manifestPath, f.beforeManifest);
  assert.equal(await context.fsAdapter.readFile(f.beforeScene, 'utf8'), 'Сцена é 🧭');
  assert.equal(await context.fsAdapter.realpath(f.beforeScene), f.beforeScene);
  const verified = await transaction.readVerifiedProjectTransaction(f);
  assert.equal(verified.scenePath, f.scenePath);
  assert.equal(verified.manifestPath, f.manifestPath);
  assert.deepEqual(await fs.readFile(transaction.commitPathFor(f.scenePath)), f.commitBytes);
  await transaction.commitProjectTransaction({ ...f, manifestContent: f.manifestText, expectedManifestContent: f.manifestText,
    sceneContent: 'Saved Ω 東京', expectedSceneContent: 'Сцена é 🧭', revision: 2, publishManifest: async () => {} });
  assert.equal(await fs.readFile(f.scenePath, 'utf8'), 'Saved Ω 東京');
  assert.equal(await fs.readFile(f.beforeScene, 'utf8'), 'foreign old-location sentinel');
  const stored = JSON.parse(await fs.readFile(transaction.commitPathFor(f.scenePath), 'utf8'));
  assert.equal(stored.scenePath, f.beforeScene);
  assert.equal(stored.manifestPath, f.beforeManifest);
});

test('location is not authority for changed content or missing manifest continuation', async t => {
  const f = await fixture(t);
  const { createMainProjectManifestAuthority } = await import('../../src/product/mainProjectManifestAuthority.mjs');
  const authority = createMainProjectManifestAuthority({ anchorRoot: path.join(f.root, 'anchors') });
  const next = JSON.stringify({ ...JSON.parse(f.manifestText), projectName: 'After' }) + '\n';
  await authority.commitManifestText({ projectId: f.projectId, targetPath: f.manifestPath, expectedText: f.manifestText, nextText: next });
  await assert.rejects(transaction.readVerifiedProjectTransaction(f), { code: 'E_PROJECT_TRANSACTION_COMMIT_READBACK' });
  const verified = await transaction.readVerifiedProjectTransaction({ ...f,
    verifyManifestContinuation: request => authority.verifyManifestContinuation({ ...request, projectId: f.projectId }) });
  assert.equal(verified.sceneDigest, crypto.createHash('sha256').update('Сцена é 🧭').digest('hex'));
  await fs.writeFile(f.scenePath, 'foreign changed content');
  await assert.rejects(transaction.readVerifiedProjectTransaction({ ...f,
    verifyManifestContinuation: request => authority.verifyManifestContinuation({ ...request, projectId: f.projectId }) }), { code: 'E_PROJECT_TRANSACTION_COMMIT_READBACK' });
});

test('location rejects a foreign project, foreign current root, extra fields and invalid historical path', async t => {
  for (const patch of [{ projectId: 'foreign' }, { physicalManifestPath: '/foreign/project.craftsman.json' },
    { extra: true }, { logicalManifestPath: 'relative/project.craftsman.json' }]) {
    const f = await fixture(t);
    await fs.writeFile(locationModel.locationPathFor(f.manifestPath), JSON.stringify({ ...f.binding, ...patch }));
    await assert.rejects(transaction.readVerifiedProjectTransaction(f), { code: 'E_PROJECT_LOCATION_INVALID' });
    assert.deepEqual(await fs.readFile(transaction.commitPathFor(f.scenePath)), f.commitBytes);
  }
});

test('location rejects paths outside both roots and prefix-confusable siblings', async t => {
  const f = await fixture(t), context = await locationModel.getProjectLocation(f);
  for (const target of [path.join(f.root, 'outside'), `${f.beforeRoot}-foreign/scene.txt`, path.join(f.beforeRoot, '..', 'outside')]) {
    await assert.rejects(context.fsAdapter.readFile(target), { code: 'E_PROJECT_LOCATION_BOUNDARY' });
    await assert.rejects(context.fsAdapter.open(target, 'w'), { code: 'E_PROJECT_LOCATION_BOUNDARY' });
  }
  assert.throws(() => context.toLogical(f.beforeScene), { code: 'E_PROJECT_LOCATION_BOUNDARY' });
});

test('location rejects symlink metadata and descendant paths without touching their targets', async t => {
  const f = await fixture(t), outside = path.join(f.root, 'outside');
  await fs.mkdir(outside);
  await fs.writeFile(path.join(outside, 'sentinel'), 'unchanged');
  const context = await locationModel.getProjectLocation(f);
  await fs.symlink(outside, path.join(f.currentRoot, 'escape'));
  await assert.rejects(context.fsAdapter.writeFile(path.join(f.beforeRoot, 'escape', 'sentinel'), 'changed'), { code: 'E_PROJECT_LOCATION_BOUNDARY' });
  assert.equal(await fs.readFile(path.join(outside, 'sentinel'), 'utf8'), 'unchanged');
  const bindingPath = locationModel.locationPathFor(f.manifestPath);
  await fs.writeFile(path.join(outside, 'record'), f.bindingText);
  await fs.unlink(bindingPath);
  await fs.symlink(path.join(outside, 'record'), bindingPath);
  await assert.rejects(locationModel.getProjectLocation(f), { code: 'E_PROJECT_LOCATION_INVALID' });
});

test('location bounds metadata and refuses truncated JSON', async t => {
  for (const content of ['{', ' '.repeat(16385)]) {
    const f = await fixture(t);
    await fs.writeFile(locationModel.locationPathFor(f.manifestPath), content);
    await assert.rejects(locationModel.getProjectLocation(f), { code: 'E_PROJECT_LOCATION_INVALID' });
  }
});

test('location freshness fences identical-size replacement and worker input', async t => {
  const f = await fixture(t), context = await locationModel.getProjectLocation(f);
  const { readFence } = require('../../src/main/projectTreeReadPort.cjs');
  const before = await readFence(f.manifestPath), bindingPath = locationModel.locationPathFor(f.manifestPath);
  const oldStat = await fs.stat(bindingPath);
  const changed = f.bindingText.replace('Before', 'BeforX');
  assert.equal(Buffer.byteLength(changed), Buffer.byteLength(f.bindingText));
  await fs.writeFile(bindingPath, changed);
  await fs.utimes(bindingPath, oldStat.atime, oldStat.mtime);
  await assert.rejects(context.assertCurrent(), { code: 'E_PROJECT_LOCATION_STALE' });
  await assert.rejects(context.fsAdapter.open(f.beforeScene, 'w'), { code: 'E_PROJECT_LOCATION_STALE' });
  assert.notDeepEqual(await readFence(f.manifestPath), before);
  assert.equal(await fs.readFile(f.scenePath, 'utf8'), 'Сцена é 🧭');
});

test('location cannot bypass retained commit binding by changing its logical namespace', async t => {
  const f = await fixture(t);
  await fs.writeFile(locationModel.locationPathFor(f.manifestPath), JSON.stringify({ ...f.binding, logicalManifestPath: path.join(f.root, 'Foreign', 'project.craftsman.json') }));
  await assert.rejects(transaction.readVerifiedProjectTransaction(f), { code: 'E_PROJECT_TRANSACTION_COMMIT_READBACK' });
  assert.deepEqual(await fs.readFile(transaction.commitPathFor(f.scenePath)), f.commitBytes);
});

test('failed mapped save cleans only its physical staging file', async t => {
  const f = await fixture(t);
  await fs.mkdir(path.dirname(f.beforeScene), { recursive: true });
  let sentinel = null;
  const adapter = { ...fs, rename: async (from, to) => {
    if (to === f.scenePath) {
      assert.ok(from.startsWith(f.currentRoot + path.sep));
      sentinel = path.join(f.beforeRoot, path.relative(f.currentRoot, from));
      await fs.writeFile(sentinel, 'old-location-owned-by-someone-else');
      throw Object.assign(new Error('injected rename failure'), { code: 'EIO' });
    }
    return fs.rename(from, to);
  } };
  await assert.rejects(transaction.commitProjectTransaction({ ...f, fsAdapter: adapter,
    manifestContent: f.manifestText, expectedManifestContent: f.manifestText,
    sceneContent: 'new', expectedSceneContent: 'Сцена é 🧭', revision: 2, publishManifest: async () => {} }));
  assert.ok(sentinel);
  assert.equal(await fs.readFile(sentinel, 'utf8'), 'old-location-owned-by-someone-else');
  const recovered = await transaction.recoverProjectTransaction({ ...f, publishManifest: async () => {} });
  assert.equal(recovered.recovered, true);
  assert.equal(await fs.readFile(f.scenePath, 'utf8'), 'Сцена é 🧭');
});


test('transaction adapter cannot replace its own location authority and refuses a removed binding', async t => {
  const f = await fixture(t), context = await locationModel.getProjectLocation(f);
  const target = locationModel.locationPathFor(f.beforeManifest);
  await assert.rejects(context.fsAdapter.open(target, 'w'), { code: 'E_PROJECT_LOCATION_BOUNDARY' });
  await assert.rejects(context.fsAdapter.open(target, 'r+'), { code: 'E_PROJECT_LOCATION_BOUNDARY' });
  await assert.rejects(context.fsAdapter.writeFile(target, '{}'), { code: 'E_PROJECT_LOCATION_BOUNDARY' });
  assert.equal(await fs.readFile(locationModel.locationPathFor(f.manifestPath), 'utf8'), f.bindingText);
  await fs.unlink(locationModel.locationPathFor(f.manifestPath));
  await assert.rejects(context.fsAdapter.open(f.beforeScene, 'w'), { code: 'E_PROJECT_LOCATION_STALE' });
  assert.equal(await fs.readFile(f.scenePath, 'utf8'), 'Сцена é 🧭');
});


test('location never turns an invalid manifest publication port into authority', async t => {
  const f = await fixture(t);
  await assert.rejects(transaction.commitProjectTransaction({ ...f,
    manifestContent: f.manifestText, expectedManifestContent: f.manifestText,
    sceneContent: 'MUST NOT SAVE', expectedSceneContent: 'Сцена é 🧭', revision: 2, publishManifest: true,
  }), { code: 'E_PROJECT_TRANSACTION_MANIFEST_AUTHORITY_REQUIRED' });
  assert.equal(await fs.readFile(f.scenePath, 'utf8'), 'Сцена é 🧭');
  await assert.rejects(fs.stat(transaction.journalPathFor(f.manifestPath)), { code: 'ENOENT' });
});


test('location rejects invalid UTF-8 instead of replacing preserved routing bytes', async t => {
  const f=await fixture(t), bindingPath=locationModel.locationPathFor(f.manifestPath);
  const bytes=Buffer.from(f.bindingText), index=bytes.indexOf(Buffer.from('Before'));
  assert.ok(index>=0); bytes[index]=0xff;
  await fs.writeFile(bindingPath,bytes);
  await assert.rejects(locationModel.getProjectLocation(f),{code:'E_PROJECT_LOCATION_INVALID'});
  assert.deepEqual(await fs.readFile(bindingPath),bytes);
});


test('location preserves resource bytes and scalar arguments from before the first microtask', async t => {
  const f=await fixture(t), scenePath=path.join(f.currentRoot,'roman','new.txt');
  const resourcePath=path.join(f.currentRoot,'assets','image.bin'), content=Buffer.from([1,2,3]);
  const request={manifestPath:f.manifestPath,scenePath,manifestContent:f.manifestText,expectedManifestContent:f.manifestText,
    sceneContent:'owned scene',expectedSceneContent:null,revision:2,publishManifest:async()=>{},createResources:[{path:resourcePath,content}]};
  const pending=transaction.commitProjectTransaction(request);
  queueMicrotask(()=>{content.fill(9);request.sceneContent='foreign replacement';request.createResources[0].path=path.join(f.root,'outside.bin');});
  const result=await pending;assert.equal(result.success,true);
  assert.equal(await fs.readFile(scenePath,'utf8'),'owned scene');
  assert.deepEqual(await fs.readFile(resourcePath),Buffer.from([1,2,3]));
  await assert.rejects(fs.stat(path.join(f.root,'outside.bin')),{code:'ENOENT'});
});


test('location refuses a new route appearing during an initially unbound read', async t => {
  const f=await fixture(t);
  await fs.mkdir(path.dirname(f.beforeScene),{recursive:true});
  await fs.writeFile(f.beforeManifest,f.manifestText);await fs.writeFile(f.beforeScene,'Сцена é 🧭');
  await fs.writeFile(transaction.commitPathFor(f.beforeScene),f.commitBytes);
  let changed=false;
  const fsAdapter={...fs,readFile:async(target,...args)=>{
    const result=await fs.readFile(target,...args);
    if(target===f.beforeScene&&!changed) {
      changed=true;
      const route=locationModel.createLocationRecord({manifestPath:f.manifestPath},f.projectId,f.beforeManifest);
      await fs.writeFile(locationModel.locationPathFor(f.beforeManifest),JSON.stringify(route));
    }
    return result;
  }};
  await assert.rejects(transaction.readVerifiedProjectTransaction({manifestPath:f.beforeManifest,scenePath:f.beforeScene,fsAdapter}),
    {code:'E_PROJECT_LOCATION_STALE'});
  assert.equal(changed,true);assert.deepEqual(await fs.readFile(transaction.commitPathFor(f.beforeScene)),f.commitBytes);
});
