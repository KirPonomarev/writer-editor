#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const STATUS_REF = 'docs/OPS/STATUS/B2C08_RECOVERY_BOUNDARY_MINIMAL_V1.json';
const TOKEN_NAME = 'B2C08_RECOVERY_BOUNDARY_MINIMAL_OK';

const EXPECTED_ADMITTED_ROWS = Object.freeze([
  {
    rowId: 'HUMAN_READABLE_RECOVERY_ARTIFACT',
    proofLevel: 'SNAPSHOT_TEXT_READABILITY',
  },
  {
    rowId: 'RECOVERY_SNAPSHOT_RESTORE_BOUNDARY',
    proofLevel: 'TYPED_SNAPSHOT_FALLBACK',
  },
  {
    rowId: 'RECOVERY_REPLAY_DETERMINISM',
    proofLevel: 'REPLAY_HASH_DETERMINISM',
  },
]);

const EXPECTED_ADVISORY_ROWS = Object.freeze([
  {
    rowId: 'FULL_RECOVERY_PROTOCOL',
    proofLevel: 'ADVISORY_ONLY_OUT_OF_SCOPE',
  },
  {
    rowId: 'LAST_STABLE_RUNTIME_RESTORE',
    proofLevel: 'ADVISORY_ONLY_SHELL_PROTOCOL_SEPARATE',
  },
]);

const EXPECTED_BOUNDARY_ROWS = Object.freeze([
  {
    rowId: 'HUMAN_READABLE_RECOVERY_ARTIFACT',
    detectorId: 'B2C08_HUMAN_READABLE_RECOVERY_ARTIFACT_PROOF_BINDING_V1',
  },
  {
    rowId: 'RECOVERY_SNAPSHOT_RESTORE_BOUNDARY',
    detectorId: 'B2C08_RECOVERY_SNAPSHOT_RESTORE_BOUNDARY_PROOF_BINDING_V1',
  },
  {
    rowId: 'RECOVERY_REPLAY_DETERMINISM',
    detectorId: 'B2C08_RECOVERY_REPLAY_DETERMINISM_PROOF_BINDING_V1',
  },
]);

const EXPECTED_FORBIDDEN_AREAS = Object.freeze([
  'queueing',
  'concurrency',
  'fullRecoveryProtocol',
  'runtimeCommandSurfaceExpansion',
  'crossProjectRuntimeOrchestration',
  'extraRecoveryCluster',
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

function runNodeScript(repoRoot, relativePath, args = []) {
  return spawnSync(process.execPath, [relativePath, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      NO_COLOR: '1',
    },
  });
}

function verifyCanonBoundary(repoRoot) {
  const canonText = fs.readFileSync(path.resolve(repoRoot, 'CANON.md'), 'utf8');
  const bibleText = fs.readFileSync(path.resolve(repoRoot, 'docs/BIBLE.md'), 'utf8');
  if (!canonText.includes('atomic write') || !canonText.includes('recovery')) {
    throw new Error('CANON_RECOVERY_REQUIRED_MISSING');
  }
  if (!bibleText.includes('atomic write required') || !bibleText.includes('recovery required')) {
    throw new Error('BIBLE_RECOVERY_REQUIRED_MISSING');
  }
}

async function loadMarkdownIo(repoRoot) {
  return import(pathToFileURL(path.resolve(repoRoot, 'src/io/markdown/index.mjs')).href);
}

async function verifyRecoveryIoBundle(repoRoot) {
  const run = runNodeScript(repoRoot, 'scripts/ops/recovery-io-state.mjs', ['--json']);
  if (run.status !== 0) {
    throw new Error('RECOVERY_IO_STATE_RED');
  }
  const payload = JSON.parse(String(run.stdout || '{}'));
  if (payload.RECOVERY_IO_OK !== 1) {
    throw new Error('RECOVERY_IO_TOKEN_RED');
  }
}

async function verifyHumanReadableRecoveryArtifact(repoRoot) {
  const io = await loadMarkdownIo(repoRoot);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'b2c08-human-readable-'));
  const target = path.join(dir, 'scene.md');
  const original = 'Readable recovery snapshot\nSecond line\n';
  fs.writeFileSync(target, original, 'utf8');

  const snapshot = await io.createRecoverySnapshot(target, { now: () => 1700000000001 });
  if (snapshot.snapshotCreated !== true) {
    throw new Error('HUMAN_READABLE_SNAPSHOT_NOT_CREATED');
  }
  const snapshotBase = path.basename(snapshot.snapshotPath);
  if (!/^\.scene\.md\.bak\.\d{13}$/u.test(snapshotBase)) {
    throw new Error('HUMAN_READABLE_SNAPSHOT_NAME_DRIFT');
  }
  const snapshotText = fs.readFileSync(snapshot.snapshotPath, 'utf8');
  if (snapshotText !== original) {
    throw new Error('HUMAN_READABLE_SNAPSHOT_TEXT_DRIFT');
  }
}

async function verifyRecoveryRestoreBoundary(repoRoot) {
  const io = await loadMarkdownIo(repoRoot);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'b2c08-restore-boundary-'));
  const target = path.join(dir, 'scene.md');
  const original = 'Snapshot recovery text\n';

  fs.writeFileSync(target, original, 'utf8');
  const snapshot = await io.createRecoverySnapshot(target, { now: () => 1700000000999 });
  fs.writeFileSync(target, Buffer.from([0x41, 0x00, 0x42]));

  const recovered = await io.readMarkdownWithRecovery(target, { maxInputBytes: 1024 * 1024 });
  if (recovered.sourceKind !== 'snapshot'
    || recovered.recoveredFromSnapshot !== true
    || recovered.recoveryAction !== 'OPEN_SNAPSHOT'
    || recovered.snapshotPath !== snapshot.snapshotPath
    || recovered.sourcePath !== target
    || recovered.text !== original
    || normalizeString(recovered.primaryError?.code) !== 'E_IO_CORRUPT_INPUT') {
    throw new Error('RESTORE_BOUNDARY_SNAPSHOT_FALLBACK_DRIFT');
  }

  fs.writeFileSync(target, Buffer.from([0x41, 0x00, 0x42]));
  fs.writeFileSync(snapshot.snapshotPath, Buffer.from([0xe2, 0x82]));
  try {
    await io.readMarkdownWithRecovery(target, { maxInputBytes: 1024 * 1024 });
    throw new Error('RESTORE_BOUNDARY_MISMATCH_EXPECTED');
  } catch (error) {
    if (normalizeString(error.code) !== 'E_IO_SNAPSHOT_MISMATCH'
      || !Array.isArray(error.details?.attemptedSnapshotPaths)
      || error.details.attemptedSnapshotPaths[0] !== snapshot.snapshotPath
      || normalizeString(error.details?.recoveryAction) !== 'OPEN_SNAPSHOT') {
      throw new Error('RESTORE_BOUNDARY_MISMATCH_TYPED_DRIFT');
    }
  }
}

async function verifyRecoveryReplayBoundary(repoRoot) {
  const io = await loadMarkdownIo(repoRoot);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'b2c08-replay-boundary-'));
  const target = path.join(dir, 'scene.md');
  const original = 'stable-replay-snapshot\n';
  fs.writeFileSync(target, original, 'utf8');
  const snapshot = await io.createRecoverySnapshot(target, { now: () => 1700000001999 });
  fs.writeFileSync(target, Buffer.from([0x41, 0x00, 0x42]));

  const run1 = await io.replayMarkdownRecovery(target);
  const run2 = await io.replayMarkdownRecovery(target);
  const expectedHash = io.computeSha256Bytes(Buffer.from(original, 'utf8'));
  if (!sameJson(run1, run2)
    || run1.ok !== 1
    || run1.sourceKind !== 'snapshot'
    || run1.recoveryAction !== 'OPEN_SNAPSHOT'
    || run1.snapshotPath !== snapshot.snapshotPath
    || run1.textHash !== expectedHash) {
    throw new Error('REPLAY_BOUNDARY_HASH_DRIFT');
  }

  const smoke = runNodeScript(repoRoot, 'scripts/ops/x3-recovery-smoke-proofhook.mjs', ['--json']);
  if (smoke.status !== 0) {
    throw new Error('REPLAY_BOUNDARY_SMOKE_RED');
  }
  const smokePayload = JSON.parse(String(smoke.stdout || '{}'));
  if (smokePayload.X3_RECOVERY_SMOKE_OK !== 1
    || smokePayload.resumeRecoverySmokePass !== true
    || normalizeString(smokePayload.failReason) !== '') {
    throw new Error('REPLAY_BOUNDARY_SMOKE_TOKEN_RED');
  }
}

function verifyActionCanonBoundary(repoRoot) {
  const mainSource = fs.readFileSync(path.resolve(repoRoot, 'src/main.js'), 'utf8');
  const canonSource = fs.readFileSync(path.resolve(repoRoot, 'src/shared/recoveryActionCanon.mjs'), 'utf8');
  const logSource = fs.readFileSync(path.resolve(repoRoot, 'src/io/markdown/reliabilityLog.mjs'), 'utf8');

  if (!canonSource.includes("['RETRY', 'SAVE_AS', 'OPEN_SNAPSHOT', 'ABORT']")) {
    throw new Error('ACTION_CANON_SOURCE_DRIFT');
  }
  if (!mainSource.includes('Recovery snapshot не найден.')
    || !mainSource.includes('Recovery snapshot поврежден.')
    || !mainSource.includes("recoveryActions: ['RETRY', 'SAVE_AS', 'ABORT']")
    || !mainSource.includes("recoveryActions: ['OPEN_SNAPSHOT', 'RETRY']")) {
    throw new Error('ACTION_CANON_MAIN_GUIDANCE_DRIFT');
  }
  if (!logSource.includes('normalizeRecoveryActions')) {
    throw new Error('ACTION_CANON_LOG_DRIFT');
  }
}

function verifySourceTruthBinding(repoRoot) {
  const mainSource = fs.readFileSync(path.resolve(repoRoot, 'src/main.js'), 'utf8');
  const bindingContract = fs.readFileSync(path.resolve(repoRoot, 'test/contracts/projectManifestBinding.test.js'), 'utf8');
  const recordA = fs.readFileSync(
    path.resolve(repoRoot, 'docs/OPS/STATUS/MIOS_FIRST_VERTICAL_SLICE_DEFINITION_RECORD_V1.json'),
    'utf8',
  );
  const recordB = fs.readFileSync(
    path.resolve(repoRoot, 'docs/OPS/STATUS/MIOS_SECOND_VERTICAL_SLICE_DEFINITION_RECORD_V1.json'),
    'utf8',
  );

  if (!mainSource.includes('const projectBinding = await findProjectBindingByProjectId(lastProjectId);')
    || !mainSource.includes('settings.projectManifestPath = projectBinding.manifestPath;')
    || !mainSource.includes('settings.lastProjectId = projectId;')
    || !mainSource.includes('const loaded = await markdownIo.readMarkdownWithRecovery(payload.sourcePath')) {
    throw new Error('SOURCE_TRUTH_MAIN_BINDING_DRIFT');
  }
  if (!bindingContract.includes('settings persist and restore by projectId plus relative path')
    || !bindingContract.includes('settings\\.lastProjectId\\s*=\\s*projectId;')
    || !bindingContract.includes('findProjectBindingByProjectId\\(lastProjectId\\)')) {
    throw new Error('SOURCE_TRUTH_BINDING_CONTRACT_DRIFT');
  }
  if (!recordA.includes('"introducesSecondSourceOfTruth": false')
    || !recordA.includes('"introducesParallelRecoveryChannel": false')
    || !recordB.includes('Safe reset path and restore-last-stable path remain distinct path classes')) {
    throw new Error('SOURCE_TRUTH_RECORD_DRIFT');
  }
}

export async function evaluateB2C08RecoveryBoundaryMinimal({
  repoRoot = process.cwd(),
  statusRef = STATUS_REF,
} = {}) {
  try {
    const doc = readJsonObject(path.resolve(repoRoot, statusRef));
    if (normalizeString(doc.artifactId) !== 'B2C08_RECOVERY_BOUNDARY_MINIMAL_V1'
      || doc.schemaVersion !== 1
      || normalizeString(doc.taskId) !== 'B2C08_RECOVERY_BOUNDARY_MINIMAL'
      || normalizeString(doc.status) !== 'PASS') {
      return buildFailure('E_B2C08_STATUS_ARTIFACT_INVALID');
    }

    const boundary = isObjectRecord(doc.boundary) ? doc.boundary : {};
    const proofBinding = isObjectRecord(doc.proofBinding) ? doc.proofBinding : {};
    const admittedRows = Array.isArray(boundary.admittedBoundaryRows) ? boundary.admittedBoundaryRows : [];
    const advisoryRows = Array.isArray(boundary.advisoryBoundaryRows) ? boundary.advisoryBoundaryRows : [];
    const bindingRows = Array.isArray(proofBinding.boundaryRows) ? proofBinding.boundaryRows : [];

    if (normalizeString(boundary.recoveryBoundaryId) !== 'SNAPSHOT_PRIMARY_READ_FALLBACK'
      || !sameJson(admittedRows, EXPECTED_ADMITTED_ROWS)
      || !sameJson(advisoryRows, EXPECTED_ADVISORY_ROWS)) {
      return buildFailure('E_B2C08_BOUNDARY_SET');
    }

    if (normalizeString(proofBinding.bindingMode) !== 'DETECTOR_IDS_ONLY'
      || !sameJson(bindingRows, EXPECTED_BOUNDARY_ROWS)) {
      return buildFailure('E_B2C08_DETECTOR_BINDING');
    }

    const detectorIds = bindingRows.map((row) => normalizeString(row.detectorId));
    if (new Set(detectorIds).size !== detectorIds.length) {
      return buildFailure('E_B2C08_DETECTOR_BINDING');
    }

    const advisoryBoundary = isObjectRecord(doc.advisoryBoundary) ? doc.advisoryBoundary : {};
    if (normalizeString(advisoryBoundary.fullRecoveryProtocolPromotion) !== 'ADVISORY_ONLY_FULL_PROTOCOL_OUT_OF_SCOPE'
      || normalizeString(advisoryBoundary.lastStableRuntimePromotion) !== 'ADVISORY_ONLY_SHELL_LAST_STABLE_PROTOCOL_SEPARATE'
      || normalizeString(advisoryBoundary.queueingPromotion) !== 'ADVISORY_ONLY_QUEUEING_IS_SEPARATE_DOMAIN'
      || normalizeString(advisoryBoundary.concurrencyPromotion) !== 'ADVISORY_ONLY_CONCURRENCY_IS_SEPARATE_DOMAIN'
      || !sameJson(advisoryBoundary.forbiddenPromotionAreas, EXPECTED_FORBIDDEN_AREAS)) {
      return buildFailure('E_B2C08_FORBIDDEN_SCOPE');
    }

    const forbiddenKeys = new Set([
      'queueing',
      'concurrency',
      'fullRecoveryProtocol',
      'runtimeCommandSurfaceExpansion',
      'crossProjectRuntimeOrchestration',
      'extraRecoveryCluster',
    ]);
    const keyPaths = collectKeyPaths(doc);
    const illegalKey = keyPaths.find(({ key, location }) =>
      forbiddenKeys.has(key) && !location.startsWith('advisoryBoundary.forbiddenPromotionAreas'));
    if (illegalKey) {
      return buildFailure('E_B2C08_FORBIDDEN_SCOPE', { forbiddenLocation: illegalKey.location });
    }

    verifyCanonBoundary(repoRoot);
    await verifyRecoveryIoBundle(repoRoot);
    await verifyHumanReadableRecoveryArtifact(repoRoot);
    await verifyRecoveryRestoreBoundary(repoRoot);
    await verifyRecoveryReplayBoundary(repoRoot);
    verifyActionCanonBoundary(repoRoot);
    verifySourceTruthBinding(repoRoot);

    return {
      ok: true,
      code: '',
      [TOKEN_NAME]: 1,
      recoveryBoundaryId: 'SNAPSHOT_PRIMARY_READ_FALLBACK',
      admittedBoundaryRowCount: admittedRows.length,
      advisoryBoundaryRowCount: advisoryRows.length,
      detectorRowCount: bindingRows.length,
    };
  } catch (error) {
    const message = error && typeof error.message === 'string' ? error.message : 'UNKNOWN';
    if (message.startsWith('RECOVERY_IO')) return buildFailure('E_B2C08_RECOVERY_IO_PROOF');
    if (message.startsWith('HUMAN_READABLE')) return buildFailure('E_B2C08_HUMAN_READABLE_ARTIFACT_PROOF');
    if (message.startsWith('RESTORE_BOUNDARY')) return buildFailure('E_B2C08_RESTORE_BOUNDARY_PROOF');
    if (message.startsWith('REPLAY_BOUNDARY')) return buildFailure('E_B2C08_REPLAY_BOUNDARY_PROOF');
    if (message.startsWith('ACTION_CANON')) return buildFailure('E_B2C08_RESTORE_BOUNDARY_PROOF');
    if (message.startsWith('CANON_') || message.startsWith('BIBLE_')) return buildFailure('E_B2C08_BOUNDARY_SET');
    return buildFailure('E_B2C08_UNEXPECTED', { message });
  }
}

function parseArgs(argv) {
  const out = {
    json: false,
    rootDir: process.cwd(),
    statusRef: STATUS_REF,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '');
    if (token === '--json') {
      out.json = true;
      continue;
    }
    if (token === '--root' && i + 1 < argv.length) {
      out.rootDir = String(argv[i + 1] || '').trim() || process.cwd();
      i += 1;
      continue;
    }
    if (token === '--status-ref' && i + 1 < argv.length) {
      out.statusRef = String(argv[i + 1] || '').trim() || STATUS_REF;
      i += 1;
    }
  }
  return out;
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = await evaluateB2C08RecoveryBoundaryMinimal({
    repoRoot: args.rootDir,
    statusRef: args.statusRef,
  });
  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
  } else {
    console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
    console.log(`RECOVERY_BOUNDARY_ID=${state.recoveryBoundaryId || ''}`);
    console.log(`ADMITTED_BOUNDARY_ROW_COUNT=${state.admittedBoundaryRowCount || 0}`);
    console.log(`ADVISORY_BOUNDARY_ROW_COUNT=${state.advisoryBoundaryRowCount || 0}`);
    console.log(`DETECTOR_ROW_COUNT=${state.detectorRowCount || 0}`);
    if (!state.ok) {
      console.log(`FAIL_CODE=${state.code}`);
      if (state.message) {
        console.log(`FAIL_MESSAGE=${state.message}`);
      }
    }
  }
  process.exit(state.ok ? 0 : 1);
}

const executedAsScript = (() => {
  const entry = normalizeString(process.argv[1]);
  return entry.endsWith(`${path.sep}b2c08-recovery-boundary-minimal.mjs`);
})();

if (executedAsScript) {
  main();
}
