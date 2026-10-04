const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MAIN_PATH = path.join(REPO_ROOT, 'src', 'main.js');
const SECTION_START = '// DOCX_IMPORT_SAFE_CREATE_COMMAND_SURFACE_START';
const SECTION_END = '// DOCX_IMPORT_SAFE_CREATE_COMMAND_SURFACE_END';

function readMainSource() {
  return fs.readFileSync(MAIN_PATH, 'utf8');
}

function extractMarkedSection(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);
  assert.notEqual(start, -1, `missing marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing marker: ${endMarker}`);
  assert.ok(end > start, `marker order invalid: ${startMarker}`);
  return text.slice(start, end + endMarker.length);
}

function cloneJsonSafe(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function isPlainObjectValue(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function copyDocxImportPreviewAllowedFields(source, allowedKeys) {
  if (!isPlainObjectValue(source)) return null;
  const out = {};
  for (const key of allowedKeys) {
    if (source[key] !== undefined) out[key] = cloneJsonSafe(source[key]);
  }
  return out;
}

function instantiateDocxImportSafeCreatePort(options = {}) {
  const mainSource = readMainSource();
  const section = extractMarkedSection(mainSource, SECTION_START, SECTION_END);
  const calls = {
    helper: [],
    ensureProjectStructure: 0,
    resolveProjectBindingForFile: [],
    admission: [],
  };
  const sandbox = {
    calls,
    currentProjectName: 'Project', DEFAULT_PROJECT_NAME: 'Project',
    recoverPendingWriterProjectTransaction: async () => {},
    readDocxImportAttempt: async () => ({ record: { requestId: sandbox.lastRequestId }, sha256: 'a'.repeat(64) }),
    cloneJsonSafe,
    isPlainObjectValue,
    copyDocxImportPreviewAllowedFields,
    isDocxImportPreviewPlanAdmitted: typeof options.isDocxImportPreviewPlanAdmitted === 'function'
      ? (plan) => {
          calls.admission.push(cloneJsonSafe(plan));
          return options.isDocxImportPreviewPlanAdmitted(plan);
        }
      : (plan) => {
          calls.admission.push(cloneJsonSafe(plan));
          return true;
        },
    applyDocxImportSafeCreate: Object.prototype.hasOwnProperty.call(options, 'applyDocxImportSafeCreate')
      ? options.applyDocxImportSafeCreate
      : async (input, helperOptions) => {
          sandbox.lastRequestId = helperOptions.importRequestNonce;
          calls.helper.push({ input: cloneJsonSafe(input), options: cloneJsonSafe({
            projectRoot: helperOptions.projectRoot,
            romanRoot: helperOptions.romanRoot,
            projectId: helperOptions.projectId,
            operationLabel: helperOptions.operationLabel,
            hasQueueDiskOperation: typeof helperOptions.queueDiskOperation === 'function',
            hasPublicationGuard: typeof helperOptions.assertPublication === 'function',
            hasTransactionAuthority: helperOptions.transactionAuthority !== null
              && typeof helperOptions.transactionAuthority === 'object',
          }) });
          const publicSceneLocator = {
            sceneId: 'docx-import-scene-1234abcd',
            nodeId: 'tree-node-1234abcd1234abcd1234abcd1234abcd',
            label: 'Imported DOCX 11111111',
            kind: 'scene',
          };
          return {
            ok: true,
            value: {
              created: true,
              createdSceneIds: ['docx-import-scene-1234abcd'],
              publicSceneLocators: [publicSceneLocator],
              publicSceneLocator,
              importOperationId: 'docx-import-op-teststub0001',
              receipt: {
                // GENERIC-01 (G8 amendment): receipt schema bumped to v2.
                schemaVersion: 'revision-bridge.docx-import-receipt.v2',
                type: 'docx.import.safeCreate.receipt',
                reason: 'DOCX_IMPORT_SAFE_CREATE_APPLIED',
                importOperationId: 'docx-import-op-teststub0001',
                projectId: helperOptions.projectId,
                sourceArtifactSha256: 'd'.repeat(64),
                candidateContentSha256: 'e'.repeat(64),
                batchId: 'flow-batch-test',
                sourcePreviewHash: input.docxImportPreviewPlan.previewHash,
                inputHash: 'a'.repeat(64),
                outputHash: 'b'.repeat(64),
                createdSceneIds: ['docx-import-scene-1234abcd'],
                createdScenes: [
                  {
                    sceneId: 'docx-import-scene-1234abcd',
                    kind: 'scene',
                    bytesWritten: 5,
                    outputHash: 'c'.repeat(64),
                    treeNodeId: 'tree-node-1234abcd1234abcd1234abcd1234abcd',
                    treeId: 'yalken.scene.tree.root.stubroot01',
                    publicSceneLocator,
                  },
                ],
                publicSceneLocators: [publicSceneLocator],
                publicSceneLocator,
                sceneTreeIdentities: [
                  {
                    sceneId: 'docx-import-scene-1234abcd',
                    treeNodeId: 'tree-node-1234abcd1234abcd1234abcd1234abcd',
                    treeId: 'yalken.scene.tree.root.stubroot01',
                  },
                ],
                lossReport: {
                  schemaVersion: 'revision-bridge.docx-import-preview.loss-report.v1',
                  mode: 'plain-text-only',
                  itemCount: 1,
                  items: [
                    {
                      code: 'DOCX_IMPORT_PREVIEW_PLAIN_TEXT_ONLY',
                      severity: 'info',
                      category: 'formatting',
                      message: 'DOCX import preview candidate is limited to plain text scene content',
                    },
                  ],
                },
                lossReportSummary: {
                  schemaVersion: 'revision-bridge.docx-import-preview.loss-report.v1',
                  mode: 'plain-text-only',
                  itemCount: 1,
                },
                manifestAuthority: {
                  revision: 'stubrev01',
                  algorithmic: true,
                  algorithmicHash: 'f'.repeat(64),
                  durablePublication: false,
                },
                carrierIgnored: null,
                transactionEvidence: {
                  lease: { algorithmic: true },
                  manifestHash: 'f'.repeat(64),
                  batchManifestHash: '1'.repeat(64),
                },
                atomicEvidence: {
                  sceneCount: 1,
                  markerCleared: true,
                },
                createdAt: '2026-01-01T00:00:00.000Z',
              },
            },
          };
        },
    ensureProjectStructure: async () => {
      calls.ensureProjectStructure += 1;
    },
    getProjectSectionPath: () => '/trusted/project/roman',
    getProjectRootPath: () => '/trusted/project',
    resolveProjectBindingForFile: async (targetPath) => {
      calls.resolveProjectBindingForFile.push(targetPath);
      return { projectId: 'trusted-project-id' };
    },
    queueDiskOperation: async (operation) => operation(),
    getMainProjectManifestAuthority: async () => ({ kind: 'captured-port-for-projection-test' }),
    module: { exports: {} },
    exports: {},
    ...options.globals,
  };
  vm.runInNewContext(
    `${section}
module.exports = {
  calls,
  DOCX_IMPORT_SAFE_CREATE_COMMAND_ID,
  validateDocxImportSafeCreatePayload,
  handleDocxImportSafeCreateCommandSurface,
};`,
    sandbox,
    { filename: MAIN_PATH },
  );
  return { ...sandbox.module.exports, sandbox };
}

function validPreviewPlan(overrides = {}) {
  return {
    ok: true,
    schemaVersion: 'revision-bridge.docx-import-preview.v1',
    type: 'docx.import.preview',
    status: 'preview',
    code: 'DOCX_IMPORT_PREVIEW_READY',
    reason: 'DOCX_IMPORT_PREVIEW_READY',
    decision: 'preview',
    writeEffects: false,
    previewHash: '1234abcd',
    candidateCreatePlan: {
      mode: 'create-only',
      sceneStrategy: 'single-scene',
      entryCount: 1,
      entries: [
        {
          sceneId: 'docx-import-scene-1234abcd',
          kind: 'scene',
          content: 'Alpha',
          contentTextHash: '11111111',
          source: {
            schemaVersion: 'revision-bridge.docx-content-preview.v1',
            type: 'docxContentPreviewReport',
            sourcePart: 'word/document.xml',
            paragraphRange: { start: 0, end: 0 },
            paragraphCount: 1,
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

function payload(overrides = {}) {
  return {
    requestId: 'request-1',
    docxImportPreviewPlan: validPreviewPlan(),
    ...overrides,
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

test('DOCX import safe create command surface: command id is bridge-allowlisted and handler-owned', () => {
  const source = readMainSource();

  assert.match(
    source,
    /UI_COMMAND_BRIDGE_ALLOWED_COMMAND_IDS\s*=\s*new Set\(\[[\s\S]*'cmd\.project\.docx\.importSafeCreate'/,
  );
  assert.match(
    source,
    /'cmd\.project\.docx\.importSafeCreate':\s*async\s*\(payload\s*=\s*\{\}\)\s*=>\s*\{\s*return handleDocxImportSafeCreateCommandSurface\(payload\);/,
  );
});

test('DOCX import safe create command surface: clean plan delegates with trusted context only', async () => {
  const port = instantiateDocxImportSafeCreatePort();
  const result = await port.handleDocxImportSafeCreateCommandSurface(payload());

  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(result.requestId, 'request-1');
  assert.equal(result.commandId, 'cmd.project.docx.importSafeCreate');
  assert.equal(result.commandOk, true);
  assert.equal(result.safeCreateOk, true);
  assert.equal(result.created, true);
  assert.deepEqual(result.createdSceneIds, ['docx-import-scene-1234abcd']);
  const publicSceneLocator = JSON.parse(JSON.stringify(result.publicSceneLocator));
  assert.deepEqual(publicSceneLocator, {
    sceneId: 'docx-import-scene-1234abcd',
    nodeId: 'tree-node-1234abcd1234abcd1234abcd1234abcd',
    label: 'Imported DOCX 11111111',
    kind: 'scene',
  });
  assert.deepEqual(JSON.parse(JSON.stringify(result.publicSceneLocators)), [publicSceneLocator]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.receipt.publicSceneLocator)), publicSceneLocator);
  assert.equal(port.calls.admission.length, 1);
  assert.equal(port.calls.admission[0].previewHash, payload().docxImportPreviewPlan.previewHash);
  assert.equal(result.receipt.projectId, 'trusted-project-id');
  assert.equal(port.calls.ensureProjectStructure, 1);
  assert.deepEqual(port.calls.resolveProjectBindingForFile, ['/trusted/project/roman']);
  assert.equal(port.calls.helper.length, 1);
  assert.deepEqual(Object.keys(port.calls.helper[0].input), ['docxImportPreviewPlan']);
  assert.equal(port.calls.helper[0].options.projectRoot, '/trusted/project');
  assert.equal(port.calls.helper[0].options.romanRoot, '/trusted/project/roman');
  assert.equal(port.calls.helper[0].options.operationLabel, 'safe create DOCX import transaction');
  assert.equal(port.calls.helper[0].options.hasQueueDiskOperation, true);
  assert.equal(port.calls.helper[0].options.hasPublicationGuard, true);

  const resultKeys = collectKeys(result);
  for (const forbidden of ['path', 'filePath', 'projectRoot', 'rawBytes', 'bufferSource', 'bindingKey', 'relativeFile', 'writeReceipt', 'importReceipt', 'exportReceipt']) {
    assert.equal(resultKeys.some((key) => key === forbidden || key.endsWith(`.${forbidden}`)), false, forbidden);
  }
});

test('DOCX import safe create command surface: payload fields and authority leaks fail before helper', async () => {
  const port = instantiateDocxImportSafeCreatePort();
  const unsupported = await port.handleDocxImportSafeCreateCommandSurface(payload({ projectRoot: '/tmp/project' }));
  const wrongSchema = await port.handleDocxImportSafeCreateCommandSurface(payload({
    docxImportPreviewPlan: validPreviewPlan({ schemaVersion: 'wrong' }),
  }));
  const nestedForbidden = await port.handleDocxImportSafeCreateCommandSurface(payload({
    docxImportPreviewPlan: {
      ...validPreviewPlan(),
      source: {
        projectRoot: '/tmp/project',
      },
    },
  }));
  const rawBytes = await port.handleDocxImportSafeCreateCommandSurface(payload({
    docxImportPreviewPlan: {
      ...validPreviewPlan(),
      rawBytes: 'base64',
    },
  }));

  assert.equal(unsupported.ok, false);
  assert.equal(unsupported.error.reason, 'DOCX_IMPORT_SAFE_CREATE_PAYLOAD_UNSUPPORTED_FIELDS');
  assert.equal(wrongSchema.ok, false);
  assert.equal(wrongSchema.error.reason, 'DOCX_IMPORT_SAFE_CREATE_PREVIEW_PLAN_SCHEMA_INVALID');
  assert.equal(nestedForbidden.ok, false);
  assert.equal(nestedForbidden.error.reason, 'DOCX_IMPORT_SAFE_CREATE_PAYLOAD_FORBIDDEN_FIELD');
  assert.equal(nestedForbidden.error.details.key, 'docxImportPreviewPlan.source.projectRoot');
  assert.equal(rawBytes.ok, false);
  assert.equal(rawBytes.error.reason, 'DOCX_IMPORT_SAFE_CREATE_PAYLOAD_FORBIDDEN_FIELD');
  assert.equal(rawBytes.error.details.key, 'docxImportPreviewPlan.rawBytes');
  assert.equal(port.calls.helper.length, 0);
});

test('DOCX import safe create command surface: unadmitted preview fails before helper and project context', async () => {
  const port = instantiateDocxImportSafeCreatePort({
    isDocxImportPreviewPlanAdmitted: () => false,
  });

  const result = await port.handleDocxImportSafeCreateCommandSurface(payload());

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'E_DOCX_IMPORT_SAFE_CREATE_PREVIEW_NOT_ADMITTED');
  assert.equal(result.error.reason, 'DOCX_IMPORT_SAFE_CREATE_PREVIEW_NOT_ADMITTED');
  assert.equal(port.calls.admission.length, 1);
  assert.equal(port.calls.helper.length, 0);
  assert.equal(port.calls.ensureProjectStructure, 0);
  assert.equal(port.calls.resolveProjectBindingForFile.length, 0);
});

test('DOCX import safe create command surface: helper unavailable, helper failure, and forbidden result fail closed', async () => {
  const unavailable = instantiateDocxImportSafeCreatePort({
    applyDocxImportSafeCreate: undefined,
  });
  const helperFails = instantiateDocxImportSafeCreatePort({
    applyDocxImportSafeCreate: async () => ({
      ok: false,
      error: {
        code: 'DOCX_SAFE_CREATE_PREVIEW_TAMPERED',
        reason: 'docx_import_safe_create_preview_hash_mismatch',
        details: {
          field: 'previewHash',
          markerPath: '/private/tmp/project/.flow-batch/secret.json',
          staleMarkers: ['/private/tmp/project/.flow-batch/stale.json'],
          batchId: 'flow-batch-command',
          messageCode: 'FLOW_BATCH_FAILED /private/tmp/project/.flow-batch/secret.json',
        },
      },
    }),
  });
  const helperThrows = instantiateDocxImportSafeCreatePort({
    applyDocxImportSafeCreate: async () => {
      throw new Error('write crashed');
    },
  });
  const forbiddenResult = instantiateDocxImportSafeCreatePort({
    applyDocxImportSafeCreate: async () => ({
      ok: true,
      value: {
        created: true,
        createdSceneIds: ['docx-import-scene-1234abcd'],
        receipt: {
          schemaVersion: 'revision-bridge.docx-import-safe-create-receipt.v1',
          path: '/tmp/leak.txt',
          createdSceneIds: ['docx-import-scene-1234abcd'],
        },
      },
    }),
  });

  const unavailableResult = await unavailable.handleDocxImportSafeCreateCommandSurface(payload());
  const helperFailResult = await helperFails.handleDocxImportSafeCreateCommandSurface(payload());
  const helperThrowResult = await helperThrows.handleDocxImportSafeCreateCommandSurface(payload());
  const forbiddenResultValue = await forbiddenResult.handleDocxImportSafeCreateCommandSurface(payload());

  assert.equal(unavailableResult.ok, false);
  assert.equal(unavailableResult.error.code, 'E_DOCX_IMPORT_SAFE_CREATE_UNAVAILABLE');
  assert.equal(unavailableResult.error.reason, 'DOCX_IMPORT_SAFE_CREATE_HELPER_UNAVAILABLE');
  assert.equal(helperFailResult.ok, false);
  assert.equal(helperFailResult.error.code, 'DOCX_SAFE_CREATE_PREVIEW_TAMPERED');
  assert.equal(helperFailResult.error.reason, 'docx_import_safe_create_preview_hash_mismatch');
  assert.equal(helperFailResult.error.details.field, 'previewHash');
  assert.equal(helperFailResult.error.details.batchId, 'flow-batch-command');
  assert.equal(helperFailResult.error.details.staleMarkerCount, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(helperFailResult.error.details, 'messageCode'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(helperFailResult.error.details, 'markerPath'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(helperFailResult.error.details, 'staleMarkers'), false);
  assert.equal(helperThrowResult.ok, false);
  assert.equal(helperThrowResult.error.code, 'E_DOCX_IMPORT_SAFE_CREATE_FAILED');
  assert.equal(helperThrowResult.error.reason, 'DOCX_IMPORT_SAFE_CREATE_EXECUTION_FAILED');
  assert.equal(forbiddenResultValue.ok, false);
  assert.equal(forbiddenResultValue.error.code, 'E_DOCX_IMPORT_SAFE_CREATE_INVALID_RESULT');
  assert.equal(forbiddenResultValue.error.reason, 'DOCX_IMPORT_SAFE_CREATE_FORBIDDEN_RESULT');
  assert.equal(forbiddenResultValue.error.details.key, 'receipt.path');
});

test('DOCX import safe create command surface: contour section does not reparse DOCX or touch UI/export layers', () => {
  const section = extractMarkedSection(readMainSource(), SECTION_START, SECTION_END);
  const forbiddenRuntimeMarkers = [
    'buildDocxImportPreviewPlanFromContentPreview',
    'buildDocxContentPreviewReportFromBufferSource',
    'buildDocxMinBuffer',
    'runDocxMinExport',
    'applyMarkdownImportSafeCreate',
    'handleDocxImportPreviewCommandSurface',
    'handleReviewSurfaceImportPacketCommandSurface',
    'BrowserWindow',
    'dialog.',
    'ipcMain',
    'fetch',
    'http',
    'https',
    'DOMParser',
    'XMLParser',
  ];

  for (const marker of forbiddenRuntimeMarkers) {
    assert.equal(section.includes(marker), false, `${marker} must stay out of DOCX safe-create command surface`);
  }
});

function readSourceForComposer() {
  const editor = fs.readFileSync(path.join(REPO_ROOT, 'src/renderer/editor.js'), 'utf8');
  return editor.slice(editor.indexOf('function composeDocumentContent()'), editor.indexOf('function composeEditorSnapshot()'));
}

async function acknowledgedImportHarness(t) {
  const os = require('node:os');
  const safe = require('../../src/utils/docxImportSafeCreate');
  const { withRealDocxImportAuthority } = require('../fixtures/docx-import-real-authority.cjs');
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'main-import-ack-'));
  t.after(() => fs.rmSync(projectRoot, { recursive: true, force: true }));
  const binding = await withRealDocxImportAuthority({ projectRoot, projectId: 'ack-project' });
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const { buildStoredZip } = require('../../src/export/docx/docxMinBuilder');
  const bytes = buildStoredZip([
    {name:'[Content_Types].xml',data:'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'},
    {name:'_rels/.rels',data:'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'},
    {name:'word/document.xml',data:'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Actual parser source</w:t></w:r></w:p></w:body></w:document>'},
  ]);
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(bridge.buildDocxContentPreviewFromZipBytes(bytes));
  assert.equal(plan.ok, true);
  safe.rememberDocxImportPreviewPlanAdmission(plan);
  let context = 'A', continuity = true, beforeSnapshot = () => {}, beforeContinuity = () => {}, saves = 0;
  const envelope = require('../../src/core/document-content-envelope-v1.cjs');
  const equalityContext = {
    loadDocumentContentEnvelopeModule: async () => envelope,
    loadRtkNonTextReturnModule: () => import('../../src/io/revisionBridge/reviewTransportNonTextReturnRuntime.mjs'),
    userBookmarkModel: require('../../src/core/word-user-bookmarks-v1.cjs'),
    pendingTextRevisions: require('../../src/core/word-pending-text-revisions-v1.cjs'),
  };
  const mainSource = readMainSource();
  vm.runInNewContext(mainSource.slice(mainSource.indexOf('async function treeSceneSnapshotsEqual('),
    mainSource.indexOf('async function assertTreeEditorSnapshotIdentity(')), equalityContext);
  const liveContent = () => {
    const raw = fs.readFileSync(port.sandbox.currentFilePath, 'utf8'), parsed = envelope.parseObservablePayload(raw);
    const editor = readSourceForComposer();
    const composer = { isTiptapMode: true, centralSheetStripLargePayloadFastPathActive: false,
      getTiptapDocumentSnapshot: () => ({ doc: parsed.doc || envelope.buildParagraphDocumentFromText(parsed.text), text: parsed.text }),
      composeObservablePayload: envelope.composeObservablePayload, metaEnabled: true, currentMeta: parsed.meta, currentCards: parsed.cards };
    vm.runInNewContext(editor, composer);
    return composer.composeDocumentContent();
  };
  const port = instantiateDocxImportSafeCreatePort({ globals: {
    ...safe, ...equalityContext, fs: fs.promises,
    getProjectRootPath: () => projectRoot, getProjectSectionPath: () => path.join(projectRoot, 'roman'),
    resolveProjectBindingForFile: async () => ({ ...binding, manifestRaw: fs.readFileSync(binding.manifestPath, 'utf8') }),
    getMainProjectManifestAuthority: async () => binding.transactionAuthority,
    captureDocxImportPreviewContext: () => context,
    mainWindow: {}, activeStage10ApplicationBootstrap: {}, commentAuthoringSessionId: 'session',
    currentLifecycleSubjectId: () => 'subject', lastSignaledEditGeneration: 0, currentFilePath: '',
    isDirty: false, activePendingRecording: false, autoSaveInProgress: false,
    userBookmarkCapability: () => {},
    getResolvedTreeDocumentTarget: node => ({ filePath: node.filePath }),
    requestEditorSnapshot: async () => { beforeSnapshot(); return { projectId: binding.projectId,
      documentId: port.nodeId, generation: 0, content: liveContent(), selectionRange: { start: 0, end: 0 } }; },
    saveLastFile: async options => { saves++; beforeContinuity(); options.beforeWrite(); return { ok: continuity }; },
    resolveProjectTreeNodeIdentity: async nodeId => { assert.equal(nodeId, port.nodeId); return { filePath: port.sandbox.currentFilePath }; },
  } });
  const result = await port.handleDocxImportSafeCreateCommandSurface({ requestId: 'docx-import-before-restart', docxImportPreviewPlan: plan });
  assert.equal(result.safeCreateOk, true, JSON.stringify(result));
  port.nodeId = result.publicSceneLocator.nodeId;
  port.sandbox.currentFilePath = path.join(projectRoot, 'roman', 'Imported', fs.readdirSync(path.join(projectRoot, 'roman', 'Imported')).find(name => name.endsWith('.txt')));
  const record = await safe.readDocxImportAttempt({ projectRoot, projectId: binding.projectId });
  const payload = { action: 'acknowledge-open', requestId: record.record.requestId, projectId: binding.projectId, nodeId: port.nodeId };
  return { ...port, payload, record, plan, binding,
    read: () => safe.readDocxImportAttempt({ projectRoot, projectId: binding.projectId }),
    setContinuity: value => { continuity = value; }, setContext: value => { context = value; },
    onSnapshot: fn => { beforeSnapshot = fn; }, onContinuity: fn => { beforeContinuity = fn; }, saves: () => saves,
  };
}

test('Main actual accepted import ACK clears only after verified receipt, live scene and successful continuity', async t => {
  const h = await acknowledgedImportHarness(t);
  h.setContinuity(false);
  const failed = await h.handleDocxImportSafeCreateCommandSurface(h.payload);
  assert.equal(failed.ok, false); assert.equal((await h.read()).sha256, h.record.sha256);
  h.setContinuity(true);
  const acknowledged = await h.handleDocxImportSafeCreateCommandSurface(h.payload);
  assert.equal(acknowledged.acknowledged, true, JSON.stringify(acknowledged)); assert.equal(acknowledged.cleared, true);
  assert.equal((await h.read()).record, null); assert.equal(h.saves(), 2);
});

for (const fault of ['nonce', 'project', 'locator', 'extra-plan', 'dirty', 'snapshot-context', 'continuity-generation', 'content']) {
  test(`Main ACK refuses ${fault} and retains the exact accepted record`, async t => {
    const h = await acknowledgedImportHarness(t), input = { ...h.payload };
    if (fault === 'nonce') input.requestId = 'different';
    if (fault === 'project') input.projectId = 'different';
    if (fault === 'locator') input.nodeId = 'tree-node-' + 'f'.repeat(32);
    if (fault === 'extra-plan') input.docxImportPreviewPlan = h.plan;
    if (fault === 'dirty') h.sandbox.isDirty = true;
    if (fault === 'snapshot-context') h.onSnapshot(() => h.setContext('B'));
    if (fault === 'continuity-generation') h.onContinuity(() => h.sandbox.lastSignaledEditGeneration++);
    if (fault === 'content') h.sandbox.treeSceneSnapshotsEqual = async () => false;
    const result = await h.handleDocxImportSafeCreateCommandSurface(input);
    assert.equal(result.ok, false, JSON.stringify(result));
    assert.equal((await h.read()).sha256, h.record.sha256);
  });
}

for (const mutation of ['text', 'metadata', 'cards', 'marks']) {
  test(`actual imported-open composer ACK rejects changed ${mutation}`, async t => {
    const h = await acknowledgedImportHarness(t);
    const envelope = require('../../src/core/document-content-envelope-v1.cjs');
    const snapshot = h.sandbox.requestEditorSnapshot;
    h.sandbox.requestEditorSnapshot = async () => {
      const live = await snapshot(), parsed = envelope.parseObservablePayload(live.content);
      if (mutation === 'text') parsed.doc.content[0].content[0].text += ' changed';
      if (mutation === 'metadata') parsed.meta.synopsis = 'unsaved synopsis';
      if (mutation === 'cards') parsed.cards.push({ title: 'unsaved', text: 'keep', tags: '' });
      if (mutation === 'marks') parsed.doc.content[0].content[0].marks = [{ type: 'bold' }];
      return { ...live, content: envelope.composeObservablePayload({ ...parsed, metaEnabled: true }) };
    };
    assert.equal((await h.handleDocxImportSafeCreateCommandSurface(h.payload)).ok, false);
    assert.equal((await h.read()).sha256, h.record.sha256);
  });
}

test('late acknowledgement A cannot clear a newly accepted durable attempt B', async t => {
  const h = await acknowledgedImportHarness(t);
  const second = await h.handleDocxImportSafeCreateCommandSurface({ requestId: 'docx-import-new-B', docxImportPreviewPlan: h.plan });
  assert.equal(second.safeCreateOk, true, JSON.stringify(second));
  const recordB = await h.read();
  assert.equal(recordB.record.requestId, 'docx-import-new-B'); assert.notEqual(recordB.sha256, h.record.sha256);
  const stale = await h.handleDocxImportSafeCreateCommandSurface(h.payload);
  assert.equal(stale.ok, false); assert.equal(stale.error.code, 'E_DOCX_IMPORT_ACK_STALE');
  assert.equal((await h.read()).sha256, recordB.sha256); assert.equal(h.saves(), 0);
});

test('project change during continuity write retains accepted correlation', async t => {
  const h = await acknowledgedImportHarness(t);
  h.onContinuity(() => h.setContext('other-project'));
  assert.equal((await h.handleDocxImportSafeCreateCommandSurface(h.payload)).ok, false);
  assert.equal((await h.read()).sha256, h.record.sha256);
});
