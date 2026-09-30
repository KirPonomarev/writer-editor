'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const main = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
function loadFunctions(context) {
  const start = main.includes('function captureFullManuscriptProjectBinding(')
    ? main.indexOf('function captureFullManuscriptProjectBinding(')
    : main.indexOf('async function buildFullManuscriptDocxReviewExportScope()');
  vm.runInContext(main.slice(start, main.indexOf('function validateSelectedScenesTxtExportOutPath(')), context);
}
function harness(defaultPopulated = false) {
  const h = { reads: [], candidates: [], phase: null };
  const context = vm.createContext({ path, DEFAULT_PROJECT_NAME: 'Роман', currentProjectName: 'Active project',
    commentAuthoringSessionId: 'session', activeStage10ApplicationBootstrap: {}, PROJECT_MANIFEST_SCHEMA_VERSION: 1,
    currentLifecycleSubjectId: () => h.subject || 'document:active',
    getProjectRootPath: (name = context.currentProjectName) => '/owned/' + name,
    getProjectManifestPath: (name = context.currentProjectName) => '/owned/' + name + '/project.craftsman.json',
    getProjectSectionPath: (section, name = context.currentProjectName) => '/owned/' + name + '/roman',
    readProjectManifest: async name => { h.reads.push(name); h.phase?.('manifest'); return { sourceSchemaVersion: 1,
      manifest: { projectId: name === 'Роман' ? 'default-id' : 'active-id', projectName: name, createdAtUtc: '2026-09-30T00:00:00Z' } }; },
    fileExists: async folder => { h.phase?.('exists'); return true; },
    collectFullManuscriptDocxReviewExportCandidates: async (folder, binding, out) => {
      h.candidates.push(folder); h.phase?.('enumeration');
      if (!folder.includes('/Роман/') || defaultPopulated) out.push({ sceneId: 'roman/scene.txt', path: folder + '/scene.txt' });
    },
  });
  loadFunctions(context); h.c = context; return h;
}
for (const defaultPopulated of [false, true]) test(`actual full scope binds current project when default populated=${defaultPopulated}`, async () => {
  const h = harness(defaultPopulated), scope = await h.c.buildFullManuscriptDocxReviewExportScope();
  assert.equal(scope.projectId, 'active-id'); assert.equal(scope.projectRoot, '/owned/Active project');
  assert.equal(scope.manifestPath, '/owned/Active project/project.craftsman.json'); assert.equal(scope.sceneCandidates.length, 1);
  assert.deepEqual(h.reads, ['Active project']); assert.deepEqual(h.candidates, ['/owned/Active project/roman']);
});
for (const phase of ['manifest', 'exists', 'enumeration']) for (const mutation of ['project', 'lifecycle', 'session', 'owner']) {
  test(`actual full scope refuses ${mutation} change during ${phase}`, async () => {
    const h = harness(true); h.phase = actual => {
      if (actual !== phase) return;
      if (mutation === 'project') h.c.currentProjectName = 'Other project';
      if (mutation === 'lifecycle') h.subject = 'document:other';
      if (mutation === 'session') h.c.commentAuthoringSessionId = 'other-session';
      if (mutation === 'owner') h.c.activeStage10ApplicationBootstrap = {};
    };
    await assert.rejects(() => h.c.buildFullManuscriptDocxReviewExportScope(), /REVIEW_FULL_MANUSCRIPT_DOCX_EXPORT_PROJECT_STALE/);
  });
}

function exportHarness() {
  const h = harness(true), c = h.c;
  h.authorityActivations = 0; h.artifactWrites = 0; h.keyImports = 0; h.canonicalReads = 0; h.allowed = true;
  const hash = value => require('node:crypto').createHash('sha256').update(value).digest('hex');
  Object.assign(c, { isDirty: false, autoSaveInProgress: false,
    REVIEW_EXPORT_FULL_MANUSCRIPT_DOCX_PACKET_COMMAND_ID: 'cmd.project.review.exportFullManuscriptDocxReviewPacket',
    userBookmarkCapability: () => { if (!h.allowed) throw Error('USER_BOOKMARK_CAPABILITY_DENIED'); },
    docxReviewPreviewSessionDetailString: value => typeof value === 'string' ? value.trim() : '',
    readFullManuscriptDocxReviewExportDocumentContent: async candidate => { h.phase?.('scene'); return { text: 'Active text', doc: { type: 'doc', content: [] }, observableContent: 'Active text' }; },
    verifyDocxMediaAssetFiles: async () => {}, createRtkReviewTransportCryptoPort: () => ({ sha256Text: hash }),
    loadRevisionBridgeModule: async () => ({ createReviewTransportManifestV2() {}, createWordV4CoreManifest() {}, createYrtk2RoundLocatorToken() {},
      createRtkNonTextReturnFilePort: () => ({ readCanonical: async binding => { h.canonicalReads++; h.phase?.(h.canonicalReads === 1 ? 'sourceCanonical' : 'finalCanonical');
        assert.equal(binding.projectId, 'active-id'); assert.equal(binding.projectRoot, '/owned/Active project'); return { threads: [] }; } }) }),
    normalizeDocumentNoteSelections: () => [], readCanonicalNotesForDocxExport: async () => { h.phase?.('notes'); return undefined; },
    buildFullManuscriptDocxReviewPacketSource: input => ({
      input, forbiddenSecret: 'controlled-test-only', commentExport: { projectId: input.projectId, stateDigest: 'empty', threads: [], tombstones: [] },
      exportCapsule: { fullManuscript: true, projectId: input.projectId, sceneCount: input.scenes.length },
      localAuthorityCapsule: { roundId: 'round', projectRoot: input.projectRoot,
        exportMap: { scenes: input.scenes.map(scene => ({ sceneId: scene.sceneId, rawSha256: scene.rawSha256 })) },
        documentMetadata: { protectedProperties: { title: input.projectName, createdAtUtc: input.projectCreatedAtUtc } },
        documentSections: { sourceBindings: [{ groupKey: 'roman', sceneIds: input.scenes.map(scene => scene.sceneId) }] } },
    }),
    importDocxReviewRoundKey: async binding => { h.keyImports++; assert.equal(binding.projectRoot, '/owned/Active project'); h.phase?.('keyImport'); return {}; },
    isPlainObjectValue: value => Boolean(value && typeof value === 'object' && !Array.isArray(value)), cloneJsonSafe: clone,
    REVIEW_DOCX_RETURN_AUTHORITY_STORE_SCHEMA: 'private-test', activeReviewDocxExportAuthorityStore: null,
    notesStateDigest: () => '', commentStateDigest: () => 'empty',
  });
  vm.runInContext(main.slice(main.indexOf('async function readFullManuscriptDocxReviewPacketExportSource('),
    main.indexOf('async function buildDocxReviewPacketBuffer(')), c);
  h.mutate = kind => {
    if (kind === 'project') c.currentProjectName = 'Other project';
    if (kind === 'lifecycle') h.subject = 'document:other';
    if (kind === 'session') c.commentAuthoringSessionId = 'other';
    if (kind === 'owner') c.activeStage10ApplicationBootstrap = {};
    if (kind === 'capability') h.allowed = false;
  };
  h.run = () => require('../../src/export/docx/docxReviewPacketExportHandler.js').runDocxReviewPacketExport({}, {
    normalizeExportPayload: value => value, makeTypedReviewDocxExportError: (code, reason, details) => ({ ok: false, code, reason, details }),
    resolveDocxReviewPacketExportPath: async () => '/external/export.docx', validateDocxExportTarget: async () => ({ ok: true }),
    readDocxReviewPacketExportSource: c.readFullManuscriptDocxReviewPacketExportSource,
    revalidateDocxReviewPacketExportSource: c.revalidateFullManuscriptDocxReviewPacketExportSource,
    buildDocxReviewPacketBuffer: async source => ({ documentBuffer: Buffer.from('controlled-build'), exportCapsule: source.exportCapsule,
      publicationGate: { publishAllowed: true, ok: true, provisionalSelfParse: { verified: true }, finalSelfParse: { semanticEquivalent: true },
        yrtk2Verification: { code: 'RTK_RETURN_INTAKE_YRTK2_VERIFIED' }, commentProofs: [{ ok: true }] } }),
    queueDiskOperation: fn => fn(), writeBufferAtomic: async () => { h.artifactWrites++; }, updateStatus: () => {},
    readWrittenBuffer: async () => Buffer.from('controlled-build'), activateReviewDocxExportAuthority: async () => { h.authorityActivations++; return {}; },
  });
  return h;
}
test('actual full export reader and handler publish only active project source and authority', async () => {
  const h = exportHarness(), result = await h.run(); assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(h.artifactWrites, 1); assert.equal(h.authorityActivations, 1); assert.equal(h.keyImports, 1);
  assert.ok(h.reads.every(name => name === 'Active project'));
});
for (const phase of ['notes', 'sourceCanonical', 'keyImport', 'finalCanonical']) for (const mutation of ['project', 'lifecycle', 'session', 'owner', 'capability']) {
  test(`actual export handler rejects ${mutation} during ${phase} with zero artifact or authority publication`, async () => {
    const h = exportHarness(); h.phase = actual => { if (actual === phase) h.mutate(mutation); };
    const result = await h.run(); assert.equal(result.ok, false, JSON.stringify(result));
    assert.equal(result.details.message, mutation === 'capability' ? 'USER_BOOKMARK_CAPABILITY_DENIED' : 'REVIEW_FULL_MANUSCRIPT_DOCX_EXPORT_PROJECT_STALE');
    assert.equal(h.artifactWrites, 0); assert.equal(h.authorityActivations, 0);
    if (phase !== 'keyImport' && phase !== 'finalCanonical') assert.equal(h.keyImports, 0);
    if (phase !== 'finalCanonical') assert.equal(h.c.activeReviewDocxExportAuthorityStore, null);
  });
}
for (const invalid of ['future', 'missing', 'projectId', 'inactive']) test(`actual project scope rejects ${invalid} binding`, async () => {
  const h = exportHarness();
  if (invalid === 'inactive') h.c.currentProjectName = '';
  else h.c.readProjectManifest = async () => invalid === 'missing' ? null : {
    sourceSchemaVersion: invalid === 'future' ? 2 : 1, manifest: { projectId: invalid === 'projectId' ? '' : 'active-id' } };
  const result = await h.run(); assert.equal(result.ok, false); assert.equal(h.artifactWrites, 0); assert.equal(h.keyImports, 0);
});
test('shared formatting and structural scopes inherit exact active project binding', async () => {
  const h = harness(true); h.c.docxReviewPreviewSessionDetailString = value => value || '';
  vm.runInContext(main.slice(main.indexOf('async function buildRtkFormattingReturnRuntimeProjectScope('),
    main.indexOf('async function handleReviewSurfaceInspectFormattingReturnReplayCommandSurface(')), h.c);
  for (const scope of [await h.c.buildRtkFormattingReturnRuntimeProjectScope(), await h.c.buildRtkStructuralReturnRuntimeProjectScope()]) {
    assert.equal(scope.projectId, 'active-id'); assert.equal(scope.projectRoot, '/owned/Active project');
    assert.equal(scope.scenePathBySceneId['roman/scene.txt'], '/owned/Active project/roman/scene.txt');
  }
});

function notesContextHarness() {
  const h = harness(true);
  h.preparationWrites = 0; h.storageLoads = 0;
  Object.assign(h.c, {
    normalizeStableProjectId: value => typeof value === 'string' ? value.trim() : '',
    ensureProjectManifest: async () => { h.preparationWrites++; throw Error('context lookup must be read-only'); },
    loadNotesStorageModule: async () => { h.storageLoads++; h.phase?.('storage'); return { marker: 'notes-storage' }; },
  });
  vm.runInContext(main.slice(main.indexOf('async function getProjectNotesContext('),
    main.indexOf('function makeNotesCommandError(')), h.c);
  return h;
}
test('actual notes context reads nondefault active project without manifest preparation', async () => {
  const h = notesContextHarness();
  const result = await h.c.getProjectNotesContext({ projectId: 'active-id' });
  assert.equal(result.ok, true); assert.equal(result.projectId, 'active-id');
  assert.equal(result.projectRoot, '/owned/Active project');
  assert.equal(result.notesStorage.marker, 'notes-storage');
  assert.deepEqual(h.reads, ['Active project']); assert.equal(h.preparationWrites, 0);
});
for (const phase of ['manifest', 'storage']) for (const mutation of ['project', 'lifecycle', 'session', 'owner']) {
  test(`actual notes context rejects ${mutation} switch during ${phase} without preparation writes`, async () => {
    const h = notesContextHarness(); h.phase = actual => {
      if (actual !== phase) return;
      if (mutation === 'project') h.c.currentProjectName = 'Other project';
      if (mutation === 'lifecycle') h.subject = 'document:other';
      if (mutation === 'session') h.c.commentAuthoringSessionId = 'other';
      if (mutation === 'owner') h.c.activeStage10ApplicationBootstrap = {};
    };
    const result = await h.c.getProjectNotesContext({ projectId: 'active-id' });
    assert.equal(result.ok, false); assert.equal(result.reason, 'NOTES_PROJECT_STALE');
    assert.equal(h.preparationWrites, 0);
    if (phase === 'manifest') assert.equal(h.storageLoads, 0);
  });
}
for (const invalid of ['future', 'missing', 'projectId', 'inactive', 'mismatched']) {
  test(`actual notes context rejects ${invalid} project without storage access or writes`, async () => {
    const h = notesContextHarness();
    if (invalid === 'inactive') h.c.currentProjectName = '';
    else if (invalid !== 'mismatched') h.c.readProjectManifest = async () => invalid === 'missing' ? null : {
      sourceSchemaVersion: invalid === 'future' ? 2 : 1,
      manifest: { projectId: invalid === 'projectId' ? '' : 'active-id' },
    };
    const result = await h.c.getProjectNotesContext({ projectId: invalid === 'mismatched' ? 'default-id' : 'active-id' });
    assert.equal(result.ok, false); assert.equal(h.preparationWrites, 0); assert.equal(h.storageLoads, 0);
  });
}
