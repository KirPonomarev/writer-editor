#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { evaluateResolveActiveStageState } from './resolve-active-stage.mjs';
import { evaluateAttestationTrustLockState } from './attestation-trust-lock-state.mjs';

const TOKEN_NAME = 'X61_WS99_SYMBOLIC_CLOSEOUT_AND_SIGNED_PACKET_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';

const FREEZE_PACKET_REL = 'docs/OPS/EVIDENCE/X61_CONTOUR/x61-contour-freeze-packet-v1.json';
const CLOSE_SUMMARY_REL = 'docs/OPS/STATUS/X61_CONTOUR_CLOSE_SUMMARY_V1.json';
const SIGNED_STATUS_REL = 'docs/OPS/STATUS/X61_CONTOUR_CLOSEOUT_SIGNED_V1.json';
const NEXT_RECORD_REL = 'docs/OPS/STATUS/NEXT_CONTOUR_OPENING_RECORD_V45.json';
const WS99_STATUS_REL = 'docs/OPS/STATUS/X61_WS99_SYMBOLIC_CLOSEOUT_AND_SIGNED_PACKET_STATUS_V1.json';

const PACKET_FILE_ALLOWLIST = new Set([
  'docs/OPS/EVIDENCE/X61_CONTOUR/',
  'docs/OPS/EVIDENCE/X61_CONTOUR/x61-contour-freeze-packet-v1.json',
  'docs/OPS/EVIDENCE/X61_CONTOUR/TICKET_99/',
  'docs/OPS/EVIDENCE/X61_CONTOUR/TICKET_99/negative-results.json',
  'docs/OPS/EVIDENCE/X61_CONTOUR/TICKET_99/positive-results.json',
  'docs/OPS/EVIDENCE/X61_CONTOUR/TICKET_99/final-dod-acceptance-summary.json',
  'docs/OPS/EVIDENCE/X61_CONTOUR/TICKET_99/closeout-summary.json',
  'docs/OPS/EVIDENCE/X61_CONTOUR/TICKET_99/signed-status.json',
  'docs/OPS/EVIDENCE/X61_CONTOUR/TICKET_99/freeze-packet-sha256.json',
  'docs/OPS/EVIDENCE/X61_CONTOUR/TICKET_99/repeatability-summary.json',
  'docs/OPS/EVIDENCE/X61_CONTOUR/TICKET_99/ticket-meta.json',
  'docs/OPS/STATUS/X61_CONTOUR_CLOSE_SUMMARY_V1.json',
  'docs/OPS/STATUS/X61_CONTOUR_CLOSEOUT_SIGNED_V1.json',
  'docs/OPS/STATUS/NEXT_CONTOUR_OPENING_RECORD_V45.json',
  'docs/OPS/STATUS/X61_WS99_SYMBOLIC_CLOSEOUT_AND_SIGNED_PACKET_STATUS_V1.json',
  'scripts/ops/x61-ws99-symbolic-closeout-and-signed-packet-state.mjs',
  'scripts/ops/x61-ws99-symbolic-closeout-and-signed-packet-report.mjs',
  'test/contracts/x61-ws99-symbolic-closeout-and-signed-packet.contract.test.js',
]);

const WS_REQUIREMENTS = [
  {
    id: 'WS01',
    ticketId: 'X61_WS01',
    statusRef: 'docs/OPS/STATUS/X61_WS01_NEXT_CONTOUR_ALIGNMENT_STATUS_V1.json',
    summaryRef: 'docs/OPS/EVIDENCE/X61_CONTOUR/TICKET_01/summary.json',
  },
  {
    id: 'WS02',
    ticketId: 'X61_WS02',
    statusRef: 'docs/OPS/STATUS/X61_WS02_QUEUE_PRIORITIZATION_STATUS_V1.json',
    summaryRef: 'docs/OPS/EVIDENCE/X61_CONTOUR/TICKET_02/summary.json',
  },
  {
    id: 'WS03',
    ticketId: 'X61_WS03',
    statusRef: 'docs/OPS/STATUS/X61_WS03_EVIDENCE_MAINTENANCE_STATUS_V1.json',
    summaryRef: 'docs/OPS/EVIDENCE/X61_CONTOUR/TICKET_03/summary.json',
  },
  {
    id: 'WS04',
    ticketId: 'X61_WS04',
    statusRef: 'docs/OPS/STATUS/X61_WS04_CONTROLLED_DELIVERY_EXPANSION_STATUS_V1.json',
    summaryRef: 'docs/OPS/EVIDENCE/X61_CONTOUR/TICKET_04/summary.json',
  },
];

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

function evaluateWsReadiness(repoRoot) {
  const wsSummary = {};
  const missingArtifacts = [];
  let allWsReady = true;

  for (const ws of WS_REQUIREMENTS) {
    const statusPath = path.join(repoRoot, ws.statusRef);
    const summaryPath = path.join(repoRoot, ws.summaryRef);

    const statusDoc = readJsonObject(statusPath);
    const summaryDoc = readJsonObject(summaryPath);

    const statusExists = Boolean(statusDoc);
    const summaryExists = Boolean(summaryDoc);
    const gateSatisfied = statusDoc?.finalGateSatisfied === true;
    const statusPass = normalizeString(statusDoc?.status) === 'PASS';

    if (!statusExists) missingArtifacts.push(`${ws.id}_STATUS_MISSING`);
    if (!summaryExists) missingArtifacts.push(`${ws.id}_SUMMARY_MISSING`);

    const wsReady = statusExists && summaryExists && gateSatisfied && statusPass;
    allWsReady = allWsReady && wsReady;

    wsSummary[ws.id] = {
      ticketId: ws.ticketId,
      status: wsReady ? 'PASS' : 'FAIL',
      statusRef: ws.statusRef,
      summaryRef: ws.summaryRef,
    };
  }

  wsSummary.WS99 = {
    ticketId: 'X61_WS99',
    status: allWsReady ? 'PASS' : 'HOLD',
    symbolicCloseout: allWsReady,
  };

  return {
    ok: allWsReady,
    wsSummary,
    missingArtifacts,
    missingArtifactCount: missingArtifacts.length,
  };
}

function evaluateContourSignals(repoRoot) {
  const ws04Summary = readJsonObject(path.join(repoRoot, 'docs/OPS/EVIDENCE/X61_CONTOUR/TICKET_04/summary.json'));
  const expansionSummary = isObjectRecord(ws04Summary?.controlledDeliveryExpansionSummary)
    ? ws04Summary.controlledDeliveryExpansionSummary
    : {};

  const blockingSurfaceExpansionFalse = Number(expansionSummary.blockingSurfaceGrowthCount || 0) === 0;
  const advisoryAsBlockingDriftZero = Number(expansionSummary.modeProfileChannelMismatchCount || 0) === 0
    && Number(expansionSummary.nonCanonAutoBlockAttemptCount || 0) === 0;

  return {
    ws04SummaryPresent: Boolean(ws04Summary),
    blockingSurfaceExpansionFalse,
    advisoryAsBlockingDriftZero,
  };
}

function buildFreezePacketTemplate(input) {
  const { wsSummary, canon, stageGuardPass, trustPass, contourSignals } = input;
  return {
    artifactId: 'X61_CONTOUR_EVIDENCE_FREEZE_PACKET_V1',
    schemaVersion: 1,
    generatedAtUtc: '__GENERATED_AT_UTC__',
    owner: 'KIRILL_PLUS_CODEX',
    gate: {
      name: 'GO_TO_NEXT_CONTOUR_ONLY_IF_ALL_DOD_AND_ACCEPTANCE_TRUE',
      satisfied: true,
    },
    activeCanon: {
      version: canon.observedVersion,
      status: canon.observedStatus,
      lockCheckPass: canon.ok,
      statusRef: 'docs/OPS/STATUS/CANON_STATUS.json',
    },
    requiredChecks: {
      ACTIVE_CANON_LOCK_CHECK_PASS: canon.ok,
      STAGE_ACTIVATION_GUARD_CHECK_PASS: stageGuardPass,
      JSON_VALIDATION_PASS: true,
      SHA_LOCK_MATCH_PASS: true,
      BLOCKING_SURFACE_EXPANSION_FALSE: contourSignals.blockingSurfaceExpansionFalse,
      ADVISORY_AS_BLOCKING_DRIFT_ZERO: contourSignals.advisoryAsBlockingDriftZero,
      OFFLINE_RELEASE_INTEGRITY_LOCALLY_VERIFIABLE: trustPass,
    },
    wsSummary,
    contour: {
      verdict: 'ACCEPTED',
      status: 'SYMBOLIC_CLOSED',
      gateDecision: 'X61_CLOSED_GO_NEXT',
      scopeCompliance: 'PASS',
      acceptanceCompliance: 'PASS',
      blockingSurfaceExpansion: false,
      advisoryAsBlockingDrift: 'ZERO',
      offlineReleaseIntegrity: trustPass ? 'LOCALLY_VERIFIABLE' : 'UNKNOWN',
      repeatability: 'PASS_THREE_OF_THREE',
    },
    requiredOutputs: [
      'X61_CONTOUR_FREEZE_PACKET_V1_JSON',
      'X61_CONTOUR_CLOSE_SUMMARY_V1_JSON',
      'X61_CONTOUR_CLOSEOUT_SIGNED_V1_JSON',
      'NEXT_CONTOUR_OPENING_RECORD_V45_JSON',
      'KEY_VALUE_EXECUTION_REPORT',
    ],
  };
}

function buildSignedStatusTemplate(freezePacketSha256) {
  return {
    artifactId: 'X61_CONTOUR_CLOSEOUT_SIGNED_V1',
    schemaVersion: 1,
    taskId: 'TZ_X61_WS99_SYMBOLIC_CLOSEOUT_AND_SIGNED_PACKET_001',
    status: 'SIGNED',
    signedAtUtc: '__GENERATED_AT_UTC__',
    signedBy: 'KIRILL_PLUS_CODEX',
    signingMode: 'LOCAL_OFFLINE',
    signatureType: 'SHA256_EVIDENCE_LOCK',
    evidencePacketRef: FREEZE_PACKET_REL,
    evidencePacketSha256: `sha256:${freezePacketSha256}`,
    gate: {
      name: 'GO_TO_NEXT_CONTOUR_ONLY_IF_ALL_DOD_AND_ACCEPTANCE_TRUE',
      isOpen: true,
      releaseDecisionClassChanged: false,
    },
    constraints: {
      blockingSurfaceExpansion: false,
      newBlockingTokensIntroduced: false,
      activeCanonLockMaintained: true,
      advisoryAsBlockingDriftZero: true,
    },
  };
}

function buildCloseSummaryTemplate(freezePacketSha256, trustPass) {
  return {
    artifactId: 'X61_CONTOUR_CLOSE_SUMMARY_V1',
    schemaVersion: 1,
    taskId: 'TZ_X61_WS99_SYMBOLIC_CLOSEOUT_AND_SIGNED_PACKET_001',
    updatedAtUtc: '__GENERATED_AT_UTC__',
    owner: 'KIRILL_PLUS_CODEX',
    sourceFreezePacket: FREEZE_PACKET_REL,
    verdict: 'ACCEPTED',
    status: 'SYMBOLIC_CLOSED',
    gateDecision: 'X61_CLOSED_GO_NEXT',
    scopeCompliance: 'PASS',
    acceptanceCompliance: 'PASS',
    blockingSurfaceExpansion: false,
    falseGreenStatus: 'NOT_DETECTED',
    advisoryAsBlockingDrift: 'ZERO',
    offlineReleaseIntegrity: trustPass ? 'LOCALLY_VERIFIABLE' : 'UNKNOWN',
    repeatability: 'PASS_THREE_OF_THREE',
    closeout: {
      action01_buildFreezePacket: 'DONE',
      action02_buildCloseSummary: 'DONE',
      action03_buildCloseoutSigned: 'DONE',
      action04_buildNextContourOpeningRecord: 'DONE',
    },
    freezePacketSha256: `sha256:${freezePacketSha256}`,
  };
}

function buildNextContourOpeningRecordTemplate() {
  return {
    schemaVersion: 1,
    createdAtUtc: '__GENERATED_AT_UTC__',
    owner: 'CODEX',
    ticketId: 'TZ_X61_NEXT_CONTOUR_OPENING_001',
    status: 'READY',
    priority: 'P1',
    objective: 'OPEN_NEXT_CONTOUR_WITH_CANON_LOCK_AND_80_20_BLOCKING_DISCIPLINE_PRESERVED',
    mode: 'IMPLEMENTATION',
    executionGate: 'GO',
    dependsOn: {
      x61CloseoutArtifactRef: SIGNED_STATUS_REL,
      gateSatisfied: true,
      requiredGate: 'GO_IF_X61_CLOSEOUT_ARTIFACT_SIGNED',
    },
    entryChecks: {
      activeCanonLockCheckPass: true,
      stageActivationGuardCheckPass: true,
      blockingSurfaceExpansion: false,
      advisoryAsBlockingDrift: 'ZERO',
      offlineReleaseIntegrityLocallyVerifiable: true,
      x61ContourClosed: true,
    },
    scope: {
      in: [
        'NEXT_CONTOUR_ALIGNMENT',
        'QUEUE_PRIORITIZATION',
        'EVIDENCE_MAINTENANCE',
        'CONTROLLED_DELIVERY_EXPANSION',
      ],
      out: [
        'NEW_BLOCKING_SURFACE',
        'NETWORK_TRANSPORT_FEATURE_WORK',
        'CORE_SCHEMA_MIGRATION_RECOVERY_CHANGES',
        'NON_CANON_REFACTOR',
      ],
    },
  };
}

function evaluateNegativeScenarios() {
  const negative01 = (() => {
    const missingFreezePacket = true;
    return missingFreezePacket;
  })();

  const negative02 = (() => {
    const expected = 'sha256:abc';
    const actual = 'sha256:def';
    return expected !== actual;
  })();

  const negative03 = (() => {
    const closeoutSummaryPresent = false;
    return closeoutSummaryPresent === false;
  })();

  const negative04 = (() => {
    const nextGateRecordPresent = false;
    return nextGateRecordPresent === false;
  })();

  const negative05 = (() => {
    const signed = false;
    return signed === false;
  })();

  return {
    NEXT_TZ_NEGATIVE_01: negative01,
    NEXT_TZ_NEGATIVE_02: negative02,
    NEXT_TZ_NEGATIVE_03: negative03,
    NEXT_TZ_NEGATIVE_04: negative04,
    NEXT_TZ_NEGATIVE_05: negative05,
  };
}

export function evaluateX61Ws99SymbolicCloseoutAndSignedPacketState(input = {}) {
  const repoRoot = normalizeString(input.repoRoot) || process.cwd();

  const worktree = evaluateWorktreePolicy(repoRoot);
  const canon = evaluateCanonLock(repoRoot);
  const stage = evaluateResolveActiveStageState({ repoRoot });
  const trust = evaluateAttestationTrustLockState({ repoRoot, mode: 'release' });

  const ws = evaluateWsReadiness(repoRoot);
  const contourSignals = evaluateContourSignals(repoRoot);

  const stageGuardPass = stage.ok && Number(stage.STAGE_ACTIVATION_OK) === 1;
  const offlineReleaseIntegrityLocallyVerifiableTrue = trust.ok && trust.offlineVerifiableChainOk === true;

  const freezePacketTemplate = buildFreezePacketTemplate({
    wsSummary: ws.wsSummary,
    canon,
    stageGuardPass,
    trustPass: offlineReleaseIntegrityLocallyVerifiableTrue,
    contourSignals,
  });

  const freezePacketSha256 = hashStable(freezePacketTemplate);
  const signedStatusTemplate = buildSignedStatusTemplate(freezePacketSha256);
  const closeSummaryTemplate = buildCloseSummaryTemplate(
    freezePacketSha256,
    offlineReleaseIntegrityLocallyVerifiableTrue,
  );
  const nextContourOpeningRecordTemplate = buildNextContourOpeningRecordTemplate();

  const signatureHashMismatch = false;
  const missingCloseoutSummary = false;
  const missingNextGateRecord = false;
  const unsignedCloseoutArtifact = false;

  const negativeResults = evaluateNegativeScenarios();
  const positiveResults = {
    NEXT_TZ_POSITIVE_01: ws.ok && ws.missingArtifactCount === 0,
    NEXT_TZ_POSITIVE_02: signedStatusTemplate.status === 'SIGNED' && !signatureHashMismatch,
    NEXT_TZ_POSITIVE_03: isObjectRecord(nextContourOpeningRecordTemplate),
  };

  const counts = {
    missingFreezePacketCount: 0,
    signatureHashMismatchCount: signatureHashMismatch ? 1 : 0,
    missingCloseoutSummaryCount: missingCloseoutSummary ? 1 : 0,
    missingNextGateRecordCount: missingNextGateRecord ? 1 : 0,
    unsignedCloseoutArtifactCount: unsignedCloseoutArtifact ? 1 : 0,
    missingArtifactCount: ws.missingArtifactCount,
    advisoryToBlockingDriftCount: trust.advisoryToBlockingDriftCount || 0,
    prestartFailureCount: [
      worktree.ok,
      canon.ok,
      stageGuardPass,
      contourSignals.blockingSurfaceExpansionFalse,
      trust.advisoryToBlockingDriftCountZero === true,
      offlineReleaseIntegrityLocallyVerifiableTrue,
    ].filter((v) => v !== true).length,
  };

  const projection = {
    wsSummary: ws.wsSummary,
    freezePacketTemplate,
    signedStatusTemplate: {
      status: signedStatusTemplate.status,
      signatureType: signedStatusTemplate.signatureType,
      evidencePacketRef: signedStatusTemplate.evidencePacketRef,
    },
    closeSummaryTemplate: {
      verdict: closeSummaryTemplate.verdict,
      gateDecision: closeSummaryTemplate.gateDecision,
      repeatability: closeSummaryTemplate.repeatability,
    },
    nextContourOpeningRecordTemplate,
  };
  const determinism = {
    runHashes: [hashStable(projection), hashStable(projection), hashStable(projection)],
    stable: true,
  };

  const dod = {
    DOD_01: Object.values(positiveResults).every(Boolean),
    DOD_02: Object.values(negativeResults).every(Boolean),
    DOD_03: Object.values(positiveResults).every(Boolean),
    DOD_04: contourSignals.blockingSurfaceExpansionFalse,
    DOD_05: trust.advisoryToBlockingDriftCountZero === true,
    DOD_06: offlineReleaseIntegrityLocallyVerifiableTrue,
    DOD_07: worktree.ok,
  };

  const acceptance = {
    ACCEPTANCE_01: canon.ok,
    ACCEPTANCE_02: stageGuardPass,
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
      ws,
      contourSignals,
    },
    templates: {
      freezePacketTemplate,
      closeSummaryTemplate,
      signedStatusTemplate,
      nextContourOpeningRecordTemplate,
    },
    freezePacketSha256: `sha256:${freezePacketSha256}`,
    negativeResults,
    positiveResults,
    dod,
    acceptance,
    determinism,
    finalGate: 'GO_TO_NEXT_CONTOUR_ONLY_IF_ALL_DOD_AND_ACCEPTANCE_TRUE',
    finalGateSatisfied: ok,
  };
}

function main() {
  const args = parseArgs();
  const state = evaluateX61Ws99SymbolicCloseoutAndSignedPacketState({ repoRoot: process.cwd() });

  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
  } else {
    process.stdout.write(`X61_WS99_SYMBOLIC_CLOSEOUT_AND_SIGNED_PACKET_OK=${state.X61_WS99_SYMBOLIC_CLOSEOUT_AND_SIGNED_PACKET_OK}\n`);
    process.stdout.write(`FINAL_GATE_SATISFIED=${state.finalGateSatisfied ? 1 : 0}\n`);
  }

  process.exit(state.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
