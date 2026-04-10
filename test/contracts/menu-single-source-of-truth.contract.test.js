const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = process.cwd();
const MAIN_PATH = path.join(REPO_ROOT, 'src', 'main.js');
const CONFIG_V2_PATH = path.join(REPO_ROOT, 'src', 'menu', 'menu-config.v2.json');
const CONFIG_V2_EXAMPLE_PATH = path.join(REPO_ROOT, 'src', 'menu', 'menu-config.v2.example.json');
const CONTEXT_PATH = path.join(REPO_ROOT, 'test', 'fixtures', 'menu', 'context.default.json');
const NORMALIZER_PATH = path.join(REPO_ROOT, 'src', 'menu', 'menu-config-normalizer.js');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('menu single-source truth: canonical v2 file exists and transitional example file is removed', () => {
  assert.equal(fs.existsSync(CONFIG_V2_PATH), true, 'canonical menu-config.v2.json must exist');
  assert.equal(fs.existsSync(CONFIG_V2_EXAMPLE_PATH), false, 'menu-config.v2.example.json must be removed');
});

test('menu single-source truth: main process no longer post-patches core menu sections', () => {
  const mainText = fs.readFileSync(MAIN_PATH, 'utf8');
  assert.equal(mainText.includes('ensureX101MenuSections'), false, 'main.js must not keep ensureX101MenuSections as structural source');
  assert.equal(mainText.includes('ensureAboutLicensesMenuEntry'), true, 'about licenses adapter exception must remain explicit while it exists');
});

test('menu single-source truth: normalized menu preserves canonical authoring order', () => {
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

  assert.deepEqual(
    state.normalizedConfig.menus.map((item) => item.id),
    config.menus.map((item) => item.id),
    'top-level menu order must follow canonical authoring order',
  );

  const fileMenu = state.normalizedConfig.menus.find((item) => item.id === 'file');
  const viewMenu = state.normalizedConfig.menus.find((item) => item.id === 'view');
  assert.ok(fileMenu, 'expected file menu');
  assert.ok(viewMenu, 'expected view menu');

  assert.deepEqual(
    fileMenu.items.map((item) => item.id),
    config.menus.find((item) => item.id === 'file').items.map((item) => item.id),
    'file submenu order must remain canonical',
  );
  assert.deepEqual(
    viewMenu.items.map((item) => item.id),
    config.menus.find((item) => item.id === 'view').items.map((item) => item.id),
    'view submenu order must remain canonical',
  );
});
