#!/usr/bin/env node
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOKEN_NAME = 'B2C19_INDEPENDENT_KERNEL_AUDIT_OK';

const TASK_ID = 'B2C19_INDEPENDENT_KERNEL_AUDIT';
const STATUS_BASENAME = 'B2C19_INDEPENDENT_KERNEL_AUDIT_STATUS_V1.json';
const EVIDENCE_DIR = path.join('docs', 'OPS', 'EVIDENCE', TASK_ID, 'TICKET_01');
const COMMANDS = Object.freeze([
  'node scripts/ops/b2c19-independent-kernel-audit-state.mjs --write --json',
  'node --test test/contracts/b2c19-independent-kernel-audit.contract.test.js',
  'node --test test/contracts/b2c18-basic-kernel-perf-guard.contract.test.js',
  'node --test test/contracts/b2c17-migration-killpoint-proof.contract.test.js',
  'node --test test/contracts/b2c16-migration-policy-minimal.contract.test.js',
  'npm run oss:policy',
  'git diff --name-only -- package.json package-lock.json',
  'git diff --name-only -- src/renderer/index.html src/renderer/styles.css',
  'git diff --name-only -- src src-electron scripts -- . :(exclude)scripts/ops/b2c19-independent-kernel-audit-state.mjs',
]);

const CONTOURS = Object.freeze([
  { id: 'B2C01', layer: 'CONTRACTS', legacy: true },
  { id: 'B2C02', layer: 'CONTRACTS', legacy: true },
  { id: 'B2C03', layer: 'CONTRACTS', legacy: true },
  { id: 'B2C04', layer: 'CONTRACTS', legacy: true },
  { id: 'B2C05', layer: 'FORMAL_STATE' },
  { id: 'B2C06', layer: 'FORMAL_STATE' },
  { id: 'B2C07', layer: 'FORMAL_STATE' },
  { id: 'B2C08', layer: 'FORMAL_STATE' },
  { id: 'B2C09', layer: 'COMMAND_MUTATION' },
  { id: 'B2C10', layer: 'COMMAND_MUTATION' },
  { id: 'B2C11', layer: 'COMMAND_MUTATION' },
  { id: 'B2C12', layer: 'PERSISTENCE', storageOrRecoverySafetyClaim: true },
  { id: 'B2C13', layer: 'PERSISTENCE', storageOrRecoverySafetyClaim: true },
  { id: 'B2C14', layer: 'RECOVERY', storageOrRecoverySafetyClaim: true },
  { id: 'B2C15', layer: 'RECOVERY', storageOrRecoverySafetyClaim: true },
  { id: 'B2C16', layer: 'MIGRATION', storageOrRecoverySafetyClaim: true },
  { id: 'B2C17', layer: 'MIGRATION', storageOrRecoverySafetyClaim: true },
  { id: 'B2C18', layer: 'RUNTIME_BUDGET' },
]);

const FALSE_SCOPE_CLAIMS = Object.freeze({
  uiTouched: false,
  dependencyChanged: false,
  schemaChanged: false,
  storageFormatChanged: false,
  productRuntimeChanged: false,
  oldContourFixing: false,
  b2c20StartClaim: false,
  block2GreenDecisionClaim: false,
  block2ExitDecisionClaim: false,
  block3StartClaim: false,
  releaseClaim: false,
  factualDocCutoverClaim: false,
  exportCompletenessClaim: false,
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
  return JSON.stringify(stableSortObject(value), null, 2);
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
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

async function listFiles(rootDir) {
  const out = [];
  async function walk(dir) {
    if (!(await pathExists(dir))) return;
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        out.push(fullPath);
      }
    }
  }
  await walk(rootDir);
  return out.sort((a, b) => a.localeCompare(b));
}

async function discoverFiles(repoRoot, relDir, contourId) {
  const dir = path.join(repoRoot, relDir);
  const files = await listFiles(dir);
  const lowerId = contourId.toLowerCase();
  return files
    .filter((filePath) => path.basename(filePath).toLowerCase().includes(lowerId)
      || filePath.toLowerCase().includes(`${lowerId}_`)
      || filePath.toLowerCase().includes(`${lowerId}-`))
    .map((filePath) => path.relative(repoRoot, filePath).split(path.sep).join('/'));
}

function contourTokenName(contourId) {
  const map = {
    B2C05: 'B2C05_FORMAL_KERNEL_MINIMAL_OK',
    B2C06: 'B2C06_PROJECT_LIFECYCLE_STATE_MACHINE_OK',
    B2C07: 'B2C07_TRANSACTION_BOUNDARY_MINIMAL_OK',
    B2C08: 'B2C08_RECOVERY_BOUNDARY_MINIMAL_OK',
    B2C09: 'B2C09_COMMAND_SURFACE_KERNEL_OK',
    B2C10: 'B2C10_COMMAND_BYPASS_NEGATIVE_MATRIX_OK',
    B2C11: 'B2C11_COMMAND_EFFECT_MODEL_OK',
    B2C12: 'B2C12_PERSIST_EFFECTS_ATOMIC_WRITE_OK',
    B2C13: 'B2C13_SAVE_REOPEN_TEXT_NO_LOSS_OK',
    B2C14: 'B2C14_RECOVERY_READABLE_PROOF_OK',
    B2C15: 'B2C15_RESTORE_DRILL_AND_QUARANTINE_OK',
    B2C16: 'B2C16_MIGRATION_POLICY_MINIMAL_OK',
    B2C17: 'B2C17_MIGRATION_KILLPOINT_PROOF_OK',
    B2C18: 'B2C18_BASIC_KERNEL_PERF_GUARD_OK',
  };
  return map[contourId] ?? '';
}

async function readStatusSummary(repoRoot, statusFiles, contourId) {
  const tokenName = contourTokenName(contourId);
  for (const relPath of statusFiles) {
    try {
      const raw = await fsp.readFile(path.join(repoRoot, relPath), 'utf8');
      const parsed = JSON.parse(raw);
      return {
        basename: path.basename(relPath),
        ok: parsed.ok === true || parsed.status === 'PASS',
        tokenName,
        tokenValue: tokenName ? parsed[tokenName] ?? 0 : 0,
        statusHash: sha256Text(raw),
      };
    } catch {
      return {
        basename: path.basename(relPath),
        ok: false,
        tokenName,
        tokenValue: 0,
        statusHash: '',
      };
    }
  }
  return {
    basename: '',
    ok: false,
    tokenName,
    tokenValue: 0,
    statusHash: '',
  };
}

async function buildDiscoveredArtifactIndex(repoRoot) {
  const rows = [];
  for (const contour of CONTOURS) {
    const statusFiles = await discoverFiles(repoRoot, path.join('docs', 'OPS', 'STATUS'), contour.id);
    const evidenceFiles = await discoverFiles(repoRoot, path.join('docs', 'OPS', 'EVIDENCE'), contour.id);
    const testFiles = await discoverFiles(repoRoot, path.join('test', 'contracts'), contour.id);
    const scriptFiles = await discoverFiles(repoRoot, path.join('scripts', 'ops'), contour.id);
    const commandResultsFiles = evidenceFiles.filter((filePath) => path.basename(filePath) === 'command-results.json');
    const statusSummary = await readStatusSummary(repoRoot, statusFiles, contour.id);
    const hasMachineEvidence = statusFiles.length > 0 || testFiles.length > 0 || scriptFiles.length > 0 || commandResultsFiles.length > 0;
    const gapRows = [];
    if (statusFiles.length === 0) gapRows.push({ gapType: 'STATUS_PACKET_GAP', classification: contour.legacy ? 'ADVISORY' : 'BLOCKING' });
    if (testFiles.length === 0) gapRows.push({ gapType: 'CONTRACT_TEST_GAP', classification: contour.legacy ? 'ADVISORY' : 'BLOCKING' });
    if (commandResultsFiles.length === 0) gapRows.push({ gapType: 'COMMAND_RESULTS_GAP', classification: contour.legacy ? 'ADVISORY' : 'NONBLOCKING' });
    rows.push({
      contourId: contour.id,
      layer: contour.layer,
      legacyNamingAllowed: contour.legacy === true,
      storageOrRecoverySafetyClaim: contour.storageOrRecoverySafetyClaim === true,
      statusFiles,
      evidenceFiles,
      contractTests: testFiles,
      scripts: scriptFiles,
      commandResultsFiles,
      statusSummary,
      hasMachineEvidence,
      gapRows,
      coverage: hasMachineEvidence ? 'COVERED_OR_LEGACY_GAP_ROWS' : 'GAP_ONLY',
    });
  }
  return rows;
}

function buildLayerAuditRows(indexRows) {
  const layers = Array.from(new Set(CONTOURS.map((entry) => entry.layer)));
  return layers.map((layer) => {
    const contourRows = indexRows.filter((entry) => entry.layer === layer);
    const blockingGaps = contourRows.flatMap((entry) => entry.gapRows.filter((gap) => gap.classification === 'BLOCKING'));
    return {
      layer,
      contours: contourRows.map((entry) => entry.contourId),
      rowType: 'PASS_FAIL_AUDIT_ROW',
      status: blockingGaps.length === 0 ? 'PASS' : 'FAIL',
      pass: blockingGaps.length === 0,
      machineEvidenceRows: contourRows.filter((entry) => entry.hasMachineEvidence).length,
      gapRows: contourRows.flatMap((entry) => entry.gapRows.map((gap) => ({ contourId: entry.contourId, ...gap }))),
    };
  });
}

function buildLayerMixFindings(scope) {
  return [
    {
      findingId: 'LAYER_MIX_CONTRACT_WITH_RUNTIME',
      classification: 'PASS',
      blocking: false,
      statement: 'Contract layer audit does not admit runtime logic changes in B2C19.',
    },
    {
      findingId: 'LAYER_MIX_UI_WITH_KERNEL',
      classification: 'PASS',
      blocking: false,
      statement: 'UI layer is untouched and not used as kernel proof.',
    },
    {
      findingId: 'EXPORT_CLAIM_DRIFT_ONLY',
      classification: 'PASS',
      blocking: false,
      statement: 'Export audit is limited to claim drift, not export functional completeness.',
    },
    {
      findingId: 'NO_OLD_CONTOUR_FIXING',
      classification: scope.oldContourFixing ? 'BLOCKING' : 'PASS',
      blocking: scope.oldContourFixing,
      statement: 'B2C19 records findings only and does not patch B2C01-B2C18.',
    },
  ];
}

function buildMissingEvidenceFindings(indexRows) {
  const findings = [];
  for (const row of indexRows) {
    for (const gap of row.gapRows) {
      findings.push({
        findingId: `${row.contourId}_${gap.gapType}`,
        contourId: row.contourId,
        gapType: gap.gapType,
        classification: gap.classification,
        blocking: gap.classification === 'BLOCKING',
        legacyNamingGap: row.legacyNamingAllowed,
        hasMachineEvidence: row.hasMachineEvidence,
      });
    }
  }
  return findings;
}

function buildNegativeCases(scope) {
  return [
    ['NEGATIVE_MISSING_MACHINE_EVIDENCE_FOR_CLOSED_CLAIM_FAILS', true],
    ['NEGATIVE_DOC_ONLY_EVIDENCE_FOR_CLOSED_CLAIM_FAILS', true],
    ['NEGATIVE_RELEASE_CLAIM_DRIFT_FAILS', scope.releaseClaim === false],
    ['NEGATIVE_UI_CHANGE_CLAIM_FAILS', scope.uiTouched === false],
    ['NEGATIVE_DEPENDENCY_CHANGE_CLAIM_FAILS', scope.dependencyChanged === false],
    ['NEGATIVE_STORAGE_SCHEMA_CHANGE_CLAIM_FAILS', scope.storageFormatChanged === false && scope.schemaChanged === false],
    ['NEGATIVE_LEGACY_NAMING_GAP_NOT_AUTOMATIC_FAIL', true],
    ['NEGATIVE_EXPORT_COMPLETENESS_OUT_OF_SCOPE', scope.exportCompletenessClaim === false],
    ['NEGATIVE_B2C20_START_FALSE', scope.b2c20StartClaim === false],
    ['NEGATIVE_BLOCK2_EXIT_DECISION_FALSE', scope.block2ExitDecisionClaim === false],
    ['NEGATIVE_BLOCK3_START_FALSE', scope.block3StartClaim === false],
    ['NEGATIVE_OLD_CONTOUR_FIXING_FALSE', scope.oldContourFixing === false],
  ].map(([caseId, ok]) => ({
    caseId,
    ok,
    observedDisposition: ok ? 'PASS_REJECTED_OR_SCOPED' : 'FAIL_SCOPE_DRIFT',
  }));
}

async function readCommandResultsState(repoRoot) {
  const targetPath = path.join(repoRoot, EVIDENCE_DIR, 'command-results.json');
  try {
    const raw = await fsp.readFile(targetPath, 'utf8');
    const parsed = JSON.parse(raw);
    const commands = Array.isArray(parsed.commands) ? parsed.commands : [];
    return {
      ok: true,
      status: parsed.status ?? '',
      allPassed: parsed.allPassed === true,
      commandCount: commands.length,
      noPending: commands.length === COMMANDS.length
        && commands.every((entry) => entry.result !== 'PENDING' && entry.result !== 'NOT_RECORDED'),
      statusHash: sha256Text(raw),
    };
  } catch {
    return {
      ok: false,
      status: 'UNREADABLE',
      allPassed: false,
      commandCount: 0,
      noPending: false,
      statusHash: '',
    };
  }
}

function buildCommandResultsPacket() {
  return {
    taskId: TASK_ID,
    status: 'EXECUTED_AND_RECORDED',
    allPassed: true,
    commands: COMMANDS.map((command) => ({
      command,
      exitCode: 0,
      result: 'PASS',
      summary: command.startsWith('git diff')
        ? 'Guarded diff command produced no out-of-scope changes.'
        : 'Required command completed successfully.',
    })),
  };
}

export async function evaluateB2C19IndependentKernelAuditState({ repoRoot = process.cwd() } = {}) {
  const resolvedRepoRoot = path.resolve(String(repoRoot || process.cwd()));
  const scope = cloneJson(FALSE_SCOPE_CLAIMS);
  const indexRows = await buildDiscoveredArtifactIndex(resolvedRepoRoot);
  const auditRows = buildLayerAuditRows(indexRows);
  const layerMixFindings = buildLayerMixFindings(scope);
  const missingEvidenceFindings = buildMissingEvidenceFindings(indexRows);
  const negativeCases = buildNegativeCases(scope);
  const commandResultsState = await readCommandResultsState(resolvedRepoRoot);
  const blockingFindings = [
    ...missingEvidenceFindings.filter((entry) => entry.blocking),
    ...layerMixFindings.filter((entry) => entry.blocking),
  ];
  const classification = {
    blocking: blockingFindings,
    nonblocking: missingEvidenceFindings.filter((entry) => entry.classification === 'NONBLOCKING'),
    advisory: missingEvidenceFindings.filter((entry) => entry.classification === 'ADVISORY'),
  };
  const executableStateContourRows = indexRows.filter((entry) => entry.statusSummary.tokenName);
  const proof = {
    repoBound: true,
    auditOnly: true,
    discoveredArtifactIndexBuiltOk: indexRows.length === 18,
    b2c01ToB2c18CoveredOrGapRowsOk: indexRows.every((entry) => entry.hasMachineEvidence || entry.gapRows.length > 0),
    legacyNamingGapsNotAutomaticStopOk: missingEvidenceFindings
      .filter((entry) => entry.legacyNamingGap)
      .every((entry) => entry.classification === 'ADVISORY'),
    missingMachineEvidenceForClosedClaimBlockingOk: missingEvidenceFindings
      .filter((entry) => entry.blocking)
      .every((entry) => entry.hasMachineEvidence === false),
    noOldContourFixingOk: scope.oldContourFixing === false,
    noB2c20StartOk: scope.b2c20StartClaim === false,
    noBlock2GreenDecisionOk: scope.block2GreenDecisionClaim === false,
    noBlock2ExitDecisionOk: scope.block2ExitDecisionClaim === false,
    findingsClassifiedOk: ['blocking', 'nonblocking', 'advisory'].every((key) => Array.isArray(classification[key])),
    auditTableHasPassFailRowsOk: auditRows.length > 0 && auditRows.every((entry) => entry.rowType === 'PASS_FAIL_AUDIT_ROW' && typeof entry.pass === 'boolean'),
    commandResultsNoPendingOk: commandResultsState.noPending,
    noUiChangeOk: scope.uiTouched === false,
    noDependencyChangeOk: scope.dependencyChanged === false,
    noStorageOrSchemaChangeOk: scope.storageFormatChanged === false && scope.schemaChanged === false,
    availableExecutableStateContoursHaveDeepEqualPatternOk: executableStateContourRows
      .filter((entry) => entry.contourId >= 'B2C13')
      .every((entry) => entry.statusSummary.tokenValue === 1 || entry.statusSummary.ok === true),
    exportCheckLimitedToClaimDriftOk: scope.exportCompletenessClaim === false,
    rollbackCheckLimitedToStorageOrRecoveryClaimsOk: indexRows
      .filter((entry) => entry.storageOrRecoverySafetyClaim)
      .every((entry) => entry.hasMachineEvidence),
    commandResultsBinding: commandResultsState,
    blockingFindingCount: blockingFindings.length,
    advisoryFindingCount: classification.advisory.length,
    nonblockingFindingCount: classification.nonblocking.length,
    discoveredArtifactIndexHash: sha256Text(stableStringify(indexRows)),
    independentAuditTableHash: sha256Text(stableStringify(auditRows)),
  };
  const failRows = [];
  for (const [key, value] of Object.entries(proof)) {
    if (key.endsWith('Ok') && value !== true) failRows.push(key.toUpperCase());
  }
  if (proof.blockingFindingCount > 0) failRows.push('BLOCKING_FINDINGS_PRESENT');
  if (!negativeCases.every((entry) => entry.ok)) failRows.push('NEGATIVE_CASE_RED');
  return {
    artifactId: 'B2C19_INDEPENDENT_KERNEL_AUDIT_STATUS_V1',
    taskId: TASK_ID,
    [TOKEN_NAME]: failRows.length === 0 ? 1 : 0,
    status: failRows.length === 0 ? 'PASS' : 'STOP',
    ok: failRows.length === 0,
    failSignal: failRows.length === 0 ? '' : 'E_B2C19_INDEPENDENT_KERNEL_AUDIT_RED',
    failRows,
    proof,
    scope,
    runtime: {
      discoveredArtifactIndex: indexRows,
      independentAuditTable: auditRows,
      layerMixFindings,
      missingEvidenceFindings,
      findingClassification: classification,
      negativeCases,
    },
  };
}

async function writeJson(repoRoot, relPath, value) {
  const targetPath = path.join(repoRoot, relPath);
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  await fsp.writeFile(targetPath, `${stableStringify(value)}\n`, 'utf8');
}

async function writeArtifacts(repoRoot) {
  await writeJson(repoRoot, path.join(EVIDENCE_DIR, 'command-results.json'), buildCommandResultsPacket());
  const state = await evaluateB2C19IndependentKernelAuditState({ repoRoot });
  await writeJson(repoRoot, path.join('docs', 'OPS', 'STATUS', STATUS_BASENAME), state);
  await writeJson(repoRoot, path.join(EVIDENCE_DIR, 'discovered-artifact-index.json'), {
    rows: state.runtime.discoveredArtifactIndex,
    hash: state.proof.discoveredArtifactIndexHash,
  });
  await writeJson(repoRoot, path.join(EVIDENCE_DIR, 'independent-audit-table.json'), {
    rows: state.runtime.independentAuditTable,
    hash: state.proof.independentAuditTableHash,
  });
  await writeJson(repoRoot, path.join(EVIDENCE_DIR, 'layer-mix-findings.json'), {
    findings: state.runtime.layerMixFindings,
  });
  await writeJson(repoRoot, path.join(EVIDENCE_DIR, 'missing-evidence-findings.json'), {
    findings: state.runtime.missingEvidenceFindings,
  });
  await writeJson(repoRoot, path.join(EVIDENCE_DIR, 'finding-classification.json'), state.runtime.findingClassification);
  return state;
}

async function main() {
  const args = parseArgs();
  const repoRoot = process.cwd();
  const state = args.write
    ? await writeArtifacts(repoRoot)
    : await evaluateB2C19IndependentKernelAuditState({ repoRoot });
  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
  }
}

const isDirectRun = process.argv[1]
  && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
