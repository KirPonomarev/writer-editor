import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { runProductionAppRuntimeHarness } from './production-app-runtime-harness.mjs';

const require = createRequire(import.meta.url);
const {
  extractParagraphs,
} = require('../../src/export/docx/docxArtifactValidator.js');

const REQUIRED_DOCX_ENTRIES = Object.freeze([
  '[Content_Types].xml',
  '_rels/.rels',
  'word/document.xml',
]);

const START_MARKER = 'RUNTIME_DOCX_CANONICAL_START_MARKER';
const MIDDLE_MARKER = 'RUNTIME_DOCX_CANONICAL_MIDDLE_MARKER';
const END_MARKER = 'RUNTIME_DOCX_CANONICAL_END_MARKER';

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

function buildCanonicalText() {
  return [
    `${START_MARKER} Canonical runtime DOCX source proof begins.`,
    'Runtime export must read the saved document, not viewport DOM.',
    `${MIDDLE_MARKER} Canonical runtime DOCX source proof continues.`,
    'The document is opened through the existing document command route and saved before export.',
    `${END_MARKER} Canonical runtime DOCX source proof ends.`,
  ].join('\n\n');
}

function createExportProbeSource(outPath) {
  const canonicalText = buildCanonicalText();
  return `(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const command = (commandId, payload = {}) => window.electronAPI.invokeUiCommandBridge({
      route: 'command.bus',
      commandId,
      payload,
    });
    const findCanonicalDocumentNode = (node) => {
      if (!node || typeof node !== 'object') return null;
      if (
        typeof node.path === 'string'
        && node.path.endsWith('.txt')
        && (node.name === 'черновик' || node.label === 'черновик')
      ) return node;
      const children = Array.isArray(node.children) ? node.children : [];
      for (const child of children) {
        const found = findCanonicalDocumentNode(child);
        if (found) return found;
      }
      return null;
    };
    const setEditorText = (text) => {
      const prose = document.querySelector('.ProseMirror');
      if (!prose) return { ok: false, reason: 'PROSEMIRROR_MISSING' };
      prose.focus();
      document.execCommand('selectAll', false, null);
      const inserted = document.execCommand('insertText', false, text);
      return {
        ok: inserted === true,
        textLength: (prose.textContent || '').length,
        containsStartMarker: (prose.textContent || '').includes(${JSON.stringify(START_MARKER)}),
        containsMiddleMarker: (prose.textContent || '').includes(${JSON.stringify(MIDDLE_MARKER)}),
        containsEndMarker: (prose.textContent || '').includes(${JSON.stringify(END_MARKER)}),
      };
    };

    const treeResult = await window.electronAPI.invokeWorkspaceQueryBridge({
      queryId: 'query.projectTree',
      payload: { tab: 'roman' },
    });
    if (!treeResult || treeResult.ok === false) {
      return { ok: 0, stage: 'projectTree', treeResult };
    }
    const documentNode = findCanonicalDocumentNode(treeResult.root);
    if (!documentNode) {
      return { ok: 0, stage: 'findCanonicalDocumentNode', treeResult };
    }
    const openResult = await command('cmd.project.document.open', {
      path: documentNode.path,
      title: documentNode.label || documentNode.name || 'runtime-docx-canonical',
      kind: documentNode.kind,
    });
    if (!openResult || openResult.ok !== true) {
      return { ok: 0, stage: 'openDocument', openResult };
    }
    await sleep(300);
    const editResult = setEditorText(${JSON.stringify(canonicalText)});
    if (!editResult.ok) {
      return { ok: 0, stage: 'setEditorText', editResult };
    }
    await window.electronAPI.invokeSaveLifecycleSignalBridge({
      signalId: 'signal.localDirty.set',
      payload: { state: true },
    });
    await sleep(100);
    const saveResult = await command('cmd.project.save', {});
    if (!saveResult || saveResult.ok !== true) {
      return { ok: 0, stage: 'saveDocument', saveResult, editResult };
    }
    const exportValue = await window.electronAPI.exportDocxMin({
      requestId: '05ad-production-runtime-smoke',
      outPath: ${JSON.stringify(outPath)},
      outDir: '',
      bufferSource: 'stale buffer source must not be exported',
      viewportDomText: 'stale viewport DOM source must not be exported',
      visibleWindowText: 'stale visible window source must not be exported',
      options: { bookProfile: { formatId: 'A4' } }
    });
    return { ok: 1, value: exportValue, editResult, saveResult };
  })().catch((error) => ({
    ok: 0,
    stage: 'exception',
    message: error && error.message ? error.message : String(error)
  }))`;
}

async function validateDocx(outPath) {
  const buffer = await fs.readFile(outPath);
  const entries = parseStoredZipLocalEntries(buffer);
  const storedEntries = new Map();
  let offset = 0;

  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLength;
    const dataStart = nameEnd + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (nameEnd > buffer.length || dataEnd > buffer.length) break;
    storedEntries.set(buffer.slice(nameStart, nameEnd).toString('utf8'), buffer.slice(dataStart, dataEnd));
    offset = dataEnd;
  }
  const documentXml = storedEntries.get('word/document.xml')?.toString('utf8') || '';
  const docxText = extractParagraphs(documentXml).map((paragraph) => paragraph.text).join('\n');

  return {
    size: buffer.length,
    zipMagic: buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b,
    entries,
    requiredEntriesPresent: REQUIRED_DOCX_ENTRIES.every((entry) => entries.includes(entry)),
    docxText,
    markersPresent: [START_MARKER, MIDDLE_MARKER, END_MARKER].every((marker) => docxText.includes(marker)),
    markerOrderOk: docxText.indexOf(START_MARKER) >= 0
      && docxText.indexOf(START_MARKER) < docxText.indexOf(MIDDLE_MARKER)
      && docxText.indexOf(MIDDLE_MARKER) < docxText.indexOf(END_MARKER),
    staleBufferAbsent: !docxText.includes('stale buffer source'),
    staleViewportDomAbsent: !docxText.includes('stale viewport DOM source'),
    staleVisibleWindowAbsent: !docxText.includes('stale visible window source'),
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

  assert.equal(result.runtimeKind, 'production-app-runtime-harness');
  assert.equal(result.timedOut, false);
  assert.equal(result.exitCode, 0);
  assert.equal(result.ok, true);
  assert.equal(payload.appReady, true);
  assert.equal(payload.windowCount, 1);
  assert.equal(payload.loadComplete, true);
  assert.equal(payload.networkRequests, 0);
  assert.equal(payload.dialogCalls, 0);
  assert.equal(exportProbe.ok, 1, JSON.stringify(exportProbe, null, 2));
  assert.equal(exportValue.ok, 1, JSON.stringify(exportProbe, null, 2));
  const validation = await validateDocx(outPath);
  assert.equal(exportValue.outPath, outPath);
  assert.equal(Number.isInteger(exportValue.bytesWritten), true);
  assert.equal(exportValue.bytesWritten > 0, true);
  assert.equal(validation.size > 0, true);
  assert.equal(validation.zipMagic, true);
  assert.equal(validation.requiredEntriesPresent, true);
  assert.equal(validation.markersPresent, true);
  assert.equal(validation.markerOrderOk, true);
  assert.equal(validation.staleBufferAbsent, true);
  assert.equal(validation.staleViewportDomAbsent, true);
  assert.equal(validation.staleVisibleWindowAbsent, true);

  process.stdout.write('DOCX_MIN_EXPORT_PRODUCTION_RUNTIME_CANONICAL_SOURCE_SMOKE_OK=1\n');
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
