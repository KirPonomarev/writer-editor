import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { runProductionAppRuntimeHarness } from './production-app-runtime-harness.mjs';

const REQUIRED_DOCX_ENTRIES = Object.freeze([
  '[Content_Types].xml',
  '_rels/.rels',
  'word/document.xml',
]);

function parseStoredZipLocalEntries(buffer) {
  const entries = [];
  let offset = 0;

  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > buffer.length) break;

    entries.push(buffer.slice(nameStart, nameEnd).toString('utf8'));
    offset = nameEnd + extraLength + compressedSize;
  }

  return entries;
}

function createExportProbeSource(outPath) {
  return `(() => window.electronAPI.exportDocxMin({
    requestId: '05ad-production-runtime-smoke',
    outPath: ${JSON.stringify(outPath)},
    outDir: '',
    bufferSource: 'Tiny runtime DOCX proof text.',
    options: { bookProfile: { formatId: 'A4' } }
  }).then((value) => ({ ok: 1, value }))
    .catch((error) => ({
      ok: 0,
      message: error && error.message ? error.message : String(error)
    })))()`;
}

async function validateDocx(outPath) {
  const buffer = await fs.readFile(outPath);
  const entries = parseStoredZipLocalEntries(buffer);

  return {
    size: buffer.length,
    zipMagic: buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b,
    entries,
    requiredEntriesPresent: REQUIRED_DOCX_ENTRIES.every((entry) => entries.includes(entry)),
  };
}

let tempRoot = '';
let outPath = '';

try {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'yalken-docx-min-runtime-smoke-'));
  const outDir = path.join(tempRoot, 'out');
  await fs.mkdir(outDir, { recursive: true });
  outPath = path.join(outDir, 'runtime-proof.docx');

  const result = await runProductionAppRuntimeHarness({
    timeoutMs: 10000,
    rendererProbeLabel: 'docxMinExport',
    rendererProbeSource: createExportProbeSource(outPath),
  });
  const payload = result.result || {};
  const exportProbe = payload.rendererProbe || {};
  const exportValue = exportProbe.value || {};
  const validation = await validateDocx(outPath);

  assert.equal(result.runtimeKind, 'production-app-runtime-harness');
  assert.equal(result.timedOut, false);
  assert.equal(result.exitCode, 0);
  assert.equal(result.ok, true);
  assert.equal(payload.appReady, true);
  assert.equal(payload.windowCount, 1);
  assert.equal(payload.loadComplete, true);
  assert.equal(payload.networkRequests, 0);
  assert.equal(payload.dialogCalls, 0);
  assert.equal(exportProbe.ok, 1);
  assert.equal(exportValue.ok, 1);
  assert.equal(exportValue.outPath, outPath);
  assert.equal(Number.isInteger(exportValue.bytesWritten), true);
  assert.equal(exportValue.bytesWritten > 0, true);
  assert.equal(validation.size > 0, true);
  assert.equal(validation.zipMagic, true);
  assert.equal(validation.requiredEntriesPresent, true);

  process.stdout.write('DOCX_MIN_EXPORT_PRODUCTION_RUNTIME_SMOKE_OK=1\n');
} finally {
  if (tempRoot) {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

if (outPath) {
  await assert.rejects(
    fs.access(outPath),
    (error) => error && error.code === 'ENOENT',
  );
}
