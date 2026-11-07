const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const renderer = fs.readFileSync(path.join(__dirname, '../../src/renderer/editor.js'), 'utf8');
function rendererRange(start, end) {
  const first = renderer.indexOf(start);
  const last = renderer.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, start);
  return renderer.slice(first, last);
}
const sources = [
  rendererRange('function captureAtlasPublication(', 'function manualMapNumber('),
  rendererRange('function normalizeAtlasTemporalLayout(', 'function handleAtlasTemporalLayoutInput('),
  rendererRange('function appendAtlasTemporalLayoutList(', 'function renderAtlasTemporalLayoutState('),
  rendererRange('async function refreshAtlasTemporalLayout(', 'function normalizeAtlasContinuityLedgerSurface('),
].join('\n');

const firstId = 'tree-node-' + 'a'.repeat(32);
const otherId = 'tree-node-' + 'b'.repeat(32);
const hiddenId = 'tree-node-' + 'c'.repeat(32);
const projectId = 'project:timeline-fixture';
const rev = 7;
const queryId = 'query.atlasTemporalLayout';
const treeQueryId = 'query.project.tree';
const openCommandId = 'cmd.project.document.open';
const settle = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let release;
  const result = new Promise(resolve => { release = resolve; });
  return { release, result };
};

function fixture({ outsideNavigator = false } = {}) {
  const document = { activeElement: null };
  class Element {
    constructor(tag) {
      this.tagName = tag.toUpperCase();
      this.dataset = {};
      this.children = [];
      this.parentElement = null;
      this.tabIndex = -1;
    }
    append(...items) { for (const item of items) this.appendChild(item); }
    appendChild(item) { this.children.push(item); item.parentElement = this; }
    contains(item) { return item === this || this.children.some(child => child.contains(item)); }
    matches(selector) {
      const fields = {
        '[data-atlas-temporal-event]': 'atlasTemporalEvent',
        '[data-atlas-temporal-scene-id]': 'atlasTemporalSceneId',
        'button[data-atlas-temporal-scene-id]': 'atlasTemporalSceneId',
        '[data-atlas-temporal-layout-close]': 'atlasTemporalLayoutClose',
      };
      return (!selector.startsWith('button') || this.tagName === 'BUTTON') && Object.hasOwn(this.dataset, fields[selector]);
    }
    closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
    querySelectorAll(selector) {
      return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
    }
    getAttribute(name) { return name === 'tabindex' ? String(this.tabIndex) : null; }
    focus() { document.activeElement = this; }
  }
  class Button extends Element { constructor() { super('button'); } }
  document.createElement = tag => tag === 'button' ? new Button() : new Element(tag);
  const host = document.createElement('div');
  const canonical = [firstId, otherId, hiddenId].map((id, i) => ({ id, kind: 'scene', label: ['Первая', 'Соседняя', 'Скрытая'][i] }));
  const root = { nodes: canonical };
  const events = canonical.slice(0, 2).map(({ id, label }, i) => ({
    eventId: 'atlas-temporal-event:' + id, sceneId: id, sceneTitle: label, focusIndex: i, storyLabel: 'unknown',
  }));
  const projection = { state: 'degraded', projectId, summary: { layoutHash: '1'.repeat(64), sourceHash: '2'.repeat(64) },
    layoutPacket: { state: 'ready', events }, listParity: { rows: events.map(({ sceneId, sceneTitle, storyLabel }) => ({ sceneId, sceneTitle, storyLabel })) } };
  const opened = [], reads = [], notices = [];
  const context = vm.createContext({
    document, Element, HTMLElement: Element, HTMLButtonElement: Button, atlasTemporalLayoutHost: host,
    atlasTemporalLayoutExplicitOpen: true, atlasTemporalLayoutState: {}, atlasTemporalLayoutPublication: null,
    atlasTemporalLayoutOpening: false, currentRightTab: 'atlas', currentAtlasSurface: 'temporal',
    currentProjectId: projectId, currentDocumentId: firstId, localDirty: false, localEditGeneration: 4, lastAckedGeneration: 4,
    atlasPublicationEpoch: 1, currentTreeContentPublicationId: 2, atlasQueryPublicationSequences: new Map(),
    atlasCommandPublicationSequence: 3, manualMapDraftOwnership: null, atlasJourneyDraftRevision: 0, manualMapDraftRevision: 0,
    treeRoot: outsideNavigator ? { nodes: [] } : root, treeMutationProjection: { projectId, treeRevision: rev },
    ATLAS_TEMPORAL_LAYOUT_QUERY_ID: queryId, PROJECT_TREE_QUERY_ID: treeQueryId, EXTRA_COMMAND_IDS: { PROJECT_DOCUMENT_OPEN: openCommandId },
    reviewSurfaceIsPlainObject: value => value && typeof value === 'object' && !Array.isArray(value),
    isAtlasSurfaceActive: surface => context.currentAtlasSurface === surface,
    isNavigatorContextCommandAvailable: command => command === openCommandId && context.canOpen,
    canOpen: true,
    findTreeNodeById: (tree, id) => tree?.nodes.find(node => node.id === id),
    getEffectiveDocumentId: node => node?.id || '',
    getEffectiveDocumentKind: node => node?.kind || '',
    updateStatusText: (value, options) => notices.push({ value, visible: options?.visible === true }),
    renderAtlasTemporalLayoutState() {},
    closeAtlasTemporalLayoutSurface() { context.atlasTemporalLayoutExplicitOpen = false; },
    openDocumentNode: async node => { opened.push(node); return true; },
    readTree: async () => ({ ok: true, projectId, treeRevision: rev, root }),
    invokeWorkspaceQueryBridge: async (id, payload) => {
      if (id === queryId) return { ok: true, atlasTemporalLayout: projection };
      assert.equal(id, treeQueryId);
      reads.push(payload.tab);
      return context.readTree();
    },
  });
  vm.runInContext(sources + '\napi = { handleAtlasTemporalLayoutClick, handleAtlasTemporalLayoutKeydown, appendAtlasTemporalLayoutList, refreshAtlasTemporalLayout };', context);
  const marker = (id, index = 0) => {
    const b = document.createElement('button');
    b.dataset.atlasTemporalEvent = 'true';
    b.dataset.atlasTemporalSceneId = id;
    b.tabIndex = index === 0 ? 0 : -1;
    host.appendChild(b);
    return b;
  };
  const chart = events.map((event, index) => marker(event.sceneId, index));
  const listParent = document.createElement('section');
  host.appendChild(listParent);
  context.api.appendAtlasTemporalLayoutList(listParent, projection.listParity.rows);
  const list = listParent.children[0].children;
  const click = (target) => context.api.handleAtlasTemporalLayoutClick({ target });
  const key = (target, key, repeat = false) => {
    let prevented = false;
    context.api.handleAtlasTemporalLayoutKeydown({ target, key, repeat, preventDefault() { prevented = true; } });
    return prevented;
  };
  const refresh = () => context.api.refreshAtlasTemporalLayout(null);
  return { context, chart, list, marker, root, canonical, opened, reads, notices, document, click, key, refresh };
}

test('Atlas Time chart opens the exact existing scene by pointer and keyboard', async () => {
  const f = fixture();
  await f.refresh();
  f.click(f.chart[1]);
  await settle();
  assert.equal(f.key(f.chart[0], 'Enter'), true);
  await settle();
  assert.equal(f.key(f.chart[0], ' ', true), true);
  await settle();
  assert.deepEqual(f.opened, [f.canonical[1], f.canonical[0]]);
  assert.deepEqual(f.reads, []);
});

test('Atlas Time rendered list row uses the same existing scene navigation', async () => {
  const f = fixture();
  await f.refresh();
  assert.equal(f.list.length, 2);
  f.click(f.list[1].children[0]);
  await settle();
  assert.deepEqual(f.opened, [f.canonical[1]]);
});

test('Atlas Time opens outside the current navigator tab through the exact roman tree', async () => {
  const f = fixture({ outsideNavigator: true });
  await f.refresh();
  f.click(f.chart[1]);
  await settle();
  assert.deepEqual(f.reads, ['roman']);
  assert.deepEqual(f.opened, [f.canonical[1]]);
});

test('Atlas Time refuses dirty, stale, hidden and unsupported activation without opening or querying', async () => {
  for (const alter of [
    f => { f.context.localDirty = true; },
    f => { f.context.localEditGeneration++; },
    f => { f.context.currentTreeContentPublicationId++; },
    f => { f.context.canOpen = false; },
    f => { f.context.currentProjectId = 'foreign-project'; },
    f => { f.context.atlasTemporalLayoutExplicitOpen = false; },
    f => { f.context.currentAtlasSurface = 'matrices'; },
  ]) {
    const f = fixture({ outsideNavigator: true });
    await f.refresh();
    alter(f);
    f.click(f.chart[1]);
    await settle();
    assert.deepEqual(f.reads, []);
    assert.deepEqual(f.opened, []);
  }
  const f = fixture({ outsideNavigator: true });
  await f.refresh();
  f.click(f.marker(hiddenId));
  f.click(f.marker('../../outside.txt'));
  await settle();
  assert.deepEqual(f.reads, []);
  assert.deepEqual(f.opened, []);
});

test('Atlas Time revalidates the pending tree lookup and suppresses duplicate activation', async () => {
  for (const { change, responseProject = projectId, responseRevision = rev } of [
    { change: f => { f.context.currentProjectId = 'foreign-project'; } },
    { change: f => { f.context.canOpen = false; } },
    { change: f => { f.context.localDirty = true; } },
    { change: f => { f.context.treeMutationProjection = { projectId, treeRevision: rev + 1 }; } },
    { change: f => f.refresh() },
    { change() {}, responseRevision: rev + 1 },
    { change() {}, responseProject: 'foreign-project' },
  ]) {
    const f = fixture({ outsideNavigator: true });
    await f.refresh();
    const pending = deferred();
    f.context.readTree = () => pending.result;
    f.click(f.chart[1]);
    f.key(f.chart[1], 'Enter');
    await settle();
    assert.deepEqual(f.reads, ['roman']);
    await change(f);
    pending.release({ ok: true, projectId: responseProject, treeRevision: responseRevision, root: f.root });
    await settle();
    assert.deepEqual(f.opened, []);
  }
});

test('Atlas Time arrow navigation still roves focus without opening a scene', async () => {
  const f = fixture();
  await f.refresh();
  f.chart[0].focus();
  assert.equal(f.key(f.chart[0], 'ArrowRight'), true);
  assert.equal(f.document.activeElement, f.chart[1]);
  assert.deepEqual(f.chart.map(button => button.tabIndex), [-1, 0]);
  await settle();
  assert.deepEqual(f.opened, []);
  assert.deepEqual(f.reads, []);
});
