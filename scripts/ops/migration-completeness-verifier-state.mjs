#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  evaluateModeMatrixVerdict,
  CANONICAL_MODE_MATRIX_EVALUATOR_ID,
} from './canonical-mode-matrix-evaluator.mjs';

const TOKEN_NAME = 'MIGRATION_COMPLETENESS_VERIFIER_OK';
const FAIL_SIGNAL_CODE = 'E_GOVERNANCE_STRICT_FAIL';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_REQUIRED_SET_PATH = 'docs/OPS/EXECUTION/REQUIRED_TOKEN_SET.json';

const DECLARED_MIGRATION_CHAIN = Object.freeze([
  {
    stepId: 'documents.marker_check',
    sourcePath: 'src/utils/fileManager.js',
    requiredPattern: 'if (fsSync.existsSync(markerPath))',
    inputCondition: 'documents_target_has_migration_marker',
    outputGuarantee: 'documents_target_path_selected_without_copy',
  },
  {
    stepId: 'documents.target_populated_check',
    sourcePath: 'src/utils/fileManager.js',
    requiredPattern: 'if (hasDirectoryContent(targetPath))',
    inputCondition: 'documents_target_contains_files',
    outputGuarantee: 'documents_target_path_selected_without_legacy_copy',
  },
  {
    stepId: 'documents.legacy_presence_check',
    sourcePath: 'src/utils/fileManager.js',
    requiredPattern: 'if (!hasDirectoryContent(legacyPath))',
    inputCondition: 'documents_legacy_missing_or_empty',
    outputGuarantee: 'documents_target_path_selected_without_copy',
  },
  {
    stepId: 'documents.copy_legacy_to_target',
    sourcePath: 'src/utils/fileManager.js',
    requiredPattern: 'await copyDirectoryContents(legacyPath, targetPath);',
    inputCondition: 'documents_legacy_present_and_target_empty',
    outputGuarantee: 'documents_legacy_content_copied_to_target',
  },
  {
    stepId: 'documents.write_marker',
    sourcePath: 'src/utils/fileManager.js',
    requiredPattern: "await fs.writeFile(markerPath, 'migrated from WriterEditor', 'utf8');",
    inputCondition: 'documents_copy_completed',
    outputGuarantee: 'documents_migration_marker_written',
  },
  {
    stepId: 'userdata.marker_check',
    sourcePath: 'src/main.js',
    requiredPattern: 'if (fsSync.existsSync(markerPath))',
    inputCondition: 'userdata_target_has_migration_marker',
    outputGuarantee: 'userdata_target_path_selected_without_copy',
  },
  {
    stepId: 'userdata.target_populated_check',
    sourcePath: 'src/main.js',
    requiredPattern: 'if (hasDirectoryContent(targetPath))',
    inputCondition: 'userdata_target_contains_files',
    outputGuarantee: 'userdata_target_path_selected_without_legacy_copy',
  },
  {
    stepId: 'userdata.legacy_presence_check',
    sourcePath: 'src/main.js',
    requiredPattern: 'if (!hasDirectoryContent(legacyPath))',
    inputCondition: 'userdata_legacy_missing_or_empty',
    outputGuarantee: 'userdata_target_path_selected_without_copy',
  },
  {
    stepId: 'userdata.copy_legacy_to_target',
    sourcePath: 'src/main.js',
    requiredPattern: 'await copyDirectoryContents(legacyPath, targetPath);',
    inputCondition: 'userdata_legacy_present_and_target_empty',
    outputGuarantee: 'userdata_legacy_content_copied_to_target',
  },
  {
    stepId: 'userdata.write_marker',
    sourcePath: 'src/main.js',
    requiredPattern: "await fs.writeFile(markerPath, 'migrated from WriterEditor', 'utf8');",
    inputCondition: 'userdata_copy_completed',
    outputGuarantee: 'userdata_migration_marker_written',
  },
]);

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
    }
  }

  return out;
}

function checkDeclaredMigrationChain(repoRoot) {
  const sourceCache = new Map();
  const migrationInputOutputMap = [];
  const missingSteps = [];
  const issues = [];

  for (const step of DECLARED_MIGRATION_CHAIN) {
    const sourceRelPath = normalizeString(step.sourcePath).replaceAll(path.sep, '/');
    const sourceAbsPath = path.resolve(repoRoot, sourceRelPath);

    if (!sourceCache.has(sourceRelPath)) {
      if (!fs.existsSync(sourceAbsPath)) {
        sourceCache.set(sourceRelPath, null);
      } else {
        sourceCache.set(sourceRelPath, fs.readFileSync(sourceAbsPath, 'utf8'));
      }
    }

    const sourceText = sourceCache.get(sourceRelPath);
    const patternFound = typeof sourceText === 'string' && sourceText.includes(step.requiredPattern);

    if (sourceText === null) {
      issues.push({
        code: 'MIGRATION_SOURCE_MISSING',
        stepId: step.stepId,
        sourcePath: sourceRelPath,
      });
    }

    if (!patternFound) {
      missingSteps.push({
        stepId: step.stepId,
        sourcePath: sourceRelPath,
        missingPattern: step.requiredPattern,
      });
    }

    migrationInputOutputMap.push({
      stepId: step.stepId,
      sourcePath: sourceRelPath,
      inputCondition: step.inputCondition,
      outputGuarantee: step.outputGuarantee,
      requiredPattern: step.requiredPattern,
      verified: patternFound,
    });
  }

  const declaredStepIds = DECLARED_MIGRATION_CHAIN.map((step) => step.stepId);
  const verifiedStepIds = migrationInputOutputMap
    .filter((step) => step.verified)
    .map((step) => step.stepId);
  const declaredStepCount = declaredStepIds.length;
  const verifiedStepCount = verifiedStepIds.length;
  const coveragePct = declaredStepCount > 0
    ? Number(((verifiedStepCount / declaredStepCount) * 100).toFixed(2))
    : 0;
  const coverage100 = declaredStepCount > 0 && verifiedStepCount === declaredStepCount;

  return {
    declaredStepIds,
    verifiedStepIds,
    declaredStepCount,
    verifiedStepCount,
    coveragePct,
    coverage100,
    migrationInputOutputMap,
    missingSteps,
    issues,
  };
}

function evaluateNegativeMissingStepDetection(chainState) {
  const declaredStepIds = uniqueSortedStrings(chainState.declaredStepIds || []);
  const verifiedStepIds = uniqueSortedStrings(chainState.verifiedStepIds || []);
  if (declaredStepIds.length === 0) {
    return {
      ok: false,
      simulatedRemovedStepId: '',
      completenessOkBeforeDrop: false,
      completenessOkAfterDrop: false,
      missingStepDetected: false,
      failReason: 'DECLARED_CHAIN_EMPTY',
    };
  }

  const simulatedRemovedStepId = declaredStepIds[0];
  const simulatedVerifiedStepIds = verifiedStepIds.filter((stepId) => stepId !== simulatedRemovedStepId);
  const completenessOkBeforeDrop = declaredStepIds.every((stepId) => verifiedStepIds.includes(stepId));
  const completenessOkAfterDrop = declaredStepIds.every((stepId) => simulatedVerifiedStepIds.includes(stepId));
  const missingStepDetected = completenessOkBeforeDrop && !completenessOkAfterDrop;

  return {
    ok: missingStepDetected,
    simulatedRemovedStepId,
    completenessOkBeforeDrop,
    completenessOkAfterDrop,
    missingStepDetected,
    failReason: missingStepDetected ? '' : 'MISSING_STEP_NOT_DETECTED',
  };
}

function evaluateBackwardCompatibility(repoRoot) {
  const checks = [
    {
      checkId: 'documents_legacy_folder_constant',
      sourcePath: 'src/utils/fileManager.js',
      pattern: 'LEGACY_DOCUMENTS_FOLDER_NAME',
    },
    {
      checkId: 'documents_migration_marker_constant',
      sourcePath: 'src/utils/fileManager.js',
      pattern: 'MIGRATION_MARKER',
    },
    {
      checkId: 'userdata_legacy_folder_constant',
      sourcePath: 'src/main.js',
      pattern: 'LEGACY_USER_DATA_FOLDER_NAME',
    },
    {
      checkId: 'userdata_migration_marker_constant',
      sourcePath: 'src/main.js',
      pattern: 'MIGRATION_MARKER',
    },
    {
      checkId: 'legacy_writereditor_value',
      sourcePath: 'src/main.js',
      pattern: "'WriterEditor'",
    },
  ];

  const issues = [];
  const results = [];
  for (const check of checks) {
    const sourcePath = normalizeString(check.sourcePath).replaceAll(path.sep, '/');
    const sourceAbsPath = path.resolve(repoRoot, sourcePath);
    let sourceText = '';
    if (!fs.existsSync(sourceAbsPath)) {
      issues.push({ code: 'BACKWARD_COMPAT_SOURCE_MISSING', sourcePath });
    } else {
      sourceText = fs.readFileSync(sourceAbsPath, 'utf8');
    }

    const ok = Boolean(sourceText) && sourceText.includes(check.pattern);
    if (!ok) {
      issues.push({
        code: 'BACKWARD_COMPAT_PATTERN_MISSING',
        checkId: check.checkId,
        sourcePath,
        pattern: check.pattern,
      });
    }

    results.push({
      checkId: check.checkId,
      sourcePath,
      pattern: check.pattern,
      ok,
    });
  }

  return {
    ok: issues.length === 0,
    checks: results,
    issues,
  };
}

function evaluateSingleBlockingAuthority(repoRoot) {
  const verdict = evaluateModeMatrixVerdict({
    repoRoot,
    mode: 'pr',
    failSignalCode: 'E_REMOTE_UNAVAILABLE',
  });

  const ok = verdict.ok && verdict.evaluatorId === CANONICAL_MODE_MATRIX_EVALUATOR_ID;
  return {
    ok,
    evaluatorIdObserved: verdict.evaluatorId,
    evaluatorIdExpected: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    mode: verdict.mode,
    failSignalCode: verdict.failSignalCode,
    verdictShouldBlock: verdict.shouldBlock,
    issues: verdict.issues || [],
  };
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

export function evaluateMigrationCompletenessVerifierState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const failsignalRegistryPath = path.resolve(
    repoRoot,
    normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
  );
  const requiredSetPath = path.resolve(
    repoRoot,
    normalizeString(input.requiredSetPath || DEFAULT_REQUIRED_SET_PATH),
  );

  const chainState = checkDeclaredMigrationChain(repoRoot);
  const negativeMissingStep = evaluateNegativeMissingStepDetection(chainState);
  const backwardCompatibility = evaluateBackwardCompatibility(repoRoot);
  const singleBlockingAuthority = evaluateSingleBlockingAuthority(repoRoot);
  const safetyParity = evaluateSafetyParity(repoRoot, requiredSetPath);
  const driftState = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryPath);

  const advisoryToBlockingDriftCount = driftState.advisoryToBlockingDriftCount;
  const advisoryToBlockingDriftCountZero = advisoryToBlockingDriftCount === 0;

  const issues = [
    ...chainState.issues,
    ...backwardCompatibility.issues,
    ...singleBlockingAuthority.issues,
    ...safetyParity.issues,
  ];
  if (!driftState.ok) issues.push(...driftState.issues);

  const migrationGapReport = {
    declaredStepCount: chainState.declaredStepCount,
    verifiedStepCount: chainState.verifiedStepCount,
    coveragePct: chainState.coveragePct,
    coverage100: chainState.coverage100,
    missingStepCount: chainState.missingSteps.length,
    missingSteps: chainState.missingSteps,
  };

  const ok = issues.length === 0
    && chainState.coverage100
    && negativeMissingStep.ok
    && backwardCompatibility.ok
    && singleBlockingAuthority.ok
    && safetyParity.ok
    && advisoryToBlockingDriftCountZero;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignalCode: ok ? '' : FAIL_SIGNAL_CODE,
    failReason: ok ? '' : (
      !chainState.coverage100
        ? 'MIGRATION_COVERAGE_FAIL'
        : !negativeMissingStep.ok
          ? 'MISSING_STEP_NOT_DETECTED'
          : !backwardCompatibility.ok
            ? 'BACKWARD_COMPATIBILITY_FAIL'
            : !singleBlockingAuthority.ok
              ? 'DUAL_AUTHORITY'
              : !advisoryToBlockingDriftCountZero
                ? 'ADVISORY_BLOCKING_DRIFT_NONZERO'
                : !safetyParity.ok
                  ? 'SAFETY_PARITY_FAIL'
                  : 'MIGRATION_VERIFIER_ISSUES'
    ),
    migrationCoverage: {
      declaredStepCount: chainState.declaredStepCount,
      verifiedStepCount: chainState.verifiedStepCount,
      coveragePct: chainState.coveragePct,
      coverage100: chainState.coverage100,
    },
    migrationInputOutputMap: chainState.migrationInputOutputMap,
    migrationGapReport,
    migrationNegativeMissingStep: negativeMissingStep,
    backwardCompatibility,
    singleBlockingAuthority,
    safetyParity,
    advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero,
    driftCases: driftState.driftCases,
    failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),
    requiredSetPath: path.relative(repoRoot, requiredSetPath).replaceAll(path.sep, '/'),
    issues,
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`P1_04_MIGRATION_DECLARED_STEP_COUNT=${state.migrationCoverage.declaredStepCount}`);
  console.log(`P1_04_MIGRATION_VERIFIED_STEP_COUNT=${state.migrationCoverage.verifiedStepCount}`);
  console.log(`P1_04_MIGRATION_COVERAGE_PCT=${state.migrationCoverage.coveragePct}`);
  console.log(`P1_04_MIGRATION_COVERAGE_100=${state.migrationCoverage.coverage100 ? 1 : 0}`);
  console.log(`P1_04_MISSING_STEP_NEGATIVE_OK=${state.migrationNegativeMissingStep.ok ? 1 : 0}`);
  console.log(`P1_04_BACKWARD_COMPATIBILITY_OK=${state.backwardCompatibility.ok ? 1 : 0}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.advisoryToBlockingDriftCount}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT_ZERO=${state.advisoryToBlockingDriftCountZero ? 1 : 0}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateMigrationCompletenessVerifierState({
    failsignalRegistryPath: args.failsignalRegistryPath,
    requiredSetPath: args.requiredSetPath,
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
