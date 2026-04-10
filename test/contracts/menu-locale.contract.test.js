const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = process.cwd();
const CONFIG_PATH = path.join(REPO_ROOT, 'src', 'menu', 'menu-config.v2.json');
const CATALOG_PATH = path.join(REPO_ROOT, 'src', 'menu', 'menu-locale.catalog.v1.json');
const CATALOG_SCHEMA_PATH = path.join(REPO_ROOT, 'src', 'menu', 'menu-locale.catalog.schema.v1.json');
const CONTEXT_PATH = path.join(REPO_ROOT, 'test', 'fixtures', 'menu', 'context.default.json');
const MAIN_PATH = path.join(REPO_ROOT, 'src', 'main.js');
const NORMALIZER_PATH = path.join(REPO_ROOT, 'src', 'menu', 'menu-config-normalizer.js');
const VALIDATOR_PATH = path.join(REPO_ROOT, 'src', 'menu', 'menu-config-validator.js');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function walkMenuItems(items, visit) {
  if (!Array.isArray(items)) return;
  items.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    visit(item);
    walkMenuItems(item.items, visit);
  });
}

function collectLabeledNodes(config) {
  const labeledNodes = [];
  walkMenuItems(config.menus, (item) => {
    if (typeof item.label === 'string' && item.label.length > 0) {
      labeledNodes.push(item);
    }
  });
  return labeledNodes;
}

test('menu locale contract: catalog and schema files exist and validate', () => {
  assert.equal(fs.existsSync(CATALOG_PATH), true, 'missing menu-locale.catalog.v1.json');
  assert.equal(fs.existsSync(CATALOG_SCHEMA_PATH), true, 'missing menu-locale.catalog.schema.v1.json');

  const { loadAndValidateMenuLocaleCatalog } = require(VALIDATOR_PATH);
  const state = loadAndValidateMenuLocaleCatalog({
    catalogPath: CATALOG_PATH,
    schemaPath: CATALOG_SCHEMA_PATH,
  });

  assert.equal(state.ok, true, `expected valid locale catalog\nerrors:\n${JSON.stringify(state.errors, null, 2)}`);
  assert.equal(state.catalog.version, 'v1');
  assert.deepEqual(state.catalog.locales, ['base', 'ru', 'en']);
});

test('menu locale contract: every labeled config node has labelKey and complete catalog coverage', () => {
  const config = readJson(CONFIG_PATH);
  const catalog = readJson(CATALOG_PATH);
  const entries = catalog.entries || {};
  const labeledNodes = collectLabeledNodes(config);

  assert.ok(labeledNodes.length > 0, 'expected labeled menu nodes in config');

  labeledNodes.forEach((node) => {
    assert.equal(typeof node.labelKey, 'string', `missing labelKey for node ${node.id || node.label}`);
    assert.notEqual(node.labelKey.trim(), '', `empty labelKey for node ${node.id || node.label}`);

    const entry = entries[node.labelKey];
    assert.ok(entry && typeof entry === 'object', `missing locale catalog entry for ${node.labelKey}`);
    assert.equal(entry.base, node.label, `base locale mismatch for ${node.labelKey}`);
    assert.equal(typeof entry.ru, 'string', `missing ru locale for ${node.labelKey}`);
    assert.notEqual(entry.ru.trim(), '', `empty ru locale for ${node.labelKey}`);
    assert.equal(typeof entry.en, 'string', `missing en locale for ${node.labelKey}`);
    assert.notEqual(entry.en.trim(), '', `empty en locale for ${node.labelKey}`);
  });

  assert.ok(entries['menu.help.aboutLicenses'], 'missing menu.help.aboutLicenses catalog entry');
});

test('menu locale contract: language switch is authored in view menu at the required location', () => {
  const config = readJson(CONFIG_PATH);
  const viewMenu = config.menus.find((menu) => menu && menu.id === 'view');
  assert.ok(viewMenu, 'expected view menu in canonical config');

  const itemIds = viewMenu.items.map((item) => item.id);
  assert.deepEqual(
    itemIds.slice(0, 4),
    ['view-settings', 'view-presentation-mode', 'view-language', 'view-safe-reset'],
    'view-language must stay after presentation switch and before safe reset',
  );

  const languageSwitch = viewMenu.items.find((item) => item.id === 'view-language');
  assert.ok(languageSwitch, 'expected view-language container');
  assert.deepEqual(
    (languageSwitch.items || []).map((item) => ({
      id: item.id,
      command: item.command,
    })),
    [
      { id: 'view-language-base', command: 'cmd.project.view.setMenuLocaleBase' },
      { id: 'view-language-ru', command: 'cmd.project.view.setMenuLocaleRu' },
      { id: 'view-language-en', command: 'cmd.project.view.setMenuLocaleEn' },
    ],
  );
});

test('menu locale contract: normalization embeds localeCatalog and records locale catalog sourceRef', () => {
  const { normalizeMenuConfigPipeline } = require(NORMALIZER_PATH);
  const state = normalizeMenuConfigPipeline({
    baseConfig: readJson(CONFIG_PATH),
    overlays: [],
    context: readJson(CONTEXT_PATH),
    baseSourceRef: 'src/menu/menu-config.v2.json',
  });

  assert.equal(state.ok, true, JSON.stringify(state.diagnostics, null, 2));
  assert.ok(state.normalizedConfig && typeof state.normalizedConfig === 'object');
  assert.equal(state.normalizedConfig.localeCatalog.version, 'v1');
  assert.deepEqual(state.normalizedConfig.localeCatalog.locales, ['base', 'ru', 'en']);
  assert.equal(Array.isArray(state.normalizedConfig.sourceRefs), true);
  assert.ok(
    state.normalizedConfig.sourceRefs.includes('src/menu/menu-config.v2.json'),
    'normalized sourceRefs must include menu-config.v2.json',
  );
  assert.ok(
    state.normalizedConfig.sourceRefs.includes('src/menu/menu-locale.catalog.v1.json'),
    'normalized sourceRefs must include menu-locale.catalog.v1.json',
  );

  const viewMenu = state.normalizedConfig.menus.find((menu) => menu && menu.id === 'view');
  const languageSwitch = viewMenu.items.find((item) => item.id === 'view-language');
  assert.equal(languageSwitch.labelKey, 'menu.view.language');
});

test('menu locale contract: main runtime applies locale before presentation and keeps about dialog strings in base reality', () => {
  const mainText = fs.readFileSync(MAIN_PATH, 'utf8');

  assert.match(mainText, /\[MENU_LOCALE_COMMAND_BASE\]: async \(\) => \{\s*return setMenuLocale\(MENU_LOCALE_MODE_BASE\);\s*\}/m);
  assert.match(mainText, /\[MENU_LOCALE_COMMAND_RU\]: async \(\) => \{\s*return setMenuLocale\(MENU_LOCALE_MODE_RU\);\s*\}/m);
  assert.match(mainText, /\[MENU_LOCALE_COMMAND_EN\]: async \(\) => \{\s*return setMenuLocale\(MENU_LOCALE_MODE_EN\);\s*\}/m);
  assert.ok(mainText.includes('const localizedConfig = applyMenuLocale(runtimeConfig);'));
  assert.ok(mainText.includes('const template = buildMenuTemplateFromConfig(localizedConfig);'));

  const applyLocaleIndex = mainText.indexOf('const localizedConfig = applyMenuLocale(runtimeConfig);');
  const applyPresentationIndex = mainText.indexOf('Menu.buildFromTemplate(applyMenuPresentation(template))');
  assert.ok(applyLocaleIndex >= 0, 'applyMenuLocale must be present in createMenu');
  assert.ok(applyPresentationIndex > applyLocaleIndex, 'locale application must happen before presentation projection');

  assert.ok(mainText.includes('const menuLocalePromise = loadMenuLocaleFromSettings();'));
  assert.ok(mainText.includes('await menuLocalePromise;'));
  assert.ok(mainText.includes("title: 'О программе и лицензии'"));
  assert.ok(mainText.includes("message: 'Yalken — AGPL-3.0-or-later'"));
  assert.ok(mainText.includes("const MENU_LOCALE_HELP_LABEL_KEY = 'menu.help';"));
  assert.ok(mainText.includes('const aboutLabel = resolveAboutLicensesMenuLabel();'));
  assert.ok(mainText.includes("label: resolveLocalizedMenuLabel(localeCatalog, MENU_LOCALE_HELP_LABEL_KEY, 'Help')"));
});
