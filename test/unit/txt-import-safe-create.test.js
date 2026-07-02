const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createTxtImportLocalFilePreview,
} = require('../../src/utils/txtImportLocalFilePreview');
const {
  TXT_IMPORT_SAFE_CREATE_RECEIPT_SCHEMA,
  TXT_IMPORT_SAFE_CREATE_READY_REASON,
  applyTxtImportSafeCreate,
} = require('../../src/utils/txtImportSafeCreate');

function makeProjectRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

async function buildPreviewEnvelope(text, sourceName = 'Imported.txt') {
  return createTxtImportLocalFilePreview(
    { requestId: `txt-safe-create-${Date.now()}` },
    {
      pickLocalFile: async () => ({
        path: path.join(os.tmpdir(), sourceName),
        size: Buffer.byteLength(text, 'utf8'),
      }),
      readLocalFileBytes: async () => Buffer.from(text, 'utf8'),
    },
  );
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

test('TXT import safe create: missing preview performs zero writes', async () => {
  const projectRoot = path.join(os.tmpdir(), `txt-import-safe-create-invalid-${Date.now()}`);
  const romanRoot = path.join(projectRoot, 'roman');

  const result = await applyTxtImportSafeCreate(
    { txtImportPreviewPlan: null },
    { projectRoot, romanRoot },
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'TXT_SAFE_CREATE_PREVIEW_REQUIRED');
  assert.equal(fs.existsSync(projectRoot), false);
});

test('TXT import safe create: admitted preview creates one imported scene and pathless receipt', async () => {
  const projectRoot = makeProjectRoot('txt-import-safe-create-ok-');
  const romanRoot = path.join(projectRoot, 'roman');
  const previewEnvelope = await buildPreviewEnvelope('Alpha\r\nBravo', 'Alpha Draft.txt');
  assert.equal(previewEnvelope.ok, true, JSON.stringify(previewEnvelope, null, 2));
  const plan = previewEnvelope.txtImportPreviewPlan;
  const entry = plan.candidateCreatePlan.entries[0];
  const expectedScenePath = path.join(romanRoot, 'Imported', `${entry.title} ${entry.contentTextHash}.txt`);

  const result = await applyTxtImportSafeCreate(
    { txtImportPreviewPlan: plan },
    {
      projectRoot,
      romanRoot,
      projectId: 'project-txt-safe-create',
    },
  );

  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(fs.readFileSync(expectedScenePath, 'utf8'), 'Alpha\nBravo');
  assert.equal(fs.existsSync(path.join(projectRoot, '.flow-batch')), true);
  assert.deepEqual(fs.readdirSync(path.join(projectRoot, '.flow-batch')), []);

  const receipt = result.value.receipt;
  assert.equal(receipt.schemaVersion, TXT_IMPORT_SAFE_CREATE_RECEIPT_SCHEMA);
  assert.equal(receipt.reason, TXT_IMPORT_SAFE_CREATE_READY_REASON);
  assert.equal(receipt.projectId, 'project-txt-safe-create');
  assert.equal(receipt.sourcePreviewHash, plan.previewHash);
  assert.deepEqual(receipt.createdSceneIds, [entry.sceneId]);
  assert.equal(receipt.createdScenes.length, 1);
  assert.equal(receipt.createdScenes[0].sceneId, entry.sceneId);
  assert.equal(receipt.createdScenes[0].bytesWritten, Buffer.byteLength('Alpha\nBravo', 'utf8'));
  assert.match(receipt.createdScenes[0].outputHash, /^[a-f0-9]{64}$/u);

  const receiptKeys = collectKeys(receipt);
  for (const forbidden of ['path', 'filePath', 'projectRoot', 'rawBytes', 'bufferSource', 'importReceipt', 'exportReceipt']) {
    assert.equal(receiptKeys.some((key) => key === forbidden || key.endsWith(`.${forbidden}`)), false, forbidden);
  }
});

test('TXT import safe create: unadmitted preview is rejected before writes', async () => {
  const projectRoot = makeProjectRoot('txt-import-safe-create-unadmitted-');
  const romanRoot = path.join(projectRoot, 'roman');
  const previewEnvelope = await buildPreviewEnvelope(`Unadmitted ${Date.now()}`, 'Unadmitted.txt');
  assert.equal(previewEnvelope.ok, true, JSON.stringify(previewEnvelope, null, 2));

  const previewPlan = JSON.parse(JSON.stringify(previewEnvelope.txtImportPreviewPlan));
  previewPlan.previewHash = '0000000000';

  const result = await applyTxtImportSafeCreate(
    { txtImportPreviewPlan: previewPlan },
    { projectRoot, romanRoot },
  );

  assert.equal(result.ok, false);
  assert.equal(
    ['TXT_SAFE_CREATE_PREVIEW_TAMPERED', 'TXT_SAFE_CREATE_PREVIEW_NOT_ADMITTED'].includes(result.error.code),
    true,
  );
});

test('TXT import safe create: second apply blocks existing target without mutation', async () => {
  const projectRoot = makeProjectRoot('txt-import-safe-create-reapply-');
  const romanRoot = path.join(projectRoot, 'roman');
  const previewEnvelope = await buildPreviewEnvelope('First', 'First.txt');
  assert.equal(previewEnvelope.ok, true, JSON.stringify(previewEnvelope, null, 2));
  const plan = previewEnvelope.txtImportPreviewPlan;
  const scenePath = path.join(
    romanRoot,
    'Imported',
    `${plan.candidateCreatePlan.entries[0].title} ${plan.candidateCreatePlan.entries[0].contentTextHash}.txt`,
  );

  const first = await applyTxtImportSafeCreate({ txtImportPreviewPlan: plan }, { projectRoot, romanRoot });
  assert.equal(first.ok, true);
  assert.equal(fs.readFileSync(scenePath, 'utf8'), 'First');

  const second = await applyTxtImportSafeCreate({ txtImportPreviewPlan: plan }, { projectRoot, romanRoot });
  assert.equal(second.ok, false);
  assert.equal(second.error.code, 'TXT_SAFE_CREATE_EXISTING_SCENE_BLOCKED');
  assert.equal(fs.readFileSync(scenePath, 'utf8'), 'First');
});
