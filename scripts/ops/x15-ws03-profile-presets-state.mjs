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

const TOKEN_NAME = 'X15_WS03_PROFILE_PRESETS_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';

const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_PROFILE_PRESETS_SCHEMA_PATH = 'docs/OPS/STATUS/X15_PROFILE_PRESETS_SCHEMA_v1.json';
const DEFAULT_COMMAND_VISIBILITY_MATRIX_PATH = 'docs/OPS/STATUS/COMMAND_VISIBILITY_MATRIX.json';
const DEFAULT_MENU_RUNTIME_CONTEXT_CANON_PATH = 'docs/OPS/STATUS/MENU_RUNTIME_CONTEXT_CANON_v1.json';
const DEFAULT_CAPABILITY_POLICY_PATH = 'src/renderer/commands/capabilityPolicy.mjs';

const EXPECTED_PROFILES = Object.freeze(['minimal', 'pro', 'guru']);
const EXPECTED_MODES = Object.freeze(['Write', 'Plan', 'Review']);

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

function buildPresetSchemaState(presetsDoc) {
  const profileEnum = toUniqueStrings(presetsDoc?.profileEnum, { lower: true });
  const missingProfiles = EXPECTED_PROFILES.filter((profile) => !profileEnum.includes(profile));

  const allowedModes = toUniqueStrings(presetsDoc?.allowedModeValues, { sort: false });
  const missingModes = EXPECTED_MODES.filter((mode) => !allowedModes.includes(mode));

  const allowedPanels = toUniqueStrings(presetsDoc?.allowedPanels);
  const presets = isObjectRecord(presetsDoc?.presets) ? presetsDoc.presets : {};
  const missingPresetDefinitions = EXPECTED_PROFILES.filter((profile) => !isObjectRecord(presets[profile]));

  return {
    ok: missingProfiles.length === 0
      && missingModes.length === 0
      && missingPresetDefinitions.length === 0
      && allowedPanels.length > 0,
    profileEnum,
    allowedModes,
    allowedPanels,
    missingProfiles,
    missingModes,
    missingPresetDefinitions,
    presetCount: Object.keys(presets).length,
  };
}

function normalizePanelLayout(panelLayout) {
  const source = isObjectRecord(panelLayout) ? panelLayout : {};
  const zones = ['left', 'center', 'right', 'bottom'];
  const out = {};

  for (const zone of zones) {
    out[zone] = toUniqueStrings(source[zone], { sort: false });
  }

  return out;
}

function normalizePreset(presetsDoc, profileId) {
  const presets = isObjectRecord(presetsDoc?.presets) ? presetsDoc.presets : {};
  const preset = isObjectRecord(presets[profileId]) ? presets[profileId] : {};
  const visibility = isObjectRecord(preset.commandVisibility) ? preset.commandVisibility : {};

  return {
    id: profileId,
    commandVisibility: {
      forceVisible: toUniqueStrings(visibility.forceVisible),
      hidden: toUniqueStrings(visibility.hidden),
    },
    panelLayout: normalizePanelLayout(preset.panelLayout),
    commandOverrides: toUniqueStrings(preset?.commandOverrides?.commands),
  };
}

function detectPanelConflicts(panelLayout, allowedPanelsSet) {
  const zones = ['left', 'center', 'right', 'bottom'];
  const usage = new Map();
  const unknownPanels = [];
  const duplicateAcrossZones = [];

  for (const zone of zones) {
    const panels = Array.isArray(panelLayout?.[zone]) ? panelLayout[zone] : [];
    for (const panelIdRaw of panels) {
      const panelId = normalizeString(panelIdRaw);
      if (!panelId) continue;
      if (!allowedPanelsSet.has(panelId)) {
        unknownPanels.push({ panelId, zone });
      }
      if (!usage.has(panelId)) {
        usage.set(panelId, zone);
      } else if (usage.get(panelId) !== zone) {
        duplicateAcrossZones.push({ panelId, firstZone: usage.get(panelId), secondZone: zone });
      }
    }
  }

  return {
    unknownPanels,
    duplicateAcrossZones,
  };
}

function validatePresetBindings({
  preset,
  requiredCoreCommands,
  hiddenAllowlist,
  capabilityBinding,
  capabilityMatrixNode,
  allowedPanels,
}) {
  const allPresetCommands = [
    ...preset.commandVisibility.forceVisible,
    ...preset.commandVisibility.hidden,
  ];

  const undeclaredCommands = allPresetCommands.filter((commandId) => !capabilityBinding.has(commandId));
  const hiddenRequiredCoreCommands = preset.commandVisibility.hidden
    .filter((commandId) => requiredCoreCommands.has(commandId));
  const hiddenOutsideAllowlist = preset.commandVisibility.hidden
    .filter((commandId) => !hiddenAllowlist.has(commandId));

  const forceVisibleCapabilityDisabled = preset.commandVisibility.forceVisible
    .filter((commandId) => capabilityBinding.has(commandId))
    .map((commandId) => ({ commandId, capabilityId: capabilityBinding.get(commandId) }))
    .filter((entry) => capabilityMatrixNode[entry.capabilityId] !== true);

  const overrideWithoutCapability = preset.commandOverrides.filter((commandId) => !capabilityBinding.has(commandId));

  const panelConflicts = detectPanelConflicts(preset.panelLayout, allowedPanels);

  return {
    ok: undeclaredCommands.length === 0
      && hiddenRequiredCoreCommands.length === 0
      && hiddenOutsideAllowlist.length === 0
      && forceVisibleCapabilityDisabled.length === 0
      && overrideWithoutCapability.length === 0
      && panelConflicts.unknownPanels.length === 0
      && panelConflicts.duplicateAcrossZones.length === 0,
    undeclaredCommands,
    hiddenRequiredCoreCommands,
    hiddenOutsideAllowlist,
    forceVisibleCapabilityDisabled,
    overrideWithoutCapability,
    panelConflicts,
  };
}

function applyPreset({
  presetsDoc,
  profileId,
  mode,
  requiredCoreCommands,
  hiddenAllowlist,
  capabilityBinding,
  capabilityMatrixNode,
  allowedPanels,
}) {
  const allowedModes = new Set(toUniqueStrings(presetsDoc?.allowedModeValues, { sort: false }));
  if (!allowedModes.has(mode)) {
    return {
      ok: false,
      reason: 'PRESET_SWITCH_INVALID_MODE_CONTEXT',
      projection: null,
      validation: null,
    };
  }

  const preset = normalizePreset(presetsDoc, profileId);
  const validation = validatePresetBindings({
    preset,
    requiredCoreCommands,
    hiddenAllowlist,
    capabilityBinding,
    capabilityMatrixNode,
    allowedPanels,
  });

  if (!validation.ok) {
    return {
      ok: false,
      reason: 'PRESET_BINDING_INVALID',
      projection: null,
      validation,
    };
  }

  const visibleCommands = preset.commandVisibility.forceVisible
    .filter((commandId) => !preset.commandVisibility.hidden.includes(commandId))
    .sort((a, b) => a.localeCompare(b));

  const projection = {
    profileId,
    mode,
    visibleCommands,
    hiddenCommands: [...preset.commandVisibility.hidden].sort((a, b) => a.localeCompare(b)),
    panelLayout: preset.panelLayout,
  };

  return {
    ok: true,
    reason: '',
    projection,
    validation,
    hash: createHash('sha256').update(stableStringify(projection)).digest('hex'),
  };
}

function evaluatePresetSwitchDeterminism(deps) {
  const sequence = ['minimal', 'pro', 'guru', 'minimal'];
  const runSequence = () => {
    const hashes = [];
    const projections = [];
    for (const profileId of sequence) {
      const applied = applyPreset({ ...deps, profileId, mode: 'Write' });
      if (!applied.ok) {
        return {
          ok: false,
          reason: applied.reason,
          hashes,
          projections,
        };
      }
      hashes.push(applied.hash);
      projections.push(applied.projection);
    }
    return {
      ok: true,
      reason: '',
      hashes,
      projections,
    };
  };

  const runA = runSequence();
  const runB = runSequence();

  const idempotentMinimal = runA.ok
    && runA.hashes.length >= 4
    && runA.hashes[0] === runA.hashes[3];

  const deterministic = runA.ok
    && runB.ok
    && stableStringify(runA.hashes) === stableStringify(runB.hashes)
    && stableStringify(runA.projections) === stableStringify(runB.projections)
    && idempotentMinimal;

  return {
    ok: deterministic,
    idempotentMinimal,
    runA,
    runB,
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

function evaluateX15Ws03ProfilePresetsState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());

  const canonStatusPath = path.resolve(repoRoot, normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH));
  const failsignalRegistryPath = path.resolve(repoRoot, normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH));
  const profilePresetsPath = path.resolve(repoRoot, DEFAULT_PROFILE_PRESETS_SCHEMA_PATH);
  const commandVisibilityPath = path.resolve(repoRoot, DEFAULT_COMMAND_VISIBILITY_MATRIX_PATH);
  const menuRuntimeContextPath = path.resolve(repoRoot, DEFAULT_MENU_RUNTIME_CONTEXT_CANON_PATH);
  const capabilityPolicyPath = path.resolve(repoRoot, DEFAULT_CAPABILITY_POLICY_PATH);

  const canonStatusDoc = isObjectRecord(input.canonStatusDoc) ? input.canonStatusDoc : readJsonObject(canonStatusPath);
  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);

  const profilePresetsDoc = readJsonObject(profilePresetsPath);
  const commandVisibilityDoc = readJsonObject(commandVisibilityPath);
  const runtimeContextDoc = readJsonObject(menuRuntimeContextPath);

  const capabilitySource = readText(capabilityPolicyPath);
  const parsedBinding = parseCapabilityObjectFromSource(capabilitySource, 'CAPABILITY_BINDING');
  const parsedMatrix = parseCapabilityObjectFromSource(capabilitySource, 'CAPABILITY_MATRIX');

  const canonLock = validateCanonLock(canonStatusDoc);
  const stageActivation = evaluateResolveActiveStageState({ profile: 'release', gateTier: 'release' });
  const stageActivationGuardCheck = Number(stageActivation.STAGE_ACTIVATION_OK) === 1;

  const presetSchemaState = buildPresetSchemaState(profilePresetsDoc);

  const runtimeProfileEnum = toUniqueStrings(runtimeContextDoc?.profileEnum, { lower: true });
  const runtimeProfileMissing = EXPECTED_PROFILES.filter((profile) => !runtimeProfileEnum.includes(profile));

  const requiredCoreCommands = new Set(toUniqueStrings(profilePresetsDoc?.requiredCoreCommands));
  const hiddenAllowlist = new Set(toUniqueStrings(commandVisibilityDoc?.minimalProfileHiddenAllowlist));
  const allowedPanels = new Set(toUniqueStrings(profilePresetsDoc?.allowedPanels));

  const capabilityBinding = new Map(
    Object.entries(parsedBinding.value || {})
      .map(([commandId, capabilityId]) => [normalizeString(commandId), normalizeString(capabilityId)])
      .filter(([commandId, capabilityId]) => commandId && capabilityId),
  );
  const capabilityMatrixNode = isObjectRecord(parsedMatrix.value?.node) ? parsedMatrix.value.node : {};

  const presetsByProfile = {};
  const validationsByProfile = {};
  const applyByProfile = {};

  for (const profileId of EXPECTED_PROFILES) {
    const normalizedPreset = normalizePreset(profilePresetsDoc, profileId);
    const validation = validatePresetBindings({
      preset: normalizedPreset,
      requiredCoreCommands,
      hiddenAllowlist,
      capabilityBinding,
      capabilityMatrixNode,
      allowedPanels,
    });
    const apply = applyPreset({
      presetsDoc: profilePresetsDoc,
      profileId,
      mode: 'Write',
      requiredCoreCommands,
      hiddenAllowlist,
      capabilityBinding,
      capabilityMatrixNode,
      allowedPanels,
    });

    presetsByProfile[profileId] = normalizedPreset;
    validationsByProfile[profileId] = validation;
    applyByProfile[profileId] = apply;
  }

  const presetSwitchDeterminism = evaluatePresetSwitchDeterminism({
    presetsDoc: profilePresetsDoc,
    requiredCoreCommands,
    hiddenAllowlist,
    capabilityBinding,
    capabilityMatrixNode,
    allowedPanels,
  });

  const hasAnyPresetValidationIssue = Object.values(validationsByProfile).some((entry) => !entry.ok);
  const allPresetsApply = Object.values(applyByProfile).every((entry) => entry.ok);

  const negative01Preset = deepClone(normalizePreset(profilePresetsDoc, 'minimal'));
  negative01Preset.commandVisibility.forceVisible.push('cmd.project.undeclaredV1');
  const negative01Validation = validatePresetBindings({
    preset: negative01Preset,
    requiredCoreCommands,
    hiddenAllowlist,
    capabilityBinding,
    capabilityMatrixNode,
    allowedPanels,
  });

  const negative02Preset = deepClone(normalizePreset(profilePresetsDoc, 'minimal'));
  negative02Preset.commandVisibility.hidden.push([...requiredCoreCommands][0] || 'cmd.project.open');
  const negative02Validation = validatePresetBindings({
    preset: negative02Preset,
    requiredCoreCommands,
    hiddenAllowlist,
    capabilityBinding,
    capabilityMatrixNode,
    allowedPanels,
  });

  const negative03Preset = deepClone(normalizePreset(profilePresetsDoc, 'pro'));
  negative03Preset.panelLayout.left.push('editor');
  const negative03Validation = validatePresetBindings({
    preset: negative03Preset,
    requiredCoreCommands,
    hiddenAllowlist,
    capabilityBinding,
    capabilityMatrixNode,
    allowedPanels,
  });

  const negative04Apply = applyPreset({
    presetsDoc: profilePresetsDoc,
    profileId: 'minimal',
    mode: 'Draft',
    requiredCoreCommands,
    hiddenAllowlist,
    capabilityBinding,
    capabilityMatrixNode,
    allowedPanels,
  });

  const negative05Preset = deepClone(normalizePreset(profilePresetsDoc, 'guru'));
  negative05Preset.commandOverrides = ['cmd.project.overrideWithoutCapabilityBindingV1'];
  const negative05Validation = validatePresetBindings({
    preset: negative05Preset,
    requiredCoreCommands,
    hiddenAllowlist,
    capabilityBinding,
    capabilityMatrixNode,
    allowedPanels,
  });

  const drift = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc);

  const negativeResults = {
    NEXT_TZ_NEGATIVE_01: negative01Validation.undeclaredCommands.length > 0,
    NEXT_TZ_NEGATIVE_02: negative02Validation.hiddenRequiredCoreCommands.length > 0,
    NEXT_TZ_NEGATIVE_03: negative03Validation.panelConflicts.duplicateAcrossZones.length > 0,
    NEXT_TZ_NEGATIVE_04: negative04Apply.ok === false && negative04Apply.reason === 'PRESET_SWITCH_INVALID_MODE_CONTEXT',
    NEXT_TZ_NEGATIVE_05: negative05Validation.overrideWithoutCapability.length > 0,
  };

  const positiveResults = {
    NEXT_TZ_POSITIVE_01: presetSchemaState.ok && allPresetsApply && !hasAnyPresetValidationIssue,
    NEXT_TZ_POSITIVE_02: presetSwitchDeterminism.ok,
    NEXT_TZ_POSITIVE_03: !hasAnyPresetValidationIssue,
  };

  const allNegativesPass = Object.values(negativeResults).every(Boolean);
  const allPositivesPass = Object.values(positiveResults).every(Boolean);

  const profilePresetsReady = presetSchemaState.ok
    && runtimeProfileMissing.length === 0
    && allPresetsApply
    && !hasAnyPresetValidationIssue
    && parsedBinding.ok
    && parsedMatrix.ok;

  const dod = {
    NEXT_TZ_DOD_01: profilePresetsReady,
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

    objective: 'PROFILE_PRESETS_MINIMAL_PRO_GURU_DETERMINISTIC_AND_NO_CORE_LEAK',
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
      presetCount: Object.keys(presetsByProfile).length,
      profileEnumCount: presetSchemaState.profileEnum.length,
      runtimeProfileEnumCount: runtimeProfileEnum.length,
      commandBindingCount: capabilityBinding.size,
      advisoryToBlockingDriftCount: drift.advisoryToBlockingDriftCount,
    },

    presetSchemaState,
    runtimeProfileEnum,
    runtimeProfileMissing,
    presetsByProfile,
    validationsByProfile,
    applyByProfile,
    presetSwitchDeterminism,

    parseState: {
      parsedRuntimeCapabilityBindingOk: parsedBinding.ok,
      parsedRuntimeCapabilityMatrixOk: parsedMatrix.ok,
      parsedRuntimeCapabilityBindingReason: parsedBinding.reason,
      parsedRuntimeCapabilityMatrixReason: parsedMatrix.reason,
    },

    negativeResults,
    positiveResults,
    negativeDetails: {
      NEXT_TZ_NEGATIVE_01: negative01Validation,
      NEXT_TZ_NEGATIVE_02: negative02Validation,
      NEXT_TZ_NEGATIVE_03: negative03Validation,
      NEXT_TZ_NEGATIVE_04: negative04Apply,
      NEXT_TZ_NEGATIVE_05: negative05Validation,
    },

    drift,
    dod,
    acceptance,

    detector: {
      detectorId: 'X15_WS03_PROFILE_PRESETS_SINGLE_DETECTOR_V1',
      canonicalModeEvaluatorId: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
      contentHash: createHash('sha256').update(stableStringify({
        presetSchemaState,
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
          ? 'PROFILE_PRESETS_NOT_READY'
          : !dod.NEXT_TZ_DOD_02
            ? 'NEGATIVE_SCENARIO_FAILURE'
            : !dod.NEXT_TZ_DOD_03
              ? 'POSITIVE_SCENARIO_FAILURE'
              : !dod.NEXT_TZ_DOD_06
                ? 'ADVISORY_TO_BLOCKING_DRIFT'
                : 'X15_WS03_PROFILE_PRESETS_FAIL';
    state.failSignalCode = state.failReason;
  }

  return state;
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`PRESET_COUNT=${state.counts.presetCount}`);
  console.log(`PROFILE_ENUM_COUNT=${state.counts.profileEnumCount}`);
  console.log(`COMMAND_BINDING_COUNT=${state.counts.commandBindingCount}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.counts.advisoryToBlockingDriftCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateX15Ws03ProfilePresetsState({
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
  evaluateX15Ws03ProfilePresetsState,
  TOKEN_NAME,
};
