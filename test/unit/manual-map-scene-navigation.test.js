'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const { WORKSPACE_QUERY_IDS } = require('../../src/shared/workspaceQueryRegistry.cjs');
const ROOT = path.resolve(__dirname, '../..');
const editorSource = () => fs.readFileSync(path.join(ROOT, 'src/renderer/editor.js'), 'utf8');

function functionSource(source, name, optional = false) {
  const match = new RegExp(`^(?:async )?function ${name}\\(`, 'mu').exec(source);
  if (!match && optional) return '';
  assert.ok(match, `Actual production function ${name} must exist`);
  const end = source.indexOf('\n}', match.index);
  assert.ok(end > match.index);
  return source.slice(match.index, end + 2);
}

// Reuse the maintained complete-Main initializer without registering its tests.
// Its native ports are inert; filesystem/Core/Kernel/save code is production.
const fixturePath = path.join(ROOT, 'test/contracts/rtk-word-scene-identity-main.contract.test.js');
const fixtureSource = fs.readFileSync(fixturePath, 'utf8');
const firstCase = fixtureSource.indexOf('\ntest(');
assert.ok(firstCase > 0);
const extraProbe = `module.exports.__probe = {
    beforeContinuity(callback) {
      const original = saveLastFile;
      saveLastFile = async (...args) => { saveLastFile = original; await callback(); return original(...args); };
    },
    afterActualBarrier(callback) {
      const original = confirmDiscardChanges;
      confirmDiscardChanges = async () => {
        const allowed = await original();
        confirmDiscardChanges = original;
        if (allowed) await callback();
        return allowed;
      };
    },`;
const initializer = fixtureSource.slice(0, firstCase);
assert.equal(initializer.split('module.exports.__probe = {').length, 2);
const fixtureModule = new Module(fixturePath, module);
fixtureModule.filename = fixturePath;
fixtureModule.paths = Module._nodeModulePaths(path.dirname(fixturePath));
fixtureModule._compile(initializer.replace('module.exports.__probe = {', extraProbe)
  + '\n' + functionSource(fixtureSource, 'mountRenderer')
  + '\nmodule.exports = { fixture, mountRenderer };', fixturePath);
const { fixture, mountRenderer } = fixtureModule.exports;

function inspectorHarness() {
  const source = editorSource(), calls = [], statuses = [];
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {};
      this.events = {}; this.parentElement = null; this.disabled = false;
      this.textContent = ''; this.className = ''; this.rootConnected = false;
    }
    append(...nodes) { for (const node of nodes) this.appendChild(node); }
    appendChild(node) { this.children.push(node); node.parentElement = this; return node; }
    get isConnected() { return this.rootConnected || Boolean(this.parentElement?.isConnected); }
    addEventListener(type, handler) { this.events[type] = handler; }
    setAttribute(name, value) { this[name] = String(value); }
    getAttribute(name) { return this[name] || ''; }
    closest(selector) {
      if (selector.includes('data-manual-map-workbench-host') && this.isHost) return this;
      return this.parentElement?.closest(selector) || null;
    }
    focus() { c.document.activeElement = this; }
    async click() { if (!this.disabled) await this.events.click?.({ currentTarget: this, target: this }); }
  }
  const sceneId = 'tree-node-' + 'a'.repeat(32);
  const linked = { nodeId: sceneId, id: sceneId, kind: 'scene', label: 'Сцена е\u0308 — Atlas' };
  const node = { id: 'map-node', kind: 'sceneRef', label: 'Переход к сцене',
    position: { x: 10, y: 20 }, target: { kind: 'scene', id: sceneId } };
  const graph = { projectId: 'project-a', mapId: 'map-a', title: 'Map', nodes: [node], edges: [],
    meta: { graphHash: 'graph-one' } };
  const state = { state: 'ready', projectId: 'project-a', mapId: 'map-a', graph,
    summary: { workbenchHash: 'workbench-one' } };
  const host = new Element(); host.rootConnected = true; host.isHost = true;
  host.dataset.manualMapWorkbenchPlacement = 'right-rail-inspector';
  const c = { Element, HTMLElement: Element, HTMLButtonElement: Element,
    document: { createElement: tag => new Element(tag), activeElement: null },
    currentProjectId: 'project-a', currentDocumentId: 'current-scene', currentDocumentKind: 'scene',
    currentTreeContentPublicationId: 'publication-one', localEditGeneration: 0,
    atlasPublicationEpoch: 0, manualMapDraftOwnership: 0, atlasJourneyDraftRevision: 0,
    manualMapDraftRevision: 0, manualMapCommandDraft: null, manualMapDraftEffect: null,
    manualMapWorkbenchState: state, manualMapTransientViewState: { selection: { primaryNodeId: node.id } },
    manualMapLayoutMode: 'manual', MANUAL_MAP_LAYOUT_MODES: { HIERARCHY: 'hierarchy' },
    currentRightTab: 'atlas', activeDocumentRevealRequested: false,
    treeRoot: { nodeId: 'root', children: [linked] },
    treeMutationProjection: { projectId: 'project-a', treeRevision: 1 },
    EXTRA_COMMAND_IDS: { PROJECT_DOCUMENT_OPEN: 'cmd.project.document.open' },
    PROJECT_TREE_QUERY_ID: WORKSPACE_QUERY_IDS.PROJECT_TREE,
    getEffectiveDocumentId: value => value?.nodeId || '',
    getEffectiveDocumentKind: value => value?.kind || '',
    findTreeNodeById: (root, id) => root?.children?.find(value => value.nodeId === id) || null,
    isNavigatorContextCommandAvailable: () => true,
    updateMetaVisibility() {}, updateInspectorSnapshot() {}, refreshMetadataInspector() {},
    refreshActiveAtlasSurface() {}, refreshSceneHistory() {}, hideManualMapPlanWorkspace() {},
    updateStatusText: (text, options) => statuses.push({ text, options }),
    holdAuthorActionStatus: text => statuses.push({ text, options: { visible: true } }),
  };
  c.dispatchUiCommand = async (commandId, payload) => {
    calls.push({ commandId, payload: JSON.parse(JSON.stringify(payload)) });
    return c.commandPort ? c.commandPort(commandId, payload)
      : { ok: true, value: { documentId: payload.nodeId } };
  };
  vm.createContext(c);
  const names = ['manualMapText', 'manualMapNumber', 'manualMapNodePosition',
    'getManualMapSelectedNodeId', 'getManualMapSelectedEdgeId', 'getManualMapNodeById',
    'getManualMapEdgeById', 'captureAtlasPublication', 'invalidateAtlasPublications',
    'openDocumentNode', 'renderManualMapInspector'];
  vm.runInContext(names.map(name => functionSource(source, name)).join('\n')
    + '\n' + ['getManualMapSceneNavigationTarget', 'openManualMapScene']
      .map(name => functionSource(source, name, true)).join('\n'), c);
  const runtime = { sourceGraph: graph, resourceBudgetProof: null };
  c.renderManualMapInspector(host, state, runtime);
  const descendants = element => [element, ...element.children.flatMap(descendants)];
  return { c, host, linked, node, graph, state, sceneId, calls, statuses,
    nodes: () => descendants(host),
    action: () => descendants(host).find(element => element.dataset.manualMapOpenScene === 'true'),
  };
}

test('actual map inspector unchanged positive control renders the selected stable scene reference', () => {
  const h = inspectorHarness();
  assert.ok(h.nodes().some(element => element.textContent === 'Переход к сцене'));
  assert.ok(h.nodes().some(element => element.textContent.includes('sceneRef · map-node')));
  assert.equal(h.calls.length, 0);
});

test('actual inspector opens the stable linked scene via existing command with no label or path authority', async () => {
  const h = inspectorHarness(), action = h.action();
  assert.ok(action, 'Selected scene reference must expose its Open scene action');
  assert.equal(action.tagName, 'BUTTON'); assert.equal(action.type, 'button');
  assert.equal(action.textContent, 'Открыть сцену'); assert.equal(action.disabled, false);
  await action.click();
  assert.deepEqual(h.calls, [{ commandId: 'cmd.project.document.open',
    payload: { projectId: 'project-a', nodeId: h.sceneId } }]);
  assert.equal(h.c.currentDocumentId, h.sceneId);
});

test('actual connected scene action permits unsaved text generation while exact map target and document remain current', async () => {
  const h = inspectorHarness(), action = h.action();
  h.c.localEditGeneration++;
  await action.click();
  assert.equal(h.calls.length, 1, 'Main owns no-loss saving; an unrelated authoring generation must not make the current navigation action inert');
  assert.equal(h.calls[0].payload.nodeId, h.sceneId);
  assert.equal(h.c.currentDocumentId, h.sceneId);
});

for (const drift of ['detached', 'project', 'map', 'target', 'source', 'publication', 'tree', 'draft', 'capability']) {
  test(`actual retained map action refuses ${drift} before command and preserves selection/text`, async () => {
    const h = inspectorHarness(), action = h.action();
    assert.ok(action, 'The real current action must exist before exercising the negative');
    if (drift === 'detached') h.host.rootConnected = false;
    if (drift === 'project') h.c.currentProjectId = 'project-b';
    if (drift === 'map') h.state.mapId = 'map-b';
    if (drift === 'target') h.node.target.id = 'tree-node-' + 'b'.repeat(32);
    if (drift === 'source') h.state.summary.workbenchHash = 'workbench-two';
    if (drift === 'publication') h.c.currentTreeContentPublicationId = 'publication-two';
    if (drift === 'tree') h.c.treeMutationProjection.treeRevision++;
    if (drift === 'draft') h.c.manualMapCommandDraft = { state: 'editing', values: { label: 'unsaved map text' } };
    if (drift === 'capability') h.c.isNavigatorContextCommandAvailable = () => false;
    const before = JSON.stringify(h.c.manualMapTransientViewState);
    await action.click();
    assert.equal(h.calls.length, 0);
    assert.equal(h.c.currentDocumentId, 'current-scene');
    assert.equal(JSON.stringify(h.c.manualMapTransientViewState), before);
    if (drift === 'draft') assert.equal(h.c.manualMapCommandDraft.values.label, 'unsaved map text');
  });
}

test('actual Kernel/Main unchanged positive control opens exact scene after the real no-loss barrier', async t => {
  const f = await fixture(t), ui = mountRenderer(f, 'Beta', 0);
  let reached = 0; f.probe.afterActualBarrier(() => { reached++; });
  const result = await f.probe.dispatch('cmd.project.document.open', { projectId: f.query.projectId, nodeId: f.a.nodeId });
  assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(reached, 1);
  assert.equal(f.probe.state().filePath, f.alpha);
  const publication = ui.sends.filter(value => value.channel === 'editor:set-text').at(-1)?.payload;
  assert.equal(publication.documentId, f.a.nodeId); assert.equal(publication.content, 'Alpha');
});

test('actual Kernel/Main saves unsaved Unicode to its original scene before linked navigation', async t => {
  const f = await fixture(t), working = 'Несохранённая е\u0308 Ω 🧭';
  const ui = mountRenderer(f, working, 1); f.probe.state({ dirty: true });
  const result = await f.probe.dispatch('cmd.project.document.open', { projectId: f.query.projectId, nodeId: f.a.nodeId });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(fs.readFileSync(f.beta, 'utf8'), working);
  assert.equal(fs.readFileSync(f.alpha, 'utf8'), 'Alpha');
  assert.ok(ui.sends.some(value => value.channel === 'set-dirty' && value.payload.ack?.kind === 'SAVED'));
});

test('actual Kernel/Main rejects foreign project identity before editor replacement', async t => {
  const f = await fixture(t), ui = mountRenderer(f, 'Beta', 0), before = f.capture();
  const result = await f.probe.dispatch('cmd.project.document.open', { projectId: 'foreign-project', nodeId: f.a.nodeId });
  assert.equal(result.ok, false); assert.deepEqual(f.capture(), before);
  assert.equal(f.probe.state().filePath, f.beta);
  assert.equal(ui.sends.filter(value => value.channel === 'editor:set-text').length, 0);
});

for (const drift of ['project', 'generation', 'session', 'window']) {
  test(`actual Kernel/Main ${drift} change after the real no-loss barrier refuses stale linked opening`, async t => {
    const f = await fixture(t), ui = mountRenderer(f, 'Beta', 0);
    let reached = 0;
    f.probe.afterActualBarrier(() => {
      reached++;
      if (drift === 'project') f.probe.state({ projectName: 'Other project' });
      if (drift === 'generation') f.probe.state({ generation: 1, dirty: true });
      if (drift === 'session') f.probe.changeSession();
      if (drift === 'window') f.probe.state({ window: { isDestroyed: () => false, webContents: { send() {} } } });
    });
    const result = await f.probe.dispatch('cmd.project.document.open', { projectId: f.query.projectId, nodeId: f.a.nodeId });
    assert.equal(reached, 1, 'The genuine barrier must complete before this behavioral oracle');
    assert.equal(result.ok, false, 'Stale caller must refuse rather than replace the editor');
    assert.equal(f.probe.state().filePath, f.beta);
    assert.equal(ui.sends.filter(value => value.channel === 'editor:set-text').length, 0);
    assert.equal(fs.readFileSync(f.alpha, 'utf8'), 'Alpha'); assert.equal(fs.readFileSync(f.beta, 'utf8'), 'Beta');
    if (drift === 'generation') assert.equal(f.probe.state().dirty, true);
  });
}

test('actual scene action resolves the exact source through the existing query when another navigator tab is shown', async () => {
  const h = inspectorHarness(), queries = [];
  h.c.treeRoot = null;
  h.c.invokeWorkspaceQueryBridge = async (id, payload) => {
    queries.push({ id, payload: JSON.parse(JSON.stringify(payload)) });
    return { ok: true, projectId: 'project-a', treeRevision: 1, root: { children: [h.linked] } };
  };
  await h.action().click();
  assert.deepEqual(queries, [{ id: WORKSPACE_QUERY_IDS.PROJECT_TREE, payload: { tab: 'roman' } }]);
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].payload.nodeId, h.sceneId);
  assert.equal(h.c.treeRoot, null, 'Source lookup must not replace the visible navigator');
});

for (const issue of ['missing', 'wrong-kind', 'foreign', 'revision', 'late-project', 'late-source']) {
  test(`actual queried source ${issue} cannot turn the map label into opening authority`, async () => {
    const h = inspectorHarness(); h.c.treeRoot = null;
    h.c.invokeWorkspaceQueryBridge = async () => {
      if (issue === 'late-project') h.c.currentProjectId = 'project-b';
      if (issue === 'late-source') h.state.summary.workbenchHash = 'different';
      return { ok: true, projectId: issue === 'foreign' ? 'project-b' : 'project-a',
        treeRevision: issue === 'revision' ? 2 : 1,
        root: { children: issue === 'missing' ? [] : [{ ...h.linked, kind: issue === 'wrong-kind' ? 'material' : 'scene' }] } };
    };
    await h.action().click(); assert.equal(h.calls.length, 0);
    assert.equal(h.c.currentDocumentId, 'current-scene');
  });
}

test('actual action coalesces duplicate activation while its existing command is pending', async () => {
  const h = inspectorHarness(); let deliver;
  h.c.commandPort = () => new Promise(resolve => { deliver = resolve; });
  const action = h.action(), pending = action.click();
  assert.equal(h.calls.length, 1); assert.equal(action.disabled, true);
  await action.click(); assert.equal(h.calls.length, 1);
  deliver({ ok: true, value: { documentId: h.sceneId } }); await pending;
  assert.equal(h.c.currentDocumentId, h.sceneId);
});

for (const drift of ['project', 'document']) {
  test(`actual delayed open reply cannot overwrite a newer ${drift} publication`, async () => {
    const h = inspectorHarness(); let deliver;
    h.c.commandPort = () => new Promise(resolve => { deliver = resolve; });
    const pending = h.action().click(); assert.equal(h.calls.length, 1);
    if (drift === 'project') h.c.currentProjectId = 'project-b';
    h.c.currentDocumentId = 'newer-scene'; h.c.atlasPublicationEpoch++;
    deliver({ ok: true, value: { documentId: h.sceneId } }); await pending;
    assert.equal(h.c.currentDocumentId, 'newer-scene');
    if (drift === 'project') assert.equal(h.c.currentProjectId, 'project-b');
  });
}

test('actual Main comment draft blocks linked navigation through the real save/lifecycle barrier', async t => {
  const f = await fixture(t), working = 'Unsaved author text Ω';
  const ui = mountRenderer(f, working, 1, null, () => ({ projectId: f.query.projectId,
    documentId: f.b.nodeId, commentAuthoringPending: true }));
  f.probe.state({ dirty: true });
  const result = await f.probe.dispatch('cmd.project.document.open', { projectId: f.query.projectId, nodeId: f.a.nodeId });
  assert.equal(result.ok, false); assert.equal(f.probe.state().filePath, f.beta);
  assert.equal(ui.sends.filter(value => value.channel === 'editor:set-text').length, 0);
  assert.equal(fs.readFileSync(f.alpha, 'utf8'), 'Alpha');
});

test('actual Main late edit during continuity cannot replace or mark clean the newer authoring buffer', async t => {
  const f = await fixture(t), ui = mountRenderer(f, 'Beta', 0); let reached = 0;
  f.probe.beforeContinuity(() => { reached++; f.probe.state({ generation: 1, dirty: true }); });
  const result = await f.probe.dispatch('cmd.project.document.open', { projectId: f.query.projectId, nodeId: f.a.nodeId });
  assert.equal(reached, 1); assert.equal(result.ok, false);
  assert.equal(f.probe.state().filePath, f.beta); assert.equal(f.probe.state().dirty, true);
  assert.equal(ui.sends.filter(value => value.channel === 'editor:set-text').length, 0);
});

test('actual Main missing linked scene after the barrier is refused without creating an empty replacement', async t => {
  const f = await fixture(t), ui = mountRenderer(f, 'Beta', 0); let reached = 0;
  f.probe.afterActualBarrier(() => { reached++; fs.unlinkSync(f.alpha); });
  const result = await f.probe.dispatch('cmd.project.document.open', { projectId: f.query.projectId, nodeId: f.a.nodeId });
  assert.equal(reached, 1); assert.equal(result.ok, false); assert.equal(fs.existsSync(f.alpha), false);
  assert.equal(f.probe.state().filePath, f.beta);
  assert.equal(ui.sends.filter(value => value.channel === 'editor:set-text').length, 0);
});

for (const change of ['bytes', 'symlink']) {
  test(`actual Main target ${change} changed after read refuses stale source publication`, async t => {
    const f = await fixture(t), ui = mountRenderer(f, 'Beta', 0); let reached = 0;
    const other = path.join(f.temp, 'Other author text.txt'); fs.writeFileSync(other, 'Other author text');
    f.probe.beforeContinuity(() => {
      reached++;
      if (change === 'bytes') fs.writeFileSync(f.alpha, 'Newer saved source Ω');
      else { fs.unlinkSync(f.alpha); fs.symlinkSync(other, f.alpha); }
    });
    const result = await f.probe.dispatch('cmd.project.document.open', { projectId: f.query.projectId, nodeId: f.a.nodeId });
    assert.equal(reached, 1); assert.equal(result.ok, false, 'A previous read is not current source authority');
    assert.equal(f.probe.state().filePath, f.beta);
    assert.equal(ui.sends.filter(value => value.channel === 'editor:set-text').length, 0);
    assert.equal(fs.readFileSync(f.alpha, 'utf8'), change === 'bytes' ? 'Newer saved source Ω' : 'Other author text');
    assert.equal(fs.readFileSync(other, 'utf8'), 'Other author text');
  });
}
