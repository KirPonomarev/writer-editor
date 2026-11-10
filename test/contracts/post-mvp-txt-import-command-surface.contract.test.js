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
  const menuConfig = readJson('src/menu/menu-config.v2.json');
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
  assert.equal(mobileMatrix.disabledCommands.includes('cmd.project.txt.previewLocalFile'), true);
  assert.equal(mobileMatrix.disabledCommands.includes('cmd.project.txt.importSafeCreate'), true);

  for (const capabilityId of [
    'cap.project.import.txtV1',
    'cap.project.txt.previewLocalFile',
    'cap.project.txt.importSafeCreate',
  ]) {
    assert.equal(capabilityPolicy.CAPABILITY_MATRIX.node[capabilityId], true, `node: ${capabilityId}`);
    assert.equal(capabilityPolicy.CAPABILITY_MATRIX.web[capabilityId], false, `web: ${capabilityId}`);
    assert.equal(capabilityPolicy.CAPABILITY_MATRIX['mobile-wrapper'][capabilityId], false, `mobile: ${capabilityId}`);
  }

  const fileMenu = menuConfig.menus.find((item) => item && item.id === 'file');
  assert.ok(fileMenu, 'file menu missing');
  const txtImportEntries = fileMenu.items.filter((item) => item && item.command === 'cmd.project.importTxtV1');
  assert.equal(txtImportEntries.length, 1);
  assert.equal(txtImportEntries[0].id, 'file-import-txt-content');
  assert.equal(txtImportEntries[0].labelKey, 'menu.file.importTxtContent');
  assert.deepEqual(txtImportEntries[0].mode, ['offline']);
  assert.deepEqual(txtImportEntries[0].profile, ['minimal', 'pro', 'guru']);
  assert.equal(visibilityMatrix.coreSafetyCommandAllowlist.includes('cmd.project.importTxtV1'), true);
  assert.equal(visibilityMatrix.minimalProfileHiddenAllowlist.includes('cmd.project.importTxtV1'), false);
});


// P05: literal Main plus real bounded UTF8 reader, preview admission and
// atomic filesystem writer. Dialog/binding/serial queue are finite host ports;
// this is not a claim of Electron, full Kernel or Stage10 acceptance.
const txtVm = require('node:vm');
const txtOs = require('node:os');
const txtCrypto = require('node:crypto');
const txtPreview = require('../../src/utils/txtImportLocalFilePreview');
const txtCreate = require('../../src/utils/txtImportSafeCreate');
const txtHash = value => txtCrypto.createHash('sha256').update(value).digest('hex');
const txtCopy = value => JSON.parse(JSON.stringify(value));
function txtFileRoster(root) {
  const rows = {};
  function visit(relative) {
    const file = path.join(root, relative), stat = fs.lstatSync(file);
    assert.equal(stat.isSymbolicLink(), false);
    rows[relative] = stat.isDirectory() ? { directory: true } : { sha256: txtHash(fs.readFileSync(file)) };
    if (stat.isDirectory()) for (const name of fs.readdirSync(file).sort()) visit(path.join(relative, name));
  }
  visit(''); return rows;
}
function actualTxtMain(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(txtOs.tmpdir(), 'p05-txt-main-ack-')));
  t.after(() => fs.rmSync(root, { recursive: true }));
  const projectRoot = path.join(root, 'project'), romanRoot = path.join(projectRoot, 'roman');
  fs.mkdirSync(romanRoot, { recursive: true });
  const manifest = JSON.stringify({ schemaVersion: 1, projectId: '11111111-1111-4111-8111-111111111111', projectName: 'Owned TXT' });
  fs.writeFileSync(path.join(projectRoot, 'project.craftsman.json'), manifest);
  fs.writeFileSync(path.join(romanRoot, 'old.txt'), 'Existing author text');
  const input = path.join(root, 'P05_TXT_BOM_MIXED.txt');
  const bytes = Buffer.from('\uFEFFПервый абзац 🧭.\r\nCafé e\u0301, 中文.\rПоследняя строка.\n', 'utf8');
  // Literal source values intentionally retain BOM, CRLF, CR, LF and NFD.
  const expected = 'Первый абзац 🧭.\nCafé e\u0301, 中文.\nПоследняя строка.\n';
  fs.writeFileSync(input, bytes); const originalHash = txtHash(bytes);
  const source = read('src/main.js'), start = source.indexOf('// TXT_IMPORT_LOCAL_FILE_PREVIEW_COMMAND_SURFACE_START');
  const end = source.indexOf('// TXT_IMPORT_LOCAL_FILE_PREVIEW_COMMAND_SURFACE_END', start);
  assert.ok(start >= 0 && end > start, 'exact Main TXT section required');
  let producer;
  const context = {
    fs: fs.promises, path, mainWindow: {},
    isPlainObjectValue: value => Boolean(value && typeof value === 'object' && !Array.isArray(value)),
    cloneJsonSafe: value => value === undefined ? undefined : txtCopy(value),
    ...txtPreview, ...txtCreate,
    applyTxtImportSafeCreate: async (...args) => { producer = await txtCreate.applyTxtImportSafeCreate(...args); return producer; },
    readExternalFileBounded: require('../../src/utils/externalFileAuthority').readExternalFileBounded,
    writeFlowSceneBatchAtomic: require('../../src/utils/flowSceneBatchAtomic').writeFlowSceneBatchAtomic,
    dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [input] }) },
    fileManager: { getDocumentsPath: () => root },
    getProjectRootPath: () => projectRoot,
    getProjectSectionPath: section => { assert.equal(section, 'roman'); return romanRoot; },
    ensureProjectStructure: async () => assert.equal(fs.statSync(romanRoot).isDirectory(), true),
    resolveProjectBindingForFile: async file => {
      assert.equal(file, romanRoot);
      return JSON.parse(fs.readFileSync(path.join(projectRoot, 'project.craftsman.json'), 'utf8'));
    },
    queueDiskOperation: async operation => operation(),
  };
  txtVm.runInNewContext(source.slice(start, end) + '\nfunction txtForbiddenKeys() { return Array.from(TXT_IMPORT_LOCAL_FILE_PREVIEW_FORBIDDEN_RESULT_KEYS); }', context);
  async function run() {
    const before = txtFileRoster(projectRoot);
    const preview = await context.handleTxtImportLocalFilePreviewCommandSurface({ requestId: 'p05-txt-preview' });
    assert.equal(preview.ok, true, JSON.stringify(preview));
    assert.deepEqual(txtFileRoster(projectRoot), before, 'actual Main preview is zero-write');
    const accepted = await context.handleTxtImportSafeCreateCommandSurface({ requestId: 'p05-txt-create', txtImportPreviewPlan: preview.txtImportPreviewPlan });
    const imported = fs.readdirSync(path.join(romanRoot, 'Imported'));
    assert.equal(imported.length, 1, 'real writer published exactly one file');
    assert.equal(fs.readFileSync(path.join(romanRoot, 'Imported', imported[0]), 'utf8'), expected);
    assert.equal(fs.readFileSync(path.join(romanRoot, 'old.txt'), 'utf8'), 'Existing author text');
    assert.equal(fs.readFileSync(path.join(projectRoot, 'project.craftsman.json'), 'utf8'), manifest);
    assert.equal(txtHash(fs.readFileSync(input)), originalHash);
    assert.equal(producer.ok, true, JSON.stringify(producer));
    const ack = { ok: true, requestId: 'p05-txt-create', commandId: 'cmd.project.txt.importSafeCreate', commandOk: true,
      safeCreateOk: true, created: true, createdSceneIds: producer.value.createdSceneIds, receipt: producer.value.receipt };
    return { accepted, preview, ack };
  }
  return { context, projectRoot, run };
}

test('P05 TXT actual Main acknowledges the real published Unicode scene and refuses replay without another write', async t => {
  const h = actualTxtMain(t), { accepted, preview } = await h.run();
  assert.equal(accepted.ok, true, JSON.stringify(accepted));
  assert.equal(accepted.receipt.schemaVersion, txtCreate.TXT_IMPORT_SAFE_CREATE_RECEIPT_SCHEMA);
  assert.equal(accepted.receipt.reason, txtCreate.TXT_IMPORT_SAFE_CREATE_READY_REASON);
  assert.deepEqual(txtCopy(accepted.createdSceneIds), txtCopy(accepted.receipt.createdSceneIds));
  const before = txtFileRoster(h.projectRoot);
  const replay = await h.context.handleTxtImportSafeCreateCommandSurface({ requestId: 'p05-txt-create', txtImportPreviewPlan: preview.txtImportPreviewPlan });
  assert.equal(replay.ok, false); assert.match(replay.error.code, /EXISTING_SCENE_BLOCKED/u);
  assert.deepEqual(txtFileRoster(h.projectRoot), before);
});

test('P05 TXT permits only the canonical receipt at the acknowledgement root while every preview prohibition remains', async t => {
  const h = actualTxtMain(t), { ack, preview } = await h.run();
  assert.equal(h.context.validateTxtImportSafeCreateCommandResult(ack).ok, true);
  const localPreview = { ...preview }; delete localPreview.commandId; delete localPreview.commandOk;
  assert.equal(h.context.validateTxtImportLocalFilePreviewSuccessResult(localPreview).ok, true);
  const previewWithReceipt = h.context.validateTxtImportLocalFilePreviewSuccessResult({ ...localPreview, receipt: ack.receipt });
  assert.equal(previewWithReceipt.ok, false);
  assert.equal(previewWithReceipt.details.fields.includes('receipt'), true);
  for (const key of h.context.txtForbiddenKeys()) {
    if (key !== 'receipt') assert.equal(h.context.validateTxtImportSafeCreateCommandResult({ ...ack, [key]: 'foreign-authority' }).ok, false, key);
    const nested = txtCopy(ack); nested.receipt[key] = 'foreign-authority';
    assert.equal(h.context.validateTxtImportSafeCreateCommandResult(nested).ok, false, 'receipt.' + key);
  }
  for (const mutate of [
    value => { delete value.receipt; }, value => { value.receipt = {}; }, value => { value.receipt = []; },
    value => { value.receipt.schemaVersion = 'foreign'; }, value => { value.receipt.type = 'foreign'; },
    value => { value.receipt.reason = 'foreign'; }, value => { value.receipt.projectId = ''; },
    value => { value.receipt.batchId = ''; }, value => { value.receipt.sourcePreviewHash = 'bad'; },
    value => { value.receipt.inputHash = 'bad'; }, value => { value.receipt.outputHash = 'bad'; },
    value => { value.receipt.createdSceneIds = ['other']; }, value => { value.receipt.createdScenes = []; },
    value => { value.receipt.createdScenes[0].sceneId = 'other'; }, value => { value.receipt.createdScenes[0].bytesWritten = -1; },
    value => { value.receipt.createdScenes[0].outputHash = 'bad'; },
  ]) {
    const altered = txtCopy(ack); mutate(altered);
    assert.equal(h.context.validateTxtImportSafeCreateCommandResult(altered).ok, false, JSON.stringify(altered));
  }
});
