const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const Module = require('node:module');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

async function loadModule(relativePath) {
  const fileUrl = pathToFileURL(path.join(ROOT, relativePath)).href;
  return import(fileUrl);
}

async function loadMainWithElectronStub() {
  const mainPath = path.join(ROOT, 'src', 'main.js');
  const fileManagerPath = path.join(ROOT, 'src', 'utils', 'fileManager.js');
  const originalLoad = Module._load;
  const electronStub = {
    app: {
      getPath: (name) => {
        if (name === 'documents' || name === 'userData' || name === 'appData') {
          return ROOT;
        }
        return ROOT;
      },
      requestSingleInstanceLock: () => true,
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
      defaultSession: {
        webRequest: {
          onHeadersReceived: () => {},
        },
      },
    },
  };

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'electron') {
      return electronStub;
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  delete require.cache[mainPath];
  delete require.cache[fileManagerPath];

  try {
    const main = require(mainPath);
    const fileManager = require(fileManagerPath);
    return { main, fileManager };
  } finally {
    Module._load = originalLoad;
  }
}

test('book profile persistence: project manifest source carries canonical bookProfile state', () => {
  const source = read('src/main.js');

  assert.ok(/function\s+getProjectManifestComparable\s*\(/.test(source));
  assert.ok(/function\s+normalizeProjectManifest\s*\(/.test(source));
  assert.ok(
    /bookProfile/.test(source),
    'project manifest contract must mention bookProfile as canonical project-level state',
  );
  assert.ok(
    /normalizeBookProfile|createDefaultBookProfile/.test(source),
    'project manifest normalization must canonicalize bookProfile before write',
  );
  assert.ok(
    /bookProfile\s*:/.test(source),
    'project manifest comparable or normalized record must include bookProfile',
  );
});

test('book profile persistence: reopen path exposes persisted bookProfile or a bounded query hook', () => {
  const mainSource = read('src/main.js');
  const preloadSource = read('src/preload.js');
  const editorSource = read('src/renderer/editor.js');

  const editorPayloadCarriesBookProfile =
    /bookProfile\s*:\s*.*bookProfile/.test(mainSource)
    || mainSource.includes('safePayload.bookProfile')
    || mainSource.includes("mainWindow.webContents.send('editor:set-text', safePayload)")
      && mainSource.includes('bookProfile');
  const snapshotBridgeExists =
    preloadSource.includes("ipcRenderer.on('editor:snapshot-request'")
    && preloadSource.includes("ipcRenderer.send('editor:snapshot-response'")
    && editorSource.includes('window.electronAPI.onEditorSnapshotRequest')
    && editorSource.includes('window.electronAPI.sendEditorSnapshotResponse')
    && editorSource.includes('composeEditorSnapshot()');

  assert.ok(
    editorPayloadCarriesBookProfile || snapshotBridgeExists,
    'save-reopen needs either editor:set-text bookProfile payload or a bounded snapshot bridge for project bookProfile',
  );
});

test('book profile persistence: canonical bookProfile survives manifest write and reopen read', async (t) => {
  const tempRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'book-profile-roundtrip-'));
  t.after(async () => {
    await fsPromises.rm(tempRoot, { recursive: true, force: true });
  });

  const documentsRoot = path.join(tempRoot, 'Documents', 'craftsman');
  const projectRoot = path.join(documentsRoot, 'Роман');
  const documentPath = path.join(projectRoot, 'roman', 'chapter-1.txt');
  const manifestPath = path.join(projectRoot, 'project.craftsman.json');

  const { main, fileManager } = await loadMainWithElectronStub();
  const bookProfile = await loadModule('src/core/bookProfile.mjs');
  const canonicalBookProfile = bookProfile.createDefaultBookProfile({
    profileId: 'stage02-book-profile',
    formatId: 'A5',
    marginTopMm: 20,
    marginRightMm: 18,
    marginBottomMm: 22,
    marginLeftMm: 18,
  });
  const landscapeBookProfile = bookProfile.createDefaultBookProfile({
    profileId: 'stage02-book-profile-landscape',
    formatId: 'A5',
    orientation: 'landscape',
    marginTopMm: 20,
    marginRightMm: 18,
    marginBottomMm: 22,
    marginLeftMm: 18,
  });

  const originalGetDocumentsPath = fileManager.getDocumentsPath;
  fileManager.getDocumentsPath = () => documentsRoot;

  t.after(() => {
    fileManager.getDocumentsPath = originalGetDocumentsPath;
  });

  await fileManager.writeFileAtomic(documentPath, 'chapter one');

  const writeResult = await main.persistBookProfileForFile(
    documentPath,
    canonicalBookProfile,
    'save project manifest',
  );

  assert.equal(writeResult.persisted, true);
  assert.equal(fs.existsSync(manifestPath), true);

  const rawManifest = JSON.parse(await fsPromises.readFile(manifestPath, 'utf8'));
  assert.deepEqual(rawManifest.bookProfile, canonicalBookProfile);
  for (const key of bookProfile.BOOK_PROFILE_SCREEN_CHROME_KEYS) {
    assert.equal(Object.prototype.hasOwnProperty.call(rawManifest.bookProfile, key), false);
  }

  const reopenedManifestRecord = await main.readProjectManifest();
  assert.ok(reopenedManifestRecord);
  assert.deepEqual(reopenedManifestRecord.manifest.bookProfile, canonicalBookProfile);

  const secondWriteResult = await main.persistBookProfileForFile(
    documentPath,
    canonicalBookProfile,
    'save project manifest',
  );

  assert.equal(secondWriteResult.persisted, false);
  assert.deepEqual(secondWriteResult.manifest.bookProfile, canonicalBookProfile);

  const landscapeWriteResult = await main.persistBookProfileForFile(
    documentPath,
    landscapeBookProfile,
    'save project manifest landscape',
  );

  assert.equal(landscapeWriteResult.persisted, true);
  assert.equal(landscapeWriteResult.manifest.bookProfile.orientation, 'landscape');
  assert.ok(
    landscapeWriteResult.manifest.bookProfile.widthMm
      > landscapeWriteResult.manifest.bookProfile.heightMm,
  );

  const landscapeRawManifest = JSON.parse(await fsPromises.readFile(manifestPath, 'utf8'));
  assert.deepEqual(landscapeRawManifest.bookProfile, landscapeBookProfile);
  assert.equal(landscapeRawManifest.bookProfile.orientation, 'landscape');
  assert.ok(landscapeRawManifest.bookProfile.widthMm > landscapeRawManifest.bookProfile.heightMm);

  const reopenedLandscapeManifestRecord = await main.readProjectManifest();
  assert.ok(reopenedLandscapeManifestRecord);
  assert.deepEqual(reopenedLandscapeManifestRecord.manifest.bookProfile, landscapeBookProfile);
  assert.equal(reopenedLandscapeManifestRecord.manifest.bookProfile.orientation, 'landscape');
  assert.ok(
    reopenedLandscapeManifestRecord.manifest.bookProfile.widthMm
      > reopenedLandscapeManifestRecord.manifest.bookProfile.heightMm,
  );
});
