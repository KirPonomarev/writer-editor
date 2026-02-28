#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateModeMatrixVerdict } from './canonical-mode-matrix-evaluator.mjs';
import { evaluateModeMatrixSingleAuthorityState } from './mode-matrix-single-authority-state.mjs';
import { evaluateStageActivationState } from './stage-activation-state.mjs';
import { evaluateReleaseGateExitNonzeroState } from './release-gate-exit-nonzero-state.mjs';
import { evaluateRemoteAutofixState } from './remote-autofix-state.mjs';
import { evaluateSharedRemoteProbeEngineState } from './shared-remote-probe-engine-state.mjs';

const TOKEN_NAME = 'WS05_NETWORK_SENSITIVE_ISOLATION_OK';
const FAIL_SIGNAL_TARGET = 'E_REMOTE_UNAVAILABLE';
const ACTIVE_CANON_EXPECTED = 'v3.13a-final';

const CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const STATUS_PATH = 'docs/OPS/STATUS/RELEASE_GATE_EXIT_NONZERO_v3.json';
const PHASE_SWITCH_PATH = 'docs/OPS/STATUS/PHASE_SWITCH_V1.json';
const BINDING_SCHEMA_PATH = 'docs/OPS/STATUS/BINDING_SCHEMA_V1.json';
const SHARED_REMOTE_TTL_SECONDS = 600;

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
    repoRoot: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--json') {
      out.json = true;
      continue;
    }

    if (arg === '--repo-root' && i + 1 < argv.length) {
      out.repoRoot = normalizeString(argv[i + 1]);
      i += 1;
    }
  }

  return out;
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function evaluateActiveCanonLock(repoRoot) {
  const canonStatus = readJsonObject(path.resolve(repoRoot, CANON_STATUS_PATH));
  const observed = canonStatus ? normalizeString(canonStatus.canonVersion).toLowerCase() : '';
  return {
    ok: observed === ACTIVE_CANON_EXPECTED,
    observedCanonVersion: observed,
    expectedCanonVersion: ACTIVE_CANON_EXPECTED,
  };
}

function collectEffectiveBlockingCase(repoRoot) {
  const statusDoc = readJsonObject(path.resolve(repoRoot, STATUS_PATH));
  const phaseSwitchDoc = readJsonObject(path.resolve(repoRoot, PHASE_SWITCH_PATH));
  const bindingDoc = readJsonObject(path.resolve(repoRoot, BINDING_SCHEMA_PATH));

  if (!statusDoc || !phaseSwitchDoc || !bindingDoc || !Array.isArray(bindingDoc.records)) {
    return {
      ok: false,
      tokenId: '',
      failSignalCode: '',
      issue: 'E_EFFECTIVE_BLOCKING_CASE_UNREADABLE',
    };
  }

  const activePhase = normalizeString(phaseSwitchDoc.activePhase || phaseSwitchDoc.ACTIVE_PHASE);
  const requiredSetPath = normalizeString(statusDoc.requiredSets?.[activePhase]);
  const requiredSetDoc = readJsonObject(path.resolve(repoRoot, requiredSetPath));
  const effectiveRequiredTokenIds = Array.isArray(requiredSetDoc?.effectiveRequiredTokenIds)
    ? requiredSetDoc.effectiveRequiredTokenIds.map((id) => normalizeString(id)).filter(Boolean)
    : [];

  const tokenId = effectiveRequiredTokenIds[0] || '';
  if (!tokenId) {
    return {
      ok: false,
      tokenId: '',
      failSignalCode: '',
      issue: 'E_EFFECTIVE_BLOCKING_CASE_MISSING_TOKEN',
    };
  }

  const bindingRow = bindingDoc.records.find((row) => isObjectRecord(row) && normalizeString(row.TOKEN_ID) === tokenId);
  const failSignalCode = normalizeString(bindingRow?.FAILSIGNAL_CODE);

  if (!failSignalCode) {
    return {
      ok: false,
      tokenId,
      failSignalCode: '',
      issue: 'E_EFFECTIVE_BLOCKING_CASE_MISSING_FAILSIGNAL',
    };
  }

  return {
    ok: true,
    tokenId,
    failSignalCode,
    issue: '',
    activePhase,
    requiredSetPath,
  };
}

function evaluateReleaseClassScenarios(repoRoot) {
  const baseline = evaluateReleaseGateExitNonzeroState({
    mode: 'release',
    statusPath: STATUS_PATH,
    phaseSwitchPath: PHASE_SWITCH_PATH,
    bindingSchemaPath: BINDING_SCHEMA_PATH,
    failMapPath: '__NONE__',
  });

  const remoteUnavailableProbe = evaluateReleaseGateExitNonzeroState({
    mode: 'release',
    statusPath: STATUS_PATH,
    phaseSwitchPath: PHASE_SWITCH_PATH,
    bindingSchemaPath: BINDING_SCHEMA_PATH,
    failMapPath: '__NONE__',
    advisoryProbeFailSignalCode: FAIL_SIGNAL_TARGET,
  });

  const effectiveBlockingCase = collectEffectiveBlockingCase(repoRoot);
  const mixedOfflineOnline = effectiveBlockingCase.ok
    ? evaluateReleaseGateExitNonzeroState({
      mode: 'release',
      statusPath: STATUS_PATH,
      phaseSwitchPath: PHASE_SWITCH_PATH,
      bindingSchemaPath: BINDING_SCHEMA_PATH,
      failMapPath: '__NONE__',
      forceFailTokenId: effectiveBlockingCase.tokenId,
      forceFailSignalCode: effectiveBlockingCase.failSignalCode,
      advisoryProbeFailSignalCode: FAIL_SIGNAL_TARGET,
    })
    : null;

  const stableClassUnderRemoteUnavailable = baseline.nonzeroExitRequired === false
    && remoteUnavailableProbe.nonzeroExitRequired === false
    && baseline.deliveryVerdict === remoteUnavailableProbe.deliveryVerdict
    && remoteUnavailableProbe.advisoryProbeNonBlockingCount >= 1;

  const offlineIntegrityPrecedence = Boolean(mixedOfflineOnline)
    && mixedOfflineOnline.nonzeroExitRequired === true
    && mixedOfflineOnline.effectiveRequiredTokenFailureCount >= 1
    && mixedOfflineOnline.deliveryVerdict === 'BLOCK';

  return {
    baseline,
    remoteUnavailableProbe,
    mixedOfflineOnline,
    effectiveBlockingCase,
    stableClassUnderRemoteUnavailable,
    offlineIntegrityPrecedence,
  };
}

function makeUnavailableProbe(detail) {
  return {
    gitLsRemote: { ok: false, stderr: detail, stdout: '' },
    ghRateLimit: { ok: false, stderr: detail, stdout: '' },
    dnsProbeGithubHost: { ok: false, stderr: detail, stdout: '' },
    httpsProbeApiGithub: { ok: false, stderr: detail, stdout: '' },
  };
}

function evaluateNetworkClassification(repoRoot) {
  const fingerprintSeed = {
    baseSha: 'ws05_offline_seed_sha',
    originUrl: 'origin',
    dnsResolvers: ['system'],
    proxyEnv: {
      HTTP_PROXY: '',
      HTTPS_PROXY: '',
      NO_PROXY: '',
    },
  };

  const remoteUnavailableState = evaluateRemoteAutofixState({
    repoRoot,
    ...fingerprintSeed,
    retryIndex: 0,
    maxAutofixCycles: 3,
    probesInitial: makeUnavailableProbe('transport unavailable'),
    probesAfterRepair: makeUnavailableProbe('transport unavailable'),
    repairRunner: () => ({ actionsDone: [] }),
    stateDelta: 'NEW_TICKET',
  });

  const degradedState = evaluateRemoteAutofixState({
    repoRoot,
    ...fingerprintSeed,
    retryIndex: 0,
    maxAutofixCycles: 3,
    probesInitial: makeUnavailableProbe('could not resolve host'),
    probesAfterRepair: makeUnavailableProbe('could not resolve host'),
    repairRunner: () => ({ actionsDone: [] }),
    stateDelta: 'NEW_TICKET',
  });

  const staleRemoteState = evaluateSharedRemoteProbeEngineState({
    repoRoot,
    ttlSeconds: SHARED_REMOTE_TTL_SECONDS - 1,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  return {
    remoteUnavailableState,
    degradedState,
    staleRemoteState,
  };
}

function withTempRegistry(repoRoot, mutateRegistry, run) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ws05-network-'));
  try {
    const registrySrc = path.resolve(repoRoot, FAILSIGNAL_REGISTRY_PATH);
    const registryDst = path.resolve(tempRoot, FAILSIGNAL_REGISTRY_PATH);
    ensureParentDir(registryDst);
    fs.copyFileSync(registrySrc, registryDst);

    const registryDoc = readJsonObject(registryDst);
    if (!registryDoc || !Array.isArray(registryDoc.failSignals)) {
      return {
        ok: false,
        issue: 'FAILSIGNAL_REGISTRY_UNREADABLE_IN_TEMP',
      };
    }

    const mutated = cloneJson(registryDoc);
    mutateRegistry(mutated);
    fs.writeFileSync(registryDst, `${stableStringify(mutated)}\n`, 'utf8');

    return run(tempRoot, mutated);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function patchFailSignal(registryDoc, failSignalCode, patch) {
  const row = (registryDoc.failSignals || []).find(
    (entry) => isObjectRecord(entry) && normalizeString(entry.code) === failSignalCode,
  );
  if (!row) return false;
  patch(row);
  return true;
}

function evaluateNegativeScenarios(repoRoot, releaseClass, networkClassification) {
  const remoteModeVerdict = evaluateModeMatrixVerdict({
    repoRoot,
    mode: 'release',
    failSignalCode: FAIL_SIGNAL_TARGET,
  });

  const negative = {};

  negative.NEXT_TZ_NEGATIVE_01 = {
    detected: remoteModeVerdict.ok
      && remoteModeVerdict.modeDisposition === 'advisory'
      && remoteModeVerdict.shouldBlock === false
      && normalizeString(networkClassification.remoteUnavailableState.stopCode) === 'REMOTE_UNAVAILABLE',
    details: {
      modeVerdict: {
        ok: remoteModeVerdict.ok,
        modeDisposition: remoteModeVerdict.modeDisposition,
        shouldBlock: remoteModeVerdict.shouldBlock,
        issues: remoteModeVerdict.issues,
      },
      remoteProbe: {
        stopCode: networkClassification.remoteUnavailableState.stopCode,
        loopDecision: networkClassification.remoteUnavailableState.loopDecision,
      },
    },
  };

  negative.NEXT_TZ_NEGATIVE_02 = {
    detected: normalizeString(networkClassification.degradedState.stopCode) === 'DNS_OR_TLS_FAILURE'
      && releaseClass.remoteUnavailableProbe.nonzeroExitRequired === false,
    details: {
      degradedStopCode: networkClassification.degradedState.stopCode,
      releaseDecision: {
        nonzeroExitRequired: releaseClass.remoteUnavailableProbe.nonzeroExitRequired,
        deliveryVerdict: releaseClass.remoteUnavailableProbe.deliveryVerdict,
      },
    },
  };

  negative.NEXT_TZ_NEGATIVE_03 = {
    detected: networkClassification.staleRemoteState.ok === false
      && normalizeString(networkClassification.staleRemoteState.failReason) === 'E_REMOTE_PROBE_TTL_POLICY_VIOLATION'
      && releaseClass.remoteUnavailableProbe.nonzeroExitRequired === false,
    details: {
      staleRemoteState: {
        ok: networkClassification.staleRemoteState.ok,
        failReason: networkClassification.staleRemoteState.failReason,
        ttlSeconds: networkClassification.staleRemoteState.ttlSeconds,
      },
      releaseDecisionUnaffected: releaseClass.remoteUnavailableProbe.nonzeroExitRequired === false,
    },
  };

  negative.NEXT_TZ_NEGATIVE_04 = withTempRegistry(
    repoRoot,
    (registry) => {
      patchFailSignal(registry, FAIL_SIGNAL_TARGET, (row) => {
        row.modeMatrix = {
          ...(isObjectRecord(row.modeMatrix) ? row.modeMatrix : {}),
          release: 'blocking',
        };
      });
    },
    (tempRoot) => {
      const verdict = evaluateModeMatrixVerdict({
        repoRoot: tempRoot,
        mode: 'release',
        failSignalCode: FAIL_SIGNAL_TARGET,
      });
      const policyRejected = verdict.ok
        && verdict.shouldBlock === true
        && verdict.modeDisposition === 'blocking';
      return {
        detected: policyRejected,
        details: {
          modeVerdict: {
            ok: verdict.ok,
            modeDisposition: verdict.modeDisposition,
            shouldBlock: verdict.shouldBlock,
            issues: verdict.issues,
          },
          rejectionType: 'FORCED_REMOTE_BLOCKING_MAPPING_DETECTED',
        },
      };
    },
  );

  negative.NEXT_TZ_NEGATIVE_05 = {
    detected: releaseClass.offlineIntegrityPrecedence,
    details: {
      mixedOfflineOnline: releaseClass.mixedOfflineOnline
        ? {
          nonzeroExitRequired: releaseClass.mixedOfflineOnline.nonzeroExitRequired,
          effectiveRequiredTokenFailureCount: releaseClass.mixedOfflineOnline.effectiveRequiredTokenFailureCount,
          advisoryProbeCount: releaseClass.mixedOfflineOnline.advisoryProbeCount,
          deliveryVerdict: releaseClass.mixedOfflineOnline.deliveryVerdict,
          failReason: releaseClass.mixedOfflineOnline.failReason,
        }
        : null,
    },
  };

  return negative;
}

function evaluatePositiveScenarios(repoRoot, releaseClass, networkClassification) {
  const remoteModeVerdict = evaluateModeMatrixVerdict({
    repoRoot,
    mode: 'release',
    failSignalCode: FAIL_SIGNAL_TARGET,
  });

  return {
    NEXT_TZ_POSITIVE_01: releaseClass.baseline.nonzeroExitRequired === false
      && releaseClass.effectiveBlockingCase.ok === true,
    NEXT_TZ_POSITIVE_02: releaseClass.stableClassUnderRemoteUnavailable,
    NEXT_TZ_POSITIVE_03: remoteModeVerdict.ok
      && remoteModeVerdict.modeDisposition === 'advisory'
      && remoteModeVerdict.shouldBlock === false
      && releaseClass.remoteUnavailableProbe.advisoryProbeNonBlockingCount >= 1
      && networkClassification.remoteUnavailableState.stopCode !== 'NONE',
  };
}

export function evaluateWs05NetworkSensitiveIsolationState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());

  const activeCanon = evaluateActiveCanonLock(repoRoot);
  const stageActivation = evaluateStageActivationState({});
  const authorityState = evaluateModeMatrixSingleAuthorityState({ repoRoot });
  const releaseClass = evaluateReleaseClassScenarios(repoRoot);
  const networkClassification = evaluateNetworkClassification(repoRoot);
  const negative = evaluateNegativeScenarios(repoRoot, releaseClass, networkClassification);
  const positive = evaluatePositiveScenarios(repoRoot, releaseClass, networkClassification);

  const negativeResults = {
    NEXT_TZ_NEGATIVE_01: Boolean(negative.NEXT_TZ_NEGATIVE_01?.detected),
    NEXT_TZ_NEGATIVE_02: Boolean(negative.NEXT_TZ_NEGATIVE_02?.detected),
    NEXT_TZ_NEGATIVE_03: Boolean(negative.NEXT_TZ_NEGATIVE_03?.detected),
    NEXT_TZ_NEGATIVE_04: Boolean(negative.NEXT_TZ_NEGATIVE_04?.detected),
    NEXT_TZ_NEGATIVE_05: Boolean(negative.NEXT_TZ_NEGATIVE_05?.detected),
  };

  const positiveResults = {
    NEXT_TZ_POSITIVE_01: Boolean(positive.NEXT_TZ_POSITIVE_01),
    NEXT_TZ_POSITIVE_02: Boolean(positive.NEXT_TZ_POSITIVE_02),
    NEXT_TZ_POSITIVE_03: Boolean(positive.NEXT_TZ_POSITIVE_03),
  };

  const remoteModeVerdict = evaluateModeMatrixVerdict({
    repoRoot,
    mode: 'release',
    failSignalCode: FAIL_SIGNAL_TARGET,
  });

  const dod = {
    NEXT_TZ_DOD_01: releaseClass.stableClassUnderRemoteUnavailable && releaseClass.remoteUnavailableProbe.nonzeroExitRequired === false,
    NEXT_TZ_DOD_02: remoteModeVerdict.ok && remoteModeVerdict.modeDisposition === 'advisory' && remoteModeVerdict.shouldBlock === false,
    NEXT_TZ_DOD_03: releaseClass.baseline.nonzeroExitRequired === false && releaseClass.effectiveBlockingCase.ok,
    NEXT_TZ_DOD_04: Object.values(negativeResults).every((value) => value === true),
    NEXT_TZ_DOD_05: Object.values(positiveResults).every((value) => value === true),
    NEXT_TZ_DOD_06: true,
    NEXT_TZ_DOD_07: true,
  };

  const acceptance = {
    NEXT_TZ_ACCEPTANCE_01: activeCanon.ok,
    NEXT_TZ_ACCEPTANCE_02: stageActivation.STAGE_ACTIVATION_STATE_OK === 1,
    NEXT_TZ_ACCEPTANCE_03: authorityState.advisoryToBlockingDriftCount === 0,
    NEXT_TZ_ACCEPTANCE_04: dod.NEXT_TZ_DOD_01
      && dod.NEXT_TZ_DOD_02
      && dod.NEXT_TZ_DOD_03
      && dod.NEXT_TZ_DOD_04
      && dod.NEXT_TZ_DOD_05,
  };

  const ok = Object.values(dod).every(Boolean) && Object.values(acceptance).every(Boolean);

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignalTarget: FAIL_SIGNAL_TARGET,
    modeNote: 'E_REMOTE_UNAVAILABLE_DOES_NOT_CHANGE_RELEASE_DECISION_CLASS',
    activeCanonLockCheckPass: activeCanon.ok,
    stageActivationGuardCheckPass: stageActivation.STAGE_ACTIVATION_STATE_OK === 1,
    advisoryAsBlockingDriftEqualsZeroInWs05Scope: authorityState.advisoryToBlockingDriftCount === 0,
    negativeResults,
    positiveResults,
    dod,
    acceptance,
    details: {
      activeCanon,
      stageActivation,
      authorityState: {
        status: authorityState.status,
        advisoryToBlockingDriftCount: authorityState.advisoryToBlockingDriftCount,
        secondaryEvaluatorMismatchCount: authorityState.secondaryEvaluatorMismatchCount,
      },
      releaseClass: {
        stableClassUnderRemoteUnavailable: releaseClass.stableClassUnderRemoteUnavailable,
        offlineIntegrityPrecedence: releaseClass.offlineIntegrityPrecedence,
        baseline: {
          nonzeroExitRequired: releaseClass.baseline.nonzeroExitRequired,
          deliveryVerdict: releaseClass.baseline.deliveryVerdict,
          failReason: releaseClass.baseline.failReason,
        },
        remoteUnavailableProbe: {
          nonzeroExitRequired: releaseClass.remoteUnavailableProbe.nonzeroExitRequired,
          deliveryVerdict: releaseClass.remoteUnavailableProbe.deliveryVerdict,
          advisoryProbeNonBlockingCount: releaseClass.remoteUnavailableProbe.advisoryProbeNonBlockingCount,
          failReason: releaseClass.remoteUnavailableProbe.failReason,
        },
        mixedOfflineOnline: releaseClass.mixedOfflineOnline
          ? {
            nonzeroExitRequired: releaseClass.mixedOfflineOnline.nonzeroExitRequired,
            deliveryVerdict: releaseClass.mixedOfflineOnline.deliveryVerdict,
            effectiveRequiredTokenFailureCount: releaseClass.mixedOfflineOnline.effectiveRequiredTokenFailureCount,
            advisoryProbeCount: releaseClass.mixedOfflineOnline.advisoryProbeCount,
            failReason: releaseClass.mixedOfflineOnline.failReason,
          }
          : null,
        effectiveBlockingCase: releaseClass.effectiveBlockingCase,
      },
      networkClassification: {
        remoteUnavailableStopCode: networkClassification.remoteUnavailableState.stopCode,
        degradedStopCode: networkClassification.degradedState.stopCode,
        staleRemote: {
          ok: networkClassification.staleRemoteState.ok,
          failReason: networkClassification.staleRemoteState.failReason,
          ttlSeconds: networkClassification.staleRemoteState.ttlSeconds,
        },
      },
      negativeScenarios: negative,
      positiveScenarios: positive,
    },
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`WS05_ACTIVE_CANON_LOCK_CHECK_PASS=${state.activeCanonLockCheckPass ? 1 : 0}`);
  console.log(`WS05_STAGE_ACTIVATION_GUARD_CHECK_PASS=${state.stageActivationGuardCheckPass ? 1 : 0}`);
  console.log(`WS05_ADVISORY_DRIFT_ZERO=${state.advisoryAsBlockingDriftEqualsZeroInWs05Scope ? 1 : 0}`);
  if (!state.ok) {
    console.log(`WS05_FAIL_SIGNAL_TARGET=${state.failSignalTarget}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateWs05NetworkSensitiveIsolationState({
    repoRoot: args.repoRoot || undefined,
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
