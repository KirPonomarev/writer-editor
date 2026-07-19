const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');

const ACCEPTED_TIERS = Object.freeze({
  navigatorScenes: 1200,
  flowScenes: 420,
  searchSources: 1200,
  notes: 800,
});

const BUDGETS_MS = Object.freeze({
  navigatorCounters: 1200,
  flowProjection: 750,
  searchProjection: 900,
  notesReadModel: 750,
});

function moduleUrl(relativePath) {
  return pathToFileURL(path.join(ROOT, relativePath)).href;
}

async function loadModules() {
  const [
    flowMode,
    envelope,
    searchReadModel,
    notesStorage,
    navigatorCounters,
    deriveCache,
  ] = await Promise.all([
    import(moduleUrl('src/renderer/commands/flowMode.mjs')),
    import(moduleUrl('src/renderer/documentContentEnvelope.mjs')),
    import(moduleUrl('src/derived/projectSearchReadModel.mjs')),
    import(moduleUrl('src/core/notesStorage.mjs')),
    import(moduleUrl('src/derived/navigatorCounters.mjs')),
    import(moduleUrl('src/derived/deriveCache.mjs')),
  ]);
  return {
    flowMode,
    envelope,
    searchReadModel,
    notesStorage,
    navigatorCounters,
    deriveCache,
  };
}

function measureMs(fn) {
  const startedAt = performance.now();
  const value = fn();
  return {
    value,
    elapsedMs: performance.now() - startedAt,
  };
}

async function measureAsyncMs(fn) {
  const startedAt = performance.now();
  const value = await fn();
  return {
    value,
    elapsedMs: performance.now() - startedAt,
  };
}

function sceneNodeId(index) {
  return `tree-node-${String(index).padStart(32, '0')}`;
}

function buildNavigatorTree(sceneCount) {
  const chapters = [];
  for (let chapterIndex = 0; chapterIndex < Math.ceil(sceneCount / 40); chapterIndex += 1) {
    const children = [];
    for (let localIndex = 0; localIndex < 40; localIndex += 1) {
      const sceneIndex = (chapterIndex * 40) + localIndex;
      if (sceneIndex >= sceneCount) break;
      children.push({
        nodeId: sceneNodeId(sceneIndex),
        kind: 'scene',
        title: `Scene ${sceneIndex + 1}`,
        children: [],
      });
    }
    chapters.push({
      nodeId: sceneNodeId(sceneCount + chapterIndex),
      kind: 'chapter-folder',
      title: `Chapter ${chapterIndex + 1}`,
      children,
    });
  }
  return {
    nodeId: sceneNodeId(sceneCount + chapters.length + 1),
    kind: 'roman-root',
    title: 'Manuscript',
    children: chapters,
  };
}

test('S40 longform contract: accepted tiers and derived cache rebuild without becoming truth', async () => {
  const {
    flowMode,
    envelope,
    searchReadModel,
    notesStorage,
    navigatorCounters,
    deriveCache,
  } = await loadModules();

  assert.deepEqual(ACCEPTED_TIERS, {
    navigatorScenes: 1200,
    flowScenes: 420,
    searchSources: 1200,
    notes: 800,
  });
  assert.equal(Object.values(BUDGETS_MS).every((value) => Number.isFinite(value) && value > 0), true);

  const textByNodeId = new Map(Array.from({ length: ACCEPTED_TIERS.navigatorScenes }, (_, index) => [
    sceneNodeId(index),
    `alpha beta gamma scene ${index + 1}`,
  ]));
  const navigatorTree = buildNavigatorTree(ACCEPTED_TIERS.navigatorScenes);
  const navigatorFirst = await measureAsyncMs(() => navigatorCounters.annotateNavigatorDerivedCounters(navigatorTree, {
    readText: async (node) => textByNodeId.get(node.nodeId) || '',
  }));
  assert.equal(navigatorFirst.elapsedMs < BUDGETS_MS.navigatorCounters, true);
  assert.equal(navigatorFirst.value.root.derivedCounters.sceneCount, ACCEPTED_TIERS.navigatorScenes);
  assert.equal(navigatorFirst.value.root.derivedCounters.wordCount, ACCEPTED_TIERS.navigatorScenes * 5);

  textByNodeId.set(sceneNodeId(7), 'alpha changed scene with additional words');
  const navigatorSecond = await measureAsyncMs(() => navigatorCounters.annotateNavigatorDerivedCounters(navigatorTree, {
    previousSnapshot: navigatorFirst.value.snapshot,
    readText: async (node) => textByNodeId.get(node.nodeId) || '',
  }));
  assert.equal(navigatorSecond.elapsedMs < BUDGETS_MS.navigatorCounters, true);
  assert.deepEqual(navigatorSecond.value.changedSceneIds, [sceneNodeId(7)]);
  assert.equal(navigatorSecond.value.root.derivedCounters.affectedByChangedSceneIds.includes(sceneNodeId(7)), true);

  const flowScenes = Array.from({ length: ACCEPTED_TIERS.flowScenes }, (_, index) => ({
    sceneId: `roman/${String(index + 1).padStart(4, '0')}.txt`,
    nodeId: sceneNodeId(index),
    title: `Scene ${index + 1}`,
    kind: 'scene',
    content: envelope.composeObservablePayload({
      doc: envelope.buildParagraphDocumentFromText(`flow alpha text ${index + 1}`),
    }),
  }));
  const flowProjection = measureMs(() => flowMode.composeFlowReadProjection(flowScenes));
  assert.equal(flowProjection.elapsedMs < BUDGETS_MS.flowProjection, true);
  assert.equal(flowProjection.value.ok, true);
  assert.equal(flowProjection.value.scenes.length, ACCEPTED_TIERS.flowScenes);
  assert.equal(Object.prototype.hasOwnProperty.call(flowProjection.value, 'path'), false);

  const searchSources = Array.from({ length: ACCEPTED_TIERS.searchSources }, (_, index) => ({
    type: 'document',
    sourceId: `scene-${index}`,
    nodeId: sceneNodeId(index),
    kind: 'scene',
    title: `Search Scene ${index + 1}`,
    text: index % 3 === 0 ? `needle alpha body ${index}` : `quiet beta body ${index}`,
    contentHash: `hash-${index}`,
  }));
  const searchProjection = measureMs(() => searchReadModel.buildProjectSearchReadModel({
    projectId: 's40-longform',
    options: { query: 'needle', limit: 80 },
    sources: searchSources,
  }));
  assert.equal(searchProjection.elapsedMs < BUDGETS_MS.searchProjection, true);
  assert.equal(searchProjection.value.results.length, 80);
  assert.equal(searchProjection.value.truncated, true);
  assert.equal(JSON.stringify(searchProjection.value).includes('filePath'), false);

  const cancelledSearch = searchReadModel.buildProjectSearchReadModel({
    projectId: 's40-longform',
    options: { query: 'needle', limit: 80 },
    signal: { aborted: true },
    sources: searchSources,
  });
  assert.equal(cancelledSearch.state, 'cancelled');
  assert.equal(cancelledSearch.stale, true);

  const notesDocument = {
    projectId: 's40-longform',
    notes: Array.from({ length: ACCEPTED_TIERS.notes }, (_, index) => ({
      id: `note-${String(index).padStart(32, 'a').slice(0, 32)}`,
      scope: index % 2 === 0 ? 'inbox' : 'scene',
      title: `Note ${index + 1}`,
      body: `note body ${index + 1}`,
      sceneId: sceneNodeId(index % ACCEPTED_TIERS.flowScenes),
      nodeId: sceneNodeId(index % ACCEPTED_TIERS.flowScenes),
    })),
  };
  const notesReadModel = measureMs(() => notesStorage.buildNotesReadModel(notesDocument));
  assert.equal(notesReadModel.elapsedMs < BUDGETS_MS.notesReadModel, true);
  assert.equal(notesReadModel.value.counts.total, ACCEPTED_TIERS.notes);
  assert.equal(notesReadModel.value.counts.inbox, ACCEPTED_TIERS.notes / 2);

  const cache = deriveCache.createDerivedCache();
  assert.equal(cache.set('notes', notesReadModel.value), true);
  assert.equal(cache.size(), 1);
  cache.clear();
  assert.equal(cache.size(), 0);
  const mutatedNotesReadModel = notesStorage.buildNotesReadModel({
    ...notesDocument,
    notes: notesDocument.notes.slice(1),
  });
  assert.notEqual(mutatedNotesReadModel.documentHash, notesReadModel.value.documentHash);
  assert.equal(mutatedNotesReadModel.counts.total, ACCEPTED_TIERS.notes - 1);
});

test('S40 longform contract: runtime page map bridge remains derived-only and never text truth', () => {
  const source = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8');
  const start = source.indexOf('function buildDerivedPageMapRuntimeBridge({');
  const end = source.indexOf('function clearDerivedPageMapRuntimeBridgeDataset()', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const bridgeSource = source.slice(start, end);
  for (const token of [
    'contract.derived === true',
    'contract.derivedOnly === true',
    'contract.runtimeOnly === true',
    'contract.textTruth === false',
    'contract.storageTruth === false',
    'contract.exportTruth === false',
    'pageMapProductRuntimeBinding === false',
  ]) {
    assert.equal(bridgeSource.includes(token), true, `missing derived-only guard: ${token}`);
  }
  assert.equal(bridgeSource.includes('writeFileAtomic'), false);
  assert.equal(bridgeSource.includes('localStorage.setItem'), false);
});
