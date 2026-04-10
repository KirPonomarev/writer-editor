const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = process.cwd();
const CONFIG_PATH = path.join(REPO_ROOT, 'src', 'menu', 'menu-config.v2.json');
const CATALOG_PATH = path.join(REPO_ROOT, 'src', 'menu', 'menu-locale.catalog.v1.json');
const CONTEXT_PATH = path.join(REPO_ROOT, 'test', 'fixtures', 'menu', 'context.default.json');
const NORMALIZER_PATH = path.join(REPO_ROOT, 'src', 'menu', 'menu-config-normalizer.js');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getMenuById(menus, id) {
  return Array.isArray(menus) ? menus.find((menu) => menu && menu.id === id) : null;
}

function getMenuItemById(items, id) {
  return Array.isArray(items) ? items.find((item) => item && item.id === id) : null;
}

function getTopLevelMenuIds(config) {
  return Array.isArray(config.menus) ? config.menus.map((menu) => menu.id).filter(Boolean) : [];
}

function getOptionalTopLevelMenuIds(config) {
  const fixedIds = new Set(['file', 'edit', 'view', 'help']);
  return getTopLevelMenuIds(config).filter((id) => !fixedIds.has(id));
}

test('menu hide-show reorder contract: optional top-level sections are derived from the canonical top-level set', () => {
  const config = readJson(CONFIG_PATH);

  assert.deepEqual(
    getTopLevelMenuIds(config),
    ['file', 'edit', 'view', 'insert', 'format', 'plan', 'review', 'tools', 'window', 'help'],
    'canonical top-level menu ids must remain stable',
  );
  assert.deepEqual(
    getTopLevelMenuIds(config).slice(0, 3),
    ['file', 'edit', 'view'],
    'hide/show reorder must keep file/edit/view as the fixed prefix',
  );
  assert.equal(getTopLevelMenuIds(config).at(-1), 'help', 'hide/show reorder must keep help as the fixed visible tail');
  assert.deepEqual(
    getOptionalTopLevelMenuIds(config),
    ['insert', 'format', 'plan', 'review', 'tools', 'window'],
    'optional sections must be derived from the current top-level set minus file/edit/view/help',
  );
});

test('menu hide-show reorder contract: the bounded customization surface is authored in view at the required location', () => {
  const config = readJson(CONFIG_PATH);
  const viewMenu = getMenuById(config.menus, 'view');

  assert.ok(viewMenu, 'expected canonical view menu');
  const customization = getMenuItemById(viewMenu.items, 'view-menu-customization');
  assert.ok(customization, 'expected view-menu-customization container');

  assert.deepEqual(
    viewMenu.items.map((item) => item.id).slice(0, 5),
    [
      'view-settings',
      'view-presentation-mode',
      'view-language',
      'view-menu-customization',
      'view-safe-reset',
    ],
    'customization surface must stay after view-language and before view-safe-reset',
  );

  assert.deepEqual(
    (customization.items || []).map((item) => item.id),
    [
      'view-menu-customization-visibility',
      'view-menu-customization-order',
      'view-menu-customization-reset',
    ],
    'customization container must keep visibility first, then order, then reset',
  );

  const visibilityItem = getMenuItemById(customization.items, 'view-menu-customization-visibility');
  const orderItem = getMenuItemById(customization.items, 'view-menu-customization-order');
  const resetItem = getMenuItemById(customization.items, 'view-menu-customization-reset');

  assert.equal(resetItem.command, 'cmd.project.view.resetMenuCustomization');
  assert.equal(Object.prototype.hasOwnProperty.call(resetItem, 'canonicalCmdId'), false);
  assert.equal(visibilityItem.submenuFrom, 'menuCustomizationVisibilitySections');
  assert.equal(orderItem.submenuFrom, 'menuCustomizationOrderSections');
  assert.equal(Object.prototype.hasOwnProperty.call(visibilityItem, 'command'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(orderItem, 'command'), false);
});

test('menu hide-show reorder contract: locale catalog must cover the customization labels', () => {
  const config = readJson(CONFIG_PATH);
  const catalog = readJson(CATALOG_PATH);
  const viewMenu = getMenuById(config.menus, 'view');
  assert.ok(viewMenu, 'expected canonical view menu');
  const customization = getMenuItemById(viewMenu.items, 'view-menu-customization');
  assert.ok(customization, 'expected view-menu-customization container');

  const labeledNodes = [
    customization,
    ...(customization.items || []),
  ].filter((node) => node && typeof node === 'object' && typeof node.label === 'string' && node.label.length > 0);

  assert.ok(labeledNodes.length > 0, 'expected customization labels');

  labeledNodes.forEach((node) => {
    assert.equal(typeof node.labelKey, 'string', `missing labelKey for ${node.id}`);
    assert.notEqual(node.labelKey.trim(), '', `empty labelKey for ${node.id}`);
    const entry = catalog.entries[node.labelKey];
    assert.ok(entry && typeof entry === 'object', `missing locale catalog entry for ${node.labelKey}`);
    assert.equal(entry.base, node.label, `base locale mismatch for ${node.labelKey}`);
    assert.equal(typeof entry.ru, 'string', `missing ru locale for ${node.labelKey}`);
    assert.notEqual(entry.ru.trim(), '', `empty ru locale for ${node.labelKey}`);
    assert.equal(typeof entry.en, 'string', `missing en locale for ${node.labelKey}`);
    assert.notEqual(entry.en.trim(), '', `empty en locale for ${node.labelKey}`);
  });
});

test('menu hide-show reorder contract: normalization preserves submenuFrom markers without inventing a second structure model', () => {
  const { normalizeMenuConfigPipeline } = require(NORMALIZER_PATH);
  const state = normalizeMenuConfigPipeline({
    baseConfig: readJson(CONFIG_PATH),
    overlays: [],
    context: readJson(CONTEXT_PATH),
    baseSourceRef: 'src/menu/menu-config.v2.json',
  });

  assert.equal(state.ok, true, JSON.stringify(state.diagnostics, null, 2));
  assert.ok(state.normalizedConfig && typeof state.normalizedConfig === 'object');
  assert.deepEqual(
    state.normalizedConfig.menus.map((menu) => menu.id),
    ['file', 'edit', 'view', 'insert', 'format', 'plan', 'review', 'tools', 'window', 'help'],
  );

  const viewMenu = getMenuById(state.normalizedConfig.menus, 'view');
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
  assert.deepEqual(
    [...state.normalizedConfig.sourceRefs].sort((a, b) => a.localeCompare(b)),
    ['src/menu/menu-config.v2.json', 'src/menu/menu-locale.catalog.v1.json'],
  );
});
