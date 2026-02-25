#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRequiredTokenSetFromProfile } from './generate-required-token-set.mjs';
import { evaluateModeMatrixVerdict } from './canonical-mode-matrix-evaluator.mjs';

const TOKEN_NAME = 'DECLARED_SET_EFFECTIVE_SET_ALIGNMENT_OK';
const FAIL_SIGNAL_CODE = 'E_REQUIRED_TOKEN_SET_DRIFT';
const DEFAULT_PROFILE_PATH = 'docs/OPS/EXECUTION/EXECUTION_PROFILE.example.json';
const DEFAULT_REQUIRED_SET_PATH = 'docs/OPS/EXECUTION/REQUIRED_TOKEN_SET.json';
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

function uniqueSortedStrings(values) {
  if (!Array.isArray(values)) return [];
  const unique = new Set();
  for (const raw of values) {
    const token = normalizeString(String(raw || ''));
    if (!token) continue;
    unique.add(token);
  }
  return [...unique].sort((a, b) => a.localeCompare(b));
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
    profilePath: '',
    requiredSetPath: '',
    failsignalRegistryPath: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--json') {
      out.json = true;
      continue;
    }

    if (arg === '--profile-path' && i + 1 < argv.length) {
      out.profilePath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--profile-path=')) {
      out.profilePath = normalizeString(arg.slice('--profile-path='.length));
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

function evaluateAdvisoryToBlockingDrift(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const failsignalRegistryPath = path.resolve(
    repoRoot,
    normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
  );

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

export function evaluateDeclaredSetVsEffectiveSetAlignment(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const profilePath = path.resolve(
    repoRoot,
    normalizeString(input.profilePath || process.env.EXECUTION_PROFILE_PATH || DEFAULT_PROFILE_PATH),
  );
  const requiredSetPath = path.resolve(
    repoRoot,
    normalizeString(input.requiredSetPath || process.env.REQUIRED_TOKEN_SET_PATH || DEFAULT_REQUIRED_SET_PATH),
  );
  const failsignalRegistryPath = path.resolve(
    repoRoot,
    normalizeString(input.failsignalRegistryPath || process.env.FAILSIGNAL_REGISTRY_PATH || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
  );

  const profileDoc = readJsonObject(profilePath);
  const requiredSetDoc = readJsonObject(requiredSetPath);
  const issues = [];

  if (!profileDoc) {
    issues.push({ code: 'PROFILE_UNREADABLE' });
  }
  if (!requiredSetDoc || !isObjectRecord(requiredSetDoc.requiredSets)) {
    issues.push({ code: 'REQUIRED_SET_UNREADABLE' });
  }

  const generated = profileDoc
    ? buildRequiredTokenSetFromProfile(profileDoc)
    : { ok: false, failures: ['PROFILE_UNREADABLE'], requiredTokenSet: null };

  if (!generated.ok || !generated.requiredTokenSet || !isObjectRecord(generated.requiredTokenSet.requiredSets)) {
    issues.push({
      code: 'EFFECTIVE_SET_GENERATION_FAILED',
      failures: Array.isArray(generated.failures) ? generated.failures : [],
    });
  }

  const declaredReleaseSet = uniqueSortedStrings(
    requiredSetDoc && isObjectRecord(requiredSetDoc.requiredSets)
      ? requiredSetDoc.requiredSets.release
      : [],
  );

  const effectiveMachineSet = uniqueSortedStrings(
    generated && generated.requiredTokenSet && isObjectRecord(generated.requiredTokenSet.requiredSets)
      ? generated.requiredTokenSet.requiredSets.release
      : [],
  );

  const effectiveSet = new Set(effectiveMachineSet);
  const declaredSet = new Set(declaredReleaseSet);

  const declaredReleaseSetMinusEffectiveMachineSet = declaredReleaseSet.filter((token) => !effectiveSet.has(token));
  const effectiveMachineSetMinusDeclaredReleaseSet = effectiveMachineSet.filter((token) => !declaredSet.has(token));

  const declaredReleaseSetMinusEffectiveMachineSetEmpty = declaredReleaseSetMinusEffectiveMachineSet.length === 0;
  const effectiveMachineSetMinusDeclaredReleaseSetEmpty = effectiveMachineSetMinusDeclaredReleaseSet.length === 0;
  const alignmentOk = declaredReleaseSetMinusEffectiveMachineSetEmpty && effectiveMachineSetMinusDeclaredReleaseSetEmpty;

  const driftState = evaluateAdvisoryToBlockingDrift({
    repoRoot,
    failsignalRegistryPath,
  });

  if (!driftState.ok) {
    issues.push(...driftState.issues);
  }

  const advisoryToBlockingDriftCount = driftState.advisoryToBlockingDriftCount;
  const advisoryToBlockingDriftCountZero = advisoryToBlockingDriftCount === 0;

  const ok = issues.length === 0 && alignmentOk && advisoryToBlockingDriftCountZero;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failSignalCode: ok ? '' : FAIL_SIGNAL_CODE,
    failReason: ok
      ? ''
      : (!alignmentOk
        ? 'DECLARED_EFFECTIVE_SET_MISMATCH'
        : 'ADVISORY_TO_BLOCKING_DRIFT_NONZERO'),
    profilePath: path.relative(repoRoot, profilePath).replaceAll(path.sep, '/'),
    requiredSetPath: path.relative(repoRoot, requiredSetPath).replaceAll(path.sep, '/'),
    failsignalRegistryPath: path.relative(repoRoot, failsignalRegistryPath).replaceAll(path.sep, '/'),
    declaredReleaseSet,
    effectiveMachineSet,
    declaredReleaseSetMinusEffectiveMachineSet,
    effectiveMachineSetMinusDeclaredReleaseSet,
    declaredReleaseSetMinusEffectiveMachineSetCount: declaredReleaseSetMinusEffectiveMachineSet.length,
    effectiveMachineSetMinusDeclaredReleaseSetCount: effectiveMachineSetMinusDeclaredReleaseSet.length,
    declaredReleaseSetMinusEffectiveMachineSetEmpty,
    effectiveMachineSetMinusDeclaredReleaseSetEmpty,
    alignmentOk,
    advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero,
    driftCases: driftState.driftCases,
    issues,
  };
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`DECLARED_RELEASE_SET_COUNT=${state.declaredReleaseSet.length}`);
  console.log(`EFFECTIVE_MACHINE_SET_COUNT=${state.effectiveMachineSet.length}`);
  console.log(`DECLARED_RELEASE_SET_MINUS_EFFECTIVE_MACHINE_SET_COUNT=${state.declaredReleaseSetMinusEffectiveMachineSetCount}`);
  console.log(`EFFECTIVE_MACHINE_SET_MINUS_DECLARED_RELEASE_SET_COUNT=${state.effectiveMachineSetMinusDeclaredReleaseSetCount}`);
  console.log(`DECLARED_RELEASE_SET_MINUS_EFFECTIVE_MACHINE_SET_EMPTY=${state.declaredReleaseSetMinusEffectiveMachineSetEmpty ? 1 : 0}`);
  console.log(`EFFECTIVE_MACHINE_SET_MINUS_DECLARED_RELEASE_SET_EMPTY=${state.effectiveMachineSetMinusDeclaredReleaseSetEmpty ? 1 : 0}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.advisoryToBlockingDriftCount}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT_ZERO=${state.advisoryToBlockingDriftCountZero ? 1 : 0}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateDeclaredSetVsEffectiveSetAlignment({
    profilePath: args.profilePath,
    requiredSetPath: args.requiredSetPath,
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
