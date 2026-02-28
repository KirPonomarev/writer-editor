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

const TOKEN_NAME = 'X16_WS03_REVIEW_TOOLS_MENU_GROUP_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';

const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_REVIEW_TOOLS_PATH = 'docs/OPS/STATUS/X16_WS03_REVIEW_TOOLS_MENU_GROUP_v1.json';
const DEFAULT_MENU_GROUPS_PATH = 'docs/OPS/STATUS/X16_MENU_FUNCTION_GROUPS_v1.json';
const DEFAULT_COMMAND_CAPABILITY_BINDING_PATH = 'docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json';
const DEFAULT_COMMAND_VISIBILITY_MATRIX_PATH = 'docs/OPS/STATUS/COMMAND_VISIBILITY_MATRIX.json';
const DEFAULT_SCOPEFLAGS_REGISTRY_PATH = 'docs/OPS/STATUS/SCOPEFLAGS_REGISTRY_v3_12.json';
const DEFAULT_COMMENT_HISTORY_SCOPE_FLAG_BINDING_PATH = 'docs/OPS/STATUS/COMMENT_HISTORY_SCOPE_FLAG_BINDING_V1.json';
const DEFAULT_TOKEN_CATALOG_PATH = 'docs/OPS/TOKENS/TOKEN_CATALOG.json';
const DEFAULT_CAPABILITY_POLICY_PATH = 'src/renderer/commands/capabilityPolicy.mjs';

const MODE_KEYS = Object.freeze(['prCore', 'release', 'promotion']);
const MODE_LABELS = Object.freeze({ prCore: 'pr', release: 'release', promotion: 'promotion' });

const EXPECTED_FEATURE_IDS = Object.freeze([
  'REVIEW_COMMENTS_LOCAL_FIRST',
  'REVIEW_HISTORY_COMPARE_LOCAL_FIRST',
]);
const EXPECTED_STAGE_IDS = Object.freeze(['X0', 'X1', 'X2', 'X3', 'X4']);
const STAGE_RANK = Object.freeze({ X0: 0, X1: 1, X2: 2, X3: 3, X4: 4 });
const EXPECTED_PROFILES = Object.freeze(['minimal', 'pro', 'guru']);

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

function normalizeReviewToolsDoc(doc) {
  const source = isObjectRecord(doc) ? doc : {};
  return {
    schemaVersion: Number(source.schemaVersion) || 1,
    reviewToolsVersion: normalizeString(source.reviewToolsVersion),
    nonBlockingClassification: normalizeString(source.nonBlockingClassification).toLowerCase(),
    blockingSurfaceExpansion: source.blockingSurfaceExpansion === true,
    formalMachineBinding: {
      status: normalizeString(source.formalMachineBinding?.status),
      blockingAllowed: source.formalMachineBinding?.blockingAllowed === true,
      note: normalizeString(source.formalMachineBinding?.note),
    },
    localFirstPolicy: {
      required: source.localFirstPolicy?.required === true,
      scopeFlag: normalizeString(source.localFirstPolicy?.scopeFlag),
      networkDependency: normalizeString(source.localFirstPolicy?.networkDependency),
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
  return new Set(flags.map((row) => normalizeString(row?.flagId)).filter(Boolean));
}

function parseCommentHistoryScopeBinding(doc) {
  const source = isObjectRecord(doc) ? doc : {};
  return {
    scopeFlag: normalizeString(source.scopeFlag),
    rules: {
      commentHistoryAcceptanceActiveOnlyWhenScopeFlagActive:
        source.rules?.commentHistoryAcceptanceActiveOnlyWhenScopeFlagActive === true,
      commentHistoryChecksNonBlockingWhenScopeFlagInactive:
        source.rules?.commentHistoryChecksNonBlockingWhenScopeFlagInactive === true,
      silentScopeEscalationForbidden: source.rules?.silentScopeEscalationForbidden === true,
    },
  };
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

  return { rowMap, duplicateConflicts, projection, projectionHash };
}

function hasReviewGroupVisibleBinding(menuGroups, menuGroupId, commandId) {
  const expectedProfiles = new Set(EXPECTED_PROFILES);
  const visibleProfiles = new Set();

  for (const entryRaw of menuGroups.entries) {
    if (!isObjectRecord(entryRaw)) continue;
    if (normalizeString(entryRaw.groupId) !== menuGroupId) continue;
    if (normalizeString(entryRaw.commandId) !== commandId) continue;

    const rules = Array.isArray(entryRaw.rules) ? entryRaw.rules : [];
    for (const ruleRaw of rules) {
      if (!isObjectRecord(ruleRaw)) continue;
      if (normalizeString(ruleRaw.mode) !== 'Review') continue;
      const channels = isObjectRecord(ruleRaw.channels) ? ruleRaw.channels : {};
      const allVisible = normalizeString(channels.menu) === 'visible'
        && normalizeString(channels.toolbar) === 'visible'
        && normalizeString(channels.palette) === 'visible';
      if (!allVisible) continue;

      const profiles = toUniqueStrings(ruleRaw.profiles, { lower: true, sort: false });
      for (const profile of profiles) {
        if (expectedProfiles.has(profile)) visibleProfiles.add(profile);
      }
    }
  }

  return expectedProfiles.size === visibleProfiles.size;
}

function stageAtLeast(activeStageId, minStageId) {
  const left = STAGE_RANK[normalizeString(activeStageId)] ?? -1;
  const right = STAGE_RANK[normalizeString(minStageId)] ?? 999;
  return left >= right;
}

function normalizeAllowedVisibility(entry) {
  const rows = Array.isArray(entry?.allowedVisibility) ? entry.allowedVisibility : [];
  const out = [];
  for (const rowRaw of rows) {
    if (!isObjectRecord(rowRaw)) continue;
    const mode = normalizeString(rowRaw.mode);
    const profiles = toUniqueStrings(rowRaw.profiles, { lower: true, sort: false });
    const channels = isObjectRecord(rowRaw.channels) ? rowRaw.channels : {};
    out.push({
      mode,
      profiles,
      channels: {
        menu: normalizeString(channels.menu),
        toolbar: normalizeString(channels.toolbar),
        palette: normalizeString(channels.palette),
      },
    });
  }
  return out;
}

function validateReviewTools({
  reviewTools,
  menuGroups,
  menuProjection,
  commandCapabilityBinding,
  runtimeCapabilityBinding,
  capabilityNode,
  scopeFlagSet,
  stageGatedDefaultState,
  activeStageId,
  commentHistoryScopeBinding,
  tokenCatalog,
}) {
  const featureById = new Map();
  const duplicateFeatureIds = [];

  for (const entryRaw of reviewTools.entries) {
    if (!isObjectRecord(entryRaw)) continue;
    const featureId = normalizeString(entryRaw.featureId);
    if (!featureId) continue;
    if (featureById.has(featureId)) duplicateFeatureIds.push(featureId);
    else featureById.set(featureId, entryRaw);
  }

  const missingFeatures = EXPECTED_FEATURE_IDS.filter((featureId) => !featureById.has(featureId));
  const unexpectedFeatures = [...featureById.keys()].filter((featureId) => !EXPECTED_FEATURE_IDS.includes(featureId));

  const policyErrors = [];
  if (reviewTools.nonBlockingClassification !== 'advisory') {
    policyErrors.push('NON_BLOCKING_CLASSIFICATION_MUST_BE_ADVISORY');
  }
  if (reviewTools.blockingSurfaceExpansion !== false) {
    policyErrors.push('BLOCKING_SURFACE_EXPANSION_MUST_BE_FALSE');
  }
  if (reviewTools.formalMachineBinding.status !== 'not_bound') {
    policyErrors.push('FORMAL_MACHINE_BINDING_STATUS_MUST_BE_NOT_BOUND');
  }
  if (reviewTools.formalMachineBinding.blockingAllowed !== false) {
    policyErrors.push('FORMAL_MACHINE_BINDING_BLOCKING_ALLOWED_MUST_BE_FALSE');
  }

  const localFirstPolicyErrors = [];
  if (reviewTools.localFirstPolicy.required !== true) {
    localFirstPolicyErrors.push('LOCAL_FIRST_POLICY_REQUIRED_TRUE_MISSING');
  }
  if (reviewTools.localFirstPolicy.scopeFlag !== commentHistoryScopeBinding.scopeFlag) {
    localFirstPolicyErrors.push('LOCAL_FIRST_SCOPEFLAG_MISMATCH');
  }
  if (reviewTools.localFirstPolicy.networkDependency !== 'forbidden') {
    localFirstPolicyErrors.push('LOCAL_FIRST_NETWORK_DEPENDENCY_MUST_BE_FORBIDDEN');
  }
  if (!commentHistoryScopeBinding.rules.commentHistoryAcceptanceActiveOnlyWhenScopeFlagActive) {
    localFirstPolicyErrors.push('COMMENT_HISTORY_SCOPE_BINDING_RULE_1_MISSING');
  }
  if (!commentHistoryScopeBinding.rules.commentHistoryChecksNonBlockingWhenScopeFlagInactive) {
    localFirstPolicyErrors.push('COMMENT_HISTORY_SCOPE_BINDING_RULE_2_MISSING');
  }
  if (!commentHistoryScopeBinding.rules.silentScopeEscalationForbidden) {
    localFirstPolicyErrors.push('COMMENT_HISTORY_SCOPE_BINDING_RULE_3_MISSING');
  }

  const blockingClassificationLeaks = [];
  if (reviewTools.nonBlockingClassification === 'blocking') {
    blockingClassificationLeaks.push({ source: 'root.nonBlockingClassification', value: 'blocking' });
  }

  const tokenIds = new Set((Array.isArray(tokenCatalog?.tokens) ? tokenCatalog.tokens : [])
    .map((row) => normalizeString(row?.tokenId))
    .filter(Boolean));
  const nonBoundBlockingTokens = [];
  if (tokenIds.has(TOKEN_NAME)) {
    nonBoundBlockingTokens.push({ tokenId: TOKEN_NAME, reason: 'TOKEN_ALREADY_EXISTS_WHILE_NOT_BOUND' });
  }

  const commandCapabilityMismatches = [];
  const missingStageGates = [];
  const unknownStageIds = [];
  const unknownScopeFlags = [];
  const reviewModeErrors = [];
  const missingReviewGroupBindings = [];
  const visibilityConflicts = [];
  const missingMenuRows = [];
  const unknownVisibilityModes = [];
  const unknownVisibilityProfiles = [];
  const unknownVisibilityStates = [];
  const historyCompareGuardErrors = [];
  const stageDisabledStateMismatches = [];

  const allowedStageContextId = EXPECTED_STAGE_IDS.includes(activeStageId) ? activeStageId : 'X4';
  const enabledWhenAllowed = {};

  for (const featureId of EXPECTED_FEATURE_IDS) {
    const entryRaw = featureById.get(featureId);
    if (!isObjectRecord(entryRaw)) continue;

    const menuGroupId = normalizeString(entryRaw.menuGroupId);
    const commandId = normalizeString(entryRaw.commandId);
    const capabilityId = normalizeString(entryRaw.capabilityId);
    const historyCompareGuard = normalizeString(entryRaw.historyCompareGuard);
    const stageGate = isObjectRecord(entryRaw.stageGate) ? entryRaw.stageGate : {};

    if (!menuGroupId || !commandId || !capabilityId) {
      commandCapabilityMismatches.push({ featureId, reason: 'MISSING_MENU_GROUP_OR_COMMAND_OR_CAPABILITY' });
    }

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
    if (!fromBindingDoc || !fromRuntimeBinding
      || capabilityId !== fromBindingDoc || capabilityId !== fromRuntimeBinding) {
      commandCapabilityMismatches.push({
        featureId,
        commandId,
        declaredCapabilityId: capabilityId,
        bindingDocCapabilityId: fromBindingDoc || '',
        runtimeCapabilityId: fromRuntimeBinding || '',
      });
    }

    if (featureId === 'REVIEW_HISTORY_COMPARE_LOCAL_FIRST'
      && historyCompareGuard !== 'HISTORY_COMPARE_GUARD_REQUIRED') {
      historyCompareGuardErrors.push({
        featureId,
        commandId,
        historyCompareGuard,
        expected: 'HISTORY_COMPARE_GUARD_REQUIRED',
      });
    }
    if (featureId === 'REVIEW_COMMENTS_LOCAL_FIRST'
      && historyCompareGuard !== 'COMMENTS_LOCAL_FIRST_REQUIRED') {
      historyCompareGuardErrors.push({
        featureId,
        commandId,
        historyCompareGuard,
        expected: 'COMMENTS_LOCAL_FIRST_REQUIRED',
      });
    }

    if (!hasReviewGroupVisibleBinding(menuGroups, menuGroupId, commandId)) {
      missingReviewGroupBindings.push({ featureId, menuGroupId, commandId });
    }

    const allowedVisibility = normalizeAllowedVisibility(entryRaw);
    for (const row of allowedVisibility) {
      if (!menuGroups.modes.includes(row.mode)) {
        unknownVisibilityModes.push({ featureId, mode: row.mode });
      }
      if (row.mode !== 'Review') {
        reviewModeErrors.push({ featureId, mode: row.mode, reason: 'REVIEW_GROUP_MUST_BE_REVIEW_MODE_ONLY' });
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

    const stageOk = stageAtLeast(allowedStageContextId, minStageId);
    const scopeOk = Boolean(requiredScopeFlag);
    const capabilityOk = capabilityId && capabilityNode?.[capabilityId] === true;
    const localFirstOk = reviewTools.localFirstPolicy.required === true
      && reviewTools.localFirstPolicy.scopeFlag === commentHistoryScopeBinding.scopeFlag
      && reviewTools.localFirstPolicy.networkDependency === 'forbidden';

    enabledWhenAllowed[featureId] = stageOk && scopeOk && capabilityOk && localFirstOk;

    if (entryRaw.machineBinding?.blocking === true && reviewTools.formalMachineBinding.status !== 'bound') {
      blockingClassificationLeaks.push({ source: `${featureId}.machineBinding.blocking`, value: true });
    }
  }

  const ok = missingFeatures.length === 0
    && unexpectedFeatures.length === 0
    && duplicateFeatureIds.length === 0
    && policyErrors.length === 0
    && localFirstPolicyErrors.length === 0
    && blockingClassificationLeaks.length === 0
    && nonBoundBlockingTokens.length === 0
    && commandCapabilityMismatches.length === 0
    && missingStageGates.length === 0
    && unknownStageIds.length === 0
    && unknownScopeFlags.length === 0
    && reviewModeErrors.length === 0
    && missingReviewGroupBindings.length === 0
    && visibilityConflicts.length === 0
    && missingMenuRows.length === 0
    && unknownVisibilityModes.length === 0
    && unknownVisibilityProfiles.length === 0
    && unknownVisibilityStates.length === 0
    && historyCompareGuardErrors.length === 0
    && stageDisabledStateMismatches.length === 0;

  return {
    ok,
    missingFeatures,
    unexpectedFeatures,
    duplicateFeatureIds,
    policyErrors,
    localFirstPolicyErrors,
    blockingClassificationLeaks,
    nonBoundBlockingTokens,
    commandCapabilityMismatches,
    missingStageGates,
    unknownStageIds,
    unknownScopeFlags,
    reviewModeErrors,
    missingReviewGroupBindings,
    visibilityConflicts,
    missingMenuRows,
    unknownVisibilityModes,
    unknownVisibilityProfiles,
    unknownVisibilityStates,
    historyCompareGuardErrors,
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

function evaluateX16Ws03ReviewToolsMenuGroupState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());

  const canonStatusPath = path.resolve(repoRoot, normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH));
  const failsignalRegistryPath = path.resolve(repoRoot, normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH));
  const reviewToolsPath = path.resolve(repoRoot, DEFAULT_REVIEW_TOOLS_PATH);
  const menuGroupsPath = path.resolve(repoRoot, DEFAULT_MENU_GROUPS_PATH);
  const capabilityBindingPath = path.resolve(repoRoot, DEFAULT_COMMAND_CAPABILITY_BINDING_PATH);
  const commandVisibilityMatrixPath = path.resolve(repoRoot, DEFAULT_COMMAND_VISIBILITY_MATRIX_PATH);
  const scopeflagsRegistryPath = path.resolve(repoRoot, DEFAULT_SCOPEFLAGS_REGISTRY_PATH);
  const commentHistoryScopeBindingPath = path.resolve(repoRoot, DEFAULT_COMMENT_HISTORY_SCOPE_FLAG_BINDING_PATH);
  const tokenCatalogPath = path.resolve(repoRoot, DEFAULT_TOKEN_CATALOG_PATH);
  const capabilityPolicyPath = path.resolve(repoRoot, DEFAULT_CAPABILITY_POLICY_PATH);

  const canonStatusDoc = isObjectRecord(input.canonStatusDoc) ? input.canonStatusDoc : readJsonObject(canonStatusPath);
  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);

  const reviewToolsDocRaw = readJsonObject(reviewToolsPath);
  const menuGroupsDocRaw = readJsonObject(menuGroupsPath);
  const capabilityBindingDoc = readJsonObject(capabilityBindingPath);
  const commandVisibilityMatrixDoc = readJsonObject(commandVisibilityMatrixPath);
  const scopeflagsRegistryDoc = readJsonObject(scopeflagsRegistryPath);
  const commentHistoryScopeBindingDoc = readJsonObject(commentHistoryScopeBindingPath);
  const tokenCatalogDoc = readJsonObject(tokenCatalogPath);

  const capabilityPolicySource = readText(capabilityPolicyPath);
  const parsedRuntimeCapabilityBinding = parseCapabilityObjectFromSource(capabilityPolicySource, 'CAPABILITY_BINDING');
  const parsedRuntimeCapabilityMatrix = parseCapabilityObjectFromSource(capabilityPolicySource, 'CAPABILITY_MATRIX');

  const canonLock = validateCanonLock(canonStatusDoc);
  const stageActivation = evaluateResolveActiveStageState({ profile: 'release', gateTier: 'release' });
  const stageActivationGuardCheck = Number(stageActivation.STAGE_ACTIVATION_OK) === 1;

  const reviewTools = normalizeReviewToolsDoc(reviewToolsDocRaw);
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
  const commentHistoryScopeBinding = parseCommentHistoryScopeBinding(commentHistoryScopeBindingDoc);
  const stageGatedDefaultState = normalizeString(commandVisibilityMatrixDoc?.rules?.stageGatedDefaultState);

  const menuProjection = buildMenuProjection(menuGroups);

  const validateBaseline = () => validateReviewTools({
    reviewTools,
    menuGroups,
    menuProjection,
    commandCapabilityBinding,
    runtimeCapabilityBinding,
    capabilityNode,
    scopeFlagSet,
    stageGatedDefaultState,
    activeStageId: normalizeString(stageActivation.ACTIVE_STAGE_ID) || 'X0',
    commentHistoryScopeBinding,
    tokenCatalog: tokenCatalogDoc,
  });

  const baseline = validateBaseline();
  const determinism = evaluateDeterminism(validateBaseline);

  const negative01Doc = deepClone(reviewTools);
  if (negative01Doc.localFirstPolicy) {
    negative01Doc.localFirstPolicy.required = false;
  }
  const negative01 = validateReviewTools({
    reviewTools: normalizeReviewToolsDoc(negative01Doc),
    menuGroups,
    menuProjection,
    commandCapabilityBinding,
    runtimeCapabilityBinding,
    capabilityNode,
    scopeFlagSet,
    stageGatedDefaultState,
    activeStageId: normalizeString(stageActivation.ACTIVE_STAGE_ID) || 'X0',
    commentHistoryScopeBinding,
    tokenCatalog: tokenCatalogDoc,
  });

  const negative02Doc = deepClone(reviewTools);
  const commentsEntry02 = (negative02Doc.entries || []).find((row) => normalizeString(row?.featureId) === 'REVIEW_COMMENTS_LOCAL_FIRST');
  if (commentsEntry02 && Array.isArray(commentsEntry02.allowedVisibility) && commentsEntry02.allowedVisibility[0]) {
    commentsEntry02.allowedVisibility[0].mode = 'Write';
  }
  const negative02 = validateReviewTools({
    reviewTools: normalizeReviewToolsDoc(negative02Doc),
    menuGroups,
    menuProjection,
    commandCapabilityBinding,
    runtimeCapabilityBinding,
    capabilityNode,
    scopeFlagSet,
    stageGatedDefaultState,
    activeStageId: normalizeString(stageActivation.ACTIVE_STAGE_ID) || 'X0',
    commentHistoryScopeBinding,
    tokenCatalog: tokenCatalogDoc,
  });

  const negative03Doc = deepClone(reviewTools);
  const commentsEntry03 = (negative03Doc.entries || []).find((row) => normalizeString(row?.featureId) === 'REVIEW_COMMENTS_LOCAL_FIRST');
  if (commentsEntry03) {
    commentsEntry03.capabilityId = 'cap.project.save.mismatch';
  }
  const negative03 = validateReviewTools({
    reviewTools: normalizeReviewToolsDoc(negative03Doc),
    menuGroups,
    menuProjection,
    commandCapabilityBinding,
    runtimeCapabilityBinding,
    capabilityNode,
    scopeFlagSet,
    stageGatedDefaultState,
    activeStageId: normalizeString(stageActivation.ACTIVE_STAGE_ID) || 'X0',
    commentHistoryScopeBinding,
    tokenCatalog: tokenCatalogDoc,
  });

  const negative04Doc = deepClone(reviewTools);
  negative04Doc.nonBlockingClassification = 'blocking';
  const negative04 = validateReviewTools({
    reviewTools: normalizeReviewToolsDoc(negative04Doc),
    menuGroups,
    menuProjection,
    commandCapabilityBinding,
    runtimeCapabilityBinding,
    capabilityNode,
    scopeFlagSet,
    stageGatedDefaultState,
    activeStageId: normalizeString(stageActivation.ACTIVE_STAGE_ID) || 'X0',
    commentHistoryScopeBinding,
    tokenCatalog: tokenCatalogDoc,
  });

  const negative05Doc = deepClone(reviewTools);
  const historyEntry05 = (negative05Doc.entries || []).find((row) => normalizeString(row?.featureId) === 'REVIEW_HISTORY_COMPARE_LOCAL_FIRST');
  if (historyEntry05) {
    historyEntry05.historyCompareGuard = 'NONE';
  }
  const negative05 = validateReviewTools({
    reviewTools: normalizeReviewToolsDoc(negative05Doc),
    menuGroups,
    menuProjection,
    commandCapabilityBinding,
    runtimeCapabilityBinding,
    capabilityNode,
    scopeFlagSet,
    stageGatedDefaultState,
    activeStageId: normalizeString(stageActivation.ACTIVE_STAGE_ID) || 'X0',
    commentHistoryScopeBinding,
    tokenCatalog: tokenCatalogDoc,
  });

  const drift = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc);

  const negativeResults = {
    NEXT_TZ_NEGATIVE_01: negative01.localFirstPolicyErrors.length > 0,
    NEXT_TZ_NEGATIVE_02: negative02.reviewModeErrors.length > 0,
    NEXT_TZ_NEGATIVE_03: negative03.commandCapabilityMismatches.length > 0,
    NEXT_TZ_NEGATIVE_04: negative04.policyErrors.length > 0,
    NEXT_TZ_NEGATIVE_05: negative05.historyCompareGuardErrors.length > 0,
  };

  const positiveResults = {
    NEXT_TZ_POSITIVE_01: baseline.ok
      && baseline.enabledWhenAllowed.REVIEW_COMMENTS_LOCAL_FIRST === true
      && baseline.enabledWhenAllowed.REVIEW_HISTORY_COMPARE_LOCAL_FIRST === true,
    NEXT_TZ_POSITIVE_02: baseline.ok
      && baseline.localFirstPolicyErrors.length === 0
      && determinism.ok,
    NEXT_TZ_POSITIVE_03: baseline.ok
      && baseline.missingReviewGroupBindings.length === 0
      && baseline.visibilityConflicts.length === 0
      && baseline.commandCapabilityMismatches.length === 0
      && baseline.historyCompareGuardErrors.length === 0,
  };

  const allNegativesPass = Object.values(negativeResults).every(Boolean);
  const allPositivesPass = Object.values(positiveResults).every(Boolean);

  const reviewGroupReady = baseline.ok
    && parsedRuntimeCapabilityBinding.ok
    && parsedRuntimeCapabilityMatrix.ok
    && menuProjection.duplicateConflicts.length === 0;

  const dod = {
    NEXT_TZ_DOD_01: reviewGroupReady,
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

    objective: 'REVIEW_TOOLS_MENU_GROUP_LOCAL_FIRST_STAGE_GATED_NO_CORE_LEAK',
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
      reviewEntryCount: reviewTools.entries.length,
      menuProjectionRowCount: menuProjection.projection.length,
      modeCount: menuGroups.modes.length,
      profileCount: menuGroups.profiles.length,
      channelCount: menuGroups.channels.length,
      capabilityBindingCount: commandCapabilityBinding.size,
      runtimeCapabilityBindingCount: runtimeCapabilityBinding.size,
      missingReviewGroupBindingsCount: baseline.missingReviewGroupBindings.length,
      localFirstPolicyErrorCount: baseline.localFirstPolicyErrors.length,
      advisoryToBlockingDriftCount: drift.advisoryToBlockingDriftCount,
    },

    reviewTools,
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
      detectorId: 'X16_WS03_REVIEW_TOOLS_MENU_GROUP_SINGLE_DETECTOR_V1',
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
          ? 'REVIEW_TOOLS_GROUP_NOT_READY'
          : !dod.NEXT_TZ_DOD_02
            ? 'NEGATIVE_SCENARIO_FAILURE'
            : !dod.NEXT_TZ_DOD_03
              ? 'POSITIVE_SCENARIO_FAILURE'
              : !dod.NEXT_TZ_DOD_06
                ? 'ADVISORY_TO_BLOCKING_DRIFT'
                : 'X16_WS03_REVIEW_TOOLS_MENU_GROUP_FAIL';
    state.failSignalCode = state.failReason;
  }

  return state;
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`REVIEW_ENTRY_COUNT=${state.counts.reviewEntryCount}`);
  console.log(`MENU_PROJECTION_ROW_COUNT=${state.counts.menuProjectionRowCount}`);
  console.log(`MISSING_REVIEW_GROUP_BINDINGS_COUNT=${state.counts.missingReviewGroupBindingsCount}`);
  console.log(`LOCAL_FIRST_POLICY_ERROR_COUNT=${state.counts.localFirstPolicyErrorCount}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.counts.advisoryToBlockingDriftCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateX16Ws03ReviewToolsMenuGroupState({
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
  evaluateX16Ws03ReviewToolsMenuGroupState,
  TOKEN_NAME,
};
