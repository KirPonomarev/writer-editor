const test = require('node:test');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');

async function loadCountersModule() {
  return import('../../src/derived/navigatorCounters.mjs');
}

function node(id, kind, children = []) {
  return {
    nodeId: `tree-node-${id.padStart(32, id)}`.slice(0, 'tree-node-'.length + 32),
    kind,
    children,
  };
}

test('navigator derived counters aggregate from canonical scene text without stored truth', async () => {
  const counters = await loadCountersModule();
  const sceneA = node('a', 'scene');
  const sceneB = node('b', 'scene');
  const chapter = node('c', 'chapter-folder', [sceneA, sceneB]);
  const root = node('d', 'roman-root', [chapter]);
  const textByNodeId = new Map([
    [sceneA.nodeId, 'alpha beta'],
    [sceneB.nodeId, ''],
  ]);

  const result = await counters.annotateNavigatorDerivedCounters(root, {
    readText: async (item) => textByNodeId.get(item.nodeId) || '',
  });

  assert.equal(result.root, root);
  assert.deepEqual(root.derivedCounters, {
    wordCount: 2,
    sceneCount: 2,
    completedSceneCount: 1,
    progressPercent: 50,
    affectedByChangedSceneIds: [sceneA.nodeId, sceneB.nodeId],
    textUnitIds: [sceneA.nodeId, sceneB.nodeId],
  });
  assert.equal(chapter.derivedCounters.wordCount, 2);
  assert.equal(sceneA.derivedCounters.wordCount, 2);
  assert.equal(sceneB.derivedCounters.progressPercent, 0);
  assert.equal(Object.keys(result.snapshot.leafHashes).length, 2);
});

test('navigator derived counters invalidate only changed scene and ancestors', async () => {
  const counters = await loadCountersModule();
  const sceneA = node('a', 'scene');
  const sceneB = node('b', 'scene');
  const chapterA = node('c', 'chapter-folder', [sceneA]);
  const chapterB = node('d', 'chapter-folder', [sceneB]);
  const root = node('e', 'roman-root', [chapterA, chapterB]);
  const firstText = new Map([
    [sceneA.nodeId, 'one two'],
    [sceneB.nodeId, 'three'],
  ]);
  const first = await counters.annotateNavigatorDerivedCounters(root, {
    readText: async (item) => firstText.get(item.nodeId) || '',
  });

  const secondText = new Map([
    [sceneA.nodeId, 'one two'],
    [sceneB.nodeId, 'three four five'],
  ]);
  const second = await counters.annotateNavigatorDerivedCounters(root, {
    previousSnapshot: first.snapshot,
    readText: async (item) => secondText.get(item.nodeId) || '',
  });

  assert.deepEqual(second.changedSceneIds, [sceneB.nodeId]);
  assert.deepEqual(second.affectedNodeIds, [chapterB.nodeId, root.nodeId, sceneB.nodeId].sort());
  assert.deepEqual(chapterA.derivedCounters.affectedByChangedSceneIds, []);
  assert.deepEqual(chapterB.derivedCounters.affectedByChangedSceneIds, [sceneB.nodeId]);
  assert.equal(root.derivedCounters.wordCount, 5);
});

test('navigator derived counters stay bounded on a large tree', async () => {
  const counters = await loadCountersModule();
  const scenes = Array.from({ length: 1200 }, (_, index) => node(String(index + 1), 'scene'));
  const root = node('z', 'roman-root', scenes);
  const start = performance.now();
  await counters.annotateNavigatorDerivedCounters(root, {
    readText: async () => 'one two three',
  });
  const durationMs = performance.now() - start;

  assert.equal(root.derivedCounters.sceneCount, 1200);
  assert.equal(root.derivedCounters.wordCount, 3600);
  assert.equal(root.derivedCounters.progressPercent, 100);
  assert.equal(durationMs < 250, true, `large-tree counter derivation took ${durationMs}ms`);
});

