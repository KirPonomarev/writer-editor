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
import { createCommandRegistry } from '../../src/renderer/commands/registry.mjs';
import { registerProjectCommands } from '../../src/renderer/commands/projectCommands.mjs';

const TOKEN_NAME = 'X18_WS03_MENU_STATUS_FEEDBACK_AND_SAVE_SIGNALS_OK';
const EXPECTED_CANON_VERSION = 'v3.13a-final';
const DRIFT_PROBE_FAILSIGNAL = 'E_REMOTE_UNAVAILABLE';

const DEFAULT_CANON_STATUS_PATH = 'docs/OPS/STATUS/CANON_STATUS.json';
const DEFAULT_FAILSIGNAL_REGISTRY_PATH = 'docs/OPS/FAILSIGNALS/FAILSIGNAL_REGISTRY.json';
const DEFAULT_STATUS_FEEDBACK_DOC_PATH = 'docs/OPS/STATUS/X18_STATUS_FEEDBACK_BASELINE_v1.json';
const DEFAULT_MENU_GROUPS_PATH = 'docs/OPS/STATUS/X16_MENU_FUNCTION_GROUPS_v1.json';
const DEFAULT_COMMAND_CAPABILITY_BINDING_PATH = 'docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json';

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

function toUniqueStrings(value, { sort = true } = {}) {
  const source = Array.isArray(value) ? value : [];
  const out = [];
  const seen = new Set();
  for (const raw of source) {
    const normalized = normalizeString(String(raw || ''));
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  if (sort) out.sort((a, b) => a.localeCompare(b));
  return out;
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

function validateCanonLock(canonStatusDoc) {
  if (!isObjectRecord(canonStatusDoc)) {
    return { ok: false, reason: 'CANON_STATUS_UNREADABLE', observedStatus: '', observedVersion: '' };
  }
  const observedStatus = normalizeString(canonStatusDoc.status);
  const observedVersion = normalizeString(canonStatusDoc.canonVersion);
  const ok = observedStatus === 'ACTIVE_CANON' && observedVersion.toLowerCase() === EXPECTED_CANON_VERSION;
  return { ok, reason: ok ? '' : 'ACTIVE_CANON_LOCK_FAIL', observedStatus, observedVersion };
}

function normalizeStatusFeedbackDoc(doc) {
  const source = isObjectRecord(doc) ? doc : {};
  const entries = Array.isArray(source.entries) ? source.entries : [];
  const resetPolicy = isObjectRecord(source.resetPolicy) ? source.resetPolicy : {};

  return {
    schemaVersion: Number(source.schemaVersion) || 1,
    statusFeedbackVersion: normalizeString(source.statusFeedbackVersion),
    nonBlockingClassification: normalizeString(source.nonBlockingClassification).toLowerCase(),
    blockingSurfaceExpansion: source.blockingSurfaceExpansion === true,
    channels: toUniqueStrings(source.channels, { sort: false }),
    modes: toUniqueStrings(source.modes, { sort: false }),
    profiles: toUniqueStrings(source.profiles, { sort: false }),
    statusStates: toUniqueStrings(source.statusStates, { sort: false }),
    requiredSaveSignals: toUniqueStrings(source.requiredSaveSignals),
    requiredCommandResultSignals: toUniqueStrings(source.requiredCommandResultSignals),
    allowedSourceEvents: toUniqueStrings(source.allowedSourceEvents),
    resetPolicy: {
      defaultTimeoutMs: Number(resetPolicy.defaultTimeoutMs) || 0,
      maxTimeoutMs: Number(resetPolicy.maxTimeoutMs) || 0,
      onModeSwitchReset: resetPolicy.onModeSwitchReset === true,
      onProfileSwitchReset: resetPolicy.onProfileSwitchReset === true,
    },
    entries: entries
      .map((row) => {
        const channels = isObjectRecord(row?.channels) ? row.channels : {};
        return {
          signalId: normalizeString(row?.signalId),
          sourceEvent: normalizeString(row?.sourceEvent),
          commandId: normalizeString(row?.commandId),
          resultType: normalizeString(row?.resultType).toLowerCase(),
          timeoutMs: Number(row?.timeoutMs) || 0,
          resetOn: toUniqueStrings(row?.resetOn),
          channels: {
            menu: normalizeString(channels.menu).toLowerCase(),
            toolbar: normalizeString(channels.toolbar).toLowerCase(),
            statusbar: normalizeString(channels.statusbar).toLowerCase(),
          },
          modes: toUniqueStrings(row?.modes, { sort: false }),
          profiles: toUniqueStrings(row?.profiles, { sort: false }),
        };
      })
      .filter((row) => row.signalId),
  };
}

function normalizeMenuGroupsDoc(doc) {
  const source = isObjectRecord(doc) ? doc : {};
  return {
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

function buildMenuProjection(menuGroups) {
  const rowMap = new Map();
  for (const entryRaw of menuGroups.entries) {
    if (!isObjectRecord(entryRaw)) continue;
    const commandId = normalizeString(entryRaw.commandId);
    if (!commandId) continue;
    const rules = Array.isArray(entryRaw.rules) ? entryRaw.rules : [];

    for (const ruleRaw of rules) {
      if (!isObjectRecord(ruleRaw)) continue;
      const mode = normalizeString(ruleRaw.mode);
      const profiles = toUniqueStrings(ruleRaw.profiles, { sort: false });
      const channels = isObjectRecord(ruleRaw.channels) ? ruleRaw.channels : {};

      for (const profile of profiles) {
        rowMap.set(`${commandId}|${mode}|${profile}`, {
          menu: normalizeString(channels.menu),
          toolbar: normalizeString(channels.toolbar),
          palette: normalizeString(channels.palette),
        });
      }
    }
  }
  return rowMap;
}

function buildRuntimeCommandMeta() {
  const registry = createCommandRegistry();
  registerProjectCommands(registry, { electronAPI: {}, uiActions: {} });
  const rows = registry.listCommandMeta();
  return new Map(rows.map((row) => [normalizeString(row.id), row]));
}

function uniqueIssueRows(rows, keyFn) {
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    const key = keyFn(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function validateStatusFeedbackDoc({
  statusDoc,
  menuProjection,
  runtimeMeta,
  capabilityBinding,
}) {
  const duplicateSignals = [];
  const sourceEventMissing = [];
  const sourceEventNotAllowed = [];
  const commandBindingMissing = [];
  const capabilityBindingMissing = [];
  const staleEntryTargets = [];
  const modeProfileVisibilityGaps = [];
  const statusResetGaps = [];
  const channelStatusInconsistency = [];
  const unknownModes = [];
  const unknownProfiles = [];
  const requiredSaveSignalMissing = [];
  const requiredCommandResultSignalMissing = [];

  const allowedEvents = new Set(statusDoc.allowedSourceEvents);
  const modeSet = new Set(statusDoc.modes);
  const profileSet = new Set(statusDoc.profiles);
  const stateSet = new Set(statusDoc.statusStates);

  const signalIds = statusDoc.entries.map((row) => row.signalId);
  const signalIdSet = new Set(signalIds);
  for (const signalId of statusDoc.requiredSaveSignals) {
    if (!signalIdSet.has(signalId)) {
      requiredSaveSignalMissing.push({ signalId, reason: 'REQUIRED_SAVE_SIGNAL_MISSING' });
    }
  }
  for (const signalId of statusDoc.requiredCommandResultSignals) {
    if (!signalIdSet.has(signalId)) {
      requiredCommandResultSignalMissing.push({ signalId, reason: 'REQUIRED_COMMAND_RESULT_SIGNAL_MISSING' });
    }
  }

  const signalCounts = new Map();
  for (const signalId of signalIds) {
    signalCounts.set(signalId, (signalCounts.get(signalId) || 0) + 1);
  }
  for (const [signalId, count] of signalCounts.entries()) {
    if (count > 1) duplicateSignals.push({ signalId, count, reason: 'DUPLICATE_SIGNAL_ID' });
  }

  const projection = [];
  for (const row of statusDoc.entries) {
    const commandMeta = runtimeMeta.get(row.commandId) || null;

    if (!row.sourceEvent) {
      sourceEventMissing.push({ signalId: row.signalId, reason: 'SOURCE_EVENT_MISSING' });
    } else if (!allowedEvents.has(row.sourceEvent)) {
      sourceEventNotAllowed.push({ signalId: row.signalId, sourceEvent: row.sourceEvent, reason: 'SOURCE_EVENT_NOT_ALLOWED' });
    }

    if (!stateSet.has(row.resultType)) {
      statusResetGaps.push({ signalId: row.signalId, resultType: row.resultType, reason: 'RESULT_TYPE_NOT_ALLOWED' });
    }

    if (!commandMeta) {
      commandBindingMissing.push({ signalId: row.signalId, commandId: row.commandId, reason: 'COMMAND_NOT_REGISTERED' });
    }

    if (!capabilityBinding.has(row.commandId)) {
      capabilityBindingMissing.push({ signalId: row.signalId, commandId: row.commandId, reason: 'CAPABILITY_BINDING_MISSING' });
    }

    if (row.timeoutMs <= 0) {
      statusResetGaps.push({ signalId: row.signalId, timeoutMs: row.timeoutMs, reason: 'INVALID_TIMEOUT' });
    }
    if (statusDoc.resetPolicy.maxTimeoutMs > 0 && row.timeoutMs > statusDoc.resetPolicy.maxTimeoutMs) {
      statusResetGaps.push({ signalId: row.signalId, timeoutMs: row.timeoutMs, reason: 'TIMEOUT_EXCEEDS_MAX' });
    }
    if (row.resetOn.length === 0) {
      statusResetGaps.push({ signalId: row.signalId, reason: 'RESET_RULES_MISSING' });
    }
    for (const eventId of row.resetOn) {
      if (!allowedEvents.has(eventId)) {
        statusResetGaps.push({ signalId: row.signalId, eventId, reason: 'RESET_EVENT_NOT_ALLOWED' });
      }
    }

    const channelValues = [row.channels.menu, row.channels.toolbar, row.channels.statusbar];
    if (new Set(channelValues).size !== 1) {
      channelStatusInconsistency.push({
        signalId: row.signalId,
        menu: row.channels.menu,
        toolbar: row.channels.toolbar,
        statusbar: row.channels.statusbar,
        reason: 'CHANNEL_STATUS_INCONSISTENT',
      });
    }

    for (const mode of row.modes) {
      if (!modeSet.has(mode)) {
        unknownModes.push({ signalId: row.signalId, mode });
      }

      for (const profile of row.profiles) {
        if (!profileSet.has(profile)) {
          unknownProfiles.push({ signalId: row.signalId, profile });
        }

        const menuChannels = menuProjection.get(`${row.commandId}|${mode}|${profile}`) || null;
        if (!menuChannels) {
          staleEntryTargets.push({ signalId: row.signalId, commandId: row.commandId, mode, profile, reason: 'STALE_ENTRY_TARGET' });
          modeProfileVisibilityGaps.push({ signalId: row.signalId, commandId: row.commandId, mode, profile, reason: 'MENU_VISIBILITY_RULE_MISSING' });
          continue;
        }

        if (row.channels.menu === 'visible' && menuChannels.menu !== 'visible') {
          modeProfileVisibilityGaps.push({ signalId: row.signalId, commandId: row.commandId, mode, profile, reason: 'MENU_CHANNEL_MISMATCH' });
        }
        if (row.channels.toolbar === 'visible' && menuChannels.toolbar !== 'visible') {
          modeProfileVisibilityGaps.push({ signalId: row.signalId, commandId: row.commandId, mode, profile, reason: 'TOOLBAR_CHANNEL_MISMATCH' });
        }

        projection.push({
          signalId: row.signalId,
          commandId: row.commandId,
          sourceEvent: row.sourceEvent,
          resultType: row.resultType,
          mode,
          profile,
          channels: row.channels,
        });
      }
    }
  }

  const projectionSorted = projection.sort((a, b) => {
    const left = `${a.signalId}|${a.commandId}|${a.mode}|${a.profile}`;
    const right = `${b.signalId}|${b.commandId}|${b.mode}|${b.profile}`;
    return left.localeCompare(right);
  });
  const projectionHash = createHash('sha256').update(stableStringify(projectionSorted)).digest('hex');

  const cleaned = {
    duplicateSignals: uniqueIssueRows(duplicateSignals, (row) => row.signalId),
    sourceEventMissing: uniqueIssueRows(sourceEventMissing, (row) => row.signalId),
    sourceEventNotAllowed: uniqueIssueRows(sourceEventNotAllowed, (row) => `${row.signalId}|${row.sourceEvent}`),
    commandBindingMissing: uniqueIssueRows(commandBindingMissing, (row) => `${row.signalId}|${row.commandId}`),
    capabilityBindingMissing: uniqueIssueRows(capabilityBindingMissing, (row) => `${row.signalId}|${row.commandId}`),
    staleEntryTargets: uniqueIssueRows(staleEntryTargets, (row) => `${row.signalId}|${row.commandId}|${row.mode}|${row.profile}`),
    modeProfileVisibilityGaps: uniqueIssueRows(modeProfileVisibilityGaps, (row) => `${row.signalId}|${row.commandId}|${row.mode}|${row.profile}|${row.reason}`),
    statusResetGaps: uniqueIssueRows(statusResetGaps, (row) => `${row.signalId}|${row.reason}|${row.eventId || ''}`),
    channelStatusInconsistency: uniqueIssueRows(channelStatusInconsistency, (row) => row.signalId),
    unknownModes: uniqueIssueRows(unknownModes, (row) => `${row.signalId}|${row.mode}`),
    unknownProfiles: uniqueIssueRows(unknownProfiles, (row) => `${row.signalId}|${row.profile}`),
    requiredSaveSignalMissing: uniqueIssueRows(requiredSaveSignalMissing, (row) => row.signalId),
    requiredCommandResultSignalMissing: uniqueIssueRows(requiredCommandResultSignalMissing, (row) => row.signalId),
  };

  const requiredSaveSignalsVisible = statusDoc.requiredSaveSignals.every((signalId) => {
    const row = statusDoc.entries.find((entry) => entry.signalId === signalId);
    return row
      && row.channels.menu === 'visible'
      && row.channels.toolbar === 'visible'
      && row.channels.statusbar === 'visible';
  });

  const resetPolicyValid = statusDoc.resetPolicy.defaultTimeoutMs > 0
    && statusDoc.resetPolicy.maxTimeoutMs >= statusDoc.resetPolicy.defaultTimeoutMs
    && statusDoc.resetPolicy.onModeSwitchReset
    && statusDoc.resetPolicy.onProfileSwitchReset;

  const ok = !statusDoc.blockingSurfaceExpansion
    && statusDoc.nonBlockingClassification === 'advisory_until_machine_bound'
    && resetPolicyValid
    && cleaned.duplicateSignals.length === 0
    && cleaned.sourceEventMissing.length === 0
    && cleaned.sourceEventNotAllowed.length === 0
    && cleaned.commandBindingMissing.length === 0
    && cleaned.capabilityBindingMissing.length === 0
    && cleaned.staleEntryTargets.length === 0
    && cleaned.modeProfileVisibilityGaps.length === 0
    && cleaned.statusResetGaps.length === 0
    && cleaned.channelStatusInconsistency.length === 0
    && cleaned.unknownModes.length === 0
    && cleaned.unknownProfiles.length === 0
    && cleaned.requiredSaveSignalMissing.length === 0
    && cleaned.requiredCommandResultSignalMissing.length === 0
    && requiredSaveSignalsVisible;

  return {
    ok,
    projection: projectionSorted,
    projectionHash,
    entryCount: statusDoc.entries.length,
    requiredSaveSignalCount: statusDoc.requiredSaveSignals.length,
    requiredCommandResultSignalCount: statusDoc.requiredCommandResultSignals.length,
    requiredSaveSignalsVisible,
    resetPolicyValid,
    ...cleaned,
  };
}

function evaluateDeterminism(validationFn) {
  const runA = validationFn();
  const runB = validationFn();
  const runC = validationFn();
  const deterministic = runA.ok && runB.ok && runC.ok
    && runA.projectionHash === runB.projectionHash
    && runB.projectionHash === runC.projectionHash;
  return { ok: deterministic, hashes: [runA.projectionHash, runB.projectionHash, runC.projectionHash] };
}

function evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc) {
  const failSignals = Array.isArray(failsignalRegistryDoc?.failSignals) ? failsignalRegistryDoc.failSignals : [];
  const driftCases = [];
  const issues = [];

  for (const row of failSignals) {
    if (!isObjectRecord(row)) continue;
    const failSignalCode = normalizeString(row.code);
    if (!failSignalCode || failSignalCode !== DRIFT_PROBE_FAILSIGNAL) continue;

    for (const key of MODE_KEYS) {
      const expected = normalizeString((row.modeMatrix || {})[key]).toLowerCase();
      if (expected !== 'advisory') continue;

      const verdict = evaluateModeMatrixVerdict({ repoRoot, mode: MODE_LABELS[key], failSignalCode });
      if (!verdict.ok) {
        issues.push({ failSignalCode, mode: MODE_LABELS[key], reason: 'MODE_EVALUATOR_ERROR', evaluatorIssues: verdict.issues || [] });
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

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function evaluateX18Ws03MenuStatusFeedbackAndSaveSignalsState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());

  const canonStatusPath = path.resolve(repoRoot, normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH));
  const failsignalRegistryPath = path.resolve(repoRoot, normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH));
  const statusFeedbackDocPath = path.resolve(repoRoot, DEFAULT_STATUS_FEEDBACK_DOC_PATH);
  const menuGroupsPath = path.resolve(repoRoot, DEFAULT_MENU_GROUPS_PATH);
  const capabilityBindingPath = path.resolve(repoRoot, DEFAULT_COMMAND_CAPABILITY_BINDING_PATH);

  const canonStatusDoc = isObjectRecord(input.canonStatusDoc) ? input.canonStatusDoc : readJsonObject(canonStatusPath);
  const failsignalRegistryDoc = isObjectRecord(input.failsignalRegistryDoc)
    ? input.failsignalRegistryDoc
    : readJsonObject(failsignalRegistryPath);
  const statusFeedbackRaw = readJsonObject(statusFeedbackDocPath);
  const menuGroupsRaw = readJsonObject(menuGroupsPath);
  const capabilityBindingRaw = readJsonObject(capabilityBindingPath);

  const statusDoc = normalizeStatusFeedbackDoc(statusFeedbackRaw);
  const menuGroups = normalizeMenuGroupsDoc(menuGroupsRaw);
  const menuProjection = buildMenuProjection(menuGroups);
  const runtimeMeta = buildRuntimeCommandMeta();
  const capabilityBinding = parseCapabilityBindingDoc(capabilityBindingRaw);

  const canonLock = validateCanonLock(canonStatusDoc);
  const stageActivation = evaluateResolveActiveStageState({ profile: 'release', gateTier: 'release' });
  const stageActivationGuardCheck = Number(stageActivation.STAGE_ACTIVATION_OK) === 1;

  const validateBaseline = () => validateStatusFeedbackDoc({
    statusDoc,
    menuProjection,
    runtimeMeta,
    capabilityBinding,
  });

  const baseline = validateBaseline();
  const determinism = evaluateDeterminism(validateBaseline);

  const negative01Doc = deepClone(statusDoc);
  if (negative01Doc.entries[0]) {
    negative01Doc.entries[0].sourceEvent = '';
  }
  const negative01 = validateStatusFeedbackDoc({
    statusDoc: negative01Doc,
    menuProjection,
    runtimeMeta,
    capabilityBinding,
  });

  const negative02Doc = deepClone(statusDoc);
  negative02Doc.entries = negative02Doc.entries.filter((row) => row.signalId !== 'command.error');
  const negative02 = validateStatusFeedbackDoc({
    statusDoc: negative02Doc,
    menuProjection,
    runtimeMeta,
    capabilityBinding,
  });

  const negative03Doc = deepClone(statusDoc);
  if (negative03Doc.entries[0]) {
    negative03Doc.entries[0].timeoutMs = 0;
    negative03Doc.entries[0].resetOn = [];
  }
  const negative03 = validateStatusFeedbackDoc({
    statusDoc: negative03Doc,
    menuProjection,
    runtimeMeta,
    capabilityBinding,
  });

  const negative04Doc = deepClone(statusDoc);
  if (negative04Doc.entries[0]) {
    negative04Doc.entries[0].modes = ['GhostMode'];
  }
  const negative04 = validateStatusFeedbackDoc({
    statusDoc: negative04Doc,
    menuProjection,
    runtimeMeta,
    capabilityBinding,
  });

  const negative05Doc = deepClone(statusDoc);
  if (negative05Doc.entries[0]) {
    negative05Doc.entries[0].channels.statusbar = 'hidden';
  }
  const negative05 = validateStatusFeedbackDoc({
    statusDoc: negative05Doc,
    menuProjection,
    runtimeMeta,
    capabilityBinding,
  });

  const drift = evaluateAdvisoryToBlockingDrift(repoRoot, failsignalRegistryDoc);

  const negativeResults = {
    NEXT_TZ_NEGATIVE_01: negative01.sourceEventMissing.length > 0,
    NEXT_TZ_NEGATIVE_02: negative02.requiredCommandResultSignalMissing.length > 0,
    NEXT_TZ_NEGATIVE_03: negative03.statusResetGaps.length > 0,
    NEXT_TZ_NEGATIVE_04: negative04.unknownModes.length > 0 || negative04.modeProfileVisibilityGaps.length > 0,
    NEXT_TZ_NEGATIVE_05: negative05.channelStatusInconsistency.length > 0,
  };

  const positiveResults = {
    NEXT_TZ_POSITIVE_01: baseline.requiredSaveSignalMissing.length === 0
      && baseline.requiredSaveSignalsVisible
      && baseline.channelStatusInconsistency.length === 0,
    NEXT_TZ_POSITIVE_02: baseline.requiredCommandResultSignalMissing.length === 0
      && baseline.commandBindingMissing.length === 0
      && baseline.capabilityBindingMissing.length === 0
      && determinism.ok,
    NEXT_TZ_POSITIVE_03: baseline.statusResetGaps.length === 0 && baseline.resetPolicyValid,
  };

  const allNegativesPass = Object.values(negativeResults).every(Boolean);
  const allPositivesPass = Object.values(positiveResults).every(Boolean);

  const dod = {
    NEXT_TZ_DOD_01: baseline.ok,
    NEXT_TZ_DOD_02: allNegativesPass,
    NEXT_TZ_DOD_03: allPositivesPass,
    NEXT_TZ_DOD_04: determinism.ok,
    NEXT_TZ_DOD_05: statusDoc.blockingSurfaceExpansion === false,
    NEXT_TZ_DOD_06: drift.advisoryToBlockingDriftCountZero,
  };

  const acceptance = {
    NEXT_TZ_ACCEPTANCE_01: canonLock.ok,
    NEXT_TZ_ACCEPTANCE_02: stageActivationGuardCheck,
    NEXT_TZ_ACCEPTANCE_03: false,
    NEXT_TZ_ACCEPTANCE_04: false,
  };

  const ok = baseline.ok
    && allNegativesPass
    && allPositivesPass
    && canonLock.ok
    && stageActivationGuardCheck
    && drift.advisoryToBlockingDriftCountZero;

  return {
    ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    canonLock,
    stageActivation: {
      ...stageActivation,
      STAGE_ACTIVATION_GUARD_CHECK: stageActivationGuardCheck ? 1 : 0,
    },
    blockingSurfaceExpansion: statusDoc.blockingSurfaceExpansion === true,
    baseline,
    determinism,
    counts: {
      entryCount: baseline.entryCount,
      requiredSaveSignalCount: baseline.requiredSaveSignalCount,
      requiredCommandResultSignalCount: baseline.requiredCommandResultSignalCount,
      sourceEventGapCount: baseline.sourceEventMissing.length + baseline.sourceEventNotAllowed.length,
      commandBindingGapCount: baseline.commandBindingMissing.length,
      capabilityBindingGapCount: baseline.capabilityBindingMissing.length,
      staleEntryTargetCount: baseline.staleEntryTargets.length,
      modeProfileVisibilityGapCount: baseline.modeProfileVisibilityGaps.length,
      statusResetGapCount: baseline.statusResetGaps.length,
      channelStatusInconsistencyCount: baseline.channelStatusInconsistency.length,
      requiredSaveSignalGapCount: baseline.requiredSaveSignalMissing.length,
      requiredCommandResultSignalGapCount: baseline.requiredCommandResultSignalMissing.length,
      advisoryToBlockingDriftCount: drift.advisoryToBlockingDriftCount,
      channelCount: statusDoc.channels.length,
      modeCount: statusDoc.modes.length,
      profileCount: statusDoc.profiles.length,
    },
    negativeResults,
    positiveResults,
    dod,
    acceptance,
    drift,
    detector: {
      detectorId: 'X18_WS03_STATUS_FEEDBACK_SINGLE_DETECTOR_V1',
      canonicalModeEvaluatorId: CANONICAL_MODE_MATRIX_EVALUATOR_ID,
      contentHash: createHash('sha256').update(stableStringify({
        baseline: {
          projectionHash: baseline.projectionHash,
          entryCount: baseline.entryCount,
          requiredSaveSignalCount: baseline.requiredSaveSignalCount,
          requiredCommandResultSignalCount: baseline.requiredCommandResultSignalCount,
        },
        counts: {
          sourceEventGapCount: baseline.sourceEventMissing.length + baseline.sourceEventNotAllowed.length,
          commandBindingGapCount: baseline.commandBindingMissing.length,
          staleEntryTargetCount: baseline.staleEntryTargets.length,
          modeProfileVisibilityGapCount: baseline.modeProfileVisibilityGaps.length,
          statusResetGapCount: baseline.statusResetGaps.length,
          channelStatusInconsistencyCount: baseline.channelStatusInconsistency.length,
          requiredSaveSignalGapCount: baseline.requiredSaveSignalMissing.length,
          requiredCommandResultSignalGapCount: baseline.requiredCommandResultSignalMissing.length,
          advisoryToBlockingDriftCount: drift.advisoryToBlockingDriftCount,
        },
      })).digest('hex'),
    },
    negativeDetails: {
      NEXT_TZ_NEGATIVE_01: negative01,
      NEXT_TZ_NEGATIVE_02: negative02,
      NEXT_TZ_NEGATIVE_03: negative03,
      NEXT_TZ_NEGATIVE_04: negative04,
      NEXT_TZ_NEGATIVE_05: negative05,
    },
    sourceBinding: {
      statusFeedbackDocPath: DEFAULT_STATUS_FEEDBACK_DOC_PATH,
      menuGroupsPath: DEFAULT_MENU_GROUPS_PATH,
      capabilityBindingPath: DEFAULT_COMMAND_CAPABILITY_BINDING_PATH,
      canonStatusPath: normalizeString(input.canonStatusPath || DEFAULT_CANON_STATUS_PATH),
      failsignalRegistryPath: normalizeString(input.failsignalRegistryPath || DEFAULT_FAILSIGNAL_REGISTRY_PATH),
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateX18Ws03MenuStatusFeedbackAndSaveSignalsState({
    repoRoot: process.cwd(),
    canonStatusPath: args.canonStatusPath,
    failsignalRegistryPath: args.failsignalRegistryPath,
  });

  if (args.json) {
    process.stdout.write(`${stableStringify(state)}\n`);
    process.exit(state.ok ? 0 : 1);
  }

  console.log(`${TOKEN_NAME}=${state[TOKEN_NAME]}`);
  console.log(`CANON_LOCK_CHECK=${state.canonLock.ok ? 'PASS' : 'FAIL'}`);
  console.log(`STAGE_ACTIVATION_GUARD_CHECK=${state.stageActivation.STAGE_ACTIVATION_GUARD_CHECK === 1 ? 'PASS' : 'FAIL'}`);
  console.log(`SOURCE_EVENT_GAP_COUNT=${state.counts.sourceEventGapCount}`);
  console.log(`COMMAND_BINDING_GAP_COUNT=${state.counts.commandBindingGapCount}`);
  console.log(`STATUS_RESET_GAP_COUNT=${state.counts.statusResetGapCount}`);
  console.log(`CHANNEL_STATUS_INCONSISTENCY_COUNT=${state.counts.channelStatusInconsistencyCount}`);
  console.log(`ADVISORY_TO_BLOCKING_DRIFT_COUNT=${state.counts.advisoryToBlockingDriftCount}`);
  console.log(`REPEATABILITY_HASHES=${state.determinism.hashes.join(',')}`);
  process.exit(state.ok ? 0 : 1);
}

export { evaluateX18Ws03MenuStatusFeedbackAndSaveSignalsState };

const thisFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(thisFilePath)) {
  main();
}
