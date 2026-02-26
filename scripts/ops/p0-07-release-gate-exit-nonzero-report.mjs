#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluateReleaseGateExitNonzeroState } from './release-gate-exit-nonzero-state.mjs';
import { evaluateModeMatrixSingleAuthorityState } from './mode-matrix-single-authority-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P0_CONTOUR/TICKET_07';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/RELEASE_GATE_EXIT_NONZERO_v3.json';
const DEFAULT_PHASE_SWITCH_PATH = 'docs/OPS/STATUS/PHASE_SWITCH_V1.json';
const DEFAULT_BINDING_SCHEMA_PATH = 'docs/OPS/STATUS/BINDING_SCHEMA_V1.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const EMPTY_FAIL_MAP_PATH = '__NONE__';

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

function readJsonObject(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return isObjectRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function uniqueSortedStrings(values) {
  if (!Array.isArray(values)) return [];
  const unique = new Set();
  for (const value of values) {
    const normalized = normalizeString(value);
    if (normalized) unique.add(normalized);
  }
  return [...unique].sort((a, b) => a.localeCompare(b));
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

function normalizedExitCode(value) {
  return Number.isInteger(value) ? value : 1;
}

function collectEffectiveTokenCases(repoRoot) {
  const statusDoc = JSON.parse(fs.readFileSync(path.resolve(repoRoot, DEFAULT_STATUS_PATH), 'utf8'));
  const phaseSwitchDoc = JSON.parse(fs.readFileSync(path.resolve(repoRoot, DEFAULT_PHASE_SWITCH_PATH), 'utf8'));
  const bindingDoc = JSON.parse(fs.readFileSync(path.resolve(repoRoot, DEFAULT_BINDING_SCHEMA_PATH), 'utf8'));

  const activePhase = normalizeString(phaseSwitchDoc.activePhase || phaseSwitchDoc.ACTIVE_PHASE);
  const requiredSetPath = normalizeString(statusDoc.requiredSets?.[activePhase]);
  const requiredSetDoc = JSON.parse(fs.readFileSync(path.resolve(repoRoot, requiredSetPath), 'utf8'));

  const effectiveRequiredTokenIds = uniqueSortedStrings(requiredSetDoc.effectiveRequiredTokenIds);
  const failSignalByTokenId = new Map();
  for (const row of bindingDoc.records || []) {
    if (!isObjectRecord(row)) continue;
    const tokenId = normalizeString(row.TOKEN_ID);
    const failSignalCode = normalizeString(row.FAILSIGNAL_CODE);
    if (!tokenId || !failSignalCode) continue;
    failSignalByTokenId.set(tokenId, failSignalCode);
  }

  const cases = effectiveRequiredTokenIds.map((tokenId) => ({
    tokenId,
    failSignalCode: failSignalByTokenId.get(tokenId) || '',
    failed: true,
  }));

  return {
    activePhase,
    requiredSetPath,
    cases,
  };
}

function createTempFailMap(cases) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p0-07-fail-map-'));
  const failMapPath = path.join(tmpDir, 'effective-required-token-fail-map.json');
  const payload = {
    version: 3,
    generatedBy: 'p0-07-release-gate-exit-nonzero-report.mjs',
    cases,
  };
  fs.writeFileSync(failMapPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return {
    tmpDir,
    failMapPath,
    payload,
  };
}

function findAdvisorySignalCode(repoRoot) {
  const registry = JSON.parse(fs.readFileSync(path.resolve(repoRoot, DEFAULT_FAILSIGNAL_REGISTRY_PATH), 'utf8'));
  for (const row of registry.failSignals || []) {
    if (!isObjectRecord(row)) continue;
    const code = normalizeString(row.code);
    const prCore = normalizeString(row.modeMatrix?.prCore).toLowerCase();
    if (code && prCore === 'advisory') return code;
  }
  return '';
}

function runRepeatablePass3() {
  const runs = [];
  for (let i = 0; i < 3; i += 1) {
    const state = evaluateReleaseGateExitNonzeroState({
      mode: 'release',
      statusPath: DEFAULT_STATUS_PATH,
      phaseSwitchPath: DEFAULT_PHASE_SWITCH_PATH,
      bindingSchemaPath: DEFAULT_BINDING_SCHEMA_PATH,
      failMapPath: EMPTY_FAIL_MAP_PATH,
    });

    runs.push({
      run: i + 1,
      ok: state.ok,
      nonzeroExitRequired: state.nonzeroExitRequired,
      effectiveRequiredTokenFailureCount: state.effectiveRequiredTokenFailureCount,
      activePhase: state.activePhase,
      deliveryVerdict: state.deliveryVerdict,
    });
  }

  const baseline = JSON.stringify({
    ok: runs[0].ok,
    nonzeroExitRequired: runs[0].nonzeroExitRequired,
    effectiveRequiredTokenFailureCount: runs[0].effectiveRequiredTokenFailureCount,
    activePhase: runs[0].activePhase,
    deliveryVerdict: runs[0].deliveryVerdict,
  });

  const identical = runs.every((entry) => JSON.stringify({
    ok: entry.ok,
    nonzeroExitRequired: entry.nonzeroExitRequired,
    effectiveRequiredTokenFailureCount: entry.effectiveRequiredTokenFailureCount,
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

  const modeState = evaluateModeMatrixSingleAuthorityState({ repoRoot });
  const effective = collectEffectiveTokenCases(repoRoot);

  const stateScriptPath = path.resolve(repoRoot, 'scripts/ops/release-gate-exit-nonzero-state.mjs');

  const perTokenResults = [];
  for (const row of effective.cases) {
    const releaseRun = runNode(stateScriptPath, [
      '--json',
      '--mode', 'release',
      '--force-fail-token-id', row.tokenId,
      '--force-fail-signal-code', row.failSignalCode,
      '--fail-map-path', EMPTY_FAIL_MAP_PATH,
      '--status-path', DEFAULT_STATUS_PATH,
      '--phase-switch-path', DEFAULT_PHASE_SWITCH_PATH,
      '--binding-schema-path', DEFAULT_BINDING_SCHEMA_PATH,
    ], repoRoot);

    const promotionRun = runNode(stateScriptPath, [
      '--json',
      '--mode', 'promotion',
      '--force-fail-token-id', row.tokenId,
      '--force-fail-signal-code', row.failSignalCode,
      '--fail-map-path', EMPTY_FAIL_MAP_PATH,
      '--status-path', DEFAULT_STATUS_PATH,
      '--phase-switch-path', DEFAULT_PHASE_SWITCH_PATH,
      '--binding-schema-path', DEFAULT_BINDING_SCHEMA_PATH,
    ], repoRoot);

    const releaseJson = releaseRun.stdout ? JSON.parse(releaseRun.stdout) : {};
    const promotionJson = promotionRun.stdout ? JSON.parse(promotionRun.stdout) : {};

    perTokenResults.push({
      tokenId: row.tokenId,
      failSignalCode: row.failSignalCode,
      releaseExitCode: normalizedExitCode(releaseRun.status),
      releaseFailReason: normalizeString(releaseJson.failReason),
      promotionExitCode: normalizedExitCode(promotionRun.status),
      promotionFailReason: normalizeString(promotionJson.failReason),
      releaseNonzero: normalizedExitCode(releaseRun.status) !== 0,
      promotionNonzero: normalizedExitCode(promotionRun.status) !== 0,
    });
  }

  const binaryA = {
    ok: perTokenResults.length > 0 && perTokenResults.every((entry) => entry.releaseNonzero === true),
    totalCases: perTokenResults.length,
    failingCases: perTokenResults.filter((entry) => entry.releaseNonzero !== true).map((entry) => entry.tokenId),
  };

  const failMapFixture = createTempFailMap(effective.cases);
  let suppressionRun = null;
  let suppressionJson = {};
  try {
    suppressionRun = runNode(stateScriptPath, [
      '--json',
      '--mode', 'release',
      '--fail-map-path', failMapFixture.failMapPath,
      '--status-path', DEFAULT_STATUS_PATH,
      '--phase-switch-path', DEFAULT_PHASE_SWITCH_PATH,
      '--binding-schema-path', DEFAULT_BINDING_SCHEMA_PATH,
      '--suppress-failures',
    ], repoRoot);
    suppressionJson = suppressionRun.stdout ? JSON.parse(suppressionRun.stdout) : {};
  } finally {
    fs.rmSync(failMapFixture.tmpDir, { recursive: true, force: true });
  }

  const binaryB = {
    ok: normalizedExitCode(suppressionRun?.status) !== 0
      && normalizeString(suppressionJson.failReason) === 'E_DEFAULT_ZERO_EXIT_ON_FAIL'
      && suppressionJson.suppressionPrevented === true,
    exitCode: normalizedExitCode(suppressionRun?.status),
    failReason: normalizeString(suppressionJson.failReason),
    suppressionPrevented: suppressionJson.suppressionPrevented === true,
  };

  const binaryC = {
    ok: perTokenResults.length > 0
      && perTokenResults.every((entry) => entry.releaseNonzero === true && entry.promotionNonzero === true),
    releaseAllNonzero: perTokenResults.every((entry) => entry.releaseNonzero === true),
    promotionAllNonzero: perTokenResults.every((entry) => entry.promotionNonzero === true),
  };

  const advisorySignalCode = findAdvisorySignalCode(repoRoot);
  const advisoryRun = advisorySignalCode
    ? runNode(stateScriptPath, [
      '--json',
      '--mode', 'pr',
      '--advisory-probe-fail-signal-code', advisorySignalCode,
      '--fail-map-path', EMPTY_FAIL_MAP_PATH,
      '--status-path', DEFAULT_STATUS_PATH,
      '--phase-switch-path', DEFAULT_PHASE_SWITCH_PATH,
      '--binding-schema-path', DEFAULT_BINDING_SCHEMA_PATH,
    ], repoRoot)
    : { status: 1, stdout: '' };
  const advisoryJson = advisoryRun.stdout ? JSON.parse(advisoryRun.stdout) : {};

  const binaryD = {
    ok: Boolean(advisorySignalCode)
      && normalizedExitCode(advisoryRun.status) === 0
      && advisoryJson.nonzeroExitRequired === false
      && advisoryJson.advisoryProbeNonBlockingCount >= 1,
    advisorySignalCode,
    exitCode: normalizedExitCode(advisoryRun.status),
    advisoryProbeNonBlockingCount: Number(advisoryJson.advisoryProbeNonBlockingCount || 0),
    deliveryVerdict: normalizeString(advisoryJson.deliveryVerdict),
  };

  const repeatable = runRepeatablePass3();

  const gates = {
    mc_phase_switch_valid: modeState.gates.mc_phase_switch_valid,
    mc_blocking_evaluator_single_authority: modeState.gates.mc_blocking_evaluator_single_authority,
    mc_mode_matrix_consistency: modeState.gates.mc_mode_matrix_consistency,
    mc_advisory_blocking_drift_zero: modeState.gates.mc_advisory_blocking_drift_zero,
    p0_07_effective_required_token_fail_triggers_nonzero_check: binaryA.ok ? 'PASS' : 'FAIL',
    p0_07_release_gate_exit_code_integrity_check: binaryB.ok ? 'PASS' : 'FAIL',
    p0_07_no_default_zero_exit_on_token_fail_check: binaryB.ok ? 'PASS' : 'FAIL',
    p0_07_release_mode_fail_propagation_check: binaryC.ok ? 'PASS' : 'FAIL',
    p0_07_advisory_non_blocking_outside_canon_check: binaryD.ok ? 'PASS' : 'FAIL',
    p0_07_repeatable_pass_3runs: repeatable.ok ? 'PASS' : 'FAIL',
  };

  const summary = {
    status: Object.values(gates).every((value) => value === 'PASS') ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    activePhase: effective.activePhase,
    effectiveRequiredTokenCount: effective.cases.length,
    advisorySignalCode,
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
    generatedAtUtc: summary.generatedAtUtc,
  };

  writeJson(path.join(outputDir, 'effective-required-token-fail-map.json'), {
    gate: 'p0_07_effective_required_token_fail_triggers_nonzero_check',
    ok: binaryA.ok,
    activePhase: effective.activePhase,
    requiredSetPath: effective.requiredSetPath,
    cases: effective.cases,
    perTokenResults,
  });

  writeJson(path.join(outputDir, 'release-gate-fail-exit-cases.json'), {
    gate: 'p0_07_release_mode_fail_propagation_check',
    ok: binaryC.ok,
    perTokenResults,
    binaryA,
    binaryC,
  });

  writeJson(path.join(outputDir, 'release-gate-exit-code-proof.json'), {
    gate: 'p0_07_release_gate_exit_code_integrity_check',
    ok: binaryB.ok,
    binaryB,
    binaryD,
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
