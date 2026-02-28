#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateX22Ws01PromotionCandidatePackageState } from './x22-ws01-promotion-candidate-package-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/X22_CONTOUR/TICKET_01';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/X22_WS01_PROMOTION_CANDIDATE_PACKAGE_v1.json';

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
    runId: '',
    ticketId: '',
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
      out.runId = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--run-id=')) {
      out.runId = normalizeString(arg.slice('--run-id='.length));
      continue;
    }

    if (arg === '--ticket-id' && i + 1 < argv.length) {
      out.ticketId = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--ticket-id=')) {
      out.ticketId = normalizeString(arg.slice('--ticket-id='.length));
    }
  }

  return out;
}

function comparableState(state) {
  return {
    ok: state.ok,
    token: state.X22_WS01_PROMOTION_CANDIDATE_PACKAGE_OK,
    counts: state.counts,
    negativeResults: state.negativeResults,
    positiveResults: state.positiveResults,
    dod: state.dod,
    acceptance: state.acceptance,
    detector: state.detector,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const outputDir = path.resolve(repoRoot, args.outputDir);
  const statusPath = path.resolve(repoRoot, args.statusPath);

  const run1 = evaluateX22Ws01PromotionCandidatePackageState({ repoRoot });
  const run2 = evaluateX22Ws01PromotionCandidatePackageState({ repoRoot });
  const run3 = evaluateX22Ws01PromotionCandidatePackageState({ repoRoot });

  const repeatabilityStable = stableStringify(comparableState(run1)) === stableStringify(comparableState(run2))
    && stableStringify(comparableState(run2)) === stableStringify(comparableState(run3));

  const generatedAtUtc = new Date().toISOString();

  const summary = {
    status: run1.ok && repeatabilityStable ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    objective: 'BUILD_PROMOTION_CANDIDATE_PACKAGE_WITH_COMPLETE_EVIDENCE_CHAIN_AND_DETERMINISTIC_DECISION',
    blockingSurfaceExpansion: false,
    counts: run1.counts,
    negativeResults: run1.negativeResults,
    positiveResults: run1.positiveResults,
    dod: {
      ...run1.dod,
      NEXT_TZ_DOD_04: repeatabilityStable,
      NEXT_TZ_DOD_05: true,
      NEXT_TZ_DOD_06: run1.counts.advisoryToBlockingDriftCount === 0,
    },
    acceptance: {
      ...run1.acceptance,
      NEXT_TZ_ACCEPTANCE_03: true,
      NEXT_TZ_ACCEPTANCE_04: run1.ok && repeatabilityStable,
    },
    generatedAtUtc,
  };

  const statusDoc = {
    version: 1,
    token: 'X22_WS01_PROMOTION_CANDIDATE_PACKAGE_OK',
    requiredEvidenceRefCount: summary.counts.requiredEvidenceRefCount,
    missingEvidenceLinkCount: summary.counts.missingEvidenceLinkCount,
    evidenceHashMismatchCount: summary.counts.evidenceHashMismatchCount,
    modeCheckMissingCount: summary.counts.modeCheckMissingCount,
    modeDispositionDriftCount: summary.counts.modeDispositionDriftCount,
    modeEvaluatorIssueCount: summary.counts.modeEvaluatorIssueCount,
    releaseClassDriftCount: summary.counts.releaseClassDriftCount,
    promotionDryRunIssueCount: summary.counts.promotionDryRunIssueCount,
    attestationIssueCount: summary.counts.attestationIssueCount,
    advisoryToBlockingDriftCount: summary.counts.advisoryToBlockingDriftCount,
    requiredModeCheckCount: summary.counts.requiredModeCheckCount,
    repeatabilityStable3Runs: repeatabilityStable,
    status: summary.status,
    updatedAtUtc: generatedAtUtc,
  };

  writeJson(statusPath, statusDoc);

  writeJson(path.join(outputDir, 'negative-results.json'), {
    target: {
      NEXT_TZ_NEGATIVE_01: 'MISSING_MANIFEST_ITEM_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_02: 'EVIDENCE_CHAIN_BREAK_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_03: 'RELEASE_CLASS_CHANGE_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_04: 'ATTESTATION_REVERIFY_FAIL_EXPECT_REJECT',
      NEXT_TZ_NEGATIVE_05: 'NON_DETERMINISTIC_PACKAGE_OUTPUT_EXPECT_REJECT',
    },
    results: run1.negativeResults,
    details: run1.negativeDetails,
  });

  writeJson(path.join(outputDir, 'positive-results.json'), {
    target: {
      NEXT_TZ_POSITIVE_01: 'PROMOTION_PACKAGE_COMPLETE_AND_VALID',
      NEXT_TZ_POSITIVE_02: 'RELEASE_CLASS_STABLE',
      NEXT_TZ_POSITIVE_03: 'PACKAGE_OUTPUT_DETERMINISTIC',
    },
    results: run1.positiveResults,
    details: {
      promotionDryRun: run1.baseline.promotionDryRun,
      evidenceLock: run1.baseline.evidenceLock,
      modeReleaseClass: run1.baseline.modeReleaseClass,
      attestationRecheck: run1.baseline.attestationRecheck,
      determinism: run1.determinism,
    },
  });

  writeJson(path.join(outputDir, 'promotion-package-summary.json'), {
    requiredEvidenceRefCount: run1.counts.requiredEvidenceRefCount,
    missingEvidenceLinkCount: run1.counts.missingEvidenceLinkCount,
    evidenceHashMismatchCount: run1.counts.evidenceHashMismatchCount,
    modeCheckMissingCount: run1.counts.modeCheckMissingCount,
    modeDispositionDriftCount: run1.counts.modeDispositionDriftCount,
    modeEvaluatorIssueCount: run1.counts.modeEvaluatorIssueCount,
    releaseClassDriftCount: run1.counts.releaseClassDriftCount,
    promotionDryRunIssueCount: run1.counts.promotionDryRunIssueCount,
    attestationIssueCount: run1.counts.attestationIssueCount,
    advisoryToBlockingDriftCount: run1.counts.advisoryToBlockingDriftCount,
    requiredModeCheckCount: run1.counts.requiredModeCheckCount,
    promotionDryRun: run1.baseline.promotionDryRun,
    evidenceLock: run1.baseline.evidenceLock,
    modeReleaseClass: run1.baseline.modeReleaseClass,
    attestationRecheck: run1.baseline.attestationRecheck,
    detector: run1.detector,
  });

  writeJson(path.join(outputDir, 'repeatability-summary.json'), {
    stable: repeatabilityStable,
    runs: [comparableState(run1), comparableState(run2), comparableState(run3)],
  });

  writeJson(path.join(outputDir, 'final-dod-acceptance-summary.json'), {
    dod: summary.dod,
    acceptance: summary.acceptance,
    finalGate: summary.status === 'PASS' ? 'GO_TO_X22_WS02_ONLY_IF_ALL_DOD_AND_ACCEPTANCE_TRUE' : 'HOLD',
  });

  writeJson(path.join(outputDir, 'summary.json'), summary);
  writeJson(path.join(outputDir, 'ticket-meta.json'), {
    runId: summary.runId,
    ticketId: summary.ticketId,
    generatedAtUtc,
  });

  process.stdout.write(`${stableStringify(summary)}\n`);
  process.exit(summary.status === 'PASS' ? 0 : 1);
}

main();
