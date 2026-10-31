'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const ROOT = path.resolve(__dirname, '../..');
const PORT = path.join(ROOT, 'src/main/environmentEpochPort.cjs');
const FILE = 'design-os-environment-epochs-v2.json';
const id = () => crypto.randomUUID();
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
function configuration(second = false) {
  return { schemaVersion: 'yalken.environmentConfiguration.v2', workspace: second ? 'REVIEW' : 'WRITE', shellMode: 'CALM_DOCKED', profile: 'BASELINE', keymap: 'NATIVE_V1',
    composition: { profile: 'minimal', toolbarIds: ['toolbar.font.family', second ? 'toolbar.history.redo' : 'toolbar.history.undo'], surfaces: ['navigator', 'editor', 'inspector'] },
    layout: { leftWidth: 290, rightWidth: 290, leftCollapsed: false, rightCollapsed: second, leftTab: 'project', rightTab: 'inspector',
      toolbar: { x: 24, y: 92, isVertical: false, isDetached: false, scale: 1, widthScale: 1, dockedWidthScale: 1, freeWidthScale: 1, toolbarHeight: 40 },
      leftToolbar: { x: 24, y: 24, isVertical: false, isDetached: false, widthScale: 1 }, toolbarOffsets: [], leftToolbarOffsets: [] },
    presentation: { theme: second ? 'dark' : 'light', wordWrap: !second, fontFamily: 'Georgia, serif', fontWeight: 'light', fontSize: 12, lineHeight: 1,
      viewMode: 'default', zoom: 1, compact: false, previewEnabled: false, previewFrame: false },
    window: { displayId: '1', x: 0, y: 0, width: 1440, height: 900, viewportWidth: 1440, viewportHeight: 872 } };
}
async function fixture(t) {
  assert.equal(fs.existsSync(PORT), true, 'full shell port must exist; existing Theme/Wrap port is insufficient');
  const { createFullEnvironmentEpochPort } = require(PORT);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'full-env-port-')), marker = id();
  fs.writeFileSync(path.join(root, '.owner'), marker); const identity = fs.statSync(root), projectId = id();
  const protectedPath = path.join(root, 'manuscript-protected.txt'), protectedBytes = Buffer.from('Current authoring N+1\n');
  fs.writeFileSync(protectedPath, protectedBytes); fs.writeFileSync(path.join(root, 'preset-inventory.json'), '{"named":"retain"}\n');
  const h = { root, projectId, formGeneration: 0, configuration: configuration(), stale: false, dirty: false, composing: false, pending: false,
    calls: [], validate: () => {}, afterOpen: null, beforeRename: null, afterRename: null };
  h.port = () => createFullEnvironmentEpochPort({ directory: root, projectId,
    assertCurrent: ({ requiresClean = false } = {}) => {
      if (h.stale) throw Object.assign(Error('stale'), { code: 'E_FULL_ENV_CONTEXT_STALE' });
      if (requiresClean && (h.dirty || h.composing || h.pending)) throw Object.assign(Error('save first'), { code: 'E_FULL_ENV_AUTHORING_BARRIER' });
    }, readLive: async () => ({ configuration: structuredClone(h.configuration), formGeneration: h.formGeneration,
      composing: h.composing, authoringPending: h.pending }), validateAvailability: config => h.validate(config),
    applyWindow: async config => h.calls.push(['window', structuredClone(config.window)]),
    fsAdapter: { ...fsp, open: async (...args) => { const handle = await fsp.open(...args);
      if (h.afterOpen) await h.afterOpen(...args); return handle; }, rename: async (from, to) => { if (h.beforeRename) await h.beforeRename(from, to);
      await fsp.rename(from, to); if (h.afterRename) await h.afterRename(from, to); } } });
  h.read = () => h.port().read();
  h.token = p => ({ version: 2, expectedRevision: p.revision, expectedStateDigest: p.stateDigest,
    expectedConfigurationGeneration: p.configurationGeneration, expectedFormGeneration: p.formGeneration });
  h.change = async (command, patch = {}) => { const p = await h.read(); return h.port().change(command, { ...h.token(p), ...patch }); };
  h.sync = () => h.change('COMMIT', { kind: 'SYNC_CURRENT' });
  h.raw = () => fs.readFileSync(path.join(root, FILE));
  t.after(() => {
    assert.deepEqual(fs.readFileSync(protectedPath), protectedBytes);
    assert.equal(fs.readFileSync(path.join(root, 'preset-inventory.json'), 'utf8'), '{"named":"retain"}\n');
    assert.equal(fs.readFileSync(path.join(root, '.owner'), 'utf8'), marker); assert.equal(fs.statSync(root).ino, identity.ino);
    fs.rmSync(root, { recursive: true });
  }); return h;
}

test('full ENV real port read/preview are write-free; current sync and A/B capture persist and independently decode', async t => {
  const h = await fixture(t), before = fs.readdirSync(h.root).sort();
  let p = await h.read(); assert.equal(p.revision, 0); assert.deepEqual(fs.readdirSync(h.root).sort(), before);
  assert.equal((await h.sync()).ok, true); assert.equal((await h.change('CAPTURE', { kind: 'EPOCH' })).ok, true);
  const first = JSON.parse(h.raw()).epochs[0]; assert.equal(first.configuration.workspace, 'WRITE');
  h.configuration = configuration(true); h.formGeneration++; assert.equal((await h.sync()).ok, true);
  assert.equal((await h.change('CAPTURE', { kind: 'EPOCH' })).ok, true); const raw = h.raw();
  p = await h.read(); assert.equal(p.epochs.length, 2); assert.deepEqual(h.raw(), raw);
  const m = await import(pathToFileURL(path.join(ROOT, 'src/renderer/design-os/designOsEnvironmentEpochs.mjs')).href);
  assert.deepEqual(m.decodeFullEnvironmentState(raw).epochs[0], first);
  assert.equal(p.epochs[1].configuration.workspace, 'REVIEW'); assert.equal(p.current.workspace, 'REVIEW');
  assert.equal((await h.sync()).performed, false, 'unchanged current sync cannot write another record'); assert.deepEqual(h.raw(), raw);
});

test('full ENV real profile choice uses existing restore and health, retaining epochs, named presets and current until ACK', async t => {
  const h = await fixture(t); await h.sync(); await h.change('CAPTURE', { kind: 'EPOCH' });
  await h.change('CAPTURE', { kind: 'PRESET', name: 'Keep original named preset' });
  const before = JSON.parse(h.raw()), a = before.epochs[0];
  const staged = await h.change('RESTORE', { source: { kind: 'PROFILE', id: 'COMPACT' } });
  assert.equal(staged.ok, true, JSON.stringify(staged)); assert.equal(staged.configuration.profile, 'COMPACT');
  assert.equal(staged.configuration.shellMode, 'COMPACT_DOCKED'); assert.equal(staged.configuration.presentation.compact, true);
  let raw = JSON.parse(h.raw()); assert.deepEqual(raw.projects[0].current, before.projects[0].current);
  assert.deepEqual(raw.epochs[0], a); assert.deepEqual(raw.presets, before.presets); assert.deepEqual(raw.epochs[1].source, { kind: 'PROFILE', id: 'COMPACT' });
  h.configuration = structuredClone(staged.configuration);
  assert.equal((await h.change('COMMIT', { kind: 'CONFIRM_APPLY', operationId: staged.operationId })).ok, true);
  assert.equal((await h.read()).current.profile, 'COMPACT');
  const old = await h.change('RESTORE', { source: { kind: 'EPOCH', id: a.epochId } }); assert.equal(old.ok, true);
  h.configuration = structuredClone(old.configuration); await h.change('COMMIT', { kind: 'CONFIRM_APPLY', operationId: old.operationId });
  raw = JSON.parse(h.raw()); assert.deepEqual(raw.projects[0].current, a.configuration); assert.deepEqual(raw.presets, before.presets);
});

test('full ENV profile intent rejects unsupported/opaque sources before effects and reaches authoring/context guards for valid profiles', async t => {
  const h = await fixture(t); await h.sync(); const p = await h.read(), before = h.raw();
  let getterReads = 0; const hostile = { kind: 'PROFILE' };
  Object.defineProperty(hostile, 'id', { enumerable: true, get() { getterReads++; throw Error('MUST_NOT_EVALUATE_EXTERNAL_ID'); } });
  for (const source of [{ kind: 'PROFILE', id: 'SAFE' }, { kind: 'PROFILE', id: 'UNKNOWN' },
    { kind: 'PROFILE', id: 'FOCUS', configuration: configuration(true) }, { kind: 'PROFILE', id: { path: '/outside' } }, hostile]) {
    const result = await h.port().change('RESTORE', { ...h.token(p), source });
    assert.equal(result.ok, false); assert.equal(result.error.code, 'E_FULL_ENV_PAYLOAD_INVALID'); assert.deepEqual(h.raw(), before); assert.equal(h.calls.length, 0);
  }
  assert.equal(getterReads, 0);
  for (const field of ['dirty', 'composing', 'pending', 'stale']) {
    h[field] = true;
    const result = await h.port().change('RESTORE', { ...h.token(p), source: { kind: 'PROFILE', id: 'FOCUS' } }); h[field] = false;
    assert.equal(result.ok, false); assert.match(result.error.code, /AUTHORING_BARRIER|CONTEXT_STALE/u, field);
    assert.deepEqual(h.raw(), before); assert.equal(h.calls.length, 0);
  }
});

test('full ENV real port stage/health/cold recovery keeps old usable form and original named presets', async t => {
  const h = await fixture(t); await h.sync(); await h.change('CAPTURE', { kind: 'EPOCH' });
  await h.change('CAPTURE', { kind: 'PRESET', name: 'Current named preset' });
  const sourceId = JSON.parse(h.raw()).epochs[0].epochId, presets = JSON.stringify(JSON.parse(h.raw()).presets);
  h.configuration = configuration(true); h.formGeneration++; await h.sync();
  const result = await h.change('RESTORE', { source: { kind: 'EPOCH', id: sourceId } });
  assert.equal(result.ok, true, JSON.stringify(result)); assert.ok(result.operationId); assert.equal(h.calls.length, 1);
  let p = await h.read(); assert.equal(p.current.workspace, 'REVIEW'); assert.equal(p.pending.configuration.workspace, 'WRITE');
  assert.equal(JSON.stringify(JSON.parse(h.raw()).presets), presets);
  const wrong = await h.change('COMMIT', { kind: 'CONFIRM_APPLY', operationId: result.operationId });
  assert.equal(wrong.ok, false); assert.equal((await h.read()).current.workspace, 'REVIEW');
  h.configuration = configuration(); h.formGeneration++;
  assert.equal((await h.change('COMMIT', { kind: 'CONFIRM_APPLY', operationId: result.operationId })).ok, true);
  p = await h.read(); assert.equal(p.current.workspace, 'WRITE'); assert.equal(p.lastStable.workspace, 'REVIEW'); assert.equal(p.pending, null);
  assert.equal(JSON.stringify(JSON.parse(h.raw()).presets), presets); assert.equal(p.epochs.length, 2);
});

for (const refusal of ['dirty', 'composing', 'pending', 'stale', 'missing-display', 'missing-contribution'])
  test('full ENV real port refuses before publication: ' + refusal, async t => {
    const h = await fixture(t); await h.sync(); await h.change('CAPTURE', { kind: 'EPOCH' });
    const p = await h.read(), before = h.raw(), token = h.token(p), source = { kind: 'EPOCH', id: p.epochs[0].epochId };
    if (refusal.startsWith('missing')) h.validate = () => { throw Object.assign(Error(refusal), { code: 'E_FULL_ENV_' + refusal.toUpperCase().replaceAll('-', '_') }); };
    else h[refusal] = true;
    const result = await h.port().change('RESTORE', { ...token, source });
    assert.equal(result.ok, false); assert.deepEqual(h.raw(), before); assert.equal(h.calls.length, 0);
  });

test('full ENV real port stale CAS, malformed payload, corrupt source and symlink never repair or touch another file', async t => {
  const h = await fixture(t); await h.sync(); const p = await h.read(), before = h.raw();
  for (const patch of [{ expectedRevision: 999 }, { expectedConfigurationGeneration: 999 }, { expectedFormGeneration: 999 }, { path: '/tmp/no' }, { version: 999 }]) {
    const result = await h.port().change('CAPTURE', { ...h.token(p), kind: 'EPOCH', ...patch });
    assert.equal(result.ok, false); assert.deepEqual(h.raw(), before);
  }
  const fixed = path.join(h.root, FILE); fs.writeFileSync(fixed, '{"corrupt":true}\n');
  await assert.rejects(h.read(), error => /^E_FULL_ENV_/u.test(error.code)); assert.equal(fs.readFileSync(fixed, 'utf8'), '{"corrupt":true}\n');
  fs.unlinkSync(fixed); fs.symlinkSync(path.join(h.root, 'preset-inventory.json'), fixed);
  await assert.rejects(h.read(), error => /^E_FULL_ENV_/u.test(error.code)); fs.unlinkSync(fixed);
});

test('full ENV real port concurrent source write and post-rename failure preserve actual bytes and truthful partial state', async t => {
  const h = await fixture(t); await h.sync(); const original = h.raw(), p = await h.read();
  const concurrent = Buffer.from(original.toString().replace('"revision":1', '"revision":99'));
  h.afterOpen = async target => { if (target.includes('.p2-')) fs.writeFileSync(path.join(h.root, FILE), concurrent); };
  const rejected = await h.port().change('CAPTURE', { ...h.token(p), kind: 'EPOCH' });
  assert.equal(rejected.ok, false); assert.deepEqual(h.raw(), concurrent, 'guard must repeat after actual temporary-open await before rename');
  h.afterOpen = null; fs.writeFileSync(path.join(h.root, FILE), original);
  h.afterRename = async () => { throw Object.assign(Error('actual after-rename failure'), { code: 'SYNTHETIC_POST_RENAME_FAULT' }); };
  const partial = await h.change('CAPTURE', { kind: 'EPOCH' });
  assert.equal(partial.ok, false); assert.equal(partial.error.code, 'E_FULL_ENV_PARTIAL');
  assert.equal(partial.error.details.storageWritten, true); assert.equal(partial.error.details.applyAllowed, false);
  assert.equal(JSON.parse(h.raw()).epochs.length, 1); assert.notEqual(digest(h.raw()), digest(original));
  assert.equal(h.calls.length, 0);
});


async function fullEnvironmentSyncRaceFixture(t) {
  const h = await fixture(t), vm = require('node:vm');
  const { createFullEnvironmentEpochPort } = require(PORT);
  let serial = 0; const notices = [], dispatches = [];
  h.port = () => {
    const capturedSerial = serial;
    return createFullEnvironmentEpochPort({ directory: h.root, projectId: h.projectId,
      assertCurrent: () => { if (serial !== capturedSerial) throw Object.assign(Error('stale'), { code: 'E_FULL_ENV_CONTEXT_STALE' }); },
      readLive: async () => ({ configuration: structuredClone(h.configuration), formGeneration: h.formGeneration,
        composing: h.composing, authoringPending: h.pending }), validateAvailability: async () => {}, applyWindow: async () => {},
      fsAdapter: { ...fsp, open: async (...args) => { const handle = await fsp.open(...args);
        if (h.afterOpen) await h.afterOpen(...args); return handle; } } });
  };
  assert.equal((await h.sync()).ok, true);
  const host = vm.createContext({ fullEnvironmentSyncPromise: null, fullEnvironmentSyncWanted: false,
    fullEnvironmentSyncRequest: null, fullEnvironmentFormGeneration: 0, fullEnvironmentLastSignal: Promise.resolve(),
    fullEnvironmentView: null, fullEnvironmentProjecting: false, fullEnvironmentComposing: false, legacyCompositionActive: false,
    currentProjectId: h.projectId, currentDocumentId: 'owned-scene', currentTreeContentPublicationId: 'owned-publication', localEditGeneration: 0,
    fullEnvironmentReadyProject: h.projectId, floatingToolbarInteractionState: { active: false },
    leftFloatingToolbarInteractionState: { active: false }, toolbarItemOffsetDragState: { active: false },
    leftToolbarButtonOffsetDragState: { active: false }, spatialResizeDragState: null,
    window: { electronAPI: { invokeSaveLifecycleSignalBridge() {} } }, queueMicrotask,
    invokeSaveLifecycleSignalBridge: async (_signal, value) => { serial++; h.formGeneration = value.generation; return {}; },
    readFullEnvironmentProjection: () => h.port().read(),
    EXTRA_COMMAND_IDS: { ENVIRONMENT_CONFIGURATION_COMMIT: 'cmd.project.view.commitEnvironmentConfiguration' },
    dispatchFullEnvironment: async (_command, value) => {
      dispatches.push(JSON.parse(JSON.stringify(value)));
      const result = await h.port().change('COMMIT', JSON.parse(JSON.stringify(value)));
      if (!result.ok) throw Object.assign(Error(result.error.code), result.error);
      return result;
    }, fullEnvironmentMessage: error => error.code || error.message,
    updateStatusText: value => notices.push(value),
  });
  const source = fs.readFileSync(path.join(ROOT, 'src/renderer/editor.js'), 'utf8');
  const actual = name => {
    const marker = (source.includes(`async function ${name}(`) ? 'async ' : '') + `function ${name}(`;
    const start = source.indexOf(marker), end = source.indexOf('\n}', start);
    assert.ok(start >= 0 && end > start && source.indexOf(marker, start + 1) < 0, name + ' actual source must exist uniquely');
    return source.slice(start, end + 2);
  };
  vm.runInContext(['noteFullEnvironmentFormChanged', 'fullEnvironmentPayload', 'syncFullEnvironmentCurrent'].map(actual).join('\n'), host);
  return { h, host, dispatches, notices };
}

test('full ENV actual coalesced sync persists the latest form after stale atomic open and retains the single-change control [FINITE_NOT_NATIVE]', async t => {
  const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
  for (const concurrent of [false, true]) {
    const { h, host, dispatches } = await fullEnvironmentSyncRaceFixture(t), entered = deferred(), release = deferred();
    let held = false;
    h.afterOpen = async target => {
      if (!held && String(target).includes('.p2-')) { held = true; entered.resolve(); await release.promise; }
    };
    const original = JSON.parse(h.raw());
    h.configuration.presentation.theme = 'dark'; host.noteFullEnvironmentFormChanged();
    await entered.promise;
    if (concurrent) { h.configuration.presentation.wordWrap = false; host.noteFullEnvironmentFormChanged(); await new Promise(setImmediate); }
    const pending = host.fullEnvironmentSyncPromise; release.resolve(); await pending;
    for (let i = 0; i < 12; i++) await new Promise(setImmediate);
    const persisted = JSON.parse(h.raw());
    assert.deepEqual(persisted.projects.find(row => row.projectId === h.projectId).current, h.configuration,
      'latest actually requested form must be durably read back after the stale first attempt');
    assert.equal(host.fullEnvironmentSyncPromise, null); assert.equal(host.fullEnvironmentSyncWanted, false);
    assert.equal(dispatches.length, concurrent ? 2 : 1, 'only the stale changed request retries; single-change control commits once');
    assert.deepEqual(persisted.epochs, original.epochs); assert.deepEqual(persisted.presets, original.presets);
  }
});


async function fullEnvironmentExitRaceFixture(t) {
  const source = fs.readFileSync(path.join(ROOT, 'test/contracts/rtk-word-scene-identity-main.contract.test.js'), 'utf8');
  const start = source.indexOf('function wordExportQuitFixture() {'), end = source.indexOf('\n}\nconst exportQuitTick=', start);
  assert.ok(start >= 0 && end > start && source.indexOf('function wordExportQuitFixture() {', start + 1) < 0);
  const make = Function('read', 'ROOT', 'path', 'assert', 'require', source.slice(start, end + 2) + '\nreturn wordExportQuitFixture;');
  const f = make(file => fs.readFileSync(file, 'utf8'), ROOT, path, assert, require)(), h = await fixture(t);
  const { createFullEnvironmentEpochPort } = require(PORT);
  h.portForProject = projectId => createFullEnvironmentEpochPort({ directory: h.root, projectId,
    assertCurrent: () => {}, readLive: async () => { if (h.beforeLive) await h.beforeLive();
      return { configuration: structuredClone(h.configuration), formGeneration: h.formGeneration, composing: h.composing, authoringPending: h.pending }; },
    validateAvailability: async () => {}, applyWindow: async () => {} });
  h.port = () => h.portForProject(h.projectId); assert.equal((await h.sync()).ok, true);
  f.c.fsSync = fs; f.c.app.getPath = name => { assert.equal(name, 'userData'); return h.root; };
  f.c.createMainFullEnvironmentPort = () => h.port();
  const command = f.c.COMMAND_SURFACE_KERNEL_COMMAND_IDS?.ENVIRONMENT_CONFIGURATION_COMMIT || 'cmd.project.view.commitEnvironmentConfiguration';
  const kernel = require('../../src/command/commandSurfaceKernel.js').createCommandSurfaceKernel({ [command]: value => h.port().change('COMMIT', value) });
  f.c.activeStage10ApplicationBootstrap = { getProjectId: () => h.projectId };
  f.c.dispatchCommandSurfaceKernel = (id, value) => kernel.dispatch(id, JSON.parse(JSON.stringify(value)));
  return { f, h };
}
const fullEnvironmentExitHold = () => { let release; const promise = new Promise(done => { release = done; }); return { promise, release }; };

for (const effect of ['quit', 'closeWindow']) test('full ENV actual late-export exit guard ' + effect + ' retains early control and resumes after activation [FINITE_NOT_NATIVE]', async t => {
  for (const scope of ['scene', 'book']) for (const timing of ['early', 'during-form-read']) {
    const { f, h } = await fullEnvironmentExitRaceFixture(t), formEntered = fullEnvironmentExitHold(), formRelease = fullEnvironmentExitHold(),
      exportEntered = fullEnvironmentExitHold(), exportRelease = fullEnvironmentExitHold();
    let closing;
    if (timing === 'during-form-read') {
      h.beforeLive = async () => { formEntered.release(); await formRelease.promise; };
      closing = f[effect]();
      await Promise.race([formEntered.promise, Promise.resolve(closing).then(() => { throw Error('actual close route did not reach the real form read'); })]);
    }
    const operation = f.start(scope, { readWrittenBuffer: async () => { exportEntered.release(); await exportRelease.promise; return f.bytes; } });
    await Promise.race([exportEntered.promise, operation.then(result => { throw Error('export unexpectedly completed before held readback: ' + JSON.stringify(result)); })]);
    if (timing === 'early') closing = f[effect](); else formRelease.release();
    await closing;
    assert.equal(f.c.pendingReviewDocxExports.size, 1); assert.equal(f.observe().activations, 0);
    assert.equal(f.observe().quitCalls, 0, effect + ' may not quit while the late export is pending');
    assert.equal(f.observe().closeCalls, 0, effect + ' may not close while the late export is pending');
    exportRelease.release(); assert.equal((await operation).ok, true); assert.equal(f.observe().activations, 1);
    await f[effect](); assert.equal(f.observe()[effect === 'quit' ? 'quitCalls' : 'closeCalls'], 1);
    assert.ok(f.events.indexOf('activated') < f.events.indexOf(effect === 'quit' ? 'quit' : 'close'));
    t.diagnostic(effect + ':' + scope + ':' + timing + ':pending-blocked-and-after-activation-closed');
  }
});

for (const effect of ['quit', 'closeWindow']) test('full ENV actual shell-error recovery exit ' + effect + ' preserves store and uses explicit default-stay choice [FINITE_NOT_NATIVE]', async t => {
  for (const state of ['absent', 'healthy', 'corrupt', 'capacity']) for (const choice of (['corrupt', 'capacity'].includes(state) ? [0, 1] : [0])) {
    const { f, h } = await fullEnvironmentExitRaceFixture(t), dialogs = [];
    if (state === 'absent') fs.unlinkSync(path.join(h.root, FILE));
    if (state === 'corrupt') fs.writeFileSync(path.join(h.root, FILE), '{"corrupt":true}\n');
    if (state === 'capacity') {
      for (let i = 1; i < 32; i++) { const port = h.portForProject(id()), p = await port.read();
        assert.equal((await port.change('COMMIT', { ...h.token(p), kind: 'SYNC_CURRENT' })).ok, true); }
      h.projectId = id(); assert.equal(JSON.parse(h.raw()).projects.length, 32);
    }
    const original = state === 'absent' ? null : h.raw();
    f.c.dialog = { showMessageBox: async (_window, options) => { dialogs.push(options); return { response: choice }; } };
    await f[effect]();
    const failedStore = ['corrupt', 'capacity'].includes(state);
    if (failedStore && choice === 0) await f[effect]();
    assert.equal(f.observe()[effect === 'quit' ? 'quitCalls' : 'closeCalls'], failedStore && choice === 0 ? 0 : 1,
      'explicit recovery choice may exit after no-loss confirmation; default/cancel remains open');
    assert.equal(dialogs.length, failedStore ? choice === 0 ? 2 : 1 : 0);
    for (const options of dialogs) {
      assert.equal(options.defaultId, 0); assert.equal(options.cancelId, 0);
      assert.equal(options.buttons[1], 'Закрыть без сохранения вида');
    }
    if (original) assert.deepEqual(h.raw(), original, 'failed/capacity store and all retained history bytes must remain unchanged');
    else assert.equal(fs.existsSync(path.join(h.root, FILE)), false);
    t.diagnostic(effect + ':' + state + ':choice' + choice + ':actual-route-complete-and-original-store-retained');
  }
});


for (const effect of ['quit', 'closeWindow']) test('full ENV actual recovery consent cannot authorize a stale lifecycle or pending authoring ' + effect + ' [FINITE_NOT_NATIVE]', async t => {
  for (const change of ['dirty-generation', 'IME', 'recording', 'subject', 'session', 'profile', 'owner', 'project', 'root', 'window', 'contents', 'pending-export']) {
    const { f, h } = await fullEnvironmentExitRaceFixture(t), entered = fullEnvironmentExitHold(), release = fullEnvironmentExitHold();
    fs.writeFileSync(path.join(h.root, FILE), '{"corrupt":true}\n'); const original = h.raw();
    f.c.dialog = { showMessageBox: async () => { entered.release(); await release.promise; return { response: 1 }; } };
    const closing = f[effect]();
    await Promise.race([entered.promise, Promise.resolve(closing).then(() => { throw Error('real native recovery choice was not reached'); })]);
    if (change === 'dirty-generation') { f.c.isDirty = true; f.c.lastSignaledEditGeneration = 2; }
    if (change === 'IME') f.c.environmentFormComposing = true;
    if (change === 'recording') f.c.activePendingRecording = {};
    if (change === 'subject') f.c.currentLifecycleSubjectId = () => 'document:other';
    if (change === 'session') f.c.commentAuthoringSessionId = 'other-session';
    if (change === 'profile') f.c.app.isPackaged = true;
    if (change === 'owner') f.c.activeStage10ApplicationBootstrap = { getProjectId: () => h.projectId };
    if (change === 'project') f.c.activeStage10ApplicationBootstrap.getProjectId = () => id();
    if (change === 'root') f.c.getProjectRootPath = () => '/owned/other-project';
    if (change === 'window') f.c.mainWindow = { ...f.c.mainWindow };
    if (change === 'contents') f.c.mainWindow.webContents = {};
    let pendingExport, exportRelease;
    if (change === 'pending-export') {
      const exportEntered = fullEnvironmentExitHold(); exportRelease = fullEnvironmentExitHold();
      pendingExport = f.start('book', { readWrittenBuffer: async () => { exportEntered.release(); await exportRelease.promise; return f.bytes; } });
      await Promise.race([exportEntered.promise, pendingExport.then(() => { throw Error('late export must reach actual held readback'); })]);
      assert.equal(f.c.pendingReviewDocxExports.size, 1); assert.equal(f.observe().activations, 0);
    }
    release.release(); await closing;
    assert.equal(f.observe().quitCalls, 0, change); assert.equal(f.observe().closeCalls, 0, change);
    assert.deepEqual(h.raw(), original);
    if (pendingExport) { assert.equal(f.observe().activations, 0); exportRelease.release(); assert.equal((await pendingExport).ok, true); }
    t.diagnostic(effect + ':' + change + ':explicit-consent-still-vetoed');
  }
});

test('full ENV actual bounded sync retains visible work on exhaustion, corruption and stale without a newer request [FINITE_NOT_NATIVE]', async t => {
  for (const mode of ['continuous-new-generation', 'corrupt', 'stale-without-new-request']) {
    const { h, host, dispatches, notices } = await fullEnvironmentSyncRaceFixture(t);
    if (mode === 'corrupt') fs.writeFileSync(path.join(h.root, FILE), '{"corrupt":true}\n'); const original = h.raw();
    if (mode === 'continuous-new-generation') h.afterOpen = async target => {
      if (String(target).includes('.p2-')) { h.configuration.presentation.wordWrap = !h.configuration.presentation.wordWrap;
        host.noteFullEnvironmentFormChanged(); await new Promise(setImmediate); }
    };
    if (mode === 'stale-without-new-request') h.afterOpen = async target => {
      if (String(target).includes('.p2-')) await host.invokeSaveLifecycleSignalBridge('signal.environmentForm.changed', { generation: h.formGeneration });
    };
    h.configuration.presentation.theme = 'dark'; host.noteFullEnvironmentFormChanged();
    await new Promise(setImmediate); if (host.fullEnvironmentSyncPromise) await host.fullEnvironmentSyncPromise;
    await new Promise(setImmediate);
    assert.equal(dispatches.length, mode === 'continuous-new-generation' ? 4 : mode === 'corrupt' ? 0 : 1);
    assert.equal(host.fullEnvironmentSyncPromise, null); assert.equal(host.fullEnvironmentSyncWanted, true);
    assert.equal(notices.at(-1), mode === 'continuous-new-generation' ? 'E_FULL_ENV_SYNC_RETRY_LIMIT' : mode === 'corrupt' ? 'E_FULL_ENV_KEYS' : 'E_FULL_ENV_CONTEXT_STALE');
    assert.deepEqual(h.raw(), original, 'failed writes leave all original durable bytes intact');
    t.diagnostic(mode + ':finite-terminal-failure-visible-with-work-retained');
  }
});

test('full ENV actual sync rejects an old document projection before dispatch and persists the latest requested identity [FINITE_NOT_NATIVE]', async t => {
  const { h, host, dispatches } = await fullEnvironmentSyncRaceFixture(t), entered = fullEnvironmentExitHold(), release = fullEnvironmentExitHold();
  const actualRead = host.readFullEnvironmentProjection; let held = false;
  host.readFullEnvironmentProjection = async () => { const p = await actualRead();
    if (!held) { held = true; entered.release(); await release.promise; } return p; };
  host.noteFullEnvironmentFormChanged(); await entered.promise;
  host.currentDocumentId = 'owned-new-scene'; host.currentTreeContentPublicationId = 'owned-new-publication'; host.localEditGeneration++;
  h.configuration.presentation.theme = 'dark'; host.noteFullEnvironmentFormChanged(); release.release();
  await host.fullEnvironmentSyncPromise; await new Promise(setImmediate);
  assert.equal(dispatches.length, 1); assert.equal(dispatches[0].expectedFormGeneration, 2);
  assert.equal(host.fullEnvironmentSyncWanted, false); assert.equal(host.fullEnvironmentSyncPromise, null);
  assert.deepEqual(JSON.parse(h.raw()).projects[0].current, h.configuration);
});
