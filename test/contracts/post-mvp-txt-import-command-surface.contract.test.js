const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

async function loadCapabilityPolicy() {
  return import(pathToFileURL(path.join(ROOT, 'src', 'renderer', 'commands', 'capabilityPolicy.mjs')).href);
}

test('post-mvp TXT import command surface: main bridge admits bounded TXT preview and safe-create only', () => {
  const mainSource = read('src/main.js');
  const kernelSource = read('src/command/commandSurfaceKernel.js');

  for (const marker of [
    "const TXT_IMPORT_LOCAL_FILE_PREVIEW_COMMAND_ID = 'cmd.project.txt.previewLocalFile';",
    "const TXT_IMPORT_SAFE_CREATE_COMMAND_ID = 'cmd.project.txt.importSafeCreate';",
    "'cmd.project.importTxtV1': async () => {",
    '[TXT_IMPORT_LOCAL_FILE_PREVIEW_COMMAND_ID]: async (payload = {}) => {',
    '[TXT_IMPORT_SAFE_CREATE_COMMAND_ID]: async (payload = {}) => {',
  ]) {
    assert.ok(mainSource.includes(marker), marker);
  }
  assert.match(
    mainSource,
    /sendCanonicalRuntimeCommand\(\s*'cmd\.project\.importTxtV1',\s*\{\s*source:\s*'menu'\s*\},\s*'open-import-txt-preview',?\s*\)/u,
  );

  assert.match(mainSource, /UI_COMMAND_BRIDGE_ALLOWED_COMMAND_IDS\s*=\s*new Set\(\[[\s\S]*TXT_IMPORT_LOCAL_FILE_PREVIEW_COMMAND_ID/u);
  assert.match(mainSource, /UI_COMMAND_BRIDGE_ALLOWED_COMMAND_IDS\s*=\s*new Set\(\[[\s\S]*TXT_IMPORT_SAFE_CREATE_COMMAND_ID/u);
  assert.equal(kernelSource.includes('cmd.project.importTxtV1'), false);
  assert.equal(kernelSource.includes('cmd.project.txt.previewLocalFile'), false);
  assert.equal(kernelSource.includes('cmd.project.txt.importSafeCreate'), false);
});

test('post-mvp TXT import command surface: project command registry and capability truth stay aligned', async () => {
  const projectCommandsSource = read('src/renderer/commands/projectCommands.mjs');
  const binding = readJson('docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json');
  const docsMatrix = readJson('docs/OPS/CAPABILITIES_MATRIX.json');
  const visibilityMatrix = readJson('docs/OPS/STATUS/COMMAND_VISIBILITY_MATRIX.json');
  const capabilityPolicy = await loadCapabilityPolicy();

  for (const marker of [
    "PROJECT_IMPORT_TXT_V1: COMMAND_KEY_TO_ID.PROJECT_IMPORT_TXT_V1",
    "PROJECT_TXT_PREVIEW_LOCAL_FILE: 'cmd.project.txt.previewLocalFile'",
    "PROJECT_TXT_IMPORT_SAFE_CREATE: 'cmd.project.txt.importSafeCreate'",
    'registerCatalogCommand(registry, COMMAND_IDS.PROJECT_IMPORT_TXT_V1',
    "id: EXTRA_COMMAND_IDS.PROJECT_TXT_PREVIEW_LOCAL_FILE",
    "id: EXTRA_COMMAND_IDS.PROJECT_TXT_IMPORT_SAFE_CREATE",
  ]) {
    assert.ok(projectCommandsSource.includes(marker), marker);
  }

  assert.equal(capabilityPolicy.CAPABILITY_BINDING['cmd.project.importTxtV1'], 'cap.project.import.txtV1');
  assert.equal(capabilityPolicy.CAPABILITY_BINDING['cmd.project.txt.previewLocalFile'], 'cap.project.txt.previewLocalFile');
  assert.equal(capabilityPolicy.CAPABILITY_BINDING['cmd.project.txt.importSafeCreate'], 'cap.project.txt.importSafeCreate');

  const bindingMap = new Map(binding.items.map((item) => [item.commandId, item.capabilityId]));
  assert.equal(bindingMap.get('cmd.project.importTxtV1'), 'cap.project.import.txtV1');
  assert.equal(bindingMap.get('cmd.project.txt.previewLocalFile'), 'cap.project.txt.previewLocalFile');
  assert.equal(bindingMap.get('cmd.project.txt.importSafeCreate'), 'cap.project.txt.importSafeCreate');

  const nodeMatrix = docsMatrix.items.find((item) => item.platformId === 'node');
  const webMatrix = docsMatrix.items.find((item) => item.platformId === 'web');
  const mobileMatrix = docsMatrix.items.find((item) => item.platformId === 'mobile-wrapper');
  assert.equal(nodeMatrix.capabilities['cap.project.import.txtV1'], true);
  assert.equal(nodeMatrix.capabilities['cap.project.txt.previewLocalFile'], true);
  assert.equal(nodeMatrix.capabilities['cap.project.txt.importSafeCreate'], true);
  assert.equal(webMatrix.capabilities['cap.project.import.txtV1'], false);
  assert.equal(webMatrix.capabilities['cap.project.txt.previewLocalFile'], false);
  assert.equal(webMatrix.capabilities['cap.project.txt.importSafeCreate'], false);
  assert.equal(mobileMatrix.capabilities['cap.project.import.txtV1'], false);
  assert.equal(mobileMatrix.capabilities['cap.project.txt.previewLocalFile'], false);
  assert.equal(mobileMatrix.capabilities['cap.project.txt.importSafeCreate'], false);
  assert.equal(webMatrix.disabledCommands.includes('cmd.project.importTxtV1'), true);
  assert.equal(webMatrix.disabledCommands.includes('cmd.project.txt.previewLocalFile'), true);
  assert.equal(webMatrix.disabledCommands.includes('cmd.project.txt.importSafeCreate'), true);
  assert.equal(mobileMatrix.disabledCommands.includes('cmd.project.importTxtV1'), true);
  assert.equal(visibilityMatrix.minimalProfileHiddenAllowlist.includes('cmd.project.importTxtV1'), true);
});
