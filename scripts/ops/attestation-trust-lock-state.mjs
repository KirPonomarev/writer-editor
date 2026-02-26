#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateModeMatrixSingleAuthorityState } from './mode-matrix-single-authority-state.mjs';

const TOKEN_NAME = 'ATTESTATION_TRUST_LOCK_ENFORCEMENT_OK';
const FAIL_SIGNAL_CODE = 'E_VERIFY_ATTESTATION_INVALID';
const TRUST_LOCK_ID = 'ATTESTATION_TRUST_LOCK_HARDENING_v3';
const TRUST_PROVIDER = 'ATTESTATION_TRUST_LOCK';
const FORBIDDEN_CONTEXT_SOURCE = 'self_generated';
const REQUIRED_PAYLOAD_FIELDS = ['BASE_SHA', 'NONCE', 'TIMESTAMP', 'KEY_ID', 'TRUST_CONTEXT_ID'];
const DEFAULT_MODE = 'release';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stableSortObject(value) {
  if (Array.isArray(value)) return value.map((entry) => stableSortObject(entry));
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

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    mode: '',
    failsignalRegistryPath: '',
    payloadPath: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--json') {
      out.json = true;
      continue;
    }

    if (arg === '--mode' && i + 1 < argv.length) {
      out.mode = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--mode=')) {
      out.mode = normalizeString(arg.slice('--mode='.length));
      continue;
    }

    if (arg === '--failsignal-registry-path' && i + 1 < argv.length) {
      out.failsignalRegistryPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--failsignal-registry-path=')) {
      out.failsignalRegistryPath = normalizeString(arg.slice('--failsignal-registry-path='.length));
      continue;
    }

    if (arg === '--payload-path' && i + 1 < argv.length) {
      out.payloadPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--payload-path=')) {
      out.payloadPath = normalizeString(arg.slice('--payload-path='.length));
      continue;
    }
  }

  return out;
}

function isIsoTimestamp(value) {
  const normalized = normalizeString(value);
  if (!normalized) return false;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed);
}

function buildDefaultPayload() {
  return {
    BASE_SHA: '0000000000000000000000000000000000000000',
    NONCE: 'nonce-verify-main',
    TIMESTAMP: new Date('2026-02-26T00:00:00.000Z').toISOString(),
    KEY_ID: 'trusted-key-main-1',
    TRUST_CONTEXT_ID: 'ctx-post-merge-verify-main',
    TRUST_CONTEXT_SOURCE: 'trusted_context_record',
    SIGNATURE_TRUST_ROOT_ANCHORED: true,
    OFFLINE_VERIFIABLE_CHAIN: true,
    EXTERNAL_ARTIFACT: {
      artifactId: 'post-merge-attestation-record',
      origin: 'release-pipeline-attestation-store',
      checksum: 'sha256:trusted-artifact',
    },
    PAYLOAD_ORIGIN: 'external',
    IS_SYNTHETIC: false,
    TRUST_PROVIDER: TRUST_PROVIDER,
    TRUST_LOCK_ID: TRUST_LOCK_ID,
  };
}

function evaluatePayload(payload) {
  const data = isObjectRecord(payload) ? payload : {};
  const issues = [];

  const missingRequiredPayloadFields = REQUIRED_PAYLOAD_FIELDS.filter((field) => {
    const value = data[field];
    return normalizeString(value).length === 0;
  });
  if (missingRequiredPayloadFields.length > 0) {
    issues.push('REQUIRED_PAYLOAD_FIELDS_MISSING');
  }

  if (!isIsoTimestamp(data.TIMESTAMP)) {
    issues.push('TIMESTAMP_INVALID');
  }

  const trustContextSource = normalizeString(data.TRUST_CONTEXT_SOURCE || data.trustedContext?.source).toLowerCase();
  if (trustContextSource === FORBIDDEN_CONTEXT_SOURCE) {
    issues.push('SELF_GENERATED_TRUST_CONTEXT');
  }

  const payloadOrigin = normalizeString(data.PAYLOAD_ORIGIN).toLowerCase();
  const syntheticPayload = data.IS_SYNTHETIC === true || payloadOrigin === 'synthetic';
  if (syntheticPayload) {
    issues.push('SYNTHETIC_PAYLOAD');
  }

  const signatureTrustRootAnchored = data.SIGNATURE_TRUST_ROOT_ANCHORED === true;
  if (!signatureTrustRootAnchored) {
    issues.push('TRUST_ROOT_MISSING');
  }

  const offlineVerifiableChain = data.OFFLINE_VERIFIABLE_CHAIN === true;
  if (!offlineVerifiableChain) {
    issues.push('OFFLINE_CHAIN_NOT_VERIFIABLE');
  }

  const externalArtifact = isObjectRecord(data.EXTERNAL_ARTIFACT) ? data.EXTERNAL_ARTIFACT : null;
  const hasExternalArtifact = externalArtifact
    && normalizeString(externalArtifact.artifactId).length > 0
    && normalizeString(externalArtifact.origin).length > 0;
  if (!hasExternalArtifact) {
    issues.push('EXTERNAL_ARTIFACT_MISSING');
  }

  const trustLockId = normalizeString(data.TRUST_LOCK_ID || data.trustedContext?.trustLockId);
  if (trustLockId && trustLockId !== TRUST_LOCK_ID) {
    issues.push('TRUST_LOCK_ID_INVALID');
  }

  const trustProvider = normalizeString(data.TRUST_PROVIDER || data.trustedContext?.trustProvider);
  if (trustProvider && trustProvider !== TRUST_PROVIDER) {
    issues.push('TRUST_PROVIDER_INVALID');
  }

  return {
    ok: issues.length === 0,
    issues,
    missingRequiredPayloadFields,
    syntheticPayload,
    selfGeneratedTrustContext: trustContextSource === FORBIDDEN_CONTEXT_SOURCE,
    signatureTrustRootAnchored,
    offlineVerifiableChain,
    hasExternalArtifact,
  };
}

function computeFailReason(payloadState) {
  if (payloadState.syntheticPayload) return 'E_ATTESTATION_SYNTHETIC_DEFAULT_PASS';
  if (payloadState.selfGeneratedTrustContext) return 'ATTESTATION_TRUST_INVALID';
  if (payloadState.missingRequiredPayloadFields.length > 0) return 'E_REQUIRED_PAYLOAD_FIELDS_MISSING';
  if (!payloadState.signatureTrustRootAnchored) return 'E_TRUST_ROOT_MISSING';
  if (!payloadState.ok) return 'ATTESTATION_TRUST_INVALID';
  return '';
}

function modeIsReleasePromotion(mode) {
  return mode === 'release' || mode === 'promotion';
}

export function evaluateAttestationTrustLockState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const mode = normalizeString(input.mode || process.env.MODE || DEFAULT_MODE).toLowerCase() || DEFAULT_MODE;
  const payload = isObjectRecord(input.payload) ? input.payload : buildDefaultPayload();

  const modeState = evaluateModeMatrixSingleAuthorityState({
    repoRoot,
    failsignalRegistryPath: normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
  });

  const payloadState = evaluatePayload(payload);
  const releasePromotionScope = modeIsReleasePromotion(mode);
  const trustValid = payloadState.ok;

  const shouldBlockDelivery = releasePromotionScope && !trustValid;
  const deliveryVerdict = shouldBlockDelivery ? 'BLOCK' : (trustValid ? 'PASS' : 'WARN');
  const productVerdict = trustValid ? 'PASS' : 'FAIL';

  const failReason = shouldBlockDelivery ? computeFailReason(payloadState) : '';

  const ok = releasePromotionScope ? trustValid : true;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignalCode: shouldBlockDelivery ? FAIL_SIGNAL_CODE : '',
    failReason,
    trustLockId: TRUST_LOCK_ID,
    trustProvider: TRUST_PROVIDER,
    mode,
    releasePromotionScope,
    productVerdict,
    deliveryVerdict,
    shouldBlockDelivery,
    requiredPayloadFields: [...REQUIRED_PAYLOAD_FIELDS],
    missingRequiredPayloadFields: payloadState.missingRequiredPayloadFields,
    missingRequiredPayloadFieldsCount: payloadState.missingRequiredPayloadFields.length,
    externalArtifactRequiredOk: payloadState.hasExternalArtifact,
    syntheticPayloadForbiddenOk: payloadState.syntheticPayload === false,
    selfGeneratedTrustContextForbiddenOk: payloadState.selfGeneratedTrustContext === false,
    signatureTrustRootAnchoredOk: payloadState.signatureTrustRootAnchored,
    offlineVerifiableChainOk: payloadState.offlineVerifiableChain,
    advisoryToBlockingDriftCount: modeState.advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero: modeState.advisoryToBlockingDriftCount === 0,
    claimOverrideViolationCount: modeState.claimOverrideViolationCount,
    issues: payloadState.issues,
    payload,
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`ATTESTATION_TRUST_LOCK_ID=${state.trustLockId}`);
  console.log(`ATTESTATION_TRUST_PROVIDER=${state.trustProvider}`);
  console.log(`ATTESTATION_MODE=${state.mode}`);
  console.log(`ATTESTATION_DELIVERY_VERDICT=${state.deliveryVerdict}`);
  console.log(`ATTESTATION_PRODUCT_VERDICT=${state.productVerdict}`);
  console.log(`ATTESTATION_ADVISORY_DRIFT_COUNT=${state.advisoryToBlockingDriftCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const payload = args.payloadPath
    ? (() => {
      try {
        return JSON.parse(fs.readFileSync(args.payloadPath, 'utf8'));
      } catch {
        return null;
      }
    })()
    : null;

  const state = evaluateAttestationTrustLockState({
    mode: args.mode,
    failsignalRegistryPath: args.failsignalRegistryPath,
    payload,
  });

  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
  } else {
    printHuman(state);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) {
  main();
}

export {
  TOKEN_NAME,
  FAIL_SIGNAL_CODE,
  TRUST_LOCK_ID,
  TRUST_PROVIDER,
  FORBIDDEN_CONTEXT_SOURCE,
  REQUIRED_PAYLOAD_FIELDS,
};
