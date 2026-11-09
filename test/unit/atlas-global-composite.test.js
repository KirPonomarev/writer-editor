'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const profile = require('../../src/core/writer-local-profile-v1.cjs');
const registry = require('../../src/shared/workspaceQueryRegistry.cjs');
const QUERY = 'query.atlasGlobalCompositeGraph';
const V14 = 'WRITER_LOCAL_ATLAS_GLOBAL_COMPOSITE_V14';

test('composite route: one registered read query and exact V14 inheritance with old profiles protected', () => {
  assert.equal(registry.WORKSPACE_QUERY_IDS.ATLAS_GLOBAL_COMPOSITE_GRAPH, QUERY);
  assert.equal(registry.isWorkspaceQueryIdAllowed(QUERY), true);
  const old = profile.createWriterAtlasAssociationsProfileProjection({ isPackaged: true, platform: 'darwin' });
  const current = profile.createWriterAtlasGlobalCompositeProfileProjection({ isPackaged: true, platform: 'darwin' });
  assert.deepEqual(current, { ...old, profileId: V14, schemaVersion: 'writer-local-profile.v14',
    admittedQueryIds: [...old.admittedQueryIds, QUERY] });
  assert.equal(profile.evaluateWriterLocalQueryAccess({ profile: old, queryId: QUERY }).allowed, false);
  assert.equal(profile.evaluateWriterLocalQueryAccess({ profile: current, queryId: QUERY }).allowed, true);
  for (const factory of ['createWriterLocalProfileProjection', 'createWriterAtlasProfileProjection',
    'createWriterManualMapProfileProjection', 'createWriterAtlasReadSurfacesProfileProjection',
    'createWriterIdeaMeaningAuthoringProfileProjection', 'createWriterSceneLanguageTagProfileProjection']) {
    assert.equal(profile.evaluateWriterLocalQueryAccess({ profile: profile[factory]({ isPackaged: true, platform: 'darwin' }), queryId: QUERY }).allowed, false, factory);
  }
  for (const commandId of old.admittedCommandIds) {
    const record = { id: commandId, domain: commandId.split('.')[0] };
    assert.equal(profile.evaluateWriterLocalCommandAccess({ profile: current, commandId, productCommandRecord: record }).allowed,
      profile.evaluateWriterLocalCommandAccess({ profile: old, commandId, productCommandRecord: record }).allowed, commandId);
  }
});

test('composite route: exact profile revalidation rejects forged fields, accessors and query expansion', () => {
  const p = profile.createWriterAtlasGlobalCompositeProfileProjection({ isPackaged: true, platform: 'darwin' });
  let invoked = 0;
  for (const bad of [{ ...p, optionalSystemsEnabled: true }, { ...p, admittedQueryIds: [...p.admittedQueryIds, 'query.forbidden'] },
    { ...p, profileId: V14 + '-forged' }, { ...p, signing: true }, { ...p, extra: true },
    Object.defineProperty({ ...p }, 'admittedQueryIds', { enumerable: true, get() { invoked++; return p.admittedQueryIds; } })]) {
    assert.equal(profile.evaluateWriterLocalQueryAccess({ profile: bad, queryId: QUERY }).allowed, false);
    assert.equal(profile.evaluateWriterLocalCommandAccess({ profile: bad, commandId: 'atlas.association.record',
      productCommandRecord: { id: 'atlas.association.record', domain: 'atlas' } }).allowed, false);
  }
  assert.equal(invoked, 0);
});

async function fixture(options = {}) {
  const core = await import('../../src/core/runtime.mjs');
  const projectId = 'composite-product-project';
  const result = core.applyCoreSequence(core.createInitialCoreState(), [
    { type: core.CORE_COMMAND_IDS.PROJECT_CREATE, payload: { projectId, sceneId: 'scene-a', title: 'Composite' } },
    { type: core.CORE_COMMAND_IDS.PROJECT_APPLY_TEXT_EDIT, payload: { projectId, sceneId: 'scene-a', text: 'Свет. Свет. é 🧭' } },
    { type: core.CORE_COMMAND_IDS.IDEA_CREATE, payload: { projectId, ideaId: 'idea-light', title: 'Авторская идея' } },
    { type: core.CORE_COMMAND_IDS.MEANING_PROMOTE, payload: { projectId, meaningId: 'meaning-light', title: 'Авторский смысл',
      interpretation: 'Авторское решение', source: { kind: 'idea', ideaId: 'idea-light' } } },
    { type: core.CORE_COMMAND_IDS.MANUAL_MAP_CREATE, payload: { projectId, mapId: 'map-a', title: 'Моя карта' } },
    { type: core.CORE_COMMAND_IDS.MANUAL_MAP_NODE_ADD, payload: { projectId, mapId: 'map-a', nodeId: 'node-a', label: 'Мой узел' } },
  ]);
  assert.equal(result.ok, true, JSON.stringify(result.error));
  let reads = 0, scheduled = 0, epoch = 1, allowed = true;
  const { createAtlasGlobalCompositeQuery } = await import('../../src/main/atlasGlobalCompositeQuery.mjs');
  const query = createAtlasGlobalCompositeQuery({
    canRead: () => allowed,
    captureContext: () => epoch,
    isContextCurrent: token => token === epoch,
    readCoreState: async () => { reads++; await options.beforeRead?.(reads); return { projectId, coreState: result.state }; },
    schedule: async (safe, run) => { scheduled++; return run(safe); },
  });
  return { core, state: result.state, projectId, query, calls: () => ({ reads, scheduled }),
    revoke: () => { allowed = false; }, change: () => { epoch++; },
    updateSource: state => { result.state = state; epoch++; } };
}

test('composite query: actual Core sources remain exact while typed graph, source refs and bounded list are exposed', async () => {
  const f = await fixture(), before = structuredClone(f.state);
  const r = await f.query({ projectId: f.projectId, explicitOpen: true });
  assert.equal(r.ok, true, JSON.stringify(r));
  const p = r.atlasGlobalCompositeGraph;
  assert.equal(p.schemaVersion, 'atlas.globalCompositeSurface.v1');
  assert.equal(p.projectId, f.projectId); assert.equal(p.state, 'ready');
  assert.match(p.sourceRevision, /^[a-f0-9]{64}$/u); assert.match(p.compositeHash, /^[a-f0-9]{64}$/u);
  assert.equal(p.sourceRefs.length, 7);
  assert.ok(p.list.rows.some(n => n.sourceProjection === 'idea.projection'));
  assert.ok(p.list.rows.some(n => n.sourceProjection === 'meaning.projection'));
  assert.ok(p.list.rows.some(n => n.sourceProjection === 'manualMap.graph'));
  assert.ok(p.graph.nodes.length <= 120); assert.ok(p.graph.edges.length <= 240); assert.ok(p.list.rows.length <= 24);
  assert.equal(p.authority.projectTruthMutation, false); assert.equal(p.authority.sourceProjectionWriteBack, false);
  for (const ref of p.sourceRefs) { assert.equal(ref.sourceWriteBack, false); assert.equal(ref.readOnly, true); }
  assert.deepEqual(f.state, before); assert.deepEqual(f.calls(), { reads: 1, scheduled: 1 });
});

test('composite query: no explicit request, denied capability and malformed payload do not read or schedule', async () => {
  const f = await fixture(); let getter = 0;
  const invalid = [{ projectId: f.projectId }, { projectId: f.projectId, explicitOpen: false },
    { projectId: f.projectId, explicitOpen: true, offset: -1 }, { projectId: f.projectId, explicitOpen: true, offset: 1.1 },
    { projectId: f.projectId, explicitOpen: true, projection: 'arbitrary' },
    { projectId: f.projectId, explicitOpen: true, trust: 'automatic-confirm' },
    { projectId: f.projectId, explicitOpen: true, path: '/outside' },
    { projectId: f.projectId, explicitOpen: true, selectedNodeId: 'x'.repeat(513) },
    Object.defineProperty({ projectId: f.projectId }, 'explicitOpen', { enumerable: true, get() { getter++; return true; } }),
    Object.create({ projectId: f.projectId, explicitOpen: true })];
  for (const [index, payload] of invalid.entries()) { const r = await f.query(payload); assert.equal(r.ok, false, `invalid payload ${index}`); }
  assert.equal(getter, 0); assert.deepEqual(f.calls(), { reads: 0, scheduled: 0 });
  f.revoke(); assert.equal((await f.query({ projectId: f.projectId, explicitOpen: true })).ok, false);
  assert.deepEqual(f.calls(), { reads: 0, scheduled: 0 });
});

test('composite query: wrong project refuses with original source unchanged', async () => {
  const f = await fixture(), before = structuredClone(f.state);
  const r = await f.query({ projectId: 'different-project', explicitOpen: true });
  assert.equal(r.ok, false); assert.match(r.error.code, /PROJECT_MISMATCH/u);
  assert.deepEqual(f.state, before);
});

test('composite query: canonical author nodes retain author trust and derived plot remains an observation', async () => {
  const f = await fixture();
  const r = await f.query({ projectId: f.projectId, explicitOpen: true, trust: 'AUTHOR_CONFIRMED' });
  assert.equal(r.ok, true); assert.equal(r.atlasGlobalCompositeGraph.list.total, 3);
  assert.deepEqual(r.atlasGlobalCompositeGraph.list.rows.map(n => n.sourceProjection).sort(),
    ['idea.projection', 'manualMap.graph', 'meaning.projection']);
  const observation = await f.query({ projectId: f.projectId, explicitOpen: true, trust: 'ALGORITHMIC_OBSERVATION' });
  assert.equal(observation.ok, true); assert.ok(observation.atlasGlobalCompositeGraph.list.rows.length > 0);
  assert.ok(observation.atlasGlobalCompositeGraph.list.rows.every(n => !['idea.projection', 'meaning.projection', 'manualMap.graph'].includes(n.sourceProjection)));
});

for (const changed of ['lifecycle', 'capability']) test(`composite query: ${changed} revocation during source await refuses publication`, async () => {
  let release;
  const barrier = new Promise(resolve => { release = resolve; });
  const f = await fixture({ beforeRead: () => barrier });
  const pending = f.query({ projectId: f.projectId, explicitOpen: true });
  await new Promise(resolve => setImmediate(resolve));
  if (changed === 'lifecycle') f.change(); else f.revoke();
  release();
  const result = await pending;
  assert.equal(result.ok, false); assert.match(result.error.code, /CONTEXT_STALE/u);
  assert.equal(result.atlasGlobalCompositeGraph, undefined);
});

test('composite query: slower earlier request cannot publish over a newer selection', async () => {
  let release;
  const barrier = new Promise(resolve => { release = resolve; });
  const f = await fixture({ beforeRead: reads => reads === 1 ? barrier : undefined });
  const first = f.query({ projectId: f.projectId, explicitOpen: true });
  const second = await f.query({ projectId: f.projectId, explicitOpen: true, projection: 'idea' });
  assert.equal(second.ok, true); assert.equal(second.atlasGlobalCompositeGraph.list.total, 1);
  release();
  const older = await first;
  assert.equal(older.ok, false); assert.match(older.error.code, /CONTEXT_STALE/u);
  assert.equal(older.atlasGlobalCompositeGraph, undefined);
});

test('composite query: large real source is paged and graph omissions disclosed without source truncation', async () => {
  const f = await fixture();
  const next = f.core.applyCoreSequence(f.state, Array.from({ length: 150 }, (_, i) => ({
    type: f.core.CORE_COMMAND_IDS.MANUAL_MAP_NODE_ADD,
    payload: { projectId: f.projectId, mapId: 'map-a', nodeId: `bulk-${i}`, label: `Узел ${i}` },
  })));
  assert.equal(next.ok, true); f.updateSource(next.state);
  const before = structuredClone(next.state);
  const a = await f.query({ projectId: f.projectId, explicitOpen: true });
  const b = await f.query({ projectId: f.projectId, explicitOpen: true, offset: 24 });
  assert.equal(a.ok, true); assert.equal(b.ok, true);
  const first = a.atlasGlobalCompositeGraph, second = b.atlasGlobalCompositeGraph;
  assert.equal(first.list.rows.length, 24); assert.equal(second.list.rows.length, 24);
  assert.equal(second.list.offset, 24); assert.equal(first.list.total, second.list.total);
  assert.ok(first.list.total > 150); assert.equal(first.graph.nodes.length, 120);
  assert.equal(first.summary.omittedGraphNodes, first.list.total - 120);
  assert.equal(new Set([...first.list.rows, ...second.list.rows].map(n => n.nodeId)).size, 48);
  assert.deepEqual(first.graph, second.graph);
  const end = await f.query({ projectId: f.projectId, explicitOpen: true, offset: 50_000 });
  assert.equal(end.ok, true); assert.equal(end.atlasGlobalCompositeGraph.list.hasMore, false);
  assert.deepEqual(next.state, before);
  assert.equal(Object.keys(next.state.data.projects[f.projectId].manualMaps.maps['map-a'].nodes).length, 151);
});

class CompositeElement {
  constructor(document, tag, ns = '') { this.ownerDocument = document; this.tagName = tag.toUpperCase(); this.namespaceURI = ns;
    this.children = []; this.parentNode = null; this.dataset = {}; this.attributes = {}; this.events = {}; this.tabIndex = -1; }
  appendChild(node) { node.parentNode = this; this.children.push(node); return node; }
  replaceChildren() { this.children.forEach(node => { node.parentNode = null; }); this.children = []; }
  setAttribute(key, value) { this.attributes[key] = String(value); if (key === 'tabindex') this.tabIndex = Number(value); }
  getAttribute(key) { return this.attributes[key]; }
  addEventListener(key, fn) { (this.events[key] ||= []).push(fn); }
  dispatch(type, extra = {}) { const event = { currentTarget: this, target: this, preventDefault() {}, stopPropagation() {}, ...extra };
    (this.events[type] || []).forEach(fn => fn(event)); }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  get isConnected() { return this === this.ownerDocument.host || Boolean(this.parentNode?.isConnected); }
  set textContent(value) { this.label = String(value); this.replaceChildren(); }
  get textContent() { return (this.label || '') + this.children.map(child => child.textContent).join(''); }
  set innerHTML(value) { throw new Error('HTML interpolation forbidden in composite presentation'); }
  focus() { this.ownerDocument.activeElement = this; }
  all() { return this.children.flatMap(child => [child, ...child.all()]); }
  querySelectorAll(selector) { assert.equal(selector, '[data-composite-focus]'); return this.all().filter(node => node.dataset.compositeFocus); }
}
function compositeDocument() {
  const document = { activeElement: null, createElement: tag => new CompositeElement(document, tag),
    createElementNS: (ns, tag) => new CompositeElement(document, tag, ns) };
  document.host = document.createElement('div'); return document;
}

test('composite presentation: graph and keyboard list share exact selection, with one tab stop per group', async () => {
  const f = await fixture();
  const initial = (await f.query({ projectId: f.projectId, explicitOpen: true })).atlasGlobalCompositeGraph;
  const selected = initial.graph.nodes[1]; assert.ok(selected);
  const state = (await f.query({ projectId: f.projectId, explicitOpen: true, selectedNodeId: selected.nodeId })).atlasGlobalCompositeGraph;
  const ui = await import('../../src/renderer/atlasGlobalCompositeSurface.mjs');
  assert.equal(ui.validateAtlasGlobalCompositeProjection(state, f.projectId), state);
  const document = compositeDocument(), requests = [], actions = { isCurrent: () => true, canRefresh: () => true,
    onRequest: payload => requests.push(payload), onSource() {} };
  ui.renderAtlasGlobalCompositeSurface(document.host, state, actions);
  const graph = document.host.all().filter(node => node.getAttribute('role') === 'button');
  const rows = document.host.all().filter(node => node.getAttribute('role') === 'option');
  assert.equal(graph.length, state.graph.nodes.length); assert.equal(rows.length, state.list.rows.length);
  assert.equal(graph.filter(node => node.tabIndex === 0).length, 1);
  assert.equal(rows.filter(node => node.tabIndex === 0).length, 1);
  const graphSelected = graph.find(node => node.dataset.compositeFocus === 'graph:' + selected.nodeId);
  const rowSelected = rows.find(node => node.dataset.compositeFocus === 'node:' + selected.nodeId);
  graphSelected.dispatch('keydown', { key: 'Enter' }); rowSelected.dispatch('click');
  assert.equal(requests.length, 2); assert.equal(requests[0].selectedNodeId, requests[1].selectedNodeId);
  rows[0].dispatch('keydown', { key: 'ArrowDown' }); assert.equal(document.activeElement, rows[1]);
});

test('composite presentation: stale or detached controls cannot request or navigate, labels stay plain text', async () => {
  const f = await fixture(), value = (await f.query({ projectId: f.projectId, explicitOpen: true })).atlasGlobalCompositeGraph;
  const ui = await import('../../src/renderer/atlasGlobalCompositeSurface.mjs');
  const state = structuredClone(value); state.list.rows[0].label = '<img src=x onerror=bad()>';
  const document = compositeDocument(); let requests = 0, sources = 0, stale = 0, current = true;
  const actions = { isCurrent: () => current, canRefresh: () => current, onRequest: () => requests++, onSource: () => sources++, onStale: () => stale++ };
  ui.renderAtlasGlobalCompositeSurface(document.host, state, actions);
  assert.ok(document.host.textContent.includes('<img src=x onerror=bad()>'));
  const old = document.host.all().find(node => node.getAttribute('role') === 'option');
  current = false; old.dispatch('click'); assert.equal(stale, 1); assert.equal(requests, 0);
  ui.renderAtlasGlobalCompositeSurface(document.host, { state: 'unavailable', projectId: f.projectId }, actions);
  current = true; old.dispatch('click'); assert.equal(requests, 0); assert.equal(sources, 0);
});

test('composite presentation: mismatched project, malformed positions, excessive draw and unsafe authority refuse', async () => {
  const f = await fixture(), state = (await f.query({ projectId: f.projectId, explicitOpen: true })).atlasGlobalCompositeGraph;
  const { validateAtlasGlobalCompositeProjection: validate } = await import('../../src/renderer/atlasGlobalCompositeSurface.mjs');
  assert.equal(validate(state, 'another-project'), null);
  for (const change of [x => { x.graph.nodes[0].position.x = Infinity; }, x => { x.authority.sourceProjectionWriteBack = true; },
    x => { x.graph.nodes = Array(121).fill(x.graph.nodes[0]); }, x => { x.list.rows.push(...Array(25).fill(x.list.rows[0])); },
    x => { x.graph.edges.push({ fromNodeId: 'outside', toNodeId: 'outside' }); }]) {
    const bad = structuredClone(state); change(bad); assert.equal(validate(bad, f.projectId), null);
  }
});
