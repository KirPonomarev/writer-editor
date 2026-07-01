import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { runProductionAppRuntimeHarness } from './production-app-runtime-harness.mjs';

function readStoredZipEntry(buffer, entryName) {
  let offset = 0;

  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > buffer.length) break;

    const name = buffer.slice(nameStart, nameEnd).toString('utf8');
    const dataStart = nameEnd + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (name === entryName) {
      return buffer.slice(dataStart, dataEnd).toString('utf8');
    }
    offset = dataEnd;
  }

  return '';
}

const LANDSCAPE_PROOF_TEXT = 'Tiny landscape runtime DOCX proof text.';

function createLandscapeExportProbeSource(outPath) {
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
        containsProofText: (prose.textContent || '').includes(${JSON.stringify(LANDSCAPE_PROOF_TEXT)}),
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
      title: documentNode.label || documentNode.name || 'landscape-runtime-docx',
      kind: documentNode.kind,
    });
    if (!openResult || openResult.ok !== true) {
      return { ok: 0, stage: 'openDocument', openResult };
    }
    await sleep(300);
    const editResult = setEditorText(${JSON.stringify(LANDSCAPE_PROOF_TEXT)});
    if (!editResult.ok || !editResult.containsProofText) {
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
      requestId: '05af-landscape-runtime-smoke',
      outPath: ${JSON.stringify(outPath)},
      outDir: '',
      bufferSource: 'stale buffer source must not be exported',
      options: { bookProfile: { formatId: 'A4', orientation: 'landscape' } }
    });
    return { ok: 1, value: exportValue, editResult, saveResult };
  })().catch((error) => ({
    ok: 0,
    stage: 'exception',
    message: error && error.message ? error.message : String(error)
  }))`;
}

async function validateLandscapeDocx(outPath) {
  const buffer = await fs.readFile(outPath);
  const documentXml = readStoredZipEntry(buffer, 'word/document.xml');
  const pageSize = documentXml.match(/<w:pgSz w:w="(\d+)" w:h="(\d+)" w:orient="landscape"\/>/u);

  return {
    size: buffer.length,
    zipMagic: buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b,
    documentXmlFound: documentXml.length > 0,
    proofTextPresent: documentXml.includes('Tiny landscape runtime DOCX proof text.'),
    staleBufferAbsent: !documentXml.includes('stale buffer source'),
    landscapeOrient: Boolean(pageSize),
    widthGreaterThanHeight: Boolean(pageSize && Number(pageSize[1]) > Number(pageSize[2])),
  };
}

let tempRoot = '';
let outPath = '';

try {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'yalken-docx-landscape-runtime-smoke-'));
  const outDir = path.join(tempRoot, 'out');
  await fs.mkdir(outDir, { recursive: true });
  outPath = path.join(outDir, 'landscape-runtime-proof.docx');

  const result = await runProductionAppRuntimeHarness({
    timeoutMs: 10000,
    rendererProbeLabel: 'docxLandscapeExport',
    rendererProbeSource: createLandscapeExportProbeSource(outPath),
  });
  const payload = result.result || {};
  const exportProbe = payload.rendererProbe || {};
  const exportValue = exportProbe.value || {};
  const validation = await validateLandscapeDocx(outPath);

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
  assert.equal(exportValue.outPath, outPath);
  assert.equal(Number.isInteger(exportValue.bytesWritten), true);
  assert.equal(exportValue.bytesWritten > 0, true);
  assert.equal(validation.size > 0, true);
  assert.equal(validation.zipMagic, true);
  assert.equal(validation.documentXmlFound, true);
  assert.equal(validation.proofTextPresent, true);
  assert.equal(validation.staleBufferAbsent, true);
  assert.equal(validation.landscapeOrient, true);
  assert.equal(validation.widthGreaterThanHeight, true);

  process.stdout.write('DOCX_LANDSCAPE_PRODUCTION_RUNTIME_SMOKE_OK=1\n');
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
