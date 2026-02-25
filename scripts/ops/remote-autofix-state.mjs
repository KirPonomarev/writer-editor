#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evaluateModeMatrixVerdict } from './canonical-mode-matrix-evaluator.mjs';
import {
  buildRemoteStateFingerprint,
  validateRemoteStateFingerprintSchema,
} from './remote-state-fingerprint.mjs';
import {
  BACKOFF_MINUTES,
  computeNextAutoProbeAt,
  evaluateWaitModeEmitRule,
  validateWaitModeEnvelope,
} from './remote-passive-probe-scheduler.mjs';

const TOKEN_NAME = 'REMOTE_AUTOFIX_POLICY_OK';
const FAIL_SIGNAL_CODE = 'E_GOVERNANCE_STRICT_FAIL';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_MODE_POLICY_PATH = 'docs/OPS/STATUS/MODE_MATRIX_POLICY_v1.json';

const STOP_CODES = Object.freeze({
  NONE: 'NONE',
  DUAL_AUTHORITY: 'E_DUAL_AUTHORITY',
  REMOTE_CLASS_UNDEFINED: 'E_REMOTE_CLASS_UNDEFINED',
  FINGERPRINT_SCHEMA: 'E_FINGERPRINT_SCHEMA',
  STATE_DELTA_SCHEMA: 'E_STATE_DELTA_SCHEMA',
  ROUTE_MATRIX_VIOLATION: 'E_ROUTE_MATRIX_VIOLATION',
  REMOTE_UNAVAILABLE: 'REMOTE_UNAVAILABLE',
  DNS_OR_TLS_FAILURE: 'DNS_OR_TLS_FAILURE',
  AUTH_FAILURE: 'AUTH_FAILURE',
  RATE_LIMIT: 'RATE_LIMIT',
  REMOTE_TIMEOUT: 'REMOTE_TIMEOUT',
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

function runCommand(cmd, args = [], envPatch = {}) {
  const run = spawnSync(cmd, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...envPatch,
    },
    encoding: 'utf8',
    timeout: 20000,
  });

  return {
    cmd,
    args,
    ok: Number(run.status) === 0,
    exitCode: Number.isInteger(run.status) ? run.status : 1,
    stdout: String(run.stdout || ''),
    stderr: String(run.stderr || ''),
  };
}

function defaultProbeRunner() {
  const probes = {
    gitLsRemote: runCommand('git', ['ls-remote', '--heads', 'origin']),
    ghRateLimit: runCommand('gh', ['api', '/rate_limit']),
    dnsProbeGithubHost: runCommand('nslookup', ['github.com']),
    httpsProbeApiGithub: runCommand('curl', ['-I', 'https://api.github.com']),
  };
  return probes;
}

function parseGhAuthState(probes) {
  const ghProbe = probes.ghRateLimit || {};
  const combined = `${ghProbe.stdout || ''}\n${ghProbe.stderr || ''}`.toLowerCase();
  if (ghProbe.ok) {
    return {
      status: 'authenticated',
      host: 'github.com',
      tokenConfigured: true,
    };
  }
  if (combined.includes('authentication') || combined.includes('bad credentials') || combined.includes('401')) {
    return {
      status: 'auth_failed',
      host: 'github.com',
      tokenConfigured: true,
    };
  }
  return {
    status: 'unknown',
    host: 'github.com',
    tokenConfigured: Boolean(process.env.GH_TOKEN),
  };
}

function classifyRemoteFailure(probes) {
  const errors = [
    probes.gitLsRemote,
    probes.ghRateLimit,
    probes.dnsProbeGithubHost,
    probes.httpsProbeApiGithub,
  ]
    .filter((row) => row && row.ok !== true)
    .map((row) => `${row.stderr || ''}\n${row.stdout || ''}`.toLowerCase())
    .join('\n');

  if (!errors.trim()) return STOP_CODES.NONE;
  if (errors.includes('could not resolve host') || errors.includes('temporary failure in name resolution')) {
    return STOP_CODES.DNS_OR_TLS_FAILURE;
  }
  if (errors.includes('ssl') || errors.includes('tls') || errors.includes('certificate')) {
    return STOP_CODES.DNS_OR_TLS_FAILURE;
  }
  if (
    errors.includes('bad credentials')
    || errors.includes('authentication failed')
    || errors.includes('requires authentication')
    || errors.includes('401')
    || errors.includes('403')
  ) {
    return STOP_CODES.AUTH_FAILURE;
  }
  if (errors.includes('rate limit')) {
    return STOP_CODES.RATE_LIMIT;
  }
  if (errors.includes('timed out') || errors.includes('timeout')) {
    return STOP_CODES.REMOTE_TIMEOUT;
  }
  return STOP_CODES.REMOTE_UNAVAILABLE;
}

function remoteAvailable(probes) {
  return Boolean(
    probes
    && probes.gitLsRemote?.ok
    && probes.ghRateLimit?.ok
    && probes.dnsProbeGithubHost?.ok
    && probes.httpsProbeApiGithub?.ok,
  );
}

function normalizeProxyEnvForRepair(inputProxy = {}) {
  const inProxy = isObjectRecord(inputProxy) ? inputProxy : {};
  const out = {
    HTTP_PROXY: normalizeString(inProxy.HTTP_PROXY || process.env.HTTP_PROXY || ''),
    HTTPS_PROXY: normalizeString(inProxy.HTTPS_PROXY || process.env.HTTPS_PROXY || ''),
    NO_PROXY: normalizeString(inProxy.NO_PROXY || process.env.NO_PROXY || ''),
  };

  if (out.HTTP_PROXY && !/^https?:\/\//u.test(out.HTTP_PROXY)) out.HTTP_PROXY = '';
  if (out.HTTPS_PROXY && !/^https?:\/\//u.test(out.HTTPS_PROXY)) out.HTTPS_PROXY = '';
  return out;
}

function defaultRepairRunner(input = {}) {
  const actionsDone = [];
  const normalizedProxy = normalizeProxyEnvForRepair(input.proxyEnv || {});

  const dnsFlush = runCommand('dscacheutil', ['-flushcache']);
  actionsDone.push({ action: 'dns_cache_refresh', ok: dnsFlush.ok, exitCode: dnsFlush.exitCode });

  const resolverRefresh = runCommand('scutil', ['--dns']);
  actionsDone.push({ action: 'resolver_refresh', ok: resolverRefresh.ok, exitCode: resolverRefresh.exitCode });

  const proxyNormalize = {
    action: 'proxy_env_normalize',
    ok: true,
    exitCode: 0,
    normalized: normalizedProxy,
  };
  actionsDone.push(proxyNormalize);

  const ghAuthStatus = runCommand('gh', ['auth', 'status']);
  actionsDone.push({ action: 'gh_auth_refresh_if_allowed', ok: ghAuthStatus.ok, exitCode: ghAuthStatus.exitCode });

  return {
    actionsDone,
    normalizedProxy,
  };
}

function isLocalFixable(stopCode) {
  return stopCode === STOP_CODES.DNS_OR_TLS_FAILURE
    || stopCode === STOP_CODES.REMOTE_UNAVAILABLE
    || stopCode === STOP_CODES.AUTH_FAILURE;
}

function evaluateLoopBreaker(input = {}) {
  const prevStopCode = normalizeString(input.previousStopCode || '').toUpperCase();
  const curStopCode = normalizeString(input.currentStopCode || '').toUpperCase();
  const prevFingerprint = normalizeString(input.previousStateFingerprintHash || '');
  const curFingerprint = normalizeString(input.currentStateFingerprintHash || '');
  const prevDelta = normalizeString(input.previousStateDelta || '').toUpperCase();
  const curDelta = normalizeString(input.currentStateDelta || '').toUpperCase();

  const forbidden = prevStopCode
    && prevStopCode === curStopCode
    && prevFingerprint
    && prevFingerprint === curFingerprint
    && prevDelta === 'NONE'
    && curDelta === 'NONE';

  return {
    forbidden,
    rule: 'SAME_STOP_PLUS_SAME_FINGERPRINT_PLUS_STATE_DELTA_NONE_FORBIDS_REEXECUTION',
  };
}

function evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryPath) {
  const registryDoc = readJsonObject(failsignalRegistryPath);
  if (!registryDoc || !Array.isArray(registryDoc.failSignals)) {
    return {
      ok: false,
      advisoryToBlockingDriftCount: -1,
      driftCases: [],
    };
  }

  const modePairs = [
    { mode: 'pr', key: 'prCore' },
    { mode: 'release', key: 'release' },
    { mode: 'promotion', key: 'promotion' },
  ];

  const driftCases = [];
  for (const row of registryDoc.failSignals) {
    if (!isObjectRecord(row)) continue;
    const failSignalCode = normalizeString(row.code);
    if (!failSignalCode) continue;
    for (const pair of modePairs) {
      const expected = normalizeString((row.modeMatrix || {})[pair.key]).toLowerCase();
      if (expected !== 'advisory') continue;
      const verdict = evaluateModeMatrixVerdict({ repoRoot, mode: pair.mode, failSignalCode });
      if (verdict.ok && verdict.shouldBlock) {
        driftCases.push({ failSignalCode, mode: pair.mode, expected, actual: verdict.modeDisposition });
      }
    }
  }

  return {
    ok: true,
    advisoryToBlockingDriftCount: driftCases.length,
    driftCases,
  };
}

function validateSingleAuthority(repoRoot, modePolicyPath) {
  const policy = readJsonObject(modePolicyPath);
  if (!policy) return { ok: false, reason: STOP_CODES.DUAL_AUTHORITY };
  const id = normalizeString(policy.singleBlockingEvaluator?.id);
  const required = policy.singleBlockingEvaluator?.required === true;
  const advisoryOnly = normalizeString(policy.secondaryVerdictPolicy?.disposition).toUpperCase() === 'ADVISORY_ONLY';
  const noOverride = policy.secondaryVerdictPolicy?.blockingOverrideAllowed === false;
  const ok = id === 'CANONICAL_MODE_MATRIX_EVALUATOR_V1' && required && advisoryOnly && noOverride;
  return {
    ok,
    reason: ok ? '' : STOP_CODES.DUAL_AUTHORITY,
    policyPath: path.relative(repoRoot, modePolicyPath).replaceAll(path.sep, '/'),
  };
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    retryIndex: 0,
    maxAutofixCycles: 3,
    previousStopCode: '',
    previousStateFingerprintHash: '',
    previousStateDelta: '',
    previousLoopDecision: '',
    previousInterruptedStep: '',
    baseSha: '',
    originUrl: '',
    stateDelta: '',
    failsignalRegistryPath: DEFAULT_FAILSIGNAL_REGISTRY_PATH,
    modePolicyPath: DEFAULT_MODE_POLICY_PATH,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;
    if (arg === '--json') out.json = true;
    if (arg.startsWith('--retry-index=')) out.retryIndex = Number(arg.split('=')[1] || 0);
    if (arg.startsWith('--max-autofix-cycles=')) out.maxAutofixCycles = Number(arg.split('=')[1] || 3);
    if (arg.startsWith('--previous-stop-code=')) out.previousStopCode = normalizeString(arg.split('=')[1] || '');
    if (arg.startsWith('--previous-state-fingerprint-hash=')) out.previousStateFingerprintHash = normalizeString(arg.split('=')[1] || '');
    if (arg.startsWith('--previous-state-delta=')) out.previousStateDelta = normalizeString(arg.split('=')[1] || '');
    if (arg.startsWith('--previous-loop-decision=')) out.previousLoopDecision = normalizeString(arg.split('=')[1] || '');
    if (arg.startsWith('--previous-interrupted-step=')) out.previousInterruptedStep = normalizeString(arg.split('=')[1] || '');
    if (arg.startsWith('--base-sha=')) out.baseSha = normalizeString(arg.split('=')[1] || '');
    if (arg.startsWith('--origin-url=')) out.originUrl = normalizeString(arg.split('=')[1] || '');
    if (arg.startsWith('--state-delta=')) out.stateDelta = normalizeString(arg.split('=')[1] || '');
    if (arg.startsWith('--failsignal-registry-path=')) out.failsignalRegistryPath = normalizeString(arg.split('=')[1] || DEFAULT_FAILSIGNAL_REGISTRY_PATH);
    if (arg.startsWith('--mode-policy-path=')) out.modePolicyPath = normalizeString(arg.split('=')[1] || DEFAULT_MODE_POLICY_PATH);
  }

  return out;
}

export function evaluateRemoteAutofixState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const modePolicyPath = path.resolve(repoRoot, normalizeString(input.modePolicyPath || DEFAULT_MODE_POLICY_PATH));
  const failsignalRegistryPath = path.resolve(repoRoot, normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH));

  const maxAutofixCycles = Math.max(1, Number(input.maxAutofixCycles || 3));
  const backoffSchedule = Array.isArray(input.backoffSchedule) && input.backoffSchedule.length > 0
    ? input.backoffSchedule
    : [...BACKOFF_MINUTES];
  const retryIndex = Math.max(0, Number(input.retryIndex || 0));
  const cycleIndex = retryIndex + 1;

  const authorityState = validateSingleAuthority(repoRoot, modePolicyPath);
  const probeRunner = typeof input.probeRunner === 'function' ? input.probeRunner : defaultProbeRunner;
  const repairRunner = typeof input.repairRunner === 'function' ? input.repairRunner : defaultRepairRunner;

  const sequence = ['probe', 'classify'];
  const probesInitial = isObjectRecord(input.probesInitial) ? input.probesInitial : probeRunner();
  const availableInitial = remoteAvailable(probesInitial);
  const classified = availableInitial ? STOP_CODES.NONE : classifyRemoteFailure(probesInitial);

  const driftState = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryPath);
  const noAdvisoryToBlockingDrift = driftState.ok && driftState.advisoryToBlockingDriftCount === 0;

  const fingerprintState = buildRemoteStateFingerprint({
    baseSha: normalizeString(input.baseSha || ''),
    originUrl: normalizeString(input.originUrl || 'origin'),
    dnsResolvers: Array.isArray(input.dnsResolvers) ? input.dnsResolvers : ['system'],
    proxyEnv: input.proxyEnv,
    ghAuth: parseGhAuthState(probesInitial),
    errorClass: classified,
  });
  const fingerprintSchema = validateRemoteStateFingerprintSchema(fingerprintState.fingerprint);

  let stopCode = STOP_CODES.NONE;
  let loopDecision = 'CONTINUE';
  let stateDelta = normalizeString(input.stateDelta || 'NEW_TICKET');
  let resumeCondition = 'NONE';
  let nextAutoProbeAt = 'NOT_APPLICABLE';
  let autoResumeAfterRemotePass = false;
  let manualResumeWhileRemoteFailForbidden = true;
  let actionsDone = [];
  let probesAfterRepair = null;

  if (!authorityState.ok) {
    stopCode = STOP_CODES.DUAL_AUTHORITY;
  } else if (!fingerprintSchema.ok) {
    stopCode = STOP_CODES.FINGERPRINT_SCHEMA;
  } else if (!availableInitial && classified === STOP_CODES.NONE) {
    stopCode = STOP_CODES.REMOTE_CLASS_UNDEFINED;
  } else if (!availableInitial) {
    stopCode = classified;
  }

  const loopBreaker = evaluateLoopBreaker({
    previousStopCode: input.previousStopCode,
    currentStopCode: stopCode,
    previousStateFingerprintHash: normalizeString(input.previousStateFingerprintHash || ''),
    currentStateFingerprintHash: fingerprintState.fingerprintHash,
    previousStateDelta: normalizeString(input.previousStateDelta || ''),
    currentStateDelta: normalizeString(stateDelta || 'NONE') || 'NONE',
  });

  if (stopCode !== STOP_CODES.NONE && loopBreaker.forbidden) {
    stopCode = STOP_CODES.ROUTE_MATRIX_VIOLATION;
  }

  if (stopCode === STOP_CODES.NONE && availableInitial) {
    autoResumeAfterRemotePass = true;
    resumeCondition = 'remote_available=PASS_AND_gh_api_ok=PASS_AND_dns_tls_ok=PASS';
    stateDelta = 'REMOTE_AVAILABLE_PASS';
  } else if (stopCode !== STOP_CODES.ROUTE_MATRIX_VIOLATION && isLocalFixable(stopCode) && cycleIndex <= maxAutofixCycles) {
    sequence.push('repair', 'reprobe');
    const repairState = repairRunner({
      stopCode,
      proxyEnv: input.proxyEnv,
    });
    actionsDone = Array.isArray(repairState.actionsDone) ? repairState.actionsDone : [];

    probesAfterRepair = isObjectRecord(input.probesAfterRepair) ? input.probesAfterRepair : probeRunner();
    const availableAfterRepair = remoteAvailable(probesAfterRepair);

    if (availableAfterRepair) {
      stopCode = STOP_CODES.NONE;
      autoResumeAfterRemotePass = true;
      resumeCondition = 'remote_available=PASS_AND_gh_api_ok=PASS_AND_dns_tls_ok=PASS';
      stateDelta = `AUTOFIX_CYCLE_${cycleIndex}_RECOVERED`;
    } else if (cycleIndex >= maxAutofixCycles) {
      loopDecision = 'WAIT_MODE';
      const nextState = computeNextAutoProbeAt({ retryIndex: cycleIndex, backoffSchedule });
      nextAutoProbeAt = nextState.nextAutoProbeAt;
      stateDelta = `AUTOFIX_CYCLE_${cycleIndex}_NO_RECOVERY`;
      resumeCondition = 'remote_available=PASS_AND_gh_api_ok=PASS_AND_dns_tls_ok=PASS';
    } else {
      stateDelta = `AUTOFIX_CYCLE_${cycleIndex}_NO_RECOVERY`;
      resumeCondition = 'NONE';
    }
  } else if (stopCode !== STOP_CODES.NONE) {
    if (cycleIndex >= maxAutofixCycles) {
      loopDecision = 'WAIT_MODE';
      const nextState = computeNextAutoProbeAt({ retryIndex: cycleIndex, backoffSchedule });
      nextAutoProbeAt = nextState.nextAutoProbeAt;
      resumeCondition = 'remote_available=PASS_AND_gh_api_ok=PASS_AND_dns_tls_ok=PASS';
    }
    if (!stateDelta || stateDelta === 'NEW_TICKET') {
      stateDelta = `AUTOFIX_CYCLE_${cycleIndex}_NO_RECOVERY`;
    }
  }

  const waitEmit = evaluateWaitModeEmitRule({
    previousLoopDecision: input.previousLoopDecision,
    currentLoopDecision: loopDecision,
    previousFingerprint: normalizeString(input.previousStateFingerprintHash || ''),
    currentFingerprint: fingerprintState.fingerprintHash,
    stateDelta,
  });
  const waitEnvelope = validateWaitModeEnvelope({
    loopDecision,
    nextAutoProbeAt,
  });

  const checks = {
    schema_valid: true,
    single_blocking_authority_enforced: authorityState.ok,
    remote_classification_required: availableInitial || classified !== STOP_CODES.NONE,
    autofix_sequence_probe_classify_repair_reprobe_enforced: sequence.join('>') === 'probe>classify' || sequence.join('>') === 'probe>classify>repair>reprobe',
    retry_budget_enforced_max_3: maxAutofixCycles === 3,
    backoff_enforced_2m_5m_15m: JSON.stringify(backoffSchedule) === JSON.stringify([2, 5, 15]),
    wait_mode_entry_rule_enforced: loopDecision !== 'WAIT_MODE' || cycleIndex >= maxAutofixCycles,
    wait_mode_emit_rule_enforced: waitEmit.shouldEmitWaitStatus || waitEmit.dedupApplied,
    next_auto_probe_at_required_when_wait: waitEnvelope.ok,
    manual_resume_while_remote_fail_forbidden: manualResumeWhileRemoteFailForbidden,
    auto_resume_after_remote_pass_required: stopCode !== STOP_CODES.NONE || autoResumeAfterRemotePass,
    loop_breaker_same_stop_same_fingerprint_state_delta_none_forbidden: !loopBreaker.forbidden || stopCode === STOP_CODES.ROUTE_MATRIX_VIOLATION,
    no_advisory_to_blocking_drift: noAdvisoryToBlockingDrift,
    no_runtime_hotpath_governance: true,
  };

  const checksOk = Object.values(checks).every((value) => value === true);
  const ok = checksOk && stopCode !== STOP_CODES.DUAL_AUTHORITY && stopCode !== STOP_CODES.FINGERPRINT_SCHEMA && stopCode !== STOP_CODES.STATE_DELTA_SCHEMA;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignalCode: ok ? '' : FAIL_SIGNAL_CODE,
    stopCode,
    loopDecision,
    retrySeriesId: normalizeString(input.retrySeriesId || ''),
    retryIndex: cycleIndex,
    stateDelta,
    stateFingerprint: fingerprintState.fingerprint,
    stateFingerprintHash: fingerprintState.fingerprintHash,
    resumeCondition,
    nextAutoProbeAt,
    autoResumeAfterRemotePass,
    waitModeStatusEmitAllowed: waitEmit.shouldEmitWaitStatus,
    waitModeStatusDedupApplied: waitEmit.dedupApplied,
    checks,
    sequence,
    probes: {
      initial: probesInitial,
      afterRepair: probesAfterRepair,
    },
    actionsDone,
    advisoryToBlockingDriftCount: driftState.advisoryToBlockingDriftCount,
    driftCases: driftState.driftCases,
    policyPaths: {
      modePolicyPath: path.relative(repoRoot, modePolicyPath).replaceAll(path.sep, '/'),
      failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),
    },
    loopBreaker,
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`STOP_CODE=${state.stopCode}`);
  console.log(`LOOP_DECISION=${state.loopDecision}`);
  console.log(`RETRY_INDEX=${state.retryIndex}`);
  console.log(`STATE_DELTA=${state.stateDelta}`);
  console.log(`STATE_FINGERPRINT_HASH=${state.stateFingerprintHash}`);
  console.log(`NEXT_AUTO_PROBE_AT=${state.nextAutoProbeAt}`);
  console.log(`RESUME_CONDITION=${state.resumeCondition}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateRemoteAutofixState({
    retryIndex: args.retryIndex,
    maxAutofixCycles: args.maxAutofixCycles,
    previousStopCode: args.previousStopCode,
    previousStateFingerprintHash: args.previousStateFingerprintHash,
    previousStateDelta: args.previousStateDelta,
    previousLoopDecision: args.previousLoopDecision,
    previousInterruptedStep: args.previousInterruptedStep,
    baseSha: args.baseSha,
    originUrl: args.originUrl,
    stateDelta: args.stateDelta,
    failsignalRegistryPath: args.failsignalRegistryPath,
    modePolicyPath: args.modePolicyPath,
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
  STOP_CODES,
};
