#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateL3FastLaneEnforcementState } from './l3-fast-lane-enforcement-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P1_CONTOUR/TICKET_06';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_PACKAGE_JSON_PATH = 'package.json';

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
    packageJsonPath: DEFAULT_PACKAGE_JSON_PATH,
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

    if (arg === '--package-json-path' && i + 1 < argv.length) {
      out.packageJsonPath = normalizeString(argv[i + 1]) || DEFAULT_PACKAGE_JSON_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--package-json-path=')) {
      out.packageJsonPath = normalizeString(arg.slice('--package-json-path='.length)) || DEFAULT_PACKAGE_JSON_PATH;
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

  const state = evaluateL3FastLaneEnforcementState({
    repoRoot,
    failsignalRegistryPath: path.resolve(repoRoot, args.failsignalRegistryPath),
    packageJsonPath: path.resolve(repoRoot, args.packageJsonPath),
  });

  const lowRiskCases = Array.isArray(state.lowRiskScopeClassificationCheck.caseResults)
    ? state.lowRiskScopeClassificationCheck.caseResults
    : [];

  const gates = {
    single_blocking_authority_enforced: state.singleBlockingAuthority.ok ? 'PASS' : 'FAIL',
    p1_06_low_risk_scope_classification_check: state.lowRiskScopeClassificationCheck.ok ? 'PASS' : 'FAIL',
    p1_06_heavy_lane_forbidden_by_default_check: state.heavyLaneForbiddenByDefaultCheck.ok ? 'PASS' : 'FAIL',
    p1_06_canonical_smoke_required_check: state.canonicalSmokeRequiredCheck.ok ? 'PASS' : 'FAIL',
    no_advisory_to_blocking_drift: state.advisoryToBlockingDriftCountZero ? 'PASS' : 'FAIL',
  };

  const summary = {
    status: Object.values(gates).every((value) => value === 'PASS') ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    scopeRule: state.scopeRule,
    lowRiskCaseCount: lowRiskCases.length,
    lowRiskCasePassCount: lowRiskCases.filter((row) => row.ok).length,
    heavyLaneByDefaultForbidden: state.heavyLaneForbiddenByDefaultCheck.heavyLaneByDefaultForbidden,
    explicitHeavyTriggerCount: Array.isArray(state.heavyLaneForbiddenByDefaultCheck.explicitHeavyTriggers)
      ? state.heavyLaneForbiddenByDefaultCheck.explicitHeavyTriggers.length
      : 0,
    canonicalSmokeRequiredCount: Array.isArray(state.canonicalSmokeRequiredCheck.requiredSmokes)
      ? state.canonicalSmokeRequiredCheck.requiredSmokes.length
      : 0,
    canonicalSmokeMissingCount: Array.isArray(state.canonicalSmokeRequiredCheck.missingOrUnknown)
      ? state.canonicalSmokeRequiredCheck.missingOrUnknown.length
      : 0,
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    singleBlockingAuthorityOk: state.singleBlockingAuthority.ok,
    gates,
    generatedAtUtc: new Date().toISOString(),
  };

  const ticketMeta = {
    runId: summary.runId,
    ticketId: summary.ticketId,
    outputDir: path.relative(repoRoot, outputDir).replaceAll(path.sep, '/'),
    generatedAtUtc: summary.generatedAtUtc,
  };

  writeJson(path.join(outputDir, 'l3-fast-lane-scope-matrix.json'), {
    scopeRule: state.scopeRule,
    matrixVersion: state.matrixVersion,
    lowRiskScopeClassificationCheck: state.lowRiskScopeClassificationCheck,
    p1_06ScopeRule: 'LOW_RISK_UI_MENU_DESIGN_ONLY',
  });

  writeJson(path.join(outputDir, 'heavy-lane-blocks-low-risk-proof.json'), {
    lowRiskScopeClassificationCheck: state.lowRiskScopeClassificationCheck,
    heavyLaneForbiddenByDefaultCheck: state.heavyLaneForbiddenByDefaultCheck,
    heavyLaneDefaultRule: 'HEAVY_LANE_FORBIDDEN_BY_DEFAULT_FOR_LOW_RISK_L3',
  });

  writeJson(path.join(outputDir, 'fast-lane-smoke-proof.json'), {
    canonicalSmokeRequiredCheck: state.canonicalSmokeRequiredCheck,
    canonicalSmokeSafetyRule: 'CANONICAL_NON_REGRESSION_SMOKE_REQUIRED',
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
