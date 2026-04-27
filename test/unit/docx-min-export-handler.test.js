const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { runDocxMinExport } = require('../../src/export/docx/docxMinExportHandler');

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

test('docx min export handler uses explicit outPath and injected write port', async () => {
  const calls = {
    requestEditorSnapshot: 0,
    writes: [],
  };
  const documentBuffer = Buffer.from('docx-min-buffer');
  const payload = {
    requestId: 'req-1',
    outPath: '/tmp/yalken-export.docx',
    outDir: '',
    bufferSource: 'Horizontal sheet export text',
    options: {
      bookProfile: { formatId: 'A4' },
    },
  };

  const result = await runDocxMinExport(payload, {
    normalizeExportPayload(input) {
      calls.normalizedInput = input;
      return input;
    },
    makeTypedExportError,
    resolveDocxExportPath(input) {
      calls.resolvedPayload = input;
      return input.outPath;
    },
    async requestEditorSnapshot() {
      calls.requestEditorSnapshot += 1;
      return {
        content: 'fallback',
        plainText: 'fallback',
        bookProfile: null,
      };
    },
    async buildDocxMinBuffer(snapshot) {
      calls.builderSnapshot = snapshot;
      return documentBuffer;
    },
    async queueDiskOperation(operation, label) {
      calls.queueLabel = label;
      return operation();
    },
    async writeBufferAtomic(outPath, buffer) {
      calls.writes.push({ outPath, buffer });
    },
    updateStatus(message) {
      calls.status = message;
    },
  });

  assert.deepEqual(result, {
    ok: 1,
    outPath: '/tmp/yalken-export.docx',
    bytesWritten: documentBuffer.length,
  });
  assert.equal(calls.normalizedInput, payload);
  assert.equal(calls.resolvedPayload, payload);
  assert.equal(calls.requestEditorSnapshot, 0);
  assert.deepEqual(calls.builderSnapshot, {
    content: 'Horizontal sheet export text',
    plainText: 'Horizontal sheet export text',
    bookProfile: { formatId: 'A4' },
  });
  assert.equal(calls.queueLabel, 'export docx min');
  assert.equal(calls.writes.length, 1);
  assert.equal(calls.writes[0].outPath, '/tmp/yalken-export.docx');
  assert.equal(calls.writes[0].buffer, documentBuffer);
  assert.equal(calls.status, 'DOCX MIN экспортирован');
});

test('docx min export handler returns canceled without builder or write port call', async () => {
  const calls = {
    buildDocxMinBuffer: 0,
    writeBufferAtomic: 0,
  };

  const result = await runDocxMinExport({
    requestId: 'req-canceled',
    outPath: '',
    outDir: '',
    bufferSource: 'unused',
    options: {},
  }, {
    normalizeExportPayload(input) {
      return input;
    },
    makeTypedExportError,
    resolveDocxExportPath() {
      return '';
    },
    async requestEditorSnapshot() {
      throw new Error('should not request snapshot');
    },
    async buildDocxMinBuffer() {
      calls.buildDocxMinBuffer += 1;
      return Buffer.from('should-not-build');
    },
    async queueDiskOperation(operation) {
      return operation();
    },
    async writeBufferAtomic() {
      calls.writeBufferAtomic += 1;
    },
    updateStatus() {},
  });

  assert.equal(result.ok, 0);
  assert.equal(result.error.code, 'E_EXPORT_CANCELED');
  assert.equal(result.error.reason, 'EXPORT_DIALOG_CANCELED');
  assert.deepEqual(result.error.details, { requestId: 'req-canceled' });
  assert.equal(calls.buildDocxMinBuffer, 0);
  assert.equal(calls.writeBufferAtomic, 0);
});

test('docx min export handler can write through a temp-only injected filesystem port with cleanup', async () => {
  const documentBuffer = Buffer.from('docx-min-temp-buffer');
  let tempDir = '';
  let outPath = '';

  try {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yalken-docx-export-'));
    outPath = path.join(tempDir, 'export.docx');

    const result = await runDocxMinExport({
      requestId: 'req-temp',
      outPath,
      outDir: '',
      bufferSource: 'Horizontal sheet temp export text',
      options: {},
    }, {
      normalizeExportPayload(input) {
        return input;
      },
      makeTypedExportError,
      resolveDocxExportPath(input) {
        return input.outPath;
      },
      async requestEditorSnapshot() {
        throw new Error('should not request snapshot');
      },
      async buildDocxMinBuffer() {
        return documentBuffer;
      },
      async queueDiskOperation(operation) {
        return operation();
      },
      async writeBufferAtomic(targetPath, buffer) {
        await fs.writeFile(targetPath, buffer);
      },
      updateStatus() {},
    });

    assert.deepEqual(result, {
      ok: 1,
      outPath,
      bytesWritten: documentBuffer.length,
    });
    assert.equal(await fs.readFile(outPath, 'utf8'), documentBuffer.toString('utf8'));
  } finally {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }

  await assert.rejects(
    fs.access(outPath),
    (error) => error && error.code === 'ENOENT',
  );
});

test('docx min export handler surfaces revision bridge manifest-binding evidence for ready export', async () => {
  const documentBuffer = Buffer.from('docx-min-rb-buffer');
  const enrichedSnapshot = {
    content: 'Scene one',
    plainText: 'Scene one',
    bookProfile: { formatId: 'A4' },
    projectId: 'project-1',
    baselineHash: 'baseline-1',
    docFingerprintPlan: 'doc-fingerprint-1',
    sourceVersion: 'project-manifest:v1',
    exportedAtUtc: '2026-04-27T10:00:00.000Z',
    sceneOrder: ['scene-1'],
    sceneBaselines: [{ sceneId: 'scene-1' }],
    blockBaselines: [{ blockInstanceId: 'block-1' }],
  };
  const calls = {
    writes: [],
  };

  const result = await runDocxMinExport({
    requestId: 'rb-ready',
    outPath: '/tmp/rb-ready.docx',
    outDir: '',
    bufferSource: 'Scene one',
    options: {},
  }, {
    normalizeExportPayload(input) {
      return input;
    },
    makeTypedExportError,
    resolveDocxExportPath(input) {
      return input.outPath;
    },
    async requestEditorSnapshot() {
      throw new Error('should not request snapshot');
    },
    async enrichRevisionBridgeExportSnapshot(snapshot, payload) {
      calls.enrichArgs = { snapshot, payload };
      return enrichedSnapshot;
    },
    evaluateRevisionBridgeExportRuntimeSnapshot(snapshot) {
      calls.evaluatedSnapshot = snapshot;
      return {
        ok: true,
        status: 'ready',
        code: 'REVISION_BRIDGE_REVIEWGRAPH_VALID',
        reason: 'REVISION_BRIDGE_REVIEWGRAPH_VALID',
        requiredFields: [],
        reasons: [],
      };
    },
    buildRevisionBridgeExportManifest(snapshot, manifestInput) {
      calls.manifestArgs = { snapshot, manifestInput };
      return {
        schemaVersion: 'revision-bridge.export-manifest.v1',
        kind: 'ExportManifest',
        id: manifestInput.id,
        projectId: snapshot.projectId,
        baselineHash: snapshot.baselineHash,
        docFingerprint: snapshot.docFingerprintPlan,
        sourceVersion: manifestInput.sourceVersion,
        sceneOrder: snapshot.sceneOrder,
        scenes: snapshot.sceneBaselines,
        blocks: snapshot.blockBaselines,
      };
    },
    async buildDocxMinBuffer(snapshot) {
      calls.builderSnapshot = snapshot;
      return documentBuffer;
    },
    async queueDiskOperation(operation) {
      return operation();
    },
    async writeBufferAtomic(outPath, buffer) {
      calls.writes.push({ outPath, buffer });
    },
    updateStatus() {},
  });

  assert.equal(result.ok, 1);
  assert.equal(result.bytesWritten, documentBuffer.length);
  assert.deepEqual(calls.builderSnapshot, enrichedSnapshot);
  assert.equal(result.revisionBridge.readiness.status, 'ready');
  assert.deepEqual(result.revisionBridge.exportManifest, {
    schemaVersion: 'revision-bridge.export-manifest.v1',
    kind: 'ExportManifest',
    id: 'rb-ready',
    projectId: 'project-1',
    baselineHash: 'baseline-1',
    docFingerprint: 'doc-fingerprint-1',
    sourceVersion: 'project-manifest:v1',
    sceneOrder: ['scene-1'],
    sceneCount: 1,
    blockCount: 1,
  });
  assert.equal(calls.writes.length, 1);
});

test('docx min export handler keeps revision bridge evidence non-ready without enrichment', async () => {
  const documentBuffer = Buffer.from('docx-min-advisory-buffer');
  const result = await runDocxMinExport({
    requestId: 'rb-advisory',
    outPath: '/tmp/rb-advisory.docx',
    outDir: '',
    bufferSource: 'Advisory text',
    options: {},
  }, {
    normalizeExportPayload(input) {
      return input;
    },
    makeTypedExportError,
    resolveDocxExportPath(input) {
      return input.outPath;
    },
    async requestEditorSnapshot() {
      throw new Error('should not request snapshot');
    },
    evaluateRevisionBridgeExportRuntimeSnapshot(snapshot) {
      assert.deepEqual(snapshot, {
        content: 'Advisory text',
        plainText: 'Advisory text',
        bookProfile: null,
      });
      return {
        ok: false,
        status: 'advisory',
        code: 'E_REVISION_BRIDGE_REVIEWGRAPH_INVALID',
        reason: 'E_REVISION_BRIDGE_REVIEWGRAPH_INVALID',
        requiredFields: ['projectId'],
        reasons: [{ field: 'projectId', code: 'missing_field', message: 'projectId is required' }],
      };
    },
    buildRevisionBridgeExportManifest() {
      throw new Error('manifest must not build when readiness is false');
    },
    async buildDocxMinBuffer() {
      return documentBuffer;
    },
    async queueDiskOperation(operation) {
      return operation();
    },
    async writeBufferAtomic() {},
    updateStatus() {},
  });

  assert.equal(result.ok, 1);
  assert.equal(result.revisionBridge.readiness.ok, false);
  assert.equal(result.revisionBridge.readiness.status, 'advisory');
  assert.equal(Object.prototype.hasOwnProperty.call(result.revisionBridge, 'exportManifest'), false);
});

test('docx min export handler omits revision bridge evidence on early typed failure', async () => {
  const result = await runDocxMinExport({
    requestId: 'rb-path-fail',
    outPath: '/tmp/rb-path-fail.docx',
    outDir: '',
    bufferSource: 'unused',
    options: {},
  }, {
    normalizeExportPayload() {
      return {
        requestId: 'rb-path-fail',
        pathBoundaryError: { failSignal: 'E_PATH_BOUNDARY_VIOLATION' },
      };
    },
    makeTypedExportError,
    resolveDocxExportPath() {
      throw new Error('should not resolve path');
    },
    async requestEditorSnapshot() {
      throw new Error('should not request snapshot');
    },
    async buildDocxMinBuffer() {
      throw new Error('should not build');
    },
    async queueDiskOperation(operation) {
      return operation();
    },
    async writeBufferAtomic() {},
    updateStatus() {},
  });

  assert.equal(result.ok, 0);
  assert.equal(result.error.code, 'E_PATH_BOUNDARY_VIOLATION');
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'revisionBridge'), false);
});

test('docx min export source binding: main.js wires revision bridge enrichment into handler seam', async () => {
  const mainText = await fs.readFile(path.join(process.cwd(), 'src', 'main.js'), 'utf8');

  assert.match(mainText, /function loadRevisionBridgeModule\(/u);
  assert.match(mainText, /async function enrichRevisionBridgeExportSnapshot\(/u);
  assert.match(mainText, /enrichRevisionBridgeExportSnapshot,/u);
  assert.match(mainText, /evaluateRevisionBridgeExportRuntimeSnapshot:\s*revisionBridgeModule\.evaluateRevisionBridgeExportRuntimeSnapshot/u);
  assert.match(mainText, /buildRevisionBridgeExportManifest:\s*revisionBridgeModule\.buildRevisionBridgeExportManifest/u);
});
