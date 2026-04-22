const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `missing block: ${startMarker}`);
  return source.slice(start, end);
}

test('layout preview command binding: preview controls are routed through commands, not raw DOM behavior', () => {
  const editor = read('src/renderer/editor.js');
  const runtimeBridge = read('src/renderer/tiptap/runtimeBridge.js');

  const previewCommandSnippet = sliceBetween(
    editor,
    'const PREVIEW_FORMAT_COMMAND_IDS = Object.freeze({',
    'const commandPaletteDataProvider = createPaletteDataProvider',
  );
  assert.ok(previewCommandSnippet.includes("A4: 'cmd.project.view.previewFormatA4'"));
  assert.ok(previewCommandSnippet.includes("A5: 'cmd.project.view.previewFormatA5'"));
  assert.ok(previewCommandSnippet.includes("LETTER: 'cmd.project.view.previewFormatLetter'"));
  assert.ok(previewCommandSnippet.includes('setActiveBookProfileFormat(formatId);'));
  assert.equal(previewCommandSnippet.includes('setPreviewChromeFormat(formatId);'), false);
  assert.ok(editor.includes('togglePreview: () => handleToggleLayoutPreview(),'));
  assert.ok(editor.includes('togglePreviewFrame: () => handleToggleLayoutPreviewFrame(),'));

  const exportPreviewSnippet = sliceBetween(
    editor,
    'function openExportPreviewModal() {',
    'function applyCollabGate() {',
  );
  assert.ok(exportPreviewSnippet.includes("exportPreviewMessage.textContent = 'DOCX baseline export. Confirm to continue.';"));
  assert.ok(exportPreviewSnippet.includes('await dispatchUiCommand(COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN);'));

  const exportPreviewListenerSnippet = sliceBetween(
    editor,
    'exportPreviewConfirmButtons.forEach((button) => {',
    'diagnosticsCloseButtons.forEach((button) => {',
  );
  assert.ok(exportPreviewListenerSnippet.includes('void confirmExportPreviewAndRun();'));
  assert.equal(exportPreviewListenerSnippet.includes('openExportPreviewModal();'), false);

  const runtimeCommandSnippet = sliceBetween(
    editor,
    'window.electronAPI.onRuntimeCommand((payload) => {',
    '});',
  );
  assert.ok(runtimeCommandSnippet.includes("command === 'open-export-preview'"));
  assert.ok(runtimeCommandSnippet.includes("command === 'switch-preview-format-a4'"));
  assert.ok(runtimeCommandSnippet.includes('dispatchUiCommand(PREVIEW_FORMAT_COMMAND_IDS.A4)'));
  assert.ok(runtimeCommandSnippet.includes('dispatchUiCommand(PREVIEW_FORMAT_COMMAND_IDS.A5)'));
  assert.ok(runtimeCommandSnippet.includes('dispatchUiCommand(PREVIEW_FORMAT_COMMAND_IDS.LETTER)'));
  assert.ok(runtimeCommandSnippet.includes("command === 'toggle-preview'"));
  assert.ok(runtimeCommandSnippet.includes('dispatchUiCommand(EXTRA_COMMAND_IDS.VIEW_TOGGLE_PREVIEW)'));
  assert.ok(runtimeCommandSnippet.includes("command === 'toggle-preview-frame'"));
  assert.ok(runtimeCommandSnippet.includes('dispatchUiCommand(EXTRA_COMMAND_IDS.VIEW_TOGGLE_PREVIEW_FRAME)'));

  const runtimeBridgeSnippet = sliceBetween(
    runtimeBridge,
    "if (commandId === 'cmd.project.export.docxMin' && payload.preview === true) {",
    '  return { handled: false, result: null }',
  );
  assert.ok(runtimeBridgeSnippet.includes('runBridgeCallback(runtimeHandlers.openExportPreview, commandId)'));
  assert.equal(runtimeBridgeSnippet.includes('document'), false);
  assert.equal(runtimeBridgeSnippet.includes('window'), false);
});
