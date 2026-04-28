#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateMainSyncC01OwnerMethodDecision } from './main-sync-c01-owner-method-decision-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/MAIN_SYNC_C01_OWNER_METHOD_DECISION/TICKET_01';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/MAIN_SYNC_C01_OWNER_METHOD_DECISION_STATUS_V1.json';
const DEFAULT_RUN_ID = 'TZ_MAIN_SYNC_C01_OWNER_METHOD_DECISION_001';

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

function removeIfExists(filePath) {
  fs.rmSync(filePath, { force: true });
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
  const state = evaluateMainSyncC01OwnerMethodDecision({ repoRoot });
  const generatedAtUtc = new Date().toISOString();
  const outputDir = path.resolve(repoRoot, args.outputDir);
  const statusPath = path.resolve(repoRoot, args.statusPath);

  removeIfExists(path.join(outputDir, 'selected-method.json'));
  removeIfExists(path.join(outputDir, 'rejected-methods.json'));
  removeIfExists(path.join(outputDir, 'c02-inputs.json'));

  writeJson(statusPath, {
    version: state.version,
    status: 'ACTIVE',
    token: state.token,
    taskBasename: state.taskBasename,
    contourId: state.contourId,
    scope: state.scope,
    recordedAtUtc: generatedAtUtc,
    decisionOwner: 'KIRILL_PONOMAREV',
    formalRepoTruth: state.truthSurface.formalRepoTruth,
    rootRole: state.truthSurface.rootRole,
    selectedMethodId: state.ownerDecision.selectedMethod.methodId,
    executionGranted: state.ownerDecision.selectedMethod.executionGranted,
    sourceHeadCommitSha: state.boundRefs.rootSha,
    sourceArtifactsBasenames: [
      'MAIN_SYNC_C01_AHEAD_INVENTORY_STATUS_V1.json',
      'MAIN_SYNC_C02_MERGEABILITY_STATUS_V1.json',
      'MAIN_SYNC_C02_REMEDIATION_HISTORY_BRIDGE_ADMISSION_RECORD_V1.json',
      'admission-summary.json',
    ],
    evidenceArtifacts: [
      'decision-summary.json',
      'rejected-methods-matrix.json',
      'risk-rollback.json',
      'next-write-contour.json',
    ],
    notes: [
      'This contour binds owner acceptance in repo artifacts only.',
      'This contour does not authorize replay execution or dry run.',
      'C02 remains the first replay-readiness contour.',
    ],
    nextStep: state.exactC02Inputs.nextContour,
    stateScript: state.stateScript,
    reportScript: state.reportScript,
    contractTest: state.contractTest,
  });

  writeJson(path.join(outputDir, 'decision-summary.json'), {
    generatedAtUtc,
    runId: args.runId,
    ticketId: args.ticketId,
    ok: state.ok,
    ownerAcceptanceSource: 'THREAD_OWNER_DECISION_BOUND_BY_C01_PACKET',
    truthSurface: state.truthSurface,
    boundRefs: state.boundRefs,
    localGitFacts: state.localGitFacts,
    sourceFacts: state.sourceFacts,
    selectedMethod: state.ownerDecision.selectedMethod,
    nextContour: state.exactC02Inputs.nextContour,
  });
  writeJson(path.join(outputDir, 'rejected-methods-matrix.json'), state.ownerDecision.rejectedMethods);
  writeJson(path.join(outputDir, 'risk-rollback.json'), {
    riskRows: state.riskRows,
    rollbackRows: state.rollbackRows,
  });
  writeJson(path.join(outputDir, 'next-write-contour.json'), {
    selectedMethod: state.ownerDecision.selectedMethod.methodId,
    exactC02Input: state.exactC02Inputs,
    ownerAcceptanceRequired: false,
    c03StillBlocked: true,
  });

  process.stdout.write(`${stableStringify({
    generatedAtUtc,
    runId: args.runId,
    ticketId: args.ticketId,
    ok: state.ok,
    selectedMethodId: state.ownerDecision.selectedMethod.methodId,
    executionGranted: state.ownerDecision.selectedMethod.executionGranted,
    issues: state.issues,
  })}\n`);
  process.exit(state.ok ? 0 : 1);
}

main();
