#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { evaluateModeMatrixVerdict } from './canonical-mode-matrix-evaluator.mjs';

const TOKEN_NAME = 'RECURSION_BYPASS_RELEASE_BAN_OK';
const FAIL_SIGNAL_CODE = 'E_GOVERNANCE_STRICT_FAIL';
const DEFAULT_GUARD_PATH = 'scripts/guards/ops-current-wave-stop.mjs';
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
    guardPath: '',
    failsignalRegistryPath: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--json') {
      out.json = true;
      continue;
    }

    if (arg === '--guard-path' && i + 1 < argv.length) {
      out.guardPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--guard-path=')) {
      out.guardPath = normalizeString(arg.slice('--guard-path='.length));
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

function parseTokens(stdout) {
  const tokens = new Map();
  for (const rawLine of String(stdout || '').split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || !line.includes('=')) continue;
    const i = line.indexOf('=');
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1);
    if (!key) continue;
    tokens.set(key, value);
  }
  return tokens;
}

function runGuard(guardAbsPath, mode, extraEnv = {}) {
  const env = {
    ...process.env,
    DEV_FAST_LANE: '1',
    OPS_CONTEXT_MODE: mode,
    PROMOTION_MODE: mode === 'promotion' ? '1' : '0',
    WAVE_PROMOTION_MODE: mode === 'promotion' ? '1' : '0',
    ...extraEnv,
  };

  const run = spawnSync(process.execPath, [guardAbsPath], {
    cwd: process.cwd(),
    env,
    encoding: 'utf8',
  });

  const tokens = parseTokens(run.stdout);
  const exitCode = Number.isInteger(run.status) ? run.status : 1;
  const failReason = normalizeString(tokens.get('CURRENT_WAVE_STOP_CONDITION_FAIL_REASON') || '');
  const failSignal = normalizeString(tokens.get('CURRENT_WAVE_FAIL_SIGNAL') || '');
  const guardMode = normalizeString(tokens.get('CURRENT_WAVE_GUARD_MODE') || '');
  const stopOk = normalizeString(tokens.get('CURRENT_WAVE_STOP_CONDITION_OK') || '') === '1';

  return {
    exitCode,
    stopOk,
    failReason,
    failSignal,
    guardMode,
    stdout: String(run.stdout || ''),
    stderr: String(run.stderr || ''),
  };
}

function evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryPath) {
  const registryDoc = readJsonObject(failsignalRegistryPath);
  if (!registryDoc || !Array.isArray(registryDoc.failSignals)) {
    return {
      ok: false,
      advisoryToBlockingDriftCount: -1,
      driftCases: [],
      issues: [
        {
          code: 'FAILSIGNAL_REGISTRY_UNREADABLE',
          failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),
        },
      ],
    };
  }

  const modePairs = [
    { mode: 'pr', key: 'prCore' },
    { mode: 'release', key: 'release' },
    { mode: 'promotion', key: 'promotion' },
  ];

  const driftCases = [];
  const issues = [];

  for (const row of registryDoc.failSignals) {
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

function evaluateRecursionBypassReleaseBan(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const guardPath = path.resolve(repoRoot, normalizeString(input.guardPath || DEFAULT_GUARD_PATH));
  const failsignalRegistryPath = path.resolve(
    repoRoot,
    normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
  );

  const releaseRun = runGuard(guardPath, 'release');
  const promotionRun = runGuard(guardPath, 'promotion');
  const negativeRun = runGuard(guardPath, 'release', {
    OPS_CONTEXT_MODE: '',
    PROMOTION_MODE: '0',
    WAVE_PROMOTION_MODE: '0',
  });

  const releaseContextBypassDisabled = releaseRun.exitCode !== 0
    && releaseRun.stopOk === false
    && releaseRun.failReason === FAIL_SIGNAL_CODE
    && releaseRun.failSignal === FAIL_SIGNAL_CODE
    && releaseRun.guardMode === 'release';

  const promotionContextBypassDisabled = promotionRun.exitCode !== 0
    && promotionRun.stopOk === false
    && promotionRun.failReason === FAIL_SIGNAL_CODE
    && promotionRun.failSignal === FAIL_SIGNAL_CODE
    && promotionRun.guardMode === 'promotion';

  const negativeBypassAttemptFails = negativeRun.exitCode !== 0
    && negativeRun.stopOk === false
    && negativeRun.failReason === FAIL_SIGNAL_CODE
    && negativeRun.failSignal === FAIL_SIGNAL_CODE
    && negativeRun.guardMode === 'release';

  const driftState = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryPath);
  const advisoryToBlockingDriftCount = driftState.advisoryToBlockingDriftCount;
  const advisoryToBlockingDriftCountZero = advisoryToBlockingDriftCount === 0;

  const issues = [];
  if (!fs.existsSync(guardPath)) issues.push({ code: 'GUARD_PATH_MISSING' });
  if (!driftState.ok) issues.push(...driftState.issues);

  const checksOk = releaseContextBypassDisabled
    && promotionContextBypassDisabled
    && negativeBypassAttemptFails
    && advisoryToBlockingDriftCountZero;
  const ok = issues.length === 0 && checksOk;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignalCode: ok ? '' : FAIL_SIGNAL_CODE,
    failReason: ok ? '' : (
      !releaseContextBypassDisabled
        ? 'RELEASE_CONTEXT_BYPASS_STILL_ALLOWED'
        : !promotionContextBypassDisabled
          ? 'PROMOTION_CONTEXT_BYPASS_STILL_ALLOWED'
          : !negativeBypassAttemptFails
            ? 'NEGATIVE_BYPASS_ATTEMPT_NOT_FAILING'
            : 'ADVISORY_TO_BLOCKING_DRIFT_NONZERO'
    ),
    guardPath: path.relative(repoRoot, guardPath).replaceAll(path.sep, '/'),
    failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),
    releaseContextBypassDisabled,
    promotionContextBypassDisabled,
    negativeBypassAttemptFails,
    advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero,
    driftCases: driftState.driftCases,
    attempts: {
      release: {
        exitCode: releaseRun.exitCode,
        stopOk: releaseRun.stopOk,
        failReason: releaseRun.failReason,
        failSignal: releaseRun.failSignal,
        guardMode: releaseRun.guardMode,
      },
      promotion: {
        exitCode: promotionRun.exitCode,
        stopOk: promotionRun.stopOk,
        failReason: promotionRun.failReason,
        failSignal: promotionRun.failSignal,
        guardMode: promotionRun.guardMode,
      },
      negative: {
        exitCode: negativeRun.exitCode,
        stopOk: negativeRun.stopOk,
        failReason: negativeRun.failReason,
        failSignal: negativeRun.failSignal,
        guardMode: negativeRun.guardMode,
      },
    },
    issues,
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`RECURSION_BYPASS_RELEASE_DISABLED=${state.releaseContextBypassDisabled ? 1 : 0}`);
  console.log(`RECURSION_BYPASS_PROMOTION_DISABLED=${state.promotionContextBypassDisabled ? 1 : 0}`);
  console.log(`RECURSION_BYPASS_NEGATIVE_ATTEMPT_FAILS=${state.negativeBypassAttemptFails ? 1 : 0}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.advisoryToBlockingDriftCount}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT_ZERO=${state.advisoryToBlockingDriftCountZero ? 1 : 0}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateRecursionBypassReleaseBan({
    guardPath: args.guardPath,
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
  evaluateRecursionBypassReleaseBan,
  FAIL_SIGNAL_CODE,
};
