'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const comments = require('../../src/export/docx/docxReviewPacketComments.js');
const { buildDocxMinBuffer } = require('../../src/export/docx/docxMinBuilder.js');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const projectId = 'scoped-comments';
const sceneId = 'roman/a.txt';
const paragraphText = 'Before 🧭 anchor and after.';
const block = { sceneId, blockId: 'block-a', documentParagraphIndex: 0, text: paragraphText };
const provenance = { author: ' Редактор & <A> ', initials: 'РA', date: '2026-10-02T08:15:00Z' };
function thread(id, scene = sceneId) {
  return { threadId: `thread-${id}`, sceneId: scene, rootCommentId: `root-${id}`, status: 'open',
    anchor: { sceneId: scene, blockId: scene === sceneId ? block.blockId : 'sibling-block',
      selectedText: '🧭 anchor', selectedTextSha256: sha('🧭 anchor'), startUtf16: 7 },
    messages: [{ commentId: `root-${id}`, kind: 'root', body: `Root ${id} & <текст>`, provenance },
      { commentId: `reply-${id}`, kind: 'reply', body: `Reply ${id}`, provenance }] };
}
function state() {
  return { schemaVersion: 'yalken.rtk.word.non-text-return-state.v1', projectId, revision: 4,
    threads: [thread('private', 'roman/private.txt'), thread('selected')], events: [] };
}
const doc = () => ({ type: 'doc', content: [{ type: 'paragraph', content: [
  { type: 'text', text: 'Before 🧭 an', marks: [{ type: 'bold' }] },
  { type: 'text', text: 'chor and after.', marks: [{ type: 'italic' }] },
] }] });
async function dependencies() {
  const [docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await Promise.all([
    import('../../src/docxPageSetupBind.mjs'), import('../../src/derived/semanticMapping.mjs'), import('../../src/derived/styleMap.mjs'),
  ]);
  return { docxPageSetupBindModule, semanticMappingModule, styleMapModule };
}
async function read(bytes) {
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const result = bridge.buildDocxReviewTransportAnalysisFromZipBytes({ bytes }, { cryptoPort: {
    sha256Text: sha, sha256Json: value => 'sha256:' + sha(JSON.stringify(value)), byteLength: value => Buffer.byteLength(value),
  } });
  assert.equal(result.ok, true, JSON.stringify(result.reasons));
  return { bridge, result, parts: bridge.extractDocxReviewTransportPackagePartsFromZipBytes({ bytes }).parts };
}
test('scoped projection keeps full canonical digest while excluding sibling graph and transport ordinals', () => {
  const full = state(), before = JSON.stringify(full);
  const selected = comments.buildCanonicalCommentExport(full, [block], projectId, { sceneId });
  assert.equal(selected.stateDigest, comments.commentStateDigest(full));
  assert.equal(selected.stateRevision, 4);
  assert.deepEqual(selected.threads.map(t => t.threadId), ['thread-selected']);
  assert.equal(selected.threads[0].messages[0].commentId, '0');
  assert.doesNotMatch(JSON.stringify(selected), /private/);
  assert.equal(JSON.stringify(full), before);
});
test('Minimal scoped comments survive actual ZIP parsing alongside styled Unicode text', async () => {
  const full = state(), selected = comments.buildCanonicalCommentExport(full, [block], projectId, { sceneId });
  const bytes = buildDocxMinBuffer({ doc: doc(), plainText: paragraphText, bookProfile: { formatId: 'A4' } },
    { ...await dependencies(), commentExport: selected, commentBlocks: [block] });
  const { result, parts } = await read(bytes);
  assert.equal(comments.compareCommentExportReadback(selected, result.reviewIr.commentThreads).ok, true);
  assert.equal(result.reviewIr.commentThreads.length, 1);
  assert.doesNotMatch(bytes.toString(), /private/);
  assert.match(parts['word/document.xml'], /<w:b w:val="1"\/>/);
  assert.match(parts['word/document.xml'], /<w:i w:val="1"\/>/);
  for (const name of ['comments.xml', 'commentsExtended.xml', 'commentsIds.xml', 'commentsExtensible.xml']) {
    assert.ok(parts[`word/${name}`]);
    assert.ok(parts['[Content_Types].xml'].includes(name));
    assert.ok(parts['word/_rels/document.xml.rels'].includes(name));
  }
});

test('empty selected scopes retain whole-state absence binding, while default full export remains complete', () => {
  const full = state(), blocks = [{ ...block, sceneId: 'roman/private.txt', blockId: 'sibling-block', documentParagraphIndex: 0 },
    { ...block, documentParagraphIndex: 1 }];
  const complete = comments.buildCanonicalCommentExport(full, blocks, projectId);
  assert.equal(complete.threads.length, 2);
  const empty = comments.buildCanonicalCommentExport(full, [], projectId, { sceneId: 'roman/empty.txt' });
  assert.deepEqual(empty.threads, []); assert.deepEqual(empty.tombstones, []);
  assert.equal(empty.stateDigest, complete.stateDigest);
  assert.deepEqual(comments.commentPackageParts(empty), { entries: [], contentTypes: '', relationships: '' });
  assert.equal(comments.buildCanonicalCommentExport(undefined, [], projectId, { sceneId }), null);
  assert.throws(() => comments.buildCanonicalCommentExport(full, [block], projectId, { sceneId: '' }), /SCOPE_INVALID/);
});

for (const [name, mutate, code] of [
  ['sibling duplicate root identity', full => { full.threads[0].messages[0].commentId = full.threads[0].rootCommentId = 'root-selected'; }, 'IDENTITY_COLLISION'],
  ['sibling reply kind', full => { full.threads[0].messages[1].kind = 'root'; }, 'MESSAGE_INVALID'],
  ['sibling root mismatch', full => { full.threads[0].rootCommentId = 'missing'; }, 'ROOT_IDENTITY_INVALID'],
  ['sibling malformed provenance', full => { full.threads[0].messages[0].provenance = { author: 5 }; }, 'PROVENANCE_INVALID'],
  ['sibling malformed UTF16', full => { full.threads[0].messages[0].body = 'bad\uD800'; }, 'SURROGATE'],
  ['sibling stale anchor hash', full => { full.threads[0].anchor.selectedTextSha256 = '0'.repeat(64); }, 'ANCHOR_INVALID'],
  ['sibling deleted reply duplicate', full => { full.threads[0].deletedMessages = [{ commentId: 'reply-selected', kind: 'reply', body: 'removed' }]; }, 'IDENTITY_COLLISION'],
  ['project mismatch', full => { full.projectId = 'foreign'; }, 'STATE_INVALID'],
]) test(`scoped projection rejects ${name} before filtering`, () => {
  const full = state(); mutate(full);
  assert.throws(() => comments.buildCanonicalCommentExport(full, [block], projectId, { sceneId }), new RegExp(code));
});

test('same-offset note, bookmark and comment markers preserve all identities and exact rich Unicode anchors', async () => {
  const bookmark = require('../../src/core/word-user-bookmarks-v1.cjs');
  const envelope = require('../../src/core/document-content-envelope-v1.cjs');
  const noteModel = require('../../src/core/word-manuscript-notes-v1.cjs');
  const noteExport = require('../../src/export/docx/docxReviewPacketNotes.js');
  const marked = bookmark.planMutation({ doc: doc(), action: 'create', requestId: 'bookmark-1', projectId, sceneId,
    name: 'SharedAnchor', start: { paragraphIndex: 0, offsetUtf16: 7, edge: 'text' }, end: { paragraphIndex: 0, offsetUtf16: 16, edge: 'text' } }).doc;
  const raw = envelope.composeObservablePayload({ doc: marked });
  const notes = { schemaVersion: 1, projectId, notes: [{ id: 'note-a', title: '', body: 'Footnote 😀', scope: 'manuscript',
    manuscript: noteModel.bindManuscriptPayload({ kind: 'footnote', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Footnote 😀' }] }] },
      sceneId, offsetUtf16: 7, sceneContent: raw }) }] };
  const projection = comments.buildCanonicalCommentExport(state(), [block], projectId, { sceneId });
  const bytes = buildDocxMinBuffer({ doc: marked, plainText: paragraphText, bookProfile: { formatId: 'A4' } }, {
    ...await dependencies(), commentExport: projection, commentBlocks: [block],
    documentNotes: noteExport.buildCanonicalNotesExport(notes, [], [block], projectId, { editableReturn: true }), noteBlocks: [block],
  });
  const { bridge, result, parts } = await read(bytes);
  assert.equal(comments.compareCommentExportReadback(projection, result.reviewIr.commentThreads).ok, true);
  const preview = bridge.buildDocxContentPreviewFromZipBytes(bytes);
  assert.equal(preview.ok, true, JSON.stringify(preview));
  assert.equal(preview.contentPreview.manuscriptNotes.length, 1);
  assert.equal(preview.contentPreview.manuscriptNotes[0].offsetUtf16, 7);
  assert.match(parts['word/document.xml'], /footnoteReference[^]*commentRangeStart[^]*bookmarkStart[^]*🧭 an/);
  const parsed = bridge.buildDocxImportPreviewPlanFromContentPreview(preview);
  assert.equal(parsed.ok, true, JSON.stringify(parsed));
  const returned = envelope.parseObservablePayload(parsed.candidateCreatePlan.entries[0].content).doc;
  const registry = bookmark.readRegistry(returned);
  assert.equal(registry.bookmarks.length, 1);
  assert.equal(registry.bookmarks[0].name, 'SharedAnchor');
  assert.equal(registry.bookmarks[0].start.offsetUtf16, 7);
  assert.equal(registry.bookmarks[0].end.offsetUtf16, 16);
});

test('selected resolved root and deleted replies retain semantics; sibling and deleted bodies never enter ZIP', async () => {
  const full = state(), selectedThread = full.threads[1]; selectedThread.status = 'resolved';
  selectedThread.deletedMessages = [{ commentId: 'deleted-reply', kind: 'reply', body: 'SECRET_DELETED_REPLY' }];
  const deleted = thread('deleted'); deleted.status = 'deleted'; deleted.deleted = true;
  deleted.messages[0].body = 'SECRET_DELETED_ROOT'; full.threads.push(deleted);
  const siblingDeleted = thread('private-deleted', 'roman/private.txt'); siblingDeleted.status = 'deleted'; full.threads.push(siblingDeleted);
  const projection = comments.buildCanonicalCommentExport(full, [block], projectId, { sceneId });
  assert.deepEqual(projection.tombstones.map(t => t.threadId), ['thread-selected', 'thread-deleted']);
  const bytes = buildDocxMinBuffer({ doc: doc(), plainText: paragraphText, bookProfile: { formatId: 'A4' } },
    { ...await dependencies(), commentExport: projection, commentBlocks: [block] });
  const { result } = await read(bytes);
  assert.equal(result.reviewIr.commentThreads[0].status, 'RESOLVED');
  assert.equal(comments.compareCommentExportReadback(projection, result.reviewIr.commentThreads).ok, true);
  assert.doesNotMatch(bytes.toString(), /private|SECRET_DELETED/);
});

test('Minimal refuses missing, stale and wrong-index blocks while preserving bound pending comments', async () => {
  const projection = comments.buildCanonicalCommentExport(state(), [block], projectId, { sceneId }), deps = await dependencies();
  const snapshot = { doc: doc(), plainText: paragraphText, bookProfile: { formatId: 'A4' } };
  for (const blocks of [undefined, [], [{ ...block, text: 'changed' }], [{ ...block, documentParagraphIndex: 1 }], [{ ...block, blockId: 'wrong' }]]) {
    assert.throws(() => buildDocxMinBuffer(snapshot, { ...deps, commentExport: projection, commentBlocks: blocks }), /DOCX_COMMENT_ANCHOR_STALE/);
  }
  const pending = require('../../src/core/word-pending-text-revisions-v1.cjs');
  const pendingDoc = pending.bindLedger({ schemaVersion: 2, source: doc(), revisions: [{ id: 'revision-1', nativeId: '1', operation: 'insert',
    author: 'Reviewer', date: '', dateUtc: '', paragraphIndex: 0, from: 0, to: 1, state: 'pending', groupId: null }],
    undo: [], redo: [], roundUndo: [], roundRedo: [], returnReceipts: [] });
  const mixedBytes = buildDocxMinBuffer({ ...snapshot, doc: pendingDoc }, { ...deps, commentExport: projection, commentBlocks: [block] });
  const mixed = await read(mixedBytes);
  assert.equal(mixed.result.reviewIr.commentThreads.length, 1);
  assert.equal(mixed.result.reviewIr.commentThreads[0].quotedAnchorText, '🧭 anchor');
  assert.equal((mixed.parts['word/document.xml'].match(/<w:ins\b/g)||[]).length, 1);
  for (const commentBlocks of [undefined, [{...block,sceneId:'foreign'}], [{...block,text:'forged'}]]) {
    assert.throws(() => buildDocxMinBuffer({ ...snapshot, doc: pendingDoc }, { ...deps, commentExport: projection, commentBlocks }));
  }
  const noSelected = comments.buildCanonicalCommentExport(state(), [], projectId, { sceneId: 'roman/empty.txt' });
  assert.ok(buildDocxMinBuffer({ ...snapshot, doc: pendingDoc }, { ...deps, commentExport: noSelected }));
});

test('Minimal nested table leaves retain comment coordinates and styled text through generic import', async () => {
  const c = content => ({ type: 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content });
  const table = content => ({ type: 'table', content: [{ type: 'tableRow', content }] });
  const empty = { type: 'paragraph' };
  const nested = { type: 'doc', content: [table([c([empty, table([c(doc().content)]), empty])])] };
  const blocks = [{ ...block, blockId: 'empty-before', text: '', documentParagraphIndex: 0 },
    { ...block, documentParagraphIndex: 1 }, { ...block, blockId: 'empty-after', text: '', documentParagraphIndex: 2 }];
  const projection = comments.buildCanonicalCommentExport(state(), blocks, projectId, { sceneId });
  const bytes = buildDocxMinBuffer({ doc: nested, plainText: '\n' + paragraphText + '\n', bookProfile: { formatId: 'A4' } },
    { ...await dependencies(), commentExport: projection, commentBlocks: blocks });
  const { bridge, result, parts } = await read(bytes);
  assert.equal(comments.compareCommentExportReadback(projection, result.reviewIr.commentThreads).ok, true);
  assert.equal((parts['word/document.xml'].match(/<w:tbl>/g) || []).length, 2);
  const preview = bridge.buildDocxContentPreviewFromZipBytes(bytes);
  assert.equal(preview.ok, true, JSON.stringify(preview));
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(preview);
  assert.equal(plan.ok, true, JSON.stringify(plan));
  const imported = require('../../src/core/document-content-envelope-v1.cjs').parseObservablePayload(plan.candidateCreatePlan.entries[0].content).doc;
  assert.equal(imported.content[0].type, 'table');
  assert.equal(imported.content[0].content[0].content[0].content[1].type, 'table');
});

test('adjacent comment boundaries close before opening next range and keep distinct identities', async () => {
  const full = state(), next = thread('next');
  next.anchor = { ...next.anchor, selectedText: ' and', startUtf16: 16, selectedTextSha256: sha(' and') };
  // Reverse graph order, so correct XML cannot rely on insertion order.
  full.threads.splice(1, 0, next);
  const projection = comments.buildCanonicalCommentExport(full, [block], projectId, { sceneId });
  const bytes = buildDocxMinBuffer({ doc: doc(), plainText: paragraphText, bookProfile: { formatId: 'A4' } },
    { ...await dependencies(), commentExport: projection, commentBlocks: [block] });
  const { result, parts } = await read(bytes);
  assert.equal(comments.compareCommentExportReadback(projection, result.reviewIr.commentThreads).ok, true);
  assert.match(parts['word/document.xml'], /commentRangeEnd w:id="3"[^]*commentReference w:id="3"[^]*commentRangeStart w:id="0"/);
});
