#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { evaluateGateGraphCheckV1State } from './gate-graph-check-v1-state.mjs';
import { evaluateModeMatrixSingleAuthorityState } from './mode-matrix-single-authority-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P0_CONTOUR/TICKET_05';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/CIRCULAR_DEPENDENCY_BREAK_v3.json';
const DEFAULT_PHASE_SWITCH_PATH = 'docs/OPS/STATUS/PHASE_SWITCH_V1.json';
const DEFAULT_DECLARATION_PATH = 'docs/OPS/STATUS/GATE_DEPENDENCY_DECLARATION_V1.json';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

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

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${stableStringify(value)}\n`, 'utf8');
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    outputDir: DEFAULT_OUTPUT_DIR,
    runId: '',
    ticketId: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--output-dir' && i + 1 < argv.length) {
      out.outputDir = normalizeString(argv[i + 1]) || DEFAULT_OUTPUT_DIR;
      i += 1;
      continue;
    }
    if (arg.startsWith('--output-dir=')) {
      out.outputDir = normalizeString(arg.slice('--output-dir='.length)) || DEFAULT_OUTPUT_DIR;
      continue;
    }

    if (arg === '--run-id' && i + 1 < argv.length) {
      out.runId = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--run-id=')) {
      out.runId = normalizeString(arg.slice('--run-id='.length));
      continue;
    }

    if (arg === '--ticket-id' && i + 1 < argv.length) {
      out.ticketId = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--ticket-id=')) {
      out.ticketId = normalizeString(arg.slice('--ticket-id='.length));
    }
  }

  return out;
}

function createCyclicDeclarationFile(declarationPath) {
  const declarationDoc = JSON.parse(fs.readFileSync(declarationPath, 'utf8'));
  if (!Array.isArray(declarationDoc.checks)) {
    return {
      ok: false,
      reason: 'E_GATE_GRAPH_DECLARATION_INVALID',
      tmpDir: '',
      mutatedPath: '',
      cyclePair: [],
    };
  }

  const idA = 'p0_05_cycle_detection_scc_check';
  const idB = 'p0_05_cycle_component_size_threshold_check';
  const rowA = declarationDoc.checks.find((row) => normalizeString(row?.machineCheckId) === idA);
  const rowB = declarationDoc.checks.find((row) => normalizeString(row?.machineCheckId) === idB);

  if (!rowA || !rowB) {
    return {
      ok: false,
      reason: 'E_GATE_GRAPH_DECLARATION_INVALID',
      tmpDir: '',
      mutatedPath: '',
      cyclePair: [idA, idB],
    };
  }

  rowA.dependsOn = [idB];
  rowB.dependsOn = [idA];

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p0-05-cycle-negative-'));
  const mutatedPath = path.join(tmpDir, 'GATE_DEPENDENCY_DECLARATION_V1.cycle.json');
  fs.writeFileSync(mutatedPath, `${JSON.stringify(declarationDoc, null, 2)}\n`, 'utf8');

  return {
    ok: true,
    reason: '',
    tmpDir,
    mutatedPath,
    cyclePair: [idA, idB],
  };
}

function createPhaseSwitchFile(phaseSwitchPath, activePhase) {
  const phaseSwitchDoc = JSON.parse(fs.readFileSync(phaseSwitchPath, 'utf8'));
  phaseSwitchDoc.activePhase = activePhase;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `p0-05-phase-${activePhase}-`));
  const mutatedPath = path.join(tmpDir, 'PHASE_SWITCH_V1.mutated.json');
  fs.writeFileSync(mutatedPath, `${JSON.stringify(phaseSwitchDoc, null, 2)}\n`, 'utf8');

  return { tmpDir, mutatedPath };
}

function runRepeatablePass3() {
  const runs = [];
  for (let i = 0; i < 3; i += 1) {
    const state = evaluateGateGraphCheckV1State({
      statusPath: DEFAULT_STATUS_PATH,
      phaseSwitchPath: DEFAULT_PHASE_SWITCH_PATH,
      declarationPath: DEFAULT_DECLARATION_PATH,
      mode: 'release',
      skipCycleCheck: false,
    });
    runs.push({
      run: i + 1,
      declarationValid: state.declarationValid,
      cycleDetected: state.cycleDetected,
      cycleComponentCount: state.cycleComponentCount,
      maxCycleComponentSize: state.maxCycleComponentSize,
      productVerdict: state.productVerdict,
      deliveryVerdict: state.deliveryVerdict,
      activePhase: state.activePhase,
    });
  }

  const baseline = JSON.stringify({
    declarationValid: runs[0].declarationValid,
    cycleDetected: runs[0].cycleDetected,
    cycleComponentCount: runs[0].cycleComponentCount,
    maxCycleComponentSize: runs[0].maxCycleComponentSize,
    productVerdict: runs[0].productVerdict,
    deliveryVerdict: runs[0].deliveryVerdict,
    activePhase: runs[0].activePhase,
  });

  const identical = runs.every((entry) => JSON.stringify({
    declarationValid: entry.declarationValid,
    cycleDetected: entry.cycleDetected,
    cycleComponentCount: entry.cycleComponentCount,
    maxCycleComponentSize: entry.maxCycleComponentSize,
    productVerdict: entry.productVerdict,
    deliveryVerdict: entry.deliveryVerdict,
    activePhase: entry.activePhase,
  }) === baseline);

  return {
    ok: identical && runs.every((entry) => entry.declarationValid === true && entry.cycleDetected === false),
    identical,
    runs,
  };
}

function evaluateCycleAndSkipNegatives(cycleDeclarationPath) {
  const cycleRelease = evaluateGateGraphCheckV1State({
    statusPath: DEFAULT_STATUS_PATH,
    phaseSwitchPath: DEFAULT_PHASE_SWITCH_PATH,
    declarationPath: cycleDeclarationPath,
    mode: 'release',
    skipCycleCheck: false,
  });

  const cycleReleaseSkip = evaluateGateGraphCheckV1State({
    statusPath: DEFAULT_STATUS_PATH,
    phaseSwitchPath: DEFAULT_PHASE_SWITCH_PATH,
    declarationPath: cycleDeclarationPath,
    mode: 'release',
    skipCycleCheck: true,
  });

  const cyclePromotionSkip = evaluateGateGraphCheckV1State({
    statusPath: DEFAULT_STATUS_PATH,
    phaseSwitchPath: DEFAULT_PHASE_SWITCH_PATH,
    declarationPath: cycleDeclarationPath,
    mode: 'promotion',
    skipCycleCheck: true,
  });

  return {
    cycleRelease,
    cycleReleaseSkip,
    cyclePromotionSkip,
  };
}

function evaluatePhaseBehavior(cycleDeclarationPath) {
  const phases = ['PHASE_1_SHADOW', 'PHASE_2_WARN', 'PHASE_3_HARD'];
  const phaseRows = [];

  for (const phase of phases) {
    const fixture = createPhaseSwitchFile(DEFAULT_PHASE_SWITCH_PATH, phase);
    try {
      const state = evaluateGateGraphCheckV1State({
        statusPath: DEFAULT_STATUS_PATH,
        phaseSwitchPath: fixture.mutatedPath,
        declarationPath: cycleDeclarationPath,
        mode: 'release',
      });
      phaseRows.push({
        phase,
        deliveryVerdict: state.deliveryVerdict,
        productVerdict: state.productVerdict,
        phaseShouldBlock: state.phaseShouldBlock,
      });
    } finally {
      fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
    }
  }

  const map = new Map(phaseRows.map((row) => [row.phase, row]));
  const ok = map.get('PHASE_1_SHADOW')?.deliveryVerdict === 'WARN'
    && map.get('PHASE_2_WARN')?.deliveryVerdict === 'WARN'
    && map.get('PHASE_3_HARD')?.deliveryVerdict === 'BLOCK'
    && map.get('PHASE_1_SHADOW')?.productVerdict === 'FAIL'
    && map.get('PHASE_2_WARN')?.productVerdict === 'FAIL'
    && map.get('PHASE_3_HARD')?.productVerdict === 'FAIL';

  return {
    ok,
    rows: phaseRows,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const outputDir = path.resolve(repoRoot, args.outputDir || DEFAULT_OUTPUT_DIR);

  const modeState = evaluateModeMatrixSingleAuthorityState({ repoRoot });
  const baseState = evaluateGateGraphCheckV1State({
    statusPath: DEFAULT_STATUS_PATH,
    phaseSwitchPath: DEFAULT_PHASE_SWITCH_PATH,
    declarationPath: DEFAULT_DECLARATION_PATH,
    mode: 'release',
  });

  const cycleFixture = createCyclicDeclarationFile(path.resolve(repoRoot, DEFAULT_DECLARATION_PATH));
  let negatives = null;
  let phaseBehavior = null;
  try {
    if (cycleFixture.ok) {
      negatives = evaluateCycleAndSkipNegatives(cycleFixture.mutatedPath);
      phaseBehavior = evaluatePhaseBehavior(cycleFixture.mutatedPath);
    }
  } finally {
    if (cycleFixture.tmpDir) fs.rmSync(cycleFixture.tmpDir, { recursive: true, force: true });
  }

  const binaryA = {
    ok: Boolean(negatives)
      && negatives.cycleRelease.cycleDetected === true
      && negatives.cycleRelease.maxCycleComponentSize > 1
      && negatives.cycleRelease.stopCode === 'CIRCULAR_GATE_DEPENDENCY',
    reason: cycleFixture.reason || '',
    cyclePair: cycleFixture.cyclePair,
    cycleDetected: negatives ? negatives.cycleRelease.cycleDetected : false,
    maxCycleComponentSize: negatives ? negatives.cycleRelease.maxCycleComponentSize : 0,
    stopCode: negatives ? negatives.cycleRelease.stopCode : '',
    deliveryVerdict: negatives ? negatives.cycleRelease.deliveryVerdict : '',
  };

  const binaryB = {
    ok: baseState.declarationValid === true && baseState.cycleDetected === false,
    declarationValid: baseState.declarationValid,
    cycleDetected: baseState.cycleDetected,
    productVerdict: baseState.productVerdict,
    deliveryVerdict: baseState.deliveryVerdict,
  };

  const binaryC = {
    ok: Boolean(negatives)
      && negatives.cycleReleaseSkip.skipSuppressionAttempted === true
      && negatives.cycleReleaseSkip.skipSuppressionPrevented === true
      && negatives.cycleReleaseSkip.deliveryVerdict !== 'PASS'
      && negatives.cyclePromotionSkip.skipSuppressionAttempted === true
      && negatives.cyclePromotionSkip.skipSuppressionPrevented === true
      && negatives.cyclePromotionSkip.deliveryVerdict !== 'PASS',
    release: negatives ? {
      skipSuppressionAttempted: negatives.cycleReleaseSkip.skipSuppressionAttempted,
      skipSuppressionPrevented: negatives.cycleReleaseSkip.skipSuppressionPrevented,
      deliveryVerdict: negatives.cycleReleaseSkip.deliveryVerdict,
      cycleDetected: negatives.cycleReleaseSkip.cycleDetected,
    } : null,
    promotion: negatives ? {
      skipSuppressionAttempted: negatives.cyclePromotionSkip.skipSuppressionAttempted,
      skipSuppressionPrevented: negatives.cyclePromotionSkip.skipSuppressionPrevented,
      deliveryVerdict: negatives.cyclePromotionSkip.deliveryVerdict,
      cycleDetected: negatives.cyclePromotionSkip.cycleDetected,
    } : null,
  };

  const binaryD = {
    ok: Boolean(phaseBehavior?.ok),
    phaseRows: phaseBehavior?.rows || [],
  };

  const repeatable = runRepeatablePass3();

  const gates = {
    mc_phase_switch_valid: modeState.gates.mc_phase_switch_valid,
    mc_blocking_evaluator_single_authority: modeState.gates.mc_blocking_evaluator_single_authority,
    mc_mode_matrix_consistency: modeState.gates.mc_mode_matrix_consistency,
    mc_advisory_blocking_drift_zero: modeState.gates.mc_advisory_blocking_drift_zero,
    mc_gate_graph_check_v1_phase_aware: binaryD.ok ? 'PASS' : 'FAIL',
    p0_05_cycle_detection_scc_check: binaryA.ok ? 'PASS' : 'FAIL',
    p0_05_cycle_component_size_threshold_check: binaryA.ok ? 'PASS' : 'FAIL',
    p0_05_skip_flag_cannot_suppress_release_promotion_check: binaryC.ok ? 'PASS' : 'FAIL',
    p0_05_explicit_dependencies_only_check: baseState.explicitDependenciesOnly ? 'PASS' : 'FAIL',
    p0_05_repeatable_pass_3runs: repeatable.ok ? 'PASS' : 'FAIL',
  };

  const summary = {
    status: Object.values(gates).every((value) => value === 'PASS') ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    activePhase: baseState.activePhase,
    phaseEnforcementMode: baseState.phaseEnforcementMode,
    graphNodeCount: baseState.graphNodeCount,
    graphEdgeCount: baseState.graphEdgeCount,
    cycleDetected: baseState.cycleDetected,
    cycleComponentCount: baseState.cycleComponentCount,
    maxCycleComponentSize: baseState.maxCycleComponentSize,
    advisoryToBlockingDriftCount: modeState.advisoryToBlockingDriftCount,
    gates,
    generatedAtUtc: new Date().toISOString(),
  };

  const ticketMeta = {
    runId: summary.runId,
    ticketId: summary.ticketId,
    outputDir: path.relative(repoRoot, outputDir).replaceAll(path.sep, '/'),
    generatedAtUtc: summary.generatedAtUtc,
  };

  const driftCases = modeState.details?.authorityState?.driftCases || [];

  writeJson(path.join(outputDir, 'gate-graph-scc-report.json'), {
    gate: 'p0_05_cycle_detection_scc_check',
    ok: binaryA.ok,
    acyclicState: {
      cycleDetected: baseState.cycleDetected,
      cycleComponentCount: baseState.cycleComponentCount,
      maxCycleComponentSize: baseState.maxCycleComponentSize,
      declarationValid: baseState.declarationValid,
      explicitDependenciesOnly: baseState.explicitDependenciesOnly,
    },
    cycleState: negatives ? {
      cycleDetected: negatives.cycleRelease.cycleDetected,
      cycleComponentCount: negatives.cycleRelease.cycleComponentCount,
      maxCycleComponentSize: negatives.cycleRelease.maxCycleComponentSize,
      cycleComponents: negatives.cycleRelease.cycleComponents,
      stopCode: negatives.cycleRelease.stopCode,
      deliveryVerdict: negatives.cycleRelease.deliveryVerdict,
    } : null,
  });

  writeJson(path.join(outputDir, 'cycle-negative-fixtures.json'), {
    gate: 'p0_05_cycle_component_size_threshold_check',
    ok: binaryA.ok,
    fixtureReason: cycleFixture.reason,
    cyclePair: cycleFixture.cyclePair,
    cycleRelease: negatives ? {
      cycleDetected: negatives.cycleRelease.cycleDetected,
      maxCycleComponentSize: negatives.cycleRelease.maxCycleComponentSize,
      stopCode: negatives.cycleRelease.stopCode,
      productVerdict: negatives.cycleRelease.productVerdict,
      deliveryVerdict: negatives.cycleRelease.deliveryVerdict,
    } : null,
    phaseBehavior: binaryD.phaseRows,
  });

  writeJson(path.join(outputDir, 'skip-flag-bypass-negative.json'), {
    gate: 'p0_05_skip_flag_cannot_suppress_release_promotion_check',
    ok: binaryC.ok,
    release: binaryC.release,
    promotion: binaryC.promotion,
  });

  writeJson(path.join(outputDir, 'advisory-blocking-drift-cases.json'), {
    gate: 'mc_advisory_blocking_drift_zero',
    advisory_to_blocking_drift_count: modeState.advisoryToBlockingDriftCount,
    cases: driftCases,
  });

  writeJson(path.join(outputDir, 'summary.json'), summary);
  writeJson(path.join(outputDir, 'ticket-meta.json'), ticketMeta);

  process.stdout.write(`${stableStringify(summary)}\n`);
  process.exit(summary.status === 'PASS' ? 0 : 1);
}

main();
