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
  assert.deepEqual(projectFiles(f.root), defaultBefore); assert.deepEqual(projectFiles(selected), selectedBefore);
});
