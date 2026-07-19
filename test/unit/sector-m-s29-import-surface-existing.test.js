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

test('S29 import surface: one truthful modal exposes existing bounded formats', () => {
  const html = read('src/renderer/index.html');
  const styles = read('src/renderer/styles.css');

  for (const marker of [
    'data-import-surface-modal',
    'data-import-surface-status',
    'data-import-surface-detail',
    'data-import-surface-format="docx"',
    'data-import-surface-format="txt"',
    'data-import-surface-format="markdown"',
    'Preview creates no project files.',
    'Unsupported structure stays outside automatic import.',
  ]) {
    assert.ok(html.includes(marker), marker);
  }

  assert.ok(styles.includes('.import-surface__content'));
  assert.ok(styles.includes('.import-surface__grid'));
  assert.ok(styles.includes('.import-surface__option-copy'));
});

test('S29 import surface: buttons delegate to current preview flows and write nothing directly', () => {
  const editor = read('src/renderer/editor.js');
  const section = sectionBetween(
    editor,
    'function runImportSurfaceFormat(format)',
    'function runCommandPaletteAction(commandId)',
  );

  assert.ok(section.includes("if (normalizedFormat === 'docx') {"));
  assert.ok(section.includes('return openDocxImportPreviewFlow();'));
  assert.ok(section.includes("if (normalizedFormat === 'txt') {"));
  assert.ok(section.includes('return openTxtImportPreviewFlow();'));
  assert.ok(section.includes("if (normalizedFormat === 'markdown') {"));
  assert.ok(section.includes('return handleMarkdownImportUiPath();'));

  for (const forbidden of [
    'accept: true',
    'setPlainText(',
    'setContent(',
    'dispatchUiCommand(COMMAND_IDS.PROJECT_IMPORT_DOCX_V1',
    'dispatchUiCommand(COMMAND_IDS.PROJECT_IMPORT_TXT_V1',
    'dispatchUiCommand(COMMAND_IDS.PROJECT_IMPORT_MARKDOWN_V1',
  ]) {
    assert.equal(section.includes(forbidden), false, forbidden);
  }
});

test('S29 import surface: menu, palette, shortcut, and Tiptap runtime open the same surface', () => {
  const editor = read('src/renderer/editor.js');
  const runtimeBridge = read('src/renderer/tiptap/runtimeBridge.js');
  const menu = read('src/menu/menu-config.v2.json');

  const paletteSection = sectionBetween(
    editor,
    'function runCommandPaletteAction(commandId)',
    'function openSettingsModal()',
  );
  assert.ok(paletteSection.includes("const importDocxCommandId = 'cmd.project.importDocxV1';"));
  assert.ok(paletteSection.includes("const importTxtCommandId = 'cmd.project.importTxtV1';"));
  assert.ok(paletteSection.includes("const importMarkdownCommandId = 'cmd.project.importMarkdownV1';"));
  assert.equal((paletteSection.match(/return openImportSurfaceModal\(normalizedCommandId\);/g) || []).length, 3);

  const runtimeSection = sectionBetween(
    editor,
    'function handleCanonicalRuntimeCommandId(commandId, runtimePayload = null)',
    'if (isTiptapMode) {',
  );
  assert.equal((runtimeSection.match(/openImportSurfaceModal\(commandId\);/g) || []).length, 3);
  assert.ok(editor.includes('openImportSurface: (commandId = \'\') => openImportSurfaceModal(commandId),'));
  assert.ok(editor.includes('openImportSurfaceModal();'));

  assert.ok(runtimeBridge.includes("commandId === 'cmd.project.importDocxV1'"));
  assert.ok(runtimeBridge.includes("commandId === 'cmd.project.importTxtV1'"));
  assert.ok(runtimeBridge.includes("commandId === 'cmd.project.importMarkdownV1'"));
  assert.ok(runtimeBridge.includes('runBridgeCallback(runtimeHandlers.openImportSurface, commandId, commandId)'));

  for (const commandId of [
    'cmd.project.importDocxV1',
    'cmd.project.importTxtV1',
    'cmd.project.importMarkdownV1',
  ]) {
    assert.ok(menu.includes(`"command": "${commandId}"`), commandId);
  }
});

test('S29 import surface: canonical format flows still own preview and accept contracts', () => {
  const editor = read('src/renderer/editor.js');

  for (const marker of [
    'async function openDocxImportPreviewFlow()',
    'dispatchUiCommand(COMMAND_IDS.PROJECT_IMPORT_DOCX_V1);',
    'dispatchUiCommand(COMMAND_IDS.PROJECT_IMPORT_DOCX_V1, {',
    'docxImportPreviewPlan: plan,',
    'async function openTxtImportPreviewFlow()',
    'dispatchUiCommand(COMMAND_IDS.PROJECT_IMPORT_TXT_V1);',
    'dispatchUiCommand(COMMAND_IDS.PROJECT_IMPORT_TXT_V1, {',
    'txtImportPreviewPlan: plan,',
    'async function handleMarkdownImportUiPath()',
    'MARKDOWN_IMPORT_LOCAL_FILE_PREVIEW_COMMAND_ID',
    'MARKDOWN_IMPORT_LOCAL_FILE_ACCEPT_COMMAND_ID',
  ]) {
    assert.ok(editor.includes(marker), marker);
  }
});
