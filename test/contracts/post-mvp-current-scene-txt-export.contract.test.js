const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = process.cwd();
const MAIN_PATH = path.join(REPO_ROOT, 'src', 'main.js');
const MENU_CONFIG_PATH = path.join(REPO_ROOT, 'src', 'menu', 'menu-config.v2.json');
const MENU_LOCALE_PATH = path.join(REPO_ROOT, 'src', 'menu', 'menu-locale.catalog.v1.json');

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

test('post-mvp current scene txt export: file menu exposes one direct command entry with locale binding', () => {
  const config = readJson(MENU_CONFIG_PATH);
  const locale = readJson(MENU_LOCALE_PATH);
  const fileMenu = config.menus.find((item) => item && item.id === 'file');
  assert.ok(fileMenu, 'file menu missing');

  const matches = fileMenu.items.filter((item) => item && item.command === 'cmd.project.exportCurrentSceneTxtV1');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'file-export-current-scene-txt');
  assert.equal(matches[0].actionId, undefined);
  assert.equal(matches[0].labelKey, 'menu.file.exportCurrentSceneTxt');
  assert.deepEqual(matches[0].profile, ['pro', 'guru']);

  assert.deepEqual(locale.entries['menu.file.exportCurrentSceneTxt'], {
    base: 'Экспорт TXT текущей сцены',
    ru: 'Экспорт TXT текущей сцены',
    en: 'Export Current Scene TXT',
  });
});

test('post-mvp current scene txt export: main command path stays main-owned, scene-only, and envelope-parsed from disk', () => {
  const source = readText(MAIN_PATH);
  const readSource = sliceBetween(
    source,
    'async function readCurrentSceneTxtExportSource() {',
    'function validateCurrentSceneTxtExportOutPath(outPath, source) {',
  );
  const handlerSource = sliceBetween(
    source,
    'async function handleExportCurrentSceneTxt(payloadRaw = {}) {',
    'async function handleExportDocxMin(payloadRaw) {',
  );

  assert.match(readSource, /isDirty \|\| autoSaveInProgress/u);
  assert.match(readSource, /typeof currentFilePath !== 'string'/u);
  assert.match(readSource, /getDocumentContextFromPath\(currentFilePath\)/u);
  assert.match(readSource, /documentContext\.kind !== 'scene'/u);
  assert.match(readSource, /await readCanonicalExportSnapshot\(\{\}\)/u);
  assert.match(readSource, /await loadDocumentContentEnvelopeModule\(\)/u);
  assert.match(readSource, /parseObservablePayload\(editorSnapshot\.content \|\| ''\)/u);
  assert.doesNotMatch(readSource, /requestEditorSnapshot|requestEditorText/u);

  assert.match(handlerSource, /resolveCurrentSceneTxtExportPath\(payload\)/u);
  assert.match(handlerSource, /fileManager\.writeFileAtomic\(outPath, source\.content\)/u);
  assert.match(handlerSource, /Buffer\.byteLength\(source\.content, 'utf8'\)/u);
  assert.match(handlerSource, /exported:\s*false,\s*canceled:\s*true/u);
  assert.doesNotMatch(handlerSource, /payload\.text|payload\.scene|payload\.rendererState|payload\.bufferSource|payload\.viewportDomText|payload\.visibleWindowText/u);
});

test('post-mvp current scene txt export: target path validation blocks project-truth mutation', () => {
  const source = readText(MAIN_PATH);
  const validateSource = sliceBetween(
    source,
    'function validateCurrentSceneTxtExportOutPath(outPath, source) {',
    'async function handleExportCurrentSceneTxt(payloadRaw = {}) {',
  );

  assert.match(validateSource, /outPath === source\.currentFilePath/u);
  assert.match(validateSource, /isPathInside\(source\.projectRoot, outPath\)/u);
  assert.match(validateSource, /reason:\s*'export_target_matches_current_scene'/u);
  assert.match(validateSource, /reason:\s*'export_target_inside_project_root'/u);
});

test('post-mvp current scene txt export: ui bridge and command surface allowlist include only the canonical command id', () => {
  const source = readText(MAIN_PATH);
  const kernelSource = readText(path.join(REPO_ROOT, 'src', 'command', 'commandSurfaceKernel.js'));

  assert.match(source, /PROJECT_EXPORT_CURRENT_SCENE_TXT_V1:\s*EXPORT_CURRENT_SCENE_TXT_COMMAND_ID/u);
  assert.match(source, /UI_COMMAND_BRIDGE_ALLOWED_COMMAND_IDS\s*=\s*new Set\(\[[\s\S]*EXPORT_CURRENT_SCENE_TXT_COMMAND_ID/u);
  assert.match(
    source,
    /\[EXPORT_CURRENT_SCENE_TXT_COMMAND_ID\]: async \(payload = \{\}\) => \{\s*const result = await dispatchCommandSurfaceKernel\(\s*COMMAND_SURFACE_KERNEL_COMMAND_IDS\.PROJECT_EXPORT_CURRENT_SCENE_TXT_V1,\s*payload,\s*\);\s*return normalizeUiBridgeMenuResult\(result\);/mu,
  );
  assert.match(
    source,
    /\[COMMAND_SURFACE_KERNEL_COMMAND_IDS\.PROJECT_EXPORT_CURRENT_SCENE_TXT_V1\]: async \(payload = \{\}\) => \{\s*return handleExportCurrentSceneTxt\(payload\);/mu,
  );
  assert.match(kernelSource, /'cmd\.project\.exportCurrentSceneTxtV1'/u);
});
