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

test('sector-m toolbar left shell descale: runtime removes shell scale branch and keeps move/width/rotate', () => {
  const source = readFile('src', 'renderer', 'editor.js');
  const dragFoundationSnippet = sliceSection(
    source,
    'function initializeLeftFloatingToolbarDragFoundation() {',
    'function setConfiguratorOpen(nextOpen) {'
  );

  assert.ok(
    dragFoundationSnippet.includes("startLeftFloatingToolbarInteraction('move', event);"),
    'left shell drag foundation must keep move handling'
  );
  assert.ok(
    dragFoundationSnippet.includes("startLeftFloatingToolbarInteraction('width', event);"),
    'left shell drag foundation must keep width tuning handling'
  );
  assert.ok(
    dragFoundationSnippet.includes('leftToolbarRotateHandles.forEach((handle) => {'),
    'left shell drag foundation must keep rotate handling'
  );
  assert.equal(
    dragFoundationSnippet.includes("startLeftFloatingToolbarInteraction('scale', event);"),
    false,
    'left shell scale handle must not bind interaction runtime'
  );
  assert.equal(
    dragFoundationSnippet.includes("} else if (mode === 'scale') {"),
    false,
    'left shell mousemove runtime must not include scale mode branch'
  );

  const visualSnippet = sliceSection(
    source,
    'function applyLeftFloatingToolbarVisualState() {',
    'function applyLeftFloatingToolbarState(partialState, persist = true) {'
  );
  assert.equal(
    visualSnippet.includes("'--left-toolbar-scale'"),
    false,
    'left shell visual state must not set shell scale css var'
  );
  assert.ok(
    visualSnippet.includes("'--left-toolbar-width-scale'"),
    'left shell visual state must keep width-scale css var binding'
  );

  const anchorSnippet = sliceSection(
    source,
    'function updateLeftToolbarAnchorVars() {',
    'function scheduleLeftToolbarAnchorUpdate() {'
  );
  assert.equal(
    anchorSnippet.includes('leftFloatingToolbarState.scale'),
    false,
    'left shell anchor math must not divide by left shell scale'
  );

  const stateApplySnippet = sliceSection(
    source,
    'function applyLeftFloatingToolbarState(partialState, persist = true) {',
    'function restoreLeftFloatingToolbarPosition() {'
  );
  assert.ok(
    stateApplySnippet.includes('scale: 1,'),
    'left shell apply state must hard-reset scale to 1'
  );
  assert.equal(
    stateApplySnippet.includes('FLOATING_TOOLBAR_SCALE_MIN'),
    false,
    'left shell apply state must not clamp shell scale'
  );

  const readStateSnippet = sliceSection(
    source,
    'function readLeftFloatingToolbarState() {',
    'function persistLeftFloatingToolbarState() {'
  );
  assert.ok(
    readStateSnippet.includes('scale: 1,'),
    'left shell persisted state must sanitize scale to 1'
  );
  assert.equal(
    readStateSnippet.includes('const scale = Number(parsed.scale);'),
    false,
    'left shell persisted state must not consume saved scale values'
  );

  const stylesSource = readFile('src', 'renderer', 'styles.css');
  assert.equal(
    stylesSource.includes('transform: scale(var(--left-toolbar-scale));'),
    false,
    'left shell css must not apply shell scale transform'
  );
  assert.ok(
    stylesSource.includes('gap: calc(12px * var(--left-toolbar-width-scale));'),
    'left shell css must keep width-scale spacing path'
  );
  assert.ok(
    stylesSource.includes('.left-floating-toolbar__transform-handle--rotate'),
    'left shell css must keep rotate handle affordance'
  );
  assert.ok(
    stylesSource.includes('.left-floating-toolbar__transform-handle--width'),
    'left shell css must keep width handle affordance'
  );
});
