const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function extractAside(html, marker) {
  const markerIndex = html.indexOf(marker);
  assert.ok(markerIndex > -1, `missing aside marker: ${marker}`);
  const asideStart = html.lastIndexOf('<aside', markerIndex);
  const asideEnd = html.indexOf('</aside>', markerIndex);
  assert.ok(asideStart > -1 && asideEnd > asideStart, `invalid aside bounds: ${marker}`);
  return html.slice(asideStart, asideEnd + '</aside>'.length);
}

test('sidebar control truth: every static sidebar button declares a command or tab binding', () => {
  const html = read('src/renderer/index.html');
  const sidebars = [
    extractAside(html, 'data-sidebar'),
    extractAside(html, 'data-right-sidebar'),
  ];
  const buttons = sidebars.flatMap((aside) => [...aside.matchAll(/<button\b[^>]*>/gu)].map((match) => match[0]));

  assert.equal(buttons.length > 10, true);
  for (const button of buttons) {
    assert.match(
      button,
      /\bdata-(?:action|left-tab|right-tab)=/u,
      `unbound sidebar button: ${button}`
    );
  }
});

test('sidebar control truth: inspector exposes one real action and two truthful statuses', () => {
  const html = read('src/renderer/index.html');
  const editor = read('src/renderer/editor.js');

  assert.equal(html.includes('class="right-rail-toggle'), false);
  assert.ok(html.includes('data-inspector-autosave-status role="status">Локально</span>'));
  assert.ok(html.includes('data-action="review-open-comments"'));
  assert.ok(html.includes('data-inspector-comments-action'));
  assert.ok(html.includes('data-inspector-focus-status'));

  assert.ok(editor.includes('function syncInspectorStateSurface()'));
  assert.ok(editor.includes("inspectorCommentsAction.setAttribute('aria-pressed', commentsActive ? 'true' : 'false');"));
  assert.ok(editor.includes("inspectorFocusStatus.textContent = focusActive ? 'Вкл' : 'Выкл';"));
  assert.ok(editor.includes('syncInspectorStateSurface();\n  syncToolbarShellState();'));
  assert.ok(editor.includes("case 'review-open-comments':\n      void dispatchUiCommand(EXTRA_COMMAND_IDS.REVIEW_OPEN_COMMENTS);"));
});

test('sidebar product truth: inspector projects live values and unopened surfaces stay hidden', () => {
  const html = read('src/renderer/index.html');
  const editor = read('src/renderer/editor.js');

  for (const hook of [
    'data-inspector-font',
    'data-inspector-weight',
    'data-inspector-font-size',
    'data-inspector-line-height',
    'data-inspector-margins',
    'data-inspector-meta-context',
    'data-inspector-meta-status',
    'data-inspector-meta-word-count',
    'data-inspector-meta-synopsis',
    'data-inspector-meta-tags',
  ]) {
    assert.ok(html.includes(hook), `missing live inspector hook: ${hook}`);
  }
  assert.ok(editor.includes('function syncInspectorBookProfileValues('));
  assert.ok(editor.includes('function renderMetadataInspectorState('));
  assert.ok(editor.includes("const METADATA_INSPECTOR_QUERY_ID = 'query.metadataInspector';"));
  assert.ok(editor.includes('if (inspectorFontValue) inspectorFontValue.textContent = fontLabel;'));
  assert.ok(editor.includes('if (!inspectorMarginsValue) return;'));

  for (const demoClaim of [
    'data-right-tab="history"',
    'data-right-panel-history',
    'data-history-placeholder',
    'Быстрая заметка',
    'Черновик синхронизирован.',
    'Ручные версии можно держать',
    'EB Garamond',
    'Широкие',
    'Базовая',
  ]) {
    assert.equal(html.includes(demoClaim), false, `demo-only sidebar claim shipped: ${demoClaim}`);
  }
});

test('sidebar composition truth: right rail keeps metadata and review providers separate', () => {
  const html = read('src/renderer/index.html');
  const editor = read('src/renderer/editor.js');

  assert.ok(html.includes('data-right-tabs\n          role="tablist"'));
  assert.ok(html.includes('data-right-tab="inspector"'));
  assert.ok(html.includes('role="tab"\n              aria-controls="right-panel-inspector"'));
  assert.ok(html.includes('data-right-tab="comments"'));
  assert.ok(html.includes('role="tab"\n              aria-controls="right-panel-comments"'));
  assert.ok(html.includes('data-right-panel-inspector\n          data-right-surface-provider="query.metadataInspector"'));
  assert.ok(html.includes('data-right-panel-comments\n          data-right-surface-provider="query.reviewSurface"'));
  assert.ok(html.includes('data-review-surface-provider="query.reviewSurface"'));

  assert.ok(editor.includes('const RIGHT_RAIL_SURFACE_PROVIDERS = Object.freeze({'));
  assert.ok(editor.includes('inspector: METADATA_INSPECTOR_QUERY_ID'));
  assert.ok(editor.includes('comments: REVIEW_SURFACE_QUERY_ID'));
  assert.ok(editor.includes('function syncRightRailCompositionState(tab)'));
  assert.ok(editor.includes('rightTabsHost.dataset.activeRightProvider = providerId;'));
  assert.ok(editor.includes("reviewSurfaceHost.dataset.reviewSurfaceLoadedFrom = REVIEW_SURFACE_QUERY_ID;"));
  assert.ok(editor.includes("if (tab === 'inspector') {\n    ensureCommandsOpenerInRightInspectorSurface();\n    refreshMetadataInspector();\n  }"));
  assert.equal(editor.includes("if (tab === 'comments') {\n    refreshMetadataInspector();"), false);
});

test('sidebar composition truth: right rail tabs have keyboard focus behavior', () => {
  const editor = read('src/renderer/editor.js');

  assert.ok(editor.includes("rightTabsHost.addEventListener('keydown', (event) => {"));
  assert.ok(editor.includes("event.key === 'ArrowRight' || event.key === 'ArrowDown'"));
  assert.ok(editor.includes("event.key === 'ArrowLeft' || event.key === 'ArrowUp'"));
  assert.ok(editor.includes("event.key === 'Home'"));
  assert.ok(editor.includes("event.key === 'End'"));
  assert.ok(editor.includes("event.key === 'Enter' || event.key === ' '"));
  assert.ok(editor.includes('buttons[nextIndex].focus();'));
  assert.ok(editor.includes('activateRightRailTabButton(buttons[nextIndex]);'));
});
