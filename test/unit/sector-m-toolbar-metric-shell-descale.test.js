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

test('sector-m toolbar metric shell descale: visual state keeps width-scale channel and strips shell-scale tail', () => {
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

  assert.ok(
    mainVisualSnippet.includes("toolbarShell.style.setProperty(\n    '--floating-toolbar-width-scale',"),
    'main shell visual state must keep width-scale css channel'
  );
  assert.ok(
    mainVisualSnippet.includes("toolbarShell.style.transform = 'none';"),
    'main shell visual state must keep shell transform neutralized'
  );
  assert.ok(
    mainVisualSnippet.includes("toolbarShell.style.removeProperty('--floating-toolbar-scale');"),
    'main shell visual state must strip legacy shell-scale css tail'
  );
  assert.equal(
    mainVisualSnippet.includes("'--floating-toolbar-scale'"),
    true,
    'main shell visual state must only reference legacy scale var for explicit removal'
  );

  assert.ok(
    leftVisualSnippet.includes("leftToolbarShell.style.setProperty('--left-toolbar-width-scale', String(leftFloatingToolbarState.widthScale));"),
    'left shell visual state must keep width-scale css channel'
  );
  assert.ok(
    leftVisualSnippet.includes("leftToolbarShell.style.transform = 'none';"),
    'left shell visual state must keep shell transform neutralized'
  );
  assert.ok(
    leftVisualSnippet.includes("leftToolbarShell.style.removeProperty('--left-toolbar-scale');"),
    'left shell visual state must strip legacy shell-scale css tail'
  );
});

test('sector-m toolbar metric shell descale: drag semantics stay move-width with rotate and no scale command', () => {
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
  assert.ok(mainDragSnippet.includes('toolbarRotateHandles.forEach((handle) => {'));

  assert.ok(leftDragSnippet.includes("startLeftFloatingToolbarInteraction('move', event);"));
  assert.ok(leftDragSnippet.includes("startLeftFloatingToolbarInteraction('width', event);"));
  assert.ok(leftDragSnippet.includes('leftToolbarRotateHandles.forEach((handle) => {'));

  assert.equal(mainDragSnippet.includes("startFloatingToolbarInteraction('scale', event);"), false);
  assert.equal(leftDragSnippet.includes("startLeftFloatingToolbarInteraction('scale', event);"), false);
  assert.equal(source.includes("mode === 'scale'"), false);
});

test('sector-m toolbar metric shell descale: css keeps metric anchors and width-scale formulas without shell scale', () => {
  const styles = readFile('src', 'renderer', 'styles.css');
  const leftShellSection = sliceSection(styles, '.left-floating-toolbar__shell {', '.left-floating-toolbar__shell::before {');
  const mainShellSection = sliceSection(styles, '.floating-toolbar__shell {', '.floating-toolbar__shell::before {');

  assert.ok(leftShellSection.includes('--left-toolbar-cluster-center-x: 0px;'));
  assert.ok(leftShellSection.includes('--left-toolbar-cluster-center-y: 0px;'));
  assert.ok(mainShellSection.includes('--floating-toolbar-cluster-center-x: 0px;'));
  assert.ok(mainShellSection.includes('--floating-toolbar-cluster-center-y: 0px;'));

  assert.ok(leftShellSection.includes('transform: none;'));
  assert.ok(mainShellSection.includes('transform: none;'));
  assert.equal(leftShellSection.includes('transform: scale('), false);
  assert.equal(mainShellSection.includes('transform: scale('), false);

  assert.ok(styles.includes('--floating-toolbar-width-scale: 1;'));
  assert.ok(styles.includes('--left-toolbar-width-scale: 1;'));
  assert.ok(styles.includes('width: calc(132px * var(--floating-toolbar-width-scale));'));
  assert.ok(styles.includes('gap: calc(12px * var(--left-toolbar-width-scale));'));
});
