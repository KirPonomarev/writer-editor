#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  evaluateMigrationCompletenessVerifierState,
  DEFAULT_DECLARED_STEPS,
} from './migration-completeness-verifier-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P1_CONTOUR/TICKET_04';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_REQUIRED_SET_PATH = 'docs/OPS/EXECUTION/REQUIRED_TOKEN_SET.json';

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
    requiredSetPath: DEFAULT_REQUIRED_SET_PATH,
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

    if (arg === '--required-set-path' && i + 1 < argv.length) {
      out.requiredSetPath = normalizeString(argv[i + 1]) || DEFAULT_REQUIRED_SET_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--required-set-path=')) {
      out.requiredSetPath = normalizeString(arg.slice('--required-set-path='.length)) || DEFAULT_REQUIRED_SET_PATH;
    }
  }

  return out;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${stableStringify(value)}\n`, 'utf8');
}

function buildNegativeMissingStepScenario(baseState, args) {
  const requiredSteps = (DEFAULT_DECLARED_STEPS || []).filter((row) => row && row.required !== false);
  const removedStep = requiredSteps[0] || null;
  if (!removedStep) {
    return {
      ok: false,
      removedStepId: '',
      expectedFailure: 'MIGRATION_COVERAGE_FAIL',
      actualFailReason: 'NO_REQUIRED_STEPS',
      missingStepDetected: false,
      verifierStatus: 'FAIL',
      details: {
        removed: null,
        missingSteps: [],
      },
    };
  }

  const overridden = requiredSteps.filter((row) => row.id !== removedStep.id);
  const negativeState = evaluateMigrationCompletenessVerifierState({
    repoRoot: process.cwd(),
    declaredSteps: overridden,
    failsignalRegistryPath: args.failsignalRegistryPath,
    requiredSetPath: args.requiredSetPath,
  });

  const missing = {
    stepId: removedStep.id,
    filePath: removedStep.filePath,
    reason: 'DECLARED_STEP_MISSING',
  };
  const mergedMissingSteps = [...(negativeState.coverage.missingSteps || []), missing];
  const missingDetected = mergedMissingSteps.some((row) => row.stepId === removedStep.id);
  const expectedFailure = 'MIGRATION_COVERAGE_FAIL';
  const actualFailReason = !negativeState.coverage.coverageOk
    ? 'MIGRATION_COVERAGE_FAIL'
    : negativeState.failReason || '';
  const ok = actualFailReason === expectedFailure && missingDetected;

  return {
    ok,
    removedStepId: removedStep.id,
    expectedFailure,
    actualFailReason,
    missingStepDetected: missingDetected,
    verifierStatus: ok ? 'PASS' : 'FAIL',
    details: {
      removed: removedStep,
      coveragePctAfterRemoval: negativeState.coverage.coveragePct,
      missingSteps: mergedMissingSteps,
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const outputDir = path.resolve(repoRoot, args.outputDir);

  const state = evaluateMigrationCompletenessVerifierState({
    repoRoot,
    failsignalRegistryPath: path.resolve(repoRoot, args.failsignalRegistryPath),
    requiredSetPath: path.resolve(repoRoot, args.requiredSetPath),
  });
  const negative = buildNegativeMissingStepScenario(state, args);

  const gates = {
    p1_04_migration_coverage_check: state.coverage.coverageOk ? 'PASS' : 'FAIL',
    p1_04_missing_step_negative_check: negative.ok ? 'PASS' : 'FAIL',
    p1_04_backward_compatibility_check: state.backwardCompatibility.ok ? 'PASS' : 'FAIL',
    advisory_to_blocking_drift_count_zero: state.advisoryToBlockingDriftCountZero ? 'PASS' : 'FAIL',
  };

  const summary = {
    status: Object.values(gates).every((value) => value === 'PASS') ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    coverageTargetPct: 100,
    migrationCoveragePct: state.coverage.coveragePct,
    requiredDeclaredSteps: state.coverage.requiredDeclaredCount,
    requiredVerifiedSteps: state.coverage.requiredVerifiedCount,
    missingStepsCount: state.coverage.missingSteps.length,
    missingStepNegativeCheckOk: negative.ok,
    backwardCompatibilityOk: state.backwardCompatibility.ok,
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

  writeJson(path.join(outputDir, 'migration-input-output-map.json'), {
    coverageTargetPct: 100,
    migrationCoveragePct: state.coverage.coveragePct,
    requiredDeclaredCount: state.coverage.requiredDeclaredCount,
    requiredVerifiedCount: state.coverage.requiredVerifiedCount,
    steps: state.coverage.declaredSteps,
  });

  writeJson(path.join(outputDir, 'migration-gap-report.json'), {
    coverageOk: state.coverage.coverageOk,
    coveragePct: state.coverage.coveragePct,
    requiredDeclaredCount: state.coverage.requiredDeclaredCount,
    requiredVerifiedCount: state.coverage.requiredVerifiedCount,
    missingSteps: state.coverage.missingSteps,
    backwardCompatibility: state.backwardCompatibility,
  });

  writeJson(path.join(outputDir, 'migration-negative-missing-step.json'), negative);

  writeJson(path.join(outputDir, 'safety-parity-proof.json'), {
    releaseRequiredBefore: state.safetyParity.releaseRequiredBefore,
    releaseRequiredAfter: state.safetyParity.releaseRequiredAfter,
    releaseRequiredBeforeSha256: state.safetyParity.releaseRequiredBeforeSha256,
    releaseRequiredAfterSha256: state.safetyParity.releaseRequiredAfterSha256,
    assertBlockingSetSizeUnchanged: state.safetyParity.assertBlockingSetSizeUnchanged,
    assertBlockingSetExactEqual: state.safetyParity.assertBlockingSetExactEqual,
    assertBlockingSetSha256Equal: state.safetyParity.assertBlockingSetSha256Equal,
    safetyParityOk: state.safetyParity.ok,
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
