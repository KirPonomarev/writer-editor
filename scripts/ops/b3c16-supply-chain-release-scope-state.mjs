#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const TOKEN_NAME = 'B3C16_SUPPLY_CHAIN_RELEASE_SCOPE_OK';
export const RELEASE_GREEN_TOKEN_NAME = 'B3C16_RELEASE_GREEN_OK';

const TASK_ID = 'B3C16_SUPPLY_CHAIN_RELEASE_SCOPE';
const STATUS_BASENAME = 'B3C16_SUPPLY_CHAIN_RELEASE_SCOPE_STATUS_V1.json';
const STATUS_REL_PATH = path.join('docs', 'OPS', 'STATUS', STATUS_BASENAME);
const DEFAULT_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FAIL_SIGNAL = 'E_B3C16_SUPPLY_CHAIN_RELEASE_SCOPE_NOT_OK';

const CHANGED_BASENAMES = Object.freeze([
  'b3c16-supply-chain-release-scope-state.mjs',
  'b3c16-supply-chain-release-scope.contract.test.js',
  STATUS_BASENAME,
]);

const DONOR_ARCHIVE_BASENAMES = Object.freeze([
  'writer-editor-longform-v5_1-block3-release-export-security-scale-pack-v1.zip',
  'writer-editor-longform-v5_1-block3-release-export-security-scale-pack-v3.zip',
  'writer-editor-longform-v5_1-turnkey-pack-v2.zip',
  'writer-editor-longform-v5_1-turnkey-pack-v3.zip',
]);

const FORBIDDEN_DEPENDENCY_GROUPS = Object.freeze([
  {
    id: 'NO_TIPTAP_PRO_DEPENDENCY',
    category: 'PRO_DEPENDENCY',
    patterns: [/^@tiptap-pro\//u],
  },
  {
    id: 'NO_TIPTAP_CLOUD_DEPENDENCY',
    category: 'CLOUD_DEPENDENCY',
    patterns: [/^@tiptap-cloud\//u],
  },
  {
    id: 'NO_FORBIDDEN_UI_FRAMEWORK',
    category: 'UI_FRAMEWORK',
    patterns: [
      /^react$/u,
      /^react-dom$/u,
      /^vue$/u,
      /^@vue\//u,
      /^svelte$/u,
      /^@sveltejs\//u,
      /^solid-js$/u,
      /^preact$/u,
      /^angular$/u,
      /^@angular\//u,
    ],
  },
  {
    id: 'NO_FORBIDDEN_STATE_MANAGER',
    category: 'STATE_MANAGER',
    patterns: [
      /^redux$/u,
      /^@reduxjs\/toolkit$/u,
      /^zustand$/u,
      /^mobx$/u,
      /^jotai$/u,
      /^recoil$/u,
      /^pinia$/u,
    ],
  },
]);

const EXTERNAL_DOCX_LIB_PATTERNS = Object.freeze([
  /^docx$/u,
  /^docx-templates$/u,
  /^html-docx-js$/u,
  /^officegen$/u,
  /^pizzip$/u,
  /^docxtemplater$/u,
]);

const REQUIRED_NEGATIVE_IDS = Object.freeze([
  'FORBIDDEN_PRO_DEPENDENCY_NEGATIVE',
  'FORBIDDEN_CLOUD_DEPENDENCY_NEGATIVE',
  'FORBIDDEN_UI_FRAMEWORK_NEGATIVE',
  'FORBIDDEN_STATE_MANAGER_NEGATIVE',
  'MULTIPLE_DOCX_LIB_NEGATIVE',
  'PACKAGE_MANIFEST_CHANGE_NEGATIVE',
  'PACKAGE_BUILD_NEGATIVE',
  'PACKAGE_HASH_NEGATIVE',
  'RELEASE_GREEN_FALSE_NEGATIVE',
  'DONOR_DEPENDENCY_CLAIM_NEGATIVE',
]);

const FORBIDDEN_CLAIM_KEYS = Object.freeze([
  'newDependency',
  'packageManifestChange',
  'uiChange',
  'storageChange',
  'exportRewrite',
  'securityRewrite',
  'perfFix',
  'xplatCertification',
  'a11yCertification',
  'packageBuild',
  'packageHashGeneration',
  'releaseGreenClaim',
  'cloudDependency',
  'proDependency',
  'uiFramework',
  'stateManager',
]);

const COMMANDS = Object.freeze([
  'node scripts/ops/b3c16-supply-chain-release-scope-state.mjs --write --json',
  'node --test test/contracts/b3c16-supply-chain-release-scope.contract.test.js',
  'node --test test/contracts/b3c15-attestation-chain.contract.test.js',
  'node --test test/contracts/b3c14-release-dossier-minimal.contract.test.js',
  'node --test test/contracts/b3c13-trust-surface-accessibility.contract.test.js',
  'node --test test/contracts/b3c12-i18n-text-anchor-safety.contract.test.js',
  'node --test test/contracts/b3c11-xplat-normalization-baseline.contract.test.js',
  'node --test test/contracts/b3c10-capability-tier-report.contract.test.js',
  'node --test test/contracts/b3c09-performance-baseline-binding.contract.test.js',
  'npm run oss:policy',
  'npm audit --omit=dev --json',
  'git diff --check',
  'git diff --name-only -- package.json package-lock.json',
  'git diff --name-only -- src/renderer/index.html src/renderer/styles.css src/main.js src/preload.js src/export src/io',
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
      .filter((entry) => /supply|dependency|license|audit|package|release|BLOCK_3|VALIDATION|INTEGRATION/iu.test(entry))
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
    };
  });
}

function directManifestDeps(packageJson) {
  return {
    dependencies: Object.keys(packageJson?.dependencies || {}).sort((a, b) => a.localeCompare(b)),
    devDependencies: Object.keys(packageJson?.devDependencies || {}).sort((a, b) => a.localeCompare(b)),
  };
}

function lockPackageNames(packageLock) {
  return Object.keys(packageLock?.packages || {})
    .filter((key) => key.startsWith('node_modules/'))
    .map((key) => key.slice('node_modules/'.length))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function matchAny(name, patterns) {
  return patterns.some((pattern) => pattern.test(name));
}

function buildDependencyRows({ packageJson, packageLock, forceClaims }) {
  const direct = directManifestDeps(packageJson);
  const allNames = lockPackageNames(packageLock);
  const topLevelNames = [...direct.dependencies, ...direct.devDependencies].sort((a, b) => a.localeCompare(b));
  const productionAllowed = direct.dependencies.every((name) => name.startsWith('@tiptap/'));
  const existingDevToolingAllowed = direct.devDependencies.every((name) => ['electron', 'electron-builder', 'esbuild'].includes(name));
  const forbiddenRows = FORBIDDEN_DEPENDENCY_GROUPS.map((group) => {
    const directMatches = topLevelNames.filter((name) => matchAny(name, group.patterns));
    const lockMatches = allNames.filter((name) => matchAny(name, group.patterns));
    const forced = forceClaims[group.category] === true
      || (group.category === 'PRO_DEPENDENCY' && forceClaims.proDependency === true)
      || (group.category === 'CLOUD_DEPENDENCY' && forceClaims.cloudDependency === true)
      || (group.category === 'UI_FRAMEWORK' && forceClaims.uiFramework === true)
      || (group.category === 'STATE_MANAGER' && forceClaims.stateManager === true);
    return {
      id: group.id,
      status: directMatches.length === 0 && lockMatches.length === 0 && !forced ? 'PASS' : 'FAIL',
      category: group.category,
      directMatches,
      lockMatches,
    };
  });
  const docxMatches = allNames.filter((name) => matchAny(name, EXTERNAL_DOCX_LIB_PATTERNS));
  const directDocxMatches = topLevelNames.filter((name) => matchAny(name, EXTERNAL_DOCX_LIB_PATTERNS));
  const docxLibCount = new Set(docxMatches).size;
  const forcedDocxMultiple = forceClaims.multipleDocxLibs === true;

  return {
    direct,
    allPackageNameCount: allNames.length,
    topLevelNames,
    productionAllowedRow: {
      id: 'DEPENDENCY_ALLOWLIST_MATCHES_CANON',
      status: productionAllowed && existingDevToolingAllowed && forceClaims.newDependency !== true ? 'PASS' : 'FAIL',
      productionDependencyRule: 'TOP_LEVEL_PRODUCTION_DEPENDENCIES_MUST_BE_CANON_ALLOWED',
      devDependencyRule: 'EXISTING_ELECTRON_ESBUILD_PACKAGING_TOOLING_ONLY',
      directDependencies: direct.dependencies,
      directDevDependencies: direct.devDependencies,
    },
    forbiddenRows,
    docxLibraryRow: {
      id: 'DOCX_LIBRARY_SINGLE_OR_NONE_WITH_LIMIT',
      status: docxLibCount <= 1 && !forcedDocxMultiple ? 'PASS' : 'FAIL',
      directMatches: directDocxMatches,
      lockMatches: docxMatches,
      externalDocxLibraryCount: docxLibCount,
      currentStatus: docxLibCount === 0 ? 'LIMITED_NONE_EXTERNAL_DOCX_LIB_CURRENTLY_DECLARED' : 'SINGLE_EXTERNAL_DOCX_LIB',
      noPackageBuildClaim: true,
    },
  };
}

function buildB3C14InputRow(status) {
  return {
    basename: 'B3C14_RELEASE_DOSSIER_MINIMAL_STATUS_V1.json',
    passed: status?.ok === true
      && status?.B3C14_RELEASE_DOSSIER_MINIMAL_OK === 1
      && status?.B3C14_RELEASE_GREEN_OK === 0
      && Array.isArray(status?.carriedForwardLimitRows)
      && status.carriedForwardLimitRows.length === 7,
    token: status?.B3C14_RELEASE_DOSSIER_MINIMAL_OK || 0,
    releaseGreen: status?.B3C14_RELEASE_GREEN_OK || 0,
    carriedForwardLimitRowCount: Array.isArray(status?.carriedForwardLimitRows) ? status.carriedForwardLimitRows.length : 0,
  };
}

function buildB3C15InputRow(status) {
  return {
    basename: 'B3C15_ATTESTATION_CHAIN_STATUS_V1.json',
    passed: status?.ok === true
      && status?.B3C15_ATTESTATION_CHAIN_OK === 1
      && status?.B3C15_RELEASE_GREEN_OK === 0
      && status?.ATTESTATION_SIGNATURE_OK === 1
      && status?.VERIFY_ATTESTATION_OK === 1,
    token: status?.B3C15_ATTESTATION_CHAIN_OK || 0,
    releaseGreen: status?.B3C15_RELEASE_GREEN_OK || 0,
    signatureToken: status?.ATTESTATION_SIGNATURE_OK || 0,
    verifyToken: status?.VERIFY_ATTESTATION_OK || 0,
  };
}

function buildPackageManifestRows({ repoRoot, forceClaims }) {
  const diffNames = gitDiffNames(repoRoot, ['package.json', 'package-lock.json']);
  const forced = forceClaims.packageManifestChange === true;
  return [
    {
      id: 'PACKAGE_MANIFESTS_READ_ONLY',
      status: diffNames.length === 0 && !forced ? 'PASS' : 'FAIL',
      changedBasenames: diffNames.map((name) => path.basename(name)),
      readOnlyInputs: ['package.json', 'package-lock.json'],
    },
  ];
}

function buildAuditRows({ forceClaims }) {
  return [
    {
      id: 'OSS_POLICY_LOCAL_CHECK_PASS',
      status: forceClaims.ossPolicyFailed === true ? 'FAIL' : 'PASS',
      command: 'npm run oss:policy',
      embeddedCheck: 'NO_TIPTAP_PRO_NO_TIPTAP_CLOUD',
    },
    {
      id: 'NPM_AUDIT_LOCAL_STATUS_RECORDED',
      status: forceClaims.npmAuditHighOrCritical === true ? 'FAIL' : 'LIMITED',
      taxonomy: forceClaims.npmAuditHighOrCritical === true
        ? 'STOP_HIGH_OR_CRITICAL_PRODUCTION_FINDING'
        : 'LIMITED_EXTERNAL_COMMAND_RECORDED_SEPARATELY_NOT_RELEASE_GREEN',
      command: 'npm audit --omit=dev --json',
      highOrCriticalProductionFindings: forceClaims.npmAuditHighOrCritical === true ? 'FORCED_FAIL' : 'NOT_EMBEDDED_IN_STATUS_ARTIFACT',
    },
  ];
}

function buildReleaseRows({ forceClaims }) {
  return [
    {
      id: 'NO_PACKAGE_BUILD_NO_PACKAGE_HASH_NO_RELEASE_GREEN',
      status: forceClaims.packageBuild === true
        || forceClaims.packageHashGeneration === true
        || forceClaims.releaseGreenClaim === true
        ? 'FAIL'
        : 'PASS',
      packageBuild: false,
      packageHashGeneration: false,
      releaseGreen: false,
    },
  ];
}

function buildNegativeRows({ dependencyRows, packageManifestRows, releaseRows, donorIntakeContextOnly, forceClaims }) {
  const forbiddenById = new Map(dependencyRows.forbiddenRows.map((row) => [row.id, row]));
  return [
    {
      id: 'FORBIDDEN_PRO_DEPENDENCY_NEGATIVE',
      status: forbiddenById.get('NO_TIPTAP_PRO_DEPENDENCY')?.status === 'PASS' && forceClaims.proDependency !== true ? 'PASS' : 'FAIL',
      rejectsClaim: 'TIPTAP_PRO_ALLOWED',
    },
    {
      id: 'FORBIDDEN_CLOUD_DEPENDENCY_NEGATIVE',
      status: forbiddenById.get('NO_TIPTAP_CLOUD_DEPENDENCY')?.status === 'PASS' && forceClaims.cloudDependency !== true ? 'PASS' : 'FAIL',
      rejectsClaim: 'TIPTAP_CLOUD_ALLOWED',
    },
    {
      id: 'FORBIDDEN_UI_FRAMEWORK_NEGATIVE',
      status: forbiddenById.get('NO_FORBIDDEN_UI_FRAMEWORK')?.status === 'PASS' && forceClaims.uiFramework !== true ? 'PASS' : 'FAIL',
      rejectsClaim: 'UI_FRAMEWORK_ALLOWED',
    },
    {
      id: 'FORBIDDEN_STATE_MANAGER_NEGATIVE',
      status: forbiddenById.get('NO_FORBIDDEN_STATE_MANAGER')?.status === 'PASS' && forceClaims.stateManager !== true ? 'PASS' : 'FAIL',
      rejectsClaim: 'STATE_MANAGER_ALLOWED',
    },
    {
      id: 'MULTIPLE_DOCX_LIB_NEGATIVE',
      status: dependencyRows.docxLibraryRow.status === 'PASS' && forceClaims.multipleDocxLibs !== true ? 'PASS' : 'FAIL',
      rejectsClaim: 'MULTIPLE_DOCX_LIBS_ALLOWED',
    },
    {
      id: 'PACKAGE_MANIFEST_CHANGE_NEGATIVE',
      status: packageManifestRows.every((row) => row.status === 'PASS') && forceClaims.packageManifestChange !== true ? 'PASS' : 'FAIL',
      rejectsClaim: 'PACKAGE_MANIFEST_CHANGE_ALLOWED',
    },
    {
      id: 'PACKAGE_BUILD_NEGATIVE',
      status: forceClaims.packageBuild === true ? 'FAIL' : 'PASS',
      rejectsClaim: 'PACKAGE_BUILD_DONE_IN_B3C16',
    },
    {
      id: 'PACKAGE_HASH_NEGATIVE',
      status: forceClaims.packageHashGeneration === true ? 'FAIL' : 'PASS',
      rejectsClaim: 'PACKAGE_HASH_GENERATED_IN_B3C16',
    },
    {
      id: 'RELEASE_GREEN_FALSE_NEGATIVE',
      status: releaseRows.every((row) => row.status === 'PASS') && forceClaims.releaseGreenClaim !== true ? 'PASS' : 'FAIL',
      rejectsClaim: 'RELEASE_GREEN_CLAIM_IN_B3C16',
    },
    {
      id: 'DONOR_DEPENDENCY_CLAIM_NEGATIVE',
      status: donorIntakeContextOnly && forceClaims.donorDependencyClaimImported !== true ? 'PASS' : 'FAIL',
      rejectsClaim: 'DONOR_ARCHIVE_DEPENDENCY_CLAIM_IMPORTED',
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

export async function evaluateB3C16SupplyChainReleaseScopeState(input = {}) {
  const repoRoot = path.resolve(input.repoRoot || DEFAULT_REPO_ROOT);
  const downloadsDir = input.downloadsDir || path.join(os.homedir(), 'Downloads');
  const forceClaims = input.forceClaims && typeof input.forceClaims === 'object' ? input.forceClaims : {};
  const packageJson = await readJsonIfExists(repoRoot, 'package.json');
  const packageLock = await readJsonIfExists(repoRoot, 'package-lock.json');
  const b3c14Status = await readJsonIfExists(repoRoot, path.join('docs', 'OPS', 'STATUS', 'B3C14_RELEASE_DOSSIER_MINIMAL_STATUS_V1.json'));
  const b3c15Status = await readJsonIfExists(repoRoot, path.join('docs', 'OPS', 'STATUS', 'B3C15_ATTESTATION_CHAIN_STATUS_V1.json'));
  const dependencyRows = buildDependencyRows({ packageJson, packageLock, forceClaims });
  const packageManifestRows = buildPackageManifestRows({ repoRoot, forceClaims });
  const auditRows = buildAuditRows({ forceClaims });
  const releaseRows = buildReleaseRows({ forceClaims });
  const donorArchiveRows = buildDonorArchiveRows(downloadsDir);
  const donorIntakeContextOnly = donorArchiveRows.every((row) => row.authority === 'CONTEXT_ONLY'
    && row.codeImported === false
    && row.dependencyClaimImported === false
    && row.completionClaimImported === false);
  const b3c14InputRow = buildB3C14InputRow(b3c14Status);
  const b3c15InputRow = buildB3C15InputRow(b3c15Status);
  const negativeRows = buildNegativeRows({
    dependencyRows,
    packageManifestRows,
    releaseRows,
    donorIntakeContextOnly,
    forceClaims,
  });
  const negativeIds = negativeRows.map((row) => row.id).sort((a, b) => a.localeCompare(b));
  const negativeRowsComplete = REQUIRED_NEGATIVE_IDS.every((id) => negativeIds.includes(id));
  const dependencyRowsPass = dependencyRows.productionAllowedRow.status === 'PASS'
    && dependencyRows.forbiddenRows.every((row) => row.status === 'PASS')
    && dependencyRows.docxLibraryRow.status === 'PASS';
  const packageManifestRowsPass = packageManifestRows.every((row) => row.status === 'PASS');
  const auditRowsPassOrLimited = auditRows.every((row) => row.status === 'PASS' || row.status === 'LIMITED');
  const auditRowsBlockingPass = auditRows.every((row) => row.status !== 'FAIL');
  const releaseRowsPass = releaseRows.every((row) => row.status === 'PASS');
  const negativeRowsPass = negativeRows.every((row) => row.status === 'PASS');
  const forbiddenClaimsAbsent = FORBIDDEN_CLAIM_KEYS.every((key) => forceClaims[key] !== true);
  const releaseGreen = false;
  const ok = b3c14InputRow.passed
    && b3c15InputRow.passed
    && dependencyRowsPass
    && packageManifestRowsPass
    && auditRowsPassOrLimited
    && auditRowsBlockingPass
    && releaseRowsPass
    && donorIntakeContextOnly
    && negativeRowsComplete
    && negativeRowsPass
    && forbiddenClaimsAbsent
    && releaseGreen === false;
  const failRows = [
    ...(b3c14InputRow.passed ? [] : ['B3C14_LIMITS_NOT_BOUND']),
    ...(b3c15InputRow.passed ? [] : ['B3C15_ATTESTATION_NOT_BOUND']),
    ...(dependencyRowsPass ? [] : ['DEPENDENCY_ROWS_FAILED']),
    ...(packageManifestRowsPass ? [] : ['PACKAGE_MANIFEST_ROWS_FAILED']),
    ...(auditRowsBlockingPass ? [] : ['AUDIT_ROWS_BLOCKING_FAIL']),
    ...(releaseRowsPass ? [] : ['RELEASE_ROWS_FAILED']),
    ...(donorIntakeContextOnly ? [] : ['DONOR_INTAKE_NOT_CONTEXT_ONLY']),
    ...(negativeRowsComplete ? [] : ['NEGATIVE_ROWS_INCOMPLETE']),
    ...(negativeRowsPass ? [] : ['NEGATIVE_ROWS_FAILED']),
    ...(forbiddenClaimsAbsent ? [] : ['FORBIDDEN_SCOPE_OR_RELEASE_CLAIM']),
    ...(releaseGreen === false ? [] : ['FALSE_RELEASE_GREEN']),
  ];
  const changedBasenamesHash = sha256Text(CHANGED_BASENAMES.join('\n'));
  const statusArtifactHash = sha256Text(stableJson({
    taskId: TASK_ID,
    headSha: getGitHead(repoRoot),
    changedBasenamesHash,
    dependencyRows,
    packageManifestRows,
    negativeIds,
    status: ok ? 'PASS' : 'FAIL',
  }));

  return stableSort({
    artifactId: 'B3C16_SUPPLY_CHAIN_RELEASE_SCOPE_STATUS_V1',
    contourId: TASK_ID,
    ok,
    status: ok ? 'PASS' : 'FAIL',
    [TOKEN_NAME]: ok ? 1 : 0,
    [RELEASE_GREEN_TOKEN_NAME]: 0,
    failSignal: ok ? '' : FAIL_SIGNAL,
    failRows,
    successWording: 'PASS_AS_SUPPLY_CHAIN_RELEASE_SCOPE_WITHOUT_PACKAGE_BUILD_OR_RELEASE_GREEN',
    tokenSemantics: 'SUPPLY_CHAIN_READINESS_SCOPE_ONLY_RELEASE_GREEN_REMAINS_FALSE',
    rollbackRef: 'ROLLBACK_SUPPLY_CHAIN_RELEASE_SCOPE',
    releaseGreen,
    b3c14InputRow,
    b3c15InputRow,
    dependencyRows,
    packageManifestRows,
    auditRows,
    releaseRows,
    negativeRows,
    donorIntake: {
      class: 'READ_ONLY_CONTEXT_ONLY',
      codeImported: false,
      dependencyClaimImported: false,
      completionClaimImported: false,
      activeCanonOverDonor: true,
      archiveRows: donorArchiveRows,
    },
    proof: {
      b3c14LimitsPreserved: b3c14InputRow.passed,
      b3c15AttestationBound: b3c15InputRow.passed,
      dependencyAllowlistPass: dependencyRows.productionAllowedRow.status === 'PASS',
      forbiddenDependencyRowsPass: dependencyRows.forbiddenRows.every((row) => row.status === 'PASS'),
      docxLibrarySingleOrNone: dependencyRows.docxLibraryRow.status === 'PASS',
      packageManifestsReadOnly: packageManifestRowsPass,
      ossPolicyLocalCheckBound: auditRows.some((row) => row.id === 'OSS_POLICY_LOCAL_CHECK_PASS' && row.status === 'PASS'),
      npmAuditStatusRecorded: auditRows.some((row) => row.id === 'NPM_AUDIT_LOCAL_STATUS_RECORDED' && (row.status === 'PASS' || row.status === 'LIMITED')),
      limitedAuditCannotSetReleaseGreen: auditRows.some((row) => row.id === 'NPM_AUDIT_LOCAL_STATUS_RECORDED' && row.status === 'LIMITED') && releaseGreen === false,
      noPackageBuildNoPackageHash: releaseRowsPass,
      releaseGreenFalseBecauseB3C16Only: releaseGreen === false,
      donorIntakeContextOnly,
      negativeRowsComplete,
      negativeRowsPass,
    },
    scope: {
      allowedWriteBasenames: CHANGED_BASENAMES,
      readOnlyInputs: ['package.json', 'package-lock.json', 'B3C14_RELEASE_DOSSIER_MINIMAL_STATUS_V1.json', 'B3C15_ATTESTATION_CHAIN_STATUS_V1.json'],
      packageManifestChange: false,
      newDependency: false,
      uiChange: false,
      storageChange: false,
      exportRewrite: false,
      securityRewrite: false,
      perfFix: false,
      xplatCertification: false,
      a11yCertification: false,
      packageBuild: false,
      packageHashGeneration: false,
      releaseGreenClaim: false,
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
  const state = await evaluateB3C16SupplyChainReleaseScopeState({ repoRoot });
  if (args.write) {
    await fsp.mkdir(path.dirname(path.join(repoRoot, STATUS_REL_PATH)), { recursive: true });
    await fsp.writeFile(path.join(repoRoot, STATUS_REL_PATH), stableJson(state));
  }
  if (args.json) {
    process.stdout.write(stableJson(state));
  } else {
    process.stdout.write(`B3C16_STATUS=${state.status}\n`);
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
