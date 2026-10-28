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
    let main;
    if (paths.instrument) {
      const compiled=new Module(mainPath,module);compiled.filename=mainPath;compiled.paths=Module._nodeModulePaths(path.dirname(mainPath));
      compiled._compile(fs.readFileSync(mainPath,'utf8')+'\n'+paths.instrument,mainPath);main=compiled.exports;
    } else main=require(mainPath);
    return { main, fileManager: require(fileManagerPath) };
  } finally {
    Module._load = originalLoad;
  }
}

async function createHarness(t, options = {}) {
  const tempRoot = await fsPromises.realpath(await fsPromises.mkdtemp(path.join(os.tmpdir(), 'project-lifecycle-s27-')));
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
    instrument: options.instrument,
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


test('S27 physical project rename preserves verified tree packets, scene Save and repeated relocation', async (t) => {
  const harness = await createHarness(t);
  const transaction = require('../../src/core/project-transaction-v1.cjs');
  const { createMainProjectManifestAuthority } = await import('../../src/product/mainProjectManifestAuthority.mjs');
  const created = await harness.main.handleProjectLifecycleCreateCommand({ projectName: 'Before α 東京' });
  assert.equal(created.ok, true);
  const tree = await harness.main.handleWorkspaceProjectTreeQuery({ tab: 'roman' });
  assert.equal(tree.ok, true);
  const findScene = node => node.kind === 'scene' ? node : (node.children || []).map(findScene).find(Boolean);
  const scene = findScene(tree.root);
  assert.ok(scene);
  const change = await harness.main.handleUiRenameNodeCommand({ projectId: created.projectId, nodeId: scene.nodeId, name: 'Первая Ω' });
  assert.equal(change.ok, true);
  const sourceRoot = path.join(harness.documentsRoot, 'Before α 東京');
  const sourceManifest = path.join(sourceRoot, PROJECT_MANIFEST_FILENAME);
  const before = await transaction.readVerifiedProjectTreeMutation({ manifestPath: sourceManifest, projectId: created.projectId });
  assert.equal(before.treeRevision, 1);
  assert.equal(before.lastMutation.canUndo, true);
  const packetRelative = path.join('.yalken-recovery', `wp201-${before.receipt.transactionId}.json`);
  const packetBytes = await fsPromises.readFile(path.join(sourceRoot, packetRelative));
  const identity = await harness.main.resolveProjectTreeNodeIdentity(scene.nodeId, created.projectId);
  const sceneRelative = path.relative(sourceRoot, identity.nodePath);
  const sceneBytes = await fsPromises.readFile(identity.nodePath);
  const authority = createMainProjectManifestAuthority({ anchorRoot: path.join(harness.userDataRoot, 'stage10-integrity-anchors') });
  let priorRoot = sourceRoot;
  for (const projectName of ['After β 夜', 'Again é 🧭']) {
    const renamed = await harness.main.handleProjectLifecycleRenameCommand({ projectId: created.projectId, projectName });
    assert.equal(renamed.ok, true, JSON.stringify(renamed));
    const root = await fsPromises.realpath(path.join(harness.documentsRoot, projectName));
    const manifestPath = path.join(root, PROJECT_MANIFEST_FILENAME);
    assert.equal(fs.existsSync(priorRoot), false);
    assert.deepEqual(await fsPromises.readFile(path.join(root, packetRelative)), packetBytes);
    assert.deepEqual(await fsPromises.readFile(path.join(root, sceneRelative)), sceneBytes);
    const state = await transaction.readVerifiedProjectTreeMutation({ manifestPath, projectId: created.projectId });
    assert.equal(state.treeRevision, before.treeRevision);
    assert.equal(state.receipt.transactionId, before.receipt.transactionId);
    assert.equal(state.lastMutation.canUndo, false); // Name update is not exact manifest Undo CAS.
    const proof = await transaction.readVerifiedProjectTransaction({ scenePath: path.join(root, sceneRelative), manifestPath,
      verifyManifestContinuation: request => authority.verifyManifestContinuation({ ...request, projectId: created.projectId }) });
    assert.equal(proof.sceneDigest, require('node:crypto').createHash('sha256').update(sceneBytes).digest('hex'));
    const query = await harness.main.handleWorkspaceProjectTreeQuery({ tab: 'roman' });
    assert.equal(query.ok, true, JSON.stringify(query));
    assertPathless(query, harness.tempRoot);
    assert.equal(findScene(query.root).nodeId, scene.nodeId);
    priorRoot = root;
  }
  const manifestPath = path.join(priorRoot, PROJECT_MANIFEST_FILENAME);
  const scenePath = path.join(priorRoot, sceneRelative);
  const manifestText = await fsPromises.readFile(manifestPath, 'utf8');
  const next = 'Сохранено: é 🧭 東京 — العربية.\n';
  await authority.withProjectLease(created.projectId, lease => transaction.commitProjectTransaction({
    scenePath, manifestPath, expectedSceneContent: sceneBytes.toString('utf8'), sceneContent: next,
    expectedManifestContent: manifestText, manifestContent: manifestText, revision: 2,
    revalidate: () => lease.assertOwned(),
    verifyManifestContinuation: request => authority.verifyManifestContinuation({ ...request, projectId: created.projectId }),
    publishManifest: ({ manifestPath: targetPath, expectedText, nextText }) => authority.commitManifestText({ projectId: created.projectId, lease, targetPath, expectedText, nextText }),
  }));
  assert.equal(await fsPromises.readFile(scenePath, 'utf8'), next);
  const changedAgain = await harness.main.handleUiRenameNodeCommand({ projectId: created.projectId, nodeId: scene.nodeId, name: 'Продолжение Ω' });
  assert.equal(changedAgain.ok, true, JSON.stringify(changedAgain));
  const renamedIdentity = await harness.main.resolveProjectTreeNodeIdentity(scene.nodeId, created.projectId);
  assert.equal(await fsPromises.readFile(renamedIdentity.nodePath, 'utf8'), next);
  assert.deepEqual(await fsPromises.readFile(path.join(priorRoot, packetRelative)), packetBytes);
});


for (const boundary of ['beforeSourceMove', 'afterManifestBeforeFinalMove']) test(`S27 location rollback restores exact metadata at ${boundary}`, async t => {
  const harness = await createHarness(t);
  const sourceRoot = path.join(harness.documentsRoot, 'Rollback Source');
  const manifest = await writeProject(sourceRoot, { projectName: 'Rollback Source' });
  const before = await fsPromises.readFile(path.join(sourceRoot, PROJECT_MANIFEST_FILENAME));
  const failed = await harness.main.handleProjectLifecycleRenameCommand({ projectId: manifest.projectId, projectName: 'Failed Target' }, {
    [boundary]: async () => { throw new Error(`injected ${boundary}`); },
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.code, 'E_PROJECT_DIRECTORY_MOVE_FAILED', JSON.stringify(failed));
  assert.deepEqual(await fsPromises.readFile(path.join(sourceRoot, PROJECT_MANIFEST_FILENAME)), before);
  assert.equal(fs.existsSync(path.join(sourceRoot, '.yalken-location.v1.json')), false);
  assert.equal(fs.existsSync(path.join(harness.documentsRoot, 'Failed Target')), false);
  assert.equal(fs.existsSync(harness.journalPath), false);
  assert.equal(await fsPromises.readFile(path.join(sourceRoot, 'roman', 'Imported', '01 Start.txt'), 'utf8'), 'first scene');
});

for (const boundary of ['prepared', 'temporary', 'published']) test(`S27 cold process recovers actual interrupted relocation at ${boundary}`, async t => {
  const observationRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'location-crash-observation-'));
  t.after(() => fsPromises.rm(observationRoot, { recursive: true, force: true }));
  const observationPath = path.join(observationRoot, 'observed.json');
  const source = fs.readFileSync(__filename, 'utf8');
  const harnessSource = source.slice(0, source.indexOf('\ntest(')).replace("const ROOT = path.resolve(__dirname, '..', '..');", `const ROOT = ${JSON.stringify(ROOT)};`);
  const body = `
(async () => {
  const h = await createHarness({ after() {} });
  const result = await h.main.handleProjectLifecycleCreateCommand({projectName:'Crash Source'});
  assert.equal(result.ok,true);
  const query = await h.main.handleWorkspaceProjectTreeQuery({tab:'roman'});
  const find = n => n.kind==='scene'?n:(n.children||[]).map(find).find(Boolean);
  const scene = find(query.root);
  assert.equal((await h.main.handleUiRenameNodeCommand({projectId:result.projectId,nodeId:scene.nodeId,name:'Сцена Ω'})).ok,true);
  const sourceRoot = path.join(h.documentsRoot,'Crash Source');
  const targetRoot = path.join(h.documentsRoot,'Crash Target');
  const manifestPath = path.join(sourceRoot,PROJECT_MANIFEST_FILENAME);
  const tx = require(path.join(ROOT,'src/core/project-transaction-v1.cjs'));
  const tree = await tx.readVerifiedProjectTreeMutation({manifestPath,projectId:result.projectId});
  const packetRelative = path.join('.yalken-recovery','wp201-'+tree.receipt.transactionId+'.json');
  const info = {tempRoot:h.tempRoot,documentsRoot:h.documentsRoot,userDataRoot:h.userDataRoot,documentsParent:path.dirname(h.documentsRoot),
    sourceRoot,targetRoot,projectId:result.projectId,sceneId:scene.nodeId,journalPath:h.journalPath,
    beforeManifestText:await fsPromises.readFile(manifestPath,'utf8'),packetRelative,
    packetHash:require('node:crypto').createHash('sha256').update(await fsPromises.readFile(path.join(sourceRoot,packetRelative))).digest('hex')};
  fs.writeFileSync(${JSON.stringify(observationPath)},JSON.stringify(info));
  const stop = () => process.kill(process.pid,'SIGKILL');
  const options = {};
  if (${JSON.stringify(boundary)}==='prepared') options.beforeSourceMove=stop;
  if (${JSON.stringify(boundary)}==='temporary') options.afterManifestBeforeFinalMove=stop;
  if (${JSON.stringify(boundary)}==='published') {
    const rename = fsPromises.rename;
    fsPromises.rename = async (from,to) => { const value = await rename(from,to); if(to===targetRoot)stop(); return value; };
  }
  const moved=await h.main.handleProjectLifecycleRenameCommand({projectId:result.projectId,projectName:'Crash Target'},options);
  console.error(JSON.stringify(moved));process.exitCode=2;
})().catch(error=>{console.error(error);process.exitCode=3;});`;
  const child = require('node:child_process').spawnSync(process.execPath, ['-e', harnessSource + body], {
    cwd: ROOT, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024,
  });
  assert.equal(child.signal, 'SIGKILL', child.stderr);
  const info = JSON.parse(await fsPromises.readFile(observationPath, 'utf8'));
  assert.ok(path.basename(info.tempRoot).startsWith('project-lifecycle-s27-'));
  assert.equal(path.dirname(await fsPromises.realpath(info.tempRoot)), await fsPromises.realpath(os.tmpdir()));
  t.after(() => fsPromises.rm(info.tempRoot, { recursive: true, force: true }));
  const loaded = await loadMainWithElectronStub(info);
  const originalPath = loaded.fileManager.getDocumentsPath;
  loaded.fileManager.getDocumentsPath = () => info.documentsRoot;
  t.after(() => { loaded.fileManager.getDocumentsPath = originalPath; });
  const { createProjectLeaseManager } = await import('../../src/product/projectLease.mjs');
  const leases = createProjectLeaseManager({ leaseRoot: path.join(info.userDataRoot, 'stage10-integrity-anchors') });
  const held = await leases.inspect(info.projectId);
  assert.equal(held.metadata.ownerPid, child.pid);
  assert.equal(held.ownershipBound, true);
  if (!held.expired) {
    const journalBefore = await fsPromises.readFile(info.journalPath);
    const early = await loaded.main.recoverProjectLifecycleJournal();
    assert.equal(early.ok, false);
    assert.equal(early.details.code, 'E_PROJECT_LEASE_HELD');
    assert.deepEqual(await fsPromises.readFile(info.journalPath), journalBefore);
    const waitMs = Math.ceil(held.heartbeat.monotonicExpiresAtMs - Number(process.hrtime.bigint() / 1000000n)) + 50;
    assert.ok(waitMs > 0 && waitMs <= leases.ttlMs + 100);
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }
  const expired = await leases.inspect(info.projectId);
  assert.equal(expired.expired, true);
  assert.equal(expired.processInstanceAlive, false);
  const recovered = await loaded.main.recoverProjectLifecycleJournal();
  assert.equal(recovered.ok, true, JSON.stringify(recovered));
  assert.equal(recovered.action, boundary === 'published' ? 'finalized' : 'source-restored');
  const root = boundary === 'published' ? info.targetRoot : info.sourceRoot;
  assert.equal(fs.existsSync(info.journalPath), false);
  const actualManifest = await fsPromises.readFile(path.join(root, PROJECT_MANIFEST_FILENAME), 'utf8');
  if (boundary !== 'published') assert.equal(actualManifest, info.beforeManifestText);
  else assert.equal(JSON.parse(actualManifest).projectName, 'Crash Target');
  const digest = require('node:crypto').createHash('sha256').update(await fsPromises.readFile(path.join(root, info.packetRelative))).digest('hex');
  assert.equal(digest, info.packetHash);
  const opened = await loaded.main.handleProjectLifecycleOpenCommand({projectId:info.projectId});
  assert.equal(opened.ok, true, JSON.stringify(opened));
  const query = await loaded.main.handleWorkspaceProjectTreeQuery({tab:'roman'});
  assert.equal(query.ok, true, JSON.stringify(query));
  const locate = n => n.nodeId===info.sceneId?n:(n.children||[]).map(locate).find(Boolean);
  assert.ok(locate(query.root));
});

test('S27 malformed relocation journal is preserved and blocks a new command', async t => {
  const h = await createHarness(t);
  const raw = '{"schemaVersion":"project-lifecycle-journal.v2",broken';
  await fsPromises.writeFile(h.journalPath, raw);
  const result = await h.main.recoverProjectLifecycleJournal();
  assert.equal(result.ok, false);
  assert.equal(result.code, 'E_PROJECT_LOCATION_RECOVERY_REQUIRED');
  assert.equal(await fsPromises.readFile(h.journalPath, 'utf8'), raw);
});

test('S27 a renamed simple project still duplicates with a distinct project identity', async t => {
  const h = await createHarness(t), source = path.join(h.documentsRoot,'Copy Source');
  const manifest = await writeProject(source,{projectName:'Copy Source'});
  const renamed=await h.main.handleProjectLifecycleRenameCommand({projectId:manifest.projectId,projectName:'Copy Renamed'});
  assert.equal(renamed.ok,true,JSON.stringify(renamed));
  const renamedRoot=path.join(h.documentsRoot,'Copy Renamed');
  const sourceRouting=await fsPromises.readFile(path.join(renamedRoot,'.yalken-location.v1.json'));
  const result=await h.main.handleProjectLifecycleDuplicateCommand({projectId:manifest.projectId,projectName:'Copy Destination'});
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.notEqual(result.projectId,manifest.projectId);
  const copyRoot=path.join(h.documentsRoot,'Copy Destination');
  assert.equal(await fsPromises.readFile(path.join(copyRoot,'roman','Imported','01 Start.txt'),'utf8'),'first scene');
  assert.deepEqual(await fsPromises.readFile(path.join(renamedRoot,'.yalken-location.v1.json')),sourceRouting);
  assert.equal(fs.existsSync(path.join(copyRoot,'.yalken-location.v1.json')),false);
  const hash=require('node:crypto').createHash('sha256').update(sourceRouting).digest('hex');
  assert.deepEqual(await fsPromises.readFile(path.join(copyRoot,`.yalken-location.inherited-${hash}.json`)),sourceRouting);
  const opened=await h.main.handleProjectLifecycleOpenCommand({projectId:result.projectId});
  assert.equal(opened.ok,true,JSON.stringify(opened));
});


for (const mode of ['copy','restore']) test(`S27 archive ${mode} of a physically renamed project preserves routing evidence`, async t => {
  const h=await createHarness(t), source=path.join(h.documentsRoot,'Archive Before');
  const manifest=await writeProject(source,{projectName:'Archive Before',treeIdentity:{schemaVersion:1,nodes:{}}});
  const renamed=await h.main.handleProjectLifecycleRenameCommand({projectId:manifest.projectId,projectName:'Archive After'});
  assert.equal(renamed.ok,true,JSON.stringify(renamed));
  const root=path.join(h.documentsRoot,'Archive After');
  const original=await fsPromises.readFile(path.join(root,'.yalken-location.v1.json'));
  const {buildProjectArchiveBuffer}=require('../../src/export/archive/projectArchiveExportHandler');
  const archive=await buildProjectArchiveBuffer(root);
  const archivePath=path.join(h.tempRoot,'renamed.yalken.zip');
  await fsPromises.writeFile(archivePath,archive.buffer);
  if(mode==='restore') await fsPromises.rename(root,path.join(h.tempRoot,'preserved-source'));
  const options={};
  if(process.platform==='darwin') require('../../scripts/build-project-archive-native.cjs').buildProjectArchiveNative();
  else options.publishArchiveDirectory=async ({tempRoot,targetRoot,assertCurrent})=>{
    await assertCurrent(); await fsPromises.rename(tempRoot,targetRoot);
    return {namePublished:true,publicationOutcome:'PUBLISHED',directorySynced:true};
  };
  const result=await h.main.handleImportProjectArchive({confirmed:true,requestId:`relocation-${mode}`,archivePath,mode,projectName:`Archive ${mode}`},options);
  assert.equal(result.ok,true,JSON.stringify(result));
  const imported=path.join(h.documentsRoot,`Archive ${mode}`), importedManifest=path.join(imported,PROJECT_MANIFEST_FILENAME);
  const location=await require('../../src/core/project-location-v1.cjs').createProjectLocationAdapter({fsAdapter:fsPromises,path,sha256:value=>require('node:crypto').createHash('sha256').update(value).digest('hex')}).getProjectLocation({manifestPath:importedManifest,projectId:result.projectId});
  if(mode==='copy') {
    assert.notEqual(result.projectId,manifest.projectId); assert.equal(location.bound,false);
    const hash=require('node:crypto').createHash('sha256').update(original).digest('hex');
    assert.deepEqual(await fsPromises.readFile(path.join(imported,`.yalken-location.inherited-${hash}.json`)),original);
  } else {
    assert.equal(result.projectId,manifest.projectId); assert.equal(location.bound,true);
    assert.equal(location.manifestPath,JSON.parse(original).logicalManifestPath);
    assert.equal(location.physicalManifestPath,importedManifest);
  }
  assert.equal(await fsPromises.readFile(path.join(imported,'roman','Imported','01 Start.txt'),'utf8'),'first scene');
  assert.deepEqual(await fsPromises.readFile(archivePath),archive.buffer);
  const {readProjectArchivePayload,collectProjectArchiveSourceEntries}=require('../../src/export/archive/projectArchiveExportHandler');
  const originalEntries=readProjectArchivePayload(archive.buffer).entries;
  const actualFiles=(await collectProjectArchiveSourceEntries(imported)).files;
  assert.equal(actualFiles.length,originalEntries.length);
  for(const entry of originalEntries) {
    if(entry.relativePath==='.yalken-location.v1.json' || (mode==='copy'&&entry.relativePath===PROJECT_MANIFEST_FILENAME))continue;
    assert.deepEqual(await fsPromises.readFile(path.join(imported,entry.relativePath)),entry.buffer,entry.relativePath);
  }
});


test('S27 renamed project admits a real novel import and keeps all verified siblings across another rename', async t => {
  const h=await createHarness(t), projectId='location-novel-project';
  const beforeRoot=path.join(h.documentsRoot,'Novel Before');
  await fsPromises.mkdir(path.join(beforeRoot,'roman'),{recursive:true});
  await fsPromises.writeFile(path.join(beforeRoot,PROJECT_MANIFEST_FILENAME),JSON.stringify({schemaVersion:1,projectId,
    projectName:'Novel Before',treeIdentity:{schemaVersion:1,nodes:{}}})+'\n');
  const first=await h.main.handleProjectLifecycleRenameCommand({projectId,projectName:'Novel After'});
  assert.equal(first.ok,true,JSON.stringify(first));
  const root=path.join(h.documentsRoot,'Novel After'),manifestPath=path.join(root,PROJECT_MANIFEST_FILENAME);
  const {buildStoredZip}=require('../../src/export/docx/docxMinBuilder');
  const paragraphs=Array.from({length:20},(_,i)=>`<w:p><w:r><w:t>Paragraph ${i} Ж 東京 🧭</w:t></w:r></w:p>`).join('');
  const bytes=buildStoredZip([
    {name:'[Content_Types].xml',data:'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'},
    {name:'_rels/.rels',data:'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'},
    {name:'word/document.xml',data:`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}</w:body></w:document>`},
  ]);
  const bridge=await import('../../src/io/revisionBridge/index.mjs');
  const report=bridge.buildDocxContentPreviewFromZipBytes({bytes});assert.equal(report.ok,true,JSON.stringify(report));
  const plan=bridge.buildDocxNovelImportPreviewPlanFromContentPreview(report,{targetParagraphs:4});assert.equal(plan.ok,true,JSON.stringify(plan));
  const safe=require('../../src/utils/docxImportSafeCreate');assert.ok(safe.rememberDocxImportPreviewPlanAdmission(plan));
  const {createMainProjectManifestAuthority}=await import('../../src/product/mainProjectManifestAuthority.mjs');
  const authority=createMainProjectManifestAuthority({anchorRoot:path.join(h.userDataRoot,'stage10-integrity-anchors')});
  const mainSource=read('src/main.js'), named=name=>{
    const start=mainSource.indexOf(`async function ${name}(`),end=mainSource.slice(start+1).search(/\n(?:async )?function /);
    assert.ok(start>=0&&end>=0);return mainSource.slice(start,start+1+end);
  };
  const sandbox={fs:fsPromises,path,computeHash:x=>require('node:crypto').createHash('sha256').update(x).digest('hex'),
    treeCohortError:code=>Object.assign(Error(code),{code}),module:{exports:{}}};
  require('node:vm').runInNewContext(named('readTreeCohortPath')+'\n'+named('captureTreeCohortInventory')+'\nmodule.exports=captureTreeCohortInventory;',sandbox);
  const input={docxImportPreviewPlan:plan}, options={projectRoot:root,romanRoot:path.join(root,'roman'),manifestPath,projectId,
    manifestRaw:await fsPromises.readFile(manifestPath,'utf8'),transactionAuthority:authority,importRequestNonce:'location-novel',
    captureTreeCohortInventory:sandbox.module.exports};
  const created=await safe.applyDocxImportSafeCreate(input,options);assert.equal(created.ok,true,JSON.stringify(created));
  const scenes=created.value.receipt.createdScenes;assert.ok(scenes.length>1);
  const tx=require('../../src/core/project-transaction-v1.cjs'),verify=args=>authority.verifyManifestContinuation({...args,projectId});
  const query=at=>tx.readVerifiedProjectDocxNovelCohort({manifestPath:path.join(at,PROJECT_MANIFEST_FILENAME),projectId,
    scenePaths:scenes.map(scene=>path.join(at,scene.relativeFile)),verifyManifestContinuation:verify});
  const verified=await query(root);assert.deepEqual(verified.records.map(record=>record.sceneDigest),scenes.map(scene=>scene.outputHash));
  assert.ok(verified.records.every(record=>record.manifestPath===manifestPath&&record.scenePath.startsWith(root+path.sep)));
  const snapshot=await tx.readVerifiedProjectRecoverySnapshot({manifestPath,projectId,verifyManifestContinuation:verify});
  assert.equal(snapshot.projectRootDigest,require('node:crypto').createHash('sha256').update(root).digest('hex'));
  const packet=path.join('.yalken-recovery',`wp201-${verified.treeMutation.receipt.transactionId}.json`);
  const packetBytes=await fsPromises.readFile(path.join(root,packet));
  const moved=await h.main.handleProjectLifecycleRenameCommand({projectId,projectName:'Novel Again'});assert.equal(moved.ok,true,JSON.stringify(moved));
  const again=path.join(h.documentsRoot,'Novel Again'),againManifest=path.join(again,PROJECT_MANIFEST_FILENAME);
  assert.deepEqual((await query(again)).records.map(record=>record.sceneDigest),scenes.map(scene=>scene.outputHash));
  const lineage=await tx.readVerifiedNovelAnnotationLineage({manifestPath:againManifest,scenePath:path.join(again,scenes[0].relativeFile),verifyManifestContinuation:verify});
  assert.ok(lineage.originResource.path.startsWith(again+path.sep));assert.ok(lineage.scenePaths.every(value=>value.startsWith(again+path.sep)));
  const replay=await safe.applyDocxImportSafeCreate(input,{...options,projectRoot:again,romanRoot:path.join(again,'roman'),manifestPath:againManifest,
    manifestRaw:await fsPromises.readFile(againManifest,'utf8')});assert.equal(replay.ok,true,JSON.stringify(replay));assert.equal(replay.value.idempotent,true);
  assert.deepEqual(await fsPromises.readFile(path.join(again,packet)),packetBytes);
});

test('S27 copy routing conflict preserves both source and staging and blocks recovery cleanup', async t => {
  const h=await createHarness(t),source=path.join(h.documentsRoot,'Conflict Before');
  const manifest=await writeProject(source,{projectName:'Conflict Before'});
  assert.equal((await h.main.handleProjectLifecycleRenameCommand({projectId:manifest.projectId,projectName:'Conflict After'})).ok,true);
  const root=path.join(h.documentsRoot,'Conflict After'),raw=await fsPromises.readFile(path.join(root,'.yalken-location.v1.json'));
  const name=`.yalken-location.inherited-${require('node:crypto').createHash('sha256').update(raw).digest('hex')}.json`;
  await fsPromises.writeFile(path.join(root,name),'foreign protected bytes');
  const copied=await h.main.handleProjectLifecycleDuplicateCommand({projectId:manifest.projectId,projectName:'Conflict Copy'});
  assert.equal(copied.code,'E_PROJECT_LOCATION_RECOVERY_REQUIRED');
  const journal=JSON.parse(await fsPromises.readFile(h.journalPath,'utf8'));assert.equal(journal.phase,'location-conflict-preserved');
  const recovery=await h.main.recoverProjectLifecycleJournal();assert.equal(recovery.code,'E_PROJECT_LOCATION_RECOVERY_REQUIRED');
  for(const at of [root,journal.tempRoot]) {
    assert.equal(await fsPromises.readFile(path.join(at,name),'utf8'),'foreign protected bytes');
    assert.deepEqual(await fsPromises.readFile(path.join(at,'.yalken-location.v1.json')),raw);
  }
});


test('S27 active rename refuses a failed rebind without retaining an owner for the old root', async t => {
  const h=await createHarness(t,{instrument:`
    module.exports.__locationOwner={
      failRebind(){bootstrapStage10ApplicationForProject=async()=>{throw Object.assign(Error('injected rebind failure'),{code:'E_TEST_REBIND'});};},
      read(){return {owner:activeStage10ApplicationBootstrap,route:activeStage10ApplicationCommandRoute,root:getProjectRootPath()};}
    };`});
  const created=await h.main.handleProjectLifecycleCreateCommand({projectName:'Active Before'});
  assert.equal(created.ok,true,JSON.stringify(created));assert.ok(h.main.__locationOwner.read().owner);
  h.main.__locationOwner.failRebind();
  const result=await h.main.handleProjectLifecycleRenameCommand({projectId:created.projectId,projectName:'Active After'});
  assert.equal(result.ok,false);assert.equal(result.code,'E_TEST_REBIND');
  const state=h.main.__locationOwner.read();assert.equal(state.root,path.join(h.documentsRoot,'Active After'));
  assert.equal(state.owner,null);assert.equal(state.route,null);
  const disk=JSON.parse(await fsPromises.readFile(path.join(state.root,PROJECT_MANIFEST_FILENAME),'utf8'));
  assert.equal(disk.projectId,created.projectId);assert.equal(disk.projectName,'Active After');
});
