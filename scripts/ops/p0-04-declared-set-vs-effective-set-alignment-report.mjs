#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { evaluateDeclaredSetVsEffectiveSetAlignment } from './declared-set-vs-effective-set-alignment-state.mjs';

const DEFAULT_OUTPUT_DIR = 'docs/OPS/EVIDENCE/P0_CONTOUR/TICKET_04';
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

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    outputDir: DEFAULT_OUTPUT_DIR,
    runId: '',
    ticketId: '',
    profilePath: DEFAULT_PROFILE_PATH,
    requiredSetPath: DEFAULT_REQUIRED_SET_PATH,
    failsignalRegistryPath: DEFAULT_FAILSIGNAL_REGISTRY_PATH,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;

    if (arg === '--output-dir' && i + 1 < argv.length) {
      out.outputDir = normalizeString(argv[i + 1]) || DEFAULT_OUTPUT_DIR;
      i += 1;
      continue;
    }
    if (arg.startsWith('--output-dir=')) {
      out.outputDir = normalizeString(arg.slice('--output-dir='.length)) || DEFAULT_OUTPUT_DIR;
      continue;
    }

    if (arg === '--run-id' && i + 1 < argv.length) {
      out.runId = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--run-id=')) {
      out.runId = normalizeString(arg.slice('--run-id='.length));
      continue;
    }

    if (arg === '--ticket-id' && i + 1 < argv.length) {
      out.ticketId = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--ticket-id=')) {
      out.ticketId = normalizeString(arg.slice('--ticket-id='.length));
      continue;
    }

    if (arg === '--profile-path' && i + 1 < argv.length) {
      out.profilePath = normalizeString(argv[i + 1]) || DEFAULT_PROFILE_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--profile-path=')) {
      out.profilePath = normalizeString(arg.slice('--profile-path='.length)) || DEFAULT_PROFILE_PATH;
      continue;
    }

    if (arg === '--required-set-path' && i + 1 < argv.length) {
      out.requiredSetPath = normalizeString(argv[i + 1]) || DEFAULT_REQUIRED_SET_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--required-set-path=')) {
      out.requiredSetPath = normalizeString(arg.slice('--required-set-path='.length)) || DEFAULT_REQUIRED_SET_PATH;
      continue;
    }

    if (arg === '--failsignal-registry-path' && i + 1 < argv.length) {
      out.failsignalRegistryPath = normalizeString(argv[i + 1]) || DEFAULT_FAILSIGNAL_REGISTRY_PATH;
      i += 1;
      continue;
    }
    if (arg.startsWith('--failsignal-registry-path=')) {
      out.failsignalRegistryPath = normalizeString(arg.slice('--failsignal-registry-path='.length)) || DEFAULT_FAILSIGNAL_REGISTRY_PATH;
    }
  }

  return out;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${stableStringify(value)}\n`, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function runAlignmentCheck(repoRoot, args) {
  const state = evaluateDeclaredSetVsEffectiveSetAlignment({
    repoRoot,
    profilePath: path.resolve(repoRoot, args.profilePath),
    requiredSetPath: path.resolve(repoRoot, args.requiredSetPath),
    failsignalRegistryPath: path.resolve(repoRoot, args.failsignalRegistryPath),
  });

  const ok = state.ok
    && state.alignmentOk
    && state.declaredReleaseSetMinusEffectiveMachineSetEmpty
    && state.effectiveMachineSetMinusDeclaredReleaseSetEmpty;

  return {
    ok,
    alignmentOk: state.alignmentOk,
    declaredReleaseSetMinusEffectiveMachineSetCount: state.declaredReleaseSetMinusEffectiveMachineSetCount,
    effectiveMachineSetMinusDeclaredReleaseSetCount: state.effectiveMachineSetMinusDeclaredReleaseSetCount,
    declaredReleaseSetCount: state.declaredReleaseSet.length,
    effectiveMachineSetCount: state.effectiveMachineSet.length,
    advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
    advisoryToBlockingDriftCountZero: state.advisoryToBlockingDriftCountZero,
    state,
  };
}

function runNegativeDropCheck(repoRoot, args, baselineState) {
  const requiredSetDoc = readJson(path.resolve(repoRoot, args.requiredSetPath));
  const releaseDeclared = Array.isArray(requiredSetDoc?.requiredSets?.release)
    ? requiredSetDoc.requiredSets.release.map((entry) => normalizeString(String(entry || ''))).filter(Boolean)
    : [];

  const targetTokenId = normalizeString(releaseDeclared[0] || '');
  if (!targetTokenId) {
    return {
      ok: false,
      failReason: 'NO_DECLARED_RELEASE_TOKEN',
      targetTokenId: '',
      mutatedAlignmentOk: false,
      expectedMissingTokenDetected: false,
      state: null,
    };
  }

  requiredSetDoc.requiredSets.release = releaseDeclared.filter((token) => token !== targetTokenId);
  if (Array.isArray(requiredSetDoc?.requiredSets?.active)) {
    requiredSetDoc.requiredSets.active = requiredSetDoc.requiredSets.active
      .map((entry) => normalizeString(String(entry || '')))
      .filter((token) => token && token !== targetTokenId);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p0-04-negative-drop-'));
  const mutatedRequiredSetPath = path.join(tmpDir, 'REQUIRED_TOKEN_SET.mutated.json');
  fs.writeFileSync(mutatedRequiredSetPath, `${JSON.stringify(requiredSetDoc, null, 2)}\n`, 'utf8');

  const mutatedState = evaluateDeclaredSetVsEffectiveSetAlignment({
    repoRoot,
    profilePath: path.resolve(repoRoot, args.profilePath),
    requiredSetPath: mutatedRequiredSetPath,
    failsignalRegistryPath: path.resolve(repoRoot, args.failsignalRegistryPath),
  });

  fs.rmSync(tmpDir, { recursive: true, force: true });

  const expectedMissingTokenDetected = mutatedState.effectiveMachineSetMinusDeclaredReleaseSet.includes(targetTokenId)
    || mutatedState.declaredReleaseSetMinusEffectiveMachineSet.includes(targetTokenId);

  const ok = baselineState.ok
    && mutatedState.ok === false
    && mutatedState.alignmentOk === false
    && expectedMissingTokenDetected;

  return {
    ok,
    targetTokenId,
    mutatedAlignmentOk: mutatedState.alignmentOk,
    expectedMissingTokenDetected,
    mutatedDeclaredReleaseSetMinusEffectiveMachineSetCount: mutatedState.declaredReleaseSetMinusEffectiveMachineSetCount,
    mutatedEffectiveMachineSetMinusDeclaredReleaseSetCount: mutatedState.effectiveMachineSetMinusDeclaredReleaseSetCount,
    mutatedAdvisoryToBlockingDriftCount: mutatedState.advisoryToBlockingDriftCount,
    state: {
      ok: mutatedState.ok,
      failReason: mutatedState.failReason,
      failSignalCode: mutatedState.failSignalCode,
      alignmentOk: mutatedState.alignmentOk,
      declaredReleaseSetMinusEffectiveMachineSetCount: mutatedState.declaredReleaseSetMinusEffectiveMachineSetCount,
      effectiveMachineSetMinusDeclaredReleaseSetCount: mutatedState.effectiveMachineSetMinusDeclaredReleaseSetCount,
      effectiveMachineSetMinusDeclaredReleaseSet: mutatedState.effectiveMachineSetMinusDeclaredReleaseSet,
      declaredReleaseSetMinusEffectiveMachineSet: mutatedState.declaredReleaseSetMinusEffectiveMachineSet,
    },
  };
}

function runRepeatablePass3(repoRoot, args) {
  const runs = [];
  for (let i = 0; i < 3; i += 1) {
    const state = evaluateDeclaredSetVsEffectiveSetAlignment({
      repoRoot,
      profilePath: path.resolve(repoRoot, args.profilePath),
      requiredSetPath: path.resolve(repoRoot, args.requiredSetPath),
      failsignalRegistryPath: path.resolve(repoRoot, args.failsignalRegistryPath),
    });

    runs.push({
      run: i + 1,
      ok: state.ok,
      alignmentOk: state.alignmentOk,
      declaredReleaseSetMinusEffectiveMachineSetCount: state.declaredReleaseSetMinusEffectiveMachineSetCount,
      effectiveMachineSetMinusDeclaredReleaseSetCount: state.effectiveMachineSetMinusDeclaredReleaseSetCount,
      advisoryToBlockingDriftCount: state.advisoryToBlockingDriftCount,
      failReason: state.failReason,
    });
  }

  const baseline = JSON.stringify({
    ok: runs[0].ok,
    alignmentOk: runs[0].alignmentOk,
    declaredReleaseSetMinusEffectiveMachineSetCount: runs[0].declaredReleaseSetMinusEffectiveMachineSetCount,
    effectiveMachineSetMinusDeclaredReleaseSetCount: runs[0].effectiveMachineSetMinusDeclaredReleaseSetCount,
    advisoryToBlockingDriftCount: runs[0].advisoryToBlockingDriftCount,
    failReason: runs[0].failReason,
  });

  const identical = runs.every((entry) => JSON.stringify({
    ok: entry.ok,
    alignmentOk: entry.alignmentOk,
    declaredReleaseSetMinusEffectiveMachineSetCount: entry.declaredReleaseSetMinusEffectiveMachineSetCount,
    effectiveMachineSetMinusDeclaredReleaseSetCount: entry.effectiveMachineSetMinusDeclaredReleaseSetCount,
    advisoryToBlockingDriftCount: entry.advisoryToBlockingDriftCount,
    failReason: entry.failReason,
  }) === baseline);

  const ok = identical && runs.every((entry) => entry.ok === true && entry.alignmentOk === true);

  return {
    ok,
    identical,
    runs,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const outputDir = path.resolve(repoRoot, args.outputDir);

  const alignment = runAlignmentCheck(repoRoot, args);
  const negativeDrop = runNegativeDropCheck(repoRoot, args, alignment);
  const repeatable = runRepeatablePass3(repoRoot, args);

  const gates = {
    p0_04_alignment_check: alignment.ok ? 'PASS' : 'FAIL',
    p0_04_negative_drop_check: negativeDrop.ok ? 'PASS' : 'FAIL',
    p0_04_repeatable_pass_3runs: repeatable.ok ? 'PASS' : 'FAIL',
    advisory_to_blocking_drift_count_zero: alignment.advisoryToBlockingDriftCountZero ? 'PASS' : 'FAIL',
  };

  const summary = {
    status: Object.values(gates).every((value) => value === 'PASS') ? 'PASS' : 'FAIL',
    runId: args.runId || process.env.RUN_ID || '',
    ticketId: args.ticketId || process.env.TICKET_ID || '',
    declaredReleaseSetCount: alignment.declaredReleaseSetCount,
    effectiveMachineSetCount: alignment.effectiveMachineSetCount,
    declaredReleaseSetMinusEffectiveMachineSetCount: alignment.declaredReleaseSetMinusEffectiveMachineSetCount,
    effectiveMachineSetMinusDeclaredReleaseSetCount: alignment.effectiveMachineSetMinusDeclaredReleaseSetCount,
    advisoryToBlockingDriftCount: alignment.advisoryToBlockingDriftCount,
    gates,
    generatedAtUtc: new Date().toISOString(),
  };

  const report = {
    reportId: 'P0_04_DECLARED_SET_EFFECTIVE_SET_ALIGNMENT_REPORT_V1',
    ...summary,
    declaredReleaseSetMinusEffectiveMachineSet: alignment.state.declaredReleaseSetMinusEffectiveMachineSet,
    effectiveMachineSetMinusDeclaredReleaseSet: alignment.state.effectiveMachineSetMinusDeclaredReleaseSet,
    alignmentOk: alignment.alignmentOk,
    negativeDrop,
    repeatable,
  };

  const ticketMeta = {
    runId: summary.runId,
    ticketId: summary.ticketId,
    outputDir: path.relative(repoRoot, outputDir).replaceAll(path.sep, '/'),
    generatedAtUtc: summary.generatedAtUtc,
  };

  writeJson(path.join(outputDir, 'declared-vs-effective-set-diff.json'), {
    declaredReleaseSetCount: alignment.declaredReleaseSetCount,
    effectiveMachineSetCount: alignment.effectiveMachineSetCount,
    declaredReleaseSet: alignment.state.declaredReleaseSet,
    effectiveMachineSet: alignment.state.effectiveMachineSet,
    declaredReleaseSetMinusEffectiveMachineSet: alignment.state.declaredReleaseSetMinusEffectiveMachineSet,
    effectiveMachineSetMinusDeclaredReleaseSet: alignment.state.effectiveMachineSetMinusDeclaredReleaseSet,
    declaredReleaseSetMinusEffectiveMachineSetCount: alignment.declaredReleaseSetMinusEffectiveMachineSetCount,
    effectiveMachineSetMinusDeclaredReleaseSetCount: alignment.effectiveMachineSetMinusDeclaredReleaseSetCount,
    declaredReleaseSetMinusEffectiveMachineSetEmpty: alignment.state.declaredReleaseSetMinusEffectiveMachineSetEmpty,
    effectiveMachineSetMinusDeclaredReleaseSetEmpty: alignment.state.effectiveMachineSetMinusDeclaredReleaseSetEmpty,
    alignmentOk: alignment.alignmentOk,
  });

  writeJson(path.join(outputDir, 'p0-04-negative-drop-check.json'), negativeDrop);
  writeJson(path.join(outputDir, 'repeatable-pass-3runs.json'), repeatable);
  writeJson(path.join(outputDir, 'p0-04-alignment-report.json'), report);
  writeJson(path.join(outputDir, 'summary.json'), summary);
  writeJson(path.join(outputDir, 'ticket-meta.json'), ticketMeta);

  process.stdout.write(`${stableStringify(summary)}\n`);
  process.exit(summary.status === 'PASS' ? 0 : 1);
}

main();
