#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateCommandSurfaceState } from './command-surface-state.mjs';
import { evaluateCommandSurfaceCallerTrustPhase2State } from './command-surface-caller-trust-state.mjs';

const TASK_ID = 'YALKEN_DESIGN_OS_Y6_COMMAND_SEAM_FENCING_001';
const TOKEN_NAME = 'Y6_COMMAND_SEAM_FENCING_OK';

const EDITOR_SOURCE_PATH = 'src/renderer/editor.js';
const PRELOAD_SOURCE_PATH = 'src/preload.js';
const PROJECT_COMMANDS_SOURCE_PATH = 'src/renderer/commands/projectCommands.mjs';
const COMMAND_EFFECT_MODEL_SOURCE_PATH = 'src/renderer/commands/commandEffectModel.mjs';
const MAIN_SOURCE_PATH = 'src/main.js';
const BUNDLE_PATH = 'src/renderer/editor.bundle.js';
const FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';

const FORBIDDEN_EDITOR_DIRECT_CALLS = Object.freeze([
  'window.electronAPI.fileOpen(',
  'window.electronAPI.openDocument(',
  'window.electronAPI.createNode(',
  'window.electronAPI.renameNode(',
  'window.electronAPI.deleteNode(',
  'window.electronAPI.reorderNode(',
]);

const FORBIDDEN_PRELOAD_DIRECT_LIFECYCLE_CALLS = Object.freeze([
  "ipcRenderer.send('ui:new')",
  "ipcRenderer.send('ui:open')",
  "ipcRenderer.send('ui:save')",
  "ipcRenderer.send('ui:save-as')",
  "ipcRenderer.invoke('file:open'",
  "ipcRenderer.invoke('file:save'",
  "ipcRenderer.invoke('file:save-as'",
]);

const FORBIDDEN_PROJECT_COMMANDS_DIRECT_FALLBACKS = Object.freeze([
  'electronAPI.fileOpen(',
  'electronAPI.newFile(',
  'electronAPI.openFile(',
  'electronAPI.fileSave(',
  'electronAPI.saveFile(',
  'electronAPI.fileSaveAs(',
  'electronAPI.saveAs(',
  'electronAPI.exportDocxMin(',
  'electronAPI.importMarkdownV1(',
  'electronAPI.exportMarkdownV1(',
  'electronAPI.openFlowModeV1(',
  'electronAPI.saveFlowModeV1(',
  'electronAPI.openDocument(',
  'electronAPI.createNode(',
  'electronAPI.renameNode(',
  'electronAPI.deleteNode(',
  'electronAPI.reorderNode(',
]);

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function getMtimeMs(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return -1;
  }
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    forceNegative: false,
  };
  for (const rawArg of argv) {
    const arg = String(rawArg || '').trim();
    if (arg === '--json') out.json = true;
    if (arg === '--force-negative') out.forceNegative = true;
  }
  return out;
}

function evaluateY6CommandSeamFencingState(input = {}) {
  const editorSource = typeof input.editorSource === 'string' ? input.editorSource : readText(EDITOR_SOURCE_PATH);
  const preloadSource = typeof input.preloadSource === 'string' ? input.preloadSource : readText(PRELOAD_SOURCE_PATH);
  const projectCommandsSource = typeof input.projectCommandsSource === 'string'
    ? input.projectCommandsSource
    : readText(PROJECT_COMMANDS_SOURCE_PATH);
  const commandEffectModelSource = typeof input.commandEffectModelSource === 'string'
    ? input.commandEffectModelSource
    : readText(COMMAND_EFFECT_MODEL_SOURCE_PATH);
  const mainSource = typeof input.mainSource === 'string' ? input.mainSource : readText(MAIN_SOURCE_PATH);

  const commandSurfaceState = evaluateCommandSurfaceState();
  const callerTrustState = evaluateCommandSurfaceCallerTrustPhase2State({
    repoRoot: process.cwd(),
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  const checks = {
    editorDirectBypassAbsent: FORBIDDEN_EDITOR_DIRECT_CALLS.every((marker) => !editorSource.includes(marker)),
    editorBusDispatchPresent:
      editorSource.includes('dispatchUiCommand(EXTRA_COMMAND_IDS.PROJECT_NEW)') &&
      editorSource.includes('dispatchUiCommand(COMMAND_IDS.PROJECT_OPEN)') &&
      editorSource.includes('dispatchUiCommand(EXTRA_COMMAND_IDS.PROJECT_DOCUMENT_OPEN,') &&
      editorSource.includes('dispatchUiCommand(EXTRA_COMMAND_IDS.TREE_CREATE_NODE,') &&
      editorSource.includes('dispatchUiCommand(EXTRA_COMMAND_IDS.TREE_RENAME_NODE,') &&
      editorSource.includes('dispatchUiCommand(EXTRA_COMMAND_IDS.TREE_DELETE_NODE,') &&
      editorSource.includes('dispatchUiCommand(EXTRA_COMMAND_IDS.TREE_REORDER_NODE,'),
    preloadLifecycleBridgeOnly:
      preloadSource.includes('return invokeUiCommand(PROJECT_NEW_COMMAND_ID, {});') &&
      preloadSource.includes('return invokeUiCommand(PROJECT_OPEN_COMMAND_ID, {});') &&
      preloadSource.includes('return invokeUiCommand(PROJECT_SAVE_COMMAND_ID, {});') &&
      preloadSource.includes('return invokeUiCommand(PROJECT_SAVE_AS_COMMAND_ID, {});') &&
      FORBIDDEN_PRELOAD_DIRECT_LIFECYCLE_CALLS.every((marker) => !preloadSource.includes(marker)),
    projectCommandsBridgeOnly:
      projectCommandsSource.includes('async function invokeFileLifecycleBridge(electronAPI, commandId) {') &&
      projectCommandsSource.includes('async function invokeTransferAndFlowCommandBridge(electronAPI, commandId, payload = {}) {') &&
      projectCommandsSource.includes('async function invokeBridgeOnlyCommand(electronAPI, commandId, payload = {}) {') &&
      projectCommandsSource.includes("effectType: 'electron-bridge-only',") &&
      commandEffectModelSource.includes("if (effectType === 'electron-bridge-only') {") &&
      commandEffectModelSource.includes("kind: 'electron-bridge',") &&
      commandEffectModelSource.includes('route: COMMAND_BRIDGE_ROUTE,') &&
      commandEffectModelSource.includes('electronAPI.invokeUiCommandBridge({') &&
      commandEffectModelSource.includes('route: plan.route,') &&
      commandEffectModelSource.includes('commandId: plan.commandId,') &&
      commandEffectModelSource.includes('payload: plan.payload,') &&
      FORBIDDEN_PROJECT_COMMANDS_DIRECT_FALLBACKS.every((marker) => !projectCommandsSource.includes(marker)),
    mainTrustBoundaryAllowlistPresent:
      mainSource.includes("'cmd.project.new'") &&
      mainSource.includes("'cmd.project.open'") &&
      mainSource.includes("'cmd.project.save'") &&
      mainSource.includes("'cmd.project.saveAs'") &&
      mainSource.includes("'cmd.project.document.open'") &&
      mainSource.includes("'cmd.project.tree.createNode'") &&
      mainSource.includes("'cmd.project.tree.renameNode'") &&
      mainSource.includes("'cmd.project.tree.deleteNode'") &&
      mainSource.includes("'cmd.project.tree.reorderNode'") &&
      mainSource.includes("ipcMain.handle('ui:command-bridge', async (_, request) => {"),
    existingCommandSurfaceStatesGreen:
      commandSurfaceState.ok === true &&
      callerTrustState.ok === true,
    runtimeEntrypointBundleSync:
      fileExists(BUNDLE_PATH) &&
      getMtimeMs(BUNDLE_PATH) >= Math.max(
        getMtimeMs(EDITOR_SOURCE_PATH),
        getMtimeMs(PROJECT_COMMANDS_SOURCE_PATH),
        getMtimeMs('src/renderer/tiptap/ipc.js'),
      ),
  };

  if (input.forceNegative === true) {
    checks.runtimeEntrypointBundleSync = false;
  }

  const ok = Object.values(checks).every((flag) => flag === true);
  const failReason = ok ? '' : (input.forceNegative === true
    ? 'FORCED_NEGATIVE'
    : 'Y6_COMMAND_SEAM_GAP_REMAINS');

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    taskId: TASK_ID,
    failSignal: ok ? '' : 'E_COMMAND_SURFACE_BYPASS',
    failReason,
    checks,
    existingCommandSurfaceSummary: {
      commandSurfaceOk: commandSurfaceState.ok === true,
      callerTrustOk: callerTrustState.ok === true,
    },
    requiredPrChecksPolicySatisfied: ok,
    singleNextMove: 'CONTOUR_Y7_FOUNDATION_STATE_AND_PROOF_REGEN',
    singleNextMoveReason: ok ? 'Y6_COMPLETE_NO_SCOPE_DRIFT' : 'Y6_NOT_COMPLETE',
  };
}

function stableStringify(input) {
  return JSON.stringify(input, null, 2);
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`TASK_ID=${state.taskId}`);
  console.log(`FAIL_SIGNAL=${state.failSignal}`);
  console.log(`FAIL_REASON=${state.failReason}`);
  console.log(`REQUIRED_PR_CHECKS_POLICY_SATISFIED=${state.requiredPrChecksPolicySatisfied ? 'true' : 'false'}`);
  console.log(`SINGLE_NEXT_MOVE=${state.singleNextMove}`);
  console.log(`SINGLE_NEXT_MOVE_REASON=${state.singleNextMoveReason}`);
}

function main() {
  const args = parseArgs();
  const state = evaluateY6CommandSeamFencingState({
    forceNegative: args.forceNegative,
  });

  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
  } else {
    printHuman(state);
  }
  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) {
  main();
}

export { evaluateY6CommandSeamFencingState };
