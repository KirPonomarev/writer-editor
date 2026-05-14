const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const { runDocxMinExport } = require('../../src/export/docx/docxMinExportHandler.js');
const { buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
const { normalizedDocxDeterministicHash } = require('../../src/export/docx/deterministic-export-hash.js');

const HANDLER_PATH = 'src/export/docx/docxMinExportHandler.js';
const UNIT_TEST_PATH = 'test/unit/docx-min-export-handler.test.js';
const CONTRACT_TEST_PATH = 'test/contracts/export-contour-01-docx-simple-hardening.contract.test.js';
const ALLOWLIST = [
  HANDLER_PATH,
  UNIT_TEST_PATH,
  CONTRACT_TEST_PATH,
];

function makeTypedExportError(code, reason, details = {}) {
  return {
    ok: 0,
    error: {
      code,
      reason,
      details,
    },
  };
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeXml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function buildDeterministicDocxBuffer(text) {
  const contentTypes = '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
  const rootRels = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  const documentXml = `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`;
  return buildStoredZip([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rootRels },
    { name: 'word/document.xml', data: documentXml },
  ]);
}

function changedFilesFromGitStatus(statusText) {
  return statusText
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => line.slice(3).replace(/^"|"$/gu, ''))
    .map((filePath) => {
      const renameSeparator = ' -> ';
      return filePath.includes(renameSeparator)
        ? filePath.split(renameSeparator)[1]
        : filePath;
    });
}

test('EXPORT_CONTOUR_01_DOCX_SIMPLE_EXPORT_HARDENING reproducible structural class and payload immutability', async () => {
  const payload = {
    requestId: 'export-contour-01',
    outPath: '/tmp/export-contour-01.docx',
    outDir: '',
    bufferSource: 'stale text that must not be exported',
    options: {
      bookProfile: { formatId: 'A5' },
    },
  };
  const canonicalSnapshot = {
    content: 'Stable canonical export contour payload',
    plainText: 'Stable canonical export contour payload',
    bookProfile: { formatId: 'A5' },
  };
  const before = deepClone(payload);
  const writes = [];

  const dependencies = {
    normalizeExportPayload(input) {
      return input;
    },
    makeTypedExportError,
    resolveDocxExportPath(input) {
      return input.outPath;
    },
    async readCanonicalExportSnapshot() {
      return canonicalSnapshot;
    },
    async buildDocxMinBuffer(snapshot) {
      return buildDeterministicDocxBuffer(snapshot.plainText || snapshot.content || '');
    },
    async queueDiskOperation(operation, label) {
      assert.equal(label, 'export docx min');
      return operation();
    },
    async writeBufferAtomic(outPath, buffer) {
      writes.push({
        outPath,
        buffer: Buffer.from(buffer),
      });
    },
    updateStatus() {},
  };

  const first = await runDocxMinExport(payload, dependencies);
  assert.equal(first.ok, 1, JSON.stringify(first, null, 2));
  assert.deepEqual(payload, before);

  const second = await runDocxMinExport(payload, dependencies);
  assert.equal(second.ok, 1, JSON.stringify(second, null, 2));
  assert.deepEqual(payload, before);

  assert.equal(writes.length, 2);
  assert.equal(writes[0].outPath, payload.outPath);
  assert.equal(writes[1].outPath, payload.outPath);

  const firstHash = normalizedDocxDeterministicHash(writes[0].buffer);
  const secondHash = normalizedDocxDeterministicHash(writes[1].buffer);
  assert.equal(firstHash.ok, true, JSON.stringify(firstHash.issues));
  assert.equal(secondHash.ok, true, JSON.stringify(secondHash.issues));
  assert.equal(firstHash.normalizedHash, secondHash.normalizedHash);
});

test('EXPORT_CONTOUR_01_DOCX_SIMPLE_EXPORT_HARDENING scope allowlist and dependency manifests unchanged', () => {
  const statusText = execFileSync('git', ['status', '--porcelain', '-uall'], { encoding: 'utf8' });
  const changedFiles = changedFilesFromGitStatus(statusText);
  const outsideAllowlist = changedFiles.filter((filePath) => !ALLOWLIST.includes(filePath));
  const packageManifestDiff = changedFiles.filter((filePath) => (
    filePath === 'package.json'
    || filePath === 'package-lock.json'
    || filePath === 'npm-shrinkwrap.json'
  ));

  assert.deepEqual(outsideAllowlist, []);
  assert.deepEqual(packageManifestDiff, []);
});
