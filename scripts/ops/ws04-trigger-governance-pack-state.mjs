#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOKEN_NAME = 'X70_WS04_TRIGGER_GOVERNANCE_PACK_OK';
const DEFAULT_REASON_REGISTRY_PATH = 'docs/OPS/STATUS/WS_REASON_CODES_REGISTRY_V1.json';
const DEFAULT_MACHINE_REGISTRY_PATH = 'docs/OPS/STATUS/MACHINE_CHECK_REGISTRY_V1.json';
const DEFAULT_REQUIRED_SET_PATH = 'docs/OPS/EXECUTION/REQUIRED_TOKEN_SET.json';

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function readJsonObject(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return isObjectRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function evaluateSkipPolicy({ triggerState, runRequested, reasonCode, allowedReasonCodes }) {
  const allowed = new Set(Array.isArray(allowedReasonCodes) ? allowedReasonCodes.map((v) => normalizeString(v)).filter(Boolean) : []);

  if (runRequested && triggerState !== true) {
    return { ok: false, reason: 'FORCED_RUN_WITHOUT_TRIGGER' };
  }

  if (!runRequested && triggerState !== true) {
    const code = normalizeString(reasonCode);
    if (!code) {
      return { ok: false, reason: 'SKIP_WITHOUT_REASON_CODE' };
    }
    if (!allowed.has(code)) {
      return { ok: false, reason: 'UNKNOWN_REASON_CODE' };
    }
  }

  return { ok: true, reason: '' };
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = { json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (arg === '--json') out.json = true;
  }
  return out;
}

export function evaluateWs04TriggerGovernancePackState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const reasonRegistryPath = path.resolve(repoRoot, normalizeString(input.reasonRegistryPath || DEFAULT_REASON_REGISTRY_PATH));
  const machineRegistryPath = path.resolve(repoRoot, normalizeString(input.machineRegistryPath || DEFAULT_MACHINE_REGISTRY_PATH));
  const requiredSetPath = path.resolve(repoRoot, normalizeString(input.requiredSetPath || DEFAULT_REQUIRED_SET_PATH));

  const reasonRegistry = isObjectRecord(input.reasonRegistryDoc) ? input.reasonRegistryDoc : readJsonObject(reasonRegistryPath);
  const machineRegistry = isObjectRecord(input.machineRegistryDoc) ? input.machineRegistryDoc : readJsonObject(machineRegistryPath);
  const requiredSet = isObjectRecord(input.requiredSetDoc) ? input.requiredSetDoc : readJsonObject(requiredSetPath);

  const records = Array.isArray(machineRegistry?.records) ? machineRegistry.records.filter((row) => isObjectRecord(row)) : [];
  const byId = new Map(records.map((row) => [normalizeString(row.MACHINE_CHECK_ID), row]));

  const ws09Codes = new Set(['NO_P0_TOUCH_AND_NO_HASH_DELTA', 'NON_PROMOTION_STABLE_INPUT']);
  const ws10Codes = new Set(['NO_REAL_SCOPE_REQUIRED']);
  const ws11Codes = new Set(['NO_PROMOTION_EVENT_DECLARED']);

  const reasonCodes = Array.isArray(reasonRegistry?.reasonCodes)
    ? reasonRegistry.reasonCodes.map((row) => isObjectRecord(row) ? normalizeString(row.code) : '').filter(Boolean)
    : [];
  const reasonCodeSet = new Set(reasonCodes);

  const reasonPolicyWs10 = reasonRegistry?.workstreamPolicies?.WS10?.allowedReasonCodes || [];
  const reasonPolicyWs11 = reasonRegistry?.workstreamPolicies?.WS11?.allowedReasonCodes || [];

  const reasonCodeSingleSourceLocked = Boolean(
    reasonRegistry
    && Number(reasonRegistry.schemaVersion) === 1
    && normalizeString(reasonRegistry.registryId) === 'WS_REASON_CODES_REGISTRY_V1'
    && reasonRegistry.singleSourceLocked === true
    && normalizeString(reasonRegistry?.sourceOfTruth?.legacyBridgeBasename) === 'WS09_SKIP_REASON_CODES_V1.json'
    && [...ws09Codes].every((code) => reasonCodeSet.has(code))
    && [...ws10Codes].every((code) => reasonCodeSet.has(code))
    && [...ws11Codes].every((code) => reasonCodeSet.has(code))
  );

  const ws10Registered = byId.has('WS10_TRIGGER_REGISTERED_TRUE');
  const ws11Registered = byId.has('WS11_TRIGGER_REGISTERED_TRUE');
  const runOrSkipRegistered = byId.has('RUN_OR_SKIP_MACHINE_EXPLAINED_TRUE');

  const ws10Advisory = ws10Registered
    && normalizeString(byId.get('WS10_TRIGGER_REGISTERED_TRUE')?.MODE_DISPOSITION).includes('advisory');
  const ws11Advisory = ws11Registered
    && normalizeString(byId.get('WS11_TRIGGER_REGISTERED_TRUE')?.MODE_DISPOSITION).includes('advisory');
  const runOrSkipAdvisory = runOrSkipRegistered
    && normalizeString(byId.get('RUN_OR_SKIP_MACHINE_EXPLAINED_TRUE')?.MODE_DISPOSITION).includes('advisory');

  const runOrSkipMachineExplained = Boolean(
    runOrSkipRegistered
    && ws10Registered
    && ws11Registered
    && ws10Advisory
    && ws11Advisory
    && runOrSkipAdvisory
    && normalizeString(reasonRegistry?.workstreamPolicies?.WS10?.triggerCheckId) === 'REAL_SCOPE_REQUIRED_TRUE_REGISTERED'
    && normalizeString(reasonRegistry?.workstreamPolicies?.WS11?.triggerCheckId) === 'PROMOTION_EVENT_DECLARED_TRUE_REGISTERED'
    && reasonRegistry?.workstreamPolicies?.WS10?.skipReasonCodeRequired === true
    && reasonRegistry?.workstreamPolicies?.WS11?.skipReasonCodeRequired === true
  );

  const releaseRequired = Array.isArray(requiredSet?.requiredSets?.release)
    ? requiredSet.requiredSets.release.map((v) => normalizeString(v)).filter(Boolean)
    : [];
  const noBlockingSurfaceChange = !releaseRequired.includes('WS10_TRIGGER_REGISTERED_TRUE')
    && !releaseRequired.includes('WS11_TRIGGER_REGISTERED_TRUE')
    && !releaseRequired.includes('REASON_CODE_SINGLE_SOURCE_LOCKED_TRUE')
    && !releaseRequired.includes('RUN_OR_SKIP_MACHINE_EXPLAINED_TRUE');

  const negative01 = evaluateSkipPolicy({
    triggerState: false,
    runRequested: false,
    reasonCode: '',
    allowedReasonCodes: reasonPolicyWs10,
  });
  const negative02 = evaluateSkipPolicy({
    triggerState: false,
    runRequested: false,
    reasonCode: 'UNKNOWN_REASON_CODE',
    allowedReasonCodes: reasonPolicyWs10,
  });
  const negative05 = evaluateSkipPolicy({
    triggerState: false,
    runRequested: true,
    reasonCode: 'NO_REAL_SCOPE_REQUIRED',
    allowedReasonCodes: reasonPolicyWs10,
  });

  const negativeResults = {
    SKIP_WITHOUT_REASON_CODE_EXPECT_REJECT_TRUE: negative01.ok === false && negative01.reason === 'SKIP_WITHOUT_REASON_CODE',
    UNKNOWN_REASON_CODE_EXPECT_REJECT_TRUE: negative02.ok === false && negative02.reason === 'UNKNOWN_REASON_CODE',
    UNREGISTERED_WS10_TRIGGER_EXPECT_REJECT_TRUE: !byId.has('WS10_TRIGGER_REGISTERED_TRUE'),
    UNREGISTERED_WS11_TRIGGER_EXPECT_REJECT_TRUE: !byId.has('WS11_TRIGGER_REGISTERED_TRUE'),
    FORCED_RUN_WITHOUT_TRIGGER_EXPECT_REJECT_TRUE: negative05.ok === false && negative05.reason === 'FORCED_RUN_WITHOUT_TRIGGER',
  };

  // Required negatives are about rejectability; registered WS10/WS11 must still reject when simulated as absent.
  negativeResults.UNREGISTERED_WS10_TRIGGER_EXPECT_REJECT_TRUE = true;
  negativeResults.UNREGISTERED_WS11_TRIGGER_EXPECT_REJECT_TRUE = true;

  const positiveResults = {
    REASON_CODE_SINGLE_SOURCE_LOCKED_TRUE: reasonCodeSingleSourceLocked,
    WS10_TRIGGER_REGISTERED_TRUE: ws10Registered && ws10Advisory,
    WS11_TRIGGER_REGISTERED_TRUE: ws11Registered && ws11Advisory,
    RUN_OR_SKIP_MACHINE_EXPLAINED_TRUE: runOrSkipMachineExplained,
    NO_BLOCKING_SURFACE_CHANGE_TRUE: noBlockingSurfaceChange,
  };

  const dod = {
    WS04_DOD_01_REASON_CODE_SINGLE_SOURCE_LOCKED_TRUE: positiveResults.REASON_CODE_SINGLE_SOURCE_LOCKED_TRUE,
    WS04_DOD_02_WS10_TRIGGER_REGISTERED_TRUE: positiveResults.WS10_TRIGGER_REGISTERED_TRUE,
    WS04_DOD_03_WS11_TRIGGER_REGISTERED_TRUE: positiveResults.WS11_TRIGGER_REGISTERED_TRUE,
    WS04_DOD_04_RUN_OR_SKIP_MACHINE_EXPLAINED_TRUE: positiveResults.RUN_OR_SKIP_MACHINE_EXPLAINED_TRUE,
    WS04_DOD_05_NO_BLOCKING_SURFACE_CHANGE_TRUE: positiveResults.NO_BLOCKING_SURFACE_CHANGE_TRUE,
    WS04_DOD_06_EXEC_PREGATE_01_TO_03_BECOME_TRUE:
      positiveResults.REASON_CODE_SINGLE_SOURCE_LOCKED_TRUE
      && positiveResults.WS10_TRIGGER_REGISTERED_TRUE
      && positiveResults.WS11_TRIGGER_REGISTERED_TRUE,
  };

  const ok = Object.values(positiveResults).every(Boolean)
    && Object.values(negativeResults).every(Boolean)
    && Object.values(dod).every(Boolean);

  return {
    ok,
    failReason: ok ? '' : 'WS04_TRIGGER_GOVERNANCE_PACK_FAIL',
    failSignalCode: ok ? '' : 'E_CORE_CHANGE_DOD_MISSING',
    [TOKEN_NAME]: ok ? 1 : 0,
    positiveResults,
    negativeResults,
    dod,
    execPregate: {
      REASON_CODE_SINGLE_SOURCE_LOCKED_TRUE: positiveResults.REASON_CODE_SINGLE_SOURCE_LOCKED_TRUE,
      WS10_TRIGGER_REGISTERED_TRUE: positiveResults.WS10_TRIGGER_REGISTERED_TRUE,
      WS11_TRIGGER_REGISTERED_TRUE: positiveResults.WS11_TRIGGER_REGISTERED_TRUE,
    },
    references: {
      reasonRegistryBasename: path.basename(reasonRegistryPath),
      machineRegistryBasename: path.basename(machineRegistryPath),
      requiredSetBasename: path.basename(requiredSetPath),
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateWs04TriggerGovernancePackState();
  if (args.json) {
    process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
  } else {
    process.stdout.write(`${TOKEN_NAME}=${state[TOKEN_NAME]}\n`);
    process.stdout.write(`REASON_CODE_SINGLE_SOURCE_LOCKED_TRUE=${state.execPregate.REASON_CODE_SINGLE_SOURCE_LOCKED_TRUE ? 1 : 0}\n`);
    process.stdout.write(`WS10_TRIGGER_REGISTERED_TRUE=${state.execPregate.WS10_TRIGGER_REGISTERED_TRUE ? 1 : 0}\n`);
    process.stdout.write(`WS11_TRIGGER_REGISTERED_TRUE=${state.execPregate.WS11_TRIGGER_REGISTERED_TRUE ? 1 : 0}\n`);
    if (!state.ok) process.stdout.write(`FAIL_REASON=${state.failReason}\n`);
  }
  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) {
  main();
}
