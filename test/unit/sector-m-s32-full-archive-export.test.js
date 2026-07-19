const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');

const {
  ARCHIVE_SCHEMA_VERSION,
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
  const tempRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'project-archive-s32-'));
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

async function writeDefaultProject(root) {
  const projectRoot = path.join(root, 'Роман');
  await fsPromises.mkdir(path.join(projectRoot, 'roman', 'Imported'), { recursive: true });
  await fsPromises.mkdir(path.join(projectRoot, 'assets'), { recursive: true });
  await fsPromises.mkdir(path.join(projectRoot, 'backups'), { recursive: true });
  await fsPromises.mkdir(path.join(projectRoot, 'recovery'), { recursive: true });
  const manifest = {
    schemaVersion: 1,
    projectId: 'project-s32',
    projectName: 'Роман',
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
  await fsPromises.writeFile(path.join(projectRoot, 'roman', 'Imported', '01 Start.txt'), 'scene text', 'utf8');
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
