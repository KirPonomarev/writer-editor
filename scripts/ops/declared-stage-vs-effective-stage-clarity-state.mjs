#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';
import {
  KNOWN_STAGE_IDS,
  DEFAULT_ROLLOUT_PLAN_PATH,
} from './xplat-rollout-plan-state.mjs';

const TOKEN_NAME = 'DECLARED_STAGE_EFFECTIVE_STAGE_CLARITY_OK';
const FAIL_SIGNAL_CODE = 'E_GOVERNANCE_STRICT_FAIL';
const DEFAULT_STAGE_METRICS_PATH = 'docs/OPS/STATUS/XPLAT_STAGE_METRICS_v3_12.json';
const DEFAULT_PARITY_BASELINE_PATH = 'docs/OPS/STATUS/XPLAT_PARITY_BASELINE_v3_12.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';

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

function readJsonObject(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return isObjectRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function sha256Hex(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function uniqueKnownStages(values) {
  const set = new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => normalizeString(value))
      .filter((value) => KNOWN_STAGE_IDS.includes(value)),
  );
  return KNOWN_STAGE_IDS.filter((stageId) => set.has(stageId));
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    planPath: '',
    stageMetricsPath: '',
    parityBaselinePath: '',
    failsignalRegistryPath: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--json') {
      out.json = true;
      continue;
    }

    if (arg === '--plan-path' && i + 1 < argv.length) {
      out.planPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--plan-path=')) {
      out.planPath = normalizeString(arg.slice('--plan-path='.length));
      continue;
    }

    if (arg === '--stage-metrics-path' && i + 1 < argv.length) {
      out.stageMetricsPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--stage-metrics-path=')) {
      out.stageMetricsPath = normalizeString(arg.slice('--stage-metrics-path='.length));
      continue;
    }

    if (arg === '--parity-baseline-path' && i + 1 < argv.length) {
      out.parityBaselinePath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--parity-baseline-path=')) {
      out.parityBaselinePath = normalizeString(arg.slice('--parity-baseline-path='.length));
      continue;
    }

    if (arg === '--failsignal-registry-path' && i + 1 < argv.length) {
      out.failsignalRegistryPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--failsignal-registry-path=')) {
      out.failsignalRegistryPath = normalizeString(arg.slice('--failsignal-registry-path='.length));
    }
  }

  return out;
}

function evaluateSingleBlockingAuthority(repoRoot) {
  const verdict = evaluateModeMatrixVerdict({
    repoRoot,
    mode: 'pr',
    failSignalCode: 'E_REMOTE_UNAVAILABLE',
  });

  const ok = verdict.ok && verdict.evaluatorId === CANONICAL_MODE_MATRIX_EVALUATOR_ID;
  return {
    ok,
    evaluatorIdObserved: verdict.evaluatorId,
    evaluatorIdExpected: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    mode: verdict.mode,
    failSignalCode: verdict.failSignalCode,
    verdictShouldBlock: verdict.shouldBlock,
    issues: verdict.issues || [],
  };
}

function evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryPath) {
  const registryDoc = readJsonObject(failsignalRegistryPath);
  if (!registryDoc || !Array.isArray(registryDoc.failSignals)) {
    return {
      ok: false,
      advisoryToBlockingDriftCount: -1,
      driftCases: [],
      issues: [
        {
          code: 'FAILSIGNAL_REGISTRY_UNREADABLE',
          failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),
        },
      ],
    };
  }

  const modePairs = [
    { mode: 'pr', key: 'prCore' },
    { mode: 'release', key: 'release' },
    { mode: 'promotion', key: 'promotion' },
  ];

  const driftCases = [];
  const issues = [];

  for (const row of registryDoc.failSignals) {
    if (!isObjectRecord(row)) continue;
    const failSignalCode = normalizeString(row.code);
    if (!failSignalCode) continue;

    for (const pair of modePairs) {
      const expectedDisposition = normalizeString((row.modeMatrix || {})[pair.key]).toLowerCase();
      if (expectedDisposition !== 'advisory') continue;

      const verdict = evaluateModeMatrixVerdict({
        repoRoot,
        mode: pair.mode,
        failSignalCode,
      });

      if (!verdict.ok) {
        issues.push({
          code: 'MODE_EVALUATOR_ERROR',
          failSignalCode,
          mode: pair.mode,
          evaluatorIssues: verdict.issues || [],
        });
        continue;
      }

      if (verdict.shouldBlock) {
        driftCases.push({
          failSignalCode,
          mode: pair.mode,
          expectedDisposition,
          actualDisposition: verdict.modeDisposition,
          actualShouldBlock: verdict.shouldBlock,
          reason: 'ADVISORY_TO_BLOCKING_DRIFT',
        });
      }
    }
  }

  return {
    ok: issues.length === 0,
    advisoryToBlockingDriftCount: driftCases.length,
    driftCases,
    issues,
  };
}

function evaluateDeclaredVsEffectiveStageClarity(input) {
  const {
    repoRoot,
    planPath,
    stageMetricsPath,
    parityBaselinePath,
    planDoc,
    stageMetricsDoc,
    parityBaselineDoc,
  } = input;

  const issues = [];
  const plan = isObjectRecord(planDoc) ? planDoc : readJsonObject(planPath);
  const stageMetrics = isObjectRecord(stageMetricsDoc) ? stageMetricsDoc : readJsonObject(stageMetricsPath);
  const parityBaseline = isObjectRecord(parityBaselineDoc) ? parityBaselineDoc : readJsonObject(parityBaselinePath);

  if (!plan) {
    issues.push({ code: 'STAGE_PLAN_UNREADABLE', path: path.relative(repoRoot, planPath).replaceAll(path.sep, '/') });
  }
  if (!stageMetrics) {
    issues.push({ code: 'STAGE_METRICS_UNREADABLE', path: path.relative(repoRoot, stageMetricsPath).replaceAll(path.sep, '/') });
  }
  if (!parityBaseline) {
    issues.push({ code: 'PARITY_BASELINE_UNREADABLE', path: path.relative(repoRoot, parityBaselinePath).replaceAll(path.sep, '/') });
  }

  const declaredStageSet = plan
    ? uniqueKnownStages([
      ...(Array.isArray(plan.stages) ? plan.stages : []),
      ...((Array.isArray(plan.stageDefinitions) ? plan.stageDefinitions : []).map((row) => isObjectRecord(row) ? row.stageId : '')),
      ...Object.keys(isObjectRecord(plan.stageToScopeFlag) ? plan.stageToScopeFlag : {}),
      normalizeString(plan.activeStageId),
    ])
    : [];

  const activeStageId = plan ? normalizeString(plan.activeStageId) : '';
  const activeStageIndex = KNOWN_STAGE_IDS.indexOf(activeStageId);
  const declaredStageDefinedCheck = {
    declaredStageSet,
    activeStageId,
    activeStageKnown: activeStageIndex !== -1,
    declaredStageSetIncludesActive: activeStageId ? declaredStageSet.includes(activeStageId) : false,
  };

  if (!declaredStageDefinedCheck.activeStageKnown) {
    issues.push({ code: 'DECLARED_ACTIVE_STAGE_UNKNOWN', activeStageId: activeStageId || '' });
  }
  if (declaredStageSet.length === 0) {
    issues.push({ code: 'DECLARED_STAGE_SET_EMPTY' });
  }
  if (activeStageId && !declaredStageSet.includes(activeStageId)) {
    issues.push({ code: 'DECLARED_STAGE_SET_MISSING_ACTIVE', activeStageId });
  }

  const declaredActiveScopeSet = activeStageIndex === -1
    ? []
    : KNOWN_STAGE_IDS
      .slice(0, activeStageIndex + 1)
      .filter((stageId) => declaredStageSet.includes(stageId));

  const metricsStageEvidence = stageMetrics && isObjectRecord(stageMetrics.stageEvidence)
    ? stageMetrics.stageEvidence
    : {};
  const metricsStageSet = uniqueKnownStages(Object.keys(metricsStageEvidence));

  const parityStageId = parityBaseline ? normalizeString(parityBaseline.stageId) : '';

  const effectiveStageSet = uniqueKnownStages([
    'X0',
    ...metricsStageSet,
    parityStageId,
  ]);

  const effectiveActiveScopeSet = activeStageIndex === -1
    ? []
    : KNOWN_STAGE_IDS
      .slice(0, activeStageIndex + 1)
      .filter((stageId) => effectiveStageSet.includes(stageId));

  function isStageMapped(stageId) {
    if (stageId === 'X0') return true;
    if (stageId === 'X1') return metricsStageSet.includes(stageId) || parityStageId === stageId;
    return metricsStageSet.includes(stageId);
  }

  const stageMap = KNOWN_STAGE_IDS.map((stageId) => {
    const isInActiveScope = activeStageIndex !== -1 && KNOWN_STAGE_IDS.indexOf(stageId) <= activeStageIndex;
    const evidenceSources = [];
    if (stageId === 'X0') evidenceSources.push('implicit_x0');
    if (stageId === parityStageId) evidenceSources.push('parity_baseline');
    if (metricsStageSet.includes(stageId)) evidenceSources.push('stage_metrics');
    return {
      stageId,
      declared: declaredStageSet.includes(stageId),
      inActiveScope: isInActiveScope,
      effective: effectiveStageSet.includes(stageId),
      evidenceSources,
      mappedForActiveScope: !isInActiveScope || isStageMapped(stageId),
    };
  });

  const stageAlignmentGaps = stageMap
    .filter((row) => row.inActiveScope && row.declared && !row.mappedForActiveScope)
    .map((row) => ({
      stageId: row.stageId,
      reason: 'DECLARED_STAGE_NOT_MAPPED_IN_EFFECTIVE_SET',
    }));

  const declaredNotEffective = declaredActiveScopeSet.filter((stageId) => !effectiveActiveScopeSet.includes(stageId));
  const effectiveNotDeclared = effectiveActiveScopeSet.filter((stageId) => !declaredActiveScopeSet.includes(stageId));
  const stageDriftCount = declaredNotEffective.length + effectiveNotDeclared.length;

  const effectiveStageMappingCheck = {
    metricsStageSet,
    parityStageId: parityStageId || null,
    effectiveStageSet,
    stageMap,
    stageAlignmentGaps,
    stageMappingComplete: stageAlignmentGaps.length === 0,
  };

  const alignmentCheck = {
    declaredActiveScopeSet,
    effectiveActiveScopeSet,
    declaredNotEffective,
    effectiveNotDeclared,
    stageDriftCount,
    alignmentOk: stageDriftCount === 0,
  };

  if (!effectiveStageMappingCheck.stageMappingComplete) {
    issues.push({ code: 'STAGE_MAPPING_INCOMPLETE', stageAlignmentGaps });
  }
  if (!alignmentCheck.alignmentOk) {
    issues.push({
      code: 'DECLARED_EFFECTIVE_STAGE_DRIFT',
      declaredNotEffective,
      effectiveNotDeclared,
      stageDriftCount,
    });
  }

  return {
    declaredStageDefinedCheck,
    effectiveStageMappingCheck,
    alignmentCheck,
    stageMap,
    stageAlignmentGaps,
    stageDriftCount,
    issues,
  };
}

export function evaluateDeclaredStageVsEffectiveStageClarityState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const planPath = path.resolve(repoRoot, normalizeString(input.planPath || DEFAULT_ROLLOUT_PLAN_PATH));
  const stageMetricsPath = path.resolve(repoRoot, normalizeString(input.stageMetricsPath || DEFAULT_STAGE_METRICS_PATH));
  const parityBaselinePath = path.resolve(repoRoot, normalizeString(input.parityBaselinePath || DEFAULT_PARITY_BASELINE_PATH));
  const failsignalRegistryPath = path.resolve(
    repoRoot,
    normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
  );

  const stageClarity = evaluateDeclaredVsEffectiveStageClarity({
    repoRoot,
    planPath,
    stageMetricsPath,
    parityBaselinePath,
    planDoc: input.planDoc,
    stageMetricsDoc: input.stageMetricsDoc,
    parityBaselineDoc: input.parityBaselineDoc,
  });

  const singleBlockingAuthority = evaluateSingleBlockingAuthority(repoRoot);
  const driftState = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryPath);

  const advisoryToBlockingDriftCount = driftState.advisoryToBlockingDriftCount;
  const advisoryToBlockingDriftCountZero = advisoryToBlockingDriftCount === 0;

  const issues = [
    ...stageClarity.issues,
    ...singleBlockingAuthority.issues,
    ...driftState.issues,
  ];

  const ok = issues.length === 0
    && stageClarity.declaredStageDefinedCheck.activeStageKnown
    && stageClarity.effectiveStageMappingCheck.stageMappingComplete
    && stageClarity.alignmentCheck.alignmentOk
    && singleBlockingAuthority.ok
    && advisoryToBlockingDriftCountZero;

  const stageMapCanonical = stableStringify(stageClarity.stageMap);

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignalCode: ok ? '' : FAIL_SIGNAL_CODE,
    failReason: ok ? '' : (
      !stageClarity.declaredStageDefinedCheck.activeStageKnown
        ? 'DECLARED_STAGE_UNDEFINED'
        : !stageClarity.effectiveStageMappingCheck.stageMappingComplete
          ? 'STAGE_MAPPING_INCOMPLETE'
          : !stageClarity.alignmentCheck.alignmentOk
            ? 'DECLARED_EFFECTIVE_STAGE_DRIFT'
            : !singleBlockingAuthority.ok
              ? 'DUAL_AUTHORITY'
              : !advisoryToBlockingDriftCountZero
                ? 'ADVISORY_BLOCKING_DRIFT_NONZERO'
                : 'STAGE_CLARITY_ISSUES'
    ),
    declaredStageDefinedCheck: stageClarity.declaredStageDefinedCheck,
    effectiveStageMappingCheck: stageClarity.effectiveStageMappingCheck,
    declaredVsEffectiveStageAlignmentCheck: stageClarity.alignmentCheck,
    stageMap: stageClarity.stageMap,
    stageAlignmentGaps: stageClarity.stageAlignmentGaps,
    stageDriftCount: stageClarity.stageDriftCount,
    stageMapSha256: sha256Hex(stageMapCanonical),
    singleBlockingAuthority,
    advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero,
    driftCases: driftState.driftCases,
    failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),
    planPath: path.relative(repoRoot, planPath).replaceAll(path.sep, '/'),
    stageMetricsPath: path.relative(repoRoot, stageMetricsPath).replaceAll(path.sep, '/'),
    parityBaselinePath: path.relative(repoRoot, parityBaselinePath).replaceAll(path.sep, '/'),
    issues,
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`P1_05_ACTIVE_STAGE_ID=${state.declaredStageDefinedCheck.activeStageId || ''}`);
  console.log(`P1_05_DECLARED_STAGE_SET=${JSON.stringify(state.declaredStageDefinedCheck.declaredStageSet)}`);
  console.log(`P1_05_EFFECTIVE_STAGE_SET=${JSON.stringify(state.effectiveStageMappingCheck.effectiveStageSet)}`);
  console.log(`P1_05_STAGE_DRIFT_COUNT=${state.stageDriftCount}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.advisoryToBlockingDriftCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateDeclaredStageVsEffectiveStageClarityState({
    planPath: args.planPath,
    stageMetricsPath: args.stageMetricsPath,
    parityBaselinePath: args.parityBaselinePath,
    failsignalRegistryPath: args.failsignalRegistryPath,
  });

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

export {
  TOKEN_NAME,
  FAIL_SIGNAL_CODE,
};
