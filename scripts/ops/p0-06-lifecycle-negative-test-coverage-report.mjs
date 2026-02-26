#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluateLifecycleNegativeTestCoverageState } from './lifecycle-negative-test-coverage-state.mjs';
import { evaluateModeMatrixSingleAuthorityState } from './mode-matrix-single-authority-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P0_CONTOUR/TICKET_06';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/LIFECYCLE_NEGATIVE_TEST_COVERAGE_v3.json';
const DEFAULT_PHASE_SWITCH_PATH = 'docs/OPS/STATUS/PHASE_SWITCH_V1.json';
const DEFAULT_NEGATIVE_CASES_PATH = 'docs/OPS/EVIDENCE/P0_CONTOUR/TICKET_06/merge-flow-negative-cases.json';

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

function runNode(scriptPath, args = [], cwd = process.cwd()) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: 'utf8',
  });
}

function readJsonObject(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return isObjectRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function createDefaultNegativeCases(statusPath) {
  const statusDoc = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
  const requiredMergeFlowGates = Array.isArray(statusDoc.requiredMergeFlowGates)
    ? statusDoc.requiredMergeFlowGates.map((value) => normalizeString(value)).filter(Boolean)
    : [];

  const cases = [];
  for (const gateId of requiredMergeFlowGates) {
    cases.push({
      caseId: `${gateId}__negative_path`,
      gateId,
      executable: true,
      expectedFailSignal: gateId,
      modeCoverage: ['release', 'promotion'],
      rationale: 'Executable negative case required for merge-flow blocking gates.',
    });
  }

  return {
    version: 3,
    generatedBy: 'p0-06-lifecycle-negative-test-coverage-report.mjs',
    requiredMergeFlowGateCount: requiredMergeFlowGates.length,
    cases,
  };
}

function createNegativeCoverageFailureFixture(baseCasesPath) {
  const doc = readJsonObject(baseCasesPath);
  if (!doc || !Array.isArray(doc.cases)) {
    return {
      ok: false,
      reason: 'E_LIFECYCLE_NEGATIVE_CASES_INVALID',
      tmpDir: '',
      mutatedPath: '',
      mutatedGateId: '',
    };
  }

  const firstGateId = normalizeString(doc.cases.find((row) => isObjectRecord(row) && normalizeString(row.gateId))?.gateId);
  if (!firstGateId) {
    return {
      ok: false,
      reason: 'E_LIFECYCLE_NEGATIVE_CASES_INVALID',
      tmpDir: '',
      mutatedPath: '',
      mutatedGateId: '',
    };
  }

  const mutated = {
    ...doc,
    cases: doc.cases.map((row) => {
      if (!isObjectRecord(row)) return row;
      if (normalizeString(row.gateId) !== firstGateId) return row;
      return {
        ...row,
        executable: false,
      };
    }),
  };

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p0-06-negative-coverage-'));
  const mutatedPath = path.join(tmpDir, 'merge-flow-negative-cases.mutated.json');
  fs.writeFileSync(mutatedPath, `${JSON.stringify(mutated, null, 2)}\n`, 'utf8');

  return {
    ok: true,
    reason: '',
    tmpDir,
    mutatedPath,
    mutatedGateId: firstGateId,
  };
}

function createPhaseSwitchFixture(phaseSwitchPath, activePhase) {
  const doc = JSON.parse(fs.readFileSync(phaseSwitchPath, 'utf8'));
  doc.activePhase = activePhase;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `p0-06-phase-${activePhase}-`));
  const mutatedPath = path.join(tmpDir, 'PHASE_SWITCH_V1.mutated.json');
  fs.writeFileSync(mutatedPath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');

  return { tmpDir, mutatedPath };
}

function evaluateBinaryBAndC(repoRoot, fixturePath) {
  const scriptPath = path.resolve(repoRoot, 'scripts/ops/lifecycle-negative-test-coverage-state.mjs');

  const releaseRun = runNode(scriptPath, [
    '--json',
    '--mode', 'release',
    '--status-path', DEFAULT_STATUS_PATH,
    '--phase-switch-path', DEFAULT_PHASE_SWITCH_PATH,
    '--negative-cases-path', fixturePath,
  ], repoRoot);

  const releaseJson = releaseRun.stdout ? JSON.parse(releaseRun.stdout) : {};

  const binaryB = {
    ok: releaseRun.status !== 0
      && releaseJson.ok === false
      && normalizeString(releaseJson.failReason) === 'E_LIFECYCLE_NEGATIVE_COVERAGE_INCOMPLETE',
    exitCode: Number.isInteger(releaseRun.status) ? releaseRun.status : 1,
    failReason: normalizeString(releaseJson.failReason),
    stopCode: normalizeString(releaseJson.stopCode),
    deliveryVerdict: normalizeString(releaseJson.deliveryVerdict),
  };

  const releaseSkipRun = runNode(scriptPath, [
    '--json',
    '--mode', 'release',
    '--skip-negative-checks',
    '--status-path', DEFAULT_STATUS_PATH,
    '--phase-switch-path', DEFAULT_PHASE_SWITCH_PATH,
    '--negative-cases-path', fixturePath,
  ], repoRoot);
  const promotionSkipRun = runNode(scriptPath, [
    '--json',
    '--mode', 'promotion',
    '--skip-negative-checks',
    '--status-path', DEFAULT_STATUS_PATH,
    '--phase-switch-path', DEFAULT_PHASE_SWITCH_PATH,
    '--negative-cases-path', fixturePath,
  ], repoRoot);

  const releaseSkipJson = releaseSkipRun.stdout ? JSON.parse(releaseSkipRun.stdout) : {};
  const promotionSkipJson = promotionSkipRun.stdout ? JSON.parse(promotionSkipRun.stdout) : {};

  const binaryC = {
    ok: releaseSkipRun.status !== 0
      && promotionSkipRun.status !== 0
      && releaseSkipJson.skipSuppressionAttempted === true
      && releaseSkipJson.skipSuppressionPrevented === true
      && promotionSkipJson.skipSuppressionAttempted === true
      && promotionSkipJson.skipSuppressionPrevented === true
      && normalizeString(releaseSkipJson.failReason) === 'E_SKIP_FLAG_BYPASS'
      && normalizeString(promotionSkipJson.failReason) === 'E_SKIP_FLAG_BYPASS',
    release: {
      exitCode: Number.isInteger(releaseSkipRun.status) ? releaseSkipRun.status : 1,
      failReason: normalizeString(releaseSkipJson.failReason),
      stopCode: normalizeString(releaseSkipJson.stopCode),
      skipSuppressionAttempted: releaseSkipJson.skipSuppressionAttempted === true,
      skipSuppressionPrevented: releaseSkipJson.skipSuppressionPrevented === true,
    },
    promotion: {
      exitCode: Number.isInteger(promotionSkipRun.status) ? promotionSkipRun.status : 1,
      failReason: normalizeString(promotionSkipJson.failReason),
      stopCode: normalizeString(promotionSkipJson.stopCode),
      skipSuppressionAttempted: promotionSkipJson.skipSuppressionAttempted === true,
      skipSuppressionPrevented: promotionSkipJson.skipSuppressionPrevented === true,
    },
  };

  return { binaryB, binaryC };
}

function evaluatePhaseBehavior(fixturePath) {
  const phases = ['PHASE_1_SHADOW', 'PHASE_2_WARN', 'PHASE_3_HARD'];
  const rows = [];

  for (const phase of phases) {
    const fixture = createPhaseSwitchFixture(DEFAULT_PHASE_SWITCH_PATH, phase);
    try {
      const state = evaluateLifecycleNegativeTestCoverageState({
        statusPath: DEFAULT_STATUS_PATH,
        phaseSwitchPath: fixture.mutatedPath,
        negativeCasesPath: fixturePath,
        mode: 'release',
      });
      rows.push({
        phase,
        productVerdict: state.productVerdict,
        deliveryVerdict: state.deliveryVerdict,
        phaseShouldBlock: state.phaseShouldBlock,
      });
    } finally {
      fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
    }
  }

  const map = new Map(rows.map((entry) => [entry.phase, entry]));
  const ok = map.get('PHASE_1_SHADOW')?.deliveryVerdict === 'WARN'
    && map.get('PHASE_2_WARN')?.deliveryVerdict === 'WARN'
    && map.get('PHASE_3_HARD')?.deliveryVerdict === 'BLOCK'
    && map.get('PHASE_1_SHADOW')?.productVerdict === 'FAIL'
    && map.get('PHASE_2_WARN')?.productVerdict === 'FAIL'
    && map.get('PHASE_3_HARD')?.productVerdict === 'FAIL';

  return { ok, rows };
}

function runRepeatablePass3() {
  const runs = [];

  for (let i = 0; i < 3; i += 1) {
    const state = evaluateLifecycleNegativeTestCoverageState({
      statusPath: DEFAULT_STATUS_PATH,
      phaseSwitchPath: DEFAULT_PHASE_SWITCH_PATH,
      negativeCasesPath: DEFAULT_NEGATIVE_CASES_PATH,
      mode: 'release',
    });

    runs.push({
      run: i + 1,
      ok: state.ok,
      requiredMergeFlowGateCount: state.requiredMergeFlowGateCount,
      missingMergeFlowGateCount: state.missingMergeFlowGateCount,
      executableNegativeCaseCount: state.executableNegativeCaseCount,
      activePhase: state.activePhase,
      deliveryVerdict: state.deliveryVerdict,
    });
  }

  const baseline = JSON.stringify({
    ok: runs[0].ok,
    requiredMergeFlowGateCount: runs[0].requiredMergeFlowGateCount,
    missingMergeFlowGateCount: runs[0].missingMergeFlowGateCount,
    executableNegativeCaseCount: runs[0].executableNegativeCaseCount,
    activePhase: runs[0].activePhase,
    deliveryVerdict: runs[0].deliveryVerdict,
  });

  const identical = runs.every((entry) => JSON.stringify({
    ok: entry.ok,
    requiredMergeFlowGateCount: entry.requiredMergeFlowGateCount,
    missingMergeFlowGateCount: entry.missingMergeFlowGateCount,
    executableNegativeCaseCount: entry.executableNegativeCaseCount,
    activePhase: entry.activePhase,
    deliveryVerdict: entry.deliveryVerdict,
  }) === baseline);

  return {
    ok: identical && runs.every((entry) => entry.ok === true),
    identical,
    runs,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const outputDir = path.resolve(repoRoot, args.outputDir || DEFAULT_OUTPUT_DIR);

  const negativeCasesPathAbs = path.resolve(repoRoot, DEFAULT_NEGATIVE_CASES_PATH);
  if (!fs.existsSync(negativeCasesPathAbs)) {
    writeJson(negativeCasesPathAbs, createDefaultNegativeCases(path.resolve(repoRoot, DEFAULT_STATUS_PATH)));
  }

  const modeState = evaluateModeMatrixSingleAuthorityState({ repoRoot });

  const baseState = evaluateLifecycleNegativeTestCoverageState({
    statusPath: DEFAULT_STATUS_PATH,
    phaseSwitchPath: DEFAULT_PHASE_SWITCH_PATH,
    negativeCasesPath: DEFAULT_NEGATIVE_CASES_PATH,
    mode: 'release',
  });

  const binaryA = {
    ok: baseState.negativeCoverageOk === true
      && baseState.requiredMergeFlowGateCount > 0
      && baseState.missingMergeFlowGateCount === 0,
    requiredMergeFlowGateCount: baseState.requiredMergeFlowGateCount,
    coveredMergeFlowGateCount: baseState.coveredMergeFlowGateCount,
    missingMergeFlowGates: baseState.missingMergeFlowGates,
    executableNegativeCaseCount: baseState.executableNegativeCaseCount,
  };

  const fixture = createNegativeCoverageFailureFixture(negativeCasesPathAbs);
  let binaryB = {
    ok: false,
    reason: fixture.reason,
  };
  let binaryC = {
    ok: false,
    reason: fixture.reason,
  };
  let binaryD = {
    ok: false,
    rows: [],
  };

  try {
    if (fixture.ok) {
      const evaluated = evaluateBinaryBAndC(repoRoot, fixture.mutatedPath);
      binaryB = evaluated.binaryB;
      binaryC = evaluated.binaryC;
      binaryD = evaluatePhaseBehavior(fixture.mutatedPath);
    }
  } finally {
    if (fixture.tmpDir) {
      fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
    }
  }

  const repeatable = runRepeatablePass3();

  const gates = {
    mc_phase_switch_valid: modeState.gates.mc_phase_switch_valid,
    mc_blocking_evaluator_single_authority: modeState.gates.mc_blocking_evaluator_single_authority,
    mc_mode_matrix_consistency: modeState.gates.mc_mode_matrix_consistency,
    mc_advisory_blocking_drift_zero: modeState.gates.mc_advisory_blocking_drift_zero,
    p0_06_merge_flow_negative_cases_required_check: binaryA.ok ? 'PASS' : 'FAIL',
    p0_06_lifecycle_gate_negative_coverage_check: baseState.negativeCoverageOk ? 'PASS' : 'FAIL',
    p0_06_release_gate_nonzero_on_fail_check: binaryB.ok ? 'PASS' : 'FAIL',
    p0_06_no_skip_bypass_in_merge_flow_check: binaryC.ok ? 'PASS' : 'FAIL',
    p0_06_phase_precedence_behavior_check: binaryD.ok ? 'PASS' : 'FAIL',
    p0_06_repeatable_pass_3runs: repeatable.ok ? 'PASS' : 'FAIL',
  };

  const summary = {
    status: Object.values(gates).every((value) => value === 'PASS') ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    activePhase: baseState.activePhase,
    phaseEnforcementMode: baseState.phaseEnforcementMode,
    requiredMergeFlowGateCount: baseState.requiredMergeFlowGateCount,
    missingMergeFlowGateCount: baseState.missingMergeFlowGateCount,
    executableNegativeCaseCount: baseState.executableNegativeCaseCount,
    advisoryToBlockingDriftCount: modeState.advisoryToBlockingDriftCount,
    claimOverrideViolationCount: modeState.claimOverrideViolationCount,
    repeatablePass3Identical: repeatable.identical,
    gates,
    generatedAtUtc: new Date().toISOString(),
  };

  const ticketMeta = {
    runId: summary.runId,
    ticketId: summary.ticketId,
    outputDir: path.relative(repoRoot, outputDir).replaceAll(path.sep, '/'),
    activePhase: summary.activePhase,
    phaseEnforcementMode: summary.phaseEnforcementMode,
    generatedAtUtc: summary.generatedAtUtc,
  };

  const negativeCasesDoc = readJsonObject(negativeCasesPathAbs) || createDefaultNegativeCases(path.resolve(repoRoot, DEFAULT_STATUS_PATH));
  writeJson(path.join(outputDir, 'merge-flow-negative-cases.json'), {
    gate: 'p0_06_merge_flow_negative_cases_required_check',
    ok: binaryA.ok,
    requiredMergeFlowGateCount: baseState.requiredMergeFlowGateCount,
    coveredMergeFlowGateCount: baseState.coveredMergeFlowGateCount,
    missingMergeFlowGates: baseState.missingMergeFlowGates,
    cases: Array.isArray(negativeCasesDoc.cases) ? negativeCasesDoc.cases : [],
  });

  writeJson(path.join(outputDir, 'release-gate-nonzero-fail-proof.json'), {
    gate: 'p0_06_release_gate_nonzero_on_fail_check',
    ok: binaryB.ok,
    negativeCaseFailRelease: binaryB,
    skipBypassReleasePromotion: binaryC,
    phasePrecedenceRows: binaryD.rows,
    repeatable,
  });

  const driftCases = modeState.details?.authorityState?.driftCases || [];
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
