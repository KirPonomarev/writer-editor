const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const {
  DOCX_IMPORT_SAFE_CREATE_RECEIPT_SCHEMA,
  DOCX_IMPORT_SAFE_CREATE_READY_REASON,
  applyDocxImportSafeCreate,
  rememberDocxImportPreviewPlanAdmission,
  validateDocxImportPreviewPlan,
} = require('../../src/utils/docxImportSafeCreate');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BRIDGE_MODULE_PATH = path.join(REPO_ROOT, 'src', 'io', 'revisionBridge', 'index.mjs');

async function loadBridge() {
  return import(pathToFileURL(BRIDGE_MODULE_PATH).href);
}

function stableHash(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function docxCanonicalJson(value) {
  if (value === null) return 'null';
  const valueType = typeof value;
  if (valueType === 'string') return JSON.stringify(value);
  if (valueType === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  if (valueType === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return `[${value.map((item) => docxCanonicalJson(item)).join(',')}]`;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${docxCanonicalJson(value[key])}`
    )).join(',')}}`;
  }
  return 'null';
}

function rehashPreviewPlan(plan) {
  const body = clone(plan);
  delete body.previewHash;
  plan.previewHash = stableHash(docxCanonicalJson(body));
  return plan;
}

function normalizeText(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function paragraph(order, rawText) {
  const text = normalizeText(rawText);
  return {
    order,
    sourcePart: 'word/document.xml',
    text,
    textHash: stableHash(text),
    charCount: text.length,
  };
}

function contentPreviewReport(paragraphTexts) {
  const paragraphs = paragraphTexts.map((text, index) => paragraph(index, text));
  const joinedText = paragraphs.map((item) => item.text).join('\n');
  return {
    ok: true,
    schemaVersion: 'revision-bridge.docx-content-preview.v1',
    type: 'docxContentPreviewReport',
    status: 'preview',
    code: 'DOCX_CONTENT_PREVIEW_READY',
    reason: 'DOCX_CONTENT_PREVIEW_READY',
    decision: 'preview',
    diagnostics: [],
    evidence: [
      {
        kind: 'contentPreview',
        paragraphCount: paragraphs.length,
        textLength: joinedText.length,
        textHash: stableHash(joinedText),
      },
    ],
    budgets: {
      maxParagraphs: 5000,
      maxTextChars: 1000000,
      maxDiagnostics: 200,
    },
    preflightSummary: {
      status: 'accepted',
      decision: 'accept',
      code: 'DOCX_INTAKE_PREFLIGHT_ACCEPTED',
      gatePass: true,
      parserCandidateOnly: true,
    },
    contentPreview: {
      sourcePart: 'word/document.xml',
      paragraphCount: paragraphs.length,
      textLength: joinedText.length,
      textHash: stableHash(joinedText),
      paragraphs,
    },
    parse: {
      attempted: true,
      completed: true,
    },
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function buildPreviewPlan(paragraphTexts = ['Alpha', 'Bravo']) {
  const bridge = await loadBridge();
  return bridge.buildDocxImportPreviewPlanFromContentPreview(contentPreviewReport(paragraphTexts));
}

function admitPreviewPlan(plan) {
  const admissionHash = rememberDocxImportPreviewPlanAdmission(plan);
  assert.match(admissionHash, /^[a-f0-9]{64}$/u);
  return plan;
}

function makeProjectRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function expectedScenePath(romanRoot, plan) {
  const entry = plan.candidateCreatePlan.entries[0];
  return path.join(romanRoot, 'Imported', `${entry.title} ${entry.contentTextHash}.txt`);
}

function collectKeys(value, pathParts = []) {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectKeys(item, pathParts.concat(String(index))));
  }
  if (!value || typeof value !== 'object') return [];
  return Object.keys(value).flatMap((key) => (
    [pathParts.concat(key).join('.')].concat(collectKeys(value[key], pathParts.concat(key)))
  ));
}

test('DOCX import safe create: missing or malformed preview performs zero writes', async () => {
  const projectRoot = path.join(os.tmpdir(), `docx-import-safe-create-invalid-${Date.now()}`);
  const romanRoot = path.join(projectRoot, 'roman');
  const missing = await applyDocxImportSafeCreate(
    { docxImportPreviewPlan: null },
    { projectRoot, romanRoot },
  );

  assert.equal(missing.ok, false);
  assert.equal(missing.error.code, 'DOCX_SAFE_CREATE_PREVIEW_REQUIRED');
  assert.equal(fs.existsSync(projectRoot), false);

  const malformed = await applyDocxImportSafeCreate(
    { docxImportPreviewPlan: { schemaVersion: 'revision-bridge.docx-import-preview.v1' } },
    { projectRoot, romanRoot },
  );
  assert.equal(malformed.ok, false);
  assert.equal(malformed.error.code, 'DOCX_SAFE_CREATE_PREVIEW_INVALID');
  assert.equal(fs.existsSync(projectRoot), false);
});

test('DOCX import safe create: valid preview creates one new scene and returns pathless receipt', async () => {
  const projectRoot = makeProjectRoot('docx-import-safe-create-ok-');
  const romanRoot = path.join(projectRoot, 'roman');
  const plan = admitPreviewPlan(await buildPreviewPlan(['Alpha', 'Bravo']));
  const scenePath = expectedScenePath(romanRoot, plan);

  const result = await applyDocxImportSafeCreate(
    { docxImportPreviewPlan: plan },
    {
      projectRoot,
      romanRoot,
      projectId: 'project-docx-safe-create',
    },
  );

  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(fs.readFileSync(scenePath, 'utf8'), 'Alpha\n\nBravo');
  assert.equal(fs.existsSync(path.join(projectRoot, '.flow-batch')), true);
  assert.deepEqual(fs.readdirSync(path.join(projectRoot, '.flow-batch')), []);

  const receipt = result.value.receipt;
  assert.equal(receipt.schemaVersion, DOCX_IMPORT_SAFE_CREATE_RECEIPT_SCHEMA);
  assert.equal(receipt.reason, DOCX_IMPORT_SAFE_CREATE_READY_REASON);
  assert.equal(receipt.projectId, 'project-docx-safe-create');
  assert.equal(receipt.sourcePreviewHash, plan.previewHash);
  assert.match(receipt.inputHash, /^[a-f0-9]{64}$/u);
  assert.match(receipt.outputHash, /^[a-f0-9]{64}$/u);
  assert.deepEqual(receipt.createdSceneIds, [plan.candidateCreatePlan.entries[0].sceneId]);
  assert.equal(receipt.createdScenes.length, 1);
  assert.equal(receipt.createdScenes[0].bytesWritten, Buffer.byteLength('Alpha\n\nBravo', 'utf8'));
  assert.match(receipt.createdScenes[0].outputHash, /^[a-f0-9]{64}$/u);
  assert.equal(receipt.lossReportSummary.itemCount, plan.lossReport.itemCount);

  const receiptKeys = collectKeys(receipt);
  for (const forbidden of ['path', 'filePath', 'projectRoot', 'rawBytes', 'bufferSource', 'importReceipt', 'exportReceipt']) {
    assert.equal(receiptKeys.some((key) => key === forbidden || key.endsWith(`.${forbidden}`)), false, forbidden);
  }
});

test('DOCX import safe create: reapply and existing target are blocked without mutation', async () => {
  const projectRoot = makeProjectRoot('docx-import-safe-create-reapply-');
  const romanRoot = path.join(projectRoot, 'roman');
  const plan = admitPreviewPlan(await buildPreviewPlan(['First']));
  const scenePath = expectedScenePath(romanRoot, plan);

  const first = await applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, { projectRoot, romanRoot });
  assert.equal(first.ok, true);
  assert.equal(fs.readFileSync(scenePath, 'utf8'), 'First');

  const second = await applyDocxImportSafeCreate({ docxImportPreviewPlan: plan }, { projectRoot, romanRoot });
  assert.equal(second.ok, false);
  assert.equal(second.error.code, 'DOCX_SAFE_CREATE_EXISTING_SCENE_BLOCKED');
  assert.equal(fs.readFileSync(scenePath, 'utf8'), 'First');
});

test('DOCX import safe create: self-consistent but unadmitted preview is rejected before writes', async () => {
  const projectRoot = makeProjectRoot('docx-import-safe-create-unadmitted-');
  const romanRoot = path.join(projectRoot, 'roman');
  const plan = await buildPreviewPlan([`Unadmitted ${Date.now()} ${Math.random()}`]);

  const result = await applyDocxImportSafeCreate(
    { docxImportPreviewPlan: plan },
    { projectRoot, romanRoot },
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'DOCX_SAFE_CREATE_PREVIEW_NOT_ADMITTED');
  assert.equal(fs.existsSync(expectedScenePath(romanRoot, plan)), false);
});

test('DOCX import safe create: symlinked roman root cannot escape project authority', async (t) => {
  if (process.platform === 'win32') {
    t.skip('directory symlink authority check is covered on POSIX runners');
    return;
  }

  const projectRoot = makeProjectRoot('docx-import-safe-create-symlink-project-');
  const externalRoot = makeProjectRoot('docx-import-safe-create-symlink-outside-');
  const romanRoot = path.join(projectRoot, 'roman');
  fs.symlinkSync(externalRoot, romanRoot, 'dir');
  const plan = admitPreviewPlan(await buildPreviewPlan(['No escape']));
  const externalScenePath = expectedScenePath(externalRoot, plan);

  const result = await applyDocxImportSafeCreate(
    { docxImportPreviewPlan: plan },
    { projectRoot, romanRoot },
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'DOCX_SAFE_CREATE_ROOT_INVALID');
  assert.equal(fs.existsSync(externalScenePath), false);
});

test('DOCX import safe create: stale marker failure keeps public error details pathless', async () => {
  const projectRoot = makeProjectRoot('docx-import-safe-create-stale-');
  const romanRoot = path.join(projectRoot, 'roman');
  const markerRoot = path.join(projectRoot, '.flow-batch');
  fs.mkdirSync(markerRoot, { recursive: true });
  fs.writeFileSync(path.join(markerRoot, 'stale.json'), '{}', 'utf8');
  const plan = admitPreviewPlan(await buildPreviewPlan(['Stale marker']));

  const result = await applyDocxImportSafeCreate(
    { docxImportPreviewPlan: plan },
    { projectRoot, romanRoot },
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'M7_FLOW_BATCH_STALE');
  assert.equal(result.error.reason, 'flow_save_batch_stale');
  assert.equal(result.error.details.staleMarkerCount, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(result.error.details, 'staleMarkers'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.error.details, 'markerPath'), false);
  assert.equal(fs.existsSync(expectedScenePath(romanRoot, plan)), false);
});

test('DOCX import safe create: tampered hashes and forged candidate shapes fail closed', async () => {
  const clean = await buildPreviewPlan(['Alpha', 'Bravo']);
  const cases = [
    {
      name: 'previewHash',
      mutate: (plan) => {
        plan.previewHash = '00000000';
      },
      code: 'DOCX_SAFE_CREATE_PREVIEW_TAMPERED',
    },
    {
      name: 'contentTextHash',
      mutate: (plan) => {
        plan.candidateCreatePlan.entries[0].contentTextHash = '00000000';
      },
      code: 'DOCX_SAFE_CREATE_PREVIEW_TAMPERED',
    },
    {
      name: 'wrong mode',
      mutate: (plan) => {
        plan.candidateCreatePlan.mode = 'mutate-existing';
        rehashPreviewPlan(plan);
      },
      code: 'DOCX_SAFE_CREATE_PREVIEW_INVALID',
    },
    {
      name: 'multi entry',
      mutate: (plan) => {
        plan.candidateCreatePlan.entryCount = 2;
        plan.candidateCreatePlan.entries.push(clone(plan.candidateCreatePlan.entries[0]));
        rehashPreviewPlan(plan);
      },
      code: 'DOCX_SAFE_CREATE_PREVIEW_INVALID',
    },
    {
      name: 'source mismatch',
      mutate: (plan) => {
        plan.candidateCreatePlan.entries[0].source.textHash = '11111111';
        rehashPreviewPlan(plan);
      },
      code: 'DOCX_SAFE_CREATE_PREVIEW_TAMPERED',
    },
    {
      name: 'scene id mismatch',
      mutate: (plan) => {
        plan.candidateCreatePlan.entries[0].sceneId = 'docx-import-scene-deadbeef';
        rehashPreviewPlan(plan);
      },
      code: 'DOCX_SAFE_CREATE_PREVIEW_TAMPERED',
    },
    {
      name: 'source count type',
      mutate: (plan) => {
        plan.source.paragraphCount = '2';
        plan.candidateCreatePlan.entries[0].source.paragraphCount = '2';
        rehashPreviewPlan(plan);
      },
      code: 'DOCX_SAFE_CREATE_PREVIEW_INVALID',
    },
    {
      name: 'forbidden path',
      mutate: (plan) => {
        plan.candidateCreatePlan.entries[0].path = '/tmp/forbidden.txt';
      },
      code: 'DOCX_SAFE_CREATE_PREVIEW_FORBIDDEN_FIELD',
    },
  ];

  for (const item of cases) {
    const plan = clone(clean);
    item.mutate(plan);
    const validation = validateDocxImportPreviewPlan(plan);
    assert.equal(validation.ok, false, item.name);
    assert.equal(validation.error.code, item.code, item.name);
  }
});

test('DOCX import safe create: trusted write failure is rewrapped and does not claim creation', async () => {
  const projectRoot = makeProjectRoot('docx-import-safe-create-write-fail-');
  const romanRoot = path.join(projectRoot, 'roman');
  const plan = admitPreviewPlan(await buildPreviewPlan(['Alpha']));

  const result = await applyDocxImportSafeCreate(
    { docxImportPreviewPlan: plan },
    {
      projectRoot,
      romanRoot,
      writeBatchAtomic: async () => ({
        ok: false,
        error: {
          code: 'M7_FLOW_BATCH_WRITE_FAIL',
          reason: 'flow_save_batch_write_failed',
          details: {
            markerPath: path.join(projectRoot, '.flow-batch', 'secret.json'),
            staleMarkers: [path.join(projectRoot, '.flow-batch', 'stale.json')],
            batchId: 'flow-batch-redacted',
          },
        },
      }),
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'M7_FLOW_BATCH_WRITE_FAIL');
  assert.equal(result.error.reason, 'flow_save_batch_write_failed');
  assert.equal(result.error.details.batchId, 'flow-batch-redacted');
  assert.equal(result.error.details.staleMarkerCount, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(result.error.details, 'markerPath'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.error.details, 'staleMarkers'), false);
  assert.equal(fs.existsSync(expectedScenePath(romanRoot, plan)), false);
});

test('DOCX import safe create: thrown write error messageCode cannot carry an absolute path', async () => {
  const projectRoot = makeProjectRoot('docx-import-safe-create-throw-path-');
  const romanRoot = path.join(projectRoot, 'roman');
  const plan = admitPreviewPlan(await buildPreviewPlan(['Throw path']));
  const leakedPath = path.join(projectRoot, '.flow-batch', 'marker.json');

  const result = await applyDocxImportSafeCreate(
    { docxImportPreviewPlan: plan },
    {
      projectRoot,
      romanRoot,
      writeBatchAtomic: async () => {
        throw new Error(`FLOW_BATCH_FAILED ${leakedPath}`);
      },
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'DOCX_SAFE_CREATE_WRITE_FAIL');
  assert.equal(result.error.details.messageCode, 'WRITE_EXCEPTION');
  assert.equal(JSON.stringify(result.error.details).includes(leakedPath), false);
  assert.equal(fs.existsSync(expectedScenePath(romanRoot, plan)), false);
});
