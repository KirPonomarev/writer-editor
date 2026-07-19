const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPdfPrintHtml,
  runPdfExport,
} = require('../../src/export/pdf/pdfExportHandler');

test('PDF export print projection uses BookProfile page geometry and no app chrome', () => {
  const html = buildPdfPrintHtml({
    bookProfile: {
      formatId: 'A5',
      widthMm: 148,
      heightMm: 210,
      orientation: 'portrait',
      marginTopMm: 20,
      marginRightMm: 18,
      marginBottomMm: 22,
      marginLeftMm: 18,
    },
    scenes: [
      {
        sceneId: 'roman/scene-one.txt',
        title: 'Scene One',
        text: 'First paragraph.\n\nSecond paragraph.',
      },
      {
        sceneId: 'roman/scene-two.txt',
        title: 'Scene Two',
        text: 'Next scene.',
      },
    ],
  });

  assert.ok(html.includes('data-yalken-pdf-print-projection="isolated"'));
  assert.ok(html.includes('size: 148mm 210mm;'));
  assert.ok(html.includes('margin: 20mm 18mm 22mm 18mm;'));
  assert.ok(html.includes('content: counter(page);'));
  assert.ok(html.includes('class="yalken-pdf-scene-separator"'));
  assert.ok(html.includes('Scene One'));
  assert.ok(html.includes('Second paragraph.'));

  for (const forbidden of [
    'ProseMirror',
    'toolbar',
    'navigator',
    'sidebar',
    'modal__content',
    'data-toolbar',
  ]) {
    assert.equal(html.includes(forbidden), false, forbidden);
  }
});

test('PDF export writes rendered buffer atomically from saved canonical scenes', async () => {
  const calls = {
    renderedHtml: '',
    targetChecks: 0,
    writtenPath: '',
    writtenBuffer: null,
    status: '',
  };
  const result = await runPdfExport(
    {
      confirmed: true,
      requestId: 'pdf-test',
      outPath: '/tmp/yalken-test.pdf',
    },
    {
      normalizePdfExportPayload(payload) {
        return {
          confirmed: payload.confirmed === true,
          requestId: payload.requestId,
          outPath: payload.outPath,
        };
      },
      makeTypedPdfExportError(code, reason, details) {
        return { ok: false, error: { code, reason, details } };
      },
      resolvePdfExportPath(payload) {
        return { canceled: false, outPath: payload.outPath };
      },
      validatePdfExportTarget(outPath, source) {
        calls.targetChecks += 1;
        assert.equal(outPath, '/tmp/yalken-test.pdf');
        assert.deepEqual(source.sourcePaths, ['/project/roman/one.txt']);
        return { ok: true, outPath };
      },
      readCanonicalPdfExportSource() {
        return {
          projectRoot: '/project',
          sourcePaths: ['/project/roman/one.txt'],
          bookProfile: {
            widthMm: 210,
            heightMm: 297,
            marginTopMm: 25.4,
            marginRightMm: 25.4,
            marginBottomMm: 25.4,
            marginLeftMm: 25.4,
          },
          scenes: [
            {
              sceneId: 'roman/one.txt',
              title: 'One',
              text: 'Canonical text from disk.',
            },
          ],
        };
      },
      renderPdfBuffer(html) {
        calls.renderedHtml = html;
        return Buffer.from('%PDF-1.7\ncanonical');
      },
      queueDiskOperation(operation, label) {
        assert.equal(label, 'export pdf');
        return operation();
      },
      writeBufferAtomic(outPath, buffer) {
        calls.writtenPath = outPath;
        calls.writtenBuffer = buffer;
      },
      updateStatus(status) {
        calls.status = status;
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.exported, true);
  assert.equal(result.sceneCount, 1);
  assert.equal(result.bytesWritten, Buffer.byteLength('%PDF-1.7\ncanonical'));
  assert.equal(calls.targetChecks, 2);
  assert.equal(calls.writtenPath, '/tmp/yalken-test.pdf');
  assert.ok(Buffer.isBuffer(calls.writtenBuffer));
  assert.ok(calls.renderedHtml.includes('Canonical text from disk.'));
  assert.equal(calls.status, 'PDF экспортирован');
});

test('PDF export returns a typed failure report when renderer authority fields are rejected', async () => {
  const result = await runPdfExport(
    {
      text: 'renderer text must not become source',
    },
    {
      normalizePdfExportPayload() {
        return {
          ok: false,
          code: 'E_EXPORT_PDF_PAYLOAD_INVALID',
          reason: 'pdf_export_renderer_authority_denied',
          details: { fields: ['text'] },
        };
      },
      makeTypedPdfExportError(code, reason, details) {
        return { ok: false, error: { code, reason, details } };
      },
      resolvePdfExportPath() {},
      validatePdfExportTarget() {},
      readCanonicalPdfExportSource() {},
      renderPdfBuffer() {},
      queueDiskOperation() {},
      writeBufferAtomic() {},
      updateStatus() {},
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'E_EXPORT_PDF_PAYLOAD_INVALID');
  assert.equal(result.error.reason, 'pdf_export_renderer_authority_denied');
  assert.deepEqual(result.error.details.fields, ['text']);
});
