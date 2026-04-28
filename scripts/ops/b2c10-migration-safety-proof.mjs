#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const STATUS_REF = 'docs/OPS/STATUS/B2C10_MIGRATION_SAFETY_PROOF_V1.json';
const TOKEN_NAME = 'B2C10_MIGRATION_SAFETY_PROOF_OK';

const EXPECTED_ADMITTED_ROWS = Object.freeze([
  {
    rowId: 'DECLARED_MIGRATION_CHAIN_COMPLETE',
    proofLevel: 'DECLARED_CHAIN_COVERAGE_100',
  },
  {
    rowId: 'DOCUMENTS_TEMP_SWAP_AND_MARKER_ORDERING',
    proofLevel: 'MARKER_BEFORE_SWAP_AND_BACKUP_RESTORE',
  },
  {
    rowId: 'CRASH_WINDOW_NEGATIVE_GUARDS',
    proofLevel: 'CRASH_WINDOW_NEGATIVES_AND_SOURCE_HARDENING',
  },
]);

const EXPECTED_ADVISORY_ROWS = Object.freeze([
  {
    rowId: 'UNKNOWN_VERSION_AUTOREWRITE',
    proofLevel: 'ADVISORY_ONLY_NOT_MACHINE_PROVED',
  },
  {
    rowId: 'RELEASE_XPLAT_MIGRATION_POLICY',
    proofLevel: 'ADVISORY_ONLY_OUT_OF_SCOPE',
  },
]);

const EXPECTED_BOUNDARY_ROWS = Object.freeze([
  {
    rowId: 'DECLARED_MIGRATION_CHAIN_COMPLETE',
    detectorId: 'B2C10_DECLARED_MIGRATION_CHAIN_COMPLETE_PROOF_BINDING_V1',
  },
  {
    rowId: 'DOCUMENTS_TEMP_SWAP_AND_MARKER_ORDERING',
    detectorId: 'B2C10_DOCUMENTS_TEMP_SWAP_AND_MARKER_ORDERING_PROOF_BINDING_V1',
  },
  {
    rowId: 'CRASH_WINDOW_NEGATIVE_GUARDS',
    detectorId: 'B2C10_CRASH_WINDOW_NEGATIVE_GUARDS_PROOF_BINDING_V1',
  },
]);

const EXPECTED_FORBIDDEN_AREAS = Object.freeze([
  'releaseProtocol',
  'xplatNormalization',
  'runtimeMigrationOrchestration',
  'permissionModel',
  'queueing',
  'concurrency',
  'extraMigrationCluster',
]);

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readJsonObject(absPath) {
  const parsed = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  if (!isObjectRecord(parsed)) {
    throw new Error(`JSON_OBJECT_EXPECTED:${absPath}`);
  }
  return parsed;
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

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildFailure(code, extra = {}) {
  return {
    ok: false,
    code,
    [TOKEN_NAME]: 0,
    ...extra,
  };
}

function collectKeyPaths(value, prefix = '') {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectKeyPaths(entry, `${prefix}[${index}]`));
  }
  if (!isObjectRecord(value)) return [];
  const out = [];
  for (const [key, child] of Object.entries(value)) {
    const location = prefix ? `${prefix}.${key}` : key;
    out.push({ key, location });
    out.push(...collectKeyPaths(child, location));
  }
  return out;
}

async function loadMigrationCompleteness(repoRoot) {
  return import(pathToFileURL(
    path.resolve(repoRoot, 'scripts/ops/migration-completeness-verifier-state.mjs'),
  ).href);
}

async function loadCrashWindow(repoRoot) {
  return import(pathToFileURL(
    path.resolve(repoRoot, 'scripts/ops/p2-ws02-migration-crash-window-reduction-state.mjs'),
  ).href);
}

function verifyCanonBoundary(repoRoot) {
  const canonText = fs.readFileSync(path.resolve(repoRoot, 'CANON.md'), 'utf8');
  const bibleText = fs.readFileSync(path.resolve(repoRoot, 'docs/BIBLE.md'), 'utf8');
  const contextText = fs.readFileSync(path.resolve(repoRoot, 'docs/CONTEXT.md'), 'utf8');

  if (!canonText.includes('atomic write и recovery обязательны')
    || !bibleText.includes('atomic write required')
    || !bibleText.includes('recovery required')
    || !bibleText.includes('provenance for export and migrations')
    || !contextText.includes('atomic write и recovery остаются обязательными')) {
    throw new Error('MIGRATION_CANON_BOUNDARY_DRIFT');
  }
}

function verifyDocumentsSwapOrdering(repoRoot) {
  const source = fs.readFileSync(path.resolve(repoRoot, 'src/utils/fileManager.js'), 'utf8');
  const preserveIndex = source.indexOf('await copyDirectoryContents(targetPath, tempPath, { overwriteExisting: true });');
  const legacyCopyIndex = source.indexOf('await copyDirectoryContents(legacyPath, tempPath, { overwriteExisting: false });');
  const markerIndex = source.indexOf("await fs.writeFile(tempMarkerPath, 'migrated from WriterEditor', 'utf8');");
  const backupIndex = source.indexOf('await fs.rename(targetPath, backupPath);');
  const swapIndex = source.indexOf('await fs.rename(tempPath, targetPath);');
  const restoreIndex = source.indexOf('await fs.rename(backupPath, targetPath);');

  if (preserveIndex < 0
    || legacyCopyIndex < 0
    || markerIndex < 0
    || backupIndex < 0
    || swapIndex < 0
    || restoreIndex < 0
    || !(preserveIndex < legacyCopyIndex
      && legacyCopyIndex < markerIndex
      && markerIndex < swapIndex)) {
    throw new Error('MIGRATION_DOCUMENTS_SWAP_ORDER_DRIFT');
  }
}

function verifyUserDataOrdering(repoRoot) {
  const source = fs.readFileSync(path.resolve(repoRoot, 'src/main.js'), 'utf8');
  const markerCheckIndex = source.indexOf('if (fsSync.existsSync(markerPath))');
  const targetContentIndex = source.indexOf('if (hasDirectoryContent(targetPath))');
  const legacyCheckIndex = source.indexOf('if (!hasDirectoryContent(legacyPath))');
  const copyIndex = source.indexOf('await copyDirectoryContents(legacyPath, targetPath);');
  const markerWriteIndex = source.indexOf("await fs.writeFile(markerPath, 'migrated from WriterEditor', 'utf8');");

  if (markerCheckIndex < 0
    || targetContentIndex < 0
    || legacyCheckIndex < 0
    || copyIndex < 0
    || markerWriteIndex < 0
    || !(markerCheckIndex < targetContentIndex
      && targetContentIndex < legacyCheckIndex
      && legacyCheckIndex < copyIndex
      && copyIndex < markerWriteIndex)) {
    throw new Error('MIGRATION_USERDATA_ORDER_DRIFT');
  }
}

async function verifyMigrationCompletenessState(repoRoot) {
  const { evaluateMigrationCompletenessVerifierState } = await loadMigrationCompleteness(repoRoot);
  const state = evaluateMigrationCompletenessVerifierState({ repoRoot });
  if (state.ok !== true
    || state.MIGRATION_COMPLETENESS_VERIFIER_OK !== 1
    || state.migrationCoverage?.coverage100 !== true
    || state.migrationNegativeMissingStep?.ok !== true
    || state.backwardCompatibility?.ok !== true
    || state.advisoryToBlockingDriftCount !== 0
    || state.safetyParity?.ok !== true) {
    throw new Error('MIGRATION_COMPLETENESS_STATE_RED');
  }
}

async function verifyCrashWindowState(repoRoot) {
  const { evaluateP2Ws02MigrationCrashWindowReductionState } = await loadCrashWindow(repoRoot);
  const state = evaluateP2Ws02MigrationCrashWindowReductionState({ repoRoot });
  if (state.ok !== true
    || state.P2_WS02_MIGRATION_CRASH_WINDOW_REDUCTION_OK !== 1
    || state.sourceHardening?.ok !== true
    || state.counts?.crashWindowUnsafePathCount !== 0
    || Object.values(state.negativeResults || {}).some((value) => value !== true)
    || Object.values(state.positiveResults || {}).some((value) => value !== true)
    || state.advisoryToBlockingDriftCount !== 0) {
    throw new Error('MIGRATION_CRASH_WINDOW_STATE_RED');
  }
}

function verifyContracts(repoRoot) {
  const contracts = [
    'test/contracts/migration-completeness-verifier.contract.test.js',
    'test/contracts/p2-ws02-migration-crash-window-reduction.contract.test.js',
  ];
  for (const contractPath of contracts) {
    const result = fs.existsSync(path.resolve(repoRoot, contractPath));
    if (!result) {
      throw new Error(`MIGRATION_CONTRACT_MISSING:${contractPath}`);
    }
  }
}

export async function evaluateB2C10MigrationSafetyProof({
  repoRoot = process.cwd(),
  statusRef = STATUS_REF,
} = {}) {
  try {
    const doc = readJsonObject(path.resolve(repoRoot, statusRef));
    if (normalizeString(doc.artifactId) !== 'B2C10_MIGRATION_SAFETY_PROOF_V1'
      || doc.schemaVersion !== 1
      || normalizeString(doc.taskId) !== 'B2C10_MIGRATION_SAFETY_PROOF'
      || normalizeString(doc.status) !== 'PASS') {
      return buildFailure('E_B2C10_STATUS_ARTIFACT_INVALID');
    }

    const boundary = isObjectRecord(doc.boundary) ? doc.boundary : {};
    const proofBinding = isObjectRecord(doc.proofBinding) ? doc.proofBinding : {};
    const admittedRows = Array.isArray(boundary.admittedBoundaryRows) ? boundary.admittedBoundaryRows : [];
    const advisoryRows = Array.isArray(boundary.advisoryBoundaryRows) ? boundary.advisoryBoundaryRows : [];
    const bindingRows = Array.isArray(proofBinding.boundaryRows) ? proofBinding.boundaryRows : [];

    if (normalizeString(boundary.migrationSafetyId) !== 'ZERO_SILENT_REWRITE_MIGRATION_BOUNDARY'
      || !sameJson(admittedRows, EXPECTED_ADMITTED_ROWS)
      || !sameJson(advisoryRows, EXPECTED_ADVISORY_ROWS)) {
      return buildFailure('E_B2C10_BOUNDARY_SET');
    }

    if (normalizeString(proofBinding.bindingMode) !== 'DETECTOR_IDS_ONLY'
      || !sameJson(bindingRows, EXPECTED_BOUNDARY_ROWS)) {
      return buildFailure('E_B2C10_DETECTOR_BINDING');
    }

    const detectorIds = bindingRows.map((row) => normalizeString(row.detectorId));
    if (new Set(detectorIds).size !== detectorIds.length) {
      return buildFailure('E_B2C10_DETECTOR_BINDING');
    }

    const advisoryBoundary = isObjectRecord(doc.advisoryBoundary) ? doc.advisoryBoundary : {};
    if (normalizeString(advisoryBoundary.unknownVersionPromotion)
          !== 'ADVISORY_ONLY_UNKNOWN_VERSION_AUTOREWRITE_NOT_MACHINE_PROVED'
      || normalizeString(advisoryBoundary.noSilentRewritePromotion)
          !== 'ADVISORY_ONLY_OUTSIDE_MACHINE_PROVED_DOCUMENTS_SWAP_ROWS'
      || normalizeString(advisoryBoundary.releaseXplatPromotion)
          !== 'ADVISORY_ONLY_RELEASE_AND_XPLAT_POLICY_OUT_OF_SCOPE'
      || normalizeString(advisoryBoundary.runtimeMigrationPromotion)
          !== 'ADVISORY_ONLY_RUNTIME_MIGRATION_ORCHESTRATION_OUT_OF_SCOPE'
      || !sameJson(advisoryBoundary.forbiddenPromotionAreas, EXPECTED_FORBIDDEN_AREAS)) {
      return buildFailure('E_B2C10_ADVISORY_BOUNDARY');
    }

    const forbiddenKeys = new Set([
      'releaseProtocol',
      'xplatNormalization',
      'runtimeMigrationOrchestration',
      'permissionModel',
      'queueing',
      'concurrency',
      'extraMigrationCluster',
    ]);
    const forbiddenHits = collectKeyPaths(doc)
      .filter((entry) => forbiddenKeys.has(entry.key))
      .map((entry) => entry.location);
    if (forbiddenHits.length > 0) {
      return buildFailure('E_B2C10_FORBIDDEN_SCOPE', { forbiddenHits });
    }

    verifyCanonBoundary(repoRoot);
    verifyDocumentsSwapOrdering(repoRoot);
    verifyUserDataOrdering(repoRoot);
    await verifyMigrationCompletenessState(repoRoot);
    await verifyCrashWindowState(repoRoot);
    verifyContracts(repoRoot);

    return {
      ok: true,
      code: '',
      [TOKEN_NAME]: 1,
      migrationSafetyId: boundary.migrationSafetyId,
      admittedBoundaryRowCount: admittedRows.length,
      advisoryBoundaryRowCount: advisoryRows.length,
    };
  } catch (error) {
    return buildFailure(
      normalizeString(error?.message) || 'E_B2C10_RUNTIME_FAILURE',
      {
        details: {
          message: normalizeString(error?.message),
        },
      },
    );
  }
}

function parseArgs(argv) {
  const out = { json: false };
  for (const arg of argv) {
    if (arg === '--json') out.json = true;
  }
  return out;
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`B2C10_CODE=${state.code}`);
  console.log(`B2C10_MIGRATION_SAFETY_ID=${state.migrationSafetyId || ''}`);
  console.log(`B2C10_ADMITTED_ROWS=${state.admittedBoundaryRowCount || 0}`);
  console.log(`B2C10_ADVISORY_ROWS=${state.advisoryBoundaryRowCount || 0}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = await evaluateB2C10MigrationSafetyProof();
  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
  } else {
    printHuman(state);
  }
  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) {
  await main();
}
