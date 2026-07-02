const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');

async function loadCommandModules() {
  const registryModule = await import(pathToFileURL(path.join(ROOT, 'src', 'renderer', 'commands', 'registry.mjs')).href);
  const runnerModule = await import(pathToFileURL(path.join(ROOT, 'src', 'renderer', 'commands', 'runCommand.mjs')).href);
  const projectModule = await import(pathToFileURL(path.join(ROOT, 'src', 'renderer', 'commands', 'projectCommands.mjs')).href);
  return { ...registryModule, ...runnerModule, ...projectModule };
}

function cloneJsonSafe(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function previewPlan(overrides = {}) {
  return {
    ok: true,
    schemaVersion: 'txt-import-preview.v1',
    type: 'txt.import.preview',
    status: 'preview',
    code: 'TXT_IMPORT_PREVIEW_READY',
    reason: 'TXT_IMPORT_PREVIEW_READY',
    decision: 'preview',
    writeEffects: false,
    previewHash: 'abcd1234ef',
    source: {
      schemaVersion: 'txt-import-local-file-preview.v1',
      type: 'txt.import.localFilePreview',
      sourceName: 'Imported.txt',
      encoding: 'utf-8',
      hasUtf8Bom: false,
      byteLength: 12,
      textLength: 12,
      lineCount: 2,
      textHash: '1234567890',
    },
    candidateCreatePlan: {
      mode: 'create-only',
      sceneStrategy: 'single-scene',
      entryCount: 1,
      entries: [
        {
          sceneId: 'txt-import-scene-abcd1234ef',
          kind: 'scene',
          title: 'Imported',
          content: 'Alpha\n\nBravo',
          contentTextHash: '1234567890',
          source: {
            schemaVersion: 'txt-import-local-file-preview.v1',
            type: 'txt.import.localFilePreview',
            sourceName: 'Imported.txt',
            encoding: 'utf-8',
            hasUtf8Bom: false,
            byteLength: 12,
            textLength: 12,
            lineCount: 2,
            textHash: '1234567890',
          },
        },
      ],
    },
    ...overrides,
  };
}

function localFilePreview(plan = previewPlan()) {
  return {
    ok: true,
    requestId: 'txt-product-flow',
    commandId: 'cmd.project.txt.previewLocalFile',
    commandOk: true,
    schemaVersion: 'txt-import-local-file-preview.v1',
    type: 'txt.import.localFilePreview',
    status: 'preview',
    code: 'TXT_IMPORT_LOCAL_FILE_PREVIEW_READY',
    reason: 'TXT_IMPORT_LOCAL_FILE_PREVIEW_READY',
    decision: 'preview',
    writeEffects: false,
    importPreviewOk: plan.ok === true,
    sourceSummary: {
      sourceName: 'Imported.txt',
      encoding: 'utf-8',
      hasUtf8Bom: false,
      byteLength: 12,
      textLength: 12,
      lineCount: 2,
      textHash: '1234567890',
    },
    txtImportPreviewPlan: plan,
  };
}

function safeCreateResult(plan = previewPlan()) {
  return {
    ok: true,
    requestId: 'txt-product-flow',
    commandId: 'cmd.project.txt.importSafeCreate',
    commandOk: true,
    safeCreateOk: true,
    created: true,
    createdSceneIds: [plan.candidateCreatePlan.entries[0].sceneId],
    receipt: {
      schemaVersion: 'txt-import-safe-create-receipt.v1',
      type: 'txt.import.safeCreate.receipt',
      reason: 'TXT_IMPORT_SAFE_CREATE_APPLIED',
      projectId: 'txt-product-project',
      batchId: 'flow-batch-txt',
      sourcePreviewHash: plan.previewHash,
      inputHash: 'a'.repeat(64),
      outputHash: 'b'.repeat(64),
      createdSceneIds: [plan.candidateCreatePlan.entries[0].sceneId],
      createdScenes: [
        {
          sceneId: plan.candidateCreatePlan.entries[0].sceneId,
          kind: 'scene',
          bytesWritten: 12,
          outputHash: 'c'.repeat(64),
        },
      ],
    },
  };
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

function assertNoForbiddenPublicFields(value) {
  const keys = collectKeys(value);
  for (const forbidden of ['rawBytes', 'bufferSource', 'filePath', 'projectRoot', 'outPath', 'outDir', 'writeReceipt', 'importReceipt', 'exportReceipt']) {
    assert.equal(keys.some((key) => key === forbidden || key.endsWith(`.${forbidden}`)), false, forbidden);
  }
}

test('TXT import product flow: preview-only command has no safe-create side effect', async () => {
  const {
    createCommandRegistry,
    createCommandRunner,
    registerProjectCommands,
    COMMAND_IDS,
  } = await loadCommandModules();
  const plan = previewPlan();
  const bridgeRequests = [];
  const registry = createCommandRegistry();
  registerProjectCommands(registry, {
    electronAPI: {
      invokeUiCommandBridge: async (request) => {
        bridgeRequests.push(cloneJsonSafe(request));
        assert.equal(request.commandId, 'cmd.project.txt.previewLocalFile');
        return { ok: true, value: localFilePreview(plan) };
      },
    },
  });

  const runCommand = createCommandRunner(registry, { capability: { platformId: 'node' } });
  const result = await runCommand(COMMAND_IDS.PROJECT_IMPORT_TXT_V1, {
    requestId: 'preview-only',
  });

  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(result.value.imported, false);
  assert.equal(result.value.preview, true);
  assert.equal(result.value.accepted, false);
  assert.equal(result.value.writeEffects, false);
  assert.equal(result.value.txtImportPreviewPlan.previewHash, plan.previewHash);
  assert.deepEqual(bridgeRequests.map((entry) => entry.commandId), ['cmd.project.txt.previewLocalFile']);
  assertNoForbiddenPublicFields(result);
});

test('TXT import product flow: accept runs preview then safe-create through command bridge', async () => {
  const {
    createCommandRegistry,
    createCommandRunner,
    registerProjectCommands,
    COMMAND_IDS,
  } = await loadCommandModules();
  const plan = previewPlan();
  const bridgeRequests = [];
  const registry = createCommandRegistry();
  registerProjectCommands(registry, {
    electronAPI: {
      invokeUiCommandBridge: async (request) => {
        bridgeRequests.push(cloneJsonSafe(request));
        if (request.commandId === 'cmd.project.txt.previewLocalFile') {
          return { ok: true, value: localFilePreview(plan) };
        }
        if (request.commandId === 'cmd.project.txt.importSafeCreate') {
          assert.deepEqual(request.payload.txtImportPreviewPlan, plan);
          assert.equal(request.payload.requestId, 'accept-now');
          return { ok: true, value: safeCreateResult(plan) };
        }
        throw new Error(`unexpected command: ${request.commandId}`);
      },
    },
  });

  const runCommand = createCommandRunner(registry, { capability: { platformId: 'node' } });
  const result = await runCommand(COMMAND_IDS.PROJECT_IMPORT_TXT_V1, {
    requestId: 'accept-now',
    accept: true,
  });

  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(result.value.imported, true);
  assert.equal(result.value.accepted, true);
  assert.equal(result.value.safeCreate, true);
  assert.equal(result.value.created, true);
  assert.equal(result.value.userVisible, true);
  assert.deepEqual(result.value.createdSceneIds, ['txt-import-scene-abcd1234ef']);
  assert.deepEqual(result.value.visibleCreatedSceneIds, ['txt-import-scene-abcd1234ef']);
  assert.equal(result.value.receipt.reason, 'TXT_IMPORT_SAFE_CREATE_APPLIED');
  assert.deepEqual(bridgeRequests.map((entry) => entry.commandId), [
    'cmd.project.txt.previewLocalFile',
    'cmd.project.txt.importSafeCreate',
  ]);
  assertNoForbiddenPublicFields(result);
});

test('TXT import product flow: internal accept command is node-only and preserves receipt', async () => {
  const {
    createCommandRegistry,
    createCommandRunner,
    registerProjectCommands,
    EXTRA_COMMAND_IDS,
  } = await loadCommandModules();
  const plan = previewPlan();
  const bridgeRequests = [];
  const registry = createCommandRegistry();
  registerProjectCommands(registry, {
    electronAPI: {
      invokeUiCommandBridge: async (request) => {
        bridgeRequests.push(cloneJsonSafe(request));
        assert.equal(request.commandId, 'cmd.project.txt.importSafeCreate');
        return { ok: true, value: safeCreateResult(plan) };
      },
    },
  });

  const runNodeCommand = createCommandRunner(registry, { capability: { platformId: 'node' } });
  const nodeResult = await runNodeCommand(EXTRA_COMMAND_IDS.PROJECT_TXT_IMPORT_SAFE_CREATE, {
    requestId: 'internal-accept',
    txtImportPreviewPlan: plan,
  });
  assert.equal(nodeResult.ok, true, JSON.stringify(nodeResult, null, 2));
  assert.equal(nodeResult.value.imported, true);
  assert.equal(nodeResult.value.receipt.sourcePreviewHash, plan.previewHash);
  assert.deepEqual(bridgeRequests.map((entry) => entry.commandId), ['cmd.project.txt.importSafeCreate']);

  const runWebCommand = createCommandRunner(registry, { capability: { platformId: 'web' } });
  const webResult = await runWebCommand(EXTRA_COMMAND_IDS.PROJECT_TXT_IMPORT_SAFE_CREATE, {
    requestId: 'web-accept',
    txtImportPreviewPlan: plan,
  });
  assert.equal(webResult.ok, false);
  assert.equal(webResult.error.reason, 'CAPABILITY_DISABLED_FOR_COMMAND');
  assert.equal(bridgeRequests.length, 1);
});
