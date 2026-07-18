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

test('sector-m toolbar main shell scale: runtime restores an independent persisted scale channel', () => {
  const source = readFile('src', 'renderer', 'editor.js');
  const indexSource = readFile('src', 'renderer', 'index.html');
  const dragFoundationSnippet = sliceSection(
    source,
    'function initializeFloatingToolbarDragFoundation() {',
    'const commandRegistry = createCommandRegistry();'
  );

  assert.ok(dragFoundationSnippet.includes("startFloatingToolbarInteraction('move', event);"));
  assert.ok(dragFoundationSnippet.includes("startFloatingToolbarInteraction('width', event);"));
  assert.ok(dragFoundationSnippet.includes("startFloatingToolbarInteraction('scale', event);"));
  assert.ok(dragFoundationSnippet.includes('toolbarRotateHandles.forEach((handle) => {'));
  assert.ok(dragFoundationSnippet.includes("} else if (mode === 'scale') {"));
  assert.ok(
    dragFoundationSnippet.includes('const scaleDelta = (origin.isVertical ? deltaY : deltaX) * 0.01;'),
    'scale drag must follow the visible axis in both orientations'
  );
  assert.ok(dragFoundationSnippet.includes('scheduleFloatingToolbarScaleState({'));
  assert.ok(indexSource.includes('data-toolbar-scale-handle'));
  assert.ok(indexSource.includes('floating-toolbar__phosphor-icon--scale'));

  assert.ok(source.includes('const FLOATING_TOOLBAR_SCALE_MIN = 0.5;'));
  assert.ok(source.includes('const FLOATING_TOOLBAR_SCALE_MAX = 2.0;'));
  assert.ok(source.includes('const FLOATING_TOOLBAR_SCALE_STEP = 0.05;'));
  assert.ok(source.includes('const FLOATING_TOOLBAR_METRIC_BASE_PX = Object.freeze({'));
  assert.ok(source.includes('function snapFloatingToolbarMetric(value, step = getFloatingToolbarDevicePixelStep()) {'));
  assert.ok(source.includes('function scheduleFloatingToolbarScaleState(nextState) {'));
  assert.ok(source.includes('if (signature === floatingToolbarMetricScaleSignature) return;'));

  const visualSnippet = sliceSection(
    source,
    'function applyFloatingToolbarVisualState() {',
    'function applyFloatingToolbarState(partialState, persist = true) {'
  );
  assert.ok(
    visualSnippet.includes("toolbarShell.style.setProperty('--floating-toolbar-scale', String(floatingToolbarState.scale));")
  );
  assert.ok(visualSnippet.includes('applyFloatingToolbarMetricScale();'));
  assert.ok(visualSnippet.includes("toolbarShell.style.transform = 'none';"));

  const stateApplySnippet = sliceSection(
    source,
    'function applyFloatingToolbarState(partialState, persist = true) {',
    'function restoreFloatingToolbarPosition() {'
  );
  assert.ok(stateApplySnippet.includes('const nextScale = clampFloatingToolbarScale('));
  assert.ok(stateApplySnippet.includes('scale: nextScale,'));

  const readStateSnippet = sliceSection(
    source,
    'function readFloatingToolbarState() {',
    'function persistFloatingToolbarState() {'
  );
  assert.ok(readStateSnippet.includes('const scale = Number(parsed.scale);'));
  assert.ok(readStateSnippet.includes('scale: Number.isFinite(scale) ? scale : 1,'));
});

test('sector-m toolbar main shell scale: css uses real metric sizing and keeps native outer layers', () => {
  const stylesSource = readFile('src', 'renderer', 'styles.css');
  const shellSection = sliceSection(
    stylesSource,
    '.floating-toolbar__shell {',
    '.floating-toolbar__shell::before {'
  );

  assert.ok(shellSection.includes('--floating-toolbar-scale: 1;'));
  assert.ok(shellSection.includes('--floating-toolbar-width-scale: 1;'));
  assert.ok(shellSection.includes('zoom: 1;'));
  assert.equal(shellSection.includes('zoom: var(--floating-toolbar-scale);'), false);
  assert.ok(shellSection.includes('transform: none;'));
  assert.equal(stylesSource.includes('transform: scale(var(--floating-toolbar-scale));'), false);
  assert.ok(stylesSource.includes('.floating-toolbar__transform-handle--scale'));
  assert.ok(stylesSource.includes('margin-left: 44px;'));
  assert.ok(stylesSource.includes('font-size: var(--floating-toolbar-control-font-size);'));
  assert.ok(stylesSource.includes("url('./assets/icons/phosphor/regular/arrows-out.svg')"));
});
