const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');
const GOLDENS_PATH = path.join(
  ROOT,
  'test',
  'fixtures',
  'markdown',
  'phase04',
  'canonical-document-goldens.json',
);
const STATUS_PATH = path.join(
  ROOT,
  'docs',
  'OPS',
  'STATUS',
  'REVIEW_BRIDGE_MARKDOWN_PRODUCT_COMPLETION_001_STATUS.json',
);

async function loadModules() {
  const transform = await import(pathToFileURL(path.join(
    ROOT,
    'src',
    'export',
    'markdown',
    'v1',
    'index.mjs',
  )).href);
  const envelope = await import(pathToFileURL(path.join(
    ROOT,
    'src',
    'renderer',
    'documentContentEnvelope.mjs',
  )).href);
  return { transform, envelope };
}

function loadCanonicalMarkdownReader(context = {}) {
  const mainSource = fs.readFileSync(path.join(ROOT, 'src', 'main.js'), 'utf8');
  const start = mainSource.indexOf('async function readCanonicalMarkdownExportSource()');
  const end = mainSource.indexOf('function summarizeMarkdownLossReport(lossReport)', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return vm.runInNewContext(
    `${mainSource.slice(start, end)}\nreadCanonicalMarkdownExportSource`,
    context,
  );
}

test('Phase 04 canonical Markdown goldens preserve literals, structure, Unicode, CRLF, and visible losses', async () => {
  const { transform, envelope } = await loadModules();
  const fixture = JSON.parse(fs.readFileSync(GOLDENS_PATH, 'utf8'));
  assert.equal(fixture.schemaVersion, 'markdown-phase04-goldens.v1');
  assert.equal(fixture.cases.length, 10);

  for (const golden of fixture.cases) {
    const scene = golden.sourceKind === 'document'
      ? transform.documentToMarkdownSceneV1(golden.source)
      : transform.legacyTextToMarkdownSceneV1(golden.source);
    const artifact = transform.serializeMarkdownV1WithLossReport(scene);
    assert.equal(artifact.markdown, golden.expectedMarkdown, golden.id);
    assert.deepEqual(
      artifact.lossReport.items.map((item) => item.code),
      golden.expectedLossCodes,
      golden.id,
    );
    assert.equal(
      artifact.lossReport.items.every((item) => (
        item.severity === 'WARN'
        && item.message.length > 0
        && item.path.length > 0
      )),
      true,
      golden.id,
    );

    const parsedScene = transform.parseMarkdownV1(artifact.markdown);
    const imported = transform.markdownSceneV1ToDocument(parsedScene);
    assert.deepEqual(
      imported.doc.content.map((block) => block.type),
      golden.expectedRoundTripBlockTypes,
      `${golden.id}:block-types`,
    );
    assert.equal(
      envelope.deriveVisibleTextFromDocument(imported.doc),
      golden.expectedVisibleText,
      golden.id,
    );
    if (Array.isArray(golden.expectedInlineRuns)) {
      const actualRuns = (imported.doc.content[0]?.content || []).map((node) => {
        const marks = Array.isArray(node.marks) ? node.marks : [];
        const link = marks.find((mark) => mark.type === 'link');
        return {
          text: node.text,
          marks: marks.map((mark) => mark.type),
          ...(link?.attrs?.href ? { href: link.attrs.href } : {}),
        };
      });
      assert.deepEqual(actualRuns, golden.expectedInlineRuns, `${golden.id}:inline-runs`);
    }
    if (typeof golden.expectedRoundTripCode === 'string') {
      assert.equal(
        imported.doc.content[0]?.content?.[0]?.text,
        golden.expectedRoundTripCode,
        `${golden.id}:code-text`,
      );
    }
  }
});

test('Phase 04 serializer loss report comes from canonical document conversion, not reparsing output', async () => {
  const { transform } = await loadModules();
  const scene = transform.documentToMarkdownSceneV1({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Underline survives', marks: [{ type: 'underline' }] }],
      },
    ],
  });
  const artifact = transform.serializeMarkdownV1WithLossReport(scene);

  assert.equal(artifact.markdown, 'Underline survives\n');
  assert.deepEqual(
    artifact.lossReport.items.map((item) => item.code),
    ['MDV1_DOCUMENT_UNSUPPORTED_MARK_DOWNGRADED'],
  );
  assert.equal(transform.parseMarkdownV1(artifact.markdown).lossReport.count, 0);
});

test('Phase 04 supported inline controls and mark combinations roundtrip across 72 vectors', async () => {
  const { transform } = await loadModules();
  const values = [
    '# literal',
    '- literal',
    '1. literal',
    '> literal',
    '*** controls [x] _',
    '`edge`',
    '``',
    'back\\slash',
    'Unicode café ✨',
  ];
  const href = 'https://example.test/a(b)c';
  const markSets = [
    [],
    [{ type: 'bold' }],
    [{ type: 'italic' }],
    [{ type: 'bold' }, { type: 'italic' }],
    [{ type: 'code' }],
    [{ type: 'bold' }, { type: 'link', attrs: { href } }],
    [{ type: 'italic' }, { type: 'link', attrs: { href } }],
    [{ type: 'bold' }, { type: 'italic' }, { type: 'link', attrs: { href } }],
  ];

  let vectors = 0;
  for (const value of values) {
    for (const marks of markSets) {
      const documentModel = {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{
            type: 'text',
            text: value,
            ...(marks.length > 0 ? { marks } : {}),
          }],
        }],
      };
      const scene = transform.documentToMarkdownSceneV1(documentModel);
      const artifact = transform.serializeMarkdownV1WithLossReport(scene);
      const imported = transform.markdownSceneV1ToDocument(transform.parseMarkdownV1(artifact.markdown));
      const paragraph = imported.doc.content[0];
      const actualText = (paragraph.content || []).map((node) => node.text || '').join('');
      const actualMarks = paragraph.content?.[0]?.marks?.map((mark) => mark.type) || [];

      assert.equal(artifact.lossReport.count, 0, `${value}:${marks.map((mark) => mark.type).join(',')}`);
      assert.equal(paragraph.type, 'paragraph');
      assert.equal(actualText, value);
      assert.deepEqual(actualMarks, marks.map((mark) => mark.type));
      vectors += 1;
    }
  }
  assert.equal(vectors, 72);
});

test('Phase 04 import compiles Markdown into canonical doc-v2 content before safe-create', async () => {
  const { transform, envelope } = await loadModules();
  const parsedScene = transform.parseMarkdownV1([
    '# Heading',
    '',
    '- One',
    '- Two',
    '',
    '\\# Literal heading marker',
    '',
  ].join('\r\n'));
  const converted = transform.markdownSceneV1ToDocument(parsedScene);
  const canonicalContent = envelope.composeObservablePayload({ doc: converted.doc });
  const reopened = envelope.parseObservablePayload(canonicalContent);

  assert.equal(reopened.version, 2);
  assert.equal(reopened.issue, null);
  assert.deepEqual(
    reopened.doc.content.map((block) => block.type),
    ['heading', 'bulletList', 'paragraph'],
  );
  assert.equal(reopened.doc.content[2].content[0].text, '# Literal heading marker');

  const mainSource = fs.readFileSync(path.join(ROOT, 'src', 'main.js'), 'utf8');
  assert.ok(mainSource.includes('const converted = transform.markdownSceneV1ToDocument(parsedScene);'));
  assert.ok(mainSource.includes('const canonicalContent = envelopeModule.composeObservablePayload({ doc: converted.doc });'));
  assert.ok(mainSource.includes('function buildMarkdownImportSafeCreatePlan(payload, canonicalContent)'));
  assert.ok(mainSource.includes('safeCreatePlan: buildMarkdownImportSafeCreatePlan(payload, canonicalContent),'));
});

test('Phase 04 export reader derives the artifact from the canonical saved scene on disk', async () => {
  const { transform, envelope } = await loadModules();
  const canonicalContent = envelope.composeObservablePayload({
    doc: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '# Literal', marks: [{ type: 'underline' }] }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Real heading' }],
        },
      ],
    },
  });
  const reads = [];
  const reader = loadCanonicalMarkdownReader({
    autoSaveInProgress: false,
    currentFilePath: '/project/roman/scene.txt',
    fs: {
      readFile: async (filePath, encoding) => {
        reads.push([filePath, encoding]);
        return canonicalContent;
      },
    },
    getDocumentContextFromPath: () => ({ kind: 'scene' }),
    isAllowedFilePath: () => true,
    isDirty: false,
    loadDocumentContentEnvelopeModule: async () => envelope,
    loadMarkdownTransformModule: async () => transform,
    path,
  });

  const result = await reader();

  assert.deepEqual(reads, [['/project/roman/scene.txt', 'utf8']]);
  assert.equal(result.defaultName, 'scene.md');
  assert.equal(result.artifact.markdown, '\\# Literal\n\n## Real heading\n');
  assert.deepEqual(
    result.artifact.lossReport.items.map((item) => item.code),
    ['MDV1_DOCUMENT_UNSUPPORTED_MARK_DOWNGRADED'],
  );
  assert.deepEqual(
    result.scene.blocks.map((block) => block.type),
    ['paragraph', 'heading'],
  );
});

test('Phase 04 export reader refuses dirty editor state before touching disk', async () => {
  const reader = loadCanonicalMarkdownReader({
    autoSaveInProgress: false,
    currentFilePath: '/project/roman/scene.txt',
    fs: {
      readFile: async () => {
        throw new Error('dirty export must not read disk');
      },
    },
    getDocumentContextFromPath: () => ({ kind: 'scene' }),
    isAllowedFilePath: () => true,
    isDirty: true,
    path,
  });

  await assert.rejects(reader, /Unsaved current scene state/u);
});

test('Phase 04 status and active docs state exact merged-delivery truth', () => {
  const status = JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
  const context = fs.readFileSync(path.join(ROOT, 'docs', 'CONTEXT.md'), 'utf8');
  const handoff = fs.readFileSync(path.join(ROOT, 'docs', 'HANDOFF.md'), 'utf8');
  const worklog = fs.readFileSync(path.join(ROOT, 'docs', 'WORKLOG.md'), 'utf8');

  assert.equal(status.taskId, 'REVIEW_BRIDGE_MARKDOWN_PRODUCT_COMPLETION_001');
  assert.equal(status.status, 'delivered_merged_verified');
  assert.equal(status.baseSha, 'a02bb8c10b38aeffe5fbb0f9601272fe2a00ffe2');
  assert.equal(status.scope.canonicalSavedSceneExport, true);
  assert.equal(status.scope.canonicalDocV2SafeCreate, true);
  assert.equal(status.scope.newDependenciesAdded, false);
  assert.equal(status.exportFlow.plainEditorTextReparse, false);
  assert.equal(status.lossPolicy.serializerReportIsAuthoritative, true);
  assert.equal(status.lossPolicy.warningDefaultAction, 'cancel');
  assert.equal(status.goldenCases.length, 10);
  assert.equal(status.delivery.status, 'delivered_merged_verified');
  assert.equal(status.delivery.commitSha, 'd73c4b943774e0735e7d32835eb82849d1806583');
  assert.equal(status.delivery.pullRequest, 1079);
  assert.equal(status.delivery.mergeSha, 'ff3ff47757e86c116f8f739804e3ffd2665535f0');
  assert.equal(status.delivery.mergedAtUtc, '2026-07-12T21:34:49Z');
  assert.ok(status.nonClaims.some((claim) => claim.includes('not full CommonMark or GFM')));

  for (const source of [context, handoff, worklog]) {
    assert.ok(source.includes('Phase 04 Markdown product completion'));
    assert.ok(source.includes('PR `1079`'));
    assert.ok(source.includes('ff3ff47757e86c116f8f739804e3ffd2665535f0'));
  }
  assert.equal(context.includes('Phase 04 Markdown product completion is implemented pending delivery'), false);
  assert.equal(handoff.includes('Phase 04 Markdown completion is implemented pending delivery'), false);
});
