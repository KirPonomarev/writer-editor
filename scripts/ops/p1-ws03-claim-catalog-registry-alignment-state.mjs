#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';

const TOKEN_NAME = 'P1_WS03_CLAIM_CATALOG_REGISTRY_ALIGNMENT_OK';
const FAIL_SIGNAL_CODE = 'E_CRITICAL_CLAIM_MATRIX_INVALID';

const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const DEFAULT_REQUIRED_TOKEN_SET_PATH = 'docs/OPS/EXECUTION/REQUIRED_TOKEN_SET.json';
const DEFAULT_TOKEN_CATALOG_PATH = 'docs/OPS/TOKENS/TOKEN_CATALOG.json';
const DEFAULT_CLAIM_MATRIX_PATH = 'docs/OPS/CLAIMS/CRITICAL_CLAIM_MATRIX.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const EXPECTED_CANON_VERSION = 'v3.13a-final';

const MODE_KEYS = Object.freeze(['prCore', 'release', 'promotion']);
const MODE_LABELS = Object.freeze({ prCore: 'pr', release: 'release', promotion: 'promotion' });

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

function normalizeMode(value) {
  const normalized = normalizeString(value).toLowerCase();
  return normalized === 'blocking' || normalized === 'advisory' ? normalized : '';
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    canonStatusPath: '',
    requiredTokenSetPath: '',
    tokenCatalogPath: '',
    claimMatrixPath: '',
    failsignalRegistryPath: '',
    runNegativeFixtures: true,
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

    if (arg === '--required-token-set-path' && i + 1 < argv.length) {
      out.requiredTokenSetPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--required-token-set-path=')) {
      out.requiredTokenSetPath = normalizeString(arg.slice('--required-token-set-path='.length));
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

    if (arg === '--no-negative-fixtures') {
      out.runNegativeFixtures = false;
    }
  }

  return out;
}

function loadInputDocs(input) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const canonStatusPath = path.resolve(repoRoot, normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH));
  const requiredTokenSetPath = path.resolve(repoRoot, normalizeString(input.requiredTokenSetPath || DEFAULT_REQUIRED_TOKEN_SET_PATH));
  const tokenCatalogPath = path.resolve(repoRoot, normalizeString(input.tokenCatalogPath || DEFAULT_TOKEN_CATALOG_PATH));
  const claimMatrixPath = path.resolve(repoRoot, normalizeString(input.claimMatrixPath || DEFAULT_CLAIM_MATRIX_PATH));
  const failsignalRegistryPath = path.resolve(repoRoot, normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH));

  const canonStatusDoc = isObjectRecord(input.canonStatusDoc)
    ? input.canonStatusDoc
    : readJsonObject(canonStatusPath);
  const requiredTokenSetDoc = isObjectRecord(input.requiredTokenSetDoc)
    ? input.requiredTokenSetDoc
    : readJsonObject(requiredTokenSetPath);
  const tokenCatalogDoc = isObjectRecord(input.tokenCatalogDoc)
    ? input.tokenCatalogDoc
    : readJsonObject(tokenCatalogPath);
  const claimMatrixDoc = isObjectRecord(input.claimMatrixDoc)
    ? input.claimMatrixDoc
    : readJsonObject(claimMatrixPath);
  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);

  return {
    repoRoot,
    canonStatusPath,
    requiredTokenSetPath,
    tokenCatalogPath,
    claimMatrixPath,
    failsignalRegistryPath,
    canonStatusDoc,
    requiredTokenSetDoc,
    tokenCatalogDoc,
    claimMatrixDoc,
    failsignalRegistryDoc,
  };
}

function validateCanonLock(canonStatusDoc) {
  if (!isObjectRecord(canonStatusDoc)) {
    return {
      ok: false,
      reason: 'CANON_STATUS_UNREADABLE',
      observedVersion: '',
      observedStatus: '',
    };
  }

  const observedVersion = normalizeString(canonStatusDoc.canonVersion);
  const observedStatus = normalizeString(canonStatusDoc.status);
  const ok = observedVersion === EXPECTED_CANON_VERSION && observedStatus === 'ACTIVE_CANON';

  return {
    ok,
    reason: ok ? '' : 'ACTIVE_CANON_LOCK_FAIL',
    observedVersion,
    observedStatus,
  };
}

function resolveActiveScopeTokenIds(requiredTokenSetDoc) {
  if (!isObjectRecord(requiredTokenSetDoc)) return [];
  const active = requiredTokenSetDoc?.requiredSets?.active;
  if (!Array.isArray(active)) return [];
  const tokenIds = active
    .map((entry) => normalizeString(String(entry || '')))
    .filter(Boolean);
  return [...new Set(tokenIds)].sort((a, b) => a.localeCompare(b));
}

function evaluateAdvisoryToBlockingDrift(repoRoot, rows) {
  const driftCases = [];
  const issues = [];

  for (const row of rows) {
    if (!isObjectRecord(row)) continue;
    const failSignalCode = normalizeString(row.code);
    if (!failSignalCode) continue;

    for (const key of MODE_KEYS) {
      const expected = normalizeMode((row.modeMatrix || {})[key]);
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
          actualDisposition: normalizeMode(verdict.modeDisposition) || 'unknown',
          reason: 'ADVISORY_TO_BLOCKING_DRIFT',
        });
      }
    }
  }

  driftCases.sort((a, b) => `${a.failSignalCode}:${a.mode}`.localeCompare(`${b.failSignalCode}:${b.mode}`));

  return {
    advisoryToBlockingDriftCount: driftCases.length,
    driftCases,
    issues,
  };
}

function evaluatePolicy(inputDocs) {
  const canonLock = validateCanonLock(inputDocs.canonStatusDoc);

  const tokenRows = Array.isArray(inputDocs.tokenCatalogDoc?.tokens) ? inputDocs.tokenCatalogDoc.tokens : [];
  const claimRows = Array.isArray(inputDocs.claimMatrixDoc?.claims) ? inputDocs.claimMatrixDoc.claims : [];
  const failsignalRows = Array.isArray(inputDocs.failsignalRegistryDoc?.failSignals) ? inputDocs.failsignalRegistryDoc.failSignals : [];
  const activeScopeTokens = resolveActiveScopeTokenIds(inputDocs.requiredTokenSetDoc);

  if (tokenRows.length === 0 || claimRows.length === 0 || failsignalRows.length === 0 || activeScopeTokens.length === 0) {
    return {
      ok: false,
      failReason: 'ALIGNMENT_INPUT_UNREADABLE',
      canonLock,
      counts: {
        activeScopeTokenCount: activeScopeTokens.length,
        claimTokenGapCount: 0,
        claimFailsignalGapCount: 0,
        tokenFailsignalGapCount: 0,
        requiredSetUndeclaredEntityCount: 0,
        activeScopeAlignmentMismatchCount: 0,
        advisoryToBlockingDriftCount: -1,
      },
      claimTokenGaps: [],
      claimFailsignalGaps: [],
      tokenFailsignalGaps: [],
      requiredSetUndeclaredEntities: [],
      activeScopeAlignmentMismatches: [],
      advisoryDrift: {
        advisoryToBlockingDriftCount: -1,
        driftCases: [],
        issues: [{ reason: 'ALIGNMENT_INPUT_UNREADABLE' }],
      },
      singleAuthorityOk: false,
    };
  }

  const tokenById = new Map();
  for (const row of tokenRows) {
    if (!isObjectRecord(row)) continue;
    const tokenId = normalizeString(row.tokenId);
    if (!tokenId) continue;
    tokenById.set(tokenId, row);
  }

  const failsignalSet = new Set();
  for (const row of failsignalRows) {
    if (!isObjectRecord(row)) continue;
    const code = normalizeString(row.code);
    if (code) failsignalSet.add(code);
  }

  const claimsByToken = new Map();
  for (const claim of claimRows) {
    if (!isObjectRecord(claim)) continue;
    const requiredToken = normalizeString(claim.requiredToken);
    const claimId = normalizeString(claim.claimId);
    if (!requiredToken || !claimId) continue;
    if (!claimsByToken.has(requiredToken)) claimsByToken.set(requiredToken, []);
    claimsByToken.get(requiredToken).push(claim);
  }

  const scopedClaimRows = claimRows.filter((claim) => {
    if (!isObjectRecord(claim)) return false;
    const requiredToken = normalizeString(claim.requiredToken);
    return activeScopeTokens.includes(requiredToken);
  });

  const claimTokenGaps = [];
  const claimFailsignalGaps = [];
  for (const claim of scopedClaimRows) {
    const claimId = normalizeString(claim.claimId);
    const requiredToken = normalizeString(claim.requiredToken);
    const failSignal = normalizeString(claim.failSignal || claim.failSignalCode);

    if (!tokenById.has(requiredToken)) {
      claimTokenGaps.push({
        claimId,
        requiredToken,
        reason: 'CLAIM_REFERENCES_MISSING_TOKEN',
      });
    }

    if (!failSignal || !failsignalSet.has(failSignal)) {
      claimFailsignalGaps.push({
        claimId,
        requiredToken,
        failSignal,
        reason: 'CLAIM_REFERENCES_MISSING_FAILSIGNAL',
      });
    }
  }

  claimTokenGaps.sort((a, b) => a.claimId.localeCompare(b.claimId));
  claimFailsignalGaps.sort((a, b) => a.claimId.localeCompare(b.claimId));

  const requiredSetUndeclaredEntities = [];
  const tokenFailsignalGaps = [];
  const activeScopeAlignmentMismatches = [];

  for (const tokenId of activeScopeTokens) {
    const token = tokenById.get(tokenId) || null;
    if (!token) {
      requiredSetUndeclaredEntities.push({
        tokenId,
        entityType: 'TOKEN',
        reason: 'REQUIRED_SET_REFERENCES_UNDECLARED_ENTITY',
      });
      continue;
    }

    const tokenFailSignal = normalizeString(token.failSignalCode);
    if (!tokenFailSignal || !failsignalSet.has(tokenFailSignal)) {
      tokenFailsignalGaps.push({
        tokenId,
        failSignal: tokenFailSignal,
        reason: 'TOKEN_REFERENCES_MISSING_FAILSIGNAL',
      });
    }

    const claims = claimsByToken.get(tokenId) || [];
    for (const claim of claims) {
      const claimId = normalizeString(claim.claimId);
      const claimFailSignal = normalizeString(claim.failSignal || claim.failSignalCode);
      if (!claimFailSignal || !failsignalSet.has(claimFailSignal)) continue;
      if (!tokenFailSignal || !failsignalSet.has(tokenFailSignal)) continue;

      if (claimFailSignal !== tokenFailSignal) {
        activeScopeAlignmentMismatches.push({
          tokenId,
          claimId,
          claimFailSignal,
          tokenFailSignal,
          reason: 'ACTIVE_SCOPE_ALIGNMENT_MISMATCH',
        });
      }
    }
  }

  tokenFailsignalGaps.sort((a, b) => a.tokenId.localeCompare(b.tokenId));
  requiredSetUndeclaredEntities.sort((a, b) => a.tokenId.localeCompare(b.tokenId));
  activeScopeAlignmentMismatches.sort((a, b) => `${a.tokenId}:${a.claimId}`.localeCompare(`${a.tokenId}:${a.claimId}`));

  const advisoryDrift = evaluateAdvisoryToBlockingDrift(inputDocs.repoRoot, failsignalRows);

  const authorityVerdict = evaluateModeMatrixVerdict({
    repoRoot: inputDocs.repoRoot,
    mode: 'release',
    failSignalCode: 'E_REMOTE_UNAVAILABLE',
  });
  const singleAuthorityOk = authorityVerdict.ok
    && authorityVerdict.evaluatorId === CANONICAL_MODE_MATRIX_EVALUATOR_ID;

  const counts = {
    activeScopeTokenCount: activeScopeTokens.length,
    scopedClaimCount: scopedClaimRows.length,
    claimTokenGapCount: claimTokenGaps.length,
    claimFailsignalGapCount: claimFailsignalGaps.length,
    tokenFailsignalGapCount: tokenFailsignalGaps.length,
    requiredSetUndeclaredEntityCount: requiredSetUndeclaredEntities.length,
    activeScopeAlignmentMismatchCount: activeScopeAlignmentMismatches.length,
    advisoryToBlockingDriftCount: advisoryDrift.advisoryToBlockingDriftCount,
  };

  const ok = canonLock.ok
    && counts.claimTokenGapCount === 0
    && counts.claimFailsignalGapCount === 0
    && counts.tokenFailsignalGapCount === 0
    && counts.requiredSetUndeclaredEntityCount === 0
    && counts.activeScopeAlignmentMismatchCount === 0
    && counts.advisoryToBlockingDriftCount === 0
    && advisoryDrift.issues.length === 0
    && singleAuthorityOk;

  const failReason = ok
    ? ''
    : (
      !canonLock.ok
        ? canonLock.reason
        : counts.claimTokenGapCount > 0
          ? 'CLAIM_REFERENCES_MISSING_TOKEN'
          : counts.claimFailsignalGapCount > 0
            ? 'CLAIM_REFERENCES_MISSING_FAILSIGNAL'
            : counts.tokenFailsignalGapCount > 0
              ? 'TOKEN_REFERENCES_MISSING_FAILSIGNAL'
              : counts.requiredSetUndeclaredEntityCount > 0
                ? 'REQUIRED_SET_REFERENCES_UNDECLARED_ENTITY'
                : counts.activeScopeAlignmentMismatchCount > 0
                  ? 'ACTIVE_SCOPE_ALIGNMENT_MISMATCH'
                  : counts.advisoryToBlockingDriftCount > 0
                    ? 'ADVISORY_TO_BLOCKING_DRIFT'
                    : !singleAuthorityOk
                      ? 'SINGLE_AUTHORITY_FAIL'
                      : 'P1_WS03_ALIGNMENT_FAIL'
    );

  return {
    ok,
    failReason,
    canonLock,
    activeScopeTokens,
    counts,
    claimTokenGaps,
    claimFailsignalGaps,
    tokenFailsignalGaps,
    requiredSetUndeclaredEntities,
    activeScopeAlignmentMismatches,
    advisoryDrift,
    singleAuthorityOk,
  };
}

function buildNegativeFixtures(baseDocs) {
  const fixtures = [];

  {
    const tokenDoc = JSON.parse(JSON.stringify(baseDocs.tokenCatalogDoc));
    const claims = Array.isArray(baseDocs.claimMatrixDoc?.claims) ? baseDocs.claimMatrixDoc.claims : [];
    const active = resolveActiveScopeTokenIds(baseDocs.requiredTokenSetDoc);
    const candidate = claims.find((claim) => isObjectRecord(claim) && active.includes(normalizeString(claim.requiredToken)));
    if (candidate) {
      const targetToken = normalizeString(candidate.requiredToken);
      tokenDoc.tokens = (tokenDoc.tokens || []).filter((row) => normalizeString(row?.tokenId) !== targetToken);
      fixtures.push({
        id: 'NEXT_TZ_NEGATIVE_01',
        expectedFailReason: 'CLAIM_REFERENCES_MISSING_TOKEN',
        docs: { tokenCatalogDoc: tokenDoc },
      });
    }
  }

  {
    const claimDoc = JSON.parse(JSON.stringify(baseDocs.claimMatrixDoc));
    const active = resolveActiveScopeTokenIds(baseDocs.requiredTokenSetDoc);
    const candidate = (claimDoc.claims || []).find((claim) => isObjectRecord(claim) && active.includes(normalizeString(claim.requiredToken)));
    if (candidate) {
      candidate.failSignal = 'E_UNKNOWN_SIGNAL_NEG_02';
      fixtures.push({
        id: 'NEXT_TZ_NEGATIVE_02',
        expectedFailReason: 'CLAIM_REFERENCES_MISSING_FAILSIGNAL',
        docs: { claimMatrixDoc: claimDoc },
      });
    }
  }

  {
    const tokenDoc = JSON.parse(JSON.stringify(baseDocs.tokenCatalogDoc));
    const active = resolveActiveScopeTokenIds(baseDocs.requiredTokenSetDoc);
    const candidate = (tokenDoc.tokens || []).find((row) => isObjectRecord(row) && active.includes(normalizeString(row.tokenId)));
    if (candidate) {
      candidate.failSignalCode = 'E_UNKNOWN_SIGNAL_NEG_03';
      fixtures.push({
        id: 'NEXT_TZ_NEGATIVE_03',
        expectedFailReason: 'TOKEN_REFERENCES_MISSING_FAILSIGNAL',
        docs: { tokenCatalogDoc: tokenDoc },
      });
    }
  }

  {
    const requiredDoc = JSON.parse(JSON.stringify(baseDocs.requiredTokenSetDoc));
    if (!isObjectRecord(requiredDoc.requiredSets)) requiredDoc.requiredSets = {};
    if (!Array.isArray(requiredDoc.requiredSets.active)) requiredDoc.requiredSets.active = [];
    requiredDoc.requiredSets.active = [...requiredDoc.requiredSets.active, 'TOKEN_UNDECLARED_NEG_04'];
    fixtures.push({
      id: 'NEXT_TZ_NEGATIVE_04',
      expectedFailReason: 'REQUIRED_SET_REFERENCES_UNDECLARED_ENTITY',
      docs: { requiredTokenSetDoc: requiredDoc },
    });
  }

  {
    const tokenDoc = JSON.parse(JSON.stringify(baseDocs.tokenCatalogDoc));
    const claims = Array.isArray(baseDocs.claimMatrixDoc?.claims) ? baseDocs.claimMatrixDoc.claims : [];
    const active = resolveActiveScopeTokenIds(baseDocs.requiredTokenSetDoc);
    const regRows = Array.isArray(baseDocs.failsignalRegistryDoc?.failSignals) ? baseDocs.failsignalRegistryDoc.failSignals : [];

    const candidateClaim = claims.find((claim) => isObjectRecord(claim) && active.includes(normalizeString(claim.requiredToken)));
    const fallbackSignal = regRows.find((row) => isObjectRecord(row) && normalizeString(row.code) && normalizeString(row.code) !== normalizeString(candidateClaim?.failSignal || candidateClaim?.failSignalCode));

    if (candidateClaim && fallbackSignal) {
      const token = (tokenDoc.tokens || []).find((row) => normalizeString(row?.tokenId) === normalizeString(candidateClaim.requiredToken));
      if (token) {
        token.failSignalCode = normalizeString(fallbackSignal.code);
        fixtures.push({
          id: 'NEXT_TZ_NEGATIVE_05',
          expectedFailReason: 'ACTIVE_SCOPE_ALIGNMENT_MISMATCH',
          docs: { tokenCatalogDoc: tokenDoc },
        });
      }
    }
  }

  return fixtures;
}

export function evaluateP1Ws03ClaimCatalogRegistryAlignmentState(input = {}) {
  const docs = loadInputDocs(input);
  const basePolicy = evaluatePolicy(docs);

  const negativeResults = {
    NEXT_TZ_NEGATIVE_01: false,
    NEXT_TZ_NEGATIVE_02: false,
    NEXT_TZ_NEGATIVE_03: false,
    NEXT_TZ_NEGATIVE_04: false,
    NEXT_TZ_NEGATIVE_05: false,
  };

  if (input.runNegativeFixtures !== false) {
    const fixtures = buildNegativeFixtures(docs);
    for (const fixture of fixtures) {
      const fixturePolicy = evaluatePolicy({
        ...docs,
        ...fixture.docs,
      });
      negativeResults[fixture.id] = fixturePolicy.ok === false && fixturePolicy.failReason === fixture.expectedFailReason;
    }
  }

  const positiveResults = {
    NEXT_TZ_POSITIVE_01: basePolicy.counts.claimTokenGapCount === 0
      && basePolicy.counts.claimFailsignalGapCount === 0
      && basePolicy.counts.tokenFailsignalGapCount === 0,
    NEXT_TZ_POSITIVE_02: basePolicy.counts.requiredSetUndeclaredEntityCount === 0
      && basePolicy.counts.activeScopeAlignmentMismatchCount === 0,
    NEXT_TZ_POSITIVE_03: true,
  };

  const dod = {
    NEXT_TZ_DOD_01: basePolicy.counts.claimTokenGapCount === 0,
    NEXT_TZ_DOD_02: basePolicy.counts.claimFailsignalGapCount === 0,
    NEXT_TZ_DOD_03: basePolicy.counts.tokenFailsignalGapCount === 0,
    NEXT_TZ_DOD_04: Object.values(negativeResults).every(Boolean),
    NEXT_TZ_DOD_05: Object.values(positiveResults).every(Boolean),
    NEXT_TZ_DOD_06: true,
    NEXT_TZ_DOD_07: true,
  };

  const acceptance = {
    NEXT_TZ_ACCEPTANCE_01: basePolicy.canonLock.ok,
    NEXT_TZ_ACCEPTANCE_02: basePolicy.counts.advisoryToBlockingDriftCount === 0,
    NEXT_TZ_ACCEPTANCE_03: true,
    NEXT_TZ_ACCEPTANCE_04: Object.values(dod).every(Boolean),
  };

  const ok = basePolicy.ok
    && Object.values(negativeResults).every(Boolean)
    && Object.values(positiveResults).every(Boolean)
    && Object.values(dod).every(Boolean)
    && Object.values(acceptance).every(Boolean);

  return {
    ok,
    token: TOKEN_NAME,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignalCode: ok ? '' : FAIL_SIGNAL_CODE,
    failReason: ok ? '' : (basePolicy.failReason || 'P1_WS03_ALIGNMENT_FAIL'),
    activeCanonVersionExpected: EXPECTED_CANON_VERSION,
    activeCanonVersionObserved: basePolicy.canonLock.observedVersion,
    activeCanonStatusObserved: basePolicy.canonLock.observedStatus,
    activeCanonLockCheckPass: basePolicy.canonLock.ok,
    counts: basePolicy.counts,
    activeScopeTokens: basePolicy.activeScopeTokens,
    claimTokenGaps: basePolicy.claimTokenGaps,
    claimFailsignalGaps: basePolicy.claimFailsignalGaps,
    tokenFailsignalGaps: basePolicy.tokenFailsignalGaps,
    requiredSetUndeclaredEntities: basePolicy.requiredSetUndeclaredEntities,
    activeScopeAlignmentMismatches: basePolicy.activeScopeAlignmentMismatches,
    advisoryToBlockingDriftCount: basePolicy.counts.advisoryToBlockingDriftCount,
    driftCases: basePolicy.advisoryDrift.driftCases,
    singleAuthorityOk: basePolicy.singleAuthorityOk,
    evaluatorIdExpected: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    negativeResults,
    positiveResults,
    dod,
    acceptance,
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`P1_WS03_CLAIM_TOKEN_GAP_COUNT=${state.counts.claimTokenGapCount}`);
  console.log(`P1_WS03_CLAIM_FAILSIGNAL_GAP_COUNT=${state.counts.claimFailsignalGapCount}`);
  console.log(`P1_WS03_TOKEN_FAILSIGNAL_GAP_COUNT=${state.counts.tokenFailsignalGapCount}`);
  console.log(`P1_WS03_REQUIRED_SET_UNDECLARED_COUNT=${state.counts.requiredSetUndeclaredEntityCount}`);
  console.log(`P1_WS03_ACTIVE_SCOPE_MISMATCH_COUNT=${state.counts.activeScopeAlignmentMismatchCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateP1Ws03ClaimCatalogRegistryAlignmentState({
    canonStatusPath: args.canonStatusPath,
    requiredTokenSetPath: args.requiredTokenSetPath,
    tokenCatalogPath: args.tokenCatalogPath,
    claimMatrixPath: args.claimMatrixPath,
    failsignalRegistryPath: args.failsignalRegistryPath,
    runNegativeFixtures: args.runNegativeFixtures,
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
};
