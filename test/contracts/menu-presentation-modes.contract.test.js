const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = process.cwd();
const CONFIG_V2_PATH = path.join(REPO_ROOT, 'src', 'menu', 'menu-config.v2.json');
const CONTEXT_PATH = path.join(REPO_ROOT, 'test', 'fixtures', 'menu', 'context.default.json');
const NORMALIZER_PATH = path.join(REPO_ROOT, 'src', 'menu', 'menu-config-normalizer.js');
const MAIN_PATH = path.join(REPO_ROOT, 'src', 'main.js');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getViewMenu(config) {
  return config.menus.find((menu) => menu && menu.id === 'view');
}

test('menu presentation modes: canonical switch surface is authored in view menu at the required location', () => {
  const config = readJson(CONFIG_V2_PATH);
  const viewMenu = getViewMenu(config);
  assert.ok(viewMenu, 'expected view menu in canonical config');

  const itemIds = viewMenu.items.map((item) => item.id);
  const customizationIndex = itemIds.indexOf('view-menu-customization');
  if (customizationIndex === -1) {
    assert.deepEqual(
      itemIds.slice(0, 4),
      ['view-settings', 'view-presentation-mode', 'view-language', 'view-safe-reset'],
      'presentation switch container must stay before language and safe reset until the customization surface lands',
    );
  } else {
    assert.deepEqual(
      itemIds.slice(0, 5),
      [
        'view-settings',
        'view-presentation-mode',
        'view-language',
        'view-menu-customization',
        'view-safe-reset',
      ],
      'presentation switch container must leave room for the bounded customization surface before safe reset',
    );
  }

  const switchContainer = viewMenu.items.find((item) => item.id === 'view-presentation-mode');
  assert.ok(switchContainer, 'expected view-presentation-mode container');
  assert.equal(switchContainer.label, 'Presentation Mode');
  assert.deepEqual(
    (switchContainer.items || []).map((item) => ({
      id: item.id,
      command: item.command,
    })),
    [
      {
        id: 'view-presentation-classic',
        command: 'cmd.project.view.setMenuPresentationClassic',
      },
      {
        id: 'view-presentation-compact',
        command: 'cmd.project.view.setMenuPresentationCompact',
      },
    ],
  );
});

test('menu presentation modes: normalization preserves canonical placement and nested switch order', () => {
  const { normalizeMenuConfigPipeline } = require(NORMALIZER_PATH);
  const config = readJson(CONFIG_V2_PATH);
  const context = readJson(CONTEXT_PATH);

  const state = normalizeMenuConfigPipeline({
    baseConfig: config,
    overlays: [],
    context,
    baseSourceRef: CONFIG_V2_PATH,
  });

  assert.equal(state.ok, true, JSON.stringify(state.diagnostics, null, 2));

  const viewMenu = state.normalizedConfig.menus.find((menu) => menu && menu.id === 'view');
  assert.ok(viewMenu, 'expected normalized view menu');

  const normalizedItemIds = viewMenu.items.map((item) => item.id);
  const normalizedCustomizationIndex = normalizedItemIds.indexOf('view-menu-customization');
  if (normalizedCustomizationIndex === -1) {
    assert.deepEqual(
      normalizedItemIds.slice(0, 4),
      ['view-settings', 'view-presentation-mode', 'view-language', 'view-safe-reset'],
      'normalized view order must preserve the current canonical placement until the customization surface lands',
    );
  } else {
    assert.deepEqual(
      normalizedItemIds.slice(0, 5),
      [
        'view-settings',
        'view-presentation-mode',
        'view-language',
        'view-menu-customization',
        'view-safe-reset',
      ],
      'normalized view order must preserve canonical placement of presentation switch container ahead of bounded customization and safe reset',
    );
  }

  const switchContainer = viewMenu.items.find((item) => item.id === 'view-presentation-mode');
  assert.ok(switchContainer, 'expected normalized presentation switch container');
  assert.deepEqual(
    (switchContainer.items || []).map((item) => ({
      id: item.id,
      canonicalCmdId: item.canonicalCmdId,
    })),
    [
      {
        id: 'view-presentation-classic',
        canonicalCmdId: 'cmd.project.view.setMenuPresentationClassic',
      },
      {
        id: 'view-presentation-compact',
        canonicalCmdId: 'cmd.project.view.setMenuPresentationCompact',
      },
    ],
  );
});

test('menu presentation modes: darwin compact projection preserves a visible compact root beside the platform app menu', () => {
  const mainSource = fs.readFileSync(MAIN_PATH, 'utf8');

  assert.match(
    mainSource,
    /if \(process\.platform === 'darwin'\)\s*\{\s*return \[\s*\{\s*role: 'appMenu'\s*\},\s*compactRoot,\s*\];\s*\}/m,
    'compact projection must insert an explicit appMenu adapter on darwin so the compact root remains visible',
  );
});

test('menu presentation modes: compact projection dedupes duplicate id groups before build', () => {
  const mainSource = fs.readFileSync(MAIN_PATH, 'utf8');

  assert.match(
    mainSource,
    /function dedupeCompactRootSubmenu\(items\)/,
    'compact projection must define a duplicate-id suppression step for compact root items',
  );
  assert.match(
    mainSource,
    /submenu:\s*dedupeCompactRootSubmenu\(compactRootSubmenu\)/,
    'compact root submenu must pass through dedupeCompactRootSubmenu before Menu.buildFromTemplate',
  );
});
