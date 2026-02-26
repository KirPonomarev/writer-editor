#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateCommandSurfaceCallerTrustPhase2State } from './command-surface-caller-trust-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P1_CONTOUR/TICKET_06';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/COMMAND_SURFACE_CALLER_TRUST_PHASE_2_v3.json';
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

  const state = evaluateCommandSurfaceCallerTrustPhase2State({
    repoRoot,
    failsignalRegistryPath: path.resolve(repoRoot, args.failsignalRegistryPath),
  });

  const gates = {
    p1_06_hotkey_bypass_block_check: state.mandatoryBypassScenarios.cases.some((entry) => entry.scenarioId === 'hotkey-bypass' && entry.detected) ? 'PASS' : 'FAIL',
    p1_06_palette_bypass_block_check: state.mandatoryBypassScenarios.cases.some((entry) => entry.scenarioId === 'palette-bypass' && entry.detected) ? 'PASS' : 'FAIL',
    p1_06_ipc_direct_bypass_block_check: state.mandatoryBypassScenarios.cases.some((entry) => entry.scenarioId === 'ipc-direct-bypass' && entry.detected) ? 'PASS' : 'FAIL',
    p1_06_context_button_bypass_block_check: state.mandatoryBypassScenarios.cases.some((entry) => entry.scenarioId === 'context-button-bypass' && entry.detected) ? 'PASS' : 'FAIL',
    p1_06_plugin_overlay_bypass_block_check: state.mandatoryBypassScenarios.cases.some((entry) => entry.scenarioId === 'plugin-overlay-bypass' && entry.detected) ? 'PASS' : 'FAIL',
    p1_06_caller_identity_required_check: state.callerIdentityRequiredCheck ? 'PASS' : 'FAIL',
    p1_06_payload_contract_required_check: state.payloadContractRequiredCheck ? 'PASS' : 'FAIL',
    p1_06_alias_indirection_runtime_negative_check: state.aliasIndirectionRuntimeNegativeCheck ? 'PASS' : 'FAIL',
    p1_06_marker_presence_without_runtime_assertion_invalid_check: state.markerPresenceWithoutRuntimeAssertionInvalidCheck ? 'PASS' : 'FAIL',
    p1_06_fast_path_cache_required_check: state.fastPathCacheRequiredCheck ? 'PASS' : 'FAIL',
    mc_advisory_blocking_drift_zero: state.advisoryToBlockingDriftCountZero ? 'PASS' : 'FAIL',
  };

  const status = Object.values(gates).every((value) => value === 'PASS') ? 'PASS' : 'FAIL';
  const generatedAtUtc = new Date().toISOString();

  const summary = {
    status,
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    mandatoryBypassScenarioCount: state.mandatoryBypassScenarios.requiredScenarioCount,
    mandatoryBypassPassingCount: state.mandatoryBypassScenarios.passingScenarioCount,
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    singleBlockingAuthorityOk: state.singleBlockingAuthority.ok,
    fastPathCacheEntryCount: state.fastPathCacheSafetyProof.cacheEntryCount,
    gates,
    generatedAtUtc,
  };

  writeJson(statusPath, {
    version: 3,
    token: 'COMMAND_SURFACE_CALLER_TRUST_PHASE_2_OK',
    evaluatorId: 'CANONICAL_MODE_MATRIX_EVALUATOR_V1',
    mandatoryBypassScenarioCount: state.mandatoryBypassScenarios.requiredScenarioCount,
    mandatoryBypassPassingCount: state.mandatoryBypassScenarios.passingScenarioCount,
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    fastPathCacheEntryCount: state.fastPathCacheSafetyProof.cacheEntryCount,
    gates,
    status,
    updatedAtUtc: generatedAtUtc,
  });

  writeJson(path.join(outputDir, 'command-surface-bypass-scenarios.json'), {
    mandatoryBypassScenariosCheck: state.mandatoryBypassScenariosCheck,
    requiredScenarioCount: state.mandatoryBypassScenarios.requiredScenarioCount,
    passingScenarioCount: state.mandatoryBypassScenarios.passingScenarioCount,
    cases: state.mandatoryBypassScenarios.cases,
  });

  writeJson(path.join(outputDir, 'caller-identity-validation-cases.json'), {
    callerIdentityRequiredCheck: state.callerIdentityRequiredCheck,
    cases: state.callerIdentityValidationCases,
  });

  writeJson(path.join(outputDir, 'payload-contract-validation-cases.json'), {
    payloadContractRequiredCheck: state.payloadContractRequiredCheck,
    cases: state.payloadContractValidationCases,
  });

  writeJson(path.join(outputDir, 'alias-indirection-negative-cases.json'), {
    aliasIndirectionRuntimeNegativeCheck: state.aliasIndirectionRuntimeNegativeCheck,
    markerPresenceWithoutRuntimeAssertionInvalidCheck: state.markerPresenceWithoutRuntimeAssertionInvalidCheck,
    aliasCases: state.aliasIndirectionNegativeCases,
    markerCase: state.markerAssertionCase,
  });

  writeJson(path.join(outputDir, 'fast-path-cache-safety-proof.json'), {
    fastPathCacheRequiredCheck: state.fastPathCacheRequiredCheck,
    proof: state.fastPathCacheSafetyProof,
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
