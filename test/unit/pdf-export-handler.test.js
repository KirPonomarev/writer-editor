const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPdfPrintHtml,
  runPdfExport,
} = require('../../src/export/pdf/pdfExportHandler');

test('PDF export print projection uses BookProfile page geometry and no app chrome', () => {
  const html = buildPdfPrintHtml({
    bookProfile: {
      formatId: 'A5',
      widthMm: 148,
      heightMm: 210,
      orientation: 'portrait',
      marginTopMm: 20,
      marginRightMm: 18,
      marginBottomMm: 22,
      marginLeftMm: 18,
    },
    scenes: [
      {
        sceneId: 'roman/scene-one.txt',
        title: 'Scene One',
        text: 'First paragraph.\n\nSecond paragraph.',
      },
      {
        sceneId: 'roman/scene-two.txt',
        title: 'Scene Two',
        text: 'Next scene.',
      },
    ],
  });

  assert.ok(html.includes('data-yalken-pdf-print-projection="isolated"'));
  assert.ok(html.includes('size: 148mm 210mm;'));
  assert.ok(html.includes('margin: 20mm 18mm 22mm 18mm;'));
  assert.ok(html.includes('content: counter(page);'));
  assert.ok(html.includes('class="yalken-pdf-scene-separator"'));
  assert.ok(html.includes('Scene One'));
  assert.ok(html.includes('Second paragraph.'));

  for (const forbidden of [
    'ProseMirror',
    'toolbar',
    'navigator',
    'sidebar',
    'modal__content',
    'data-toolbar',
  ]) {
    assert.equal(html.includes(forbidden), false, forbidden);
  }
});

test('PDF export writes rendered buffer atomically from saved canonical scenes', async () => {
  const calls = {
    renderedHtml: '',
    targetChecks: 0,
    writtenPath: '',
    writtenBuffer: null,
    status: '',
  };
  const result = await runPdfExport(
    {
      confirmed: true,
      requestId: 'pdf-test',
      outPath: '/tmp/yalken-test.pdf',
    },
    {
      normalizePdfExportPayload(payload) {
        return {
          confirmed: payload.confirmed === true,
          requestId: payload.requestId,
          outPath: payload.outPath,
        };
      },
      makeTypedPdfExportError(code, reason, details) {
        return { ok: false, error: { code, reason, details } };
      },
      resolvePdfExportPath(payload) {
        return { canceled: false, outPath: payload.outPath };
      },
      validatePdfExportTarget(outPath, source) {
        calls.targetChecks += 1;
        assert.equal(outPath, '/tmp/yalken-test.pdf');
        assert.deepEqual(source.sourcePaths, ['/project/roman/one.txt']);
        return { ok: true, outPath };
      },
      readCanonicalPdfExportSource() {
        return {
          projectRoot: '/project',
          sourcePaths: ['/project/roman/one.txt'],
          bookProfile: {
            widthMm: 210,
            heightMm: 297,
            marginTopMm: 25.4,
            marginRightMm: 25.4,
            marginBottomMm: 25.4,
            marginLeftMm: 25.4,
          },
          scenes: [
            {
              sceneId: 'roman/one.txt',
              title: 'One',
              text: 'Canonical text from disk.',
            },
          ],
        };
      },
      renderPdfBuffer(html) {
        calls.renderedHtml = html;
        return Buffer.from('%PDF-1.7\ncanonical');
      },
      queueDiskOperation(operation, label) {
        assert.equal(label, 'export pdf');
        return operation();
      },
      writeBufferAtomic(outPath, buffer) {
        calls.writtenPath = outPath;
        calls.writtenBuffer = buffer;
      },
      updateStatus(status) {
        calls.status = status;
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.exported, true);
  assert.equal(result.sceneCount, 1);
  assert.equal(result.bytesWritten, Buffer.byteLength('%PDF-1.7\ncanonical'));
  assert.equal(calls.targetChecks, 2);
  assert.equal(calls.writtenPath, '/tmp/yalken-test.pdf');
  assert.ok(Buffer.isBuffer(calls.writtenBuffer));
  assert.ok(calls.renderedHtml.includes('Canonical text from disk.'));
  assert.equal(calls.status, 'PDF экспортирован');
});

test('PDF export returns a typed failure report when renderer authority fields are rejected', async () => {
  const result = await runPdfExport(
    {
      text: 'renderer text must not become source',
    },
    {
      normalizePdfExportPayload() {
        return {
          ok: false,
          code: 'E_EXPORT_PDF_PAYLOAD_INVALID',
          reason: 'pdf_export_renderer_authority_denied',
          details: { fields: ['text'] },
        };
      },
      makeTypedPdfExportError(code, reason, details) {
        return { ok: false, error: { code, reason, details } };
      },
      resolvePdfExportPath() {},
      validatePdfExportTarget() {},
      readCanonicalPdfExportSource() {},
      renderPdfBuffer() {},
      queueDiskOperation() {},
      writeBufferAtomic() {},
      updateStatus() {},
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'E_EXPORT_PDF_PAYLOAD_INVALID');
  assert.equal(result.error.reason, 'pdf_export_renderer_authority_denied');
  assert.deepEqual(result.error.details.fields, ['text']);
});

// Load the complete production Main module with an inert Electron host. Only
// private state selection/observation is appended; source reads, classification,
// envelope/profile parsing, policy and filesystem adapters remain production.
async function pdfMainFixture(t) {
  const fs = require('node:fs/promises');
  const fsSync = require('node:fs');
  const path = require('node:path');
  const Module = require('node:module');
  const root = await fs.mkdtemp(path.join(await fs.realpath(require('node:os').tmpdir()), 'pdf-active-project-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const documents = path.join(root, 'Documents');
  const library = path.join(documents, 'craftsman');
  await fs.mkdir(library, { recursive: true });
  await fs.mkdir(path.join(root, 'userData'));
  const mainPath = path.resolve(__dirname, '../../src/main.js');
  const fileManagerPath = path.resolve(__dirname, '../../src/utils/fileManager.js');
  const originalLoad = Module._load;
  const electron = {
    app: { isPackaged: false, getPath: name => name === 'documents' ? documents : path.join(root, 'userData'),
      setPath() {}, whenReady: () => new Promise(() => {}), on() {}, quit() {}, exit() {}, setName() {},
      requestSingleInstanceLock: () => true },
    BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
    Menu: { buildFromTemplate: () => ({}), setApplicationMenu() {} },
    dialog: { showMessageBox: async () => ({}), showSaveDialog: async () => ({ canceled: true }) },
    ipcMain: { on() {}, handle() {} },
    session: { defaultSession: { webRequest: { onHeadersReceived() {} } } },
  };
  const compiled = new Module(mainPath, module);
  compiled.filename = mainPath;
  compiled.paths = Module._nodeModulePaths(path.dirname(mainPath));
  delete require.cache[fileManagerPath];
  Module._load = function (request, parent, isMain) {
    return request === 'electron' ? electron : originalLoad.call(this, request, parent, isMain);
  };
  try {
    compiled._compile(fsSync.readFileSync(mainPath, 'utf8') + `
module.exports.__pdfTest = {
  select(name, file) { currentProjectName=name; currentFilePath=file; isDirty=false; autoSaveInProgress=false;
    lastSignaledEditGeneration=0; activeStage10ApplicationBootstrap={}; commentAuthoringSessionId='pdf-test';
    mainWindow={isDestroyed:()=>false,webContents:{isDestroyed:()=>false,send:(...args)=>pdfTestStatuses.push(args)}}; },
  mutate(kind) {
    if(kind==='project')currentProjectName='Other';
    if(kind==='document')currentFilePath += '.other';
    if(kind==='session')commentAuthoringSessionId='other';
    if(kind==='owner')activeStage10ApplicationBootstrap={};
    if(kind==='window')mainWindow={};
    if(kind==='generation')lastSignaledEditGeneration++;
    if(kind==='dirty')isDirty=true;
    if(kind==='autosave')autoSaveInProgress=true;
    if(kind==='capability')getWriterLocalRuntimeProfile=()=>({profileId:'WRITER_LOCAL_SCENE_LANGUAGE_TAG_V12'});
  },
  source:()=>readCanonicalPdfExportSource(),
  validate:(target,source)=>validatePdfExportTarget(target,source),
  prepareExport(hooks={}) {
    resolvePdfExportPath=async payload=>{await hooks.dialog?.();return hooks.cancel?{canceled:true}:{outPath:payload.outPath};};
    renderPdfBufferFromHtml=async html=>{await hooks.render?.(html);return Buffer.from('%PDF-native-port-fixture');};
    const originalQueue=queueDiskOperation;
    queueDiskOperation=(operation,label)=>originalQueue(async()=>{if(label==='export pdf')await hooks.queued?.();return operation();},label);
  },
  export:outPath=>handleExportPdf({confirmed:true,outPath,requestId:'pdf-main-regression'}),
  statuses:()=>pdfTestStatuses
};
const pdfTestStatuses=[];`, mainPath);
  } finally { Module._load = originalLoad; }
  const main = compiled.exports;
  const profile = await import(require('node:url').pathToFileURL(path.resolve(__dirname, '../../src/core/bookProfile.mjs')).href);
  const activeRoot = path.join(library, 'Active');
  const defaultRoot = path.join(library, 'Роман');
  const scene = path.join(activeRoot, 'roman', 'Imported', '01 Начало.txt');
  const manifestPath = path.join(activeRoot, 'project.craftsman.json');
  await fs.mkdir(path.dirname(scene), { recursive: true });
  await fs.mkdir(path.join(defaultRoot, 'roman'), { recursive: true });
  const bookProfile = profile.createDefaultBookProfile({ formatId: 'A5', profileId: 'active-pdf-profile' });
  const manifest = { schemaVersion: 1, projectId: 'project-active-pdf', projectName: 'Active', bookProfile,
    treeIdentity: { nodes: { ['tree-node-' + 'a'.repeat(32)]: { present: true, bindingKey: 'file:roman/Imported/01 Начало.txt' } } } };
  await fs.writeFile(manifestPath, JSON.stringify(manifest));
  await fs.writeFile(path.join(defaultRoot, 'project.craftsman.json'), JSON.stringify({ schemaVersion: 1,
    projectId: 'project-default-pdf', projectName: 'Роман', bookProfile: profile.createDefaultBookProfile() }));
  await fs.writeFile(scene, 'Только открытый проект é 🧭 東京.');
  main.__pdfTest.select('Active', scene);
  return { fs, root, activeRoot, defaultRoot, scene, manifestPath, manifest, bookProfile, main: main.__pdfTest };
}

test('actual Main PDF source selects active project and its raw BookProfile, then rejects stale cohorts', async t => {
  const h = await pdfMainFixture(t);
  const source = await h.main.source();
  assert.equal(source.projectId, h.manifest.projectId);
  assert.equal(source.projectRoot, h.activeRoot);
  assert.equal(source.scenes.length, 1);
  assert.equal(source.scenes[0].text, 'Только открытый проект é 🧭 東京.');
  assert.equal(source.scenes[0].sceneId, 'roman/Imported/01 Начало.txt');
  assert.deepEqual(source.bookProfile, h.bookProfile);
  assert.deepEqual(source.sourcePaths, [h.scene]);
  await source.assertCapture();
  // A populated default must never contaminate this independently selected book.
  await h.fs.mkdir(require('node:path').join(h.defaultRoot, 'roman', 'Imported'));
  await h.fs.writeFile(require('node:path').join(h.defaultRoot, 'roman', 'Imported', 'foreign.txt'), 'FOREIGN DEFAULT');
  assert.equal((await h.main.source()).scenes[0].text, source.scenes[0].text);
  for (const kind of ['project', 'document', 'session', 'owner', 'window', 'generation', 'dirty', 'autosave', 'capability']) {
    h.main.select('Active', h.scene);
    const before = await h.main.source();
    h.main.mutate(kind);
    await assert.rejects(() => before.assertCapture(), /PDF_.*(?:STALE|DENIED)/, kind);
  }
  // Capability seam above intentionally produces a malformed candidate; restore
  // a new full Main instance for independent real-filesystem source mutations.
  const k = await pdfMainFixture(t);
  for (const kind of ['scene', 'manifest', 'added-scene', 'root']) {
    const before = await k.main.source();
    const oldManifest = await k.fs.readFile(k.manifestPath);
    const oldScene = await k.fs.readFile(k.scene);
    if (kind === 'scene') await k.fs.writeFile(k.scene, 'CHANGED SOURCE');
    if (kind === 'manifest') await k.fs.writeFile(k.manifestPath, JSON.stringify({ ...k.manifest, projectId: 'other' }));
    const added = require('node:path').join(require('node:path').dirname(k.scene), 'extra.txt');
    if (kind === 'added-scene') await k.fs.writeFile(added, 'NEW SCENE');
    if (kind === 'root') {
      await k.fs.rename(k.activeRoot, k.activeRoot + '.preserved');
      await k.fs.cp(k.activeRoot + '.preserved', k.activeRoot, { recursive: true });
    }
    await assert.rejects(() => before.assertCapture(), /PDF_.*STALE/, kind);
    if (kind === 'added-scene') await k.fs.unlink(added);
    if (kind === 'root') {
      await k.fs.rm(k.activeRoot, { recursive: true });
      await k.fs.rename(k.activeRoot + '.preserved', k.activeRoot);
    }
    await k.fs.writeFile(k.manifestPath, oldManifest);
    await k.fs.writeFile(k.scene, oldScene);
  }
  for (const invalid of [{ ...k.manifest, schemaVersion: 999 }, { ...k.manifest, bookProfile: { widthMm: -1 } }]) {
    await k.fs.writeFile(k.manifestPath, JSON.stringify(invalid));
    await assert.rejects(() => k.main.source(), /PDF_.*(?:INVALID|READ_ONLY)|BookProfile/);
  }
  await k.fs.writeFile(k.manifestPath, JSON.stringify(k.manifest));
  const originalReaddir = k.fs.readdir;
  k.fs.readdir = async function (folder, ...args) {
    if (folder === require('node:path').dirname(k.scene)) throw Object.assign(Error('PDF_TEST_READ_DENIED'), { code: 'EACCES' });
    return originalReaddir.call(this, folder, ...args);
  };
  try { await assert.rejects(() => k.main.source(), /PDF_TEST_READ_DENIED/); }
  finally { k.fs.readdir = originalReaddir; }
});

test('PDF guarded atomic writer refuses a stale staging result and preserves existing output', async t => {
  const fs = require('node:fs/promises'), path = require('node:path');
  const root = await fs.mkdtemp(path.join(await fs.realpath(require('node:os').tmpdir()), 'pdf-atomic-guard-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const target = path.join(root, 'book.pdf');
  const old = Buffer.from('%PDF-existing');
  await fs.writeFile(target, old);
  let reached = false;
  await assert.rejects(() => require('../../src/export/docx/atomicWriteBuffer').writeBufferAtomic(target, Buffer.from('%PDF-new'), {
    beforePublish: async () => {
      reached = true;
      assert.deepEqual(await fs.readFile(target), old);
      const names = await fs.readdir(root);
      const staged = names.filter(name => name.endsWith('.tmp'));
      assert.equal(staged.length, 1);
      assert.deepEqual(await fs.readFile(path.join(root, staged[0])), Buffer.from('%PDF-new'));
      throw new Error('PDF_CONTEXT_STALE');
    },
  }), /PDF_CONTEXT_STALE/);
  assert.equal(reached, true);
  assert.deepEqual(await fs.readFile(target), old);
});

test('actual Main PDF handler preserves output across dialog/render/queue/staging races', async t => {
  const path = require('node:path');
  for (const phase of ['success', 'cancel', 'dialog', 'render', 'queued', 'staging', 'foreign-target', 'published']) {
    await t.test(phase, async t => {
      const h = await pdfMainFixture(t), target = path.join(h.root, 'book.pdf');
      const old = Buffer.from('%PDF-existing');
      await h.fs.writeFile(target, old);
      let rendered = false;
      h.main.prepareExport({ cancel: phase === 'cancel',
        dialog: () => { if (phase === 'dialog') h.main.mutate('project'); },
        render: async html => {
          rendered = true;
          assert.ok(html.includes('Только открытый проект'));
          assert.ok(html.includes('size: 148mm 210mm;'));
          assert.equal(html.includes('FOREIGN DEFAULT'), false);
          if (phase === 'render') h.main.mutate('generation');
          if (phase === 'foreign-target') await h.fs.writeFile(target, 'FOREIGN NEW OUTPUT');
        },
        queued: () => { if (phase === 'queued') h.main.mutate('session'); },
      });
      const originalWrite = h.fs.writeFile, originalRename = h.fs.rename;
      let stagingReached = false, publicationReached = false;
      h.fs.writeFile = async function (file, ...args) {
        const result = await originalWrite.call(this, file, ...args);
        if (phase === 'staging' && String(file).startsWith(target + '.') && String(file).endsWith('.tmp')) {
          stagingReached = true;
          h.main.mutate('owner');
        }
        return result;
      };
      h.fs.rename = async function (from, to) {
        const result = await originalRename.call(this, from, to);
        if (to === target) {
          publicationReached = true;
          if (phase === 'published') h.main.mutate('project');
        }
        return result;
      };
      let result;
      try { result = await h.main.export(target); }
      finally { h.fs.writeFile = originalWrite; h.fs.rename = originalRename; }
      const bytes = await h.fs.readFile(target);
      if (phase === 'success') {
        assert.equal(result.ok, true);
        assert.equal(result.exported, true);
        assert.equal(result.sceneCount, 1);
        assert.equal(result.bookProfile.profileId, h.bookProfile.profileId);
        assert.deepEqual(bytes, Buffer.from('%PDF-native-port-fixture'));
        assert.equal(publicationReached, true);
        assert.ok(h.main.statuses().some(args => args.includes('PDF экспортирован')));
      } else if (phase === 'cancel') {
        assert.equal(result.ok, true);
        assert.equal(result.canceled, true);
        assert.equal(rendered, false);
        assert.deepEqual(bytes, old);
      } else {
        assert.equal(result.ok, false, JSON.stringify(result));
        assert.equal(result.error.reason, 'pdf_context_stale');
        assert.equal(h.main.statuses().some(args => args.includes('PDF экспортирован')), false);
        if (phase === 'published') {
          assert.equal(result.error.details.exported, true);
          assert.equal(result.error.details.outPath, target);
          assert.equal(publicationReached, true);
          assert.deepEqual(bytes, Buffer.from('%PDF-native-port-fixture'));
        } else {
          assert.equal(publicationReached, false);
          assert.deepEqual(bytes, phase === 'foreign-target' ? Buffer.from('FOREIGN NEW OUTPUT') : old);
        }
        if (phase === 'staging') assert.equal(stagingReached, true);
      }
      assert.deepEqual(await h.fs.readFile(h.scene), Buffer.from('Только открытый проект é 🧭 東京.'));
      assert.deepEqual(JSON.parse(await h.fs.readFile(h.manifestPath, 'utf8')), h.manifest);
    });
  }
});
