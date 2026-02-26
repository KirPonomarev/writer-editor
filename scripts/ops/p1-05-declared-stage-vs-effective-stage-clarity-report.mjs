#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateDeclaredStageVsEffectiveStageClarityState } from './declared-stage-vs-effective-stage-clarity-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P1_CONTOUR/TICKET_05';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_PLAN_PATH = 'docs/OPS/STATUS/XPLAT_ROLLOUT_PLAN_v3_12.json';
const DEFAULT_STAGE_METRICS_PATH = 'docs/OPS/STATUS/XPLAT_STAGE_METRICS_v3_12.json';
const DEFAULT_PARITY_BASELINE_PATH = 'docs/OPS/STATUS/XPLAT_PARITY_BASELINE_v3_12.json';

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

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    outputDir: DEFAULT_OUTPUT_DIR,
    runId: '',
    ticketId: '',
    failsignalRegistryPath: DEFAULT_FAILSIGNAL_REGISTRY_PATH,
    planPath: DEFAULT_PLAN_PATH,
    stageMetricsPath: DEFAULT_STAGE_METRICS_PATH,
    parityBaselinePath: DEFAULT_PARITY_BASELINE_PATH,
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

    if (arg === '--failsignal-registry-path' && i + 1 < argv.length) {
      out.failsignalRegistryPath = normalizeString(argv[i + 1]) || DEFAULT_FAILSIGNAL_REGISTRY_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--failsignal-registry-path=')) {
      out.failsignalRegistryPath = normalizeString(arg.slice('--failsignal-registry-path='.length)) || DEFAULT_FAILSIGNAL_REGISTRY_PATH;
      continue;
    }

    if (arg === '--plan-path' && i + 1 < argv.length) {
      out.planPath = normalizeString(argv[i + 1]) || DEFAULT_PLAN_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--plan-path=')) {
      out.planPath = normalizeString(arg.slice('--plan-path='.length)) || DEFAULT_PLAN_PATH;
      continue;
    }

    if (arg === '--stage-metrics-path' && i + 1 < argv.length) {
      out.stageMetricsPath = normalizeString(argv[i + 1]) || DEFAULT_STAGE_METRICS_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--stage-metrics-path=')) {
      out.stageMetricsPath = normalizeString(arg.slice('--stage-metrics-path='.length)) || DEFAULT_STAGE_METRICS_PATH;
      continue;
    }

    if (arg === '--parity-baseline-path' && i + 1 < argv.length) {
      out.parityBaselinePath = normalizeString(argv[i + 1]) || DEFAULT_PARITY_BASELINE_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--parity-baseline-path=')) {
      out.parityBaselinePath = normalizeString(arg.slice('--parity-baseline-path='.length)) || DEFAULT_PARITY_BASELINE_PATH;
    }
  }

  return out;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${stableStringify(value)}\n`, 'utf8');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const outputDir = path.resolve(repoRoot, args.outputDir);

  const state = evaluateDeclaredStageVsEffectiveStageClarityState({
    repoRoot,
    planPath: path.resolve(repoRoot, args.planPath),
    stageMetricsPath: path.resolve(repoRoot, args.stageMetricsPath),
    parityBaselinePath: path.resolve(repoRoot, args.parityBaselinePath),
    failsignalRegistryPath: path.resolve(repoRoot, args.failsignalRegistryPath),
  });

  const gates = {
    p1_05_declared_stage_defined_check: (
      state.declaredStageDefinedCheck.activeStageKnown
      && state.declaredStageDefinedCheck.declaredStageSetIncludesActive
      && state.declaredStageDefinedCheck.declaredStageSet.length > 0
    ) ? 'PASS' : 'FAIL',
    p1_05_effective_stage_mapping_check: state.effectiveStageMappingCheck.stageMappingComplete ? 'PASS' : 'FAIL',
    p1_05_declared_vs_effective_stage_alignment_check: state.declaredVsEffectiveStageAlignmentCheck.alignmentOk ? 'PASS' : 'FAIL',
    advisory_to_blocking_drift_count_zero: state.advisoryToBlockingDriftCountZero ? 'PASS' : 'FAIL',
  };

  const summary = {
    status: Object.values(gates).every((value) => value === 'PASS') ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    alignmentRule: 'DECLARED_STAGE_SET_MUST_MATCH_EFFECTIVE_STAGE_SET_FOR_ACTIVE_SCOPE',
    driftTarget: 0,
    activeStageId: state.declaredStageDefinedCheck.activeStageId || '',
    declaredActiveScopeSet: state.declaredVsEffectiveStageAlignmentCheck.declaredActiveScopeSet,
    effectiveActiveScopeSet: state.declaredVsEffectiveStageAlignmentCheck.effectiveActiveScopeSet,
    stageDriftCount: state.stageDriftCount,
    stageMappingComplete: state.effectiveStageMappingCheck.stageMappingComplete,
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    gates,
    generatedAtUtc: new Date().toISOString(),
  };

  const ticketMeta = {
    runId: summary.runId,
    ticketId: summary.ticketId,
    outputDir: path.relative(repoRoot, outputDir).replaceAll(path.sep, '/'),
    generatedAtUtc: summary.generatedAtUtc,
  };

  writeJson(path.join(outputDir, 'declared-stage-vs-effective-stage-map.json'), {
    activeStageId: state.declaredStageDefinedCheck.activeStageId,
    declaredStageSet: state.declaredStageDefinedCheck.declaredStageSet,
    effectiveStageSet: state.effectiveStageMappingCheck.effectiveStageSet,
    declaredActiveScopeSet: state.declaredVsEffectiveStageAlignmentCheck.declaredActiveScopeSet,
    effectiveActiveScopeSet: state.declaredVsEffectiveStageAlignmentCheck.effectiveActiveScopeSet,
    stageMap: state.stageMap,
    stageMapSha256: state.stageMapSha256,
  });

  writeJson(path.join(outputDir, 'stage-alignment-gaps.json'), {
    stageDriftCount: state.stageDriftCount,
    declaredNotEffective: state.declaredVsEffectiveStageAlignmentCheck.declaredNotEffective,
    effectiveNotDeclared: state.declaredVsEffectiveStageAlignmentCheck.effectiveNotDeclared,
    stageAlignmentGaps: state.stageAlignmentGaps,
    stageMappingComplete: state.effectiveStageMappingCheck.stageMappingComplete,
  });

  writeJson(path.join(outputDir, 'stage-clarity-report.json'), {
    declaredStageDefinedCheck: state.declaredStageDefinedCheck,
    effectiveStageMappingCheck: state.effectiveStageMappingCheck,
    declaredVsEffectiveStageAlignmentCheck: state.declaredVsEffectiveStageAlignmentCheck,
    singleBlockingAuthority: state.singleBlockingAuthority,
    issues: state.issues,
  });

  writeJson(path.join(outputDir, 'advisory-blocking-drift-cases.json'), {
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero: state.advisoryToBlockingDriftCountZero,
    driftCases: state.driftCases,
  });

  writeJson(path.join(outputDir, 'summary.json'), summary);
  writeJson(path.join(outputDir, 'ticket-meta.json'), ticketMeta);

  process.stdout.write(`${stableStringify(summary)}\n`);
  process.exit(summary.status === 'PASS' ? 0 : 1);
}

main();
