const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { join } = require('node:path');
const { test } = require('node:test');

const REQUIRED_ROLES = ['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll'];

test('menu template exposes edit role-items', async () => {
  const mainPath = join(process.cwd(), 'src', 'main.js');
  const content = await readFile(mainPath, 'utf8');
  const missing = REQUIRED_ROLES.filter((role) => {
    const regex = new RegExp(`role\\s*:\\s*['"]${role}['"]`);
    return !regex.test(content);
  });

  assert.ok(
    missing.length === 0,
    `Missing edit menu roles: ${missing.join(', ')}. Keep undo/redo/cut/copy/paste/selectAll present.`
  );
});

function extractFunctionBody(source, functionName) {
  const signature = `function ${functionName}`;
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `Missing ${functionName}`);

  const bodyStart = source.indexOf('{', start);
  assert.notEqual(bodyStart, -1, `Missing ${functionName} body`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) {
      return source.slice(bodyStart + 1, index);
    }
  }

  assert.fail(`Unterminated ${functionName} body`);
}

test('main process keeps primary paste bridge gated by renderer focus signal', async () => {
  const mainPath = join(process.cwd(), 'src', 'main.js');
  const content = await readFile(mainPath, 'utf8');
  const detectorBody = extractFunctionBody(content, 'isPrimaryPasteShortcut');
  const handlerBody = extractFunctionBody(content, 'handlePrimaryPasteShortcut');

  assert.match(content, /function\s+isPrimaryPasteShortcut\s*\(/);
  assert.match(detectorBody, /input\.type\s*!==\s*['"]keyDown['"]/);
  assert.match(detectorBody, /key\s*!==\s*['"]v['"]/);
  assert.match(detectorBody, /input\.isAutoRepeat\s*===\s*true/);
  assert.match(detectorBody, /input\.alt\s*\|\|\s*input\.shift/);
  assert.match(detectorBody, /process\.platform\s*===\s*['"]darwin['"]\s*\?\s*input\.meta\s*:\s*input\.control/);
  assert.match(detectorBody, /process\.platform\s*===\s*['"]darwin['"]\s*\?\s*input\.control\s*:\s*input\.meta/);
  assert.match(content, /function\s+handlePrimaryPasteShortcut\s*\(/);
  assert.match(content, /EDITOR_PASTE_FOCUS_STATE_CHANNEL/);
  assert.match(content, /normalizeEditorPasteFocusState/);
  assert.match(content, /isEditorPasteTargetFocused\s*=\s*focused/);
  assert.match(handlerBody, /isEditorPasteTargetFocused\s*!==\s*true/);
  assert.match(handlerBody, /win\.webContents\.paste\(\)/);
  assert.doesNotMatch(handlerBody, /executeJavaScript/);
  assert.doesNotMatch(handlerBody, /focusProbeScript/);
  assert.doesNotMatch(handlerBody, /document\.activeElement/);
  assert.doesNotMatch(handlerBody, /\.ProseMirror/);
  assert.doesNotMatch(handlerBody, /isContentEditable/);
  assert.doesNotMatch(handlerBody, /event\.preventDefault\(\)/);
});

test('native Mac Cut edits only a live focused authoring target once; other keys and contexts remain untouched', async () => {
  const vm = require('node:vm');
  const content = await readFile(join(process.cwd(), 'src', 'main.js'), 'utf8');
  const body = extractFunctionBody(content, 'handlePrimaryCutShortcut');
  let cut = 0, prevented = 0;
  const context = { process: { platform: 'darwin' }, isEditorPasteTargetFocused: true };
  vm.createContext(context);
  vm.runInContext('function handlePrimaryCutShortcut(event,input,win) {' + body + '}', context);
  const input = { type: 'keyDown', key: 'x', meta: true };
  const event = { preventDefault() { prevented++; } };
  const win = { isDestroyed: () => false, isFocused: () => true,
    webContents: { isDestroyed: () => false, cut() { cut++; } } };
  assert.equal(context.handlePrimaryCutShortcut(event, input, win), true);
  assert.equal(cut, 1); assert.equal(prevented, 1);
  for (const override of [{ type: 'keyUp' }, { key: 'v' }, { meta: false }, { control: true }, { alt: true }, { shift: true }, { isAutoRepeat: true }]) {
    assert.equal(context.handlePrimaryCutShortcut(event, { ...input, ...override }, win), false);
  }
  for (const target of [null, { ...win, isDestroyed: () => true }, { ...win, isFocused: () => false }, { ...win, webContents: { isDestroyed: () => true } }]) {
    assert.equal(context.handlePrimaryCutShortcut(event, input, target), false);
  }
  context.isEditorPasteTargetFocused = false;
  assert.equal(context.handlePrimaryCutShortcut(event, input, win), false);
  context.isEditorPasteTargetFocused = true; context.process.platform = 'linux';
  assert.equal(context.handlePrimaryCutShortcut(event, input, win), false);
  assert.equal(cut, 1); assert.equal(prevented, 1);
});

// Actual production functions and real artifact reads at a finite Electron boundary;
// these tests do not execute an OS responder or prove native Cmd+A selection.
const SELECT_ALL_SNAPSHOT = 'menu-default-desktop-minimal-kernel-history-20261103';
async function nativeMenuRoleHarness(verificationOverrides = {}, platform = 'darwin') {
  const fs = require('node:fs'), vm = require('node:vm');
  const source = await readFile(join(process.cwd(), 'src/main.js'), 'utf8');
  const readJson = file => JSON.parse(fs.readFileSync(join(process.cwd(), file), 'utf8'));
  const artifactPort = require('../../src/menu/menu-artifact-lock.js');
  const sourcePolicy = require('../../src/menu/menu-runtime-source-policy.js');
  const normalizer = require('../../src/menu/menu-config-normalizer.js');
  const verificationInputs = [], verificationStates = [], warnings = [], commandCalls = [];
  const context = { process: { platform, env: {}, argv: [] }, path: require('node:path'), fsSync: fs,
    DEFAULT_MENU_ARTIFACT_PATH: artifactPort.DEFAULT_ARTIFACT_PATH, MENU_ARTIFACT_RESULT_FAIL: artifactPort.RESULT_FAIL,
    resolveMenuArtifactModeFromInput: artifactPort.resolveModeFromInput,
    ...sourcePolicy, normalizeMenuConfigPipeline: normalizer.normalizeMenuConfigPipeline,
    console: { warn: message => warnings.push(message) },
    evaluateMenuArtifactLockState(input) {
      verificationInputs.push(JSON.parse(JSON.stringify(input)));
      const state = artifactPort.evaluateMenuArtifactLockState({ ...input, ...verificationOverrides }); verificationStates.push(state); return state;
    },
    resolveMenuCommandId: require('../../src/menu/command-namespace-canon.js').resolveMenuCommandId,
    dispatchMenuCommand(commandId, payload, options) { commandCalls.push({ commandId, payload, options }); },
    logDevError(_where, error) { throw error; },
  };
  vm.createContext(context);
  const names = ['normalizeRuntimeString', 'isRuntimeRecord', 'createRuntimeMenuPolicyError', 'emitRuntimeMenuAdvisory',
    'parseRuntimeJsonInput', 'resolveRuntimeMenuLocaleCatalog', 'normalizeRuntimeOverlayPayload', 'normalizeRuntimeContextPayload',
    'resolveRuntimeMenuArtifactPath', 'resolveRawConfigMixAttempt', 'readMenuArtifactDocument', 'resolveRuntimeMenuBuildConfig',
    'buildMenuItemFromConfig', 'resolveRuntimeMenuArtifactMode', 'verifyMenuArtifactLockAtRuntime',
    'resolveMenuAccelerator', 'buildConfiguredMenuCommandPayload', 'buildCommandClickHandler', 'isMenuLocalCustomizationCommandId'];
  const functions = names.map(name => {
    const start = source.indexOf('function ' + name + '('), end = source.indexOf('\n}\n', start);
    assert.ok(start >= 0 && end > start, 'actual Main function exists: ' + name); return source.slice(start, end + 2);
  });
  const roleStart = source.indexOf('const ALLOWED_MENU_ROLES ='), roleEnd = source.indexOf('const MENU_RUNTIME_OVERLAYS_ENV_PATH', roleStart);
  assert.ok(roleStart >= 0 && roleEnd > roleStart);
  const constants = ['MENU_RUNTIME_OVERLAYS_ENV_PATH', 'MENU_RUNTIME_OVERLAYS_ENV_JSON', 'MENU_RUNTIME_CONTEXT_ENV_PATH',
    'MENU_RUNTIME_CONTEXT_ENV_JSON', 'MENU_RUNTIME_ARTIFACT_ENV_PATH', 'MENU_RUNTIME_RAW_CONFIG_ENV_PATH', 'MENU_RUNTIME_LEGACY_RAW_CONFIG_ENV_PATH',
    'MENU_ACCELERATOR_TOKENS', 'COMMAND_BUS_ROUTE', 'MENU_LOCAL_CUSTOMIZATION_COMMAND_IDS',
    'MENU_CUSTOMIZATION_COMMAND_RESET', 'MENU_CUSTOMIZATION_COMMAND_TOGGLE_VISIBILITY',
    'MENU_CUSTOMIZATION_COMMAND_MOVE_EARLIER', 'MENU_CUSTOMIZATION_COMMAND_MOVE_LATER',
    'MENU_PRESENTATION_COMMAND_CLASSIC', 'MENU_PRESENTATION_COMMAND_COMPACT',
    'MENU_LOCALE_COMMAND_BASE', 'MENU_LOCALE_COMMAND_RU', 'MENU_LOCALE_COMMAND_EN'];
  constants.sort((a, b) => source.indexOf('const ' + a + ' =') - source.indexOf('const ' + b + ' ='));
  vm.runInContext(source.slice(roleStart, roleEnd) + constants.map(name => {
    const start = source.indexOf('const ' + name + ' ='); assert.ok(start >= 0); return source.slice(start, source.indexOf(';', start) + 1);
  }).join('\n') + '\n' + functions.join('\n'), context);
  const config = readJson('src/menu/menu-config.v2.json'), defaultContext = readJson('test/fixtures/menu/context.default.json');
  const normalize = (input = config, overrides = {}) => {
    const result = normalizer.normalizeMenuConfigPipeline({ baseConfig: input, overlays: [],
      context: { ...defaultContext, ...overrides }, baseSourceRef: 'src/menu/menu-config.v2.json' });
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics)); return result.normalizedConfig;
  };
  const nativeItem = value => {
    const edit = value.menus.find(node => node.id === 'edit'); assert.ok(edit);
    const built = context.buildMenuItemFromConfig(edit, value, 'menus.edit');
    const copy = built.submenu.find(node => node.role === 'copy');
    assert.ok(copy, 'actual Copy role is the unchanged positive control'); assert.equal(copy.click, undefined);
    const item = built.submenu.find(node => node.id === 'edit-select-all');
    assert.ok(item, 'actual artifact/config Edit subtree must expose Select All');
    assert.equal(item.role, 'selectAll'); assert.equal(item.visible, true); assert.equal(item.enabled, true);
    for (const key of ['command', 'actionId', 'click', 'label', 'accelerator']) assert.equal(item[key], undefined, key + ' must use native role defaults');
    const projected = edit.items.find(node => node.id === 'edit-select-all'); assert.equal(projected.canonicalCmdId, null);
    return item;
  };
  const historical = readJson('test/fixtures/menu/edit-history-native-roles.v1.json');
  assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(join(process.cwd(),
    'test/fixtures/menu/edit-history-native-roles.v1.json'))).digest('hex'),
  '6eddb09e789abfa0513416b654f0340625817f3a59b1c5046f6261a11e8ec0ca', 'predecessor fixture remains byte-exact');
  const historicalConfig = JSON.parse(JSON.stringify(config));
  historicalConfig.menus.find(node => node.id === 'edit').items = historical.menu.items;
  return { context, config, readJson, normalize, nativeItem, verificationInputs, verificationStates, warnings,
    commandCalls, historical, historicalConfig };
}

test('native Select All reaches the actual default packaged artifact resolver and Main builder', async () => {
  const h = await nativeMenuRoleHarness(), runtime = h.context.resolveRuntimeMenuBuildConfig('release');
  h.nativeItem(runtime);
  const artifact = h.readJson('docs/OPS/ARTIFACTS/menu/menu.normalized.json');
  const packaged = h.readJson('src/runtime-governance/docs/OPS/ARTIFACTS/menu/menu.normalized.json');
  assert.deepEqual(packaged, artifact); assert.equal(artifact.snapshotId, SELECT_ALL_SNAPSHOT);
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.menus)), artifact.menus);
  assert.deepEqual(h.normalize().menus, artifact.menus, 'actual current canonical input must produce the shipped menu');
  assert.deepEqual(h.readJson('docs/OPS/LOCKS/MENU_ARTIFACT_LOCK.json'),
    h.readJson('src/runtime-governance/docs/OPS/LOCKS/MENU_ARTIFACT_LOCK.json'));
  h.context.process.env.MENU_RUNTIME_RAW_CONFIG_PATH = 'finite-raw-mix-attempt';
  h.nativeItem(h.context.resolveRuntimeMenuBuildConfig('release'));
  assert.equal(h.warnings.length, 1, 'raw mixing retains the actual advisory artifact-only policy');
  assert.throws(() => h.context.resolveRuntimeMenuBuildConfig('promotion'), error => error.menuRuntimeBlocking === true);
});

test('canonical native Select All remains available across admitted profiles stages and empty control context', async () => {
  const h = await nativeMenuRoleHarness();
  const raw = h.config.menus.find(node => node.id === 'edit').items.find(node => node.id === 'edit-select-all');
  assert.ok(raw, 'canonical config must declare the native role');
  assert.deepEqual(Object.keys(raw).sort(), ['enabledWhen', 'id', 'mode', 'profile', 'role', 'stage']);
  assert.deepEqual(raw.enabledWhen, { op: 'all', args: [] });
  for (const profile of ['minimal', 'pro', 'guru']) for (const stage of ['X1', 'X2', 'X3', 'X4']) {
    for (const mode of ['offline', 'web_subset']) for (const hasDocument of [false, true]) for (const selectionExists of [false, true]) {
      h.nativeItem(h.normalize(h.config, { profile, stage, mode, hasDocument, selectionExists }));
    }
  }
});

test('native Select All semantic oracle detects omission hidden gated and unsupported role mutations without command fallback', async () => {
  const h = await nativeMenuRoleHarness(); h.nativeItem(h.normalize());
  for (const mutation of ['omit', 'hidden', 'mode-gated', 'profile-gated', 'stage-gated', 'unsupported', 'command-bypass']) {
    const config = JSON.parse(JSON.stringify(h.config)), edit = config.menus.find(node => node.id === 'edit');
    const item = edit.items.find(node => node.id === 'edit-select-all');
    if (mutation === 'omit') edit.items = edit.items.filter(node => node !== item);
    if (mutation === 'hidden') item.visible = false;
    if (mutation === 'mode-gated') item.mode = ['web_subset'];
    if (mutation === 'profile-gated') item.profile = ['guru'];
    if (mutation === 'stage-gated') item.stage = ['X4'];
    if (mutation === 'unsupported') item.role = 'appMenu';
    if (mutation === 'command-bypass') item.command = 'cmd.project.save';
    assert.throws(() => h.nativeItem(h.normalize(config)), error => error.code === 'ERR_ASSERTION' ||
      mutation === 'unsupported' && error.message.includes('Unsupported menu role'), mutation);
  }
});

test('actual runtime menu verification requests the successor and retains strict failure and old path advisory', async () => {
  const h = await nativeMenuRoleHarness({ lockPath: join(process.cwd(), 'docs/OPS/LOCKS/MENU_ARTIFACT_LOCK.json') }); h.context.verifyMenuArtifactLockAtRuntime();
  assert.equal(h.verificationInputs.length, 1); assert.equal(h.verificationInputs[0].expectedSnapshotId, SELECT_ALL_SNAPSHOT);
  const state = h.verificationStates[0], artifact = h.readJson('src/runtime-governance/docs/OPS/ARTIFACTS/menu/menu.normalized.json');
  assert.equal(state.issues.some(row => row.code === 'EXPECTED_SNAPSHOT_ID_MISMATCH'), artifact.snapshotId !== SELECT_ALL_SNAPSHOT);
  assert.equal(state.issues.some(row => row.code === 'LOCK_ARTIFACT_PATH_MISMATCH'), true, 'existing mirror path issue is not hidden or repaired');
  assert.equal(state.result, 'WARN'); assert.equal(h.warnings.length, 1);
  h.context.process.argv = ['--promotionMode=true'];
  assert.throws(() => h.context.verifyMenuArtifactLockAtRuntime(), error => error.failSignalCode === 'E_MENU_ARTIFACT_TAMPER_OR_DRIFT');
  assert.equal(h.verificationStates.at(-1).result, 'FAIL');
});

test('maintained menu guards select the successor in release and promotion at a finite child argv boundary', async () => {
  const vm = require('node:vm'), source = await readFile(join(process.cwd(), 'scripts/run-tests.js'), 'utf8');
  const calls = [], expected = [];
  let status = 0;
  const context = { process: { execPath: process.execPath }, spawnSync(command, args, options) {
    calls.push({ command, args: Array.from(args), options: { ...options } }); return { status };
  } };
  vm.createContext(context);
  const specifications = [
    ['runMenuSnapshotGuard', ['scripts/ops/menu-config-normalize.mjs', '--snapshot-check', `--snapshot-id=${SELECT_ALL_SNAPSHOT}`]],
    ['runMenuArtifactExportGuard', ['scripts/ops/menu-config-normalize.mjs', '--export-artifact', '--out',
      'docs/OPS/ARTIFACTS/menu/menu.normalized.json', '--snapshot-id', SELECT_ALL_SNAPSHOT, '--lock-artifact']],
    ['runMenuArtifactLockGuard', ['scripts/ops/check-menu-artifact-lock.mjs', `--snapshot-id=${SELECT_ALL_SNAPSHOT}`]],
  ];
  for (const [name, args] of specifications) {
    const start = source.indexOf('function ' + name + '('), end = source.indexOf('\n}\n', start);
    assert.ok(start >= 0 && end > start, name); vm.runInContext(source.slice(start, end + 2), context);
    for (const promotion of [false, true]) for (const childStatus of [0, 7, null]) {
      status = childStatus;
      assert.equal(context[name](process.cwd(), promotion), childStatus ?? 1, name + ': child status propagation');
      expected.push({ command: process.execPath, args: [...args, '--mode=' + (promotion ? 'promotion' : 'release')],
        options: { cwd: process.cwd(), stdio: 'inherit' } });
    }
  }
  assert.deepEqual(calls, expected, 'finite capture proves actual argv selection, not child or native execution');
});

test('actual menu CLI implicit promotion default matches the successor while the historical snapshot still refuses drift', async (t) => {
  const fs = require('node:fs'), { spawnSync } = require('node:child_process');
  const { hashNormalizedConfig } = require('../../src/menu/menu-config-normalizer.js');
  const paths = ['docs/OPS/ARTIFACTS/menu/menu.normalized.json', 'docs/OPS/LOCKS/MENU_ARTIFACT_LOCK.json',
    'src/runtime-governance/docs/OPS/ARTIFACTS/menu/menu.normalized.json',
    'src/runtime-governance/docs/OPS/LOCKS/MENU_ARTIFACT_LOCK.json', 'docs/OPS/STATUS/MENU_SNAPSHOT_REGISTRY.json'];
  const before = paths.map(file => fs.readFileSync(join(process.cwd(), file)));
  const registry = JSON.parse(before.at(-1)).snapshots, historicalId = 'menu-default-desktop-minimal';
  const successor = registry.find(row => row.id === SELECT_ALL_SNAPSHOT), historical = registry.find(row => row.id === historicalId);
  const directory = fs.mkdtempSync(join(fs.realpathSync(require('node:os').tmpdir()), 'select-all-snapshot-'));
  try {
    const runs = [null, historicalId].map((snapshotId, index) => {
      const outPath = join(directory, `normalized-${index}.json`);
      const args = ['scripts/ops/menu-config-normalize.mjs', '--snapshot-check', '--mode=promotion', '--out', outPath, '--json'];
      if (snapshotId !== null) args.push('--snapshot-id=' + snapshotId);
      const child = spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8' });
      t.diagnostic(JSON.stringify({ actualCli: true, args, status: child.status, stdout: child.stdout, stderr: child.stderr }));
      assert.equal(child.error, undefined); assert.equal(child.signal, null); assert.equal(child.stderr, '');
      const state = JSON.parse(child.stdout), output = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      t.diagnostic(JSON.stringify({ actualNormalizedOutput: output }));
      assert.equal(state.operation, 'snapshot-check'); assert.equal(state.mode, 'promotion'); assert.equal(state.outPath, outPath);
      assert.equal(hashNormalizedConfig(output.normalizedConfig), output.normalizedHashSha256);
      assert.equal(state.normalizedHashSha256, output.normalizedHashSha256); assert.equal(state.contextHashSha256, output.contextHashSha256);
      assert.equal(output.normalizedHashSha256, successor.normalizedHashSha256); assert.equal(output.contextHashSha256, successor.contextHashSha256);
      return { child, state, output };
    });
    const [current, old] = runs;
    assert.ok(successor); assert.ok(historical);
    assert.equal(old.child.status, 1); assert.equal(old.state.result, 'FAIL'); assert.equal(old.state.snapshotId, historicalId);
    assert.equal(old.state.failSignalCode, 'E_MENU_SNAPSHOT_MISMATCH'); assert.deepEqual(old.state.snapshotEntry, historical);
    assert.equal(old.state.mismatch.expectedNormalizedHashSha256, historical.normalizedHashSha256);
    assert.equal(old.state.mismatch.actualNormalizedHashSha256, successor.normalizedHashSha256);
    const h = await nativeMenuRoleHarness(); assert.deepEqual(current.output.normalizedConfig, h.normalize());
    assert.equal(current.state.snapshotId, SELECT_ALL_SNAPSHOT, 'implicit CLI default must select current successor');
    assert.equal(current.child.status, 0); assert.equal(current.state.exitCode, 0); assert.equal(current.state.result, 'PASS');
    assert.equal(current.state.failSignalCode, ''); assert.equal(current.state.mismatch, null);
    assert.deepEqual(current.state.snapshotEntry, successor);
  } finally {
    paths.forEach((file, index) => assert.deepEqual(fs.readFileSync(join(process.cwd(), file)), before[index], file + ': no repository writes'));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

// Frozen predecessor roles remain supported by the actual builder. They are a
// historical compatibility control, not the current PM-aware command contract.
function assertNativeHistoryProjection(h, config) {
  h.nativeItem(config);
  const edit = config.menus.find(menu => menu.id === 'edit');
  assert.ok(edit, 'actual Edit menu must be present');
  const built = h.context.buildMenuItemFromConfig(edit, config, 'menus.edit');
  assert.deepEqual(Array.from(built.submenu, item => item.id),
    ['edit-undo', 'edit-redo', 'edit-copy', 'edit-select-all']);
  for (const role of ['undo', 'redo']) {
    const item = built.submenu.find(node => node.id === 'edit-' + role);
    assert.ok(item, 'actual Main builder must expose native ' + role);
    assert.equal(item.role, role); assert.equal(item.enabled, true); assert.equal(item.visible, true);
    for (const key of ['command', 'actionId', 'click', 'label', 'accelerator']) {
      assert.equal(item[key], undefined, role + ': native responder defaults only');
    }
    assert.equal(edit.items.find(node => node.id === 'edit-' + role).canonicalCmdId, null,
      role + ': native history must not acquire product command authority');
  }
  return built;
}

for (const role of ['undo', 'redo']) {
  test('historical native ' + role + ' retains exact predecessor projection and actual Main role builder', async () => {
    const h = await nativeMenuRoleHarness();
    const runtime = h.normalize(h.historicalConfig);
    h.nativeItem(runtime);
    const edit = runtime.menus.find(menu => menu.id === 'edit'); assert.ok(edit);
    const built = h.context.buildMenuItemFromConfig(edit, runtime, 'menus.edit');
    const item = built.submenu.find(node => node.id === 'edit-' + role);
    assert.ok(item, 'actual packaged Edit menu is missing native ' + role);
    assert.equal(item.role, role); assert.equal(item.enabled, true); assert.equal(item.visible, true);
    for (const key of ['command', 'actionId', 'click', 'label', 'accelerator']) assert.equal(item[key], undefined, key);
    assert.equal(edit.items.find(node => node.id === 'edit-' + role).canonicalCmdId, null);
    assert.equal(h.historical.snapshotId, 'menu-default-desktop-minimal-undo-redo-20261025');
    assert.equal(h.historical.sourceCommit, 'c6daca66506e1ab650409e859f87e52f719e93bb');
    assert.deepEqual(JSON.parse(JSON.stringify(edit)), h.historical.normalizedMenu);
    assert.deepEqual(h.normalize(h.historicalConfig).menus.find(menu => menu.id === 'edit'), h.historical.normalizedMenu);
  });
}

test('historical native Undo and Redo retain unconditional role semantics in all child-control contexts', async () => {
  const h = await nativeMenuRoleHarness(), edit = h.historicalConfig.menus.find(menu => menu.id === 'edit');
  assert.ok(edit);
  assert.deepEqual(edit.items.map(item => item.id), ['edit-undo', 'edit-redo', 'edit-copy', 'edit-select-all']);
  for (const role of ['undo', 'redo']) {
    const raw = edit.items.find(node => node.id === 'edit-' + role); assert.ok(raw, role);
    assert.deepEqual(Object.keys(raw).sort(), ['enabledWhen', 'id', 'mode', 'profile', 'role', 'stage']);
    assert.equal(raw.role, role); assert.deepEqual(raw.enabledWhen, { op: 'all', args: [] });
    assert.deepEqual(raw.mode, ['offline', 'web_subset']); assert.deepEqual(raw.profile, ['minimal', 'pro', 'guru']);
    assert.deepEqual(raw.stage, ['X1', 'X2', 'X3', 'X4']);
  }
  for (const profile of ['minimal', 'pro', 'guru']) for (const stage of ['X1', 'X2', 'X3', 'X4']) {
    for (const mode of ['offline', 'web_subset']) for (const hasDocument of [false, true]) for (const selectionExists of [false, true]) {
      assertNativeHistoryProjection(h, h.normalize(h.historicalConfig, { profile, stage, mode, hasDocument, selectionExists }));
    }
  }
});

test('historical history-role oracle retains each omission hidden gate unsupported role and command bypass refusal', async () => {
  const h = await nativeMenuRoleHarness();
  assertNativeHistoryProjection(h, h.normalize(h.historicalConfig));
  for (const role of ['undo', 'redo']) {
    for (const mutation of ['omit', 'hidden', 'mode-gated', 'profile-gated', 'stage-gated', 'unsupported', 'command-bypass']) {
      const config = JSON.parse(JSON.stringify(h.historicalConfig)), edit = config.menus.find(node => node.id === 'edit');
      const item = edit.items.find(node => node.id === 'edit-' + role); assert.ok(item, 'lawful mutation source ' + role);
      if (mutation === 'omit') edit.items = edit.items.filter(node => node !== item);
      if (mutation === 'hidden') item.visible = false;
      if (mutation === 'mode-gated') item.mode = ['web_subset'];
      if (mutation === 'profile-gated') item.profile = ['guru'];
      if (mutation === 'stage-gated') item.stage = ['X4'];
      if (mutation === 'unsupported') item.role = 'appMenu';
      if (mutation === 'command-bypass') item.command = 'cmd.project.save';
      assert.throws(() => assertNativeHistoryProjection(h, h.normalize(config)), error => error.code === 'ERR_ASSERTION'
        || mutation === 'unsupported' && error.message.includes('Unsupported menu role'), role + ': ' + mutation);
    }
  }
});

function assertCurrentHistoryProjection(h, config, platform = 'darwin') {
  h.nativeItem(config);
  const edit = config.menus.find(menu => menu.id === 'edit'); assert.ok(edit);
  const built = h.context.buildMenuItemFromConfig(edit, config, 'menus.edit');
  assert.deepEqual(Array.from(built.submenu, item => item.id), ['edit-undo', 'edit-redo', 'edit-copy', 'edit-select-all']);
  for (const action of ['undo', 'redo']) {
    const item = built.submenu.find(node => node.id === 'edit-' + action), commandId = 'cmd.project.edit.' + action;
    assert.ok(item); assert.equal(item.role, undefined); assert.equal(item.enabled, true); assert.equal(item.visible, true);
    assert.equal(item.label, action === 'undo' ? 'Undo' : 'Redo'); assert.equal(typeof item.click, 'function');
    assert.equal(item.accelerator, action === 'undo' ? 'CmdOrCtrl+Z' : platform === 'win32' ? 'Ctrl+Y' : 'CmdOrCtrl+Shift+Z');
    assert.equal(edit.items.find(node => node.id === 'edit-' + action).canonicalCmdId, commandId);
    const before = h.commandCalls.length; item.click();
    assert.equal(h.commandCalls.length, before + 1);
    assert.deepEqual(JSON.parse(JSON.stringify(h.commandCalls.at(-1))), { commandId, payload: {}, options: { route: 'command.bus' } });
  }
}

test('current packaged history commands use actual builder click and canonical bus route on existing three platforms', async () => {
  for (const platform of ['darwin', 'win32', 'linux']) {
    const h = await nativeMenuRoleHarness({}, platform), runtime = h.context.resolveRuntimeMenuBuildConfig('promotion');
    assertCurrentHistoryProjection(h, runtime, platform);
    const artifact = h.readJson('docs/OPS/ARTIFACTS/menu/menu.normalized.json');
    assert.equal(artifact.snapshotId, SELECT_ALL_SNAPSHOT);
    assert.deepEqual(h.readJson('src/runtime-governance/docs/OPS/ARTIFACTS/menu/menu.normalized.json'), artifact);
    assert.deepEqual(JSON.parse(JSON.stringify(runtime.menus)), artifact.menus);
    assert.deepEqual(h.normalize().menus, artifact.menus);
  }
});

test('current canonical history stays available across every admitted child-control context without Writer visibility authority', async () => {
  const h = await nativeMenuRoleHarness();
  for (const profile of ['minimal', 'pro', 'guru']) for (const stage of ['X1', 'X2', 'X3', 'X4']) {
    for (const mode of ['offline', 'web_subset']) for (const hasDocument of [false, true]) for (const selectionExists of [false, true]) {
      assertCurrentHistoryProjection(h, h.normalize(h.config, { profile, stage, mode, hasDocument, selectionExists }));
    }
  }
});

test('current history oracle refuses role bypass, wrong commands, missing intent and hidden or gated menu entries', async () => {
  const h = await nativeMenuRoleHarness(); assertCurrentHistoryProjection(h, h.normalize());
  for (const action of ['undo', 'redo']) for (const mutation of ['omit', 'hidden', 'mode', 'profile', 'stage', 'role', 'wrong-command', 'missing-command', 'accelerator']) {
    const config = JSON.parse(JSON.stringify(h.config)), edit = config.menus.find(menu => menu.id === 'edit');
    const item = edit.items.find(node => node.id === 'edit-' + action);
    if (mutation === 'omit') edit.items = edit.items.filter(node => node !== item);
    if (mutation === 'hidden') item.visible = false;
    if (mutation === 'mode') item.mode = ['web_subset'];
    if (mutation === 'profile') item.profile = ['guru'];
    if (mutation === 'stage') item.stage = ['X4'];
    if (mutation === 'role') { delete item.command; item.role = action; }
    if (mutation === 'wrong-command') item.command = 'cmd.project.save';
    if (mutation === 'missing-command') delete item.command;
    if (mutation === 'accelerator') item.accelerator = 'CmdOrCtrl+S';
    assert.throws(() => assertCurrentHistoryProjection(h, h.normalize(config)), error => error.code === 'ERR_ASSERTION', action + ':' + mutation);
  }
});

// Execute the production document capture listener; this finite boundary proves
// shortcut ownership, not the browser's native edit history or OS responder.
async function documentHistoryShortcutHarness(platform) {
  const vm = require('node:vm');
  const source = await readFile(join(process.cwd(), 'src/renderer/editor.js'), 'utf8');
  const marker = "\ndocument.addEventListener('keydown', (event) => {";
  const start = source.indexOf(marker);
  assert.ok(start >= 0); assert.equal(source.indexOf(marker, start + 1), -1);
  const endMarker = '\n}, true);', end = source.indexOf(endMarker, start);
  assert.ok(end > start, 'whole actual capture listener exists');
  const { COMMAND_IDS, EXTRA_COMMAND_IDS } = await import('../../src/renderer/commands/projectCommands.mjs');
  const commands = [];
  let callback, prevented = 0, stopped = 0;
  class Element {
    constructor(tagName) {
      this.tagName = tagName; this.value = 'unchanged Ёж 🦊';
      this.selectionStart = 2; this.selectionEnd = 8;
    }
    closest(selector) {
      return selector.split(',').some(part => part.trim().toUpperCase() === this.tagName) ? this : null;
    }
  }
  const document = { activeElement: null, addEventListener(type, listener, capture) {
    assert.equal(type, 'keydown'); assert.equal(capture, true); assert.equal(callback, undefined); callback = listener;
  } };
  vm.runInNewContext(source.slice(start + 1, end + endMarker.length), {
    document, Element, HTMLElement: Element, isMac: platform === 'darwin',
    isLinkDialogOpen: () => false, configuratorPanel: null,
    leftRailOverlayOpen: false, rightRailOverlayOpen: false, flowModeState: { active: false },
    COMMAND_IDS, EXTRA_COMMAND_IDS, dispatchUiCommand(id) { commands.push(id); },
  });
  assert.equal(typeof callback, 'function');
  return { Element, commands, COMMAND_IDS, EXTRA_COMMAND_IDS,
    get prevented() { return prevented; }, get stopped() { return stopped; },
    invoke(target, key, overrides = {}) {
      document.activeElement = target;
      callback({ target, key, code: 'Key' + key.toUpperCase(),
        metaKey: platform === 'darwin', ctrlKey: platform !== 'darwin', altKey: false, shiftKey: false,
        preventDefault() { prevented++; }, stopPropagation() { stopped++; }, ...overrides });
    } };
}

const NATIVE_HISTORY_SHORTCUT_CASES = [
  ['z', false, 'EDIT_UNDO'], ['Z', false, 'EDIT_UNDO'],
  ['z', true, 'EDIT_REDO'], ['Z', true, 'EDIT_REDO'],
  ['y', false, 'EDIT_REDO'], ['Y', false, 'EDIT_REDO'],
];
for (const platform of ['darwin', 'win32']) {
  for (const tag of ['INPUT', 'TEXTAREA']) for (const [key, shiftKey] of NATIVE_HISTORY_SHORTCUT_CASES) {
    test('document history shortcut leaves native ' + tag + ' untouched: ' + platform + ':' + key + ':shift=' + shiftKey, async () => {
      const h = await documentHistoryShortcutHarness(platform), target = new h.Element(tag);
      const before = [target.value, target.selectionStart, target.selectionEnd];
      h.invoke(target, key, { shiftKey });
      assert.equal(h.prevented, 0, 'native control must retain default history behavior');
      assert.deepEqual(h.commands, [], 'native control must never dispatch Writer history');
      assert.equal(h.stopped, 0); assert.deepEqual([target.value, target.selectionStart, target.selectionEnd], before);
    });
  }
  test('document history shortcuts retain canonical Writer and body dispatch: ' + platform, async () => {
    for (const tag of ['DIV', 'BODY']) for (const [key, shiftKey, id] of NATIVE_HISTORY_SHORTCUT_CASES) {
      const h = await documentHistoryShortcutHarness(platform), target = new h.Element(tag);
      h.invoke(target, key, { shiftKey });
      assert.equal(h.prevented, 1); assert.deepEqual(h.commands, [h.EXTRA_COMMAND_IDS[id]]); assert.equal(h.stopped, 0);
    }
  });
  test('native history fence preserves unrelated shortcuts and primary-modifier refusal: ' + platform, async () => {
    for (const tag of ['INPUT', 'TEXTAREA', 'DIV']) {
      for (const overrides of [{ altKey: true }, { metaKey: false, ctrlKey: false }]) {
        const h = await documentHistoryShortcutHarness(platform); h.invoke(new h.Element(tag), 'z', overrides);
        assert.equal(h.prevented, 0); assert.deepEqual(h.commands, []); assert.equal(h.stopped, 0);
      }
      for (const [key, expected] of [['s', 'PROJECT_SAVE'], ['f', 'EDIT_FIND']]) {
        const h = await documentHistoryShortcutHarness(platform); h.invoke(new h.Element(tag), key);
        const id = key === 's' ? h.COMMAND_IDS[expected] : h.EXTRA_COMMAND_IDS[expected];
        assert.equal(h.prevented, 1); assert.deepEqual(h.commands, [id]); assert.equal(h.stopped, 0);
      }
    }
  });
}


// Actual Main defaults use the shipped namespace; the older advisory case
// above explicitly crosses namespaces and retains every original assertion.
for (const mode of ['release', 'promotion']) {
  test('actual Main correct packaged menu verification passes ' + mode + ' without an advisory', async () => {
    const h = await nativeMenuRoleHarness();
    if (mode === 'promotion') h.context.process.argv = ['--promotionMode=true'];
    assert.doesNotThrow(() => h.context.verifyMenuArtifactLockAtRuntime());
    assert.equal(h.verificationInputs.length, 1);
    assert.equal(h.verificationInputs[0].expectedSnapshotId, SELECT_ALL_SNAPSHOT);
    const state = h.verificationStates[0];
    assert.equal(state.mode, mode); assert.equal(state.result, 'PASS');
    assert.equal(state.exitCode, 0); assert.equal(state.mismatch, false);
    assert.deepEqual(state.issues, []); assert.equal(h.warnings.length, 0);
    assertNativeHistoryProjection(h, h.context.resolveRuntimeMenuBuildConfig(mode));
  });
}
