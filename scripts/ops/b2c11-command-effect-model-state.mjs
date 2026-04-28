#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const TOKEN_NAME = 'B2C11_COMMAND_EFFECT_MODEL_OK';

const FILES = Object.freeze({
  runCommand: 'src/renderer/commands/runCommand.mjs',
  projectCommands: 'src/renderer/commands/projectCommands.mjs',
  commandEffectModel: 'src/renderer/commands/commandEffectModel.mjs',
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

function readText(repoRoot, relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function collectMatches(text, pattern) {
  return Array.from(text.matchAll(pattern), (match) => String(match[0] || ''));
}

function noForbiddenMarkers(text, markers) {
  return markers.every((marker) => !text.includes(marker));
}

function parseArgs(argv = process.argv.slice(2)) {
  return {
    json: argv.includes('--json'),
  };
}

async function loadCommandEffectModel(repoRoot) {
  const href = pathToFileURL(path.join(repoRoot, FILES.commandEffectModel)).href;
  return import(href);
}

function hasFunctionExports(text) {
  return [
    'export function captureCommandEffectCapabilities',
    'export function buildCommandOperationPlan',
    'export async function persistCommandOperationPlan',
    'export function unwrapBridgeResponseValue',
  ].every((marker) => text.includes(marker));
}

async function evaluateRuntimeProofs(repoRoot) {
  const {
    captureCommandEffectCapabilities,
    buildCommandOperationPlan,
    persistCommandOperationPlan,
    unwrapBridgeResponseValue,
  } = await loadCommandEffectModel(repoRoot);

  const observed = {
    uiCalls: 0,
    bridgeCalls: 0,
  };

  const uiActions = {
    openSettings(payload) {
      observed.uiCalls += 1;
      return { ok: true, payload };
    },
  };
  const electronAPI = {
    invokeUiCommandBridge(request) {
      observed.bridgeCalls += 1;
      return { ok: 1, value: request };
    },
  };

  const uiCaps = captureCommandEffectCapabilities({ uiActions });
  const bridgeCaps = captureCommandEffectCapabilities({ electronAPI });

  const uiPlanA = buildCommandOperationPlan(
    {
      effectType: 'ui-action',
      commandId: 'cmd.project.view.openSettings',
      actionName: 'openSettings',
      payload: { section: 'write' },
    },
    uiCaps,
  );
  const uiPlanB = buildCommandOperationPlan(
    {
      effectType: 'ui-action',
      commandId: 'cmd.project.view.openSettings',
      actionName: 'openSettings',
      payload: { section: 'write' },
    },
    uiCaps,
  );

  const bridgePlan = buildCommandOperationPlan(
    {
      effectType: 'electron-bridge-only',
      commandId: 'cmd.project.tree.createNode',
      payload: { parentPath: 'book', kind: 'scene', name: 'A' },
    },
    bridgeCaps,
  );

  const countsAfterBuild = { ...observed };

  const uiPersist = uiPlanA.ok
    ? await persistCommandOperationPlan(uiPlanA.value, { uiActions })
    : null;
  const bridgePersist = bridgePlan.ok
    ? await persistCommandOperationPlan(bridgePlan.value, { electronAPI })
    : null;

  const unwrappedBridge = unwrapBridgeResponseValue(bridgePersist);

  return {
    commandEffectExportsOk: hasFunctionExports(readText(repoRoot, FILES.commandEffectModel)),
    uiPlanDeterministicOk: stableStringify(uiPlanA) === stableStringify(uiPlanB),
    buildPhaseSideEffectFreeOk: countsAfterBuild.uiCalls === 0 && countsAfterBuild.bridgeCalls === 0,
    persistUiOnlyWriteOk: observed.uiCalls === 1,
    persistBridgeOnlyWriteOk: observed.bridgeCalls === 1,
    bridgeResponseShapeOk: Boolean(
      unwrappedBridge
      && unwrappedBridge.route === 'command.bus'
      && unwrappedBridge.commandId === 'cmd.project.tree.createNode',
    ),
    uiPersistResultOk: Boolean(uiPersist && uiPersist.ok === true),
    bridgePlanOk: Boolean(bridgePlan.ok === true && bridgePlan.value && bridgePlan.value.kind === 'electron-bridge'),
  };
}

export async function evaluateB2C11CommandEffectModelState(input = {}) {
  const repoRoot = path.resolve(String(input.repoRoot || process.cwd()));
  const runCommandText = readText(repoRoot, FILES.runCommand);
  const projectCommandsText = readText(repoRoot, FILES.projectCommands);
  const commandEffectText = readText(repoRoot, FILES.commandEffectModel);

  const runtimeProofs = await evaluateRuntimeProofs(repoRoot);
  const directProjectBridgeCalls = collectMatches(projectCommandsText, /invokeUiCommandBridge\s*\(/g);
  const directProjectBridgePayloadCalls = collectMatches(projectCommandsText, /invokeUiCommandBridge\s*\(\s*\{/g);
  const directWriteMarkers = [
    ...collectMatches(projectCommandsText, /writeFileAtomic/g),
    ...collectMatches(commandEffectText, /writeFileAtomic/g),
    ...collectMatches(runCommandText, /writeFileAtomic/g),
    ...collectMatches(projectCommandsText, /\bfs\./g),
    ...collectMatches(commandEffectText, /\bfs\./g),
    ...collectMatches(runCommandText, /\bfs\./g),
  ];
  const ledgerMarkers = [
    ...collectMatches(projectCommandsText, /\bledger\b/gi),
    ...collectMatches(commandEffectText, /\bledger\b/gi),
  ];
  const recoveryMarkers = [
    ...collectMatches(projectCommandsText, /\brecoveryPack\b/g),
    ...collectMatches(projectCommandsText, /\brestoreDrill\b/g),
    ...collectMatches(commandEffectText, /\brecoveryPack\b/g),
    ...collectMatches(commandEffectText, /\brestoreDrill\b/g),
  ];

  const commandPathChain = Object.freeze([
    'dispatchMenuCommand',
    'runCommandThroughBus',
    'createCommandRunner',
    'registry.handler',
    'buildCommandOperationPlan',
    'persistCommandOperationPlan',
  ]);

  const validatePurityOk = noForbiddenMarkers(runCommandText, [
    'invokeUiCommandBridge(',
    'writeFileAtomic',
    'fs.',
    'ipcMain.',
    'ledger',
  ]);

  const boundaryRefsOk = [
    'runUiAction(',
    'invokeFileLifecycleBridge(',
    'invokeTransferAndFlowCommandBridge(',
    'invokeBridgeOnlyCommand(',
  ].every((marker) => projectCommandsText.includes(marker));

  const noDirectBridgePayloadCallsOk = directProjectBridgePayloadCalls.length === 0;
  const noStorageLeakMarkersOk = directWriteMarkers.length === 0 && ledgerMarkers.length === 0 && recoveryMarkers.length === 0;

  const failRows = [];
  if (!runtimeProofs.commandEffectExportsOk) failRows.push('COMMAND_EFFECT_EXPORTS_MISSING');
  if (!validatePurityOk) failRows.push('VALIDATE_PURITY_RED');
  if (!runtimeProofs.uiPlanDeterministicOk) failRows.push('OPERATION_PLAN_DETERMINISM_RED');
  if (!runtimeProofs.buildPhaseSideEffectFreeOk) failRows.push('BUILD_PHASE_SIDE_EFFECT_RED');
  if (!runtimeProofs.persistUiOnlyWriteOk) failRows.push('PERSIST_UI_BOUNDARY_RED');
  if (!runtimeProofs.persistBridgeOnlyWriteOk) failRows.push('PERSIST_BRIDGE_BOUNDARY_RED');
  if (!runtimeProofs.bridgeResponseShapeOk) failRows.push('BRIDGE_RESPONSE_SHAPE_RED');
  if (!runtimeProofs.uiPersistResultOk) failRows.push('UI_PERSIST_RESULT_RED');
  if (!runtimeProofs.bridgePlanOk) failRows.push('BRIDGE_PLAN_RED');
  if (!boundaryRefsOk) failRows.push('PROJECT_COMMAND_BOUNDARY_REF_MISSING');
  if (!noDirectBridgePayloadCallsOk) failRows.push('DIRECT_PROJECT_BRIDGE_CALL_REMAINS');
  if (!noStorageLeakMarkersOk) failRows.push('STORAGE_LAYER_LEAK_MARKER');

  return {
    ok: failRows.length === 0,
    [TOKEN_NAME]: failRows.length === 0 ? 1 : 0,
    failSignal: failRows.length === 0 ? '' : 'E_COMMAND_EFFECT_MODEL_RED',
    failRows,
    commandPathChain,
    validatePurityOk,
    commandEffectExportsOk: runtimeProofs.commandEffectExportsOk,
    operationPlanDeterministicOk: runtimeProofs.uiPlanDeterministicOk,
    buildPhaseSideEffectFreeOk: runtimeProofs.buildPhaseSideEffectFreeOk,
    persistUiOnlyWriteOk: runtimeProofs.persistUiOnlyWriteOk,
    persistBridgeOnlyWriteOk: runtimeProofs.persistBridgeOnlyWriteOk,
    persistEffectsOnlyWriteOk: runtimeProofs.persistUiOnlyWriteOk && runtimeProofs.persistBridgeOnlyWriteOk,
    bridgeResponseShapeOk: runtimeProofs.bridgeResponseShapeOk,
    boundaryRefsOk,
    directProjectBridgeCallsRemaining: directProjectBridgeCalls,
    directProjectBridgePayloadCallsRemaining: directProjectBridgePayloadCalls,
    directWriteMarkersRemaining: directWriteMarkers,
    ledgerMarkersRemaining: ledgerMarkers,
    recoveryMarkersRemaining: recoveryMarkers,
    advisoryTailRows: [],
    storageRewriteTouched: false,
    transactionProtocolTouched: false,
    recoveryPackTouched: false,
    atomicWriteTouched: false,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = parseArgs();
  const state = await evaluateB2C11CommandEffectModelState({ repoRoot: process.cwd() });
  const json = `${stableStringify(state)}\n`;
  if (args.json) {
    process.stdout.write(json);
  } else {
    process.stdout.write(json);
  }
}
