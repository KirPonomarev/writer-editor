const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function readFile(...segments) {
  return fs.readFileSync(path.join(ROOT, ...segments), 'utf8');
}

function sliceSection(source, startToken, endToken) {
  const startIndex = source.indexOf(startToken);
  const endIndex = source.indexOf(endToken, startIndex);
  assert.ok(startIndex > -1, `missing start token: ${startToken}`);
  assert.ok(endIndex > startIndex, `missing end token: ${endToken}`);
  return source.slice(startIndex, endIndex);
}

test('sector-m toolbar metric shell scale: main scale and width are independent while left shell stays descaled', () => {
  const source = readFile('src', 'renderer', 'editor.js');
  const mainVisualSnippet = sliceSection(
    source,
    'function applyFloatingToolbarVisualState() {',
    'function applyFloatingToolbarState(partialState, persist = true) {'
  );
  const leftVisualSnippet = sliceSection(
    source,
    'function applyLeftFloatingToolbarVisualState() {',
    'function applyLeftFloatingToolbarState(partialState, persist = true) {'
  );

  assert.ok(mainVisualSnippet.includes("'--floating-toolbar-width-scale',"));
  assert.ok(mainVisualSnippet.includes("toolbarShell.style.setProperty('--floating-toolbar-scale', String(floatingToolbarState.scale));"));
  assert.ok(mainVisualSnippet.includes("toolbarShell.style.transform = 'none';"));

  assert.ok(leftVisualSnippet.includes("leftToolbarShell.style.setProperty('--left-toolbar-width-scale', String(leftFloatingToolbarState.widthScale));"));
  assert.ok(leftVisualSnippet.includes("leftToolbarShell.style.transform = 'none';"));
  assert.ok(leftVisualSnippet.includes("leftToolbarShell.style.removeProperty('--left-toolbar-scale');"));
});

test('sector-m toolbar metric shell scale: drag semantics add scale only to the main formatting shell', () => {
  const source = readFile('src', 'renderer', 'editor.js');
  const mainDragSnippet = sliceSection(
    source,
    'function initializeFloatingToolbarDragFoundation() {',
    'const commandRegistry = createCommandRegistry();'
  );
  const leftDragSnippet = sliceSection(
    source,
    'function initializeLeftFloatingToolbarDragFoundation() {',
    'function setConfiguratorOpen(nextOpen) {'
  );

  assert.ok(mainDragSnippet.includes("startFloatingToolbarInteraction('move', event);"));
  assert.ok(mainDragSnippet.includes("startFloatingToolbarInteraction('width', event);"));
  assert.ok(mainDragSnippet.includes("startFloatingToolbarInteraction('scale', event);"));
  assert.ok(mainDragSnippet.includes('toolbarRotateHandles.forEach((handle) => {'));

  assert.ok(leftDragSnippet.includes("startLeftFloatingToolbarInteraction('move', event);"));
  assert.ok(leftDragSnippet.includes("startLeftFloatingToolbarInteraction('width', event);"));
  assert.ok(leftDragSnippet.includes('leftToolbarRotateHandles.forEach((handle) => {'));
  assert.equal(leftDragSnippet.includes("startLeftFloatingToolbarInteraction('scale', event);"), false);
});

test('sector-m toolbar metric shell scale: vertical width and uniform scale retain separate clamps', () => {
  const source = readFile('src', 'renderer', 'editor.js');
  const widthClampSnippet = sliceSection(
    source,
    'function clampFloatingToolbarWidthScale(widthScale, isVertical = false) {',
    'function clampFloatingToolbarScale(scale) {'
  );
  const scaleClampSnippet = sliceSection(
    source,
    'function clampFloatingToolbarScale(scale) {',
    'function getFloatingToolbarScale() {'
  );

  assert.ok(widthClampSnippet.includes('const minimumWidthScale = isVertical ? 1 : FLOATING_TOOLBAR_WIDTH_SCALE_MIN;'));
  assert.ok(widthClampSnippet.includes('Math.max(widthScale, minimumWidthScale)'));
  assert.ok(scaleClampSnippet.includes('FLOATING_TOOLBAR_SCALE_MIN'));
  assert.ok(scaleClampSnippet.includes('FLOATING_TOOLBAR_SCALE_MAX'));
});

test('sector-m toolbar metric shell scale: scaled popup and anchor math stays in shell-local coordinates', () => {
  const source = readFile('src', 'renderer', 'editor.js');
  const paragraphSnippet = sliceSection(
    source,
    'function setParagraphMenuOpen(nextOpen) {',
    'function setListMenuOpen(nextOpen) {'
  );
  const anchorSnippet = sliceSection(
    source,
    'function updateToolbarAnchorVars() {',
    'function scheduleToolbarAnchorUpdate() {'
  );
  const colorSnippet = sliceSection(
    source,
    'function positionToolbarColorPickerOverlay() {',
    'function syncToolbarShellState() {'
  );

  assert.ok(paragraphSnippet.includes('const shellScale = getFloatingToolbarScale();'));
  assert.ok(paragraphSnippet.includes('(triggerRect.left - shellRect.left) / shellScale'));
  assert.ok(anchorSnippet.includes('(bounds.left - shellRect.left) / shellScale'));
  assert.ok(colorSnippet.includes('const overlayWidth = overlayRect.width / shellScale;'));
});

test('sector-m toolbar metric shell scale: css keeps sharp shells and metric channels', () => {
  const styles = readFile('src', 'renderer', 'styles.css');
  const leftShellSection = sliceSection(styles, '.left-floating-toolbar__shell {', '.left-floating-toolbar__shell::before {');
  const mainShellSection = sliceSection(styles, '.floating-toolbar__shell {', '.floating-toolbar__shell::before {');

  assert.ok(leftShellSection.includes('--left-toolbar-cluster-center-x: 0px;'));
  assert.ok(mainShellSection.includes('--floating-toolbar-cluster-center-x: 0px;'));
  assert.ok(leftShellSection.includes('transform: none;'));
  assert.ok(mainShellSection.includes('transform: none;'));
  assert.equal(leftShellSection.includes('transform: scale('), false);
  assert.equal(mainShellSection.includes('transform: scale('), false);
  assert.ok(mainShellSection.includes('zoom: var(--floating-toolbar-scale);'));
  assert.ok(styles.includes('width: calc(var(--toolbar-chrome-slot-long) * var(--floating-toolbar-width-scale));'));
  assert.ok(styles.includes('gap: calc(12px * var(--left-toolbar-width-scale));'));
});
