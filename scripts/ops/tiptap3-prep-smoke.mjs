#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const SEAM_IDS = Object.freeze([
  'text-request-determinism',
  'set-text-determinism',
  'undo-bridge-determinism',
  'redo-bridge-determinism',
  'recovery-restored-normalization-determinism',
]);

const FORCED_NEGATIVE_FAIL_REASON = 'E_TIPTAP_RUNTIME_PROOFHOOK_FORCED_NEGATIVE';
const UNEXPECTED_ERROR_FAIL_REASON = 'E_TIPTAP_RUNTIME_PROOFHOOK_UNEXPECTED';
const SEAM_FAIL_PREFIX = 'E_TIPTAP_RUNTIME_PROOFHOOK_SEAM_FAIL';

function loadModuleByVm(filePath, exportNames, dependencies = {}) {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const dependencySource = Object.entries(dependencies)
    .map(([specifier, names]) => {
      const list = Array.isArray(names) ? names.join(', ') : Object.keys(names || {}).join(', ');
      return `const { ${list} } = __deps[${JSON.stringify(specifier)}];`;
    })
    .join('\n');
  const evalSource = `${dependencySource}\n${sourceText}`
    .replace(
      /import\s*\{\s*composeObservablePayload,\s*parseObservablePayload,\s*\}\s*from\s*['"]\.\.\/documentContentEnvelope\.mjs['"]\s*/u,
      '',
    )
    .replace(/export\s*\{\s*composeObservablePayload,\s*parseObservablePayload\s*\}\s*/u, '')
    .replace(/export function /g, 'function ')
    .concat(`\nmodule.exports = { ${exportNames.join(', ')} };`);

  const context = {
    window: {},
    globalThis: null,
    self: null,
    __deps: dependencies,
    module: { exports: {} },
    exports: {},
    console,
  };
  context.globalThis = context;
  context.self = context;
  vm.createContext(context);
  new vm.Script(evalSource, { filename: filePath }).runInContext(context);
  return {
    exports: context.module.exports,
    context,
  };
}

function parseArgs(argv) {
  const out = { json: false, forceNegative: false };
  for (const token of argv) {
    if (token === '--json') out.json = true;
    if (token === '--force-negative') out.forceNegative = true;
  }
  return out;
}

function evaluateProofhookState(input = {}) {
  const listeners = [];
  const responses = [];
  const setTextListeners = [];
  const receivedPayloads = [];

  const ipcPath = path.resolve('src/renderer/tiptap/ipc.js');
  const runtimeBridgePath = path.resolve('src/renderer/tiptap/runtimeBridge.js');

  const envelopePath = path.resolve('src/renderer/documentContentEnvelope.mjs');
  const envelopeModule = loadModuleByVm(envelopePath, [
    'composeObservablePayload',
    'parseObservablePayload',
  ]).exports;
  const ipcModule = loadModuleByVm(ipcPath, [
    'composeObservablePayload',
    'parseObservablePayload',
    'createTextRequestHandler',
    'createSetTextHandler',
    'attachTiptapIpc',
    'detachTiptapIpc',
    'getTiptapIpcDebugState',
  ], {
    '../documentContentEnvelope.mjs': envelopeModule,
  });
  const runtimeBridgeModule = loadModuleByVm(runtimeBridgePath, [
    'runTiptapUndo',
    'runTiptapRedo',
    'normalizeRecoveryPayload',
  ]).exports;

  ipcModule.context.window.electronAPI = {
    onEditorTextRequest(callback) {
      listeners.push(callback);
    },
    onEditorSetText(callback) {
      setTextListeners.push(callback);
    },
    sendEditorTextResponse(requestId, text) {
      responses.push({ requestId, text });
    },
  };

  const {
    attachTiptapIpc,
    detachTiptapIpc,
    getTiptapIpcDebugState,
  } = ipcModule.exports;
  const { runTiptapUndo, runTiptapRedo, normalizeRecoveryPayload } = runtimeBridgeModule;

  const sessionA = {
    readObservablePayload: () => 'alpha',
    applyIncomingPayload(payload) {
      receivedPayloads.push({ lane: 'A', payload });
    },
  };
  const sessionB = {
    readObservablePayload: () => 'bravo',
    applyIncomingPayload(payload) {
      receivedPayloads.push({ lane: 'B', payload });
    },
  };

  const seamResults = {};

  attachTiptapIpc(sessionA, { attachWindowListeners: true });
  attachTiptapIpc(sessionA, { attachWindowListeners: true });
  const listenersReady = listeners.length === 1 && setTextListeners.length === 1;
  listeners[0]?.({ requestId: 'req-a' });
  attachTiptapIpc(sessionB, { attachWindowListeners: true });
  listeners[0]?.({ requestId: 'req-b' });
  detachTiptapIpc(sessionA);
  listeners[0]?.({ requestId: 'req-c' });
  detachTiptapIpc(sessionB);

  seamResults['text-request-determinism'] = Boolean(
    listenersReady
    && responses[0]?.text === 'alpha'
    && responses[1]?.text === 'bravo'
    && responses[2]?.text === 'bravo'
  );

  attachTiptapIpc(sessionA, { attachWindowListeners: true });
  setTextListeners[0]?.({ content: 'seed-a' });
  attachTiptapIpc(sessionB, { attachWindowListeners: true });
  setTextListeners[0]?.({ content: 'seed-b' });
  seamResults['set-text-determinism'] = Boolean(
    receivedPayloads[0]?.lane === 'A'
    && receivedPayloads[1]?.lane === 'B'
  );

  let undoCalls = 0;
  const undoResult = runTiptapUndo({
    commands: {
      undo() {
        undoCalls += 1;
        return true;
      },
    },
  });
  seamResults['undo-bridge-determinism'] = Boolean(
    undoCalls === 1
    && undoResult.performed === true
    && undoResult.action === 'undo'
    && undoResult.reason === null
  );

  let redoCalls = 0;
  const redoResult = runTiptapRedo({
    commands: {
      redo() {
        redoCalls += 1;
        return false;
      },
    },
  });
  seamResults['redo-bridge-determinism'] = Boolean(
    redoCalls === 1
    && redoResult.performed === false
    && redoResult.action === 'redo'
    && redoResult.reason === null
  );

  const normalizedRecoveryA = normalizeRecoveryPayload({ message: 'Recovered autosave on reopen path', source: 'autosave' });
  const normalizedRecoveryB = normalizeRecoveryPayload({});
  seamResults['recovery-restored-normalization-determinism'] = Boolean(
    normalizedRecoveryA.handled === true
    && normalizedRecoveryA.message === 'Recovered autosave on reopen path'
    && normalizedRecoveryA.source === 'autosave'
    && normalizedRecoveryB.handled === true
    && normalizedRecoveryB.message === 'Recovered autosave on reopen path'
    && normalizedRecoveryB.source === 'unknown'
  );

  const debugState = getTiptapIpcDebugState();
  const allCovered = SEAM_IDS.every((id) => seamResults[id] === true);
  const forcedNegative = Boolean(input.forceNegative);

  if (forcedNegative) {
    return {
      ok: false,
      failReason: FORCED_NEGATIVE_FAIL_REASON,
      coveredSeams: [...SEAM_IDS],
      seamResults,
      debugState,
      forcedNegative: true,
    };
  }

  if (!allCovered) {
    const failedSeam = SEAM_IDS.find((id) => seamResults[id] !== true) || 'unknown';
    return {
      ok: false,
      failReason: `${SEAM_FAIL_PREFIX}:${failedSeam}`,
      coveredSeams: [...SEAM_IDS],
      seamResults,
      debugState,
      forcedNegative: false,
    };
  }

  return {
    ok: true,
    failReason: '',
    coveredSeams: [...SEAM_IDS],
    seamResults,
    debugState,
    forcedNegative: false,
  };
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const forceNegative = args.forceNegative || process.env.TIPTAP3_PREP_SMOKE_FORCE_NEGATIVE === '1';

  let state;
  try {
    state = evaluateProofhookState({ forceNegative });
  } catch (error) {
    state = {
      ok: false,
      failReason: UNEXPECTED_ERROR_FAIL_REASON,
      coveredSeams: [...SEAM_IDS],
      seamResults: {},
      debugState: null,
      forcedNegative: forceNegative,
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`TIPTAP_RUNTIME_PROOFHOOK_OK=${state.ok ? 1 : 0}`);
    console.log(`TIPTAP_RUNTIME_PROOFHOOK_FAIL_REASON=${state.failReason}`);
    console.log(`TIPTAP_RUNTIME_PROOFHOOK_COVERED_SEAMS=${state.coveredSeams.join(',')}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

export { evaluateProofhookState };
