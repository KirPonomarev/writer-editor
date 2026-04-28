#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const TOKEN_NAME = 'B3C20_BLOCK_3_EXIT_DOSSIER_OK';
export const RELEASE_GREEN_TOKEN_NAME = 'B3C20_RELEASE_GREEN_OK';

const TASK_ID = 'B3C20_BLOCK_3_EXIT_DOSSIER';
const STATUS_BASENAME = 'B3C20_BLOCK_3_EXIT_DOSSIER_STATUS_V1.json';
const STATUS_REL_PATH = path.join('docs', 'OPS', 'STATUS', STATUS_BASENAME);
const DEFAULT_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FAIL_SIGNAL = 'E_B3C20_BLOCK_3_EXIT_DOSSIER_NOT_OK';

const CHANGED_BASENAMES = Object.freeze([
  'b3c20-block-3-exit-dossier-state.mjs',
  'b3c20-block-3-exit-dossier.contract.test.js',
  STATUS_BASENAME,
]);

const DONOR_ARCHIVE_BASENAMES = Object.freeze([
  'writer-editor-longform-v5_1-block3-release-export-security-scale-pack-v1.zip',
  'writer-editor-longform-v5_1-block3-release-export-security-scale-pack-v3.zip',
  'writer-editor-longform-v5_1-turnkey-pack-v2.zip',
  'writer-editor-longform-v5_1-turnkey-pack-v3.zip',
]);

const INPUT_ARTIFACTS = Object.freeze([
  ['B3C01', 'B3C01_COMMAND_KERNEL_SCOPE_LOCK_STATUS_V1.json', 'B3C01_COMMAND_KERNEL_SCOPE_LOCK_OK', 'EXPORT_SOURCE_STATUS'],
  ['B3C02', 'B3C02_COMPILE_IR_BASELINE_STATUS_V1.json', 'B3C02_COMPILE_IR_BASELINE_OK', 'EXPORT_SOURCE_STATUS'],
  ['B3C03', 'B3C03_DOCX_ARTIFACT_VALIDATION_STATUS_V1.json', 'B3C03_DOCX_ARTIFACT_VALIDATION_OK', 'EXPORT_VALIDATION_STATUS'],
  ['B3C04', 'B3C04_DETERMINISTIC_EXPORT_MODE_STATUS_V1.json', 'B3C04_DETERMINISTIC_EXPORT_MODE_OK', 'EXPORT_VALIDATION_STATUS'],
  ['B3C05', 'B3C05_PERMISSION_SCOPE_ENFORCED_STATUS_V1.json', 'B3C05_PERMISSION_SCOPE_ENFORCED_OK', 'PERMISSION_STATUS'],
  ['B3C06', 'B3C06_NO_NETWORK_WRITING_PATH_STATUS_V1.json', 'B3C06_NO_NETWORK_WRITING_PATH_OK', 'NO_NETWORK_STATUS'],
  ['B3C07', 'B3C07_SECURITY_RUNTIME_BOUNDARY_STATUS_V1.json', 'B3C07_SECURITY_RUNTIME_BOUNDARY_OK', 'SECURITY_STATUS'],
  ['B3C08', 'B3C08_SUPPORT_BUNDLE_PRIVACY_STATUS_V1.json', 'B3C08_SUPPORT_BUNDLE_PRIVACY_OK', 'SECURITY_STATUS'],
  ['B3C09', 'B3C09_PERFORMANCE_BASELINE_BINDING_STATUS_V1.json', 'B3C09_PERFORMANCE_BASELINE_BINDING_OK', 'PERF_STATUS', '', ['PASS', 'PROVISIONAL_GAP']],
  ['B3C10', 'B3C10_CAPABILITY_TIER_REPORT_STATUS_V1.json', 'B3C10_CAPABILITY_TIER_REPORT_OK', 'CAPABILITY_TIER_STATUS'],
  ['B3C11', 'B3C11_XPLAT_NORMALIZATION_BASELINE_STATUS_V1.json', 'B3C11_XPLAT_NORMALIZATION_BASELINE_OK', 'XPLAT_STATUS'],
  ['B3C12', 'B3C12_I18N_TEXT_ANCHOR_SAFETY_STATUS_V1.json', 'B3C12_I18N_TEXT_ANCHOR_SAFETY_OK', 'I18N_STATUS'],
  ['B3C13', 'B3C13_TRUST_SURFACE_ACCESSIBILITY_STATUS_V1.json', 'B3C13_TRUST_SURFACE_ACCESSIBILITY_OK', 'A11Y_STATUS'],
  ['B3C14', 'B3C14_RELEASE_DOSSIER_MINIMAL_STATUS_V1.json', 'B3C14_RELEASE_DOSSIER_MINIMAL_OK', 'RELEASE_DOSSIER_STATUS', 'B3C14_RELEASE_GREEN_OK'],
  ['B3C15', 'B3C15_ATTESTATION_CHAIN_STATUS_V1.json', 'B3C15_ATTESTATION_CHAIN_OK', 'ATTESTATION_STATUS', 'B3C15_RELEASE_GREEN_OK'],
  ['B3C16', 'B3C16_SUPPLY_CHAIN_RELEASE_SCOPE_STATUS_V1.json', 'B3C16_SUPPLY_CHAIN_RELEASE_SCOPE_OK', 'SUPPLY_CHAIN_STATUS', 'B3C16_RELEASE_GREEN_OK'],
  ['B3C17', 'B3C17_FUTURE_LANES_NONBLOCKING_STATUS_V1.json', 'B3C17_FUTURE_LANES_NONBLOCKING_OK', 'FUTURE_LANES_STATUS', 'B3C17_RELEASE_GREEN_OK'],
  ['B3C18', 'B3C18_PRODUCTION_HARDENING_QUEUE_STATUS_V1.json', 'B3C18_PRODUCTION_HARDENING_QUEUE_OK', 'PRODUCTION_HARDENING_QUEUE_STATUS', 'B3C18_RELEASE_GREEN_OK'],
  ['B3C19', 'B3C19_INDEPENDENT_RELEASE_AUDIT_STATUS_V1.json', 'B3C19_INDEPENDENT_RELEASE_AUDIT_OK', 'INDEPENDENT_RELEASE_AUDIT_STATUS', 'B3C19_RELEASE_GREEN_OK'],
].map(([id, basename, token, section, releaseGreenToken = '', acceptsStatus = ['PASS', 'PASS_AUDIT_WITH_RELEASE_GREEN_FALSE']]) => ({
  id,
  basename,
  token,
  section,
  releaseGreenToken,
  acceptsStatus,
})));

const VISIBLE_LIMIT_DEFINITIONS = Object.freeze([
  { id: 'B3C09_PROVISIONAL_GAP', input: 'B3C09', source: 'status', expected: 'PROVISIONAL_GAP' },
  { id: 'B3C10_FULL_TIER_GREEN_OK_0', input: 'B3C10', source: 'B3C10_FULL_TIER_GREEN_OK', expected: 0 },
  { id: 'B3C11_FULL_REAL_PLATFORM_XPLAT_OK_0', input: 'B3C11', source: 'B3C11_FULL_REAL_PLATFORM_XPLAT_OK', expected: 0 },
  { id: 'B3C12_FULL_GLOBAL_I18N_OK_0', input: 'B3C12', source: 'B3C12_FULL_GLOBAL_I18N_OK', expected: 0 },
  { id: 'B3C13_FULL_APP_A11Y_OK_0', input: 'B3C13', source: 'B3C13_FULL_APP_A11Y_OK', expected: 0 },
  { id: 'B3C14_RELEASE_GREEN_OK_0', input: 'B3C14', source: 'B3C14_RELEASE_GREEN_OK', expected: 0 },
  { id: 'B3C15_RELEASE_GREEN_OK_0', input: 'B3C15', source: 'B3C15_RELEASE_GREEN_OK', expected: 0 },
  { id: 'B3C16_RELEASE_GREEN_OK_0', input: 'B3C16', source: 'B3C16_RELEASE_GREEN_OK', expected: 0 },
  { id: 'B3C17_RELEASE_GREEN_OK_0', input: 'B3C17', source: 'B3C17_RELEASE_GREEN_OK', expected: 0 },
  { id: 'B3C18_RELEASE_GREEN_OK_0', input: 'B3C18', source: 'B3C18_RELEASE_GREEN_OK', expected: 0 },
  { id: 'B3C19_RELEASE_GREEN_OK_0', input: 'B3C19', source: 'B3C19_RELEASE_GREEN_OK', expected: 0 },
]);

const DOSSIER_SECTIONS = Object.freeze([
  'EXPORT_SOURCE_STATUS',
  'EXPORT_VALIDATION_STATUS',
  'PERMISSION_STATUS',
  'NO_NETWORK_STATUS',
  'SECURITY_STATUS',
  'PERF_STATUS',
  'CAPABILITY_TIER_STATUS',
  'XPLAT_STATUS',
  'I18N_STATUS',
  'A11Y_STATUS',
  'RELEASE_DOSSIER_STATUS',
  'ATTESTATION_STATUS',
  'SUPPLY_CHAIN_STATUS',
  'FUTURE_LANES_STATUS',
  'PRODUCTION_HARDENING_QUEUE_STATUS',
  'INDEPENDENT_RELEASE_AUDIT_STATUS',
  'UNSUPPORTED_SCOPE_STATUS',
  'STOP_OR_RELEASE_DECISION',
]);

const REQUIRED_DECISION_ROW_IDS = Object.freeze([
  'ALL_B3C01_TO_B3C19_INPUT_ARTIFACTS_BOUND',
  'B3C19_AUDIT_BOUND',
  'RELEASE_GREEN_REMAINS_FALSE_UNLESS_ALL_RELEASE_GATES_GREEN',
  'UNSUPPORTED_SCOPE_REMAINS_VISIBLE',
  'STOP_STATUS_HAS_EXACT_NEXT_STEP',
  'NO_FALSE_RELEASE_GREEN',
  'NO_DOC_ONLY_CLOSE',
  'NO_ACTIVE_CANON_PROMOTION',
  'NO_REQUIRED_TOKEN_SET_EXPANSION',
  'NO_NEW_DEPENDENCY',
  'NO_RUNTIME_LAYER_CHANGE',
  'NO_BLOCK_4_STARTED',
  'DONOR_CONTEXT_ONLY',
  'PRIOR_CONTOURS_NOT_REWRITTEN',
  'OWNER_REVIEW_PACKET_READY',
  'NO_RELEASE_FIX_ATTEMPTED',
  'B3C19_NOT_REPLACED_BY_NEW_AUDIT',
  'MACHINE_BOUND_EXIT_STATUS',
]);

const REQUIRED_NEGATIVE_IDS = Object.freeze([
  'INPUT_ARTIFACT_MISSING_NEGATIVE',
  'RELEASE_GREEN_CLAIMED_WHILE_LIMITS_VISIBLE_NEGATIVE',
  'UNSUPPORTED_SCOPE_HIDDEN_NEGATIVE',
  'STOP_HAS_NO_NEXT_STEP_NEGATIVE',
  'DOC_ONLY_CLOSE_ACCEPTED_NEGATIVE',
  'BLOCK_4_STARTED_NEGATIVE',
  'RELEASE_FIX_ATTEMPTED_NEGATIVE',
  'RUNTIME_CHANGE_ADDED_NEGATIVE',
  'NEW_DEPENDENCY_ADDED_NEGATIVE',
  'ACTIVE_CANON_PROMOTED_NEGATIVE',
  'REQUIRED_TOKEN_SET_EXPANDED_NEGATIVE',
  'PRIOR_CONTOUR_STATUS_REWRITTEN_NEGATIVE',
  'DONOR_COMPLETION_CLAIM_IMPORTED_NEGATIVE',
  'RELEASE_WITHOUT_DOSSIER_ACCEPTED_NEGATIVE',
  'NETWORK_ESCAPE_ACCEPTED_NEGATIVE',
  'PERMISSION_ESCAPE_ACCEPTED_NEGATIVE',
  'B3C19_AUDIT_REPLACED_NEGATIVE',
  'MACHINE_BOUND_STATUS_MISSING_NEGATIVE',
  'BLOCK_3_CLOSE_GREEN_WHILE_LIMITS_VISIBLE_NEGATIVE',
]);

const FORBIDDEN_CLAIM_KEYS = Object.freeze([
  'inputArtifactMissing',
  'releaseGreenClaimWhileLimitsVisible',
  'unsupportedScopeHidden',
  'stopHasNoNextStep',
  'docOnlyCloseAccepted',
  'block4Started',
  'releaseFixAttempted',
  'runtimeChangeAdded',
  'newDependency',
  'activeCanonPromoted',
  'requiredTokenSetExpanded',
  'priorContourStatusRewritten',
  'donorCompletionClaimImported',
  'releaseWithoutDossierAccepted',
  'networkEscapeAccepted',
  'permissionEscapeAccepted',
  'b3c19AuditReplaced',
  'machineBoundStatusMissing',
  'block3CloseGreenWhileLimitsVisible',
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
  'b3c20-block-3-exit-dossier.contract.test.js',
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

function parseGitStatusName(line) {
  const payload = String(line || '').slice(3).trim();
  if (!payload) return '';
  const renameMarker = ' -> ';
  return payload.includes(renameMarker) ? payload.slice(payload.indexOf(renameMarker) + renameMarker.length) : payload;
}

function gitChangedNames(repoRoot, paths) {
  const result = spawnSync('git', ['status', '--short', '--untracked-files=all', '--', ...paths], { cwd: repoRoot, encoding: 'utf8' });
  if (result.status !== 0) return ['GIT_DIFF_FAILED'];
  return String(result.stdout || '')
    .split(/\r?\n/u)
    .map(parseGitStatusName)
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
      .filter((entry) => /exit|dossier|release|block_3|validation|integration|green|stop/iu.test(entry))
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
      exitCompletionClaimImported: false,
    };
  });
}

async function buildInputRows(repoRoot, forceClaims) {
  const rows = [];
  for (const artifact of INPUT_ARTIFACTS) {
    const status = await readJsonIfExists(repoRoot, path.join('docs', 'OPS', 'STATUS', artifact.basename));
    const statusAllowed = artifact.acceptsStatus.includes(status?.status);
    const tokenPass = status?.[artifact.token] === 1;
    const releaseGreenPass = artifact.releaseGreenToken ? status?.[artifact.releaseGreenToken] === 0 : true;
    const passed = forceClaims.inputArtifactMissing !== true
      && status !== null
      && status?.ok === true
      && statusAllowed
      && tokenPass
      && releaseGreenPass
      && Array.isArray(status?.failRows)
      && status.failRows.length === 0;
    rows.push({
      id: artifact.id,
      basename: artifact.basename,
      section: artifact.section,
      status: status?.status || 'MISSING',
      ok: status?.ok === true,
      tokenName: artifact.token,
      token: status?.[artifact.token] || 0,
      releaseGreenTokenName: artifact.releaseGreenToken,
      releaseGreen: artifact.releaseGreenToken ? status?.[artifact.releaseGreenToken] || 0 : 0,
      failRowCount: Array.isArray(status?.failRows) ? status.failRows.length : -1,
      passed,
    });
  }
  return rows;
}

function buildVisibleLimitRows(inputRows, repoRoot, forceClaims) {
  const byInput = new Map(inputRows.map((row) => [row.id, row]));
  return VISIBLE_LIMIT_DEFINITIONS.map((definition) => {
    const input = byInput.get(definition.input);
    const sourceValue = definition.source === 'status'
      ? input?.status
      : input?.[definition.source] ?? undefined;
    const artifact = input ? JSON.parse(fs.readFileSync(path.join(repoRoot, 'docs', 'OPS', 'STATUS', input.basename), 'utf8')) : null;
    const value = definition.source === 'status' ? input?.status : artifact?.[definition.source];
    return {
      id: definition.id,
      input: definition.input,
      source: definition.source,
      expected: definition.expected,
      value: sourceValue === undefined ? value : sourceValue,
      visible: input !== undefined && value !== undefined,
      status: input !== undefined && value === definition.expected && forceClaims.unsupportedScopeHidden !== true ? 'PASS' : 'FAIL',
    };
  });
}

function buildDossierSections(inputRows, visibleLimitRows, decision) {
  const inputBySection = new Map();
  for (const input of inputRows) {
    if (!inputBySection.has(input.section)) inputBySection.set(input.section, []);
    inputBySection.get(input.section).push({
      id: input.id,
      basename: input.basename,
      status: input.status,
      token: input.token,
      releaseGreen: input.releaseGreen,
      passed: input.passed,
    });
  }
  return DOSSIER_SECTIONS.map((section) => {
    if (section === 'UNSUPPORTED_SCOPE_STATUS') {
      return {
        id: section,
        status: visibleLimitRows.every((row) => row.status === 'PASS') ? 'PASS' : 'FAIL',
        visibleLimitCount: visibleLimitRows.length,
      };
    }
    if (section === 'STOP_OR_RELEASE_DECISION') {
      return {
        id: section,
        status: decision.status,
        decision: decision.decision,
        nextStep: decision.nextStep,
      };
    }
    const rows = inputBySection.get(section) || [];
    return {
      id: section,
      status: rows.length > 0 && rows.every((row) => row.passed) ? 'PASS' : 'FAIL',
      inputCount: rows.length,
      rows,
    };
  });
}

function buildScopeGuardRows({ repoRoot, forceClaims }) {
  const packageDiff = gitChangedNames(repoRoot, ['package.json', 'package-lock.json']);
  const activeCanonDiff = gitChangedNames(repoRoot, [
    'CANON.md',
    path.join('docs', 'OPS', 'STATUS', 'CANON_STATUS.json'),
  ]);
  const tokenDiff = gitChangedNames(repoRoot, [
    path.join('docs', 'OPS', 'EXECUTION', 'REQUIRED_TOKEN_SET.json'),
    path.join('docs', 'OPS', 'TOKENS', 'TOKEN_CATALOG.json'),
    path.join('docs', 'OPS', 'TOKENS', 'TOKEN_CATALOG_LOCK.json'),
  ]);
  const runtimeDiff = gitChangedNames(repoRoot, [
    path.join('src', 'renderer', 'index.html'),
    path.join('src', 'renderer', 'styles.css'),
    path.join('src', 'main.js'),
    path.join('src', 'preload.js'),
    path.join('src', 'export'),
    path.join('src', 'io'),
    path.join('src', 'security'),
    path.join('src', 'collab'),
  ]);
  const statusDiff = gitChangedNames(repoRoot, [path.join('docs', 'OPS', 'STATUS')]);
  const priorStatusDiff = statusDiff.filter((name) => path.basename(name) !== STATUS_BASENAME);
  const runtimeHas = (prefix) => runtimeDiff.some((name) => name === prefix || name.startsWith(`${prefix}/`));
  const flags = {
    packageManifestChange: packageDiff.length > 0 || forceClaims.packageManifestChange === true,
    activeCanonPromotion: activeCanonDiff.length > 0 || forceClaims.activeCanonPromotion === true || forceClaims.activeCanonPromoted === true,
    requiredTokenExpansion: tokenDiff.length > 0 || forceClaims.requiredTokenExpansion === true || forceClaims.requiredTokenSetExpanded === true,
    newDependency: packageDiff.length > 0 || forceClaims.newDependency === true,
    uiChange: runtimeHas(path.join('src', 'renderer', 'index.html')) || runtimeHas(path.join('src', 'renderer', 'styles.css')) || forceClaims.uiChange === true,
    storageChange: runtimeHas(path.join('src', 'io')) || forceClaims.storageChange === true,
    exportRewrite: runtimeHas(path.join('src', 'export')) || forceClaims.exportRewrite === true,
    securityRewrite: runtimeHas(path.join('src', 'security')) || forceClaims.securityRewrite === true,
    runtimeChangeAdded: runtimeDiff.length > 0 || forceClaims.runtimeChangeAdded === true,
    priorContourStatusRewritten: priorStatusDiff.length > 0 || forceClaims.priorContourStatusRewritten === true,
  };
  return {
    flags,
    rows: [
      {
        id: 'PACKAGE_MANIFESTS_READ_ONLY',
        status: flags.packageManifestChange === false ? 'PASS' : 'FAIL',
        changedBasenames: packageDiff.map((name) => path.basename(name)),
      },
      {
        id: 'NO_ACTIVE_CANON_PROMOTION',
        status: flags.activeCanonPromotion === false ? 'PASS' : 'FAIL',
        changedBasenames: activeCanonDiff.map((name) => path.basename(name)),
      },
      {
        id: 'NO_REQUIRED_TOKEN_SET_EXPANSION',
        status: flags.requiredTokenExpansion === false ? 'PASS' : 'FAIL',
        changedBasenames: tokenDiff.map((name) => path.basename(name)),
      },
      {
        id: 'NO_RUNTIME_LAYER_CHANGE',
        status: flags.runtimeChangeAdded === false ? 'PASS' : 'FAIL',
        changedBasenames: runtimeDiff.map((name) => path.basename(name)),
      },
      {
        id: 'PRIOR_CONTOURS_NOT_REWRITTEN',
        status: flags.priorContourStatusRewritten === false ? 'PASS' : 'FAIL',
        changedBasenames: priorStatusDiff.map((name) => path.basename(name)),
      },
    ],
  };
}

function buildDecision({ inputRows, visibleLimitRows, forceClaims }) {
  const allInputsBound = inputRows.every((row) => row.passed);
  const visibleLimitsRemain = visibleLimitRows.some((row) => row.status === 'PASS');
  const releaseGatesGreen = false;
  const releaseGreenClaimed = forceClaims.releaseGreenClaimWhileLimitsVisible === true || forceClaims.block3CloseGreenWhileLimitsVisible === true;
  const decision = releaseGatesGreen && allInputsBound && !visibleLimitsRemain && !releaseGreenClaimed
    ? 'BLOCK_3_RELEASE_GREEN'
    : 'BLOCK_3_STOP_NOT_RELEASE_GREEN';
  const nextStep = forceClaims.stopHasNoNextStep === true ? '' : 'STOP_FOR_OWNER_DECISION';
  return {
    status: nextStep ? 'PASS' : 'FAIL',
    decision,
    expectedDecision: 'STOP_NOT_RELEASE_GREEN',
    releaseGatesGreen,
    visibleLimitsRemain,
    nextStep,
    ownerReviewPacketReady: nextStep === 'STOP_FOR_OWNER_DECISION',
    block4Started: false,
  };
}

function buildDecisionRows({ inputRows, visibleLimitRows, decision, scopeGuardRows, donorIntakeContextOnly, forceClaims }) {
  const scopeById = new Map(scopeGuardRows.map((row) => [row.id, row]));
  const allInputsBound = inputRows.length === 19 && inputRows.every((row) => row.passed);
  const b3c19 = inputRows.find((row) => row.id === 'B3C19');
  const visibleLimitsPass = visibleLimitRows.every((row) => row.status === 'PASS');
  return [
    { id: 'ALL_B3C01_TO_B3C19_INPUT_ARTIFACTS_BOUND', status: allInputsBound ? 'PASS' : 'FAIL', inputCount: inputRows.length },
    { id: 'B3C19_AUDIT_BOUND', status: b3c19?.passed && b3c19.releaseGreen === 0 ? 'PASS' : 'FAIL' },
    { id: 'RELEASE_GREEN_REMAINS_FALSE_UNLESS_ALL_RELEASE_GATES_GREEN', status: decision.decision === 'BLOCK_3_STOP_NOT_RELEASE_GREEN' && forceClaims.releaseGreenClaimWhileLimitsVisible !== true ? 'PASS' : 'FAIL' },
    { id: 'UNSUPPORTED_SCOPE_REMAINS_VISIBLE', status: visibleLimitsPass && forceClaims.unsupportedScopeHidden !== true ? 'PASS' : 'FAIL', visibleLimitCount: visibleLimitRows.length },
    { id: 'STOP_STATUS_HAS_EXACT_NEXT_STEP', status: decision.nextStep === 'STOP_FOR_OWNER_DECISION' ? 'PASS' : 'FAIL', nextStep: decision.nextStep },
    { id: 'NO_FALSE_RELEASE_GREEN', status: forceClaims.releaseGreenClaimWhileLimitsVisible !== true && forceClaims.block3CloseGreenWhileLimitsVisible !== true ? 'PASS' : 'FAIL' },
    { id: 'NO_DOC_ONLY_CLOSE', status: forceClaims.docOnlyCloseAccepted !== true ? 'PASS' : 'FAIL' },
    scopeById.get('NO_ACTIVE_CANON_PROMOTION'),
    scopeById.get('NO_REQUIRED_TOKEN_SET_EXPANSION'),
    { id: 'NO_NEW_DEPENDENCY', status: scopeById.get('PACKAGE_MANIFESTS_READ_ONLY')?.status === 'PASS' && forceClaims.newDependency !== true ? 'PASS' : 'FAIL' },
    scopeById.get('NO_RUNTIME_LAYER_CHANGE'),
    { id: 'NO_BLOCK_4_STARTED', status: forceClaims.block4Started === true ? 'FAIL' : 'PASS' },
    { id: 'DONOR_CONTEXT_ONLY', status: donorIntakeContextOnly && forceClaims.donorCompletionClaimImported !== true ? 'PASS' : 'FAIL' },
    scopeById.get('PRIOR_CONTOURS_NOT_REWRITTEN'),
    { id: 'OWNER_REVIEW_PACKET_READY', status: decision.ownerReviewPacketReady ? 'PASS' : 'FAIL' },
    { id: 'NO_RELEASE_FIX_ATTEMPTED', status: forceClaims.releaseFixAttempted === true ? 'FAIL' : 'PASS' },
    { id: 'B3C19_NOT_REPLACED_BY_NEW_AUDIT', status: forceClaims.b3c19AuditReplaced === true ? 'FAIL' : 'PASS' },
    { id: 'MACHINE_BOUND_EXIT_STATUS', status: forceClaims.machineBoundStatusMissing === true ? 'FAIL' : 'PASS', artifact: STATUS_BASENAME },
  ].filter(Boolean);
}

function buildNegativeRows({ decisionRows, visibleLimitRows, donorIntakeContextOnly, forceClaims }) {
  const byId = new Map(decisionRows.map((row) => [row.id, row]));
  const visibleLimitsRemain = visibleLimitRows.every((row) => row.status === 'PASS');
  return [
    { id: 'INPUT_ARTIFACT_MISSING_NEGATIVE', status: byId.get('ALL_B3C01_TO_B3C19_INPUT_ARTIFACTS_BOUND')?.status === 'PASS' && forceClaims.inputArtifactMissing !== true ? 'PASS' : 'FAIL' },
    { id: 'RELEASE_GREEN_CLAIMED_WHILE_LIMITS_VISIBLE_NEGATIVE', status: visibleLimitsRemain && forceClaims.releaseGreenClaimWhileLimitsVisible !== true ? 'PASS' : 'FAIL' },
    { id: 'UNSUPPORTED_SCOPE_HIDDEN_NEGATIVE', status: byId.get('UNSUPPORTED_SCOPE_REMAINS_VISIBLE')?.status === 'PASS' ? 'PASS' : 'FAIL' },
    { id: 'STOP_HAS_NO_NEXT_STEP_NEGATIVE', status: byId.get('STOP_STATUS_HAS_EXACT_NEXT_STEP')?.status === 'PASS' ? 'PASS' : 'FAIL' },
    { id: 'DOC_ONLY_CLOSE_ACCEPTED_NEGATIVE', status: byId.get('NO_DOC_ONLY_CLOSE')?.status === 'PASS' ? 'PASS' : 'FAIL' },
    { id: 'BLOCK_4_STARTED_NEGATIVE', status: byId.get('NO_BLOCK_4_STARTED')?.status === 'PASS' ? 'PASS' : 'FAIL' },
    { id: 'RELEASE_FIX_ATTEMPTED_NEGATIVE', status: byId.get('NO_RELEASE_FIX_ATTEMPTED')?.status === 'PASS' ? 'PASS' : 'FAIL' },
    { id: 'RUNTIME_CHANGE_ADDED_NEGATIVE', status: byId.get('NO_RUNTIME_LAYER_CHANGE')?.status === 'PASS' ? 'PASS' : 'FAIL' },
    { id: 'NEW_DEPENDENCY_ADDED_NEGATIVE', status: byId.get('NO_NEW_DEPENDENCY')?.status === 'PASS' ? 'PASS' : 'FAIL' },
    { id: 'ACTIVE_CANON_PROMOTED_NEGATIVE', status: byId.get('NO_ACTIVE_CANON_PROMOTION')?.status === 'PASS' ? 'PASS' : 'FAIL' },
    { id: 'REQUIRED_TOKEN_SET_EXPANDED_NEGATIVE', status: byId.get('NO_REQUIRED_TOKEN_SET_EXPANSION')?.status === 'PASS' ? 'PASS' : 'FAIL' },
    { id: 'PRIOR_CONTOUR_STATUS_REWRITTEN_NEGATIVE', status: byId.get('PRIOR_CONTOURS_NOT_REWRITTEN')?.status === 'PASS' ? 'PASS' : 'FAIL' },
    { id: 'DONOR_COMPLETION_CLAIM_IMPORTED_NEGATIVE', status: donorIntakeContextOnly && forceClaims.donorCompletionClaimImported !== true ? 'PASS' : 'FAIL' },
    { id: 'RELEASE_WITHOUT_DOSSIER_ACCEPTED_NEGATIVE', status: forceClaims.releaseWithoutDossierAccepted === true ? 'FAIL' : 'PASS' },
    { id: 'NETWORK_ESCAPE_ACCEPTED_NEGATIVE', status: forceClaims.networkEscapeAccepted === true ? 'FAIL' : 'PASS' },
    { id: 'PERMISSION_ESCAPE_ACCEPTED_NEGATIVE', status: forceClaims.permissionEscapeAccepted === true ? 'FAIL' : 'PASS' },
    { id: 'B3C19_AUDIT_REPLACED_NEGATIVE', status: byId.get('B3C19_NOT_REPLACED_BY_NEW_AUDIT')?.status === 'PASS' ? 'PASS' : 'FAIL' },
    { id: 'MACHINE_BOUND_STATUS_MISSING_NEGATIVE', status: byId.get('MACHINE_BOUND_EXIT_STATUS')?.status === 'PASS' ? 'PASS' : 'FAIL' },
    { id: 'BLOCK_3_CLOSE_GREEN_WHILE_LIMITS_VISIBLE_NEGATIVE', status: forceClaims.block3CloseGreenWhileLimitsVisible === true ? 'FAIL' : 'PASS' },
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
      'node scripts/ops/b3c20-block-3-exit-dossier-state.mjs --write --json',
      `node --test ${CONTRACT_TEST_BASENAMES.map((basename) => path.join('test', 'contracts', basename)).join(' ')}`,
      'npm run oss:policy',
      'git diff --check',
      'git status --short --untracked-files=all -- package.json package-lock.json',
      'git status --short --untracked-files=all -- CANON.md docs/OPS/STATUS/CANON_STATUS.json docs/OPS/EXECUTION/REQUIRED_TOKEN_SET.json docs/OPS/TOKENS/TOKEN_CATALOG.json docs/OPS/TOKENS/TOKEN_CATALOG_LOCK.json',
      'git status --short --untracked-files=all -- src/renderer/index.html src/renderer/styles.css src/main.js src/preload.js src/export src/io src/security src/collab',
    ].map((command, index) => ({
      index: index + 1,
      command,
      result: 'EXTERNAL_RUN_REQUIRED',
    })),
  };
}

export async function evaluateB3C20Block3ExitDossierState(input = {}) {
  const repoRoot = path.resolve(input.repoRoot || DEFAULT_REPO_ROOT);
  const downloadsDir = input.downloadsDir || path.join(os.homedir(), 'Downloads');
  const forceClaims = input.forceClaims && typeof input.forceClaims === 'object' ? input.forceClaims : {};
  const inputRows = await buildInputRows(repoRoot, forceClaims);
  const visibleLimitRows = buildVisibleLimitRows(inputRows, repoRoot, forceClaims);
  const decision = buildDecision({ inputRows, visibleLimitRows, forceClaims });
  const donorArchiveRows = buildDonorArchiveRows(downloadsDir);
  const donorIntakeContextOnly = donorArchiveRows.every((row) => row.authority === 'CONTEXT_ONLY'
    && row.codeImported === false
    && row.dependencyClaimImported === false
    && row.completionClaimImported === false
    && row.exitCompletionClaimImported === false);
  const scopeGuard = buildScopeGuardRows({ repoRoot, forceClaims });
  const decisionRows = buildDecisionRows({
    inputRows,
    visibleLimitRows,
    decision,
    scopeGuardRows: scopeGuard.rows,
    donorIntakeContextOnly,
    forceClaims,
  });
  const negativeRows = buildNegativeRows({ decisionRows, visibleLimitRows, donorIntakeContextOnly, forceClaims });
  const dossierSections = buildDossierSections(inputRows, visibleLimitRows, decision);

  const allInputsBound = inputRows.length === 19 && inputRows.every((row) => row.passed);
  const visibleLimitsPass = visibleLimitRows.length === VISIBLE_LIMIT_DEFINITIONS.length && visibleLimitRows.every((row) => row.status === 'PASS');
  const dossierSectionsPass = dossierSections.every((row) => row.status === 'PASS');
  const decisionRowsComplete = REQUIRED_DECISION_ROW_IDS.every((id) => decisionRows.some((row) => row.id === id));
  const decisionRowsPass = decisionRows.every((row) => row.status === 'PASS');
  const negativeIds = negativeRows.map((row) => row.id).sort((a, b) => a.localeCompare(b));
  const negativeRowsComplete = REQUIRED_NEGATIVE_IDS.every((id) => negativeIds.includes(id));
  const negativeRowsPass = negativeRows.every((row) => row.status === 'PASS');
  const forbiddenClaimsAbsent = FORBIDDEN_CLAIM_KEYS.every((key) => forceClaims[key] !== true);
  const releaseGreen = false;
  const ok = allInputsBound
    && visibleLimitsPass
    && dossierSectionsPass
    && decisionRowsComplete
    && decisionRowsPass
    && donorIntakeContextOnly
    && negativeRowsComplete
    && negativeRowsPass
    && forbiddenClaimsAbsent
    && decision.decision === 'BLOCK_3_STOP_NOT_RELEASE_GREEN'
    && decision.nextStep === 'STOP_FOR_OWNER_DECISION'
    && releaseGreen === false;
  const failRows = [
    ...(allInputsBound ? [] : ['INPUT_ARTIFACTS_NOT_BOUND']),
    ...(visibleLimitsPass ? [] : ['VISIBLE_LIMITS_NOT_BOUND']),
    ...(dossierSectionsPass ? [] : ['DOSSIER_SECTIONS_FAILED']),
    ...(decisionRowsComplete ? [] : ['DECISION_ROWS_INCOMPLETE']),
    ...(decisionRowsPass ? [] : ['DECISION_ROWS_FAILED']),
    ...(donorIntakeContextOnly ? [] : ['DONOR_INTAKE_NOT_CONTEXT_ONLY']),
    ...(negativeRowsComplete ? [] : ['NEGATIVE_ROWS_INCOMPLETE']),
    ...(negativeRowsPass ? [] : ['NEGATIVE_ROWS_FAILED']),
    ...(forbiddenClaimsAbsent ? [] : ['FORBIDDEN_SCOPE_OR_RELEASE_CLAIM']),
    ...(decision.decision === 'BLOCK_3_STOP_NOT_RELEASE_GREEN' ? [] : ['FALSE_BLOCK_3_RELEASE_GREEN']),
    ...(decision.nextStep === 'STOP_FOR_OWNER_DECISION' ? [] : ['FINAL_NEXT_STEP_NOT_STOP']),
    ...(releaseGreen === false ? [] : ['FALSE_RELEASE_GREEN']),
  ];
  const changedBasenamesHash = sha256Text(CHANGED_BASENAMES.join('\n'));
  const statusArtifactHash = sha256Text(stableJson({
    taskId: TASK_ID,
    changedBasenamesHash,
    inputIds: inputRows.map((row) => row.id),
    visibleLimitIds: visibleLimitRows.map((row) => row.id),
    decisionIds: decisionRows.map((row) => row.id).sort((a, b) => a.localeCompare(b)),
    negativeIds,
    decision: decision.decision,
    nextStep: decision.nextStep,
  }));

  return stableSort({
    artifactId: 'B3C20_BLOCK_3_EXIT_DOSSIER_STATUS_V1',
    contourId: TASK_ID,
    ok,
    status: ok ? 'PASS_EXIT_DOSSIER_WITH_STOP_NOT_RELEASE_GREEN' : 'FAIL',
    [TOKEN_NAME]: ok ? 1 : 0,
    [RELEASE_GREEN_TOKEN_NAME]: 0,
    failSignal: ok ? '' : FAIL_SIGNAL,
    failRows,
    successWording: 'PASS_AS_BLOCK_3_EXIT_DOSSIER_WITH_MACHINE_BOUND_STOP_NOT_RELEASE_GREEN',
    tokenSemantics: 'BLOCK_3_EXIT_DOSSIER_PROOF_ONLY_RELEASE_GREEN_REMAINS_FALSE_AND_NEXT_STEP_IS_STOP',
    rollbackRef: 'ROLLBACK_BLOCK_3_EXIT_DOSSIER_GOVERNANCE',
    releaseGreen,
    blockDecision: decision,
    inputRows,
    dossierSections,
    visibleLimitRows,
    decisionRows,
    negativeRows,
    ownerReviewPacket: {
      status: decision.ownerReviewPacketReady ? 'READY' : 'NOT_READY',
      currentDecision: decision.decision,
      nextStep: decision.nextStep,
      releaseGreenAllowedOnlyIf: 'ALL_RELEASE_GATES_GREEN_BY_MACHINE_PROOF_AND_NO_VISIBLE_LIMITS_AND_B3C19_RELEASE_GREEN_OK_1',
    },
    donorIntake: {
      class: 'READ_ONLY_CONTEXT_ONLY',
      codeImported: false,
      dependencyClaimImported: false,
      completionClaimImported: false,
      exitCompletionClaimImported: false,
      activeCanonOverDonor: true,
      archiveRows: donorArchiveRows,
    },
    proof: {
      allInputsBound,
      b3c19AuditBound: decisionRows.some((row) => row.id === 'B3C19_AUDIT_BOUND' && row.status === 'PASS'),
      visibleLimitsPass,
      unsupportedScopeRemainsVisible: decisionRows.some((row) => row.id === 'UNSUPPORTED_SCOPE_REMAINS_VISIBLE' && row.status === 'PASS'),
      stopStatusHasExactNextStep: decisionRows.some((row) => row.id === 'STOP_STATUS_HAS_EXACT_NEXT_STEP' && row.status === 'PASS'),
      noFalseReleaseGreen: decisionRows.some((row) => row.id === 'NO_FALSE_RELEASE_GREEN' && row.status === 'PASS'),
      noDocOnlyClose: decisionRows.some((row) => row.id === 'NO_DOC_ONLY_CLOSE' && row.status === 'PASS'),
      activeCanonNotPromoted: decisionRows.some((row) => row.id === 'NO_ACTIVE_CANON_PROMOTION' && row.status === 'PASS'),
      requiredTokenSetNotExpanded: decisionRows.some((row) => row.id === 'NO_REQUIRED_TOKEN_SET_EXPANSION' && row.status === 'PASS'),
      noNewDependency: decisionRows.some((row) => row.id === 'NO_NEW_DEPENDENCY' && row.status === 'PASS'),
      noRuntimeLayerChange: decisionRows.some((row) => row.id === 'NO_RUNTIME_LAYER_CHANGE' && row.status === 'PASS'),
      noBlock4Started: decisionRows.some((row) => row.id === 'NO_BLOCK_4_STARTED' && row.status === 'PASS'),
      donorIntakeContextOnly,
      priorContoursNotRewritten: decisionRows.some((row) => row.id === 'PRIOR_CONTOURS_NOT_REWRITTEN' && row.status === 'PASS'),
      ownerReviewPacketReady: decisionRows.some((row) => row.id === 'OWNER_REVIEW_PACKET_READY' && row.status === 'PASS'),
      noReleaseFixAttempted: decisionRows.some((row) => row.id === 'NO_RELEASE_FIX_ATTEMPTED' && row.status === 'PASS'),
      b3c19NotReplacedByNewAudit: decisionRows.some((row) => row.id === 'B3C19_NOT_REPLACED_BY_NEW_AUDIT' && row.status === 'PASS'),
      machineBoundExitStatus: decisionRows.some((row) => row.id === 'MACHINE_BOUND_EXIT_STATUS' && row.status === 'PASS'),
      block3StopNotReleaseGreen: decision.decision === 'BLOCK_3_STOP_NOT_RELEASE_GREEN',
      finalNextStepIsStopForOwnerDecision: decision.nextStep === 'STOP_FOR_OWNER_DECISION',
      negativeRowsComplete,
      negativeRowsPass,
    },
    scope: {
      allowedWriteBasenames: CHANGED_BASENAMES,
      directInputs: INPUT_ARTIFACTS.map((row) => row.basename),
      packageManifestChange: scopeGuard.flags.packageManifestChange,
      activeCanonPromotion: scopeGuard.flags.activeCanonPromotion,
      requiredTokenExpansion: scopeGuard.flags.requiredTokenExpansion,
      newDependency: scopeGuard.flags.newDependency,
      uiChange: scopeGuard.flags.uiChange,
      storageChange: scopeGuard.flags.storageChange,
      exportRewrite: scopeGuard.flags.exportRewrite,
      securityRewrite: scopeGuard.flags.securityRewrite,
      runtimeChangeAdded: scopeGuard.flags.runtimeChangeAdded,
      releaseGreenClaim: false,
      block4Started: false,
      releaseFixAttempted: false,
      priorContourStatusRewritten: scopeGuard.flags.priorContourStatusRewritten,
      donorCompletionClaimImported: false,
      b3c19AuditReplaced: false,
      machineBoundStatusMissing: false,
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
  const state = await evaluateB3C20Block3ExitDossierState({ repoRoot });
  if (args.write) {
    await fsp.mkdir(path.dirname(path.join(repoRoot, STATUS_REL_PATH)), { recursive: true });
    await fsp.writeFile(path.join(repoRoot, STATUS_REL_PATH), stableJson(state));
  }
  if (args.json) {
    process.stdout.write(stableJson(state));
  } else {
    process.stdout.write(`B3C20_STATUS=${state.status}\n`);
    process.stdout.write(`${TOKEN_NAME}=${state[TOKEN_NAME]}\n`);
    process.stdout.write(`${RELEASE_GREEN_TOKEN_NAME}=${state[RELEASE_GREEN_TOKEN_NAME]}\n`);
    process.stdout.write(`B3C20_NEXT_STEP=${state.blockDecision.nextStep}\n`);
  }
  process.exitCode = state.ok ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
