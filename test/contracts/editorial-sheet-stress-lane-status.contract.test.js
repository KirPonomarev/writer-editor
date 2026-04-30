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
    TRACKED_CANDIDATE_PAGE_COUNTS,
    DIAGNOSTIC_BOUNDARY_PAGE_COUNTS,
    SUPPORTED_SCALE_CEILING,
    SCROLL_RANGE_LIMIT_RULE,
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
  assert.deepEqual(artifact.trackedCandidatePageCounts, TRACKED_CANDIDATE_PAGE_COUNTS);
  assert.equal(artifact.candidateObservedCeiling, 10000);
  assert.deepEqual(artifact.diagnosticBoundaryPageCounts, DIAGNOSTIC_BOUNDARY_PAGE_COUNTS);
  assert.equal(artifact.supportedTier, SUPPORTED_SCALE_CEILING);
  assert.equal(artifact.scrollRangeLimitGuard.rule, SCROLL_RANGE_LIMIT_RULE);
  assert.equal(artifact.scrollRangeLimitGuard.endMarkerVisibleRequiredForAcceptanceRows, true);
  assert.equal(artifact.scrollRangeLimitGuard.childOkParentFailCannotGreenlight, true);
  assert.equal(artifact.scrollRangeLimitGuard.scrollRangeClampDetected, false);
  assert.equal(artifact.diagnosticBoundaryPolicy.sourceClass, 'POLICY_ONLY_NO_HEAVY_RUN');
  assert.deepEqual(artifact.diagnosticBoundaryPolicy.destructiveDiagnosticPageCounts, DIAGNOSTIC_BOUNDARY_PAGE_COUNTS);
  assert.equal(artifact.diagnosticBoundaryPolicy.readinessClaim, false);
  assert.equal(artifact.diagnosticBoundaryPolicy.supportedTierRaised, false);
  assert.equal(artifact.diagnosticBoundaryPolicy.acceptancePromotion, false);
  assert.equal(artifact.diagnosticBoundaryPolicy.heavyRunByDefault, false);

  const rowMap = new Map(artifact.rows.map((row) => [row.id, row]));
  assert.equal(rowMap.size, EXPECTED_ROW_IDS.length);
  for (const rowId of EXPECTED_ROW_IDS) {
    assert.ok(rowMap.has(rowId), `missing row ${rowId}`);
  }
  assert.equal(rowMap.get('TRACKED_SCALE_2000').rowClass, 'tracked-scale');
  assert.equal(rowMap.get('TRACKED_SCALE_3000').rowClass, 'tracked-scale');
  assert.equal(rowMap.get('TRACKED_SCALE_4000').rowClass, 'tracked-scale');
  assert.equal(rowMap.get('TRACKED_SCALE_5000').rowClass, 'tracked-scale');
  assert.equal(rowMap.get('TRACKED_CANDIDATE_10000').rowClass, 'tracked-candidate');
  assert.equal(rowMap.get('TRACKED_CANDIDATE_10000').diagnosticOnly, false);
  assert.equal(rowMap.get('TRACKED_CANDIDATE_10000').status, 'PASS');
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
  const trackedCandidateRows = artifact.rows.filter((row) => row.rowClass === 'tracked-candidate');
  const tracked5000Row = trackedScaleRows.find((row) => row.pageCount === 5000);
  const trackedCandidate10000Row = trackedCandidateRows.find((row) => row.pageCount === 10000);
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
  assert.equal(artifact.candidateObservedCeiling, trackedCandidate10000Row.status === 'PASS' ? 10000 : 0);
  assert.equal(artifact.readiness.rule, READINESS_RULE);
  assert.equal(artifact.readiness.tracked5000Pass, tracked5000Row.status === 'PASS');
  assert.equal(artifact.candidates.trackedCandidate10000Pass, trackedCandidate10000Row.status === 'PASS');
  assert.equal(artifact.candidates.supportedTierRaised, false);
  assert.equal(artifact.supportedTier, 5000);
  assert.equal(artifact.scrollRangeLimitGuard.scrollRangeClampDetected, false);
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

test('editorial sheet stress lane: outer evaluation rejects unsupported scale promotion attempts', async () => {
  const artifact = readArtifact();
  const trackedScale6000Row = {
    ...artifact.rows.find((row) => row.id === 'TRACKED_SCALE_5000'),
    id: 'TRACKED_SCALE_6000',
    pageCount: 6000,
    observed: {
      ...artifact.rows.find((row) => row.id === 'TRACKED_SCALE_5000').observed,
      targetPageCount: 6000,
      actualPageCount: 6720,
    },
  };
  const cases = [
    {
      name: 'tracked-scale-page-count-list-only',
      mutate(source) {
        return {
          ...source,
          trackedScalePageCounts: [...source.trackedScalePageCounts, 6000],
        };
      },
      expectedIssue: 'TRACKED_SCALE_PAGE_COUNTS_DO_NOT_MATCH',
    },
    {
      name: 'injected-tracked-scale-row',
      mutate(source) {
        return {
          ...source,
          explicitRowIds: [...source.explicitRowIds, 'TRACKED_SCALE_6000'],
          executedRowIds: [...source.executedRowIds, 'TRACKED_SCALE_6000'],
          trackedScalePageCounts: [...source.trackedScalePageCounts, 6000],
          provisionalObservedCeiling: 6000,
          rows: [...source.rows, trackedScale6000Row],
          readiness: {
            ...source.readiness,
            editorialSheet6000Ready: true,
            tracked6000Pass: true,
          },
        };
      },
      expectedIssue: 'ROW_SET_MISMATCH',
    },
    {
      name: 'candidate-raises-supported-tier',
      mutate(source) {
        return {
          ...source,
          supportedTier: 10000,
          provisionalObservedCeiling: 10000,
          candidates: {
            ...source.candidates,
            supportedTierRaised: true,
          },
          readiness: {
            ...source.readiness,
            editorialSheet10000Ready: true,
          },
        };
      },
      expectedIssue: 'PROVISIONAL_OBSERVED_CEILING_ABOVE_SUPPORTED_TIER',
    },
    {
      name: 'promoted-25000-boundary',
      mutate(source) {
        return {
          ...source,
          trackedCandidatePageCounts: [...source.trackedCandidatePageCounts, 25000],
          rows: [
            ...source.rows,
            {
              ...source.rows.find((row) => row.id === 'TRACKED_CANDIDATE_10000'),
              id: 'TRACKED_CANDIDATE_25000',
              pageCount: 25000,
              observed: {
                ...source.rows.find((row) => row.id === 'TRACKED_CANDIDATE_10000').observed,
                targetPageCount: 25000,
              },
            },
          ],
        };
      },
      expectedIssue: 'ROW_SET_MISMATCH',
    },
    {
      name: 'candidate-missing-observed-metric',
      mutate(source) {
        return {
          ...source,
          rows: source.rows.map((row) => {
            if (row.id !== 'TRACKED_CANDIDATE_10000') return row;
            const { actualPageCount: _actualPageCount, ...observed } = row.observed;
            return { ...row, observed };
          }),
        };
      },
      expectedIssue: 'ROW_OBSERVED_ACTUALPAGECOUNT_MISSING_TRACKED_CANDIDATE_10000',
    },
    {
      name: 'end-marker-hidden-at-scroll-range-clamp',
      mutate(source) {
        return {
          ...source,
          rows: source.rows.map((row) => {
            if (row.id !== 'TRACKED_CANDIDATE_10000') return row;
            return {
              ...row,
              observed: {
                ...row.observed,
                markerScrolls: row.observed.markerScrolls.map((markerScroll) => (
                  markerScroll.markerName === 'END'
                    ? { ...markerScroll, visibleRectCount: 0, scrollTop: 16776537, maxScrollTop: 16776537 }
                    : markerScroll
                )),
              },
            };
          }),
          scrollRangeLimitGuard: {
            ...source.scrollRangeLimitGuard,
            scrollHeightLimitObserved: 16777216,
            maxScrollTopObserved: 16776537,
            scrollRangeClampDetected: true,
          },
        };
      },
      expectedIssue: 'SCROLL_RANGE_CLAMP_TRACKED_CANDIDATE_10000',
    },
    {
      name: 'child-ok-parent-scroll-clamp-not-flagged',
      mutate(source) {
        return {
          ...source,
          rows: source.rows.map((row) => {
            if (row.id !== 'TRACKED_CANDIDATE_10000') return row;
            return {
              ...row,
              status: 'PASS',
              observed: {
                ...row.observed,
                markerScrolls: row.observed.markerScrolls.map((markerScroll) => (
                  markerScroll.markerName === 'END'
                    ? { ...markerScroll, visibleRectCount: 0, scrollTop: 16776537, maxScrollTop: 16776537 }
                    : markerScroll
                )),
              },
            };
          }),
          scrollRangeLimitGuard: {
            ...source.scrollRangeLimitGuard,
            scrollRangeClampDetected: false,
          },
        };
      },
      expectedIssue: 'SCROLL_RANGE_CLAMP_FLAG_INVALID',
    },
    {
      name: '25000-diagnostic-policy-promoted',
      mutate(source) {
        return {
          ...source,
          diagnosticBoundaryPolicy: {
            ...source.diagnosticBoundaryPolicy,
            readinessClaim: true,
            supportedTierRaised: true,
            acceptancePromotion: true,
            heavyRunByDefault: true,
          },
        };
      },
      expectedIssue: 'DIAGNOSTIC_BOUNDARY_READINESS_CLAIMED',
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

test('editorial sheet stress lane: linear status artifact commit may bind to first parent', async () => {
  const { evaluateEditorialSheetStressLaneStatus } = await loadModule();
  const artifact = readArtifact();
  const artifactHeadSha = 'a'.repeat(40);
  const currentHeadSha = 'b'.repeat(40);
  const statusPath = path.join('docs', 'OPS', 'STATUS', 'EDITORIAL_SHEET_STRESS_LANE_STATUS_V3.json');
  const result = evaluateEditorialSheetStressLaneStatus(
    {
      ...artifact,
      repo: {
        ...artifact.repo,
        headSha: artifactHeadSha,
      },
    },
    {
      repoStateOverride: {
        currentHeadSha,
        originMainHeadSha: 'c'.repeat(40),
        currentHeadFirstParentSha: artifactHeadSha,
        currentHeadSecondParentSha: '',
        currentHeadChangedPathsFromFirstParent: [statusPath],
      },
    },
  );

  assert.equal(result.ok, true);
  assert.ok(result.acceptedExecutionHeadShas.includes(artifactHeadSha));
  assert.equal(result.matchedExecutionHeadSha, artifactHeadSha);
});

test('editorial sheet stress lane: write authority accepts clean mainline or codex contour branch only', async () => {
  const { evaluateWriteAuthority, WRITE_AUTHORITY_RULE } = await loadModule();

  const dirtyState = evaluateWriteAuthority({
    currentHeadSha: 'a'.repeat(40),
    originMainHeadSha: 'a'.repeat(40),
    detachedHead: true,
    worktreeClean: false,
    originMainAncestorOfHead: true,
  });
  assert.equal(dirtyState.ok, false);
  assert.equal(dirtyState.rule, WRITE_AUTHORITY_RULE);
  assert.ok(dirtyState.issues.includes('WORKTREE_NOT_CLEAN'));

  const cleanMainlineState = evaluateWriteAuthority({
    currentHeadSha: 'a'.repeat(40),
    originMainHeadSha: 'a'.repeat(40),
    detachedHead: true,
    worktreeClean: true,
    originMainAncestorOfHead: true,
  });
  assert.equal(cleanMainlineState.ok, true);

  const cleanCodexBranchState = evaluateWriteAuthority({
    currentHeadSha: 'b'.repeat(40),
    originMainHeadSha: 'a'.repeat(40),
    detachedHead: false,
    worktreeClean: true,
    branchName: 'codex/editorial-sheet-10000-candidate-01',
    originMainAncestorOfHead: true,
  });
  assert.equal(cleanCodexBranchState.ok, true);

  const nonCodexBranchState = evaluateWriteAuthority({
    currentHeadSha: 'b'.repeat(40),
    originMainHeadSha: 'a'.repeat(40),
    detachedHead: false,
    worktreeClean: true,
    branchName: 'feature/editorial-sheet-10000-candidate-01',
    originMainAncestorOfHead: true,
  });
  assert.equal(nonCodexBranchState.ok, false);
  assert.ok(nonCodexBranchState.issues.includes('BRANCH_NOT_CODEX_CONTOUR'));

  const staleMainlineState = evaluateWriteAuthority({
    currentHeadSha: 'a'.repeat(40),
    originMainHeadSha: 'b'.repeat(40),
    detachedHead: true,
    worktreeClean: true,
    originMainAncestorOfHead: false,
  });
  assert.equal(staleMainlineState.ok, false);
  assert.ok(staleMainlineState.issues.includes('HEAD_NOT_AT_ORIGIN_MAIN'));
});
