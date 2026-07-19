const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const Module = require('node:module');

const ROOT = path.resolve(__dirname, '..', '..');
const PROJECT_MANIFEST_FILENAME = 'project.craftsman.json';

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
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
  const tempRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'project-lifecycle-s28-'));
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
    userDataRoot,
  };
}

async function writeProject(root, options = {}) {
  const romanRoot = path.join(root, 'roman', 'Imported');
  await fsPromises.mkdir(romanRoot, { recursive: true });
  const manifest = {
    schemaVersion: 1,
    projectId: options.projectId || 'project-alpha',
    projectName: options.projectName || 'Alpha',
    createdAtUtc: '2026-01-01T00:00:00.000Z',
    proUnknown: {
      preserved: true,
      nested: { mode: 'read-only-pro-data' },
    },
  };
  await fsPromises.writeFile(
    path.join(root, PROJECT_MANIFEST_FILENAME),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  await fsPromises.writeFile(path.join(romanRoot, '01 Start.txt'), 'first scene', 'utf8');
  await fsPromises.writeFile(path.join(root, 'notes.txt'), 'note payload', 'utf8');
  return manifest;
}

function assertPathless(value, forbiddenRoot) {
  const text = JSON.stringify(value);
  assert.equal(text.includes(forbiddenRoot), false);
  assert.equal(/"(projectRoot|manifestPath|rootPath|privatePath|filePath)"/u.test(text), false);
}

async function readManifest(root) {
  return JSON.parse(await fsPromises.readFile(path.join(root, PROJECT_MANIFEST_FILENAME), 'utf8'));
}

test('S28 project lifecycle: archive is index-only and preserves unknown project data', async (t) => {
  const harness = await createHarness(t);
  const projectRoot = path.join(harness.documentsRoot, 'Alpha');
  const manifest = await writeProject(projectRoot);
  await harness.main.handleWorkspaceProjectLibraryQuery({});

  const archived = await harness.main.handleProjectLifecycleArchiveCommand({
    projectId: manifest.projectId,
  });

  assert.equal(archived.ok, true);
  assert.equal(archived.archived, true);
  assert.equal(archived.receipt.indexOnly, true);
  assert.equal(fs.existsSync(projectRoot), true);
  assert.deepEqual((await readManifest(projectRoot)).proUnknown, manifest.proUnknown);

  const library = await harness.main.handleWorkspaceProjectLibraryQuery({});
  const entry = library.entries.find((item) => item.projectId === manifest.projectId);
  assert.equal(entry.status, 'archived');
  assertPathless(archived, harness.tempRoot);
  assertPathless(library, harness.tempRoot);
});

test('S28 project lifecycle: trash and restore are reversible and preserve full project data', async (t) => {
  const harness = await createHarness(t);
  const projectRoot = path.join(harness.documentsRoot, 'Alpha');
  const manifest = await writeProject(projectRoot);
  await harness.main.handleWorkspaceProjectLibraryQuery({});

  const trashed = await harness.main.handleProjectLifecycleTrashCommand({
    projectId: manifest.projectId,
  });

  assert.equal(trashed.ok, true);
  assert.equal(trashed.trashed, true);
  assert.equal(fs.existsSync(projectRoot), false);
  const trashRoot = path.join(harness.documentsRoot, 'trash', 'Alpha');
  assert.equal(fs.existsSync(trashRoot), true);
  assert.equal(await fsPromises.readFile(path.join(trashRoot, 'roman', 'Imported', '01 Start.txt'), 'utf8'), 'first scene');
  assert.deepEqual((await readManifest(trashRoot)).proUnknown, manifest.proUnknown);

  const afterTrash = await harness.main.handleWorkspaceProjectLibraryQuery({});
  assert.equal(afterTrash.entries.find((item) => item.projectId === manifest.projectId).status, 'trashed');

  const permanentDelete = await harness.main.handleProjectLifecyclePermanentDeleteCommand({
    projectId: manifest.projectId,
  });
  assert.equal(permanentDelete.ok, false);
  assert.equal(permanentDelete.details.deleted, false);
  assert.equal(fs.existsSync(trashRoot), true);

  const restored = await harness.main.handleProjectLifecycleRestoreCommand({
    projectId: manifest.projectId,
  });

  assert.equal(restored.ok, true);
  assert.equal(restored.restored, true);
  assert.equal(fs.existsSync(trashRoot), false);
  assert.equal(fs.existsSync(projectRoot), true);
  assert.deepEqual((await readManifest(projectRoot)).proUnknown, manifest.proUnknown);

  const afterRestore = await harness.main.handleWorkspaceProjectLibraryQuery({});
  assert.equal(afterRestore.entries.find((item) => item.projectId === manifest.projectId).status, 'available');
  assertPathless(trashed, harness.tempRoot);
  assertPathless(restored, harness.tempRoot);
  assertPathless(permanentDelete, harness.tempRoot);
});

test('S28 project lifecycle: manual backup and integrity report are local pathless trust receipts', async (t) => {
  const harness = await createHarness(t);
  const projectRoot = path.join(harness.documentsRoot, 'Alpha');
  const manifest = await writeProject(projectRoot);
  await harness.main.handleWorkspaceProjectLibraryQuery({});

  const backup = await harness.main.handleProjectLifecycleCreateBackupCommand({
    projectId: manifest.projectId,
  });

  assert.equal(backup.ok, true);
  assert.equal(backup.backupCreated, true);
  assert.equal(backup.receipt.backupCreated, true);
  assert.equal(backup.receipt.fileCount >= 3, true);
  const backupsRoot = path.join(harness.documentsRoot, 'backups', 'manual-project-backups');
  const backupEntries = await fsPromises.readdir(backupsRoot);
  assert.equal(backupEntries.length, 1);
  assert.equal(fs.existsSync(path.join(backupsRoot, backupEntries[0], 'project-backup-receipt.v1.json')), true);

  const integrity = await harness.main.handleProjectLifecycleInspectIntegrityCommand({
    projectId: manifest.projectId,
  });
  assert.equal(integrity.ok, true);
  assert.equal(integrity.integrity.status, 'ok');
  assert.equal(integrity.authority.pathsExposed, false);
  assert.equal(integrity.integrity.fileCount >= 3, true);

  await fsPromises.writeFile(path.join(projectRoot, PROJECT_MANIFEST_FILENAME), '{"schemaVersion":', 'utf8');
  const corrupt = await harness.main.handleProjectLifecycleInspectIntegrityCommand({
    projectId: manifest.projectId,
  });
  assert.equal(corrupt.ok, true);
  assert.equal(corrupt.integrity.status, 'corrupt');
  assert.equal(corrupt.integrity.checks.manifestJsonValid, false);
  assert.equal(corrupt.integrity.warnings.includes('PROJECT_MANIFEST_CORRUPT'), true);
  assertPathless(backup, harness.tempRoot);
  assertPathless(integrity, harness.tempRoot);
  assertPathless(corrupt, harness.tempRoot);
});

test('S28 project lifecycle UI bridge and renderer wiring are explicit', () => {
  const main = read('src/main.js');
  const renderer = read('src/renderer/editor.js');
  const html = read('src/renderer/index.html');
  const commands = read('src/renderer/commands/projectCommands.mjs');

  assert.match(main, /PROJECT_LIFECYCLE_ARCHIVE_COMMAND_ID = 'cmd\.project\.lifecycle\.archive'/u);
  assert.match(main, /PROJECT_LIFECYCLE_TRASH_COMMAND_ID = 'cmd\.project\.lifecycle\.trash'/u);
  assert.match(main, /PROJECT_LIFECYCLE_RESTORE_COMMAND_ID = 'cmd\.project\.lifecycle\.restore'/u);
  assert.match(main, /PROJECT_LIFECYCLE_BACKUP_COMMAND_ID = 'cmd\.project\.lifecycle\.createBackup'/u);
  assert.match(main, /PROJECT_LIFECYCLE_INTEGRITY_COMMAND_ID = 'cmd\.project\.lifecycle\.inspectIntegrity'/u);
  assert.match(main, /handleProjectLifecycleArchiveCommand,/u);
  assert.match(main, /handleProjectLifecycleTrashCommand,/u);
  assert.match(main, /handleProjectLifecycleRestoreCommand,/u);
  assert.match(main, /handleProjectLifecycleCreateBackupCommand,/u);
  assert.match(main, /handleProjectLifecycleInspectIntegrityCommand,/u);
  assert.match(commands, /PROJECT_LIFECYCLE_ARCHIVE: 'cmd\.project\.lifecycle\.archive'/u);
  assert.match(commands, /PROJECT_LIFECYCLE_TRASH: 'cmd\.project\.lifecycle\.trash'/u);
  assert.match(commands, /PROJECT_LIFECYCLE_RESTORE: 'cmd\.project\.lifecycle\.restore'/u);
  assert.match(commands, /PROJECT_LIFECYCLE_BACKUP: 'cmd\.project\.lifecycle\.createBackup'/u);
  assert.match(commands, /PROJECT_LIFECYCLE_INTEGRITY: 'cmd\.project\.lifecycle\.inspectIntegrity'/u);
  assert.match(renderer, /archiveSelectedProjectFromLibraryModal/u);
  assert.match(renderer, /trashSelectedProjectFromLibraryModal/u);
  assert.match(renderer, /restoreSelectedProjectFromLibraryModal/u);
  assert.match(renderer, /backupSelectedProjectFromLibraryModal/u);
  assert.match(renderer, /inspectSelectedProjectIntegrityFromLibraryModal/u);
  assert.match(html, /data-project-library-archive/u);
  assert.match(html, /data-project-library-trash/u);
  assert.match(html, /data-project-library-restore/u);
  assert.match(html, /data-project-library-backup/u);
  assert.match(html, /data-project-library-integrity/u);
});
