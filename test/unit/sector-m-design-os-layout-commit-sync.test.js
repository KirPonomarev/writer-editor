const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');

function readEditorSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'editor.js'), 'utf8');
}

function readStylesSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'styles.css'), 'utf8');
}

function readBridgeSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'tiptap', 'runtimeBridge.js'), 'utf8');
}

function readRuntimeSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'design-os', 'designOsRuntime.mjs'), 'utf8');
}

function readCompatSource() {
  return fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'design-os', 'repoDesignOsCompat.mjs'), 'utf8');
}

test('layout commit sync: editor runtime keeps design-os layout translators admitted', () => {
  const source = readEditorSource();
  assert.ok(source.includes('buildLayoutPatchFromSpatialState'), 'layout patch translator import must exist');
  assert.ok(source.includes('buildSpatialStateFromLayoutSnapshot'), 'layout snapshot translator import must exist');
  assert.equal(source.includes('syncDesignOsDormantLayoutCommitAtResizeEnd('), false);
});

test('layout commit sync: resize semantics stay independent for left and right sidebars', () => {
  const source = readEditorSource();
  const updateStart = source.indexOf('function updateSpatialResizeFromClientX(clientX)');
  const updateEnd = source.indexOf('function bindCapturedSpatialResizeStream');
  assert.ok(updateStart > -1 && updateEnd > updateStart, 'updateSpatialResizeFromClientX bounds must exist');
  const updateSnippet = source.slice(updateStart, updateEnd);

  assert.ok(updateSnippet.includes("if (spatialResizeDragState.side === 'left')"), 'left branch must exist');
  assert.ok(updateSnippet.includes('nextState.leftSidebarWidth = clampSpatialSidebarWidth('), 'left width must be updated independently');
  assert.ok(updateSnippet.includes('nextState.rightSidebarWidth = clampSpatialSidebarWidth('), 'right width must be updated independently');
  assert.equal(updateSnippet.includes('nextState.leftSidebarWidth = nextWidth;'), false, 'shared width collapse assignment must not exist');
  assert.equal(updateSnippet.includes('nextState.rightSidebarWidth = nextWidth;'), false, 'shared width collapse assignment must not exist');
});

test('layout commit sync: mouse drag path prefers pointer capture and only falls back when capture fails', () => {
  const source = readEditorSource();
  const startStart = source.indexOf('function startSpatialResize(side, event)');
  const startEnd = source.indexOf('function handleSpatialResizeMove(event)');
  assert.ok(startStart > -1 && startEnd > startStart, 'startSpatialResize bounds must exist');
  const startSnippet = source.slice(startStart, startEnd);

  assert.ok(startSnippet.includes('if (bindCapturedSpatialResizeStream(pointerTarget, pointerId)) {'));
  assert.ok(startSnippet.includes("if (event.pointerType === 'mouse') {"));
  assert.ok(startSnippet.includes('if (!spatialResizeDragState.captureBound) {'), 'mouse fallback must be gated by capture failure');
  assert.ok(startSnippet.includes('spatialResizeDragState.mouseFallbackBound = true;'), 'mouse fallback flag must still exist');
  assert.equal(
    startSnippet.includes("if (event.pointerType === 'mouse') {\n    spatialResizeDragState.mouseFallbackBound = true;"),
    false,
    'mouse fallback must not bind unconditionally'
  );
  assert.equal(
    startSnippet.includes(
      "if (bindCapturedSpatialResizeStream(pointerTarget, pointerId)) {\n    spatialResizeDragState.captureBound = true;\n  }\n  if (event.pointerType === 'mouse') {\n    spatialResizeDragState.mouseFallbackBound = true;"
    ),
    false,
    'mouse drag must not allow captureBound and mouseFallbackBound to coexist from the same successful capture path'
  );
});

test('layout commit sync: captured mouse pointermove remains an accepted resize path and resize end keeps committed state', () => {
  const source = readEditorSource();
  const moveStart = source.indexOf('function handleSpatialResizeMove(event)');
  const moveEnd = source.indexOf('function handleSpatialResizeMouseMove(event)');
  assert.ok(moveStart > -1 && moveEnd > moveStart, 'handleSpatialResizeMove bounds must exist');
  const moveSnippet = source.slice(moveStart, moveEnd);

  assert.equal(
    moveSnippet.includes("if (spatialResizeDragState.mouseFallbackBound && event.pointerType === 'mouse') {\n    return;\n  }"),
    false,
    'captured mouse pointermove must not be ignored'
  );
  assert.ok(
    moveSnippet.includes('event.pointerId !== spatialResizeDragState.pointerId'),
    'pointerId guard must remain in place'
  );
  assert.ok(moveSnippet.includes('updateSpatialResizeFromClientX(event.clientX);'));

  const stopStart = source.indexOf('function stopSpatialResize()');
  const stopEnd = source.indexOf('if (sidebar && sidebarResizer) {');
  assert.ok(stopStart > -1 && stopEnd > stopStart, 'stopSpatialResize bounds must exist');
  const stopSnippet = source.slice(stopStart, stopEnd);
  assert.ok(stopSnippet.includes('if (captureBound) {'));
  assert.ok(stopSnippet.includes('if (mouseFallbackBound) {'));
  assert.ok(stopSnippet.includes('if (pointerFallbackBound) {'));
  assert.ok(stopSnippet.includes('commitSpatialLayoutState(currentProjectId);'), 'resize_end must remain the commit point');
});

test('layout commit sync: shell controller preserves dual width model with symmetric defaults', async () => {
  const modulePath = pathToFileURL(path.join(ROOT, 'src', 'renderer', 'design-os', 'designOsShellController.mjs')).href;
  const {
    buildLayoutPatchFromSpatialState,
    buildSpatialStateFromLayoutSnapshot,
  } = await import(modulePath);

  const desktopPatch = buildLayoutPatchFromSpatialState(
    { leftSidebarWidth: 306, rightSidebarWidth: 352 },
    { shellMode: 'CALM_DOCKED', viewportWidth: 1440, viewportHeight: 900, rightVisible: true }
  );
  assert.equal(desktopPatch.left_width, 306);
  assert.equal(desktopPatch.right_width, 352);

  const compactPatch = buildLayoutPatchFromSpatialState(
    {},
    { shellMode: 'COMPACT_DOCKED', viewportWidth: 1180, viewportHeight: 840, rightVisible: true }
  );
  assert.equal(compactPatch.left_width, 260);
  assert.equal(compactPatch.right_width, 260);

  const restored = buildSpatialStateFromLayoutSnapshot(
    { left_width: 318, right_width: 287, viewport_width: 1440 },
    { viewportMode: 'desktop', rightVisible: true }
  );
  assert.equal(restored.leftSidebarWidth, 318);
  assert.equal(restored.rightSidebarWidth, 287);
});

test('layout commit sync: default stylesheet baseline is symmetric for desktop and compact visible-right modes', () => {
  const styles = readStylesSource();
  assert.ok(styles.includes('--app-left-sidebar-width: 290px;'));
  assert.ok(styles.includes('--app-right-sidebar-width: 290px;'));
  assert.ok(styles.includes('--app-left-sidebar-width: 260px;'));
  assert.ok(styles.includes('--app-right-sidebar-width: 260px;'));
});

test('layout commit sync: runtime and design-os compat defaults are symmetric to avoid split-brain baselines', () => {
  const runtimeSource = readRuntimeSource();
  const compatSource = readCompatSource();

  assert.ok(runtimeSource.includes('left_width: 290,'));
  assert.ok(runtimeSource.includes('right_width: 290,'));
  assert.equal(runtimeSource.includes('right_width: 340,'), false);

  assert.ok(compatSource.includes('left_width: 290,'));
  assert.ok(compatSource.includes('right_width: 290,'));
  assert.ok(compatSource.includes('left_width: 260,'));
  assert.ok(compatSource.includes('right_width: 260,'));
  assert.equal(compatSource.includes('right_width: 340,'), false);
});

test('layout commit sync: runtime bridge command surface remains unchanged', () => {
  const source = readEditorSource();

  const statusStart = source.indexOf('function updateStatusText(text)');
  const statusEnd = source.indexOf('function updateSaveStateText(text)');
  assert.ok(statusStart > -1 && statusEnd > statusStart, 'status update bounds must exist');
  const statusSnippet = source.slice(statusStart, statusEnd);
  assert.ok(statusSnippet.includes('statusElement.textContent = text;'));

  const warningStart = source.indexOf('function updateWarningStateText(text)');
  const warningEnd = source.indexOf('function updatePerfHintText(text)');
  assert.ok(warningStart > -1 && warningEnd > warningStart, 'warning update bounds must exist');
  const warningSnippet = source.slice(warningStart, warningEnd);
  assert.ok(warningSnippet.includes('warningStateElement.textContent = `Warnings: ${text}`;'));

  const perfStart = source.indexOf('function updatePerfHintText(text)');
  const perfEnd = source.indexOf('function buildStatusLineWithDormantYdosHint(text)');
  const perfSnippet = source.slice(perfStart, perfEnd);
  assert.ok(perfSnippet.includes('perfHintElement.textContent = `Perf: ${text}`;'));

  const bridgeSource = readBridgeSource();
  const commands = [...bridgeSource.matchAll(/command === '([^']+)'/g)]
    .map((match) => match[1])
    .filter((command) => command !== 'string');

  assert.deepEqual(commands, [
    'undo',
    'edit-undo',
    'redo',
    'edit-redo',
    'open-settings',
    'safe-reset-shell',
    'restore-last-stable-shell',
    'open-diagnostics',
    'open-recovery',
    'open-export-preview',
    'insert-add-card',
    'format-align-left',
    'toggle-preview',
    'toggle-preview-frame',
    'switch-mode-plan',
    'switch-mode-review',
    'switch-mode-write',
  ]);
});
