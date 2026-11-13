const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  buildBatchRoot,
  readFlowSceneBatchMarkers,
  writeFlowSceneBatchAtomic,
} = require('../../src/utils/flowSceneBatchAtomic');

function makeProjectRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeScene(targetPath, content) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf8');
}

test('M7 flow batch atomicity commits all scene writes together and clears marker state on success', async () => {
  const projectRoot = makeProjectRoot('sector-m-m7-flow-batch-ok-');
  const sceneA = path.join(projectRoot, 'scenes', 'a.md');
  const sceneB = path.join(projectRoot, 'scenes', 'b.md');
  writeScene(sceneA, 'before-a\n');
  writeScene(sceneB, 'before-b\n');

  const result = await writeFlowSceneBatchAtomic({
    projectRoot,
    entries: [
      { path: sceneA, content: 'after-a\n' },
      { path: sceneB, content: 'after-b\n' },
    ],
  });

  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(fs.readFileSync(sceneA, 'utf8'), 'after-a\n');
  assert.equal(fs.readFileSync(sceneB, 'utf8'), 'after-b\n');
  assert.deepEqual(await readFlowSceneBatchMarkers(projectRoot), []);
});

test('M7 flow batch atomicity rolls back activated scene writes and leaves failed marker on partial activation failure', async () => {
  const projectRoot = makeProjectRoot('sector-m-m7-flow-batch-rollback-');
  const sceneA = path.join(projectRoot, 'scenes', 'a.md');
  const sceneB = path.join(projectRoot, 'scenes', 'b.md');
  writeScene(sceneA, 'before-a\n');
  writeScene(sceneB, 'before-b\n');

  const result = await writeFlowSceneBatchAtomic(
    {
      projectRoot,
      entries: [
        { path: sceneA, content: 'after-a\n' },
        { path: sceneB, content: 'after-b\n' },
      ],
    },
    {
      afterActivate({ index }) {
        if (index === 0) {
          throw new Error('forced-after-activate-failure');
        }
      },
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'M7_FLOW_BATCH_WRITE_FAIL');
  assert.equal(fs.readFileSync(sceneA, 'utf8'), 'before-a\n');
  assert.equal(fs.readFileSync(sceneB, 'utf8'), 'before-b\n');

  const staleMarkers = await readFlowSceneBatchMarkers(projectRoot);
  assert.equal(staleMarkers.length, 1);
  const markerDoc = JSON.parse(fs.readFileSync(staleMarkers[0], 'utf8'));
  assert.equal(markerDoc.state, 'FAILED');
  assert.equal(markerDoc.sceneCount, 2);
});

test('M7 flow batch atomicity rejects stale marker before writing any scene temp files', async () => {
  const projectRoot = makeProjectRoot('sector-m-m7-flow-batch-stale-');
  const sceneA = path.join(projectRoot, 'scenes', 'a.md');
  writeScene(sceneA, 'before-a\n');

  const batchRoot = buildBatchRoot(projectRoot);
  fs.mkdirSync(batchRoot, { recursive: true });
  const stalePath = path.join(batchRoot, 'stale.json');
  fs.writeFileSync(stalePath, JSON.stringify({ state: 'FAILED' }, null, 2), 'utf8');

  const result = await writeFlowSceneBatchAtomic({
    projectRoot,
    entries: [{ path: sceneA, content: 'after-a\n' }],
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'M7_FLOW_BATCH_STALE');
  assert.equal(fs.readFileSync(sceneA, 'utf8'), 'before-a\n');
  assert.deepEqual(result.error.details.staleMarkers, [stalePath]);
});

test('M7 flow batch atomicity rejects missing commit marker after activation and restores original files', async () => {
  const projectRoot = makeProjectRoot('sector-m-m7-flow-batch-marker-');
  const sceneA = path.join(projectRoot, 'scenes', 'a.md');
  const sceneB = path.join(projectRoot, 'scenes', 'b.md');
  writeScene(sceneA, 'before-a\n');
  writeScene(sceneB, 'before-b\n');

  const result = await writeFlowSceneBatchAtomic(
    {
      projectRoot,
      entries: [
        { path: sceneA, content: 'after-a\n' },
        { path: sceneB, content: 'after-b\n' },
      ],
    },
    {
      afterActivate({ markerPath, index }) {
        if (index === 1) {
          fs.unlinkSync(markerPath);
        }
      },
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'M7_FLOW_BATCH_COMMIT_MARKER_MISSING');
  assert.equal(fs.readFileSync(sceneA, 'utf8'), 'before-a\n');
  assert.equal(fs.readFileSync(sceneB, 'utf8'), 'before-b\n');
  const staleMarkers = await readFlowSceneBatchMarkers(projectRoot);
  assert.equal(staleMarkers.length, 1);
});


test('M7 mixed scene and binary asset commit preserves every byte and snapshots caller buffers before awaits', async t => {
  const root = makeProjectRoot('word-media-batch-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const scene = path.join(root, 'roman', 'scene.txt');
  const asset = path.join(root, 'assets', 'image.png');
  const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 255, 0xc0, 0xaf, 13, 10]);
  const expected = Buffer.from(bytes);
  const result = await writeFlowSceneBatchAtomic({ projectRoot: root, entries: [
    { path: scene, content: 'Scene with image 🧭' }, { path: asset, content: bytes },
  ] }, { afterIntentRecorded() { bytes.fill(0); } });
  assert.equal(result.ok, true);
  assert.equal(fs.readFileSync(scene, 'utf8'), 'Scene with image 🧭');
  assert.deepEqual(fs.readFileSync(asset), expected);
  const receipt = result.value.receipt.entries.find(e => e.path === asset);
  assert.equal(receipt.bytesWritten, expected.length);
  assert.equal(receipt.contentHash, require('node:crypto').createHash('sha256').update(expected).digest('hex'));
  assert.deepEqual(await readFlowSceneBatchMarkers(root), []);
});

test('M7 mixed batch restores old text and binary bytes after partial activation and retains recovery marker', async t => {
  const root = makeProjectRoot('word-media-rollback-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const scene = path.join(root, 'scene.txt'), asset = path.join(root, 'image.png');
  const old = Buffer.from([255, 0, 0xc0, 17]);
  writeScene(scene, 'old scene'); fs.writeFileSync(asset, old);
  const result = await writeFlowSceneBatchAtomic({ projectRoot: root, entries: [
    { path: scene, content: 'new scene' }, { path: asset, content: Buffer.from([0, 1, 254]) },
  ] }, { afterActivate({ index }) { if (index === 1) throw Error('injected-media-failure'); } });
  assert.equal(result.ok, false);
  assert.equal(fs.readFileSync(scene, 'utf8'), 'old scene');
  assert.deepEqual(fs.readFileSync(asset), old);
  const markers = await readFlowSceneBatchMarkers(root);
  assert.equal(markers.length, 1);
  assert.equal(JSON.parse(fs.readFileSync(markers[0])).state, 'FAILED');
});

test('M7 invalid binary-shaped objects cannot become successful empty files', async t => {
  const root = makeProjectRoot('word-media-invalid-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const target = path.join(root, 'image.png');
  for (const content of [{ type: 'Buffer', data: [137, 80] }, new Uint8Array([137, 80])]) {
    const result = await writeFlowSceneBatchAtomic({ projectRoot: root, entries: [{ path: target, content }] });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'M7_FLOW_BATCH_INVALID');
    assert.equal(fs.existsSync(target), false);
    assert.deepEqual(await readFlowSceneBatchMarkers(root), []);
  }
});

// Real filesystem controls for the explicit Flow authoring receipt. Legacy
// callers and every original assertion above retain their original contract.
function durableFlowFixture() {
  const crypto = require('node:crypto');
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'flow-durable-owned-'));
  fs.writeFileSync(path.join(root, '.owner'), 'YALKEN_WRITER_FLOW_SAVE_NO_LOSS_20261113', { flag: 'wx' });
  const hash = value => crypto.createHash('sha256').update(value).digest('hex');
  const entries = ['a', 'b'].map((name, index) => {
    const target = path.join(root, 'roman', name + '.txt'), before = 'OLD_' + name + ' 😀 e\u0301';
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, before);
    return { path: target, sceneId: 'roman/' + name + '.txt', nodeId: 'tree-node-' + String(index + 1).repeat(32),
      baselineHash: hash(before), content: 'NEW_' + name + ' 🧭 العربية', before };
  });
  const authoringContent = entries.map(entry => entry.sceneId + '\n' + entry.content).join('\n\n');
  return { root, entries, authoringContent, hash, options: { durableReceipt: { revision: 11, authoringContent } } };
}
test('flow durable opt-in records actual directory sync and complete byte readback before a pathless receipt', async t => {
  const f = durableFlowFixture(), io = require('node:fs/promises'), events = [], open = io.open, readFile = io.readFile;
  io.open = async function (target, flags, ...rest) {
    const handle = await open.call(this, target, flags, ...rest), sync = handle.sync.bind(handle);
    handle.sync = async () => { await sync(); events.push(['sync', String(target), fs.statSync(target).isDirectory()]); };
    return handle;
  };
  io.readFile = async function (target, ...args) {
    const bytes = await readFile.call(this, target, ...args), entry = f.entries.find(entry => entry.path === String(target));
    if (entry && f.hash(bytes) === f.hash(entry.content)) events.push(['readback', entry.path]);
    return bytes;
  };
  t.after(() => { io.open = open; io.readFile = readFile; });
  const result = await writeFlowSceneBatchAtomic({ projectRoot: f.root, entries: f.entries }, {
    ...f.options, afterActivate: ({ entry }) => events.push(['activate', entry.path]),
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  const receipt = result.value.receipt;
  assert.equal(receipt.schemaVersion, 'yalken.flow-batch.save-receipt.v2');
  assert.equal(receipt.revision, 11); assert.equal(receipt.digest, f.hash(f.authoringContent));
  assert.equal(receipt.bytes, Buffer.byteLength(f.authoringContent)); assert.equal(receipt.success, true);
  for (const entry of f.entries) {
    assert.equal(fs.readFileSync(entry.path, 'utf8'), entry.content);
    const readAt = events.findIndex(event => event[0] === 'readback' && event[1] === entry.path);
    assert.ok(readAt >= 0, 'An actual readback of each published file is required');
    for (const dir of [f.root, path.dirname(entry.path), path.join(f.root, '.flow-batch')])
      assert.ok(events.slice(events.findLastIndex(event => event[0] === 'activate') + 1, readAt)
        .some(event => event[0] === 'sync' && event[1] === dir && event[2]), 'Real parent sync after activation and before readback: ' + dir);
  }
  assert.equal(JSON.stringify(receipt).includes(f.root), false, 'The authoring receipt must be pathless');
  assert.deepEqual(receipt.entries, f.entries.map(entry => ({ sceneId: entry.sceneId, nodeId: entry.nodeId,
    baselineHashBefore: entry.baselineHash, contentHashAfter: f.hash(entry.content), bytesWritten: Buffer.byteLength(entry.content) })));
  assert.deepEqual(await readFlowSceneBatchMarkers(f.root), []);
});
test('flow durable opt-in preserves an unacquired occupied temporary and every old scene byte', async () => {
  const f = durableFlowFixture(); let foreignPath;
  const result = await writeFlowSceneBatchAtomic({ projectRoot: f.root, entries: f.entries }, { ...f.options,
    afterIntentRecorded: async ({ entries }) => { foreignPath = entries[0].tempPath; fs.writeFileSync(foreignPath, 'FOREIGN_RESERVED 🧭', { flag: 'wx' }); } });
  assert.equal(result.ok, false, 'Exclusive acquisition must refuse the real occupied file');
  for (const entry of f.entries) assert.equal(fs.readFileSync(entry.path, 'utf8'), entry.before);
  assert.equal(fs.readFileSync(foreignPath, 'utf8'), 'FOREIGN_RESERVED 🧭', 'A file never acquired cannot be truncated, renamed or removed');
  assert.ok((await readFlowSceneBatchMarkers(f.root)).length > 0, 'The failed attempt stays readable');
});
test('flow durable cleanup failure retains committed bytes and a readable recovery marker without ACK', async t => {
  const f = durableFlowFixture(), io = require('node:fs/promises'), unlink = io.unlink; let reached = false;
  io.unlink = async function (target, ...args) {
    if (!reached && String(target).endsWith('.bak')) { reached = true; throw Object.assign(Error('OWNED_CLEANUP_EIO'), { code: 'EIO' }); }
    return unlink.call(this, target, ...args);
  };
  t.after(() => { io.unlink = unlink; });
  const result = await writeFlowSceneBatchAtomic({ projectRoot: f.root, entries: f.entries }, f.options);
  assert.equal(reached, true); assert.equal(result.ok, false); assert.equal(result.error.details.committed, true);
  assert.equal(result.error.details.recoveryEvidenceConfirmed, true); assert.equal(result.value, undefined);
  for (const entry of f.entries) assert.equal(fs.readFileSync(entry.path, 'utf8'), entry.content);
  assert.equal(JSON.parse(fs.readFileSync(result.error.details.markerPath, 'utf8')).state, 'COMMIT_MARKED');
});
test('flow durable opt-in refuses a real directory-sync failure, rolls back and never issues an ACK receipt', async t => {
  const f = durableFlowFixture(), io = require('node:fs/promises'), open = io.open; let reached = false;
  io.open = async function (target, flags, ...rest) {
    const handle = await open.call(this, target, flags, ...rest), sync = handle.sync.bind(handle);
    if (String(target) === path.dirname(f.entries[0].path) && flags === 'r') handle.sync = async () => {
      await sync(); if (!reached) { reached = true; throw Object.assign(Error('OWNED_DIRECTORY_SYNC_FAILURE'), { code: 'EIO' }); }
    };
    return handle;
  };
  t.after(() => { io.open = open; });
  const result = await writeFlowSceneBatchAtomic({ projectRoot: f.root, entries: f.entries }, f.options);
  assert.equal(reached, true, 'The unchanged real directory handle must reach the failed phase');
  assert.equal(result.ok, false); assert.equal(result.value?.receipt, undefined);
  for (const entry of f.entries) assert.equal(fs.readFileSync(entry.path, 'utf8'), entry.before);
  const markers = await readFlowSceneBatchMarkers(f.root); assert.ok(markers.length > 0);
});
test('flow durable opt-in validates its authoring revision before filesystem effects', async () => {
  const f = durableFlowFixture(); const result = await writeFlowSceneBatchAtomic({ projectRoot: f.root, entries: f.entries },
    { durableReceipt: { revision: -1, authoringContent: f.authoringContent } });
  assert.equal(result.ok, false); assert.equal(result.error.code, 'M7_FLOW_DURABLE_ADMISSION_INVALID');
  for (const entry of f.entries) assert.equal(fs.readFileSync(entry.path, 'utf8'), entry.before);
  assert.equal(fs.existsSync(path.join(f.root, '.flow-batch')), false);
});
