#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';

const TOKEN_NAME = 'P1_WS01_FAILSIGNAL_SEMANTIC_DEDUP_OK';
const FAIL_SIGNAL_CODE = 'E_FAILSIGNAL_SEMANTIC_COLLISION';

const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_TOKEN_CATALOG_PATH = 'docs/OPS/TOKENS/TOKEN_CATALOG.json';
const DEFAULT_CLAIM_MATRIX_PATH = 'docs/OPS/CLAIMS/CRITICAL_CLAIM_MATRIX.json';
const DEFAULT_MIGRATION_MAP_PATH = 'docs/OPS/STATUS/FAILSIGNAL_SEMANTIC_MIGRATION_MAP_v1.json';
const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const EXPECTED_CANON_VERSION = 'v3.13a-final';

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

function normalizeModeDisposition(value) {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === 'blocking' || normalized === 'advisory') return normalized;
  return '';
}

function resolveReleaseDisposition(row) {
  const modeMatrix = isObjectRecord(row?.modeMatrix) ? row.modeMatrix : {};
  const explicit = normalizeModeDisposition(modeMatrix.release);
  if (explicit) return explicit;
  return row?.blocking === true ? 'blocking' : 'advisory';
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    failsignalRegistryPath: '',
    tokenCatalogPath: '',
    claimMatrixPath: '',
    migrationMapPath: '',
    canonStatusPath: '',
    runNegativeFixtures: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--json') {
      out.json = true;
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
      continue;
    }

    if (arg === '--migration-map-path' && i + 1 < argv.length) {
      out.migrationMapPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--migration-map-path=')) {
      out.migrationMapPath = normalizeString(arg.slice('--migration-map-path='.length));
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

    if (arg === '--no-negative-fixtures') {
      out.runNegativeFixtures = false;
    }
  }

  return out;
}

function loadInputDocs(input) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const failsignalRegistryPath = path.resolve(repoRoot, normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH));
  const tokenCatalogPath = path.resolve(repoRoot, normalizeString(input.tokenCatalogPath || DEFAULT_TOKEN_CATALOG_PATH));
  const claimMatrixPath = path.resolve(repoRoot, normalizeString(input.claimMatrixPath || DEFAULT_CLAIM_MATRIX_PATH));
  const migrationMapPath = path.resolve(repoRoot, normalizeString(input.migrationMapPath || DEFAULT_MIGRATION_MAP_PATH));
  const canonStatusPath = path.resolve(repoRoot, normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH));

  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);
  const tokenCatalogDoc = isObjectRecord(input.tokenCatalogDoc)
    ? input.tokenCatalogDoc
    : readJsonObject(tokenCatalogPath);
  const claimMatrixDoc = isObjectRecord(input.claimMatrixDoc)
    ? input.claimMatrixDoc
    : readJsonObject(claimMatrixPath);
  const migrationMapDoc = isObjectRecord(input.migrationMapDoc)
    ? input.migrationMapDoc
    : readJsonObject(migrationMapPath);
  const canonStatusDoc = isObjectRecord(input.canonStatusDoc)
    ? input.canonStatusDoc
    : readJsonObject(canonStatusPath);

  return {
    repoRoot,
    failsignalRegistryPath,
    tokenCatalogPath,
    claimMatrixPath,
    migrationMapPath,
    canonStatusPath,
    failsignalRegistryDoc,
    tokenCatalogDoc,
    claimMatrixDoc,
    migrationMapDoc,
    canonStatusDoc,
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

function buildRegistryIndex(failsignalRows) {
  const byCode = new Map();
  for (const row of failsignalRows) {
    if (!isObjectRecord(row)) continue;
    const code = normalizeString(row.code);
    if (!code) continue;
    if (!byCode.has(code)) byCode.set(code, []);
    byCode.get(code).push(row);
  }
  return byCode;
}

function rowSemanticFingerprint(row) {
  const modeMatrix = isObjectRecord(row?.modeMatrix)
    ? {
      prCore: normalizeModeDisposition(row.modeMatrix.prCore) || 'advisory',
      release: normalizeModeDisposition(row.modeMatrix.release) || (row?.blocking ? 'blocking' : 'advisory'),
      promotion: normalizeModeDisposition(row.modeMatrix.promotion) || 'advisory',
    }
    : {
      prCore: row?.blocking ? 'blocking' : 'advisory',
      release: row?.blocking ? 'blocking' : 'advisory',
      promotion: row?.blocking ? 'blocking' : 'advisory',
    };

  return stableStringify({
    tier: normalizeString(row?.tier).toLowerCase() || 'release',
    modeMatrix,
    sourceBinding: normalizeString(row?.sourceBinding),
    negativeTestRef: normalizeString(row?.negativeTestRef),
  });
}

function evaluateSemanticCollisions(byCode) {
  const semanticCollisions = [];
  const duplicateDeclarations = [];
  for (const [code, rows] of byCode.entries()) {
    if (!Array.isArray(rows) || rows.length <= 1) continue;
    const fingerprints = [...new Set(rows.map((row) => rowSemanticFingerprint(row)))];
    if (fingerprints.length > 1) {
      semanticCollisions.push({
        failSignalCode: code,
        declarationCount: rows.length,
        semanticVariantCount: fingerprints.length,
        reason: 'DUPLICATE_FAILSIGNAL_MEANING',
      });
    } else {
      duplicateDeclarations.push({
        failSignalCode: code,
        declarationCount: rows.length,
        reason: 'DUPLICATE_FAILSIGNAL_DECLARATION',
      });
    }
  }
  semanticCollisions.sort((a, b) => a.failSignalCode.localeCompare(b.failSignalCode));
  duplicateDeclarations.sort((a, b) => a.failSignalCode.localeCompare(b.failSignalCode));
  return {
    semanticCollisions,
    duplicateDeclarations,
  };
}

function normalizeMigrationMap(doc) {
  if (!isObjectRecord(doc)) {
    return {
      aliasMappings: [],
      claimModeOverrides: [],
    };
  }

  const aliasMappings = Array.isArray(doc.aliasMappings)
    ? doc.aliasMappings.filter((entry) => isObjectRecord(entry))
      .map((entry) => ({
        aliasFailSignal: normalizeString(entry.aliasFailSignal),
        canonicalFailSignal: normalizeString(entry.canonicalFailSignal),
        rationale: normalizeString(entry.rationale),
      }))
      .filter((entry) => entry.aliasFailSignal && entry.canonicalFailSignal)
    : [];

  const claimModeOverrides = Array.isArray(doc.claimModeOverrides)
    ? doc.claimModeOverrides.filter((entry) => isObjectRecord(entry))
      .map((entry) => ({
        claimId: normalizeString(entry.claimId),
        requiredToken: normalizeString(entry.requiredToken),
        failSignal: normalizeString(entry.failSignal),
        expectedClaimDisposition: normalizeModeDisposition(entry.expectedClaimDisposition),
        registryReleaseDisposition: normalizeModeDisposition(entry.registryReleaseDisposition),
        rationale: normalizeString(entry.rationale),
      }))
      .filter((entry) => entry.claimId && entry.requiredToken && entry.failSignal)
    : [];

  return {
    aliasMappings,
    claimModeOverrides,
  };
}

function makeClaimOverrideKey(row) {
  return [
    normalizeString(row.claimId),
    normalizeString(row.requiredToken),
    normalizeString(row.failSignal),
    normalizeModeDisposition(row.expectedClaimDisposition),
    normalizeModeDisposition(row.registryReleaseDisposition),
  ].join('|');
}

function evaluateTokenToFailsignalUniqueness(tokenRows, byCode) {
  const unknown = [];
  const ambiguous = [];

  for (const token of tokenRows) {
    if (!isObjectRecord(token)) continue;
    const tokenId = normalizeString(token.tokenId);
    const failSignalCode = normalizeString(token.failSignalCode);
    if (!tokenId || !failSignalCode) continue;

    const declarations = byCode.get(failSignalCode) || [];
    if (declarations.length === 0) {
      unknown.push({ tokenId, failSignalCode, reason: 'TOKEN_FAILSIGNAL_NOT_DECLARED' });
      continue;
    }
    if (declarations.length > 1) {
      ambiguous.push({ tokenId, failSignalCode, declarationCount: declarations.length, reason: 'TOKEN_FAILSIGNAL_AMBIGUOUS' });
    }
  }

  unknown.sort((a, b) => a.tokenId.localeCompare(b.tokenId));
  ambiguous.sort((a, b) => a.tokenId.localeCompare(b.tokenId));

  return {
    unknown,
    ambiguous,
  };
}

function evaluateClaimAlignment(claimRows, tokenRows, byCode, migrationMap) {
  const tokenIds = new Set(tokenRows.map((row) => normalizeString(row.tokenId)).filter(Boolean));
  const scopedClaims = claimRows
    .filter((row) => isObjectRecord(row))
    .map((row) => ({
      claimId: normalizeString(row.claimId),
      requiredToken: normalizeString(row.requiredToken),
      failSignal: normalizeString(row.failSignal),
      blocking: row.blocking === true,
    }))
    .filter((row) => row.claimId && row.requiredToken && row.failSignal && tokenIds.has(row.requiredToken));

  const overrideSet = new Set(migrationMap.claimModeOverrides.map((entry) => makeClaimOverrideKey(entry)));
  const missingFailsignal = [];
  const unresolvedConflicts = [];
  const resolvedByMigration = [];

  for (const claim of scopedClaims) {
    const declarations = byCode.get(claim.failSignal) || [];
    if (declarations.length === 0) {
      missingFailsignal.push({
        claimId: claim.claimId,
        requiredToken: claim.requiredToken,
        failSignal: claim.failSignal,
        reason: 'CLAIM_FAILSIGNAL_NOT_DECLARED',
      });
      continue;
    }

    if (declarations.length > 1) {
      unresolvedConflicts.push({
        claimId: claim.claimId,
        requiredToken: claim.requiredToken,
        failSignal: claim.failSignal,
        expectedClaimDisposition: claim.blocking ? 'blocking' : 'advisory',
        registryReleaseDisposition: 'ambiguous',
        reason: 'CLAIM_FAILSIGNAL_AMBIGUOUS',
      });
      continue;
    }

    const expectedClaimDisposition = claim.blocking ? 'blocking' : 'advisory';
    const registryReleaseDisposition = resolveReleaseDisposition(declarations[0]);

    if (expectedClaimDisposition !== registryReleaseDisposition) {
      const key = makeClaimOverrideKey({
        claimId: claim.claimId,
        requiredToken: claim.requiredToken,
        failSignal: claim.failSignal,
        expectedClaimDisposition,
        registryReleaseDisposition,
      });

      const payload = {
        claimId: claim.claimId,
        requiredToken: claim.requiredToken,
        failSignal: claim.failSignal,
        expectedClaimDisposition,
        registryReleaseDisposition,
        reason: 'CLAIM_MODE_DISPOSITION_CONFLICT',
      };

      if (overrideSet.has(key)) {
        resolvedByMigration.push(payload);
      } else {
        unresolvedConflicts.push(payload);
      }
    }
  }

  missingFailsignal.sort((a, b) => a.claimId.localeCompare(b.claimId));
  unresolvedConflicts.sort((a, b) => a.claimId.localeCompare(b.claimId));
  resolvedByMigration.sort((a, b) => a.claimId.localeCompare(b.claimId));

  return {
    scopedClaimCount: scopedClaims.length,
    missingFailsignal,
    unresolvedConflicts,
    resolvedByMigration,
  };
}

function evaluateAliasMigrationCoverage(failsignalRows, migrationMap, byCode) {
  const aliasEntries = failsignalRows
    .filter((row) => isObjectRecord(row))
    .map((row) => ({
      code: normalizeString(row.code),
      semanticAliasOf: normalizeString(row.semanticAliasOf),
    }))
    .filter((row) => row.code && row.semanticAliasOf && row.semanticAliasOf !== row.code);

  const aliasMap = new Map();
  for (const entry of migrationMap.aliasMappings) {
    aliasMap.set(`${entry.aliasFailSignal}|${entry.canonicalFailSignal}`, entry);
  }

  const unresolvedAlias = [];
  for (const alias of aliasEntries) {
    const canonicalDeclared = byCode.has(alias.semanticAliasOf);
    const key = `${alias.code}|${alias.semanticAliasOf}`;
    const mapped = aliasMap.has(key);
    if (!mapped || !canonicalDeclared) {
      unresolvedAlias.push({
        aliasFailSignal: alias.code,
        canonicalFailSignal: alias.semanticAliasOf,
        mappingPresent: mapped,
        canonicalDeclared,
        reason: 'SEMANTIC_ALIAS_WITHOUT_MIGRATION_MAP',
      });
    }
  }

  unresolvedAlias.sort((a, b) => a.aliasFailSignal.localeCompare(b.aliasFailSignal));
  return {
    aliasEntries,
    unresolvedAlias,
  };
}

function evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRows) {
  const modePairs = [
    { mode: 'pr', key: 'prCore' },
    { mode: 'release', key: 'release' },
    { mode: 'promotion', key: 'promotion' },
  ];

  const driftCases = [];
  const issues = [];

  for (const row of failsignalRows) {
    if (!isObjectRecord(row)) continue;
    const failSignalCode = normalizeString(row.code);
    if (!failSignalCode) continue;

    for (const pair of modePairs) {
      const expectedDisposition = normalizeModeDisposition((row.modeMatrix || {})[pair.key]);
      if (expectedDisposition !== 'advisory') continue;

      const verdict = evaluateModeMatrixVerdict({
        repoRoot,
        mode: pair.mode,
        failSignalCode,
      });

      if (!verdict.ok) {
        issues.push({
          code: 'MODE_EVALUATOR_ERROR',
          failSignalCode,
          mode: pair.mode,
          evaluatorIssues: verdict.issues || [],
        });
        continue;
      }

      if (verdict.shouldBlock) {
        driftCases.push({
          failSignalCode,
          mode: pair.mode,
          expectedDisposition,
          actualDisposition: verdict.modeDisposition,
          actualShouldBlock: verdict.shouldBlock,
          reason: 'ADVISORY_TO_BLOCKING_DRIFT',
        });
      }
    }
  }

  driftCases.sort((a, b) => `${a.failSignalCode}:${a.mode}`.localeCompare(`${b.failSignalCode}:${b.mode}`));

  return {
    ok: issues.length === 0,
    advisoryToBlockingDriftCount: driftCases.length,
    driftCases,
    issues,
  };
}

function evaluatePolicyFromDocs(inputDocs) {
  const failsignalRows = Array.isArray(inputDocs.failsignalRegistryDoc?.failSignals)
    ? inputDocs.failsignalRegistryDoc.failSignals
    : [];
  const tokenRows = Array.isArray(inputDocs.tokenCatalogDoc?.tokens)
    ? inputDocs.tokenCatalogDoc.tokens
    : [];
  const claimRows = Array.isArray(inputDocs.claimMatrixDoc?.claims)
    ? inputDocs.claimMatrixDoc.claims
    : [];

  const migrationMap = normalizeMigrationMap(inputDocs.migrationMapDoc);
  const canonLock = validateCanonLock(inputDocs.canonStatusDoc);

  if (failsignalRows.length === 0 || tokenRows.length === 0 || claimRows.length === 0) {
    return {
      ok: false,
      failReason: 'INPUT_DOC_UNREADABLE',
      semanticCollisions: [],
      tokenUnknown: [],
      tokenAmbiguous: [],
      claimMissingFailsignal: [],
      claimUnresolvedConflicts: [],
      claimResolvedByMigration: [],
      aliasUnresolved: [],
      advisoryToBlockingDriftCount: -1,
      advisoryToBlockingDriftIssues: [{ code: 'INPUT_DOC_UNREADABLE' }],
      canonLock,
      singleModeAuthorityOk: false,
    };
  }

  const byCode = buildRegistryIndex(failsignalRows);
  const collisionState = evaluateSemanticCollisions(byCode);
  const semanticCollisions = collisionState.semanticCollisions;
  const duplicateDeclarations = collisionState.duplicateDeclarations;
  const tokenValidation = evaluateTokenToFailsignalUniqueness(tokenRows, byCode);
  const claimAlignment = evaluateClaimAlignment(claimRows, tokenRows, byCode, migrationMap);
  const aliasCoverage = evaluateAliasMigrationCoverage(failsignalRows, migrationMap, byCode);
  const driftState = evaluateAdvisoryToBlockingDrift(inputDocs.repoRoot, failsignalRows);

  const singleModeAuthority = evaluateModeMatrixVerdict({
    repoRoot: inputDocs.repoRoot,
    mode: 'release',
    failSignalCode: 'E_REMOTE_UNAVAILABLE',
  });
  const singleModeAuthorityOk = singleModeAuthority.ok
    && singleModeAuthority.evaluatorId === CANONICAL_MODE_MATRIX_EVALUATOR_ID;

  const registryDeclarationMismatchCount = tokenValidation.unknown.length + claimAlignment.missingFailsignal.length;

  const semanticCollisionCount = semanticCollisions.length;
  const tokenFailsignalAmbiguityCount = tokenValidation.ambiguous.length;
  const claimModeConflictCount = claimAlignment.unresolvedConflicts.length;
  const semanticAliasWithoutMigrationCount = aliasCoverage.unresolvedAlias.length;

  const ok = canonLock.ok
    && semanticCollisionCount === 0
    && tokenFailsignalAmbiguityCount === 0
    && claimModeConflictCount === 0
    && registryDeclarationMismatchCount === 0
    && semanticAliasWithoutMigrationCount === 0
    && driftState.ok
    && driftState.advisoryToBlockingDriftCount === 0
    && singleModeAuthorityOk;

  return {
    ok,
    failReason: ok
      ? ''
      : (
        !canonLock.ok
          ? canonLock.reason
          : semanticCollisionCount > 0
            ? 'DUPLICATE_FAILSIGNAL_MEANING_DETECTED'
            : tokenFailsignalAmbiguityCount > 0
              ? 'TOKEN_FAILSIGNAL_AMBIGUITY_DETECTED'
              : claimModeConflictCount > 0
                ? 'CLAIM_MODE_DISPOSITION_CONFLICT'
                : semanticAliasWithoutMigrationCount > 0
                  ? 'SEMANTIC_ALIAS_WITHOUT_MIGRATION_MAP'
                  : registryDeclarationMismatchCount > 0
                    ? 'REGISTRY_DECLARATION_MISMATCH'
                    : driftState.advisoryToBlockingDriftCount > 0
                      ? 'ADVISORY_TO_BLOCKING_DRIFT'
                      : !singleModeAuthorityOk
                        ? 'SINGLE_MODE_AUTHORITY_FAIL'
                        : 'P1_WS01_POLICY_FAIL'
      ),
    semanticCollisions,
    duplicateDeclarations,
    tokenUnknown: tokenValidation.unknown,
    tokenAmbiguous: tokenValidation.ambiguous,
    claimMissingFailsignal: claimAlignment.missingFailsignal,
    claimUnresolvedConflicts: claimAlignment.unresolvedConflicts,
    claimResolvedByMigration: claimAlignment.resolvedByMigration,
    aliasUnresolved: aliasCoverage.unresolvedAlias,
    advisoryToBlockingDriftCount: driftState.advisoryToBlockingDriftCount,
    advisoryToBlockingDriftIssues: driftState.issues,
    driftCases: driftState.driftCases,
    canonLock,
    singleModeAuthorityOk,
    counts: {
      semanticCollisionCount,
      duplicateDeclarationCount: duplicateDeclarations.length,
      tokenFailsignalAmbiguityCount,
      claimModeConflictCount,
      registryDeclarationMismatchCount,
      semanticAliasWithoutMigrationCount,
      claimModeResolvedByMigrationCount: claimAlignment.resolvedByMigration.length,
      scopedClaimCount: claimAlignment.scopedClaimCount,
    },
  };
}

function buildNegativeFixtures(baseDocs, basePolicy = {}) {
  const fixtures = [];

  {
    const doc = JSON.parse(JSON.stringify(baseDocs.failsignalRegistryDoc));
    const rows = Array.isArray(doc.failSignals) ? doc.failSignals : [];
    if (rows.length >= 1) {
      const clone = JSON.parse(JSON.stringify(rows[0]));
      clone.tier = clone.tier === 'release' ? 'core' : 'release';
      rows.push(clone);
      fixtures.push({
        id: 'NEXT_TZ_NEGATIVE_01',
        expectedFailReason: 'DUPLICATE_FAILSIGNAL_MEANING_DETECTED',
        docs: { failsignalRegistryDoc: doc },
      });
    }
  }

  {
    const regDoc = JSON.parse(JSON.stringify(baseDocs.failsignalRegistryDoc));
    const tokDoc = JSON.parse(JSON.stringify(baseDocs.tokenCatalogDoc));
    const tokenRows = Array.isArray(tokDoc.tokens) ? tokDoc.tokens : [];
    const target = tokenRows.find((row) => isObjectRecord(row) && normalizeString(row.failSignalCode));
    if (target) {
      const failSignalCode = normalizeString(target.failSignalCode);
      const regRows = Array.isArray(regDoc.failSignals) ? regDoc.failSignals : [];
      const source = regRows.find((row) => normalizeString(row.code) === failSignalCode);
      if (source) regRows.push(JSON.parse(JSON.stringify(source)));
      fixtures.push({
        id: 'NEXT_TZ_NEGATIVE_02',
        expectedFailReason: 'TOKEN_FAILSIGNAL_AMBIGUITY_DETECTED',
        docs: {
          failsignalRegistryDoc: regDoc,
          tokenCatalogDoc: tokDoc,
        },
      });
    }
  }

  {
    const claimDoc = JSON.parse(JSON.stringify(baseDocs.claimMatrixDoc));
    const migDoc = JSON.parse(JSON.stringify(baseDocs.migrationMapDoc));
    const claims = Array.isArray(claimDoc.claims) ? claimDoc.claims : [];
    const resolvedByMigration = Array.isArray(basePolicy.claimResolvedByMigration)
      ? basePolicy.claimResolvedByMigration
      : [];
    const targetResolved = resolvedByMigration.find((row) => isObjectRecord(row) && normalizeString(row.claimId));
    const targetClaimId = normalizeString(targetResolved?.claimId) || 'PROOFHOOK_INTEGRITY';
    const claim = claims.find((row) => normalizeString(row.claimId) === targetClaimId);
    if (claim) {
      if (isObjectRecord(migDoc) && Array.isArray(migDoc.claimModeOverrides)) {
        migDoc.claimModeOverrides = migDoc.claimModeOverrides.filter(
          (row) => normalizeString(row.claimId) !== targetClaimId,
        );
      }
      fixtures.push({
        id: 'NEXT_TZ_NEGATIVE_03',
        expectedFailReason: 'CLAIM_MODE_DISPOSITION_CONFLICT',
        docs: {
          claimMatrixDoc: claimDoc,
          migrationMapDoc: migDoc,
        },
      });
    }
  }

  {
    const regDoc = JSON.parse(JSON.stringify(baseDocs.failsignalRegistryDoc));
    const migDoc = JSON.parse(JSON.stringify(baseDocs.migrationMapDoc));
    const rows = Array.isArray(regDoc.failSignals) ? regDoc.failSignals : [];
    if (rows.length >= 2) {
      rows[1].semanticAliasOf = normalizeString(rows[0].code);
      fixtures.push({
        id: 'NEXT_TZ_NEGATIVE_04',
        expectedFailReason: 'SEMANTIC_ALIAS_WITHOUT_MIGRATION_MAP',
        docs: {
          failsignalRegistryDoc: regDoc,
          migrationMapDoc: migDoc,
        },
      });
    }
  }

  {
    const tokDoc = JSON.parse(JSON.stringify(baseDocs.tokenCatalogDoc));
    const tokens = Array.isArray(tokDoc.tokens) ? tokDoc.tokens : [];
    const token = tokens.find((row) => isObjectRecord(row) && normalizeString(row.failSignalCode));
    if (token) {
      token.failSignalCode = 'E_UNKNOWN_SIGNAL_FOR_NEGATIVE_05';
      fixtures.push({
        id: 'NEXT_TZ_NEGATIVE_05',
        expectedFailReason: 'REGISTRY_DECLARATION_MISMATCH',
        docs: {
          tokenCatalogDoc: tokDoc,
        },
      });
    }
  }

  return fixtures;
}

export function evaluateP1Ws01FailsignalSemanticDedupState(input = {}) {
  const docs = loadInputDocs(input);

  const basePolicy = evaluatePolicyFromDocs(docs);

  const runNegativeFixtures = input.runNegativeFixtures !== false;
  const negativeResults = {
    NEXT_TZ_NEGATIVE_01: false,
    NEXT_TZ_NEGATIVE_02: false,
    NEXT_TZ_NEGATIVE_03: false,
    NEXT_TZ_NEGATIVE_04: false,
    NEXT_TZ_NEGATIVE_05: false,
  };

  if (runNegativeFixtures) {
    const fixtures = buildNegativeFixtures(docs, basePolicy);
    for (const fixture of fixtures) {
      const fixturePolicy = evaluatePolicyFromDocs({
        ...docs,
        ...fixture.docs,
      });
      negativeResults[fixture.id] = fixturePolicy.ok === false && fixturePolicy.failReason === fixture.expectedFailReason;
    }
  }

  const positiveResults = {
    NEXT_TZ_POSITIVE_01: basePolicy.counts.semanticCollisionCount === 0,
    NEXT_TZ_POSITIVE_02: basePolicy.counts.tokenFailsignalAmbiguityCount === 0
      && basePolicy.counts.registryDeclarationMismatchCount === 0
      && basePolicy.counts.claimModeConflictCount === 0,
    NEXT_TZ_POSITIVE_03: basePolicy.advisoryToBlockingDriftCount === 0 && basePolicy.singleModeAuthorityOk,
  };

  const dod = {
    NEXT_TZ_DOD_01: basePolicy.counts.semanticCollisionCount === 0,
    NEXT_TZ_DOD_02: basePolicy.counts.tokenFailsignalAmbiguityCount === 0,
    NEXT_TZ_DOD_03: basePolicy.counts.claimModeConflictCount === 0,
    NEXT_TZ_DOD_04: Object.values(negativeResults).every(Boolean),
    NEXT_TZ_DOD_05: Object.values(positiveResults).every(Boolean),
    NEXT_TZ_DOD_06: true,
    NEXT_TZ_DOD_07: true,
  };

  const acceptance = {
    NEXT_TZ_ACCEPTANCE_01: basePolicy.canonLock.ok,
    NEXT_TZ_ACCEPTANCE_02: basePolicy.advisoryToBlockingDriftCount === 0,
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
    failReason: ok ? '' : (basePolicy.failReason || 'P1_WS01_POLICY_FAIL'),
    activeCanonVersionExpected: EXPECTED_CANON_VERSION,
    activeCanonVersionObserved: basePolicy.canonLock.observedVersion,
    activeCanonStatusObserved: basePolicy.canonLock.observedStatus,
    activeCanonLockCheckPass: basePolicy.canonLock.ok,
    counts: basePolicy.counts,
    semanticCollisions: basePolicy.semanticCollisions,
    tokenUnknown: basePolicy.tokenUnknown,
    tokenAmbiguous: basePolicy.tokenAmbiguous,
    claimMissingFailsignal: basePolicy.claimMissingFailsignal,
    claimUnresolvedConflicts: basePolicy.claimUnresolvedConflicts,
    claimResolvedByMigration: basePolicy.claimResolvedByMigration,
    aliasUnresolved: basePolicy.aliasUnresolved,
    advisoryToBlockingDriftCount: basePolicy.advisoryToBlockingDriftCount,
    advisoryToBlockingDriftIssues: basePolicy.advisoryToBlockingDriftIssues,
    driftCases: basePolicy.driftCases,
    singleModeAuthorityOk: basePolicy.singleModeAuthorityOk,
    evaluatorIdExpected: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    negativeResults,
    positiveResults,
    dod,
    acceptance,
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`P1_WS01_SEMANTIC_COLLISION_COUNT=${state.counts.semanticCollisionCount}`);
  console.log(`P1_WS01_TOKEN_FAILSIGNAL_AMBIGUITY_COUNT=${state.counts.tokenFailsignalAmbiguityCount}`);
  console.log(`P1_WS01_CLAIM_MODE_CONFLICT_COUNT=${state.counts.claimModeConflictCount}`);
  console.log(`P1_WS01_REGISTRY_DECLARATION_MISMATCH_COUNT=${state.counts.registryDeclarationMismatchCount}`);
  console.log(`P1_WS01_ADVISORY_BLOCKING_DRIFT_COUNT=${state.advisoryToBlockingDriftCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateP1Ws01FailsignalSemanticDedupState({
    failsignalRegistryPath: args.failsignalRegistryPath,
    tokenCatalogPath: args.tokenCatalogPath,
    claimMatrixPath: args.claimMatrixPath,
    migrationMapPath: args.migrationMapPath,
    canonStatusPath: args.canonStatusPath,
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
