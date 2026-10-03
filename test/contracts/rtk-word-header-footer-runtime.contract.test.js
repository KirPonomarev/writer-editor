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
  const c = vm.createContext({ JSON, Buffer, path, pathToFileURL, __dirname: path.resolve(__dirname, '../../src'),
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

for (const bodyKind of ['plain','table','image']) test(`Main prepares a zero-write story candidate alongside unchanged ${bodyKind} body and rejects artifact mismatch`, async () => {
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
  if(bodyKind==='table')before.content=[{type:'table',content:[{type:'tableRow',content:[{type:'tableCell',attrs:{colspan:1,rowspan:1,colwidth:null},content:before.content}]}]}];
  if(bodyKind==='image')before.content[0].content.push({type:'image',attrs:require('../../src/io/documentMedia.js').createImageAttrs(require('../fixtures/document-jpeg-fixtures.cjs').rgb)});
  const raw = envelope.composeObservablePayload({ doc: before });
  const source = buildFullManuscriptDocxReviewPacketSource({ projectId: 'p', projectRoot: '/test', manifestPath: '/test/project.craftsman.json',
    scenes: [{ sceneId: 'a.txt', scenePath: '/test/a.txt', text: 'Main text', doc: before, observableContent: raw, order: 0 }] }, { revisionBridge: bridge, cryptoPort });
  const changed = { ...source, documentStories: copy(source.documentStories) };
  changed.documentStories.registry.stories.find(item => item.id === changed.documentStories.sourceBindings.find(item => !item.reset).exportStoryId).body = body('Actual DOCX header edit');
  const bytes = buildDocxReviewPacketBuffer(changed);
  const parsed = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes, hmacSecret: source.forbiddenSecret, expectedAuthority: source.localAuthorityCapsule.expectedAuthority }, { cryptoPort });
  assert.equal(parsed.ok, true, JSON.stringify(parsed.reasons));
  const sectionBinding = validateFullManuscriptDocumentSectionsReturn({ expected: source.documentSections, returned: parsed.reviewIr.documentSections,
    signedDigest: source.documentSections.protectedDigest });
  assert.equal(sectionBinding.ok, true); parsed.documentSectionsBinding = { ...sectionBinding.proof, status: sectionBinding.status };
  source.localAuthorityCapsule.exportMap = bridge.bindUserBookmarkExportTransportPartsV1(source.localAuthorityCapsule.exportMap, buildDocxReviewPacketBuffer(source));
  const authority = { ...source.localAuthorityCapsule, scope: 'full-manuscript', documentStories: source.documentStories,
    baselineObservableContentBySceneId: { 'a.txt': raw }, scenePathBySceneId: { 'a.txt': '/test/a.txt' } };
  assert.equal(authority.exportMap.scenes[0].rawSha256, `sha256:${hash(raw)}`);
  const main = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
  const code = main.slice(main.indexOf('async function prepareCleanDocumentStoriesCapsule('), main.indexOf('async function prepareCleanUserBookmarksCapsule('));
  const c = vm.createContext({ JSON, Buffer, path, pathToFileURL, __dirname: path.resolve(__dirname, '../../src'),
    require: require('node:module').createRequire(path.resolve(__dirname,'../../src/main.js')), cloneJsonSafe: copy, stableRtkReviewTransportJson: stable,
    currentFilePath: '/test/a.txt', computeHash: hash, loadRevisionBridgeModule: async () => bridge,
    loadDocumentContentEnvelopeModule: async () => envelope,
    userBookmarkModel: require('../../src/core/word-user-bookmarks-v1.cjs'), compareCommentExportReadback,
  });
  new vm.Script(code, { importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER }).runInContext(c);
  const context = { projectId: 'p', projectRoot: '/test', baselineHash: 'test-baseline', docxBytes: bytes, returnedArtifactSha256: `sha256:${hash(bytes)}` };
  const result = await c.prepareCleanDocumentStoriesCapsule(authority, parsed, context);
  assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(result.changed, true);
  assert.equal(result.fields.storyReturnCandidate.changes[0].afterBody.content[0].content[0].text, 'Actual DOCX header edit');
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
