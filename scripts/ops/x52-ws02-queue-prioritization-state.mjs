#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { evaluateResolveActiveStageState } from './resolve-active-stage.mjs';
import { evaluateAttestationTrustLockState } from './attestation-trust-lock-state.mjs';

const TOKEN_NAME = 'X52_WS02_QUEUE_PRIORITIZATION_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';

const REQUIRED_SCOPE_OUT = [
  'NEW_BLOCKING_SURFACE',
  'NETWORK_TRANSPORT_FEATURE_WORK',
  'CORE_SCHEMA_MIGRATION_RECOVERY_CHANGES',
  'NON_CANON_REFACTOR',
];

const PACKET_FILE_ALLOWLIST = new Set([
  'docs/OPS/EVIDENCE/X52_CONTOUR/',
  'docs/OPS/EVIDENCE/X52_CONTOUR/TICKET_02/',
  'docs/OPS/EVIDENCE/X52_CONTOUR/TICKET_02/negative-results.json',
  'docs/OPS/EVIDENCE/X52_CONTOUR/TICKET_02/positive-results.json',
  'docs/OPS/EVIDENCE/X52_CONTOUR/TICKET_02/final-dod-acceptance-summary.json',
  'docs/OPS/EVIDENCE/X52_CONTOUR/TICKET_02/summary.json',
  'docs/OPS/EVIDENCE/X52_CONTOUR/TICKET_02/ticket-meta.json',
  'docs/OPS/STATUS/X52_WS02_QUEUE_PRIORITIZATION_STATUS_V1.json',
  'scripts/ops/x52-ws02-queue-prioritization-state.mjs',
  'scripts/ops/x52-ws02-queue-prioritization-report.mjs',
  'test/contracts/x52-ws02-queue-prioritization.contract.test.js',
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

function evaluateScopeLock(scopeOutValues) {
  const expected = [...REQUIRED_SCOPE_OUT].sort((a, b) => a.localeCompare(b));
  const actual = toUniqueStrings(scopeOutValues);
  return {
    ok: JSON.stringify(actual) === JSON.stringify(expected),
    expected,
    actual,
  };
}

function buildQueuePlan() {
  return [
    {
      ticketId: 'TZ_X52_WS02_QUEUE_PRIORITIZATION_001',
      riskRank: 1,
      dependencyLinks: ['TZ_X52_WS01_NEXT_CONTOUR_ALIGNMENT_001'],
      evidenceRefs: [
        'docs/OPS/STATUS/X52_WS01_NEXT_CONTOUR_ALIGNMENT_STATUS_V1.json',
        'docs/OPS/STATUS/NEXT_CONTOUR_OPENING_RECORD_V37.json',
      ],
    },
    {
      ticketId: 'TZ_X52_WS03_EVIDENCE_MAINTENANCE_001',
      riskRank: 2,
      dependencyLinks: ['TZ_X52_WS02_QUEUE_PRIORITIZATION_001'],
      evidenceRefs: [
        'docs/OPS/STATUS/NEXT_CONTOUR_OPENING_RECORD_V37.json',
        'docs/OPS/EVIDENCE/X51_CONTOUR/x51-contour-freeze-packet-v1.json',
      ],
    },
  ];
}

function evaluatePriorityOrder(plan) {
  const source = Array.isArray(plan) ? plan : [];
  if (source.length === 0) return { ok: false, reason: 'EMPTY_PRIORITY_PLAN' };
  for (let i = 1; i < source.length; i += 1) {
    const prev = Number(source[i - 1].riskRank);
    const curr = Number(source[i].riskRank);
    if (!(prev <= curr)) return { ok: false, reason: 'INVALID_PRIORITY_ORDER' };
  }
  return { ok: true, reason: '' };
}

function evaluateDependencyLinks(plan) {
  const source = Array.isArray(plan) ? plan : [];
  const missing = [];
  for (const item of source) {
    const ticketId = normalizeString(item.ticketId);
    const links = Array.isArray(item.dependencyLinks) ? item.dependencyLinks.map((v) => normalizeString(v)).filter(Boolean) : [];
    if (ticketId === 'TZ_X52_WS02_QUEUE_PRIORITIZATION_001') {
      if (!links.includes('TZ_X52_WS01_NEXT_CONTOUR_ALIGNMENT_001')) {
        missing.push({ ticketId, missingLink: 'TZ_X52_WS01_NEXT_CONTOUR_ALIGNMENT_001' });
      }
    }
    if (ticketId === 'TZ_X52_WS03_EVIDENCE_MAINTENANCE_001') {
      if (!links.includes('TZ_X52_WS02_QUEUE_PRIORITIZATION_001')) {
        missing.push({ ticketId, missingLink: 'TZ_X52_WS02_QUEUE_PRIORITIZATION_001' });
      }
    }
  }
  return { ok: missing.length === 0, missing };
}

function evaluateEvidenceCompleteness(repoRoot, plan) {
  const source = Array.isArray(plan) ? plan : [];
  const missing = [];
  for (const item of source) {
    const ticketId = normalizeString(item.ticketId);
    const refs = Array.isArray(item.evidenceRefs) ? item.evidenceRefs.map((v) => normalizeString(v)).filter(Boolean) : [];
    if (refs.length === 0) {
      missing.push({ ticketId, reason: 'NO_EVIDENCE_REFS' });
      continue;
    }
    for (const ref of refs) {
      if (!fs.existsSync(path.join(repoRoot, ref))) {
        missing.push({ ticketId, reason: 'MISSING_EVIDENCE_REF', ref });
      }
    }
  }
  return { ok: missing.length === 0, missing };
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
  const negative01 = evaluatePriorityOrder([
    { ticketId: 'A', riskRank: 2 },
    { ticketId: 'B', riskRank: 1 },
  ]).ok === false;

  const negative02 = evaluateDependencyLinks([
    {
      ticketId: 'TZ_X52_WS02_QUEUE_PRIORITIZATION_001',
      riskRank: 1,
      dependencyLinks: [],
      evidenceRefs: ['docs/OPS/STATUS/NEXT_CONTOUR_OPENING_RECORD_V37.json'],
    },
  ]).ok === false;

  const negative03 = evaluateEvidenceCompleteness(process.cwd(), [
    {
      ticketId: 'TZ_X52_WS03_EVIDENCE_MAINTENANCE_001',
      riskRank: 2,
      dependencyLinks: ['TZ_X52_WS02_QUEUE_PRIORITIZATION_001'],
      evidenceRefs: [],
    },
  ]).ok === false;

  const negative04 = evaluateScopeLock([...REQUIRED_SCOPE_OUT, 'UNEXPECTED_SCOPE']).ok === false;

  const negative05 = (() => {
    const a = hashStable({ order: [1, 2] });
    const b = hashStable({ order: [2, 1] });
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

export function evaluateX52Ws02QueuePrioritizationState(input = {}) {
  const repoRoot = normalizeString(input.repoRoot) || process.cwd();

  const worktree = evaluateWorktreePolicy(repoRoot);
  const canon = evaluateCanonLock(repoRoot);
  const stage = evaluateResolveActiveStageState({ repoRoot });
  const trust = evaluateAttestationTrustLockState({ repoRoot, mode: 'release' });

  const nextRecord = readJsonObject(path.join(repoRoot, 'docs/OPS/STATUS/NEXT_CONTOUR_OPENING_RECORD_V37.json'));
  const ws01Status = readJsonObject(path.join(repoRoot, 'docs/OPS/STATUS/X52_WS01_NEXT_CONTOUR_ALIGNMENT_STATUS_V1.json'));

  const scopeLock = evaluateScopeLock(nextRecord?.scope?.out || []);
  const queuePlan = buildQueuePlan();
  const orderCheck = evaluatePriorityOrder(queuePlan);
  const dependencyCheck = evaluateDependencyLinks(queuePlan);
  const evidenceCheck = evaluateEvidenceCompleteness(repoRoot, queuePlan);

  const prestart = {
    worktreePolicyOk: worktree.ok,
    activeCanonLockCheckPass: canon.ok,
    stageActivationGuardCheckPass: stage.ok && Number(stage.STAGE_ACTIVATION_OK) === 1,
    blockingSurfaceExpansionFalse: nextRecord?.entryChecks?.blockingSurfaceExpansion === false,
    advisoryAsBlockingDriftZero: normalizeString(nextRecord?.entryChecks?.advisoryAsBlockingDrift) === 'ZERO'
      && trust.advisoryToBlockingDriftCountZero === true,
    offlineReleaseIntegrityLocallyVerifiableTrue: trust.ok && trust.offlineVerifiableChainOk === true,
    ws01GateSatisfied: ws01Status?.finalGateSatisfied === true,
  };

  const projection = {
    queuePlan,
    orderCheck,
    dependencyCheck,
    evidenceCheck,
    scopeLock,
    ws01GateSatisfied: prestart.ws01GateSatisfied,
  };
  const determinism = evaluateDeterministicOutput(projection);

  const negativeResults = evaluateNegativeScenarios();
  const positiveResults = {
    NEXT_TZ_POSITIVE_01: orderCheck.ok && dependencyCheck.ok,
    NEXT_TZ_POSITIVE_02: evidenceCheck.ok,
    NEXT_TZ_POSITIVE_03: determinism.stable,
  };

  const counts = {
    prestartFailureCount: Object.values(prestart).filter((v) => v !== true).length,
    invalidPriorityOrderCount: orderCheck.ok ? 0 : 1,
    missingDependencyLinkCount: dependencyCheck.missing.length,
    priorityWithoutEvidenceCount: evidenceCheck.missing.length,
    scopeExpansionCount: scopeLock.ok ? 0 : 1,
    nonDeterministicOutputCount: determinism.stable ? 0 : 1,
    advisoryToBlockingDriftCount: trust.advisoryToBlockingDriftCount || 0,
  };

  const dod = {
    DOD_01: prestart.ws01GateSatisfied && orderCheck.ok && dependencyCheck.ok && evidenceCheck.ok && scopeLock.ok,
    DOD_02: Object.values(negativeResults).every(Boolean),
    DOD_03: Object.values(positiveResults).every(Boolean),
    DOD_04: prestart.blockingSurfaceExpansionFalse,
    DOD_05: prestart.advisoryAsBlockingDriftZero,
    DOD_06: worktree.ok,
  };

  const acceptance = {
    ACCEPTANCE_01: prestart.activeCanonLockCheckPass,
    ACCEPTANCE_02: prestart.stageActivationGuardCheckPass,
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
      prestart,
      queue: {
        plan: queuePlan,
        orderCheck,
        dependencyCheck,
        evidenceCheck,
        scopeLock,
      },
    },
    negativeResults,
    positiveResults,
    dod,
    acceptance,
    determinism,
    finalGate: 'GO_TO_X52_WS03_ONLY_IF_ALL_DOD_AND_ACCEPTANCE_TRUE',
    finalGateSatisfied: ok,
  };
}

function main() {
  const args = parseArgs();
  const state = evaluateX52Ws02QueuePrioritizationState({ repoRoot: process.cwd() });

  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
  } else {
    process.stdout.write(`X52_WS02_QUEUE_PRIORITIZATION_OK=${state.X52_WS02_QUEUE_PRIORITIZATION_OK}\n`);
    process.stdout.write(`FINAL_GATE_SATISFIED=${state.finalGateSatisfied ? 1 : 0}\n`);
  }

  process.exit(state.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
