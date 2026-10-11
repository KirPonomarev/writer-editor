'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const model = require('../../src/core/word-pending-text-revisions-v1.cjs');
const recording = require('../../src/core/word-pending-recording-v1.cjs');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const tx = require('../../src/core/project-transaction-v1.cjs');
const gateway = require('../../src/core/legacy-strangler-v1.cjs');
const { durableSaveTransaction } = require('../../src/core/save-coordinator-v1.cjs');
const { planCommentAnchorSave } = require('../../src/core/word-comment-anchor-save-v1.cjs');
const { createCommandSurfaceKernel } = require('../../src/command/commandSurfaceKernel.js');
const { evaluateWriterLocalCommandAccess, createWriterLocalProfileProjection } = require('../../src/core/writer-local-profile-v1.cjs');
const { decideCommandEntitlement } = require('../../src/core/entitlement-law-v1.cjs');
const main = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
const extract = name => main.match(new RegExp('(?:async )?function ' + name + '\\([^]*?\\n}'))[0];
const id = 'cmd.project.review.recordTextRevisions';
const hash = v => crypto.createHash('sha256').update(v).digest('hex');
// Use the actual production extensions and serializer, not a target-copy ACK.
const production=(()=>{
 const source=fs.readFileSync(path.join(__dirname,'../../src/renderer/tiptap/index.js'),'utf8');
 const imports=source.slice(0,source.indexOf('let currentEditorInstance'));
 const extensions=source.slice(source.indexOf('    extensions: [')+'    extensions: '.length,source.indexOf("    content: '<p></p>'")).trim().replace(/,$/,'');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'recording-schema-')),output=path.join(directory,'schema.cjs');
 const readers=source.slice(source.indexOf('function readEditorText('),source.indexOf('function normalizeFormattingColor('));
 require('esbuild').buildSync({stdin:{contents:imports+'\nimport {getSchema} from "@tiptap/core";\n'+readers+'\nconst extensions='+extensions+';const schema=getSchema(extensions);export {Editor,extensions,schema,readEditorDocument,getCommentEditIntentsJson};',
  resolveDir:path.join(__dirname,'../../src/renderer/tiptap')},bundle:true,platform:'node',format:'cjs',outfile:output,logLevel:'silent'});
 try{return require(output);}finally{fs.rmSync(directory,{recursive:true,force:true});}
})();
const installed=text=>{const parsed=envelope.parseObservablePayload(text),node=production.schema.nodeFromJSON(parsed.doc);
 node.check();const doc=production.readEditorDocument({getJSON:()=>node.toJSON()});
 return envelope.composeObservablePayload({...parsed,metaEnabled:parsed.hasMetaBlock,doc});};
const doc = text => ({ type: 'doc', content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }] });
for (const action of ['split', 'join']) test(`real production Tiptap ${action}, typing and Undo restore exact recording occurrences`, () => {
 const content = { type: 'doc', content: [doc('Café').content[0], doc('Привет мир.').content[0]] };
 const editor = new production.Editor({ element: null, extensions: production.extensions, content });
 editor.view.updateState(editor.state.reconfigure({ plugins: editor.extensionManager.plugins }));
 Object.defineProperty(editor, 'isDestroyed', { get: () => false });
 const texts = () => editor.state.doc.content.content.map(node => node.textContent);
 const intents = () => production.getCommentEditIntentsJson(editor);
 const derive = require('../../src/core/word-pending-recording-intents-v1.cjs').deriveChanges;
 try {
  const before = texts(), original = production.readEditorDocument(editor);
  if (action === 'split') { editor.commands.setTextSelection(3); assert.equal(editor.commands.splitBlock(), true); }
  else { editor.commands.setTextSelection(editor.state.doc.child(0).nodeSize + 1); assert.equal(editor.commands.joinBackward(), true); }
  editor.commands.insertContent({ type: 'text', text: 'X' });
  assert.throws(() => derive(before, texts(), intents()), /RECORDING_INTENT_STRUCTURE_UNSUPPORTED/);
  assert.equal(editor.commands.undo(), true);
  assert.deepEqual(texts(), before); assert.deepEqual(production.readEditorDocument(editor), original);
  assert.deepEqual(derive(before, texts(), intents()).changes, [[], []]);
 } finally { editor.destroy(); }
});
async function harness(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'recording-runtime-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'roman/a.txt'), manifest = path.join(root, 'project.json');
  fs.mkdirSync(path.dirname(file)); fs.writeFileSync(file, envelope.composeObservablePayload({ doc: doc('Alpha beta') }));
  fs.writeFileSync(manifest, JSON.stringify({ projectId: 'recording-project', revision: 1 }));
  const commentPath = path.join(root, '.yalken', 'word-review', 'non-text-return-state.v1.json');
  const readComments = () => { const text = fs.existsSync(commentPath) ? fs.readFileSync(commentPath, 'utf8') : null; return { text, state: text ? JSON.parse(text) : { threads: [] } }; };
  const h = { writes: 0, generation: 0, editor: fs.readFileSync(file, 'utf8'), publications: 0 };
  const context = () => { const raw = fs.readFileSync(file, 'utf8'); return { filePath: file, projectRoot: root, projectId: 'recording-project', sceneId: 'roman/a.txt',
    subjectId: 'life:session', saved: readComments(), sceneSha256: hash(raw), raw, parsed: envelope.parseObservablePayload(raw) }; };
  const { createMainProjectManifestAuthority } = await import('../../src/product/mainProjectManifestAuthority.mjs');
  const authority = createMainProjectManifestAuthority({ anchorRoot: path.join(root, 'leases'), useLeaseHeartbeatWorker: false });
  const requests = new Map();
  const c = { JSON, require: require('node:module').createRequire(path.join(__dirname, '../../src/main.js')),
    normalizeSelectionRangeForSettings:()=>null, commentSceneParagraphs: require('../../src/core/word-comment-anchor-save-v1.cjs').paragraphs, Buffer, crypto, setTimeout:(fn,ms)=>setTimeout(fn,h.timeoutMs??ms), clearTimeout, pendingSnapshotRequests: requests,
    pendingTextRevisions: model, pendingRecordingModel: recording, cloneJsonSafe: v => JSON.parse(JSON.stringify(v)),
    isPlainObjectValue: v => v && typeof v === 'object' && !Array.isArray(v),
    queueDiskOperation: fn => fn(), readCommentAuthoringContext: async () => { if (c.isDirty || c.autoSaveInProgress) throw Error('DIRTY'); return context(); },
    loadDocumentContentEnvelopeModule: async () => envelope, fs: fs.promises, path,
    loadRtkNonTextReturnModule: async () => ({ readCommentAuthoringState: async () => h.threads ? { text: null, state: { threads: h.threads } } : readComments() }),
    loadNotesStorageModule: () => import('../../src/product/notesStoragePersistence.mjs'),
    currentFilePath: file, currentLifecycleSubjectId: () => h.lifecycle || 'life', commentAuthoringSessionId: 'session',
    isDirty: false, autoSaveInProgress: false, activeAutoSavePromise: null, lastSignaledEditGeneration: 0,
    getProjectDocumentIdentityPayload: async () => ({ documentId: 'd' }),
    getDocumentContextFromPath: () => ({ title: 'scene', kind: 'scene', metaEnabled: true }),
    attachProjectIdToEditorPayload: async value => { if (h.publicationRace) h.publicationRace(); return value; },
    sendEditorText: value => { h.publications++; h.editor = value.content; },
    computeHash: hash, backupHashes: new Map(), lastAutosaveHash: '', updateStatus() {},
    COMMAND_BUS_ROUTE: 'command.bus', resolveMenuCommandId: commandId => ({ ok: true, commandId }),
    evaluateWriterLocalCommandAccess: options => h.allowed === false ? { allowed: false, reason: 'PROFILE_DENIED' } : evaluateWriterLocalCommandAccess(options),
    getWriterLocalRuntimeProfile: () => createWriterLocalProfileProjection({ isPackaged: true, platform: 'darwin' }),
    getProductCommandRecord: () => null, decideCommandEntitlement: (command, tier) => h.entitled === false ? { available: false, reason: 'DENIED' } : decideCommandEntitlement(command, tier),
    getProductEntitlementTier: () => 'free', E_COMMAND_DISABLED_FOR_ENTITLEMENT: 'ENTITLEMENT_DENIED', isMenuLocalCustomizationCommandId: () => false,
    activeStage10ApplicationBootstrap: {},
    readReviewExactTextApplyProjectBinding: async () => ({ ok: true, projectRoot: root, projectId: h.foreignProject ? 'foreign' : 'recording-project', manifestPath: manifest }),
    ...gateway, SAVE_AUTHORITY_OBSERVER_IDS: gateway.OBSERVER_IDS, durableSaveTransaction, planCommentAnchorSave,
    manuscriptNoteModel: require('../../src/core/word-manuscript-notes-v1.cjs'),
    prepareBookProfileManifestForFile: async target => ({ manifestPath: manifest, projectId: 'recording-project', expectedText: fs.readFileSync(manifest, 'utf8'), nextText: fs.readFileSync(manifest, 'utf8') }),
    getMainProjectManifestAuthority: async () => authority,
    getProjectRelativeFilePath: target => path.relative(root, target),
    loadProRoundtripPreservationModule: async () => ({ applyFreeEditProDataInvalidation: value => ({ ok: true, manifest: value }) }),
    commitProjectTransaction: async args => { if (h.writeFailure) throw Error('INJECTED_WRITE_FAILURE'); const r = await tx.commitProjectTransaction(args); h.writes++; return r; },
  };
  const renderer=fs.readFileSync(path.join(__dirname,'../../src/renderer/editor.js'),'utf8');
  const r=vm.createContext({ ...envelope,parseDocumentContent:envelope.parseObservablePayload,
    currentProjectId:'recording-project',currentDocumentId:'d',currentTreeContentPublicationId:'',
    isTiptapMode:true,centralSheetStripLargePayloadFastPathActive:false,localEditGeneration:0,
    wordCommentDraft:null,wordCommentBusy:false,manuscriptDrafts:new Map(),storyDrafts:new Map(),flowModeState:{active:false},
    notesMutationPending:false,storyMutationPending:false,pendingStoryRequestId:null,
    getPlainText:()=>envelope.parseObservablePayload(h.editor).text,getActiveBookProfile:()=>null,
    getSelectionOffsets:()=>null,getTiptapImageInsertionPosition:()=>null,getTiptapRootSplitBoundary:()=>null,
    getTiptapCommentEditIntentsJson:()=>h.intents==null?null:JSON.stringify(h.intents),
    getTiptapDocumentSnapshot:()=>({doc:r.document,text:envelope.parseObservablePayload(h.editor).text}),
    setTiptapDocumentSnapshot:({doc})=>{r.document=doc;return true;},
    updateMetaInputs(){},updateMetaVisibility(){},updateCardsList(){},updateWordCount(){},
    window:{electronAPI:{onEditorSetText(fn){r.publish=fn;},sendEditorSnapshotResponse(requestId,snapshot){
      h.lastReply={requestId,snapshot};
      if(h.dropAck)return;const p=requests.get(requestId);if(!p)return;
      if(h.ackTransform)snapshot=h.ackTransform(snapshot);
      clearTimeout(p.timeoutId);requests.delete(requestId);p.resolve(c.normalizeEditorSnapshotPayload(snapshot));
    }}},
  });
  const rendererExtract=name=>renderer.match(new RegExp('function '+name+'\\([^]*?\\n}'))[0];
  vm.runInContext([rendererExtract('composeDocumentContent'),rendererExtract('composeEditorSnapshot')].join('\n'),r);
  const callback=renderer.indexOf('window.electronAPI.onEditorSetText((payload) => {');
  vm.runInContext(renderer.slice(callback,renderer.indexOf('    if (payload?.storyPublication',callback))+'});',r);
  c.mainWindow={isDestroyed:()=>false,webContents:{send(channel,payload){
    if(h.deliveryRace && channel==='editor:set-text')h.deliveryRace();
    const parsed=envelope.parseObservablePayload(h.editor);r.document=parsed.doc;r.metaEnabled=parsed.hasMetaBlock;
    r.currentMeta=parsed.meta;r.currentCards=parsed.cards;r.localEditGeneration=h.generation;
    r.wordCommentDraft=h.draft?{}:null;r.notesMutationPending=h.noteDraft===true;
    if(channel==='editor:set-text'){
      h.lastPublication=payload;if(h.installRace){h.installRace();const fresh=envelope.parseObservablePayload(h.editor);r.document=fresh.doc;}
      h.publications++;r.publish(payload);h.editor=r.composeDocumentContent();
    }else r.window.electronAPI.sendEditorSnapshotResponse(payload.requestId,r.composeEditorSnapshot());
  }}};
  h.renderer=r;
  vm.createContext(c);
  const recordingSource = main.slice(main.indexOf('let activePendingRecording ='), main.indexOf('const authenticatedPendingReturnAdmissions ='));
  vm.runInContext([extract('normalizeEditorSnapshotPayload'),extract('commitWriterProjectSnapshot'), extract('requestEditorSnapshot'), recordingSource,
    extract('readPendingRevisionProjection'),
    main.slice(main.indexOf('function dispatchMenuCommand('), main.indexOf('function buildCommandClickHandler('))].join('\n'), c);
  const kernel = createCommandSurfaceKernel({ [id]: payload => c.handlePendingRecordingCommand(payload) });
  c.MENU_COMMAND_HANDLERS = { [id]: payload => kernel.dispatch(id, payload) };
  h.capture = () => c.requestEditorSnapshot();
  h.commit = snapshot => c.commitWriterProjectSnapshot(file, snapshot.content, snapshot.generation, null, 'test recording save', { commentEditIntentsJson: snapshot.commentEditIntentsJson });
  h.save = async () => { const s = await h.capture(); const result = await h.commit(s); if (result.success) c.isDirty = false; return result; };
  c.handleSave = async () => (await h.save()).success === true;
  h.command = (action, override = {}) => c.dispatchMenuCommand(id, { projectId: 'recording-project', sceneId: 'roman/a.txt', subjectId: 'life:session',
    ...(action === 'start' ? { expectedSceneSha256: context().sceneSha256, author: 'Yalken tester' } : { sessionId: h.sessionId }), action, ...override }, { route: 'command.bus' });
  h.start = async () => { const r = await h.command('start'); assert.equal(r.ok, true, JSON.stringify(r)); h.sessionId = r.result?.sessionId || r.sessionId; return r; };
  h.type = text => { h.editor = envelope.composeObservablePayload({ doc: doc(text) }); h.generation++; c.lastSignaledEditGeneration = h.generation; c.isDirty = true; };
  h.c = c; h.file = file; h.root = root; h.manifest = manifest; h.notePath = path.join(root,'notes.craftsman.json');
  h.context = context; h.commentPath = commentPath; h.readComments = readComments; return h;
}
test('actual Main authoring and tree readers admit scene stat 32 MiB and refuse overflow or unsafe paths before reading',async t=>{
 const h=await harness(t),before=business(h),limit=32*1024*1024,originalFs=h.c.fs;
 h.c.isAllowedFilePath=target=>target===h.file;h.c.userBookmarkModel=require('../../src/core/word-user-bookmarks-v1.cjs');
 h.c.treeCohortError=code=>Object.assign(Error(code),{code});
 vm.runInContext([extract('readCommentAuthoringContext'),extract('readTreeCohortPath')].join('\n'),h.c);
 let size=limit,unsafe=null,reads=0;
 h.c.fs={...originalFs,lstat:async target=>{const stat=await originalFs.lstat(target);if(target!==h.file)return stat;
  return {isSymbolicLink:()=>unsafe==='symlink',isFile:()=>true,isDirectory:()=>false,nlink:unsafe==='hardlink'?2:1,size};},
  readFile:async(...args)=>{if(args[0]===h.file)reads++;return originalFs.readFile(...args);}};
 assert.equal((await h.c.readCommentAuthoringContext()).raw,before[0]);
 assert.equal((await h.c.readTreeCohortPath(h.root,'roman/a.txt')).bytes.toString(),before[0]);assert.equal(reads,2);
 for(const mode of ['overflow','symlink','hardlink']){size=mode==='overflow'?limit+1:limit;unsafe=mode;reads=0;
  await assert.rejects(h.c.readCommentAuthoringContext(),/COMMENT_SCENE_PATH_UNSAFE/u);
  await assert.rejects(h.c.readTreeCohortPath(h.root,'roman/a.txt'),/E_TREE_COHORT_PATH_UNSAFE/u);assert.equal(reads,0);
  assert.deepEqual(business(h),before);assert.equal(h.writes,0);
 }
});
test('actual Kernel, main snapshot and atomic save preserve authored revisions across autosaves, stop and reopen', async t => {
  const h = await harness(t); await h.start();
  assert.equal(h.writes, 0); h.type('Alpha beta!'); assert.equal((await h.save()).success, true);
  const first = model.readLedger(h.context().parsed.doc); assert.equal(first.revisions[0].author, 'Yalken tester');
  h.type('Alpha beta!!'); assert.equal((await h.save()).success, true);
  assert.equal(model.readLedger(h.context().parsed.doc).roundUndo.length, 1);
  const stopped = await h.command('stop'); assert.equal(stopped.ok, true, JSON.stringify(stopped));
  const reopened = JSON.parse(JSON.stringify(h.context().parsed.doc));
  assert.equal(model.projection(reopened).current, 'Alpha beta!!');
  assert.equal(model.projection(model.decide(reopened, { action: 'undo' }).doc).current, 'Alpha beta');
  assert.equal(model.readLedger(envelope.parseObservablePayload(h.editor).doc).revisions.length, 1);
});
test('typing Undo after autosave restores original durable bytes without extra pending decisions', async t => {
  const h = await harness(t), before = fs.readFileSync(h.file, 'utf8'); await h.start();
  h.type('Alpha beta!'); assert.equal((await h.save()).success, true);
  h.type('Alpha beta'); assert.equal((await h.save()).success, true);
  assert.equal(fs.readFileSync(h.file, 'utf8'), before); assert.equal(model.readLedger(h.context().parsed.doc), null);
});
test('actual Kernel and atomic autosave persist rich formatting with main-owned provenance, Undo and restart', async t => {
  const h = await harness(t), before = fs.readFileSync(h.file, 'utf8'); await h.start();
  const working = doc('Alpha beta'); working.content[0].attrs = { textAlign: 'center' };
  working.content[0].content[0].marks = [{ type: 'bold' }];
  const edit = value => { h.type('Alpha beta'); h.editor = envelope.composeObservablePayload({ doc: value }); };
  edit(working); assert.equal((await h.save()).success, true);
  let ledger = model.readLedger(h.context().parsed.doc);
  assert.deepEqual(ledger.revisions.map(r => [r.operation, r.author]), [['format', 'Yalken tester'], ['format', 'Yalken tester']]);
  edit(doc('Alpha beta')); assert.equal((await h.save()).success, true);
  assert.equal(fs.readFileSync(h.file, 'utf8'), before);
  edit(working); assert.equal((await h.save()).success, true);
  assert.equal((await h.command('stop')).ok, true);
  const reopened = envelope.parseObservablePayload(fs.readFileSync(h.file, 'utf8')).doc;
  assert.deepEqual(model.normalizeNode(reopened), model.normalizeNode(working));
  ledger = model.readLedger(reopened); assert.equal(ledger.roundUndo.length, 1);
  assert.deepEqual(model.normalizeNode(model.decide(reopened, { action: 'rejectAll' }).doc), model.normalizeNode(doc('Alpha beta')));
});
test('actual Kernel pairs cut and paste across intervening atomic autosave, stop and durable reopen', async t => {
  const h = await harness(t);
  const multi = (...values) => ({ type: 'doc', content: values.map(text => doc(text).content[0]) });
  const original = multi('Start. Migrating words. End.', 'Destination. ');
  h.editor = envelope.composeObservablePayload({ doc: original }); fs.writeFileSync(h.file, h.editor);
  await h.start();
  const edit = value => { h.type('generation'); h.editor = envelope.composeObservablePayload({ doc: value }); };
  edit(multi('Start. End.', 'Destination. ')); assert.equal((await h.save()).success, true);
  assert.deepEqual(model.readLedger(h.context().parsed.doc).revisions.map(r => r.operation), ['delete']);
  const changed = multi('Start. End.', 'Destination. Migrating words. ');
  edit(changed); assert.equal((await h.save()).success, true);
  assert.equal((await h.command('stop')).ok, true);
  const reopened = envelope.parseObservablePayload(fs.readFileSync(h.file, 'utf8')).doc;
  const ledger = model.readLedger(reopened);
  assert.deepEqual(ledger.revisions.map(r => r.operation), ['delete', 'insert']);
  assert.ok(ledger.revisions[0].moveName);
  assert.equal(ledger.revisions[0].moveName, ledger.revisions[1].moveName);
  assert.equal(ledger.revisions[0].groupId, ledger.revisions[1].groupId);
  assert.ok(ledger.revisions.every(r => r.author === 'Yalken tester'));
  assert.equal(ledger.roundUndo.length, 1);
  assert.deepEqual(model.normalizeNode(reopened), model.normalizeNode(changed));
  assert.deepEqual(model.normalizeNode(model.decide(reopened, { action: 'reject', revisionId: ledger.revisions[1].id }).doc), model.normalizeNode(original));
  assert.deepEqual(model.normalizeNode(model.decide(reopened, { action: 'undo' }).doc), model.normalizeNode(original));
});
test('actual Kernel records Enter plus typing across autosaves and durable reopen, then restores the exact baseline', async t => {
  const h = await harness(t), original = fs.readFileSync(h.file, 'utf8'); await h.start();
  const edit = values => { h.type('generation'); h.editor = envelope.composeObservablePayload({ doc: { type: 'doc', content: values.map(text => doc(text).content[0]) } }); };
  edit(['Alpha', ' beta']); assert.equal((await h.save()).success, true);
  assert.equal(model.readLedger(h.context().parsed.doc).revisions[0].boundary, 'paragraph');
  edit(['Alpha', 'new beta']); assert.equal((await h.save()).success, true);
  assert.equal((await h.command('stop')).ok, true);
  const reopened = envelope.parseObservablePayload(fs.readFileSync(h.file, 'utf8')).doc;
  assert.equal(model.projection(reopened).current, 'Alpha\nnew beta');
  assert.equal(model.projection(reopened).original, 'Alpha beta');
  assert.equal(model.readLedger(reopened).roundUndo.length, 1);
  assert.deepEqual(model.normalizeNode(model.decide(reopened, { action: 'undo' }).doc), model.normalizeNode(envelope.parseObservablePayload(original).doc));
});
for (const kind of ['forgedLedger', 'unprepared', 'wrongTarget', 'sceneRace', 'projectRace', 'lifecycleRace', 'profile', 'entitlement', 'annotations', 'draft', 'writeFailure', 'oldGeneration', 'structure']) {
  test(`recording ${kind} cannot overwrite prior scene or clear the working buffer`, async t => {
    const h = await harness(t); await h.start(); h.type('Alpha beta!'); const before = fs.readFileSync(h.file, 'utf8');
    if (kind === 'forgedLedger') h.editor = envelope.composeObservablePayload({ doc: recording.derive(doc('Alpha beta'), doc('evil'), { author: 'forged', date: new Date().toISOString() }).doc });
    if (kind === 'draft') h.draft = true;
    if (kind === 'structure') h.editor = envelope.composeObservablePayload({ doc: { type: 'doc', content: [{ type: 'bulletList', content: [{ type: 'listItem', content: doc('Alpha beta').content }] }] } });
    const buffer = h.editor; let result;
    try {
      const snap = await h.capture();
      if (kind === 'sceneRace') fs.writeFileSync(h.file, 'owner edit');
      if (kind === 'projectRace') h.foreignProject = true;
      if (kind === 'lifecycleRace') h.lifecycle = 'foreign';
      if (kind === 'profile') h.allowed = false;
      if (kind === 'entitlement') h.entitled = false;
      if (kind === 'annotations') h.threads = [{ sceneId: 'roman/a.txt', status: 'open' }];
      if (kind === 'writeFailure') h.writeFailure = true;
      if (kind === 'oldGeneration') snap.generation = 0;
      if (kind === 'unprepared') snap.content += ' ';
      result = kind === 'wrongTarget' ? await h.c.commitWriterProjectSnapshot(h.file + '-copy', snap.content, snap.generation, null, 'copy') : await h.commit(snap);
    } catch (error) { result = { success: false, error: error.message }; }
    assert.equal(result.success, false, JSON.stringify(result)); assert.equal(h.writes, 0); assert.equal(h.c.isDirty, true);
    assert.equal(h.editor, buffer); assert.equal(fs.readFileSync(h.file, 'utf8'), kind === 'sceneRace' ? 'owner edit' : before);
  });
}
test('out-of-order capture cannot overwrite newer autosave; stop publication cannot discard new typing', async t => {
  const h = await harness(t); await h.start(); h.type('Alpha beta!'); const older = await h.capture();
  h.type('Alpha beta!!'); assert.equal((await h.save()).success, true);
  assert.equal((await h.commit(older)).success, false); assert.equal(model.projection(h.context().parsed.doc).current, 'Alpha beta!!');
  h.publicationRace = () => h.type('new unsaved text');
  const stopped = await h.command('stop'); assert.equal(stopped.ok, false); assert.equal(h.c.isDirty, true);
  assert.equal(envelope.parseObservablePayload(h.editor).text, 'new unsaved text');
});

const authoring = require('../../src/core/word-comment-authoring-v1.cjs');
const { textDigest } = require('../../src/core/word-comment-edit-intents-v1.cjs');
const typed = (id, from, removed, inserted, direction='forward', historyId=id) => ({id,historyId,direction,
  fromParagraphIndex:0,toParagraphIndex:0,fromUtf16:from,toUtf16:from+removed.length,removedParagraphs:[removed],insertedParagraphs:[inserted]});
const intents = (base,...edits) => ({schemaVersion:2,baselineTextSha256:textDigest([base]),edits});
function addComment(h) {
 const context=h.context(),beforeText=h.readComments().text;
 const plan=authoring.planCommentAuthoring({beforeText,projectId:context.projectId,sceneId:context.sceneId,paragraphs:['Alpha beta'],sceneSha256:context.sceneSha256,now:'2026-10-05T00:00:00Z',
 input:{action:'create',requestId:'runtime-comment',projectId:context.projectId,sceneId:context.sceneId,subjectId:context.subjectId,expectedStateSha256:beforeText===null?'':hash(beforeText),expectedSceneSha256:context.sceneSha256,body:'Editor note',anchor:{paragraphIndex:0,startUtf16:6,selectedText:'beta'}}});
 fs.mkdirSync(path.dirname(h.commentPath),{recursive:true});fs.writeFileSync(h.commentPath,plan.afterText);return plan.afterText;
}
test('actual Main and atomic transaction record comments across ACK prefixes, stop and durable round Undo', async t=>{
 const h=await harness(t),original=addComment(h);await h.start();
 h.type('!Alpha beta');h.intents=intents('Alpha beta',typed('first',0,'','!'));
 let r=await h.save();assert.equal(r.success,true,JSON.stringify(r));assert.equal(h.readComments().state.threads[0].anchor.startUtf16,7);
 // Simulate the existing renderer ACK dropping the already saved prefix.
 h.type('!Alpha beta!');h.intents=intents('!Alpha beta',typed('second',11,'','!'));
 r=await h.save();assert.equal(r.success,true,JSON.stringify(r));
 assert.deepEqual(h.readComments().state.threads[0].messages,JSON.parse(original).threads[0].messages);
 h.intents=intents('!Alpha beta!');assert.equal((await h.command('stop')).ok,true);
 const saved=h.context().parsed.doc,after=model.decide(saved,{action:'undo'}).doc;
 const plan=require('../../src/core/word-pending-comment-decisions-v1.cjs').planPendingCommentDecision({beforeText:h.readComments().text,projectId:'recording-project',sceneId:'roman/a.txt',beforeContent:h.context().raw,afterContent:envelope.composeObservablePayload({doc:after}),decision:{action:'undo'}});
 assert.deepEqual(JSON.parse(plan.afterText).threads[0].anchor,JSON.parse(original).threads[0].anchor);
});
for(const mode of ['commentsRace','missingIntents','forgedPlan']) test(`actual recording comments ${mode} refuses without extra scene or comment mutation`,async t=>{
 const h=await harness(t);addComment(h);await h.start();const scene=fs.readFileSync(h.file,'utf8'),comments=fs.readFileSync(h.commentPath,'utf8');
 h.type('!Alpha beta');h.intents=intents('Alpha beta',typed('first',0,'','!'));
 if(mode==='missingIntents')h.intents=null;
 if(mode==='forgedPlan') { const real=h.c.commitProjectTransaction;h.c.commitProjectTransaction=async args=>real({...args,commentState:{...args.commentState,afterText:args.commentState.afterText.replace('Editor note','forged')}}); }
 let r;try {const capture=await h.capture();if(mode==='commentsRace')fs.writeFileSync(h.commentPath,comments+' ');r=await h.commit(capture);}catch(error){r={success:false,error:error.message};}
 assert.equal(r.success,false,JSON.stringify(r));assert.equal(h.writes,0);assert.equal(fs.readFileSync(h.file,'utf8'),scene);
 assert.equal(fs.readFileSync(h.commentPath,'utf8'),mode==='commentsRace'?comments+' ':comments);assert.equal(h.c.isDirty,true);
});

const notesModel=require('../../src/core/word-manuscript-notes-v1.cjs');
function addBoundNotes(h, withComments = true, schemaVersion = 3) {
 const source=doc('AxxB tail'),revision={id:'revision-1',nativeId:'Word-owned',operation:'delete',author:'Word editor',date:'',dateUtc:'',
  groupId:null,state:'pending',paragraphIndex:0,from:1,to:3};
 const bound=model.bindLedger({schemaVersion,source,revisions:[revision],undo:[],redo:[],roundUndo:[],roundRedo:[],returnReceipts:[],
  noteSourcePoints:[{noteId:'note-left',paragraphIndex:0,offsetUtf16:1},{noteId:'note-right',paragraphIndex:0,offsetUtf16:3}]});
 h.editor=envelope.composeObservablePayload({doc:bound});fs.writeFileSync(h.file,h.editor);
 const body={type:'doc',content:[{type:'paragraph',attrs:{wordParagraphSpacing:{before:0,after:120},wordParagraphMarkLanguage:{val:'ru-RU'}},
  content:[{type:'text',text:'Rich 😀',marks:[{type:'bold'},{type:'textStyle',attrs:{fontFamily:'Georgia',fontSize:'14pt',wordLanguage:{val:'ru-RU',eastAsia:'ja-JP',bidi:'he-IL'}}}]},
   {type:'hardBreak'},{type:'text',text:'body'}]},{type:'paragraph',content:[]}]};
 const document={schemaVersion:1,projectId:'recording-project',notes:[{id:'private',scope:'inbox',body:'Private immutable note',title:'Keep'},
  ...['note-left','note-right'].map((id,i)=>({id,scope:'manuscript',title:'Note '+i,body:notesModel.validateNoteBody(body).text,deleted:false,
   createdAtUtc:'2026-10-05T00:00:00Z',updatedAtUtc:'2026-10-05T01:00:00Z',attachment:{scope:'manuscript'},
   manuscript:notesModel.bindManuscriptPayload({kind:i?'endnote':'footnote',body,sceneId:'roman/a.txt',offsetUtf16:1,sceneContent:h.editor})}))]};
 fs.writeFileSync(h.notePath,JSON.stringify(document));
 if(withComments){
  const context=h.context(),state=authoring.planCommentAuthoring({beforeText:null,projectId:context.projectId,sceneId:context.sceneId,
   paragraphs:['AB tail'],sceneSha256:context.sceneSha256,now:'2026-10-05T00:00:00Z',input:{action:'create',requestId:'notes-discussion',projectId:context.projectId,
    sceneId:context.sceneId,subjectId:context.subjectId,expectedStateSha256:'',expectedSceneSha256:context.sceneSha256,body:'Full discussion',anchor:{paragraphIndex:0,startUtf16:3,selectedText:'tail'}}});
  const full=JSON.parse(state.afterText);full.threads[0].messages.push({commentId:'reply-one',kind:'reply',body:'Editor reply',provenance:{author:'Editor'}},
   {commentId:'reply-two',kind:'reply',body:'Corrector reply',provenance:{author:'Corrector'}});
  fs.mkdirSync(path.dirname(h.commentPath),{recursive:true});fs.writeFileSync(h.commentPath,JSON.stringify(full));
 }
 return {doc:bound,document,scene:h.editor,comments:h.readComments().text};
}
const protectedNoteMeaning=document=>({...document,notes:document.notes.map(note=>!note.manuscript?note:{...note,
 manuscript:{...note.manuscript,reference:{...note.manuscript.reference,offsetUtf16:0,sourceTextSha256:''}}})});
const business=h=>[h.file,h.manifest,h.notePath,h.commentPath].map(file=>fs.existsSync(file)?fs.readFileSync(file,'utf8'):null);
for (const schemaVersion of [3, 5]) test(`actual Main schema${schemaVersion} stops recording after checked structural Undo and permits later durable editing`, async t => {
 const h = await harness(t), seed = addBoundNotes(h, true, schemaVersion), before = business(h);
 await h.start();
 const split = { id: 'enter', historyId: 'enter', direction: 'forward', fromParagraphIndex: 0,
  toParagraphIndex: 0, fromUtf16: 3, toUtf16: 3, removedParagraphs: [''], insertedParagraphs: ['', ''] };
 h.type('generation');
 h.editor = envelope.composeObservablePayload({ doc: { type: 'doc', content: [doc('AB ').content[0], doc('tail').content[0]] } });
 h.intents = intents('AB tail', split);
 await assert.rejects(h.save(), /RECORDING_INTENT_STRUCTURE_UNSUPPORTED/);
 assert.deepEqual(business(h), before); assert.equal(h.writes, 0);
 assert.equal((await h.c.readPendingRevisionProjection()).recording, true);
 h.type('AB tail');
 h.intents = intents('AB tail', split, { ...split, id: 'undo-enter', direction: 'undo',
  toParagraphIndex: 1, toUtf16: 0, removedParagraphs: ['', ''], insertedParagraphs: [''] });
 const stopped = await h.command('stop'); assert.equal(stopped.ok, true, JSON.stringify(stopped));
 assert.deepEqual(business(h).slice(0, 3), before.slice(0, 3)); assert.equal(h.writes, 1);
 // A cancelled authoring action still retains its exact comment Undo cursor.
 // Only that declared journal and its schema/revision change are permitted.
 const expectedComments = JSON.parse(seed.comments);
 expectedComments.schemaVersion = 'yalken.rtk.word.non-text-return-state.v5'; expectedComments.revision++;
 expectedComments.threads[0].anchorEditHistory = [{ schemaVersion: 2, historyId: 'enter', sessionId: h.sessionId,
  before: { sceneParagraphIndex: 0, startUtf16: 3, length: 4, status: 'open', blockTextSha256: hash('AB tail') },
  after: { sceneParagraphIndex: 1, startUtf16: 0, length: 4, status: 'open', blockTextSha256: hash('tail') },
  beforeTextSha256: hash('AB tail'), afterTextSha256: hash('tail'), undone: true }];
 assert.deepEqual(h.readComments().state, expectedComments);
 const afterStop = business(h);
 assert.equal(Object.hasOwn(await h.c.readPendingRevisionProjection(), 'recording'), false);
 assert.equal((await h.command('stop')).ok, false);
 assert.deepEqual(business(h), afterStop); assert.equal(h.writes, 1);
 assert.deepEqual(model.readLedger(h.context().parsed.doc), model.readLedger(seed.doc));
 h.intents = null; await h.start(); h.type('AB tail!'); h.intents = intents('AB tail', typed('later', 7, '', '!'));
 assert.equal((await h.save()).success, true); h.intents = intents('AB tail!');
 assert.equal((await h.command('stop')).ok, true); assert.equal(h.writes, 2);
 const reopened = envelope.parseObservablePayload(fs.readFileSync(h.file, 'utf8')).doc;
 assert.equal(model.projection(reopened).original, 'AxxB tail');
 assert.equal(model.projection(reopened).current, 'AB tail!');
 assert.deepEqual(model.readLedger(reopened).noteSourcePoints, model.readLedger(seed.doc).noteSourcePoints);
 assert.deepEqual(protectedNoteMeaning(JSON.parse(fs.readFileSync(h.notePath, 'utf8'))), protectedNoteMeaning(seed.document));
 assert.deepEqual(h.readComments().state.threads[0].messages, JSON.parse(seed.comments).threads[0].messages);
 assert.equal(model.readLedger(reopened).roundUndo.length, 1);
});
test('recording save independently replays complete proof four times with exact durable output',async t=>{
 const h=await harness(t),seed=addBoundNotes(h,true,5);
 h.c.Date=class extends Date{constructor(...args){super(...(args.length?args:['2026-10-05T12:00:07.000Z']));}};
 h.c.crypto={...crypto,randomUUID:()=> 'recording-proof-count'};
 await h.start();h.type('A!B tail');h.intents=intents('AB tail',typed('first',1,'','!'));
 const real=recording.derive,proofCalls=[];
 recording.derive=function(...args){const stack=new Error().stack;if(stack.includes('validateRecordingSaveProof'))proofCalls.push(stack);return real.apply(this,args);};
 let result;try{result=await h.save();}finally{recording.derive=real;}
 assert.equal(result.success,true,JSON.stringify(result));assert.equal(h.writes,1);
 const saved=business(h),ledger=model.readLedger(h.context().parsed.doc);
 assert.equal(model.projection(h.context().parsed.doc).current,'A!B tail');assert.equal(model.projection(h.context().parsed.doc).original,'AxxB tail');
 assert.deepEqual(protectedNoteMeaning(JSON.parse(saved[2])),protectedNoteMeaning(seed.document));
 assert.deepEqual(h.readComments().state.threads[0].messages,JSON.parse(seed.comments).threads[0].messages);
 assert.deepEqual(ledger.noteSourcePoints.map(p=>p.offsetUtf16),[2,4]);
 // Each unchanged public validator executes both previous and next derivations.
 t.diagnostic('PROOF_COUNT_OUTPUT '+JSON.stringify({proofCalls:proofCalls.length/2,saved}));
 assert.equal(proofCalls.length,8);assert.equal(proofCalls.filter(s=>s.includes('revalidatePendingRecordingSave')).length,0);
 assert.equal(proofCalls.filter(s=>s.includes('normalizeCommentState')).length,2);
 assert.equal(proofCalls.filter(s=>s.includes('normalizeNoteState')).length,2);
});
test('public recording planners and atomic writer independently refuse forged proof operands',async t=>{
 const h=await harness(t);addBoundNotes(h,true,5);await h.start();h.type('A!B tail');h.intents=intents('AB tail',typed('first',1,'','!'));
 const snapshot=await h.capture(),admission=h.c.resolvePendingRecordingSaveAdmission(h.file,snapshot.content,snapshot.generation);
 const input={projectId:'recording-project',sceneId:'roman/a.txt',beforeContent:admission.expected,afterContent:snapshot.content,recordingProofJson:admission.recordingProofJson};
 const comments=require('../../src/core/word-pending-recording-comments-v1.cjs'),commentInput={...input,beforeText:h.readComments().text},noteInput={...input,beforeText:fs.readFileSync(h.notePath,'utf8')};
 const commentState=comments.planRecordingCommentSave(commentInput),noteState=notesModel.planManuscriptNoteAnchorSave(noteInput),before=business(h),working=h.editor;
 for(const field of ['baseline','previous','next','source','points','history']){
  const forged={...input},proof=JSON.parse(input.recordingProofJson);
  if(field==='baseline'){const ledger=structuredClone(model.readLedger(envelope.parseObservablePayload(proof.baselineContent).doc));ledger.source.content[0].content[0].text='Foreign baseline';proof.baselineContent=envelope.composeObservablePayload({doc:model.bindLedger(ledger)});}
  if(field==='previous')proof.previousIntents.baselineTextSha256='f'.repeat(64);
  if(field==='next')proof.nextIntents.edits[0].insertedParagraphs=['?'];
  if(['source','points','history'].includes(field)){
   const ledger=structuredClone(model.readLedger(envelope.parseObservablePayload(forged.afterContent).doc));
   if(field==='source')ledger.source.content[0].content.find(n=>n.text.includes('xx')).text='Foreign source';
   if(field==='points')ledger.noteSourcePoints[0].offsetUtf16=1;
   if(field==='history')ledger.returnReceipts.push({roundId:'foreign',artifactSha256:'f'.repeat(64)});
   forged.afterContent=envelope.composeObservablePayload({doc:model.bindLedger(ledger)});
  }
  forged.recordingProofJson=JSON.stringify(proof);
  assert.throws(()=>comments.planRecordingCommentSave({...commentInput,...forged}),error=>{t.diagnostic('FORGED_PUBLIC '+field+' comments '+error.message);return /RECORDING_|COMMENT_/u.test(error.message);});
  assert.throws(()=>notesModel.planManuscriptNoteAnchorSave({...noteInput,...forged}),error=>{t.diagnostic('FORGED_PUBLIC '+field+' notes '+error.message);return /RECORDING_|COMMENT_/u.test(error.message);});
  for(const cohort of ['comments','notes']){
   const manifest=fs.readFileSync(h.manifest,'utf8');
   await assert.rejects(tx.commitProjectTransaction({scenePath:h.file,manifestPath:h.manifest,expectedSceneContent:input.beforeContent,sceneContent:forged.afterContent,
    expectedManifestContent:manifest,manifestContent:manifest,revision:snapshot.generation,
    publishManifest:async({manifestPath,expectedText,nextText,revision})=>{assert.equal(fs.readFileSync(manifestPath,'utf8'),expectedText);await durableSaveTransaction({filePath:manifestPath,content:nextText,revision});},
    ...(cohort==='comments'?{commentState:{...commentState,recordingProofJson:forged.recordingProofJson}}:{noteState:{...noteState,recordingProofJson:forged.recordingProofJson}})}),
    cohort==='comments'?/E_PROJECT_TRANSACTION_COMMENT_STATE/u:/E_PROJECT_TRANSACTION_NOTE_STATE/u,field+' '+cohort);
   assert.deepEqual(business(h),before);assert.equal(h.editor,working);assert.equal(h.writes,0);
  }
 }
});
test('both recording save revalidation stages retain complete fresh drift guards',async t=>{
 for(const stage of [1,2])for(const field of ['scene','comments','notes','session','generation','project','manifest']){
  const h=await harness(t);addBoundNotes(h);await h.start();h.type('A!B tail');h.intents=intents('AB tail',typed('first',1,'','!'));const snapshot=await h.capture(),working=h.editor;
  const port=h.c.commitWriterProjectSnapshot.recordingPort;let calls=0,expected=business(h);
  h.c.commitWriterProjectSnapshot.recordingPort={...port,revalidate:async admission=>{
   if(++calls===stage){if(field==='scene')fs.appendFileSync(h.file,' ');if(field==='comments')fs.appendFileSync(h.commentPath,' ');if(field==='notes')fs.appendFileSync(h.notePath,' ');
    if(field==='session')h.c.commentAuthoringSessionId='foreign';if(field==='generation')admission.session.savedGeneration=snapshot.generation+1;
    if(field==='project')h.foreignProject=true;if(field==='manifest')fs.appendFileSync(h.manifest,' ');expected=business(h);}
   return port.revalidate(admission);
  }};
  const refused=await h.commit(snapshot);assert.equal(refused.success,false,field+' '+stage);assert.equal(calls,field==='manifest'?2:stage,field+' '+stage);assert.equal(h.writes,0);
  assert.deepEqual(business(h),expected);assert.equal(h.editor,working);assert.equal(h.c.isDirty,true);
 }
});
for(const comments of [false,true]) for(const schemaVersion of [3,5]) test(`actual Main schema${schemaVersion} records notes${comments?' plus complete discussions':''} across atomic ACKs and restart`,async t=>{
 const h=await harness(t),seed=addBoundNotes(h,comments,schemaVersion);
 const capability=await h.c.readPendingRevisionProjection();assert.equal(capability.recordingAvailable,true,JSON.stringify(capability));
 await h.start();h.type('A!B tail');h.intents=intents('AB tail',typed('first',1,'','!'));
 let result=await h.save();assert.equal(result.success,true,JSON.stringify(result));
 let ledger=model.readLedger(h.context().parsed.doc);assert.deepEqual(ledger.noteSourcePoints.map(p=>p.offsetUtf16),[2,4]);
 assert.equal(ledger.source.content[0].content.map(n=>n.text).join(''),'A!xxB tail');
 let savedNotes=JSON.parse(fs.readFileSync(h.notePath,'utf8'));assert.deepEqual(savedNotes.notes.filter(n=>n.manuscript).map(n=>n.manuscript.reference.offsetUtf16),[2,2]);
 assert.deepEqual(protectedNoteMeaning(savedNotes),protectedNoteMeaning(seed.document));
 h.type('A!B tail?');h.intents=intents('A!B tail',typed('second',8,'','?'));
 result=await h.save();assert.equal(result.success,true,JSON.stringify(result));
 ledger=model.readLedger(h.context().parsed.doc);assert.deepEqual(ledger.noteSourcePoints.map(p=>p.offsetUtf16),[2,4]);assert.equal(ledger.roundUndo.length,1);
 h.intents=intents('A!B tail?');assert.equal((await h.command('stop')).ok,true);
 const reopened=envelope.parseObservablePayload(fs.readFileSync(h.file,'utf8')).doc,stored=business(h);
 assert.equal(model.projection(reopened).current,'A!B tail?');assert.equal(model.projection(reopened).original,'AxxB tail');
 if(comments){const before=JSON.parse(seed.comments),after=h.readComments().state;
  assert.deepEqual(after.threads[0].messages,before.threads[0].messages);assert.equal(after.threads[0].anchor.startUtf16,4);
  assert.deepEqual(after.events,before.events);assert.equal(after.threads[0].status,before.threads[0].status);
 }
 const undo=model.decide(reopened,{action:'undo'}).doc;
 const noteUndo=notesModel.planManuscriptNoteAnchorSave({beforeText:stored[2],projectId:'recording-project',sceneId:'roman/a.txt',beforeContent:stored[0],afterContent:envelope.composeObservablePayload({doc:undo})});
 assert.deepEqual(JSON.parse(noteUndo.afterText),seed.document);assert.deepEqual(model.roundFrame(model.readLedger(undo)),model.roundFrame(model.readLedger(seed.doc)));
 const redo=model.decide(undo,{action:'redo'}).doc;assert.deepEqual(redo,reopened);
 const noteRedo=notesModel.planManuscriptNoteAnchorSave({beforeText:noteUndo.afterText,projectId:'recording-project',sceneId:'roman/a.txt',beforeContent:envelope.composeObservablePayload({doc:undo}),afterContent:stored[0]});
 assert.deepEqual(JSON.parse(noteRedo.afterText),JSON.parse(stored[2]));
 // An ordinary new Main session reads saved bytes, not a previous session's pins.
 assert.equal((await h.c.readPendingRevisionProjection()).recordingAvailable,true);await h.start();h.intents=intents('A!B tail?');
 assert.equal((await h.command('stop')).ok,true);assert.deepEqual(business(h),stored);
});
for(const mode of ['missingIntents','notesBeforeCapture','notesAfterCapture','otherNoteAfterCapture','noteRoster','noteDigest','noteOffset','forgedPoints','forgedBody','forgedAfter','noteDraft','failedSave','lease','session','owner'])
 test(`actual note recording ${mode} refuses without business writes or working-buffer loss`,async t=>{
  const h=await harness(t);addBoundNotes(h);await h.start();h.type('A!B tail');h.intents=intents('AB tail',typed('first',1,'','!'));
  if(mode==='missingIntents')h.intents=null;if(mode==='noteDraft')h.noteDraft=true;
  const mutateNotes=mutation=>{const document=JSON.parse(fs.readFileSync(h.notePath,'utf8'));mutation(document);fs.writeFileSync(h.notePath,JSON.stringify(document));};
  if(mode==='notesBeforeCapture')mutateNotes(d=>d.notes[1].title='Foreign title');
  if(mode==='noteRoster')mutateNotes(d=>d.notes.splice(1,1));
  if(mode==='noteDigest')mutateNotes(d=>d.notes[1].manuscript.reference.sourceTextSha256='0'.repeat(64));
  if(mode==='noteOffset')mutateNotes(d=>d.notes[1].manuscript.reference.offsetUtf16=0);
  const working=h.editor;let result;
  try{
   const snapshot=await h.capture();
   if(mode==='notesAfterCapture')mutateNotes(d=>d.notes[2].title='Foreign after capture');
   if(mode==='otherNoteAfterCapture')mutateNotes(d=>d.notes[0].body='Foreign private note');
   if(mode==='failedSave')h.writeFailure=true;
   if(mode==='session')h.c.commentAuthoringSessionId='foreign-session';
   if(mode==='owner')h.c.activeStage10ApplicationBootstrap={};
   if(mode==='lease')h.c.getMainProjectManifestAuthority=async()=>({withProjectLease:async()=>{throw Error('PROJECT_LEASE_DENIED');}});
   if(['forgedPoints','forgedBody','forgedAfter'].includes(mode)){
    const real=h.c.commitProjectTransaction;
    h.c.commitProjectTransaction=async args=>{
     const forged={...args,noteState:structuredClone(args.noteState)};
     if(mode==='forgedPoints'){
      const ledger=structuredClone(model.readLedger(envelope.parseObservablePayload(args.sceneContent).doc));ledger.noteSourcePoints[0].offsetUtf16=1;
      forged.sceneContent=envelope.composeObservablePayload({doc:model.bindLedger(ledger)});
     }else{const notes=JSON.parse(forged.noteState.afterText);
      if(mode==='forgedBody')notes.notes[1].title='Forged metadata';else notes.notes[1].manuscript.reference.offsetUtf16=0;
      forged.noteState.afterText=JSON.stringify(notes);
     }
     return real(forged);
    };
   }
   const before=business(h);result=await h.commit(snapshot);assert.deepEqual(business(h),before);
  }catch(error){result={success:false,error:error.message};}
  assert.equal(result.success,false,JSON.stringify(result));assert.equal(h.writes,0);assert.equal(h.editor,working);assert.equal(h.c.isDirty,true);
 });
test('first admission of an unbound note roster remains typed refused with exact bytes',async t=>{
 const h=await harness(t);addBoundNotes(h,false);h.editor=envelope.composeObservablePayload({doc:doc('AB tail')});fs.writeFileSync(h.file,h.editor);
 const before=business(h),projection=await h.c.readPendingRevisionProjection();
 assert.equal(projection,null);const refused=await h.command('start');assert.equal(refused.ok,false);assert.match(JSON.stringify(refused),/RECORDING_NOTE_BINDINGS_UNSUPPORTED/);
 assert.deepEqual(business(h),before);assert.equal(h.writes,0);
});
test('real PM gestures and SAVED prefix ACKs persist exact note occurrences through typing Undo and Redo',async t=>{
 const [{Editor},{default:StarterKit},ui]=await Promise.all([import('@tiptap/core'),import('@tiptap/starter-kit'),import('../../src/renderer/tiptap/documentCommentEditIntents.mjs')]);
 const h=await harness(t),seed=addBoundNotes(h),editor=new Editor({element:null,
  extensions:[StarterKit.configure({trailingNode:false}),ui.DocumentCommentEditIntents],content:doc('AB tail')});
 editor.view.updateState(editor.state.reconfigure({plugins:editor.extensionManager.plugins}));Object.defineProperty(editor,'isDestroyed',{get:()=>false});
 try{
  await h.start();
  const persist=async(expected,offsets)=>{
   h.type(editor.state.doc.textContent);h.editor=envelope.composeObservablePayload({doc:editor.getJSON()});
   const wire=ui.getCommentEditIntentsJson(editor);assert.equal(typeof wire,'string');h.intents=JSON.parse(wire);
   const result=await h.save();assert.equal(result.success,true,JSON.stringify(result));
   assert.equal(result.commentEditIntentsSha256,hash(wire));assert.equal(ui.checkpointCommentEditIntents(editor,result.commentEditIntentsSha256),true);
   assert.equal(model.projection(h.context().parsed.doc).current,expected);
   assert.deepEqual(model.readLedger(h.context().parsed.doc).noteSourcePoints.map(p=>p.offsetUtf16),offsets);
   assert.deepEqual(protectedNoteMeaning(JSON.parse(fs.readFileSync(h.notePath,'utf8'))),protectedNoteMeaning(seed.document));
   assert.deepEqual(h.readComments().state.threads[0].messages,JSON.parse(seed.comments).threads[0].messages);
  };
  editor.commands.setTextSelection(2);editor.commands.insertContent({type:'text',text:'!'});await persist('A!B tail',[2,4]);
  editor.commands.insertContent({type:'text',text:'?'});await persist('A!?B tail',[3,5]);
  assert.equal(editor.commands.undo(),true);await persist('AB tail',[1,3]);
  assert.deepEqual(model.roundFrame(model.readLedger(h.context().parsed.doc)),model.roundFrame(model.readLedger(seed.doc)));
  assert.equal(editor.commands.redo(),true);await persist('A!?B tail',[3,5]);
  h.intents=JSON.parse(ui.getCommentEditIntentsJson(editor));assert.equal((await h.command('stop')).ok,true);
  assert.equal(model.projection(envelope.parseObservablePayload(fs.readFileSync(h.file,'utf8')).doc).original,'AxxB tail');
 }finally{editor.destroy();}
});
test('failed stop with notes retains active recording and exact buffer; owned retry advances pins only after atomic ACK',async t=>{
 const h=await harness(t);addBoundNotes(h);await h.start();h.type('A!B tail');h.intents=intents('AB tail',typed('first',1,'','!'));
 const before=business(h),buffer=h.editor;h.writeFailure=true;
 const failed=await h.command('stop');assert.equal(failed.ok,false);assert.match(JSON.stringify(failed),/RECORDING_SAVE_FAILED_BUFFER_RETAINED/);
 assert.deepEqual(business(h),before);assert.equal(h.editor,buffer);assert.equal(h.c.isDirty,true);assert.equal((await h.c.readPendingRevisionProjection()).recording,true);
 h.writeFailure=false;assert.equal((await h.command('stop')).ok,true);assert.equal(model.projection(h.context().parsed.doc).current,'A!B tail');
 assert.deepEqual(JSON.parse(fs.readFileSync(h.notePath,'utf8')).notes.filter(n=>n.manuscript).map(n=>n.manuscript.reference.offsetUtf16),[2,2]);
});
for(const forgedPoint of [false,true]) test(`atomic note MODE omitted proof ${forgedPoint?'with forged coincident source point':'with new recording source'} refuses without writes`,async t=>{
 const h=await harness(t);addBoundNotes(h,false);await h.start();h.type('A!B tail');h.intents=intents('AB tail',typed('first',1,'','!'));
 const snapshot=await h.capture(),before=business(h),working=h.editor,real=h.c.commitProjectTransaction;
 h.c.commitProjectTransaction=async args=>{
  const noteState=structuredClone(args.noteState);delete noteState.recordingProofJson;
  let sceneContent=args.sceneContent;
  if(forgedPoint){const ledger=structuredClone(model.readLedger(envelope.parseObservablePayload(sceneContent).doc));ledger.noteSourcePoints[0].offsetUtf16=1;
   sceneContent=envelope.composeObservablePayload({doc:model.bindLedger(ledger)});
   const raw=notesModel.planManuscriptNoteAnchorSave({beforeText:noteState.beforeText,projectId:'recording-project',sceneId:'roman/a.txt',beforeContent:args.expectedSceneContent,afterContent:sceneContent});
   noteState.afterText=raw.afterText;
  }
  return real({...args,sceneContent,noteState});
 };
 const result=await h.commit(snapshot);assert.equal(result.success,false,JSON.stringify(result));assert.match(JSON.stringify(result),/NOTE_STATE/);
 assert.equal(h.writes,0);assert.deepEqual(business(h),before);assert.equal(h.editor,working);assert.equal(h.c.isDirty,true);
});
test('atomic no-proof note MODE reconstructs complete Core decisions and source-changing round UndoRedo; forged history refuses',async t=>{
 const h=await harness(t),seed=addBoundNotes(h,false,5);await h.start();h.type('A!B tail');h.intents=intents('AB tail',typed('first',1,'','!'));
 assert.equal((await h.save()).success,true);h.intents=intents('A!B tail');assert.equal((await h.command('stop')).ok,true);
 const commit=async(next,mutate=null)=>{
  const beforeContent=fs.readFileSync(h.file,'utf8'),beforeText=fs.readFileSync(h.notePath,'utf8'),afterContent=envelope.composeObservablePayload({doc:next});
  const noteState=notesModel.planManuscriptNoteAnchorSave({beforeText,projectId:'recording-project',sceneId:'roman/a.txt',beforeContent,afterContent,includeUnchanged:true});
  const beforeManifest=fs.readFileSync(h.manifest,'utf8'),request={scenePath:h.file,manifestPath:h.manifest,expectedSceneContent:beforeContent,sceneContent:afterContent,
   expectedManifestContent:beforeManifest,manifestContent:beforeManifest,revision:1,noteState,
   publishManifest:async({manifestPath,expectedText,nextText,revision})=>{assert.equal(fs.readFileSync(manifestPath,'utf8'),expectedText);await durableSaveTransaction({filePath:manifestPath,content:nextText,revision});}};
  if(mutate)mutate(request);return tx.commitProjectTransaction(request);
 };
 const current=()=>envelope.parseObservablePayload(fs.readFileSync(h.file,'utf8')).doc;
 for(const input of [{action:'accept',revisionId:'revision-1'},{action:'undo'},{action:'reject',revisionId:'revision-1'},{action:'undo'},
  {action:'rejectAll'},{action:'undo'},{action:'redo'},{action:'undo'},{action:'acceptAll'},{action:'undo'},{action:'undo'},{action:'redo'}]){
  const next=model.decide(current(),input).doc;await commit(next);assert.deepEqual(current(),next);
  assert.deepEqual(protectedNoteMeaning(JSON.parse(fs.readFileSync(h.notePath,'utf8'))),protectedNoteMeaning(seed.document));
 }
 await commit(current()); // Explicit unchanged MODE is exact, without fresh return history.
 const before=business(h),forged=structuredClone(model.readLedger(current()));forged.returnReceipts.push({roundId:'forged',artifactSha256:'f'.repeat(64)});
 await assert.rejects(commit(model.bindLedger(forged)),/NOTE_STATE/);assert.deepEqual(business(h),before);
 const swapped=structuredClone(model.readLedger(current()));swapped.noteSourcePoints[0].offsetUtf16=1;
 await assert.rejects(commit(model.bindLedger(swapped)),/NOTE_STATE/);assert.deepEqual(business(h),before);
 const hidden=structuredClone(model.readLedger(current())),owner=hidden.source.content[0].content.find(node=>node.text.includes('xx'));assert.ok(owner);owner.text=owner.text.replace('xx','zz');
 const changedSource=model.bindLedger(hidden);assert.equal(model.projection(changedSource).current,model.projection(current()).current);
 await assert.rejects(commit(changedSource),/NOTE_STATE/);assert.deepEqual(business(h),before);
});

test('unchanged stop uses committed complete working checkpoint without derive or write',async t=>{
 const h=await harness(t);await h.start();h.type('Alpha beta!');assert.equal((await h.save()).success,true);
 const before=business(h),writes=h.writes;let derives=0;
 h.c.pendingRecordingModel={...recording,derive(...args){derives++;return recording.derive(...args);}};
 const result=await h.command('stop');assert.equal(result.ok,true,JSON.stringify(result));
 assert.equal(derives,0);assert.equal(h.writes,writes);assert.deepEqual(business(h),before);
});

test('actual PM conditional recording callback preserves private envelope and complete history at start and fast stop',async t=>{
 const [ui,pending,lists,{history}]=await Promise.all([
  import('../../src/renderer/tiptap/documentCommentEditIntents.mjs'),import('../../src/renderer/tiptap/wordPendingRevisions.mjs'),
  import('../../src/renderer/tiptap/documentListNumbering.mjs'),import('@tiptap/pm/history')]);
 const h=await harness(t);const privateDoc=doc('Alpha beta'),meta={synopsis:'Private 😀',status:'draft',tags:{pov:'A',line:'B',place:'C'}};
 h.editor=envelope.composeObservablePayload({doc:privateDoc,metaEnabled:true,meta,cards:[{id:'card',title:'Private',body:'Keep'}]});fs.writeFileSync(h.file,h.editor);
 const editor=new production.Editor({element:null,extensions:production.extensions,content:privateDoc});
 editor.view.updateState(editor.state.reconfigure({plugins:editor.extensionManager.plugins}));Object.defineProperty(editor,'isDestroyed',{get:()=>false});
 editor.getJSON=()=>editor.state.doc.toJSON();editor.getText=()=>editor.state.doc.textBetween(0,editor.state.doc.content.size,'\n');
 const tiptap=fs.readFileSync(path.join(__dirname,'../../src/renderer/tiptap/index.js'),'utf8');
 const part=name=>tiptap.match(new RegExp('(?:export )?function '+name+'\\([^]*?\\n}'))[0].replace(/^export /,'');
 Object.assign(h.renderer,{currentEditorInstance:editor,wordSections:require('../../src/core/word-sections-v1.cjs'),
  wordStories:require('../../src/core/word-stories-projection-v1.cjs'),wordListNumbering:require('../../src/core/word-list-numbering-v1.cjs'),
  numberingDocumentJSON:lists.numberingDocumentJSON,setCheckedReviewDocument:pending.setCheckedDocument,history,notifyFormattingStateChange(){}});
 vm.runInContext(['readEditorText','readEditorDocument','getTiptapDocumentSnapshot','setCheckedDocument','setTiptapDocumentSnapshot'].map(part).join('\n'),h.renderer);
 h.renderer.getTiptapCommentEditIntentsJson=()=>ui.getCommentEditIntentsJson(editor);
 try{
  const before=business(h);await h.start();assert.deepEqual(business(h),before);assert.equal(h.editor,installed(before[0]));
  assert.equal((await h.command('stop')).ok,true);assert.deepEqual(business(h),before);assert.equal(h.writes,0);
  await h.start();editor.commands.setTextSelection(11);editor.commands.insertContent({type:'text',text:'!'});
  h.editor=h.renderer.composeDocumentContent();h.generation++;h.c.lastSignaledEditGeneration=h.generation;h.c.isDirty=true;
  const savedResult=await h.save();assert.equal(savedResult.success,true,JSON.stringify(savedResult));const saved=business(h),ledger=model.readLedger(h.context().parsed.doc),writes=h.writes;
  let derives=0;h.c.pendingRecordingModel={...recording,derive(...args){derives++;return recording.derive(...args);}};
  const stopped=await h.command('stop');assert.equal(stopped.ok,true,JSON.stringify(stopped));assert.equal(derives,0);assert.equal(h.writes,writes);assert.deepEqual(business(h),saved);
  const actual=envelope.parseObservablePayload(h.renderer.composeDocumentContent()),expected=envelope.parseObservablePayload(saved[0]);
  assert.equal(actual.hasMetaBlock,true);assert.deepEqual(actual.meta,expected.meta);assert.deepEqual(actual.cards,expected.cards);
  assert.deepEqual(model.readLedger(actual.doc),ledger);assert.equal(model.projection(actual.doc).original,'Alpha beta');
 }finally{editor.destroy();}
});
test('source-owned installed LIVE projection matches full production schema without changing pending source or private fields',async t=>{
 const h=await harness(t),text=(value,marks)=>({type:'text',text:value,...(marks?{marks}:{} )}),paragraph=content=>({type:'paragraph',content});
 const rich=[{type:'bold'},{type:'textStyle',attrs:{fontFamily:'Georgia',fontSize:'14pt',wordLanguage:{val:'ru-RU',eastAsia:'ja-JP',bidi:'ar-SA'}}},
  {type:'link',attrs:{href:'https://example.invalid/read',target:'_blank',rel:'noopener noreferrer nofollow',class:null}}];
 const source={type:'doc',content:[paragraph([text('A'),text('B')]),paragraph([]),
  paragraph([text('A',rich),text('B',[rich[2],rich[0],rich[1]]),{type:'hardBreak'},text('C',[{type:'italic'}])]),
  {type:'heading',attrs:{level:7,textAlign:'right'},content:[text('Head')]},
  {type:'bulletList',content:[{type:'listItem',content:[paragraph([text('List')])]}]},
  {type:'blockquote',content:[paragraph([text('Quote')])]},
  {type:'codeBlock',attrs:{language:'javascript'},content:[text('const a=1;')]}]};
 const meta={synopsis:'Private 😀',status:'draft',tags:{pov:'A',line:'B',place:'C'}},cards=[{id:'card',title:'Private',body:'Keep'}];
 const raw=envelope.composeObservablePayload({doc:source,metaEnabled:true,meta,cards}),before=JSON.stringify(source);
 const observed=await h.c.pendingRecordingInstalledContent(raw);assert.equal(observed,installed(raw));assert.equal(JSON.stringify(source),before);
 const parsed=envelope.parseObservablePayload(observed);assert.deepEqual(parsed.meta,envelope.parseObservablePayload(raw).meta);
 assert.deepEqual(parsed.cards,envelope.parseObservablePayload(raw).cards);assert.equal(parsed.doc.content[0].content[0].text,'AB');
 assert.equal(Object.hasOwn(parsed.doc.content[1],'content'),false);assert.equal(parsed.doc.content[2].content[1].type,'hardBreak');
 assert.deepEqual(parsed.doc.content[2].content[0].marks.map(m=>m.type),['link','textStyle','bold']);
 for(const language of [undefined,null,'']){const value=JSON.parse(JSON.stringify(source));
  value.content[6].attrs=language===undefined?{}:{language};const bytes=envelope.composeObservablePayload({doc:value});
  assert.equal(await h.c.pendingRecordingInstalledContent(bytes),installed(bytes));}
 const pending=recording.derive(doc('AxxB'),doc('AB'),{author:'Owned',date:'2026-10-07T12:00:00.000Z'}).doc;
 const pendingRaw=envelope.composeObservablePayload({doc:pending,metaEnabled:true,meta,cards}),saved=JSON.stringify(pending);
 const full=envelope.parseObservablePayload(await h.c.pendingRecordingInstalledContent(pendingRaw)).doc;
 assert.deepEqual(model.readLedger(full),model.readLedger(pending));assert.deepEqual(model.projection(full),model.projection(pending));
 assert.equal(model.projection(full).original,'AxxB');assert.equal(model.projection(full).current,'AB');assert.equal(JSON.stringify(pending),saved);
 for(const field of ['textAttr','paragraphAttr','markAttr','unknownMark','duplicateMark']){
  const bad=doc('Unknown');if(field==='textAttr')bad.content[0].content[0].attrs={unknown:null};
  if(field==='paragraphAttr')bad.content[0].attrs={unknown:'protected'};
  if(field==='markAttr')bad.content[0].content[0].marks=[{type:'textStyle',attrs:{fontFamily:'Georgia',unknown:'protected'}}];
  if(field==='unknownMark')bad.content[0].content[0].marks=[{type:'unknown',attrs:{owner:'protected'}}];
  if(field==='duplicateMark')bad.content[0].content[0].marks=[{type:'bold'},{type:'bold'}];
  const bytes=envelope.composeObservablePayload({doc:bad}),snapshot=JSON.stringify(bad),target=await h.c.pendingRecordingInstalledContent(bytes);
  if(field==='unknownMark'||field==='duplicateMark')assert.throws(()=>installed(bytes));else assert.notEqual(target,installed(bytes));
  assert.equal(JSON.stringify(bad),snapshot);
 }
});
for(const race of ['attach','delivery','install'])test('conditional recording publication retains unsignalled '+race+' edit and active session',async t=>{
 const h=await harness(t);await h.start();h.type('Alpha beta!');await h.save();const before=business(h),writes=h.writes;
 const mutate=()=>{h.editor=envelope.composeObservablePayload({doc:doc('Unsignalled owner text')});};
 if(race==='attach')h.publicationRace=mutate;else if(race==='delivery')h.deliveryRace=mutate;else h.installRace=mutate;
 const result=await h.command('stop');assert.equal(result.ok,false,JSON.stringify(result));
 assert.equal(envelope.parseObservablePayload(h.editor).text,'Unsignalled owner text');assert.deepEqual(business(h),before);
 assert.equal(h.writes,writes);assert.equal((await h.c.readPendingRevisionProjection()).recording,true);
});
for(const mode of ['timeout','wrongIdentity','wrongGeneration','wrongContent'])test('unconfirmed recording '+mode+' ACK retains session and fresh explicit retry confirms installed saved target',async t=>{
 const h=await harness(t);await h.start();h.type('Alpha beta!');await h.save();const before=business(h),writes=h.writes;h.timeoutMs=20;
 // Only publication ACKs are disrupted: raw observation remains actual.
 const send=h.renderer.window.electronAPI.sendEditorSnapshotResponse;
 h.renderer.window.electronAPI.sendEditorSnapshotResponse=(requestId,snapshot)=>{
  if(snapshot?.content===installed(before[0])){
   if(mode==='timeout'){h.lateReply={requestId,snapshot};return;}
   snapshot={...snapshot,...(mode==='wrongIdentity'?{projectId:'foreign'}:mode==='wrongGeneration'?{generation:999}:{content:'foreign'})};
  }send(requestId,snapshot);
 };
 const failed=await h.command('stop');assert.equal(failed.ok,false,JSON.stringify(failed));assert.equal(h.editor,installed(before[0]));
 assert.equal((await h.c.readPendingRevisionProjection()).recording,true);assert.deepEqual(business(h),before);assert.equal(h.writes,writes);
 h.renderer.window.electronAPI.sendEditorSnapshotResponse=send;
 if(h.lateReply){send(h.lateReply.requestId,h.lateReply.snapshot);send(h.lateReply.requestId,h.lateReply.snapshot);}
 const retry=await h.command('stop');assert.equal(retry.ok,true,JSON.stringify(retry));assert.equal(h.writes,writes);assert.deepEqual(business(h),before);
 assert.equal((await h.c.readPendingRevisionProjection()).recording,undefined);
});
for(const mutation of ['scene','manifest','comments','notes','lifecycle','capability','draft','generation','provenance'])test('unchanged stop '+mutation+' fresh guard refuses before publication without business writes',async t=>{
 const h=await harness(t);await h.start();h.type('Alpha beta!');await h.save();const writes=h.writes,publications=h.publications;
 if(mutation==='scene')fs.writeFileSync(h.file,h.editor);
 if(mutation==='manifest')fs.appendFileSync(h.manifest,' ');
 if(mutation==='comments')addComment(h);
 if(mutation==='notes')fs.writeFileSync(h.notePath,JSON.stringify({schemaVersion:1,projectId:'recording-project',notes:[]}));
 if(mutation==='lifecycle')h.lifecycle='new';if(mutation==='capability')h.allowed=false;if(mutation==='draft')h.draft=true;
 if(mutation==='generation')h.c.lastSignaledEditGeneration++;
 if(mutation==='provenance')vm.runInContext('activePendingRecording.provenance={schemaVersion:2,baselineTextSha256:"'+hash('foreign')+'",edits:[]}',h.c);
 const before=business(h),buffer=h.editor,result=await h.command('stop');assert.equal(result.ok,false,JSON.stringify(result));
 assert.deepEqual(business(h),before);assert.equal(h.editor,buffer);assert.equal(h.writes,writes);assert.equal(h.publications,publications);
});
test('same visible text with a new closed Undo intent uses full independently replayed save',async t=>{
 const h=await harness(t);addComment(h);await h.start();h.type('Alpha beta!');h.intents=intents('Alpha beta',typed('first',10,'','!'));
 await h.save();const writes=h.writes;h.intents=intents('Alpha beta!',typed('forward',10,'','?'),typed('undo',10,'?','','undo','forward'));h.generation++;h.c.lastSignaledEditGeneration=h.generation;h.c.isDirty=true;
 let derives=0;h.c.pendingRecordingModel={...recording,derive(...args){derives++;return recording.derive(...args);}};
 const result=await h.command('stop');assert.equal(result.ok,true,JSON.stringify(result));assert.equal(derives,1);assert.equal(h.writes,writes+1);
});

test('checked recording install refusal and typing after installation preserve buffer and active session',async t=>{
 for(const mode of ['refused','typed']){
  const h=await harness(t);await h.start();h.type('Alpha beta!');await h.save();const before=business(h),writes=h.writes,working=h.editor;
  if(mode==='refused')h.renderer.setTiptapDocumentSnapshot=()=>false;
  else{
   const send=h.renderer.window.electronAPI.sendEditorSnapshotResponse;
   h.renderer.window.electronAPI.sendEditorSnapshotResponse=(id,snapshot)=>{
    if(snapshot?.content===installed(before[0])){h.renderer.document=doc('Later owner input');h.generation++;h.c.lastSignaledEditGeneration=h.generation;h.c.isDirty=true;}
    send(id,snapshot);
   };
  }
  const result=await h.command('stop');assert.equal(result.ok,false,JSON.stringify(result));assert.deepEqual(business(h),before);
  assert.equal(h.writes,writes);assert.equal(h.editor,mode==='refused'?working:envelope.composeObservablePayload({doc:doc('Later owner input')}));
  assert.equal((await h.c.readPendingRevisionProjection()).recording,true);
 }
});
test('initial publication timeout retains session and one fresh observation recovers start without writing',async t=>{
 const h=await harness(t),before=business(h);h.timeoutMs=20;
 const send=h.renderer.window.electronAPI.sendEditorSnapshotResponse;
 h.renderer.window.electronAPI.sendEditorSnapshotResponse=(id,snapshot)=>{if(h.publications)return;send(id,snapshot);};
 const start=await h.command('start');assert.equal(start.ok,false);assert.match(JSON.stringify(start),/RECORDING_PUBLICATION_UNCONFIRMED/);
 const projection=await h.c.readPendingRevisionProjection();assert.equal(projection.recording,true);h.sessionId=projection.sessionId;
 h.renderer.window.electronAPI.sendEditorSnapshotResponse=send;
 h.intents=intents('Alpha beta',typed('initial-new',10,'','!'),typed('initial-undo',10,'!','','undo','initial-new'));
 const refused=await h.command('stop');assert.equal(refused.ok,false);assert.deepEqual(business(h),before);assert.equal(h.writes,0);
 h.intents=null;
 assert.equal((await h.command('stop')).ok,true);assert.equal(h.writes,0);assert.deepEqual(business(h),before);
});
for(const mode of ['identity','generation','draft'])test('initial installed recording '+mode+' ACK failure retains session and complete buffer',async t=>{
 const h=await harness(t),before=business(h);h.ackTransform=snapshot=>h.publications?{...snapshot,
  ...(mode==='identity'?{projectId:'foreign'}:mode==='generation'?{generation:999}:{commentAuthoringPending:true})}:snapshot;
 const result=await h.command('start');assert.equal(result.ok,false);assert.equal(h.editor,installed(before[0]));
 assert.deepEqual(business(h),before);assert.equal(h.writes,0);const projection=await h.c.readPendingRevisionProjection();
 assert.equal(projection.recording,true);h.sessionId=projection.sessionId;h.ackTransform=null;
 assert.equal((await h.command('stop')).ok,true);assert.deepEqual(business(h),before);assert.equal(h.writes,0);
});
test('unconfirmed-stop retry fences unsignalled input during fresh source revalidation',async t=>{
 const h=await harness(t);await h.start();h.type('Alpha beta!');await h.save();const before=business(h),writes=h.writes;h.timeoutMs=20;
 const send=h.renderer.window.electronAPI.sendEditorSnapshotResponse;
 h.renderer.window.electronAPI.sendEditorSnapshotResponse=(id,snapshot)=>{if(snapshot?.content!==installed(before[0]))send(id,snapshot);};
 assert.equal((await h.command('stop')).ok,false);h.renderer.window.electronAPI.sendEditorSnapshotResponse=send;
 const read=h.c.fs.readFile;let changed=false;h.c.fs={...h.c.fs,readFile:async(...args)=>{
  const value=await read(...args);if(!changed&&args[0]===h.manifest){changed=true;h.editor=envelope.composeObservablePayload({doc:doc('Unsignalled retry input')});}return value;}};
 const refused=await h.command('stop');assert.equal(refused.ok,false);assert.equal(envelope.parseObservablePayload(h.editor).text,'Unsignalled retry input');
 assert.equal((await h.c.readPendingRevisionProjection()).recording,true);assert.equal(h.writes,writes);assert.deepEqual(business(h),before);
});
test('final post-ACK source readback cannot clear recording after same-generation unsignalled input',async t=>{
 const h=await harness(t);await h.start();h.type('Alpha beta!');await h.save();const before=business(h),writes=h.writes,publications=h.publications;
 const read=h.c.fs.readFile;let changed=false;h.c.fs={...h.c.fs,readFile:async(...args)=>{
  const value=await read(...args);if(!changed&&args[0]===h.manifest&&h.publications>publications){changed=true;
   h.editor=envelope.composeObservablePayload({doc:doc('Post-ACK owner input')});}return value;}};
 const result=await h.command('stop');assert.equal(changed,true);assert.equal(result.ok,false);
 assert.equal(envelope.parseObservablePayload(h.editor).text,'Post-ACK owner input');assert.equal((await h.c.readPendingRevisionProjection()).recording,true);
 assert.deepEqual(business(h),before);assert.equal(h.writes,writes);
});

for(const field of ['unknownNull','unknownValue','knownValue','body','meta','cards','history'])test('complete installed recording ACK rejects '+field+' without changing canonical checkpoint',async t=>{
 const h=await harness(t);await h.start();h.type('Alpha beta!');await h.save();const before=business(h),writes=h.writes;
 h.ackTransform=snapshot=>{
  if(snapshot.content!==installed(before[0]))return snapshot;
  const parsed=envelope.parseObservablePayload(snapshot.content),changed=JSON.parse(JSON.stringify(parsed.doc));
  if(field==='unknownNull')changed.attrs.foreign=null;if(field==='unknownValue')changed.attrs.foreign='owner';
  if(field==='knownValue')changed.attrs.wordUserBookmarks={schemaVersion:'foreign'};
  if(field==='body')changed.content[0].content[0].text='Different';
  if(field==='history')changed.attrs.wordPendingRevisions.returnReceipts.push({foreign:true});
  return {...snapshot,content:envelope.composeObservablePayload({...parsed,doc:changed,
   metaEnabled:field==='meta'||parsed.hasMetaBlock,meta:field==='meta'?{synopsis:'Foreign'}:parsed.meta,
   cards:field==='cards'?[{title:'Foreign',text:'No loss',tags:''}]:parsed.cards})};
 };
 const result=await h.command('stop');assert.equal(result.ok,false,JSON.stringify(result));assert.deepEqual(business(h),before);
 assert.equal(h.writes,writes);assert.equal((await h.c.readPendingRevisionProjection()).recording,true);
});
for(const mode of ['flow','story'])test('conditional recording publication refuses active '+mode+' even if ordinary snapshot hides that lane',async t=>{
 const h=await harness(t);await h.start();h.type('Alpha beta!');await h.save();const before=business(h),buffer=h.editor,writes=h.writes;
 if(mode==='flow')h.renderer.flowModeState.active=true;else{h.renderer.storyMutationPending=true;h.renderer.pendingStoryRequestId='pending';}
 const result=await h.command('stop');assert.equal(result.ok,false);assert.deepEqual(business(h),before);assert.equal(h.editor,buffer);
 assert.equal(h.writes,writes);assert.equal((await h.c.readPendingRevisionProjection()).recording,true);
});
test('idempotent receipt with changed annotation plan cannot advance full recording checkpoint or source provenance',async t=>{
 const h=await harness(t);addComment(h);await h.start();h.type('Alpha beta!');h.intents=intents('Alpha beta',typed('first',10,'','!'));await h.save();
 const before=business(h),old=vm.runInContext('JSON.stringify({raw:activePendingRecording.raw,provenance:activePendingRecording.provenance,checkpoint:activePendingRecording.checkpoint})',h.c);
 h.intents=intents('Alpha beta!',typed('forward',10,'','?'),typed('undo',10,'?','','undo','forward'));
 const result=await h.save();assert.equal(result.success,false);assert.match(JSON.stringify(result),/RECORDING_SAVE_READBACK_CHANGED/);
 assert.deepEqual(business(h),before);assert.equal(vm.runInContext('JSON.stringify({raw:activePendingRecording.raw,provenance:activePendingRecording.provenance,checkpoint:activePendingRecording.checkpoint})',h.c),old);
});
