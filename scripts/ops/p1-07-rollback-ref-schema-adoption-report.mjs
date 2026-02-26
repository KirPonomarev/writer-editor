#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateRollbackRefSchemaAdoptionState } from './rollback-ref-schema-adoption-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P1_CONTOUR/TICKET_07';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/ROLLBACK_REF_SCHEMA_ADOPTION_v3.json';
const DEFAULT_REQUIRED_SET_PATH = 'docs/OPS/STATUS/REQUIRED_SET_PHASE_3_V1.json';
const DEFAULT_PHASE_SWITCH_PATH = 'docs/OPS/STATUS/PHASE_SWITCH_V1.json';
const DEFAULT_TOKEN_CATALOG_PATH = 'docs/OPS/TOKENS/TOKEN_CATALOG.json';
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

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    outputDir: DEFAULT_OUTPUT_DIR,
    statusPath: DEFAULT_STATUS_PATH,
    requiredSetPath: DEFAULT_REQUIRED_SET_PATH,
    phaseSwitchPath: DEFAULT_PHASE_SWITCH_PATH,
    tokenCatalogPath: DEFAULT_TOKEN_CATALOG_PATH,
    failsignalRegistryPath: DEFAULT_FAILSIGNAL_REGISTRY_PATH,
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

    if (arg === '--status-path' && i + 1 < argv.length) {
      out.statusPath = normalizeString(argv[i + 1]) || DEFAULT_STATUS_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--status-path=')) {
      out.statusPath = normalizeString(arg.slice('--status-path='.length)) || DEFAULT_STATUS_PATH;
      continue;
    }

    if (arg === '--required-set-path' && i + 1 < argv.length) {
      out.requiredSetPath = normalizeString(argv[i + 1]) || DEFAULT_REQUIRED_SET_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--required-set-path=')) {
      out.requiredSetPath = normalizeString(arg.slice('--required-set-path='.length)) || DEFAULT_REQUIRED_SET_PATH;
      continue;
    }

    if (arg === '--phase-switch-path' && i + 1 < argv.length) {
      out.phaseSwitchPath = normalizeString(argv[i + 1]) || DEFAULT_PHASE_SWITCH_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--phase-switch-path=')) {
      out.phaseSwitchPath = normalizeString(arg.slice('--phase-switch-path='.length)) || DEFAULT_PHASE_SWITCH_PATH;
      continue;
    }

    if (arg === '--token-catalog-path' && i + 1 < argv.length) {
      out.tokenCatalogPath = normalizeString(argv[i + 1]) || DEFAULT_TOKEN_CATALOG_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--token-catalog-path=')) {
      out.tokenCatalogPath = normalizeString(arg.slice('--token-catalog-path='.length)) || DEFAULT_TOKEN_CATALOG_PATH;
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

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${stableStringify(value)}\n`, 'utf8');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const outputDir = path.resolve(repoRoot, args.outputDir);
  const statusPath = path.resolve(repoRoot, args.statusPath);

  const state = evaluateRollbackRefSchemaAdoptionState({
    repoRoot,
    requiredSetPath: path.resolve(repoRoot, args.requiredSetPath),
    phaseSwitchPath: path.resolve(repoRoot, args.phaseSwitchPath),
    tokenCatalogPath: path.resolve(repoRoot, args.tokenCatalogPath),
    failsignalRegistryPath: path.resolve(repoRoot, args.failsignalRegistryPath),
  });

  const gates = {
    p1_07_blocking_entities_have_rollback_ref_check: state.blockingEntitiesHaveRollbackRefCheck ? 'PASS' : 'FAIL',
    p1_07_owner_deadline_evidence_required_check: state.ownerDeadlineEvidenceRequiredCheck ? 'PASS' : 'FAIL',
    p1_07_missing_rollback_ref_negative_check: state.missingRollbackRefNegativeCheck ? 'PASS' : 'FAIL',
    p1_07_phase_aware_enforcement_signal_warn_hard_check: state.phaseAwareEnforcementSignalWarnHardCheck ? 'PASS' : 'FAIL',
    mc_advisory_blocking_drift_zero: state.advisoryToBlockingDriftCountZero ? 'PASS' : 'FAIL',
  };

  const status = Object.values(gates).every((value) => value === 'PASS') ? 'PASS' : 'FAIL';
  const generatedAtUtc = new Date().toISOString();

  const summary = {
    status,
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    requiredBlockingTokenCount: state.requiredBlockingTokenCount,
    missingRollbackRefCount: state.completeness.missingRollbackRefCount,
    invalidRollbackRefCount: state.completeness.invalidRollbackRefCount,
    incompleteEntityCount: state.completeness.incompleteEntityCount,
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    singleBlockingAuthorityOk: state.singleBlockingAuthority.ok,
    gates,
    generatedAtUtc,
  };

  writeJson(statusPath, {
    version: 3,
    token: 'ROLLBACK_REF_SCHEMA_ADOPTION_OK',
    evaluatorId: 'CANONICAL_MODE_MATRIX_EVALUATOR_V1',
    requiredBlockingTokenCount: state.requiredBlockingTokenCount,
    missingRollbackRefCount: state.completeness.missingRollbackRefCount,
    invalidRollbackRefCount: state.completeness.invalidRollbackRefCount,
    incompleteEntityCount: state.completeness.incompleteEntityCount,
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    gates,
    status,
    updatedAtUtc: generatedAtUtc,
  });

  writeJson(path.join(outputDir, 'blocking-entity-contract-backfill.json'), {
    requiredBlockingTokenIds: state.requiredBlockingTokenIds,
    requiredBlockingTokenCount: state.requiredBlockingTokenCount,
    blockingEntityContracts: state.blockingEntityContracts,
  });

  writeJson(path.join(outputDir, 'rollback-ref-validation-cases.json'), {
    blockingEntitiesHaveRollbackRefCheck: state.blockingEntitiesHaveRollbackRefCheck,
    ownerDeadlineEvidenceRequiredCheck: state.ownerDeadlineEvidenceRequiredCheck,
    rollbackRefFormatValidCheck: state.rollbackRefFormatValidCheck,
    completeness: state.completeness,
  });

  writeJson(path.join(outputDir, 'missing-rollback-ref-negative-cases.json'), {
    missingRollbackRefNegativeCheck: state.missingRollbackRefNegativeCheck,
    phaseAwareEnforcementSignalWarnHardCheck: state.phaseAwareEnforcementSignalWarnHardCheck,
    negative: state.missingRollbackRefNegative,
    phaseEnforcement: state.phaseEnforcement,
  });

  writeJson(path.join(outputDir, 'advisory-blocking-drift-cases.json'), {
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero: state.advisoryToBlockingDriftCountZero,
    driftCases: state.driftCases,
  });

  writeJson(path.join(outputDir, 'summary.json'), summary);
  writeJson(path.join(outputDir, 'ticket-meta.json'), {
    runId: summary.runId,
    ticketId: summary.ticketId,
    outputDir: path.relative(repoRoot, outputDir).replaceAll(path.sep, '/'),
    generatedAtUtc,
  });

  process.stdout.write(`${stableStringify(summary)}\n`);
  process.exit(status === 'PASS' ? 0 : 1);
}

main();
