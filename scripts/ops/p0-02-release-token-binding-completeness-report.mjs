#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluateReleaseTokenBindingCompleteness } from './release-token-binding-completeness-state.mjs';
import { evaluateModeMatrixSingleAuthorityState } from './mode-matrix-single-authority-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P0_CONTOUR/TICKET_02';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/RELEASE_TOKEN_BINDING_COMPLETENESS_v3.json';
const DEFAULT_SCHEMA_PATH = 'docs/OPS/STATUS/BINDING_SCHEMA_V1.json';
const DEFAULT_PHASE_SWITCH_PATH = 'docs/OPS/STATUS/PHASE_SWITCH_V1.json';
const DEFAULT_PHASE_SET_1_PATH = 'docs/OPS/STATUS/REQUIRED_SET_PHASE_1_V1.json';
const DEFAULT_PHASE_SET_2_PATH = 'docs/OPS/STATUS/REQUIRED_SET_PHASE_2_V1.json';
const DEFAULT_PHASE_SET_3_PATH = 'docs/OPS/STATUS/REQUIRED_SET_PHASE_3_V1.json';
const DEFAULT_CATALOG_PATH = 'docs/OPS/TOKENS/TOKEN_CATALOG.json';

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

function mutateSchemaRemoveField(schemaPath, tokenId, field) {
  const doc = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const row = (doc.records || []).find((entry) => entry && entry.TOKEN_ID === tokenId);
  if (!row) return null;
  delete row[field];

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p0-02-negative-'));
  const mutatedPath = path.join(tmpDir, 'BINDING_SCHEMA_V1.mutated.json');
  fs.writeFileSync(mutatedPath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  return { tmpDir, mutatedPath };
}

function runBinaryTestBAndC(repoRoot, baseState) {
  const tokenId = baseState.effectiveRequiredTokenIds[0] || '';
  const removedField = 'PROOFHOOK_REF';
  if (!tokenId) {
    return {
      binaryB: {
        ok: false,
        reason: 'E_REQUIRED_SET_PHASE_INVALID',
      },
      binaryC: {
        ok: false,
        reason: 'E_REQUIRED_SET_PHASE_INVALID',
      },
    };
  }

  const schemaPath = path.resolve(repoRoot, DEFAULT_SCHEMA_PATH);
  const mutated = mutateSchemaRemoveField(schemaPath, tokenId, removedField);
  if (!mutated) {
    return {
      binaryB: {
        ok: false,
        reason: 'TOKEN_MISSING_IN_SCHEMA',
        tokenId,
      },
      binaryC: {
        ok: false,
        reason: 'TOKEN_MISSING_IN_SCHEMA',
        tokenId,
      },
    };
  }

  try {
    const negativeState = evaluateReleaseTokenBindingCompleteness({
      statusPath: DEFAULT_STATUS_PATH,
      bindingSchemaPath: mutated.mutatedPath,
      phaseSwitchPath: DEFAULT_PHASE_SWITCH_PATH,
      phaseSet1Path: DEFAULT_PHASE_SET_1_PATH,
      phaseSet2Path: DEFAULT_PHASE_SET_2_PATH,
      phaseSet3Path: DEFAULT_PHASE_SET_3_PATH,
      catalogPath: DEFAULT_CATALOG_PATH,
    });

    const binaryB = {
      ok: negativeState.completenessOk === false
        && negativeState.missingRequiredBindingFields.some((entry) => entry.tokenId === tokenId && entry.field === removedField),
      completenessOk: negativeState.completenessOk,
      missingRequiredBindingFieldsCount: negativeState.missingRequiredBindingFieldsCount,
      tokenId,
      removedField,
    };

    const run = runNode(
      path.resolve(repoRoot, 'scripts/ops/release-token-binding-completeness-state.mjs'),
      [
        '--status-path', DEFAULT_STATUS_PATH,
        '--binding-schema-path', mutated.mutatedPath,
        '--phase-switch-path', DEFAULT_PHASE_SWITCH_PATH,
        '--phase-set-1-path', DEFAULT_PHASE_SET_1_PATH,
        '--phase-set-2-path', DEFAULT_PHASE_SET_2_PATH,
        '--phase-set-3-path', DEFAULT_PHASE_SET_3_PATH,
        '--catalog-path', DEFAULT_CATALOG_PATH,
      ],
      repoRoot,
    );

    const binaryC = {
      ok: run.status !== 0,
      exitCode: Number.isInteger(run.status) ? run.status : 1,
      tokenId,
      removedField,
    };

    return { binaryB, binaryC };
  } finally {
    fs.rmSync(mutated.tmpDir, { recursive: true, force: true });
  }
}

function runRepeatablePass3() {
  const runs = [];
  for (let i = 0; i < 3; i += 1) {
    const state = evaluateReleaseTokenBindingCompleteness({
      statusPath: DEFAULT_STATUS_PATH,
      bindingSchemaPath: DEFAULT_SCHEMA_PATH,
      phaseSwitchPath: DEFAULT_PHASE_SWITCH_PATH,
      phaseSet1Path: DEFAULT_PHASE_SET_1_PATH,
      phaseSet2Path: DEFAULT_PHASE_SET_2_PATH,
      phaseSet3Path: DEFAULT_PHASE_SET_3_PATH,
      catalogPath: DEFAULT_CATALOG_PATH,
    });
    runs.push({
      run: i + 1,
      completenessOk: state.completenessOk,
      missingRequiredBindingFieldsCount: state.missingRequiredBindingFieldsCount,
      coveragePct: state.bindingRecordCoverage.coveragePct,
      activePhase: state.activePhase,
    });
  }

  const baseline = JSON.stringify({
    completenessOk: runs[0].completenessOk,
    missingRequiredBindingFieldsCount: runs[0].missingRequiredBindingFieldsCount,
    coveragePct: runs[0].coveragePct,
    activePhase: runs[0].activePhase,
  });

  const identical = runs.every((entry) => JSON.stringify({
    completenessOk: entry.completenessOk,
    missingRequiredBindingFieldsCount: entry.missingRequiredBindingFieldsCount,
    coveragePct: entry.coveragePct,
    activePhase: entry.activePhase,
  }) === baseline);

  return {
    ok: identical && runs.every((entry) => entry.completenessOk === true),
    identical,
    runs,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const outputDir = path.resolve(repoRoot, args.outputDir);

  const modeState = evaluateModeMatrixSingleAuthorityState({ repoRoot });
  const baseState = evaluateReleaseTokenBindingCompleteness({
    statusPath: DEFAULT_STATUS_PATH,
    bindingSchemaPath: DEFAULT_SCHEMA_PATH,
    phaseSwitchPath: DEFAULT_PHASE_SWITCH_PATH,
    phaseSet1Path: DEFAULT_PHASE_SET_1_PATH,
    phaseSet2Path: DEFAULT_PHASE_SET_2_PATH,
    phaseSet3Path: DEFAULT_PHASE_SET_3_PATH,
    catalogPath: DEFAULT_CATALOG_PATH,
  });

  const binaryAOk = baseState.completenessOk === true
    && baseState.missingRequiredBindingFieldsCount === 0
    && baseState.missingEffectiveRequiredTokensInCatalogCount === 0;

  const { binaryB, binaryC } = runBinaryTestBAndC(repoRoot, baseState);
  const repeatable = runRepeatablePass3();

  const gates = {
    mc_phase_switch_valid: modeState.gates.mc_phase_switch_valid,
    mc_blocking_evaluator_single_authority: modeState.gates.mc_blocking_evaluator_single_authority,
    mc_mode_matrix_consistency: modeState.gates.mc_mode_matrix_consistency,
    mc_advisory_blocking_drift_zero: modeState.gates.mc_advisory_blocking_drift_zero,
    p0_02_binding_schema_required_fields_check: binaryAOk ? 'PASS' : 'FAIL',
    p0_02_effective_required_set_coverage_check: baseState.bindingRecordCoverage.coveragePct === 100 ? 'PASS' : 'FAIL',
    p0_02_remove_one_required_field_negative_check: binaryB.ok ? 'PASS' : 'FAIL',
    p0_02_release_gate_nonzero_on_token_fail_check: binaryC.ok ? 'PASS' : 'FAIL',
    p0_02_repeatable_pass_3runs: repeatable.ok ? 'PASS' : 'FAIL',
  };

  const summary = {
    status: Object.values(gates).every((value) => value === 'PASS') ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    activePhase: baseState.activePhase,
    phaseEnforcementMode: baseState.phaseEnforcementMode,
    effectiveRequiredTokenCount: baseState.effectiveRequiredTokenCount,
    missingRequiredBindingFieldsCount: baseState.missingRequiredBindingFieldsCount,
    bindingBackfillCoveragePct: baseState.bindingRecordCoverage.coveragePct,
    claimOverrideViolationCount: modeState.claimOverrideViolationCount,
    advisoryToBlockingDriftCount: modeState.advisoryToBlockingDriftCount,
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

  writeJson(path.join(outputDir, 'release-token-binding-gaps.json'), {
    missingRequiredBindingFieldsCount: baseState.missingRequiredBindingFieldsCount,
    missingRequiredBindingFields: baseState.missingRequiredBindingFields,
    missingEffectiveRequiredTokensInCatalogCount: baseState.missingEffectiveRequiredTokensInCatalogCount,
    missingEffectiveRequiredTokensInCatalog: baseState.missingEffectiveRequiredTokensInCatalog,
  });
  writeJson(path.join(outputDir, 'binding-backfill-coverage.json'), {
    activePhase: baseState.activePhase,
    phaseEnforcementMode: baseState.phaseEnforcementMode,
    effectiveRequiredTokenIds: baseState.effectiveRequiredTokenIds,
    coverage: baseState.bindingRecordCoverage,
  });
  writeJson(path.join(outputDir, 'summary.json'), summary);
  writeJson(path.join(outputDir, 'ticket-meta.json'), ticketMeta);

  process.stdout.write(`${stableStringify(summary)}\n`);
  process.exit(summary.status === 'PASS' ? 0 : 1);
}

main();
