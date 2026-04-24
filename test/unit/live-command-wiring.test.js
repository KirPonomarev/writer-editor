const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = process.cwd();

async function loadModules() {
  const registry = await import(pathToFileURL(path.join(ROOT, 'src', 'renderer', 'commands', 'registry.mjs')).href);
  const runner = await import(pathToFileURL(path.join(ROOT, 'src', 'renderer', 'commands', 'runCommand.mjs')).href);
  const project = await import(pathToFileURL(path.join(ROOT, 'src', 'renderer', 'commands', 'projectCommands.mjs')).href);
  const bus = await import(pathToFileURL(path.join(ROOT, 'src', 'renderer', 'commands', 'commandBusGuard.mjs')).href);
  return {
    createCommandRegistry: registry.createCommandRegistry,
    createCommandRunner: runner.createCommandRunner,
    registerProjectCommands: project.registerProjectCommands,
    EXTRA_COMMAND_IDS: project.EXTRA_COMMAND_IDS,
    COMMAND_BUS_ROUTE: bus.COMMAND_BUS_ROUTE,
    runCommandThroughBus: bus.runCommandThroughBus,
  };
}

async function loadRuntimeBridgeModule() {
  const source = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'tiptap', 'runtimeBridge.js'), 'utf8');
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`);
}

test('live command wiring: right rail controls pass command bus and mutate UI state handlers', async () => {
  const {
    createCommandRegistry,
    createCommandRunner,
    registerProjectCommands,
    EXTRA_COMMAND_IDS,
    COMMAND_BUS_ROUTE,
    runCommandThroughBus,
  } = await loadModules();

  const state = {
    formatId: 'A4',
    orientation: 'portrait',
    previewEnabled: false,
    frameMode: true,
  };
  const registry = createCommandRegistry();
  registerProjectCommands(registry, {
    electronAPI: {},
    uiActions: {
      setPreviewFormat({ formatId } = {}) {
        state.formatId = formatId;
        return { formatId };
      },
      setPreviewOrientation({ orientation } = {}) {
        state.orientation = orientation;
        return { orientation };
      },
      togglePreview() {
        state.previewEnabled = !state.previewEnabled;
        return { enabled: state.previewEnabled };
      },
      togglePreviewFrame() {
        state.frameMode = !state.frameMode;
        return { frameMode: state.frameMode };
      },
    },
  });
  const runCommand = createCommandRunner(registry, {
    capability: { defaultPlatformId: 'node' },
  });
  const dispatch = (commandId) => runCommandThroughBus(runCommand, commandId, {}, {
    route: COMMAND_BUS_ROUTE,
    callerId: 'context-button',
  });

  const a5 = await dispatch(EXTRA_COMMAND_IDS.VIEW_PREVIEW_FORMAT_A5);
  assert.equal(a5.ok, true);
  assert.equal(state.formatId, 'A5');

  const letter = await dispatch(EXTRA_COMMAND_IDS.VIEW_PREVIEW_FORMAT_LETTER);
  assert.equal(letter.ok, true);
  assert.equal(state.formatId, 'LETTER');

  const a4 = await dispatch(EXTRA_COMMAND_IDS.VIEW_PREVIEW_FORMAT_A4);
  assert.equal(a4.ok, true);
  assert.equal(state.formatId, 'A4');
  assert.equal(state.orientation, 'portrait');

  const landscape = await dispatch(EXTRA_COMMAND_IDS.VIEW_PREVIEW_ORIENTATION_LANDSCAPE);
  assert.equal(landscape.ok, true);
  assert.equal(state.orientation, 'landscape');
  assert.equal(state.formatId, 'A4');

  const portrait = await dispatch(EXTRA_COMMAND_IDS.VIEW_PREVIEW_ORIENTATION_PORTRAIT);
  assert.equal(portrait.ok, true);
  assert.equal(state.orientation, 'portrait');
  assert.equal(state.formatId, 'A4');

  const preview = await dispatch(EXTRA_COMMAND_IDS.VIEW_TOGGLE_PREVIEW);
  assert.equal(preview.ok, true);
  assert.equal(state.previewEnabled, true);

  const frame = await dispatch(EXTRA_COMMAND_IDS.VIEW_TOGGLE_PREVIEW_FRAME);
  assert.equal(frame.ok, true);
  assert.equal(state.frameMode, false);

  const frameAgain = await dispatch(EXTRA_COMMAND_IDS.VIEW_TOGGLE_PREVIEW_FRAME);
  assert.equal(frameAgain.ok, true);
  assert.equal(state.frameMode, true);
});

test('live command wiring: TipTap runtime bridge forwards format commands without DOM mutation', async () => {
  const { createTiptapRuntimeBridge } = await loadRuntimeBridgeModule();
  const formatCalls = [];
  const orientationCalls = [];
  const bridge = createTiptapRuntimeBridge({
    runtimeHandlers: {
      setPreviewFormat(formatId) {
        formatCalls.push(formatId);
      },
      setPreviewOrientation(orientation) {
        orientationCalls.push(orientation);
      },
    },
  });

  assert.deepEqual(bridge.handleRuntimeCommand({ commandId: 'cmd.project.view.previewFormatA5' }), {
    handled: true,
    result: {
      performed: true,
      action: 'cmd.project.view.previewFormatA5',
      reason: null,
    },
    commandId: 'cmd.project.view.previewFormatA5',
  });
  assert.deepEqual(bridge.handleRuntimeCommand({ command: 'switch-preview-format-letter' }), {
    handled: true,
    result: {
      performed: true,
      action: 'switch-preview-format-letter',
      reason: null,
    },
    command: 'switch-preview-format-letter',
  });
  assert.deepEqual(formatCalls, ['A5', 'LETTER']);
  assert.deepEqual(bridge.handleRuntimeCommand({ commandId: 'cmd.project.view.previewOrientationLandscape' }), {
    handled: true,
    result: {
      performed: true,
      action: 'cmd.project.view.previewOrientationLandscape',
      reason: null,
    },
    commandId: 'cmd.project.view.previewOrientationLandscape',
  });
  assert.deepEqual(bridge.handleRuntimeCommand({ command: 'switch-preview-orientation-portrait' }), {
    handled: true,
    result: {
      performed: true,
      action: 'switch-preview-orientation-portrait',
      reason: null,
    },
    command: 'switch-preview-orientation-portrait',
  });
  assert.deepEqual(orientationCalls, ['landscape', 'portrait']);
});

test('live command wiring: TipTap runtime bridge forwards preview frame toggle without DOM mutation', async () => {
  const { createTiptapRuntimeBridge } = await loadRuntimeBridgeModule();
  let frameToggleCount = 0;
  const bridge = createTiptapRuntimeBridge({
    runtimeHandlers: {
      togglePreviewFrame() {
        frameToggleCount += 1;
        return { performed: true, frameMode: frameToggleCount % 2 === 0 };
      },
    },
  });

  assert.deepEqual(bridge.handleRuntimeCommand({ commandId: 'cmd.project.view.togglePreviewFrame' }), {
    handled: true,
    result: {
      performed: true,
      frameMode: false,
    },
    commandId: 'cmd.project.view.togglePreviewFrame',
  });
  assert.deepEqual(bridge.handleRuntimeCommand({ command: 'toggle-preview-frame' }), {
    handled: true,
    result: {
      performed: true,
      frameMode: true,
    },
    command: 'toggle-preview-frame',
  });
  assert.equal(frameToggleCount, 2);
});

test('live command wiring: command capability binding stays explicit and denies unknown project commands', async () => {
  const { createCommandRegistry, createCommandRunner } = await loadModules();
  const registry = createCommandRegistry();
  let calls = 0;
  registry.registerCommand('cmd.project.view.previewFormatCustom', async () => {
    calls += 1;
    return { ok: true, value: { performed: true } };
  });
  const runCommand = createCommandRunner(registry, {
    capability: { defaultPlatformId: 'node' },
  });

  const result = await runCommand('cmd.project.view.previewFormatCustom');
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'E_CAPABILITY_ENFORCEMENT_MISSING');
  assert.equal(calls, 0);
});
