#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';

const TOKEN_NAME = 'ROLLBACK_REF_SCHEMA_ADOPTION_OK';
const DEFAULT_REQUIRED_SET_PATH = 'docs/OPS/STATUS/REQUIRED_SET_PHASE_3_V1.json';
const DEFAULT_PHASE_SWITCH_PATH = 'docs/OPS/STATUS/PHASE_SWITCH_V1.json';
const DEFAULT_TOKEN_CATALOG_PATH = 'docs/OPS/TOKENS/TOKEN_CATALOG.json';
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
    requiredSetPath: '',
    phaseSwitchPath: '',
    tokenCatalogPath: '',
    failsignalRegistryPath: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--json') {
      out.json = true;
      continue;
    }

    if (arg === '--required-set-path' && i + 1 < argv.length) {
      out.requiredSetPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--required-set-path=')) {
      out.requiredSetPath = normalizeString(arg.slice('--required-set-path='.length));
      continue;
    }

    if (arg === '--phase-switch-path' && i + 1 < argv.length) {
      out.phaseSwitchPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--phase-switch-path=')) {
      out.phaseSwitchPath = normalizeString(arg.slice('--phase-switch-path='.length));
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

function uniqueSortedStrings(values) {
  if (!Array.isArray(values)) return [];
  const out = new Set();
  for (const raw of values) {
    const normalized = normalizeString(String(raw || ''));
    if (normalized) out.add(normalized);
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

function resolveRequiredBlockingTokenIds(requiredSetDoc) {
  if (!isObjectRecord(requiredSetDoc)) return [];
  return uniqueSortedStrings(requiredSetDoc.effectiveRequiredTokenIds);
}

function buildTokenCatalogMap(tokenCatalogDoc) {
  const rows = Array.isArray(tokenCatalogDoc?.tokens) ? tokenCatalogDoc.tokens : [];
  const out = new Map();
  for (const row of rows) {
    if (!isObjectRecord(row)) continue;
    const tokenId = normalizeString(row.tokenId);
    if (!tokenId) continue;
    out.set(tokenId, row);
  }
  return out;
}

function toEntityContract(tokenId, tokenRow) {
  const proofHook = normalizeString(tokenRow?.proofHook);
  const sourceBinding = normalizeString(tokenRow?.sourceBinding || tokenRow?.sourceBindingRef);

  return {
    entityId: tokenId,
    owner: 'GOVERNANCE_CORE_OWNER',
    deadlineUtc: '2026-12-31T00:00:00.000Z',
    rollbackRef: `docs/OPS/STATUS/${tokenId}_ROLLBACK_v1.json`,
    evidenceArtifactRef: proofHook || sourceBinding || `docs/OPS/STATUS/${tokenId}_EVIDENCE_v1.json`,
    machineCheckId: `MC_${tokenId}`,
    status: 'ACTIVE',
  };
}

function isIsoUtc(value) {
  if (!value || typeof value !== 'string') return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && value.endsWith('Z');
}

function isRollbackRefValid(value) {
  const ref = normalizeString(value);
  if (!ref) return false;
  if (ref.includes('..')) return false;
  if (ref.includes(' ')) return false;
  return ref.endsWith('.json') || ref.includes('.json#');
}

function evaluateContractCompleteness(contracts) {
  const missingRollbackRef = [];
  const invalidRollbackRef = [];
  const incompleteEntities = [];

  for (const row of contracts) {
    const entityId = normalizeString(row.entityId);
    const owner = normalizeString(row.owner);
    const deadlineUtc = normalizeString(row.deadlineUtc);
    const rollbackRef = normalizeString(row.rollbackRef);
    const evidenceArtifactRef = normalizeString(row.evidenceArtifactRef);

    if (!rollbackRef) {
      missingRollbackRef.push(entityId);
    } else if (!isRollbackRefValid(rollbackRef)) {
      invalidRollbackRef.push(entityId);
    }

    if (!owner || !isIsoUtc(deadlineUtc) || !evidenceArtifactRef || !rollbackRef || !isRollbackRefValid(rollbackRef)) {
      incompleteEntities.push({
        entityId,
        ownerPresent: Boolean(owner),
        deadlineUtcValid: isIsoUtc(deadlineUtc),
        evidenceArtifactRefPresent: Boolean(evidenceArtifactRef),
        rollbackRefPresent: Boolean(rollbackRef),
        rollbackRefValid: isRollbackRefValid(rollbackRef),
      });
    }
  }

  return {
    missingRollbackRef,
    missingRollbackRefCount: missingRollbackRef.length,
    invalidRollbackRef,
    invalidRollbackRefCount: invalidRollbackRef.length,
    incompleteEntities,
    incompleteEntityCount: incompleteEntities.length,
  };
}

function resolvePhaseEnforcement(phaseSwitchDoc, targetPhase = '') {
  const activePhase = normalizeString(targetPhase || phaseSwitchDoc?.activePhase || 'PHASE_1_SHADOW');
  const matrix = isObjectRecord(phaseSwitchDoc?.phasePrecedence) ? phaseSwitchDoc.phasePrecedence : {};
  const entry = isObjectRecord(matrix[activePhase]) ? matrix[activePhase] : null;
  const shouldBlock = Boolean(entry?.shouldBlock);
  const mode = normalizeString(entry?.newV1Enforcement || (shouldBlock ? 'HARD_BLOCK' : 'WARN_ONLY'));
  return {
    activePhase,
    newV1Enforcement: mode || (shouldBlock ? 'HARD_BLOCK' : 'WARN_ONLY'),
    shouldBlock,
  };
}

function evaluateMissingRollbackRefNegative(baseContracts, phaseSwitchDoc) {
  if (!Array.isArray(baseContracts) || baseContracts.length === 0) {
    return {
      ok: false,
      reason: 'NO_BLOCKING_ENTITIES',
      targetEntityId: '',
      phase3: null,
      phase2: null,
      phase1: null,
    };
  }

  const targetEntityId = normalizeString(baseContracts[0].entityId);
  const mutatedContracts = baseContracts.map((row, index) => (
    index === 0
      ? { ...row, rollbackRef: '' }
      : { ...row }
  ));

  const completeness = evaluateContractCompleteness(mutatedContracts);

  const phase3 = resolvePhaseEnforcement(phaseSwitchDoc, 'PHASE_3_HARD');
  const phase2 = resolvePhaseEnforcement(phaseSwitchDoc, 'PHASE_2_WARN');
  const phase1 = resolvePhaseEnforcement(phaseSwitchDoc, 'PHASE_1_SHADOW');

  const phase3ExpectedFail = completeness.missingRollbackRef.includes(targetEntityId) && phase3.shouldBlock;
  const phase2WarnOnly = completeness.missingRollbackRef.includes(targetEntityId) && phase2.shouldBlock === false;
  const phase1SignalOnly = completeness.missingRollbackRef.includes(targetEntityId) && phase1.shouldBlock === false;

  const ok = phase3ExpectedFail && phase2WarnOnly && phase1SignalOnly;

  return {
    ok,
    reason: ok ? '' : 'E_ROLLBACK_REF_MISSING',
    targetEntityId,
    completeness: {
      missingRollbackRefCount: completeness.missingRollbackRefCount,
      invalidRollbackRefCount: completeness.invalidRollbackRefCount,
      incompleteEntityCount: completeness.incompleteEntityCount,
      missingRollbackRef: completeness.missingRollbackRef,
    },
    phase3,
    phase2,
    phase1,
  };
}

function evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc) {
  const failSignals = Array.isArray(failsignalRegistryDoc?.failSignals)
    ? failsignalRegistryDoc.failSignals
    : [];

  const modePairs = [
    { mode: 'pr', key: 'prCore' },
    { mode: 'release', key: 'release' },
    { mode: 'promotion', key: 'promotion' },
  ];

  const driftCases = [];
  const issues = [];

  for (const row of failSignals) {
    if (!isObjectRecord(row)) continue;
    const failSignalCode = normalizeString(row.code);
    if (!failSignalCode) continue;

    for (const pair of modePairs) {
      const expectedDisposition = normalizeString((row.modeMatrix || {})[pair.key]).toLowerCase();
      if (expectedDisposition !== 'advisory') continue;

      const verdict = evaluateModeMatrixVerdict({ repoRoot, mode: pair.mode, failSignalCode });
      if (!verdict.ok) {
        issues.push({ code: 'MODE_EVALUATOR_ERROR', failSignalCode, mode: pair.mode, evaluatorIssues: verdict.issues || [] });
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
  const verdict = evaluateModeMatrixVerdict({ repoRoot, mode: 'pr', failSignalCode: 'E_REMOTE_UNAVAILABLE' });
  return {
    ok: verdict.ok && verdict.evaluatorId === CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    evaluatorIdObserved: verdict.evaluatorId,
    evaluatorIdExpected: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    issues: verdict.issues || [],
  };
}

function resolveFailReason(state) {
  if (!state.blockingEntitiesHaveRollbackRefCheck) return 'E_ROLLBACK_REF_MISSING';
  if (!state.rollbackRefFormatValidCheck) return 'E_ROLLBACK_REF_FORMAT_INVALID';
  if (!state.ownerDeadlineEvidenceRequiredCheck) return 'E_BLOCKING_ENTITY_CONTRACT_INCOMPLETE';
  if (!state.missingRollbackRefNegativeCheck) return 'E_ROLLBACK_REF_MISSING';
  if (!state.phaseAwareEnforcementSignalWarnHardCheck) return 'E_BLOCKING_ENTITY_CONTRACT_INCOMPLETE';
  if (!state.advisoryToBlockingDriftCountZero) return 'ADVISORY_TO_BLOCKING_DRIFT';
  if (!state.singleBlockingAuthority.ok) return 'E_BLOCKING_EVALUATOR_NOT_CANONICAL';
  return 'ROLLBACK_REF_SCHEMA_ADOPTION_FAILED';
}

function evaluateRollbackRefSchemaAdoptionState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());

  const requiredSetPath = path.resolve(repoRoot, normalizeString(input.requiredSetPath || DEFAULT_REQUIRED_SET_PATH));
  const phaseSwitchPath = path.resolve(repoRoot, normalizeString(input.phaseSwitchPath || DEFAULT_PHASE_SWITCH_PATH));
  const tokenCatalogPath = path.resolve(repoRoot, normalizeString(input.tokenCatalogPath || DEFAULT_TOKEN_CATALOG_PATH));
  const failsignalRegistryPath = path.resolve(repoRoot, normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH));

  const requiredSetDoc = isObjectRecord(input.requiredSetDoc) ? input.requiredSetDoc : readJsonObject(requiredSetPath);
  const phaseSwitchDoc = isObjectRecord(input.phaseSwitchDoc) ? input.phaseSwitchDoc : readJsonObject(phaseSwitchPath);
  const tokenCatalogDoc = isObjectRecord(input.tokenCatalogDoc) ? input.tokenCatalogDoc : readJsonObject(tokenCatalogPath);
  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc) ? input.failsignalRegistryDoc : readJsonObject(failsignalRegistryPath);

  const requiredTokenIds = resolveRequiredBlockingTokenIds(requiredSetDoc);
  const tokenCatalogMap = buildTokenCatalogMap(tokenCatalogDoc);

  const contracts = Array.isArray(input.blockingEntityContractsOverride)
    ? input.blockingEntityContractsOverride
      .filter((row) => isObjectRecord(row))
      .map((row) => ({ ...row }))
    : requiredTokenIds.map((tokenId) => toEntityContract(tokenId, tokenCatalogMap.get(tokenId)));
  const completeness = evaluateContractCompleteness(contracts);
  const phaseEnforcement = resolvePhaseEnforcement(phaseSwitchDoc);

  const blockingEntitiesHaveRollbackRefCheck = completeness.missingRollbackRefCount === 0;
  const rollbackRefFormatValidCheck = completeness.invalidRollbackRefCount === 0;
  const ownerDeadlineEvidenceRequiredCheck = completeness.incompleteEntityCount === 0;

  const negativeMissingRollbackRef = evaluateMissingRollbackRefNegative(contracts, phaseSwitchDoc);
  const missingRollbackRefNegativeCheck = negativeMissingRollbackRef.ok;
  const phaseAwareEnforcementSignalWarnHardCheck = negativeMissingRollbackRef.ok;

  const driftState = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc);
  const advisoryToBlockingDriftCount = driftState.advisoryToBlockingDriftCount;
  const advisoryToBlockingDriftCountZero = advisoryToBlockingDriftCount === 0;

  const singleBlockingAuthority = evaluateSingleBlockingAuthority(repoRoot);

  const issues = [
    ...driftState.issues,
    ...singleBlockingAuthority.issues,
  ];

  const ok = blockingEntitiesHaveRollbackRefCheck
    && rollbackRefFormatValidCheck
    && ownerDeadlineEvidenceRequiredCheck
    && missingRollbackRefNegativeCheck
    && phaseAwareEnforcementSignalWarnHardCheck
    && advisoryToBlockingDriftCountZero
    && singleBlockingAuthority.ok
    && issues.length === 0;

  const failReason = ok ? '' : resolveFailReason({
    blockingEntitiesHaveRollbackRefCheck,
    ownerDeadlineEvidenceRequiredCheck,
    rollbackRefFormatValidCheck,
    missingRollbackRefNegativeCheck,
    phaseAwareEnforcementSignalWarnHardCheck,
    advisoryToBlockingDriftCountZero,
    singleBlockingAuthority,
  });

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failReason,
    failSignalCode: failReason,

    requiredSetPath: path.relative(repoRoot, requiredSetPath).replaceAll(path.sep, '/'),
    phaseSwitchPath: path.relative(repoRoot, phaseSwitchPath).replaceAll(path.sep, '/'),
    tokenCatalogPath: path.relative(repoRoot, tokenCatalogPath).replaceAll(path.sep, '/'),

    requiredBlockingTokenCount: requiredTokenIds.length,
    requiredBlockingTokenIds: requiredTokenIds,
    blockingEntityContracts: contracts,

    blockingEntitiesHaveRollbackRefCheck,
    ownerDeadlineEvidenceRequiredCheck,
    rollbackRefFormatValidCheck,
    missingRollbackRefNegativeCheck,
    phaseAwareEnforcementSignalWarnHardCheck,

    completeness,
    phaseEnforcement,
    missingRollbackRefNegative: negativeMissingRollbackRef,

    advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero,
    driftCases: driftState.driftCases,

    singleBlockingAuthority,
    issues,
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`P1_07_BLOCKING_ENTITIES_HAVE_ROLLBACK_REF_CHECK=${state.blockingEntitiesHaveRollbackRefCheck ? 1 : 0}`);
  console.log(`P1_07_OWNER_DEADLINE_EVIDENCE_REQUIRED_CHECK=${state.ownerDeadlineEvidenceRequiredCheck ? 1 : 0}`);
  console.log(`P1_07_ROLLBACK_REF_FORMAT_VALID_CHECK=${state.rollbackRefFormatValidCheck ? 1 : 0}`);
  console.log(`P1_07_MISSING_ROLLBACK_REF_NEGATIVE_CHECK=${state.missingRollbackRefNegativeCheck ? 1 : 0}`);
  console.log(`P1_07_PHASE_AWARE_ENFORCEMENT_CHECK=${state.phaseAwareEnforcementSignalWarnHardCheck ? 1 : 0}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.advisoryToBlockingDriftCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateRollbackRefSchemaAdoptionState({
    repoRoot: process.cwd(),
    requiredSetPath: args.requiredSetPath,
    phaseSwitchPath: args.phaseSwitchPath,
    tokenCatalogPath: args.tokenCatalogPath,
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
  evaluateRollbackRefSchemaAdoptionState,
  TOKEN_NAME,
};
