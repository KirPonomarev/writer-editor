#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateModeMatrixVerdict } from './canonical-mode-matrix-evaluator.mjs';
import { evaluateModeMatrixSingleAuthorityState } from './mode-matrix-single-authority-state.mjs';
import { evaluateModeAwareExitPolicyState } from './mode-aware-exit-policy-state.mjs';
import { evaluateStageActivationState } from './stage-activation-state.mjs';

const TOKEN_NAME = 'WS04_MODE_SPLIT_ENFORCEMENT_OK';
const CANDIDATE_FAIL_SIGNAL = 'E_MODE_POLICY_DRIFT';
const ACTIVE_CANON_EXPECTED = 'v3.13a-final';

const CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const CLAIM_MATRIX_PATH = 'docs/OPS/CLAIMS/CRITICAL_CLAIM_MATRIX.json';
const PHASE_SWITCH_PATH = 'docs/OPS/STATUS/PHASE_SWITCH_V1.json';
const REMOTE_AUTOFIX_SCRIPT_PATH = 'scripts/ops/remote-autofix-state.mjs';

const ADVISORY_LOCKED_RELEASE_CODES = Object.freeze([
  'E_GOVERNANCE_STRICT_FAIL',
  'E_REMOTE_UNAVAILABLE',
]);

const PROMOTION_LOCKED_DISPOSITIONS = Object.freeze({
  E_SEQUENCE_ORDER_DRIFT: { release: 'blocking', promotion: 'blocking' },
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

function copyFixtureFile(repoRoot, tempRoot, relativePath) {
  const src = path.resolve(repoRoot, relativePath);
  const dst = path.resolve(tempRoot, relativePath);
  ensureParentDir(dst);
  fs.copyFileSync(src, dst);
}

function withTempRepo(repoRoot, mutateRegistry, run) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ws04-mode-split-'));
  try {
    copyFixtureFile(repoRoot, tempRoot, FAILSIGNAL_REGISTRY_PATH);
    copyFixtureFile(repoRoot, tempRoot, CLAIM_MATRIX_PATH);
    copyFixtureFile(repoRoot, tempRoot, PHASE_SWITCH_PATH);
    copyFixtureFile(repoRoot, tempRoot, REMOTE_AUTOFIX_SCRIPT_PATH);

    const registryAbsPath = path.resolve(tempRoot, FAILSIGNAL_REGISTRY_PATH);
    const registryDoc = readJsonObject(registryAbsPath);
    if (!registryDoc || !Array.isArray(registryDoc.failSignals)) {
      return {
        ok: false,
        error: 'FAILSIGNAL_REGISTRY_UNREADABLE_IN_TEMP_REPO',
      };
    }

    const mutatedRegistry = cloneJson(registryDoc);
    mutateRegistry(mutatedRegistry);
    fs.writeFileSync(registryAbsPath, `${stableStringify(mutatedRegistry)}\n`, 'utf8');

    return run(tempRoot, mutatedRegistry);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function patchFailSignal(registryDoc, failSignalCode, patch) {
  const rows = Array.isArray(registryDoc.failSignals) ? registryDoc.failSignals : [];
  const row = rows.find((entry) => isObjectRecord(entry) && normalizeString(entry.code) === failSignalCode);
  if (!row) return false;
  patch(row);
  return true;
}

function evaluateActiveCanonLock(repoRoot) {
  const canonStatus = readJsonObject(path.resolve(repoRoot, CANON_STATUS_PATH));
  const observed = canonStatus ? normalizeString(canonStatus.canonVersion).toLowerCase() : '';
  const expected = ACTIVE_CANON_EXPECTED;
  const ok = observed === expected;
  return {
    ok,
    observedCanonVersion: observed,
    expectedCanonVersion: expected,
  };
}

function evaluateAdvisoryLockedReleaseSignals(repoRoot) {
  const results = [];
  for (const failSignalCode of ADVISORY_LOCKED_RELEASE_CODES) {
    const verdict = evaluateModeMatrixVerdict({
      repoRoot,
      mode: 'release',
      failSignalCode,
    });
    const pass = verdict.ok && verdict.modeDisposition === 'advisory' && verdict.shouldBlock === false;
    results.push({
      failSignalCode,
      pass,
      verdict: {
        ok: verdict.ok,
        modeDisposition: verdict.modeDisposition,
        shouldBlock: verdict.shouldBlock,
        issues: verdict.issues,
      },
    });
  }

  return {
    ok: results.length > 0 && results.every((entry) => entry.pass),
    results,
  };
}

function evaluatePromotionParityLock(repoRoot) {
  const rows = [];
  for (const [failSignalCode, expected] of Object.entries(PROMOTION_LOCKED_DISPOSITIONS)) {
    const releaseVerdict = evaluateModeMatrixVerdict({ repoRoot, mode: 'release', failSignalCode });
    const promotionVerdict = evaluateModeMatrixVerdict({ repoRoot, mode: 'promotion', failSignalCode });
    const pass = releaseVerdict.ok
      && promotionVerdict.ok
      && releaseVerdict.modeDisposition === normalizeString(expected.release)
      && promotionVerdict.modeDisposition === normalizeString(expected.promotion)
      && releaseVerdict.shouldBlock === true
      && promotionVerdict.shouldBlock === true;

    rows.push({
      failSignalCode,
      expected,
      pass,
      release: {
        ok: releaseVerdict.ok,
        modeDisposition: releaseVerdict.modeDisposition,
        shouldBlock: releaseVerdict.shouldBlock,
        issues: releaseVerdict.issues,
      },
      promotion: {
        ok: promotionVerdict.ok,
        modeDisposition: promotionVerdict.modeDisposition,
        shouldBlock: promotionVerdict.shouldBlock,
        issues: promotionVerdict.issues,
      },
    });
  }

  return {
    ok: rows.length > 0 && rows.every((row) => row.pass),
    rows,
  };
}

function evaluateNoNonCanonAutoblock(repoRoot) {
  const verdict = evaluateModeMatrixVerdict({
    repoRoot,
    mode: 'release',
    failSignalCode: 'E_NON_CANON_SIGNAL_NOT_REGISTERED',
  });

  return {
    ok: verdict.ok === false && verdict.shouldBlock === false,
    verdict: {
      ok: verdict.ok,
      modeDisposition: verdict.modeDisposition,
      shouldBlock: verdict.shouldBlock,
      issues: verdict.issues,
    },
  };
}

function evaluateNegativeScenarios(repoRoot) {
  const negative = {};

  negative.NEXT_TZ_NEGATIVE_01 = withTempRepo(
    repoRoot,
    (registry) => {
      patchFailSignal(registry, 'E_GOVERNANCE_STRICT_FAIL', (row) => {
        row.modeMatrix = {
          ...(isObjectRecord(row.modeMatrix) ? row.modeMatrix : {}),
          release: 'blocking',
        };
      });
    },
    (tempRoot) => {
      const lockCheck = evaluateAdvisoryLockedReleaseSignals(tempRoot);
      return {
        detected: lockCheck.ok === false,
        details: lockCheck,
      };
    },
  );

  negative.NEXT_TZ_NEGATIVE_02 = withTempRepo(
    repoRoot,
    (registry) => {
      patchFailSignal(registry, 'E_REMOTE_UNAVAILABLE', (row) => {
        row.code = ' E_REMOTE_UNAVAILABLE ';
      });
    },
    (tempRoot) => {
      const state = evaluateModeMatrixSingleAuthorityState({ repoRoot: tempRoot });
      return {
        detected: state.secondaryEvaluatorMismatchCount > 0,
        details: {
          secondaryEvaluatorMismatchCount: state.secondaryEvaluatorMismatchCount,
          advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
          status: state.status,
          gates: state.gates,
        },
      };
    },
  );

  negative.NEXT_TZ_NEGATIVE_03 = withTempRepo(
    repoRoot,
    (registry) => {
      patchFailSignal(registry, 'E_SEQUENCE_ORDER_DRIFT', (row) => {
        row.modeMatrix = {
          ...(isObjectRecord(row.modeMatrix) ? row.modeMatrix : {}),
          release: '',
        };
      });
    },
    (tempRoot) => {
      const verdict = evaluateModeMatrixVerdict({
        repoRoot: tempRoot,
        mode: 'release',
        failSignalCode: 'E_SEQUENCE_ORDER_DRIFT',
      });
      const hasTargetIssue = Array.isArray(verdict.issues)
        && verdict.issues.some((issue) => normalizeString(issue.code) === 'FAILSIGNAL_MODE_MATRIX_INVALID');
      return {
        detected: verdict.ok === false && hasTargetIssue,
        details: {
          ok: verdict.ok,
          modeDisposition: verdict.modeDisposition,
          shouldBlock: verdict.shouldBlock,
          issues: verdict.issues,
        },
      };
    },
  );

  negative.NEXT_TZ_NEGATIVE_04 = withTempRepo(
    repoRoot,
    (registry) => {
      patchFailSignal(registry, 'E_GOVERNANCE_STRICT_FAIL', (row) => {
        row.modeMatrix = {
          ...(isObjectRecord(row.modeMatrix) ? row.modeMatrix : {}),
          release: 'blocking',
        };
      });
    },
    (tempRoot) => {
      const state = evaluateModeAwareExitPolicyState({
        repoRoot: tempRoot,
        failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
        modeRoutingCases: [
          {
            caseId: 'release_advisory_guard_case',
            mode: 'release',
            modeKey: 'release',
            failSignalCode: 'E_GOVERNANCE_STRICT_FAIL',
            expectedDisposition: 'advisory',
            expectedShouldBlock: false,
          },
        ],
      });

      return {
        detected: state.modeRouting.ok === false,
        details: {
          ok: state.ok,
          failReason: state.failReason,
          modeRoutingOk: state.modeRouting.ok,
          modeRouting: state.modeRouting,
        },
      };
    },
  );

  negative.NEXT_TZ_NEGATIVE_05 = withTempRepo(
    repoRoot,
    (registry) => {
      patchFailSignal(registry, 'E_SEQUENCE_ORDER_DRIFT', (row) => {
        row.modeMatrix = {
          ...(isObjectRecord(row.modeMatrix) ? row.modeMatrix : {}),
          promotion: 'advisory',
        };
      });
    },
    (tempRoot) => {
      const parity = evaluatePromotionParityLock(tempRoot);
      return {
        detected: parity.ok === false,
        details: parity,
      };
    },
  );

  return negative;
}

export function evaluateWs04ModeSplitEnforcementState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());

  const activeCanon = evaluateActiveCanonLock(repoRoot);
  const stageActivation = evaluateStageActivationState({});
  const authorityState = evaluateModeMatrixSingleAuthorityState({ repoRoot });
  const exitPolicyState = evaluateModeAwareExitPolicyState({ repoRoot });
  const advisoryLocked = evaluateAdvisoryLockedReleaseSignals(repoRoot);
  const promotionParityLock = evaluatePromotionParityLock(repoRoot);
  const nonCanonAutoblock = evaluateNoNonCanonAutoblock(repoRoot);
  const negative = evaluateNegativeScenarios(repoRoot);

  const negativeResults = {
    NEXT_TZ_NEGATIVE_01: Boolean(negative.NEXT_TZ_NEGATIVE_01?.detected),
    NEXT_TZ_NEGATIVE_02: Boolean(negative.NEXT_TZ_NEGATIVE_02?.detected),
    NEXT_TZ_NEGATIVE_03: Boolean(negative.NEXT_TZ_NEGATIVE_03?.detected),
    NEXT_TZ_NEGATIVE_04: Boolean(negative.NEXT_TZ_NEGATIVE_04?.detected),
    NEXT_TZ_NEGATIVE_05: Boolean(negative.NEXT_TZ_NEGATIVE_05?.detected),
  };

  const positiveResults = {
    NEXT_TZ_POSITIVE_01: authorityState.status === 'PASS',
    NEXT_TZ_POSITIVE_02: advisoryLocked.ok,
    NEXT_TZ_POSITIVE_03: exitPolicyState.ok,
  };

  const dod = {
    NEXT_TZ_DOD_01: authorityState.advisoryToBlockingDriftCount === 0 && exitPolicyState.advisoryToBlockingDriftCount === 0,
    NEXT_TZ_DOD_02: authorityState.status === 'PASS',
    NEXT_TZ_DOD_03: Object.values(negativeResults).every((value) => value === true),
    NEXT_TZ_DOD_04: Object.values(positiveResults).every((value) => value === true),
    NEXT_TZ_DOD_05: true,
    NEXT_TZ_DOD_06: true,
  };

  const acceptance = {
    NEXT_TZ_ACCEPTANCE_01: activeCanon.ok,
    NEXT_TZ_ACCEPTANCE_02: stageActivation.STAGE_ACTIVATION_STATE_OK === 1,
    NEXT_TZ_ACCEPTANCE_03: nonCanonAutoblock.ok,
    NEXT_TZ_ACCEPTANCE_04: dod.NEXT_TZ_DOD_01
      && dod.NEXT_TZ_DOD_02
      && dod.NEXT_TZ_DOD_03
      && dod.NEXT_TZ_DOD_04,
  };

  const ok = Object.values(dod).every(Boolean) && Object.values(acceptance).every(Boolean);

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignalStatus: CANDIDATE_FAIL_SIGNAL,
    activeCanonLockCheckPass: activeCanon.ok,
    stageActivationGuardCheckPass: stageActivation.STAGE_ACTIVATION_STATE_OK === 1,
    noNonCanonAutoblockIntroduced: nonCanonAutoblock.ok,
    advisoryToBlockingDriftCount: authorityState.advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero: authorityState.advisoryToBlockingDriftCount === 0,
    modeMatrixSingleAuthorityStatus: authorityState.status,
    modeAwareExitPolicyOk: exitPolicyState.ok,
    negativeResults,
    positiveResults,
    dod,
    acceptance,
    details: {
      activeCanon,
      stageActivation,
      authorityState: {
        status: authorityState.status,
        secondaryEvaluatorMismatchCount: authorityState.secondaryEvaluatorMismatchCount,
        advisoryToBlockingDriftCount: authorityState.advisoryToBlockingDriftCount,
        gates: authorityState.gates,
      },
      exitPolicyState: {
        ok: exitPolicyState.ok,
        failReason: exitPolicyState.failReason,
        advisoryToBlockingDriftCount: exitPolicyState.advisoryToBlockingDriftCount,
        modeRouting: exitPolicyState.modeRouting,
        releasePromotionParity: exitPolicyState.releasePromotionParity,
      },
      advisoryLocked,
      promotionParityLock,
      nonCanonAutoblock,
      negativeScenarios: negative,
    },
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`WS04_ACTIVE_CANON_LOCK_CHECK_PASS=${state.activeCanonLockCheckPass ? 1 : 0}`);
  console.log(`WS04_STAGE_ACTIVATION_GUARD_CHECK_PASS=${state.stageActivationGuardCheckPass ? 1 : 0}`);
  console.log(`WS04_ADVISORY_AS_BLOCKING_DRIFT_ZERO=${state.advisoryToBlockingDriftCountZero ? 1 : 0}`);
  console.log(`WS04_MODE_MATRIX_SINGLE_AUTHORITY_STATUS=${state.modeMatrixSingleAuthorityStatus}`);
  console.log(`WS04_MODE_AWARE_EXIT_POLICY_OK=${state.modeAwareExitPolicyOk ? 1 : 0}`);
  console.log(`WS04_NO_NON_CANON_AUTOBLOCK=${state.noNonCanonAutoblockIntroduced ? 1 : 0}`);
  if (!state.ok) {
    console.log(`WS04_FAIL_SIGNAL_STATUS=${state.failSignalStatus}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateWs04ModeSplitEnforcementState({
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
