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

const TOKEN_NAME = 'X15_WS01_UI_MENU_EXPANSION_FOUNDATION_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';
const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const DEFAULT_MENU_OVERLAY_STACK_PATH = 'docs/OPS/STATUS/MENU_OVERLAY_STACK_CANON_v1.json';
const DEFAULT_PLUGIN_OVERLAY_POLICY_PATH = 'docs/OPS/STATUS/PLUGIN_MENU_OVERLAY_POLICY_v1.json';
const DEFAULT_COMMAND_VISIBILITY_MATRIX_PATH = 'docs/OPS/STATUS/COMMAND_VISIBILITY_MATRIX.json';
const DEFAULT_COMMAND_CAPABILITY_BINDING_PATH = 'docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json';
const DEFAULT_ENABLEDWHEN_DSL_CANON_PATH = 'docs/OPS/STATUS/ENABLEDWHEN_DSL_CANON.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_CAPABILITY_POLICY_PATH = 'src/renderer/commands/capabilityPolicy.mjs';

const EXPECTED_MENU_LAYERS = Object.freeze(['base', 'platform', 'profile', 'workspace', 'user', 'plugin']);
const EXPECTED_MODE_SHELLS = Object.freeze(['Write', 'Plan', 'Review']);
const REQUIRED_CORE_COMMANDS = Object.freeze([
  'cmd.project.open',
  'cmd.project.save',
  'cmd.project.export.docxMin',
]);
const FORBIDDEN_CORE_CHANGE_TOPICS = Object.freeze([
  'CORE_SCHEMA_CHANGES',
  'MIGRATIONS_AND_RECOVERY_LOGIC',
  'CORE_CONTRACT',
  'SCHEMA',
  'MIGRATIONS',
  'RECOVERY',
]);

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

function readTextFile(filePath) {
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

function toUniqueSortedStrings(value) {
  const out = [];
  const seen = new Set();
  const source = Array.isArray(value) ? value : [];
  for (const raw of source) {
    const normalized = normalizeString(String(raw || ''));
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function toUniqueStringsPreserveOrder(value) {
  const out = [];
  const seen = new Set();
  const source = Array.isArray(value) ? value : [];
  for (const raw of source) {
    const normalized = normalizeString(String(raw || ''));
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function buildMenuLayerPolicyState(menuOverlayStackDoc) {
  const stackOrder = toUniqueStringsPreserveOrder(menuOverlayStackDoc?.stackOrder);
  const mergeRules = isObjectRecord(menuOverlayStackDoc?.mergeRules) ? menuOverlayStackDoc.mergeRules : {};

  const stackOrderMatches = JSON.stringify(stackOrder) === JSON.stringify(EXPECTED_MENU_LAYERS);
  const allowlistRulesOk = normalizeString(mergeRules.hide) === 'allowlist'
    && normalizeString(mergeRules.reorder) === 'allowlist'
    && normalizeString(mergeRules.insert) === 'allowlist';

  return {
    ok: stackOrderMatches && allowlistRulesOk,
    stackOrder,
    stackOrderMatches,
    allowlistRulesOk,
    mergeRules: {
      insert: normalizeString(mergeRules.insert),
      hide: normalizeString(mergeRules.hide),
      reorder: normalizeString(mergeRules.reorder),
      replace: normalizeString(mergeRules.replace),
    },
  };
}

function buildModeShellState(enabledWhenDslDoc) {
  const allowedModes = toUniqueSortedStrings(enabledWhenDslDoc?.allowedModeValues);
  const missingModes = EXPECTED_MODE_SHELLS.filter((mode) => !allowedModes.includes(mode));

  const digestPayload = {
    modes: allowedModes,
    expected: EXPECTED_MODE_SHELLS,
  };
  const digests = [1, 2, 3].map(() => createHash('sha256').update(stableStringify(digestPayload)).digest('hex'));

  return {
    ok: missingModes.length === 0 && digests.every((digest) => digest === digests[0]),
    allowedModes,
    missingModes,
    deterministicHashes: digests,
  };
}

function buildCapabilitySyncState(commandVisibilityDoc, bindingDoc, capabilityBindingRuntime, capabilityMatrixRuntime) {
  const hiddenAllowlist = toUniqueSortedStrings(commandVisibilityDoc?.minimalProfileHiddenAllowlist);
  const coreSafetyAllowlist = toUniqueSortedStrings(commandVisibilityDoc?.coreSafetyCommandAllowlist);

  const bindingItems = Array.isArray(bindingDoc?.items) ? bindingDoc.items : [];
  const docsMap = new Map();
  for (const row of bindingItems) {
    if (!isObjectRecord(row)) continue;
    const commandId = normalizeString(row.commandId);
    const capabilityId = normalizeString(row.capabilityId);
    if (!commandId || !capabilityId) continue;
    docsMap.set(commandId, capabilityId);
  }

  const runtimeMap = new Map();
  for (const [commandIdRaw, capabilityIdRaw] of Object.entries(capabilityBindingRuntime || {})) {
    const commandId = normalizeString(commandIdRaw);
    const capabilityId = normalizeString(capabilityIdRaw);
    if (!commandId || !capabilityId) continue;
    runtimeMap.set(commandId, capabilityId);
  }

  const overlap = [...runtimeMap.keys()].filter((commandId) => docsMap.has(commandId));
  const mismatches = overlap
    .filter((commandId) => docsMap.get(commandId) !== runtimeMap.get(commandId))
    .map((commandId) => ({
      commandId,
      docsCapabilityId: docsMap.get(commandId),
      runtimeCapabilityId: runtimeMap.get(commandId),
    }));

  const missingHiddenAllowlistCommands = hiddenAllowlist.filter((commandId) => !runtimeMap.has(commandId));
  const missingRequiredCoreCommands = REQUIRED_CORE_COMMANDS.filter((commandId) => !runtimeMap.has(commandId));

  const nodeMatrix = isObjectRecord(capabilityMatrixRuntime?.node) ? capabilityMatrixRuntime.node : {};
  const disabledInNode = [...runtimeMap.entries()]
    .filter(([, capabilityId]) => nodeMatrix[capabilityId] !== true)
    .map(([commandId, capabilityId]) => ({ commandId, capabilityId }));

  const requiredVisibleCommandsCovered = coreSafetyAllowlist.filter((commandId) => runtimeMap.has(commandId)).length;

  return {
    ok: mismatches.length === 0
      && missingHiddenAllowlistCommands.length === 0
      && missingRequiredCoreCommands.length === 0
      && disabledInNode.length === 0
      && requiredVisibleCommandsCovered >= REQUIRED_CORE_COMMANDS.length,
    mismatches,
    missingHiddenAllowlistCommands,
    missingRequiredCoreCommands,
    disabledInNode,
    hiddenAllowlistCount: hiddenAllowlist.length,
    coreSafetyAllowlistCount: coreSafetyAllowlist.length,
    requiredVisibleCommandsCovered,
  };
}

function evaluateMenuAllowlistCommand(commandId, allowlist) {
  const normalized = normalizeString(commandId);
  return {
    ok: allowlist.has(normalized),
    reason: allowlist.has(normalized) ? '' : 'MENU_ITEM_OUTSIDE_ALLOWLIST',
  };
}

function evaluateCoreContractLeak(scopeClaims) {
  const claims = Array.isArray(scopeClaims) ? scopeClaims.map((entry) => normalizeString(entry).toUpperCase()) : [];
  const forbidden = claims.filter((entry) => FORBIDDEN_CORE_CHANGE_TOPICS.includes(entry));
  return {
    ok: forbidden.length === 0,
    reason: forbidden.length === 0 ? '' : 'UI_CHANGE_ALTERS_CORE_CONTRACT',
    forbidden,
  };
}

function evaluateModeVisibilityConflict(modeValues, allowedModes) {
  const modes = Array.isArray(modeValues) ? modeValues.map((entry) => normalizeString(entry)) : [];
  const unknown = modes.filter((mode) => !allowedModes.includes(mode));
  return {
    ok: unknown.length === 0,
    reason: unknown.length === 0 ? '' : 'MODE_VISIBILITY_CONFLICT',
    unknown,
  };
}

function evaluateProfileOverrideAgainstCapabilityPolicy(commandId, overriddenCapabilityId, runtimeMap, capabilityMatrixNode) {
  const normalizedCommand = normalizeString(commandId);
  const normalizedCapability = normalizeString(overriddenCapabilityId);

  const expectedCapability = runtimeMap.get(normalizedCommand) || '';
  const mismatch = expectedCapability !== normalizedCapability;
  const disabled = capabilityMatrixNode[normalizedCapability] !== true;

  return {
    ok: !mismatch && !disabled,
    reason: mismatch || disabled ? 'PROFILE_OVERRIDE_BREAKS_CAPABILITY_POLICY' : '',
    expectedCapability,
    providedCapability: normalizedCapability,
    mismatch,
    disabled,
  };
}

function evaluatePluginManifestRule(overlay, pluginPolicyDoc) {
  const requiredMetadata = toUniqueSortedStrings(pluginPolicyDoc?.requiredMetadata);
  const missingMetadata = requiredMetadata.filter((field) => normalizeString(overlay?.[field]).length === 0);
  return {
    ok: missingMetadata.length === 0,
    reason: missingMetadata.length === 0 ? '' : 'PLUGIN_OVERLAY_WITHOUT_MANIFEST_RULE',
    missingMetadata,
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

function evaluateX15Ws01UiMenuExpansionFoundationState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const canonStatusPath = path.resolve(repoRoot, normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH));
  const failsignalRegistryPath = path.resolve(
    repoRoot,
    normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
  );

  const menuOverlayPath = path.resolve(repoRoot, DEFAULT_MENU_OVERLAY_STACK_PATH);
  const pluginOverlayPolicyPath = path.resolve(repoRoot, DEFAULT_PLUGIN_OVERLAY_POLICY_PATH);
  const commandVisibilityPath = path.resolve(repoRoot, DEFAULT_COMMAND_VISIBILITY_MATRIX_PATH);
  const bindingPath = path.resolve(repoRoot, DEFAULT_COMMAND_CAPABILITY_BINDING_PATH);
  const enabledWhenPath = path.resolve(repoRoot, DEFAULT_ENABLEDWHEN_DSL_CANON_PATH);
  const capabilityPolicyPath = path.resolve(repoRoot, DEFAULT_CAPABILITY_POLICY_PATH);

  const canonStatusDoc = isObjectRecord(input.canonStatusDoc)
    ? input.canonStatusDoc
    : readJsonObject(canonStatusPath);
  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);

  const menuOverlayDoc = readJsonObject(menuOverlayPath);
  const pluginOverlayPolicyDoc = readJsonObject(pluginOverlayPolicyPath);
  const commandVisibilityDoc = readJsonObject(commandVisibilityPath);
  const commandBindingDoc = readJsonObject(bindingPath);
  const enabledWhenDslDoc = readJsonObject(enabledWhenPath);

  const capabilityPolicySource = readTextFile(capabilityPolicyPath);
  const parsedBinding = parseCapabilityObjectFromSource(capabilityPolicySource, 'CAPABILITY_BINDING');
  const parsedMatrix = parseCapabilityObjectFromSource(capabilityPolicySource, 'CAPABILITY_MATRIX');

  const canonLock = validateCanonLock(canonStatusDoc);
  const stageActivation = evaluateResolveActiveStageState({
    profile: 'release',
    gateTier: 'release',
  });
  const stageActivationGuardCheck = Number(stageActivation.STAGE_ACTIVATION_OK) === 1;

  const layerState = buildMenuLayerPolicyState(menuOverlayDoc);
  const modeShellState = buildModeShellState(enabledWhenDslDoc);
  const capabilitySyncState = buildCapabilitySyncState(
    commandVisibilityDoc,
    commandBindingDoc,
    parsedBinding.value,
    parsedMatrix.value,
  );

  const commandAllowlist = new Set([
    ...toUniqueSortedStrings(commandVisibilityDoc?.minimalProfileHiddenAllowlist),
    ...toUniqueSortedStrings(commandVisibilityDoc?.coreSafetyCommandAllowlist),
    ...Object.keys(parsedBinding.value || {}).map((entry) => normalizeString(entry)),
    ...((Array.isArray(commandBindingDoc?.items) ? commandBindingDoc.items : [])
      .map((entry) => normalizeString(entry?.commandId))
      .filter(Boolean)),
  ]);

  const negative01 = evaluateMenuAllowlistCommand('cmd.project.outsideAllowlistV1', commandAllowlist);
  const negative02 = evaluateCoreContractLeak(['UI_LAYOUT_ONLY', 'CORE_SCHEMA_CHANGES']);
  const negative03 = evaluateModeVisibilityConflict(['Write', 'Plan', 'Draft'], modeShellState.allowedModes);
  const runtimeCapabilityMap = new Map(Object.entries(parsedBinding.value || {}).map(([k, v]) => [normalizeString(k), normalizeString(v)]));
  const capabilityMatrixNode = isObjectRecord(parsedMatrix.value?.node) ? parsedMatrix.value.node : {};
  const negative04 = evaluateProfileOverrideAgainstCapabilityPolicy(
    'cmd.project.importMarkdownV1',
    'cap.project.nonexistent',
    runtimeCapabilityMap,
    capabilityMatrixNode,
  );
  const negative05 = evaluatePluginManifestRule(
    {
      pluginId: 'plugin.sample',
      overlayId: 'overlay-1',
      signatureStatus: '',
    },
    pluginOverlayPolicyDoc,
  );

  const drift = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc);

  const positive01 = layerState.ok;
  const positive02 = modeShellState.ok;
  const positive03 = capabilitySyncState.ok && parsedBinding.ok && parsedMatrix.ok;

  const negativeResults = {
    NEXT_TZ_NEGATIVE_01: negative01.ok === false,
    NEXT_TZ_NEGATIVE_02: negative02.ok === false,
    NEXT_TZ_NEGATIVE_03: negative03.ok === false,
    NEXT_TZ_NEGATIVE_04: negative04.ok === false,
    NEXT_TZ_NEGATIVE_05: negative05.ok === false,
  };

  const positiveResults = {
    NEXT_TZ_POSITIVE_01: positive01,
    NEXT_TZ_POSITIVE_02: positive02,
    NEXT_TZ_POSITIVE_03: positive03,
  };

  const allNegativesPass = Object.values(negativeResults).every(Boolean);
  const allPositivesPass = Object.values(positiveResults).every(Boolean);

  const uiMenuFoundationReady = layerState.ok
    && modeShellState.ok
    && positive03
    && evaluateCoreContractLeak(['UI_LAYOUT_ONLY', 'MENU_ONLY']).ok;

  const dod = {
    NEXT_TZ_DOD_01: uiMenuFoundationReady,
    NEXT_TZ_DOD_02: allNegativesPass,
    NEXT_TZ_DOD_03: allPositivesPass,
    NEXT_TZ_DOD_04: false,
    NEXT_TZ_DOD_05: drift.advisoryToBlockingDriftCountZero,
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
    && dod.NEXT_TZ_DOD_05;

  const state = {
    ok: preRepeatabilityOk,
    [TOKEN_NAME]: preRepeatabilityOk ? 1 : 0,
    failReason: '',
    failSignalCode: '',

    objective: 'CONTROLLED_UI_MENU_EXPANSION_WITHOUT_CORE_INVARIANT_LEAK',
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
      menuLayerCount: layerState.stackOrder.length,
      allowlistCommandCount: commandAllowlist.size,
      hiddenAllowlistCount: capabilitySyncState.hiddenAllowlistCount,
      coreSafetyAllowlistCount: capabilitySyncState.coreSafetyAllowlistCount,
      capabilityOverlapMismatchCount: capabilitySyncState.mismatches.length,
      missingHiddenAllowlistCommandsCount: capabilitySyncState.missingHiddenAllowlistCommands.length,
      missingRequiredCoreCommandsCount: capabilitySyncState.missingRequiredCoreCommands.length,
      advisoryToBlockingDriftCount: drift.advisoryToBlockingDriftCount,
    },

    layerState,
    modeShellState,
    capabilitySyncState,
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
      detectorId: 'X15_WS01_UI_MENU_FOUNDATION_SINGLE_DETECTOR_V1',
      canonicalModeEvaluatorId: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
    },
  };

  if (!state.ok) {
    state.failReason = !canonLock.ok
      ? canonLock.reason
      : !stageActivationGuardCheck
        ? 'STAGE_ACTIVATION_GUARD_FAIL'
        : !dod.NEXT_TZ_DOD_01
          ? 'UI_MENU_FOUNDATION_NOT_READY'
          : !dod.NEXT_TZ_DOD_02
            ? 'NEGATIVE_SCENARIO_FAILURE'
            : !dod.NEXT_TZ_DOD_03
              ? 'POSITIVE_SCENARIO_FAILURE'
              : !dod.NEXT_TZ_DOD_05
                ? 'ADVISORY_TO_BLOCKING_DRIFT'
                : 'X15_WS01_UI_MENU_EXPANSION_FOUNDATION_FAIL';
    state.failSignalCode = state.failReason;
  }

  return state;
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`MENU_LAYER_COUNT=${state.counts.menuLayerCount}`);
  console.log(`ALLOWLIST_COMMAND_COUNT=${state.counts.allowlistCommandCount}`);
  console.log(`CAPABILITY_OVERLAP_MISMATCH_COUNT=${state.counts.capabilityOverlapMismatchCount}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.counts.advisoryToBlockingDriftCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateX15Ws01UiMenuExpansionFoundationState({
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
  evaluateX15Ws01UiMenuExpansionFoundationState,
  TOKEN_NAME,
};
