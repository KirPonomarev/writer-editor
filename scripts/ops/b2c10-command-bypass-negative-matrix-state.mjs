#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateCommandSurfaceState } from './command-surface-state.mjs';
import { evaluateCommandSurfaceCallerTrustPhase2State } from './command-surface-caller-trust-state.mjs';

export const TOKEN_NAME = 'B2C10_COMMAND_BYPASS_NEGATIVE_MATRIX_OK';

const FILES = Object.freeze({
  editor: 'src/renderer/editor.js',
  preload: 'src/preload.js',
  main: 'src/main.js',
  tiptap: 'src/renderer/tiptap/index.js',
  singleEntryContract: 'test/contracts/command-surface-single-entry.contract.test.js',
  busOnlyContract: 'test/contracts/command-surface-bus-only.contract.test.js',
  callerTrustContract: 'test/contracts/command-surface-caller-trust.contract.test.js',
  failsignalRegistry: 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json',
});

const ROW_STATUS = Object.freeze({
  PROVED_APPROVED_ENTRY: 'PROVED_APPROVED_ENTRY',
  PROVED_REJECTED: 'PROVED_REJECTED',
  ADVISORY_GAP: 'ADVISORY_GAP',
  OUT_OF_SCOPE_SIGNAL: 'OUT_OF_SCOPE_SIGNAL',
  FAIL: 'FAIL',
});

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stableSortObject(value) {
  if (Array.isArray(value)) return value.map((entry) => stableSortObject(entry));
  if (!isObjectRecord(value)) return value;
  const out = {};
  for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
    out[key] = stableSortObject(value[key]);
  }
  return out;
}

function stableStringify(value) {
  return JSON.stringify(stableSortObject(value), null, 2);
}

function readText(repoRoot, filePath) {
  try {
    return fs.readFileSync(path.join(repoRoot, filePath), 'utf8');
  } catch {
    return '';
  }
}

function hasAll(text, markers) {
  return markers.every((marker) => text.includes(marker));
}

function collectMatrixRows({ commandState, callerTrustState, texts }) {
  const bypassCaseById = new Map(
    (commandState?.bypassSuite?.cases || []).map((entry) => [entry.scenarioId, entry]),
  );

  const rows = [
    {
      routeId: 'command.bus',
      surfaceClass: 'canonical-entry',
      status: hasAll(texts.editor, ['runCommandThroughBus(', 'route: COMMAND_BUS_ROUTE'])
        && hasAll(texts.preload, ['const UI_COMMAND_BRIDGE_CHANNEL = \'ui:command-bridge\';', 'function invokeUiCommand(commandId, payload = {}) {'])
        && hasAll(texts.main, ["ipcMain.handle('ui:command-bridge', async (_, request) => {", 'dispatchMenuCommand('])
        ? ROW_STATUS.PROVED_APPROVED_ENTRY
        : ROW_STATUS.FAIL,
      evidence: ['editor-dispatch-through-bus', 'preload-ui-command-bridge', 'main-ui-command-bridge'],
    },
    {
      routeId: 'hotkey.direct',
      surfaceClass: 'mandatory-bypass',
      status: bypassCaseById.get('hotkey-bypass')?.pass === true ? ROW_STATUS.PROVED_REJECTED : ROW_STATUS.FAIL,
      evidence: ['command-surface-single-entry', 'command-surface-state'],
    },
    {
      routeId: 'palette.direct',
      surfaceClass: 'mandatory-bypass',
      status: bypassCaseById.get('palette-bypass')?.pass === true ? ROW_STATUS.PROVED_REJECTED : ROW_STATUS.FAIL,
      evidence: ['command-surface-single-entry', 'command-surface-state'],
    },
    {
      routeId: 'ipc.renderer-main.direct',
      surfaceClass: 'mandatory-bypass',
      status: bypassCaseById.get('ipc-direct-bypass')?.pass === true ? ROW_STATUS.PROVED_REJECTED : ROW_STATUS.FAIL,
      evidence: ['command-surface-single-entry', 'command-surface-state'],
    },
    {
      routeId: 'context.button.direct',
      surfaceClass: 'mandatory-bypass',
      status: bypassCaseById.get('context-button-bypass')?.pass === true ? ROW_STATUS.PROVED_REJECTED : ROW_STATUS.FAIL,
      evidence: ['command-surface-single-entry', 'command-surface-state'],
    },
    {
      routeId: 'plugin.overlay.exec',
      surfaceClass: 'mandatory-bypass',
      status: bypassCaseById.get('plugin-overlay-bypass')?.pass === true ? ROW_STATUS.PROVED_REJECTED : ROW_STATUS.FAIL,
      evidence: ['command-surface-single-entry', 'command-surface-state'],
    },
    {
      routeId: 'renderer.direct-command-ipc',
      surfaceClass: 'direct-renderer-bypass',
      status: commandState?.checks?.runCommandBypassAbsent === true
        && texts.busOnlyContract.includes('E_RENDERER_DIRECT_COMMAND_IPC')
        ? ROW_STATUS.PROVED_REJECTED
        : ROW_STATUS.FAIL,
      evidence: ['command-surface-bus-only'],
    },
    {
      routeId: 'menu.direct-handler',
      surfaceClass: 'direct-menu-bypass',
      status: texts.busOnlyContract.includes('E_MAIN_MENU_DIRECT_HANDLER')
        && texts.main.includes('resolveMenuActionToCommand(item.actionId)')
        && texts.main.includes('function buildCommandClickHandler(commandId, payload = {}) {')
        ? ROW_STATUS.PROVED_REJECTED
        : ROW_STATUS.FAIL,
      evidence: ['command-surface-bus-only'],
    },
    {
      routeId: 'ipc.direct-channel',
      surfaceClass: 'direct-ipc-bypass',
      status: texts.busOnlyContract.includes('E_DIRECT_IPC_BYPASS_CHANNEL')
        ? ROW_STATUS.PROVED_REJECTED
        : ROW_STATUS.FAIL,
      evidence: ['command-surface-bus-only'],
    },
    {
      routeId: 'alias.indirection',
      surfaceClass: 'indirection-bypass',
      status: callerTrustState?.aliasIndirectionRuntimeNegativeCheck === true
        ? ROW_STATUS.PROVED_REJECTED
        : ROW_STATUS.FAIL,
      evidence: ['command-surface-caller-trust'],
    },
    {
      routeId: 'untrusted.caller',
      surfaceClass: 'caller-identity-bypass',
      status: callerTrustState?.callerIdentityRequiredCheck === true
        ? ROW_STATUS.PROVED_REJECTED
        : ROW_STATUS.FAIL,
      evidence: ['command-surface-caller-trust'],
    },
    {
      routeId: 'invalid.payload',
      surfaceClass: 'payload-contract-bypass',
      status: callerTrustState?.payloadContractRequiredCheck === true
        ? ROW_STATUS.PROVED_REJECTED
        : ROW_STATUS.FAIL,
      evidence: ['command-surface-caller-trust'],
    },
    {
      routeId: 'interactive.fast-path-replay',
      surfaceClass: 'fast-path-cache-bypass',
      status: callerTrustState?.fastPathCacheRequiredCheck === true
        ? ROW_STATUS.PROVED_REJECTED
        : ROW_STATUS.FAIL,
      evidence: ['command-surface-caller-trust'],
    },
    {
      routeId: 'autosave.request',
      surfaceClass: 'existing-mutation-surface',
      status: ROW_STATUS.ADVISORY_GAP,
      evidence: ['editor-autosave-request', 'preload-autosave-bridge', 'main-autosave-handler'],
    },
    {
      routeId: 'editor.paste-handler',
      surfaceClass: 'existing-mutation-surface',
      status: texts.editor.includes("editor.addEventListener('paste', (event) => {")
        ? ROW_STATUS.ADVISORY_GAP
        : ROW_STATUS.FAIL,
      evidence: ['editor-paste-listener'],
    },
    {
      routeId: 'tree.document.direct-electron-api',
      surfaceClass: 'existing-mutation-surface',
      status: ROW_STATUS.ADVISORY_GAP,
      evidence: ['editor-tree-document-direct-api', 'skipped-tree-document-adoption-tests'],
    },
    {
      routeId: 'save-lifecycle.signal-bridge',
      surfaceClass: 'signal-surface',
      status: hasAll(texts.tiptap, [
        'window.electronAPI.invokeSaveLifecycleSignalBridge({',
        "signalId: 'signal.localDirty.set'",
      ])
        ? ROW_STATUS.OUT_OF_SCOPE_SIGNAL
        : ROW_STATUS.FAIL,
      evidence: ['tiptap-save-lifecycle-signal-bridge'],
    },
    {
      routeId: 'dirty-state.signal-bridge',
      surfaceClass: 'signal-surface',
      status: hasAll(texts.tiptap, ['notifyDirtyState(false)', 'notifyDirtyState(true)'])
        ? ROW_STATUS.OUT_OF_SCOPE_SIGNAL
        : ROW_STATUS.FAIL,
      evidence: ['tiptap-dirty-state-compat-signal'],
    },
  ];

  return rows.sort((a, b) => a.routeId.localeCompare(b.routeId));
}

export function evaluateB2C10CommandBypassNegativeMatrixState(input = {}) {
  const repoRoot = path.resolve(String(input.repoRoot || process.cwd()));
  const texts = {
    editor: readText(repoRoot, FILES.editor),
    preload: readText(repoRoot, FILES.preload),
    main: readText(repoRoot, FILES.main),
    tiptap: readText(repoRoot, FILES.tiptap),
    singleEntryContract: readText(repoRoot, FILES.singleEntryContract),
    busOnlyContract: readText(repoRoot, FILES.busOnlyContract),
    callerTrustContract: readText(repoRoot, FILES.callerTrustContract),
  };

  const commandState = evaluateCommandSurfaceState({
    editorText: texts.editor,
    testFileText: texts.singleEntryContract,
  });
  const callerTrustState = evaluateCommandSurfaceCallerTrustPhase2State({
    repoRoot,
    failsignalRegistryPath: path.join(repoRoot, FILES.failsignalRegistry),
  });

  const coverageMatrix = collectMatrixRows({ commandState, callerTrustState, texts });
  const failRows = coverageMatrix.filter((row) => row.status === ROW_STATUS.FAIL);
  const provedRejectedRows = coverageMatrix.filter((row) => row.status === ROW_STATUS.PROVED_REJECTED);
  const advisoryGapRows = coverageMatrix.filter((row) => row.status === ROW_STATUS.ADVISORY_GAP);
  const outOfScopeRows = coverageMatrix.filter((row) => row.status === ROW_STATUS.OUT_OF_SCOPE_SIGNAL);
  const approvedEntryRows = coverageMatrix.filter((row) => row.status === ROW_STATUS.PROVED_APPROVED_ENTRY);

  let failSignal = '';
  let failReason = '';
  if (!commandState.ok) {
    failSignal = commandState.failSignal || 'E_COMMAND_SURFACE_BYPASS';
    failReason = commandState.failReason || 'COMMAND_SURFACE_CORE_FAILED';
  } else if (!callerTrustState.ok) {
    failSignal = callerTrustState.failSignalCode || 'E_CALLER_IDENTITY_VALIDATION_MISSING';
    failReason = callerTrustState.failReason || 'COMMAND_SURFACE_CALLER_TRUST_FAILED';
  } else if (failRows.length > 0) {
    failSignal = 'E_COMMAND_SURFACE_NEGATIVE_MISSING';
    failReason = `B2C10_MATRIX_ROW_FAILED:${failRows[0].routeId}`;
  }

  const ok = commandState.ok === true
    && callerTrustState.ok === true
    && failRows.length === 0
    && approvedEntryRows.length === 1;

  return {
    schemaVersion: 1,
    contourId: 'B2C10_COMMAND_BYPASS_NEGATIVE_MATRIX',
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignal,
    failReason,
    commandSurfaceCoreOk: commandState.ok === true,
    callerTrustCoreOk: callerTrustState.ok === true,
    admittedMandatoryBypassCount: 5,
    provedRejectedCount: provedRejectedRows.length,
    advisoryGapCount: advisoryGapRows.length,
    outOfScopeSignalCount: outOfScopeRows.length,
    approvedEntryCount: approvedEntryRows.length,
    commandSurfaceState: {
      tokenEnforced: commandState.COMMAND_SURFACE_ENFORCED_OK,
      tokenSingleEntry: commandState.COMMAND_SURFACE_SINGLE_ENTRY_OK,
      tokenBypassTests: commandState.COMMAND_SURFACE_BYPASS_NEGATIVE_TESTS_OK,
      missingScenarioIds: [...(commandState.missingScenarioIds || [])],
    },
    callerTrustState: {
      tokenOk: callerTrustState.COMMAND_SURFACE_CALLER_TRUST_PHASE_2_OK,
      mandatoryBypassScenariosCheck: callerTrustState.mandatoryBypassScenariosCheck,
      callerIdentityRequiredCheck: callerTrustState.callerIdentityRequiredCheck,
      payloadContractRequiredCheck: callerTrustState.payloadContractRequiredCheck,
      aliasIndirectionRuntimeNegativeCheck: callerTrustState.aliasIndirectionRuntimeNegativeCheck,
      fastPathCacheRequiredCheck: callerTrustState.fastPathCacheRequiredCheck,
      advisoryToBlockingDriftCount: callerTrustState.advisoryToBlockingDriftCount,
    },
    coverageMatrix,
    failRows: failRows.map((row) => row.routeId),
    advisoryGapRows: advisoryGapRows.map((row) => row.routeId),
    outOfScopeSignalRows: outOfScopeRows.map((row) => row.routeId),
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`B2C10_COMMAND_SURFACE_CORE_OK=${state.commandSurfaceCoreOk ? 1 : 0}`);
  console.log(`B2C10_CALLER_TRUST_CORE_OK=${state.callerTrustCoreOk ? 1 : 0}`);
  console.log(`B2C10_PROVED_REJECTED_COUNT=${state.provedRejectedCount}`);
  console.log(`B2C10_ADVISORY_GAP_COUNT=${state.advisoryGapCount}`);
  console.log(`B2C10_OUT_OF_SCOPE_SIGNAL_COUNT=${state.outOfScopeSignalCount}`);
  if (!state.ok) {
    console.log(`FAIL_SIGNAL=${state.failSignal}`);
    console.log(`FAIL_REASON=${state.failReason}`);
  }
}

function parseArgs(argv) {
  return {
    json: argv.includes('--json'),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateB2C10CommandBypassNegativeMatrixState({ repoRoot: process.cwd() });
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
