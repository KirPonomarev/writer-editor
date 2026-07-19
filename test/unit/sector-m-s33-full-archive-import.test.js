const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');

const {
  buildProjectArchiveBuffer,
  buildZipArchive,
} = require('../../src/export/archive/projectArchiveExportHandler');

const ROOT = path.resolve(__dirname, '..', '..');
const PROJECT_MANIFEST_FILENAME = 'project.craftsman.json';

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function assertPathless(value, forbiddenRoot) {
  const text = JSON.stringify(value);
  assert.equal(text.includes(forbiddenRoot), false);
  assert.equal(/projectRoot|manifestPath|rootPath|privatePath|filePath/u.test(text), false);
}

async function loadMainWithElectronStub(paths) {
  const mainPath = path.join(ROOT, 'src', 'main.js');
  const fileManagerPath = path.join(ROOT, 'src', 'utils', 'fileManager.js');
  const originalLoad = Module._load;
  const electronStub = {
    app: {
      getPath: (name) => {
        if (name === 'userData') return paths.userDataRoot;
        if (name === 'documents') return paths.documentsParent;
        if (name === 'appData') return paths.tempRoot;
        return paths.tempRoot;
      },
      setPath: () => {},
      whenReady: () => new Promise(() => {}),
      on: () => {},
      quit: () => {},
      exit: () => {},
      setName: () => {},
      requestSingleInstanceLock: () => true,
    },
    BrowserWindow: {
      getFocusedWindow: () => null,
      getAllWindows: () => [],
    },
    Menu: {
      buildFromTemplate: () => ({}),
      setApplicationMenu: () => {},
    },
    dialog: {
      showMessageBox: async () => ({}),
      showSaveDialog: async () => ({ canceled: true }),
      showOpenDialog: async () => ({ canceled: true }),
    },
    ipcMain: {
      on: () => {},
      handle: () => {},
    },
    session: {
      defaultSession: { webRequest: { onHeadersReceived: () => {} } },
    },
  };

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'electron') return electronStub;
    return originalLoad.call(this, request, parent, isMain);
  };
  delete require.cache[mainPath];
  delete require.cache[fileManagerPath];
  try {
    return {
      main: require(mainPath),
      fileManager: require(fileManagerPath),
    };
  } finally {
    Module._load = originalLoad;
  }
}

async function createHarness(t) {
  const tempRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'project-archive-s33-'));
  t.after(async () => fsPromises.rm(tempRoot, { recursive: true, force: true }));
  const documentsParent = path.join(tempRoot, 'Documents');
  const documentsRoot = path.join(documentsParent, 'craftsman');
  const userDataRoot = path.join(tempRoot, 'userData');
  await fsPromises.mkdir(documentsRoot, { recursive: true });
  await fsPromises.mkdir(userDataRoot, { recursive: true });
  const { main, fileManager } = await loadMainWithElectronStub({
    tempRoot,
    documentsParent,
    userDataRoot,
  });
  const originalGetDocumentsPath = fileManager.getDocumentsPath;
  fileManager.getDocumentsPath = () => documentsRoot;
  t.after(() => { fileManager.getDocumentsPath = originalGetDocumentsPath; });
  return {
    main,
    tempRoot,
    documentsRoot,
  };
}

async function writeSourceProject(root, options = {}) {
  await fsPromises.mkdir(path.join(root, 'roman', 'Imported'), { recursive: true });
  await fsPromises.mkdir(path.join(root, 'assets'), { recursive: true });
  await fsPromises.mkdir(path.join(root, 'backups'), { recursive: true });
  await fsPromises.mkdir(path.join(root, 'recovery'), { recursive: true });
  const manifest = {
    schemaVersion: 1,
    projectId: options.projectId || 'project-archive-source',
    projectName: options.projectName || 'Archive Source',
    createdAtUtc: '2026-01-01T00:00:00.000Z',
    treeIdentity: { oldProjectBoundIds: true },
    proUnknown: {
      preserved: true,
      timeline: { marker: 'unknown-pro-field' },
    },
  };
  await fsPromises.writeFile(
    path.join(root, PROJECT_MANIFEST_FILENAME),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  await fsPromises.writeFile(path.join(root, 'roman', 'Imported', '01 Start.txt'), 'scene text', 'utf8');
  await fsPromises.writeFile(path.join(root, 'notes.json'), '{"notes":[{"id":"n1"}]}\n', 'utf8');
  await fsPromises.writeFile(path.join(root, 'assets', 'cover.bin'), Buffer.from([7, 8, 9]));
  await fsPromises.writeFile(path.join(root, 'backups', 'scene.bak'), 'backup text', 'utf8');
  await fsPromises.writeFile(path.join(root, 'recovery', 'snapshot.txt'), 'recovery text', 'utf8');
  return manifest;
}

async function writeArchiveFile(t, options = {}) {
  const sourceRoot = path.join(await fsPromises.mkdtemp(path.join(os.tmpdir(), 'project-archive-s33-source-')), 'Source');
  t.after(async () => fsPromises.rm(path.dirname(sourceRoot), { recursive: true, force: true }));
  const manifest = await writeSourceProject(sourceRoot, options);
  const archive = await buildProjectArchiveBuffer(sourceRoot, {
    createdAtUtc: '2026-07-19T00:00:00.000Z',
  });
  const archivePath = path.join(path.dirname(sourceRoot), 'source.yalken.zip');
  await fsPromises.writeFile(archivePath, archive.buffer);
  return { archivePath, manifest, sourceRoot };
}

async function readManifest(projectRoot) {
  return JSON.parse(await fsPromises.readFile(path.join(projectRoot, PROJECT_MANIFEST_FILENAME), 'utf8'));
}

test('S33 full archive import: command is admitted through catalog, capability, menu, kernel, and runtime surface', () => {
  const catalog = read('src/renderer/commands/command-catalog.v1.mjs');
  const projectCommands = read('src/renderer/commands/projectCommands.mjs');
  const capability = read('src/renderer/commands/capabilityPolicy.mjs');
  const commandKernel = read('src/command/commandSurfaceKernel.js');
  const menuConfig = read('src/menu/menu-config.v2.json');
  const menuLocale = read('src/menu/menu-locale.catalog.v1.json');
  const main = read('src/main.js');
  const html = read('src/renderer/index.html');
  const editor = read('src/renderer/editor.js');
  const runtimeBridge = read('src/renderer/tiptap/runtimeBridge.js');

  assert.ok(catalog.includes("key: 'PROJECT_IMPORT_FULL_ARCHIVE_V1'"));
  assert.ok(catalog.includes("id: 'cmd.project.importFullArchiveV1'"));
  assert.ok(projectCommands.includes('PROJECT_IMPORT_FULL_ARCHIVE_V1: COMMAND_KEY_TO_ID.PROJECT_IMPORT_FULL_ARCHIVE_V1'));
  assert.ok(capability.includes("'cmd.project.importFullArchiveV1': 'cap.project.import.fullArchiveV1'"));
  assert.ok(capability.includes("'cap.project.import.fullArchiveV1': true"));
  assert.ok(capability.includes("'cap.project.import.fullArchiveV1': false"));
  assert.ok(commandKernel.includes("'cmd.project.importFullArchiveV1'"));
  assert.ok(menuConfig.includes('"id": "file-import-full-archive"'));
  assert.ok(menuConfig.includes('"command": "cmd.project.importFullArchiveV1"'));
  assert.ok(menuLocale.includes('"menu.file.importFullArchive"'));
  assert.ok(main.includes("const IMPORT_PROJECT_ARCHIVE_COMMAND_ID = 'cmd.project.importFullArchiveV1';"));
  assert.ok(main.includes('PROJECT_IMPORT_FULL_ARCHIVE_V1: IMPORT_PROJECT_ARCHIVE_COMMAND_ID'));
  assert.ok(main.includes('[COMMAND_SURFACE_KERNEL_COMMAND_IDS.PROJECT_IMPORT_FULL_ARCHIVE_V1]: async (payload = {}) => {'));
  assert.ok(main.includes('[IMPORT_PROJECT_ARCHIVE_COMMAND_ID]: async (payload = {}) => {'));
  assert.ok(main.includes('handleImportProjectArchive,'));
  assert.ok(html.includes('data-import-surface-format="archive"'));
  assert.ok(editor.includes('handleProjectArchiveImportUiPath'));
  assert.ok(editor.includes('COMMAND_IDS.PROJECT_IMPORT_FULL_ARCHIVE_V1'));
  assert.ok(runtimeBridge.includes("commandId === 'cmd.project.importFullArchiveV1'"));
});

test('S33 full archive import: preview verifies archive and performs zero writes', async (t) => {
  const harness = await createHarness(t);
  const { archivePath, manifest } = await writeArchiveFile(t);

  const preview = await harness.main.handleImportProjectArchive({
    requestId: 's33-preview',
    archivePath,
    mode: 'restore',
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.preview, true);
  assert.equal(preview.imported, false);
  assert.equal(preview.archiveManifest.projectId, manifest.projectId);
  assert.equal(preview.restoreAvailable, true);
  assert.equal(fs.existsSync(path.join(harness.documentsRoot, manifest.projectName)), false);
  assertPathless(preview, harness.tempRoot);
});

test('S33 full archive import: restore preserves projectId, unknown fields, backups, and recovery', async (t) => {
  const harness = await createHarness(t);
  const { archivePath, manifest } = await writeArchiveFile(t);

  const restored = await harness.main.handleImportProjectArchive({
    confirmed: true,
    requestId: 's33-restore',
    archivePath,
    mode: 'restore',
  });

  assert.equal(restored.ok, true);
  assert.equal(restored.imported, true);
  assert.equal(restored.mode, 'restore');
  assert.equal(restored.projectId, manifest.projectId);
  const restoredRoot = path.join(harness.documentsRoot, manifest.projectName);
  const restoredManifest = await readManifest(restoredRoot);
  assert.equal(restoredManifest.projectId, manifest.projectId);
  assert.deepEqual(restoredManifest.proUnknown, manifest.proUnknown);
  assert.equal(await fsPromises.readFile(path.join(restoredRoot, 'roman', 'Imported', '01 Start.txt'), 'utf8'), 'scene text');
  assert.equal(await fsPromises.readFile(path.join(restoredRoot, 'backups', 'scene.bak'), 'utf8'), 'backup text');
  assert.equal(await fsPromises.readFile(path.join(restoredRoot, 'recovery', 'snapshot.txt'), 'utf8'), 'recovery text');
  const library = await harness.main.handleWorkspaceProjectLibraryQuery({});
  assert.equal(library.entries.some((entry) => entry.projectId === manifest.projectId), true);
  assertPathless(restored, harness.tempRoot);
  assertPathless(library, harness.tempRoot);
});

test('S33 full archive import: restore collision fails and copy creates a new projectId', async (t) => {
  const harness = await createHarness(t);
  const { archivePath, manifest } = await writeArchiveFile(t);

  const restored = await harness.main.handleImportProjectArchive({
    confirmed: true,
    requestId: 's33-restore-first',
    archivePath,
    mode: 'restore',
  });
  assert.equal(restored.ok, true);

  const collision = await harness.main.handleImportProjectArchive({
    confirmed: true,
    requestId: 's33-restore-collision',
    archivePath,
    mode: 'restore',
  });
  assert.equal(collision.ok, false);
  assert.equal(collision.error.reason, 'project_archive_import_project_id_collision');

  const copied = await harness.main.handleImportProjectArchive({
    confirmed: true,
    requestId: 's33-copy',
    archivePath,
    mode: 'copy',
    projectName: 'Archive Copy',
  });
  assert.equal(copied.ok, true);
  assert.equal(copied.imported, true);
  assert.equal(copied.mode, 'copy');
  assert.notEqual(copied.projectId, manifest.projectId);
  const copyRoot = path.join(harness.documentsRoot, 'Archive Copy');
  const copiedManifest = await readManifest(copyRoot);
  assert.equal(copiedManifest.projectId, copied.projectId);
  assert.equal(copiedManifest.copiedFromProjectId, manifest.projectId);
  assert.equal(Object.prototype.hasOwnProperty.call(copiedManifest, 'treeIdentity'), false);
  assert.deepEqual(copiedManifest.proUnknown, manifest.proUnknown);
  const library = await harness.main.handleWorkspaceProjectLibraryQuery({});
  assert.equal(library.counts.duplicateProjectIds, 0);
  assert.equal(library.entries.some((entry) => entry.projectId === copied.projectId), true);
  assertPathless(copied, harness.tempRoot);
  assertPathless(collision, harness.tempRoot);
});

test('S33 full archive import: corrupt and future-incompatible archives fail before writes', async (t) => {
  const harness = await createHarness(t);
  const { archivePath, manifest } = await writeArchiveFile(t);
  const corruptedPath = path.join(harness.tempRoot, 'corrupted.yalken.zip');
  const corrupted = Buffer.from(await fsPromises.readFile(archivePath));
  const needle = Buffer.from('scene text', 'utf8');
  const offset = corrupted.indexOf(needle);
  assert.notEqual(offset, -1);
  corrupted[offset] = corrupted[offset] ^ 0xff;
  await fsPromises.writeFile(corruptedPath, corrupted);

  const corruptResult = await harness.main.handleImportProjectArchive({
    confirmed: true,
    requestId: 's33-corrupt',
    archivePath: corruptedPath,
    mode: 'restore',
  });
  assert.equal(corruptResult.ok, false);
  assert.match(corruptResult.error.reason, /zip_crc_mismatch|archive_checksum_mismatch/u);
  assert.equal(fs.existsSync(path.join(harness.documentsRoot, manifest.projectName)), false);

  const manifestBuffer = Buffer.from(JSON.stringify({
    schemaVersion: 'yalken-project-archive.v999',
    archiveKind: 'full-project',
    project: { projectId: 'future-project', projectName: 'Future Project' },
    source: { localOnly: true, networkRequired: false, sourceProjectMutated: false },
    entries: [
      {
        archivePath: 'project/project.craftsman.json',
        relativePath: 'project.craftsman.json',
        size: 72,
        sha256: 'invalid',
      },
    ],
  }, null, 2), 'utf8');
  const projectManifest = Buffer.from('{"schemaVersion":1,"projectId":"future-project","projectName":"Future Project"}\n', 'utf8');
  const futureArchive = buildZipArchive([
    { archivePath: 'yalken-archive-manifest.v1.json', buffer: manifestBuffer },
    { archivePath: 'project/project.craftsman.json', buffer: projectManifest },
  ]);
  const futurePath = path.join(harness.tempRoot, 'future.yalken.zip');
  await fsPromises.writeFile(futurePath, futureArchive);

  const futureResult = await harness.main.handleImportProjectArchive({
    confirmed: true,
    requestId: 's33-future',
    archivePath: futurePath,
    mode: 'restore',
  });
  assert.equal(futureResult.ok, false);
  assert.equal(futureResult.error.reason, 'archive_schema_unsupported');
  assert.equal(fs.existsSync(path.join(harness.documentsRoot, 'Future Project')), false);
});
