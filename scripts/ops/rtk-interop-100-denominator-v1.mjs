#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const DENOMINATOR_PATH = 'docs/OPS/RTK/YALKEN_INTEROP_100_DENOMINATOR_V1.json';
export const LEDGER_PATH = 'docs/OPS/RTK/YALKEN_INTEROP_100_EVIDENCE_LEDGER_V1.json';
export const GOVERNANCE_APPROVALS_PATH = 'docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json';
export const C1B_INVENTORY_PATH = 'docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json';
export const CONTRACT_BASENAME = 'rtk-interop-100-denominator.contract.test.js';
export const CONTRACT_ID = 'YALKEN_INTEROP_100_SUPPORTED_CONTRACT_V1';
export const SPEC_SCHEMA = 'yalken.interop100.denominator.v1';
export const LEDGER_SCHEMA = 'yalken.interop100.evidenceLedger.v1';
export const CELL_EVIDENCE_PROMOTION_METADATA_PATHS = Object.freeze([
  C1B_INVENTORY_PATH,
  DENOMINATOR_PATH,
  LEDGER_PATH,
  GOVERNANCE_APPROVALS_PATH,
  'scripts/ops/rtk-interop-100-denominator-v1.mjs',
  `test/contracts/${CONTRACT_BASENAME}`,
]);

export const FIELD_IDS = Object.freeze([
  'TEXT',
  'NOVEL_SCENE_STRUCTURE',
  'ORDER',
  'STYLES',
  'COMMENTS',
  'NOTES',
  'FOOTNOTES_ENDNOTES',
  'TABLES',
  'MEDIA_ASSETS',
  'SECTIONS',
  'UNICODE_IME_LOCALE',
  'IDENTIFIERS_ANCHORS',
  'TRACKED_REVIEW_SEMANTICS',
  'METADATA',
]);
export const VOLUME_IDS = Object.freeze([
  'SINGLE_SCENE',
  'MULTI_SCENE',
  'FULL_SYNTHETIC_NOVEL',
  'LARGE_DOCUMENT',
  'MALFORMED_HOSTILE_INPUT',
]);
export const ROUTE_IDS = Object.freeze(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8']);
export const EXECUTION_PROFILE_IDS = Object.freeze(['SOURCE_RUNTIME', 'PACKAGED_BUILD_RUNTIME']);
export const EXPECTED_REQUIRED_CELLS = 1120;
export const COUNTED_STATUS = 'PASS';
export const NON_COUNTED_STATUSES = Object.freeze([
  'FAIL',
  'BLOCKED',
  'MANUAL',
  'SKIPPED',
  'STALE',
  'DIFFERENT_HEAD',
  'NOT_EXECUTED',
  'UNSUPPORTED',
  'OPAQUE_ONLY',
  'TYPED_REFUSAL',
]);
export const REQUIRED_ORACLES = Object.freeze([
  'SEMANTIC',
  'STRUCTURE',
  'ORDER',
  'LOSS',
  'PROVENANCE',
  'INDEPENDENT_READBACK',
  'CLEANUP',
]);
export const WORD_PHYSICAL_RUNTIME_ROOT = '/Users/kirillponomarev/Library/Containers/com.microsoft.Word/Data/Documents/YalkenWordAutomation/R2_4';
export const GOOGLE_DOCX_IMPORT_TYPED_BLOCKER = 'GOOGLE_IMPORT_SOURCE_FILE_REFERENCE_REQUIRED';
export const GOOGLE_DOCX_IMPORT_TRANSPORT_STEPS = Object.freeze([
  'DIRECT_LOCAL_PATH_IMPORT_NEGATIVE',
  'UPLOAD_LOCAL_DOCX_AS_RAW_DRIVE_FILE',
  'FETCH_UPLOADED_DOCX_AS_INTERNAL_FILE_URI',
  'IMPORT_INTERNAL_FILE_URI_AS_NATIVE_GOOGLE_DOC',
  'VERIFY_NATIVE_READBACK',
  'EXPORT_NATIVE_DOCX',
  'DELETE_EXACT_CREATED_GOOGLE_FILES',
]);
export const GOOGLE_DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const ROUTE_QUALIFICATION_STATUS = 'PASS_NON_CELL_ROUTE_QUALIFICATION';

const SHA256_RE = /^(?:sha256:)?[0-9a-f]{64}$/u;
const COMMIT_RE = /^[0-9a-f]{40}$/u;
const ALLOWED_OUTSIDE_DISPOSITIONS = new Set(['OPAQUE_PRESERVED', 'EXPLICIT_LOSS', 'MANUAL', 'UNSUPPORTED']);
const ALLOWED_STATUSES = new Set([COUNTED_STATUS, ...NON_COUNTED_STATUSES]);

function repoRootFromHere() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readJson(repoRoot, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

function exactIds(rows) {
  return Array.isArray(rows) ? rows.map((row) => row?.id) : [];
}

function sameArray(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function unique(values) {
  return new Set(values).size === values.length;
}

function sha256(value) {
  return typeof value === 'string' && SHA256_RE.test(value);
}

function commitSha(value) {
  return typeof value === 'string' && COMMIT_RE.test(value);
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function currentGitHead(repoRoot) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' });
  if (result.status !== 0) return '';
  return String(result.stdout || '').trim();
}

function gitMergeBaseIsAncestor(repoRoot, ancestor, descendant) {
  if (ancestor === descendant) return true;
  const result = spawnSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], { cwd: repoRoot, encoding: 'utf8' });
  return result.status === 0;
}

function gitDiffNameOnly(repoRoot, base, head) {
  const result = spawnSync('git', ['diff', '--name-only', `${base}..${head}`], { cwd: repoRoot, encoding: 'utf8' });
  if (result.status !== 0) return null;
  return String(result.stdout || '').split('\n').map((line) => line.trim()).filter(Boolean);
}

function validateEvidenceHeadBinding({ cellId, exactHeadSha, sourceRevision, currentHead, repoRoot, context, errors }) {
  if (exactHeadSha === currentHead) return;
  if (!commitSha(exactHeadSha)) {
    errors.push(`${cellId}:${context}_HEAD_INVALID`);
    return;
  }
  if (sourceRevision !== exactHeadSha) {
    errors.push(`${cellId}:${context}_SOURCE_HEAD_MISMATCH`);
    return;
  }
  if (!gitMergeBaseIsAncestor(repoRoot, exactHeadSha, currentHead)) {
    errors.push(`${cellId}:${context}_PROMOTION_NOT_DESCENDANT`);
    return;
  }
  const changedFiles = gitDiffNameOnly(repoRoot, exactHeadSha, currentHead);
  if (!Array.isArray(changedFiles)) {
    errors.push(`${cellId}:${context}_PROMOTION_DIFF_UNAVAILABLE`);
    return;
  }
  const allowed = new Set(CELL_EVIDENCE_PROMOTION_METADATA_PATHS);
  const outside = changedFiles.filter((filePath) => !allowed.has(filePath));
  if (outside.length > 0) {
    errors.push(`${cellId}:${context}_PROMOTION_PATHS_OUTSIDE_ALLOWLIST:${outside.join(',')}`);
  }
}

export function readInterop100Denominator(repoRoot = repoRootFromHere()) {
  return readJson(repoRoot, DENOMINATOR_PATH);
}

export function readInterop100EvidenceLedger(repoRoot = repoRootFromHere()) {
  return readJson(repoRoot, LEDGER_PATH);
}

export function buildRequiredCells(spec) {
  const cells = [];
  for (const field of spec.fields || []) {
    for (const volume of spec.volumes || []) {
      for (const route of spec.routes || []) {
        for (const executionProfile of spec.executionProfiles || []) {
          cells.push({
            cellId: `${field.id}__${volume.id}__${route.id}__${executionProfile.id}`,
            fieldId: field.id,
            volumeId: volume.id,
            routeId: route.id,
            executionProfileId: executionProfile.id,
          });
        }
      }
    }
  }
  return cells;
}

function validateWordPhysicalRuntimePolicy(spec, errors) {
  const policy = spec.wordPhysicalRuntimePolicy;
  if (!isObject(policy)) {
    errors.push('WORD_PHYSICAL_RUNTIME_POLICY_REQUIRED');
    return;
  }
  if (policy.persistentRoot !== WORD_PHYSICAL_RUNTIME_ROOT) errors.push('WORD_PHYSICAL_RUNTIME_ROOT_INVALID');
  if (policy.allWordDocxArtifactsMustBeDescendants !== true) errors.push('WORD_ARTIFACT_ROOT_CONTAINMENT_REQUIRED');
  if (policy.perRunUniqueChildDirectoryRequired !== true) errors.push('WORD_RUN_CHILD_DIRECTORY_REQUIRED');
  if (policy.deleteOnlyOwnRunSubdirectories !== true) errors.push('WORD_CLEANUP_SCOPE_INVALID');
  if (!sameArray(policy.preserveRootAndHistoricalEvidence, ['ROOT', 'WP707', 'WP709'])) {
    errors.push('WORD_HISTORICAL_EVIDENCE_PRESERVATION_INVALID');
  }
  if (policy.grantFileAccessTargetIfPrompted !== 'PERSISTENT_ROOT_ONLY') errors.push('WORD_GRANT_TARGET_POLICY_INVALID');
  if (policy.repeatGrantAfterRootGrantStatus !== 'ACCESS_REGRESSION') errors.push('WORD_REPEAT_GRANT_STATUS_INVALID');
}

function validateProviderTransportPolicy(spec, errors) {
  const policy = spec.providerTransportPolicy?.googleLocalDocxToNativeImport;
  if (!isObject(policy)) {
    errors.push('GOOGLE_LOCAL_DOCX_IMPORT_TRANSPORT_POLICY_REQUIRED');
    return;
  }
  if (policy.status !== 'ROUTE_QUALIFIED_NOT_CELL_PASS') errors.push('GOOGLE_IMPORT_ROUTE_QUALIFICATION_STATUS_INVALID');
  if (policy.directLocalPathImport?.supported !== false) errors.push('GOOGLE_DIRECT_LOCAL_PATH_IMPORT_MUST_NOT_BE_SUPPORTED');
  if (policy.directLocalPathImport?.countsAsPass !== false) errors.push('GOOGLE_DIRECT_LOCAL_PATH_IMPORT_MUST_NOT_COUNT');
  if (policy.directLocalPathImport?.typedBlocker !== GOOGLE_DOCX_IMPORT_TYPED_BLOCKER) errors.push('GOOGLE_DIRECT_LOCAL_PATH_TYPED_BLOCKER_INVALID');
  if (policy.sourceReferenceKind !== 'INTERNAL_UPLOADED_FILE_REFERENCE') errors.push('GOOGLE_IMPORT_SOURCE_REFERENCE_KIND_INVALID');
  if (!sameArray(policy.requiredSteps, GOOGLE_DOCX_IMPORT_TRANSPORT_STEPS)) errors.push('GOOGLE_IMPORT_REQUIRED_STEPS_INVALID');
  if (policy.createdDriveFilesCleanup !== 'EXACT_CREATED_IDS_DELETE_REQUIRED') errors.push('GOOGLE_IMPORT_CLEANUP_POLICY_INVALID');
  if (policy.routeQualificationCountsAsCellPass !== false) errors.push('GOOGLE_ROUTE_QUALIFICATION_MUST_NOT_COUNT');
  if (policy.productRuntimeNetworkPolicy !== 'OFFLINE_FIRST_RUNTIME_NETWORK_DENIED') errors.push('GOOGLE_IMPORT_PRODUCT_RUNTIME_NETWORK_POLICY_INVALID');
  if (policy.externalConnectorUse !== 'DISPOSABLE_SYNTHETIC_TEST_EVIDENCE_ONLY') errors.push('GOOGLE_IMPORT_CONNECTOR_USE_POLICY_INVALID');
}

function validateSpec(spec, errors) {
  if (!isObject(spec)) {
    errors.push('SPEC_NOT_OBJECT');
    return;
  }
  if (spec.schemaVersion !== SPEC_SCHEMA) errors.push('SPEC_SCHEMA_INVALID');
  if (spec.contractId !== CONTRACT_ID) errors.push('CONTRACT_ID_INVALID');
  if (spec.documentClass !== 'CURRENT_TARGET_CONTRACT_NOT_CURRENT_RUNTIME_PASS') errors.push('DOCUMENT_CLASS_INVALID');
  if (spec.status !== 'DENOMINATOR_FROZEN_EVIDENCE_OPEN') errors.push('SPEC_STATUS_INVALID');
  if (!commitSha(spec.bindingBaseSha)) errors.push('SPEC_BASE_SHA_INVALID');
  if (!sameArray(exactIds(spec.fields), FIELD_IDS)) errors.push('FIELD_AXIS_MISMATCH');
  if (!sameArray(exactIds(spec.volumes), VOLUME_IDS)) errors.push('VOLUME_AXIS_MISMATCH');
  if (!sameArray(exactIds(spec.routes), ROUTE_IDS)) errors.push('ROUTE_AXIS_MISMATCH');
  if (!sameArray(exactIds(spec.executionProfiles), EXECUTION_PROFILE_IDS)) errors.push('EXECUTION_PROFILE_AXIS_MISMATCH');
  for (const field of spec.fields || []) {
    if (field.supportClass !== 'REQUIRED_SEMANTIC_PRESERVATION') errors.push(`FIELD_NOT_SUPPORTED:${field.id}`);
    if (field.currentProof !== 'NOT_PROVEN') errors.push(`FIELD_PRECLAIMED:${field.id}`);
  }
  for (const volume of spec.volumes || []) {
    if (volume.id === 'MALFORMED_HOSTILE_INPUT') {
      if (volume.inputClass !== 'INVALID_OR_ADVERSARIAL') errors.push('HOSTILE_VOLUME_CLASS_INVALID');
    } else if (volume.inputClass !== 'VALID_SUPPORTED' || volume.passOutcome !== 'PRESERVED') {
      errors.push(`VALID_VOLUME_POLICY_INVALID:${volume.id}`);
    }
  }
  for (const route of spec.routes || []) {
    if (!Array.isArray(route.hops) || route.hops.length < 3 || !unique(route.hops)) errors.push(`ROUTE_HOPS_INVALID:${route.id}`);
    if (!Array.isArray(route.requiredProviderProfiles) || route.requiredProviderProfiles.length === 0 || !unique(route.requiredProviderProfiles)) {
      errors.push(`ROUTE_PROVIDER_PROFILES_INVALID:${route.id}`);
    }
    if (!Number.isSafeInteger(route.cyclePolicy?.requiredCycles) || route.cyclePolicy.requiredCycles < 1) {
      errors.push(`ROUTE_CYCLE_POLICY_INVALID:${route.id}`);
    }
  }
  const c3 = (spec.routes || []).find((route) => route.id === 'C3');
  if (c3?.cyclePolicy?.kind !== 'FIXED_SATURATION' || c3?.cyclePolicy?.requiredCycles !== 5) {
    errors.push('C3_SATURATION_POLICY_INVALID');
  }
  if (spec.denominator?.kind !== 'CARTESIAN_PRODUCT') errors.push('DENOMINATOR_KIND_INVALID');
  if (!sameArray(spec.denominator?.axisOrder, ['field', 'volume', 'route', 'executionProfile'])) errors.push('DENOMINATOR_AXIS_ORDER_INVALID');
  if (spec.denominator?.expectedRequiredCells !== EXPECTED_REQUIRED_CELLS) errors.push('DECLARED_DENOMINATOR_INVALID');
  if (spec.denominator?.missingCellStatus !== 'NOT_EXECUTED') errors.push('MISSING_CELL_POLICY_INVALID');
  if (spec.passPolicy?.countedStatus !== COUNTED_STATUS) errors.push('COUNTED_STATUS_INVALID');
  if (!sameArray(spec.passPolicy?.nonCountedStatuses, NON_COUNTED_STATUSES)) errors.push('NON_COUNTED_STATUS_SET_INVALID');
  if (spec.passPolicy?.typedRefusalCanPassValidSupportedElement !== false) errors.push('TYPED_REFUSAL_POLICY_INVALID');
  if (spec.passPolicy?.evidenceInheritanceAcrossRoutesProvidersBuildsOrHeads !== false) errors.push('EVIDENCE_INHERITANCE_MUST_BE_DENIED');
  if (spec.passPolicy?.parserOnlySyntheticReplayOrRouteOnlyPassCanCloseCell !== false) errors.push('PARTIAL_EVIDENCE_CLOSURE_MUST_BE_DENIED');
  if (spec.passPolicy?.silentLossAllowed !== false) errors.push('SILENT_LOSS_MUST_BE_DENIED');
  if (!sameArray(spec.passPolicy?.requiredOracleClasses, REQUIRED_ORACLES)) errors.push('REQUIRED_ORACLE_SET_INVALID');
  if (spec.outsideContractPolicy?.silentDropAllowed !== false) errors.push('OUTSIDE_CONTRACT_SILENT_DROP_MUST_BE_DENIED');
  if (spec.outsideContractPolicy?.outsideContractDispositionNeverCountsAsSupportedElementPreservation !== true) {
    errors.push('OUTSIDE_CONTRACT_DISPOSITION_MUST_NOT_COUNT');
  }
  if (spec.securityPolicy?.fixtures !== 'SEEDED_DISPOSABLE_SYNTHETIC_ONLY') errors.push('FIXTURE_POLICY_INVALID');
  if (spec.securityPolicy?.userDocumentsAllowed !== false || spec.securityPolicy?.existingDriveDocumentsAllowed !== false) {
    errors.push('USER_OR_EXISTING_DRIVE_DOCUMENTS_MUST_BE_DENIED');
  }
  if (spec.securityPolicy?.runtimeNetworkAllowed !== false) errors.push('RUNTIME_NETWORK_MUST_BE_DENIED');
  if (spec.securityPolicy?.externalTestConnectorNetworkAllowed !== true) errors.push('EXTERNAL_TEST_CONNECTOR_NETWORK_POLICY_INVALID');
  validateWordPhysicalRuntimePolicy(spec, errors);
  validateProviderTransportPolicy(spec, errors);
  if (!isObject(spec.currentGap)
    || spec.currentGap.requiredCellDenominator !== EXPECTED_REQUIRED_CELLS
    || !Number.isSafeInteger(spec.currentGap.exactHeadPassedNumerator)
    || spec.currentGap.exactHeadPassedNumerator < 0
    || spec.currentGap.exactHeadPassedNumerator > EXPECTED_REQUIRED_CELLS
    || typeof spec.currentGap.percentage !== 'number'
    || spec.currentGap.percentage < 0
    || spec.currentGap.percentage > 100
    || typeof spec.currentGap.code !== 'string'
    || spec.currentGap.code.length === 0
    || typeof spec.currentGap.reason !== 'string'
    || spec.currentGap.reason.length === 0) {
    errors.push('CURRENT_GAP_INVALID');
  }
  const cells = buildRequiredCells(spec);
  if (cells.length !== EXPECTED_REQUIRED_CELLS) errors.push(`EXPANDED_DENOMINATOR_INVALID:${cells.length}`);
  if (!unique(cells.map((cell) => cell.cellId))) errors.push('EXPANDED_CELL_IDS_NOT_UNIQUE');
}

function validateFixture(entry, errors) {
  if (!isObject(entry.fixture)) {
    errors.push(`${entry.cellId}:FIXTURE_REQUIRED`);
    return;
  }
  if (entry.fixture.seeded !== true || entry.fixture.synthetic !== true || entry.fixture.disposable !== true) {
    errors.push(`${entry.cellId}:FIXTURE_NOT_SEEDED_DISPOSABLE_SYNTHETIC`);
  }
  if (entry.fixture.userDocumentOpened !== false || entry.fixture.existingDriveDocumentUsed !== false) {
    errors.push(`${entry.cellId}:USER_OR_EXISTING_DRIVE_DOCUMENT_USED`);
  }
}

function validateOracles(entry, errors) {
  if (!isObject(entry.oracles)) {
    errors.push(`${entry.cellId}:ORACLES_REQUIRED`);
    return;
  }
  for (const oracleId of REQUIRED_ORACLES) {
    const oracle = entry.oracles[oracleId];
    if (!isObject(oracle) || oracle.status !== 'PASS' || !sha256(oracle.artifactSha256)) {
      errors.push(`${entry.cellId}:ORACLE_INVALID:${oracleId}`);
      continue;
    }
    if (oracle.authority === 'SAME_EXECUTION_WRITER' || !oracle.authority) {
      errors.push(`${entry.cellId}:ORACLE_NOT_INDEPENDENT:${oracleId}`);
    }
  }
}

function validateHopEvidence(entry, route, errors) {
  if (!Array.isArray(entry.hopEvidence) || entry.hopEvidence.length !== route.hops.length) {
    errors.push(`${entry.cellId}:HOP_EVIDENCE_DENOMINATOR_MISMATCH`);
    return;
  }
  if (!sameArray(entry.hopEvidence.map((hop) => hop?.hopId), route.hops)) {
    errors.push(`${entry.cellId}:HOP_EVIDENCE_ORDER_MISMATCH`);
  }
  for (const hop of entry.hopEvidence) {
    for (const field of ['sourceArtifactSha256', 'targetArtifactSha256', 'provenanceSha256', 'lossLedgerSha256']) {
      if (!sha256(hop?.[field])) errors.push(`${entry.cellId}:HOP_${field.toUpperCase()}_INVALID:${hop?.hopId || 'UNKNOWN'}`);
    }
    if (hop?.fieldOutcome !== 'PRESERVED') errors.push(`${entry.cellId}:SUPPORTED_FIELD_NOT_PRESERVED:${hop?.hopId || 'UNKNOWN'}`);
    if (hop?.silentDropCount !== 0) errors.push(`${entry.cellId}:SILENT_DROP_NONZERO:${hop?.hopId || 'UNKNOWN'}`);
  }
}

function validateProviderEvidence(entry, route, currentHead, repoRoot, errors) {
  if (!Array.isArray(entry.providerEvidence)) {
    errors.push(`${entry.cellId}:PROVIDER_EVIDENCE_REQUIRED`);
    return;
  }
  const actualProfiles = entry.providerEvidence.map((item) => item?.profileId);
  if (!sameArray(actualProfiles, route.requiredProviderProfiles)) {
    errors.push(`${entry.cellId}:PROVIDER_PROFILE_DENOMINATOR_MISMATCH`);
  }
  for (const item of entry.providerEvidence) {
    validateEvidenceHeadBinding({
      cellId: entry.cellId,
      exactHeadSha: item?.exactHeadSha,
      sourceRevision: entry.sourceRevision,
      currentHead,
      repoRoot,
      context: `PROVIDER_${item?.profileId || 'UNKNOWN'}`,
      errors,
    });
    if (!item?.buildIdentity || !item?.documentIdentity || !item?.revisionIdentity) {
      errors.push(`${entry.cellId}:PROVIDER_IDENTITY_INCOMPLETE:${item?.profileId || 'UNKNOWN'}`);
    }
    if (item?.syntheticOnly !== true || item?.lifecycle !== true || item?.reopen !== true || item?.readback !== true || item?.reexport !== true) {
      errors.push(`${entry.cellId}:PROVIDER_PHYSICAL_LIFECYCLE_INCOMPLETE:${item?.profileId || 'UNKNOWN'}`);
    }
    if (!sha256(item?.artifactSha256)) errors.push(`${entry.cellId}:PROVIDER_ARTIFACT_SHA_INVALID:${item?.profileId || 'UNKNOWN'}`);
    if (item?.cleanupVerified !== true) errors.push(`${entry.cellId}:PROVIDER_CLEANUP_UNVERIFIED:${item?.profileId || 'UNKNOWN'}`);
  }
}

function validateCycles(entry, route, errors) {
  if (!Array.isArray(entry.cycles) || entry.cycles.length !== route.cyclePolicy.requiredCycles) {
    errors.push(`${entry.cellId}:CYCLE_DENOMINATOR_MISMATCH`);
    return;
  }
  const roundIds = entry.cycles.map((cycle) => cycle?.roundId);
  if (!roundIds.every((id) => typeof id === 'string' && id.length > 0) || !unique(roundIds)) {
    errors.push(`${entry.cellId}:ROUND_IDENTITIES_INVALID`);
  }
  for (const cycle of entry.cycles) {
    if (!sha256(cycle?.lossLedgerSha256) || cycle?.semanticPreserved !== true || cycle?.newLossCount !== 0) {
      errors.push(`${entry.cellId}:CYCLE_NOT_LOSSLESS:${cycle?.roundId || 'UNKNOWN'}`);
    }
  }
}

function validateOutsideContract(entry, errors) {
  const ledger = entry.outsideContractLedger;
  if (!isObject(ledger) || !Number.isSafeInteger(ledger.observedCount) || ledger.observedCount < 1 || ledger.silentDropCount !== 0) {
    errors.push(`${entry.cellId}:OUTSIDE_CONTRACT_LEDGER_INVALID`);
    return;
  }
  if (!Array.isArray(ledger.dispositions) || ledger.dispositions.length !== ledger.observedCount) {
    errors.push(`${entry.cellId}:OUTSIDE_CONTRACT_DISPOSITION_DENOMINATOR_MISMATCH`);
    return;
  }
  for (const disposition of ledger.dispositions) {
    if (!ALLOWED_OUTSIDE_DISPOSITIONS.has(disposition)) errors.push(`${entry.cellId}:OUTSIDE_CONTRACT_DISPOSITION_INVALID:${disposition}`);
  }
}

function validatePackagedBuild(entry, currentHead, repoRoot, errors) {
  const proof = entry.packagedBuildEvidence;
  if (!isObject(proof)) {
    errors.push(`${entry.cellId}:PACKAGED_BUILD_EVIDENCE_REQUIRED`);
    return;
  }
  validateEvidenceHeadBinding({
    cellId: entry.cellId,
    exactHeadSha: proof.exactHeadSha,
    sourceRevision: entry.sourceRevision,
    currentHead,
    repoRoot,
    context: 'PACKAGED_BUILD',
    errors,
  });
  if (!sha256(proof.packageSha256) || !proof.buildIdentity) {
    errors.push(`${entry.cellId}:PACKAGED_BUILD_IDENTITY_INVALID`);
  }
  if (proof.installed !== true || proof.executed !== true || proof.reopen !== true || proof.readback !== true) {
    errors.push(`${entry.cellId}:PACKAGED_BUILD_LIFECYCLE_INCOMPLETE`);
  }
}

function validateRouteQualificationEvidence(ledger, bindingBaseSha, errors) {
  if (!Array.isArray(ledger.routeQualificationEvidence)) {
    errors.push('ROUTE_QUALIFICATION_EVIDENCE_REQUIRED');
    return;
  }
  for (const evidence of ledger.routeQualificationEvidence) {
    if (!isObject(evidence)) {
      errors.push('ROUTE_QUALIFICATION_EVIDENCE_NOT_OBJECT');
      continue;
    }
    if (evidence.status !== ROUTE_QUALIFICATION_STATUS) errors.push(`${evidence.id || 'UNKNOWN'}:ROUTE_QUALIFICATION_STATUS_INVALID`);
    if (evidence.countedAsRequiredCellPass !== false) errors.push(`${evidence.id || 'UNKNOWN'}:ROUTE_QUALIFICATION_MUST_NOT_COUNT`);
    if (evidence.exactHeadSha !== bindingBaseSha) errors.push(`${evidence.id || 'UNKNOWN'}:ROUTE_QUALIFICATION_BINDING_HEAD_MISMATCH`);
    if (typeof evidence.seed !== 'string' || evidence.seed.length === 0) errors.push(`${evidence.id || 'UNKNOWN'}:ROUTE_QUALIFICATION_SEED_INVALID`);

    const fixture = evidence.fixture;
    if (!isObject(fixture)
      || fixture.synthetic !== true
      || fixture.disposable !== true
      || fixture.userDocumentOpened !== false
      || fixture.existingDriveDocumentUsed !== false
      || fixture.wordRootPolicyObserved !== true
      || typeof fixture.wordRunSubdirectoryName !== 'string'
      || fixture.wordRunSubdirectoryName.length === 0) {
      errors.push(`${evidence.id || 'UNKNOWN'}:ROUTE_QUALIFICATION_FIXTURE_INVALID`);
    }

    const localArtifacts = evidence.localArtifacts;
    if (!isObject(localArtifacts)
      || !sha256(localArtifacts.sourceDocxSha256)
      || !sha256(localArtifacts.sanitizedDocxSha256)
      || localArtifacts.sourceUnderWordSandboxRoot !== true
      || localArtifacts.sanitizedUnderWordSandboxRoot !== true) {
      errors.push(`${evidence.id || 'UNKNOWN'}:ROUTE_QUALIFICATION_LOCAL_ARTIFACTS_INVALID`);
    }

    const negative = evidence.directLocalPathImportNegative;
    if (!isObject(negative)
      || negative.attempted !== true
      || negative.status !== 'BLOCKED'
      || negative.errorCode !== 'INVALID_ARGUMENT'
      || negative.reason !== 'INVALID_PARAMETERS'
      || negative.parameterPath !== 'source_file.mime_type'
      || negative.typedBlocker !== GOOGLE_DOCX_IMPORT_TYPED_BLOCKER
      || negative.countsAsPass !== false) {
      errors.push(`${evidence.id || 'UNKNOWN'}:DIRECT_LOCAL_PATH_NEGATIVE_INVALID`);
    }

    const supportedRoute = evidence.supportedRoute;
    if (!isObject(supportedRoute)
      || !sameArray(supportedRoute.requiredSteps, GOOGLE_DOCX_IMPORT_TRANSPORT_STEPS)
      || typeof supportedRoute.rawUploadedFileId !== 'string'
      || supportedRoute.rawUploadedFileId.length === 0
      || supportedRoute.internalUploadedFileReferenceObserved !== true
      || supportedRoute.internalReferenceMimeType !== GOOGLE_DOCX_MIME_TYPE
      || !positiveInteger(supportedRoute.internalReferenceSizeBytes)
      || typeof supportedRoute.nativeImportedDocumentId !== 'string'
      || supportedRoute.nativeImportedDocumentId.length === 0
      || supportedRoute.nativeImportConverted !== true
      || supportedRoute.nativeReadbackMarkerObserved !== true
      || !positiveInteger(supportedRoute.nativeExportDocxSizeBytes)) {
      errors.push(`${evidence.id || 'UNKNOWN'}:SUPPORTED_GOOGLE_IMPORT_ROUTE_INVALID`);
    }

    const cleanup = evidence.cleanup;
    if (!isObject(cleanup)
      || cleanup.createdGoogleFilesDeleted !== true
      || !Array.isArray(cleanup.createdGoogleFileIds)
      || cleanup.createdGoogleFileIds.length !== 2
      || !cleanup.createdGoogleFileIds.every((id) => typeof id === 'string' && id.length > 0)
      || cleanup.localRunSubdirectoryRemoved !== true
      || cleanup.persistentWordRootPreserved !== true) {
      errors.push(`${evidence.id || 'UNKNOWN'}:ROUTE_QUALIFICATION_CLEANUP_INVALID`);
    }
  }
}

function validatePassEntry(entry, cell, spec, currentHead, repoRoot, errors) {
  const route = spec.routes.find((item) => item.id === cell.routeId);
  const hostile = cell.volumeId === 'MALFORMED_HOSTILE_INPUT';
  if (entry.evidenceClass !== 'CELL_EXECUTION_EXACT_HEAD') errors.push(`${entry.cellId}:EVIDENCE_CLASS_INVALID`);
  validateEvidenceHeadBinding({
    cellId: entry.cellId,
    exactHeadSha: entry.exactHeadSha,
    sourceRevision: entry.sourceRevision,
    currentHead,
    repoRoot,
    context: 'CELL_EXECUTION',
    errors,
  });
  if (entry.sourceRevision !== entry.exactHeadSha) errors.push(`${entry.cellId}:SOURCE_REVISION_HEAD_MISMATCH`);
  if (!sha256(entry.artifactSha256)) errors.push(`${entry.cellId}:ARTIFACT_SHA_INVALID`);
  if (!entry.sourceRevision || !entry.targetRevision || !entry.generationId) errors.push(`${entry.cellId}:REVISION_GENERATION_IDENTITY_INCOMPLETE`);
  validateFixture(entry, errors);
  validateOracles(entry, errors);
  validateHopEvidence(entry, route, errors);
  validateProviderEvidence(entry, route, currentHead, repoRoot, errors);
  validateCycles(entry, route, errors);
  validateOutsideContract(entry, errors);
  if (cell.executionProfileId === 'PACKAGED_BUILD_RUNTIME') validatePackagedBuild(entry, currentHead, repoRoot, errors);

  if (!hostile) {
    if (entry.outcome !== 'PRESERVED') errors.push(`${entry.cellId}:VALID_SUPPORTED_OUTCOME_NOT_PRESERVED`);
    if (entry.typedResult === true) errors.push(`${entry.cellId}:TYPED_REFUSAL_CANNOT_PASS_SUPPORTED_ELEMENT`);
  } else {
    const classification = entry.inputClassification;
    if (!isObject(classification) || classification.independent !== true || classification.verdict !== 'INVALID' || !sha256(classification.artifactSha256)) {
      errors.push(`${entry.cellId}:HOSTILE_INPUT_NOT_INDEPENDENTLY_CLASSIFIED_INVALID`);
    }
    if (entry.outcome === 'REJECTED_INVALID_NO_MUTATION') {
      if (entry.typedResult !== true || entry.mutationCount !== 0) errors.push(`${entry.cellId}:HOSTILE_REJECTION_NOT_TYPED_ZERO_MUTATION`);
    } else if (entry.outcome !== 'PRESERVED' || entry.typedResult === true) {
      errors.push(`${entry.cellId}:HOSTILE_OUTCOME_INVALID`);
    }
  }
}

export function validateInterop100({ spec, ledger, currentHead, repoRoot = repoRootFromHere() }) {
  const errors = [];
  validateSpec(spec, errors);
  if (!commitSha(currentHead)) errors.push('CURRENT_HEAD_INVALID');
  if (!isObject(ledger)) {
    errors.push('LEDGER_NOT_OBJECT');
    return { ok: false, errors, requiredCells: 0, passedRequiredCells: 0, percentage: 0, claimVerdict: 'FAIL_INVALID_LEDGER' };
  }
  if (ledger.schemaVersion !== LEDGER_SCHEMA) errors.push('LEDGER_SCHEMA_INVALID');
  if (ledger.contractId !== CONTRACT_ID) errors.push('LEDGER_CONTRACT_ID_INVALID');
  if (!commitSha(ledger.bindingBaseSha)) errors.push('LEDGER_BASE_SHA_INVALID');
  if (spec?.bindingBaseSha !== ledger.bindingBaseSha) errors.push('SPEC_LEDGER_BASE_SHA_MISMATCH');
  if (!Array.isArray(ledger.entries)) errors.push('LEDGER_ENTRIES_NOT_ARRAY');
  validateRouteQualificationEvidence(ledger, ledger.bindingBaseSha, errors);

  const cells = buildRequiredCells(spec || {});
  const cellById = new Map(cells.map((cell) => [cell.cellId, cell]));
  const entries = Array.isArray(ledger.entries) ? ledger.entries : [];
  const entryIds = entries.map((entry) => entry?.cellId);
  if (!unique(entryIds)) errors.push('LEDGER_DUPLICATE_CELL_ID');
  let passedRequiredCells = 0;
  const statusCounts = Object.fromEntries([COUNTED_STATUS, ...NON_COUNTED_STATUSES].map((status) => [status, 0]));

  for (const entry of entries) {
    if (!isObject(entry) || !cellById.has(entry.cellId)) {
      errors.push(`LEDGER_UNKNOWN_CELL_ID:${entry?.cellId || 'UNKNOWN'}`);
      continue;
    }
    if (!ALLOWED_STATUSES.has(entry.status)) {
      errors.push(`${entry.cellId}:STATUS_INVALID`);
      continue;
    }
    statusCounts[entry.status] += 1;
    if (entry.status === COUNTED_STATUS) {
      const before = errors.length;
      validatePassEntry(entry, cellById.get(entry.cellId), spec, currentHead, repoRoot, errors);
      if (errors.length === before) passedRequiredCells += 1;
    }
  }

  const unrecorded = Math.max(0, cells.length - entries.length);
  statusCounts.NOT_EXECUTED += unrecorded;
  const percentage = cells.length === 0 ? 0 : Number(((passedRequiredCells / cells.length) * 100).toFixed(6));
  const declared = ledger.declaredRollup;
  if (!isObject(declared)
    || declared.requiredCells !== cells.length
    || declared.passedRequiredCells !== passedRequiredCells
    || declared.notExecutedCells !== statusCounts.NOT_EXECUTED
    || declared.percentage !== percentage
    || declared.broadPassClaim !== (passedRequiredCells === cells.length && cells.length > 0)) {
    errors.push('DECLARED_ROLLUP_MISMATCH');
  }
  if (!isObject(spec.currentGap)
    || spec.currentGap.requiredCellDenominator !== cells.length
    || spec.currentGap.exactHeadPassedNumerator !== passedRequiredCells
    || spec.currentGap.percentage !== percentage) {
    errors.push('CURRENT_GAP_ROLLUP_MISMATCH');
  }
  return {
    ok: errors.length === 0,
    errors,
    contractId: spec?.contractId || null,
    currentHead,
    requiredCells: cells.length,
    recordedCells: entries.length,
    passedRequiredCells,
    percentage,
    statusCounts,
    claimVerdict: passedRequiredCells === cells.length && cells.length === EXPECTED_REQUIRED_CELLS && errors.length === 0
      ? 'PASS_100_PERCENT_SUPPORTED_CONTRACT'
      : 'NEEDS_MORE_EVIDENCE',
  };
}

export function verifyInterop100(repoRoot = repoRootFromHere(), options = {}) {
  const spec = options.spec || readInterop100Denominator(repoRoot);
  const ledger = options.ledger || readInterop100EvidenceLedger(repoRoot);
  const currentHead = options.currentHead || currentGitHead(repoRoot);
  return validateInterop100({ spec, ledger, currentHead, repoRoot });
}

function main() {
  const report = verifyInterop100();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) process.exitCode = 1;
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) main();
