const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '../..');
const load = relative => import(pathToFileURL(path.join(root, relative)).href);
const source = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));

async function fixture() {
  const runtime = await load('src/core/runtime.mjs');
  const matrices = await load('src/derived/atlas/deriveAtlasMatrices.mjs');
  const { hashCanonicalValue: hash } = await load('src/derived/deriveView.mjs');
  const projectId = 'scope-project';
  const commands = [
    { type: runtime.CORE_COMMAND_IDS.PROJECT_CREATE, payload: { projectId, title: 'Scope fixture', sceneId: 'scene-a' } },
    { type: runtime.CORE_COMMAND_IDS.PROJECT_APPLY_TEXT_EDIT, payload: { projectId, sceneId: 'scene-a', text: '🧭 Anna met Mira. Sol waited.' } },
    ...['Anna', 'Mira', 'Sol', 'Omar'].map(name => ({
      type: runtime.CORE_COMMAND_IDS.ATLAS_ENTITY_CREATE,
      payload: { projectId, entityId: 'entity-' + name.toLowerCase(), name, entityKind: 'character' },
    })),
  ];
  const built = runtime.applyCoreSequence(runtime.createInitialCoreState(), commands);
  assert.equal(built.ok, true);
  const state = copy(built.state);
  const project = state.data.projects[projectId];
  project.scenes['scene-b'] = { id: 'scene-b', title: 'Second', text: 'Anna met Omar. Mira left.' };
  project.scenes['scene-c'] = { id: 'scene-c', title: 'Empty observations', text: 'No named observers here.' };
  project.scenes['scene-d'] = { id: 'scene-d', title: 'Fourth', text: 'Sol met Omar.' };
  project.sceneOrder = ['scene-b', 'scene-c', 'scene-a', 'scene-d'];
  project.languageCode = 'en';
  const text = project.scenes['scene-a'].text;
  const scene = { kind: 'SCENE', sceneId: 'scene-a', sceneTextHash: hash(text) };
  const fragment = { ...scene, kind: 'FRAGMENT', startOffset: text.indexOf('Anna'), endOffset: text.indexOf('Mira') + 4 };
  const derive = (scope, extra = {}) => matrices.deriveAtlasMatrices({
    coreState: state,
    params: { projectId, ...(scope === undefined ? {} : { sourceScope: scope }), ...extra },
  });
  return { runtime, matrices, hash, state, project, projectId, text, scene, fragment, derive };
}

function withoutRequestIdentity(value) {
  const result = copy(value);
  delete result.sourceScope;
  delete result.summary.invalidationKey;
  return result;
}

test('matrices scope: legacy and explicit book retain the complete original matrix content', async () => {
  const f = await fixture(), before = JSON.stringify(f.state);
  const legacy = f.derive(), book = f.derive({ kind: 'BOOK' });
  assert.equal(legacy.ok, true);
  assert.equal(book.ok, true);
  assert.deepEqual(withoutRequestIdentity(book.value), withoutRequestIdentity(legacy.value));
  assert.equal(book.value.summary.sceneCount, 4);
  assert.equal(book.value.summary.entityCount, 4);
  assert.deepEqual(book.value.sourceScope, { kind: 'BOOK' });
  assert.equal(JSON.stringify(f.state), before);
});

test('matrices scope: selected scene recalculates observations, pairs, counts and evidence without other scenes', async () => {
  const f = await fixture(), before = JSON.stringify(f.state), result = f.derive(f.scene);
  assert.equal(result.ok, true);
  const value = result.value;
  assert.deepEqual(value.sourceScope, f.scene);
  assert.equal(value.summary.sceneCount, 1);
  assert.equal(value.summary.entityCount, 3);
  assert.equal(value.summary.relationListRowCount, 3);
  assert.deepEqual(value.entitySceneMatrix.columns.map(row => [row.sceneId, row.sceneOrdinal]), [['scene-a', 2]]);
  assert.deepEqual(value.entitySceneMatrix.rows.map(row => row.entityId).sort(), ['entity-anna', 'entity-mira', 'entity-sol']);
  for (const row of value.listParity.entitySceneRows) {
    assert.equal(row.sceneId, 'scene-a');
    assert.equal(row.appearanceCount, 1);
    assert.equal(row.evidenceAnchorIds.length, 1);
  }
  for (const row of value.listParity.relationRows) {
    assert.deepEqual(row.sceneIds, ['scene-a']);
    assert.equal(row.sceneCount, 1);
    assert.equal(row.occurrenceCount, 1);
    assert.equal(row.evidenceAnchorIds.length, 2);
  }
  assert.equal(value.authority.projectTruthMutation, false);
  assert.equal(value.authority.storageMutation, false);
  assert.equal(JSON.stringify(f.state), before);
});

test('matrices scope: a saved fragment includes only wholly contained observations and recomputes pair evidence', async () => {
  const f = await fixture(), result = f.derive(f.fragment);
  assert.equal(result.ok, true);
  const value = result.value;
  assert.deepEqual(value.sourceScope, f.fragment);
  assert.equal(value.summary.sceneCount, 1);
  assert.equal(value.summary.entityCount, 2);
  assert.deepEqual(value.listParity.entitySceneRows.map(row => row.entityId).sort(), ['entity-anna', 'entity-mira']);
  assert.equal(value.listParity.relationRows.length, 1);
  const pair = value.listParity.relationRows[0];
  assert.deepEqual([pair.leftEntityId, pair.rightEntityId].sort(), ['entity-anna', 'entity-mira']);
  assert.equal(pair.sceneCount, 1);
  assert.equal(pair.occurrenceCount, 1);
  assert.deepEqual(pair.sceneIds, ['scene-a']);
  const anchors = value.listParity.entitySceneRows.flatMap(row => row.evidenceAnchorIds).sort();
  assert.deepEqual([...pair.evidenceAnchorIds].sort(), anchors);
  const clipped = f.derive({ ...f.fragment, startOffset: f.fragment.startOffset + 1 });
  assert.equal(clipped.ok, true);
  assert.deepEqual(clipped.value.listParity.entitySceneRows.map(row => row.entityId), ['entity-mira']);
  assert.equal(clipped.value.listParity.relationRows.length, 0);
});

test('matrices scope: valid empty scene and empty fragment preserve their actual one-scene scope', async () => {
  const f = await fixture();
  for (const scope of [
    { kind: 'SCENE', sceneId: 'scene-c', sceneTextHash: f.hash(f.project.scenes['scene-c'].text) },
    { ...f.fragment, startOffset: f.text.indexOf('met'), endOffset: f.text.indexOf('met') + 3 },
  ]) {
    const r = f.derive(scope);
    assert.equal(r.ok, true);
    assert.equal(r.value.state, 'empty');
    assert.equal(r.value.summary.sceneCount, 1);
    assert.equal(r.value.summary.entityCount, 0);
    assert.equal(r.value.entitySceneMatrix.columnAxis.totalCount, 1);
    assert.deepEqual(r.value.sourceScope, scope);
    assert.equal(r.value.listParity.entitySceneRows.length, 0);
    assert.equal(r.value.listParity.relationRows.length, 0);
    assert.match(r.value.summary.matrixHash, /^[a-f0-9]{64}$/);
  }
});

test('matrices scope: equal observations in different saved ranges still have distinct scope-bound identities', async () => {
  const f = await fixture();
  const a = f.derive(f.fragment), b = f.derive({ ...f.fragment, startOffset: f.fragment.startOffset - 1 });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.deepEqual(a.value.entitySceneMatrix, b.value.entitySceneMatrix);
  assert.deepEqual(a.value.relationMatrix, b.value.relationMatrix);
  assert.notEqual(a.value.summary.matrixHash, b.value.summary.matrixHash);
  assert.notEqual(a.meta.invalidationKey, b.meta.invalidationKey);
});

for (const [name, build] of [
  ['null', () => null], ['array', () => []], ['string', () => 'SCENE'],
  ['unknown kind', () => ({ kind: 'OTHER' })], ['book extra authority', () => ({ kind: 'BOOK', commandId: 'cmd.write' })],
  ['scene missing hash', f => ({ kind: 'SCENE', sceneId: f.scene.sceneId })],
  ['scene numeric ID', f => ({ ...f.scene, sceneId: 7 })],
  ['scene unknown key', f => ({ ...f.scene, path: '../../private' })],
  ['scene malformed hash', f => ({ ...f.scene, sceneTextHash: 'z'.repeat(64) })],
  ['fragment string offset', f => ({ ...f.fragment, startOffset: String(f.fragment.startOffset) })],
  ['fragment fraction', f => ({ ...f.fragment, startOffset: 0.5 })],
  ['fragment negative', f => ({ ...f.fragment, startOffset: -1 })],
  ['fragment empty', f => ({ ...f.fragment, endOffset: f.fragment.startOffset })],
  ['fragment excess end', f => ({ ...f.fragment, endOffset: f.text.length + 1 })],
  ['fragment split surrogate', f => ({ ...f.fragment, startOffset: 1 })],
  ['foreign scene', f => ({ ...f.scene, sceneId: 'other-project-scene' })],
  ['inherited scene', f => ({ ...f.scene, sceneId: 'constructor' })],
  ['stale semantic text hash', f => ({ ...f.scene, sceneTextHash: '0'.repeat(64) })],
]) test('matrices scope refuses ' + name + ' without widening or mutating source', async () => {
  const f = await fixture(), before = JSON.stringify(f.state), result = f.derive(build(f));
  assert.equal(result.ok, false, name);
  assert.match(result.error.code, /^E_ATLAS_MATRICES_SCOPE_/);
  assert.equal(JSON.stringify(f.state), before);
});

test('matrices scope: every underlying capability still refuses book, scene and fragment', async () => {
  const f = await fixture();
  for (const sourceScope of [{ kind: 'BOOK' }, f.scene, f.fragment]) {
    for (const capability of ['atlasMatrices', 'atlasObservationAggregate', 'atlasTemporalContinuity']) {
      const r = f.matrices.deriveAtlasMatrices({ coreState: f.state, params: { projectId: f.projectId, sourceScope }, capabilitySnapshot: { capabilities: { [capability]: false } } });
      assert.equal(r.ok, false, sourceScope.kind + ':' + capability);
      assert.equal(r.error.code, 'E_CAPABILITY_DISABLED_FOR_COMMAND');
    }
  }
});

function actualFunction(text, name) {
  const tokens = ['async function ' + name + '(', 'function ' + name + '('];
  const start = tokens.map(token => text.indexOf(token)).find(index => index >= 0);
  assert.equal(typeof start, 'number', 'actual production function must exist: ' + name);
  const end = text.indexOf('\n}', start);
  assert.ok(end > start, 'actual function boundary: ' + name);
  return text.slice(start, end + 2);
}

async function mainHost(f) {
  const code = source('src/main.js'), calls = [];
  const context = vm.createContext({
    Object, Number, Array, console,
    loadAtlasMatricesModule: async () => f.matrices,
    buildAtlasOverviewCoreState: async () => { calls.push('readCore'); return { projectId: f.projectId, coreState: f.state }; },
    makeAtlasMatricesFallback: (projectId, unavailableReason) => ({ projectId, state: 'unavailable', unavailableReason }),
    logDevError: () => {},
  });
  vm.runInContext(['isPlainObjectValue', 'normalizeAtlasMatricesPayload', 'handleWorkspaceAtlasMatricesQuery'].map(name => actualFunction(code, name)).join('\n'), context);
  return { context, calls, query: payload => context.handleWorkspaceAtlasMatricesQuery(payload) };
}

test('matrices scope: actual Main normalizer and handler preserve the explicit descriptor and source-bounded result', async () => {
  const f = await fixture(), h = await mainHost(f);
  const normalized = h.context.normalizeAtlasMatricesPayload({ projectId: f.projectId, sourceScope: f.fragment });
  assert.deepEqual(copy(normalized.sourceScope), f.fragment);
  const r = await h.query({ projectId: f.projectId, sourceScope: f.fragment });
  assert.equal(r.ok, true);
  assert.deepEqual(copy(r.atlasMatrices.sourceScope), f.fragment);
  assert.equal(r.atlasMatrices.summary.entityCount, 2);
  assert.equal(r.atlasMatrices.summary.sceneCount, 1);
  assert.deepEqual(h.calls, ['readCore']);
});

test('matrices scope: actual Main rejects malformed descriptor before canonical scene read and refuses stale source', async () => {
  const f = await fixture(), h = await mainHost(f);
  const malformed = await h.query({ projectId: f.projectId, sourceScope: { kind: 'SCENE', sceneId: [] } });
  assert.equal(malformed.atlasMatrices.state, 'unavailable');
  assert.match(malformed.atlasMatrices.unavailableReason, /ATLAS_MATRICES_SCOPE_/);
  assert.deepEqual(h.calls, []);
  const stale = await h.query({ projectId: f.projectId, sourceScope: { ...f.scene, sceneTextHash: '0'.repeat(64) } });
  assert.equal(stale.atlasMatrices.state, 'unavailable');
  assert.match(stale.atlasMatrices.unavailableReason, /ATLAS_MATRICES_SCOPE_/);
  const foreign = await h.query({ projectId: 'foreign-project', sourceScope: f.scene });
  assert.equal(foreign.atlasMatrices.unavailableReason, 'ATLAS_PROJECT_MISMATCH');
});

class ElementHost {
  constructor(tag = 'div', doc = null) { this.tagName = tag.toUpperCase(); this.dataset = {}; this.attributes = {}; this.children = []; this.doc = doc; this.parentElement = null; this.className = ''; this.disabled = false; this.isConnected = true; }
  appendChild(child) { this.children.push(child); child.parentElement = this; return child; }
  append(...children) { children.forEach(child => this.appendChild(child)); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? (name.startsWith('data-') ? this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] : null); }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  matches(selector) { const m = /^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(selector); return Boolean(m) && this.getAttribute(m[1]) != null && (m[2] === undefined || this.getAttribute(m[1]) === m[2]); }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  focus() { if (this.doc) this.doc.activeElement = this; }
  addEventListener() {}
  set innerHTML(value) { assert.equal(value, ''); if (this.contains(this.doc?.activeElement)) this.doc.activeElement = null; this.children.forEach(child => { child.parentElement = null; child.isConnected = false; }); this.children = []; }
}

async function rendererHost(f) {
  const code = source('src/renderer/editor.js'), calls = [];
  const doc = { activeElement: null, createElement: tag => new ElementHost(tag, doc) };
  const ctx = {
    console, document: doc, Element: ElementHost, HTMLElement: ElementHost,
    currentProjectId: f.projectId, currentDocumentId: 'scene-a', currentDocumentTitle: 'First', currentRightTab: 'atlas', currentAtlasSurface: 'matrices',
    currentTreeContentPublicationId: 1, localEditGeneration: 0, lastAckedGeneration: 0, localDirty: false,
    atlasPublicationEpoch: 0, manualMapDraftOwnership: null, atlasJourneyDraftRevision: 0, manualMapDraftRevision: 0, atlasCommandPublicationSequence: 0,
    atlasQueryPublicationSequences: new Map(), atlasMatricesSourceScope: { kind: 'BOOK' }, atlasMatricesScopeProjectId: f.projectId,
    atlasMatricesState: { state: 'empty', projectId: f.projectId }, atlasMatricesKeyboardBound: false,
    atlasCurrentSceneState: { state: 'unavailable', projectId: f.projectId, sceneId: 'scene-a' },
    atlasMatricesHost: new ElementHost('section', doc), atlasHeatmapExplicitOpen: false, atlasTemporalLayoutExplicitOpen: false, atlasContinuityLedgerExplicitOpen: false,
    ATLAS_MATRICES_QUERY_ID: 'query.atlasMatrices', ATLAS_CURRENT_SCENE_QUERY_ID: 'query.atlasCurrentScene',
    selection: { start: f.fragment.startOffset, end: f.fragment.endOffset },
    getSelectionOffsets: () => ({ ...ctx.selection }), getPlainText: () => f.text,
    composeDocumentContent: () => f.text, parseDocumentContent: value => ({ text: value, issue: null }), hashCanonicalValue: f.hash,
    reviewSurfaceIsPlainObject: value => Boolean(value) && typeof value === 'object' && !Array.isArray(value),
    normalizeAtlasCurrentSceneDossier: copy, renderAtlasCurrentSceneState: () => {},
    updateStatusText: text => { ctx.status = text; }, applyAtlasResolvedSurfaceBinding: () => {},
    appendAtlasOverviewMetric: () => {}, appendAtlasOverviewSection: host => host, appendAtlasMatrixTable: () => {}, appendAtlasMatrixListRows: () => {},
    openAtlasHeatmapSurface: () => {}, openAtlasTemporalLayoutSurface: () => {}, openAtlasContinuityLedgerSurface: () => {},
    selectAtlasRelation: () => {}, activateAtlasMatrixCell: () => {}, handleAtlasMatrixGridKeydown: () => {},
    dispatchUiCommand: () => assert.fail('read-only scope must not dispatch a mutation'),
  };
  const currentScene = await load('src/derived/atlas/deriveAtlasCurrentSceneDossier.mjs');
  ctx.invokeWorkspaceQueryBridge = async (id, payload) => {
    calls.push({ id, payload: copy(payload) });
    if (id === ctx.ATLAS_CURRENT_SCENE_QUERY_ID) {
      const r = currentScene.deriveAtlasCurrentSceneDossier({ coreState: f.state, params: { projectId: f.projectId, sceneId: payload.nodeId } });
      assert.equal(r.ok, true);
      return { ok: true, atlasCurrentScene: r.value };
    }
    assert.equal(id, ctx.ATLAS_MATRICES_QUERY_ID);
    const r = f.matrices.deriveAtlasMatrices({ coreState: f.state, params: payload });
    assert.equal(r.ok, true);
    return { ok: true, atlasMatrices: r.value };
  };
  const context = vm.createContext(ctx);
  const names = ['captureAtlasPublication', 'beginAtlasQueryPublication', 'readAtlasQueryProjection',
    'isIdeaMeaningSceneSourceCurrent', 'getIdeaMeaningSceneOrigin', 'normalizeAtlasMatrixAxis', 'normalizeAtlasMatrixTable', 'normalizeAtlasMatrices',
    'setAtlasMatricesScopeUnavailable', 'selectAtlasMatricesSourceScope', 'appendAtlasMatricesSourceScopeControls',
    'handleAtlasMatrixGridClick', 'bindAtlasMatricesKeyboardNavigation', 'renderAtlasMatricesState', 'refreshAtlasMatrices', 'refreshAtlasCurrentScene'];
  vm.runInContext(names.map(name => actualFunction(code, name)).join('\n'), context);
  return { ctx: context, calls, doc };
}

test('matrices scope: actual renderer captures saved scene and selected UTF16 fragment through existing queries', async () => {
  const f = await fixture(), h = await rendererHost(f), before = JSON.stringify(f.state);
  await h.ctx.selectAtlasMatricesSourceScope('SCENE');
  assert.deepEqual(copy(h.ctx.atlasMatricesState.sourceScope), f.scene);
  assert.equal(h.ctx.atlasMatricesState.summary.entityCount, 3);
  await h.ctx.selectAtlasMatricesSourceScope('FRAGMENT');
  assert.deepEqual(h.calls.filter(row => row.id === 'query.atlasMatrices').at(-1).payload.sourceScope, f.fragment);
  assert.equal(h.ctx.atlasMatricesState.summary.entityCount, 2);
  assert.equal(h.ctx.atlasMatricesState.summary.sceneCount, 1);
  assert.equal(JSON.stringify(f.state), before);
});

test('matrices scope: unsaved or invalid selection cannot issue a narrower query or change author state', async () => {
  const f = await fixture();
  for (const mode of ['dirty', 'unacked', 'empty', 'split']) {
    const h = await rendererHost(f), before = JSON.stringify(f.state);
    if (mode === 'dirty') h.ctx.localDirty = true;
    if (mode === 'unacked') h.ctx.localEditGeneration = 1;
    if (mode === 'empty') h.ctx.selection = { start: 3, end: 3 };
    if (mode === 'split') h.ctx.selection = { start: 1, end: 8 };
    await h.ctx.selectAtlasMatricesSourceScope('FRAGMENT');
    assert.equal(h.calls.filter(row => row.id === 'query.atlasMatrices').length, 0, mode);
    assert.equal(h.ctx.atlasMatricesState.state, 'unavailable', mode);
    assert.equal(JSON.stringify(f.state), before);
  }
});

test('matrices scope: changed project, scene, authoring generation or newer book intent discards a late scope request', async () => {
  const f = await fixture();
  for (const mode of ['project', 'scene', 'generation', 'book']) {
    const h = await rendererHost(f), original = h.ctx.invokeWorkspaceQueryBridge;
    let release;
    h.ctx.invokeWorkspaceQueryBridge = (id, payload) => id === 'query.atlasCurrentScene'
      ? new Promise(resolve => { release = async () => resolve(await original(id, payload)); }) : original(id, payload);
    const pending = h.ctx.selectAtlasMatricesSourceScope('SCENE');
    assert.equal(typeof release, 'function');
    if (mode === 'project') h.ctx.currentProjectId = 'other-project';
    if (mode === 'scene') h.ctx.currentDocumentId = 'scene-b';
    if (mode === 'generation') { h.ctx.localEditGeneration += 1; h.ctx.localDirty = true; }
    if (mode === 'book') await h.ctx.selectAtlasMatricesSourceScope('BOOK');
    await release(); await pending;
    const matrices = h.calls.filter(row => row.id === 'query.atlasMatrices');
    assert.equal(matrices.length, mode === 'book' ? 1 : 0, mode);
    if (mode === 'book') assert.deepEqual(copy(h.ctx.atlasMatricesState.sourceScope), { kind: 'BOOK' });
  }
});

test('matrices scope: changed saved source, foreign echo and old scene never publish a whole-book result as narrow scope', async () => {
  const f = await fixture();
  for (const mode of ['source', 'echo', 'scene']) {
    const h = await rendererHost(f), original = h.ctx.invokeWorkspaceQueryBridge;
    h.ctx.invokeWorkspaceQueryBridge = async (id, payload) => {
      const r = await original(id, payload);
      if (mode === 'source' && id === 'query.atlasCurrentScene') r.atlasCurrentScene.summary.sceneTextHash = '0'.repeat(64);
      if (mode === 'echo' && id === 'query.atlasMatrices') r.atlasMatrices.sourceScope = { kind: 'BOOK' };
      return r;
    };
    await h.ctx.selectAtlasMatricesSourceScope('FRAGMENT');
    if (mode === 'scene') { h.ctx.currentDocumentId = 'scene-b'; await h.ctx.refreshAtlasMatrices(); }
    assert.equal(h.ctx.atlasMatricesState.state, 'unavailable', mode);
  }
});

test('matrices scope: named native controls remain usable in loading, empty and unavailable states and retain their own focus only', async () => {
  const f = await fixture(), h = await rendererHost(f);
  for (const state of ['loading', 'empty', 'unavailable']) {
    h.ctx.atlasMatricesState = { state, projectId: f.projectId, unavailableReason: 'SCOPE_UNAVAILABLE' };
    h.ctx.renderAtlasMatricesState();
    const controls = h.ctx.atlasMatricesHost.querySelectorAll('[data-atlas-matrices-source-scope]');
    assert.deepEqual(controls.map(button => button.dataset.atlasMatricesSourceScope), ['BOOK', 'SCENE', 'FRAGMENT']);
    for (const button of controls) { assert.equal(button.tagName, 'BUTTON'); assert.ok(button.textContent); assert.ok(['true', 'false'].includes(button.getAttribute('aria-pressed'))); }
    assert.equal(controls[0].disabled, false);
  }
  const selected = h.ctx.atlasMatricesHost.querySelector('[data-atlas-matrices-source-scope="SCENE"]');
  selected.focus(); h.ctx.renderAtlasMatricesState();
  assert.equal(h.doc.activeElement.dataset.atlasMatricesSourceScope, 'SCENE');
  const elsewhere = new ElementHost('input', h.doc); elsewhere.focus(); h.ctx.renderAtlasMatricesState();
  assert.equal(h.doc.activeElement, elsewhere);
});

test('matrices scope: dirty risk raised without a new generation during the matrix read refuses publication', async () => {
  const f = await fixture(), h = await rendererHost(f), original = h.ctx.invokeWorkspaceQueryBridge;
  let release, reached;
  const reading = new Promise(resolve => { reached = resolve; });
  h.ctx.invokeWorkspaceQueryBridge = (id, payload) => id === 'query.atlasMatrices'
    ? new Promise(resolve => { release = async () => resolve(await original(id, payload)); reached(); }) : original(id, payload);
  const pending = h.ctx.selectAtlasMatricesSourceScope('SCENE');
  await reading;
  h.ctx.localDirty = true;
  await release(); await pending;
  assert.equal(h.ctx.atlasMatricesState.state, 'unavailable');
  assert.equal(h.ctx.atlasMatricesState.unavailableReason, 'ATLAS_SOURCE_UNSAVED');
  assert.equal(h.ctx.atlasMatricesState.summary.entityCount, 0);
});

test('matrices scope: rejected book, scene or fragment reads remain recoverable and late failure cannot overwrite a newer intent', async () => {
  const f = await fixture();
  for (const kind of ['BOOK', 'SCENE', 'FRAGMENT']) {
    const h = await rendererHost(f), original = h.ctx.invokeWorkspaceQueryBridge;
    h.ctx.invokeWorkspaceQueryBridge = (id, payload) => id === 'query.atlasMatrices'
      ? Promise.reject(new Error('FINITE_QUERY_READ_REJECTION')) : original(id, payload);
    await assert.doesNotReject(() => h.ctx.selectAtlasMatricesSourceScope(kind), kind);
    assert.equal(h.ctx.atlasMatricesState.state, 'unavailable', kind);
    assert.equal(h.ctx.atlasMatricesState.projectId, f.projectId);
  }
  const h = await rendererHost(f), original = h.ctx.invokeWorkspaceQueryBridge;
  let rejectOld, reached;
  const reading = new Promise(resolve => { reached = resolve; });
  h.ctx.invokeWorkspaceQueryBridge = (id, payload) => id === 'query.atlasMatrices' && payload.sourceScope.kind === 'SCENE'
    ? new Promise((resolve, reject) => { rejectOld = reject; reached(); }) : original(id, payload);
  const pending = h.ctx.selectAtlasMatricesSourceScope('SCENE');
  await reading; await h.ctx.selectAtlasMatricesSourceScope('BOOK');
  rejectOld(new Error('LATE_OLD_QUERY_REJECTION'));
  await assert.doesNotReject(() => pending);
  assert.equal(h.ctx.atlasMatricesState.state, 'ready');
  assert.deepEqual(copy(h.ctx.atlasMatricesState.sourceScope), { kind: 'BOOK' });
});
