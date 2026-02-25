#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { evaluateRemoteAutofixState } from './remote-autofix-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P0_CONTOUR/TICKET_07';

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

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${stableStringify(value)}\n`, 'utf8');
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    outputDir: DEFAULT_OUTPUT_DIR,
    runId: '',
    ticketId: '',
    retrySeriesId: 'INFRA_REMOTE_UNAVAILABLE_SERIES_01',
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
    if (arg.startsWith('--run-id=')) {
      out.runId = normalizeString(arg.slice('--run-id='.length));
      continue;
    }
    if (arg.startsWith('--ticket-id=')) {
      out.ticketId = normalizeString(arg.slice('--ticket-id='.length));
      continue;
    }
    if (arg.startsWith('--retry-series-id=')) {
      out.retrySeriesId = normalizeString(arg.slice('--retry-series-id='.length)) || out.retrySeriesId;
    }
  }

  return out;
}

function resolveBaseSha() {
  const fromEnv = normalizeString(process.env.BASE_SHA || '');
  if (fromEnv) return fromEnv;
  try {
    return normalizeString(execSync('git rev-parse HEAD', { encoding: 'utf8' }));
  } catch {
    return 'UNKNOWN_BASE_SHA';
  }
}

function failingProbes() {
  return {
    gitLsRemote: { ok: false, stderr: 'Could not resolve host: github.com', stdout: '', exitCode: 128 },
    ghRateLimit: { ok: false, stderr: 'error connecting to api.github.com', stdout: '', exitCode: 1 },
    dnsProbeGithubHost: { ok: false, stderr: 'server cant find github.com', stdout: '', exitCode: 1 },
    httpsProbeApiGithub: { ok: false, stderr: 'curl: (6) Could not resolve host: api.github.com', stdout: '', exitCode: 6 },
  };
}

function passingProbes() {
  return {
    gitLsRemote: { ok: true, stderr: '', stdout: 'ok', exitCode: 0 },
    ghRateLimit: { ok: true, stderr: '', stdout: 'ok', exitCode: 0 },
    dnsProbeGithubHost: { ok: true, stderr: '', stdout: 'ok', exitCode: 0 },
    httpsProbeApiGithub: { ok: true, stderr: '', stdout: 'ok', exitCode: 0 },
  };
}

function noopRepair() {
  return {
    actionsDone: [
      { action: 'dns_cache_refresh', ok: true, exitCode: 0 },
      { action: 'resolver_refresh', ok: true, exitCode: 0 },
      { action: 'proxy_env_normalize', ok: true, exitCode: 0 },
      { action: 'gh_auth_refresh_if_allowed', ok: true, exitCode: 0 },
    ],
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const outputDir = path.resolve(repoRoot, args.outputDir);
  const baseSha = resolveBaseSha();

  const scenarioWait = evaluateRemoteAutofixState({
    repoRoot,
    retrySeriesId: args.retrySeriesId,
    retryIndex: 2,
    maxAutofixCycles: 3,
    backoffSchedule: [2, 5, 15],
    previousLoopDecision: 'CONTINUE',
    previousStateDelta: 'AUTOFIX_CYCLE_2_NO_RECOVERY',
    baseSha,
    originUrl: 'origin',
    probesInitial: failingProbes(),
    probesAfterRepair: failingProbes(),
    repairRunner: noopRepair,
  });

  const scenarioResume = evaluateRemoteAutofixState({
    repoRoot,
    retrySeriesId: args.retrySeriesId,
    retryIndex: 1,
    maxAutofixCycles: 3,
    backoffSchedule: [2, 5, 15],
    previousLoopDecision: 'WAIT_MODE',
    previousStateDelta: 'AUTOFIX_CYCLE_3_NO_RECOVERY',
    baseSha,
    originUrl: 'origin',
    probesInitial: passingProbes(),
    repairRunner: noopRepair,
  });

  const scenarioLoopBreaker = evaluateRemoteAutofixState({
    repoRoot,
    retrySeriesId: args.retrySeriesId,
    retryIndex: 1,
    maxAutofixCycles: 3,
    backoffSchedule: [2, 5, 15],
    previousStopCode: 'DNS_OR_TLS_FAILURE',
    previousStateFingerprintHash: scenarioWait.stateFingerprintHash,
    previousStateDelta: 'NONE',
    stateDelta: 'NONE',
    baseSha,
    originUrl: 'origin',
    probesInitial: failingProbes(),
    probesAfterRepair: failingProbes(),
    repairRunner: noopRepair,
  });

  const gates = {
    schema_valid: scenarioWait.checks.schema_valid ? 'PASS' : 'FAIL',
    single_blocking_authority_enforced: scenarioWait.checks.single_blocking_authority_enforced ? 'PASS' : 'FAIL',
    remote_classification_required: scenarioWait.checks.remote_classification_required ? 'PASS' : 'FAIL',
    autofix_sequence_probe_classify_repair_reprobe_enforced: scenarioWait.checks.autofix_sequence_probe_classify_repair_reprobe_enforced ? 'PASS' : 'FAIL',
    retry_budget_enforced_max_3: scenarioWait.checks.retry_budget_enforced_max_3 ? 'PASS' : 'FAIL',
    backoff_enforced_2m_5m_15m: scenarioWait.checks.backoff_enforced_2m_5m_15m ? 'PASS' : 'FAIL',
    wait_mode_entry_rule_enforced: scenarioWait.loopDecision === 'WAIT_MODE' ? 'PASS' : 'FAIL',
    wait_mode_emit_rule_enforced: scenarioWait.checks.wait_mode_emit_rule_enforced ? 'PASS' : 'FAIL',
    next_auto_probe_at_required_when_wait: scenarioWait.checks.next_auto_probe_at_required_when_wait ? 'PASS' : 'FAIL',
    manual_resume_while_remote_fail_forbidden: scenarioWait.checks.manual_resume_while_remote_fail_forbidden ? 'PASS' : 'FAIL',
    auto_resume_after_remote_pass_required: scenarioResume.autoResumeAfterRemotePass ? 'PASS' : 'FAIL',
    loop_breaker_same_stop_same_fingerprint_state_delta_none_forbidden: scenarioLoopBreaker.stopCode === 'E_ROUTE_MATRIX_VIOLATION' ? 'PASS' : 'FAIL',
    no_advisory_to_blocking_drift: scenarioWait.checks.no_advisory_to_blocking_drift ? 'PASS' : 'FAIL',
    no_runtime_hotpath_governance: scenarioWait.checks.no_runtime_hotpath_governance ? 'PASS' : 'FAIL',
  };

  const summary = {
    status: Object.values(gates).every((value) => value === 'PASS') ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    stopCode: scenarioWait.stopCode,
    stateFingerprint: scenarioWait.stateFingerprintHash,
    stateDelta: scenarioWait.stateDelta,
    autofixCycleIndex: scenarioWait.retryIndex,
    autofixActionsDone: scenarioWait.actionsDone,
    remoteAvailable: scenarioWait.stopCode === 'NONE',
    nextAutoProbeAt: scenarioWait.nextAutoProbeAt,
    resumeCondition: scenarioWait.resumeCondition,
    gates,
    generatedAtUtc: new Date().toISOString(),
  };

  const ticketMeta = {
    runId: summary.runId,
    ticketId: summary.ticketId,
    outputDir: path.relative(repoRoot, outputDir).replaceAll(path.sep, '/'),
    generatedAtUtc: summary.generatedAtUtc,
    retrySeriesId: args.retrySeriesId,
    scenarios: {
      wait: {
        loopDecision: scenarioWait.loopDecision,
        stopCode: scenarioWait.stopCode,
      },
      resume: {
        loopDecision: scenarioResume.loopDecision,
        stopCode: scenarioResume.stopCode,
      },
      loopBreaker: {
        stopCode: scenarioLoopBreaker.stopCode,
      },
    },
  };

  writeJson(path.join(outputDir, 'summary.json'), summary);
  writeJson(path.join(outputDir, 'ticket-meta.json'), ticketMeta);

  process.stdout.write(`${stableStringify(summary)}\n`);
  process.exit(summary.status === 'PASS' ? 0 : 1);
}

main();
