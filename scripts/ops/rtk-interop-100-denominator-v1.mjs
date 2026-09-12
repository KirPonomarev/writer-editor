#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const DENOMINATOR_PATH = 'docs/OPS/RTK/YALKEN_INTEROP_100_DENOMINATOR_V1.json';
export const EVIDENCE_ENVELOPE_PATH = 'docs/OPS/RTK/YALKEN_INTEROP_100_EVIDENCE_ENVELOPE_V1.json';
export const LEDGER_PATH = 'docs/OPS/RTK/YALKEN_INTEROP_100_EVIDENCE_LEDGER_V1.json';
export const GOVERNANCE_APPROVALS_PATH = 'docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json';
export const C1B_INVENTORY_PATH = 'docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json';
export const CONTRACT_BASENAME = 'rtk-interop-100-denominator.contract.test.js';
export const CONTRACT_ID = 'YALKEN_INTEROP_100_SUPPORTED_CONTRACT_V1';
export const SPEC_SCHEMA = 'yalken.interop100.denominator.v1';
export const EVIDENCE_ENVELOPE_SCHEMA = 'yalken.interop100.evidenceEnvelope.v1';
export const LEDGER_SCHEMA = 'yalken.interop100.evidenceLedger.v1';
export const CELL_EVIDENCE_PROMOTION_METADATA_PATHS = Object.freeze([
  C1B_INVENTORY_PATH,
  DENOMINATOR_PATH,
  EVIDENCE_ENVELOPE_PATH,
  LEDGER_PATH,
  GOVERNANCE_APPROVALS_PATH,
  'scripts/ops/rtk-interop-100-denominator-v1.mjs',
  'test/contracts/r24-post-audit-certification-set.contract.test.mjs',
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
const SEMVER_RE = /^v?[0-9]+(?:\.[0-9]+){2}(?:[-+][0-9A-Za-z.-]+)?$/u;
const SAFE_BASENAME_RE = /^[A-Za-z0-9._-]+$/u;
const WORD_DESKTOP_BUILD_IDENTITY_RE = /^Microsoft Word [0-9]+(?:\.[0-9]+)* com\.microsoft\.Word [A-Z0-9]+$/u;
const ALLOWED_OUTSIDE_DISPOSITIONS = new Set(['OPAQUE_PRESERVED', 'EXPLICIT_LOSS', 'MANUAL', 'UNSUPPORTED']);
const ALLOWED_STATUSES = new Set([COUNTED_STATUS, ...NON_COUNTED_STATUSES]);
const ORACLE_ALLOWED_AUTHORITIES = Object.freeze({
  SEMANTIC: 'RAW_AND_NORMALIZED_FULL_CANDIDATE_TEXT_AND_CODEPOINT_EQUALITY',
  STRUCTURE: 'INDEPENDENT_OOXML_PARAGRAPH_VECTOR_EQUALITY_SOURCE_SAVED_REOPENED',
  ORDER: 'RAW_FULL_PARAGRAPH_VECTOR_AND_CODEPOINT_EQUALITY_WITH_ORDER_MUTANT_REJECTION',
  LOSS: 'EXPLICIT_LOSS_REPORT_NON_SILENT',
  PROVENANCE: 'RUN_RECEIPT_HASH_CHAIN',
  INDEPENDENT_READBACK: 'INDEPENDENT_ZIP_CRC_OOXML_RAW_TEXT_AND_CODEPOINT_READBACK',
  CLEANUP: 'WORD_DOCUMENT_COUNT_AFTER_RUN',
});
const PASS_ENTRY_KEYS = Object.freeze([
  'artifactSha256',
  'cellId',
  'cycles',
  'evidenceClass',
  'evidenceReceipt',
  'exactHeadSha',
  'fixture',
  'generationId',
  'hopEvidence',
  'oracles',
  'outcome',
  'outsideContractLedger',
  'providerEvidence',
  'sourceRevision',
  'sourceTree',
  'status',
  'targetRevision',
  'typedResult',
]);
const EVIDENCE_RECEIPT_KEYS = Object.freeze([
  'broadPassClaim',
  'checkpointBasename',
  'independentAuditSha256',
  'independentAuditorSha256',
  'limitations',
  'nodeVersion',
  'npmVersion',
  'numeratorDelta',
  'receiptSha256',
  'runId',
  'runnerSha256',
  'schemaVersion',
  'sealSha256',
  'status',
  'wordRootKind',
]);
const ROOT_DURABLE_PACKAGE_AUDIT_SCHEMA = 'yalken.interop100.rootDurableCell001PackageAudit.v1';
const ROOT_DURABLE_PACKAGE_AUDIT_CLAIM_BOUNDARY = 'Preserves the physical and independent evidence basis for existing Cell001 only; numerator stays 1/1120.';
const ROOT_DURABLE_PACKAGE_AUDIT_KEYS = Object.freeze([
  'checks',
  'checksFailed',
  'checksPassed',
  'claimBoundary',
  'errors',
  'manifestSha256',
  'schemaVersion',
  'status',
  'verifierSha256',
]);
const ROOT_DURABLE_PACKAGE_AUDIT_CHECK_KEYS = Object.freeze(['actual', 'expected', 'name', 'pass']);
const ROOT_DURABLE_PACKAGE_MUTATION_AUDIT_SCHEMA = 'yalken.interop100.rootDurableCell001PackageMutationAudit.v1';
const ROOT_DURABLE_PACKAGE_MUTATION_AUDIT_CLAIM_BOUNDARY = 'Mutants cover the durable Cell001 snapshot verifier only; they do not increase the portability numerator.';
const ROOT_DURABLE_PACKAGE_MUTATION_AUDIT_KEYS = Object.freeze([
  'claimBoundary',
  'killedCount',
  'mutantCount',
  'rows',
  'schemaVersion',
  'status',
  'survivors',
]);
const ROOT_DURABLE_PACKAGE_MUTATION_AUDIT_ROW_KEYS = Object.freeze([
  'exitCode',
  'id',
  'killed',
  'stderrTail',
  'stdoutTail',
]);
const ROOT_DURABLE_PACKAGE_MUTATION_IDS = Object.freeze([
  'docx-byte-manifest-unchanged',
  'docx-byte-manifest-coherently-updated',
  'generation-ledger-manifest-coherently-updated',
  'receipt-seal-ledger-manifest-coherently-updated',
  'root-audit-manifest-coherently-updated',
  'manifested-file-replaced-by-symlink',
]);
const CELL001_EXTERNAL_PACKAGE_TRUST = Object.freeze({
  cellId: 'TEXT__SINGLE_SCENE__C1__SOURCE_RUNTIME',
  packageId: 'cell001-source-package-v1',
  manifestSha256: 'sha256:ff3a612c1c87cf51a107019aa8e71709160214b047f14e3c85bc5cc1d2f7a62a',
  verifierSha256: 'sha256:1ba6ecf6c0ecc95148dd73aec15afba983c1420b237e5591461a3657ddef079d',
  reportSha256: 'sha256:0dd5b424590aeaced185ddcf3ebf9f063b26076bc3289116296c0e379bd24054',
  mutationAuditorSha256: 'sha256:1ac983f44987c28569efc7205d2980dbfcabff397ea02d9fa34284a773f34ba6',
  mutationReportSha256: 'sha256:79eb7e2a1592e6bb2f76193014aa20e869d51277e5ddaddba6da48734a6215e8',
});

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

function stableJsonValue(value) {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (isObject(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJsonValue(value[key])]));
  }
  return value;
}

function stableJsonString(value) {
  return JSON.stringify(stableJsonValue(value));
}

function unique(values) {
  return new Set(values).size === values.length;
}

function sameKeySet(value, expectedKeys) {
  return isObject(value) && sameArray(Object.keys(value).sort(), [...expectedKeys].sort());
}

function sha256(value) {
  return typeof value === 'string' && SHA256_RE.test(value);
}

function normalizedSha256(value) {
  if (!sha256(value)) return '';
  return String(value).replace(/^sha256:/u, '').toLowerCase();
}

function sameSha256(left, right) {
  const normalizedLeft = normalizedSha256(left);
  const normalizedRight = normalizedSha256(right);
  return Boolean(normalizedLeft) && normalizedLeft === normalizedRight;
}

function commitSha(value) {
  return typeof value === 'string' && COMMIT_RE.test(value);
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function safeBasename(value) {
  return typeof value === 'string'
    && value.length > 0
    && value === path.basename(value)
    && SAFE_BASENAME_RE.test(value);
}

function sha256File(filePath) {
  const data = fs.readFileSync(filePath);
  return `sha256:${cryptoHash(data)}`;
}

function sha256StableJson(value) {
  return `sha256:${cryptoHash(stableJsonString(value))}`;
}

function cryptoHash(data) {
  return createHash('sha256').update(data).digest('hex');
}

function currentGitHead(repoRoot) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' });
  if (result.status !== 0) return '';
  return String(result.stdout || '').trim();
}

function gitTreeSha(repoRoot, commit) {
  if (!commitSha(commit)) return '';
  const result = spawnSync('git', ['rev-parse', `${commit}^{tree}`], { cwd: repoRoot, encoding: 'utf8' });
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

export function readInterop100EvidenceEnvelope(repoRoot = repoRootFromHere()) {
  return readJson(repoRoot, EVIDENCE_ENVELOPE_PATH);
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

function buildEvidenceEnvelopeEntryMap(envelope, spec, ledger, errors) {
  const empty = new Map();
  if (!isObject(envelope)) {
    errors.push('EVIDENCE_ENVELOPE_REQUIRED');
    return empty;
  }
  if (envelope.schemaVersion !== EVIDENCE_ENVELOPE_SCHEMA) errors.push('EVIDENCE_ENVELOPE_SCHEMA_INVALID');
  if (envelope.contractId !== CONTRACT_ID) errors.push('EVIDENCE_ENVELOPE_CONTRACT_ID_INVALID');
  if (spec?.bindingBaseSha !== envelope.bindingBaseSha) errors.push('SPEC_ENVELOPE_BASE_SHA_MISMATCH');
  if (ledger?.bindingBaseSha !== envelope.bindingBaseSha) errors.push('LEDGER_ENVELOPE_BASE_SHA_MISMATCH');
  if (!Array.isArray(envelope.entries)) {
    errors.push('EVIDENCE_ENVELOPE_ENTRIES_NOT_ARRAY');
    return empty;
  }
  const envelopeByCellId = new Map();
  for (const envelopeEntry of envelope.entries) {
    if (!isObject(envelopeEntry) || typeof envelopeEntry.cellId !== 'string' || envelopeEntry.cellId.length === 0) {
      errors.push('EVIDENCE_ENVELOPE_ENTRY_INVALID');
      continue;
    }
    if (envelopeByCellId.has(envelopeEntry.cellId)) {
      errors.push(`EVIDENCE_ENVELOPE_DUPLICATE_CELL_ID:${envelopeEntry.cellId}`);
      continue;
    }
    envelopeByCellId.set(envelopeEntry.cellId, envelopeEntry);
  }
  return envelopeByCellId;
}

function compareShaField(entry, envelopeEntry, fieldName, errors) {
  if (!sameSha256(entry?.[fieldName], envelopeEntry?.[fieldName])) {
    errors.push(`${entry.cellId}:EVIDENCE_ENVELOPE_${fieldName.toUpperCase()}_MISMATCH`);
  }
}

function compareStringField(entry, envelopeEntry, fieldName, errors) {
  if (entry?.[fieldName] !== envelopeEntry?.[fieldName]) {
    errors.push(`${entry.cellId}:EVIDENCE_ENVELOPE_${fieldName.toUpperCase()}_MISMATCH`);
  }
}

function compareReceiptField(entry, envelopeEntry, fieldName, errors) {
  const actual = entry?.evidenceReceipt?.[fieldName];
  const expected = envelopeEntry?.evidenceReceipt?.[fieldName];
  const matches = sha256(actual) || sha256(expected)
    ? sameSha256(actual, expected)
    : JSON.stringify(actual) === JSON.stringify(expected);
  if (!matches) errors.push(`${entry.cellId}:EVIDENCE_RECEIPT_${fieldName.toUpperCase()}_MISMATCH`);
}

function validateEvidenceReceiptBinding(entry, envelopeEntry, errors) {
  const receipt = entry.evidenceReceipt;
  if (!isObject(receipt)) {
    errors.push(`${entry.cellId}:EVIDENCE_RECEIPT_REQUIRED`);
    return;
  }
  if (!sameKeySet(receipt, EVIDENCE_RECEIPT_KEYS)) {
    errors.push(`${entry.cellId}:EVIDENCE_RECEIPT_SCHEMA_CLOSED_SET_MISMATCH`);
  }
  const envelopeReceipt = envelopeEntry?.evidenceReceipt;
  if (!isObject(envelopeReceipt)) {
    errors.push(`${entry.cellId}:EVIDENCE_ENVELOPE_RECEIPT_REQUIRED`);
    return;
  }
  if (!sameKeySet(envelopeReceipt, EVIDENCE_RECEIPT_KEYS)) {
    errors.push(`${entry.cellId}:EVIDENCE_ENVELOPE_RECEIPT_SCHEMA_CLOSED_SET_MISMATCH`);
  }
  const requiredStringFields = ['schemaVersion', 'status', 'runId', 'nodeVersion', 'npmVersion', 'checkpointBasename', 'wordRootKind'];
  for (const fieldName of requiredStringFields) {
    if (typeof receipt[fieldName] !== 'string' || receipt[fieldName].length === 0) {
      errors.push(`${entry.cellId}:EVIDENCE_RECEIPT_${fieldName.toUpperCase()}_INVALID`);
    }
  }
  for (const fieldName of ['receiptSha256', 'sealSha256', 'runnerSha256', 'independentAuditSha256', 'independentAuditorSha256']) {
    if (!sha256(receipt[fieldName])) errors.push(`${entry.cellId}:EVIDENCE_RECEIPT_${fieldName.toUpperCase()}_INVALID`);
  }
  if (!SEMVER_RE.test(receipt.nodeVersion || '')) errors.push(`${entry.cellId}:EVIDENCE_RECEIPT_NODE_VERSION_INVALID`);
  if (!SEMVER_RE.test(receipt.npmVersion || '')) errors.push(`${entry.cellId}:EVIDENCE_RECEIPT_NPM_VERSION_INVALID`);
  if (!safeBasename(receipt.checkpointBasename)) errors.push(`${entry.cellId}:EVIDENCE_RECEIPT_CHECKPOINT_BASENAME_INVALID`);
  if (receipt.runId !== entry.generationId) errors.push(`${entry.cellId}:EVIDENCE_RECEIPT_RUN_ID_MISMATCH`);
  if (!sameSha256(receipt.receiptSha256, entry.artifactSha256)) errors.push(`${entry.cellId}:EVIDENCE_RECEIPT_HASH_MISMATCH`);
  if (receipt.numeratorDelta !== 0) errors.push(`${entry.cellId}:EVIDENCE_RECEIPT_NUMERATOR_DELTA_INVALID`);
  if (receipt.broadPassClaim !== false) errors.push(`${entry.cellId}:EVIDENCE_RECEIPT_BROAD_PASS_CLAIM_INVALID`);
  if (!Array.isArray(receipt.limitations) || receipt.limitations.length === 0) {
    errors.push(`${entry.cellId}:EVIDENCE_RECEIPT_LIMITATIONS_REQUIRED`);
  }
  for (const fieldName of ['schemaVersion', 'status', 'runId', 'nodeVersion', 'npmVersion', 'receiptSha256', 'sealSha256', 'checkpointBasename', 'runnerSha256', 'independentAuditSha256', 'independentAuditorSha256', 'wordRootKind', 'numeratorDelta', 'broadPassClaim', 'limitations']) {
    compareReceiptField(entry, envelopeEntry, fieldName, errors);
  }
}

function validateOracleAuthorityBinding(entry, envelopeEntry, errors) {
  if (!isObject(envelopeEntry?.oracles)) {
    errors.push(`${entry.cellId}:EVIDENCE_ENVELOPE_ORACLES_REQUIRED`);
    return;
  }
  for (const oracleId of REQUIRED_ORACLES) {
    const oracle = entry.oracles?.[oracleId];
    const envelopeOracle = envelopeEntry.oracles?.[oracleId];
    const allowedAuthority = ORACLE_ALLOWED_AUTHORITIES[oracleId];
    if (oracle?.authority !== allowedAuthority) {
      errors.push(`${entry.cellId}:ORACLE_AUTHORITY_UNBOUND:${oracleId}`);
    }
    if (!isObject(envelopeOracle)) {
      errors.push(`${entry.cellId}:EVIDENCE_ENVELOPE_ORACLE_REQUIRED:${oracleId}`);
      continue;
    }
    if (!sameSha256(oracle?.artifactSha256, envelopeOracle.artifactSha256)) {
      errors.push(`${entry.cellId}:EVIDENCE_ENVELOPE_ORACLE_HASH_MISMATCH:${oracleId}`);
    }
    if (oracle?.authority !== envelopeOracle.authority) {
      errors.push(`${entry.cellId}:EVIDENCE_ENVELOPE_ORACLE_AUTHORITY_MISMATCH:${oracleId}`);
    }
  }
}

function validateHopGraphBinding(entry, route, envelopeEntry, errors) {
  if (!Array.isArray(envelopeEntry?.hopEvidence) || envelopeEntry.hopEvidence.length !== route.hops.length) {
    errors.push(`${entry.cellId}:EVIDENCE_ENVELOPE_HOP_GRAPH_REQUIRED`);
    return;
  }
  const lossSha = entry.oracles?.LOSS?.artifactSha256;
  const provenanceSha = entry.oracles?.PROVENANCE?.artifactSha256;
  const hopTargets = [];
  const hopSources = [];
  for (let index = 0; index < route.hops.length; index += 1) {
    const hop = entry.hopEvidence[index];
    const envelopeHop = envelopeEntry.hopEvidence[index];
    if (hop?.hopId !== envelopeHop?.hopId || hop?.hopId !== route.hops[index]) {
      errors.push(`${entry.cellId}:EVIDENCE_ENVELOPE_HOP_ID_MISMATCH:${hop?.hopId || 'UNKNOWN'}`);
      continue;
    }
    for (const fieldName of ['sourceArtifactSha256', 'targetArtifactSha256', 'provenanceSha256', 'lossLedgerSha256']) {
      if (!sameSha256(hop?.[fieldName], envelopeHop?.[fieldName])) {
        errors.push(`${entry.cellId}:EVIDENCE_ENVELOPE_HOP_${fieldName.toUpperCase()}_MISMATCH:${hop?.hopId || 'UNKNOWN'}`);
      }
    }
    if (!sameSha256(hop?.lossLedgerSha256, lossSha)) errors.push(`${entry.cellId}:HOP_LOSS_LEDGER_ORACLE_MISMATCH:${hop?.hopId || 'UNKNOWN'}`);
    if (!sameSha256(hop?.provenanceSha256, provenanceSha)) errors.push(`${entry.cellId}:HOP_PROVENANCE_ORACLE_MISMATCH:${hop?.hopId || 'UNKNOWN'}`);
    hopSources.push(hop?.sourceArtifactSha256);
    hopTargets.push(hop?.targetArtifactSha256);
  }
  for (let index = 0; index < hopTargets.length - 1; index += 1) {
    if (!sameSha256(hopTargets[index], hopSources[index + 1])) {
      errors.push(`${entry.cellId}:HOP_ARTIFACT_CHAIN_BROKEN:${route.hops[index]}_TO_${route.hops[index + 1]}`);
    }
  }
  if (hopTargets.length > 0 && !sameSha256(hopTargets[hopTargets.length - 1], hopSources[0])) {
    errors.push(`${entry.cellId}:HOP_ARTIFACT_ROUNDTRIP_NOT_CLOSED`);
  }
  if (!hopTargets.some((targetSha) => sameSha256(targetSha, entry.targetRevision))) {
    errors.push(`${entry.cellId}:TARGET_REVISION_NOT_IN_HOP_GRAPH`);
  }
}

function validateProviderGraphBinding(entry, route, envelopeEntry, errors) {
  if (!Array.isArray(envelopeEntry?.providerEvidence)) {
    errors.push(`${entry.cellId}:EVIDENCE_ENVELOPE_PROVIDER_GRAPH_REQUIRED`);
    return;
  }
  const envelopeByProfile = new Map(envelopeEntry.providerEvidence.map((item) => [item?.profileId, item]));
  for (const item of entry.providerEvidence || []) {
    const profileId = item?.profileId || 'UNKNOWN';
    const envelopeProvider = envelopeByProfile.get(profileId);
    if (!isObject(envelopeProvider)) {
      errors.push(`${entry.cellId}:EVIDENCE_ENVELOPE_PROVIDER_REQUIRED:${profileId}`);
      continue;
    }
    if (!route.requiredProviderProfiles.includes(profileId)) {
      errors.push(`${entry.cellId}:PROVIDER_PROFILE_UNEXPECTED:${profileId}`);
    }
    if (profileId === 'WORD_DESKTOP' && !WORD_DESKTOP_BUILD_IDENTITY_RE.test(item.buildIdentity || '')) {
      errors.push(`${entry.cellId}:PROVIDER_WORD_BUILD_IDENTITY_INVALID:${profileId}`);
    }
    for (const fieldName of ['exactHeadSha', 'buildIdentity', 'documentIdentity']) {
      if (item?.[fieldName] !== envelopeProvider?.[fieldName]) {
        errors.push(`${entry.cellId}:EVIDENCE_ENVELOPE_PROVIDER_${fieldName.toUpperCase()}_MISMATCH:${profileId}`);
      }
    }
    for (const fieldName of ['revisionIdentity', 'artifactSha256']) {
      if (!sameSha256(item?.[fieldName], envelopeProvider?.[fieldName])) {
        errors.push(`${entry.cellId}:EVIDENCE_ENVELOPE_PROVIDER_${fieldName.toUpperCase()}_MISMATCH:${profileId}`);
      }
    }
    if (item?.documentIdentity !== entry.generationId) errors.push(`${entry.cellId}:PROVIDER_DOCUMENT_GENERATION_MISMATCH:${profileId}`);
    if (!sameSha256(item?.revisionIdentity, item?.artifactSha256)) errors.push(`${entry.cellId}:PROVIDER_REVISION_ARTIFACT_MISMATCH:${profileId}`);
    if (!sameSha256(item?.revisionIdentity, entry.targetRevision)) errors.push(`${entry.cellId}:PROVIDER_REVISION_TARGET_MISMATCH:${profileId}`);
  }
}

function validateCycleGraphBinding(entry, envelopeEntry, errors) {
  if (!Array.isArray(envelopeEntry?.cycles) || !Array.isArray(entry.cycles)) {
    errors.push(`${entry.cellId}:EVIDENCE_ENVELOPE_CYCLES_REQUIRED`);
    return;
  }
  const lossSha = entry.oracles?.LOSS?.artifactSha256;
  for (let index = 0; index < entry.cycles.length; index += 1) {
    const cycle = entry.cycles[index];
    const envelopeCycle = envelopeEntry.cycles[index];
    const expectedRoundId = `round-${String(index + 1).padStart(3, '0')}`;
    if (cycle?.roundId !== expectedRoundId) errors.push(`${entry.cellId}:CYCLE_ROUND_ID_INVALID:${cycle?.roundId || 'UNKNOWN'}`);
    if (cycle?.roundId !== envelopeCycle?.roundId) errors.push(`${entry.cellId}:EVIDENCE_ENVELOPE_CYCLE_ROUND_ID_MISMATCH:${cycle?.roundId || 'UNKNOWN'}`);
    if (!sameSha256(cycle?.lossLedgerSha256, envelopeCycle?.lossLedgerSha256)) {
      errors.push(`${entry.cellId}:EVIDENCE_ENVELOPE_CYCLE_LOSS_LEDGER_MISMATCH:${cycle?.roundId || 'UNKNOWN'}`);
    }
    if (!sameSha256(cycle?.lossLedgerSha256, lossSha)) errors.push(`${entry.cellId}:CYCLE_LOSS_LEDGER_ORACLE_MISMATCH:${cycle?.roundId || 'UNKNOWN'}`);
  }
}

function validateSourceTreeBinding(entry, repoRoot, errors) {
  if (!commitSha(entry.sourceTree)) {
    errors.push(`${entry.cellId}:SOURCE_TREE_INVALID`);
    return;
  }
  const actualTreeSha = gitTreeSha(repoRoot, entry.sourceRevision);
  if (!actualTreeSha || entry.sourceTree !== actualTreeSha) {
    errors.push(`${entry.cellId}:SOURCE_TREE_BINDING_INVALID`);
  }
}

function validatePhysicalPackageRehydration(entry, envelopeEntry, errors) {
  const physicalPackage = envelopeEntry?.physicalPackage;
  if (!isObject(physicalPackage)) {
    errors.push(`${entry.cellId}:PHYSICAL_PACKAGE_ENVELOPE_REQUIRED`);
    return;
  }
  if (physicalPackage.wordRootKind !== entry.evidenceReceipt?.wordRootKind) {
    errors.push(`${entry.cellId}:PHYSICAL_PACKAGE_WORD_ROOT_KIND_MISMATCH`);
  }
  if (physicalPackage.localRehydrationPolicy !== 'STRICT_LOCAL_CHECK_OPTIONAL_FOR_PORTABLE_CI') {
    errors.push(`${entry.cellId}:PHYSICAL_PACKAGE_LOCAL_REHYDRATION_POLICY_INVALID`);
  }
  if (!safeBasename(physicalPackage.runDirectoryBasename)) {
    errors.push(`${entry.cellId}:PHYSICAL_PACKAGE_RUN_DIRECTORY_INVALID`);
    return;
  }
  const packageRoot = path.join(WORD_PHYSICAL_RUNTIME_ROOT, physicalPackage.runDirectoryBasename);
  const wordRootReal = fs.existsSync(WORD_PHYSICAL_RUNTIME_ROOT) ? fs.realpathSync(WORD_PHYSICAL_RUNTIME_ROOT) : '';
  if (!fs.existsSync(packageRoot) || !fs.lstatSync(packageRoot).isDirectory()) {
    errors.push(`${entry.cellId}:PHYSICAL_PACKAGE_MISSING`);
    return;
  }
  const packageRootReal = fs.realpathSync(packageRoot);
  const packageRootRelative = wordRootReal ? path.relative(wordRootReal, packageRootReal) : '';
  if (!wordRootReal || packageRootRelative.startsWith('..') || path.isAbsolute(packageRootRelative)) {
    errors.push(`${entry.cellId}:PHYSICAL_PACKAGE_ROOT_OUTSIDE_WORD_ROOT`);
    return;
  }
  const expectedArtifacts = new Map([
    ['YALKEN_EXPORT_DOCX', 'source-yalken-export.docx'],
    ['WORD_SAVED_DOCX', 'word-saved.docx'],
    ['WORD_REOPENED_DOCX', 'word-reopened.docx'],
  ]);
  if (!Array.isArray(physicalPackage.artifacts) || physicalPackage.artifacts.length !== expectedArtifacts.size) {
    errors.push(`${entry.cellId}:PHYSICAL_PACKAGE_ARTIFACTS_REQUIRED`);
    return;
  }
  const seenRoles = new Set();
  for (const artifact of physicalPackage.artifacts) {
    if (!isObject(artifact) || !safeBasename(artifact.basename) || !sha256(artifact.sha256)) {
      errors.push(`${entry.cellId}:PHYSICAL_PACKAGE_ARTIFACT_INVALID:${artifact?.role || 'UNKNOWN'}`);
      continue;
    }
    if (!expectedArtifacts.has(artifact.role) || expectedArtifacts.get(artifact.role) !== artifact.basename) {
      errors.push(`${entry.cellId}:PHYSICAL_PACKAGE_ARTIFACT_ROLE_BASENAME_INVALID:${artifact.role || 'UNKNOWN'}`);
      continue;
    }
    if (seenRoles.has(artifact.role)) {
      errors.push(`${entry.cellId}:PHYSICAL_PACKAGE_ARTIFACT_ROLE_DUPLICATE:${artifact.role}`);
      continue;
    }
    seenRoles.add(artifact.role);
    const artifactPath = path.join(packageRoot, artifact.basename);
    if (!fs.existsSync(artifactPath) || !fs.lstatSync(artifactPath).isFile()) {
      errors.push(`${entry.cellId}:PHYSICAL_PACKAGE_ARTIFACT_MISSING:${artifact.role || artifact.basename}`);
      continue;
    }
    const artifactReal = fs.realpathSync(artifactPath);
    const artifactRelative = path.relative(packageRootReal, artifactReal);
    if (!artifactRelative || artifactRelative.startsWith('..') || path.isAbsolute(artifactRelative)) {
      errors.push(`${entry.cellId}:PHYSICAL_PACKAGE_ARTIFACT_OUTSIDE_ROOT:${artifact.role || artifact.basename}`);
      continue;
    }
    const actualSha = sha256File(artifactPath);
    if (!sameSha256(actualSha, artifact.sha256)) {
      errors.push(`${entry.cellId}:PHYSICAL_PACKAGE_ARTIFACT_HASH_MISMATCH:${artifact.role || artifact.basename}`);
    }
  }
  for (const expectedRole of expectedArtifacts.keys()) {
    if (!seenRoles.has(expectedRole)) errors.push(`${entry.cellId}:PHYSICAL_PACKAGE_ARTIFACT_ROLE_MISSING:${expectedRole}`);
  }
}

function ensureDescendant(rootDir, relativePath) {
  const rootAbs = path.resolve(rootDir);
  const targetAbs = path.resolve(rootAbs, relativePath);
  const relative = path.relative(rootAbs, targetAbs);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return '';
  return targetAbs;
}

function readExternalPackageJson(entry, filePath, label, errors) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_${label}_JSON_INVALID`);
    return null;
  }
}

function validateExternalAuditReport(entry, report, actualManifestSha, actualVerifierSha, errors) {
  if (!isObject(report)) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_AUDIT_REPORT_OBJECT_INVALID`);
    return;
  }
  if (!sameKeySet(report, ROOT_DURABLE_PACKAGE_AUDIT_KEYS)) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_AUDIT_REPORT_SCHEMA_CLOSED_SET_MISMATCH`);
  }
  if (report.schemaVersion !== ROOT_DURABLE_PACKAGE_AUDIT_SCHEMA) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_AUDIT_REPORT_SCHEMA_INVALID`);
  }
  if (report.claimBoundary !== ROOT_DURABLE_PACKAGE_AUDIT_CLAIM_BOUNDARY) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_AUDIT_REPORT_CLAIM_BOUNDARY_INVALID`);
  }
  if (report.status !== 'PASS') {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_AUDIT_REPORT_STATUS_INVALID`);
  }
  if (report.checksPassed !== 100 || report.checksFailed !== 0) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_AUDIT_REPORT_COUNTS_INVALID`);
  }
  if (!Array.isArray(report.errors) || report.errors.length !== 0) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_AUDIT_REPORT_ERRORS_NOT_EMPTY`);
  }
  if (!sameSha256(report.manifestSha256, actualManifestSha)) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_AUDIT_REPORT_MANIFEST_HASH_MISMATCH`);
  }
  if (!sameSha256(report.verifierSha256, actualVerifierSha)) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_AUDIT_REPORT_VERIFIER_HASH_MISMATCH`);
  }
  if (!Array.isArray(report.checks) || report.checks.length !== 100) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_AUDIT_REPORT_CHECKS_INVALID`);
    return;
  }
  const checkNames = [];
  for (const check of report.checks) {
    if (!sameKeySet(check, ROOT_DURABLE_PACKAGE_AUDIT_CHECK_KEYS) || typeof check.name !== 'string' || check.pass !== true) {
      errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_AUDIT_REPORT_CHECK_INVALID`);
      return;
    }
    checkNames.push(check.name);
  }
  if (!unique(checkNames)) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_AUDIT_REPORT_CHECK_NAMES_DUPLICATE`);
  }
}

function validateExternalMutationAuditRowTail(entry, row, actualVerifierSha, errors) {
  if (!Array.isArray(row.stdoutTail) || row.stdoutTail.length !== 1) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_ROW_TAIL_INVALID`);
    return;
  }
  let verifierSummary;
  try {
    verifierSummary = JSON.parse(String(row.stdoutTail[row.stdoutTail.length - 1]));
  } catch {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_ROW_TAIL_INVALID`);
    return;
  }
  if (
    !isObject(verifierSummary)
    || verifierSummary.status !== 'FAIL'
    || !Number.isSafeInteger(verifierSummary.checksFailed)
    || verifierSummary.checksFailed <= 0
    || !Number.isSafeInteger(verifierSummary.checksPassed)
    || verifierSummary.checksPassed < 0
    || !sha256(verifierSummary.manifestSha256)
    || !sha256(verifierSummary.reportSha256)
    || !sameSha256(verifierSummary.verifierSha256, actualVerifierSha)
  ) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_ROW_TAIL_INVALID`);
  }
}

function validateExternalMutationAuditReport(entry, report, actualVerifierSha, errors) {
  if (!isObject(report)) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_OBJECT_INVALID`);
    return;
  }
  if (!sameKeySet(report, ROOT_DURABLE_PACKAGE_MUTATION_AUDIT_KEYS)) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_SCHEMA_CLOSED_SET_MISMATCH`);
  }
  if (report.schemaVersion !== ROOT_DURABLE_PACKAGE_MUTATION_AUDIT_SCHEMA) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_SCHEMA_INVALID`);
  }
  if (report.claimBoundary !== ROOT_DURABLE_PACKAGE_MUTATION_AUDIT_CLAIM_BOUNDARY) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_CLAIM_BOUNDARY_INVALID`);
  }
  if (report.status !== 'PASS') {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_STATUS_INVALID`);
  }
  if (report.mutantCount !== 6 || report.killedCount !== 6) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_COUNTS_INVALID`);
  }
  if (!Array.isArray(report.survivors) || report.survivors.length !== 0) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_SURVIVORS_NOT_EMPTY`);
  }
  if (!Array.isArray(report.rows) || report.rows.length !== ROOT_DURABLE_PACKAGE_MUTATION_IDS.length) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_ROWS_INVALID`);
    return;
  }
  const rowIds = exactIds(report.rows);
  if (!sameArray(rowIds, ROOT_DURABLE_PACKAGE_MUTATION_IDS)) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_ROW_IDS_INVALID`);
  }
  if (!unique(rowIds)) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_ROW_IDS_DUPLICATE`);
  }
  for (const row of report.rows) {
    if (
      !sameKeySet(row, ROOT_DURABLE_PACKAGE_MUTATION_AUDIT_ROW_KEYS)
      || row.killed !== true
      || !Number.isSafeInteger(row.exitCode)
      || row.exitCode === 0
      || !Array.isArray(row.stderrTail)
      || !Array.isArray(row.stdoutTail)
    ) {
      errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_MUTATION_AUDIT_REPORT_ROW_INVALID`);
      return;
    }
    validateExternalMutationAuditRowTail(entry, row, actualVerifierSha, errors);
  }
}

function validateCell001ExternalPackageTrust(entry, externalPackage, actuals, errors) {
  if (entry.cellId !== CELL001_EXTERNAL_PACKAGE_TRUST.cellId || externalPackage.packageId !== CELL001_EXTERNAL_PACKAGE_TRUST.packageId) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_PINNED_TRUST_IDENTITY_MISMATCH`);
    return false;
  }
  let valid = true;
  for (const fieldName of ['manifestSha256', 'verifierSha256', 'reportSha256', 'mutationAuditorSha256', 'mutationReportSha256']) {
    if (!sameSha256(externalPackage[fieldName], CELL001_EXTERNAL_PACKAGE_TRUST[fieldName])) {
      errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_PINNED_TRUST_ENVELOPE_MISMATCH:${fieldName}`);
      valid = false;
    }
    if (!sameSha256(actuals[fieldName], CELL001_EXTERNAL_PACKAGE_TRUST[fieldName])) {
      errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_PINNED_TRUST_FILE_MISMATCH:${fieldName}`);
      valid = false;
    }
  }
  return valid;
}

function validateExternalEvidencePackage(entry, envelopeEntry, errors, externalEvidencePackageRoot) {
  const externalPackage = envelopeEntry?.externalRehydrationPackage;
  if (!isObject(externalPackage)) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_ENVELOPE_REQUIRED`);
    return;
  }
  const packageRoot = String(externalEvidencePackageRoot || '').trim();
  if (!packageRoot) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_ROOT_REQUIRED`);
    return;
  }
  if (!fs.existsSync(packageRoot) || !fs.statSync(packageRoot).isDirectory()) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_ROOT_MISSING`);
    return;
  }
  if (!safeBasename(externalPackage.packageId) || externalPackage.packageId !== path.basename(packageRoot)) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_ID_MISMATCH`);
  }
  const packageRootReal = fs.realpathSync(packageRoot);
  const manifestPath = path.join(packageRoot, 'MANIFEST.json');
  const verifierPath = path.join(packageRoot, 'create_and_verify.py');
  const reportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_AUDIT.json');
  const mutationAuditorPath = path.join(packageRoot, 'mutation_audit.py');
  const mutationReportPath = path.join(packageRoot, 'ROOT_DURABLE_CELL001_PACKAGE_MUTATION_AUDIT.json');
  const actuals = {
    manifestSha256: '',
    verifierSha256: '',
    reportSha256: '',
    mutationAuditorSha256: '',
    mutationReportSha256: '',
  };
  for (const [label, filePath, expectedSha] of [
    ['MANIFEST', manifestPath, externalPackage.manifestSha256],
    ['VERIFIER', verifierPath, externalPackage.verifierSha256],
    ['REPORT', reportPath, externalPackage.reportSha256],
    ['MUTATION_AUDITOR', mutationAuditorPath, externalPackage.mutationAuditorSha256],
    ['MUTATION_REPORT', mutationReportPath, externalPackage.mutationReportSha256],
  ]) {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_${label}_MISSING`);
      continue;
    }
    if (!sameSha256(sha256File(filePath), expectedSha)) {
      errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_${label}_HASH_MISMATCH`);
    }
    if (label === 'MANIFEST') actuals.manifestSha256 = sha256File(filePath);
    if (label === 'VERIFIER') actuals.verifierSha256 = sha256File(filePath);
    if (label === 'REPORT') actuals.reportSha256 = sha256File(filePath);
    if (label === 'MUTATION_AUDITOR') actuals.mutationAuditorSha256 = sha256File(filePath);
    if (label === 'MUTATION_REPORT') actuals.mutationReportSha256 = sha256File(filePath);
  }
  if (!validateCell001ExternalPackageTrust(entry, externalPackage, actuals, errors)) return;
  if (externalPackage.reportStatus !== 'PASS_100_OF_100_TWO_BYTE_IDENTICAL_REPORTS') {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_REPORT_STATUS_INVALID`);
  }
  if (externalPackage.mutationReportStatus !== 'PASS_6_OF_6_KILLED_ZERO_SURVIVORS') {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_MUTATION_REPORT_STATUS_INVALID`);
  }

  if (fs.existsSync(reportPath) && fs.statSync(reportPath).isFile()) {
    const report = readExternalPackageJson(entry, reportPath, 'AUDIT_REPORT', errors);
    if (report) validateExternalAuditReport(entry, report, actuals.manifestSha256, actuals.verifierSha256, errors);
  }
  if (fs.existsSync(mutationReportPath) && fs.statSync(mutationReportPath).isFile()) {
    const mutationReport = readExternalPackageJson(entry, mutationReportPath, 'MUTATION_AUDIT_REPORT', errors);
    if (mutationReport) validateExternalMutationAuditReport(entry, mutationReport, actuals.verifierSha256, errors);
  }

  if (!fs.existsSync(manifestPath) || !fs.statSync(manifestPath).isFile()) return;
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_MANIFEST_JSON_INVALID`);
    return;
  }
  if (manifest.schemaVersion !== externalPackage.schemaVersion) errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_SCHEMA_MISMATCH`);
  if (manifest.cellId !== entry.cellId) errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_CELL_MISMATCH`);
  if (manifest.sourceExecutionHead !== entry.sourceRevision) errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_HEAD_MISMATCH`);
  if (manifest.sourceExecutionTree !== entry.sourceTree) errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_TREE_MISMATCH`);
  if (manifest.fileCount !== externalPackage.fileCount) errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_FILE_COUNT_MISMATCH`);
  if (!Array.isArray(manifest.files) || manifest.files.length !== manifest.fileCount) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_FILES_INVALID`);
    return;
  }
  const seenPaths = new Set();
  let packagedLedgerEntryPath = '';
  let packagedLedgerEntrySha = '';
  for (const fileRecord of manifest.files) {
    if (!isObject(fileRecord) || typeof fileRecord.path !== 'string' || !sha256(fileRecord.sha256)) {
      errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_FILE_RECORD_INVALID`);
      continue;
    }
    if (fileRecord.path.split('/').some((segment) => !safeBasename(segment))) {
      errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_FILE_PATH_INVALID:${fileRecord.path}`);
      continue;
    }
    if (seenPaths.has(fileRecord.path)) {
      errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_FILE_PATH_DUPLICATE:${fileRecord.path}`);
      continue;
    }
    seenPaths.add(fileRecord.path);
    const filePath = ensureDescendant(packageRoot, fileRecord.path);
    if (!filePath || !fs.existsSync(filePath) || !fs.lstatSync(filePath).isFile()) {
      errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_FILE_MISSING:${fileRecord.path}`);
      continue;
    }
    const fileReal = fs.realpathSync(filePath);
    const fileRelative = path.relative(packageRootReal, fileReal);
    if (!fileRelative || fileRelative.startsWith('..') || path.isAbsolute(fileRelative)) {
      errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_FILE_OUTSIDE_ROOT:${fileRecord.path}`);
      continue;
    }
    if (!sameSha256(sha256File(filePath), fileRecord.sha256)) {
      errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_FILE_HASH_MISMATCH:${fileRecord.path}`);
    }
    if (fileRecord.path === 'ledger-entry.json') {
      packagedLedgerEntryPath = filePath;
      packagedLedgerEntrySha = fileRecord.sha256;
    }
  }
  if (!packagedLedgerEntryPath) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_LEDGER_ENTRY_REQUIRED`);
    return;
  }
  if (!sha256(externalPackage.ledgerEntryRawSha256) || !sameSha256(packagedLedgerEntrySha, externalPackage.ledgerEntryRawSha256)) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_LEDGER_ENTRY_MANIFEST_HASH_UNEXPECTED`);
  }
  let packagedLedgerEntry;
  try {
    packagedLedgerEntry = JSON.parse(fs.readFileSync(packagedLedgerEntryPath, 'utf8'));
  } catch {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_LEDGER_ENTRY_JSON_INVALID`);
    return;
  }
  if (!sameKeySet(packagedLedgerEntry, PASS_ENTRY_KEYS)) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_LEDGER_ENTRY_SCHEMA_CLOSED_SET_MISMATCH`);
  }
  if (!sameSha256(sha256StableJson(packagedLedgerEntry), envelopeEntry.canonicalPassEntrySha256)) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_LEDGER_ENTRY_DIGEST_MISMATCH`);
  }
  if (stableJsonString(packagedLedgerEntry) !== stableJsonString(entry)) {
    errors.push(`${entry.cellId}:EXTERNAL_EVIDENCE_PACKAGE_LEDGER_ENTRY_CURRENT_MISMATCH`);
  }
}

function validateEnvelopeBinding(entry, route, envelopeEntry, repoRoot, errors, options) {
  if (!isObject(envelopeEntry)) {
    errors.push(`${entry.cellId}:EVIDENCE_ENVELOPE_ENTRY_REQUIRED`);
    return;
  }
  if (!sameKeySet(entry, PASS_ENTRY_KEYS)) {
    errors.push(`${entry.cellId}:PASS_ENTRY_SCHEMA_CLOSED_SET_MISMATCH`);
  }
  if (!sha256(envelopeEntry.canonicalPassEntrySha256)) {
    errors.push(`${entry.cellId}:EVIDENCE_ENVELOPE_CANONICAL_PASS_ENTRY_DIGEST_REQUIRED`);
  } else if (!sameSha256(sha256StableJson(entry), envelopeEntry.canonicalPassEntrySha256)) {
    errors.push(`${entry.cellId}:EVIDENCE_ENVELOPE_CANONICAL_PASS_ENTRY_DIGEST_MISMATCH`);
  }
  for (const fieldName of ['status', 'evidenceClass', 'exactHeadSha', 'sourceRevision', 'sourceTree', 'generationId']) {
    compareStringField(entry, envelopeEntry, fieldName, errors);
  }
  for (const fieldName of ['artifactSha256', 'targetRevision']) {
    compareShaField(entry, envelopeEntry, fieldName, errors);
  }
  validateEvidenceReceiptBinding(entry, envelopeEntry, errors);
  validateOracleAuthorityBinding(entry, envelopeEntry, errors);
  validateHopGraphBinding(entry, route, envelopeEntry, errors);
  validateProviderGraphBinding(entry, route, envelopeEntry, errors);
  validateCycleGraphBinding(entry, envelopeEntry, errors);
  validateSourceTreeBinding(entry, repoRoot, errors);
  if (options?.requireLocalPhysicalPackage === true) {
    validatePhysicalPackageRehydration(entry, envelopeEntry, errors);
  }
  if (options?.requireExternalEvidencePackage === true) {
    validateExternalEvidencePackage(entry, envelopeEntry, errors, options.externalEvidencePackageRoot);
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
    if (!sha256(item?.revisionIdentity)) errors.push(`${entry.cellId}:PROVIDER_REVISION_SHA_INVALID:${item?.profileId || 'UNKNOWN'}`);
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

function validatePassEntry(entry, cell, spec, currentHead, repoRoot, envelopeEntry, errors, options) {
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
  if (!sha256(entry.targetRevision)) errors.push(`${entry.cellId}:TARGET_REVISION_SHA_INVALID`);
  if (typeof entry.generationId !== 'string' || entry.generationId.length === 0 || entry.generationId.includes('/')) {
    errors.push(`${entry.cellId}:GENERATION_ID_INVALID`);
  }
  if (!entry.sourceRevision || !entry.targetRevision || !entry.generationId) errors.push(`${entry.cellId}:REVISION_GENERATION_IDENTITY_INCOMPLETE`);
  validateFixture(entry, errors);
  validateOracles(entry, errors);
  validateHopEvidence(entry, route, errors);
  validateProviderEvidence(entry, route, currentHead, repoRoot, errors);
  validateCycles(entry, route, errors);
  validateOutsideContract(entry, errors);
  validateEnvelopeBinding(entry, route, envelopeEntry, repoRoot, errors, options);
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

export function validateInterop100({
  spec,
  envelope,
  ledger,
  currentHead,
  repoRoot = repoRootFromHere(),
  requireLocalPhysicalPackage = false,
  requireExternalEvidencePackage = false,
  externalEvidencePackageRoot = '',
}) {
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
  const envelopeByCellId = buildEvidenceEnvelopeEntryMap(envelope, spec, ledger, errors);
  validateRouteQualificationEvidence(ledger, ledger.bindingBaseSha, errors);

  const cells = buildRequiredCells(spec || {});
  const cellById = new Map(cells.map((cell) => [cell.cellId, cell]));
  const entries = Array.isArray(ledger.entries) ? ledger.entries : [];
  const entryIds = entries.map((entry) => entry?.cellId);
  if (!unique(entryIds)) errors.push('LEDGER_DUPLICATE_CELL_ID');
  const authoritativeAdmission = requireExternalEvidencePackage === true;
  let passedRequiredCells = 0;
  let diagnosticPassedRequiredCells = 0;
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
      validatePassEntry(entry, cellById.get(entry.cellId), spec, currentHead, repoRoot, envelopeByCellId.get(entry.cellId), errors, {
        requireLocalPhysicalPackage,
        requireExternalEvidencePackage,
        externalEvidencePackageRoot,
      });
      if (errors.length === before) {
        if (authoritativeAdmission) passedRequiredCells += 1;
        else diagnosticPassedRequiredCells += 1;
      }
    }
  }

  const unrecorded = Math.max(0, cells.length - entries.length);
  statusCounts.NOT_EXECUTED += unrecorded;
  const percentage = cells.length === 0 ? 0 : Number(((passedRequiredCells / cells.length) * 100).toFixed(6));
  const diagnosticPercentage = cells.length === 0 ? 0 : Number(((diagnosticPassedRequiredCells / cells.length) * 100).toFixed(6));
  const declaredPassedCells = authoritativeAdmission ? passedRequiredCells : diagnosticPassedRequiredCells;
  const declaredPercentage = authoritativeAdmission ? percentage : diagnosticPercentage;
  const declared = ledger.declaredRollup;
  if (!isObject(declared)
    || declared.requiredCells !== cells.length
    || declared.passedRequiredCells !== declaredPassedCells
    || declared.notExecutedCells !== statusCounts.NOT_EXECUTED
    || declared.percentage !== declaredPercentage
    || declared.broadPassClaim !== (declaredPassedCells === cells.length && cells.length > 0)) {
    errors.push('DECLARED_ROLLUP_MISMATCH');
  }
  if (!isObject(spec.currentGap)
    || spec.currentGap.requiredCellDenominator !== cells.length
    || spec.currentGap.exactHeadPassedNumerator !== declaredPassedCells
    || spec.currentGap.percentage !== declaredPercentage) {
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
    diagnosticPassedRequiredCells,
    percentage,
    diagnosticPercentage,
    authoritativeAdmission,
    statusCounts,
    claimVerdict: passedRequiredCells === cells.length && cells.length === EXPECTED_REQUIRED_CELLS && errors.length === 0
      ? 'PASS_100_PERCENT_SUPPORTED_CONTRACT'
      : authoritativeAdmission
        ? 'NEEDS_MORE_EVIDENCE'
        : 'AUTHORITATIVE_REHYDRATION_REQUIRED',
  };
}

export function verifyInterop100(repoRoot = repoRootFromHere(), options = {}) {
  const spec = options.spec || readInterop100Denominator(repoRoot);
  const envelope = options.envelope || readInterop100EvidenceEnvelope(repoRoot);
  const ledger = options.ledger || readInterop100EvidenceLedger(repoRoot);
  const currentHead = options.currentHead || currentGitHead(repoRoot);
  return validateInterop100({
    spec,
    envelope,
    ledger,
    currentHead,
    repoRoot,
    requireLocalPhysicalPackage: options.requireLocalPhysicalPackage === true,
    requireExternalEvidencePackage: options.requireExternalEvidencePackage === true,
    externalEvidencePackageRoot: options.externalEvidencePackageRoot || '',
  });
}

function main() {
  const report = verifyInterop100(repoRootFromHere(), {
    requireLocalPhysicalPackage: process.argv.includes('--require-local-physical-package')
      || process.env.YALKEN_INTEROP100_REQUIRE_LOCAL_PHYSICAL_PACKAGE === '1',
    requireExternalEvidencePackage: process.argv.includes('--require-external-evidence-package')
      || process.env.YALKEN_INTEROP100_REQUIRE_EXTERNAL_EVIDENCE_PACKAGE === '1',
    externalEvidencePackageRoot: process.env.YALKEN_INTEROP100_EXTERNAL_EVIDENCE_PACKAGE_ROOT || '',
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) process.exitCode = 1;
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) main();
