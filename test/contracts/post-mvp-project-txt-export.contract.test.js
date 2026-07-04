const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = process.cwd();
const MAIN_PATH = path.join(REPO_ROOT, 'src', 'main.js');
const MENU_CONFIG_PATH = path.join(REPO_ROOT, 'src', 'menu', 'menu-config.v2.json');
const MENU_LOCALE_PATH = path.join(REPO_ROOT, 'src', 'menu', 'menu-locale.catalog.v1.json');
const KERNEL_PATH = path.join(REPO_ROOT, 'src', 'command', 'commandSurfaceKernel.js');

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function sliceBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.notEqual(start, -1, `start marker not found: ${startNeedle}`);
  const end = source.indexOf(endNeedle, start);
  assert.notEqual(end, -1, `end marker not found: ${endNeedle}`);
  return source.slice(start, end);
}

test('post-mvp project TXT export: file menu exposes one bounded all-scenes command entry with locale binding', () => {
  const config = readJson(MENU_CONFIG_PATH);
  const locale = readJson(MENU_LOCALE_PATH);
  const fileMenu = config.menus.find((item) => item && item.id === 'file');
  assert.ok(fileMenu, 'file menu missing');

  const matches = fileMenu.items.filter((item) => item && item.command === 'cmd.project.exportAllScenesTxtV1');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'file-export-all-scenes-txt');
  assert.equal(matches[0].actionId, undefined);
  assert.equal(matches[0].labelKey, 'menu.file.exportAllScenesTxt');
  assert.deepEqual(matches[0].profile, ['pro', 'guru']);

  assert.deepEqual(locale.entries['menu.file.exportAllScenesTxt'], {
    base: 'Экспорт TXT всех сцен',
    ru: 'Экспорт TXT всех сцен',
    en: 'Export All Scenes TXT',
  });
});

test('post-mvp project TXT export: main menu path stays direct and main-owned under all-scenes command id', () => {
  const source = readText(MAIN_PATH);
  const kernelSource = readText(KERNEL_PATH);
  const menuHandlerSource = sliceBetween(
    source,
    '[EXPORT_ALL_SCENES_TXT_COMMAND_ID]: async (payload = {}) => {',
    "  'cmd.project.edit.undo': () => {",
  );

  assert.match(source, /PROJECT_EXPORT_ALL_SCENES_TXT_V1:\s*EXPORT_ALL_SCENES_TXT_COMMAND_ID/u);
  assert.match(source, /UI_COMMAND_BRIDGE_ALLOWED_COMMAND_IDS\s*=\s*new Set\(\[[\s\S]*EXPORT_ALL_SCENES_TXT_COMMAND_ID/u);
  assert.match(
    source,
    /\[EXPORT_ALL_SCENES_TXT_COMMAND_ID\]: async \(payload = \{\}\) => \{\s*const result = await dispatchCommandSurfaceKernel\(\s*COMMAND_SURFACE_KERNEL_COMMAND_IDS\.PROJECT_EXPORT_ALL_SCENES_TXT_V1,\s*payload,\s*\);\s*return normalizeUiBridgeMenuResult\(result\);/mu,
  );
  assert.match(
    source,
    /\[COMMAND_SURFACE_KERNEL_COMMAND_IDS\.PROJECT_EXPORT_ALL_SCENES_TXT_V1\]: async \(payload = \{\}\) => \{\s*return handleExportAllScenesTxt\(payload\);/mu,
  );
  assert.match(kernelSource, /'cmd\.project\.exportAllScenesTxtV1'/u);
  assert.doesNotMatch(menuHandlerSource, /sendCanonicalRuntimeCommand\(/u);
});

test('post-mvp project TXT export: handler reuses canonical scene traversal and keeps TXT assembly bounded', () => {
  const source = readText(MAIN_PATH);
  const normalizeSource = sliceBetween(
    source,
    'function normalizeAllScenesTxtExportPayload(payload = {}) {',
    'function buildMarkdownExportDefaultPath(payload) {',
  );
  const handlerSource = sliceBetween(
    source,
    'async function handleExportAllScenesTxt(payloadRaw = {}) {',
    'async function handleExportDocxMin(payloadRaw) {',
  );

  assert.match(normalizeSource, /ALL_SCENES_TXT_EXPORT_FORBIDDEN_AUTHORITY_KEYS/u);
  assert.doesNotMatch(normalizeSource, /confirmed/u);
  assert.doesNotMatch(normalizeSource, /selectedSceneIds/u);

  assert.match(handlerSource, /buildSelectedScenesTxtExportScope\(\)/u);
  assert.match(handlerSource, /const sceneCandidates = Array\.isArray\(scope\?\.sceneCandidates\) \? scope\.sceneCandidates : \[\];/u);
  assert.match(handlerSource, /validateAllScenesTxtExportOutPath\(outPath, scope, sceneCandidates\)/u);
  assert.match(handlerSource, /validateTxtExportPhysicalTargetPath\(outPath/u);
  assert.match(handlerSource, /targetMatchesSourceReason:\s*'export_target_matches_all_scenes_source'/u);
  assert.match(handlerSource, /for \(const candidate of sceneCandidates\)/u);
  assert.match(handlerSource, /readSelectedScenesTxtExportSceneContent\(candidate\)/u);
  assert.match(handlerSource, /sceneTexts\.join\('\\n\\n'\)/u);
  assert.match(handlerSource, /fileManager\.writeFileAtomic\(outPath, content\)/u);
  assert.match(handlerSource, /sceneCount:\s*sceneCandidates\.length/u);
  assert.doesNotMatch(handlerSource, /selectedSceneIds|payload\.text|payload\.scene|payload\.rendererState|payload\.plainText/u);
});

test('post-mvp project TXT export: target validation blocks project-root writes and source overwrite', () => {
  const source = readText(MAIN_PATH);
  const validateSource = sliceBetween(
    source,
    'function validateAllScenesTxtExportOutPath(outPath, scope, sceneCandidates) {',
    'async function resolveComparableTxtExportPath(filePath) {',
  );

  assert.match(validateSource, /sceneCandidates\.some\(\(candidate\) => candidate && candidate\.path === outPath\)/u);
  assert.match(validateSource, /isPathInside\(scope\.projectRoot, outPath\)/u);
  assert.match(validateSource, /reason:\s*'export_target_matches_all_scenes_source'/u);
  assert.match(validateSource, /reason:\s*'export_target_inside_project_root'/u);
});
