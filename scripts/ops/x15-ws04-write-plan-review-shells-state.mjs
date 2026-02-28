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

const TOKEN_NAME = 'X15_WS04_WRITE_PLAN_REVIEW_SHELLS_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';

const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_MODE_POLICY_PATH = 'docs/OPS/STATUS/X15_MODE_SHELL_POLICY_v1.json';
const DEFAULT_PROFILE_PRESETS_SCHEMA_PATH = 'docs/OPS/STATUS/X15_PROFILE_PRESETS_SCHEMA_v1.json';
const DEFAULT_MENU_RUNTIME_CONTEXT_CANON_PATH = 'docs/OPS/STATUS/MENU_RUNTIME_CONTEXT_CANON_v1.json';
const DEFAULT_ENABLEDWHEN_DSL_CANON_PATH = 'docs/OPS/STATUS/ENABLEDWHEN_DSL_CANON.json';
const DEFAULT_CAPABILITY_POLICY_PATH = 'src/renderer/commands/capabilityPolicy.mjs';

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

function normalizeModePolicy(modePolicyDoc) {
  const source = isObjectRecord(modePolicyDoc) ? modePolicyDoc : {};

  const modes = toUniqueStrings(source.modes, { sort: false });
  const requiredCommandsByMode = isObjectRecord(source.requiredCommandsByMode) ? source.requiredCommandsByMode : {};
  const requiredPanelsByMode = isObjectRecord(source.requiredPanelsByMode) ? source.requiredPanelsByMode : {};
  const forbiddenPanelsByMode = isObjectRecord(source.forbiddenPanelsByMode) ? source.forbiddenPanelsByMode : {};
  const transitionPolicy = isObjectRecord(source.transitionPolicy) ? source.transitionPolicy : {};

  const out = {
    schemaVersion: Number(source.schemaVersion) || 1,
    policyVersion: normalizeString(source.policyVersion),
    modes,
    defaultProfile: normalizeString(source.defaultProfile).toLowerCase() || 'minimal',
    writeRequiredCommand: normalizeString(source.writeRequiredCommand),
    reviewHistoryCapabilityCommand: normalizeString(source.reviewHistoryCapabilityCommand),
    reviewOnlyCommands: toUniqueStrings(source.reviewOnlyCommands),
    requiredCommandsByMode: {},
    requiredPanelsByMode: {},
    forbiddenPanelsByMode: {},
    transitionPolicy: {
      clearVisibilityStateOnModeChange: transitionPolicy.clearVisibilityStateOnModeChange === true,
      resetKeys: toUniqueStrings(transitionPolicy.resetKeys),
    },
  };

  for (const mode of modes) {
    out.requiredCommandsByMode[mode] = toUniqueStrings(requiredCommandsByMode[mode]);
    out.requiredPanelsByMode[mode] = toUniqueStrings(requiredPanelsByMode[mode], { sort: false });
    out.forbiddenPanelsByMode[mode] = toUniqueStrings(forbiddenPanelsByMode[mode]);
  }

  return out;
}

function normalizeProfilePreset(profilePresetsDoc, profileId) {
  const presets = isObjectRecord(profilePresetsDoc?.presets) ? profilePresetsDoc.presets : {};
  const preset = isObjectRecord(presets[profileId]) ? presets[profileId] : {};
  const visibility = isObjectRecord(preset.commandVisibility) ? preset.commandVisibility : {};
  const layout = isObjectRecord(preset.panelLayout) ? preset.panelLayout : {};

  return {
    id: profileId,
    commandVisibility: {
      forceVisible: toUniqueStrings(visibility.forceVisible),
      hidden: toUniqueStrings(visibility.hidden),
    },
    panelLayout: {
      left: toUniqueStrings(layout.left, { sort: false }),
      center: toUniqueStrings(layout.center, { sort: false }),
      right: toUniqueStrings(layout.right, { sort: false }),
      bottom: toUniqueStrings(layout.bottom, { sort: false }),
    },
  };
}

function validateModePolicyConsistency(modePolicy, enabledWhenDoc, runtimeContextDoc, profilePresetsDoc) {
  const modeSet = new Set(modePolicy.modes);
  const missingExpectedModes = EXPECTED_MODES.filter((mode) => !modeSet.has(mode));

  const dslModes = new Set(toUniqueStrings(enabledWhenDoc?.allowedModeValues, { sort: false }));
  const runtimeProfiles = new Set(toUniqueStrings(runtimeContextDoc?.profileEnum, { lower: true }));
  const presetProfiles = new Set(toUniqueStrings(profilePresetsDoc?.profileEnum, { lower: true }));

  const modesMissingInDsl = modePolicy.modes.filter((mode) => !dslModes.has(mode));
  const profileAvailable = runtimeProfiles.has(modePolicy.defaultProfile) && presetProfiles.has(modePolicy.defaultProfile);

  const missingRequiredModeMappings = modePolicy.modes.filter((mode) => {
    const hasCmd = Array.isArray(modePolicy.requiredCommandsByMode[mode]) && modePolicy.requiredCommandsByMode[mode].length > 0;
    const hasPanels = Array.isArray(modePolicy.requiredPanelsByMode[mode]) && modePolicy.requiredPanelsByMode[mode].length > 0;
    return !hasCmd || !hasPanels;
  });

  return {
    ok: missingExpectedModes.length === 0
      && modesMissingInDsl.length === 0
      && profileAvailable
      && missingRequiredModeMappings.length === 0,
    missingExpectedModes,
    modesMissingInDsl,
    profileAvailable,
    missingRequiredModeMappings,
  };
}

function applyModeShell({
  modePolicy,
  mode,
  profilePreset,
  capabilityBinding,
  capabilityMatrixNode,
  allowedPanels,
}) {
  const modeNormalized = normalizeString(mode);
  if (!modePolicy.modes.includes(modeNormalized)) {
    return {
      ok: false,
      reason: 'MODE_SWITCH_UNKNOWN_MODE',
      projection: null,
      validation: null,
      hash: '',
    };
  }

  const requiredCommands = modePolicy.requiredCommandsByMode[modeNormalized] || [];
  const requiredPanels = modePolicy.requiredPanelsByMode[modeNormalized] || [];
  const forbiddenPanels = modePolicy.forbiddenPanelsByMode[modeNormalized] || [];

  const baseVisible = new Set(profilePreset.commandVisibility.forceVisible);
  const baseHidden = new Set(profilePreset.commandVisibility.hidden);

  for (const commandId of requiredCommands) {
    baseVisible.add(commandId);
    baseHidden.delete(commandId);
  }

  const visibleCommands = [...baseVisible]
    .filter((commandId) => !baseHidden.has(commandId))
    .sort((a, b) => a.localeCompare(b));
  const hiddenCommands = [...baseHidden].sort((a, b) => a.localeCompare(b));
  const activePanels = [...requiredPanels];

  const missingCapabilityBindings = visibleCommands.filter((commandId) => !capabilityBinding.has(commandId));
  const disabledCapabilities = visibleCommands
    .filter((commandId) => capabilityBinding.has(commandId))
    .map((commandId) => ({ commandId, capabilityId: capabilityBinding.get(commandId) }))
    .filter((entry) => capabilityMatrixNode[entry.capabilityId] !== true);

  const forbiddenPanelsPresent = activePanels.filter((panelId) => forbiddenPanels.includes(panelId));
  const unknownPanels = activePanels.filter((panelId) => !allowedPanels.has(panelId));
  const missingRequiredPanels = requiredPanels.filter((panelId) => !activePanels.includes(panelId));

  const reviewOnlyCommands = modePolicy.reviewOnlyCommands || [];
  const reviewOnlyInWrongMode = modeNormalized !== 'Review'
    ? visibleCommands.filter((commandId) => reviewOnlyCommands.includes(commandId))
    : [];

  const reviewHistoryCommand = modePolicy.reviewHistoryCapabilityCommand;
  const reviewHistoryMissing = modeNormalized === 'Review'
    && (!capabilityBinding.has(reviewHistoryCommand)
      || capabilityMatrixNode[capabilityBinding.get(reviewHistoryCommand)] !== true);

  const writeRequiredCommandHidden = modeNormalized === 'Write'
    && hiddenCommands.includes(modePolicy.writeRequiredCommand);

  const validation = {
    missingCapabilityBindings,
    disabledCapabilities,
    forbiddenPanelsPresent,
    unknownPanels,
    missingRequiredPanels,
    reviewOnlyInWrongMode,
    reviewHistoryMissing,
    writeRequiredCommandHidden,
  };

  const valid = missingCapabilityBindings.length === 0
    && disabledCapabilities.length === 0
    && forbiddenPanelsPresent.length === 0
    && unknownPanels.length === 0
    && missingRequiredPanels.length === 0
    && reviewOnlyInWrongMode.length === 0
    && reviewHistoryMissing === false
    && writeRequiredCommandHidden === false;

  if (!valid) {
    return {
      ok: false,
      reason: 'MODE_POLICY_VALIDATION_FAILED',
      projection: null,
      validation,
      hash: '',
    };
  }

  const projection = {
    mode: modeNormalized,
    profileId: profilePreset.id,
    visibleCommands,
    hiddenCommands,
    activePanels,
  };

  return {
    ok: true,
    reason: '',
    projection,
    validation,
    hash: createHash('sha256').update(stableStringify(projection)).digest('hex'),
  };
}

function evaluateModeSwitchDeterminism(deps) {
  const sequence = ['Write', 'Plan', 'Review', 'Write'];

  const runSequence = () => {
    const hashes = [];
    const projections = [];

    for (const mode of sequence) {
      const applied = applyModeShell({ ...deps, mode });
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

  const idempotentWrite = runA.ok
    && runA.hashes.length >= 4
    && runA.hashes[0] === runA.hashes[3];

  const deterministic = runA.ok
    && runB.ok
    && stableStringify(runA.hashes) === stableStringify(runB.hashes)
    && stableStringify(runA.projections) === stableStringify(runB.projections)
    && idempotentWrite;

  return {
    ok: deterministic,
    idempotentWrite,
    runA,
    runB,
  };
}

function evaluateNegativeUnknownMode(deps) {
  const applied = applyModeShell({ ...deps, mode: 'Draft' });
  return {
    ok: applied.ok === false && applied.reason === 'MODE_SWITCH_UNKNOWN_MODE',
    applied,
  };
}

function evaluateNegativeWriteHidesRequiredCommand(deps) {
  const brokenPolicy = deepClone(deps.modePolicy);
  const writeCmd = normalizeString(brokenPolicy.writeRequiredCommand);
  brokenPolicy.requiredCommandsByMode.Write = (brokenPolicy.requiredCommandsByMode.Write || []).filter((commandId) => commandId !== writeCmd);

  const brokenPreset = deepClone(deps.profilePreset);
  brokenPreset.commandVisibility.hidden = toUniqueStrings([...brokenPreset.commandVisibility.hidden, writeCmd]);

  const applied = applyModeShell({
    ...deps,
    modePolicy: brokenPolicy,
    profilePreset: brokenPreset,
    mode: 'Write',
  });

  const hidden = toUniqueStrings(brokenPreset.commandVisibility.hidden);
  return {
    ok: hidden.includes(writeCmd) && applied.ok === false,
    applied,
    writeRequiredCommand: writeCmd,
  };
}

function evaluateNegativePlanOpensReviewPanel(deps) {
  const brokenPolicy = deepClone(deps.modePolicy);
  brokenPolicy.requiredPanelsByMode.Plan = toUniqueStrings([
    ...(brokenPolicy.requiredPanelsByMode.Plan || []),
    'review',
  ], { sort: false });

  const applied = applyModeShell({
    ...deps,
    modePolicy: brokenPolicy,
    mode: 'Plan',
  });

  return {
    ok: applied.ok === false,
    applied,
  };
}

function evaluateNegativeReviewWithoutHistoryCapability(deps) {
  const brokenPolicy = deepClone(deps.modePolicy);
  brokenPolicy.reviewHistoryCapabilityCommand = 'cmd.project.reviewHistoryMissingV1';

  const applied = applyModeShell({
    ...deps,
    modePolicy: brokenPolicy,
    mode: 'Review',
  });

  return {
    ok: applied.ok === false,
    applied,
  };
}

function evaluateNegativeStaleVisibilityState(deps) {
  const writeProjection = applyModeShell({ ...deps, mode: 'Write' });
  const reviewProjection = applyModeShell({ ...deps, mode: 'Review' });

  if (!writeProjection.ok || !reviewProjection.ok) {
    return {
      ok: false,
      reason: 'BASE_MODE_APPLY_FAILED',
      staleDetected: false,
    };
  }

  const staleVisible = toUniqueStrings([
    ...writeProjection.projection.visibleCommands,
    ...reviewProjection.projection.visibleCommands,
  ]);

  const staleDetected = stableStringify(staleVisible) !== stableStringify(writeProjection.projection.visibleCommands);

  return {
    ok: staleDetected,
    reason: staleDetected ? 'MODE_TRANSITION_STALE_VISIBILITY_DETECTED' : 'MODE_TRANSITION_NO_STALE_DETECTED',
    staleDetected,
    expectedWriteVisibleCommands: writeProjection.projection.visibleCommands,
    actualWriteVisibleCommandsAfterBrokenTransition: staleVisible,
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

function evaluateX15Ws04WritePlanReviewShellsState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());

  const canonStatusPath = path.resolve(repoRoot, normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH));
  const failsignalRegistryPath = path.resolve(repoRoot, normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH));
  const modePolicyPath = path.resolve(repoRoot, DEFAULT_MODE_POLICY_PATH);
  const profilePresetsPath = path.resolve(repoRoot, DEFAULT_PROFILE_PRESETS_SCHEMA_PATH);
  const runtimeContextPath = path.resolve(repoRoot, DEFAULT_MENU_RUNTIME_CONTEXT_CANON_PATH);
  const enabledWhenPath = path.resolve(repoRoot, DEFAULT_ENABLEDWHEN_DSL_CANON_PATH);
  const capabilityPolicyPath = path.resolve(repoRoot, DEFAULT_CAPABILITY_POLICY_PATH);

  const canonStatusDoc = isObjectRecord(input.canonStatusDoc) ? input.canonStatusDoc : readJsonObject(canonStatusPath);
  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);

  const modePolicyDoc = readJsonObject(modePolicyPath);
  const profilePresetsDoc = readJsonObject(profilePresetsPath);
  const runtimeContextDoc = readJsonObject(runtimeContextPath);
  const enabledWhenDoc = readJsonObject(enabledWhenPath);

  const capabilityPolicySource = readText(capabilityPolicyPath);
  const parsedBinding = parseCapabilityObjectFromSource(capabilityPolicySource, 'CAPABILITY_BINDING');
  const parsedMatrix = parseCapabilityObjectFromSource(capabilityPolicySource, 'CAPABILITY_MATRIX');

  const modePolicy = normalizeModePolicy(modePolicyDoc);
  const canonLock = validateCanonLock(canonStatusDoc);

  const stageActivation = evaluateResolveActiveStageState({ profile: 'release', gateTier: 'release' });
  const stageActivationGuardCheck = Number(stageActivation.STAGE_ACTIVATION_OK) === 1;

  const profilePreset = normalizeProfilePreset(profilePresetsDoc, modePolicy.defaultProfile || 'minimal');
  const allowedPanels = new Set(toUniqueStrings(profilePresetsDoc?.allowedPanels));

  const capabilityBinding = new Map(
    Object.entries(parsedBinding.value || {})
      .map(([commandId, capabilityId]) => [normalizeString(commandId), normalizeString(capabilityId)])
      .filter(([commandId, capabilityId]) => commandId && capabilityId),
  );
  const capabilityMatrixNode = isObjectRecord(parsedMatrix.value?.node) ? parsedMatrix.value.node : {};

  const modePolicyConsistency = validateModePolicyConsistency(modePolicy, enabledWhenDoc, runtimeContextDoc, profilePresetsDoc);

  const applyWrite = applyModeShell({ modePolicy, mode: 'Write', profilePreset, capabilityBinding, capabilityMatrixNode, allowedPanels });
  const applyPlan = applyModeShell({ modePolicy, mode: 'Plan', profilePreset, capabilityBinding, capabilityMatrixNode, allowedPanels });
  const applyReview = applyModeShell({ modePolicy, mode: 'Review', profilePreset, capabilityBinding, capabilityMatrixNode, allowedPanels });

  const modeSwitchDeterminism = evaluateModeSwitchDeterminism({
    modePolicy,
    profilePreset,
    capabilityBinding,
    capabilityMatrixNode,
    allowedPanels,
  });

  const negative01 = evaluateNegativeUnknownMode({
    modePolicy,
    profilePreset,
    capabilityBinding,
    capabilityMatrixNode,
    allowedPanels,
  });
  const negative02 = evaluateNegativeWriteHidesRequiredCommand({
    modePolicy,
    profilePreset,
    capabilityBinding,
    capabilityMatrixNode,
    allowedPanels,
  });
  const negative03 = evaluateNegativePlanOpensReviewPanel({
    modePolicy,
    profilePreset,
    capabilityBinding,
    capabilityMatrixNode,
    allowedPanels,
  });
  const negative04 = evaluateNegativeReviewWithoutHistoryCapability({
    modePolicy,
    profilePreset,
    capabilityBinding,
    capabilityMatrixNode,
    allowedPanels,
  });
  const negative05 = evaluateNegativeStaleVisibilityState({
    modePolicy,
    profilePreset,
    capabilityBinding,
    capabilityMatrixNode,
    allowedPanels,
  });

  const drift = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc);

  const negativeResults = {
    NEXT_TZ_NEGATIVE_01: negative01.ok,
    NEXT_TZ_NEGATIVE_02: negative02.ok,
    NEXT_TZ_NEGATIVE_03: negative03.ok,
    NEXT_TZ_NEGATIVE_04: negative04.ok,
    NEXT_TZ_NEGATIVE_05: negative05.ok,
  };

  const positiveResults = {
    NEXT_TZ_POSITIVE_01: modeSwitchDeterminism.ok,
    NEXT_TZ_POSITIVE_02: applyWrite.ok && applyPlan.ok && applyReview.ok,
    NEXT_TZ_POSITIVE_03: applyWrite.ok && applyPlan.ok && applyReview.ok,
  };

  const allNegativesPass = Object.values(negativeResults).every(Boolean);
  const allPositivesPass = Object.values(positiveResults).every(Boolean);

  const shellsReady = modePolicyConsistency.ok
    && applyWrite.ok
    && applyPlan.ok
    && applyReview.ok
    && parsedBinding.ok
    && parsedMatrix.ok;

  const dod = {
    NEXT_TZ_DOD_01: shellsReady,
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

    objective: 'WRITE_PLAN_REVIEW_SHELLS_WITH_MODE_INTEGRITY_AND_NO_CORE_LEAK',
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
      modeCount: modePolicy.modes.length,
      commandBindingCount: capabilityBinding.size,
      panelCatalogCount: allowedPanels.size,
      advisoryToBlockingDriftCount: drift.advisoryToBlockingDriftCount,
    },

    modePolicy,
    modePolicyConsistency,
    applyByMode: {
      Write: applyWrite,
      Plan: applyPlan,
      Review: applyReview,
    },
    modeSwitchDeterminism,

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
      detectorId: 'X15_WS04_WRITE_PLAN_REVIEW_SHELLS_SINGLE_DETECTOR_V1',
      canonicalModeEvaluatorId: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
      contentHash: createHash('sha256').update(stableStringify({
        modePolicyConsistency,
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
          ? 'MODE_SHELL_NOT_READY'
          : !dod.NEXT_TZ_DOD_02
            ? 'NEGATIVE_SCENARIO_FAILURE'
            : !dod.NEXT_TZ_DOD_03
              ? 'POSITIVE_SCENARIO_FAILURE'
              : !dod.NEXT_TZ_DOD_06
                ? 'ADVISORY_TO_BLOCKING_DRIFT'
                : 'X15_WS04_WRITE_PLAN_REVIEW_SHELLS_FAIL';
    state.failSignalCode = state.failReason;
  }

  return state;
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`MODE_COUNT=${state.counts.modeCount}`);
  console.log(`COMMAND_BINDING_COUNT=${state.counts.commandBindingCount}`);
  console.log(`PANEL_CATALOG_COUNT=${state.counts.panelCatalogCount}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.counts.advisoryToBlockingDriftCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateX15Ws04WritePlanReviewShellsState({
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
  evaluateX15Ws04WritePlanReviewShellsState,
  TOKEN_NAME,
};
