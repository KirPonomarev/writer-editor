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

function findNode(root, predicate) {
  if (!root) return null;
  if (predicate(root)) return root;
  for (const child of root.children || []) {
    const found = findNode(child, predicate);
    if (found) return found;
  }
  return null;
}

test('metadata inspector read model exposes active scene metadata without file paths', async (t) => {
  const tempRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'metadata-read-main-'));
  t.after(async () => fsPromises.rm(tempRoot, { recursive: true, force: true }));

  const documentsRoot = path.join(tempRoot, 'Documents', 'craftsman');
  const projectRoot = path.join(documentsRoot, 'Роман');
  const importedRoot = path.join(projectRoot, 'roman', 'Imported');
  await fsPromises.mkdir(importedRoot, { recursive: true });
  await fsPromises.writeFile(
    path.join(importedRoot, '01_Alpha.txt'),
    [
      '[meta]',
      'synopsis: Quiet scene summary',
      'status: чистовой текст',
      'tags: POV=Kira; линия=A; место=Station',
      '[/meta]',
      '',
      'alpha beta gamma',
    ].join('\n'),
    'utf8',
  );

  const { main, fileManager } = await loadMainWithElectronStub();
  const originalGetDocumentsPath = fileManager.getDocumentsPath;
  fileManager.getDocumentsPath = () => documentsRoot;
  t.after(() => { fileManager.getDocumentsPath = originalGetDocumentsPath; });

  const tree = await main.handleWorkspaceProjectTreeQuery({ tab: 'roman' });
  assert.equal(tree.ok, true);
  const alpha = findNode(tree.root, (node) => node.kind === 'scene' && node.label === 'Alpha');
  assert.ok(alpha);

  const result = await main.handleWorkspaceMetadataInspectorQuery({
    projectId: tree.projectId,
    nodeId: alpha.nodeId,
  });

  assert.equal(result.ok, true);
  assert.equal(result.state, 'ready');
  assert.equal(result.context.nodeId, alpha.nodeId);
  assert.equal(result.context.kind, 'scene');
  assert.equal(result.context.title, 'Alpha');
  assert.equal(result.context.metaEnabled, true);
  assert.equal(result.metadata.synopsis, 'Quiet scene summary');
  assert.equal(result.metadata.status, 'чистовой текст');
  assert.deepEqual(result.metadata.tags, { pov: 'Kira', line: 'A', place: 'Station' });
  assert.equal(result.wordCount, 3);
  assert.equal(JSON.stringify(result).includes(projectRoot), false);
});

test('metadata inspector read model reports empty and unsupported states honestly', async (t) => {
  const tempRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'metadata-read-empty-'));
  t.after(async () => fsPromises.rm(tempRoot, { recursive: true, force: true }));

  const documentsRoot = path.join(tempRoot, 'Documents', 'craftsman');
  const { main, fileManager } = await loadMainWithElectronStub();
  const originalGetDocumentsPath = fileManager.getDocumentsPath;
  fileManager.getDocumentsPath = () => documentsRoot;
  t.after(() => { fileManager.getDocumentsPath = originalGetDocumentsPath; });

  const empty = await main.handleWorkspaceMetadataInspectorQuery({});
  assert.equal(empty.ok, true);
  assert.equal(empty.state, 'empty');
  assert.equal(empty.unavailableReason, 'NO_ACTIVE_NODE');

  const tree = await main.handleWorkspaceProjectTreeQuery({ tab: 'roman' });
  const romanSection = findNode(tree.root, (node) => node.kind === 'roman-section');
  assert.ok(romanSection);
  const unsupported = await main.handleWorkspaceMetadataInspectorQuery({
    projectId: tree.projectId,
    nodeId: romanSection.nodeId,
  });
  assert.equal(unsupported.ok, true);
  assert.equal(unsupported.state, 'unavailable');
  assert.equal(unsupported.unavailableReason, 'METADATA_UNSUPPORTED_FOR_NODE');
  assert.equal(JSON.stringify(unsupported).includes(documentsRoot), false);
});
