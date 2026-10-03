'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const model = require('../../src/core/word-stories-v1.cjs');
const envelope = require('../../src/core/document-content-envelope-v1.cjs');
const { buildDocumentStoriesExport } = require('../../src/export/docx/docxReviewPacketStories');
const copy = value => JSON.parse(JSON.stringify(value));
const body = text => ({ type: 'doc', content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }] });
function scene(text = 'Header') {
  return { ...body('Main text'), attrs: {
    wordSections: { schemaVersion: 1, boundaries: [], final: { type: 'nextPage' } },
    wordStories: { schemaVersion: 1, evenAndOddHeaders: false,
      stories: [{ id: 'local-header', role: 'header', body: body(text) }],
      sections: [{ titlePage: false, header: { default: 'local-header' }, footer: {} }] },
  } };
}
const moduleReady = import('../../src/io/revisionBridge/reviewTransportStoriesV1.mjs');

test('header return maps native renamed parts to protected local IDs and preserves main document', async () => {
  const { analyzeDocumentStoriesReturn, revalidateDocumentStoryCandidate } = await moduleReady;
  const before = envelope.canonicalizeDocumentJson(scene()), expected = buildDocumentStoriesExport([{ sceneId: 'a.txt', doc: before }]);
  const returned = copy(expected.registry);
  returned.stories[0].id = 'word-part-88'; returned.stories[0].body = body('Word edit');
  returned.sections[0].header.default = 'word-part-88';
  const result = analyzeDocumentStoriesReturn({ expected, returned, beforeDocs: { 'a.txt': before } });
  assert.equal(result.ok, true); assert.equal(result.candidates.length, 1);
  const candidate = result.candidates[0];
  assert.deepEqual(candidate.plan.doc.content, before.content);
  assert.deepEqual(model.topology(model.read(candidate.plan.doc)), model.topology(model.read(before)));
  assert.equal(model.read(candidate.plan.doc).stories[0].body.content[0].content[0].text, 'Word edit');
  assert.deepEqual(revalidateDocumentStoryCandidate(candidate).doc, candidate.plan.doc);
  const forged = copy(candidate); forged.plan.doc.content[0].content[0].text = 'forged body';
  assert.throws(() => revalidateDocumentStoryCandidate(forged), /CANDIDATE/);
});

test('native Word materialized empty first/even parts do not invent canonical entities', async () => {
  const { analyzeDocumentStoriesReturn } = await moduleReady;
  const before = scene(), expected = buildDocumentStoriesExport([{ sceneId: 'a', doc: before }]);
  const returned = copy(expected.registry);
  returned.stories.push({ id: 'word-empty-footer', role: 'footer', body: body('') });
  returned.sections[0].footer = { ...returned.sections[0].footer, first: 'word-empty-footer', even: 'word-empty-footer' };
  let result = analyzeDocumentStoriesReturn({ expected, returned, beforeDocs: { a: before } });
  assert.equal(result.ok, true); assert.equal(result.changed, false);
  returned.stories.find(item => item.id === 'word-empty-footer').body = body('Forged extra content');
  result = analyzeDocumentStoriesReturn({ expected, returned, beforeDocs: { a: before } });
  assert.equal(result.ok, false); assert.equal(result.code, 'WORD_STORIES_RETURN_ALIAS');
});

test('shared inherited header accepts one body edit but refuses divergent returned aliases', async () => {
  const { analyzeDocumentStoriesReturn } = await moduleReady;
  const before = scene(); before.content.push(...body('Second section').content);
  before.attrs.wordSections.boundaries = [{ endParagraphIndex: 0, properties: { type: 'nextPage' } }];
  before.attrs.wordStories.sections.push({ titlePage: false, header: {}, footer: {} });
  const expected = buildDocumentStoriesExport([{ sceneId: 'a', doc: before }]), returned = copy(expected.registry);
  returned.stories[0].body = body('Shared edit');
  assert.equal(analyzeDocumentStoriesReturn({ expected, returned, beforeDocs: { a: before } }).ok, true);
  returned.stories.push({ id: 'split-copy', role: 'header', body: body('Different') });
  returned.sections[1].header.default = 'split-copy';
  const result = analyzeDocumentStoriesReturn({ expected, returned, beforeDocs: { a: before } });
  assert.equal(result.ok, false); assert.equal(result.code, 'WORD_STORIES_RETURN_ALIAS');
});

test('full manuscript analyzer produces all affected scene deltas and protects scene reset stories', async () => {
  const { analyzeDocumentStoriesReturn } = await moduleReady;
  const a = scene('A'), b = scene('B');
  const expected = buildDocumentStoriesExport([{ sceneId: 'a', doc: a }, { sceneId: 'b', doc: b }]);
  const returned = copy(expected.registry);
  for (const item of expected.sourceBindings.filter(item => !item.reset)) returned.stories.find(s => s.id === item.exportStoryId).body = body(`Changed ${item.sceneId}`);
  const result = analyzeDocumentStoriesReturn({ expected, returned, beforeDocs: { a, b } });
  assert.equal(result.ok, true); assert.deepEqual(result.candidates.map(c => c.sceneId), ['a', 'b']);
  const reset = expected.sourceBindings.find(item => item.reset);
  if (reset) {
    returned.stories.find(s => s.id === reset.exportStoryId).body = body('Unexpected inherited text');
    assert.equal(analyzeDocumentStoriesReturn({ expected, returned, beforeDocs: { a, b } }).ok, false);
  }
});

test('Main private Apply routes story changes through checked scene transaction; dirty drafts and stale bytes write nothing', async () => {
  const { analyzeDocumentStoriesReturn } = await moduleReady;
  const before = envelope.canonicalizeDocumentJson(scene()), expected = buildDocumentStoriesExport([{ sceneId: 'a.txt', doc: before }]);
  const returned = copy(expected.registry); returned.stories[0].body = body('Applied header');
  const candidate = analyzeDocumentStoriesReturn({ expected, returned, beforeDocs: { 'a.txt': before } }).candidates[0];
  candidate.raw = envelope.composeObservablePayload({ doc: before }); candidate.parsed = envelope.parseObservablePayload(candidate.raw);
  candidate.changeId = 'docx-story-return-unit';
  const main = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
  const source = main.slice(main.indexOf('async function applyPrivateUserBookmarksReturn('), main.indexOf('async function syncReviewExactTextApplyEditorFromMainState('));
  let raw = candidate.raw, writes = 0, draft = false;
  const store = { storyReturnCandidate: candidate }, input = { scenePath: '/test/a.txt', reviewItems: [{ changeId: candidate.changeId }] };
  const c = vm.createContext({ JSON, Buffer, crypto:require('node:crypto'), path, pathToFileURL, __dirname: path.resolve(__dirname, '../../src'),
    activeRtkCleanLinkLabelApplyStore: store, activePendingRecording: null, currentFilePath: input.scenePath,
    isDirty: false, autoSaveInProgress: false, lastSignaledEditGeneration: 0,
    revalidateCleanLinkLabelApplyInput: async () => ({ ok: true }),
    loadDocumentContentEnvelopeModule: async () => envelope,
    requestEditorSnapshot: async () => ({ content: candidate.raw, generation: 1, manuscriptNoteAuthoringPending: draft }),
    loadRtkNonTextReturnModule: async () => ({ commentSceneSnapshotsEqual: (a,b) => JSON.stringify(a) === JSON.stringify(b) }),
    userBookmarkModel: require('../../src/core/word-user-bookmarks-v1.cjs'),
    userBookmarkEnvelopeMetadataEqual: () => true,
    fs: { readFile: async () => raw }, fsSync: { readFileSync: () => raw },
    userBookmarkCapability: () => {}, cleanLinkLabelStoreMatches: () => true,
    computeHash: text => require('node:crypto').createHash('sha256').update(text).digest('hex'),
    commitWriterProjectSnapshot: async (file, content, generation, profile, reason, options) => {
      assert.equal(file, input.scenePath); assert.ok(options.storyReturnPlan); assert.equal(options.expectedSceneContent, raw);
      await options.beforeScenePublish(); writes++; raw = content; return { success: true };
    },
  });
  new vm.Script(source, { importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER }).runInContext(c);
  draft = true;
  assert.equal((await c.applyPrivateUserBookmarksReturn(input)).applied, false); assert.equal(writes, 0);
  draft = false; raw = candidate.raw + 'foreign';
  assert.equal((await c.applyPrivateUserBookmarksReturn(input)).applied, false); assert.equal(writes, 0);
  raw = candidate.raw;
  const result = await c.applyPrivateUserBookmarksReturn(input);
  assert.equal(result.applied, true, JSON.stringify(result)); assert.equal(writes, 1);
  const saved = envelope.parseObservablePayload(raw);
  assert.equal(model.read(saved.doc).stories[0].body.content[0].content[0].text, 'Applied header');
  assert.deepEqual(saved.doc.content, before.content);
});

for (const bodyKind of ['plain','table','image','first-story','leading-blank','trailing-blank','consecutive-blank','crlf','empty-sibling']) test(`Main prepares a zero-write story candidate alongside unchanged ${bodyKind} body and rejects artifact mismatch`, async () => {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const { buildFullManuscriptDocxReviewPacketSource, validateFullManuscriptDocumentSectionsReturn } = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource');
  const { buildDocxReviewPacketBuffer } = require('../../src/export/docx/docxReviewPacketBuilder');
  const { compareCommentExportReadback } = require('../../src/export/docx/docxReviewPacketComments');
  const crypto = require('node:crypto'), hash = text => crypto.createHash('sha256').update(text).digest('hex');
  const stable = value => Array.isArray(value) ? `[${value.map(stable).join(',')}]` : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}` : JSON.stringify(value);
  const cryptoPort = { sha256Text: hash, sha256Json: value => `sha256:${hash(stable(value))}`, byteLength: value => Buffer.byteLength(value),
    hmacSha256Json: (value, secret) => `hmac-sha256:${crypto.createHmac('sha256', secret).update(stable(value)).digest('hex')}`,
    hmacSha256Text: (value, secret) => `hmac-sha256:${crypto.createHmac('sha256', secret).update(value).digest('hex')}` };
  const before = envelope.canonicalizeDocumentJson(scene());
  if(bodyKind==='first-story'){delete before.attrs.wordStories;delete before.attrs.wordSections;}
  if(bodyKind==='table')before.content=[{type:'table',content:[{type:'tableRow',content:[{type:'tableCell',attrs:{colspan:1,rowspan:1,colwidth:null},content:before.content}]}]}];
  if(bodyKind==='image')before.content[0].content.push({type:'image',attrs:require('../../src/io/documentMedia.js').createImageAttrs(require('../fixtures/document-jpeg-fixtures.cjs').rgb)});
  const raw = envelope.composeObservablePayload({ doc: before });
  const siblingRaw = {'leading-blank':'\n\nSibling','trailing-blank':'Sibling\n','consecutive-blank':'One\n\n\nTwo','crlf':'\r\nOne\r\n\r\nTwo\r\n','empty-sibling':''}[bodyKind];
  const scenes = [{ sceneId: 'a.txt', scenePath: '/test/a.txt', text: 'Main text', doc: before, observableContent: raw, order: 0 }];
  if (siblingRaw !== undefined) scenes.push({sceneId:'b.txt',scenePath:'/test/b.txt',doc:null,text:siblingRaw,observableContent:siblingRaw,order:1});
  const source = buildFullManuscriptDocxReviewPacketSource({ projectId: 'p', projectRoot: '/test', manifestPath: '/test/project.craftsman.json',scenes }, { revisionBridge: bridge, cryptoPort });
  const changed = { ...source, documentStories: copy(source.documentStories) };
  if(bodyKind==='first-story'){
    changed.documentStories.registry.stories.push({id:'native-added',role:'header',body:body('Actual DOCX header edit')});
    changed.documentStories.registry.sections[0].header.default='native-added';
  }else changed.documentStories.registry.stories.find(item => item.id === changed.documentStories.sourceBindings.find(item => !item.reset).exportStoryId).body = body('Actual DOCX header edit');
  const bytes = buildDocxReviewPacketBuffer(changed);
  const parsed = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes, hmacSecret: source.forbiddenSecret, expectedAuthority: source.localAuthorityCapsule.expectedAuthority }, { cryptoPort });
  assert.equal(parsed.ok, true, JSON.stringify(parsed.reasons));
  const sectionBinding = validateFullManuscriptDocumentSectionsReturn({ expected: source.documentSections, returned: parsed.reviewIr.documentSections,
    signedDigest: source.documentSections.protectedDigest });
  assert.equal(sectionBinding.ok, true); parsed.documentSectionsBinding = { ...sectionBinding.proof, status: sectionBinding.status };
  source.localAuthorityCapsule.exportMap = bridge.bindUserBookmarkExportTransportPartsV1(source.localAuthorityCapsule.exportMap, buildDocxReviewPacketBuffer(source));
  const authority = { ...source.localAuthorityCapsule, scope: 'full-manuscript', documentStories: source.documentStories,
    baselineObservableContentBySceneId: source.localAuthorityCapsule.baselineObservableContentBySceneId, scenePathBySceneId: source.localAuthorityCapsule.scenePathBySceneId };
  assert.equal(authority.exportMap.scenes[0].rawSha256, `sha256:${hash(raw)}`);
  const main = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
  const code = main.slice(main.indexOf('async function prepareCleanDocumentStoriesCapsule('), main.indexOf('async function prepareCleanUserBookmarksCapsule('));
  const c = vm.createContext({ JSON, Buffer, crypto:require('node:crypto'), path, pathToFileURL, __dirname: path.resolve(__dirname, '../../src'),
    require: require('node:module').createRequire(path.resolve(__dirname,'../../src/main.js')), cloneJsonSafe: copy, stableRtkReviewTransportJson: stable,
    currentFilePath: siblingRaw === undefined ? '/test/a.txt' : '/test/b.txt', computeHash: hash, loadRevisionBridgeModule: async () => bridge,
    loadDocumentContentEnvelopeModule: async () => envelope,
    userBookmarkModel: require('../../src/core/word-user-bookmarks-v1.cjs'), compareCommentExportReadback,
  });
  new vm.Script(code, { importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER }).runInContext(c);
  const context = { projectId: 'p', projectRoot: '/test', baselineHash: 'test-baseline', docxBytes: bytes, returnedArtifactSha256: `sha256:${hash(bytes)}` };
  const result = await c.prepareCleanDocumentStoriesCapsule(authority, parsed, context);
  assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(result.changed, true);
  assert.equal(result.fields.storyReturnCandidate.changes[0].afterBody.content[0].content[0].text, 'Actual DOCX header edit');
  if (siblingRaw !== undefined) {
    const candidate = result.fields.storyReturnCandidate;
    assert.equal(candidate.batchScenes.length,1);
    assert.equal(candidate.sourceScenes.find(item=>item.sceneId==='b.txt').raw,siblingRaw);
    assert.deepEqual(candidate.batchScenes[0].plan.doc.content,before.content);
    const forged=copy(authority);forged.baselineFinalTextBySceneId['b.txt']=siblingRaw+'tampered';
    delete forged.baselineObservableContentBySceneId['b.txt'];
    assert.equal((await c.prepareCleanDocumentStoriesCapsule(forged,parsed,context)).code,'WORD_STORIES_RETURN_BASELINE');
  }
  const mismatch = await c.prepareCleanDocumentStoriesCapsule(authority, parsed, { ...context, returnedArtifactSha256: 'sha256:wrong' });
  assert.equal(mismatch.code, 'WORD_STORIES_RETURN_ARTIFACT');
  const extracted = bridge.extractDocxReviewTransportPackagePartsFromZipBytes({bytes},{cryptoPort});
  const parts = {...extracted.parts}; parts['word/document.xml'] = parts['word/document.xml'].replace('Main text','Forged!!!');
  const corrupt = require('../../src/export/docx/docxMinBuilder').buildStoredZip(Object.entries(parts).map(([name,data])=>({name,data})));
  const changedBody = bridge.buildDocxReviewTransportAnalysisFromZipBytes({bytes:corrupt,hmacSecret:source.forbiddenSecret,expectedAuthority:source.localAuthorityCapsule.expectedAuthority},{cryptoPort});
  changedBody.documentSectionsBinding = parsed.documentSectionsBinding;
  const rejected = await c.prepareCleanDocumentStoriesCapsule(authority,changedBody,{...context,docxBytes:corrupt,returnedArtifactSha256:`sha256:${hash(corrupt)}`});
  assert.equal(rejected.ok,false,'A header edit must never conceal manuscript text changes');
});

async function storyAuthoringHarness({ stale = false, draft = false, rejectPublication = false, revokeDuringSnapshot = false } = {}) {
  const main = fs.readFileSync(path.join(__dirname,'../../src/main.js'),'utf8');
  const code = main.slice(main.indexOf('async function handleDocumentStoriesMutation('), main.indexOf('let localImageInsertionPending = false;'));
  const doc = envelope.canonicalizeDocumentJson(scene());
  const raw = envelope.composeObservablePayload({ doc, text:'', metaEnabled:false });
  const source = { doc, raw, parsed:envelope.parseObservablePayload(raw), filePath:'/project/roman/a.txt',
    sceneId:'roman/a.txt', projectId:'p', subjectId:'life:session', sceneSha256:'sha', manifestPath:'/project/project.craftsman.json',manifestRaw:'manifest',bookProfile:{} };
  let disk = raw, observed = raw, writes = 0, intentChecked = false, snapshotCalls = 0, revoked = false;
  const snapshot = () => ({content:observed,generation:3,manuscriptNoteAuthoringPending:draft});
  const c = vm.createContext({ JSON, Object, RegExp, Number, Error, crypto:require('node:crypto'),
    require:id=>id==='./core/word-stories-v1.cjs'?{...model,planStoryMutation:(doc,intent,opts)=>model.planStoryMutation(doc,copy(intent),copy(opts))}:require('node:module').createRequire(path.join(__dirname,'../../src/main.js'))(id),
    isPlainObjectValue: value => value && typeof value==='object' && !Array.isArray(value),
    userBookmarkCapability:()=>{if(revoked)throw Error('CAPABILITY_REVOKED');}, queueDiskOperation:fn=>fn(),readDocumentStoriesContext:async()=>source,
    requestEditorSnapshot:async()=>{if(++snapshotCalls===2 && revokeDuringSnapshot)revoked=true;return snapshot();}, loadDocumentContentEnvelopeModule:async()=>envelope,
    loadRtkNonTextReturnModule:async()=>({commentSceneSnapshotsEqual:(a,b)=>JSON.stringify(a)===JSON.stringify(b)}),
    userBookmarkModel:{materializeInternalLinkSchemaDefaults:x=>x},userBookmarkEnvelopeMetadataEqual:()=>true,
    readUserBookmarkProjectBinding:async()=>({projectId:'p'}), currentFilePath:source.filePath,
    currentLifecycleSubjectId:()=> 'life',commentAuthoringSessionId:'session',isDirty:false,autoSaveInProgress:false,
    activePendingRecording:null,lastSignaledEditGeneration:3,
    fs:{readFile:async file=>file===source.manifestPath?'manifest':disk},
    commitWriterProjectSnapshot:async(file,content,generation,profile,reason,options)=>{
      await options.beforeScenePublish();
      const regenerated = model.planStoryMutation(doc,copy(options.storyAuthoringIntent.intent),copy(options.storyAuthoringIntent.options));
      assert.deepEqual(envelope.parseObservablePayload(content).doc,envelope.canonicalizeDocumentJson(regenerated.doc));
      assert.notEqual(options.storyAuthoringIntent.options.idSeed,'request');intentChecked=true;
      disk=content;writes++;return {success:true};
    },mainWindow:{webContents:{send:(_channel,payload)=>{if(!rejectPublication) observed=payload.content;}}},
    userBookmarkSaveContinuation:null,computeHash:x=>x,lastAutosaveHash:null,
    acknowledgeMainOwnedSave:async()=>({kind:'SAVED'}),SAVE_ACK_KINDS:{SAVED:'SAVED'},setDirtyState:()=>{},
    logDevError:()=>{}, makeReviewMutateTypedError:(_id,reason)=>({ok:false,reason}),
  });
  new vm.Script(code).runInContext(c);
  const renderer=fs.readFileSync(path.join(__dirname,'../../src/renderer/editor.js'),'utf8');
  const decorator=renderer.slice(renderer.indexOf('function withEditorModeCommandPayload('),renderer.indexOf('async function dispatchUiCommand(',renderer.indexOf('function withEditorModeCommandPayload(')));
  const dc=vm.createContext({isTiptapMode:true});new vm.Script(decorator).runInContext(dc);
  const payload = copy(dc.withEditorModeCommandPayload({requestId:'request',projectId:'p',sceneId:'roman/a.txt',subjectId:'life:session',
    expectedSceneSha256:stale?'old':'sha',sectionIndex:0,role:'footer',variant:'first',source:'empty'}));
  const result = await c.handleDocumentStoriesMutation('create',payload);
  return {result,writes,intentChecked,disk,source,c,payload};
}

test('actual Main story creation regenerates private intent and publishes revision-bound receipt', async()=>{
  const h=await storyAuthoringHarness();assert.equal(h.result.ok,true,JSON.stringify(h.result));assert.equal(h.writes,1);assert.equal(h.intentChecked,true);
  const registry=model.read(envelope.parseObservablePayload(h.disk).doc);
  assert.equal(registry.stories.length,2);assert.ok(registry.sections[0].footer.first);
  assert.deepEqual(envelope.parseObservablePayload(h.disk).doc.content,h.source.doc.content);
});
test('actual Main story command stale binding or auxiliary draft performs no write',async()=>{
  for(const input of [{stale:true},{draft:true}]) {const h=await storyAuthoringHarness(input);assert.equal(h.result.ok,false);assert.equal(h.writes,0);}
  const h=await storyAuthoringHarness();const result=await h.c.handleDocumentStoriesMutation('create',{...h.payload,registry:{}});
  assert.equal(result.ok,false);assert.equal(result.reason,'WORD_STORIES_INPUT_INVALID');
  const legacy=await h.c.handleDocumentStoriesMutation('create',{...h.payload,editorMode:'legacy'});assert.equal(legacy.ok,false);assert.equal(legacy.reason,'WORD_STORIES_INPUT_INVALID');
});
test('actual Main story command reports durable write when renderer refuses stale publication',async()=>{
  const h=await storyAuthoringHarness({rejectPublication:true});assert.equal(h.writes,1);assert.equal(h.result.ok,false);
  assert.equal(h.result.storageWritten,true);assert.equal(h.result.reason,'WORD_STORIES_PUBLICATION_STALE');
});

test('authenticated Word unlink creates fresh canonical story and keeps subsequent section inherited',async()=>{
  const {analyzeDocumentStoriesReturn,revalidateDocumentStoryCandidate}=await moduleReady;
  const before=scene();before.content.push(...body('Second').content,...body('Third').content);
  before.attrs.wordSections.boundaries=[0,1].map(endParagraphIndex=>({endParagraphIndex,properties:{type:'nextPage'}}));
  before.attrs.wordStories.sections.push({titlePage:false,header:{},footer:{}},{titlePage:false,header:{},footer:{}});
  const expected=buildDocumentStoriesExport([{sceneId:'a',doc:before}]),returned=copy(expected.registry);
  returned.stories.push({id:'native-new-part',role:'header',body:body('Unlinked second header')});
  returned.sections[1].header.default='native-new-part';
  const result=analyzeDocumentStoriesReturn({expected,returned,beforeDocs:{a:before},allowTopology:true,idSeed:'main-private-nonce'});
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.candidates.length,1);
  const candidate=result.candidates[0],registry=model.read(candidate.plan.doc),resolved=model.resolved(registry);
  assert.equal(resolved[0].header.default,'local-header');assert.notEqual(resolved[1].header.default,'local-header');
  assert.equal(resolved[1].header.default,resolved[2].header.default);assert.equal(registry.sections[2].header.default,undefined);
  assert.deepEqual(revalidateDocumentStoryCandidate(candidate).doc,candidate.plan.doc);
  assert.deepEqual(candidate.plan.doc.attrs.wordSections,before.attrs.wordSections);
});

test('Main story authoring rechecks capability after the final awaited editor snapshot',async()=>{
  const h=await storyAuthoringHarness({revokeDuringSnapshot:true});assert.equal(h.writes,0);assert.equal(h.result.reason,'CAPABILITY_REVOKED');
});

test('first Word-created header is bound to protected empty section geometry and private replay',async()=>{
  const {analyzeDocumentStoriesReturn,revalidateDocumentStoryCandidate}=await moduleReady;
  const before=body('Before any header');
  const {buildFullManuscriptDocumentSections}=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
  const blocks=[{sceneId:'roman/a.txt',documentParagraphIndex:0}];
  const sections=buildFullManuscriptDocumentSections([{sceneId:'roman/a.txt',doc:before}],blocks);
  const expected=buildDocumentStoriesExport([{sceneId:'roman/a.txt',doc:before}],sections,{includeEmpty:true,blocks});
  const returned={schemaVersion:1,evenAndOddHeaders:false,stories:[{id:'word-new',role:'header',body:body('First Word header')}],sections:[{titlePage:false,header:{default:'word-new'},footer:{}}]};
  const result=analyzeDocumentStoriesReturn({expected,returned,beforeDocs:{'roman/a.txt':before},allowTopology:true,idSeed:'private-nonce'});
  assert.equal(result.ok,true,JSON.stringify(result));const candidate=result.candidates[0];
  assert.deepEqual(candidate.plan.doc.content,before.content);assert.equal(model.read(candidate.plan.doc).stories[0].body.content[0].content[0].text,'First Word header');
  assert.deepEqual(candidate.plan.doc.attrs.wordSections,expected.sourceScenes[0].trustedSections);
  assert.deepEqual(revalidateDocumentStoryCandidate(candidate).doc,candidate.plan.doc);
  assert.equal(analyzeDocumentStoriesReturn({expected,returned:null,beforeDocs:{'roman/a.txt':before},allowTopology:true,idSeed:'private-nonce'}).changed,false);
});

test('same-text Word unlink still creates a distinct canonical story identity',async()=>{
  const {analyzeDocumentStoriesReturn}=await moduleReady;
  const before=scene();before.content.push(...body('Second').content);before.attrs.wordSections.boundaries=[{endParagraphIndex:0,properties:{type:'nextPage'}}];before.attrs.wordStories.sections.push({titlePage:false,header:{},footer:{}});
  const expected=buildDocumentStoriesExport([{sceneId:'a',doc:before}]),returned=copy(expected.registry);
  returned.stories.push({id:'same-text-new',role:'header',body:copy(returned.stories[0].body)});returned.sections[1].header.default='same-text-new';
  const result=analyzeDocumentStoriesReturn({expected,returned,beforeDocs:{a:before},allowTopology:true,idSeed:'private'});
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.changed,true);
  const slots=model.resolved(model.read(result.candidates[0].plan.doc));assert.notEqual(slots[0].header.default,slots[1].header.default);
});

test('Main empty-story fullbook capsule uses signed plain-scene baseline and rejects altered fallback bytes',async()=>{
  const bridge=await import('../../src/io/revisionBridge/index.mjs');
  const {buildFullManuscriptDocxReviewPacketSource}=require('../../src/export/docx/fullManuscriptDocxReviewPacketSource');
  const {buildDocxReviewPacketBuffer}=require('../../src/export/docx/docxReviewPacketBuilder');
  const crypto=require('node:crypto'),hash=value=>crypto.createHash('sha256').update(value).digest('hex');
  const stable=value=>Array.isArray(value)?'['+value.map(stable).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}':JSON.stringify(value);
  const cryptoPort={sha256Text:hash,sha256Json:value=>'sha256:'+hash(stable(value)),byteLength:value=>Buffer.byteLength(value),
    hmacSha256Json:(value,secret)=>'hmac-sha256:'+crypto.createHmac('sha256',secret).update(stable(value)).digest('hex'),
    hmacSha256Text:(value,secret)=>'hmac-sha256:'+crypto.createHmac('sha256',secret).update(value).digest('hex')};
  const raw='Plain sibling\nSecond paragraph';
  const source=buildFullManuscriptDocxReviewPacketSource({projectId:'p',projectRoot:'/test',manifestPath:'/test/project.craftsman.json',
    scenes:[{sceneId:'roman/plain.txt',scenePath:'/test/roman/plain.txt',text:raw,observableContent:raw,order:0}]},{revisionBridge:bridge,cryptoPort});
  const authority=copy(source.localAuthorityCapsule);
  assert.equal(authority.baselineObservableContentBySceneId?.['roman/plain.txt'],undefined);
  assert.equal(authority.baselineFinalTextBySceneId['roman/plain.txt'],raw);
  const bytes=buildDocxReviewPacketBuffer(source),context={docxBytes:bytes,returnedArtifactSha256:'sha256:'+hash(bytes)};
  const main=fs.readFileSync(path.join(__dirname,'../../src/main.js'),'utf8');
  const code=main.slice(main.indexOf('async function prepareCleanDocumentStoriesCapsule('),main.indexOf('async function prepareCleanUserBookmarksCapsule('));
  const c=vm.createContext({JSON,Buffer,crypto,path,pathToFileURL,__dirname:path.resolve(__dirname,'../../src'),computeHash:hash,
    loadRevisionBridgeModule:async()=>bridge,loadDocumentContentEnvelopeModule:async()=>envelope});
  new vm.Script(code,{importModuleDynamically:vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER}).runInContext(c);
  const result=await c.prepareCleanDocumentStoriesCapsule(authority,{},context);
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.changed,false);
  const changed=copy(authority);changed.baselineFinalTextBySceneId['roman/plain.txt']=raw+'tampered';
  assert.equal((await c.prepareCleanDocumentStoriesCapsule(changed,{},context)).code,'WORD_STORIES_RETURN_BASELINE');
  const missing=copy(authority);delete missing.baselineFinalTextBySceneId;
  assert.equal((await c.prepareCleanDocumentStoriesCapsule(missing,{},context)).code,'WORD_STORIES_RETURN_BASELINE');
});

test('mixed global even mode preserves newly divergent plain header/footer variants without changing peers',async()=>{
 const {analyzeDocumentStoriesReturn,revalidateDocumentStoryCandidate}=await moduleReady;
 const peer=scene('Peer'),plain={type:'doc',content:[...body('Plain1').content,...body('Plain2').content],attrs:{wordSections:{schemaVersion:1,boundaries:[{endParagraphIndex:0,properties:{type:'nextPage'}}],final:{type:'nextPage'}}}};peer.attrs.wordStories.evenAndOddHeaders=true;
 for(const role of ['header','footer'])for(const variant of ['default','even']){
  const expected=buildDocumentStoriesExport([{sceneId:'peer',doc:peer},{sceneId:'plain',doc:plain}]),returned=copy(expected.registry);
  returned.stories.push({id:'new-word-story',role,body:body('New '+variant)});returned.sections[1][role][variant]='new-word-story';
  const result=analyzeDocumentStoriesReturn({expected,returned,beforeDocs:{peer,plain},allowTopology:true,idSeed:'private'});
  assert.equal(result.ok,true,JSON.stringify(result));assert.deepEqual(result.candidates.map(c=>c.sceneId),['plain']);
  const candidate=result.candidates[0];assert.equal(model.read(candidate.plan.doc).evenAndOddHeaders,true);
  assert.deepEqual(candidate.plan.doc.content,plain.content);assert.deepEqual(revalidateDocumentStoryCandidate(candidate).doc,candidate.plan.doc);
  const reexport=buildDocumentStoriesExport([{sceneId:'peer',doc:peer},{sceneId:'plain',doc:candidate.plan.doc}]);
  const meanings=(registry,index)=>{const slot=model.resolved(registry)[index];return Object.fromEntries(model.ROLES.map(r=>[r,Object.fromEntries(['default','even'].map(v=>[v,envelope.deriveVisibleTextFromDocument(registry.stories.find(s=>s.id===slot[r][v])?.body||body(''))]))]));};
  for(const index of [1,2])assert.deepEqual(meanings(reexport.registry,index),meanings(returned,index));
  assert.deepEqual(meanings(reexport.registry,0),meanings(expected.registry,0));
 }
});

test('global even mode keeps equivalent returned odd/even stories local-default and retains unchanged scenes',async()=>{
 const {analyzeDocumentStoriesReturn}=await moduleReady;
 const peer=scene('Peer'),plain={...body('Plain'),attrs:{wordSections:{schemaVersion:1,boundaries:[],final:{type:'nextPage'}}}};peer.attrs.wordStories.evenAndOddHeaders=true;
 const expected=buildDocumentStoriesExport([{sceneId:'peer',doc:peer},{sceneId:'plain',doc:plain}]);
 assert.equal(analyzeDocumentStoriesReturn({expected,returned:copy(expected.registry),beforeDocs:{peer,plain},allowTopology:true,idSeed:'private'}).changed,false);
 const returned=copy(expected.registry);returned.stories.push({id:'same-odd-even',role:'header',body:body('Both pages')});
 returned.sections[1].header.default='same-odd-even';returned.sections[1].header.even='same-odd-even';
 const result=analyzeDocumentStoriesReturn({expected,returned,beforeDocs:{peer,plain},allowTopology:true,idSeed:'private'});
 assert.equal(result.ok,true,JSON.stringify(result));assert.deepEqual(result.candidates.map(c=>c.sceneId),['plain']);
 assert.equal(model.read(result.candidates[0].plan.doc).evenAndOddHeaders,false);
});
