const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const Module = require('node:module');

const ROOT = path.resolve(__dirname, '..', '..');

async function loadMainWithElectronStub() {
  const mainPath = path.join(ROOT, 'src', 'main.js');
  const fileManagerPath = path.join(ROOT, 'src', 'utils', 'fileManager.js');
  const originalLoad = Module._load;
  const electronStub = {
    app: {
      getPath: () => ROOT,
      setPath: () => {},
      whenReady: () => new Promise(() => {}),
      on: () => {},
      quit: () => {},
      exit: () => {},
      setName: () => {},
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

function findNode(root, predicate) {
  if (!root) return null;
  if (predicate(root)) return root;
  for (const child of root.children || []) {
    const found = findNode(child, predicate);
    if (found) return found;
  }
  return null;
}

test('project tree identity migration is atomic, idempotent, and rename-stable', async (t) => {
  const tempRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'tree-identity-main-'));
  t.after(async () => fsPromises.rm(tempRoot, { recursive: true, force: true }));

  const documentsRoot = path.join(tempRoot, 'Documents', 'craftsman');
  const projectRoot = path.join(documentsRoot, 'Роман');
  const importedRoot = path.join(projectRoot, 'roman', 'Imported');
  const scenePath = path.join(importedRoot, '01_Scene.txt');
  await fsPromises.mkdir(importedRoot, { recursive: true });
  await fsPromises.writeFile(scenePath, 'scene text', 'utf8');

  const { main, fileManager } = await loadMainWithElectronStub();
  const originalGetDocumentsPath = fileManager.getDocumentsPath;
  fileManager.getDocumentsPath = () => documentsRoot;
  t.after(() => { fileManager.getDocumentsPath = originalGetDocumentsPath; });

  const first = await main.handleWorkspaceProjectTreeQuery({ tab: 'roman' });
  assert.equal(first.ok, true);
  const firstScene = findNode(first.root, (node) => node.path === scenePath);
  assert.ok(firstScene);
  assert.match(firstScene.nodeId, /^tree-node-[a-f0-9]{32}$/u);

  const manifestPath = path.join(projectRoot, 'project.craftsman.json');
  const firstManifestText = await fsPromises.readFile(manifestPath, 'utf8');
  const firstManifest = JSON.parse(firstManifestText);
  assert.equal(firstManifest.treeIdentity.schemaVersion, 1);
  assert.equal(firstManifest.treeIdentity.nodes[firstScene.nodeId].present, true);

  const second = await main.handleWorkspaceProjectTreeQuery({ tab: 'roman' });
  assert.equal(second.ok, true);
  assert.equal(await fsPromises.readFile(manifestPath, 'utf8'), firstManifestText);

  const manifestWithFuture = {
    ...firstManifest,
    futureProData: { links: [{ id: 'keep-me' }] },
  };
  await fileManager.writeFileAtomic(manifestPath, JSON.stringify(manifestWithFuture, null, 2));

  const renamed = await main.handleUiRenameNodeCommand({ path: scenePath, name: 'Renamed' });
  assert.equal(renamed.ok, true);
  const afterRename = await main.handleWorkspaceProjectTreeQuery({ tab: 'roman' });
  assert.equal(afterRename.ok, true);
  const renamedScene = findNode(afterRename.root, (node) => node.path === renamed.path);
  assert.ok(renamedScene);
  assert.equal(renamedScene.nodeId, firstScene.nodeId);
  assert.equal(await fsPromises.readFile(renamed.path, 'utf8'), 'scene text');

  const finalManifest = JSON.parse(await fsPromises.readFile(manifestPath, 'utf8'));
  assert.deepEqual(finalManifest.futureProData, { links: [{ id: 'keep-me' }] });
  assert.equal(finalManifest.treeIdentity.nodes[firstScene.nodeId].bindingKey, 'file:roman/Imported/01_Renamed.txt');
  assert.equal(fs.existsSync(path.join(projectRoot, 'backups')), true);
});
