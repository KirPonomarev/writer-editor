const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b3c12-i18n-text-anchor-safety-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B3C12_I18N_TEXT_ANCHOR_SAFETY_STATUS_V1.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) modulePromise = import(pathToFileURL(MODULE_PATH).href);
  return modulePromise;
}

function readJson(targetPath) {
  return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
}

test('b3c12 i18n text anchor safety: state artifact matches stable executable fields', async () => {
  const { evaluateB3C12I18nTextAnchorSafetyState, TOKEN_NAME, FULL_I18N_TOKEN_NAME } = await loadModule();
  const state = await evaluateB3C12I18nTextAnchorSafetyState({ repoRoot: REPO_ROOT });
  const committedState = readJson(STATUS_PATH);

  assert.equal(committedState.artifactId, state.artifactId);
  assert.equal(committedState.contourId, state.contourId);
  assert.equal(committedState.status, state.status);
  assert.equal(committedState[TOKEN_NAME], state[TOKEN_NAME]);
  assert.equal(committedState[FULL_I18N_TOKEN_NAME], state[FULL_I18N_TOKEN_NAME]);
  assert.deepEqual(committedState.failRows, state.failRows);
  assert.deepEqual(committedState.inputRows, state.inputRows);
  assert.deepEqual(committedState.offsetUnitDeclaration, state.offsetUnitDeclaration);
  assert.deepEqual(committedState.segmenterPolicy, state.segmenterPolicy);
  assert.deepEqual(committedState.fixtureMatrix, state.fixtureMatrix);
  assert.deepEqual(committedState.i18nLimitRows, state.i18nLimitRows);
  assert.deepEqual(committedState.unsupportedScope, state.unsupportedScope);
  assert.deepEqual(committedState.provisionalScope, state.provisionalScope);
  assert.deepEqual(committedState.scope, state.scope);
  assert.deepEqual(committedState.donorIntake, state.donorIntake);
  assert.equal(committedState.runtime.changedBasenamesHash, state.runtime.changedBasenamesHash);
  assert.equal(Boolean(state.runtime.statusArtifactHash), true);
  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.status, 'PASS');
  assert.equal(state[TOKEN_NAME], 1);
  assert.equal(state[FULL_I18N_TOKEN_NAME], 0);
  assert.deepEqual(state.failRows, []);
  assert.equal(state.repo.repoRootBinding, 'WORKTREE_INDEPENDENT');
});

test('b3c12 i18n text anchor safety: CLI status remains worktree independent outside repo cwd', () => {
  const result = spawnSync(process.execPath, [MODULE_PATH], {
    cwd: os.tmpdir(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);

  const stdout = String(result.stdout || '');
  assert.match(stdout, /B3C12_STATUS=PASS/u);
  assert.match(stdout, /B3C12_I18N_TEXT_ANCHOR_SAFETY_OK=1/u);
  assert.match(stdout, /B3C12_FULL_GLOBAL_I18N_OK=0/u);
});

test('b3c12 i18n text anchor safety: binds B3C11 and keeps xplat limitations visible', async () => {
  const { evaluateB3C12I18nTextAnchorSafetyState } = await loadModule();
  const state = await evaluateB3C12I18nTextAnchorSafetyState({ repoRoot: REPO_ROOT });

  assert.equal(state.proof.b3c11InputBound, true);
  assert.equal(state.proof.b3c11PlatformLimitsVisible, true);
  assert.equal(state.inputRows[0].basename, 'B3C11_XPLAT_NORMALIZATION_BASELINE_STATUS_V1.json');
  assert.equal(state.b3c11Limitations.realPlatformStatus, 'LIMITED');
  assert.equal(state.b3c11Limitations.fullRealPlatformXplat, false);
  assert.deepEqual(state.b3c11Limitations.platformLimitRowsVisible, ['LINUX', 'MACOS', 'WINDOWS']);
});

test('b3c12 i18n text anchor safety: binds existing utf16 offset unit and does not mutate inline schema', async () => {
  const { evaluateB3C12I18nTextAnchorSafetyState } = await loadModule();
  const state = await evaluateB3C12I18nTextAnchorSafetyState({ repoRoot: REPO_ROOT });

  assert.equal(state.offsetUnitDeclaration.sourceBasename, 'sceneInlineRangeAdmission.mjs');
  assert.equal(state.offsetUnitDeclaration.existingOffsetUnit, 'utf16_code_unit');
  assert.equal(state.offsetUnitDeclaration.testedAnchorPolicy, 'GRAPHEME_CLUSTER_BOUNDARY_VALIDATION_ON_EXISTING_UTF16_OFFSETS');
  assert.equal(state.offsetUnitDeclaration.schemaMutation, false);
  assert.equal(state.offsetUnitDeclaration.globalOffsetUnitRedefined, false);
  assert.equal(state.proof.existingInlineRangeOffsetUnitBound, true);
  assert.equal(state.proof.inlineRangeSchemaNotMutated, true);
});

test('b3c12 i18n text anchor safety: all 10 required fixture rows exist and pass as contracts', async () => {
  const { evaluateB3C12I18nTextAnchorSafetyState } = await loadModule();
  const state = await evaluateB3C12I18nTextAnchorSafetyState({ repoRoot: REPO_ROOT });
  const ids = state.fixtureMatrix.map((row) => row.id).sort();

  assert.deepEqual(ids, [
    'ANCHOR_SHIFT_NEGATIVE',
    'CJK_TEXT',
    'COMBINING_MARK',
    'EMOJI_SEQUENCE',
    'GRAPHEME_SPLIT_NEGATIVE',
    'MIXED_SCRIPT_TEXT',
    'OFFSET_UNIT_MISMATCH_NEGATIVE',
    'RIGHT_TO_LEFT_ANCHOR_ONLY',
    'SEARCH_SNIPPET_PURE_TEXT',
    'SNIPPET_SPLIT_NEGATIVE',
  ]);
  assert.equal(state.proof.all10FixtureRowsExist, true);
  assert.equal(state.fixtureMatrix.every((row) => row.status === 'PASS'), true);
});

test('b3c12 i18n text anchor safety: required negative rows reject split anchors and offset mismatch', async () => {
  const { evaluateB3C12I18nTextAnchorSafetyState } = await loadModule();
  const state = await evaluateB3C12I18nTextAnchorSafetyState({ repoRoot: REPO_ROOT });
  const byId = new Map(state.fixtureMatrix.map((row) => [row.id, row]));

  assert.equal(byId.get('GRAPHEME_SPLIT_NEGATIVE').rejectedCode, 'E_SCENE_INLINE_RANGE_GRAPHEME_SPLIT');
  assert.equal(byId.get('ANCHOR_SHIFT_NEGATIVE').rejectedCode, 'E_SCENE_INLINE_RANGE_GRAPHEME_SPLIT');
  assert.equal(byId.get('OFFSET_UNIT_MISMATCH_NEGATIVE').rejectedClaimedOffsetUnit, 'grapheme');
  assert.equal(byId.get('SNIPPET_SPLIT_NEGATIVE').status, 'PASS');
});

test('b3c12 i18n text anchor safety: separates contract fixture pass from real language coverage limits', async () => {
  const { evaluateB3C12I18nTextAnchorSafetyState, FULL_I18N_TOKEN_NAME } = await loadModule();
  const state = await evaluateB3C12I18nTextAnchorSafetyState({ repoRoot: REPO_ROOT });

  assert.equal(state.contractFixtureStatus, 'PASS');
  assert.equal(state.realLanguageCoverageStatus, 'LIMITED');
  assert.equal(state[FULL_I18N_TOKEN_NAME], 0);
  assert.equal(state.testedLanguageSet.contractFixtureOnly, true);
  assert.equal(state.testedLanguageSet.realLanguageMatrixRun, false);
  assert.equal(state.testedLanguageSet.bidiLayoutEngineRun, false);
  assert.equal(state.testedLanguageSet.releaseSupportClaim, false);
});

test('b3c12 i18n text anchor safety: limit rows forbid release i18n support and global green', async () => {
  const { evaluateB3C12I18nTextAnchorSafetyState } = await loadModule();
  const state = await evaluateB3C12I18nTextAnchorSafetyState({ repoRoot: REPO_ROOT });
  const limitIds = state.i18nLimitRows.map((row) => row.id).sort();

  assert.deepEqual(limitIds, [
    'BIDI_LAYOUT_LIMITED',
    'FONT_SHAPING_NOT_CLAIMED',
    'FULL_LOCALE_SORT_NOT_CLAIMED',
    'LANGUAGE_COVERAGE_LIMITED',
    'SEGMENTER_FALLBACK_LIMITED',
  ]);
  assert.equal(state.i18nLimitRows.every((row) => row.releaseSupportClaim === false), true);
  assert.equal(state.provisionalScope.some((row) => row.id === 'FULL_GLOBAL_I18N_GREEN' && row.status === 'FORBIDDEN_IN_B3C12'), true);
  assert.equal(state.unsupportedScope.some((row) => row.id === 'BIDI_LAYOUT_RENDERING'), true);
});

test('b3c12 i18n text anchor safety: donor intake remains context only', async () => {
  const { evaluateB3C12I18nTextAnchorSafetyState } = await loadModule();
  const state = await evaluateB3C12I18nTextAnchorSafetyState({ repoRoot: REPO_ROOT });

  assert.equal(state.proof.donorIntakeContextOnly, true);
  assert.equal(state.donorIntake.class, 'READ_ONLY_CONTEXT_ONLY');
  assert.equal(state.donorIntake.codeImported, false);
  assert.equal(state.donorIntake.completionClaimImported, false);
  assert.equal(state.donorIntake.activeCanonOverDonor, true);
  assert.ok(state.donorIntake.archiveRows.length >= 4);
});

test('b3c12 i18n text anchor safety: forbidden adjacent claims fail evaluation', async () => {
  const { evaluateB3C12I18nTextAnchorSafetyState } = await loadModule();
  const state = await evaluateB3C12I18nTextAnchorSafetyState({
    repoRoot: REPO_ROOT,
    forceClaims: {
      releaseI18nSupportClaim: true,
      inlineRangeSchemaMutation: true,
      rendererSearchUiChange: true,
      xplatCertification: true,
      a11yTrustSurfaceProof: true,
    },
  });

  assert.equal(state.ok, false);
  assert.equal(state.status, 'FAIL');
  assert.equal(state.failRows.includes('FORBIDDEN_SCOPE_OR_RELEASE_CLAIM'), true);
  assert.equal(state.failSignal, 'E_B3C12_I18N_TEXT_ANCHOR_SAFETY_NOT_OK');
});

test('b3c12 i18n text anchor safety: scope flags reject UI renderer storage export security and dependency drift', async () => {
  const { evaluateB3C12I18nTextAnchorSafetyState } = await loadModule();
  const state = await evaluateB3C12I18nTextAnchorSafetyState({ repoRoot: REPO_ROOT });

  assert.equal(state.scope.i18nTextAnchorSafetyOnly, true);
  assert.equal(state.scope.contractBaselineOnly, true);
  assert.equal(state.scope.inlineRangeSchemaMutated, false);
  assert.equal(state.scope.uiTouched, false);
  assert.equal(state.scope.editorRendererRewritten, false);
  assert.equal(state.scope.proseMirrorTiptapChanged, false);
  assert.equal(state.scope.storageFormatChanged, false);
  assert.equal(state.scope.storageMutated, false);
  assert.equal(state.scope.projectStoreTouched, false);
  assert.equal(state.scope.atomicWriteTouched, false);
  assert.equal(state.scope.exportPipelineRewritten, false);
  assert.equal(state.scope.securityPolicyRewritten, false);
  assert.equal(state.scope.releaseClaim, false);
  assert.equal(state.scope.releaseI18nSupportClaim, false);
  assert.equal(state.scope.fullGlobalI18nGreenClaim, false);
  assert.equal(state.scope.fullBidiLayoutEngineClaim, false);
  assert.equal(state.scope.translationOrLocaleFeatureClaim, false);
  assert.equal(state.scope.rendererSearchUiChange, false);
  assert.equal(state.scope.xplatCertification, false);
  assert.equal(state.scope.a11yTrustSurfaceProof, false);
  assert.equal(state.scope.b3c09PerfGapFix, false);
  assert.equal(state.scope.b3c11PlatformLimitFix, false);
  assert.equal(state.scope.newDependency, false);
});
