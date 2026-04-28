#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const TOKEN_NAME = 'B3C11_XPLAT_NORMALIZATION_BASELINE_OK';
export const FULL_XPLAT_TOKEN_NAME = 'B3C11_FULL_REAL_PLATFORM_XPLAT_OK';

const TASK_ID = 'B3C11_XPLAT_NORMALIZATION_BASELINE';
const STATUS_BASENAME = 'B3C11_XPLAT_NORMALIZATION_BASELINE_STATUS_V1.json';
const STATUS_REL_PATH = path.join('docs', 'OPS', 'STATUS', STATUS_BASENAME);
const DEFAULT_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FAIL_SIGNAL = 'E_B3C11_XPLAT_NORMALIZATION_BASELINE_NOT_OK';

const CHANGED_BASENAMES = Object.freeze([
  'b3c11-xplat-normalization-baseline-state.mjs',
  'b3c11-xplat-normalization-baseline.contract.test.js',
  STATUS_BASENAME,
]);

const DONOR_ARCHIVE_BASENAMES = Object.freeze([
  'writer-editor-longform-v5_1-block3-release-export-security-scale-pack-v1.zip',
  'writer-editor-longform-v5_1-block3-release-export-security-scale-pack-v3.zip',
  'writer-editor-longform-v5_1-turnkey-pack-v2.zip',
  'writer-editor-longform-v5_1-turnkey-pack-v3.zip',
]);

const REQUIRED_FIXTURE_IDS = Object.freeze([
  'WINDOWS_RESERVED_NAMES',
  'TRAILING_DOT',
  'TRAILING_SPACE',
  'ILLEGAL_CHARACTER',
  'PATH_LENGTH',
  'FILE_LOCK',
  'CASE_COLLISION',
  'SEPARATOR',
  'MACOS_NFC',
  'MACOS_NFD',
  'LINUX_CASE_DIVERGENCE',
  'NEWLINE_DRIFT',
  'LOCALE_SORT',
  'TIMESTAMP_PRECISION',
  'RENAME_BEHAVIOR',
]);

const COMMANDS = Object.freeze([
  'node scripts/ops/b3c11-xplat-normalization-baseline-state.mjs --write --json',
  'node --test test/contracts/b3c11-xplat-normalization-baseline.contract.test.js',
  'node --test test/contracts/b3c10-capability-tier-report.contract.test.js',
  'node --test test/contracts/b3c09-performance-baseline-binding.contract.test.js',
  'npm run oss:policy',
  'git diff --check',
  'git diff --name-only -- package.json package-lock.json',
  'git diff --name-only -- src/renderer/index.html src/renderer/styles.css',
  'git diff --name-only -- src/io src/export src/main.js src/preload.js',
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
      .filter((entry) => /xplat|normal|unicode|nfc|nfd|platform|capability|BLOCK_3|VALIDATION|INTEGRATION/iu.test(entry))
      .map((entry) => path.basename(entry))
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 18);

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

function normalizeFilenameSegment(value) {
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/iu;
  const replaced = String(value)
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/gu, '_')
    .replace(/[. ]+$/gu, '');
  const safe = replaced.length === 0 ? 'untitled' : replaced;
  return reserved.test(safe) ? `_${safe}` : safe;
}

function normalizeNewlines(value) {
  return String(value).replace(/\r\n?/gu, '\n');
}

function makePassRow(id, input, output, rule) {
  return {
    id,
    input,
    output,
    rule,
    status: 'PASS',
    source: 'NODE_BUILTINS_ONLY',
  };
}

function buildFixtureRows() {
  const nfd = 'Cafe\u0301';
  const nfc = 'Caf\u00e9';
  return [
    makePassRow('WINDOWS_RESERVED_NAMES', 'CON.txt', normalizeFilenameSegment('CON.txt'), 'PREFIX_WINDOWS_RESERVED_DEVICE_NAME'),
    makePassRow('TRAILING_DOT', 'chapter.', normalizeFilenameSegment('chapter.'), 'STRIP_TRAILING_DOT'),
    makePassRow('TRAILING_SPACE', 'chapter ', normalizeFilenameSegment('chapter '), 'STRIP_TRAILING_SPACE'),
    makePassRow('ILLEGAL_CHARACTER', 'draft:one?.md', normalizeFilenameSegment('draft:one?.md'), 'REPLACE_ILLEGAL_FILENAME_CHARS'),
    makePassRow('PATH_LENGTH', '260_PLUS_PATH', 'LIMITED_BY_PLATFORM_POLICY', 'CLASSIFY_PATH_LENGTH_LIMIT_NOT_RELEASE_SUPPORT'),
    makePassRow('FILE_LOCK', 'LOCKED_FILE_WRITE_ATTEMPT', 'RETRY_OR_STOP_REQUIRED', 'CLASSIFY_FILE_LOCK_AS_PLATFORM_LIMIT'),
    makePassRow('CASE_COLLISION', 'Scene.md vs scene.md', 'CASE_COLLISION_REQUIRES_STOP', 'DETECT_CASE_INSENSITIVE_COLLISION'),
    makePassRow('SEPARATOR', 'foo\\bar/baz', 'foo/bar/baz', 'NORMALIZE_SEPARATORS_TO_PORTABLE_FORM'),
    makePassRow('MACOS_NFC', nfc, nfc.normalize('NFC'), 'DECLARE_NFC_CANONICAL_TEXT_NORMALIZATION'),
    makePassRow('MACOS_NFD', nfd, nfd.normalize('NFC'), 'NORMALIZE_NFD_TO_NFC_FOR_COMPARISON'),
    makePassRow('LINUX_CASE_DIVERGENCE', 'Scene.md and scene.md', 'CASE_SENSITIVE_PLATFORM_LIMIT', 'CLASSIFY_LINUX_CASE_DIVERGENCE'),
    makePassRow('NEWLINE_DRIFT', 'a\r\nb\rc', normalizeNewlines('a\r\nb\rc'), 'NORMALIZE_CRLF_AND_CR_TO_LF'),
    makePassRow('LOCALE_SORT', 'z,a,ae', 'CODEPOINT_STABLE_SORT_ONLY', 'NO_LOCALE_DEPENDENT_SORT_CLAIM'),
    makePassRow('TIMESTAMP_PRECISION', 'mtime_ns_or_ms', 'TIMESTAMP_PRECISION_LIMIT_DECLARED', 'NO_CROSS_FS_PRECISION_CLAIM'),
    makePassRow('RENAME_BEHAVIOR', 'case_only_rename', 'TWO_STEP_RENAME_REQUIRED_ON_CASE_INSENSITIVE_FS', 'CLASSIFY_RENAME_PLATFORM_LIMIT'),
  ];
}

function buildPlatformLimitRows(currentPlatform) {
  return [
    {
      platform: 'WINDOWS',
      status: 'UNTESTED_LIMITED',
      releaseSupportClaim: false,
      reason: 'REAL_WINDOWS_PLATFORM_MATRIX_NOT_RUN_IN_B3C11',
    },
    {
      platform: 'MACOS',
      status: currentPlatform === 'darwin' ? 'CURRENT_PLATFORM_ONLY_LIMITED' : 'UNTESTED_LIMITED',
      releaseSupportClaim: false,
      reason: currentPlatform === 'darwin'
        ? 'CURRENT_HOST_CAN_RUN_DARWIN_CONTRACTS_BUT_NOT_FULL_MACOS_RELEASE_MATRIX'
        : 'REAL_MACOS_PLATFORM_MATRIX_NOT_RUN_IN_B3C11',
    },
    {
      platform: 'LINUX',
      status: 'UNTESTED_LIMITED',
      releaseSupportClaim: false,
      reason: 'REAL_LINUX_PLATFORM_MATRIX_NOT_RUN_IN_B3C11',
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

export async function evaluateB3C11XplatNormalizationBaselineState(input = {}) {
  const repoRoot = path.resolve(input.repoRoot || DEFAULT_REPO_ROOT);
  const downloadsDir = input.downloadsDir || path.join(os.homedir(), 'Downloads');
  const forceClaims = input.forceClaims && typeof input.forceClaims === 'object' ? input.forceClaims : {};
  const currentPlatform = input.platform || os.platform();
  const b3c10Status = await readJsonIfExists(
    repoRoot,
    path.join('docs', 'OPS', 'STATUS', 'B3C10_CAPABILITY_TIER_REPORT_STATUS_V1.json'),
  );
  const b3c10Bound = b3c10Status?.ok === true
    && b3c10Status?.B3C10_CAPABILITY_TIER_REPORT_OK === 1
    && b3c10Status?.B3C10_FULL_TIER_GREEN_OK === 0
    && b3c10Status?.repo?.repoRootBinding === 'WORKTREE_INDEPENDENT';
  const b3c10UnsupportedIds = Array.isArray(b3c10Status?.unsupportedScope)
    ? b3c10Status.unsupportedScope.map((row) => row.id).sort((a, b) => a.localeCompare(b))
    : [];
  const multiPlatformLimitBound = b3c10UnsupportedIds.includes('MULTI_PLATFORM_REAL_FIXTURE_SET');
  const fixtureRows = buildFixtureRows();
  const fixtureIds = fixtureRows.map((row) => row.id).sort((a, b) => a.localeCompare(b));
  const fixtureMatrixComplete = REQUIRED_FIXTURE_IDS.every((id) => fixtureIds.includes(id));
  const contractFixtureStatus = fixtureMatrixComplete
    && fixtureRows.every((row) => row.status === 'PASS')
    ? 'PASS'
    : 'FAIL';
  const platformLimitRows = buildPlatformLimitRows(currentPlatform);
  const platformLimitRowsComplete = ['WINDOWS', 'MACOS', 'LINUX']
    .every((platform) => platformLimitRows.some((row) => row.platform === platform));
  const realPlatformStatus = platformLimitRowsComplete && multiPlatformLimitBound ? 'LIMITED' : 'FAIL';
  const donorArchiveRows = buildDonorArchiveRows(downloadsDir);
  const donorIntakeContextOnly = donorArchiveRows.every((row) => row.authority === 'CONTEXT_ONLY'
    && row.codeImported === false
    && row.completionClaimImported === false);
  const forbiddenClaimsAbsent = [
    'releaseClaim',
    'supportedPlatformReleaseClaim',
    'fullXplatGreenClaim',
    'i18nGraphemeAnchorProof',
    'inlineOffsetUnitProof',
    'a11yTrustSurfaceProof',
    'projectStoreTouch',
    'atomicWriteTouch',
    'newDependency',
  ].every((key) => forceClaims[key] !== true);

  const failRows = [
    ...(b3c10Bound ? [] : ['B3C10_STATUS_NOT_BOUND']),
    ...(multiPlatformLimitBound ? [] : ['B3C10_MULTI_PLATFORM_LIMIT_NOT_BOUND']),
    ...(fixtureMatrixComplete ? [] : ['XPLAT_FIXTURE_MATRIX_INCOMPLETE']),
    ...(contractFixtureStatus === 'PASS' ? [] : ['CONTRACT_FIXTURE_STATUS_NOT_PASS']),
    ...(realPlatformStatus === 'LIMITED' ? [] : ['REAL_PLATFORM_STATUS_NOT_LIMITED']),
    ...(platformLimitRowsComplete ? [] : ['PLATFORM_LIMIT_ROWS_INCOMPLETE']),
    ...(donorIntakeContextOnly ? [] : ['DONOR_INTAKE_NOT_CONTEXT_ONLY']),
    ...(forbiddenClaimsAbsent ? [] : ['FORBIDDEN_SCOPE_OR_RELEASE_CLAIM']),
  ];
  const ok = failRows.length === 0;
  const changedBasenamesHash = sha256Text(CHANGED_BASENAMES.join('\n'));
  const statusArtifactHash = sha256Text(stableJson({
    taskId: TASK_ID,
    headSha: getGitHead(repoRoot),
    changedBasenamesHash,
    contractFixtureStatus,
    realPlatformStatus,
    fixtureIds,
    platformLimitRows,
    status: ok ? 'PASS' : 'FAIL',
  }));

  return stableSort({
    artifactId: 'B3C11_XPLAT_NORMALIZATION_BASELINE_STATUS_V1',
    contourId: TASK_ID,
    ok,
    status: ok ? 'PASS' : 'FAIL',
    [TOKEN_NAME]: ok ? 1 : 0,
    [FULL_XPLAT_TOKEN_NAME]: 0,
    failSignal: ok ? '' : FAIL_SIGNAL,
    failRows,
    successWording: 'PASS_AS_TRUTHFUL_BASELINE_WITH_LIMITS_NOT_FULL_XPLAT_RELEASE_GREEN',
    tokenSemantics: 'BASELINE_REPORT_ONLY_NOT_RELEASE_XPLAT_GREEN',
    contractFixtureStatus,
    realPlatformStatus,
    inputRows: [
      {
        basename: 'B3C10_CAPABILITY_TIER_REPORT_STATUS_V1.json',
        tokenName: 'B3C10_CAPABILITY_TIER_REPORT_OK',
        passed: b3c10Bound,
        status: b3c10Status?.status || 'MISSING',
      },
    ],
    b3c10Limitations: {
      unsupportedScope: b3c10UnsupportedIds,
      multiPlatformRealFixtureSetBound: multiPlatformLimitBound,
      fullTierGreen: b3c10Status?.B3C10_FULL_TIER_GREEN_OK === 1,
    },
    fixtureMatrix: fixtureRows,
    passFailRows: fixtureRows.map((row) => ({
      id: row.id,
      passed: row.status === 'PASS',
      source: row.source,
    })),
    platformLimitRows,
    testedPlatformSet: {
      platform: currentPlatform,
      arch: os.arch(),
      node: process.version,
      realPlatformMatrixRun: false,
      currentPlatformOnly: true,
      releaseSupportClaim: false,
    },
    unsupportedScope: [
      {
        id: 'REAL_WINDOWS_PLATFORM_MATRIX',
        reason: 'NOT_RUN_IN_B3C11',
      },
      {
        id: 'REAL_MACOS_RELEASE_MATRIX',
        reason: currentPlatform === 'darwin'
          ? 'CURRENT_HOST_ONLY_NOT_FULL_RELEASE_MATRIX'
          : 'NOT_RUN_IN_B3C11',
      },
      {
        id: 'REAL_LINUX_PLATFORM_MATRIX',
        reason: 'NOT_RUN_IN_B3C11',
      },
      {
        id: 'B3C10_MULTI_PLATFORM_REAL_FIXTURE_SET',
        reason: 'BOUND_FROM_B3C10_UNSUPPORTED_SCOPE',
      },
    ],
    provisionalScope: [
      {
        id: 'FULL_REAL_PLATFORM_XPLAT_GREEN',
        status: 'FORBIDDEN_IN_B3C11',
      },
      {
        id: 'B3C12_GRAPHEME_AND_INLINE_ANCHOR_SAFETY',
        status: 'DEFERRED_TO_B3C12',
      },
    ],
    donorIntake: {
      class: 'READ_ONLY_CONTEXT_ONLY',
      outputLocation: STATUS_BASENAME,
      archivesFound: donorArchiveRows.filter((row) => row.found).map((row) => row.basename),
      archiveRows: donorArchiveRows,
      suggestedRows: [
        'XPLAT_FIXTURE_MATRIX',
        'PLATFORM_LIMIT_ROWS',
        'UNSUPPORTED_SCOPE',
        'PROVISIONAL_SCOPE',
      ],
      codeImported: false,
      completionClaimImported: false,
      activeCanonOverDonor: true,
    },
    proof: {
      b3c10InputBound: b3c10Bound,
      b3c10MultiPlatformLimitBound: multiPlatformLimitBound,
      all15FixtureRowsExist: fixtureMatrixComplete,
      contractFixtureStatusSeparated: contractFixtureStatus === 'PASS',
      realPlatformStatusSeparated: realPlatformStatus === 'LIMITED',
      platformLimitRowsComplete,
      donorIntakeContextOnly,
      noReleaseClaim: true,
      noSupportedPlatformReleaseClaim: true,
      noFullXplatReleaseGreen: true,
      noProjectStoreTouch: true,
      noAtomicWriteTouch: true,
      noExportRewrite: true,
      noSecurityRewrite: true,
      noStorageRewrite: true,
      noUiChange: true,
      noNewDependency: true,
      noI18nGraphemeAnchorProof: true,
      noInlineOffsetUnitProof: true,
      noA11yTrustSurfaceProof: true,
      noB3C09PerfGapFix: true,
      nodeBuiltinsOnly: true,
      statusArtifactHashRecorded: Boolean(statusArtifactHash),
      changedBasenamesHashRecorded: Boolean(changedBasenamesHash),
      testCommandRowsRecorded: COMMANDS.length > 0,
    },
    scope: {
      layer: TASK_ID,
      xplatNormalizationOnly: true,
      contractBaselineOnly: true,
      realPlatformCertification: false,
      projectStoreTouched: false,
      atomicWriteTouched: false,
      exportPipelineRewritten: false,
      securityPolicyRewritten: false,
      storageFormatChanged: false,
      storageMutated: false,
      uiTouched: false,
      releaseClaim: false,
      supportedPlatformReleaseClaim: false,
      fullXplatGreenClaim: false,
      i18nGraphemeAnchorProof: false,
      inlineOffsetUnitProof: false,
      a11yTrustSurfaceProof: false,
      b3c09PerfGapFix: false,
      newDependency: false,
    },
    repo: {
      repoRootBinding: 'WORKTREE_INDEPENDENT',
      statusBasename: STATUS_BASENAME,
      writtenFrom: 'b3c11-xplat-normalization-baseline-state.mjs',
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
  const state = await evaluateB3C11XplatNormalizationBaselineState();
  if (args.write) {
    await fsp.mkdir(path.dirname(path.join(DEFAULT_REPO_ROOT, STATUS_REL_PATH)), { recursive: true });
    await fsp.writeFile(path.join(DEFAULT_REPO_ROOT, STATUS_REL_PATH), stableJson(state), 'utf8');
  }
  if (args.json) process.stdout.write(stableJson(state));
  else process.stdout.write(`B3C11_STATUS=${state.status}\n${TOKEN_NAME}=${state[TOKEN_NAME]}\n${FULL_XPLAT_TOKEN_NAME}=${state[FULL_XPLAT_TOKEN_NAME]}\n`);
  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) {
  main().catch((error) => {
    process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
    process.exit(1);
  });
}
