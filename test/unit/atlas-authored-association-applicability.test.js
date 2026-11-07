'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');

const projectId = 'applicability-project';
const text = 'Свет. Свет. e\u0301 🧭';
const hash = value => createHash('sha256').update(value).digest('hex');
const textHash = value => hash(JSON.stringify(value));
const revision = value => 'sha256:' + hash(value);
const copy = value => JSON.parse(JSON.stringify(value));
const book = { kind: 'BOOK' };
const scene = (sceneId = 'scene-a') => ({ kind: 'SCENE', sceneId, sceneTextHash: textHash(text) });
const fragment = (startOffset = 0, endOffset = 4, sceneId = 'scene-a') => ({
  ...scene(sceneId), kind: 'FRAGMENT', startOffset, endOffset,
});

async function fixture() {
  const core = await import('../../src/core/runtime.mjs');
  const matrices = await import('../../src/derived/atlas/deriveAtlasMatrices.mjs');
  const built = core.applyCoreSequence(core.createInitialCoreState(), [
    { type: 'project.create', payload: { projectId, sceneId: 'scene-a', title: 'Авторские связи' } },
    { type: 'project.applyTextEdit', payload: { projectId, sceneId: 'scene-a', text } },
    ...[['mira', 'Мира'], ['boris', 'Борис'], ['missing', 'Участник']].map(([entityId, name]) => ({
      type: 'atlas.entity.create', payload: { projectId, entityId, name },
    })),
  ]);
  assert.equal(built.ok, true, JSON.stringify(built.error));
  let state = built.state;
  const project = () => state.data.projects[projectId];
  Object.assign(project(), {
    manifestRevision: revision('manifest'), projectRevisionId: revision('project'),
    revisionScope: 'WHOLE_PROJECT', sceneOrder: ['scene-a', 'scene-b', 'scene-edited'],
  });
  for (const sceneId of project().sceneOrder) {
    project().scenes[sceneId] = { id: sceneId, title: sceneId, text, sceneRevision: revision(sceneId) };
  }
  function record(id, scopeKind, sceneId = 'scene-a', startOffset = 0, endOffset = 4, targetEntityId = 'boris') {
    const saved = project().scenes[sceneId];
    const result = core.reduceCoreState(state, {
      type: 'atlas.association.record',
      payload: {
        operation: 'record', projectId, associationId: id, expectedAssociationHash: '',
        expectedManifestRevision: project().manifestRevision, expectedSceneRevision: saved.sceneRevision,
        associationKind: id, direction: 'DIRECTED', sourceEntityId: 'mira', targetEntityId, scopeKind,
        source: { sceneId, startOffset, endOffset, sceneTextHash: textHash(saved.text) },
      },
    });
    assert.equal(result.ok, true, JSON.stringify(result.error));
    state = result.state;
  }
  record('book', 'BOOK');
  record('scene-a', 'SCENE');
  record('scene-b', 'SCENE', 'scene-b');
  record('fragment-a', 'FRAGMENT');
  record('fragment-covering', 'FRAGMENT', 'scene-a', 0, 5);
  record('fragment-repeat', 'FRAGMENT', 'scene-a', 6, 10);
  record('fragment-b', 'FRAGMENT', 'scene-b');
  record('stale-book', 'BOOK', 'scene-edited');
  record('missing-entity', 'BOOK', 'scene-a', 0, 4, 'missing');
  record('withdrawn', 'BOOK');
  const hashModule = await import('../../src/core/browser-safe-hash.mjs');
  const withdrawn = core.reduceCoreState(state, { type: 'atlas.association.record', payload: {
    operation: 'retract', projectId, associationId: 'withdrawn', expectedManifestRevision: project().manifestRevision,
    expectedAssociationHash: hashModule.hashCanonicalValue(project().atlas.authoredAssociations.withdrawn),
  } });
  assert.equal(withdrawn.ok, true, JSON.stringify(withdrawn.error));
  state = withdrawn.state;
  // A current canonical read can contain a preserved record whose saved evidence changed.
  project().scenes['scene-edited'].text = 'Старая цитата исчезла.';
  project().scenes['scene-edited'].sceneRevision = revision('scene-edited-after');
  delete project().atlas.entities.missing;
  const derive = (sourceScope, extra = {}) => matrices.deriveAtlasMatrices({
    coreState: state, params: { projectId, sourceScope, ...extra },
  });
  return { state, project: project(), matrices, derive };
}

function readApplicability(result) {
  assert.equal(result.ok, true, JSON.stringify(result.error));
  assert.ok(result.value.authoredAssociationApplicability, 'actual Matrix result must contain author applicability');
  return result.value.authoredAssociationApplicability;
}
const ids = value => value.rows.map(row => row.associationId);

test('Matrix returns independently expected current authored applicability for each saved focus', async () => {
  const f = await fixture();
  const before = JSON.stringify(f.state);
  for (const [scope, expected] of [
    [book, ['book']],
    [scene(), ['book', 'scene-a']],
    [scene('scene-b'), ['book', 'scene-b']],
    [fragment(), ['book', 'fragment-a', 'fragment-covering', 'scene-a']],
    [fragment(1, 4), ['book', 'fragment-a', 'fragment-covering', 'scene-a']],
    [fragment(6, 10), ['book', 'fragment-repeat', 'scene-a']],
    [fragment(0, 6), ['book', 'scene-a']],
    [fragment(0, 4, 'scene-b'), ['book', 'fragment-b', 'scene-b']],
  ]) {
    const result = f.derive(scope, { includeAuthoredAssociations: true });
    const value = readApplicability(result);
    assert.deepEqual(ids(value), expected, JSON.stringify(scope));
    assert.deepEqual(value.sourceScope, scope);
    assert.equal(value.projectId, projectId);
    assert.equal(value.manifestRevision, f.project.manifestRevision);
    assert.equal(value.total, expected.length);
    assert.equal(value.complete, true);
    assert.equal(value.authority.productMutation, false);
    assert.equal(Object.isFrozen(value.rows), true);
    for (const row of value.rows) {
      const record = f.project.atlas.authoredAssociations[row.associationId];
      assert.deepEqual(row.latest, record.revisions.at(-1));
      assert.equal(row.sceneRevision, f.project.scenes[row.latest.source.sceneId].sceneRevision);
      assert.equal(row.latest.source.quote, f.project.scenes[row.latest.source.sceneId].text.slice(row.latest.source.startOffset, row.latest.source.endOffset));
    }
    const { authoredAssociationApplicability, ...observations } = result.value;
    assert.deepEqual(observations, f.derive(scope).value, 'opting in preserves the whole observation projection');
  }
  assert.equal(JSON.stringify(f.state), before);
});

test('Matrix exposes exact clipping and refuses a split grapheme or stale/foreign focus', async () => {
  const f = await fixture();
  const clipped = readApplicability(f.derive(fragment(), { includeAuthoredAssociations: true, listLimit: 2 }));
  assert.deepEqual(ids(clipped), ['book', 'fragment-a']);
  assert.equal(clipped.total, 4);
  assert.equal(clipped.omittedCount, 2);
  assert.equal(clipped.complete, false);
  const split = readApplicability(f.derive(fragment(text.indexOf('e') + 1, text.indexOf('e') + 2), { includeAuthoredAssociations: true }));
  assert.equal(split.state, 'unavailable');
  assert.equal(split.reason, 'ATLAS_AUTHORED_ASSOCIATION_SCOPE_RANGE_INVALID');
  assert.deepEqual(split.rows, []);
  for (const scope of [{ ...scene(), sceneTextHash: '0'.repeat(64) }, scene('foreign')]) {
    const result = f.derive(scope, { includeAuthoredAssociations: true });
    assert.equal(result.ok, false);
    assert.equal(result.value, undefined);
  }
  const legacy = f.derive(fragment());
  assert.equal(legacy.ok, true);
  assert.equal(Object.hasOwn(legacy.value, 'authoredAssociationApplicability'), false);
});

test('Matrix distinguishes an empty applicable set from unavailable canonical author data', async () => {
  const f = await fixture();
  delete f.project.atlas.authoredAssociations;
  const empty = readApplicability(f.derive(scene(), { includeAuthoredAssociations: true }));
  assert.equal(empty.state, 'empty');
  assert.equal(empty.total, 0);
  assert.equal(empty.complete, true);
  f.project.atlas.authoredAssociations = { retained: { schemaVersion: 'future.v2' } };
  const before = JSON.stringify(f.state);
  const unavailable = readApplicability(f.derive(scene(), { includeAuthoredAssociations: true }));
  assert.equal(unavailable.state, 'unavailable');
  assert.equal(unavailable.complete, false);
  assert.deepEqual(unavailable.rows, []);
  assert.equal(JSON.stringify(f.state), before);
});

const root = path.resolve(__dirname, '../..');
function readFunction(source, name) {
  const start = source.indexOf('function ' + name + '(');
  const end = source.indexOf('\n}', start);
  assert.ok(start >= 0 && end > start, name);
  return source.slice(source.slice(start - 6, start) === 'async ' ? start - 6 : start, end + 2);
}

test('actual Matrix Main accepts the explicit current profile request and refuses other profiles or malformed opt-in', async () => {
  const f = await fixture();
  const source = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
  let profileId = 'WRITER_LOCAL_ATLAS_ASSOCIATIONS_V13';
  let readCount = 0;
  const host = vm.createContext({
    Object, Number, Array, console,
    getWriterLocalRuntimeProfile: () => ({ profileId }),
    loadAtlasMatricesModule: async () => f.matrices,
    buildAtlasOverviewCoreState: async () => { readCount++; return { projectId, coreState: f.state }; },
    makeAtlasMatricesFallback: (projectId, unavailableReason) => ({ projectId, state: 'unavailable', unavailableReason }),
    logDevError: () => {},
  });
  vm.runInContext(['isPlainObjectValue', 'normalizeAtlasMatricesPayload', 'handleWorkspaceAtlasMatricesQuery'].map(name => readFunction(source, name)).join('\n'), host);
  const payload = { projectId, sourceScope: fragment(), includeAuthoredAssociations: true };
  const query = input => host.handleWorkspaceAtlasMatricesQuery(input);
  const result = await query(payload);
  assert.deepEqual(ids(readApplicability({ ok: result.ok, value: result.atlasMatrices })), ['book', 'fragment-a', 'fragment-covering', 'scene-a']);
  assert.equal(readCount, 1);
  profileId = 'WRITER_LOCAL_SCENE_LANGUAGE_TAG_V12';
  const denied = await query(payload);
  assert.equal(denied.atlasMatrices.unavailableReason, 'ATLAS_AUTHORED_ASSOCIATION_PROFILE_UNAVAILABLE');
  assert.equal(readCount, 1);
  profileId = 'WRITER_LOCAL_ATLAS_ASSOCIATIONS_V13';
  const malformed = await query({ ...payload, includeAuthoredAssociations: 'true' });
  assert.equal(malformed.atlasMatrices.unavailableReason, 'ATLAS_AUTHORED_ASSOCIATION_REQUEST_INVALID');
  assert.equal(readCount, 1);
  const prior = await query({ projectId, sourceScope: fragment() });
  assert.equal(prior.ok, true);
  assert.equal(Object.hasOwn(prior.atlasMatrices, 'authoredAssociationApplicability'), false);
});

class MatrixElement {
  constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.isConnected = true; }
  append(...nodes) { this.children.push(...nodes); }
  appendChild(node) { this.append(node); }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(key, handler) { this[key] = handler; }
  contains() { return false; }
  set innerHTML(_) { this.children = []; }
}

async function matrixRendererFixture() {
  const f = await fixture();
  const source = fs.readFileSync(path.join(root, 'src/renderer/editor.js'), 'utf8');
  const hostNode = new MatrixElement('host');
  const requests = [], opens = [];
  const treeNode = { id: 'scene-a', kind: 'scene' };
  const host = vm.createContext({
    Object, Number, Array, console, HTMLElement: MatrixElement,
    document: { createElement: tag => new MatrixElement(tag) },
    window: { __PRODUCT_PROFILE: 'WRITER_LOCAL_ATLAS_ASSOCIATIONS_V13' },
    EXTRA_COMMAND_IDS: { PROJECT_DOCUMENT_OPEN: 'project.document.open' },
    currentProjectId: projectId, currentDocumentId: 'scene-a', currentRightTab: 'atlas', currentAtlasSurface: 'matrices',
    localDirty: false, localEditGeneration: 2, lastAckedGeneration: 2,
    atlasMatricesSourceScope: fragment(), atlasMatricesScopeProjectId: projectId,
    atlasMatricesState: { state: 'empty', projectId }, atlasMatricesHost: hostNode,
    atlasHeatmapExplicitOpen: false, atlasTemporalLayoutExplicitOpen: false, atlasContinuityLedgerExplicitOpen: false,
    ATLAS_MATRICES_QUERY_ID: 'query.atlasMatrices',
    reviewSurfaceIsPlainObject: value => Boolean(value) && typeof value === 'object' && !Array.isArray(value),
    beginAtlasQueryPublication: () => () => true, captureAtlasPublication: () => () => true,
    invokeWorkspaceQueryBridge: async (queryId, payload) => {
      requests.push(copy(payload));
      const result = f.derive(payload.sourceScope, {
        ...(payload.includeAuthoredAssociations === true ? { includeAuthoredAssociations: true } : {}),
      });
      return { ok: result.ok, atlasMatrices: result.value };
    },
    appendAtlasMatrixTable: () => {}, appendAtlasMatrixListRows: () => {}, appendAtlasOverviewMetric: () => {},
    applyAtlasResolvedSurfaceBinding: () => {}, bindAtlasMatricesKeyboardNavigation: () => {},
    isNavigatorContextCommandAvailable: () => true, updateStatusText: () => {},
    treeRoot: { children: [treeNode] },
    findTreeNodeById: (_, sceneId) => sceneId === treeNode.id ? treeNode : null,
    getEffectiveDocumentId: node => node?.id, getEffectiveDocumentKind: node => node?.kind,
    openDocumentNode: async (node, options) => { opens.push({ id: node.id, options: copy(options) }); return true; },
  });
  const names = ['normalizeAtlasMatrixAxis', 'normalizeAtlasMatrixTable', 'normalizeAtlasMatrices',
    'readAtlasQueryProjection', 'appendAtlasOverviewSection', 'appendAtlasReportsRow', 'setAtlasMatricesScopeUnavailable',
    'appendAtlasMatricesSourceScopeControls', 'renderAtlasMatricesState', 'refreshAtlasMatrices'];
  // The unchanged renderer can run the same real render path before the new
  // author list and common navigation helpers exist.
  for (const name of ['appendAtlasMatrixAuthoredAssociations', 'navigateAtlasAssociationSource', 'invalidateAtlasMatrixAuthoredSource']) {
    if (source.includes('function ' + name + '(')) names.push(name);
  }
  vm.runInContext(names.map(name => readFunction(source, name)).join('\n'), host);
  const flatten = node => [node, ...node.children.flatMap(flatten)];
  return { f, host, requests, opens, nodes: () => flatten(hostNode) };
}

test('actual Matrix renderer opts in and exposes exact guarded source navigation on an ordinary labelled button', async () => {
  const ui = await matrixRendererFixture();
  await ui.host.refreshAtlasMatrices();
  assert.equal(ui.requests[0].includeAuthoredAssociations, true);
  const row = ui.host.atlasMatricesState.authoredAssociationApplicability.rows.find(row => row.associationId === 'fragment-a');
  assert.ok(row);
  const button = ui.nodes().find(node => node.dataset.atlasMatrixAuthoredSource === 'fragment-a');
  assert.ok(button && button.tag === 'button');
  assert.match(button.attributes['aria-label'], /Мира.*Борис/u);
  await button.click();
  assert.equal(ui.opens.length, 1);
  assert.deepEqual(ui.opens[0], { id: 'scene-a', options: { expectedAtlasAssociationSource: {
    schemaVersion: 'atlas.authoredAssociationNavigation.v1', projectId, associationId: 'fragment-a',
    recordHash: row.recordHash, manifestRevision: ui.f.project.manifestRevision, sceneRevision: row.sceneRevision, sceneId: 'scene-a',
  } } });
  button.isConnected = false;
  await button.click();
  assert.equal(ui.opens.length, 1);
  ui.host.window.__PRODUCT_PROFILE = 'WRITER_LOCAL_SCENE_LANGUAGE_TAG_V12';
  await ui.host.refreshAtlasMatrices();
  assert.equal(Object.hasOwn(ui.requests[1], 'includeAuthoredAssociations'), false);
  assert.equal(ui.nodes().some(node => node.dataset.atlasMatrixAuthoredSource), false);
});

test('actual Matrix invalidation hides a saved fragment projection without a query or document open', async () => {
  const ui = await matrixRendererFixture();
  await ui.host.refreshAtlasMatrices();
  const button = ui.nodes().find(node => node.dataset.atlasMatrixAuthoredSource === 'fragment-a');
  assert.ok(button, 'current applicable row is visible before the edit');
  ui.host.localDirty = true;
  ui.host.invalidateAtlasMatrixAuthoredSource();
  assert.equal(ui.host.atlasMatricesState.unavailableReason, 'ATLAS_SOURCE_UNSAVED');
  await button.click();
  assert.equal(ui.opens.length, 0);
  assert.equal(ui.requests.length, 1);
  assert.equal(ui.nodes().some(node => node.dataset.atlasMatrixAuthoredSource), false);
});

test('Matrix refuses a retained narrower row after the document changes and keeps book navigation', async () => {
  const ui = await matrixRendererFixture();
  await ui.host.refreshAtlasMatrices();
  const fragmentSource = ui.nodes().find(node => node.dataset.atlasMatrixAuthoredSource === 'fragment-a');
  assert.ok(fragmentSource);
  ui.host.currentDocumentId = 'scene-b';
  await fragmentSource.click();
  assert.equal(ui.opens.length, 0);
  ui.host.atlasMatricesSourceScope = book;
  await ui.host.refreshAtlasMatrices();
  const bookSource = ui.nodes().find(node => node.dataset.atlasMatrixAuthoredSource === 'book');
  assert.ok(bookSource);
  await bookSource.click();
  assert.equal(ui.opens.length, 1);
  assert.equal(ui.opens[0].id, 'scene-a');
});
