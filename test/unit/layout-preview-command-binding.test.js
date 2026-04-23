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
  const html = read('src/renderer/index.html');
  const editor = read('src/renderer/editor.js');
  const projectCommands = read('src/renderer/commands/projectCommands.mjs');
  const capabilityPolicy = read('src/renderer/commands/capabilityPolicy.mjs');
  const runtimeBridge = read('src/renderer/tiptap/runtimeBridge.js');

  assert.ok(html.includes('data-preview-format-control'));
  assert.ok(html.includes('data-preview-format-option="A4"'));
  assert.ok(html.includes('data-preview-format-option="A5"'));
  assert.ok(html.includes('data-preview-format-option="LETTER"'));
  assert.ok(html.includes('data-action="switch-preview-format-a4"'));
  assert.ok(html.includes('data-action="switch-preview-format-a5"'));
  assert.ok(html.includes('data-action="switch-preview-format-letter"'));
  assert.ok(html.includes('data-layout-preview-toggle'));
  assert.ok(html.includes('data-layout-preview-frame-toggle'));

  const previewCommandSnippet = sliceBetween(
    editor,
    'const PREVIEW_FORMAT_COMMAND_IDS = Object.freeze({',
    'const commandPaletteDataProvider = createPaletteDataProvider',
  );
  assert.ok(previewCommandSnippet.includes('A4: EXTRA_COMMAND_IDS.VIEW_PREVIEW_FORMAT_A4'));
  assert.ok(previewCommandSnippet.includes('A5: EXTRA_COMMAND_IDS.VIEW_PREVIEW_FORMAT_A5'));
  assert.ok(previewCommandSnippet.includes('LETTER: EXTRA_COMMAND_IDS.VIEW_PREVIEW_FORMAT_LETTER'));
  assert.equal(previewCommandSnippet.includes('setPreviewChromeFormat(formatId);'), false);
  assert.ok(projectCommands.includes("VIEW_PREVIEW_FORMAT_A4: 'cmd.project.view.previewFormatA4'"));
  assert.ok(projectCommands.includes("VIEW_PREVIEW_FORMAT_A5: 'cmd.project.view.previewFormatA5'"));
  assert.ok(projectCommands.includes("VIEW_PREVIEW_FORMAT_LETTER: 'cmd.project.view.previewFormatLetter'"));
  assert.ok(projectCommands.includes("'switch-preview-format-a5': 'cmd.project.view.previewFormatA5'"));
  assert.ok(projectCommands.includes("runUiAction(uiActions, 'setPreviewFormat', id, { formatId })"));
  assert.ok(capabilityPolicy.includes("'cmd.project.view.previewFormatA5': 'cap.project.view.previewFormatA5'"));
  assert.ok(capabilityPolicy.includes("'cmd.project.view.togglePreview': 'cap.project.view.togglePreview'"));
  assert.ok(capabilityPolicy.includes("'cmd.project.view.togglePreviewFrame': 'cap.project.view.togglePreviewFrame'"));
  assert.ok(editor.includes('togglePreview: () => handleToggleLayoutPreview(),'));
  assert.ok(editor.includes('togglePreviewFrame: () => handleToggleLayoutPreviewFrame(),'));
  assert.ok(editor.includes('setPreviewFormat: ({ formatId } = {}) => setActiveBookProfileFormat(formatId),'));
  assert.ok(editor.includes('setPreviewFormat: (formatId) => setActiveBookProfileFormat(formatId),'));
  assert.ok(editor.includes("const previewFormatButtons = Array.from(document.querySelectorAll('[data-preview-format-option]'));"));
  assert.ok(editor.includes("const layoutPreviewToggleButton = document.querySelector('[data-layout-preview-toggle]');"));
  assert.ok(editor.includes("const layoutPreviewFrameToggleButton = document.querySelector('[data-layout-preview-frame-toggle]');"));

  const syncFormatSnippet = sliceBetween(
    editor,
    'function syncPreviewChromeFormatValue() {',
    'function syncLayoutPreviewControlStates() {',
  );
  assert.ok(syncFormatSnippet.includes("button.dataset.previewFormatOption === activeFormatId"));
  assert.ok(syncFormatSnippet.includes("button.classList.toggle('is-active', isActive);"));
  assert.ok(syncFormatSnippet.includes("button.setAttribute('aria-pressed', isActive ? 'true' : 'false');"));

  const syncPreviewControlSnippet = sliceBetween(
    editor,
    'function syncLayoutPreviewControlStates() {',
    'function setActiveBookProfileFormat(formatId) {',
  );
  assert.ok(syncPreviewControlSnippet.includes("layoutPreviewToggleButton.setAttribute('aria-pressed', isEnabled ? 'true' : 'false');"));
  assert.ok(syncPreviewControlSnippet.includes("layoutPreviewFrameToggleButton.setAttribute('aria-pressed', isFrameEnabled ? 'true' : 'false');"));

  const handleUiActionSnippet = sliceBetween(
    editor,
    'function handleUiAction(action) {',
    "    case 'toggle-paragraph-menu':",
  );
  assert.ok(handleUiActionSnippet.includes("case 'switch-preview-format-a4':"));
  assert.ok(handleUiActionSnippet.includes('dispatchUiCommand(PREVIEW_FORMAT_COMMAND_IDS.A4)'));
  assert.ok(handleUiActionSnippet.includes("case 'switch-preview-format-a5':"));
  assert.ok(handleUiActionSnippet.includes('dispatchUiCommand(PREVIEW_FORMAT_COMMAND_IDS.A5)'));
  assert.ok(handleUiActionSnippet.includes("case 'switch-preview-format-letter':"));
  assert.ok(handleUiActionSnippet.includes('dispatchUiCommand(PREVIEW_FORMAT_COMMAND_IDS.LETTER)'));

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
  assert.ok(runtimeBridge.includes("commandId === 'cmd.project.view.previewFormatA5'"));
  assert.ok(runtimeBridge.includes("runBridgeCallback(runtimeHandlers.setPreviewFormat, commandId, 'A5')"));
  assert.ok(runtimeBridge.includes("command === 'switch-preview-format-letter'"));
  assert.ok(runtimeBridge.includes("runBridgeCallback(runtimeHandlers.setPreviewFormat, command, 'LETTER')"));

  const runtimeBridgeSnippet = sliceBetween(
    runtimeBridge,
    "if (commandId === 'cmd.project.export.docxMin' && payload.preview === true) {",
    '  return { handled: false, result: null }',
  );
  assert.ok(runtimeBridgeSnippet.includes('runBridgeCallback(runtimeHandlers.openExportPreview, commandId)'));
  assert.equal(runtimeBridgeSnippet.includes('document'), false);
  assert.equal(runtimeBridgeSnippet.includes('window'), false);
});
