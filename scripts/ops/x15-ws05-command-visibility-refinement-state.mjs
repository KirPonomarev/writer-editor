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

const TOKEN_NAME = 'X15_WS05_COMMAND_VISIBILITY_REFINEMENT_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';

const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_VISIBILITY_MATRIX_PATH = 'docs/OPS/STATUS/COMMAND_VISIBILITY_MATRIX.json';
const DEFAULT_REFINEMENT_PATH = 'docs/OPS/STATUS/X15_COMMAND_VISIBILITY_REFINEMENT_v1.json';
const DEFAULT_CAPABILITY_POLICY_PATH = 'src/renderer/commands/capabilityPolicy.mjs';

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
    failsignalRegistryPath: '',
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

function parseCapabilityObjectFromSource(rawSource, exportName) {
  const pattern = new RegExp(`export\\s+const\\s+${exportName}\\s*=\\s*Object\\.freeze\\((\\{[\\s\\S]*?\\})\\);`);
  const match = String(rawSource || '').match(pattern);
  if (!match || !match[1]) {
    return {
      ok: false,
      value: {},
      reason: `${exportName}_NOT_FOUND`,
    };
  }

  try {
    const parsed = Function(`"use strict"; return (${match[1]});`)();
    if (!isObjectRecord(parsed)) {
      return {
        ok: false,
        value: {},
        reason: `${exportName}_NOT_OBJECT`,
      };
    }
    return {
      ok: true,
      value: parsed,
      reason: '',
    };
  } catch {
    return {
      ok: false,
      value: {},
      reason: `${exportName}_PARSE_ERROR`,
    };
  }
}

function toUniqueStrings(value, { lower = false, sort = true } = {}) {
  const source = Array.isArray(value) ? value : [];
  const out = [];
  const seen = new Set();
  for (const raw of source) {
    let normalized = normalizeString(String(raw || ''));
    if (!normalized) continue;
    if (lower) normalized = normalized.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  if (sort) out.sort((a, b) => a.localeCompare(b));
  return out;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
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
  const ok = observedStatus === 'ACTIVE_CANON'
    && observedVersion.toLowerCase() === EXPECTED_CANON_VERSION;

  return {
    ok,
    reason: ok ? '' : 'ACTIVE_CANON_LOCK_FAIL',
    observedStatus,
    observedVersion,
  };
}

function normalizeRefinementDoc(doc) {
  const source = isObjectRecord(doc) ? doc : {};
  return {
    schemaVersion: Number(source.schemaVersion) || 1,
    refinementVersion: normalizeString(source.refinementVersion),
    channels: toUniqueStrings(source.channels, { sort: false }),
    modes: toUniqueStrings(source.modes, { sort: false }),
    profiles: toUniqueStrings(source.profiles, { lower: true, sort: false }),
    states: toUniqueStrings(source.states, { sort: false }),
    requiredCoreCommands: toUniqueStrings(source.requiredCoreCommands),
    entries: Array.isArray(source.entries) ? source.entries : [],
  };
}

function validateRefinement({
  refinement,
  capabilityBinding,
  capabilityNode,
  globalCoreSafety,
}) {
  const channels = refinement.channels;
  const modes = new Set(refinement.modes);
  const profiles = new Set(refinement.profiles);
  const states = new Set(refinement.states);

  const unknownModes = [];
  const unknownProfiles = [];
  const unknownStates = [];
  const missingChannelAssignments = [];
  const modeProfileConflicts = [];
  const duplicateContradictions = [];
  const channelInconsistencies = [];
  const visibleWithoutCapabilityBinding = [];
  const visibleWithDisabledCapability = [];

  const rowMap = new Map();
  const rowMeta = new Map();

  refinement.entries.forEach((entryRaw, entryIndex) => {
    if (!isObjectRecord(entryRaw)) return;
    const commandId = normalizeString(entryRaw.commandId);
    if (!commandId) return;

    const rules = Array.isArray(entryRaw.rules) ? entryRaw.rules : [];
    rules.forEach((ruleRaw, ruleIndex) => {
      if (!isObjectRecord(ruleRaw)) return;
      const mode = normalizeString(ruleRaw.mode);
      if (!modes.has(mode)) {
        unknownModes.push({ commandId, mode, entryIndex, ruleIndex });
      }

      const ruleProfiles = toUniqueStrings(ruleRaw.profiles, { lower: true, sort: false });
      const channelsState = isObjectRecord(ruleRaw.channels) ? ruleRaw.channels : {};

      for (const profile of ruleProfiles) {
        if (!profiles.has(profile)) {
          unknownProfiles.push({ commandId, mode, profile, entryIndex, ruleIndex });
          continue;
        }

        const key = `${commandId}|${mode}|${profile}`;
        const channelValues = {};
        const missingChannels = [];

        for (const channel of channels) {
          const stateValue = normalizeString(channelsState[channel]);
          if (!stateValue) {
            missingChannels.push(channel);
            continue;
          }
          if (!states.has(stateValue)) {
            unknownStates.push({ commandId, mode, profile, channel, stateValue, entryIndex, ruleIndex });
            continue;
          }
          channelValues[channel] = stateValue;
        }

        if (missingChannels.length > 0) {
          missingChannelAssignments.push({ commandId, mode, profile, missingChannels, entryIndex, ruleIndex });
          continue;
        }

        const uniqueStates = [...new Set(Object.values(channelValues))];
        if (uniqueStates.length > 1) {
          channelInconsistencies.push({ commandId, mode, profile, channelValues, entryIndex, ruleIndex });
        }

        if (rowMap.has(key)) {
          const prev = rowMap.get(key);
          const prevMeta = rowMeta.get(key);
          const changed = stableStringify(prev) !== stableStringify(channelValues);
          if (changed) {
            if (prevMeta && prevMeta.entryIndex === entryIndex) {
              modeProfileConflicts.push({
                commandId,
                mode,
                profile,
                previous: prev,
                next: channelValues,
                previousRuleIndex: prevMeta.ruleIndex,
                nextRuleIndex: ruleIndex,
              });
            } else {
              duplicateContradictions.push({
                commandId,
                mode,
                profile,
                previous: prev,
                next: channelValues,
                previousEntryIndex: prevMeta ? prevMeta.entryIndex : -1,
                nextEntryIndex: entryIndex,
              });
            }
          }
        } else {
          rowMap.set(key, channelValues);
          rowMeta.set(key, { entryIndex, ruleIndex });
        }
      }
    });
  });

  for (const [key, channelValues] of rowMap.entries()) {
    const [commandId] = key.split('|');
    const anyVisible = Object.values(channelValues).some((stateValue) => stateValue === 'visible');

    if (!anyVisible) continue;

    if (!capabilityBinding.has(commandId)) {
      visibleWithoutCapabilityBinding.push({ commandId, key });
      continue;
    }

    const capabilityId = capabilityBinding.get(commandId);
    if (capabilityNode[capabilityId] !== true) {
      visibleWithDisabledCapability.push({ commandId, capabilityId, key });
    }
  }

  const requiredCoreNotVisible = [];
  const modesList = [...modes];
  const profilesList = [...profiles];

  for (const commandId of refinement.requiredCoreCommands) {
    for (const mode of modesList) {
      for (const profile of profilesList) {
        const key = `${commandId}|${mode}|${profile}`;
        const channelValues = rowMap.get(key);
        if (!channelValues) {
          requiredCoreNotVisible.push({ commandId, mode, profile, reason: 'MISSING_RULE' });
          continue;
        }

        const hasHidden = Object.values(channelValues).some((stateValue) => stateValue !== 'visible');
        if (hasHidden) {
          requiredCoreNotVisible.push({ commandId, mode, profile, reason: 'NOT_VISIBLE_IN_ALL_CHANNELS' });
        }
      }
    }
  }

  const requiredCoreOutsideGlobalCoreSafety = refinement.requiredCoreCommands
    .filter((commandId) => !globalCoreSafety.has(commandId));

  const projection = [];
  for (const [key, channelValues] of [...rowMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const [commandId, mode, profile] = key.split('|');
    projection.push({ commandId, mode, profile, channels: channelValues });
  }

  const projectionHash = createHash('sha256').update(stableStringify(projection)).digest('hex');

  const ok = unknownModes.length === 0
    && unknownProfiles.length === 0
    && unknownStates.length === 0
    && missingChannelAssignments.length === 0
    && modeProfileConflicts.length === 0
    && duplicateContradictions.length === 0
    && channelInconsistencies.length === 0
    && visibleWithoutCapabilityBinding.length === 0
    && visibleWithDisabledCapability.length === 0
    && requiredCoreNotVisible.length === 0
    && requiredCoreOutsideGlobalCoreSafety.length === 0;

  return {
    ok,
    projection,
    projectionHash,
    rowCount: projection.length,
    unknownModes,
    unknownProfiles,
    unknownStates,
    missingChannelAssignments,
    modeProfileConflicts,
    duplicateContradictions,
    channelInconsistencies,
    visibleWithoutCapabilityBinding,
    visibleWithDisabledCapability,
    requiredCoreNotVisible,
    requiredCoreOutsideGlobalCoreSafety,
  };
}

function evaluateDeterminism(validationFn) {
  const runA = validationFn();
  const runB = validationFn();
  const runC = validationFn();

  const deterministic = runA.ok
    && runB.ok
    && runC.ok
    && runA.projectionHash === runB.projectionHash
    && runB.projectionHash === runC.projectionHash;

  return {
    ok: deterministic,
    hashes: [runA.projectionHash, runB.projectionHash, runC.projectionHash],
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

function evaluateX15Ws05CommandVisibilityRefinementState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());

  const canonStatusPath = path.resolve(repoRoot, normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH));
  const failsignalRegistryPath = path.resolve(repoRoot, normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH));
  const visibilityMatrixPath = path.resolve(repoRoot, DEFAULT_VISIBILITY_MATRIX_PATH);
  const refinementPath = path.resolve(repoRoot, DEFAULT_REFINEMENT_PATH);
  const capabilityPolicyPath = path.resolve(repoRoot, DEFAULT_CAPABILITY_POLICY_PATH);

  const canonStatusDoc = isObjectRecord(input.canonStatusDoc) ? input.canonStatusDoc : readJsonObject(canonStatusPath);
  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);
  const visibilityMatrixDoc = readJsonObject(visibilityMatrixPath);
  const refinementDocRaw = readJsonObject(refinementPath);

  const capabilitySource = readText(capabilityPolicyPath);
  const parsedBinding = parseCapabilityObjectFromSource(capabilitySource, 'CAPABILITY_BINDING');
  const parsedMatrix = parseCapabilityObjectFromSource(capabilitySource, 'CAPABILITY_MATRIX');

  const canonLock = validateCanonLock(canonStatusDoc);
  const stageActivation = evaluateResolveActiveStageState({ profile: 'release', gateTier: 'release' });
  const stageActivationGuardCheck = Number(stageActivation.STAGE_ACTIVATION_OK) === 1;

  const refinement = normalizeRefinementDoc(refinementDocRaw);
  const globalCoreSafety = new Set(toUniqueStrings(visibilityMatrixDoc?.coreSafetyCommandAllowlist));
  const capabilityBinding = new Map(
    Object.entries(parsedBinding.value || {})
      .map(([commandId, capabilityId]) => [normalizeString(commandId), normalizeString(capabilityId)])
      .filter(([commandId, capabilityId]) => commandId && capabilityId),
  );
  const capabilityNode = isObjectRecord(parsedMatrix.value?.node) ? parsedMatrix.value.node : {};

  const validateBaseline = () => validateRefinement({
    refinement,
    capabilityBinding,
    capabilityNode,
    globalCoreSafety,
  });

  const baseline = validateBaseline();
  const determinism = evaluateDeterminism(validateBaseline);

  const negative01Refinement = deepClone(refinement);
  if (negative01Refinement.entries[0]?.rules?.[0]?.channels) {
    negative01Refinement.entries[0].rules[0].channels.menu = 'hidden';
  }
  const negative01 = validateRefinement({
    refinement: negative01Refinement,
    capabilityBinding,
    capabilityNode,
    globalCoreSafety,
  });

  const negative02Refinement = deepClone(refinement);
  const importEntry = negative02Refinement.entries.find((entry) => normalizeString(entry.commandId) === 'cmd.project.importMarkdownV1');
  if (importEntry && Array.isArray(importEntry.rules)) {
    importEntry.rules.push({
      mode: 'Write',
      profiles: ['pro'],
      channels: { menu: 'hidden', toolbar: 'hidden', palette: 'hidden' },
    });
  }
  const negative02 = validateRefinement({
    refinement: negative02Refinement,
    capabilityBinding,
    capabilityNode,
    globalCoreSafety,
  });

  const negative03Refinement = deepClone(refinement);
  if (negative03Refinement.entries[0]?.rules?.[0]?.channels) {
    negative03Refinement.entries[0].rules[0].channels = {
      menu: 'visible',
      toolbar: 'hidden',
      palette: 'visible',
    };
  }
  const negative03 = validateRefinement({
    refinement: negative03Refinement,
    capabilityBinding,
    capabilityNode,
    globalCoreSafety,
  });

  const negative04Refinement = deepClone(refinement);
  negative04Refinement.entries.push({
    commandId: 'cmd.project.visibleWithoutCapabilityBindingV1',
    rules: [
      {
        mode: 'Write',
        profiles: ['minimal', 'pro', 'guru'],
        channels: { menu: 'visible', toolbar: 'visible', palette: 'visible' },
      },
    ],
  });
  const negative04 = validateRefinement({
    refinement: negative04Refinement,
    capabilityBinding,
    capabilityNode,
    globalCoreSafety,
  });

  const negative05Refinement = deepClone(refinement);
  negative05Refinement.entries.push({
    commandId: 'cmd.project.open',
    rules: [
      {
        mode: 'Write',
        profiles: ['minimal', 'pro', 'guru'],
        channels: { menu: 'hidden', toolbar: 'hidden', palette: 'hidden' },
      },
    ],
  });
  const negative05 = validateRefinement({
    refinement: negative05Refinement,
    capabilityBinding,
    capabilityNode,
    globalCoreSafety,
  });

  const drift = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc);

  const negativeResults = {
    NEXT_TZ_NEGATIVE_01: negative01.requiredCoreNotVisible.length > 0,
    NEXT_TZ_NEGATIVE_02: negative02.modeProfileConflicts.length > 0,
    NEXT_TZ_NEGATIVE_03: negative03.channelInconsistencies.length > 0,
    NEXT_TZ_NEGATIVE_04: negative04.visibleWithoutCapabilityBinding.length > 0,
    NEXT_TZ_NEGATIVE_05: negative05.duplicateContradictions.length > 0,
  };

  const positiveResults = {
    NEXT_TZ_POSITIVE_01: baseline.ok && determinism.ok,
    NEXT_TZ_POSITIVE_02: baseline.unknownModes.length === 0
      && baseline.unknownProfiles.length === 0
      && baseline.modeProfileConflicts.length === 0
      && baseline.duplicateContradictions.length === 0,
    NEXT_TZ_POSITIVE_03: baseline.requiredCoreNotVisible.length === 0,
  };

  const allNegativesPass = Object.values(negativeResults).every(Boolean);
  const allPositivesPass = Object.values(positiveResults).every(Boolean);

  const refinementReady = baseline.ok
    && determinism.ok
    && parsedBinding.ok
    && parsedMatrix.ok;

  const dod = {
    NEXT_TZ_DOD_01: refinementReady,
    NEXT_TZ_DOD_02: allNegativesPass,
    NEXT_TZ_DOD_03: allPositivesPass,
    NEXT_TZ_DOD_04: false,
    NEXT_TZ_DOD_05: true,
    NEXT_TZ_DOD_06: drift.advisoryToBlockingDriftCountZero,
  };

  const acceptance = {
    NEXT_TZ_ACCEPTANCE_01: canonLock.ok,
    NEXT_TZ_ACCEPTANCE_02: stageActivationGuardCheck,
    NEXT_TZ_ACCEPTANCE_03: false,
    NEXT_TZ_ACCEPTANCE_04: false,
  };

  const preRepeatabilityOk = canonLock.ok
    && stageActivationGuardCheck
    && dod.NEXT_TZ_DOD_01
    && dod.NEXT_TZ_DOD_02
    && dod.NEXT_TZ_DOD_03
    && dod.NEXT_TZ_DOD_05
    && dod.NEXT_TZ_DOD_06;

  const state = {
    ok: preRepeatabilityOk,
    [TOKEN_NAME]: preRepeatabilityOk ? 1 : 0,
    failReason: '',
    failSignalCode: '',

    objective: 'COMMAND_VISIBILITY_MATRIX_REFINEMENT_BY_MODE_PROFILE_CHANNEL_WITH_NO_CORE_LEAK',
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
      channelCount: refinement.channels.length,
      modeCount: refinement.modes.length,
      profileCount: refinement.profiles.length,
      entryCount: refinement.entries.length,
      rowCount: baseline.rowCount,
      commandBindingCount: capabilityBinding.size,
      advisoryToBlockingDriftCount: drift.advisoryToBlockingDriftCount,
    },

    refinement,
    baseline,
    determinism,

    parseState: {
      parsedRuntimeCapabilityBindingOk: parsedBinding.ok,
      parsedRuntimeCapabilityMatrixOk: parsedMatrix.ok,
      parsedRuntimeCapabilityBindingReason: parsedBinding.reason,
      parsedRuntimeCapabilityMatrixReason: parsedMatrix.reason,
    },

    negativeResults,
    positiveResults,
    negativeDetails: {
      NEXT_TZ_NEGATIVE_01: negative01,
      NEXT_TZ_NEGATIVE_02: negative02,
      NEXT_TZ_NEGATIVE_03: negative03,
      NEXT_TZ_NEGATIVE_04: negative04,
      NEXT_TZ_NEGATIVE_05: negative05,
    },

    drift,
    dod,
    acceptance,

    detector: {
      detectorId: 'X15_WS05_COMMAND_VISIBILITY_REFINEMENT_SINGLE_DETECTOR_V1',
      canonicalModeEvaluatorId: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
      contentHash: createHash('sha256').update(stableStringify({
        baseline: {
          rowCount: baseline.rowCount,
          projectionHash: baseline.projectionHash,
        },
        negativeResults,
        positiveResults,
      })).digest('hex'),
    },
  };

  if (!state.ok) {
    state.failReason = !canonLock.ok
      ? canonLock.reason
      : !stageActivationGuardCheck
        ? 'STAGE_ACTIVATION_GUARD_FAIL'
        : !dod.NEXT_TZ_DOD_01
          ? 'VISIBILITY_REFINEMENT_NOT_READY'
          : !dod.NEXT_TZ_DOD_02
            ? 'NEGATIVE_SCENARIO_FAILURE'
            : !dod.NEXT_TZ_DOD_03
              ? 'POSITIVE_SCENARIO_FAILURE'
              : !dod.NEXT_TZ_DOD_06
                ? 'ADVISORY_TO_BLOCKING_DRIFT'
                : 'X15_WS05_COMMAND_VISIBILITY_REFINEMENT_FAIL';
    state.failSignalCode = state.failReason;
  }

  return state;
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`CHANNEL_COUNT=${state.counts.channelCount}`);
  console.log(`MODE_COUNT=${state.counts.modeCount}`);
  console.log(`PROFILE_COUNT=${state.counts.profileCount}`);
  console.log(`ROW_COUNT=${state.counts.rowCount}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.counts.advisoryToBlockingDriftCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateX15Ws05CommandVisibilityRefinementState({
    repoRoot: process.cwd(),
    canonStatusPath: args.canonStatusPath,
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
  evaluateX15Ws05CommandVisibilityRefinementState,
  TOKEN_NAME,
};
