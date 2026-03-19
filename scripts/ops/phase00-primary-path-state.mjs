#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateProofhookState } from './tiptap3-prep-smoke.mjs';

const SIGNAL_IDS = Object.freeze([
  'OPEN_SCENE_TEXT_HYDRATION_ON_TIPTAP_PATH',
  'REQUEST_TEXT_SET_TEXT_PATH_PRESENT_FOR_TIPTAP',
  'RUNTIME_COMMAND_BRIDGE_PRESENT_FOR_TIPTAP',
  'RECOVERY_RESTORED_HOOK_PRESENT_FOR_TIPTAP',
  'USE_TIPTAP_GATING_STILL_PRESENT_OR_NOT',
  'LEGACY_EDITOR_PATH_STILL_PRIMARY_OR_NOT',
  'OVERALL_STATUS',
  'OPEN_GAP_IDS',
]);

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE00_PRIMARY_PATH_STATE_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE00_PRIMARY_PATH_STATE_UNEXPECTED';
const FALSE_PASS_GUARD = 'HOLD_IF_USE_TIPTAP_GATING_OR_DUAL_EDITOR_TRUTH_EXISTS';

function parseArgs(argv) {
  const out = { json: false, forceNegative: false };
  for (const token of argv) {
    if (token === '--json') out.json = true;
    if (token === '--force-negative') out.forceNegative = true;
  }
  return out;
}

function readRepoFile(relativePath) {
  const absolutePath = path.resolve(relativePath);
  return fs.readFileSync(absolutePath, 'utf8');
}

function hasAny(sourceText, patterns) {
  return patterns.every((pattern) => pattern.test(sourceText));
}

function asSignal(status, measured, evidenceSourceIds, note) {
  return { status, measured, evidenceSourceIds, note };
}

function evaluateSourceSignals() {
  const mainSource = readRepoFile('src/main.js');
  const editorSource = readRepoFile('src/renderer/editor.js');
  const tiptapIndexSource = readRepoFile('src/renderer/tiptap/index.js');
  const tiptapIpcSource = readRepoFile('src/renderer/tiptap/ipc.js');
  const runtimeBridgeSource = readRepoFile('src/renderer/tiptap/runtimeBridge.js');
  const runtimeProofhookState = evaluateProofhookState({ forceNegative: false });

  const signalStatusById = {};

  const openSceneHydrationPresent = hasAny(mainSource, [
    /webContents\.send\('editor:set-text'/,
  ]) && hasAny(tiptapIndexSource, [
    /applyIncomingPayload\(payload\)/,
    /editor\.commands\.setContent\(/,
    /textToDoc\(/,
  ]) && hasAny(tiptapIpcSource, [
    /onEditorSetText/,
    /createSetTextHandler/,
    /applyIncomingPayload/,
  ]);
  signalStatusById.OPEN_SCENE_TEXT_HYDRATION_ON_TIPTAP_PATH = asSignal(
    openSceneHydrationPresent ? 'GREEN' : 'OPEN_GAP',
    true,
    ['src/main.js', 'src/renderer/tiptap/index.js', 'src/renderer/tiptap/ipc.js'],
    openSceneHydrationPresent ? 'SOURCE_WIRING_PRESENT' : 'MISSING_REQUIRED_WIRING',
  );

  const requestSetTextPathPresent = hasAny(tiptapIpcSource, [
    /createTextRequestHandler/,
    /createSetTextHandler/,
    /onEditorTextRequest/,
    /onEditorSetText/,
  ]) && runtimeProofhookState?.seamResults?.['text-request-determinism'] === true
    && runtimeProofhookState?.seamResults?.['set-text-determinism'] === true;
  signalStatusById.REQUEST_TEXT_SET_TEXT_PATH_PRESENT_FOR_TIPTAP = asSignal(
    requestSetTextPathPresent ? 'GREEN' : 'OPEN_GAP',
    true,
    ['src/renderer/tiptap/ipc.js', 'scripts/ops/tiptap3-prep-smoke.mjs'],
    requestSetTextPathPresent ? 'STATIC_AND_PROOFHOOK_EVIDENCE_GREEN' : 'STATIC_OR_PROOFHOOK_EVIDENCE_MISSING',
  );

  const runtimeCommandBridgePresent = hasAny(tiptapIndexSource, [
    /onRuntimeCommand/,
    /handleRuntimeCommand/,
    /createTiptapRuntimeBridge/,
  ]) && hasAny(runtimeBridgeSource, [
    /runTiptapUndo/,
    /runTiptapRedo/,
    /handleRuntimeCommand/,
  ]) && runtimeProofhookState?.seamResults?.['undo-bridge-determinism'] === true
    && runtimeProofhookState?.seamResults?.['redo-bridge-determinism'] === true;
  signalStatusById.RUNTIME_COMMAND_BRIDGE_PRESENT_FOR_TIPTAP = asSignal(
    runtimeCommandBridgePresent ? 'GREEN' : 'OPEN_GAP',
    true,
    ['src/renderer/tiptap/index.js', 'src/renderer/tiptap/runtimeBridge.js', 'scripts/ops/tiptap3-prep-smoke.mjs'],
    runtimeCommandBridgePresent ? 'STATIC_AND_PROOFHOOK_EVIDENCE_GREEN' : 'STATIC_OR_PROOFHOOK_EVIDENCE_MISSING',
  );

  const recoveryHookPresent = hasAny(tiptapIndexSource, [
    /onRecoveryRestored/,
    /handleRecoveryRestored/,
  ]) && hasAny(runtimeBridgeSource, [
    /normalizeRecoveryPayload/,
    /handleRecoveryRestored/,
  ]) && runtimeProofhookState?.seamResults?.['recovery-restored-normalization-determinism'] === true;
  signalStatusById.RECOVERY_RESTORED_HOOK_PRESENT_FOR_TIPTAP = asSignal(
    recoveryHookPresent ? 'GREEN' : 'OPEN_GAP',
    true,
    ['src/renderer/tiptap/index.js', 'src/renderer/tiptap/runtimeBridge.js', 'scripts/ops/tiptap3-prep-smoke.mjs'],
    recoveryHookPresent ? 'STATIC_AND_PROOFHOOK_EVIDENCE_GREEN' : 'STATIC_OR_PROOFHOOK_EVIDENCE_MISSING',
  );

  const useTiptapGatingStillPresent = hasAny(editorSource, [
    /if\s*\(\s*window\.__USE_TIPTAP\s*\)/,
    /}\s*else\s*{/,
  ]) && hasAny(mainSource, [
    /process\.env\.USE_TIPTAP\s*===\s*'1'/,
    /USE_TIPTAP:\s*\(process\.env\.USE_TIPTAP === '1' \? '1' : '0'\)/,
  ]);
  signalStatusById.USE_TIPTAP_GATING_STILL_PRESENT_OR_NOT = asSignal(
    useTiptapGatingStillPresent ? 'OPEN_GAP' : 'GREEN',
    true,
    ['src/main.js', 'src/renderer/editor.js'],
    useTiptapGatingStillPresent ? 'GATING_PRESENT' : 'GATING_REMOVED',
  );

  const legacyPathBlockPresent = hasAny(editorSource, [
    /if\s*\(\s*window\.__USE_TIPTAP\s*\)\s*{/,
    /initTiptap\(document\.getElementById\('editor'\)\);/,
    /}\s*else\s*{/,
    /window\.electronAPI\.onEditorSetText\(/,
  ]);
  const legacyPrimaryDependencePresent = legacyPathBlockPresent && hasAny(mainSource, [
    /USE_TIPTAP:\s*\(process\.env\.USE_TIPTAP === '1' \? '1' : '0'\)/,
  ]);
  signalStatusById.LEGACY_EDITOR_PATH_STILL_PRIMARY_OR_NOT = asSignal(
    legacyPrimaryDependencePresent ? 'OPEN_GAP' : 'GREEN',
    true,
    ['src/main.js', 'src/renderer/editor.js'],
    legacyPrimaryDependencePresent ? 'DUAL_PATH_WITH_ENV_GATING_PRESENT' : 'SINGLE_PRIMARY_PATH_DETECTED',
  );

  const dualTruthStatus = legacyPrimaryDependencePresent ? 'DUAL_TRUTH_EXISTS' : 'SINGLE_TRUTH';
  const greenSignalIds = Object
    .entries(signalStatusById)
    .filter(([, value]) => value.status === 'GREEN')
    .map(([id]) => id);
  const openGapIds = Object
    .entries(signalStatusById)
    .filter(([, value]) => value.status !== 'GREEN')
    .map(([id]) => id);
  const overallStatus = openGapIds.length === 0 ? 'PASS' : 'HOLD';

  return {
    signalStatusById,
    greenSignalIds,
    openGapIds,
    overallStatus,
    dualTruthStatus,
    runtimeProofhookOk: runtimeProofhookState?.ok === true,
  };
}

export function evaluatePhase00PrimaryPathState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const evaluated = evaluateSourceSignals();
    if (forceNegative) {
      return {
        ok: false,
        failReason: FAIL_REASON_FORCED_NEGATIVE,
        requiredSignalIds: [...SIGNAL_IDS],
        overallStatus: 'HOLD',
        signalStatusById: evaluated.signalStatusById,
        greenSignalIds: evaluated.greenSignalIds,
        openGapIds: Array.from(new Set([...evaluated.openGapIds, 'FORCED_NEGATIVE_PATH'])),
        dualTruthStatus: evaluated.dualTruthStatus,
        falsePassGuard: FALSE_PASS_GUARD,
        evidenceSources: [
          'src/main.js',
          'src/renderer/editor.js',
          'src/renderer/tiptap/index.js',
          'src/renderer/tiptap/ipc.js',
          'src/renderer/tiptap/runtimeBridge.js',
          'scripts/ops/tiptap3-prep-smoke.mjs',
        ],
        forcedNegative: true,
      };
    }

    return {
      ok: true,
      failReason: '',
      requiredSignalIds: [...SIGNAL_IDS],
      overallStatus: evaluated.overallStatus,
      signalStatusById: evaluated.signalStatusById,
      greenSignalIds: evaluated.greenSignalIds,
      openGapIds: evaluated.openGapIds,
      dualTruthStatus: evaluated.dualTruthStatus,
      falsePassGuard: FALSE_PASS_GUARD,
      evidenceSources: [
        'src/main.js',
        'src/renderer/editor.js',
        'src/renderer/tiptap/index.js',
        'src/renderer/tiptap/ipc.js',
        'src/renderer/tiptap/runtimeBridge.js',
        'scripts/ops/tiptap3-prep-smoke.mjs',
      ],
      forcedNegative: false,
    };
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      requiredSignalIds: [...SIGNAL_IDS],
      overallStatus: 'HOLD',
      signalStatusById: {},
      greenSignalIds: [],
      openGapIds: [...SIGNAL_IDS],
      dualTruthStatus: 'UNKNOWN',
      falsePassGuard: FALSE_PASS_GUARD,
      evidenceSources: [
        'src/main.js',
        'src/renderer/editor.js',
        'src/renderer/tiptap/index.js',
        'src/renderer/tiptap/ipc.js',
        'src/renderer/tiptap/runtimeBridge.js',
        'scripts/ops/tiptap3-prep-smoke.mjs',
      ],
      forcedNegative: forceNegative,
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const forceNegative = args.forceNegative || process.env.PHASE00_PRIMARY_PATH_STATE_FORCE_NEGATIVE === '1';
  const state = evaluatePhase00PrimaryPathState({ forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE00_PRIMARY_PATH_STATE_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE00_PRIMARY_PATH_STATE_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE00_PRIMARY_PATH_STATE_DUAL_TRUTH_STATUS=${state.dualTruthStatus}`);
    console.log(`PHASE00_PRIMARY_PATH_STATE_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE00_PRIMARY_PATH_STATE_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}
