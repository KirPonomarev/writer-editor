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

const TOKEN_NAME = 'X21_WS01_RELEASE_CANDIDATE_PRECHECK_PACK_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';
const DRIFT_PROBE_FAILSIGNAL = 'E_REMOTE_UNAVAILABLE';

const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const DEFAULT_TOKEN_CATALOG_PATH = 'docs/OPS/TOKENS/TOKEN_CATALOG.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_BINDING_SCHEMA_PATH = 'docs/OPS/STATUS/BINDING_SCHEMA_V1.json';
const DEFAULT_PRECHECK_PACK_PATH = 'docs/OPS/STATUS/X21_RELEASE_CANDIDATE_PRECHECK_PACK_v1.json';
const DEFAULT_P0_CLOSE_SUMMARY_PATH = 'docs/OPS/STATUS/P0_CONTOUR_CLOSE_SUMMARY_V1.json';
const DEFAULT_X20_CLOSE_SUMMARY_PATH = 'docs/OPS/STATUS/X20_CONTOUR_CLOSE_SUMMARY_V1.json';
const DEFAULT_X20_CLOSEOUT_SIGNED_PATH = 'docs/OPS/STATUS/X20_CONTOUR_CLOSEOUT_SIGNED_V1.json';
const DEFAULT_X20_USABILITY_STATUS_PATH = 'docs/OPS/STATUS/X20_WS02_USABILITY_REGRESSION_GUARD_PACK_v1.json';
const DEFAULT_X20_USABILITY_SUMMARY_PATH = 'docs/OPS/EVIDENCE/X20_CONTOUR/TICKET_02/summary.json';

const MODE_KEYS = Object.freeze(['prCore', 'release', 'promotion']);
const MODE_LABELS = Object.freeze({ prCore: 'pr', release: 'release', promotion: 'promotion' });
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

function normalizePrecheckPackDoc(doc) {
  const source = isObjectRecord(doc) ? doc : {};
  return {
    schemaVersion: Number(source.schemaVersion) || 1,
    precheckPackVersion: normalizeString(source.precheckPackVersion),
    nonBlockingClassification: normalizeString(source.nonBlockingClassification).toLowerCase(),
    blockingSurfaceExpansion: source.blockingSurfaceExpansion === true,
    requiredModeKeys: toUniqueStrings(source.requiredModeKeys, { sort: false }),
    requiredReleaseBlockingSet: toUniqueStrings(source.requiredReleaseBlockingSet),
    requiredUsabilityStatusToken: normalizeString(source.requiredUsabilityStatusToken),
    requiredUsabilityStatus: normalizeString(source.requiredUsabilityStatus),
    requiredUsabilityZeroCountKeys: toUniqueStrings(source.requiredUsabilityZeroCountKeys),
  };
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseTokenCatalog(doc) {
  const rows = Array.isArray(doc?.tokens) ? doc.tokens : [];
  const map = new Map();
  for (const row of rows) {
    if (!isObjectRecord(row)) continue;
    const tokenId = normalizeString(row.tokenId);
    if (!tokenId) continue;
    map.set(tokenId, row);
  }
  return map;
}

function parseBindingRecords(doc) {
  const rows = Array.isArray(doc?.records) ? doc.records : [];
  const map = new Map();
  for (const row of rows) {
    if (!isObjectRecord(row)) continue;
    const tokenId = normalizeString(row.TOKEN_ID);
    if (!tokenId) continue;
    map.set(tokenId, row);
  }
  return map;
}

function parseFailSignalRegistry(doc) {
  const rows = Array.isArray(doc?.failSignals) ? doc.failSignals : [];
  const map = new Map();
  for (const row of rows) {
    if (!isObjectRecord(row)) continue;
    const code = normalizeString(row.code);
    if (!code) continue;
    if (!map.has(code)) map.set(code, []);
    map.get(code).push(row);
  }
  return map;
}

function validateReleaseBlockingSet({ precheckPackDoc, tokenCatalogDoc, bindingSchemaDoc, failsignalRegistryDoc }) {
  const tokenMap = parseTokenCatalog(tokenCatalogDoc);
  const bindingMap = parseBindingRecords(bindingSchemaDoc);
  const failSignalMap = parseFailSignalRegistry(failsignalRegistryDoc);
  const requiredBindingFields = toUniqueStrings(bindingSchemaDoc?.requiredFields || []);

  const missingTokenCatalog = [];
  const missingBindingRecord = [];
  const missingBindingRequiredFields = [];
  const missingFailSignalInRegistry = [];
  const tokenBindingFailSignalMismatch = [];

  for (const tokenId of precheckPackDoc.requiredReleaseBlockingSet) {
    const tokenRow = tokenMap.get(tokenId);
    const bindingRow = bindingMap.get(tokenId);

    if (!tokenRow) {
      missingTokenCatalog.push({ tokenId, reason: 'MISSING_TOKEN_IN_CATALOG' });
      continue;
    }
    if (!bindingRow) {
      missingBindingRecord.push({ tokenId, reason: 'MISSING_BINDING_RECORD' });
      continue;
    }

    for (const field of requiredBindingFields) {
      const value = normalizeString(bindingRow[field]);
      if (!value) {
        missingBindingRequiredFields.push({ tokenId, field, reason: 'MISSING_BINDING_REQUIRED_FIELD' });
      }
    }

    const tokenFailSignalCode = normalizeString(tokenRow.failSignalCode);
    const bindingFailSignalCode = normalizeString(bindingRow.FAILSIGNAL_CODE);
    if (!failSignalMap.has(tokenFailSignalCode)) {
      missingFailSignalInRegistry.push({
        tokenId,
        failSignalCode: tokenFailSignalCode,
        reason: 'TOKEN_FAILSIGNAL_NOT_REGISTERED',
      });
    }
    if (tokenFailSignalCode && bindingFailSignalCode && tokenFailSignalCode !== bindingFailSignalCode) {
      tokenBindingFailSignalMismatch.push({
        tokenId,
        tokenFailSignalCode,
        bindingFailSignalCode,
        reason: 'TOKEN_BINDING_FAILSIGNAL_MISMATCH',
      });
    }
  }

  const ok = precheckPackDoc.requiredReleaseBlockingSet.length > 0
    && missingTokenCatalog.length === 0
    && missingBindingRecord.length === 0
    && missingBindingRequiredFields.length === 0
    && missingFailSignalInRegistry.length === 0
    && tokenBindingFailSignalMismatch.length === 0;

  return {
    ok,
    requiredReleaseBlockingTokenCount: precheckPackDoc.requiredReleaseBlockingSet.length,
    missingTokenCatalog,
    missingBindingRecord,
    missingBindingRequiredFields,
    missingFailSignalInRegistry,
    tokenBindingFailSignalMismatch,
  };
}

function validateModeMatrixConsistency({ repoRoot, precheckPackDoc, tokenCatalogDoc, failsignalRegistryDoc }) {
  const failSignalRows = Array.isArray(failsignalRegistryDoc?.failSignals) ? failsignalRegistryDoc.failSignals : [];
  const tokenMap = parseTokenCatalog(tokenCatalogDoc);
  const duplicateSignalCodes = [];
  const missingModeDisposition = [];
  const invalidModeDisposition = [];
  const blockingFlagConflict = [];
  const requiredTokenFailSignalMissing = [];
  const advisoryToBlockingDriftCases = [];
  const evaluatorIssues = [];

  const seen = new Map();
  for (const row of failSignalRows) {
    if (!isObjectRecord(row)) continue;
    const code = normalizeString(row.code);
    if (!code) continue;
    seen.set(code, (seen.get(code) || 0) + 1);

    const modeMatrix = isObjectRecord(row.modeMatrix) ? row.modeMatrix : {};
    const dispositions = [];
    for (const modeKey of precheckPackDoc.requiredModeKeys) {
      const disposition = normalizeString(modeMatrix[modeKey]).toLowerCase();
      if (!disposition) {
        missingModeDisposition.push({ failSignalCode: code, modeKey, reason: 'MISSING_MODE_DISPOSITION' });
        continue;
      }
      if (!MODE_DISPOSITIONS.has(disposition)) {
        invalidModeDisposition.push({
          failSignalCode: code,
          modeKey,
          disposition,
          reason: 'INVALID_MODE_DISPOSITION',
        });
        continue;
      }
      dispositions.push(disposition);
    }

    const blocking = row.blocking === true;
    const hasBlockingDisposition = dispositions.includes('blocking');
    if (blocking && !hasBlockingDisposition) {
      blockingFlagConflict.push({ failSignalCode: code, reason: 'BLOCKING_FLAG_CONFLICT' });
    }
  }

  for (const [code, count] of seen.entries()) {
    if (count > 1) {
      duplicateSignalCodes.push({ failSignalCode: code, count, reason: 'DUPLICATE_FAILSIGNAL_CODE' });
    }
  }

  for (const tokenId of precheckPackDoc.requiredReleaseBlockingSet) {
    const tokenRow = tokenMap.get(tokenId);
    const failSignalCode = normalizeString(tokenRow?.failSignalCode);
    const row = failSignalRows.find((entry) => normalizeString(entry?.code) === failSignalCode);
    if (!row) {
      requiredTokenFailSignalMissing.push({
        tokenId,
        failSignalCode,
        reason: 'REQUIRED_TOKEN_FAILSIGNAL_NOT_FOUND',
      });
    }
  }

  const driftRow = failSignalRows.find((entry) => normalizeString(entry?.code) === DRIFT_PROBE_FAILSIGNAL);
  if (isObjectRecord(driftRow)) {
    const modeMatrix = isObjectRecord(driftRow.modeMatrix) ? driftRow.modeMatrix : {};
    for (const modeKey of MODE_KEYS) {
      const expected = normalizeString(modeMatrix[modeKey]).toLowerCase();
      if (expected !== 'advisory') continue;
      const verdict = evaluateModeMatrixVerdict({
        repoRoot,
        mode: MODE_LABELS[modeKey],
        failSignalCode: DRIFT_PROBE_FAILSIGNAL,
      });
      if (!verdict.ok) {
        evaluatorIssues.push({
          failSignalCode: DRIFT_PROBE_FAILSIGNAL,
          mode: MODE_LABELS[modeKey],
          reason: 'MODE_EVALUATOR_ERROR',
          issues: verdict.issues || [],
        });
        continue;
      }
      if (verdict.shouldBlock) {
        advisoryToBlockingDriftCases.push({
          failSignalCode: DRIFT_PROBE_FAILSIGNAL,
          mode: MODE_LABELS[modeKey],
          reason: 'ADVISORY_TO_BLOCKING_DRIFT',
        });
      }
    }
  }

  const ok = duplicateSignalCodes.length === 0
    && missingModeDisposition.length === 0
    && invalidModeDisposition.length === 0
    && blockingFlagConflict.length === 0
    && requiredTokenFailSignalMissing.length === 0
    && advisoryToBlockingDriftCases.length === 0
    && evaluatorIssues.length === 0;

  return {
    ok,
    duplicateSignalCodes,
    missingModeDisposition,
    invalidModeDisposition,
    blockingFlagConflict,
    requiredTokenFailSignalMissing,
    advisoryToBlockingDriftCases,
    evaluatorIssues,
  };
}

function validateOfflineIntegrity({ repoRoot, p0CloseSummaryDoc, x20CloseSummaryDoc, x20SignedDoc }) {
  const issues = [];
  const lockChecks = {
    p0OfflineIntegrity: false,
    x20CloseSummary: false,
    x20SignedStatus: false,
    x20SignedHashMatch: false,
  };

  lockChecks.p0OfflineIntegrity = normalizeString(p0CloseSummaryDoc?.offlineReleaseIntegrity) === 'LOCALLY_VERIFIABLE';
  if (!lockChecks.p0OfflineIntegrity) {
    issues.push({ reason: 'P0_OFFLINE_INTEGRITY_NOT_VERIFIABLE' });
  }

  lockChecks.x20CloseSummary = normalizeString(x20CloseSummaryDoc?.status) === 'COMPLETED'
    && normalizeString(x20CloseSummaryDoc?.gateDecision) === 'CLOSED'
    && normalizeString(x20CloseSummaryDoc?.offlineReleaseIntegrity) === 'LOCALLY_VERIFIABLE';
  if (!lockChecks.x20CloseSummary) {
    issues.push({ reason: 'X20_CLOSE_SUMMARY_INVALID' });
  }

  lockChecks.x20SignedStatus = normalizeString(x20SignedDoc?.status) === 'SIGNED'
    && normalizeString(x20SignedDoc?.signatureType) === 'SHA256_EVIDENCE_LOCK'
    && normalizeString(x20SignedDoc?.evidencePacketSha256).startsWith('sha256:');
  if (!lockChecks.x20SignedStatus) {
    issues.push({ reason: 'X20_SIGNED_DOC_INVALID' });
  }

  const evidenceRef = normalizeString(x20SignedDoc?.evidencePacketRef);
  if (evidenceRef) {
    const evidenceAbsPath = path.resolve(repoRoot, evidenceRef);
    if (!fs.existsSync(evidenceAbsPath)) {
      issues.push({ reason: 'X20_EVIDENCE_PACKET_MISSING', evidenceRef });
    } else {
      const computedSha = createHash('sha256').update(fs.readFileSync(evidenceAbsPath)).digest('hex');
      const observedSha = normalizeString(x20SignedDoc?.evidencePacketSha256).replace(/^sha256:/, '');
      lockChecks.x20SignedHashMatch = computedSha === observedSha;
      if (!lockChecks.x20SignedHashMatch) {
        issues.push({ reason: 'X20_EVIDENCE_HASH_MISMATCH', evidenceRef });
      }
    }
  } else {
    issues.push({ reason: 'X20_EVIDENCE_PACKET_REF_MISSING' });
  }

  return {
    ok: issues.length === 0,
    issues,
    lockChecks,
  };
}

function validateUsabilityGuardPack({ precheckPackDoc, x20UsabilityStatusDoc, x20UsabilitySummaryDoc }) {
  const issues = [];

  const tokenMatch = normalizeString(x20UsabilityStatusDoc?.token) === precheckPackDoc.requiredUsabilityStatusToken;
  if (!tokenMatch) issues.push({ reason: 'USABILITY_STATUS_TOKEN_MISMATCH' });

  const statusPass = normalizeString(x20UsabilityStatusDoc?.status) === precheckPackDoc.requiredUsabilityStatus;
  if (!statusPass) issues.push({ reason: 'USABILITY_STATUS_NOT_PASS' });

  for (const key of precheckPackDoc.requiredUsabilityZeroCountKeys) {
    const value = Number(x20UsabilityStatusDoc?.[key] || 0);
    if (value !== 0) {
      issues.push({ reason: 'USABILITY_ZERO_COUNT_VIOLATION', key, value });
    }
  }

  const repeatability = x20UsabilityStatusDoc?.repeatabilityStable3Runs === true;
  if (!repeatability) issues.push({ reason: 'USABILITY_REPEATABILITY_NOT_STABLE' });

  const summaryPass = normalizeString(x20UsabilitySummaryDoc?.status) === 'PASS';
  if (!summaryPass) issues.push({ reason: 'USABILITY_SUMMARY_NOT_PASS' });

  return {
    ok: issues.length === 0,
    issues,
    checks: {
      tokenMatch,
      statusPass,
      repeatability,
      summaryPass,
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
  return {
    ok: hashA === hashB && hashB === hashC,
    hashes: [hashA, hashB, hashC],
  };
}

function evaluateX21Ws01ReleaseCandidatePrecheckPackState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const canonStatusPath = path.resolve(repoRoot, normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH));
  const failsignalRegistryPath = path.resolve(repoRoot, normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH));

  const canonStatusDoc = isObjectRecord(input.canonStatusDoc) ? input.canonStatusDoc : readJsonObject(canonStatusPath);
  const tokenCatalogDoc = isObjectRecord(input.tokenCatalogDoc)
    ? input.tokenCatalogDoc
    : readJsonObject(path.resolve(repoRoot, DEFAULT_TOKEN_CATALOG_PATH));
  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);
  const bindingSchemaDoc = isObjectRecord(input.bindingSchemaDoc)
    ? input.bindingSchemaDoc
    : readJsonObject(path.resolve(repoRoot, DEFAULT_BINDING_SCHEMA_PATH));
  const precheckPackRaw = isObjectRecord(input.precheckPackDoc)
    ? input.precheckPackDoc
    : readJsonObject(path.resolve(repoRoot, DEFAULT_PRECHECK_PACK_PATH));
  const p0CloseSummaryDoc = isObjectRecord(input.p0CloseSummaryDoc)
    ? input.p0CloseSummaryDoc
    : readJsonObject(path.resolve(repoRoot, DEFAULT_P0_CLOSE_SUMMARY_PATH));
  const x20CloseSummaryDoc = isObjectRecord(input.x20CloseSummaryDoc)
    ? input.x20CloseSummaryDoc
    : readJsonObject(path.resolve(repoRoot, DEFAULT_X20_CLOSE_SUMMARY_PATH));
  const x20SignedDoc = isObjectRecord(input.x20SignedDoc)
    ? input.x20SignedDoc
    : readJsonObject(path.resolve(repoRoot, DEFAULT_X20_CLOSEOUT_SIGNED_PATH));
  const x20UsabilityStatusDoc = isObjectRecord(input.x20UsabilityStatusDoc)
    ? input.x20UsabilityStatusDoc
    : readJsonObject(path.resolve(repoRoot, DEFAULT_X20_USABILITY_STATUS_PATH));
  const x20UsabilitySummaryDoc = isObjectRecord(input.x20UsabilitySummaryDoc)
    ? input.x20UsabilitySummaryDoc
    : readJsonObject(path.resolve(repoRoot, DEFAULT_X20_USABILITY_SUMMARY_PATH));

  const precheckPackDoc = normalizePrecheckPackDoc(precheckPackRaw);
  const canonLock = validateCanonLock(canonStatusDoc);
  const stageActivation = evaluateResolveActiveStageState({ profile: 'release', gateTier: 'release' });
  const stageActivationGuardCheck = Number(stageActivation.STAGE_ACTIVATION_OK) === 1;

  const evaluateBaseline = () => {
    const releaseBinding = validateReleaseBlockingSet({
      precheckPackDoc,
      tokenCatalogDoc,
      bindingSchemaDoc,
      failsignalRegistryDoc,
    });
    const modeMatrix = validateModeMatrixConsistency({
      repoRoot,
      precheckPackDoc,
      tokenCatalogDoc,
      failsignalRegistryDoc,
    });
    const offlineIntegrity = validateOfflineIntegrity({
      repoRoot,
      p0CloseSummaryDoc,
      x20CloseSummaryDoc,
      x20SignedDoc,
    });
    const usabilityGuardPack = validateUsabilityGuardPack({
      precheckPackDoc,
      x20UsabilityStatusDoc,
      x20UsabilitySummaryDoc,
    });
    return {
      ok: releaseBinding.ok && modeMatrix.ok && offlineIntegrity.ok && usabilityGuardPack.ok,
      releaseBinding,
      modeMatrix,
      offlineIntegrity,
      usabilityGuardPack,
    };
  };

  const baseline = evaluateBaseline();
  const determinism = evaluateDeterminism(evaluateBaseline);

  const negative01BindingSchema = deepClone(bindingSchemaDoc || {});
  negative01BindingSchema.records = Array.isArray(negative01BindingSchema.records)
    ? negative01BindingSchema.records.filter((row) => normalizeString(row?.TOKEN_ID) !== 'PROOFHOOK_INTEGRITY_OK')
    : [];
  const negative01 = validateReleaseBlockingSet({
    precheckPackDoc,
    tokenCatalogDoc,
    bindingSchemaDoc: negative01BindingSchema,
    failsignalRegistryDoc,
  });

  const negative02Registry = deepClone(failsignalRegistryDoc || {});
  if (Array.isArray(negative02Registry.failSignals) && negative02Registry.failSignals[0]) {
    const row = negative02Registry.failSignals[0];
    row.modeMatrix = isObjectRecord(row.modeMatrix) ? row.modeMatrix : {};
    row.modeMatrix.release = 'INVALID_VALUE';
  }
  const negative02 = validateModeMatrixConsistency({
    repoRoot,
    precheckPackDoc,
    tokenCatalogDoc,
    failsignalRegistryDoc: negative02Registry,
  });

  const negative03Signed = deepClone(x20SignedDoc || {});
  negative03Signed.evidencePacketSha256 = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';
  const negative03 = validateOfflineIntegrity({
    repoRoot,
    p0CloseSummaryDoc,
    x20CloseSummaryDoc,
    x20SignedDoc: negative03Signed,
  });

  const negative04UsabilityStatus = deepClone(x20UsabilityStatusDoc || {});
  negative04UsabilityStatus.modeProfileGuardGapCount = 1;
  const negative04 = validateUsabilityGuardPack({
    precheckPackDoc,
    x20UsabilityStatusDoc: negative04UsabilityStatus,
    x20UsabilitySummaryDoc,
  });

  let nonDeterministicRunIndex = 0;
  const negative05Determinism = evaluateDeterminism(() => {
    const result = evaluateBaseline();
    nonDeterministicRunIndex += 1;
    if (nonDeterministicRunIndex === 2) {
      result.offlineIntegrity.issues = [...result.offlineIntegrity.issues, { reason: 'FORCED_NON_DETERMINISTIC_PROBE' }];
    }
    return result;
  });

  const negativeResults = {
    NEXT_TZ_NEGATIVE_01: negative01.ok === false && negative01.missingBindingRecord.length > 0,
    NEXT_TZ_NEGATIVE_02: negative02.ok === false
      && (negative02.invalidModeDisposition.length > 0 || negative02.missingModeDisposition.length > 0),
    NEXT_TZ_NEGATIVE_03: negative03.ok === false && negative03.issues.length > 0,
    NEXT_TZ_NEGATIVE_04: negative04.ok === false && negative04.issues.length > 0,
    NEXT_TZ_NEGATIVE_05: negative05Determinism.ok === false,
  };

  const positiveResults = {
    NEXT_TZ_POSITIVE_01: baseline.releaseBinding.ok,
    NEXT_TZ_POSITIVE_02: canonLock.ok && baseline.modeMatrix.ok && baseline.offlineIntegrity.ok && baseline.usabilityGuardPack.ok,
    NEXT_TZ_POSITIVE_03: determinism.ok,
  };

  const allNegativesPass = Object.values(negativeResults).every(Boolean);
  const allPositivesPass = Object.values(positiveResults).every(Boolean);

  const dod = {
    NEXT_TZ_DOD_01: baseline.ok,
    NEXT_TZ_DOD_02: allNegativesPass,
    NEXT_TZ_DOD_03: allPositivesPass,
    NEXT_TZ_DOD_04: determinism.ok,
    NEXT_TZ_DOD_05: precheckPackDoc.blockingSurfaceExpansion === false,
    NEXT_TZ_DOD_06: baseline.modeMatrix.advisoryToBlockingDriftCases.length === 0,
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
    && baseline.modeMatrix.advisoryToBlockingDriftCases.length === 0;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    canonLock,
    stageActivation: {
      ...stageActivation,
      STAGE_ACTIVATION_GUARD_CHECK: stageActivationGuardCheck ? 1 : 0,
    },
    blockingSurfaceExpansion: precheckPackDoc.blockingSurfaceExpansion === true,
    baseline,
    determinism,
    counts: {
      requiredReleaseBlockingTokenCount: baseline.releaseBinding.requiredReleaseBlockingTokenCount,
      releaseBindingMissingTokenCount: baseline.releaseBinding.missingTokenCatalog.length,
      releaseBindingMissingRecordCount: baseline.releaseBinding.missingBindingRecord.length,
      releaseBindingMissingFieldCount: baseline.releaseBinding.missingBindingRequiredFields.length,
      releaseBindingFailSignalMissingCount: baseline.releaseBinding.missingFailSignalInRegistry.length,
      releaseBindingFailSignalMismatchCount: baseline.releaseBinding.tokenBindingFailSignalMismatch.length,
      modeMatrixDuplicateSignalCount: baseline.modeMatrix.duplicateSignalCodes.length,
      modeMatrixMissingDispositionCount: baseline.modeMatrix.missingModeDisposition.length,
      modeMatrixInvalidDispositionCount: baseline.modeMatrix.invalidModeDisposition.length,
      modeMatrixBlockingFlagConflictCount: baseline.modeMatrix.blockingFlagConflict.length,
      modeMatrixRequiredTokenFailSignalMissingCount: baseline.modeMatrix.requiredTokenFailSignalMissing.length,
      advisoryToBlockingDriftCount: baseline.modeMatrix.advisoryToBlockingDriftCases.length,
      offlineIntegrityIssueCount: baseline.offlineIntegrity.issues.length,
      usabilityGuardIssueCount: baseline.usabilityGuardPack.issues.length,
      requiredModeKeyCount: precheckPackDoc.requiredModeKeys.length,
    },
    negativeResults,
    positiveResults,
    dod,
    acceptance,
    detector: {
      detectorId: 'X21_WS01_RELEASE_CANDIDATE_PRECHECK_SINGLE_DETECTOR_V1',
      canonicalModeEvaluatorId: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
      contentHash: createHash('sha256').update(stableStringify({
        baseline: {
          releaseBindingOk: baseline.releaseBinding.ok,
          modeMatrixOk: baseline.modeMatrix.ok,
          offlineIntegrityOk: baseline.offlineIntegrity.ok,
          usabilityGuardPackOk: baseline.usabilityGuardPack.ok,
        },
        counts: {
          requiredReleaseBlockingTokenCount: baseline.releaseBinding.requiredReleaseBlockingTokenCount,
          releaseBindingMissingTokenCount: baseline.releaseBinding.missingTokenCatalog.length,
          releaseBindingMissingRecordCount: baseline.releaseBinding.missingBindingRecord.length,
          releaseBindingMissingFieldCount: baseline.releaseBinding.missingBindingRequiredFields.length,
          modeMatrixMissingDispositionCount: baseline.modeMatrix.missingModeDisposition.length,
          modeMatrixInvalidDispositionCount: baseline.modeMatrix.invalidModeDisposition.length,
          advisoryToBlockingDriftCount: baseline.modeMatrix.advisoryToBlockingDriftCases.length,
          offlineIntegrityIssueCount: baseline.offlineIntegrity.issues.length,
          usabilityGuardIssueCount: baseline.usabilityGuardPack.issues.length,
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
      precheckPackDocPath: DEFAULT_PRECHECK_PACK_PATH,
      canonStatusPath: normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH),
      tokenCatalogPath: DEFAULT_TOKEN_CATALOG_PATH,
      bindingSchemaPath: DEFAULT_BINDING_SCHEMA_PATH,
      failsignalRegistryPath: normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
      p0CloseSummaryPath: DEFAULT_P0_CLOSE_SUMMARY_PATH,
      x20CloseSummaryPath: DEFAULT_X20_CLOSE_SUMMARY_PATH,
      x20CloseoutSignedPath: DEFAULT_X20_CLOSEOUT_SIGNED_PATH,
      x20UsabilityStatusPath: DEFAULT_X20_USABILITY_STATUS_PATH,
      x20UsabilitySummaryPath: DEFAULT_X20_USABILITY_SUMMARY_PATH,
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateX21Ws01ReleaseCandidatePrecheckPackState({
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
  console.log(`RELEASE_BINDING_MISSING_TOKEN_COUNT=${state.counts.releaseBindingMissingTokenCount}`);
  console.log(`MODE_DISPOSITION_MISMATCH_COUNT=${state.counts.modeMatrixInvalidDispositionCount + state.counts.modeMatrixMissingDispositionCount}`);
  console.log(`OFFLINE_INTEGRITY_ISSUE_COUNT=${state.counts.offlineIntegrityIssueCount}`);
  console.log(`USABILITY_GUARD_ISSUE_COUNT=${state.counts.usabilityGuardIssueCount}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.counts.advisoryToBlockingDriftCount}`);
  console.log(`REPEATABILITY_HASHES=${state.determinism.hashes.join(',')}`);
  process.exit(state.ok ? 0 : 1);
}

export { evaluateX21Ws01ReleaseCandidatePrecheckPackState };

const thisFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(thisFilePath)) {
  main();
}
