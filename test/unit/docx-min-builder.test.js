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
