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
