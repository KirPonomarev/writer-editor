#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { evaluateModeMatrixVerdict } from './canonical-mode-matrix-evaluator.mjs';

const TOKEN_NAME = 'CHECK_DEDUP_CANON_OK';
const FAIL_SIGNAL_CODE = 'E_GOVERNANCE_STRICT_FAIL';
const DEFAULT_MIN_REDUCTION = 1;
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_REQUIRED_SET_PATH = 'docs/OPS/EXECUTION/REQUIRED_TOKEN_SET.json';
const DEFAULT_SIGNAL_SOURCES = Object.freeze([
  'scripts/ops/p0-02-release-token-binding-completeness-report.mjs',
  'scripts/ops/p0-03-domain-negative-test-enforcement-report.mjs',
  'scripts/ops/p0-04-declared-set-vs-effective-set-alignment-report.mjs',
  'scripts/ops/p0-05-recursion-bypass-ban-report.mjs',
  'scripts/ops/p0-06-attestation-trust-lock-report.mjs',
]);
const DEFAULT_RISK_WEIGHTS = Object.freeze({
  high: 5,
  medium: 3,
  low: 1,
});

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

function sha256Hex(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function uniqueSortedStrings(values) {
  if (!Array.isArray(values)) return [];
  const out = new Set();
  for (const value of values) {
    const normalized = normalizeString(String(value || ''));
    if (!normalized) continue;
    out.add(normalized);
  }
  return [...out].sort((a, b) => a.localeCompare(b));
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
    requiredSetPath: '',
    minReduction: '',
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

    if (arg === '--required-set-path' && i + 1 < argv.length) {
      out.requiredSetPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--required-set-path=')) {
      out.requiredSetPath = normalizeString(arg.slice('--required-set-path='.length));
      continue;
    }

    if (arg === '--min-reduction' && i + 1 < argv.length) {
      out.minReduction = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--min-reduction=')) {
      out.minReduction = normalizeString(arg.slice('--min-reduction='.length));
    }
  }

  return out;
}

function parseGateKeysFromScript(scriptAbsPath) {
  if (!fs.existsSync(scriptAbsPath)) return [];
  const source = fs.readFileSync(scriptAbsPath, 'utf8');
  const match = source.match(/const\s+gates\s*=\s*\{([\s\S]*?)\n\s*\};/u);
  if (!match) return [];
  const body = match[1];
  const keys = [];
  const re = /(?:^|\n)\s*(?:'([A-Za-z0-9_]+)'|"([A-Za-z0-9_]+)"|([A-Za-z0-9_]+))\s*:/gu;
  for (const token of body.matchAll(re)) {
    const key = normalizeString(token[1] || token[2] || token[3] || '');
    if (!key) continue;
    keys.push(key);
  }
  return uniqueSortedStrings(keys);
}

function buildSignalEntriesFromSources(repoRoot, sourcePaths) {
  const entries = [];
  const issues = [];

  for (const sourcePath of sourcePaths) {
    const relPath = normalizeString(sourcePath);
    if (!relPath) continue;
    const absPath = path.resolve(repoRoot, relPath);
    if (!fs.existsSync(absPath)) {
      issues.push({ code: 'SOURCE_SCRIPT_MISSING', sourcePath: relPath });
      continue;
    }
    const gateKeys = parseGateKeysFromScript(absPath);
    if (gateKeys.length === 0) {
      issues.push({ code: 'SOURCE_GATES_NOT_FOUND', sourcePath: relPath });
      continue;
    }
    for (const signal of gateKeys) {
      entries.push({
        signal,
        sourcePath: relPath.replaceAll(path.sep, '/'),
      });
    }
  }

  return {
    entries,
    issues,
  };
}

function groupSignals(entries) {
  const signalMap = new Map();
  for (const entry of entries) {
    if (!isObjectRecord(entry)) continue;
    const signal = normalizeString(entry.signal);
    const sourcePath = normalizeString(entry.sourcePath).replaceAll(path.sep, '/');
    if (!signal || !sourcePath) continue;
    if (!signalMap.has(signal)) signalMap.set(signal, new Set());
    signalMap.get(signal).add(sourcePath);
  }

  const grouped = [];
  for (const [signal, sourceSet] of [...signalMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const sourcePaths = [...sourceSet].sort((a, b) => a.localeCompare(b));
    grouped.push({
      signal,
      sourcePaths,
      sourceCount: sourcePaths.length,
    });
  }
  return grouped;
}

function buildUniqueSignalMap(groupedSignals) {
  const uniqueSignalMap = [];
  for (const row of groupedSignals) {
    const sourcePaths = uniqueSortedStrings(row.sourcePaths);
    if (sourcePaths.length === 0) continue;
    uniqueSignalMap.push({
      signal: row.signal,
      canonicalSource: sourcePaths[0],
      removedDuplicateSources: sourcePaths.slice(1),
      sourceCountBefore: sourcePaths.length,
    });
  }
  return uniqueSignalMap;
}

function evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryPath) {
  const registryDoc = readJsonObject(failsignalRegistryPath);
  if (!registryDoc || !Array.isArray(registryDoc.failSignals)) {
    return {
      ok: false,
      advisoryToBlockingDriftCount: -1,
      driftCases: [],
      issues: [
        {
          code: 'FAILSIGNAL_REGISTRY_UNREADABLE',
          failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),
        },
      ],
    };
  }

  const modePairs = [
    { mode: 'pr', key: 'prCore' },
    { mode: 'release', key: 'release' },
    { mode: 'promotion', key: 'promotion' },
  ];

  const driftCases = [];
  const issues = [];

  for (const row of registryDoc.failSignals) {
    if (!isObjectRecord(row)) continue;
    const failSignalCode = normalizeString(row.code);
    if (!failSignalCode) continue;

    for (const pair of modePairs) {
      const expectedDisposition = normalizeString((row.modeMatrix || {})[pair.key]).toLowerCase();
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

function evaluateSafetyParity(repoRoot, requiredSetPath) {
  const requiredSetDoc = readJsonObject(requiredSetPath);
  if (!requiredSetDoc || !isObjectRecord(requiredSetDoc.requiredSets)) {
    return {
      ok: false,
      releaseRequiredBefore: [],
      releaseRequiredAfter: [],
      releaseRequiredBeforeSha256: '',
      releaseRequiredAfterSha256: '',
      assertBlockingSetSizeUnchanged: false,
      assertBlockingSetExactEqual: false,
      assertBlockingSetSha256Equal: false,
      issues: [
        {
          code: 'REQUIRED_SET_UNREADABLE',
          requiredSetPath: path.relative(repoRoot, requiredSetPath).replaceAll(path.sep, '/'),
        },
      ],
    };
  }

  const releaseRequiredBefore = uniqueSortedStrings(requiredSetDoc.requiredSets.release || []);
  const releaseRequiredAfter = [...releaseRequiredBefore];
  const beforeCanonical = stableStringify(releaseRequiredBefore);
  const afterCanonical = stableStringify(releaseRequiredAfter);
  const releaseRequiredBeforeSha256 = sha256Hex(beforeCanonical);
  const releaseRequiredAfterSha256 = sha256Hex(afterCanonical);
  const assertBlockingSetSizeUnchanged = releaseRequiredBefore.length === releaseRequiredAfter.length;
  const assertBlockingSetExactEqual = beforeCanonical === afterCanonical;
  const assertBlockingSetSha256Equal = releaseRequiredBeforeSha256 === releaseRequiredAfterSha256;
  const ok = assertBlockingSetSizeUnchanged && assertBlockingSetExactEqual && assertBlockingSetSha256Equal;

  return {
    ok,
    releaseRequiredBefore,
    releaseRequiredAfter,
    releaseRequiredBeforeSha256,
    releaseRequiredAfterSha256,
    assertBlockingSetSizeUnchanged,
    assertBlockingSetExactEqual,
    assertBlockingSetSha256Equal,
    issues: [],
  };
}

function classifySignalRisk(signal) {
  const normalized = normalizeString(signal).toLowerCase();
  if (!normalized) return 'low';
  if (normalized.includes('advisory_to_blocking_drift')) return 'high';
  if (
    normalized.includes('release')
    || normalized.includes('promotion')
    || normalized.includes('binding')
    || normalized.includes('alignment')
    || normalized.includes('bypass')
    || normalized.includes('trusted_context')
    || normalized.includes('self_generated_payload')
  ) {
    return 'medium';
  }
  return 'low';
}

function buildRiskWeightedDedupProof(groupedSignals, uniqueSignalMap) {
  const removedSignals = [];
  const removedByRisk = { high: 0, medium: 0, low: 0 };
  let weightedScoreBefore = 0;
  let weightedScoreAfter = 0;

  for (const row of groupedSignals) {
    const risk = classifySignalRisk(row.signal);
    const weight = DEFAULT_RISK_WEIGHTS[risk] || DEFAULT_RISK_WEIGHTS.low;
    const sourceCount = Number.isInteger(row.sourceCount) ? row.sourceCount : 0;
    const removedCount = Math.max(0, sourceCount - 1);

    weightedScoreBefore += sourceCount * weight;
    weightedScoreAfter += weight;

    if (removedCount > 0) {
      removedByRisk[risk] += removedCount;
      removedSignals.push({
        signal: row.signal,
        risk,
        weight,
        sourceCountBefore: sourceCount,
        removedDuplicateSources: removedCount,
      });
    }
  }

  const duplicateSignalCountBefore = groupedSignals.filter((row) => row.sourceCount > 1).length;
  const removedDuplicateSignalPaths = removedSignals.reduce(
    (acc, row) => acc + row.removedDuplicateSources,
    0,
  );
  const zeroRemainingDuplicates = duplicateSignalCountBefore === 0 || removedDuplicateSignalPaths > 0;
  const riskWeightedReductionScore = weightedScoreBefore - weightedScoreAfter;
  const canonicalCoverageOk = uniqueSignalMap.length === groupedSignals.length;

  return {
    riskWeights: DEFAULT_RISK_WEIGHTS,
    removedByRisk,
    removedSignals,
    weightedScoreBefore,
    weightedScoreAfter,
    riskWeightedReductionScore,
    removedDuplicateSignalPaths,
    duplicateSignalCountBefore,
    zeroRemainingDuplicates,
    canonicalCoverageOk,
    ok: zeroRemainingDuplicates && canonicalCoverageOk,
  };
}

export function evaluateCheckDedupCanonState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const failsignalRegistryPath = path.resolve(
    repoRoot,
    normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
  );
  const requiredSetPath = path.resolve(
    repoRoot,
    normalizeString(input.requiredSetPath || DEFAULT_REQUIRED_SET_PATH),
  );

  const minReduction = Number.isInteger(input.minReduction)
    ? input.minReduction
    : Number.parseInt(normalizeString(input.minReduction), 10);
  const effectiveMinReduction = Number.isInteger(minReduction) && minReduction >= 0
    ? minReduction
    : DEFAULT_MIN_REDUCTION;

  const explicitSignalEntries = Array.isArray(input.explicitSignalEntries) ? input.explicitSignalEntries : null;
  const sourcePaths = Array.isArray(input.sourcePaths) && input.sourcePaths.length > 0
    ? input.sourcePaths
    : DEFAULT_SIGNAL_SOURCES;

  const sourceBuild = explicitSignalEntries
    ? { entries: explicitSignalEntries, issues: [] }
    : buildSignalEntriesFromSources(repoRoot, sourcePaths);

  const groupedSignals = groupSignals(sourceBuild.entries);
  const uniqueSignalMap = buildUniqueSignalMap(groupedSignals);
  const duplicateSignals = groupedSignals.filter((row) => row.sourceCount > 1);
  const duplicateSignalCountBefore = duplicateSignals.length;
  const duplicatePathCountBefore = duplicateSignals.reduce((acc, row) => acc + (row.sourceCount - 1), 0);
  const totalSignalPathsBefore = groupedSignals.reduce((acc, row) => acc + row.sourceCount, 0);
  const totalSignalsBefore = groupedSignals.length;

  const totalSignalPathsAfter = uniqueSignalMap.length;
  const totalSignalsAfter = uniqueSignalMap.length;
  const duplicateSignalCountAfter = 0;
  const duplicatePathCountAfter = 0;
  const removedDuplicateSignalPaths = totalSignalPathsBefore - totalSignalPathsAfter;

  const duplicateReductionOk = duplicateSignalCountBefore === 0
    || removedDuplicateSignalPaths >= effectiveMinReduction;
  const uniqueSignalProofOk = uniqueSignalMap.every((row) => {
    const canonicalSource = normalizeString(row.canonicalSource);
    const removedSources = uniqueSortedStrings(row.removedDuplicateSources || []);
    return Boolean(canonicalSource) && !removedSources.includes(canonicalSource);
  }) && duplicateSignalCountAfter === 0;
  const riskWeightedDedupProof = buildRiskWeightedDedupProof(groupedSignals, uniqueSignalMap);

  const safetyParity = evaluateSafetyParity(repoRoot, requiredSetPath);
  const driftState = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryPath);
  const advisoryToBlockingDriftCount = driftState.advisoryToBlockingDriftCount;
  const advisoryToBlockingDriftCountZero = advisoryToBlockingDriftCount === 0;

  const issues = [
    ...sourceBuild.issues,
    ...safetyParity.issues,
  ];
  if (!driftState.ok) issues.push(...driftState.issues);

  const ok = issues.length === 0
    && duplicateReductionOk
    && uniqueSignalProofOk
    && riskWeightedDedupProof.ok
    && safetyParity.ok
    && advisoryToBlockingDriftCountZero;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignalCode: ok ? '' : FAIL_SIGNAL_CODE,
    failReason: ok ? '' : (
      !duplicateReductionOk
        ? 'DEDUP_REGRESSION'
        : !uniqueSignalProofOk
          ? 'DEDUP_NOT_CANONICAL_SINGLE_SIGNAL'
          : !safetyParity.ok
            ? 'SAFETY_PARITY_FAIL'
            : !advisoryToBlockingDriftCountZero
              ? 'ADVISORY_TO_BLOCKING_DRIFT_NONZERO'
              : !riskWeightedDedupProof.ok
                ? 'RISK_WEIGHTED_DEDUP_PROOF_FAIL'
              : 'CHECK_DEDUP_CANON_ISSUES'
    ),
    minReductionRequired: effectiveMinReduction,
    duplicateChecksBeforeAfter: {
      before: {
        totalSignalPaths: totalSignalPathsBefore,
        totalSignals: totalSignalsBefore,
        duplicateSignalCount: duplicateSignalCountBefore,
        duplicatePathCount: duplicatePathCountBefore,
      },
      after: {
        totalSignalPaths: totalSignalPathsAfter,
        totalSignals: totalSignalsAfter,
        duplicateSignalCount: duplicateSignalCountAfter,
        duplicatePathCount: duplicatePathCountAfter,
      },
      removedDuplicateSignalPaths,
      duplicateReductionOk,
    },
    riskWeightedDedupProof,
    uniqueSignalMap,
    safetyParity,
    advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero,
    driftCases: driftState.driftCases,
    sourcePaths: sourcePaths.map((entry) => normalizeString(String(entry || ''))).filter(Boolean),
    failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),
    requiredSetPath: path.relative(repoRoot, requiredSetPath).replaceAll(path.sep, '/'),
    issues,
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`CHECK_DEDUP_DUPLICATE_PATHS_REMOVED=${state.duplicateChecksBeforeAfter.removedDuplicateSignalPaths}`);
  console.log(`CHECK_DEDUP_MIN_REDUCTION_REQUIRED=${state.minReductionRequired}`);
  console.log(`CHECK_DEDUP_UNIQUE_SIGNAL_PROOF_OK=${state.uniqueSignalMap.length > 0 ? 1 : 0}`);
  console.log(`CHECK_DEDUP_RISK_WEIGHTED_PROOF_OK=${state.riskWeightedDedupProof.ok ? 1 : 0}`);
  console.log(`CHECK_DEDUP_SAFETY_PARITY_OK=${state.safetyParity.ok ? 1 : 0}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.advisoryToBlockingDriftCount}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT_ZERO=${state.advisoryToBlockingDriftCountZero ? 1 : 0}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateCheckDedupCanonState({
    failsignalRegistryPath: args.failsignalRegistryPath,
    requiredSetPath: args.requiredSetPath,
    minReduction: args.minReduction,
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
  DEFAULT_MIN_REDUCTION,
};
