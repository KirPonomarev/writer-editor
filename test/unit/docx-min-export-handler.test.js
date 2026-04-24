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
