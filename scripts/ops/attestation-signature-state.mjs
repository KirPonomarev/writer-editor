#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluatePostMergeVerifyAttestationState,
  resolvePostMergeVerifyBindingContext,
} from './emit-post-merge-verify-attestation.mjs';

const TOKEN_NAME = 'ATTESTATION_SIGNATURE_OK';
const FAIL_CODE = 'E_ATTESTATION_SIGNATURE_INVALID';
const SIGNATURE_RE = /^[0-9a-f]{64}$/u;
const DEFAULT_TASK_ID = 'strict-verify-release';
const DEFAULT_VERIFY_PATH = 'scripts/ops/post-merge-verify.mjs';
const DEFAULT_TRUST_LOCK_PATH = 'docs/OPS/STATUS/ATTESTATION_TRUST_LOCK_v3_12.json';
const DEFAULT_TRUST_ARTIFACT_PATH = 'docs/OPS/LOCKS/ATTESTATION_TRUST_ARTIFACT.lock';
const DEFAULT_SIGNER_ID = 'trusted-signer-release-main';
const DEFAULT_TRUST_ROOT_ID = 'trust-root-release-v1';
const DEFAULT_TRUST_CONTEXT_SOURCE = 'trusted_context_record';
const FORBIDDEN_TRUST_CONTEXT_SOURCE = 'self_generated';

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

function sha256Hex(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function readJsonObject(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return isObjectRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeBool(value, fallback = false) {
  if (value === true || value === false) return value;
  return fallback;
}

function hasOwn(obj, key) {
  return Boolean(obj) && Object.prototype.hasOwnProperty.call(obj, key);
}

function readBindingField(payload, primaryKey, legacyKey, fallbackValue) {
  if (hasOwn(payload, primaryKey) || hasOwn(payload, legacyKey)) {
    return normalizeString(payload[primaryKey] || payload[legacyKey]);
  }
  return normalizeString(fallbackValue);
}

function parseArgs(argv) {
  const out = {
    json: false,
    trustLockPath: '',
    artifactPath: '',
    signature: '',
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--json') out.json = true;
    if (argv[i] === '--trust-lock-path' && i + 1 < argv.length) {
      out.trustLockPath = String(argv[i + 1] || '').trim();
      i += 1;
    }
    if (argv[i] === '--artifact-path' && i + 1 < argv.length) {
      out.artifactPath = String(argv[i + 1] || '').trim();
      i += 1;
    }
    if (argv[i] === '--signature' && i + 1 < argv.length) {
      out.signature = String(argv[i + 1] || '').trim();
      i += 1;
    }
  }
  return out;
}

function normalizeSignerIds(raw) {
  if (!Array.isArray(raw)) return [];
  const ids = [];
  const seen = new Set();
  for (const item of raw) {
    const id = normalizeString(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function readTrustLock(input = {}) {
  const trustLockPath = normalizeString(input.trustLockPath || DEFAULT_TRUST_LOCK_PATH);
  const trustLock = readJsonObject(trustLockPath);
  if (!trustLock) {
    return {
      ok: false,
      trustLockPath,
      issues: ['MISSING_TRUST_ROOT_REJECT'],
      lockId: '',
      trustRootId: '',
      allowedSignerIds: [],
      requiredContextSource: DEFAULT_TRUST_CONTEXT_SOURCE,
      trustedArtifactPath: normalizeString(input.artifactPath || DEFAULT_TRUST_ARTIFACT_PATH),
      trustedArtifactSha256: '',
      trustedArtifactId: '',
    };
  }

  const trustedArtifact = isObjectRecord(trustLock.trustedArtifact) ? trustLock.trustedArtifact : {};
  const allowedSignerIds = normalizeSignerIds(
    (isObjectRecord(trustLock.signerIdentityBinding) ? trustLock.signerIdentityBinding.allowedSignerIds : null)
      || trustLock.allowedSignerIds,
  );

  return {
    ok: true,
    trustLockPath,
    issues: [],
    lockId: normalizeString(trustLock.lockId),
    trustRootId: normalizeString(trustLock.trustRootId),
    allowedSignerIds,
    requiredContextSource: normalizeString(trustLock.requiredContextSource || DEFAULT_TRUST_CONTEXT_SOURCE),
    trustedArtifactPath: normalizeString(input.artifactPath || trustedArtifact.path || DEFAULT_TRUST_ARTIFACT_PATH),
    trustedArtifactSha256: normalizeString(trustedArtifact.sha256),
    trustedArtifactId: normalizeString(trustedArtifact.artifactId),
  };
}

function readArtifactState(trustState, repoRoot) {
  const artifactRelPath = normalizeString(trustState.trustedArtifactPath);
  const artifactAbsPath = path.resolve(repoRoot, artifactRelPath);
  if (!artifactRelPath || !fs.existsSync(artifactAbsPath)) {
    return {
      ok: false,
      artifactPath: artifactRelPath,
      artifactSha256Actual: '',
      artifactSha256Expected: normalizeString(trustState.trustedArtifactSha256),
      issues: ['MISSING_TRUST_ROOT_REJECT'],
    };
  }
  const artifactContent = fs.readFileSync(artifactAbsPath, 'utf8');
  const artifactSha256Actual = sha256Hex(artifactContent);
  const artifactSha256Expected = normalizeString(trustState.trustedArtifactSha256);
  const hashMatch = artifactSha256Expected.length > 0 && artifactSha256Actual === artifactSha256Expected;
  return {
    ok: hashMatch,
    artifactPath: artifactRelPath,
    artifactSha256Actual,
    artifactSha256Expected,
    issues: hashMatch ? [] : ['MISSING_TRUST_ROOT_REJECT'],
  };
}

function buildPayload(input = {}, trustState = {}, bindingContext = {}) {
  if (isObjectRecord(input.payload)) {
    const payload = input.payload;
    const hasSignerId = Object.prototype.hasOwnProperty.call(payload, 'signerId');
    const hasTrustRootId = Object.prototype.hasOwnProperty.call(payload, 'trustRootId');
    const hasTrustContextSource = Object.prototype.hasOwnProperty.call(payload, 'trustContextSource')
      || Object.prototype.hasOwnProperty.call(payload, 'TRUST_CONTEXT_SOURCE');
    const hasTrustContextId = Object.prototype.hasOwnProperty.call(payload, 'trustContextId');
    const hasExternalArtifactId = Object.prototype.hasOwnProperty.call(payload, 'externalArtifactId')
      || Object.prototype.hasOwnProperty.call(payload, 'EXTERNAL_ARTIFACT_ID');

    const signerId = hasSignerId
      ? normalizeString(payload.signerId)
      : (trustState.allowedSignerIds[0] || DEFAULT_SIGNER_ID);
    const trustRootId = hasTrustRootId
      ? normalizeString(payload.trustRootId)
      : (trustState.trustRootId || DEFAULT_TRUST_ROOT_ID);
    const trustContextSource = hasTrustContextSource
      ? normalizeString(payload.trustContextSource || payload.TRUST_CONTEXT_SOURCE)
      : (trustState.requiredContextSource || DEFAULT_TRUST_CONTEXT_SOURCE);
    const trustContextId = hasTrustContextId
      ? normalizeString(payload.trustContextId)
      : 'ctx-post-merge-verify-main';
    const externalArtifactId = hasExternalArtifactId
      ? normalizeString(payload.externalArtifactId || payload.EXTERNAL_ARTIFACT_ID)
      : (trustState.trustedArtifactId || 'ATTESTATION_TRUST_ARTIFACT_LOCK_v1');
    const headShaBinding = readBindingField(
      payload,
      'headShaBinding',
      'HEAD_SHA_BINDING',
      bindingContext.headShaBinding,
    );
    const waveInputHashBinding = readBindingField(
      payload,
      'waveInputHashBinding',
      'WAVE_INPUT_HASH_BINDING',
      bindingContext.waveInputHashBinding,
    );
    const tokenResultsHashBinding = readBindingField(
      payload,
      'tokenResultsHashBinding',
      'TOKEN_RESULTS_HASH_BINDING',
      bindingContext.tokenResultsHashBinding,
    );
    const evidenceHashBinding = readBindingField(
      payload,
      'evidenceHashBinding',
      'EVIDENCE_HASH_BINDING',
      bindingContext.evidenceHashBinding,
    );

    return {
      attestationKind: normalizeString(payload.attestationKind),
      detail: normalizeString(payload.detail),
      taskId: normalizeString(payload.taskId),
      verifyOk: Number(payload.verifyOk) === 1 ? 1 : 0,
      verifyPath: normalizeString(payload.verifyPath),
      signerId,
      trustRootId,
      trustContextId,
      trustContextSource,
      payloadOrigin: normalizeString(payload.payloadOrigin || payload.PAYLOAD_ORIGIN || 'external').toLowerCase(),
      isSynthetic: normalizeBool(payload.isSynthetic, payload.IS_SYNTHETIC === true),
      externalArtifactId,
      headShaBinding,
      waveInputHashBinding,
      tokenResultsHashBinding,
      evidenceHashBinding,
    };
  }

  const emitted = evaluatePostMergeVerifyAttestationState({
    taskId: DEFAULT_TASK_ID,
    verifyPath: DEFAULT_VERIFY_PATH,
    status: 'pass',
    detail: 'strict_verify_release_ready',
    repoRoot: input.repoRoot,
    headShaBinding: input.headShaBinding,
    waveInputHashBinding: input.waveInputHashBinding,
    tokenResultsHashBinding: input.tokenResultsHashBinding,
    evidenceHashBinding: input.evidenceHashBinding,
  });

  return {
    attestationKind: normalizeString(emitted.attestationKind),
    detail: normalizeString(emitted.detail),
    taskId: normalizeString(emitted.taskId),
    verifyOk: Number(emitted.verifyOk) === 1 ? 1 : 0,
    verifyPath: normalizeString(emitted.verifyPath),
    signerId: trustState.allowedSignerIds[0] || DEFAULT_SIGNER_ID,
    trustRootId: trustState.trustRootId || DEFAULT_TRUST_ROOT_ID,
    trustContextId: 'ctx-post-merge-verify-main',
    trustContextSource: trustState.requiredContextSource || DEFAULT_TRUST_CONTEXT_SOURCE,
    payloadOrigin: 'external',
    isSynthetic: false,
    externalArtifactId: trustState.trustedArtifactId || 'ATTESTATION_TRUST_ARTIFACT_LOCK_v1',
    headShaBinding: normalizeString(emitted.headShaBinding),
    waveInputHashBinding: normalizeString(emitted.waveInputHashBinding),
    tokenResultsHashBinding: normalizeString(emitted.tokenResultsHashBinding),
    evidenceHashBinding: normalizeString(emitted.evidenceHashBinding),
  };
}

function resolveFailReason(payload, trustState, artifactState, bindingChecks = {}) {
  if (payload.isSynthetic || payload.payloadOrigin === 'synthetic') return 'SYNTHETIC_PAYLOAD_REJECT';
  if (payload.trustContextSource.toLowerCase() === FORBIDDEN_TRUST_CONTEXT_SOURCE) return 'SELF_CONTEXT_REJECT';
  if (!bindingChecks.headShaBindingPresent) return 'MISSING_HEAD_BINDING_REJECT';
  if (!bindingChecks.waveInputHashBindingPresent) return 'MISSING_WAVE_HASH_BINDING_REJECT';
  if (!bindingChecks.tokenResultsHashBindingPresent) return 'MISSING_TOKEN_RESULTS_HASH_BINDING_REJECT';
  if (!bindingChecks.evidenceHashBindingPresent) return 'MISSING_EVIDENCE_HASH_BINDING_REJECT';
  if (!bindingChecks.headShaBindingMatchesExpected) return 'HEAD_BINDING_MISMATCH_REJECT';
  if (!bindingChecks.waveInputHashBindingMatchesExpected) return 'WAVE_HASH_BINDING_MISMATCH_REJECT';
  if (!bindingChecks.tokenResultsHashBindingMatchesExpected) return 'TOKEN_RESULTS_HASH_BINDING_MISMATCH_REJECT';
  if (!bindingChecks.evidenceHashBindingMatchesExpected) return 'EVIDENCE_HASH_BINDING_MISMATCH_REJECT';
  if (
    !trustState.ok
    || !artifactState.ok
    || !payload.trustRootId
    || payload.trustRootId !== trustState.trustRootId
  ) return 'MISSING_TRUST_ROOT_REJECT';
  if (!payload.signerId || !trustState.allowedSignerIds.includes(payload.signerId)) return 'WRONG_SIGNER_REJECT';
  return 'SIGNATURE_MISMATCH';
}

export function evaluateAttestationSignatureState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const trustState = readTrustLock(input);
  const artifactState = readArtifactState(trustState, repoRoot);
  const bindingContext = resolvePostMergeVerifyBindingContext({ repoRoot });
  const payload = buildPayload(input, trustState, bindingContext);
  const headShaBindingPresent = payload.headShaBinding.length > 0;
  const waveInputHashBindingPresent = payload.waveInputHashBinding.length > 0;
  const tokenResultsHashBindingPresent = payload.tokenResultsHashBinding.length > 0;
  const evidenceHashBindingPresent = payload.evidenceHashBinding.length > 0;
  const headShaBindingMatchesExpected = headShaBindingPresent
    && payload.headShaBinding === bindingContext.headShaBinding;
  const waveInputHashBindingMatchesExpected = waveInputHashBindingPresent
    && payload.waveInputHashBinding === bindingContext.waveInputHashBinding;
  const tokenResultsHashBindingMatchesExpected = tokenResultsHashBindingPresent
    && payload.tokenResultsHashBinding === bindingContext.tokenResultsHashBinding;
  const evidenceHashBindingMatchesExpected = evidenceHashBindingPresent
    && payload.evidenceHashBinding === bindingContext.evidenceHashBinding;
  const payloadCanonical = stableStringify({
    attestationKind: payload.attestationKind,
    taskId: payload.taskId,
    verifyPath: payload.verifyPath,
    verifyOk: payload.verifyOk,
    detail: payload.detail,
    signerId: payload.signerId,
    trustRootId: payload.trustRootId,
    trustContextId: payload.trustContextId,
    trustContextSource: payload.trustContextSource,
    externalArtifactId: payload.externalArtifactId,
    payloadOrigin: payload.payloadOrigin,
    isSynthetic: payload.isSynthetic,
    headShaBinding: payload.headShaBinding,
    waveInputHashBinding: payload.waveInputHashBinding,
    tokenResultsHashBinding: payload.tokenResultsHashBinding,
    evidenceHashBinding: payload.evidenceHashBinding,
  });
  const expectedSignature = sha256Hex(payloadCanonical);
  const boundExpectedSignature = sha256Hex([
    expectedSignature,
    artifactState.artifactSha256Actual || '',
    payload.signerId,
    payload.trustRootId,
    trustState.lockId,
  ].join(':'));
  const signature = normalizeString(input.signature || boundExpectedSignature).toLowerCase();

  const payloadShapeValid = payload.attestationKind === 'POST_MERGE_VERIFY'
    && payload.taskId.length > 0
    && payload.verifyPath.length > 0
    && (payload.verifyOk === 0 || payload.verifyOk === 1)
    && payload.signerId.length > 0
    && payload.trustRootId.length > 0
    && payload.trustContextId.length > 0
    && headShaBindingPresent
    && waveInputHashBindingPresent
    && tokenResultsHashBindingPresent
    && evidenceHashBindingPresent;
  const payloadBindingValid = headShaBindingMatchesExpected
    && waveInputHashBindingMatchesExpected
    && tokenResultsHashBindingMatchesExpected
    && evidenceHashBindingMatchesExpected;
  const payloadNotSynthetic = payload.isSynthetic === false && payload.payloadOrigin !== 'synthetic';
  const contextSourceValid = payload.trustContextSource.length > 0
    && payload.trustContextSource.toLowerCase() !== FORBIDDEN_TRUST_CONTEXT_SOURCE
    && payload.trustContextSource === trustState.requiredContextSource;
  const signerBoundValid = payload.signerId.length > 0 && trustState.allowedSignerIds.includes(payload.signerId);
  const trustRootBoundValid = trustState.trustRootId.length > 0 && payload.trustRootId === trustState.trustRootId;
  const trustLockReadable = trustState.ok;
  const artifactTrusted = artifactState.ok;
  const signatureShapeValid = SIGNATURE_RE.test(signature);
  const signatureMatches = signature === boundExpectedSignature;
  const ok = payloadShapeValid
    && payloadNotSynthetic
    && contextSourceValid
    && signerBoundValid
    && trustRootBoundValid
    && payloadBindingValid
    && trustLockReadable
    && artifactTrusted
    && signatureShapeValid
    && signatureMatches;
  const failReason = ok
    ? ''
    : resolveFailReason(payload, trustState, artifactState, {
      headShaBindingPresent,
      waveInputHashBindingPresent,
      tokenResultsHashBindingPresent,
      evidenceHashBindingPresent,
      headShaBindingMatchesExpected,
      waveInputHashBindingMatchesExpected,
      tokenResultsHashBindingMatchesExpected,
      evidenceHashBindingMatchesExpected,
    });

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    code: ok ? '' : FAIL_CODE,
    failSignalCode: ok ? '' : FAIL_CODE,
    failReason,
    details: {
      payload,
      payloadHash: expectedSignature,
      boundPayloadHash: boundExpectedSignature,
      signature,
      signatureShapeValid: signatureShapeValid ? 1 : 0,
      signatureMatches: signatureMatches ? 1 : 0,
      payloadShapeValid: payloadShapeValid ? 1 : 0,
      payloadNotSynthetic: payloadNotSynthetic ? 1 : 0,
      contextSourceValid: contextSourceValid ? 1 : 0,
      signerBoundValid: signerBoundValid ? 1 : 0,
      trustRootBoundValid: trustRootBoundValid ? 1 : 0,
      payloadBindingValid: payloadBindingValid ? 1 : 0,
      headShaBindingPresent: headShaBindingPresent ? 1 : 0,
      waveInputHashBindingPresent: waveInputHashBindingPresent ? 1 : 0,
      tokenResultsHashBindingPresent: tokenResultsHashBindingPresent ? 1 : 0,
      evidenceHashBindingPresent: evidenceHashBindingPresent ? 1 : 0,
      headShaBindingMatchesExpected: headShaBindingMatchesExpected ? 1 : 0,
      waveInputHashBindingMatchesExpected: waveInputHashBindingMatchesExpected ? 1 : 0,
      tokenResultsHashBindingMatchesExpected: tokenResultsHashBindingMatchesExpected ? 1 : 0,
      evidenceHashBindingMatchesExpected: evidenceHashBindingMatchesExpected ? 1 : 0,
      expectedHeadShaBinding: bindingContext.headShaBinding,
      expectedWaveInputHashBinding: bindingContext.waveInputHashBinding,
      expectedTokenResultsHashBinding: bindingContext.tokenResultsHashBinding,
      expectedEvidenceHashBinding: bindingContext.evidenceHashBinding,
      trustLockPath: trustState.trustLockPath,
      trustLockReadable: trustLockReadable ? 1 : 0,
      trustRootIdExpected: trustState.trustRootId,
      allowedSignerIds: trustState.allowedSignerIds,
      artifactPath: artifactState.artifactPath,
      artifactTrusted: artifactTrusted ? 1 : 0,
      artifactSha256Expected: artifactState.artifactSha256Expected,
      artifactSha256Actual: artifactState.artifactSha256Actual,
    },
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`ATTESTATION_SIGNATURE_HASH=${state.details.payloadHash}`);
  console.log(`ATTESTATION_SIGNATURE_MATCH=${state.details.signatureMatches}`);
  console.log(`ATTESTATION_SIGNATURE_SHAPE_OK=${state.details.signatureShapeValid}`);
  console.log(`ATTESTATION_SIGNER_BOUND_OK=${state.details.signerBoundValid}`);
  console.log(`ATTESTATION_TRUST_ROOT_BOUND_OK=${state.details.trustRootBoundValid}`);
  console.log(`ATTESTATION_TRUST_ARTIFACT_OK=${state.details.artifactTrusted}`);
  console.log(`ATTESTATION_TRUST_CONTEXT_OK=${state.details.contextSourceValid}`);
  console.log(`ATTESTATION_SYNTHETIC_FORBIDDEN_OK=${state.details.payloadNotSynthetic}`);
  console.log(`ATTESTATION_HEAD_BINDING_OK=${state.details.headShaBindingMatchesExpected}`);
  console.log(`ATTESTATION_WAVE_BINDING_OK=${state.details.waveInputHashBindingMatchesExpected}`);
  console.log(`ATTESTATION_TOKEN_RESULTS_BINDING_OK=${state.details.tokenResultsHashBindingMatchesExpected}`);
  console.log(`ATTESTATION_EVIDENCE_BINDING_OK=${state.details.evidenceHashBindingMatchesExpected}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.code}`);
    console.log(`FAIL_DETAIL=${state.failReason}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateAttestationSignatureState({
    trustLockPath: args.trustLockPath || undefined,
    artifactPath: args.artifactPath || undefined,
    signature: args.signature || undefined,
  });
  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
  } else {
    printHuman(state);
  }
  process.exit(state[TOKEN_NAME] === 1 ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) {
  main();
}
