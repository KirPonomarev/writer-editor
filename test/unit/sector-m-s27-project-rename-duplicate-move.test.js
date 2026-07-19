const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const Module = require('node:module');

const ROOT = path.resolve(__dirname, '..', '..');
const PROJECT_MANIFEST_FILENAME = 'project.craftsman.json';
const PROJECT_LIFECYCLE_JOURNAL_FILENAME = '.project-lifecycle-journal.v1.json';

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
      showOpenDialog: async () => ({
        canceled: !paths.dialogTargetParent,
        filePaths: paths.dialogTargetParent ? [paths.dialogTargetParent] : [],
      }),
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

async function createHarness(t, options = {}) {
  const tempRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'project-lifecycle-s27-'));
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
    dialogTargetParent: options.dialogTargetParent,
  });
  const originalGetDocumentsPath = fileManager.getDocumentsPath;
  fileManager.getDocumentsPath = () => documentsRoot;
  t.after(() => { fileManager.getDocumentsPath = originalGetDocumentsPath; });
  return {
    main,
    tempRoot,
    documentsRoot,
    userDataRoot,
    journalPath: path.join(documentsRoot, PROJECT_LIFECYCLE_JOURNAL_FILENAME),
  };
}

async function writeProject(root, options = {}) {
  const romanRoot = path.join(root, 'roman', 'Imported');
  await fsPromises.mkdir(romanRoot, { recursive: true });
  const manifest = {
    schemaVersion: options.schemaVersion ?? 1,
    projectId: options.projectId || 'project-alpha',
    projectName: options.projectName || 'Alpha',
    createdAtUtc: '2026-01-01T00:00:00.000Z',
    treeIdentity: options.treeIdentity || {
      schemaVersion: 'project-tree-identity.v1',
      nodes: {
        'tree-node-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa': {
          bindingKey: 'file:roman/Imported/01 Start.txt',
          kind: 'scene',
          present: true,
        },
      },
    },
    proUnknown: { preserved: true },
  };
  await fsPromises.writeFile(
    path.join(root, PROJECT_MANIFEST_FILENAME),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  await fsPromises.writeFile(path.join(romanRoot, '01 Start.txt'), 'first scene', 'utf8');
  return manifest;
}

function assertPathless(value, forbiddenRoot) {
  const text = JSON.stringify(value);
  assert.equal(text.includes(forbiddenRoot), false);
  assert.equal(/projectRoot|manifestPath|filePath|privatePath/u.test(text), false);
}

test('S27 project lifecycle: rename preserves projectId and unknown manifest fields', async (t) => {
  const harness = await createHarness(t);
  const projectRoot = path.join(harness.documentsRoot, 'Alpha');
  const manifest = await writeProject(projectRoot, {
    projectId: 'project-alpha',
    projectName: 'Alpha',
  });

  const renamed = await harness.main.handleProjectLifecycleRenameCommand({
    projectId: manifest.projectId,
    projectName: 'Beta',
  });

  assert.equal(renamed.ok, true);
  assert.equal(renamed.renamed, true);
  assert.equal(renamed.projectId, manifest.projectId);
  assert.equal(fs.existsSync(projectRoot), false);
  const nextRoot = path.join(harness.documentsRoot, 'Beta');
  const nextManifest = JSON.parse(await fsPromises.readFile(path.join(nextRoot, PROJECT_MANIFEST_FILENAME), 'utf8'));
  assert.equal(nextManifest.projectId, manifest.projectId);
  assert.equal(nextManifest.projectName, 'Beta');
  assert.deepEqual(nextManifest.proUnknown, { preserved: true });

  const library = await harness.main.handleWorkspaceProjectLibraryQuery({});
  assert.equal(library.ok, true);
  assert.equal(library.entries[0].projectName, 'Beta');
  assertPathless(library, harness.tempRoot);
});

test('S27 project lifecycle: duplicate creates a new projectId and resets tree identity', async (t) => {
  const harness = await createHarness(t);
  const projectRoot = path.join(harness.documentsRoot, 'Alpha');
  const manifest = await writeProject(projectRoot, {
    projectId: 'project-alpha',
    projectName: 'Alpha',
  });

  const duplicated = await harness.main.handleProjectLifecycleDuplicateCommand({
    projectId: manifest.projectId,
    projectName: 'Alpha Copy',
  });

  assert.equal(duplicated.ok, true);
  assert.equal(duplicated.duplicated, true);
  assert.notEqual(duplicated.projectId, manifest.projectId);
  const copiedRoot = path.join(harness.documentsRoot, 'Alpha Copy');
  assert.equal(await fsPromises.readFile(path.join(copiedRoot, 'roman', 'Imported', '01 Start.txt'), 'utf8'), 'first scene');
  const copiedManifest = JSON.parse(await fsPromises.readFile(path.join(copiedRoot, PROJECT_MANIFEST_FILENAME), 'utf8'));
  assert.equal(copiedManifest.projectId, duplicated.projectId);
  assert.equal(copiedManifest.projectName, 'Alpha Copy');
  assert.equal(copiedManifest.duplicatedFromProjectId, manifest.projectId);
  assert.equal(Object.prototype.hasOwnProperty.call(copiedManifest, 'treeIdentity'), false);
  assert.deepEqual(copiedManifest.proUnknown, { preserved: true });

  const library = await harness.main.handleWorkspaceProjectLibraryQuery({});
  assert.equal(library.ok, true);
  assert.equal(library.counts.duplicateProjectIds, 0);
  assert.equal(library.entries.some((entry) => entry.projectId === duplicated.projectId), true);
  assertPathless(library, harness.tempRoot);
});

test('S27 project lifecycle: move location retains projectId and remains visible from private index', async (t) => {
  const targetParent = path.join(os.tmpdir(), `project-lifecycle-s27-target-${Date.now()}`);
  const harness = await createHarness(t);
  const nestedTargetParent = path.join(harness.documentsRoot, 'Shelves');
  await fsPromises.mkdir(nestedTargetParent, { recursive: true });
  const projectRoot = path.join(harness.documentsRoot, 'Alpha');
  const manifest = await writeProject(projectRoot, {
    projectId: 'project-alpha',
    projectName: 'Alpha',
  });

  const moved = await harness.main.handleProjectLifecycleMoveLocationCommand({
    projectId: manifest.projectId,
    targetParentPath: nestedTargetParent || targetParent,
  });

  assert.equal(moved.ok, true);
  assert.equal(moved.moved, true);
  const movedRoot = path.join(nestedTargetParent, 'Alpha');
  assert.equal(fs.existsSync(projectRoot), false);
  const movedManifest = JSON.parse(await fsPromises.readFile(path.join(movedRoot, PROJECT_MANIFEST_FILENAME), 'utf8'));
  assert.equal(movedManifest.projectId, manifest.projectId);
  assert.deepEqual(movedManifest.proUnknown, { preserved: true });

  const library = await harness.main.handleWorkspaceProjectLibraryQuery({});
  assert.equal(library.ok, true);
  const entry = library.entries.find((item) => item.projectId === manifest.projectId);
  assert.ok(entry);
  assert.equal(entry.status, 'available');
  assert.equal(entry.warnings.includes('PROJECT_MISSING'), false);
  assertPathless(library, harness.tempRoot);
});

test('S27 project lifecycle: journal recovery restores an interrupted directory move', async (t) => {
  const harness = await createHarness(t);
  const projectRoot = path.join(harness.documentsRoot, 'Alpha');
  const tempRoot = `${projectRoot}.project-lifecycle-move-test.tmp`;
  const targetRoot = path.join(harness.documentsRoot, 'Beta');
  const manifest = await writeProject(projectRoot, {
    projectId: 'project-alpha',
    projectName: 'Alpha',
  });
  await fsPromises.rename(projectRoot, tempRoot);
  await fsPromises.writeFile(harness.journalPath, JSON.stringify({
    schemaVersion: 'project-lifecycle-journal.v1',
    commandId: 'cmd.project.lifecycle.rename',
    projectId: manifest.projectId,
    phase: 'source-moved-to-temp',
    sourceRoot: projectRoot,
    targetRoot,
    tempRoot,
  }, null, 2), 'utf8');

  const recovered = await harness.main.recoverProjectLifecycleJournal();
  assert.equal(recovered.ok, true);
  assert.equal(recovered.recovered, true);
  assert.equal(fs.existsSync(projectRoot), true);
  assert.equal(fs.existsSync(tempRoot), false);
  assert.equal(fs.existsSync(harness.journalPath), false);
});

test('S27 project lifecycle UI bridge and renderer wiring are explicit', () => {
  const main = read('src/main.js');
  const renderer = read('src/renderer/editor.js');
  const html = read('src/renderer/index.html');
  const commands = read('src/renderer/commands/projectCommands.mjs');

  assert.match(main, /PROJECT_LIFECYCLE_RENAME_COMMAND_ID = 'cmd\.project\.lifecycle\.rename'/u);
  assert.match(main, /PROJECT_LIFECYCLE_DUPLICATE_COMMAND_ID = 'cmd\.project\.lifecycle\.duplicate'/u);
  assert.match(main, /PROJECT_LIFECYCLE_MOVE_LOCATION_COMMAND_ID = 'cmd\.project\.lifecycle\.moveLocation'/u);
  assert.match(main, /handleProjectLifecycleRenameCommand,/u);
  assert.match(main, /handleProjectLifecycleDuplicateCommand,/u);
  assert.match(main, /handleProjectLifecycleMoveLocationCommand,/u);
  assert.match(commands, /PROJECT_LIFECYCLE_RENAME: 'cmd\.project\.lifecycle\.rename'/u);
  assert.match(commands, /PROJECT_LIFECYCLE_DUPLICATE: 'cmd\.project\.lifecycle\.duplicate'/u);
  assert.match(commands, /PROJECT_LIFECYCLE_MOVE_LOCATION: 'cmd\.project\.lifecycle\.moveLocation'/u);
  assert.match(renderer, /data-project-library-rename/u);
  assert.match(renderer, /renameSelectedProjectFromLibraryModal/u);
  assert.match(renderer, /duplicateSelectedProjectFromLibraryModal/u);
  assert.match(renderer, /moveSelectedProjectFromLibraryModal/u);
  assert.match(html, /data-project-library-rename/u);
  assert.match(html, /data-project-library-duplicate/u);
  assert.match(html, /data-project-library-move/u);
});
