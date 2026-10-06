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
const doc = text => ({ type: 'doc', content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }] });
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
    commentSceneParagraphs: require('../../src/core/word-comment-anchor-save-v1.cjs').paragraphs, Buffer, crypto, setTimeout, clearTimeout, pendingSnapshotRequests: requests,
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
    readReviewExactTextApplyProjectBinding: async () => ({ ok: true, projectRoot: root, projectId: h.foreignProject ? 'foreign' : 'recording-project' }),
    ...gateway, SAVE_AUTHORITY_OBSERVER_IDS: gateway.OBSERVER_IDS, durableSaveTransaction, planCommentAnchorSave,
    manuscriptNoteModel: require('../../src/core/word-manuscript-notes-v1.cjs'),
    prepareBookProfileManifestForFile: async target => ({ manifestPath: manifest, projectId: 'recording-project', expectedText: fs.readFileSync(manifest, 'utf8'), nextText: fs.readFileSync(manifest, 'utf8') }),
    getMainProjectManifestAuthority: async () => authority,
    getProjectRelativeFilePath: target => path.relative(root, target),
    loadProRoundtripPreservationModule: async () => ({ applyFreeEditProDataInvalidation: value => ({ ok: true, manifest: value }) }),
    commitProjectTransaction: async args => { if (h.writeFailure) throw Error('INJECTED_WRITE_FAILURE'); const r = await tx.commitProjectTransaction(args); h.writes++; return r; },
  };
  c.mainWindow = { isDestroyed: () => false, webContents: { send: (_channel, { requestId }) => {
    const p = requests.get(requestId); clearTimeout(p.timeoutId); requests.delete(requestId);
    p.resolve({ content: h.editor, generation: h.generation, commentAuthoringPending: h.draft === true,
      manuscriptNoteAuthoringPending: h.noteDraft === true, commentEditIntentsJson: h.intents == null ? null : JSON.stringify(h.intents) });
  } } };
  vm.createContext(c);
  const recordingSource = main.slice(main.indexOf('let activePendingRecording ='), main.indexOf('const authenticatedPendingReturnAdmissions ='));
  vm.runInContext([extract('commitWriterProjectSnapshot'), extract('requestEditorSnapshot'), recordingSource,
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
