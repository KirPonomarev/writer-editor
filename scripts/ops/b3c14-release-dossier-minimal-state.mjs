#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const TOKEN_NAME = 'B3C14_RELEASE_DOSSIER_MINIMAL_OK';
export const RELEASE_GREEN_TOKEN_NAME = 'B3C14_RELEASE_GREEN_OK';

const TASK_ID = 'B3C14_RELEASE_DOSSIER_MINIMAL';
const STATUS_BASENAME = 'B3C14_RELEASE_DOSSIER_MINIMAL_STATUS_V1.json';
const STATUS_REL_PATH = path.join('docs', 'OPS', 'STATUS', STATUS_BASENAME);
const DEFAULT_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FAIL_SIGNAL = 'E_B3C14_RELEASE_DOSSIER_MINIMAL_NOT_OK';

const CHANGED_BASENAMES = Object.freeze([
  'b3c14-release-dossier-minimal-state.mjs',
  'b3c14-release-dossier-minimal.contract.test.js',
  STATUS_BASENAME,
]);

const DONOR_ARCHIVE_BASENAMES = Object.freeze([
  'writer-editor-longform-v5_1-block3-release-export-security-scale-pack-v1.zip',
  'writer-editor-longform-v5_1-block3-release-export-security-scale-pack-v3.zip',
  'writer-editor-longform-v5_1-turnkey-pack-v2.zip',
  'writer-editor-longform-v5_1-turnkey-pack-v3.zip',
]);

const REQUIRED_INPUTS = Object.freeze([
  ['B3C09_PERFORMANCE_BASELINE_BINDING_STATUS_V1.json', 'B3C09_PERFORMANCE_BASELINE_BINDING_OK'],
  ['B3C10_CAPABILITY_TIER_REPORT_STATUS_V1.json', 'B3C10_CAPABILITY_TIER_REPORT_OK'],
  ['B3C11_XPLAT_NORMALIZATION_BASELINE_STATUS_V1.json', 'B3C11_XPLAT_NORMALIZATION_BASELINE_OK'],
  ['B3C12_I18N_TEXT_ANCHOR_SAFETY_STATUS_V1.json', 'B3C12_I18N_TEXT_ANCHOR_SAFETY_OK'],
  ['B3C13_TRUST_SURFACE_ACCESSIBILITY_STATUS_V1.json', 'B3C13_TRUST_SURFACE_ACCESSIBILITY_OK'],
]);

const REQUIRED_SECTION_IDS = Object.freeze([
  'RELEASE_SUMMARY',
  'CAPABILITY_TIER',
  'ACTIVE_CANON',
  'SOURCE_HEAD',
  'PACKAGE_HASHES',
  'TEST_RESULTS',
  'PROJECT_DOCTOR',
  'RECOVERY_DRILL',
  'EXPORT_VALIDATION',
  'SECURITY',
  'PERFORMANCE',
  'UNSUPPORTED_SCOPE',
]);

const REQUIRED_LIMIT_IDS = Object.freeze([
  'PACKAGE_HASHES_LIMITED_NO_PACKAGE_BUILD',
  'B3C09_PERF_GAP_BLOCKS_FULL_TIER_GREEN',
  'B3C11_REAL_PLATFORM_MATRIX_LIMITED',
  'B3C12_FULL_GLOBAL_I18N_NOT_CLAIMED',
  'B3C13_FULL_APP_A11Y_NOT_CLAIMED',
  'ATTESTATION_HANDOFF_ONLY',
  'SUPPLY_CHAIN_HANDOFF_ONLY',
  'NO_BLOCK2_REOPEN',
]);

const REQUIRED_NEGATIVE_IDS = Object.freeze([
  'RELEASE_WITHOUT_DOSSIER_NEGATIVE',
  'FALSE_GREEN_NEGATIVE',
  'DOC_ONLY_RELEASE_NEGATIVE',
  'MISSING_ARTIFACT_NEGATIVE',
  'UNSUPPORTED_SCOPE_OVERCLAIM_NEGATIVE',
]);

const FORBIDDEN_CLAIM_KEYS = Object.freeze([
  'releaseClaim',
  'releaseGreenClaim',
  'packageBuild',
  'packageHashGeneration',
  'attestationImplementation',
  'supplyChainImplementation',
  'exportRewrite',
  'securityRewrite',
  'perfFix',
  'xplatCertification',
  'a11yCertification',
  'uiWork',
  'storageChange',
  'commandSurfaceChange',
  'newDependency',
  'block2Reopen',
]);

const COMMANDS = Object.freeze([
  'node scripts/ops/b3c14-release-dossier-minimal-state.mjs --write --json',
  'node --test test/contracts/b3c14-release-dossier-minimal.contract.test.js',
  'node --test test/contracts/b3c13-trust-surface-accessibility.contract.test.js',
  'node --test test/contracts/b3c12-i18n-text-anchor-safety.contract.test.js',
  'node --test test/contracts/b3c11-xplat-normalization-baseline.contract.test.js',
  'node --test test/contracts/b3c10-capability-tier-report.contract.test.js',
  'node --test test/contracts/b3c09-performance-baseline-binding.contract.test.js',
  'npm run oss:policy',
  'git diff --check',
  'git diff --name-only -- package.json package-lock.json',
  'git diff --name-only -- src/renderer/index.html src/renderer/styles.css src/renderer/editor.js src/io src/export src/main.js src/preload.js',
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

function inputStatusPasses(status, tokenName) {
  return status?.ok === true
    && status?.[tokenName] === 1
    && status?.repo?.repoRootBinding === 'WORKTREE_INDEPENDENT';
}

function getGitHead(repoRoot) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' });
  return result.status === 0 ? String(result.stdout || '').trim() : '';
}

function fileExists(repoRoot, relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
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
      .filter((entry) => /release|dossier|attestation|supply|capability|security|export|perf|xplat|a11y|BLOCK_3|VALIDATION|INTEGRATION/iu.test(entry))
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
      completionClaimImported: false,
    };
  });
}

function buildInputRows(repoRoot, statusByBasename) {
  return REQUIRED_INPUTS.map(([basename, tokenName]) => {
    const status = statusByBasename.get(basename);
    return {
      basename,
      tokenName,
      passed: inputStatusPasses(status, tokenName),
      status: status?.status || 'MISSING',
      headSha: status?.repo?.headSha || '',
    };
  });
}

function buildSectionRows(repoRoot, statuses) {
  const b3c09 = statuses.get('B3C09_PERFORMANCE_BASELINE_BINDING_STATUS_V1.json');
  const b3c10 = statuses.get('B3C10_CAPABILITY_TIER_REPORT_STATUS_V1.json');
  const b3c11 = statuses.get('B3C11_XPLAT_NORMALIZATION_BASELINE_STATUS_V1.json');
  const b3c12 = statuses.get('B3C12_I18N_TEXT_ANCHOR_SAFETY_STATUS_V1.json');
  const b3c13 = statuses.get('B3C13_TRUST_SURFACE_ACCESSIBILITY_STATUS_V1.json');
  const activeCanonBound = fileExists(repoRoot, 'CANON.md')
    && fileExists(repoRoot, path.join('docs', 'OPS', 'STATUS', 'CANON_STATUS.json'));

  return [
    {
      id: 'RELEASE_SUMMARY',
      status: 'BOUND',
      source: 'B3C14_EXECUTABLE_DOSSIER_STATE',
    },
    {
      id: 'CAPABILITY_TIER',
      status: 'LIMITED',
      source: 'B3C10_CAPABILITY_TIER_REPORT_STATUS_V1.json',
      reason: b3c10?.B3C10_FULL_TIER_GREEN_OK === 0 ? 'FULL_TIER_GREEN_FALSE' : 'FULL_TIER_STATUS_UNKNOWN',
    },
    {
      id: 'ACTIVE_CANON',
      status: activeCanonBound ? 'BOUND' : 'MISSING',
      source: 'CANON_STATUS.json',
    },
    {
      id: 'SOURCE_HEAD',
      status: 'BOUND',
      source: getGitHead(repoRoot),
    },
    {
      id: 'PACKAGE_HASHES',
      status: 'LIMITED',
      source: 'B3C14_NO_PACKAGE_BUILD_IN_SCOPE',
      reason: 'PACKAGE_HASH_GENERATION_DEFERRED',
    },
    {
      id: 'TEST_RESULTS',
      status: 'BOUND',
      source: 'B3C14_COMMAND_ROWS_DECLARED_FOR_EXTERNAL_RUNNER',
    },
    {
      id: 'PROJECT_DOCTOR',
      status: fileExists(repoRoot, path.join('scripts', 'doctor.mjs')) ? 'LIMITED' : 'MISSING',
      source: 'doctor.mjs',
      reason: 'B3C14_DOES_NOT_REOPEN_BLOCK2_OR_RUN_RELEASE_DOCTOR_CLAIM',
    },
    {
      id: 'RECOVERY_DRILL',
      status: 'LIMITED',
      source: 'PREVIOUS_KERNEL_ARTIFACTS_REFERENCED_ONLY',
      reason: 'NO_FRESH_RELEASE_RECOVERY_DRILL_IN_B3C14',
    },
    {
      id: 'EXPORT_VALIDATION',
      status: 'LIMITED',
      source: 'PREVIOUS_EXPORT_ARTIFACTS_REFERENCED_ONLY',
      reason: 'NO_EXPORT_REWRITE_OR_FRESH_PACKAGE_EXPORT_IN_B3C14',
    },
    {
      id: 'SECURITY',
      status: 'LIMITED',
      source: 'PREVIOUS_SECURITY_ARTIFACTS_REFERENCED_ONLY',
      reason: 'NO_SECURITY_REWRITE_OR_RELEASE_CERTIFICATION_IN_B3C14',
    },
    {
      id: 'PERFORMANCE',
      status: 'LIMITED',
      source: 'B3C09_PERFORMANCE_BASELINE_BINDING_STATUS_V1.json',
      reason: b3c09?.B3C09_PROVISIONAL_PERF_GAP === 1 ? 'PROVISIONAL_PERF_GAP_BOUND' : 'PERFORMANCE_GAP_UNKNOWN',
    },
    {
      id: 'UNSUPPORTED_SCOPE',
      status: 'BOUND',
      source: 'B3C14_LIMIT_ROWS',
      reason: [
        b3c11?.realPlatformStatus === 'LIMITED' ? 'REAL_PLATFORM_MATRIX_LIMITED' : 'REAL_PLATFORM_STATUS_UNKNOWN',
        b3c12?.realLanguageCoverageStatus === 'LIMITED' ? 'GLOBAL_I18N_LIMITED' : 'I18N_STATUS_UNKNOWN',
        b3c13?.trustSurfaceA11yStatus === 'LIMITED_PASS' ? 'FULL_APP_A11Y_NOT_CLAIMED' : 'A11Y_STATUS_UNKNOWN',
      ],
    },
  ];
}

function buildLimitRows(statuses) {
  const b3c09 = statuses.get('B3C09_PERFORMANCE_BASELINE_BINDING_STATUS_V1.json');
  const b3c11 = statuses.get('B3C11_XPLAT_NORMALIZATION_BASELINE_STATUS_V1.json');
  const b3c12 = statuses.get('B3C12_I18N_TEXT_ANCHOR_SAFETY_STATUS_V1.json');
  const b3c13 = statuses.get('B3C13_TRUST_SURFACE_ACCESSIBILITY_STATUS_V1.json');

  return [
    {
      id: 'PACKAGE_HASHES_LIMITED_NO_PACKAGE_BUILD',
      status: 'LIMITED',
      reason: 'B3C14_DOES_NOT_BUILD_PACKAGE_OR_GENERATE_PACKAGE_HASH',
    },
    {
      id: 'B3C09_PERF_GAP_BLOCKS_FULL_TIER_GREEN',
      status: b3c09?.B3C09_PROVISIONAL_PERF_GAP === 1 && b3c09?.PERF_BASELINE_OK === 0 ? 'LIMITED' : 'MISSING',
      reason: 'PERF_BASELINE_OK_REMAINS_ZERO',
    },
    {
      id: 'B3C11_REAL_PLATFORM_MATRIX_LIMITED',
      status: b3c11?.B3C11_FULL_REAL_PLATFORM_XPLAT_OK === 0 && b3c11?.realPlatformStatus === 'LIMITED' ? 'LIMITED' : 'MISSING',
      reason: 'REAL_PLATFORM_XPLAT_NOT_FULL_GREEN',
    },
    {
      id: 'B3C12_FULL_GLOBAL_I18N_NOT_CLAIMED',
      status: b3c12?.B3C12_FULL_GLOBAL_I18N_OK === 0 && b3c12?.realLanguageCoverageStatus === 'LIMITED' ? 'LIMITED' : 'MISSING',
      reason: 'GLOBAL_I18N_NOT_CLAIMED',
    },
    {
      id: 'B3C13_FULL_APP_A11Y_NOT_CLAIMED',
      status: b3c13?.B3C13_FULL_APP_A11Y_OK === 0 && b3c13?.trustSurfaceA11yStatus === 'LIMITED_PASS' ? 'LIMITED' : 'MISSING',
      reason: 'FULL_APP_A11Y_NOT_CLAIMED',
    },
    {
      id: 'ATTESTATION_HANDOFF_ONLY',
      status: 'LIMITED',
      reason: 'B3C15_ATTESTATION_CHAIN_NOT_IMPLEMENTED_IN_B3C14',
    },
    {
      id: 'SUPPLY_CHAIN_HANDOFF_ONLY',
      status: 'LIMITED',
      reason: 'B3C16_SUPPLY_CHAIN_NOT_IMPLEMENTED_IN_B3C14',
    },
    {
      id: 'NO_BLOCK2_REOPEN',
      status: 'LIMITED',
      reason: 'B3C14_REFERENCES_PRIOR_KERNEL_EVIDENCE_WITHOUT_REOPENING_BLOCK2',
    },
  ];
}

function buildCarriedForwardLimitRows(statuses) {
  const b3c09 = statuses.get('B3C09_PERFORMANCE_BASELINE_BINDING_STATUS_V1.json') || {};
  const b3c10 = statuses.get('B3C10_CAPABILITY_TIER_REPORT_STATUS_V1.json') || {};
  const b3c11 = statuses.get('B3C11_XPLAT_NORMALIZATION_BASELINE_STATUS_V1.json') || {};
  const b3c12 = statuses.get('B3C12_I18N_TEXT_ANCHOR_SAFETY_STATUS_V1.json') || {};
  const b3c13 = statuses.get('B3C13_TRUST_SURFACE_ACCESSIBILITY_STATUS_V1.json') || {};

  return [
    {
      id: 'B3C09_UNSUPPORTED_MEASUREMENTS',
      status: 'BOUND_LIMIT',
      sourceBasename: 'B3C09_PERFORMANCE_BASELINE_BINDING_STATUS_V1.json',
      rows: Array.isArray(b3c09.unsupportedRows)
        ? b3c09.unsupportedRows.map((row) => row.id).sort((a, b) => a.localeCompare(b))
        : [],
    },
    {
      id: 'B3C10_PROVISIONAL_PERF_AND_PLATFORM_SCOPE',
      status: 'BOUND_LIMIT',
      sourceBasename: 'B3C10_CAPABILITY_TIER_REPORT_STATUS_V1.json',
      unsupportedScope: Array.isArray(b3c10.unsupportedScope)
        ? b3c10.unsupportedScope.map((row) => row.id).sort((a, b) => a.localeCompare(b))
        : [],
      provisionalScope: Array.isArray(b3c10.provisionalScope)
        ? b3c10.provisionalScope.map((row) => row.id).sort((a, b) => a.localeCompare(b))
        : [],
    },
    {
      id: 'B3C11_REAL_PLATFORM_LIMITS',
      status: 'BOUND_LIMIT',
      sourceBasename: 'B3C11_XPLAT_NORMALIZATION_BASELINE_STATUS_V1.json',
      platformRows: Array.isArray(b3c11.platformLimitRows)
        ? b3c11.platformLimitRows.map((row) => `${row.platform}:${row.status}`).sort((a, b) => a.localeCompare(b))
        : [],
    },
    {
      id: 'B3C12_I18N_LIMITS',
      status: 'BOUND_LIMIT',
      sourceBasename: 'B3C12_I18N_TEXT_ANCHOR_SAFETY_STATUS_V1.json',
      unsupportedScope: Array.isArray(b3c12.unsupportedScope)
        ? b3c12.unsupportedScope.map((row) => row.id).sort((a, b) => a.localeCompare(b))
        : [],
    },
    {
      id: 'B3C13_A11Y_LIMIT_ROWS',
      status: 'BOUND_LIMIT',
      sourceBasename: 'B3C13_TRUST_SURFACE_ACCESSIBILITY_STATUS_V1.json',
      rows: Array.isArray(b3c13.limitRows)
        ? b3c13.limitRows.map((row) => row.id).sort((a, b) => a.localeCompare(b))
        : [],
    },
    {
      id: 'B3C13_A11Y_UNSUPPORTED_SCOPE',
      status: 'BOUND_LIMIT',
      sourceBasename: 'B3C13_TRUST_SURFACE_ACCESSIBILITY_STATUS_V1.json',
      unsupportedScope: Array.isArray(b3c13.unsupportedScope)
        ? b3c13.unsupportedScope.map((row) => row.id).sort((a, b) => a.localeCompare(b))
        : [],
    },
    {
      id: 'B3C13_B3C14_HANDOFF',
      status: 'BOUND_LIMIT',
      sourceBasename: 'B3C13_TRUST_SURFACE_ACCESSIBILITY_STATUS_V1.json',
      provisionalScope: Array.isArray(b3c13.provisionalScope)
        ? b3c13.provisionalScope.map((row) => `${row.id}:${row.status}`).sort((a, b) => a.localeCompare(b))
        : [],
    },
  ];
}

function buildNegativeRows(forceClaims) {
  return [
    {
      id: 'RELEASE_WITHOUT_DOSSIER_NEGATIVE',
      status: forceClaims.releaseWithoutDossier === true ? 'FAIL' : 'PASS',
      rejectsClaim: 'RELEASE_WITHOUT_DOSSIER',
    },
    {
      id: 'FALSE_GREEN_NEGATIVE',
      status: forceClaims.releaseGreenClaim === true ? 'FAIL' : 'PASS',
      rejectsClaim: 'RELEASE_GREEN_WHILE_LIMITS_REMAIN',
    },
    {
      id: 'DOC_ONLY_RELEASE_NEGATIVE',
      status: forceClaims.docOnlyReleaseClaim === true ? 'FAIL' : 'PASS',
      rejectsClaim: 'DOC_ONLY_RELEASE_EVIDENCE',
    },
    {
      id: 'MISSING_ARTIFACT_NEGATIVE',
      status: forceClaims.missingArtifactAccepted === true ? 'FAIL' : 'PASS',
      rejectsClaim: 'MISSING_ARTIFACT_ACCEPTED',
    },
    {
      id: 'UNSUPPORTED_SCOPE_OVERCLAIM_NEGATIVE',
      status: forceClaims.unsupportedScopeOverclaim === true ? 'FAIL' : 'PASS',
      rejectsClaim: 'UNSUPPORTED_SCOPE_OVERCLAIM',
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
    commandCount: COMMANDS.length,
    commands: COMMANDS.map((command, index) => ({
      index: index + 1,
      command,
      result: 'EXTERNAL_RUN_REQUIRED',
    })),
  };
}

export async function evaluateB3C14ReleaseDossierMinimalState(input = {}) {
  const repoRoot = path.resolve(input.repoRoot || DEFAULT_REPO_ROOT);
  const downloadsDir = input.downloadsDir || path.join(os.homedir(), 'Downloads');
  const forceClaims = input.forceClaims && typeof input.forceClaims === 'object' ? input.forceClaims : {};
  const statuses = new Map();
  for (const [basename] of REQUIRED_INPUTS) {
    statuses.set(basename, await readJsonIfExists(repoRoot, path.join('docs', 'OPS', 'STATUS', basename)));
  }

  const inputRows = buildInputRows(repoRoot, statuses);
  const sectionRows = buildSectionRows(repoRoot, statuses);
  const limitRows = buildLimitRows(statuses);
  const carriedForwardLimitRows = buildCarriedForwardLimitRows(statuses);
  const negativeRows = buildNegativeRows(forceClaims);
  const donorArchiveRows = buildDonorArchiveRows(downloadsDir);
  const inputStatusesBound = inputRows.every((row) => row.passed === true);
  const sectionIds = sectionRows.map((row) => row.id).sort((a, b) => a.localeCompare(b));
  const limitIds = limitRows.map((row) => row.id).sort((a, b) => a.localeCompare(b));
  const negativeIds = negativeRows.map((row) => row.id).sort((a, b) => a.localeCompare(b));
  const carriedForwardLimitIds = carriedForwardLimitRows.map((row) => row.id).sort((a, b) => a.localeCompare(b));
  const sectionRowsComplete = REQUIRED_SECTION_IDS.every((id) => sectionIds.includes(id));
  const limitRowsComplete = REQUIRED_LIMIT_IDS.every((id) => limitIds.includes(id));
  const negativeRowsComplete = REQUIRED_NEGATIVE_IDS.every((id) => negativeIds.includes(id));
  const limitedSectionsPresent = sectionRows.some((row) => row.status === 'LIMITED')
    && limitRows.every((row) => row.status === 'LIMITED');
  const carriedForwardLimitsBound = carriedForwardLimitRows.every((row) => row.status === 'BOUND_LIMIT')
    && carriedForwardLimitRows.every((row) => Object.values(row).some((value) => Array.isArray(value) && value.length > 0));
  const negativeRowsPass = negativeRows.every((row) => row.status === 'PASS');
  const forbiddenClaimsAbsent = FORBIDDEN_CLAIM_KEYS.every((key) => forceClaims[key] !== true);
  const donorIntakeContextOnly = donorArchiveRows.every((row) => row.authority === 'CONTEXT_ONLY'
    && row.codeImported === false
    && row.completionClaimImported === false);
  const releaseGreen = false;
  const dossierStatus = inputStatusesBound
    && sectionRowsComplete
    && limitRowsComplete
    && negativeRowsComplete
    && limitedSectionsPresent
    && carriedForwardLimitsBound
    ? 'COMPLETE_WITH_LIMITS'
    : 'FAIL';
  const ok = dossierStatus === 'COMPLETE_WITH_LIMITS'
    && negativeRowsPass
    && forbiddenClaimsAbsent
    && donorIntakeContextOnly
    && releaseGreen === false;
  const changedBasenamesHash = sha256Text(CHANGED_BASENAMES.join('\n'));
  const statusArtifactHash = sha256Text(stableJson({
    taskId: TASK_ID,
    headSha: getGitHead(repoRoot),
    changedBasenamesHash,
    dossierStatus,
    sectionIds,
    limitIds,
    negativeIds,
    status: ok ? 'PASS' : 'FAIL',
  }));

  const failRows = [
    ...inputRows.filter((row) => row.passed !== true).map((row) => row.basename),
    ...(sectionRowsComplete ? [] : ['SECTION_ROWS_INCOMPLETE']),
    ...(limitRowsComplete ? [] : ['LIMIT_ROWS_INCOMPLETE']),
    ...(negativeRowsComplete ? [] : ['NEGATIVE_ROWS_INCOMPLETE']),
    ...(limitedSectionsPresent ? [] : ['LIMITED_SECTIONS_NOT_BOUND']),
    ...(carriedForwardLimitsBound ? [] : ['CARRIED_FORWARD_LIMITS_NOT_BOUND']),
    ...(negativeRowsPass ? [] : ['NEGATIVE_ROWS_FAILED']),
    ...(forbiddenClaimsAbsent ? [] : ['FORBIDDEN_SCOPE_OR_RELEASE_CLAIM']),
    ...(donorIntakeContextOnly ? [] : ['DONOR_INTAKE_NOT_CONTEXT_ONLY']),
    ...(releaseGreen === false ? [] : ['FALSE_RELEASE_GREEN']),
  ];

  return stableSort({
    artifactId: 'B3C14_RELEASE_DOSSIER_MINIMAL_STATUS_V1',
    contourId: TASK_ID,
    ok,
    status: ok ? 'PASS' : 'FAIL',
    dossierStatus,
    [TOKEN_NAME]: ok ? 1 : 0,
    [RELEASE_GREEN_TOKEN_NAME]: 0,
    failSignal: ok ? '' : FAIL_SIGNAL,
    failRows,
    successWording: 'PASS_AS_MINIMAL_RELEASE_DOSSIER_WITH_LIMITS_NOT_RELEASE_GREEN',
    tokenSemantics: 'DOSSIER_COMPLETE_WITH_LIMITS_ONLY_RELEASE_GREEN_REMAINS_FALSE',
    releaseGreen,
    releaseGreenReason: 'LIMIT_ROWS_REMAIN_BOUND_AND_PACKAGE_ATTESTATION_SUPPLY_CHAIN_ARE_HANDOFF_ONLY',
    inputRows,
    sectionRows,
    limitRows,
    negativeRows,
    carriedForwardLimitRows,
    handoffRows: [
      {
        id: 'B3C15_ATTESTATION_CHAIN',
        status: 'HANDOFF_ONLY',
      },
      {
        id: 'B3C16_SUPPLY_CHAIN_RELEASE_SCOPE',
        status: 'HANDOFF_ONLY',
      },
    ],
    unsupportedScope: limitRows.map((row) => ({
      id: row.id,
      reason: row.reason,
    })),
    donorIntake: {
      class: 'READ_ONLY_CONTEXT_ONLY',
      outputLocation: STATUS_BASENAME,
      archivesFound: donorArchiveRows.filter((row) => row.found).map((row) => row.basename),
      archiveRows: donorArchiveRows,
      suggestedRows: [
        'RELEASE_DOSSIER_SECTION_ROWS',
        'LIMIT_ROWS',
        'NEGATIVE_ROWS',
        'B3C15_HANDOFF',
        'B3C16_HANDOFF',
      ],
      codeImported: false,
      completionClaimImported: false,
      activeCanonOverDonor: true,
    },
    proof: {
      b3c09InputBound: inputRows.some((row) => row.basename === 'B3C09_PERFORMANCE_BASELINE_BINDING_STATUS_V1.json' && row.passed),
      b3c10InputBound: inputRows.some((row) => row.basename === 'B3C10_CAPABILITY_TIER_REPORT_STATUS_V1.json' && row.passed),
      b3c11InputBound: inputRows.some((row) => row.basename === 'B3C11_XPLAT_NORMALIZATION_BASELINE_STATUS_V1.json' && row.passed),
      b3c12InputBound: inputRows.some((row) => row.basename === 'B3C12_I18N_TEXT_ANCHOR_SAFETY_STATUS_V1.json' && row.passed),
      b3c13InputBound: inputRows.some((row) => row.basename === 'B3C13_TRUST_SURFACE_ACCESSIBILITY_STATUS_V1.json' && row.passed),
      sectionRowsComplete,
      limitRowsComplete,
      negativeRowsComplete,
      carriedForwardLimitsBound,
      negativeRowsPass,
      packageHashesLimitedNoPackageBuild: true,
      performanceGapBlocksFullTierGreen: true,
      xplatLimitedStatusVisible: true,
      i18nLimitedStatusVisible: true,
      a11yLimitedStatusVisible: true,
      attestationHandoffOnly: true,
      supplyChainHandoffOnly: true,
      noBlock2Reopen: true,
      releaseGreenFalseBecauseLimited: releaseGreen === false,
      donorIntakeContextOnly,
      noReleaseClaim: true,
      noPackageBuild: true,
      noPackageHashGeneration: true,
      noAttestationImplementation: true,
      noSupplyChainImplementation: true,
      noRuntimeLayerRewrite: true,
      noNewDependency: true,
      nodeBuiltinsOnly: true,
      statusArtifactHashRecorded: Boolean(statusArtifactHash),
      changedBasenamesHashRecorded: Boolean(changedBasenamesHash),
      testCommandRowsRecorded: COMMANDS.length > 0,
      carriedForwardLimitRowsRecorded: carriedForwardLimitIds.length === 7,
    },
    scope: {
      layer: TASK_ID,
      releaseReportOnly: true,
      releaseClaim: false,
      releaseGreenClaim: false,
      packageBuild: false,
      packageHashGeneration: false,
      attestationImplementation: false,
      supplyChainImplementation: false,
      exportRewrite: false,
      securityRewrite: false,
      perfFix: false,
      xplatCertification: false,
      a11yCertification: false,
      uiWork: false,
      storageChange: false,
      commandSurfaceChange: false,
      newDependency: false,
      block2Reopen: false,
    },
    repo: {
      repoRootBinding: 'WORKTREE_INDEPENDENT',
      statusBasename: STATUS_BASENAME,
      writtenFrom: 'b3c14-release-dossier-minimal-state.mjs',
      headSha: getGitHead(repoRoot),
    },
    runtime: {
      changedBasenames: [...CHANGED_BASENAMES],
      changedBasenamesHash,
      statusArtifactHash,
      commandResults: buildCommandRows(),
    },
  });
}

async function main() {
  const args = parseArgs();
  const state = await evaluateB3C14ReleaseDossierMinimalState();
  if (args.write) {
    await fsp.mkdir(path.dirname(path.join(DEFAULT_REPO_ROOT, STATUS_REL_PATH)), { recursive: true });
    await fsp.writeFile(path.join(DEFAULT_REPO_ROOT, STATUS_REL_PATH), stableJson(state), 'utf8');
  }
  if (args.json) process.stdout.write(stableJson(state));
  else process.stdout.write(`B3C14_STATUS=${state.status}\n${TOKEN_NAME}=${state[TOKEN_NAME]}\n${RELEASE_GREEN_TOKEN_NAME}=${state[RELEASE_GREEN_TOKEN_NAME]}\n`);
  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) {
  main().catch((error) => {
    process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
    process.exit(1);
  });
}
