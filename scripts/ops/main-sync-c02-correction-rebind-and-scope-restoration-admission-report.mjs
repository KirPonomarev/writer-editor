#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluateMainSyncC02CorrectionRebindAndScopeRestorationAdmission } from './main-sync-c02-correction-rebind-and-scope-restoration-admission-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/MAIN_SYNC_C02_CORRECTION_REBIND_AND_SCOPE_RESTORATION_ADMISSION/TICKET_01';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/MAIN_SYNC_C02_CORRECTION_REBIND_AND_SCOPE_RESTORATION_ADMISSION_STATUS_V1.json';
const DEFAULT_RUN_ID = 'TZ_MAIN_SYNC_C02_CORRECTION_REBIND_AND_SCOPE_RESTORATION_ADMISSION_001';

const VERIFICATION_COMMANDS = Object.freeze([
  {
    checkId: 'MAIN_SYNC_C02_CORRECTION_REBIND_CONTRACT',
    cmd: ['node', '--test', 'test/contracts/main-sync-c02-correction-rebind-and-scope-restoration-admission.contract.test.js'],
  },
  {
    checkId: 'OSS_POLICY',
    cmd: ['npm', 'run', 'oss:policy'],
  },
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

function runCheck(repoRoot, entry) {
  const result = spawnSync(entry.cmd[0], entry.cmd.slice(1), {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return {
    checkId: entry.checkId,
    ok: result.status === 0,
    exitCode: typeof result.status === 'number' ? result.status : -1,
    command: entry.cmd.join(' '),
    stdout: typeof result.stdout === 'string' ? result.stdout.trim() : '',
    stderr: typeof result.stderr === 'string' ? result.stderr.trim() : '',
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const state = evaluateMainSyncC02CorrectionRebindAndScopeRestorationAdmission({ repoRoot });
  const generatedAtUtc = new Date().toISOString();
  const outputDir = path.resolve(repoRoot, args.outputDir);
  const statusPath = path.resolve(repoRoot, args.statusPath);

  writeJson(statusPath, {
    version: state.version,
    status: state.ok ? 'ACTIVE' : 'FAILED',
    token: state.token,
    taskBasename: state.taskBasename,
    contourId: state.contourId,
    scope: state.scope,
    stateScript: state.stateScript,
    reportScript: state.reportScript,
    contractTest: state.contractTest,
    nextStep: state.exactNextWriteScopeInput.nextContour,
    formalRepoTruth: state.truthSurface.formalRepoTruth,
    rootRole: state.truthSurface.rootRole,
    currentRootHeadSha: state.boundRefs.rootSha,
    currentMainHeadSha: state.boundRefs.mainSha,
    pr825CanonicalAcceptanceState: state.pr825Classification.canonicalAcceptanceState,
    allowedReplayPayloadClass: state.allowedCorrectionDomain.classification,
    forbiddenReplayPayloadClass: state.forbiddenCorrectionDomain.classification,
    recordedAtUtc: generatedAtUtc,
  });

  writeJson(path.join(outputDir, 'correction-admission-summary.json'), {
    generatedAtUtc,
    runId: args.runId,
    ticketId: args.ticketId,
    ok: state.ok,
    boundRefs: state.boundRefs,
    truthSurface: state.truthSurface,
    pr825Classification: state.pr825Classification,
    exactNextWriteScopeInput: state.exactNextWriteScopeInput,
  });
  writeJson(path.join(outputDir, 'scope-restoration-matrix.json'), {
    generatedAtUtc,
    runId: args.runId,
    ticketId: args.ticketId,
    ok: state.checks.packetScopeDriftConfirmed && state.checks.packetScopeEvidenceOk && state.checks.canonicalSetOk,
    allowedCorrectionDomain: state.allowedCorrectionDomain,
    controlPlaneBindingOnly: state.controlPlaneBindingOnly,
    forbiddenCorrectionDomain: state.forbiddenCorrectionDomain,
  });
  writeJson(path.join(outputDir, 'risk-rollback.json'), {
    riskRows: state.riskRows,
    rollbackRows: state.rollbackRows,
  });
  writeJson(path.join(outputDir, 'next-write-scope-input.json'), {
    ok: state.ok,
    exactNextWriteScopeInput: state.exactNextWriteScopeInput,
  });
  writeJson(path.join(outputDir, 'scope-audit.json'), {
    ok: state.checks.packetScopeDriftConfirmed && state.checks.packetScopeEvidenceOk,
    packetScopeClassObserved: state.pr825Classification.scopeClassRecordedByPr825,
    allowedReplayPayloadClass: state.allowedCorrectionDomain.classification,
    forbiddenReplayPayloadClass: state.forbiddenCorrectionDomain.classification,
    controlPlaneScopeClass: state.controlPlaneBindingOnly.classification,
  });
  writeJson(path.join(outputDir, 'fact-check.json'), {
    ok: state.checks.boundRootMatchesOrigin
      && state.checks.boundMainMatchesOrigin
      && state.checks.localHeadDescendsFromRoot
      && state.checks.ownerDecisionOk !== false,
    currentRootHeadSha: state.boundRefs.rootSha,
    currentMainHeadSha: state.boundRefs.mainSha,
    c03StillBlocked: state.exactNextWriteScopeInput.c03StillBlocked,
    packetReplayCommitCount: state.controlPlaneBindingOnly.packetReplayCommitCount,
    canonicalPayloadCount: state.allowedCorrectionDomain.payloadCount,
  });
  writeJson(path.join(outputDir, 'command-results.json'), []);

  const commandResults = VERIFICATION_COMMANDS.map((entry) => runCheck(repoRoot, entry));
  const verificationOk = commandResults.every((entry) => entry.ok);
  const overallOk = state.ok && verificationOk;

  writeJson(statusPath, {
    version: state.version,
    status: overallOk ? 'ACTIVE' : 'FAILED',
    token: state.token,
    taskBasename: state.taskBasename,
    contourId: state.contourId,
    scope: state.scope,
    stateScript: state.stateScript,
    reportScript: state.reportScript,
    contractTest: state.contractTest,
    nextStep: state.exactNextWriteScopeInput.nextContour,
    formalRepoTruth: state.truthSurface.formalRepoTruth,
    rootRole: state.truthSurface.rootRole,
    currentRootHeadSha: state.boundRefs.rootSha,
    currentMainHeadSha: state.boundRefs.mainSha,
    pr825CanonicalAcceptanceState: state.pr825Classification.canonicalAcceptanceState,
    allowedReplayPayloadClass: state.allowedCorrectionDomain.classification,
    forbiddenReplayPayloadClass: state.forbiddenCorrectionDomain.classification,
    recordedAtUtc: generatedAtUtc,
  });
  writeJson(path.join(outputDir, 'command-results.json'), commandResults);

  process.stdout.write(`${stableStringify({
    generatedAtUtc,
    runId: args.runId,
    ticketId: args.ticketId,
    ok: overallOk,
    verificationOk,
    rootSha: state.boundRefs.rootSha,
    mainSha: state.boundRefs.mainSha,
    pr825CanonicalAcceptanceState: state.pr825Classification.canonicalAcceptanceState,
    nextContour: state.exactNextWriteScopeInput.nextContour,
  })}\n`);
  process.exit(overallOk ? 0 : 1);
}

main();
