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
