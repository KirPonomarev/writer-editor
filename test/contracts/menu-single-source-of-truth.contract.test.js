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
const X101_MENU_MAP_LOCK_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'X101_MENU_COMMAND_MAP_LOCK_V1.json');

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

test('menu single-source truth: x101 file alias map stays synchronized with main menu aliases', () => {
  const mainText = fs.readFileSync(MAIN_PATH, 'utf8');
  const x101 = readJson(X101_MENU_MAP_LOCK_PATH);
  const aliasMap = x101.menuActionAliasToCommandId || {};
  const fileSection = Array.isArray(x101.x101MenuSections)
    ? x101.x101MenuSections.find((section) => section && section.section === 'File')
    : null;

  assert.equal(aliasMap.newDocument, 'cmd.project.new');
  assert.equal(aliasMap.openDocument, 'cmd.project.open');
  assert.equal(aliasMap.saveDocument, 'cmd.project.save');

  const fileCommands = Array.isArray(fileSection?.items)
    ? fileSection.items.map((item) => item && item.commandId).filter(Boolean)
    : [];
  assert.equal(fileCommands.includes('cmd.project.new'), true);
  assert.equal(fileCommands.includes('cmd.project.open'), true);
  assert.equal(fileCommands.includes('cmd.project.save'), true);

  assert.ok(mainText.includes("newDocument: 'cmd.project.new'"));
  assert.ok(mainText.includes("openDocument: 'cmd.project.open'"));
  assert.ok(mainText.includes("saveDocument: 'cmd.project.save'"));
});

test('menu single-source truth: adopted menu file commands reuse command surface kernel where available', () => {
  const mainText = fs.readFileSync(MAIN_PATH, 'utf8');

  assert.match(
    mainText,
    /'cmd\.project\.open': async \(\) => \{\s*return dispatchCommandSurfaceKernel\(COMMAND_SURFACE_KERNEL_COMMAND_IDS\.PROJECT_OPEN, \{\}\);/m,
  );
  assert.match(
    mainText,
    /'cmd\.project\.save': async \(\) => \{\s*return dispatchCommandSurfaceKernel\(COMMAND_SURFACE_KERNEL_COMMAND_IDS\.PROJECT_SAVE, \{\}\);/m,
  );
  assert.match(
    mainText,
    /'cmd\.project\.saveAs': async \(\) => \{\s*return dispatchCommandSurfaceKernel\(COMMAND_SURFACE_KERNEL_COMMAND_IDS\.PROJECT_SAVE_AS, \{\}\);/m,
  );
  assert.match(
    mainText,
    /'cmd\.project\.importMarkdownV1': async \(payload = \{\}\) => \{\s*return dispatchCommandSurfaceKernel\(COMMAND_SURFACE_KERNEL_COMMAND_IDS\.PROJECT_IMPORT_MARKDOWN_V1, payload\);/m,
  );
  assert.match(
    mainText,
    /'cmd\.project\.exportMarkdownV1': async \(payload = \{\}\) => \{\s*return dispatchCommandSurfaceKernel\(COMMAND_SURFACE_KERNEL_COMMAND_IDS\.PROJECT_EXPORT_MARKDOWN_V1, payload\);/m,
  );
  assert.ok(mainText.includes("const previewRequested = sendCanonicalRuntimeCommand("));
  assert.ok(mainText.includes("'cmd.project.export.docxMin'"));
});
