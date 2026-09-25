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
