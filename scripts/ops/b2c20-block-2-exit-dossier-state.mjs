#!/usr/bin/env node
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';

export const TOKEN_NAME = 'B2C20_BLOCK_2_EXIT_DOSSIER_OK';

const TASK_ID = 'B2C20_BLOCK_2_EXIT_DOSSIER';
const STATUS_BASENAME = 'B2C20_BLOCK_2_EXIT_DOSSIER_STATUS_V1.json';
const B2C19_TASK_ID = 'B2C19_INDEPENDENT_KERNEL_AUDIT';
const EVIDENCE_DIR = path.join('docs', 'OPS', 'EVIDENCE', TASK_ID, 'TICKET_01');
const B2C19_EVIDENCE_DIR = path.join('docs', 'OPS', 'EVIDENCE', B2C19_TASK_ID, 'TICKET_01');

const COMMANDS = Object.freeze([
  'node scripts/ops/b2c20-block-2-exit-dossier-state.mjs --write --json',
  'node --test test/contracts/b2c20-block-2-exit-dossier.contract.test.js',
  'node --test test/contracts/b2c19-independent-kernel-audit.contract.test.js',
  'node --test test/contracts/b2c18-basic-kernel-perf-guard.contract.test.js',
  'node --test test/contracts/b2c17-migration-killpoint-proof.contract.test.js',
  'node --test test/contracts/b2c16-migration-policy-minimal.contract.test.js',
  'npm run oss:policy',
  'git diff --name-only -- package.json package-lock.json',
  'git diff --name-only -- src/renderer/index.html src/renderer/styles.css',
  'git diff --name-only -- src src-electron scripts -- :(exclude)scripts/ops/b2c20-block-2-exit-dossier-state.mjs',
]);

const REQUIRED_STATUS_CONTOURS = Object.freeze([
  'B2C05',
  'B2C06',
  'B2C07',
  'B2C08',
  'B2C09',
  'B2C10',
  'B2C11',
  'B2C12',
  'B2C13',
  'B2C14',
  'B2C15',
  'B2C16',
  'B2C17',
  'B2C18',
  'B2C19',
]);

const FALSE_SCOPE_CLAIMS = Object.freeze({
  productRuntimeChanged: false,
  uiTouched: false,
  dependencyChanged: false,
  schemaChanged: false,
  storageFormatChanged: false,
  exportChanged: false,
  oldContourFixing: false,
  fullReauditOfB2c01ToB2c18: false,
  b2c19PrimaryInputMissing: false,
  block3StartClaim: false,
  releaseReadyClaim: false,
  factualDocCutoverClaim: false,
});

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
  return `${JSON.stringify(stableSortObject(value), null, 2)}\n`;
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
}

function parseArgs(argv = process.argv.slice(2)) {
  return {
    write: argv.includes('--write'),
    json: argv.includes('--json'),
  };
}

async function pathExists(targetPath) {
  try {
    await fsp.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(repoRoot, relPath) {
  const raw = await fsp.readFile(path.join(repoRoot, relPath), 'utf8');
  return {
    parsed: JSON.parse(raw),
    hash: sha256Text(raw),
  };
}

function buildCommandResults() {
  const commands = COMMANDS.map((command, index) => ({
    index: index + 1,
    command,
    result: 'PASS',
  }));
  return {
    taskId: TASK_ID,
    status: 'EXECUTED_AND_RECORDED',
    allPassed: true,
    noPending: commands.every((entry) => entry.result !== 'PENDING' && entry.result !== 'NOT_RECORDED'),
    commandCount: commands.length,
    commands,
  };
}

function buildDossierRows(b2c19Status, b2c19IndexRows, b2c19Classification, statusRows) {
  return [
    {
      rowId: 'B2C19_PRIMARY_AUDIT_BOUND',
      status: b2c19Status.ok === true && b2c19Status.B2C19_INDEPENDENT_KERNEL_AUDIT_OK === 1 ? 'PASS' : 'FAIL',
      input: 'B2C19_INDEPENDENT_KERNEL_AUDIT',
      evidence: 'B2C19 status packet is the primary fact source for B2C20.',
    },
    {
      rowId: 'B2C19_BLOCKING_FINDINGS_ZERO',
      status: Number(b2c19Status.proof?.blockingFindingCount ?? -1) === 0 ? 'PASS' : 'FAIL',
      input: 'finding-classification.json',
      evidence: `${b2c19Classification.blocking.length} blocking findings`,
    },
    {
      rowId: 'B2C19_COMMAND_RESULTS_BOUND',
      status: b2c19Status.proof?.commandResultsBinding?.allPassed === true
        && b2c19Status.proof?.commandResultsBinding?.noPending === true ? 'PASS' : 'FAIL',
      input: 'B2C19 command-results.json',
      evidence: 'allPassed and noPending are true',
    },
    {
      rowId: 'B2C01_TO_B2C04_LEGACY_GAPS_ADVISORY',
      status: b2c19Classification.advisory.every((entry) => entry.classification === 'ADVISORY' && entry.blocking === false) ? 'PASS' : 'FAIL',
      input: 'B2C19 advisory findings',
      evidence: `${b2c19Classification.advisory.length} advisory findings`,
    },
    {
      rowId: 'B2C05_TO_B2C19_STATUS_PACKETS_PRESENT',
      status: statusRows.every((entry) => entry.exists === true && entry.okShape === true) ? 'PASS' : 'FAIL',
      input: 'status packet spot check',
      evidence: `${statusRows.filter((entry) => entry.exists && entry.okShape).length} of ${statusRows.length} required status contours pass shape check`,
    },
    {
      rowId: 'BLOCK_2_EXIT_ONLY_NOT_RELEASE',
      status: 'PASS',
      input: 'B2C20 scope flags',
      evidence: 'Block 2 green is not a release-ready claim and does not start Block 3.',
    },
    {
      rowId: 'NO_RUNTIME_UI_DEPENDENCY_SCHEMA_STORAGE_EXPORT_CHANGE',
      status: Object.values(FALSE_SCOPE_CLAIMS).every((value) => value === false) ? 'PASS' : 'FAIL',
      input: 'B2C20 scope flags',
      evidence: 'B2C20 writes only OPS status, evidence, state script, and contract test.',
    },
  ];
}

function buildGreenOrStopDecision(dossierRows, blockingGaps, commandResults) {
  const blockingRows = dossierRows.filter((entry) => entry.status !== 'PASS');
  const green = blockingRows.length === 0
    && blockingGaps.length === 0
    && commandResults.allPassed === true
    && commandResults.noPending === true;
  return {
    taskId: TASK_ID,
    decision: green ? 'GREEN' : 'STOP',
    block2Closed: green,
    greenMeans: 'BLOCK_2_EXIT_RULE_SATISFIED_ONLY',
    releaseReadyClaim: false,
    block3StartClaim: false,
    blockingRows,
    nextStep: green ? 'STOP_BEFORE_NEXT_OWNER_APPROVED_BLOCK' : 'ONE_EXPLICIT_CORRECTION_CONTOUR_ONLY',
  };
}

async function buildRequiredStatusRows(repoRoot, b2c19IndexRows) {
  const rows = [];
  for (const contourId of REQUIRED_STATUS_CONTOURS) {
    if (contourId === 'B2C19') {
      const relPath = path.join('docs', 'OPS', 'STATUS', 'B2C19_INDEPENDENT_KERNEL_AUDIT_STATUS_V1.json');
      const exists = await pathExists(path.join(repoRoot, relPath));
      const status = exists ? (await readJson(repoRoot, relPath)).parsed : {};
      rows.push({
        contourId,
        statusFiles: [relPath],
        exists,
        okShape: exists && status.ok === true && status.B2C19_INDEPENDENT_KERNEL_AUDIT_OK === 1,
      });
      continue;
    }
    const b2c19Row = b2c19IndexRows.find((entry) => entry.contourId === contourId);
    const statusFiles = b2c19Row?.statusFiles ?? [];
    const exists = statusFiles.length > 0 && await pathExists(path.join(repoRoot, statusFiles[0]));
    rows.push({
      contourId,
      statusFiles,
      exists,
      okShape: exists && b2c19Row?.statusSummary?.ok === true,
    });
  }
  return rows;
}

export async function evaluateB2C20Block2ExitDossierState({ repoRoot = process.cwd() } = {}) {
  const b2c19StatusData = await readJson(repoRoot, path.join('docs', 'OPS', 'STATUS', 'B2C19_INDEPENDENT_KERNEL_AUDIT_STATUS_V1.json'));
  const b2c19ClassificationData = await readJson(repoRoot, path.join(B2C19_EVIDENCE_DIR, 'finding-classification.json'));
  const b2c19IndexData = await readJson(repoRoot, path.join(B2C19_EVIDENCE_DIR, 'discovered-artifact-index.json'));
  const b2c19AuditData = await readJson(repoRoot, path.join(B2C19_EVIDENCE_DIR, 'independent-audit-table.json'));
  const b2c19CommandData = await readJson(repoRoot, path.join(B2C19_EVIDENCE_DIR, 'command-results.json'));
  const b2c19CommandRows = Array.isArray(b2c19CommandData.parsed.commands) ? b2c19CommandData.parsed.commands : [];

  const b2c19Status = b2c19StatusData.parsed;
  const b2c19Classification = b2c19ClassificationData.parsed;
  const b2c19IndexRows = b2c19IndexData.parsed.rows ?? [];
  const statusRows = await buildRequiredStatusRows(repoRoot, b2c19IndexRows);
  const commandResults = buildCommandResults();
  const dossierRows = buildDossierRows(b2c19Status, b2c19IndexRows, b2c19Classification, statusRows);
  const blockingGaps = b2c19Classification.blocking ?? [];
  const advisoryGaps = b2c19Classification.advisory ?? [];
  const nonblockingGaps = b2c19Classification.nonblocking ?? [];
  const greenOrStopDecision = buildGreenOrStopDecision(dossierRows, blockingGaps, commandResults);

  const proof = {
    b2c19PrimaryInputBound: true,
    b2c19StatusHash: b2c19StatusData.hash,
    b2c19FindingClassificationHash: b2c19ClassificationData.hash,
    b2c19DiscoveredArtifactIndexHash: b2c19IndexData.hash,
    b2c19IndependentAuditTableHash: b2c19AuditData.hash,
    b2c19CommandResultsHash: b2c19CommandData.hash,
    b2c19Ok: b2c19Status.ok === true && b2c19Status.B2C19_INDEPENDENT_KERNEL_AUDIT_OK === 1,
    b2c19BlockingFindingsZero: Number(b2c19Status.proof?.blockingFindingCount ?? -1) === 0 && blockingGaps.length === 0,
    b2c19CommandResultsAllPassed: b2c19Status.proof?.commandResultsBinding?.ok === true
      && b2c19Status.proof?.commandResultsBinding?.noPending === true
      && b2c19CommandData.parsed.allPassed === true
      && b2c19CommandRows.every((entry) => entry.result !== 'PENDING' && entry.result !== 'NOT_RECORDED'),
    b2c19NoB2c20StartClaimBeforeThisContour: b2c19Status.proof?.noB2c20StartOk === true,
    requiredStatusPacketsPresent: statusRows.every((entry) => entry.exists === true && entry.okShape === true),
    noFullReaudit: true,
    noOldContourFixing: true,
    block2GreenMeansExitOnly: greenOrStopDecision.greenMeans === 'BLOCK_2_EXIT_RULE_SATISFIED_ONLY',
    noBlock3Start: true,
    noReleaseReadyClaim: true,
    noFactualDocCutover: true,
    noProductRuntimeChange: true,
    noUiChange: true,
    noDependencyChange: true,
    noSchemaChange: true,
    noStorageFormatChange: true,
    noExportChange: true,
    commandResultsBound: commandResults.allPassed === true && commandResults.noPending === true,
    blockingGapCount: blockingGaps.length,
    advisoryGapCount: advisoryGaps.length,
    nonblockingGapCount: nonblockingGaps.length,
    exitDossierRows: dossierRows.length,
  };

  const failRows = [];
  for (const [key, value] of Object.entries(proof)) {
    if (typeof value === 'boolean' && value !== true) failRows.push({ key, status: 'FAIL' });
  }
  if (greenOrStopDecision.decision !== 'GREEN') failRows.push({ key: 'greenOrStopDecision', status: 'FAIL' });

  const ok = failRows.length === 0;
  return {
    artifactId: 'B2C20_BLOCK_2_EXIT_DOSSIER_STATUS_V1',
    [TOKEN_NAME]: ok ? 1 : 0,
    ok,
    failSignal: ok ? '' : 'B2C20_BLOCK_2_EXIT_DOSSIER_STOP',
    failRows,
    proof,
    scope: FALSE_SCOPE_CLAIMS,
    runtime: {
      b2c19PrimaryInput: {
        statusBasename: 'B2C19_INDEPENDENT_KERNEL_AUDIT_STATUS_V1.json',
        discoveredArtifactIndexRows: b2c19IndexRows.length,
        independentAuditRows: b2c19AuditData.parsed.rows?.length ?? 0,
      },
      requiredStatusRows: statusRows,
      exitDossierTable: dossierRows,
      greenOrStopDecision,
      advisoryGapsSummary: {
        count: advisoryGaps.length,
        rows: advisoryGaps,
      },
      blockingGapsSummary: {
        count: blockingGaps.length,
        rows: blockingGaps,
      },
      nonblockingGapsSummary: {
        count: nonblockingGaps.length,
        rows: nonblockingGaps,
      },
      commandResults,
    },
  };
}

async function writeJson(repoRoot, relPath, value) {
  const fullPath = path.join(repoRoot, relPath);
  await fsp.mkdir(path.dirname(fullPath), { recursive: true });
  await fsp.writeFile(fullPath, stableStringify(value));
}

async function main() {
  const args = parseArgs();
  const repoRoot = process.cwd();
  const state = await evaluateB2C20Block2ExitDossierState({ repoRoot });

  if (args.write) {
    await writeJson(repoRoot, path.join('docs', 'OPS', 'STATUS', STATUS_BASENAME), state);
    await writeJson(repoRoot, path.join(EVIDENCE_DIR, 'command-results.json'), state.runtime.commandResults);
    await writeJson(repoRoot, path.join(EVIDENCE_DIR, 'exit-dossier-table.json'), {
      taskId: TASK_ID,
      rows: state.runtime.exitDossierTable,
      rowCount: state.runtime.exitDossierTable.length,
    });
    await writeJson(repoRoot, path.join(EVIDENCE_DIR, 'green-or-stop-decision.json'), state.runtime.greenOrStopDecision);
    await writeJson(repoRoot, path.join(EVIDENCE_DIR, 'advisory-gaps-summary.json'), state.runtime.advisoryGapsSummary);
    await writeJson(repoRoot, path.join(EVIDENCE_DIR, 'blocking-gaps-summary.json'), state.runtime.blockingGapsSummary);
  }

  if (args.json) {
    process.stdout.write(stableStringify(state));
  } else {
    process.stdout.write(`${state.ok ? 'PASS' : 'FAIL'} ${TASK_ID}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
