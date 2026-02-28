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

const TOKEN_NAME = 'X17_WS03_FORMAT_PLAN_REVIEW_ACTIONS_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';

const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_FILE_EDIT_ACTIONS_PATH = 'docs/OPS/STATUS/X17_FORMAT_PLAN_REVIEW_ACTIONS_v1.json';
const DEFAULT_MENU_GROUPS_PATH = 'docs/OPS/STATUS/X16_MENU_FUNCTION_GROUPS_v1.json';
const DEFAULT_COMMAND_CAPABILITY_BINDING_PATH = 'docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json';
const DEFAULT_CAPABILITY_POLICY_PATH = 'src/renderer/commands/capabilityPolicy.mjs';
const DEFAULT_PROJECT_COMMANDS_PATH = 'src/renderer/commands/projectCommands.mjs';
const DEFAULT_EDITOR_PATH = 'src/renderer/editor.js';

const MODE_KEYS = Object.freeze(['prCore', 'release', 'promotion']);
const MODE_LABELS = Object.freeze({ prCore: 'pr', release: 'release', promotion: 'promotion' });

const EXPECTED_CHANNELS = Object.freeze(['menu', 'toolbar', 'palette']);
const EXPECTED_MODES = Object.freeze(['Write', 'Plan', 'Review']);
const EXPECTED_PROFILES = Object.freeze(['minimal', 'pro', 'guru']);
const EXPECTED_STATES = Object.freeze(['visible', 'hidden']);
const EXPECTED_ACTION_IDS = Object.freeze([
  'align-left',
  'align-center',
  'align-right',
  'align-justify',
  'flow-save-v1',
  'export-markdown-v1',
]);
const EXPECTED_COMMAND_IDS = Object.freeze([
  'cmd.project.format.alignLeft',
  'cmd.project.format.alignCenter',
  'cmd.project.format.alignRight',
  'cmd.project.format.alignJustify',
  'cmd.project.plan.flowSave',
  'cmd.project.review.exportMarkdown',
]);

const REQUIRED_EDITOR_MARKERS = Object.freeze([
  'dispatchUiCommand(EXTRA_COMMAND_IDS.FORMAT_ALIGN_LEFT)',
  'dispatchUiCommand(EXTRA_COMMAND_IDS.FORMAT_ALIGN_CENTER)',
  'dispatchUiCommand(EXTRA_COMMAND_IDS.FORMAT_ALIGN_RIGHT)',
  'dispatchUiCommand(EXTRA_COMMAND_IDS.FORMAT_ALIGN_JUSTIFY)',
  'dispatchUiCommand(EXTRA_COMMAND_IDS.PLAN_FLOW_SAVE)',
  'dispatchUiCommand(EXTRA_COMMAND_IDS.REVIEW_EXPORT_MARKDOWN)',
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
  const out = { json: false, canonStatusPath: '', failsignalRegistryPath: '' };

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

function parseObjectFromSource(rawSource, exportName) {
  const pattern = new RegExp(`export\\s+const\\s+${exportName}\\s*=\\s*Object\\.freeze\\((\\{[\\s\\S]*?\\})\\);`);
  const match = String(rawSource || '').match(pattern);
  if (!match || !match[1]) {
    return { ok: false, value: {}, reason: `${exportName}_NOT_FOUND` };
  }

  try {
    const parsed = Function(`"use strict"; return (${match[1]});`)();
    if (!isObjectRecord(parsed)) {
      return { ok: false, value: {}, reason: `${exportName}_NOT_OBJECT` };
    }
    return { ok: true, value: parsed, reason: '' };
  } catch {
    return { ok: false, value: {}, reason: `${exportName}_PARSE_ERROR` };
  }
}

function validateCanonLock(canonStatusDoc) {
  if (!isObjectRecord(canonStatusDoc)) {
    return { ok: false, reason: 'CANON_STATUS_UNREADABLE', observedStatus: '', observedVersion: '' };
  }

  const observedStatus = normalizeString(canonStatusDoc.status);
  const observedVersion = normalizeString(canonStatusDoc.canonVersion);
  const ok = observedStatus === 'ACTIVE_CANON' && observedVersion.toLowerCase() === EXPECTED_CANON_VERSION;

  return { ok, reason: ok ? '' : 'ACTIVE_CANON_LOCK_FAIL', observedStatus, observedVersion };
}

function normalizeFileEditActionsDoc(doc) {
  const source = isObjectRecord(doc) ? doc : {};
  return {
    schemaVersion: Number(source.schemaVersion) || 1,
    actionsVersion: normalizeString(source.actionsVersion),
    nonBlockingClassification: normalizeString(source.nonBlockingClassification).toLowerCase(),
    blockingSurfaceExpansion: source.blockingSurfaceExpansion === true,
    formalMachineBinding: {
      status: normalizeString(source.formalMachineBinding?.status),
      blockingAllowed: source.formalMachineBinding?.blockingAllowed === true,
      note: normalizeString(source.formalMachineBinding?.note),
    },
    channels: toUniqueStrings(source.channels, { sort: false }),
    modes: toUniqueStrings(source.modes, { sort: false }),
    profiles: toUniqueStrings(source.profiles, { lower: true, sort: false }),
    states: toUniqueStrings(source.states, { sort: false }),
    requiredCoreActions: toUniqueStrings(source.requiredCoreActions),
    requiredCoreCommands: toUniqueStrings(source.requiredCoreCommands),
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

function parseLegacyActionMap(rawSource) {
  const pattern = /export\s+const\s+LEGACY_ACTION_TO_COMMAND\s*=\s*Object\.freeze\((\{[\s\S]*?\})\);/;
  const match = String(rawSource || '').match(pattern);
  if (!match || !match[1]) {
    return { ok: false, value: {}, reason: 'LEGACY_ACTION_TO_COMMAND_NOT_FOUND' };
  }
  try {
    const parsed = Function(`"use strict"; return (${match[1]});`)();
    if (!isObjectRecord(parsed)) {
      return { ok: false, value: {}, reason: 'LEGACY_ACTION_TO_COMMAND_NOT_OBJECT' };
    }
    return { ok: true, value: parsed, reason: '' };
  } catch {
    return { ok: false, value: {}, reason: 'LEGACY_ACTION_TO_COMMAND_PARSE_ERROR' };
  }
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

function validateFileEditActions({
  fileEditActions,
  menuGroups,
  capabilityBinding,
  runtimeCapabilityBinding,
  capabilityNode,
  legacyActionMap,
  projectCommandsSource,
  editorSource,
}) {
  const channels = fileEditActions.channels;
  const modes = new Set(fileEditActions.modes);
  const profiles = new Set(fileEditActions.profiles);
  const states = new Set(fileEditActions.states);

  const expectedChannelsSet = new Set(EXPECTED_CHANNELS);
  const expectedModesSet = new Set(EXPECTED_MODES);
  const expectedProfilesSet = new Set(EXPECTED_PROFILES);
  const expectedStatesSet = new Set(EXPECTED_STATES);
  const expectedActionSet = new Set(EXPECTED_ACTION_IDS);
  const expectedCommandSet = new Set(EXPECTED_COMMAND_IDS);

  const channelsMissingExpected = EXPECTED_CHANNELS.filter((value) => !new Set(channels).has(value));
  const channelsUnexpected = channels.filter((value) => !expectedChannelsSet.has(value));
  const modesMissingExpected = EXPECTED_MODES.filter((value) => !modes.has(value));
  const modesUnexpected = fileEditActions.modes.filter((value) => !expectedModesSet.has(value));
  const profilesMissingExpected = EXPECTED_PROFILES.filter((value) => !profiles.has(value));
  const profilesUnexpected = fileEditActions.profiles.filter((value) => !expectedProfilesSet.has(value));
  const statesMissingExpected = EXPECTED_STATES.filter((value) => !states.has(value));
  const statesUnexpected = fileEditActions.states.filter((value) => !expectedStatesSet.has(value));

  const requiredActionsMissingFromDoc = EXPECTED_ACTION_IDS.filter((value) => !fileEditActions.requiredCoreActions.includes(value));
  const requiredActionsUnexpectedInDoc = fileEditActions.requiredCoreActions.filter((value) => !expectedActionSet.has(value));
  const requiredCommandsMissingFromDoc = EXPECTED_COMMAND_IDS.filter((value) => !fileEditActions.requiredCoreCommands.includes(value));
  const requiredCommandsUnexpectedInDoc = fileEditActions.requiredCoreCommands.filter((value) => !expectedCommandSet.has(value));

  const unknownModes = [];
  const unknownProfiles = [];
  const unknownStates = [];
  const missingChannelAssignments = [];
  const channelInconsistencies = [];
  const modeProfileConflicts = [];
  const actionWithoutCommandBusRoute = [];
  const commandWithoutCapabilityBinding = [];
  const capabilityBindingMismatch = [];
  const runtimeCapabilityBindingMismatch = [];
  const commandWithDisabledCapability = [];
  const missingLegacyActionMappings = [];
  const projectCommandSourceMissing = [];
  const editorDispatchMissing = [];
  const menuProjectionGaps = [];
  const bindingOrderDuplicates = [];

  const menuProjection = buildMenuProjection(menuGroups);

  const rowMap = new Map();
  const actionCoverage = new Set();
  const commandCoverage = new Set();
  const bindingOrderSeen = new Set();
  const bindingOrders = [];

  fileEditActions.entries.forEach((entryRaw, entryIndex) => {
    if (!isObjectRecord(entryRaw)) return;

    const actionId = normalizeString(entryRaw.actionId);
    const commandId = normalizeString(entryRaw.commandId);
    const capabilityId = normalizeString(entryRaw.capabilityId);
    const route = normalizeString(entryRaw.route);
    const bindingOrder = Number(entryRaw.bindingOrder);

    if (actionId) actionCoverage.add(actionId);
    if (commandId) commandCoverage.add(commandId);

    if (!Number.isInteger(bindingOrder) || bindingOrder <= 0) {
      bindingOrderDuplicates.push({ entryIndex, actionId, commandId, bindingOrder, reason: 'INVALID_ORDER' });
    } else {
      if (bindingOrderSeen.has(bindingOrder)) {
        bindingOrderDuplicates.push({ entryIndex, actionId, commandId, bindingOrder, reason: 'DUPLICATE_ORDER' });
      }
      bindingOrderSeen.add(bindingOrder);
      bindingOrders.push(bindingOrder);
    }

    if (!actionId || !commandId || !capabilityId) {
      commandWithoutCapabilityBinding.push({ entryIndex, actionId, commandId, capabilityId, reason: 'ENTRY_FIELDS_MISSING' });
      return;
    }

    if (route !== 'command.bus') {
      actionWithoutCommandBusRoute.push({ entryIndex, actionId, commandId, route });
    }

    const declaredCapability = capabilityBinding.get(commandId) || '';
    if (!declaredCapability) {
      commandWithoutCapabilityBinding.push({ entryIndex, actionId, commandId, capabilityId, reason: 'DOC_BINDING_MISSING' });
    } else if (declaredCapability !== capabilityId) {
      capabilityBindingMismatch.push({ entryIndex, actionId, commandId, capabilityId, declaredCapability });
    }

    const runtimeCapability = runtimeCapabilityBinding[commandId] || '';
    if (!runtimeCapability) {
      runtimeCapabilityBindingMismatch.push({ entryIndex, actionId, commandId, capabilityId, runtimeCapability, reason: 'RUNTIME_BINDING_MISSING' });
    } else if (runtimeCapability !== capabilityId) {
      runtimeCapabilityBindingMismatch.push({ entryIndex, actionId, commandId, capabilityId, runtimeCapability, reason: 'RUNTIME_BINDING_MISMATCH' });
    }

    if (capabilityNode[capabilityId] !== true) {
      commandWithDisabledCapability.push({ entryIndex, actionId, commandId, capabilityId });
    }

    if (legacyActionMap[actionId] !== commandId) {
      missingLegacyActionMappings.push({ actionId, commandId, mapped: normalizeString(legacyActionMap[actionId]) });
    }

    if (!String(projectCommandsSource || '').includes(commandId)) {
      projectCommandSourceMissing.push({ actionId, commandId });
    }

    const rules = Array.isArray(entryRaw.rules) ? entryRaw.rules : [];
    rules.forEach((ruleRaw, ruleIndex) => {
      if (!isObjectRecord(ruleRaw)) return;
      const mode = normalizeString(ruleRaw.mode);
      if (!modes.has(mode)) {
        unknownModes.push({ actionId, commandId, mode, entryIndex, ruleIndex });
      }

      const ruleProfiles = toUniqueStrings(ruleRaw.profiles, { lower: true, sort: false });
      const channelsState = isObjectRecord(ruleRaw.channels) ? ruleRaw.channels : {};

      for (const profile of ruleProfiles) {
        if (!profiles.has(profile)) {
          unknownProfiles.push({ actionId, commandId, mode, profile, entryIndex, ruleIndex });
          continue;
        }

        const key = `${actionId}|${commandId}|${mode}|${profile}`;
        const channelValues = {};
        const missingChannels = [];

        for (const channel of channels) {
          const stateValue = normalizeString(channelsState[channel]);
          if (!stateValue) {
            missingChannels.push(channel);
            continue;
          }
          if (!states.has(stateValue)) {
            unknownStates.push({ actionId, commandId, mode, profile, channel, stateValue, entryIndex, ruleIndex });
            continue;
          }
          channelValues[channel] = stateValue;
        }

        if (missingChannels.length > 0) {
          missingChannelAssignments.push({ actionId, commandId, mode, profile, missingChannels, entryIndex, ruleIndex });
          continue;
        }

        const uniqueStates = [...new Set(Object.values(channelValues))];
        if (uniqueStates.length > 1) {
          channelInconsistencies.push({ actionId, commandId, mode, profile, channelValues, entryIndex, ruleIndex });
        }

        if (rowMap.has(key)) {
          const previous = rowMap.get(key);
          if (stableStringify(previous.channels) !== stableStringify(channelValues)) {
            modeProfileConflicts.push({
              actionId,
              commandId,
              mode,
              profile,
              previous: previous.channels,
              next: channelValues,
              previousEntryIndex: previous.entryIndex,
              previousRuleIndex: previous.ruleIndex,
              nextEntryIndex: entryIndex,
              nextRuleIndex: ruleIndex,
            });
          }
        } else {
          rowMap.set(key, {
            actionId,
            commandId,
            mode,
            profile,
            channels: channelValues,
            entryIndex,
            ruleIndex,
          });
        }

        const menuProjectionRow = menuProjection.rowMap.get(`${commandId}|${mode}|${profile}`);
        if (!menuProjectionRow) {
          menuProjectionGaps.push({ actionId, commandId, mode, profile, reason: 'MISSING_IN_MENU_GROUPS' });
        } else if (stableStringify(menuProjectionRow) !== stableStringify(channelValues)) {
          menuProjectionGaps.push({ actionId, commandId, mode, profile, reason: 'CHANNEL_MISMATCH', expected: channelValues, actual: menuProjectionRow });
        }
      }
    });
  });

  for (const marker of REQUIRED_EDITOR_MARKERS) {
    if (!String(editorSource || '').includes(marker)) {
      editorDispatchMissing.push({ marker });
    }
  }

  const missingRequiredActionRows = [];
  for (const actionId of EXPECTED_ACTION_IDS) {
    const entry = fileEditActions.entries.find((row) => normalizeString(row?.actionId) === actionId);
    const commandId = normalizeString(entry?.commandId);
    if (!commandId) {
      missingRequiredActionRows.push({ actionId, commandId: '', mode: '', profile: '', reason: 'ENTRY_MISSING' });
      continue;
    }

    for (const mode of EXPECTED_MODES) {
      for (const profile of EXPECTED_PROFILES) {
        const key = `${actionId}|${commandId}|${mode}|${profile}`;
        const row = rowMap.get(key);
        if (!row) {
          missingRequiredActionRows.push({ actionId, commandId, mode, profile, reason: 'RULE_MISSING' });
          continue;
        }
        const allVisible = Object.values(row.channels).every((stateValue) => stateValue === 'visible');
        if (!allVisible) {
          missingRequiredActionRows.push({ actionId, commandId, mode, profile, reason: 'NOT_VISIBLE_ALL_CHANNELS' });
        }
      }
    }
  }

  const projection = [...rowMap.values()]
    .sort((a, b) => {
      const aKey = `${a.actionId}|${a.commandId}|${a.mode}|${a.profile}`;
      const bKey = `${b.actionId}|${b.commandId}|${b.mode}|${b.profile}`;
      return aKey.localeCompare(bKey);
    })
    .map((row) => ({
      actionId: row.actionId,
      commandId: row.commandId,
      mode: row.mode,
      profile: row.profile,
      channels: row.channels,
    }));
  const projectionHash = createHash('sha256').update(stableStringify(projection)).digest('hex');

  const bindingOrderSorted = [...bindingOrders].sort((a, b) => a - b);
  const bindingOrderDeterministic = bindingOrders.length === bindingOrderSorted.length
    && bindingOrders.every((value, index) => value === bindingOrderSorted[index]);

  const ok = channelsMissingExpected.length === 0
    && channelsUnexpected.length === 0
    && modesMissingExpected.length === 0
    && modesUnexpected.length === 0
    && profilesMissingExpected.length === 0
    && profilesUnexpected.length === 0
    && statesMissingExpected.length === 0
    && statesUnexpected.length === 0
    && requiredActionsMissingFromDoc.length === 0
    && requiredActionsUnexpectedInDoc.length === 0
    && requiredCommandsMissingFromDoc.length === 0
    && requiredCommandsUnexpectedInDoc.length === 0
    && unknownModes.length === 0
    && unknownProfiles.length === 0
    && unknownStates.length === 0
    && missingChannelAssignments.length === 0
    && channelInconsistencies.length === 0
    && modeProfileConflicts.length === 0
    && actionWithoutCommandBusRoute.length === 0
    && commandWithoutCapabilityBinding.length === 0
    && capabilityBindingMismatch.length === 0
    && runtimeCapabilityBindingMismatch.length === 0
    && commandWithDisabledCapability.length === 0
    && missingLegacyActionMappings.length === 0
    && projectCommandSourceMissing.length === 0
    && editorDispatchMissing.length === 0
    && menuProjectionGaps.length === 0
    && missingRequiredActionRows.length === 0
    && bindingOrderDuplicates.length === 0
    && bindingOrderDeterministic;

  return {
    ok,
    rowCount: projection.length,
    projection,
    projectionHash,
    channelsMissingExpected,
    channelsUnexpected,
    modesMissingExpected,
    modesUnexpected,
    profilesMissingExpected,
    profilesUnexpected,
    statesMissingExpected,
    statesUnexpected,
    requiredActionsMissingFromDoc,
    requiredActionsUnexpectedInDoc,
    requiredCommandsMissingFromDoc,
    requiredCommandsUnexpectedInDoc,
    unknownModes,
    unknownProfiles,
    unknownStates,
    missingChannelAssignments,
    channelInconsistencies,
    modeProfileConflicts,
    actionWithoutCommandBusRoute,
    commandWithoutCapabilityBinding,
    capabilityBindingMismatch,
    runtimeCapabilityBindingMismatch,
    commandWithDisabledCapability,
    missingLegacyActionMappings,
    projectCommandSourceMissing,
    editorDispatchMissing,
    menuProjectionGaps,
    missingRequiredActionRows,
    bindingOrderDuplicates,
    bindingOrderDeterministic,
    bindingOrder: bindingOrders,
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

function evaluateX17Ws03FormatPlanReviewActionsState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());

  const canonStatusPath = path.resolve(repoRoot, normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH));
  const failsignalRegistryPath = path.resolve(repoRoot, normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH));
  const fileEditActionsPath = path.resolve(repoRoot, DEFAULT_FILE_EDIT_ACTIONS_PATH);
  const menuGroupsPath = path.resolve(repoRoot, DEFAULT_MENU_GROUPS_PATH);
  const commandCapabilityBindingPath = path.resolve(repoRoot, DEFAULT_COMMAND_CAPABILITY_BINDING_PATH);
  const capabilityPolicyPath = path.resolve(repoRoot, DEFAULT_CAPABILITY_POLICY_PATH);
  const projectCommandsPath = path.resolve(repoRoot, DEFAULT_PROJECT_COMMANDS_PATH);
  const editorPath = path.resolve(repoRoot, DEFAULT_EDITOR_PATH);

  const canonStatusDoc = isObjectRecord(input.canonStatusDoc) ? input.canonStatusDoc : readJsonObject(canonStatusPath);
  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);
  const fileEditActionsDocRaw = readJsonObject(fileEditActionsPath);
  const menuGroupsDocRaw = readJsonObject(menuGroupsPath);
  const commandCapabilityBindingDoc = readJsonObject(commandCapabilityBindingPath);
  const capabilitySource = readText(capabilityPolicyPath);
  const projectCommandsSource = readText(projectCommandsPath);
  const editorSource = readText(editorPath);

  const parsedRuntimeCapabilityBinding = parseObjectFromSource(capabilitySource, 'CAPABILITY_BINDING');
  const parsedRuntimeCapabilityMatrix = parseObjectFromSource(capabilitySource, 'CAPABILITY_MATRIX');
  const parsedLegacyActionMap = parseLegacyActionMap(projectCommandsSource);

  const canonLock = validateCanonLock(canonStatusDoc);
  const stageActivation = evaluateResolveActiveStageState({ profile: 'release', gateTier: 'release' });
  const stageActivationGuardCheck = Number(stageActivation.STAGE_ACTIVATION_OK) === 1;

  const fileEditActions = normalizeFileEditActionsDoc(fileEditActionsDocRaw);
  const menuGroups = normalizeMenuGroupsDoc(menuGroupsDocRaw);
  const capabilityBinding = parseCapabilityBindingDoc(commandCapabilityBindingDoc);
  const runtimeCapabilityBinding = isObjectRecord(parsedRuntimeCapabilityBinding.value)
    ? parsedRuntimeCapabilityBinding.value
    : {};
  const capabilityNode = isObjectRecord(parsedRuntimeCapabilityMatrix.value?.node)
    ? parsedRuntimeCapabilityMatrix.value.node
    : {};
  const legacyActionMap = isObjectRecord(parsedLegacyActionMap.value) ? parsedLegacyActionMap.value : {};

  const validateBaseline = () => validateFileEditActions({
    fileEditActions,
    menuGroups,
    capabilityBinding,
    runtimeCapabilityBinding,
    capabilityNode,
    legacyActionMap,
    projectCommandsSource,
    editorSource,
  });

  const baseline = validateBaseline();
  const determinism = evaluateDeterminism(validateBaseline);

  const negative01Doc = deepClone(fileEditActions);
  if (negative01Doc.entries[0]) negative01Doc.entries[0].route = 'ipc.renderer-main.direct';
  const negative01 = validateFileEditActions({
    fileEditActions: negative01Doc,
    menuGroups,
    capabilityBinding,
    runtimeCapabilityBinding,
    capabilityNode,
    legacyActionMap,
    projectCommandsSource,
    editorSource,
  });

  const negative02Binding = new Map(capabilityBinding);
  negative02Binding.delete('cmd.project.review.exportMarkdown');
  const negative02 = validateFileEditActions({
    fileEditActions,
    menuGroups,
    capabilityBinding: negative02Binding,
    runtimeCapabilityBinding,
    capabilityNode,
    legacyActionMap,
    projectCommandsSource,
    editorSource,
  });

  const negative03Doc = deepClone(fileEditActions);
  if (negative03Doc.entries[0]?.rules?.[0]?.channels) {
    negative03Doc.entries[0].rules[0].channels = {
      menu: 'visible',
      toolbar: 'hidden',
      palette: 'visible',
    };
  }
  const negative03 = validateFileEditActions({
    fileEditActions: negative03Doc,
    menuGroups,
    capabilityBinding,
    runtimeCapabilityBinding,
    capabilityNode,
    legacyActionMap,
    projectCommandsSource,
    editorSource,
  });

  const negative04Doc = deepClone(fileEditActions);
  if (negative04Doc.entries[2]?.rules?.[0]?.channels) {
    negative04Doc.entries[2].rules[0].channels = {
      menu: 'hidden',
      toolbar: 'hidden',
      palette: 'hidden',
    };
  }
  const negative04 = validateFileEditActions({
    fileEditActions: negative04Doc,
    menuGroups,
    capabilityBinding,
    runtimeCapabilityBinding,
    capabilityNode,
    legacyActionMap,
    projectCommandsSource,
    editorSource,
  });

  const negative05Doc = deepClone(fileEditActions);
  if (negative05Doc.entries[1]) {
    negative05Doc.entries[1].bindingOrder = negative05Doc.entries[0]?.bindingOrder || 10;
  }
  const negative05 = validateFileEditActions({
    fileEditActions: negative05Doc,
    menuGroups,
    capabilityBinding,
    runtimeCapabilityBinding,
    capabilityNode,
    legacyActionMap,
    projectCommandsSource,
    editorSource,
  });

  const drift = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc);

  const negativeResults = {
    NEXT_TZ_NEGATIVE_01: negative01.actionWithoutCommandBusRoute.length > 0,
    NEXT_TZ_NEGATIVE_02: negative02.commandWithoutCapabilityBinding.length > 0,
    NEXT_TZ_NEGATIVE_03: negative03.channelInconsistencies.length > 0,
    NEXT_TZ_NEGATIVE_04: negative04.missingRequiredActionRows.length > 0,
    NEXT_TZ_NEGATIVE_05: negative05.bindingOrderDuplicates.length > 0 || negative05.bindingOrderDeterministic === false,
  };

  const positiveResults = {
    NEXT_TZ_POSITIVE_01: baseline.ok,
    NEXT_TZ_POSITIVE_02: baseline.channelInconsistencies.length === 0,
    NEXT_TZ_POSITIVE_03: baseline.ok && determinism.ok && baseline.bindingOrderDeterministic,
  };

  const allNegativesPass = Object.values(negativeResults).every(Boolean);
  const allPositivesPass = Object.values(positiveResults).every(Boolean);

  const formatPlanReviewActionsEnabledWithoutCoreLeak = baseline.ok
    && determinism.ok
    && parsedRuntimeCapabilityBinding.ok
    && parsedRuntimeCapabilityMatrix.ok
    && parsedLegacyActionMap.ok;

  const dod = {
    NEXT_TZ_DOD_01: formatPlanReviewActionsEnabledWithoutCoreLeak,
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

    objective: 'FORMAT_PLAN_REVIEW_ACTIONS_ENABLED_WITH_COMMAND_BUS_AND_CAPABILITY_POLICY',
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
      actionCount: fileEditActions.entries.length,
      requiredActionCount: fileEditActions.requiredCoreActions.length,
      requiredCommandCount: fileEditActions.requiredCoreCommands.length,
      channelCount: fileEditActions.channels.length,
      modeCount: fileEditActions.modes.length,
      profileCount: fileEditActions.profiles.length,
      rowCount: baseline.rowCount,
      commandCapabilityBindingCount: capabilityBinding.size,
      missingRequiredActionRowsCount: baseline.missingRequiredActionRows.length,
      menuProjectionGapCount: baseline.menuProjectionGaps.length,
      advisoryToBlockingDriftCount: drift.advisoryToBlockingDriftCount,
    },

    fileEditActions,
    baseline,
    determinism,

    parseState: {
      parsedRuntimeCapabilityBindingOk: parsedRuntimeCapabilityBinding.ok,
      parsedRuntimeCapabilityMatrixOk: parsedRuntimeCapabilityMatrix.ok,
      parsedLegacyActionMapOk: parsedLegacyActionMap.ok,
      parsedRuntimeCapabilityBindingReason: parsedRuntimeCapabilityBinding.reason,
      parsedRuntimeCapabilityMatrixReason: parsedRuntimeCapabilityMatrix.reason,
      parsedLegacyActionMapReason: parsedLegacyActionMap.reason,
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
      detectorId: 'X17_WS03_FORMAT_PLAN_REVIEW_ACTIONS_SINGLE_DETECTOR_V1',
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
          ? 'FORMAT_PLAN_REVIEW_ACTIONS_NOT_READY'
          : !dod.NEXT_TZ_DOD_02
            ? 'NEGATIVE_SCENARIO_FAILURE'
            : !dod.NEXT_TZ_DOD_03
              ? 'POSITIVE_SCENARIO_FAILURE'
              : !dod.NEXT_TZ_DOD_06
                ? 'ADVISORY_TO_BLOCKING_DRIFT'
                : 'X17_WS03_FORMAT_PLAN_REVIEW_ACTIONS_FAIL';
    state.failSignalCode = state.failReason;
  }

  return state;
}

function printHuman(state) {
  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`ACTION_COUNT=${state.counts.actionCount}`);
  console.log(`ROW_COUNT=${state.counts.rowCount}`);
  console.log(`MISSING_REQUIRED_ACTION_ROWS_COUNT=${state.counts.missingRequiredActionRowsCount}`);
  console.log(`MENU_PROJECTION_GAP_COUNT=${state.counts.menuProjectionGapCount}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.counts.advisoryToBlockingDriftCount}`);
  if (!state.ok) {
    console.log(`FAIL_REASON=${state.failReason}`);
    console.log(`FAIL_SIGNAL=${state.failSignalCode}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateX17Ws03FormatPlanReviewActionsState({
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
  evaluateX17Ws03FormatPlanReviewActionsState,
  TOKEN_NAME,
};
