const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = process.cwd();
const SPEC_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'MENU_CONFIG_NORMALIZATION_SPEC_v1.json');
const NORMALIZER_PATH = path.join(REPO_ROOT, 'src', 'menu', 'menu-config-normalizer.js');
const OPS_SCRIPT_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'menu-config-normalize.mjs');
const EXAMPLE_CONFIG_PATH = path.join(REPO_ROOT, 'src', 'menu', 'menu-config.v2.json');
const DEFAULT_CONTEXT_PATH = path.join(REPO_ROOT, 'test', 'fixtures', 'menu', 'context.default.json');
const FAILSIGNAL_REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json');
const TOKEN_CATALOG_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'TOKENS', 'TOKEN_CATALOG.json');
const REQUIRED_SET_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'EXECUTION', 'REQUIRED_TOKEN_SET.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function flattenStrings(input, out = []) {
  if (Array.isArray(input)) {
    input.forEach((entry) => flattenStrings(entry, out));
    return out;
  }
  if (!input || typeof input !== 'object') {
    if (typeof input === 'string') out.push(input);
    return out;
  }
  Object.values(input).forEach((value) => flattenStrings(value, out));
  return out;
}

function walkMenuItems(items, visit) {
  if (!Array.isArray(items)) return;
  items.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    visit(item);
    walkMenuItems(item.items, visit);
  });
}

function getMenuById(menus, id) {
  return Array.isArray(menus) ? menus.find((menu) => menu && menu.id === id) : null;
}

function getMenuItemById(items, id) {
  return Array.isArray(items) ? items.find((item) => item && item.id === id) : null;
}

function collectSourceRefsFromNormalizedMenus(menus) {
  const refs = [];
  walkMenuItems(menus, (item) => {
    if (!Array.isArray(item.sourceRefs)) return;
    item.sourceRefs.forEach((entry) => {
      if (typeof entry === 'string' && entry.length > 0) refs.push(entry);
    });
  });
  return refs;
}

function runNormalizeCli(args) {
  return spawnSync(process.execPath, [OPS_SCRIPT_PATH, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
}

function makeSimpleConfig(overrides = {}) {
  const base = {
    version: 'v2',
    fonts: [
      { id: 'font-1', label: 'Serif', value: 'serif' },
    ],
    localeCatalog: {
      version: 'v1',
      locales: ['base', 'ru', 'en'],
      entries: {
        'menu.test.file': {
          base: 'File',
          ru: 'Файл',
          en: 'File',
        },
        'menu.test.file.save': {
          base: 'Save',
          ru: 'Сохранить',
          en: 'Save',
        },
      },
    },
    menus: [
      {
        id: 'file',
        label: 'File',
        labelKey: 'menu.test.file',
        items: [
          {
            id: 'save',
            label: 'Save',
            labelKey: 'menu.test.file.save',
            command: 'cmd.project.save',
            enabledWhen: { op: 'all', args: [] },
            mode: ['offline'],
            profile: ['minimal', 'pro', 'guru'],
            stage: ['X1', 'X2', 'X3', 'X4'],
          },
        ],
      },
    ],
  };
  return Object.assign(base, overrides);
}

test('menu normalization spec exists and normalizer entrypoint is present', () => {
  assert.equal(fs.existsSync(SPEC_PATH), true, 'missing MENU_CONFIG_NORMALIZATION_SPEC_v1.json');
  assert.equal(fs.existsSync(NORMALIZER_PATH), true, 'missing menu-config-normalizer.js');

  const spec = readJson(SPEC_PATH);
  assert.equal(spec.normalizedShapeVersion, 'v1');
  assert.equal(Array.isArray(spec.normalizedItemRequiredFields), true);
  assert.equal(spec.normalizedItemRequiredFields.includes('canonicalCmdId'), true);
  assert.equal(spec.rules.forbidActionIdInNormalizedOutput, true);
});

test('menu normalization is deterministic for identical inputs', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'menu-normalize-contract-'));
  const outA = path.join(tmpDir, 'normalized-a.json');
  const outB = path.join(tmpDir, 'normalized-b.json');
  try {
    const first = runNormalizeCli([
      '--in',
      EXAMPLE_CONFIG_PATH,
      '--context',
      DEFAULT_CONTEXT_PATH,
      '--out',
      outA,
      '--json',
    ]);
    assert.equal(first.status, 0, first.stdout || first.stderr);

    const second = runNormalizeCli([
      '--in',
      EXAMPLE_CONFIG_PATH,
      '--context',
      DEFAULT_CONTEXT_PATH,
      '--out',
      outB,
      '--json',
    ]);
    assert.equal(second.status, 0, second.stdout || second.stderr);

    const payloadA = readJson(outA);
    const payloadB = readJson(outB);
    assert.equal(typeof payloadA.normalizedHashSha256, 'string');
    assert.equal(payloadA.normalizedHashSha256.length, 64);
    assert.equal(payloadA.normalizedHashSha256, payloadB.normalizedHashSha256);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('menu normalization hash is stable for absolute and repo-relative input paths', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'menu-normalize-path-stable-'));
  const outAbs = path.join(tmpDir, 'normalized-abs.json');
  const outRel = path.join(tmpDir, 'normalized-rel.json');
  try {
    const absRun = runNormalizeCli([
      '--in',
      EXAMPLE_CONFIG_PATH,
      '--context',
      DEFAULT_CONTEXT_PATH,
      '--out',
      outAbs,
      '--json',
    ]);
    assert.equal(absRun.status, 0, absRun.stdout || absRun.stderr);

    const relRun = runNormalizeCli([
      '--in',
      'src/menu/menu-config.v2.json',
      '--context',
      DEFAULT_CONTEXT_PATH,
      '--out',
      outRel,
      '--json',
    ]);
    assert.equal(relRun.status, 0, relRun.stdout || relRun.stderr);

    const absPayload = readJson(outAbs);
    const relPayload = readJson(outRel);
    assert.equal(absPayload.normalizedHashSha256, relPayload.normalizedHashSha256);

    const absSourceRefs = collectSourceRefsFromNormalizedMenus(absPayload.normalizedConfig?.menus);
    assert.ok(absSourceRefs.length > 0, 'expected sourceRefs in normalized menu payload');
    assert.equal(absSourceRefs.every((entry) => !path.isAbsolute(entry)), true, `sourceRefs must be repo-relative: ${JSON.stringify(absSourceRefs)}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('normalized output has canonical-only command IDs, AST-only enabledWhen, and no actionId', () => {
  const { normalizeMenuConfigPipeline } = require(NORMALIZER_PATH);
  const state = normalizeMenuConfigPipeline({
    baseConfig: readJson(EXAMPLE_CONFIG_PATH),
    overlays: [],
    context: readJson(DEFAULT_CONTEXT_PATH),
    baseSourceRef: 'src/menu/menu-config.v2.json',
  });

  assert.equal(state.ok, true, JSON.stringify(state.diagnostics, null, 2));
  const normalized = state.normalizedConfig;
  assert.equal(normalized.normalizedShapeVersion, 'v1');

  walkMenuItems(normalized.menus, (item) => {
    assert.equal(Object.prototype.hasOwnProperty.call(item, 'actionId'), false, 'normalized item cannot contain actionId');
    assert.equal(Object.prototype.hasOwnProperty.call(item, 'command'), false, 'normalized item cannot contain raw command');

    if (typeof item.canonicalCmdId === 'string' && item.canonicalCmdId.length > 0) {
      assert.equal(item.canonicalCmdId.startsWith('cmd.project.'), true, `non-canonical cmd id: ${item.canonicalCmdId}`);
      assert.ok(item.enabledWhenAst && typeof item.enabledWhenAst === 'object' && !Array.isArray(item.enabledWhenAst));
    } else {
      assert.equal(item.canonicalCmdId, null);
      assert.equal(item.enabledWhenAst === null || typeof item.enabledWhenAst === 'object', true);
    }

    if (item.enabledWhenAst !== null) {
      assert.notEqual(typeof item.enabledWhenAst, 'string');
    }
  });
});

test('menu customization normalization preserves submenuFrom markers and the canonical menu shape', () => {
  const { normalizeMenuConfigPipeline } = require(NORMALIZER_PATH);
  const state = normalizeMenuConfigPipeline({
    baseConfig: readJson(EXAMPLE_CONFIG_PATH),
    overlays: [],
    context: readJson(DEFAULT_CONTEXT_PATH),
    baseSourceRef: 'src/menu/menu-config.v2.json',
  });

  assert.equal(state.ok, true, JSON.stringify(state.diagnostics, null, 2));

  const normalized = state.normalizedConfig;
  assert.deepEqual(
    normalized.menus.map((menu) => menu.id),
    ['file', 'edit', 'view', 'insert', 'format', 'plan', 'review', 'tools', 'window', 'help'],
  );

  const viewMenu = getMenuById(normalized.menus, 'view');
  assert.ok(viewMenu, 'expected normalized view menu');
  const customization = getMenuItemById(viewMenu.items, 'view-menu-customization');
  assert.ok(customization, 'expected normalized customization container');
  assert.deepEqual(
    (customization.items || []).map((item) => item.id),
    [
      'view-menu-customization-visibility',
      'view-menu-customization-order',
      'view-menu-customization-reset',
    ],
    'normalized customization container must keep visibility first, then order, then reset',
  );
  const resetItem = getMenuItemById(customization.items, 'view-menu-customization-reset');
  const visibilityItem = getMenuItemById(customization.items, 'view-menu-customization-visibility');
  const orderItem = getMenuItemById(customization.items, 'view-menu-customization-order');

  assert.equal(resetItem.canonicalCmdId, 'cmd.project.view.resetMenuCustomization');
  assert.equal(Object.prototype.hasOwnProperty.call(resetItem, 'command'), false);
  assert.equal(visibilityItem.submenuFrom, 'menuCustomizationVisibilitySections');
  assert.equal(orderItem.submenuFrom, 'menuCustomizationOrderSections');
  assert.equal(Object.prototype.hasOwnProperty.call(visibilityItem, 'actionId'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(orderItem, 'actionId'), false);
  assert.equal(
    normalized.sourceRefs.includes('src/menu/menu-config.v2.json'),
    true,
    'normalized sourceRefs must include menu-config.v2.json',
  );
  assert.equal(
    normalized.sourceRefs.includes('src/menu/menu-locale.catalog.v1.json'),
    true,
    'normalized sourceRefs must include menu-locale.catalog.v1.json',
  );
});

test('negative: string enabledWhen is rejected', () => {
  const { normalizeMenuConfigPipeline } = require(NORMALIZER_PATH);
  const config = makeSimpleConfig();
  config.menus[0].items[0].enabledWhen = 'hasDocument';

  const state = normalizeMenuConfigPipeline({
    baseConfig: config,
    overlays: [],
    context: readJson(DEFAULT_CONTEXT_PATH),
    baseSourceRef: 'fixture:string-enabledWhen',
  });

  assert.equal(state.ok, false);
  assert.ok(state.diagnostics.errors.some((entry) => entry.code === 'E_MENU_NORMALIZATION_ENABLEDWHEN_STRING'));
});

test('negative: unknown cmdId without alias is rejected', () => {
  const { normalizeMenuConfigPipeline } = require(NORMALIZER_PATH);
  const config = makeSimpleConfig();
  config.menus[0].items[0].command = 'cmd.unknown.save';

  const state = normalizeMenuConfigPipeline({
    baseConfig: config,
    overlays: [],
    context: readJson(DEFAULT_CONTEXT_PATH),
    baseSourceRef: 'fixture:unknown-cmd',
  });

  assert.equal(state.ok, false);
  assert.ok(state.diagnostics.errors.some((entry) => entry.code === 'E_MENU_NORMALIZATION_COMMAND_NON_CANON'));
});

test('negative: overlay order is fixed by origin precedence', () => {
  const { normalizeMenuConfigPipeline } = require(NORMALIZER_PATH);
  const config = makeSimpleConfig();

  const overlays = [
    {
      origin: 'plugin',
      sourceRef: 'plugin-override',
      config: {
        menus: [{ id: 'file', items: [{ id: 'save', command: 'cmd.project.saveAs' }] }],
      },
    },
    {
      origin: 'profile',
      sourceRef: 'profile-override',
      config: {
        menus: [{ id: 'file', items: [{ id: 'save', command: 'cmd.project.open' }] }],
      },
    },
  ];

  const state = normalizeMenuConfigPipeline({
    baseConfig: config,
    overlays,
    context: readJson(DEFAULT_CONTEXT_PATH),
    baseSourceRef: 'fixture:overlay-order',
  });

  assert.equal(state.ok, true, JSON.stringify(state.diagnostics, null, 2));
  const saveItem = state.normalizedConfig.menus[0].items.find((item) => item.id === 'save');
  assert.ok(saveItem);
  assert.equal(saveItem.canonicalCmdId, 'cmd.project.saveAs');
  assert.deepEqual(state.diagnostics.overlayOrder.map((row) => row.origin), ['profile', 'plugin']);
});

test('negative: hiding a core command in Minimal profile is rejected', () => {
  const { normalizeMenuConfigPipeline } = require(NORMALIZER_PATH);
  const config = makeSimpleConfig();
  config.menus[0].items[0].visible = false;

  const state = normalizeMenuConfigPipeline({
    baseConfig: config,
    overlays: [],
    context: readJson(DEFAULT_CONTEXT_PATH),
    baseSourceRef: 'fixture:core-hidden',
  });

  assert.equal(state.ok, false);
  assert.ok(state.diagnostics.errors.some((entry) => entry.code === 'E_MENU_NORMALIZATION_CORE_HIDDEN'));
});

test('negative: X5 stage condition is rejected', () => {
  const { normalizeMenuConfigPipeline } = require(NORMALIZER_PATH);
  const config = makeSimpleConfig();
  config.menus[0].items[0].enabledWhen = {
    op: 'stageGte',
    value: 'X5',
  };

  const state = normalizeMenuConfigPipeline({
    baseConfig: config,
    overlays: [],
    context: readJson(DEFAULT_CONTEXT_PATH),
    baseSourceRef: 'fixture:x5-stage',
  });

  assert.equal(state.ok, false);
  assert.ok(state.diagnostics.errors.some((entry) => entry.code === 'E_MENU_NORMALIZATION_ENABLEDWHEN_INVALID'));
});

test('failSignal/token are registered and token is not in required set', () => {
  const failRegistry = readJson(FAILSIGNAL_REGISTRY_PATH);
  const signal = (failRegistry.failSignals || []).find((entry) => entry && entry.code === 'E_MENU_NORMALIZATION_DRIFT');
  assert.ok(signal, 'E_MENU_NORMALIZATION_DRIFT must exist in failSignal registry');
  assert.ok(signal.modeMatrix && typeof signal.modeMatrix === 'object');
  assert.equal(signal.modeMatrix.prCore, 'advisory');
  assert.equal(signal.modeMatrix.release, 'advisory');
  assert.equal(signal.modeMatrix.promotion, 'blocking');

  const tokenCatalog = readJson(TOKEN_CATALOG_PATH);
  const token = (tokenCatalog.tokens || []).find((entry) => entry && entry.tokenId === 'MENU_CONFIG_NORMALIZED_DETERMINISTIC_OK');
  assert.ok(token, 'MENU_CONFIG_NORMALIZED_DETERMINISTIC_OK must exist in token catalog');
  assert.equal(token.failSignalCode, 'E_MENU_NORMALIZATION_DRIFT');

  const requiredSet = readJson(REQUIRED_SET_PATH);
  const flattened = flattenStrings(requiredSet);
  assert.equal(flattened.includes('MENU_CONFIG_NORMALIZED_DETERMINISTIC_OK'), false);
});
