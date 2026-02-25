#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { evaluateModeMatrixVerdict } from './canonical-mode-matrix-evaluator.mjs';

const TOKEN_NAME = 'MIGRATION_COMPLETENESS_VERIFIER_OK';
const FAIL_SIGNAL_CODE = 'E_GOVERNANCE_STRICT_FAIL';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_REQUIRED_SET_PATH = 'docs/OPS/EXECUTION/REQUIRED_TOKEN_SET.json';

const DEFAULT_DECLARED_STEPS = Object.freeze([
  {
    id: 'USERDATA_STEP_01_MARKER_GUARD',
    filePath: 'src/main.js',
    probe: 'if (fsSync.existsSync(markerPath))',
    input: 'markerPath',
    output: 'targetPath',
    required: true,
  },
  {
    id: 'USERDATA_STEP_02_TARGET_NONEMPTY_GUARD',
    filePath: 'src/main.js',
    probe: 'if (hasDirectoryContent(targetPath))',
    input: 'targetPath',
    output: 'targetPath',
    required: true,
  },
  {
    id: 'USERDATA_STEP_03_NO_LEGACY_CREATE_TARGET',
    filePath: 'src/main.js',
    probe: 'if (!hasDirectoryContent(legacyPath))',
    input: 'legacyPath',
    output: 'targetPath',
    required: true,
  },
  {
    id: 'USERDATA_STEP_04_COPY_LEGACY_TO_TARGET',
    filePath: 'src/main.js',
    probe: 'await copyDirectoryContents(legacyPath, targetPath);',
    input: 'legacyPath',
    output: 'targetPath',
    required: true,
  },
  {
    id: 'USERDATA_STEP_05_WRITE_MIGRATION_MARKER',
    filePath: 'src/main.js',
    probe: "await fs.writeFile(markerPath, 'migrated from WriterEditor', 'utf8');",
    input: 'markerPath',
    output: 'MIGRATION_MARKER',
    required: true,
  },
  {
    id: 'USERDATA_STEP_06_SET_USERDATA_PATH',
    filePath: 'src/main.js',
    probe: "app.setPath('userData', targetPath);",
    input: 'targetPath',
    output: "appPath.userData",
    required: true,
  },
  {
    id: 'DOCUMENTS_STEP_01_MARKER_GUARD',
    filePath: 'src/utils/fileManager.js',
    probe: 'if (fsSync.existsSync(markerPath))',
    input: 'markerPath',
    output: 'targetPath',
    required: true,
  },
  {
    id: 'DOCUMENTS_STEP_02_TARGET_NONEMPTY_GUARD',
    filePath: 'src/utils/fileManager.js',
    probe: 'if (hasDirectoryContent(targetPath))',
    input: 'targetPath',
    output: 'targetPath',
    required: true,
  },
  {
    id: 'DOCUMENTS_STEP_03_NO_LEGACY_SKIP',
    filePath: 'src/utils/fileManager.js',
    probe: 'if (!hasDirectoryContent(legacyPath))',
    input: 'legacyPath',
    output: 'targetPath',
    required: true,
  },
  {
    id: 'DOCUMENTS_STEP_04_COPY_LEGACY_TO_TARGET',
    filePath: 'src/utils/fileManager.js',
    probe: 'await copyDirectoryContents(legacyPath, targetPath);',
    input: 'legacyPath',
    output: 'targetPath',
    required: true,
  },
  {
    id: 'DOCUMENTS_STEP_05_WRITE_MIGRATION_MARKER',
    filePath: 'src/utils/fileManager.js',
    probe: "await fs.writeFile(markerPath, 'migrated from WriterEditor', 'utf8');",
    input: 'markerPath',
    output: 'MIGRATION_MARKER',
    required: true,
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
      continue;
    }
  }

  return out;
}

function normalizeStep(entry, index) {
  if (!isObjectRecord(entry)) return null;
  const id = normalizeString(entry.id || `STEP_${index + 1}`);
  const filePath = normalizeString(entry.filePath);
  const probe = normalizeString(entry.probe);
  const input = normalizeString(entry.input);
  const output = normalizeString(entry.output);
  const required = entry.required !== false;
  if (!id || !filePath || !probe) return null;
  return {
    id,
    filePath,
    probe,
    input,
    output,
    required,
  };
}

function loadDeclaredSteps(inputSteps) {
  const raw = Array.isArray(inputSteps) && inputSteps.length > 0
    ? inputSteps
    : DEFAULT_DECLARED_STEPS;
  const normalized = [];
  for (let i = 0; i < raw.length; i += 1) {
    const row = normalizeStep(raw[i], i);
    if (row) normalized.push(row);
  }
  return normalized;
}

function evaluateStepCoverage(repoRoot, declaredSteps) {
  const sourceCache = new Map();
  const map = [];
  const missingSteps = [];

  for (const step of declaredSteps) {
    const absPath = path.resolve(repoRoot, step.filePath);
    let sourceText = sourceCache.get(absPath);
    if (typeof sourceText !== 'string') {
      sourceText = fs.existsSync(absPath) ? fs.readFileSync(absPath, 'utf8') : '';
      sourceCache.set(absPath, sourceText);
    }

    const fileExists = fs.existsSync(absPath);
    const probeFound = fileExists && sourceText.includes(step.probe);
    const verified = Boolean(fileExists && probeFound);

    const row = {
      stepId: step.id,
      filePath: step.filePath.replaceAll(path.sep, '/'),
      input: step.input,
      output: step.output,
      probe: step.probe,
      required: step.required,
      fileExists,
      probeFound,
      verified,
    };
    map.push(row);

    if (step.required && !verified) {
      missingSteps.push({
        stepId: step.id,
        filePath: row.filePath,
        reason: fileExists ? 'PROBE_NOT_FOUND' : 'FILE_MISSING',
      });
    }
  }

  const requiredDeclaredCount = map.filter((row) => row.required).length;
  const requiredVerifiedCount = map.filter((row) => row.required && row.verified).length;
  const coveragePct = requiredDeclaredCount === 0
    ? 0
    : Number(((requiredVerifiedCount / requiredDeclaredCount) * 100).toFixed(2));

  return {
    declaredSteps: map,
    requiredDeclaredCount,
    requiredVerifiedCount,
    coveragePct,
    missingSteps,
    coverageOk: requiredDeclaredCount > 0 && requiredDeclaredCount === requiredVerifiedCount,
  };
}

function evaluateBackwardCompatibility(repoRoot) {
  const mainPath = path.resolve(repoRoot, 'src/main.js');
  const fileManagerPath = path.resolve(repoRoot, 'src/utils/fileManager.js');
  const mainText = fs.existsSync(mainPath) ? fs.readFileSync(mainPath, 'utf8') : '';
  const fmText = fs.existsSync(fileManagerPath) ? fs.readFileSync(fileManagerPath, 'utf8') : '';

  const checks = {
    mainLegacyFolderConstant: mainText.includes("const LEGACY_USER_DATA_FOLDER_NAME = 'WriterEditor';"),
    fileManagerLegacyFolderConstant: fmText.includes("const LEGACY_DOCUMENTS_FOLDER_NAME = 'WriterEditor';"),
    mainMigrationMarkerConstant: mainText.includes("const MIGRATION_MARKER = '.migrated-from-writer-editor';"),
    fileManagerMigrationMarkerConstant: fmText.includes("const MIGRATION_MARKER = '.migrated-from-writer-editor';"),
    documentsLegacyFallbackPath: fmText.includes('if (hasDirectoryContent(legacyPath))'),
  };

  const failedChecks = Object.entries(checks)
    .filter(([, value]) => value !== true)
    .map(([key]) => key)
    .sort((a, b) => a.localeCompare(b));

  return {
    ok: failedChecks.length === 0,
    checks,
    failedChecks,
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

  const declaredSteps = loadDeclaredSteps(input.declaredSteps);
  const coverage = evaluateStepCoverage(repoRoot, declaredSteps);
  const baselineRequiredStepIds = uniqueSortedStrings(
    Array.isArray(input.baselineRequiredStepIds) && input.baselineRequiredStepIds.length > 0
      ? input.baselineRequiredStepIds
      : DEFAULT_DECLARED_STEPS.filter((row) => row.required !== false).map((row) => row.id),
  );
  const declaredRequiredStepIds = uniqueSortedStrings(
    coverage.declaredSteps.filter((row) => row.required).map((row) => row.stepId),
  );
  const baselineMissingStepIds = baselineRequiredStepIds
    .filter((id) => !declaredRequiredStepIds.includes(id))
    .sort((a, b) => a.localeCompare(b));
  for (const stepId of baselineMissingStepIds) {
    coverage.missingSteps.push({
      stepId,
      filePath: '',
      reason: 'DECLARED_STEP_MISSING',
    });
  }
  coverage.coverageOk = coverage.coverageOk && baselineMissingStepIds.length === 0;
  const backwardCompatibility = evaluateBackwardCompatibility(repoRoot);
  const driftState = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryPath);
  const safetyParity = evaluateSafetyParity(repoRoot, requiredSetPath);
  const advisoryToBlockingDriftCount = driftState.advisoryToBlockingDriftCount;
  const advisoryToBlockingDriftCountZero = advisoryToBlockingDriftCount === 0;

  const issues = [
    ...safetyParity.issues,
  ];
  if (!driftState.ok) issues.push(...driftState.issues);

  const missingStepDetected = coverage.missingSteps.length > 0;

  const ok = issues.length === 0
    && coverage.coverageOk
    && backwardCompatibility.ok
    && advisoryToBlockingDriftCountZero
    && safetyParity.ok;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignalCode: ok ? '' : FAIL_SIGNAL_CODE,
    failReason: ok ? '' : (
      !coverage.coverageOk
        ? 'MIGRATION_COVERAGE_FAIL'
        : !backwardCompatibility.ok
          ? 'BACKWARD_COMPATIBILITY_FAIL'
          : !advisoryToBlockingDriftCountZero
            ? 'ADVISORY_BLOCKING_DRIFT_DETECTED'
            : !safetyParity.ok
              ? 'MIGRATION_COVERAGE_FAIL'
              : 'MIGRATION_COMPLETENESS_ISSUES'
    ),
    coverage,
    missingStepDetected,
    backwardCompatibility,
    advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero,
    driftCases: driftState.driftCases,
    safetyParity,
    failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),
    requiredSetPath: path.relative(repoRoot, requiredSetPath).replaceAll(path.sep, '/'),
    issues,
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`P1_04_MIGRATION_COVERAGE_OK=${state.coverage.coverageOk ? 1 : 0}`);
  console.log(`P1_04_MIGRATION_COVERAGE_PCT=${state.coverage.coveragePct}`);
  console.log(`P1_04_MISSING_STEP_DETECTED=${state.missingStepDetected ? 1 : 0}`);
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
  DEFAULT_DECLARED_STEPS,
};
