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
let nativePrepared = false;

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
      get isPackaged() { return paths.bridge?.isPackaged === true; },
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

  if (paths.bridge) {
    const bridge = paths.bridge;
    function InertWindow() {
      bridge.window = this;
      this.webContents = { id: 33, session: {}, isDestroyed: () => false,
        getURL: () => bridge.shellUrl, setWindowOpenHandler() {}, on() {},
        send: (...args) => bridge.sent.push(args) };
      this.isDestroyed = () => false;
      this.on = () => {};
      this.loadFile = (file, { query }) => {
        const url = require('node:url').pathToFileURL(file);
        for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
        bridge.shellUrl = url.href;
        return new Promise(() => {}); // Never starts renderer or startup restoration.
      };
    }
    InertWindow.getFocusedWindow = () => bridge.window;
    InertWindow.getAllWindows = () => [bridge.window];
    electronStub.BrowserWindow = InertWindow;
    electronStub.screen = { getPrimaryDisplay: () => ({ workAreaSize: { width: 1280, height: 800 } }) };
    electronStub.ipcMain.handle = (channel, handler) => bridge.handlers.set(channel, handler);
    electronStub.dialog.showOpenDialog = async (...args) => {
      bridge.openCalls.push(args);
      return bridge.openResult;
    };
  }

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'electron') return electronStub;
    if (paths.bridge && parent?.filename === mainPath && request === './command/commandSurfaceKernel') {
      const actual = originalLoad.call(this, request, parent, isMain);
      return { ...actual, createCommandSurfaceKernel: (...args) => {
        const kernel = actual.createCommandSurfaceKernel(...args);
        return { ...kernel, dispatch: (...input) => {
          paths.bridge.kernelCalls.push(input[0]);
          return kernel.dispatch(...input);
        } };
      } };
    }
    if (paths.bridge && parent?.filename === mainPath && request === './core/minimum-interchange-v1.cjs') {
      const actual = originalLoad.call(this, request, parent, isMain);
      return { ...actual, bindMinimumInterchangeRuntime: runtime => {
        const result = actual.bindMinimumInterchangeRuntime(runtime);
        paths.bridge.menuHandlers = runtime.menuCommandHandlers;
        return result;
      } };
    }
    if (paths.bridge && process.platform !== 'darwin' && parent?.filename === mainPath
      && request === './main/projectArchiveDarwinPublication.cjs') {
      const actual = originalLoad.call(this, request, parent, isMain);
      // Generic CI effect only. Darwin always retains its actual fixed helper.
      return { ...actual, createProjectArchiveDarwinPublisher: () => bridgeGenericPublicationTestPort };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  delete require.cache[mainPath];
  delete require.cache[fileManagerPath];
  try {
    const main = require(mainPath);
    if (paths.bridge) main.createWindow();
    return {
      main,
      fileManager: require(fileManagerPath),
    };
  } finally {
    Module._load = originalLoad;
  }
}

async function createHarness(t, options = {}) {
  // Test/build preparation only; the product never invokes a compiler. Darwin
  // uses the exact production helper. Other CI hosts cover generic import
  // semantics with a test port and do not claim directory qualification.
  if (process.platform === 'darwin' && !nativePrepared) {
    require('../../scripts/build-project-archive-native.cjs').buildProjectArchiveNative();
    nativePrepared = true;
  }
  const tempRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'project-archive-s33-'));
  t.after(async () => fsPromises.rm(tempRoot, { recursive: true, force: true }));
  const documentsParent = path.join(tempRoot, 'Documents');
  const documentsRoot = path.join(documentsParent, 'craftsman');
  const userDataRoot = path.join(tempRoot, 'userData');
  await fsPromises.mkdir(documentsRoot, { recursive: true });
  await fsPromises.mkdir(userDataRoot, { recursive: true });
  const bridge = options.bridge ? { handlers: new Map(), sent: [], openCalls: [], kernelCalls: [],
    isPackaged: options.isPackaged !== false, openResult: { canceled: true } } : null;
  const { main, fileManager } = await loadMainWithElectronStub({
    tempRoot,
    documentsParent,
    userDataRoot,
    bridge,
  });
  if (process.platform !== 'darwin') {
    const importArchive = main.handleImportProjectArchive;
    main.handleImportProjectArchive = (payload, options = {}) => importArchive(payload, { ...options,
      publishArchiveDirectory: options.publishArchiveDirectory || (async ({ tempRoot, targetRoot, assertCurrent }) => {
        await assertCurrent();
        await fsPromises.rename(tempRoot, targetRoot);
        return { namePublished: true, directorySynced: false, publicationOutcome: 'TEST_PORT_ONLY' };
      }) });
  }
  const originalGetDocumentsPath = fileManager.getDocumentsPath;
  fileManager.getDocumentsPath = () => documentsRoot;
  t.after(() => { fileManager.getDocumentsPath = originalGetDocumentsPath; });
  return {
    main,
    tempRoot,
    documentsRoot,
    bridge,
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
  assert.ok(main.includes('[IMPORT_PROJECT_ARCHIVE_COMMAND_ID]: async (payload = {}, context = {}) => {'));
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

for (const kind of ['empty', 'nonempty']) test('S33 actual Main preserves a late foreign ' + kind + ' target directory', async t => {
  const harness = await createHarness(t), input = await writeArchiveFile(t, { projectId: 'race-' + kind });
  let paths, foreign;
  const result = await harness.main.handleImportProjectArchive({ confirmed: true, requestId: 'race-' + kind,
    archivePath: input.archivePath, mode: 'restore' }, {
    afterExtractBeforeFinalMove: async selected => {
      paths = selected; await fsPromises.mkdir(paths.targetRoot);
      if (kind === 'nonempty') await fsPromises.writeFile(path.join(paths.targetRoot, 'foreign.txt'), 'foreign');
      foreign = await fsPromises.lstat(paths.targetRoot, { bigint: true });
    },
    // Generic CI tests Main refusal/ownership semantics. Darwin deliberately
    // uses the production adapter and actual compiled RENAME_EXCL helper.
    ...(process.platform === 'darwin' ? {} : { publishArchiveDirectory: async () => {
      throw Object.assign(Error('target exists'), { code: 'E_PROJECT_ARCHIVE_IMPORT_TARGET_EXISTS' });
    } }),
  });
  assert.equal(result.ok, false);
  assert.equal((await fsPromises.lstat(paths.targetRoot, { bigint: true })).ino, foreign.ino);
  if (kind === 'nonempty') assert.equal(await fsPromises.readFile(path.join(paths.targetRoot, 'foreign.txt'), 'utf8'), 'foreign');
  const library = await harness.main.handleWorkspaceProjectLibraryQuery({});
  assert.equal(library.entries.some(entry => entry.projectId === input.manifest.projectId), false);
});
test('S33 cleanup preserves an unexpected foreign member inside staging', async t => {
  const harness = await createHarness(t), input = await writeArchiveFile(t); let paths, foreign;
  const result = await harness.main.handleImportProjectArchive({ confirmed: true, requestId: 'foreign-staging', archivePath: input.archivePath, mode: 'restore' }, {
    afterExtractBeforeFinalMove: async selected => {
      paths = selected; await fsPromises.writeFile(path.join(paths.tempRoot, 'foreign.txt'), 'foreign', { flag: 'wx' });
      foreign = await fsPromises.lstat(path.join(paths.tempRoot, 'foreign.txt'), { bigint: true });
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.details.cleanup, 'STAGING_OWNERSHIP_UNCONFIRMED');
  assert.equal((await fsPromises.lstat(path.join(paths.tempRoot, 'foreign.txt'), { bigint: true })).ino, foreign.ino);
  assert.equal(await fsPromises.readFile(path.join(paths.tempRoot, 'foreign.txt'), 'utf8'), 'foreign');
  await assert.rejects(fsPromises.lstat(paths.targetRoot), { code: 'ENOENT' });
});
test('S33 failed library registration retains published root and blocks unsafe retry cleanup', async t => {
  const harness = await createHarness(t), input = await writeArchiveFile(t); let paths;
  const manager = require('../../src/utils/fileManager');
  const original = manager.writeFileAtomic;
  let injected = false;
  manager.writeFileAtomic = async (target, ...args) => {
    if (String(target).includes('project-library-index')) { injected = true; return { success: false, error: 'injected registration failure' }; }
    return original(target, ...args);
  };
  let result;
  try {
    result = await harness.main.handleImportProjectArchive({ confirmed: true, requestId: 'registration-fault', archivePath: input.archivePath, mode: 'restore' }, {
      afterExtractBeforeFinalMove: async selected => { paths = selected; },
    });
  } finally { manager.writeFileAtomic = original; }
  assert.equal(injected, true);
  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'PROJECT_ARCHIVE_IMPORT_REGISTRATION_UNCONFIRMED');
  assert.equal(result.error.details.publication.namePublished, true);
  const before = await fsPromises.lstat(paths.targetRoot, { bigint: true });
  const retry = await harness.main.handleImportProjectArchive({ confirmed: true, requestId: 'registration-retry', archivePath: input.archivePath, mode: 'restore' });
  assert.equal(retry.ok, false);
  assert.equal(retry.error.reason, 'PROJECT_ARCHIVE_IMPORT_RECOVERY_REQUIRED');
  assert.equal((await fsPromises.lstat(paths.targetRoot, { bigint: true })).ino, before.ino);
  assert.equal(await fsPromises.readFile(path.join(paths.targetRoot, 'roman', 'Imported', '01 Start.txt'), 'utf8'), 'scene text');
});
test('S33 a lost directory-publication return preserves the final and requires reconciliation', async t => {
  const harness = await createHarness(t), input = await writeArchiveFile(t); let selected;
  const publish = process.platform === 'darwin'
    ? require('../../src/main/projectArchiveDarwinPublication.cjs').createProjectArchiveDarwinPublisher()
    : async request => { await request.assertCurrent(); await fsPromises.rename(request.tempRoot, request.targetRoot); };
  const result = await harness.main.handleImportProjectArchive({ confirmed: true, requestId: 'lost-publish-return', archivePath: input.archivePath, mode: 'restore' }, {
    afterExtractBeforeFinalMove: async paths => { selected = paths; },
    publishArchiveDirectory: async request => { await publish(request); throw Error('injected lost publication return'); },
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.details.publication.namePublished, true);
  assert.equal(result.error.details.publication.publicationOutcome, 'PUBLISHED_UNVERIFIED');
  const before = await fsPromises.lstat(selected.targetRoot, { bigint: true });
  const retry = await harness.main.handleImportProjectArchive({ confirmed: true, requestId: 'lost-return-retry', archivePath: input.archivePath, mode: 'restore' });
  assert.equal(retry.error.reason, 'PROJECT_ARCHIVE_IMPORT_RECOVERY_REQUIRED');
  assert.equal((await fsPromises.lstat(selected.targetRoot, { bigint: true })).ino, before.ino);
  assert.equal(await fsPromises.readFile(path.join(selected.targetRoot, 'notes.json'), 'utf8'), '{"notes":[{"id":"n1"}]}\n');
});

const directoryFixturePaths = ['assets', 'backups', 'recovery', 'references', 'references/空',
  'references/空/Пусто', 'roman', 'roman/Part One', 'roman/Пустая часть'];
async function writeDirectoryProject(root) {
  for (const relative of directoryFixturePaths) await fsPromises.mkdir(path.join(root, relative), { recursive: true });
  const files = new Map([
    [PROJECT_MANIFEST_FILENAME, Buffer.from(JSON.stringify({ schemaVersion: 1,
      projectId: 'project-directory-readonly-20261022', projectName: 'Project Alpha', proUnknown: { preserved: true } }, null, 2) + '\n')],
    ['roman/Part One/Scene 01.txt', Buffer.from('Привет e\u0301 🧭\n')],
    ['notes.json', Buffer.from('{"notes":[{"id":"n1"}]}\n')],
    ['assets/cover.bin', Buffer.from([0, 1, 2, 3])], ['backups/scene.bak', Buffer.from('backup text')],
    ['recovery/snapshot.txt', Buffer.from('readable recovery')],
  ]);
  for (const [relative, bytes] of files) await fsPromises.writeFile(path.join(root, relative), bytes, { flag: 'wx' });
  return files;
}
async function physicalProjectRoster(root) {
  const directories = [], files = [];
  async function visit(relative = '') {
    for (const name of await fsPromises.readdir(path.join(root, relative))) {
      const child = relative ? relative + '/' + name : name;
      const stat = await fsPromises.lstat(path.join(root, child));
      assert.equal(stat.isSymbolicLink(), false);
      if (stat.isDirectory()) { directories.push(child); await visit(child); }
      else { assert.equal(stat.isFile(), true); files.push([child, await fsPromises.readFile(path.join(root, child))]); }
    }
  }
  await visit(); return { directories: directories.sort(), files: files.sort(([a], [b]) => a.localeCompare(b)) };
}
test('S33 actual Main restores all nine physical directories and six exact raw files', async t => {
  const harness = await createHarness(t), source = path.join(harness.tempRoot, 'Source Alpha');
  await fsPromises.writeFile(path.join(harness.tempRoot, '.task-owner.json'), JSON.stringify({
    taskId: 'YALKEN_MAC_ARCHIVE_DIRECTORY_ROUNDTRIP_20261022', scope: 'Owned synthetic S33 fixture only' }), { flag: 'wx' });
  const expectedFiles = await writeDirectoryProject(source), archive = await buildProjectArchiveBuffer(source);
  const archivePath = path.join(harness.tempRoot, 'directories.zip'); await fsPromises.writeFile(archivePath, archive.buffer);
  const result = await harness.main.handleImportProjectArchive({ confirmed: true, requestId: 's33-directory-roster', archivePath, mode: 'restore' });
  assert.equal(result.ok, true, JSON.stringify(result));
  const actual = await physicalProjectRoster(path.join(harness.documentsRoot, 'Project Alpha'));
  assert.deepEqual(actual.files, [...expectedFiles].sort(([a], [b]) => a.localeCompare(b)));
  assert.deepEqual((await physicalProjectRoster(source)).files, actual.files);
  console.log('S33_PHYSICAL_DIRECTORY_OBSERVATION ' + JSON.stringify({ expected: directoryFixturePaths, actual: actual.directories,
    expectedCount: 9, actualCount: actual.directories.length, rawFileCount: actual.files.length }));
  assert.deepEqual(actual.directories, directoryFixturePaths);
});

async function directoryImportInput(t) {
  const harness = await createHarness(t), source = path.join(harness.tempRoot, 'Source Alpha');
  const files = await writeDirectoryProject(source), archive = await buildProjectArchiveBuffer(source);
  const archivePath = path.join(harness.tempRoot, 'directory-input.zip'); await fsPromises.writeFile(archivePath, archive.buffer);
  return { ...harness, source, files, archivePath };
}
async function assertDirectorySourceFiles(input, root = input.source, omitManifest = false) {
  for (const [relative, bytes] of input.files) if (!omitManifest || relative !== PROJECT_MANIFEST_FILENAME) {
    assert.deepEqual(await fsPromises.readFile(path.join(root, relative)), bytes, relative);
  }
}
for (const kind of ['foreign-empty', 'missing', 'swap', 'symlink']) test('S33 owned-directory ' + kind + ' refuses publication and retains unresolved staging', async t => {
  const input = await directoryImportInput(t); let paths, protectedPath, protectedIdentity;
  const result = await input.main.handleImportProjectArchive({ confirmed: true, requestId: 'directory-' + kind,
    archivePath: input.archivePath, mode: 'restore' }, {
    afterExtractBeforeFinalMove: async selected => {
      paths = selected; const leaf = path.join(paths.tempRoot, 'references', '空', 'Пусто');
      if (kind === 'foreign-empty') { protectedPath = path.join(paths.tempRoot, 'foreign-empty'); await fsPromises.mkdir(protectedPath); }
      else if (kind === 'missing') { await fsPromises.rmdir(leaf); protectedPath = path.dirname(leaf); }
      else {
        await fsPromises.rename(leaf, leaf + '-original');
        if (kind === 'swap') { await fsPromises.mkdir(leaf); protectedPath = leaf; }
        else { protectedPath = path.join(input.tempRoot, 'outside'); await fsPromises.mkdir(protectedPath); await fsPromises.symlink(protectedPath, leaf); }
      }
      protectedIdentity = await fsPromises.lstat(protectedPath, { bigint: true });
    },
  });
  assert.equal(result.ok, false); assert.equal(result.error.details.publication.namePublished, false);
  assert.equal(result.error.details.cleanup, 'STAGING_OWNERSHIP_UNCONFIRMED');
  assert.equal((await fsPromises.lstat(protectedPath, { bigint: true })).ino, protectedIdentity.ino);
  await assertDirectorySourceFiles(input); await assertDirectorySourceFiles(input, paths.tempRoot);
  await assert.rejects(fsPromises.lstat(paths.targetRoot), { code: 'ENOENT' });
  const before = await fsPromises.lstat(paths.tempRoot, { bigint: true });
  const retry = await input.main.handleImportProjectArchive({ confirmed: true, requestId: 'directory-retry', archivePath: input.archivePath, mode: 'restore' });
  assert.equal(retry.error.reason, 'PROJECT_ARCHIVE_IMPORT_RECOVERY_REQUIRED');
  assert.equal((await fsPromises.lstat(paths.tempRoot, { bigint: true })).ino, before.ino);
});
for (const phase of ['stat-before', 'stat-after', 'sync', 'close']) test('S33 owned directory live-FD ' + phase + ' failure cannot verify import', async t => {
  const input = await directoryImportInput(t), open = fsPromises.open; let injected = false, stats = 0, paths;
  fsPromises.open = async (target, ...args) => {
    const handle = await open(target, ...args);
    if (String(target).endsWith(path.join('references', '空', 'Пусто'))) {
      const stat = handle.stat.bind(handle), sync = handle.sync.bind(handle), close = handle.close.bind(handle);
      handle.stat = async options => {
        const observed = await stat(options); stats++;
        if (phase === 'stat-before' && stats === 1 || phase === 'stat-after' && stats === 2) {
          injected = true; const changed = Object.create(observed); Object.defineProperty(changed, 'ino', { value: observed.ino + 1n }); return changed;
        }
        return observed;
      };
      if (phase === 'sync') handle.sync = async () => { injected = true; await sync(); throw Error('DIRECTORY_SYNC_LOST_RESULT'); };
      if (phase === 'close') handle.close = async () => { injected = true; await close(); throw Error('DIRECTORY_CLOSE_LOST_RESULT'); };
    }
    return handle;
  };
  let result;
  try { result = await input.main.handleImportProjectArchive({ confirmed: true, requestId: 'directory-fd-' + phase,
    archivePath: input.archivePath, mode: 'restore' }, { beforeExtract: async value => { paths = value; } }); }
  finally { fsPromises.open = open; }
  assert.equal(injected, true); assert.equal(result.ok, false);
  assert.match(result.error.reason, /DIRECTORY_FD_CHANGED|DIRECTORY_SYNC_LOST_RESULT|DIRECTORY_CLOSE_LOST_RESULT/u);
  assert.equal(result.error.details.publication.namePublished, false);
  assert.equal(result.error.details.cleanup, 'OWNED_STAGING_REMOVED');
  await assert.rejects(fsPromises.lstat(paths.targetRoot), { code: 'ENOENT' });
  await assert.rejects(fsPromises.lstat(paths.tempRoot), { code: 'ENOENT' });
  await assertDirectorySourceFiles(input);
});
test('S33 directory loss after actual publication retains useful final and recovery journal', async t => {
  const input = await directoryImportInput(t); let paths, publishedIdentity;
  const publish = process.platform === 'darwin'
    ? require('../../src/main/projectArchiveDarwinPublication.cjs').createProjectArchiveDarwinPublisher()
    : async request => { await request.assertCurrent(); await fsPromises.rename(request.tempRoot, request.targetRoot); return { namePublished: true }; };
  const result = await input.main.handleImportProjectArchive({ confirmed: true, requestId: 'directory-final-loss', archivePath: input.archivePath, mode: 'restore' }, {
    beforeExtract: async selected => { paths = selected; },
    publishArchiveDirectory: async request => {
      const outcome = await publish(request); publishedIdentity = await fsPromises.lstat(paths.targetRoot, { bigint: true });
      await fsPromises.rmdir(path.join(paths.targetRoot, 'references', '空', 'Пусто')); return outcome;
    },
  });
  assert.equal(result.ok, false); assert.match(result.error.reason, /DIRECTORY_ROSTER_MISMATCH/u);
  assert.equal(result.error.details.publication.namePublished, true);
  assert.notEqual(result.error.details.publication.readbackVerified, true);
  assert.equal((await fsPromises.lstat(paths.targetRoot, { bigint: true })).ino, publishedIdentity.ino);
  await assertDirectorySourceFiles(input, paths.targetRoot); await assertDirectorySourceFiles(input);
  const retry = await input.main.handleImportProjectArchive({ confirmed: true, requestId: 'directory-final-retry', archivePath: input.archivePath, mode: 'restore' });
  assert.equal(retry.error.reason, 'PROJECT_ARCHIVE_IMPORT_RECOVERY_REQUIRED');
  assert.equal((await fsPromises.lstat(paths.targetRoot, { bigint: true })).ino, publishedIdentity.ino);
});
test('S33 V2 copy preserves physical topology without changing existing manifest rebind policy', async t => {
  const input = await directoryImportInput(t);
  const result = await input.main.handleImportProjectArchive({ confirmed: true, requestId: 'directory-copy', archivePath: input.archivePath,
    mode: 'copy', projectName: 'Physical Copy' });
  assert.equal(result.ok, true, JSON.stringify(result));
  const root = path.join(input.documentsRoot, 'Physical Copy'), actual = await physicalProjectRoster(root);
  assert.deepEqual(actual.directories, directoryFixturePaths);
  await assertDirectorySourceFiles(input, root, true); await assertDirectorySourceFiles(input);
  assert.notEqual((await readManifest(root)).projectId, 'project-directory-readonly-20261022');
});
test('S33 literal V1 import retains exact files and only known file-parent topology', async t => {
  const input = await directoryImportInput(t), crypto = require('node:crypto');
  const manifest = { schemaVersion: 'yalken-project-archive.v1', archiveKind: 'full-project', project: {
    projectId: 'project-directory-readonly-20261022', projectName: 'Project Alpha' }, entries: [...input.files].map(([relativePath, buffer]) => ({
    relativePath, archivePath: 'project/' + relativePath, size: buffer.length, sha256: crypto.createHash('sha256').update(buffer).digest('hex') })) };
  const bytes = buildZipArchive([{ archivePath: 'yalken-archive-manifest.v1.json', buffer: Buffer.from(JSON.stringify(manifest)) },
    ...[...input.files].map(([relativePath, buffer]) => ({ archivePath: 'project/' + relativePath, buffer }))]);
  const archivePath = path.join(input.tempRoot, 'literal-v1.zip'); await fsPromises.writeFile(archivePath, bytes);
  const result = await input.main.handleImportProjectArchive({ confirmed: true, requestId: 'literal-v1', archivePath, mode: 'restore' });
  assert.equal(result.ok, true, JSON.stringify(result));
  const root = path.join(input.documentsRoot, 'Project Alpha'); await assertDirectorySourceFiles(input, root);
  assert.deepEqual((await physicalProjectRoster(root)).directories, ['assets', 'backups', 'recovery', 'roman', 'roman/Part One']);
  assert.equal(result.archiveManifest.directoryCoverage, 'FILE_PARENTS_ONLY');
  assert.equal(result.archiveManifest.directoryCount, 5); assert.equal(result.archiveManifest.entryCount, 6);
});

const ARCHIVE_BRIDGE_COMMAND = 'cmd.project.importFullArchiveV1';
async function bridgeGenericPublicationTestPort({ tempRoot, targetRoot, parentIdentity, stagingIdentity, assertCurrent }) {
  await assertCurrent();
  assert.equal(path.dirname(tempRoot), path.dirname(targetRoot));
  const sameDirectory = (actual, expected) => {
    assert.equal(actual.isDirectory(), true); assert.equal(actual.isSymbolicLink(), false);
    assert.equal(actual.dev, expected.dev); assert.equal(actual.ino, expected.ino);
  };
  sameDirectory(await fsPromises.lstat(path.dirname(targetRoot), { bigint: true }), parentIdentity);
  sameDirectory(await fsPromises.lstat(tempRoot, { bigint: true }), stagingIdentity);
  await assert.rejects(fsPromises.lstat(targetRoot), { code: 'ENOENT' });
  await assertCurrent();
  // This test-owned target has no competing writer. This is not a native
  // no-clobber/durability proof and never replaces the production adapter.
  await fsPromises.rename(tempRoot, targetRoot);
  sameDirectory(await fsPromises.lstat(targetRoot, { bigint: true }), stagingIdentity);
  sameDirectory(await fsPromises.lstat(path.dirname(targetRoot), { bigint: true }), parentIdentity);
  return { namePublished: true, directorySynced: false, publicationOutcome: 'TEST_PORT_ONLY' };
}
async function archiveBridgeFixture(t, options = {}) {
  const harness = await createHarness(t, { ...options, bridge: true });
  await fsPromises.writeFile(path.join(harness.tempRoot, '.task-owner.json'), JSON.stringify({
    taskId: 'YALKEN_MAC_ARCHIVE_DIRECTORY_ROUNDTRIP_20261022', role: 'OWNED_INERT_MAIN_BRIDGE_FIXTURE' }));
  const source = path.join(harness.tempRoot, 'Source Alpha');
  const files = await writeDirectoryProject(source);
  const archive = await buildProjectArchiveBuffer(source);
  const archivePath = path.join(harness.tempRoot, 'physical-directory-v2.zip');
  await fsPromises.writeFile(archivePath, archive.buffer, { flag: 'wx' });
  harness.bridge.openResult = { canceled: false, filePaths: [archivePath] };
  const shell = harness.bridge.window.webContents;
  const event = () => ({ sender: shell, senderFrame: { url: shell.getURL() } });
  const envelope = (payload, commandId = ARCHIVE_BRIDGE_COMMAND) =>
    require('../../src/core/ipc-envelope-v1.cjs').createEnvelope('ui:command-bridge', commandId, payload);
  const invoke = (payload, commandId) => harness.bridge.handlers.get('ui:command-bridge')(event(), envelope(payload, commandId));
  return { ...harness, source, files, archivePath, event, envelope, invoke };
}
async function completeBridgeFilesystemSnapshot(root) {
  const rows = [];
  async function visit(relative = '') {
    const target = path.join(root, relative), stat = await fsPromises.lstat(target, { bigint: true });
    assert.equal(stat.isSymbolicLink(), false);
    const identity = [relative, String(stat.dev), String(stat.ino), String(stat.uid), String(stat.mode),
      String(stat.size), String(stat.mtimeNs), String(stat.ctimeNs)];
    if (stat.isDirectory()) {
      rows.push([...identity, 'directory']);
      for (const name of (await fsPromises.readdir(target)).sort()) await visit(relative ? relative + '/' + name : name);
    } else {
      assert.equal(stat.isFile(), true);
      rows.push([...identity, (await fsPromises.readFile(target)).toString('hex')]);
    }
  }
  await visit(); return rows;
}
test('S33 actual guarded live-window bridge selects a real archive and previews six files nine directories with zero writes', async t => {
  const input = await archiveBridgeFixture(t), before = await completeBridgeFilesystemSnapshot(input.tempRoot);
  const result = await input.invoke({ requestId: 's33-live-window-preview' });
  const observed = { result, dialogCalls: input.bridge.openCalls.length,
    kernelCalls: input.bridge.kernelCalls, reflected: input.bridge.sent.filter(([channel]) => channel === 'ui:runtime-command') };
  t.diagnostic(JSON.stringify(observed));
  assert.equal(input.bridge.openCalls.length, 1, JSON.stringify(observed));
  assert.deepEqual(input.bridge.kernelCalls, [ARCHIVE_BRIDGE_COMMAND]);
  assert.equal(observed.reflected.length, 0);
  assert.equal(result.ok, true);
  assert.equal(result.value.preview, true);
  assert.equal(result.value.imported, false);
  assert.equal(result.value.archiveManifest.projectId, 'project-directory-readonly-20261022');
  assert.equal(result.value.archiveManifest.projectName, 'Project Alpha');
  assert.equal(result.value.archiveManifest.fileCount, 6);
  assert.equal(result.value.archiveManifest.directoryCount, 9);
  assert.equal(result.value.archiveManifest.entryCount, 15);
  assert.equal(result.value.restoreAvailable, true);
  assertPathless(result, input.tempRoot);
  await new Promise(setImmediate);
  assert.deepEqual(await completeBridgeFilesystemSnapshot(input.tempRoot), before);
});
test('S33 actual guarded archive confirmation reuses Main selection and restores six files nine directories', async t => {
  const input = await archiveBridgeFixture(t), requestId = 's33-live-confirmation';
  const preview = await input.invoke({ requestId });
  assert.equal(preview.value.preview, true); assert.equal(preview.value.restoreAvailable, true);
  const result = await input.invoke({ requestId, confirmed: true, mode: 'restore', openAfterImport: false });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.value.imported, true); assert.equal(result.value.mode, 'restore');
  assert.equal(input.bridge.openCalls.length, 1);
  assert.deepEqual(input.bridge.kernelCalls, [ARCHIVE_BRIDGE_COMMAND, ARCHIVE_BRIDGE_COMMAND]);
  assert.equal(input.bridge.sent.filter(([channel]) => channel === 'ui:runtime-command').length, 0);
  const actual = await physicalProjectRoster(path.join(input.documentsRoot, 'Project Alpha'));
  assert.deepEqual(actual.directories, directoryFixturePaths);
  const expectedFiles = [...input.files].sort(([a], [b]) => a.localeCompare(b));
  assert.deepEqual(actual.files, expectedFiles);
  assert.deepEqual((await physicalProjectRoster(input.source)).files, expectedFiles);
  assertPathless(result, input.tempRoot);
});
test('S33 actual guarded archive picker cancellation has no preview or filesystem mutation', async t => {
  const input = await archiveBridgeFixture(t);
  input.bridge.openResult = { canceled: true, filePaths: [] };
  const before = await completeBridgeFilesystemSnapshot(input.tempRoot);
  const result = await input.invoke({ requestId: 's33-live-cancel' });
  assert.equal(result.ok, true); assert.equal(result.value.canceled, true);
  assert.equal(result.value.preview, false); assert.equal(result.value.imported, false);
  assert.equal(result.value.archiveManifest, undefined);
  assert.equal(input.bridge.openCalls.length, 1);
  assert.deepEqual(input.bridge.kernelCalls, [ARCHIVE_BRIDGE_COMMAND]);
  assert.equal(input.bridge.sent.filter(([channel]) => channel === 'ui:runtime-command').length, 0);
  await new Promise(setImmediate);
  assert.deepEqual(await completeBridgeFilesystemSnapshot(input.tempRoot), before);
});
test('S33 actual guarded archive bridge refuses malformed physical ZIP without writes or false preview', async t => {
  const input = await archiveBridgeFixture(t);
  await fsPromises.writeFile(input.archivePath, Buffer.from('PK\x03\x04not-a-valid-archive'));
  const before = await completeBridgeFilesystemSnapshot(input.tempRoot);
  const result = await input.invoke({ requestId: 's33-live-invalid' });
  assert.equal(result.ok, false); assert.ok(result.reason);
  assert.equal(result.value.preview, undefined); assert.equal(result.value.archiveManifest, undefined);
  assert.equal(input.bridge.openCalls.length, 1);
  assert.deepEqual(input.bridge.kernelCalls, [ARCHIVE_BRIDGE_COMMAND]);
  assert.equal(input.bridge.sent.filter(([channel]) => channel === 'ui:runtime-command').length, 0);
  await new Promise(setImmediate);
  assert.deepEqual(await completeBridgeFilesystemSnapshot(input.tempRoot), before);
});
test('S33 actual native-menu archive handler retains modal intent and ignores payload origin spoofs', async t => {
  const input = await archiveBridgeFixture(t), before = await completeBridgeFilesystemSnapshot(input.tempRoot);
  // The real existing binder exposes this table to our observing loader only;
  // no production export, alternate dispatcher or decision is substituted.
  const handler = input.bridge.menuHandlers[ARCHIVE_BRIDGE_COMMAND];
  for (const payload of [{}, { invocationSource: 'ui-command-bridge', source: 'ui', origin: 'ui-command-bridge' }]) {
    assert.deepEqual(await handler(payload), { ok: true, preview: true });
  }
  assert.equal(input.bridge.openCalls.length, 0); assert.deepEqual(input.bridge.kernelCalls, []);
  assert.deepEqual(input.bridge.sent, Array.from({ length: 2 }, () => ['ui:runtime-command', {
    commandId: ARCHIVE_BRIDGE_COMMAND, payload: { source: 'menu', preview: true } }]));
  assert.deepEqual(await completeBridgeFilesystemSnapshot(input.tempRoot), before);
});
test('S33 actual guarded archive bridge refuses payload and envelope routing-context spoofs', async t => {
  const input = await archiveBridgeFixture(t), before = await completeBridgeFilesystemSnapshot(input.tempRoot);
  for (const extra of [{ source: 'menu' }, { origin: 'native-menu' }, { invocationSource: 'native-menu' },
    { options: { invocationSource: 'native-menu' } }, { route: 'direct' }]) {
    const result = await input.invoke({ requestId: 's33-live-spoof', ...extra });
    assert.equal(result.ok, false, JSON.stringify(result));
    assert.equal(result.value.error.code, 'E_PROJECT_ARCHIVE_IMPORT_PAYLOAD_INVALID');
  }
  assert.deepEqual(input.bridge.kernelCalls, Array(5).fill(ARCHIVE_BRIDGE_COMMAND));
  const request = input.envelope({ requestId: 's33-spoof-envelope' });
  request.invocationSource = 'native-menu';
  const refused = await input.bridge.handlers.get('ui:command-bridge')(input.event(), request);
  assert.equal(refused.ok, false); assert.equal(refused.reason, 'E_ENVELOPE_KEY_UNKNOWN');
  assert.equal(input.bridge.kernelCalls.length, 5);
  assert.equal(input.bridge.openCalls.length, 0); assert.deepEqual(input.bridge.sent, []);
  assert.deepEqual(await completeBridgeFilesystemSnapshot(input.tempRoot), before);
});
test('S33 live archive bridge keeps caller envelope route profile and entitlement refusals before effects', async t => {
  const input = await archiveBridgeFixture(t), before = await completeBridgeFilesystemSnapshot(input.tempRoot);
  const handler = input.bridge.handlers.get('ui:command-bridge');
  const envelope = () => input.envelope({ requestId: 's33-refusal' });
  const genuine = input.event(), shell = genuine.sender;
  for (const [event, code] of [
    [{ ...genuine, sender: { ...shell, id: shell.id + 1 } }, 'E_IPC_SENDER_MISMATCH'],
    [{ ...genuine, sender: { ...shell, session: {} } }, 'E_IPC_SESSION_MISMATCH'],
    [{ ...genuine, senderFrame: { url: shell.getURL().replace('USE_TIPTAP=1', 'USE_TIPTAP=0') } }, 'E_IPC_FRAME_QUERY_DENIED'],
    [{ ...genuine, sender: { ...shell, isDestroyed: () => true } }, 'E_IPC_SENDER_DESTROYED']]) {
    await assert.rejects(async () => handler(event, envelope()), { code });
  }
  for (const change of [{ v: 0 }, { route: 'direct' }, { commandId: 'cmd.forbidden.archive' }]) {
    assert.equal((await handler(genuine, { ...envelope(), ...change })).ok, false);
  }
  const optionalCommand = 'cmd.project.review.applyExactTextChange';
  const profiled = await input.invoke({}, optionalCommand);
  assert.equal(profiled.ok, false);
  if (process.platform === 'darwin') assert.equal(profiled.reason, 'WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED');
  else assert.equal(profiled.value.code, 'E_COMMAND_DISABLED_FOR_ENTITLEMENT');
  // A separate ordinary source host uses its actual inactive profile and shell
  // URL; no profile evaluator or product-owned FREE entitlement is substituted.
  const sourceHost = await archiveBridgeFixture(t, { isPackaged: false });
  const sourceBefore = await completeBridgeFilesystemSnapshot(sourceHost.tempRoot);
  const unentitled = await sourceHost.invoke({}, optionalCommand);
  assert.equal(unentitled.ok, false); assert.equal(unentitled.value.code, 'E_COMMAND_DISABLED_FOR_ENTITLEMENT');
  assert.deepEqual(sourceHost.bridge.kernelCalls, []); assert.equal(sourceHost.bridge.openCalls.length, 0);
  assert.deepEqual(sourceHost.bridge.sent, []);
  assert.deepEqual(await completeBridgeFilesystemSnapshot(sourceHost.tempRoot), sourceBefore);
  assert.deepEqual(input.bridge.kernelCalls, []); assert.equal(input.bridge.openCalls.length, 0);
  assert.deepEqual(input.bridge.sent, []);
  assert.deepEqual(await completeBridgeFilesystemSnapshot(input.tempRoot), before);
});
test('S33 generic bridge publication test port checks real ownership and preserves an existing target', async t => {
  const input = await archiveBridgeFixture(t), tempRoot = path.join(input.tempRoot, 'generic-stage');
  const targetRoot = path.join(input.tempRoot, 'generic-final');
  await fsPromises.mkdir(tempRoot);
  const parentIdentity = await fsPromises.lstat(input.tempRoot, { bigint: true });
  const stagingIdentity = await fsPromises.lstat(tempRoot, { bigint: true });
  let currentChecks = 0;
  const args = { tempRoot, targetRoot, parentIdentity, stagingIdentity, assertCurrent: async () => { currentChecks++; } };
  await assert.rejects(bridgeGenericPublicationTestPort({ ...args, stagingIdentity: { ...stagingIdentity, ino: stagingIdentity.ino + 1n } }));
  await fsPromises.mkdir(targetRoot);
  const foreign = await fsPromises.lstat(targetRoot, { bigint: true });
  await assert.rejects(bridgeGenericPublicationTestPort(args));
  assert.equal((await fsPromises.lstat(targetRoot, { bigint: true })).ino, foreign.ino);
  await fsPromises.rmdir(targetRoot); // Only this empty marker-owned fixture directory.
  currentChecks = 0;
  assert.deepEqual(await bridgeGenericPublicationTestPort(args), {
    namePublished: true, directorySynced: false, publicationOutcome: 'TEST_PORT_ONLY' });
  assert.equal(currentChecks, 2);
  assert.equal((await fsPromises.lstat(targetRoot, { bigint: true })).ino, stagingIdentity.ino);
});
