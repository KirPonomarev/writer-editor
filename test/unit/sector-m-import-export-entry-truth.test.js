const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

async function loadModules() {
  const registry = await import(pathToFileURL(path.join(ROOT, 'src', 'renderer', 'commands', 'registry.mjs')).href);
  const project = await import(pathToFileURL(path.join(ROOT, 'src', 'renderer', 'commands', 'projectCommands.mjs')).href);
  const palette = await import(pathToFileURL(path.join(ROOT, 'src', 'renderer', 'commands', 'palette-groups.v1.mjs')).href);
  return { ...registry, ...project, ...palette };
}

test('import export entry truth: canonical markdown file commands are available in the palette', () => {
  const source = read('src/renderer/commands/command-catalog.v1.mjs');

  assert.match(
    source,
    /id:\s*'cmd\.project\.importMarkdownV1'[\s\S]*?surface:\s*\['palette'\][\s\S]*?hotkey:\s*''/,
  );
  assert.match(
    source,
    /id:\s*'cmd\.project\.exportMarkdownV1'[\s\S]*?surface:\s*\['palette'\][\s\S]*?hotkey:\s*''/,
  );
});

test('import export entry truth: menu normalization aliases markdown actions to canonical user-facing commands', () => {
  const source = read('src/menu/menu-config-normalizer.js');

  assert.ok(source.includes("importMarkdownV1: 'cmd.project.insert.markdownPrompt'"));
  assert.ok(source.includes("exportMarkdownV1: 'cmd.project.review.exportMarkdown'"));
  assert.equal(source.includes("importMarkdownV1: 'cmd.project.importMarkdownV1'"), false);
  assert.equal(source.includes("exportMarkdownV1: 'cmd.project.exportMarkdownV1'"), false);
});

test('import export entry truth: palette exposes canonical file commands during alias transition', async () => {
  const {
    createCommandRegistry,
    registerProjectCommands,
    listBySurface,
  } = await loadModules();

  const registry = createCommandRegistry();
  registerProjectCommands(registry, { electronAPI: {} });

  const paletteEntries = listBySurface(registry, 'palette');
  const paletteIds = new Set(paletteEntries.map((entry) => entry.id));

  assert.equal(paletteIds.has('cmd.project.importMarkdownV1'), true);
  assert.equal(paletteIds.has('cmd.project.exportMarkdownV1'), true);
  assert.equal(paletteIds.has('cmd.project.insert.markdownPrompt'), true);
  assert.equal(paletteIds.has('cmd.project.review.exportMarkdown'), true);
});

test('import export entry truth: palette canonical ids route to main-owned local-file flows', () => {
  const source = read('src/renderer/editor.js');
  const start = source.indexOf('function runCommandPaletteAction(commandId)');
  const end = source.indexOf('function openSettingsModal()', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const section = source.slice(start, end);

  assert.ok(section.includes("const importMarkdownCommandId = 'cmd.project.importMarkdownV1';"));
  assert.ok(section.includes("const exportMarkdownCommandId = 'cmd.project.exportMarkdownV1';"));
  assert.ok(section.includes('return handleMarkdownImportUiPath();'));
  assert.ok(section.includes('return handleMarkdownExportUiPath();'));
});
