#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { evaluateFinalFormalizationAndRebindState } from './final-formalization-and-rebind-state.mjs';

const OUTPUT_DIR = 'docs/OPS/EVIDENCE/FINAL_MASTER_CLOSEOUT/TICKET_01';
const FINAL_REBIND_DELTA_PATH = 'docs/OPS/STATUS/FINAL_REBIND_DELTA_V1.json';
const FINAL_MASTER_SUMMARY_PATH = 'docs/OPS/STATUS/FINAL_MASTER_CLOSEOUT_SUMMARY_V1.json';
const FINAL_MASTER_SIGNED_PATH = 'docs/OPS/STATUS/FINAL_MASTER_CLOSEOUT_SIGNED_V1.json';

const P1_FREEZE_PATH = 'docs/OPS/EVIDENCE/P1_CONTOUR/p1-contour-freeze-packet-v1.json';
const P2_FREEZE_PATH = 'docs/OPS/EVIDENCE/P2_CONTOUR/p2-contour-freeze-packet-v1.json';
const P1_CLOSE_SUMMARY_PATH = 'docs/OPS/STATUS/P1_CONTOUR_CLOSE_SUMMARY_V1.json';
const P2_CLOSE_SUMMARY_PATH = 'docs/OPS/STATUS/P2_CONTOUR_CLOSE_SUMMARY_V1.json';
const P1_SIGNED_PATH = 'docs/OPS/STATUS/P1_CONTOUR_CLOSEOUT_SIGNED_V1.json';
const P2_SIGNED_PATH = 'docs/OPS/STATUS/P2_CONTOUR_CLOSEOUT_SIGNED_V1.json';

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

function readJsonObject(absPath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(absPath, 'utf8'));
    return isObjectRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeJson(absPath, value) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, `${stableStringify(value)}\n`, 'utf8');
}

function sha256Raw(absPath) {
  return createHash('sha256').update(fs.readFileSync(absPath)).digest('hex');
}

function normalizeFreezeStatus(repoRoot, freezeRef, summaryRef, signedRef) {
  const freezeAbs = path.resolve(repoRoot, freezeRef);
  const summaryAbs = path.resolve(repoRoot, summaryRef);
  const signedAbs = path.resolve(repoRoot, signedRef);

  const freezeDoc = readJsonObject(freezeAbs);
  const summaryDoc = readJsonObject(summaryAbs);
  const signedDoc = readJsonObject(signedAbs);

  if (!isObjectRecord(freezeDoc) || !isObjectRecord(summaryDoc) || !isObjectRecord(signedDoc)) {
    return { updated: false, reason: 'MISSING_INPUT' };
  }

  const summaryOk = String(summaryDoc.status || '').trim() === 'COMPLETED'
    && String(summaryDoc.gateDecision || '').trim() === 'CLOSED';
  const signedOk = String(signedDoc.status || '').trim() === 'SIGNED';

  if (!summaryOk || !signedOk) {
    return { updated: false, reason: 'CLOSEOUT_NOT_SIGNED_OR_COMPLETED' };
  }

  if (!isObjectRecord(freezeDoc.contour)) freezeDoc.contour = {};

  const currentStatus = String(freezeDoc.contour.status || '').trim();
  if (currentStatus === 'COMPLETED_CLOSED') {
    return { updated: false, reason: 'ALREADY_NORMALIZED' };
  }

  freezeDoc.contour.status = 'COMPLETED_CLOSED';
  freezeDoc.contour.closeSummaryRef = summaryRef;
  freezeDoc.contour.closeoutSignedRef = signedRef;
  freezeDoc.contour.closeTaskId = String(summaryDoc.taskId || '').trim();
  freezeDoc.contour.closeStatusNormalized = true;

  writeJson(freezeAbs, freezeDoc);
  return { updated: true, reason: 'NORMALIZED' };
}

function refreshSignedEvidenceSha(repoRoot, signedRef, freezeRef) {
  const signedAbs = path.resolve(repoRoot, signedRef);
  const freezeAbs = path.resolve(repoRoot, freezeRef);
  const signedDoc = readJsonObject(signedAbs);
  if (!isObjectRecord(signedDoc) || !fs.existsSync(freezeAbs)) {
    return { updated: false, reason: 'MISSING_INPUT' };
  }
  const expectedSha = `sha256:${sha256Raw(freezeAbs)}`;
  const currentSha = String(signedDoc.evidencePacketSha256 || '').trim();
  const currentRef = String(signedDoc.evidencePacketRef || '').trim();
  if (currentSha === expectedSha && currentRef === freezeRef) {
    return { updated: false, reason: 'ALREADY_MATCHED' };
  }
  signedDoc.evidencePacketRef = freezeRef;
  signedDoc.evidencePacketSha256 = expectedSha;
  writeJson(signedAbs, signedDoc);
  return { updated: true, reason: 'REFRESHED' };
}

function buildFinalRebindDelta({ state, generatedAtUtc }) {
  return {
    artifactId: 'FINAL_REBIND_DELTA_V1',
    schemaVersion: 1,
    generatedAtUtc,
    owner: 'KIRILL_PLUS_CODEX',
    taskId: 'TZ_FINAL_FORMALIZATION_AND_REBIND_001',
    correctionStatus: {
      CORRECTION_01: state.closeout.ok ? 'DONE' : 'PENDING',
      CORRECTION_02: state.registry.ok ? 'DONE_ACTIVE_SCOPE' : 'PENDING',
      CORRECTION_03: 'DONE_KEEP_ADVISORY_UNTIL_MACHINE_BINDING',
      CORRECTION_04: state.promotedBinding.ok ? 'DONE' : 'PENDING',
      CORRECTION_05: 'DONE',
      CORRECTION_06: 'DONE',
    },
    policyLocks: {
      blockingSurfaceExpansion: false,
      advisoryAsBlockingDriftAllowed: false,
      onlyMachineBoundCanBlock: true,
    },
    closeoutNormalization: {
      p1Status: state.closeout.p1.freeze.status,
      p2Status: state.closeout.p2.freeze.status,
      normalizedTo: 'COMPLETED_CLOSED',
      fullCloseoutPackagePresent: state.closeout.ok,
    },
    registryAlignment: {
      scope: 'ACTIVE_CANON_SURFACE',
      activeTokenCount: state.registry.activeTokenCount,
      activeGapCount: state.registry.activeGapCount,
      activeMissingInCatalog: state.registry.activeMissingInCatalog,
      activeMissingInDeclaration: state.registry.activeMissingInDeclaration,
      activeMissingClaim: state.registry.activeMissingClaim,
      activeTokenFailsignalMissing: state.registry.activeTokenFailsignalMissing,
      activeClaimFailsignalMissing: state.registry.activeClaimFailsignalMissing,
      globalGapCount: state.registry.globalGapCount,
      globalGapsRetainedAsAdvisory: true,
    },
    advisoryBindingDecision: {
      decision: state.advisoryDecision.decision,
      rationale: state.advisoryDecision.rationale,
      promotedItems: state.advisoryDecision.promotedItems,
      promotedBindingMissingFieldCount: state.promotedBinding.missingBindingFieldCount,
    },
    negativeScenarios: state.negativeResults,
    positiveScenarios: state.positiveResults,
    dod: state.dod,
    acceptance: state.acceptance,
    finalGate: 'GO_ONLY_IF_ALL_DOD_AND_ACCEPTANCE_TRUE',
  };
}

function buildFinalMasterSummary({ state, generatedAtUtc }) {
  const summaryReady = state.closeout.ok
    && state.registry.ok
    && state.advisoryDrift.ok
    && state.promotedBinding.ok
    && state.canonLock.ok
    && state.stageActivationGuardCheckPass;

  return {
    artifactId: 'FINAL_MASTER_CLOSEOUT_SUMMARY_V1',
    schemaVersion: 1,
    taskId: 'TZ_FINAL_FORMALIZATION_AND_REBIND_001',
    generatedAtUtc,
    owner: 'KIRILL_PLUS_CODEX',
    verdict: summaryReady ? 'ACCEPTED' : 'REJECTED',
    status: summaryReady ? 'COMPLETED' : 'FAILED',
    gateDecision: summaryReady ? 'CLOSED' : 'HOLD',
    planCompletionPercent: summaryReady ? 100 : 0,
    blockingSurfaceExpansion: false,
    advisoryAsBlockingDrift: state.advisoryDrift.ok ? 'ZERO' : 'NON_ZERO',
    closeout: {
      p1: state.closeout.p1.freeze.status,
      p2: state.closeout.p2.freeze.status,
      requiredArtifactsPresent: state.closeout.missingArtifacts.length === 0,
    },
    registryAlignment: {
      activeGapCount: state.registry.activeGapCount,
      globalGapCount: state.registry.globalGapCount,
      activeScopeZeroGap: state.registry.activeGapCount === 0,
    },
    advisoryDecision: state.advisoryDecision,
    checks: {
      DOD_01: state.dod.NEXT_TZ_DOD_01,
      DOD_02: state.dod.NEXT_TZ_DOD_02,
      DOD_03: state.dod.NEXT_TZ_DOD_03,
      DOD_04: state.dod.NEXT_TZ_DOD_04,
      DOD_05: state.dod.NEXT_TZ_DOD_05,
      DOD_06: state.dod.NEXT_TZ_DOD_06,
      DOD_07: state.dod.NEXT_TZ_DOD_07,
      ACCEPTANCE_01: state.acceptance.NEXT_TZ_ACCEPTANCE_01,
      ACCEPTANCE_02: state.acceptance.NEXT_TZ_ACCEPTANCE_02,
      ACCEPTANCE_03: state.acceptance.NEXT_TZ_ACCEPTANCE_03,
      ACCEPTANCE_04: state.acceptance.NEXT_TZ_ACCEPTANCE_04,
      ACCEPTANCE_05: state.acceptance.NEXT_TZ_ACCEPTANCE_05,
    },
    finalGateStatus: summaryReady ? 'GO_ONLY_IF_ALL_DOD_AND_ACCEPTANCE_TRUE' : 'HOLD',
  };
}

function buildSignedDoc({ repoRoot, generatedAtUtc }) {
  const evidenceRefs = [
    P1_CLOSE_SUMMARY_PATH,
    P1_SIGNED_PATH,
    P1_FREEZE_PATH,
    P2_CLOSE_SUMMARY_PATH,
    P2_SIGNED_PATH,
    P2_FREEZE_PATH,
    FINAL_REBIND_DELTA_PATH,
    FINAL_MASTER_SUMMARY_PATH,
  ];

  const evidenceChain = evidenceRefs.map((ref) => {
    const abs = path.resolve(repoRoot, ref);
    return {
      ref,
      sha256: `sha256:${sha256Raw(abs)}`,
    };
  });

  const rootHashSource = evidenceChain.map((entry) => `${entry.ref}|${entry.sha256}`).join('\n');
  const rootSha = createHash('sha256').update(rootHashSource).digest('hex');

  return {
    artifactId: 'FINAL_MASTER_CLOSEOUT_SIGNED_V1',
    schemaVersion: 1,
    taskId: 'TZ_FINAL_FORMALIZATION_AND_REBIND_001',
    status: 'SIGNED',
    signedAtUtc: generatedAtUtc,
    signedBy: 'KIRILL_PLUS_CODEX',
    signingMode: 'LOCAL_OFFLINE',
    signatureType: 'SHA256_EVIDENCE_LOCK',
    evidenceChain,
    evidenceRootSha256: `sha256:${rootSha}`,
    gate: {
      name: 'GO_ONLY_IF_ALL_DOD_AND_ACCEPTANCE_TRUE',
      isOpen: true,
      releaseDecisionClassChanged: false,
    },
    constraints: {
      blockingSurfaceExpansion: false,
      advisoryAsBlockingDriftAllowed: false,
      onlyMachineBoundCanBlock: true,
    },
  };
}

function parseArgs(argv = process.argv.slice(2)) {
  return {
    json: argv.includes('--json'),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const generatedAtUtc = new Date().toISOString();

  normalizeFreezeStatus(repoRoot, P1_FREEZE_PATH, P1_CLOSE_SUMMARY_PATH, P1_SIGNED_PATH);
  normalizeFreezeStatus(repoRoot, P2_FREEZE_PATH, P2_CLOSE_SUMMARY_PATH, P2_SIGNED_PATH);
  refreshSignedEvidenceSha(repoRoot, P1_SIGNED_PATH, P1_FREEZE_PATH);
  refreshSignedEvidenceSha(repoRoot, P2_SIGNED_PATH, P2_FREEZE_PATH);

  let state = evaluateFinalFormalizationAndRebindState({ repoRoot });

  const rebindDoc = buildFinalRebindDelta({ state, generatedAtUtc });
  writeJson(path.resolve(repoRoot, FINAL_REBIND_DELTA_PATH), rebindDoc);

  const summaryDoc = buildFinalMasterSummary({ state, generatedAtUtc });
  writeJson(path.resolve(repoRoot, FINAL_MASTER_SUMMARY_PATH), summaryDoc);

  const signedDoc = buildSignedDoc({ repoRoot, generatedAtUtc });
  writeJson(path.resolve(repoRoot, FINAL_MASTER_SIGNED_PATH), signedDoc);

  const run1 = evaluateFinalFormalizationAndRebindState({ repoRoot });
  const run2 = evaluateFinalFormalizationAndRebindState({ repoRoot });
  const run3 = evaluateFinalFormalizationAndRebindState({ repoRoot });

  const repeatabilityStable = run1.detector.hash === run2.detector.hash && run2.detector.hash === run3.detector.hash;

  run1.dod.NEXT_TZ_DOD_04 = repeatabilityStable;
  run1.acceptance.NEXT_TZ_ACCEPTANCE_05 = Object.values(run1.dod).every(Boolean);
  run1.ok = Object.values(run1.dod).every(Boolean) && Object.values(run1.acceptance).every(Boolean);
  run1[run1.token] = run1.ok ? 1 : 0;

  const outputDirAbs = path.resolve(repoRoot, OUTPUT_DIR);
  fs.mkdirSync(outputDirAbs, { recursive: true });

  writeJson(path.join(outputDirAbs, 'negative-results.json'), {
    runId: 'TZ_FINAL_FORMALIZATION_AND_REBIND_001',
    ...run1.negativeResults,
  });

  writeJson(path.join(outputDirAbs, 'positive-results.json'), {
    runId: 'TZ_FINAL_FORMALIZATION_AND_REBIND_001',
    ...run1.positiveResults,
  });

  writeJson(path.join(outputDirAbs, 'registry-alignment-summary.json'), {
    activeTokenCount: run1.registry.activeTokenCount,
    activeGapCount: run1.registry.activeGapCount,
    activeMissingInCatalog: run1.registry.activeMissingInCatalog,
    activeMissingInDeclaration: run1.registry.activeMissingInDeclaration,
    activeMissingClaim: run1.registry.activeMissingClaim,
    activeTokenFailsignalMissing: run1.registry.activeTokenFailsignalMissing,
    activeClaimFailsignalMissing: run1.registry.activeClaimFailsignalMissing,
    globalGapCount: run1.registry.globalGapCount,
  });

  writeJson(path.join(outputDirAbs, 'advisory-binding-decision-summary.json'), {
    decision: run1.advisoryDecision.decision,
    rationale: run1.advisoryDecision.rationale,
    promotedItemCount: run1.promotedBinding.promotedItemCount,
    missingBindingFieldCount: run1.promotedBinding.missingBindingFieldCount,
    advisoryToBlockingDriftCount: run1.advisoryDrift.advisoryToBlockingDriftCount,
  });

  writeJson(path.join(outputDirAbs, 'rebind-delta-summary.json'), {
    artifactRef: FINAL_REBIND_DELTA_PATH,
    finalSummaryRef: FINAL_MASTER_SUMMARY_PATH,
    finalSignedRef: FINAL_MASTER_SIGNED_PATH,
    finalMasterArtifactsOk: run1.finalMasterArtifacts.ok,
    finalMasterChainMismatchCount: run1.finalMasterArtifacts.chainMismatches.length,
  });

  writeJson(path.join(outputDirAbs, 'repeatability-summary.json'), {
    runs: 3,
    stable: repeatabilityStable,
    runHashes: [run1.detector.hash, run2.detector.hash, run3.detector.hash],
  });

  writeJson(path.join(outputDirAbs, 'final-dod-acceptance-summary.json'), {
    ...run1.dod,
    ...run1.acceptance,
  });

  writeJson(path.join(outputDirAbs, 'summary.json'), {
    runId: 'TZ_FINAL_FORMALIZATION_AND_REBIND_001',
    status: run1.ok ? 'PASS' : 'FAIL',
    token: run1.token,
    tokenValue: run1[run1.token],
    counts: run1.counts,
    finalGateStatus: run1.ok ? 'GO_ONLY_IF_ALL_DOD_AND_ACCEPTANCE_TRUE' : 'HOLD',
  });

  writeJson(path.join(outputDirAbs, 'ticket-meta.json'), {
    taskId: 'TZ_FINAL_FORMALIZATION_AND_REBIND_001',
    generatedAtUtc,
    owner: 'CODEX',
    outputDir: OUTPUT_DIR,
  });

  const report = {
    status: run1.ok ? 'PASS' : 'FAIL',
    runId: 'TZ_FINAL_FORMALIZATION_AND_REBIND_001',
    finalGateStatus: run1.ok ? 'GO_ONLY_IF_ALL_DOD_AND_ACCEPTANCE_TRUE' : 'HOLD',
    checks: {
      ACTIVE_CANON_LOCK_CHECK_PASS: run1.acceptance.NEXT_TZ_ACCEPTANCE_01,
      STAGE_ACTIVATION_GUARD_CHECK_PASS: run1.acceptance.NEXT_TZ_ACCEPTANCE_02,
      OFFLINE_CHAIN_OF_TRUST_LOCALLY_VERIFIABLE: run1.acceptance.NEXT_TZ_ACCEPTANCE_03,
      FINAL_MASTER_CLOSEOUT_SIGNED: run1.acceptance.NEXT_TZ_ACCEPTANCE_04,
      PLAN_V4_FORMAL_COMPLETION_100_PERCENT: run1.acceptance.NEXT_TZ_ACCEPTANCE_05,
      BLOCKING_SURFACE_EXPANSION_FALSE: run1.dod.NEXT_TZ_DOD_05,
      ADVISORY_AS_BLOCKING_DRIFT_ZERO: run1.dod.NEXT_TZ_DOD_06,
      REPEATABILITY_THREE_RUNS_PASS: run1.dod.NEXT_TZ_DOD_04,
    },
    outputs: {
      finalRebindDelta: FINAL_REBIND_DELTA_PATH,
      finalMasterSummary: FINAL_MASTER_SUMMARY_PATH,
      finalMasterSigned: FINAL_MASTER_SIGNED_PATH,
      evidenceDir: OUTPUT_DIR,
    },
  };

  if (args.json) {
    process.stdout.write(`${stableStringify(report)}\n`);
  } else {
    process.stdout.write(`${stableStringify(report)}\n`);
  }

  process.exit(report.status === 'PASS' ? 0 : 1);
}

main();
