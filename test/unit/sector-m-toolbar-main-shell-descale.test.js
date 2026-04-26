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

test('sector-m toolbar main shell descale: main runtime removes shell scale branch and keeps move/width/rotate', () => {
  const source = readFile('src', 'renderer', 'editor.js');
  const dragFoundationSnippet = sliceSection(
    source,
    'function initializeFloatingToolbarDragFoundation() {',
    'const commandRegistry = createCommandRegistry();'
  );

  assert.ok(
    dragFoundationSnippet.includes("startFloatingToolbarInteraction('move', event);"),
    'main shell drag foundation must keep move handling'
  );
  assert.ok(
    dragFoundationSnippet.includes("startFloatingToolbarInteraction('width', event);"),
    'main shell drag foundation must keep width tuning handling'
  );
  assert.ok(
    dragFoundationSnippet.includes('toolbarRotateHandles.forEach((handle) => {'),
    'main shell drag foundation must keep rotate handling'
  );
  assert.equal(
    dragFoundationSnippet.includes("startFloatingToolbarInteraction('scale', event);"),
    false,
    'main shell scale handle must not bind interaction runtime'
  );
  assert.equal(
    dragFoundationSnippet.includes("} else if (mode === 'scale') {"),
    false,
    'main shell mousemove runtime must not include scale mode branch'
  );
  assert.equal(
    dragFoundationSnippet.includes('[data-toolbar-scale-handle]'),
    false,
    'main shell drag foundation guards must not keep stale scale-handle selector tails'
  );

  const visualSnippet = sliceSection(
    source,
    'function applyFloatingToolbarVisualState() {',
    'function applyFloatingToolbarState(partialState, persist = true) {'
  );
  assert.equal(
    visualSnippet.includes("'--floating-toolbar-scale'"),
    false,
    'main shell visual state must not set floating shell scale css var'
  );

  const anchorSnippet = sliceSection(
    source,
    'function updateToolbarAnchorVars() {',
    'function scheduleToolbarAnchorUpdate() {'
  );
  assert.equal(
    anchorSnippet.includes('floatingToolbarState.scale'),
    false,
    'main shell anchor math must not divide by main shell scale'
  );

  const stateApplySnippet = sliceSection(
    source,
    'function applyFloatingToolbarState(partialState, persist = true) {',
    'function restoreFloatingToolbarPosition() {'
  );
  assert.equal(
    stateApplySnippet.includes('scale:'),
    false,
    'main shell apply state must not keep scale keys'
  );

  const readStateSnippet = sliceSection(
    source,
    'function readFloatingToolbarState() {',
    'function persistFloatingToolbarState() {'
  );
  assert.equal(
    readStateSnippet.includes('scale:'),
    false,
    'main shell persisted state must not keep scale keys'
  );
});

test('sector-m toolbar main shell descale: css keeps main shell descaled and left width tuning intact', () => {
  const stylesSource = readFile('src', 'renderer', 'styles.css');
  assert.equal(
    stylesSource.includes('transform: scale(var(--floating-toolbar-scale));'),
    false,
    'main toolbar shell scale transform must be removed'
  );
  assert.ok(
    stylesSource.includes('--left-toolbar-width-scale'),
    'left toolbar width-scale css variable must stay available'
  );
  assert.ok(
    stylesSource.includes('.left-floating-toolbar__transform-handle--width'),
    'left toolbar width handle css affordance must stay available'
  );
});
