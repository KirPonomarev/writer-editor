'use strict';
const { installMainDocxRoundAuthority } = require('../helpers/main-docx-round-authority');
const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const model = require('../../src/core/word-pending-text-revisions-v1.cjs');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const { buildFullManuscriptDocxReviewPacketSource } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder.js');
const { createCommandSurfaceKernel } = require('../../src/command/commandSurfaceKernel.js');
const main = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
const prepareSource = main.slice(main.indexOf('async function prepareAuthenticatedPendingReturn('), main.indexOf('// Only an object retained by authenticated main intake'));
const source = main.slice(main.indexOf('const authenticatedPendingReturnAdmissions ='), main.indexOf('async function handleCommentAuthoringCommand('));
const bus = main.slice(main.indexOf('function dispatchMenuCommand('), main.indexOf('function buildCommandClickHandler('));
const id = 'cmd.project.review.decidePendingRevision';
const hash = v => crypto.createHash('sha256').update(v).digest('hex');
function document() {
  return model.bindLedger({ schemaVersion: 1, source: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'oldnew' }] }] },
    revisions: ['delete', 'insert'].map((operation, i) => ({ id: 'revision-' + (i + 1), nativeId: '' + i, operation, author: 'A', date: '', dateUtc: '',
      paragraphIndex: 0, from: i * 3, to: i * 3 + 3, state: 'pending', groupId: 'group-1' })), undo: [], redo: [] });
}
async function harness(t, { clean = false, savedDefaults = false, mixed = false, links = false, linkTarget } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pending-runtime-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'roman')); const file = path.join(root, 'roman/a.txt');
  let initial = mixed&&clean?model.normalizeNode(document()):clean ? structuredClone(document().attrs.wordPendingRevisions.source) : document();
  const linked=(doc,target)=>{const node={type:'paragraph',content:[{type:'text',text:'Unchanged external link',marks:[{type:'link',attrs:{href:target,rel:'noopener noreferrer nofollow',target:'_blank'}}]}]},ledger=model.readLedger(doc);if(ledger){ledger.source.content.push(node);return model.bindLedger(ledger);}doc.content.push(node);return doc;};
  if(links)initial=linked(initial,'https://example.com/original');
  if (savedDefaults) initial.attrs = { wordPendingRevisions: null };
  fs.writeFileSync(file, envelope.composeObservablePayload({ doc: initial }));
  const h = { writes: 0, opens: 0, snapshot: null, race: null };
  if (mixed) {
    const { exactAnchor } = require('../../src/core/word-comment-authoring-v1.cjs');
    h.commentText = JSON.stringify({schemaVersion:'yalken.rtk.word.non-text-return-state.v1',projectId:'p',revision:0,events:[],
      threads:[0,1].map(i=>({threadId:'thread-'+i,rootCommentId:'root-'+i,sceneId:'roman/a.txt',status:'open',
        anchor:exactAnchor({paragraphIndex:0,startUtf16:1,selectedText:'ew'},'roman/a.txt',['new']),
        messages:[{commentId:'root-'+i,kind:'root',body:'Discussion '+i,provenance:{author:'Writer'}}]}))});
  }
  const context = () => { const raw = fs.readFileSync(file, 'utf8'); return { filePath: file, projectRoot: root, projectId: 'p', sceneId: 'roman/a.txt',
    subjectId: 'life:session', saved: h.commentText ? {text:h.commentText,state:JSON.parse(h.commentText)} : { state: { threads: h.threads || [] } }, sceneSha256: hash(raw), raw, parsed: envelope.parseObservablePayload(raw) }; };
  const c = { require: value => require(path.resolve(__dirname,'../../src',value)), notesStateDigest: require('../../src/export/docx/docxReviewPacketNotes.js').notesStateDigest, pendingTextRevisions: model, isPlainObjectValue: v => v && typeof v === 'object' && !Array.isArray(v),
    queueDiskOperation: fn => fn(), readCommentAuthoringContext: async () => context(), requestEditorSnapshot: async () => {
      const value = h.snapshot || { generation: 0, content: fs.readFileSync(file, 'utf8') }; if (h.afterSnapshot) h.afterSnapshot(); return value;
    }, loadDocumentContentEnvelopeModule: async () => envelope, fs: fs.promises,
    loadNotesStorageModule: async () => ({ readNotesStorage: async () => ({ ok: true, document: { notes: h.notes || [] } }) }),
    currentFilePath: file, currentLifecycleSubjectId: () => 'life', commentAuthoringSessionId: 'session',
    isDirty: false, autoSaveInProgress: false, lastSignaledEditGeneration: 0,
    commitWriterProjectSnapshot: async (target, content, generation, profile, label, options) => {
      assert.equal(target, file); assert.equal(options.pendingRevisionDecision, true);
      if (h.race) h.race(); await options.beforeScenePublish();
      assert.equal(fs.readFileSync(file, 'utf8'), options.expectedSceneContent);
      if (options.pendingCommentReturnProofJson) {
        const plan = require('../../src/core/word-pending-comment-return-v1.cjs').planMixedPendingReturn({beforeText:h.commentText,
          projectId:'p',sceneId:'roman/a.txt',beforeContent:options.expectedSceneContent,afterContent:content,returnProofJson:options.pendingCommentReturnProofJson});
        h.commentText=plan.afterText;
      } else if (options.pendingCommentDecision) {
        h.commentText=require('../../src/core/word-pending-comment-decisions-v1.cjs').planPendingCommentDecision({beforeText:h.commentText,
          projectId:'p',sceneId:'roman/a.txt',beforeContent:options.expectedSceneContent,afterContent:content,decision:options.pendingCommentDecision}).afterText;
      }
      h.writes++; fs.writeFileSync(file, content); return { success: true, projectTransaction: true };
    }, openProjectDocumentFile: async () => { throw Error('nested navigation would deadlock disk queue'); },
    getProjectDocumentIdentityPayload: async () => ({ documentId: 'd' }),
    getDocumentContextFromPath: () => ({ title: 'scene', kind: 'scene', metaEnabled: true }),
    attachProjectIdToEditorPayload: async value => { if (h.publicationRace) h.publicationRace(); return value; },
    sendEditorText: value => { h.opens++; assert.equal(value.content, fs.readFileSync(file, 'utf8')); },
    computeHash: hash, backupHashes: new Map(), lastAutosaveHash: '', updateStatus() {},
    COMMAND_BUS_ROUTE: 'command.bus', resolveMenuCommandId: commandId => ({ ok: true, commandId }),
    evaluateWriterLocalCommandAccess: () => ({ allowed: h.allowed !== false, reason: 'PROFILE_DENIED' }), getWriterLocalRuntimeProfile: () => ({}),
    getProductCommandRecord: () => null, decideCommandEntitlement: () => ({ available: h.entitled !== false, reason: 'ENTITLEMENT_DENIED' }),
    getProductEntitlementTier: () => 'free', E_COMMAND_DISABLED_FOR_ENTITLEMENT: 'ENTITLEMENT_DENIED', isMenuLocalCustomizationCommandId: () => false,
  };
  Object.assign(c, { Buffer, activeStage10ApplicationBootstrap: {}, getProjectRootPath: () => root,
    createRtkReviewTransportCryptoPort: () => ({ sha256Text: text => hash(text), sha256Json: v => 'sha256:' + hash(JSON.stringify(v)), byteLength: v => Buffer.byteLength(v) }),
    docxReviewReturnIntakeProductBudgets: () => ({}), resetActiveReviewSessionStore: () => { h.reset = (h.reset || 0) + 1; },
  });
  vm.createContext(c); vm.runInContext(source + '\n' + bus + '\n' + prepareSource, c);
  const kernel = createCommandSurfaceKernel({ [id]: payload => c.handlePendingRevisionCommand(payload) });
  c.MENU_COMMAND_HANDLERS = { [id]: payload => kernel.dispatch(id, payload) };
  h.command = (action, override = {}) => c.dispatchMenuCommand(id, { projectId: 'p', sceneId: 'roman/a.txt', subjectId: 'life:session',
    expectedSceneSha256: context().sceneSha256, action, ...override }, { route: 'command.bus' });
  h.c = c; h.file = file; h.context = context;
  const b = await import('../../src/io/revisionBridge/index.mjs');
  let doc = document();
  if (clean) {
    const ledger = model.readLedger(doc);
    doc = model.bindLedger({ ...ledger, revisions: ledger.revisions.filter(r => r.operation === 'delete').map(r => ({ ...r, groupId: null })) });
  } else {
    doc.content[0].content.push({ type: 'text', text: ' added' });
    doc.attrs.wordPendingRevisions.source.content[0].content.push({ type: 'text', text: ' added' });
  }
  let returnedComments;
  if (mixed) {
    if(clean)doc=model.bindLedger({schemaVersion:1,source:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'new added'}]}]},
      revisions:[{id:'revision-1',nativeId:'0',operation:'insert',author:'Editor',date:'',dateUtc:'',paragraphIndex:0,from:3,to:9,state:'pending',groupId:null}],undo:[],redo:[]});
    const ledger=model.readLedger(doc);
    if(!clean)ledger.revisions.push({id:'revision-3',nativeId:'2',operation:'insert',author:'Editor',date:'',dateUtc:'',paragraphIndex:0,from:6,to:12,state:'pending',groupId:null});
    doc=model.bindLedger(ledger);
    returnedComments=JSON.parse(h.commentText);
    returnedComments.threads.forEach((thread,i)=>{thread.anchor.blockTextSha256=hash('new added');thread.messages.push({commentId:'reply-'+i,kind:'reply',body:'Reply '+i,provenance:{author:'Editor'}});});
    returnedComments.threads.push({threadId:'insert-discussion',rootCommentId:'insert-root',sceneId:'roman/a.txt',status:'open',
      anchor:require('../../src/core/word-comment-authoring-v1.cjs').exactAnchor({paragraphIndex:0,startUtf16:4,selectedText:'added'},'roman/a.txt',['new added']),
      messages:[{commentId:'insert-root',kind:'root',body:'On added text',provenance:{author:'Editor'}}]});
  }
  if(links)doc=linked(doc,linkTarget||'https://example.com/original');
  const exported = buildFullManuscriptDocxReviewPacketSource({ projectId: 'p', projectRoot: root, ...(mixed?{nonTextReturnState:returnedComments}:{}),
    scenes: [{ sceneId: 'roman/a.txt', scenePath: file, text: links?model.projection(doc).current:clean&&!mixed ? 'new' : 'new added', doc, order: 0 }] });
  let bytes = buildDocxReviewPacketBuffer(exported);
  const baselineSource=mixed?buildFullManuscriptDocxReviewPacketSource({projectId:'p',projectRoot:root,nonTextReturnState:JSON.parse(h.commentText),
    scenes:[{sceneId:'roman/a.txt',scenePath:file,text:links?model.projection(initial).current:'new',doc:initial,observableContent:context().raw,order:0}]}):exported;
  if(mixed) {
    const baseBytes=buildDocxReviewPacketBuffer(baselineSource);
    const baseParts=b.extractDocxReviewTransportPackagePartsFromZipBytes({bytes:baseBytes}).parts;
    const parts={...b.extractDocxReviewTransportPackagePartsFromZipBytes({bytes}).parts};
    const names=xml=>[...xml.matchAll(/w:name="([^"]+)"/gu)].map(m=>m[1]);
    const oldNames=names(baseParts['word/document.xml']),newNames=names(parts['word/document.xml']);
    newNames.forEach((name,i)=>{parts['word/document.xml']=parts['word/document.xml'].replaceAll(name,oldNames[i]);});
    bytes=require('../../src/export/docx/docxMinBuilder.js').buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data})));
  }
  const capsule = { ...baselineSource.localAuthorityCapsule, projectRoot: root, roundId: 'round-1',
    exportMapAuthority: 'main-owned-active-export-authority-store-after-return-authentication', returnedArtifactExportMapAccepted: false,
    scenePathBySceneId: { 'roman/a.txt': file }, baselineObservableContentBySceneId: { 'roman/a.txt': context().raw } };
  h.input = { context: { projectId: 'p', projectRoot: root, reviewTransportAuthorityCapsule: capsule,
    reviewTransportReturnIntake: { authenticated: true, returnedArtifactSha256: 'sha256:' + hash(bytes), ...(mixed?{parserResult:b.buildDocxReviewTransportAnalysisFromZipBytes({bytes},{cryptoPort:c.createRtkReviewTransportCryptoPort()})}:{}) } },
    requestId: 'return-test', isCurrent: () => h.current !== false, docxBytes: bytes, revisionBridge: b,
    onPrepared: value => { h.prepared = value; } };
  h.authority = installMainDocxRoundAuthority(c, { projectRoot: root, projectId: 'p', references: [capsule], publishAllocated: true, t });
  if(mixed) {
    const commentFile=path.join(root,'.yalken/word-review/non-text-return-state.v1.json');fs.mkdirSync(path.dirname(commentFile),{recursive:true});fs.writeFileSync(commentFile,h.commentText);
    Object.assign(c,{path,cloneJsonSafe:v=>JSON.parse(JSON.stringify(v)),loadRtkNonTextReturnModule:()=>import('../../src/io/revisionBridge/reviewTransportNonTextReturnRuntime.mjs'),
      validateDocumentNotesReturn:require('../../src/export/docx/docxReviewPacketNotes.js').validateDocumentNotesReturn,
      DOCX_REVIEW_PREVIEW_SESSION_COMMAND_ID:'preview',makeDocxReviewPreviewSessionTypedError:(_type,code)=>({ok:false,code})});
    h.input.context.reviewTransportReturnIntake.parserResult.authorityCarrier={selectedCarrier:{payload:{...(capsule.documentNotes?{documentNotesDigest:capsule.documentNotes.protectedDigest}:{})}}};
    const commentSource=main.slice(main.indexOf('const authenticatedCommentDeltaAdmissions ='),main.indexOf('async function applyAuthenticatedDocxCommentProductPath('));
    const route=main.slice(main.indexOf('  if (returnIntake.authenticated === true && returnIntake.localAuthorityCapsule?.commentExport?.threads?.length'),main.indexOf('  const pendingProductPath = await prepareAuthenticatedPendingReturn('));
    vm.runInContext(commentSource+'\nasync function mixedRoute(input) { const activeContext=input.context,returnIntake={...input.context.reviewTransportReturnIntake,localAuthorityCapsule:input.context.reviewTransportAuthorityCapsule},requestId=input.requestId,isCurrent=input.isCurrent,decoded={bytes:input.docxBytes},revisionBridge=input.revisionBridge,options={onPendingReturnPrepared:input.onPrepared};\n'+route+'\nreturn {pendingProductPath:await prepareAuthenticatedPendingReturn(input)};}',c);
    h.route=()=>c.mixedRoute(h.input);
  }
  h.prepare = () => c.prepareAuthenticatedPendingReturn(h.input);
  return h;
}
test('actual authenticated preparation and Kernel write round history; restart, undo, replay and redo', async t => {
  const h = await harness(t);
  let result = await h.prepare(); assert.equal(result.status, 'preview-ready', JSON.stringify(result));
  assert.equal(h.writes, 0); assert.equal(model.projection(h.prepared.changes.after).current, 'new added');
  result = await h.prepared.apply(); assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(h.writes, 1); assert.equal(h.reset, 1); assert.equal(h.opens, 1);
  assert.equal(model.projection(h.context().parsed.doc).current, 'new added');
  assert.equal((await h.command('undo')).ok, true); assert.equal(model.projection(h.context().parsed.doc).current, 'new');
  result = await h.prepare(); assert.equal(result.status, 'replayed', JSON.stringify(result)); assert.equal(h.writes, 2);
  assert.equal((await h.command('redo')).ok, true); assert.equal(model.projection(h.context().parsed.doc).current, 'new added');
});

test('durably expired round blocks an already prepared pending Apply without any scene or ledger write', async t => {
  const h = await harness(t), before = fs.readFileSync(h.file, 'utf8');
  assert.equal((await h.prepare()).status, 'preview-ready');
  const round = h.authority.roundsById['round-1'];
  round.lifecycleState = 'EXPIRED'; round.recordVersion++;
  h.authority.write();
  await assert.rejects(h.prepared.apply(), /RTK_ROUND_LIFECYCLE_NOT_ELIGIBLE/);
  assert.equal(h.writes, 0); assert.equal(h.opens, 0);
  assert.equal(fs.readFileSync(h.file, 'utf8'), before);
});
for (const kind of ['project', 'hash', 'untrustedMap', 'wrongScene', 'multipleScenes', 'baseline', 'superseded',
  'dirty', 'generation', 'draft', 'noteDraft', 'annotations', 'notes', 'liveText', 'diskRace', 'capability', 'serializedAdmission', 'returnedComment', 'returnedNote', 'consumed']) {
  test(`authenticated return blocks ${kind} before writing`, async t => {
    const h = await harness(t), capsule = h.input.context.reviewTransportAuthorityCapsule;
    const before = fs.readFileSync(h.file, 'utf8');
    if (kind === 'project') h.input.context.projectId = 'foreign';
    if (kind === 'hash') h.input.context.reviewTransportReturnIntake.returnedArtifactSha256 = 'sha256:' + '0'.repeat(64);
    if (kind === 'untrustedMap') capsule.returnedArtifactExportMapAccepted = true;
    if (kind === 'wrongScene') capsule.scenePathBySceneId['roman/a.txt'] = '/foreign';
    if (kind === 'multipleScenes') capsule.exportMap.scenes.push(structuredClone(capsule.exportMap.scenes[0]));
    if (kind === 'baseline') capsule.baselineObservableContentBySceneId['roman/a.txt'] += '\n';
    if (kind === 'returnedComment') h.input.context.reviewTransportReturnIntake.parserResult = { reviewIr: { commentThreads: [{}] } };
    if (kind === 'returnedNote') h.input.context.reviewTransportReturnIntake.parserResult = { reviewIr: { documentNotes: { notes: [{}] } } };
    let result = await h.prepare();
    if (h.prepared) {
      if (kind === 'superseded') h.current = false;
      if (kind === 'dirty') h.c.isDirty = true;
      if (kind === 'generation') h.c.lastSignaledEditGeneration++;
      if (kind === 'draft' || kind === 'noteDraft') h.snapshot = { generation: 0, content: before,
        [kind === 'draft' ? 'commentAuthoringPending' : 'manuscriptNoteAuthoringPending']: true };
      if (kind === 'annotations') h.threads = [{ sceneId: 'roman/a.txt', status: 'open' }];
      if (kind === 'notes') h.notes = [{ manuscript: { reference: { sceneId: 'roman/a.txt' } } }];
      if (kind === 'liveText') h.snapshot = { generation: 0, content: envelope.composeObservablePayload({ doc: model.decide(document(), { action: 'rejectAll' }).doc }) };
      if (kind === 'diskRace') h.race = () => { fs.writeFileSync(h.file, 'owner changed scene'); };
      if (kind === 'capability') h.allowed = false;
      if (kind === 'serializedAdmission') result = await h.command('authenticated-pending-return');
      else {
        if (kind === 'consumed') {
          h.allowed = false; await assert.rejects(h.prepared.apply()); h.allowed = true;
        }
        try { result = await h.prepared.apply(); } catch (error) { result = { ok: false, code: error.message }; }
      }
    }
    assert.equal(result.ok, false, JSON.stringify(result)); assert.equal(h.writes, 0);
    assert.equal(fs.readFileSync(h.file, 'utf8'), kind === 'diskRace' ? 'owner changed scene' : before);
  });
}

test('native confirmation describes complete semantics, defaults to Cancel, and refuses truncated previews', async t => {
  const h = await harness(t); assert.equal((await h.prepare()).status, 'preview-ready');
  const dialogSource = main.slice(main.indexOf('async function confirmLocalWordPendingReturn('), main.indexOf('async function confirmLocalWordNoteDelta('));
  let calls = 0;
  Object.assign(h.c, { mainWindow: { isDestroyed: () => false }, dialog: { showMessageBox: async (_window, options) => {
    calls++; assert.equal(options.cancelId, 0); assert.equal(options.defaultId, 0);
    for (const text of ['До возврата', 'После возврата', 'Исходный текст', 'Текущий текст', 'Вставка', 'Удаление', 'new', 'old', 'added']) assert.ok(options.detail.includes(text));
    return { response: 0 };
  } } });
  vm.runInContext(dialogSource, h.c);
  assert.equal(await h.c.confirmLocalWordPendingReturn({ fileName: 'Word.docx', changes: h.prepared.changes }), false);
  assert.equal(h.writes, 0); assert.equal(calls, 1);
  await assert.rejects(h.c.confirmLocalWordPendingReturn({ fileName: 'x'.repeat(32001), changes: h.prepared.changes }), /PREVIEW_BUDGET/);
  assert.equal(calls, 1);
});

test('native Tiptap null defaults and merged runs remain equal; meaningful clean-scene edits stay blocked', async t => {
  const h = await harness(t), live = document();
  live.content[0].attrs = { textAlign: null };
  h.snapshot = { generation: 0, content: envelope.composeObservablePayload({ doc: live }) };
  assert.equal((await h.prepare()).status, 'preview-ready');
  assert.equal((await h.prepared.apply()).ok, true);
  assert.equal(h.writes, 1);
});

test('first authenticated return accepts absent imported ledger and Tiptap null ledger without manual Save', async t => {
  const h = await harness(t, { clean: true }), before = fs.readFileSync(h.file, 'utf8');
  const live = structuredClone(h.context().parsed.doc);
  assert.equal(live.attrs?.wordPendingRevisions, undefined);
  live.attrs = { wordPendingRevisions: null };
  live.content[0].attrs = { textAlign: null };
  h.snapshot = { generation: 0, content: envelope.composeObservablePayload({ doc: live }) };
  assert.equal((await h.prepare()).status, 'preview-ready');
  assert.equal(h.writes, 0);
  assert.equal(fs.readFileSync(h.file, 'utf8'), before);
  const result = await h.prepared.apply();
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(h.writes, 1);
  assert.equal(h.opens, 1);
  assert.equal(h.reset, 1);
  assert.equal(model.projection(h.context().parsed.doc).original, 'oldnew');
  assert.equal(model.projection(h.context().parsed.doc).current, 'new');
});

test('saved null-ledger source with unbound export map prepares and applies exactly once', async t => {
  const h = await harness(t, { clean: true, savedDefaults: true }), before = fs.readFileSync(h.file, 'utf8');
  assert.equal(h.context().parsed.doc.attrs.wordPendingRevisions, null);
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const ex = bridge.extractDocxReviewTransportWordDocumentProjection({ bytes: h.input.docxBytes },
    { cryptoPort: h.c.createRtkReviewTransportCryptoPort() });
  const mapped = bridge.visibleSceneTextsFromWordDocumentXml(ex.documentXml,
    h.input.context.reviewTransportAuthorityCapsule.exportMap,
    { cryptoPort: h.c.createRtkReviewTransportCryptoPort(), stylesXml: ex.stylesXml,
      allowPendingParagraphSplits: true, allowPendingTableRows: true });
  assert.equal(mapped.ok, true);
  assert.equal(mapped.sourceParagraphBindings, undefined);
  assert.equal(mapped.paragraphBindings, undefined);
  const prepared = await h.prepare();
  assert.equal(prepared.status, 'preview-ready', JSON.stringify(prepared));
  assert.equal(h.writes, 0);
  assert.equal(fs.readFileSync(h.file, 'utf8'), before);
  assert.equal((await h.prepared.apply()).ok, true);
  assert.equal(h.writes, 1);
  assert.equal(h.opens, 1);
  assert.equal(h.reset, 1);
  assert.equal(model.projection(h.context().parsed.doc).original, 'oldnew');
  assert.equal(model.projection(h.context().parsed.doc).current, 'new');
  await assert.rejects(h.prepared.apply(), /PENDING_RETURN_PREPARED_CONSUMED/);
  assert.equal(h.writes, 1);
});

for (const savedDefaults of [false, true]) for (const kind of ['text', 'marks', 'differentValidLedger', 'malformedLedger']) {
  test(`${savedDefaults ? 'saved null-ledger' : 'first authenticated'} return blocks ${kind} despite null schema defaults before any write`, async t => {
    const h = await harness(t, { clean: true, savedDefaults }), before = fs.readFileSync(h.file, 'utf8');
    const live = structuredClone(h.context().parsed.doc);
    live.attrs = { wordPendingRevisions: null };
    live.content[0].attrs = { textAlign: null };
    if (kind === 'text') live.content[0].content[0].text += ' owner edit';
    if (kind === 'marks') live.content[0].content[0].marks = [{ type: 'bold' }];
    if (kind === 'differentValidLedger') {
      live.attrs.wordPendingRevisions = model.readLedger(model.bindLedger({ schemaVersion: 2,
        source: model.normalizeNode(h.context().parsed.doc), revisions: [], undo: [], redo: [],
        roundUndo: [], roundRedo: [], returnReceipts: [] }));
      assert.ok(model.readLedger(live));
      assert.deepEqual(model.normalizeNode(live), model.normalizeNode(h.context().parsed.doc));
    }
    if (kind === 'malformedLedger') live.attrs.wordPendingRevisions = { schemaVersion: 1 };
    const serialized = JSON.stringify(live);
    h.snapshot = { generation: 0, content: kind === 'malformedLedger'
      ? `[doc-v2 length=${serialized.length}]\n${serialized}` : envelope.composeObservablePayload({ doc: live }) };
    assert.equal((await h.prepare()).status, 'preview-ready');
    await assert.rejects(h.prepared.apply(), kind === 'malformedLedger'
      ? /PENDING_REVISION_EDITOR_INVALID/ : /PENDING_REVISION_EDITOR_STALE/);
    assert.equal(h.writes, 0);
    assert.equal(h.opens, 0);
    assert.equal(h.reset || 0, 0);
    assert.equal(fs.readFileSync(h.file, 'utf8'), before);
  });
}

test('saved null-ledger return rejects stale authenticated baseline without changing owner content', async t => {
  const h = await harness(t, { clean: true, savedDefaults: true });
  const owner = structuredClone(h.context().parsed.doc); owner.content[0].content[0].text += ' owner edit';
  const content = envelope.composeObservablePayload({ doc: owner }); fs.writeFileSync(h.file, content);
  const result = await h.prepare();
  assert.equal(result.ok, false);
  assert.equal(result.code, 'PENDING_RETURN_BASELINE_CONFLICT');
  assert.equal(h.writes, 0);
  assert.equal(h.opens, 0);
  assert.equal(h.reset || 0, 0);
  assert.equal(fs.readFileSync(h.file, 'utf8'), content);
});

test('saved null-ledger source rejects inconsistent returned projection before preparing a writer', async t => {
  const h = await harness(t, { clean: true, savedDefaults: true }), before = fs.readFileSync(h.file, 'utf8');
  const bridge = h.input.revisionBridge;
  h.input.revisionBridge = { ...bridge, visibleSceneTextsFromWordDocumentXml(...args) {
    const mapped = bridge.visibleSceneTextsFromWordDocumentXml(...args);
    return { ...mapped, sceneTexts: mapped.sceneTexts.map(text => text + ' inconsistent projection') };
  } };
  const result = await h.prepare();
  assert.equal(result.ok, false);
  assert.equal(result.code, 'PENDING_RETURN_PROJECTION_MISMATCH');
  assert.equal(h.prepared, undefined);
  assert.equal(h.writes, 0);
  assert.equal(h.opens, 0);
  assert.equal(h.reset || 0, 0);
  assert.equal(fs.readFileSync(h.file, 'utf8'), before);
});

test('mixed pending text and three discussions apply atomically, restart and undo redo without lost messages', async t => {
  const h=await harness(t,{mixed:true});
  const routed=await h.route(),result=routed.pendingProductPath; assert.equal(result?.status,'preview-ready',JSON.stringify(routed));
  assert.equal(h.writes,0);
  assert.equal((await h.prepared.apply()).ok,true);
  assert.equal(h.writes,1); assert.equal(model.projection(h.context().parsed.doc).current,'new added');
  let state=JSON.parse(h.commentText); assert.equal(state.threads.length,3); assert.equal(state.threads.reduce((n,t)=>n+t.messages.length,0),5);
  assert.equal((await h.command('undo')).ok,true); assert.equal(model.projection(h.context().parsed.doc).current,'new');
  state=JSON.parse(h.commentText); assert.equal(state.threads.reduce((n,t)=>n+t.messages.length,0),5);
  assert.equal((await h.command('redo')).ok,true); assert.equal(model.projection(h.context().parsed.doc).current,'new added');
  assert.equal(JSON.parse(h.commentText).threads.filter(t=>t.status!=='deleted').length,3);
});

test('native pending confirmation presents one changed paragraph in a 100000 word scene',async t=>{
  const h=await harness(t);
  const text=Array(100).fill('manuscript').join(' '),source={type:'doc',content:Array.from({length:1000},()=>({type:'paragraph',content:[{type:'text',text}]}))};
  const before=structuredClone(source);
  const next=structuredClone(source);next.content[500].content[0].text+=' added';
  const after=model.bindLedger({schemaVersion:1,source:next,revisions:[{id:'revision-1',nativeId:'0',operation:'insert',author:'Editor',date:'',dateUtc:'',paragraphIndex:500,from:text.length,to:text.length+6,state:'pending',groupId:null}],undo:[],redo:[]});
  let seen;
  Object.assign(h.c,{mainWindow:{isDestroyed:()=>false},dialog:{showMessageBox:async(_window,options)=>{seen=options;return {response:0};}}});
  const sourceText=main.slice(main.indexOf('async function confirmLocalWordPendingReturn('),main.indexOf('async function confirmLocalWordNoteDelta('));vm.runInContext(sourceText,h.c);
  assert.equal(await h.c.confirmLocalWordPendingReturn({fileName:'100k.docx',changes:{before,after}}),false);
  assert.ok(seen.detail.length<15000);assert.match(seen.detail,/Абзац 501/);assert.doesNotMatch(seen.detail,/Абзац 500/);assert.match(seen.detail,/added/);assert.equal(seen.cancelId,0);
});

test('first clean writer export returns first tracked insertion and multiple discussions through actual Main route',async t=>{
  const h=await harness(t,{mixed:true,clean:true});
  assert.equal(model.readLedger(h.context().parsed.doc),null);
  const routed=await h.route();assert.equal(routed.pendingProductPath?.status,'preview-ready',JSON.stringify(routed));
  assert.equal(h.writes,0);assert.equal((await h.prepared.apply()).ok,true);assert.equal(h.writes,1);
  assert.equal(model.projection(h.context().parsed.doc).current,'new added');
  assert.equal((await h.command('undo')).ok,true);assert.equal(model.projection(h.context().parsed.doc).current,'new');
  assert.equal(JSON.parse(h.commentText).threads.reduce((n,t)=>n+t.messages.length,0),5);
  assert.equal((await h.command('redo')).ok,true);assert.equal(JSON.parse(h.commentText).threads.filter(t=>t.status!=='deleted').length,3);
});

test('actual Main mixed route preserves unchanged hyperlinks and rejects changed targets',async t=>{
 const h=await harness(t,{mixed:true,links:true});
 const result=await h.route();assert.equal(result.pendingProductPath?.status,'preview-ready',JSON.stringify(result));assert.equal(h.writes,0);
 assert.equal((await h.prepared.apply()).ok,true);
 const returned=model.readLedger(h.context().parsed.doc).source;
 assert.ok(model.paragraphs(returned).at(-1).content.every(n=>n.marks?.some(m=>m.type==='link'&&m.attrs.href==='https://example.com/original')));
 const bad=await harness(t,{mixed:true,links:true,linkTarget:'https://example.com/changed'});
 const refusal=await bad.route();assert.equal(refusal.pendingProductPath?.status,'blocked',JSON.stringify(refusal));assert.equal(bad.writes,0);assert.equal(bad.prepared,undefined);
});
