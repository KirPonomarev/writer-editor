const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function readEditorSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8');
}

function sliceSection(source, startToken, endToken) {
  const startIndex = source.indexOf(startToken);
  const endIndex = source.indexOf(endToken, startIndex);
  assert.ok(startIndex > -1, `missing start token: ${startToken}`);
  assert.ok(endIndex > startIndex, `missing end token: ${endToken}`);
  return source.slice(startIndex, endIndex);
}

test('sector-m toolbar shell metric geometry: anchor snap helper uses explicit integer-halfpixel contract', () => {
  const source = readEditorSource();
  const helperSnippet = sliceSection(
    source,
    'function getToolbarAnchorSnapStep() {',
    'function updateToolbarAnchorVars() {'
  );

  assert.ok(
    helperSnippet.includes('return Number.isFinite(dpr) && dpr >= 2 ? 0.5 : 1;'),
    'anchor snap step must explicitly enforce integer or half-pixel contract'
  );
  assert.ok(
    helperSnippet.includes('Math.round(value / step) * step'),
    'anchor snap value must be quantized by the explicit snap step'
  );
  assert.ok(
    helperSnippet.includes('function setToolbarAnchorVar(host, name, value) {'),
    'anchor var helper must be explicit and reusable for both shells'
  );
});

test('sector-m toolbar shell metric geometry: main and left anchor vars use snap helper only', () => {
  const source = readEditorSource();
  const mainAnchorSnippet = sliceSection(
    source,
    'function updateToolbarAnchorVars() {',
    'function scheduleToolbarAnchorUpdate() {'
  );
  const leftAnchorSnippet = sliceSection(
    source,
    'function updateLeftToolbarAnchorVars() {',
    'function scheduleLeftToolbarAnchorUpdate() {'
  );

  assert.ok(
    mainAnchorSnippet.includes("setToolbarAnchorVar(toolbarShell, '--floating-toolbar-cluster-left', localLeft);"),
    'main anchor vars must route through snap helper'
  );
  assert.ok(
    mainAnchorSnippet.includes("setToolbarAnchorVar(toolbarShell, '--floating-toolbar-cluster-center-y', localTop + ((localBottom - localTop) / 2));"),
    'main center anchor vars must route through snap helper'
  );
  assert.equal(
    mainAnchorSnippet.includes('Math.round('),
    false,
    'main anchor snippet must not use direct Math.round after snap helper adoption'
  );

  assert.ok(
    leftAnchorSnippet.includes("setToolbarAnchorVar(leftToolbarShell, '--left-toolbar-cluster-left', localLeft);"),
    'left anchor vars must route through snap helper'
  );
  assert.ok(
    leftAnchorSnippet.includes("setToolbarAnchorVar(leftToolbarShell, '--left-toolbar-cluster-center-y', localTop + ((localBottom - localTop) / 2));"),
    'left center anchor vars must route through snap helper'
  );
  assert.equal(
    leftAnchorSnippet.includes('Math.round('),
    false,
    'left anchor snippet must not use direct Math.round after snap helper adoption'
  );
});

test('sector-m toolbar shell metric geometry: no command and persistence drift signals', () => {
  const source = readEditorSource();
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
  const readMainStateSnippet = sliceSection(
    source,
    'function readFloatingToolbarState() {',
    'function persistFloatingToolbarState() {'
  );
  const readLeftStateSnippet = sliceSection(
    source,
    'function readLeftFloatingToolbarState() {',
    'function persistLeftFloatingToolbarState() {'
  );

  assert.ok(
    mainDragSnippet.includes("startFloatingToolbarInteraction('move', event);")
      && mainDragSnippet.includes("startFloatingToolbarInteraction('width', event);")
      && mainDragSnippet.includes('toolbarRotateHandles.forEach((handle) => {'),
    'main drag command semantics must stay move width with rotate handle path'
  );
  assert.ok(
    leftDragSnippet.includes("startLeftFloatingToolbarInteraction('move', event);")
      && leftDragSnippet.includes("startLeftFloatingToolbarInteraction('width', event);")
      && leftDragSnippet.includes('leftToolbarRotateHandles.forEach((handle) => {'),
    'left drag command semantics must stay move width with rotate handle path'
  );
  assert.equal(
    source.includes("startFloatingToolbarInteraction('scale', event);")
      || source.includes("startLeftFloatingToolbarInteraction('scale', event);")
      || source.includes("mode === 'scale'"),
    false,
    'scale command path must stay absent'
  );

  assert.equal(
    readMainStateSnippet.includes('parsed.anchorSnap')
      || readMainStateSnippet.includes('parsed.pixelSnap')
      || readMainStateSnippet.includes('parsed.snapStep'),
    false,
    'main persisted state must not add new snap persistence keys'
  );
  assert.equal(
    readLeftStateSnippet.includes('parsed.anchorSnap')
      || readLeftStateSnippet.includes('parsed.pixelSnap')
      || readLeftStateSnippet.includes('parsed.snapStep'),
    false,
    'left persisted state must not add new snap persistence keys'
  );
  assert.ok(
    source.includes('localStorage.setItem(FLOATING_TOOLBAR_STORAGE_KEY, JSON.stringify(floatingToolbarState));')
      && source.includes('localStorage.setItem(LEFT_FLOATING_TOOLBAR_STORAGE_KEY, JSON.stringify(leftFloatingToolbarState));'),
    'persistence wiring must remain unchanged'
  );
});
