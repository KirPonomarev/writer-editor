#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluateE2ECriticalUserPathState } from './e2e-critical-user-path-state.mjs';
import { evaluateModeMatrixSingleAuthorityState } from './mode-matrix-single-authority-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P0_CONTOUR/TICKET_03';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/E2E_CRITICAL_USER_PATH_HARD_MIN_v3.json';
const DEFAULT_PHASE_SWITCH_PATH = 'docs/OPS/STATUS/PHASE_SWITCH_V1.json';
const DEFAULT_SCENARIOS_PATH = 'docs/OPS/EVIDENCE/P0_CONTOUR/TICKET_03/e2e-critical-user-path-scenarios.json';

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
      continue;
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

function createMissingStepScenarioFile(scenariosPath) {
  const original = JSON.parse(fs.readFileSync(scenariosPath, 'utf8'));
  const required = Array.isArray(original.scenarios)
    ? original.scenarios.filter((row) => row && row.required === true)
    : [];

  if (required.length === 0) {
    return {
      ok: false,
      reason: 'E2E_REQUIRED_SCENARIO_SET_EMPTY',
      removedScenarioId: '',
      tmpDir: '',
      mutatedPath: '',
    };
  }

  const removedScenarioId = normalizeString(required[0].id);
  original.scenarios = original.scenarios.filter((row) => normalizeString(row?.id) !== removedScenarioId);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p0-03-e2e-negative-'));
  const mutatedPath = path.join(tmpDir, 'e2e-critical-user-path-scenarios.mutated.json');
  fs.writeFileSync(mutatedPath, `${JSON.stringify(original, null, 2)}\n`, 'utf8');

  return {
    ok: true,
    removedScenarioId,
    tmpDir,
    mutatedPath,
  };
}

function runBinaryTestBAndC(repoRoot, baseState) {
  const missingStep = createMissingStepScenarioFile(path.resolve(repoRoot, DEFAULT_SCENARIOS_PATH));
  if (!missingStep.ok) {
    return {
      binaryB: {
        ok: false,
        reason: missingStep.reason,
      },
      binaryC: {
        ok: false,
        reason: missingStep.reason,
      },
      detail: {
        removedScenarioId: '',
      },
    };
  }

  try {
    const missingState = evaluateE2ECriticalUserPathState({
      statusPath: DEFAULT_STATUS_PATH,
      phaseSwitchPath: DEFAULT_PHASE_SWITCH_PATH,
      scenariosPath: missingStep.mutatedPath,
      mode: 'release',
    });

    const binaryB = {
      ok: missingState.criticalUserPathPass === false
        && missingState.missingRequiredScenarioIds.includes(missingStep.removedScenarioId),
      removedScenarioId: missingStep.removedScenarioId,
      missingRequiredScenarioCount: missingState.missingRequiredScenarioCount,
      failingRequiredScenarioCount: missingState.failingRequiredScenarioCount,
      failReason: missingState.failReason,
    };

    const run = runNode(
      path.resolve(repoRoot, 'scripts/ops/e2e-critical-user-path-state.mjs'),
      [
        '--status-path', DEFAULT_STATUS_PATH,
        '--phase-switch-path', DEFAULT_PHASE_SWITCH_PATH,
        '--scenarios-path', missingStep.mutatedPath,
        '--mode', 'release',
      ],
      repoRoot,
    );

    const binaryC = {
      ok: missingState.deliveryVerdict === 'BLOCK' && run.status !== 0,
      removedScenarioId: missingStep.removedScenarioId,
      deliveryVerdict: missingState.deliveryVerdict,
      productVerdict: missingState.productVerdict,
      exitCode: Number.isInteger(run.status) ? run.status : 1,
    };

    const missingStatePr = evaluateE2ECriticalUserPathState({
      statusPath: DEFAULT_STATUS_PATH,
      phaseSwitchPath: DEFAULT_PHASE_SWITCH_PATH,
      scenariosPath: missingStep.mutatedPath,
      mode: 'pr',
    });

    const binaryD = {
      ok: missingState.productVerdict === missingStatePr.productVerdict
        && missingState.deliveryVerdict !== missingStatePr.deliveryVerdict
        && missingState.productVerdict === 'FAIL'
        && missingState.deliveryVerdict === 'BLOCK'
        && missingStatePr.deliveryVerdict === 'WARN',
      releaseProductVerdict: missingState.productVerdict,
      releaseDeliveryVerdict: missingState.deliveryVerdict,
      prProductVerdict: missingStatePr.productVerdict,
      prDeliveryVerdict: missingStatePr.deliveryVerdict,
    };

    return {
      binaryB,
      binaryC,
      binaryD,
      detail: {
        removedScenarioId: missingStep.removedScenarioId,
        releaseState: {
          missingRequiredScenarioIds: missingState.missingRequiredScenarioIds,
          productVerdict: missingState.productVerdict,
          deliveryVerdict: missingState.deliveryVerdict,
          failReason: missingState.failReason,
        },
        prState: {
          missingRequiredScenarioIds: missingStatePr.missingRequiredScenarioIds,
          productVerdict: missingStatePr.productVerdict,
          deliveryVerdict: missingStatePr.deliveryVerdict,
          failReason: missingStatePr.failReason,
        },
      },
    };
  } finally {
    fs.rmSync(missingStep.tmpDir, { recursive: true, force: true });
  }
}

function runRepeatablePass3() {
  const runs = [];
  for (let i = 0; i < 3; i += 1) {
    const state = evaluateE2ECriticalUserPathState({
      statusPath: DEFAULT_STATUS_PATH,
      phaseSwitchPath: DEFAULT_PHASE_SWITCH_PATH,
      scenariosPath: DEFAULT_SCENARIOS_PATH,
      mode: 'release',
    });
    runs.push({
      run: i + 1,
      criticalUserPathPass: state.criticalUserPathPass,
      requiredScenarioCount: state.requiredScenarioCount,
      missingRequiredScenarioCount: state.missingRequiredScenarioCount,
      failingRequiredScenarioCount: state.failingRequiredScenarioCount,
      productVerdict: state.productVerdict,
      deliveryVerdict: state.deliveryVerdict,
      activePhase: state.activePhase,
    });
  }

  const baseline = JSON.stringify({
    criticalUserPathPass: runs[0].criticalUserPathPass,
    requiredScenarioCount: runs[0].requiredScenarioCount,
    missingRequiredScenarioCount: runs[0].missingRequiredScenarioCount,
    failingRequiredScenarioCount: runs[0].failingRequiredScenarioCount,
    productVerdict: runs[0].productVerdict,
    deliveryVerdict: runs[0].deliveryVerdict,
    activePhase: runs[0].activePhase,
  });

  const identical = runs.every((entry) => JSON.stringify({
    criticalUserPathPass: entry.criticalUserPathPass,
    requiredScenarioCount: entry.requiredScenarioCount,
    missingRequiredScenarioCount: entry.missingRequiredScenarioCount,
    failingRequiredScenarioCount: entry.failingRequiredScenarioCount,
    productVerdict: entry.productVerdict,
    deliveryVerdict: entry.deliveryVerdict,
    activePhase: entry.activePhase,
  }) === baseline);

  return {
    ok: identical && runs.every((entry) => entry.criticalUserPathPass === true),
    identical,
    runs,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const outputDir = path.resolve(repoRoot, args.outputDir);

  const modeState = evaluateModeMatrixSingleAuthorityState({ repoRoot });
  const baseState = evaluateE2ECriticalUserPathState({
    statusPath: DEFAULT_STATUS_PATH,
    phaseSwitchPath: DEFAULT_PHASE_SWITCH_PATH,
    scenariosPath: DEFAULT_SCENARIOS_PATH,
    mode: 'release',
  });

  const binaryA = {
    ok: baseState.criticalUserPathPass === true
      && baseState.criticalUserPathDefined === true
      && baseState.machineCheckBindingOk === true,
    requiredScenarioCount: baseState.requiredScenarioCount,
    missingRequiredScenarioCount: baseState.missingRequiredScenarioCount,
    failingRequiredScenarioCount: baseState.failingRequiredScenarioCount,
    productVerdict: baseState.productVerdict,
    deliveryVerdict: baseState.deliveryVerdict,
  };

  const negative = runBinaryTestBAndC(repoRoot, baseState);
  const repeatable = runRepeatablePass3();

  const gates = {
    mc_phase_switch_valid: modeState.gates.mc_phase_switch_valid,
    mc_blocking_evaluator_single_authority: modeState.gates.mc_blocking_evaluator_single_authority,
    mc_mode_matrix_consistency: modeState.gates.mc_mode_matrix_consistency,
    mc_advisory_blocking_drift_zero: modeState.gates.mc_advisory_blocking_drift_zero,
    p0_03_critical_user_path_defined_check: baseState.criticalUserPathDefined ? 'PASS' : 'FAIL',
    p0_03_critical_user_path_machine_check_binding_check: baseState.machineCheckBindingOk ? 'PASS' : 'FAIL',
    p0_03_critical_user_path_negative_missing_step_check: negative.binaryB.ok ? 'PASS' : 'FAIL',
    p0_03_release_mode_blocks_when_critical_path_missing_check: negative.binaryC.ok ? 'PASS' : 'FAIL',
    p0_03_product_delivery_verdict_split_check: negative.binaryD?.ok ? 'PASS' : 'FAIL',
    p0_03_repeatable_pass_3runs: repeatable.ok ? 'PASS' : 'FAIL',
  };

  const summary = {
    status: Object.values(gates).every((value) => value === 'PASS') ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    activePhase: baseState.activePhase,
    phaseEnforcementMode: baseState.phaseEnforcementMode,
    criticalUserPathPass: baseState.criticalUserPathPass,
    requiredScenarioCount: baseState.requiredScenarioCount,
    missingRequiredScenarioCount: baseState.missingRequiredScenarioCount,
    failingRequiredScenarioCount: baseState.failingRequiredScenarioCount,
    advisoryToBlockingDriftCount: modeState.advisoryToBlockingDriftCount,
    claimOverrideViolationCount: modeState.claimOverrideViolationCount,
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

  writeJson(path.join(outputDir, 'critical-user-path-pass-proof.json'), {
    criticalUserPathPass: baseState.criticalUserPathPass,
    requiredScenarioIds: baseState.requiredScenarioIds,
    requiredScenarioCount: baseState.requiredScenarioCount,
    productVerdict: baseState.productVerdict,
    deliveryVerdict: baseState.deliveryVerdict,
    binaryA,
  });

  writeJson(path.join(outputDir, 'e2e-critical-user-path-negative-missing-step.json'), {
    binaryB: negative.binaryB,
    binaryC: negative.binaryC,
    binaryD: negative.binaryD,
    detail: negative.detail,
  });

  writeJson(path.join(outputDir, 'advisory-blocking-drift-cases.json'), {
    advisoryToBlockingDriftCount: modeState.advisoryToBlockingDriftCount,
    claimOverrideViolationCount: modeState.claimOverrideViolationCount,
    cases: [],
  });

  writeJson(path.join(outputDir, 'summary.json'), summary);
  writeJson(path.join(outputDir, 'ticket-meta.json'), ticketMeta);

  process.stdout.write(`${stableStringify(summary)}\n`);
  process.exit(summary.status === 'PASS' ? 0 : 1);
}

main();
