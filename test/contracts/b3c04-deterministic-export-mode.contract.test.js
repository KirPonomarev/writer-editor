const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const { buildStoredZip } = require('../../src/export/docx/docxMinBuilder.js');
const {
  DECLARED_VOLATILE_DOCX_FIELDS,
  normalizedDocxDeterministicHash,
} = require('../../src/export/docx/deterministic-export-hash.js');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b3c04-deterministic-export-mode-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B3C04_DETERMINISTIC_EXPORT_MODE_STATUS_V1.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) modulePromise = import(pathToFileURL(MODULE_PATH).href);
  return modulePromise;
}

function readJson(targetPath) {
  return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
}

function docxBuffer(documentText, core = {}) {
  const documentXml = `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${documentText}</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`;
  const coreXml = `<?xml version="1.0"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" pkg:id="${core.packageId || 'a'}"><dc:creator>${core.creator || 'a'}</dc:creator><cp:lastModifiedBy>${core.modifiedBy || 'a'}</cp:lastModifiedBy><dcterms:created>${core.createdAt || '2026-04-28T00:00:00.000Z'}</dcterms:created><dcterms:modified>${core.modifiedAt || '2026-04-28T00:00:00.000Z'}</dcterms:modified></cp:coreProperties>`;
  return buildStoredZip([
    { name: '[Content_Types].xml', data: '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>' },
    { name: '_rels/.rels', data: '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>' },
    { name: 'docProps/core.xml', data: coreXml },
    { name: 'word/document.xml', data: documentXml },
  ]);
}

test('b3c04 deterministic export mode: state artifact equals executable state', async () => {
  const { evaluateB3C04DeterministicExportModeState, TOKEN_NAME } = await loadModule();
  const state = await evaluateB3C04DeterministicExportModeState({ repoRoot: REPO_ROOT });
  const committedState = readJson(STATUS_PATH);

  assert.deepEqual(committedState, state);
  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.status, 'PASS');
  assert.equal(state[TOKEN_NAME], 1);
  assert.deepEqual(state.failRows, []);
  assert.equal(state.repo.repoRootBinding, 'WORKTREE_INDEPENDENT');
  assert.equal(state.runtime.commandResults.status, 'DECLARED_FOR_EXTERNAL_RUNNER');
  assert.equal(state.runtime.commandResults.selfExecuted, false);
  assert.equal(state.runtime.commandResults.allPassed, null);
});

test('b3c04 deterministic export mode: CLI status remains worktree independent outside repo cwd', () => {
  const result = spawnSync(process.execPath, [MODULE_PATH, '--json'], {
    cwd: os.tmpdir(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);

  const state = JSON.parse(result.stdout);
  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.B3C04_DETERMINISTIC_EXPORT_MODE_OK, 1);
  assert.deepEqual(state.failRows, []);
  assert.equal(state.repo.repoRootBinding, 'WORKTREE_INDEPENDENT');
});

test('b3c04 deterministic export mode: volatile DOCX metadata does not change normalized hash', () => {
  const first = normalizedDocxDeterministicHash(docxBuffer('Stable canonical text', {
    packageId: 'package-a',
    creator: 'author-a',
    modifiedBy: 'modifier-a',
    createdAt: '2026-04-28T00:00:00.000Z',
    modifiedAt: '2026-04-29T00:00:00.000Z',
  }));
  const second = normalizedDocxDeterministicHash(docxBuffer('Stable canonical text', {
    packageId: 'package-b',
    creator: 'author-b',
    modifiedBy: 'modifier-b',
    createdAt: '2027-04-28T00:00:00.000Z',
    modifiedAt: '2027-04-29T00:00:00.000Z',
  }));

  assert.equal(first.ok, true, JSON.stringify(first.issues));
  assert.equal(second.ok, true, JSON.stringify(second.issues));
  assert.equal(first.normalizedHash, second.normalizedHash);
});

test('b3c04 deterministic export mode: canonical text changes normalized hash', () => {
  const first = normalizedDocxDeterministicHash(docxBuffer('Stable canonical text'));
  const second = normalizedDocxDeterministicHash(docxBuffer('Changed canonical text'));

  assert.notEqual(first.normalizedHash, second.normalizedHash);
});

test('b3c04 deterministic export mode: scope flags reject release gate and style layout claims', async () => {
  const { evaluateB3C04DeterministicExportModeState } = await loadModule();
  const state = await evaluateB3C04DeterministicExportModeState({ repoRoot: REPO_ROOT });

  assert.equal(state.scope.helperRole, 'PROOF_HELPER_NOT_RELEASE_GATE');
  assert.equal(state.scope.docxExporterRewritten, false);
  assert.equal(state.scope.fullDocxNormalizerFramework, false);
  assert.equal(state.scope.releaseClaim, false);
  assert.equal(state.scope.releaseGatePromotion, false);
  assert.equal(state.scope.styleFidelityClaim, false);
  assert.equal(state.scope.layoutFidelityClaim, false);
  assert.deepEqual(state.runtime.hashArtifact.declaredVolatileFields, [...DECLARED_VOLATILE_DOCX_FIELDS]);
});
