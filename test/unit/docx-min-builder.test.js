const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const { buildDocxMinBuffer } = require(path.join(
  process.cwd(),
  'src',
  'export',
  'docx',
  'docxMinBuilder.js',
));

function createBuilderDependencies() {
  return {
    docxPageSetupBindModule: {
      buildDocxSectionPropertiesXml: () => '<w:sectPr/>',
    },
    semanticMappingModule: {
      PAGE_BREAK_TOKEN_V1: '[[PAGE_BREAK]]',
      mapSemanticEntries: ({ text }) => ({
        entries: String(text || '')
          .split('\n')
          .map((line) => ({ kind: 'paragraph', text: line })),
      }),
    },
    styleMapModule: {
      createStyleMap: () => ({
        resolve: () => ({}),
      }),
    },
  };
}

function readStoredZipEntry(buffer, entryName) {
  let offset = 0;

  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > buffer.length) break;

    const name = buffer.slice(nameStart, nameEnd).toString('utf8');
    const dataStart = nameEnd + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (name === entryName) {
      return buffer.slice(dataStart, dataEnd).toString('utf8');
    }
    offset = dataEnd;
  }

  return '';
}

async function loadDocxPageSetupBindModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'docxPageSetupBind.mjs')).href);
}

async function createRealBuilderDependencies() {
  const [docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await Promise.all([
    loadDocxPageSetupBindModule(),
    import(pathToFileURL(path.join(process.cwd(), 'src', 'derived', 'semanticMapping.mjs')).href),
    import(pathToFileURL(path.join(process.cwd(), 'src', 'derived', 'styleMap.mjs')).href),
  ]);
  return {
    docxPageSetupBindModule,
    semanticMappingModule,
    styleMapModule,
  };
}

function textRunValues(documentXml) {
  return Array.from(String(documentXml).matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gu))
    .map((match) => match[1]);
}

function countOccurrences(text, pattern) {
  return (String(text).match(pattern) || []).length;
}

test('docx min builder: horizontal sheet text produces in-memory docx buffer', () => {
  const horizontalText = 'Центральная лента листов: горизонтальный лист готовит plain text для минимального DOCX.';
  const buffer = buildDocxMinBuffer({ plainText: horizontalText }, createBuilderDependencies());
  const output = buffer.toString('utf8');

  assert.equal(Buffer.isBuffer(buffer), true);
  assert.ok(buffer.length > 0);
  assert.ok(output.includes('[Content_Types].xml'));
  assert.ok(output.includes('_rels/.rels'));
  assert.ok(output.includes('word/document.xml'));
  assert.ok(output.includes(horizontalText));
  assert.ok(output.includes('<w:sectPr/>'));
});

test('docx min builder: text is xml-escaped in memory without filesystem writes', () => {
  const sourceText = 'Горизонтальный лист & экспорт <DOCX>';
  const buffer = buildDocxMinBuffer(sourceText, createBuilderDependencies());
  const output = buffer.toString('utf8');

  assert.ok(output.includes('Горизонтальный лист &amp; экспорт &lt;DOCX&gt;'));
  assert.equal(output.includes(sourceText), false);
});

test('docx min builder: explicit empty selected comment scope leaves historical bytes unchanged', () => {
  const snapshot = 'A scene with no selected comments';
  const deps = createBuilderDependencies();
  const ordinary = buildDocxMinBuffer(snapshot, deps);
  const scoped = buildDocxMinBuffer(snapshot, { ...deps, commentExport: {
    schemaVersion: 'yalken.rtk.canonical-comment-export.v1', projectId: 'project-a', stateRevision: 7,
    stateDigest: 'a'.repeat(64), threads: [], tombstones: [],
  } });
  assert.deepEqual(scoped, ordinary);
});

test('docx min builder: bookProfile landscape option reaches DOCX page XML', async () => {
  const docxPageSetupBindModule = await loadDocxPageSetupBindModule();
  const dependencies = {
    ...createBuilderDependencies(),
    docxPageSetupBindModule,
  };

  const portraitBuffer = buildDocxMinBuffer({
    plainText: 'Portrait default text',
    bookProfile: { formatId: 'A4' },
  }, dependencies);
  const portraitXml = readStoredZipEntry(portraitBuffer, 'word/document.xml');
  const portraitPgSz = portraitXml.match(/<w:pgSz w:w="(\d+)" w:h="(\d+)"\/>/u);
  assert.ok(portraitPgSz);
  assert.equal(portraitXml.includes('w:orient="landscape"'), false);
  assert.ok(Number(portraitPgSz[1]) < Number(portraitPgSz[2]));

  const landscapeBuffer = buildDocxMinBuffer({
    plainText: 'Landscape page text',
    bookProfile: { formatId: 'A4', orientation: 'landscape' },
  }, dependencies);
  const landscapeXml = readStoredZipEntry(landscapeBuffer, 'word/document.xml');
  const landscapePgSz = landscapeXml.match(/<w:pgSz w:w="(\d+)" w:h="(\d+)" w:orient="landscape"\/>/u);
  assert.ok(landscapePgSz);
  assert.ok(Number(landscapePgSz[1]) > Number(landscapePgSz[2]));
});

test('docx min builder: consecutive plain text lines use Word line breaks instead of literal LF in text runs', async () => {
  const dependencies = await createRealBuilderDependencies();
  const buffer = buildDocxMinBuffer({
    content: 'Alpha line\nBeta line',
    plainText: 'Alpha line\nBeta line',
    bookProfile: { formatId: 'A4' },
  }, dependencies);
  const documentXml = readStoredZipEntry(buffer, 'word/document.xml');
  const runs = textRunValues(documentXml);

  assert.equal(countOccurrences(documentXml, /<w:br\/>/gu), 1);
  assert.deepEqual(runs, ['Alpha line', 'Beta line']);
  assert.equal(runs.some((value) => value.includes('\n')), false);
});

test('docx min builder: Tiptap hardBreak uses Word line break markup', async () => {
  const dependencies = await createRealBuilderDependencies();
  const buffer = buildDocxMinBuffer({
    content: 'Doc alpha\nDoc beta',
    plainText: 'Doc alpha\nDoc beta',
    bookProfile: { formatId: 'A4' },
    doc: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Doc alpha' },
            { type: 'hardBreak' },
            { type: 'text', text: 'Doc beta' },
          ],
        },
      ],
    },
  }, dependencies);
  const documentXml = readStoredZipEntry(buffer, 'word/document.xml');
  const runs = textRunValues(documentXml);

  assert.equal(countOccurrences(documentXml, /<w:br\/>/gu), 1);
  assert.deepEqual(runs, ['Doc alpha', 'Doc beta']);
  assert.equal(runs.some((value) => value.includes('\n')), false);
});

test('docx min builder: source doc text node CR uses Word line break markup', async () => {
  const dependencies = await createRealBuilderDependencies();
  const buffer = buildDocxMinBuffer({
    content: 'Doc alpha\rDoc beta',
    plainText: 'Doc alpha\rDoc beta',
    bookProfile: { formatId: 'A4' },
    doc: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Doc alpha\rDoc beta' }],
        },
      ],
    },
  }, dependencies);
  const documentXml = readStoredZipEntry(buffer, 'word/document.xml');
  const runs = textRunValues(documentXml);

  assert.equal(countOccurrences(documentXml, /<w:br\/>/gu), 1);
  assert.deepEqual(runs, ['Doc alpha', 'Doc beta']);
  assert.equal(runs.some((value) => value.includes('\r') || value.includes('\n')), false);
});

test('docx min builder: source doc text node CRLF uses one Word line break without CR in text runs', async () => {
  const dependencies = await createRealBuilderDependencies();
  const buffer = buildDocxMinBuffer({
    content: 'Doc alpha\r\nDoc beta',
    plainText: 'Doc alpha\r\nDoc beta',
    bookProfile: { formatId: 'A4' },
    doc: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Doc alpha\r\nDoc beta' }],
        },
      ],
    },
  }, dependencies);
  const documentXml = readStoredZipEntry(buffer, 'word/document.xml');
  const runs = textRunValues(documentXml);

  assert.equal(countOccurrences(documentXml, /<w:br\/>/gu), 1);
  assert.deepEqual(runs, ['Doc alpha', 'Doc beta']);
  assert.equal(runs.some((value) => value.includes('\r') || value.includes('\n')), false);
});

test('docx min builder: separate doc paragraphs stay separate paragraphs without synthetic line breaks', async () => {
  const dependencies = await createRealBuilderDependencies();
  const buffer = buildDocxMinBuffer({
    content: 'Paragraph alpha\nParagraph beta',
    plainText: 'Paragraph alpha\nParagraph beta',
    bookProfile: { formatId: 'A4' },
    doc: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Paragraph alpha' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Paragraph beta' }],
        },
      ],
    },
  }, dependencies);
  const documentXml = readStoredZipEntry(buffer, 'word/document.xml');
  const runs = textRunValues(documentXml);

  assert.equal(countOccurrences(documentXml, /<w:br\/>/gu), 0);
  assert.deepEqual(runs, ['Paragraph alpha', 'Paragraph beta']);
  assert.equal(countOccurrences(documentXml, /<w:p(?:>| )/gu), 2);
});

async function importedDeletedCommentExport() {
  const bytes = require('node:fs').readFileSync(path.join(__dirname, '../fixtures/docx-pending-deleted-comment-import.docx'));
  const hash = value => require('node:crypto').createHash('sha256').update(value).digest('hex');
  assert.equal(hash(bytes), '796093baf899f924a0e9f401cbc9c241144931a96beecab71e20655a2641fabf');
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const core = await import('../../src/core/docx-new-project-v1.mjs');
  const pending = require('../../src/core/word-pending-text-revisions-v1.cjs');
  const comments = require('../../src/export/docx/docxReviewPacketComments.js');
  const source = require('../../src/export/docx/fullManuscriptDocxReviewPacketSource.js');
  const notes = require('../../src/export/docx/docxReviewPacketNotes.js');
  const plan = bridge.buildDocxNovelImportPreviewPlanFromContentPreview(bridge.buildDocxContentPreviewFromZipBytes(bytes));
  assert.equal(plan.ok, true);
  const projectId = 'ba52be5f-6a53-4fde-b87e-783b51d4e810';
  const prepared = core.prepareDocxNewProject({ plan, projectId, projectName: 'P05 deleted comment export',
    operationId: 'p05-deleted-point-min', createdAtUtc: '2026-11-10T00:00:00.000Z' });
  const scene = prepared.files.find(file => file.role === 'scene');
  const parsed = require('../../src/core/document-content-envelope-v1.cjs').parseObservablePayload(scene.content);
  assert.equal(parsed.issue, null);
  const doc = parsed.doc, sceneId = scene.relativePath;
  const state = JSON.parse(prepared.files.find(file => file.role === 'comments').content);
  const noteState = JSON.parse(prepared.files.find(file => file.role === 'notes').content);
  const paragraphs = pending.paragraphs(pending.normalizeNode(doc)).map(block =>
    (block.content || []).map(node => node.type === 'hardBreak' ? '\n' : node.text).join(''));
  const formats = source.buildFormatIrParagraphs({ sceneId, doc, text: paragraphs.join('\n') });
  const points = pending.noteProjection(doc, 'export');
  const blocks = paragraphs.map((text, index) => ({ sceneId, blockId: `scene-note-block-${index}`,
    documentParagraphIndex: index, text, formatIr: formats[index], pendingNoteSourcePoints: points
      .filter(point => point.paragraphIndex === index).map(({ noteId, offsetUtf16 }) => ({ noteId, offsetUtf16 })) }));
  const project = stateOverride => comments.buildCanonicalCommentExport(stateOverride || state, blocks, projectId, { sceneId });
  const bind = projection => comments.bindPendingCommentExport({ commentExport: projection, scenes: [{ sceneId, doc }], blocks }).commentExport;
  const deps = { ...await createRealBuilderDependencies(), noteBlocks: blocks, commentBlocks: blocks,
    documentNotes: notes.buildCanonicalNotesExport(noteState, [], blocks, projectId) };
  return { bridge, pending, comments, hash, projectId, sceneId, doc, state, noteState, paragraphs, blocks, project, bind, deps };
}

test('docx min builder: imported deleted-text comment exports its union range and returns to the exact Current point', async () => {
  const h = await importedDeletedCommentExport();
  const before = JSON.stringify([h.doc, h.state, h.noteState]);
  const commentExport = h.bind(h.project());
  const buffer = buildDocxMinBuffer({ doc: h.doc, bookProfile: { formatId: 'A4' } }, { ...h.deps, commentExport });
  const xml = readStoredZipEntry(buffer, 'word/document.xml');
  const start = xml.indexOf('<w:commentRangeStart w:id="2"');
  const deleted = xml.indexOf('УДАЛЕНИЕ🧭');
  const end = xml.indexOf('<w:commentRangeEnd w:id="2"');
  assert.ok(start >= 0 && start < deleted && deleted < end, 'the hidden comment must enclose the deleted literal');
  assert.equal(countOccurrences(xml, /<w:ins\b/gu), 1);
  assert.equal(countOccurrences(xml, /<w:del\b/gu), 1);
  assert.ok(readStoredZipEntry(buffer, 'word/footnotes.xml').includes('Содержание сноски сохраняется.'));
  for (const body of ['Обсуждение вставки', 'Ответ к вставке', 'Обсуждение удаления', 'Именно второй повтор']) {
    assert.ok(readStoredZipEntry(buffer, 'word/comments.xml').includes(body));
  }
  const returned = h.bridge.buildDocxNovelImportPreviewPlanFromContentPreview(h.bridge.buildDocxContentPreviewFromZipBytes(buffer));
  assert.equal(returned.ok, true);
  const entry = returned.candidateCreatePlan.entries[0];
  const returnedDoc = require('../../src/core/document-content-envelope-v1.cjs').parseObservablePayload(entry.content).doc;
  const originalProjection = h.pending.projection(h.doc);
  assert.deepEqual(originalProjection.revisions.map(revision => revision.nativeId), ['10', '11']);
  // A newly generated Word package assigns its own native revision IDs.
  assert.deepEqual(h.pending.projection(returnedDoc), { ...originalProjection,
    revisions: originalProjection.revisions.map((revision, index) => ({ ...revision, nativeId: String(index + 1) })) });
  assert.equal(entry.comments.length, 3);
  assert.deepEqual(entry.comments.map(thread => thread.messages.map(message => message.body)),
    [['Обсуждение вставки', 'Ответ к вставке'], ['Обсуждение удаления'], ['Именно второй повтор']]);
  assert.deepEqual([entry.comments[1].kind, entry.comments[1].affinity, entry.comments[1].paragraphIndex,
    entry.comments[1].startUtf16, entry.comments[1].selectedText], ['point', 'right', 2, 3, '']);
  assert.deepEqual([entry.comments[1].pendingUnionLocator.unionStart, entry.comments[1].pendingUnionLocator.unionEnd],
    [{ paragraphIndex: 2, offsetUtf16: 3 }, { paragraphIndex: 2, offsetUtf16: 13 }]);
  assert.equal(entry.comments[2].paragraphIndex, 3, 'the repeated quote stays in the second occurrence');
  assert.equal(entry.notes.length, 1);
  assert.equal(commentExport.threads[1].anchor.kind, 'point', 'canonical Current anchor remains a point');
  assert.equal(commentExport.threads[1].pendingAnchor.kind, undefined, 'nonempty Word span uses the existing standard range');
  assert.equal(JSON.stringify([h.doc, h.state, h.noteState]), before);
});

test('docx min builder: a genuine zero-length pending comment remains a point', async () => {
  const h = await importedDeletedCommentExport();
  const state = structuredClone(h.state);
  state.threads = [state.threads[2]];
  state.threads[0].anchor = require('../../src/core/word-comment-authoring-v1.cjs').exactAnchor({ kind: 'point',
    affinity: 'right', paragraphIndex: 3, startUtf16: 18, selectedText: '' }, h.sceneId, h.paragraphs);
  const before = JSON.stringify(state), projection = h.bind(h.project(state));
  assert.equal(projection.threads[0].pendingAnchor.kind, 'point');
  assert.equal(projection.threads[0].pendingAnchor.startUtf16, projection.threads[0].pendingAnchor.endUtf16);
  assert.doesNotThrow(() => buildDocxMinBuffer({ doc: h.doc, bookProfile: { formatId: 'A4' } }, { ...h.deps, commentExport: projection }));
  assert.equal(JSON.stringify(state), before);
});

test('docx min builder: stale union geometry, current hash, split UTF16 and foreign comment scope still refuse', async () => {
  const h = await importedDeletedCommentExport();
  const geometry = structuredClone(h.state);
  geometry.threads[1].anchor.pendingUnionLocator.geometrySha256 = '0'.repeat(64);
  assert.throws(() => h.bind(h.project(geometry)), /PENDING_COMMENT_LOCATOR_STALE/);
  const unionSplit = structuredClone(h.state);
  unionSplit.threads[1].anchor.pendingUnionLocator.unionEnd.offsetUtf16 -= 1;
  assert.throws(() => h.bind(h.project(unionSplit)), /PENDING_COMMENT_ENDPOINT_INVALID/);
  const stale = structuredClone(h.state);
  stale.threads[0].anchor.blockTextSha256 = '0'.repeat(64);
  assert.throws(() => h.project(stale), /DOCX_COMMENT_ANCHOR_STALE/);
  const split = structuredClone(h.state);
  Object.assign(split.threads[0].anchor, { kind: 'point', affinity: 'right', selectedText: '',
    selectedTextSha256: h.hash(''), startUtf16: 11 });
  assert.throws(() => h.project(split), /DOCX_COMMENT_ANCHOR_UTF16_BOUNDARY/);
  assert.throws(() => h.comments.buildCanonicalCommentExport(h.state, h.blocks, 'foreign-project', { sceneId: h.sceneId }), /DOCX_COMMENT_STATE_INVALID/);
});
