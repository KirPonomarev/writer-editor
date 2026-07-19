const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const FULL_MODE = process.env.SECTOR_U_FULL_A11Y === '1';

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('u6 a11y focus contract: editor has focusable entry point and no tabindex=-1 on key roots', { skip: !FULL_MODE }, () => {
  const editorText = read('src/renderer/editor.js');
  const htmlText = read('src/renderer/index.html');
  const cssText = read('src/renderer/styles.css');

  assert.match(editorText, /const editor = document\.getElementById\('editor'\);/);
  assert.match(editorText, /editor\.focus\(\);/);
  assert.match(htmlText, /data-top-work-bar role="toolbar" aria-label="Основные команды"/);
  assert.match(htmlText, /data-toolbar role="toolbar" aria-label="Панель форматирования"/);
  assert.match(htmlText, /data-font-select aria-label="Гарнитура"/);
  assert.match(htmlText, /data-weight-select aria-label="Начертание"/);
  assert.match(htmlText, /data-size-select aria-label="Кегль"/);
  assert.match(htmlText, /data-line-height-select aria-label="Интерлиньяж"/);
  assert.match(htmlText, /id="editor"[\s\S]*role="textbox"[\s\S]*aria-label="Текст сцены"[\s\S]*aria-multiline="true"/);
  assert.match(htmlText, /data-project-search-status role="status"/);
  assert.match(htmlText, /data-left-tabs role="tablist" aria-label="Навигатор"/);
  assert.match(htmlText, /id="left-tab-project"[\s\S]*data-left-tab="project"[\s\S]*role="tab"[\s\S]*aria-controls="left-panel-project"[\s\S]*aria-selected="true"/);
  assert.match(htmlText, /id="left-panel-project" data-tree role="tabpanel" aria-labelledby="left-tab-project"/);
  assert.match(htmlText, /data-paragraph-menu[^>]*role="menu"[^>]*aria-label="Выравнивание абзаца"/);
  assert.match(htmlText, /data-list-menu[^>]*role="menu"[^>]*aria-label="Тип списка"/);
  assert.match(htmlText, /role="menuitemradio" aria-checked="true" aria-pressed="true">Слева/);
  assert.match(htmlText, /role="menuitemradio" aria-checked="false" aria-pressed="false">Маркированный/);
  assert.match(editorText, /leftTabsHost\.addEventListener\('keydown'/);
  assert.match(editorText, /event\.key === 'ArrowRight'/);
  assert.match(editorText, /event\.key === 'Home'/);
  assert.match(editorText, /button\.setAttribute\('aria-selected'/);
  assert.match(editorText, /button\.setAttribute\('aria-checked'/);
  assert.match(editorText, /setAttribute\('role', 'menuitemradio'\)/);
  assert.match(cssText, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(cssText, /animation-duration: 0\.001ms !important/);
  assert.match(cssText, /#editor:focus-visible/);
  assert.match(cssText, /--a11y-focus-outline/);

  const rootCandidates = [
    /<main[^>]*class="[^"]*main-content[^"]*"[^>]*>/i,
    /<section[^>]*class="[^"]*editor-panel[^"]*"[^>]*>/i,
    /<[^>]*id="editor"[^>]*>/i,
  ];
  for (const pattern of rootCandidates) {
    const match = htmlText.match(pattern);
    if (!match) continue;
    assert.doesNotMatch(match[0], /tabindex\s*=\s*"-1"/i);
    assert.doesNotMatch(match[0], /tabindex\s*=\s*'-1'/i);
  }
});
