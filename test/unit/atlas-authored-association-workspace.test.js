'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

const projectId = 'atlas-workspace-project';
const digest = value => createHash('sha256').update(value).digest('hex');
const revision = value => 'sha256:' + digest(value);
const savedText = 'Свет. Свет.';
const sceneTextHash = digest(JSON.stringify(savedText));
const scope = (kind, startOffset, endOffset) => ({
  kind,
  ...(kind === 'BOOK' ? {} : { sceneId: 'scene-a', sceneTextHash }),
  ...(kind === 'FRAGMENT' ? { startOffset, endOffset } : {}),
});
const authorRow = (associationId, scopeKind, startOffset = 0, endOffset = 4) => ({
  associationId, recordHash: digest(associationId), sourceState: 'current', entityState: 'current',
  sourceName: 'Мира', targetName: 'Борис', sceneTitle: 'Сцена A', sceneRevision: revision('scene-a'),
  latest: {
    status: 'active', associationKind: associationId, direction: 'DIRECTED', scopeKind,
    sourceEntityId: 'mira', targetEntityId: 'boris',
    source: { sceneId: 'scene-a', startOffset, endOffset, sceneTextHash, quote: savedText.slice(startOffset, endOffset) },
  },
});
const author = {
  book: authorRow('book', 'BOOK'),
  scene: authorRow('scene-a', 'SCENE'),
  first: authorRow('fragment-first', 'FRAGMENT'),
  repeat: authorRow('fragment-repeat', 'FRAGMENT', 6, 10),
};
const projection = (sourceScope, rows, omittedCount = 0) => ({
  schemaVersion: 'derived.atlas.authoredAssociationApplicability.v1',
  state: rows.length ? 'ready' : 'empty', projectId, sourceScope, rows,
  manifestRevision: revision('manifest'), projectRevisionId: revision('project'),
  total: rows.length + omittedCount, omittedCount, complete: omittedCount === 0,
});
const overview = {
  state: 'ready', projectId, summary: { sceneCount: 1, entityCount: 2, cooccurrencePairCount: 1 },
  topEntities: [
    { entityId: 'mira', name: 'Мира', appearanceCount: 3, sceneCount: 1 },
    { entityId: 'boris', name: 'Борис', appearanceCount: 2, sceneCount: 1 },
  ],
  topRelations: [{ pairId: 'observed-pair', leftEntityId: 'boris', leftName: 'Борис', rightEntityId: 'mira', rightName: 'Мира', occurrenceCount: 2, sceneCount: 1 }],
  sceneCoverage: [{ sceneId: 'scene-a', title: 'Сцена A', entityCount: 2, observationCount: 5 }],
};

test('workspace shows exact saved author rows with independent IDs in Graph, List and Table, preserving observations', async () => {
  const { buildAtlasSurfacePresentation, assertAtlasSurfacePresentationParity } = await import('../../src/renderer/atlasSurfacePresentationModel.mjs');
  const original = buildAtlasSurfacePresentation({ overview });
  const cases = [
    [scope('BOOK'), [author.book], ['authored-association:book']],
    [scope('SCENE'), [author.book, author.scene], ['authored-association:book', 'authored-association:scene-a']],
    [scope('FRAGMENT', 0, 4), [author.book, author.first, author.scene], ['authored-association:book', 'authored-association:fragment-first', 'authored-association:scene-a']],
    [scope('FRAGMENT', 6, 10), [author.book, author.repeat, author.scene], ['authored-association:book', 'authored-association:fragment-repeat', 'authored-association:scene-a']],
  ];
  for (const [sourceScope, rows, expected] of cases) {
    const packet = projection(sourceScope, rows);
    const before = JSON.stringify(packet);
    for (const view of ['GRAPH', 'LIST', 'TABLE']) {
      const result = assertAtlasSurfacePresentationParity(buildAtlasSurfacePresentation({ overview, authoredAssociations: packet, view }));
      const authored = result.rows.filter(row => row.kind === 'AUTHORED_ASSOCIATION');
      assert.deepEqual(authored.map(row => row.rowId), expected, view + ':' + JSON.stringify(sourceScope));
      assert.ok(authored.every(row => row.title.includes('Мира → Борис')));
      assert.deepEqual(result.rows.filter(row => row.kind !== 'AUTHORED_ASSOCIATION'), original.rows);
      assert.equal(result.summary.relationCount, 1);
      assert.deepEqual(result.graphNodes.map(row => row.rowId), result.rowIds);
    }
    assert.equal(JSON.stringify(packet), before);
  }
});

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Element {
  constructor(tag, document) {
    Object.assign(this, { tag, document, dataset: {}, attributes: {}, children: [], classList: { add() {} } });
  }
  append(...nodes) { for (const node of nodes) { this.children.push(node); node.parent = this; } }
  appendChild(node) { this.append(node); }
  setAttribute(key, value) { this.attributes[key] = value; }
  getAttribute(key) {
    const property = key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    return key.startsWith('data-') ? this.dataset[property] : this.attributes[key];
  }
  querySelectorAll(selector) {
    const attribute = /^\[([a-z-]+)\]$/.exec(selector)?.[1];
    return this.children.flatMap(node => [
      ...(attribute && node.getAttribute(attribute) !== undefined ? [node] : []),
      ...node.querySelectorAll(selector),
    ]);
  }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  focus() { this.document.activeElement = this; }
  addEventListener(name, listener) { this[name] = listener; }
  set innerHTML(_) {
    if (this.contains(this.document.activeElement)) this.document.activeElement = null;
    for (const child of this.children) child.parent = null;
    this.children = [];
  }
  get isConnected() { return this.tag === 'root' || Boolean(this.parent?.isConnected); }
}

function sourceFunction(source, name) {
  const start = source.indexOf('function ' + name + '(');
  const end = source.indexOf('\n}', start);
  assert.ok(start >= 0 && end > start, 'actual renderer function: ' + name);
  return source.slice(source.slice(start - 6, start) === 'async ' ? start - 6 : start, end + 2);
}

async function workspace() {
  const [surface, dossier] = await Promise.all([
    import('../../src/renderer/atlasSurfacePresentationModel.mjs'),
    import('../../src/renderer/atlasDossierLayoutPresentationModel.mjs'),
  ]);
  const document = { activeElement: null, querySelectorAll: () => [], createElement: tag => new Element(tag, document) };
  document.createElementNS = (_, tag) => document.createElement(tag);
  const root = document.createElement('root'), container = document.createElement('workspace'), content = document.createElement('content');
  root.append(container); container.append(content);
  const requests = [], opens = [], matrixUpdates = [], editorFocus = [];
  const sceneNode = { id: 'scene-a', kind: 'scene' };
  let selection = { start: 0, end: 4 };
  const savedQuery = payload => {
    const { sourceScope } = payload;
    const rows = sourceScope.kind === 'BOOK' ? [author.book] : sourceScope.kind === 'SCENE' ? [author.book, author.scene]
      : [author.book, sourceScope.startOffset === 0 ? author.first : author.repeat, author.scene];
    return { ok: true, atlasMatrices: { state: 'ready', projectId, sourceScope, authoredAssociationApplicability: projection(sourceScope, rows) } };
  };
  let query = savedQuery;
  const host = vm.createContext({
    ...surface, ...dossier, HTMLElement: Element, document, console, Object, Number, Array,
    window: { __PRODUCT_PROFILE: 'WRITER_LOCAL_ATLAS_ASSOCIATIONS_V13', innerWidth: 1500 },
    currentProjectId: projectId, currentDocumentId: 'scene-a', currentRightTab: 'atlas', currentAtlasSurface: 'matrices',
    atlasWorkspace: container, atlasWorkspaceContent: content, atlasViewButtons: [],
    atlasWorkspaceMeta: document.createElement('meta'), atlasWorkspaceStatus: document.createElement('status'),
    atlasSurfacePosture: 'SPLIT', atlasSurfaceView: 'GRAPH', atlasSurfaceSelectedRowId: '',
    atlasDossierLod: 'CONTEXT', atlasEntityDossierState: {}, atlasRelationDossierState: {}, atlasOverviewState: overview,
    atlasSurfacePresentationState: null, atlasDossierPresentationState: null,
    atlasMatricesSourceScope: scope('BOOK'), atlasMatricesScopeProjectId: projectId, atlasMatricesState: { state: 'empty', projectId },
    atlasWorkspaceAssociationPublication: null, atlasQueryPublicationSequences: new Map(), atlasCommandPublicationSequence: 0,
    atlasPublicationEpoch: 1, currentTreeContentPublicationId: 'saved-current',
    manualMapDraftOwnership: null, atlasJourneyDraftRevision: 0, manualMapDraftRevision: 0,
    localDirty: false, localEditGeneration: 2, lastAckedGeneration: 2,
    atlasCurrentSceneState: { summary: { sceneTextHash } }, ATLAS_MATRICES_QUERY_ID: 'query.atlasMatrices',
    EXTRA_COMMAND_IDS: { PROJECT_DOCUMENT_OPEN: 'project.document.open' },
    reviewSurfaceIsPlainObject: value => Boolean(value) && typeof value === 'object' && !Array.isArray(value),
    getSelectionOffsets: () => selection,
    isIdeaMeaningSceneSourceCurrent: () => true,
    getIdeaMeaningSceneOrigin: () => ({ startOffset: selection.start, endOffset: selection.end }),
    invokeWorkspaceQueryBridge: (id, payload) => { requests.push({ id, payload }); return query(payload); },
    renderAtlasMatricesState: () => matrixUpdates.push(host.atlasMatricesState),
    applyAtlasResolvedSurfaceBinding: () => {}, syncAtlasWorkspaceLayout: () => {},
    isNavigatorContextCommandAvailable: () => true, focusEditorSurface: value => editorFocus.push(value),
    setAtlasSurfacePosture: posture => { host.atlasSurfacePosture = posture; }, updateStatusText: () => {},
    treeRoot: { sceneNode }, findTreeNodeById: (_, id) => id === sceneNode.id ? sceneNode : null,
    getEffectiveDocumentId: node => node?.id, getEffectiveDocumentKind: node => node?.kind,
    openDocumentNode: async (node, options) => { opens.push({ id: node.id, options }); return true; },
  });
  const source = fs.readFileSync(path.resolve(__dirname, '../../src/renderer/editor.js'), 'utf8');
  const functions = [
    'captureAtlasPublication', 'beginAtlasQueryPublication', 'readAtlasQueryProjection', 'normalizeAtlasOverview',
    'setAtlasWorkspaceRowSelection', 'createAtlasWorkspaceEmpty', 'renderAtlasWorkspaceGraph', 'renderAtlasWorkspaceDossier',
    'renderAtlasWorkspaceList', 'renderAtlasWorkspaceTable', 'isAtlasWorkspaceAuthoredVisible', 'getAtlasWorkspaceAuthoredProjection',
    'describeAtlasWorkspaceAuthoredState', 'createAtlasWorkspaceAuthoredSource', 'renderAtlasWorkspaceState',
    'navigateAtlasAssociationSource', 'normalizeAtlasMatrixAxis', 'normalizeAtlasMatrixTable', 'normalizeAtlasMatrices',
    'setAtlasMatricesScopeUnavailable', 'renderAtlasMatricesAndWorkspace', 'refreshAtlasWorkspaceAssociations',
    'selectAtlasMatricesSourceScope', 'appendAtlasMatricesSourceScopeControls', 'invalidateAtlasMatrixAuthoredSource',
    'invalidateVisibleAtlasAuthoredSource', 'refreshAtlasMatrices',
  ];
  vm.runInContext(functions.map(name => sourceFunction(source, name)).join('\n'), host);
  return {
    host, document, content, requests, opens, matrixUpdates, editorFocus, savedQuery,
    scope: kind => host.selectAtlasMatricesSourceScope(kind, { render: host.renderAtlasMatricesAndWorkspace }),
    query: value => { query = value; },
    selection: (start, end) => { selection = { start, end }; },
    rows: () => content.querySelectorAll('[data-atlas-row-id]'),
    action: () => content.querySelectorAll('[data-atlas-workspace-authored-source]')[0],
  };
}

test('actual workspace renderer shares the existing Matrix read, preserves graph endpoint and keyboard identities, and opens only the exact selected source', async () => {
  const ui = await workspace();
  await ui.scope('FRAGMENT');
  const { host } = ui;
  assert.equal(ui.requests.length, 1);
  assert.equal(ui.requests[0].id, 'query.atlasMatrices');
  assert.equal(ui.requests[0].payload.includeAuthoredAssociations, true);
  assert.deepEqual(JSON.parse(JSON.stringify(ui.requests[0].payload.sourceScope)), scope('FRAGMENT', 0, 4));
  assert.equal(ui.matrixUpdates.at(-1).authoredAssociationApplicability, host.getAtlasWorkspaceAuthoredProjection());
  const selected = 'authored-association:fragment-first';
  const graphRows = ui.rows();
  const graphRow = id => graphRows.find(row => row.dataset.atlasRowId === id);
  const point = row => /\btranslate\((\d+) (\d+)\)/.exec(row.getAttribute('transform')).slice(1);
  const links = ui.content.querySelectorAll('[data-atlas-authored-edge]').filter(edge => edge.dataset.atlasAuthoredEdge === 'fragment-first');
  assert.deepEqual(links.map(edge => ['x1', 'y1', 'x2', 'y2'].map(key => edge.getAttribute(key))), [
    [...point(graphRow('entity:mira')), ...point(graphRow(selected))],
    [...point(graphRow(selected)), ...point(graphRow('entity:boris'))],
  ]);
  graphRow(selected).focus();
  host.setAtlasWorkspaceRowSelection(selected);
  assert.equal(ui.document.activeElement.dataset.atlasRowId, selected);
  assert.equal(ui.action().getAttribute('aria-label').includes('Мира → Борис'), true);
  const graphIds = graphRows.map(row => row.dataset.atlasRowId);
  for (const view of ['LIST', 'TABLE']) {
    host.atlasSurfaceView = view;
    host.renderAtlasWorkspaceState();
    assert.deepEqual(ui.rows().map(row => row.dataset.atlasRowId), graphIds);
    assert.equal(ui.action().dataset.atlasWorkspaceAuthoredSource, 'fragment-first');
    assert.equal(ui.document.activeElement.dataset.atlasRowId, selected);
  }
  assert.equal(ui.requests.length, 1, 'representation changes do not query');
  host.atlasSurfacePosture = 'FULL';
  host.renderAtlasWorkspaceState();
  await ui.action().click();
  assert.equal(host.atlasSurfacePosture, 'MANUSCRIPT');
  assert.deepEqual(ui.editorFocus, ['current']);
  assert.deepEqual(JSON.parse(JSON.stringify(ui.opens)), [{ id: 'scene-a', options: { expectedAtlasAssociationSource: {
    schemaVersion: 'atlas.authoredAssociationNavigation.v1', projectId, associationId: 'fragment-first',
    recordHash: author.first.recordHash, manifestRevision: revision('manifest'), sceneRevision: revision('scene-a'), sceneId: 'scene-a',
  } } }]);
});

test('actual workspace refuses dirty, revoked and late source activation and does not widen a repeated fragment', async () => {
  const ui = await workspace();
  const { host } = ui;
  await ui.scope('FRAGMENT');
  host.setAtlasWorkspaceRowSelection('authored-association:fragment-first');
  const oldButton = ui.action();
  host.localDirty = true;
  host.localEditGeneration++;
  await oldButton.click();
  host.invalidateVisibleAtlasAuthoredSource();
  assert.equal(ui.opens.length, 0);
  assert.equal(ui.requests.length, 1);
  assert.equal(ui.action(), undefined);
  assert.equal(ui.rows().some(row => row.dataset.atlasRowId.startsWith('authored-association:')), false);
  host.localDirty = false;
  host.lastAckedGeneration = host.localEditGeneration;
  ui.selection(6, 10);
  let reply;
  ui.query(payload => payload.sourceScope.kind === 'FRAGMENT'
    ? new Promise(resolve => { reply = () => resolve(ui.savedQuery(payload)); }) : ui.savedQuery(payload));
  const pending = ui.scope('FRAGMENT');
  assert.equal(typeof reply, 'function');
  await ui.scope('BOOK');
  reply();
  await pending;
  assert.deepEqual(ui.rows().filter(row => row.dataset.atlasRowId.startsWith('authored-association:')).map(row => row.dataset.atlasRowId), ['authored-association:book']);
  ui.query(ui.savedQuery);
  await ui.scope('FRAGMENT');
  host.setAtlasWorkspaceRowSelection('authored-association:fragment-repeat');
  assert.equal(ui.action().dataset.atlasWorkspaceAuthoredSource, 'fragment-repeat');
  assert.equal(ui.rows().some(row => row.dataset.atlasRowId === 'authored-association:fragment-first'), false);
  const revoked = ui.action();
  host.window.__PRODUCT_PROFILE = 'WRITER_LOCAL_SCENE_LANGUAGE_TAG_V12';
  await revoked.click();
  host.renderAtlasWorkspaceState();
  assert.equal(ui.action(), undefined);
  assert.equal(ui.opens.length, 0);
});

test('workspace distinguishes clipping, valid empty scope, malformed and foreign authored packets', async () => {
  const { buildAtlasSurfacePresentation } = await import('../../src/renderer/atlasSurfacePresentationModel.mjs');
  const packet = projection(scope('BOOK'), [author.book], 26);
  const build = value => buildAtlasSurfacePresentation({ overview, authoredAssociations: value });
  assert.deepEqual(build(packet).authoredAssociationSummary, { total: 27, omittedCount: 26 });
  assert.deepEqual(build(projection(scope('BOOK'), [])).authoredAssociationSummary, { total: 0, omittedCount: 0 });
  for (const value of [
    { ...packet, projectId: 'foreign' }, { ...packet, omittedCount: 25 }, { ...packet, state: 'unavailable' },
    projection(scope('BOOK'), [author.book, author.book]),
    projection(scope('BOOK'), [{ ...author.book, sourceState: 'stale' }]),
  ]) {
    assert.equal(build(value).authoredAssociationSummary, undefined);
    assert.deepEqual(build(value).rows, build(null).rows);
  }
});
