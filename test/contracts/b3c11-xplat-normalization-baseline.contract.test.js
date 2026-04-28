const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b3c11-xplat-normalization-baseline-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B3C11_XPLAT_NORMALIZATION_BASELINE_STATUS_V1.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) modulePromise = import(pathToFileURL(MODULE_PATH).href);
  return modulePromise;
}

function readJson(targetPath) {
  return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
}

test('b3c11 xplat normalization: state artifact matches stable executable fields', async () => {
  const { evaluateB3C11XplatNormalizationBaselineState, TOKEN_NAME, FULL_XPLAT_TOKEN_NAME } = await loadModule();
  const state = await evaluateB3C11XplatNormalizationBaselineState({ repoRoot: REPO_ROOT });
  const committedState = readJson(STATUS_PATH);

  assert.equal(committedState.artifactId, state.artifactId);
  assert.equal(committedState.contourId, state.contourId);
  assert.equal(committedState.status, state.status);
  assert.equal(committedState[TOKEN_NAME], state[TOKEN_NAME]);
  assert.equal(committedState[FULL_XPLAT_TOKEN_NAME], state[FULL_XPLAT_TOKEN_NAME]);
  assert.deepEqual(committedState.failRows, state.failRows);
  assert.deepEqual(committedState.inputRows, state.inputRows);
  assert.deepEqual(committedState.fixtureMatrix, state.fixtureMatrix);
  assert.deepEqual(committedState.platformLimitRows, state.platformLimitRows);
  assert.deepEqual(committedState.unsupportedScope, state.unsupportedScope);
  assert.deepEqual(committedState.provisionalScope, state.provisionalScope);
  assert.deepEqual(committedState.scope, state.scope);
  assert.deepEqual(committedState.donorIntake, state.donorIntake);
  assert.equal(committedState.runtime.changedBasenamesHash, state.runtime.changedBasenamesHash);
  assert.equal(Boolean(state.runtime.statusArtifactHash), true);
  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.status, 'PASS');
  assert.equal(state[TOKEN_NAME], 1);
  assert.equal(state[FULL_XPLAT_TOKEN_NAME], 0);
  assert.deepEqual(state.failRows, []);
  assert.equal(state.repo.repoRootBinding, 'WORKTREE_INDEPENDENT');
});

test('b3c11 xplat normalization: CLI status remains worktree independent outside repo cwd', () => {
  const result = spawnSync(process.execPath, [MODULE_PATH], {
    cwd: os.tmpdir(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);

  const stdout = String(result.stdout || '');
  assert.match(stdout, /B3C11_STATUS=PASS/u);
  assert.match(stdout, /B3C11_XPLAT_NORMALIZATION_BASELINE_OK=1/u);
  assert.match(stdout, /B3C11_FULL_REAL_PLATFORM_XPLAT_OK=0/u);
});

test('b3c11 xplat normalization: binds B3C10 and keeps multi platform limitation visible', async () => {
  const { evaluateB3C11XplatNormalizationBaselineState } = await loadModule();
  const state = await evaluateB3C11XplatNormalizationBaselineState({ repoRoot: REPO_ROOT });

  assert.equal(state.proof.b3c10InputBound, true);
  assert.equal(state.proof.b3c10MultiPlatformLimitBound, true);
  assert.equal(state.inputRows[0].basename, 'B3C10_CAPABILITY_TIER_REPORT_STATUS_V1.json');
  assert.equal(state.b3c10Limitations.unsupportedScope.includes('MULTI_PLATFORM_REAL_FIXTURE_SET'), true);
  assert.equal(state.unsupportedScope.some((row) => row.id === 'B3C10_MULTI_PLATFORM_REAL_FIXTURE_SET'), true);
});

test('b3c11 xplat normalization: all 15 required fixture rows exist and pass as contracts', async () => {
  const { evaluateB3C11XplatNormalizationBaselineState } = await loadModule();
  const state = await evaluateB3C11XplatNormalizationBaselineState({ repoRoot: REPO_ROOT });
  const ids = state.fixtureMatrix.map((row) => row.id).sort();

  assert.deepEqual(ids, [
    'CASE_COLLISION',
    'FILE_LOCK',
    'ILLEGAL_CHARACTER',
    'LINUX_CASE_DIVERGENCE',
    'LOCALE_SORT',
    'MACOS_NFC',
    'MACOS_NFD',
    'NEWLINE_DRIFT',
    'PATH_LENGTH',
    'RENAME_BEHAVIOR',
    'SEPARATOR',
    'TIMESTAMP_PRECISION',
    'TRAILING_DOT',
    'TRAILING_SPACE',
    'WINDOWS_RESERVED_NAMES',
  ]);
  assert.equal(state.proof.all15FixtureRowsExist, true);
  assert.equal(state.fixtureMatrix.every((row) => row.status === 'PASS'), true);
  assert.equal(state.fixtureMatrix.every((row) => row.source === 'NODE_BUILTINS_ONLY'), true);
});

test('b3c11 xplat normalization: separates contract fixture status from real platform status', async () => {
  const { evaluateB3C11XplatNormalizationBaselineState } = await loadModule();
  const state = await evaluateB3C11XplatNormalizationBaselineState({ repoRoot: REPO_ROOT });

  assert.equal(state.contractFixtureStatus, 'PASS');
  assert.equal(state.realPlatformStatus, 'LIMITED');
  assert.equal(state.B3C11_FULL_REAL_PLATFORM_XPLAT_OK, 0);
  assert.equal(state.testedPlatformSet.realPlatformMatrixRun, false);
  assert.equal(state.testedPlatformSet.releaseSupportClaim, false);
});

test('b3c11 xplat normalization: platform limit rows exist for Windows macOS and Linux without release support claim', async () => {
  const { evaluateB3C11XplatNormalizationBaselineState } = await loadModule();
  const state = await evaluateB3C11XplatNormalizationBaselineState({ repoRoot: REPO_ROOT });
  const byPlatform = new Map(state.platformLimitRows.map((row) => [row.platform, row]));

  for (const platform of ['WINDOWS', 'MACOS', 'LINUX']) {
    assert.equal(byPlatform.has(platform), true, `${platform} row missing`);
    assert.equal(byPlatform.get(platform).releaseSupportClaim, false);
    assert.match(byPlatform.get(platform).status, /LIMITED/u);
  }
});

test('b3c11 xplat normalization: donor intake remains context only', async () => {
  const { evaluateB3C11XplatNormalizationBaselineState } = await loadModule();
  const state = await evaluateB3C11XplatNormalizationBaselineState({ repoRoot: REPO_ROOT });

  assert.equal(state.proof.donorIntakeContextOnly, true);
  assert.equal(state.donorIntake.class, 'READ_ONLY_CONTEXT_ONLY');
  assert.equal(state.donorIntake.codeImported, false);
  assert.equal(state.donorIntake.completionClaimImported, false);
  assert.equal(state.donorIntake.activeCanonOverDonor, true);
  assert.ok(state.donorIntake.archiveRows.length >= 4);
});

test('b3c11 xplat normalization: forbidden claims and adjacent layer proofs fail evaluation', async () => {
  const { evaluateB3C11XplatNormalizationBaselineState } = await loadModule();
  const state = await evaluateB3C11XplatNormalizationBaselineState({
    repoRoot: REPO_ROOT,
    forceClaims: {
      supportedPlatformReleaseClaim: true,
      i18nGraphemeAnchorProof: true,
    },
  });

  assert.equal(state.ok, false);
  assert.equal(state.status, 'FAIL');
  assert.equal(state.failRows.includes('FORBIDDEN_SCOPE_OR_RELEASE_CLAIM'), true);
  assert.equal(state.failSignal, 'E_B3C11_XPLAT_NORMALIZATION_BASELINE_NOT_OK');
});

test('b3c11 xplat normalization: scope flags reject UI export security storage project store atomic and dependency drift', async () => {
  const { evaluateB3C11XplatNormalizationBaselineState } = await loadModule();
  const state = await evaluateB3C11XplatNormalizationBaselineState({ repoRoot: REPO_ROOT });

  assert.equal(state.scope.xplatNormalizationOnly, true);
  assert.equal(state.scope.contractBaselineOnly, true);
  assert.equal(state.scope.realPlatformCertification, false);
  assert.equal(state.scope.projectStoreTouched, false);
  assert.equal(state.scope.atomicWriteTouched, false);
  assert.equal(state.scope.exportPipelineRewritten, false);
  assert.equal(state.scope.securityPolicyRewritten, false);
  assert.equal(state.scope.storageFormatChanged, false);
  assert.equal(state.scope.storageMutated, false);
  assert.equal(state.scope.uiTouched, false);
  assert.equal(state.scope.releaseClaim, false);
  assert.equal(state.scope.supportedPlatformReleaseClaim, false);
  assert.equal(state.scope.fullXplatGreenClaim, false);
  assert.equal(state.scope.i18nGraphemeAnchorProof, false);
  assert.equal(state.scope.inlineOffsetUnitProof, false);
  assert.equal(state.scope.a11yTrustSurfaceProof, false);
  assert.equal(state.scope.b3c09PerfGapFix, false);
  assert.equal(state.scope.newDependency, false);
});
