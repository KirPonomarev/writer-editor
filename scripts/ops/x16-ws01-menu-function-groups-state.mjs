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

const TOKEN_NAME = 'X16_WS01_MENU_FUNCTION_GROUPS_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';

const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_MENU_FUNCTION_GROUPS_PATH = 'docs/OPS/STATUS/X16_MENU_FUNCTION_GROUPS_v1.json';
const DEFAULT_COMMAND_CAPABILITY_BINDING_PATH = 'docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json';
const DEFAULT_CAPABILITY_POLICY_PATH = 'src/renderer/commands/capabilityPolicy.mjs';

const MODE_KEYS = Object.freeze(['prCore', 'release', 'promotion']);
const MODE_LABELS = Object.freeze({ prCore: 'pr', release: 'release', promotion: 'promotion' });

const EXPECTED_GROUP_ALLOWLIST = Object.freeze([
  'File',
  'Edit',
  'View',
  'Insert',
  'Format',
  'Plan',
  'Review',
  'Tools',
]);
const EXPECTED_CHANNELS = Object.freeze(['menu', 'toolbar', 'palette']);
const EXPECTED_MODES = Object.freeze(['Write', 'Plan', 'Review']);
const EXPECTED_PROFILES = Object.freeze(['minimal', 'pro', 'guru']);
const EXPECTED_STATES = Object.freeze(['visible', 'hidden']);
const REQUIRED_CORE_COMMANDS = Object.freeze([
  'cmd.project.open',
  'cmd.project.save',
  'cmd.project.export.docxMin',
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

function normalizeMenuFunctionGroupsDoc(doc) {
  const source = isObjectRecord(doc) ? doc : {};
  return {
    schemaVersion: Number(source.schemaVersion) || 1,
    groupsVersion: normalizeString(source.groupsVersion),
    channels: toUniqueStrings(source.channels, { sort: false }),
    modes: toUniqueStrings(source.modes, { sort: false }),
    profiles: toUniqueStrings(source.profiles, { lower: true, sort: false }),
    states: toUniqueStrings(source.states, { sort: false }),
    groupAllowlist: toUniqueStrings(source.groupAllowlist, { sort: false }),
    requiredCoreCommands: toUniqueStrings(source.requiredCoreCommands),
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

function normalizeRuleChannels(channelsState, channels, states, context) {
  const normalized = {};
  const missingChannels = [];
  const unknownStates = [];

  for (const channel of channels) {
    const stateValue = normalizeString(channelsState?.[channel]);
    if (!stateValue) {
      missingChannels.push(channel);
      continue;
    }
    if (!states.has(stateValue)) {
      unknownStates.push({ ...context, channel, stateValue });
      continue;
    }
    normalized[channel] = stateValue;
  }

  return {
    normalized,
    missingChannels,
    unknownStates,
  };
}

function validateMenuFunctionGroups({
  menuFunctionGroups,
  capabilityBinding,
  capabilityNode,
}) {
  const channels = menuFunctionGroups.channels;
  const modes = new Set(menuFunctionGroups.modes);
  const profiles = new Set(menuFunctionGroups.profiles);
  const states = new Set(menuFunctionGroups.states);
  const groupAllowlistSet = new Set(menuFunctionGroups.groupAllowlist);

  const expectedGroupSet = new Set(EXPECTED_GROUP_ALLOWLIST);
  const expectedChannelSet = new Set(EXPECTED_CHANNELS);
  const expectedModeSet = new Set(EXPECTED_MODES);
  const expectedProfileSet = new Set(EXPECTED_PROFILES);
  const expectedStateSet = new Set(EXPECTED_STATES);
  const expectedRequiredCoreSet = new Set(REQUIRED_CORE_COMMANDS);

  const unknownModes = [];
  const unknownProfiles = [];
  const unknownStates = [];
  const missingChannelAssignments = [];
  const modeProfileConflicts = [];
  const commandGroupOutsideAllowlist = [];
  const channelInconsistencies = [];
  const commandWithoutCapabilityBinding = [];
  const commandWithDisabledCapability = [];

  const allowlistMissingExpected = EXPECTED_GROUP_ALLOWLIST.filter((groupId) => !groupAllowlistSet.has(groupId));
  const allowlistUnexpected = menuFunctionGroups.groupAllowlist.filter((groupId) => !expectedGroupSet.has(groupId));

  const channelsMissingExpected = EXPECTED_CHANNELS.filter((channel) => !new Set(channels).has(channel));
  const channelsUnexpected = channels.filter((channel) => !expectedChannelSet.has(channel));

  const modesMissingExpected = EXPECTED_MODES.filter((mode) => !modes.has(mode));
  const modesUnexpected = menuFunctionGroups.modes.filter((mode) => !expectedModeSet.has(mode));

  const profilesMissingExpected = EXPECTED_PROFILES.filter((profile) => !profiles.has(profile));
  const profilesUnexpected = menuFunctionGroups.profiles.filter((profile) => !expectedProfileSet.has(profile));

  const statesMissingExpected = EXPECTED_STATES.filter((stateValue) => !states.has(stateValue));
  const statesUnexpected = menuFunctionGroups.states.filter((stateValue) => !expectedStateSet.has(stateValue));

  const requiredCoreMissingFromDoc = REQUIRED_CORE_COMMANDS.filter((commandId) => !menuFunctionGroups.requiredCoreCommands.includes(commandId));
  const requiredCoreUnexpectedInDoc = menuFunctionGroups.requiredCoreCommands.filter(
    (commandId) => !expectedRequiredCoreSet.has(commandId),
  );

  const rowMap = new Map();
  const groupCoverage = new Set();

  menuFunctionGroups.entries.forEach((entryRaw, entryIndex) => {
    if (!isObjectRecord(entryRaw)) return;
    const groupId = normalizeString(entryRaw.groupId);
    const commandId = normalizeString(entryRaw.commandId);
    if (!groupId || !commandId) return;

    groupCoverage.add(groupId);

    if (!groupAllowlistSet.has(groupId)) {
      commandGroupOutsideAllowlist.push({ groupId, commandId, entryIndex });
    }

    const rules = Array.isArray(entryRaw.rules) ? entryRaw.rules : [];
    rules.forEach((ruleRaw, ruleIndex) => {
      if (!isObjectRecord(ruleRaw)) return;

      const mode = normalizeString(ruleRaw.mode);
      if (!modes.has(mode)) {
        unknownModes.push({ groupId, commandId, mode, entryIndex, ruleIndex });
      }

      const ruleProfiles = toUniqueStrings(ruleRaw.profiles, { lower: true, sort: false });
      const channelsState = isObjectRecord(ruleRaw.channels) ? ruleRaw.channels : {};

      for (const profile of ruleProfiles) {
        if (!profiles.has(profile)) {
          unknownProfiles.push({ groupId, commandId, mode, profile, entryIndex, ruleIndex });
          continue;
        }

        const key = `${groupId}|${commandId}|${mode}|${profile}`;
        const channelsResult = normalizeRuleChannels(channelsState, channels, states, {
          groupId,
          commandId,
          mode,
          profile,
          entryIndex,
          ruleIndex,
        });

        if (channelsResult.missingChannels.length > 0) {
          missingChannelAssignments.push({
            groupId,
            commandId,
            mode,
            profile,
            missingChannels: channelsResult.missingChannels,
            entryIndex,
            ruleIndex,
          });
          continue;
        }

        if (channelsResult.unknownStates.length > 0) {
          unknownStates.push(...channelsResult.unknownStates);
          continue;
        }

        const uniqueStates = [...new Set(Object.values(channelsResult.normalized))];
        if (uniqueStates.length > 1) {
          channelInconsistencies.push({
            groupId,
            commandId,
            mode,
            profile,
            channels: channelsResult.normalized,
            entryIndex,
            ruleIndex,
          });
        }

        if (rowMap.has(key)) {
          const previous = rowMap.get(key);
          const changed = stableStringify(previous.channels) !== stableStringify(channelsResult.normalized);
          if (changed) {
            modeProfileConflicts.push({
              groupId,
              commandId,
              mode,
              profile,
              previous: previous.channels,
              next: channelsResult.normalized,
              previousEntryIndex: previous.entryIndex,
              previousRuleIndex: previous.ruleIndex,
              nextEntryIndex: entryIndex,
              nextRuleIndex: ruleIndex,
            });
          }
        } else {
          rowMap.set(key, {
            groupId,
            commandId,
            mode,
            profile,
            channels: channelsResult.normalized,
            entryIndex,
            ruleIndex,
          });
        }
      }
    });
  });

  const groupCoverageMissing = EXPECTED_GROUP_ALLOWLIST.filter((groupId) => !groupCoverage.has(groupId));

  const commandRowsByCommandModeProfile = new Map();
  for (const row of rowMap.values()) {
    const key = `${row.commandId}|${row.mode}|${row.profile}`;
    if (!commandRowsByCommandModeProfile.has(key)) {
      commandRowsByCommandModeProfile.set(key, []);
    }
    commandRowsByCommandModeProfile.get(key).push(row);

    const capabilityId = capabilityBinding.get(row.commandId);
    const anyVisible = Object.values(row.channels).some((stateValue) => stateValue === 'visible');
    if (!anyVisible) continue;

    if (!capabilityId) {
      commandWithoutCapabilityBinding.push({
        groupId: row.groupId,
        commandId: row.commandId,
        mode: row.mode,
        profile: row.profile,
      });
      continue;
    }

    if (capabilityNode[capabilityId] !== true) {
      commandWithDisabledCapability.push({
        groupId: row.groupId,
        commandId: row.commandId,
        capabilityId,
        mode: row.mode,
        profile: row.profile,
      });
    }
  }

  const missingRequiredCoreCommandRows = [];
  for (const commandId of REQUIRED_CORE_COMMANDS) {
    for (const mode of EXPECTED_MODES) {
      for (const profile of EXPECTED_PROFILES) {
        const key = `${commandId}|${mode}|${profile}`;
        const candidates = commandRowsByCommandModeProfile.get(key) || [];
        if (candidates.length === 0) {
          missingRequiredCoreCommandRows.push({ commandId, mode, profile, reason: 'MISSING_RULE' });
          continue;
        }

        const hasFullyVisible = candidates.some((row) => Object.values(row.channels).every((stateValue) => stateValue === 'visible'));
        if (!hasFullyVisible) {
          missingRequiredCoreCommandRows.push({ commandId, mode, profile, reason: 'NOT_VISIBLE_ALL_CHANNELS' });
        }
      }
    }
  }

  const projection = [];
  for (const row of [...rowMap.values()].sort((a, b) => {
    const aKey = `${a.groupId}|${a.commandId}|${a.mode}|${a.profile}`;
    const bKey = `${b.groupId}|${b.commandId}|${b.mode}|${b.profile}`;
    return aKey.localeCompare(bKey);
  })) {
    projection.push({
      groupId: row.groupId,
      commandId: row.commandId,
      mode: row.mode,
      profile: row.profile,
      channels: row.channels,
    });
  }

  const projectionHash = createHash('sha256').update(stableStringify(projection)).digest('hex');

  const ok = allowlistMissingExpected.length === 0
    && allowlistUnexpected.length === 0
    && channelsMissingExpected.length === 0
    && channelsUnexpected.length === 0
    && modesMissingExpected.length === 0
    && modesUnexpected.length === 0
    && profilesMissingExpected.length === 0
    && profilesUnexpected.length === 0
    && statesMissingExpected.length === 0
    && statesUnexpected.length === 0
    && requiredCoreMissingFromDoc.length === 0
    && requiredCoreUnexpectedInDoc.length === 0
    && unknownModes.length === 0
    && unknownProfiles.length === 0
    && unknownStates.length === 0
    && missingChannelAssignments.length === 0
    && modeProfileConflicts.length === 0
    && commandGroupOutsideAllowlist.length === 0
    && channelInconsistencies.length === 0
    && commandWithoutCapabilityBinding.length === 0
    && commandWithDisabledCapability.length === 0
    && groupCoverageMissing.length === 0
    && missingRequiredCoreCommandRows.length === 0;

  return {
    ok,
    rowCount: projection.length,
    projection,
    projectionHash,
    allowlistMissingExpected,
    allowlistUnexpected,
    channelsMissingExpected,
    channelsUnexpected,
    modesMissingExpected,
    modesUnexpected,
    profilesMissingExpected,
    profilesUnexpected,
    statesMissingExpected,
    statesUnexpected,
    requiredCoreMissingFromDoc,
    requiredCoreUnexpectedInDoc,
    unknownModes,
    unknownProfiles,
    unknownStates,
    missingChannelAssignments,
    modeProfileConflicts,
    commandGroupOutsideAllowlist,
    channelInconsistencies,
    commandWithoutCapabilityBinding,
    commandWithDisabledCapability,
    groupCoverageMissing,
    missingRequiredCoreCommandRows,
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

function evaluateX16Ws01MenuFunctionGroupsState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());

  const canonStatusPath = path.resolve(repoRoot, normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH));
  const failsignalRegistryPath = path.resolve(repoRoot, normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH));
  const menuFunctionGroupsPath = path.resolve(repoRoot, DEFAULT_MENU_FUNCTION_GROUPS_PATH);
  const commandCapabilityBindingPath = path.resolve(repoRoot, DEFAULT_COMMAND_CAPABILITY_BINDING_PATH);
  const capabilityPolicyPath = path.resolve(repoRoot, DEFAULT_CAPABILITY_POLICY_PATH);

  const canonStatusDoc = isObjectRecord(input.canonStatusDoc) ? input.canonStatusDoc : readJsonObject(canonStatusPath);
  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);
  const menuFunctionGroupsDocRaw = readJsonObject(menuFunctionGroupsPath);
  const commandCapabilityBindingDoc = readJsonObject(commandCapabilityBindingPath);
  const capabilitySource = readText(capabilityPolicyPath);

  const parsedRuntimeCapabilityBinding = parseCapabilityObjectFromSource(capabilitySource, 'CAPABILITY_BINDING');
  const parsedRuntimeCapabilityMatrix = parseCapabilityObjectFromSource(capabilitySource, 'CAPABILITY_MATRIX');

  const canonLock = validateCanonLock(canonStatusDoc);
  const stageActivation = evaluateResolveActiveStageState({ profile: 'release', gateTier: 'release' });
  const stageActivationGuardCheck = Number(stageActivation.STAGE_ACTIVATION_OK) === 1;

  const menuFunctionGroups = normalizeMenuFunctionGroupsDoc(menuFunctionGroupsDocRaw);
  const capabilityBinding = parseCapabilityBindingDoc(commandCapabilityBindingDoc);
  const capabilityNode = isObjectRecord(parsedRuntimeCapabilityMatrix.value?.node)
    ? parsedRuntimeCapabilityMatrix.value.node
    : {};

  const validateBaseline = () => validateMenuFunctionGroups({
    menuFunctionGroups,
    capabilityBinding,
    capabilityNode,
  });

  const baseline = validateBaseline();
  const determinism = evaluateDeterminism(validateBaseline);

  const negative01Doc = deepClone(menuFunctionGroups);
  negative01Doc.entries.push({
    groupId: 'Tools',
    commandId: 'cmd.project.noCapabilityBindingX16',
    rules: [
      {
        mode: 'Write',
        profiles: ['minimal', 'pro', 'guru'],
        channels: { menu: 'visible', toolbar: 'visible', palette: 'visible' },
      },
    ],
  });
  const negative01 = validateMenuFunctionGroups({
    menuFunctionGroups: negative01Doc,
    capabilityBinding,
    capabilityNode,
  });

  const negative02Doc = deepClone(menuFunctionGroups);
  negative02Doc.requiredCoreCommands = negative02Doc.requiredCoreCommands
    .filter((commandId) => commandId !== 'cmd.project.save');
  const negative02 = validateMenuFunctionGroups({
    menuFunctionGroups: negative02Doc,
    capabilityBinding,
    capabilityNode,
  });

  const negative03Doc = deepClone(menuFunctionGroups);
  negative03Doc.entries.push({
    groupId: 'Insert',
    commandId: 'cmd.project.importMarkdownV1',
    rules: [
      {
        mode: 'Write',
        profiles: ['pro'],
        channels: { menu: 'hidden', toolbar: 'hidden', palette: 'hidden' },
      },
    ],
  });
  const negative03 = validateMenuFunctionGroups({
    menuFunctionGroups: negative03Doc,
    capabilityBinding,
    capabilityNode,
  });

  const negative04Doc = deepClone(menuFunctionGroups);
  negative04Doc.entries.push({
    groupId: 'ForbiddenGroup',
    commandId: 'project.create',
    rules: [
      {
        mode: 'Write',
        profiles: ['minimal', 'pro', 'guru'],
        channels: { menu: 'visible', toolbar: 'visible', palette: 'visible' },
      },
    ],
  });
  const negative04 = validateMenuFunctionGroups({
    menuFunctionGroups: negative04Doc,
    capabilityBinding,
    capabilityNode,
  });

  const negative05Doc = deepClone(menuFunctionGroups);
  if (negative05Doc.entries[0]?.rules?.[0]) {
    negative05Doc.entries[0].rules[0].channels = {
      menu: 'visible',
      toolbar: 'hidden',
      palette: 'visible',
    };
  }
  const negative05 = validateMenuFunctionGroups({
    menuFunctionGroups: negative05Doc,
    capabilityBinding,
    capabilityNode,
  });

  const drift = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc);

  const negativeResults = {
    NEXT_TZ_NEGATIVE_01: negative01.commandWithoutCapabilityBinding.length > 0,
    NEXT_TZ_NEGATIVE_02: negative02.requiredCoreMissingFromDoc.length > 0,
    NEXT_TZ_NEGATIVE_03: negative03.modeProfileConflicts.length > 0,
    NEXT_TZ_NEGATIVE_04: negative04.commandGroupOutsideAllowlist.length > 0,
    NEXT_TZ_NEGATIVE_05: negative05.channelInconsistencies.length > 0,
  };

  const positiveResults = {
    NEXT_TZ_POSITIVE_01: baseline.ok,
    NEXT_TZ_POSITIVE_02: baseline.ok && determinism.ok,
    NEXT_TZ_POSITIVE_03: baseline.missingRequiredCoreCommandRows.length === 0
      && baseline.requiredCoreMissingFromDoc.length === 0,
  };

  const allNegativesPass = Object.values(negativeResults).every(Boolean);
  const allPositivesPass = Object.values(positiveResults).every(Boolean);

  const groupsEnabledWithoutCoreLeak = baseline.ok
    && determinism.ok
    && parsedRuntimeCapabilityBinding.ok
    && parsedRuntimeCapabilityMatrix.ok;

  const dod = {
    NEXT_TZ_DOD_01: groupsEnabledWithoutCoreLeak,
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

    objective: 'MENU_FUNCTION_GROUPS_ENABLED_WITH_CANONICAL_GATING_NO_CORE_LEAK',
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
      groupAllowlistCount: menuFunctionGroups.groupAllowlist.length,
      groupCoverageCount: EXPECTED_GROUP_ALLOWLIST.length - baseline.groupCoverageMissing.length,
      channelCount: menuFunctionGroups.channels.length,
      modeCount: menuFunctionGroups.modes.length,
      profileCount: menuFunctionGroups.profiles.length,
      entryCount: menuFunctionGroups.entries.length,
      rowCount: baseline.rowCount,
      capabilityBindingCount: capabilityBinding.size,
      missingRequiredCoreCommandRowsCount: baseline.missingRequiredCoreCommandRows.length,
      advisoryToBlockingDriftCount: drift.advisoryToBlockingDriftCount,
    },

    menuFunctionGroups,
    baseline,
    determinism,

    parseState: {
      parsedRuntimeCapabilityBindingOk: parsedRuntimeCapabilityBinding.ok,
      parsedRuntimeCapabilityMatrixOk: parsedRuntimeCapabilityMatrix.ok,
      parsedRuntimeCapabilityBindingReason: parsedRuntimeCapabilityBinding.reason,
      parsedRuntimeCapabilityMatrixReason: parsedRuntimeCapabilityMatrix.reason,
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
      detectorId: 'X16_WS01_MENU_FUNCTION_GROUPS_SINGLE_DETECTOR_V1',
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
          ? 'FUNCTION_GROUPS_NOT_READY'
          : !dod.NEXT_TZ_DOD_02
            ? 'NEGATIVE_SCENARIO_FAILURE'
            : !dod.NEXT_TZ_DOD_03
              ? 'POSITIVE_SCENARIO_FAILURE'
              : !dod.NEXT_TZ_DOD_06
                ? 'ADVISORY_TO_BLOCKING_DRIFT'
                : 'X16_WS01_MENU_FUNCTION_GROUPS_FAIL';
    state.failSignalCode = state.failReason;
  }

  return state;
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`GROUP_ALLOWLIST_COUNT=${state.counts.groupAllowlistCount}`);
  console.log(`GROUP_COVERAGE_COUNT=${state.counts.groupCoverageCount}`);
  console.log(`ENTRY_COUNT=${state.counts.entryCount}`);
  console.log(`ROW_COUNT=${state.counts.rowCount}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.counts.advisoryToBlockingDriftCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateX16Ws01MenuFunctionGroupsState({
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
  evaluateX16Ws01MenuFunctionGroupsState,
  TOKEN_NAME,
};
