import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import Module from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROJECT_MANIFEST_FILENAME = 'project.craftsman.json';
const {
  MAX_CONTEXT_REVISION,
  MAX_RELATIVE_PATH_LENGTH,
  SESSION_CONTINUITY_SCHEMA_VERSION,
  commitSessionContinuityV1,
  readSessionContinuityV1,
  validateSessionContinuityV1,
} = require('../../src/core/session-continuity-v1.cjs');

function makeInput(overrides = {}) {
  return {
    projectId: 'project-alpha',
    documentRelativePath: 'roman/Imported/02 Continue.txt',
    selectionRange: { start: 2, end: 5 },
    ...overrides,
  };
}

function makeRecord(overrides = {}) {
  return commitSessionContinuityV1(undefined, makeInput(overrides));
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
  const tempRoot = await fsPromises.realpath(
    await fsPromises.mkdtemp(path.join(os.tmpdir(), 'r24-wp302-')),
  );
  t.after(async () => fsPromises.rm(tempRoot, { recursive: true, force: true }));
  const documentsParent = path.join(tempRoot, 'Documents');
  const documentsRoot = path.join(documentsParent, 'craftsman');
  const userDataRoot = path.join(tempRoot, 'userData');
  await fsPromises.mkdir(documentsRoot, { recursive: true });
  await fsPromises.mkdir(userDataRoot, { recursive: true });
  const { main, fileManager } = await loadMainWithElectronStub({ tempRoot, documentsParent, userDataRoot });
  const originalGetDocumentsPath = fileManager.getDocumentsPath;
  fileManager.getDocumentsPath = () => documentsRoot;
  t.after(() => { fileManager.getDocumentsPath = originalGetDocumentsPath; });
  return {
    fileManager,
    main,
    documentsRoot,
    settingsPath: path.join(userDataRoot, 'settings.json'),
  };
}

async function writeProject(root) {
  const romanRoot = path.join(root, 'roman', 'Imported');
  await fsPromises.mkdir(romanRoot, { recursive: true });
  const manifest = {
    schemaVersion: 1,
    projectId: 'project-alpha',
    projectName: 'Alpha',
    createdAtUtc: '2026-01-01T00:00:00.000Z',
  };
  await fsPromises.writeFile(
    path.join(root, PROJECT_MANIFEST_FILENAME),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  await fsPromises.writeFile(path.join(romanRoot, '01 Start.txt'), 'first scene', 'utf8');
  await fsPromises.writeFile(path.join(romanRoot, '02 Продолжение 👩🏽‍💻.txt'), 'second scene', 'utf8');
  return {
    manifest,
    firstRelativePath: 'roman/Imported/01 Start.txt',
    secondRelativePath: 'roman/Imported/02 Продолжение 👩🏽‍💻.txt',
  };
}

function findNode(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  for (const child of node.children || []) {
    const found = findNode(child, predicate);
    if (found) return found;
  }
  return null;
}

test('WP302 model commits one immutable Unicode-safe V1 context', () => {
  const record = makeRecord({
    projectId: 'project-роман',
    documentRelativePath: 'roman\\Черновик\\Сцена e\u0301 👩🏽‍💻.txt',
    selectionRange: { start: 7, end: 11 },
  });

  assert.equal(record.schemaVersion, SESSION_CONTINUITY_SCHEMA_VERSION);
  assert.equal(record.revision, 1);
  assert.equal(record.documentRelativePath, 'roman/Черновик/Сцена e\u0301 👩🏽‍💻.txt');
  assert.deepEqual(record.selectionRange, { start: 7, end: 11 });
  assert.equal(Object.isFrozen(record), true);
  assert.equal(Object.isFrozen(record.selectionRange), true);
  assert.equal(validateSessionContinuityV1(record).ok, true);
  assert.equal(JSON.stringify(record).includes('/Volumes/'), false);
});

test('WP302 contract negatives reject schema drift, path authority, and malformed selection', () => {
  const valid = makeRecord();
  const mutants = [
    { ...valid, extraAuthority: true },
    { ...valid, schemaVersion: 'yalken.sessionContinuity.v2' },
    { ...valid, revision: 0 },
    { ...valid, projectId: '../project' },
    { ...valid, documentRelativePath: '/Users/private/Draft.txt' },
    { ...valid, documentRelativePath: '../Draft.txt' },
    { ...valid, documentRelativePath: 'C:\\private\\Draft.txt' },
    { ...valid, documentRelativePath: `roman/${'x'.repeat(256)}.txt` },
    { ...valid, documentRelativePath: `roman/${'x'.repeat(MAX_RELATIVE_PATH_LENGTH)}` },
    { ...valid, selectionRange: { start: 8, end: 4 } },
    { ...valid, selectionRange: { start: 1, end: 2, anchor: 1 } },
  ];

  for (const mutant of mutants) {
    assert.equal(validateSessionContinuityV1(mutant).ok, false, JSON.stringify(mutant));
  }
});

test('WP302 commit is idempotent and advances one monotonic revision on change', () => {
  const first = makeRecord();
  const replay = commitSessionContinuityV1(first, makeInput());
  assert.deepEqual(replay, first);
  assert.equal(replay.revision, 1);

  const changed = commitSessionContinuityV1(first, makeInput({
    selectionRange: { start: 5, end: 5 },
  }));
  assert.equal(changed.revision, 2);
  assert.deepEqual(changed.selectionRange, { start: 5, end: 5 });

  const exhausted = { ...first, revision: MAX_CONTEXT_REVISION };
  assert.throws(
    () => commitSessionContinuityV1(exhausted, makeInput({ selectionRange: { start: 6, end: 6 } })),
    (error) => error?.code === 'E_SESSION_CONTINUITY_REVISION_EXHAUSTED',
  );
});

test('WP302 legacy migration is bounded and a malformed present V1 blocks forged legacy fallback', () => {
  const legacy = readSessionContinuityV1({
    lastProjectId: 'project-alpha',
    lastProjectRelativePath: 'roman\\Imported\\02 Continue.txt',
    lastProjectSelectionRange: { start: 3, end: 9 },
  });
  assert.equal(legacy.ok, true);
  assert.equal(legacy.source, 'legacy');
  assert.equal(legacy.record.documentRelativePath, 'roman/Imported/02 Continue.txt');
  assert.deepEqual(legacy.record.selectionRange, { start: 3, end: 9 });

  const truncatedOrForged = readSessionContinuityV1({
    sessionContinuityV1: {
      schemaVersion: SESSION_CONTINUITY_SCHEMA_VERSION,
      projectId: 'project-alpha',
    },
    lastProjectId: 'project-forged',
    lastProjectRelativePath: 'roman/Imported/forged.txt',
    lastProjectSelectionRange: { start: 0, end: 0 },
  });
  assert.equal(truncatedOrForged.ok, false);
  assert.equal(truncatedOrForged.present, true);
  assert.equal(truncatedOrForged.source, 'v1');
  assert.equal(truncatedOrForged.record, null);
});

test('WP302 integration restores V1 scene and cursor while rewriting conflicting legacy mirrors', async (t) => {
  const harness = await createHarness(t);
  const projectRoot = path.join(harness.documentsRoot, 'Alpha');
  const { manifest, firstRelativePath, secondRelativePath } = await writeProject(projectRoot);
  const continuity = makeRecord({
    projectId: manifest.projectId,
    documentRelativePath: secondRelativePath,
    selectionRange: { start: 2, end: 7 },
  });
  await fsPromises.writeFile(harness.settingsPath, JSON.stringify({
    sessionContinuityV1: continuity,
    lastProjectId: manifest.projectId,
    lastProjectRelativePath: firstRelativePath,
    lastProjectSelectionRange: { start: 0, end: 0 },
  }), 'utf8');

  const opened = await harness.main.handleProjectLifecycleOpenCommand({ projectId: manifest.projectId });
  assert.equal(opened.ok, true, JSON.stringify(opened));
  assert.equal(opened.continuationSource, 'last-active');
  const persisted = JSON.parse(await fsPromises.readFile(harness.settingsPath, 'utf8'));
  assert.equal(persisted.sessionContinuityV1.documentRelativePath, secondRelativePath);
  assert.deepEqual(persisted.sessionContinuityV1.selectionRange, { start: 2, end: 7 });
  assert.equal(persisted.lastProjectRelativePath, secondRelativePath);
  assert.deepEqual(persisted.lastProjectSelectionRange, { start: 2, end: 7 });
  assert.equal(
    await harness.main.resolveLastOpenedFilePath(persisted),
    path.join(projectRoot, ...secondRelativePath.split('/')),
  );
});

test('WP302 return clamps a stale cursor to the recovered document length', async (t) => {
  const harness = await createHarness(t);
  const projectRoot = path.join(harness.documentsRoot, 'Alpha');
  const { manifest, secondRelativePath } = await writeProject(projectRoot);
  await fsPromises.writeFile(harness.settingsPath, JSON.stringify({
    sessionContinuityV1: makeRecord({
      projectId: manifest.projectId,
      documentRelativePath: secondRelativePath,
      selectionRange: { start: 200, end: 400 },
    }),
  }), 'utf8');

  const opened = await harness.main.handleProjectLifecycleOpenCommand({ projectId: manifest.projectId });
  assert.equal(opened.ok, true, JSON.stringify(opened));
  const persisted = JSON.parse(await fsPromises.readFile(harness.settingsPath, 'utf8'));
  assert.deepEqual(persisted.sessionContinuityV1.selectionRange, { start: 12, end: 12 });
});

test('WP302 missing saved scene cannot transfer its cursor to the fallback scene', async (t) => {
  const harness = await createHarness(t);
  const projectRoot = path.join(harness.documentsRoot, 'Alpha');
  const { manifest, firstRelativePath } = await writeProject(projectRoot);
  await fsPromises.writeFile(harness.settingsPath, JSON.stringify({
    sessionContinuityV1: makeRecord({
      projectId: manifest.projectId,
      documentRelativePath: 'roman/Imported/99 Missing.txt',
      selectionRange: { start: 2, end: 7 },
    }),
  }), 'utf8');

  const opened = await harness.main.handleProjectLifecycleOpenCommand({ projectId: manifest.projectId });
  assert.equal(opened.ok, true, JSON.stringify(opened));
  assert.equal(opened.continuationSource, 'first-scene');
  const persisted = JSON.parse(await fsPromises.readFile(harness.settingsPath, 'utf8'));
  assert.equal(persisted.sessionContinuityV1.documentRelativePath, firstRelativePath);
  assert.deepEqual(persisted.sessionContinuityV1.selectionRange, { start: 0, end: 0 });
});

test('WP302 project open fails closed when continuity persistence fails', async (t) => {
  const harness = await createHarness(t);
  const projectRoot = path.join(harness.documentsRoot, 'Alpha');
  const { manifest, secondRelativePath } = await writeProject(projectRoot);
  await fsPromises.writeFile(harness.settingsPath, JSON.stringify({
    sessionContinuityV1: makeRecord({
      projectId: manifest.projectId,
      documentRelativePath: secondRelativePath,
      selectionRange: { start: 2, end: 7 },
    }),
  }), 'utf8');

  const originalWriteFileAtomic = harness.fileManager.writeFileAtomic;
  harness.fileManager.writeFileAtomic = async (filePath, ...args) => (
    path.resolve(filePath) === path.resolve(harness.settingsPath)
      ? { success: false, error: 'injected continuity write failure' }
      : originalWriteFileAtomic(filePath, ...args)
  );
  t.after(() => { harness.fileManager.writeFileAtomic = originalWriteFileAtomic; });

  const opened = await harness.main.handleProjectLifecycleOpenCommand({ projectId: manifest.projectId });
  assert.equal(opened.ok, false, JSON.stringify(opened));
  assert.equal(opened.code, 'E_SESSION_CONTINUITY_PERSIST_FAILED');
  const persisted = JSON.parse(await fsPromises.readFile(harness.settingsPath, 'utf8'));
  assert.deepEqual(persisted.sessionContinuityV1.selectionRange, { start: 2, end: 7 });
});

test('WP302 valid context for another project cannot select the current project scene', async (t) => {
  const harness = await createHarness(t);
  const projectRoot = path.join(harness.documentsRoot, 'Alpha');
  const { manifest, firstRelativePath, secondRelativePath } = await writeProject(projectRoot);
  await fsPromises.writeFile(harness.settingsPath, JSON.stringify({
    sessionContinuityV1: makeRecord({
      projectId: 'project-other',
      documentRelativePath: secondRelativePath,
      selectionRange: { start: 2, end: 7 },
    }),
    lastProjectId: manifest.projectId,
    lastProjectRelativePath: secondRelativePath,
    lastProjectSelectionRange: { start: 2, end: 7 },
  }), 'utf8');

  const opened = await harness.main.handleProjectLifecycleOpenCommand({ projectId: manifest.projectId });
  assert.equal(opened.ok, true, JSON.stringify(opened));
  assert.equal(opened.continuationSource, 'first-scene');
  const persisted = JSON.parse(await fsPromises.readFile(harness.settingsPath, 'utf8'));
  assert.equal(persisted.sessionContinuityV1.projectId, manifest.projectId);
  assert.equal(persisted.sessionContinuityV1.documentRelativePath, firstRelativePath);
  assert.deepEqual(persisted.sessionContinuityV1.selectionRange, { start: 0, end: 0 });
});

test('WP302 crash recovery refuses malformed V1 and explicit open safely starts at first scene', async (t) => {
  const harness = await createHarness(t);
  const projectRoot = path.join(harness.documentsRoot, 'Alpha');
  const { manifest, firstRelativePath, secondRelativePath } = await writeProject(projectRoot);
  const malformed = {
    schemaVersion: SESSION_CONTINUITY_SCHEMA_VERSION,
    revision: 4,
    projectId: manifest.projectId,
    documentRelativePath: '../outside.txt',
    selectionRange: { start: 4, end: 8 },
  };
  const settings = {
    sessionContinuityV1: malformed,
    lastProjectId: manifest.projectId,
    lastProjectRelativePath: secondRelativePath,
    lastProjectSelectionRange: { start: 4, end: 8 },
  };
  await fsPromises.writeFile(harness.settingsPath, JSON.stringify(settings), 'utf8');
  assert.equal(await harness.main.resolveLastOpenedFilePath(settings), null);

  const opened = await harness.main.handleProjectLifecycleOpenCommand({ projectId: manifest.projectId });
  assert.equal(opened.ok, true, JSON.stringify(opened));
  assert.equal(opened.continuationSource, 'first-scene');
  const persisted = JSON.parse(await fsPromises.readFile(harness.settingsPath, 'utf8'));
  assert.equal(persisted.sessionContinuityV1.documentRelativePath, firstRelativePath);
  assert.deepEqual(persisted.sessionContinuityV1.selectionRange, { start: 0, end: 0 });
  assert.equal(validateSessionContinuityV1(persisted.sessionContinuityV1).ok, true);
});

test('WP302 rename rebind preserves the active document cursor', async (t) => {
  const harness = await createHarness(t);
  const projectRoot = path.join(harness.documentsRoot, 'Роман');
  const { manifest, secondRelativePath } = await writeProject(projectRoot);
  await fsPromises.writeFile(harness.settingsPath, JSON.stringify({
    sessionContinuityV1: makeRecord({
      projectId: manifest.projectId,
      documentRelativePath: secondRelativePath,
      selectionRange: { start: 2, end: 7 },
    }),
  }), 'utf8');

  const opened = await harness.main.handleProjectLifecycleOpenCommand({ projectId: manifest.projectId });
  assert.equal(opened.ok, true, JSON.stringify(opened));
  await harness.main.buildProjectTreeRootsWithIdentities('Роман');
  const tree = await harness.main.handleWorkspaceProjectTreeQuery({ tab: 'roman' });
  assert.equal(tree.ok, true, JSON.stringify(tree));
  const activeScene = findNode(
    tree.root,
    (node) => node.kind === 'scene' && typeof node.label === 'string' && node.label.includes('Продолжение'),
  );
  assert.ok(activeScene);

  const renamed = await harness.main.handleUiRenameNodeCommand({
    projectId: manifest.projectId,
    nodeId: activeScene.nodeId,
    name: 'Renamed Continuity',
  });
  assert.equal(renamed.ok, true, JSON.stringify(renamed));
  const persisted = JSON.parse(await fsPromises.readFile(harness.settingsPath, 'utf8'));
  assert.match(persisted.sessionContinuityV1.documentRelativePath, /Renamed Continuity\.txt$/u);
  assert.deepEqual(persisted.sessionContinuityV1.selectionRange, { start: 2, end: 7 });
});

test('WP302 active document path rebind preserves selection without adding UI or background work', () => {
  const mainSource = fs.readFileSync(path.join(ROOT, 'src', 'main.js'), 'utf8');
  const contractSource = fs.readFileSync(path.join(ROOT, 'src', 'core', 'session-continuity-v1.cjs'), 'utf8');
  assert.match(mainSource, /const continuity = readSessionContinuityV1\(settings\);[\s\S]*openLastFile/u);
  assert.match(mainSource, /await saveLastFile\(\{ selectionRange, beforeWrite: \(\) => \{\s*if \(!isCurrent\(\)\) throw Error\('E_EDITOR_STARTUP_WINDOW_STALE'\);\s*\} \}\);/u);
  assert.match(mainSource, /metaEnabled: context\.metaEnabled,[\s\S]*selectionRange,/u);
  assert.match(mainSource, /preserveSelectionOnPathRebind: true/u);
  assert.equal(contractSource.includes('src/renderer'), false);
  assert.equal(contractSource.includes('setInterval'), false);
  assert.equal(contractSource.includes('setTimeout'), false);
});

test('startup recovers the selected journal before tree reconciliation and Stage10, and stops on recovery error', async () => {
  const vm = await import('node:vm');
  const source = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');
  const start = source.indexOf('async function initializeApp()');
  const end = source.indexOf('// ROUND-01', start);
  const body = source.slice(start, end) + '}';
  for (const failure of ['none', 'integrity', 'journal']) {
    const calls = [];
    const context = { currentProjectName: 'Alpha', DEFAULT_PROJECT_NAME: 'Default', fileManager: {
      migrateDocumentsFolder: async () => calls.push('migrate'), ensureDocumentsFolder: async () => calls.push('documents') },
      recoverMissingIntegrityAnchorAtStartup: async () => {
        calls.push('integrity');
        if (failure === 'integrity') throw Object.assign(Error('integrity recovery refused'), { code: 'E_STAGE10_RECOVERY_CANCELLED' });
      },
      ensureAutosaveDirectory: async () => calls.push('autosave-directory'), ensureProjectStructure: async () => calls.push('ensure'),
      recoverSelectedProjectAtStartup: async () => { calls.push('recover'); if (failure === 'journal') throw Error('journal recovery'); },
      buildProjectTreeRootsWithIdentities: async () => calls.push('tree'),
      bootstrapStage10ApplicationAtStartup: async () => calls.push('stage10'),
      reconcileReviewFormattingReturnAtStartup: async () => {}, reconcileReviewStructuralReturnAtStartup: async () => {},
      reconcileReviewExactTextApplyJournalsAtStartup: async () => {}, reconcileRoundRecordV3StoreAtStartup: async () => {} };
    vm.runInNewContext(body, context);
    const prefix = ['integrity', 'migrate', 'documents', 'autosave-directory', 'recover'];
    if (failure === 'integrity') {
      await assert.rejects(context.initializeApp(), error => error.code === 'E_STAGE10_RECOVERY_CANCELLED');
      assert.deepEqual(calls, ['integrity'], 'refusal precedes every project migration, directory, journal and bootstrap writer');
    } else if (failure === 'journal') {
      await assert.rejects(context.initializeApp(), /journal recovery/); assert.deepEqual(calls, prefix);
    } else {
      await context.initializeApp(); assert.deepEqual(calls, [...prefix, 'ensure', 'tree', 'stage10']);
    }
  }
});

test('scene recovery adapter revalidates lifecycle and lease before actual filesystem publication', async () => {
  const vm = await import('node:vm');
  const source = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');
  const start = source.indexOf('async function recoverWriterProjectTransactionForFile(');
  const end = source.indexOf('async function recoverPendingWriterProjectTransaction()', start);
  for (const fault of ['none', 'context', 'lease']) {
    let context = 'A', mutations = 0, leaseChecks = 0;
    const globals = { getProjectRootPath: () => '/project', isPathInside: () => true,
      getProjectManifestPath: () => '/project/project.craftsman.json', currentProjectName: 'project', DEFAULT_PROJECT_NAME: 'project',
      captureDocxImportPreviewContext: () => context, normalizeStableProjectId: value => value,
      fs: { readFile: async () => '{"projectId":"project-a"}', rename: async () => { mutations++; } },
      getMainProjectManifestAuthority: async () => ({ withProjectLease: async (_id, fn) => fn({ publish: async fn => fn({
        assertOwned: async () => { leaseChecks++; if (fault === 'lease') throw Error('lease expired'); },
      }) }) }),
      recoverProjectTransaction: async ({ fsAdapter }) => {
        await fsAdapter.readFile('/project/scene.txt');
        if (fault === 'context') context = 'B';
        await fsAdapter.rename('/project/temp', '/project/scene.txt');
        return { recovered: true };
      },
    };
    vm.runInNewContext(source.slice(start, end), globals);
    if (fault === 'none') { assert.equal((await globals.recoverWriterProjectTransactionForFile('/project/scene.txt')).recovered, true); assert.equal(mutations, 1); assert.equal(leaseChecks, 1); }
    else { await assert.rejects(globals.recoverWriterProjectTransactionForFile('/project/scene.txt')); assert.equal(mutations, 0); }
  }
});

async function rawStartupHarness(t, { selected = true, schema = 1, external = false, malformed = false, missing = false } = {}) {
  const vm = await import('node:vm');
  const documents = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'raw-startup-recovery-'));
  t.after(() => fsPromises.rm(documents, { recursive: true, force: true }));
  const project = path.join(documents, selected ? 'Selected' : 'Default');
  await fsPromises.mkdir(project);
  const manifestPath = path.join(project, PROJECT_MANIFEST_FILENAME);
  const raw = malformed ? '{broken' : JSON.stringify({ projectId: 'project-alpha', schemaVersion: schema, preserved: 'before' });
  if (!missing) await fsPromises.writeFile(manifestPath, raw);
  const protectedDefault = path.join(documents, 'Default', PROJECT_MANIFEST_FILENAME);
  if (selected) { await fsPromises.mkdir(path.dirname(protectedDefault)); await fsPromises.writeFile(protectedDefault, '{"projectId":"default-untouched","schemaVersion":1}'); }
  const settings = external ? { lastExternalFilePath: '/owned/external.txt' }
    : selected ? { sessionContinuityV1: makeRecord() } : {};
  const calls = [];
  const context = { fs: fsPromises, path, PROJECT_MANIFEST_FILENAME, PROJECT_MANIFEST_SCHEMA_VERSION: 1,
    DEFAULT_PROJECT_NAME: 'Default', currentProjectName: '', loadSettings: async () => settings,
    readSessionContinuityV1, normalizeStableProjectId: value => typeof value === 'string' ? value.trim() : '',
    isPlainObjectValue: value => !!value && typeof value === 'object' && !Array.isArray(value),
    fileManager: { getDocumentsPath: () => documents },
    getProjectRootPath: () => path.join(documents, context.currentProjectName || context.DEFAULT_PROJECT_NAME),
    isPathInside: (root, target) => require('../../src/core/io/path-boundary').isPathInsideBoundary(root, target, { resolveSymlinks: false }),
    getProjectManifestPath: name => path.join(documents, name, PROJECT_MANIFEST_FILENAME),
    setActiveProjectNameFromRoot: root => { context.currentProjectName = path.basename(root); calls.push(['select', context.currentProjectName]); },
    recoverPendingWriterProjectTransaction: async () => {
      calls.push(['recover', context.currentProjectName]);
      assert.equal(await fsPromises.readFile(manifestPath, 'utf8'), raw, 'recovery receives exact before-image before normalization');
      await fsPromises.writeFile(manifestPath, JSON.stringify({ projectId: 'project-alpha', schemaVersion: 1, preserved: 'recovered' }));
    },
  };
  const source = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');
  const start = source.indexOf('async function recoverSelectedProjectAtStartup()');
  const end = source.indexOf('async function bootstrapStage10ApplicationAtStartup()', start);
  vm.runInNewContext(source.slice(start, end), context);
  return { context, calls, manifestPath, protectedDefault, raw, source, vm };
}

test('startup binds nondefault selected project from raw manifest and leaves default untouched', async t => {
  const h = await rawStartupHarness(t);
  const defaultBefore = await fsPromises.readFile(h.protectedDefault, 'utf8');
  await h.context.recoverSelectedProjectAtStartup();
  assert.deepEqual(h.calls, [['select', 'Selected'], ['recover', 'Selected']]);
  assert.equal(await fsPromises.readFile(h.protectedDefault, 'utf8'), defaultBefore);
  assert.equal(JSON.parse(await fsPromises.readFile(h.manifestPath, 'utf8')).preserved, 'recovered');
});

for (const specimen of [
  { name: 'default existing', selected: false, recover: true },
  { name: 'default absent', selected: false, missing: true },
  { name: 'external last file', external: true },
  { name: 'future selected', schema: 99, rejects: true },
  { name: 'malformed default', selected: false, malformed: true, rejects: true },
]) test(`raw startup ${specimen.name} preserves safe admission`, async t => {
  const h = await rawStartupHarness(t, specimen);
  if (specimen.rejects) await assert.rejects(h.context.recoverSelectedProjectAtStartup());
  else await h.context.recoverSelectedProjectAtStartup();
  assert.equal(h.calls.filter(call => call[0] === 'recover').length, specimen.recover ? 1 : 0);
  if (!specimen.missing && !specimen.recover) assert.equal(await fsPromises.readFile(h.manifestPath, 'utf8'), h.raw);
});

test('actual window startup continuation preserves autosave precedence after project recovery', async () => {
  const vm = await import('node:vm');
  const source = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');
  const windowStart = source.indexOf('function createWindow()');
  const ownerStart = source.indexOf('  const startupWindow = mainWindow, startupSession = commentAuthoringSessionId;', windowStart);
  const ownerEnd = source.indexOf('\n  editorStartupReadyPromise = ', ownerStart);
  assert.ok(ownerStart > windowStart && ownerEnd > ownerStart);
  const ownerPrelude = source.slice(ownerStart, ownerEnd);
  const continuationStart = source.indexOf('}).then(async () => {', windowStart) + '}).then(async () => {'.length;
  const continuationEnd = source.indexOf('}).catch((error)', continuationStart);
  const continuation = 'async function loadedWindow() {' + source.slice(continuationStart, continuationEnd) + '}';
  const initializeStart = source.indexOf('async function initializeApp()');
  const initializeEnd = source.indexOf('// ROUND-01', initializeStart);
  for (const { autosave, refuses } of [{ autosave: true }, { autosave: false }, { autosave: true, refuses: true }]) {
    const calls = [];
    const c = { currentProjectName: 'Selected', DEFAULT_PROJECT_NAME: 'Default',
      fileManager: { migrateDocumentsFolder: async () => calls.push('migrate'), ensureDocumentsFolder: async () => calls.push('documents') },
      recoverMissingIntegrityAnchorAtStartup: async () => {
        calls.push('integrity'); if (refuses) throw Object.assign(Error('integrity recovery refused'), { code: 'E_STAGE10_RECOVERY_CANCELLED' });
      },
      ensureAutosaveDirectory: async () => calls.push('autosave-directory'), recoverSelectedProjectAtStartup: async () => calls.push('recovery'),
      ensureProjectStructure: async () => calls.push('structure'), buildProjectTreeRootsWithIdentities: async () => calls.push('tree'),
      bootstrapStage10ApplicationAtStartup: async () => calls.push('stage10'),
      reconcileReviewFormattingReturnAtStartup: async () => {}, reconcileReviewStructuralReturnAtStartup: async () => {}, reconcileReviewExactTextApplyJournalsAtStartup: async () => {},
      commentAuthoringSessionId: 'owned-startup-session',
      mainWindow: { destroyed: false, isDestroyed() { return this.destroyed; }, webContents: { setZoomFactor: () => {} } }, logPerfStage: () => {}, loadSavedFontSize: async () => {},
      restoreAutosaveIfExists: async () => { calls.push('autosave'); return autosave; }, openLastFile: async () => { calls.push('last-file'); return 'loaded'; }, updateStatus: () => {},
    };
    vm.runInNewContext(source.slice(initializeStart, initializeEnd) + '}\n' + ownerPrelude + '\n' + continuation, c);
    const startup = async () => { await c.initializeApp(); await c.loadedWindow(); };
    if (refuses) {
      await assert.rejects(startup(), error => error.code === 'E_STAGE10_RECOVERY_CANCELLED');
      assert.deepEqual(calls, ['integrity'], 'refusal cannot reach window continuation, autosave or last-file restore');
    } else {
      await startup();
      assert.deepEqual(calls, ['integrity', 'migrate', 'documents', 'autosave-directory', 'recovery', 'structure', 'tree', 'stage10', 'autosave', ...(autosave ? [] : ['last-file'])]);
    }
  }
});

async function contentSelectionFixture(t, options = {}) {
  const harness = await createHarness(t);
  const projectRoot = path.join(harness.documentsRoot, 'Content Selection');
  // Match the unchanged path boundary's NFC binding form, not filesystem spelling.
  const relative = (options.relative || 'roman/01_Часть/01_Глава/01_Сцена.txt').normalize('NFC');
  const content = options.content ?? 'Каноническая сцена Café e\u0301 🧭\nстрока два\n';
  const metadataRelative = path.posix.join(path.posix.dirname(relative), `._${path.posix.basename(relative)}`);
  const projectId = 'project-content-selection';
  const documentId = 'tree-node-33333333333333333333333333333333';
  const nodes = {
    'tree-node-11111111111111111111111111111111': {
      bindingKey: 'file:roman/01_Часть', kind: 'part', present: true,
    },
    'tree-node-22222222222222222222222222222222': {
      bindingKey: 'file:roman/01_Часть/01_Глава', kind: 'chapter-folder', present: true,
    },
    [documentId]: { bindingKey: `file:${relative}`, kind: 'scene', present: true },
    ...(options.nodes || {}),
  };
  const manifest = {
    schemaVersion: 1, projectId, projectName: 'Content Selection',
    createdAtUtc: '2026-10-22T00:00:00.000Z',
    futureUnknown: { protected: ['not a navigation cache'] },
    treeIdentity: { schemaVersion: 1, nodes },
  };
  await fsPromises.mkdir(projectRoot, { recursive: true });
  await fsPromises.writeFile(path.join(projectRoot, PROJECT_MANIFEST_FILENAME), `${JSON.stringify(manifest)}\n`);
  const payloads = new Map([
    [metadataRelative, Buffer.from([0, 5, 22, 7, 0, 2, 0, 0, 77, 97, 99, 32, 79, 83, 32, 88, 255])],
    ['._project.craftsman.json', Buffer.from([0, 5, 22, 7, 0, 255])],
    ...(options.omitScene ? [] : [[relative, Buffer.from(content)]]),
    ...(options.extraFiles || []).map(([name, value]) => [name, Buffer.from(value)]),
  ]);
  for (const [name, bytes] of payloads) {
    const target = path.join(projectRoot, ...name.split('/'));
    await fsPromises.mkdir(path.dirname(target), { recursive: true });
    await fsPromises.writeFile(target, bytes);
  }
  const reads = [];
  const originalRead = harness.fileManager.readFile;
  harness.fileManager.readFile = async (...args) => {
    const result = await originalRead(...args);
    reads.push({ filePath: args[0], result });
    return result;
  };
  t.after(() => { harness.fileManager.readFile = originalRead; });
  const assertPreserved = async () => {
    for (const [name, bytes] of payloads) {
      assert.deepEqual(await fsPromises.readFile(path.join(projectRoot, ...name.split('/'))), bytes, name);
    }
    const persisted = JSON.parse(await fsPromises.readFile(path.join(projectRoot, PROJECT_MANIFEST_FILENAME), 'utf8'));
    assert.deepEqual(persisted.futureUnknown, manifest.futureUnknown);
  };
  return { ...harness, projectRoot, projectId, relative, metadataRelative, content, documentId, reads, assertPreserved };
}

async function assertCanonicalContentOpen(fixture, { source = 'first-scene', selection = { start: 0, end: 0 } } = {}) {
  const opened = await fixture.main.handleProjectLifecycleOpenCommand({ projectId: fixture.projectId });
  assert.equal(opened.ok, true, JSON.stringify(opened));
  assert.equal(opened.continuationSource, source);
  assert.equal(opened.documentId, fixture.documentId);
  assert.equal(fixture.reads.length, 1, 'one actual document read through the existing fileManager');
  assert.equal(fixture.reads[0].filePath, path.join(fixture.projectRoot, ...fixture.relative.split('/')));
  assert.equal(fixture.reads[0].result.success, true);
  assert.equal(fixture.reads[0].result.content, fixture.content);
  const settings = JSON.parse(await fsPromises.readFile(fixture.settingsPath, 'utf8'));
  assert.equal(settings.sessionContinuityV1.projectId, fixture.projectId);
  assert.equal(settings.sessionContinuityV1.documentRelativePath, fixture.relative);
  assert.deepEqual(settings.sessionContinuityV1.selectionRange, selection);
  const tree = await fixture.main.handleWorkspaceProjectTreeQuery({ tab: 'roman' });
  assert.equal(tree.ok, true, JSON.stringify(tree));
  assert.ok(findNode(tree.root, node => node.nodeId === fixture.documentId));
  assert.equal(findNode(tree.root, node => typeof node.label === 'string' && node.label.startsWith('._')), null,
    'metadata never becomes a navigation node; internal dots remain ordinary text');
  await fixture.assertPreserved();
  return settings;
}

test('WP302 canonical open selects nested authored text instead of its AppleDouble sibling', async t => {
  await assertCanonicalContentOpen(await contentSelectionFixture(t));
});

test('WP302 canonical open preserves legacy Imported text and its existing identity', async t => {
  await assertCanonicalContentOpen(await contentSelectionFixture(t, { relative: 'roman/Imported/01 Start.txt' }));
});

test('WP302 zero-byte scene stays eligible while a nonempty AppleDouble sibling stays raw', async t => {
  await assertCanonicalContentOpen(await contentSelectionFixture(t, { content: '' }));
});

test('WP302 first scene traversal excludes hidden ancestors without deleting their documents', async t => {
  await assertCanonicalContentOpen(await contentSelectionFixture(t, {
    extraFiles: [['roman/.transport/00 Hidden.txt', 'hidden payload retained']],
  }));
});

for (const mode of ['v1', 'legacy']) test(`WP302 ${mode} metadata continuation falls back without transferring its cursor`, async t => {
  const h = await contentSelectionFixture(t);
  const metadataPath = path.join(h.projectRoot, ...h.metadataRelative.split('/'));
  const settings = mode === 'v1'
    ? { sessionContinuityV1: makeRecord({ projectId: h.projectId, documentRelativePath: h.metadataRelative, selectionRange: { start: 2, end: 5 } }) }
    : { lastProjectId: h.projectId, lastProjectRelativePath: h.metadataRelative, lastProjectSelectionRange: { start: 2, end: 5 } };
  settings.lastFilePath = metadataPath;
  settings.lastExternalFilePath = metadataPath;
  assert.equal(await h.main.resolveLastOpenedFilePath(settings), null, 'startup refuses both metadata and forged lower-priority mirrors');
  assert.equal(h.reads.length, 0);
  await fsPromises.writeFile(h.settingsPath, JSON.stringify(settings));
  await assertCanonicalContentOpen(h);
});

test('WP302 hidden ancestor continuity cannot reopen a hidden payload at startup or project open', async t => {
  const hidden = 'roman/.transport/00 Hidden.txt';
  const h = await contentSelectionFixture(t, { extraFiles: [[hidden, 'hidden retained']] });
  const settings = { sessionContinuityV1: makeRecord({ projectId: h.projectId, documentRelativePath: hidden }) };
  assert.equal(await h.main.resolveLastOpenedFilePath(settings), null);
  await fsPromises.writeFile(h.settingsPath, JSON.stringify(settings));
  await assertCanonicalContentOpen(h);
});

for (const mirror of ['lastFilePath', 'lastExternalFilePath']) test(`WP302 missing visible target cannot fall through to bound metadata ${mirror}`, async t => {
  const h = await contentSelectionFixture(t);
  const settings = {
    sessionContinuityV1: makeRecord({ projectId: h.projectId, documentRelativePath: 'roman/Imported/99 Missing.txt' }),
    [mirror]: path.join(h.projectRoot, ...h.metadataRelative.split('/')),
  };
  assert.equal(await h.main.resolveLastOpenedFilePath(settings), null, 'eligible missing record exercises the absolute fallback branch');
  assert.equal(h.reads.length, 0);
  await h.assertPreserved();
});

test('WP302 visible valid last-active retains its text identity and cursor', async t => {
  const h = await contentSelectionFixture(t);
  const selection = { start: 2, end: 5 };
  const settings = { sessionContinuityV1: makeRecord({ projectId: h.projectId, documentRelativePath: h.relative, selectionRange: selection }) };
  assert.equal(await h.main.resolveLastOpenedFilePath(settings), path.join(h.projectRoot, ...h.relative.split('/')));
  await fsPromises.writeFile(h.settingsPath, JSON.stringify(settings));
  await assertCanonicalContentOpen(h, { source: 'last-active', selection });
});

for (const [section, category, kind] of [
  ['materials', 'Заметки', 'materials-category'],
  ['reference', 'Персонажи', 'reference-category'],
]) for (const carrier of ['.index.txt', '.INDEX.TXT']) test(`WP302 ${section} category ${carrier} remains a supported last-active document`, async t => {
  const relative = `${section}/${category}/${carrier}`;
  const documentId = 'tree-node-44444444444444444444444444444444';
  const h = await contentSelectionFixture(t, {
    extraFiles: [[relative, 'Category text preserved']],
    nodes: { [documentId]: { bindingKey: `file:${section}/${category}`, kind, present: true } },
  });
  const selection = { start: 2, end: 5 };
  const settings = { sessionContinuityV1: makeRecord({ projectId: h.projectId, documentRelativePath: relative, selectionRange: selection }) };
  const target = path.join(h.projectRoot, ...relative.split('/'));
  assert.equal(await h.main.resolveLastOpenedFilePath(settings), target);
  await fsPromises.writeFile(h.settingsPath, JSON.stringify(settings));
  const opened = await h.main.handleProjectLifecycleOpenCommand({ projectId: h.projectId });
  assert.equal(opened.ok, true, JSON.stringify(opened));
  assert.equal(opened.continuationSource, 'last-active');
  assert.equal(opened.documentId, documentId, 'carrier retains category identity rather than a hidden-file identity');
  assert.deepEqual(h.reads, [{ filePath: target, result: { success: true, content: 'Category text preserved' } }]);
  const persisted = JSON.parse(await fsPromises.readFile(h.settingsPath, 'utf8'));
  assert.equal(persisted.sessionContinuityV1.documentRelativePath, relative);
  assert.deepEqual(persisted.sessionContinuityV1.selectionRange, selection);
  await h.assertPreserved();
});

for (const relative of ['roman/Imported/.index.txt', 'materials/Заметки/.draft.txt', 'materials/Arbitrary/.index.txt']) {
  test(`WP302 hidden non-carrier ${relative} stays raw and cannot become continuity`, async t => {
    const h = await contentSelectionFixture(t, { extraFiles: [[relative, 'not an admitted category carrier']] });
    const settings = { sessionContinuityV1: makeRecord({ projectId: h.projectId, documentRelativePath: relative }) };
    assert.equal(await h.main.resolveLastOpenedFilePath(settings), null);
    await fsPromises.writeFile(h.settingsPath, JSON.stringify(settings));
    await assertCanonicalContentOpen(h);
  });
}

for (const filename of ['01_internal._dots.txt', '01_under_score.TXT', '01_Сцена e\u0301 🧭.txt']) {
  test(`WP302 visible filename ${filename} retains fallback eligibility`, async t => {
    await assertCanonicalContentOpen(await contentSelectionFixture(t, { relative: `roman/Imported/${filename}` }));
  });
}

test('WP302 metadata-only project returns the existing typed empty result without reading metadata', async t => {
  const h = await contentSelectionFixture(t, { omitScene: true });
  const opened = await h.main.handleProjectLifecycleOpenCommand({ projectId: h.projectId });
  assert.equal(opened.ok, false);
  assert.equal(opened.code, 'E_PROJECT_EMPTY');
  assert.equal(h.reads.length, 0);
  await h.assertPreserved();
});

test('WP302 bound missing target retains legitimate visible and external startup fallbacks', async t => {
  const h = await contentSelectionFixture(t);
  const settings = { sessionContinuityV1: makeRecord({ projectId: h.projectId, documentRelativePath: 'roman/Imported/99 Missing.txt' }) };
  const canonical = path.join(h.projectRoot, ...h.relative.split('/'));
  assert.equal(await h.main.resolveLastOpenedFilePath({ ...settings, lastFilePath: canonical }), canonical);
  const external = path.join(h.documentsRoot, 'external.txt');
  await fsPromises.writeFile(external, 'external startup compatibility');
  assert.equal(await h.main.resolveLastOpenedFilePath({ ...settings, lastExternalFilePath: external, lastFilePath: canonical }), external);
  assert.equal(await h.main.resolveLastOpenedFilePath({ lastExternalFilePath: external }), external);
  assert.equal(h.reads.length, 0, 'resolver preserves its read-only path-result role');
  await h.assertPreserved();
});

// Initial authoring admission: actual full Main boot continuation, finite window only.
function startupDeferred() { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; }
async function startupWithin(promise) { let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('finite Main startup timeout')), 10000); })]); } finally { clearTimeout(timer); } }
async function initialMainBoot(t, mode = 'saved') {
  const root = await fsPromises.realpath(await fsPromises.mkdtemp(path.join(os.tmpdir(), 'yalken-initial-main-')));
  const owner = cryptoForStartup.randomUUID(), marker = path.join(root, '.owner'); fs.writeFileSync(marker, owner, { flag: 'wx' }); const identity = fs.statSync(root);
  const documents = path.join(root, 'Documents'), userData = path.join(root, 'userData'), base = path.join(documents, 'craftsman'), projectRoot = path.join(base, 'Роман');
  fs.mkdirSync(userData, { recursive: true }); fs.mkdirSync(path.join(projectRoot, 'roman', 'Imported'), { recursive: true }); fs.mkdirSync(path.join(base, '.autosave'), { recursive: true });
  const scene = path.join(projectRoot, 'roman', 'Imported', '01 start.txt'), text = 'Saved scene e\u0301 🧭'; fs.writeFileSync(scene, text);
  fs.writeFileSync(path.join(projectRoot, PROJECT_MANIFEST_FILENAME), JSON.stringify({ schemaVersion: 1, projectId: 'project-startup', projectName: 'Роман', createdAtUtc: '2026-10-25T00:00:00.000Z' }));
  fs.writeFileSync(path.join(userData, 'settings.json'), JSON.stringify(mode === 'saved' || mode === 'read-error' ? { lastFilePath: scene } : {}));
  if (mode === 'autosave') fs.writeFileSync(path.join(base, '.autosave', 'autosave.txt'), 'Recovered draft e\u0301 🧭');
  const h = { root, projectRoot, scene, text, windows: [], actualReads: [] }, readGate = startupDeferred(), readEntered = startupDeferred();
  class Window {
    constructor() { this.id = h.windows.length + 1; h.windows.push(this); this.sent = []; this.handlers = new Map(); this.destroyed = false; this.load = startupDeferred();
      this.webContents = { id: 810 + this.id, session: {}, on() {}, setWindowOpenHandler() {}, setZoomFactor() {}, isDestroyed: () => this.destroyed,
        getURL: () => this.url || '', send: (channel, payload) => this.sent.push([channel, structuredClone(payload)]) }; }
    on(name, callback) { this.handlers.set(name, callback); } isDestroyed() { return this.destroyed; } isFullScreen() { return false; }
    loadFile(file, { query }) { const url = new URL('file://' + file); Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value)); this.url = url.href;
      const promise = this.load.promise, then = promise.then.bind(promise); promise.then = (...args) => { const actual = then(...args); this.actualContinuation = actual; return actual; }; return promise; }
  }
  Window.getAllWindows = () => h.windows.filter(w => !w.destroyed); Window.getFocusedWindow = () => h.windows.at(-1);
  const electron = { app: { isPackaged: false, getPath: name => name === 'documents' ? documents : name === 'userData' ? userData : root,
    setPath() {}, whenReady: () => new Promise(() => {}), on() {}, quit() {}, exit() {}, setName() {}, requestSingleInstanceLock: () => true }, BrowserWindow: Window,
    screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1000, height: 700 } }) }, Menu: { buildFromTemplate: () => ({}), setApplicationMenu() {} },
    dialog: { showMessageBox: async () => ({ response: 0 }), showOpenDialog: async () => ({ canceled: true }), showSaveDialog: async () => ({ canceled: true }) },
    ipcMain: { on() {}, handle() {} }, session: { defaultSession: { webRequest: { onHeadersReceived() {} } } } };
  const mainPath = path.join(ROOT, 'src/main.js'), managerPath = path.join(ROOT, 'src/utils/fileManager.js'), previousLoad = Module._load;
  delete require.cache[mainPath]; delete require.cache[managerPath]; let manager, previousDocuments, previousRead;
  t.after(async () => {
    readGate.release(); h.windows.forEach(w => w.load.release()); await Promise.allSettled(h.windows.map(w => w.actualContinuation).filter(Boolean));
    if (manager) { manager.getDocumentsPath = previousDocuments; manager.readFile = previousRead; }
    delete require.cache[mainPath]; delete require.cache[managerPath];
    const now = fs.statSync(root); assert.equal(now.dev, identity.dev); assert.equal(now.ino, identity.ino); assert.equal(fs.readFileSync(marker, 'utf8'), owner); await fsPromises.rm(root, { recursive: true });
  });
  try { Module._load = function(request, ...args) { return request === 'electron' ? electron : previousLoad.call(this, request, ...args); };
    h.main = require(mainPath); manager = require(managerPath); previousDocuments = manager.getDocumentsPath; previousRead = manager.readFile; manager.getDocumentsPath = () => base;
    manager.readFile = async (...args) => { if (args[0] === scene) { readEntered.release(); await readGate.promise; } const actual = await previousRead(...args); if (args[0] === scene) h.actualReads.push(actual); return actual; };
  } finally { Module._load = previousLoad; }
  h.create = () => { const previous = Module._load; try { Module._load = function(request, ...args) { return request === 'electron' ? electron : previous.call(this, request, ...args); }; h.main.createWindow(); return h.windows.at(-1); } finally { Module._load = previous; } };
  h.finish = async window => { window.load.release(); await startupWithin(window.actualContinuation); await new Promise(setImmediate); };
  h.releaseRead = () => readGate.release(); h.readEntered = readEntered.promise;
  h.publications = window => window.sent.filter(([channel]) => channel === 'editor:set-text').map(([, payload]) => payload);
  return h;
}
const cryptoForStartup = require('node:crypto');

for (const mode of ['saved', 'autosave', 'empty']) test('initial Main actual createWindow publishes a usable typed authoring terminal ' + mode + ' [FINITE_WINDOW_NOT_BROWSER]', async t => {
  const h = await initialMainBoot(t, mode), window = h.create();
  assert.deepEqual(h.publications(window), []); const pending = h.finish(window);
  if (mode === 'saved') { await startupWithin(h.readEntered); assert.deepEqual(h.publications(window), []); assert.equal(fs.readFileSync(h.scene, 'utf8'), h.text); h.releaseRead(); }
  await pending; const publications = h.publications(window);
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_FULL_MAIN_CREATEWINDOW_BOOT_TERMINAL', mode, publications, dirtyPackets: window.sent.filter(([channel]) => channel === 'set-dirty'), actualReads: h.actualReads }));
  assert.equal(publications.length, 1, 'successful initial boot must deliberately publish the saved/autosave/empty authoring document');
  const payload = publications[0]; assert.equal(typeof payload.content, 'string'); assert.equal(typeof payload.documentId, 'string'); assert.equal(typeof payload.projectId, 'string');
  if (mode === 'saved') { assert.equal(payload.content, h.text); assert.ok(payload.documentId); assert.equal(payload.kind, 'scene'); assert.equal(h.actualReads.length, 1); assert.equal(h.actualReads[0].success, true); }
  if (mode === 'autosave') { assert.equal(payload.content, 'Recovered draft e\u0301 🧭'); assert.equal(payload.documentId, 'autosave-document'); assert.equal(payload.kind, 'autosave'); assert.equal(window.sent.some(([channel, p]) => channel === 'set-dirty' && p.state === true), true); }
  if (mode === 'empty') { assert.equal(payload.content, ''); assert.equal(payload.documentId, ''); assert.equal(payload.kind, 'empty'); }
  assert.equal(fs.readFileSync(h.scene, 'utf8'), h.text);
});

test('initial Main actual file read error cannot manufacture a ready empty document [FINITE_WINDOW_NOT_BROWSER]', async t => {
  const h = await initialMainBoot(t, 'read-error'), window = h.create(), pending = h.finish(window); await startupWithin(h.readEntered);
  fs.renameSync(h.scene, h.scene + '.retained'); fs.mkdirSync(h.scene); h.releaseRead(); await pending;
  assert.equal(h.actualReads.length, 1); assert.equal(h.actualReads[0].success, false); assert.deepEqual(h.publications(window), []);
  assert.equal(fs.readFileSync(h.scene + '.retained', 'utf8'), h.text); assert.equal(window.sent.some(([channel, p]) => channel === 'status-update' && /Ошибка/u.test(p)), true);
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_MAIN_FAILED_SOURCE_READ_NO_READY_PUBLICATION', actualRead: h.actualReads[0], sent: window.sent }));
});

test('initial Main retired load continuation cannot publish or clear authoring in a replacement window [FINITE_WINDOW_NOT_BROWSER]', async t => {
  const h = await initialMainBoot(t), retired = h.create(), current = h.create(); retired.destroyed = true;
  const pending = h.finish(retired); await new Promise(setImmediate); h.releaseRead(); await pending;
  const publications = h.publications(current); t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_RETIRED_WINDOW_BOOT_CONTINUATION', retiredId: retired.id, currentId: current.id, publications, currentPackets: current.sent }));
  assert.deepEqual(publications, [], 'a destroyed or replaced boot owner cannot release another window authoring');
  assert.equal(current.sent.some(([channel, p]) => channel === 'set-dirty' && p.state === false), false);
  const currentPending = h.finish(current); await currentPending; assert.equal(h.publications(current).length, 1); assert.equal(fs.readFileSync(h.scene, 'utf8'), h.text);
});

// Standalone applicability: whole exported Main initialization, then its real
// finite window continuation. No project reconciler is replaced by this adapter.
function externalStartupRoster(root) {
  const rows = {};
  const visit = directory => {
    for (const name of fs.readdirSync(directory).sort()) {
      const target = path.join(directory, name), stat = fs.lstatSync(target);
      const relative = path.relative(root, target);
      assert.equal(stat.isSymbolicLink(), false, relative);
      rows[relative] = stat.isDirectory() ? { kind: 'directory' }
        : { kind: 'file', bytes: stat.size, sha256: cryptoForStartup.createHash('sha256').update(fs.readFileSync(target)).digest('hex') };
      if (stat.isDirectory()) visit(target);
    }
  };
  visit(root);
  return rows;
}

async function externalFullStartupFixture(t, { keepDefault = false } = {}) {
  const h = await initialMainBoot(t, 'empty');
  h.documentsRoot = path.join(h.root, 'Documents', 'craftsman');
  h.settingsPath = path.join(h.root, 'userData', 'settings.json');
  h.external = path.join(h.documentsRoot, 'standalone e\u0301 🧭.txt');
  h.externalText = 'Продолжение отдельного файла e\u0301 🧭\n';
  fs.writeFileSync(h.external, h.externalText);
  if (!keepDefault) await fsPromises.rm(h.projectRoot, { recursive: true });
  h.settings = { lastExternalFilePath: h.external, preservedUnrelatedSetting: { value: 'retain me' } };
  fs.writeFileSync(h.settingsPath, JSON.stringify(h.settings));
  return h;
}

async function observeWholeExternalInitializer(t, h) {
  const before = externalStartupRoster(h.root);
  let failure = null;
  try { await h.main.initializeApp(); }
  catch (error) { failure = error; }
  const after = externalStartupRoster(h.root);
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_EXPORTED_WHOLE_INITIALIZE_APP',
    externalPath: h.external, before, after, windows: h.windows.length,
    failure: failure && { name: failure.name, code: failure.code || null, message: failure.message, stack: failure.stack } }));
  assert.ifError(failure);
  return { before, after };
}

for (const keepDefault of [false, true]) test('external startup actual whole initializer opens standalone without fallback setup: default ' + (keepDefault ? 'retained' : 'absent'), async t => {
  const h = await externalFullStartupFixture(t, { keepDefault });
  const settingsBefore = fs.readFileSync(h.settingsPath);
  const defaultBefore = keepDefault ? externalStartupRoster(h.projectRoot) : null;
  await observeWholeExternalInitializer(t, h);
  assert.deepEqual(fs.readFileSync(h.settingsPath), settingsBefore, 'initialization does not normalize standalone continuity');
  if (keepDefault) assert.deepEqual(externalStartupRoster(h.projectRoot), defaultBefore, 'an unrelated existing project stays byte-exact');
  else assert.equal(fs.existsSync(h.projectRoot), false, 'standalone startup cannot manufacture a default project');
  const window = h.create(); await h.finish(window);
  const publications = h.publications(window);
  assert.equal(publications.length, 1);
  const payload = publications[0];
  assert.equal(payload.content, h.externalText); assert.equal(payload.kind, 'external'); assert.equal(payload.projectId, '');
  assert.equal(payload.documentId, 'external-document-' + cryptoForStartup.createHash('sha256').update(path.resolve(h.external)).digest('hex').slice(0, 32));
  assert.equal(fs.readFileSync(h.external, 'utf8'), h.externalText);
  const settings = JSON.parse(fs.readFileSync(h.settingsPath, 'utf8'));
  assert.equal(settings.lastExternalFilePath, h.external);
  assert.deepEqual(settings.preservedUnrelatedSetting, h.settings.preservedUnrelatedSetting);
  assert.equal(Object.hasOwn(settings, 'sessionContinuityV1'), false);
  assert.equal(Object.hasOwn(settings, 'lastProjectId'), false);
  const beforeTree = externalStartupRoster(h.documentsRoot);
  const tree = await h.main.handleWorkspaceProjectTreeQuery({ tab: 'roman' });
  assert.deepEqual(externalStartupRoster(h.documentsRoot), beforeTree, 'navigator query cannot repair/create the fallback project');
  if (!keepDefault) { assert.equal(tree.ok, false); assert.equal(tree.error, 'E_PROJECT_MANIFEST_UNAVAILABLE'); }
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_INITIALIZE_THEN_CREATEWINDOW_EXTERNAL_PUBLICATION', payload,
    treeObservationOnly: { ok: tree.ok, projectId: tree.projectId || '', error: tree.error || '' },
    settings, rawExternalBytes: Buffer.byteLength(h.externalText) }));
});

for (const keepDefault of [false, true]) test('external applicability retains actual default no-file initialization: ' + (keepDefault ? 'existing' : 'creation'), async t => {
  const h = await externalFullStartupFixture(t, { keepDefault });
  fs.writeFileSync(h.settingsPath, '{}');
  const sceneBefore = keepDefault ? fs.readFileSync(h.scene) : null;
  await h.main.initializeApp();
  const manifest = JSON.parse(fs.readFileSync(path.join(h.projectRoot, PROJECT_MANIFEST_FILENAME), 'utf8'));
  assert.equal(typeof manifest.projectId, 'string'); assert.ok(manifest.projectId);
  assert.ok(manifest.treeIdentity && typeof manifest.treeIdentity.nodes === 'object');
  assert.equal(fs.statSync(path.join(h.projectRoot, '.stage10-local')).isDirectory(), true);
  if (keepDefault) assert.deepEqual(fs.readFileSync(h.scene), sceneBefore);
  const window = h.create(); await h.finish(window);
  const publications = h.publications(window); assert.equal(publications.length, 1);
  assert.equal(publications[0].kind, 'empty'); assert.equal(publications[0].content, '');
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_DEFAULT_WHOLE_INITIALIZER_AND_NOFILE_TERMINAL', keepDefault,
    projectId: manifest.projectId, publication: publications[0] }));
});

test('external applicability preserves real selected project precedence over standalone path', async t => {
  const h = await externalFullStartupFixture(t, { keepDefault: true });
  const settings = { ...h.settings, sessionContinuityV1: makeRecord({ projectId: 'project-startup',
    documentRelativePath: 'roman/Imported/01 start.txt', selectionRange: { start: 2, end: 4 } }) };
  fs.writeFileSync(h.settingsPath, JSON.stringify(settings));
  await h.main.initializeApp();
  const window = h.create(); h.releaseRead(); await h.finish(window);
  const publications = h.publications(window); assert.equal(publications.length, 1);
  assert.equal(publications[0].content, h.text); assert.equal(publications[0].projectId, 'project-startup');
  assert.equal(publications[0].kind, 'scene'); assert.match(publications[0].documentId, /^tree-node-[a-f0-9]{32}$/u);
  assert.equal(h.actualReads.length, 1); assert.equal(h.actualReads[0].success, true);
  const saved = JSON.parse(fs.readFileSync(h.settingsPath, 'utf8'));
  assert.equal(saved.sessionContinuityV1.projectId, 'project-startup'); assert.equal(Object.hasOwn(saved, 'lastExternalFilePath'), false);
  assert.deepEqual(saved.preservedUnrelatedSetting, h.settings.preservedUnrelatedSetting);
  assert.equal(fs.readFileSync(h.external, 'utf8'), h.externalText);
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_SELECTED_INITIALIZER_PRECEDES_EXTERNAL_FALLBACK', publication: publications[0] }));
});

for (const specimen of ['malformed-present-v1', 'missing-selected', 'ambiguous-selected', 'future-selected', 'malformed-selected', 'malformed-default']) {
  test('external applicability actual whole initializer refuses ' + specimen + ' before publication', async t => {
    const h = await externalFullStartupFixture(t, { keepDefault: true });
    const manifestPath = path.join(h.projectRoot, PROJECT_MANIFEST_FILENAME);
    let settings = { ...h.settings, sessionContinuityV1: makeRecord({ projectId: 'project-startup' }) };
    let expected = 'E_STARTUP_PROJECT_BINDING';
    if (specimen === 'malformed-present-v1') {
      settings.sessionContinuityV1 = { ...settings.sessionContinuityV1, revision: 0 };
      Object.assign(settings, { lastProjectId: 'project-startup', lastProjectRelativePath: 'roman/Imported/01 start.txt' });
      expected = 'E_SESSION_CONTINUITY_INVALID';
    }
    if (specimen === 'missing-selected') settings.sessionContinuityV1 = makeRecord({ projectId: 'project-missing' });
    if (specimen === 'ambiguous-selected') {
      const twin = path.join(h.documentsRoot, 'Twin'); fs.mkdirSync(twin);
      fs.copyFileSync(manifestPath, path.join(twin, PROJECT_MANIFEST_FILENAME));
    }
    if (specimen === 'future-selected') {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); manifest.schemaVersion = 99;
      fs.writeFileSync(manifestPath, JSON.stringify(manifest)); expected = 'PROJECT_READONLY_SCHEMA';
    }
    if (specimen.startsWith('malformed-') && specimen !== 'malformed-present-v1') {
      fs.writeFileSync(manifestPath, '{broken');
      if (specimen === 'malformed-default') { settings = {}; expected = 'SyntaxError'; }
    }
    fs.writeFileSync(h.settingsPath, JSON.stringify(settings));
    const before = externalStartupRoster(h.root); let failure = null;
    try { await h.main.initializeApp(); } catch (error) { failure = error; }
    t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_WHOLE_INITIALIZER_REFUSAL', specimen,
      failure: failure && { name: failure.name, code: failure.code || null, message: failure.message } }));
    assert.ok(failure, 'untrusted selection cannot become standalone success');
    assert.equal(expected === 'SyntaxError' ? failure.name : failure.code || failure.message, expected);
    assert.deepEqual(externalStartupRoster(h.root), before, 'refusal retains all raw files/settings/unknown members');
    assert.equal(h.windows.length, 0);
  });
}

test('external startup actual failed read never publishes a successful empty authoring document', async t => {
  const h = await externalFullStartupFixture(t);
  await observeWholeExternalInitializer(t, h);
  fs.renameSync(h.external, h.external + '.retained'); fs.mkdirSync(h.external);
  const window = h.create(); await h.finish(window);
  assert.deepEqual(h.publications(window), []);
  assert.equal(fs.readFileSync(h.external + '.retained', 'utf8'), h.externalText);
  assert.equal(window.sent.some(([channel, value]) => channel === 'status-update' && /Ошибка/u.test(value)), true);
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_EXTERNAL_FAILED_READ_NO_READY_PUBLICATION', sent: window.sent }));
});

test('external applicability actual whole initializer honors nondefault selected project and preserves unrelated default', async t => {
  const h = await externalFullStartupFixture(t, { keepDefault: true });
  const selectedRoot = path.join(h.documentsRoot, 'Selected');
  const { manifest, secondRelativePath } = await writeProject(selectedRoot);
  const selectedFile = path.join(selectedRoot, ...secondRelativePath.split('/'));
  const selectedBefore = fs.readFileSync(selectedFile), defaultBefore = externalStartupRoster(h.projectRoot);
  fs.writeFileSync(h.settingsPath, JSON.stringify({ ...h.settings, sessionContinuityV1: makeRecord({
    projectId: manifest.projectId, documentRelativePath: secondRelativePath, selectionRange: { start: 1, end: 4 } }) }));
  await h.main.initializeApp();
  assert.deepEqual(externalStartupRoster(h.projectRoot), defaultBefore, 'selected startup cannot normalize the unrelated default project');
  const window = h.create(); await h.finish(window);
  const publications = h.publications(window); assert.equal(publications.length, 1);
  assert.equal(publications[0].content, selectedBefore.toString('utf8'));
  assert.equal(publications[0].projectId, manifest.projectId); assert.equal(publications[0].kind, 'scene');
  assert.match(publications[0].documentId, /^tree-node-[a-f0-9]{32}$/u);
  assert.deepEqual(publications[0].selectionRange, { start: 1, end: 4 });
  assert.deepEqual(fs.readFileSync(selectedFile), selectedBefore);
  assert.deepEqual(externalStartupRoster(h.projectRoot), defaultBefore);
  const settings = JSON.parse(fs.readFileSync(h.settingsPath, 'utf8'));
  assert.equal(settings.sessionContinuityV1.projectId, manifest.projectId);
  assert.equal(settings.sessionContinuityV1.documentRelativePath, secondRelativePath);
  assert.equal(Object.hasOwn(settings, 'lastExternalFilePath'), false);
  assert.deepEqual(settings.preservedUnrelatedSetting, h.settings.preservedUnrelatedSetting);
  assert.equal(fs.readFileSync(h.external, 'utf8'), h.externalText);
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_NONDEFAULT_SELECTED_WHOLE_INITIALIZER_AND_PUBLICATION', publication: publications[0],
    selectedFileBytes: selectedBefore.length, originalDefaultSceneReadObservationsOnly: h.actualReads.length }));
});

// Owner-approved startup ambiguity. Full, unmodified Main; these finite native
// and IPC transports are not Electron/native acceptance. Keep owned roots for
// the external complete-I/O evidence consumer rather than deleting failed data.
const SOURCE_CHOICE_LABELS = ['Открыть сохранённую сцену', 'Восстановить автокопию отдельно', 'Отмена'];
const sourceChoiceDigest = bytes => cryptoForStartup.createHash('sha256').update(bytes).digest('hex');
async function sourceChoiceMain(t, { saved = true, autosave = true, response = { response: 2 }, rawAutosave } = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'yalken-source-choice-')));
  const marker = cryptoForStartup.randomUUID(), markerPath = path.join(root, '.owner');
  fs.writeFileSync(markerPath, marker, { flag: 'wx' }); const rootIdentity = fs.lstatSync(root);
  const documents = path.join(root, 'Documents'), userData = path.join(root, 'userData');
  const base = path.join(documents, 'craftsman'), projectRoot = path.join(base, 'Роман');
  const scene = path.join(projectRoot, 'roman', 'Imported', '01 choice.txt');
  const globalAutosave = path.join(base, '.autosave', 'autosave.txt'), settingsPath = path.join(userData, 'settings.json');
  fs.mkdirSync(path.dirname(scene), { recursive: true }); fs.mkdirSync(path.dirname(globalAutosave)); fs.mkdirSync(userData);
  const savedText = 'Saved choice e\u0301 🧭\nsecond line', recoveredText = 'Separate recovery e\u0301 🧭\nother words';
  fs.writeFileSync(scene, savedText);
  fs.writeFileSync(path.join(projectRoot, PROJECT_MANIFEST_FILENAME), JSON.stringify({ schemaVersion: 1,
    projectId: 'project-source-choice', projectName: 'Роман', createdAtUtc: '2026-10-26T00:00:00.000Z' }));
  const settings = saved ? { sessionContinuityV1: makeRecord({ projectId: 'project-source-choice',
    documentRelativePath: 'roman/Imported/01 choice.txt', selectionRange: { start: 2, end: 7 } }),
    preservedChoiceSetting: { language: 'ru', value: 'untouched' } } : { preservedChoiceSetting: { value: 'untouched' } };
  fs.writeFileSync(settingsPath, JSON.stringify(settings));
  if (autosave) fs.writeFileSync(globalAutosave, rawAutosave ?? Buffer.from(recoveredText));
  const h = { root, base, projectRoot, scene, globalAutosave, settingsPath, savedText, recoveredText,
    windows: [], handlers: new Map(), listeners: new Map(), choices: [], saveDialogs: [], releases: [],
    paths: { documents, userData }, response, choose: null };
  function contents(window) {
    return { id: 2200 + window.id, session: {}, isDestroyed: () => window.destroyed,
      on() {}, setWindowOpenHandler() {}, setZoomFactor() {}, getURL: () => window.url || '',
      send(channel, payload) {
        window.sent.push([channel, structuredClone(payload)]);
        if (channel === 'editor:set-text') window.editor = { ...structuredClone(payload), generation: 0 };
        if (channel === 'editor:snapshot-request') queueMicrotask(() => h.listeners.get('editor:snapshot-response')(
          h.event(window), { requestId: payload.requestId, snapshot: structuredClone(window.editor) }));
      } };
  }
  class Window {
    constructor() { this.id = h.windows.length + 1; h.windows.push(this); h.window = this;
      this.destroyed = false; this.sent = []; this.handlers = new Map(); this.editor = { content: '', generation: 0 };
      this.load = startupDeferred(); this.webContents = contents(this); }
    isDestroyed() { return this.destroyed; } on(name, callback) { this.handlers.set(name, callback); }
    isFullScreen() { return false; } getBounds() { return { width: 1000, height: 700 }; }
    loadFile(file, { query }) {
      const url = new URL('file://' + file); Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value)); this.url = url.href;
      const pending = this.load.promise, then = pending.then.bind(pending);
      pending.then = (...args) => { const actual = then(...args); this.actualContinuation = actual; return actual; }; return pending;
    }
  }
  Window.getAllWindows = () => h.windows.filter(window => !window.destroyed); Window.getFocusedWindow = () => h.window;
  const electron = { app: { isPackaged: true, getPath: name => h.paths[name] || root,
    setPath() {}, whenReady: () => new Promise(() => {}), on() {}, quit() {}, exit() {}, setName() {}, requestSingleInstanceLock: () => true },
    BrowserWindow: Window, screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1000, height: 700 } }) },
    Menu: { buildFromTemplate: () => ({}), setApplicationMenu() {} },
    dialog: { async showMessageBox(...args) { const call = { owner: args.length > 1 ? args[0] : null, options: args.at(-1) };
      h.choices.push(call); return h.choose ? h.choose(call) : structuredClone(h.response); },
      async showSaveDialog(owner, options) { h.saveDialogs.push({ owner, options }); return { canceled: true }; },
      showOpenDialog: async () => ({ canceled: true }) },
    ipcMain: { handle: (name, fn) => h.handlers.set(name, fn), on: (name, fn) => h.listeners.set(name, fn) },
    session: { defaultSession: { webRequest: { onHeadersReceived() {} } } } };
  const cachePaths = ['src/main.js', 'src/utils/fileManager.js', 'src/utils/backupManager.js'].map(name => path.join(ROOT, name));
  const cacheBefore = cachePaths.map(name => require.cache[name]), originalLoad = Module._load;
  cachePaths.forEach(name => { delete require.cache[name]; });
  try { Module._load = function(request, ...args) { return request === 'electron' ? electron : originalLoad.call(this, request, ...args); };
    h.main = require(cachePaths[0]);
  } finally { Module._load = originalLoad; }
  h.event = (window = h.window) => ({ sender: window.webContents, senderFrame: { url: window.url } });
  const envelope = require('../../src/core/ipc-envelope-v1.cjs').createEnvelope;
  h.command = (id, payload = {}) => h.handlers.get('ui:command-bridge')(h.event(), envelope('ui:command-bridge', id, payload));
  h.signal = (id, payload = {}) => h.handlers.get('ui:save-lifecycle-signal-bridge')(h.event(), envelope('ui:save-lifecycle-signal-bridge', id, payload));
  h.create = () => { const load = Module._load; try {
    Module._load = function(request, ...args) { return request === 'electron' ? electron : load.call(this, request, ...args); };
    h.main.createWindow(); return h.window;
  } finally { Module._load = load; } };
  h.finish = async (window = h.window) => { window.load.release(); await startupWithin(window.actualContinuation); await new Promise(setImmediate); };
  h.publications = (window = h.window) => window.sent.filter(([channel]) => channel === 'editor:set-text').map(([, payload]) => payload);
  h.raw = () => Object.fromEntries([scene, globalAutosave, settingsPath].map(name => [name,
    fs.existsSync(name) ? fs.readFileSync(name).toString('base64') : null]));
  h.snapshot = () => ({ raw: h.raw(), publications: h.windows.map(window => h.publications(window)),
    dirty: h.windows.map(window => window.sent.filter(([channel]) => channel === 'set-dirty')) });
  h.holdChoice = () => {
    const entered = startupDeferred(), gate = startupDeferred(); h.releases.push(gate.release);
    h.choose = async () => { entered.release(); await gate.promise; return structuredClone(h.response); };
    return { release: gate.release, async reached(window = h.window) {
      const actual = await startupWithin(Promise.race([entered.promise.then(() => true), window.actualContinuation.then(() => false)]));
      assert.equal(actual, true, 'actual Main must reach the owned native ambiguity effect before this stale-input control');
    } };
  };
  h.replaceContents = () => { h.window.webContents = contents(h.window); };
  h.app = electron.app;
  t.after(async () => {
    h.releases.forEach(release => release()); h.windows.forEach(window => window.load.release());
    await Promise.allSettled(h.windows.map(window => window.actualContinuation).filter(Boolean));
    cachePaths.forEach((name, index) => { delete require.cache[name]; if (cacheBefore[index]) require.cache[name] = cacheBefore[index]; });
    const current = fs.lstatSync(root); assert.equal(current.dev, rootIdentity.dev); assert.equal(current.ino, rootIdentity.ino);
    assert.equal(fs.readFileSync(markerPath, 'utf8'), marker);
    t.diagnostic(JSON.stringify({ retainedOwnedSourceChoiceRoot: root, ownerMarker: marker, nativeAcceptance: false }));
  });
  return h;
}
function assertSourceChoiceDialog(h, window) {
  assert.equal(h.choices.length, 1, 'both eligible sources require one actual native choice');
  assert.equal(h.choices[0].owner, window); assert.deepEqual(h.choices[0].options.buttons, SOURCE_CHOICE_LABELS);
  assert.equal(h.choices[0].options.defaultId, 2); assert.equal(h.choices[0].options.cancelId, 2);
}
for (const response of [0, 1, 2]) test('startup source choice actual full Main selects enum ' + response + ' [FINITE_NATIVE_ADAPTER]', async t => {
  const h = await sourceChoiceMain(t, { response: { response } }), before = h.raw(), window = h.create();
  await h.finish(window); assertSourceChoiceDialog(h, window);
  const publications = h.publications(window); assert.equal(publications.length, 1);
  assert.equal(publications[0].content, response === 0 ? h.savedText : response === 1 ? h.recoveredText : '');
  assert.equal(publications[0].kind, response === 0 ? 'scene' : response === 1 ? 'autosave' : 'empty');
  if (response === 0) assert.deepEqual(publications[0].selectionRange, { start: 2, end: 7 });
  if (response === 1) {
    assert.equal(window.sent.some(([channel, payload]) => channel === 'set-dirty' && payload.state === true), true);
    const saved = await h.command('cmd.project.save'); assert.equal(saved.ok, false);
    assert.equal(h.saveDialogs.length, 1, 'separate recovery must request an untitled native target instead of writing the remembered scene');
  }
  const after = h.raw(); assert.equal(after[h.scene], before[h.scene]); assert.equal(after[h.globalAutosave], before[h.globalAutosave]);
  if (response !== 0) assert.equal(after[h.settingsPath], before[h.settingsPath], 'Cancel/recovery cannot replace remembered scene continuity');
  t.diagnostic(JSON.stringify({ causalReach: 'ACTUAL_UNMODIFIED_MAIN_SOURCE_ENUM', response, kind: publications[0].kind,
    savedSha256: sourceChoiceDigest(fs.readFileSync(h.scene)), autosaveSha256: sourceChoiceDigest(fs.readFileSync(h.globalAutosave)) }));
});
for (const specimen of [
  { name: 'saved-only', saved: true, autosave: false, expected: 'scene' },
  { name: 'autosave-only', saved: false, autosave: true, expected: 'autosave' },
  { name: 'neither', saved: false, autosave: false, expected: 'empty' },
  { name: 'zero-byte-autosave', saved: true, autosave: true, rawAutosave: Buffer.alloc(0), expected: 'scene' },
]) test('startup source choice actual legitimate ' + specimen.name + ' has no ambiguity modal', async t => {
  const h = await sourceChoiceMain(t, specimen), before = h.raw(), window = h.create(); await h.finish(window);
  assert.equal(h.choices.length, 0); assert.equal(h.publications(window).length, 1); assert.equal(h.publications(window)[0].kind, specimen.expected);
  assert.equal(h.raw()[h.scene], before[h.scene]); assert.equal(h.raw()[h.globalAutosave], before[h.globalAutosave]);
});
for (const [name, response] of [['null', null], ['array', []], ['missing', {}], ['string', { response: '1' }],
  ['negative', { response: -1 }], ['outside-enum', { response: 3 }], ['fraction', { response: 1.5 }]]) {
  test('startup source choice actual malformed ' + name + ' is handled without fallback', async t => {
    const h = await sourceChoiceMain(t, { response }), before = h.raw(), window = h.create(); await h.finish(window);
    assertSourceChoiceDialog(h, window); assert.deepEqual(h.publications(window), []); assert.deepEqual(h.raw(), before);
    assert.equal(window.sent.some(([channel, value]) => channel === 'status-update' && /ошиб|не удалось|недоступ/iu.test(value)), true);
    assert.equal(window.sent.some(([channel]) => channel === 'ui:recovery-restored'), false);
  });
}
for (const failure of ['rejected', 'absent']) test('startup source choice actual ' + failure + ' native effect retains both inputs and has no successful empty fallback', async t => {
  const h = await sourceChoiceMain(t); h.choose = async () => { if (failure === 'rejected') throw Error('owned native choice unavailable'); return undefined; };
  const before = h.raw(), window = h.create(); await h.finish(window); assertSourceChoiceDialog(h, window);
  assert.deepEqual(h.publications(window), []); assert.deepEqual(h.raw(), before);
  assert.equal(window.sent.some(([channel, value]) => channel === 'status-update' && /ошиб|не удалось|недоступ/iu.test(value)), true);
});
for (const variant of ['saved-raw', 'autosave-raw', 'autosave-inode', 'saved-alias', 'autosave-alias', 'autosave-parent-alias', 'settings-pointer', 'window', 'contents',
  'session', 'generation', 'profile', 'documents-root', 'userData-root']) {
  test('startup source choice actual held decision rejects changed ' + variant, async t => {
    const h = await sourceChoiceMain(t, { response: { response: variant.startsWith('saved') ? 0 : 1 } });
    const hold = h.holdChoice(), window = h.create(), pending = h.finish(window); await hold.reached(window);
    if (variant === 'saved-raw') fs.appendFileSync(h.scene, '\nnewer saved source');
    if (variant === 'autosave-raw') fs.appendFileSync(h.globalAutosave, '\nnewer recovery source');
    if (variant === 'autosave-inode') { const raw = fs.readFileSync(h.globalAutosave); fs.renameSync(h.globalAutosave, h.globalAutosave + '.retained-source'); fs.writeFileSync(h.globalAutosave, raw); }
    if (variant === 'saved-alias' || variant === 'autosave-alias') { const original = variant === 'saved-alias' ? h.scene : h.globalAutosave;
      fs.renameSync(original, original + '.kept-physical-source'); fs.symlinkSync(original + '.kept-physical-source', original); }
    if (variant === 'autosave-parent-alias') { const directory = path.dirname(h.globalAutosave);
      fs.renameSync(directory, directory + '-kept-physical-source'); fs.symlinkSync(directory + '-kept-physical-source', directory, 'dir'); }
    if (variant === 'settings-pointer') { const other = path.join(path.dirname(h.scene), '02 other.txt'); fs.writeFileSync(other, 'Other remembered scene');
      fs.writeFileSync(h.settingsPath, JSON.stringify({ lastExternalFilePath: other })); }
    if (variant === 'window') { window.destroyed = true; h.create(); }
    if (variant === 'contents') h.replaceContents();
    if (variant === 'session') assert.equal((await h.command('cmd.project.new')).ok, true);
    if (variant === 'generation') assert.equal((await h.signal('signal.localDirty.set', { state: true, generation: 1 })).ok, true);
    if (variant === 'profile') { h.app.isPackaged = false; t.diagnostic('FINITE_APP_METADATA_PROFILE_CHANGE_NOT_REAL_ENTITLEMENT_DENIAL'); }
    if (variant === 'documents-root' || variant === 'userData-root') { const key = variant === 'documents-root' ? 'documents' : 'userData';
      h.paths[key] = path.join(h.root, key + '-replacement'); fs.mkdirSync(h.paths[key]); }
    const current = h.snapshot(); hold.release(); await pending;
    assert.deepEqual(h.snapshot(), current, 'a late response cannot bind, publish, clear dirty or rewrite either source/settings after this change');
  });
}
test('startup source choice warm recreated window recovers separately without the previously bound scene target', async t => {
  const h = await sourceChoiceMain(t, { autosave: false, response: { response: 1 } }), first = h.create(); await h.finish(first);
  assert.equal(h.publications(first)[0].content, h.savedText); const savedRaw = fs.readFileSync(h.scene);
  fs.writeFileSync(h.globalAutosave, h.recoveredText); first.destroyed = true; first.handlers.get('closed')();
  const before = h.raw(), second = h.create(); await h.finish(second); assertSourceChoiceDialog(h, second);
  assert.equal(h.publications(second).length, 1); assert.equal(h.publications(second)[0].content, h.recoveredText);
  const result = await h.command('cmd.project.save'); assert.equal(result.ok, false); assert.equal(h.saveDialogs.length, 1);
  assert.deepEqual(fs.readFileSync(h.scene), savedRaw); assert.deepEqual(h.raw(), before);
});
for (const specimen of ['unreadable', 'invalid-utf8', 'unreadable-saved']) test('startup source choice actual ' + specimen + ' source does not publish replacement text or ready fallback', async t => {
  const h = await sourceChoiceMain(t, { saved: specimen === 'unreadable-saved', rawAutosave: specimen === 'invalid-utf8' ? Buffer.from([0x61, 0xff, 0x62]) : undefined });
  const before = h.raw(), readFile = fsPromises.readFile; let reached = false;
  if (specimen !== 'invalid-utf8') fsPromises.readFile = async function(file, ...args) { if (String(file) === (specimen === 'unreadable-saved' ? h.scene : h.globalAutosave)) {
    reached = true; throw Object.assign(Error('owned input read denied'), { code: 'EACCES' }); } return readFile.call(this, file, ...args); };
  try { const window = h.create(); await h.finish(window); if (specimen !== 'invalid-utf8') assert.equal(reached, true);
    assert.deepEqual(h.publications(window), []); assert.deepEqual(h.raw(), before);
    assert.equal(window.sent.some(([channel, value]) => channel === 'status-update' && /ошиб|не удалось|недоступ/iu.test(value)), true);
  } finally { fsPromises.readFile = readFile; }
});

for (const stage of ['autosave-read', 'saved-read']) test('startup source choice checks source/context after the actual held ' + stage, async t => {
  const h = await sourceChoiceMain(t, { response: { response: 0 } }), readFile = fsPromises.readFile;
  const entered = startupDeferred(), gate = startupDeferred(); h.releases.push(gate.release); let held = false;
  const selectedPath = stage === 'autosave-read' ? h.globalAutosave : h.scene;
  fsPromises.readFile = async function(file, ...args) {
    const raw = await readFile.call(this, file, ...args);
    if (!held && String(file) === selectedPath) { held = true; entered.release(); await gate.promise; }
    return raw;
  };
  const window = h.create(), pending = h.finish(window);
  try {
    const reached = await startupWithin(Promise.race([entered.promise.then(() => true), window.actualContinuation.then(() => false)]));
    assert.equal(reached, true, 'the actual selected read, not a replacement loader, must reach the held boundary');
    fs.appendFileSync(selectedPath, '\nchanged after the completed read');
    assert.equal((await h.signal('signal.localDirty.set', { state: true, generation: 1 })).ok, true);
    const current = h.snapshot(); gate.release(); await pending;
    assert.equal(held, true); assert.deepEqual(h.snapshot(), current, 'stale read bytes cannot become a source decision or editor baseline');
  } finally { gate.release(); fsPromises.readFile = readFile; await pending; }
});

test('startup source choice actual corrupt remembered settings cannot silently turn ambiguity into automatic recovery', async t => {
  const h = await sourceChoiceMain(t); fs.writeFileSync(h.settingsPath, '{"sessionContinuityV1":');
  const before = h.raw(), window = h.create(); await h.finish(window);
  assert.deepEqual(h.publications(window), []); assert.deepEqual(h.raw(), before);
  assert.equal(window.sent.some(([channel, value]) => channel === 'status-update' && /ошиб|не удалось|недоступ/iu.test(value)), true);
});
