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
