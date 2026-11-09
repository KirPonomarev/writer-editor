const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function functionSection(source, functionName, nextFunctionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} must exist`);
  const next = nextFunctionName ? source.indexOf(`function ${nextFunctionName}`, start + 1) : -1;
  return source.slice(start, next > start ? next : source.length);
}

test('navigator derived counters renderer projects only pathless counter data', () => {
  const editor = read('src/renderer/editor.js');
  const normalizeSection = functionSection(editor, 'normalizeNavigatorDerivedCounters', 'formatNavigatorDerivedCounters');
  const formatSection = functionSection(editor, 'formatNavigatorDerivedCounters', 'isTreeNodeDefaultExpanded');
  const renderSection = functionSection(editor, 'renderTreeNode', 'findRomanRootNode');

  assert.match(normalizeSection, /node\.derivedCounters/u);
  assert.equal(/\bpath\s*:/u.test(normalizeSection), false);
  assert.match(formatSection, /сл\./u);
  assert.match(formatSection, /сц\./u);
  assert.match(renderSection, /row\.dataset\.navigatorWordCount/u);
  assert.match(renderSection, /row\.dataset\.navigatorSceneCount/u);
  assert.match(renderSection, /row\.dataset\.navigatorProgressPercent/u);
  assert.match(renderSection, /tree__counters/u);
  assert.equal(/\bpath\s*:/u.test(renderSection), false);
});

test('navigator derived counters styles stay bounded in the left rail', () => {
  const styles = read('src/renderer/styles.css');
  assert.match(styles, /\.sidebar--left \.tree__counters/u);
  assert.match(styles, /max-width: 96px/u);
  assert.match(styles, /text-overflow: ellipsis/u);
  assert.equal(styles.includes('transform: scale'), false);
});

const vm = require('node:vm');

function actualNavigatorFunction(source, name) {
  const start = new RegExp('^(?:async )?function ' + name + '\\(', 'm').exec(source);
  assert.ok(start, name);
  const end = source.indexOf('\n}\n', start.index);
  assert.ok(end > start.index, name);
  return source.slice(start.index, end + 2);
}

async function savedNavigatorHarness() {
  const { annotateNavigatorDerivedCounters } = await import('../../src/derived/navigatorCounters.mjs');
  const first = 'Синтетическая сцена Pulse. Второе контрольное изменение сохраняется автором.\nЛира вошла в комнату. Лира обещала вернуться.';
  const second = 'Контрольная вторая сцена для перехода с карты.';
  const projection = async (text = second) => {
    const root = { nodeId: 'roman', kind: 'roman-root', children: [
      { nodeId: 'scene-a', kind: 'scene', children: [] },
      { nodeId: 'scene-b', kind: 'scene', children: [] },
    ] };
    await annotateNavigatorDerivedCounters(root, { readText: async item => item.nodeId === 'scene-a' ? first : text });
    return { ok: true, projectId: 'project-a', root, treeRevision: 7 };
  };
  const initial = await projection(''), requests = [], renders = [], statuses = [], invalidations = [];
  const selection = { anchor: 4, head: 9 }, focusedElement = { id: 'authoring-editor' };
  const c = vm.createContext({
    currentProjectId: 'project-a', currentDocumentId: 'scene-b', activeTab: 'roman',
    treeQueryGeneration: 0, treeRoot: initial.root, treeMutationProjection: { projectId: 'project-a', treeRevision: 6 },
    treeContainer: { dataset: {} }, activeDocumentRevealRequested: false,
    expandedNodesByTab: new Map(), navigatorSelectionState: { projectId: 'project-a' },
    localEditGeneration: 2, lastAckedGeneration: 1, localDirty: true, isTiptapMode: false, currentRightTab: 'notes',
    authoringText: second, selection, focusedElement,
    PROJECT_TREE_QUERY_ID: 'query.projectTree', normalizeProjectId: value => value,
    getExpandedSet: () => new Set(['roman']), readWorkspaceStorage: () => '[]', getTreeExpandedStorageKey: () => 'expanded',
    isProjectTreeDocumentId: () => true, revealActiveDocumentAncestors: () => { throw Error('unexpected focus/reveal'); },
    renderTree: options => renders.push({ counts: structuredClone(c.treeRoot.derivedCounters), options }),
    updateStatusText: value => statuses.push(value), updateSaveStateText() {},
    refreshManuscriptNoteReferences() {}, refreshVisibleCommentProjection() {}, updateInspectorSnapshot() {},
    invalidateAtlasPublications: () => invalidations.push('atlas'),
    invalidateDocxImportAttempt: () => invalidations.push('docx'),
    createNavigatorSelectionState: projectId => ({ projectId }),
    invokeWorkspaceQueryBridge: (id, payload) => new Promise((resolve, reject) => requests.push({ id, payload, resolve, reject })),
    window: { electronAPI: { invokeWorkspaceQueryBridge() {}, onSetDirty: callback => { c.dirty = callback; } } },
  });
  const source = read('src/renderer/editor.js');
  const start = source.indexOf('  window.electronAPI.onSetDirty((message) => {');
  const end = source.indexOf('\n  });', start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext(actualNavigatorFunction(source, 'loadTree') + '\n' + source.slice(start, end + 6), c);
  const ack = (generation = c.localEditGeneration) => c.dirty({ state: false, ack: { kind: 'SAVED', savedGeneration: generation } });
  const settle = () => new Promise(resolve => setImmediate(resolve));
  const preserved = () => {
    assert.equal(c.authoringText, second);
    assert.equal(c.selection, selection);
    assert.equal(c.focusedElement, focusedElement);
    assert.equal(c.activeDocumentRevealRequested, false);
    assert.deepEqual(invalidations, [], 'saved tree refresh must not replace the current project');
  };
  return { c, ack, requests, renders, statuses, projection, settle, preserved };
}

test('accepted durable Save refreshes actual navigator query from saved canonical scene text', async () => {
  const h = await savedNavigatorHarness();
  assert.equal(h.c.treeRoot.derivedCounters.wordCount, 15);
  assert.equal(h.c.treeRoot.derivedCounters.progressPercent, 50);
  h.ack();
  assert.equal(h.c.localDirty, false, 'durable ACK still clears only the current generation');
  assert.equal(h.requests.length, 1, 'new accepted saved source must request the authoritative tree');
  assert.equal(h.requests[0].id, 'query.projectTree');
  assert.equal(h.requests[0].payload.tab, 'roman');
  h.requests[0].resolve(await h.projection()); await h.settle();
  assert.equal(h.renders.length, 1);
  assert.equal(h.c.treeRoot.derivedCounters.wordCount, 22);
  assert.equal(h.c.treeRoot.derivedCounters.sceneCount, 2);
  assert.equal(h.c.treeRoot.derivedCounters.progressPercent, 100);
  assert.equal(h.c.treeMutationProjection.treeRevision, 7);
  assert.equal(Object.isFrozen(h.c.treeMutationProjection), true);
  assert.equal(h.renders[0].options.revealActive, false);
  assert.equal(h.renders[0].options.restoreEditorFocus, false);
  h.preserved();
});

test('navigator refresh ignores stale future protected at-risk legacy and dirty-only notifications', async t => {
  for (const [name, message] of [
    ['stale', { state: false, ack: { kind: 'SAVED', savedGeneration: 1 } }],
    ['future', { state: false, ack: { kind: 'SAVED', savedGeneration: 3 } }],
    ['protected', { state: true, ack: { kind: 'PROTECTED', savedGeneration: 2 } }],
    ['at-risk', { state: true, ack: { kind: 'AT_RISK', savedGeneration: 2 } }],
    ['legacy-false', false], ['legacy-true', true], ['dirty-only', { state: true }],
  ]) await t.test(name, async () => {
    const h = await savedNavigatorHarness(); h.c.dirty(message); await h.settle();
    assert.equal(h.requests.length, 0); assert.equal(h.renders.length, 0);
    if (['stale', 'future', 'protected', 'at-risk'].includes(name)) assert.equal(h.c.localDirty, true);
    h.preserved();
  });
});

test('navigator refresh suppresses repeated and no-op ACK but tolerates autosave reply ordering', async t => {
  const duplicate = await savedNavigatorHarness(); duplicate.ack(); duplicate.ack();
  assert.equal(duplicate.requests.length, 1, 'duplicate pushed ACK must not fan out another read');
  duplicate.requests[0].resolve(await duplicate.projection()); await duplicate.settle();
  duplicate.ack(); assert.equal(duplicate.requests.length, 1); duplicate.preserved();
  for (const [name, dirty, acknowledged, expected] of [
    ['already-accepted-no-op', false, 2, 0],
    ['autosave-result-precedes-push', true, 2, 1],
    ['new-generation-without-dirty-bit', false, 1, 1],
  ]) await t.test(name, async () => {
    const h = await savedNavigatorHarness(); h.c.localDirty = dirty; h.c.lastAckedGeneration = acknowledged;
    h.ack(); assert.equal(h.requests.length, expected);
    if (expected) { h.requests[0].resolve(await h.projection()); await h.settle(); assert.equal(h.renders.length, 1); }
    h.preserved();
  });
});

test('actual navigator publication rejects project tab and superseded-generation drift after save', async t => {
  for (const [name, change] of [
    ['project', c => { c.currentProjectId = 'other-project'; }],
    ['tab', c => { c.activeTab = 'other-tab'; }],
    ['generation', c => { c.treeQueryGeneration++; }],
  ]) await t.test(name, async () => {
    const h = await savedNavigatorHarness(); h.ack(); assert.equal(h.requests.length, 1);
    change(h.c); const project = h.c.currentProjectId, tab = h.c.activeTab;
    h.requests[0].resolve(await h.projection()); await h.settle();
    assert.equal(h.c.currentProjectId, project); assert.equal(h.c.activeTab, tab);
    assert.equal(h.renders.length, 0); assert.equal(h.c.treeRoot.derivedCounters.wordCount, 15);
    assert.equal(h.statuses.length, 0); h.preserved();
  });
});

test('project-scoped navigator refresh permits same-project scene replacement without moving editor focus', async () => {
  const h = await savedNavigatorHarness(); h.ack(); assert.equal(h.requests.length, 1);
  h.c.currentDocumentId = 'scene-a'; h.c.currentTreeContentPublicationId = 'new-scene-publication';
  h.requests[0].resolve(await h.projection()); await h.settle();
  assert.equal(h.renders.length, 1); assert.equal(h.c.treeRoot.derivedCounters.wordCount, 22); h.preserved();
});

test('newer accepted save wins when two actual tree replies arrive out of order', async () => {
  const h = await savedNavigatorHarness(); h.ack(); assert.equal(h.requests.length, 1);
  h.c.localEditGeneration = 3; h.c.localDirty = true; h.ack(); assert.equal(h.requests.length, 2);
  h.requests[1].resolve(await h.projection('Контрольная вторая сцена для перехода с карты. Дополнение.')); await h.settle();
  assert.equal(h.c.treeRoot.derivedCounters.wordCount, 23);
  h.requests[0].resolve(await h.projection()); await h.settle();
  assert.equal(h.renders.length, 1); assert.equal(h.c.treeRoot.derivedCounters.wordCount, 23);
  assert.equal(h.c.localDirty, false); h.preserved();
});

test('failed current tree read remains truthful and stale failures cannot damage current projection', async t => {
  for (const [name, stale] of [['current', false], ['stale-project', true]]) await t.test(name, async () => {
    const h = await savedNavigatorHarness(); h.ack(); assert.equal(h.requests.length, 1);
    const previous = h.c.treeMutationProjection;
    if (stale) h.c.currentProjectId = 'other-project';
    h.requests[0].reject(Error('read failed')); await h.settle();
    assert.equal(h.renders.length, 0); assert.equal(h.c.treeRoot.derivedCounters.wordCount, 15);
    assert.equal(h.c.localDirty, false, 'query failure cannot revoke a durable ACK');
    if (stale) { assert.equal(h.c.treeMutationProjection, previous); assert.deepEqual(h.statuses, []); }
    else { assert.equal(h.c.treeMutationProjection, null); assert.deepEqual(h.statuses, ['Ошибка']); }
    h.preserved();
  });
});

const ledgerSaveQueryId = 'query.atlasContinuityLedgerSurface';

function savedLedgerProjection(source, pulseCount) {
  return {
    ok: true,
    atlasContinuityLedgerSurface: {
      state: 'ready',
      projectId: 'project-a',
      summary: { sourceHash: source },
      wseRevisionTimeObject: { sourceRevision: source },
      pulseClaim: { summary: { totalRows: pulseCount } },
    },
  };
}

async function savedOpenLedgerHarness() {
  const h = await savedNavigatorHarness();
  const publications = [], existingSceneRefreshes = [];
  Object.assign(h.c, {
    currentRightTab: 'atlas',
    currentAtlasSurface: 'continuity',
    currentTreeContentPublicationId: 'scene-publication',
    atlasContinuityLedgerExplicitOpen: true,
    atlasContinuityRequestEpoch: 0,
    atlasPublicationEpoch: 1,
    atlasQueryPublicationSequences: new Map(),
    atlasCommandPublicationSequence: 0,
    atlasJourneyDraftRevision: 0,
    manualMapDraftRevision: 0,
    manualMapDraftOwnership: null,
    ATLAS_CONTINUITY_LEDGER_SURFACE_QUERY_ID: ledgerSaveQueryId,
    atlasContinuityLedgerState: savedLedgerProjection('saved-initial', 0).atlasContinuityLedgerSurface,
    refreshActiveAtlasSurface() { existingSceneRefreshes.push(h.c.currentAtlasSurface); },
    renderAtlasContinuityLedgerState() {
      const state = h.c.atlasContinuityLedgerState;
      if (state.state === 'ready') publications.push({
        source: state.summary.sourceHash,
        wse: state.wseRevisionTimeObject.sourceRevision,
        pulse: state.pulseClaim.summary.totalRows,
      });
    },
  });
  const source = read('src/renderer/editor.js');
  vm.runInContext([
    'captureAtlasPublication',
    'beginAtlasQueryPublication',
    'reviewSurfaceIsPlainObject',
    'normalizeAtlasContinuityLedgerSurface',
    'refreshAtlasContinuityLedgerSurface',
  ].map(name => actualNavigatorFunction(source, name)).join('\n'), h.c);
  return { ...h, publications, existingSceneRefreshes };
}

test('current durable Save refreshes already open Ledger from the existing query', async () => {
  const h = await savedOpenLedgerHarness();
  h.ack();
  assert.deepEqual(h.requests.map(r => r.id), ['query.projectTree', ledgerSaveQueryId]);
  assert.deepEqual(JSON.parse(JSON.stringify(h.requests[1].payload)), {
    projectId: 'project-a', explicitOpen: true, rowLimit: 16,
  });
  h.requests[0].resolve(await h.projection());
  h.requests[1].resolve(savedLedgerProjection('saved-current', 1));
  await h.settle();
  assert.deepEqual(h.publications, [{ source: 'saved-current', wse: 'saved-current', pulse: 1 }]);
  assert.equal(h.c.localDirty, false);
  assert.deepEqual(h.existingSceneRefreshes, []);
  h.preserved();
  h.ack();
  assert.equal(h.requests.length, 2, 'a repeated accepted generation must not query Ledger again');
});

test('a Ledger query is not started by noncurrent saves or inactive views', async t => {
  for (const [name, configure, send, tree] of [
    ['stale', () => {}, h => h.ack(1), false],
    ['future', () => {}, h => h.ack(3), false],
    ['protected', () => {}, h => h.c.dirty({ state: true, ack: { kind: 'PROTECTED', savedGeneration: 2 } }), false],
    ['no-op', c => { c.localDirty = false; c.lastAckedGeneration = 2; }, h => h.ack(), false],
    ['hidden', c => { c.currentRightTab = 'history'; }, h => h.ack(), true],
    ['closed', c => { c.atlasContinuityLedgerExplicitOpen = false; }, h => h.ack(), true],
    ['another Atlas view', c => { c.currentAtlasSurface = 'temporal'; }, h => h.ack(), true],
  ]) await t.test(name, async () => {
    const h = await savedOpenLedgerHarness();
    configure(h.c); send(h); await h.settle();
    assert.deepEqual(h.requests.map(r => r.id), tree ? ['query.projectTree'] : []);
    assert.equal(h.publications.length, 0);
    if (name === 'closed') assert.equal(h.c.atlasContinuityLedgerExplicitOpen, false);
    if (tree) { h.requests[0].resolve(await h.projection()); await h.settle(); }
    h.preserved();
  });
});

test('the same Save still refreshes the existing Atlas scene and journey routes', async t => {
  for (const surface of ['currentScene', 'journey']) await t.test(surface, async () => {
    const h = await savedOpenLedgerHarness();
    h.c.currentAtlasSurface = surface; h.ack();
    assert.deepEqual(h.existingSceneRefreshes, [surface]);
    assert.deepEqual(h.requests.map(r => r.id), ['query.projectTree']);
    h.requests[0].resolve(await h.projection()); await h.settle();
    assert.equal(h.publications.length, 0);
    h.preserved();
  });
});

test('a late Ledger response cannot replace the newer accepted saved revision', async () => {
  const h = await savedOpenLedgerHarness();
  h.ack();
  h.c.localEditGeneration = 3; h.c.localDirty = true; h.ack();
  assert.deepEqual(h.requests.map(r => r.id), ['query.projectTree', ledgerSaveQueryId, 'query.projectTree', ledgerSaveQueryId]);
  h.requests[2].resolve(await h.projection()); h.requests[3].resolve(savedLedgerProjection('saved-newer', 2)); await h.settle();
  h.requests[0].resolve(await h.projection()); h.requests[1].resolve(savedLedgerProjection('saved-older', 1)); await h.settle();
  assert.deepEqual(h.publications, [{ source: 'saved-newer', wse: 'saved-newer', pulse: 2 }]);
  h.preserved();
});

test('an accepted Save result cannot publish Ledger after its view or source changes', async t => {
  for (const [name, change] of [
    ['project', c => { c.currentProjectId = 'project-b'; }],
    ['scene', c => { c.currentDocumentId = 'scene-a'; }],
    ['edit generation', c => { c.localEditGeneration++; c.localDirty = true; }],
    ['active view', c => { c.currentAtlasSurface = 'temporal'; }],
    ['explicit close', c => { c.atlasContinuityLedgerExplicitOpen = false; }],
  ]) await t.test(name, async () => {
    const h = await savedOpenLedgerHarness(); h.ack();
    assert.deepEqual(h.requests.map(r => r.id), ['query.projectTree', ledgerSaveQueryId]);
    change(h.c);
    h.requests[1].resolve(savedLedgerProjection('saved-stale', 1)); await h.settle();
    assert.deepEqual(h.publications, []);
    assert.equal(h.c.atlasContinuityLedgerState.summary.sourceHash, 'saved-initial');
    h.requests[0].resolve(await h.projection()); await h.settle();
  });
});
