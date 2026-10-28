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
  txtScope:()=>buildSelectedScenesTxtExportScope(),
  txtQuery:()=>handleWorkspaceSelectedScenesTxtExportScopeQuery(),
  txtSelected:payload=>handleExportSelectedScenesTxt(payload),
  txtAll:payload=>handleExportAllScenesTxt(payload),
  prepareTxt(hooks={}) {
    const resolve=async payload=>{await hooks.dialog?.();return hooks.cancel?{canceled:true}:{outPath:payload.outPath};};
    resolveSelectedScenesTxtExportPath=resolve;
    resolveAllScenesTxtExportPath=resolve;
    const originalQueue=queueDiskOperation;
    queueDiskOperation=(operation,label)=>originalQueue(async()=>{
      if(label==='export selected scenes txt'||label==='export all scenes txt')await hooks.queued?.();
      return operation();
    },label);
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
  markdown:payload=>handleMarkdownExportLocalFileCommandSurface(payload || {requestId:'markdown-main-regression'}),
  markdownLegacy:payload=>handleExportMarkdownV1(payload),
  prepareMarkdown(hooks={}) {
    dialog.showSaveDialog=async()=>{await hooks.dialog?.();return hooks.cancel?{canceled:true}:{canceled:false,filePath:hooks.target};};
    dialog.showMessageBox=async()=>{await hooks.loss?.();return {response:hooks.lossCancel?1:0};};
    const originalQueue=queueDiskOperation;
    queueDiskOperation=(operation,label)=>originalQueue(async()=>{
      if(label==='export markdown v1')await hooks.queued?.();
      return operation();
    },label);
    if(hooks.finalize) {
      const originalAuthority=getMainProjectManifestAuthority;
      getMainProjectManifestAuthority=async()=>{
        const authority=await originalAuthority();
        return {withProjectLease:async(id,operation)=>{
          const result=await authority.withProjectLease(id,operation);
          await hooks.finalize();return result;
        }};
      };
    }
    const originalIo=loadMarkdownIoModule;
    loadMarkdownIoModule=async()=>{
      const io=await originalIo();
      return {...io,writeMarkdownWithRecovery:(target,text,options)=>io.writeMarkdownWithRecovery(target,text,{
        ...options,afterTempWrite:async value=>{await options.afterTempWrite?.(value);await hooks.staging?.(value);}
      })};
    };
  },
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


test('actual Main PDF reports committed output when lease finalization fails after rename', async t => {
  const path = require('node:path');
  for (const phase of ['unlink', 'directory']) {
    await t.test(phase, async t => {
      const h = await pdfMainFixture(t), target = path.join(h.root, 'book.pdf');
      await h.fs.writeFile(target, '%PDF-existing');
      h.main.prepareExport();
      const rename = h.fs.rename, unlink = h.fs.unlink, rmdir = h.fs.rmdir;
      let published = false, injected = false;
      h.fs.rename = async function (from, to) {
        const result = await rename.call(this, from, to);
        if (to === target) published = true;
        return result;
      };
      const failFinalization = file => {
        if (!published || injected || !String(file).startsWith(h.root + path.sep)) return;
        injected = true;
        throw Object.assign(new Error('PDF_LEASE_FINALIZATION_' + phase), {
          code: 'EACCES', ...(phase === 'directory' ? { reason: 'pdf_lease_directory_finalize_denied' } : {}),
        });
      };
      h.fs.unlink = async function (file, ...args) {
        if (phase === 'unlink') failFinalization(file);
        return unlink.call(this, file, ...args);
      };
      h.fs.rmdir = async function (file, ...args) {
        if (phase === 'directory') failFinalization(file);
        return rmdir.call(this, file, ...args);
      };
      let result;
      try { result = await h.main.export(target); }
      finally { h.fs.rename = rename; h.fs.unlink = unlink; h.fs.rmdir = rmdir; }
      const bytes = await h.fs.readFile(target);
      assert.equal(published, true);
      assert.equal(injected, true);
      assert.deepEqual(bytes, Buffer.from('%PDF-native-port-fixture'));
      assert.equal(result.ok, false);
      assert.equal(result.error.reason, phase === 'directory' ? 'pdf_lease_directory_finalize_denied' : 'pdf_write_failed');
      if (phase === 'unlink') assert.equal(result.error.details.message, 'PDF_LEASE_FINALIZATION_unlink');
      assert.equal(result.error.details.exported, true);
      assert.equal(result.error.details.outPath, target);
      assert.equal(result.error.details.bytesWritten, bytes.length);
      assert.equal(h.main.statuses().some(args => args.includes('PDF экспортирован')), false);
    });
  }
});


test('actual Main TXT uses the open named project and canonical order, without renderer source authority', async t => {
  const path = require('node:path');
  for (const mode of ['selected', 'all']) await t.test(mode, async t => {
    const h = await pdfMainFixture(t), second = require('../../src/core/io/path-boundary.js')
      .joinPathSegmentsWithinRoot(path.dirname(h.scene), ['02 Второй é 🧭.txt'], { resolveSymlinks: false });
    const firstText = 'Только открытый проект é 🧭 東京.', secondText = 'Вторая сцена\nCafé שלום 🧭.';
    await h.fs.writeFile(second, secondText);
    await h.fs.writeFile(path.join(h.defaultRoot, 'roman', 'foreign.txt'), 'FOREIGN DEFAULT');
    const beforeManifest = await h.fs.readFile(h.manifestPath), beforeFirst = await h.fs.readFile(h.scene);
    const query = await h.main.txtQuery();
    assert.equal(query.ok, true);
    assert.equal(query.scope.projectId, 'project-active-pdf');
    assert.match(query.scope.requestId, /^selected-scenes-txt-/u);
    assert.equal(query.scope.sceneCandidates.length, 2);
    assert.equal(JSON.stringify(query).includes(h.root), false);
    assert.equal(JSON.stringify(query).includes(firstText), false);
    const ids = query.scope.sceneCandidates.map(c => c.sceneId), target = path.join(h.root, mode + '.txt');
    h.main.prepareTxt();
    const result = mode === 'selected'
      ? await h.main.txtSelected({ confirmed: true, requestId: query.scope.requestId, selectedSceneIds: [...ids].reverse(), outPath: target })
      : await h.main.txtAll({ requestId: 'all-main', outPath: target });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.exported, true);
    assert.equal(result.sceneCount, 2);
    assert.deepEqual(await h.fs.readFile(target), Buffer.from(firstText + '\n\n' + secondText));
    assert.deepEqual(await h.fs.readFile(h.scene), beforeFirst);
    assert.deepEqual(await h.fs.readFile(h.manifestPath), beforeManifest);
    if (mode === 'selected') {
      const replay = await h.main.txtSelected({ confirmed: true, requestId: query.scope.requestId, selectedSceneIds: ids, outPath: target });
      assert.equal(replay.ok, false);
      assert.equal(replay.error.reason, 'txt_selection_stale');
    }
  });
});

test('actual Main TXT selection continuation rejects unissued, superseded and stale project choices', async t => {
  const path = require('node:path');
  for (const phase of ['unissued', 'superseded', 'project', 'manifest', 'roster']) await t.test(phase, async t => {
    const h = await pdfMainFixture(t), target = path.join(h.root, 'selection.txt');
    await h.fs.writeFile(target, 'KEEP');
    const query = await h.main.txtQuery();
    if (phase === 'superseded') await h.main.txtQuery();
    if (phase === 'project') h.main.mutate('project');
    if (phase === 'manifest') await h.fs.appendFile(h.manifestPath, '\n');
    if (phase === 'roster') await h.fs.writeFile(path.join(path.dirname(h.scene), '02 New.txt'), 'NEW');
    let dialog = false;
    h.main.prepareTxt({ dialog: () => { dialog = true; } });
    const result = await h.main.txtSelected({ confirmed: true,
      requestId: phase === 'unissued' ? 'renderer-made-request' : query.scope.requestId,
      selectedSceneIds: query.scope.sceneCandidates.map(c => c.sceneId), outPath: target });
    assert.equal(result.ok, false, JSON.stringify(result));
    assert.equal(result.error.reason, 'txt_selection_stale');
    assert.equal(dialog, false);
    assert.equal(await h.fs.readFile(target, 'utf8'), 'KEEP');
  });
});

test('actual Main TXT permits a dirty unselected scene, but never a dirty selected source', async t => {
  const path = require('node:path');
  for (const mode of ['selected-other', 'selected-current', 'all']) await t.test(mode, async t => {
    const h = await pdfMainFixture(t), second = path.join(path.dirname(h.scene), '02 Saved.txt');
    await h.fs.writeFile(second, 'SAVED é 🧭');
    h.main.mutate('dirty');
    const query = await h.main.txtQuery();
    assert.equal(query.ok, true);
    const id = query.scope.sceneCandidates.find(c => c.sceneId.endsWith(mode === 'selected-other' ? '02 Saved.txt' : '01 Начало.txt'))?.sceneId;
    assert.ok(id);
    const target = path.join(h.root, 'dirty.txt');
    await h.fs.writeFile(target, 'KEEP');
    let dialog = false;
    h.main.prepareTxt({ dialog: () => { dialog = true; } });
    const result = mode === 'all' ? await h.main.txtAll({ outPath: target })
      : await h.main.txtSelected({ confirmed: true, requestId: query.scope.requestId, selectedSceneIds: [id], outPath: target });
    if (mode === 'selected-other') {
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(await h.fs.readFile(target, 'utf8'), 'SAVED é 🧭');
      assert.equal(dialog, true);
    } else {
      assert.equal(result.ok, false);
      assert.equal(dialog, false);
      assert.equal(await h.fs.readFile(target, 'utf8'), 'KEEP');
    }
    assert.equal(await h.fs.readFile(h.scene, 'utf8'), 'Только открытый проект é 🧭 東京.');
  });
});


test('actual Main TXT guards dialog, queue, staging, targets and committed publication', async t => {
  const path = require('node:path');
  const phases = ['cancel', 'project', 'document', 'session', 'owner', 'window', 'generation', 'capability',
    'source', 'manifest', 'roster', 'queued', 'staging', 'target', 'target-link', 'target-hardlink',
    'root-target', 'source-target', 'rename-fail', 'published'];
  for (const mode of ['selected', 'all']) for (const phase of phases) await t.test(mode + ':' + phase, async t => {
    const h = await pdfMainFixture(t), originalSource = await h.fs.readFile(h.scene), originalManifest = await h.fs.readFile(h.manifestPath);
    const target = phase === 'source-target' ? h.scene : phase === 'root-target'
      ? path.join(h.activeRoot, 'inside.txt') : path.join(h.root, 'guarded.txt');
    if (phase !== 'source-target') await h.fs.writeFile(target, 'KEEP');
    const query = await h.main.txtQuery(), ids = query.scope.sceneCandidates.map(c => c.sceneId);
    h.main.prepareTxt({ cancel: phase === 'cancel', dialog: async () => {
      if (['project', 'document', 'session', 'owner', 'window', 'generation'].includes(phase)) h.main.mutate(phase);
      if (phase === 'source') await h.fs.appendFile(h.scene, ' NEW SOURCE');
      if (phase === 'manifest') await h.fs.appendFile(h.manifestPath, '\n');
      if (phase === 'roster') await h.fs.writeFile(path.join(path.dirname(h.scene), '02 Added.txt'), 'NEW');
    }, queued: async () => {
      if (phase === 'queued') h.main.mutate('session');
      if (phase === 'capability') h.main.mutate('capability');
      if (phase === 'target') await h.fs.writeFile(target, 'FOREIGN TARGET');
      if (phase === 'target-link' || phase === 'target-hardlink') {
        await h.fs.unlink(target);
        if (phase === 'target-link') await h.fs.symlink(h.scene, target); else await h.fs.link(h.scene, target);
      }
    } });
    const write = h.fs.writeFile, rename = h.fs.rename;
    let staged = false, published = false;
    h.fs.writeFile = async function (file, ...args) {
      const value = await write.call(this, file, ...args);
      if (String(file).startsWith(target + '.') && String(file).endsWith('.tmp')) {
        staged = true;
        if (phase === 'staging') h.main.mutate('owner');
      }
      return value;
    };
    h.fs.rename = async function (from, to) {
      if (to === target && phase === 'rename-fail') throw Object.assign(Error('TXT_RENAME_DENIED'), { code: 'EACCES' });
      const value = await rename.call(this, from, to);
      if (to === target) {
        published = true;
        if (phase === 'published') h.main.mutate('project');
      }
      return value;
    };
    let result;
    try { result = mode === 'selected'
      ? await h.main.txtSelected({ confirmed: true, requestId: query.scope.requestId, selectedSceneIds: ids, outPath: target })
      : await h.main.txtAll({ outPath: target }); }
    finally { h.fs.writeFile = write; h.fs.rename = rename; }
    if (phase === 'cancel') {
      assert.equal(result.ok, true); assert.equal(result.canceled, true);
    } else {
      assert.equal(result.ok, false, JSON.stringify(result));
      assert.ok(result.error.reason);
    }
    assert.equal(published, phase === 'published');
    if (phase === 'staging' || phase === 'rename-fail' || phase === 'published') assert.equal(staged, true);
    const expected = phase === 'target' ? Buffer.from('FOREIGN TARGET')
      : ['published', 'target-link', 'target-hardlink', 'source-target'].includes(phase) ? originalSource : Buffer.from('KEEP');
    assert.deepEqual(await h.fs.readFile(target), expected);
    if (phase === 'published') {
      assert.equal(result.error.reason, 'txt_context_stale');
      assert.equal(result.error.details.exported, true);
      assert.equal(result.error.details.outPath, target);
      assert.equal(result.error.details.bytesWritten, originalSource.length);
    } else assert.notEqual(result.error?.details?.exported, true);
    assert.equal(h.main.statuses().some(args => args.includes(mode === 'selected'
      ? 'TXT выбранных сцен экспортирован' : 'TXT всех сцен экспортирован')), false);
    assert.deepEqual(await h.fs.readFile(h.scene), phase === 'source'
      ? Buffer.concat([originalSource, Buffer.from(' NEW SOURCE')]) : originalSource);
    assert.deepEqual(await h.fs.readFile(h.manifestPath), phase === 'manifest'
      ? Buffer.concat([originalManifest, Buffer.from('\n')]) : originalManifest);
  });
});

test('actual Main TXT retains committed effect when actual lease cleanup fails', async t => {
  const path = require('node:path');
  for (const mode of ['selected', 'all']) for (const phase of ['unlink', 'directory']) await t.test(mode + ':' + phase, async t => {
    const h = await pdfMainFixture(t), target = path.join(h.root, 'cleanup.txt'), source = await h.fs.readFile(h.scene);
    await h.fs.writeFile(target, 'KEEP');
    const query = await h.main.txtQuery(); h.main.prepareTxt();
    const rename = h.fs.rename, unlink = h.fs.unlink, rmdir = h.fs.rmdir;
    let published = false, injected = false;
    h.fs.rename = async function (from, to) {
      const value = await rename.call(this, from, to); if (to === target) published = true; return value;
    };
    const fail = file => {
      if (!published || injected || !String(file).startsWith(h.root + path.sep)) return;
      injected = true;
      throw Object.assign(Error('TXT_LEASE_FINALIZATION_' + phase), { code: 'EACCES',
        ...(phase === 'directory' ? { reason: 'txt_lease_directory_finalize_denied' } : {}) });
    };
    h.fs.unlink = async function (file, ...args) { if (phase === 'unlink') fail(file); return unlink.call(this, file, ...args); };
    h.fs.rmdir = async function (file, ...args) { if (phase === 'directory') fail(file); return rmdir.call(this, file, ...args); };
    let result;
    try { result = mode === 'selected'
      ? await h.main.txtSelected({ confirmed: true, requestId: query.scope.requestId,
        selectedSceneIds: query.scope.sceneCandidates.map(c => c.sceneId), outPath: target })
      : await h.main.txtAll({ outPath: target }); }
    finally { h.fs.rename = rename; h.fs.unlink = unlink; h.fs.rmdir = rmdir; }
    assert.equal(published, true); assert.equal(injected, true);
    assert.equal(result.ok, false);
    assert.deepEqual(await h.fs.readFile(target), source);
    assert.equal(result.error.reason, phase === 'directory' ? 'txt_lease_directory_finalize_denied' : 'txt_write_failed');
    assert.equal(result.error.details.exported, true);
    assert.equal(result.error.details.outPath, target);
    assert.equal(result.error.details.bytesWritten, source.length);
    assert.equal(h.main.statuses().some(args => args.includes(mode === 'selected'
      ? 'TXT выбранных сцен экспортирован' : 'TXT всех сцен экспортирован')), false);
  });
});

test('actual Main TXT rejects malformed raw manifests and source UTF8 without changing protected bytes', async t => {
  const path = require('node:path');
  for (const phase of ['future-manifest', 'invalid-project', 'invalid-manifest-utf8', 'invalid-source-utf8']) await t.test(phase, async t => {
    const h = await pdfMainFixture(t), target = path.join(h.root, 'invalid.txt');
    await h.fs.writeFile(target, 'KEEP');
    if (phase === 'future-manifest') await h.fs.writeFile(h.manifestPath, JSON.stringify({ ...h.manifest, schemaVersion: 999 }));
    if (phase === 'invalid-project') await h.fs.writeFile(h.manifestPath, JSON.stringify({ ...h.manifest, projectId: null }));
    if (phase === 'invalid-manifest-utf8') await h.fs.writeFile(h.manifestPath, Buffer.from([0xff, 0xfe]));
    if (phase === 'invalid-source-utf8') await h.fs.writeFile(h.scene, Buffer.from([0xff, 0xfe]));
    const source = await h.fs.readFile(h.scene), manifest = await h.fs.readFile(h.manifestPath);
    let dialog = false; h.main.prepareTxt({ dialog: () => { dialog = true; } });
    const result = await h.main.txtAll({ outPath: target });
    assert.equal(result.ok, false, JSON.stringify(result)); assert.equal(dialog, false);
    assert.equal(await h.fs.readFile(target, 'utf8'), 'KEEP');
    assert.deepEqual(await h.fs.readFile(h.scene), source);
    assert.deepEqual(await h.fs.readFile(h.manifestPath), manifest);
  });
});


test('actual Main TXT refuses changed target bytes when the filesystem preserves all version metadata', async t => {
  const path = require('node:path');
  for (const mode of ['selected', 'all']) for (const phase of ['queued', 'staging']) await t.test(mode + ':' + phase, async t => {
    const h = await pdfMainFixture(t), target = path.join(h.root, 'coarse-target.txt');
    await h.fs.writeFile(target, 'KEEP');
    const version = await h.fs.lstat(target, { bigint: true }), source = await h.fs.readFile(h.scene);
    const lstat = h.fs.lstat, open = h.fs.open, write = h.fs.writeFile;
    let changed = false, reached = false;
    // Real ExFAT demonstrates this metadata view. Keep the byte I/O real on every CI filesystem.
    h.fs.lstat = async function (file, ...args) {
      if (changed && file === target) return version;
      return lstat.call(this, file, ...args);
    };
    h.fs.open = async function (file, flags, ...args) {
      const handle = await open.call(this, file, flags, ...args);
      if (file === target && flags === 'r') {
        const readStat = handle.stat.bind(handle);
        handle.stat = async (...options) => changed ? version : readStat(...options);
      }
      return handle;
    };
    const foreignWrite = async () => {
      const handle = await open.call(h.fs, target, 'r+');
      try { await handle.write('NEXT', 0, 'utf8'); } finally { await handle.close(); }
      changed = true; reached = true;
      assert.equal(await h.fs.readFile(target, 'utf8'), 'NEXT');
    };
    h.fs.writeFile = async function (file, ...args) {
      const value = await write.call(this, file, ...args);
      if (phase === 'staging' && String(file).startsWith(target + '.') && String(file).endsWith('.tmp')) await foreignWrite();
      return value;
    };
    const query = await h.main.txtQuery();
    h.main.prepareTxt({ queued: async () => { if (phase === 'queued') await foreignWrite(); } });
    let result;
    try { result = mode === 'selected'
      ? await h.main.txtSelected({ confirmed: true, requestId: query.scope.requestId,
        selectedSceneIds: query.scope.sceneCandidates.map(c => c.sceneId), outPath: target })
      : await h.main.txtAll({ outPath: target }); }
    finally { h.fs.lstat = lstat; h.fs.open = open; h.fs.writeFile = write; }
    assert.equal(reached, true);
    assert.equal(result.ok, false, JSON.stringify(result));
    assert.equal(result.error.reason, 'txt_context_stale');
    assert.notEqual(result.error.details?.exported, true);
    assert.equal(await h.fs.readFile(target, 'utf8'), 'NEXT');
    assert.deepEqual(await h.fs.readFile(h.scene), source);
    assert.equal(h.main.statuses().some(args => args.includes(mode === 'selected'
      ? 'TXT выбранных сцен экспортирован' : 'TXT всех сцен экспортирован')), false);
  });
});


test('actual Main TXT streams target versions with bounded reads and rejects growth or truncation', async t => {
  const path = require('node:path');
  for (const phase of ['stable', 'grow', 'truncate']) await t.test(phase, async t => {
    const h = await pdfMainFixture(t), target = path.join(h.root, 'streamed-target.txt');
    const original = Buffer.alloc(64 * 1024 + 8, 'x');
    await h.fs.writeFile(target, original);
    const version = await h.fs.lstat(target, { bigint: true }), source = await h.fs.readFile(h.scene);
    const open = h.fs.open, lstat = h.fs.lstat;
    let injected = false, reads = 0, largestRead = 0;
    h.fs.lstat = async function (file, ...args) { return file === target ? version : lstat.call(this, file, ...args); };
    h.fs.open = async function (file, flags, ...args) {
      const handle = await open.call(this, file, flags, ...args);
      if (file === target && flags === 'r') {
        const read = handle.read.bind(handle);
        handle.stat = async () => version;
        handle.read = async function (buffer, offset, length, position) {
          reads++; largestRead = Math.max(largestRead, length);
          const value = await read(buffer, offset, length, position);
          if (!injected && value.bytesRead && phase !== 'stable') {
            injected = true;
            const writer = await open.call(h.fs, target, phase === 'grow' ? 'a' : 'r+');
            try { if (phase === 'grow') await writer.write('GROW'); else await writer.truncate(0); }
            finally { await writer.close(); }
          }
          return value;
        };
      }
      return handle;
    };
    h.main.prepareTxt();
    let result;
    try { result = await h.main.txtAll({ outPath: target }); }
    finally { h.fs.open = open; h.fs.lstat = lstat; }
    assert.ok(reads > 1); assert.ok(largestRead > 0 && largestRead <= 64 * 1024);
    if (phase === 'stable') {
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.deepEqual(await h.fs.readFile(target), source);
    } else {
      assert.equal(injected, true); assert.equal(result.ok, false);
      assert.notEqual(result.error.details?.exported, true);
      assert.deepEqual(await h.fs.readFile(target), phase === 'grow' ? Buffer.concat([original, Buffer.from('GROW')]) : Buffer.alloc(0));
    }
    assert.deepEqual(await h.fs.readFile(h.scene), source);
  });
});


test('actual Main Markdown exports the saved current scene and preserves cancel and legacy in-memory semantics', async t => {
  const path = require('node:path');
  for (const kind of ['create', 'replace', 'cancel']) await t.test(kind, async t => {
    const h = await pdfMainFixture(t), target = path.join(h.root, 'saved.md');
    const source = await h.fs.readFile(h.scene), manifest = await h.fs.readFile(h.manifestPath);
    const original = Buffer.from('Existing external Markdown Ω');
    if (kind !== 'create') await h.fs.writeFile(target, original);
    let dialogs = 0;
    h.main.prepareMarkdown({target, cancel:kind === 'cancel', dialog:()=>{dialogs++;}});
    const result = await h.main.markdown();
    assert.equal(result.ok, 1, JSON.stringify(result));
    assert.equal(dialogs, 1);
    assert.equal(result.canceled, kind === 'cancel');
    assert.equal(result.exported, kind !== 'cancel');
    assert.equal(result.canonicalSavedSceneSource, true);
    assert.equal(result.outPath, undefined);
    assert.equal(result.snapshotPath, undefined);
    assert.equal(JSON.stringify(result).includes(h.root), false);
    assert.deepEqual(await h.fs.readFile(target), kind === 'cancel' ? original : Buffer.concat([source, Buffer.from('\n')]));
    assert.deepEqual(await h.fs.readFile(h.scene), source);
    assert.deepEqual(await h.fs.readFile(h.manifestPath), manifest);
    assert.equal(result.snapshotCreated, kind === 'replace');
    if (kind === 'replace') {
      const files = await h.fs.readdir(h.root, {recursive:true});
      const snapshots = [];
      for (const relative of files) {
        const file = path.join(h.root, relative);
        if ((await h.fs.lstat(file)).isFile() && file !== target
          && (await h.fs.readFile(file)).equals(original)) snapshots.push(relative);
      }
      assert.equal(snapshots.length, 1, 'the previous external bytes have one readable recovery snapshot');
    }
    const legacy = await h.main.markdownLegacy({scene:{schemaVersion:'markdown-scene.v1',blocks:[{type:'paragraph',text:'Legacy literal'}]}});
    assert.equal(legacy.ok, 1);
    assert.equal(legacy.markdown, 'Legacy literal\n');
    assert.equal(legacy.bytesWritten, 0);
    assert.equal(dialogs, 1, 'pure serialization opens no Save As');
  });
});

test('actual Main Markdown refuses stale source and command context after dialog, queue and staging', async t => {
  const path = require('node:path');
  const kinds = ['project','document','session','owner','window','generation','dirty','autosave','capability','source-bytes','manifest-bytes'];
  for (const boundary of ['dialog','queued','staging']) for (const kind of kinds) await t.test(`${boundary}:${kind}`, async t => {
    const h = await pdfMainFixture(t), target = path.join(h.root, 'keep.md');
    const original = Buffer.from('Keep existing target é 東京');
    await h.fs.writeFile(target, original);
    let source = await h.fs.readFile(h.scene), manifest = await h.fs.readFile(h.manifestPath), calls = 0;
    const mutate = async () => {
      calls++;
      if (kind === 'source-bytes') {source=Buffer.from('New saved source Ω');await h.fs.writeFile(h.scene,source);}
      else if (kind === 'manifest-bytes') {manifest=Buffer.from(JSON.stringify({...h.manifest,projectName:'Renamed'}));await h.fs.writeFile(h.manifestPath,manifest);}
      else h.main.mutate(kind);
    };
    h.main.prepareMarkdown({target,[boundary]:mutate});
    const result = await h.main.markdown();
    assert.equal(calls, 1, 'the real awaited boundary was reached');
    assert.equal(result.ok, 0, JSON.stringify(result));
    assert.equal(result.error.reason, kind === 'capability' ? 'markdown_capability_denied' : 'markdown_context_stale');
    assert.deepEqual(await h.fs.readFile(target), original);
    assert.deepEqual(await h.fs.readFile(h.scene), source);
    assert.deepEqual(await h.fs.readFile(h.manifestPath), manifest);
    assert.equal(JSON.stringify(result).includes(h.root), false);
    assert.equal((await h.fs.readdir(h.root)).some(name=>name.startsWith('.keep.md.tmp.')),false);
  });
});

test('actual Main Markdown loss confirmation remains cancel-default and cannot publish a stale confirmed scene', async t => {
  const path = require('node:path'), {pathToFileURL} = require('node:url');
  const envelope = await import(pathToFileURL(path.resolve(__dirname, '../../src/renderer/documentContentEnvelope.mjs')).href);
  for (const kind of ['cancel','accept','stale']) await t.test(kind, async t => {
    const h = await pdfMainFixture(t), target = path.join(h.root, 'loss.md');
    const content = envelope.composeObservablePayload({doc:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Visible é 東京',marks:[{type:'underline'}]}]}]}});
    await h.fs.writeFile(h.scene, content);
    const original = Buffer.from('Existing loss target');await h.fs.writeFile(target,original);
    let warnings = 0, dialogs = 0;
    h.main.prepareMarkdown({target,lossCancel:kind==='cancel',dialog:()=>{dialogs++;},loss:()=>{warnings++;if(kind==='stale')h.main.mutate('generation');}});
    const result = await h.main.markdown();
    assert.equal(warnings, 1);
    if (kind === 'stale') {
      assert.equal(result.ok, 0, JSON.stringify(result));
      assert.equal(result.error.reason,'markdown_context_stale');
      assert.equal(dialogs,0);
    } else {
      assert.equal(result.ok,1,JSON.stringify(result));
      assert.equal(result.canceled,kind==='cancel');
      assert.equal(result.lossReport.count,1);
      assert.equal(dialogs,kind==='accept'?1:0);
    }
    assert.deepEqual(await h.fs.readFile(target),kind==='accept'?Buffer.from('Visible é 東京\n'):original);
    assert.equal(await h.fs.readFile(h.scene,'utf8'),content);
  });
});

test('actual Main Markdown rejects renderer IR external publication without its private saved-scene capture', async t => {
  const h = await pdfMainFixture(t);let dialogs=0;
  h.main.prepareMarkdown({target:require('node:path').join(h.root,'denied.md'),dialog:()=>{dialogs++;}});
  const result=await h.main.markdownLegacy({scene:{schemaVersion:'markdown-scene.v1',blocks:[{type:'paragraph',text:'Renderer-owned'}]},saveAs:true});
  assert.equal(result.ok,0);
  assert.equal(result.error.reason,'canonical_saved_scene_capture_required');
  assert.equal(dialogs,0);
  await assert.rejects(h.fs.stat(require('node:path').join(h.root,'denied.md')), {code:'ENOENT'});
});


test('actual Main Markdown target binding rejects foreign bytes with identical metadata and during final source validation', async t => {
  const path = require('node:path');
  for (const boundary of ['queued','staging','final-source-read']) await t.test(boundary, async t => {
    const h=await pdfMainFixture(t),target=path.join(h.root,'foreign.md');
    const original=Buffer.alloc(128*1024+17,75),foreign=Buffer.alloc(original.length,78);
    await h.fs.writeFile(target,original);
    const source=await h.fs.readFile(h.scene),manifest=await h.fs.readFile(h.manifestPath);
    const baseline=await h.fs.lstat(target,{bigint:true});
    const lstat=h.fs.lstat,open=h.fs.open,readFile=h.fs.readFile;
    let changed=false,armed=false,reads=0,stats=0;
    h.fs.lstat=async(file,options)=>{
      const actual=await lstat(file,options);
      if(file===target&&options?.bigint){stats++;return baseline;}
      return actual;
    };
    h.fs.open=async(...args)=>{
      const handle=await open(...args);
      if(args[0]===target&&args[1]==='r'){
        const stat=handle.stat.bind(handle);
        handle.stat=async options=>options?.bigint?baseline:stat(options);
        const read=handle.read.bind(handle);
        handle.read=async(...values)=>{reads++;return read(...values);};
      }
      return handle;
    };
    const change=async()=>{assert.equal(changed,false);await h.fs.writeFile(target,foreign);changed=true;};
    h.fs.readFile=async(...args)=>{
      const result=await readFile(...args);
      if(armed&&args[0]===h.manifestPath){armed=false;await change();}
      return result;
    };
    t.after(()=>{h.fs.lstat=lstat;h.fs.open=open;h.fs.readFile=readFile;});
    h.main.prepareMarkdown({target,...(boundary==='final-source-read'?{staging:()=>{armed=true;}}:{[boundary]:change})});
    const result=await h.main.markdown();
    assert.equal(changed,true,'foreign write happened at the requested real boundary');
    assert.equal(result.ok,0,JSON.stringify(result));
    assert.equal(result.error.reason,'markdown_context_stale');
    assert.deepEqual(await readFile(target),foreign,'foreign bytes must survive even when all six identity fields match');
    assert.deepEqual(await readFile(h.scene),source);
    assert.deepEqual(await readFile(h.manifestPath),manifest);
    assert.ok(stats>=2 && reads>=4,'actual target descriptors streamed more than two 64KiB blocks');
  });
});

test('actual Main Markdown refuses replaced target, parent, symlink and hard-link before publication', async t => {
  const path=require('node:path');
  for(const kind of ['target','parent','symlink','hardlink']) await t.test(kind,async t=>{
    const h=await pdfMainFixture(t),parent=path.join(h.root,'exports'),target=path.join(parent,'keep.md');
    await h.fs.mkdir(parent);await h.fs.writeFile(target,'ORIGINAL');
    const foreign=path.join(h.root,'foreign.md');await h.fs.writeFile(foreign,'FOREIGN');
    h.main.prepareMarkdown({target,staging:async()=>{
      if(kind==='parent'){
        await h.fs.rename(parent,parent+'-old');await h.fs.mkdir(parent);await h.fs.writeFile(target,'FOREIGN');
      }else{
        await h.fs.unlink(target);
        if(kind==='target')await h.fs.writeFile(target,'FOREIGN');
        else if(kind==='symlink')await h.fs.symlink(foreign,target);
        else await h.fs.link(foreign,target);
      }
    }});
    const result=await h.main.markdown();
    assert.equal(result.ok,0,JSON.stringify(result));
    assert.match(result.error.reason,/^(markdown_context_stale|EXTERNAL_TARGET_)/u);
    assert.equal(await h.fs.readFile(target,'utf8'),'FOREIGN');
    assert.equal(await h.fs.readFile(foreign,'utf8'),'FOREIGN');
    if(kind==='parent')assert.equal(await h.fs.readFile(path.join(parent+'-old','keep.md'),'utf8'),'ORIGINAL');
  });
});

test('actual Main Markdown retains its observed committed outcome if lease finalization fails',async t=>{
  const h=await pdfMainFixture(t),target=require('node:path').join(h.root,'committed.md');
  const source=await h.fs.readFile(h.scene);let finalizations=0;
  h.main.prepareMarkdown({target,finalize:async()=>{finalizations++;throw Object.assign(Error('lease finalization test'),{code:'E_TEST_AFTER_PUBLICATION',reason:'test_after_publication'});}});
  const result=await h.main.markdown();
  assert.equal(finalizations,1);
  assert.equal(result.ok,1,JSON.stringify(result));
  assert.equal(result.exported,true);
  assert.equal(result.completionWarning.code,'E_MD_EXPORT_POST_PUBLICATION_FAILURE');
  assert.equal(result.completionWarning.reason,'export_committed_followup_failed');
  assert.deepEqual(await h.fs.readFile(target),Buffer.concat([source,Buffer.from('\n')]));
  assert.deepEqual(await h.fs.readFile(h.scene),source);
  assert.equal(JSON.stringify(result).includes(h.root),false);
});
