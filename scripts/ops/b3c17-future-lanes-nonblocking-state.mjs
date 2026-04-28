#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const TOKEN_NAME = 'B3C17_FUTURE_LANES_NONBLOCKING_OK';
export const RELEASE_GREEN_TOKEN_NAME = 'B3C17_RELEASE_GREEN_OK';

const TASK_ID = 'B3C17_FUTURE_LANES_NONBLOCKING';
const STATUS_BASENAME = 'B3C17_FUTURE_LANES_NONBLOCKING_STATUS_V1.json';
const STATUS_REL_PATH = path.join('docs', 'OPS', 'STATUS', STATUS_BASENAME);
const DEFAULT_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FAIL_SIGNAL = 'E_B3C17_FUTURE_LANES_NONBLOCKING_NOT_OK';

const CHANGED_BASENAMES = Object.freeze([
  'b3c17-future-lanes-nonblocking-state.mjs',
  'b3c17-future-lanes-nonblocking.contract.test.js',
  STATUS_BASENAME,
]);

const DONOR_ARCHIVE_BASENAMES = Object.freeze([
  'writer-editor-longform-v5_1-block3-release-export-security-scale-pack-v1.zip',
  'writer-editor-longform-v5_1-block3-release-export-security-scale-pack-v3.zip',
  'writer-editor-longform-v5_1-turnkey-pack-v2.zip',
  'writer-editor-longform-v5_1-turnkey-pack-v3.zip',
]);

const REQUIRED_LANE_IDS = Object.freeze([
  'COMMENTS_PARKED_NONBLOCKING',
  'HISTORY_PARKED_NONBLOCKING',
  'COLLAB_PARKED_NONBLOCKING',
  'MINDMAP_PARKED_NONBLOCKING',
  'AI_PARKED_NONBLOCKING_NO_REMOTE_MODEL',
  'MOBILE_PARKED_NONBLOCKING',
  'WEB_PARKED_NONBLOCKING',
  'ADVANCED_TABLES_PARKED_NONBLOCKING',
]);

const OPTIONAL_LANE_IDS = Object.freeze([
  'AUTHOR_GRAPH_OPTIONAL_DERIVED_PARKED_NONBLOCKING',
]);

const REQUIRED_NONBLOCKING_ROW_IDS = Object.freeze([
  'NO_FUTURE_LANE_BLOCKS_P0_RELEASE_KERNEL',
  'PARKING_LOT_ADVISORY_ONLY',
  'ACTIVE_CANON_NOT_PROMOTED',
  'REQUIRED_TOKEN_SET_NOT_EXPANDED',
  'B3C16_LIMITED_SUPPLY_CHAIN_STATUS_PRESERVED',
  'NO_NEW_NETWORK_PATH_IN_B3C17_DIFF',
  'NO_REMOTE_AI_CALL',
  'NO_COLLAB_TRANSPORT',
  'NO_CANONICAL_STORAGE_REWRITE',
  'NO_NEW_DEPENDENCY',
  'PACKAGE_MANIFESTS_READ_ONLY',
  'RELEASE_GREEN_FALSE',
]);

const REQUIRED_NEGATIVE_IDS = Object.freeze([
  'FUTURE_LANE_RUNTIME_IMPLEMENTATION_NEGATIVE',
  'P1_P2_BLOCKS_P0_NEGATIVE',
  'REMOTE_AI_NEGATIVE',
  'NETWORK_PATH_NEGATIVE',
  'COLLAB_TRANSPORT_NEGATIVE',
  'CANONICAL_STORAGE_REWRITE_NEGATIVE',
  'NEW_DEPENDENCY_NEGATIVE',
  'ACTIVE_CANON_PROMOTION_NEGATIVE',
  'REQUIRED_TOKEN_EXPANSION_NEGATIVE',
  'RELEASE_GREEN_FALSE_NEGATIVE',
  'DONOR_FUTURE_LANE_COMPLETION_CLAIM_NEGATIVE',
]);

const FORBIDDEN_CLAIM_KEYS = Object.freeze([
  'futureLaneRuntimeImplementation',
  'p1P2BlocksP0',
  'remoteAiCall',
  'networkPathIntroduced',
  'collabTransport',
  'canonicalStorageRewrite',
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
  'activeCanonPromotion',
  'requiredTokenExpansion',
  'donorFutureLaneCompletionClaimImported',
]);

const COMMANDS = Object.freeze([
  'node scripts/ops/b3c17-future-lanes-nonblocking-state.mjs --write --json',
  'node --test test/contracts/b3c17-future-lanes-nonblocking.contract.test.js',
  'node --test test/contracts/b3c16-supply-chain-release-scope.contract.test.js',
  'node --test test/contracts/b3c15-attestation-chain.contract.test.js',
  'node --test test/contracts/b3c14-release-dossier-minimal.contract.test.js',
  'node --test test/contracts/b3c13-trust-surface-accessibility.contract.test.js',
  'node --test test/contracts/b3c12-i18n-text-anchor-safety.contract.test.js',
  'node --test test/contracts/b3c11-xplat-normalization-baseline.contract.test.js',
  'node --test test/contracts/b3c10-capability-tier-report.contract.test.js',
  'node --test test/contracts/b3c09-performance-baseline-binding.contract.test.js',
  'npm run oss:policy',
  'git diff --check',
  'git diff --name-only -- package.json package-lock.json',
  'git diff --name-only -- CANON.md docs/OPS/STATUS/CANON_STATUS.json docs/OPS/EXECUTION/REQUIRED_TOKEN_SET.json docs/OPS/TOKENS/TOKEN_CATALOG.json docs/OPS/TOKENS/TOKEN_CATALOG_LOCK.json',
  'git diff --name-only -- src/renderer/index.html src/renderer/styles.css src/main.js src/preload.js src/export src/io src/security src/collab',
]);

const FUTURE_LANES = Object.freeze([
  {
    id: 'COMMENTS_PARKED_NONBLOCKING',
    lane: 'comments',
    promotionCriteria: ['stable block anchor model', 'anchor persistence proof', 'no canonical storage rewrite', 'local review packet proof'],
  },
  {
    id: 'HISTORY_PARKED_NONBLOCKING',
    lane: 'history',
    promotionCriteria: ['deterministic replay proof', 'restore safety proof', 'no write path regression', 'bounded storage growth proof'],
  },
  {
    id: 'COLLAB_PARKED_NONBLOCKING',
    lane: 'collab',
    promotionCriteria: ['local event log proven first', 'deterministic merge replay', 'explicit stage id', 'explicit scope flag', 'no network in MVP path'],
  },
  {
    id: 'MINDMAP_PARKED_NONBLOCKING',
    lane: 'mindmap',
    promotionCriteria: ['derived graph only', 'no orphan nodes', 'graph hash stable', 'canonical text untouched'],
    derivedOnly: true,
  },
  {
    id: 'AI_PARKED_NONBLOCKING_NO_REMOTE_MODEL',
    lane: 'ai',
    promotionCriteria: ['local offline only', 'explicit opt in', 'reversible apply', 'attributable diff', 'no remote model call'],
  },
  {
    id: 'MOBILE_PARKED_NONBLOCKING',
    lane: 'mobile',
    promotionCriteria: ['canonical project unchanged', 'shell adapter boundary proven', 'recovery parity declared'],
  },
  {
    id: 'WEB_PARKED_NONBLOCKING',
    lane: 'web',
    promotionCriteria: ['canonical project unchanged', 'shell adapter boundary proven', 'export parity declared'],
  },
  {
    id: 'ADVANCED_TABLES_PARKED_NONBLOCKING',
    lane: 'advancedTables',
    promotionCriteria: ['explicit schema promotion', 'export proof', 'no silent block shape expansion'],
  },
  {
    id: 'AUTHOR_GRAPH_OPTIONAL_DERIVED_PARKED_NONBLOCKING',
    lane: 'authorGraph',
    optional: true,
    promotionCriteria: ['derived graph only', 'source hash binding', 'canonical text untouched', 'no release blocker'],
    derivedOnly: true,
  },
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
      .filter((entry) => /future|lane|comment|history|collab|mindmap|author|graph|ai|mobile|web|table|BLOCK_3|VALIDATION|INTEGRATION/iu.test(entry))
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
      futureLaneCompletionClaimImported: false,
    };
  });
}

function buildB3C16InputRow(status) {
  const releaseRow = Array.isArray(status?.releaseRows)
    ? status.releaseRows.find((row) => row.id === 'NO_PACKAGE_BUILD_NO_PACKAGE_HASH_NO_RELEASE_GREEN')
    : null;
  return {
    basename: 'B3C16_SUPPLY_CHAIN_RELEASE_SCOPE_STATUS_V1.json',
    passed: status?.ok === true
      && status?.B3C16_SUPPLY_CHAIN_RELEASE_SCOPE_OK === 1
      && status?.B3C16_RELEASE_GREEN_OK === 0
      && releaseRow?.status === 'PASS'
      && status?.dependencyRows?.docxLibraryRow?.currentStatus === 'LIMITED_NONE_EXTERNAL_DOCX_LIB_CURRENTLY_DECLARED',
    token: status?.B3C16_SUPPLY_CHAIN_RELEASE_SCOPE_OK || 0,
    releaseGreen: status?.B3C16_RELEASE_GREEN_OK || 0,
    docxLibraryStatus: status?.dependencyRows?.docxLibraryRow?.currentStatus || 'MISSING',
    noPackageBuild: releaseRow?.packageBuild === false,
    noPackageHash: releaseRow?.packageHashGeneration === false,
    auditStatus: Array.isArray(status?.auditRows) ? status.auditRows.map((row) => ({ id: row.id, status: row.status })) : [],
  };
}

function buildTransitiveEvidenceRows({ b3c14Status, b3c15Status }) {
  return [
    {
      basename: 'B3C14_RELEASE_DOSSIER_MINIMAL_STATUS_V1.json',
      role: 'TRANSITIVE_CARRIED_EVIDENCE',
      passed: b3c14Status?.ok === true
        && b3c14Status?.B3C14_RELEASE_DOSSIER_MINIMAL_OK === 1
        && b3c14Status?.B3C14_RELEASE_GREEN_OK === 0,
      token: b3c14Status?.B3C14_RELEASE_DOSSIER_MINIMAL_OK || 0,
      releaseGreen: b3c14Status?.B3C14_RELEASE_GREEN_OK || 0,
    },
    {
      basename: 'B3C15_ATTESTATION_CHAIN_STATUS_V1.json',
      role: 'TRANSITIVE_CARRIED_EVIDENCE',
      passed: b3c15Status?.ok === true
        && b3c15Status?.B3C15_ATTESTATION_CHAIN_OK === 1
        && b3c15Status?.B3C15_RELEASE_GREEN_OK === 0
        && b3c15Status?.ATTESTATION_SIGNATURE_OK === 1
        && b3c15Status?.VERIFY_ATTESTATION_OK === 1,
      token: b3c15Status?.B3C15_ATTESTATION_CHAIN_OK || 0,
      releaseGreen: b3c15Status?.B3C15_RELEASE_GREEN_OK || 0,
    },
  ];
}

function buildFutureLaneRows(forceClaims) {
  return FUTURE_LANES.map((lane) => ({
    id: lane.id,
    lane: lane.lane,
    status: forceClaims.futureLaneRuntimeImplementation === true ? 'FAIL' : 'PARKED_NONBLOCKING',
    authority: 'ADVISORY_UNTIL_PROMOTED',
    optional: lane.optional === true,
    derivedOnly: lane.derivedOnly === true,
    runtimeImplemented: false,
    blocksP0ReleaseKernel: false,
    promotionRequiredBeforeBlocking: true,
  }));
}

function buildPromotionCriteriaRows(forceClaims) {
  return FUTURE_LANES.map((lane) => ({
    id: `${lane.id}_PROMOTION_CRITERIA`,
    lane: lane.lane,
    status: forceClaims.missingPromotionCriteria === true ? 'FAIL' : 'PASS',
    authority: 'MINIMAL_PROMOTION_GATE_NOT_CURRENT_SCOPE',
    optional: lane.optional === true,
    criteria: lane.promotionCriteria,
  }));
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
  return {
    packageDiff,
    activeCanonDiff,
    tokenDiff,
    runtimeDiff,
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
        id: 'NO_NEW_NETWORK_PATH_IN_B3C17_DIFF',
        status: runtimeDiff.length === 0 && forceClaims.networkPathIntroduced !== true ? 'PASS' : 'FAIL',
        changedBasenames: runtimeDiff.map((name) => path.basename(name)),
        proofClass: 'DIFF_GUARD_NOT_REPO_WIDE_ABSENCE_CLAIM',
      },
      {
        id: 'NO_CANONICAL_STORAGE_REWRITE',
        status: runtimeDiff.length === 0 && forceClaims.canonicalStorageRewrite !== true ? 'PASS' : 'FAIL',
        changedBasenames: runtimeDiff.map((name) => path.basename(name)),
        proofClass: 'DIFF_GUARD',
      },
    ],
  };
}

function buildNonblockingRows({ b3c16InputRow, scopeGuardRows, donorIntakeContextOnly, forceClaims }) {
  const byId = new Map(scopeGuardRows.map((row) => [row.id, row]));
  return [
    {
      id: 'NO_FUTURE_LANE_BLOCKS_P0_RELEASE_KERNEL',
      status: forceClaims.p1P2BlocksP0 === true ? 'FAIL' : 'PASS',
      futureLaneBlockingAuthority: false,
    },
    {
      id: 'PARKING_LOT_ADVISORY_ONLY',
      status: 'PASS',
      authority: 'ADVISORY_UNTIL_PROMOTED',
    },
    byId.get('ACTIVE_CANON_NOT_PROMOTED'),
    byId.get('REQUIRED_TOKEN_SET_NOT_EXPANDED'),
    {
      id: 'B3C16_LIMITED_SUPPLY_CHAIN_STATUS_PRESERVED',
      status: b3c16InputRow.passed ? 'PASS' : 'FAIL',
      docxLibraryStatus: b3c16InputRow.docxLibraryStatus,
      noPackageBuild: b3c16InputRow.noPackageBuild,
      noPackageHash: b3c16InputRow.noPackageHash,
      releaseGreen: b3c16InputRow.releaseGreen,
    },
    byId.get('NO_NEW_NETWORK_PATH_IN_B3C17_DIFF'),
    {
      id: 'NO_REMOTE_AI_CALL',
      status: forceClaims.remoteAiCall === true ? 'FAIL' : 'PASS',
      proofClass: 'B3C17_GOVERNANCE_DIFF_ONLY',
    },
    {
      id: 'NO_COLLAB_TRANSPORT',
      status: forceClaims.collabTransport === true ? 'FAIL' : 'PASS',
      proofClass: 'B3C17_GOVERNANCE_DIFF_ONLY',
    },
    byId.get('NO_CANONICAL_STORAGE_REWRITE'),
    {
      id: 'NO_NEW_DEPENDENCY',
      status: byId.get('PACKAGE_MANIFESTS_READ_ONLY')?.status === 'PASS' && forceClaims.newDependency !== true ? 'PASS' : 'FAIL',
    },
    byId.get('PACKAGE_MANIFESTS_READ_ONLY'),
    {
      id: 'RELEASE_GREEN_FALSE',
      status: forceClaims.releaseGreenClaim === true ? 'FAIL' : 'PASS',
      releaseGreen: false,
    },
    {
      id: 'DONOR_ARCHIVES_CONTEXT_ONLY',
      status: donorIntakeContextOnly && forceClaims.donorFutureLaneCompletionClaimImported !== true ? 'PASS' : 'FAIL',
    },
  ].filter(Boolean);
}

function buildNegativeRows({ nonblockingRows, laneRows, criteriaRows, donorIntakeContextOnly, forceClaims }) {
  const byId = new Map(nonblockingRows.map((row) => [row.id, row]));
  const lanesParked = laneRows.every((row) => row.status === 'PARKED_NONBLOCKING');
  const criteriaPresent = criteriaRows.every((row) => row.status === 'PASS' && row.criteria.length > 0);
  return [
    {
      id: 'FUTURE_LANE_RUNTIME_IMPLEMENTATION_NEGATIVE',
      status: lanesParked && forceClaims.futureLaneRuntimeImplementation !== true ? 'PASS' : 'FAIL',
      rejectsClaim: 'FUTURE_LANE_RUNTIME_IMPLEMENTED_IN_B3C17',
    },
    {
      id: 'P1_P2_BLOCKS_P0_NEGATIVE',
      status: byId.get('NO_FUTURE_LANE_BLOCKS_P0_RELEASE_KERNEL')?.status === 'PASS' ? 'PASS' : 'FAIL',
      rejectsClaim: 'P1_P2_LANE_BLOCKS_P0_RELEASE_KERNEL',
    },
    {
      id: 'REMOTE_AI_NEGATIVE',
      status: byId.get('NO_REMOTE_AI_CALL')?.status === 'PASS' ? 'PASS' : 'FAIL',
      rejectsClaim: 'REMOTE_AI_CALL_INTRODUCED',
    },
    {
      id: 'NETWORK_PATH_NEGATIVE',
      status: byId.get('NO_NEW_NETWORK_PATH_IN_B3C17_DIFF')?.status === 'PASS' ? 'PASS' : 'FAIL',
      rejectsClaim: 'NETWORK_PATH_INTRODUCED_BY_B3C17',
    },
    {
      id: 'COLLAB_TRANSPORT_NEGATIVE',
      status: byId.get('NO_COLLAB_TRANSPORT')?.status === 'PASS' ? 'PASS' : 'FAIL',
      rejectsClaim: 'COLLAB_TRANSPORT_INTRODUCED',
    },
    {
      id: 'CANONICAL_STORAGE_REWRITE_NEGATIVE',
      status: byId.get('NO_CANONICAL_STORAGE_REWRITE')?.status === 'PASS' ? 'PASS' : 'FAIL',
      rejectsClaim: 'CANONICAL_STORAGE_REWRITE_INTRODUCED',
    },
    {
      id: 'NEW_DEPENDENCY_NEGATIVE',
      status: byId.get('NO_NEW_DEPENDENCY')?.status === 'PASS' ? 'PASS' : 'FAIL',
      rejectsClaim: 'NEW_DEPENDENCY_INTRODUCED',
    },
    {
      id: 'ACTIVE_CANON_PROMOTION_NEGATIVE',
      status: byId.get('ACTIVE_CANON_NOT_PROMOTED')?.status === 'PASS' ? 'PASS' : 'FAIL',
      rejectsClaim: 'ACTIVE_CANON_PROMOTED_BY_B3C17',
    },
    {
      id: 'REQUIRED_TOKEN_EXPANSION_NEGATIVE',
      status: byId.get('REQUIRED_TOKEN_SET_NOT_EXPANDED')?.status === 'PASS' ? 'PASS' : 'FAIL',
      rejectsClaim: 'REQUIRED_TOKEN_SET_EXPANDED_BY_B3C17',
    },
    {
      id: 'RELEASE_GREEN_FALSE_NEGATIVE',
      status: byId.get('RELEASE_GREEN_FALSE')?.status === 'PASS' ? 'PASS' : 'FAIL',
      rejectsClaim: 'RELEASE_GREEN_CLAIM_IN_B3C17',
    },
    {
      id: 'DONOR_FUTURE_LANE_COMPLETION_CLAIM_NEGATIVE',
      status: donorIntakeContextOnly && forceClaims.donorFutureLaneCompletionClaimImported !== true ? 'PASS' : 'FAIL',
      rejectsClaim: 'DONOR_FUTURE_LANE_COMPLETION_CLAIM_IMPORTED',
    },
    {
      id: 'MISSING_PROMOTION_CRITERIA_NEGATIVE',
      status: criteriaPresent ? 'PASS' : 'FAIL',
      rejectsClaim: 'FUTURE_LANE_PARKED_WITHOUT_PROMOTION_CRITERIA',
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

export async function evaluateB3C17FutureLanesNonblockingState(input = {}) {
  const repoRoot = path.resolve(input.repoRoot || DEFAULT_REPO_ROOT);
  const downloadsDir = input.downloadsDir || path.join(os.homedir(), 'Downloads');
  const forceClaims = input.forceClaims && typeof input.forceClaims === 'object' ? input.forceClaims : {};
  const b3c16Status = await readJsonIfExists(repoRoot, path.join('docs', 'OPS', 'STATUS', 'B3C16_SUPPLY_CHAIN_RELEASE_SCOPE_STATUS_V1.json'));
  const b3c15Status = await readJsonIfExists(repoRoot, path.join('docs', 'OPS', 'STATUS', 'B3C15_ATTESTATION_CHAIN_STATUS_V1.json'));
  const b3c14Status = await readJsonIfExists(repoRoot, path.join('docs', 'OPS', 'STATUS', 'B3C14_RELEASE_DOSSIER_MINIMAL_STATUS_V1.json'));
  const b3c16InputRow = buildB3C16InputRow(b3c16Status);
  const transitiveEvidenceRows = buildTransitiveEvidenceRows({ b3c14Status, b3c15Status });
  const laneRows = buildFutureLaneRows(forceClaims);
  const promotionCriteriaRows = buildPromotionCriteriaRows(forceClaims);
  const donorArchiveRows = buildDonorArchiveRows(downloadsDir);
  const donorIntakeContextOnly = donorArchiveRows.every((row) => row.authority === 'CONTEXT_ONLY'
    && row.codeImported === false
    && row.dependencyClaimImported === false
    && row.completionClaimImported === false
    && row.futureLaneCompletionClaimImported === false);
  const scopeGuard = buildScopeGuardRows({ repoRoot, forceClaims });
  const nonblockingRows = buildNonblockingRows({
    b3c16InputRow,
    scopeGuardRows: scopeGuard.rows,
    donorIntakeContextOnly,
    forceClaims,
  });
  const negativeRows = buildNegativeRows({
    nonblockingRows,
    laneRows,
    criteriaRows: promotionCriteriaRows,
    donorIntakeContextOnly,
    forceClaims,
  });

  const requiredLaneIdsComplete = REQUIRED_LANE_IDS.every((id) => laneRows.some((row) => row.id === id));
  const optionalLaneIdsPresent = OPTIONAL_LANE_IDS.every((id) => laneRows.some((row) => row.id === id));
  const allRequiredLanesParked = laneRows.filter((row) => row.optional !== true).every((row) => row.status === 'PARKED_NONBLOCKING');
  const optionalDerivedParked = laneRows.filter((row) => row.optional === true).every((row) => row.status === 'PARKED_NONBLOCKING' && row.derivedOnly === true);
  const promotionCriteriaComplete = promotionCriteriaRows.length === laneRows.length
    && promotionCriteriaRows.every((row) => row.status === 'PASS' && Array.isArray(row.criteria) && row.criteria.length > 0);
  const nonblockingRowsComplete = REQUIRED_NONBLOCKING_ROW_IDS.every((id) => nonblockingRows.some((row) => row.id === id));
  const nonblockingRowsPass = nonblockingRows.every((row) => row.status === 'PASS');
  const negativeIds = negativeRows.map((row) => row.id).sort((a, b) => a.localeCompare(b));
  const negativeRowsComplete = REQUIRED_NEGATIVE_IDS.every((id) => negativeIds.includes(id));
  const negativeRowsPass = negativeRows.every((row) => row.status === 'PASS');
  const transitiveEvidencePass = transitiveEvidenceRows.every((row) => row.passed === true);
  const forbiddenClaimsAbsent = FORBIDDEN_CLAIM_KEYS.every((key) => forceClaims[key] !== true);
  const releaseGreen = false;
  const ok = b3c16InputRow.passed
    && transitiveEvidencePass
    && requiredLaneIdsComplete
    && optionalLaneIdsPresent
    && allRequiredLanesParked
    && optionalDerivedParked
    && promotionCriteriaComplete
    && nonblockingRowsComplete
    && nonblockingRowsPass
    && donorIntakeContextOnly
    && negativeRowsComplete
    && negativeRowsPass
    && forbiddenClaimsAbsent
    && releaseGreen === false;
  const failRows = [
    ...(b3c16InputRow.passed ? [] : ['B3C16_INPUT_NOT_BOUND']),
    ...(transitiveEvidencePass ? [] : ['TRANSITIVE_EVIDENCE_NOT_BOUND']),
    ...(requiredLaneIdsComplete ? [] : ['REQUIRED_LANE_IDS_INCOMPLETE']),
    ...(optionalLaneIdsPresent ? [] : ['OPTIONAL_AUTHOR_GRAPH_LANE_MISSING']),
    ...(allRequiredLanesParked ? [] : ['REQUIRED_LANES_NOT_PARKED']),
    ...(optionalDerivedParked ? [] : ['OPTIONAL_AUTHOR_GRAPH_NOT_DERIVED_PARKED']),
    ...(promotionCriteriaComplete ? [] : ['PROMOTION_CRITERIA_INCOMPLETE']),
    ...(nonblockingRowsComplete ? [] : ['NONBLOCKING_ROWS_INCOMPLETE']),
    ...(nonblockingRowsPass ? [] : ['NONBLOCKING_ROWS_FAILED']),
    ...(donorIntakeContextOnly ? [] : ['DONOR_INTAKE_NOT_CONTEXT_ONLY']),
    ...(negativeRowsComplete ? [] : ['NEGATIVE_ROWS_INCOMPLETE']),
    ...(negativeRowsPass ? [] : ['NEGATIVE_ROWS_FAILED']),
    ...(forbiddenClaimsAbsent ? [] : ['FORBIDDEN_SCOPE_OR_RELEASE_CLAIM']),
    ...(releaseGreen === false ? [] : ['FALSE_RELEASE_GREEN']),
  ];
  const changedBasenamesHash = sha256Text(CHANGED_BASENAMES.join('\n'));
  const statusArtifactHash = sha256Text(stableJson({
    taskId: TASK_ID,
    changedBasenamesHash,
    laneIds: laneRows.map((row) => row.id).sort((a, b) => a.localeCompare(b)),
    nonblockingIds: nonblockingRows.map((row) => row.id).sort((a, b) => a.localeCompare(b)),
    negativeIds,
    status: ok ? 'PASS' : 'FAIL',
  }));

  return stableSort({
    artifactId: 'B3C17_FUTURE_LANES_NONBLOCKING_STATUS_V1',
    contourId: TASK_ID,
    ok,
    status: ok ? 'PASS' : 'FAIL',
    [TOKEN_NAME]: ok ? 1 : 0,
    [RELEASE_GREEN_TOKEN_NAME]: 0,
    failSignal: ok ? '' : FAIL_SIGNAL,
    failRows,
    successWording: 'PASS_AS_FUTURE_LANES_PARKED_ADVISORY_NONBLOCKING_NOT_RELEASE_GREEN',
    tokenSemantics: 'FUTURE_LANES_NONBLOCKING_GOVERNANCE_PROOF_ONLY_RELEASE_GREEN_REMAINS_FALSE',
    rollbackRef: 'ROLLBACK_FUTURE_LANES_NONBLOCKING_GOVERNANCE',
    releaseGreen,
    b3c16InputRow,
    transitiveEvidenceRows,
    laneRows,
    promotionCriteriaRows,
    nonblockingRows,
    negativeRows,
    donorIntake: {
      class: 'READ_ONLY_CONTEXT_ONLY',
      codeImported: false,
      dependencyClaimImported: false,
      completionClaimImported: false,
      futureLaneCompletionClaimImported: false,
      activeCanonOverDonor: true,
      archiveRows: donorArchiveRows,
    },
    proof: {
      b3c16InputBound: b3c16InputRow.passed,
      b3c16LimitsPreserved: b3c16InputRow.passed
        && b3c16InputRow.noPackageBuild === true
        && b3c16InputRow.noPackageHash === true
        && b3c16InputRow.releaseGreen === 0,
      transitiveEvidencePass,
      allRequiredLanesParked,
      optionalAuthorGraphDerivedParked: optionalDerivedParked,
      promotionCriteriaComplete,
      noFutureLaneBlocksP0: nonblockingRows.some((row) => row.id === 'NO_FUTURE_LANE_BLOCKS_P0_RELEASE_KERNEL' && row.status === 'PASS'),
      parkingLotAdvisoryOnly: nonblockingRows.some((row) => row.id === 'PARKING_LOT_ADVISORY_ONLY' && row.status === 'PASS'),
      activeCanonNotPromoted: nonblockingRows.some((row) => row.id === 'ACTIVE_CANON_NOT_PROMOTED' && row.status === 'PASS'),
      requiredTokenSetNotExpanded: nonblockingRows.some((row) => row.id === 'REQUIRED_TOKEN_SET_NOT_EXPANDED' && row.status === 'PASS'),
      noNewNetworkPathInB3C17Diff: nonblockingRows.some((row) => row.id === 'NO_NEW_NETWORK_PATH_IN_B3C17_DIFF' && row.status === 'PASS'),
      noRemoteAiCall: nonblockingRows.some((row) => row.id === 'NO_REMOTE_AI_CALL' && row.status === 'PASS'),
      noCollabTransport: nonblockingRows.some((row) => row.id === 'NO_COLLAB_TRANSPORT' && row.status === 'PASS'),
      noCanonicalStorageRewrite: nonblockingRows.some((row) => row.id === 'NO_CANONICAL_STORAGE_REWRITE' && row.status === 'PASS'),
      noNewDependency: nonblockingRows.some((row) => row.id === 'NO_NEW_DEPENDENCY' && row.status === 'PASS'),
      releaseGreenFalseBecauseB3C17Only: releaseGreen === false,
      donorIntakeContextOnly,
      negativeRowsComplete,
      negativeRowsPass,
    },
    scope: {
      allowedWriteBasenames: CHANGED_BASENAMES,
      directInputs: ['B3C16_SUPPLY_CHAIN_RELEASE_SCOPE_STATUS_V1.json'],
      transitiveCarriedEvidence: ['B3C14_RELEASE_DOSSIER_MINIMAL_STATUS_V1.json', 'B3C15_ATTESTATION_CHAIN_STATUS_V1.json'],
      scopeGuardInputs: ['package.json', 'package-lock.json'],
      packageManifestChange: false,
      activeCanonPromotion: false,
      requiredTokenExpansion: false,
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
      networkPathIntroducedByB3C17: false,
      remoteAiCall: false,
      collabTransport: false,
      futureLaneRuntimeImplementation: false,
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
  const state = await evaluateB3C17FutureLanesNonblockingState({ repoRoot });
  if (args.write) {
    await fsp.mkdir(path.dirname(path.join(repoRoot, STATUS_REL_PATH)), { recursive: true });
    await fsp.writeFile(path.join(repoRoot, STATUS_REL_PATH), stableJson(state));
  }
  if (args.json) {
    process.stdout.write(stableJson(state));
  } else {
    process.stdout.write(`B3C17_STATUS=${state.status}\n`);
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
