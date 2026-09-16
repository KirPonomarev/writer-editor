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

test('navigator counts visible rich text and excludes envelope metadata and cards', async () => {
  const { countNavigatorWords } = await loadCountersModule();
  const { composeObservablePayload } = await import('../../src/renderer/documentContentEnvelope.mjs');
  const payload = composeObservablePayload({
    doc: { type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'BOLD_SENTINEL', marks: [{ type: 'bold' }] }, { type: 'text', text: ' plain ' }, { type: 'text', text: 'ITALIC_SENTINEL', marks: [{ type: 'italic' }] }] },
      { type: 'paragraph', content: [] },
      { type: 'paragraph', content: [{ type: 'text', text: 'UNDERLINE STRIKE BOTH', marks: [{ type: 'underline' }, { type: 'strike' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'stable конец Ω 😀' }] },
    ] },
    metaEnabled: true, meta: { synopsis: 'not manuscript words', status: 'черновик' },
    cards: [{ title: 'planning card', text: 'also not manuscript words' }],
  });
  assert.equal(countNavigatorWords(payload), 10);
  assert.equal(countNavigatorWords(composeObservablePayload({ text: 'one\ntwo three', metaEnabled: true, cards: [{ text: 'excluded card words' }] })), 3);
});

test('navigator preserves word boundaries across rich runs, hard breaks and paragraphs', async () => {
  const { countNavigatorWords } = await loadCountersModule();
  const { composeObservablePayload } = await import('../../src/renderer/documentContentEnvelope.mjs');
  const payload = composeObservablePayload({ doc: { type: 'doc', content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Joined', marks: [{ type: 'bold' }] }, { type: 'text', text: 'Word' }, { type: 'hardBreak' }, { type: 'text', text: 'два\tтри' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'four\u00a0five' }] },
  ] } });
  assert.equal(countNavigatorWords(payload), 5);
});

test('empty rich scenes stay zero words and incomplete despite metadata', async () => {
  const counters = await loadCountersModule();
  const { composeObservablePayload } = await import('../../src/renderer/documentContentEnvelope.mjs');
  const scene = node('a', 'scene');
  const root = node('b', 'roman-root', [scene]);
  const payload = composeObservablePayload({ doc: { type: 'doc', content: [{ type: 'paragraph' }] }, metaEnabled: true });
  await counters.annotateNavigatorDerivedCounters(root, { readText: async () => payload });
  assert.equal(scene.derivedCounters.wordCount, 0);
  assert.equal(root.derivedCounters.completedSceneCount, 0);
  assert.equal(root.derivedCounters.progressPercent, 0);
});

test('invalid rich payloads reject derivation instead of publishing fabricated word counts', async () => {
  const counters = await loadCountersModule();
  const { composeObservablePayload } = await import('../../src/renderer/documentContentEnvelope.mjs');
  const valid = composeObservablePayload({ doc: { type: 'doc', content: [{ type: 'paragraph' }] } });
  for (const payload of ['[doc-v2 length=99999]\n{}', '[doc-v2 length=1]\n{', valid + '\nconflicting text']) {
    assert.throws(() => counters.countNavigatorWords(payload), { code: 'E_DOC_PAYLOAD_INVALID' });
    await assert.rejects(counters.annotateNavigatorDerivedCounters(node('a', 'scene'), { readText: async () => payload }), { code: 'E_DOC_PAYLOAD_INVALID' });
  }
});

test('rich formatting changes retain raw-source invalidation while word counts stay stable', async () => {
  const counters = await loadCountersModule();
  const { composeObservablePayload } = await import('../../src/renderer/documentContentEnvelope.mjs');
  const scene = node('a', 'scene');
  const root = node('b', 'roman-root', [scene]);
  const payload = marked => composeObservablePayload({ doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one two', ...(marked ? { marks: [{ type: 'bold' }] } : {}) }] }] } });
  const first = await counters.annotateNavigatorDerivedCounters(root, { readText: async () => payload(false) });
  const second = await counters.annotateNavigatorDerivedCounters(root, { previousSnapshot: first.snapshot, readText: async () => payload(true) });
  assert.equal(root.derivedCounters.wordCount, 2);
  assert.deepEqual(second.changedSceneIds, [scene.nodeId]);
  assert.notEqual(second.snapshot.leafHashes[scene.nodeId], first.snapshot.leafHashes[scene.nodeId]);
});
