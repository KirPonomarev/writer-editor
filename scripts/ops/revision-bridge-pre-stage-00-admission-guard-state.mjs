#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const TOKEN_NAME = 'REVISION_BRIDGE_PRE_STAGE_00_ADMISSION_GUARD_OK';

const ARTIFACT_PATHS = {
  layerTable: 'docs/OPS/STATUS/REVISION_BRIDGE_LAYER_TABLE_V1.json',
  modeTable: 'docs/OPS/STATUS/REVISION_BRIDGE_MODE_TABLE_V1.json',
  profile: 'docs/OPS/STATUS/REVISION_BRIDGE_KERNEL_001_ADMISSION_PROFILE_V1.json',
  nextRecord: 'docs/OPS/STATUS/NEXT_CONTOUR_OPENING_RECORD_REVISION_BRIDGE_KERNEL_001_V1.json',
};

const ALLOWED_CHANGED_PATHS = new Set([
  'docs/tasks/REVISION_BRIDGE_PRE_STAGE_00_ADMISSION_GUARD_001.md',
  'docs/tasks/EXACT_TEXT_APPLY_PRODUCT_APPLY_ADMISSION_GATE_001Q.md',
  'docs/tasks/EXACT_TEXT_APPLY_INTERNAL_WRITE_PATH_PROTOTYPE_001R.md',
  'docs/tasks/EXACT_TEXT_APPLY_FIXTURE_DURABLE_RECEIPT_AND_FAILURE_RECEIPT_001S.md',
  'docs/tasks/PRIVATE_PRODUCT_APPLY_RECEIPT_ADMISSION_001T.md',
  'docs/tasks/PRIVATE_PRODUCT_APPLY_RECEIPT_IMPLEMENTATION_001U.md',
  'docs/tasks/PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_ADMISSION_001V.md',
  'docs/tasks/PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_EXECUTION_001W.md',
  'docs/tasks/PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_CLOSEOUT_001X.md',
  'docs/tasks/PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_ADMISSION_001Y.md',
  'docs/tasks/PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_NEXT_CONTOUR_ADMISSION_001Z.md',
  'docs/tasks/PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_BRIEF_002A.md',
  'docs/tasks/PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_CONTRACT_SHAPE_002B.md',
  'docs/tasks/PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_ADMISSION_002C.md',
  'docs/tasks/PRIVATE_EXACT_TEXT_APPLY_WITH_RECEIPT_PRIVATE_PORT_IMPLEMENTATION_002D.md',
  'src/revisionBridge/reviewIrKernel.mjs',
  'src/revisionBridge/exactTextApplyInternalWritePrototype.mjs',
  'src/revisionBridge/exactTextApplyFixtureDurableReceiptPrototype.mjs',
  'src/revisionBridge/exactTextApplyPrivateProductApplyReceiptAdmission.mjs',
  'src/revisionBridge/exactTextApplyPrivateProductApplyReceipt.mjs',
  'src/revisionBridge/exactTextApplyWithReceiptAdmission.mjs',
  'src/revisionBridge/exactTextApplyWithReceiptExecution.mjs',
  'src/revisionBridge/exactTextApplyWithReceiptCloseout.mjs',
  'src/revisionBridge/exactTextApplyWithReceiptNextAdmission.mjs',
  'src/revisionBridge/exactTextApplyWithReceiptNextContourAdmission.mjs',
  'src/revisionBridge/exactTextApplyWithReceiptPrivateContractBrief.mjs',
  'src/revisionBridge/exactTextApplyWithReceiptPrivateContractShape.mjs',
  'src/revisionBridge/exactTextApplyWithReceiptPrivatePortAdmission.mjs',
  'src/revisionBridge/exactTextApplyWithReceiptPrivatePortImplementation.mjs',
  ARTIFACT_PATHS.layerTable,
  ARTIFACT_PATHS.modeTable,
  ARTIFACT_PATHS.profile,
  ARTIFACT_PATHS.nextRecord,
  'scripts/ops/revision-bridge-pre-stage-00-admission-guard-state.mjs',
  'test/contracts/revision-bridge-admission-guard.contract.test.js',
  'test/contracts/exactTextApplyProductApplyAdmissionGate.contract.test.js',
  'test/contracts/exactTextApplyInternalWritePrototype.contract.test.js',
  'test/contracts/exactTextApplyFixtureDurableReceiptPrototype.contract.test.js',
  'test/contracts/exactTextApplyPrivateProductApplyReceiptAdmission.contract.test.js',
  'test/contracts/exactTextApplyPrivateProductApplyReceipt.contract.test.js',
  'test/contracts/exactTextApplyWithReceiptAdmission.contract.test.js',
  'test/contracts/exactTextApplyWithReceiptExecution.contract.test.js',
  'test/contracts/exactTextApplyWithReceiptCloseout.contract.test.js',
  'test/contracts/exactTextApplyWithReceiptNextAdmission.contract.test.js',
  'test/contracts/exactTextApplyWithReceiptNextContourAdmission.contract.test.js',
  'test/contracts/exactTextApplyWithReceiptPrivateContractBrief.contract.test.js',
  'test/contracts/exactTextApplyWithReceiptPrivateContractShape.contract.test.js',
  'test/contracts/exactTextApplyWithReceiptPrivatePortAdmission.contract.test.js',
  'test/contracts/exactTextApplyWithReceiptPrivatePortImplementation.contract.test.js',
  'test/contracts/exactTextApplyProductApplyReadinessReview.contract.test.js',
  'test/contracts/exactTextApplyProductStoragePrimitiveEvidence.contract.test.js',
  'test/contracts/exactTextApplyTestFixtureReceiptFile.contract.test.js',
  'test/contracts/exactTextApplyTestOnlyProductShapedStorageDryRun.contract.test.js',
  'test/contracts/exactTextApplyTestOnlyStoragePrimitiveExecutionHarness.contract.test.js',
]);

const ALLOWED_CHANGED_BASENAMES = new Set(
  Array.from(ALLOWED_CHANGED_PATHS, (allowedPath) => path.basename(allowedPath)),
);

const REQUIRED_LAYERS = [
  'RUNTIME_CORE',
  'GOVERNANCE_CONTROL_PLANE',
  'RELEASE_CLAIM_GATE',
  'TRANSPORT_ADAPTER',
  'PRESENTATION_UI',
  'FUTURE_ADAPTER',
];

const REQUIRED_MODES = [
  'REPORT_ONLY',
  'PR_KERNEL',
  'PR_TRANSPORT',
  'RELEASE_CLAIM',
  'POST_RELEASE_RESEARCH',
];

const REQUIRED_SCOPE_IN = [
  'REVIEWPATCHSET',
  'REVIEWOPIR',
  'SELECTORSTACK_SCHEMA_V1',
  'SOURCE_VIEW_STATE',
  'EVIDENCEREF',
  'PROV_MIN',
  'MINIMAL_REVIEWBOM',
  'CANONICAL_HASH',
  'STALE_BASELINE_ZERO_APPLYOPS',
  'PLAINTEXT_SHADOW_PREVIEW',
  'BLOCKED_APPLY_PLAN',
];

const REQUIRED_SCOPE_OUT = [
  'WRITES',
  'UI',
  'DOCX_PARSER_EXPANSION',
  'STORAGE_MIGRATION',
  'NETWORK',
  'WORD_GOOGLE_INTEGRATION',
  'RUNTIME_APPLY',
];

const REQUIRED_NEGATIVES = [
  'STALE_BASELINE_ZERO_APPLYOPS',
  'DIRECT_IMPORT_CANNOT_WRITE_MANUSCRIPT',
  'DUPLICATE_OR_AMBIGUOUS_TEXT_NOT_AUTO_ELIGIBLE',
  'UNSUPPORTED_SURFACE_BECOMES_REVIEWBOM_ENTRY',
  'OUTPUT_PURE_AND_MUTATION_FREE',
];

const MAINLINE_BRANCH_NAMES = new Set(['main', 'master', 'develop']);

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readJson(repoRoot, relativePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function asSet(list) {
  return new Set(Array.isArray(list) ? list.filter((item) => typeof item === 'string') : []);
}

function hasAll(values, required) {
  const set = asSet(values);
  return required.every((item) => set.has(item));
}

function byId(list) {
  return new Map((Array.isArray(list) ? list : []).map((item) => [item.id, item]));
}

function evaluateChangedScope(repoRoot) {
  let raw = '';
  try {
    raw = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
  } catch {
    return { ok: false, failReason: 'GIT_STATUS_UNAVAILABLE', changedPaths: [] };
  }

  const changedPaths = raw
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => line.slice(3))
    .map((value) => value.split(' -> ').pop())
    .filter(Boolean);

  const changedBasenames = changedPaths.map((filePath) => path.basename(filePath));
  const outsideAllowlist = changedPaths.filter((filePath) => !ALLOWED_CHANGED_PATHS.has(filePath));
  const outsideBasenameAllowlist = changedBasenames.filter((basename) => !ALLOWED_CHANGED_BASENAMES.has(basename));
  return {
    ok: outsideAllowlist.length === 0,
    failReason: outsideAllowlist.length === 0 ? '' : 'OUT_OF_SCOPE_CHANGED_PATH',
    changedPaths,
    changedBasenames,
    outsideAllowlist,
    outsideBasenameAllowlist,
  };
}

function evaluateBranchIsolation(repoRoot, branchContext = null) {
  let currentBranch = '';
  let headSha = '';
  if (branchContext) {
    currentBranch = String(branchContext.currentBranch || '');
    headSha = String(branchContext.headSha || '');
  } else {
    try {
      currentBranch = execFileSync('git', ['branch', '--show-current'], {
        cwd: repoRoot,
        encoding: 'utf8',
      }).trim();
      headSha = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: repoRoot,
        encoding: 'utf8',
      }).trim();
    } catch {
      return {
        ok: false,
        failReason: 'GIT_BRANCH_UNAVAILABLE',
        currentBranch,
        headSha,
      };
    }
  }

  const isRevisionBridgeFeatureBranch = /^codex\/revision-bridge-[a-z0-9-]+$/u.test(currentBranch);
  const isMainlineBranch = MAINLINE_BRANCH_NAMES.has(currentBranch);
  const looksMainTarget = currentBranch.includes('/main') || currentBranch.includes('-main-');

  return {
    ok: Boolean(headSha)
      && isRevisionBridgeFeatureBranch
      && !isMainlineBranch
      && !looksMainTarget,
    failReason: !currentBranch
      ? 'DETACHED_OR_MISSING_FEATURE_BRANCH'
      : (!isRevisionBridgeFeatureBranch || isMainlineBranch || looksMainTarget
        ? 'NOT_ISOLATED_REVISION_BRIDGE_FEATURE_BRANCH'
        : ''),
    currentBranch,
    headSha,
    isRevisionBridgeFeatureBranch,
    isMainlineBranch,
    looksMainTarget,
  };
}

function evaluateLayerTable(layerTable) {
  const layerIds = Array.isArray(layerTable?.layers) ? layerTable.layers.map((layer) => layer.id) : [];
  const rules = layerTable?.rules || {};
  return {
    ok: hasAll(layerIds, REQUIRED_LAYERS)
      && layerTable?.bindingMode === 'NONBINDING_LAYER_TAGS_FOR_THIS_CONTOUR'
      && layerTable?.featureBranchBoundary === 'OWNER_APPROVED_ISOLATED_REVISION_BRIDGE_FEATURE_BRANCH_ONLY'
      && layerTable?.mainlineBoundary === 'MAINLINE_DELIVERY_FORBIDDEN_WITHOUT_EXPLICIT_OWNER_APPROVAL'
      && rules.admissionTablesAreReferenceArtifactsNotCanonSources === true
      && rules.layerLabelsAreNonbindingAdmissionTags === true
      && rules.globalGovernanceRewriteOutOfScope === true
      && rules.minimalCrossLinkChecksForKernelAdmissionOnly === true
      && rules.releaseClaimGateCannotBlockPrKernel === true
      && rules.presentationUiCannotBeSourceOfTruth === true
      && rules.futureAdapterCannotCreateCurrentReleaseRequirement === true
      && rules.externalStandardsAreDesignModelsNotDependencies === true,
  };
}

function evaluateModeTable(modeTable) {
  const modes = byId(modeTable?.modes);
  const prKernel = modes.get('PR_KERNEL') || {};
  const releaseClaim = modes.get('RELEASE_CLAIM') || {};
  const prTransport = modes.get('PR_TRANSPORT') || {};
  const modeIds = Array.from(modes.keys());
  const rules = modeTable?.rules || {};
  const labelsReferenceActiveProfilesOnly = Array.from(modes.values()).every((mode) => (
    mode.labelType === 'NONBINDING_ADMISSION_TAG'
    && mode.activeCanonProfile === false
    && ['dev', 'pr', 'release'].includes(mode.activeProfileReference)
    && !Object.hasOwn(mode, 'activeProfile')
  ));

  return {
    ok: hasAll(modeIds, REQUIRED_MODES)
      && modeTable?.featureBranchBoundary === 'OWNER_APPROVED_ISOLATED_REVISION_BRIDGE_FEATURE_BRANCH_ONLY'
      && modeTable?.mainlineBoundary === 'MAINLINE_DELIVERY_FORBIDDEN_WITHOUT_EXPLICIT_OWNER_APPROVAL'
      && labelsReferenceActiveProfilesOnly
      && prKernel.wordLabsBlocking === false
      && prKernel.googleLabsBlocking === false
      && prKernel.networkBlocking === false
      && releaseClaim.wordLabsBlocking === true
      && releaseClaim.googleLabsBlocking === true
      && prTransport.hostileFileGateBlockingWhenExternalParserTouched === true
      && rules.modeTableIsReferenceArtifactNotCanonSource === true
      && rules.modeLabelsAreNonbindingAdmissionTags === true
      && rules.modeLabelsDoNotCreateActiveExecutionProfiles === true
      && rules.prKernelDoesNotRequireWordGoogleLabs === true
      && rules.releaseClaimRequiresClaimedEditorArtifacts === true
      && rules.hostileFileGateBlocksParserExpansionOnly === true
      && rules.mainlineDeliveryForbiddenWithoutExplicitOwnerApproval === true,
  };
}

function evaluateProfile(profile) {
  return {
    ok: profile?.taskId === 'REVISION_BRIDGE_V4_REVIEW_IR_KERNEL_001'
      && profile?.admissionTag === 'PR_KERNEL'
      && profile?.activeCanonProfile === false
      && !Object.hasOwn(profile, 'profileMode')
      && profile?.featureBranchBoundary === 'OWNER_APPROVED_ISOLATED_REVISION_BRIDGE_FEATURE_BRANCH_ONLY'
      && profile?.mainlineBoundary === 'MAINLINE_DELIVERY_FORBIDDEN_WITHOUT_EXPLICIT_OWNER_APPROVAL'
      && hasAll(profile?.scopeIn, REQUIRED_SCOPE_IN)
      && hasAll(profile?.scopeOut, REQUIRED_SCOPE_OUT)
      && hasAll(profile?.requiredNegatives, REQUIRED_NEGATIVES)
      && profile?.sourceBindingPolicy?.statusOnlyRuntimeClaimAllowed === false
      && profile?.sourceBindingPolicy?.docsOnlyRuntimeClaimAllowed === false
      && profile?.sourceBindingPolicy?.runtimeClaimRequiresCurrentCommitEvidence === true
      && profile?.branchPolicy?.isolatedFeatureBranchRequired === true
      && profile?.branchPolicy?.mainlineTargetAllowed === false
      && profile?.branchPolicy?.bindingBaseShaRequiredFromFeatureBranch === true
      && profile?.branchPolicy?.featureTargetRequiredBeforeWrite === true
      && profile?.branchPolicy?.mainPrAllowed === false
      && profile?.branchPolicy?.mainMergeAllowed === false
      && profile?.releaseClaimPolicy?.wordLabsBlockPrKernel === false
      && profile?.releaseClaimPolicy?.googleLabsBlockPrKernel === false
      && profile?.releaseClaimPolicy?.wordClaimRequiresArtifactPacket === true
      && profile?.releaseClaimPolicy?.googleClaimRequiresDocsSuggestionsAndDriveCommentsPackets === true
      && profile?.releaseClaimPolicy?.ownerBoundTrustRootBlocksKernelAdmission === false
      && profile?.releaseClaimPolicy?.ownerBoundTrustRootRequiredBeforeReleaseClaim === true
      && profile?.changedBasenamePolicy?.runtimeFeatureBasenamesAllowed === false
      && profile?.changedBasenamePolicy?.uiBasenamesAllowed === false
      && profile?.changedBasenamePolicy?.dependencyBasenamesAllowed === false
      && profile?.changedBasenamePolicy?.changedBasenamesMustBeAllowlistSubset === true
      && profile?.governancePolicy?.globalGovernanceRewriteAllowed === false
      && profile?.governancePolicy?.minimalCrossLinkChecksForKernelAdmissionOnly === true
      && profile?.governancePolicy?.admissionArtifactsAreCanonSources === false
      && profile?.governancePolicy?.outputTokenAdvisoryUntilFeatureBranchOwnerAccepts === true,
  };
}

function evaluateNextRecord(nextRecord, profile) {
  const profileScopeIn = asSet(profile?.scopeIn);
  const nextMustInclude = Array.isArray(nextRecord?.mustInclude) ? nextRecord.mustInclude : [];
  const nextMatchesProfile = nextMustInclude.every((item) => profileScopeIn.has(item));
  return {
    ok: nextRecord?.status === 'PENDING_ADMISSION_GUARD_DELIVERY'
      && nextRecord?.featureBranchBoundary === 'OWNER_APPROVED_ISOLATED_REVISION_BRIDGE_FEATURE_BRANCH_ONLY'
      && nextRecord?.mainlineBoundary === 'MAINLINE_DELIVERY_FORBIDDEN_WITHOUT_EXPLICIT_OWNER_APPROVAL'
      && nextRecord?.openingAllowedNow === false
      && hasAll(nextRecord?.openingAllowedAfter, [
        'ADMISSION_GUARD_TEST_PASS',
        'CLEAN_SCOPE_PROOF',
        'COMMIT_SHA_RECORDED',
        'FEATURE_BRANCH_DELIVERY_OUTCOME_RECORDED',
      ])
      && nextRecord?.nextTaskId === 'REVISION_BRIDGE_V4_REVIEW_IR_KERNEL_001'
      && nextRecord?.requiredProfile === 'REVISION_BRIDGE_KERNEL_001_ADMISSION_PROFILE_V1'
      && nextRecord?.allowedAdmissionTag === 'PR_KERNEL'
      && nextRecord?.activeCanonProfile === false
      && !Object.hasOwn(nextRecord, 'allowedMode')
      && nextRecord?.nextContourClass === 'CONTRACT_ONLY_PURE_CORE'
      && nextMatchesProfile
      && hasAll(nextRecord?.mustNotRequire, [
        'WORD_LABS',
        'GOOGLE_LABS',
        'NETWORK_CHECKS',
        'DOCX_PARSER_EXPANSION',
        'UI_WORK',
        'RUNTIME_APPLY',
        'STORAGE_MIGRATION',
        'DEPENDENCY_CHANGE',
      ])
      && hasAll(nextRecord?.mustInclude, [
        'REVIEWPATCHSET',
        'REVIEWOPIR',
        'SELECTORSTACK_SCHEMA_V1',
        'SOURCE_VIEW_STATE',
        'EVIDENCEREF',
        'PROV_MIN',
        'MINIMAL_REVIEWBOM',
        'CANONICAL_HASH',
        'STALE_BASELINE_ZERO_APPLYOPS',
        'PLAINTEXT_SHADOW_PREVIEW',
        'BLOCKED_APPLY_PLAN',
      ])
      && hasAll(nextRecord?.ownerDecisionRequiredBeforeWrite, [
        'FEATURE_BRANCH_TARGET_CONFIRMATION',
        'BINDING_BASE_SHA_FROM_FEATURE_BRANCH',
        'DELIVERY_POLICY_CONFIRMATION_FOR_FEATURE_BRANCH',
      ])
      && hasAll(nextRecord?.mustReject, [
        'MAIN_BRANCH_TARGET',
        'MAIN_PR',
        'MAIN_MERGE',
        'GLOBAL_GOVERNANCE_REWRITE',
        'ADMISSION_TABLE_AS_CANON_SOURCE',
        'STATUS_ONLY_RUNTIME_PASS',
        'DOCS_ONLY_RUNTIME_PASS',
        'RUNTIME_FEATURE_BASENAME',
        'UI_BASENAME',
        'DEPENDENCY_BASENAME',
        'OWNER_BOUND_TRUST_ROOT_AS_KERNEL_BLOCKER',
      ]),
  };
}

function evaluateNegativeResults({ layerTable, modeTable, profile }) {
  const badModeTable = structuredClone(modeTable);
  const prKernel = badModeTable.modes.find((mode) => mode.id === 'PR_KERNEL');
  prKernel.wordLabsBlocking = true;

  const badReleaseTable = structuredClone(modeTable);
  const releaseClaim = badReleaseTable.modes.find((mode) => mode.id === 'RELEASE_CLAIM');
  releaseClaim.googleLabsBlocking = false;

  const badProfileStatusOnly = structuredClone(profile);
  badProfileStatusOnly.sourceBindingPolicy.statusOnlyRuntimeClaimAllowed = true;

  const badProfileDocsOnly = structuredClone(profile);
  badProfileDocsOnly.sourceBindingPolicy.docsOnlyRuntimeClaimAllowed = true;

  const badProfileRuntimeApply = structuredClone(profile);
  badProfileRuntimeApply.scopeOut = badProfileRuntimeApply.scopeOut.filter((item) => item !== 'RUNTIME_APPLY');

  const badProfileParser = structuredClone(profile);
  badProfileParser.scopeOut = badProfileParser.scopeOut.filter((item) => item !== 'DOCX_PARSER_EXPANSION');

  const badLayerTable = structuredClone(layerTable);
  badLayerTable.layers = badLayerTable.layers.filter((layer) => layer.id !== 'RELEASE_CLAIM_GATE');

  const missingModeTable = structuredClone(modeTable);
  missingModeTable.modes = missingModeTable.modes.filter((mode) => mode.id !== 'PR_KERNEL');

  const bindingDriftModeTable = structuredClone(modeTable);
  bindingDriftModeTable.modes.find((mode) => mode.id === 'PR_KERNEL').labelType = 'ACTIVE_CANON_MODE';

  const activeProfileDriftModeTable = structuredClone(modeTable);
  activeProfileDriftModeTable.modes.find((mode) => mode.id === 'PR_KERNEL').activeCanonProfile = true;

  const badProfileMainline = structuredClone(profile);
  badProfileMainline.branchPolicy.mainlineTargetAllowed = true;

  const badProfileMissingFeatureTarget = structuredClone(profile);
  badProfileMissingFeatureTarget.branchPolicy.featureTargetRequiredBeforeWrite = false;

  const badProfileMainPr = structuredClone(profile);
  badProfileMainPr.branchPolicy.mainPrAllowed = true;

  const badProfileMainMerge = structuredClone(profile);
  badProfileMainMerge.branchPolicy.mainMergeAllowed = true;

  const badProfileGlobalGovernance = structuredClone(profile);
  badProfileGlobalGovernance.governancePolicy.globalGovernanceRewriteAllowed = true;

  const badLayerTableCanonSource = structuredClone(layerTable);
  badLayerTableCanonSource.rules.admissionTablesAreReferenceArtifactsNotCanonSources = false;

  const badProfileTrustRootKernelBlocker = structuredClone(profile);
  badProfileTrustRootKernelBlocker.releaseClaimPolicy.ownerBoundTrustRootBlocksKernelAdmission = true;

  return {
    NEGATIVE_01_PR_KERNEL_WORD_GOOGLE_LAB_REQUIREMENT_REJECTED:
      evaluateModeTable(badModeTable).ok === false,
    NEGATIVE_02_RELEASE_CLAIM_EDITOR_ARTIFACT_GAP_REJECTED:
      evaluateModeTable(badReleaseTable).ok === false,
    NEGATIVE_03_STATUS_ONLY_RUNTIME_CLAIM_REJECTED:
      evaluateProfile(badProfileStatusOnly).ok === false,
    NEGATIVE_04_DOCS_ONLY_RUNTIME_CLAIM_REJECTED:
      evaluateProfile(badProfileDocsOnly).ok === false,
    NEGATIVE_05_RUNTIME_APPLY_IN_KERNEL_PROFILE_REJECTED:
      evaluateProfile(badProfileRuntimeApply).ok === false,
    NEGATIVE_06_DOCX_PARSER_IN_KERNEL_PROFILE_REJECTED:
      evaluateProfile(badProfileParser).ok === false,
    NEGATIVE_07_LAYER_TABLE_RELEASE_GATE_MISSING_REJECTED:
      evaluateLayerTable(badLayerTable).ok === false,
    NEGATIVE_08_MODE_TABLE_PR_KERNEL_MISSING_REJECTED:
      evaluateModeTable(missingModeTable).ok === false,
    NEGATIVE_09_MODE_LABEL_AS_ACTIVE_CANON_MODE_REJECTED:
      evaluateModeTable(bindingDriftModeTable).ok === false,
    NEGATIVE_10_PR_KERNEL_AS_ACTIVE_PROFILE_REJECTED:
      evaluateModeTable(activeProfileDriftModeTable).ok === false,
    NEGATIVE_11_MAINLINE_TARGET_IN_KERNEL_PROFILE_REJECTED:
      evaluateProfile(badProfileMainline).ok === false,
    NEGATIVE_12_MISSING_FEATURE_TARGET_RULE_REJECTED:
      evaluateProfile(badProfileMissingFeatureTarget).ok === false,
    NEGATIVE_13_MAIN_PR_ALLOWED_REJECTED:
      evaluateProfile(badProfileMainPr).ok === false,
    NEGATIVE_14_MAIN_MERGE_ALLOWED_REJECTED:
      evaluateProfile(badProfileMainMerge).ok === false,
    NEGATIVE_15_GLOBAL_GOVERNANCE_REWRITE_REQUIREMENT_REJECTED:
      evaluateProfile(badProfileGlobalGovernance).ok === false,
    NEGATIVE_16_ADMISSION_TABLE_AS_CANON_SOURCE_REJECTED:
      evaluateLayerTable(badLayerTableCanonSource).ok === false,
    NEGATIVE_17_TRUST_ROOT_KERNEL_BLOCKER_REJECTED:
      evaluateProfile(badProfileTrustRootKernelBlocker).ok === false,
    NEGATIVE_18_MAIN_BRANCH_REJECTED:
      evaluateBranchIsolation(process.cwd(), {
        currentBranch: 'main',
        headSha: '0000000000000000000000000000000000000000',
      }).ok === false,
    NEGATIVE_19_MAIN_NAMED_REVISION_BRANCH_REJECTED:
      evaluateBranchIsolation(process.cwd(), {
        currentBranch: 'codex/revision-bridge-admission-guard-main-001',
        headSha: '0000000000000000000000000000000000000000',
      }).ok === false,
  };
}

export function evaluateRevisionBridgeAdmissionGuardState({ repoRoot = process.cwd() } = {}) {
  const layerTable = readJson(repoRoot, ARTIFACT_PATHS.layerTable);
  const modeTable = readJson(repoRoot, ARTIFACT_PATHS.modeTable);
  const profile = readJson(repoRoot, ARTIFACT_PATHS.profile);
  const nextRecord = readJson(repoRoot, ARTIFACT_PATHS.nextRecord);

  const checks = {
    branchIsolation: evaluateBranchIsolation(repoRoot),
    changedScope: evaluateChangedScope(repoRoot),
    layerTable: evaluateLayerTable(layerTable),
    modeTable: evaluateModeTable(modeTable),
    profile: evaluateProfile(profile),
    nextRecord: evaluateNextRecord(nextRecord, profile),
  };

  const negativeResults = evaluateNegativeResults({ layerTable, modeTable, profile });
  const allChecksPass = Object.values(checks).every((check) => check.ok === true);
  const allNegativesPass = Object.values(negativeResults).every(Boolean);
  const ok = allChecksPass && allNegativesPass;
  const deliverySatisfied = false;
  const nextContourOpeningAllowed = nextRecord?.openingAllowedNow === true && deliverySatisfied === true;

  return {
    ok,
    token: ok ? 1 : 0,
    [TOKEN_NAME]: ok ? 1 : 0,
    tokenName: TOKEN_NAME,
    checks,
    negativeResults,
    rulesSatisfied: ok,
    deliverySatisfied,
    finalGateSatisfied: ok && deliverySatisfied,
    nextContourOpeningAllowed,
    advisoryUntilFeatureBranchOwnerAccepts:
      profile?.governancePolicy?.outputTokenAdvisoryUntilFeatureBranchOwnerAccepts === true,
  };
}

function parseArgs(argv = process.argv.slice(2)) {
  return { json: argv.includes('--json') };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs();
  const state = evaluateRevisionBridgeAdmissionGuardState();
  if (args.json) {
    process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
  } else {
    process.stdout.write(`${TOKEN_NAME}=${state[TOKEN_NAME]}\n`);
    process.stdout.write(`FINAL_GATE_SATISFIED=${state.finalGateSatisfied ? 1 : 0}\n`);
  }
  process.exit(state.ok ? 0 : 1);
}
