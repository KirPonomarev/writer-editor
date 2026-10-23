#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import minimumInterchange from '../../src/core/minimum-interchange-v1.cjs';
import writerLocal from '../../src/core/writer-local-profile-v1.cjs';
import entitlementLaw from '../../src/core/entitlement-law-v1.cjs';

const MODE_RELEASE = 'release';
const MODE_PROMOTION = 'promotion';
const RESULT_PASS = 'PASS';
const RESULT_WARN = 'WARN';
const RESULT_FAIL = 'FAIL';
const TOKEN_NAME = 'RELEASE_CANDIDATE_LOCK_MATCH_OK';
const FAIL_SIGNAL = 'E_RELEASE_CANDIDATE_DRIFT';
const TOOL_VERSION = 'release-candidate.v1';
const DEFAULT_MENU_SNAPSHOT_ID = 'menu-default-desktop-minimal';

const DEFAULT_LOCK_PATH = 'docs/OPS/STATUS/RELEASE_CANDIDATE_LOCK.json';
const DEFAULT_MENU_ARTIFACT_PATH = 'docs/OPS/ARTIFACTS/menu/menu.normalized.json';
const DEFAULT_MENU_SNAPSHOT_REGISTRY_PATH = 'docs/OPS/STATUS/MENU_SNAPSHOT_REGISTRY.json';
const DEFAULT_PERF_BASELINE_PATH = 'docs/OPS/PERF/PERF_LITE_BASELINE.json';
const DEFAULT_TOKEN_CATALOG_PATH = 'docs/OPS/TOKENS/TOKEN_CATALOG.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_REQUIRED_TOKEN_SET_PATH = 'docs/OPS/EXECUTION/REQUIRED_TOKEN_SET.json';
const DEFAULT_EVIDENCE_ROOT = 'docs/OPS/EVIDENCE/promotion';
const SHA256_HEX_RE = /^[0-9a-f]{64}$/u;

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeMode(value) {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === MODE_PROMOTION) return MODE_PROMOTION;
  return MODE_RELEASE;
}

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSha256Hex(value) {
  return SHA256_HEX_RE.test(normalizeString(value).toLowerCase());
}

function stableSortObject(value) {
  if (Array.isArray(value)) return value.map((item) => stableSortObject(item));
  if (!isObjectRecord(value)) return value;
  const out = {};
  for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
    out[key] = stableSortObject(value[key]);
  }
  return out;
}

function stableStringify(value) {
  return JSON.stringify(stableSortObject(value), null, 2);
}

function sha256File(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readJsonObject(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return isObjectRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function resolveRepoRoot(inputPath) {
  const candidate = normalizeString(inputPath);
  return path.resolve(candidate || process.cwd());
}

function resolvePath(repoRoot, relOrAbsPath) {
  const candidate = normalizeString(relOrAbsPath);
  if (!candidate) return path.resolve(repoRoot);
  if (path.isAbsolute(candidate)) return path.resolve(candidate);
  return path.resolve(repoRoot, candidate);
}

function toRepoRelative(repoRoot, absPath) {
  return path.relative(repoRoot, absPath).replaceAll(path.sep, '/');
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    create: false,
    verify: false,
    mode: MODE_RELEASE,
    repoRoot: '',
    lockPath: DEFAULT_LOCK_PATH,
    evidenceRoot: DEFAULT_EVIDENCE_ROOT,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--json') {
      out.json = true;
      continue;
    }
    if (arg === '--create') {
      out.create = true;
      continue;
    }
    if (arg === '--verify') {
      out.verify = true;
      continue;
    }
    if (arg.startsWith('--mode=')) {
      out.mode = normalizeMode(arg.slice('--mode='.length));
      continue;
    }
    if (arg === '--mode' && i + 1 < argv.length) {
      out.mode = normalizeMode(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--repo-root=')) {
      out.repoRoot = normalizeString(arg.slice('--repo-root='.length));
      continue;
    }
    if (arg === '--repo-root' && i + 1 < argv.length) {
      out.repoRoot = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--lock-path=')) {
      out.lockPath = normalizeString(arg.slice('--lock-path='.length)) || DEFAULT_LOCK_PATH;
      continue;
    }
    if (arg === '--lock-path' && i + 1 < argv.length) {
      out.lockPath = normalizeString(argv[i + 1]) || DEFAULT_LOCK_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--evidence-root=')) {
      out.evidenceRoot = normalizeString(arg.slice('--evidence-root='.length)) || DEFAULT_EVIDENCE_ROOT;
      continue;
    }
    if (arg === '--evidence-root' && i + 1 < argv.length) {
      out.evidenceRoot = normalizeString(argv[i + 1]) || DEFAULT_EVIDENCE_ROOT;
      i += 1;
    }
  }

  return out;
}

function readSnapshotHash(snapshotRegistryPath, preferredSnapshotId = '') {
  const registryDoc = readJsonObject(snapshotRegistryPath);
  if (!registryDoc || !Array.isArray(registryDoc.snapshots)) {
    return {
      ok: false,
      snapshotId: '',
      menuSnapshotHash: '',
      error: 'MENU_SNAPSHOT_REGISTRY_INVALID',
    };
  }

  const preferred = normalizeString(preferredSnapshotId) || DEFAULT_MENU_SNAPSHOT_ID;
  const row = registryDoc.snapshots.find((item) => item && String(item.id || '').trim() === preferred)
    || registryDoc.snapshots[0]
    || null;
  if (!row) {
    return {
      ok: false,
      snapshotId: '',
      menuSnapshotHash: '',
      error: 'MENU_SNAPSHOT_ENTRY_MISSING',
    };
  }

  const snapshotId = normalizeString(row.id);
  const snapshotHash = normalizeString(row.normalizedHashSha256).toLowerCase();
  if (!snapshotId || !isSha256Hex(snapshotHash)) {
    return {
      ok: false,
      snapshotId,
      menuSnapshotHash: '',
      error: 'MENU_SNAPSHOT_ENTRY_INVALID',
    };
  }

  return {
    ok: true,
    snapshotId,
    menuSnapshotHash: snapshotHash,
    error: '',
  };
}

function collectObservedState(repoRoot) {
  const menuArtifactPath = resolvePath(repoRoot, DEFAULT_MENU_ARTIFACT_PATH);
  const menuSnapshotRegistryPath = resolvePath(repoRoot, DEFAULT_MENU_SNAPSHOT_REGISTRY_PATH);
  const perfBaselinePath = resolvePath(repoRoot, DEFAULT_PERF_BASELINE_PATH);
  const tokenCatalogPath = resolvePath(repoRoot, DEFAULT_TOKEN_CATALOG_PATH);
  const failsignalRegistryPath = resolvePath(repoRoot, DEFAULT_FAILSIGNAL_REGISTRY_PATH);
  const requiredTokenSetPath = resolvePath(repoRoot, DEFAULT_REQUIRED_TOKEN_SET_PATH);
  const errors = [];

  const requiredFiles = [
    ['menuArtifactPath', menuArtifactPath],
    ['menuSnapshotRegistryPath', menuSnapshotRegistryPath],
    ['perfBaselinePath', perfBaselinePath],
    ['tokenCatalogPath', tokenCatalogPath],
    ['failsignalRegistryPath', failsignalRegistryPath],
    ['requiredTokenSetPath', requiredTokenSetPath],
  ];

  for (const [field, filePath] of requiredFiles) {
    if (!fs.existsSync(filePath)) {
      errors.push(`${field}:FILE_MISSING`);
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      hashes: null,
      paths: {
        menuArtifactPath,
        menuSnapshotRegistryPath,
        perfBaselinePath,
        tokenCatalogPath,
        failsignalRegistryPath,
        requiredTokenSetPath,
      },
    };
  }

  const artifactDoc = readJsonObject(menuArtifactPath);
  const preferredSnapshotId = artifactDoc ? normalizeString(artifactDoc.snapshotId) : '';
  const snapshotState = readSnapshotHash(menuSnapshotRegistryPath, preferredSnapshotId);
  if (!snapshotState.ok) {
    return {
      ok: false,
      errors: [snapshotState.error],
      hashes: null,
      paths: {
        menuArtifactPath,
        menuSnapshotRegistryPath,
        perfBaselinePath,
        tokenCatalogPath,
        failsignalRegistryPath,
        requiredTokenSetPath,
      },
    };
  }

  const hashes = {
    menuArtifactHash: sha256File(menuArtifactPath),
    menuSnapshotHash: snapshotState.menuSnapshotHash,
    perfBaselineHash: sha256File(perfBaselinePath),
    tokenCatalogHash: sha256File(tokenCatalogPath),
    failsignalRegistryHash: sha256File(failsignalRegistryPath),
    requiredTokenSetHash: sha256File(requiredTokenSetPath),
  };

  return {
    ok: true,
    errors: [],
    hashes,
    paths: {
      menuArtifactPath,
      menuSnapshotRegistryPath,
      perfBaselinePath,
      tokenCatalogPath,
      failsignalRegistryPath,
      requiredTokenSetPath,
    },
    snapshotId: snapshotState.snapshotId,
  };
}

function resolveHeadSha(repoRoot) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_OPTIONAL_LOCKS: '0',
    },
  });
  if (result.status !== 0) return '';
  const sha = normalizeString(result.stdout);
  return /^[0-9a-f]{40}$/u.test(sha) ? sha : '';
}

function isAncestorCommit(repoRoot, ancestorSha, descendantSha) {
  const ancestor = normalizeString(ancestorSha);
  const descendant = normalizeString(descendantSha);
  if (!/^[0-9a-f]{40}$/u.test(ancestor) || !/^[0-9a-f]{40}$/u.test(descendant)) return false;
  const result = spawnSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_OPTIONAL_LOCKS: '0',
    },
  });
  return result.status === 0;
}

function buildRcId(baseCommitSha, menuArtifactHash) {
  const shaPart = baseCommitSha ? baseCommitSha.slice(0, 12) : 'unknown';
  const hashPart = menuArtifactHash ? menuArtifactHash.slice(0, 8) : '00000000';
  return `rc-${shaPart}-${hashPart}`;
}

function buildReleaseCandidateLock(mode, observed, baseCommitSha, existingLock = null) {
  const rcId = buildRcId(baseCommitSha, observed.hashes.menuArtifactHash);
  const createdAt = isObjectRecord(existingLock)
    && normalizeString(existingLock.rcId) === rcId
    && normalizeString(existingLock.baseCommitSha) === baseCommitSha
    && Number.isFinite(Date.parse(String(existingLock.createdAt || '')))
    ? new Date(existingLock.createdAt).toISOString()
    : new Date().toISOString();

  return {
    rcId,
    baseCommitSha,
    menuArtifactHash: observed.hashes.menuArtifactHash,
    menuSnapshotHash: observed.hashes.menuSnapshotHash,
    perfBaselineHash: observed.hashes.perfBaselineHash,
    tokenCatalogHash: observed.hashes.tokenCatalogHash,
    failsignalRegistryHash: observed.hashes.failsignalRegistryHash,
    requiredTokenSetHash: observed.hashes.requiredTokenSetHash,
    createdAt,
    createdByMode: normalizeMode(mode),
  };
}

function validateLockDoc(lockDoc) {
  const issues = [];
  if (!isObjectRecord(lockDoc)) {
    issues.push('LOCK_DOC_INVALID');
    return issues;
  }

  const requiredStringFields = [
    'rcId',
    'baseCommitSha',
    'createdAt',
    'createdByMode',
  ];
  for (const field of requiredStringFields) {
    if (!normalizeString(lockDoc[field])) {
      issues.push(`${field.toUpperCase()}_MISSING`);
    }
  }

  if (!Number.isFinite(Date.parse(String(lockDoc.createdAt || '')))) {
    issues.push('CREATED_AT_INVALID');
  }

  if (normalizeMode(lockDoc.createdByMode) !== normalizeString(lockDoc.createdByMode).toLowerCase()) {
    issues.push('CREATED_BY_MODE_INVALID');
  }

  const hashFields = [
    'menuArtifactHash',
    'menuSnapshotHash',
    'perfBaselineHash',
    'tokenCatalogHash',
    'failsignalRegistryHash',
    'requiredTokenSetHash',
  ];
  for (const field of hashFields) {
    if (!isSha256Hex(lockDoc[field])) {
      issues.push(`${field.toUpperCase()}_INVALID`);
    }
  }

  return issues;
}

function resolveVerifyOutcome(mode, mismatchDetected) {
  if (!mismatchDetected) {
    return {
      result: RESULT_PASS,
      ok: true,
      exitCode: 0,
      failSignalCode: '',
    };
  }
  if (mode === MODE_PROMOTION) {
    return {
      result: RESULT_FAIL,
      ok: false,
      exitCode: 1,
      failSignalCode: FAIL_SIGNAL,
    };
  }
  return {
    result: RESULT_WARN,
    ok: true,
    exitCode: 0,
    failSignalCode: FAIL_SIGNAL,
  };
}

function writeTextDeterministic(filePath, content, keepExisting = false) {
  if (keepExisting && fs.existsSync(filePath)) return 0;
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, 'utf8');
    if (existing === content) return 0;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  return 1;
}

function collectDoctorLog(repoRoot) {
  const doctorScriptPath = resolvePath(repoRoot, 'scripts/doctor.mjs');
  if (!fs.existsSync(doctorScriptPath)) {
    return 'DOCTOR_STRICT_SKIPPED_MISSING_SCRIPT=1\n';
  }

  const result = spawnSync(process.execPath, ['scripts/doctor.mjs', '--strict'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const stdout = String(result.stdout || '');
  const stderr = String(result.stderr || '');
  const combined = `${stdout}${stderr ? `\n${stderr}` : ''}`;
  if (result.status !== 0) {
    throw new Error(`DOCTOR_STRICT_FAILED:${result.status}`);
  }
  return combined.endsWith('\n') ? combined : `${combined}\n`;
}

function sanitizeRcIdForPath(rcId) {
  const normalized = normalizeString(rcId).replace(/[^a-zA-Z0-9._-]/gu, '-');
  return normalized || 'rc-unknown';
}

function generatePromotionEvidencePack({ repoRoot, lockDoc, lockPath, observed, evidenceRootPath }) {
  const safeRcId = sanitizeRcIdForPath(lockDoc.rcId);
  const evidenceRoot = resolvePath(repoRoot, evidenceRootPath || DEFAULT_EVIDENCE_ROOT);
  const evidenceDir = path.join(evidenceRoot, safeRcId);
  const doctorLog = collectDoctorLog(repoRoot);
  fs.mkdirSync(evidenceDir, { recursive: true });

  const releaseCandidateLockSha256 = sha256File(lockPath);
  const promotionSummaryPath = path.join(evidenceDir, 'promotion-summary.json');
  const menuArtifactHashPath = path.join(evidenceDir, 'menuArtifactHash.txt');
  const perfBaselineSnapshotPath = path.join(evidenceDir, 'perfBaseline.json');
  const doctorLogPath = path.join(evidenceDir, 'doctor-strict.log');
  const heavyLaneSummaryPath = path.join(evidenceDir, 'heavy-lane-summary.json');
  const requiredSetSnapshotPath = path.join(evidenceDir, 'token-required-set.json');
  const failsignalSnapshotPath = path.join(evidenceDir, 'failsignal-registry-snapshot.json');

  const promotionSummary = {
    schemaVersion: 1,
    toolVersion: TOOL_VERSION,
    rcId: lockDoc.rcId,
    baseCommitSha: lockDoc.baseCommitSha,
    createdAt: lockDoc.createdAt,
    createdByMode: lockDoc.createdByMode,
    mode: MODE_PROMOTION,
    releaseCandidateLockPath: toRepoRelative(repoRoot, lockPath),
    releaseCandidateLockSha256,
    releaseCandidateLockMatch: true,
    hashes: {
      menuArtifactHash: lockDoc.menuArtifactHash,
      menuSnapshotHash: lockDoc.menuSnapshotHash,
      perfBaselineHash: lockDoc.perfBaselineHash,
      tokenCatalogHash: lockDoc.tokenCatalogHash,
      failsignalRegistryHash: lockDoc.failsignalRegistryHash,
      requiredTokenSetHash: lockDoc.requiredTokenSetHash,
    },
  };

  const heavyLaneSummary = {
    schemaVersion: 1,
    toolVersion: TOOL_VERSION,
    mode: MODE_PROMOTION,
    result: RESULT_PASS,
    token: {
      [TOKEN_NAME]: 1,
    },
    failSignalCode: '',
    releaseCandidate: {
      rcId: lockDoc.rcId,
      match: true,
      menuSnapshotId: observed.snapshotId,
    },
  };

  writeTextDeterministic(promotionSummaryPath, `${stableStringify(promotionSummary)}\n`);
  writeTextDeterministic(menuArtifactHashPath, `${lockDoc.menuArtifactHash}\n`);
  writeTextDeterministic(perfBaselineSnapshotPath, fs.readFileSync(observed.paths.perfBaselinePath, 'utf8'));
  writeTextDeterministic(doctorLogPath, doctorLog);
  writeTextDeterministic(heavyLaneSummaryPath, `${stableStringify(heavyLaneSummary)}\n`);
  writeTextDeterministic(requiredSetSnapshotPath, fs.readFileSync(observed.paths.requiredTokenSetPath, 'utf8'));
  writeTextDeterministic(failsignalSnapshotPath, fs.readFileSync(observed.paths.failsignalRegistryPath, 'utf8'));

  return {
    evidenceDir,
    files: [
      promotionSummaryPath,
      menuArtifactHashPath,
      perfBaselineSnapshotPath,
      doctorLogPath,
      heavyLaneSummaryPath,
      requiredSetSnapshotPath,
      failsignalSnapshotPath,
    ],
  };
}

function runCreate({ mode, repoRoot, lockPath }) {
  const observed = collectObservedState(repoRoot);
  if (!observed.ok) {
    return {
      operation: 'create',
      mode,
      result: RESULT_FAIL,
      ok: false,
      exitCode: 1,
      failReason: observed.errors.join(','),
      failSignalCode: FAIL_SIGNAL,
      lockPath,
      token: {
        [TOKEN_NAME]: 0,
      },
    };
  }

  const existingLock = readJsonObject(lockPath);
  const baseCommitSha = resolveHeadSha(repoRoot) || 'unknown';
  const lockDoc = buildReleaseCandidateLock(mode, observed, baseCommitSha, existingLock);
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(lockPath, `${JSON.stringify(lockDoc, null, 2)}\n`, 'utf8');

  return {
    operation: 'create',
    mode,
    result: RESULT_PASS,
    ok: true,
    exitCode: 0,
    failReason: '',
    failSignalCode: '',
    lockPath,
    lock: lockDoc,
    token: {
      [TOKEN_NAME]: 1,
    },
  };
}

function runVerify({ mode, repoRoot, lockPath, evidenceRoot }) {
  const mismatches = [];
  const lockDoc = readJsonObject(lockPath);
  if (!lockDoc) {
    mismatches.push({
      code: 'LOCK_MISSING',
      field: 'lockPath',
      expected: toRepoRelative(repoRoot, lockPath),
      actual: '',
    });
  }

  if (lockDoc) {
    const lockIssues = validateLockDoc(lockDoc);
    for (const issue of lockIssues) {
      mismatches.push({
        code: issue,
        field: 'lock',
        expected: 'valid',
        actual: 'invalid',
      });
    }
  }

  const observed = collectObservedState(repoRoot);
  if (!observed.ok) {
    for (const error of observed.errors) {
      mismatches.push({
        code: error,
        field: 'observedState',
        expected: 'present',
        actual: 'missing_or_invalid',
      });
    }
  }

  if (lockDoc && observed.ok) {
    const expectedByField = {
      menuArtifactHash: lockDoc.menuArtifactHash,
      menuSnapshotHash: lockDoc.menuSnapshotHash,
      perfBaselineHash: lockDoc.perfBaselineHash,
      tokenCatalogHash: lockDoc.tokenCatalogHash,
      failsignalRegistryHash: lockDoc.failsignalRegistryHash,
      requiredTokenSetHash: lockDoc.requiredTokenSetHash,
    };
    for (const [field, expected] of Object.entries(expectedByField)) {
      const expectedNormalized = normalizeString(expected).toLowerCase();
      const actual = observed.hashes[field];
      if (!expectedNormalized || !actual || expectedNormalized !== actual) {
        mismatches.push({
          code: 'HASH_MISMATCH',
          field,
          expected: expectedNormalized,
          actual: actual || '',
        });
      }
    }

    const headSha = resolveHeadSha(repoRoot);
    const lockBaseSha = normalizeString(lockDoc.baseCommitSha);
    const baseShaMatchesHeadLineage = Boolean(headSha && lockBaseSha && isAncestorCommit(repoRoot, lockBaseSha, headSha));
    if (headSha && lockBaseSha && !baseShaMatchesHeadLineage) {
      mismatches.push({
        code: 'BASE_COMMIT_SHA_MISMATCH',
        field: 'baseCommitSha',
        expected: lockBaseSha,
        actual: headSha,
      });
    }
  }

  const mismatchDetected = mismatches.length > 0;
  const outcome = resolveVerifyOutcome(mode, mismatchDetected);
  const payload = {
    operation: 'verify',
    mode,
    result: outcome.result,
    ok: outcome.ok,
    exitCode: outcome.exitCode,
    failSignalCode: outcome.failSignalCode,
    failReason: mismatchDetected ? FAIL_SIGNAL : '',
    token: {
      [TOKEN_NAME]: mismatchDetected ? 0 : 1,
    },
    lockPath,
    rcId: normalizeString(lockDoc && lockDoc.rcId),
    mismatches,
  };

  if (!mismatchDetected && mode === MODE_PROMOTION && lockDoc && observed.ok) {
    const evidence = generatePromotionEvidencePack({
      repoRoot,
      lockDoc,
      lockPath,
      observed,
      evidenceRootPath: evidenceRoot,
    });
    payload.evidencePackPath = toRepoRelative(repoRoot, evidence.evidenceDir);
    payload.evidenceFiles = evidence.files.map((filePath) => toRepoRelative(repoRoot, filePath));
  }

  return payload;
}

function printHuman(state) {
  console.log(`RELEASE_CANDIDATE_OPERATION=${state.operation}`);
  console.log(`RELEASE_CANDIDATE_MODE=${state.mode}`);
  console.log(`RELEASE_CANDIDATE_RESULT=${state.result}`);
  console.log(`${TOKEN_NAME}=${state.token && state.token[TOKEN_NAME] === 1 ? 1 : 0}`);
  console.log(`RELEASE_CANDIDATE_LOCK_PATH=${state.lockPath || ''}`);
  if (state.rcId) console.log(`RELEASE_CANDIDATE_ID=${state.rcId}`);
  if (state.failSignalCode) console.log(`RELEASE_CANDIDATE_FAIL_SIGNAL=${state.failSignalCode}`);
  if (Array.isArray(state.mismatches) && state.mismatches.length > 0) {
    console.log(`RELEASE_CANDIDATE_MISMATCHES=${JSON.stringify(state.mismatches)}`);
  }
  if (state.evidencePackPath) {
    console.log(`PROMOTION_EVIDENCE_PACK_PATH=${state.evidencePackPath}`);
  }
}


// Opt-in MR01 scope query. It cannot qualify a candidate or execute a release.
// These pins are trusted policy, not values learned from a caller-resealed cut.
export const FIRST_MAC_RELEASE_SOURCE_PINS = Object.freeze({
  "AGENTS.md": "af4fdeb93def4476134c376ba8c3679f76d0837d895478628841b91a35cd37da",
  "CANON.md": "99398ac898104c7a392f0e84b4bb8848212e2c5a7db6ae27cbfc549c3e070e48",
  "docs/AGENT_START_PROTOCOL.md": "3a86699d6320666c84ec1316e2e51cf78f843893759ba2d1b3eb98a9c5ee1b4f",
  "docs/BIBLE.md": "94864b5d7cbec709ca6d7e9c6a838ff9405cfbc86443a5485acd149ccc16de93",
  "docs/OPS/R24/EXECUTABLE_PROGRAM_R2_4.json": "7185d649974289e8b3a0b310203b32dbd0bac96a613adf3cf26b308ff0067df5",
  "docs/OPS/R24/OWNER_GATE_DECISIONS/ENTITLEMENT_SEMANTICS_ADR_OR_DENY_WP206_SAFE_ENTITLEMENT_BASELINE_V1.json": "d86d4edd2faf14a4ac019a3561ce468a83c333b5112ba57490211b04cd061c0e",
  "docs/OPS/R24/OWNER_GATE_DECISIONS/LOCAL_RELEASE_PERMIT_WP307_WRITER_LOCAL_PROFILE_V1.json": "061e5adf483ecbfbfb5278cf14da04fd332fd26dfe0b3debe006eda1a8ff68c1",
  "docs/OPS/STATUS/CANON_STATUS.json": "0c73f3d0ed99adab897b841a8471733572e6c78970371eba751e4fe2418192be",
  "docs/OPS/STATUS/XPLAT_UNIFIED_MASTER_EXECUTION_CONTRACT_v3.13a-final.md": "b8e99ad1c9cd37e874d3145c79be99f6f3181a9eae7078060f9e497e0896077b",
  "docs/corex/COREX.md": "4f4582deceb92c1b796f098b9cf87eac65317513a1bdfa3429e3d9076b3e914c",
  "docs/corex/COREX.v2.md": "ea25f66352497e58935c673d3bf3c82d828e31dcc3cdad1ca19ef1250512f0bf",
  "package.json": "96164dc319209209c1edf12c4d1a745b3bc0fcd38a8fc2d943ac143d87338696",
  "scripts/ops/r24/corrective/rcv00d-graph-derived-selector.mjs": "21d9d8c6e0e214d3142f0d0b5f7f7f9e42ad23858adacb8519aacdea7b415504",
  "scripts/ops/r24/effective-state-compiler.mjs": "6f7d5be6ed58afea72ee32a1145381aaed552461ec0b5d62f61dbdd945fefcf3",
  "scripts/ops/r24/package-claim-compiler-v3.mjs": "c79ee1641b5a4339eb1b8d6a76fb8f0075c9da718e2ab8b2ba22d7d89de56f0c",
  "scripts/ops/r24/release-security-physical-pk1.mjs": "a0b84198fe20e82edfe18c628550213ae9092c4e4a8b07f953f4ddea57140030",
  "scripts/ops/r24/writer-claim-compiler-v0.mjs": "3a2ff7e751ae5bde079684f36e05ce11236ef706b28a94170b374f48793604eb",
  "src/core/autosave-generation-v1.cjs": "c901970cd0b6a7d865e4af1f5f305fb04873a3397da591691c5aa43af52cf752",
  "src/core/dirty-admission-v1.cjs": "2d1928cfc3f5b6ef669c0628578113fef5b345eb4bd3485f5e720c4d26e4362b",
  "src/core/entitlement-law-v1.cjs": "7652d20be2aacefa9e2b94797656fd02ae7e3cd104bc70c39f50ce494c8208d3",
  "src/core/lifecycle-recovery-v1.cjs": "57cf18f554b9b478ba1509860013cb2d54d9660f15b69ea56e2da830bdac0506",
  "src/core/minimum-interchange-v1.cjs": "143750fca1e434ad2081ce42102c512370f07323b1e18e64d1be9ef7850dd561",
  "src/core/recovery-ledger-v1.cjs": "f6f0ab01ee768e374f07d2e830b2b4cca3b5a5a68278ca291b46229cffbb0e25",
  "src/core/writer-local-profile-v1.cjs": "b2c95d46ea0effd725e457fba178bdb1371164ecb97e022f0c25dfb18bf86b37",
  "src/export/archive/projectArchiveExportHandler.js": "ab7144381d04b0351f85e5a9f0379f1c01f47a8cc0b41f4a09ecfb6cf23ae586",
  "src/export/docx/docxMinExportHandler.js": "40e9c55d7016edb2c9b91388dee62447b52aff94ae8f7a2806cc54a03038963f",
  "src/export/markdown/v1/parseMarkdownV1.mjs": "24510611af0757567b45597f604de443eabc64923f64a5f1f291ee4f1fb1d851",
  "src/export/markdown/v1/serializeMarkdownV1.mjs": "fedbc3e95ce9022c69e704deb1564a3358e50984e17788685184fd03aaae39c1",
  "src/export/markdown/v1/types.mjs": "420a1d65704deb522b05c881c23d7beffeddc5740017edb5955edd43bc95c8f4",
  "src/main.js": "ab3babb81fc04432b475f1383bc8adf53da11c800f07930217dfed097a6e1046",
  "src/main/docxImportComputePort.cjs": "6e6fd633a460a8a3fac7a4f0a8fb4e93ed5a84bcc86df60707a92a49882061ab",
  "src/main/docxImportComputeWorker.cjs": "25cf9ccd00c7259b9fd7c52350f7367f5642b814262285c1fa22c1e0a4c6afe4",
  "src/preload.js": "39a3fbe05a6f4d7844f9bedf00063b7f983976ea79a83f9029f4d29733300ea2",
  "src/renderer/index.html": "2b2d08a6ec5a33b545a4963a3e10978b6662353bc87fa555943d11a37429f60f",
  "src/shared/productCommandRegistry.cjs": "3d6fcc76788c4a5d5599e671caa3965d6fb957bde1785ef18baa47a9d8602227",
  "src/utils/docxImportSafeCreate.js": "d68dcd69df66c2166ade19d1e08f0c834393da8ecc302b888b096c4c0f85ba70",
  "src/utils/markdownImportSafeCreate.js": "435d0054e1d250eb84e810e6cd78fed5b6d5b2bf551950db35c8df6f562b2c97",
  "src/utils/txtImportSafeCreate.js": "1fbdc4e1e6a4d013649a0c9625febf15a2a688b1b3bbd3b48a0b277a5cd5bb37"
});
const FIRST_MAC_BASE = '2564946d4cb68fc59527170b6c191e6db689dbc7';
const FIRST_MAC_PROGRAM = 'docs/OPS/R24/EXECUTABLE_PROGRAM_R2_4.json';
const FIRST_MAC_CHOICE = 'OWNER_FIRST_SUPPORTED_MAC_P27_20261021';
const FIRST_MAC_ROOTS = ['WP-305_MINIMUM_INTERCHANGE', 'WP-709_MIXED_CHAINS', 'WP-902_ENTITLEMENT_PRODUCT', 'WP-906_RELEASE_VERDICT'];
const FIRST_MAC_REQUIRED = ['ORDINARY_RECOVERY', 'NO_LOSS_SAVE_REOPEN', 'BACKUP_RESTORE_MIGRATION_CONFLICT', 'FULL_HISTORY_RETENTION',
  'MINIMUM_INTERCHANGE_ALL_EIGHT', 'CURRENT_ALLOWED_DOCX_REVIEW', 'ENTITLEMENT_OFFLINE_DOWNGRADE_NO_LOSS', 'ENABLED_CAPABILITY_COMPLETENESS',
  'NUMERICAL_WRITER_ENVELOPE', 'PACKAGE_SECURITY_CHANNEL', 'INDEPENDENT_AUDITS', 'EXACT_OWNER_RELEASE_PERMIT', 'EXACT_TERMINAL_DELIVERY'];
const FIRST_MAC_LEDGER = [
  ["MAC-01", "MR-01", ["docs/OPS/R24/EXECUTABLE_PROGRAM_R2_4.json", "scripts/ops/r24/effective-state-compiler.mjs", "scripts/ops/r24/corrective/rcv00d-graph-derived-selector.mjs"], ["ENABLED_CAPABILITY_COMPLETENESS"], "Independent original graph closure and accepted scope; bind to final immutable R"],
  ["MAC-02", "MR-02", ["src/main.js", "src/renderer/index.html", "src/core/writer-local-profile-v1.cjs"], ["NO_LOSS_SAVE_REOPEN"], "Frozen text/order/identity oracle, independent persisted reader and actual cold reopen"],
  ["MAC-03", "MR-03", ["src/core/autosave-generation-v1.cjs", "src/core/dirty-admission-v1.cjs", "src/core/lifecycle-recovery-v1.cjs", "src/core/recovery-ledger-v1.cjs"], ["ORDINARY_RECOVERY", "BACKUP_RESTORE_MIGRATION_CONFLICT", "FULL_HISTORY_RETENTION"], "Separate before/after whole-file roster and recovery reader, new process reopen after faults"],
  ["MAC-04", "MR-04A", ["src/utils/txtImportSafeCreate.js", "src/core/minimum-interchange-v1.cjs", "src/main.js"], ["MINIMUM_INTERCHANGE_ALL_EIGHT"], "Independent expected Unicode/text/newline policy and unchanged donor/foreign target"],
  ["MAC-05", "MR-04B", ["src/utils/markdownImportSafeCreate.js", "src/export/markdown/v1/parseMarkdownV1.mjs", "src/export/markdown/v1/serializeMarkdownV1.mjs"], ["MINIMUM_INTERCHANGE_ALL_EIGHT"], "Independent supported IR/text and explicit loss/refusal ledger, unchanged source"],
  ["MAC-06", "MR-04C", ["src/export/archive/projectArchiveExportHandler.js", "src/main.js"], ["MINIMUM_INTERCHANGE_ALL_EIGHT", "FULL_HISTORY_RETENTION", "ORDINARY_RECOVERY"], "Independent raw ZIP roster/bytes before identity rebind, then actual library/open/edit/save/reopen"],
  ["MAC-07", "MR-04D", ["src/utils/docxImportSafeCreate.js", "src/main/docxImportComputePort.cjs", "src/export/docx/docxMinExportHandler.js"], ["MINIMUM_INTERCHANGE_ALL_EIGHT", "CURRENT_ALLOWED_DOCX_REVIEW"], "Independent Current/Original/comments/anchors/decision/cold reopen on exact supported fixture"],
  ["MAC-08", "MR-05", ["src/shared/productCommandRegistry.cjs", "src/core/entitlement-law-v1.cjs", "src/core/writer-local-profile-v1.cjs"], ["ENTITLEMENT_OFFLINE_DOWNGRADE_NO_LOSS", "CURRENT_ALLOWED_DOCX_REVIEW", "ENABLED_CAPABILITY_COMPLETENESS"], "Actual dispatch stale/revoked/downgrade/offline negatives and independent author-data reader"],
  ["MAC-09", "MR-05", ["src/renderer/index.html", "src/main.js", "src/preload.js"], ["NO_LOSS_SAVE_REOPEN", "ENABLED_CAPABILITY_COMPLETENESS"], "Included-surface keyboard/IME/accessibility/focus/error journey against preserved UI baseline"],
  ["MAC-10", "MR-06", ["src/main.js", "src/main/docxImportComputePort.cjs", "src/main/docxImportComputeWorker.cjs", "src/export/markdown/v1/types.mjs"], ["NUMERICAL_WRITER_ENVELOPE"], "Predeclared Mac/workload/operation numeric matrix, independent measured latency/RSS/cancel results"],
  ["MAC-11", "MR-07/MR-08", ["package.json", "src/main.js", "src/preload.js", "scripts/ops/r24/package-claim-compiler-v3.mjs", "scripts/ops/r24/release-security-physical-pk1.mjs"], ["PACKAGE_SECURITY_CHANNEL"], "Actual artifact roster/security and selected qualified install/distribution/upgrade/rollback channel"],
  ["MAC-12", "MR-09/MR-10", ["scripts/ops/r24/effective-state-compiler.mjs", "scripts/ops/r24/writer-claim-compiler-v0.mjs", "scripts/ops/r24/package-claim-compiler-v3.mjs", "src/main.js"], ["INDEPENDENT_AUDITS", "EXACT_OWNER_RELEASE_PERMIT", "EXACT_TERMINAL_DELIVERY"], "Independent exact-R audits, authenticated exact owner permit and terminal/delivery identity readback"]
];
const FIRST_MAC_SCOPE_ROWS = [
  ['S01', ['WP-900_BBR_POLICY'], 'deferred', ['ORDINARY_RECOVERY', 'FULL_HISTORY_RETENTION', 'PACKAGE_SECURITY_CHANNEL'], 'New encrypted policy deferred; shared security, retention and ordinary recovery remain required'],
  ['S02', ['WP-901_BBR_RESTORE', 'R24-RCV-63', 'R24-RCV-64'], 'deferred', ['ORDINARY_RECOVERY', 'BACKUP_RESTORE_MIGRATION_CONFLICT'], 'Owner-key and off-host encrypted qualification deferred; ordinary restore remains required'],
  ['S03', ['WP-902_ENTITLEMENT_PRODUCT'], 'narrowly-replaced', ['ORDINARY_RECOVERY', 'BACKUP_RESTORE_MIGRATION_CONFLICT', 'ENTITLEMENT_OFFLINE_DOWNGRADE_NO_LOSS', 'PACKAGE_SECURITY_CHANNEL'], 'Entitlement is independent of new encrypted product; replace only scoped WP901 prerequisite with ordinary recovery/security/offline/downgrade proof'],
  ['S04', ['WP-903_BRAND_RELEASE', 'WP-904_PACKAGE_CONTENT', 'WP-905_PACKAGE_PHYSICAL', 'WP-906_RELEASE_VERDICT'], 'inherited', ['PACKAGE_SECURITY_CHANNEL', 'EXACT_OWNER_RELEASE_PERMIT', 'EXACT_TERMINAL_DELIVERY'], 'Applicable brand/license/package/physical/terminal duties retained without changing full-graph eligibility'],
  ['S05', ['R24-RCV-01D', 'WP-709_MIXED_CHAINS'], 'narrowly-replaced', ['MINIMUM_INTERCHANGE_ALL_EIGHT', 'CURRENT_ALLOWED_DOCX_REVIEW', 'ENABLED_CAPABILITY_COMPLETENESS'], 'Current-format compatibility required; wide mixed-provider part deferred separately'],
  ['S06', ['R24-RCV-01F', 'R24-RCV-33'], 'narrowly-replaced', ['MINIMUM_INTERCHANGE_ALL_EIGHT', 'CURRENT_ALLOWED_DOCX_REVIEW', 'ENABLED_CAPABILITY_COMPLETENESS'], 'Full W7/C1-C8/full-book/repeated portability remains full-profile duty; current routes and review safety retained'],
  ['S07', ['R24-RCV-14'], 'inherited', ['ORDINARY_RECOVERY', 'FULL_HISTORY_RETENTION', 'BACKUP_RESTORE_MIGRATION_CONFLICT'], 'Ordinary backup/recovery required with complete supported source/history and no truncation'],
  ['S08', ['R24-RCV-60', 'R24-RCV-61', 'R24-RCV-62', 'R24-RCV-65..70E'], 'narrowly-replaced', ['INDEPENDENT_AUDITS', 'EXACT_OWNER_RELEASE_PERMIT', 'EXACT_TERMINAL_DELIVERY'], 'Scoped acceptance retains exact audits/permit/terminal; original full70E completion and full program remain unchanged'],
  ['S09', ['WP-305_MINIMUM_INTERCHANGE'], 'inherited', ['MINIMUM_INTERCHANGE_ALL_EIGHT', 'CURRENT_ALLOWED_DOCX_REVIEW'], 'All supported TXT/Markdown/Archive/DOCX routes protected; wide Word/Google exclusion removes none'],
];
const FIRST_MAC_QUALIFICATION_POLICY = { candidateBoundRequired: true, rawIndependentEvidenceRequired: true, noSchemaOnlyReadiness: true,
  workloadApprovalRequired: true, channelQualificationRequired: true, securityQualificationRequired: true, auditsRequired: true,
  exactOwnerPermitRequired: true, terminalIdentitiesRequired: true, unsignedFallbackAllowed: false };
const FIRST_MAC_AUTHORITY = { programDone: false, signingAuthority: false, notarizationAuthority: false, publicationAuthority: false };
const FIRST_MAC_CANDIDATE = { status: 'UNFROZEN', headSha: null, treeSha: null, buildId: null, artifactSha256: null };
const FIRST_MAC_BASIS = { admissionBaseSha: FIRST_MAC_BASE, admissionBaseTree: '2cba019197dc1063e9c766fcca51906f139ebb86',
  repository: 'https://github.com/KirPonomarev/writer-editor.git', remoteMainAtAdmission: FIRST_MAC_BASE, ownerChoiceRef: FIRST_MAC_CHOICE,
  dnaSha256: '22234e150dd405b101eecb613378284c01a7c9d8913cffae0dc1a374caacc017',
  planSha256: '77301a05b3055055a7f320a809b0de09e99ac684969e7ce0a04f6ea88d64d69a' };
const FIRST_MAC_MAX_CUT = 1024 * 1024;
const FIRST_MAC_MAX_SOURCE = 8 * 1024 * 1024;
function macCheck(condition, code) { if (!condition) throw new Error(code); }
function macJson(value) {
  if (Array.isArray(value)) return value.map(macJson);
  if (!isObjectRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, macJson(value[key])]));
}
export function canonicalFirstMacReleaseCutV1(value) { return JSON.stringify(macJson(value), null, 2) + '\n'; }
function macEqual(a, b) { return canonicalFirstMacReleaseCutV1(a) === canonicalFirstMacReleaseCutV1(b); }
function macKeys(value, keys, code) { macCheck(isObjectRecord(value) && macEqual(Object.keys(value).sort(), [...keys].sort()), code); }
function macDigest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function macFreeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(macFreeze); Object.freeze(value); } return value; }
function macParse(cutBytes, expectedCutSha256) {
  macCheck(Buffer.isBuffer(cutBytes) && cutBytes.length > 0 && cutBytes.length <= FIRST_MAC_MAX_CUT, 'E_FIRST_MAC_CUT_SIZE_TYPE');
  macCheck(typeof expectedCutSha256 === 'string' && SHA256_HEX_RE.test(expectedCutSha256)
    && macDigest(cutBytes) === expectedCutSha256, 'E_FIRST_MAC_CUT_PIN');
  let text, cut;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(cutBytes); cut = JSON.parse(text); }
  catch { throw new Error('E_FIRST_MAC_CUT_JSON'); }
  const pending = [[cut, 0]]; let count = 0;
  while (pending.length) { const [v, depth] = pending.pop(); macCheck(depth <= 32 && ++count <= 20000, 'E_FIRST_MAC_CUT_COMPLEXITY');
    if (v && typeof v === 'object') Object.values(v).forEach(child => pending.push([child, depth + 1])); }
  macCheck(text === canonicalFirstMacReleaseCutV1(cut), 'E_FIRST_MAC_CUT_CANONICAL'); // Also rejects duplicate JSON keys and BOM.
  macKeys(cut, ['schemaVersion', 'cutId', 'basis', 'sourceBindings', 'traceability', 'applicability', 'minimumInterchange', 'profiles',
    'protectedRequirements', 'entitlement', 'capabilityPolicy', 'deferredCapabilities', 'qualificationPolicy', 'qualification', 'candidate', 'authority', 'nextMaterialContour'], 'E_FIRST_MAC_CUT_FIELDS');
  macCheck(cut.schemaVersion === 'yalken.first-mac-release-cut.v1' && cut.cutId === 'FIRST_SUPPORTED_MAC_V1', 'E_FIRST_MAC_CUT_IDENTITY');
  // Validate the complete fixed path policy before the filesystem wrapper opens any source.
  macCheck(macEqual(cut.sourceBindings, FIRST_MAC_RELEASE_SOURCE_PINS), 'E_FIRST_MAC_SOURCE_BINDINGS');
  return cut;
}
function macClosure(program) {
  const nodes = new Map(program.nodes.map(row => [row.id, row]));
  macCheck(program.nodes.length === 109 && nodes.size === 109
    && program.nodes.reduce((n, row) => n + row.dependsOn.length, 0) === 171, 'E_FIRST_MAC_ORIGINAL_GRAPH');
  const seen = new Set(), active = new Set();
  function visit(id) { macCheck(nodes.has(id) && !active.has(id), 'E_FIRST_MAC_GRAPH_REFERENCE_CYCLE'); if (seen.has(id)) return;
    active.add(id); for (const dependency of nodes.get(id).dependsOn) visit(dependency); active.delete(id); seen.add(id); }
  for (const id of nodes.keys()) visit(id); // Validate the whole original graph, not a filtered completion program.
  seen.clear(); FIRST_MAC_ROOTS.forEach(visit);
  const nodeIds = [...seen].sort(), edges = nodeIds.flatMap(dependent => nodes.get(dependent).dependsOn.map(prerequisite => ({ dependent, prerequisite })));
  macCheck(nodeIds.length === 68 && edges.length === 120, 'E_FIRST_MAC_CLOSURE');
  return { nodeIds, edges };
}
function macEdgePolicy(edge) {
  let index = 6;
  if (edge.dependent === 'WP-900_BBR_POLICY') index = 0;
  else if (edge.dependent === 'WP-901_BBR_RESTORE') index = 1;
  else if (edge.dependent === 'WP-902_ENTITLEMENT_PRODUCT') index = 2;
  else if (/^WP-90[3-6]_/.test(edge.dependent) || /^(PK[01]|V3)_/.test(edge.dependent)) index = 3;
  else if (edge.dependent === 'WP-709_MIXED_CHAINS') index = 4;
  else if (/^WP-70[0-8]_/.test(edge.dependent) || /^(W0|V2)_/.test(edge.dependent)) index = 5;
  else if (edge.dependent === 'WP-305_MINIMUM_INTERCHANGE') index = 8;
  const [applicabilityId, , disposition, proofObligations, reason] = FIRST_MAC_SCOPE_ROWS[index];
  return { ...edge, applicabilityId, disposition, proofObligations, reason, ownerChoiceRef: FIRST_MAC_CHOICE };
}
function macRoutes() {
  const policy = minimumInterchange.MINIMUM_INTERCHANGE_OWNERSHIP_CURRENT;
  macCheck(policy.schemaVersion === 'yalken.minimum-interchange-ownership.v2', 'E_FIRST_MAC_CURRENT_INTERCHANGE');
  return { schemaVersion: policy.schemaVersion, localOnly: policy.localOnly, networkRequired: policy.networkRequired,
    archiveOutputPolicy: policy.formats.find(row => row.formatId === 'PROJECT_ARCHIVE').outputPolicy,
    routes: policy.formats.flatMap(row => ['IMPORT', 'EXPORT'].map(direction => ({ direction: `${row.formatId}_${direction}`,
      commandIds: row.commands.filter(command => command.role.includes(direction)).map(command => command.commandId) }))) };
}
function macProfiles() {
  const runtime = writerLocal.createWriterLocalProfileProjection({ isPackaged: true, platform: 'darwin' });
  return { runtime, writerOps: 'WRITER_CORE', packageOps: 'PACKAGED_RELEASE_SECURITY', rolesAreDistinct: true,
    reviewCommandExceptions: [...writerLocal.WRITER_LOCAL_DOCX_REVIEW_ROUNDTRIP_COMMAND_IDS] };
}
function macResult(valid, cutSha256, error = '', missingQualification = []) {
  return macFreeze({ schemaVersion: 'yalken.first-mac-release-cut-verification.v1', operation: 'verify-first-mac-cut',
    scopeValidity: valid ? 'VALID' : 'INVALID', readiness: 'NOT_READY', cutSha256, error, missingQualification,
    candidate: { ...FIRST_MAC_CANDIDATE }, ...FIRST_MAC_AUTHORITY, qualificationPerformed: false, releaseAuthorityGranted: false });
}
export function verifyFirstMacReleaseCutV1({ cutBytes, expectedCutSha256, sources } = {}) {
  let digest = '';
  try {
    const cut = macParse(cutBytes, expectedCutSha256); digest = expectedCutSha256;
    macKeys(sources, Object.keys(FIRST_MAC_RELEASE_SOURCE_PINS), 'E_FIRST_MAC_SOURCES'); let total = 0;
    for (const [source, pin] of Object.entries(FIRST_MAC_RELEASE_SOURCE_PINS)) {
      const bytes = sources[source];
      macCheck(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= FIRST_MAC_MAX_SOURCE
        && (total += bytes.length) <= 32 * 1024 * 1024 && macDigest(bytes) === pin, 'E_FIRST_MAC_SOURCE_DRIFT:' + source);
    }
    macCheck(macEqual(cut.basis, FIRST_MAC_BASIS), 'E_FIRST_MAC_BASIS');
    const graph = macClosure(JSON.parse(sources[FIRST_MAC_PROGRAM].toString('utf8')));
    macCheck(macEqual(cut.traceability, { originalNodeCount: 109, originalEdgeCount: 171, roots: FIRST_MAC_ROOTS,
      nodeIds: graph.nodeIds, edges: graph.edges.map(macEdgePolicy),
      inheritedEvidencePolicy: 'ORIGINAL_REQUIRED_EVIDENCE_CONTRACTS_REMAIN_REQUIRED_FOR_INCLUDED_OBLIGATIONS' }), 'E_FIRST_MAC_TRACEABILITY');
    macCheck(macEqual(cut.applicability, FIRST_MAC_SCOPE_ROWS.map(([id, subjects, disposition, proofObligations, reason]) =>
      ({ id, subjects, disposition, proofObligations, reason, ownerChoiceRef: FIRST_MAC_CHOICE }))), 'E_FIRST_MAC_APPLICABILITY');
    macCheck(macEqual(cut.minimumInterchange, macRoutes()), 'E_FIRST_MAC_INTERCHANGE');
    macCheck(macEqual(cut.profiles, macProfiles()), 'E_FIRST_MAC_PROFILES');
    macCheck(macEqual(cut.protectedRequirements, FIRST_MAC_REQUIRED), 'E_FIRST_MAC_REQUIREMENTS');
    const law = entitlementLaw.ENTITLEMENT_AUTHORITY_MODE;
    macCheck(law.mode === 'SAFE_DENY' && law.ownerDecision === 'DENIED' && law.entitlementDependentBehaviorEnabled === false
      && macEqual(law.enabledTiers, ['free']) && macEqual(law.disabledTiers, ['pro']), 'E_FIRST_MAC_CURRENT_ENTITLEMENT');
    macCheck(macEqual(cut.entitlement, { policyId: 'FREE_SAFE_DENY_PRO_DISABLED', offlineRequired: true,
      downgradeNoLossRequired: true, pricingAuthority: false }), 'E_FIRST_MAC_ENTITLEMENT');
    macCheck(cut.capabilityPolicy === 'ALL_ENABLED_AND_ADVERTISED_INCLUDING_PERSISTED_AUTHOR_DATA', 'E_FIRST_MAC_CAPABILITY_POLICY');
    macCheck(macEqual(cut.deferredCapabilities, { newEncryptedProduct: { enabled: false, qualification: 'DEFERRED_POST_RELEASE' },
      wideAllProviderFullBookRepeatedRoundtrip: 'DEFERRED_FULL_PROFILE_ONLY', newAtlasWsePulse: 'DEFERRED', newPlatformsEcosystem: 'DEFERRED' }), 'E_FIRST_MAC_DEFERRED_CAPABILITIES');
    macCheck(macEqual(cut.qualificationPolicy, FIRST_MAC_QUALIFICATION_POLICY), 'E_FIRST_MAC_QUALIFICATION_POLICY');
    macCheck(macEqual(cut.candidate, FIRST_MAC_CANDIDATE), 'E_FIRST_MAC_CANDIDATE_UNFROZEN');
    macCheck(macEqual(cut.authority, FIRST_MAC_AUTHORITY), 'E_FIRST_MAC_AUTHORITY');
    macCheck(cut.nextMaterialContour === 'MR-06', 'E_FIRST_MAC_NEXT_CONTOUR');
    macCheck(Array.isArray(cut.qualification) && cut.qualification.length === 12, 'E_FIRST_MAC_LEDGER');
    const missing = FIRST_MAC_LEDGER.map(([id, workItem, currentSources, proofObligations, independentOracle], index) => {
      const row = cut.qualification[index];
      macKeys(row, ['id', 'workItem', 'currentSources', 'proofObligations', 'independentOracle', 'owner', 'status', 'historicalProof', 'missingCurrentProof'], 'E_FIRST_MAC_LEDGER_FIELDS');
      macCheck(row.id === id && row.workItem === workItem && macEqual(row.currentSources, currentSources)
        && macEqual(row.proofObligations, proofObligations) && row.independentOracle === independentOracle
        && row.owner === 'OWNER_ADMITTED_EXECUTOR_WITH_INDEPENDENT_ACCEPTANCE' && row.status === 'UNKNOWN_REQUIRES_EXACT_CANDIDATE_BINDING'
        && typeof row.missingCurrentProof === 'string' && row.missingCurrentProof.trim().length >= 20, 'E_FIRST_MAC_LEDGER:' + id);
      macKeys(row.historicalProof, ['classification', 'reference', 'currentCandidateAcceptance'], 'E_FIRST_MAC_HISTORY_FIELDS');
      macCheck(row.historicalProof.classification === 'HISTORICAL_ONLY_NOT_CURRENT' && row.historicalProof.currentCandidateAcceptance === false
        && typeof row.historicalProof.reference === 'string' && row.historicalProof.reference.length >= 10, 'E_FIRST_MAC_HISTORY:' + id);
      return { id, workItem, proofObligations: [...proofObligations], status: row.status, missingCurrentProof: row.missingCurrentProof };
    });
    return macResult(true, digest, '', missing);
  } catch (error) { return macResult(false, digest, error instanceof Error ? error.message : 'E_FIRST_MAC_INVALID'); }
}
function macFileVersion(stat) { return [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].map(String).join(':'); }
function macParents(filePath) {
  const result = []; let current = path.dirname(filePath);
  for (;;) { const stat = fs.lstatSync(current, { bigint: true }); macCheck(stat.isDirectory() && !stat.isSymbolicLink(), 'E_FIRST_MAC_PARENT_TYPE');
    result.push([current, String(stat.dev) + ':' + String(stat.ino)]); if (current === path.dirname(current)) return result; current = path.dirname(current); }
}
function macReadFile(filePath, maxBytes) {
  const parents = macParents(filePath), named = fs.lstatSync(filePath, { bigint: true });
  macCheck(named.isFile() && !named.isSymbolicLink() && named.size > 0 && named.size <= BigInt(maxBytes), 'E_FIRST_MAC_FILE_SIZE_TYPE');
  const fd = fs.openSync(filePath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const before = fs.fstatSync(fd, { bigint: true }); macCheck(before.isFile() && macFileVersion(before) === macFileVersion(named), 'E_FIRST_MAC_FILE_IDENTITY');
    const bytes = Buffer.alloc(Number(before.size) + 1); let offset = 0;
    while (offset < bytes.length) { const n = fs.readSync(fd, bytes, offset, bytes.length - offset, null); if (!n) break; offset += n; }
    macCheck(offset === Number(before.size) && macFileVersion(fs.fstatSync(fd, { bigint: true })) === macFileVersion(before)
      && macFileVersion(fs.lstatSync(filePath, { bigint: true })) === macFileVersion(before)
      && macEqual(macParents(filePath), parents), 'E_FIRST_MAC_FILE_CHANGED');
    return { bytes: Buffer.from(bytes.subarray(0, offset)), version: macFileVersion(before), parents };
  } finally { fs.closeSync(fd); }
}
export function readFirstMacReleaseCutV1({ repoRoot, cutPath, expectedCutSha256 } = {}) {
  try {
    macCheck(typeof repoRoot === 'string' && path.isAbsolute(repoRoot) && typeof cutPath === 'string' && path.isAbsolute(cutPath)
      && repoRoot === path.resolve(repoRoot) && cutPath === path.resolve(cutPath), 'E_FIRST_MAC_INPUT_PATH');
    const capturedCut = macReadFile(cutPath, FIRST_MAC_MAX_CUT); macParse(capturedCut.bytes, expectedCutSha256);
    const sources = {}, captured = [];
    for (const source of Object.keys(FIRST_MAC_RELEASE_SOURCE_PINS)) { const filePath = path.join(repoRoot, source);
      const read = macReadFile(filePath, FIRST_MAC_MAX_SOURCE); sources[source] = read.bytes; captured.push([filePath, read]); }
    // A final whole-input fence prevents a mixed read when a trusted source changes during capture.
    for (const [filePath, read] of [[cutPath, capturedCut], ...captured]) macCheck(
      macFileVersion(fs.lstatSync(filePath, { bigint: true })) === read.version && macEqual(macParents(filePath), read.parents), 'E_FIRST_MAC_SOURCE_CAPTURE_STALE');
    return verifyFirstMacReleaseCutV1({ cutBytes: capturedCut.bytes, expectedCutSha256, sources });
  } catch (error) { return macResult(false, '', error instanceof Error ? error.message : 'E_FIRST_MAC_READ'); }
}
function runFirstMacCli(argv) {
  let state;
  try {
    const options = {}; const accepted = new Map([['--cut', 'cutPath'], ['--cut-sha256', 'expectedCutSha256'], ['--repo-root', 'repoRoot']]);
    const seen = new Set();
    for (let i = 0; i < argv.length; i += 1) { const flag = argv[i]; macCheck(!seen.has(flag), 'E_FIRST_MAC_CLI_DUPLICATE'); seen.add(flag);
      if (flag === '--verify-first-mac-cut' || flag === '--json') continue;
      macCheck(accepted.has(flag) && typeof argv[i + 1] === 'string' && !argv[i + 1].startsWith('--'), 'E_FIRST_MAC_CLI_USAGE');
      options[accepted.get(flag)] = argv[++i]; }
    macCheck(seen.has('--verify-first-mac-cut') && options.cutPath && options.expectedCutSha256, 'E_FIRST_MAC_CLI_USAGE');
    options.repoRoot = path.resolve(options.repoRoot || process.cwd()); options.cutPath = path.resolve(options.cutPath);
    state = readFirstMacReleaseCutV1(options);
  } catch (error) { state = macResult(false, '', error instanceof Error ? error.message : 'E_FIRST_MAC_CLI_USAGE'); }
  process.stdout.write(JSON.stringify(state, null, 2) + '\n');
  process.exitCode = state.scopeValidity === 'VALID' ? 0 : 1;
}

// Explicit full-Mac scope query. Historical V1 policy and release tokens stay separate.
export const FIRST_MAC_RELEASE_V2_SOURCE_PINS = Object.freeze({
  "AGENTS.md": "af4fdeb93def4476134c376ba8c3679f76d0837d895478628841b91a35cd37da",
  "CANON.md": "99398ac898104c7a392f0e84b4bb8848212e2c5a7db6ae27cbfc549c3e070e48",
  "docs/AGENT_START_PROTOCOL.md": "3a86699d6320666c84ec1316e2e51cf78f843893759ba2d1b3eb98a9c5ee1b4f",
  "docs/BIBLE.md": "94864b5d7cbec709ca6d7e9c6a838ff9405cfbc86443a5485acd149ccc16de93",
  "docs/OPS/R24/EXECUTABLE_PROGRAM_R2_4.json": "7185d649974289e8b3a0b310203b32dbd0bac96a613adf3cf26b308ff0067df5",
  "docs/OPS/R24/OWNER_GATE_DECISIONS/ENTITLEMENT_SEMANTICS_ADR_OR_DENY_WP206_SAFE_ENTITLEMENT_BASELINE_V1.json": "d86d4edd2faf14a4ac019a3561ce468a83c333b5112ba57490211b04cd061c0e",
  "docs/OPS/R24/OWNER_GATE_DECISIONS/LOCAL_RELEASE_PERMIT_WP307_WRITER_LOCAL_PROFILE_V1.json": "061e5adf483ecbfbfb5278cf14da04fd332fd26dfe0b3debe006eda1a8ff68c1",
  "docs/OPS/STATUS/CANON_STATUS.json": "0c73f3d0ed99adab897b841a8471733572e6c78970371eba751e4fe2418192be",
  "docs/OPS/STATUS/XPLAT_UNIFIED_MASTER_EXECUTION_CONTRACT_v3.13a-final.md": "b8e99ad1c9cd37e874d3145c79be99f6f3181a9eae7078060f9e497e0896077b",
  "docs/OPS/STATUS/YALKEN_ATLAS_MINDMAP_AUTONOMOUS_MASTER_PLAN_V5_BINDING.json": "57f97fc901a7d5cf5ba9195f6cf0d69f0abbc3af4774d0cfa843c4111de7981d",
  "docs/OPS/STATUS/YALKEN_ATLAS_MINDMAP_AUTONOMOUS_MASTER_PLAN_V5_REPO_SNAPSHOT.md": "2bf4000f45fe13ad99c3da75c0c197ae19603473539482b642cbf6ec695d36fe",
  "docs/corex/COREX.md": "4f4582deceb92c1b796f098b9cf87eac65317513a1bdfa3429e3d9076b3e914c",
  "docs/corex/COREX.v2.md": "ea25f66352497e58935c673d3bf3c82d828e31dcc3cdad1ca19ef1250512f0bf",
  "package.json": "96164dc319209209c1edf12c4d1a745b3bc0fcd38a8fc2d943ac143d87338696",
  "scripts/ops/r24/corrective/rcv00d-graph-derived-selector.mjs": "21d9d8c6e0e214d3142f0d0b5f7f7f9e42ad23858adacb8519aacdea7b415504",
  "scripts/ops/r24/effective-state-compiler.mjs": "6f7d5be6ed58afea72ee32a1145381aaed552461ec0b5d62f61dbdd945fefcf3",
  "scripts/ops/r24/package-claim-compiler-v3.mjs": "c79ee1641b5a4339eb1b8d6a76fb8f0075c9da718e2ab8b2ba22d7d89de56f0c",
  "scripts/ops/r24/release-security-physical-pk1.mjs": "a0b84198fe20e82edfe18c628550213ae9092c4e4a8b07f953f4ddea57140030",
  "scripts/ops/r24/writer-claim-compiler-v0.mjs": "3a2ff7e751ae5bde079684f36e05ce11236ef706b28a94170b374f48793604eb",
  "src/core/atlas-decision-substrate-v1.mjs": "f2406765034e968e9b312e0613d57a9a43ceb22a09f8d9f10902ac4447fc8018",
  "src/core/atlas-foundation-claim-v1.mjs": "1185504976e32ab8061356934858301e2e7c30671c088415e67bdefb234a87cb",
  "src/core/atlas-product-claim-v1.mjs": "84400bc2e15ca00c530ff6b6c8f7988aaf0c458646df2f2956e945121314a5a3",
  "src/core/autosave-generation-v1.cjs": "c901970cd0b6a7d865e4af1f5f305fb04873a3397da591691c5aa43af52cf752",
  "src/core/dirty-admission-v1.cjs": "2d1928cfc3f5b6ef669c0628578113fef5b345eb4bd3485f5e720c4d26e4362b",
  "src/core/entitlement-law-v1.cjs": "7652d20be2aacefa9e2b94797656fd02ae7e3cd104bc70c39f50ce494c8208d3",
  "src/core/frozen-feature-spec-query-ir-v1.mjs": "7797cf6bdc4abb63a6b337f9daf14760875cfd33f241e3775034eaaa64e5e4ac",
  "src/core/lifecycle-recovery-v1.cjs": "57cf18f554b9b478ba1509860013cb2d54d9660f15b69ea56e2da830bdac0506",
  "src/core/local-automation-v1.mjs": "50fe5e24e83d9de96126322635229ba35b5de285b2db531cdbdaad1b5f8452f8",
  "src/core/minimum-interchange-v1.cjs": "143750fca1e434ad2081ce42102c512370f07323b1e18e64d1be9ef7850dd561",
  "src/core/proposal-workflow-v1.mjs": "c78954dc8814621e7e7a8e9e71f5b8c5b49c4bb6ca78aeee8692a8d088b8aee9",
  "src/core/pulse-claim-v1.mjs": "bc31ef150c13f3c011b434534a08133050d168d34ba4ab0d37bf92daee219734",
  "src/core/pulse-formulas-v1.mjs": "39296c0d1541c9faa73913e00fc06e68f572e0091b225ac77898ede2f5490014",
  "src/core/pulse-ledger-v1.mjs": "3d0fec80d997ce4415649f7cff04e103ab15231bd05b3c62c4618cf32696b08b",
  "src/core/pulse-local-history-v1.mjs": "be068cfc066c089bd0f5dfd6ba49c6b7a02c9706dcb0ddb4ffe25ead929e29a9",
  "src/core/pulse-policy-codec-v1.mjs": "b7156aa083f855c25315afc1fb84814b69f6694323f3d14b0a6c2002c61a3a3a",
  "src/core/pulse-privacy-v1.mjs": "0aba8b0d3a53e6752e1b73480bacc476aa8e9de867053e5f86512bfb326f9eb5",
  "src/core/recovery-ledger-v1.cjs": "f6f0ab01ee768e374f07d2e830b2b4cca3b5a5a68278ca291b46229cffbb0e25",
  "src/core/runtime.mjs": "64f054c7555aac4a02dd31f47c138f5d25ad24028c7b8cf7b07576f8bb9f8122",
  "src/core/writer-local-profile-v1.cjs": "47552db4fb1539bff248025fc987ba3415b9bfcc59c3846ed996ee933d8598e8",
  "src/core/wse-claims-v1.mjs": "e830fed3297b51faa1f48e19e7025aad4d585b60bbb5bd7a0b0e451683984b2a",
  "src/core/wse-revision-time-object-v1.mjs": "f134ff3e3f067de49ad74a5c710ec80d612accbefa9a6e6867bf9694cdd1a247",
  "src/core/wse-series-multi-layer-v1.mjs": "5b12ccae56ee1d649044dbd33c06feca1122644595dd01a6942e00201e93d240",
  "src/core/wse-state-evidence-v1.mjs": "e82b7ec841c391ce8e1e8bfb3fa9f161feddddd83d70f17914c420618e2ce99e",
  "src/core/wse-threads-explanation-v1.mjs": "3c59b7328273f50d087982b1f2e32b327790b609afe0e46cc5c65111eed0db2c",
  "src/derived/mindmap/deriveManualMapGraph.mjs": "878b7c6907c379c4c6a07ef8405cfee50b4c6341d49332eda58f55b082df20f6",
  "src/export/archive/projectArchiveExportHandler.js": "a5a302fc6242913acece3ed2fdff171bbbc5b50fbed804c70209d9b63ee4fe44",
  "src/export/docx/docxMinExportHandler.js": "40e9c55d7016edb2c9b91388dee62447b52aff94ae8f7a2806cc54a03038963f",
  "src/export/markdown/v1/parseMarkdownV1.mjs": "24510611af0757567b45597f604de443eabc64923f64a5f1f291ee4f1fb1d851",
  "src/export/markdown/v1/serializeMarkdownV1.mjs": "fedbc3e95ce9022c69e704deb1564a3358e50984e17788685184fd03aaae39c1",
  "src/export/markdown/v1/types.mjs": "420a1d65704deb522b05c881c23d7beffeddc5740017edb5955edd43bc95c8f4",
  "src/main.js": "6e08a647b9eeb9412b0e1bcf7d7abaa7893b5bfc19d82e575312b8598d5ee1f6",
  "src/main/docxImportComputePort.cjs": "6e6fd633a460a8a3fac7a4f0a8fb4e93ed5a84bcc86df60707a92a49882061ab",
  "src/main/docxImportComputeWorker.cjs": "25cf9ccd00c7259b9fd7c52350f7367f5642b814262285c1fa22c1e0a4c6afe4",
  "src/preload.js": "39a3fbe05a6f4d7844f9bedf00063b7f983976ea79a83f9029f4d29733300ea2",
  "src/product/stage10ApplicationBootstrap.mjs": "fa82ede16ec94a041745b7416dc69bc7f371d3f5f41dd5a6c07f75e8a7424275",
  "src/product/stage10ApplicationCommandRoute.mjs": "cb0a4c93314e997cbca6ce9559a02fa42088989b803e11b24f8296d7024333e0",
  "src/product/stage10MainPersistenceAdapter.mjs": "1d258e7b71346c2ca5243a9272cde2216dcba4276b52d26f520a6acfaffd9c91",
  "src/renderer/design-os/designOsFormConfiguration.mjs": "9fb48989bfc52e2778ade241424c62a15f5965d385f35b9e82d6a32069969d7d",
  "src/renderer/flags.js": "db6022022bc138c77d788125dc996ec4c088e9df903da9e97b92a883aba62b6b",
  "src/renderer/index.html": "2b2d08a6ec5a33b545a4963a3e10978b6662353bc87fa555943d11a37429f60f",
  "src/runtime-governance/docs/OPS/CAPABILITIES_MATRIX.json": "5c2e1ae8ab18b67e55e891c2817ff78455da640fd2cac2f672ef0afcb05a02c1",
  "src/shared/productCommandRegistry.cjs": "0d5edc3569c399e8143d1cdb0dcacfc312c7db777f8146e045567b426977d5d5",
  "src/shared/workspaceQueryRegistry.cjs": "8b50247c006d02d35a2d9d5ce98f50c0cd64e2a4ad9ae51dec58acbe117d6aa0",
  "src/utils/docxImportSafeCreate.js": "d68dcd69df66c2166ade19d1e08f0c834393da8ecc302b888b096c4c0f85ba70",
  "src/utils/markdownImportSafeCreate.js": "435d0054e1d250eb84e810e6cd78fed5b6d5b2bf551950db35c8df6f562b2c97",
  "src/utils/txtImportSafeCreate.js": "1fbdc4e1e6a4d013649a0c9625febf15a2a688b1b3bbd3b48a0b277a5cd5bb37"
});
const FULL_MAC_CHOICE = 'OWNER_FULL_MAC_P12_P19_P27_20261022';
const FULL_MAC_ROOTS = [...FIRST_MAC_ROOTS, 'WP-607_WSE_CLAIMS', 'WP-806_PULSE_CLAIM'];
const FULL_MAC_REQUIRED = [...FIRST_MAC_REQUIRED, 'ATLAS_FULL_FOUNDATION', 'ATLAS_ALL_STAGES_CELLS_PROJECTIONS',
  'WSE_DECISION_MEMORY', 'PULSE_CONTINUITY', 'ENVIRONMENT_EPOCH_HISTORY', 'FULL_PRODUCT_NUMERICAL_ENVELOPE'];
const FULL_MAC_ATLAS_PLAN = 'docs/OPS/STATUS/YALKEN_ATLAS_MINDMAP_AUTONOMOUS_MASTER_PLAN_V5_REPO_SNAPSHOT.md';
const FULL_MAC_SCOPE_ROWS = [...FIRST_MAC_SCOPE_ROWS,
  ['S10', ['WP-400_ANCHOR_LINEAGE', 'WP-401_BOOK_SNAPSHOT', 'WP-402_PROJECTOR_KERNEL', 'WP-403_DECISION_SUBSTRATE',
    'WP-404_ATLAS_FOUNDATION_CLAIM', 'WP-500_ASSOCIATIONS', 'WP-501_TIME_KNOWLEDGE', 'WP-502_THREADS_CAUSALITY',
    'WP-503_ATLAS_SURFACE', 'WP-504_DOSSIER_LAYOUT_LINKS', 'WP-505_REGISTER_AND_ASK', 'WP-506_COUNTERFACTUAL', 'WP-507_ATLAS_PRODUCT_CLAIM'],
  'inherited', ['ATLAS_FULL_FOUNDATION', 'ATLAS_ALL_STAGES_CELLS_PROJECTIONS', 'ENABLED_CAPABILITY_COMPLETENESS'],
  'All twelve Atlas stages, fifteen analytical cells and four distinct projections remain required before full Mac release'],
  ['S11', ['WP-600_FEATURESPEC_QUERY_IR', 'WP-601_LOCAL_AUTOMATION', 'WP-602_PROPOSAL_WORKFLOW', 'WP-603_WSE_STATE_EVIDENCE',
    'WP-604_WSE_THREADS_EXPLANATION', 'WP-605_WSE_REVISION_TIME_OBJECT', 'WP-606_WSE_SERIES_MULTI_LAYER', 'WP-607_WSE_CLAIMS',
    'WP-800_PULSE_POLICY_CODEC', 'WP-801_PULSE_LEDGER', 'WP-802_PULSE_FORMULAS', 'WP-803_DESCRIPTIVE_HISTORY',
    'WP-804_PULSE_PRIVACY', 'WP-805_LOCAL_HISTORY', 'WP-806_PULSE_CLAIM'], 'inherited',
  ['WSE_DECISION_MEMORY', 'PULSE_CONTINUITY', 'FULL_HISTORY_RETENTION', 'FULL_PRODUCT_NUMERICAL_ENVELOPE'],
  'WSE, decision memory, Pulse and continuity are included; original independent proof and no-loss/privacy duties remain required'],
  ['S12', ['WP-303_DESIGN_OS_CUSTOMIZATION'], 'inherited', ['ENVIRONMENT_EPOCH_HISTORY', 'NO_LOSS_SAVE_REOPEN', 'FULL_HISTORY_RETENTION'],
  'ENV-EPOCH-01 belongs to existing WP303; configuration changes preserve distinct immutable historical epochs, manuscript and Pulse history'],
];
const FULL_MAC_LEDGER = [...FIRST_MAC_LEDGER,
  ['MAC-13', 'ATLAS_FOUNDATION', ['src/core/atlas-foundation-claim-v1.mjs', 'src/core/atlas-decision-substrate-v1.mjs'],
    ['ATLAS_FULL_FOUNDATION', 'ENABLED_CAPABILITY_COMPLETENESS'], 'Independent anchor/book/projector/decision reader and exact current foundation claim'],
  ['MAC-14', 'FULL_ATLAS_MAPS', ['src/core/atlas-product-claim-v1.mjs', 'src/core/runtime.mjs', 'src/derived/mindmap/deriveManualMapGraph.mjs'],
    ['ATLAS_ALL_STAGES_CELLS_PROJECTIONS', 'ENABLED_CAPABILITY_COMPLETENESS'], 'Independent twelve-stage, fifteen-cell and four-projection inventory plus genuine map persistence/readback'],
  ['MAC-15', 'WSE_DECISION_MEMORY', ['src/core/frozen-feature-spec-query-ir-v1.mjs', 'src/core/wse-claims-v1.mjs', 'src/core/atlas-decision-substrate-v1.mjs'],
    ['WSE_DECISION_MEMORY', 'FULL_HISTORY_RETENTION'], 'Independent supported intent/query/proposal/state/revision/series and decision provenance oracles'],
  ['MAC-16', 'PULSE_CONTINUITY', ['src/core/pulse-claim-v1.mjs', 'src/core/pulse-ledger-v1.mjs', 'src/core/pulse-local-history-v1.mjs'],
    ['PULSE_CONTINUITY', 'FULL_HISTORY_RETENTION', 'FULL_PRODUCT_NUMERICAL_ENVELOPE'], 'Independent event/aggregate/history/privacy/restore reader and simultaneous full-product workload'],
  ['MAC-17', 'ENV-EPOCH-01', ['src/renderer/design-os/designOsFormConfiguration.mjs', 'src/core/pulse-local-history-v1.mjs'],
    ['ENVIRONMENT_EPOCH_HISTORY', 'FULL_HISTORY_RETENTION'], 'Independent before/after configuration epochs with protected historical ledger and manuscript readback'],
];
const FULL_MAC_BASIS = { ...FIRST_MAC_BASIS, admissionBaseSha: '4bc78a775df9476877add40f62a1fcb1932ed7a7',
  admissionBaseTree: '7253628f121bfd813cdd0d0f052ef97bfbb4b786', remoteMainAtAdmission: '4bc78a775df9476877add40f62a1fcb1932ed7a7',
  ownerChoiceRef: FULL_MAC_CHOICE, planSha256: 'eb2b3ee7455c34576925e0028685a0d13283f122d774a5336910a6172102e377' };
const FULL_MAC_TOP_FIELDS = ['schemaVersion', 'cutId', 'basis', 'sourceBindings', 'traceability', 'applicability', 'minimumInterchange',
  'profiles', 'protectedRequirements', 'entitlement', 'capabilityPolicy', 'deferredCapabilities', 'fullProductScope',
  'qualificationPolicy', 'qualification', 'candidate', 'authority', 'nextMaterialContour'];
const FULL_MAC_DEFERRED = { newEncryptedProduct: { enabled: false, qualification: 'DEFERRED_POST_RELEASE' },
  wideAllProviderFullBookRepeatedRoundtrip: 'DEFERRED_FULL_PROFILE_ONLY', newAtlasWsePulse: 'REQUIRED_BEFORE_FULL_MAC_RELEASE',
  newPlatformsEcosystem: 'DEFERRED' };
export function canonicalFirstMacReleaseCutV2(value) { return canonicalFirstMacReleaseCutV1(value); }
function fullMacParse(cutBytes, expectedCutSha256) {
  macCheck(Buffer.isBuffer(cutBytes) && cutBytes.length > 0 && cutBytes.length <= FIRST_MAC_MAX_CUT, 'E_FULL_MAC_CUT_SIZE_TYPE');
  macCheck(typeof expectedCutSha256 === 'string' && SHA256_HEX_RE.test(expectedCutSha256)
    && macDigest(cutBytes) === expectedCutSha256, 'E_FULL_MAC_CUT_PIN');
  let text, cut;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(cutBytes); cut = JSON.parse(text); }
  catch { throw new Error('E_FULL_MAC_CUT_JSON'); }
  const pending = [[cut, 0]]; let count = 0;
  while (pending.length) { const [value, depth] = pending.pop(); macCheck(depth <= 32 && ++count <= 20000, 'E_FULL_MAC_CUT_COMPLEXITY');
    if (value && typeof value === 'object') Object.values(value).forEach(child => pending.push([child, depth + 1])); }
  macCheck(text === canonicalFirstMacReleaseCutV2(cut), 'E_FULL_MAC_CUT_CANONICAL');
  macKeys(cut, FULL_MAC_TOP_FIELDS, 'E_FULL_MAC_CUT_FIELDS');
  macCheck(cut.schemaVersion === 'yalken.first-mac-release-cut.v2' && cut.cutId === 'FIRST_SUPPORTED_MAC_V2', 'E_FULL_MAC_CUT_IDENTITY');
  // Never open a path supplied by a caller until it equals this independent policy.
  macCheck(macEqual(cut.sourceBindings, FIRST_MAC_RELEASE_V2_SOURCE_PINS), 'E_FULL_MAC_SOURCE_BINDINGS');
  return cut;
}
function fullMacClosure(program) {
  macClosure(program); // Revalidate every original node, edge and cycle, including outside this closure.
  const nodes = new Map(program.nodes.map(row => [row.id, row])), seen = new Set();
  function visit(id) { if (seen.has(id)) return; seen.add(id); nodes.get(id).dependsOn.forEach(visit); }
  FULL_MAC_ROOTS.forEach(visit);
  const nodeIds = [...seen].sort(), edges = nodeIds.flatMap(dependent => nodes.get(dependent).dependsOn.map(prerequisite => ({ dependent, prerequisite })));
  macCheck(nodeIds.length === 99 && edges.length === 159, 'E_FULL_MAC_CLOSURE');
  return { originalNodeCount: 109, originalEdgeCount: 171, roots: FULL_MAC_ROOTS, nodeIds,
    edges: edges.map(edge => {
      const id = edge.dependent; let row = null;
      if (/^(WP-40[0-4]_|WP-50[0-7]_|A[01]_|V1_)/u.test(id)) row = FULL_MAC_SCOPE_ROWS[9];
      else if (/^(WP-60[0-7]_|WP-80[0-6]_)/u.test(id)) row = FULL_MAC_SCOPE_ROWS[10];
      else if (id === 'WP-303_DESIGN_OS_CUSTOMIZATION') row = FULL_MAC_SCOPE_ROWS[11];
      if (!row) return { ...macEdgePolicy(edge), ownerChoiceRef: FULL_MAC_CHOICE };
      const [applicabilityId, , disposition, supplementalProof, reason] = row;
      const proofObligations = [...new Set([...macEdgePolicy(edge).proofObligations, ...supplementalProof])];
      return { ...edge, applicabilityId, disposition, proofObligations, reason, ownerChoiceRef: FULL_MAC_CHOICE };
    }), inheritedEvidencePolicy: 'ORIGINAL_REQUIRED_EVIDENCE_CONTRACTS_REMAIN_REQUIRED_FOR_INCLUDED_OBLIGATIONS',
    completionPolicy: 'ORIGINAL_109_NODE_171_EDGE_PROGRAM_UNCHANGED_NOT_COMPLETED_BY_SCOPE_QUERY' };
}
function fullMacProductScope(sources) {
  const stages = [...sources[FULL_MAC_ATLAS_PLAN].toString('utf8').matchAll(/^### STAGE (\d{2}) — (.+)$/gmu)]
    .map(([, stageId, title]) => ({ stageId, title, applicability: 'REQUIRED_MACOS', qualification: 'UNKNOWN_REQUIRES_EXACT_CANDIDATE_BINDING' }));
  macCheck(stages.length === 12 && stages.every((row, index) => row.stageId === String(index).padStart(2, '0')), 'E_FULL_MAC_ATLAS_SOURCE_STAGES');
  return { planParts: ['P12', 'P13', 'P14', 'P15', 'P16', 'P17', 'P18', 'P19'],
    atlas: { stages, stageContracts: 'ORIGINAL_STAGE_REQUIREMENTS_AND_INDEPENDENT_EVIDENCE_REMAIN_REQUIRED',
      executionAuthority: 'DIRECT_OWNER_TASK_DOES_NOT_RESUME_HISTORICAL_STAGE_OR_LEASE',
      analyticalCells: ['fragment-or-selected-node', 'scene', 'book'].flatMap(scope =>
        ['associations', 'plot-threads', 'knowledge', 'time', 'promises'].map(dimension => ({ scope, dimension }))),
      projections: ['Plot', 'Idea', 'Meaning', 'Atlas'], projectionsAreDistinctFromAnalyticalCells: true,
      languageModes: ['GLOBAL', 'BASIC', 'DEEP'], languageAdmission: 'PRODUCT_ENGINE_LICENSE_RESOURCE_AND_CURRENT_CANDIDATE_PROOF_REQUIRED_NO_SILENT_FALLBACK' },
    wseProgramNodes: FULL_MAC_SCOPE_ROWS[10][1].filter(id => id.startsWith('WP-60')),
    pulseProgramNodes: FULL_MAC_SCOPE_ROWS[10][1].filter(id => id.startsWith('WP-80')),
    decisionMemory: { workItem: 'WP-403_DECISION_SUBSTRATE', policy: 'AUTHOR_DECISIONS_PROVENANCE_AND_STALE_REFUSALS_REQUIRED' },
    environmentEpochs: { id: 'ENV-EPOCH-01', workItem: 'WP-303_DESIGN_OS_CUSTOMIZATION',
      policy: 'HISTORICAL_EPOCHS_REMAIN_IMMUTABLE_AND_DISTINCT', manuscriptMutation: false, pulseHistoryTruncation: false },
    workload: { metricIds: Array.from({ length: 13 }, (_, index) => 'PERF-' + String(index + 1).padStart(2, '0')),
      state: ['Writer', 'Atlas', 'WSE', 'Pulse', 'Continuity', 'EnvironmentEpochs'],
      numericalAcceptance: 'UNKNOWN_REQUIRES_APPROVED_EXACT_WORKLOAD_AND_ARTIFACT', proxyTimingAccepted: false } };
}
function fullMacProfiles() {
  return { ...macProfiles(), runtime: writerLocal.createWriterExactAtlasProfileProjection({ isPackaged: true, platform: 'darwin' }),
    legacyProfileMeaning: 'WRITER_LOCAL_V1_REMAINS_HISTORICAL_NOT_FULL_MAC_QUALIFICATION' };
}
function fullMacResult(valid, cutSha256, error = '', missingQualification = []) {
  return macFreeze({ schemaVersion: 'yalken.first-mac-release-cut-verification.v2', operation: 'verify-first-mac-cut-v2',
    scopeValidity: valid ? 'VALID' : 'INVALID', readiness: 'NOT_READY', cutSha256, error, missingQualification,
    candidate: { ...FIRST_MAC_CANDIDATE }, ...FIRST_MAC_AUTHORITY, qualificationPerformed: false, releaseAuthorityGranted: false });
}
export function verifyFirstMacReleaseCutV2({ cutBytes, expectedCutSha256, sources } = {}) {
  let digest = '';
  try {
    const cut = fullMacParse(cutBytes, expectedCutSha256); digest = expectedCutSha256;
    macKeys(sources, Object.keys(FIRST_MAC_RELEASE_V2_SOURCE_PINS), 'E_FULL_MAC_SOURCES'); let total = 0;
    for (const [source, pin] of Object.entries(FIRST_MAC_RELEASE_V2_SOURCE_PINS)) {
      const bytes = sources[source];
      macCheck(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= FIRST_MAC_MAX_SOURCE
        && (total += bytes.length) <= 32 * 1024 * 1024 && macDigest(bytes) === pin, 'E_FULL_MAC_SOURCE_DRIFT:' + source);
    }
    macCheck(macEqual(cut.basis, FULL_MAC_BASIS), 'E_FULL_MAC_BASIS');
    macCheck(macEqual(cut.traceability, fullMacClosure(JSON.parse(sources[FIRST_MAC_PROGRAM].toString('utf8')))), 'E_FULL_MAC_TRACEABILITY');
    macCheck(macEqual(cut.applicability, FULL_MAC_SCOPE_ROWS.map(([id, subjects, disposition, proofObligations, reason]) =>
      ({ id, subjects, disposition, proofObligations, reason, ownerChoiceRef: FULL_MAC_CHOICE }))), 'E_FULL_MAC_APPLICABILITY');
    macCheck(macEqual(cut.minimumInterchange, macRoutes()), 'E_FULL_MAC_INTERCHANGE');
    macCheck(macEqual(cut.profiles, fullMacProfiles()), 'E_FULL_MAC_PROFILES');
    macCheck(macEqual(cut.protectedRequirements, FULL_MAC_REQUIRED), 'E_FULL_MAC_REQUIREMENTS');
    const law = entitlementLaw.ENTITLEMENT_AUTHORITY_MODE;
    macCheck(law.mode === 'SAFE_DENY' && law.ownerDecision === 'DENIED' && law.entitlementDependentBehaviorEnabled === false
      && macEqual(law.enabledTiers, ['free']) && macEqual(law.disabledTiers, ['pro']), 'E_FULL_MAC_CURRENT_ENTITLEMENT');
    macCheck(macEqual(cut.entitlement, { policyId: 'FREE_SAFE_DENY_PRO_DISABLED', offlineRequired: true,
      downgradeNoLossRequired: true, pricingAuthority: false }), 'E_FULL_MAC_ENTITLEMENT');
    macCheck(cut.capabilityPolicy === 'ALL_ENABLED_AND_ADVERTISED_INCLUDING_PERSISTED_AUTHOR_DATA', 'E_FULL_MAC_CAPABILITY_POLICY');
    macCheck(macEqual(cut.deferredCapabilities, FULL_MAC_DEFERRED), 'E_FULL_MAC_DEFERRED_CAPABILITIES');
    macCheck(macEqual(cut.fullProductScope, fullMacProductScope(sources)), 'E_FULL_MAC_PRODUCT_SCOPE');
    macCheck(macEqual(cut.qualificationPolicy, FIRST_MAC_QUALIFICATION_POLICY), 'E_FULL_MAC_QUALIFICATION_POLICY');
    macCheck(macEqual(cut.candidate, FIRST_MAC_CANDIDATE), 'E_FULL_MAC_CANDIDATE_UNFROZEN');
    macCheck(macEqual(cut.authority, FIRST_MAC_AUTHORITY), 'E_FULL_MAC_AUTHORITY');
    macCheck(cut.nextMaterialContour === 'FULL_MAC_CURRENT_EVIDENCE_RECONCILIATION', 'E_FULL_MAC_NEXT_CONTOUR');
    macCheck(Array.isArray(cut.qualification) && cut.qualification.length === 17, 'E_FULL_MAC_LEDGER');
    const missing = FULL_MAC_LEDGER.map(([id, workItem, currentSources, proofObligations, independentOracle], index) => {
      const row = cut.qualification[index];
      macKeys(row, ['id', 'workItem', 'currentSources', 'proofObligations', 'independentOracle', 'owner', 'status', 'historicalProof', 'missingCurrentProof'], 'E_FULL_MAC_LEDGER_FIELDS');
      macCheck(row.id === id && row.workItem === workItem && macEqual(row.currentSources, currentSources)
        && macEqual(row.proofObligations, proofObligations) && row.independentOracle === independentOracle
        && row.owner === 'OWNER_ADMITTED_EXECUTOR_WITH_INDEPENDENT_ACCEPTANCE' && row.status === 'UNKNOWN_REQUIRES_EXACT_CANDIDATE_BINDING'
        && typeof row.missingCurrentProof === 'string' && row.missingCurrentProof.trim().length >= 20, 'E_FULL_MAC_LEDGER:' + id);
      macKeys(row.historicalProof, ['classification', 'reference', 'currentCandidateAcceptance'], 'E_FULL_MAC_HISTORY_FIELDS');
      macCheck(row.historicalProof.classification === 'HISTORICAL_ONLY_NOT_CURRENT' && row.historicalProof.currentCandidateAcceptance === false
        && typeof row.historicalProof.reference === 'string' && row.historicalProof.reference.length >= 10, 'E_FULL_MAC_HISTORY:' + id);
      return { id, workItem, proofObligations: [...proofObligations], status: row.status, missingCurrentProof: row.missingCurrentProof };
    });
    return fullMacResult(true, digest, '', missing);
  } catch (error) { return fullMacResult(false, digest, error instanceof Error ? error.message : 'E_FULL_MAC_INVALID'); }
}
export function readFirstMacReleaseCutV2({ repoRoot, cutPath, expectedCutSha256 } = {}) {
  try {
    macCheck(typeof repoRoot === 'string' && path.isAbsolute(repoRoot) && typeof cutPath === 'string' && path.isAbsolute(cutPath)
      && repoRoot === path.resolve(repoRoot) && cutPath === path.resolve(cutPath), 'E_FULL_MAC_INPUT_PATH');
    const capturedCut = macReadFile(cutPath, FIRST_MAC_MAX_CUT); fullMacParse(capturedCut.bytes, expectedCutSha256);
    const sources = {}, captured = [];
    for (const source of Object.keys(FIRST_MAC_RELEASE_V2_SOURCE_PINS)) { const filePath = path.join(repoRoot, source);
      const read = macReadFile(filePath, FIRST_MAC_MAX_SOURCE); sources[source] = read.bytes; captured.push([filePath, read]); }
    for (const [filePath, read] of [[cutPath, capturedCut], ...captured]) macCheck(
      macFileVersion(fs.lstatSync(filePath, { bigint: true })) === read.version && macEqual(macParents(filePath), read.parents), 'E_FULL_MAC_SOURCE_CAPTURE_STALE');
    return verifyFirstMacReleaseCutV2({ cutBytes: capturedCut.bytes, expectedCutSha256, sources });
  } catch (error) { return fullMacResult(false, '', error instanceof Error ? error.message : 'E_FULL_MAC_READ'); }
}
function runFullMacCli(argv) {
  let state;
  try {
    const options = {}, seen = new Set();
    const accepted = new Map([['--cut', 'cutPath'], ['--cut-sha256', 'expectedCutSha256'], ['--repo-root', 'repoRoot']]);
    for (let index = 0; index < argv.length; index += 1) { const flag = argv[index];
      macCheck(!seen.has(flag), 'E_FULL_MAC_CLI_DUPLICATE'); seen.add(flag);
      if (flag === '--verify-first-mac-cut-v2' || flag === '--json') continue;
      macCheck(accepted.has(flag) && typeof argv[index + 1] === 'string' && !argv[index + 1].startsWith('--'), 'E_FULL_MAC_CLI_USAGE');
      options[accepted.get(flag)] = argv[++index]; }
    macCheck(seen.has('--verify-first-mac-cut-v2') && options.cutPath && options.expectedCutSha256, 'E_FULL_MAC_CLI_USAGE');
    options.repoRoot = path.resolve(options.repoRoot || process.cwd()); options.cutPath = path.resolve(options.cutPath);
    state = readFirstMacReleaseCutV2(options);
  } catch (error) { state = fullMacResult(false, '', error instanceof Error ? error.message : 'E_FULL_MAC_CLI_USAGE'); }
  process.stdout.write(JSON.stringify(state, null, 2) + '\n'); process.exitCode = state.scopeValidity === 'VALID' ? 0 : 1;
}

function main() {
  if (process.argv.slice(2).some(arg => arg.startsWith('--verify-first-mac-cut-v2'))) {
    runFullMacCli(process.argv.slice(2)); return;
  }
  if (process.argv.slice(2).some(arg => arg.startsWith('--verify-first-mac-cut') || arg === '--cut' || arg === '--cut-sha256')) {
    runFirstMacCli(process.argv.slice(2)); return;
  }
  const args = parseArgs(process.argv.slice(2));
  const mode = normalizeMode(args.mode);
  const repoRoot = resolveRepoRoot(args.repoRoot);
  const lockPath = resolvePath(repoRoot, args.lockPath || DEFAULT_LOCK_PATH);

  if ((args.create && args.verify) || (!args.create && !args.verify)) {
    const usage = {
      operation: '',
      mode,
      result: RESULT_FAIL,
      ok: false,
      exitCode: 1,
      failReason: 'USAGE',
      failSignalCode: '',
      token: {
        [TOKEN_NAME]: 0,
      },
      usage: 'node scripts/ops/release-candidate.mjs (--create|--verify) [--mode release|promotion] [--repo-root <path>] [--lock-path <path>] [--evidence-root <path>] [--json]',
    };
    if (args.json) process.stdout.write(`${JSON.stringify(usage, null, 2)}\n`);
    else printHuman(usage);
    process.exit(1);
  }

  let state;
  try {
    state = args.create
      ? runCreate({ mode, repoRoot, lockPath })
      : runVerify({ mode, repoRoot, lockPath, evidenceRoot: args.evidenceRoot });
  } catch (error) {
    state = {
      operation: args.create ? 'create' : 'verify',
      mode,
      result: RESULT_FAIL,
      ok: false,
      exitCode: 1,
      failReason: error instanceof Error ? error.message : String(error),
      failSignalCode: FAIL_SIGNAL,
      token: {
        [TOKEN_NAME]: 0,
      },
      lockPath,
    };
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
  } else {
    printHuman(state);
  }
  process.exit(Number.isInteger(state.exitCode) ? state.exitCode : (state.ok ? 0 : 1));
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) {
  main();
}
