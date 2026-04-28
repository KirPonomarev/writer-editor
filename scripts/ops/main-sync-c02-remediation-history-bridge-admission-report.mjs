#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateMainSyncC02RemediationHistoryBridgeAdmission } from './main-sync-c02-remediation-history-bridge-admission-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/MAIN_SYNC_C02_REMEDIATION_HISTORY_BRIDGE_ADMISSION/TICKET_01';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/MAIN_SYNC_C02_REMEDIATION_HISTORY_BRIDGE_ADMISSION_RECORD_V1.json';
const DEFAULT_RUN_ID = 'TZ_MAIN_SYNC_C02_REMEDIATION_HISTORY_BRIDGE_ADMISSION_001';

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
      out.outputDir = normalizeString(argv[i + 1]) || out.outputDir;
      i += 1;
      continue;
    }
    if (arg === '--status-path' && i + 1 < argv.length) {
      out.statusPath = normalizeString(argv[i + 1]) || out.statusPath;
      i += 1;
      continue;
    }
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const state = evaluateMainSyncC02RemediationHistoryBridgeAdmission({ repoRoot });
  const generatedAtUtc = new Date().toISOString();
  const outputDir = path.resolve(repoRoot, args.outputDir);
  const statusPath = path.resolve(repoRoot, args.statusPath);

  writeJson(statusPath, {
    status: 'MAIN_SYNC_C02_REMEDIATION_HISTORY_BRIDGE_RUNTIME_WRITES_NOT_ADMITTED',
    recordedAtUtc: generatedAtUtc,
    decisionOwner: 'MAIN_INTEGRATOR',
    taskBasename: state.taskBasename,
    scope: state.scope,
    contourId: state.contourId,
    sourceHeadCommitSha: state.boundRefs.rootSha,
    sourceArtifactsBasenames: [
      'MAIN_SYNC_C02_MERGEABILITY_STATUS_V1.json',
      'mergeability-summary.json',
      'conflict-set.json',
      'pre-pr-verification.json',
    ],
    promotionDecision: state.recommendation.methodId,
    runtimeWritesAdmitted: false,
    runtimeAdmissionGranted: false,
    formalCutoverClaimed: false,
    broadShellAdmissionClaimed: false,
    allowedWriteDomain: 'NONE',
    blockedWriteDomain: 'ROOT_TO_MAIN_PROMOTION_AND_HISTORY_BRIDGE_EXECUTION',
    reasons: [
      'The committed C02 blocker packet still reports unrelated histories with no merge-base.',
      'Silent rebase and history rewrite remain forbidden by active canon.',
      'No automatic bridge method is admitted by the current blocker packet.',
    ],
    evidenceArtifacts: [
      'allowed-method-matrix.json',
      'forbidden-method-matrix.json',
      'ranked-method-matrix.json',
      'admission-summary.json',
      'risk-rollback.json',
      'next-write-contour.json',
    ],
    notes: [
      'This is a report-only admission contour.',
      'This record does not approve any history-bridge write automatically.',
      'Any next write contour requires owner acceptance of one explicit method or continued STOP.',
    ],
    nextStep: state.recommendation.exactNextWriteContour,
    stateScript: state.stateScript,
    reportScript: state.reportScript,
    contractTest: state.contractTest,
  });

  writeJson(path.join(outputDir, 'allowed-method-matrix.json'), state.allowedMethodMatrix);
  writeJson(path.join(outputDir, 'forbidden-method-matrix.json'), state.forbiddenMethodMatrix);
  writeJson(path.join(outputDir, 'ranked-method-matrix.json'), state.rankedMethodMatrix);
  writeJson(path.join(outputDir, 'admission-summary.json'), {
    generatedAtUtc,
    runId: args.runId,
    ticketId: args.ticketId,
    ok: state.ok,
    recommendation: state.recommendation,
    boundRefs: state.boundRefs,
    localGitFacts: state.localGitFacts,
    c02BlockerFacts: state.c02BlockerFacts,
  });
  writeJson(path.join(outputDir, 'risk-rollback.json'), {
    riskRows: state.riskRows,
    rollbackRows: state.rollbackRows,
  });
  writeJson(path.join(outputDir, 'next-write-contour.json'), {
    recommendation: state.recommendation,
    c03Blocked: true,
    ownerAcceptanceRequired: true,
  });

  process.stdout.write(`${stableStringify({
    generatedAtUtc,
    runId: args.runId,
    ticketId: args.ticketId,
    ok: state.ok,
    recommendation: state.recommendation.methodId,
    issues: state.issues,
  })}\n`);
  process.exit(state.ok ? 0 : 1);
}

main();
