const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('DOCX import preview UI flow: existing modal surface exposes preview and accept hooks', () => {
  const html = read('src/renderer/index.html');
  const editor = read('src/renderer/editor.js');

  for (const marker of [
    'data-docx-import-preview-modal',
    'data-docx-import-preview-message',
    'data-docx-import-preview-loss',
    'data-docx-import-preview-cancel',
    'data-docx-import-preview-confirm',
  ]) {
    assert.ok(html.includes(marker), marker);
    assert.ok(editor.includes(marker), marker);
  }

  assert.ok(editor.includes('function openDocxImportPreviewFlow()'));
  assert.ok(editor.includes('function confirmDocxImportPreviewAndRun()'));
  assert.ok(editor.includes("const importDocxCommandId = 'cmd.project.importDocxV1';"));
  assert.ok(editor.includes('normalizedCommandId === importDocxCommandId'));
  assert.ok(editor.includes('dispatchUiCommand(COMMAND_IDS.PROJECT_IMPORT_DOCX_V1, {'));
  assert.ok(editor.includes('accept: true,'));
  assert.ok(editor.includes('localFilePreview: previewValue?.localFilePreview || null,'));
  assert.ok(editor.includes('docxContentPreviewReport: previewValue?.docxContentPreviewReport'));
  assert.ok(editor.includes('docxImportPreviewPlan: plan,'));
  assert.ok(editor.includes('await loadTree();'));
});

test('DOCX import preview UI flow: no editor-surface mutation is introduced by import accept', () => {
  const editor = read('src/renderer/editor.js');
  const start = editor.indexOf('async function confirmDocxImportPreviewAndRun()');
  const end = editor.indexOf('function applyCollabGate()', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const section = editor.slice(start, end);

  for (const forbidden of [
    'setPlainText(',
    'setContent(',
    'window.electronAPI.invokeUiCommandBridge',
    'currentDocumentPath =',
  ]) {
    assert.equal(section.includes(forbidden), false, forbidden);
  }
});

test('DOCX import preview UI flow: shell reset and restore clear pending accept state', () => {
  const editor = read('src/renderer/editor.js');
  for (const functionName of ['performSafeResetShell', 'performRestoreLastStableShell']) {
    const start = editor.indexOf(`function ${functionName}()`);
    assert.notEqual(start, -1, functionName);
    const end = editor.indexOf('updateWordCount();', start);
    assert.notEqual(end, -1, functionName);
    const section = editor.slice(start, end);
    assert.ok(section.includes('closeDocxImportPreviewModal();'), functionName);
  }
});

test('DOCX import preview UI flow: generated bundle carries the shipped DOCX accept path', () => {
  const bundle = read('src/renderer/editor.bundle.js');
  for (const marker of [
    'cmd.project.docx.previewImportPlan',
    'cmd.project.docx.importSafeCreate',
    'cmd.project.importDocxV1',
    'docxContentPreviewReport',
    'localFilePreview',
  ]) {
    assert.ok(bundle.includes(marker), marker);
  }
});
