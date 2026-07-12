const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

test('Phase 05 File menu exposes every supported content import and export in minimal profile', () => {
  const config = readJson('src/menu/menu-config.v2.json');
  const fileMenu = config.menus.find((menu) => menu.id === 'file');
  assert.ok(fileMenu);
  const items = new Map(fileMenu.items.map((item) => [item.id, item]));
  const expected = new Map([
    ['file-import-docx-content', ['cmd.project.importDocxV1', 'Import DOCX Content (Content only)...']],
    ['file-import-txt-content', ['cmd.project.importTxtV1', 'Import TXT Content...']],
    ['file-import-markdown-content', ['cmd.project.importMarkdownV1', 'Import Markdown Content...']],
    ['file-export-docx', ['cmd.project.export.docxMin', 'Export DOCX (Minimal)...']],
    ['file-export-markdown', ['cmd.project.exportMarkdownV1', 'Export Markdown...']],
    ['file-export-current-scene-txt', ['cmd.project.exportCurrentSceneTxtV1', 'Экспорт TXT текущей сцены']],
    ['file-export-selected-scenes-txt', ['cmd.project.exportSelectedScenesTxtV1', 'Экспорт TXT выбранных сцен']],
    ['file-export-all-scenes-txt', ['cmd.project.exportAllScenesTxtV1', 'Экспорт TXT всех сцен']],
  ]);

  for (const [id, [commandId, label]] of expected) {
    const item = items.get(id);
    assert.ok(item, id);
    const actualCommandId = item.command || (item.actionId === 'exportDocxMin' ? 'cmd.project.export.docxMin' : '');
    assert.equal(actualCommandId, commandId, id);
    assert.equal(item.label, label, id);
    assert.deepEqual(item.profile, ['minimal', 'pro', 'guru'], id);
  }
});

test('Phase 05 Review menu separates packet Apply from bounded DOCX evidence', () => {
  const config = readJson('src/menu/menu-config.v2.json');
  const reviewMenu = config.menus.find((menu) => menu.id === 'review');
  assert.ok(reviewMenu);
  const items = new Map(reviewMenu.items.map((item) => [item.id, item]));

  assert.equal(items.get('review-import-local-packet').label, 'Import Review Packet for Exact Apply...');
  assert.equal(items.get('review-export-local-packet').label, 'Export Review Packet...');
  assert.equal(
    items.get('review-open-docx-review-preview-session').label,
    'Open DOCX Review Evidence (Comments preview; Tracked changes diagnostic)...',
  );
});

test('Phase 05 canonical palette entries have honest labels and legacy Markdown aliases are internal', async () => {
  const catalog = read('src/renderer/commands/command-catalog.v1.mjs');
  const projectCommands = read('src/renderer/commands/projectCommands.mjs');

  assert.match(catalog, /id: 'cmd\.project\.export\.docxMin',[\s\S]*label: 'Export DOCX \(Minimal\)'/u);
  assert.match(catalog, /id: 'cmd\.project\.importDocxV1',[\s\S]*label: 'Import DOCX Content \(Content only\)'/u);
  assert.match(catalog, /id: 'cmd\.project\.importMarkdownV1',[\s\S]*label: 'Import Markdown Content'/u);
  assert.match(catalog, /id: 'cmd\.project\.exportMarkdownV1',[\s\S]*label: 'Export Markdown'/u);
  assert.match(
    projectCommands,
    /id: EXTRA_COMMAND_IDS\.INSERT_MARKDOWN_PROMPT,[\s\S]*surface: \['internal'\]/u,
  );
  assert.match(
    projectCommands,
    /id: EXTRA_COMMAND_IDS\.REVIEW_EXPORT_MARKDOWN,[\s\S]*surface: \['internal'\]/u,
  );

  const registryModule = await import(path.join(ROOT, 'src/renderer/commands/registry.mjs'));
  const projectModule = await import(path.join(ROOT, 'src/renderer/commands/projectCommands.mjs'));
  const paletteModule = await import(path.join(ROOT, 'src/renderer/commands/palette-groups.v1.mjs'));
  const registry = registryModule.createCommandRegistry();
  projectModule.registerProjectCommands(registry, { electronAPI: {} });
  const ids = new Set(paletteModule.listBySurface(registry, 'palette').map((entry) => entry.id));
  assert.equal(ids.has('cmd.project.importMarkdownV1'), true);
  assert.equal(ids.has('cmd.project.exportMarkdownV1'), true);
  assert.equal(ids.has('cmd.project.insert.markdownPrompt'), false);
  assert.equal(ids.has('cmd.project.review.exportMarkdown'), false);
});

test('Phase 05 native menu intents open the existing renderer preview flows', () => {
  const main = read('src/main.js');
  const renderer = read('src/renderer/editor.js');

  for (const marker of [
    "'open-import-docx-preview'",
    "'open-import-txt-preview'",
    "'open-import-markdown-preview'",
    "'open-export-markdown'",
  ]) {
    assert.ok(main.includes(marker), marker);
  }
  assert.match(renderer, /commandId === COMMAND_IDS\.PROJECT_IMPORT_DOCX_V1[\s\S]*openDocxImportPreviewFlow\(\)/u);
  assert.match(renderer, /commandId === COMMAND_IDS\.PROJECT_IMPORT_TXT_V1[\s\S]*openTxtImportPreviewFlow\(\)/u);
  assert.match(renderer, /commandId === COMMAND_IDS\.PROJECT_IMPORT_MARKDOWN_V1[\s\S]*handleMarkdownImportUiPath\(\)/u);
  assert.match(renderer, /commandId === COMMAND_IDS\.PROJECT_EXPORT_MARKDOWN_V1[\s\S]*handleMarkdownExportUiPath\(\)/u);
});

test('Phase 05 normalized artifact and status preserve exact merged product truth', () => {
  const artifact = readJson('docs/OPS/ARTIFACTS/menu/menu.normalized.json');
  const status = readJson('docs/OPS/STATUS/REVIEW_BRIDGE_PRODUCT_DISCOVERABILITY_LABELS_001_STATUS.json');
  const fileMenu = artifact.menus.find((menu) => menu.id === 'file');
  const reviewMenu = artifact.menus.find((menu) => menu.id === 'review');

  assert.equal(artifact.normalizedHashSha256, '6fa119570e880f3746def67cdc6d649c42e0dc893a0cfb57bff7ed45951b3750');
  assert.ok(fileMenu.items.some(
    (item) => item.id === 'file-import-docx-content' && item.visibilityPolicy === 'visible_enabled',
  ));
  assert.ok(fileMenu.items.some(
    (item) => item.id === 'file-export-markdown' && item.visibilityPolicy === 'visible_enabled',
  ));
  assert.ok(reviewMenu.items.some((item) => item.id === 'review-open-docx-review-preview-session'));
  assert.equal(status.taskId, 'REVIEW_BRIDGE_PRODUCT_DISCOVERABILITY_LABELS_001');
  assert.equal(status.status, 'delivered_merged_verified');
  assert.equal(status.baseSha, 'b6c2b8fba9c303ce95055e9168d72cb0390c167e');
  assert.equal(status.scope.indexHtmlChanged, false);
  assert.equal(status.scope.cssChanged, false);
  assert.equal(status.scope.dependencyChanged, false);
  assert.ok(status.nonClaims.some((claim) => claim.includes('DOCX Review remains evidence only')));
  assert.equal(status.delivery.status, 'delivered_merged_verified');
  assert.equal(status.delivery.commitSha, 'c8c80775f469c38be40a917955f667348b491767');
  assert.equal(status.delivery.pullRequest, 1081);
  assert.equal(status.delivery.mergeSha, 'bcfde6816bd340a60a95c6a0c6cd8e738bdca15c');
  assert.equal(status.delivery.mergedAtUtc, '2026-07-12T22:06:58Z');
});
