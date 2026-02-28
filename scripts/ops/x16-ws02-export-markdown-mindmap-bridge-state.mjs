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

const TOKEN_NAME = 'X16_WS02_EXPORT_MARKDOWN_MINDMAP_BRIDGE_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';

const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_BRIDGE_PATH = 'docs/OPS/STATUS/X16_WS02_EXPORT_MARKDOWN_MINDMAP_BRIDGE_v1.json';
const DEFAULT_MENU_GROUPS_PATH = 'docs/OPS/STATUS/X16_MENU_FUNCTION_GROUPS_v1.json';
const DEFAULT_COMMAND_CAPABILITY_BINDING_PATH = 'docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json';
const DEFAULT_COMMAND_VISIBILITY_MATRIX_PATH = 'docs/OPS/STATUS/COMMAND_VISIBILITY_MATRIX.json';
const DEFAULT_SCOPEFLAGS_REGISTRY_PATH = 'docs/OPS/STATUS/SCOPEFLAGS_REGISTRY_v3_12.json';
const DEFAULT_TOKEN_CATALOG_PATH = 'docs/OPS/TOKENS/TOKEN_CATALOG.json';
const DEFAULT_CAPABILITY_POLICY_PATH = 'src/renderer/commands/capabilityPolicy.mjs';

const MODE_KEYS = Object.freeze(['prCore', 'release', 'promotion']);
const MODE_LABELS = Object.freeze({ prCore: 'pr', release: 'release', promotion: 'promotion' });

const EXPECTED_FEATURE_IDS = Object.freeze([
  'EXPORT_MARKDOWN_MENU_PATH',
  'MINDMAP_DERIVED_VIEW_MENU_PATH',
]);

const EXPECTED_STAGE_IDS = Object.freeze(['X0', 'X1', 'X2', 'X3', 'X4']);
const STAGE_RANK = Object.freeze({ X0: 0, X1: 1, X2: 2, X3: 3, X4: 4 });

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

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
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

function normalizeBridgeDoc(doc) {
  const source = isObjectRecord(doc) ? doc : {};
  return {
    schemaVersion: Number(source.schemaVersion) || 1,
    bridgeVersion: normalizeString(source.bridgeVersion),
    nonBlockingClassification: normalizeString(source.nonBlockingClassification).toLowerCase(),
    blockingSurfaceExpansion: source.blockingSurfaceExpansion === true,
    formalMachineBinding: {
      status: normalizeString(source.formalMachineBinding?.status),
      blockingAllowed: source.formalMachineBinding?.blockingAllowed === true,
      note: normalizeString(source.formalMachineBinding?.note),
    },
    entries: Array.isArray(source.entries) ? source.entries : [],
  };
}

function normalizeMenuGroupsDoc(doc) {
  const source = isObjectRecord(doc) ? doc : {};
  return {
    channels: toUniqueStrings(source.channels, { sort: false }),
    modes: toUniqueStrings(source.modes, { sort: false }),
    profiles: toUniqueStrings(source.profiles, { lower: true, sort: false }),
    states: toUniqueStrings(source.states, { sort: false }),
    entries: Array.isArray(source.entries) ? source.entries : [],
  };
}

function parseCapabilityBindingDoc(doc) {
  const items = Array.isArray(doc?.items) ? doc.items : [];
  return new Map(
    items
      .map((row) => {
        if (!isObjectRecord(row)) return ['', ''];
        return [normalizeString(row.commandId), normalizeString(row.capabilityId)];
      })
      .filter(([commandId, capabilityId]) => commandId && capabilityId),
  );
}

function parseScopeFlagsRegistry(scopeflagsDoc) {
  const flags = Array.isArray(scopeflagsDoc?.flags) ? scopeflagsDoc.flags : [];
  return new Set(
    flags
      .map((row) => normalizeString(row?.flagId))
      .filter(Boolean),
  );
}

function buildMenuProjection(menuGroups) {
  const rowMap = new Map();
  const duplicateConflicts = [];

  for (const entryRaw of menuGroups.entries) {
    if (!isObjectRecord(entryRaw)) continue;
    const commandId = normalizeString(entryRaw.commandId);
    if (!commandId) continue;
    const rules = Array.isArray(entryRaw.rules) ? entryRaw.rules : [];

    for (const ruleRaw of rules) {
      if (!isObjectRecord(ruleRaw)) continue;
      const mode = normalizeString(ruleRaw.mode);
      const profiles = toUniqueStrings(ruleRaw.profiles, { lower: true, sort: false });
      const channels = isObjectRecord(ruleRaw.channels) ? ruleRaw.channels : {};

      for (const profile of profiles) {
        const key = `${commandId}|${mode}|${profile}`;
        const channelState = {
          menu: normalizeString(channels.menu),
          toolbar: normalizeString(channels.toolbar),
          palette: normalizeString(channels.palette),
        };

        if (rowMap.has(key)) {
          const prev = rowMap.get(key);
          if (stableStringify(prev) !== stableStringify(channelState)) {
            duplicateConflicts.push({ commandId, mode, profile, previous: prev, next: channelState });
          }
        } else {
          rowMap.set(key, channelState);
        }
      }
    }
  }

  const projection = [...rowMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, channels]) => {
      const [commandId, mode, profile] = key.split('|');
      return { commandId, mode, profile, channels };
    });

  const projectionHash = createHash('sha256').update(stableStringify(projection)).digest('hex');

  return {
    rowMap,
    duplicateConflicts,
    projection,
    projectionHash,
  };
}

function stageAtLeast(activeStageId, minStageId) {
  const left = STAGE_RANK[normalizeString(activeStageId)] ?? -1;
  const right = STAGE_RANK[normalizeString(minStageId)] ?? 999;
  return left >= right;
}

function evaluateEntryEnabledWhenAllowed(entry, context) {
  const minStageId = normalizeString(entry?.stageGate?.minStageId);
  const requiredScopeFlag = normalizeString(entry?.stageGate?.requiredScopeFlag);
  const capabilityId = normalizeString(entry?.capabilityId);

  const stageOk = stageAtLeast(context.activeStageId, minStageId);
  const scopeOk = requiredScopeFlag && context.scopeFlags.has(requiredScopeFlag);
  const capabilityOk = capabilityId && context.capabilityNode?.[capabilityId] === true;

  return stageOk && scopeOk && capabilityOk;
}

function normalizeAllowedVisibility(entry) {
  const rows = Array.isArray(entry?.allowedVisibility) ? entry.allowedVisibility : [];
  const out = [];

  for (const rowRaw of rows) {
    if (!isObjectRecord(rowRaw)) continue;
    const mode = normalizeString(rowRaw.mode);
    const profiles = toUniqueStrings(rowRaw.profiles, { lower: true, sort: false });
    const channels = isObjectRecord(rowRaw.channels) ? rowRaw.channels : {};
    const channelState = {
      menu: normalizeString(channels.menu),
      toolbar: normalizeString(channels.toolbar),
      palette: normalizeString(channels.palette),
    };
    out.push({ mode, profiles, channels: channelState });
  }

  return out;
}

function validateBridge({
  bridge,
  menuGroups,
  menuProjection,
  commandCapabilityBinding,
  runtimeCapabilityBinding,
  capabilityNode,
  scopeFlagSet,
  stageGatedDefaultState,
  activeStageId,
  tokenCatalog,
}) {
  const featureById = new Map();
  const duplicateFeatureIds = [];

  for (const entryRaw of bridge.entries) {
    if (!isObjectRecord(entryRaw)) continue;
    const featureId = normalizeString(entryRaw.featureId);
    if (!featureId) continue;
    if (featureById.has(featureId)) duplicateFeatureIds.push(featureId);
    else featureById.set(featureId, entryRaw);
  }

  const missingFeatures = EXPECTED_FEATURE_IDS.filter((featureId) => !featureById.has(featureId));
  const unexpectedFeatures = [...featureById.keys()].filter((featureId) => !EXPECTED_FEATURE_IDS.includes(featureId));

  const policyErrors = [];
  if (bridge.nonBlockingClassification !== 'advisory') {
    policyErrors.push('NON_BLOCKING_CLASSIFICATION_MUST_BE_ADVISORY');
  }
  if (bridge.blockingSurfaceExpansion !== false) {
    policyErrors.push('BLOCKING_SURFACE_EXPANSION_MUST_BE_FALSE');
  }
  if (bridge.formalMachineBinding.status !== 'not_bound') {
    policyErrors.push('FORMAL_MACHINE_BINDING_STATUS_MUST_BE_NOT_BOUND');
  }
  if (bridge.formalMachineBinding.blockingAllowed !== false) {
    policyErrors.push('FORMAL_MACHINE_BINDING_BLOCKING_ALLOWED_MUST_BE_FALSE');
  }

  const blockingClassificationLeaks = [];
  if (bridge.nonBlockingClassification === 'blocking') {
    blockingClassificationLeaks.push({ source: 'root.nonBlockingClassification', value: 'blocking' });
  }

  const commandCapabilityMismatches = [];
  const missingStageGates = [];
  const unknownStageIds = [];
  const unknownScopeFlags = [];
  const derivedGuardErrors = [];
  const visibilityConflicts = [];
  const missingMenuRows = [];
  const unknownVisibilityModes = [];
  const unknownVisibilityProfiles = [];
  const unknownVisibilityStates = [];
  const stageDisabledStateMismatches = [];

  const tokenIds = new Set((Array.isArray(tokenCatalog?.tokens) ? tokenCatalog.tokens : [])
    .map((row) => normalizeString(row?.tokenId))
    .filter(Boolean));
  const nonBoundBlockingTokens = [];
  if (tokenIds.has(TOKEN_NAME)) {
    nonBoundBlockingTokens.push({ tokenId: TOKEN_NAME, reason: 'TOKEN_ALREADY_EXISTS_WHILE_NOT_BOUND' });
  }

  const enabledWhenAllowed = {};
  const allowedStageContextId = EXPECTED_STAGE_IDS.includes(activeStageId) ? activeStageId : 'X4';

  for (const featureId of EXPECTED_FEATURE_IDS) {
    const entryRaw = featureById.get(featureId);
    if (!isObjectRecord(entryRaw)) continue;

    const commandId = normalizeString(entryRaw.commandId);
    const capabilityId = normalizeString(entryRaw.capabilityId);
    const derivedGuard = normalizeString(entryRaw.derivedGuard);
    const stageGate = isObjectRecord(entryRaw.stageGate) ? entryRaw.stageGate : {};

    const minStageId = normalizeString(stageGate.minStageId);
    const requiredScopeFlag = normalizeString(stageGate.requiredScopeFlag);
    const disabledVisibilityState = normalizeString(stageGate.disabledVisibilityState);

    if (!minStageId || !requiredScopeFlag || !disabledVisibilityState) {
      missingStageGates.push({ featureId, commandId, minStageId, requiredScopeFlag, disabledVisibilityState });
    }

    if (minStageId && !EXPECTED_STAGE_IDS.includes(minStageId)) {
      unknownStageIds.push({ featureId, minStageId });
    }

    if (requiredScopeFlag && !scopeFlagSet.has(requiredScopeFlag)) {
      unknownScopeFlags.push({ featureId, requiredScopeFlag });
    }

    if (disabledVisibilityState && stageGatedDefaultState && disabledVisibilityState !== stageGatedDefaultState) {
      stageDisabledStateMismatches.push({ featureId, expected: stageGatedDefaultState, actual: disabledVisibilityState });
    }

    const fromBindingDoc = commandCapabilityBinding.get(commandId);
    const fromRuntimeBinding = runtimeCapabilityBinding.get(commandId);
    if (!commandId || !capabilityId || !fromBindingDoc || !fromRuntimeBinding
      || capabilityId !== fromBindingDoc || capabilityId !== fromRuntimeBinding) {
      commandCapabilityMismatches.push({
        featureId,
        commandId,
        declaredCapabilityId: capabilityId,
        bindingDocCapabilityId: fromBindingDoc || '',
        runtimeCapabilityId: fromRuntimeBinding || '',
      });
    }

    if (featureId === 'MINDMAP_DERIVED_VIEW_MENU_PATH' && derivedGuard !== 'DERIVED_VIEW_ONLY') {
      derivedGuardErrors.push({ featureId, commandId, derivedGuard, expected: 'DERIVED_VIEW_ONLY' });
    }
    if (featureId === 'EXPORT_MARKDOWN_MENU_PATH' && derivedGuard !== 'NONE') {
      derivedGuardErrors.push({ featureId, commandId, derivedGuard, expected: 'NONE' });
    }

    const allowedVisibility = normalizeAllowedVisibility(entryRaw);
    for (const row of allowedVisibility) {
      if (!menuGroups.modes.includes(row.mode)) {
        unknownVisibilityModes.push({ featureId, mode: row.mode });
      }
      for (const profile of row.profiles) {
        if (!menuGroups.profiles.includes(profile)) {
          unknownVisibilityProfiles.push({ featureId, mode: row.mode, profile });
        }

        const key = `${commandId}|${row.mode}|${profile}`;
        const menuChannels = menuProjection.rowMap.get(key);

        if (!menuChannels) {
          missingMenuRows.push({ featureId, commandId, mode: row.mode, profile, reason: 'ROW_MISSING_IN_MENU_GROUPS' });
          continue;
        }

        for (const channel of menuGroups.channels) {
          const expectedState = normalizeString(row.channels[channel]);
          const actualState = normalizeString(menuChannels[channel]);

          if (!menuGroups.states.includes(expectedState)) {
            unknownVisibilityStates.push({ featureId, commandId, mode: row.mode, profile, channel, expectedState });
          }

          if (expectedState !== actualState) {
            visibilityConflicts.push({
              featureId,
              commandId,
              mode: row.mode,
              profile,
              channel,
              expected: expectedState,
              actual: actualState,
            });
          }
        }
      }
    }

    enabledWhenAllowed[featureId] = evaluateEntryEnabledWhenAllowed(entryRaw, {
      activeStageId: allowedStageContextId,
      scopeFlags: new Set([requiredScopeFlag]),
      capabilityNode,
    });

    if (entryRaw.machineBinding?.blocking === true && bridge.formalMachineBinding.status !== 'bound') {
      blockingClassificationLeaks.push({
        source: `${featureId}.machineBinding.blocking`,
        value: true,
      });
    }
  }

  const ok = missingFeatures.length === 0
    && unexpectedFeatures.length === 0
    && duplicateFeatureIds.length === 0
    && policyErrors.length === 0
    && blockingClassificationLeaks.length === 0
    && nonBoundBlockingTokens.length === 0
    && commandCapabilityMismatches.length === 0
    && missingStageGates.length === 0
    && unknownStageIds.length === 0
    && unknownScopeFlags.length === 0
    && derivedGuardErrors.length === 0
    && visibilityConflicts.length === 0
    && missingMenuRows.length === 0
    && unknownVisibilityModes.length === 0
    && unknownVisibilityProfiles.length === 0
    && unknownVisibilityStates.length === 0
    && stageDisabledStateMismatches.length === 0;

  return {
    ok,
    missingFeatures,
    unexpectedFeatures,
    duplicateFeatureIds,
    policyErrors,
    blockingClassificationLeaks,
    nonBoundBlockingTokens,
    commandCapabilityMismatches,
    missingStageGates,
    unknownStageIds,
    unknownScopeFlags,
    derivedGuardErrors,
    visibilityConflicts,
    missingMenuRows,
    unknownVisibilityModes,
    unknownVisibilityProfiles,
    unknownVisibilityStates,
    stageDisabledStateMismatches,
    enabledWhenAllowed,
  };
}

function evaluateDeterminism(validationFn) {
  const runA = validationFn();
  const runB = validationFn();
  const runC = validationFn();

  const hashA = createHash('sha256').update(stableStringify(runA)).digest('hex');
  const hashB = createHash('sha256').update(stableStringify(runB)).digest('hex');
  const hashC = createHash('sha256').update(stableStringify(runC)).digest('hex');

  const deterministic = runA.ok && runB.ok && runC.ok && hashA === hashB && hashB === hashC;
  return {
    ok: deterministic,
    hashes: [hashA, hashB, hashC],
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

function evaluateX16Ws02ExportMarkdownMindmapBridgeState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());

  const canonStatusPath = path.resolve(repoRoot, normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH));
  const failsignalRegistryPath = path.resolve(repoRoot, normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH));
  const bridgePath = path.resolve(repoRoot, DEFAULT_BRIDGE_PATH);
  const menuGroupsPath = path.resolve(repoRoot, DEFAULT_MENU_GROUPS_PATH);
  const capabilityBindingPath = path.resolve(repoRoot, DEFAULT_COMMAND_CAPABILITY_BINDING_PATH);
  const commandVisibilityMatrixPath = path.resolve(repoRoot, DEFAULT_COMMAND_VISIBILITY_MATRIX_PATH);
  const scopeflagsRegistryPath = path.resolve(repoRoot, DEFAULT_SCOPEFLAGS_REGISTRY_PATH);
  const tokenCatalogPath = path.resolve(repoRoot, DEFAULT_TOKEN_CATALOG_PATH);
  const capabilityPolicyPath = path.resolve(repoRoot, DEFAULT_CAPABILITY_POLICY_PATH);

  const canonStatusDoc = isObjectRecord(input.canonStatusDoc) ? input.canonStatusDoc : readJsonObject(canonStatusPath);
  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);

  const bridgeDocRaw = readJsonObject(bridgePath);
  const menuGroupsDocRaw = readJsonObject(menuGroupsPath);
  const capabilityBindingDoc = readJsonObject(capabilityBindingPath);
  const commandVisibilityMatrixDoc = readJsonObject(commandVisibilityMatrixPath);
  const scopeflagsRegistryDoc = readJsonObject(scopeflagsRegistryPath);
  const tokenCatalogDoc = readJsonObject(tokenCatalogPath);

  const capabilityPolicySource = readText(capabilityPolicyPath);
  const parsedRuntimeCapabilityBinding = parseCapabilityObjectFromSource(capabilityPolicySource, 'CAPABILITY_BINDING');
  const parsedRuntimeCapabilityMatrix = parseCapabilityObjectFromSource(capabilityPolicySource, 'CAPABILITY_MATRIX');

  const canonLock = validateCanonLock(canonStatusDoc);
  const stageActivation = evaluateResolveActiveStageState({ profile: 'release', gateTier: 'release' });
  const stageActivationGuardCheck = Number(stageActivation.STAGE_ACTIVATION_OK) === 1;

  const bridge = normalizeBridgeDoc(bridgeDocRaw);
  const menuGroups = normalizeMenuGroupsDoc(menuGroupsDocRaw);
  const commandCapabilityBinding = parseCapabilityBindingDoc(capabilityBindingDoc);
  const runtimeCapabilityBinding = new Map(
    Object.entries(parsedRuntimeCapabilityBinding.value || {})
      .map(([commandId, capabilityId]) => [normalizeString(commandId), normalizeString(capabilityId)])
      .filter(([commandId, capabilityId]) => commandId && capabilityId),
  );

  const capabilityNode = isObjectRecord(parsedRuntimeCapabilityMatrix.value?.node)
    ? parsedRuntimeCapabilityMatrix.value.node
    : {};

  const scopeFlagSet = parseScopeFlagsRegistry(scopeflagsRegistryDoc);
  const stageGatedDefaultState = normalizeString(commandVisibilityMatrixDoc?.rules?.stageGatedDefaultState);

  const menuProjection = buildMenuProjection(menuGroups);

  const validateBaseline = () => validateBridge({
    bridge,
    menuGroups,
    menuProjection,
    commandCapabilityBinding,
    runtimeCapabilityBinding,
    capabilityNode,
    scopeFlagSet,
    stageGatedDefaultState,
    activeStageId: normalizeString(stageActivation.ACTIVE_STAGE_ID) || 'X0',
    tokenCatalog: tokenCatalogDoc,
  });

  const baseline = validateBaseline();
  const determinism = evaluateDeterminism(validateBaseline);

  const negative01Bridge = deepClone(bridge);
  const exportEntry01 = (negative01Bridge.entries || []).find((row) => normalizeString(row?.featureId) === 'EXPORT_MARKDOWN_MENU_PATH');
  if (exportEntry01?.stageGate) {
    delete exportEntry01.stageGate.requiredScopeFlag;
  }
  const negative01 = validateBridge({
    bridge: normalizeBridgeDoc(negative01Bridge),
    menuGroups,
    menuProjection,
    commandCapabilityBinding,
    runtimeCapabilityBinding,
    capabilityNode,
    scopeFlagSet,
    stageGatedDefaultState,
    activeStageId: normalizeString(stageActivation.ACTIVE_STAGE_ID) || 'X0',
    tokenCatalog: tokenCatalogDoc,
  });

  const negative02Bridge = deepClone(bridge);
  const mindmapEntry02 = (negative02Bridge.entries || []).find((row) => normalizeString(row?.featureId) === 'MINDMAP_DERIVED_VIEW_MENU_PATH');
  if (mindmapEntry02) {
    mindmapEntry02.derivedGuard = 'NONE';
  }
  const negative02 = validateBridge({
    bridge: normalizeBridgeDoc(negative02Bridge),
    menuGroups,
    menuProjection,
    commandCapabilityBinding,
    runtimeCapabilityBinding,
    capabilityNode,
    scopeFlagSet,
    stageGatedDefaultState,
    activeStageId: normalizeString(stageActivation.ACTIVE_STAGE_ID) || 'X0',
    tokenCatalog: tokenCatalogDoc,
  });

  const negative03Bridge = deepClone(bridge);
  const exportEntry03 = (negative03Bridge.entries || []).find((row) => normalizeString(row?.featureId) === 'EXPORT_MARKDOWN_MENU_PATH');
  if (exportEntry03 && Array.isArray(exportEntry03.allowedVisibility) && exportEntry03.allowedVisibility[0]) {
    exportEntry03.allowedVisibility[0].mode = 'Write';
  }
  const negative03 = validateBridge({
    bridge: normalizeBridgeDoc(negative03Bridge),
    menuGroups,
    menuProjection,
    commandCapabilityBinding,
    runtimeCapabilityBinding,
    capabilityNode,
    scopeFlagSet,
    stageGatedDefaultState,
    activeStageId: normalizeString(stageActivation.ACTIVE_STAGE_ID) || 'X0',
    tokenCatalog: tokenCatalogDoc,
  });

  const negative04Bridge = deepClone(bridge);
  negative04Bridge.nonBlockingClassification = 'blocking';
  const negative04 = validateBridge({
    bridge: normalizeBridgeDoc(negative04Bridge),
    menuGroups,
    menuProjection,
    commandCapabilityBinding,
    runtimeCapabilityBinding,
    capabilityNode,
    scopeFlagSet,
    stageGatedDefaultState,
    activeStageId: normalizeString(stageActivation.ACTIVE_STAGE_ID) || 'X0',
    tokenCatalog: tokenCatalogDoc,
  });

  const negative05Bridge = deepClone(bridge);
  const exportEntry05 = (negative05Bridge.entries || []).find((row) => normalizeString(row?.featureId) === 'EXPORT_MARKDOWN_MENU_PATH');
  if (exportEntry05) {
    exportEntry05.capabilityId = 'cap.project.export.markdownV1.mismatch';
  }
  const negative05 = validateBridge({
    bridge: normalizeBridgeDoc(negative05Bridge),
    menuGroups,
    menuProjection,
    commandCapabilityBinding,
    runtimeCapabilityBinding,
    capabilityNode,
    scopeFlagSet,
    stageGatedDefaultState,
    activeStageId: normalizeString(stageActivation.ACTIVE_STAGE_ID) || 'X0',
    tokenCatalog: tokenCatalogDoc,
  });

  const drift = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc);

  const negativeResults = {
    NEXT_TZ_NEGATIVE_01: negative01.missingStageGates.length > 0,
    NEXT_TZ_NEGATIVE_02: negative02.derivedGuardErrors.length > 0,
    NEXT_TZ_NEGATIVE_03: negative03.visibilityConflicts.length > 0,
    NEXT_TZ_NEGATIVE_04: negative04.policyErrors.length > 0,
    NEXT_TZ_NEGATIVE_05: negative05.commandCapabilityMismatches.length > 0,
  };

  const positiveResults = {
    NEXT_TZ_POSITIVE_01: baseline.ok && baseline.enabledWhenAllowed.EXPORT_MARKDOWN_MENU_PATH === true,
    NEXT_TZ_POSITIVE_02: baseline.ok && baseline.enabledWhenAllowed.MINDMAP_DERIVED_VIEW_MENU_PATH === true,
    NEXT_TZ_POSITIVE_03: baseline.ok && determinism.ok,
  };

  const allNegativesPass = Object.values(negativeResults).every(Boolean);
  const allPositivesPass = Object.values(positiveResults).every(Boolean);

  const bridgeReady = baseline.ok
    && parsedRuntimeCapabilityBinding.ok
    && parsedRuntimeCapabilityMatrix.ok
    && menuProjection.duplicateConflicts.length === 0;

  const dod = {
    NEXT_TZ_DOD_01: bridgeReady,
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

    objective: 'EXPORT_MARKDOWN_AND_MINDMAP_BRIDGE_STAGE_GATED_NO_CORE_LEAK',
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
      bridgeEntryCount: bridge.entries.length,
      menuProjectionRowCount: menuProjection.projection.length,
      modeCount: menuGroups.modes.length,
      profileCount: menuGroups.profiles.length,
      channelCount: menuGroups.channels.length,
      capabilityBindingCount: commandCapabilityBinding.size,
      runtimeCapabilityBindingCount: runtimeCapabilityBinding.size,
      visibilityConflictCount: baseline.visibilityConflicts.length,
      missingStageGateCount: baseline.missingStageGates.length,
      advisoryToBlockingDriftCount: drift.advisoryToBlockingDriftCount,
    },

    bridge,
    baseline,
    determinism,

    parseState: {
      parsedRuntimeCapabilityBindingOk: parsedRuntimeCapabilityBinding.ok,
      parsedRuntimeCapabilityMatrixOk: parsedRuntimeCapabilityMatrix.ok,
      parsedRuntimeCapabilityBindingReason: parsedRuntimeCapabilityBinding.reason,
      parsedRuntimeCapabilityMatrixReason: parsedRuntimeCapabilityMatrix.reason,
      menuProjectionDuplicateConflicts: menuProjection.duplicateConflicts,
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
      detectorId: 'X16_WS02_EXPORT_MARKDOWN_MINDMAP_BRIDGE_SINGLE_DETECTOR_V1',
      canonicalModeEvaluatorId: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
      contentHash: createHash('sha256').update(stableStringify({
        baseline: {
          ok: baseline.ok,
          enabledWhenAllowed: baseline.enabledWhenAllowed,
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
          ? 'EXPORT_MINDMAP_BRIDGE_NOT_READY'
          : !dod.NEXT_TZ_DOD_02
            ? 'NEGATIVE_SCENARIO_FAILURE'
            : !dod.NEXT_TZ_DOD_03
              ? 'POSITIVE_SCENARIO_FAILURE'
              : !dod.NEXT_TZ_DOD_06
                ? 'ADVISORY_TO_BLOCKING_DRIFT'
                : 'X16_WS02_EXPORT_MARKDOWN_MINDMAP_BRIDGE_FAIL';
    state.failSignalCode = state.failReason;
  }

  return state;
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`BRIDGE_ENTRY_COUNT=${state.counts.bridgeEntryCount}`);
  console.log(`MENU_PROJECTION_ROW_COUNT=${state.counts.menuProjectionRowCount}`);
  console.log(`VISIBILITY_CONFLICT_COUNT=${state.counts.visibilityConflictCount}`);
  console.log(`MISSING_STAGE_GATE_COUNT=${state.counts.missingStageGateCount}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.counts.advisoryToBlockingDriftCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateX16Ws02ExportMarkdownMindmapBridgeState({
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
  evaluateX16Ws02ExportMarkdownMindmapBridgeState,
  TOKEN_NAME,
};
