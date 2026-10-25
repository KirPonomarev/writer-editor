'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');
const MODULE_REL = 'src/renderer/design-os/designOsFormConfiguration.mjs';
const MODULE_PATH = path.join(ROOT, MODULE_REL);

function importModule(modulePath = MODULE_PATH, tag = 'wp303') {
  return import(`${pathToFileURL(modulePath).href}?${tag}=${Date.now()}-${Math.random()}`);
}

function makeContext(overrides = {}) {
  return {
    shell_mode: 'CALM_DOCKED',
    profile: 'BASELINE',
    workspace: 'WRITE',
    platform: 'macos',
    accessibility: 'default',
    ...overrides,
  };
}

function makeLayout(overrides = {}) {
  return {
    left_width: 290,
    right_width: 290,
    bottom_height: 96,
    editor_root: 'docked',
    viewport_width: 1440,
    viewport_height: 900,
    shell_mode: 'CALM_DOCKED',
    right_collapsed: false,
    right_expanded_width: 290,
    ...overrides,
  };
}

function makeForm(overrides = {}) {
  return {
    context: makeContext(overrides.context),
    designState: overrides.designState || {},
    layout: makeLayout(overrides.layout),
  };
}

function makeStage(expectedRevision, overrides = {}) {
  return {
    expectedRevision,
    commitPoint: overrides.commitPoint || 'apply',
    ...makeForm(overrides),
  };
}

function requiredTokens() {
  return {
    schemaVersion: 1,
    baselineId: 'writer-calm-v1',
    color: {
      background: { canvas: '#ffffff' },
      text: { primary: '#111111', secondary: '#555555' },
      surface: { panel: '#f5f5f5' },
    },
    typography: {
      font: { body: { family: 'system', sizePx: 16 }, ui: { family: 'system' } },
      scale: { body: { lineHeight: 1.5 } },
    },
    spacing: { base: 8 },
    radius: { sm: 4 },
    focus: { ring: { color: '#0066cc' } },
    motion: { enabled: true },
    density: { default: { scale: 1 } },
    surface: { editor: { background: '#ffffff' } },
  };
}

function makeRuntimeInput(runtimeStateOverrides = {}) {
  const baseline = makeLayout();
  return {
    productTruth: {
      project_id: 'project-wp303',
      active_scene_id: 'scene-1',
      scenes: { 'scene-1': { text: 'Never shell state' } },
    },
    commandKernel: {
      catalog: { 'cmd.project.save': { id: 'cmd.project.save' } },
      capabilities: { 'cmd.project.save': true },
    },
    runtimeState: {
      base_tokens: requiredTokens(),
      mode_overrides: { CALM_DOCKED: {} },
      profile_overrides: { BASELINE: {} },
      workspace_overrides: { WRITE: {} },
      platform_overrides: { macos: {} },
      accessibility_overrides: { default: {}, reduced_motion: { motion: { enabled: false } } },
      runtime_fallback: {},
      design_state: {},
      baseline_layout: baseline,
      current_layout: baseline,
      last_stable_layout: baseline,
      ...runtimeStateOverrides,
    },
    profiles: {
      BASELINE: { visible_commands: ['cmd.project.save'], hidden_commands: [] },
    },
    workspaces: { WRITE: {} },
    supportedContext: {
      shell_modes: ['CALM_DOCKED'],
      profile_ids: ['BASELINE'],
      workspace_ids: ['WRITE'],
      platform_ids: ['macos'],
      accessibility_ids: ['default', 'reduced_motion'],
    },
  };
}

test('WP303 model stages and promotes one immutable versioned form with revision CAS', async () => {
  const module = await importModule();
  const controller = module.createDesignOsFormConfigurationController({ baseline: makeForm() });
  const initial = controller.getCurrentConfiguration();
  assert.equal(initial.schemaVersion, module.DESIGN_OS_FORM_CONFIGURATION_SCHEMA_VERSION);
  assert.equal(initial.revision, 0);
  assert.equal(initial.lifecycle, 'STABLE');

  const staged = controller.stage(makeStage(0, {
    context: { accessibility: 'reduced_motion' },
    designState: { typography: { label: 'Cafe\u0301 👩🏽‍💻' } },
  }));
  assert.equal(staged.revision, 1);
  assert.equal(staged.lifecycle, 'PENDING');
  assert.equal(staged.designState.typography.label, 'Café 👩🏽‍💻');
  assert.equal(Object.isFrozen(staged), true);
  assert.equal(Object.isFrozen(staged.designState), true);

  assert.throws(
    () => controller.stage(makeStage(0)),
    (error) => error?.code === 'E_DESIGN_FORM_STALE_REVISION',
  );
  assert.equal(controller.getCurrentConfiguration().revision, 1);

  const stable = controller.promoteStable(1);
  assert.equal(stable.revision, 1);
  assert.equal(stable.lifecycle, 'STABLE');
  assert.deepEqual(controller.getLastStableConfiguration(), stable);
  assert.deepEqual(controller.promoteStable(1), stable, 'stable promotion replay must be idempotent');
});

test('WP303 contract rejects schema drift, unsafe trees, unbounded data and invalid revisions', async () => {
  const module = await importModule();
  const controller = module.createDesignOsFormConfigurationController({ baseline: makeForm() });
  const valid = controller.getCurrentConfiguration();
  const unsafeState = JSON.parse('{"__proto__":{"product_truth":true}}');
  const invalid = [
    { ...valid, schemaVersion: 'yalken.designOsFormConfiguration.v2' },
    { ...valid, revision: -1 },
    { ...valid, lifecycle: 'APPLIED' },
    { ...valid, extraAuthority: true },
    { ...valid, context: { ...valid.context, profile: '' } },
    { ...valid, context: { ...valid.context, extra: true } },
    { ...valid, layout: { ...valid.layout, viewport_width: 1 } },
    { ...valid, layout: { ...valid.layout, right_collapsed: 'false' } },
    { ...valid, designState: unsafeState },
    { ...valid, designState: { text: '\uD800' } },
    { ...valid, designState: { value: Number.POSITIVE_INFINITY } },
    { ...valid, designState: { text: 'x'.repeat(module.DESIGN_OS_FORM_CONFIGURATION_MAX_BYTES) } },
  ];
  for (const candidate of invalid) {
    assert.equal(module.validateDesignOsFormConfiguration(candidate).ok, false, JSON.stringify(candidate).slice(0, 240));
  }

  assert.throws(
    () => controller.stage({ ...makeStage(0), unknown: true }),
    (error) => error?.code === 'E_DESIGN_FORM_STAGE_SHAPE',
  );
  assert.equal(controller.getCurrentConfiguration().revision, 0, 'failed candidates cannot mutate shell state');
});

test('WP303 explicit rollback restores last stable form and remains idempotent once stable', async () => {
  const module = await importModule();
  const controller = module.createDesignOsFormConfigurationController({ baseline: makeForm() });
  const first = controller.commit(makeStage(0, {
    designState: { color: { text: { primary: '#202020' } } },
  }));
  assert.equal(first.revision, 1);

  const pending = controller.stage(makeStage(1, {
    commitPoint: 'resize_end',
    designState: { color: { text: { primary: '#ff0000' } } },
    layout: { left_width: 420 },
  }));
  assert.equal(pending.lifecycle, 'PENDING');
  assert.equal(pending.revision, 2);

  const restored = controller.rollback(2);
  assert.equal(restored.lifecycle, 'STABLE');
  assert.equal(restored.revision, 3);
  assert.equal(restored.designState.color.text.primary, '#202020');
  assert.equal(restored.layout.left_width, 290);
  assert.deepEqual(controller.rollback(3), restored);
  assert.deepEqual(controller.getRecoveryReceipt(), {
    performed: true,
    reason: 'EXPLICIT_ROLLBACK',
    sourceRevision: 2,
    recoveredRevision: 3,
  });

  const reset = controller.safeReset(3);
  assert.equal(reset.revision, 4);
  assert.deepEqual(reset.designState, {});
  assert.equal(reset.commitPoint, 'safe_reset');
});

test('WP303 crash recovery rejects split brain and recovers pending or malformed current from last stable', async () => {
  const module = await importModule();
  const controller = module.createDesignOsFormConfigurationController({ baseline: makeForm() });
  controller.commit(makeStage(0, { designState: { density: { scale: 0.9 } } }));
  controller.stage(makeStage(1, { designState: { density: { scale: 9 } } }));
  const pendingSnapshot = JSON.parse(JSON.stringify(controller.getSnapshot()));

  const recovered = module.createDesignOsFormConfigurationController({
    baseline: makeForm(),
    snapshot: pendingSnapshot,
  });
  assert.equal(recovered.getCurrentConfiguration().revision, 3);
  assert.equal(recovered.getCurrentConfiguration().designState.density.scale, 0.9);
  assert.deepEqual(recovered.getRecoveryReceipt(), {
    performed: true,
    reason: 'PENDING_AFTER_CRASH',
    sourceRevision: 2,
    recoveredRevision: 3,
  });

  const malformedSnapshot = JSON.parse(JSON.stringify(recovered.getSnapshot()));
  malformedSnapshot.current.schemaVersion = 'truncated';
  const malformedRecovered = module.createDesignOsFormConfigurationController({
    baseline: makeForm(),
    snapshot: malformedSnapshot,
  });
  assert.equal(malformedRecovered.getRecoveryReceipt().reason, 'CURRENT_INVALID');
  assert.equal(malformedRecovered.getCurrentConfiguration().designState.density.scale, 0.9);

  const splitBrain = JSON.parse(JSON.stringify(recovered.getSnapshot()));
  splitBrain.current.designState.density.scale = 1.1;
  assert.throws(
    () => module.createDesignOsFormConfigurationController({ baseline: makeForm(), snapshot: splitBrain }),
    (error) => error?.code === 'E_DESIGN_FORM_STABLE_SPLIT_BRAIN',
  );

  const invalidStable = JSON.parse(JSON.stringify(recovered.getSnapshot()));
  invalidStable.lastStable.schemaVersion = 'invalid';
  assert.throws(
    () => module.createDesignOsFormConfigurationController({ baseline: makeForm(), snapshot: invalidStable }),
    (error) => error?.code === 'E_DESIGN_FORM_SCHEMA',
  );

  const forgedBaseline = JSON.parse(JSON.stringify(recovered.getSnapshot()));
  forgedBaseline.baseline.designState = { authority: 'forged' };
  assert.throws(
    () => module.createDesignOsFormConfigurationController({ baseline: makeForm(), snapshot: forgedBaseline }),
    (error) => error?.code === 'E_DESIGN_FORM_BASELINE',
  );
});

test('WP303 integrates versioned form state through existing Design OS ports without product-truth mutation', async () => {
  const runtimeModule = await importModule(path.join(ROOT, 'src/renderer/design-os/designOsRuntime.mjs'), 'runtime');
  const portModule = await importModule(path.join(ROOT, 'src/renderer/design-os/designOsPortContract.mjs'), 'ports');
  const runtime = runtimeModule.createDesignOsRuntime(makeRuntimeInput());
  const ports = portModule.createDesignOsPorts({ runtime, defaultContext: makeContext() });
  const before = ports.getRuntimeSnapshot();
  const beforeHash = runtimeModule.buildProductTruthHash(before.product_truth);

  const committed = ports.commitDesign({
    commit_point: 'apply',
    context: makeContext({ accessibility: 'reduced_motion' }),
    design_patch: { color: { text: { primary: '#202020' } } },
  });
  assert.equal(committed.form_configuration_revision, 1);
  assert.equal(committed.form_configuration_lifecycle, 'STABLE');
  assert.equal(committed.resolved_tokens.motion.enabled, false);
  assert.equal(committed.resolved_tokens.color.text.primary, '#202020');

  const degraded = ports.commitDesign({
    commit_point: 'resize_end',
    design_patch: { color: { text: { primary: '#ff0000' } } },
    layout_patch: { left_width: 700, right_width: 700 },
  });
  assert.equal(degraded.degraded_to_baseline, true);
  assert.equal(degraded.form_configuration_revision, 2);
  assert.equal(degraded.form_configuration_lifecycle, 'PENDING');
  assert.equal(ports.getRuntimeSnapshot().design_state.color.text.primary, '#ff0000');

  const restoredLayout = ports.restoreLastStableShell();
  const restored = ports.getRuntimeSnapshot();
  assert.equal(restoredLayout.left_width, 290);
  assert.equal(restored.design_state.color.text.primary, '#202020');
  assert.equal(restored.form_configuration_snapshot.current.revision, 3);
  assert.equal(restored.form_configuration_snapshot.current.lifecycle, 'STABLE');
  assert.equal(restored.form_configuration_recovery.reason, 'EXPLICIT_ROLLBACK');
  assert.equal(runtimeModule.buildProductTruthHash(restored.product_truth), beforeHash);

  const roundTrip = JSON.parse(JSON.stringify(restored.form_configuration_snapshot));
  const rebooted = runtimeModule.createDesignOsRuntime(makeRuntimeInput({
    form_configuration_snapshot: roundTrip,
  }));
  assert.equal(rebooted.getSnapshot().design_state.color.text.primary, '#202020');
  assert.equal(rebooted.onTextInput('e\u0301 👩🏽‍💻'), 'e\u0301 👩🏽‍💻'.length);

  const contextOnly = rebooted.commit(makeContext(), {
    commit_point: 'mode_switch',
  });
  assert.equal(contextOnly.form_configuration_revision, 4);
  assert.equal(contextOnly.form_configuration_lifecycle, 'STABLE');
  assert.equal(
    rebooted.getSnapshot().form_configuration_snapshot.current.context.accessibility,
    'default',
  );

  const reset = ports.safeResetShell();
  assert.equal(reset.left_width, 290);
  assert.deepEqual(ports.getRuntimeSnapshot().design_state, {});
  assert.equal(runtimeModule.buildProductTruthHash(ports.getRuntimeSnapshot().product_truth), beforeHash);
});

test('WP303 bounds customization work and carries no storage, timer, command or UI authority', async () => {
  const module = await importModule();
  assert.equal(module.DESIGN_OS_FORM_CONFIGURATION_MAX_DEPTH, 16);
  assert.equal(module.DESIGN_OS_FORM_CONFIGURATION_MAX_ENTRIES, 2048);
  assert.equal(module.DESIGN_OS_FORM_CONFIGURATION_MAX_BYTES, 65536);

  const boundedState = Object.fromEntries(
    Array.from({ length: 1000 }, (_, index) => [`slot-${String(index).padStart(4, '0')}`, index % 2 === 0]),
  );
  const controller = module.createDesignOsFormConfigurationController({ baseline: makeForm() });
  assert.equal(controller.commit(makeStage(0, {
    context: { accessibility: 'reduced_motion' },
    designState: { slots: boundedState },
  })).lifecycle, 'STABLE');

  const source = fs.readFileSync(MODULE_PATH, 'utf8');
  for (const forbidden of ['localStorage', 'sessionStorage', 'node:fs', 'ipcRenderer', 'ipcMain', 'setInterval', 'setTimeout']) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test('WP303 implementation mutants are killed by independent behavioral oracles', async (t) => {
  const source = fs.readFileSync(MODULE_PATH, 'utf8');
  const tempRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'r24-wp303-mutants-')));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const mutants = [
    {
      id: 'stale-revision-admitted',
      find: 'if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== this.current.revision) {',
      replace: 'if (false) {',
      oracle: async (module) => {
        const controller = module.createDesignOsFormConfigurationController({ baseline: makeForm() });
        assert.throws(() => controller.stage(makeStage(9)), (error) => error?.code === 'E_DESIGN_FORM_STALE_REVISION');
      },
    },
    {
      id: 'pending-crash-recovery-bypassed',
      find: "if (current.lifecycle === 'PENDING') {",
      replace: 'if (false) {',
      oracle: async (module) => {
        const sourceController = module.createDesignOsFormConfigurationController({ baseline: makeForm() });
        sourceController.stage(makeStage(0, { designState: { unsafePending: true } }));
        const recovered = module.createDesignOsFormConfigurationController({
          baseline: makeForm(),
          snapshot: JSON.parse(JSON.stringify(sourceController.getSnapshot())),
        });
        assert.equal(recovered.getRecoveryReceipt().reason, 'PENDING_AFTER_CRASH');
      },
    },
    {
      id: 'unsafe-object-key-admitted',
      find: "const DANGEROUS_KEYS = Object.freeze(['__proto__', 'prototype', 'constructor']);",
      replace: 'const DANGEROUS_KEYS = Object.freeze([]);',
      oracle: async (module) => {
        const controller = module.createDesignOsFormConfigurationController({ baseline: makeForm() });
        const unsafe = JSON.parse('{"__proto__":{"authority":true}}');
        assert.throws(
          () => controller.stage(makeStage(0, { designState: unsafe })),
          (error) => error?.code === 'E_DESIGN_FORM_UNSAFE_KEY',
        );
      },
    },
    {
      id: 'rollback-keeps-pending-design-state',
      find: 'designState: this.lastStable.designState,',
      replace: 'designState: this.current.designState,',
      oracle: async (module) => {
        const controller = module.createDesignOsFormConfigurationController({ baseline: makeForm() });
        controller.commit(makeStage(0, { designState: { value: 'stable' } }));
        controller.stage(makeStage(1, { designState: { value: 'pending' } }));
        assert.equal(controller.rollback(2).designState.value, 'stable');
      },
    },
    {
      id: 'serialized-byte-budget-disabled',
      find: 'if (bytes > DESIGN_OS_FORM_CONFIGURATION_MAX_BYTES) {',
      replace: 'if (false) {',
      oracle: async (module) => {
        const controller = module.createDesignOsFormConfigurationController({ baseline: makeForm() });
        assert.throws(() => controller.stage(makeStage(0, {
          designState: { text: 'x'.repeat(module.DESIGN_OS_FORM_CONFIGURATION_MAX_BYTES) },
        })));
      },
    },
    {
      id: 'persisted-baseline-replaces-canonical',
      find: '|| !sameForm(this.baseline, baseline)',
      replace: '|| false',
      oracle: async (module) => {
        const controller = module.createDesignOsFormConfigurationController({ baseline: makeForm() });
        const forged = JSON.parse(JSON.stringify(controller.getSnapshot()));
        forged.baseline.designState = { authority: 'forged' };
        assert.throws(
          () => module.createDesignOsFormConfigurationController({ baseline: makeForm(), snapshot: forged }),
          (error) => error?.code === 'E_DESIGN_FORM_BASELINE',
        );
      },
    },
  ];

  let killed = 0;
  for (const mutant of mutants) {
    assert.equal(source.includes(mutant.find), true, `missing mutation target: ${mutant.id}`);
    const mutantPath = path.join(tempRoot, `${mutant.id}.mjs`);
    fs.writeFileSync(mutantPath, source.replace(mutant.find, mutant.replace), 'utf8');
    const module = await importModule(mutantPath, mutant.id);
    try {
      await mutant.oracle(module);
    } catch {
      killed += 1;
    }
  }
  assert.equal(killed, mutants.length);
  console.log(`R24_WP303_IMPLEMENTATION_MUTANTS=${killed}/${mutants.length}`);
});

// ENV-EPOCH-01 THEME_WRAP_V1 is a separately versioned, pure history model.
// Every original WP303 controller, snapshot and mutant body above is retained.
const ENV_EPOCH_A = Object.freeze({ theme: 'light', wordWrap: true });
const ENV_EPOCH_B = Object.freeze({ theme: 'dark', wordWrap: false });
const envEpochUuid = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const envEpochMetadata = (revision, preferences = ENV_EPOCH_A, overrides = {}) => ({
  expectedRevision: revision,
  epochId: envEpochUuid(revision + 1),
  recordedAtUtc: '2026-10-25T12:30:00.000Z',
  platform: 'macos',
  reason: 'CAPTURE',
  sourceEpochId: null,
  preferences: { ...preferences },
  ...overrides,
});
const envEpochCode = error => typeof error?.code === 'string' && /^E_ENVIRONMENT_EPOCH_/u.test(error.code);
const envEpochCopy = value => JSON.parse(JSON.stringify(value));

function requireEnvironmentEpochApi(module) {
  for (const name of ['createEnvironmentEpochHistory', 'decodeEnvironmentEpochHistory', 'appendEnvironmentEpoch', 'previewEnvironmentEpoch']) {
    assert.equal(typeof module[name], 'function', 'actual pure WP303 export: ' + name);
  }
  return module;
}

test('ENV epoch model preserves distinct immutable A B and restore-A records with consecutive revisions', async () => {
  const m = requireEnvironmentEpochApi(await importModule());
  const empty = m.createEnvironmentEpochHistory();
  assert.deepEqual(empty, { schemaVersion: 'yalken.designOsEnvironmentEpochHistory.v1', configurationSchema: 'THEME_WRAP_V1', revision: 0, epochs: [] });
  const a = m.appendEnvironmentEpoch(empty, envEpochMetadata(0));
  const beforeA = JSON.stringify(a);
  const b = m.appendEnvironmentEpoch(a, envEpochMetadata(1, ENV_EPOCH_B));
  const beforeB = JSON.stringify(b);
  const restored = m.appendEnvironmentEpoch(b, envEpochMetadata(2, ENV_EPOCH_A, { reason: 'RESTORE', sourceEpochId: envEpochUuid(1) }));
  assert.equal(JSON.stringify(a), beforeA); assert.equal(JSON.stringify(b), beforeB);
  assert.deepEqual(restored.epochs.slice(0, 2), b.epochs);
  assert.deepEqual(restored.epochs.map(row => row.revision), [1, 2, 3]);
  assert.deepEqual(restored.epochs.map(row => row.preferences), [ENV_EPOCH_A, ENV_EPOCH_B, ENV_EPOCH_A]);
  assert.equal(restored.epochs[2].sourceEpochId, restored.epochs[0].epochId);
  assert.equal(restored.epochs[2].reason, 'RESTORE'); assert.equal(restored.revision, 3);
  assert.equal(empty.revision, 0); assert.equal(empty.epochs.length, 0);
  for (const value of [empty, a, b, restored]) {
    assert.equal(Object.isFrozen(value), true); assert.equal(Object.isFrozen(value.epochs), true);
    for (const row of value.epochs) { assert.equal(Object.isFrozen(row), true); assert.equal(Object.isFrozen(row.preferences), true); }
  }
  assert.throws(() => { restored.epochs[0].preferences.theme = 'dark'; }, TypeError);
  const selected = m.previewEnvironmentEpoch(restored, envEpochUuid(1));
  assert.deepEqual(selected, a.epochs[0]); assert.equal(Object.isFrozen(selected.preferences), true);
  assert.equal(JSON.stringify(b), beforeB, 'preview has no mutation authority');
  assert.deepEqual(m.decodeEnvironmentEpochHistory(JSON.stringify(restored)), restored);
  assert.deepEqual(m.decodeEnvironmentEpochHistory(new TextEncoder().encode(JSON.stringify(restored))), restored);
});

test('ENV epoch revision CAS and source references refuse without changing any accepted historical record', async t => {
  const m = requireEnvironmentEpochApi(await importModule());
  const a = m.appendEnvironmentEpoch(m.createEnvironmentEpochHistory(), envEpochMetadata(0));
  const before = JSON.stringify(a);
  const bad = [
    ['stale-zero', envEpochMetadata(0, ENV_EPOCH_B)],
    ['future-revision', envEpochMetadata(9, ENV_EPOCH_B)],
    ['string-revision', envEpochMetadata('1', ENV_EPOCH_B)],
    ['duplicate-id', envEpochMetadata(1, ENV_EPOCH_B, { epochId: envEpochUuid(1) })],
    ['missing-restore-source', envEpochMetadata(1, ENV_EPOCH_A, { reason: 'RESTORE', sourceEpochId: envEpochUuid(99) })],
    ['restore-without-source', envEpochMetadata(1, ENV_EPOCH_A, { reason: 'RESTORE', sourceEpochId: null })],
    ['restore-forged-preferences', envEpochMetadata(1, ENV_EPOCH_B, { reason: 'RESTORE', sourceEpochId: envEpochUuid(1) })],
    ['capture-with-source', envEpochMetadata(1, ENV_EPOCH_A, { sourceEpochId: envEpochUuid(1) })],
    ['unknown-reason', envEpochMetadata(1, ENV_EPOCH_A, { reason: 'RESTORE_CAPABILITIES' })],
    ['renderer-platform', envEpochMetadata(1, ENV_EPOCH_A, { platform: 'darwin' })],
  ];
  for (const [id, metadata] of bad) await t.test(id, () => {
    assert.throws(() => m.appendEnvironmentEpoch(a, metadata), envEpochCode);
    assert.equal(JSON.stringify(a), before);
  });
  assert.throws(() => m.previewEnvironmentEpoch(a, envEpochUuid(99)), envEpochCode);
  assert.equal(JSON.stringify(a), before);
});

test('ENV epoch capture validation rejects coercion metadata spoofing unknown keys and unsafe values', async t => {
  const m = requireEnvironmentEpochApi(await importModule()), empty = m.createEnvironmentEpochHistory();
  const valid = envEpochMetadata(0), candidates = [
    ['theme-coercion', { ...valid, preferences: { theme: 'DARK', wordWrap: true } }],
    ['theme-null', { ...valid, preferences: { theme: null, wordWrap: true } }],
    ['wrap-string', { ...valid, preferences: { theme: 'light', wordWrap: 'true' } }],
    ['wrap-number', { ...valid, preferences: { theme: 'light', wordWrap: 1 } }],
    ['preferences-array', { ...valid, preferences: ['light', true] }],
    ['unknown-preference', { ...valid, preferences: { ...ENV_EPOCH_A, text: 'manuscript' } }],
    ['historical-permit', { ...valid, capability: true }],
    ['historical-layout', { ...valid, layout: { editor_root: 'floating' } }],
    ['path', { ...valid, path: '/untrusted/epoch.json' }],
    ['empty-id', { ...valid, epochId: '' }],
    ['non-uuid-id', { ...valid, epochId: 'epoch-one' }],
    ['malformed-time', { ...valid, recordedAtUtc: 'not-a-date' }],
    ['impossible-date', { ...valid, recordedAtUtc: '2026-02-31T12:30:00.000Z' }],
    ['non-utc-time', { ...valid, recordedAtUtc: '2026-10-25T14:30:00.000+02:00' }],
    ['invalid-unicode', { ...valid, epochId: '\uD800' }],
    ['oversized-id', { ...valid, epochId: 'x'.repeat(65536) }],
    ['non-object', null],
  ];
  const unsafe = JSON.parse(JSON.stringify(valid)); Object.defineProperty(unsafe.preferences, '__proto__', { enumerable: true, value: { theme: 'dark' } });
  candidates.push(['prototype-key', unsafe]);
  for (const [id, metadata] of candidates) await t.test(id, () => {
    assert.throws(() => m.appendEnvironmentEpoch(empty, metadata), envEpochCode);
    assert.equal(empty.revision, 0); assert.deepEqual(empty.epochs, []);
  });
});

test('ENV epoch persisted history refuses reordered duplicate unknown broken and noncanonical metadata without repair', async t => {
  const m = requireEnvironmentEpochApi(await importModule());
  let history = m.appendEnvironmentEpoch(m.createEnvironmentEpochHistory(), envEpochMetadata(0));
  history = m.appendEnvironmentEpoch(history, envEpochMetadata(1, ENV_EPOCH_B));
  const variants = [
    ['unknown-history-version', value => { value.schemaVersion = 'yalken.designOsEnvironmentEpochHistory.v2'; }],
    ['unknown-configuration', value => { value.configurationSchema = 'LAYOUT_CAPABILITIES_V2'; }],
    ['unknown-root-key', value => { value.productTruth = { text: 'never' }; }],
    ['missing-root-key', value => { delete value.revision; }],
    ['wrong-revision', value => { value.revision += 1; }],
    ['negative-revision', value => { value.revision = -1; }],
    ['unsafe-revision', value => { value.revision = Number.MAX_SAFE_INTEGER + 1; }],
    ['string-revision', value => { value.revision = '2'; }],
    ['reordered', value => { value.epochs.reverse(); }],
    ['duplicate-revision', value => { value.epochs[1].revision = 1; }],
    ['duplicate-epoch', value => { value.epochs[1].epochId = value.epochs[0].epochId; }],
    ['unknown-record-key', value => { value.epochs[0].manuscript = 'never'; }],
    ['missing-preference', value => { delete value.epochs[0].preferences.wordWrap; }],
    ['future-source', value => { value.epochs[0].reason = 'RESTORE'; value.epochs[0].sourceEpochId = value.epochs[1].epochId; }],
    ['self-source', value => { value.epochs[0].reason = 'RESTORE'; value.epochs[0].sourceEpochId = value.epochs[0].epochId; }],
    ['noncanonical-platform', value => { value.epochs[0].platform = 'macOS'; }],
    ['time-invalid', value => { value.epochs[0].recordedAtUtc = '2026-13-01T00:00:00.000Z'; }],
  ];
  for (const [id, mutate] of variants) await t.test(id, () => {
    const value = envEpochCopy(history); mutate(value); const bytes = JSON.stringify(value);
    assert.throws(() => m.decodeEnvironmentEpochHistory(bytes), envEpochCode);
    assert.equal(JSON.stringify(value), bytes, 'decoder does not rewrite its caller input');
  });
  for (const [id, bytes] of [
    ['duplicate-root-key', '{"schemaVersion":"yalken.designOsEnvironmentEpochHistory.v1","configurationSchema":"THEME_WRAP_V1","revision":0,"revision":0,"epochs":[]}'],
    ['escaped-duplicate-key', '{"schemaVersion":"yalken.designOsEnvironmentEpochHistory.v1","configurationSchema":"THEME_WRAP_V1","revision":0,"\\u0072evision":0,"epochs":[]}'],
    ['duplicate-nested-key', JSON.stringify(history).replace('"theme":"light"', '"theme":"light","theme":"light"')],
    ['torn-json', JSON.stringify(history).slice(0, -1)],
    ['invalid-utf8', new Uint8Array([0x7b, 0xff, 0x7d])],
    ['serialized-byte-bound', JSON.stringify(m.createEnvironmentEpochHistory()) + ' '.repeat(65536)],
  ]) await t.test(id, () => assert.throws(() => m.decodeEnvironmentEpochHistory(bytes), envEpochCode));
});

test('ENV epoch capacity128 refuses capture and restore without truncating the oldest saved version', async () => {
  const m = requireEnvironmentEpochApi(await importModule()); let history = m.createEnvironmentEpochHistory();
  for (let n = 0; n < 128; n += 1) history = m.appendEnvironmentEpoch(history, envEpochMetadata(n, n % 2 ? ENV_EPOCH_B : ENV_EPOCH_A));
  const original = JSON.stringify(history);
  assert.equal(history.revision, 128); assert.equal(history.epochs.length, 128); assert.equal(history.epochs[0].epochId, envEpochUuid(1));
  for (const metadata of [envEpochMetadata(128), envEpochMetadata(128, ENV_EPOCH_A, { reason: 'RESTORE', sourceEpochId: envEpochUuid(1) })]) {
    assert.throws(() => m.appendEnvironmentEpoch(history, metadata), envEpochCode);
    assert.equal(JSON.stringify(history), original);
  }
  assert.deepEqual(m.decodeEnvironmentEpochHistory(original), history);
  assert.deepEqual(m.previewEnvironmentEpoch(history, envEpochUuid(1)).preferences, ENV_EPOCH_A);
});
