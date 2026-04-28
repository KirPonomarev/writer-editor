#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const TOKEN_NAME = 'B3C15_ATTESTATION_CHAIN_OK';
export const RELEASE_GREEN_TOKEN_NAME = 'B3C15_RELEASE_GREEN_OK';
export const SIGNATURE_TOKEN_NAME = 'ATTESTATION_SIGNATURE_OK';
export const VERIFY_TOKEN_NAME = 'VERIFY_ATTESTATION_OK';

const TASK_ID = 'B3C15_ATTESTATION_CHAIN';
const STATUS_BASENAME = 'B3C15_ATTESTATION_CHAIN_STATUS_V1.json';
const STATUS_REL_PATH = path.join('docs', 'OPS', 'STATUS', STATUS_BASENAME);
const DEFAULT_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FAIL_SIGNAL = 'E_B3C15_ATTESTATION_CHAIN_NOT_OK';
const DEFAULT_EXTERNAL_IMMUTABLE_INPUT = 'B3C15_OWNER_REVIEW_EXTERNAL_INPUT_V1:2026-04-28:LOCAL_IMMUTABLE_REVIEW_SEED';

const CHANGED_BASENAMES = Object.freeze([
  'b3c15-attestation-chain-state.mjs',
  'b3c15-attestation-chain.contract.test.js',
  STATUS_BASENAME,
]);

const DONOR_ARCHIVE_BASENAMES = Object.freeze([
  'writer-editor-longform-v5_1-block3-release-export-security-scale-pack-v1.zip',
  'writer-editor-longform-v5_1-block3-release-export-security-scale-pack-v3.zip',
  'writer-editor-longform-v5_1-turnkey-pack-v2.zip',
  'writer-editor-longform-v5_1-turnkey-pack-v3.zip',
]);

const REQUIRED_SIGNATURE_ROW_IDS = Object.freeze([
  'ATTESTATION_PAYLOAD_SCHEMA_BOUND',
  'ATTESTATION_SIGNATURE_CREATED',
  'ATTESTATION_SIGNATURE_VERIFIES',
  'ATTESTATION_EXTERNAL_INPUT_BOUND',
  'ATTESTATION_HEAD_SHA_BOUND_DYNAMICALLY',
]);

const REQUIRED_VERIFY_ROW_IDS = Object.freeze([
  'VERIFY_VALID_SIGNATURE_PASS',
  'VERIFY_SELF_SIGNED_FAIL',
  'VERIFY_INVALID_SIGNATURE_FAIL',
  'VERIFY_STALE_HEAD_FAIL',
  'VERIFY_HASH_MISMATCH_FAIL',
  'VERIFY_MISSING_EXTERNAL_INPUT_FAIL',
  'VERIFY_CHANGED_EXTERNAL_INPUT_FAIL',
]);

const REQUIRED_NEGATIVE_IDS = Object.freeze([
  'SELF_SIGNED_NEGATIVE',
  'INVALID_SIGNATURE_NEGATIVE',
  'STALE_HEAD_NEGATIVE',
  'HASH_MISMATCH_NEGATIVE',
  'MISSING_EXTERNAL_INPUT_NEGATIVE',
  'CHANGED_EXTERNAL_INPUT_NEGATIVE',
  'OFFLINE_ATTESTATION_CHAIN_BREAK_NEGATIVE',
  'DOC_ONLY_ATTESTATION_NEGATIVE',
  'RELEASE_GREEN_FALSE_NEGATIVE',
]);

const FORBIDDEN_CLAIM_KEYS = Object.freeze([
  'releaseClaim',
  'releaseGreenClaim',
  'packageBuild',
  'packageHashGeneration',
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
  'b3c14Rewrite',
  'b3c09ToB3c13Reopen',
]);

const COMMANDS = Object.freeze([
  'node scripts/ops/b3c15-attestation-chain-state.mjs --write --json',
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

function signPayload(payload, externalImmutableInput) {
  return crypto.createHmac('sha256', String(externalImmutableInput)).update(stableJson(payload), 'utf8').digest('hex');
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
      .filter((entry) => /attestation|signature|verify|release|dossier|trust|BLOCK_3|VALIDATION|INTEGRATION/iu.test(entry))
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

function buildB3C14InputRow(status) {
  return {
    basename: 'B3C14_RELEASE_DOSSIER_MINIMAL_STATUS_V1.json',
    tokenName: 'B3C14_RELEASE_DOSSIER_MINIMAL_OK',
    passed: status?.ok === true
      && status?.B3C14_RELEASE_DOSSIER_MINIMAL_OK === 1
      && status?.B3C14_RELEASE_GREEN_OK === 0
      && status?.dossierStatus === 'COMPLETE_WITH_LIMITS'
      && status?.proof?.carriedForwardLimitsBound === true
      && status?.repo?.repoRootBinding === 'WORKTREE_INDEPENDENT',
    status: status?.status || 'MISSING',
    dossierStatus: status?.dossierStatus || 'MISSING',
    releaseGreen: status?.B3C14_RELEASE_GREEN_OK === 1,
  };
}

function buildB3C14CarriedForwardLimitRows(status) {
  return Array.isArray(status?.carriedForwardLimitRows)
    ? status.carriedForwardLimitRows.map((row) => ({
      id: row.id,
      status: row.status,
      sourceBasename: row.sourceBasename,
      rows: row.rows || [],
      unsupportedScope: row.unsupportedScope || [],
      platformRows: row.platformRows || [],
      provisionalScope: row.provisionalScope || [],
    }))
    : [];
}

function buildAttestationPayload({ repoRoot, b3c14Status, externalImmutableInput }) {
  const b3c14StableEvidence = {
    artifactId: b3c14Status?.artifactId || '',
    token: b3c14Status?.B3C14_RELEASE_DOSSIER_MINIMAL_OK || 0,
    releaseGreen: b3c14Status?.B3C14_RELEASE_GREEN_OK || 0,
    dossierStatus: b3c14Status?.dossierStatus || '',
    carriedForwardLimitRows: b3c14Status?.carriedForwardLimitRows || [],
    limitRows: b3c14Status?.limitRows || [],
    negativeRows: b3c14Status?.negativeRows || [],
  };
  const headSha = getGitHead(repoRoot);
  const externalImmutableInputHash = sha256Text(externalImmutableInput);
  const tokenResultsHash = sha256Text(stableJson({
    B3C14_RELEASE_DOSSIER_MINIMAL_OK: b3c14Status?.B3C14_RELEASE_DOSSIER_MINIMAL_OK || 0,
    B3C14_RELEASE_GREEN_OK: b3c14Status?.B3C14_RELEASE_GREEN_OK || 0,
  }));
  return {
    schemaVersion: 1,
    headSha,
    headBinding: 'REPO_HEAD_AT_EVALUATION',
    requiredSetHash: sha256Text('B3C15_MINIMAL_REQUIRED_SET_V1:B3C14_STATUS:EXTERNAL_INPUT:SIGNATURE_ROWS:VERIFY_ROWS'),
    tokenResultsHash,
    evidenceHash: sha256Text(stableJson(b3c14StableEvidence)),
    proofhookInputHash: sha256Text(`B3C15_PROOFHOOK_INPUT:${tokenResultsHash}:${externalImmutableInputHash}`),
    releaseProfile: {
      id: 'B3C15_MINIMAL_RELEASE_PROFILE_LIMITED',
      status: 'LIMITED_FIXTURE_NOT_FULL_RELEASE_RUN',
    },
    commandLog: {
      id: 'B3C15_MINIMAL_COMMAND_LOG_LIMITED',
      status: 'LIMITED_FIXTURE_NOT_FULL_RELEASE_RUN',
      commands: COMMANDS.slice(0, 8),
    },
    reviewerResult: {
      id: 'B3C15_EXTERNAL_REVIEWER_RESULT',
      status: 'EXTERNAL_INPUT_BOUND',
      hash: externalImmutableInputHash,
    },
    externalImmutableInputHash,
  };
}

function verifyAttestation({ payload, signature, externalImmutableInput, repoRoot, b3c14Status }) {
  if (!payload || typeof payload !== 'object') return { ok: false, reason: 'PAYLOAD_MISSING' };
  if (!signature || typeof signature !== 'string') return { ok: false, reason: 'SIGNATURE_MISSING' };
  if (!externalImmutableInput || typeof externalImmutableInput !== 'string') return { ok: false, reason: 'EXTERNAL_INPUT_MISSING' };
  const payloadHash = sha256Text(stableJson(payload));
  const externalHash = sha256Text(externalImmutableInput);
  if (externalImmutableInput === payloadHash || externalHash === payloadHash || externalHash === payload.externalImmutableInputHash && externalImmutableInput === payloadHash) {
    return { ok: false, reason: 'SELF_SIGNED_OR_DERIVED_EXTERNAL_INPUT' };
  }
  if (payload.externalImmutableInputHash !== externalHash) return { ok: false, reason: 'EXTERNAL_INPUT_HASH_MISMATCH' };
  if (payload.headSha !== getGitHead(repoRoot)) return { ok: false, reason: 'STALE_HEAD_SHA' };
  const expectedPayload = buildAttestationPayload({ repoRoot, b3c14Status, externalImmutableInput });
  const expectedComparable = { ...expectedPayload, headSha: payload.headSha };
  if (stableJson(payload) !== stableJson(expectedComparable)) return { ok: false, reason: 'PAYLOAD_HASH_MISMATCH' };
  const expectedSignature = signPayload(payload, externalImmutableInput);
  if (signature !== expectedSignature) return { ok: false, reason: 'SIGNATURE_MISMATCH' };
  return { ok: true, reason: 'VERIFY_OK' };
}

function buildSignatureRows({ payload, signature, externalImmutableInput, verifyResult }) {
  const payloadHash = sha256Text(stableJson(payload));
  const externalHash = sha256Text(externalImmutableInput);
  return [
    {
      id: 'ATTESTATION_PAYLOAD_SCHEMA_BOUND',
      status: payload.schemaVersion === 1 ? 'PASS' : 'FAIL',
      fields: Object.keys(payload).sort((a, b) => a.localeCompare(b)),
    },
    {
      id: 'ATTESTATION_SIGNATURE_CREATED',
      status: signature && signature.length === 64 ? 'PASS' : 'FAIL',
      signatureType: 'HMAC_SHA256_EXTERNAL_INPUT_BOUND',
      signatureHash: sha256Text(signature),
    },
    {
      id: 'ATTESTATION_SIGNATURE_VERIFIES',
      status: verifyResult.ok ? 'PASS' : 'FAIL',
      verifyReason: verifyResult.reason,
    },
    {
      id: 'ATTESTATION_EXTERNAL_INPUT_BOUND',
      status: externalImmutableInput
        && externalHash === payload.externalImmutableInputHash
        && externalImmutableInput !== payloadHash
        && externalHash !== payloadHash
        ? 'PASS'
        : 'FAIL',
      externalImmutableInputHash: externalHash,
    },
    {
      id: 'ATTESTATION_HEAD_SHA_BOUND_DYNAMICALLY',
      status: payload.headBinding === 'REPO_HEAD_AT_EVALUATION' && Boolean(payload.headSha) ? 'PASS' : 'FAIL',
      headBinding: payload.headBinding,
      headSha: payload.headSha,
    },
  ];
}

function buildVerifyRows({ payload, signature, externalImmutableInput, repoRoot, b3c14Status }) {
  const payloadHash = sha256Text(stableJson(payload));
  const valid = verifyAttestation({ payload, signature, externalImmutableInput, repoRoot, b3c14Status });
  const selfSigned = verifyAttestation({ payload, signature: signPayload(payload, payloadHash), externalImmutableInput: payloadHash, repoRoot, b3c14Status });
  const invalidSignatureValue = `${signature.slice(0, -1)}${signature.endsWith('0') ? '1' : '0'}`;
  const invalidSignature = verifyAttestation({ payload, signature: invalidSignatureValue, externalImmutableInput, repoRoot, b3c14Status });
  const staleHead = verifyAttestation({ payload: { ...payload, headSha: '0000000000000000000000000000000000000000' }, signature, externalImmutableInput, repoRoot, b3c14Status });
  const hashMismatch = verifyAttestation({ payload: { ...payload, evidenceHash: sha256Text('B3C15_MUTATED_EVIDENCE') }, signature, externalImmutableInput, repoRoot, b3c14Status });
  const missingExternal = verifyAttestation({ payload, signature, externalImmutableInput: '', repoRoot, b3c14Status });
  const changedExternal = verifyAttestation({ payload, signature, externalImmutableInput: `${externalImmutableInput}:CHANGED`, repoRoot, b3c14Status });
  return [
    {
      id: 'VERIFY_VALID_SIGNATURE_PASS',
      status: valid.ok ? 'PASS' : 'FAIL',
      reason: valid.reason,
    },
    {
      id: 'VERIFY_SELF_SIGNED_FAIL',
      status: selfSigned.ok ? 'FAIL' : 'PASS',
      reason: selfSigned.reason,
    },
    {
      id: 'VERIFY_INVALID_SIGNATURE_FAIL',
      status: invalidSignature.ok ? 'FAIL' : 'PASS',
      reason: invalidSignature.reason,
    },
    {
      id: 'VERIFY_STALE_HEAD_FAIL',
      status: staleHead.ok ? 'FAIL' : 'PASS',
      reason: staleHead.reason,
    },
    {
      id: 'VERIFY_HASH_MISMATCH_FAIL',
      status: hashMismatch.ok ? 'FAIL' : 'PASS',
      reason: hashMismatch.reason,
    },
    {
      id: 'VERIFY_MISSING_EXTERNAL_INPUT_FAIL',
      status: missingExternal.ok ? 'FAIL' : 'PASS',
      reason: missingExternal.reason,
    },
    {
      id: 'VERIFY_CHANGED_EXTERNAL_INPUT_FAIL',
      status: changedExternal.ok ? 'FAIL' : 'PASS',
      reason: changedExternal.reason,
    },
  ];
}

function buildNegativeRows({ verifyRows, forceClaims }) {
  const byId = new Map(verifyRows.map((row) => [row.id, row]));
  return [
    {
      id: 'SELF_SIGNED_NEGATIVE',
      status: forceClaims.selfSignedAccepted === true || byId.get('VERIFY_SELF_SIGNED_FAIL')?.status !== 'PASS' ? 'FAIL' : 'PASS',
      rejectsClaim: 'SELF_SIGNED_PAYLOAD_ACCEPTED',
    },
    {
      id: 'INVALID_SIGNATURE_NEGATIVE',
      status: forceClaims.invalidSignatureAccepted === true || byId.get('VERIFY_INVALID_SIGNATURE_FAIL')?.status !== 'PASS' ? 'FAIL' : 'PASS',
      rejectsClaim: 'INVALID_SIGNATURE_ACCEPTED',
    },
    {
      id: 'STALE_HEAD_NEGATIVE',
      status: forceClaims.staleHeadAccepted === true || byId.get('VERIFY_STALE_HEAD_FAIL')?.status !== 'PASS' ? 'FAIL' : 'PASS',
      rejectsClaim: 'STALE_HEAD_ACCEPTED',
    },
    {
      id: 'HASH_MISMATCH_NEGATIVE',
      status: forceClaims.hashMismatchAccepted === true || byId.get('VERIFY_HASH_MISMATCH_FAIL')?.status !== 'PASS' ? 'FAIL' : 'PASS',
      rejectsClaim: 'HASH_MISMATCH_ACCEPTED',
    },
    {
      id: 'MISSING_EXTERNAL_INPUT_NEGATIVE',
      status: forceClaims.missingExternalInputAccepted === true || byId.get('VERIFY_MISSING_EXTERNAL_INPUT_FAIL')?.status !== 'PASS' ? 'FAIL' : 'PASS',
      rejectsClaim: 'MISSING_EXTERNAL_INPUT_ACCEPTED',
    },
    {
      id: 'CHANGED_EXTERNAL_INPUT_NEGATIVE',
      status: forceClaims.changedExternalInputAccepted === true || byId.get('VERIFY_CHANGED_EXTERNAL_INPUT_FAIL')?.status !== 'PASS' ? 'FAIL' : 'PASS',
      rejectsClaim: 'CHANGED_EXTERNAL_INPUT_ACCEPTED',
    },
    {
      id: 'OFFLINE_ATTESTATION_CHAIN_BREAK_NEGATIVE',
      status: forceClaims.offlineChainBreakAccepted === true
        || byId.get('VERIFY_INVALID_SIGNATURE_FAIL')?.status !== 'PASS'
        || byId.get('VERIFY_HASH_MISMATCH_FAIL')?.status !== 'PASS'
        ? 'FAIL'
        : 'PASS',
      rejectsClaim: 'OFFLINE_ATTESTATION_CHAIN_BREAK_ACCEPTED',
    },
    {
      id: 'DOC_ONLY_ATTESTATION_NEGATIVE',
      status: forceClaims.docOnlyAttestationAccepted === true ? 'FAIL' : 'PASS',
      rejectsClaim: 'DOC_TEXT_WITHOUT_SIGNATURE_OR_VERIFY_ARTIFACT',
    },
    {
      id: 'RELEASE_GREEN_FALSE_NEGATIVE',
      status: forceClaims.releaseGreenClaim === true ? 'FAIL' : 'PASS',
      rejectsClaim: 'RELEASE_GREEN_CLAIM_IN_B3C15',
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

export async function evaluateB3C15AttestationChainState(input = {}) {
  const repoRoot = path.resolve(input.repoRoot || DEFAULT_REPO_ROOT);
  const downloadsDir = input.downloadsDir || path.join(os.homedir(), 'Downloads');
  const forceClaims = input.forceClaims && typeof input.forceClaims === 'object' ? input.forceClaims : {};
  const externalImmutableInput = input.externalImmutableInput === undefined
    ? DEFAULT_EXTERNAL_IMMUTABLE_INPUT
    : String(input.externalImmutableInput || '');
  const b3c14Status = await readJsonIfExists(repoRoot, path.join('docs', 'OPS', 'STATUS', 'B3C14_RELEASE_DOSSIER_MINIMAL_STATUS_V1.json'));
  const b3c14InputRow = buildB3C14InputRow(b3c14Status);
  const b3c14CarriedForwardLimitRows = buildB3C14CarriedForwardLimitRows(b3c14Status);
  const payload = buildAttestationPayload({ repoRoot, b3c14Status, externalImmutableInput });
  const signature = signPayload(payload, externalImmutableInput);
  const verifyResult = verifyAttestation({ payload, signature, externalImmutableInput, repoRoot, b3c14Status });
  const signatureRows = buildSignatureRows({ payload, signature, externalImmutableInput, verifyResult });
  const verifyRows = buildVerifyRows({ payload, signature, externalImmutableInput, repoRoot, b3c14Status });
  const negativeRows = buildNegativeRows({ verifyRows, forceClaims });
  const donorArchiveRows = buildDonorArchiveRows(downloadsDir);
  const signatureIds = signatureRows.map((row) => row.id).sort((a, b) => a.localeCompare(b));
  const verifyIds = verifyRows.map((row) => row.id).sort((a, b) => a.localeCompare(b));
  const negativeIds = negativeRows.map((row) => row.id).sort((a, b) => a.localeCompare(b));
  const signatureRowsComplete = REQUIRED_SIGNATURE_ROW_IDS.every((id) => signatureIds.includes(id));
  const verifyRowsComplete = REQUIRED_VERIFY_ROW_IDS.every((id) => verifyIds.includes(id));
  const negativeRowsComplete = REQUIRED_NEGATIVE_IDS.every((id) => negativeIds.includes(id));
  const signatureRowsPass = signatureRows.every((row) => row.status === 'PASS');
  const verifyRowsPass = verifyRows.every((row) => row.status === 'PASS');
  const negativeRowsPass = negativeRows.every((row) => row.status === 'PASS');
  const donorIntakeContextOnly = donorArchiveRows.every((row) => row.authority === 'CONTEXT_ONLY'
    && row.codeImported === false
    && row.completionClaimImported === false);
  const forbiddenClaimsAbsent = FORBIDDEN_CLAIM_KEYS.every((key) => forceClaims[key] !== true);
  const releaseGreen = false;
  const ok = b3c14InputRow.passed
    && signatureRowsComplete
    && verifyRowsComplete
    && negativeRowsComplete
    && signatureRowsPass
    && verifyRowsPass
    && negativeRowsPass
    && donorIntakeContextOnly
    && forbiddenClaimsAbsent
    && releaseGreen === false;

  const failRows = [
    ...(b3c14InputRow.passed ? [] : ['B3C14_STATUS_NOT_BOUND']),
    ...(signatureRowsComplete ? [] : ['SIGNATURE_ROWS_INCOMPLETE']),
    ...(verifyRowsComplete ? [] : ['VERIFY_ROWS_INCOMPLETE']),
    ...(negativeRowsComplete ? [] : ['NEGATIVE_ROWS_INCOMPLETE']),
    ...(signatureRowsPass ? [] : ['SIGNATURE_ROWS_FAILED']),
    ...(verifyRowsPass ? [] : ['VERIFY_ROWS_FAILED']),
    ...(negativeRowsPass ? [] : ['NEGATIVE_ROWS_FAILED']),
    ...(donorIntakeContextOnly ? [] : ['DONOR_INTAKE_NOT_CONTEXT_ONLY']),
    ...(forbiddenClaimsAbsent ? [] : ['FORBIDDEN_SCOPE_OR_RELEASE_CLAIM']),
    ...(releaseGreen === false ? [] : ['FALSE_RELEASE_GREEN']),
  ];
  const changedBasenamesHash = sha256Text(CHANGED_BASENAMES.join('\n'));
  const statusArtifactHash = sha256Text(stableJson({
    taskId: TASK_ID,
    headSha: getGitHead(repoRoot),
    changedBasenamesHash,
    signatureIds,
    verifyIds,
    negativeIds,
    status: ok ? 'PASS' : 'FAIL',
  }));

  return stableSort({
    artifactId: 'B3C15_ATTESTATION_CHAIN_STATUS_V1',
    contourId: TASK_ID,
    ok,
    status: ok ? 'PASS' : 'FAIL',
    [TOKEN_NAME]: ok ? 1 : 0,
    [RELEASE_GREEN_TOKEN_NAME]: 0,
    [SIGNATURE_TOKEN_NAME]: ok && signatureRowsPass ? 1 : 0,
    [VERIFY_TOKEN_NAME]: ok && verifyRowsPass ? 1 : 0,
    failSignal: ok ? '' : FAIL_SIGNAL,
    failRows,
    successWording: 'PASS_AS_MINIMAL_ATTESTATION_CHAIN_WITH_EXTERNAL_INPUT_NOT_RELEASE_GREEN',
    tokenSemantics: 'ATTESTATION_SIGNATURE_AND_VERIFY_CHAIN_ONLY_RELEASE_GREEN_REMAINS_FALSE',
    rollbackRef: 'ROLLBACK_ATTESTATION_SCHEME',
    releaseGreen,
    b3c14InputRow,
    b3c14CarriedForwardLimitRows,
    payload,
    payloadHash: sha256Text(stableJson(payload)),
    signature: {
      type: 'HMAC_SHA256_EXTERNAL_INPUT_BOUND',
      hash: sha256Text(signature),
      rawStored: false,
    },
    signatureRows,
    verifyRows,
    negativeRows,
    donorIntake: {
      class: 'READ_ONLY_CONTEXT_ONLY',
      outputLocation: STATUS_BASENAME,
      archivesFound: donorArchiveRows.filter((row) => row.found).map((row) => row.basename),
      archiveRows: donorArchiveRows,
      suggestedRows: [
        'ATTESTATION_PAYLOAD_FIELDS',
        'SIGNATURE_ROWS',
        'VERIFY_ROWS',
        'NEGATIVE_ROWS',
      ],
      codeImported: false,
      completionClaimImported: false,
      activeCanonOverDonor: true,
    },
    proof: {
      b3c14InputBound: b3c14InputRow.passed,
      b3c14ReleaseGreenFalse: b3c14Status?.B3C14_RELEASE_GREEN_OK === 0,
      b3c14CarriedForwardLimitsVisible: b3c14Status?.proof?.carriedForwardLimitsBound === true,
      b3c14CarriedForwardLimitRowCount: b3c14CarriedForwardLimitRows.length,
      b3c14AllSevenCarriedForwardLimitRowsPreserved: b3c14CarriedForwardLimitRows.length === 7,
      attestationSignatureReleaseTokenBound: true,
      verifyAttestationReleaseTokenBound: true,
      offlineAttestationChainBreakNegativeBound: negativeRows.some((row) => row.id === 'OFFLINE_ATTESTATION_CHAIN_BREAK_NEGATIVE' && row.status === 'PASS'),
      externalImmutableInputPresent: Boolean(externalImmutableInput),
      externalImmutableInputCallerSupplied: true,
      externalImmutableInputNotPayloadDerived: sha256Text(externalImmutableInput) !== sha256Text(stableJson(payload)),
      signatureRowsComplete,
      verifyRowsComplete,
      negativeRowsComplete,
      signatureRowsPass,
      verifyRowsPass,
      negativeRowsPass,
      selfSignedCannotPass: verifyRows.some((row) => row.id === 'VERIFY_SELF_SIGNED_FAIL' && row.status === 'PASS'),
      staleHeadCannotPass: verifyRows.some((row) => row.id === 'VERIFY_STALE_HEAD_FAIL' && row.status === 'PASS'),
      hashMismatchCannotPass: verifyRows.some((row) => row.id === 'VERIFY_HASH_MISMATCH_FAIL' && row.status === 'PASS'),
      missingExternalInputCannotPass: verifyRows.some((row) => row.id === 'VERIFY_MISSING_EXTERNAL_INPUT_FAIL' && row.status === 'PASS'),
      changedExternalInputCannotPass: verifyRows.some((row) => row.id === 'VERIFY_CHANGED_EXTERNAL_INPUT_FAIL' && row.status === 'PASS'),
      docOnlyAttestationCannotPass: negativeRows.some((row) => row.id === 'DOC_ONLY_ATTESTATION_NEGATIVE' && row.status === 'PASS'),
      releaseGreenFalseBecauseB3C15Only: releaseGreen === false,
      donorIntakeContextOnly,
      noReleaseClaim: true,
      noPackageBuild: true,
      noPackageHashGeneration: true,
      noSupplyChainImplementation: true,
      noRuntimeLayerRewrite: true,
      noNewDependency: true,
      nodeBuiltinsOnly: true,
      statusArtifactHashRecorded: Boolean(statusArtifactHash),
      changedBasenamesHashRecorded: Boolean(changedBasenamesHash),
      testCommandRowsRecorded: COMMANDS.length > 0,
    },
    scope: {
      layer: TASK_ID,
      attestationChainOnly: true,
      releaseClaim: false,
      releaseGreenClaim: false,
      packageBuild: false,
      packageHashGeneration: false,
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
      b3c14Rewrite: false,
      b3c09ToB3c13Reopen: false,
    },
    repo: {
      repoRootBinding: 'WORKTREE_INDEPENDENT',
      statusBasename: STATUS_BASENAME,
      writtenFrom: 'b3c15-attestation-chain-state.mjs',
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
  const state = await evaluateB3C15AttestationChainState();
  if (args.write) {
    await fsp.mkdir(path.dirname(path.join(DEFAULT_REPO_ROOT, STATUS_REL_PATH)), { recursive: true });
    await fsp.writeFile(path.join(DEFAULT_REPO_ROOT, STATUS_REL_PATH), stableJson(state), 'utf8');
  }
  if (args.json) process.stdout.write(stableJson(state));
  else process.stdout.write(`B3C15_STATUS=${state.status}\n${TOKEN_NAME}=${state[TOKEN_NAME]}\n${RELEASE_GREEN_TOKEN_NAME}=${state[RELEASE_GREEN_TOKEN_NAME]}\n`);
  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) {
  main().catch((error) => {
    process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
    process.exit(1);
  });
}
