'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { bindSaveReceiptToAck } = require('../../src/core/save-receipt-ack-v1.cjs');
const { durableSaveTransaction } = require('../../src/core/save-coordinator-v1.cjs');
const {
  ProjectTransactionError,
  TRANSACTION_PHASE_CHAIN,
  classifyProjectTransactionState,
  commitPathFor,
  commitProjectTransaction,
  journalPathFor,
  readPendingProjectTransactionBinding,
  recoverProjectTransaction,
} = require('../../src/core/project-transaction-v1.cjs');

function sandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'r24-wp201-'));
  const scenePath = path.join(root, 'scenes', 'scene.txt');
  const manifestPath = path.join(root, 'project.json');
  fs.mkdirSync(path.dirname(scenePath), { recursive: true });
  fs.writeFileSync(scenePath, 'old scene');
  fs.writeFileSync(manifestPath, '{"revision":1}');
  return { root, scenePath, manifestPath };
}

function manifestPublisher() {
  return async ({ manifestPath, expectedText, nextText, revision }) => {
    const current = fs.readFileSync(manifestPath, 'utf8');
    if (current !== expectedText) {
      const error = new Error('manifest CAS');
      error.code = 'E_TEST_MANIFEST_CAS';
      throw error;
    }
    await durableSaveTransaction({ filePath: manifestPath, content: nextText, revision });
  };
}

function mediaUpdate(t) {
  const s = sandbox(); t.after(() => fs.rmSync(s.root, { recursive: true, force: true }));
  const envelope = require('../../src/core/document-content-envelope-v1.cjs');
  const media = require('../../src/io/documentMedia.js');
  const bytes = require('../fixtures/document-jpeg-fixtures.cjs').rgb;
  const attrs = media.createImageAttrs(bytes);
  const sceneContent = envelope.composeObservablePayload({ doc: { type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'old scene' }, { type: 'image', attrs }] },
  ] } });
  const resource = { path: path.join(s.root, attrs.assetPath), content: bytes };
  return { ...s, resource, input: { scenePath: s.scenePath, manifestPath: s.manifestPath,
    expectedSceneContent: 'old scene', sceneContent, expectedManifestContent: '{"revision":1}',
    manifestContent: '{"revision":2}', revision: 2, mediaUpdateResources: [resource], publishManifest: manifestPublisher() } };
}

test('WP201 media update commits new content-addressed assets with an existing scene', async t => {
  const s = mediaUpdate(t), result = await commitProjectTransaction(s.input);
  assert.equal(result.success, true);
  assert.deepEqual(fs.readFileSync(s.resource.path), s.resource.content);
  assert.equal(fs.readFileSync(s.scenePath, 'utf8'), s.input.sceneContent);
  assert.equal(JSON.parse(fs.readFileSync(commitPathFor(s.scenePath))).schemaVersion, 'yalken.project-transaction.commit.v6');
  assert.equal(classifyProjectTransactionState(s).classification, 'NEW_COMMITTED');
});

test('WP201 media update rolls back owned new resources and preserves the existing scene after interrupted manifest publish', async t => {
  const s = mediaUpdate(t);
  await assert.rejects(commitProjectTransaction({ ...s.input, publishManifest: async () => { throw Error('injected'); } }));
  assert.deepEqual(fs.readFileSync(s.resource.path), s.resource.content);
  assert.equal((await readPendingProjectTransactionBinding(s)).pending, true);
  assert.equal((await recoverProjectTransaction({ ...s, publishManifest: manifestPublisher() })).outcome, 'UNCOMMITTED_ROLLED_BACK');
  assert.equal(fs.existsSync(s.resource.path), false);
  assert.equal(fs.readFileSync(s.scenePath, 'utf8'), 'old scene');
});

test('WP201 media update refuses arbitrary companions and existing shared resources before any publication', async t => {
  for (const mode of ['path', 'bytes', 'unreferenced', 'exists']) {
    const s = mediaUpdate(t), entry = { ...s.resource };
    if (mode === 'path') entry.path = path.join(s.root, 'private.txt');
    if (mode === 'bytes') entry.content = Buffer.from('forged');
    if (mode === 'unreferenced') s.input.sceneContent = 'new scene';
    if (mode === 'exists') { fs.mkdirSync(path.dirname(entry.path), { recursive: true }); fs.writeFileSync(entry.path, entry.content); }
    await assert.rejects(commitProjectTransaction({ ...s.input, mediaUpdateResources: [entry] }));
    assert.equal(fs.readFileSync(s.scenePath, 'utf8'), 'old scene');
    assert.equal(fs.readFileSync(s.manifestPath, 'utf8'), '{"revision":1}');
    if (mode === 'exists') assert.deepEqual(fs.readFileSync(entry.path), entry.content);
    assert.equal(fs.existsSync(journalPathFor(s.manifestPath)), false);
  }
});

test('WP201 commits scene and manifest under one durable commit point and ACK', async () => {
  const { scenePath, manifestPath } = sandbox();
  const receipt = await commitProjectTransaction({
    scenePath,
    sceneContent: 'new scene',
    expectedSceneContent: 'old scene',
    manifestPath,
    manifestContent: '{"revision":2}',
    expectedManifestContent: '{"revision":1}',
    revision: 2,
    publishManifest: manifestPublisher(),
  });

  assert.equal(receipt.success, true);
  assert.deepEqual([...receipt.phases], [...TRANSACTION_PHASE_CHAIN]);
  assert.equal(fs.readFileSync(scenePath, 'utf8'), 'new scene');
  assert.equal(fs.readFileSync(manifestPath, 'utf8'), '{"revision":2}');
  assert.equal(fs.existsSync(journalPathFor(manifestPath)), false);
  assert.equal(fs.existsSync(commitPathFor(scenePath)), true);
  assert.equal(classifyProjectTransactionState({ scenePath, manifestPath }).classification, 'NEW_COMMITTED');

  const ack = bindSaveReceiptToAck({
    receipt,
    capturedContent: 'new scene',
    capturedGeneration: 2,
    latestEditGeneration: 2,
  });
  assert.equal(ack.receipt.receiptKind, 'PROJECT_TRANSACTION_V1');
  assert.equal(ack.ack.kind, 'SAVED');
});

test('WP201 refuses scene or manifest CAS drift before an acknowledged publication', async (t) => {
  const base = {
    sceneContent: 'new scene',
    manifestContent: '{"revision":2}',
    revision: 2,
    publishManifest: manifestPublisher(),
  };
  await t.test('scene drift', async () => {
    const { scenePath, manifestPath } = sandbox();
    await assert.rejects(
      commitProjectTransaction({
        ...base,
        scenePath,
        expectedSceneContent: 'different scene',
        manifestPath,
        expectedManifestContent: '{"revision":1}',
      }),
      (error) => error instanceof ProjectTransactionError && error.code === 'E_PROJECT_TRANSACTION_SCENE_CAS',
    );
    assert.equal(fs.existsSync(journalPathFor(manifestPath)), false);
  });
  await t.test('manifest drift', async () => {
    const { scenePath, manifestPath } = sandbox();
    await assert.rejects(
      commitProjectTransaction({
        ...base,
        scenePath,
        expectedSceneContent: 'old scene',
        manifestPath,
        expectedManifestContent: '{"revision":0}',
      }),
      (error) => error instanceof ProjectTransactionError && error.code === 'E_PROJECT_TRANSACTION_MANIFEST_CAS',
    );
    assert.equal(fs.existsSync(journalPathFor(manifestPath)), false);
  });
});

test('WP201 leaves a recoverable journal when manifest authority fails', async () => {
  const { scenePath, manifestPath } = sandbox();
  await assert.rejects(
    commitProjectTransaction({
      scenePath,
      sceneContent: 'new scene',
      expectedSceneContent: 'old scene',
      manifestPath,
      manifestContent: '{"revision":2}',
      expectedManifestContent: '{"revision":1}',
      revision: 2,
      publishManifest: async () => { throw new Error('denied'); },
    }),
    (error) => error.code === 'E_PROJECT_TRANSACTION_MANIFEST_PUBLISH',
  );
  assert.equal(fs.existsSync(journalPathFor(manifestPath)), true);
  const recovery = await recoverProjectTransaction({ scenePath, manifestPath, publishManifest: manifestPublisher() });
  assert.equal(recovery.outcome, 'UNCOMMITTED_ROLLED_BACK');
  assert.equal(fs.readFileSync(scenePath, 'utf8'), 'old scene');
  assert.equal(fs.readFileSync(manifestPath, 'utf8'), '{"revision":1}');
  assert.equal(fs.existsSync(journalPathFor(manifestPath)), false);
});

test('WP201 rejects a journal rebound to another artifact path', async () => {
  const { scenePath, manifestPath } = sandbox();
  const forged = {
    schemaVersion: 'yalken.project-transaction.journal.v1',
    transactionId: '0'.repeat(64),
    revision: 2,
    scenePath: path.join(path.dirname(scenePath), 'other.txt'),
    manifestPath,
    before: { sceneBase64: null, manifestBase64: Buffer.from('{}').toString('base64') },
    after: { sceneBase64: Buffer.from('x').toString('base64'), manifestBase64: Buffer.from('{}').toString('base64') },
  };
  fs.writeFileSync(journalPathFor(manifestPath), JSON.stringify(forged));
  await assert.rejects(
    recoverProjectTransaction({ scenePath, manifestPath, publishManifest: manifestPublisher() }),
    (error) => error.code === 'E_PROJECT_TRANSACTION_JOURNAL_PATH_MISMATCH',
  );
  assert.equal(fs.readFileSync(scenePath, 'utf8'), 'old scene');
});

test('WP201 discovers only a digest-valid pending scene binding inside the manifest boundary', async () => {
  const { scenePath, manifestPath } = sandbox();
  await assert.rejects(
    commitProjectTransaction({
      scenePath,
      sceneContent: 'new scene',
      expectedSceneContent: 'old scene',
      manifestPath,
      manifestContent: '{"revision":2}',
      expectedManifestContent: '{"revision":1}',
      revision: 2,
      publishManifest: async () => { throw new Error('denied'); },
    }),
  );
  const binding = await readPendingProjectTransactionBinding({ manifestPath });
  assert.deepEqual(binding, {
    pending: true,
    scenePath,
    manifestPath,
    transactionId: binding.transactionId,
  });
  assert.match(binding.transactionId, /^[a-f0-9]{64}$/u);

  const forged = JSON.parse(fs.readFileSync(journalPathFor(manifestPath), 'utf8'));
  forged.scenePath = path.join(path.dirname(manifestPath), '..', 'outside.txt');
  fs.writeFileSync(journalPathFor(manifestPath), JSON.stringify(forged));
  await assert.rejects(
    readPendingProjectTransactionBinding({ manifestPath }),
    (error) => error.code === 'E_PROJECT_TRANSACTION_PATH_BOUNDARY',
  );
});

test('WP201 same-revision exact retry is idempotent without blocking a later session save', async () => {
  const { scenePath, manifestPath } = sandbox();
  const input = {
    scenePath,
    sceneContent: 'new scene',
    expectedSceneContent: 'old scene',
    manifestPath,
    manifestContent: '{"revision":2}',
    expectedManifestContent: '{"revision":1}',
    revision: 2,
    publishManifest: manifestPublisher(),
  };
  await commitProjectTransaction(input);
  const retry = await commitProjectTransaction({
    ...input,
    expectedSceneContent: 'new scene',
    expectedManifestContent: '{"revision":2}',
  });
  assert.equal(retry.idempotent, true);
  const laterSession = await commitProjectTransaction({
    ...input,
    sceneContent: 'later session scene',
    expectedSceneContent: 'new scene',
    expectedManifestContent: '{"revision":2}',
  });
  assert.equal(laterSession.idempotent, false);
  assert.equal(fs.readFileSync(scenePath, 'utf8'), 'later session scene');
});

test('live Writer save routes use WP201 while non-project fallback remains WP200', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'main.js'), 'utf8');
  assert.match(source, /commitWriterProjectSnapshot\(/u);
  assert.match(source, /save existing project transaction/u);
  assert.match(source, /save new project transaction/u);
  assert.match(source, /save as project transaction/u);
  assert.match(source, /autosave project transaction/u);
  assert.match(source, /return await durableSaveTransaction\(\{ filePath, content, revision \}\);/u);
  assert.ok((source.match(/recoverWriterProjectTransactionForFile\(/gu) || []).length >= 5);
  assert.ok(
    source.indexOf('await recoverPendingWriterProjectTransaction()')
      < source.indexOf('const flowIdentity = await buildFlowStableNodeIdMap()'),
  );
  assert.match(source, /sanitizePayloadWithinProjectRoot\(\{ path: binding\.scenePath \}, \['path'\]\)/u);
  assert.ok(
    source.indexOf('await recoverWriterProjectTransactionForFile(lastFilePath)')
      < source.indexOf('fileManager.readFile(lastFilePath)'),
  );
  assert.doesNotMatch(source, /commitProjectTextAndManifest\(/u);
});

for (const phase of ['before-scene', 'before-commit', 'after-commit']) {
  test(`WP201 media update recovers a real filesystem interruption ${phase}`, async t => {
    const s = mediaUpdate(t), actual = fs.promises;
    let fired = false;
    const adapter = { ...actual,
      async rename(from, to) {
        if (!fired && ((phase === 'before-scene' && to === s.scenePath)
          || (phase === 'before-commit' && to === commitPathFor(s.scenePath)))) {
          fired = true; throw Error(`injected ${phase}`);
        }
        return actual.rename(from, to);
      },
      async unlink(target) {
        if (!fired && phase === 'after-commit' && target === journalPathFor(s.manifestPath)) {
          fired = true; throw Error('injected after-commit');
        }
        return actual.unlink(target);
      },
    };
    await assert.rejects(commitProjectTransaction({ ...s.input, fsAdapter: adapter }));
    assert.equal(fired, true);
    assert.equal(fs.existsSync(journalPathFor(s.manifestPath)), true);
    const result = await recoverProjectTransaction({ ...s, publishManifest: manifestPublisher() });
    const committed = phase === 'after-commit';
    assert.equal(result.outcome, committed ? 'COMMITTED_CONVERGED' : 'UNCOMMITTED_ROLLED_BACK');
    assert.equal(fs.readFileSync(s.scenePath, 'utf8'), committed ? s.input.sceneContent : 'old scene');
    assert.equal(fs.readFileSync(s.manifestPath, 'utf8'), committed ? '{"revision":2}' : '{"revision":1}');
    assert.equal(fs.existsSync(s.resource.path), committed);
    if (committed) assert.deepEqual(fs.readFileSync(s.resource.path), s.resource.content);
    assert.equal((await recoverProjectTransaction({ ...s, publishManifest: manifestPublisher() })).outcome, 'NO_JOURNAL');
  });
}

test('WP201 media recovery preserves a substituted resource and refuses destructive rollback', async t => {
  const s = mediaUpdate(t);
  await assert.rejects(commitProjectTransaction({ ...s.input, publishManifest: async () => { throw Error('injected'); } }));
  fs.writeFileSync(s.resource.path, 'foreign owner content');
  await assert.rejects(recoverProjectTransaction({ ...s, publishManifest: manifestPublisher() }));
  assert.equal(fs.readFileSync(s.resource.path, 'utf8'), 'foreign owner content');
  assert.equal(fs.readFileSync(s.scenePath, 'utf8'), 'old scene');
  assert.equal(fs.existsSync(journalPathFor(s.manifestPath)), true);
});

test('WP201 committed media recovery restores missing assets before exposing the referencing scene', async t => {
  const s = mediaUpdate(t), actual = fs.promises;
  const stop = { ...actual, async unlink(target) {
    if (target === journalPathFor(s.manifestPath)) throw Error('after-commit');
    return actual.unlink(target);
  } };
  await assert.rejects(commitProjectTransaction({ ...s.input, fsAdapter: stop }));
  fs.writeFileSync(s.scenePath, 'old scene'); fs.unlinkSync(s.resource.path);
  let scenePublished = false;
  const inspect = { ...actual, async rename(from, to) {
    if (to === s.scenePath) { assert.deepEqual(fs.readFileSync(s.resource.path), s.resource.content); scenePublished = true; }
    return actual.rename(from, to);
  } };
  assert.equal((await recoverProjectTransaction({ ...s, publishManifest: manifestPublisher(), fsAdapter: inspect })).outcome, 'COMMITTED_CONVERGED');
  assert.equal(scenePublished, true); assert.equal(fs.readFileSync(s.scenePath, 'utf8'), s.input.sceneContent);
});

for (const packetOnly of [false, true]) test(`WP201 media corrupt-commit repair retains update semantics with packetOnly=${packetOnly}`, async t => {
  const s = mediaUpdate(t), tx = require('../../src/core/project-transaction-v1.cjs');
  if (!packetOnly) await assert.rejects(commitProjectTransaction({ ...s.input, publishManifest: async () => { throw Error('injected'); } }));
  fs.writeFileSync(commitPathFor(s.scenePath), '{broken');
  let recovery;
  await assert.rejects(packetOnly ? commitProjectTransaction(s.input)
    : recoverProjectTransaction({ ...s, publishManifest: manifestPublisher() }), error => {
    recovery = error.recovery; return error.code === 'E_PROJECT_COMMIT_CORRUPT';
  });
  const journal = { transactionId: recovery.transactionId };
  assert.equal(fs.existsSync(journalPathFor(s.manifestPath)), !packetOnly);
  const packetPath = tx.recoveryPacketPathFor(s.manifestPath, journal.transactionId);
  const bytes = fs.readFileSync(packetPath), packet = JSON.parse(bytes);
  assert.equal(packet.resourceMode, 'MEDIA_UPDATE_V1');
  const input = { ...s, publishManifest: manifestPublisher(), decision: 'REPAIR_TO_BEFORE',
    recoveryTransactionId: journal.transactionId, recoveryPacketDigest: require('node:crypto').createHash('sha256').update(bytes).digest('hex') };
  await assert.rejects(tx.repairCorruptProjectCommit({ ...input, verifyAuthorityProof: async () => false }));
  if (!packetOnly) assert.deepEqual(fs.readFileSync(s.resource.path), s.resource.content);
  else assert.equal(fs.existsSync(s.resource.path), false);
  await tx.repairCorruptProjectCommit({ ...input, verifyAuthorityProof: async p => p.transactionId === journal.transactionId && p.decision === 'REPAIR_TO_BEFORE' });
  assert.equal(fs.readFileSync(s.scenePath, 'utf8'), 'old scene');
  assert.equal(fs.readFileSync(s.manifestPath, 'utf8'), '{"revision":1}');
  assert.equal(fs.existsSync(s.resource.path), false);
});

function richCommentAppend(t, mode = 'upgrade') {
  const s = sandbox(); t.after(() => fs.rmSync(s.root, { recursive: true, force: true }));
  fs.unlinkSync(s.scenePath);
  const model = require('../../src/core/word-comment-authoring-v1.cjs');
  const hash = value => require('node:crypto').createHash('sha256').update(value).digest('hex');
  const before = { schemaVersion:'yalken.rtk.word.non-text-return-state.v1',projectId:'p',revision:0,threads:[],events:[] };
  const made = model.planCommentAuthoring({beforeText:null,projectId:'p',sceneId:'scenes/scene.txt',sceneSha256:hash('anchor'),paragraphs:['anchor'],now:'2026-10-03T00:00:00Z',input:{requestId:'rich-create',action:'create',projectId:'p',sceneId:'scenes/scene.txt',expectedSceneSha256:hash('anchor'),expectedStateSha256:'',anchor:{paragraphIndex:0,startUtf16:0,selectedText:'anchor'},richBody:{schemaVersion:'yalken.word.comment-body.v1',document:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'rich',marks:[{type:'bold'}]}]}]}}}});
  const after = {...made.state,events:[]};
  if (mode === 'downgrade') { before.schemaVersion='yalken.rtk.word.non-text-return-state.v2'; after.schemaVersion='yalken.rtk.word.non-text-return-state.v1'; delete after.threads[0].messages[0].richBody; }
  if (mode === 'mismatch') after.threads[0].messages[0].body='lost formatting text';
  if (mode === 'v1-rich') after.schemaVersion=before.schemaVersion;
  const statePath=path.join(s.root,'.yalken','word-review','non-text-return-state.v1.json');
  fs.mkdirSync(path.dirname(statePath),{recursive:true});
  const beforeText=JSON.stringify(before,null,2)+'\n',afterText=JSON.stringify(after,null,2)+'\n';fs.writeFileSync(statePath,beforeText);
  const companion=path.join(s.root,'import-metadata.json');
  return {...s,statePath,beforeText,afterText,companion,input:{scenePath:s.scenePath,manifestPath:s.manifestPath,expectedSceneContent:null,sceneContent:'anchor',expectedManifestContent:'{"revision":1}',manifestContent:'{"revision":2}',revision:2,createResources:[{path:companion,content:'{}'}],commentState:{beforeText,afterText},publishManifest:manifestPublisher()}};
}

test('WP201 rich comment append upgrades v1 atomically and recovery restores exact legacy state',async t=>{
  const s=richCommentAppend(t);const result=await commitProjectTransaction(s.input);assert.equal(result.success,true);
  assert.equal(fs.readFileSync(s.statePath,'utf8'),s.afterText);
  const interrupted=richCommentAppend(t);
  await assert.rejects(commitProjectTransaction({...interrupted.input,publishManifest:async()=>{throw Error('injected');}}));
  const recovery=await recoverProjectTransaction({...interrupted,publishManifest:manifestPublisher()});
  assert.equal(recovery.outcome,'UNCOMMITTED_ROLLED_BACK');assert.equal(fs.readFileSync(interrupted.statePath,'utf8'),interrupted.beforeText);
});

for(const mode of ['downgrade','mismatch','v1-rich']) test(`WP201 refuses ${mode} before any comment or scene publication`,async t=>{
  const s=richCommentAppend(t,mode);await assert.rejects(commitProjectTransaction(s.input),/E_PROJECT_TRANSACTION_COMMENT_STATE/);
  assert.equal(fs.readFileSync(s.statePath,'utf8'),s.beforeText);assert.equal(fs.existsSync(s.scenePath),false);assert.equal(fs.existsSync(s.companion),false);
});
