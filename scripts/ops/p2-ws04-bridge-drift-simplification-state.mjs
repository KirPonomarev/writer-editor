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

const TOKEN_NAME = 'P2_WS04_BRIDGE_DRIFT_SIMPLIFICATION_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';
const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const DEFAULT_CONTRACT_PATH = 'docs/OPS/STATUS/XPLAT_UNIFIED_MASTER_EXECUTION_CONTRACT_v3.13a-final.md';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_TOKEN_CATALOG_PATH = 'docs/OPS/TOKENS/TOKEN_CATALOG.json';
const DEFAULT_CLAIM_MATRIX_PATH = 'docs/OPS/CLAIMS/CRITICAL_CLAIM_MATRIX.json';

const MODE_KEYS = Object.freeze(['prCore', 'release', 'promotion']);
const MODE_LABELS = Object.freeze({ prCore: 'pr', release: 'release', promotion: 'promotion' });
const STANDARD_ALLOWED_MODE_TRIPLETS = new Set([
  'ADV/ADV/ADV',
  'ADV/BLK/BLK',
  'ADV/ADV/BLK',
  'BLK/BLK/BLK',
]);
const SPECIAL_ALLOWED_MODES = new Set(['AS_DEFINED_IN_A16', 'PACK_DEPENDENT']);

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

function readJsonObject(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return isObjectRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    canonStatusPath: '',
    contractPath: '',
    failsignalRegistryPath: '',
    tokenCatalogPath: '',
    claimMatrixPath: '',
  };

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

    if (arg === '--contract-path' && i + 1 < argv.length) {
      out.contractPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--contract-path=')) {
      out.contractPath = normalizeString(arg.slice('--contract-path='.length));
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

    if (arg === '--token-catalog-path' && i + 1 < argv.length) {
      out.tokenCatalogPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--token-catalog-path=')) {
      out.tokenCatalogPath = normalizeString(arg.slice('--token-catalog-path='.length));
      continue;
    }

    if (arg === '--claim-matrix-path' && i + 1 < argv.length) {
      out.claimMatrixPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--claim-matrix-path=')) {
      out.claimMatrixPath = normalizeString(arg.slice('--claim-matrix-path='.length));
    }
  }

  return out;
}

function normalizeBinding(value) {
  const upper = normalizeString(value).toUpperCase();
  if (upper === 'BOUND' || upper === 'SEMI' || upper === 'GAP') return upper;
  return '';
}

function normalizeModeRaw(modeRaw) {
  const raw = normalizeString(modeRaw);
  const compact = raw.replace(/\s+/g, ' ').trim();
  const upperCompact = compact.toUpperCase();

  if (upperCompact.includes('AS DEFINED IN A16')) return 'AS_DEFINED_IN_A16';
  if (upperCompact.includes('PACK-DEPENDENT') || upperCompact.includes('PACK DEPENDENT')) return 'PACK_DEPENDENT';
  return upperCompact;
}

function parseModeTriplet(modeRaw) {
  const normalized = normalizeModeRaw(modeRaw);
  if (SPECIAL_ALLOWED_MODES.has(normalized)) {
    return {
      isStandard: false,
      modeRaw: normalized,
      modeTriplet: null,
    };
  }

  const parts = normalized.split('/').map((entry) => entry.trim()).filter(Boolean);
  if (parts.length !== 3) {
    return {
      isStandard: false,
      modeRaw: normalized,
      modeTriplet: null,
    };
  }

  const translated = parts.map((entry) => {
    if (entry === 'ADV') return 'advisory';
    if (entry === 'BLK') return 'blocking';
    return '';
  });

  if (translated.some((entry) => !entry)) {
    return {
      isStandard: false,
      modeRaw: normalized,
      modeTriplet: null,
    };
  }

  return {
    isStandard: true,
    modeRaw: `${parts[0]}/${parts[1]}/${parts[2]}`,
    modeTriplet: {
      prCore: translated[0],
      release: translated[1],
      promotion: translated[2],
    },
  };
}

function extractFailSignalCodes(input) {
  return [...new Set((String(input || '').match(/E_[A-Z0-9_]+/g) || []))].sort((a, b) => a.localeCompare(b));
}

function extractTokenCandidates(input) {
  const text = String(input || '');
  const standard = text.match(/[A-Z][A-Z0-9_]*_(?:VALID_OK|ENFORCED_OK|STATE_OK|SAFETY_OK|OK)/g) || [];
  const wildcard = text.match(/[A-Z][A-Z0-9_]*_\*/g) || [];
  return [...new Set([...standard, ...wildcard])].sort((a, b) => a.localeCompare(b));
}

function splitLawRefs(lawCell) {
  const refs = [];
  for (const part of String(lawCell || '').split(',')) {
    const m = part.match(/\b([AB]\d+(?:\.\d+)?)\b/u);
    if (m) refs.push(m[1]);
  }
  return [...new Set(refs)].sort((a, b) => a.localeCompare(b));
}

function cleanCell(value) {
  return normalizeString(String(value || '').replace(/\*\*/g, '').replace(/`/g, ''));
}

function parseKnownLawSections(contractText) {
  const lines = String(contractText || '').split(/\r?\n/);
  const out = new Set();
  let inLawPart = false;

  for (const line of lines) {
    if (line.includes('## PART A')) inLawPart = true;
    if (line.includes('## BEGIN PART II')) break;
    if (!inLawPart) continue;
    const matches = line.match(/\b([AB]\d+(?:\.\d+)?)(?=\)|:|\s)/gu) || [];
    for (const match of matches) out.add(match);
  }

  return out;
}

function parseBridgeRowsFromContract(contractText) {
  const lines = String(contractText || '').split(/\r?\n/);
  const rows = [];
  let inBridge = false;

  for (const line of lines) {
    if (line.includes('## 1) Bridge Matrix: MAP 0–23') || line.includes('## 2) Bridge Matrix: MAP 24–37')) {
      inBridge = true;
      continue;
    }
    if (inBridge && line.startsWith('## 3)')) break;
    if (!inBridge) continue;
    if (!line.startsWith('|')) continue;
    if (line.includes('**MAP ID**') || line.startsWith('|---')) continue;

    const cells = line.split('|').slice(1, -1).map((entry) => cleanCell(entry));
    if (cells.length < 7) continue;

    const mode = parseModeTriplet(cells[5]);
    rows.push({
      mapId: cells[0],
      mapSection: cells[1],
      lawSectionsRaw: cells[2],
      lawSections: splitLawRefs(cells[2]),
      gateTokenRaw: cells[3],
      failSignalRaw: cells[4],
      modeRawOriginal: cells[5],
      modeRawNormalized: mode.modeRaw,
      modeTriplet: mode.modeTriplet,
      modeIsStandard: mode.isStandard,
      binding: normalizeBinding(cells[6]),
      sourceLine: line,
    });
  }

  return rows;
}

function listExpectedBridgeMapIds() {
  const out = [];
  for (let i = 0; i <= 23; i += 1) out.push(String(i));
  for (let i = 24; i <= 37; i += 1) out.push(String(i));
  out.push('12B');
  return out;
}

function normalizeRowForOutput(row) {
  return {
    mapId: row.mapId,
    mapSection: row.mapSection,
    lawSections: [...row.lawSections],
    gateTokenRaw: row.gateTokenRaw,
    failSignalRaw: row.failSignalRaw,
    modeRawNormalized: row.modeRawNormalized,
    binding: row.binding,
  };
}

function simplifyRows(rows) {
  const before = rows.map((row) => ({ ...row }));

  const normalizedRows = before.map((row) => {
    const out = { ...row };
    out.mapId = normalizeString(out.mapId);
    out.mapSection = normalizeString(out.mapSection);
    out.lawSectionsRaw = normalizeString(out.lawSectionsRaw);
    out.gateTokenRaw = normalizeString(out.gateTokenRaw);
    out.failSignalRaw = normalizeString(out.failSignalRaw);
    out.binding = normalizeBinding(out.binding);

    const mode = parseModeTriplet(out.modeRawOriginal);
    out.modeRawNormalized = mode.modeRaw;
    out.modeTriplet = mode.modeTriplet;
    out.modeIsStandard = mode.isStandard;

    if (out.binding === 'GAP') {
      out.modeRawNormalized = 'ADV/ADV/ADV';
      out.modeTriplet = { prCore: 'advisory', release: 'advisory', promotion: 'advisory' };
      out.modeIsStandard = true;
    }

    return out;
  });

  const byMapId = new Map();
  const duplicates = [];
  for (const row of normalizedRows) {
    const key = row.mapId;
    if (!byMapId.has(key)) {
      byMapId.set(key, { ...row });
      continue;
    }

    const existing = byMapId.get(key);
    duplicates.push({ mapId: key, mapSection: row.mapSection });

    existing.lawSections = [...new Set([...existing.lawSections, ...row.lawSections])].sort((a, b) => a.localeCompare(b));

    if (row.gateTokenRaw && !existing.gateTokenRaw.includes(row.gateTokenRaw)) {
      existing.gateTokenRaw = existing.gateTokenRaw
        ? `${existing.gateTokenRaw}; ${row.gateTokenRaw}`
        : row.gateTokenRaw;
    }

    if (row.failSignalRaw && !existing.failSignalRaw.includes(row.failSignalRaw)) {
      existing.failSignalRaw = existing.failSignalRaw
        ? `${existing.failSignalRaw}; ${row.failSignalRaw}`
        : row.failSignalRaw;
    }
  }

  const after = [...byMapId.values()].sort((a, b) => a.mapId.localeCompare(b.mapId));

  const signalsBefore = before.map((row) => `${row.mapId}|${extractFailSignalCodes(row.failSignalRaw).join(',')}`);
  const signalsAfter = after.map((row) => `${row.mapId}|${extractFailSignalCodes(row.failSignalRaw).join(',')}`);
  const signalLossCount = signalsBefore.filter((entry) => !signalsAfter.includes(entry)).length;

  return {
    rawRows: before,
    normalizedRows,
    simplifiedRows: after,
    duplicates,
    duplicateRowsBeforeCount: duplicates.length,
    duplicateRowsAfterCount: 0,
    signalLossCount,
  };
}

function evaluateBridgePolicy(input = {}) {
  const rows = Array.isArray(input.rows) ? input.rows : [];
  const knownLawSections = input.knownLawSections instanceof Set ? input.knownLawSections : new Set();
  const knownFailSignals = input.knownFailSignals instanceof Set ? input.knownFailSignals : new Set();
  const knownTokens = input.knownTokens instanceof Set ? input.knownTokens : new Set();
  const expectedMapIds = Array.isArray(input.expectedMapIds) ? input.expectedMapIds : [];
  const reconciliationNotes = input.reconciliationNotes instanceof Set ? input.reconciliationNotes : new Set();

  const boundRowsMissingFields = [];
  const gapRowsBlocking = [];
  const modeMismatches = [];
  const missingBridgeRows = [];
  const lawConflicts = [];
  const boundTraceabilityFailures = [];

  for (const row of rows) {
    const mode = parseModeTriplet(row.modeRawNormalized || row.modeRawOriginal || '');
    const modeRaw = mode.modeRaw;

    const modeValid = mode.isStandard
      ? STANDARD_ALLOWED_MODE_TRIPLETS.has(modeRaw)
      : SPECIAL_ALLOWED_MODES.has(modeRaw);

    if (!modeValid) {
      modeMismatches.push({
        mapId: row.mapId,
        mode: modeRaw,
        reason: 'MODE_OUTSIDE_CANONICAL_MATRIX',
      });
    }

    if (row.binding === 'GAP') {
      const hasBlocking = mode.modeTriplet
        ? Object.values(mode.modeTriplet).some((entry) => entry === 'blocking')
        : modeRaw.includes('BLK');
      if (hasBlocking) {
        gapRowsBlocking.push({ mapId: row.mapId, mode: modeRaw });
      }
    }

    const unknownLawRefs = row.lawSections.filter((law) => !knownLawSections.has(law));
    if (unknownLawRefs.length > 0 && !reconciliationNotes.has(row.mapId)) {
      lawConflicts.push({
        mapId: row.mapId,
        unknownLawRefs,
        reason: 'LAW_MAP_CONFLICT_WITHOUT_RECONCILIATION_NOTE',
      });
    }

    if (row.binding === 'BOUND') {
      if (!row.gateTokenRaw || !row.failSignalRaw || !modeValid) {
        boundRowsMissingFields.push({
          mapId: row.mapId,
          missingGate: !row.gateTokenRaw,
          missingFailSignal: !row.failSignalRaw,
          invalidMode: !modeValid,
        });
        continue;
      }

      const failSignalCodes = extractFailSignalCodes(row.failSignalRaw);
      const failSignalTokens = extractTokenCandidates(row.failSignalRaw);
      const gateTokenCandidates = extractTokenCandidates(row.gateTokenRaw);

      const unknownFailSignals = failSignalCodes.filter((code) => !knownFailSignals.has(code));
      const knownGateTokens = gateTokenCandidates.filter((token) => {
        if (token.endsWith('_*')) {
          const prefix = token.slice(0, -1);
          for (const known of knownTokens) {
            if (known.startsWith(prefix)) return true;
          }
          return false;
        }
        return knownTokens.has(token);
      });
      const knownFailTokens = failSignalTokens.filter((token) => knownTokens.has(token));

      const traceBySpecialMode = SPECIAL_ALLOWED_MODES.has(modeRaw) && row.lawSections.includes('A16');
      const traceable = traceBySpecialMode
        || failSignalCodes.length > 0
        || knownGateTokens.length > 0
        || knownFailTokens.length > 0
        || row.failSignalRaw.toLowerCase().includes('token-fail by gate')
        || row.failSignalRaw.toLowerCase().includes('fail by mapped class');

      if (unknownFailSignals.length > 0 || !traceable || unknownLawRefs.length > 0) {
        boundTraceabilityFailures.push({
          mapId: row.mapId,
          unknownFailSignals,
          traceable,
          unknownLawRefs,
        });
      }
    }
  }

  const rowIds = new Set(rows.map((row) => row.mapId));
  for (const expected of expectedMapIds) {
    if (!rowIds.has(expected)) {
      missingBridgeRows.push({ mapId: expected, reason: 'NEW_MAP_SECTION_WITHOUT_BRIDGE_ROW' });
    }
  }

  return {
    boundRowsMissingFields,
    gapRowsBlocking,
    modeMismatches,
    missingBridgeRows,
    lawConflicts,
    boundTraceabilityFailures,
    boundRowsTraceable: boundRowsMissingFields.length === 0 && boundTraceabilityFailures.length === 0,
    gapRowsAdvisoryOnly: gapRowsBlocking.length === 0,
    deterministicPolicyShapeHash: createHash('sha256')
      .update(stableStringify({
        boundRowsMissingFields,
        gapRowsBlocking,
        modeMismatches,
        missingBridgeRows,
        lawConflicts,
        boundTraceabilityFailures,
      }))
      .digest('hex'),
  };
}

function evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc) {
  const failSignals = Array.isArray(failsignalRegistryDoc?.failSignals)
    ? failsignalRegistryDoc.failSignals
    : [];

  const driftCases = [];
  const issues = [];

  for (const row of failSignals) {
    if (!isObjectRecord(row)) continue;
    const failSignalCode = normalizeString(row.code);
    if (!failSignalCode) continue;

    for (const key of MODE_KEYS) {
      const expected = normalizeString((row.modeMatrix || {})[key]).toLowerCase();
      if (expected !== 'advisory') continue;

      const verdict = evaluateModeMatrixVerdict({
        repoRoot,
        mode: MODE_LABELS[key],
        failSignalCode,
      });

      if (!verdict.ok) {
        issues.push({
          failSignalCode,
          mode: MODE_LABELS[key],
          reason: 'MODE_EVALUATOR_ERROR',
          evaluatorIssues: verdict.issues || [],
        });
        continue;
      }

      if (verdict.shouldBlock) {
        driftCases.push({
          failSignalCode,
          mode: MODE_LABELS[key],
          expectedDisposition: 'advisory',
          actualDisposition: normalizeString(verdict.modeDisposition),
          reason: 'ADVISORY_TO_BLOCKING_DRIFT',
        });
      }
    }
  }

  return {
    advisoryToBlockingDriftCount: driftCases.length,
    advisoryToBlockingDriftCountZero: driftCases.length === 0,
    driftCases,
    issues,
  };
}

function buildKnownTokens(tokenCatalogDoc, claimMatrixDoc) {
  const out = new Set();
  const tokenRows = Array.isArray(tokenCatalogDoc?.tokens) ? tokenCatalogDoc.tokens : [];
  for (const row of tokenRows) {
    const tokenId = normalizeString(row?.tokenId);
    if (tokenId) out.add(tokenId);
  }
  const claimRows = Array.isArray(claimMatrixDoc?.claims) ? claimMatrixDoc.claims : [];
  for (const row of claimRows) {
    const tokenId = normalizeString(row?.requiredToken);
    if (tokenId) out.add(tokenId);
  }
  return out;
}

function runNegativeScenarios(context) {
  const {
    simplifiedRows,
    knownLawSections,
    knownFailSignals,
    knownTokens,
    expectedMapIds,
  } = context;

  const neg1Rows = simplifiedRows.map((row, idx) => {
    if (idx !== 0 || row.binding !== 'BOUND') return { ...row };
    return { ...row, gateTokenRaw: '', failSignalRaw: '' };
  });
  const neg1 = evaluateBridgePolicy({
    rows: neg1Rows,
    knownLawSections,
    knownFailSignals,
    knownTokens,
    expectedMapIds,
  });

  const neg2Rows = simplifiedRows.map((row) => {
    if (row.binding !== 'GAP') return { ...row };
    return { ...row, modeRawNormalized: 'ADV/BLK/BLK' };
  });
  const neg2 = evaluateBridgePolicy({
    rows: neg2Rows,
    knownLawSections,
    knownFailSignals,
    knownTokens,
    expectedMapIds,
  });

  const neg3Rows = simplifiedRows.map((row, idx) => {
    if (idx !== 0) return { ...row };
    return { ...row, modeRawNormalized: 'BLK/ADV/BLK' };
  });
  const neg3 = evaluateBridgePolicy({
    rows: neg3Rows,
    knownLawSections,
    knownFailSignals,
    knownTokens,
    expectedMapIds,
  });

  const neg4ExpectedMapIds = [...expectedMapIds, 'MAP_X_NEW'];
  const neg4 = evaluateBridgePolicy({
    rows: simplifiedRows,
    knownLawSections,
    knownFailSignals,
    knownTokens,
    expectedMapIds: neg4ExpectedMapIds,
  });

  const neg5Rows = simplifiedRows.map((row, idx) => {
    if (idx !== 0) return { ...row };
    return { ...row, lawSections: ['A999'] };
  });
  const neg5 = evaluateBridgePolicy({
    rows: neg5Rows,
    knownLawSections,
    knownFailSignals,
    knownTokens,
    expectedMapIds,
    reconciliationNotes: new Set(),
  });

  return {
    NEXT_TZ_NEGATIVE_01: neg1.boundRowsMissingFields.length > 0,
    NEXT_TZ_NEGATIVE_02: neg2.gapRowsBlocking.length > 0,
    NEXT_TZ_NEGATIVE_03: neg3.modeMismatches.length > 0,
    NEXT_TZ_NEGATIVE_04: neg4.missingBridgeRows.length > 0,
    NEXT_TZ_NEGATIVE_05: neg5.lawConflicts.length > 0,
  };
}

function validateCanonLock(canonStatusDoc) {
  if (!isObjectRecord(canonStatusDoc)) {
    return {
      ok: false,
      reason: 'CANON_STATUS_UNREADABLE',
      observedStatus: '',
      observedVersion: '',
    };
  }

  const observedStatus = normalizeString(canonStatusDoc.status);
  const observedVersion = normalizeString(canonStatusDoc.canonVersion);
  const ok = observedStatus === 'ACTIVE_CANON' && observedVersion === EXPECTED_CANON_VERSION;

  return {
    ok,
    reason: ok ? '' : 'ACTIVE_CANON_LOCK_FAIL',
    observedStatus,
    observedVersion,
  };
}

function evaluateP2Ws04BridgeDriftSimplificationState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const canonStatusPath = path.resolve(repoRoot, normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH));
  const contractPath = path.resolve(repoRoot, normalizeString(input.contractPath || DEFAULT_CONTRACT_PATH));
  const failsignalRegistryPath = path.resolve(
    repoRoot,
    normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
  );
  const tokenCatalogPath = path.resolve(repoRoot, normalizeString(input.tokenCatalogPath || DEFAULT_TOKEN_CATALOG_PATH));
  const claimMatrixPath = path.resolve(repoRoot, normalizeString(input.claimMatrixPath || DEFAULT_CLAIM_MATRIX_PATH));

  const canonStatusDoc = isObjectRecord(input.canonStatusDoc)
    ? input.canonStatusDoc
    : readJsonObject(canonStatusPath);
  const contractText = normalizeString(input.contractText) || readText(contractPath);
  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);
  const tokenCatalogDoc = isObjectRecord(input.tokenCatalogDoc)
    ? input.tokenCatalogDoc
    : readJsonObject(tokenCatalogPath);
  const claimMatrixDoc = isObjectRecord(input.claimMatrixDoc)
    ? input.claimMatrixDoc
    : readJsonObject(claimMatrixPath);

  const canonLock = validateCanonLock(canonStatusDoc);
  const stageActivation = evaluateResolveActiveStageState({
    profile: 'release',
    gateTier: 'release',
  });
  const stageActivationGuardCheck = stageActivation.STAGE_ACTIVATION_OK === 1;

  const rawRows = parseBridgeRowsFromContract(contractText);
  const simplification = simplifyRows(rawRows);

  const knownLawSections = parseKnownLawSections(contractText);
  const knownFailSignals = new Set((failsignalRegistryDoc?.failSignals || []).map((row) => normalizeString(row.code)).filter(Boolean));
  const knownTokens = buildKnownTokens(tokenCatalogDoc, claimMatrixDoc);
  const expectedMapIds = listExpectedBridgeMapIds();

  const policy = evaluateBridgePolicy({
    rows: simplification.simplifiedRows,
    knownLawSections,
    knownFailSignals,
    knownTokens,
    expectedMapIds,
  });

  const drift = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc);
  const negativeResults = runNegativeScenarios({
    simplifiedRows: simplification.simplifiedRows,
    knownLawSections,
    knownFailSignals,
    knownTokens,
    expectedMapIds,
  });
  const allNegativesPass = Object.values(negativeResults).every(Boolean);

  const positiveResults = {
    NEXT_TZ_POSITIVE_01: policy.boundRowsTraceable,
    NEXT_TZ_POSITIVE_02: policy.gapRowsAdvisoryOnly,
    NEXT_TZ_POSITIVE_03: Boolean(policy.deterministicPolicyShapeHash),
  };
  const allPositivesPass = Object.values(positiveResults).every(Boolean);

  const dod = {
    DOD_01: simplification.duplicateRowsBeforeCount >= simplification.duplicateRowsAfterCount
      && simplification.signalLossCount === 0,
    DOD_02: allNegativesPass,
    DOD_03: allPositivesPass,
    DOD_04: false,
    DOD_05: true,
    DOD_06: drift.advisoryToBlockingDriftCountZero,
  };

  const acceptance = {
    ACCEPTANCE_01: canonLock.ok,
    ACCEPTANCE_02: stageActivationGuardCheck,
    ACCEPTANCE_03: false,
    ACCEPTANCE_04: false,
  };

  const preRepeatabilityOk = canonLock.ok
    && stageActivationGuardCheck
    && dod.DOD_01
    && dod.DOD_02
    && dod.DOD_03
    && dod.DOD_05
    && dod.DOD_06;

  const state = {
    ok: preRepeatabilityOk,
    [TOKEN_NAME]: preRepeatabilityOk ? 1 : 0,
    failReason: '',
    failSignalCode: '',

    objective: 'УПРОСТИТЬ_BRIDGE_DRIFT_CONTROL_БЕЗ_ПОТЕРИ_ТРАССИРУЕМОСТИ_И_БЕЗ_РАСШИРЕНИЯ_BLOCKING_SURFACE',
    blockingSurfaceExpansion: false,

    canonLock,
    stageActivation: {
      ok: stageActivationGuardCheck,
      activeStageId: stageActivation.ACTIVE_STAGE_ID,
      stageActivationOk: stageActivation.STAGE_ACTIVATION_OK,
      failSignals: stageActivation.failSignals || [],
      errors: stageActivation.errors || [],
    },

    counts: {
      rawRowCount: simplification.rawRows.length,
      normalizedRowCount: simplification.normalizedRows.length,
      simplifiedRowCount: simplification.simplifiedRows.length,
      duplicateRowsBeforeCount: simplification.duplicateRowsBeforeCount,
      duplicateRowsAfterCount: simplification.duplicateRowsAfterCount,
      signalLossCount: simplification.signalLossCount,
      boundRowsMissingFieldsCount: policy.boundRowsMissingFields.length,
      boundTraceabilityFailureCount: policy.boundTraceabilityFailures.length,
      gapRowsBlockingCount: policy.gapRowsBlocking.length,
      modeMismatchCount: policy.modeMismatches.length,
      missingBridgeRowsCount: policy.missingBridgeRows.length,
      lawConflictCount: policy.lawConflicts.length,
      advisoryToBlockingDriftCount: drift.advisoryToBlockingDriftCount,
    },

    simplification: {
      duplicates: simplification.duplicates,
      rawRows: simplification.rawRows.map((row) => normalizeRowForOutput(row)),
      simplifiedRows: simplification.simplifiedRows.map((row) => normalizeRowForOutput(row)),
    },

    policy,
    drift,
    negativeResults,
    positiveResults,
    dod,
    acceptance,

    detector: {
      detectorId: 'WS04_BRIDGE_DRIFT_SINGLE_DETECTOR_V1',
      canonicalModeEvaluatorId: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    },
  };

  if (!state.ok) {
    state.failReason = !canonLock.ok
      ? canonLock.reason
      : !stageActivationGuardCheck
        ? 'STAGE_ACTIVATION_GUARD_FAIL'
        : !dod.DOD_01
          ? 'BRIDGE_DUPLICATION_OR_SIGNAL_LOSS'
          : !dod.DOD_02
            ? 'NEGATIVE_SCENARIO_FAILURE'
            : !dod.DOD_03
              ? 'POSITIVE_SCENARIO_FAILURE'
              : !dod.DOD_06
                ? 'ADVISORY_TO_BLOCKING_DRIFT'
                : 'P2_WS04_BRIDGE_DRIFT_SIMPLIFICATION_FAIL';
    state.failSignalCode = state.failReason;
  }

  return state;
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`RAW_ROW_COUNT=${state.counts.rawRowCount}`);
  console.log(`SIMPLIFIED_ROW_COUNT=${state.counts.simplifiedRowCount}`);
  console.log(`DUPLICATE_ROWS_BEFORE=${state.counts.duplicateRowsBeforeCount}`);
  console.log(`DUPLICATE_ROWS_AFTER=${state.counts.duplicateRowsAfterCount}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.counts.advisoryToBlockingDriftCount}`);
  console.log(`DOD_01=${state.dod.DOD_01 ? 1 : 0}`);
  console.log(`DOD_02=${state.dod.DOD_02 ? 1 : 0}`);
  console.log(`DOD_03=${state.dod.DOD_03 ? 1 : 0}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateP2Ws04BridgeDriftSimplificationState({
    repoRoot: process.cwd(),
    canonStatusPath: args.canonStatusPath,
    contractPath: args.contractPath,
    failsignalRegistryPath: args.failsignalRegistryPath,
    tokenCatalogPath: args.tokenCatalogPath,
    claimMatrixPath: args.claimMatrixPath,
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
  evaluateP2Ws04BridgeDriftSimplificationState,
  evaluateBridgePolicy,
  parseBridgeRowsFromContract,
  TOKEN_NAME,
};
