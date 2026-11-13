'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const ROOT = path.resolve(__dirname, '../..');
const source = () => fs.readFileSync(path.join(ROOT, 'src/renderer/editor.js'), 'utf8');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function productionFunction(text, name) {
  const match = new RegExp(`^(?:async )?function ${name}\\(`, 'mu').exec(text);
  assert.ok(match, `Actual production function ${name} must exist`);
  const end = text.indexOf('\n}', match.index);
  assert.ok(end > match.index);
  return text.slice(match.index, end + 2);
}
const plain = value => JSON.parse(JSON.stringify(value));
async function rendererHarness(overrides = {}) {
  const flow = await import(pathToFileURL(path.join(ROOT, 'src/renderer/commands/flowMode.mjs')).href);
  const calls = [], statuses = [], replies = [];
  const context = { ...flow, currentProjectId: 'project-a', currentDocumentId: 'scene-a',
    currentTreeContentPublicationId: 'publication-a', localEditGeneration: 7, lastAckedGeneration: 7,
    localDirty: false, flowModeOpenRequest: null,
    flowModeState: { active: false, dirty: false, scenes: [], projection: null },
    text: 'Original 😀 e\u0301', selection: { start: 2, end: 5 }, undo: ['unchanged previous edit'],
    wordCommentDraft: null, wordCommentBusy: false, manuscriptDrafts: new Map(),
    notesMutationPending: false, storyDrafts: new Map(), storyMutationPending: false,
    pendingStoryRequestId: null,
    COMMAND_IDS: { PROJECT_FLOW_OPEN_V1: 'cmd.project.flowOpenV1', PROJECT_SAVE: 'cmd.project.save' },
    FLOW_OPEN_ERROR_MESSAGE: 'Flow unavailable',
    setPlainText(text) { calls.push({ kind: 'replace', text }); context.text = text; },
    getPlainText: () => context.text,
    updateWordCount() {}, syncFlowViewModeButtons() {},
    showEditorPanelFor: title => calls.push({ kind: 'show', title }),
    updateStatusText: (text, options) => statuses.push({ text, options }),
    invokeSaveLifecycleSignalBridge: async (id, payload) => { calls.push({ kind: 'signal', id, payload }); return { ok: true }; },
    dispatchUiCommand: async (id, payload) => {
      calls.push({ kind: 'command', id, payload });
      if (id === 'cmd.project.save') return { ok: false, error: { code: 'TEST_SAVE_REFUSED' } };
      return new Promise(resolve => replies.push(resolve));
    },
    ...overrides,
  };
  vm.createContext(context);
  const text = source();
  vm.runInContext(['normalizeFlowSceneRefs', 'runFlowOpenCommand', 'handleFlowModeOpenUiPath']
    .map(name => productionFunction(text, name)).join('\n'), context);
  const snapshot = () => plain({ text: context.text, selection: context.selection, undo: context.undo,
    dirty: context.localDirty, generation: context.localEditGeneration, ack: context.lastAckedGeneration,
    project: context.currentProjectId, document: context.currentDocumentId,
    publication: context.currentTreeContentPublicationId, flow: context.flowModeState });
  const respond = index => replies[index]({ ok: true, value: { scenes: [
    { nodeId: 'scene-a', sceneId: 'roman/01.txt', title: 'One', content: 'Saved first', baselineHash: 'a'.repeat(64) },
    { nodeId: 'scene-b', sceneId: 'roman/02.txt', title: 'Two', content: 'Saved second 😀', baselineHash: 'b'.repeat(64) },
  ] } });
  return { context, calls, statuses, replies, snapshot, respond,
    open: () => context.handleFlowModeOpenUiPath() };
}
test('whole-book open clean positive uses the actual source projection and existing command', async () => {
  const h = await rendererHarness(); const pending = h.open();
  assert.equal(h.replies.length, 1); h.respond(0); await pending;
  assert.equal(h.context.flowModeState.active, true);
  assert.equal(h.context.text, 'One\n\nSaved first\n\nTwo\n\nSaved second 😀\n');
  assert.equal(h.context.flowModeState.scenes.length, 2);
  assert.equal(h.context.localDirty, false); assert.equal(h.context.lastAckedGeneration, 7);
  assert.equal(h.calls.filter(x => x.kind === 'command')[0].id, 'cmd.project.flowOpenV1');
  assert.equal(h.calls.filter(x => x.kind === 'show').length, 1);
});
for (const drift of ['typing', 'project', 'document', 'publication', 'flow-instance']) {
  test('whole-book late response preserves newer ' + drift + ' context without an ACK or replacement', async () => {
    const h = await rendererHarness(), pending = h.open(); assert.equal(h.replies.length, 1);
    if (drift === 'typing') { h.context.text += ' NEW'; h.context.localEditGeneration++; h.context.localDirty = true; }
    if (drift === 'project') { h.context.currentProjectId = 'project-b'; h.context.text = 'Foreign project manuscript'; }
    if (drift === 'document') { h.context.currentDocumentId = 'scene-b'; h.context.text = 'Different scene manuscript'; }
    if (drift === 'publication') h.context.currentTreeContentPublicationId = 'publication-b';
    if (drift === 'flow-instance') h.context.flowModeState = { active: false, dirty: false, scenes: [], projection: null };
    const current = h.snapshot(); h.respond(0); await pending;
    assert.deepEqual(h.snapshot(), current, 'A stale read cannot replace or mark clean the newer authoring state');
    assert.equal(h.calls.some(x => x.kind === 'replace' || x.kind === 'signal' || x.kind === 'show'), false);
  });
}
test('whole-book failed or cancelled canonical Save keeps unsaved Unicode and never reads a stale book', async () => {
  for (const result of [{ ok: false, error: { code: 'SAVE_FAILED' } }, { ok: true, value: { cancelled: true } }]) {
    const h = await rendererHarness({ localDirty: true, localEditGeneration: 8, lastAckedGeneration: 7 });
    h.context.text += ' UNSAVED'; const before = h.snapshot();
    h.context.dispatchUiCommand = async id => { h.calls.push({ kind: 'command', id }); return result; };
    await h.open(); assert.deepEqual(h.snapshot(), before);
    assert.deepEqual(h.calls.filter(x => x.kind === 'command').map(x => x.id), ['cmd.project.save']);
    assert.equal(h.calls.some(x => x.kind === 'replace' || x.kind === 'signal' || x.kind === 'show'), false);
  }
});
test('whole-book held Save rejects a newer edit before requesting or publishing the book', async () => {
  const h = await rendererHarness({ localDirty: true, localEditGeneration: 8, lastAckedGeneration: 7 });
  let resolveSave;
  h.context.dispatchUiCommand = id => { h.calls.push({ kind: 'command', id }); return new Promise(resolve => { resolveSave = resolve; }); };
  const pending = h.open(); h.context.text += ' LATE'; h.context.localEditGeneration++;
  const current = h.snapshot(); resolveSave({ ok: true, value: { saved: true } }); await pending;
  assert.deepEqual(h.snapshot(), current);
  assert.deepEqual(h.calls.filter(x => x.kind === 'command').map(x => x.id), ['cmd.project.save']);
});
test('whole-book superseded response cannot overwrite the latest accepted projection', async () => {
  const h = await rendererHarness(); const first = h.open(), second = h.open();
  assert.ok(h.replies.length >= 1 && h.replies.length <= 2);
  if (h.replies.length === 1) { h.respond(0); await Promise.all([first, second]); return; }
  h.replies[1]({ ok: true, value: { scenes: [{ nodeId: 'scene-b', title: 'Newest', content: 'LATEST' }] } });
  await second; const current = h.snapshot(); h.respond(0); await first;
  assert.deepEqual(h.snapshot(), current); assert.equal(h.calls.filter(x => x.kind === 'replace').length, 1);
});
test('whole-book backend refusal and an already dirty Flow keep the complete authoring state', async () => {
  const h = await rendererHarness(); const before = h.snapshot(), pending = h.open();
  h.replies[0]({ ok: false, error: { code: 'READ_REFUSED' } }); await pending;
  assert.deepEqual(h.snapshot(), before); assert.equal(h.calls.some(x => x.kind === 'replace'), false);
  h.context.flowModeState.active = true; h.context.flowModeState.dirty = true;
  const dirty = h.snapshot(), count = h.calls.length; await h.open();
  assert.deepEqual(h.snapshot(), dirty); assert.equal(h.calls.length, count);
});
// Reuse the maintained full-Main fixture, without registering its tests or
// replacing any production decision. Only its existing owned native adapters
// and a private read-only test export are used; real Core/Kernel/FS execute.
const fixturePath = path.join(ROOT, 'test/contracts/rtk-word-scene-identity-main.contract.test.js');
const fixtureText = fs.readFileSync(fixturePath, 'utf8');
const firstTest = fixtureText.indexOf('\ntest('); assert.ok(firstTest > 0);
const initializer = fixtureText.slice(0, firstTest); const anchor = 'module.exports.__probe = {';
assert.equal(initializer.split(anchor).length, 2);
const fixtureModule = new Module(fixturePath, module); fixtureModule.filename = fixturePath;
fixtureModule.paths = Module._nodeModulePaths(path.dirname(fixturePath));
fixtureModule._compile(initializer.replace(anchor, anchor + '\n    flowOpen: handleFlowOpenV1,')
  + '\n' + productionFunction(fixtureText, 'mountRenderer')
  + '\nmodule.exports = { fixture, mountRenderer };', fixturePath);
const { fixture, mountRenderer } = fixtureModule.exports;
function projectFiles(root) {
  const result = {};
  const visit = relative => {
    const target = path.join(root, relative), st = fs.lstatSync(target);
    assert.equal(st.isSymbolicLink(), false);
    if (st.isDirectory()) { for (const name of fs.readdirSync(target).sort()) visit(path.join(relative, name)); return; }
    const bytes = fs.readFileSync(target); result[relative] = { bytes: bytes.length, sha256: sha(bytes), base64: bytes.toString('base64') };
  };
  visit(''); return result;
}
async function registeredBookPort(f) {
  const { createCommandRegistry } = await import(pathToFileURL(path.join(ROOT, 'src/renderer/commands/registry.mjs')).href);
  const { createCommandRunner } = await import(pathToFileURL(path.join(ROOT, 'src/renderer/commands/runCommand.mjs')).href);
  const { registerProjectCommands } = await import(pathToFileURL(path.join(ROOT, 'src/renderer/commands/projectCommands.mjs')).href);
  const { runCommandThroughBus } = await import(pathToFileURL(path.join(ROOT, 'src/renderer/commands/commandBusGuard.mjs')).href);
  const registry = createCommandRegistry(), requests = [];
  registerProjectCommands(registry, { electronAPI: { invokeUiCommandBridge: async envelope => {
    requests.push(plain(envelope)); assert.equal(envelope.route, 'command.bus');
    return f.probe.menuCommand(envelope.commandId, envelope.payload, { route: envelope.route });
  } } });
  const runner = createCommandRunner(registry);
  return { requests, dispatch: (id, payload = {}) => runCommandThroughBus(runner, id, payload, { route: 'command.bus' }) };
}
test('actual registered book read preserves canonical two-scene order and all source bytes', async t => {
  const f = await fixture(t); mountRenderer(f, 'Beta', 0); const port = await registeredBookPort(f), before = projectFiles(f.root);
  const result = await port.dispatch('cmd.project.flowOpenV1');
  assert.equal(result.ok, true, JSON.stringify(result));
  const existing = result.value.scenes.filter(x => x.kind === 'scene');
  assert.deepEqual(existing.map(x => x.content), ['Alpha', 'Beta']);
  assert.deepEqual(existing.map(x => x.nodeId), [f.a.nodeId, f.b.nodeId]);
  assert.equal(result.value.scenes.length, 9);
  assert.deepEqual(result.value.scenes.slice(0, 7).map(x => [x.kind, x.content, x.missing, x.partial, x.baselineHash]),
    Array.from({ length: 7 }, () => ['roman-section', '', true, true, '']));
  assert.deepEqual(projectFiles(f.root), before, 'A book query must never save, rewrite, or discard scene data');
  assert.equal(port.requests.length, 1);
});
test('actual Main dirty book read refuses without writing or claiming an obsolete saved version', async t => {
  const f = await fixture(t); mountRenderer(f, 'Beta 😀 e\u0301 UNSAVED', 1); f.probe.state({ dirty: true });
  const before = projectFiles(f.root), port = await registeredBookPort(f);
  const result = await port.dispatch('cmd.project.flowOpenV1');
  assert.equal(result.ok, false, 'Read-only book query cannot silently replace an unsaved scene');
  assert.deepEqual(projectFiles(f.root), before); assert.equal(f.probe.state().dirty, true);
});
for (const drift of ['typing', 'project', 'document', 'session', 'owner', 'window']) {
  test('actual Main source read rejects late ' + drift + ' context and preserves all original files', async t => {
    const f = await fixture(t); mountRenderer(f, 'Beta', 0); const before = projectFiles(f.root), port = await registeredBookPort(f);
    const original = fsp.readFile; let reached = false;
    fsp.readFile = async function (target, ...args) {
      const bytes = await original.call(this, target, ...args);
      if (!reached && String(target) === f.alpha) {
        reached = true;
        if (drift === 'typing') f.probe.state({ generation: 1, dirty: true });
        if (drift === 'project') f.probe.state({ projectName: 'Other' });
        if (drift === 'document') f.probe.replaceDocument(f.alpha);
        if (drift === 'session') f.probe.changeSession();
        if (drift === 'owner') f.probe.replaceTreeQueryOwner();
        if (drift === 'window') f.probe.state({ window: null });
      }
      return bytes;
    };
    t.after(() => { fsp.readFile = original; });
    const result = await port.dispatch('cmd.project.flowOpenV1');
    assert.equal(reached, true, 'The unchanged production file read must reach the injected boundary');
    assert.equal(result.ok, false, 'A stale book source must never be published as current');
    assert.deepEqual(projectFiles(f.root), before);
  });
}
test('actual registered dirty-scene Save then book open preserves Unicode and exact source order', async t => {
  const f = await fixture(t), working = 'Beta 😀 e\u0301 UNSAVED';
  mountRenderer(f, working, 1); f.probe.state({ dirty: true });
  const port = await registeredBookPort(f), h = await rendererHarness({ currentProjectId: f.query.projectId,
    currentDocumentId: f.b.nodeId, localDirty: true, localEditGeneration: 1, lastAckedGeneration: 0, text: working });
  h.context.dispatchUiCommand = async (id, payload) => { h.calls.push({ kind: 'command', id }); return port.dispatch(id, payload); };
  await h.open();
  assert.equal(h.context.flowModeState.active, true);
  assert.equal(fs.readFileSync(f.alpha, 'utf8'), 'Alpha');
  assert.equal(fs.readFileSync(f.beta, 'utf8'), working, 'Only the real canonical Save can persist the unsaved scene');
  assert.deepEqual(h.context.flowModeState.scenes.filter(x => x.kind === 'scene').map(x => x.content), ['Alpha', working]);
  assert.equal(h.context.flowModeState.scenes.length, 9);
  assert.deepEqual(h.context.flowModeState.scenes.slice(0, 7).map(x => [x.kind, x.content, x.missing, x.partial, x.baselineHash]),
    Array.from({ length: 7 }, () => ['roman-section', '', true, true, '']));
  assert.deepEqual(h.calls.filter(x => x.kind === 'command').map(x => x.id), ['cmd.project.save', 'cmd.project.flowOpenV1']);
  assert.equal(f.probe.state().dirty, false); assert.equal(h.context.lastAckedGeneration, 1);
});

for (const pending of ['commentAuthoringPending', 'manuscriptNoteAuthoringPending']) {
  test('actual Main book transition retains pending ' + pending + ' without source or storage mutation', async t => {
    const f = await fixture(t); mountRenderer(f, 'Beta', 0, null, { [pending]: true });
    const before = projectFiles(f.root), port = await registeredBookPort(f);
    const result = await port.dispatch('cmd.project.flowOpenV1');
    assert.equal(result.ok, false, 'A pending authoring draft must be retained before replacing the editor view');
    assert.deepEqual(projectFiles(f.root), before);
  });
}

test('actual registered book read uses the selected named project and never the default novel', async t => {
  const f = await fixture(t), name = 'Выбранная книга 😀';
  const selected = path.join(path.dirname(f.root), name), imported = path.join(selected, 'roman', 'Imported');
  fs.mkdirSync(imported, { recursive: true });
  const one = path.join(imported, '01_First.txt'), two = path.join(imported, '02_Second.txt');
  fs.writeFileSync(one, 'SELECTED_ONLY 😀 e\u0301'); fs.writeFileSync(two, 'SELECTED_SECOND');
  await f.main.buildProjectTreeRootsWithIdentities(name);
  mountRenderer(f, 'SELECTED_SECOND', 0); f.probe.state({ projectName: name, filePath: two });
  const defaultBefore = projectFiles(f.root), selectedBefore = projectFiles(selected), port = await registeredBookPort(f);
  const result = await port.dispatch('cmd.project.flowOpenV1');
  assert.equal(result.ok, true, JSON.stringify(result));
  const scenes = result.value.scenes.filter(x => x.kind === 'scene');
  assert.deepEqual(scenes.map(x => x.content), ['SELECTED_ONLY 😀 e\u0301', 'SELECTED_SECOND']);
  assert.deepEqual(scenes.map(x => x.path), [one, two]);
  const identities = JSON.parse(fs.readFileSync(path.join(selected, 'project.craftsman.json'), 'utf8')).treeIdentity.nodes;
  const expected = [one, two].map(file => {
    const sceneId = path.relative(selected, file).split(path.sep).join('/');
    const nodeId = Object.keys(identities).find(id => identities[id].present !== false && identities[id].bindingKey === `file:${sceneId}`);
    assert.match(nodeId, /^tree-node-[a-f0-9]{32}$/u);
    return { sceneId, nodeId };
  });
  assert.deepEqual(scenes.map(({ sceneId, nodeId }) => ({ sceneId, nodeId })), expected,
    'Every source return must carry selected-project canonical identities, not only the correct visible text');
  assert.deepEqual(projectFiles(f.root), defaultBefore); assert.deepEqual(projectFiles(selected), selectedBefore);
});

test('actual registered book identities cannot alias the default project with identical relative source names', async t => {
  const f = await fixture(t), name = 'Другая книга с теми же именами';
  const selected = path.join(path.dirname(f.root), name), imported = path.join(selected, 'roman', 'Imported');
  fs.mkdirSync(imported, { recursive: true });
  const files = [f.alpha, f.beta].map(file => path.join(imported, path.basename(file)));
  files.forEach((file, index) => fs.writeFileSync(file, `OTHER_PROJECT_${index} 😀 e\u0301`));
  await f.main.buildProjectTreeRootsWithIdentities(name);
  const identities = JSON.parse(fs.readFileSync(path.join(selected, 'project.craftsman.json'), 'utf8')).treeIdentity.nodes;
  mountRenderer(f, fs.readFileSync(files[1], 'utf8'), 0); f.probe.state({ projectName: name, filePath: files[1] });
  const defaultBefore = projectFiles(f.root), selectedBefore = projectFiles(selected), port = await registeredBookPort(f);
  const result = await port.dispatch('cmd.project.flowOpenV1'); assert.equal(result.ok, true, JSON.stringify(result));
  const scenes = result.value.scenes.filter(x => x.kind === 'scene');
  const expected = files.map(file => {
    const sceneId = path.relative(selected, file).split(path.sep).join('/');
    const nodeId = Object.keys(identities).find(id => identities[id].present !== false && identities[id].bindingKey === `file:${sceneId}`);
    assert.match(nodeId, /^tree-node-[a-f0-9]{32}$/u); assert.notEqual(nodeId, f.a.nodeId); assert.notEqual(nodeId, f.b.nodeId);
    return { sceneId, nodeId, content: fs.readFileSync(file, 'utf8') };
  });
  assert.deepEqual(scenes.map(({ sceneId, nodeId, content }) => ({ sceneId, nodeId, content })), expected);
  assert.deepEqual(projectFiles(f.root), defaultBefore); assert.deepEqual(projectFiles(selected), selectedBefore);
});

// Save uses the same real renderer functions and complete Main/Kernel fixture.
async function saveRenderer(scenes, overrides = {}) {
  const flow = await import(pathToFileURL(path.join(ROOT, 'src/renderer/commands/flowMode.mjs')).href);
  const projection = flow.composeFlowReadProjection(scenes);
  const h = await rendererHarness({ flowModeSaveRequest: null, localDirty: true,
    localEditGeneration: 8, lastAckedGeneration: 7, text: projection.text.replace(/Beta\n$/u, 'Beta EDITED 😀 e\u0301\n'),
    flowModeState: { active: true, dirty: true, scenes, projection },
    FLOW_SAVE_ERROR_MESSAGE: 'Save unavailable', updateSaveStateText() {}, updateInspectorSnapshot() {}, ...overrides });
  h.context.COMMAND_IDS.PROJECT_FLOW_SAVE_V1 = 'cmd.project.flowSaveV1';
  vm.runInContext(['runFlowSaveCommand', 'handleFlowModeSaveUiPath'].map(n => productionFunction(source(), n)).join('\n'), h.context);
  h.save = () => h.context.handleFlowModeSaveUiPath();
  h.respondSave = (index, mutate = x => x) => {
    const payload = h.calls.filter(x => x.id === 'cmd.project.flowSaveV1')[index].payload;
    const rows = payload.scenes.map((s, i) => ({ ...s, title: scenes[i].title, kind: scenes[i].kind,
      baselineHash: sha(s.content), missing: false, partial: false }));
    rows.forEach(s => { delete s.path; });
    const entries = payload.scenes.map(s => ({ sceneId: s.sceneId, nodeId: s.nodeId,
      baselineHashBefore: s.baselineHash, contentHashAfter: sha(s.content), bytesWritten: Buffer.byteLength(s.content) }));
    h.replies[index](mutate({ ok: true, value: { saved: true, savedCount: rows.length, scenes: rows,
      receipt: { operation: 'flow.batch.save.v1', committed: true, markerCleared: true, savedCount: rows.length,
        scenes: entries, ack: { kind: 'SAVED', savedGeneration: 8, latestEditGeneration: 8, receiptKind: 'FLOW_BATCH_DURABLE_V2' },
        durable: { schemaVersion: 'yalken.flow-batch.save-receipt.v2', success: true, committed: true, markerCleared: true,
          revision: 8, entries, sceneCount: rows.length } } } }));
  };
  return h;
}
const saveRefs = () => ['Alpha', 'Beta'].map((title, i) => ({ path: '/owned/' + title + '.txt', title,
  sceneId: 'roman/' + title + '.txt', nodeId: 'tree-node-' + String(i + 1).repeat(32),
  baselineHash: sha(title), content: title, kind: 'scene' }));
test('only the matching clean book reply publishes saved state and current inspector', async () => {
  for (const drift of ['none', 'typing', 'project']) {
    const states = []; let inspected = 0;
    const h = await saveRenderer(saveRefs(), { updateSaveStateText: s => states.push(s), updateInspectorSnapshot: () => inspected++ });
    const pending = h.save();
    if (drift === 'typing') { h.context.text += ' LATE'; h.context.localEditGeneration++; }
    if (drift === 'project') h.context.currentProjectId = 'other-project';
    h.respondSave(0); await pending;
    assert.equal(states.includes('saved'), drift === 'none');
    assert.equal(inspected > 0, drift !== 'project');
  }
});
test('whole-book pathless Save response retains canonical paths for the second actual Save intent', async () => {
  const h = await saveRenderer(saveRefs()), pending = h.save(); h.respondSave(0); await pending;
  assert.equal(h.context.localDirty, false); assert.equal(h.context.lastAckedGeneration, 8);
  assert.deepEqual(h.context.flowModeState.scenes.map(s => s.path), saveRefs().map(s => s.path));
  h.context.text += 'NEXT'; h.context.localEditGeneration++; h.context.localDirty = true;
  h.context.flowModeState = { ...h.context.flowModeState, dirty: true };
  const second = h.save(); assert.equal(h.replies.length, 2, 'Refreshed pathless rows must not strand the next edit');
  h.replies[1]({ ok: false }); await second;
});
for (const drift of ['typing', 'project', 'document', 'publication', 'flow-instance']) {
  test('whole-book Save response cannot acknowledge newer ' + drift + ' authoring', async () => {
    const h = await saveRenderer(saveRefs()), pending = h.save(); assert.equal(h.replies.length, 1);
    if (drift === 'typing') { h.context.text += ' NEW'; h.context.localEditGeneration++;
      h.context.flowModeState = { ...h.context.flowModeState, dirty: true }; }
    if (drift === 'project') h.context.currentProjectId = 'project-b';
    if (drift === 'document') h.context.currentDocumentId = 'scene-b';
    if (drift === 'publication') h.context.currentTreeContentPublicationId = 'publication-b';
    if (drift === 'flow-instance') h.context.flowModeState = { active: false, dirty: true, scenes: [], projection: null };
    const current = h.snapshot(); h.respondSave(0); await pending;
    const after = h.snapshot();
    for (const key of ['text', 'selection', 'undo', 'dirty', 'generation', 'ack', 'project', 'document', 'publication'])
      assert.deepEqual(after[key], current[key], key);
    if (drift !== 'typing') assert.deepEqual(after.flow, current.flow);
    else { assert.equal(after.flow.dirty, true); assert.equal(after.flow.scenes[1].baselineHash,
      sha(h.calls.find(x => x.id === 'cmd.project.flowSaveV1').payload.scenes[1].content)); }
    assert.equal(h.calls.some(x => x.kind === 'signal'), false);
  });
}
test('whole-book Save serializes duplicate intent and refuses malformed or uncommitted acknowledgements', async () => {
  for (const mutate of [x => ({ ok: false }), x => ({ ...x, value: { ...x.value, cancelled: true } }),
    x => { x.value.receipt.committed = false; return x; }, x => { x.value.scenes.pop(); return x; },
    x => { x.value.receipt.ack.savedGeneration = 9; return x; }, x => { x.value.receipt = null; return x; }]) {
    const h = await saveRenderer(saveRefs()), before = h.snapshot(), pending = h.save();
    const duplicate = h.save(); assert.equal(h.replies.length, 1, 'Only one Save may own the response');
    h.respondSave(0, mutate); await Promise.all([pending, duplicate]); assert.deepEqual(h.snapshot(), before);
  }
});
async function bookFixture(t, name = 'Роман', makeFixture = fixture) {
  const f = await makeFixture(t), selected = path.join(path.dirname(f.root), name);
  if (name !== 'Роман') { fs.mkdirSync(path.join(selected, 'roman', 'Imported'), { recursive: true });
    for (const file of [f.alpha, f.beta]) fs.writeFileSync(path.join(selected, 'roman', 'Imported', path.basename(file)), path.basename(file).includes('Alpha') ? 'Alpha' : 'Beta'); }
  await f.main.buildProjectTreeRootsWithIdentities(name); mountRenderer(f, 'Beta');
  f.probe.state({ projectName: name, filePath: path.join(selected, 'roman', 'Imported', path.basename(f.beta)) });
  const port = await registeredBookPort(f); let read = await port.dispatch('cmd.project.flowOpenV1'); assert.equal(read.ok, true);
  for (const s of read.value.scenes.filter(s => s.missing)) fs.writeFileSync(s.path, 'Owned section ' + s.title);
  await f.main.buildProjectTreeRootsWithIdentities(name); read = await port.dispatch('cmd.project.flowOpenV1'); assert.equal(read.ok, true);
  assert.equal(read.value.scenes.length, 9); assert.equal(read.value.scenes.some(s => s.partial), false);
  const manifest = JSON.parse(fs.readFileSync(path.join(selected, 'project.craftsman.json'), 'utf8'));
  const h = await saveRenderer(read.value.scenes, { currentProjectId: manifest.projectId,
    currentDocumentId: read.value.scenes.at(-1).nodeId });
  const envelope = await import(pathToFileURL(path.join(ROOT, 'src/renderer/documentContentEnvelope.mjs')).href);
  Object.assign(h.context, { isTiptapMode: true, centralSheetStripLargePayloadFastPathActive: false,
    composeObservablePayload: envelope.composeObservablePayload, getPlainText: () => h.context.text,
    getTiptapDocumentSnapshot: () => ({ text: h.context.text, doc: { type: 'doc', content: h.context.text.trimEnd().split('\n')
      .map(text => ({ type: 'paragraph', ...(text ? { content: [{ type: 'text', text }] } : {}) })) } }),
    metaEnabled: false, currentMeta: {}, currentCards: [], getActiveBookProfile: () => null,
    getSelectionOffsets: () => ({ start: 2, end: 5 }), getTiptapImageInsertionPosition: () => null,
    getTiptapRootSplitBoundary: () => null, getTiptapCommentEditIntentsJson: () => null });
  vm.runInContext(['composeDocumentContent', 'composeEditorSnapshot'].map(n => productionFunction(source(), n)).join('\n'), h.context);
  const snapshot = () => plain(h.context.composeEditorSnapshot());
  const mounted = mountRenderer(f, () => snapshot().content, () => h.context.localEditGeneration, null, snapshot);
  f.probe.state({ projectName: name, filePath: read.value.scenes.at(-1).path, dirty: true });
  h.context.dispatchUiCommand = (id, payload) => { h.calls.push({ kind: 'command', id, payload }); return port.dispatch(id, payload); };
  return { f, h, port, selected, mounted, snapshot };
}
for (const name of ['Роман', 'SELECTED_SAVE_😀']) {
  test('complete registered ' + name + ' book Save and repeated Save bind real durable bytes and Main ACK', async t => {
    const { f, h, selected } = await bookFixture(t, name), beforeDefault = projectFiles(f.root);
    await h.save(); assert.equal(h.context.localDirty, false); assert.equal(f.probe.state().dirty, false);
    assert.equal(h.context.lastAckedGeneration, 8);
    const target = path.join(selected, 'roman', 'Imported', path.basename(f.beta));
    assert.equal(fs.readFileSync(target, 'utf8'), h.calls.filter(x => x.id === 'cmd.project.flowSaveV1').at(-1).payload.scenes.at(-1).content);
    assert.equal(require('../../src/core/document-content-envelope-v1.cjs').parseObservablePayload(fs.readFileSync(target, 'utf8')).text, 'Beta EDITED 😀 e\u0301');
    h.context.text = h.context.text.replace('EDITED', 'TWICE'); h.context.localEditGeneration++;
    h.context.flowModeState = { ...h.context.flowModeState, dirty: true }; h.context.localDirty = true;
    f.probe.state({ generation: 9, dirty: true }); await h.save();
    assert.equal(h.context.localDirty, false); assert.equal(f.probe.state().dirty, false); assert.equal(h.context.lastAckedGeneration, 9);
    assert.equal(fs.readFileSync(target, 'utf8'), h.calls.filter(x => x.id === 'cmd.project.flowSaveV1').at(-1).payload.scenes.at(-1).content);
    assert.equal(require('../../src/core/document-content-envelope-v1.cjs').parseObservablePayload(fs.readFileSync(target, 'utf8')).text, 'Beta TWICE 😀 e\u0301');
    if (name !== 'Роман') assert.deepEqual(projectFiles(f.root), beforeDefault);
  });
}
for (const action of ['autosave', 'save', 'backup']) {
  test('actual composed book snapshot cannot enter ordinary scene ' + action, async t => {
    const { f, snapshot } = await bookFixture(t), before = projectFiles(f.root);
    assert.ok(snapshot().plainText.includes('Alpha')); await f.probe[action]();
    await f.probe.queue(() => Promise.resolve(), 'book refusal barrier');
    assert.deepEqual(projectFiles(f.root), before, 'Derived book text must never replace a single source scene');
    assert.equal(f.probe.state().dirty, true);
  });
}
for (const drift of ['typing', 'project', 'document', 'session', 'owner', 'window', 'baseline']) {
  test('actual queued book write refuses changed ' + drift + ' before effect', async t => {
    const { f, h } = await bookFixture(t), before = projectFiles(f.root);
    const resume = f.probe.captureQueued('save flow scene batch'); await h.save();
    if (drift === 'typing') f.probe.state({ generation: 9, dirty: true });
    if (drift === 'project') f.probe.state({ projectName: 'Other' });
    if (drift === 'document') f.probe.replaceDocument(f.alpha);
    if (drift === 'session') f.probe.changeSession();
    if (drift === 'owner') f.probe.replaceTreeQueryOwner();
    if (drift === 'window') f.probe.state({ window: null });
    if (drift === 'baseline') fs.writeFileSync(f.alpha, 'EXTERNAL NEW SOURCE');
    const expected = projectFiles(f.root);
    await assert.rejects(resume(), drift === 'baseline' ? /FLOW_BATCH_SOURCE_BASELINE_CHANGED/u : /M7_FLOW_CONTEXT_STALE/u);
    assert.deepEqual(projectFiles(f.root), expected, 'Captured callback has no authority after its source changes');
    if (drift !== 'baseline') assert.deepEqual(expected, before);
  });
}
test('unchanged captured book callback still performs the real complete durable batch', async t => {
  const { f, h } = await bookFixture(t), resume = f.probe.captureQueued('save flow scene batch');
  await h.save(); const result = await resume(); assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.value.receipt.success, true); assert.equal(result.value.receipt.sceneCount, 9);
  for (const s of h.calls.at(-1).payload.scenes) assert.equal(fs.readFileSync(s.path, 'utf8'), s.content);
});
test('generic delayed book ACK cannot clear another renderer view with the same generation', async () => {
  const h = await saveRenderer(saveRefs()), text = source(), start = text.indexOf('window.electronAPI.onSetDirty((message) => {');
  const end = text.indexOf('\n  });', start); assert.ok(start > 0 && end > start);
  const callback = text.slice(start + 'window.electronAPI.onSetDirty('.length, end) + '\n  }';
  h.context.incoming = { state: false, ack: { kind: 'SAVED', savedGeneration: 8, receiptKind: 'FLOW_BATCH_DURABLE_V2' } };
  h.context.currentProjectId = 'new-project'; const before = h.snapshot();
  vm.runInContext('(' + callback + ')(incoming)', h.context); assert.deepEqual(h.snapshot(), before);
});
test('actual Main snapshot decoder refuses missing authoring bytes and invalid book-mode shapes', async t => {
  const f = await fixture(t); assert.equal(f.probe.normalizeSnapshot('').content, '');
  for (const value of [null, [], {}, { content: 'Keep', generation: 0, flowModeActive: 'true' }])
    assert.throws(() => f.probe.normalizeSnapshot(value), /SNAPSHOT_.*INVALID/u);
});
function lifecycleBookFixtureFactory() {
  const m = new Module(fixturePath, module); m.filename = fixturePath;
  m.paths = Module._nodeModulePaths(path.dirname(fixturePath));
  m._compile(initializer.replace(anchor, anchor + '\n    confirmClose: confirmDiscardChanges,') + '\nmodule.exports = fixture;', fixturePath);
  return m.exports;
}
for (const mode of ['clean', 'dirty', 'newer-unreported', 'comment', 'note']) {
  test('actual saved-book lifecycle observation protects ' + mode + ' authoring without writing a scene', async t => {
    const { f, h } = await bookFixture(t, 'Роман', lifecycleBookFixtureFactory()); await h.save();
    assert.equal(h.context.localDirty, false); assert.equal(f.probe.state().dirty, false);
    if (['dirty', 'newer-unreported'].includes(mode)) { h.context.text += ' NEW 🧭'; h.context.localEditGeneration++;
      h.context.localDirty = true; h.context.flowModeState = { ...h.context.flowModeState, dirty: true };
      if (mode === 'dirty') f.probe.state({ generation: 9, dirty: true }); }
    if (mode === 'comment') h.context.wordCommentDraft = { text: 'Keep pending comment' };
    if (mode === 'note') h.context.manuscriptDrafts.set('pending', { body: 'Keep pending note' });
    const before = projectFiles(f.root), working = h.snapshot(), comment = h.context.wordCommentDraft, notes = [...h.context.manuscriptDrafts];
    let allowed;
    try { allowed = await f.probe.confirmClose(); }
    catch (error) { if (mode === 'clean') throw error; assert.match(error.message, /FLOW_SCENE_SNAPSHOT_FORBIDDEN/u); allowed = false; }
    assert.equal(allowed, mode === 'clean'); assert.deepEqual(projectFiles(f.root), before); assert.deepEqual(h.snapshot(), working);
    assert.equal(h.context.wordCommentDraft, comment); assert.deepEqual([...h.context.manuscriptDrafts], notes);
  });
}
for (const shape of ['native-empty-defaults', 'bold', 'unknown-null-attribute', 'changed-metadata', 'changed-cards']) {
  test('actual book snapshot ' + shape + ' is admitted only when it preserves the canonical plain book meaning', async t => {
    const { f, h } = await bookFixture(t), get = h.context.getTiptapDocumentSnapshot, before = projectFiles(f.root);
    h.context.getTiptapDocumentSnapshot = () => {
      const value = get(); value.doc.attrs = { wordPendingRevisions: null, wordUserBookmarks: null };
      value.doc.content.forEach(p => { p.attrs = { textAlign: null }; });
      if (shape === 'bold') value.doc.content[0].content[0].marks = [{ type: 'bold' }];
      if (shape === 'unknown-null-attribute') value.doc.attrs.unknown = null;
      return value;
    };
    if (shape === 'changed-metadata') { h.context.metaEnabled = true; h.context.currentMeta = { status: 'changed', tags: {}, synopsis: '' }; }
    if (shape === 'changed-cards') h.context.currentCards = [{ id: 'owned', title: 'New authoring', text: 'Keep' }];
    await h.save();
    if (shape === 'native-empty-defaults') {
      assert.equal(h.context.localDirty, false); assert.equal(f.probe.state().dirty, false);
      for (const s of h.calls.at(-1).payload.scenes) assert.equal(fs.readFileSync(s.path, 'utf8'), s.content);
    } else { assert.equal(h.context.localDirty, true); assert.equal(h.context.lastAckedGeneration, 7);
      assert.equal(f.probe.state().dirty, true); assert.deepEqual(projectFiles(f.root), before); }
  });
}
for (const fault of ['activation-context', 'batch-readback', 'main-readback', 'late-typing']) {
  test('actual book batch ' + fault + ' preserves source truth and never acknowledges unsaved text', async t => {
    const { f, h } = await bookFixture(t), before = projectFiles(f.root);
    const io = require('node:fs/promises'), read = io.readFile, rename = io.rename; let reached = false, observed = 0, response;
    const dispatch = h.context.dispatchUiCommand;
    h.context.dispatchUiCommand = async (...args) => { response = await dispatch(...args); return response; };
    io.rename = async function (from, to) {
      const result = await rename.call(this, from, to);
      if (fault === 'activation-context' && !reached && String(from).endsWith('.tmp') && String(to).includes('/roman/')) {
        reached = true; f.probe.state({ generation: 9, dirty: true });
      } return result;
    };
    io.readFile = async function (file, ...args) {
      const bytes = await read.call(this, file, ...args);
      if (String(file) === f.alpha && String(bytes) !== 'Alpha') {
        observed++;
        if (fault === 'batch-readback' && observed === 1) { reached = true; return Buffer.from('CORRUPT_READBACK'); }
        if (fault === 'main-readback' && observed === 2) { reached = true; throw Object.assign(Error('OWNED_MAIN_READBACK_EIO'), { code: 'EIO' }); }
        if (fault === 'late-typing' && observed === 1) { reached = true; h.context.text += ' NEWER';
          h.context.localEditGeneration++; h.context.flowModeState = { ...h.context.flowModeState, dirty: true };
          f.probe.state({ generation: 9, dirty: true }); }
      } return bytes;
    };
    t.after(() => { io.readFile = read; io.rename = rename; });
    const selection = plain(h.context.selection), undo = [...h.context.undo]; await h.save();
    assert.equal(reached, true); assert.equal(h.context.localDirty, true); assert.equal(h.context.lastAckedGeneration, 7);
    assert.equal(f.probe.state().dirty, true); assert.deepEqual(plain(h.context.selection), selection); assert.deepEqual(h.context.undo, undo);
    if (['activation-context', 'batch-readback'].includes(fault)) {
      assert.equal(response.ok, false); const after = projectFiles(f.root);
      for (const [name, bytes] of Object.entries(before)) assert.deepEqual(after[name], bytes, name);
      assert.equal(response.error.details.rollbackConfirmed, true); assert.equal(response.error.details.recoveryEvidenceConfirmed, true);
    } else {
      for (const s of h.calls.at(-1).payload.scenes) assert.equal(fs.readFileSync(s.path, 'utf8'), s.content);
      if (fault === 'main-readback') { assert.equal(response.ok, false); assert.equal(response.error.details.committed, true); }
      else { assert.equal(response.value.receipt.ack.kind, 'PROTECTED'); assert.ok(h.context.text.endsWith('NEWER'));
        assert.equal(h.context.flowModeState.scenes.at(-1).baselineHash, sha(h.calls.at(-1).payload.scenes.at(-1).content)); }
    }
  });
}
