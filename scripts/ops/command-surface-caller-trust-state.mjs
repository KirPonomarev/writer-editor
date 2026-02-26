#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';

const TOKEN_NAME = 'COMMAND_SURFACE_CALLER_TRUST_PHASE_2_OK';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const COMMAND_BUS_ROUTE = 'command.bus';

const MANDATORY_BYPASS_SCENARIOS = Object.freeze([
  { scenarioId: 'hotkey-bypass', route: 'hotkey.direct', callerId: 'hotkey' },
  { scenarioId: 'palette-bypass', route: 'palette.direct', callerId: 'palette' },
  { scenarioId: 'ipc-direct-bypass', route: 'ipc.renderer-main.direct', callerId: 'ipc-main' },
  { scenarioId: 'context-button-bypass', route: 'context.button.direct', callerId: 'context-button' },
  { scenarioId: 'plugin-overlay-bypass', route: 'plugin.overlay.exec', callerId: 'plugin-overlay' },
]);

const TRUSTED_CALLERS = new Set(['hotkey', 'palette', 'ipc-main', 'context-button', 'plugin-overlay', 'menu']);

const ALIAS_TO_COMMAND_ID = Object.freeze({
  newDocument: 'cmd.project.new',
  openDocument: 'cmd.project.open',
  saveDocument: 'cmd.project.save',
  exportDocxMin: 'cmd.project.export.docxMin',
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
    }
  }

  return out;
}

function buildDefaultCaller(callerId = 'menu', identityProof = 'proof:menu:v1') {
  return {
    callerId,
    identityProof,
    channel: `channel:${callerId}`,
  };
}

function buildDefaultPayload(overrides = {}) {
  return {
    commandId: 'cmd.project.open',
    requestId: 'req-001',
    payloadSchemaVersion: 'v1',
    args: {},
    ...overrides,
  };
}

function makeCacheKey(callerIdentity, payload) {
  return [
    normalizeString(callerIdentity.callerId).toLowerCase(),
    normalizeString(payload.commandId).toLowerCase(),
    normalizeString(callerIdentity.identityProof),
    normalizeString(payload.payloadSchemaVersion),
  ].join('|');
}

function validateCallerIdentity(callerIdentity) {
  const caller = isObjectRecord(callerIdentity) ? callerIdentity : {};
  const callerId = normalizeString(caller.callerId).toLowerCase();
  const identityProof = normalizeString(caller.identityProof);
  const channel = normalizeString(caller.channel);

  if (!callerId || !identityProof || !channel) {
    return {
      ok: false,
      stopCode: 'E_CALLER_IDENTITY_VALIDATION_MISSING',
      reason: 'CALLER_IDENTITY_REQUIRED',
      callerId,
    };
  }

  if (!TRUSTED_CALLERS.has(callerId)) {
    return {
      ok: false,
      stopCode: 'E_CALLER_IDENTITY_VALIDATION_MISSING',
      reason: 'CALLER_IDENTITY_UNTRUSTED',
      callerId,
    };
  }

  return {
    ok: true,
    callerId,
    identityProof,
    channel,
  };
}

function resolveCommandId(aliasOrCommandId) {
  const value = normalizeString(aliasOrCommandId);
  if (!value) {
    return {
      ok: false,
      stopCode: 'E_PAYLOAD_CONTRACT_VALIDATION_MISSING',
      reason: 'COMMAND_ID_REQUIRED',
      commandId: '',
    };
  }

  if (value.startsWith('cmd.')) {
    return {
      ok: true,
      commandId: value,
      aliasUsed: false,
      alias: '',
    };
  }

  if (value.startsWith('dynamic:')) {
    return {
      ok: false,
      stopCode: 'E_ALIAS_INDIRECTION_BYPASS',
      reason: 'ALIAS_DYNAMIC_BYPASS',
      commandId: '',
      alias: value,
    };
  }

  const mapped = ALIAS_TO_COMMAND_ID[value];
  if (!mapped) {
    return {
      ok: false,
      stopCode: 'E_ALIAS_INDIRECTION_BYPASS',
      reason: 'ALIAS_NOT_ALLOWED',
      commandId: '',
      alias: value,
    };
  }

  return {
    ok: true,
    commandId: mapped,
    aliasUsed: true,
    alias: value,
  };
}

function validatePayloadContract(payloadInput = {}) {
  const payload = isObjectRecord(payloadInput) ? payloadInput : {};
  const requestId = normalizeString(payload.requestId);
  const payloadSchemaVersion = normalizeString(payload.payloadSchemaVersion);
  const argsOk = payload.args === undefined || isObjectRecord(payload.args);
  const resolved = resolveCommandId(payload.commandId);

  if (!resolved.ok) {
    return {
      ok: false,
      stopCode: resolved.stopCode,
      reason: resolved.reason,
      commandId: resolved.commandId,
      alias: resolved.alias || '',
      requestId,
      payloadSchemaVersion,
    };
  }

  if (!requestId || !payloadSchemaVersion || !argsOk) {
    return {
      ok: false,
      stopCode: 'E_PAYLOAD_CONTRACT_VALIDATION_MISSING',
      reason: !requestId
        ? 'REQUEST_ID_REQUIRED'
        : (!payloadSchemaVersion ? 'PAYLOAD_SCHEMA_VERSION_REQUIRED' : 'ARGS_OBJECT_REQUIRED'),
      commandId: resolved.commandId,
      alias: resolved.alias || '',
      requestId,
      payloadSchemaVersion,
    };
  }

  return {
    ok: true,
    commandId: resolved.commandId,
    aliasUsed: resolved.aliasUsed,
    alias: resolved.alias,
    requestId,
    payloadSchemaVersion,
  };
}

function createFastPathCache() {
  return new Map();
}

function evaluateCommandEntryAttempt(input = {}) {
  const route = normalizeString(input.route);
  const markerPresent = Boolean(input.markerPresent);
  const runtimeAssertion = Boolean(input.runtimeAssertion);
  const interactivePath = Boolean(input.interactivePath);

  if (!route || route !== COMMAND_BUS_ROUTE) {
    const scenarioId = MANDATORY_BYPASS_SCENARIOS.find((row) => row.route === route)?.scenarioId || '';
    return {
      ok: false,
      stopCode: 'COMMAND_SURFACE_BYPASS',
      reason: route ? 'COMMAND_ROUTE_BYPASS' : 'COMMAND_ROUTE_MISSING',
      scenarioId,
      route,
      cacheHit: false,
    };
  }

  if (markerPresent && !runtimeAssertion) {
    return {
      ok: false,
      stopCode: 'COMMAND_SURFACE_BYPASS',
      reason: 'MARKER_WITHOUT_RUNTIME_ASSERTION',
      scenarioId: '',
      route,
      cacheHit: false,
    };
  }

  const callerValidation = validateCallerIdentity(input.callerIdentity);
  if (!callerValidation.ok) {
    return {
      ok: false,
      stopCode: callerValidation.stopCode,
      reason: callerValidation.reason,
      scenarioId: '',
      route,
      cacheHit: false,
    };
  }

  const payloadValidation = validatePayloadContract(input.payload);
  if (!payloadValidation.ok) {
    return {
      ok: false,
      stopCode: payloadValidation.stopCode,
      reason: payloadValidation.reason,
      scenarioId: '',
      route,
      cacheHit: false,
    };
  }

  const cacheEnabled = Boolean(input.fastPathCacheEnabled);
  const cache = input.fastPathCache instanceof Map ? input.fastPathCache : createFastPathCache();
  const cacheKey = makeCacheKey(callerValidation, payloadValidation);

  if (cacheEnabled && !interactivePath && cache.has(cacheKey)) {
    return {
      ok: true,
      stopCode: '',
      reason: '',
      scenarioId: '',
      route,
      cacheHit: true,
      commandId: payloadValidation.commandId,
      aliasUsed: payloadValidation.aliasUsed,
      callerId: callerValidation.callerId,
    };
  }

  if (cacheEnabled && interactivePath && cache.has(cacheKey)) {
    return {
      ok: false,
      stopCode: 'E_FAST_PATH_CACHE_SAFETY_VIOLATION',
      reason: 'INTERACTIVE_CACHE_REUSE_FORBIDDEN',
      scenarioId: '',
      route,
      cacheHit: true,
    };
  }

  if (cacheEnabled) {
    cache.set(cacheKey, {
      commandId: payloadValidation.commandId,
      callerId: callerValidation.callerId,
      aliasUsed: payloadValidation.aliasUsed,
      payloadSchemaVersion: payloadValidation.payloadSchemaVersion,
      safeForInteractive: false,
    });
  }

  return {
    ok: true,
    stopCode: '',
    reason: '',
    scenarioId: '',
    route,
    cacheHit: false,
    commandId: payloadValidation.commandId,
    aliasUsed: payloadValidation.aliasUsed,
    callerId: callerValidation.callerId,
  };
}

function evaluateMandatoryBypassScenarios() {
  const cases = MANDATORY_BYPASS_SCENARIOS.map((scenario) => {
    const result = evaluateCommandEntryAttempt({
      route: scenario.route,
      callerIdentity: buildDefaultCaller(scenario.callerId, `proof:${scenario.callerId}:v1`),
      payload: buildDefaultPayload(),
      markerPresent: true,
      runtimeAssertion: true,
      fastPathCacheEnabled: true,
    });

    return {
      scenarioId: scenario.scenarioId,
      route: scenario.route,
      detected: result.ok === false
        && result.stopCode === 'COMMAND_SURFACE_BYPASS'
        && result.scenarioId === scenario.scenarioId,
      stopCode: result.stopCode,
      reason: result.reason,
      observedScenarioId: result.scenarioId,
    };
  });

  const ok = cases.length === MANDATORY_BYPASS_SCENARIOS.length && cases.every((entry) => entry.detected);
  return {
    ok,
    requiredScenarioCount: MANDATORY_BYPASS_SCENARIOS.length,
    passingScenarioCount: cases.filter((entry) => entry.detected).length,
    cases,
  };
}

function evaluateCallerIdentityValidationCases() {
  const positive = evaluateCommandEntryAttempt({
    route: COMMAND_BUS_ROUTE,
    callerIdentity: buildDefaultCaller('menu', 'proof:menu:v1'),
    payload: buildDefaultPayload(),
    markerPresent: true,
    runtimeAssertion: true,
    fastPathCacheEnabled: true,
  });

  const missingIdentity = evaluateCommandEntryAttempt({
    route: COMMAND_BUS_ROUTE,
    callerIdentity: { callerId: '', identityProof: '', channel: '' },
    payload: buildDefaultPayload(),
    markerPresent: true,
    runtimeAssertion: true,
    fastPathCacheEnabled: true,
  });

  const untrustedCaller = evaluateCommandEntryAttempt({
    route: COMMAND_BUS_ROUTE,
    callerIdentity: buildDefaultCaller('unknown-source', 'proof:unknown:v1'),
    payload: buildDefaultPayload(),
    markerPresent: true,
    runtimeAssertion: true,
    fastPathCacheEnabled: true,
  });

  const ok = positive.ok
    && missingIdentity.ok === false
    && missingIdentity.stopCode === 'E_CALLER_IDENTITY_VALIDATION_MISSING'
    && untrustedCaller.ok === false
    && untrustedCaller.stopCode === 'E_CALLER_IDENTITY_VALIDATION_MISSING';

  return {
    ok,
    positive,
    missingIdentity,
    untrustedCaller,
  };
}

function evaluatePayloadContractValidationCases() {
  const positive = evaluateCommandEntryAttempt({
    route: COMMAND_BUS_ROUTE,
    callerIdentity: buildDefaultCaller('menu', 'proof:menu:v1'),
    payload: buildDefaultPayload(),
    markerPresent: true,
    runtimeAssertion: true,
    fastPathCacheEnabled: true,
  });

  const missingRequestId = evaluateCommandEntryAttempt({
    route: COMMAND_BUS_ROUTE,
    callerIdentity: buildDefaultCaller('menu', 'proof:menu:v1'),
    payload: buildDefaultPayload({ requestId: '' }),
    markerPresent: true,
    runtimeAssertion: true,
    fastPathCacheEnabled: true,
  });

  const missingPayloadSchemaVersion = evaluateCommandEntryAttempt({
    route: COMMAND_BUS_ROUTE,
    callerIdentity: buildDefaultCaller('menu', 'proof:menu:v1'),
    payload: buildDefaultPayload({ payloadSchemaVersion: '' }),
    markerPresent: true,
    runtimeAssertion: true,
    fastPathCacheEnabled: true,
  });

  const ok = positive.ok
    && missingRequestId.ok === false
    && missingRequestId.stopCode === 'E_PAYLOAD_CONTRACT_VALIDATION_MISSING'
    && missingPayloadSchemaVersion.ok === false
    && missingPayloadSchemaVersion.stopCode === 'E_PAYLOAD_CONTRACT_VALIDATION_MISSING';

  return {
    ok,
    positive,
    missingRequestId,
    missingPayloadSchemaVersion,
  };
}

function evaluateAliasIndirectionNegativeCases() {
  const unknownAlias = evaluateCommandEntryAttempt({
    route: COMMAND_BUS_ROUTE,
    callerIdentity: buildDefaultCaller('menu', 'proof:menu:v1'),
    payload: buildDefaultPayload({ commandId: 'launchFromAnyRoute' }),
    markerPresent: true,
    runtimeAssertion: true,
    fastPathCacheEnabled: true,
  });

  const dynamicAlias = evaluateCommandEntryAttempt({
    route: COMMAND_BUS_ROUTE,
    callerIdentity: buildDefaultCaller('menu', 'proof:menu:v1'),
    payload: buildDefaultPayload({ commandId: 'dynamic:cmd.project.open' }),
    markerPresent: true,
    runtimeAssertion: true,
    fastPathCacheEnabled: true,
  });

  const ok = unknownAlias.ok === false
    && unknownAlias.stopCode === 'E_ALIAS_INDIRECTION_BYPASS'
    && dynamicAlias.ok === false
    && dynamicAlias.stopCode === 'E_ALIAS_INDIRECTION_BYPASS';

  return {
    ok,
    unknownAlias,
    dynamicAlias,
  };
}

function evaluateMarkerAssertionCase() {
  const markerWithoutRuntimeAssertion = evaluateCommandEntryAttempt({
    route: COMMAND_BUS_ROUTE,
    callerIdentity: buildDefaultCaller('menu', 'proof:menu:v1'),
    payload: buildDefaultPayload(),
    markerPresent: true,
    runtimeAssertion: false,
    fastPathCacheEnabled: true,
  });

  const ok = markerWithoutRuntimeAssertion.ok === false
    && markerWithoutRuntimeAssertion.stopCode === 'COMMAND_SURFACE_BYPASS';

  return {
    ok,
    markerWithoutRuntimeAssertion,
  };
}

function evaluateFastPathCacheSafety() {
  const cache = createFastPathCache();

  const first = evaluateCommandEntryAttempt({
    route: COMMAND_BUS_ROUTE,
    callerIdentity: buildDefaultCaller('menu', 'proof:menu:v1'),
    payload: buildDefaultPayload({ requestId: 'req-cache-1' }),
    markerPresent: true,
    runtimeAssertion: true,
    fastPathCacheEnabled: true,
    fastPathCache: cache,
    interactivePath: false,
  });

  const second = evaluateCommandEntryAttempt({
    route: COMMAND_BUS_ROUTE,
    callerIdentity: buildDefaultCaller('menu', 'proof:menu:v1'),
    payload: buildDefaultPayload({ requestId: 'req-cache-2' }),
    markerPresent: true,
    runtimeAssertion: true,
    fastPathCacheEnabled: true,
    fastPathCache: cache,
    interactivePath: false,
  });

  const interactiveReplay = evaluateCommandEntryAttempt({
    route: COMMAND_BUS_ROUTE,
    callerIdentity: buildDefaultCaller('menu', 'proof:menu:v1'),
    payload: buildDefaultPayload({ requestId: 'req-cache-3' }),
    markerPresent: true,
    runtimeAssertion: true,
    fastPathCacheEnabled: true,
    fastPathCache: cache,
    interactivePath: true,
  });

  const schemaVersionChanged = evaluateCommandEntryAttempt({
    route: COMMAND_BUS_ROUTE,
    callerIdentity: buildDefaultCaller('menu', 'proof:menu:v1'),
    payload: buildDefaultPayload({ requestId: 'req-cache-4', payloadSchemaVersion: 'v2' }),
    markerPresent: true,
    runtimeAssertion: true,
    fastPathCacheEnabled: true,
    fastPathCache: cache,
    interactivePath: false,
  });

  const ok = first.ok
    && second.ok
    && first.cacheHit === false
    && second.cacheHit === true
    && interactiveReplay.ok === false
    && interactiveReplay.stopCode === 'E_FAST_PATH_CACHE_SAFETY_VIOLATION'
    && schemaVersionChanged.ok
    && schemaVersionChanged.cacheHit === false;

  return {
    ok,
    first,
    second,
    interactiveReplay,
    schemaVersionChanged,
    cacheEntryCount: cache.size,
    cacheEnabled: true,
  };
}

function evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc) {
  const failSignals = Array.isArray(failsignalRegistryDoc?.failSignals)
    ? failsignalRegistryDoc.failSignals
    : [];

  const modePairs = [
    { mode: 'pr', key: 'prCore' },
    { mode: 'release', key: 'release' },
    { mode: 'promotion', key: 'promotion' },
  ];

  const driftCases = [];
  const issues = [];

  for (const row of failSignals) {
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

function evaluateSingleBlockingAuthority(repoRoot) {
  const verdict = evaluateModeMatrixVerdict({
    repoRoot,
    mode: 'pr',
    failSignalCode: 'E_REMOTE_UNAVAILABLE',
  });

  return {
    ok: verdict.ok && verdict.evaluatorId === CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    evaluatorIdObserved: verdict.evaluatorId,
    evaluatorIdExpected: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    issues: verdict.issues || [],
  };
}

function resolveFailReason(state) {
  if (!state.mandatoryBypassScenariosCheck) return 'COMMAND_SURFACE_BYPASS';
  if (!state.callerIdentityRequiredCheck) return 'E_CALLER_IDENTITY_VALIDATION_MISSING';
  if (!state.payloadContractRequiredCheck) return 'E_PAYLOAD_CONTRACT_VALIDATION_MISSING';
  if (!state.aliasIndirectionRuntimeNegativeCheck) return 'E_ALIAS_INDIRECTION_BYPASS';
  if (!state.markerPresenceWithoutRuntimeAssertionInvalidCheck) return 'COMMAND_SURFACE_BYPASS';
  if (!state.fastPathCacheRequiredCheck) return 'E_FAST_PATH_CACHE_SAFETY_VIOLATION';
  if (!state.advisoryToBlockingDriftCountZero) return 'ADVISORY_TO_BLOCKING_DRIFT';
  if (!state.singleBlockingAuthority.ok) return 'E_BLOCKING_EVALUATOR_NOT_CANONICAL';
  return 'COMMAND_SURFACE_CALLER_TRUST_PHASE_2_FAILED';
}

function evaluateCommandSurfaceCallerTrustPhase2State(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());

  const failsignalRegistryPath = path.resolve(
    repoRoot,
    normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
  );

  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);

  const bypassState = evaluateMandatoryBypassScenarios();
  const callerState = evaluateCallerIdentityValidationCases();
  const payloadState = evaluatePayloadContractValidationCases();
  const aliasState = evaluateAliasIndirectionNegativeCases();
  const markerState = evaluateMarkerAssertionCase();
  const cacheState = evaluateFastPathCacheSafety();

  const driftState = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc);
  const advisoryToBlockingDriftCount = driftState.advisoryToBlockingDriftCount;
  const advisoryToBlockingDriftCountZero = advisoryToBlockingDriftCount === 0;

  const singleBlockingAuthority = evaluateSingleBlockingAuthority(repoRoot);

  const issues = [
    ...driftState.issues,
    ...singleBlockingAuthority.issues,
  ];

  const mandatoryBypassScenariosCheck = bypassState.ok;
  const callerIdentityRequiredCheck = callerState.ok;
  const payloadContractRequiredCheck = payloadState.ok;
  const aliasIndirectionRuntimeNegativeCheck = aliasState.ok;
  const markerPresenceWithoutRuntimeAssertionInvalidCheck = markerState.ok;
  const fastPathCacheRequiredCheck = cacheState.ok;

  const ok = mandatoryBypassScenariosCheck
    && callerIdentityRequiredCheck
    && payloadContractRequiredCheck
    && aliasIndirectionRuntimeNegativeCheck
    && markerPresenceWithoutRuntimeAssertionInvalidCheck
    && fastPathCacheRequiredCheck
    && advisoryToBlockingDriftCountZero
    && singleBlockingAuthority.ok
    && issues.length === 0;

  const failReason = ok ? '' : resolveFailReason({
    mandatoryBypassScenariosCheck,
    callerIdentityRequiredCheck,
    payloadContractRequiredCheck,
    aliasIndirectionRuntimeNegativeCheck,
    markerPresenceWithoutRuntimeAssertionInvalidCheck,
    fastPathCacheRequiredCheck,
    advisoryToBlockingDriftCountZero,
    singleBlockingAuthority,
  });

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failReason,
    failSignalCode: failReason,

    mandatoryBypassScenariosCheck,
    callerIdentityRequiredCheck,
    payloadContractRequiredCheck,
    aliasIndirectionRuntimeNegativeCheck,
    markerPresenceWithoutRuntimeAssertionInvalidCheck,
    fastPathCacheRequiredCheck,

    mandatoryBypassScenarios: bypassState,
    callerIdentityValidationCases: callerState,
    payloadContractValidationCases: payloadState,
    aliasIndirectionNegativeCases: aliasState,
    markerAssertionCase: markerState,
    fastPathCacheSafetyProof: cacheState,

    advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero,
    driftCases: driftState.driftCases,

    singleBlockingAuthority,
    failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),
    issues,
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`P1_06_MANDATORY_BYPASS_SCENARIOS_CHECK=${state.mandatoryBypassScenariosCheck ? 1 : 0}`);
  console.log(`P1_06_CALLER_IDENTITY_REQUIRED_CHECK=${state.callerIdentityRequiredCheck ? 1 : 0}`);
  console.log(`P1_06_PAYLOAD_CONTRACT_REQUIRED_CHECK=${state.payloadContractRequiredCheck ? 1 : 0}`);
  console.log(`P1_06_ALIAS_INDIRECTION_RUNTIME_NEGATIVE_CHECK=${state.aliasIndirectionRuntimeNegativeCheck ? 1 : 0}`);
  console.log(`P1_06_MARKER_RUNTIME_ASSERTION_CHECK=${state.markerPresenceWithoutRuntimeAssertionInvalidCheck ? 1 : 0}`);
  console.log(`P1_06_FAST_PATH_CACHE_REQUIRED_CHECK=${state.fastPathCacheRequiredCheck ? 1 : 0}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.advisoryToBlockingDriftCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateCommandSurfaceCallerTrustPhase2State({
    repoRoot: process.cwd(),
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
  evaluateCommandSurfaceCallerTrustPhase2State,
  evaluateCommandEntryAttempt,
  evaluateFastPathCacheSafety,
  TOKEN_NAME,
  MANDATORY_BYPASS_SCENARIOS,
};
