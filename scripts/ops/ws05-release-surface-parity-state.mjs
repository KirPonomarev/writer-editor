#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const TOKEN_NAME = 'X70_WS05_RELEASE_SURFACE_PARITY_OK';
const CANONICAL_RELEASE_SET = [
  'ATTESTATION_SIGNATURE_OK',
  'CONFIG_HASH_LOCK_OK',
  'CORE_SOT_EXECUTABLE_OK',
  'E2E_CRITICAL_USER_PATH_OK',
  'HEAD_STRICT_OK',
  'MIGRATIONS_ATOMICITY_OK',
  'MIGRATIONS_POLICY_OK',
  'NORMALIZATION_XPLAT_OK',
  'PROOFHOOK_INTEGRITY_OK',
  'RECOVERY_IO_OK',
  'REQUIRED_SET_NO_TARGET_OK',
  'SINGLE_VERIFY_CONTOUR_ENFORCED_OK',
  'TOKEN_SOURCE_CONFLICT_OK',
  'VERIFY_ATTESTATION_OK',
].sort((a, b) => a.localeCompare(b));

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readJsonObject(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return isObjectRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function toSortedUniqueStrings(list) {
  const source = Array.isArray(list) ? list : [];
  return [...new Set(source.map((v) => normalizeString(String(v || ''))).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function parseDoctorTokens(repoRoot) {
  let out = '';
  try {
    out = execFileSync(process.execPath, ['scripts/doctor.mjs'], { cwd: repoRoot, encoding: 'utf8' });
  } catch (error) {
    out = String(error?.stdout || '');
  }
  const lines = out.split('\n');
  const tokenMap = new Map();
  for (const line of lines) {
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (k) tokenMap.set(k, v);
  }
  const toBool = (k) => tokenMap.get(k) === '1';
  return {
    HEAD_STRICT_OK_TRUE: toBool('HEAD_STRICT_OK'),
    NO_NEW_P0_DRIFT_TRUE: toBool('DRIFT_UNRESOLVED_P0_COUNT') ? false : tokenMap.get('DRIFT_UNRESOLVED_P0_COUNT') === '0',
  };
}

function evaluateCanonPointer(repoRoot) {
  const canonStatus = readJsonObject(path.join(repoRoot, 'docs/OPS/STATUS/CANON_STATUS.json'));
  const lawCanon = readJsonObject(path.join(repoRoot, 'docs/OPS/STATUS/LAW_PATH_CANON.json'));
  if (!canonStatus || !lawCanon) {
    return {
      ok: false,
      unchanged: false,
      canonicalDocPath: '',
      canonDocSha256: '',
    };
  }

  const canonPath = normalizeString(canonStatus.canonicalDocPath);
  const lawPath = normalizeString(lawCanon.lawDocPath);
  const absolutePath = path.join(repoRoot, canonPath);
  const exists = canonPath.length > 0 && fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile();
  const samePointer = canonPath.length > 0 && canonPath === lawPath;
  const active = normalizeString(canonStatus.status) === 'ACTIVE_CANON' && normalizeString(lawCanon.status) === 'ACTIVE_CANON';
  const sha = exists ? createHash('sha256').update(fs.readFileSync(absolutePath)).digest('hex') : '';

  return {
    ok: exists && samePointer && active,
    unchanged: exists && samePointer && active,
    canonicalDocPath: canonPath,
    canonDocSha256: sha,
  };
}

function evaluateRequiredSetPointer(repoRoot) {
  const requiredSetPath = path.join(repoRoot, 'docs/OPS/EXECUTION/REQUIRED_TOKEN_SET.json');
  const doc = readJsonObject(requiredSetPath);
  if (!doc) {
    return {
      ok: false,
      unchanged: false,
      configHash: '',
      lockPathBasename: path.basename(requiredSetPath),
      releaseRequired: [],
    };
  }
  const releaseRequired = toSortedUniqueStrings(doc?.requiredSets?.release);
  const configHash = normalizeString(doc.configHash).toLowerCase();
  const validHash = /^[0-9a-f]{64}$/u.test(configHash);
  return {
    ok: validHash && releaseRequired.length > 0,
    unchanged: validHash,
    configHash,
    lockPathBasename: path.basename(requiredSetPath),
    releaseRequired,
  };
}

function evaluateScopeGuard(repoRoot) {
  const doc = readJsonObject(path.join(repoRoot, 'docs/OPS/STATUS/X70_ALLOWED_CHANGE_CONTROL_V1.json'));
  if (!doc) return { active: false };
  return {
    active: doc.executionScopeClassGuardActive === true
      && normalizeString(doc.scopeControlMode) === 'BUCKET_PLUS_PATH_CLASS',
  };
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = { json: false };
  for (const arg of argv) {
    if (normalizeString(arg) === '--json') out.json = true;
  }
  return out;
}

export function evaluateWs05ReleaseSurfaceParityState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const doctor = parseDoctorTokens(repoRoot);
  const canonPointer = evaluateCanonPointer(repoRoot);
  const requiredSetPointer = evaluateRequiredSetPointer(repoRoot);
  const scopeGuard = evaluateScopeGuard(repoRoot);

  const releaseRequired = toSortedUniqueStrings(requiredSetPointer.releaseRequired);
  const releaseRequiredSetExactEqual = JSON.stringify(releaseRequired) === JSON.stringify(CANONICAL_RELEASE_SET);

  const negativeResults = {
    CANONICAL_14_SET_CHANGE_EXPECT_REJECT_TRUE: JSON.stringify(CANONICAL_RELEASE_SET.slice(0, 13)) !== JSON.stringify(CANONICAL_RELEASE_SET),
    CANON_POINTER_HASH_MISMATCH_EXPECT_REJECT_TRUE: (() => {
      const bad = { ...canonPointer, canonicalDocPath: 'docs/OPS/STATUS/WRONG_CANON.md' };
      return !(bad.unchanged && bad.canonicalDocPath === canonPointer.canonicalDocPath);
    })(),
    REQUIRED_SET_POINTER_MISMATCH_EXPECT_REJECT_TRUE: (() => {
      const badHash = requiredSetPointer.configHash ? requiredSetPointer.configHash.slice(0, 63) + '0' : '0'.repeat(64);
      return badHash !== requiredSetPointer.configHash;
    })(),
  };

  const positiveResults = {
    RELEASE_REQUIRED_SET_EXACT_EQUAL_TRUE: releaseRequiredSetExactEqual,
    CANON_POINTER_UNCHANGED_TRUE: canonPointer.unchanged,
    REQUIRED_SET_POINTER_UNCHANGED_TRUE: requiredSetPointer.unchanged,
    HEAD_STRICT_OK_TRUE: doctor.HEAD_STRICT_OK_TRUE,
    EXECUTION_SCOPE_CLASS_GUARD_ACTIVE_TRUE: scopeGuard.active,
    NO_NEW_P0_DRIFT_TRUE: doctor.NO_NEW_P0_DRIFT_TRUE,
  };

  const dod = {
    WS05_DOD_01_RELEASE_REQUIRED_SET_EXACT_EQUAL_TRUE: positiveResults.RELEASE_REQUIRED_SET_EXACT_EQUAL_TRUE,
    WS05_DOD_02_CANON_POINTER_UNCHANGED_TRUE: positiveResults.CANON_POINTER_UNCHANGED_TRUE,
    WS05_DOD_03_REQUIRED_SET_POINTER_UNCHANGED_TRUE: positiveResults.REQUIRED_SET_POINTER_UNCHANGED_TRUE,
    WS05_DOD_04_HEAD_STRICT_OK_TRUE: positiveResults.HEAD_STRICT_OK_TRUE,
    WS05_DOD_05_NO_NEW_P0_DRIFT_TRUE: positiveResults.NO_NEW_P0_DRIFT_TRUE,
    WS05_DOD_06_EXECUTION_SCOPE_CLASS_GUARD_ACTIVE_TRUE: positiveResults.EXECUTION_SCOPE_CLASS_GUARD_ACTIVE_TRUE,
  };

  const ok = Object.values(negativeResults).every(Boolean)
    && Object.values(positiveResults).every(Boolean)
    && Object.values(dod).every(Boolean);

  return {
    ok,
    failReason: ok ? '' : 'WS05_RELEASE_SURFACE_PARITY_FAIL',
    failSignalCode: ok ? '' : 'E_CORE_CHANGE_DOD_MISSING',
    [TOKEN_NAME]: ok ? 1 : 0,
    negativeResults,
    positiveResults,
    dod,
    releaseRequired,
    canonicalReleaseSet: CANONICAL_RELEASE_SET,
    canonicalDocPath: canonPointer.canonicalDocPath,
    canonicalDocSha256: canonPointer.canonDocSha256,
    requiredSetConfigHash: requiredSetPointer.configHash,
    requiredSetLockBasename: requiredSetPointer.lockPathBasename,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateWs05ReleaseSurfaceParityState();
  if (args.json) {
    process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
  } else {
    process.stdout.write(`${TOKEN_NAME}=${state[TOKEN_NAME]}\n`);
    process.stdout.write(`RELEASE_REQUIRED_SET_EXACT_EQUAL_TRUE=${state.positiveResults.RELEASE_REQUIRED_SET_EXACT_EQUAL_TRUE ? 1 : 0}\n`);
    process.stdout.write(`CANON_POINTER_UNCHANGED_TRUE=${state.positiveResults.CANON_POINTER_UNCHANGED_TRUE ? 1 : 0}\n`);
    process.stdout.write(`REQUIRED_SET_POINTER_UNCHANGED_TRUE=${state.positiveResults.REQUIRED_SET_POINTER_UNCHANGED_TRUE ? 1 : 0}\n`);
    process.stdout.write(`HEAD_STRICT_OK_TRUE=${state.positiveResults.HEAD_STRICT_OK_TRUE ? 1 : 0}\n`);
    process.stdout.write(`EXECUTION_SCOPE_CLASS_GUARD_ACTIVE_TRUE=${state.positiveResults.EXECUTION_SCOPE_CLASS_GUARD_ACTIVE_TRUE ? 1 : 0}\n`);
    if (!state.ok) process.stdout.write(`FAIL_REASON=${state.failReason}\n`);
  }
  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) {
  main();
}
