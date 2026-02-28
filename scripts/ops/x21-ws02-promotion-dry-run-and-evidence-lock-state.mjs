#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';
import { evaluateResolveActiveStageState } from './resolve-active-stage.mjs';
import { evaluateAttestationSignatureState } from './attestation-signature-state.mjs';
import { evaluateVerifyAttestationState } from './verify-attestation-state.mjs';

const TOKEN_NAME = 'X21_WS02_PROMOTION_DRY_RUN_AND_EVIDENCE_LOCK_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';

const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_PACK_PATH = 'docs/OPS/STATUS/X21_PROMOTION_DRY_RUN_EVIDENCE_LOCK_v1.json';
const DEFAULT_X20_CLOSE_SUMMARY_PATH = 'docs/OPS/STATUS/X20_CONTOUR_CLOSE_SUMMARY_V1.json';
const DEFAULT_X20_CLOSEOUT_SIGNED_PATH = 'docs/OPS/STATUS/X20_CONTOUR_CLOSEOUT_SIGNED_V1.json';
const DEFAULT_X21_WS01_STATUS_PATH = 'docs/OPS/STATUS/X21_WS01_RELEASE_CANDIDATE_PRECHECK_PACK_v1.json';
const DEFAULT_X21_WS01_SUMMARY_PATH = 'docs/OPS/EVIDENCE/X21_CONTOUR/TICKET_01/summary.json';

const MODE_TO_KEY = Object.freeze({ pr: 'prCore', release: 'release', promotion: 'promotion' });
const MODE_DISPOSITIONS = new Set(['advisory', 'blocking']);

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

function toUniqueStrings(value, { sort = true } = {}) {
  const source = Array.isArray(value) ? value : [];
  const out = [];
  const seen = new Set();
  for (const raw of source) {
    const normalized = normalizeString(String(raw || ''));
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  if (sort) out.sort((a, b) => a.localeCompare(b));
  return out;
}

function readJsonObject(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return isObjectRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function fileSha256(filePath) {
  const content = fs.readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = { json: false, canonStatusPath: '', failsignalRegistryPath: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--json') {
      out.json = true;
      continue;
    }
    if (arg === '--canon-status-path' && i + 1 < argv.length) {
      out.canonStatusPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--canon-status-path=')) {
      out.canonStatusPath = normalizeString(arg.slice('--canon-status-path='.length));
      continue;
    }
    if (arg === '--failsignal-registry-path' && i + 1 < argv.length) {
      out.failsignalRegistryPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--failsignal-registry-path=')) {
      out.failsignalRegistryPath = normalizeString(arg.slice('--failsignal-registry-path='.length));
    }
  }
  return out;
}

function validateCanonLock(canonStatusDoc) {
  if (!isObjectRecord(canonStatusDoc)) {
    return { ok: false, reason: 'CANON_STATUS_UNREADABLE', observedStatus: '', observedVersion: '' };
  }
  const observedStatus = normalizeString(canonStatusDoc.status);
  const observedVersion = normalizeString(canonStatusDoc.canonVersion);
  const ok = observedStatus === 'ACTIVE_CANON' && observedVersion.toLowerCase() === EXPECTED_CANON_VERSION;
  return { ok, reason: ok ? '' : 'ACTIVE_CANON_LOCK_FAIL', observedStatus, observedVersion };
}

function normalizePackDoc(doc) {
  const source = isObjectRecord(doc) ? doc : {};
  const modeChecks = Array.isArray(source.requiredModeChecks) ? source.requiredModeChecks : [];
  return {
    schemaVersion: Number(source.schemaVersion) || 1,
    promotionDryRunVersion: normalizeString(source.promotionDryRunVersion),
    nonBlockingClassification: normalizeString(source.nonBlockingClassification).toLowerCase(),
    blockingSurfaceExpansion: source.blockingSurfaceExpansion === true,
    expectedReleaseClassChanged: source.expectedReleaseClassChanged === true,
    requiredModeChecks: modeChecks
      .map((row) => ({
        failSignalCode: normalizeString(row?.failSignalCode),
        mode: normalizeString(row?.mode).toLowerCase(),
        expectedDisposition: normalizeString(row?.expectedDisposition).toLowerCase(),
      }))
      .filter((row) => row.failSignalCode && row.mode && row.expectedDisposition),
    requiredEvidenceRefs: toUniqueStrings(source.requiredEvidenceRefs, { sort: false }),
    requiredWs01Token: normalizeString(source.requiredWs01Token),
    requiredWs01Status: normalizeString(source.requiredWs01Status),
    requiredWs01ZeroKeys: toUniqueStrings(source.requiredWs01ZeroKeys),
    requiredAttestationTokens: toUniqueStrings(source.requiredAttestationTokens),
  };
}

function parseFailSignalRegistry(doc) {
  const rows = Array.isArray(doc?.failSignals) ? doc.failSignals : [];
  const out = new Map();
  for (const row of rows) {
    if (!isObjectRecord(row)) continue;
    const code = normalizeString(row.code);
    if (!code) continue;
    if (!out.has(code)) out.set(code, []);
    out.get(code).push(row);
  }
  return out;
}

function validatePromotionDryRun({ packDoc, x21Ws01StatusDoc, x21Ws01SummaryDoc, x20CloseSummaryDoc }) {
  const issues = [];
  const zeroKeyViolations = [];

  const ws01StatusPass = normalizeString(x21Ws01StatusDoc?.status) === packDoc.requiredWs01Status;
  if (!ws01StatusPass) issues.push({ reason: 'WS01_STATUS_NOT_PASS' });

  const ws01TokenPass = normalizeString(x21Ws01StatusDoc?.token) === packDoc.requiredWs01Token;
  if (!ws01TokenPass) issues.push({ reason: 'WS01_TOKEN_MISMATCH' });

  const ws01SummaryPass = normalizeString(x21Ws01SummaryDoc?.status) === 'PASS';
  if (!ws01SummaryPass) issues.push({ reason: 'WS01_SUMMARY_NOT_PASS' });

  const x20CloseReady = normalizeString(x20CloseSummaryDoc?.status) === 'COMPLETED'
    && normalizeString(x20CloseSummaryDoc?.gateDecision) === 'CLOSED';
  if (!x20CloseReady) issues.push({ reason: 'X20_CLOSEOUT_NOT_READY' });

  for (const key of packDoc.requiredWs01ZeroKeys) {
    const value = Number(x21Ws01StatusDoc?.[key] || 0);
    if (value !== 0) {
      zeroKeyViolations.push({ key, value, reason: 'WS01_ZERO_KEY_VIOLATION' });
    }
  }
  issues.push(...zeroKeyViolations);

  return {
    ok: issues.length === 0,
    issues,
    checks: {
      ws01StatusPass,
      ws01TokenPass,
      ws01SummaryPass,
      x20CloseReady,
    },
    zeroKeyViolations,
  };
}

function validateEvidenceLock({ repoRoot, packDoc, x20SignedDoc }) {
  const missingEvidenceLinks = [];
  const chainEntries = [];
  for (const ref of packDoc.requiredEvidenceRefs) {
    const abs = path.resolve(repoRoot, ref);
    if (!fs.existsSync(abs)) {
      missingEvidenceLinks.push({ ref, reason: 'MISSING_EVIDENCE_LINK' });
      continue;
    }
    const sha = fileSha256(abs);
    chainEntries.push({ ref, sha256: sha });
  }

  const evidenceRef = normalizeString(x20SignedDoc?.evidencePacketRef);
  const evidenceRefPresent = packDoc.requiredEvidenceRefs.includes(evidenceRef);
  if (!evidenceRefPresent) {
    missingEvidenceLinks.push({ ref: evidenceRef || 'MISSING', reason: 'SIGNED_EVIDENCE_REF_NOT_IN_CHAIN' });
  }

  let evidenceHashMismatch = false;
  if (evidenceRef && fs.existsSync(path.resolve(repoRoot, evidenceRef))) {
    const observedSha = normalizeString(x20SignedDoc?.evidencePacketSha256).replace(/^sha256:/, '');
    const actualSha = fileSha256(path.resolve(repoRoot, evidenceRef));
    evidenceHashMismatch = observedSha !== actualSha;
  } else {
    evidenceHashMismatch = true;
  }

  let previous = 'ROOT';
  const computedChain = chainEntries.map((entry) => {
    const chainHash = createHash('sha256')
      .update(`${previous}|${entry.ref}|${entry.sha256}`)
      .digest('hex');
    previous = chainHash;
    return {
      ...entry,
      chainHash,
    };
  });
  const chainRootHash = computedChain.length > 0 ? computedChain[computedChain.length - 1].chainHash : '';

  const issues = [];
  if (missingEvidenceLinks.length > 0) issues.push(...missingEvidenceLinks);
  if (evidenceHashMismatch) issues.push({ reason: 'EVIDENCE_LOCK_HASH_MISMATCH' });

  return {
    ok: issues.length === 0,
    issues,
    requiredEvidenceRefCount: packDoc.requiredEvidenceRefs.length,
    resolvedEvidenceRefCount: chainEntries.length,
    missingEvidenceLinks,
    evidenceHashMismatch,
    chainEntries: computedChain,
    chainRootHash,
  };
}

function validateModeAndReleaseClass({ repoRoot, packDoc, failsignalRegistryDoc, x20SignedDoc }) {
  const failSignalMap = parseFailSignalRegistry(failsignalRegistryDoc);
  const missingModeChecks = [];
  const modeDispositionDrift = [];
  const modeEvaluatorIssues = [];

  for (const row of packDoc.requiredModeChecks) {
    const failSignals = failSignalMap.get(row.failSignalCode) || [];
    if (failSignals.length === 0) {
      missingModeChecks.push({ ...row, reason: 'FAILSIGNAL_NOT_FOUND' });
      continue;
    }
    const first = failSignals[0];
    const modeKey = MODE_TO_KEY[row.mode] || '';
    const registryDisposition = normalizeString(first?.modeMatrix?.[modeKey]).toLowerCase();
    if (!MODE_DISPOSITIONS.has(registryDisposition)) {
      modeDispositionDrift.push({
        ...row,
        observedDisposition: registryDisposition || 'MISSING',
        reason: 'REGISTRY_MODE_DISPOSITION_INVALID',
      });
      continue;
    }
    if (registryDisposition !== row.expectedDisposition) {
      modeDispositionDrift.push({
        ...row,
        observedDisposition: registryDisposition,
        reason: 'REGISTRY_MODE_DISPOSITION_DRIFT',
      });
    }

    const verdict = evaluateModeMatrixVerdict({
      repoRoot,
      mode: row.mode,
      failSignalCode: row.failSignalCode,
    });
    if (!verdict.ok) {
      modeEvaluatorIssues.push({
        ...row,
        reason: 'MODE_EVALUATOR_ERROR',
        issues: verdict.issues || [],
      });
      continue;
    }
    const expectedShouldBlock = row.expectedDisposition === 'blocking';
    if (Boolean(verdict.shouldBlock) !== expectedShouldBlock) {
      modeDispositionDrift.push({
        ...row,
        observedDisposition: normalizeString(verdict.modeDisposition),
        reason: 'EVALUATOR_MODE_DISPOSITION_DRIFT',
      });
    }
  }

  const expectedReleaseClassChanged = packDoc.expectedReleaseClassChanged === true;
  const observedReleaseClassChanged = x20SignedDoc?.gate?.releaseDecisionClassChanged === true;
  const releaseClassDrift = observedReleaseClassChanged !== expectedReleaseClassChanged;

  const issues = [];
  if (missingModeChecks.length > 0) issues.push(...missingModeChecks);
  if (modeDispositionDrift.length > 0) issues.push(...modeDispositionDrift);
  if (modeEvaluatorIssues.length > 0) issues.push(...modeEvaluatorIssues);
  if (releaseClassDrift) {
    issues.push({
      reason: 'RELEASE_CLASS_DRIFT',
      expectedReleaseClassChanged,
      observedReleaseClassChanged,
    });
  }

  return {
    ok: issues.length === 0,
    issues,
    missingModeChecks,
    modeDispositionDrift,
    modeEvaluatorIssues,
    releaseClassDrift,
  };
}

function validateAttestationRecheck({ repoRoot, packDoc }) {
  const issues = [];
  const attestationState = evaluateAttestationSignatureState({ repoRoot });
  const verifyState = evaluateVerifyAttestationState({ repoRoot });

  const attestationTokenOk = Number(attestationState.ATTESTATION_SIGNATURE_OK) === 1 && attestationState.ok === true;
  const verifyTokenOk = Number(verifyState.VERIFY_ATTESTATION_OK) === 1 && verifyState.ok === true;

  if (packDoc.requiredAttestationTokens.includes('ATTESTATION_SIGNATURE_OK') && !attestationTokenOk) {
    issues.push({ reason: 'ATTESTATION_SIGNATURE_RECHECK_FAILED' });
  }
  if (packDoc.requiredAttestationTokens.includes('VERIFY_ATTESTATION_OK') && !verifyTokenOk) {
    issues.push({ reason: 'VERIFY_ATTESTATION_RECHECK_FAILED' });
  }

  return {
    ok: issues.length === 0,
    issues,
    checks: {
      attestationTokenOk,
      verifyTokenOk,
    },
    attestationState: {
      ok: attestationState.ok === true,
      token: Number(attestationState.ATTESTATION_SIGNATURE_OK) === 1 ? 1 : 0,
    },
    verifyState: {
      ok: verifyState.ok === true,
      token: Number(verifyState.VERIFY_ATTESTATION_OK) === 1 ? 1 : 0,
    },
  };
}

function evaluateDeterminism(evaluateFn) {
  const runA = evaluateFn();
  const runB = evaluateFn();
  const runC = evaluateFn();
  const hashA = createHash('sha256').update(stableStringify(runA)).digest('hex');
  const hashB = createHash('sha256').update(stableStringify(runB)).digest('hex');
  const hashC = createHash('sha256').update(stableStringify(runC)).digest('hex');
  return { ok: hashA === hashB && hashB === hashC, hashes: [hashA, hashB, hashC] };
}

function evaluateX21Ws02PromotionDryRunAndEvidenceLockState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const canonStatusPath = path.resolve(repoRoot, normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH));
  const failsignalRegistryPath = path.resolve(repoRoot, normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH));

  const canonStatusDoc = isObjectRecord(input.canonStatusDoc) ? input.canonStatusDoc : readJsonObject(canonStatusPath);
  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);
  const packRaw = isObjectRecord(input.packDoc)
    ? input.packDoc
    : readJsonObject(path.resolve(repoRoot, DEFAULT_PACK_PATH));
  const x20CloseSummaryDoc = isObjectRecord(input.x20CloseSummaryDoc)
    ? input.x20CloseSummaryDoc
    : readJsonObject(path.resolve(repoRoot, DEFAULT_X20_CLOSE_SUMMARY_PATH));
  const x20SignedDoc = isObjectRecord(input.x20SignedDoc)
    ? input.x20SignedDoc
    : readJsonObject(path.resolve(repoRoot, DEFAULT_X20_CLOSEOUT_SIGNED_PATH));
  const x21Ws01StatusDoc = isObjectRecord(input.x21Ws01StatusDoc)
    ? input.x21Ws01StatusDoc
    : readJsonObject(path.resolve(repoRoot, DEFAULT_X21_WS01_STATUS_PATH));
  const x21Ws01SummaryDoc = isObjectRecord(input.x21Ws01SummaryDoc)
    ? input.x21Ws01SummaryDoc
    : readJsonObject(path.resolve(repoRoot, DEFAULT_X21_WS01_SUMMARY_PATH));

  const packDoc = normalizePackDoc(packRaw);
  const canonLock = validateCanonLock(canonStatusDoc);
  const stageActivation = evaluateResolveActiveStageState({ profile: 'release', gateTier: 'release' });
  const stageActivationGuardCheck = Number(stageActivation.STAGE_ACTIVATION_OK) === 1;

  const evaluateBaseline = () => {
    const promotionDryRun = validatePromotionDryRun({
      packDoc,
      x21Ws01StatusDoc,
      x21Ws01SummaryDoc,
      x20CloseSummaryDoc,
    });
    const evidenceLock = validateEvidenceLock({
      repoRoot,
      packDoc,
      x20SignedDoc,
    });
    const modeReleaseClass = validateModeAndReleaseClass({
      repoRoot,
      packDoc,
      failsignalRegistryDoc,
      x20SignedDoc,
    });
    const attestationRecheck = validateAttestationRecheck({
      repoRoot,
      packDoc,
    });
    return {
      ok: promotionDryRun.ok && evidenceLock.ok && modeReleaseClass.ok && attestationRecheck.ok,
      promotionDryRun,
      evidenceLock,
      modeReleaseClass,
      attestationRecheck,
    };
  };

  const baseline = evaluateBaseline();
  const determinism = evaluateDeterminism(evaluateBaseline);

  const negative01Pack = deepClone(packDoc);
  negative01Pack.requiredEvidenceRefs = [...negative01Pack.requiredEvidenceRefs, 'docs/OPS/STATUS/DOES_NOT_EXIST_PROMOTION_LINK.json'];
  const negative01 = validateEvidenceLock({ repoRoot, packDoc: negative01Pack, x20SignedDoc });

  const negative02Signed = deepClone(x20SignedDoc || {});
  negative02Signed.evidencePacketSha256 = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';
  const negative02 = validateEvidenceLock({ repoRoot, packDoc, x20SignedDoc: negative02Signed });

  const negative03Signed = deepClone(x20SignedDoc || {});
  negative03Signed.gate = isObjectRecord(negative03Signed.gate) ? negative03Signed.gate : {};
  negative03Signed.gate.releaseDecisionClassChanged = true;
  const negative03 = validateModeAndReleaseClass({
    repoRoot,
    packDoc,
    failsignalRegistryDoc,
    x20SignedDoc: negative03Signed,
  });

  const negative04Registry = deepClone(failsignalRegistryDoc || {});
  if (Array.isArray(negative04Registry.failSignals)) {
    const driftRow = negative04Registry.failSignals.find((row) => normalizeString(row?.code) === 'E_REMOTE_UNAVAILABLE');
    if (driftRow) {
      driftRow.modeMatrix = isObjectRecord(driftRow.modeMatrix) ? driftRow.modeMatrix : {};
      driftRow.modeMatrix.promotion = 'blocking';
    }
  }
  const negative04 = validateModeAndReleaseClass({
    repoRoot,
    packDoc,
    failsignalRegistryDoc: negative04Registry,
    x20SignedDoc,
  });

  let nonDeterministicRunIndex = 0;
  const negative05Determinism = evaluateDeterminism(() => {
    const result = evaluateBaseline();
    nonDeterministicRunIndex += 1;
    if (nonDeterministicRunIndex === 2) {
      result.evidenceLock.chainRootHash = createHash('sha256')
        .update(`${result.evidenceLock.chainRootHash}:forced`)
        .digest('hex');
    }
    return result;
  });

  const negativeResults = {
    NEXT_TZ_NEGATIVE_01: negative01.ok === false && negative01.missingEvidenceLinks.length > 0,
    NEXT_TZ_NEGATIVE_02: negative02.ok === false && negative02.evidenceHashMismatch === true,
    NEXT_TZ_NEGATIVE_03: negative03.ok === false && negative03.releaseClassDrift === true,
    NEXT_TZ_NEGATIVE_04: negative04.ok === false && negative04.modeDispositionDrift.length > 0,
    NEXT_TZ_NEGATIVE_05: negative05Determinism.ok === false,
  };

  const positiveResults = {
    NEXT_TZ_POSITIVE_01: baseline.promotionDryRun.ok && baseline.modeReleaseClass.ok && baseline.attestationRecheck.ok,
    NEXT_TZ_POSITIVE_02: baseline.evidenceLock.ok && baseline.evidenceLock.evidenceHashMismatch === false,
    NEXT_TZ_POSITIVE_03: determinism.ok,
  };

  const allNegativesPass = Object.values(negativeResults).every(Boolean);
  const allPositivesPass = Object.values(positiveResults).every(Boolean);

  const dod = {
    NEXT_TZ_DOD_01: baseline.ok,
    NEXT_TZ_DOD_02: allNegativesPass,
    NEXT_TZ_DOD_03: allPositivesPass,
    NEXT_TZ_DOD_04: determinism.ok,
    NEXT_TZ_DOD_05: packDoc.blockingSurfaceExpansion === false,
    NEXT_TZ_DOD_06: baseline.modeReleaseClass.modeDispositionDrift.length === 0,
  };

  const acceptance = {
    NEXT_TZ_ACCEPTANCE_01: canonLock.ok,
    NEXT_TZ_ACCEPTANCE_02: stageActivationGuardCheck,
    NEXT_TZ_ACCEPTANCE_03: false,
    NEXT_TZ_ACCEPTANCE_04: false,
  };

  const ok = baseline.ok
    && allNegativesPass
    && allPositivesPass
    && canonLock.ok
    && stageActivationGuardCheck
    && baseline.modeReleaseClass.modeDispositionDrift.length === 0;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    canonLock,
    stageActivation: {
      ...stageActivation,
      STAGE_ACTIVATION_GUARD_CHECK: stageActivationGuardCheck ? 1 : 0,
    },
    blockingSurfaceExpansion: packDoc.blockingSurfaceExpansion === true,
    baseline,
    determinism,
    counts: {
      requiredEvidenceRefCount: baseline.evidenceLock.requiredEvidenceRefCount,
      missingEvidenceLinkCount: baseline.evidenceLock.missingEvidenceLinks.length,
      evidenceHashMismatchCount: baseline.evidenceLock.evidenceHashMismatch ? 1 : 0,
      modeCheckMissingCount: baseline.modeReleaseClass.missingModeChecks.length,
      modeDispositionDriftCount: baseline.modeReleaseClass.modeDispositionDrift.length,
      modeEvaluatorIssueCount: baseline.modeReleaseClass.modeEvaluatorIssues.length,
      releaseClassDriftCount: baseline.modeReleaseClass.releaseClassDrift ? 1 : 0,
      promotionDryRunIssueCount: baseline.promotionDryRun.issues.length,
      attestationIssueCount: baseline.attestationRecheck.issues.length,
      advisoryToBlockingDriftCount: baseline.modeReleaseClass.modeDispositionDrift.length,
      requiredModeCheckCount: packDoc.requiredModeChecks.length,
    },
    negativeResults,
    positiveResults,
    dod,
    acceptance,
    detector: {
      detectorId: 'X21_WS02_PROMOTION_DRY_RUN_EVIDENCE_LOCK_SINGLE_DETECTOR_V1',
      canonicalModeEvaluatorId: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
      contentHash: createHash('sha256').update(stableStringify({
        promotionDryRunOk: baseline.promotionDryRun.ok,
        evidenceLockOk: baseline.evidenceLock.ok,
        modeReleaseClassOk: baseline.modeReleaseClass.ok,
        attestationRecheckOk: baseline.attestationRecheck.ok,
        chainRootHash: baseline.evidenceLock.chainRootHash,
        counts: {
          missingEvidenceLinkCount: baseline.evidenceLock.missingEvidenceLinks.length,
          evidenceHashMismatchCount: baseline.evidenceLock.evidenceHashMismatch ? 1 : 0,
          modeDispositionDriftCount: baseline.modeReleaseClass.modeDispositionDrift.length,
          releaseClassDriftCount: baseline.modeReleaseClass.releaseClassDrift ? 1 : 0,
          promotionDryRunIssueCount: baseline.promotionDryRun.issues.length,
          attestationIssueCount: baseline.attestationRecheck.issues.length,
        },
      })).digest('hex'),
    },
    negativeDetails: {
      NEXT_TZ_NEGATIVE_01: negative01,
      NEXT_TZ_NEGATIVE_02: negative02,
      NEXT_TZ_NEGATIVE_03: negative03,
      NEXT_TZ_NEGATIVE_04: negative04,
      NEXT_TZ_NEGATIVE_05: { determinism: negative05Determinism },
    },
    sourceBinding: {
      packDocPath: DEFAULT_PACK_PATH,
      canonStatusPath: normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH),
      failsignalRegistryPath: normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
      x20CloseSummaryPath: DEFAULT_X20_CLOSE_SUMMARY_PATH,
      x20CloseoutSignedPath: DEFAULT_X20_CLOSEOUT_SIGNED_PATH,
      x21Ws01StatusPath: DEFAULT_X21_WS01_STATUS_PATH,
      x21Ws01SummaryPath: DEFAULT_X21_WS01_SUMMARY_PATH,
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateX21Ws02PromotionDryRunAndEvidenceLockState({
    repoRoot: process.cwd(),
    canonStatusPath: args.canonStatusPath,
    failsignalRegistryPath: args.failsignalRegistryPath,
  });

  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
    process.exit(state.ok ? 0 : 1);
  }

  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`CANON_LOCK_CHECK=${state.canonLock.ok ? 'PASS' : 'FAIL'}`);
  console.log(`STAGE_ACTIVATION_GUARD_CHECK=${state.stageActivation.STAGE_ACTIVATION_GUARD_CHECK === 1 ? 'PASS' : 'FAIL'}`);
  console.log(`MISSING_EVIDENCE_LINK_COUNT=${state.counts.missingEvidenceLinkCount}`);
  console.log(`EVIDENCE_HASH_MISMATCH_COUNT=${state.counts.evidenceHashMismatchCount}`);
  console.log(`RELEASE_CLASS_DRIFT_COUNT=${state.counts.releaseClassDriftCount}`);
  console.log(`MODE_DISPOSITION_DRIFT_COUNT=${state.counts.modeDispositionDriftCount}`);
  console.log(`ATTTESTATION_ISSUE_COUNT=${state.counts.attestationIssueCount}`);
  console.log(`REPEATABILITY_HASHES=${state.determinism.hashes.join(',')}`);
  process.exit(state.ok ? 0 : 1);
}

export { evaluateX21Ws02PromotionDryRunAndEvidenceLockState };

const thisFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(thisFilePath)) {
  main();
}
