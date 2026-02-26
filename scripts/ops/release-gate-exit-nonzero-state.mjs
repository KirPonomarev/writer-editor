#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateModeMatrixVerdict } from './canonical-mode-matrix-evaluator.mjs';

const TOKEN_NAME = 'RELEASE_GATE_EXIT_NONZERO_OK';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/RELEASE_GATE_EXIT_NONZERO_v3.json';
const DEFAULT_PHASE_SWITCH_PATH = 'docs/OPS/STATUS/PHASE_SWITCH_V1.json';
const DEFAULT_BINDING_SCHEMA_PATH = 'docs/OPS/STATUS/BINDING_SCHEMA_V1.json';
const ALLOWED_PHASES = new Set(['PHASE_1_SHADOW', 'PHASE_2_WARN', 'PHASE_3_HARD']);
const ALLOWED_MODES = new Set(['pr', 'release', 'promotion']);

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  const normalized = normalizeString(value).toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
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

function uniqueSortedStrings(values) {
  if (!Array.isArray(values)) return [];
  const unique = new Set();
  for (const value of values) {
    const normalized = normalizeString(value);
    if (normalized) unique.add(normalized);
  }
  return [...unique].sort((a, b) => a.localeCompare(b));
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    mode: '',
    statusPath: '',
    phaseSwitchPath: '',
    bindingSchemaPath: '',
    failMapPath: '',
    suppressFailures: false,
    forceFailTokenId: '',
    forceFailSignalCode: '',
    advisoryProbeFailSignalCode: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--json') {
      out.json = true;
      continue;
    }

    if (arg === '--mode' && i + 1 < argv.length) {
      out.mode = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--mode=')) {
      out.mode = normalizeString(arg.slice('--mode='.length));
      continue;
    }

    if (arg === '--status-path' && i + 1 < argv.length) {
      out.statusPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--status-path=')) {
      out.statusPath = normalizeString(arg.slice('--status-path='.length));
      continue;
    }

    if (arg === '--phase-switch-path' && i + 1 < argv.length) {
      out.phaseSwitchPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--phase-switch-path=')) {
      out.phaseSwitchPath = normalizeString(arg.slice('--phase-switch-path='.length));
      continue;
    }

    if (arg === '--binding-schema-path' && i + 1 < argv.length) {
      out.bindingSchemaPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--binding-schema-path=')) {
      out.bindingSchemaPath = normalizeString(arg.slice('--binding-schema-path='.length));
      continue;
    }

    if (arg === '--fail-map-path' && i + 1 < argv.length) {
      out.failMapPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--fail-map-path=')) {
      out.failMapPath = normalizeString(arg.slice('--fail-map-path='.length));
      continue;
    }

    if (arg === '--force-fail-token-id' && i + 1 < argv.length) {
      out.forceFailTokenId = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--force-fail-token-id=')) {
      out.forceFailTokenId = normalizeString(arg.slice('--force-fail-token-id='.length));
      continue;
    }

    if (arg === '--force-fail-signal-code' && i + 1 < argv.length) {
      out.forceFailSignalCode = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--force-fail-signal-code=')) {
      out.forceFailSignalCode = normalizeString(arg.slice('--force-fail-signal-code='.length));
      continue;
    }

    if (arg === '--advisory-probe-fail-signal-code' && i + 1 < argv.length) {
      out.advisoryProbeFailSignalCode = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--advisory-probe-fail-signal-code=')) {
      out.advisoryProbeFailSignalCode = normalizeString(arg.slice('--advisory-probe-fail-signal-code='.length));
      continue;
    }

    if (arg === '--suppress-failures') {
      out.suppressFailures = true;
      continue;
    }
    if (arg.startsWith('--suppress-failures=')) {
      out.suppressFailures = parseBoolean(arg.slice('--suppress-failures='.length));
    }
  }

  return out;
}

function buildState(base = {}) {
  return {
    ok: false,
    [TOKEN_NAME]: 0,
    mode: 'release',
    statusPath: '',
    phaseSwitchPath: '',
    bindingSchemaPath: '',
    failMapPath: '',
    activePhase: '',
    phaseEnforcementMode: '',
    phaseShouldBlock: false,
    requiredSetPath: '',
    effectiveRequiredTokenIds: [],
    effectiveRequiredTokenCount: 0,
    tokenFailureCount: 0,
    effectiveRequiredTokenFailureCount: 0,
    externalTokenFailureCount: 0,
    advisoryProbeCount: 0,
    advisoryProbeNonBlockingCount: 0,
    failReason: 'E_RELEASE_GATE_EXIT_SEMANTICS',
    stopCode: 'E_RELEASE_GATE_EXIT_SEMANTICS',
    nonzeroExitRequired: true,
    releaseModeFailPropagationOk: false,
    noDefaultZeroExitOnFail: false,
    productVerdict: 'FAIL',
    deliveryVerdict: 'BLOCK',
    suppressFailuresRequested: false,
    suppressionPrevented: false,
    tokenFailures: [],
    ...base,
  };
}

function resolveDeliveryVerdict(blocking, mode) {
  if (!blocking) return 'PASS';
  if (mode === 'release' || mode === 'promotion') return 'BLOCK';
  return 'WARN';
}

export function evaluateReleaseGateExitNonzeroState(input = {}) {
  const modeRaw = normalizeString(input.mode || process.env.MODE || 'release').toLowerCase();
  const mode = ALLOWED_MODES.has(modeRaw) ? modeRaw : 'release';

  const statusPath = normalizeString(input.statusPath || process.env.RELEASE_GATE_EXIT_NONZERO_STATUS_PATH || DEFAULT_STATUS_PATH);
  const phaseSwitchPath = normalizeString(input.phaseSwitchPath || process.env.PHASE_SWITCH_V1_PATH || DEFAULT_PHASE_SWITCH_PATH);
  const bindingSchemaPath = normalizeString(input.bindingSchemaPath || process.env.BINDING_SCHEMA_V1_PATH || DEFAULT_BINDING_SCHEMA_PATH);
  const suppressFailuresRequested = parseBoolean(input.suppressFailures ?? process.env.RELEASE_GATE_SUPPRESS_FAILURES);

  const statusDoc = readJsonObject(statusPath);
  if (!statusDoc) {
    return buildState({
      mode,
      statusPath,
      phaseSwitchPath,
      bindingSchemaPath,
      failReason: 'E_RELEASE_GATE_STATUS_UNREADABLE',
      stopCode: 'E_RELEASE_GATE_EXIT_SEMANTICS',
      suppressFailuresRequested,
    });
  }

  const phaseSwitchDoc = readJsonObject(phaseSwitchPath);
  if (!phaseSwitchDoc) {
    return buildState({
      mode,
      statusPath,
      phaseSwitchPath,
      bindingSchemaPath,
      failReason: 'E_PHASE_SWITCH_INVALID',
      stopCode: 'E_PHASE_SWITCH_INVALID',
      suppressFailuresRequested,
    });
  }

  const activePhase = normalizeString(phaseSwitchDoc.activePhase || phaseSwitchDoc.ACTIVE_PHASE);
  if (!ALLOWED_PHASES.has(activePhase)) {
    return buildState({
      mode,
      statusPath,
      phaseSwitchPath,
      bindingSchemaPath,
      activePhase,
      failReason: 'E_PHASE_SWITCH_INVALID',
      stopCode: 'E_PHASE_SWITCH_INVALID',
      suppressFailuresRequested,
    });
  }

  const phaseRule = isObjectRecord(phaseSwitchDoc.phasePrecedence)
    ? phaseSwitchDoc.phasePrecedence[activePhase]
    : null;
  const phaseEnforcementMode = normalizeString(phaseRule?.newV1Enforcement || '');
  const phaseShouldBlock = Boolean(phaseRule?.shouldBlock);

  const requiredSetMap = isObjectRecord(statusDoc.requiredSets) ? statusDoc.requiredSets : {};
  const requiredSetPath = normalizeString(requiredSetMap[activePhase]);
  const requiredSetDoc = readJsonObject(requiredSetPath);
  if (!requiredSetDoc || !Array.isArray(requiredSetDoc.effectiveRequiredTokenIds)) {
    return buildState({
      mode,
      statusPath,
      phaseSwitchPath,
      bindingSchemaPath,
      activePhase,
      phaseEnforcementMode,
      phaseShouldBlock,
      requiredSetPath,
      failReason: 'E_REQUIRED_SET_PHASE_INVALID',
      stopCode: 'E_REQUIRED_SET_PHASE_INVALID',
      suppressFailuresRequested,
    });
  }

  const effectiveRequiredTokenIds = uniqueSortedStrings(requiredSetDoc.effectiveRequiredTokenIds);
  const effectiveRequiredSet = new Set(effectiveRequiredTokenIds);

  const bindingSchemaDoc = readJsonObject(bindingSchemaPath);
  if (!bindingSchemaDoc || !Array.isArray(bindingSchemaDoc.records)) {
    return buildState({
      mode,
      statusPath,
      phaseSwitchPath,
      bindingSchemaPath,
      activePhase,
      phaseEnforcementMode,
      phaseShouldBlock,
      requiredSetPath,
      effectiveRequiredTokenIds,
      effectiveRequiredTokenCount: effectiveRequiredTokenIds.length,
      failReason: 'BINDING_SCHEMA_INVALID',
      stopCode: 'E_RELEASE_GATE_EXIT_SEMANTICS',
      suppressFailuresRequested,
    });
  }

  const failSignalByTokenId = new Map();
  for (const row of bindingSchemaDoc.records) {
    if (!isObjectRecord(row)) continue;
    const tokenId = normalizeString(row.TOKEN_ID);
    const failSignalCode = normalizeString(row.FAILSIGNAL_CODE);
    if (!tokenId || !failSignalCode) continue;
    failSignalByTokenId.set(tokenId, failSignalCode);
  }

  const failMapPath = normalizeString(
    input.failMapPath
      || process.env.RELEASE_GATE_FAIL_MAP_PATH
      || statusDoc.effectiveFailMapRef,
  );

  const failMapDoc = readJsonObject(failMapPath);
  const failCases = Array.isArray(failMapDoc?.cases) ? failMapDoc.cases : [];

  const tokenFailures = [];
  for (const row of failCases) {
    if (!isObjectRecord(row)) continue;
    const tokenId = normalizeString(row.tokenId);
    const failed = row.failed === true;
    if (!tokenId || !failed) continue;

    const failSignalCode = normalizeString(row.failSignalCode) || failSignalByTokenId.get(tokenId) || '';
    const isEffectiveRequiredToken = effectiveRequiredSet.has(tokenId);
    const advisoryProbe = row.advisoryProbe === true;

    const evaluator = failSignalCode
      ? evaluateModeMatrixVerdict({
        repoRoot: process.cwd(),
        mode,
        failSignalCode,
      })
      : {
        ok: false,
        modeDisposition: 'blocking',
        shouldBlock: true,
        issues: [{ code: 'FAILSIGNAL_CODE_MISSING' }],
      };

    tokenFailures.push({
      tokenId,
      failSignalCode,
      isEffectiveRequiredToken,
      advisoryProbe,
      modeDisposition: evaluator.modeDisposition,
      canonicalShouldBlock: evaluator.shouldBlock === true,
      evaluatorOk: evaluator.ok === true,
      evaluatorIssues: evaluator.issues || [],
    });
  }

  const forceFailTokenId = normalizeString(input.forceFailTokenId || process.env.RELEASE_GATE_FORCE_FAIL_TOKEN_ID);
  if (forceFailTokenId) {
    const failSignalCode = normalizeString(input.forceFailSignalCode || process.env.RELEASE_GATE_FORCE_FAIL_SIGNAL_CODE)
      || failSignalByTokenId.get(forceFailTokenId)
      || '';
    const advisoryProbe = false;
    const isEffectiveRequiredToken = effectiveRequiredSet.has(forceFailTokenId);
    const evaluator = failSignalCode
      ? evaluateModeMatrixVerdict({ repoRoot: process.cwd(), mode, failSignalCode })
      : { ok: false, modeDisposition: 'blocking', shouldBlock: true, issues: [{ code: 'FAILSIGNAL_CODE_MISSING' }] };

    tokenFailures.push({
      tokenId: forceFailTokenId,
      failSignalCode,
      isEffectiveRequiredToken,
      advisoryProbe,
      modeDisposition: evaluator.modeDisposition,
      canonicalShouldBlock: evaluator.shouldBlock === true,
      evaluatorOk: evaluator.ok === true,
      evaluatorIssues: evaluator.issues || [],
    });
  }

  const advisoryProbeFailSignalCode = normalizeString(input.advisoryProbeFailSignalCode || process.env.RELEASE_GATE_ADVISORY_PROBE_FAIL_SIGNAL_CODE);
  if (advisoryProbeFailSignalCode) {
    const evaluator = evaluateModeMatrixVerdict({ repoRoot: process.cwd(), mode, failSignalCode: advisoryProbeFailSignalCode });
    tokenFailures.push({
      tokenId: '__ADVISORY_PROBE__',
      failSignalCode: advisoryProbeFailSignalCode,
      isEffectiveRequiredToken: false,
      advisoryProbe: true,
      modeDisposition: evaluator.modeDisposition,
      canonicalShouldBlock: evaluator.shouldBlock === true,
      evaluatorOk: evaluator.ok === true,
      evaluatorIssues: evaluator.issues || [],
    });
  }

  const effectiveRequiredTokenFailures = tokenFailures.filter((entry) => entry.isEffectiveRequiredToken);
  const externalTokenFailures = tokenFailures.filter((entry) => !entry.isEffectiveRequiredToken);
  const advisoryProbes = tokenFailures.filter((entry) => entry.advisoryProbe);

  const effectiveRequiredTokenFailureCount = effectiveRequiredTokenFailures.length;
  const blockingFromEffectiveRequired = effectiveRequiredTokenFailureCount > 0 && (mode === 'release' || mode === 'promotion');
  const blockingFromCanonical = externalTokenFailures.some((entry) => entry.canonicalShouldBlock === true);

  let blocking = blockingFromEffectiveRequired || blockingFromCanonical;
  let failReason = '';
  let stopCode = '';

  const exitSemanticsStopCode = normalizeString(statusDoc.exitSemanticsStopCode) || 'E_RELEASE_GATE_EXIT_SEMANTICS';
  const defaultZeroExitStopCode = normalizeString(statusDoc.defaultZeroExitStopCode) || 'E_DEFAULT_ZERO_EXIT_ON_FAIL';
  const failPropagationStopCode = normalizeString(statusDoc.failPropagationStopCode) || 'E_FAIL_PROPAGATION_BROKEN';

  if (blockingFromEffectiveRequired) {
    failReason = exitSemanticsStopCode;
    stopCode = exitSemanticsStopCode;
  } else if (blockingFromCanonical) {
    failReason = failPropagationStopCode;
    stopCode = failPropagationStopCode;
  }

  let suppressionPrevented = false;
  if (suppressFailuresRequested && blocking === true) {
    suppressionPrevented = true;
    failReason = defaultZeroExitStopCode;
    stopCode = defaultZeroExitStopCode;
    blocking = true;
  }

  const nonzeroExitRequired = blocking === true;
  const noDefaultZeroExitOnFail = blocking === true ? (suppressFailuresRequested ? suppressionPrevented : true) : true;
  const releaseModeFailPropagationOk = (mode === 'release' || mode === 'promotion')
    ? (effectiveRequiredTokenFailureCount === 0 || nonzeroExitRequired === true)
    : true;

  const advisoryProbeNonBlockingCount = advisoryProbes.filter((entry) => entry.modeDisposition === 'advisory' && entry.canonicalShouldBlock === false).length;

  return buildState({
    ok: nonzeroExitRequired === false,
    [TOKEN_NAME]: nonzeroExitRequired ? 0 : 1,
    mode,
    statusPath,
    phaseSwitchPath,
    bindingSchemaPath,
    failMapPath,
    activePhase,
    phaseEnforcementMode,
    phaseShouldBlock,
    requiredSetPath,
    effectiveRequiredTokenIds,
    effectiveRequiredTokenCount: effectiveRequiredTokenIds.length,
    tokenFailureCount: tokenFailures.length,
    effectiveRequiredTokenFailureCount,
    externalTokenFailureCount: externalTokenFailures.length,
    advisoryProbeCount: advisoryProbes.length,
    advisoryProbeNonBlockingCount,
    failReason,
    stopCode,
    nonzeroExitRequired,
    releaseModeFailPropagationOk,
    noDefaultZeroExitOnFail,
    productVerdict: blocking ? 'FAIL' : 'PASS',
    deliveryVerdict: resolveDeliveryVerdict(blocking, mode),
    suppressFailuresRequested,
    suppressionPrevented,
    tokenFailures,
  });
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`RELEASE_GATE_NONZERO_EXIT_REQUIRED=${state.nonzeroExitRequired ? 1 : 0}`);
  console.log(`RELEASE_GATE_EFFECTIVE_TOKEN_FAILURE_COUNT=${state.effectiveRequiredTokenFailureCount}`);
  console.log(`RELEASE_GATE_EXTERNAL_TOKEN_FAILURE_COUNT=${state.externalTokenFailureCount}`);
  console.log(`RELEASE_GATE_ADVISORY_PROBE_NON_BLOCKING_COUNT=${state.advisoryProbeNonBlockingCount}`);
  console.log(`PRODUCT_VERDICT=${state.productVerdict}`);
  console.log(`DELIVERY_VERDICT=${state.deliveryVerdict}`);
  if (state.nonzeroExitRequired) {
    console.log(`FAIL_REASON=${state.failReason}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateReleaseGateExitNonzeroState({
    mode: args.mode,
    statusPath: args.statusPath,
    phaseSwitchPath: args.phaseSwitchPath,
    bindingSchemaPath: args.bindingSchemaPath,
    failMapPath: args.failMapPath,
    suppressFailures: args.suppressFailures,
    forceFailTokenId: args.forceFailTokenId,
    forceFailSignalCode: args.forceFailSignalCode,
    advisoryProbeFailSignalCode: args.advisoryProbeFailSignalCode,
  });

  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
  } else {
    printHuman(state);
  }

  process.exit(state.nonzeroExitRequired ? 1 : 0);
}

const currentFilePath = fileURLToPath(import.meta.url);
if (
  process.argv[1]
  && fs.existsSync(process.argv[1])
  && fs.existsSync(currentFilePath)
  && fs.realpathSync(process.argv[1]) === fs.realpathSync(currentFilePath)
) {
  main();
}
