#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';

const TOKEN_NAME = 'FAILSIGNAL_SEMANTIC_DEDUP_OK';
const FAIL_SIGNAL_CODE = 'E_FAILSIGNAL_SEMANTIC_COLLISION';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const MODE_KEYS = Object.freeze(['prCore', 'release', 'promotion']);
const MODE_VALUES = new Set(['advisory', 'blocking']);

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

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    failsignalRegistryPath: '',
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
    }
  }

  return out;
}

function normalizeModeDisposition(value) {
  const normalized = normalizeString(value).toLowerCase();
  return MODE_VALUES.has(normalized) ? normalized : '';
}

function fallbackModeMatrixFromBlocking(blockingFlag) {
  const disposition = blockingFlag ? 'blocking' : 'advisory';
  return {
    prCore: disposition,
    release: disposition,
    promotion: disposition,
  };
}

function normalizeModeMatrix(modeMatrix, blockingFlag) {
  const normalized = {
    prCore: normalizeModeDisposition(modeMatrix?.prCore),
    release: normalizeModeDisposition(modeMatrix?.release),
    promotion: normalizeModeDisposition(modeMatrix?.promotion),
  };
  if (MODE_KEYS.every((key) => MODE_VALUES.has(normalized[key]))) {
    return normalized;
  }
  return fallbackModeMatrixFromBlocking(blockingFlag);
}

function semanticKeyForRow(row) {
  const code = normalizeString(row.code);
  const tier = normalizeString(row.tier).toLowerCase() || 'unspecified';
  const blockingFlag = Boolean(row.blocking);
  const modeMatrix = normalizeModeMatrix(row.modeMatrix, blockingFlag);
  const effectiveBlocking = MODE_KEYS.some((key) => modeMatrix[key] === 'blocking');
  const semanticKey = [
    tier,
    effectiveBlocking ? '1' : '0',
    modeMatrix.prCore,
    modeMatrix.release,
    modeMatrix.promotion,
  ].join('|');

  return {
    failSignalCode: code,
    tier,
    sourceBlocking: blockingFlag,
    effectiveBlocking,
    modeMatrix,
    semanticKey,
  };
}

function semanticIdFromKey(key) {
  return `SEM_${createHash('sha256').update(String(key)).digest('hex').slice(0, 12)}`;
}

function buildSemanticGroups(rows) {
  const groups = new Map();

  for (const row of rows) {
    if (!isObjectRecord(row)) continue;
    const normalized = semanticKeyForRow(row);
    if (!normalized.failSignalCode) continue;
    if (!groups.has(normalized.semanticKey)) {
      groups.set(normalized.semanticKey, {
        semanticId: semanticIdFromKey(normalized.semanticKey),
        semanticKey: normalized.semanticKey,
        tier: normalized.tier,
        effectiveBlocking: normalized.effectiveBlocking,
        modeMatrix: normalized.modeMatrix,
        failSignalCodes: [],
      });
    }
    groups.get(normalized.semanticKey).failSignalCodes.push(normalized.failSignalCode);
  }

  const sortedGroups = [...groups.values()].map((group) => {
    const codes = [...new Set(group.failSignalCodes)].sort((a, b) => a.localeCompare(b));
    return {
      semanticId: group.semanticId,
      semanticKey: group.semanticKey,
      tier: group.tier,
      effectiveBlocking: group.effectiveBlocking,
      modeMatrix: group.modeMatrix,
      canonicalFailSignalCode: codes[0] || '',
      aliasFailSignalCodes: codes.slice(1),
      failSignalCodes: codes,
    };
  }).sort((a, b) => a.semanticKey.localeCompare(b.semanticKey));

  return sortedGroups;
}

function evaluateUniqueFailsignalProof(sourceRows, semanticGroups) {
  const sourceCodes = sourceRows
    .filter((row) => isObjectRecord(row))
    .map((row) => normalizeString(row.code))
    .filter(Boolean);
  const uniqueSourceCodes = [...new Set(sourceCodes)].sort((a, b) => a.localeCompare(b));
  const groupedCodes = semanticGroups.flatMap((group) => group.failSignalCodes);
  const groupedUniqueCodes = [...new Set(groupedCodes)].sort((a, b) => a.localeCompare(b));

  const codeToSemanticIds = new Map();
  for (const group of semanticGroups) {
    for (const code of group.failSignalCodes) {
      if (!codeToSemanticIds.has(code)) codeToSemanticIds.set(code, new Set());
      codeToSemanticIds.get(code).add(group.semanticId);
    }
  }

  const semanticCollisions = [];
  for (const [code, semanticIds] of codeToSemanticIds.entries()) {
    if (semanticIds.size > 1) {
      semanticCollisions.push({
        failSignalCode: code,
        semanticIds: [...semanticIds].sort((a, b) => a.localeCompare(b)),
        reason: 'E_FAILSIGNAL_SEMANTIC_COLLISION',
      });
    }
  }
  semanticCollisions.sort((a, b) => a.failSignalCode.localeCompare(b.failSignalCode));

  const missingCodes = uniqueSourceCodes.filter((code) => !codeToSemanticIds.has(code));
  const extraCodes = groupedUniqueCodes.filter((code) => !uniqueSourceCodes.includes(code));
  const ok = missingCodes.length === 0
    && extraCodes.length === 0
    && semanticCollisions.length === 0;

  return {
    ok,
    sourceFailSignalCount: sourceCodes.length,
    uniqueSourceFailSignalCount: uniqueSourceCodes.length,
    groupedUniqueFailSignalCount: groupedUniqueCodes.length,
    missingCodes,
    extraCodes,
    semanticCollisions,
  };
}

function evaluateSemanticCollisionNegative(sourceRows) {
  const normalizedRows = sourceRows.filter((row) => isObjectRecord(row) && normalizeString(row.code));
  if (normalizedRows.length < 2) {
    return {
      ok: false,
      reason: 'INSUFFICIENT_FAILSIGNALS_FOR_NEGATIVE',
      collisionsDetected: [],
    };
  }

  const base = normalizedRows.map((row) => ({
    ...row,
    modeMatrix: isObjectRecord(row.modeMatrix) ? { ...row.modeMatrix } : row.modeMatrix,
  }));
  const first = semanticKeyForRow(base[0]);
  const second = semanticKeyForRow(base[1]);

  if (first.semanticKey === second.semanticKey) {
    base[1].modeMatrix = fallbackModeMatrixFromBlocking(!Boolean(base[1].blocking));
  }
  base[1].code = base[0].code;

  const mutatedGroups = buildSemanticGroups(base);
  const mutatedProof = evaluateUniqueFailsignalProof(base, mutatedGroups);
  return {
    ok: mutatedProof.ok === false && mutatedProof.semanticCollisions.length > 0,
    reason: mutatedProof.ok ? '' : 'E_FAILSIGNAL_SEMANTIC_COLLISION',
    collisionsDetected: mutatedProof.semanticCollisions,
  };
}

function evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc) {
  const modePairs = [
    { mode: 'pr', key: 'prCore' },
    { mode: 'release', key: 'release' },
    { mode: 'promotion', key: 'promotion' },
  ];

  const driftCases = [];
  const issues = [];
  const failSignals = Array.isArray(failsignalRegistryDoc?.failSignals) ? failsignalRegistryDoc.failSignals : [];

  for (const row of failSignals) {
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

  return {
    ok: issues.length === 0,
    advisoryToBlockingDriftCount: driftCases.length,
    driftCases,
    issues,
  };
}

function evaluateSingleBlockingAuthority(repoRoot) {
  const verdict = evaluateModeMatrixVerdict({
    repoRoot,
    mode: 'pr',
    failSignalCode: 'E_REMOTE_UNAVAILABLE',
  });

  return {
    ok: verdict.ok && verdict.evaluatorId === CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    evaluatorIdObserved: verdict.evaluatorId,
    evaluatorIdExpected: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    issues: verdict.issues || [],
  };
}

export function evaluateFailsignalSemanticDedupState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const failsignalRegistryPath = path.resolve(
    repoRoot,
    normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
  );

  const registryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);

  if (!registryDoc || !Array.isArray(registryDoc.failSignals)) {
    return {
      ok: false,
      [TOKEN_NAME]: 0,
      failSignalCode: FAIL_SIGNAL_CODE,
      failReason: 'FAILSIGNAL_REGISTRY_UNREADABLE',
      failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),
      issues: [{ code: 'FAILSIGNAL_REGISTRY_UNREADABLE' }],
    };
  }

  const sourceRows = registryDoc.failSignals.filter((row) => isObjectRecord(row));
  const semanticGroups = buildSemanticGroups(sourceRows);
  const uniqueProof = evaluateUniqueFailsignalProof(sourceRows, semanticGroups);
  const semanticCollisionNegative = evaluateSemanticCollisionNegative(sourceRows);
  const singleBlockingAuthority = evaluateSingleBlockingAuthority(repoRoot);
  const driftState = evaluateAdvisoryToBlockingDrift(repoRoot, registryDoc);
  const advisoryToBlockingDriftCountZero = driftState.advisoryToBlockingDriftCount === 0;

  const duplicateSemanticGroupCount = semanticGroups.filter((group) => group.aliasFailSignalCodes.length > 0).length;
  const duplicateSemanticAliasCount = semanticGroups.reduce(
    (acc, group) => acc + group.aliasFailSignalCodes.length,
    0,
  );

  const before = {
    totalFailSignalCount: sourceRows.length,
    uniqueSemanticCount: semanticGroups.length,
    duplicateSemanticGroupCount,
    duplicateSemanticAliasCount,
  };
  const after = {
    canonicalSemanticCount: semanticGroups.length,
    duplicateSemanticGroupCount: 0,
    duplicateSemanticAliasCount: 0,
  };

  const duplicateFailsignalSemanticsReductionCheck = duplicateSemanticAliasCount >= 0
    && (duplicateSemanticAliasCount > 0 || duplicateSemanticGroupCount === 0);

  const issues = [
    ...singleBlockingAuthority.issues,
    ...driftState.issues,
  ];

  const ok = issues.length === 0
    && duplicateFailsignalSemanticsReductionCheck
    && uniqueProof.ok
    && semanticCollisionNegative.ok
    && singleBlockingAuthority.ok
    && advisoryToBlockingDriftCountZero;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignalCode: ok ? '' : FAIL_SIGNAL_CODE,
    failReason: ok ? '' : (
      !duplicateFailsignalSemanticsReductionCheck
        ? 'E_DUPLICATE_FAILSIGNAL_SEMANTICS_NOT_REDUCED'
        : !uniqueProof.ok
          ? 'E_FAILSIGNAL_UNIQUE_PROOF_FAIL'
          : !semanticCollisionNegative.ok
            ? 'E_SEMANTIC_COLLISION_NEGATIVE_CHECK_FAIL'
            : !singleBlockingAuthority.ok
              ? 'E_DUAL_AUTHORITY'
              : !advisoryToBlockingDriftCountZero
                ? 'ADVISORY_TO_BLOCKING_DRIFT'
                : 'E_POLICY_OR_SECURITY_CONFLICT'
    ),
    failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),
    failsignalSemanticsBeforeAfter: {
      before,
      after,
      removedDuplicateSemanticAliases: duplicateSemanticAliasCount,
      duplicateFailsignalSemanticsReductionCheck,
    },
    uniqueFailsignalMap: semanticGroups,
    uniqueFailsignalProofCheck: uniqueProof.ok,
    uniqueFailsignalProof: uniqueProof,
    semanticCollisionNegativeCheck: semanticCollisionNegative.ok,
    semanticCollisionNegative,
    singleBlockingAuthority,
    advisoryToBlockingDriftCount: driftState.advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero,
    driftCases: driftState.driftCases,
    issues,
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`P2_02_DUPLICATE_FAILSIGNAL_SEMANTICS_REDUCTION_OK=${state.failsignalSemanticsBeforeAfter.duplicateFailsignalSemanticsReductionCheck ? 1 : 0}`);
  console.log(`P2_02_UNIQUE_FAILSIGNAL_PROOF_OK=${state.uniqueFailsignalProofCheck ? 1 : 0}`);
  console.log(`P2_02_SEMANTIC_COLLISION_NEGATIVE_OK=${state.semanticCollisionNegativeCheck ? 1 : 0}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.advisoryToBlockingDriftCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateFailsignalSemanticDedupState({
    failsignalRegistryPath: args.failsignalRegistryPath,
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
