const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const { buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
const { compileProjectToIR } = require('../../src/export/compile-ir.js');
const {
  extractParagraphs,
  validateDocxArtifactForCompileIR,
} = require('../../src/export/docx/docxArtifactValidator.js');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b3c03-docx-artifact-validation-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B3C03_DOCX_ARTIFACT_VALIDATION_STATUS_V1.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) modulePromise = import(pathToFileURL(MODULE_PATH).href);
  return modulePromise;
}

function readJson(targetPath) {
  return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
}

function projectFixture() {
  return {
    manifest: {
      schemaVersion: 1,
      formatVersion: 'longform-project-v1',
      projectId: 'b3c03-contract-project',
      title: 'B3C03 Contract',
      sceneOrder: ['a', 'b'],
      scenes: {
        a: { id: 'a', title: 'A', file: 'a.json', hash: 'hash-a', deleted: false },
        b: { id: 'b', title: 'B', file: 'b.json', hash: 'hash-b', deleted: false },
      },
      bookProfile: { page: 'a4', locale: 'en-US' },
      styleMap: {},
      compileProfile: { format: 'docx', includeSceneTitles: true },
      manifestHash: 'manifest-b3c03-contract',
    },
    scenes: {
      a: {
        id: 'a',
        title: 'Alpha Scene',
        status: 'draft',
        synopsis: '',
        exportIntent: 'include',
        blocks: [
          {
            id: 'a1',
            type: 'paragraph',
            text: 'Alpha marked text',
            inlineRanges: [{ id: 'r1', kind: 'italic', from: 6, to: 12, offsetUnit: 'codeUnit', attrs: {} }],
            attrs: {},
          },
        ],
      },
      b: {
        id: 'b',
        title: 'Beta Scene',
        status: 'draft',
        synopsis: '',
        exportIntent: 'include',
        blocks: [
          {
            id: 'b1',
            type: 'heading',
            text: 'Beta Heading',
            inlineRanges: [],
            attrs: { level: 2 },
          },
        ],
      },
    },
  };
}

function xmlEscape(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function runXml(text, mark = '') {
  const rPr = mark === 'italic' ? '<w:rPr><w:i/></w:rPr>' : '';
  return `<w:r>${rPr}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

function docxFixture(ir, options = {}) {
  const paragraphs = [];
  for (const scene of ir.scenes) {
    paragraphs.push(`<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>${runXml(scene.title)}</w:p>`);
    for (const block of scene.blocks) {
      if (block.inlineRanges.length > 0 && options.omitInlineMark !== true) {
        const range = block.inlineRanges[0];
        paragraphs.push(`<w:p>${runXml(block.text.slice(0, range.from))}${runXml(block.text.slice(range.from, range.to), range.kind)}${runXml(block.text.slice(range.to))}</w:p>`);
      } else {
        paragraphs.push(`<w:p>${runXml(block.text)}</w:p>`);
      }
    }
  }
  if (options.reverse) paragraphs.reverse();
  if (options.empty) paragraphs.length = 0;
  const documentXml = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs.join('')}<w:sectPr/></w:body></w:document>`;
  return buildStoredZip([
    { name: '[Content_Types].xml', data: '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: '_rels/.rels', data: '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/document.xml', data: documentXml },
  ]);
}

test('b3c03 docx artifact validation: state artifact equals executable state', async () => {
  const { evaluateB3C03DocxArtifactValidationState, TOKEN_NAME } = await loadModule();
  const state = await evaluateB3C03DocxArtifactValidationState({ repoRoot: REPO_ROOT });
  const committedState = readJson(STATUS_PATH);

  assert.deepEqual(committedState, state);
  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.status, 'PASS');
  assert.equal(state[TOKEN_NAME], 1);
  assert.deepEqual(state.failRows, []);
  assert.equal(state.repo.repoRootBinding, 'WORKTREE_INDEPENDENT');
});

test('b3c03 docx artifact validation: accepts package, content, order, heading text, and minimal inline mark', async () => {
  const ir = compileProjectToIR(projectFixture());
  const result = await validateDocxArtifactForCompileIR(docxFixture(ir), ir);

  assert.equal(result.ok, true, JSON.stringify(result.issues));
  assert.deepEqual(result.artifact.entryNames, ['[Content_Types].xml', '_rels/.rels', 'word/document.xml']);
  assert.equal(result.artifact.paragraphCount, 4);
  assert.equal(result.artifact.noStyleFidelityClaim, true);
  assert.equal(result.artifact.noLayoutFidelityClaim, true);
  assert.equal(result.artifact.extractedTextPreview.includes('Alpha Scene'), true);
  assert.equal(result.artifact.extractedTextPreview.includes('Beta Heading'), true);
});

test('b3c03 docx artifact validation: rejects file-only, corrupt, empty, order mismatch, and missing inline marks', async () => {
  const ir = compileProjectToIR(projectFixture());
  const fileOnly = await validateDocxArtifactForCompileIR(Buffer.from('not a docx'), ir);
  const corrupt = await validateDocxArtifactForCompileIR(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x01]), ir);
  const empty = await validateDocxArtifactForCompileIR(docxFixture(ir, { empty: true }), ir);
  const reversed = await validateDocxArtifactForCompileIR(docxFixture(ir, { reverse: true }), ir);
  const missingMark = await validateDocxArtifactForCompileIR(docxFixture(ir, { omitInlineMark: true }), ir);

  assert.equal(fileOnly.ok, false);
  assert.equal(fileOnly.issues.some((row) => row.code === 'E_DOCX_REQUIRED_ENTRY_MISSING'), true);
  assert.equal(corrupt.ok, false);
  assert.equal(empty.issues.some((row) => row.code === 'E_DOCX_TEXT_EMPTY'), true);
  assert.equal(reversed.issues.some((row) => row.code === 'E_DOCX_SCENE_ORDER_MISMATCH' || row.code === 'E_DOCX_BLOCK_ORDER_MISMATCH'), true);
  assert.equal(missingMark.issues.some((row) => row.code === 'E_DOCX_INLINE_MARK_MISSING'), true);
});

test('b3c03 docx artifact validation: paragraph extractor is content-only and avoids layout claims', () => {
  const paragraphs = extractParagraphs('<w:p><w:r><w:t>Alpha</w:t></w:r></w:p>');

  assert.deepEqual(paragraphs, [{ style: '', text: 'Alpha', runs: [{ text: 'Alpha', bold: false, italic: false, underline: false }] }]);
});

test('b3c03 docx artifact validation: scope remains B3C03 only', async () => {
  const { evaluateB3C03DocxArtifactValidationState } = await loadModule();
  const state = await evaluateB3C03DocxArtifactValidationState({ repoRoot: REPO_ROOT });

  assert.equal(state.scope.compileIRRemainsDerivedInput, true);
  assert.equal(state.scope.docxExporterRewritten, false);
  assert.equal(state.scope.docxDependencyChanged, false);
  assert.equal(state.scope.storageFormatChanged, false);
  assert.equal(state.scope.uiTouched, false);
  assert.equal(state.scope.releaseDossierStarted, false);
  assert.equal(state.scope.releaseClaim, false);
  assert.equal(state.scope.deterministicExportModeStarted, false);
  assert.equal(state.scope.styleFidelityClaim, false);
  assert.equal(state.scope.layoutFidelityClaim, false);
});
