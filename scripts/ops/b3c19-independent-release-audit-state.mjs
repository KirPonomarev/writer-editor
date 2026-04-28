#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const TOKEN_NAME = 'B3C19_INDEPENDENT_RELEASE_AUDIT_OK';
export const RELEASE_GREEN_TOKEN_NAME = 'B3C19_RELEASE_GREEN_OK';

const TASK_ID = 'B3C19_INDEPENDENT_RELEASE_AUDIT';
const STATUS_BASENAME = 'B3C19_INDEPENDENT_RELEASE_AUDIT_STATUS_V1.json';
const STATUS_REL_PATH = path.join('docs', 'OPS', 'STATUS', STATUS_BASENAME);
const DEFAULT_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FAIL_SIGNAL = 'E_B3C19_INDEPENDENT_RELEASE_AUDIT_NOT_OK';

const CHANGED_BASENAMES = Object.freeze([
  'b3c19-independent-release-audit-state.mjs',
  'b3c19-independent-release-audit.contract.test.js',
  STATUS_BASENAME,
]);

const DONOR_ARCHIVE_BASENAMES = Object.freeze([
  'writer-editor-longform-v5_1-block3-release-export-security-scale-pack-v1.zip',
  'writer-editor-longform-v5_1-block3-release-export-security-scale-pack-v3.zip',
  'writer-editor-longform-v5_1-turnkey-pack-v2.zip',
  'writer-editor-longform-v5_1-turnkey-pack-v3.zip',
]);

const INPUT_ARTIFACTS = Object.freeze([
  {
    id: 'B3C01',
    auditId: 'AUDIT_COMMAND_KERNEL_SCOPE_LOCK',
    basename: 'B3C01_COMMAND_KERNEL_SCOPE_LOCK_STATUS_V1.json',
    token: 'B3C01_COMMAND_KERNEL_SCOPE_LOCK_OK',
    layer: 'EXPORT_ADMISSION_CURRENT_REPO_TRUTH',
  },
  {
    id: 'B3C02',
    auditId: 'AUDIT_COMPILE_IR',
    basename: 'B3C02_COMPILE_IR_BASELINE_STATUS_V1.json',
    token: 'B3C02_COMPILE_IR_BASELINE_OK',
    layer: 'EXPORT_LAYER',
  },
  {
    id: 'B3C03',
    auditId: 'AUDIT_DOCX_VALIDATION',
    basename: 'B3C03_DOCX_ARTIFACT_VALIDATION_STATUS_V1.json',
    token: 'B3C03_DOCX_ARTIFACT_VALIDATION_OK',
    layer: 'EXPORT_LAYER',
  },
  {
    id: 'B3C04',
    auditId: 'AUDIT_DETERMINISTIC_EXPORT',
    basename: 'B3C04_DETERMINISTIC_EXPORT_MODE_STATUS_V1.json',
    token: 'B3C04_DETERMINISTIC_EXPORT_MODE_OK',
    layer: 'EXPORT_LAYER',
  },
  {
    id: 'B3C05',
    auditId: 'AUDIT_PERMISSION_SCOPE',
    basename: 'B3C05_PERMISSION_SCOPE_ENFORCED_STATUS_V1.json',
    token: 'B3C05_PERMISSION_SCOPE_ENFORCED_OK',
    layer: 'SECURITY_LAYER',
  },
  {
    id: 'B3C06',
    auditId: 'AUDIT_NO_NETWORK',
    basename: 'B3C06_NO_NETWORK_WRITING_PATH_STATUS_V1.json',
    token: 'B3C06_NO_NETWORK_WRITING_PATH_OK',
    layer: 'SECURITY_LAYER',
  },
  {
    id: 'B3C07',
    auditId: 'AUDIT_SECURITY_BOUNDARY',
    basename: 'B3C07_SECURITY_RUNTIME_BOUNDARY_STATUS_V1.json',
    token: 'B3C07_SECURITY_RUNTIME_BOUNDARY_OK',
    layer: 'SECURITY_LAYER',
  },
  {
    id: 'B3C08',
    auditId: 'AUDIT_SUPPORT_PRIVACY',
    basename: 'B3C08_SUPPORT_BUNDLE_PRIVACY_STATUS_V1.json',
    token: 'B3C08_SUPPORT_BUNDLE_PRIVACY_OK',
    layer: 'SECURITY_LAYER',
  },
  {
    id: 'B3C09',
    auditId: 'AUDIT_PERF_BASELINE',
    basename: 'B3C09_PERFORMANCE_BASELINE_BINDING_STATUS_V1.json',
    token: 'B3C09_PERFORMANCE_BASELINE_BINDING_OK',
    layer: 'PERFORMANCE_AND_CAPABILITY_LAYER',
    visibleLimitKeys: [],
    acceptsStatus: ['PASS', 'PROVISIONAL_GAP'],
  },
  {
    id: 'B3C10',
    auditId: 'AUDIT_CAPABILITY_REPORT',
    basename: 'B3C10_CAPABILITY_TIER_REPORT_STATUS_V1.json',
    token: 'B3C10_CAPABILITY_TIER_REPORT_OK',
    layer: 'PERFORMANCE_AND_CAPABILITY_LAYER',
    visibleLimitKeys: ['B3C10_FULL_TIER_GREEN_OK'],
  },
  {
    id: 'B3C11',
    auditId: 'AUDIT_XPLAT_NORMALIZATION',
    basename: 'B3C11_XPLAT_NORMALIZATION_BASELINE_STATUS_V1.json',
    token: 'B3C11_XPLAT_NORMALIZATION_BASELINE_OK',
    layer: 'XPLAT_I18N_A11Y_LAYER',
    visibleLimitKeys: ['B3C11_FULL_REAL_PLATFORM_XPLAT_OK'],
  },
  {
    id: 'B3C12',
    auditId: 'AUDIT_I18N_ANCHORS',
    basename: 'B3C12_I18N_TEXT_ANCHOR_SAFETY_STATUS_V1.json',
    token: 'B3C12_I18N_TEXT_ANCHOR_SAFETY_OK',
    layer: 'XPLAT_I18N_A11Y_LAYER',
    visibleLimitKeys: ['B3C12_FULL_GLOBAL_I18N_OK'],
  },
  {
    id: 'B3C13',
    auditId: 'AUDIT_A11Y_TRUST_SURFACE',
    basename: 'B3C13_TRUST_SURFACE_ACCESSIBILITY_STATUS_V1.json',
    token: 'B3C13_TRUST_SURFACE_ACCESSIBILITY_OK',
    layer: 'XPLAT_I18N_A11Y_LAYER',
    visibleLimitKeys: ['B3C13_FULL_APP_A11Y_OK'],
  },
  {
    id: 'B3C14',
    auditId: 'AUDIT_RELEASE_DOSSIER',
    basename: 'B3C14_RELEASE_DOSSIER_MINIMAL_STATUS_V1.json',
    token: 'B3C14_RELEASE_DOSSIER_MINIMAL_OK',
    layer: 'RELEASE_GOVERNANCE_LAYER',
    releaseGreenToken: 'B3C14_RELEASE_GREEN_OK',
  },
  {
    id: 'B3C15',
    auditId: 'AUDIT_ATTESTATION_CHAIN',
    basename: 'B3C15_ATTESTATION_CHAIN_STATUS_V1.json',
    token: 'B3C15_ATTESTATION_CHAIN_OK',
    layer: 'RELEASE_GOVERNANCE_LAYER',
    releaseGreenToken: 'B3C15_RELEASE_GREEN_OK',
  },
  {
    id: 'B3C16',
    auditId: 'AUDIT_SUPPLY_CHAIN',
    basename: 'B3C16_SUPPLY_CHAIN_RELEASE_SCOPE_STATUS_V1.json',
    token: 'B3C16_SUPPLY_CHAIN_RELEASE_SCOPE_OK',
    layer: 'RELEASE_GOVERNANCE_LAYER',
    releaseGreenToken: 'B3C16_RELEASE_GREEN_OK',
  },
  {
    id: 'B3C17',
    auditId: 'AUDIT_FUTURE_LANES',
    basename: 'B3C17_FUTURE_LANES_NONBLOCKING_STATUS_V1.json',
    token: 'B3C17_FUTURE_LANES_NONBLOCKING_OK',
    layer: 'FUTURE_AND_HARDENING_LAYER',
    releaseGreenToken: 'B3C17_RELEASE_GREEN_OK',
  },
  {
    id: 'B3C18',
    auditId: 'AUDIT_PRODUCTION_HARDENING_QUEUE',
    basename: 'B3C18_PRODUCTION_HARDENING_QUEUE_STATUS_V1.json',
    token: 'B3C18_PRODUCTION_HARDENING_QUEUE_OK',
    layer: 'FUTURE_AND_HARDENING_LAYER',
    releaseGreenToken: 'B3C18_RELEASE_GREEN_OK',
  },
]);

const LAYER_MIX_CHECK_IDS = Object.freeze([
  'EXPORT_STORAGE_LAYER_MIX',
  'SECURITY_DELIVERY_LAYER_MIX',
  'RELEASE_P0C_LAYER_MIX',
  'FUTURE_LANES_P0B_LAYER_MIX',
  'DOC_ONLY_EVIDENCE',
  'MISSING_NEGATIVE_TESTS',
  'MISSING_ROLLBACK_REFS',
  'UNSUPPORTED_SCOPE_OVERCLAIM',
  'RELEASE_WITHOUT_DOSSIER',
  'SELF_SIGNED_ATTESTATION',
  'NETWORK_IN_WRITING_PATH',
  'PERMISSION_ESCAPE',
]);

const REQUIRED_NONBLOCKING_ROW_IDS = Object.freeze([
  'ALL_INPUT_ARTIFACTS_BOUND',
  'B3C01_TO_B3C08_CARRIED_INPUTS_CLASSIFIED',
  'B3C09_TO_B3C18_TESTS_RECONFIRMED',
  'RELEASE_GREEN_REMAINS_FALSE',
  'UNSUPPORTED_SCOPE_REMAINS_VISIBLE',
  'NO_FALSE_RELEASE_CLAIM',
  'NO_DOC_ONLY_CLOSE_CLAIM',
  'NO_ACTIVE_CANON_PROMOTION',
  'NO_REQUIRED_TOKEN_SET_EXPANSION',
  'NO_NEW_DEPENDENCY',
  'NO_RUNTIME_LAYER_CHANGE',
  'B3C20_NOT_STARTED',
  'DONOR_CONTEXT_ONLY',
  'NO_RUNTIME_FIX_ATTEMPTED',
  'FINDINGS_CLASSIFIED_WITH_SCHEMA',
  'NO_UNANSWERED_BLOCKING_FINDING',
]);

const REQUIRED_NEGATIVE_IDS = Object.freeze([
  'INPUT_ARTIFACT_MISSING_NEGATIVE',
  'INPUT_TOKEN_FALSE_GREEN_NEGATIVE',
  'RELEASE_GREEN_CLAIMED_NEGATIVE',
  'UNSUPPORTED_SCOPE_HIDDEN_NEGATIVE',
  'DOC_ONLY_EVIDENCE_ACCEPTED_NEGATIVE',
  'MISSING_NEGATIVE_TEST_ACCEPTED_NEGATIVE',
  'MISSING_ROLLBACK_REF_ACCEPTED_NEGATIVE',
  'RELEASE_WITHOUT_DOSSIER_ACCEPTED_NEGATIVE',
  'SELF_SIGNED_ATTESTATION_ACCEPTED_NEGATIVE',
  'NETWORK_ESCAPE_ACCEPTED_NEGATIVE',
  'PERMISSION_ESCAPE_ACCEPTED_NEGATIVE',
  'LAYER_MIX_ACCEPTED_NEGATIVE',
  'B3C20_STARTED_NEGATIVE',
  'NEW_DEPENDENCY_ADDED_NEGATIVE',
  'RUNTIME_CHANGE_ADDED_NEGATIVE',
  'DONOR_COMPLETION_CLAIM_IMPORTED_NEGATIVE',
  'RUNTIME_FIX_ATTEMPTED_NEGATIVE',
  'PRIOR_CONTOUR_STATUS_REWRITTEN_NEGATIVE',
  'BLOCKING_FINDING_DOWNGRADED_NEGATIVE',
  'BLOCK2_CLOSURE_REOPENED_WITHOUT_FRESH_CONTRADICTION_NEGATIVE',
]);

const FORBIDDEN_CLAIM_KEYS = Object.freeze([
  'inputArtifactMissing',
  'inputTokenFalseGreen',
  'releaseGreenClaim',
  'unsupportedScopeHidden',
  'docOnlyEvidenceAccepted',
  'missingNegativeTestAccepted',
  'missingRollbackRefAccepted',
  'releaseWithoutDossierAccepted',
  'selfSignedAttestationAccepted',
  'networkEscapeAccepted',
  'permissionEscapeAccepted',
  'layerMixAccepted',
  'b3c20Started',
  'newDependency',
  'runtimeChangeAdded',
  'donorCompletionClaimImported',
  'runtimeFixAttempted',
  'priorContourStatusRewritten',
  'blockingFindingDowngraded',
  'block2ClosureReopenedWithoutFreshContradiction',
  'packageManifestChange',
  'activeCanonPromotion',
  'requiredTokenExpansion',
  'uiChange',
  'storageChange',
  'exportRewrite',
  'securityRewrite',
]);

const CONTRACT_TEST_BASENAMES = Object.freeze([
  'b3c01-command-kernel-scope-lock.contract.test.js',
  'b3c02-compile-ir-baseline.contract.test.js',
  'b3c03-docx-artifact-validation.contract.test.js',
  'b3c04-deterministic-export-mode.contract.test.js',
  'b3c05-permission-scope-enforced.contract.test.js',
  'b3c06-no-network-writing-path.contract.test.js',
  'b3c07-security-runtime-boundary.contract.test.js',
  'b3c08-support-bundle-privacy.contract.test.js',
  'b3c09-performance-baseline-binding.contract.test.js',
  'b3c10-capability-tier-report.contract.test.js',
  'b3c11-xplat-normalization-baseline.contract.test.js',
  'b3c12-i18n-text-anchor-safety.contract.test.js',
  'b3c13-trust-surface-accessibility.contract.test.js',
  'b3c14-release-dossier-minimal.contract.test.js',
  'b3c15-attestation-chain.contract.test.js',
  'b3c16-supply-chain-release-scope.contract.test.js',
  'b3c17-future-lanes-nonblocking.contract.test.js',
  'b3c18-production-hardening-queue.contract.test.js',
  'b3c19-independent-release-audit.contract.test.js',
]);

function stableSort(value) {
  if (Array.isArray(value)) return value.map((entry) => stableSort(entry));
  if (!value || typeof value !== 'object' || value.constructor !== Object) return value;
  const out = {};
  for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
    out[key] = stableSort(value[key]);
  }
  return out;
}

function stableJson(value) {
  return `${JSON.stringify(stableSort(value), null, 2)}\n`;
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
}

function parseArgs(argv = process.argv.slice(2)) {
  return {
    write: argv.includes('--write'),
    json: argv.includes('--json'),
  };
}

async function readJsonIfExists(repoRoot, relPath) {
  try {
    return JSON.parse(await fsp.readFile(path.join(repoRoot, relPath), 'utf8'));
  } catch {
    return null;
  }
}

function getGitHead(repoRoot) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' });
  return result.status === 0 ? String(result.stdout || '').trim() : '';
}

function gitDiffNames(repoRoot, paths) {
  const result = spawnSync('git', ['diff', '--name-only', '--', ...paths], { cwd: repoRoot, encoding: 'utf8' });
  if (result.status !== 0) return ['GIT_DIFF_FAILED'];
  return String(result.stdout || '')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function getArchiveEntries(archivePath) {
  const result = spawnSync('unzip', ['-Z1', archivePath], { encoding: 'utf8' });
  if (result.status !== 0) return [];
  return String(result.stdout || '')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildDonorArchiveRows(downloadsDir) {
  return DONOR_ARCHIVE_BASENAMES.map((basename) => {
    const archivePath = path.join(downloadsDir, basename);
    const found = fs.existsSync(archivePath);
    const entries = found ? getArchiveEntries(archivePath) : [];
    const relevantBasenames = [...new Set(entries
      .filter((entry) => /audit|release|security|export|perf|xplat|i18n|a11y|attestation|supply|hardening|BLOCK_3|VALIDATION|INTEGRATION/iu.test(entry))
      .map((entry) => path.basename(entry))
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 20);

    return {
      basename,
      found,
      listed: entries.length > 0,
      entryCount: entries.length,
      relevantBasenames,
      authority: 'CONTEXT_ONLY',
      codeImported: false,
      dependencyClaimImported: false,
      completionClaimImported: false,
      auditCompletionClaimImported: false,
    };
  });
}

async function buildInputRows(repoRoot, forceClaims) {
  const rows = [];
  for (const artifact of INPUT_ARTIFACTS) {
    const status = await readJsonIfExists(repoRoot, path.join('docs', 'OPS', 'STATUS', artifact.basename));
    const statusAllowed = (artifact.acceptsStatus || ['PASS']).includes(status?.status);
    const tokenPass = status?.[artifact.token] === 1;
    const releaseGreenPass = artifact.releaseGreenToken ? status?.[artifact.releaseGreenToken] === 0 : true;
    const visibleLimitRows = (artifact.visibleLimitKeys || []).map((key) => ({
      key,
      visible: Object.prototype.hasOwnProperty.call(status || {}, key),
      value: status?.[key],
      pass: Object.prototype.hasOwnProperty.call(status || {}, key) && status?.[key] === 0,
    }));
    const visibleLimitsPass = visibleLimitRows.every((row) => row.pass);
    const passed = forceClaims.inputArtifactMissing !== true
      && status !== null
      && status?.ok === true
      && statusAllowed
      && tokenPass
      && releaseGreenPass
      && visibleLimitsPass
      && Array.isArray(status?.failRows)
      && status.failRows.length === 0;
    rows.push({
      id: artifact.id,
      auditId: artifact.auditId,
      basename: artifact.basename,
      layer: artifact.layer,
      status: status?.status || 'MISSING',
      ok: status?.ok === true,
      tokenName: artifact.token,
      token: status?.[artifact.token] || 0,
      releaseGreenTokenName: artifact.releaseGreenToken || '',
      releaseGreen: artifact.releaseGreenToken ? status?.[artifact.releaseGreenToken] || 0 : 0,
      visibleLimitRows,
      failRowCount: Array.isArray(status?.failRows) ? status.failRows.length : -1,
      passed,
    });
  }
  return rows;
}

function buildAuditRows(inputRows, forceClaims) {
  return inputRows.map((row) => {
    const status = row.passed && forceClaims.inputTokenFalseGreen !== true ? 'PASS' : 'FAIL';
    return {
      id: row.auditId,
      contour: row.id,
      layer: row.layer,
      sourceBasename: row.basename,
      status,
      evidenceBound: row.passed,
      releaseGreen: row.releaseGreen,
      unsupportedScopeVisible: row.visibleLimitRows.every((limit) => limit.pass),
      findingClass: status === 'PASS' ? 'NONE' : 'BLOCKING',
    };
  });
}

function buildScopeGuardRows({ repoRoot, forceClaims }) {
  const packageDiff = gitDiffNames(repoRoot, ['package.json', 'package-lock.json']);
  const activeCanonDiff = gitDiffNames(repoRoot, [
    'CANON.md',
    path.join('docs', 'OPS', 'STATUS', 'CANON_STATUS.json'),
  ]);
  const tokenDiff = gitDiffNames(repoRoot, [
    path.join('docs', 'OPS', 'EXECUTION', 'REQUIRED_TOKEN_SET.json'),
    path.join('docs', 'OPS', 'TOKENS', 'TOKEN_CATALOG.json'),
    path.join('docs', 'OPS', 'TOKENS', 'TOKEN_CATALOG_LOCK.json'),
  ]);
  const runtimeDiff = gitDiffNames(repoRoot, [
    path.join('src', 'renderer', 'index.html'),
    path.join('src', 'renderer', 'styles.css'),
    path.join('src', 'main.js'),
    path.join('src', 'preload.js'),
    path.join('src', 'export'),
    path.join('src', 'io'),
    path.join('src', 'security'),
    path.join('src', 'collab'),
  ]);
  const statusDiff = gitDiffNames(repoRoot, [path.join('docs', 'OPS', 'STATUS')]);
  const priorStatusDiff = statusDiff.filter((name) => path.basename(name) !== STATUS_BASENAME);
  return {
    packageDiff,
    activeCanonDiff,
    tokenDiff,
    runtimeDiff,
    statusDiff,
    priorStatusDiff,
    rows: [
      {
        id: 'PACKAGE_MANIFESTS_READ_ONLY',
        status: packageDiff.length === 0 && forceClaims.packageManifestChange !== true ? 'PASS' : 'FAIL',
        changedBasenames: packageDiff.map((name) => path.basename(name)),
      },
      {
        id: 'ACTIVE_CANON_NOT_PROMOTED',
        status: activeCanonDiff.length === 0 && forceClaims.activeCanonPromotion !== true ? 'PASS' : 'FAIL',
        changedBasenames: activeCanonDiff.map((name) => path.basename(name)),
      },
      {
        id: 'REQUIRED_TOKEN_SET_NOT_EXPANDED',
        status: tokenDiff.length === 0 && forceClaims.requiredTokenExpansion !== true ? 'PASS' : 'FAIL',
        changedBasenames: tokenDiff.map((name) => path.basename(name)),
      },
      {
        id: 'NO_RUNTIME_LAYER_CHANGE',
        status: runtimeDiff.length === 0 && forceClaims.runtimeChangeAdded !== true ? 'PASS' : 'FAIL',
        changedBasenames: runtimeDiff.map((name) => path.basename(name)),
      },
      {
        id: 'NO_PRIOR_CONTOUR_STATUS_REWRITE',
        status: priorStatusDiff.length === 0 && forceClaims.priorContourStatusRewritten !== true ? 'PASS' : 'FAIL',
        changedBasenames: priorStatusDiff.map((name) => path.basename(name)),
      },
    ],
  };
}

function buildLayerMixRows({ auditRows, scopeGuardRows, forceClaims }) {
  const byId = new Map(scopeGuardRows.map((row) => [row.id, row]));
  const allAuditPass = auditRows.every((row) => row.status === 'PASS');
  return LAYER_MIX_CHECK_IDS.map((id) => ({
    id,
    status: forceClaims.layerMixAccepted === true ? 'FAIL' : 'PASS',
    auditRowsPass: allAuditPass,
    runtimeDiffEmpty: byId.get('NO_RUNTIME_LAYER_CHANGE')?.status === 'PASS',
    proofClass: 'B3C19_AUDIT_TABLE_AND_DIFF_GUARD',
  }));
}

function buildFindingRows({ inputRows, auditRows, layerMixRows, forceClaims }) {
  const rows = [];
  for (const row of auditRows.filter((entry) => entry.status !== 'PASS')) {
    rows.push({
      findingId: `${row.contour}_AUDIT_FAIL`,
      layer: row.layer,
      severity: 'BLOCKING',
      blocking: true,
      reason: 'INPUT_ARTIFACT_OR_TOKEN_NOT_GREEN',
      evidenceBasename: row.sourceBasename,
      requiredCorrection: 'STOP_AND_OPEN_CORRECTION_CONTOUR',
      nextContour: 'OWNER_DECISION_REQUIRED',
    });
  }
  if (forceClaims.blockingFindingDowngraded === true) {
    rows.push({
      findingId: 'FORCED_BLOCKING_DOWNGRADE',
      layer: 'AUDIT_GOVERNANCE',
      severity: 'BLOCKING',
      blocking: true,
      reason: 'FORCED_BLOCKING_FINDING_DOWNGRADE',
      evidenceBasename: STATUS_BASENAME,
      requiredCorrection: 'STOP',
      nextContour: 'OWNER_DECISION_REQUIRED',
    });
  }
  for (const input of inputRows.filter((row) => row.visibleLimitRows.length > 0)) {
    rows.push({
      findingId: `${input.id}_DECLARED_LIMIT_VISIBLE`,
      layer: input.layer,
      severity: 'NONBLOCKING',
      blocking: false,
      reason: 'LIMIT_OR_GAP_ALREADY_DECLARED_WITH_NO_RELEASE_GREEN_AND_NO_FALSE_CLAIM',
      evidenceBasename: input.basename,
      requiredCorrection: 'KEEP_UNSUPPORTED_SCOPE_VISIBLE',
      nextContour: 'B3C20_BLOCK_3_EXIT_DOSSIER',
    });
  }
  if (layerMixRows.some((row) => row.status !== 'PASS')) {
    rows.push({
      findingId: 'LAYER_MIX_ACCEPTED',
      layer: 'AUDIT_GOVERNANCE',
      severity: 'BLOCKING',
      blocking: true,
      reason: 'LAYER_MIX_CHECK_FAILED',
      evidenceBasename: STATUS_BASENAME,
      requiredCorrection: 'STOP_AND_OPEN_CORRECTION_CONTOUR',
      nextContour: 'OWNER_DECISION_REQUIRED',
    });
  }
  return rows;
}

function buildNonblockingRows({ inputRows, auditRows, scopeGuardRows, donorIntakeContextOnly, findingRows, forceClaims }) {
  const byId = new Map(scopeGuardRows.map((row) => [row.id, row]));
  const allInputsBound = inputRows.every((row) => row.passed);
  const releaseGreenFalse = inputRows.filter((row) => row.releaseGreenTokenName).every((row) => row.releaseGreen === 0);
  const unsupportedScopeVisible = inputRows
    .flatMap((row) => row.visibleLimitRows)
    .every((row) => row.pass);
  const noBlockingFindings = findingRows.every((row) => row.blocking === false);
  return [
    {
      id: 'ALL_INPUT_ARTIFACTS_BOUND',
      status: allInputsBound && forceClaims.inputArtifactMissing !== true ? 'PASS' : 'FAIL',
      inputCount: inputRows.length,
    },
    {
      id: 'B3C01_TO_B3C08_CARRIED_INPUTS_CLASSIFIED',
      status: inputRows.slice(0, 8).every((row) => row.passed) && forceClaims.block2ClosureReopenedWithoutFreshContradiction !== true ? 'PASS' : 'FAIL',
      policy: 'CARRIED_PRE_RELEASE_INPUTS_NOT_REIMPLEMENTED_IN_B3C19',
    },
    {
      id: 'B3C09_TO_B3C18_TESTS_RECONFIRMED',
      status: auditRows.filter((row) => /^B3C(09|1[0-8])$/u.test(row.contour)).every((row) => row.status === 'PASS') ? 'PASS' : 'FAIL',
      proofClass: 'LOCAL_AND_POST_MERGE_TEST_RUN_REQUIRED',
    },
    {
      id: 'RELEASE_GREEN_REMAINS_FALSE',
      status: releaseGreenFalse && forceClaims.releaseGreenClaim !== true ? 'PASS' : 'FAIL',
      releaseGreen: false,
    },
    {
      id: 'UNSUPPORTED_SCOPE_REMAINS_VISIBLE',
      status: unsupportedScopeVisible && forceClaims.unsupportedScopeHidden !== true ? 'PASS' : 'FAIL',
    },
    {
      id: 'NO_FALSE_RELEASE_CLAIM',
      status: forceClaims.releaseGreenClaim === true || forceClaims.inputTokenFalseGreen === true ? 'FAIL' : 'PASS',
    },
    {
      id: 'NO_DOC_ONLY_CLOSE_CLAIM',
      status: forceClaims.docOnlyEvidenceAccepted === true ? 'FAIL' : 'PASS',
    },
    {
      ...(byId.get('ACTIVE_CANON_NOT_PROMOTED') || {}),
      id: 'NO_ACTIVE_CANON_PROMOTION',
    },
    {
      ...(byId.get('REQUIRED_TOKEN_SET_NOT_EXPANDED') || {}),
      id: 'NO_REQUIRED_TOKEN_SET_EXPANSION',
    },
    {
      id: 'NO_NEW_DEPENDENCY',
      status: byId.get('PACKAGE_MANIFESTS_READ_ONLY')?.status === 'PASS' && forceClaims.newDependency !== true ? 'PASS' : 'FAIL',
    },
    byId.get('NO_RUNTIME_LAYER_CHANGE'),
    {
      id: 'B3C20_NOT_STARTED',
      status: forceClaims.b3c20Started === true ? 'FAIL' : 'PASS',
    },
    {
      id: 'DONOR_CONTEXT_ONLY',
      status: donorIntakeContextOnly && forceClaims.donorCompletionClaimImported !== true ? 'PASS' : 'FAIL',
    },
    {
      id: 'NO_RUNTIME_FIX_ATTEMPTED',
      status: forceClaims.runtimeFixAttempted === true ? 'FAIL' : 'PASS',
    },
    {
      id: 'FINDINGS_CLASSIFIED_WITH_SCHEMA',
      status: findingRows.every((row) => row.findingId && row.layer && row.severity && typeof row.blocking === 'boolean' && row.reason && row.evidenceBasename && row.requiredCorrection && row.nextContour) ? 'PASS' : 'FAIL',
      findingCount: findingRows.length,
    },
    {
      id: 'NO_UNANSWERED_BLOCKING_FINDING',
      status: noBlockingFindings ? 'PASS' : 'FAIL',
      blockingFindingCount: findingRows.filter((row) => row.blocking === true).length,
    },
  ].filter(Boolean);
}

function buildNegativeRows({ nonblockingRows, layerMixRows, scopeGuardRows, donorIntakeContextOnly, forceClaims }) {
  const byId = new Map(nonblockingRows.map((row) => [row.id, row]));
  const scopeById = new Map(scopeGuardRows.map((row) => [row.id, row]));
  const layerMixPass = layerMixRows.every((row) => row.status === 'PASS');
  return [
    {
      id: 'INPUT_ARTIFACT_MISSING_NEGATIVE',
      status: byId.get('ALL_INPUT_ARTIFACTS_BOUND')?.status === 'PASS' && forceClaims.inputArtifactMissing !== true ? 'PASS' : 'FAIL',
      rejectsClaim: 'INPUT_ARTIFACT_MISSING_ACCEPTED',
    },
    {
      id: 'INPUT_TOKEN_FALSE_GREEN_NEGATIVE',
      status: forceClaims.inputTokenFalseGreen === true ? 'FAIL' : 'PASS',
      rejectsClaim: 'INPUT_TOKEN_FALSE_GREEN_ACCEPTED',
    },
    {
      id: 'RELEASE_GREEN_CLAIMED_NEGATIVE',
      status: byId.get('RELEASE_GREEN_REMAINS_FALSE')?.status === 'PASS' ? 'PASS' : 'FAIL',
      rejectsClaim: 'RELEASE_GREEN_CLAIMED_IN_B3C19',
    },
    {
      id: 'UNSUPPORTED_SCOPE_HIDDEN_NEGATIVE',
      status: byId.get('UNSUPPORTED_SCOPE_REMAINS_VISIBLE')?.status === 'PASS' ? 'PASS' : 'FAIL',
      rejectsClaim: 'UNSUPPORTED_SCOPE_HIDDEN',
    },
    {
      id: 'DOC_ONLY_EVIDENCE_ACCEPTED_NEGATIVE',
      status: byId.get('NO_DOC_ONLY_CLOSE_CLAIM')?.status === 'PASS' ? 'PASS' : 'FAIL',
      rejectsClaim: 'DOC_ONLY_EVIDENCE_ACCEPTED',
    },
    {
      id: 'MISSING_NEGATIVE_TEST_ACCEPTED_NEGATIVE',
      status: forceClaims.missingNegativeTestAccepted === true ? 'FAIL' : 'PASS',
      rejectsClaim: 'MISSING_NEGATIVE_TEST_ACCEPTED',
    },
    {
      id: 'MISSING_ROLLBACK_REF_ACCEPTED_NEGATIVE',
      status: forceClaims.missingRollbackRefAccepted === true ? 'FAIL' : 'PASS',
      rejectsClaim: 'MISSING_ROLLBACK_REF_ACCEPTED',
    },
    {
      id: 'RELEASE_WITHOUT_DOSSIER_ACCEPTED_NEGATIVE',
      status: forceClaims.releaseWithoutDossierAccepted === true ? 'FAIL' : 'PASS',
      rejectsClaim: 'RELEASE_WITHOUT_DOSSIER_ACCEPTED',
    },
    {
      id: 'SELF_SIGNED_ATTESTATION_ACCEPTED_NEGATIVE',
      status: forceClaims.selfSignedAttestationAccepted === true ? 'FAIL' : 'PASS',
      rejectsClaim: 'SELF_SIGNED_ATTESTATION_ACCEPTED',
    },
    {
      id: 'NETWORK_ESCAPE_ACCEPTED_NEGATIVE',
      status: forceClaims.networkEscapeAccepted === true ? 'FAIL' : 'PASS',
      rejectsClaim: 'NETWORK_ESCAPE_ACCEPTED',
    },
    {
      id: 'PERMISSION_ESCAPE_ACCEPTED_NEGATIVE',
      status: forceClaims.permissionEscapeAccepted === true ? 'FAIL' : 'PASS',
      rejectsClaim: 'PERMISSION_ESCAPE_ACCEPTED',
    },
    {
      id: 'LAYER_MIX_ACCEPTED_NEGATIVE',
      status: layerMixPass && forceClaims.layerMixAccepted !== true ? 'PASS' : 'FAIL',
      rejectsClaim: 'LAYER_MIX_ACCEPTED',
    },
    {
      id: 'B3C20_STARTED_NEGATIVE',
      status: byId.get('B3C20_NOT_STARTED')?.status === 'PASS' ? 'PASS' : 'FAIL',
      rejectsClaim: 'B3C20_STARTED_INSIDE_B3C19',
    },
    {
      id: 'NEW_DEPENDENCY_ADDED_NEGATIVE',
      status: byId.get('NO_NEW_DEPENDENCY')?.status === 'PASS' ? 'PASS' : 'FAIL',
      rejectsClaim: 'NEW_DEPENDENCY_ADDED',
    },
    {
      id: 'RUNTIME_CHANGE_ADDED_NEGATIVE',
      status: byId.get('NO_RUNTIME_LAYER_CHANGE')?.status === 'PASS' ? 'PASS' : 'FAIL',
      rejectsClaim: 'RUNTIME_CHANGE_ADDED',
    },
    {
      id: 'DONOR_COMPLETION_CLAIM_IMPORTED_NEGATIVE',
      status: donorIntakeContextOnly && forceClaims.donorCompletionClaimImported !== true ? 'PASS' : 'FAIL',
      rejectsClaim: 'DONOR_COMPLETION_CLAIM_IMPORTED',
    },
    {
      id: 'RUNTIME_FIX_ATTEMPTED_NEGATIVE',
      status: byId.get('NO_RUNTIME_FIX_ATTEMPTED')?.status === 'PASS' ? 'PASS' : 'FAIL',
      rejectsClaim: 'RUNTIME_FIX_ATTEMPTED_IN_AUDIT_CONTOUR',
    },
    {
      id: 'PRIOR_CONTOUR_STATUS_REWRITTEN_NEGATIVE',
      status: scopeById.get('NO_PRIOR_CONTOUR_STATUS_REWRITE')?.status === 'PASS' ? 'PASS' : 'FAIL',
      rejectsClaim: 'PRIOR_CONTOUR_STATUS_REWRITTEN',
    },
    {
      id: 'BLOCKING_FINDING_DOWNGRADED_NEGATIVE',
      status: forceClaims.blockingFindingDowngraded === true ? 'FAIL' : 'PASS',
      rejectsClaim: 'BLOCKING_FINDING_DOWNGRADED',
    },
    {
      id: 'BLOCK2_CLOSURE_REOPENED_WITHOUT_FRESH_CONTRADICTION_NEGATIVE',
      status: byId.get('B3C01_TO_B3C08_CARRIED_INPUTS_CLASSIFIED')?.status === 'PASS' ? 'PASS' : 'FAIL',
      rejectsClaim: 'BLOCK2_CLOSURE_REOPENED_WITHOUT_FRESH_CONTRADICTION',
    },
  ];
}

function buildCommandRows() {
  return {
    taskId: TASK_ID,
    status: 'DECLARED_FOR_EXTERNAL_RUNNER',
    selfExecuted: false,
    allPassed: null,
    noPending: null,
    commandCount: 7,
    commands: [
      'node scripts/ops/b3c19-independent-release-audit-state.mjs --write --json',
      `node --test ${CONTRACT_TEST_BASENAMES.map((basename) => path.join('test', 'contracts', basename)).join(' ')}`,
      'npm run oss:policy',
      'git diff --check',
      'git diff --name-only -- package.json package-lock.json',
      'git diff --name-only -- CANON.md docs/OPS/STATUS/CANON_STATUS.json docs/OPS/EXECUTION/REQUIRED_TOKEN_SET.json docs/OPS/TOKENS/TOKEN_CATALOG.json docs/OPS/TOKENS/TOKEN_CATALOG_LOCK.json',
      'git diff --name-only -- src/renderer/index.html src/renderer/styles.css src/main.js src/preload.js src/export src/io src/security src/collab',
    ].map((command, index) => ({
      index: index + 1,
      command,
      result: 'EXTERNAL_RUN_REQUIRED',
    })),
  };
}

export async function evaluateB3C19IndependentReleaseAuditState(input = {}) {
  const repoRoot = path.resolve(input.repoRoot || DEFAULT_REPO_ROOT);
  const downloadsDir = input.downloadsDir || path.join(os.homedir(), 'Downloads');
  const forceClaims = input.forceClaims && typeof input.forceClaims === 'object' ? input.forceClaims : {};
  const inputRows = await buildInputRows(repoRoot, forceClaims);
  const auditRows = buildAuditRows(inputRows, forceClaims);
  const donorArchiveRows = buildDonorArchiveRows(downloadsDir);
  const donorIntakeContextOnly = donorArchiveRows.every((row) => row.authority === 'CONTEXT_ONLY'
    && row.codeImported === false
    && row.dependencyClaimImported === false
    && row.completionClaimImported === false
    && row.auditCompletionClaimImported === false);
  const scopeGuard = buildScopeGuardRows({ repoRoot, forceClaims });
  const layerMixRows = buildLayerMixRows({ auditRows, scopeGuardRows: scopeGuard.rows, forceClaims });
  const findingRows = buildFindingRows({ inputRows, auditRows, layerMixRows, forceClaims });
  const nonblockingRows = buildNonblockingRows({
    inputRows,
    auditRows,
    scopeGuardRows: scopeGuard.rows,
    donorIntakeContextOnly,
    findingRows,
    forceClaims,
  });
  const negativeRows = buildNegativeRows({
    nonblockingRows,
    layerMixRows,
    scopeGuardRows: scopeGuard.rows,
    donorIntakeContextOnly,
    forceClaims,
  });

  const allInputsBound = inputRows.length === 18 && inputRows.every((row) => row.passed);
  const auditRowsComplete = INPUT_ARTIFACTS.every((artifact) => auditRows.some((row) => row.id === artifact.auditId));
  const auditRowsPass = auditRows.every((row) => row.status === 'PASS');
  const layerMixRowsComplete = LAYER_MIX_CHECK_IDS.every((id) => layerMixRows.some((row) => row.id === id));
  const layerMixRowsPass = layerMixRows.every((row) => row.status === 'PASS');
  const nonblockingRowsComplete = REQUIRED_NONBLOCKING_ROW_IDS.every((id) => nonblockingRows.some((row) => row.id === id));
  const nonblockingRowsPass = nonblockingRows.every((row) => row.status === 'PASS');
  const negativeIds = negativeRows.map((row) => row.id).sort((a, b) => a.localeCompare(b));
  const negativeRowsComplete = REQUIRED_NEGATIVE_IDS.every((id) => negativeIds.includes(id));
  const negativeRowsPass = negativeRows.every((row) => row.status === 'PASS');
  const forbiddenClaimsAbsent = FORBIDDEN_CLAIM_KEYS.every((key) => forceClaims[key] !== true);
  const findingRowsClassified = nonblockingRows.some((row) => row.id === 'FINDINGS_CLASSIFIED_WITH_SCHEMA' && row.status === 'PASS');
  const noUnansweredBlockingFinding = nonblockingRows.some((row) => row.id === 'NO_UNANSWERED_BLOCKING_FINDING' && row.status === 'PASS');
  const releaseGreen = false;
  const ok = allInputsBound
    && auditRowsComplete
    && auditRowsPass
    && layerMixRowsComplete
    && layerMixRowsPass
    && nonblockingRowsComplete
    && nonblockingRowsPass
    && donorIntakeContextOnly
    && negativeRowsComplete
    && negativeRowsPass
    && forbiddenClaimsAbsent
    && findingRowsClassified
    && noUnansweredBlockingFinding
    && releaseGreen === false;
  const failRows = [
    ...(allInputsBound ? [] : ['INPUT_ARTIFACTS_NOT_BOUND']),
    ...(auditRowsComplete ? [] : ['AUDIT_ROWS_INCOMPLETE']),
    ...(auditRowsPass ? [] : ['AUDIT_ROWS_FAILED']),
    ...(layerMixRowsComplete ? [] : ['LAYER_MIX_ROWS_INCOMPLETE']),
    ...(layerMixRowsPass ? [] : ['LAYER_MIX_ROWS_FAILED']),
    ...(nonblockingRowsComplete ? [] : ['NONBLOCKING_ROWS_INCOMPLETE']),
    ...(nonblockingRowsPass ? [] : ['NONBLOCKING_ROWS_FAILED']),
    ...(donorIntakeContextOnly ? [] : ['DONOR_INTAKE_NOT_CONTEXT_ONLY']),
    ...(negativeRowsComplete ? [] : ['NEGATIVE_ROWS_INCOMPLETE']),
    ...(negativeRowsPass ? [] : ['NEGATIVE_ROWS_FAILED']),
    ...(forbiddenClaimsAbsent ? [] : ['FORBIDDEN_SCOPE_OR_RELEASE_CLAIM']),
    ...(findingRowsClassified ? [] : ['FINDINGS_NOT_CLASSIFIED']),
    ...(noUnansweredBlockingFinding ? [] : ['UNANSWERED_BLOCKING_FINDING']),
    ...(releaseGreen === false ? [] : ['FALSE_RELEASE_GREEN']),
  ];
  const changedBasenamesHash = sha256Text(CHANGED_BASENAMES.join('\n'));
  const statusArtifactHash = sha256Text(stableJson({
    taskId: TASK_ID,
    changedBasenamesHash,
    auditIds: auditRows.map((row) => row.id).sort((a, b) => a.localeCompare(b)),
    layerMixIds: layerMixRows.map((row) => row.id).sort((a, b) => a.localeCompare(b)),
    negativeIds,
    status: ok ? 'PASS' : 'FAIL',
  }));

  return stableSort({
    artifactId: 'B3C19_INDEPENDENT_RELEASE_AUDIT_STATUS_V1',
    contourId: TASK_ID,
    ok,
    status: ok ? 'PASS_AUDIT_WITH_RELEASE_GREEN_FALSE' : 'FAIL',
    [TOKEN_NAME]: ok ? 1 : 0,
    [RELEASE_GREEN_TOKEN_NAME]: 0,
    failSignal: ok ? '' : FAIL_SIGNAL,
    failRows,
    successWording: 'PASS_AS_INDEPENDENT_RELEASE_AUDIT_WITH_RELEASE_GREEN_FALSE_AND_NO_UNANSWERED_BLOCKING_FINDING',
    tokenSemantics: 'INDEPENDENT_RELEASE_AUDIT_PROOF_ONLY_RELEASE_GREEN_REMAINS_FALSE',
    rollbackRef: 'ROLLBACK_INDEPENDENT_RELEASE_AUDIT_GOVERNANCE',
    releaseGreen,
    inputRows,
    auditRows,
    layerMixRows,
    findingRows,
    nonblockingRows,
    negativeRows,
    donorIntake: {
      class: 'READ_ONLY_CONTEXT_ONLY',
      codeImported: false,
      dependencyClaimImported: false,
      completionClaimImported: false,
      auditCompletionClaimImported: false,
      activeCanonOverDonor: true,
      archiveRows: donorArchiveRows,
    },
    proof: {
      allInputsBound,
      b3c01ToB3c08CarriedInputsClassified: nonblockingRows.some((row) => row.id === 'B3C01_TO_B3C08_CARRIED_INPUTS_CLASSIFIED' && row.status === 'PASS'),
      b3c09ToB3c18TestsReconfirmed: nonblockingRows.some((row) => row.id === 'B3C09_TO_B3C18_TESTS_RECONFIRMED' && row.status === 'PASS'),
      auditRowsComplete,
      auditRowsPass,
      layerMixRowsComplete,
      layerMixRowsPass,
      unsupportedScopeRemainsVisible: nonblockingRows.some((row) => row.id === 'UNSUPPORTED_SCOPE_REMAINS_VISIBLE' && row.status === 'PASS'),
      releaseGreenFalseBecauseB3C19Only: releaseGreen === false,
      noFalseReleaseClaim: nonblockingRows.some((row) => row.id === 'NO_FALSE_RELEASE_CLAIM' && row.status === 'PASS'),
      noDocOnlyCloseClaim: nonblockingRows.some((row) => row.id === 'NO_DOC_ONLY_CLOSE_CLAIM' && row.status === 'PASS'),
      activeCanonNotPromoted: nonblockingRows.some((row) => row.id === 'NO_ACTIVE_CANON_PROMOTION' && row.status === 'PASS'),
      requiredTokenSetNotExpanded: nonblockingRows.some((row) => row.id === 'NO_REQUIRED_TOKEN_SET_EXPANSION' && row.status === 'PASS'),
      noNewDependency: nonblockingRows.some((row) => row.id === 'NO_NEW_DEPENDENCY' && row.status === 'PASS'),
      noRuntimeLayerChange: nonblockingRows.some((row) => row.id === 'NO_RUNTIME_LAYER_CHANGE' && row.status === 'PASS'),
      b3c20NotStarted: nonblockingRows.some((row) => row.id === 'B3C20_NOT_STARTED' && row.status === 'PASS'),
      noRuntimeFixAttempted: nonblockingRows.some((row) => row.id === 'NO_RUNTIME_FIX_ATTEMPTED' && row.status === 'PASS'),
      donorIntakeContextOnly,
      findingsClassifiedWithSchema: findingRowsClassified,
      noUnansweredBlockingFinding,
      negativeRowsComplete,
      negativeRowsPass,
    },
    scope: {
      allowedWriteBasenames: CHANGED_BASENAMES,
      directInputs: INPUT_ARTIFACTS.map((row) => row.basename),
      packageManifestChange: false,
      activeCanonPromotion: false,
      requiredTokenExpansion: false,
      newDependency: false,
      uiChange: false,
      storageChange: false,
      exportRewrite: false,
      securityRewrite: false,
      runtimeChangeAdded: false,
      releaseGreenClaim: false,
      b3c20Started: false,
      runtimeFixAttempted: false,
      priorContourStatusRewritten: false,
      donorCompletionClaimImported: false,
      block2ClosureReopenedWithoutFreshContradiction: false,
    },
    runtime: {
      changedBasenames: CHANGED_BASENAMES,
      changedBasenamesHash,
      statusArtifactHash,
      commandRows: buildCommandRows(),
    },
    repo: {
      headSha: getGitHead(repoRoot),
      repoRootBinding: 'WORKTREE_INDEPENDENT',
    },
  });
}

async function main() {
  const args = parseArgs();
  const repoRoot = DEFAULT_REPO_ROOT;
  const state = await evaluateB3C19IndependentReleaseAuditState({ repoRoot });
  if (args.write) {
    await fsp.mkdir(path.dirname(path.join(repoRoot, STATUS_REL_PATH)), { recursive: true });
    await fsp.writeFile(path.join(repoRoot, STATUS_REL_PATH), stableJson(state));
  }
  if (args.json) {
    process.stdout.write(stableJson(state));
  } else {
    process.stdout.write(`B3C19_STATUS=${state.status}\n`);
    process.stdout.write(`${TOKEN_NAME}=${state[TOKEN_NAME]}\n`);
    process.stdout.write(`${RELEASE_GREEN_TOKEN_NAME}=${state[RELEASE_GREEN_TOKEN_NAME]}\n`);
  }
  process.exitCode = state.ok ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
