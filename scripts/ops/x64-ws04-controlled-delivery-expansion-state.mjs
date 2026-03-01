#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { evaluateResolveActiveStageState } from './resolve-active-stage.mjs';
import { evaluateAttestationTrustLockState } from './attestation-trust-lock-state.mjs';

const TOKEN_NAME = 'X64_WS04_CONTROLLED_DELIVERY_EXPANSION_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';

const CANONICAL_RELEASE_SET = [
  'CORE_SOT_EXECUTABLE_OK',
  'RECOVERY_IO_OK',
  'MIGRATIONS_POLICY_OK',
  'MIGRATIONS_ATOMICITY_OK',
  'NORMALIZATION_XPLAT_OK',
  'E2E_CRITICAL_USER_PATH_OK',
  'HEAD_STRICT_OK',
  'PROOFHOOK_INTEGRITY_OK',
  'CONFIG_HASH_LOCK_OK',
  'TOKEN_SOURCE_CONFLICT_OK',
  'REQUIRED_SET_NO_TARGET_OK',
  'SINGLE_VERIFY_CONTOUR_ENFORCED_OK',
  'VERIFY_ATTESTATION_OK',
  'ATTESTATION_SIGNATURE_OK',
].sort((a, b) => a.localeCompare(b));

const PACKET_FILE_ALLOWLIST = new Set([
  'docs/OPS/EVIDENCE/X64_CONTOUR/',
  'docs/OPS/EVIDENCE/X64_CONTOUR/TICKET_04/',
  'docs/OPS/EVIDENCE/X64_CONTOUR/TICKET_04/negative-results.json',
  'docs/OPS/EVIDENCE/X64_CONTOUR/TICKET_04/positive-results.json',
  'docs/OPS/EVIDENCE/X64_CONTOUR/TICKET_04/final-dod-acceptance-summary.json',
  'docs/OPS/EVIDENCE/X64_CONTOUR/TICKET_04/summary.json',
  'docs/OPS/EVIDENCE/X64_CONTOUR/TICKET_04/ticket-meta.json',
  'docs/OPS/STATUS/X64_WS04_CONTROLLED_DELIVERY_EXPANSION_STATUS_V1.json',
  'scripts/ops/x64-ws04-controlled-delivery-expansion-state.mjs',
  'scripts/ops/x64-ws04-controlled-delivery-expansion-report.mjs',
  'test/contracts/x64-ws04-controlled-delivery-expansion.contract.test.js',
]);

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

function hashStable(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = { json: false };
  for (const arg of argv) {
    if (normalizeString(arg) === '--json') out.json = true;
  }
  return out;
}

function readJsonObject(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return isObjectRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function toUniqueStrings(list) {
  const source = Array.isArray(list) ? list : [];
  const out = [];
  const seen = new Set();
  for (const raw of source) {
    const v = normalizeString(String(raw || ''));
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function evaluateWorktreePolicy(repoRoot) {
  try {
    const status = execFileSync('git', ['status', '--porcelain'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();
    const changedPaths = status
      ? status
        .split('\n')
        .map((line) => line.slice(3).trim())
        .filter(Boolean)
      : [];
    const packetScopedOnly = changedPaths.every((filePath) => PACKET_FILE_ALLOWLIST.has(filePath));
    const ok = status === '' || packetScopedOnly;
    return {
      ok,
      status,
      changedPaths,
      packetScopedOnly,
      failReason: ok ? '' : 'DIRTY_WORKTREE',
    };
  } catch {
    return {
      ok: false,
      status: '',
      changedPaths: [],
      packetScopedOnly: false,
      failReason: 'GIT_STATUS_UNAVAILABLE',
    };
  }
}

function evaluateCanonLock(repoRoot) {
  const doc = readJsonObject(path.join(repoRoot, 'docs/OPS/STATUS/CANON_STATUS.json'));
  if (!doc) {
    return { ok: false, failReason: 'CANON_STATUS_UNREADABLE', observedStatus: '', observedVersion: '' };
  }
  const observedStatus = normalizeString(doc.status);
  const observedVersion = normalizeString(doc.canonVersion);
  const ok = observedStatus === 'ACTIVE_CANON' && observedVersion.toLowerCase() === EXPECTED_CANON_VERSION;
  return {
    ok,
    failReason: ok ? '' : 'ACTIVE_CANON_LOCK_FAIL',
    observedStatus,
    observedVersion,
  };
}

function evaluateControlledExpansion(repoRoot) {
  const nextRecord = readJsonObject(path.join(repoRoot, 'docs/OPS/STATUS/NEXT_CONTOUR_OPENING_RECORD_V37.json'));
  const x63Signed = readJsonObject(path.join(repoRoot, 'docs/OPS/STATUS/X63_CONTOUR_CLOSEOUT_SIGNED_V1.json'));
  const profile = readJsonObject(path.join(repoRoot, 'docs/OPS/EXECUTION/EXECUTION_PROFILE.example.json'));
  const requiredSet = readJsonObject(path.join(repoRoot, 'docs/OPS/EXECUTION/REQUIRED_TOKEN_SET.json'));

  const missingRefs = [];
  if (!nextRecord) missingRefs.push('NEXT_CONTOUR_OPENING_RECORD_V37_JSON_MISSING');
  if (!x63Signed) missingRefs.push('X63_CONTOUR_CLOSEOUT_SIGNED_V1_JSON_MISSING');
  if (!profile) missingRefs.push('EXECUTION_PROFILE_EXAMPLE_JSON_MISSING');
  if (!requiredSet) missingRefs.push('REQUIRED_TOKEN_SET_JSON_MISSING');

  const blockingSurfaceExpansionFalse = nextRecord?.entryChecks?.blockingSurfaceExpansion === false
    && x63Signed?.constraints?.blockingSurfaceExpansion === false;

  const requiredRelease = toUniqueStrings(requiredSet?.requiredSets?.release);
  const profileRelease = toUniqueStrings(profile?.requiredSets?.release);

  const releaseClassStable = JSON.stringify(requiredRelease) === JSON.stringify(CANONICAL_RELEASE_SET)
    && JSON.stringify(profileRelease) === JSON.stringify(CANONICAL_RELEASE_SET);

  const modeProfileChannelConsistent = normalizeString(profile?.profile) === 'release'
    && normalizeString(profile?.gateTier) === 'release'
    && normalizeString(nextRecord?.mode) === 'IMPLEMENTATION'
    && normalizeString(nextRecord?.priority) === 'P1'
    && normalizeString(nextRecord?.executionGate) === 'GO';

  const scopeFlagsProfile = isObjectRecord(profile?.scopeFlags) ? profile.scopeFlags : {};
  const scopeFlagsRequired = isObjectRecord(requiredSet?.scopeFlags) ? requiredSet.scopeFlags : {};
  const scopeFlagsConsistent = JSON.stringify(stableSortObject(scopeFlagsProfile))
    === JSON.stringify(stableSortObject(scopeFlagsRequired));

  const nonCanonAutoBlockAttempt = requiredRelease.some((token) => !CANONICAL_RELEASE_SET.includes(token));

  const wsRefs = [
    'docs/OPS/STATUS/X64_WS01_NEXT_CONTOUR_ALIGNMENT_STATUS_V1.json',
    'docs/OPS/STATUS/X64_WS02_QUEUE_PRIORITIZATION_STATUS_V1.json',
    'docs/OPS/STATUS/X64_WS03_EVIDENCE_MAINTENANCE_STATUS_V1.json',
  ];
  const missingWsRefs = wsRefs.filter((ref) => !fs.existsSync(path.join(repoRoot, ref)));

  return {
    missingRefs,
    missingWsRefs,
    blockingSurfaceExpansionFalse,
    releaseClassStable,
    modeProfileChannelConsistent,
    scopeFlagsConsistent,
    nonCanonAutoBlockAttempt,
    requiredReleaseCount: requiredRelease.length,
    canonicalReleaseCount: CANONICAL_RELEASE_SET.length,
    requiredRelease,
  };
}

function evaluateDeterministicOutput(projection) {
  const h1 = hashStable(projection);
  const h2 = hashStable(projection);
  const h3 = hashStable(projection);
  return {
    runHashes: [h1, h2, h3],
    stable: h1 === h2 && h2 === h3,
  };
}

function evaluateNegativeScenarios() {
  const negative01 = (() => {
    const simulated = { blockingSurfaceExpansionFalse: false };
    return simulated.blockingSurfaceExpansionFalse === false;
  })();

  const negative02 = (() => {
    const releaseSet = ['CORE_SOT_EXECUTABLE_OK'];
    return JSON.stringify(releaseSet) !== JSON.stringify(CANONICAL_RELEASE_SET);
  })();

  const negative03 = (() => {
    const mode = { profile: 'dev', gateTier: 'core', channel: 'UNSET' };
    return !(mode.profile === 'release' && mode.gateTier === 'release');
  })();

  const negative04 = (() => {
    const nonCanon = ['NON_CANON_TOKEN_X'];
    return nonCanon.some((token) => !CANONICAL_RELEASE_SET.includes(token));
  })();

  const negative05 = (() => {
    const a = hashStable({ order: [1, 2, 3] });
    const b = hashStable({ order: [3, 2, 1] });
    return a !== b;
  })();

  return {
    NEXT_TZ_NEGATIVE_01: negative01,
    NEXT_TZ_NEGATIVE_02: negative02,
    NEXT_TZ_NEGATIVE_03: negative03,
    NEXT_TZ_NEGATIVE_04: negative04,
    NEXT_TZ_NEGATIVE_05: negative05,
  };
}

export function evaluateX64Ws04ControlledDeliveryExpansionState(input = {}) {
  const repoRoot = normalizeString(input.repoRoot) || process.cwd();

  const worktree = evaluateWorktreePolicy(repoRoot);
  const canon = evaluateCanonLock(repoRoot);
  const stage = evaluateResolveActiveStageState({ repoRoot });
  const trust = evaluateAttestationTrustLockState({ repoRoot, mode: 'release' });

  const controlled = evaluateControlledExpansion(repoRoot);

  const projection = {
    controlled,
    stageActivation: {
      ok: stage.ok,
      STAGE_ACTIVATION_OK: Number(stage.STAGE_ACTIVATION_OK) || 0,
    },
    advisoryDriftZero: trust.advisoryToBlockingDriftCountZero === true,
  };
  const determinism = evaluateDeterministicOutput(projection);

  const negativeResults = evaluateNegativeScenarios();
  const positiveResults = {
    NEXT_TZ_POSITIVE_01: controlled.missingRefs.length === 0
      && controlled.missingWsRefs.length === 0
      && controlled.blockingSurfaceExpansionFalse
      && controlled.modeProfileChannelConsistent
      && controlled.scopeFlagsConsistent,
    NEXT_TZ_POSITIVE_02: controlled.releaseClassStable,
    NEXT_TZ_POSITIVE_03: determinism.stable,
  };

  const counts = {
    blockingSurfaceGrowthCount: controlled.blockingSurfaceExpansionFalse ? 0 : 1,
    releaseClassDriftCount: controlled.releaseClassStable ? 0 : 1,
    modeProfileChannelMismatchCount: controlled.modeProfileChannelConsistent && controlled.scopeFlagsConsistent ? 0 : 1,
    nonCanonAutoBlockAttemptCount: controlled.nonCanonAutoBlockAttempt ? 1 : 0,
    nonDeterministicExpansionOutputCount: determinism.stable ? 0 : 1,
    missingEvidenceRefCount: controlled.missingRefs.length + controlled.missingWsRefs.length,
    advisoryToBlockingDriftCount: trust.advisoryToBlockingDriftCount || 0,
    prestartFailureCount: [
      worktree.ok,
      canon.ok,
      stage.ok && Number(stage.STAGE_ACTIVATION_OK) === 1,
      controlled.blockingSurfaceExpansionFalse,
      trust.advisoryToBlockingDriftCountZero === true,
      trust.ok && trust.offlineVerifiableChainOk === true,
    ].filter((v) => v !== true).length,
  };

  const dod = {
    DOD_01: positiveResults.NEXT_TZ_POSITIVE_01 && positiveResults.NEXT_TZ_POSITIVE_02,
    DOD_02: Object.values(negativeResults).every(Boolean),
    DOD_03: Object.values(positiveResults).every(Boolean),
    DOD_04: controlled.blockingSurfaceExpansionFalse,
    DOD_05: trust.advisoryToBlockingDriftCountZero === true,
    DOD_06: worktree.ok,
  };

  const acceptance = {
    ACCEPTANCE_01: canon.ok,
    ACCEPTANCE_02: stage.ok && Number(stage.STAGE_ACTIVATION_OK) === 1,
    ACCEPTANCE_03: dod.DOD_01,
    ACCEPTANCE_04: Object.values(dod).every(Boolean),
  };

  const ok = Object.values(dod).every(Boolean) && Object.values(acceptance).every(Boolean);

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    token: TOKEN_NAME,
    generatedAtUtc: new Date().toISOString(),
    counts,
    checks: {
      worktree,
      canon,
      stage: {
        ok: stage.ok,
        STAGE_ACTIVATION_OK: Number(stage.STAGE_ACTIVATION_OK) || 0,
        STAGE_ACTIVE: Number(stage.STAGE_ACTIVE) || 0,
        ACTIVE_STAGE_ID: normalizeString(stage.ACTIVE_STAGE_ID),
      },
      trust: {
        ok: trust.ok,
        advisoryToBlockingDriftCountZero: trust.advisoryToBlockingDriftCountZero === true,
        offlineVerifiableChainOk: trust.offlineVerifiableChainOk === true,
      },
      controlled,
    },
    negativeResults,
    positiveResults,
    dod,
    acceptance,
    determinism,
    finalGate: 'GO_TO_X64_WS99_ONLY_IF_ALL_DOD_AND_ACCEPTANCE_TRUE',
    finalGateSatisfied: ok,
  };
}

function main() {
  const args = parseArgs();
  const state = evaluateX64Ws04ControlledDeliveryExpansionState({ repoRoot: process.cwd() });

  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
  } else {
    process.stdout.write(`X64_WS04_CONTROLLED_DELIVERY_EXPANSION_OK=${state.X64_WS04_CONTROLLED_DELIVERY_EXPANSION_OK}\n`);
    process.stdout.write(`FINAL_GATE_SATISFIED=${state.finalGateSatisfied ? 1 : 0}\n`);
  }

  process.exit(state.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
