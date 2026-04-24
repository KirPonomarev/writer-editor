const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

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
