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
async function actualTxtMain(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(txtOs.tmpdir(), 'p05-txt-main-ack-')));
  t.after(() => fs.rmSync(root, { recursive: true }));
  const projectRoot = path.join(root, 'project'), romanRoot = path.join(projectRoot, 'roman');
  fs.mkdirSync(romanRoot, { recursive: true });
  const identity = await import('../../src/core/projectTreeIdentity.mjs');
  const projectId = '11111111-1111-4111-8111-111111111111';
  const oldIdentity = identity.upsertProjectTreeIdentityNode({ projectId, registry: { schemaVersion: 1, nodes: {} },
    bindingKey: 'file:roman/old.txt', kind: 'scene' });
  assert.equal(oldIdentity.ok, true);
  const manifest = JSON.stringify({ schemaVersion: 1, projectId, projectName: 'Owned TXT', treeIdentity: oldIdentity.value });
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
  const { createMainProjectManifestAuthority } = await import('../../src/product/mainProjectManifestAuthority.mjs');
  const authority = createMainProjectManifestAuthority({ anchorRoot: path.join(root, '.authority'), useLeaseHeartbeatWorker: false });
  const state = { root: projectRoot, subject: projectId, allowed: true, backupAllowed: true, failManifest: false, backups: 0, identityLoads: 0 };
  let producer;
  const context = {
    fs: fs.promises, fsSync: fs, crypto: txtCrypto, path, currentFilePath: path.join(romanRoot, 'old.txt'),
    mainWindow: { isDestroyed: () => false, webContents: { isDestroyed: () => false } },
    currentProjectName: 'Owned TXT', DEFAULT_PROJECT_NAME: 'Owned TXT',
    currentLifecycleSubjectId: () => state.subject, commentAuthoringSessionId: 'txt-session', lastSignaledEditGeneration: 0,
    activeStage10ApplicationBootstrap: {}, captureDocxImportPreviewContext: () => JSON.stringify([state.root, 1]),
    userBookmarkCapability: () => { if (!state.allowed) throw Error('CAPABILITY_DENIED'); },
    ...require('../../src/core/io/path-boundary'),
    normalizeStableProjectId: value => typeof value === 'string' ? value : '',
    isPlainObjectValue: value => Boolean(value && typeof value === 'object' && !Array.isArray(value)),
    cloneJsonSafe: value => value === undefined ? undefined : txtCopy(value),
    ...txtPreview, ...txtCreate,
    applyTxtImportSafeCreate: async (...args) => { producer = await txtCreate.applyTxtImportSafeCreate(...args); return producer; },
    readExternalFileBounded: require('../../src/utils/externalFileAuthority').readExternalFileBounded,
    writeFlowSceneBatchAtomic: require('../../src/utils/flowSceneBatchAtomic').writeFlowSceneBatchAtomic,
    dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [input] }) },
    fileManager: { getDocumentsPath: () => root },
    getProjectRootPath: () => state.root,
    getProjectSectionPath: section => { assert.equal(section, 'roman'); return path.join(state.root, 'roman'); },
    loadProjectTreeIdentityModule: async () => {
      state.identityLoads++;
      if (state.afterIdentityLoad) state.afterIdentityLoad();
      return identity;
    },
    ensureProjectManifest: async () => {
      const manifestPath = path.join(state.root, 'project.craftsman.json'), manifestRaw = fs.readFileSync(manifestPath, 'utf8');
      return { manifestPath, manifestRaw, manifest: JSON.parse(manifestRaw) };
    },
    getMainProjectManifestAuthority: async () => state.failManifest
      ? { ...authority, commitManifestText: async () => { throw Object.assign(Error('INJECTED_CAS_FAILURE'), { code: 'E_INJECTED_CAS_FAILURE' }); } }
      : authority,
    isAllowedFilePath: file => file.startsWith(projectRoot + path.sep),
    // Backup scheduling is a finite host port; its real bytes are retained.
    // The original Main migration and actual lease/CAS/fsync authority run.
    backupManager: { createBackup: async (file, text, options) => {
      assert.equal(file, path.join(projectRoot, 'project.craftsman.json')); assert.equal(options.basePath, projectRoot);
      if (!state.backupAllowed) return { success: false, error: 'INJECTED_BACKUP_FAILURE' };
      fs.mkdirSync(path.join(projectRoot, 'backups'), { recursive: true });
      fs.writeFileSync(path.join(projectRoot, 'backups', 'manifest-' + (++state.backups) + '.json'), text, { flag: 'wx' });
      return { success: true };
    } },
    ensureProjectStructure: async () => assert.equal(fs.statSync(romanRoot).isDirectory(), true),
    resolveProjectBindingForFile: async file => {
      assert.equal(file, romanRoot);
      const manifestPath = path.join(projectRoot, 'project.craftsman.json'), manifestRaw = fs.readFileSync(manifestPath, 'utf8');
      return { projectId, projectRoot, manifestPath, manifestRaw, manifest: JSON.parse(manifestRaw) };
    },
    queueDiskOperation: async operation => operation(),
  };
  txtVm.runInNewContext(source.slice(start, end) + '\nfunction txtForbiddenKeys() { return Array.from(TXT_IMPORT_LOCAL_FILE_PREVIEW_FORBIDDEN_RESULT_KEYS); }', context);
  const functions = ['computeHash', 'recoveryFailure', 'recoveryPhysicalIdentity', 'recoveryLeafIdentity', 'assertRecoverySnapshot', 'readRecoverySnapshot',
    'toProjectTreeBindingKey', 'persistProjectManifestAtPath', 'persistProjectTreeIdentityMigration',
    'upsertProjectTreeIdentityForPath', 'resolveProjectTreeNodeIdentity'].map(name => {
    const begin = new RegExp('^(?:async )?function ' + name + '\\(', 'mu').exec(source);
    assert.ok(begin, name); const finish = source.indexOf('\n}', begin.index); assert.ok(finish > begin.index);
    return source.slice(begin.index, finish + 2);
  });
  txtVm.runInNewContext(functions.join('\n'), context);
  async function run() {
    const before = txtFileRoster(projectRoot);
    const preview = await context.handleTxtImportLocalFilePreviewCommandSurface({ requestId: 'p05-txt-preview' });
    assert.equal(preview.ok, true, JSON.stringify(preview));
    assert.deepEqual(txtFileRoster(projectRoot), before, 'actual Main preview is zero-write');
    const accepted = await context.handleTxtImportSafeCreateCommandSurface({ requestId: 'p05-txt-create', txtImportPreviewPlan: preview.txtImportPreviewPlan });
    const imported = fs.readdirSync(path.join(romanRoot, 'Imported'));
    assert.equal(imported.length, 1, 'real writer published exactly one file');
    assert.equal(fs.readFileSync(path.join(romanRoot, 'Imported', imported[0]), 'utf8'), state.expectedImportedText || expected);
    assert.equal(fs.readFileSync(path.join(romanRoot, 'old.txt'), 'utf8'), 'Existing author text');
    const after = JSON.parse(fs.readFileSync(path.join(projectRoot, 'project.craftsman.json'))), original = JSON.parse(manifest);
    const { treeIdentity, ...fields } = after, { treeIdentity: oldRegistry, ...oldFields } = original;
    assert.deepEqual(fields, oldFields);
    for (const [id, record] of Object.entries(oldRegistry.nodes)) assert.deepEqual(treeIdentity.nodes[id], record);
    assert.equal(txtHash(fs.readFileSync(input)), originalHash);
    assert.equal(producer.ok, true, JSON.stringify(producer));
    const ack = { ok: true, requestId: 'p05-txt-create', commandId: 'cmd.project.txt.importSafeCreate', commandOk: true,
      safeCreateOk: true, created: true, createdSceneIds: producer.value.createdSceneIds, receipt: producer.value.receipt };
    return { accepted, preview, ack, importedPath: path.join(romanRoot, 'Imported', imported[0]) };
  }
  return { context, projectRoot, run, state, identity, manifest };
}

test('P05 TXT actual Main acknowledges the real published Unicode scene and refuses replay without another write', async t => {
  const h = await actualTxtMain(t), { accepted, preview } = await h.run();
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
  const h = await actualTxtMain(t), { ack, preview } = await h.run();
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

test('P05 TXT acknowledgement follows durable identity publication and the literal Main resolver opens the real file', async t => {
  const h = await actualTxtMain(t), { accepted, importedPath } = await h.run();
  assert.equal(accepted.ok, true, JSON.stringify(accepted));
  const relative = path.relative(h.projectRoot, importedPath).split(path.sep).join('/');
  const manifest = JSON.parse(fs.readFileSync(path.join(h.projectRoot, 'project.craftsman.json')));
  const nodeId = h.identity.createDeterministicTreeNodeId(manifest.projectId, 'file:' + relative);
  assert.equal(manifest.treeIdentity.nodes[nodeId]?.present, true, 'new scene must exist in the durable registry, not only the read-only projection');
  assert.equal(manifest.treeIdentity.nodes[nodeId].kind, 'scene');
  const resolved = await h.context.resolveProjectTreeNodeIdentity(nodeId, manifest.projectId);
  assert.equal(resolved.nodePath, importedPath);
  await assert.rejects(h.context.resolveProjectTreeNodeIdentity(nodeId, 'foreign-project'), /TREE_NODE_PROJECT_MISMATCH/u);
  assert.ok(h.state.backups > 0);
  assert.deepEqual(fs.readFileSync(path.join(h.projectRoot, 'backups/manifest-1.json')), Buffer.from(h.manifest));
});

test('P05 TXT refuses an acknowledgement when identity backup, CAS, capability, source or project context fails; written text remains recoverable', async t => {
  for (const fault of ['backup', 'cas', 'capability', 'source', 'project']) await t.test(fault, async child => {
    const h = await actualTxtMain(child), foreign = path.join(path.dirname(h.projectRoot), 'foreign');
    fs.mkdirSync(foreign); fs.writeFileSync(path.join(foreign, 'project.craftsman.json'), '{"projectId":"foreign"}');
    const originalForeign = txtFileRoster(foreign);
    if (fault === 'backup') h.state.backupAllowed = false;
    if (fault === 'cas') h.state.failManifest = true;
    if (fault === 'capability') h.state.afterIdentityLoad = () => { h.state.allowed = false; };
    if (fault === 'source') h.state.afterIdentityLoad = () => {
      h.state.expectedImportedText = 'Owned external replacement\n';
      const directory = path.join(h.projectRoot, 'roman/Imported');
      fs.writeFileSync(path.join(directory, fs.readdirSync(directory)[0]), h.state.expectedImportedText);
    };
    if (fault === 'project') h.state.afterIdentityLoad = () => { h.state.root = foreign; };
    const { accepted } = await h.run();
    assert.equal(accepted.ok, false, JSON.stringify(accepted)); assert.ok(h.state.identityLoads > 0);
    assert.equal(fs.readFileSync(path.join(h.projectRoot, 'project.craftsman.json'), 'utf8'), h.manifest);
    assert.deepEqual(txtFileRoster(foreign), originalForeign);
  });
});

test('P05 TXT held real project lease refuses before publishing any file or identity', async t => {
  const h = await actualTxtMain(t), authority = await h.context.getMainProjectManifestAuthority();
  const preview = await h.context.handleTxtImportLocalFilePreviewCommandSurface({ requestId: 'lease-preview' });
  assert.equal(preview.ok, true);
  await authority.withProjectLease('11111111-1111-4111-8111-111111111111', async () => {
    const before = txtFileRoster(h.projectRoot);
    const result = await h.context.handleTxtImportSafeCreateCommandSurface({ requestId: 'lease-create', txtImportPreviewPlan: preview.txtImportPreviewPlan });
    assert.equal(result.ok, false); assert.equal(result.error.reason, 'E_PROJECT_LEASE_HELD');
    assert.deepEqual(txtFileRoster(h.projectRoot), before);
  });
});
