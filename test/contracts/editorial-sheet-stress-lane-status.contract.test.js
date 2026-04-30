const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'editorial-sheet-stress-lane-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'EDITORIAL_SHEET_STRESS_LANE_STATUS_V3.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) modulePromise = import(pathToFileURL(MODULE_PATH).href);
  return modulePromise;
}

function readArtifact() {
  return JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
}

function writeTempArtifact(artifact) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'editorial-sheet-stress-lane-status-'));
  const targetPath = path.join(tmpDir, 'EDITORIAL_SHEET_STRESS_LANE_STATUS_V3.json');
  fs.writeFileSync(targetPath, JSON.stringify(artifact, null, 2));
  return { tmpDir, targetPath };
}

function runCli(args = []) {
  return spawnSync(process.execPath, [MODULE_PATH, '--json', ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
}

test('editorial sheet stress lane: committed artifact schema is valid and explicit row set is fixed', async () => {
  const {
    ARTIFACT_ID,
    SCHEMA_VERSION,
    EXPECTED_ROW_IDS,
    DIAGNOSTIC_ONLY_ROW_IDS,
    TRACKED_SCALE_PAGE_COUNTS,
    validateEditorialSheetStressLaneStatus,
    evaluateEditorialSheetStressLaneStatus,
  } = await loadModule();
  const artifact = readArtifact();
  const validation = validateEditorialSheetStressLaneStatus(artifact);
  const evaluation = evaluateEditorialSheetStressLaneStatus(artifact, { repoRoot: REPO_ROOT });

  assert.equal(validation.ok, true, validation.issues.join('\n'));
  assert.equal(evaluation.ok, true, evaluation.issues.join('\n'));
  assert.equal(artifact.schemaVersion, SCHEMA_VERSION);
  assert.equal(artifact.artifactId, ARTIFACT_ID);
  assert.ok(evaluation.acceptedExecutionHeadShas.includes(artifact.repo.headSha));
  assert.equal(evaluation.matchedExecutionHeadSha, artifact.repo.headSha);
  assert.deepEqual(artifact.explicitRowIds, EXPECTED_ROW_IDS);
  assert.deepEqual(artifact.executedRowIds, EXPECTED_ROW_IDS);
  assert.deepEqual(artifact.diagnosticOnlyRowIds, DIAGNOSTIC_ONLY_ROW_IDS);
  assert.deepEqual(artifact.trackedScalePageCounts, TRACKED_SCALE_PAGE_COUNTS);

  const rowMap = new Map(artifact.rows.map((row) => [row.id, row]));
  assert.equal(rowMap.size, EXPECTED_ROW_IDS.length);
  for (const rowId of EXPECTED_ROW_IDS) {
    assert.ok(rowMap.has(rowId), `missing row ${rowId}`);
  }
  assert.equal(rowMap.get('TRACKED_SCALE_2000').rowClass, 'tracked-scale');
  assert.equal(rowMap.get('TRACKED_SCALE_3000').rowClass, 'tracked-scale');
  assert.equal(rowMap.get('TRACKED_SCALE_4000').rowClass, 'tracked-scale');
  assert.equal(rowMap.get('TRACKED_SCALE_5000').rowClass, 'tracked-scale');
  assert.equal(rowMap.get('VIEWPORT_CONTINUITY').rowClass, 'diagnostic-viewport');
  assert.equal(rowMap.get('INPUT_CONTINUITY').rowClass, 'diagnostic-input');
  assert.equal(rowMap.get('GAP_CONTINUITY').rowClass, 'diagnostic-gap');
  assert.equal(rowMap.get('VIEWPORT_CONTINUITY').diagnosticOnly, true);
  assert.equal(rowMap.get('INPUT_CONTINUITY').diagnosticOnly, true);
  assert.equal(rowMap.get('GAP_CONTINUITY').diagnosticOnly, true);
});

test('editorial sheet stress lane: anti-false-green fields derive only from tracked scale rows', async () => {
  const {
    TRACKED_SCALE_PAGE_COUNTS,
    READINESS_RULE,
  } = await loadModule();
  const artifact = readArtifact();
  const trackedScaleRows = artifact.rows.filter((row) => row.rowClass === 'tracked-scale');
  const tracked5000Row = trackedScaleRows.find((row) => row.pageCount === 5000);
  const expectedCeiling = trackedScaleRows
    .filter((row) => row.status === 'PASS')
    .reduce((max, row) => Math.max(max, Number(row.pageCount || 0)), 0);
  const expectedUnsupportedAboveCurrentProof = TRACKED_SCALE_PAGE_COUNTS.filter((pageCount) => pageCount > expectedCeiling);
  const expectedFailedRowIds = artifact.rows
    .filter((row) => row.status !== 'PASS')
    .map((row) => row.id);

  assert.equal(artifact.provisionalObservedCeiling, expectedCeiling);
  assert.deepEqual(artifact.unsupportedAboveCurrentProof, expectedUnsupportedAboveCurrentProof);
  assert.deepEqual(artifact.failedRowIds, expectedFailedRowIds);
  assert.equal(artifact.readiness.rule, READINESS_RULE);
  assert.equal(artifact.readiness.tracked5000Pass, tracked5000Row.status === 'PASS');
  assert.equal(artifact.readiness.editorialSheet5000Ready === true ? tracked5000Row.status === 'PASS' : true, true);
  if (tracked5000Row.status !== 'PASS') {
    assert.equal(artifact.readiness.editorialSheet5000Ready, false);
  }
});

test('editorial sheet stress lane: CLI read mode validates artifact outside repo cwd', async () => {
  const result = spawnSync(process.execPath, [MODULE_PATH, '--json'], {
    cwd: os.tmpdir(),
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(String(result.stdout || '{}'));
  assert.equal(payload.statusPath.endsWith(path.join('docs', 'OPS', 'STATUS', 'EDITORIAL_SHEET_STRESS_LANE_STATUS_V3.json')), true);
  assert.equal(payload.artifact.artifactId, 'EDITORIAL_SHEET_STRESS_LANE_STATUS_V3');
  assert.equal(payload.evaluation.ok, true, JSON.stringify(payload.evaluation, null, 2));
});

test('editorial sheet stress lane: outer evaluation fails on stale head mismatch', async () => {
  const artifact = readArtifact();
  const mutated = {
    ...artifact,
    repo: {
      ...artifact.repo,
      headSha: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    },
  };
  const { tmpDir, targetPath } = writeTempArtifact(mutated);
  const result = runCli(['--status-path', targetPath]);
  fs.rmSync(tmpDir, { recursive: true, force: true });

  assert.equal(result.status, 1, result.stdout + result.stderr);
  const payload = JSON.parse(String(result.stdout || '{}'));
  assert.equal(payload.evaluation.ok, false);
  assert.ok(payload.evaluation.issues.includes('ARTIFACT_HEAD_SHA_MISMATCH'));
});

test('editorial sheet stress lane: outer evaluation fails on FAIL status token zero and failed rows', async () => {
  const artifact = readArtifact();
  const cases = [
    {
      name: 'fail-status',
      mutate(source) {
        return { ...source, status: 'FAIL', ok: false };
      },
      expectedIssue: 'ARTIFACT_STATUS_NOT_PASS',
    },
    {
      name: 'token-zero',
      mutate(source) {
        return { ...source, EDITORIAL_SHEET_STRESS_LANE_STATUS_OK: 0 };
      },
      expectedIssue: 'ARTIFACT_TOKEN_NOT_ONE',
    },
    {
      name: 'failed-rows-present',
      mutate(source) {
        return { ...source, failedRowIds: ['VIEWPORT_CONTINUITY'] };
      },
      expectedIssue: 'ARTIFACT_FAILED_ROWS_PRESENT',
    },
  ];

  for (const testCase of cases) {
    const mutated = testCase.mutate(artifact);
    const { tmpDir, targetPath } = writeTempArtifact(mutated);
    const result = runCli(['--status-path', targetPath]);
    fs.rmSync(tmpDir, { recursive: true, force: true });

    assert.equal(result.status, 1, `${testCase.name}\n${result.stdout}\n${result.stderr}`);
    const payload = JSON.parse(String(result.stdout || '{}'));
    assert.equal(payload.evaluation.ok, false, testCase.name);
    assert.ok(payload.evaluation.issues.includes(testCase.expectedIssue), testCase.name);
  }
});

test('editorial sheet stress lane: write authority rejects dirty or non-mainline execution states', async () => {
  const { evaluateWriteAuthority, WRITE_AUTHORITY_RULE } = await loadModule();

  const dirtyState = evaluateWriteAuthority({
    currentHeadSha: 'a'.repeat(40),
    originMainHeadSha: 'a'.repeat(40),
    detachedHead: true,
    worktreeClean: false,
  });
  assert.equal(dirtyState.ok, false);
  assert.equal(dirtyState.rule, WRITE_AUTHORITY_RULE);
  assert.ok(dirtyState.issues.includes('WORKTREE_NOT_CLEAN'));

  const branchState = evaluateWriteAuthority({
    currentHeadSha: 'a'.repeat(40),
    originMainHeadSha: 'a'.repeat(40),
    detachedHead: false,
    worktreeClean: true,
  });
  assert.equal(branchState.ok, false);
  assert.ok(branchState.issues.includes('HEAD_NOT_DETACHED'));

  const staleMainlineState = evaluateWriteAuthority({
    currentHeadSha: 'a'.repeat(40),
    originMainHeadSha: 'b'.repeat(40),
    detachedHead: true,
    worktreeClean: true,
  });
  assert.equal(staleMainlineState.ok, false);
  assert.ok(staleMainlineState.issues.includes('HEAD_NOT_AT_ORIGIN_MAIN'));
});
