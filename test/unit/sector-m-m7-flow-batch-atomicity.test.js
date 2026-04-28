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
