'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');
const ROOT = path.resolve(__dirname, '../..');
const modulePath = path.join(ROOT, 'src/renderer/design-os/designOsEnvironmentEpochs.mjs');
const load = () => import(url.pathToFileURL(fs.existsSync(modulePath) ? modulePath
  : path.join(ROOT, 'src/renderer/design-os/designOsFormConfiguration.mjs')).href);
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const now = '2026-10-31T09:00:00.000Z', projectId = uuid(999);
function fixture(second = false) {
  return { schemaVersion: 'yalken.environmentConfiguration.v2', workspace: second ? 'PLAN' : 'WRITE',
    shellMode: 'CALM_DOCKED', profile: second ? 'FOCUS' : 'BASELINE', keymap: 'NATIVE_V1',
    composition: { profile: second ? 'master' : 'minimal', toolbarIds: second
      ? ['toolbar.font.family', 'toolbar.text.lineHeight', 'toolbar.history.undo']
      : ['toolbar.font.family', 'toolbar.font.weight', 'toolbar.history.redo'], surfaces: ['navigator', 'editor', 'inspector'] },
    layout: { leftWidth: second ? 330 : 290, rightWidth: 290, leftCollapsed: false, rightCollapsed: second,
      leftTab: second ? 'outline' : 'project', rightTab: 'inspector',
      toolbar: { x: 24, y: 92, isVertical: false, isDetached: false, scale: 1, widthScale: 1, dockedWidthScale: 1, freeWidthScale: 1, toolbarHeight: 40 },
      leftToolbar: { x: 24, y: 24, isVertical: false, isDetached: false, widthScale: 1 }, toolbarOffsets: [], leftToolbarOffsets: [] },
    presentation: { theme: second ? 'dark' : 'light', wordWrap: !second, fontFamily: second ? 'Georgia, serif' : '"Circe", -apple-system, system-ui, sans-serif',
      fontWeight: second ? 'regular' : 'light', fontSize: second ? 18 : 12, lineHeight: second ? 1.5 : 1,
      viewMode: second ? 'focus' : 'default', zoom: second ? 1.2 : 1, compact: false, previewEnabled: false, previewFrame: false },
    window: { displayId: '1', x: 0, y: 0, width: 1440, height: 900, viewportWidth: 1440, viewportHeight: 872 } };
}
function change(m, state, kind, patch = {}) {
  const project = state.projects.find(row => row.projectId === projectId);
  return m.transitionFullEnvironment(state, { kind, projectId, expectedRevision: state.revision,
    expectedGeneration: project?.generation || 0, ...patch });
}
function observed(m, config = fixture()) { return change(m, m.createFullEnvironmentState(), 'OBSERVE_CURRENT', { configuration: config }); }
const isRefusal = error => /^E_FULL_ENV_/u.test(error?.code || '');

test('full ENV causal control retains working v1 and requires a separate complete configuration contract', async () => {
  const legacy = await import('../../src/renderer/design-os/designOsFormConfiguration.mjs');
  const old = legacy.appendEnvironmentEpoch(legacy.createEnvironmentEpochHistory(), { expectedRevision: 0,
    epochId: uuid(1), recordedAtUtc: now, platform: 'macos', reason: 'CAPTURE', sourceEpochId: null,
    preferences: { theme: 'light', wordWrap: true } });
  assert.deepEqual(legacy.decodeEnvironmentEpochHistory(JSON.stringify(old)).epochs[0].preferences, { theme: 'light', wordWrap: true });
  const m = await load(); assert.equal(typeof m.validateFullEnvironmentConfiguration, 'function', 'Theme/Wrap alone cannot restore mode, profile, composition and full form');
  assert.deepEqual(m.validateFullEnvironmentConfiguration(fixture()), fixture());
  assert.notDeepEqual(m.validateFullEnvironmentConfiguration(fixture(true)), fixture());
});

test('full ENV closes every configuration field before any legacy normalizer or coercion', async t => {
  const m = await load();
  const corruptions = [
    x => { x.manuscript = 'never shell history'; }, x => { x.permissions = ['write']; },
    x => { x.workspace = 'write'; }, x => { x.profile = 'OWNER'; }, x => { x.keymap = 'CUSTOM_EXECUTABLE'; },
    x => { x.composition.toolbarIds.push('toolbar.proofing.grammar'); },
    x => { x.composition.toolbarIds.push(x.composition.toolbarIds[0]); },
    x => { x.composition.surfaces.push('private-storage-writer'); }, x => { x.layout.leftWidth = '290'; },
    x => { x.layout.toolbar.x = Infinity; }, x => { x.layout.toolbar.scale = 10; },
    x => { x.layout.toolbarOffsets = [{ key: '__proto__', value: 10 }]; },
    x => { x.presentation.fontFamily = 'url(file:///private/secret)'; },
    x => { x.presentation.zoom = 100; }, x => { x.window.width = 0; },
    x => { x.window.path = '/tmp/target'; }, x => { x.schemaVersion = 'yalken.environmentConfiguration.v999'; },
    x => { Object.defineProperty(x.presentation, 'theme', { get() { throw Error('GETTER_MUST_NOT_EXECUTE'); }, enumerable: true }); },
  ];
  for (let i = 0; i < corruptions.length; i++) await t.test(String(i), () => {
    const x = fixture(); corruptions[i](x); assert.throws(() => m.validateFullEnvironmentConfiguration(x), isRefusal);
  });
});

test('full ENV A/B record, canonical cold decode, read-only diff and healthy apply retain history and previous stable', async () => {
  const m = await load(); let s = observed(m);
  s = change(m, s, 'CAPTURE', { epochId: uuid(1), recordedAtUtc: now });
  const a = structuredClone(s.epochs[0]);
  s = change(m, s, 'OBSERVE_CURRENT', { configuration: fixture(true) });
  s = change(m, s, 'CAPTURE', { epochId: uuid(2), recordedAtUtc: now });
  const before = m.encodeFullEnvironmentState(s), source = { kind: 'EPOCH', id: uuid(1) };
  const preview = m.previewFullEnvironmentSource(s, projectId, source);
  assert.deepEqual(preview.configuration, fixture()); assert.ok(preview.changes.some(row => row.path === 'workspace'));
  assert.ok(preview.changes.some(row => row.path === 'composition.toolbarIds')); assert.equal(m.encodeFullEnvironmentState(s), before);
  s = m.decodeFullEnvironmentState(before); assert.deepEqual(s.epochs[0], a);
  s = change(m, s, 'STAGE_APPLY', { operationId: uuid(4), epochId: uuid(3), recordedAtUtc: now, source });
  assert.deepEqual(s.projects[0].current, fixture(true), 'pending publication cannot replace known usable current');
  assert.deepEqual(s.projects[0].pending.configuration, fixture());
  assert.throws(() => change(m, s, 'CONFIRM_APPLY', { operationId: uuid(4), observedConfiguration: fixture(true) }), isRefusal);
  s = change(m, s, 'CONFIRM_APPLY', { operationId: uuid(4), observedConfiguration: fixture() });
  assert.deepEqual(s.projects[0].current, fixture()); assert.deepEqual(s.projects[0].lastStable, fixture(true));
  assert.equal(s.projects[0].pending, null); assert.equal(s.epochs.length, 3); assert.deepEqual(s.epochs[0], a);
  assert.equal(s.epochs[2].source.id, uuid(1)); assert.equal(s.epochs[2].parentEpochId, uuid(2));
  assert.deepEqual(m.decodeFullEnvironmentState(m.encodeFullEnvironmentState(s)), s);
  assert.equal(Object.isFrozen(s.projects[0].current.composition.toolbarIds), true);
});

test('full ENV named preset/reset/last-stable/history are distinct and cancellation keeps published epoch and presets', async () => {
  const m = await load(); let s = observed(m, fixture(true));
  s = change(m, s, 'SAVE_PRESET', { presetId: uuid(6), name: 'My writing form', recordedAtUtc: now });
  const presets = JSON.stringify(s.presets), prior = m.encodeFullEnvironmentState(s);
  const reset = m.previewFullEnvironmentSource(s, projectId, { kind: 'RESET', id: null });
  const preset = m.previewFullEnvironmentSource(s, projectId, { kind: 'PRESET', id: uuid(6) });
  assert.equal(reset.configuration.workspace, 'WRITE'); assert.notDeepEqual(reset.configuration, preset.configuration);
  assert.equal(m.encodeFullEnvironmentState(s), prior);
  s = change(m, s, 'STAGE_APPLY', { operationId: uuid(7), epochId: uuid(8), recordedAtUtc: now, source: { kind: 'RESET', id: null } });
  s = change(m, s, 'ABANDON_APPLY', { operationId: uuid(7) });
  assert.deepEqual(s.projects[0].current, fixture(true)); assert.equal(s.epochs.length, 1);
  assert.equal(JSON.stringify(s.presets), presets); assert.equal(s.projects[0].pending, null);
  assert.throws(() => change(m, s, 'ABANDON_APPLY', { operationId: uuid(7) }), isRefusal);
});

test('full ENV finite legacy migration keeps exact original bytes and explicitly overlays only legacy fields', async () => {
  const m = await load(), legacy = await import('../../src/renderer/design-os/designOsFormConfiguration.mjs');
  const old = legacy.appendEnvironmentEpoch(legacy.createEnvironmentEpochHistory(), { expectedRevision: 0,
    epochId: uuid(1), recordedAtUtc: now, platform: 'macos', reason: 'CAPTURE', sourceEpochId: null, preferences: { theme: 'dark', wordWrap: false } });
  const raw = JSON.stringify(old) + '\n', sha256 = crypto.createHash('sha256').update(raw).digest('hex');
  let s = m.createFullEnvironmentState({ legacyRaw: raw, legacySha256: sha256 });
  s = change(m, s, 'OBSERVE_CURRENT', { configuration: fixture() });
  const p = m.previewFullEnvironmentSource(s, projectId, { kind: 'LEGACY', id: uuid(1) });
  assert.equal(p.configuration.presentation.theme, 'dark'); assert.equal(p.configuration.presentation.wordWrap, false);
  assert.equal(p.configuration.workspace, 'WRITE'); assert.deepEqual(p.configuration.composition, fixture().composition);
  assert.ok(p.warnings.includes('LEGACY_THEME_WRAP_ONLY_OTHER_CURRENT_FIELDS_RETAINED'));
  assert.equal(s.legacy.raw, raw); assert.equal(m.decodeFullEnvironmentState(m.encodeFullEnvironmentState(s)).legacy.raw, raw);
  assert.equal(s.legacy.sha256, sha256); assert.equal(s.epochs.length, 0, 'migration cannot invent full historical environments');
  assert.throws(() => m.createFullEnvironmentState({ legacyRaw: raw.replace('.v1', '.v999'), legacySha256: sha256 }), isRefusal);
});

test('full ENV rejects stale generation/revision, foreign project/source and arbitrary author metadata without mutation', async () => {
  const m = await load(), s = observed(m), before = m.encodeFullEnvironmentState(s);
  const valid = { kind: 'CAPTURE', projectId, expectedRevision: s.revision, expectedGeneration: s.projects[0].generation, epochId: uuid(2), recordedAtUtc: now };
  for (const patch of [{ expectedGeneration: 999 }, { expectedRevision: 999 }, { projectId: uuid(777) }, { path: '/tmp/no' }, { recordedAtUtc: 'yesterday' }])
    assert.throws(() => m.transitionFullEnvironment(s, { ...valid, ...patch }), isRefusal);
  assert.throws(() => m.previewFullEnvironmentSource(s, projectId, { kind: 'EPOCH', id: uuid(888) }), isRefusal);
  assert.throws(() => m.previewFullEnvironmentSource(s, projectId, { kind: 'PERMISSIONS', id: null }), isRefusal);
  assert.equal(m.encodeFullEnvironmentState(s), before);
});

test('full ENV raw decoder rejects duplicate/unsafe/BOM/noncanonical/corrupt/oversize bytes and exposes no repair writer', async () => {
  const m = await load(), raw = m.encodeFullEnvironmentState(observed(m));
  const cases = [raw.replace('"revision":1', '"revision":0,"revision":1'), '\ufeff' + raw,
    raw.replace('"projects":', '"__proto__":{},"projects":'), raw.replace('.v2', '.v999'), raw.slice(0, -10),
    raw + ' '.repeat(2 * 1024 * 1024), raw.replace('"WRITE"', '"WR\\u0049TE"')];
  for (const input of cases) assert.throws(() => m.decodeFullEnvironmentState(input), isRefusal);
  assert.throws(() => m.decodeFullEnvironmentState(new Uint8Array([0xc0, 0xaf])), isRefusal);
  assert.equal(m.FULL_ENV_LIMITS.epochs, 128); assert.equal(m.FULL_ENV_LIMITS.presets, 32);
  assert.equal(m.FULL_ENV_LIMITS.configurationBytes, 16384); assert.equal(m.FULL_ENV_LIMITS.bytes, 2097152);
});

test('full ENV all128full records fit actual declared byte/entry budgets and the129th never trims anything', async () => {
  const m = await load(); let s = observed(m);
  for (let i = 1; i <= 128; i++) s = change(m, s, 'CAPTURE', { epochId: uuid(i), recordedAtUtc: now });
  const before = m.encodeFullEnvironmentState(s); assert.ok(Buffer.byteLength(before) <= m.FULL_ENV_LIMITS.bytes);
  assert.equal(m.decodeFullEnvironmentState(before).epochs.length, 128);
  assert.throws(() => change(m, s, 'CAPTURE', { epochId: uuid(129), recordedAtUtc: now }), error => error.code === 'E_FULL_ENV_CAPACITY_NO_TRIM');
  assert.equal(m.encodeFullEnvironmentState(s), before); assert.equal(s.epochs[0].epochId, uuid(1));
});
