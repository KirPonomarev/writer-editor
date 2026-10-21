#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';
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

// Execute the current Main registration/handler in a bounded, inert host.
// The real caller and envelope laws run; product dispatch is an observation,
// never a product writer. This proves this named route, not arbitrary JS safety
// or a native application journey. Unknown source shapes fail closed.
export function evaluateCommandBridgeRegistration({ mainText, repoRoot }) {
  if (typeof mainText !== 'string') return { ok: false, sourceBound: false, cases: [] };
  const channel = 'ui:command-bridge';
  const begin = "guardedProtocolHandle('ui:command-bridge', async (_, request) => {";
  const start = mainText.indexOf(begin);
  const end = mainText.indexOf('\nconst WORKSPACE_QUERY_BRIDGE_HANDLERS = ', start);
  const policyStart = mainText.indexOf('const IPC_CALLER_IDENTITY_POLICY = {');
  const protocolStart = mainText.indexOf('const guardedProtocolHandle = ');
  const policyEnd = mainText.indexOf('\n});', protocolStart) + '\n});'.length;
  const registrations = mainText.match(/\b(?:ipcMain\.handle|guarded(?:Protocol)?Handle)\(\s*(['"])ui:command-bridge\1/gu) || [];
  const sourceBound = start >= 0 && end > start && end - start < 16000
    && policyStart >= 0 && protocolStart > policyStart && policyEnd > protocolStart
    && policyEnd - policyStart < 16000 && registrations.length === 1
    && /const\s*\{\s*createCapabilityBoundRegistration,\s*createGuardedIpcRegistration,\s*\}\s*=\s*require\('\.\/core\/ipc-caller-identity-v1\.cjs'\)/u.test(mainText)
    && /const\s*\{\s*validateIpcEnvelope,\s*\}\s*=\s*require\('\.\/core\/ipc-envelope-v1\.cjs'\)/u.test(mainText)
    && mainText.includes("const COMMAND_BUS_ROUTE = 'command.bus';");
  if (!sourceBound) return { ok: false, sourceBound: false, cases: [] };

  let createGuardedIpcRegistration;
  let createCapabilityBoundRegistration;
  let validateIpcEnvelope;
  try {
    const requireFromRepo = createRequire(path.join(repoRoot, 'package.json'));
    ({ createGuardedIpcRegistration, createCapabilityBoundRegistration } = requireFromRepo('./src/core/ipc-caller-identity-v1.cjs'));
    ({ validateIpcEnvelope } = requireFromRepo('./src/core/ipc-envelope-v1.cjs'));
  } catch {
    return { ok: false, sourceBound: true, cases: [] };
  }
  const policySource = mainText.slice(policyStart, policyEnd);
  const handlerSource = mainText.slice(start, end);
  const definitions = [
    ['product.allowed', 'product', '', true],
    ['menu.allowed', 'menu', '', true],
    ['caller.sender', 'product', 'sender', false],
    ['caller.session', 'product', 'session', false],
    ['caller.frame', 'product', 'frame', false],
    ['caller.destroyed', 'product', 'destroyed', false],
    ['caller.revoked', 'product', 'revoked', false],
    ['envelope.invalid', 'product', 'envelope', false],
    ['route.invalid', 'product', 'route', false],
    ['command.denied', 'unknown', '', false],
    ['profile.denied', 'product', 'profile', false],
  ];
  const cases = definitions.map(([id, command, fault, allowed]) => {
    const trace = [];
    const handlers = new Map();
    const expectedUrl = 'file:///yalken/renderer/index.html?USE_TIPTAP=1&PRODUCT_PROFILE=WRITER_LOCAL_V1&BRAND_IDENTITY=YALKEN';
    const session = {};
    const shell = { id: 7, session, getURL: () => expectedUrl, isDestroyed: () => fault === 'destroyed' };
    const mainWindow = { webContents: shell, isDestroyed: () => fault === 'revoked' };
    const event = { sender: { id: fault === 'sender' ? 8 : 7, session: fault === 'session' ? {} : session },
      senderFrame: { url: fault === 'frame' ? expectedUrl.replace('USE_TIPTAP=1', 'USE_TIPTAP=0') : expectedUrl } };
    const request = { v: fault === 'envelope' ? 0 : 1, correlationId: 'b2c10-proof', issuedAt: '2026-01-01T00:00:00.000Z',
      route: fault === 'route' ? 'direct' : 'command.bus', commandId: `cmd.${command}`, payload: {} };
    // Invalid envelope must be rejected before interpretation of its route.
    if (fault === 'envelope') Object.defineProperty(request, 'route', {
      enumerable: true, get() { trace.push('interpret-before-envelope-refusal'); return 'command.bus'; },
    });
    const dispatch = (kind, commandId, payload, options) => {
      trace.push(`dispatch.${kind}`);
      if (kind === 'menu' && options?.route !== 'command.bus') trace.push('dispatch.wrong-route');
      return { ok: true, commandId };
    };
    const sandbox = {
      createGuardedIpcRegistration, createCapabilityBoundRegistration, mainWindow,
      getExpectedIpcShellUrl: () => expectedUrl,
      ipcMain: { handle: (name, handler) => { if (handlers.has(name)) throw new Error('DUPLICATE_REGISTRATION'); handlers.set(name, handler); }, on() {} },
      validateIpcEnvelope: (value, name) => {
        trace.push(value === request && name === channel ? 'envelope' : 'envelope.wrong-input');
        return validateIpcEnvelope(value, name);
      },
      normalizeProtocolResult: value => value,
      COMMAND_BUS_ROUTE: 'command.bus',
      UI_COMMAND_BRIDGE_ALLOWED_COMMAND_IDS: new Set(['cmd.product', 'cmd.menu']),
      PRODUCT_COMMAND_ID_SET: new Set(['cmd.product']),
      getWriterLocalRuntimeProfile: () => ({}), getProductCommandRecord: () => ({}),
      evaluateWriterLocalCommandAccess: value => {
        trace.push(value?.commandId === request.commandId ? 'profile' : 'profile.wrong-command');
        return { allowed: fault !== 'profile', reason: 'PROFILE_DENIED' };
      },
      dispatchProductCommandBridge: (...args) => dispatch('product', ...args),
      dispatchMenuCommand: (...args) => dispatch('menu', ...args),
      makeCommandBridgeSuccess: result => result,
      makeCommandBridgeFailure: reason => ({ ok: false, reason }),
      findCommandBridgeFailureReason: result => result?.reason || '',
      makeCommandBridgeException: error => ({ ok: false, reason: error.code || 'EXCEPTION' }),
      handlers, event, request,
    };
    try {
      vm.runInNewContext(`${policySource}\n${handlerSource}\ntry {
        const pending = handlers.get('ui:command-bridge')(event, request);
        Promise.resolve(pending).then(value => { globalThis.observed = value; }, error => { globalThis.refused = true; });
      } catch (error) { globalThis.refused = true; }`, sandbox,
      { timeout: 100, microtaskMode: 'afterEvaluate', contextCodeGeneration: { strings: false, wasm: false } });
      const dispatches = trace.filter(value => value.startsWith('dispatch.'));
      const expectedTrace = ['envelope', 'profile', `dispatch.${command}`];
      const refused = sandbox.refused === true || sandbox.observed?.ok === false;
      const pass = allowed
        ? sandbox.observed?.ok === true && JSON.stringify(trace) === JSON.stringify(expectedTrace)
        : refused && dispatches.length === 0
          && (fault === 'profile' ? JSON.stringify(trace) === '["envelope","profile"]'
            : ['sender', 'session', 'frame', 'destroyed', 'revoked'].includes(fault) ? trace.length === 0
              : JSON.stringify(trace) === '["envelope"]');
      return { id, pass };
    } catch {
      return { id, pass: false };
    }
  });
  return { ok: cases.every(row => row.pass), sourceBound, cases };
}

function collectMatrixRows({ commandState, callerTrustState, registrationState, texts }) {
  const bypassCaseById = new Map(
    (commandState?.bypassSuite?.cases || []).map((entry) => [entry.scenarioId, entry]),
  );

  const rows = [
    {
      routeId: 'command.bus',
      surfaceClass: 'canonical-entry',
      status: hasAll(texts.editor, ['runCommandThroughBus(', 'route: COMMAND_BUS_ROUTE'])
        && hasAll(texts.preload, ['const UI_COMMAND_BRIDGE_CHANNEL = \'ui:command-bridge\';', 'function invokeUiCommand(commandId, payload = {}) {'])
        && registrationState.ok === true
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

  const registrationState = evaluateCommandBridgeRegistration({ mainText: texts.main, repoRoot });
  const coverageMatrix = collectMatrixRows({ commandState, callerTrustState, registrationState, texts });
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
