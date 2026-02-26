#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';

const TOKEN_NAME = 'L3_FAST_LANE_ENFORCEMENT_OK';
const FAIL_SIGNAL_CODE = 'E_GOVERNANCE_STRICT_FAIL';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_PACKAGE_JSON_PATH = 'package.json';

const L3_FAST_LANE_SCOPE_MATRIX = Object.freeze({
  version: 2,
  scopeRule: 'LOW_RISK_UI_MENU_DESIGN_ONLY',
  lanes: {
    dev_fast: {
      laneId: 'dev_fast',
      description: 'Default fast lane for low-risk L3 scope.',
    },
    heavy: {
      laneId: 'heavy',
      description: 'Heavy lane for high-risk or expansion scope.',
    },
  },
  classes: [
    {
      classId: 'LOW_RISK_UI_MENU_DESIGN_ONLY',
      riskLevel: 'LOW',
      allowedTags: ['ui', 'menu', 'design', 'layout', 'copy'],
      forbiddenTags: ['core', 'runtime', 'policy', 'registry', 'required_set', 'security'],
      defaultLane: 'dev_fast',
      heavyLaneByDefault: false,
      canonicalSmoke: [
        'doctor_strict',
        'dev_fast_lane_contract',
        'mode_matrix_authority_nonregression',
      ],
      explicitHeavyTriggers: [
        'core_contract_change',
        'runtime_wiring_change',
        'policy_surface_expansion',
        'new_blocking_gate',
      ],
    },
    {
      classId: 'NON_L3_OR_HIGH_RISK',
      riskLevel: 'HIGH',
      allowedTags: ['core', 'runtime', 'policy', 'registry', 'required_set', 'security'],
      forbiddenTags: [],
      defaultLane: 'heavy',
      heavyLaneByDefault: true,
      canonicalSmoke: ['doctor_strict'],
      explicitHeavyTriggers: [],
    },
  ],
});

const CANONICAL_SMOKE_REGISTRY = Object.freeze({
  doctor_strict: {
    type: 'script',
    path: 'scripts/doctor.mjs',
  },
  dev_fast_lane_contract: {
    type: 'contract',
    path: 'test/contracts/dev-fast-lane.contract.test.js',
  },
  mode_matrix_authority_nonregression: {
    type: 'contract',
    path: 'test/contracts/mode-matrix-single-authority.contract.test.js',
  },
});

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

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    failsignalRegistryPath: '',
    packageJsonPath: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--json') {
      out.json = true;
      continue;
    }

    if (arg === '--failsignal-registry-path' && i + 1 < argv.length) {
      out.failsignalRegistryPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--failsignal-registry-path=')) {
      out.failsignalRegistryPath = normalizeString(arg.slice('--failsignal-registry-path='.length));
      continue;
    }

    if (arg === '--package-json-path' && i + 1 < argv.length) {
      out.packageJsonPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--package-json-path=')) {
      out.packageJsonPath = normalizeString(arg.slice('--package-json-path='.length));
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

function classifyWorkItem(workItem, lowRiskClass) {
  const tags = Array.isArray(workItem.tags)
    ? workItem.tags.map((tag) => normalizeString(tag).toLowerCase()).filter(Boolean)
    : [];

  const forbidden = new Set((lowRiskClass.forbiddenTags || []).map((tag) => normalizeString(tag).toLowerCase()));
  const allowed = new Set((lowRiskClass.allowedTags || []).map((tag) => normalizeString(tag).toLowerCase()));

  const forbiddenHit = tags.find((tag) => forbidden.has(tag)) || '';
  const nonAllowedHit = tags.find((tag) => !allowed.has(tag)) || '';

  if (forbiddenHit || nonAllowedHit) {
    return {
      classification: 'NON_L3_OR_HIGH_RISK',
      lane: 'heavy',
      reasons: [forbiddenHit ? `forbidden:${forbiddenHit}` : '', nonAllowedHit ? `not_allowed:${nonAllowedHit}` : ''].filter(Boolean),
    };
  }

  return {
    classification: lowRiskClass.classId,
    lane: lowRiskClass.defaultLane,
    reasons: ['all_tags_low_risk_allowed'],
  };
}

function evaluateLowRiskScopeClassification(matrix) {
  const lowRiskClass = (Array.isArray(matrix.classes) ? matrix.classes : [])
    .find((row) => isObjectRecord(row) && row.classId === 'LOW_RISK_UI_MENU_DESIGN_ONLY');

  if (!lowRiskClass) {
    return {
      ok: false,
      lowRiskClassDefined: false,
      caseResults: [],
      issues: [{ code: 'LOW_RISK_CLASS_MISSING' }],
      lowRiskClass: null,
    };
  }

  const cases = [
    {
      caseId: 'ui_menu_label_update',
      tags: ['ui', 'menu', 'design'],
      expectedClass: 'LOW_RISK_UI_MENU_DESIGN_ONLY',
      expectedLane: 'dev_fast',
    },
    {
      caseId: 'ui_toolbar_spacing',
      tags: ['ui', 'design', 'layout'],
      expectedClass: 'LOW_RISK_UI_MENU_DESIGN_ONLY',
      expectedLane: 'dev_fast',
    },
    {
      caseId: 'core_runtime_policy_change',
      tags: ['core', 'runtime', 'policy'],
      expectedClass: 'NON_L3_OR_HIGH_RISK',
      expectedLane: 'heavy',
    },
  ];

  const caseResults = cases.map((oneCase) => {
    const actual = classifyWorkItem(oneCase, lowRiskClass);
    const ok = actual.classification === oneCase.expectedClass && actual.lane === oneCase.expectedLane;
    return {
      ...oneCase,
      actualClass: actual.classification,
      actualLane: actual.lane,
      reasons: actual.reasons,
      ok,
    };
  });

  return {
    ok: caseResults.every((row) => row.ok),
    lowRiskClassDefined: true,
    lowRiskClass,
    caseResults,
    issues: [],
  };
}

function evaluateHeavyLaneForbiddenByDefault(lowRiskScopeState) {
  const lowRiskClass = lowRiskScopeState.lowRiskClass;
  if (!lowRiskClass) {
    return {
      ok: false,
      heavyLaneByDefaultForbidden: false,
      issues: [{ code: 'LOW_RISK_CLASS_MISSING' }],
    };
  }

  const heavyLaneByDefaultForbidden = lowRiskClass.defaultLane === 'dev_fast'
    && lowRiskClass.heavyLaneByDefault === false;
  const explicitHeavyTriggers = Array.isArray(lowRiskClass.explicitHeavyTriggers)
    ? lowRiskClass.explicitHeavyTriggers.map((item) => normalizeString(item)).filter(Boolean)
    : [];

  const lowRiskDefaultedToHeavy = lowRiskScopeState.caseResults
    .filter((row) => row.expectedClass === 'LOW_RISK_UI_MENU_DESIGN_ONLY' && row.actualLane === 'heavy')
    .map((row) => row.caseId);

  const ok = heavyLaneByDefaultForbidden
    && explicitHeavyTriggers.length > 0
    && lowRiskDefaultedToHeavy.length === 0;

  return {
    ok,
    heavyLaneByDefaultForbidden,
    defaultLane: lowRiskClass.defaultLane,
    heavyLaneByDefault: lowRiskClass.heavyLaneByDefault,
    explicitHeavyTriggers,
    lowRiskDefaultedToHeavy,
    issues: [],
  };
}

function evaluateCanonicalSmokeRequired(repoRoot, matrix, packageJsonPath) {
  const lowRiskClass = (Array.isArray(matrix.classes) ? matrix.classes : [])
    .find((row) => isObjectRecord(row) && row.classId === 'LOW_RISK_UI_MENU_DESIGN_ONLY');

  if (!lowRiskClass) {
    return {
      ok: false,
      issues: [{ code: 'LOW_RISK_CLASS_MISSING' }],
      requiredSmokes: [],
      resolvedSmokes: [],
      packageScriptChecks: {},
    };
  }

  const requiredSmokes = Array.isArray(lowRiskClass.canonicalSmoke)
    ? lowRiskClass.canonicalSmoke.map((item) => normalizeString(item)).filter(Boolean)
    : [];

  const resolvedSmokes = requiredSmokes.map((smokeId) => {
    const smokeDef = CANONICAL_SMOKE_REGISTRY[smokeId];
    const smokePath = smokeDef ? normalizeString(smokeDef.path) : '';
    const smokeAbsPath = smokePath ? path.resolve(repoRoot, smokePath) : '';
    const exists = smokeAbsPath ? fs.existsSync(smokeAbsPath) : false;
    return {
      smokeId,
      known: Boolean(smokeDef),
      type: smokeDef ? smokeDef.type : '',
      path: smokePath,
      exists,
    };
  });

  const packageDoc = readJsonObject(packageJsonPath);
  const scripts = packageDoc && isObjectRecord(packageDoc.scripts) ? packageDoc.scripts : {};
  const devFastScript = normalizeString(scripts['dev:fast']);

  const packageScriptChecks = {
    devFastScriptDefined: Boolean(devFastScript),
    devFastScriptReferencesRunTestsFast: devFastScript.includes('scripts/run-tests.js') && devFastScript.includes('fast'),
    doctorScriptExists: fs.existsSync(path.resolve(repoRoot, 'scripts/doctor.mjs')),
  };

  const missingOrUnknown = resolvedSmokes.filter((row) => !row.known || !row.exists);

  const ok = requiredSmokes.length >= 3
    && missingOrUnknown.length === 0
    && packageScriptChecks.devFastScriptDefined
    && packageScriptChecks.devFastScriptReferencesRunTestsFast
    && packageScriptChecks.doctorScriptExists;

  return {
    ok,
    requiredSmokes,
    resolvedSmokes,
    missingOrUnknown,
    packageScriptChecks,
    issues: [],
  };
}

export function evaluateL3FastLaneEnforcementState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const failsignalRegistryPath = path.resolve(
    repoRoot,
    normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
  );
  const packageJsonPath = path.resolve(
    repoRoot,
    normalizeString(input.packageJsonPath || DEFAULT_PACKAGE_JSON_PATH),
  );

  const matrix = isObjectRecord(input.scopeMatrixOverride)
    ? input.scopeMatrixOverride
    : L3_FAST_LANE_SCOPE_MATRIX;

  const lowRiskScopeState = evaluateLowRiskScopeClassification(matrix);
  const heavyLaneState = evaluateHeavyLaneForbiddenByDefault(lowRiskScopeState);
  const canonicalSmokeState = evaluateCanonicalSmokeRequired(repoRoot, matrix, packageJsonPath);

  const singleBlockingAuthority = evaluateSingleBlockingAuthority(repoRoot);
  const driftState = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryPath);

  const advisoryToBlockingDriftCount = driftState.advisoryToBlockingDriftCount;
  const advisoryToBlockingDriftCountZero = advisoryToBlockingDriftCount === 0;

  const issues = [
    ...lowRiskScopeState.issues,
    ...heavyLaneState.issues,
    ...canonicalSmokeState.issues,
    ...singleBlockingAuthority.issues,
    ...driftState.issues,
  ];

  const ok = issues.length === 0
    && lowRiskScopeState.ok
    && heavyLaneState.ok
    && canonicalSmokeState.ok
    && singleBlockingAuthority.ok
    && advisoryToBlockingDriftCountZero;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignalCode: ok ? '' : FAIL_SIGNAL_CODE,
    failReason: ok ? '' : (
      !lowRiskScopeState.ok
        ? 'LOW_RISK_SCOPE_CLASSIFICATION_FAIL'
        : !heavyLaneState.ok
          ? 'HEAVY_LANE_DEFAULT_VIOLATION'
          : !canonicalSmokeState.ok
            ? 'CANONICAL_SMOKE_MISSING'
            : !singleBlockingAuthority.ok
              ? 'DUAL_AUTHORITY'
              : !advisoryToBlockingDriftCountZero
                ? 'ADVISORY_BLOCKING_DRIFT_NONZERO'
                : 'L3_FAST_LANE_ISSUES'
    ),
    scopeRule: normalizeString(matrix.scopeRule),
    matrixVersion: Number(matrix.version || 0),
    lowRiskScopeClassificationCheck: lowRiskScopeState,
    heavyLaneForbiddenByDefaultCheck: heavyLaneState,
    canonicalSmokeRequiredCheck: canonicalSmokeState,
    singleBlockingAuthority,
    advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero,
    driftCases: driftState.driftCases,
    failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),
    packageJsonPath: path.relative(repoRoot, packageJsonPath).replaceAll(path.sep, '/'),
    issues,
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`P1_06_SCOPE_RULE=${state.scopeRule}`);
  console.log(`P1_06_LOW_RISK_SCOPE_CLASSIFICATION_OK=${state.lowRiskScopeClassificationCheck.ok ? 1 : 0}`);
  console.log(`P1_06_HEAVY_LANE_DEFAULT_FORBIDDEN_OK=${state.heavyLaneForbiddenByDefaultCheck.ok ? 1 : 0}`);
  console.log(`P1_06_CANONICAL_SMOKE_REQUIRED_OK=${state.canonicalSmokeRequiredCheck.ok ? 1 : 0}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.advisoryToBlockingDriftCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateL3FastLaneEnforcementState({
    failsignalRegistryPath: args.failsignalRegistryPath,
    packageJsonPath: args.packageJsonPath,
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
  L3_FAST_LANE_SCOPE_MATRIX,
  CANONICAL_SMOKE_REGISTRY,
};
