#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  evaluateAttestationTrustLockState,
  FAIL_SIGNAL_CODE,
  TRUST_LOCK_ID,
  TRUST_PROVIDER,
  FORBIDDEN_CONTEXT_SOURCE,
  REQUIRED_PAYLOAD_FIELDS,
} from './attestation-trust-lock-state.mjs';
import { evaluateModeMatrixSingleAuthorityState } from './mode-matrix-single-authority-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P0_CONTOUR/TICKET_04';
const DEFAULT_MODE = 'release';

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

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${stableStringify(value)}\n`, 'utf8');
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    outputDir: DEFAULT_OUTPUT_DIR,
    runId: '',
    ticketId: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--output-dir' && i + 1 < argv.length) {
      out.outputDir = normalizeString(argv[i + 1]) || DEFAULT_OUTPUT_DIR;
      i += 1;
      continue;
    }
    if (arg.startsWith('--output-dir=')) {
      out.outputDir = normalizeString(arg.slice('--output-dir='.length)) || DEFAULT_OUTPUT_DIR;
      continue;
    }

    if (arg === '--run-id' && i + 1 < argv.length) {
      out.runId = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--run-id=')) {
      out.runId = normalizeString(arg.slice('--run-id='.length));
      continue;
    }

    if (arg === '--ticket-id' && i + 1 < argv.length) {
      out.ticketId = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--ticket-id=')) {
      out.ticketId = normalizeString(arg.slice('--ticket-id='.length));
      continue;
    }
  }

  return out;
}

function runNode(scriptPath, args = [], cwd = process.cwd()) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: 'utf8',
  });
}

function buildPositivePayload() {
  return {
    BASE_SHA: '54e4d5d416729b53a47371e6b660e7c88f7087ce',
    NONCE: 'nonce-p0-04-positive',
    TIMESTAMP: '2026-02-26T00:00:00.000Z',
    KEY_ID: 'trusted-key-main-1',
    TRUST_CONTEXT_ID: 'ctx-release-attestation-v3',
    TRUST_CONTEXT_SOURCE: 'trusted_context_record',
    SIGNATURE_TRUST_ROOT_ANCHORED: true,
    OFFLINE_VERIFIABLE_CHAIN: true,
    EXTERNAL_ARTIFACT: {
      artifactId: 'artifact-release-attestation-v3',
      origin: 'release-pipeline-attestation-store',
      checksum: 'sha256:artifact-release-attestation-v3',
    },
    PAYLOAD_ORIGIN: 'external',
    IS_SYNTHETIC: false,
    TRUST_PROVIDER,
    TRUST_LOCK_ID: TRUST_LOCK_ID,
  };
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function runReleasePromotionExitNonZeroProof(repoRoot) {
  const scriptPath = path.resolve(repoRoot, 'scripts/ops/attestation-trust-lock-state.mjs');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p0-04-cli-negative-'));
  const negativePayloadPath = path.join(tmpDir, 'attestation-negative-payload.json');
  const negativePayload = buildPositivePayload();
  negativePayload.PAYLOAD_ORIGIN = 'synthetic';
  negativePayload.IS_SYNTHETIC = true;
  fs.writeFileSync(negativePayloadPath, `${JSON.stringify(negativePayload, null, 2)}\n`, 'utf8');

  try {
    const releaseRun = runNode(scriptPath, ['--mode', 'release', '--payload-path', negativePayloadPath], repoRoot);
    const promotionRun = runNode(scriptPath, ['--mode', 'promotion', '--payload-path', negativePayloadPath], repoRoot);
    return {
      ok: releaseRun.status !== 0 && promotionRun.status !== 0,
      releaseExitCode: Number.isInteger(releaseRun.status) ? releaseRun.status : 1,
      promotionExitCode: Number.isInteger(promotionRun.status) ? promotionRun.status : 1,
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function runRepeatablePass3() {
  const runs = [];
  const payload = buildPositivePayload();

  for (let i = 0; i < 3; i += 1) {
    const state = evaluateAttestationTrustLockState({ mode: 'release', payload });
    runs.push({
      run: i + 1,
      ok: state.ok,
      token: state.ATTESTATION_TRUST_LOCK_ENFORCEMENT_OK,
      failReason: state.failReason,
      deliveryVerdict: state.deliveryVerdict,
      productVerdict: state.productVerdict,
      advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    });
  }

  const shapeOf = (entry) => JSON.stringify({
    ok: entry.ok,
    token: entry.token,
    failReason: entry.failReason,
    deliveryVerdict: entry.deliveryVerdict,
    productVerdict: entry.productVerdict,
    advisoryToBlockingDriftCount: entry.advisoryToBlockingDriftCount,
  });

  const baseline = shapeOf(runs[0]);
  const identical = runs.every((entry) => shapeOf(entry) === baseline);
  return {
    ok: identical && runs.every((entry) => entry.ok === true && entry.advisoryToBlockingDriftCount === 0),
    identical,
    runs,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const outputDir = path.resolve(repoRoot, args.outputDir);

  const modeState = evaluateModeMatrixSingleAuthorityState({ repoRoot });

  const positivePayload = buildPositivePayload();
  const positiveState = evaluateAttestationTrustLockState({ mode: 'release', payload: positivePayload });

  const syntheticNegativePayload = clone(positivePayload);
  syntheticNegativePayload.PAYLOAD_ORIGIN = 'synthetic';
  syntheticNegativePayload.IS_SYNTHETIC = true;
  const syntheticNegativeState = evaluateAttestationTrustLockState({ mode: 'release', payload: syntheticNegativePayload });

  const selfGeneratedPayload = clone(positivePayload);
  selfGeneratedPayload.TRUST_CONTEXT_SOURCE = FORBIDDEN_CONTEXT_SOURCE;
  const selfGeneratedState = evaluateAttestationTrustLockState({ mode: 'release', payload: selfGeneratedPayload });

  const trustRootMissingPayload = clone(positivePayload);
  trustRootMissingPayload.SIGNATURE_TRUST_ROOT_ANCHORED = false;
  const trustRootMissingState = evaluateAttestationTrustLockState({ mode: 'release', payload: trustRootMissingPayload });

  const requiredFieldsMissingPayload = clone(positivePayload);
  delete requiredFieldsMissingPayload.TRUST_CONTEXT_ID;
  delete requiredFieldsMissingPayload.NONCE;
  const requiredFieldsMissingState = evaluateAttestationTrustLockState({ mode: 'release', payload: requiredFieldsMissingPayload });

  const prScopedState = evaluateAttestationTrustLockState({ mode: 'pr', payload: syntheticNegativePayload });

  const releaseExitProof = runReleasePromotionExitNonZeroProof(repoRoot);
  const repeatable = runRepeatablePass3();

  const gateExternalArtifact = positiveState.ok === true
    && positiveState.externalArtifactRequiredOk === true;
  const gateSyntheticForbidden = syntheticNegativeState.ok === false
    && syntheticNegativeState.failReason === 'E_ATTESTATION_SYNTHETIC_DEFAULT_PASS'
    && syntheticNegativeState.failSignalCode === FAIL_SIGNAL_CODE;
  const gateSignatureTrustRoot = trustRootMissingState.ok === false
    && trustRootMissingState.failReason === 'E_TRUST_ROOT_MISSING';
  const gateRequiredPayloadFields = requiredFieldsMissingState.ok === false
    && requiredFieldsMissingState.failReason === 'E_REQUIRED_PAYLOAD_FIELDS_MISSING'
    && requiredFieldsMissingState.missingRequiredPayloadFieldsCount >= 1;
  const gateSelfGeneratedContext = selfGeneratedState.ok === false
    && selfGeneratedState.failReason === 'ATTESTATION_TRUST_INVALID';
  const gateOfflineChain = positiveState.offlineVerifiableChainOk === true;
  const gateScopeReleasePromotionOnly = prScopedState.ok === true
    && prScopedState.deliveryVerdict === 'WARN'
    && prScopedState.productVerdict === 'FAIL';
  const gateReleasePromotionNonZero = releaseExitProof.ok === true;

  const gates = {
    mc_phase_switch_valid: modeState.gates.mc_phase_switch_valid,
    mc_blocking_evaluator_single_authority: modeState.gates.mc_blocking_evaluator_single_authority,
    mc_advisory_blocking_drift_zero: modeState.gates.mc_advisory_blocking_drift_zero,
    p0_04_external_artifact_required_check: gateExternalArtifact ? 'PASS' : 'FAIL',
    p0_04_synthetic_payload_forbidden_check: gateSyntheticForbidden ? 'PASS' : 'FAIL',
    p0_04_signature_trust_root_anchored_check: gateSignatureTrustRoot ? 'PASS' : 'FAIL',
    p0_04_required_payload_fields_check: gateRequiredPayloadFields ? 'PASS' : 'FAIL',
    p0_04_self_generated_trust_context_hard_fail_check: gateSelfGeneratedContext ? 'PASS' : 'FAIL',
    p0_04_offline_verifiable_chain_check: gateOfflineChain ? 'PASS' : 'FAIL',
    p0_04_scope_release_promotion_only_check: gateScopeReleasePromotionOnly ? 'PASS' : 'FAIL',
    p0_04_release_promotion_fail_nonzero_check: gateReleasePromotionNonZero ? 'PASS' : 'FAIL',
    p0_04_repeatable_pass_3runs: repeatable.ok ? 'PASS' : 'FAIL',
  };

  const summary = {
    status: Object.values(gates).every((value) => value === 'PASS') ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    trustLockId: TRUST_LOCK_ID,
    requiredPayloadFields: [...REQUIRED_PAYLOAD_FIELDS],
    advisoryToBlockingDriftCount: modeState.advisoryToBlockingDriftCount,
    activePhase: positiveState.mode,
    gates,
    generatedAtUtc: new Date().toISOString(),
  };

  const ticketMeta = {
    runId: summary.runId,
    ticketId: summary.ticketId,
    outputDir: path.relative(repoRoot, outputDir).replaceAll(path.sep, '/'),
    generatedAtUtc: summary.generatedAtUtc,
  };

  writeJson(path.join(outputDir, 'attestation-external-artifact-positive.json'), {
    ok: positiveState.ok,
    failReason: positiveState.failReason,
    failSignalCode: positiveState.failSignalCode,
    mode: positiveState.mode,
    payload: positivePayload,
  });

  writeJson(path.join(outputDir, 'attestation-synthetic-payload-negative.json'), {
    ok: syntheticNegativeState.ok,
    failReason: syntheticNegativeState.failReason,
    failSignalCode: syntheticNegativeState.failSignalCode,
    issues: syntheticNegativeState.issues,
    payload: syntheticNegativePayload,
  });

  writeJson(path.join(outputDir, 'attestation-self-generated-trust-context-negative.json'), {
    ok: selfGeneratedState.ok,
    failReason: selfGeneratedState.failReason,
    failSignalCode: selfGeneratedState.failSignalCode,
    issues: selfGeneratedState.issues,
    payload: selfGeneratedPayload,
  });

  writeJson(path.join(outputDir, 'attestation-signature-trust-root-negative.json'), {
    ok: trustRootMissingState.ok,
    failReason: trustRootMissingState.failReason,
    failSignalCode: trustRootMissingState.failSignalCode,
    issues: trustRootMissingState.issues,
    payload: trustRootMissingPayload,
  });

  writeJson(path.join(outputDir, 'attestation-required-payload-fields-negative.json'), {
    ok: requiredFieldsMissingState.ok,
    failReason: requiredFieldsMissingState.failReason,
    failSignalCode: requiredFieldsMissingState.failSignalCode,
    missingRequiredPayloadFields: requiredFieldsMissingState.missingRequiredPayloadFields,
    payload: requiredFieldsMissingPayload,
  });

  writeJson(path.join(outputDir, 'advisory-blocking-drift-cases.json'), {
    advisoryToBlockingDriftCount: modeState.advisoryToBlockingDriftCount,
    claimOverrideViolationCount: modeState.claimOverrideViolationCount,
    cases: [],
  });

  writeJson(path.join(outputDir, 'summary.json'), summary);
  writeJson(path.join(outputDir, 'ticket-meta.json'), ticketMeta);

  process.stdout.write(`${stableStringify(summary)}\n`);
  process.exit(summary.status === 'PASS' ? 0 : 1);
}

main();
