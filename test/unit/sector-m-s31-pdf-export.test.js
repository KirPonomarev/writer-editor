const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function sectionBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, startMarker);
  assert.notEqual(end, -1, endMarker);
  return source.slice(start, end);
}

test('S31 PDF export: command is admitted through catalog, capability, menu, and kernel', () => {
  const catalog = read('src/renderer/commands/command-catalog.v1.mjs');
  const projectCommands = read('src/renderer/commands/projectCommands.mjs');
  const capability = read('src/renderer/commands/capabilityPolicy.mjs');
  const commandKernel = read('src/command/commandSurfaceKernel.js');
  const menuConfig = read('src/menu/menu-config.v2.json');
  const menuLocale = read('src/menu/menu-locale.catalog.v1.json');
  const main = read('src/main.js');

  assert.ok(catalog.includes("key: 'PROJECT_EXPORT_PDF_V1'"));
  assert.ok(catalog.includes("id: 'cmd.project.exportPdfV1'"));
  assert.ok(projectCommands.includes('PROJECT_EXPORT_PDF_V1: COMMAND_KEY_TO_ID.PROJECT_EXPORT_PDF_V1'));
  assert.ok(capability.includes("'cmd.project.exportPdfV1': 'cap.project.export.pdfV1'"));
  assert.ok(capability.includes("'cap.project.export.pdfV1': true"));
  assert.ok(capability.includes("'cap.project.export.pdfV1': false"));
  assert.ok(commandKernel.includes("'cmd.project.exportPdfV1'"));
  assert.ok(menuConfig.includes('"id": "file-export-pdf"'));
  assert.ok(menuConfig.includes('"command": "cmd.project.exportPdfV1"'));
  assert.ok(menuLocale.includes('"menu.file.exportPdf"'));
  assert.ok(main.includes("const EXPORT_PDF_COMMAND_ID = 'cmd.project.exportPdfV1';"));
  assert.ok(main.includes('PROJECT_EXPORT_PDF_V1: EXPORT_PDF_COMMAND_ID'));
  assert.ok(main.includes('[COMMAND_SURFACE_KERNEL_COMMAND_IDS.PROJECT_EXPORT_PDF_V1]: async (payload = {}) => {'));
  assert.ok(main.includes('[EXPORT_PDF_COMMAND_ID]: async (payload = {}) => {'));
});

test('S31 PDF export: export surface and runtime routes converge on the existing surface', () => {
  const html = read('src/renderer/index.html');
  const editor = read('src/renderer/editor.js');
  const runtimeBridge = read('src/renderer/tiptap/runtimeBridge.js');

  assert.ok(html.includes('data-export-surface-format="pdf"'));
  assert.ok(html.includes('Saved scenes rendered through BookProfile print geometry.'));

  const exportSurfaceSection = sectionBetween(
    editor,
    'function runExportSurfaceFormat(format)',
    'function runCommandPaletteAction(commandId)',
  );
  assert.ok(exportSurfaceSection.includes("if (normalizedFormat === 'pdf') {"));
  assert.ok(exportSurfaceSection.includes('COMMAND_IDS.PROJECT_EXPORT_PDF_V1'));
  assert.ok(exportSurfaceSection.includes("'export-pdf'"));
  assert.ok(exportSurfaceSection.includes("'PDF'"));

  const paletteSection = sectionBetween(
    editor,
    'function runCommandPaletteAction(commandId)',
    'function openSettingsModal()',
  );
  assert.ok(paletteSection.includes("const exportPdfCommandId = 'cmd.project.exportPdfV1';"));
  assert.ok(paletteSection.includes('return openExportSurfaceModal(normalizedCommandId);'));

  const runtimeSection = sectionBetween(
    editor,
    'function handleCanonicalRuntimeCommandId(commandId, runtimePayload = null)',
    'if (isTiptapMode) {',
  );
  assert.ok(runtimeSection.includes('if (commandId === COMMAND_IDS.PROJECT_EXPORT_PDF_V1) {'));
  assert.ok(runtimeBridge.includes("commandId === 'cmd.project.exportPdfV1'"));
  assert.ok(runtimeBridge.includes('runBridgeCallback(runtimeHandlers.openExportSurface, commandId, commandId)'));
});

test('S31 PDF export: main-owned renderer uses isolated print projection and saved canonical sources', () => {
  const main = read('src/main.js');
  const sourceSection = sectionBetween(
    main,
    'async function readCanonicalPdfExportSource()',
    'async function resolveMarkdownExportPath(payload)',
  );
  assert.ok(sourceSection.includes('buildSelectedScenesTxtExportScope()'));
  assert.ok(sourceSection.includes('readSelectedScenesTxtExportSceneContent(candidate)'));
  assert.ok(sourceSection.includes('readPdfExportBookProfile()'));
  assert.equal(sourceSection.includes('requestEditorSnapshot('), false);
  assert.equal(sourceSection.includes('requestEditorText('), false);

  const renderSection = sectionBetween(
    main,
    'async function renderPdfBufferFromHtml(html)',
    'async function readCurrentSceneTxtExportSource()',
  );
  assert.ok(renderSection.includes('new BrowserWindow({'));
  assert.ok(renderSection.includes('show: false'));
  assert.ok(renderSection.includes('contextIsolation: true'));
  assert.ok(renderSection.includes('nodeIntegration: false'));
  assert.ok(renderSection.includes('sandbox: true'));
  assert.ok(renderSection.includes('preferCSSPageSize: true'));
  assert.ok(renderSection.includes('printWindow.webContents.printToPDF({'));
  assert.equal(renderSection.includes('mainWindow.webContents.printToPDF'), false);

  const payloadSection = sectionBetween(
    main,
    'const PDF_EXPORT_ALLOWED_PAYLOAD_KEYS = Object.freeze([',
    'function normalizeCurrentSceneTxtExportPath(filePath)',
  );
  assert.ok(payloadSection.includes("'outPath'"));
  assert.ok(payloadSection.includes("'requestId'"));
  assert.ok(payloadSection.includes("'confirmed'"));
  for (const forbidden of [
    "'bookProfile'",
    "'content'",
    "'plainText'",
    "'rendererState'",
    "'scenePaths'",
    "'text'",
    "'viewportDomText'",
  ]) {
    assert.ok(payloadSection.includes(forbidden), forbidden);
  }
});
