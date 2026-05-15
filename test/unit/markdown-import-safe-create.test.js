const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  MARKDOWN_IMPORT_SAFE_CREATE_RECEIPT_SCHEMA,
  MARKDOWN_IMPORT_SAFE_CREATE_READY_REASON,
  applyMarkdownImportSafeCreate,
} = require('../../src/utils/markdownImportSafeCreate');

function makeProjectRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function previewPayload(entries) {
  return {
    schemaVersion: 'markdown-import-preview.v1',
    type: 'markdown.import.preview',
    status: 'preview',
    writeEffects: false,
    safeCreatePlan: {
      mode: 'create-only',
      entries,
    },
  };
}

function readText(targetPath) {
  return fs.readFileSync(targetPath, 'utf8');
}

test('markdown import safe create: invalid or missing preview payload performs zero writes', async () => {
  const missingRoot = path.join(os.tmpdir(), `markdown-import-safe-create-missing-${Date.now()}`);
  const missing = await applyMarkdownImportSafeCreate(
    { previewPayload: null },
    { projectRoot: missingRoot, reservedTopLevelRomanNames: [] },
  );
  assert.equal(missing.ok, false);
  assert.equal(missing.error.code, 'MDV1_SAFE_CREATE_PREVIEW_REQUIRED');
  assert.equal(fs.existsSync(missingRoot), false);

  const invalidRoot = path.join(os.tmpdir(), `markdown-import-safe-create-invalid-${Date.now()}`);
  const invalid = await applyMarkdownImportSafeCreate(
    {
      previewPayload: {
        schemaVersion: 'markdown-import-preview.v1',
        type: 'markdown.import.preview',
        status: 'preview',
        writeEffects: false,
      },
    },
    { projectRoot: invalidRoot, reservedTopLevelRomanNames: [] },
  );
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error.code, 'MDV1_SAFE_CREATE_PREVIEW_INVALID');
  assert.equal(fs.existsSync(invalidRoot), false);
});

test('markdown import safe create: attempt to modify existing scene is blocked', async () => {
  const projectRoot = makeProjectRoot('markdown-import-safe-create-blocked-');
  const existingScenePath = path.join(projectRoot, 'roman', '01_Existing scene.txt');
  fs.mkdirSync(path.dirname(existingScenePath), { recursive: true });
  fs.writeFileSync(existingScenePath, 'before\n', 'utf8');

  const result = await applyMarkdownImportSafeCreate(
    {
      previewPayload: previewPayload([
        {
          sceneId: 'scene-existing',
          path: existingScenePath,
          content: 'after\n',
        },
      ]),
    },
    {
      projectRoot,
      reservedTopLevelRomanNames: ['oblozhka', 'chernovik'],
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'MDV1_SAFE_CREATE_EXISTING_SCENE_BLOCKED');
  assert.equal(readText(existingScenePath), 'before\n');
  assert.equal(fs.existsSync(path.join(projectRoot, '.flow-batch')), false);
});

test('markdown import safe create: valid preview creates only new scenes and returns truthful receipt', async () => {
  const projectRoot = makeProjectRoot('markdown-import-safe-create-ok-');
  const untouchedScenePath = path.join(projectRoot, 'roman', '00_Keep.txt');
  const createdSceneAPath = path.join(projectRoot, 'roman', '01_Imported chapter.txt');
  const createdSceneBPath = path.join(projectRoot, 'roman', '02_Part', '01_Imported scene.txt');

  fs.mkdirSync(path.dirname(untouchedScenePath), { recursive: true });
  fs.writeFileSync(untouchedScenePath, 'keep-me\n', 'utf8');

  const result = await applyMarkdownImportSafeCreate(
    {
      previewPayload: previewPayload([
        {
          sceneId: 'scene-a',
          path: createdSceneAPath,
          content: 'Alpha\nBeta\n',
        },
        {
          sceneId: 'scene-b',
          path: createdSceneBPath,
          content: 'Gamma\nDelta\n',
        },
      ]),
    },
    {
      projectRoot,
      projectId: 'project-safe-create',
      reservedTopLevelRomanNames: ['oblozhka', 'chernovik', 'karta idey', 'chistovoy tekst'],
    },
  );

  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(readText(untouchedScenePath), 'keep-me\n');
  assert.equal(readText(createdSceneAPath), 'Alpha\nBeta\n');
  assert.equal(readText(createdSceneBPath), 'Gamma\nDelta\n');

  const receipt = result.value.receipt;
  assert.equal(result.value.created, true);
  assert.deepEqual(result.value.createdSceneIds, ['scene-a', 'scene-b']);
  assert.equal(receipt.schemaVersion, MARKDOWN_IMPORT_SAFE_CREATE_RECEIPT_SCHEMA);
  assert.equal(receipt.reason, MARKDOWN_IMPORT_SAFE_CREATE_READY_REASON);
  assert.equal(receipt.projectId, 'project-safe-create');
  assert.match(receipt.inputHash, /^[a-f0-9]{64}$/u);
  assert.match(receipt.outputHash, /^[a-f0-9]{64}$/u);
  assert.deepEqual(receipt.createdSceneIds, ['scene-a', 'scene-b']);
  assert.equal(receipt.createdScenes.length, 2);
  assert.deepEqual(
    receipt.createdScenes.map((entry) => entry.sceneId),
    ['scene-a', 'scene-b'],
  );
  assert.deepEqual(
    receipt.createdScenes.map((entry) => entry.path),
    [createdSceneAPath, createdSceneBPath],
  );
  assert.deepEqual(
    receipt.createdScenes.map((entry) => entry.bytesWritten),
    [
      Buffer.byteLength('Alpha\nBeta\n', 'utf8'),
      Buffer.byteLength('Gamma\nDelta\n', 'utf8'),
    ],
  );
  assert.equal(fs.existsSync(path.join(projectRoot, '.flow-batch')), true);
  assert.deepEqual(fs.readdirSync(path.join(projectRoot, '.flow-batch')), []);
});
