const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');

const {
  ARCHIVE_SCHEMA_VERSION_V2: ARCHIVE_SCHEMA_VERSION,
  readProjectArchivePayload,
  verifyProjectArchiveBuffer,
} = require('../../src/export/archive/projectArchiveExportHandler');

const ROOT = path.resolve(__dirname, '..', '..');
const PROJECT_MANIFEST_FILENAME = 'project.craftsman.json';

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sectionBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, startMarker);
  assert.notEqual(end, -1, endMarker);
  return source.slice(start, end);
}

async function loadMainWithElectronStub(paths) {
  const mainPath = path.join(ROOT, 'src', 'main.js');
  const fileManagerPath = path.join(ROOT, 'src', 'utils', 'fileManager.js');
  const originalLoad = Module._load;
  let saveDialog = async () => ({ canceled: true });
  let inertWindow;
  // This is an inert JS host, never an Electron window or rendered application.
  function InertWindow() {
    inertWindow = this;
    const listeners = new Map();
    this.webContents = { setWindowOpenHandler() {}, on() {}, send() {}, setZoomFactor() {} };
    this.on = (name, callback) => { listeners.set(name, callback); };
    this.close = () => listeners.get('closed')?.();
    this.loadFile = () => new Promise(() => {});
    this.isDestroyed = () => false;
    this.setTitle = () => {};
  }
  InertWindow.getFocusedWindow = () => null;
  InertWindow.getAllWindows = () => [];
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
    BrowserWindow: InertWindow,
    screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1280, height: 800 } }) },
    Menu: {
      buildFromTemplate: () => ({}),
      setApplicationMenu: () => {},
    },
    dialog: {
      showMessageBox: async () => ({}),
      showSaveDialog: (...args) => saveDialog(...args),
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
    const main = require(mainPath);
    return {
      main,
      fileManager: require(fileManagerPath),
      setSaveDialog: handler => { saveDialog = handler; },
      createInertWindow: () => {
        const load = Module._load;
        Module._load = function(request, ...args) {
          return request === 'electron' ? electronStub : load.call(this, request, ...args);
        };
        try { main.createWindow(); return inertWindow; } finally { Module._load = load; }
      },
    };
  } finally {
    Module._load = originalLoad;
  }
}

async function createHarness(t) {
  const tempRoot = await fsPromises.realpath(await fsPromises.mkdtemp(path.join(os.tmpdir(), 'project-archive-s32-')));
  t.after(async () => fsPromises.rm(tempRoot, { recursive: true, force: true }));
  const documentsParent = path.join(tempRoot, 'Documents');
  const documentsRoot = path.join(documentsParent, 'craftsman');
  const userDataRoot = path.join(tempRoot, 'userData');
  await fsPromises.mkdir(documentsRoot, { recursive: true });
  await fsPromises.mkdir(userDataRoot, { recursive: true });
  const { main, fileManager, setSaveDialog, createInertWindow } = await loadMainWithElectronStub({
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
    setSaveDialog,
    createInertWindow,
  };
}

async function writeDefaultProject(root, { projectName = 'Роман', projectId = 'project-s32', sceneText = 'scene text' } = {}) {
  const projectRoot = path.join(root, projectName);
  await fsPromises.mkdir(path.join(projectRoot, 'roman', 'Imported'), { recursive: true });
  await fsPromises.mkdir(path.join(projectRoot, 'assets'), { recursive: true });
  await fsPromises.mkdir(path.join(projectRoot, 'backups'), { recursive: true });
  await fsPromises.mkdir(path.join(projectRoot, 'recovery'), { recursive: true });
  const manifest = {
    schemaVersion: 1,
    projectId,
    projectName,
    proUnknown: {
      entities: [{ id: 'entity-1', kind: 'character' }],
      timeline: { preserved: true },
    },
  };
  await fsPromises.writeFile(
    path.join(projectRoot, PROJECT_MANIFEST_FILENAME),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  await fsPromises.writeFile(path.join(projectRoot, 'roman', 'Imported', '01 Start.txt'), sceneText, 'utf8');
  await fsPromises.writeFile(path.join(projectRoot, 'notes.json'), '{"notes":[{"id":"n1"}]}\n', 'utf8');
  await fsPromises.writeFile(path.join(projectRoot, 'assets', 'image.bin'), Buffer.from([4, 5, 6]));
  await fsPromises.writeFile(path.join(projectRoot, 'backups', '01 Start.txt.bak'), 'backup text', 'utf8');
  await fsPromises.writeFile(path.join(projectRoot, 'recovery', 'snapshot.txt'), 'recovery text', 'utf8');
  return { projectRoot, manifest };
}

async function hashProjectFiles(projectRoot) {
  const hashes = new Map();
  async function visit(directoryPath) {
    const dirents = await fsPromises.readdir(directoryPath, { withFileTypes: true });
    for (const dirent of dirents) {
      const childPath = path.join(directoryPath, dirent.name);
      if (dirent.isDirectory()) {
        await visit(childPath);
      } else if (dirent.isFile()) {
        hashes.set(path.relative(projectRoot, childPath), sha256(await fsPromises.readFile(childPath)));
      }
    }
  }
  await visit(projectRoot);
  return hashes;
}

async function readLeaseFences(userDataRoot) {
  const fences = new Map();
  async function visit(directory) {
    let entries;
    try { entries = await fsPromises.readdir(directory, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    for (const entry of entries) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(target);
      else if (entry.name === 'fencing-generation.v1.json') {
        const raw = await fsPromises.readFile(target, 'utf8'), record = JSON.parse(raw);
        fences.set(record.projectId, { generation: record.fencingGeneration, raw });
      }
    }
  }
  await visit(path.join(userDataRoot, 'stage10-integrity-anchors'));
  return fences;
}

async function assertExactArchive(outPath, projectRoot, manifest) {
  const bytes = await fsPromises.readFile(outPath), verified = verifyProjectArchiveBuffer(bytes);
  assert.equal(verified.manifest.project.projectId, manifest.projectId);
  assert.equal(verified.manifest.project.projectName, manifest.projectName);
  const payload = readProjectArchivePayload(bytes), source = await hashProjectFiles(projectRoot);
  assert.equal(payload.entries.length, source.size);
  assert.deepEqual(payload.entries.map(entry => [entry.relativePath, sha256(entry.buffer)]).sort(), [...source].sort());
  assert.deepEqual(payload.entries.find(entry => entry.relativePath === PROJECT_MANIFEST_FILENAME).buffer,
    await fsPromises.readFile(path.join(projectRoot, PROJECT_MANIFEST_FILENAME)));
}

async function twoProjects(t) {
  const harness = await createHarness(t);
  const original = await writeDefaultProject(harness.documentsRoot);
  const selected = await writeDefaultProject(harness.documentsRoot, {
    projectName: 'Выбранный роман', projectId: 'project-s32-selected', sceneText: 'selected only 🧭',
  });
  const opened = await harness.main.handleProjectLifecycleOpenCommand({ projectId: selected.manifest.projectId });
  assert.equal(opened.ok, true, JSON.stringify(opened));
  return { ...harness, original, selected };
}

test('S32 full archive export: command is admitted through catalog, capability, menu, and kernel', () => {
  const catalog = read('src/renderer/commands/command-catalog.v1.mjs');
  const projectCommands = read('src/renderer/commands/projectCommands.mjs');
  const capability = read('src/renderer/commands/capabilityPolicy.mjs');
  const commandKernel = read('src/command/commandSurfaceKernel.js');
  const menuConfig = read('src/menu/menu-config.v2.json');
  const menuLocale = read('src/menu/menu-locale.catalog.v1.json');
  const main = read('src/main.js');

  assert.ok(catalog.includes("key: 'PROJECT_EXPORT_FULL_ARCHIVE_V1'"));
  assert.ok(catalog.includes("id: 'cmd.project.exportFullArchiveV1'"));
  assert.ok(projectCommands.includes('PROJECT_EXPORT_FULL_ARCHIVE_V1: COMMAND_KEY_TO_ID.PROJECT_EXPORT_FULL_ARCHIVE_V1'));
  assert.ok(capability.includes("'cmd.project.exportFullArchiveV1': 'cap.project.export.fullArchiveV1'"));
  assert.ok(capability.includes("'cap.project.export.fullArchiveV1': true"));
  assert.ok(capability.includes("'cap.project.export.fullArchiveV1': false"));
  assert.ok(commandKernel.includes("'cmd.project.exportFullArchiveV1'"));
  assert.ok(menuConfig.includes('"id": "file-export-full-archive"'));
  assert.ok(menuConfig.includes('"command": "cmd.project.exportFullArchiveV1"'));
  assert.ok(menuLocale.includes('"menu.file.exportFullArchive"'));
  assert.ok(main.includes("const EXPORT_PROJECT_ARCHIVE_COMMAND_ID = 'cmd.project.exportFullArchiveV1';"));
  assert.ok(main.includes('PROJECT_EXPORT_FULL_ARCHIVE_V1: EXPORT_PROJECT_ARCHIVE_COMMAND_ID'));
  assert.ok(main.includes('[COMMAND_SURFACE_KERNEL_COMMAND_IDS.PROJECT_EXPORT_FULL_ARCHIVE_V1]: async (payload = {}) => {'));
  assert.ok(main.includes('[EXPORT_PROJECT_ARCHIVE_COMMAND_ID]: async (payload = {}) => {'));
});

test('S32 full archive export: export surface and runtime routes converge on the existing surface', () => {
  const html = read('src/renderer/index.html');
  const editor = read('src/renderer/editor.js');
  const runtimeBridge = read('src/renderer/tiptap/runtimeBridge.js');

  assert.ok(html.includes('data-export-surface-format="archive"'));
  assert.ok(html.includes('Complete portable project snapshot with checksums.'));

  const exportSurfaceSection = sectionBetween(
    editor,
    'function runExportSurfaceFormat(format)',
    'function runCommandPaletteAction(commandId)',
  );
  assert.ok(exportSurfaceSection.includes("if (normalizedFormat === 'archive') {"));
  assert.ok(exportSurfaceSection.includes('COMMAND_IDS.PROJECT_EXPORT_FULL_ARCHIVE_V1'));
  assert.ok(exportSurfaceSection.includes("'export-full-archive'"));
  assert.ok(exportSurfaceSection.includes("'Project archive'"));

  const paletteSection = sectionBetween(
    editor,
    'function runCommandPaletteAction(commandId)',
    'function openSettingsModal()',
  );
  assert.ok(paletteSection.includes("const exportFullArchiveCommandId = 'cmd.project.exportFullArchiveV1';"));
  assert.ok(paletteSection.includes('return openExportSurfaceModal(normalizedCommandId);'));

  const runtimeSection = sectionBetween(
    editor,
    'function handleCanonicalRuntimeCommandId(commandId, runtimePayload = null)',
    'if (isTiptapMode) {',
  );
  assert.ok(runtimeSection.includes('if (commandId === COMMAND_IDS.PROJECT_EXPORT_FULL_ARCHIVE_V1) {'));
  assert.ok(runtimeBridge.includes("commandId === 'cmd.project.exportFullArchiveV1'"));
  assert.ok(runtimeBridge.includes('runBridgeCallback(runtimeHandlers.openExportSurface, commandId, commandId)'));
});

test('S32 full archive export: main exports complete project archive without source mutation', async (t) => {
  const harness = await createHarness(t);
  const { projectRoot, manifest } = await writeDefaultProject(harness.documentsRoot);
  const before = await hashProjectFiles(projectRoot);
  const outPath = path.join(harness.tempRoot, 'Project.yalken.zip');

  const result = await harness.main.handleExportProjectArchive({
    confirmed: true,
    requestId: 's32-main-export',
    outPath,
  });

  assert.equal(result.ok, true);
  assert.equal(result.exported, true);
  assert.equal(result.verified, true);
  assert.equal(result.sourceProjectMutated, false);
  assert.equal(fs.existsSync(outPath), true);

  const archiveBuffer = await fsPromises.readFile(outPath);
  const verified = verifyProjectArchiveBuffer(archiveBuffer);
  assert.equal(verified.ok, true);
  assert.equal(verified.manifest.schemaVersion, ARCHIVE_SCHEMA_VERSION);
  assert.equal(verified.manifest.project.projectId, manifest.projectId);
  const archivedPaths = verified.manifest.entries.map((entry) => entry.archivePath).sort();
  for (const expectedPath of [
    'project/project.craftsman.json',
    'project/roman/Imported/01 Start.txt',
    'project/notes.json',
    'project/assets/image.bin',
    'project/backups/01 Start.txt.bak',
    'project/recovery/snapshot.txt',
  ]) {
    assert.ok(archivedPaths.includes(expectedPath), expectedPath);
  }

  const after = await hashProjectFiles(projectRoot);
  assert.deepEqual([...after.entries()].sort(), [...before.entries()].sort());
  await assertExactArchive(outPath, projectRoot, manifest);
  assert.deepEqual([...(await readLeaseFences(harness.userDataRoot)).keys()], [manifest.projectId]);
});

test('S32 named export binds manifest, raw bytes and lease to the selected project only', async t => {
  const harness = await twoProjects(t), { original, selected } = harness;
  const before = await hashProjectFiles(original.projectRoot), selectedBefore = await hashProjectFiles(selected.projectRoot);
  const fencesBefore = await readLeaseFences(harness.userDataRoot), outPath = path.join(harness.tempRoot, 'Selected.zip');
  const result = await harness.main.handleExportProjectArchive({ confirmed: true, requestId: 's32-named', outPath });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.verified, true);
  assert.equal(result.archiveManifest.projectId, selected.manifest.projectId);
  await assertExactArchive(outPath, selected.projectRoot, selected.manifest);
  assert.deepEqual([...(await hashProjectFiles(original.projectRoot))].sort(), [...before].sort());
  assert.deepEqual([...(await hashProjectFiles(selected.projectRoot))].sort(), [...selectedBefore].sort());
  const fencesAfter = await readLeaseFences(harness.userDataRoot);
  assert.deepEqual(fencesAfter.get(original.manifest.projectId), fencesBefore.get(original.manifest.projectId));
  assert.equal(fencesAfter.get(selected.manifest.projectId).generation, fencesBefore.get(selected.manifest.projectId).generation + 1);
});

for (const roundTrip of [false, true]) test('S32 initial manifest read refuses a project switch' + (roundTrip ? ' away and back' : ''), async t => {
  const harness = await twoProjects(t), { original, selected } = harness;
  const readFile = fsPromises.readFile;
  let switched = false, dialogs = 0;
  harness.setSaveDialog(async () => { dialogs++; return { canceled: false, filePath: path.join(harness.tempRoot, 'Stale.zip') }; });
  fsPromises.readFile = async (target, ...args) => {
    const bytes = await readFile(target, ...args);
    if (!switched && String(target).endsWith(PROJECT_MANIFEST_FILENAME)) {
      switched = true;
      assert.equal((await harness.main.handleProjectLifecycleOpenCommand({ projectId: original.manifest.projectId })).ok, true);
      if (roundTrip) assert.equal((await harness.main.handleProjectLifecycleOpenCommand({ projectId: selected.manifest.projectId })).ok, true);
    }
    return bytes;
  };
  let result;
  try { result = await harness.main.handleExportProjectArchive({ confirmed: true, requestId: 's32-initial-stale', outPath: path.join(harness.tempRoot, 'Stale.zip') }); }
  finally { fsPromises.readFile = readFile; }
  assert.equal(switched, true);
  assert.equal(result.ok, false);
  assert.match(result.error.details.message, /project_archive_context_stale/u);
  assert.equal(dialogs, 0);
  assert.equal(fs.existsSync(path.join(harness.tempRoot, 'Stale.zip')), false);
});

test('S32 actual Main save-dialog continuation refuses a window close and project switch', async t => {
  const harness = await twoProjects(t), outPath = path.join(harness.tempRoot, 'Dialog-stale.zip');
  const window = harness.createInertWindow();
  let dialogs = 0;
  harness.setSaveDialog(async () => {
    dialogs++;
    window.close();
    assert.equal((await harness.main.handleProjectLifecycleOpenCommand({ projectId: harness.original.manifest.projectId })).ok, true);
    return { canceled: false, filePath: outPath };
  });
  const result = await harness.main.handleExportProjectArchive({ confirmed: true, requestId: 's32-dialog-stale' });
  assert.equal(dialogs, 1);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'E_PROJECT_ARCHIVE_CONTEXT_STALE', JSON.stringify(result));
  assert.equal(fs.existsSync(outPath), false);
});

test('S32 full archive export: main rejects renderer-owned archive fields and project-root targets', async (t) => {
  const harness = await createHarness(t);
  const { projectRoot } = await writeDefaultProject(harness.documentsRoot);

  const authority = await harness.main.handleExportProjectArchive({
    confirmed: true,
    projectRoot,
  });
  assert.equal(authority.ok, false);
  assert.equal(authority.error.reason, 'project_archive_export_renderer_authority_denied');
  assert.deepEqual(authority.error.details.fields, ['projectRoot']);

  const forbiddenTarget = await harness.main.handleExportProjectArchive({
    confirmed: true,
    requestId: 's32-target-denied',
    outPath: path.join(projectRoot, 'inside.yalken.zip'),
  });
  assert.equal(forbiddenTarget.ok, false);
  assert.equal(forbiddenTarget.error.code, 'E_PROJECT_ARCHIVE_EXPORT_TARGET_FORBIDDEN');
  assert.equal(forbiddenTarget.error.reason, 'export_target_inside_project_root');
});

test('S32 actual Main V2 export carries every physical empty directory without fabricated files', async t => {
  const harness = await createHarness(t), { projectRoot, manifest } = await writeDefaultProject(harness.documentsRoot);
  for (const relative of ['references/空/Пусто', 'roman/Пустая часть']) await fsPromises.mkdir(path.join(projectRoot, relative), { recursive: true });
  const before = await hashProjectFiles(projectRoot), directories = [];
  async function visit(relative = '') {
    for (const name of await fsPromises.readdir(path.join(projectRoot, relative))) {
      const child = relative ? relative + '/' + name : name;
      if ((await fsPromises.lstat(path.join(projectRoot, child))).isDirectory()) { directories.push(child); await visit(child); }
    }
  }
  await visit(); assert.equal(directories.length, 9);
  const outPath = path.join(harness.tempRoot, 'topology.zip');
  const result = await harness.main.handleExportProjectArchive({ confirmed: true, requestId: 's32-topology', outPath });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.archiveManifest.schemaVersion, 'yalken-project-archive.v2');
  assert.equal(result.archiveManifest.fileCount, 6); assert.equal(result.archiveManifest.directoryCount, 9);
  assert.equal(result.archiveManifest.entryCount, 15);
  const payload = readProjectArchivePayload(await fsPromises.readFile(outPath));
  assert.deepEqual(payload.directories.map(row => row.relativePath).sort(), directories.sort());
  assert.deepEqual([...(await hashProjectFiles(projectRoot))].sort(), [...before].sort());
  await assertExactArchive(outPath, projectRoot, manifest);
});
