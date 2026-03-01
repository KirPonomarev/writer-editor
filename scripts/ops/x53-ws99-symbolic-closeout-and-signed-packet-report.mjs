#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { evaluateX53Ws99SymbolicCloseoutAndSignedPacketState } from './x53-ws99-symbolic-closeout-and-signed-packet-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/X53_CONTOUR/TICKET_99';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/X53_WS99_SYMBOLIC_CLOSEOUT_AND_SIGNED_PACKET_STATUS_V1.json';
const DEFAULT_RUN_ID = 'TZ_X53_WS99_SYMBOLIC_CLOSEOUT_AND_SIGNED_PACKET_001';

const FREEZE_PACKET_REL = 'docs/OPS/EVIDENCE/X53_CONTOUR/x53-contour-freeze-packet-v1.json';
const CLOSE_SUMMARY_REL = 'docs/OPS/STATUS/X53_CONTOUR_CLOSE_SUMMARY_V1.json';
const SIGNED_STATUS_REL = 'docs/OPS/STATUS/X53_CONTOUR_CLOSEOUT_SIGNED_V1.json';
const NEXT_RECORD_REL = 'docs/OPS/STATUS/NEXT_CONTOUR_OPENING_RECORD_V39.json';

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
    statusPath: DEFAULT_STATUS_PATH,
    runId: DEFAULT_RUN_ID,
    ticketId: DEFAULT_RUN_ID,
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

    if (arg === '--status-path' && i + 1 < argv.length) {
      out.statusPath = normalizeString(argv[i + 1]) || DEFAULT_STATUS_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--status-path=')) {
      out.statusPath = normalizeString(arg.slice('--status-path='.length)) || DEFAULT_STATUS_PATH;
      continue;
    }

    if (arg === '--run-id' && i + 1 < argv.length) {
      out.runId = normalizeString(argv[i + 1]) || DEFAULT_RUN_ID;
      i += 1;
      continue;
    }
    if (arg.startsWith('--run-id=')) {
      out.runId = normalizeString(arg.slice('--run-id='.length)) || DEFAULT_RUN_ID;
      continue;
    }

    if (arg === '--ticket-id' && i + 1 < argv.length) {
      out.ticketId = normalizeString(argv[i + 1]) || out.runId;
      i += 1;
      continue;
    }
    if (arg.startsWith('--ticket-id=')) {
      out.ticketId = normalizeString(arg.slice('--ticket-id='.length)) || out.runId;
    }
  }

  return out;
}

function comparableState(state) {
  return {
    ok: state.ok,
    token: state.token,
    counts: state.counts,
    negativeResults: state.negativeResults,
    positiveResults: state.positiveResults,
    dod: state.dod,
    acceptance: state.acceptance,
    determinism: state.determinism,
    finalGateSatisfied: state.finalGateSatisfied,
  };
}

function withGeneratedAt(value, generatedAtUtc) {
  if (Array.isArray(value)) return value.map((entry) => withGeneratedAt(entry, generatedAtUtc));
  if (!isObjectRecord(value)) {
    return value === '__GENERATED_AT_UTC__' ? generatedAtUtc : value;
  }
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    out[key] = withGeneratedAt(entry, generatedAtUtc);
  }
  return out;
}

function computeSha256FromFile(filePath) {
  const buf = fs.readFileSync(filePath);
  return createHash('sha256').update(buf).digest('hex');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();

  const run1 = evaluateX53Ws99SymbolicCloseoutAndSignedPacketState({ repoRoot });
  const run2 = evaluateX53Ws99SymbolicCloseoutAndSignedPacketState({ repoRoot });
  const run3 = evaluateX53Ws99SymbolicCloseoutAndSignedPacketState({ repoRoot });

  const comp1 = comparableState(run1);
  const comp2 = comparableState(run2);
  const comp3 = comparableState(run3);

  const repeatabilityStable = stableStringify(comp1) === stableStringify(comp2)
    && stableStringify(comp2) === stableStringify(comp3);

  const generatedAtUtc = new Date().toISOString();

  const freezePacketPath = path.resolve(repoRoot, FREEZE_PACKET_REL);
  const closeSummaryPath = path.resolve(repoRoot, CLOSE_SUMMARY_REL);
  const signedStatusPath = path.resolve(repoRoot, SIGNED_STATUS_REL);
  const nextRecordPath = path.resolve(repoRoot, NEXT_RECORD_REL);

  const freezePacketDoc = withGeneratedAt(run1.templates.freezePacketTemplate, generatedAtUtc);
  writeJson(freezePacketPath, freezePacketDoc);
  const freezePacketSha = computeSha256FromFile(freezePacketPath);

  const signedStatusDoc = withGeneratedAt(run1.templates.signedStatusTemplate, generatedAtUtc);
  signedStatusDoc.evidencePacketSha256 = `sha256:${freezePacketSha}`;
  writeJson(signedStatusPath, signedStatusDoc);

  const closeSummaryDoc = withGeneratedAt(run1.templates.closeSummaryTemplate, generatedAtUtc);
  closeSummaryDoc.freezePacketSha256 = `sha256:${freezePacketSha}`;
  writeJson(closeSummaryPath, closeSummaryDoc);

  const nextRecordDoc = withGeneratedAt(run1.templates.nextContourOpeningRecordTemplate, generatedAtUtc);
  writeJson(nextRecordPath, nextRecordDoc);

  const summary = {
    generatedAtUtc,
    runId: args.runId,
    ticketId: args.ticketId,
    objective: 'SYMBOLICALLY_CLOSE_X53_WITH_SIGNED_FREEZE_PACKET_AND_OPEN_NEXT_CONTOUR_GATE',
    status: run1.ok && repeatabilityStable ? 'PASS' : 'FAIL',
    negativeResults: Object.fromEntries(
      Object.entries(run1.negativeResults).map(([k, v]) => [k, v ? 'PASS' : 'FAIL']),
    ),
    positiveResults: Object.fromEntries(
      Object.entries(run1.positiveResults).map(([k, v]) => [k, v ? 'PASS' : 'FAIL']),
    ),
    closeoutSummary: {
      closeoutArtifactSetComplete: run1.positiveResults.NEXT_TZ_POSITIVE_01,
      signedStatusTrueWithSha256EvidenceLock: run1.positiveResults.NEXT_TZ_POSITIVE_02,
      nextGateOpeningRecordPresent: run1.positiveResults.NEXT_TZ_POSITIVE_03,
      missingArtifactCount: run1.counts.missingArtifactCount,
      missingFreezePacketCount: run1.counts.missingFreezePacketCount,
      signatureHashMismatchCount: run1.counts.signatureHashMismatchCount,
      missingCloseoutSummaryCount: run1.counts.missingCloseoutSummaryCount,
      missingNextGateRecordCount: run1.counts.missingNextGateRecordCount,
      unsignedCloseoutArtifactCount: run1.counts.unsignedCloseoutArtifactCount,
    },
    signedStatus: {
      signed: signedStatusDoc.status === 'SIGNED',
      signatureType: signedStatusDoc.signatureType,
      evidencePacketSha256: signedStatusDoc.evidencePacketSha256,
    },
    freezePacketSha256: `sha256:${freezePacketSha}`,
    dod: {
      NEXT_TZ_DOD_01: run1.dod.DOD_01,
      NEXT_TZ_DOD_02: run1.dod.DOD_02,
      NEXT_TZ_DOD_03: run1.dod.DOD_03,
      NEXT_TZ_DOD_04: run1.dod.DOD_04,
      NEXT_TZ_DOD_05: run1.dod.DOD_05,
      NEXT_TZ_DOD_06: run1.dod.DOD_06,
      NEXT_TZ_DOD_07: run1.dod.DOD_07,
    },
    acceptance: {
      NEXT_TZ_ACCEPTANCE_01: run1.acceptance.ACCEPTANCE_01,
      NEXT_TZ_ACCEPTANCE_02: run1.acceptance.ACCEPTANCE_02,
      NEXT_TZ_ACCEPTANCE_03: run1.acceptance.ACCEPTANCE_03,
      NEXT_TZ_ACCEPTANCE_04: run1.acceptance.ACCEPTANCE_04,
    },
    repeatability: {
      stable: repeatabilityStable,
      runs: [comp1, comp2, comp3],
    },
    finalGate: run1.finalGate,
    finalGateSatisfied: run1.finalGateSatisfied && repeatabilityStable,
  };

  const statusDoc = {
    version: 1,
    token: run1.token,
    runId: args.runId,
    ticketId: args.ticketId,
    generatedAtUtc,
    status: summary.status,
    counts: run1.counts,
    checks: run1.checks,
    artifactRefs: {
      freezePacketRef: FREEZE_PACKET_REL,
      closeSummaryRef: CLOSE_SUMMARY_REL,
      signedStatusRef: SIGNED_STATUS_REL,
      nextContourOpeningRecordRef: NEXT_RECORD_REL,
    },
    repeatabilityStable,
    finalGateSatisfied: summary.finalGateSatisfied,
  };

  const outputDir = path.resolve(repoRoot, args.outputDir);
  const statusPath = path.resolve(repoRoot, args.statusPath);

  writeJson(statusPath, statusDoc);
  writeJson(path.join(outputDir, 'negative-results.json'), summary.negativeResults);
  writeJson(path.join(outputDir, 'positive-results.json'), summary.positiveResults);
  writeJson(path.join(outputDir, 'final-dod-acceptance-summary.json'), {
    dod: summary.dod,
    acceptance: summary.acceptance,
    finalGate: summary.finalGate,
    finalGateSatisfied: summary.finalGateSatisfied,
  });
  writeJson(path.join(outputDir, 'closeout-summary.json'), {
    generatedAtUtc,
    objective: summary.objective,
    status: summary.status,
    repeatabilityStable,
    freezePacketSha256: summary.freezePacketSha256,
    ...summary.closeoutSummary,
  });
  writeJson(path.join(outputDir, 'signed-status.json'), summary.signedStatus);
  writeJson(path.join(outputDir, 'freeze-packet-sha256.json'), {
    freezePacketSha256: summary.freezePacketSha256,
  });
  writeJson(path.join(outputDir, 'repeatability-summary.json'), {
    stable: repeatabilityStable,
    runs: summary.repeatability.runs.map((r) => r.determinism.runHashes[0]),
  });
  writeJson(path.join(outputDir, 'ticket-meta.json'), {
    generatedAtUtc,
    runId: args.runId,
    ticketId: args.ticketId,
  });

  process.stdout.write(`${stableStringify(summary)}\n`);
  process.exit(summary.status === 'PASS' ? 0 : 1);
}

main();
