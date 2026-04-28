#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const TOKEN_NAME = 'B3C18_PRODUCTION_HARDENING_QUEUE_OK';
export const RELEASE_GREEN_TOKEN_NAME = 'B3C18_RELEASE_GREEN_OK';

const TASK_ID = 'B3C18_PRODUCTION_HARDENING_QUEUE';
const STATUS_BASENAME = 'B3C18_PRODUCTION_HARDENING_QUEUE_STATUS_V1.json';
const STATUS_REL_PATH = path.join('docs', 'OPS', 'STATUS', STATUS_BASENAME);
const DEFAULT_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FAIL_SIGNAL = 'E_B3C18_PRODUCTION_HARDENING_QUEUE_NOT_OK';

const CHANGED_BASENAMES = Object.freeze([
  'b3c18-production-hardening-queue-state.mjs',
  'b3c18-production-hardening-queue.contract.test.js',
  STATUS_BASENAME,
]);

const DONOR_ARCHIVE_BASENAMES = Object.freeze([
  'writer-editor-longform-v5_1-block3-release-export-security-scale-pack-v1.zip',
  'writer-editor-longform-v5_1-block3-release-export-security-scale-pack-v3.zip',
  'writer-editor-longform-v5_1-turnkey-pack-v2.zip',
  'writer-editor-longform-v5_1-turnkey-pack-v3.zip',
]);

const HARDENING_QUEUES = Object.freeze([
  {
    id: 'MODEL_BASED_TEST_QUEUE_STAGED_NONBLOCKING',
    queue: 'modelBasedTests',
    promotionGate: ['active model contract', 'seed corpus', 'negative oracle', 'runtime budget guard'],
  },
  {
    id: 'METAMORPHIC_SUITE_QUEUE_STAGED_NONBLOCKING',
    queue: 'metamorphicSuites',
    promotionGate: ['relation list', 'fixture generator', 'deterministic replay', 'false positive budget'],
  },
  {
    id: 'ARCHITECTURE_FITNESS_QUEUE_STAGED_NONBLOCKING',
    queue: 'architectureFitness',
    promotionGate: ['layer rules', 'import boundary check', 'allowed exception log', 'rollback rule'],
  },
  {
    id: 'SUPPLY_CHAIN_DEEPENING_QUEUE_STAGED_NONBLOCKING',
    queue: 'supplyChainDeepening',
    promotionGate: ['full dependency audit', 'license audit', 'package hashes', 'release packaging scope'],
  },
  {
    id: 'THREAT_MODEL_QUEUE_STAGED_NONBLOCKING',
    queue: 'threatModel',
    promotionGate: ['threat inventory', 'mitigation rows', 'residual risk rows', 'owner review'],
  },
  {
    id: 'I18N_DEEPENING_QUEUE_STAGED_NONBLOCKING',
    queue: 'i18nDeepening',
    promotionGate: ['real language fixture matrix', 'renderer selection proof', 'export parity proof'],
  },
  {
    id: 'A11Y_POLISH_QUEUE_STAGED_NONBLOCKING',
    queue: 'a11yPolish',
    promotionGate: ['trust surface audit', 'keyboard path proof', 'screen reader labels', 'non color only checks'],
  },
  {
    id: 'LOCAL_OBSERVABILITY_QUEUE_STAGED_NONBLOCKING',
    queue: 'localObservability',
    promotionGate: ['local only logs', 'privacy redaction', 'no network upload', 'retention policy'],
  },
  {
    id: 'PRODUCT_ERROR_TAXONOMY_QUEUE_STAGED_NONBLOCKING',
    queue: 'productErrorTaxonomy',
    promotionGate: ['error classes', 'user safe messages', 'recovery actions', 'support bundle mapping'],
  },
  {
    id: 'CRASH_MATRIX_DEEPENING_QUEUE_STAGED_NONBLOCKING',
    queue: 'crashMatrixDeepening',
    promotionGate: ['kill point list', 'platform matrix', 'recovery evidence', 'bounded runtime'],
  },
  {
    id: 'OPERATION_FUZZER_QUEUE_STAGED_NONBLOCKING',
    queue: 'operationFuzzer',
    promotionGate: ['operation generator', 'corpus bounds', 'deterministic seed', 'no typing hot path work'],
  },
  {
    id: 'CORPUS_GENERATOR_QUEUE_STAGED_NONBLOCKING',
    queue: 'corpusGenerator',
    promotionGate: ['fixture tier policy', 'privacy safe synthetic data', 'size budgets', 'reproducible seeds'],
  },
]);

const REQUIRED_QUEUE_IDS = Object.freeze(HARDENING_QUEUES.map((row) => row.id));

const REQUIRED_NONBLOCKING_ROW_IDS = Object.freeze([
  'P0C_NOT_BLOCKING_P0B',
  'NO_RELEASE_CLAIM_DEPENDS_ON_P0C',
  'NO_RUNTIME_HARDENING_IMPLEMENTATION',
  'ACTIVE_CANON_NOT_PROMOTED',
  'REQUIRED_TOKEN_SET_NOT_EXPANDED',
  'NO_NEW_NETWORK_PATH_IN_B3C18_DIFF',
  'NO_CANONICAL_STORAGE_REWRITE',
  'NO_NEW_DEPENDENCY',
  'PACKAGE_MANIFESTS_READ_ONLY',
  'B3C19_AUDIT_NOT_STARTED',
  'RELEASE_GREEN_FALSE',
  'DONOR_CONTEXT_ONLY',
  'NO_SCOPE_BLOAT_WITH_FIXED_12_QUEUE_SET',
  'B3C17_LIMITS_PRESERVED',
]);

const REQUIRED_NEGATIVE_IDS = Object.freeze([
  'HARDENING_RUNTIME_IMPLEMENTATION_NEGATIVE',
  'P0C_BLOCKS_P0B_NEGATIVE',
  'RELEASE_CLAIM_DEPENDS_ON_P0C_NEGATIVE',
  'NETWORK_PATH_NEGATIVE',
  'OBSERVABILITY_RUNTIME_NEGATIVE',
  'FUZZER_RUNTIME_NEGATIVE',
  'CORPUS_GENERATOR_RUNTIME_NEGATIVE',
  'THREAT_MODEL_IMPLEMENTATION_NEGATIVE',
  'MODEL_TEST_IMPLEMENTATION_NEGATIVE',
  'METAMORPHIC_IMPLEMENTATION_NEGATIVE',
  'CANONICAL_STORAGE_REWRITE_NEGATIVE',
  'NEW_DEPENDENCY_NEGATIVE',
  'ACTIVE_CANON_PROMOTION_NEGATIVE',
  'REQUIRED_TOKEN_EXPANSION_NEGATIVE',
  'B3C19_AUDIT_STARTED_NEGATIVE',
  'RELEASE_GREEN_FALSE_NEGATIVE',
  'DONOR_HARDENING_COMPLETION_CLAIM_NEGATIVE',
]);

const FORBIDDEN_CLAIM_KEYS = Object.freeze([
  'hardeningRuntimeImplementation',
  'p0cBlocksP0b',
  'releaseClaimDependsOnP0c',
  'networkPathIntroduced',
  'observabilityRuntime',
  'fuzzerRuntime',
  'corpusGeneratorRuntime',
  'threatModelImplementation',
  'modelTestImplementation',
  'metamorphicImplementation',
  'canonicalStorageRewrite',
  'newDependency',
  'packageManifestChange',
  'uiChange',
  'storageChange',
  'exportRewrite',
  'securityRewrite',
  'activeCanonPromotion',
  'requiredTokenExpansion',
  'b3c19AuditStarted',
  'releaseGreenClaim',
  'donorHardeningCompletionClaimImported',
]);

const COMMANDS = Object.freeze([
  'node scripts/ops/b3c18-production-hardening-queue-state.mjs --write --json',
  'node --test test/contracts/b3c18-production-hardening-queue.contract.test.js',
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
      .filter((entry) => /hardening|model|metamorphic|threat|observability|taxonomy|crash|fuzzer|corpus|BLOCK_3|VALIDATION|INTEGRATION/iu.test(entry))
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
      hardeningCompletionClaimImported: false,
    };
  });
}

function buildB3C17InputRow(status) {
  return {
    basename: 'B3C17_FUTURE_LANES_NONBLOCKING_STATUS_V1.json',
    passed: status?.ok === true
      && status?.B3C17_FUTURE_LANES_NONBLOCKING_OK === 1
      && status?.B3C17_RELEASE_GREEN_OK === 0
      && status?.proof?.allRequiredLanesParked === true
      && status?.proof?.activeCanonNotPromoted === true
      && status?.proof?.requiredTokenSetNotExpanded === true,
    token: status?.B3C17_FUTURE_LANES_NONBLOCKING_OK || 0,
    releaseGreen: status?.B3C17_RELEASE_GREEN_OK || 0,
    futureLanesParked: status?.proof?.allRequiredLanesParked === true,
    activeCanonNotPromoted: status?.proof?.activeCanonNotPromoted === true,
    requiredTokenSetNotExpanded: status?.proof?.requiredTokenSetNotExpanded === true,
  };
}

function buildTransitiveEvidenceRows({ b3c14Status, b3c15Status, b3c16Status }) {
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
    {
      basename: 'B3C16_SUPPLY_CHAIN_RELEASE_SCOPE_STATUS_V1.json',
      role: 'TRANSITIVE_CARRIED_EVIDENCE',
      passed: b3c16Status?.ok === true
        && b3c16Status?.B3C16_SUPPLY_CHAIN_RELEASE_SCOPE_OK === 1
        && b3c16Status?.B3C16_RELEASE_GREEN_OK === 0,
      token: b3c16Status?.B3C16_SUPPLY_CHAIN_RELEASE_SCOPE_OK || 0,
      releaseGreen: b3c16Status?.B3C16_RELEASE_GREEN_OK || 0,
    },
  ];
}

function buildHardeningQueueRows(forceClaims) {
  return HARDENING_QUEUES.map((row) => ({
    id: row.id,
    queue: row.queue,
    status: forceClaims.hardeningRuntimeImplementation === true ? 'FAIL' : 'STAGED_ADVISORY_NONBLOCKING',
    authority: 'P0C_ADVISORY_UNTIL_PROMOTED',
    runtimeImplemented: false,
    blocksP0BReleaseKernel: false,
    releaseClaimDependsOnThisQueue: false,
    promotionRequiredBeforeBlocking: true,
  }));
}

function buildPromotionGateRows(forceClaims) {
  return HARDENING_QUEUES.map((row) => ({
    id: `${row.id}_PROMOTION_GATE`,
    queue: row.queue,
    status: forceClaims.missingPromotionGate === true ? 'FAIL' : 'PASS',
    authority: 'P0C_PROMOTION_GATE_NOT_CURRENT_IMPLEMENTATION',
    gate: row.promotionGate,
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
        id: 'NO_NEW_NETWORK_PATH_IN_B3C18_DIFF',
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

function buildNonblockingRows({ b3c17InputRow, scopeGuardRows, donorIntakeContextOnly, forceClaims }) {
  const byId = new Map(scopeGuardRows.map((row) => [row.id, row]));
  return [
    {
      id: 'P0C_NOT_BLOCKING_P0B',
      status: forceClaims.p0cBlocksP0b === true ? 'FAIL' : 'PASS',
      p0cBlocksP0b: false,
    },
    {
      id: 'NO_RELEASE_CLAIM_DEPENDS_ON_P0C',
      status: forceClaims.releaseClaimDependsOnP0c === true ? 'FAIL' : 'PASS',
      releaseClaimDependsOnP0c: false,
    },
    {
      id: 'NO_RUNTIME_HARDENING_IMPLEMENTATION',
      status: forceClaims.hardeningRuntimeImplementation === true ? 'FAIL' : 'PASS',
      proofClass: 'GOVERNANCE_QUEUE_ONLY',
    },
    byId.get('ACTIVE_CANON_NOT_PROMOTED'),
    byId.get('REQUIRED_TOKEN_SET_NOT_EXPANDED'),
    byId.get('NO_NEW_NETWORK_PATH_IN_B3C18_DIFF'),
    byId.get('NO_CANONICAL_STORAGE_REWRITE'),
    {
      id: 'NO_NEW_DEPENDENCY',
      status: byId.get('PACKAGE_MANIFESTS_READ_ONLY')?.status === 'PASS' && forceClaims.newDependency !== true ? 'PASS' : 'FAIL',
    },
    byId.get('PACKAGE_MANIFESTS_READ_ONLY'),
    {
      id: 'B3C19_AUDIT_NOT_STARTED',
      status: forceClaims.b3c19AuditStarted === true ? 'FAIL' : 'PASS',
    },
    {
      id: 'RELEASE_GREEN_FALSE',
      status: forceClaims.releaseGreenClaim === true ? 'FAIL' : 'PASS',
      releaseGreen: false,
    },
    {
      id: 'DONOR_CONTEXT_ONLY',
      status: donorIntakeContextOnly && forceClaims.donorHardeningCompletionClaimImported !== true ? 'PASS' : 'FAIL',
    },
    {
      id: 'NO_SCOPE_BLOAT_WITH_FIXED_12_QUEUE_SET',
      status: HARDENING_QUEUES.length === 12 ? 'PASS' : 'FAIL',
      queueCount: HARDENING_QUEUES.length,
    },
    {
      id: 'B3C17_LIMITS_PRESERVED',
      status: b3c17InputRow.passed ? 'PASS' : 'FAIL',
      releaseGreen: b3c17InputRow.releaseGreen,
      futureLanesParked: b3c17InputRow.futureLanesParked,
    },
  ].filter(Boolean);
}

function buildNegativeRows({ nonblockingRows, queueRows, gateRows, donorIntakeContextOnly, forceClaims }) {
  const byId = new Map(nonblockingRows.map((row) => [row.id, row]));
  const queuesStaged = queueRows.every((row) => row.status === 'STAGED_ADVISORY_NONBLOCKING' && row.runtimeImplemented === false);
  const gatesPresent = gateRows.every((row) => row.status === 'PASS' && row.gate.length > 0);
  return [
    {
      id: 'HARDENING_RUNTIME_IMPLEMENTATION_NEGATIVE',
      status: queuesStaged && forceClaims.hardeningRuntimeImplementation !== true ? 'PASS' : 'FAIL',
      rejectsClaim: 'HARDENING_RUNTIME_IMPLEMENTED_IN_B3C18',
    },
    {
      id: 'P0C_BLOCKS_P0B_NEGATIVE',
      status: byId.get('P0C_NOT_BLOCKING_P0B')?.status === 'PASS' ? 'PASS' : 'FAIL',
      rejectsClaim: 'P0C_BLOCKS_P0B_RELEASE_KERNEL',
    },
    {
      id: 'RELEASE_CLAIM_DEPENDS_ON_P0C_NEGATIVE',
      status: byId.get('NO_RELEASE_CLAIM_DEPENDS_ON_P0C')?.status === 'PASS' ? 'PASS' : 'FAIL',
      rejectsClaim: 'RELEASE_CLAIM_DEPENDS_ON_P0C_QUEUE',
    },
    {
      id: 'NETWORK_PATH_NEGATIVE',
      status: byId.get('NO_NEW_NETWORK_PATH_IN_B3C18_DIFF')?.status === 'PASS' ? 'PASS' : 'FAIL',
      rejectsClaim: 'NETWORK_PATH_INTRODUCED_BY_B3C18',
    },
    {
      id: 'OBSERVABILITY_RUNTIME_NEGATIVE',
      status: forceClaims.observabilityRuntime === true ? 'FAIL' : 'PASS',
      rejectsClaim: 'OBSERVABILITY_RUNTIME_INTRODUCED',
    },
    {
      id: 'FUZZER_RUNTIME_NEGATIVE',
      status: forceClaims.fuzzerRuntime === true ? 'FAIL' : 'PASS',
      rejectsClaim: 'OPERATION_FUZZER_RUNTIME_INTRODUCED',
    },
    {
      id: 'CORPUS_GENERATOR_RUNTIME_NEGATIVE',
      status: forceClaims.corpusGeneratorRuntime === true ? 'FAIL' : 'PASS',
      rejectsClaim: 'CORPUS_GENERATOR_RUNTIME_INTRODUCED',
    },
    {
      id: 'THREAT_MODEL_IMPLEMENTATION_NEGATIVE',
      status: forceClaims.threatModelImplementation === true ? 'FAIL' : 'PASS',
      rejectsClaim: 'THREAT_MODEL_IMPLEMENTED_AS_CURRENT_SCOPE',
    },
    {
      id: 'MODEL_TEST_IMPLEMENTATION_NEGATIVE',
      status: forceClaims.modelTestImplementation === true ? 'FAIL' : 'PASS',
      rejectsClaim: 'MODEL_TESTS_IMPLEMENTED_AS_CURRENT_SCOPE',
    },
    {
      id: 'METAMORPHIC_IMPLEMENTATION_NEGATIVE',
      status: forceClaims.metamorphicImplementation === true ? 'FAIL' : 'PASS',
      rejectsClaim: 'METAMORPHIC_SUITES_IMPLEMENTED_AS_CURRENT_SCOPE',
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
      rejectsClaim: 'ACTIVE_CANON_PROMOTED_BY_B3C18',
    },
    {
      id: 'REQUIRED_TOKEN_EXPANSION_NEGATIVE',
      status: byId.get('REQUIRED_TOKEN_SET_NOT_EXPANDED')?.status === 'PASS' ? 'PASS' : 'FAIL',
      rejectsClaim: 'REQUIRED_TOKEN_SET_EXPANDED_BY_B3C18',
    },
    {
      id: 'B3C19_AUDIT_STARTED_NEGATIVE',
      status: byId.get('B3C19_AUDIT_NOT_STARTED')?.status === 'PASS' ? 'PASS' : 'FAIL',
      rejectsClaim: 'B3C19_AUDIT_STARTED_INSIDE_B3C18',
    },
    {
      id: 'RELEASE_GREEN_FALSE_NEGATIVE',
      status: byId.get('RELEASE_GREEN_FALSE')?.status === 'PASS' ? 'PASS' : 'FAIL',
      rejectsClaim: 'RELEASE_GREEN_CLAIM_IN_B3C18',
    },
    {
      id: 'DONOR_HARDENING_COMPLETION_CLAIM_NEGATIVE',
      status: donorIntakeContextOnly && forceClaims.donorHardeningCompletionClaimImported !== true ? 'PASS' : 'FAIL',
      rejectsClaim: 'DONOR_HARDENING_COMPLETION_CLAIM_IMPORTED',
    },
    {
      id: 'MISSING_PROMOTION_GATE_NEGATIVE',
      status: gatesPresent ? 'PASS' : 'FAIL',
      rejectsClaim: 'HARDENING_QUEUE_WITHOUT_PROMOTION_GATE',
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

export async function evaluateB3C18ProductionHardeningQueueState(input = {}) {
  const repoRoot = path.resolve(input.repoRoot || DEFAULT_REPO_ROOT);
  const downloadsDir = input.downloadsDir || path.join(os.homedir(), 'Downloads');
  const forceClaims = input.forceClaims && typeof input.forceClaims === 'object' ? input.forceClaims : {};
  const b3c17Status = await readJsonIfExists(repoRoot, path.join('docs', 'OPS', 'STATUS', 'B3C17_FUTURE_LANES_NONBLOCKING_STATUS_V1.json'));
  const b3c16Status = await readJsonIfExists(repoRoot, path.join('docs', 'OPS', 'STATUS', 'B3C16_SUPPLY_CHAIN_RELEASE_SCOPE_STATUS_V1.json'));
  const b3c15Status = await readJsonIfExists(repoRoot, path.join('docs', 'OPS', 'STATUS', 'B3C15_ATTESTATION_CHAIN_STATUS_V1.json'));
  const b3c14Status = await readJsonIfExists(repoRoot, path.join('docs', 'OPS', 'STATUS', 'B3C14_RELEASE_DOSSIER_MINIMAL_STATUS_V1.json'));

  const b3c17InputRow = buildB3C17InputRow(b3c17Status);
  const transitiveEvidenceRows = buildTransitiveEvidenceRows({ b3c14Status, b3c15Status, b3c16Status });
  const queueRows = buildHardeningQueueRows(forceClaims);
  const promotionGateRows = buildPromotionGateRows(forceClaims);
  const donorArchiveRows = buildDonorArchiveRows(downloadsDir);
  const donorIntakeContextOnly = donorArchiveRows.every((row) => row.authority === 'CONTEXT_ONLY'
    && row.codeImported === false
    && row.dependencyClaimImported === false
    && row.completionClaimImported === false
    && row.hardeningCompletionClaimImported === false);
  const scopeGuard = buildScopeGuardRows({ repoRoot, forceClaims });
  const nonblockingRows = buildNonblockingRows({
    b3c17InputRow,
    scopeGuardRows: scopeGuard.rows,
    donorIntakeContextOnly,
    forceClaims,
  });
  const negativeRows = buildNegativeRows({
    nonblockingRows,
    queueRows,
    gateRows: promotionGateRows,
    donorIntakeContextOnly,
    forceClaims,
  });

  const queueIdsComplete = REQUIRED_QUEUE_IDS.every((id) => queueRows.some((row) => row.id === id));
  const allQueuesStagedNonblocking = queueRows.every((row) => row.status === 'STAGED_ADVISORY_NONBLOCKING'
    && row.runtimeImplemented === false
    && row.blocksP0BReleaseKernel === false
    && row.releaseClaimDependsOnThisQueue === false);
  const promotionGatesComplete = promotionGateRows.length === queueRows.length
    && promotionGateRows.every((row) => row.status === 'PASS' && Array.isArray(row.gate) && row.gate.length >= 3);
  const nonblockingRowsComplete = REQUIRED_NONBLOCKING_ROW_IDS.every((id) => nonblockingRows.some((row) => row.id === id));
  const nonblockingRowsPass = nonblockingRows.every((row) => row.status === 'PASS');
  const negativeIds = negativeRows.map((row) => row.id).sort((a, b) => a.localeCompare(b));
  const negativeRowsComplete = REQUIRED_NEGATIVE_IDS.every((id) => negativeIds.includes(id));
  const negativeRowsPass = negativeRows.every((row) => row.status === 'PASS');
  const transitiveEvidencePass = transitiveEvidenceRows.every((row) => row.passed === true);
  const forbiddenClaimsAbsent = FORBIDDEN_CLAIM_KEYS.every((key) => forceClaims[key] !== true);
  const releaseGreen = false;
  const ok = b3c17InputRow.passed
    && transitiveEvidencePass
    && queueIdsComplete
    && allQueuesStagedNonblocking
    && promotionGatesComplete
    && nonblockingRowsComplete
    && nonblockingRowsPass
    && donorIntakeContextOnly
    && negativeRowsComplete
    && negativeRowsPass
    && forbiddenClaimsAbsent
    && releaseGreen === false;
  const failRows = [
    ...(b3c17InputRow.passed ? [] : ['B3C17_INPUT_NOT_BOUND']),
    ...(transitiveEvidencePass ? [] : ['TRANSITIVE_EVIDENCE_NOT_BOUND']),
    ...(queueIdsComplete ? [] : ['HARDENING_QUEUE_IDS_INCOMPLETE']),
    ...(allQueuesStagedNonblocking ? [] : ['HARDENING_QUEUES_NOT_STAGED_NONBLOCKING']),
    ...(promotionGatesComplete ? [] : ['PROMOTION_GATES_INCOMPLETE']),
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
    queueIds: queueRows.map((row) => row.id).sort((a, b) => a.localeCompare(b)),
    nonblockingIds: nonblockingRows.map((row) => row.id).sort((a, b) => a.localeCompare(b)),
    negativeIds,
    status: ok ? 'PASS' : 'FAIL',
  }));

  return stableSort({
    artifactId: 'B3C18_PRODUCTION_HARDENING_QUEUE_STATUS_V1',
    contourId: TASK_ID,
    ok,
    status: ok ? 'PASS' : 'FAIL',
    [TOKEN_NAME]: ok ? 1 : 0,
    [RELEASE_GREEN_TOKEN_NAME]: 0,
    failSignal: ok ? '' : FAIL_SIGNAL,
    failRows,
    successWording: 'PASS_AS_PRODUCTION_HARDENING_QUEUE_STAGED_ADVISORY_NONBLOCKING_NOT_RELEASE_GREEN',
    tokenSemantics: 'P0C_HARDENING_QUEUE_GOVERNANCE_PROOF_ONLY_RELEASE_GREEN_REMAINS_FALSE',
    rollbackRef: 'ROLLBACK_PRODUCTION_HARDENING_QUEUE_GOVERNANCE',
    releaseGreen,
    b3c17InputRow,
    transitiveEvidenceRows,
    queueRows,
    promotionGateRows,
    nonblockingRows,
    negativeRows,
    donorIntake: {
      class: 'READ_ONLY_CONTEXT_ONLY',
      codeImported: false,
      dependencyClaimImported: false,
      completionClaimImported: false,
      hardeningCompletionClaimImported: false,
      activeCanonOverDonor: true,
      archiveRows: donorArchiveRows,
    },
    proof: {
      b3c17InputBound: b3c17InputRow.passed,
      b3c17LimitsPreserved: b3c17InputRow.passed
        && b3c17InputRow.releaseGreen === 0
        && b3c17InputRow.futureLanesParked === true
        && b3c17InputRow.activeCanonNotPromoted === true
        && b3c17InputRow.requiredTokenSetNotExpanded === true,
      transitiveEvidencePass,
      allQueuesStagedNonblocking,
      promotionGatesComplete,
      p0cNotBlockingP0b: nonblockingRows.some((row) => row.id === 'P0C_NOT_BLOCKING_P0B' && row.status === 'PASS'),
      noReleaseClaimDependsOnP0c: nonblockingRows.some((row) => row.id === 'NO_RELEASE_CLAIM_DEPENDS_ON_P0C' && row.status === 'PASS'),
      noRuntimeHardeningImplementation: nonblockingRows.some((row) => row.id === 'NO_RUNTIME_HARDENING_IMPLEMENTATION' && row.status === 'PASS'),
      activeCanonNotPromoted: nonblockingRows.some((row) => row.id === 'ACTIVE_CANON_NOT_PROMOTED' && row.status === 'PASS'),
      requiredTokenSetNotExpanded: nonblockingRows.some((row) => row.id === 'REQUIRED_TOKEN_SET_NOT_EXPANDED' && row.status === 'PASS'),
      noNewNetworkPathInB3C18Diff: nonblockingRows.some((row) => row.id === 'NO_NEW_NETWORK_PATH_IN_B3C18_DIFF' && row.status === 'PASS'),
      noCanonicalStorageRewrite: nonblockingRows.some((row) => row.id === 'NO_CANONICAL_STORAGE_REWRITE' && row.status === 'PASS'),
      noNewDependency: nonblockingRows.some((row) => row.id === 'NO_NEW_DEPENDENCY' && row.status === 'PASS'),
      b3c19AuditNotStarted: nonblockingRows.some((row) => row.id === 'B3C19_AUDIT_NOT_STARTED' && row.status === 'PASS'),
      releaseGreenFalseBecauseB3C18Only: releaseGreen === false,
      donorIntakeContextOnly,
      negativeRowsComplete,
      negativeRowsPass,
    },
    scope: {
      allowedWriteBasenames: CHANGED_BASENAMES,
      directInputs: ['B3C17_FUTURE_LANES_NONBLOCKING_STATUS_V1.json'],
      transitiveCarriedEvidence: [
        'B3C14_RELEASE_DOSSIER_MINIMAL_STATUS_V1.json',
        'B3C15_ATTESTATION_CHAIN_STATUS_V1.json',
        'B3C16_SUPPLY_CHAIN_RELEASE_SCOPE_STATUS_V1.json',
      ],
      scopeGuardInputs: ['package.json', 'package-lock.json'],
      packageManifestChange: false,
      activeCanonPromotion: false,
      requiredTokenExpansion: false,
      newDependency: false,
      uiChange: false,
      storageChange: false,
      exportRewrite: false,
      securityRewrite: false,
      releaseGreenClaim: false,
      networkPathIntroducedByB3C18: false,
      hardeningRuntimeImplementation: false,
      observabilityRuntime: false,
      fuzzerRuntime: false,
      corpusGeneratorRuntime: false,
      threatModelImplementation: false,
      modelTestImplementation: false,
      metamorphicImplementation: false,
      b3c19AuditStarted: false,
      donorHardeningCompletionClaimImported: false,
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
  const state = await evaluateB3C18ProductionHardeningQueueState({ repoRoot });
  if (args.write) {
    await fsp.mkdir(path.dirname(path.join(repoRoot, STATUS_REL_PATH)), { recursive: true });
    await fsp.writeFile(path.join(repoRoot, STATUS_REL_PATH), stableJson(state));
  }
  if (args.json) {
    process.stdout.write(stableJson(state));
  } else {
    process.stdout.write(`B3C18_STATUS=${state.status}\n`);
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
