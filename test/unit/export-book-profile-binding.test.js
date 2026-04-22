const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function read(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

async function loadModules() {
  const root = process.cwd();
  const registry = await import(pathToFileURL(path.join(root, 'src', 'renderer', 'commands', 'registry.mjs')).href);
  const runner = await import(pathToFileURL(path.join(root, 'src', 'renderer', 'commands', 'runCommand.mjs')).href);
  const project = await import(pathToFileURL(path.join(root, 'src', 'renderer', 'commands', 'projectCommands.mjs')).href);
  return {
    createCommandRegistry: registry.createCommandRegistry,
    createCommandRunner: runner.createCommandRunner,
    COMMAND_IDS: project.COMMAND_IDS,
    registerProjectCommands: project.registerProjectCommands,
  };
}

test('export book profile binding: command forwards canonical bookProfile options to backend intact', async () => {
  const { createCommandRegistry, createCommandRunner, COMMAND_IDS, registerProjectCommands } = await loadModules();
  const bookProfile = {
    schemaVersion: 'book-profile.v1',
    profileId: 'persisted-project-profile',
    formatId: 'A5',
    widthMm: 148,
    heightMm: 210,
    orientation: 'portrait',
    marginTopMm: 20,
    marginRightMm: 18,
    marginBottomMm: 22,
    marginLeftMm: 18,
    chapterStartRule: 'next-page',
    allowExplicitPageBreaks: true,
  };
  const pageLayoutMetrics = {
    pageWidthMm: 148,
    pageHeightMm: 210,
    contentWidthMm: 112,
    contentHeightMm: 168,
  };
  let capturedPayload = null;
  const electronAPI = {
    exportDocxMin: async (payload) => {
      capturedPayload = payload;
      return { ok: 1, outPath: payload.outPath, bytesWritten: 321 };
    },
  };

  const registry = createCommandRegistry();
  registerProjectCommands(registry, { electronAPI });
  const runCommand = createCommandRunner(registry);

  const result = await runCommand(COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN, {
    requestId: 'book-profile-export',
    outPath: '/tmp/book-profile-export.docx',
    bufferSource: 'First line\nSecond line',
    options: {
      bookProfile,
      pageLayoutMetrics,
      source: 'project-manifest',
    },
  });

  assert.deepEqual(capturedPayload, {
    requestId: 'book-profile-export',
    outPath: '/tmp/book-profile-export.docx',
    outDir: '',
    bufferSource: 'First line\nSecond line',
    options: {
      bookProfile,
      pageLayoutMetrics,
      source: 'project-manifest',
    },
  });
  assert.deepEqual(result, {
    ok: true,
    value: {
      exported: true,
      outPath: '/tmp/book-profile-export.docx',
      bytesWritten: 321,
    },
  });
});

test('export book profile binding: main export path no longer hardcodes A4 section geometry', () => {
  const source = read('src/main.js');

  assert.equal(
    source.includes('<w:pgSz w:w="11906" w:h="16838"/>'),
    false,
    'DOCX export must derive page size from bound project bookProfile, not hardcoded A4 twips',
  );
  assert.equal(
    source.includes('<w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/>'),
    false,
    'DOCX export must derive margins from bound project bookProfile, not hardcoded defaults',
  );
  assert.ok(
    /bookProfile|pageLayoutMetrics|pageSetup/.test(source),
    'DOCX export path must reference a bound page setup source',
  );
});

test('export book profile binding: export can obtain bound page setup from renderer or bounded query bridge', () => {
  const mainSource = read('src/main.js');
  const preloadSource = read('src/preload.js');
  const editorSource = read('src/renderer/editor.js');

  const snapshotBridgeExists =
    mainSource.includes("mainWindow.webContents.send('editor:snapshot-request', { requestId });")
    && mainSource.includes("ipcMain.on('editor:snapshot-response'")
    && preloadSource.includes("ipcRenderer.on('editor:snapshot-request'")
    && preloadSource.includes("ipcRenderer.send('editor:snapshot-response'")
    && editorSource.includes('window.electronAPI.onEditorSnapshotRequest')
    && editorSource.includes('window.electronAPI.sendEditorSnapshotResponse')
    && editorSource.includes('bookProfile: getActiveBookProfile()');

  assert.ok(
    snapshotBridgeExists,
    'export needs a bounded editor snapshot bridge carrying canonical bookProfile for page setup binding',
  );
});
