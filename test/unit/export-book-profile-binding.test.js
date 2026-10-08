const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const vm = require('node:vm');

function read(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

async function loadModules() {
  const root = process.cwd();
  const registry = await import(pathToFileURL(path.join(root, 'src', 'renderer', 'commands', 'registry.mjs')).href);
  const runner = await import(pathToFileURL(path.join(root, 'src', 'renderer', 'commands', 'runCommand.mjs')).href);
  const project = await import(pathToFileURL(path.join(root, 'src', 'renderer', 'commands', 'projectCommands.mjs')).href);
  const bookProfile = await import(pathToFileURL(path.join(root, 'src', 'core', 'bookProfile.mjs')).href);
  const docxPageSetupBind = await import(pathToFileURL(path.join(root, 'src', 'docxPageSetupBind.mjs')).href);
  return {
    createCommandRegistry: registry.createCommandRegistry,
    createCommandRunner: runner.createCommandRunner,
    COMMAND_IDS: project.COMMAND_IDS,
    registerProjectCommands: project.registerProjectCommands,
    bookProfile,
    docxPageSetupBind,
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

test('export book profile binding: canonical normalized bookProfile drives distinct DOCX page setup outputs', async () => {
  const { bookProfile, docxPageSetupBind } = await loadModules();

  const portraitProfile = bookProfile.createDefaultBookProfile({
    profileId: 'stage04-export-proof-portrait',
    formatId: 'A5',
    marginTopMm: 20,
    marginRightMm: 18,
    marginBottomMm: 22,
    marginLeftMm: 18,
  });
  const portraitNormalized = bookProfile.normalizeBookProfile(portraitProfile);
  assert.equal(portraitNormalized.ok, true);
  assert.deepEqual(portraitNormalized.value, portraitProfile);

  const portraitSetup = docxPageSetupBind.buildDocxPageSetup(portraitNormalized.value);
  assert.deepEqual(portraitSetup, {
    orientation: 'portrait',
    pageWidthTwips: 8391,
    pageHeightTwips: 11906,
    marginTopTwips: 1134,
    marginRightTwips: 1020,
    marginBottomTwips: 1247,
    marginLeftTwips: 1020,
    headerTwips: 720,
    footerTwips: 720,
    gutterTwips: 0,
  });
  assert.equal(
    docxPageSetupBind.buildDocxSectionPropertiesXml(portraitNormalized.value),
    '<w:sectPr><w:pgSz w:w="8391" w:h="11906"/><w:pgMar w:top="1134" w:right="1020" w:bottom="1247" w:left="1020" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>',
  );

  const landscapeProfile = bookProfile.createDefaultBookProfile({
    profileId: 'stage04-export-proof-landscape',
    formatId: 'A5',
    orientation: 'landscape',
    marginTopMm: 20,
    marginRightMm: 18,
    marginBottomMm: 22,
    marginLeftMm: 18,
  });
  const landscapeNormalized = bookProfile.normalizeBookProfile(landscapeProfile);
  assert.equal(landscapeNormalized.ok, true);
  assert.deepEqual(landscapeNormalized.value, landscapeProfile);

  const landscapeSetup = docxPageSetupBind.buildDocxPageSetup(landscapeNormalized.value);
  assert.deepEqual(landscapeSetup, {
    orientation: 'landscape',
    pageWidthTwips: 11906,
    pageHeightTwips: 8391,
    marginTopTwips: 1134,
    marginRightTwips: 1020,
    marginBottomTwips: 1247,
    marginLeftTwips: 1020,
    headerTwips: 720,
    footerTwips: 720,
    gutterTwips: 0,
  });
  assert.equal(
    docxPageSetupBind.buildDocxSectionPropertiesXml(landscapeNormalized.value),
    '<w:sectPr><w:pgSz w:w="11906" w:h="8391" w:orient="landscape"/><w:pgMar w:top="1134" w:right="1020" w:bottom="1247" w:left="1020" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>',
  );
});

test('export book profile binding: invalid bookProfile fails closed instead of falling back to A4', async () => {
  const { docxPageSetupBind } = await loadModules();

  assert.throws(
    () => docxPageSetupBind.buildDocxPageSetup(null),
    /E_DOCX_BOOK_PROFILE_INVALID:E_BOOK_PROFILE_OBJECT/u,
  );
  assert.throws(
    () => docxPageSetupBind.buildDocxSectionPropertiesXml({ formatId: 'UNKNOWN' }),
    /E_DOCX_BOOK_PROFILE_INVALID:E_PAGE_FORMAT_ID/u,
  );
});

test('export book profile binding: backend delegates section setup to the fail-closed bind layer', () => {
  const builderSource = read('src/export/docx/docxMinBuilder.js');
  const bindSource = read('src/docxPageSetupBind.mjs');

  assert.equal(
    builderSource.includes('deps.docxPageSetupBindModule.buildDocxSectionPropertiesXml(snapshot.bookProfile)'),
    true,
  );
  assert.equal(bindSource.includes('roundTwips(210)'), false);
  assert.equal(bindSource.includes('roundTwips(297)'), false);
});

test('export book profile binding: actual main snapshot resolves absent default and preserves explicit profile validation', async t => {
  const { bookProfile, docxPageSetupBind } = await loadModules();
  const main = read('src/main.js');
  const start = main.indexOf('async function readCanonicalExportSnapshot(payload = {})');
  const end = main.indexOf('async function persistProjectManifestAtPath', start);
  assert.ok(start >= 0 && end > start);
  const envelope = require('../../src/core/document-content-envelope-v1.cjs');
  const { normalizeEditorSnapshotPayload } = require('../../src/export/docx/docxMinBuilder.js');
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Saved scene' }] }] };
  const content = envelope.composeObservablePayload({ text: 'Saved scene', doc });
  const projectRoot = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'export-profile-binding-'));
  t.after(() => fs.rmSync(projectRoot, { recursive: true, force: true }));
  const scenePath = path.join(projectRoot, 'scene.txt'), manifestPath = path.join(projectRoot, 'project.craftsman.json');
  let manifest = {};
  const context = vm.createContext({
    JSON,
    require: require('node:module').createRequire(path.join(process.cwd(), 'src/main.js')),
    currentFilePath: scenePath, isDirty: false,
    isAllowedFilePath: () => true,
    isPlainObjectValue: value => Boolean(value && typeof value === 'object' && !Array.isArray(value)),
    fs: { readFile: async file => {
      if (file === scenePath) return content;
      assert.equal(file, manifestPath);
      return JSON.stringify(manifest);
    } },
    resolveProjectBindingForFile: async () => { throw Error('Export must not normalize or write the manifest'); },
    isPathInside: require('../../src/core/io/path-boundary').isPathInsideBoundary,
    getProjectManifestPath: () => manifestPath,
    currentProjectName: 'Project', DEFAULT_PROJECT_NAME: 'Project',
    loadBookProfileModule: async () => bookProfile,
    loadDocumentContentEnvelopeModule: async () => envelope,
    verifyDocxMediaAssetFiles: async () => {},
    getProjectRootPath: () => projectRoot, normalizeEditorSnapshotPayload,
  });
  vm.runInContext(main.slice(start, end), context);
  const snapshot = await context.readCanonicalExportSnapshot({});
  assert.deepEqual(snapshot.bookProfile, bookProfile.createDefaultBookProfile());
  assert.equal(snapshot.plainText, 'Saved scene');
  assert.deepEqual(manifest, {}, 'export must not persist a project default');
  assert.match(docxPageSetupBind.buildDocxSectionPropertiesXml(snapshot.bookProfile), /w:w="11906" w:h="16838"/u);
  manifest = { bookProfile: { formatId: 'A5' } };
  assert.deepEqual((await context.readCanonicalExportSnapshot({})).bookProfile, manifest.bookProfile);
  const override = { formatId: 'A4' };
  assert.equal((await context.readCanonicalExportSnapshot({ options: { bookProfile: override } })).bookProfile, override);
  for (const invalid of [null, [], 'A4', 42]) {
    await assert.rejects(context.readCanonicalExportSnapshot({ options: { bookProfile: invalid } }), /E_BOOK_PROFILE_OBJECT/u);
    manifest = { bookProfile: invalid };
    await assert.rejects(context.readCanonicalExportSnapshot({}), /E_BOOK_PROFILE_OBJECT/u);
  }
  for (const invalid of [null, [], 'invalid manifest']) {
    manifest = invalid;
    await assert.rejects(context.readCanonicalExportSnapshot({}), /E_DOCX_PROJECT_MANIFEST_INVALID/u);
  }
  for (const invalid of [{ formatId: 'UNKNOWN' }, { formatId: 'A4', marginLeftMm: -1 }]) {
    const explicit = await context.readCanonicalExportSnapshot({ options: { bookProfile: invalid } });
    assert.throws(() => docxPageSetupBind.buildDocxSectionPropertiesXml(explicit.bookProfile), /E_DOCX_BOOK_PROFILE_INVALID/u);
    manifest = { bookProfile: invalid };
    const persisted = await context.readCanonicalExportSnapshot({});
    assert.throws(() => docxPageSetupBind.buildDocxSectionPropertiesXml(persisted.bookProfile), /E_DOCX_BOOK_PROFILE_INVALID/u);
  }
  // Note resolution follows the snapshot: execute the whole handler to catch a
  // second manifest-normalizing writer after the initial read-only boundary.
  let writes = 0;
  const profile = require('../../src/core/writer-local-profile-v1.cjs');
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  Object.assign(context, {
    path, Buffer, autoSaveInProgress: false,
    activeStage10ApplicationBootstrap: {}, lastSignaledEditGeneration: 0,
    getWriterLocalRuntimeProfile: () => profile.createWriterLocalProfileProjection({ isPackaged: false, platform: process.platform }),
    evaluateWriterLocalCommandAccess: profile.evaluateWriterLocalCommandAccess,
    getProductCommandRecord: require('../../src/shared/productCommandRegistry.cjs').getProductCommandRecord,
    ...require('../../src/core/entitlement-law-v1.cjs'),
    ...require('../../src/export/docx/docxReviewPacketComments.js'),
    loadRevisionBridgeModule: async () => bridge,
    fsSync: { readFileSync: file => {
      if (file === scenePath) return content;
      if (file === manifestPath) return JSON.stringify(manifest);
      assert.ok([path.join(projectRoot, 'notes.craftsman.json'), path.join(projectRoot, '.yalken', 'word-review', 'non-text-return-state.v1.json')].includes(file));
      throw Object.assign(new Error('Absent fixture annotation state'), { code: 'ENOENT' });
    } },
    currentLifecycleSubjectId: () => 'life',
    readReviewExactTextApplyProjectBinding: async () => ({ ok: true, projectId: 'project', projectRoot, manifestPath, manifest: { projectId: 'project' } }),
    readCanonicalNotesForDocxExport: async () => undefined,
    runDocxMinExport: require('../../src/export/docx/docxMinExportHandler.js').runDocxMinExport,
    normalizeExportPayload: value => value,
    makeTypedExportError: (code, reason, details) => ({ ok: 0, error: { code, reason, details } }),
    buildPathBoundaryDetails: error => error,
    resolveDocxExportPath: async () => '/out/export.docx',
    validateDocxExportTarget: async () => ({ ok: true }),
    buildDocxMinBuffer: snapshot => Buffer.from(docxPageSetupBind.buildDocxSectionPropertiesXml(snapshot.bookProfile)),
    queueDiskOperation: operation => operation(),
    writeBufferAtomic: async () => { writes++; }, updateStatus: () => {},
  });
  // Actual guards and cohort comparison, with only fixed fixture I/O adapted.
  for (const name of ['userBookmarkCapability', 'readSceneDocxExportCohort', 'assertSceneDocxExportCohort']) {
    const begin = main.indexOf('function ' + name + '('), finish = main.indexOf('\n}\n', begin);
    assert.ok(begin > 0 && finish > begin);
    vm.runInContext(main.slice(begin, finish + 3), context);
  }
  const handlerStart = main.indexOf('async function handleExportDocxMin(payloadRaw)');
  const handlerEnd = main.indexOf('async function handleExportPdf', handlerStart);
  assert.ok(handlerStart > 0 && handlerEnd > handlerStart);
  vm.runInContext(main.slice(handlerStart, handlerEnd), context);
  manifest = {};
  const successfulExport = await context.handleExportDocxMin({});
  assert.equal(successfulExport.ok, 1, JSON.stringify(successfulExport));
  assert.equal(writes, 1);
  for (const invalid of [null, { formatId: 'UNKNOWN' }]) {
    manifest = { bookProfile: invalid };
    const before = JSON.stringify(manifest);
    const result = await context.handleExportDocxMin({});
    assert.equal(result.ok, 0);
    assert.match(result.error.details.message, /E_DOCX_BOOK_PROFILE_INVALID/u);
    assert.equal(JSON.stringify(manifest), before);
    assert.equal(writes, 1);
  }
  context.isDirty = true;
  await assert.rejects(context.readCanonicalExportSnapshot({}), /Unsaved editor state/u);
});

// Counters below observe only Main's synchronous readSource calls. The real
// builder, bridge and their independent Core validations are never replaced.
const scenePerfPending = require('../../src/core/word-pending-text-revisions-v1.cjs');
const scenePerfEnvelope = require('../../src/core/document-content-envelope-v1.cjs');
const scenePerfNotes = require('../../src/core/word-manuscript-notes-v1.cjs');
const scenePerfCrypto = require('node:crypto');
const scenePerfHash = value => scenePerfCrypto.createHash('sha256').update(value).digest('hex');
const scenePerfCopy = value => JSON.parse(JSON.stringify(value));
const scenePerfParagraph = text => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] });

async function scenePerfFixture(t, count = 10, kind = 'schema3') {
  const temp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'scene-export-query-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const root = path.join(temp, 'project'), sceneId = 'roman/scene.txt', projectId = 'scene-export-query-proof';
  const scenePath = path.join(root, sceneId), manifestPath = path.join(root, 'project.craftsman.json');
  const notesPath = path.join(root, 'notes.craftsman.json');
  const commentsPath = path.join(root, '.yalken/word-review/non-text-return-state.v1.json');
  fs.mkdirSync(path.dirname(scenePath), { recursive: true });
  fs.mkdirSync(path.dirname(commentsPath), { recursive: true });
  const union = Array.from({ length: count }, (_, i) => i === 0 ? '!AxxB 🧭 tail' : i === 1 ? ''
    : i === count - 1 ? 'late OLDNEW anchor' : i === 2 ? 'Repeated line' : i === 3 ? 'Repeated line' : `Paragraph ${i} 世界`);
  const source = { type: 'doc', content: union.map(scenePerfParagraph) };
  source.content[2] = { type: 'paragraph', attrs: { wordParagraphSpacing: { before: 60, after: 120 },
    wordParagraphMarkLanguage: { val: 'ru-RU' } }, content: [
    { type: 'text', text: 'Repeated', marks: [{ type: 'bold' }, { type: 'textStyle', attrs: { fontFamily: 'Georgia', fontSize: '14pt' } }] },
    { type: 'hardBreak' }, { type: 'text', text: ' line', marks: [{ type: 'italic' }] }] };
  union[2] = 'Repeated\n line';
  const event = (id, paragraphIndex, from, to, operation, groupId = null) => ({ id: `revision-${id}`, nativeId: String(id),
    operation, author: 'Editor 世界', date: '2026-10-08T08:00:00Z', dateUtc: '2026-10-08T08:00:00Z',
    paragraphIndex, from, to, state: 'pending', groupId });
  const revisions = [event(1, 0, 0, 1, 'insert'), event(2, 0, 2, 4, 'delete'),
    event(3, count - 1, 5, 8, 'delete', 'group-1'), event(4, count - 1, 8, 11, 'insert', 'group-1')];
  const current = union.slice(), original = union.slice();
  current[0] = '!AB 🧭 tail'; current[count - 1] = 'late NEW anchor';
  original[0] = 'AxxB 🧭 tail'; original[count - 1] = 'late OLD anchor';
  const schema = Number(kind.replace('schema', ''));
  let doc = source;
  if ([1, 2, 3, 5].includes(schema)) {
    const ledger = { schemaVersion: schema, source, revisions, undo: [], redo: [],
      ...(schema >= 2 ? { roundUndo: [], roundRedo: [], returnReceipts: [] } : {}),
      ...(schema === 3 ? { noteSourcePoints: [
        { noteId: 'foot-left', paragraphIndex: 0, offsetUtf16: 2 },
        { noteId: 'end-right', paragraphIndex: 0, offsetUtf16: 4 },
        { noteId: 'foot-late', paragraphIndex: count - 1, offsetUtf16: 5 }] } : {}) };
    doc = scenePerfPending.bindLedger(ledger);
  } else { current.splice(0, current.length, ...union); original.splice(0, original.length, ...union); }
  if (kind === 'plain' || kind === 'null') doc = null;
  const raw = doc ? scenePerfEnvelope.composeObservablePayload({ doc, metaEnabled: true,
    meta: { status: 'черновик', synopsis: 'Tiny scene export', tags: {} }, cards: [] }) : union.join(' ').replaceAll('\n', ' ');
  if (!doc) { current.splice(0, current.length, ...raw.split('\n')); original.splice(0, original.length, ...raw.split('\n')); }
  fs.writeFileSync(scenePath, raw);
  const noteBody = label => ({ type: 'doc', content: [{ type: 'paragraph', attrs: {
    wordParagraphSpacing: { before: 0, after: 120 }, wordParagraphMarkLanguage: { val: 'ru-RU' } }, content: [
    { type: 'text', text: label + ' 世界 🧭', marks: [{ type: 'bold' }, { type: 'textStyle', attrs: {
      fontFamily: 'Georgia', fontSize: '14pt', wordLanguage: { val: 'ru-RU', eastAsia: 'ja-JP', bidi: 'he-IL' } } }] },
    { type: 'hardBreak' }, { type: 'text', text: 'Rich ending', marks: [{ type: 'italic' }] }] }, scenePerfParagraph(''), scenePerfParagraph('Final note')] });
  const noteSpecs = [['foot-left', 'footnote', 2], ['end-right', 'endnote', 2],
    ['foot-late', 'footnote', current.slice(0, -1).reduce((n, text) => n + text.length + 1, 0) + 5]];
  const noteRows = schema === 3 ? noteSpecs.map(([id, noteKind, offsetUtf16]) => {
    const body = noteBody(id);
    return { id, title: '', scope: 'manuscript', body: scenePerfNotes.validateNoteBody(body).text, privateMetadata: { preserve: id },
      manuscript: scenePerfNotes.bindManuscriptPayload({ kind: noteKind, body, sceneId, offsetUtf16, sceneContent: raw }) };
  }) : [];
  noteRows.push({ id: 'private-project', title: 'Private', scope: 'project', body: 'PRIVATE_NOTE', custom: { intact: true } });
  const notesStorage = await import('../../src/product/notesStoragePersistence.mjs');
  const notes = notesStorage.normalizeNotesDocument({ schemaVersion: 1, projectId, notes: noteRows },
    { projectId, now: () => '2026-10-08T08:00:00Z' }).value;
  fs.writeFileSync(notesPath, JSON.stringify(notes, null, 2) + '\n');
  const { exactAnchor } = require('../../src/core/word-comment-authoring-v1.cjs');
  const discussion = (id, owner, status, paragraphIndex, startUtf16, selectedText, paragraphs) => ({
    threadId: `thread-${id}`, sceneId: owner, rootCommentId: `root-${id}`, status,
    anchor: exactAnchor({ paragraphIndex, startUtf16, selectedText }, owner, paragraphs), messages: [
      { commentId: `root-${id}`, kind: 'root', body: `Writer ${id} & 世界`, provenance: { author: ' Writer ', initials: 'WR', date: '2026-10-08T08:00:00Z' } },
      { commentId: `reply-${id}`, kind: 'reply', body: 'Editor reply\n尾', provenance: { author: 'Editor' } }] });
  const comments = { schemaVersion: 'yalken.rtk.word.non-text-return-state.v1', projectId, revision: 7, events: [], threads: [
    discussion('tail', sceneId, 'open', 0, current[0].indexOf('tail'), 'tail', current),
    discussion('late', sceneId, 'resolved', current.length - 1, current.at(-1).indexOf('anchor'), 'anchor', current),
    discussion('deleted', sceneId, 'deleted', 0, current[0].indexOf('tail'), 'tail', current),
    discussion('foreign', 'roman/foreign.txt', 'open', 0, 0, 'Foreign', ['Foreign'])] };
  comments.threads.at(-1).messages[0].body = 'PRIVATE_DISCUSSION';
  if (kind === 'no-annotations') { notes.notes = []; comments.threads = []; fs.writeFileSync(notesPath, JSON.stringify(notes)); }
  fs.writeFileSync(commentsPath, JSON.stringify(comments, null, 2) + '\n');
  const { bookProfile, docxPageSetupBind } = await loadModules();
  const manifest = { projectId, revision: 9, bookProfile: bookProfile.createDefaultBookProfile(), privateFields: { unchanged: true } };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const profile = require('../../src/core/writer-local-profile-v1.cjs');
  const builder = require('../../src/export/docx/docxMinBuilder.js');
  const main = read('src/main.js'), counters = { readLedger: 0, noteProjection: 0 };
  let boundary, built, suppliedSource, target = path.join(temp, 'export.docx'), queuedFault, capabilityDenied = false, targetChecks = 0, lifecycle = 'life';
  const files = { scene: scenePath, manifest: manifestPath, notes: notesPath, comments: commentsPath };
  const capture = () => Object.fromEntries(Object.entries(files).map(([name, file]) => [name, fs.readFileSync(file, 'utf8')]));
  const context = vm.createContext({ JSON, Buffer, path, crypto: scenePerfCrypto, fsSync: fs, fs: require('node:fs/promises'),
    require: require('node:module').createRequire(path.join(process.cwd(), 'src/main.js')),
    currentFilePath: scenePath, isDirty: false, autoSaveInProgress: false, activeStage10ApplicationBootstrap: {}, lastSignaledEditGeneration: 0,
    currentProjectName: 'Project', DEFAULT_PROJECT_NAME: 'Project', getProjectRootPath: () => root, getProjectManifestPath: () => manifestPath,
    currentLifecycleSubjectId: () => lifecycle, isAllowedFilePath: file => file === scenePath,
    isPlainObjectValue: value => Boolean(value && typeof value === 'object' && !Array.isArray(value)),
    isPathInside: require('../../src/core/io/path-boundary').isPathInsideBoundary,
    loadBookProfileModule: async () => bookProfile, loadDocumentContentEnvelopeModule: async () => scenePerfEnvelope,
    verifyDocxMediaAssetFiles: async () => {}, normalizeEditorSnapshotPayload: builder.normalizeEditorSnapshotPayload,
    // Fixed project identity adapter only; actual saved manifest cohort remains checked.
    readReviewExactTextApplyProjectBinding: async () => ({ ok: true, projectId, projectRoot: root, manifestPath, manifest: JSON.parse(fs.readFileSync(manifestPath, 'utf8')) }),
    loadNotesStorageModule: async () => notesStorage, loadRevisionBridgeModule: async () => bridge,
    pendingTextRevisions: { ...scenePerfPending,
      readLedger: (...args) => { counters.readLedger++; return scenePerfPending.readLedger(...args); },
      noteProjection: (...args) => { counters.noteProjection++; return scenePerfPending.noteProjection(...args); } },
    manuscriptNoteModel: scenePerfNotes, userBookmarkModel: require('../../src/core/word-user-bookmarks-v1.cjs'),
    commentSceneParagraphs: require('../../src/core/word-comment-anchor-save-v1.cjs').paragraphs,
    buildFormatIrParagraphs: require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js').buildFormatIrParagraphs,
    ...require('../../src/export/docx/docxReviewPacketNotes.js'), ...require('../../src/export/docx/docxReviewPacketComments.js'),
    getWriterLocalRuntimeProfile: () => profile.createWriterLocalProfileProjection({ isPackaged: false, platform: process.platform }),
    // A documented decision fault exercises the unchanged actual capability predicate.
    evaluateWriterLocalCommandAccess: input => capabilityDenied ? { allowed: false } : profile.evaluateWriterLocalCommandAccess(input),
    getProductCommandRecord: require('../../src/shared/productCommandRegistry.cjs').getProductCommandRecord,
    ...require('../../src/core/entitlement-law-v1.cjs'),
    runDocxMinExport: require('../../src/export/docx/docxMinExportHandler.js').runDocxMinExport,
    normalizeExportPayload: value => value, makeTypedExportError: (code, reason, details) => ({ ok: 0, error: { code, reason, details } }),
    buildPathBoundaryDetails: error => error, resolveDocxExportPath: async () => target,
    validateExternalWriteTarget: require('../../src/utils/externalFileAuthority.js').validateExternalWriteTarget,
    loadDocxPageSetupBindModule: async () => docxPageSetupBind,
    loadSemanticMappingModule: () => import('../../src/derived/semanticMapping.mjs'), loadStyleMapModule: () => import('../../src/derived/styleMap.mjs'),
    buildDocxMinBufferCore: builder.buildDocxMinBuffer,
    DOCX_REVIEW_RETURN_INTAKE_FULL_MANUSCRIPT_PRODUCT_BUDGETS: { maxBlocks: 50000, maxWorkerOutputBytes: 64 * 1024 * 1024 },
    queueDiskOperation: async operation => { if (queuedFault) await queuedFault(); return operation(); },
    writeBufferAtomic: require('../../src/export/docx/atomicWriteBuffer.js').writeBufferAtomic, updateStatus: () => {},
  });
  function install(name, asyncFunction = false) {
    const begin = main.indexOf(`${asyncFunction ? 'async ' : ''}function ${name}(`), end = main.indexOf('\n}\n', begin);
    assert.ok(begin >= 0 && end > begin, name); vm.runInContext(main.slice(begin, end + 3), context);
  }
  for (const name of ['stableRtkReviewTransportJson', 'createRtkReviewTransportCryptoPort', 'docxReviewReturnIntakeProductBudgets',
    'userBookmarkCapability', 'readSceneDocxExportCohort', 'assertSceneDocxExportCohort']) install(name);
  for (const name of ['readProjectNotesDocument', 'readCanonicalNotesForDocxExport', 'readCanonicalExportSnapshot', 'validateDocxExportTarget',
    'buildDocxMinBuffer', 'handleExportDocxMin']) install(name, true);
  const actualBuild = context.buildDocxMinBuffer, actualTargetCheck = context.validateDocxExportTarget;
  context.buildDocxMinBuffer = async (snapshot, sourceValue) => {
    boundary = { ...counters }; suppliedSource = scenePerfCopy(sourceValue);
    built = await actualBuild(snapshot, sourceValue); return built;
  };
  context.validateDocxExportTarget = async (...args) => { targetChecks++; return actualTargetCheck(...args); };
  async function execute(label, fault) {
    queuedFault = fault; target = path.join(temp, label + '.docx'); boundary = built = suppliedSource = undefined; targetChecks = 0;
    counters.readLedger = counters.noteProjection = 0;
    const before = capture(), result = await context.handleExportDocxMin({ requestId: label }), after = capture();
    const output = fs.existsSync(target) ? fs.readFileSync(target) : null;
    const parts = built ? bridge.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes: built }).parts : null;
    const parsed = built ? bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes: built }, { cryptoPort: context.createRtkReviewTransportCryptoPort() }) : null;
    const preview = built ? bridge.buildDocxContentPreviewFromZipBytes(built) : null;
    const observation = { label, count, kind, seed: 'scene-query-v1', result, boundary, targetChecks,
      policyDenialQualification: capabilityDenied ? 'POLICY_DECISION_FAULT_INJECTION' : null,
      outputPublished: Boolean(output), diagnostic: context.testCaseDiagnostics, before, after, source: suppliedSource, parsed, preview };
    if (process.env.YALKEN_SCENE_EXPORT_PERF_EVIDENCE) {
      const directory = path.join(process.env.YALKEN_SCENE_EXPORT_PERF_EVIDENCE, label);
      fs.mkdirSync(directory, { recursive: true });
      const entries = [];
      const save = (name, value) => { const data = Buffer.isBuffer(value) ? value : Buffer.from(value); const file = path.join(directory, name);
        fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data, { flag: 'wx' });
        entries.push({ name, path: file, bytes: data.length, sha256: scenePerfHash(data) }); };
      for (const [phase, captured] of Object.entries({ before, after })) for (const [name, value] of Object.entries(captured)) save(`${phase}/${name}.txt`, value);
      save('observation.json', JSON.stringify(observation, null, 2) + '\n');
      save('source-meaning.json', JSON.stringify({ union, current, original, revisions, noteSpecs, source: doc ? source : null }, null, 2) + '\n');
      if (built) save('built.docx', built); if (output) save('published.docx', output);
      for (const [name, value] of Object.entries(parts || {})) save('parts/' + name, value);
      save('files.json', JSON.stringify({ label, count, kind, files: entries }, null, 2) + '\n');
    }
    return { ...observation, output, built, parts };
  }
  return { execute, context, files, capture, scenePath, notesPath, commentsPath, manifestPath, root, doc, notes, comments,
    union, current, original, count, projectId, sceneId, bridge,
    denyCapability: () => { capabilityDenied = true; }, changeLifecycle: () => { lifecycle = 'new-life'; } };
}

function assertScenePerfMeaning(f, observed) {
  assert.equal(observed.result.ok, 1, JSON.stringify(observed.result));
  assert.deepEqual(observed.before, observed.after, 'export must preserve every canonical byte');
  assert.deepEqual(observed.output, observed.built, 'publish the actual verified builder bytes');
  assert.equal(observed.parsed.ok, true, JSON.stringify(observed.parsed));
  assert.equal(observed.preview.ok, true, JSON.stringify(observed.preview));
  const parsedDoc = observed.preview.contentPreview.pendingRevisionDocument;
  assert.equal(scenePerfEnvelope.deriveVisibleTextFromDocument(parsedDoc), f.current.join('\n'));
  assert.equal(scenePerfPending.projection(parsedDoc).original, f.original.join('\n'));
  const ledger = scenePerfPending.readLedger(parsedDoc);
  assert.deepEqual(ledger.revisions.map(({ operation, author, date, groupId, paragraphIndex, from, to }) =>
    ({ operation, author, date, groupId, paragraphIndex, from, to })),
  f.doc.attrs.wordPendingRevisions.revisions.map(({ operation, author, date, groupId, paragraphIndex, from, to }) =>
    ({ operation, author, date, groupId, paragraphIndex, from, to })));
  assert.equal(observed.parsed.reviewIr.commentThreads.length, 2);
  assert.deepEqual(observed.parsed.reviewIr.commentThreads.map(thread => [thread.body, thread.replies[0].body, thread.status, thread.quotedAnchorText]),
    [['Writer tail & 世界', 'Editor reply\n尾', 'ANCHORED', 'tail'], ['Writer late & 世界', 'Editor reply\n尾', 'RESOLVED', 'anchor']]);
  assert.doesNotMatch(Object.values(observed.parts).join('\n'), /PRIVATE_NOTE|PRIVATE_DISCUSSION|thread-deleted/);
  const noteRows = observed.parsed.reviewIr.documentNotes.notes;
  assert.deepEqual(noteRows.map(note => note.kind), ['footnote', 'endnote', 'footnote']);
  const rich = f.bridge.parseDocumentNotesRichReturn(observed.built, observed.parsed.reviewIr.documentNotes);
  assert.deepEqual(rich.map(note => scenePerfNotes.validateNoteBody(note.body).text), f.notes.notes.filter(note => note.manuscript).map(note => note.body));
  for (const note of rich) {
    assert.equal(note.body.content[0].content[0].marks.find(mark => mark.type === 'textStyle').attrs.fontFamily, 'Georgia');
    assert.equal(note.body.content[0].attrs.wordParagraphSpacing.after, 120);
    assert.equal(note.body.content[0].attrs.wordParagraphMarkLanguage.val, 'ru-RU');
  }
}

test('scene export reuses one validated ledger and one note projection with complete tiny DOCX semantics', async t => {
  const observations = [];
  for (const count of [10, 20, 40]) {
    const f = await scenePerfFixture(t, count), result = await f.execute(`schema3-${count}`);
    assertScenePerfMeaning(f, result); observations.push({ count, boundary: result.boundary });
  }
  // All physical/semantic observations above precede the causal old-code RED.
  assert.deepEqual(observations, [10, 20, 40].map(count => ({ count, boundary: { readLedger: 1, noteProjection: 1 } })));
});

for (const kind of ['schema1', 'schema2', 'schema5', 'no-pending', 'plain', 'null', 'no-annotations']) {
  test(`scene export preserves ${kind} schema and annotation gating`, async t => {
    const f = await scenePerfFixture(t, 10, kind), observed = await f.execute('control-' + kind);
    assert.equal(observed.result.ok, 1, JSON.stringify(observed.result)); assert.deepEqual(observed.before, observed.after);
    assert.deepEqual(observed.boundary, { readLedger: kind === 'no-annotations' ? 0 : 1, noteProjection: 0 }); assert.equal(observed.parsed.ok, true);
    assert.equal(observed.parsed.reviewIr.documentNotes?.notes?.length || 0, 0);
    if (kind.startsWith('schema')) assert.equal(scenePerfPending.projection(observed.preview.contentPreview.pendingRevisionDocument).current, f.current.join('\n'));
  });
}

test('scene export refreshes derived queries on a second invocation after canonical changes', async t => {
  const f = await scenePerfFixture(t), first = await f.execute('refresh-first'); assertScenePerfMeaning(f, first);
  const comments = scenePerfCopy(f.comments); comments.revision++; comments.threads[0].messages[0].body = 'Second saved discussion';
  fs.writeFileSync(f.commentsPath, JSON.stringify(comments));
  const ledger = scenePerfCopy(scenePerfPending.readLedger(f.doc)); ledger.revisions[0].author = 'Second saved author';
  fs.writeFileSync(f.scenePath, scenePerfEnvelope.composeObservablePayload({ doc: scenePerfPending.bindLedger(ledger) }));
  const second = await f.execute('refresh-second');
  assert.equal(second.result.ok, 1, JSON.stringify(second.result)); assert.deepEqual(second.before, second.after);
  assert.equal(second.parsed.reviewIr.commentThreads[0].body, 'Second saved discussion');
  const firstLedger = scenePerfPending.readLedger(first.preview.contentPreview.pendingRevisionDocument);
  const secondLedger = scenePerfPending.readLedger(second.preview.contentPreview.pendingRevisionDocument);
  assert.deepEqual(secondLedger.revisions, firstLedger.revisions.map((revision, i) => i === 0 ? { ...revision, author: 'Second saved author' } : revision));
  assert.deepEqual(scenePerfPending.projection(second.preview.contentPreview.pendingRevisionDocument),
    { ...scenePerfPending.projection(first.preview.contentPreview.pendingRevisionDocument), revisions: secondLedger.revisions.map((revision, i) =>
      ({ ...revision, text: scenePerfPending.projection(first.preview.contentPreview.pendingRevisionDocument).revisions[i].text })) });
  assert.deepEqual(second.parsed.reviewIr.documentNotes, first.parsed.reviewIr.documentNotes);
  for (const name of ['word/footnotes.xml', 'word/endnotes.xml']) assert.equal(second.parts[name], first.parts[name]);
  assert.notDeepEqual(second.output, first.output); assert.deepEqual(second.boundary, { readLedger: 1, noteProjection: 1 });
});

for (const fault of ['visible-ledger', 'consumed-note', 'split-surrogate', 'malformed-note', 'malformed-ledger']) {
  test(`scene export publicly refuses ${fault} instead of trusting a hoisted projection`, async t => {
    const f = await scenePerfFixture(t), doc = scenePerfCopy(f.doc), ledger = doc.attrs.wordPendingRevisions;
    if (fault === 'visible-ledger') doc.content[0].content[0].text += 'forged';
    if (fault === 'consumed-note') ledger.noteSourcePoints[0].offsetUtf16 = 3;
    if (fault === 'split-surrogate') ledger.noteSourcePoints[0].offsetUtf16 = 7;
    if (fault === 'malformed-ledger') ledger.revisions[0].author = 17;
    if (fault === 'malformed-note') { const value = scenePerfCopy(f.notes); value.notes[0].manuscript.body.content[0].content[0].text += 'forged'; fs.writeFileSync(f.notesPath, JSON.stringify(value)); }
    else {
      const expected = { 'visible-ledger': 'PENDING_REVISIONS_PROJECTION_MISMATCH', 'consumed-note': 'PENDING_NOTE_REFERENCE_CONSUMED',
        'split-surrogate': 'PENDING_NOTE_POINT_BOUNDARY', 'malformed-ledger': 'PENDING_REVISIONS_INVALID' }[fault];
      let directError;
      assert.throws(() => { try { scenePerfPending.readLedger(doc); } catch (error) { directError = error.code; throw error; } }, new RegExp(expected));
      f.context.testCaseDiagnostics = { fault, expectedDirectCode: expected, actualDirectCode: directError };
      // Deliberately malformed wire bytes must reach the real public reader;
      // the normal serializer correctly refuses these documents before I/O.
      const raw = fs.readFileSync(f.scenePath, 'utf8'), header = raw.match(/\[doc-v2 length=\d+\]\n([^\n]+)/u)[1];
      const serialized = header + '\n' + JSON.stringify(doc);
      fs.writeFileSync(f.scenePath, `[doc-v2 length=${serialized.length}]\n${serialized}`);
    }
    const observed = await f.execute('invalid-' + fault);
    assert.equal(observed.result.ok, 0, JSON.stringify(observed.result)); assert.equal(observed.output, null);
    assert.deepEqual(observed.before, observed.after); assert.equal(observed.result.error.code, 'E_EXPORT_CANONICAL_SOURCE_UNAVAILABLE');
  });
}

for (const fault of ['scene', 'notes', 'comments', 'manifest', 'file', 'root', 'generation', 'lifecycle', 'owner', 'dirty', 'autosave', 'capability', 'target']) {
  test(`scene export retains queued ${fault} publication guard with zero output`, async t => {
    const f = await scenePerfFixture(t);
    const observed = await f.execute('race-' + fault, () => {
      if (['scene', 'notes', 'comments', 'manifest'].includes(fault)) fs.appendFileSync(f.files[fault], ' ');
      if (fault === 'file') f.context.currentFilePath += '.other';
      if (fault === 'root') f.context.getProjectRootPath = () => f.root + '-other';
      if (fault === 'generation') f.context.lastSignaledEditGeneration++;
      if (fault === 'lifecycle') f.changeLifecycle();
      if (fault === 'owner') f.context.activeStage10ApplicationBootstrap = {};
      if (fault === 'dirty') f.context.isDirty = true;
      if (fault === 'autosave') f.context.autoSaveInProgress = true;
      if (fault === 'capability') f.denyCapability();
      if (fault === 'target') f.context.validateExternalWriteTarget = async () => ({ ok: false, reason: 'EXTERNAL_TARGET_FAULT' });
    });
    assert.equal(observed.result.ok, 0, JSON.stringify(observed.result)); assert.equal(observed.output, null);
    assert.ok(observed.built, 'real complete builder must precede the late fault');
    assert.match(JSON.stringify(observed.result), /CHANGED|CAPABILITY_DENIED|TARGET_FAULT/);
    const expected = { ...observed.before };
    if (['scene', 'notes', 'comments', 'manifest'].includes(fault)) expected[fault] += ' ';
    assert.deepEqual(observed.after, expected, 'only the explicitly injected concurrent fault changes business bytes');
  });
}
