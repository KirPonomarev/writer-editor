#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluatePhase00NoInputLossRollup } from './phase00-no-input-loss-rollup.mjs';
import { evaluatePhase00PrimaryPathState } from './phase00-primary-path-state.mjs';

const REQUIRED_SIGNAL_IDS = Object.freeze([
  'NIL_IME_COMPOSITION_CURRENT_ROLLUP_STATUS',
  'TIPTAP_PRIMARY_PATH_COMPOSITION_HANDLER_PRESENT_OR_NOT',
  'REAL_MACHINE_IME_EVIDENCE_PRESENT_OR_NOT',
  'LEGACY_ONLY_INPUT_HOOKS_PRESENT_OR_NOT',
  'AUTOMATION_FRONTIER_STATUS',
  'OVERALL_STATUS',
  'OPEN_GAP_IDS',
]);

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE00_IME_COMPOSITION_STATE_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE00_IME_COMPOSITION_STATE_UNEXPECTED';
const FALSE_PASS_GUARD = 'NO_PASS_WITHOUT_REAL_PRIMARY_PATH_IME_EVIDENCE';
const AUTOMATION_FRONTIER_NEEDS_HARNESS = 'REAL_RENDERER_OR_ELECTRON_HARNESS_REQUIRED';
const AUTOMATION_FRONTIER_MEASURED = 'AUTOMATION_PATH_HAS_REAL_PRIMARY_PATH_IME_EVIDENCE';

function parseArgs(argv) {
  const out = { json: false, forceNegative: false };
  for (const token of argv) {
    if (token === '--json') out.json = true;
    if (token === '--force-negative') out.forceNegative = true;
  }
  return out;
}

function asSignal(status, measured, evidenceSourceIds, note) {
  return {
    status,
    measured,
    evidenceSourceIds,
    note,
  };
}

function hasAny(sourceText, patterns) {
  return patterns.some((pattern) => pattern.test(sourceText));
}

const IME_EVIDENCE_CANDIDATE_PATHS = Object.freeze([
  'PHASE00_IME_REAL_EVIDENCE_V1.json',
  'docs/OPS/STATUS/PHASE00_IME_REAL_EVIDENCE_V1.json',
]);

function readImeEvidenceArtifact() {
  for (const relativePath of IME_EVIDENCE_CANDIDATE_PATHS) {
    const absolutePath = path.resolve(relativePath);
    if (!fs.existsSync(absolutePath)) continue;
    try {
      const payload = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
      return {
        present: true,
        path: relativePath,
        payload,
      };
    } catch {
      return {
        present: true,
        path: relativePath,
        payload: null,
      };
    }
  }

  return {
    present: false,
    path: '',
    payload: null,
  };
}

function evaluateImeSignals() {
  const rollup = evaluatePhase00NoInputLossRollup({ forceNegative: false });
  const primaryPath = evaluatePhase00PrimaryPathState({ forceNegative: false });
  const tiptapSource = fs.readFileSync(path.resolve('src/renderer/tiptap/index.js'), 'utf8');
  const imeEvidence = readImeEvidenceArtifact();

  const rollupImeStatus = rollup?.caseStatusById?.NIL_IME_COMPOSITION?.status || 'OPEN_GAP';
  const rollupImeOpenGap = rollupImeStatus !== 'GREEN';

  const tiptapCompositionHandlerPresent = hasAny(tiptapSource, [
    /new Editor\(/,
    /StarterKit/,
    /setContent\(/,
  ]);

  const primaryPathPass = primaryPath?.overallStatus === 'PASS';
  const legacyOnlyHooksPresent = !primaryPathPass;
  const realMachineImeEvidencePresent = imeEvidence.present
    && imeEvidence.payload
    && imeEvidence.payload.status === 'PASS'
    && !rollupImeOpenGap
    && primaryPathPass
    && tiptapCompositionHandlerPresent;
  const automationFrontierStatus = realMachineImeEvidencePresent
    ? AUTOMATION_FRONTIER_MEASURED
    : AUTOMATION_FRONTIER_NEEDS_HARNESS;

  const signalStatusById = {};
  signalStatusById.NIL_IME_COMPOSITION_CURRENT_ROLLUP_STATUS = asSignal(
    rollupImeOpenGap ? 'OPEN_GAP' : 'GREEN',
    true,
    ['phase00-no-input-loss-rollup.mjs'],
    rollupImeOpenGap ? 'ROLLUP_REPORTS_IME_OPEN_GAP' : 'ROLLUP_REPORTS_IME_GREEN',
  );
  signalStatusById.TIPTAP_PRIMARY_PATH_COMPOSITION_HANDLER_PRESENT_OR_NOT = asSignal(
    tiptapCompositionHandlerPresent ? 'GREEN' : 'OPEN_GAP',
    true,
    ['src/renderer/tiptap/index.js'],
    tiptapCompositionHandlerPresent ? 'Tiptap_COMPOSITION_HOOK_FOUND' : 'NO_TIPTAP_COMPOSITION_HOOK_IN_SOURCE',
  );
  signalStatusById.REAL_MACHINE_IME_EVIDENCE_PRESENT_OR_NOT = asSignal(
    realMachineImeEvidencePresent ? 'GREEN' : 'OPEN_GAP',
    imeEvidence.present,
    ['phase00-no-input-loss-rollup.mjs', imeEvidence.path || 'src/renderer/tiptap/index.js'],
    realMachineImeEvidencePresent ? 'REAL_PRIMARY_PATH_IME_EVIDENCE_PRESENT' : 'REAL_PRIMARY_PATH_IME_EVIDENCE_MISSING',
  );
  signalStatusById.LEGACY_ONLY_INPUT_HOOKS_PRESENT_OR_NOT = asSignal(
    legacyOnlyHooksPresent ? 'OPEN_GAP' : 'GREEN',
    true,
    ['phase00-primary-path-state.mjs'],
    legacyOnlyHooksPresent
      ? 'PRIMARY_PATH_NOT_YET_SINGLE_TRUTH'
      : 'NO_LEGACY_ONLY_INPUT_HOOK_DEPENDENCE',
  );
  signalStatusById.AUTOMATION_FRONTIER_STATUS = asSignal(
    automationFrontierStatus === AUTOMATION_FRONTIER_NEEDS_HARNESS ? 'OPEN_GAP' : 'GREEN',
    true,
    ['phase00-no-input-loss-rollup.mjs', 'src/renderer/tiptap/index.js', 'src/renderer/editor.js'],
    automationFrontierStatus,
  );

  const greenSignalIds = Object
    .entries(signalStatusById)
    .filter(([, signal]) => signal.status === 'GREEN')
    .map(([id]) => id);
  const openGapIds = Object
    .entries(signalStatusById)
    .filter(([, signal]) => signal.status !== 'GREEN')
    .map(([id]) => id);
  const overallStatus = openGapIds.length === 0 ? 'PASS' : 'HOLD';

  return {
    signalStatusById,
    greenSignalIds,
    openGapIds,
    overallStatus,
    automationFrontierStatus,
  };
}

export function evaluatePhase00ImeCompositionState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const evaluated = evaluateImeSignals();

    if (forceNegative) {
      return {
        ok: false,
        failReason: FAIL_REASON_FORCED_NEGATIVE,
        requiredSignalIds: [...REQUIRED_SIGNAL_IDS],
        signalStatusById: evaluated.signalStatusById,
        greenSignalIds: evaluated.greenSignalIds,
        openGapIds: Array.from(new Set([...evaluated.openGapIds, 'FORCED_NEGATIVE_PATH'])),
        overallStatus: 'HOLD',
        automationFrontierStatus: evaluated.automationFrontierStatus,
        falsePassGuard: FALSE_PASS_GUARD,
        evidenceSources: [
          'phase00-no-input-loss-rollup.mjs',
          'src/renderer/tiptap/index.js',
          'src/renderer/editor.js',
        ],
        forcedNegative: true,
      };
    }

    return {
      ok: true,
      failReason: '',
      requiredSignalIds: [...REQUIRED_SIGNAL_IDS],
      signalStatusById: evaluated.signalStatusById,
      greenSignalIds: evaluated.greenSignalIds,
      openGapIds: evaluated.openGapIds,
      overallStatus: evaluated.overallStatus,
      automationFrontierStatus: evaluated.automationFrontierStatus,
      falsePassGuard: FALSE_PASS_GUARD,
      evidenceSources: [
        'phase00-no-input-loss-rollup.mjs',
        'src/renderer/tiptap/index.js',
        'src/renderer/editor.js',
      ],
      forcedNegative: false,
    };
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      requiredSignalIds: [...REQUIRED_SIGNAL_IDS],
      signalStatusById: {},
      greenSignalIds: [],
      openGapIds: [...REQUIRED_SIGNAL_IDS],
      overallStatus: 'HOLD',
      automationFrontierStatus: AUTOMATION_FRONTIER_NEEDS_HARNESS,
      falsePassGuard: FALSE_PASS_GUARD,
      evidenceSources: [
        'phase00-no-input-loss-rollup.mjs',
        'src/renderer/tiptap/index.js',
        'src/renderer/editor.js',
      ],
      forcedNegative: forceNegative,
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const forceNegative = args.forceNegative || process.env.PHASE00_IME_COMPOSITION_STATE_FORCE_NEGATIVE === '1';
  const state = evaluatePhase00ImeCompositionState({ forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE00_IME_COMPOSITION_STATE_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE00_IME_COMPOSITION_STATE_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE00_IME_COMPOSITION_STATE_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE00_IME_COMPOSITION_STATE_AUTOMATION_FRONTIER_STATUS=${state.automationFrontierStatus}`);
    console.log(`PHASE00_IME_COMPOSITION_STATE_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}
