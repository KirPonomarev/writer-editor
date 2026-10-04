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
    schemaVersion: 'revision-bridge.docx-import-preview.v1',
    type: 'docx.import.preview',
    status: 'preview',
    code: 'DOCX_IMPORT_PREVIEW_READY',
    reason: 'DOCX_IMPORT_PREVIEW_READY',
    decision: 'preview',
    writeEffects: false,
    previewHash: 'abcd1234',
    candidateCreatePlan: {
      mode: 'create-only',
      sceneStrategy: 'single-scene',
      entryCount: 1,
      entries: [
        {
          sceneId: 'docx-import-scene-abcd1234',
          kind: 'scene',
          title: 'Imported DOCX',
          content: 'Alpha\n\nBravo',
          contentTextHash: '11111111',
          source: {
            schemaVersion: 'revision-bridge.docx-content-preview.v1',
            type: 'docxContentPreviewReport',
            sourcePart: 'word/document.xml',
            paragraphRange: { start: 0, end: 1 },
            paragraphCount: 2,
            textHash: '22222222',
          },
        },
      ],
    },
    lossReport: {
      schemaVersion: 'revision-bridge.docx-import-preview.loss-report.v1',
      mode: 'plain-text-only',
      itemCount: 1,
      items: [
        {
          code: 'DOCX_IMPORT_PREVIEW_PLAIN_TEXT_ONLY',
          severity: 'info',
          category: 'formatting',
          message: 'plain text only',
        },
      ],
    },
    ...overrides,
  };
}

function localFilePreview(plan = previewPlan()) {
  return {
    ok: true,
    requestId: 'docx-product-flow',
    commandId: 'cmd.project.docx.previewLocalFile',
    commandOk: true,
    schemaVersion: 'revision-bridge.docx-import-local-file-preview.v1',
    type: 'docx.import.localFilePreview',
    status: 'preview',
    code: 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_READY',
    reason: 'DOCX_IMPORT_LOCAL_FILE_PREVIEW_READY',
    decision: 'preview',
    writeEffects: false,
    contentPreviewOk: true,
    importPreviewOk: plan.ok === true,
    docxContentPreviewReport: {
      schemaVersion: 'revision-bridge.docx-content-preview.v1',
      type: 'docxContentPreviewReport',
      code: 'DOCX_CONTENT_PREVIEW_READY',
    },
    docxImportPreviewPlan: plan,
  };
}

function safeCreateResult(plan = previewPlan()) {
  const publicSceneLocator = {
    sceneId: plan.candidateCreatePlan.entries[0].sceneId,
    nodeId: 'tree-node-1234abcd1234abcd1234abcd1234abcd',
    label: 'Imported DOCX 11111111',
    kind: 'scene',
  };
  return {
    ok: true,
    requestId: 'docx-product-flow',
    commandId: 'cmd.project.docx.importSafeCreate',
    commandOk: true,
    safeCreateOk: true,
    created: true,
    createdSceneIds: [plan.candidateCreatePlan.entries[0].sceneId],
    publicSceneLocators: [publicSceneLocator],
    publicSceneLocator,
    receipt: {
      schemaVersion: 'revision-bridge.docx-import-safe-create-receipt.v1',
      type: 'docx.import.safeCreate.receipt',
      reason: 'DOCX_IMPORT_SAFE_CREATE_APPLIED',
      projectId: 'docx-product-project',
      batchId: 'flow-batch-docx',
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
          treeNodeId: publicSceneLocator.nodeId,
          publicSceneLocator,
        },
      ],
      publicSceneLocators: [publicSceneLocator],
      publicSceneLocator,
      lossReportSummary: {
        schemaVersion: 'revision-bridge.docx-import-preview.loss-report.v1',
        mode: 'plain-text-only',
        itemCount: 1,
      },
      atomicEvidence: {
        sceneCount: 1,
        markerCleared: true,
      },
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
  for (const forbidden of ['rawBytes', 'bufferSource', 'filePath', 'projectRoot', 'outPath', 'outDir', 'bindingKey', 'relativeFile', 'writeReceipt', 'importReceipt', 'exportReceipt']) {
    assert.equal(keys.some((key) => key === forbidden || key.endsWith(`.${forbidden}`)), false, forbidden);
  }
}

test('DOCX import product flow: preview-only command has no safe-create side effect', async () => {
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
        assert.equal(request.commandId, 'cmd.project.docx.previewLocalFile');
        return { ok: true, value: localFilePreview(plan) };
      },
    },
  });

  const runCommand = createCommandRunner(registry, { capability: { platformId: 'node' } });
  const result = await runCommand(COMMAND_IDS.PROJECT_IMPORT_DOCX_V1, {
    requestId: 'preview-only',
  });

  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(result.value.imported, false);
  assert.equal(result.value.preview, true);
  assert.equal(result.value.accepted, false);
  assert.equal(result.value.writeEffects, false);
  assert.equal(result.value.docxImportPreviewPlan.previewHash, plan.previewHash);
  assert.equal(result.value.lossReport.itemCount, 1);
  assert.deepEqual(bridgeRequests.map((entry) => entry.commandId), ['cmd.project.docx.previewLocalFile']);
  assertNoForbiddenPublicFields(result);
});

test('DOCX import product flow: accept runs preview then safe-create through command bridge', async () => {
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
        if (request.commandId === 'cmd.project.docx.previewLocalFile') {
          return { ok: true, value: localFilePreview(plan) };
        }
        if (request.commandId === 'cmd.project.docx.previewImportPlan') {
          assert.equal(request.payload.docxContentPreviewReport.code, 'DOCX_CONTENT_PREVIEW_READY');
          assert.equal(request.payload.requestId, 'docx-product-flow');
          return { ok: true, value: { ok: true, docxImportPreviewPlan: plan } };
        }
        if (request.commandId === 'cmd.project.docx.importSafeCreate') {
          assert.deepEqual(request.payload.docxImportPreviewPlan, plan);
          assert.equal(request.payload.requestId, 'docx-product-flow');
          return { ok: true, value: safeCreateResult(plan) };
        }
        throw new Error(`unexpected command: ${request.commandId}`);
      },
    },
  });

  const runCommand = createCommandRunner(registry, { capability: { platformId: 'node' } });
  const result = await runCommand(COMMAND_IDS.PROJECT_IMPORT_DOCX_V1, {
    requestId: 'accept-now',
    accept: true,
  });

  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(result.value.imported, true);
  assert.equal(result.value.accepted, true);
  assert.equal(result.value.safeCreate, true);
  assert.equal(result.value.created, true);
  assert.equal(result.value.userVisible, true);
  assert.deepEqual(result.value.createdSceneIds, ['docx-import-scene-abcd1234']);
  assert.deepEqual(result.value.visibleCreatedSceneIds, ['docx-import-scene-abcd1234']);
  assert.deepEqual(result.value.publicSceneLocator, {
    sceneId: 'docx-import-scene-abcd1234',
    nodeId: 'tree-node-1234abcd1234abcd1234abcd1234abcd',
    label: 'Imported DOCX 11111111',
    kind: 'scene',
  });
  assert.deepEqual(result.value.publicSceneLocators, [result.value.publicSceneLocator]);
  assert.equal(result.value.receipt.reason, 'DOCX_IMPORT_SAFE_CREATE_APPLIED');
  assert.deepEqual(bridgeRequests.map((entry) => entry.commandId), [
    'cmd.project.docx.previewLocalFile',
    'cmd.project.docx.previewImportPlan',
    'cmd.project.docx.importSafeCreate',
  ]);
  assertNoForbiddenPublicFields(result);
});

test('DOCX import product flow: internal accept command is node-only and preserves receipt', async () => {
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
        assert.equal(request.commandId, 'cmd.project.docx.importSafeCreate');
        return { ok: true, value: safeCreateResult(plan) };
      },
    },
  });

  const runNodeCommand = createCommandRunner(registry, { capability: { platformId: 'node' } });
  const nodeResult = await runNodeCommand(EXTRA_COMMAND_IDS.PROJECT_DOCX_IMPORT_SAFE_CREATE, {
    requestId: 'internal-accept',
    docxImportPreviewPlan: plan,
  });
  assert.equal(nodeResult.ok, true, JSON.stringify(nodeResult, null, 2));
  assert.equal(nodeResult.value.imported, true);
  assert.equal(nodeResult.value.receipt.sourcePreviewHash, plan.previewHash);
  assert.deepEqual(bridgeRequests.map((entry) => entry.commandId), ['cmd.project.docx.importSafeCreate']);

  const runWebCommand = createCommandRunner(registry, { capability: { platformId: 'web' } });
  const webResult = await runWebCommand(EXTRA_COMMAND_IDS.PROJECT_DOCX_IMPORT_SAFE_CREATE, {
    requestId: 'web-accept',
    docxImportPreviewPlan: plan,
  });
  assert.equal(webResult.ok, false);
  assert.equal(webResult.error.reason, 'CAPABILITY_DISABLED_FOR_COMMAND');
  assert.equal(bridgeRequests.length, 1);
});

test('DOCX import product flow: unacceptable plan fails before safe-create bridge', async () => {
  const {
    createCommandRegistry,
    createCommandRunner,
    registerProjectCommands,
    COMMAND_IDS,
  } = await loadCommandModules();
  const bridgeRequests = [];
  const registry = createCommandRegistry();
  registerProjectCommands(registry, {
    electronAPI: {
      invokeUiCommandBridge: async (request) => {
        bridgeRequests.push(cloneJsonSafe(request));
        assert.equal(request.commandId, 'cmd.project.docx.previewImportPlan');
        return {
          ok: true,
          value: {
            ok: true,
            docxImportPreviewPlan: previewPlan({ ok: false }),
          },
        };
      },
    },
  });

  const runCommand = createCommandRunner(registry, { capability: { platformId: 'node' } });
  const result = await runCommand(COMMAND_IDS.PROJECT_IMPORT_DOCX_V1, {
    accept: true,
    docxImportPreviewPlan: previewPlan({ ok: false }),
    docxContentPreviewReport: {
      schemaVersion: 'revision-bridge.docx-content-preview.v1',
      type: 'docxContentPreviewReport',
      code: 'DOCX_CONTENT_PREVIEW_READY',
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'E_DOCX_IMPORT_PREVIEW_NOT_ACCEPTABLE');
  assert.equal(result.error.reason, 'DOCX_IMPORT_PREVIEW_NOT_ACCEPTABLE');
  assert.deepEqual(bridgeRequests.map((entry) => entry.commandId), ['cmd.project.docx.previewImportPlan']);
});

test('DOCX product command forwards one explicit attempt through preview, failed accept, retry and a separate new attempt',async()=>{
 const {createCommandRegistry,createCommandRunner,registerProjectCommands,COMMAND_IDS}=await loadCommandModules();
 const plan=previewPlan(),calls=[],registry=createCommandRegistry();let failAccept=true;
 registerProjectCommands(registry,{electronAPI:{invokeUiCommandBridge:async request=>{
  calls.push(cloneJsonSafe(request));
  if(request.commandId==='cmd.project.docx.previewLocalFile')return {ok:true,value:localFilePreview(plan)};
  if(request.commandId==='cmd.project.docx.previewImportPlan')return {ok:true,value:{ok:true,docxImportPreviewPlan:plan}};
  if(request.commandId==='cmd.project.docx.importSafeCreate')return failAccept
    ?{ok:true,value:{ok:false,error:{code:'DOCX_RETRY_TEST',reason:'DOCX_RETRY_TEST'}}}:{ok:true,value:safeCreateResult(plan)};
  throw Error(request.commandId);
 }}});
 const run=createCommandRunner(registry,{capability:{platformId:'node'}}),id=COMMAND_IDS.PROJECT_IMPORT_DOCX_V1;
 const preview=await run(id,{requestId:'attempt-a'});assert.equal(preview.ok,true);
 const input={requestId:'attempt-a',accept:true,localFilePreview:preview.value.localFilePreview,docxImportPreviewPlan:plan};
 assert.equal((await run(id,input)).ok,false);failAccept=false;assert.equal((await run(id,input)).ok,true);
 assert.ok(calls.length>=3);assert.ok(calls.every(call=>call.payload.requestId==='attempt-a'));
 const before=calls.length;assert.equal((await run(id,{requestId:'attempt-b'})).ok,true);
 assert.equal(calls.length,before+1);assert.equal(calls.at(-1).payload.requestId,'attempt-b');
});

test('DOCX acknowledgement uses the existing safe-create port without parsing or creating', async () => {
  const { createCommandRegistry, createCommandRunner, registerProjectCommands, COMMAND_IDS } = await loadCommandModules();
  const calls = [], registry = createCommandRegistry();
  registerProjectCommands(registry, { electronAPI: { invokeUiCommandBridge: async request => {
    calls.push(cloneJsonSafe(request));
    return { ok: true, value: { ok: true, acknowledged: true, cleared: true } };
  } } });
  const run = createCommandRunner(registry, { capability: { platformId: 'node' } });
  const input = { action: 'acknowledge-open', requestId: 'accepted-attempt', projectId: 'project-a', nodeId: 'tree-node-' + 'a'.repeat(32) };
  const result = await run(COMMAND_IDS.PROJECT_IMPORT_DOCX_V1, input);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.value.acknowledged, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].commandId, 'cmd.project.docx.importSafeCreate');
  assert.deepEqual(calls[0].payload, input);
});

test('actual editor dispatch metadata crosses the command bus but never enters the closed Main ACK payload', async () => {
  const fs = require('node:fs'), vm = require('node:vm');
  const { createCommandRegistry, createCommandRunner, registerProjectCommands, COMMAND_IDS } = await loadCommandModules();
  const { COMMAND_BUS_ROUTE, runCommandThroughBus } = await import(pathToFileURL(path.join(ROOT, 'src/renderer/commands/commandBusGuard.mjs')).href);
  const source = fs.readFileSync(path.join(ROOT, 'src/renderer/editor.js'), 'utf8');
  const actualDispatch = source.slice(source.indexOf('function withEditorModeCommandPayload('), source.indexOf('async function invokePreloadUiCommandBridge('));
  const calls = [], registry = createCommandRegistry();
  registerProjectCommands(registry, { electronAPI: { invokeUiCommandBridge: async request => {
    calls.push(cloneJsonSafe(request));
    assert.deepEqual(Object.keys(request.payload).sort(), ['action', 'nodeId', 'projectId', 'requestId']);
    return { ok: true, value: { ok: true, acknowledged: true, cleared: true } };
  } } });
  const runCommand = createCommandRunner(registry, { capability: { platformId: 'node' } });
  const context = { isTiptapMode: true, runCommand, COMMAND_BUS_ROUTE, runCommandThroughBus,
    updateStatusText: () => {}, mapCommandErrorToUi: error => ({ ...error, severity: 'ERROR', userMessage: 'failed' }),
    console: { error: () => {} } };
  vm.runInNewContext(actualDispatch, context);
  const input = { action: 'acknowledge-open', requestId: 'real-dispatch-attempt', projectId: 'project-a', nodeId: 'tree-node-' + 'a'.repeat(32) };
  for (const tiptap of [true, false]) {
    context.isTiptapMode = tiptap;
    const result = await context.dispatchUiCommand(COMMAND_IDS.PROJECT_IMPORT_DOCX_V1, input);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(calls.at(-1).payload, input);
  }
  assert.equal(calls.length, 2);
  for (const extra of [{ editorMode: 'forged' }, { editorMode: {} }, { editorMode: null }, { path: '/forged' }, { accepted: true }, { docxImportPreviewPlan: {} }]) {
    const result = await runCommand(COMMAND_IDS.PROJECT_IMPORT_DOCX_V1, { ...input, ...extra });
    assert.equal(result.ok, false); assert.equal(result.error.code, 'E_DOCX_IMPORT_ACK_INVALID');
    assert.equal(calls.length, 2, 'invalid metadata must not reach Main');
  }
});

test('ACK bridge preserves only fixed Main diagnostic codes and never arbitrary server text', async () => {
  const { createCommandRegistry, createCommandRunner, registerProjectCommands, COMMAND_IDS } = await loadCommandModules();
  const registry = createCommandRegistry(); let serverCode = 'E_DOCX_IMPORT_ACK_CONTENT_MISMATCH';
  registerProjectCommands(registry, { electronAPI: { invokeUiCommandBridge: async () => ({ ok: true, value: {
    ok: false, error: { code: serverCode, reason: '/private/source.docx secret content', details: { path: '/private/secret' } },
  } }) } });
  const run = createCommandRunner(registry, { capability: { platformId: 'node' } });
  const payload = { action: 'acknowledge-open', requestId: 'attempt', projectId: 'project-a', nodeId: 'tree-node-' + 'a'.repeat(32) };
  const known = await run(COMMAND_IDS.PROJECT_IMPORT_DOCX_V1, payload);
  assert.equal(known.error.code, serverCode); assert.equal(known.error.reason, 'DOCX_IMPORT_ACK_CONTENT_MISMATCH');
  assert.equal(JSON.stringify(known).includes('private'), false);
  serverCode = 'E_DOCX_IMPORT_ACK_PRIVATE_DATA';
  const unknown = await run(COMMAND_IDS.PROJECT_IMPORT_DOCX_V1, payload);
  assert.equal(unknown.error.code, 'E_DOCX_IMPORT_ACK_FAILED'); assert.equal(JSON.stringify(unknown).includes('private'), false);
});
