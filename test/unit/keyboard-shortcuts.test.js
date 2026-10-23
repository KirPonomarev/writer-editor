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
const SELECT_ALL_SNAPSHOT = 'menu-default-desktop-minimal-select-all-20261023';
async function nativeMenuRoleHarness() {
  const fs = require('node:fs'), vm = require('node:vm');
  const source = await readFile(join(process.cwd(), 'src/main.js'), 'utf8');
  const readJson = file => JSON.parse(fs.readFileSync(join(process.cwd(), file), 'utf8'));
  const artifactPort = require('../../src/menu/menu-artifact-lock.js');
  const sourcePolicy = require('../../src/menu/menu-runtime-source-policy.js');
  const normalizer = require('../../src/menu/menu-config-normalizer.js');
  const verificationInputs = [], verificationStates = [], warnings = [];
  const context = { process: { platform: 'darwin', env: {}, argv: [] }, path: require('node:path'), fsSync: fs,
    DEFAULT_MENU_ARTIFACT_PATH: artifactPort.DEFAULT_ARTIFACT_PATH, MENU_ARTIFACT_RESULT_FAIL: artifactPort.RESULT_FAIL,
    resolveMenuArtifactModeFromInput: artifactPort.resolveModeFromInput,
    ...sourcePolicy, normalizeMenuConfigPipeline: normalizer.normalizeMenuConfigPipeline,
    console: { warn: message => warnings.push(message) },
    evaluateMenuArtifactLockState(input) {
      verificationInputs.push(JSON.parse(JSON.stringify(input)));
      const state = artifactPort.evaluateMenuArtifactLockState(input); verificationStates.push(state); return state;
    },
    buildCommandClickHandler() { throw Error('FINITE_PORT_UNEXPECTED_PRODUCT_COMMAND'); },
  };
  vm.createContext(context);
  const names = ['normalizeRuntimeString', 'isRuntimeRecord', 'createRuntimeMenuPolicyError', 'emitRuntimeMenuAdvisory',
    'parseRuntimeJsonInput', 'resolveRuntimeMenuLocaleCatalog', 'normalizeRuntimeOverlayPayload', 'normalizeRuntimeContextPayload',
    'resolveRuntimeMenuArtifactPath', 'resolveRawConfigMixAttempt', 'readMenuArtifactDocument', 'resolveRuntimeMenuBuildConfig',
    'buildMenuItemFromConfig', 'resolveRuntimeMenuArtifactMode', 'verifyMenuArtifactLockAtRuntime'];
  const functions = names.map(name => {
    const start = source.indexOf('function ' + name + '('), end = source.indexOf('\n}\n', start);
    assert.ok(start >= 0 && end > start, 'actual Main function exists: ' + name); return source.slice(start, end + 2);
  });
  const roleStart = source.indexOf('const ALLOWED_MENU_ROLES ='), roleEnd = source.indexOf('const MENU_RUNTIME_OVERLAYS_ENV_PATH', roleStart);
  assert.ok(roleStart >= 0 && roleEnd > roleStart);
  const constants = ['MENU_RUNTIME_OVERLAYS_ENV_PATH', 'MENU_RUNTIME_OVERLAYS_ENV_JSON', 'MENU_RUNTIME_CONTEXT_ENV_PATH',
    'MENU_RUNTIME_CONTEXT_ENV_JSON', 'MENU_RUNTIME_ARTIFACT_ENV_PATH', 'MENU_RUNTIME_RAW_CONFIG_ENV_PATH', 'MENU_RUNTIME_LEGACY_RAW_CONFIG_ENV_PATH'];
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
  return { context, config, readJson, normalize, nativeItem, verificationInputs, verificationStates, warnings };
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
  const h = await nativeMenuRoleHarness(); h.context.verifyMenuArtifactLockAtRuntime();
  assert.equal(h.verificationInputs.length, 1); assert.equal(h.verificationInputs[0].expectedSnapshotId, SELECT_ALL_SNAPSHOT);
  const state = h.verificationStates[0], artifact = h.readJson('src/runtime-governance/docs/OPS/ARTIFACTS/menu/menu.normalized.json');
  assert.equal(state.issues.some(row => row.code === 'EXPECTED_SNAPSHOT_ID_MISMATCH'), artifact.snapshotId !== SELECT_ALL_SNAPSHOT);
  assert.equal(state.issues.some(row => row.code === 'LOCK_ARTIFACT_PATH_MISMATCH'), true, 'existing mirror path issue is not hidden or repaired');
  assert.equal(state.result, 'WARN'); assert.equal(h.warnings.length, 1);
  h.context.process.argv = ['--promotionMode=true'];
  assert.throws(() => h.context.verifyMenuArtifactLockAtRuntime(), error => error.failSignalCode === 'E_MENU_ARTIFACT_TAMPER_OR_DRIFT');
  assert.equal(h.verificationStates.at(-1).result, 'FAIL');
});
